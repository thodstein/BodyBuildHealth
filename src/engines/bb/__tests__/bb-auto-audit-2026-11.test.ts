import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { programToBBPlan } from '../cycle-to-plan';
import { replanBBMesoFromFact } from '../bb-replan.engine';
import { suggestFeeders } from '../bb-autocoach.engine';
import { canonicalMuscleOf, exerciseKeyOf, makeWorkSets, estimatedWeightFor, loadRatioBetween, findCatalogExercise } from '../../../ui/screens/TrainingScreen_parts/bb-auto-injections';

/**
 * Замок на исправления аудита 2026-11 (волна 1–2):
 *  - BB-04: хардкод-гарантии PPL уважают инвентарь (никаких machine-упражнений
 *    в плане «только гантели»);
 *  - BB-05: P8 auto-feeder не подмешивает упражнения вне каталога/вне инвентаря;
 *  - BB-08: возраст доезжает до движка (masters-MRV);
 *  - BB-09: боль/крепатура применяют срез объёма;
 *  - BB-15: атрибуция мышц не даёт ложных muscle_attribution;
 *  - BB-18: алиасы зон (`rear_delts`/`upper_back`/`chest_mid`) дают фидеры;
 *  - BB-01/02/03/13/14/16: чистые хелперы инъекций (канон мышцы, workSets,
 *    ключ упражнения, коэффициент свопа).
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
  glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
  delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
};

const build = (extra: Record<string, unknown> = {}) => buildBBPlan({
  patternId: 'ppl_6', level: 'intermediate', trainingYears: 4, goal: 'mass',
  weeks: 2, workMax: WM, weakPoints: [], volumeGoal: 'mav',
  ...extra,
} as any) as any;

const allExercises = (plan: any): any[] => plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises));

const totalSets = (plan: any): number => allExercises(plan)
  .filter((e: any) => !e.warmupActivator)
  .reduce((a: number, e: any) => a + (Number(e.sets) || 0), 0);

describe('BB-04: инвентарь уважается в хардкод-гарантиях PPL', () => {
  it('только гантели/свой вес → нет equipment_* ошибок', () => {
    const plan = build({ equipment: ['dumbbell', 'bodyweight'] });
    const errs = (plan.validation?.issues || []).filter((i: any) => String(i.code).startsWith('equipment_'));
    expect(errs.map((e: any) => e.exercise)).toEqual([]);
    expect(errs).toHaveLength(0);
  });

  it('гантели + штанга + свой вес → нет equipment_* ошибок', () => {
    const plan = build({ equipment: ['dumbbell', 'barbell', 'bodyweight'] });
    const errs = (plan.validation?.issues || []).filter((i: any) => String(i.code).startsWith('equipment_'));
    expect(errs).toHaveLength(0);
  });

  it('в плане «только гантели» нет тренажёрных упражнений', () => {
    const plan = build({ equipment: ['dumbbell', 'bodyweight'] });
    const machineOnly = ['Жим ногами (45°)', 'Разгибания ног в тренажёре', 'Сгибания ног в тренажёре лёжа', 'Гиперэкстензия (45°)'];
    const found = allExercises(plan).filter((e: any) => machineOnly.includes(e.name)).map((e: any) => e.name);
    expect(found).toEqual([]);
  });
});

describe('BB-05: P8 auto-feeder не подмешивает упражнения', () => {
  it('слабые группы не дают упражнений вне каталога', () => {
    const plan = build({ weakPoints: ['triceps', 'chest'], equipment: ['dumbbell', 'barbell', 'bodyweight'] });
    const feeders = allExercises(plan).filter((e: any) => /Auto-feeder/i.test(String(e.comment || '')));
    // Единственный пайплайн фидеров — в билдере (каталожные id/инвентарь/все недели).
    expect(feeders.every((f: any) => !!findCatalogExercise(f.name))).toBe(true);
  });
});

describe('BB-08: возраст влияет на объём (masters-MRV)', () => {
  it('55 лет < 25 лет по объёму целей', () => {
    const young = build({ age: 25 });
    const masters = build({ age: 55 });
    const sumTargets = (p: any) => Object.values(p.volumeTargets || {})
      .reduce((a: number, v: any) => a + (Number(v?.targetSets) || 0), 0);
    expect(sumTargets(masters)).toBeLessThan(sumTargets(young));
  });
});

describe('BB-09: боль/крепатура дают срез объёма', () => {
  it('красный вердикт колена снижает объём плана', () => {
    const base = build();
    const red = build({ painLevel: 'red', painLocation: 'patellar' });
    expect(totalSets(red)).toBeLessThan(totalSets(base));
  });

  it('крепатура 9/10 снижает объём', () => {
    const base = build();
    const sore = build({ soreness010: 9 });
    expect(totalSets(sore)).toBeLessThan(totalSets(base));
  });
});

describe('BB-15: нет ложных muscle_attribution', () => {
  it('полный зал → 0 предупреждений атрибуции', () => {
    const plan = build({ equipment: ['dumbbell', 'barbell', 'cable', 'machine', 'bodyweight'] });
    const wa = (plan.validation?.issues || []).filter((i: any) => i.code === 'muscle_attribution');
    expect(wa.map((i: any) => i.message)).toEqual([]);
  });
});

describe('BB-08/BB-09 (program-путь): возраст и крепатура доезжают до циклов/программ', () => {
  const program: any = {
    id: 'audit-2026-11', name: 'Audit program', author: 'test', type: 'bodybuilding', goal: 'bodybuilding',
    direction: 'bodybuilding', level: 'intermediate', durationWeeks: 1, daysPerWeek: 1, sessionTimeMin: '60',
    description: '', targetAudience: '', equipmentNeeded: [],
    weeks: [{ week: 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days: [{ day: 1, name: 'Chest', focus: 'chest', warmup: '', exercises: [
      { name: 'Жим штанги лёжа', sets: 4, reps: '8', rir: 2 },
      { name: 'Разводка гантелей', sets: 5, reps: '15', rir: 2 },
      { name: 'Кроссовер', sets: 5, reps: '15', rir: 2 },
    ] }] }],
    progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
  };
  const prog = (extra: Record<string, unknown>) => programToBBPlan(program, {
    workMax: { chest: 100, shoulders: 60, triceps: 50 },
    level: 'intermediate', mode: 'adapt', ...extra,
  } as any) as any;

  it('55 лет не получает больше объёма, чем 25', () => {
    const young = prog({ age: 25 });
    const masters = prog({ age: 55 });
    // masters-коррекция видна в rationale и не увеличивает объём.
    expect((masters.rationale || []).some((r: string) => /Возраст 55/.test(r))).toBe(true);
    expect((young.rationale || []).some((r: string) => /Возраст 25/.test(r))).toBe(false);
    const setsOf = (p: any) => p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises))
      .reduce((a: number, e: any) => a + (Number(e.sets) || 0), 0);
    expect(setsOf(masters)).toBeLessThanOrEqual(setsOf(young));
  });

  it('крепатура 9/10 режет объём program-плана', () => {
    const base = prog({});
    const sore = prog({ soreness010: 9 });
    const setsOf = (p: any) => p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises))
      .reduce((a: number, e: any) => a + (Number(e.sets) || 0), 0);
    expect(setsOf(sore)).toBeLessThan(setsOf(base));
  });
});

describe('BB-11: пересборка остатка не подменяет сплит', () => {
  const fakePlan = (patternId: string) => ({
    pattern: { id: patternId, name: 'x', rotationDays: 7, sessionsPerRotation: 1, schedule: [], level: [], description: '' },
    weeks: [1, 2, 3].map(w => ({ week: w, sessions: [] })),
    rotationMuscleVolume: {}, rationale: [],
    inputSnapshot: { level: 'intermediate', goal: 'mass', volumeGoal: 'mav' },
  }) as any;

  it('план программы (pattern.id = id программы) → честный null, а не чужой сплит', () => {
    expect(replanBBMesoFromFact(fakePlan('program_xyz'), [], { currentWeek: 2 })).toBeNull();
  });

  it('план сплита → остаток пересобирается', () => {
    const res = replanBBMesoFromFact(fakePlan('upper_lower_4'), [], { currentWeek: 2 });
    expect(res).not.toBeNull();
    expect(res!.rebuiltWeeks).toBeGreaterThan(0);
    expect(res!.frozenWeeks).toBe(1);
  });

  it('неделя 1 → null (нечего пересобирать)', () => {
    expect(replanBBMesoFromFact(fakePlan('upper_lower_4'), [], { currentWeek: 1 })).toBeNull();
  });
});

describe('BB-18: алиасы зон дают фидеры', () => {
  it('rear_delts / upper_back / chest_mid не теряются', () => {
    const eq = ['dumbbell', 'barbell', 'cable', 'bodyweight'];
    expect(suggestFeeders(['rear_delts'], eq).length).toBeGreaterThan(0);
    expect(suggestFeeders(['upper_back'], eq).length).toBeGreaterThan(0);
    expect(suggestFeeders(['chest_mid'], eq).length).toBeGreaterThan(0);
  });
});

describe('BB-01/02/03/13/14/16: хелперы инъекций', () => {
  it('канон мышцы: композитные группы каталога не протекают', () => {
    const composite = canonicalMuscleOf({ id: 'x', name: 'Сгибания рук с гантелями', group: 'arms' });
    expect(['biceps', 'triceps', 'forearms']).toContain(composite);
    expect(composite).not.toBe('arms');
  });

  it('workSets строятся ровно по числу сетов', () => {
    const ws = makeWorkSets(4, { reps: 10, rir: 2, weight: 40 });
    expect(ws).toHaveLength(4);
    for (const s of ws) {
      expect(s.reps).toBe(10);
      expect(s.rir).toBe(2);
      expect(s.weight).toBe(40);
    }
  });

  it('вес считается от канонической мышцы, а не от композитной группы', () => {
    const db = findCatalogExercise('Сгибания рук с гантелями');
    if (db) {
      const w = estimatedWeightFor(db, { biceps: 30, arms: 999 }, 2);
      // RIR 2 = 92% workMax: 30 × 0.92 ≈ 28 (не 919 от композитного ключа).
      expect(w).toBeGreaterThan(20);
      expect(w).toBeLessThan(40);
    }
  });

  it('ключ упражнения — display-name (канон движка)', () => {
    const cat = findCatalogExercise('Жим лёжа');
    if (cat) expect(exerciseKeyOf(cat)).toBe(cat.name);
  });

  it('своп снаряда пересчитывает вес (штанга → гантели)', () => {
    expect(loadRatioBetween('barbell', 'dumbbell')).toBeLessThan(1);
    expect(loadRatioBetween('dumbbell', 'barbell')).toBeGreaterThan(1);
    expect(loadRatioBetween('barbell', 'barbell')).toBe(1);
  });
});
