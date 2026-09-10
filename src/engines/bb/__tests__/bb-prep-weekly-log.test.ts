/**
 * bb-prep-weekly-log.test.ts — Э4: недельный луп подготовки.
 * Чек-ины (CRUD/upsert), лента недель, сила-тренд e1RM, средний вес 7д.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPrepWeekCheckins, savePrepWeekCheckin, prepWeekRefs, prepStrengthTrend, avgWeight7d,
} from '../bb-prep-weekly-log';
import { buildBBContestPrepPlan } from '../bb-contest-prep.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const mkPlan = () => buildBBContestPrepPlan({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: addDaysIso(todayIso(), 70), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
}, { prepWeeks: 8, taperWeeks: 2 });

describe('Э4: чек-ины недель', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('save/load roundtrip + upsert по неделе', () => {
    expect(loadPrepWeekCheckins('p1')).toEqual([]);
    savePrepWeekCheckin('p1', { week: 1, date: todayIso(), weightAvg: 80 });
    savePrepWeekCheckin('p1', { week: 2, date: todayIso(), weightAvg: 79.5 });
    savePrepWeekCheckin('p1', { week: 1, date: todayIso(), weightAvg: 79.9 });
    const list = loadPrepWeekCheckins('p1');
    expect(list.map(e => e.week)).toEqual([1, 2]);
    expect(list[0].weightAvg).toBe(79.9);
  });

  it('планы изолированы по id', () => {
    savePrepWeekCheckin('p1', { week: 1, date: todayIso() });
    expect(loadPrepWeekCheckins('p2')).toEqual([]);
  });

  it('лента недель: 8 недель с датами от старта, первая = startDate', () => {
    const plan = mkPlan();
    const refs = prepWeekRefs(plan);
    expect(refs).toHaveLength(8);
    expect(refs[0].dateStart).toBe(plan.preparation.startDate);
    expect(refs[7].week).toBe(8);
  });
});

describe('Э4: сила-тренд', () => {
  it('падение e1RM ≥5% — down с упражнением', () => {
    const plan = mkPlan();
    const start = plan.preparation.startDate;
    const mk = (day: number, w: number) => ({
      date: addDaysIso(start, day),
      exercises: [{ exerciseName: 'Жим лёжа', sets: [{ weightKg: w, reps: 5 }] }],
    });
    const sessions = [mk(0, 100), mk(7, 100), mk(14, 99), mk(28, 95), mk(35, 92), mk(42, 90)];
    const out = prepStrengthTrend(sessions as any, plan);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].exercise).toBe('Жим лёжа');
    expect(out[0].status).toBe('down');
    expect(out[0].deltaPct).toBeLessThanOrEqual(-5);
  });

  it('рост силы — не down', () => {
    const plan = mkPlan();
    const start = plan.preparation.startDate;
    const sessions = [0, 7, 14, 28, 35].map((day, i) => ({
      date: addDaysIso(start, day),
      exercises: [{ exerciseName: 'Присед', sets: [{ weightKg: 120 + i * 2, reps: 5 }] }],
    }));
    expect(prepStrengthTrend(sessions as any, plan)).toEqual([]);
  });

  it('вне окна подготовки — пусто', () => {
    const plan = mkPlan();
    const sessions = [{
      date: addDaysIso(plan.showDate, 30),
      exercises: [{ exerciseName: 'Жим', sets: [{ weightKg: 50, reps: 5 }] }],
    }];
    expect(prepStrengthTrend(sessions as any, plan)).toEqual([]);
  });
});

describe('Э4: средний вес 7д', () => {
  it('среднее последних 7 записей до даты', () => {
    const log = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ date: addDaysIso('2026-01-01', i), weight: 80 - i * 0.1 }));
    expect(avgWeight7d(log, '2026-01-10')).toBeCloseTo(79.4, 1);
  });
  it('пустой лог — undefined', () => {
    expect(avgWeight7d([], '2026-01-10')).toBeUndefined();
  });
});
