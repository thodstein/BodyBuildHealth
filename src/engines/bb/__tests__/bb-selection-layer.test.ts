import { describe, expect, it } from 'vitest';
import { buildExercisePool, selectExercisesForMuscle, computeMuscleSets, buildBBPlan, type SelectExercisesForMuscleOpts } from '../bb-builder.engine';
import { computeLoading } from '../bb-loading-layer.engine';
import { musclesForRole } from '../../movement-pattern';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

/* ═══════════════════════════════════════════════════════════════════
 * 3.1 — вынесенные слои buildSession:
 *  buildExercisePool / selectExercisesForMuscle / computeLoading + computeMuscleSets.
 *  Ключевое правило: вынесенные функции — ЕДИНСТВЕННЫЙ источник пула/выбора/loading,
 *  и buildSession их использует (паритет планов проверяется bb-интеграционными тестами).
 * ═══════════════════════════════════════════════════════════════════ */

function poolOpts(over: Partial<Parameters<typeof buildExercisePool>[2]> = {}): Parameters<typeof buildExercisePool>[2] {
  return {
    level: 'intermediate',
    roleMuscles: ['chest'],
    sessionTag: 'Push',
    allowExotic: false,
    allowStrengthLifts: false,
    isPurePull: false,
    equipmentList: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
    excludeIds: [],
    favoriteIds: [],
    muscle: 'chest',
    focusGroup: undefined,
    weakPoints: [],
    fewerCompound: false,
    ...over,
  };
}

describe('buildExercisePool — вынесенный слой пула (3.1)', () => {
  it('фильтрует по ИСТИННОЙ мышце: пул груди не содержит тяг/приседов', () => {
    const pool = buildExercisePool('chest', 'primary', poolOpts());
    expect(pool.length).toBeGreaterThan(0);
    for (const ex of pool) {
      const n = (ex.name || '').toLowerCase();
      expect(n.includes('тяга') || n.includes('присед') || n.includes('становая')).toBe(false);
    }
  });

  it('учитывает оборудование: только cable-упражнения', () => {
    const pool = buildExercisePool('chest', 'primary', poolOpts({ equipmentList: ['cable'] }));
    expect(pool.length).toBeGreaterThan(0);
    for (const ex of pool) {
      const rawEq = ex.equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      expect(exEq.length === 0 || exEq.some(eq => ['cable'].includes(eq))).toBe(true);
    }
  });

  it('исключает excludeIds', () => {
    const bench = EXERCISE_CATALOG.find(e => e.id === 'bench_bar')!;
    const pool = buildExercisePool('chest', 'primary', poolOpts({ excludeIds: ['bench_bar'] }));
    expect(pool.some(e => e.id === 'bench_bar')).toBe(false);
    expect(pool.length).toBeGreaterThan(0);
    expect(bench).toBeDefined();
  });

  it('без allowStrengthLifts — без армейского жима; с allowStrengthLifts — есть', () => {
    const shOpts = { muscle: 'shoulders', roleMuscles: musclesForRole('delt_front'), sessionTag: 'Push', isPurePull: false };
    const without = buildExercisePool('shoulders', 'primary', poolOpts({ ...shOpts, allowStrengthLifts: false }));
    expect(without.some(e => /армейск/i.test(e.name || ''))).toBe(false);
    const withLifts = buildExercisePool('shoulders', 'primary', poolOpts({ ...shOpts, allowStrengthLifts: true }));
    expect(withLifts.some(e => /армейск/i.test(e.name || ''))).toBe(true);
  });

  it('rear-delt только в Pull-днях (isPurePull), не в Push', () => {
    const shouldersMuscles = musclesForRole('delt_mid');
    const push = buildExercisePool('shoulders', 'primary', poolOpts({ muscle: 'shoulders', roleMuscles: shouldersMuscles, sessionTag: 'Push', isPurePull: false }));
    expect(push.some(e => /задняя дельта|заднюю дельту|rear.?delt/i.test(e.name || ''))).toBe(false);
    const pull = buildExercisePool('shoulders', 'primary', poolOpts({ muscle: 'shoulders', roleMuscles: shouldersMuscles, sessionTag: 'Pull', isPurePull: true }));
    expect(pull.some(e => /задняя дельта|заднюю дельту|rear.?delt/i.test(e.name || ''))).toBe(true);
  });

  it('подтягивания требуют подтверждённой bodyweight capability', () => {
    const noCap = buildExercisePool('back', 'primary', poolOpts({ muscle: 'back', roleMuscles: musclesForRole('back'), sessionTag: 'Pull', isPurePull: true, bodyweightCapability: undefined }));
    expect(noCap.some(e => /подтяг|pull.?up|chin.?up/i.test(e.name || ''))).toBe(false);
    const withCap = buildExercisePool('back', 'primary', poolOpts({ muscle: 'back', roleMuscles: musclesForRole('back'), sessionTag: 'Pull', isPurePull: true, bodyweightCapability: { pullUpsStrict: 8 } }));
    expect(withCap.some(e => /подтяг|pull.?up|chin.?up/i.test(e.name || ''))).toBe(true);
  });

  it('generic-план исключает блэклист (decline-жимы/пуловеры для груди)', () => {
    const generic = buildExercisePool('chest', 'primary', poolOpts());
    expect(generic.some(e => e.id === 'decline_bar' || e.id === 'dumbbell_pullover' || /пуловер/.test(e.name || ''))).toBe(false);
  });

  it('weak-точка на мышцу снимает generic-фильтр', () => {
    const generic = buildExercisePool('chest', 'primary', poolOpts());
    const weak = buildExercisePool('chest', 'primary', poolOpts({ weakPoints: ['chest'] }));
    expect(weak.length).toBeGreaterThanOrEqual(generic.length);
  });

  it('скоринг: первое упражнение — BB-приоритет (наклонный/жим), _score убывает', () => {
    const pool = buildExercisePool('chest', 'primary', poolOpts());
    expect((pool[0] as any)._score).toBeGreaterThanOrEqual((pool[1] as any)._score);
    expect((pool[0] as any)._score).toBeGreaterThanOrEqual(15);
  });

  it('fewerCompound: машина/Смит выше свободных', () => {
    const normal = buildExercisePool('legs', 'primary', poolOpts({ muscle: 'legs', roleMuscles: musclesForRole('quads'), sessionTag: 'Legs', isPurePull: false }));
    const fewer = buildExercisePool('legs', 'primary', poolOpts({ muscle: 'legs', roleMuscles: musclesForRole('quads'), sessionTag: 'Legs', isPurePull: false, fewerCompound: true }));
    const machineNormal = normal.findIndex(e => /машин|тренаж|machine|гакк|смит/.test(e.name || ''));
    const machineFewer = fewer.findIndex(e => /машин|тренаж|machine|гакк|смит/.test(e.name || ''));
    expect(machineFewer).toBeGreaterThanOrEqual(0);
    expect(machineFewer).toBeLessThanOrEqual(machineNormal < 0 ? 100 : machineNormal);
  });

  it('mobilityRestrictions фильтруют по движению', () => {
    const pool = buildExercisePool('shoulders', 'primary', poolOpts({
      muscle: 'shoulders', roleMuscles: musclesForRole('delt_front'), sessionTag: 'Push',
      isPurePull: false, mobilityRestrictions: ['shoulder'],
    }));
    // Жимы над головой с высоким риском плеча должны быть исключены
    expect(pool.some(e => /армейский|жим стоя|overhead|жим.*над голов/i.test(e.name || ''))).toBe(false);
  });
});

