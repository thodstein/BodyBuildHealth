/**
 * planner-special-meal-state.ts — Хвост-1 (god-component рефактор): спец-приёмы,
 * спец-планы (чимил/карб-загрузка/БУЧ/сладкое/ленивый день) и рекомендации.
 *
 * Раньше ~14 useState + 6 генераторов + 1 авто-эффект жили прямо в
 * IndividualPlanContext (~3500 строк). Этот кластер изолирован: состояние локально,
 * зависит от узкого набора входов, генераторы — чистые функции из planner-special-meals
 * и planner-recommendations.
 *
 * API не меняется: хук возвращает те же имена, provider раскладывает их в единый PlanCtx.
 * Потребители (`usePlanCtx()` → `ctx as any`) не меняются.
 */
import { useState, useEffect } from "react";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { generateCheatMeal as generateCheatMealSm, generateCarbload as generateCarbloadSm, generateBUTCH as generateBUTCHSm, generateCravingPlan as generateCravingPlanSm, generateLazyDayPlan as generateLazyDayPlanSm } from "./planner-special-meals";
import { buildRecommendations } from "./planner-recommendations";
import { resolveAllExcludedFoodIds } from "./planner-restrictions";
import { matchesCategoryPref } from "./planner-preferences";
import type { DrugInjection } from "./types";

/**
 * P1-fix («показано = применяется»): «Время приёма» спецприёма раньше жило только
 * подписью в карточке — движок о нём не знал. Теперь это ЕДИНЫЙ словарь
 * «время → метка приёма» для замены (движок матчит targetLabel по метке), и
 * `effectiveSpecialMealTarget` даёт фактическую цель: явный выбор «Заменить приём»
 * приоритетнее, иначе — выбранное время.
 */
export const SPECIAL_MEAL_TIMING_TARGETS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  before_bed: 'Перед сном',
};

export function effectiveSpecialMealTarget(replaceTarget: string, timing: string): string {
  return replaceTarget || SPECIAL_MEAL_TIMING_TARGETS[timing] || '';
}

export interface PlannerSpecialMealStateDeps {
  isTrainDay: (offset: number) => boolean;
  allergens: string[];
  dietPrefs: string[];
  /** P1-10: явные исключения пользователя (he_excluded_foods) — спецприёмы должны их уважать. */
  excludedFoods?: string[];
  /** P1-10: исключённые категории продуктов. */
  excludedCategories?: string[];
  plannerModeRef: React.MutableRefObject<string>;
  goal: string;
  phase: string;
  weight: number;
  effectiveKcal: number;
  effectiveP: number;
  effectiveF: number;
  effectiveC: number;
  cravingDays: number;
  lazyDayDays: number;
  injections: DrugInjection[];
  linkToTraining: boolean;
  trainStart: string;
  trainEnd: string;
  sex: 'male' | 'female';
  bodyFatPct: number;
  trainType: string;
  v2Phase: string;
  v2Pharma: Record<string, boolean>;
  v2Labs: Record<string, string>;
  histamineSensitive: boolean;
  generated: boolean;
  planDays: 1 | 3 | 7;
  dayPlan: any;
  threeDayPlan: any;
  weekPlan: any;
  carbPeriodization: string;
}

export interface PlannerSpecialMealState {
  specialMealMode: boolean; setSpecialMealMode: (v: boolean) => void;
  specialMealGoal: string; setSpecialMealGoal: (v: string) => void;
  specialMealProteinG: number; setSpecialMealProteinG: (v: number) => void;
  specialMealFatG: number; setSpecialMealFatG: (v: number) => void;
  specialMealCarbsG: number; setSpecialMealCarbsG: (v: number) => void;
  specialMealTiming: string; setSpecialMealTiming: (v: string) => void;
  specialMealReplaceMode: boolean; setSpecialMealReplaceMode: (v: boolean) => void;
  specialMealReplaceTarget: string; setSpecialMealReplaceTarget: (v: string) => void;
  cheatMealPlan: any; setCheatMealPlan: (v: any) => void;
  carbloadPlan: any; setCarbloadPlan: (v: any) => void;
  butchPlan: any; setButchPlan: (v: any) => void;
  cravingPlan: any; setCravingPlan: (v: any) => void;
  lazyDayPlan: any; setLazyDayPlan: (v: any) => void;
  recommendations: string[]; setRecommendations: (v: string[]) => void;
  generateCheatMeal: () => void;
  generateCarbload: () => void;
  generateBUTCH: () => void;
  generateCravingPlan: () => void;
  generateLazyDayPlan: () => void;
  generateRecommendations: () => void;
}

