/**
 * bb-female-posterior.test.ts — женская задняя цепь (попа + бицепс бедра).
 *
 * Наука:
 * - Plotkin et al. 2023 (Frontiers, MRI): присед vs хип-траст дают схожий рост
 *   ягодиц, но хамсы НЕ растут ни от того, ни от другого (mCSA ~0). Вывод:
 *   бицепсу бедра нужен ПРЯМОЙ объём, indirect от приседа/моста его не покрывает.
 * - Kassiano et al. 2024 (untrained young women): leg press + SLDL + hip thrust
 *   +9.3% толщины glute max против +6.0% без траста. Вывод: комбо
 *   «жим ногами + hinge + траст» обязательно в женской неделе.
 * - NSCA Hodge/Contreras 2023: 4 паттерна попы (thrust / squat-lunge / hinge-pull /
 *   abduction), 1-2 из них унилатерально.
 *
 * Баги, закрытые этим пакетом:
 * 1. sessionShareFor давал female-бонус ×1.2 только glutes; hamstrings — 0,
 *    хотя femaleAdjust обещает hams-акцент (нестыковка объёма задней цепи).
 * 2. ANGLE_CLASSES.hamstrings.rdl_bridge захватывал хип-траст/ягодичный мост
 *    (глютео-специфичные по Plotkin) — попа конкурировала с RDL за один слот.
 * 3. STRICT_EXERCISE_GROUPS не знали glutes вообще — траст ротировался свободно,
 *    своп падал в fallback каталога.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { ANGLE_CLASSES, strictGroupForExercise, strictGroupMembersOf } from '../bb-exercise-selection.engine';
import { femaleAdjust, femalePosteriorBoost, FEMALE_POSTERIOR_BOOST } from '../bb-demographics';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'push_pull_legs_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 4,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    sex: 'female',
    ...overrides,
  };
}

function totalVolumeForMuscle(plan: BBPlan, muscle: string): number {
  return plan.weeks.reduce((sum, w) => {
    return sum + w.sessions.flatMap(s => s.exercises)
      .filter(e => e.muscle === muscle)
      .reduce((s, e) => s + e.sets, 0);
  }, 0);
}

describe('female posterior parity: hamstrings получают тот же ×1.2, что glutes', () => {
  it('female hams >= male hams (тот же сплит, допуск −2 как у glutes)', () => {
    const female = buildBBPlan(makeInput({ sex: 'female' }));
    const male = buildBBPlan(makeInput({ sex: 'male' }));
    const fHams = totalVolumeForMuscle(female, 'hamstrings');
    const mHams = totalVolumeForMuscle(male, 'hamstrings');
    expect(fHams).toBeGreaterThan(0);
    expect(fHams).toBeGreaterThanOrEqual(mHams - 2);
  });

  it('female glutes >= male glutes (регрессия старого поведения)', () => {
    const female = buildBBPlan(makeInput({ sex: 'female' }));
    const male = buildBBPlan(makeInput({ sex: 'male' }));
    expect(totalVolumeForMuscle(female, 'glutes'))
      .toBeGreaterThanOrEqual(totalVolumeForMuscle(male, 'glutes') - 2);
  });

  it('женская неделя содержит hinge (RDL/румынская) — прямой объём хамсов', () => {
    const plan = buildBBPlan(makeInput({ sex: 'female' }));
    const names = plan.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.name)));
    expect(names.some(n => /румын|rdl/i.test(n))).toBe(true);
  });

  it('cycle-путь: суммарная задняя цепь female >= male строго (попа+хамсы)', () => {
    const WM = { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, traps: 60, hamstrings: 90, glutes: 160, calves: 120, forearms: 50 } as Record<string, number>;
    const base = { cycle: CYCLE_01, workMax: WM, level: 'intermediate', equipment: EQ, mode: 'adapt' } as any;
    const female = convertCycleToBBPlan({ ...base, sex: 'female' });
    const male = convertCycleToBBPlan({ ...base, sex: 'male' });
    const totF = totalVolumeForMuscle(female, 'glutes') + totalVolumeForMuscle(female, 'hamstrings');
    const totM = totalVolumeForMuscle(male, 'glutes') + totalVolumeForMuscle(male, 'hamstrings');
    expect(totF).toBeGreaterThanOrEqual(totM);
  });
});

describe('hamstrings.rdl_bridge больше не крадёт хип-траст', () => {
  const hamsClasses = ANGLE_CLASSES.hamstrings;
  it('ягодичный мост / hip thrust НЕ матчатся ни одним классом hamstrings', () => {
    for (const c of hamsClasses) {
      expect(c.match({ name: 'Ягодичный мост со штангой' } as any)).toBe(false);
      expect(c.match({ name: 'Hip Thrust' } as any)).toBe(false);
    }
  });
  it('те же упражнения матчатся glutes.hip_thrust', () => {
    const ht = ANGLE_CLASSES.glutes.find(c => c.name === 'hip_thrust')!;
    expect(ht.match({ name: 'Ягодичный мост со штангой' } as any)).toBe(true);
  });
  it('RDL остаётся в hamstrings', () => {
    expect(hamsClasses.some(c => c.match({ name: 'Румынская тяга' } as any))).toBe(true);
  });
});

describe('строгие группы попы (Kassiano/NSCA: траст + отведение)', () => {
  it('hip_thrust → glute_thrust', () => {
    expect(strictGroupForExercise({ id: 'hip_thrust' }, 'glutes')?.key).toBe('glute_thrust');
  });
  it('члены glute_thrust — только мостовая семья (без приседа)', () => {
    const members = strictGroupMembersOf({ id: 'hip_thrust' }, 'glutes');
    expect(members.length).toBeGreaterThan(0);
    expect(members.some(m => m.id === 'squat_bar')).toBe(false);
    expect(members.some(m => m.id === 'glute_bridge')).toBe(true);
  });
  it('кикбэк → glute_abduction', () => {
    expect(strictGroupForExercise({ id: 'cable_kickback' }, 'glutes')?.key).toBe('glute_abduction');
  });
});

describe('5.4: женский бонус задней цепи — единый источник (bb-demographics)', () => {
  it('femalePosteriorBoost: 1.2 только glutes/hamstrings у female', () => {
    expect(femalePosteriorBoost('glutes', 'female')).toBe(FEMALE_POSTERIOR_BOOST);
    expect(femalePosteriorBoost('hamstrings', 'female')).toBe(FEMALE_POSTERIOR_BOOST);
    expect(femalePosteriorBoost('glutes', 'male')).toBe(1);
    expect(femalePosteriorBoost('hamstrings', undefined)).toBe(1);
    expect(femalePosteriorBoost('quads', 'female')).toBe(1);
    expect(FEMALE_POSTERIOR_BOOST).toBe(1.2);
  });

  it('femaleAdjust: наука задней цепи в notes (Plotkin/Barbalho/Kassiano)', () => {
    const notes = femaleAdjust().notes.join(' ');
    expect(notes).toContain('Plotkin 2023');
    expect(notes).toContain('Barbalho 2020');
    expect(notes).toContain('Kassiano 2024');
    expect(notes).toContain('+20%');
  });

  it('потребители читают единый источник (source-guard)', () => {
    const builder = readFileSync(resolve(__dirname, '..', 'bb-builder.engine.ts'), 'utf8');
    const cycle = readFileSync(resolve(__dirname, '..', 'cycle-to-plan.ts'), 'utf8');
    expect(builder).toContain('FEMALE_POSTERIOR_BOOST');
    expect(cycle).toContain('femalePosteriorBoost');
    expect(cycle).not.toContain("(muscle === 'glutes' || muscle === 'hamstrings')) ? 1.2");
  });
});

describe('5.4: приоритет приседа у тренированных женщин (Plotkin/Barbalho)', () => {
  const coverageOf = (plan: BBPlan) => plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
    .filter(e => /Quads-гарантия/.test(String((e as any).comment || '')));

  it('advanced female glute-сплит: quads-гарантия ставит присед (squat-pattern) с Plotkin', () => {
    const plan = buildBBPlan(makeInput({ patternId: 'female_glute_5', level: 'advanced', trainingYears: 6 }));
    const cov = coverageOf(plan);
    expect(cov.length).toBeGreaterThan(0);
    expect(/приседания/i.test(cov[0].name), cov[0].name).toBe(true);
    expect(String((cov[0] as any).comment)).toContain('Тренированные');
    expect(String((cov[0] as any).comment)).toContain('Plotkin 2023');
  });

  it('intermediate female: машинный носитель (Kassiano) — прежнее поведение', () => {
    const plan = buildBBPlan(makeInput({ patternId: 'female_glute_5' }));
    const cov = coverageOf(plan);
    expect(cov.length).toBeGreaterThan(0);
    expect(String((cov[0] as any).comment)).toContain('Нетренированные');
    expect(String((cov[0] as any).comment)).toContain('Kassiano 2024');
    expect(/гакк|жим ногами|leg.?press/i.test(cov[0].name), cov[0].name).toBe(true);
    expect(/приседания со штангой|фронтальные приседания/i.test(cov[0].name), cov[0].name).toBe(false);
  });
});
