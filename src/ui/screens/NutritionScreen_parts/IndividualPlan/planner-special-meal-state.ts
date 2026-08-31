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
import type { DrugInjection } from "./types";

export interface PlannerSpecialMealStateDeps {
  isTrainDay: (offset: number) => boolean;
  allergens: string[];
  dietPrefs: string[];
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

export function usePlannerSpecialMealState(d: PlannerSpecialMealStateDeps): PlannerSpecialMealState {
  const [specialMealMode, setSpecialMealMode] = useState(false);
  const [specialMealGoal, setSpecialMealGoal] = useState('custom');
  const [specialMealProteinG, setSpecialMealProteinG] = useState(40);
  const [specialMealFatG, setSpecialMealFatG] = useState(15);
  const [specialMealCarbsG, setSpecialMealCarbsG] = useState(50);
  const [specialMealTiming, setSpecialMealTiming] = useState('snack');
  const [specialMealReplaceMode, setSpecialMealReplaceMode] = useState(false);
  const [specialMealReplaceTarget, setSpecialMealReplaceTarget] = useState('Ужин');
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
  const _smExcludedIds = [...resolveAllExcludedFoodIds(FOOD_DB, d.allergens || [], d.dietPrefs || [])];

  const generateCheatMeal = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCheatMealPlan(generateCheatMealSm(_smDeps)); };
  const generateCarbload = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCarbloadPlan(generateCarbloadSm(_smDeps)); };
  const generateBUTCH = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setButchPlan(generateBUTCHSm(_smDeps)); };
  const generateCravingPlan = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCravingPlan(generateCravingPlanSm(_smDeps)); };
  const generateLazyDayPlan = () => { const _smDeps = { weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, goal: d.goal, cravingDays: d.cravingDays, lazyDayDays: d.lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setLazyDayPlan(generateLazyDayPlanSm(_smDeps)); };

  const generateRecommendations = () => {
    if (d.plannerModeRef.current !== 'pro') { setRecommendations([]); return; }
    setRecommendations(buildRecommendations({ goal: d.goal, phase: d.phase, weight: d.weight, effectiveKcal: d.effectiveKcal, effectiveP: d.effectiveP, effectiveF: d.effectiveF, effectiveC: d.effectiveC, injections: Array.isArray(d.injections) ? d.injections : [], linkToTraining: d.linkToTraining, trainStart: d.trainStart, trainEnd: d.trainEnd, sex: d.sex, bodyFatPct: d.bodyFatPct, trainType: d.trainType, v2Phase: d.v2Phase, v2Pharma: d.v2Pharma && typeof d.v2Pharma === 'object' ? d.v2Pharma : {}, v2Labs: d.v2Labs && typeof d.v2Labs === 'object' ? d.v2Labs : {}, histamineSensitive: d.histamineSensitive, generated: d.generated, planDays: d.planDays, dayPlan: d.dayPlan, threeDayPlan: d.threeDayPlan, weekPlan: d.weekPlan, carbPeriodization: d.carbPeriodization }));
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
