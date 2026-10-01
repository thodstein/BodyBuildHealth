import { describe, it, expect } from 'vitest';
import { armFactFeedback, applyFactProgression, factRateFor, armPlanCompliance, armFactE1RM, armPerMuscleLoadAlerts } from '../arm-plan-feedback.engine';
import type { ArmPlan, ArmDiarySessionFact } from '../arm-types';

function planOneMuscle(weight = 50, reps = 8): ArmPlan {
  return {
    pattern: {} as any,
    weeks: [
      {
        week: 1, phase: 'accumulation',
        sessions: [{
          day: 1, weekOffset: 0, character: 'тяж', sessionTag: 'TableHeavy',
          exercises: [{
            muscle: 'pronators', name: 'Пронация на блоке (90)', role: 'primary', character: 'тяж',
            sets: 1, repsRange: [reps, reps], rir: 2,
            workSets: [{ reps, rir: 2, weight }],
          }],
        }],
      },
    ],
    rotationMuscleVolume: {},
    rationale: [],
  } as ArmPlan;
}

function session(date: string, weight: number, reps = 8, name = 'Пронация на блоке (90)'): ArmDiarySessionFact {
  return { date, exercises: [{ exerciseName: name, sets: [{ weightKg: weight, reps }] }] };
}

describe('arm-plan-feedback: e1RM', () => {
  it('Epley-база', () => {
    expect(armFactE1RM(50, 8)).toBeCloseTo(63.33, 1);
    expect(armFactE1RM(0, 8)).toBe(0);
    expect(armFactE1RM(50, 0)).toBe(50);
  });
});

describe('arm-plan-feedback: факт vs план', () => {
  it('beat: факт выше плана на ≥2% → наращиваем', () => {
    const r = armFactFeedback(planOneMuscle(), [session('2026-09-10', 55)]);
    expect(r.muscles[0].status).toBe('beat');
    expect(r.muscles[0].action).toBe('increase');
    expect(r.beats).toContain('pronators');
  });
  it('on_track: факт в коридоре −5…+2% → держим', () => {
    const r = armFactFeedback(planOneMuscle(), [session('2026-09-10', 50)]);
    expect(r.muscles[0].status).toBe('on_track');
    expect(r.muscles[0].action).toBe('hold');
  });
  it('stalled: факт ниже плана на ≥5% → −2% и проверка', () => {
    const r = armFactFeedback(planOneMuscle(), [session('2026-09-10', 44)]);
    expect(r.muscles[0].status).toBe('stalled');
    expect(r.muscles[0].action).toBe('back_off');
    expect(r.stalled).toContain('pronators');
    expect(r.summary).toContain('stalled 1');
  });
  it('нет факта по мышце → no_data (без выдумок)', () => {
    const r = armFactFeedback(planOneMuscle(), [session('2026-09-10', 60, 8, 'Другое упражнение')]);
    const f = r.muscles.find((x) => x.muscle === 'pronators')!;
    expect(f.status).toBe('no_data');
    expect(f.action).toBe('none');
  });
  it('окно 28 дней: старая запись не учитывается', () => {
    const r = armFactFeedback(planOneMuscle(), [session('2026-07-01', 99), session('2026-09-10', 50)]);
    expect(r.muscles[0].status).toBe('on_track');
  });
  it('пустой дневник/план — честный дефолт', () => {
    expect(armFactFeedback(null, []).muscles).toEqual([]);
    expect(armFactFeedback(planOneMuscle(), []).muscles).toEqual([]);
  });
});

