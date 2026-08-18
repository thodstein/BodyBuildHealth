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
  _resetKvForTests,
  type KvRow,
  type KvTransport,
} from '../cloud-kv';

class FakeTransport implements KvTransport {
  cloud = new Map<string, KvRow[]>();
  replaceCalls: string[] = [];
  removeCalls: string[] = [];
  keepAliveRows: KvRow[] = [];

  async pull(_token: string, onRows: (rows: KvRow[]) => void): Promise<void> {
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

describe('фоновый pull и авто-обновление', () => {
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

  it('фоновый pull применяет новые данные и планирует перезагрузку', async () => {
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
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1300);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('фоновый pull без новых данных не перезагружает', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    const reload = vi.fn();
    t.seed('he_profile_v2', '{"v":1}', 1000);
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, reloadFn: reload });
    const applied = await pullKvNow();
    expect(applied).toBe(0);
    await vi.advanceTimersByTimeAsync(1300);
    expect(reload).not.toHaveBeenCalled();
  });

  it('интервальный pull забирает изменения с другого устройства', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport();
    const reload = vi.fn();
    await initKvSync('tg_123', { transport: t, token: 'tk_test', flushDelayMs: 20, pullIntervalMs: 100, reloadFn: reload });
    t.seed('he_weight_log', '[{"w":82}]', 5000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(localStorage.getItem('he_weight_log')).toBe('[{"w":82}]');
    // один reload на первое применение; повторные тики новых данных не приносят
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
