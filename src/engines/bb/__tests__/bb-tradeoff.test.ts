import { describe, expect, it } from 'vitest';
import {
  buildSpecializationSchedule,
  tradeoffForWeek,
  specializationScheduleText,
} from '../bb-specialization.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { aggregateBBVolume } from '../bb-volume.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';
import { rankBBSplits } from '../bb-selector.engine';
import { allZoneSpecs } from '../bb-specialization-registry';

/**
 * Донорское перераспределение специализации (цель за счёт доноров):
 * - прямые изоляции донора снижаются/убираются, косвенная нагрузка сохраняется;
 * - effective volume донора не ниже MEV (floor);
 * - освобождённый ресурс идёт в паттерн-совпадающие упражнения цели;
 * - финализатор не возвращает объём донору;
 * - после блока объём донора восстанавливается;
 * - многоблочное расписание: 12 нед = 1-5 A, 6-10 B, 11-12 баланс.
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45,
};

const directSets = (plan: ReturnType<typeof buildBBPlan>, week: number, muscle: string): number => {
  const w = plan.weeks.find(x => x.week === week);
  if (!w) return 0;
  return w.sessions.flatMap(s => s.exercises)
    .filter(e => e.muscle === muscle && !(e as any).warmupActivator)
    .reduce((sum, e) => sum + (e.sets || 0), 0);
};

const effectiveSets = (plan: ReturnType<typeof buildBBPlan>, week: number, muscle: string): number => {
  const w = plan.weeks.find(x => x.week === week);
  if (!w) return 0;
  return aggregateBBVolume(w.sessions)[muscle]?.effectiveSets ?? 0;
};

describe('tradeoff-политика (движок)', () => {
  it('registry покрывает все UI-зоны и у каждой есть target pattern', () => {
    const expected = ['chest', 'chest_upper', 'chest_lower', 'back', 'back_width', 'back_thickness', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'forearms', 'abs', 'traps'];
    const specs = allZoneSpecs();
    expect(new Set(specs.map(x => x.key))).toEqual(new Set(expected));
    for (const spec of specs) {
      expect(spec.canonical).toBeTruthy();
      expect(spec.patterns.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['back_thickness', 'legs'],
    ['chest_upper', 'triceps'],
    ['delt_mid', 'chest'],
    ['quads', 'hamstrings'],
    ['hamstrings', 'quads'],
    ['glutes', 'quads'],
    ['calves', 'legs'],
    ['biceps', 'triceps'],
    ['triceps', 'biceps'],
    ['forearms', 'arms'],
    ['abs', 'core'],
    ['traps', 'forearms'],
  ])('generic matrix: target %s за счёт donor %s не ломает план', (target, donor) => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 5, workMax: WM,
      weakPoints: [target], specialization: true,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: [target],
        tradeoff: { mode: 'reduce_direct_to_floor', donorMuscles: [donor], preserveIndirect: true },
      }],
    });
    expect(plan.validation?.valid).not.toBe(false);
    expect(plan.weeks.length).toBe(5);
    expect(plan.rationale.some(r => r.includes('Донорское перераспределение')) || plan.rationale.some(r => r.includes('Специализация'))).toBe(true);
  }, 30000);

  it('нормализация: дедуп доноров, mode none отбрасывается', () => {
    const s = buildSpecializationSchedule(undefined, ['back_thickness'], true, 12, [
      {
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps', 'triceps', 'biceps'], preserveIndirect: true },
      },
      { weekStart: 6, weekEnd: 10, targets: ['back'], tradeoff: { mode: 'none', donorMuscles: ['biceps'], preserveIndirect: true } },
    ]);
    expect(s.blocks[0].tradeoff).toEqual({ mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps', 'triceps'], preserveIndirect: true });
    expect(s.blocks[1].tradeoff).toBeUndefined();
  });

  it('валидация: блок специализации НЕ короче 3 недель (расширение вправо/влево)', () => {
    // 1-1 (цели) на 12 нед → расширяется до 1-3
    const right = buildSpecializationSchedule(undefined, ['chest'], true, 12, [{ weekStart: 1, weekEnd: 1, targets: ['chest'] }]);
    const specBlock = right.blocks.find(b => b.targets.length > 0)!;
    expect(specBlock.weekStart).toBe(1);
    expect(specBlock.weekEnd).toBe(3);
    // 12-12 (цели) на 12 нед → расширяется влево до 10-12
    const left = buildSpecializationSchedule(undefined, ['chest'], true, 12, [{ weekStart: 12, weekEnd: 12, targets: ['chest'] }]);
    const specBlockL = left.blocks.find(b => b.targets.length > 0)!;
    expect(specBlockL.weekStart).toBe(10);
    expect(specBlockL.weekEnd).toBe(12);
    // План короче MIN: 2-нед план с целями остаётся как есть (некуда расширяться)
    const short = buildSpecializationSchedule(undefined, ['chest'], true, 2, [{ weekStart: 1, weekEnd: 1, targets: ['chest'] }]);
    const specBlockS = short.blocks.find(b => b.targets.length > 0)!;
    expect(specBlockS.weekStart).toBe(1);
    expect(specBlockS.weekEnd).toBe(1);
    // Баланс-блоки не расширяются
    const balance = buildSpecializationSchedule(undefined, [], false, 12, [{ weekStart: 2, weekEnd: 2, targets: [] }]);
    expect(balance.blocks.every(b => b.targets.length === 0)).toBe(true);
  });

  it('tradeoffForWeek: политика только в своих неделях', () => {
    const s = buildSpecializationSchedule(undefined, ['back_thickness'], true, 12, [
      {
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'reduce_direct_to_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      },
    ]);
    expect(tradeoffForWeek(s, 3)?.donorMuscles).toEqual(['biceps']);
    expect(tradeoffForWeek(s, 6)).toBeNull();
  });

  it('текст расписания включает доноров', () => {
    const s = buildSpecializationSchedule(undefined, ['back_thickness'], true, 12, [
      {
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      },
    ]);
    expect(specializationScheduleText(s)).toContain('доноры: biceps');
    expect(specializationScheduleText(s)).toContain('нед 6-12 баланс');
  });

  it('baseline invariance: пустое расписание (только баланс) = отсутствие расписания', () => {
    const without = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 6, workMax: WM,
    });
    const withEmpty = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 6, workMax: WM,
      specializationSchedule: [{ weekStart: 1, weekEnd: 6, targets: [] }],
    });
    const shape = (p: ReturnType<typeof buildBBPlan>) => p.weeks.map(w =>
      w.sessions.map(s =>
        s.exercises.map(e => ({ name: e.name, muscle: e.muscle, sets: e.sets, workSets: e.workSets?.length }))
      )
    );
    expect(shape(withEmpty)).toEqual(shape(without));
  }, 30000);
});

describe('generic: донорское перераспределение', () => {
  const baseInput = {
    patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
    goal: 'mass', weeks: 12, workMax: WM,
    weakPoints: ['back_thickness'], specialization: true,
  } as const;

  it('remove_direct_when_indirect_covers_floor: прямые руки снижены, effective ≥ MEV, спина получила перенос', () => {
    const base = buildBBPlan({ ...baseInput });
    const donor = buildBBPlan({
      ...baseInput,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps', 'triceps'], preserveIndirect: true },
      }],
    });
    // Прямые руки в неделе 1 снижены относительно baseline.
    expect(directSets(donor, 1, 'biceps')).toBeLessThan(directSets(base, 1, 'biceps'));
    // Effective не ниже MEV (intermediate biceps MEV=4).
    expect(effectiveSets(donor, 1, 'biceps')).toBeGreaterThanOrEqual(4);
    // Спина получила перенос (не меньше baseline).
    expect(directSets(donor, 1, 'back')).toBeGreaterThanOrEqual(directSets(base, 1, 'back'));
    // После блока (неделя 6) руки восстановлены.
    expect(directSets(donor, 6, 'biceps')).toBeGreaterThan(directSets(donor, 1, 'biceps'));
    // Отчёт в rationale.
    expect(donor.rationale.some(r => r.includes('Донорское перераспределение'))).toBe(true);
  }, 30000);

  it('reduce_direct_to_floor: прямые руки снижены, effective не ниже MEV', () => {
    const base = buildBBPlan({ ...baseInput });
    const donor = buildBBPlan({
      ...baseInput,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'reduce_direct_to_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      }],
    });
    expect(directSets(donor, 1, 'biceps')).toBeLessThan(directSets(base, 1, 'biceps'));
    expect(effectiveSets(donor, 1, 'biceps')).toBeGreaterThanOrEqual(4);
  }, 30000);

  it('без tradeoff baseline не меняется', () => {
    const a = buildBBPlan({ ...baseInput });
    const b = buildBBPlan({ ...baseInput });
    const sum = (p: typeof a) => p.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => !(e as any).warmupActivator).reduce((acc, e) => acc + e.sets, 0);
    expect(sum(a)).toBe(sum(b));
  }, 30000);

  it('floor учитывает PED/стаж: enhanced донор не режется ниже адаптированного MEV', () => {
    const donor = buildBBPlan({
      patternId: 'ppl_6', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['back_thickness'], specialization: true,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      }],
    });
    // Адаптированный MEV enhanced biceps = 8 × (adaptedMrv / baseMrv) ≥ 8.
    const lm = getVolumeLandmarks('enhanced', 'biceps');
    expect(lm).toBeTruthy();
    expect(effectiveSets(donor, 1, 'biceps')).toBeGreaterThanOrEqual(lm!.mev);
  }, 30000);

  it('композитный донор legs реально режет primary leg compounds до floor', () => {
    const base = buildBBPlan({ ...baseInput });
    const donor = buildBBPlan({
      ...baseInput,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'reduce_direct_to_floor', donorMuscles: ['legs'], preserveIndirect: true },
      }],
    });
    expect(directSets(donor, 1, 'quads')).toBeLessThan(directSets(base, 1, 'quads'));
    expect(effectiveSets(donor, 1, 'quads')).toBeGreaterThanOrEqual(8);
    expect(directSets(donor, 1, 'hamstrings')).toBeLessThan(directSets(base, 1, 'hamstrings'));
  }, 30000);
});

describe('многоблочное расписание (12 нед: 1-5 A, 6-10 B, 11-12 баланс)', () => {
  it('объём переключается по блокам, баланс в конце', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['chest'], specialization: true,
      specializationSchedule: [
        { weekStart: 1, weekEnd: 5, targets: ['chest'] },
        { weekStart: 6, weekEnd: 10, targets: ['back'] },
      ],
    });
    // Блок 1: грудь — цель, спина — поддержка.
    expect(directSets(plan, 1, 'chest')).toBeGreaterThan(directSets(plan, 1, 'back'));
    // Блок 2: спина выходит на целевой объём (выше, чем в блоке 1).
    expect(directSets(plan, 8, 'back')).toBeGreaterThan(directSets(plan, 1, 'back'));
    // Рациональе описывает блоки и баланс.
    expect(plan.rationale.some(r => r.includes('нед 1-5 [chest]'))).toBe(true);
    expect(plan.rationale.some(r => r.includes('нед 6-10 [back]'))).toBe(true);
    expect(plan.rationale.some(r => r.includes('нед 11-12 баланс'))).toBe(true);
  }, 30000);

  it('доноры блока 1 не действуют в блоке 2', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['back_thickness'], specialization: true,
      specializationSchedule: [
        {
          weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
          tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps'], preserveIndirect: true },
        },
        { weekStart: 6, weekEnd: 10, targets: ['chest'] },
      ],
    });
    // В блоке 2 бицепс больше не донор — объём восстановлен.
    expect(directSets(plan, 8, 'biceps')).toBeGreaterThan(directSets(plan, 1, 'biceps'));
  }, 30000);
});

describe('selector: специализация учитывает доноров', () => {
  it('не рекомендует FullBody/PPL для специализации за счёт legs', () => {
    const ranked = rankBBSplits({
      level: 'intermediate', goal: 'mass', daysPerWeek: 4,
      weakPoints: ['back_thickness'], donorMuscles: ['legs'], specialization: true,
    });
    expect(ranked[0]?.pattern.id).not.toMatch(/^fullbody_/i);
    const ppl = ranked.find(r => r.pattern.id === 'ppl_6');
    expect(ppl).toBeDefined();
    expect(ranked[0].score).toBeGreaterThan(ppl!.score);
    expect(ppl!.rationale.some(r => r.includes('доноры ног'))).toBe(true);
  });
});

describe('cycle adapt: специализация и доноры', () => {
  it('cycle adapt с back_thickness + biceps donor: план валиден, донор урезан', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate',
      mode: 'adapt',
      weakPoints: ['back_thickness'],
      specialization: true,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      }],
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.validation?.valid).not.toBe(false);
    expect(plan.rationale.some(r => r.includes('Специализация'))).toBe(true);
  }, 30000);
});

describe('faithful: tradeoff не трогает донора', () => {
  it('cycle faithful с schedule — состав исходного цикла сохраняется', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate',
      mode: 'faithful',
      weakPoints: ['back_thickness'],
      specialization: true,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['biceps'], preserveIndirect: true },
      }],
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.rationale.some(r => r.includes('Донорское перераспределение'))).toBe(false);
  }, 30000);
});

describe('program adapt: специализация и доноры', () => {
  it('program adapt с back_thickness + arms donor: план валиден', () => {
    const program: any = {
      name: 'Test program', author: 'test', type: 'bodybuilding', goal: 'bodybuilding',
      direction: 'bodybuilding', level: 'intermediate', durationWeeks: 5, daysPerWeek: 4,
      sessionTimeMin: '60', description: '', targetAudience: '', equipmentNeeded: [],
      weeks: Array.from({ length: 5 }, (_, i) => ({
        week: i + 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false,
        days: [
          { day: 1, name: 'Push', focus: 'chest', warmup: '', exercises: [
            { name: 'Жим штанги лёжа', sets: 4, reps: '8', rir: 2 },
            { name: 'Жим гантелей сидя', sets: 3, reps: '10', rir: 2 },
          ] },
          { day: 2, name: 'Pull', focus: 'back', warmup: '', exercises: [
            { name: 'Тяга штанги в наклоне', sets: 4, reps: '8', rir: 2 },
            { name: 'Сгибание рук со штангой', sets: 3, reps: '10', rir: 2 },
          ] },
          { day: 3, name: 'Legs', focus: 'legs', warmup: '', exercises: [
            { name: 'Присед со штангой', sets: 4, reps: '8', rir: 2 },
            { name: 'Румынская тяга', sets: 3, reps: '10', rir: 2 },
          ] },
          { day: 4, name: 'Arms', focus: 'arms', warmup: '', exercises: [
            { name: 'Сгибание рук с гантелями', sets: 3, reps: '12', rir: 2 },
            { name: 'Разгибание рук на блоке', sets: 3, reps: '12', rir: 2 },
          ] },
        ],
      })),
      progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
    };
    const plan = programToBBPlan(program, {
      workMax: { ...WM, legs: 140 },
      level: 'intermediate',
      mode: 'adapt',
      weakPoints: ['back_thickness'],
      specialization: true,
      specializationSchedule: [{
        weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
        tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['arms'], preserveIndirect: true },
      }],
    } as any);
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.validation?.valid).not.toBe(false);
    expect(plan.rationale.some(r => r.includes('Специализация'))).toBe(true);
  }, 30000);
});

describe('program adapt: floor донора масштабируется полным множителем', () => {
  const makeProgram = (): any => {
    const weeks: any[] = [];
    for (let i = 0; i < 5; i++) {
      weeks.push({
        week: i + 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false,
        days: [
          { day: 1, name: 'Chest', focus: 'chest', warmup: '', exercises: [
            { name: 'Жим штанги лёжа', sets: 4, reps: '8', rir: 2 },
            { name: 'Жим узким хватом', sets: 3, reps: '10', rir: 2 },
          ] },
          { day: 2, name: 'Arms', focus: 'arms', warmup: '', exercises: [
            { name: 'Сгибание рук со штангой', sets: 3, reps: '12', rir: 2 },
            { name: 'Разгибание рук на блоке', sets: 4, reps: '12', rir: 2 },
          ] },
        ],
      });
    }
    return {
      name: 'Floor test', author: 'test', type: 'bodybuilding', goal: 'bodybuilding',
      direction: 'bodybuilding', level: 'intermediate', durationWeeks: 5, daysPerWeek: 2,
      sessionTimeMin: '60', description: '', targetAudience: '', equipmentNeeded: [],
      weeks, progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
    };
  };

  const build = (labMrvMultiplier: number) => programToBBPlan(makeProgram(), {
    workMax: { ...WM, legs: 140 },
    level: 'intermediate',
    mode: 'adapt',
    labMrvMultiplier,
    weakPoints: ['back_thickness'],
    specialization: true,
    specializationSchedule: [{
      weekStart: 1, weekEnd: 5, targets: ['back_thickness'],
      tradeoff: { mode: 'remove_direct_when_indirect_covers_floor', donorMuscles: ['triceps'], preserveIndirect: true },
    }],
  } as any);

  it('labMrvMultiplier 1.5 поднимает floor донора — трицепс режется МЕНЬШЕ, чем при 1.0', () => {
    const base = build(1.0);
    const boosted = build(1.5);
    // Трицепс в программе: жим узким ×3 (direct) + разгибание на блоке ×4 (direct) = 7 direct;
    // indirect от жима лёжа ~1.8.
    // Floor при 1.0: MEV 4 (×1.0) → targetDirect ≈ 2; при 1.5: MEV 4 × 1.5 = 6 → targetDirect ≈ 4.
    const directBase = directSets(base as any, 1, 'triceps');
    const directBoosted = directSets(boosted as any, 1, 'triceps');
    expect(directBoosted).toBeGreaterThan(directBase);
    expect(directBoosted).toBeGreaterThanOrEqual(4);
    expect(directBase).toBeLessThanOrEqual(3);
  }, 30000);
});
