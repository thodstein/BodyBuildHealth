import React, { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB, FOOD_ALLERGEN_DIET, compositeQualityScore } from "../../../../core/nutrition-database";
import { PHARMA_DB } from "../../../../core/pharma-database";
import { updateProfile, getProfile } from "../../../../core/profile-manager";
import { getRecipes, getRecipesByMeal, type Recipe } from "../../../../engines/nutrition-periodization.engine";
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type MealScoreV2 } from "../../../../engines/product-usefulness-v2.engine";
import { scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU, parseServingSizeGrams } from "../../../../engines/kbju-food-match.engine";
import type { NutritionReport } from "../../../../engines/nutrition-report.engine";
import type { UserProfile, LabPoint } from "../../../../core/types";
import { getContraindications, saveContraindications } from "../../../../core/contraindications";
import { updateSection } from "../../../../core/profile-manager";
import { getWeightLog, saveWeightLog } from "../../../../engines/profile-store";
import { getNutritionV2Data, saveNutritionV2Data } from "../../../../core/nutrition-v2-data";
import { ALL_SUBSTANCES } from "../../../../data/support-substances";
import { computePlannerTargets, contextualCarbCapGPerKg, plannerGoalCategory } from "./planner-targets";
import { buildDayTargets } from "./planner-day-targets";
import { applyCarbPeriodizationMods, carbPeriodizationLabel, isHeavyDayForOffset } from "./planner-carb-periodization";
import { microDeficitToPreferIds, diaasWeakLinkToPreferIds, repairDiaasWeakLinks } from "./planner-micro-pools";
import { applyMealTargetOverrides } from "./planner-meal-targets";
import { correctDayToTargets } from "./day-target-corrector";
import { safeWriteJSON, migratePlannerStorage } from "./planner-storage";
// P1-7: чистые функции отчётов вынесены в planner-report-state.ts (Хвост-1)
import { buildMealPrep } from "./planner-mealprep"; // P1-7: generateMealPrep вынесен
import { useRenderMealList } from "./MealListRender"; // P1-7: renderMealList вынесен
import { usePlannerReportState } from "./planner-report-state"; // Хвост-1: состояние отчётов вынесено в под-хук
import { usePlannerSpecialMealState } from "./planner-special-meal-state"; // Хвост-1: спец-режимы/рекомендации в под-хук
import { getAutoExcludedFoodIds } from "./OrganLoadBadges"; // P2-12: organ-load auto restrictions
import { loadReplaceHistory, recordReplacement, getDeprioritizedIds, clearReplaceHistory, expandRecipePreferred, type Specificity, type CategoryPref, type Intolerances, type TasteProfile } from "./planner-preferences"; // Bug-infra: квота-безопасная запись // Bug-4: чистая функция расчёта КБЖУ-целей
import { resolveAllExcludedFoodIds, countExcludedByAllergens, matchesSelectedAllergen, allergenTextMatches, getFoodAllergenTags, USER_ALLERGEN_TO_TAGS, dietRestrictionTags } from "./planner-restrictions"; // FIX allergens-restrictions: единый резолвер аллергенов/ограничений
import { DEFAULT_TRAIN_SCHEDULE, normalizeTrainSchedule, isTrainingDayFor, buildTrainSchedule, type TrainScheduleType, type TrainSchedule } from "./planner-training-schedule"; // FIX train-bind: плавающий график тренировок
import { decomposeRecipe, pickRecipeForMeal, pickRecipesForMeal, cookProfileFromSettings, prepTimeBudgetPerMeal, filterByCookSkill, type CookProfile } from "./recipe-engine";
import { kbjuFormulaDeviationPct, isMainMealLabel, mealTypeFromLabel, flattenRecipeOption, rebuildRecipeFromFlat, buildRecipeMealItems, sumMealTotals, sumDayTotals, pickRecipeOptions, rebalanceDayAfterRecipes, buildShoppingFromPlans, buildRecipeCookingPlan, collectAppliedRecipes, assembleRecipeDay, scaleRecipeToTarget, recipeCompatibility } from "./planner-recipe-mode";
import type { FlatRecipeOption } from "./planner-recipe-mode";
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
import type { LabCompositeResult } from "../../../../engines/lab-analysis.engine";
import { buildDayPlan as buildDayPlanV2, snapPortionG, type DayPlanV2, type MealPlanInput, type BreakfastStyle, type BreakfastTemplateId } from "./meal-plan-engine";
import { stapleFamilyOf } from "./food-availability";
import { getYesterdaySummary, computeCompensation, computeRollingCompensation, type CompensationResult } from "./planner-diary-adaptation";
import { getMenstrualPhaseNutrition, getCalciumTarget, calciumDoseSplitNote, getFemaleSupplementRules, type MenstrualPhase, getLifeStageNote, type LifeStage, computeEnergyAvailability } from "./planner-female-cycle";
import { autoCyclePhase, CYCLE_PHASE_RU } from "./planner-cycle-calendar";
import { addDayScore } from "../../../../engines/day-score-trend";
import { getBBCategory, type BBCategory, getCategoryDeficitMod, getCombinedDeficitMod } from "./planner-categories";
import { computePeakWeekNutritionTargets, deserializeBBPrepConfig, serializeBBPrepConfig, legacyConfigFromProfile, isoToday, isoAddDays, planFromStored, configFromPlan, nutritionTargetsForPrepDate, prepPhaseForDate, type BBContestPrepConfig, type BBContestPrepPlan } from "../../../../engines/bb/bb-contest-prep.engine";
import { saveContestPrepEverywhere, clearContestPrepEverywhere, migrateLegacyContestPrepIfNeeded, CONTEST_PREP_UPDATED_EVENT } from "../../../../engines/bb/bb-contest-prep-sync";
import { annualPlanPhaseForDate } from "../../../../engines/annual-training/block-builders.engine";
import { loadAnnualTrainingPlan } from "../../../../engines/annual-training/annual-training-storage";
import type { AnnualTrainingPlan, AnnualBlockState } from "../../../../engines/annual-training/annual-training.types";
import {
  GOALS, PHASES, BUDGET_LEVELS, PROTEIN_PRESETS, PLAN_TYPES,
  ALLERGEN_LIST, HEALTH_ISSUES,
  type GoalId, type PhaseId, type BudgetLevel, type NutritionLevel,
  type PlanType, type PlannerMode, type CarbPeriodization, type VarietyLevel,
} from "./types";
import type { DrugInjection, MealPrepStep, SavedPlan } from "./types";
import { getProfileSafe, GlassCard, PillBtn, inputStyle, selectStyle, greenBtn, reportPillStyle } from "./ui";
import { readDiaryV2, writeDiaryV2 } from "../diary-storage-v2";

export interface PlanCtx {
  profile: UserProfile | null;
  labs: LabPoint[];
  labAnalysis: LabCompositeResult | null | undefined;
  s: any;
  courseEntries: any[];
  weight: number; setWeight: (v: number) => void;
  height: number; setHeight: (v: number) => void;
  age: number; setAge: (v: number) => void;
  sex: 'male' | 'female'; setSex: (v: 'male' | 'female') => void;
  dailySteps: number; setDailySteps: (v: number) => void;
  cookTimeMin: number; setCookTimeMin: (v: number) => void;
  cookingSkill: 'basic' | 'medium' | 'advanced'; setCookingSkill: (v: 'basic' | 'medium' | 'advanced') => void;
  cookingFrequency: 'daily' | 'every_3_days' | 'weekly'; setCookingFrequency: (v: 'daily' | 'every_3_days' | 'weekly') => void;
  batchCooking: boolean; setBatchCooking: (v: boolean) => void;
  cravingMode: boolean; setCravingMode: (v: boolean) => void;
  cravingDays: number; setCravingDays: (v: number) => void;
  lazyDayMode: boolean; setLazyDayMode: (v: boolean) => void;
  lazyDayDays: number; setLazyDayDays: (v: number) => void;
  trainType: string; setTrainType: (v: any) => void;
  trainIntensity: string; setTrainIntensity: (v: any) => void;
  intraWorkoutEnabled: boolean; setIntraWorkoutEnabled: (v: boolean) => void;
  bodyFatPct: number; setBodyFatPct: (v: number) => void;
  sleepHours: number; setSleepHours: (v: number) => void;
  sleepQuality: number; setSleepQuality: (v: number) => void;
  stressLevel: number; setStressLevel: (v: number) => void;
  weightAdaptMode: boolean; setWeightAdaptMode: (v: boolean) => void;
  weightLogWeek: number[]; setWeightLogWeek: (v: number[]) => void;
  expectedLossKgWeek: number; setExpectedLossKgWeek: (v: number) => void;
  showWeightAdaptModal: boolean; setShowWeightAdaptModal: (v: boolean) => void;
  weightLogEntries: { date: string; weight: number }[]; setWeightLogEntries: (v: any) => void;
  weightLogPeriod: string; setWeightLogPeriod: (v: any) => void;
  metabolicAdaptEnabled: boolean; setMetabolicAdaptEnabled: (v: boolean) => void;
  metabolicAdaptPct: number; setMetabolicAdaptPct: (v: number) => void;
  manualGPerKg: Record<string, number>; setManualGPerKg: (v: any) => void;
  monthPlanMode: boolean; setMonthPlanMode: (v: boolean) => void;
  monthPlan: any[]; setMonthPlan: (v: any[]) => void;
  selectedWeek: number; setSelectedWeek: (v: number) => void;
  goal: GoalId; setGoal: (v: GoalId) => void;
  phase: PhaseId; setPhase: (v: PhaseId) => void;
  autoGoal: GoalId;
  goalUserSet: boolean; setGoalUserSet: (v: boolean) => void;
  injections: DrugInjection[]; setInjections: (v: any) => void;
  injName: string; setInjName: (v: string) => void;
  injTime: string; setInjTime: (v: string) => void;
  injDose: number; setInjDose: (v: number) => void;
  injUnit: string; setInjUnit: (v: string) => void;
  injType: string; setInjType: (v: string) => void;
  injEster: string; setInjEster: (v: any) => void;
  trainStart: string; setTrainStart: (v: string) => void;
  trainEnd: string; setTrainEnd: (v: string) => void;
  linkToTraining: boolean; setLinkToTraining: (v: boolean) => void;
  trainScheduleType: TrainScheduleType; setTrainScheduleType: (v: TrainScheduleType) => void;
  trainPattern: { work: number; off: number }; setTrainPattern: (v: { work: number; off: number }) => void;
  isTrainDay: (offset: number) => boolean;
  injectDrugTypes: string[];
  calcTargets: { kcal: number; protein: number; fats: number; carbs: number; bmr?: number; tdee?: number; adjustment?: number };
  profileTargets: any;
  effectiveKcal: number;
  effectiveP: number;
  effectiveF: number;
  effectiveC: number;
  /** Эпик A: человекочитаемый разбор целей (TDEE → модификаторы → макросы). */
  dayTargetsBreakdown: string[];
  carbCapClipped: boolean;
  carbCapGPerKg: number;
  kbjuMode: string; setKbjuMode: (v: any) => void;
  switchKbjuMode: (mode: any) => void;
  manualKcal: number | null; setManualKcal: (v: any) => void;
  manualP: number | null; setManualP: (v: any) => void;
  manualF: number | null; setManualF: (v: any) => void;
  manualC: number | null; setManualC: (v: any) => void;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  budget: BudgetLevel; setBudget: (v: BudgetLevel) => void;
  /** Эпик 3: белок-пресет (1.6-2.6 г/кг) — единственный «уровень белка» (legacy nutrLevel удалён). */
  proteinPreset: NutritionLevel; setProteinPreset: (v: NutritionLevel) => void;
  variety: string; setVariety: (v: any) => void;
  diaryAdaptation: boolean; setDiaryAdaptation: (v: boolean) => void;
  varietyStrictness: 'soft' | 'strict'; setVarietyStrictness: (v: 'soft' | 'strict') => void;
  /** v6: единое разнообразие (low/medium/high = variety+strictness) */
  varietyLevel: VarietyLevel; setVarietyLevel: (v: VarietyLevel) => void;
  wakeTime: string; setWakeTime: (v: string) => void;
  bedTime: string; setBedTime: (v: string) => void;
  lunchTime: string; setLunchTime: (v: string) => void;
  dinnerTime: string; setDinnerTime: (v: string) => void;
  mealsCount: number; setMealsCount: (v: number) => void;
  workFood: string; setWorkFood: (v: any) => void;
  morningTrainLoad: boolean; setMorningTrainLoad: (v: boolean) => void;
  allergens: string[]; setAllergens: (v: any) => void;
  healthIssues: string[]; setHealthIssues: (v: any) => void;
  eveningLowCarb: boolean; setEveningLowCarb: (v: boolean) => void;
  addMilkToBreakfast: boolean; setAddMilkToBreakfast: (v: boolean) => void;
  // G4: coconutOilBoost удалена из типа (мёртвая настройка — никогда не влияла на генерацию)
  breakfastStyle: BreakfastStyle; setBreakfastStyle: (v: BreakfastStyle) => void;
  breakfastTemplate: BreakfastTemplateId; setBreakfastTemplate: (v: BreakfastTemplateId) => void;
  planType: PlanType; setPlanType: (v: PlanType) => void;
  preferredFoods: string[]; setPreferredFoods: (v: any) => void;
  excludedFoods: string[]; setExcludedFoods: (v: any) => void;
  preferredByMeal: Record<string, string[]>; setPreferredByMeal: (v: any) => void;
  specificity: Specificity; setSpecificity: (v: Specificity) => void;
  intolerances: Intolerances; setIntolerances: (v: any) => void;
  tasteProfile: TasteProfile; setTasteProfile: (v: any) => void;
  excludedCategories: string[]; setExcludedCategories: (v: any) => void;
  allergenExcludedCount: number; setAllergenExcludedCount: (v: number) => void;
  planTargets: any; setPlanTargets: (v: any) => void;
  /** v6+ (Эпик 1): единая периодизация углеводов (legacy cyclingMode/dietPause/periodizationEnabled удалены). */
  carbPeriodization: CarbPeriodization; setCarbPeriodization: (v: CarbPeriodization) => void;
  heavyTrainDay: string; setHeavyTrainDay: (v: string) => void;
  workScheduleEnabled: boolean; setWorkScheduleEnabled: (v: boolean) => void;
  workStartTime: string; setWorkStartTime: (v: string) => void;
  workEndTime: string; setWorkEndTime: (v: string) => void;
  workDays: boolean[]; setWorkDays: (v: any) => void;
  workScheduleType: string; setWorkScheduleType: (v: string) => void;
  trainingDays: boolean[]; setTrainingDays: (v: any) => void;
  DAY_LABELS: string[];
  generated: boolean; setGenerated: (v: boolean) => void;
  planBusy: boolean;
  planDays: 1 | 3 | 7; setPlanDays: (v: 1 | 3 | 7) => void;
  selectedDayIndex: number; setSelectedDayIndex: (v: number) => void;
  planView: 'list' | 'calendar'; setPlanView: (v: 'list' | 'calendar') => void;
  dayPlan: any; setDayPlan: (v: any) => void;
  threeDayPlan: any; setThreeDayPlan: (v: any) => void;
  weekPlan: any; setWeekPlan: (v: any) => void;
  shoppingList: any; setShoppingList: (v: any) => void;
  waterCalc: any; setWaterCalc: (v: any) => void;
  savedPlans: SavedPlan[]; setSavedPlans: (v: any) => void;
  lockedFoodIds: Set<string>; toggleLockFood: (id: string) => void;
  expandedSavedId: number | null; setExpandedSavedId: (v: any) => void;
  editItem: any; setEditItem: (v: any) => void;
  editAmount: number; setEditAmount: (v: number) => void;
  replacingItem: any; setReplacingItem: (v: any) => void;
  recipePickerMeal: any; setRecipePickerMeal: (v: any) => void;
  mealPrep: any; setMealPrep: (v: any) => void;
  dayPlanNotes: string; setDayPlanNotes: (v: string) => void;
  draggedItem: any; setDraggedItem: (v: any) => void;
  dropTarget: number | null; setDropTarget: (v: any) => void;
  undoStack: any[]; setUndoStack: (v: any) => void;
  undoLast: () => void;
  weekEditDay: number | null;
  openWeekDayForEdit: (di: number) => void;
  switchPlanDays: (d: 1 | 3 | 7) => void;
  userRecipes: any[]; setUserRecipes: (v: any) => void;
  showRecipeCreator: boolean; setShowRecipeCreator: (v: boolean) => void;
  showAddDrug: boolean; setShowAddDrug: (v: boolean) => void;
  showDrugTypePicker: boolean; setShowDrugTypePicker: (v: boolean) => void;
  takenSupplements: string[]; setTakenSupplements: (v: any) => void;
  showSuppPicker: boolean; setShowSuppPicker: (v: boolean) => void;
  suppSearch: string; setSuppSearch: (v: string) => void;
  newRecipe: any; setNewRecipe: (v: any) => void;
  saveUndo: () => void;
  quickAddMealIdx: number | null; setQuickAddMealIdx: (v: number | null) => void;
  quickAddSearch: string; setQuickAddSearch: (v: string) => void;
  moveFoodItem: (a: number, b: number, c: number, dayIdx?: number) => void;
  findSimilarFoods: (item: any, count?: number) => any[];
  replaceFoodItem: (a: number, b: number, c: number, d: any) => void;
  updateItemAmount: (a: number, b: number, c: number, d: number) => void;
  removeFoodItem: (a: number, b: number, c: number) => void;
  replaceMealWithRecipe: (recipe: Recipe, mealIdx: number, dayIdx?: number) => void;
  addSecondRecipeToMeal: (recipe: Recipe, mealIdx: number, dayIdx: number) => void;
  addFoodToMeal: (dayIdx: number, mealIdx: number, food: any) => void;
addSnackComboToMeal: (dayIdx: number, mealIdx: number) => void;
  generatePlan: (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean; async?: boolean; overrides?: { mealsCount?: number } }) => void;
  /** Режим генерации: продукты (классика) или рецепты (основные приёмы из готовых рецептов). */
  generationMode: 'products' | 'recipes'; setGenerationMode: (v: 'products' | 'recipes') => void;
  /** ⭐ Избранные рецепты: имена + тумблер + проверка (бейдж в чипах, бонус скоринга). */
  favoriteRecipes: Set<string>; toggleFavoriteRecipe: (name: string) => void; isFavoriteRecipe: (name: string) => boolean;
  /** Выбрать один из 2–3 вариантов рецепта для приёма (режим «по рецептам») — приём пересобирается с авторскими порциями, день ребалансится до ±3%. */
  pickRecipeOption: (dayIdx: number, mealIdx: number, optionName: string) => void;
  /** «🔄 Другие варианты»: перегенерация пула кандидатов рецепта, исключая показанные. */
  moreRecipeOptions: (dayIdx: number, mealIdx: number) => void;
  /** 🔄 Другие рецепты: перегенерация чипов-подсказок дня, исключая уже показанные. */
  refreshRecipeSuggestions: (dayIdx?: number) => void;
  /** ♻️ Пропуск приёма: удалить приём и пересобрать день (ребаланс ±3%), синк закупок/готовки. */
  removeMealRebalanced: (dayIdx: number, mealIdx: number) => void;
  updateMealTime: (mealIdx: number, time: string) => void;
  duplicateMeal: (mealIdx: number) => void;
  toggleAllergen: (id: string) => void;
  toggleHealthIssue: (id: string) => void;
  loadSavedPlan: (plan: SavedPlan) => void;
  /** Загрузить значения из Профиля (UnifiedSettings) в локальные useState. */
  autofillFromProfile: () => void;
  /** Сохранить текущие локальные значения в Профиль (UnifiedSettings). */
  saveToProfile: () => void;
  generateCheatMeal: () => void;
  generateCarbload: () => void;
  generateBUTCH: () => void;
  generateCravingPlan: () => void;
  generateLazyDayPlan: () => void;
  generateRecommendations: () => void;
  autoCorrectPlan: () => void;
  saveCurrentPlan: () => void;
  /** FatSecret-уровень: 1-клик добавление текущего плана (день/выбранный день недели) в дневник питания */
  addPlanToDiary: (dateISO?: string) => boolean;
  generateMealPrep: () => void;
  mealPrepPlan: any;
  setMealPrepPlan: (v: any) => void;
  mealPrepDays: number; setMealPrepDays: (v: any) => void;
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
  surplusPct: number; setSurplusPct: (v: number) => void;
  recommendations: string[]; setRecommendations: (v: any) => void;
  activeReports: string[]; setActiveReports: (v: any) => void;
  allergenReport: any; setAllergenReport: (v: any) => void;
  nutrientReport: any; setNutrientReport: (v: any) => void;
  qualityReport: any; setQualityReport: (v: any) => void;
  riskReport: any; setRiskReport: (v: any) => void;
  drugCompatReport: any; setDrugCompatReport: (v: any) => void;
  nutritionReport: any; setNutritionReport: (v: any) => void;
  generateAllergenReport: () => void;
  generateNutrientReport: () => void;
  generateQualityReport: () => void;
  generateRiskReport: () => void;
  generateDrugCompatReport: () => void;
  generateFullNutritionReport: (planArg?: any, archive?: boolean) => void;
  renderMealList: (dayData: any, editable?: boolean, dayIdx?: number) => React.ReactNode;
  /** п.18: активный блок года для сегодня ({ week, block } | null) — карточка «📍 текущий блок года». */
  annualPhase: { week: number; block: AnnualBlockState } | null;
  /** Combat/Strength интеграция: payload питания от плана единоборств/силы */
  combatNutrition: any;
  cyclePhase: string; setCyclePhase: (v: any) => void;
  bbCategory: BBCategory; setBBCategory: (v: any) => void;
  peakWeekEnabled: boolean; setPeakWeekEnabled: (v: boolean) => void;
  peakWeekShowDay: number; setPeakWeekShowDay: (v: number) => void;
  /** Единая система тапера ББ (bb-contest-prep.engine): конфиг пикинг-недели. */
  bbPrepConfig: BBContestPrepConfig | null; setBBPrepConfig: (v: BBContestPrepConfig | null) => void;
  /** Сохранить конфиг в профиль и перегенерировать план питания с оверлеем. */
  applyBBPeakToPlan: (cfg: BBContestPrepConfig | null) => void;
  lifeStage: LifeStage; setLifeStage: (v: any) => void;
  householdActivity: string; setHouseholdActivity: (v: any) => void;
  customNotes: string; setCustomNotes: (v: string) => void;
  // v2 scoring profile
  v2Phase: string; setV2Phase: (v: string) => void;
  v2Labs: Record<string, string>; setV2Labs: (v: any) => void;
  v2Pharma: Record<string, boolean>; setV2Pharma: (v: any) => void;
  histamineSensitive: boolean; setHistamineSensitive: (v: boolean) => void;
  plannerMode: PlannerMode; setPlannerMode: (v: PlannerMode) => void;
  dietPrefs: string[]; setDietPrefs: (v: string[]) => void;
  errorMsg: string | null; setErrorMsg: (v: string | null) => void;
  // P0-2: useProEngine — всегда TRUE (мёртвый toggle удалён); защита от деградации — try/catch fallback на классический путь в generatePlan.
  // Cross-tab navigation: allows sub-tabs to switch to each other
  planTab: string; setPlanTab: (v: string) => void;
}

const _DEFAULT_CALC_TARGETS = { kcal: 2500, protein: 160, fats: 70, carbs: 300, bmr: 0, tdee: 0, adjustment: 0 };
const _DEFAULT_CTX: any = { calcTargets: _DEFAULT_CALC_TARGETS, profileTargets: _DEFAULT_CALC_TARGETS, effectiveKcal: 2500, effectiveP: 160, effectiveF: 70, effectiveC: 300, weight: 80, height: 180, age: 30, sex: 'male' as const, annualPhase: null };
const PlanContext = createContext<PlanCtx>(_DEFAULT_CTX as PlanCtx);
export const usePlanCtx = (): PlanCtx => useContext(PlanContext);

