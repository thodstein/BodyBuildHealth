import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHUNK_SIZE,
  META_KEY,
  chunkValue,
  isKvExcludedKey,
  pickConflict,
  deriveSyncToken,
  initKvSync,
  flushKvNow,
  flushKvKeepAlive,
  pullKvNow,
  getKvSyncState,
  clearKvPendingUpdate,
  reloadKvView,
  _resetKvForTests,
  type KvRow,
  type KvTransport,
  type IdbAdapter,
} from '../cloud-kv';

class FakeTransport implements KvTransport {
  cloud = new Map<string, KvRow[]>();
  replaceCalls: string[] = [];
  removeCalls: string[] = [];
  keepAliveRows: KvRow[] = [];
  serverOffsetMs = 0;

  async pull(_token: string, onRows: (rows: KvRow[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (onServerNow) onServerNow(Date.now() + this.serverOffsetMs);
    onRows([...this.cloud.values()].flat());
  }

  async replaceKey(rows: KvRow[]): Promise<void> {
    this.replaceCalls.push(rows[0]?.key || '');
    this.cloud.set(rows[0]?.key || '', rows);
  }

  async removeKey(_token: string, key: string): Promise<void> {
    this.removeCalls.push(key);
    this.cloud.delete(key);
  }

  keepAlivePush(rows: KvRow[]): void {
    this.keepAliveRows.push(...rows);
  }

  seed(key: string, value: string, tsMs: number): void {
    const chunks = chunkValue(value);
    this.cloud.set(
      key,
      chunks.map((c, i) => ({
        id: 'tk_test',
        key,
        chunk_index: i,
        chunk_count: i === 0 ? chunks.length : 0,
        value: c,
        updated_at: new Date(tsMs).toISOString(),
      })),
    );
  }
}

async function init(transport: FakeTransport) {
  await initKvSync('tg_123', { transport, token: 'tk_test', flushDelayMs: 20 });
}

beforeEach(() => {
  _resetKvForTests();
  localStorage.clear();
});

describe('chunkValue', () => {
  it('пустая строка — один чанк', () => {
    expect(chunkValue('')).toEqual(['']);
  });

  it('короткая строка — один чанк', () => {
    expect(chunkValue('hello')).toEqual(['hello']);
  });

  it('строка ровно в CHUNK_SIZE — один чанк', () => {
    const v = 'x'.repeat(CHUNK_SIZE);
    expect(chunkValue(v)).toEqual([v]);
  });

  it('строка больше CHUNK_SIZE — несколько чанков, join сохраняет оригинал', () => {
    const v = 'абвгд'.repeat(Math.ceil((CHUNK_SIZE * 2.5) / 5));
    const chunks = chunkValue(v);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.join('')).toBe(v);
    expect(chunks.every(c => c.length <= CHUNK_SIZE)).toBe(true);
  });

  it('не разрывает суррогатные пары (эмодзи) на границе', () => {
    const v = '😀'.repeat(60_000); // 120 000 UTF-16 единиц > CHUNK_SIZE
    const chunks = chunkValue(v);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(v);
    for (const c of chunks) {
      const last = c.charCodeAt(c.length - 1);
      expect(last < 0xd800 || last > 0xdbff).toBe(true);
    }
  });
});

describe('isKvExcludedKey', () => {
  it('исключает служебные/сессионные ключи', () => {
    expect(isKvExcludedKey('he_session_v2')).toBe(true);
    expect(isKvExcludedKey('he_crypto_key')).toBe(true);
    expect(isKvExcludedKey('he_last_active')).toBe(true);
    expect(isKvExcludedKey(META_KEY)).toBe(true);
    expect(isKvExcludedKey('he_sync_ts_labs')).toBe(true);
    expect(isKvExcludedKey('he_draft_sleep_inline')).toBe(true);
    expect(isKvExcludedKey('he_nav_to_lab_diary')).toBe(true);
    expect(isKvExcludedKey('he_admin_seeded_v1')).toBe(true);
  });

  it('синхронизирует пользовательские ключи', () => {
    expect(isKvExcludedKey('he_profile_v2')).toBe(false);
    expect(isKvExcludedKey('he_weight_log')).toBe(false);
    expect(isKvExcludedKey('he_bb_plan')).toBe(false);
    expect(isKvExcludedKey('he_workout_log_v2')).toBe(false);
  });
});

describe('pickConflict', () => {
  it('локальные данные без mtime — берём удалённые', () => {
    expect(pickConflict(0, 1000)).toBe('remote');
  });

  it('удалённые данные отсутствуют — выгружаем локальные', () => {
    expect(pickConflict(5000, 0)).toBe('local');
  });

  it('удалённые новее на >500мс — берём удалённые', () => {
    expect(pickConflict(5000, 6000)).toBe('remote');
  });

  it('локальные новее на >500мс — выгружаем локальные', () => {
    expect(pickConflict(6000, 5000)).toBe('local');
  });

  it('расхождение ≤500мс — без действий (двойные записи в окне)', () => {
    expect(pickConflict(5000, 5200)).toBe('none');
    expect(pickConflict(5000, 4800)).toBe('none');
    expect(pickConflict(5000, 5000)).toBe('none');
  });
});

describe('deriveSyncToken', () => {
  it('детерминированный и с префиксом tk_', async () => {
    const a = await deriveSyncToken('12345');
    const b = await deriveSyncToken('12345');
    expect(a).toBe(b);
    expect(a.startsWith('tk_')).toBe(true);
    expect(a.length).toBe(3 + 64);
  });

  it('разные Telegram id — разные токены', async () => {
    const a = await deriveSyncToken('123');
    const c = await deriveSyncToken('456');
    expect(a).not.toBe(c);
  });
});

describe('синхронизация (движок с фейковым транспортом)', () => {
  it('pull на входе забирает облачные данные в localStorage', async () => {
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"name":"Иван"}', Date.now());
    await init(t);
    expect(localStorage.getItem('he_profile_v2')).toBe('{"name":"Иван"}');
  });

  it('setItem → flush выгружает ключ в облако (чанки + chunk_count в чанке 0)', async () => {
    const t = new FakeTransport();
    await init(t);
    const big = 'photo-base64,' + 'A'.repeat(250_000);
    localStorage.setItem('he_weight_log', big);
    await flushKvNow();
    const rows = t.cloud.get('he_weight_log')!;
    expect(rows.length).toBeGreaterThan(2);
    const head = rows.find(r => r.chunk_index === 0)!;
    expect(head.chunk_count).toBe(rows.length);
    expect(rows.filter(r => r.chunk_index !== 0).every(r => r.chunk_count === 0)).toBe(true);
    expect(rows.map(r => r.value).join('')).toBe(big);
  });

  it('removeItem → flush удаляет ключ в облаке', async () => {
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{}', Date.now());
    await init(t);
    localStorage.removeItem('he_profile_v2');
    await flushKvNow();
    expect(t.cloud.has('he_profile_v2')).toBe(false);
    expect(t.removeCalls).toContain('he_profile_v2');
  });

  it('облако новее → pull перезаписывает локальные данные', async () => {
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await init(t);
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":1}');
    t.seed('he_profile_v2', '{"v":2}', 9000);
    await pullKvNow();
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":2}');
  });

  it('локальные данные новее → push, а не потеря', async () => {
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await init(t);
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":1}');
    localStorage.setItem('he_profile_v2', '{"v":3}');
    await flushKvNow();
    expect(t.cloud.get('he_profile_v2')!.map(r => r.value).join('')).toBe('{"v":3}');
  });

  it('локальные ключи без mtime (никогда не синкались) — выгружаются при ините', async () => {
    const t = new FakeTransport();
    localStorage.setItem('he_weight_log', '[{"w":80}]');
    await init(t);
    await flushKvNow();
    expect(t.cloud.has('he_weight_log')).toBe(true);
    expect(t.cloud.get('he_weight_log')!.map(r => r.value).join('')).toBe('[{"w":80}]');
  });

  it('неполная запись в облаке (нет чанка 0) — пропускается и залечивается локальным push', async () => {
    const t = new FakeTransport();
    const chunks = chunkValue('полные данные');
    t.cloud.set('he_bb_plan', chunks.map((c, i) => ({
      id: 'tk_test',
      key: 'he_bb_plan',
      chunk_index: i + 1,
      chunk_count: 0,
      value: c,
      updated_at: new Date(1000).toISOString(),
    })));
    localStorage.setItem('he_bb_plan', 'локальные данные');
    // локальный mtime проставляется записью ДО инициализации только через мету —
    // здесь симулируем «писали до рестарта»: мета уже есть
    localStorage.setItem(META_KEY, JSON.stringify({ he_bb_plan: 9000 }));
    await init(t);
    await flushKvNow();
    const healed = t.cloud.get('he_bb_plan')!;
    expect(healed.find(r => r.chunk_index === 0)).toBeTruthy();
    expect(healed.map(r => r.value).join('')).toBe('локальные данные');
  });

  it('мета сохраняет mtime и переживает рестарт (без повторного push)', async () => {
    const t = new FakeTransport();
    await init(t);
    localStorage.setItem('he_profile_v2', '{"v":1}');
    await flushKvNow();
    const pushes = t.replaceCalls.length;
    expect(t.replaceCalls).toContain('he_profile_v2');
    expect(JSON.parse(localStorage.getItem(META_KEY) || '{}')).toHaveProperty('he_profile_v2');

    // рестарт: сбрасываем движок, localStorage не очищаем
    _resetKvForTests();
    await init(t);
    await flushKvNow();
    expect(t.replaceCalls.length).toBe(pushes);
  });

  it('keepalive: маленькие ключи уезжают, большие — только обычным flush', async () => {
    const t = new FakeTransport();
    await init(t);
    localStorage.setItem('he_small', 'S'.repeat(10_000));
    localStorage.setItem('he_big', 'B'.repeat(200_000));
    flushKvKeepAlive();
    expect(t.keepAliveRows.length).toBeGreaterThan(0);
    const keys = new Set(t.keepAliveRows.map(r => r.key));
    expect(keys.has('he_small')).toBe(true);
    expect(keys.has('he_big')).toBe(false);
    const totalBytes = t.keepAliveRows.reduce((acc, r) => acc + JSON.stringify(r).length, 0);
    expect(totalBytes).toBeLessThanOrEqual(48_000 + 1000);
    // большой ключ не теряется — он остаётся dirty и уезжает обычным flush
    await flushKvNow();
    expect(t.cloud.has('he_big')).toBe(true);
  });

  it('статус: off без облака, idle после инициализации', async () => {
    expect(getKvSyncState().status).toBe('off');
    const t = new FakeTransport();
    await init(t);
    expect(getKvSyncState().status).toBe('idle');
  });
});

