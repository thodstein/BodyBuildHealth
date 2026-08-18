import { describe, expect, it } from 'vitest';
import {
  buildSpecializationSchedule,
  tradeoffForWeek,
  specializationScheduleText,
} from '../bb-specialization.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { aggregateBBVolume } from '../bb-volume.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';
import { rankBBSplits } from '../bb-selector.engine';

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