describe('arm-plan-feedback: per-muscle ставка следующей мезы', () => {
  const facts = [
    { muscle: 'pronators', status: 'beat' as const, action: 'increase' as const, plannedTopKg: 0, plannedE1rmKg: 0, factTopKg: 0, factE1rmKg: 0, deltaPct: 5, note: '' },
    { muscle: 'wrist_flexors', status: 'stalled' as const, action: 'back_off' as const, plannedTopKg: 0, plannedE1rmKg: 0, factTopKg: 0, factE1rmKg: 0, deltaPct: -10, note: '' },
  ];
  it('factRateFor: beat → ставка, on_track → 1.0, stalled → 0.98, нет → ставка', () => {
    expect(factRateFor('pronators', facts, 1.025)).toBe(1.025);
    expect(factRateFor('supinators', facts, 1.025)).toBe(1.025); // нет в факте → плановая ставка
    expect(factRateFor('wrist_flexors', facts, 1.025)).toBe(0.98);
    expect(factRateFor('x', [...facts, { ...facts[0], muscle: 'x', status: 'on_track', action: 'hold' }], 1.025)).toBe(1);
  });
  it('applyFactProgression: веса по per-muscle фактору + ноты', () => {
    const out = applyFactProgression({ pronators: 50, wrist_flexors: 40, supinators: 30 }, facts, 1.025);
    expect(out.factors.pronators).toBe(1.025);
    expect(out.workMax.pronators).toBe(51); // 51.25 (float) → шаг 0.5 вниз
    expect(out.workMax.wrist_flexors).toBe(39); // 39.2 → 39.0
    expect(out.workMax.supinators).toBe(30.5); // 30.75 (float) → 30.5
    expect(out.notes.join(' ')).toContain('Плато по факту');
    expect(out.notes.join(' ')).toContain('Факт превысил план');
  });
});

describe('arm-plan-feedback: per-muscle нагрузка (P1-7)', () => {
  const day = (offset: number, sets: number) => ({
    date: new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10),
    exercises: [{ exerciseName: 'Пронация', muscle: 'pronators', sets: Array.from({ length: sets }, () => ({ weightKg: 30, reps: 8 })) }],
  });
  it('ratio ≥1.5 → мышца в алертах; спокойная база — нет', () => {
    const hot = armPerMuscleLoadAlerts([day(0, 12), day(8, 3), day(15, 3), day(22, 3)]);
    expect(hot.map((a) => a.muscle)).toContain('pronators');
    expect(hot[0].ratio).toBeGreaterThanOrEqual(1.5);
    const calm = armPerMuscleLoadAlerts([day(0, 3), day(8, 3), day(15, 3), day(22, 3)]);
    expect(calm).toEqual([]);
  });
  it('мало данных (<3 сетов/нед в среднем) — без алертов', () => {
    expect(armPerMuscleLoadAlerts([day(0, 2), day(15, 1)])).toEqual([]);
  });
});

describe('arm-plan-feedback: выполнение плана', () => {
  const plan: ArmPlan = {
    pattern: {} as any,
    weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ exercises: [{ name: 'Пронация на блоке (90)', muscle: 'pronators', sets: 3 }] }] } as any,
      { week: 2, phase: 'intensification', sessions: [{ exercises: [{ name: 'Пронация на блоке (90)', muscle: 'pronators', sets: 4 }] }] } as any,
    ],
    rotationMuscleVolume: {}, rationale: [],
  } as ArmPlan;
  it('недели: done / upcoming / missed считаются по датам', () => {
    const sessions: ArmDiarySessionFact[] = [
      { date: '2026-09-02', exercises: [{ exerciseName: 'Пронация на блоке (90)', sets: [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }] }] },
    ];
    const c = armPlanCompliance(plan, sessions, '2026-09-01', '2026-09-10')!;
    expect(c.weeks[0].status).toBe('done');
    expect(c.weeks[0].pct).toBe(100);
    expect(c.weeks[1].status).toBe('upcoming'); // неделя ещё не кончилась
    expect(c.overallPct).toBe(100);
  });
  it('warmup-сеты не считаются выполнением; чужие упражнения игнорируются', () => {
    const sessions: ArmDiarySessionFact[] = [
      { date: '2026-09-02', exercises: [
        { exerciseName: 'Пронация на блоке (90)', sets: [{ weightKg: 20, reps: 10, isWarmup: true }] },
        { exerciseName: 'Чужое упражнение', sets: [{ weightKg: 50, reps: 8 }] },
      ] },
    ];
    const c = armPlanCompliance(plan, sessions, '2026-09-01', '2026-09-10')!;
    expect(c.weeks[0].factSets).toBe(0);
    expect(c.weeks[0].status).toBe('missed');
  });
  it('нет недели-1 или пустой план → null', () => {
    expect(armPlanCompliance(null, [], '2026-09-01')).toBeNull();
    expect(armPlanCompliance(plan, [], 'nope')).toBeNull();
  });
});