export const IndividualPlanProvider: React.FC<{ profile: UserProfile | null; course?: any[]; labs?: LabPoint[]; labAnalysis?: LabCompositeResult | null; children: React.ReactNode }> = ({ profile: _profile, course: _course, labs = [], labAnalysis, children }) => {
  // Run schema migration first — drops stale localStorage entries that would crash
  // with "cannot read properties of undefined (reading length)" on first render.
  try { migratePlannerStorage(); } catch {}
  const profile = _profile || getProfileSafe();
  const s = profile?.settings;
  const courseEntries = _course || [];

  const [weight, setWeight] = useState(s?.weight || 80);
  const [height, setHeight] = useState(s?.height || 180);
  const [age, setAge] = useState(s?.age || 30);
  const [sex, setSex] = useState<'male' | 'female'>(s?.sex || 'male');
  const [dailySteps, setDailySteps] = useState(s?.dailySteps || 8000);
  // FIX persist-settings: единый объект локальных предпочтений планировщика (he_planner_prefs).
  // Раньше ~24 настройки (бюджет, режим, время приёмов, цикл фазы и т.д.) сбрасывались при
  // перезагрузке — выбора пользователя не было ни в localStorage, ни в профиле.
  const _plannerPrefsRef = useRef<Record<string, any>>({});
  if (Object.keys(_plannerPrefsRef.current).length === 0) {
    try {
      const v = JSON.parse(localStorage.getItem('he_planner_prefs') || 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) _plannerPrefsRef.current = v;
    } catch {}
  }
  const _pf = _plannerPrefsRef.current;
  const [cookTimeMin, setCookTimeMin] = useState<number>(typeof _pf.cookTimeMin === 'number' ? _pf.cookTimeMin : 60);
  const [cookingSkill, setCookingSkill] = useState<'basic' | 'medium' | 'advanced'>((_pf as any).cookingSkill === 'advanced' ? 'advanced' : (_pf as any).cookingSkill === 'medium' ? 'medium' : 'basic');
  const [cookingFrequency, setCookingFrequency] = useState<'daily' | 'every_3_days' | 'weekly'>((_pf as any).cookingFrequency === 'weekly' ? 'weekly' : (_pf as any).cookingFrequency === 'every_3_days' ? 'every_3_days' : 'daily');
  const [batchCooking, setBatchCooking] = useState<boolean>(!!(_pf as any).batchCooking);
  const [cravingMode, setCravingMode] = useState<boolean>(!!_pf.cravingMode);
  const [cravingDays, setCravingDays] = useState<number>(typeof _pf.cravingDays === 'number' ? _pf.cravingDays : 1);
  const [lazyDayMode, setLazyDayMode] = useState<boolean>(!!_pf.lazyDayMode);
  const [lazyDayDays, setLazyDayDays] = useState<number>(typeof _pf.lazyDayDays === 'number' ? _pf.lazyDayDays : 1);
  // P1-fix (Aug 5 2026): читаем из UnifiedSettings через proxy, а НЕ из мёртвого localStorage
  // (после миграции he_surplus_pct удалён → default). Реальное значение в profile.nutrition.surplusPct.
  const [surplusPct, setSurplusPct] = useState<number>(() => {
    try {
      const v = (s as any)?.nutrition?.surplusPct;
      if (typeof v === 'number' && v > 0) return v;
      // Legacy fallback
      const legacy = localStorage.getItem('he_surplus_pct');
      if (legacy) {
        const n = parseInt(legacy);
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch {}
    return 10;
  });
  const [trainType, setTrainType] = useState<'strength' | 'cardio' | 'mixed' | 'hiit'>((['strength', 'cardio', 'mixed', 'hiit'] as const).includes(_pf.trainType as any) ? _pf.trainType : 'strength');
  const [trainIntensity, setTrainIntensity] = useState<'low' | 'medium' | 'high'>((['low', 'medium', 'high'] as const).includes(_pf.trainIntensity as any) ? _pf.trainIntensity : 'medium');
  // Этап 3 (Пробел-5): явный переключатель intra-workout (не жёстко 'high').
  // По умолчанию вкл.; доступен и для medium/low (движок сам гейтит по длительности ≥75 мин).
  const [intraWorkoutEnabled, setIntraWorkoutEnabled] = useState<boolean>(typeof _pf.intraWorkoutEnabled === 'boolean' ? _pf.intraWorkoutEnabled : true);
  const [householdActivity, setHouseholdActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active'>((['sedentary', 'light', 'moderate', 'active'] as const).includes(_pf.householdActivity as any) ? _pf.householdActivity : 'light');
  const [bodyFatPct, setBodyFatPct] = useState<number>(() => {
    // P1-fix: читаем из Profile (UnifiedSettings) через proxy
    try {
      const v = s?.bodyFat;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    return 15;
  });
  const [sleepHours, setSleepHours] = useState<number>(() => {
    try {
      const v = s?.sleepHours;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    return 7;
  });
  const [sleepQuality, setSleepQuality] = useState<number>(() => {
    try {
      const v = (s as any)?.lifestyle?.sleepQuality;
      if (v === 'good') return 9;
      if (v === 'fair') return 6;
      if (v === 'poor') return 3;
    } catch {}
    return 7;
  });
  const [stressLevel, setStressLevel] = useState<number>(() => {
    try {
      const v = s?.stressLevel;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    return 5;
  });
  const [cyclePhase, setCyclePhase] = useState<'none' | 'follicular' | 'ovulation' | 'luteal' | 'menstrual'>((['none', 'follicular', 'ovulation', 'luteal', 'menstrual'] as const).includes(_pf.cyclePhase as any) ? _pf.cyclePhase : 'none');
  // P1-fix: читаем из UnifiedSettings (goals.bbCategory), а не из мёртвого he_bb_category
  const [bbCategory, setBBCategory] = useState<BBCategory>(() => {
    try {
      const v = (s as any)?.goals?.bbCategory as BBCategory;
      if (v) return v;
    } catch {}
    try {
      const legacy = localStorage.getItem('he_bb_category') as BBCategory;
      if (legacy) return legacy;
    } catch {}
    return 'none';
  });
  useEffect(() => { try { updateSection('goals', { bbCategory }); } catch {} }, [bbCategory]);
  // ── Единая система тапера ББ: гидрация из профиля (bbPeakConfig) с legacy-fallback ──
  const [bbPrepConfig, setBBPrepConfigState] = useState<BBContestPrepConfig | null>(() => {
    try {
      const raw = (s as any)?.goals?.bbPeakConfig;
      if (raw) {
        const cfg = deserializeBBPrepConfig(raw);
        if (cfg) return cfg;
      }
      // Единый версионированный план (bbContestPrepPlan) без зеркала конфига: восстановить
      // конфиг из плана — иначе «Отключить тапер» не рендерится (bbPrepConfig === null),
      // но план остаётся активным и режет углеводы до пик-недельных (~300 г).
      const p = planFromStored((s as any)?.goals?.bbContestPrepPlan, null, (s as any)?.goals, (s as any)?.personal);
      if (p) return configFromPlan(p);
      return legacyConfigFromProfile((s as any)?.goals, (s as any)?.personal);
    } catch { return null; }
  });
  // 🏁 Единый версионированный план contest prep (goals.bbContestPrepPlan) — приоритет над конфигом:
  // покрывает подготовку/тапер/пик-неделю дневными целями (nutritionTargetsForPrepDate).
  const [bbPrepPlan, setBBPrepPlan] = useState<BBContestPrepPlan | null>(() => {
    try {
      return planFromStored(
        (s as any)?.goals?.bbContestPrepPlan,
        (s as any)?.goals?.bbPeakConfig,
        (s as any)?.goals,
        (s as any)?.personal,
      );
    } catch { return null; }
  });
  const setBBPrepConfig = (cfg: BBContestPrepConfig | null) => {
    if (!cfg) {
      setBBPrepConfigState(null);
      setBBPrepPlan(null);
      try { clearContestPrepEverywhere(); } catch {}
      return;
    }
    // Единая запись: версионированный план + зеркало конфига + событие
    try {
      const plan = saveContestPrepEverywhere(cfg, { source: 'planner', prepWeeks: 12, taperWeeks: cfg.weeksOut });
      if (plan) {
        setBBPrepConfigState(cfg);
        setBBPrepPlan(plan);
        return;
      }
    } catch {}
    // fallback — старая логика, если сборка плана не удалась
    setBBPrepConfigState(cfg);
    setBBPrepPlan(null);
    try {
      updateSection('goals', { bbPeakConfig: serializeBBPrepConfig(cfg), peakWeek: true, peakShowDay: cfg.showDate });
    } catch {}
  };
  // legacy peakWeekEnabled/peakShowDay — теперь производные от bbPrepConfig (единый план)
  const peakWeekEnabled = !!bbPrepConfig;
  const setPeakWeekEnabled = (v: boolean) => { if (!v) setBBPrepConfig(null); };
  const peakWeekShowDay = (() => {
    try {
      if (bbPrepConfig?.showDate) {
        const d = new Date(bbPrepConfig.showDate);
        if (!isNaN(d.getTime())) return d.getDay();
      }
      const v = (s as any)?.goals?.peakShowDay;
      if (typeof v === 'string') {
        const d2 = new Date(v);
        if (!isNaN(d2.getTime())) return d2.getDay();
      }
    } catch {}
    return 6;
  })();
  const setPeakWeekShowDay = (n: number) => {
    try {
      const base = bbPrepConfig || legacyConfigFromProfile((s as any)?.goals, (s as any)?.personal);
      if (!base) return;
      const d = new Date();
      d.setDate(d.getDate() + (n - d.getDay() + 7) % 7);
      const iso = d.toISOString().slice(0, 10);
      setBBPrepConfig({ ...base, showDate: iso });
    } catch {}
  };
  // 🏁 Живая синхронизация: событие he-bb-contest-prep-updated из BB Auto / питания
  // (собран/изменён prep-план) → перечитать единый план из профиля.
  useEffect(() => {
    const onPrepUpdated = () => {
      try {
        const s2 = getProfile().settings as any;
        const p = planFromStored(s2?.goals?.bbContestPrepPlan, s2?.goals?.bbPeakConfig, s2?.goals, s2?.personal);
        if (p) { setBBPrepPlan(p); setBBPrepConfigState(configFromPlan(p)); }
      } catch { /* ignore */ }
    };
    window.addEventListener(CONTEST_PREP_UPDATED_EVENT as any, onPrepUpdated);
    window.addEventListener('he-bb-contest-prep-updated', onPrepUpdated);
    return () => {
      window.removeEventListener(CONTEST_PREP_UPDATED_EVENT as any, onPrepUpdated);
      window.removeEventListener('he-bb-contest-prep-updated', onPrepUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Однократная миграция: голый bbPeakConfig → версионированный план
  useEffect(() => {
    try {
      const migrated = migrateLegacyContestPrepIfNeeded({ prepWeeks: 12 });
      if (migrated) {
        setBBPrepPlan(migrated);
        setBBPrepConfigState(configFromPlan(migrated));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 🗓 Годовой план (событие he-annual-training-plan-updated): живьё перечитываем
  // разметку блоков — для подсказки «неделя года = contest prep» при питании.
  const [annualPlan, setAnnualPlan] = useState<AnnualTrainingPlan | null>(null);
  useEffect(() => {
    const onAnnualUpdated = () => {
      try { setAnnualPlan(loadAnnualTrainingPlan()); } catch { /* ignore */ }
    };
    try { setAnnualPlan(loadAnnualTrainingPlan()); } catch { /* ignore */ }
    window.addEventListener('he-annual-training-plan-updated', onAnnualUpdated);
    return () => window.removeEventListener('he-annual-training-plan-updated', onAnnualUpdated);
  }, []);
  // Combat/Strength интеграция — слушаем he-combat-updated / he-strength-updated
  const [combatNutrition, setCombatNutrition] = useState<any>(null);
  useEffect(() => {
    const onCombatNutrition = () => {
      try {
        const raw = localStorage.getItem('he_combat_nutrition_payload') || localStorage.getItem('he_strength_nutrition_payload');
        if (raw) setCombatNutrition(JSON.parse(raw));
        else setCombatNutrition(null);
      } catch { setCombatNutrition(null); }
    };
    onCombatNutrition();
    window.addEventListener('he-combat-updated' as any, onCombatNutrition);
    window.addEventListener('he-strength-updated' as any, onCombatNutrition);
    return () => {
      window.removeEventListener('he-combat-updated' as any, onCombatNutrition);
      window.removeEventListener('he-strength-updated' as any, onCombatNutrition);
    };
  }, []);
  // п.18: активный блок года для сегодня (карточка «📍 текущий блок года» в UI плана).
  const annualPhase = useMemo(
    () => (annualPlan ? annualPlanPhaseForDate(annualPlan, isoToday()) : null),
    [annualPlan],
  );
  const applyBBPeakToPlan = (cfg: BBContestPrepConfig | null) => {
    if (!cfg) {
      try { clearContestPrepEverywhere(); } catch {}
      setBBPrepConfigState(null);
      setBBPrepPlan(null);
      setPeakWeekEnabled(false);
    } else {
      setBBPrepConfig(cfg);
    }
    try {
      generatePlan(planDays as 1 | 3 | 7, undefined, selectedDayIndex);
      setPlanTab('plan');
    } catch {}
  };
  const [lifeStage, setLifeStage] = useState<LifeStage>(() => {
    try {
      const v = (s as any)?.goals?.lifeStage as LifeStage;
      if (v) return v;
    } catch {}
    try {
      const legacy = localStorage.getItem('he_life_stage') as LifeStage;
      if (legacy) return legacy;
    } catch {}
    return 'none';
  });
  useEffect(() => { try { updateSection('goals', { lifeStage }); } catch {} }, [lifeStage]);
  const [heavyTrainDay, setHeavyTrainDay] = useState<string>(typeof _pf.heavyTrainDay === 'string' && ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].includes(_pf.heavyTrainDay) ? _pf.heavyTrainDay : '');
  const [weightAdaptMode, setWeightAdaptMode] = useState<boolean>(!!_pf.weightAdaptMode);
  const [weightLogWeek, setWeightLogWeek] = useState<number[]>([80, 80, 80]);
  const [expectedLossKgWeek, setExpectedLossKgWeek] = useState<number>(typeof _pf.expectedLossKgWeek === 'number' ? _pf.expectedLossKgWeek : 0.5);
  const [showWeightAdaptModal, setShowWeightAdaptModal] = useState(false);
  const [weightLogEntries, setWeightLogEntries] = useState<{ date: string; weight: number }[]>(() => {
    try {
      const canonical = getWeightLog();
      const savedEntries = JSON.parse(localStorage.getItem('he_weight_log_entries') || 'null');
      const byDate = new Map<string, number>();
      if (Array.isArray(savedEntries)) {
        for (const e of savedEntries) {
          const w = Number(e?.weight);
          if (e?.date && Number.isFinite(w) && w > 0) byDate.set(e.date, w);
        }
      }
      for (const e of canonical) {
        if (e?.date && Number.isFinite(e.weight) && e.weight > 0) byDate.set(e.date, e.weight);
      }
      const merged = [...byDate.entries()]
        .map(([date, weight]) => ({ date, weight }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (merged.length > 0) return merged;
    } catch {}
    const e: { date: string; weight: number }[] = [];
    for (let i = 0; i < 3; i++) { const d = new Date(); d.setDate(d.getDate() - (2 - i)); e.push({ date: d.toISOString().split('T')[0], weight: 80 }); }
    return e;
  });
  const [weightLogPeriod, setWeightLogPeriod] = useState<string>(typeof _pf.weightLogPeriod === 'string' ? _pf.weightLogPeriod : 'every3');
  useEffect(() => {
    try {
      // Канонический лог: обновляем weight у существующих записей, добавляем недостающие
      const log = getWeightLog();
      const byDate = new Map(log.map(e => [e.date, e]));
      for (const e of weightLogEntries) {
        if (!e?.date || !Number.isFinite(e.weight) || e.weight <= 0) continue;
        const existing = byDate.get(e.date);
        if (existing) {
          if (existing.weight !== e.weight) existing.weight = e.weight;
        } else {
          byDate.set(e.date, { date: e.date, weight: e.weight });
        }
      }
      saveWeightLog([...byDate.values()]);
      // Legacy-зеркало для обратной совместимости
      localStorage.setItem('he_weight_log_entries', JSON.stringify(weightLogEntries));
    } catch {}
    setWeightLogWeek(weightLogEntries.filter(e => Number.isFinite(e.weight) && e.weight > 0).map(e => e.weight));
  }, [weightLogEntries]);
  const [metabolicAdaptEnabled, setMetabolicAdaptEnabled] = useState<boolean>(!!_pf.metabolicAdaptEnabled);
  const [metabolicAdaptPct, setMetabolicAdaptPct] = useState<number>(typeof _pf.metabolicAdaptPct === 'number' ? _pf.metabolicAdaptPct : 10);
  // P1-fix: manualGPerKg инициализируется из Profile (UnifiedSettings.nutrition.manualGPerKgSplit) + legacy
  const [manualGPerKg, setManualGPerKg] = useState<Record<string, number>>(() => {
    const norm = (o: any): Record<string, number> => ({
      protein: typeof o?.protein === 'number' && !isNaN(o.protein) ? o.protein : 0,
      fat: typeof o?.fat === 'number' && !isNaN(o.fat) ? o.fat : 0,
      carbs: typeof o?.carbs === 'number' && !isNaN(o.carbs) ? o.carbs : 0,
    });
    try {
      const v = (s as any)?.nutrition?.manualGPerKgSplit;
      if (v && typeof v === 'object') return norm(v);
    } catch {}
    try {
      // Миграция: старые сохранения ошибочно писали объект в numeric proteinPerKg.
      const pp = (s as any)?.nutrition?.proteinPerKg;
      if (pp && typeof pp === 'object' && !Array.isArray(pp)) return norm(pp);
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_manual_g_per_kg') || 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) return norm(v);
    } catch {}
    return { protein: 0, fat: 0, carbs: 0 };
  });
  const [monthPlanMode, setMonthPlanMode] = useState(() => { try { return localStorage.getItem("he_plan_month_mode") === "true"; } catch { return false; } });
  const [monthPlan, setMonthPlan] = useState<any[]>(() => { try { const v = JSON.parse(localStorage.getItem("he_plan_month") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [selectedWeek, setSelectedWeek] = useState(0);
  // E4-sync: эффект объявлен НИЖЕ (после weekPlan/weekEditDay — TDZ-guard).
  const [goal, setGoal] = useState<GoalId>((s?.primaryGoal as GoalId) || 'maintenance');
  const [phase, setPhase] = useState<PhaseId>((_pf.phase && (GOALS.some(g => g.id === _pf.phase) || PHASES.some(p => p.id === _pf.phase))) ? _pf.phase as PhaseId : 'course');
  // Эпик 2: авто-цель НЕ выводится из фазы (фаза — фарма-контекст, не цель).
  // Рекомендация — из профиля (primaryGoal) либо нейтральная.
  const profilePrimaryGoal = (s?.primaryGoal as GoalId) || 'maintenance';
  const autoGoal: GoalId = profilePrimaryGoal !== 'maintenance' ? profilePrimaryGoal : 'maintenance';
  const [goalUserSet, setGoalUserSet] = useState(false);
  // FIX 1.2: авто-цель применяется ТОЛЬКО если пользователь явно не выбрал цель
  // И в профиле нет не-нейтральной первичной цели (иначе goal = primaryGoal из профиля).
  useEffect(() => {
    if (goalUserSet) return;
    if (profilePrimaryGoal && profilePrimaryGoal !== 'maintenance') return;
    setGoal(autoGoal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoGoal, goalUserSet, profilePrimaryGoal]);

  const [injections, setInjections] = useState<DrugInjection[]>(() => {
    if (courseEntries.length > 0) {
      return courseEntries.map(ce => {
        const substance = PHARMA_DB[ce.substanceId];
        const name = substance?.name || ce.substanceId || ce.name || 'Препарат';
        const halfLife = substance?.pk?.halfLifeHours || 24;
        let type = 'другое';
        let esterType: 'rapid' | 'short' | 'long' | 'none' = 'none';
        if (substance?.class === 'insulin') { type = 'инсулин'; if (halfLife < 2) esterType = 'rapid'; else if (halfLife <= 8) esterType = 'short'; else esterType = 'long'; }
        else if (substance?.id?.includes('ghrp') || substance?.id?.includes('cjc') || substance?.id?.includes('sermorelin') || substance?.class === 'peptide_ghrh' || substance?.class === 'peptide_ghrp') { type = 'ГР'; esterType = 'short'; }
        else if (substance?.id?.includes('igf1') || substance?.id?.includes('mgf')) { type = 'ИФР-1'; esterType = 'short'; }
        else if (substance?.class === 'glp1') { type = 'семаглутид'; esterType = 'long'; }
        else if (substance?.id?.includes('bpc') || substance?.id?.includes('tb500')) { type = 'пептид'; esterType = 'none'; }
        else if (substance?.class && ['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone'].includes(substance.class)) { type = 'ААС'; const esters = substance.esters || []; if (esters.some((e: string) => ['propionate','acetate','phenylpropionate'].includes(e))) esterType = 'short'; else if (esters.some((e: string) => ['enanthate','cypionate'].includes(e))) esterType = 'long'; else esterType = 'long'; }
        return { id: `course_${ce.substanceId}_${Date.now()}`, name, time: type === 'инсулин' ? (esterType === 'long' ? '22:00' : '08:00') : '08:00', dose: ce.doseValue || 10, unit: ce.doseUnit || 'mg', type, esterType, halfLifeHours: halfLife, trainLinked: false, trainTiming: 'before' as 'before' | 'after' | 'both' | 'none' };
      });
    }
    return [];
  });

  const [injName, setInjName] = useState('');
  const [injTime, setInjTime] = useState('08:00');
  const [injDose, setInjDose] = useState(10);
  const [injUnit, setInjUnit] = useState('mg');
  const [injType, setInjType] = useState('инсулин');
  const [injEster, setInjEster] = useState<'rapid' | 'short' | 'long' | 'none'>('none');
  // FIX train-bind: график тренировок персистится в he_train_bind и читается при старте
  // (раньше linkToTraining/trainStart/trainEnd/trainingDays сбрасывались при перезагрузке).
  const _trainBindRef = useRef<TrainSchedule | null>(null);
  if (_trainBindRef.current === null) {
    _trainBindRef.current = (() => {
      try {
        const v = JSON.parse(localStorage.getItem('he_train_bind') || 'null');
        if (v && typeof v === 'object') return normalizeTrainSchedule(v);
      } catch {}
      try {
        const sch = (getProfile().settings as any)?.training?.schedule;
        if (sch && typeof sch === 'object') return normalizeTrainSchedule(sch);
      } catch {}
      return DEFAULT_TRAIN_SCHEDULE;
    })();
  }
  const _trainBindInit = _trainBindRef.current;
  const [trainStart, setTrainStart] = useState(_trainBindInit.startTime);
  const [trainEnd, setTrainEnd] = useState(_trainBindInit.endTime);
  const [linkToTraining, setLinkToTraining] = useState(_trainBindInit.enabled);
  const [trainScheduleType, setTrainScheduleType] = useState<TrainScheduleType>(_trainBindInit.scheduleType);
  const [trainPattern, setTrainPattern] = useState<{ work: number; off: number }>({ ..._trainBindInit.pattern });
  // FIX train-bind: trainingDays должен быть объявлен ДО calcTargets (TDZ fix — был после, давал TS2448)
  const [trainingDays, setTrainingDays] = useState<boolean[]>([..._trainBindInit.weeklyDays]);
  // FIX train-bind: персист графика тренировок (создаётся ПОСЛЕ объявления trainingDays)
  useEffect(() => {
    try {
      safeWriteJSON('he_train_bind', buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern));
    } catch {}
  }, [linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern]);
  // FIX train-bind: единая функция «тренировочный день?» для всех режимов графика.
  const isTrainDay = (offset: number): boolean => isTrainingDayFor(buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern), offset);
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const injectDrugTypes = ['инсулин', 'ГР', 'ИФР-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', 'меланотан', 'семаглутид', 'тирзепатид', 'другое'];

  const calcTargets = useMemo(() => {
    try {
      const _localWorkoutsPerWeek = trainingDays.filter(Boolean).length || 3;
      const _localAvgMinutes = (() => {
        try {
          const v = (s as any)?.training?.minutesPerSession || (s as any)?.avgWorkoutMinutes;
          return typeof v === 'number' && v > 0 ? v : 60;
        } catch { return 60; }
      })();
      return computePlannerTargets({
        weightKg: weight, heightCm: height, age, sex, goal, phase, bodyFatPct,
        workoutsPerWeek: _localWorkoutsPerWeek, avgWorkoutMinutes: _localAvgMinutes,
        dailySteps, householdActivity, trainType, trainIntensity, surplusPct,
        injections: injections.map(i => ({ type: i.type, dose: i.dose, esterType: i.esterType })),
        weightAdaptMode, weightLogWeek, expectedLossKgWeek,
        metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg: { protein: manualGPerKg.protein || 0, fat: manualGPerKg.fat || 0, carbs: manualGPerKg.carbs || 0 },
      });
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; }
  }, [weight, height, age, sex, goal, trainingDays, s?.avgWorkoutMinutes, injections, phase, bodyFatPct, weightAdaptMode, weightLogWeek, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, dailySteps, householdActivity, trainType, trainIntensity, surplusPct]);

  // FIX: manual KBJU + kbjuMode теперь инициализируются из localStorage и персистятся.
  // Раньше при перезагрузке страницы все ручные цели КБЖУ сбрасывались на null, а режим — на 'auto'.
  // P1-fix: manualKcal/P/F/C из Profile (UnifiedSettings.nutrition.manualTargets) + legacy
  const [manualKcal, setManualKcal] = useState<number | null>(() => {
    try {
      const v = (s as any)?.nutrition?.manualTargets?.kcal;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    try { const v = localStorage.getItem('he_manual_kcal'); return v !== null ? Number(v) : null; } catch { return null; }
  });
  const [manualP, setManualP] = useState<number | null>(() => {
    try {
      const v = (s as any)?.nutrition?.manualTargets?.protein;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    try { const v = localStorage.getItem('he_manual_p'); return v !== null ? Number(v) : null; } catch { return null; }
  });
  const [manualF, setManualF] = useState<number | null>(() => {
    try {
      const v = (s as any)?.nutrition?.manualTargets?.fat;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    try { const v = localStorage.getItem('he_manual_f'); return v !== null ? Number(v) : null; } catch { return null; }
  });
  const [manualC, setManualC] = useState<number | null>(() => {
    try {
      const v = (s as any)?.nutrition?.manualTargets?.carbs;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    try { const v = localStorage.getItem('he_manual_c'); return v !== null ? Number(v) : null; } catch { return null; }
  });
  const [kbjuMode, setKbjuMode] = useState<'auto' | 'manual' | 'profile'>(() => {
    // P1-fix: читаем из Profile (UnifiedSettings.nutrition.kbjuMode)
    try {
      const v = (s as any)?.nutrition?.kbjuMode;
      if (v === 'manual' || v === 'profile' || v === 'auto') return v;
    } catch {}
    try {
      const v = localStorage.getItem('he_kbju_mode');
      if (v === 'manual' || v === 'profile' || v === 'auto') return v;
    } catch {}
    return 'auto';
  });

  const profileTargets = useMemo(() => {
    // P1-fix: replaced legacy calcNutrition (which ignored phase/course/weight-adapt)
    // with computePlannerTargets using neutral settings (maintenance phase, no
    // injections, no adaptations) so "profile" mode gives the raw profile-based
    // TDEE+macros without the planner's phase/course modifiers. This eliminates
    // the duplicate TDEE calculation that diverged from calcTargets.
    try {
      return computePlannerTargets({
        weightKg: s?.weight || weight, heightCm: s?.height || height,
        age: s?.age || age, sex: s?.sex || sex,
        goal: 'maintenance', phase: 'maintenance', bodyFatPct,
        workoutsPerWeek: s?.workoutsPerWeek || 3, avgWorkoutMinutes: s?.avgWorkoutMinutes || 60,
        dailySteps, householdActivity, trainType, trainIntensity, surplusPct: 10,
        injections: [],
        weightAdaptMode: false, weightLogWeek: [], expectedLossKgWeek: 0,
        metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
        manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
      });
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.weight, s?.height, s?.age, s?.sex, s?.workoutsPerWeek, s?.avgWorkoutMinutes, bodyFatPct, dailySteps, householdActivity, trainType, trainIntensity]);

  // Эпик 3: белок-пресет (г/кг) — единственный «уровень белка»; legacy nutrLevel
  // (ложный множитель «план на N% больше») удалён полностью.
  const [proteinPreset, setProteinPreset] = useState<NutritionLevel>((['base', 'medium', 'enhanced', 'max'] as const).includes((_pf as any).proteinPreset as any) ? (_pf as any).proteinPreset : (['base', 'medium', 'enhanced', 'max'] as const).includes(_pf.nutrLevel as any) ? _pf.nutrLevel : 'base');
  const _proteinGPerKg = PROTEIN_PRESETS.find(p => p.id === proteinPreset)?.gPerKg || 2.0;
  // Эпик A (NUTRITION-PLANNER-QUALITY-PLAN): фактические цели дня — единая чистая функция
  // buildDayTargets (planner-day-targets.ts). Наука (TDEE→surplus→фаза→фарма→weight-adapt→
  // metabolic→female gate) задаёт КАЛОРАЖ, пресет белка — оверрайд, угли — остаток до цели.
  // effectiveP/F/C/Kcal сохраняют прежние имена (100+ потребителей).
  const [budget, setBudget] = useState<BudgetLevel>((['low', 'medium', 'max', 'enhanced'] as const).includes(_pf.budget as any) ? (_pf.budget === 'enhanced' ? 'max' : _pf.budget) : 'medium');
  // Эпик 3: стиль питания (planType) — реальные макро-профили keto/highcarb в целях дня.
  const [planType, setPlanType] = useState<PlanType>((['classic', 'keto', 'highcarb', 'mediterranean', 'vegetarian'] as const).includes(_pf.planType as any) ? _pf.planType : 'classic');
  const [variety, setVariety] = useState<'minimal' | 'medium' | 'max'>((['minimal', 'medium', 'max'] as const).includes(_pf.variety as any) ? _pf.variety : 'max');
  const _insulinUnits = (injections || []).filter((i: any) => String(i?.type || '').toLowerCase().includes('инсулин')).reduce((s: number, i: any) => s + (Number(i?.dose) || 0), 0);
  const _trainVolMin = (() => { try { return trainingDays.filter(Boolean).length * ((s as any)?.training?.minutesPerSession || 60); } catch { return 0; } })();
  const dayTargets = useMemo(() => buildDayTargets({
    weightKg: weight,
    presetGPerKg: _proteinGPerKg,
    fatFloorGPerKg: 0.8,
    kbjuMode,
    manual: { kcal: manualKcal, p: manualP, f: manualF, c: manualC },
    calcTargets,
    profileTargets,
    goal,
    trainingVolumeMinPerWeek: _trainVolMin,
    budget,
    insulinTotalUnits: _insulinUnits,
    dietStyle: planType,
  }), [weight, _proteinGPerKg, kbjuMode, manualKcal, manualP, manualF, manualC, calcTargets, profileTargets, goal, _trainVolMin, budget, _insulinUnits, planType]);
  const dayTargetsBreakdown: string[] = [...dayTargets.breakdown];
  // Ф4.25: читаем заметку ББ-плана (he_bb_nutrition_note) — калораж + трен-дни для
  // циклирования углеводов. Применяется только если есть данные (no-op иначе).
  // Перечитывается на событии planner-apply (кнопка «🍽 В планировщик питания»), фокусе и
  // возврате на вкладку — чтобы заметка подхватывалась даже при уже смонтированном экране.
  const [bbNutritionNote, setBbNutritionNote] = useState<{ kcal?: number; trainDays?: number[]; weeklySets?: number; text?: string } | null>(() => {
    try { const raw = localStorage.getItem('he_bb_nutrition_note'); if (!raw) return null; const j = JSON.parse(raw); return (j && typeof j === 'object') ? j : null; } catch { return null; }
  });
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('he_bb_nutrition_note');
        if (!raw) { setBbNutritionNote(null); return; }
        const j = JSON.parse(raw);
        setBbNutritionNote((j && typeof j === 'object') ? j : null);
      } catch { setBbNutritionNote(null); }
    };
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') read(); };
    const onFocus = () => read();
    window.addEventListener('planner-apply', onFocus);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('planner-apply', onFocus);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const bbTrainDays = Array.isArray(bbNutritionNote?.trainDays) && bbNutritionNote.trainDays.length ? bbNutritionNote.trainDays : null;
  const todayDow = new Date().getDay() || 7; // Пн=1 .. Вс=7
  const bbIsTrainToday = bbTrainDays ? bbTrainDays.includes(todayDow) : null; // null = без циклирования
  const effectiveP = dayTargets.protein;
  let effectiveF = dayTargets.fats;
  let effectiveC = dayTargets.carbs;
  // Циклирование углей по трен-дням ББ-плана: трен-день +30 г углей (жир −), отдых −25 г.
  // Сохраняет Atwater-консистентность (kcal выводится из макросов).
  if (bbIsTrainToday != null) {
    const shiftG = bbIsTrainToday ? 30 : -25;
    effectiveC = Math.max(20, Math.round(dayTargets.carbs + shiftG));
    effectiveF = Math.max(35, Math.round(dayTargets.fats - (shiftG * 4) / 9));
  }
  const _rawCForCap = kbjuMode === 'profile' ? profileTargets.carbs : calcTargets.carbs;
  const carbCapGPerKg = (() => {
    try {
      const vol = trainingDays.filter(Boolean).length * ((s as any)?.training?.minutesPerSession || 60);
      return contextualCarbCapGPerKg(plannerGoalCategory(goal), vol, budget);
    } catch { return 5; }
  })();
  const carbCapClipped = (() => {
    try { return _rawCForCap > carbCapGPerKg * weight + 1; } catch { return false; }
  })();
  // Kcal согласован с фактическими макросами (Atwater) — display == генерация (buildDayTargets).
  const effectiveKcalAtwater = Math.round(effectiveP * 4 + effectiveC * 4 + effectiveF * 9);
  // Приоритет целевого калоража из ББ-плана, если он задан и близок к расчётному (в пределах 15%),
  // иначе оставляем Atwater-производное (не ломаем инвариант 4Б+4У+9Ж).
  const bbKcalTarget = (bbNutritionNote && Number.isFinite(bbNutritionNote.kcal) && (bbNutritionNote.kcal as number) > 0)
    ? Math.round(bbNutritionNote.kcal as number) : null;
  const effectiveKcal = (bbKcalTarget && Math.abs(bbKcalTarget - effectiveKcalAtwater) / Math.max(1, effectiveKcalAtwater) <= 0.15) ? bbKcalTarget : effectiveKcalAtwater;
  if (bbIsTrainToday != null) {
    dayTargetsBreakdown.push(`⚡ ББ-план: ${bbIsTrainToday ? 'трен-день' : 'день отдыха'} — углеводы ${bbIsTrainToday ? '+' : ''}${bbIsTrainToday ? 30 : -25} г (циклирование по трен-дням плана).`);
  }
  if (bbKcalTarget) {
    dayTargetsBreakdown.push(`🎯 Целевой калораж ББ-плана: ${bbKcalTarget} ккал (применён${effectiveKcal === bbKcalTarget ? '' : ' с учётом макросов'}); объём ~${bbNutritionNote?.weeklySets ?? '—'} сетов/нед.`);
  }

  const switchKbjuMode = (mode: typeof kbjuMode) => { if (mode === 'manual' && kbjuMode !== 'manual') { setManualKcal(effectiveKcal); setManualP(effectiveP); setManualF(effectiveF); setManualC(effectiveC); } if (mode !== 'manual') { setManualKcal(null); setManualP(null); setManualF(null); setManualC(null); } setKbjuMode(mode); };

  const resultsRef = useRef<HTMLDivElement>(null);
  // P1-fix: wakeTime/bedTime из Profile (UnifiedSettings.lifestyle.wakeTime/bedtime) + legacy
  const [wakeTime, setWakeTime] = useState<string>(() => {
    try {
      const v = (s as any)?.lifestyle?.wakeTime;
      if (v) return v;
    } catch {}
    return '07:00';
  });
  const [bedTime, setBedTime] = useState<string>(() => {
    try {
      const v = (s as any)?.lifestyle?.bedtime;
      if (v) return v;
    } catch {}
    return '23:00';
  });
  const [lunchTime, setLunchTime] = useState<string>(typeof _pf.lunchTime === 'string' ? _pf.lunchTime : '13:00');
  const [dinnerTime, setDinnerTime] = useState<string>(typeof _pf.dinnerTime === 'string' ? _pf.dinnerTime : '19:00');
  const [workFood, setWorkFood] = useState<'any' | 'portable'>(_pf.workFood === 'portable' ? 'portable' : 'any');
  // D-28: «загрузка под утреннюю тренировку» — вечером много углеводов, минимум жиров.
  const [morningTrainLoad, setMorningTrainLoad] = useState<boolean>(!!_pf.morningTrainLoad);
  // P1-fix: mealsCount из Profile (UnifiedSettings.nutrition.mealsPerDay) + legacy
  const [mealsCount, setMealsCount] = useState<number>(() => {
    try {
      const v = (s as any)?.nutrition?.mealsPerDay;
      if (typeof v === 'number' && v >= 2 && v <= 10) return v;
    } catch {}
    return 4;
  });
  // P0-fix Aug 23 2026: не перезаписываем выбор пользователя — awakeHours влияет только на рекомендацию в UI
  // (раньше сбрасывал mealsCount 8→5 при смене wakeTime). Рекомендация показывается в IndividualPlanSettings.
  useEffect(() => {}, [wakeTime, bedTime]);

  const [allergens, setAllergens] = useState<string[]>(() => {
    // P1-fix: читаем из Profile (UnifiedSettings), а не из мёртвых ключей he_food_allergens/he_contraindications
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      if (s.nutrition?.foodAllergies?.length) return s.nutrition.foodAllergies;
    } catch {}
    try { return getContraindications().foodAllergies || []; } catch { return []; }
  });
  const [healthIssues, setHealthIssues] = useState<string[]>(() => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      if (s.health?.chronicConditions?.length) return s.health.chronicConditions;
    } catch {}
    try { return getContraindications().chronicConditions || []; } catch { return []; }
  });
  // P1-fix: eveningLowCarb из Profile (UnifiedSettings.nutrition.eveningLowCarb) + legacy
  const [eveningLowCarb, setEveningLowCarb] = useState<boolean>(() => {
    try {
      const v = (s as any)?.nutrition?.eveningLowCarb;
      if (typeof v === 'boolean') return v;
    } catch {}
    try { return localStorage.getItem('he_evening_low_carb') === 'true'; } catch {}
    return false;
  });
  React.useEffect(() => {
    const relevantActive = healthIssues.some(h => h === 'oedema' || h === 'diabetes');
    if (relevantActive && !eveningLowCarb) {
      setEveningLowCarb(true);
      try { updateSection('nutrition', { eveningLowCarb: true }); } catch {}
    }
  }, [healthIssues]);

  // E8: осознанный выбор пользователя — молоко к завтраку / кокосовое масло в рацион.
  const [addMilkToBreakfast, setAddMilkToBreakfast] = useState<boolean>(() => {
    try { return localStorage.getItem('he_add_milk_breakfast') === 'true'; } catch {}
    return false;
  });
  // G4 (Эпик G): мёртвая настройка coconutOilBoost удалена — она никогда не передавалась
  // в MealPlanInput и не влияла на генерацию (пустой тумблер вводил в заблуждение).
  // N1: профиль вкуса завтрака (основа: каша/хлопья/яйца/творог).
  const [breakfastStyle, setBreakfastStyle] = useState<BreakfastStyle>(() => {
    try {
      const v = localStorage.getItem('he_breakfast_style');
      if (v === 'porridge' || v === 'flakes' || v === 'eggs' || v === 'cottage') return v;
    } catch {}
    return 'auto';
  });
  // N7: завтрак-шаблон (готовый «классический завтрак бодибилдера»).
  const [breakfastTemplate, setBreakfastTemplate] = useState<BreakfastTemplateId>(() => {
    try {
      const v = localStorage.getItem('he_breakfast_template');
      if (v === 'classic_oat' || v === 'protein_flakes' || v === 'eggs_toast' || v === 'cottage_berries') return v;
    } catch {}
    return 'auto';
  });
  // FIX persist-settings: пишем все локальные предпочтения в he_planner_prefs (debounce не нужен —
  // пишем на каждое изменение, объём крошечный). Раньше эти настройки не сохранялись вообще.
  useEffect(() => {
    try {
      safeWriteJSON('he_planner_prefs', {
        cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays,
        trainType, trainIntensity, intraWorkoutEnabled, householdActivity, cyclePhase,
        weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct,
        weightLogPeriod, phase, proteinPreset, budget, variety,
        lunchTime, dinnerTime, workFood, planType, morningTrainLoad, heavyTrainDay,
        cookingSkill, cookingFrequency, batchCooking,
      });
    } catch {}
  }, [cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, trainType, trainIntensity, intraWorkoutEnabled, householdActivity, cyclePhase, weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, weightLogPeriod, phase, proteinPreset, budget, variety, lunchTime, dinnerTime, workFood, planType, morningTrainLoad, heavyTrainDay, cookingSkill, cookingFrequency, batchCooking]);

  // P1-fix: preferredFoods из Profile (UnifiedSettings.nutrition.preferredFoods) + legacy
  const [preferredFoods, setPreferredFoods] = useState<string[]>(() => {
    try {
      const v = (s as any)?.nutrition?.preferredFoods;
      if (Array.isArray(v) && v.length) return v.filter((x: any) => typeof x === 'string');
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_preferred_foods') || '["chicken_breast","rice_white","broccoli","egg_whole","avocado"]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : ['chicken_breast','rice_white','broccoli','egg_whole','avocado'];
    } catch { return ['chicken_breast','rice_white','broccoli','egg_whole','avocado']; }
  });
  useEffect(() => { try { updateSection('nutrition', { preferredFoods }); } catch {} }, [preferredFoods]);
  const [quickAddMealIdx, setQuickAddMealIdx] = useState<number | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const cleanPlannerNotes = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    if (/^[\s/\\|_\-=~*#·•]+$/.test(t)) return null;
    return t;
  };
  const [customNotes, setCustomNotes] = useState(() => {
    try { const v = cleanPlannerNotes((s as any)?.nutrition?.dietNotes); if (v !== null) return v; } catch {}
    try { return cleanPlannerNotes(localStorage.getItem('he_nutrition_notes')) || ''; } catch { return ''; }
  });
  // FIX save-buttons: заметки читались, но не сохранялись — терялись при перезагрузке.
  // Двустороннее зеркало: правка пишется и в профиль, иначе старый dietNotes («///////») возвращался после перезагрузки.
  useEffect(() => { try { safeWriteJSON('he_nutrition_notes', customNotes); updateSection('nutrition', { dietNotes: customNotes }); } catch {} }, [customNotes]);
  // D-28: meal-bound preferred foods (e.g. rice_cream → breakfast only)
  const [preferredByMeal, setPreferredByMeal] = useState<Record<string, string[]>>(() => {
    try { const v = (s as any)?.nutrition?.preferredByMeal; if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
    try { const v = JSON.parse(localStorage.getItem('he_preferred_by_meal') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  });
  useEffect(() => { try { updateSection('nutrition', { preferredByMeal }); } catch {} }, [preferredByMeal]);
  // D-28+: advanced preference states
  const [specificity, setSpecificity] = useState<Specificity>(() => {
    try {
      const v = (s as any)?.nutrition?.specificity;
      if (v === 'generic' || v === 'specific') return v;
    } catch {}
    try {
      const v = localStorage.getItem('he_specificity');
      if (v === 'generic' || v === 'specific') return v;
    } catch {}
    return 'varied';
  });
  useEffect(() => {
    try {
      // Маппинг Specificity → UnifiedSettings.specificity: 'everyday' → 'generic', остальное → 'specific'
      const mapped = specificity === 'everyday' ? 'generic' : 'specific';
      updateSection('nutrition', { specificity: mapped as any });
    } catch {}
  }, [specificity]);
  const [intolerances, setIntolerances] = useState<Intolerances>(() => {
    let v: any = null;
    try {
      const p = (s as any)?.nutrition?.foodIntolerances;
      if (p && typeof p === 'object' && !Array.isArray(p)) v = p;
    } catch {}
    if (!v) {
      try {
        const p = JSON.parse(localStorage.getItem('he_intolerances') || '{}');
        if (p && typeof p === 'object' && !Array.isArray(p)) v = p;
      } catch {}
    }
    v = v && typeof v === 'object' ? v : {};
    // Эпик 8: инит-синк legacy histamineSensitive → lowHistamine (один гейт генерации).
    let legacyHist = false;
    try { legacyHist = (s as any)?.nutrition?.histamineSensitive === true; } catch {}
    try { if (!legacyHist) legacyHist = localStorage.getItem('he_planner_histamine') === 'true'; } catch {}
    if (legacyHist && !v.lowHistamine) v.lowHistamine = true;
    return v as Intolerances;
  });
  useEffect(() => { try { updateSection('nutrition', { foodIntolerances: intolerances as any }); } catch {} }, [intolerances]);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile>(() => {
    try {
      const v = (s as any)?.nutrition?.tasteProfile;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as TasteProfile;
    } catch {}
    try {
      const p = JSON.parse(localStorage.getItem('he_taste_profile') || '{"spicy":0,"sweet":0,"salty":0,"sour":0,"umami":0}');
      return { spicy: 0, sweet: 0, salty: 0, sour: 0, umami: 0, ...p };
    } catch { return { spicy: 0, sweet: 0, salty: 0, sour: 0, umami: 0 }; }
  });
  useEffect(() => {
    try {
      // TasteProfile — объект {spicy, sweet, ...}, не мигрируется в UnifiedSettings.nutrition.tasteProfile (там string[]).
      // Сохраняем в nutrition как userPreference через extras? Или оставляем в localStorage legacy.
      // Используем localStorage для обратной совместимости.
      localStorage.setItem('he_taste_profile', JSON.stringify(tasteProfile));
    } catch {}
  }, [tasteProfile]);
   const [excludedCategories, setExcludedCategories] = useState<string[]>(() => {
    try {
      const v = (s as any)?.nutrition?.excludedCategories;
      if (Array.isArray(v)) return v.filter((x: any) => typeof x === 'string');
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_excluded_categories') || '[]');
      return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : [];
    } catch { return []; }
   });
  useEffect(() => { try { updateSection('nutrition', { excludedCategories }); } catch {} }, [excludedCategories]);
  // Адаптация по фактическому дневнику (вчера → сегодня компенсация).
  const [diaryAdaptation, setDiaryAdaptation] = useState<boolean>(() => { try { return localStorage.getItem('he_diary_adaptation') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('he_diary_adaptation', diaryAdaptation ? 'true' : 'false'); } catch {} }, [diaryAdaptation]);
  // Smart 7-day variety: 'soft' = только deprioritize recent, 'strict' = hard-exclude последние 1-2 дня.
  const [varietyStrictness, setVarietyStrictness] = useState<'soft' | 'strict'>(() => {
    try {
      const v = (s as any)?.nutrition?.varietyStrictness;
      if (v === 'low' || v === 'medium' || v === 'high') {
        return v === 'low' ? 'soft' : 'strict';
      }
    } catch {}
    try {
      const v = localStorage.getItem('he_variety_strictness') as 'soft' | 'strict';
      if (v === 'soft' || v === 'strict') return v;
    } catch {}
    return 'strict';
  });
  useEffect(() => { try { updateSection('nutrition', { varietyStrictness: varietyStrictness === 'soft' ? 'low' : 'high' }); } catch {} }, [varietyStrictness]);
  // v6: единое разнообразие (variety + varietyStrictness → varietyLevel). Храним в _pf.varietyLevel,
  // мигрируем из старых _pf.variety / _pf.varietyStrictness / he_variety_strictness.
  const [varietyLevel, setVarietyLevelRaw] = useState<VarietyLevel>(() => {
    const v = (_pf as any).varietyLevel as VarietyLevel;
    if (v === 'low' || v === 'medium' || v === 'high') return v;
    const oldV = _pf.variety as string;
    if (oldV === 'minimal') return 'low';
    if (oldV === 'medium') return 'medium';
    if (oldV === 'max') return 'high';
    return 'high';
  });
  const setVarietyLevel = (v: VarietyLevel) => {
    setVarietyLevelRaw(v);
    const map: Record<VarietyLevel, { variety: 'minimal' | 'medium' | 'max'; strict: 'soft' | 'strict' }> = {
      low: { variety: 'minimal', strict: 'strict' },
      medium: { variety: 'medium', strict: 'soft' },
      high: { variety: 'max', strict: 'strict' },
    };
    const m = map[v];
    if (m) {
      setVariety(m.variety);
      setVarietyStrictness(m.strict);
    }
  };
  // P1-fix: excludedFoods из Profile (UnifiedSettings.nutrition.excludedFoods) + legacy
  const [excludedFoods, setExcludedFoods] = useState<string[]>(() => {
    try {
      const v = (s as any)?.nutrition?.excludedFoods;
      if (Array.isArray(v)) return v.filter(x => typeof x === 'string');
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_excluded_foods') || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  });
  useEffect(() => { try { updateSection('nutrition', { excludedFoods }); } catch {} }, [excludedFoods]);
  // P1-fix: dietPrefs из Profile (UnifiedSettings.nutrition.tasteProfile) + legacy
  // dietPrefs — это список типов (vegetarian, vegan, pescatarian и т.д.) из UI.
  // В UnifiedSettings он хранится в nutrition.tasteProfile как массив (через миграцию diet_preferences).
  const [dietPrefs, setDietPrefs] = useState<string[]>(() => {
    try {
      const v = (s as any)?.nutrition?.tasteProfile;
      if (Array.isArray(v)) return v.filter(x => typeof x === 'string');
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_diet_preferences') || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  });
  useEffect(() => { try { updateSection('nutrition', { tasteProfile: dietPrefs }); } catch {} }, [dietPrefs]);
  const [allergenExcludedCount, setAllergenExcludedCount] = useState(0);
  const [planTargets, setPlanTargets] = useState<{ kcal: number; protein: number; fats: number; carbs: number }>({ kcal: 2500, protein: 160, fats: 70, carbs: 300 });
  // Bug-1 fix: planTargets must mirror effective* so the full nutrition report
  // (generateFullNutritionReport uses `targets: planTargets`, `userTDEE: planTargets.kcal`)
  // compares against the REAL planner targets, not the hardcoded default 2500/160/70/300.
  useEffect(() => { setPlanTargets({ kcal: effectiveKcal, protein: effectiveP, fats: effectiveF, carbs: effectiveC }); }, [effectiveKcal, effectiveP, effectiveF, effectiveC]);
  // Эпик 1: единая периодизация углеводов. Миграция legacy (cyclingMode/dietPauseMode/
  // periodizationEnabled → carbPeriodization) — при инициализации; legacy-поля больше
  // НЕ существуют как state и НЕ читаются генерацией.
  const [carbPeriodization, setCarbPeriodization] = useState<CarbPeriodization>(() => {
    const v = (_pf as any).carbPeriodization as CarbPeriodization;
    if (v && ['none','refeed','carb_cycle','butch','flex_80_20','two_one','five_two','wave'].includes(v)) return v;
    if ((_pf as any).periodizationEnabled) return 'wave';
    const cm = (_pf as any).cyclingMode as string;
    if (cm === 'macro') return 'carb_cycle';
    if (cm === 'butch') return 'butch';
    if (cm === 'cheatmeal') return 'refeed';
    if (cm === 'carbload') return 'carb_cycle';
    const dm = (_pf as any).dietPauseMode as string;
    if (dm === 'refeed') return 'refeed';
    if (dm === 'flex_80_20') return 'flex_80_20';
    if (dm === 'periodization_2_1') return 'two_one';
    if (dm === 'diet_5_2') return 'five_two';
    return 'none';
  });
  useEffect(() => {
    try {
      const cur = JSON.parse(localStorage.getItem('he_planner_prefs') || '{}');
      safeWriteJSON('he_planner_prefs', { ...cur, varietyLevel, carbPeriodization });
    } catch {}
  }, [varietyLevel, carbPeriodization]);
  const [workScheduleEnabledRaw, setWorkScheduleEnabledRaw] = useState<boolean>(typeof _pf.workScheduleEnabled === 'boolean' ? _pf.workScheduleEnabled : false);
  const [workStartTimeRaw, setWorkStartTimeRaw] = useState<string>(typeof _pf.workStartTime === 'string' && /^\d{2}:\d{2}$/.test(_pf.workStartTime) ? _pf.workStartTime : '09:00');
  const [workEndTimeRaw, setWorkEndTimeRaw] = useState<string>(typeof _pf.workEndTime === 'string' && /^\d{2}:\d{2}$/.test(_pf.workEndTime) ? _pf.workEndTime : '18:00');
  const [workDaysRaw, setWorkDaysRaw] = useState<boolean[]>(Array.isArray(_pf.workDays) && _pf.workDays.length === 7 ? (_pf.workDays as any[]).map(Boolean) : [true, true, true, true, true, false, false]);
  const [workScheduleTypeRaw, setWorkScheduleTypeRaw] = useState<string>(typeof _pf.workScheduleType === 'string' ? _pf.workScheduleType : 'standard');
  // Wrapped setters with persistence to he_planner_prefs (avoid effect deps array breakage)
  const workScheduleEnabled = workScheduleEnabledRaw;
  const workStartTime = workStartTimeRaw;
  const workEndTime = workEndTimeRaw;
  const workDays = workDaysRaw;
  const workScheduleType = workScheduleTypeRaw;
  const persistWorkPrefs = useCallback((patch: Record<string, any>) => {
    try {
      const cur = (() => { try { return JSON.parse(localStorage.getItem('he_planner_prefs') || '{}'); } catch { return {}; } })();
      safeWriteJSON('he_planner_prefs', { ...cur, ...patch });
    } catch {}
  }, []);
  const setWorkScheduleEnabled = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setWorkScheduleEnabledRaw(prev => {
      const next = typeof v === 'function' ? (v as any)(prev) : v;
      persistWorkPrefs({ workScheduleEnabled: next });
      return next;
    });
  }, [persistWorkPrefs]);
  const setWorkStartTime = useCallback((v: string | ((prev: string) => string)) => {
    setWorkStartTimeRaw(prev => {
      const next = typeof v === 'function' ? (v as any)(prev) : v;
      persistWorkPrefs({ workStartTime: next });
      return next;
    });
  }, [persistWorkPrefs]);
  const setWorkEndTime = useCallback((v: string | ((prev: string) => string)) => {
    setWorkEndTimeRaw(prev => {
      const next = typeof v === 'function' ? (v as any)(prev) : v;
      persistWorkPrefs({ workEndTime: next });
      return next;
    });
  }, [persistWorkPrefs]);
  const setWorkDays = useCallback((v: boolean[] | ((prev: boolean[]) => boolean[])) => {
    setWorkDaysRaw(prev => {
      const next = typeof v === 'function' ? (v as any)(prev) : v;
      persistWorkPrefs({ workDays: next });
      return next;
    });
  }, [persistWorkPrefs]);
  const setWorkScheduleType = useCallback((v: string | ((prev: string) => string)) => {
    setWorkScheduleTypeRaw(prev => {
      const next = typeof v === 'function' ? (v as any)(prev) : v;
      persistWorkPrefs({ workScheduleType: next });
      return next;
    });
  }, [persistWorkPrefs]);
  const [generated, setGenerated] = useState(false);
  // ⏳ Признак неблокирующей генерации (3/7 дней с yield) — кнопки показывают «⏳».
  const [planBusy, setPlanBusy] = useState(false);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(() => { try { const v = parseInt(localStorage.getItem("he_plan_days") || "1"); return (v === 3 || v === 7) ? v : 1; } catch { return 1; } });
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => { try { return parseInt(localStorage.getItem("he_plan_day_idx") || "0") || 0; } catch { return 0; } });
  const [planView, setPlanView] = useState<'list' | 'calendar'>(() => { try { return (localStorage.getItem("he_plan_view") === "calendar") ? "calendar" : "list"; } catch { return "list"; } });
  const [dayPlan, setDayPlan] = useState<any>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('he_day_plan') || 'null');
      if (v && Array.isArray(v.meals) && v.meals.length) return v;
    } catch {}
    return null;
  });
  const [threeDayPlan, setThreeDayPlan] = useState<any>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('he_three_day_plan') || 'null');
      if (v && Array.isArray(v.days) && v.days.length) return v;
    } catch {}
    return null;
  });
  const [weekPlan, setWeekPlan] = useState<any>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('he_week_plan') || 'null');
      if (v && Array.isArray(v.days) && v.days.length) return v;
    } catch {}
    return null;
  });
  const [shoppingList, setShoppingList] = useState<any>(null); // Bug-3: не персистим — без плана это осиротевшие данные
  const [waterCalc, setWaterCalc] = useState<any>(null); // Bug-3: не персистим — без плана это осиротевшие данные
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [lockedFoodIds, setLockedFoodIds] = useState<Set<string>>(() => {
    try { const v = (s as any)?.nutrition?.lockedFoods; if (Array.isArray(v)) return new Set(v.filter((x: any) => typeof x === 'string')); } catch {}
    try { const v = JSON.parse(localStorage.getItem('he_locked_foods') || '[]'); return new Set(Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []); } catch { return new Set<string>(); }
  });
  const toggleLockFood = (foodId: string) => { setLockedFoodIds(prev => { const next = new Set(prev); if (next.has(foodId)) next.delete(foodId); else next.add(foodId); localStorage.setItem('he_locked_foods', JSON.stringify([...next])); return next; }); };
  const [expandedSavedId, setExpandedSavedId] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<{ dayIdx: number; mealIdx: number; itemIdx: number } | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [replacingItem, setReplacingItem] = useState<{ dayIdx: number; mealIdx: number; itemIdx: number } | null>(null);
  const [recipePickerMeal, setRecipePickerMeal] = useState<{ dayIdx: number; mealIdx: number; label: string } | null>(null);
  const [mealPrep, setMealPrep] = useState<any[] | null>(null);
  const [dayPlanNotes, setDayPlanNotes] = useState(() => { try { return localStorage.getItem('he_day_notes') || ''; } catch { return ''; } });
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([]);
   const [userRecipes, setUserRecipes] = useState<any[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_user_recipes') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [showRecipeCreator, setShowRecipeCreator] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showDrugTypePicker, setShowDrugTypePicker] = useState(false);
   const [takenSupplements, setTakenSupplements] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_nutrition_supps') || '[]'); return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []; } catch { return []; } });
  const [showSuppPicker, setShowSuppPicker] = useState(false);
  const [suppSearch, setSuppSearch] = useState('');
  const [newRecipe, setNewRecipe] = useState({ name: '', meal: 'lunch' as string, prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
  const [v2Phase, setV2Phase] = useState('LEAN_MASS');
  const [v2Labs, setV2Labs] = useState<Record<string, string>>(() => { try { const v = JSON.parse(localStorage.getItem('he_planner_labs') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } });
  const [v2Pharma, setV2Pharma] = useState<Record<string, boolean>>(() => { try { const v = JSON.parse(localStorage.getItem('he_planner_pharma') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } });
  const [histamineSensitive, setHistamineSensitive] = useState(() => {
    try { const v = (s as any)?.nutrition?.histamineSensitive; if (typeof v === 'boolean') return v; } catch {}
    try { return localStorage.getItem('he_planner_histamine') === 'true'; } catch { return false; }
  });
  // Эпик 8: histamineSensitive — СИНХРОНИЗИРОВАННЫЙ алиас intolerances.lowHistamine
  // (один источник для генерации — гейт движка по lowHistamine; тумблеры в двух
  // карточках всегда согласованы).
  const setHistamineSynced = useCallback((v: boolean) => {
    setHistamineSensitive(v);
    setIntolerances((prev: any) => ({ ...prev, lowHistamine: v }));
  }, []);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>(() => {
    try {
      const value = localStorage.getItem('he_planner_mode');
      return value === 'simple' || value === 'minimal' || value === 'pro' ? value : 'pro';
    } catch { return 'pro'; }
  });
  const plannerModeRef = useRef<PlannerMode>(plannerMode);
  useEffect(() => { plannerModeRef.current = plannerMode; }, [plannerMode]);
  useEffect(() => { try { localStorage.setItem('he_planner_labs', JSON.stringify(v2Labs)); } catch {} }, [v2Labs]);
  useEffect(() => { try { localStorage.setItem('he_planner_pharma', JSON.stringify(v2Pharma)); } catch {} }, [v2Pharma]);
  useEffect(() => { try { localStorage.setItem('he_planner_histamine', histamineSensitive ? 'true' : 'false'); } catch {} }, [histamineSensitive]);
   useEffect(() => { try { localStorage.setItem('he_planner_mode', plannerMode); } catch {} }, [plannerMode]);
  // 🍳 Режим генерации: «по продуктам» (классика) / «по рецептам» (основные приёмы из рецептов)
  const [generationMode, setGenerationMode] = useState<'products' | 'recipes'>(() => {
    try { return localStorage.getItem('he_planner_gen_mode') === 'recipes' ? 'recipes' : 'products'; } catch { return 'products'; }
  });
  const generationModeRef = useRef<'products' | 'recipes'>(generationMode);
  useEffect(() => { generationModeRef.current = generationMode; }, [generationMode]);
   useEffect(() => { try { localStorage.setItem('he_planner_gen_mode', generationMode); } catch {} }, [generationMode]);
  // ⭐ Избранные рецепты (B5): имена рецептов, бейдж в чипах/вариантах + бонус к скорингу
  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(() => {
    try { const v = JSON.parse(localStorage.getItem('he_recipe_fav') || '[]'); return new Set<string>(Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []); } catch { return new Set(); }
  });
  const toggleFavoriteRecipe = (name: string) => {
    setFavoriteRecipes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem('he_recipe_fav', JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const isFavoriteRecipe = (name: string) => favoriteRecipes.has(name);
  // A4: карточка «👨‍🍳 План готовки» сейчас показывает рецептурный вариант? — тогда при
  // смене варианта рецепта она тихо пересобирается из обновлённых планов.
  const recipeCookingActiveRef = useRef(false);
  // Быстрый режим: только 3 цели (масса/сушка/поддержание) — нормализуем цель при входе,
  // чтобы выбранная ранее цель (сила/реабилитация и т.п.) не давала расчёт вне интерфейса.
  useEffect(() => {
    if (plannerMode === 'minimal' && goal !== 'mass' && goal !== 'cutting' && goal !== 'maintenance') {
      setGoal('maintenance');
      setGoalUserSet(true);
    }
  }, [plannerMode, goal]);
   useEffect(() => { try { localStorage.setItem('he_nutrition_supps', JSON.stringify(takenSupplements)); } catch {} }, [takenSupplements]);
   // FIX save-buttons: пользовательские рецепты читались из he_user_recipes, но НИКОГДА
   // не сохранялись — созданный рецепт пропадал при перезагрузке.
   useEffect(() => { try { safeWriteJSON('he_user_recipes', userRecipes); } catch {} }, [userRecipes]);

  // FIX: персистентность ручных целей КБЖУ и режима
  useEffect(() => { try { if (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0) localStorage.setItem('he_manual_g_per_kg', JSON.stringify(manualGPerKg)); else localStorage.removeItem('he_manual_g_per_kg'); } catch {} }, [manualGPerKg]);
  useEffect(() => { try { if (manualKcal !== null) localStorage.setItem('he_manual_kcal', String(manualKcal)); else localStorage.removeItem('he_manual_kcal'); } catch {} }, [manualKcal]);
  useEffect(() => { try { if (manualP !== null) localStorage.setItem('he_manual_p', String(manualP)); else localStorage.removeItem('he_manual_p'); } catch {} }, [manualP]);
  useEffect(() => { try { if (manualF !== null) localStorage.setItem('he_manual_f', String(manualF)); else localStorage.removeItem('he_manual_f'); } catch {} }, [manualF]);
  useEffect(() => { try { if (manualC !== null) localStorage.setItem('he_manual_c', String(manualC)); else localStorage.removeItem('he_manual_c'); } catch {} }, [manualC]);
  useEffect(() => { try { localStorage.setItem('he_kbju_mode', kbjuMode); } catch {} }, [kbjuMode]);

  // B1: Persist generated plan data so it survives tab switching / remounts
  useEffect(() => { try { localStorage.setItem("he_plan_days", String(planDays)); } catch {} }, [planDays]);
  useEffect(() => { try { localStorage.setItem("he_plan_day_idx", String(selectedDayIndex)); } catch {} }, [selectedDayIndex]);
  useEffect(() => { try { localStorage.setItem("he_plan_view", planView); } catch {} }, [planView]);
  useEffect(() => { try { localStorage.setItem("he_plan_month_mode", monthPlanMode ? "true" : "false"); } catch {} }, [monthPlanMode]);
  useEffect(() => { if (monthPlan.length > 0) { if (!safeWriteJSON("he_plan_month", monthPlan)) { try { console.warn("[Planner] he_plan_month not saved (quota?)"); } catch {} } } else { try { localStorage.removeItem("he_plan_month"); } catch {} } }, [monthPlan]);
  useEffect(() => { try { if (dayPlan) localStorage.setItem('he_day_plan', JSON.stringify(dayPlan)); else localStorage.removeItem('he_day_plan'); } catch {} }, [dayPlan]);
  useEffect(() => { try { if (threeDayPlan) localStorage.setItem('he_three_day_plan', JSON.stringify(threeDayPlan)); else localStorage.removeItem('he_three_day_plan'); } catch {} }, [threeDayPlan]);
  useEffect(() => { try { if (weekPlan) localStorage.setItem('he_week_plan', JSON.stringify(weekPlan)); else localStorage.removeItem('he_week_plan'); } catch {} }, [weekPlan]);

  const saveUndo = () => {
    const snap: any = {};
    if (dayPlan) snap.dayPlan = JSON.parse(JSON.stringify(dayPlan));
    if (threeDayPlan) snap.threeDayPlan = JSON.parse(JSON.stringify(threeDayPlan));
    if (weekPlan) snap.weekPlan = JSON.parse(JSON.stringify(weekPlan));
    // P1-fix: включаем shoppingList/waterCalc/recommendations в снапшот,
    // чтобы undo не рассинхронизировал план со списком покупок и водным балансом.
    if (shoppingList) snap.shoppingList = JSON.parse(JSON.stringify(shoppingList));
    if (waterCalc) snap.waterCalc = JSON.parse(JSON.stringify(waterCalc));
    if (recommendations) snap.recommendations = JSON.parse(JSON.stringify(recommendations));
    setUndoStack(prev => [snap, ...prev].slice(0, 5));
  };

  // FIX button-audit: единая реализация undo — восстанавливает ВСЕ части снапшота
  // (раньше recommendations не восстанавливались, а setState вызывался внутри updater)
  const _undoRef = useRef(undoStack); _undoRef.current = undoStack;
  const undoLast = () => {
    const stack = _undoRef.current;
    if (!Array.isArray(stack) || stack.length === 0) return;
    const snap = stack[0];
    if (snap.dayPlan) setDayPlan(snap.dayPlan);
    if (snap.threeDayPlan) setThreeDayPlan(snap.threeDayPlan);
    if (snap.weekPlan) setWeekPlan(snap.weekPlan);
    if (snap.shoppingList) setShoppingList(snap.shoppingList);
    if (snap.waterCalc) setWaterCalc(snap.waterCalc);
    if (snap.recommendations) setRecommendations(snap.recommendations);
    setUndoStack(prev => prev.slice(1));
  };

  const calcItemTotals = (items: any[]) => ({ kcal: items.reduce((s: number, i: any) => s + (i.kcal || 0), 0), p: items.reduce((s: number, i: any) => s + (i.p || 0), 0), f: items.reduce((s: number, i: any) => s + (i.f || 0), 0), c: items.reduce((s: number, i: any) => s + (i.c || 0), 0), fiber: items.reduce((s: number, i: any) => s + (i.fiber || 0), 0), leucine_mg: items.reduce((s: number, i: any) => s + (i.leucine_mg || 0), 0) });
  const calcMealTotals = (meals: any[]) => ({ kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0), fiber: meals.reduce((s: number, m: any) => s + (m.totals?.fiber || 0), 0), leucine_mg: meals.reduce((s: number, m: any) => s + (m.totals?.leucine_mg || 0), 0) });
  const updateMealsInPlan = (prev: any, mealIdx: number, itemsUpdater: (items: any[]) => any[]) => {
    if (!prev) return prev;
    const meals = [...prev.meals];
    const items = itemsUpdater([...meals[mealIdx].items]);
    meals[mealIdx] = { ...meals[mealIdx], items, totals: calcItemTotals(items) };
    return { ...prev, meals, totals: calcMealTotals(meals) };
  };
  const updateMultiDayPlan = (plan: any, dayIdx: number, mealIdx: number, itemsUpdater: (items: any[]) => any[]) => {
    if (!plan?.days?.[dayIdx]) return;
    const days = [...plan.days];
    const updated = updateMealsInPlan(days[dayIdx], mealIdx, itemsUpdater);
    if (!updated) return;
    days[dayIdx] = updated;
    const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0), fiber: days.reduce((s: number, d: any) => s + (d.totals?.fiber || 0), 0), leucine_mg: days.reduce((s: number, d: any) => s + (d.totals?.leucine_mg || 0), 0) };
    // P1-fix: используем функциональные updaters вместо сравнения ссылок (===).
    // Раньше `plan === threeDayPlan` сравнивал closure-captured ссылку с текущим state,
    // что могло дать false и тихо потерять правки. Теперь определяем тип плана по
    // длине days (3 = threeDayPlan, 7 = weekPlan) и используем соответствующий setter.
    const dayCount = days.length;
    const newPlan = { ...plan, days, totals: allTotals };
    if (dayCount === 3) setThreeDayPlan(newPlan as any);
    else if (dayCount === 7) setWeekPlan(newPlan as any);
    else {
      // Fallback на старую логику для нестандартных длин
      if (plan === threeDayPlan) setThreeDayPlan(newPlan as any);
      else if (plan === weekPlan) setWeekPlan(newPlan as any);
    }
  };

  // P0-fix: drag&drop в 3/7-дневном виде раньше всегда правил dayPlan (день 0) вместо видимого дня.
  // Теперь moveFoodItem принимает dayIdx (0=dayPlan, 1..3=threeDayPlan, 7..=weekPlan) и мутирует правильный план.
  const moveFoodItem = (fromMealIdx: number, toMealIdx: number, itemIdx: number, dayIdx: number = 0) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved || resolved.plan === 'day') {
      setDayPlan((prev: any) => {
        if (!prev) return prev;
        const meals = prev.meals.map((m: any) => ({ ...m, items: [...m.items], totals: { ...m.totals } }));
        const item = meals[fromMealIdx]?.items.splice(itemIdx, 1)[0];
        if (!item) return prev;
        if (!meals[toMealIdx]) return prev;
        meals[toMealIdx].items.push(item);
        meals.forEach((m: any, i: number) => { meals[i] = { ...m, totals: { kcal: m.items.reduce((s: number, it: any) => s + it.kcal, 0), p: m.items.reduce((s: number, it: any) => s + it.p, 0), f: m.items.reduce((s: number, it: any) => s + it.f, 0), c: m.items.reduce((s: number, it: any) => s + it.c, 0), fiber: m.items.reduce((s: number, it: any) => s + (it.fiber || 0), 0), leucine_mg: m.items.reduce((s: number, it: any) => s + (it.leucine_mg || 0), 0) } }; });
        const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0), fiber: meals.reduce((s: number, m: any) => s + (m.totals?.fiber || 0), 0), leucine_mg: meals.reduce((s: number, m: any) => s + (m.totals?.leucine_mg || 0), 0) };
        return { ...prev, meals, totals };
      });
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay] && dayIdx === 0) {
        // синхронизируем обратно в недельный план при редактировании его дня
        const prev = weekPlan.days[weekEditDay];
        if (prev?.meals?.[fromMealIdx]?.items?.[itemIdx]) {
          const itm = prev.meals[fromMealIdx].items[itemIdx];
          if (itm) {
            updateMultiDayPlan(weekPlan, weekEditDay, toMealIdx, items => [...items, itm]);
            updateMultiDayPlan(weekPlan, weekEditDay, fromMealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
          }
        }
      }
    } else if (resolved.plan === 'three') {
      const day = threeDayPlan?.days?.[resolved.day];
      if (!day) { setDraggedItem(null); setDropTarget(null); return; }
      saveUndo();
      const fromItems = [...(day.meals[fromMealIdx]?.items || [])];
      const itm = fromItems.splice(itemIdx, 1)[0];
      if (!itm) { setDraggedItem(null); setDropTarget(null); return; }
      // собираем обновлённые meals для этого дня
      const mealsCopy = day.meals.map((m: any, idx: number) => {
        if (idx === fromMealIdx) return { ...m, items: fromItems, totals: calcItemTotals(fromItems) };
        if (idx === toMealIdx) { const toItems = [...m.items, itm]; return { ...m, items: toItems, totals: calcItemTotals(toItems) }; }
        return m;
      });
      // если from и to одинаковые — уже обработали splice, просто обновляем один meal (выше) — но to==from уже пуш+сплайс в одном — поправим:
      // при совпадении from==to нам уже не нужно второй пуш; mealsCopy выше сделала дубль — исправим
      let finalMeals: any[];
      if (fromMealIdx === toMealIdx) {
        const items = [...(day.meals[fromMealIdx].items || [])];
        const moved = items.splice(itemIdx, 1)[0];
        if (moved) items.splice(toMealIdx, 0, moved); // для внутри одного приёма — просто перестановка внутри, но UI пока просто возвращает без перемещения внутри приёма
        finalMeals = day.meals.map((m: any, idx: number) => idx === fromMealIdx ? { ...m, items, totals: calcItemTotals(items) } : m);
      } else {
        finalMeals = mealsCopy;
      }
      const totals = calcMealTotals(finalMeals);
      // E7-фикс: placeholder-вызов updateMultiDayPlan удалён — он дублировал запись,
      // которую делает setThreeDayPlan ниже (двойная запись — риск рассинхрона).
      // напрямую ставим threeDayPlan
      setThreeDayPlan((prev: any) => {
        if (!prev?.days?.[resolved.day]) return prev;
        const days = [...prev.days];
        days[resolved.day] = { ...days[resolved.day], meals: finalMeals, totals };
        const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0), fiber: days.reduce((s: number, d: any) => s + (d.totals?.fiber || 0), 0), leucine_mg: days.reduce((s: number, d: any) => s + (d.totals?.leucine_mg || 0), 0) };
        return { ...prev, days, totals: allTotals };
      });
    } else if (resolved.plan === 'week') {
      const day = weekPlan?.days?.[resolved.day];
      if (!day) { setDraggedItem(null); setDropTarget(null); return; }
      saveUndo();
      const fromItemsOrig = [...(day.meals[fromMealIdx]?.items || [])];
      const itm = fromItemsOrig.splice(itemIdx, 1)[0];
      if (!itm) { setDraggedItem(null); setDropTarget(null); return; }
      const finalMeals = day.meals.map((m: any, idx: number) => {
        if (fromMealIdx === toMealIdx && idx === fromMealIdx) {
          const items = [...(day.meals[idx].items || [])];
          const moved2 = items.splice(itemIdx, 1)[0];
          if (moved2) items.push(moved2);
          return { ...m, items, totals: calcItemTotals(items) };
        }
        if (idx === fromMealIdx) return { ...m, items: fromItemsOrig, totals: calcItemTotals(fromItemsOrig) };
        if (idx === toMealIdx) { const toItems = [...m.items, itm]; return { ...m, items: toItems, totals: calcItemTotals(toItems) }; }
        return m;
      });
      const totals = calcMealTotals(finalMeals);
      setWeekPlan((prev: any) => {
        if (!prev?.days?.[resolved.day]) return prev;
        const days = [...prev.days];
        days[resolved.day] = { ...days[resolved.day], meals: finalMeals, totals };
        const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0), fiber: days.reduce((s: number, d: any) => s + (d.totals?.fiber || 0), 0), leucine_mg: days.reduce((s: number, d: any) => s + (d.totals?.leucine_mg || 0), 0) };
        return { ...prev, days, totals: allTotals };
      });
    }
    setDraggedItem(null); setDropTarget(null);
  };

  const CATEGORY_CLUSTERS: Record<string, string[]> = {
    protein: ['protein', 'dairy'],
    dairy: ['dairy', 'protein', 'fat'],
    grain: ['grain', 'carb', 'veg_fruit'],
    carb: ['carb', 'grain', 'veg_fruit'],
    veg_fruit: ['veg_fruit', 'carb', 'fat'],
    fat: ['fat', 'dairy', 'protein', 'veg_fruit'],
    supplement: ['supplement', 'protein', 'other'],
    fast_food: ['fast_food', 'other', 'grain', 'protein'],
    other: ['other', 'grain', 'fat'],
  };

  const findSimilarFoods = (item: any, count = 5) => {
    const nameMatch = (name: string, query: string) => name?.toLowerCase().includes(query?.toLowerCase()) || query?.toLowerCase().includes(name?.toLowerCase());
    let food: any = FOOD_DB.find(f => f.id === item.id);
    if (!food) food = FOOD_DB.find(f => f.name === item.name);
    if (!food) food = FOOD_DB.find(f => f.name && item.name && nameMatch(f.name, item.name));
    if (!food) food = FOOD_DB.find(f => item.name && f.name && nameMatch(item.name, f.name));
    if (!food) {
      const fallback = FOOD_DB.filter(f => f.id !== item.id).slice(0, count);
      return fallback.map(f => ({ ...f, score: 0 }));
    }
    const clusters = CATEGORY_CLUSTERS[food.category] || [food.category];
    let sameCat = FOOD_DB.filter(f => clusters.includes(f.category) && f.id !== food.id && f.category !== 'supplement');
    if (sameCat.length < 3) sameCat = FOOD_DB.filter(f => f.id !== food.id && f.category !== 'supplement').slice(0, 30);
    const scored = sameCat.map(f => {
      const pDiff = Math.abs(f.protein - food.protein);
      const fDiff = Math.abs(f.fat - food.fat) * 0.5;
      const cDiff = Math.abs(f.carbs - food.carbs) * 0.3;
      const catBonus = f.category === food.category ? 0 : 5;
      const kDiff = Math.abs(f.kcal - food.kcal) * 0.1;
      const score = Math.round(pDiff + fDiff + cDiff + kDiff + catBonus);
      return { ...f, score };
    }).sort((a, b) => a.score - b.score).slice(0, count);
    return scored;
  };
 
  // FIX button-audit: единая конвенция dayIdx — 0 = dayPlan, 1..3 = threeDayPlan.days[dayIdx-1],
  // 7..13 = weekPlan.days[dayIdx-7]. Раньше недельные дни 1..3 попадали в ветку threeDayPlan
  // (замена/удаление в недельном виде молча правили 3-дневную копию).
  const _resolvePlanDay = (dayIdx: number): { plan: any; day: number } | null => {
    if (dayIdx === 0) return { plan: 'day', day: 0 };
    if (dayIdx >= 7 && weekPlan) return { plan: 'week', day: dayIdx - 7 };
    if (dayIdx >= 1 && dayIdx <= 3 && threeDayPlan) return { plan: 'three', day: dayIdx - 1 };
    if (dayIdx >= 1 && dayIdx <= 3 && weekPlan) return { plan: 'week', day: dayIdx - 1 }; // fallback: нет threeDayPlan, но есть week
    return null;
  };

  // FIX button-audit: при открытии дня недели для редактирования dayPlan становится копией
  // этого дня; правки синхронизируются обратно в weekPlan (раньше терялись при возврате к неделе).
  const [weekEditDay, setWeekEditDay] = useState<number | null>(null);
  // E4-fix: правки недели (weekEditDay) в режиме месяца возвращаются в monthPlan[selectedWeek] —
  // раньше возврат к «Списку недель» затирал правки, т.к. monthPlan хранит собственные копии недель.
  // Генерация месяца не затрагивается: weekEditDay = null при генерации (сброс в generatePlan).
  useEffect(() => {
    if (!monthPlanMode || weekEditDay === null) return;
    if (!weekPlan?.days?.length || !monthPlan?.length) return;
    const wi = selectedWeek ?? 0;
    if (!monthPlan[wi] || monthPlan[wi] === weekPlan) return;
    setMonthPlan(prev => { const next = [...prev]; next[wi] = weekPlan; return next; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPlan, monthPlanMode, weekEditDay, selectedWeek]);
  const openWeekDayForEdit = (di: number) => {
    if (!weekPlan?.days?.[di]) return;
    try { setDayPlan(JSON.parse(JSON.stringify(weekPlan.days[di]))); } catch { setDayPlan(weekPlan.days[di]); }
    setWeekEditDay(di);
    setPlanDays(1);
    setSelectedDayIndex(di);
  };
  const switchPlanDays = (d: 1 | 3 | 7) => {
    if (d !== 1) setWeekEditDay(null);
    setPlanDays(d);
  };
  const _applyDayPlanMealUpdate = (mealIdx: number, updater: (items: any[]) => any[]) => {
    setDayPlan((prev: any) => updateMealsInPlan(prev, mealIdx, updater));
    if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
      updateMultiDayPlan(weekPlan, weekEditDay, mealIdx, updater);
    }
  };

  // FIX per100 + dedup: честный per100 расчёт + защита от дубля (две каши)
  const addFoodToMeal = (dayIdx: number, mealIdx: number, food: any) => {
    if (!food || !food.name) return;
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]) return;
    // dedup: тот же id уже в приёме — не плодим дубли, предлагаем изменить граммовку
    if (dayData.meals[mealIdx].items.some((it: any) => it.id === food.id)) {
      try { setErrorMsg('Этот продукт уже в приёме — измените граммовку'); setTimeout(() => setErrorMsg(null), 2500); } catch {}
      return;
    }
    saveUndo();
    // per100 invariant: граммы из servingSize (30г для порошка) или 100г, spice ≤10г
    let grams = parseServingSizeGrams(food.servingSize);
    if (!grams || !Number.isFinite(grams) || grams <= 0) grams = 100;
    // spice/other limit 10г (корица 247ккал/100г → 37г абсурд)
    if (food.category === 'other' && grams > 10) grams = 10;
    if (food.id && String(food.id).startsWith('spice_') && grams > 10) grams = 10;
    const ratio = grams / 100;
    const leuPer100 = (food as any).amino_acid_profile_100g?.leucine_mg ?? (food.micros?.Leucine != null ? (food.micros.Leucine as number) : Math.round((food.protein || 0) * 75));
    const _p = Math.round((food.protein || 0) * ratio * 10) / 10;
    const _f = Math.round((food.fat || 0) * ratio * 10) / 10;
    const _c = Math.round((food.carbs || 0) * ratio * 10) / 10;
    // KBЖУ-консистентность ≤3%: kcal из формулы
    const item = { name: food.name, id: food.id, amount: grams, kcal: Math.round(4 * _p + 9 * _f + 4 * _c), p: _p, f: _f, c: _c, fiber: Math.round((food.fiber || 0) * ratio * 10) / 10, leucine_mg: Math.round(leuPer100 * ratio) };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => [...items, item]);
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => [...items, item]);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => [...items, item]);
    }
  };

  // E7: быстрый «порошок + хлопья» в перекус — протеин-изолят + овсяные хлопья с фиксированной дозировкой.
  const addSnackComboToMeal = (dayIdx: number, mealIdx: number) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]) return;
    const mk = (f: any, grams: number) => { const p = Math.round((f.protein || 0) * grams / 100), f2 = Math.round((f.fat || 0) * grams / 100), c = Math.round((f.carbs || 0) * grams / 100); return { name: f.name, id: f.id, amount: grams, kcal: Math.round(4 * p + 9 * f2 + 4 * c), p, f: f2, c, fiber: Math.round((f.fiber || 0) * grams / 100) }; };
    const whey = FOOD_DB.find(f => f.id === 'whey_isolate') || FOOD_DB.find(f => f.id === 'whey_protein');
    const isWorkDayForAdd = (()=>{ try{ if(!workScheduleEnabled) return false; if(workScheduleType==='standard') return !!workDays[dayIdx%7]; if(workScheduleType==='sliding'||workScheduleType==='custom') return !!workDays[dayIdx%7]; return !!workDays[dayIdx%7]; }catch{ return false; }})();
    const usePortable = workFood === 'portable' && isWorkDayForAdd;
    const oats = FOOD_DB.find(f => f.id === (usePortable ? 'oats_dry' : 'oats')) || FOOD_DB.find(f => f.id === 'oats_dry') || FOOD_DB.find(f => f.id === 'oats');
    const additions = [] as any[];
    if (whey) additions.push(mk(whey, 30));
    if (oats) additions.push(mk(oats, usePortable ? 70 : 50));
    // полноценная еда на работе — добавляем орехи/фрукт для баланса
    if (usePortable) {
      const alm = FOOD_DB.find(f => f.id === 'almonds');
      if (alm) additions.push(mk(alm, 15));
    }
    if (additions.length === 0) return;
    saveUndo();
    const apply = (items: any[]) => [...items, ...additions];
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, apply);
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, apply);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, apply);
    }
  };

  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    if (!newFood || typeof newFood !== 'object' || !newFood.name) return; // FIX button-audit: guard
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    saveUndo();
    const old = dayData.meals[mealIdx].items[itemIdx];
    // per100 invariant: сохраняем граммы старого приёма (не servingSize нового), пересчитываем КБЖУ честно per100
    let grams = old.amount || 100;
    if (newFood.category === 'other' && grams > 10) grams = 10;
    if (newFood.id && String(newFood.id).startsWith('spice_') && grams > 10) grams = 10;
    const ratio = grams / 100;
    const leuPer100 = (newFood as any).amino_acid_profile_100g?.leucine_mg ?? (newFood.micros?.Leucine != null ? (newFood.micros.Leucine as number) : Math.round((newFood.protein || 0) * 75));
    const replacement = { ...old, name: newFood.name, id: newFood.id, amount: grams, kcal: (() => { const p = Math.round((newFood.protein || 0) * ratio * 10) / 10, f = Math.round((newFood.fat || 0) * ratio * 10) / 10, c = Math.round((newFood.carbs || 0) * ratio * 10) / 10; return Math.round(4 * p + 9 * f + 4 * c); })(), p: Math.round((newFood.protein || 0) * ratio * 10) / 10, f: Math.round((newFood.fat || 0) * ratio * 10) / 10, c: Math.round((newFood.carbs || 0) * ratio * 10) / 10, fiber: Math.round((newFood.fiber || 0) * ratio * 10) / 10, leucine_mg: Math.round(leuPer100 * ratio) };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => { items[itemIdx] = replacement; return items; });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => { items[itemIdx] = replacement; return items; });
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => { items[itemIdx] = replacement; return items; });
    }
    setReplacingItem(null);
  };

  const updateItemAmount = (dayIdx: number, mealIdx: number, itemIdx: number, newAmount: number) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) { setEditItem(null); return; }
    const it = dayData.meals[mealIdx].items[itemIdx];
    // spice hard cap 10г
    let amt = Math.max(1, newAmount);
    if (String(it.id || '').startsWith('spice_') && amt > 10) amt = 10;
    const ratio = amt / Math.max(1, it.amount || 1);
    const scaled = { ...it, amount: amt, kcal: Math.round((it.kcal || 0) * ratio), p: Math.round((it.p || 0) * ratio), f: Math.round((it.f || 0) * ratio), c: Math.round((it.c || 0) * ratio), fiber: Math.round((it.fiber || 0) * ratio), leucine_mg: Math.round((it.leucine_mg || 0) * ratio) };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => { items[itemIdx] = scaled; return items; });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => { items[itemIdx] = scaled; return items; });
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => { items[itemIdx] = scaled; return items; });
    }
    setEditItem(null);
  };

  const removeFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    saveUndo();
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
    }
  };

  // ─── Режим «по рецептам»: синк закупок + выбор варианта / другие варианты ───
  // F: закупки всегда отражают фактическое содержимое планов (в т.ч. ингредиенты рецептов)
  const syncShoppingListFromPlans = () => {
    try {
      let plans: any[] = [];
      if (planDays >= 7 && weekPlan?.days?.length) plans = weekPlan.days;
      else if (planDays >= 3 && threeDayPlan?.days?.length) plans = threeDayPlan.days;
      else if (dayPlan) plans = [dayPlan];
      if (plans.length > 0) setShoppingList(buildShoppingFromPlans(plans));
    } catch {}
  };

  /** Пересборка приёма из выбранного варианта рецепта + ребаланс дня до ±3%. */
  const rebuildMealsWithRecipeOption = (mealsSrc: any[], mealIdx: number, optionName: string): { ok: boolean; meals?: any[]; notes?: string[] } => {
    if (!Array.isArray(mealsSrc) || mealIdx < 0 || mealIdx >= mealsSrc.length) return { ok: false };
    const m = mealsSrc[mealIdx];
    const flat: FlatRecipeOption | undefined = (m?.recipeOptions || []).find((o: FlatRecipeOption) => o?.name === optionName);
    if (!flat) return { ok: false };
    const _tgt = m?.target || { p: m?.totals?.p ?? 30, c: m?.totals?.c ?? 40, f: m?.totals?.f ?? 15 };
    const _tKcal = m?.totals?.kcal || Math.round((_tgt.p || 0) * 4 + (_tgt.c || 0) * 4 + (_tgt.f || 0) * 9) || 300;
    const scaled = scaleRecipeToTarget(rebuildRecipeFromFlat(flat), { kcal: _tKcal, p: _tgt.p || 30, f: _tgt.f || 15, c: _tgt.c || 40 }, weight);
    const items = scaled ? scaled.items : buildRecipeMealItems(rebuildRecipeFromFlat(flat));
    if (!items || items.length === 0) return { ok: false };
    const flatScaled: FlatRecipeOption = scaled ? { ...flat, appliedScale: scaled.scale } : flat;
    const next = mealsSrc.map((x: any, i: number) => i === mealIdx
      ? { ...x, items, totals: sumMealTotals(items), recipeApplied: flat.name, recipeAppliedData: flatScaled }
      : x);
    const pre = sumDayTotals(next as any);
    const rb = rebalanceDayAfterRecipes(next as any, {
      kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
      p: effectiveP > 0 ? effectiveP : pre.p,
      f: effectiveF > 0 ? effectiveF : pre.f,
      c: effectiveC > 0 ? effectiveC : pre.c,
    });
    return { ok: true, meals: rb.meals as any[], notes: rb.notes };
  };

  const sumMultiTotals = (days: any[]) => ({
    kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0),
    p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0),
    f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0),
    c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0),
  });

  /** ♻️ Пропуск приёма: удаляем и пересобираем день — недобор закрывается топ-апами
   *  в гибкие слоты (ребаланс ±3%), рецепт-дни защищены. Работает во всех режимах. */
  const removeMealRebalanced = (dayIdx: number, mealIdx: number) => {
    saveUndo();
    const rebuildWithoutMeal = (mealsSrc: any[] | undefined): { ok: boolean; meals?: any[]; removedLabel?: string; removedKcal?: number; notes?: string[] } => {
      if (!Array.isArray(mealsSrc) || mealIdx < 0 || mealIdx >= mealsSrc.length) return { ok: false };
      const removed = mealsSrc[mealIdx];
      const remaining = mealsSrc.filter((_, i) => i !== mealIdx);
      if (remaining.length === 0) return { ok: false };
      const pre = sumDayTotals(remaining as any);
      const rb = rebalanceDayAfterRecipes(remaining as any, {
        kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
        p: effectiveP > 0 ? effectiveP : pre.p,
        f: effectiveF > 0 ? effectiveF : pre.f,
        c: effectiveC > 0 ? effectiveC : pre.c,
      });
      const notes = [`♻️ Приём «${removed.label || 'Приём'}» (${Math.round(removed.totals?.kcal || 0)} ккал) пропущен — день пересобран`, ...rb.notes];
      return { ok: true, meals: rb.meals as any[], removedLabel: removed.label, removedKcal: removed.totals?.kcal || 0, notes };
    };
    const attachNotes = (day: any, notes: string[]) => ({ ...day, proNotes: [...(day.proNotes || []), ...notes] });

    if (dayIdx === 0) {
      const res = rebuildWithoutMeal(dayPlan?.meals);
      if (!res.ok || !res.meals) return;
      let weekDaysUpdated: any[] | null = null;
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const wres = rebuildWithoutMeal(weekPlan.days[weekEditDay].meals);
        const days = [...weekPlan.days];
        days[weekEditDay] = wres.ok && wres.meals
          ? attachNotes({ ...days[weekEditDay], meals: wres.meals, totals: sumDayTotals(wres.meals as any) }, res.notes ?? [])
          : attachNotes({ ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? []);
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        weekDaysUpdated = days;
      }
      setDayPlan(attachNotes({ ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? []));
      const visiblePlans: any[] =
        planDays >= 7 && weekPlan?.days?.length
          ? (weekDaysUpdated ?? weekPlan.days)
          : planDays >= 3 && threeDayPlan?.days?.length
            ? threeDayPlan.days.map((d: any, i: number) => (i === selectedDayIndex ? attachNotes({ ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? []) : d))
            : [attachNotes({ ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? [])];
      setShoppingList(buildShoppingFromPlans(visiblePlans));
      refreshRecipeCookingCardIfActive(attachNotes({ ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? []), threeDayPlan, weekDaysUpdated ? { days: weekDaysUpdated } : weekPlan);
    } else {
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved || resolved.plan === 'day') return;
      const srcPlan: any = resolved.plan === 'three' ? threeDayPlan : weekPlan;
      if (!srcPlan?.days?.[resolved.day]) return;
      const days = [...srcPlan.days];
      const res = rebuildWithoutMeal(days[resolved.day].meals);
      if (!res.ok || !res.meals) return;
      days[resolved.day] = attachNotes({ ...days[resolved.day], meals: res.meals, totals: sumDayTotals(res.meals as any) }, res.notes ?? []);
      const updated = { ...srcPlan, days, totals: sumMultiTotals(days) };
      if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      if (resolved.plan === 'week') setDayPlan(days[resolved.day]);
      else if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
      setShoppingList(buildShoppingFromPlans(days));
      refreshRecipeCookingCardIfActive(resolved.plan === 'week' ? days[resolved.day] : dayPlan, resolved.plan === 'three' ? updated : threeDayPlan, resolved.plan === 'week' ? updated : weekPlan);
    }
    if (typeof (window as any).showToast === 'function') (window as any).showToast('♻️ День пересобран без пропущенного приёма', 'success');
  };

  // Эпик E: единые операции правки дня, синхронные в weekPlan при weekEditDay
  // (раньше 🕒-время/дубль из MealListRender и QuickControls писали только dayPlan —
  // правки недели терялись при возврате).
  const updateMealTime = (mealIdx: number, time: string) => {
    saveUndo();
    const applyTime = (meals: any[]) => meals.map((m: any, i: number) => (i === mealIdx ? { ...m, time } : m));
    setDayPlan((prev: any) => {
      if (!prev?.meals?.[mealIdx]) return prev;
      const meals = applyTime(prev.meals);
      return { ...prev, meals, totals: sumDayTotals(meals as any) };
    });
    if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
      const days = [...weekPlan.days];
      const d = JSON.parse(JSON.stringify(days[weekEditDay]));
      if (d?.meals?.[mealIdx]) {
        d.meals = applyTime(d.meals);
        d.totals = sumDayTotals(d.meals);
        days[weekEditDay] = d;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
      }
    }
  };

  const duplicateMeal = (mealIdx: number) => {
    const src = dayPlan?.meals?.[mealIdx];
    if (!src) return;
    saveUndo();
    const insertAfter = (meals: any[]): any[] => {
      const copy = JSON.parse(JSON.stringify(src));
      copy.label = (copy.label || 'Приём') + ' (копия)';
      const [h, m2] = (copy.time || '12:00').split(':').map(Number);
      const t = h * 60 + m2 + 30;
      copy.time = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const out = meals.slice();
      out.splice(Math.min(mealIdx + 1, out.length), 0, copy);
      return out;
    };
    setDayPlan((prev: any) => {
      if (!prev?.meals) return prev;
      const meals = insertAfter(prev.meals);
      return { ...prev, meals, totals: sumDayTotals(meals as any) };
    });
    if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
      const days = [...weekPlan.days];
      const d = JSON.parse(JSON.stringify(days[weekEditDay]));
      if (d?.meals) {
        d.meals = insertAfter(d.meals);
        d.totals = sumDayTotals(d.meals);
        days[weekEditDay] = d;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
      }
    }
    if (typeof (window as any).showToast === 'function') (window as any).showToast('📋 Приём продублирован', 'success');
  };

  const pickRecipeOption = (dayIdx: number, mealIdx: number, optionName: string) => {    saveUndo();
    if (dayIdx === 0) {
      const res = rebuildMealsWithRecipeOption(dayPlan?.meals || [], mealIdx, optionName);
      if (!res.ok || !res.meals) return;
      const newDay = { ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) };
      // FIX button-audit: синхронизация правки обратно в недельный план
      let weekDaysUpdated: any[] | null = null;
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const days = [...weekPlan.days];
        const wres = rebuildMealsWithRecipeOption(days[weekEditDay].meals || [], mealIdx, optionName);
        days[weekEditDay] = wres.ok && wres.meals ? { ...days[weekEditDay], meals: wres.meals } : newDay;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        weekDaysUpdated = days;
      }
      setDayPlan(newDay);
      // F: закупки пересчитываются из ВСЕХ видимых дней плана (отредактированный день
      // подставлен), а не только из одного дня — иначе список «сжимался» до дня правки.
      const visiblePlans: any[] =
        planDays >= 7 && weekPlan?.days?.length
          ? (weekDaysUpdated ?? weekPlan.days)
          : planDays >= 3 && threeDayPlan?.days?.length
            ? threeDayPlan.days.map((d: any, i: number) => (i === selectedDayIndex ? newDay : d))
            : [newDay];
      setShoppingList(buildShoppingFromPlans(visiblePlans));
      // A4: открытая карточка готовки следует за выбранным рецептом
      refreshRecipeCookingCardIfActive(newDay, threeDayPlan, weekDaysUpdated ? { days: weekDaysUpdated } : weekPlan);
    } else {
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved || resolved.plan === 'day') return;
      const srcPlan: any = resolved.plan === 'three' ? threeDayPlan : weekPlan;
      if (!srcPlan?.days?.[resolved.day]) return;
      const days = [...srcPlan.days];
      const res = rebuildMealsWithRecipeOption(days[resolved.day].meals || [], mealIdx, optionName);
      if (!res.ok || !res.meals) return;
      days[resolved.day] = { ...days[resolved.day], meals: res.meals, totals: sumDayTotals(res.meals as any) };
      const updated = { ...srcPlan, days, totals: sumMultiTotals(days) };
      if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      if (resolved.plan === 'week') setDayPlan(days[resolved.day]);
      else if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
      setShoppingList(buildShoppingFromPlans(days));
      // A4: открытая карточка готовки следует за выбранным рецептом
      refreshRecipeCookingCardIfActive(resolved.plan === 'week' ? days[resolved.day] : dayPlan, resolved.plan === 'three' ? updated : threeDayPlan, resolved.plan === 'week' ? updated : weekPlan);
    }
    if (typeof (window as any).showToast === 'function') (window as any).showToast('🍳 Рацион перестроен под рецепт', 'success');
    setRecipePickerMeal(null);
  };

  const moreRecipeOptions = (dayIdx: number, mealIdx: number) => {
    let cur: any = null;
    if (dayIdx === 0) cur = dayPlan;
    else {
      const resolved = _resolvePlanDay(dayIdx);
      cur = resolved?.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : resolved?.plan === 'week' ? weekPlan?.days?.[resolved.day] : null;
    }
    const m = cur?.meals?.[mealIdx];
    if (!m) return;
    const pool = [...getRecipes(), ...(userRecipes || [])];
    const prof = cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking });
    const filtered = filterByCookSkill(pool, prof.skill);
    const budget = prepTimeBudgetPerMeal(prof, mealsCount);
    const tgt = m.target || { p: m.totals.p, c: m.totals.c, f: m.totals.f };
    const excludeNames = new Set<string>(m.recipeOptionNames || []);
    const cands = pickRecipeOptions(filtered, {
      mealType: mealTypeFromLabel(m.label),
      targetKcal: m.totals.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15,
      excludedIds: new Set<string>(excludedFoods || []), cookProfile: prof, isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: budget,
      preferredRecipeNames: favoriteRecipes.size > 0 ? favoriteRecipes : undefined,
    }, 3, excludeNames);
    if (cands.length === 0) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast('Других подходящих рецептов для этого приёма нет', 'warning');
      return;
    }
    const flats: FlatRecipeOption[] = cands.map(flattenRecipeOption);
    const allNames = Array.from(new Set([...(m.recipeOptionNames || []), ...flats.map(f => f.name)]));
    const patchMeal = (mm: any) => ({ ...mm, recipeOptions: flats, recipeOptionNames: allNames });
    if (dayIdx === 0) {
      setDayPlan((prev: any) => {
        if (!prev || !Array.isArray(prev.meals) || !prev.meals[mealIdx]) return prev;
        const meals = [...prev.meals];
        meals[mealIdx] = patchMeal(meals[mealIdx]);
        return { ...prev, meals };
      });
    } else {
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved || resolved.plan === 'day') return;
      const srcPlan: any = resolved.plan === 'three' ? threeDayPlan : weekPlan;
      if (!srcPlan?.days?.[resolved.day]) return;
      const days = [...srcPlan.days];
      const dayMeals = [...(days[resolved.day].meals || [])];
      if (!dayMeals[mealIdx]) return;
      dayMeals[mealIdx] = patchMeal(dayMeals[mealIdx]);
      days[resolved.day] = { ...days[resolved.day], meals: dayMeals };
      const updated = { ...srcPlan, days };
      if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
    }
  };

  const refreshRecipeSuggestions = (dayIdx = 0) => {
    let source: any = null;
    let applyTo: (meals: any[]) => void = () => {};
    if (dayIdx === 0) {
      source = dayPlan;
      applyTo = (meals) => setDayPlan((prev: any) => (prev ? { ...prev, meals } : prev));
    } else {
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved || resolved.plan === 'day') return;
      const srcPlan: any = resolved.plan === 'three' ? threeDayPlan : weekPlan;
      source = srcPlan?.days?.[resolved.day];
      applyTo = (meals) => {
        if (!srcPlan?.days?.[resolved.day]) return;
        const days = [...srcPlan.days];
        days[resolved.day] = { ...days[resolved.day], meals };
        const updated = { ...srcPlan, days };
        if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      };
    }
    if (!source?.meals) return;
    const poolAll = filterByCookSkill([...getRecipes(), ...(userRecipes || [])], cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking }).skill);
    const labelMap: Record<string, 'breakfast'|'lunch'|'snack'|'dinner'|'preworkout'|'postworkout'|'presleep'> = {
      'Завтрак': 'breakfast', 'Обед': 'lunch', 'Ужин': 'dinner', 'Перекус': 'snack', 'Второй завтрак': 'snack',
      'Полдник': 'snack', 'Предтрен': 'preworkout', 'Пост-трен': 'postworkout', 'Перед сном': 'presleep',
    };
    const budget = prepTimeBudgetPerMeal(cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking }), mealsCount);
    const nextMeals = source.meals.map((m: any) => {
      // B7: копим показанные имена между обновлениями — «🔄» не крутит одни и те же рецепты
      const seen = new Set<string>([...((m.recipeSuggestions || []).map((r: any) => r?.name).filter(Boolean)), ...((m as any).suggestionSeenNames || [])]);
      const tgt = m.target || { p: m.totals.p, c: m.totals.c, f: m.totals.f };
      const sugg = pickRecipeOptions(poolAll, {
        mealType: (labelMap[m.label] || 'lunch'),
        targetKcal: m.totals.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15,
        excludedIds: new Set<string>(excludedFoods || []),
        isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: budget,
        preferredRecipeNames: favoriteRecipes.size > 0 ? favoriteRecipes : undefined,
      }, 3, seen);
      return { ...m,
        recipeSuggestions: sugg.map(r => ({ name: r.name, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, prepTimeMin: r.prepTimeMin, usefulness: r.usefulness, description: r.description, ingredients: r.ingredients, instructions: r.instructions, tags: r.tags })),
        suggestionSeenNames: Array.from(new Set([...seen, ...sugg.map(r => r.name)])),
      };
    });
    applyTo(nextMeals);
    if (typeof (window as any).showToast === 'function') (window as any).showToast('🔄 Подобраны другие рецепты', 'success');
  };

  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number, dayIdx = 0) => {
    saveUndo();
    // P0-fix: пропорциональное распределение КБЖУ по ингредиентам рецепта вместо хардкода 100г.
    // Каждый ингредиент получает долю kcal = recipe.kcal / N, а граммовка выводится из
    // энергетической плотности продукта (kcal/100g). Белок/жиры/угл берутся из FOOD_DB
    // и масштабируются к фактической граммовке, а не к 100г.
    // МАСШТАБ (Роунд «второй рецепт»): порция рецепта масштабируется к ЦЕЛИ приёма по КБЖУ —
    // атлет 100 кг и 80 кг получают разные граммовки одного рецепта (scaleRecipeToTarget).
    const buildRecipeItems = (targetKcal: number, targetP: number, targetF: number, targetC: number) => {
      const scaled = scaleRecipeToTarget(recipe, { kcal: targetKcal, p: targetP, f: targetF, c: targetC }, weight);
      if (scaled && scaled.items.length > 0) {
        return { items: scaled.items.map(it => ({ name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c, fiber: it.fiber })), scale: scaled.scale };
      }
      // fallback: старый равный сплит (рецепт без ingredientIds / пустой разбор)
      const n = Math.max(1, recipe.ingredients.length);
      const perItemKcal = recipe.kcal / n;
      const items = recipe.ingredients.map((ing) => {
        const lower = ing.toLowerCase();
        const food = FOOD_DB.find(f => lower.includes(f.name.toLowerCase()) || lower.includes(f.id));
        if (food) {
          let grams = food.kcal > 0 ? Math.round(perItemKcal / food.kcal * 100) : 100;
          if (food.category === 'grain' && grams < 50) grams = 50;
          if (food.id === 'oats' && grams < 60) grams = 60;
          const ratio = grams / 100;
          const _p = Math.round((food.protein || 0) * ratio * 10) / 10;
          const _f = Math.round((food.fat || 0) * ratio * 10) / 10;
          const _c = Math.round((food.carbs || 0) * ratio * 10) / 10;
          return { name: food.name, id: food.id, amount: grams, kcal: Math.round(4 * _p + 9 * _f + 4 * _c), p: _p, f: _f, c: _c, fiber: Math.round((food.fiber || 0) * ratio * 10) / 10 };
        }
        const fbP = Math.round(recipe.protein / n * 10) / 10;
        const fbF = Math.round(recipe.fat / n * 10) / 10;
        const fbC = Math.round(recipe.carbs / n * 10) / 10;
        return { name: ing, id: ing, amount: 100, kcal: Math.round(4 * fbP + 9 * fbF + 4 * fbC), p: fbP, f: fbF, c: fbC };
      });
      return { items, scale: 1 };
    };
    let _outerResMeals: any[] | null = null;
    let _outerVisibleMealsForOptions: any[] | null = null;
    if (dayIdx === 0) {
      // Полное применение: приём = рецепт (авторские порции), затем ребаланс дня до ±3%
      // (рецепт помечается recipeApplied → защищён от резки), синк закупок и готовки.
      const flatOpt = flattenRecipeOption(recipe);
      const applyRebalanced = (mealsSrc: any[] | undefined): any[] | null => {
        if (!Array.isArray(mealsSrc) || mealIdx < 0 || mealIdx >= mealsSrc.length) return null;
        const _mt = mealsSrc[mealIdx];
        const _tgt = _mt?.target || { p: _mt?.totals?.p ?? 30, c: _mt?.totals?.c ?? 40, f: _mt?.totals?.f ?? 15 };
        const _tKcal = _mt?.totals?.kcal || Math.round((_tgt.p || 0) * 4 + (_tgt.c || 0) * 4 + (_tgt.f || 0) * 9) || 300;
        const built = buildRecipeItems(_tKcal, _tgt.p || 30, _tgt.f || 15, _tgt.c || 40);
        const items = built.items;
        const appliedScale = built.scale;
        const flatOptScaled = flatOpt ? { ...flatOpt, appliedScale } : flatOpt;
        const patched = mealsSrc.map((x, i) => i === mealIdx
          ? { ...x, items, totals: calcItemTotals(items), recipeApplied: recipe.name, recipeAppliedData: flatOptScaled }
          : x);
        const pre = sumDayTotals(patched as any);
        const rb = rebalanceDayAfterRecipes(patched as any, {
          kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
          p: effectiveP > 0 ? effectiveP : pre.p,
          f: effectiveF > 0 ? effectiveF : pre.f,
          c: effectiveC > 0 ? effectiveC : pre.c,
        });
        return rb.meals as any[];
      };
      const resMeals = applyRebalanced(dayPlan?.meals);
      if (!resMeals) return;
      _outerResMeals = resMeals;
      _outerVisibleMealsForOptions = resMeals;
      const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} уникальных продуктов` }; })();
      const newDay = { ...dayPlan, meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
      // FIX button-audit: синхронизация правки обратно в недельный план
      let weekDaysUpdated: any[] | null = null;
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const wres = applyRebalanced(weekPlan.days[weekEditDay].meals);
        const days = [...weekPlan.days];
        days[weekEditDay] = wres ? { ...days[weekEditDay], meals: wres } : newDay;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        weekDaysUpdated = days;
      }
      setDayPlan(newDay);
      // F: закупки из ВСЕХ видимых дней плана (отредактированный день подставлен)
      const visiblePlans: any[] =
        planDays >= 7 && weekPlan?.days?.length
          ? (weekDaysUpdated ?? weekPlan.days)
          : planDays >= 3 && threeDayPlan?.days?.length
            ? threeDayPlan.days.map((d: any, i: number) => (i === selectedDayIndex ? newDay : d))
            : [newDay];
      setShoppingList(buildShoppingFromPlans(visiblePlans));
      refreshRecipeCookingCardIfActive(newDay, threeDayPlan, weekDaysUpdated ? { days: weekDaysUpdated } : weekPlan);
    } else {
      // FIX button-audit: недельные дни (dayIdx >= 7) идут в weekPlan, 1..3 — в threeDayPlan
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved || resolved.plan === 'day') { setRecipePickerMeal(null); return; }
      const srcPlan: any = resolved.plan === 'three' ? threeDayPlan : weekPlan;
      if (!srcPlan?.days?.[resolved.day]) return;
      const flatOpt = flattenRecipeOption(recipe);
      const applyRebalanced2 = (mealsSrc: any[]): any[] | null => {
        if (!Array.isArray(mealsSrc) || mealIdx < 0 || mealIdx >= mealsSrc.length) return null;
        const _mt = mealsSrc[mealIdx];
        const _tgt = _mt?.target || { p: _mt?.totals?.p ?? 30, c: _mt?.totals?.c ?? 40, f: _mt?.totals?.f ?? 15 };
        const _tKcal = _mt?.totals?.kcal || Math.round((_tgt.p || 0) * 4 + (_tgt.c || 0) * 4 + (_tgt.f || 0) * 9) || 300;
        const built = buildRecipeItems(_tKcal, _tgt.p || 30, _tgt.f || 15, _tgt.c || 40);
        const items = built.items;
        const flatOptScaled = flatOpt ? { ...flatOpt, appliedScale: built.scale } : flatOpt;
        const patched = mealsSrc.map((x, i) => i === mealIdx
          ? { ...x, items, totals: calcItemTotals(items), recipeApplied: recipe.name, recipeAppliedData: flatOptScaled }
          : x);
        const pre = sumDayTotals(patched as any);
        const rb = rebalanceDayAfterRecipes(patched as any, {
          kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
          p: effectiveP > 0 ? effectiveP : pre.p,
          f: effectiveF > 0 ? effectiveF : pre.f,
          c: effectiveC > 0 ? effectiveC : pre.c,
        });
        return rb.meals as any[];
      };
      const resMeals = applyRebalanced2(srcPlan.days[resolved.day].meals);
      if (!resMeals) return;
      _outerResMeals = resMeals;
      _outerVisibleMealsForOptions = resMeals;
      const days = [...srcPlan.days];
      days[resolved.day] = { ...srcPlan.days[resolved.day], meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} уникальных продуктов` }; })() };
      const updated = { ...srcPlan, days, totals: sumMultiTotals(days) };
      if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      if (resolved.plan === 'week') setDayPlan(days[resolved.day]);
      else if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
      setShoppingList(buildShoppingFromPlans(days));
      refreshRecipeCookingCardIfActive(resolved.plan === 'week' ? days[resolved.day] : dayPlan, resolved.plan === 'three' ? updated : threeDayPlan, resolved.plan === 'week' ? updated : weekPlan);
    }
    // Пересобираем нижние карточки (recipeOptions) для всех приёмов — иначе после замены нижние не перестраиваются и нет второго выбора
    try {
      const allMealsForOptions = _outerResMeals || _outerVisibleMealsForOptions || (dayIdx !== 0 ? ((): any => { const r = _resolvePlanDay(dayIdx); if (!r) return null; const p = r.plan==='three'? threeDayPlan : r.plan==='week'? weekPlan : null; return p?.days?.[r.day]?.meals; })() : null);
      if (allMealsForOptions && Array.isArray(allMealsForOptions)) {
        const excludedIds = new Set<string>(excludedFoods || []);
        const poolForOptions = [...getRecipes(), ...(userRecipes||[])].filter(r=> !excludedIds.has(r.name));
        for (let i=0; i<allMealsForOptions.length; i++) {
          const m = allMealsForOptions[i];
          if (i===mealIdx) continue; // заменённый уже имеет
          if (!m || m.recipeApplied) continue; // уже выбранный рецепт — не трогаем
          const label = m.label || '';
          const isMainOpt = ['Завтрак','Обед','Ужин'].includes(label);
          if (!isMainOpt && !/Перекус|Полдник/.test(label)) continue;
          const tgt = (m as any).target || { p: m.totals?.p ?? 30, c: m.totals?.c ?? 40, f: m.totals?.f ?? 15 };
          const tKcal = m.totals?.kcal || Math.round((tgt.p||0)*4 + (tgt.c||0)*4 + (tgt.f||0)*9) || 300;
          const opts = { mealType: label==='Завтрак'?'breakfast': label==='Обед'?'lunch': label==='Ужин'?'dinner':'snack' as any, targetKcal:tKcal, targetProteinG:tgt.p||30, targetCarbsG:tgt.c||40, targetFatG:tgt.f||15, excludedIds, isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: 60 };
          const picks = pickRecipesForMeal(poolForOptions as any, opts as any, 3);
          if (picks.length>0) {
            const flats = picks.map(r=> flattenRecipeOption(r));
            (m as any).recipeOptions = flats;
            (m as any).recipeOptionNames = flats.map(f=>f.name);
          }
        }
      }
    } catch {}
    if (typeof (window as any).showToast === 'function') (window as any).showToast('🍳 Рецепт применён — рацион перестроен', 'success');
    setTimeout(() => syncShoppingListFromPlans(), 0);
    setRecipePickerMeal(null);
  };

  /**
   * Добавление ВТОРОГО рецепта в приём, где уже выбран первый. Два блюда делят цель приёма:
   * второй масштабируется к ОСТАТКУ (цель приёма − факт первого рецепта), совместимость
   * проверяется (не дубль, не тот же белковый/углеводный профиль). Продукты обоих рецептов
   * объединяются, приём помечается recipeApplied2/recipeAppliedData2.
   */
  const addSecondRecipeToMeal = (recipe: Recipe, mealIdx: number, dayIdx: number) => {
    const resolveMeals = (): { meals: any[]; plan: 'day' | 'three' | 'week'; day: number } | null => {
      if (dayIdx === 0) return { meals: dayPlan?.meals || [], plan: 'day', day: 0 };
      const r = _resolvePlanDay(dayIdx);
      if (!r || r.plan === 'day') return null;
      const p: any = r.plan === 'three' ? threeDayPlan : weekPlan;
      if (!p?.days?.[r.day]) return null;
      return { meals: p.days[r.day].meals, plan: r.plan, day: r.day };
    };
    const resolved = resolveMeals();
    if (!resolved || mealIdx < 0 || mealIdx >= resolved.meals.length) { setRecipePickerMeal(null); return; }
    const m = resolved.meals[mealIdx];
    if (!m || !m.recipeApplied) { setRecipePickerMeal(null); return; }
    // Совместимость
    const comp = recipeCompatibility(m.recipeAppliedData as any, recipe as any);
    if (!comp.compatible) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast(`⚠ ${comp.reason}`, 'warning');
      setRecipePickerMeal(null);
      return;
    }
    saveUndo();
    // Масштабирование ВТОРОГО рецепта к ОСТАТКУ цели приёма (цель − факт первого).
    // Оба рецепта остаются и оба масштабируются под КБЖУ приёма атлета. Если первый уже
    // закрыл/перебрал приём — второй берётся минимальной порцией (право пользователя,
    // не «выдавливаем» первый рецепт).
    const _mt = m?.target || { p: m?.totals?.p ?? 30, c: m?.totals?.c ?? 40, f: m?.totals?.f ?? 15 };
    const _targetKcal = Math.round((_mt.p || 0) * 4 + (_mt.f || 0) * 9 + (_mt.c || 0) * 4) || m?.totals?.kcal || 300;
    const _firstKcal = m?.totals?.kcal || 0;
    const _roomKcal = Math.max(150, _targetKcal - _firstKcal);
    const scaled2 = scaleRecipeToTarget(recipe, { kcal: _roomKcal, p: _mt.p || 30, f: _mt.f || 15, c: _mt.c || 40 }, weight);
    const items2 = scaled2 ? scaled2.items : buildRecipeMealItems(recipe);
    if (!items2 || items2.length === 0) { setRecipePickerMeal(null); return; }
    const mergedItems = [...(m.items || []), ...items2];
    const flat2 = flattenRecipeOption(recipe);
    if (scaled2) flat2.appliedScale = scaled2.scale;
    const patched = resolved.meals.map((x: any, i: number) => i === mealIdx
      ? { ...x, items: mergedItems, totals: sumMealTotals(mergedItems), recipeApplied2: recipe.name, recipeAppliedData2: flat2 }
      : x);
    const pre = sumDayTotals(patched as any);
    const rb = rebalanceDayAfterRecipes(patched as any, {
      kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
      p: effectiveP > 0 ? effectiveP : pre.p,
      f: effectiveF > 0 ? effectiveF : pre.f,
      c: effectiveC > 0 ? effectiveC : pre.c,
    });
    const resMeals = rb.meals as any[];
    // Пересчёт «карточки разнообразия» — после замены/добавления рецепта уникальные продукты
    // изменились, иначе карточки (таймлайн/разнообразие/качество) показывали бы stale-цифры.
    const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} уникальных продуктов` }; })();
    if (resolved.plan === 'day') {
      setDayPlan({ ...dayPlan, meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity });
    } else if (resolved.plan === 'three') {
      const days = [...threeDayPlan!.days];
      days[resolved.day] = { ...days[resolved.day], meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
      setThreeDayPlan({ ...threeDayPlan!, days, totals: sumMultiTotals(days) });
      if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
    } else {
      const days = [...weekPlan!.days];
      days[resolved.day] = { ...days[resolved.day], meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
      setWeekPlan({ ...weekPlan!, days, totals: sumMultiTotals(days) });
      if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
    }
    setShoppingList(buildShoppingFromPlans(resolved.plan === 'day' ? [ { ...dayPlan, meals: resMeals, totals: sumDayTotals(resMeals as any) } ] : (resolved.plan === 'three' ? threeDayPlan!.days : weekPlan!.days)));
    if (typeof (window as any).showToast === 'function') (window as any).showToast(`🍳 Второй рецепт «${recipe.name}» добавлен в приём`, 'success');
    setRecipePickerMeal(null);
  };

  const toggleAllergen = (id: string) => {
    setAllergens(prev => {
      const updated = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id];
      // P1-fix: пишем в Profile (UnifiedSettings.nutrition.foodAllergies) + legacy he_food_allergens для backward-compat
      try { updateSection('nutrition', { foodAllergies: updated }); } catch {}
      try { localStorage.setItem('he_food_allergens', JSON.stringify(updated)); } catch {}
      try { saveContraindications({ foodAllergies: updated }); } catch {}
      return updated;
    });
  };
  const toggleHealthIssue = (id: string) => {
    setHealthIssues(prev => {
      const updated = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id];
      try { updateSection('health', { chronicConditions: updated }); } catch {}
      try { localStorage.setItem('he_health_issues', JSON.stringify(updated)); } catch {}
      try { saveContraindications({ chronicConditions: updated }); } catch {}
      return updated;
    });
  };

  /**
   * Кнопка "📋 Автозаполнение из профиля" — загружает значения из UnifiedSettings
   * в локальные useState планировщика. НЕ пишет обратно. Пользователь может
   * отредактировать поля, и только явное "Сохранить в профиль" переносит их в профиль.
   */
  const autofillFromProfile = () => {
    try {
      const prof = profile;
      if (!prof) return;
      const s = (prof.settings || {}) as any;
      if (s.personal) {
        if (s.personal.weight) setWeight(s.personal.weight);
        if (s.personal.height) setHeight(s.personal.height);
        if (s.personal.age) setAge(s.personal.age);
        if (s.personal.sex) setSex(s.personal.sex);
        if (s.personal.bodyFat !== undefined) setBodyFatPct(s.personal.bodyFat);
      }
      if (s.training) {
        if (s.training.daysPerWeek) setTrainType(s.training.daysPerWeek >= 5 ? 'strength' : s.training.daysPerWeek >= 3 ? 'mixed' : 'cardio');
        if (s.training.minutesPerSession) {
          // не подменяем minutesPerSession напрямую, маппим в workout duration
        }
        if (s.training.primaryGoal) { setGoal(s.training.primaryGoal as GoalId); setGoalUserSet(true); }
        // FIX train-bind: график тренировок из профиля (по кнопке «Из профиля»)
        if (s.training.schedule && typeof s.training.schedule === 'object') {
          const sch = normalizeTrainSchedule(s.training.schedule);
          setLinkToTraining(sch.enabled);
          setTrainStart(sch.startTime);
          setTrainEnd(sch.endTime);
          setTrainingDays([...sch.weeklyDays]);
          setTrainScheduleType(sch.scheduleType);
          setTrainPattern({ ...sch.pattern });
        }
      }
      if (s.lifestyle) {
        if (s.lifestyle.dailySteps !== undefined) setDailySteps(s.lifestyle.dailySteps);
        if (s.lifestyle.sleepHours !== undefined) setSleepHours(s.lifestyle.sleepHours);
        if (s.lifestyle.stressLevel !== undefined) setStressLevel(s.lifestyle.stressLevel);
        if (s.lifestyle.bedtime) setBedTime(s.lifestyle.bedtime);
        if (s.lifestyle.wakeTime) setWakeTime(s.lifestyle.wakeTime);
      }
      if (s.nutrition) {
        if (s.nutrition.dietType && s.nutrition.dietType !== 'omnivore') {
          setDietPrefs([s.nutrition.dietType as 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean']);
        }
        if (s.nutrition.mealsPerDay) setMealsCount(s.nutrition.mealsPerDay);
        if (s.nutrition.foodAllergies) setAllergens(s.nutrition.foodAllergies);
        if (s.nutrition.foodIntolerances) setIntolerances({ ...intolerances, ...Object.fromEntries(s.nutrition.foodIntolerances.map((a: string) => [a, true])) });
        if (s.nutrition.excludedFoods) setExcludedFoods(s.nutrition.excludedFoods);
        if (s.nutrition.preferredFoods) setPreferredFoods(s.nutrition.preferredFoods);
        if (s.nutrition.preferredByMeal) setPreferredByMeal(s.nutrition.preferredByMeal);
        // FIX 1.1: читаем split-объект г/кг из профиля (не numeric proteinPerKg).
        const _mg = (s.nutrition as any).manualGPerKgSplit;
        if (_mg && typeof _mg === 'object') {
          setManualGPerKg({
            protein: typeof _mg.protein === 'number' && !isNaN(_mg.protein) ? _mg.protein : 0,
            fat: typeof _mg.fat === 'number' && !isNaN(_mg.fat) ? _mg.fat : 0,
            carbs: typeof _mg.carbs === 'number' && !isNaN(_mg.carbs) ? _mg.carbs : 0,
          });
        } else if (s.nutrition.proteinPerKg && typeof s.nutrition.proteinPerKg === 'number') {
          setManualGPerKg({ protein: s.nutrition.proteinPerKg, fat: 0, carbs: 0 });
        }
        if (s.nutrition.sodiumG) {/* stored */}
        if (s.nutrition.eveningLowCarb) setEveningLowCarb(s.nutrition.eveningLowCarb);
        if (s.nutrition.surplusPct) setSurplusPct(s.nutrition.surplusPct);
        if (s.nutrition.histamineSensitive !== undefined) setHistamineSensitive(s.nutrition.histamineSensitive);
      }
      if (s.health?.chronicConditions) setHealthIssues(s.health.chronicConditions);
      if (s.pharma?.phase) setPhase(s.pharma.phase === 'baseline' ? 'maintenance' : s.pharma.phase === 'post_pct' ? 'recovery' : s.pharma.phase === 'fertility' ? 'recovery' : s.pharma.phase as PhaseId);
      if (s.goals?.bbCategory) setBBCategory(s.goals.bbCategory as BBCategory);
      if (s.goals?.lifeStage) setLifeStage(s.goals.lifeStage as LifeStage);
    } catch (e) {
      console.error('[autofillFromProfile]', e);
    }
  };

  /**
   * Кнопка "💾 Сохранить в профиль" — пишет ТЕКУЩИЕ локальные значения в UnifiedSettings.
   * Вызывается по явному действию пользователя.
   */
  const saveToProfile = () => {
    try {
      const cur = getProfile();
      const next = JSON.parse(JSON.stringify(cur.settings || {})) as any;
      if (!next.personal) next.personal = {};
      if (weight) next.personal.weight = weight;
      if (height) next.personal.height = height;
      if (age) next.personal.age = age;
      if (sex) next.personal.sex = sex;
      if (bodyFatPct !== undefined && bodyFatPct !== null) next.personal.bodyFat = bodyFatPct;
      if (!next.training) next.training = {};
      if (goal) next.training.primaryGoal = goal;
      // FIX train-bind: график тренировок в профиль (по кнопке «Сохранить в профиль»)
      next.training.schedule = buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern);
      next.training.daysPerWeek = [0, 1, 2, 3, 4, 5, 6].filter(d => isTrainingDayFor(next.training.schedule, d)).length;
      if (!next.lifestyle) next.lifestyle = {};
      if (dailySteps !== undefined) next.lifestyle.dailySteps = dailySteps;
      if (sleepHours !== undefined) next.lifestyle.sleepHours = sleepHours;
      if (stressLevel !== undefined) next.lifestyle.stressLevel = stressLevel;
      if (bedTime) next.lifestyle.bedtime = bedTime;
      if (wakeTime) next.lifestyle.wakeTime = wakeTime;
      if (!next.nutrition) next.nutrition = {};
      if (dietPrefs.length) next.nutrition.dietType = (dietPrefs[0] as any) || 'omnivore';
      if (mealsCount) next.nutrition.mealsPerDay = mealsCount;
      if (allergens.length) next.nutrition.foodAllergies = allergens;
      if (excludedFoods.length) next.nutrition.excludedFoods = excludedFoods;
      if (preferredFoods.length) next.nutrition.preferredFoods = preferredFoods;
      if (preferredByMeal && Object.keys(preferredByMeal).length) next.nutrition.preferredByMeal = preferredByMeal;
      // FIX 1.1: ручной г/кг — объект {protein,fat,carbs} пишется в отдельное поле manualGPerKgSplit,
      // НЕ в numeric proteinPerKg (раньше ломал числовое поле для ББ-авто/organ-load).
      next.nutrition.manualGPerKgSplit = (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0)
        ? { protein: manualGPerKg.protein || 0, fat: manualGPerKg.fat || 0, carbs: manualGPerKg.carbs || 0 }
        : undefined;
      // Миграция: heal уже испорченного numeric proteinPerKg (объект → число 1.8, объект переносим в Split).
      if (next.nutrition.proteinPerKg && typeof next.nutrition.proteinPerKg === 'object' && !Array.isArray(next.nutrition.proteinPerKg)) {
        if (!next.nutrition.manualGPerKgSplit) next.nutrition.manualGPerKgSplit = next.nutrition.proteinPerKg;
        next.nutrition.proteinPerKg = 1.8;
      }
      next.nutrition.eveningLowCarb = eveningLowCarb;
      // FIX 1.4/1.5: сохраняем ручные цели КБЖУ + режим обратно в профиль.
      if (manualKcal !== null && manualP !== null && manualF !== null && manualC !== null) {
        next.nutrition.manualTargets = { kcal: manualKcal, protein: manualP, fat: manualF, carbs: manualC };
      }
      next.nutrition.kbjuMode = (kbjuMode === 'manual' ? 'manual' : 'auto');
      if (surplusPct) next.nutrition.surplusPct = surplusPct;
      next.nutrition.histamineSensitive = histamineSensitive;
      if (!next.health) next.health = {};
      if (healthIssues.length) next.health.chronicConditions = healthIssues;
      if (!next.pharma) next.pharma = {};
      next.pharma.phase = phase;
      if (!next.goals) next.goals = {};
      if (bbCategory) next.goals.bbCategory = bbCategory;
      if (lifeStage) next.goals.lifeStage = lifeStage;
      updateProfile({ settings: next });
    } catch (e) {
      console.error('[saveToProfile]', e);
    }
  };

  const loadSavedPlan = (plan: SavedPlan) => {
    if (plan.dayPlan) { setDayPlan(plan.dayPlan); setGenerated(true); setPlanDays(1); }
    if (plan.threeDayPlan) setThreeDayPlan(plan.threeDayPlan);
    if (plan.weekPlan) setWeekPlan(plan.weekPlan);
    if (plan.shoppingList) setShoppingList(plan.shoppingList);
    if (plan.waterCalc) setWaterCalc(plan.waterCalc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // P0-fix (Aug 5 2026): убрана автоматическая синхронизация useState → updateProfile.
  // Теперь поля в планировщике ЛОКАЛЬНЫЕ. Кнопка "💾 Сохранить в профиль" пишет
  // выборочно в useProfile() по явному действию пользователя. Это предотвращает
  // перезапись данных Профиля при промежуточных изменениях в Планировщике.
  // B4-fix: Sync weight/height/age/sex/bodyFat back to profile — ОТКЛЮЧЕНО.
  // (Пользователь должен явно нажать "Сохранить в профиль" — см. `saveToProfile` ниже)

  // Auto-recalc macros when course changes
  // P1-fix: dependency was `injections.length` which missed dose/type changes on
  // an existing injection (same length, different drug). Now keyed on a serialized
  // signature of types+doses so adding/removing/changing a drug all trigger recalc.
  const effectiveKcalRef = useRef(effectiveKcal);
  effectiveKcalRef.current = effectiveKcal;
  // D (Эпик D): сквозной леджер разнообразия для серии генераций месяца —
  // recent-продукты, окно последних 2 дней и использованные рецепты НЕ сбрасываются
  // при переходе между неделями месяца (weekIndex-defined вызовы).
  const varietyLedgerRef = useRef<{ foods: Set<string>; recipes: Set<string>; recent: string[][] }>({ foods: new Set(), recipes: new Set(), recent: [] });
  // Эпик-хвост (детерминизм): seeded-счётчик соли генерации (персист, инкремент на вызов).
  const genSaltRef = useRef<number>(0);
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem('he_planner_gen_salt') || '0');
      if (Number.isFinite(v) && v >= 0) genSaltRef.current = v;
    } catch {}
  }, []);
  // Эпик 4: микро/DIAAS-контур между днями (дефициты вчера → prefer-источники сегодня).
  const microLedgerRef = useRef<{ preferIds: Set<string>; notes: string[] }>({ preferIds: new Set(), notes: [] });
  const manualGPerKgRef = useRef(manualGPerKg);
  manualGPerKgRef.current = manualGPerKg;
  const injectionsSignature = (Array.isArray(injections) ? injections : [])
    .map(i => `${i?.type || ''}:${i?.dose || 0}`).join('|');
  useEffect(() => {
    const safeInjections = Array.isArray(injections) ? injections : [];
    const aasCount = safeInjections.filter(i => i.type === 'ААС').length;
    if (aasCount > 0 && goal === 'mass') {
      setManualGPerKg(prev => ({ ...prev, protein: 2.5 }));
    } else if (aasCount === 0 && manualGPerKgRef.current.protein > 2.2) {
      setManualGPerKg(prev => ({ ...prev, protein: 1.8 }));
    }
    const insulinCount = safeInjections.filter(i => i.type === 'инсулин').length;
    if (insulinCount > 0) {
      setManualKcal(prev => prev || Math.round(effectiveKcalRef.current * 1.1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectionsSignature, goal]);

  // P0-fix (Aug 5 2026): мёртвый useEffect чтения `he_nutrition_profile` удалён —
  // этот ключ никем не пишется, код был мёртв. Миграция из этого ключа не нужна:
  // unified-profile.ts мигрирует все настройки в UnifiedSettings, и планировщик
  // читает их через `getProfile()` + `useProfileSection()`.

  // ── Supplement / Water timeline builders (подняты ВЫШЕ generatePlan во избежание TDZ) ──
  const buildSupplementTimeline = (mealTimes: { time: string; label: string; pct: number }[], isTrainingDay: boolean) => {
    const userSupps = takenSupplements.map(sid => ALL_SUBSTANCES.find(a => a.id === sid)).filter(Boolean);
    const timeline: { time: string; items: { name: string; dose: string; note: string }[] }[] = [];
    mealTimes.forEach(mt => {
      const isMorning = mt.label === 'Завтрак';
      const isEvening = mt.label === 'Ужин' || mt.label === 'Перекус';
      const isPreW = mt.label === 'Предтрен';
      const isPostW = mt.label === 'Пост-трен';
      const isBed = mt.label === 'Ужин' || mt.label === 'Перекус';
      const slotItems: { name: string; dose: string; note: string }[] = [];
      if (isMorning) {
        if (userSupps.some(s => (s?.id||'').includes('creatine'))) slotItems.push({name:'Креатин',dose:'5г',note:'С завтраком для лучшего усвоения'});
        if (userSupps.some(s => (s?.id||'').includes('d3')||(s?.id||'').includes('vitamin_d'))) slotItems.push({name:'D3+K2',dose:'5000ME+100мкг',note:'С жирной пищей'});
        if (userSupps.some(s => (s?.id||'').includes('omega')||(s?.id||'').includes('fish_oil'))) slotItems.push({name:'Омега-3',dose:'2-3г',note:'С едой для абсорбции'});
        if (userSupps.some(s => (s?.id||'').includes('nac')||(s?.id||'').includes('n_acetyl'))) slotItems.push({name:'NAC',dose:'600-1200мг',note:'Защита печени'});
        if (userSupps.some(s => (s?.id||'').includes('tudca'))) slotItems.push({name:'TUDCA',dose:'500мг',note:'С едой. Желчеотток'});
      }
      if (isPreW && isTrainingDay && userSupps.some(s => (s?.id||'').includes('bcaa')||(s?.id||'').includes('eaa'))) slotItems.push({name:'BCAA/EAA',dose:'10-15г',note:'За 30 мин до тренировки'});
      if (isPostW && isTrainingDay) {
        if (userSupps.some(s => (s?.id||'').includes('whey')||(s?.id||'').includes('protein'))) slotItems.push({name:'Протеин',dose:'30-50г',note:'После тренировки'});
        if (userSupps.some(s => (s?.id||'').includes('creatine'))) slotItems.push({name:'Креатин',dose:'5г',note:'С углеводами postW (инсулин усиливает транспорт в мышцы)'});
      }
      if (isEvening) {
        if (userSupps.some(s => (s?.id||'').includes('omega')||(s?.id||'').includes('fish_oil'))) slotItems.push({name:'Омега-3',dose:'2-3г',note:'Второй приём за день'});
        if (userSupps.some(s => (s?.id||'').includes('nac')||(s?.id||'').includes('n_acetyl'))) slotItems.push({name:'NAC',dose:'600-1200мг',note:'Вечерний приём'});
        if (userSupps.some(s => (s?.id||'').includes('tudca'))) slotItems.push({name:'TUDCA',dose:'500мг',note:'Вечерний приём'});
      }
      if (isBed) {
        if (userSupps.some(s => (s?.id||'').includes('magnesium')||(s?.id||'').includes('mg_'))) slotItems.push({name:'Магний',dose:'400мг',note:'За 30 мин до сна'});
        if (userSupps.some(s => (s?.id||'').includes('zinc')||(s?.id||'').includes('zn_'))) slotItems.push({name:'Цинк',dose:'30мг',note:'С едой, не с кальцием'});
        if (userSupps.some(s => (s?.id||'').includes('melatonin'))) slotItems.push({name:'Мелатонин',dose:'3-5мг',note:'За 30-60 мин до сна'});
        if (userSupps.some(s => (s?.id||'').includes('casein'))) slotItems.push({name:'Казеин',dose:'30-40г',note:'Медленный белок на ночь'});
      }
      if (slotItems.length > 0) timeline.push({ time: mt.time, items: slotItems });
    });
    const phaseSupps: { name: string; dose: string; note: string }[] = [];
    const aasOral = injections.some(i => i.type === 'ААС' && i.esterType !== 'long');
    const aasAny = injections.some(i => i.type === 'ААС');
    const hasInsulin = injections.some(i => i.type === 'инсулин');
    const hasGH = injections.some(i => i.type === 'ГР');
    if (phase === 'course') {
      if (aasOral) { phaseSupps.push({name:'NAC',dose:'1200-1800мг',note:'Оральные ААС → удвоенная доза NAC'}); phaseSupps.push({name:'TUDCA',dose:'1000-1500мг',note:'Оральные ААС → повышенный желчеотток'}); }
      if (aasAny) { phaseSupps.push({name:'Омега-3',dose:'3-6г EPA+DHA',note:'Кардиопротекция на курсе'}); phaseSupps.push({name:'CoQ10',dose:'200-300мг',note:'Митохондриальная защита миокарда'}); }
      if (hasGH) { phaseSupps.push({name:'Берберин',dose:'500мг 3×/день',note:'Контроль глюкозы при ГР'}); phaseSupps.push({name:'R-ALA',dose:'300-600мг',note:'Инсулиносенситайзер при ГР'}); }
      if (hasInsulin) { phaseSupps.push({name:'Берберин',dose:'500мг 3×/день',note:'Инсулиносенситайзер'}); phaseSupps.push({name:'Хром',dose:'400-600мкг',note:'Усиление действия инсулина'}); }
    }
    if (phase === 'pct') {
      phaseSupps.push({name:'D3+K2',dose:'10000ME+200мкг',note:'Поддержка тестостерона на ПКТ'}); phaseSupps.push({name:'Цинк',dose:'50мг',note:'Ароматаза + тестостерон'}); phaseSupps.push({name:'Магний',dose:'500мг',note:'Сон + кортизол на ПКТ'}); phaseSupps.push({name:'Ашваганда',dose:'600мг',note:'Адаптоген: кортизол + тестостерон'});
    }
    if (phase === 'cutting') {
      phaseSupps.push({name:'L-Карнитин',dose:'2-3г',note:'Липолиз + транспорт ЖК в митохондрии'}); phaseSupps.push({name:'Зелёный чай',dose:'500мг EGCG',note:'Термогенез + антиоксидант'}); phaseSupps.push({name:'Йохимбин',dose:'5-10мг',note:'α2-антагонист — stubborn fat'}); phaseSupps.push({name:'Клетчатка',dose:'10-15г',note:'Сытость + ЖКТ на дефиците'});
    }
    // #3 Женские правила добавок (тайминг по фазе цикла).
    if (sex === 'female') {
      const fRules = getFemaleSupplementRules((cyclePhase as MenstrualPhase) || 'none');
      if (fRules.length > 0) {
        timeline.push({ time: '▸ Женское', items: [{name: 'Тайминг добавок', dose: '—', note: fRules.map(r => `${r.supplement}: ${r.rule}`).join(' | ')}] });
        timeline.push(...fRules.map(r => ({ time: '', items: [{name: r.supplement, dose: 'см. правило', note: r.rule}] })));
      }
    }
    if (phaseSupps.length > 0) {
      timeline.push({ time: '▸ Фаза', items: [{name:`Фаза «${phase}»`,dose:'—',note:phaseSupps.map(s=>`${s.name} ${s.dose}: ${s.note}`).join(' | ')}] });
      timeline.push(...phaseSupps.map(s => ({ time: '', items: [s] })));
    }
    return timeline;
  };
  const buildWaterTimeline = (w: number, mealTimes: { time: string; label: string }[], isTrainingDay: boolean, trainStart: string) => {
    // #8 Гидратация по поту: base 35 мл/кг + sweat по интенсивности/длительности.
    const _sweatMlPerH = trainIntensity === 'high' ? 1500 : trainIntensity === 'medium' ? 1000 : 600; // пот мл/ч
    const _trainDurH = (s?.avgWorkoutMinutes || 60) / 60;
    const _sweatMl = isTrainingDay ? Math.round(_sweatMlPerH * _trainDurH) : 0;
    const totalMl = Math.round(w * 35) + _sweatMl;
    const slots = mealTimes.length;
    const perSlot = Math.round(totalMl / (slots + 2));
    const timeline: { time: string; ml: number; note: string }[] = [];
    timeline.push({ time: '07:30', ml: 500, note: 'Утро: 500 мл сразу после пробуждения' });
    mealTimes.forEach((mt, i) => {
      const ml = i === 0 ? 300 : perSlot;
      timeline.push({ time: mt.time, ml, note: `${mt.label}: ${ml} мл` });
    });
    if (isTrainingDay && trainStart) {
      const tH = parseInt(trainStart.split(':')[0]);
      const preH = Math.max(0, tH - 1);
      const postH = Math.min(23, tH + 1);
      const _postMl = Math.min(800, 400 + Math.round(_sweatMl * 0.5));
      timeline.push({ time: `${String(preH).padStart(2,'0')}:30`, ml: 500, note: 'За 60 мин до тренировки' });
      timeline.push({ time: `${String(postH).padStart(2,'0')}:00`, ml: _postMl, note: 'После тренировки: восстановление' + (_sweatMl > 800 ? ' (пот ~' + _sweatMl + ' мл — добавьте электролиты: Na/K/Mg)' : '') });
    }
    timeline.push({ time: '21:00', ml: 300, note: 'Вечер: не позже чем за 1-2ч до сна' });
    return timeline;
  };

  // ─── Generate Plan ───
   const generatePlan = async (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean; async?: boolean; overrides?: { mealsCount?: number } }) => {
      // ⏳ Неблокирующая генерация 3/7 дней: yield между днями, чтобы UI не фризил.
      // Многодневная генерация (3/7) ВСЕГДА неблокирующая — независимо от вызывающего
      // (месяц и другие точки входа не обязаны помнить про { async: true }).
      const isAsync = opts?.async === true || days >= 3;
      const maybeYield = async () => { if (isAsync) await new Promise<void>(r => setTimeout(() => r(), 20)); };
     if (isAsync) { try { setPlanBusy(true); setErrorMsg(null); } catch {} }
     try {
     // P1-fix: опция skipUndo для массовой генерации (месяц) — иначе 5×saveUndo заполняет
     // undoStack (cap=5) и уничтожает историю отмен пользователя.
     if (!opts?.skipUndo) saveUndo();
     setPlanDays(days);
     if (dayIndex !== undefined) setSelectedDayIndex(dayIndex);
     setWeekEditDay(null); // FIX button-audit: новая генерация сбрасывает редактирование недели

        // v6: V2 — единственный движок (classic удалён). simple/minimal — пресеты pro (quality:'basic' + variety/budget).
        if (true) {
         try {
       const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
        const bfPct = bodyFatPct > 3 ? bodyFatPct : (sex === 'male' ? 15 : 22);
        const lbmKg = weight * (1 - bfPct / 100);
         const trainStartMin = linkToTraining && trainStart?.includes(':') ? toMin(trainStart) : undefined;
        const excludedIds = new Set<string>(excludedFoods || []);
        (healthIssues || []).forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
        getAutoExcludedFoodIds(FOOD_DB, healthIssues || []).forEach(fid => excludedIds.add(fid));
        // FIX allergens-restrictions: аллергены и dietPrefs-ограничения теперь исключаются
        // единым резолвером в ОБОИХ путях генерации (раньше pro-движок их игнорировал).
        for (const fid of resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || [])) excludedIds.add(fid);
        try { setAllergenExcludedCount(countExcludedByAllergens(FOOD_DB, allergens || [])); } catch {}
        const lockedIds = new Set<string>([...(lockedFoodIds || [])]);
        // D (Эпик D): сквозной ledger разнообразия — месяц НЕ сбрасывает «недавние»
        // продукты/рецепты между неделями (раньше каждая generatePlan(7, w) начинала
        // с пустого recentFoodIds/_usedRecipeNames → recipes повторялись week-to-week).
        // Леджер живёт на время серии генераций месяца; обычная генерация стартует чистым.
        const _ledger = weekIndex !== undefined
          ? varietyLedgerRef.current
          : (varietyLedgerRef.current = { foods: new Set<string>(), recipes: new Set<string>(), recent: [] });
        const recentFoodIds = _ledger.foods;
       // B5 (междневная ротация): семейства гарниров предыдущих дней текущей генерации —
       // движок деприоритизирует «рис в каждый день», если есть ≥2 свежих альтернатив.
       const recentStapleFamilies = new Set<string>();
       const collectFoods = (plan: any) => { if (plan?.meals) plan.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); })); if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); }))); };
       const collectFamilies = (plan: any) => {
         const addFrom = (items: any[]) => items.forEach((it: any) => { const fam = stapleFamilyOf(it.id || ''); if (fam) recentStapleFamilies.add(fam); });
         if (plan?.meals) plan.meals.forEach((m: any) => addFrom(m.items || []));
         if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => addFrom(m.items || [])));
       };
       if (days >= 3 && dayPlan) { collectFoods(dayPlan); collectFamilies(dayPlan); }
       if (days >= 7 && threeDayPlan) { collectFoods(threeDayPlan); collectFamilies(threeDayPlan); }
       if ((dietPrefs || []).includes('vegetarian')) {
         Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => { if (tags.isVegetarian === false) excludedIds.add(fid); });
       }
       const dayIdx = days === 1 ? selectedDayIndex : 0;
        const isTrainingDay = isTrainDay(dayIdx);
      // Эпик-хвост (детерминизм): seeded-соль — персистентный счётчик (he_planner_gen_salt).
      // Первая генерация при равных входах всегда даёт один план (соль 0), каждая
      // следующая «Перегенерировать» инкрементирует — новый вариант. Инвариант плана
      // «детерминизм (seeded)» соблюдается: одинаковые входные + счётчик = тот же выход.
      const planRandomSalt = (() => {
        const s = genSaltRef.current;
        genSaltRef.current = s + 1;
        try { localStorage.setItem('he_planner_gen_salt', String(genSaltRef.current)); } catch {}
        return s % 1000000;
      })();
      // 🍳 Режим «по рецептам»: имена рецептов, уже использованные в МНОГОДНЕВНОМ плане
      // (разнообразие между днями — один рецепт не повторяется на протяжении генерации).
      // D (Эпик D): в месяце леджер не сбрасывается между неделями.
      const _usedRecipeNames = _ledger.recipes;

      // Эпик 4: микро/DIAAS-контур — сброс лидера для обычной генерации, сквозной в месяце.
      const _microLedger = weekIndex !== undefined
        ? microLedgerRef.current
        : (microLedgerRef.current = { preferIds: new Set(), notes: [] });

      // 🧪 Собираем lab values из v2Labs (строки → числа) для диетической коррекции.
      // ВАЖНО (units-fix): v2Labs содержит и СЫВОРОТОЧНЫЕ анализы (ALT/AST/LDL/гематокрит/…),
      // и ЦЕЛЕВЫЕ дневные электролиты питания (Натрий/Калий/Магний в мг). Движок
      // computeLabDietAdjustment трактует Na/K как сывороточные (K >5.0 ммоль/л, Na >145 ммоль/л);
      // unit-guard в движке реагирует ТОЛЬКО на сывороточный диапазон (K 2.5–10, Na 100–200),
      // поэтому дневные 4500 мг калия не дают ложную «гиперкалиемию». Передаём всё (uppercase),
      // а решение о применимости — в движке.
      const SERUM_LAB_KEYS = new Set([
        'glucose', 'insulin', 'homa_ir', 'alt', 'ast', 'ggt', 'creatinine', 'urea',
        'hematocrit', 'hemoglobin', 'hdl', 'ldl', 'apob', 'tsh', 'vitamin_d', 'ferritin',
        'homocysteine', 'crp', 'testosterone', 'estradiol', 'prolactin', 'hba1c', 'glycated_hemoglobin',
        'sodium', 'potassium', 'magnesium',
      ]);
      const labValuesForPlan: Record<string, number> = {};
      Object.entries(v2Labs).forEach(([key, val]) => {
        const k = (key || '').toLowerCase();
        if (!SERUM_LAB_KEYS.has(k)) return; // прочие ключи (рецепты/настройки) не анализы
        const num = parseFloat(val as string);
        if (!isNaN(num) && num > 0) labValuesForPlan[k.toUpperCase()] = num;
      });

      // Адаптация по дневнику: компенсация вчерашнего отклонения для сегодняшнего дня.
      const baseGoalKcal = Math.max(1200, effectiveKcal || weight * 30 || 2500);
      const baseGoalP = Math.max(80, effectiveP || weight * 2 || 160);
      const baseGoalF = Math.max(30, effectiveF || weight * 0.8 || 70);
      const baseGoalC = Math.max(50, effectiveC || weight * 3.5 || 300);
      // Эпик 5: rolling-компенсация считается ВНУТРИ buildOneDay по дате каждого дня
      // (день N компенсирует факт дня N−1) — см. ниже.
      // Smart 7-day variety: rolling window of food IDs from the last 2 built days.
      // recentFoodIds (existing) accumulates ALL prior days; hardWindow holds the last 2
      // for the stricter hard-exclusion (adjacent days don't repeat products).
      // D (Эпик D): в месяце окно сшивается с прошлой неделей (стык недель не повторяет стейплы).
      const hardWindow: string[][] = weekIndex !== undefined && varietyLedgerRef.current.recent.length > 0
        ? [...varietyLedgerRef.current.recent]
        : [];
      const collectDayFoods = (day: any): string[] => {
        const ids: string[] = [];
        if (day?.meals) day.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) ids.push(it.id); }));
        return ids;
      };

      const buildOneDay = (offset: number): any => {
        // Эпик 1: единая периодизация углеводов — одна функция, один селектор.
        // Legacy cyclingMode/dietPauseMode/periodizationEnabled удалены из генерации.
        const isTrain = isTrainDay(offset);
        const _perio = applyCarbPeriodizationMods(carbPeriodization, offset, isTrain);
        let dayKcalMod = _perio.dayKcalMod, dayCarbMod = _perio.dayCarbMod;
        let isRefeedDay = _perio.isRefeedDay;
        // Эпик 6: день тяжёлых ног/высокого объёма — угли +25%, ккал +5%
        // (Helms 2014/2019: legs/high-volume день — максимальная гликогеновая ёмкость).
        // heavyTrainDay — день недели из DAY_LABELS; применяется поверх периодизации.
        const _isHeavyDay = isHeavyDayForOffset(heavyTrainDay, offset, DAY_LABELS);
        if (_isHeavyDay) { dayKcalMod *= 1.05; dayCarbMod *= 1.25; }
        // #1 Женская фаза цикла: ручной выбор — оверрайд; иначе авто-фаза из календаря
        // (Эпик 7: средняя длина + последний лог начала периода, he_cycle_log).
        const _cyclePhaseEff: MenstrualPhase = (sex === 'female')
          ? (((cyclePhase as MenstrualPhase) && (cyclePhase as MenstrualPhase) !== 'none') ? (cyclePhase as MenstrualPhase) : (autoCyclePhase().phase))
          : 'none';
        const _cycleCalendarNote = (sex === 'female' && (!cyclePhase || cyclePhase === 'none') && _cyclePhaseEff !== 'none')
          ? `📅 Фаза цикла рассчитана по календарю: ${CYCLE_PHASE_RU[_cyclePhaseEff]} (длина цикла ${autoCyclePhase().length} дн). Ручной выбор в настройках перекрывает.`
          : undefined;
        const _mp = (sex === 'female') ? getMenstrualPhaseNutrition(_cyclePhaseEff) : null;
        if (_mp) { dayKcalMod *= _mp.kcalMod; dayCarbMod *= _mp.carbMod; }
        // #2 Кости/кальций для женщин: повышенный Ca при низком %жира/аменорее/менопаузе.
        const _caInfo = (sex === 'female') ? getCalciumTarget('female', bfPct, _cyclePhaseEff, age) : null;
        const _boneNotes: string[] = [];
        if (_caInfo && _caInfo.boneRisk) _boneNotes.push(_caInfo.note, calciumDoseSplitNote());
        // #7 Сон-питание: при плохом сне/дефиците — триптофан/Mg/вишня.
        // #6 Diet-break диагностика: долгая сушка + метаболическая адаптация → рекомендация 2-недельного maintenance.
        // #5 Категория бодибилдинга → целевой %жира + акцент.
        const _bbCat = getBBCategory(bbCategory, sex);
        const _categoryNote: string | undefined = _bbCat ? `${_bbCat.label}: целевой %жира ~${_bbCat.targetBodyFatPct}% — ${_bbCat.note}` : undefined;
        // #3 Категория -> агрессивность дефицита при сушке (суше категории -> больше дефицит, с капом RED-S).
        // #3+#7 Категория + target-BF: комбинированный дефицит-мод (более консервативный, без RED-S).
        if (_bbCat) { const _defMod = getCombinedDeficitMod(bfPct, _bbCat.targetBodyFatPct, goal === 'cutting' || goal === 'fat_loss'); dayKcalMod *= _defMod; }
        // #4 Пик-неделя ББ: legacy-множители удалены — единый план через bbContestPrepPlan
        let _peakNote: string | undefined = undefined;
        // #10 Жизненные этапы / контрацепция.
        const _lifeStageNote: string | undefined = (sex === 'female') ? (getLifeStageNote(lifeStage) || undefined) : undefined;
        const _dietBreakNote: string | undefined = ((goal === 'cutting' || goal === 'fat_loss') && metabolicAdaptEnabled && metabolicAdaptPct > 0)
          ? '📉 Diet break рекомендован: метаболическая адаптация обнаружена. Перейдите на 2 недели maintenance (калорий поддержания) для восстановления лептина/гормонов и щитовидной. Белок 2.2 г/кг, углеводы восстановления, тренировки сохранить.'
          : undefined;
        const _sleepNote: string | undefined = (sleepHours < 7 || sleepQuality < 6)
          ? '😴 Сон слабый: добавьте tryptophan-источники (индейка, яйцо, творог, овсянка) + Mg glycinate на ночь. Тарт-вишня (мелатонин) перед сном. Избегать кофеин/алкоголя после 15:00.'
          : undefined;
        // Эпик 5: скользящая компенсация — база даты КАЖДОГО дня серии (день N
        // компенсирует факт дня N−1). Раньше применялась только к offset 0.
        const _prepDate = isoAddDays(isoToday(), offset);
        const diaryComp: CompensationResult | null = diaryAdaptation
          ? computeRollingCompensation({ kcal: baseGoalKcal, p: baseGoalP, f: baseGoalF, c: baseGoalC }, 7, _prepDate)
          : null;
        // #7 Anti-oscillation: если компенсация и cycling толкают в одну сторону —
        // демпфируем компенсацию (не стекаем +15% training-day с +200 недобора).
        const _diaryActive = !!(diaryComp && diaryComp.applied);
        const _cycDir = dayKcalMod - 1; // >0 = up-day, <0 = down-day
        const _dampK = (_diaryActive && Math.sign(_cycDir) === Math.sign(diaryComp.delta.kcal)) ? (1 - Math.abs(_cycDir)) : 1;
        const _dampC = (_diaryActive && Math.sign(dayCarbMod - 1) === Math.sign(diaryComp.delta.c)) ? (1 - Math.abs(dayCarbMod - 1)) : 1;
        // Эпик 1: недельная волна 2+1 (бывший periodizationEnabled) — в applyCarbPeriodizationMods (mode 'wave').
        // #4b Пик-неделя ББ / 🏁 Contest prep: абсолютные цели по РЕАЛЬНОЙ дате дня
        // (today + offset) — приоритет над cycling/компенсацией.
        // Приоритет источников: единый план (goals.bbContestPrepPlan, покрывает и подготовку)
        // → legacy конфиг (goals.bbPeakConfig, только пик-неделя).
        const _specialNotes: string[] = [];
        const _specialMealOverrides: { targetLabel: string; kind: 'cheat' | 'refeed' | 'fast' | 'custom'; p?: number; c?: number; f?: number }[] = [];
        let _fastingDay = false;
        try {
          const _sm = JSON.parse(localStorage.getItem('he_special_meals') || '[]');
          if (Array.isArray(_sm)) {
            const _todaySpecial = _sm.filter((m: any) => m && m.date === _prepDate);
            if (!isRefeedDay) {
              const _rf = _todaySpecial.find((m: any) => m.type === 'refeed');
              if (_rf) {
                isRefeedDay = true;
                dayKcalMod = 1.12; dayCarbMod = 2.2;
                _specialNotes.push('🔄 Рефид по расписанию: углеводы ×2.2, жиры снижены — восстановление гликогена и лептина.');
              }
            }
            const _cm = _todaySpecial.find((m: any) => m.type === 'cheat_meal');
            if (_cm && !isRefeedDay) {
              dayKcalMod = Math.max(dayKcalMod, 1.12);
              _specialNotes.push('🍔 Читмил по расписанию: калорийность дня повышена, один приём — свободный выбор (до 1500 ккал). Не компенсировать на следующий день.');
            }
            const _fast = _todaySpecial.find((m: any) => m.type === 'fast');
            if (_fast) {
              _fastingDay = true;
              dayKcalMod = Math.min(dayKcalMod, 0.75); dayCarbMod = Math.min(dayCarbMod, 0.7);
              _specialNotes.push('⏳ Фастинг по расписанию: калорийность снижена, приёмов меньше, первый приём позже (окно ~8 ч, напр. 12:00–20:00).');
            }
            // E6 (спецприём → замена приёма): записи календаря с replaceMeal РЕАЛЬНО
            // перестраивают целевой приём (раньше только баннер «замена: Ужин»).
            for (const _s of _todaySpecial) {
              if (!_s.replaceMeal) continue;
              _specialMealOverrides.push({
                targetLabel: _s.replaceMeal,
                kind: _s.type === 'cheat_meal' ? 'cheat' : _s.type === 'refeed' ? 'refeed' : 'fast',
              });
            }
          }
        } catch {}
        // E6: активная конфигурация спецприёма (модалка) с включённой заменой — явные макросы.
        if (specialMealMode && specialMealReplaceMode && specialMealReplaceTarget) {
          _specialMealOverrides.push({ targetLabel: specialMealReplaceTarget, kind: 'custom', p: specialMealProteinG, c: specialMealCarbsG, f: specialMealFatG });
        }
        const _effMealsRaw = _fastingDay ? Math.max(3, (opts?.overrides?.mealsCount ?? mealsCount) - 1) : (opts?.overrides?.mealsCount ?? mealsCount);
        const _effMealsCount = _effMealsRaw;
        const _inPrepWindow = bbPrepPlan ? prepPhaseForDate(bbPrepPlan, _prepDate) !== null : false;
        // 🗓 Годовой план: активный блок на дату (для подсказки про contest prep).
        const _annualPhase = annualPlan ? annualPlanPhaseForDate(annualPlan, _prepDate) : null;
        const _peakTargets = bbPrepPlan && _inPrepWindow
          ? nutritionTargetsForPrepDate(_prepDate, bbPrepPlan, {
              kcal: Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
              proteinG: Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
              fatG: Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
              carbsG: Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
              waterMl: 3000,
              sodiumMg: 3500,
            })
          : bbPrepConfig
            ? computePeakWeekNutritionTargets(_prepDate, {
                kcal: Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
                proteinG: Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
                fatG: Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
                carbsG: Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
                waterMl: 3000,
                sodiumMg: 3500,
              }, bbPrepConfig)
            : null;
        if (_peakTargets?.phase) _peakNote = _peakTargets.note;
        else if (bbPrepPlan && _peakTargets?.note) _peakNote = _peakTargets.note;
        else if (_annualPhase && _annualPhase.block.ref.kind === 'BB' && _annualPhase.block.ref.phase === 'contest_prep' && !bbPrepPlan && !bbPrepConfig && !_peakNote) {
          _peakNote = '🏁 Годовой план: эта неделя — contest prep, но prep-план не собран. Соберите «🏁 Contest prep» в ББ-авто (или включите «🎭 Пик-неделю» у блока в Годовом плане) — иначе цели подготовки не применяются.';
        }
        const _applyPrepTargets = !!(_peakTargets && (_peakTargets.phase || _inPrepWindow));
        const input: MealPlanInput = {
          weightKg: weight, lbmKg, bodyFatPct: bfPct, sex,
          // D-22: nutrMult already folded into effective* above — do NOT multiply again.
          // D-22: nutrMult folded into effective* above. Адаптация по дневнику: компенсация
          // вчерашнего отклонения применяется только к «сегодня» (offset === dayIdx).
          goalKcal: _applyPrepTargets ? _peakTargets.kcal : Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
          goalProteinG: _applyPrepTargets ? _peakTargets.proteinG : Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
          goalFatG: _applyPrepTargets ? _peakTargets.fatG : Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
          goalCarbsG: _applyPrepTargets ? _peakTargets.carbsG : Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
          mealsCount: _effMealsCount, isTrainingDay: plannerModeRef.current === 'pro' ? isTrainDay(offset) : false,
          trainStartMin: linkToTraining && isTrainDay(offset) && plannerModeRef.current === 'pro' ? toMin(trainStart) : undefined,
          allowIntraWorkout: intraWorkoutEnabled && trainIntensity !== 'low' && plannerModeRef.current === 'pro',
          trainDurationMin: (s?.avgWorkoutMinutes || 60),
          trainIntensity: (trainIntensity as any) || 'medium',
          carbAutoCycle: (carbPeriodization === 'carb_cycle' || carbPeriodization === 'butch' || (carbPeriodization as any) === 'auto'),
          excludedIds: (() => { const s: Set<string> = new Set<string>(excludedIds); if (_mp) _mp.avoidIds.forEach((id: string) => s.add(id)); return s; })(),
          allergenTags: (() => { const t = new Set<string>(); (allergens || []).forEach(a => (USER_ALLERGEN_TO_TAGS[a] || [a]).forEach(v => t.add(v))); dietRestrictionTags(dietPrefs || []).forEach(v => t.add(v)); return t; })(),
          preferredIds: (() => { const s = new Set(expandRecipePreferred(preferredFoods, [...getRecipes(), ...(userRecipes||[])], FOOD_DB)); if (_mp) _mp.priorityIds.forEach((id: string) => s.add(id)); _microLedger.preferIds.forEach((id: string) => s.add(id)); if (planType === 'mediterranean') ['salmon','mackerel','olive_oil','tomato','cucumber','yogurt_greek','avocado'].forEach((id: string) => { if (!excludedIds.has(id) && FOOD_DB.some(f => f.id === id)) s.add(id); }); return s; })(),
          preferredByMeal: Object.fromEntries(Object.entries(preferredByMeal || {}).map(([k, v]) => [k, new Set(v as string[] || [])])),
          // Эпик-хвост (8г): specificity удалён из генерации (legacy no-op, UI нет) — движок использует default
          intolerances, tasteProfile,
          categoryPref: { preferred: [], excluded: excludedCategories },
          deprioritizedIds: getDeprioritizedIds(),
          lockedIds, recentFoodIds,
          recentStapleFamilies: offset > 0 ? recentStapleFamilies : undefined,
          specialMealOverride: _specialMealOverrides.length > 0 ? _specialMealOverrides : undefined,
          hardRecentIds: new Set(hardWindow.flat()),
          varietyStrictness,
          diaryCompensation: _diaryActive ? { kcalDelta: diaryComp.delta.kcal, pDelta: diaryComp.delta.p, fDelta: diaryComp.delta.f, cDelta: diaryComp.delta.c, note: diaryComp.note, severity: diaryComp.severity } : undefined,
          budget: plannerModeRef.current === 'minimal' ? 'low' : plannerModeRef.current === 'simple' ? 'medium' : budget, isVegetarian: dietPrefs.includes('vegetarian'),
          isCutting: goal === 'cutting' || goal === 'fat_loss',
          dayOffset: offset, cyclePhase: phase as any,
          randomSalt: planRandomSalt,
          variety: plannerModeRef.current === 'minimal' ? 'minimal' : plannerModeRef.current === 'simple' ? 'medium' : variety,
          wakeTime, lunchTime, dinnerTime, bedTime,
          // Хвост-3: floor/MPS-модификаторы стиля питания теперь из ЕДИНОГО источника
          // (planTypeFloorMods в planner-day-targets) — движок сам выводит их из planType.
          // Декоративный planTypeMod (PLAN_TYPES pMult/fMult/cMult) удалён.
          planType,
          eveningLowCarb,
          addMilkToBreakfast,
          breakfastStyle,
          breakfastTemplate,
          labValues: Object.keys(labValuesForPlan).length > 0 ? labValuesForPlan : undefined,
          calciumTargetOverride: _caInfo ? _caInfo.target : undefined,
          sodiumTargetOverride: _peakTargets?.phase ? _peakTargets.sodiumMg : undefined,
          menstrualPhaseNote: _mp ? _mp.note : undefined,
          carbGiPref: _mp ? _mp.carbGiPref : undefined,
           quality: plannerModeRef.current === 'pro' ? 'full' : 'basic',
           // Этап 4 (БАГ-15/16): инъекции в V2-движок для привязки приёмов к уколам.
           injections: injections.map(i => ({ type: i.type, name: i.name, time: i.time, dose: i.dose, esterType: i.esterType, trainLinked: i.trainLinked, trainTiming: i.trainTiming })),
           // Этап 5: настоящий рефид-день — движок выбирает быстрые/низкоклетчаточные углеводы.
           refeedDay: isRefeedDay,
            // Этап 7: лимит клетчатки из prep/пик-недели ББ (fiberMaxG) — на пик-дне лёгкие овощи.
            fiberCapG: _peakTargets?.fiberMaxG,
            // D-28: «загрузка под утреннюю тренировку» + «еда на работе» (portable) в pro-движок.
            morningTrainLoad,
            portableMode: workFood === 'portable',
            // Работа: окно смены для сдвига обеда/ужина (раньше только классика)
            workStartMin: (()=>{ try{ const [h,m]=(workStartTime||'09:00').split(':').map(Number); return h*60+m; }catch{ return 9*60; }})(),
            workEndMin: (()=>{ try{ const [h,m]=(workEndTime||'18:00').split(':').map(Number); return h*60+m; }catch{ return 18*60; }})(),
            isWorkDay: (()=>{ try{ if(!workScheduleEnabled) return workFood === 'portable'; const ws = workScheduleType; if (ws === 'shift_day_night') { return (offset % 4) < 2; } if (typeof ws === 'string' && ws.startsWith('shift_')) { const parts = ws.split('_'); const workLen = parseInt(parts[1]) || 1; const offLen = parseInt(parts[2]) || workLen; const cycleLen = workLen + offLen; const pos = ((offset % cycleLen) + cycleLen) % cycleLen; return pos < workLen; } const dow=(new Date().getDay()+6)%7; return !!workDays[(dow+offset)%7]; }catch{ return false; }})(),
          };
        // #1 RED-S / Energy Availability: критично для женщин-спортсменок (EA < 30 ккал/кг FFM).
        const _ea = computeEnergyAvailability(input.goalKcal, weight, lbmKg, !!input.isTrainingDay, input.trainDurationMin || 60, (trainIntensity as any) || 'medium', sex);
        // Эпик-хвост: hungerLevel удалён из генерации полностью (множитель белка,
        // prefer-овощи и hungerNote были шумовым сигналом).
        const _redSNote: string | undefined = _ea.note || undefined;
        const rawV2 = buildDayPlanV2(input);
        // D-28 П3: заметки спец-приёмов по дате (рефид/читмил/фастинг) — в proNotes плана.
        if (_specialNotes.length > 0 && rawV2 && Array.isArray(rawV2.notes)) {
          rawV2.notes = [...rawV2.notes, ..._specialNotes];
        }
        const v2: any = {
          ...rawV2,
          meals: Array.isArray(rawV2?.meals) ? rawV2.meals : [],
          totals: rawV2?.totals || { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 },
          diversity: rawV2?.diversity || { uniqueFoods: 0, categories: {} },
          mpsSummary: rawV2?.mpsSummary || { feedings: 0 },
          microSummary: rawV2?.microSummary || { coverage: [] },
        };
        // Эпик 4: микро/DIAAS-контур — дефициты/слабые звенья дня становятся prefer-сигналом
        // для СЛЕДУЮЩЕГО дня серии (мягкий буст, не хард-фильтр). Заметка вчерашнего контура
        // попадает в proNotes сегодняшнего дня (offset > 0).
        try {
          const _def = microDeficitToPreferIds(v2.microSummary?.coverage, dietPrefs.includes('vegetarian'), excludedIds);
          const _diaasMeals = v2.meals.map((m: any) => ({
            label: m?.label || '',
            diaas: (() => { try { return calcMealDIAAS((Array.isArray(m?.items) ? m.items : []).map((it: any) => ({ foodId: it.id, weightGrams: it.amount || 0 }))).diaas; } catch { return null; } })(),
          }));
          const _weak = diaasWeakLinkToPreferIds(_diaasMeals, excludedIds);
          _microLedger.preferIds = new Set<string>([..._def.preferIds, ..._weak.preferIds]);
          _microLedger.notes = [_def.note, _weak.note].filter((n): n is string => Boolean(n));
        } catch { /* контур не должен ломать генерацию */ }
        if (offset > 0 && _microLedger.notes.length > 0 && Array.isArray(v2.notes)) {
          v2.notes = [...v2.notes, ..._microLedger.notes];
        }
        // #8 Health-score дня: composite 0-100 (микро/fiber/MPS/EA/диверс − конфликты).
        const _fiberT = sex === 'female' ? 25 : 35;
        const _cov = (v2.microSummary?.coverage || []).filter((c:any) => !['Na','VitA'].includes(c.nutrient));
        const _microAvg = _cov.length > 0 ? Math.min(100, Math.round(_cov.reduce((s:number,c:any)=>s + Math.min(100, c.pct), 0) / _cov.length)) : 70;
        const _fiberScore = Math.min(100, Math.round((v2.totals.fiber || 0) / _fiberT * 100));
        const _mpsScore = Math.min(100, Math.round((v2.mpsSummary.feedings || 0) / 4 * 100));
        const _eaScore = _ea.status === 'risk' ? 40 : _ea.status === 'reduced' ? 75 : 100;
        const _divScore = Math.min(100, Math.round((v2.diversity.uniqueFoods || 0) / 8 * 100));
        const _conflicts = v2.meals.reduce((s:number,m:any)=>s + (m.rationale||[]).filter((r:string)=>r.startsWith('⚠')).length, 0);
        const _healthScore = Math.max(0, Math.min(100, Math.round(_microAvg*0.3 + _fiberScore*0.15 + _mpsScore*0.2 + _eaScore*0.2 + _divScore*0.15) - _conflicts*5));
        const _healthStatus: 'green' | 'yellow' | 'red' = _healthScore >= 75 ? 'green' : _healthScore >= 55 ? 'yellow' : 'red';
        // Эпик 9в: тренд качества — запись скора дня (0-10) в историю (все режимы).
        try { addDayScore(_prepDate, _healthScore / 10); } catch {}
        // Преобразуем DayPlanV2 → совместимый формат старого dayPlan
        const meals = v2.meals.map((m: any) => ({
          label: m?.label || 'Приём пищи', time: m?.time || '', items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({
            name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c, fiber: it.fiber, leucine_mg: it.leucine_mg,
          })), totals: { kcal: m?.totals?.kcal || 0, p: m?.totals?.p || 0, f: m?.totals?.f || 0, c: m?.totals?.c || 0, fiber: m?.totals?.fiber || 0 },
          type: m?.type,
          conflictWarnings: undefined, synergyNotes: undefined,
           rationale: m.rationale, mpsCheck: plannerModeRef.current === 'pro' ? m.mpsCheck : undefined, target: m.target,
        }));
        // 🍳 Режим генерации: 'recipes' → основные приёмы (Завтрак/Обед/Ужин) собираются
        // из готовых рецептов, перекусы остаются продуктами. 'products' → классика.
        const _genRecipes = generationModeRef.current === 'recipes';
        // 🍲 Рецепты-подсказки: к каждому приёму подбираем 1-3 подходящих рецепта
        // (Эпик 8: тумблер useRecipesInPlan удалён — подсказки работают всегда;
        // в режиме «по рецептам» основные приёмы пересобираются assembleRecipeDay).
        const _cookProf: CookProfile | undefined = cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking });
        const _allRecipes = [...getRecipes(), ...(userRecipes||[])];
        const _recipeBudget = _cookProf ? prepTimeBudgetPerMeal(_cookProf, _effMealsCount) : 60;
        const _filteredRecipes = _cookProf ? filterByCookSkill(_allRecipes, _cookProf.skill) : _allRecipes;
        if (_filteredRecipes.length > 0) {
          meals.forEach((m: any) => {
            // В режиме «по рецептам» основные приёмы получают recipeOptions ниже — чипы-подсказки им не нужны
            if (_genRecipes && isMainMealLabel(m.label)) return;
            const mealTypeMap: Record<string, 'breakfast'|'lunch'|'snack'|'dinner'|'preworkout'|'postworkout'|'presleep'|'snack2'> = {
              'Завтрак': 'breakfast', 'Обед': 'lunch', 'Ужин': 'dinner', 'Перекус': 'snack', 'Второй завтрак': 'snack',
              'Полдник': 'snack', 'Предтрен': 'preworkout', 'Пост-трен': 'postworkout', 'Перед сном': 'presleep',
            };
            const mt = mealTypeMap[m.label] || 'lunch';
            const tgt = m.target || { p: m.totals.p, c: m.totals.c, f: m.totals.f };
            const _currentItemIds = new Set((Array.isArray(m.items) ? m.items : []).map((it: any) => it.id));
            const suggestions = pickRecipesForMeal(_filteredRecipes, {
              mealType: mt, targetKcal: m.totals.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15,
              excludedIds: new Set<string>([...(excludedIds as Set<string>)]), cookProfile: _cookProf, isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: _recipeBudget,
            }, 3);
            if (suggestions.length > 0) {
              m.recipeSuggestions = suggestions.map(r => ({ name: r.name, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, prepTimeMin: r.prepTimeMin, usefulness: r.usefulness, description: r.description, ingredients: r.ingredients, instructions: r.instructions, tags: r.tags }));
            }
          });
        }
        if (_genRecipes && _filteredRecipes.length > 0) {
          // A1: сборка рецептурного дня — чистая функция planner-recipe-mode
          const _asm = assembleRecipeDay({
            meals: meals as any,
            pool: _filteredRecipes,
            targets: { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG },
            excludedIds,
            cookProfile: _cookProf ?? undefined,
            maxPrepTimeMin: _recipeBudget,
            isVegetarian: dietPrefs.includes('vegetarian'),
            preferredRecipeNames: favoriteRecipes.size > 0 ? favoriteRecipes : undefined,
            usedNamesAcrossDays: _usedRecipeNames,
            goal: goal === 'cutting' || goal === 'fat_loss' ? 'cut' : goal === 'maintenance' ? 'maintenance' : 'mass',
            athleteWeightKg: weight,
            // C2/C5 (Эпик C): peri-рецепты только в трен-день; субротация доборов по seed дня.
            trainDay: isTrainDay(offset),
            seed: planRandomSalt + offset,
          });
          meals.splice(0, meals.length, ...(_asm.meals as any[]));
          if (_asm.notes.length > 0) v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._asm.notes];
        }
        // Эпик-хвост (4в): внутридневной DIAAS-ремонт — растительный белок в приёме
        // частично заменяется полным (комплиментарность), до оверрайдов целей.
        try {
          const _diaasRepair = repairDiaasWeakLinks(meals as any, excludedIds);
          if (_diaasRepair.notes.length > 0) {
            meals.splice(0, meals.length, ...(_diaasRepair.meals as any[]));
            v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._diaasRepair.notes];
          }
        } catch {}
        // Эпик 6: ручные цели на приём (🎯) — пост-проход масштабирования к Б/Ж/У слота.
        // Инвариант: день не выходит за ±5% от цели (applyMealTargetOverrides с dayTargets).
        try {
          const _ovRaw = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
          if (Array.isArray(_ovRaw) && _ovRaw.length > 0) {
            const _ov = _ovRaw.filter((o: any) => o && typeof o.label === 'string');
            const _applied = applyMealTargetOverrides(meals as any, _ov as any, { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG });
            meals.splice(0, meals.length, ...(_applied.meals as any[]));
            if (_applied.notes.length > 0) v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._applied.notes];
          }
        } catch {}
        // 🍳 Режим «по рецептам»: итоги дня пересчитываются из фактических приёмов
        // (после замены основных приёмов и ребаланса), а не из V2-тоталов.
        const _finalDayTotals = _genRecipes ? sumDayTotals(meals as any) : null;
        const dayKcalForPct = Math.max(1, _finalDayTotals ? _finalDayTotals.kcal : v2.totals.kcal);
        const mealTimesPro = meals.map((m: { time: string; label: string; totals: { kcal: number } }) => ({ time: m.time, label: m.label, pct: Math.round((m.totals.kcal / dayKcalForPct) * 100) }));
        // FIX allergens-restrictions: пост-генерационная проверка аллергенов в pro-пути
        // (раньше была только в legacy; с резолвером в excludedIds срабатывает редко —
        // только если пользователь вручную заменил продукт на аллергенный).
        const _allergenWarnings: { food: string; allergens: string[] }[] = [];
        if ((allergens || []).length > 0) {
          meals.forEach((m: any) => (Array.isArray(m.items) ? m.items : []).forEach((it: any) => {
            const food = FOOD_DB.find(f => f.id === it.id);
            if (!food || excludedIds.has(food.id)) return;
            const matched = allergens.filter(a => matchesSelectedAllergen(food, a, FOOD_DB));
            if (matched.length > 0) _allergenWarnings.push({ food: it.name, allergens: matched.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a) });
          }));
        }
        // Smart 7-day variety: collect this day's foods so subsequent days see them (soft + hard window).
        const _dayFoodIds = collectDayFoods({ meals });
        _dayFoodIds.forEach((id: string) => recentFoodIds.add(id));
        hardWindow.push(_dayFoodIds);
        if (hardWindow.length > 2) hardWindow.shift();
        // D (Эпик D): леджер хранит окно последних 2 дней — стык недель месяца не повторяет стейплы.
        varietyLedgerRef.current.recent = hardWindow.slice();
        return {
          meals, totals: _finalDayTotals
            ? { kcal: _finalDayTotals.kcal, p: _finalDayTotals.p, f: _finalDayTotals.f, c: _finalDayTotals.c, fiber: _finalDayTotals.fiber || 0 }
            : { kcal: v2.totals.kcal, p: v2.totals.p, f: v2.totals.f, c: v2.totals.c, fiber: v2.totals.fiber },
          isTrainingDay: v2.isTrainingDay,
          allergenWarnings: _allergenWarnings,
          supplementTimeline: buildSupplementTimeline(mealTimesPro, v2.isTrainingDay),
          waterTimeline: (() => {
            const wl = buildWaterTimeline(weight, mealTimesPro, v2.isTrainingDay, trainStart);
            if (_peakTargets?.phase) {
              const total = wl.reduce((s: number, w: any) => s + (w.ml || 0), 0);
              const mult = total > 0 ? _peakTargets.waterMl / total : 1;
              return wl.map((w: any) => ({ ...w, ml: Math.max(50, Math.round((w.ml || 0) * mult)) }));
            }
            return wl;
          })(),
          nutritionLogic: [],
          dietDiversity: { uniqueFoods: v2.diversity.uniqueFoods, totalPortions: 0, categories: v2.diversity.categories, score: Math.min(10, v2.diversity.uniqueFoods), note: `${v2.diversity.uniqueFoods} уникальных продуктов` },
          timingScores: [], intraWorkout: null, mpsSummary: v2.mpsSummary, proNotes: v2.notes,
          microSummary: v2.microSummary,
          diaryCompensation: _diaryActive ? diaryComp : undefined,
          isRefeedDay,
          refeedNote: isRefeedDay ? '🔄 Refeed-день: углеводы ×2.2 (восстановление гликогена/лептина), жиры снижены, белок удержан. Психологическая разгрузка на сушке.' : undefined,
          // Эпик 1: волна 2+1 — заметка недели из единой функции периодизации.
          periodizationWeekNote: _perio.weekNote,
          heavyDayNote: _isHeavyDay ? '🏋️ День тяжёлых ног/объёма: углеводы +25%, ккал +5% (гликоген к сессии).' : undefined,
          menstrualPhaseNote: _mp ? _mp.note : undefined,
          cycleCalendarNote: _cycleCalendarNote,
          boneNotes: _boneNotes.length > 0 ? _boneNotes : undefined,
          sleepNote: _sleepNote,
          dietBreakNote: _dietBreakNote,
          categoryNote: _categoryNote,
          peakWeekNote: _peakNote,
          lifeStageNote: _lifeStageNote,
          redSNote: _redSNote,
          energyAvailability: _ea,
          healthScore: plannerModeRef.current === 'pro' ? { score: _healthScore, status: _healthStatus, micro: _microAvg, fiber: _fiberScore, mps: _mpsScore, ea: _eaScore, diversity: _divScore, conflicts: _conflicts } : null,
        };
      };

      await maybeYield();
      const d1 = buildOneDay(dayIdx);
      let d2: any = null, d3: any = null, weekDays: any[] = [], weekData: any = null;
      setDayPlan(d1);
      if (days >= 3) {
        await maybeYield();
        d2 = buildOneDay(1); await maybeYield(); d3 = buildOneDay(2);
        setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: (d1?.totals?.kcal || 0) + (d2?.totals?.kcal || 0) + (d3?.totals?.kcal || 0), p: (d1?.totals?.p || 0) + (d2?.totals?.p || 0) + (d3?.totals?.p || 0), f: (d1?.totals?.f || 0) + (d2?.totals?.f || 0) + (d3?.totals?.f || 0), c: (d1?.totals?.c || 0) + (d2?.totals?.c || 0) + (d3?.totals?.c || 0), fiber: (d1?.totals?.fiber||0) + (d2?.totals?.fiber||0) + (d3?.totals?.fiber||0) } });
      }
      if (days >= 7) {
        // FIX train-bind: месяц смещает offset на weekIndex*7 — плавающий график (eod/pattern)
        // продолжается через границу недель (раньше каждый месяц-week рестартовал паттерн,
        // давая две тренировки подряд на стыке недель).
        const _weekBase = weekIndex !== undefined ? weekIndex * 7 : 0;
        const _weekAcc: any[] = [];
        for (let _i = 0; _i < 7; _i++) {
          await maybeYield();
          _weekAcc.push(buildOneDay(_weekBase + _i));
        }
        weekDays = _weekAcc;
        weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + (d?.totals?.kcal || 0), 0), p: weekDays.reduce((s: any,d: any) => s + (d?.totals?.p || 0), 0), f: weekDays.reduce((s: any,d: any) => s + (d?.totals?.f || 0), 0), c: weekDays.reduce((s: any,d: any) => s + (d?.totals?.c || 0), 0) }};
        if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
        else setWeekPlan(weekData);
      }
      // Shopping list — use already-generated plan data (not regenerate!)
      // F: единая агрегация (в т.ч. после замены приёмов рецептами) вынесена в planner-recipe-mode
      let allDayPlans: any[];
      if (days >= 7 && weekDays.length > 0) { allDayPlans = weekDays; }
      else if (days >= 3 && d2 && d3) { allDayPlans = [d1, d2, d3]; }
      else { allDayPlans = [d1]; }
      const shoppingArr = buildShoppingFromPlans(allDayPlans);
      setShoppingList(shoppingArr);
      // Water
      const safeInjections = Array.isArray(injections) ? injections : [];
      const hasPharma = safeInjections.length > 0 || (courseEntries?.length || 0) > 0;
      const aasCount = safeInjections.filter(i => i.type === 'ААС').length;
      const pharmaHeavy = aasCount + safeInjections.filter(i => i.type === 'инсулин').length + safeInjections.filter(i => i.type === 'ГР').length;
      const baseWaterMl = weight * Math.min(45, 40 + pharmaHeavy * 1.5);
      const trainBonusL = [0, 1, 2, 3, 4, 5, 6].some(d => isTrainDay(d)) ? 0.5 : 0.2;
      const fiberBonusL = 0.1;
      const pharmaBonusL = hasPharma ? 0.5 : 0;
      const totalWaterL = Math.max(1.5, Math.round((baseWaterMl / 1000 + trainBonusL + fiberBonusL + pharmaBonusL) * 10) / 10);
      setWaterCalc({ baseWater: Math.round(baseWaterMl / 10) / 10, pharmaBaseMl: 40, trainBonus: trainBonusL, fiberFactor: fiberBonusL, pharmaBonus: pharmaBonusL, total: totalWaterL, hasPharma, electrolytes: { sodiumMg: 3500, potassiumMg: 3500, magnesiumMg: 400, note: 'Стандарт' } });
      setGenerated(true);
      try { setPlanTab('plan'); } catch {}
       try { generateRecommendations(); } catch (e: any) { try { console.warn('[Planner] recommendations failed:', e); } catch {} }
       // P2-audit fix: guard scrollIntoView (jsdom/старые браузеры без API — uncaught TypeError).
       setTimeout(() => { try { if (resultsRef.current && typeof resultsRef.current.scrollIntoView === 'function') resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 100);
       // P5-audit fix: planBusy сбрасывался только в классическом пути — в pro-пути «⏳ Генерация…» зависала навсегда.
       try { setPlanBusy(false); } catch {}
       return; // Bug-2 fix: Pro успешно — НЕ проваливаемся в классический путь (иначе classic перетирал Pro-план, и юзер всегда видел классический результат).
      } catch (v2Err: any) {
        // v6: classic удалён — фоллбэк больше не классический, а ошибка с подсказкой.
        const errMsg = (v2Err && (v2Err.message || String(v2Err))) || 'Unknown error';
        try { console.warn('[IndividualPlan] V2 engine failed:', errMsg, v2Err); } catch {}
        try { setErrorMsg('Не удалось собрать план: ' + errMsg + ' Попробуйте упростить исключения/фильтры.'); } catch {}
        try { setDayPlan(null); setThreeDayPlan(null); setWeekPlan(null); } catch {}
        try { setPlanBusy(false); } catch {}
        return;
      }
    }
    // v6: classic-движок удалён (buildDay ~700 строк). simple/minimal — пресеты pro.
    // classic fully removed (v6)

    } catch (e: any) {
      const message = e?.message || String(e) || 'Ошибка генерации плана. Проверьте введённые данные.';
      console.error('[PlanGen] Error:', e);
      try { localStorage.setItem('he_planner_last_error', JSON.stringify({ message, at: new Date().toISOString() })); } catch {}
      setErrorMsg(message);
    }
    if (isAsync) setPlanBusy(false);
  };

const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // P0-2: Pro Engine — единственный движок (был всегда true, переключатель в UI отсутствовал).
  // Сохраняем fallback на классический путь внутри generatePlan через try/catch для живучести.
  const useProEngine: true = true;
  const [planTab, setPlanTab] = useState<string>(() => { try { return localStorage.getItem('he_plan_active_tab') || 'settings'; } catch { return 'settings'; } });
  useEffect(() => { try { localStorage.setItem('he_plan_active_tab', planTab); } catch {} }, [planTab]);

  // Хвост-1 (god-component рефактор): спец-приёмы/спец-планы/рекомендации вынесены
  // в под-хук (planner-special-meal-state.ts). Возвращает те же имена — в PlanCtx ниже.
  const {
    specialMealMode, setSpecialMealMode, specialMealGoal, setSpecialMealGoal,
    specialMealProteinG, setSpecialMealProteinG, specialMealFatG, setSpecialMealFatG,
    specialMealCarbsG, setSpecialMealCarbsG, specialMealTiming, setSpecialMealTiming,
    specialMealReplaceMode, setSpecialMealReplaceMode, specialMealReplaceTarget, setSpecialMealReplaceTarget,
    cheatMealPlan, setCheatMealPlan, carbloadPlan, setCarbloadPlan, butchPlan, setButchPlan,
    cravingPlan, setCravingPlan, lazyDayPlan, setLazyDayPlan,
    recommendations, setRecommendations,
    generateCheatMeal, generateCarbload, generateBUTCH, generateCravingPlan, generateLazyDayPlan,
    generateRecommendations,
  } = usePlannerSpecialMealState({
    isTrainDay, allergens, dietPrefs, plannerModeRef, goal, phase, weight,
    effectiveKcal, effectiveP, effectiveF, effectiveC, cravingDays, lazyDayDays,
    injections, linkToTraining, trainStart, trainEnd, sex, bodyFatPct, trainType,
    v2Phase, v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {},
    v2Labs: v2Labs && typeof v2Labs === 'object' ? v2Labs : {},
    histamineSensitive, generated, planDays, dayPlan, threeDayPlan, weekPlan, carbPeriodization,
  });

  // E7: модалка имени плана (замена window.prompt)
  const [savePlanPrompt, setSavePlanPrompt] = useState<{ open: boolean; value: string } | null>(null);
  // FIX train-bind: тренировочные дни как производный 7-дневный массив — нужен и отчётам
  // (generateFullNutritionReport), поэтому остаётся в провайдере.
  const _trainDaysArr = Array.from({ length: 7 }, (_, i) => isTrainDay(i));

  const saveCurrentPlan = () => {
    // E7: prompt() → модалка (мобильный UX, нативный prompt блокировался в Telegram WebApp)
    setSavePlanPrompt({ open: true, value: `${new Date().toLocaleDateString('ru-RU')} · ${Math.round(dayPlan?.totals?.kcal || 0)} ккал` });
  };
  const confirmSavePlan = () => {
    const name = (savePlanPrompt?.value || '').trim() || `План ${new Date().toLocaleDateString('ru-RU')}`;
    setSavePlanPrompt(null);
    const plan: SavedPlan = { id: Date.now(), date: new Date().toISOString().split('T')[0], name, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc };
    const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10);
    setSavedPlans(updated);
    // P1-fix: показываем ошибку пользователю при неудаче сохранения (раньше только console.warn)
    if (!safeWriteJSON('he_saved_nutrition_plans', updated)) {
      try { console.warn('[Planner] saved plans not saved (quota?)'); } catch {}
      setErrorMsg('⚠️ Не удалось сохранить план: превышен лимит localStorage. Удалите старые планы или отчёты.');
    } else {
      setErrorMsg(null);
      if (typeof (window as any).showToast === 'function') (window as any).showToast(`💾 План «${name}» сохранён`, 'success');
    }
  };

  const autoCorrectPlan = () => {
    // B6 (Эпик B): автокоррекция через ЕДИНЫЙ корректор correctDayToTargets.
    // Было: плоская ratio-подгонка только недобора (перебор max(0,…)=0 резал все приёмы
    // ×0.3), ломала консистентность kcal=4Б+9Ж+4У, не работала для 3/7-дневных планов.
    // Теперь: корректор движка (полы порций, ядро рецепта, Atwater), день ± цели, плюс
    // синхронная правка выбранного дня 3/7-дневного плана и закупок.
    const targets = { kcal: effectiveKcal, p: effectiveP, f: effectiveF, c: effectiveC };
    if (!targets.kcal && !targets.p) return;
    saveUndo();
    const applyTo = (plan: any): any => {
      if (!plan?.meals || !Array.isArray(plan.meals) || plan.meals.length === 0) return null;
      const res = correctDayToTargets(plan.meals, targets, { weightKg: weight, maxIter: 60 });
      const meals = res.meals.map((m: any) => ({
        ...m,
        totals: { kcal: m.totals?.kcal || 0, p: m.totals?.p || 0, f: m.totals?.f || 0, c: m.totals?.c || 0, fiber: m.totals?.fiber || 0 },
      }));
      const totals = meals.reduce((acc: any, m: any) => ({
        kcal: acc.kcal + m.totals.kcal, p: acc.p + m.totals.p, f: acc.f + m.totals.f, c: acc.c + m.totals.c, fiber: (acc.fiber || 0) + m.totals.fiber,
      }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
      return { ...plan, meals, totals };
    };
    const correctedDay = applyTo(dayPlan);
    if (correctedDay) setDayPlan(correctedDay);
    // B6: мультидневность — правим выбранный день 3/7-дневного плана (если виден).
    const _idx = weekEditDay ?? selectedDayIndex ?? 0;
    if (planDays >= 7 && weekPlan?.days?.length) {
      const i = Math.min(_idx, weekPlan.days.length - 1);
      const corrected = applyTo(weekPlan.days[i]);
      if (corrected) setWeekPlan((prev: any) => { const days = [...prev.days]; days[i] = corrected; return { ...prev, days }; });
    }
    if (planDays === 3 && threeDayPlan?.days?.length) {
      const i = Math.min(_idx, threeDayPlan.days.length - 1);
      const corrected = applyTo(threeDayPlan.days[i]);
      if (corrected) setThreeDayPlan((prev: any) => { const days = [...prev.days]; days[i] = corrected; return { ...prev, days }; });
    }
    // Синк закупок из фактических планов (добавки корректора должны попасть в список).
    try {
      const allPlans: any[] = [];
      if (correctedDay) allPlans.push(correctedDay);
      if (planDays === 3 && threeDayPlan?.days) allPlans.push(...threeDayPlan.days);
      if (planDays >= 7 && weekPlan?.days) allPlans.push(...weekPlan.days);
      if (allPlans.length > 0) setShoppingList(buildShoppingFromPlans(allPlans));
    } catch {}
    try { if (typeof (window as any).showToast === 'function') (window as any).showToast('📊 Рацион скорректирован к целям КБЖУ', 'success'); } catch {}
  };

  const [mealPrepPlan, setMealPrepPlan] = useState<{ steps: MealPrepStep[]; totalTime: number; containers: number } | null>(null);
  const [mealPrepDays, setMealPrepDays] = useState<1 | 3 | 7>(1);

  const generateMealPrep = () => {
    // 🍳 Режим «по рецептам»: если в плане есть выбранные рецепты — карточка «Процесс
    // готовки» строится из ИНСТРУКЦИЙ этих рецептов (а не из generic-фаз mealprep).
    try {
      const applied = (() => {
        if (mealPrepDays === 1) return collectAppliedRecipes(dayPlan);
        if (mealPrepDays === 3) return (threeDayPlan?.days || []).flatMap((d: any) => collectAppliedRecipes(d));
        return (weekPlan?.days || []).flatMap((d: any) => collectAppliedRecipes(d));
      })();
      if (applied.length > 0) {
        const rp = buildRecipeCookingPlan(applied, mealPrepDays);
        if (rp) { setMealPrepPlan(rp as any); recipeCookingActiveRef.current = true; return; }
      }
    } catch {}
    recipeCookingActiveRef.current = false;
    const _r = buildMealPrep({ mealPrepDays, dayPlan, threeDayPlan, weekPlan }); if (!_r) { generatePlan(mealPrepDays as 1|3|7); return; } setMealPrepPlan(_r);
  };

  /** A4: тихая пересборка открытой рецептурной карточки готовки из обновлённых планов. */
  const refreshRecipeCookingCardIfActive = (dayP: any, threeP: any, weekP: any) => {
    if (!recipeCookingActiveRef.current) return;
    try {
      const applied = (() => {
        if (mealPrepDays === 1) return collectAppliedRecipes(dayP);
        if (mealPrepDays === 3) return (threeP?.days || []).flatMap((d: any) => collectAppliedRecipes(d));
        return (weekP?.days || []).flatMap((d: any) => collectAppliedRecipes(d));
      })();
      if (applied.length === 0) { recipeCookingActiveRef.current = false; return; }
      const rp = buildRecipeCookingPlan(applied, mealPrepDays);
      if (rp) setMealPrepPlan(rp as any);
    } catch {}
  };

  // FatSecret-уровень: 1-клик в дневник — берёт видимый план (1 день / выбранный день 3/7) и пишет в nutrition_diary_v2
  // При planDays===7/3 добавляет ВСЮ неделю/3 дня на последовательные даты (FatSecret-замена: недельный план разом)
  const addPlanToDiary = useCallback((dateISO?: string): boolean => {
    try {
      // E7: локальная дата (UTC-сдвиг уезжал на завтра вечером в UTC+3..+12)
      const _now = new Date();
      const baseDate = dateISO || `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
      const data = readDiaryV2();
      const addDay = (src: any, dateStr: string) => {
        if (!src?.meals || !Array.isArray(src.meals) || src.meals.length === 0) return 0;
        if (!data[dateStr]) data[dateStr] = { meals: {} };
        let added = 0;
        src.meals.forEach((m: any) => {
          const label = m.label || 'Приём пищи';
          if (!data[dateStr].meals[label]) data[dateStr].meals[label] = [];
          (Array.isArray(m.items) ? m.items : []).forEach((it: any) => {
          (data[dateStr].meals[label] as any).push({
            name: it.name, qty: `${it.amount || 100} г` as any, kcal: Math.round(it.kcal || 0),
            p: Math.round((it.p || 0) * 10) / 10, f: Math.round((it.f || 0) * 10) / 10, c: Math.round((it.c || 0) * 10) / 10,
            category: (it as any).category, foodId: it.id || (it as any).foodId, micros: (it as any).micros,
          });
            added++;
          });
        });
        return added;
      };
      let totalAdded = 0;
      if (planDays === 7 && weekPlan?.days) {
        const base = new Date(baseDate);
        weekPlan.days.forEach((d: any, i: number) => {
          const dt = new Date(base); dt.setDate(base.getDate() + i);
          const iso = dt.toISOString().slice(0, 10);
          totalAdded += addDay(d, iso);
        });
      } else if (planDays === 3 && threeDayPlan?.days) {
        const base = new Date(baseDate);
        threeDayPlan.days.forEach((d: any, i: number) => {
          const dt = new Date(base); dt.setDate(base.getDate() + i);
          const iso = dt.toISOString().slice(0, 10);
          totalAdded += addDay(d, iso);
        });
      } else {
        let source: any = null;
        if (planDays === 1) source = dayPlan;
        else if (planDays === 3) source = threeDayPlan?.days?.[selectedDayIndex] || dayPlan;
        else if (planDays === 7) source = weekPlan?.days?.[selectedDayIndex] || dayPlan;
        else source = dayPlan;
        if (!source?.meals || !Array.isArray(source.meals) || source.meals.length === 0) {
          setErrorMsg('Нет сгенерированного плана для добавления в дневник');
          return false;
        }
        totalAdded += addDay(source, baseDate);
      }
      if (totalAdded === 0) { setErrorMsg('Нет сгенерированного плана для добавления в дневник'); return false; }
      writeDiaryV2(data);
      setErrorMsg(null);
      return true;
    } catch (e: any) {
      setErrorMsg('Не удалось добавить в дневник: ' + (e?.message || String(e)));
      return false;
    }
  }, [dayPlan, planDays, selectedDayIndex, threeDayPlan, weekPlan]);

  // Хвост-1 (god-component рефактор): состояние отчётов + генераторы вынесены в под-хук
  // (planner-report-state.ts). Возвращает те же имена — раскладываются в PlanCtx ниже.
  const {
    activeReports, setActiveReports, allergenReport, setAllergenReport, nutrientReport, setNutrientReport,
    qualityReport, setQualityReport, riskReport, setRiskReport,
    drugCompatReport, setDrugCompatReport, nutritionReport, setNutritionReport,
    generateAllergenReport, generateNutrientReport, generateQualityReport, generateRiskReport,
    generateDrugCompatReport, generateFullNutritionReport,
  } = usePlannerReportState({
    dayPlan, allergens, budget, weight, injections,
    v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {},
    phase, takenSupplements: Array.isArray(takenSupplements) ? takenSupplements : [],
    planTargets, planType, variety, healthIssues, waterCalc,
    linkToTraining, trainStart, trainDaysArr: _trainDaysArr, carbPeriodization,
  });

  // P1-7: renderMealList вынесен в MealListRender.tsx (267 строк → 1 строка)
  const ctx = useMemo<Omit<PlanCtx, 'renderMealList'>>(() => ({
    profile, s, courseEntries, annualPhase, combatNutrition,
    weight, setWeight, height, setHeight, age, setAge, sex, setSex,
    dailySteps, setDailySteps, cookTimeMin, setCookTimeMin,
    cookingSkill, setCookingSkill, cookingFrequency, setCookingFrequency, batchCooking, setBatchCooking,
    cravingMode, setCravingMode, cravingDays, setCravingDays,
    lazyDayMode, setLazyDayMode, lazyDayDays, setLazyDayDays,
    trainType, setTrainType, trainIntensity, setTrainIntensity,
    intraWorkoutEnabled, setIntraWorkoutEnabled,
    householdActivity, setHouseholdActivity,
    bodyFatPct, setBodyFatPct, sleepHours, setSleepHours,
    sleepQuality, setSleepQuality, stressLevel, setStressLevel,
    cyclePhase, setCyclePhase,
    weightAdaptMode, setWeightAdaptMode, weightLogWeek, setWeightLogWeek,
    expectedLossKgWeek, setExpectedLossKgWeek,
    showWeightAdaptModal, setShowWeightAdaptModal,
    weightLogEntries, setWeightLogEntries,
    weightLogPeriod, setWeightLogPeriod,
    metabolicAdaptEnabled, setMetabolicAdaptEnabled, metabolicAdaptPct, setMetabolicAdaptPct,
    manualGPerKg, setManualGPerKg,
    monthPlanMode, setMonthPlanMode, monthPlan, setMonthPlan, selectedWeek, setSelectedWeek,
    goal, setGoal, phase, setPhase, autoGoal,
    goalUserSet, setGoalUserSet,
    injections, setInjections,
    injName, setInjName, injTime, setInjTime, injDose, setInjDose,
    injUnit, setInjUnit, injType, setInjType, injEster, setInjEster,
    trainStart, setTrainStart, trainEnd, setTrainEnd, linkToTraining, setLinkToTraining,
    trainScheduleType, setTrainScheduleType, trainPattern, setTrainPattern, isTrainDay,
    injectDrugTypes, calcTargets, profileTargets,
    effectiveKcal, effectiveP, effectiveF, effectiveC, dayTargetsBreakdown, carbCapClipped, carbCapGPerKg,
    kbjuMode, setKbjuMode, switchKbjuMode,
    manualKcal, setManualKcal, manualP, setManualP, manualF, setManualF, manualC, setManualC,
    resultsRef, budget, setBudget, proteinPreset, setProteinPreset,
    variety, setVariety, diaryAdaptation, setDiaryAdaptation, varietyStrictness, setVarietyStrictness, varietyLevel, setVarietyLevel, bbCategory, setBBCategory, peakWeekEnabled, setPeakWeekEnabled, peakWeekShowDay, setPeakWeekShowDay, bbPrepConfig, setBBPrepConfig, applyBBPeakToPlan, lifeStage, setLifeStage, wakeTime, setWakeTime, bedTime, setBedTime,
    lunchTime, setLunchTime, dinnerTime, setDinnerTime, mealsCount, setMealsCount,
    workFood, setWorkFood, allergens, setAllergens, healthIssues, setHealthIssues,
    morningTrainLoad, setMorningTrainLoad,
    eveningLowCarb, setEveningLowCarb, planType, setPlanType,
    addMilkToBreakfast, setAddMilkToBreakfast, breakfastStyle, setBreakfastStyle, breakfastTemplate, setBreakfastTemplate,
    preferredFoods, setPreferredFoods, preferredByMeal, setPreferredByMeal, specificity, setSpecificity, intolerances, setIntolerances, tasteProfile, setTasteProfile, excludedCategories, setExcludedCategories, excludedFoods, setExcludedFoods,
    allergenExcludedCount, setAllergenExcludedCount, planTargets, setPlanTargets,
    carbPeriodization, setCarbPeriodization, heavyTrainDay, setHeavyTrainDay,
    workScheduleEnabled, setWorkScheduleEnabled,
    workStartTime, setWorkStartTime, workEndTime, setWorkEndTime,
    workDays, setWorkDays, workScheduleType, setWorkScheduleType,
    trainingDays, setTrainingDays, DAY_LABELS,
    generated, setGenerated, planDays, setPlanDays, selectedDayIndex, setSelectedDayIndex, planBusy,
    planView, setPlanView, dayPlan, setDayPlan, threeDayPlan, setThreeDayPlan,
    weekPlan, setWeekPlan, shoppingList, setShoppingList, waterCalc, setWaterCalc,
    savedPlans, setSavedPlans, expandedSavedId, setExpandedSavedId,
    lockedFoodIds, toggleLockFood,
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    recipePickerMeal, setRecipePickerMeal, mealPrep, setMealPrep,
    dayPlanNotes, setDayPlanNotes, draggedItem, setDraggedItem, dropTarget, setDropTarget,
    undoStack, setUndoStack, userRecipes, setUserRecipes,
    showRecipeCreator, setShowRecipeCreator,
    showAddDrug, setShowAddDrug, showDrugTypePicker, setShowDrugTypePicker,
    takenSupplements, setTakenSupplements, showSuppPicker, setShowSuppPicker,
    suppSearch, setSuppSearch, newRecipe, setNewRecipe,
    saveUndo, moveFoodItem, findSimilarFoods, replaceFoodItem,
    quickAddMealIdx, setQuickAddMealIdx, quickAddSearch, setQuickAddSearch,
    updateItemAmount, removeFoodItem, replaceMealWithRecipe, addSecondRecipeToMeal, generatePlan,
    generationMode, setGenerationMode,
    favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe,
    pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced,
    updateMealTime, duplicateMeal,
    weekEditDay, openWeekDayForEdit, switchPlanDays,
    addFoodToMeal, addSnackComboToMeal, undoLast,
    toggleAllergen, toggleHealthIssue, loadSavedPlan,
    autofillFromProfile, saveToProfile,
    generateCheatMeal, generateCarbload, generateBUTCH,
    generateCravingPlan, generateLazyDayPlan,
    generateRecommendations, autoCorrectPlan, saveCurrentPlan, addPlanToDiary,
    generateMealPrep, mealPrepPlan, setMealPrepPlan, mealPrepDays, setMealPrepDays,
    specialMealMode, setSpecialMealMode,
    specialMealGoal, setSpecialMealGoal,
    specialMealProteinG, setSpecialMealProteinG,
    specialMealFatG, setSpecialMealFatG,
    specialMealCarbsG, setSpecialMealCarbsG,
    specialMealTiming, setSpecialMealTiming,
    specialMealReplaceMode, setSpecialMealReplaceMode,
    specialMealReplaceTarget, setSpecialMealReplaceTarget,
    cheatMealPlan, setCheatMealPlan, carbloadPlan, setCarbloadPlan,
    butchPlan, setButchPlan,
    cravingPlan, setCravingPlan,     lazyDayPlan, setLazyDayPlan,
    surplusPct, setSurplusPct,
    recommendations, setRecommendations,
    activeReports, setActiveReports,
    allergenReport, setAllergenReport, nutrientReport, setNutrientReport,
    qualityReport, setQualityReport, riskReport, setRiskReport,
    drugCompatReport, setDrugCompatReport, nutritionReport, setNutritionReport,
    generateAllergenReport, generateNutrientReport, generateQualityReport,
    generateRiskReport, generateDrugCompatReport, generateFullNutritionReport,
     customNotes, setCustomNotes,
    dietPrefs, setDietPrefs,
    v2Phase, setV2Phase, v2Labs, setV2Labs, v2Pharma, setV2Pharma,
     histamineSensitive, setHistamineSensitive: setHistamineSynced,
     plannerMode, setPlannerMode,
    labAnalysis,
    errorMsg, setErrorMsg,
    useProEngine,
    planTab, setPlanTab,
    labs,
  }), [addPlanToDiary, weight, height, age, sex, dailySteps, cookTimeMin, cookingSkill, cookingFrequency, batchCooking, cravingMode, cravingDays, lazyDayMode, lazyDayDays, surplusPct, trainType, trainIntensity, householdActivity, bodyFatPct, sleepHours, sleepQuality, stressLevel, cyclePhase, weightAdaptMode, weightLogWeek, expectedLossKgWeek, showWeightAdaptModal, weightLogEntries, weightLogPeriod, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, monthPlanMode, monthPlan, selectedWeek, goal, phase, goalUserSet, injections, injName, injTime, injDose, injUnit, injType, injEster, trainStart, trainEnd, linkToTraining, trainScheduleType, trainPattern, manualKcal, manualP, manualF, manualC, kbjuMode, budget, proteinPreset, variety, varietyLevel, wakeTime, bedTime, lunchTime, dinnerTime, workFood, morningTrainLoad, mealsCount, allergens, healthIssues, eveningLowCarb, addMilkToBreakfast, breakfastStyle, breakfastTemplate, planType, preferredFoods, quickAddMealIdx, quickAddSearch, customNotes, excludedFoods, dietPrefs, allergenExcludedCount, planTargets, carbPeriodization, heavyTrainDay, workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType, trainingDays, generated, planDays, selectedDayIndex, planView, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc, savedPlans, lockedFoodIds, expandedSavedId, editItem, editAmount, replacingItem, recipePickerMeal, mealPrep, dayPlanNotes, draggedItem, dropTarget, undoStack, userRecipes, showRecipeCreator, showAddDrug, showDrugTypePicker, takenSupplements, showSuppPicker, suppSearch, newRecipe, v2Phase, v2Labs, v2Pharma, histamineSensitive, errorMsg, planTab, specialMealMode, specialMealGoal, specialMealProteinG, specialMealFatG, specialMealCarbsG, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget, cheatMealPlan, carbloadPlan, butchPlan, cravingPlan, lazyDayPlan, recommendations, mealPrepPlan, mealPrepDays, activeReports, allergenReport, nutrientReport, qualityReport, riskReport, drugCompatReport, nutritionReport, profile, s, courseEntries, labAnalysis, labs, bbPrepConfig, autoGoal, injectDrugTypes, calcTargets, profileTargets, effectiveKcal, effectiveP, effectiveF, effectiveC, allergenExcludedCount]);

  const renderMealList = useRenderMealList({ ...ctx, plannerMode });
  const finalCtx = useMemo<PlanCtx>(() => ({ ...ctx, plannerMode, setPlannerMode, generationMode, setGenerationMode, favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced, updateMealTime, duplicateMeal, renderMealList, annualPhase }), [ctx, plannerMode, generationMode, favoriteRecipes, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced, updateMealTime, duplicateMeal, renderMealList, annualPhase]);
  return (
    <PlanContext.Provider value={finalCtx}>
      {children}
      {savePlanPrompt?.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', padding: 16 }} onClick={() => setSavePlanPrompt(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, padding: 18, borderRadius: 16, background: 'linear-gradient(135deg,#1a1c26,#18181b)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>💾 Сохранить план</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Название плана</div>
            <input
              value={savePlanPrompt.value}
              onChange={e => setSavePlanPrompt({ open: true, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') confirmSavePlan(); }}
              autoFocus
              maxLength={60}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setSavePlanPrompt(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
              <button onClick={confirmSavePlan} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </PlanContext.Provider>
  );
};
