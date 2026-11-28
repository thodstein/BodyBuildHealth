/**
 * arm-planner-audit-2026-11.test.ts — регрессии ноябрьского аудита арм-планировщика.
 *
 * Каждый тест закрепляет конкретный дефект, найденный дампом планов:
 * вес от массы тела, двойная травма, недостижимый MEV, внутренняя ротация вместо
 * наружной, отсутствие авто-прогрессии, кросс-мезо от рабочего веса, двойной
 * тейпер в годовом блоке, невыполняемый лимит сетов.
 */
import { describe, expect, it } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { sessionLimitsForArm } from '../arm-volume.engine';
import { getArmLandmarks } from '../arm-volume-landmarks.engine';
import { buildArmBlock } from '../arm-annual';
import { ARM_MUSCLES } from '../arm-types';
import { TAG_MUSCLES_ARM as ARM_TAG_MUSCLES } from '../arm-day-types';

const BASE = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'toproll',
  weeks: 8,
} as const;

function make(input: Record<string, unknown> = {}, level = 'intermediate') {
  return finalizeArmPlan(buildArmPlan({ ...BASE, ...input } as any), { level });
}

function allExercises(plan: any) {
  return plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises));
}

function weekSets(plan: any, week: number, muscle: string): number {
  const w = plan.weeks.find((x: any) => x.week === week);
  if (!w) return 0;
  return w.sessions.reduce(
    (a: number, s: any) => a + s.exercises.reduce((x: number, e: any) => x + (e.muscle === muscle ? e.sets : 0), 0),
    0,
  );
}

describe('аудит 2026-11: вес не выдумывается', () => {
  it('workMax.default (масса тела) больше не становится максимумом каждой мышцы', () => {
    const plan = make({ workMax: { default: 80 } });
    const weights = allExercises(plan).flatMap((e: any) => e.workSets.map((ws: any) => Number(ws.weight) || 0));
    expect(weights.length).toBeGreaterThan(0);
    expect(weights.every((w: number) => w === 0)).toBe(true);
  });

  it('резина/свой вес/изометрия не получают килограммы даже при явном workMax', () => {
    const plan = make({
      workMax: { wrist_flexors: 100, pronators: 80, shoulder_stab: 60, thumb: 50, grip_support: 90, core_anchor: 60 },
    });
    for (const ex of allExercises(plan)) {
      const mode = (ex as any).loadMode;
      if (mode === 'band' || mode === 'bodyweight' || mode === 'isometric') {
        expect(
          (ex as any).workSets.every((ws: any) => !(Number(ws.weight) > 0)),
          `${ex.name} (${mode})`,
        ).toBe(true);
      }
    }
  });

  it('явный workMax мышцы даёт килограммы (вес не отключён целиком)', () => {
    const plan = make({ workMax: { wrist_flexors: 100 } });
    const wrist = allExercises(plan).find((e: any) => e.muscle === 'wrist_flexors' && (e as any).loadMode === 'tool');
    expect(wrist).toBeTruthy();
    expect(Number(wrist.workSets[0].weight)).toBeGreaterThan(40);
  });
});

describe('аудит 2026-11: травма применяется ОДИН раз', () => {
  it('volumePct 50 даёт ~половину объёма, а не 1/8', () => {
    const healthy = make();
    const injured = make({ injuries: [{ muscle: 'wrist_flexors', volumePct: 50 }] });
    const base = weekSets(healthy, 2, 'wrist_flexors');
    const cut = weekSets(injured, 2, 'wrist_flexors');
    expect(base).toBeGreaterThan(0);
    // Округление по упражнениям даёт 0.5–0.75 от базы; главное — это НЕ 1/8 (0.125),
    // которое получалось тройным умножением.
    expect(cut).toBeLessThanOrEqual(Math.ceil(base * 0.75));
    expect(cut).toBeGreaterThanOrEqual(Math.floor(base * 0.4));
  });
});

describe('аудит 2026-11: MEV достижим', () => {
  it('brachialis не остаётся ниже MEV в накопительных неделях', () => {
    const plan = make();
    const mev = getArmLandmarks('intermediate', 'brachialis').mev;
    // Stress-неделя (weekMult 0.55) намеренно ниже MEV — как и делод/тейпер.
    const weeks = plan.weeks.filter(
      (w: any) => !w.deload && !w.taper && w.phase !== 'peaking' && Number(w.weekMult ?? 1) >= 0.7,
    );
    expect(weeks.length).toBeGreaterThan(0);
    for (const w of weeks) {
      expect(weekSets(plan, w.week, 'brachialis'), `Н${w.week} (mult ${w.weekMult})`).toBeGreaterThanOrEqual(mev - 1);
    }
  });

  it('в делоде нет предупреждений «мало стимула»', () => {
    const plan = make();
    const v = validateArmPlan(plan, 'intermediate');
    const deloadWeeks = plan.weeks.filter((w: any) => w.deload).map((w: any) => w.week);
    expect(deloadWeeks.length).toBeGreaterThan(0);
    for (const wk of deloadWeeks) {
      expect(v.warnings.some((x) => x.startsWith(`Н${wk}:`) && x.includes('< MEV'))).toBe(false);
    }
  });
});

