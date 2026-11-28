/**
 * arm-planner-features-2026-11.test.ts — новые функции аудита ноябрь 2026:
 * калибровка workMax, исполняемый hook-кап, частота ≥2, покрытие biceps,
 * абсолютный шаг веса, тестовая неделя, cup-холд в бенчмарках.
 */
import { describe, expect, it } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { calibrateArmWorkMax, armCalibrationProtocol } from '../arm-calibration.engine';
import { injectArmTestWeek, planArmTestWeeks, buildArmTestExercises } from '../arm-test-week.engine';
import { hookVolumeOf } from '../arm-pro5-safety.engine';
import { workMaxFromBenchmarks } from '../arm-load-quant.engine';
import { aggregateArmVolume } from '../arm-volume.engine';
import { TAG_MUSCLES_ARM } from '../arm-day-types';

const BASE = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'toproll',
  weeks: 8,
} as const;

const make = (input: Record<string, unknown> = {}, level = 'intermediate') =>
  finalizeArmPlan(buildArmPlan({ ...BASE, ...input } as any), { level });

const allEx = (plan: any) => plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises));

function weightOf(plan: any, week: number, muscle: string): number {
  const wk = plan.weeks.find((w: any) => w.week === week);
  const ex = wk?.sessions.flatMap((s: any) => s.exercises).find((e: any) => e.muscle === muscle);
  return ex ? Number(ex.workSets?.[0]?.weight) || 0 : 0;
}

describe('калибровка workMax (P0-1)', () => {
  it('5–8 повторов @RIR 2 → e1RM, confidence measured', () => {
    const r = calibrateArmWorkMax([{ exercise: 'wrist_curl', weightKg: 40, reps: 6, rir: 2 }]);
    // 40 × (1 + 8/30) = 50.67 → 50.5
    expect(r.workMaxPatch.wrist_flexors).toBe(50.5);
    expect(r.confidence).toBe('measured');
    expect(r.notes.some((n) => n.includes('e1RM'))).toBe(true);
  });
  it('cup-холд не понижает прямой максимум кисти (max, а не перезапись)', () => {
    const r = calibrateArmWorkMax([
      { exercise: 'wrist_curl', weightKg: 40, reps: 6, rir: 2 },
      { exercise: 'cup_hold', weightKg: 20, holdSec: 15 },
    ]);
    expect(r.workMaxPatch.wrist_flexors).toBe(50.5);
  });
  it('CoC-уровень клампится 0…4: «20» не даёт 500 кг', () => {
    const r = calibrateArmWorkMax([{ exercise: 'coc', cocLevel: 20 }]);
    expect(r.workMaxPatch.grip_crush).toBeUndefined();
    expect(r.confidence).toBe('insufficient');
    const ok = calibrateArmWorkMax([{ exercise: 'coc', cocLevel: 4 }]);
    expect(ok.workMaxPatch.grip_crush).toBe(100);
  });
  it('сингл с RIR>0 — не максимум (estimated)', () => {
    const r = calibrateArmWorkMax([{ exercise: 'rolling_thunder', weightKg: 80, reps: 1, rir: 2 }]);
    expect(r.workMaxPatch.grip_support).toBe(80);
    expect(r.confidence).toBe('estimated');
  });
  it('холд пронации → максимум по времени', () => {
    const r = calibrateArmWorkMax([{ exercise: 'pronation_hold', weightKg: 20, holdSec: 12 }]);
    expect(r.workMaxPatch.pronators).toBe(20.5);
    expect(r.confidence).toBe('measured');
  });
  it('сингл RT — это уже максимум, а не e1RM', () => {
    const r = calibrateArmWorkMax([{ exercise: 'rolling_thunder', weightKg: 80, reps: 1 }]);
    expect(r.workMaxPatch.grip_support).toBe(80);
    expect(r.confidence).toBe('measured');
  });
  it('пустой ввод — insufficient, без выдуманных чисел', () => {
    const r = calibrateArmWorkMax([]);
    expect(r.workMaxPatch).toEqual({});
    expect(r.confidence).toBe('insufficient');
    expect(armCalibrationProtocol().length).toBeGreaterThan(3);
  });
  it('план использует калибровку, если пользователь не задал workMax', () => {
    const plan = make({ calibration: [{ exercise: 'wrist_curl', weightKg: 40, reps: 6, rir: 2 }] });
    expect(weightOf(plan, 1, 'wrist_flexors')).toBeGreaterThan(0);
    expect(plan.rationale.some((l: string) => /Калибровка/.test(l))).toBe(true);
  });
  it('явный workMax приоритетнее калибровки', () => {
    const plan = make({
      workMax: { wrist_flexors: 100 },
      calibration: [{ exercise: 'wrist_curl', weightKg: 40, reps: 6, rir: 2 }],
    });
    // 0.82 × 100 = 82, а не 0.82 × 50.5
    expect(weightOf(plan, 1, 'wrist_flexors')).toBeGreaterThan(70);
  });
  it('calibrationPending: неделя 1 получает тестовый блок', () => {
    const plan = make({ calibrationPending: true });
    const w1 = plan.weeks[0];
    const tests = w1.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.provenanceSource === 'arm-test-week');
    expect(tests.length).toBeGreaterThan(0);
    expect(String(w1.note || '')).toContain('Тест');
  });
  it('калибровочный тест кисти остаётся 5ПМ после финализации (tendon-пасс не переписывает)', () => {
    const plan = make({ calibrationPending: true });
    const test = plan.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .find((e: any) => e.provenanceSource === 'arm-test-week' && e.muscle === 'wrist_flexors');
    expect(test).toBeTruthy();
    expect(test.repsRange).toEqual([5, 5]);
    expect(test.workSets.every((ws: any) => Number(ws.reps) === 5)).toBe(true);
  });
});

