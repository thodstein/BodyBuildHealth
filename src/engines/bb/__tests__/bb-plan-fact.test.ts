import { describe, it, expect } from 'vitest';
import { buildBBPlanFact, bbPlanFactSummary, bbAdherenceBadge } from '../bb-plan-fact.engine';

const plan = {
  weeks: [
    { week: 1, phase: 'accumulation', sessions: [{ exercises: [
      { muscle: 'chest', sets: [{ weight: 100, reps: 8, rir: 2 }, { weight: 100, reps: 8, rir: 2 }] },
      { muscle: 'back', workSets: [{ weight: 80, reps: 10, rir: 3 }] },
    ] }] },
    { week: 2, phase: 'intensification', sessions: [{ exercises: [
      { muscle: 'chest', sets: [{ weight: 105, reps: 6, rir: 1 }, { weight: 105, reps: 6, rir: 1 }] },
    ] }] },
  ],
};

// planStartWeek 2026-09-01 (нед1: 01-07.09, нед2: 08-14.09)
const sessions = [
  { date: '2026-09-02', exercises: [{ muscleGroup: 'Грудь', sets: [{ weightKg: 100, reps: 8, rir: 2 }, { weightKg: 100, reps: 8, rir: 2 }] }], totalSets: 2, totalVolume: 1600 },
  { date: '2026-09-04', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 8, rir: 2 }] }], totalSets: 1, totalVolume: 800 },
  { date: '2026-09-10', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 6, rir: 1 }] }], totalSets: 1, totalVolume: 600 },
  { date: '2026-08-25', exercises: [{ muscleGroup: 'back', sets: [{ weightKg: 80, reps: 10 }] }], totalSets: 1 }, // вне плана
];

describe('bb-plan-fact', () => {
  it('считает плановые сеты/тоннаж/RIR по неделям', () => {
    const f = buildBBPlanFact(plan, [], '2026-09-01');
    expect(f.weeks).toHaveLength(2);
    // нед1 план: chest 2 + back 1 = 3 сета
    expect(f.weeks[0].planned.sets).toBe(3);
    // нед1 тоннаж: chest 2*(100*8)=1600 + back 80*10=800 = 2400
    expect(f.weeks[0].planned.tonnage).toBe(2400);
    // нед2 план: chest 2 сета, тоннаж 2*(105*6)=1260
    expect(f.weeks[1].planned.sets).toBe(2);
    expect(f.weeks[1].planned.tonnage).toBe(1260);
  });

  it('сопоставляет факт по датам недели (неделя 1 = planStartWeek)', () => {
    const f = buildBBPlanFact(plan, sessions as any, '2026-09-01');
    // нед1 факт: 02.09 (2) + 04.09 (1) = 3 сета, adherence 1.0
    expect(f.weeks[0].actual.sets).toBe(3);
    expect(f.weeks[0].actual.sessions).toBe(2);
    expect(f.weeks[0].actual.adherence).toBeCloseTo(1.0);
    // нед2 факт: 10.09 = 1 сет, adherence 1/2 = 0.5
    expect(f.weeks[1].actual.sets).toBe(1);
    expect(f.weeks[1].actual.adherence).toBeCloseTo(0.5);
  });

  it('сессия 25.08 (вне плана) попадает в unmatched', () => {
    const f = buildBBPlanFact(plan, sessions as any, '2026-09-01');
    expect(f.unmatchedSessions).toHaveLength(1);
    expect(f.unmatchedSessions[0].date).toBe('2026-08-25');
  });

  it('per-muscle покрытие нормализует RU/EN мышцы', () => {
    const f = buildBBPlanFact(plan, sessions as any, '2026-09-01');
    // chest: план 4 (нед1 2 + нед2 2), факт 4 (Грудь 2 + chest 1 + chest нед2 1)
    expect(f.byMuscle.chest.plannedSets).toBe(4);
    expect(f.byMuscle.chest.actualSets).toBe(4);
    // back: план 1, факт 1 (сессия back 25.08 вне плана, но это реальный объём мышцы)
    expect(f.byMuscle.back.plannedSets).toBe(1);
    expect(f.byMuscle.back.actualSets).toBe(1);
  });

  it('overallAdherence = факт/план по сетам', () => {
    const f = buildBBPlanFact(plan, sessions as any, '2026-09-01');
    // план всего 5, факт 4 → 0.8
    expect(f.overallAdherence).toBeCloseTo(4 / 5);
    expect(f.plannedTotalSets).toBe(5);
    expect(f.actualTotalSets).toBe(4);
  });

  it('пустой план/сессии → нулевой результат', () => {
    const f = buildBBPlanFact({ weeks: [] }, [], '2026-09-01');
    expect(f.weeks).toHaveLength(0);
    expect(f.overallAdherence).toBe(0);
    expect(bbPlanFactSummary(f)).toContain('Нет данных');
  });

  it('summary и бейдж adherence', () => {
    const f = buildBBPlanFact(plan, sessions as any, '2026-09-01');
    expect(bbPlanFactSummary(f)).toContain('4/5');
    expect(bbAdherenceBadge(1)).toEqual({ label: '✅ в плане', color: '#00e68a' });
    expect(bbAdherenceBadge(0.7).label).toBe('⚠ частично');
    expect(bbAdherenceBadge(0.1).label).toBe('🔻 низко');
    expect(bbAdherenceBadge(0).label).toBe('· нет данных');
  });
});
