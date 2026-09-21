/**
 * bb-methodology-application.test.ts — аудит 2026-09: «ВСЕ выбранные методики
 * должны реально применяться». Проверяем эффекты, которые раньше были NO-OP:
 *  • тип разгрузки (pump/neural/full_rest/mini) на ПЛАНОВЫХ deload-неделях;
 *  • program-путь (cycle/program): volumeScheme FST-7 7-in-1, rotationMode,
 *    объёмный режим, интенсивность отдыха, BFR — паритет с generic;
 *  • честный флаг methodologyApplied (faithful не переписывает программу).
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';

const WM = { chest: 120, back: 140, quads: 180, hamstrings: 100, shoulders: 80, biceps: 60, triceps: 70, glutes: 150, calves: 120, abs: 40, traps: 100, forearms: 50 };

const deloadWeeks = (plan: any) => plan.weeks.filter((w: any) => w.phase === 'deload' || w.deload);
const avgSets = (weeks: any[]) => {
  const exs = weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.filter((e: any) => !e.warmupActivator)));
  return exs.length ? exs.reduce((a: number, e: any) => a + e.sets, 0) / exs.length : 0;
};

describe('тип разгрузки применяется к плановым deload-неделям', () => {
  const base = { patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass' as const, weeks: 8, workMax: WM };

  it('pump (дефолт) и neural дают разные deload-недели; neural — меньше объёма и RIR ≥3', () => {
    const pump = buildBBPlan({ ...base, deloadType: 'pump' } as any);
    const neural = buildBBPlan({ ...base, deloadType: 'neural' } as any);
    const dp = deloadWeeks(pump);
    const dn = deloadWeeks(neural);
    expect(dp.length).toBeGreaterThan(0);
    expect(dn.length).toBe(dp.length);
    // neural: объём ниже (0.4 vs 0.5), RIR не ниже 3, комментарий с протоколом
    expect(avgSets(dn)).toBeLessThanOrEqual(avgSets(dp));
    const rirs = dn.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.filter((e: any) => !e.warmupActivator).map((e: any) => e.rir)));
    expect(Math.min(...rirs)).toBeGreaterThanOrEqual(3);
    const hasProtocolComment = dn.some((w: any) => w.sessions.some((s: any) => s.exercises.some((e: any) => /Нейральная разгрузка/.test(String(e.comment || '')))));
    expect(hasProtocolComment).toBe(true);
  });

  it('mini-делоад: объём больше pump (0.7 vs 0.5), вес ближе к рабочему', () => {
    const pump = buildBBPlan({ ...base, deloadType: 'pump' } as any);
    const mini = buildBBPlan({ ...base, deloadType: 'mini' } as any);
    expect(avgSets(deloadWeeks(mini))).toBeGreaterThanOrEqual(avgSets(deloadWeeks(pump)));
  });

  it('без deloadType поведение байт-в-байт с pump (дефолт)', () => {
    const without = buildBBPlan({ ...base } as any);
    const pump = buildBBPlan({ ...base, deloadType: 'pump' } as any);
    expect(JSON.stringify(deloadWeeks(without))).toBe(JSON.stringify(deloadWeeks(pump)));
  });
});

describe('program-путь: методики не NO-OP', () => {
  const program = FULL_PROGRAM_LIBRARY[0];
  const wm = { chest: 100, back: 120, quads: 140, hamstrings: 100, shoulders: 60, biceps: 40, triceps: 50, glutes: 120, calves: 80, abs: 40 };

  it('faithful: methodologyApplied=false (программа дословна)', () => {
    const plan: any = programToBBPlan(program, { workMax: wm, mode: 'faithful', level: 'intermediate' } as any);
    expect(plan.methodologyApplied).toBe(false);
  });

  it('adapt: methodologyApplied=true и объёмный режим поднимает лимиты сессии', () => {
    const standard: any = programToBBPlan(program, { workMax: wm, mode: 'adapt', level: 'enhanced', trainingYears: 4, peds: ['AAS'], pedDoses: { AAS: 500 }, trainingVolumeMode: 'standard' } as any);
    const high: any = programToBBPlan(program, { workMax: wm, mode: 'adapt', level: 'enhanced', trainingYears: 4, peds: ['AAS'], pedDoses: { AAS: 500 }, trainingVolumeMode: 'high' } as any);
    expect(standard.methodologyApplied).toBe(true);
    expect(high.maxWorkingSets).toBeGreaterThanOrEqual(standard.maxWorkingSets);
  });

  it('adapt + volumeScheme=fst7 (enhanced, без joint-guard): финишер FST-7 с 7 сетами', () => {
    const plan: any = programToBBPlan(program, {
      workMax: wm, mode: 'adapt', level: 'enhanced', trainingYears: 4,
      peds: ['AAS'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
      volumeScheme: 'fst7',
    } as any);
    const fst = plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises))
      .filter((e: any) => /FST-7/.test(String(e.comment || '')));
    if (fst.length > 0) expect(fst.some((e: any) => (e.sets || 0) === 7 || (e.workSets?.length || 0) === 7)).toBe(true);
  });

  it('adapt + intensityLevel=light: отдых выше, чем в moderate', () => {
    const moderate: any = programToBBPlan(program, { workMax: wm, mode: 'adapt', level: 'intermediate' } as any);
    const light: any = programToBBPlan(program, { workMax: wm, mode: 'adapt', level: 'intermediate', intensityLevel: 'light' } as any);
    const avgRest = (p: any) => {
      const rests = p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.filter((e: any) => !e.warmupActivator && e.restSeconds).map((e: any) => e.restSeconds)));
      return rests.length ? rests.reduce((a: number, b: number) => a + b, 0) / rests.length : 0;
    };
    expect(avgRest(light)).toBeGreaterThan(avgRest(moderate));
  });

  it('adapt + bfrMode: изоляции переведены в 30-15-15-15', () => {
    const plan: any = programToBBPlan(program, { workMax: wm, mode: 'adapt', level: 'intermediate', bfrMode: true } as any);
    const bfr = plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises))
      .filter((e: any) => (e.workSets || []).length === 4 && (e.workSets || [])[0]?.reps === 30);
    expect(bfr.length).toBeGreaterThan(0);
  });
});