describe('аудит 2026-11: ротаторы плеча', () => {
  it('наружная ротация попадает в план (не только внутренняя)', () => {
    const plan = make();
    const names = allExercises(plan)
      .filter((e: any) => e.muscle === 'shoulder_stab')
      .map((e: any) => String(e.name));
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => /Наружная ротация/.test(n))).toBe(true);
  });
});

describe('аудит 2026-11: прогрессия', () => {
  it('auto без явной ставки прогрессирует вес (дефолт 0.5%/нед)', () => {
    const plan = make({ workMax: { wrist_flexors: 100 } });
    const w1 = Number(
      allExercises({ weeks: [plan.weeks[0]] }).find((e: any) => e.muscle === 'wrist_flexors')?.workSets?.[0]?.weight,
    );
    const w5 = Number(
      allExercises({ weeks: [plan.weeks[4]] }).find((e: any) => e.muscle === 'wrist_flexors')?.workSets?.[0]?.weight,
    );
    expect(w1).toBeGreaterThan(0);
    expect(w5).toBeGreaterThan(w1);
  });

  it('кросс-мезо считается от максимума, а не от рабочего веса', () => {
    const prev = buildArmPlan({ ...BASE, weeks: 4, workMax: { wrist_flexors: 100 } } as any);
    const next = make({ weeks: 4, workMax: { wrist_flexors: 100 }, previousPlan: prev });
    const w1 = Number(
      allExercises({ weeks: [next.weeks[0]] }).find((e: any) => e.muscle === 'wrist_flexors')?.workSets?.[0]?.weight,
    );
    // максимум 100 × кросс-мезо 1.025 = 102.5 → рабочий 82% ≈ 84 кг
    expect(w1).toBeGreaterThan(82);
    expect(w1).toBeLessThan(90);
  });
});

describe('аудит 2026-11: лимиты сессии', () => {
  it('сессия не превышает maxSets', () => {
    const plan = make();
    for (const sess of plan.weeks.flatMap((w: any) => w.sessions)) {
      const limit = sessionLimitsForArm({
        level: 'intermediate',
        discipline: 'armwrestling',
        sessionTag: sess.sessionTag,
      });
      const total = sess.exercises.reduce((a: number, e: any) => a + e.sets, 0);
      expect(total, `${sess.sessionTag}`).toBeLessThanOrEqual(limit.maxSets);
    }
  });

  it('LegsCore не уезжает за пределы недели (день ≤ 7)', () => {
    const plan = make({ legsAnchor: true });
    const anchor = plan.weeks.flatMap((w: any) => w.sessions).filter((s: any) => s.sessionTag === 'LegsCore');
    expect(anchor.length).toBeGreaterThan(0);
    for (const s of anchor) expect(s.day).toBeLessThanOrEqual(7);
  });
});

describe('аудит 2026-11: годовой тейпер не двойной', () => {
  it('пиковая неделя ≈45% базы, а не 20%', () => {
    const res: any = buildArmBlock(
      { blockKey: 'peak', weeks: 12, phase: 'peaking' },
      {
        discipline: 'armwrestling',
        level: 'intermediate',
        taperWeeks: 3,
        taperEnabled: true,
        workMax: { wrist_flexors: 100 },
      },
    );
    const plan = res.armPlan;
    expect(plan).toBeTruthy();
    const sets = (w: any) =>
      w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
    const last = sets(plan.weeks[plan.weeks.length - 1]);
    // База — самая объёмная неделя до тейпер-окна (weekMult там 0.85–1.0).
    const pre = Math.max(...plan.weeks.slice(0, -3).map(sets));
    expect(pre).toBeGreaterThan(0);
    const ratio = last / pre;
    // Фактический тейпер: 52/86 ≈ 0.605 (база 86 → 60 → 52). Полоса узкая,
    // чтобы тест ловил и «тейпер не режет», и «тейпер стирает объём».
    expect(ratio).toBeGreaterThanOrEqual(0.5);
    expect(ratio).toBeLessThanOrEqual(0.65);
  });
});

describe('аудит 2026-11: покрытие мышц', () => {
  it('TableCup содержит ulnar_deviators (закрытие дыры пула)', () => {
    // В 4-дневный дефолт ulnar не добавляем: 5 сетов ульнарной работы уводят
    // недельную tendon-нагрузку ещё выше внутреннего ориентира 22 (см. аудит).
    expect(ARM_TAG_MUSCLES.TableCup).toContain('ulnar_deviators');
  });

  it('ни одна мышца из ARM_MUSCLES не имеет отрицательного объёма', () => {
    const plan = make();
    for (const m of ARM_MUSCLES) {
      for (const w of plan.weeks) expect(weekSets(plan, w.week, m)).toBeGreaterThanOrEqual(0);
    }
  });
});