describe('фоновый pull и уведомление об обновлении', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('стартовый pull НЕ перезагружает страницу', async () => {
    const t = new FakeTransport();
    const reload = vi.fn();
    t.seed('he_profile_v2', '{"v":1}', Date.now());
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, reloadFn: reload });
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":1}');
    expect(reload).not.toHaveBeenCalled();
  });

  it('фоновый pull применяет данные и ставит флаг pendingUpdate БЕЗ авто-перезагрузки', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    const reload = vi.fn();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, reloadFn: reload });
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":1}');

    // другое устройство обновило данные в облаке
    t.seed('he_profile_v2', '{"v":2}', 9000);
    const applied = await pullKvNow();
    expect(applied).toBe(1);
    expect(localStorage.getItem('he_profile_v2')).toBe('{"v":2}');
    // данные уже записаны, но экран не перезагружается автоматически
    expect(reload).not.toHaveBeenCalled();
    expect(getKvSyncState().pendingUpdate).toMatchObject({ applied: 1 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('кнопка «Обновить» (reloadKvView) перезагружает; ✕ снимает флаг', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    const reload = vi.fn();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, reloadFn: reload });
    t.seed('he_profile_v2', '{"v":2}', 9000);
    await pullKvNow();
    expect(getKvSyncState().pendingUpdate).toBeTruthy();

    clearKvPendingUpdate();
    expect(getKvSyncState().pendingUpdate).toBeUndefined();

    // снова появились данные → кнопка вызывает reloadKvView → reloadFn
    t.seed('he_profile_v2', '{"v":3}', 99000);
    await pullKvNow();
    expect(getKvSyncState().pendingUpdate).toBeTruthy();
    reloadKvView();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('фоновый pull без новых данных не ставит флаг', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    const applied = await pullKvNow();
    expect(applied).toBe(0);
    expect(getKvSyncState().pendingUpdate).toBeUndefined();
  });

  it('интервальный pull забирает изменения с другого устройства и ставит флаг', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, pullIntervalMs: 100 });
    t.seed('he_weight_log', '[{"w":82}]', 5000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(localStorage.getItem('he_weight_log')).toBe('[{"w":82}]');
    expect(getKvSyncState().pendingUpdate).toBeTruthy();
  });
});

