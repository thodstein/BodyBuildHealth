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
import { canonicalizeArmMuscle } from '../arm-tendon-sets.engine';
import { armTendonBudgetFor } from '../arm-tendon-budget.engine';
import { checkTendonGuard } from '../arm-injury-guard.engine';
import {
  ARM_TECHNIQUE_DRILLS,
  armTechniqueStageForWeek,
  ARM_TECHNIQUE_STAGE_PCT,
} from '../arm-technique-curriculum.engine';
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
  it('endurance: 5-й замер (3×20 с) и недельный блок «долгой схватки»', () => {
    const plan = make({ goal: 'endurance', testWeekEvery: 8 });
    const tests = allEx(plan).filter((e: any) => e.provenanceSource === 'arm-test-week');
    expect(tests.length).toBe(5);
    const blocks = allEx(plan).filter((e: any) => /Долгая схватка/.test(String(e.name)));
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(Number(b.sets)).toBe(3);
      expect(b.workSets.every((ws: any) => Number(ws.holdSeconds) === 20)).toBe(true);
    }
  });
});

describe('единая модель сгибателей локтя (P0-4)', () => {
  it('biceps_short канонизируется в biceps_long и не считается отдельно', () => {
    expect(canonicalizeArmMuscle('biceps_short')).toBe('biceps_long');
    const agg = aggregateArmVolume([
      { sessions: [{ exercises: [{ muscle: 'biceps_short', sets: 3, movementPattern: 'bicep_curl' }] }] } as any,
    ]);
    expect(agg.biceps_long?.directSets).toBe(3);
    expect(agg.biceps_short).toBeUndefined();
  });
  it('в планируемом списке одна запись сгибателей локтя (нет «мышцы без упражнений»)', () => {
    const plan = make();
    const flexors = plan.volumeLandmarks.filter((x: any) => String(x.muscle).startsWith('biceps'));
    expect(flexors.length).toBe(1);
  });
});

describe('технический курикулум (P1-8)', () => {
  const curriculum = (plan: any) => (plan.techniqueCurriculum || []) as any[];
  it('8 дриллов в справочнике; 1 дрилл на рабочую неделю, встроен в разминку', () => {
    expect(ARM_TECHNIQUE_DRILLS.length).toBe(8);
    const plan = make();
    const list = curriculum(plan);
    expect(list.length).toBeGreaterThanOrEqual(6);
    const weeks = list.map((x) => x.week);
    expect(new Set(weeks).size).toBe(weeks.length);
    for (const x of list) {
      expect(x.embeddedIn).toBeTruthy();
      expect(x.label).toBeTruthy();
      expect(x.errors.length).toBeGreaterThan(0);
    }
    // Дрилл виден в комментарии упражнения (не отдельным объёмом).
    const comments = allEx(plan).map((e: any) => String(e.comment || ''));
    expect(comments.some((c: string) => c.includes('🧭 Техника'))).toBe(true);
  });
  it('дриллы не встраиваются в Test и LegsCore', () => {
    const plan = make({ legsAnchor: true, testWeekEvery: 8 });
    for (const s of plan.weeks.flatMap((w: any) => w.sessions)) {
      if (s.sessionTag !== 'Test' && s.sessionTag !== 'LegsCore') continue;
      expect(s.exercises.some((e: any) => String(e.comment || '').includes('🧭 Техника'))).toBe(false);
    }
  });
  it('прогрессия стадий: изометрия → 70 → 90 → 100%', () => {
    for (const w of [1, 3, 5, 7]) expect(armTechniqueStageForWeek(w, 8)).toBe((w - 1) / 2);
    expect(ARM_TECHNIQUE_STAGE_PCT).toEqual({ 0: 0, 1: 0.7, 2: 0.9, 3: 1 });
    const plan = make();
    const week1 = curriculum(plan).find((x) => x.week === 1);
    expect(week1?.stage).toBe(0);
    // Изометрия — текст дрилла, без «0×1» в разминке.
    const zero = allEx(plan)
      .flatMap((e: any) => e.warmupSets || [])
      .filter((ws: any) => Number(ws.load) === 0);
    expect(zero.length).toBe(0);
  });
  it("стоп-условия: травма side/shoulder убирает press и king's move", () => {
    const plan = make({
      injuries: [
        { muscle: 'side_pressure', exclude: true },
        { muscle: 'shoulder_stab', exclude: true },
      ],
    });
    const names = curriculum(plan).map((x) => String(x.name));
    expect(names.some((n) => /Press/.test(n))).toBe(false);
    expect(names.some((n) => /King/.test(n))).toBe(false);
    expect(names.length).toBeGreaterThan(0);
  });
});

describe('tendon-бюджет как модель (P1-10)', () => {
  it('кондиционирование и спортивные сеты считаются раздельно, не-сухожильные не входят', () => {
    const b = armTendonBudgetFor(
      [
        { muscle: 'wrist_flexors', sets: 4, isStatic: true },
        { muscle: 'pronators', sets: 3, holdSeconds: 10 },
        { muscle: 'wrist_flexors', sets: 6 },
        { muscle: 'brachialis', sets: 5 },
      ],
      'intermediate',
    );
    expect(b.conditioningSets).toBe(7);
    expect(b.sportSets).toBe(6);
    expect(b.limit).toBe(16);
    expect(b.overConditioning).toBe(false);
    expect(b.totalSets).toBe(13);
  });
  it('лимит применяется только к кондиционированию; спортивные сеты не капаются', () => {
    const b = armTendonBudgetFor(
      [
        { muscle: 'wrist_flexors', sets: 20, isStatic: true },
        { muscle: 'wrist_flexors', sets: 40 },
      ],
      'beginner',
    );
    expect(b.overConditioning).toBe(true);
    expect(b.limit).toBe(12);
    expect(b.sportSets).toBe(40);
  });
  it('план получает tendonBudget по неделям и честную строку при перерасходе', () => {
    const plan = make();
    expect(plan.tendonBudget).toBeTruthy();
    for (const wk of plan.weeks as any[]) {
      const b = (plan.tendonBudget as any)[wk.week];
      expect(b).toBeTruthy();
      expect(typeof b.conditioningSets).toBe('number');
      expect(typeof b.sportSets).toBe('number');
    }
    // Обычный план не должен получать ложный «tendon CRITICAL» из старой суммы.
    const warnings = checkTendonGuard(plan as any);
    expect(warnings.some((w: string) => /CRITICAL/.test(w))).toBe(false);
  });
  it('замеры тестовой недели не считаются кондиционированием', () => {
    const b = armTendonBudgetFor(
      [
        { muscle: 'wrist_flexors', sets: 3, holdSeconds: 20, provenanceSource: 'arm-test-week' },
        { muscle: 'wrist_flexors', sets: 2, isStatic: true },
      ],
      'intermediate',
    );
    expect(b.conditioningSets).toBe(2);
  });
});

describe('cup-холд в бенчмарках (данные, а не мёртвый ключ)', () => {
  it('cupHoldSec пишет wrist_flexors, а не нечитаемый ключ', () => {
    const wm = workMaxFromBenchmarks({ cupHoldSec: 20 });
    expect(wm.wrist_flexors).toBeGreaterThan(0);
    expect(wm['wrist_flexors_cup_hold']).toBeUndefined();
  });
});
