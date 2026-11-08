import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';

/**
 * Регресс владельца (2026-11): «спина недобор в ППЛ на про уровне»,
 * «нет прогрессии нагрузок и объёма».
 *
 * 1) Natural advanced PPL 2×Pull: недельная цель спины 28, но generic-путь
 *    держал 20–26 — prioritizeBackSessions гейтился enhanced+onCourse.
 * 2) Авто-taper резал последние 3 рабочие недели mass-мезоцикла (×1.0/×0.75/
 *    ×0.50) сразу после делода — объём падал вместо выхода на пик.
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
  glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
  delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
  adductors: 60, neck: 40,
};

const base = (over: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
  patternId: 'ppl_6',
  level: 'advanced',
  trainingYears: 6,
  goal: 'mass',
  weeks: 12,
  workMax: WM,
  weakPoints: [],
  volumeGoal: 'mav',
  rotationMode: 'forbid',
  ...over,
} as BBBuilderInput);

const workingWeeks = (plan: any) =>
  plan.weeks.filter((w: any) => w.phase !== 'deload' && w.deload !== true && !w.taperApplied && !w.taper);

const weeklySets = (w: any) =>
  w.sessions.flatMap((s: any) => s.exercises)
    .filter((e: any) => !e.warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0);

const backSets = (w: any) =>
  w.sessions.flatMap((s: any) => s.exercises)
    .filter((e: any) => e.muscle === 'back' && !e.warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0);

const pullBackSets = (w: any) =>
  w.sessions
    .filter((s: any) => /Pull|Back/i.test(String(s.sessionTag || '')))
    .map((s: any) => s.exercises
      .filter((e: any) => e.muscle === 'back' && !e.warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0));

describe('BB advanced hypertrophy: спина и прогрессия объёма', () => {
  it('PPL advanced mass: авто-taper выключен — финальный блок не режется', () => {
    const plan = buildBBPlan(base());
    expect(plan.weeks.filter((w: any) => w.taperApplied === true)).toEqual([]);
  });

  it('PPL advanced mass: последние рабочие недели блока растут по объёму', () => {
    const plan: any = buildBBPlan(base());
    // Рабочие недели после предпоследнего делода (W8) — финальный блок.
    const deloads = plan.weeks
      .map((w: any, i: number) => (w.phase === 'deload' || w.deload === true) ? i : -1)
      .filter((i: number) => i >= 0);
    const prevDeload = deloads[deloads.length - 2] ?? -1;
    const block = plan.weeks.slice(prevDeload + 1)
      .filter((w: any) => w.phase !== 'deload' && w.deload !== true);
    expect(block.length).toBeGreaterThanOrEqual(2);
    const totals = block.map(weeklySets);
    // Финальная неделя блока — пик: выше первой рабочей недели после делода.
    expect(totals[totals.length - 1]).toBeGreaterThan(totals[0]);
    for (let i = 1; i < totals.length; i++) {
      // Допускаем ±1 сет целочисленного шума, но не обвал taper-кривой.
      expect(totals[i], `W${block[i].week} не должен терять объём против W${block[i - 1].week}`)
        .toBeGreaterThanOrEqual(totals[i - 1] * 0.95);
    }
  });

  it('PPL advanced mass: пик спины достигает недельной цели 28', () => {
    const plan: any = buildBBPlan(base());
    const target = Number(plan.volumeTargets?.back?.targetSets) || 0;
    const peakBack = Math.max(...workingWeeks(plan).map(backSets));
    expect(target).toBeGreaterThanOrEqual(28);
    expect(peakBack).toBeGreaterThanOrEqual(28);
    // В пиковой неделе обе тяговые сессии добиты до per-session канона 14.
    const peakWeek = workingWeeks(plan).find((w: any) => backSets(w) === peakBack)!;
    const perPull = pullBackSets(peakWeek);
    expect(perPull.length).toBe(2);
    for (const sets of perPull) expect(sets).toBeGreaterThanOrEqual(14);
  });

  it('autoTaper включён только для strength_mass; mass — выключен', () => {
    const mass: any = buildBBPlan(base());
    const strength: any = buildBBPlan(base({ goal: 'strength_mass' }));
    expect(mass.buildContext?.autoTaper).toBe(false);
    expect(strength.buildContext?.autoTaper).toBe(true);
  });
});
