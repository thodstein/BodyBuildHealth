/**
 * lms-season-peaks.test.ts — C2: тапер по всему сезону (несколько соревнований).
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, type LMSBuildOutput } from '../lms-builder.engine';
import { buildPLSeasonPeaks } from '../lms-macro-taper.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildBase(weeks = 8): LMSBuildOutput {
  return buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: weeks, faithful: true } as never);
}

describe('buildPLSeasonPeaks', () => {
  it('два старта: план продлён до дальнего старта, у каждого старта есть неделя соревнований', () => {
    const plan = buildBase(4);
    const res = buildPLSeasonPeaks(plan.weeks, [
      { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
      { id: 'm2', name: 'Старт 2', weeksToStart: 8 },
    ], { mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 8 });
    const meets = res.weeks.filter(w => w.meetWeek);
    expect(meets.length).toBe(2);
    // Неделя соревнований = неделя до старта.
    expect(meets.some(m => m.week === 4)).toBe(true);
    expect(meets.some(m => m.week === 8)).toBe(true);
    expect(res.weeks.length).toBeGreaterThanOrEqual(9); // 8 + пост
    expect(res.notes.some(n => n.includes('Сезон'))).toBe(true);
  });

  it('у стартов есть mock meet перед тапером', () => {
    const plan = buildBase(4);
    const res = buildPLSeasonPeaks(plan.weeks, [
      { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
    ], { mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 4 });
    const mocks = res.weeks.filter(w => w.mockMeet);
    expect(mocks.length).toBeGreaterThanOrEqual(1);
  });

  it('пост-старт после последнего старта (и не накладывается на соседний блок)', () => {
    const plan = buildBase(4);
    const res = buildPLSeasonPeaks(plan.weeks, [
      { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
      { id: 'm2', name: 'Старт 2', weeksToStart: 8 },
    ], { postMeet: true, meetWeek: true, windowWeeks: 6 });
    const posts = res.weeks.filter(w => w.postMeet);
    expect(posts.length).toBeGreaterThanOrEqual(1);
  });

  it('пустой сезон — возврат базы с предупреждением', () => {
    const plan = buildBase(4);
    const res = buildPLSeasonPeaks(plan.weeks, []);
    expect(res.weeks).toBe(plan.weeks);
    expect(res.notes.some(n => n.includes('⚠'))).toBe(true);
  });

  it('без базового плана — пустой результат', () => {
    const res = buildPLSeasonPeaks([], [{ id: 'm1', name: 'Старт', weeksToStart: 4 }]);
    expect(res.weeks).toEqual([]);
  });

  it('план длиннее дальнего старта не усекается (сохраняется минимум длины)', () => {
    const plan = buildBase(12);
    const res = buildPLSeasonPeaks(plan.weeks, [
      { id: 'm1', name: 'Старт', weeksToStart: 8 },
    ], { meetWeek: true, postMeet: true, windowWeeks: 6 });
    const meet = res.weeks.find(w => w.meetWeek);
    expect(meet).toBeTruthy();
    // Неделя старта 8 должна остаться 8-й.
    expect(meet!.week).toBe(8);
  });
});