describe('selectExercisesForMuscle — вынесенный слой выбора (3.1)', () => {
  const mkOpts = (over: Partial<SelectExercisesForMuscleOpts> = {}): SelectExercisesForMuscleOpts => ({
    sessionSelectedIds: [],
    sessionSelectedNames: [],
    equipment: [],
    weakZones: [],
    level: 'intermediate',
    injuryProfile: [],
    type: 'compound',
    targetRir: 2,
    favoriteIds: [],
    excludeIds: [],
    avoidAxialLoad: false,
    preferEquipment: ['barbell', 'dumbbell', 'machine', 'cable'],
    ...over,
  });

  it('возвращает ровно count упражнений и фиксирует их в сессионные списки', () => {
    const pool = buildExercisePool('chest', 'primary', poolOpts());
    const opts = mkOpts();
    const selected = selectExercisesForMuscle(pool, 'chest', 3, opts);
    expect(selected.length).toBe(3);
    expect(opts.sessionSelectedIds.length).toBe(3);
    expect(opts.sessionSelectedNames.length).toBe(3);
    for (const s of selected) {
      expect(pool.some(e => e.id === s.id)).toBe(true);
    }
  });

  it('не повторяет уже выбранные упражнения сессии', () => {
    const pool = buildExercisePool('back', 'primary', poolOpts({
      muscle: 'back', roleMuscles: musclesForRole('back'), sessionTag: 'Pull', isPurePull: true,
    }));
    const first = selectExercisesForMuscle(pool, 'back', 2, mkOpts());
    const secondOpts = mkOpts({
      sessionSelectedIds: first.map((s: any) => s.id),
      sessionSelectedNames: first.map((s: any) => s.name),
    });
    const second = selectExercisesForMuscle(pool, 'back', 2, secondOpts);
    const allIds = [...first, ...second].map((s: any) => s.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('favorite-упражнение попадает в выбор', () => {
    const pool = buildExercisePool('chest', 'primary', poolOpts());
    const favoriteId = (pool.find(e => e.id === 'incline_bar') || pool[0]).id;
    const opts = mkOpts({ favoriteIds: [favoriteId] });
    const selected = selectExercisesForMuscle(pool, 'chest', Math.min(2, pool.length), opts);
    expect(selected.some((s: any) => s.id === favoriteId)).toBe(true);
  });
});

describe('computeMuscleSets — вынесенный слой объёма (3.1)', () => {
  const rot: Record<string, number> = { back: 20, chest: 16, shoulders: 10 };

  it('high-volume enhanced: спина/квадры поднимаются до капа 5 (бюджет выше — в сессиях/упражнениях)', () => {
    expect(computeMuscleSets('back', 3, { level: 'enhanced', trainingYears: 5, phase: 'accumulation', role: 'primary', muscleVolumeRotation: rot, isHeavy: true })).toBe(5);
    expect(computeMuscleSets('quads', 3, { level: 'enhanced', trainingYears: 5, phase: 'accumulation', role: 'primary', muscleVolumeRotation: rot, isHeavy: true })).toBe(5);
    // Без минимума (intermediate) бюджет остаётся как задан
    expect(computeMuscleSets('back', 3, { level: 'intermediate', phase: 'accumulation', role: 'primary', muscleVolumeRotation: rot, isHeavy: true })).toBe(3);
  });

  it('natural advanced: спина поднимается к капу 5', () => {
    expect(computeMuscleSets('back', 3, { level: 'advanced', phase: 'accumulation', role: 'primary', muscleVolumeRotation: rot, isHeavy: true })).toBe(5);
  });

  it('deload не поднимает минимумы и кап 5 сетов', () => {
    expect(computeMuscleSets('back', 7, { level: 'enhanced', trainingYears: 5, phase: 'deload', role: 'primary', muscleVolumeRotation: rot, isHeavy: true })).toBeLessThanOrEqual(5);
  });

  it('indirect overlap: при 24+ тяг бицепс режется до 20%', () => {
    const rotPull: Record<string, number> = { back: 30 };
    expect(computeMuscleSets('biceps', 8, { level: 'intermediate', phase: 'accumulation', role: 'accessory', muscleVolumeRotation: rotPull, isHeavy: false })).toBeLessThanOrEqual(6);
  });
});

describe('computeLoading — вынесенный слой loading, parity с buildSession (3.1)', () => {
  it('deload: reps = midpoint диапазона (parity с buildSession inline)', () => {
    const accum = computeLoading({ muscle: 'chest', exerciseName: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 4, phase: 'accumulation', phaseWeek: 1, week: 1, workMax: 100, trainingFocus: 'hypertrophy' });
    const deload = computeLoading({ muscle: 'chest', exerciseName: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 4, phase: 'deload', phaseWeek: 1, week: 4, workMax: 100, trainingFocus: 'hypertrophy' });
    // Deload: больше reps чем accumulation (recovery), midpoint между границами
    expect(deload.reps).toBeGreaterThan(accum.reps);
    const [minR, maxR] = deload.repsRange;
    expect(deload.reps).toBe(Math.round((minR + maxR) / 2));
  });

  it('parity: план buildBBPlan (неделя 1, accumulation) совпадает с computeLoading', () => {
    const plan = buildBBPlan({
      patternId: 'push_pull_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
      equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
      volumeGoal: 'mav',
    });
    const week1 = plan.weeks[0];
    expect(week1.phase).toBe('accumulation');
    const exercise = week1.sessions[0].exercises.find((e: any) => !e.warmupActivator)!;
    const result = computeLoading({
      muscle: exercise.muscle,
      exerciseName: exercise.name,
      exerciseId: exercise.exerciseName,
      role: exercise.role,
      character: exercise.character,
      sets: exercise.sets,
      phase: 'accumulation',
      phaseWeek: 1,
      week: week1.week,
      workMax: 100,
      trainingFocus: 'hypertrophy',
    });
    expect(result.reps).toBe(exercise.workSets[0].reps);
    expect(result.rir).toBe(exercise.rir);
    expect(result.tempoSpec).toBe(exercise.tempoSpec);
    expect(result.restSeconds).toBe(exercise.restSeconds);
  });

  it('warmup только для primary', () => {
    const primary = computeLoading({ muscle: 'chest', exerciseName: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 4, phase: 'accumulation', phaseWeek: 1, week: 1, workMax: 100 });
    const accessory = computeLoading({ muscle: 'chest', exerciseName: 'Сведение в кроссовере', role: 'accessory', character: 'памп', sets: 3, phase: 'accumulation', phaseWeek: 1, week: 1, workMax: 60 });
    expect(primary.warmupSets).toBeDefined();
    expect(accessory.warmupSets).toBeUndefined();
  });
});