describe('hook-кап исполняется (P0-2)', () => {
  it('hook-план держит объём ≤ капа 12 в рабочих неделях', () => {
    const plan = make({ technique: 'hook', hookCapSets: 12 });
    const bad = plan.weeks.filter((w: any) => !w.deload && !w.taper && w.phase !== 'peaking' && hookVolumeOf(w) > 12);
    expect(bad.map((w: any) => `Н${w.week}:${hookVolumeOf(w)}`)).toEqual([]);
  });
  it('срез не оставляет пустых упражнений (sets===workSets)', () => {
    const plan = make({ technique: 'hook' });
    for (const ex of allEx(plan)) expect(ex.sets).toBe(ex.workSets.length);
  });
});

describe('частота и покрытие (P0-3/P0-4)', () => {
  it('biceps_long тренируется в 4-дневном сплите', () => {
    const plan = make();
    expect(allEx(plan).some((e: any) => e.muscle === 'biceps_long')).toBe(true);
  });
  it('Support-тег содержит biceps_long', () => {
    expect(TAG_MUSCLES_ARM.Support).toContain('biceps_long');
  });
  it('отстающая мышца (brachialis) попадает минимум в 2 сессии недели', () => {
    const plan = make();
    const wk = plan.weeks.find((w: any) => !w.deload && !w.taper && w.phase === 'accumulation') || plan.weeks[0];
    const sessions = wk.sessions.filter((s: any) => s.exercises.some((e: any) => e.muscle === 'brachialis'));
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });
  it('ризеры/супинаторы получают 2×/нед (frequency-split)', () => {
    const plan = make();
    const weeksWith = (m: string) =>
      plan.weeks.filter(
        (w: any) =>
          !w.deload &&
          !w.taper &&
          w.phase !== 'peaking' &&
          w.sessions.filter((s: any) => s.exercises.some((e: any) => e.muscle === m)).length >= 2,
      ).length;
    expect(weeksWith('risers')).toBeGreaterThanOrEqual(3);
    expect(weeksWith('supinators')).toBeGreaterThanOrEqual(3);
  });
});