describe('расхождение часов устройства и сервера (LWW по серверному времени)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('свои записи штампуются серверным временем, а не часами устройства', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    // часы телефона спешат на 1 час относительно сервера
    t.serverOffsetMs = -3_600_000;
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    localStorage.setItem('he_profile_v2', '{"v":1}');
    await flushKvNow();
    const ts = Date.parse(t.cloud.get('he_profile_v2')![0].updated_at);
    const serverNow = Date.now() - 3_600_000;
    expect(Math.abs(ts - serverNow)).toBeLessThan(60_000);
    // без серверной калибровки было бы Date.now() (на 1 час больше)
    expect(Math.abs(ts - Date.now())).toBeGreaterThan(3_000_000);
  });

  it('запись с ПК (корректные часы) побеждает, даже если часы телефона спешат', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    t.serverOffsetMs = -3_600_000; // телефон «убежал» на 1 час вперёд
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });

    // телефон записал свои данные 5 минут назад (по серверным часам)
    vi.setSystemTime(Date.now() - 300_000);
    localStorage.setItem('he_lab_reports', '[{"lab":"phone"}]');
    await flushKvNow();
    vi.setSystemTime(Date.now() + 300_000);

    // ПК записал данные позже — в облаке серверное время этой записи НОВЕЕ
    t.seed('he_lab_reports', '[{"lab":"pc"}]', Date.now() - 3_600_000 + 30_000);

    const applied = await pullKvNow();
    expect(applied).toBe(1);
    expect(localStorage.getItem('he_lab_reports')).toBe('[{"lab":"pc"}]');
  });

  it('более свежие локальные данные не перезатираются старыми из облака', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    t.serverOffsetMs = 0;
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20 });
    localStorage.setItem('he_weight_log', '[{"w":80}]');
    await flushKvNow();
    // облако получило старую версию (от другого устройства, записано раньше)
    t.seed('he_weight_log', '[{"w":70}]', Date.now() - 60_000);
    const applied = await pullKvNow();
    expect(applied).toBe(0);
    expect(localStorage.getItem('he_weight_log')).toBe('[{"w":80}]');
  });
});

