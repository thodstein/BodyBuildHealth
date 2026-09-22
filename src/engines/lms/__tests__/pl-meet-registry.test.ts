/**
 * pl-meet-registry.test.ts — Фаза 2-слияние: один реестр стартов ПЛ.
 *
 * Канон — события года (`he_pl_macro.competitions`), надстройка — ПЛ-список
 * (федерация/заявленные ПМ/стратегия). Тесты: миграция lossless, гармонизация,
 * обратная синхронизация (upsert/удаление/сохранение полей года), идемпотентность.
 */
import { describe, expect, it } from 'vitest';
import {
  dateFromWeeksToStart, weeksToStartFromDate, macroWeekForDateIso,
  mergeMeetRegistry, syncCompetitionsFromMeets,
  type PLMeetLike,
} from '../pl-meet-registry.engine';
import type { CompetitionEvent } from '../macrocycle.engine';

const TODAY = '2026-09-22';
const meet = (over: Partial<PLMeetLike> = {}): PLMeetLike => ({
  id: 'm1', name: 'Кубок', weeksToStart: 8, fed: 'fpr', plannedPm: { 'Присед': 200 }, strategy: 'balanced', ...over,
});

describe('pl-meet-registry: даты ↔ недели', () => {
  it('roundtrip недели↔дата (неделя 1 = сегодня)', () => {
    expect(dateFromWeeksToStart(0, TODAY)).toBe('2026-09-22');
    expect(dateFromWeeksToStart(8, TODAY)).toBe('2026-11-17');
    expect(weeksToStartFromDate('2026-11-17', TODAY)).toBe(8);
    expect(macroWeekForDateIso('2026-09-22', TODAY)).toBe(1);
    expect(macroWeekForDateIso('2026-09-29', TODAY)).toBe(2);
  });
});

describe('pl-meet-registry: слияние', () => {
  it('пусто с обеих сторон → без изменений', () => {
    const res = mergeMeetRegistry({ competitions: [], legacyMeets: [], mainMeetId: '', todayIso: TODAY });
    expect(res.meets).toEqual([]);
    expect(res.changed).toBe(false);
    expect(res.mainMeetId).toBe('');
  });

  it('легаси-старт без события года мигрирует в события (week/date/priority A для главного)', () => {
    const res = mergeMeetRegistry({ competitions: [], legacyMeets: [meet()], mainMeetId: 'm1', todayIso: TODAY });
    expect(res.changed).toBe(true);
    expect(res.competitions).toHaveLength(1);
    const ev = res.competitions[0];
    expect(ev.id).toBe('m1');
    expect(ev.date).toBe('2026-11-17');
    expect(ev.week).toBe(macroWeekForDateIso('2026-11-17', TODAY));
    expect(ev.priority).toBe('A');
    expect(res.notes.join(' ')).toContain('годовой план');
    expect(res.meets[0].fed).toBe('fpr');
    expect(res.meets[0].plannedPm['Присед']).toBe(200);
  });

  it('событие+старт с одним id: надстройка сохраняется, канон (неделя года) главнее', () => {
    const comp: CompetitionEvent = { id: 'm1', name: 'Старое имя', week: 3, priority: 'B', notes: 'выезд', cycleId: 'cycle-01' };
    const res = mergeMeetRegistry({ competitions: [comp], legacyMeets: [meet({ name: 'Кубок области' })], mainMeetId: 'm1', todayIso: TODAY });
    expect(res.changed).toBe(true);
    expect(res.competitions[0].name).toBe('Кубок области');
    // Неделя года канонична: старт переезжает на week 3 (было 8 недель до старта).
    expect(res.competitions[0].week).toBe(3);
    expect(res.competitions[0].date).toBe('2026-10-06');
    expect(res.competitions[0].priority).toBe('A');
    // Поля года, не входящие в старт, целы.
    expect(res.competitions[0].notes).toBe('выезд');
    expect(res.competitions[0].cycleId).toBe('cycle-01');
    expect(res.meets[0].strategy).toBe('balanced');
    expect(res.meets[0].weeksToStart).toBe(2);
  });

  it('совпадение по имени тоже склеивает (id события выигрывает)', () => {
    const comp: CompetitionEvent = { id: 'ev-7', name: 'Кубок', week: 8, date: '2026-11-17', priority: 'B' };
    const res = mergeMeetRegistry({ competitions: [comp], legacyMeets: [meet({ id: 'legacy-1' })], mainMeetId: 'legacy-1', todayIso: TODAY });
    expect(res.meets).toHaveLength(1);
    expect(res.meets[0].id).toBe('ev-7');
    expect(res.mainMeetId).toBe('ev-7');
  });

  it('событие года без старта получает старт с дефолтной надстройкой', () => {
    const comp: CompetitionEvent = { id: 'ev-9', name: 'Первенство', week: 5, priority: 'A' };
    const res = mergeMeetRegistry({ competitions: [comp], legacyMeets: [meet({ id: 'm2', weeksToStart: 20 })], mainMeetId: 'm2', todayIso: TODAY });
    expect(res.meets.map(m => m.id).sort()).toEqual(['ev-9', 'm2']);
    const fromEvent = res.meets.find(m => m.id === 'ev-9')!;
    expect(fromEvent.weeksToStart).toBe(4); // week 5 → 4 недели до старта
    expect(fromEvent.fed).toBe('fpr');
    expect(fromEvent.strategy).toBe('balanced');
  });

  it('идемпотентность: merge → sync → merge не меняет события', () => {
    const first = mergeMeetRegistry({ competitions: [], legacyMeets: [meet(), meet({ id: 'm2', name: 'Второй', weeksToStart: 14 })], mainMeetId: 'm1', todayIso: TODAY });
    const synced = syncCompetitionsFromMeets(first.competitions, first.meets, { mainMeetId: first.mainMeetId, todayIso: TODAY });
    const second = mergeMeetRegistry({ competitions: synced, legacyMeets: first.meets, mainMeetId: first.mainMeetId, todayIso: TODAY });
    expect(second.changed).toBe(false);
    expect(second.competitions).toEqual(synced);
    expect(second.meets).toEqual(first.meets);
  });
});

describe('pl-meet-registry: обратная синхронизация стартов', () => {
  it('upsert: дата/неделя/приоритет из старта, поля года целы; выбывшие удаляются', () => {
    const comps: CompetitionEvent[] = [
      { id: 'm1', name: 'Старое', week: 1, date: '2026-09-22', priority: 'A', notes: 'выезд', cycleId: 'cycle-01' },
      { id: 'gone', name: 'Удалённый', week: 9, priority: 'C', cycleId: 'cycle-02' },
    ];
    const synced = syncCompetitionsFromMeets(comps, [meet({ id: 'm1', name: 'Кубок', weeksToStart: 8 }), meet({ id: 'm2', name: 'Новый', weeksToStart: 12 })], { mainMeetId: 'm1', todayIso: TODAY });
    expect(synced.map(c => c.id).sort()).toEqual(['m1', 'm2']);
    const m1 = synced.find(c => c.id === 'm1')!;
    expect(m1.name).toBe('Кубок');
    expect(m1.date).toBe('2026-11-17');
    expect(m1.priority).toBe('A');
    expect(m1.notes).toBe('выезд');
    expect(m1.cycleId).toBe('cycle-01');
    const m2 = synced.find(c => c.id === 'm2')!;
    expect(m2.priority).toBe('B');
    expect(m2.week).toBe(macroWeekForDateIso('2026-12-15', TODAY));
  });
});