describe('indirect-aware цели (P1-5)', () => {
  it('эффективный объём (прямой + косвенный) не превышает MRV в рабочих неделях', () => {
    const plan = make();
    for (const wk of plan.weeks) {
      if (wk.deload || wk.taper || wk.phase === 'peaking') continue;
      const agg = aggregateArmVolume([wk as any]);
      for (const [m, v] of Object.entries(agg)) {
        const mrv = Number(plan.mrvByMuscle?.[m] ?? 99);
        if (!Number.isFinite(mrv)) continue;
        expect(v.effectiveSets, `Н${(wk as any).week} ${m}`).toBeLessThanOrEqual(mrv + 0.01);
      }
    }
  });
  it('тестовая неделя не выводит эффективный объём за MRV (rebalance учитывает тест)', () => {
    const plan = make({ testWeekEvery: 8 });
    for (const wk of plan.weeks) {
      if (wk.deload || wk.taper || wk.phase === 'peaking') continue;
      const agg = aggregateArmVolume([wk as any]);
      for (const [m, v] of Object.entries(agg)) {
        const mrv = Number(plan.mrvByMuscle?.[m] ?? 99);
        if (!Number.isFinite(mrv)) continue;
        expect(v.effectiveSets, `Н${(wk as any).week} ${m}`).toBeLessThanOrEqual(mrv + 0.01);
      }
    }
  });
  it('balance-пассы не режут ниже 1 сета и держат sets===workSets', () => {
    for (const plan of [make(), make({ testWeekEvery: 8 }), make({ legsAnchor: true })]) {
      for (const ex of allEx(plan)) {
        expect(ex.sets, `${ex.exerciseId}`).toBeGreaterThanOrEqual(1);
        expect(ex.sets).toBe(ex.workSets.length);
      }
    }
  });
  it('калибровочная Test-сессия не получает обычных упражнений от баланс-пассов', () => {
    const plan = make({ calibrationPending: true });
    const testSessions = plan.weeks.flatMap((w: any) => w.sessions).filter((s: any) => s.sessionTag === 'Test');
    expect(testSessions.length).toBeGreaterThan(0);
    for (const s of testSessions) {
      for (const e of s.exercises) {
        expect(e.provenanceSource, `чужое упражнение в Test: ${e.exerciseId}`).toBe('arm-test-week');
      }
    }
  });
  it('LegsCore не теряет объём при включении тестовой недели', () => {
    const volumes = (plan: any) =>
      plan.weeks.map((w: any) =>
        w.sessions
          .filter((s: any) => s.sessionTag === 'LegsCore')
          .reduce(
            (a: number, s: any) => a + s.exercises.reduce((x: number, e: any) => x + (Number(e.sets) || 0), 0),
            0,
          ),
      );
    expect(volumes(make({ legsAnchor: true, testWeekEvery: 8 }))).toEqual(volumes(make({ legsAnchor: true })));
  });
});

describe('абсолютный шаг веса для лёгких нагрузок (P1-6)', () => {
  it('при максимуме 10 кг вес растёт ≥0.5 кг/нед и не выше максимума', () => {
    const plan = make({ workMax: { wrist_flexors: 10 } });
    const w1 = weightOf(plan, 1, 'wrist_flexors');
    const w2 = weightOf(plan, 2, 'wrist_flexors');
    expect(w1).toBeGreaterThan(0);
    expect(w2).toBeGreaterThanOrEqual(w1 + 0.5);
    expect(w2).toBeLessThanOrEqual(10);
  });
});

