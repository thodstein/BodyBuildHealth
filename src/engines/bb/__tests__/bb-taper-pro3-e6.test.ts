/**
 * bb-taper-pro3-e6.test.ts — PRO-3 Э6 «живой рацион = план»:
 *   D7 — display-таблица подготовки без фантомного дрейфа (равна живой математике);
 *   D16 — визуал чек-ина (peakWeek.visualAdjust) применяется к ЖИВЫМ целям рациона;
 *   Na — во все фазы, K/вода в note дня; recarb-календарь рефидов в UI (source-guard).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildBBContestPrepPlan,
  buildPeakWeek,
  configFromPlan,
  nutritionTargetsForPrepDate,
  recarbDaysForPlan,
  prepRefeedDates,
  PREP_SODIUM_BASE_MG,
  type BBContestPrepConfig,
  type BBContestPrepPlan,
  isoAddDays,
  isoToday,
} from '../bb-contest-prep.engine';
import { buildPrepCycle, buildPrepNutritionPlan, type PrepCycleConfig } from '../bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../bb-builder.engine';

const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: isoAddDays(isoToday(), 9 * 7), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});
const baseNutrition = { kcal: 3000, proteinG: 190, fatG: 70, carbsG: 330, waterMl: 3000, sodiumMg: PREP_SODIUM_BASE_MG };

describe('PRO-3 Э6/D7 — таблица подготовки без дрейфа', () => {
  it('недели подготовки равны живой математике (нет −120/2нед фантома)', () => {
    const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
    const pcCfg = {
      category: 'mens_physique', sex: 'male', accentMuscles: [], minimalMuscles: [],
      weeks: 12, taperWeeks: 2, showDate: isoAddDays(isoToday(), 12 * 7), level: 'intermediate',
      trainingYears: 4, equipment: EQ, workMax: { ...DEFAULT_WORKMAX }, enhanced: false, weightKg: 82,
      experienceLevel: 'intermediate',
    } as PrepCycleConfig;
    const r = buildPrepCycle(pcCfg);
    const table = buildPrepNutritionPlan(r.prepPlan, r.config);
    const prep = table.weeks.filter(w => w.phase === 'preparation');
    expect(prep.length).toBeGreaterThanOrEqual(6);
    // без дрейфа: все недели подготовки одной калорийности (final — ×0.97 ниже)
    expect(new Set(prep.map(w => w.kcal)).size).toBe(1);
    expect(prep[0].note).toMatch(/держится по чек-инам/);
  });
});

describe('PRO-3 Э6/D16 — visualAdjust в живых целях', () => {
  const makePlan = (): BBContestPrepPlan => buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });

  it('flat → +75 г делится по load-дням; full/сброс → база', () => {
    const plan = makePlan();
    const days = recarbDaysForPlan(plan);
    const load = days.find(d => d.phase.startsWith('load'))!;
    const baseT = nutritionTargetsForPrepDate(load.date, plan, baseNutrition);
    expect(baseT.phase).toBe(load.phase);

    const flat: BBContestPrepPlan = { ...plan, peakWeek: { ...plan.peakWeek, visualAdjust: { visual: 'flat', at: '2026-09-16T07:00:00Z' } } };
    const adjT = nutritionTargetsForPrepDate(load.date, flat, baseNutrition);
    const loadsCount = days.filter(d => d.phase.startsWith('load')).length;
    expect(adjT.carbsG).toBe(baseT.carbsG + Math.trunc(75 / loadsCount));
    // и в самих днях видно пересчёт (mealNotes)
    const adjDays = recarbDaysForPlan(flat);
    expect(adjDays.find(d => d.phase.startsWith('load'))!.mealNotes.join(' ')).toMatch(/Live-пересчёт/);

    const full: BBContestPrepPlan = { ...plan, peakWeek: { ...plan.peakWeek, visualAdjust: { visual: 'full', at: 'x' } } };
    expect(nutritionTargetsForPrepDate(load.date, full, baseNutrition).carbsG).toBe(baseT.carbsG);
  });

  it('spill → −100 г (не ниже нуля), деплеция не тронута', () => {
    const plan = makePlan();
    const days = recarbDaysForPlan(plan);
    const load = days.find(d => d.phase.startsWith('load'))!;
    const dep = days.find(d => d.phase.startsWith('deplete'))!;
    const spill: BBContestPrepPlan = { ...plan, peakWeek: { ...plan.peakWeek, visualAdjust: { visual: 'spill', at: 'x' } } };
    const loadAdj = nutritionTargetsForPrepDate(load.date, spill, baseNutrition);
    expect(loadAdj.carbsG).toBe(Math.max(0, load.carbsG - Math.trunc(100 / days.filter(d => d.phase.startsWith('load')).length)));
    const depAdj = nutritionTargetsForPrepDate(dep.date, spill, baseNutrition);
    expect(depAdj.carbsG).toBe(dep.carbsG);
  });
});

describe('PRO-3 Э6 — Na во все фазы + K в note', () => {
  it('подготовка: Na = PREP_SODIUM_BASE_MG, K в подписи дня', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    const mid = isoAddDays(plan.preparation.startDate, 10);
    const t = nutritionTargetsForPrepDate(mid, plan, baseNutrition);
    expect(t.phase).toBeNull();
    expect(t.sodiumMg).toBe(PREP_SODIUM_BASE_MG);
    expect(t.note).toMatch(/Na 2800 мг/);
    expect(t.note).toMatch(/K 4000 мг/);
  });
});

describe('PRO-3 Э6 — UI source-guard', () => {
  it('recarb едет в план (нет he_peak_recarb), календарь рефидов на месте, Na без гейта фазы', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    const ctx = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'NutritionScreen_parts', 'IndividualPlan', 'IndividualPlanContext.tsx'), 'utf8');
    expect(sec).not.toMatch(/he_peak_recarb/);
    expect(sec).toMatch(/visualAdjust: \{ visual: liveVisual/);
    expect(sec).toMatch(/data-bb="recarb-reset"/);
    expect(sec).toMatch(/data-bb="refeed-calendar"/);
    expect(sec).toContain('prepRefeedDates');
    expect(ctx).toMatch(/sodiumTargetOverride: _peakTargets \? _peakTargets\.sodiumMg : undefined/);
  });
});