describe('синхронизация IndexedDB (анализы/курс/дневник силы)', () => {
  class FakeIdb implements IdbAdapter {
    stores = new Map<string, Map<string, any>>();
    constructor() {
      for (const s of ['labs_log', 'course_log', 'workout_log', 'training_log']) this.stores.set(s, new Map());
    }
    async getAll(store: string) { return [...(this.stores.get(store)?.values() || [])]; }
    async get(store: string, id: string) { return this.stores.get(store)?.get(String(id)); }
    async put(store: string, rec: any) { this.stores.get(store)!.set(String(rec.id), rec); }
    async delete(store: string, id: string) { this.stores.get(store)!.delete(String(id)); }
    has(store: string, id: string) { return this.stores.get(store)!.has(String(id)); }
    count(store: string) { return this.stores.get(store)!.size; }
  }

  function seedIdbCloud(t: FakeTransport, store: string, rec: any, tsMs: number): void {
    const key = `idb:${store}:${rec.id}`;
    t.cloud.set(key, [{
      id: 'tk_test',
      key,
      chunk_index: 0,
      chunk_count: 1,
      value: JSON.stringify(rec),
      updated_at: new Date(tsMs).toISOString(),
    }]);
  }

  it('новый анализ с телефона доезжает до ПК', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    // телефон записал анализ → pull выгружает его в облако
    idbA.put('labs_log', { id: 'lab1', code: 'HGB', name: 'Гемоглобин', value: 150, unit: 'г/л', date: '2026-08-19' });
    await pullKvNow();
    expect(t.cloud.has('idb:labs_log:lab1')).toBe(true);
    expect(JSON.parse(t.cloud.get('idb:labs_log:lab1')![0].value)).toMatchObject({ code: 'HGB', value: 150 });

    // «ПК»: новое устройство, тот же транспорт, пустой IndexedDB
    _resetKvForTests();
    localStorage.clear();
    const idbB = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbB });
    expect(idbB.has('labs_log', 'lab1')).toBe(true);
    expect(await idbB.get('labs_log', 'lab1')).toMatchObject({ code: 'HGB', value: 150 });
  });

  it('правка анализа на ПК доезжает до телефона (запись на телефоне не менялась)', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    idbA.put('labs_log', { id: 'lab1', code: 'HGB', value: 150, date: '2026-08-10' });
    await pullKvNow();
    expect(JSON.parse(t.cloud.get('idb:labs_log:lab1')![0].value)).toMatchObject({ value: 150 });
    const phoneMeta = localStorage.getItem('he_sync_meta_idb_v1');

    // «ПК»: правит запись (v155) и синкается — в облаке обновлённое значение
    _resetKvForTests();
    const idbB = new FakeIdb();
    idbB.put('labs_log', { id: 'lab1', code: 'HGB', value: 155, date: '2026-08-19' });
    localStorage.setItem('he_sync_meta_idb_v1', phoneMeta || '{}'); // ПК знает состояние облака
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbB });
    expect(JSON.parse(t.cloud.get('idb:labs_log:lab1')![0].value)).toMatchObject({ value: 155 });

    // «телефон»: возвращаем его мету (запись локально не менялась) → правка ПК применяется
    _resetKvForTests();
    localStorage.setItem('he_sync_meta_idb_v1', phoneMeta || '{}');
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    expect(await idbA.get('labs_log', 'lab1')).toMatchObject({ value: 155 });
  });

  it('локальная правка (ещё не синкалась) побеждает удалённую версию', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    idbA.put('labs_log', { id: 'lab1', code: 'HGB', value: 150, date: '2026-08-10' });
    await pullKvNow();
    // локальная правка после последней синхронизации
    idbA.put('labs_log', { id: 'lab1', code: 'HGB', value: 160, date: '2026-08-19' });
    // в облаке «чужой» вариант правки
    seedIdbCloud(t, 'labs_log', { id: 'lab1', code: 'HGB', value: 140, date: '2026-08-19' }, Date.now() - 10_000);
    const applied = await pullKvNow();
    expect(applied).toBe(0); // удалённая версия НЕ применяется
    expect(await idbA.get('labs_log', 'lab1')).toMatchObject({ value: 160 });
    // но локальная правка выгружается в облако
    expect(JSON.parse(t.cloud.get('idb:labs_log:lab1')![0].value)).toMatchObject({ value: 160 });
  });

  it('удаление анализа локально → удаляется в облаке', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    idbA.put('labs_log', { id: 'lab1', code: 'HGB', value: 150, date: '2026-08-10' });
    await pullKvNow();
    expect(t.cloud.has('idb:labs_log:lab1')).toBe(true);
    idbA.delete('labs_log', 'lab1');
    await pullKvNow();
    expect(t.cloud.has('idb:labs_log:lab1')).toBe(false);
    expect(t.removeCalls).toContain('idb:labs_log:lab1');
  });

  it('удаление в облаке → применяется локально (если запись не менялась)', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    idbA.put('course_log', { id: 'c1', substance: 'test', dose: 250, date: '2026-08-01' });
    await pullKvNow();
    expect(idbA.count('course_log')).toBe(1);
    // ПК удалил запись курса — облако чистое
    t.cloud.delete('idb:course_log:c1');
    const applied = await pullKvNow();
    expect(applied).toBe(1);
    expect(idbA.count('course_log')).toBe(0);
  });

  it('стабильная сигнатура не зависит от порядка полей записи', async () => {
    const t = new FakeTransport();
    const idbA = new FakeIdb();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, idbAdapter: idbA });
    idbA.put('workout_log', { id: 'w1', date: '2026-08-19', exercises: [{ name: 'Жим', sets: 3 }] });
    await pullKvNow();
    // то же содержимое с другим порядком полей — не считается изменением
    idbA.put('workout_log', { exercises: [{ sets: 3, name: 'Жим' }], id: 'w1', date: '2026-08-19' });
    await pullKvNow();
    expect(t.replaceCalls.filter(k => k === 'idb:workout_log:w1')).toHaveLength(1);
  });
});
