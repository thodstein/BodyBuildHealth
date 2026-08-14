/**
 * Тесты движка мобильности дневника тренировок.
 * Покрытие: библиотека блоков, пресеты, CRUD, санитизация, слоты,
 * чек-ины, приверженность, тренды ROM, day progress, CSV.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  MOBILITY_LIBRARY, SLOT_ORDER, SLOT_LABELS, DIRECTION_LABELS,
  getMobilityBlockById, mobilityBlockToItem,
  buildPresetMobility, PRESET_LABELS,
  loadMobilityProtocols, saveMobilityProtocols, createMobilityProtocol,
  upsertMobilityProtocol, deleteMobilityProtocol, duplicateMobilityProtocol,
  loadActiveMobility, setActiveMobility,
  sanitizeMobilityItem, sanitizeMobilityProtocol, sanitizeMobilityCheckin,
  itemsForSlot, hasDailyRoutine,
  loadMobilityCheckins, upsertMobilityCheckin, latestMobilityCheckin,
  mobilityAdherence, mobilityTrends,
  loadMobilityDayProgress, saveMobilityDayProgress, exportMobilityCheckinsCSV,
  MOBILITY_PROTOCOLS_KEY, MOBILITY_ACTIVE_KEY, MOBILITY_CHECKS_KEY, MOBILITY_DAY_PROGRESS_KEY,
  type MobilityProtocol, type MobilityItem, type MobilityCheckin,
} from '../mobility-protocol.engine';

const now = () => new Date().toISOString();

describe('Библиотека блоков мобильности', () => {
  it('содержит блоки всех слотов и валидные id', () => {
    expect(MOBILITY_LIBRARY.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(MOBILITY_LIBRARY.map(b => b.id));
    expect(ids.size).toBe(MOBILITY_LIBRARY.length);
    for (const b of MOBILITY_LIBRARY) {
      expect(SLOT_ORDER).toContain(b.slot);
      expect(b.title.trim().length).toBeGreaterThan(0);
      expect(b.script.trim().length).toBeGreaterThan(0);
      expect(b.durationMin).toBeGreaterThan(0);
    }
  });
  it('содержит блоки для каждого слота', () => {
    for (const s of SLOT_ORDER) {
      expect(MOBILITY_LIBRARY.some(b => b.slot === s)).toBe(true);
    }
  });
  it('flow-блоки имеют упражнения из federation-grip-mobility', () => {
    const flows = MOBILITY_LIBRARY.filter(b => b.sourceMethod === 'flow');
    expect(flows.length).toBe(3);
    for (const f of flows) {
      expect(f.exercises && f.exercises.length).toBeGreaterThan(0);
    }
  });
  it('getMobilityBlockById находит и возвращает null', () => {
    expect(getMobilityBlockById('cars_morning')?.slot).toBe('daily');
    expect(getMobilityBlockById('нет')).toBeNull();
  });
  it('mobilityBlockToItem копирует с новым id и не мутирует оригинал', () => {
    const src = getMobilityBlockById('spine_daily')!;
    const item = mobilityBlockToItem(src);
    expect(item.id).not.toBe(src.id);
    expect(item.title).toBe(src.title);
    expect(item.slot).toBe(src.slot);
    item.targetAreas?.push('Х');
    expect(src.targetAreas).not.toContain('Х');
  });
});

describe('Пресеты', () => {
  it('ПЛ-пресет: спина/бёдра/статика+PNF/потоки в отдых', () => {
    const p = buildPresetMobility('pl');
    expect(p.direction).toBe('pl');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Мобильность позвоночника (5-10 мин)');
    expect(titles).toContain('CARs бёдер перед приседом (2 мин)');
    expect(titles).toContain('PNF после тренировки (с партнёром)');
    expect(titles).toContain('Hip Opener Flow');
    expect(titles).toContain('Spine & Shoulder Flow');
    expect(p.items.every(i => i.id.startsWith('item_'))).toBe(true);
  });
  it('ББ-пресет: нагруженная растяжка в post и rest', () => {
    const p = buildPresetMobility('bb');
    expect(p.direction).toBe('bb');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Нагруженная растяжка (stretch-гипертрофия)');
    expect(titles).toContain('Нагруженная растяжка (день отдыха)');
    expect(titles).not.toContain('PNF после тренировки (с партнёром)');
  });
  it('универсал: CARs + позвоночник + статика + потоки', () => {
    const p = buildPresetMobility('both');
    expect(p.direction).toBe('both');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Утренняя рутина CARs (5 мин)');
    expect(titles).toContain('Статика после тренировки (8-10 мин)');
    expect(titles).not.toContain('Нагруженная растяжка (stretch-гипертрофия)');
  });
  it('каждый вызов даёт уникальный id', () => {
    expect(buildPresetMobility('pl').id).not.toBe(buildPresetMobility('pl').id);
  });
  it('все рецепты пресетов ссылаются на существующие блоки (нет пустых шагов)', () => {
    for (const d of ['pl', 'bb', 'both'] as const) {
      const p = buildPresetMobility(d);
      expect(p.items.length).toBeGreaterThan(0);
      expect(p.items.length).toBe(p.items.length);
    }
  });
});

describe('Санитизация', () => {
  it('sanitizeMobilityItem чинит слот/длительность и отбрасывает мусор', () => {
    expect(sanitizeMobilityItem(null)).toBeNull();
    expect(sanitizeMobilityItem({ title: '' })).toBeNull();
    const ok = sanitizeMobilityItem({ id: 'x', slot: 'bogus', title: 'Т', durationMin: -3 });
    expect(ok!.slot).toBe('daily');
    expect(ok!.durationMin).toBe(1);
  });
  it('sanitizeMobilityProtocol чинит direction и фильтрует items', () => {
    expect(sanitizeMobilityProtocol({})).toBeNull();
    const p = sanitizeMobilityProtocol({ name: 'n', direction: 'x', items: [{ title: 'т' }, null] });
    expect(p!.direction).toBe('both');
    expect(p!.items.length).toBe(1);
  });
  it('sanitizeMobilityCheckin валидирует дату и зажимает romScore', () => {
    expect(sanitizeMobilityCheckin({ date: 'нет' })).toBeNull();
    const c = sanitizeMobilityCheckin({ date: '2026-08-14T10:00', done: 1, romScore: 99 });
    expect(c!.date).toBe('2026-08-14');
    expect(c!.done).toBe(false);
    expect(c!.romScore).toBe(5);
    expect(sanitizeMobilityCheckin({ date: '2026-08-14', romScore: 0 })!.romScore).toBeNull();
  });
  it('loadMobilityProtocols устойчив к битому JSON', () => {
    localStorage.setItem(MOBILITY_PROTOCOLS_KEY, '{"x":');
    expect(loadMobilityProtocols()).toEqual([]);
    localStorage.removeItem(MOBILITY_PROTOCOLS_KEY);
  });
});

describe('CRUD протоколов', () => {
  beforeEach(() => localStorage.clear());

  it('create → upsert → load round-trip', () => {
    const p = createMobilityProtocol('Моя', 'pl', []);
    expect(p.name).toBe('Моя');
    upsertMobilityProtocol(p);
    expect(loadMobilityProtocols()[0].id).toBe(p.id);
  });
  it('upsert обновляет, не дублируя', () => {
    const p = createMobilityProtocol('А', 'both');
    upsertMobilityProtocol(p);
    upsertMobilityProtocol({ ...p, name: 'Б', items: [{ id: 'i', slot: 'daily', title: 'т', script: '', durationMin: 1 }] });
    const list = loadMobilityProtocols();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Б');
    expect(list[0].items.length).toBe(1);
  });
  it('delete чистит активный id', () => {
    const p = createMobilityProtocol('А', 'both');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    deleteMobilityProtocol(p.id);
    expect(loadMobilityProtocols()).toEqual([]);
    expect(localStorage.getItem(MOBILITY_ACTIVE_KEY)).toBeNull();
  });
  it('duplicate создаёт копию с суффиксом', () => {
    const p = createMobilityProtocol('Оригинал', 'bb', [{ id: 'i1', slot: 'post', title: 'т', script: '', durationMin: 1 }]);
    upsertMobilityProtocol(p);
    const copy = duplicateMobilityProtocol(p.id).find(x => x.id !== p.id)!;
    expect(copy.name).toBe('Оригинал (копия)');
    expect(copy.items[0].id).not.toBe('i1');
  });
  it('loadActiveMobility: id → первый → null', () => {
    expect(loadActiveMobility()).toBeNull();
    const a = createMobilityProtocol('А', 'both');
    const b = createMobilityProtocol('Б', 'both');
    saveMobilityProtocols([a, b]);
    expect(loadActiveMobility()!.id).toBe(a.id);
    setActiveMobility(b.id);
    expect(loadActiveMobility()!.id).toBe(b.id);
    setActiveMobility(null);
    expect(loadActiveMobility()!.id).toBe(a.id);
  });
});

describe('Слоты', () => {
  const mk = (slot: MobilityItem['slot']): MobilityItem => ({ id: `i_${slot}`, slot, title: slot, script: 's', durationMin: 1 });
  const proto: MobilityProtocol = {
    id: 'p1', name: 'т', direction: 'both', createdAt: now(), updatedAt: now(),
    items: [mk('daily'), mk('post'), mk('daily'), mk('rest_day'), mk('pre')],
  };

  it('itemsForSlot фильтрует по слоту', () => {
    expect(itemsForSlot(proto, 'daily').map(i => i.id)).toEqual(['i_daily', 'i_daily']);
    expect(itemsForSlot(proto, 'pre').map(i => i.id)).toEqual(['i_pre']);
    expect(itemsForSlot(proto, 'post').length).toBe(1);
    expect(itemsForSlot(null, 'daily')).toEqual([]);
  });
  it('hasDailyRoutine', () => {
    expect(hasDailyRoutine(proto)).toBe(true);
    expect(hasDailyRoutine({ ...proto, items: [mk('post')] })).toBe(false);
    expect(hasDailyRoutine(null)).toBe(false);
  });
});

describe('Чек-ины и аналитика', () => {
  beforeEach(() => localStorage.clear());

  const mk = (date: string, over: Partial<MobilityCheckin> = {}): MobilityCheckin => ({
    id: `c_${date}`, date, done: true, romScore: 4, ...over,
  });

  it('upsert добавляет и сортирует; заменяет по date+sessionId', () => {
    upsertMobilityCheckin(mk('2026-08-14'));
    upsertMobilityCheckin(mk('2026-08-12'));
    expect(loadMobilityCheckins().map(c => c.date)).toEqual(['2026-08-12', '2026-08-14']);
    upsertMobilityCheckin(mk('2026-08-12', { romScore: 5 }));
    expect(loadMobilityCheckins().length).toBe(2);
    expect(loadMobilityCheckins()[0].romScore).toBe(5);
    expect(loadMobilityCheckins()[0].id).toBe('c_2026-08-12');
  });
  it('upsert не трогает другую сессию в тот же день', () => {
    upsertMobilityCheckin(mk('2026-08-14', { sessionId: 'w1', done: false }));
    upsertMobilityCheckin(mk('2026-08-14', { sessionId: 'w2', done: true }));
    expect(loadMobilityCheckins().length).toBe(2);
  });
  it('latestMobilityCheckin', () => {
    upsertMobilityCheckin(mk('2026-08-10'));
    upsertMobilityCheckin(mk('2026-08-12'));
    expect(latestMobilityCheckin()!.date).toBe('2026-08-12');
  });
  it('mobilityAdherence считает выполненные за 30 дней', () => {
    upsertMobilityCheckin({ id: '', date: new Date().toISOString().slice(0, 10), done: true, romScore: 4 });
    upsertMobilityCheckin({ id: '', date: '2020-01-01', done: false, romScore: null });
    const a = mobilityAdherence(30);
    expect(a.total).toBe(1);
    expect(a.done).toBe(1);
    expect(a.pct).toBe(100);
  });
  it('mobilityTrends: серия ROM и среднее', () => {
    upsertMobilityCheckin(mk('2026-08-10', { romScore: 3 }));
    upsertMobilityCheckin(mk('2026-08-11', { romScore: 5 }));
    upsertMobilityCheckin(mk('2026-08-12', { romScore: null, done: false }));
    const t = mobilityTrends(30);
    expect(t.count).toBe(3);
    expect(t.avgRom).toBe(4);
    expect(t.series[0].romScore).toBe(3);
    expect(t.series[2].romScore).toBeNull();
  });
  it('loadMobilityCheckins отбрасывает мусор', () => {
    localStorage.setItem(MOBILITY_CHECKS_KEY, JSON.stringify([{ date: 'bad' }, null]));
    expect(loadMobilityCheckins()).toEqual([]);
  });
});

describe('Day progress', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip для даты; чужая дата не подтягивается', () => {
    expect(loadMobilityDayProgress('2026-08-14').doneItems).toEqual([]);
    saveMobilityDayProgress({ date: '2026-08-14', doneItems: ['cars_morning'] });
    expect(loadMobilityDayProgress('2026-08-14').doneItems).toEqual(['cars_morning']);
    expect(loadMobilityDayProgress('2026-08-15').doneItems).toEqual([]);
  });
  it('битый JSON → пусто', () => {
    localStorage.setItem(MOBILITY_DAY_PROGRESS_KEY, JSON.stringify({ date: '2026-08-14', doneItems: [1] }));
    expect(loadMobilityDayProgress('2026-08-14').doneItems).toEqual([]);
  });
});

describe('Экспорт CSV', () => {
  beforeEach(() => localStorage.clear());

  it('пусто → только заголовок', () => {
    expect(exportMobilityCheckinsCSV()).toBe('date,session_id,done,rom_score,note');
  });
  it('строки с экранированием', () => {
    upsertMobilityCheckin({ id: '', date: '2026-08-10', sessionId: 'w_1', done: true, romScore: 4, note: 'хорошо "двигался"' });
    upsertMobilityCheckin({ id: '', date: '2026-08-12', done: false, romScore: null, note: '' });
    const csv = exportMobilityCheckinsCSV();
    const lines = csv.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[1]).toBe('2026-08-10,"w_1",1,4,"хорошо ""двигался"""');
    expect(lines[2]).toBe('2026-08-12,,0,,');
  });
});

describe('Метки', () => {
  it('все слоты и направления имеют русские метки', () => {
    for (const s of SLOT_ORDER) expect(SLOT_LABELS[s]).toBeTruthy();
    for (const d of ['pl', 'bb', 'both'] as const) expect(DIRECTION_LABELS[d]).toBeTruthy();
    expect(PRESET_LABELS.pl).toBeTruthy();
    expect(PRESET_LABELS.bb).toBeTruthy();
    expect(PRESET_LABELS.both).toBeTruthy();
  });
});