const SPECIAL_MEAL_GOALS = ['pre_workout', 'post_workout', 'before_bed', 'high_protein', 'keto', 'low_cal_day', 'custom'];

/**
 * P1-10: единый набор id, запрещённых для спецприёмов (читмил/БУЧ/углеводная
 * загрузка/тяга/ленивый день). Раньше учитывались только аллергены + dietPrefs,
 * поэтому спецприём мог предложить продукт из «Исключения» или запрещённую категорию.
 */
export function resolveSpecialMealExcludedIds(
  allergens: string[],
  dietPrefs: string[],
  excludedFoods: string[] = [],
  excludedCategories: string[] = [],
): string[] {
  const s = new Set<string>(resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || []));
  for (const id of excludedFoods || []) s.add(id);
  const categoryPref = { preferred: [] as string[], excluded: excludedCategories || [] };
  for (const f of FOOD_DB) if (!matchesCategoryPref(f, categoryPref)) s.add(f.id);
  return [...s];
}

export function usePlannerSpecialMealState(d: PlannerSpecialMealStateDeps): PlannerSpecialMealState {
  // FIX persist-audit (B5): конфиг спецприёма не сохранялся — после перезагрузки
  // сбрасывался на дефолт (соседний календарь «➕ Спецприём» персистится в he_special_meals).
  const _loadCfg = <T,>(key: string, fallback: T, valid?: (v: unknown) => boolean): T => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_planner_special_cfg') || 'null');
      if (raw && typeof raw === 'object' && raw[key] !== undefined && raw[key] !== null) {
        const v = raw[key];
        if (!valid || valid(v)) return v as T;
      }
    } catch {}
    return fallback;
  };
  const _bool = (v: unknown): boolean => typeof v === 'boolean';
  const _num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000;
  const _enum = (allowed: string[]) => (v: unknown): boolean => typeof v === 'string' && allowed.includes(v);
  const _str = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0 && v.length <= 60;
  const [specialMealMode, setSpecialMealMode] = useState(() => _loadCfg<boolean>('mode', false, _bool));
  const [specialMealGoal, setSpecialMealGoal] = useState(() => _loadCfg<string>('goal', 'custom', _enum(SPECIAL_MEAL_GOALS)));
  const [specialMealProteinG, setSpecialMealProteinG] = useState(() => _loadCfg<number>('proteinG', 40, _num));
  const [specialMealFatG, setSpecialMealFatG] = useState(() => _loadCfg<number>('fatG', 15, _num));
  const [specialMealCarbsG, setSpecialMealCarbsG] = useState(() => _loadCfg<number>('carbsG', 50, _num));
  const [specialMealTiming, setSpecialMealTiming] = useState(() => _loadCfg<string>('timing', 'snack', _enum(Object.keys(SPECIAL_MEAL_TIMING_TARGETS))));
  const [specialMealReplaceMode, setSpecialMealReplaceMode] = useState(() => _loadCfg<boolean>('replaceMode', false, _bool));
  const [specialMealReplaceTarget, setSpecialMealReplaceTarget] = useState(() => _loadCfg<string>('replaceTarget', 'Ужин', _str));
  useEffect(() => {
    try {
      localStorage.setItem('he_planner_special_cfg', JSON.stringify({
        mode: specialMealMode, goal: specialMealGoal, proteinG: specialMealProteinG,
        fatG: specialMealFatG, carbsG: specialMealCarbsG, timing: specialMealTiming,
        replaceMode: specialMealReplaceMode, replaceTarget: specialMealReplaceTarget,
      }));
    } catch {}
  }, [specialMealMode, specialMealGoal, specialMealProteinG, specialMealFatG, specialMealCarbsG, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget]);
  const [cheatMealPlan, setCheatMealPlan] = useState<any>(null);
  const [carbloadPlan, setCarbloadPlan] = useState<any>(null);
  const [butchPlan, setButchPlan] = useState<any>(null);
  const [cravingPlan, setCravingPlan] = useState<any>(null);
  const [lazyDayPlan, setLazyDayPlan] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // FIX train-bind: спец-режимы получают тренировочные дни как производный 7-дневный
  // массив (weekly/eod/pattern → единый формат boolean[7]).
  const _trainDaysArr = Array.from({ length: 7 }, (_, i) => d.isTrainDay(i));
  // FIX allergens-restrictions: спец-режимы уважают исключения пользователя
  // P1-10: сюда же — явные excludedFoods (раньше читмил/БУЧ/углеводная загрузка могли
  // предложить продукт, который пользователь сам исключил) и excludedCategories.
  const _smExcludedIds = resolveSpecialMealExcludedIds(d.allergens || [], d.dietPrefs || [], d.excludedFoods || [], d.excludedCategories || []);

  const generateCheatMeal = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCheatMealPlan(generateCheatMealSm(_smDeps)); };
  const generateCarbload = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCarbloadPlan(generateCarbloadSm(_smDeps)); };
  const generateBUTCH = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setButchPlan(generateBUTCHSm(_smDeps)); };
  const generateCravingPlan = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCravingPlan(generateCravingPlanSm(_smDeps)); };
  const generateLazyDayPlan = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setLazyDayPlan(generateLazyDayPlanSm(_smDeps)); };

  const generateRecommendations = () => {
    if (d.plannerModeRef.current !== 'pro') { setRecommendations([]); return; }
    setRecommendations(buildRecommendations({ goal: d.goal, phase: d.phase, weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, injections: Array.isArray(d.injections) ? d.injections : [], linkToTraining: d.linkToTraining, trainStart: d.trainStart, trainEnd: d.trainEnd, sex: d.sex, bodyFatPct: d.bodyFatPct, trainType: d.trainType, v2Phase: d.v2Phase, v2Pharma: d.v2Pharma && typeof d.v2Pharma === 'object' ? d.v2Pharma : {}, v2Labs: d.v2Labs && typeof d.v2Labs === 'object' ? d.v2Labs : {}, histamineSensitive: d.histamineSensitive, generated: d.generated, planDays: d.planDays, dayPlan: d.dayPlan, threeDayPlan: d.threeDayPlan, weekPlan: d.weekPlan, carbPeriodization: d.carbPeriodization, allergens: d.allergens || [], dietPrefs: d.dietPrefs || [], excludedFoods: d.excludedFoods || [], excludedCategories: d.excludedCategories || [] }));
  };

  useEffect(() => { if (d.generated && d.dayPlan) { try { generateRecommendations(); } catch (e: any) { try { console.warn('[Planner] recommendations useEffect failed:', e); } catch {} } } }, [Array.isArray(d.injections) ? d.injections.length : 0]);

  return {
    specialMealMode, setSpecialMealMode, specialMealGoal, setSpecialMealGoal,
    specialMealProteinG, setSpecialMealProteinG, specialMealFatG, setSpecialMealFatG,
    specialMealCarbsG, setSpecialMealCarbsG, specialMealTiming, setSpecialMealTiming,
    specialMealReplaceMode, setSpecialMealReplaceMode, specialMealReplaceTarget, setSpecialMealReplaceTarget,
    cheatMealPlan, setCheatMealPlan, carbloadPlan, setCarbloadPlan, butchPlan, setButchPlan,
    cravingPlan, setCravingPlan, lazyDayPlan, setLazyDayPlan,
    recommendations, setRecommendations,
    generateCheatMeal, generateCarbload, generateBUTCH, generateCravingPlan, generateLazyDayPlan,
    generateRecommendations,
  };
}
