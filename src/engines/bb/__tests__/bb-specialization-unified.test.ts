import { describe, expect, it } from 'vitest';
import {
  resolveSpecialization,
  specializationVolumeFactor,
  specializationEmphasisFactor,
  specializationMrvFactor,
  isSpecializationWeak,
  isSpecializationFocus,
  canonicalizeMuscles,
  buildSpecializationSchedule,
  specResForWeekSchedule,
  specializationScheduleText,
} from '../bb-specialization.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

/**
 * Единая модель акцентов (специализация 1-2 мышц):
 * - focus/weak/specialization больше не складываются (1.2×1.3 = 1.56);
 * - top-2 специализации — канонические (shoulders не занимает 2 слота);
 * - specialization без слабых групп — no-op;
 * - фокус-мышца при специализации не режется (0.7×1.3 = 0.91);
 * - уровень/стаж/PED-множители не трогаются (проверяем инварианты).
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45,
};

describe('resolveSpecialization (резолвер)', () => {
  it('канонизирует слабые группы с сохранением порядка и без дублей', () => {
    const res = resolveSpecialization(undefined, ['shoulders', 'delt_mid', 'chest_upper', 'chest'], false);
    expect(res.weak).toEqual(['shoulders', 'chest']);
  });

  it('top-2 специализации — канонические (shoulders не занимает 2 слота)', () => {
    const res = resolveSpecialization(undefined, ['shoulders', 'chest'], true);
    expect(res.targets).toEqual(['shoulders', 'chest']);
  });

  it('specialization без слабых групп — no-op', () => {
    const res = resolveSpecialization(undefined, [], true);
    expect(res.active).toBe(false);
    expect(res.targets).toEqual([]);
  });

  it('focus + weak: фокус выигрывает, стэкинга нет', () => {
    const res = resolveSpecialization('chest', ['chest', 'biceps'], false);
    expect(specializationVolumeFactor('chest', res)).toBe(1.3);
    expect(specializationVolumeFactor('biceps', res)).toBe(1.2);
  });

  it('фокус-мышца при специализации не режется', () => {
    const res = resolveSpecialization('chest', ['chest', 'biceps'], true);
    expect(specializationVolumeFactor('chest', res)).toBe(1.3);
    expect(specializationVolumeFactor('biceps', res)).toBe(1.1);
    expect(specializationVolumeFactor('back', res)).toBe(0.7);
  });

  it('MRV-кап: focus ×1.3, weak ×1.2, остальные ×1.0', () => {
    const res = resolveSpecialization('chest', ['chest', 'biceps'], true);
    expect(specializationMrvFactor('chest', res)).toBe(1.3);
    expect(specializationMrvFactor('biceps', res)).toBe(1.2);
    expect(specializationMrvFactor('back', res)).toBe(1.0);
  });

  it('isSpecializationWeak/Focus работают по каноническим мышцам', () => {
    const res = resolveSpecialization('chest', ['delt_mid'], false);
    expect(isSpecializationWeak('shoulders', res)).toBe(true);
    expect(isSpecializationFocus('chest', res)).toBe(true);
    expect(isSpecializationFocus('chest_upper', res)).toBe(true);
  });

  it('canonicalizeMuscles: пустые отбрасываются, неизвестные сохраняются', () => {
    expect(canonicalizeMuscles(['', 'unknown_muscle', 'chest'])).toEqual(['unknown_muscle', 'chest']);
  });
});

describe('generic buildBBPlan: единая модель', () => {
  it('focus + weak больше не дают 1.56 (фокус выигрывает)', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 1, workMax: WM,
      weakPoints: ['chest'], focusGroup: 'chest',
    });
    const chest = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => e.muscle === 'chest' && !(e as any).warmupActivator);
    const total = chest.reduce((sum, e) => sum + e.sets, 0);
    // Без стэкинга: MAV×1.3 (не MAV×1.56). Для intermediate chest MAV=12 → ~16.
    expect(total).toBeLessThanOrEqual(20);
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it('specialization: топ-2 на MAV+10%, остальные на MEV (не MEV×1.5)', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 1, workMax: WM,
      weakPoints: ['chest', 'biceps'], specialization: true,
    });
    const week = plan.weeks[0];
    const byMuscle: Record<string, number> = {};
    for (const s of week.sessions) {
      for (const e of s.exercises) {
        if ((e as any).warmupActivator) continue;
        byMuscle[e.muscle] = (byMuscle[e.muscle] || 0) + e.sets;
      }
    }
    // Цели: chest/biceps — акцент; back — поддерживающий (MEV, не MAV).
    expect(byMuscle['chest']).toBeGreaterThanOrEqual(byMuscle['back'] || 0);
    // Поддерживающий объём не раздувается до MAV (intermediate back MAV=12,
    // MEV=8; финализатор может дотянуть до MEV-guard — допускаем до 14).
    const backSets = byMuscle['back'] || 0;
    expect(backSets).toBeLessThanOrEqual(14);
  });

  it('specialization без слабых групп = обычный план (no-op)', () => {
    const spec = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 1, workMax: WM, specialization: true,
    });
    const plain = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 1, workMax: WM,
    });
    const sumSets = (p: typeof spec) => p.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => !(e as any).warmupActivator).reduce((a, e) => a + e.sets, 0);
    expect(sumSets(spec)).toBe(sumSets(plain));
  });

  it('уровень/стаж/PED-множители не сломаны: enhanced 6 лет получает back ≥18 в Upper', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      weakPoints: ['chest'], specialization: true,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const uppers = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Upper');
    for (const session of uppers) {
      const back = session.exercises.filter(e => e.muscle === 'back');
      expect(back.reduce((sum, e) => sum + e.sets, 0)).toBeGreaterThanOrEqual(18);
    }
  }, 30000);

  it('инварианты: 0 single-set, 0 >5 сетов, валидация чистая', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 4, workMax: WM,
      weakPoints: ['chest', 'biceps'], specialization: true,
    });
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          if ((e as any).warmupActivator) continue;
          expect(e.sets).toBeGreaterThanOrEqual(2);
          expect(e.sets).toBeLessThanOrEqual(5);
        }
      }
    }
    expect(plan.validation?.valid).not.toBe(false);
  }, 30000);
});

describe('cycle-путь: единая модель', () => {
  it('фокус-мышца при специализации не режется (0.7×1.3 = 0.91 баг закрыт)', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate', trainingYears: 3,
      mode: 'adapt', weakPoints: ['chest'], focusGroup: 'chest', specialization: true,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    const chest = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => e.muscle === 'chest' && !(e as any).warmupActivator);
    expect(chest.length).toBeGreaterThan(0);
    const total = chest.reduce((sum, e) => sum + e.sets, 0);
    // Фокус ×1.3 поверх базовых сетов цикла — не урезан до поддерживающего.
    expect(total).toBeGreaterThanOrEqual(6);
  }, 30000);

  it('specialization без слабых групп — no-op (не режет все до ×0.7)', () => {
    const spec = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate', trainingYears: 3,
      mode: 'adapt', specialization: true,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    const plain = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate', trainingYears: 3,
      mode: 'adapt',
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    const sumSets = (p: typeof spec) => p.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => !(e as any).warmupActivator).reduce((a, e) => a + e.sets, 0);
    expect(sumSets(spec)).toBe(sumSets(plain));
  }, 30000);
});

describe('расписание блоков специализации (6-10 нед → баланс/другие цели)', () => {
  it('legacy: один блок 10 нед + баланс в длинных планах', () => {
    const s = buildSpecializationSchedule(undefined, ['chest'], true, 16);
    expect(s.blocks).toEqual([
      { weekStart: 1, weekEnd: 10, targets: ['chest'] },
      { weekStart: 11, weekEnd: 16, targets: [] },
    ]);
    expect(s.active).toBe(true);
    expect(s.primaryTargets).toEqual(['chest']);
  });

  it('явные блоки: блок 1 [chest,biceps], блок 2 [back]', () => {
    const s = buildSpecializationSchedule(undefined, ['chest'], true, 16, [
      { weekStart: 1, weekEnd: 8, targets: ['chest', 'biceps'] },
      { weekStart: 9, weekEnd: 16, targets: ['back'] },
    ]);
    expect(s.blocks).toEqual([
      { weekStart: 1, weekEnd: 8, targets: ['chest', 'biceps'] },
      { weekStart: 9, weekEnd: 16, targets: ['back'] },
    ]);
  });

  it('явные блоки: пропуски заполняются балансом, концы клампятся, канонизация целей', () => {
    const s = buildSpecializationSchedule(undefined, ['chest'], true, 12, [
      { weekStart: 3, weekEnd: 6, targets: ['chest_upper', 'biceps', 'biceps'] },
      { weekStart: 9, weekEnd: 99, targets: ['back_width'] },
    ]);
    expect(s.blocks).toEqual([
      { weekStart: 1, weekEnd: 2, targets: [] },
      { weekStart: 3, weekEnd: 6, targets: ['chest', 'biceps'] },
      { weekStart: 7, weekEnd: 8, targets: [] },
      { weekStart: 9, weekEnd: 12, targets: ['back'] },
    ]);
  });

  it('specialization без слабых групп — расписание неактивно (полный баланс)', () => {
    const s = buildSpecializationSchedule(undefined, [], true, 12);
    expect(s.active).toBe(false);
    expect(s.blocks).toEqual([{ weekStart: 1, weekEnd: 12, targets: [] }]);
  });

  it('specResForWeekSchedule: цели в блоке, баланс вне блока', () => {
    const s = buildSpecializationSchedule(undefined, ['chest'], true, 16);
    expect(specResForWeekSchedule(s, 10).targets).toEqual(['chest']);
    expect(specResForWeekSchedule(s, 11).active).toBe(false);
    expect(specResForWeekSchedule(s, 11).targets).toEqual([]);
  });

  it('specializationScheduleText: читаемое описание блоков', () => {
    const s = buildSpecializationSchedule(undefined, ['chest'], true, 16);
    expect(specializationScheduleText(s)).toBe('нед 1-10 [chest] → нед 11-16 баланс');
  });

  it('generic 12 нед: блок 1 [chest] → блок 2 [back] — объём переключается по неделям', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['chest'], specialization: true,
      specializationSchedule: [
        { weekStart: 1, weekEnd: 8, targets: ['chest'] },
        { weekStart: 9, weekEnd: 12, targets: ['back'] },
      ],
    });
    const vol = (w: number, m: string) => plan.weeklyVolume?.[w]?.[m]?.directSets || 0;
    // Блок 1: chest — цель (акцент), back — поддерживающий объём.
    expect(vol(1, 'chest')).toBeGreaterThan(vol(1, 'back'));
    // Блок 2: back выходит на MAV+10% (выше, чем в блоке 1), chest возвращается к балансу.
    expect(vol(11, 'back')).toBeGreaterThan(vol(1, 'back'));
    // Рациональе описывает блоки.
    expect(plan.rationale.some(r => r.includes('Специализация (блоки)'))).toBe(true);
    expect(plan.rationale.some(r => r.includes('нед 1-8') && r.includes('нед 9-12'))).toBe(true);
  }, 30000);

  it('generic 12 нед: продолжение тех же мышц (блок 2 = блок 1)', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['chest'], specialization: true,
      specializationSchedule: [
        { weekStart: 1, weekEnd: 8, targets: ['chest'] },
        { weekStart: 9, weekEnd: 12, targets: ['chest'] },
      ],
    });
    const vol = (w: number, m: string) => plan.weeklyVolume?.[w]?.[m]?.directSets || 0;
    // Акцент chest сохраняется в обоих блоках; в блоке 1 он строго выше back.
    expect(vol(1, 'chest')).toBeGreaterThan(vol(1, 'back'));
    expect(vol(11, 'chest')).toBeGreaterThanOrEqual(vol(11, 'back'));
  }, 30000);

  it('generic 12 нед: после блока — баланс (неделя 11 без спец-целей)', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'intermediate', trainingYears: 3,
      goal: 'mass', weeks: 12, workMax: WM,
      weakPoints: ['chest'], specialization: true,
      specializationSchedule: [
        { weekStart: 1, weekEnd: 8, targets: ['chest'] },
        { weekStart: 9, weekEnd: 12, targets: [] },
      ],
    });
    const vol = (w: number, m: string) => plan.weeklyVolume?.[w]?.[m]?.directSets || 0;
    // Баланс: back (ранее поддерживающий) возвращается к MAV.
    expect(vol(11, 'back')).toBeGreaterThan(vol(1, 'back'));
    expect(plan.rationale.some(r => r.includes('нед 9-12 баланс'))).toBe(true);
  }, 30000);

  it('cycle-путь: расписание блоков в rationale и валидный план', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'intermediate', trainingYears: 3,
      mode: 'adapt', weakPoints: ['chest'], specialization: true,
      specializationSchedule: [
        { weekStart: 1, weekEnd: 4, targets: ['chest'] },
        { weekStart: 5, weekEnd: 99, targets: [] },
      ],
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    expect(plan.rationale.some(r => r.includes('Специализация (блоки)'))).toBe(true);
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.validation?.valid).not.toBe(false);
  }, 30000);
});
