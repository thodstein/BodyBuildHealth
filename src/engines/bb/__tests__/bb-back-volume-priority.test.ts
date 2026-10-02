import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';
import { aggregateBBVolume } from '../bb-volume.engine';

/**
 * Лок раунда «про-объём спины циклового пути» (владелец: enhanced+PED должен
 * давать спине ~30 сетов/СЕССИЮ ≈ 60/нед при 2 тяговых).
 *
 * Что зафиксировано:
 *  1) Тяги в наклоне/верхнем блоке не попадают в hamstrings (баг `тяга.*прям`
 *     матчил «(прямой хват)» → спина теряла упражнения, хамсы получали чужой MRV).
 *  2) Прогон расширения не блокируется пред-переливом несвязанной мышцы
 *     (трицепс 34.1 при капе 34 навсегда останавливал добор спины на W3+).
 *  3) PRO+ФАРМА: тяговая сессия добивает спину до per-session канона (30) за счёт
 *     не-спинных доноров дня; суммарный объём сессии не растёт.
 *  4) Без курса приоритет НЕ включается (прежнее поведение), капы спины не подняты.
 */

const WORKMAX = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};
const PED_STACK = {
  peds: ['AAS', 'GH', 'insulin'],
  pedDoses: { AAS: 500, GH: 4, insulin: 10 },
  courseIntensity: 'moderate' as const,
};

function buildPpl(id: string, extra: Record<string, unknown>) {
  const cycle = LMS_CYCLES.find(x => x.meta.id === id);
  if (!cycle) throw new Error(`cycle not found: ${id}`);
  return programToBBPlan(cycleTemplateToFullProgram(cycle), {
    workMax: WORKMAX, level: 'enhanced', trainingYears: 9, mode: 'adapt', sex: 'male', goal: 'mass', ...extra,
  } as never) as any;
}

const workingWeeks = (plan: any) => plan.weeks.filter((w: any) => w.phase !== 'deload' && !w.taper && !w.taperApplied);
const backDirect = (w: any) => w.sessions
  .flatMap((s: any) => s.exercises)
  .filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator)
  .reduce((a: number, e: any) => a + (e.sets || 0), 0);
const backPerSession = (w: any) => w.sessions
  .map((s: any) => s.exercises.filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0))
  .filter((x: number) => x > 0);

describe('ББ-авто: про-объём спины в цикловом пути (owner-канон 30/сессию)', () => {
  it('PPL-6 enhanced+PED: каждая тяговая сессия ≥27 прямых сетов спины (было ~19–25)', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', PED_STACK);
    const weeks = workingWeeks(plan);
    expect(weeks.length).toBeGreaterThanOrEqual(3);
    for (const w of weeks) {
      const per = backPerSession(w);
      expect(per.length).toBe(2); // Pull A + Pull B
      for (const sets of per) expect(sets).toBeGreaterThanOrEqual(27);
      expect(backDirect(w)).toBeGreaterThanOrEqual(55);
    }
  });

  it('PPL-6 enhanced+PED: W3+ не проваливается (регресс guard over-cap: спина 0 сетов)', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', PED_STACK);
    const w3 = plan.weeks.find((w: any) => w.week === 3);
    expect(w3).toBeTruthy();
    expect(backDirect(w3)).toBeGreaterThanOrEqual(55);
  });

  it('тяги с «(прямой хват)»/«верхний блок (прямой)» — спина, НЕ hamstrings (Румынская — остаётся)', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', PED_STACK);
    const rows = /(?:прямой хват|верхнего блока|горизонтального блока|гантели в наклоне|Т-грифа|seal row)/i;
    const wrong = plan.weeks
      .flatMap((w: any) => w.sessions)
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'hamstrings' && rows.test(String(e.name || '')));
    expect(wrong).toEqual([]);
  });

  it('кап спины на курсе = owner-канон 60/нед (не ниже), effective ≤ кап×1.15', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', PED_STACK);
    expect(plan.mrvByMuscle?.back).toBe(60);
    for (const w of plan.weeks) {
      const vol = aggregateBBVolume(w.sessions) as any;
      expect((vol.back?.effectiveSets || 0)).toBeLessThanOrEqual(60 * 1.15 + 0.01);
    }
  });

  it('bro-5 enhanced+PED: спина добита (было 17.5/нед — теперь ≥27 за единственный Pull)', () => {
    const plan = buildPpl('cycle-bb-m-bro-5', PED_STACK);
    for (const w of workingWeeks(plan)) {
      const per = backPerSession(w);
      expect(per.length).toBe(1);
      expect(per[0]).toBeGreaterThanOrEqual(27);
    }
  });

  it('без курса приоритет выключен: кап спины прежний (32), сессии не раздуты', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', {});
    expect(plan.mrvByMuscle?.back).toBe(32);
    for (const w of workingWeeks(plan)) {
      for (const sets of backPerSession(w)) expect(sets).toBeLessThanOrEqual(25);
    }
  });

  it('донорская политика: список доноров дня не опускается ниже 2 сетов', () => {
    const plan = buildPpl('cycle-bb-m-ppl-6', PED_STACK);
    for (const w of workingWeeks(plan)) {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          if ((e as any).warmupActivator) continue;
          expect(e.sets || 0).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