describe('тестовая неделя (P1-7)', () => {
  it('номера недель: каждые 8', () => {
    expect(planArmTestWeeks(16, 8)).toEqual([8, 16]);
    expect(planArmTestWeeks(8, 0)).toEqual([]);
  });
  it('блок тестов содержит 4 замера с малым объёмом', () => {
    const ex = buildArmTestExercises('intermediate');
    expect(ex.length).toBe(4);
    for (const e of ex) expect(e.sets).toBeLessThanOrEqual(2);
  });
  it('инъекция в 8-недельный план: все 4 замера в рабочей неделе, sets===workSets', () => {
    const plan = make({ testWeekEvery: 8 });
    const tests = allEx(plan).filter((e: any) => e.provenanceSource === 'arm-test-week');
    expect(tests.length).toBe(4);
    // Тест не ставится в делод/тейпер/пик — проверяем пометку недели.
    expect(plan.weeks.some((w: any) => String(w.note || '').includes('Тест'))).toBe(true);
    for (const ex of allEx(plan)) expect(ex.sets).toBe(ex.workSets.length);
  });
  it('тестовая неделя не уходит в LegsCore и не трогает его', () => {
    const plan = make({ testWeekEvery: 8, legsAnchor: true });
    const legs = plan.weeks.flatMap((w: any) => w.sessions).filter((s: any) => s.sessionTag === 'LegsCore');
    expect(legs.length).toBeGreaterThan(0);
    for (const s of legs) {
      expect(s.exercises.some((e: any) => e.provenanceSource === 'arm-test-week')).toBe(false);
    }
    const testSessions = plan.weeks.flatMap((w: any) => w.sessions).filter((s: any) => s.sessionTag === 'Test');
    expect(testSessions.length).toBeGreaterThan(0);
  });
  it('без testWeekEvery тестов нет', () => {
    const plan = make();
    expect(allEx(plan).some((e: any) => e.provenanceSource === 'arm-test-week')).toBe(false);
  });
  it('повторная инъекция идемпотентна', () => {
    const plan = make({ testWeekEvery: 8 });
    const before = allEx(plan).filter((e: any) => e.provenanceSource === 'arm-test-week').length;
    const again = injectArmTestWeek(plan, { every: 8, level: 'intermediate' });
    const after = allEx(again.plan).filter((e: any) => e.provenanceSource === 'arm-test-week').length;
    expect(after).toBe(before);
  });
  it.each(['armwrestling', 'armlifting', 'hybrid'] as const)(
    '%s: 4 замера во всех техниках и effective-MRV соблюдён',
    (discipline) => {
      for (const technique of ['toproll', 'hook', 'press'] as const) {
        const plan = finalizeArmPlan(buildArmPlan({ ...BASE, discipline, technique, testWeekEvery: 8 } as any), {
          level: 'intermediate',
        });
        const tests = allEx(plan).filter((e: any) => e.provenanceSource === 'arm-test-week');
        expect(tests.length, `${discipline}/${technique}`).toBe(4);
        for (const wk of plan.weeks as any[]) {
          if (wk.deload || wk.taper || wk.phase === 'peaking') continue;
          const agg = aggregateArmVolume([wk]);
          for (const [m, v] of Object.entries(agg)) {
            const mrv = Number(plan.mrvByMuscle?.[m] ?? 99);
            if (!Number.isFinite(mrv)) continue;
            expect(v.effectiveSets, `${discipline}/${technique} Н${wk.week} ${m}`).toBeLessThanOrEqual(mrv + 0.01);
          }
        }
      }
    },
  );
  it('Test-сессия получает свободный день недели (не дублирует день рабочей)', () => {
    const plan = make({ testWeekEvery: 8 });
    for (const wk of plan.weeks as any[]) {
      const days = wk.sessions.map((s: any) => Number(s.day));
      expect(new Set(days).size, `Н${wk.week}`).toBe(days.length);
    }
  });
});

describe('cup-холд в бенчмарках (данные, а не мёртвый ключ)', () => {
  it('cupHoldSec пишет wrist_flexors, а не нечитаемый ключ', () => {
    const wm = workMaxFromBenchmarks({ cupHoldSec: 20 });
    expect(wm.wrist_flexors).toBeGreaterThan(0);
    expect(wm['wrist_flexors_cup_hold']).toBeUndefined();
  });
});
