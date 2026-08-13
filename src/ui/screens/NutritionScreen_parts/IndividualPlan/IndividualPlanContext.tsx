import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB, FOOD_ALLERGEN_DIET, compositeQualityScore } from "../../../../core/nutrition-database";
import { PHARMA_DB } from "../../../../core/pharma-database";
import { updateProfile, getProfile } from "../../../../core/profile-manager";
import { getRecipes, getRecipesByMeal, type Recipe } from "../../../../engines/nutrition-periodization.engine";
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type MealScoreV2 } from "../../../../engines/product-usefulness-v2.engine";
import { scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU, parseServingSizeGrams } from "../../../../engines/kbju-food-match.engine";
import { generateNutritionReport, type NutritionReport } from "../../../../engines/nutrition-report.engine";
import type { UserProfile, LabPoint } from "../../../../core/types";
import { getContraindications, saveContraindications } from "../../../../core/contraindications";
import { updateSection } from "../../../../core/profile-manager";
import { getWeightLog, saveWeightLog } from "../../../../engines/profile-store";
import { getNutritionV2Data, saveNutritionV2Data } from "../../../../core/nutrition-v2-data";
import { ALL_SUBSTANCES } from "../../../../data/support-substances";
import { computePlannerTargets } from "./planner-targets";
import { safeWriteJSON, migratePlannerStorage } from "./planner-storage";
import { generateAllergenReportPure, generateNutrientReportPure, generateQualityReportPure, generateRiskReportPure, generateDrugCompatReportPure } from "./planner-reports"; // P1-7: чистые функции отчётов вынесены из context
import { generateCheatMeal as generateCheatMealSm, generateCarbload as generateCarbloadSm, generateBUTCH as generateBUTCHSm, generateCravingPlan as generateCravingPlanSm, generateLazyDayPlan as generateLazyDayPlanSm } from "./planner-special-meals"; // P1-7: генераторы специальных режимов еды вынесены
import { buildRecommendations } from "./planner-recommendations"; // P1-7: generateRecommendations вынесен
import { buildMealPrep } from "./planner-mealprep"; // P1-7: generateMealPrep вынесен
import { useRenderMealList } from "./MealListRender"; // P1-7: renderMealList вынесен
import { getAutoExcludedFoodIds } from "./OrganLoadBadges"; // P2-12: organ-load auto restrictions
import { loadReplaceHistory, recordReplacement, getDeprioritizedIds, clearReplaceHistory, expandRecipePreferred, type Specificity, type CategoryPref, type Intolerances, type TasteProfile } from "./planner-preferences"; // Bug-infra: квота-безопасная запись // Bug-4: чистая функция расчёта КБЖУ-целей
import { resolveAllExcludedFoodIds, countExcludedByAllergens, matchesSelectedAllergen, allergenTextMatches, getFoodAllergenTags, USER_ALLERGEN_TO_TAGS, dietRestrictionTags } from "./planner-restrictions"; // FIX allergens-restrictions: единый резолвер аллергенов/ограничений
import { DEFAULT_TRAIN_SCHEDULE, normalizeTrainSchedule, isTrainingDayFor, buildTrainSchedule, type TrainScheduleType, type TrainSchedule } from "./planner-training-schedule"; // FIX train-bind: плавающий график тренировок
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
import type { LabCompositeResult } from "../../../../engines/lab-analysis.engine";
import { buildDayPlan as buildDayPlanV2, type DayPlanV2, type MealPlanInput } from "./meal-plan-engine";
import { getYesterdaySummary, computeCompensation, computeRollingCompensation, type CompensationResult } from "./planner-diary-adaptation";
import { getMenstrualPhaseNutrition, getCalciumTarget, calciumDoseSplitNote, getFemaleSupplementRules, type MenstrualPhase, getLifeStageNote, type LifeStage, computeEnergyAvailability } from "./planner-female-cycle";
import { getBBCategory, type BBCategory, getPeakWeekDay, getCategoryDeficitMod, getCombinedDeficitMod } from "./planner-categories";
import {
  GOALS, PHASES, BUDGET_LEVELS, NUTRITION_LEVELS, PLAN_TYPES,
  ALLERGEN_LIST, HEALTH_ISSUES,
  type GoalId, type PhaseId, type BudgetLevel, type NutritionLevel,
  type PlanType, type CycleType,
  type DrugInjection, type MealPrepStep, type SavedPlan
} from "./types";
import { getProfileSafe, GlassCard, PillBtn, inputStyle, selectStyle, greenBtn, reportPillStyle } from "./ui";

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
  cravingMode: boolean; setCravingMode: (v: boolean) => void;
  cravingDays: number; setCravingDays: (v: number) => void;
  lazyDayMode: boolean; setLazyDayMode: (v: boolean) => void;
  lazyDayDays: number; setLazyDayDays: (v: number) => void;
  periodizationEnabled: boolean; setPeriodizationEnabled: (v: boolean) => void;
  trainType: string; setTrainType: (v: any) => void;
  trainIntensity: string; setTrainIntensity: (v: any) => void;
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
  dietPauseMode: string; setDietPauseMode: (v: any) => void;
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
  kbjuMode: string; setKbjuMode: (v: any) => void;
  switchKbjuMode: (mode: any) => void;
  manualKcal: number | null; setManualKcal: (v: any) => void;
  manualP: number | null; setManualP: (v: any) => void;
  manualF: number | null; setManualF: (v: any) => void;
  manualC: number | null; setManualC: (v: any) => void;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  budget: BudgetLevel; setBudget: (v: BudgetLevel) => void;
  nutrLevel: NutritionLevel; setNutrLevel: (v: NutritionLevel) => void;
  variety: string; setVariety: (v: any) => void;
  diaryAdaptation: boolean; setDiaryAdaptation: (v: boolean) => void;
  varietyStrictness: 'soft' | 'strict'; setVarietyStrictness: (v: 'soft' | 'strict') => void;
  wakeTime: string; setWakeTime: (v: string) => void;
  bedTime: string; setBedTime: (v: string) => void;
  lunchTime: string; setLunchTime: (v: string) => void;
  dinnerTime: string; setDinnerTime: (v: string) => void;
  mealsCount: number; setMealsCount: (v: number) => void;
  workFood: string; setWorkFood: (v: any) => void;
  allergens: string[]; setAllergens: (v: any) => void;
  healthIssues: string[]; setHealthIssues: (v: any) => void;
  eveningLowCarb: boolean; setEveningLowCarb: (v: boolean) => void;
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
  cyclingMode: CycleType; setCyclingMode: (v: CycleType) => void;
  heavyTrainDay: string; setHeavyTrainDay: (v: string) => void;
  workScheduleEnabled: boolean; setWorkScheduleEnabled: (v: boolean) => void;
  workStartTime: string; setWorkStartTime: (v: string) => void;
  workEndTime: string; setWorkEndTime: (v: string) => void;
  workDays: boolean[]; setWorkDays: (v: any) => void;
  workScheduleType: string; setWorkScheduleType: (v: string) => void;
  trainingDays: boolean[]; setTrainingDays: (v: any) => void;
  DAY_LABELS: string[];
  generated: boolean; setGenerated: (v: boolean) => void;
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
  moveFoodItem: (a: number, b: number, c: number) => void;
  findSimilarFoods: (item: any, count?: number) => any[];
  replaceFoodItem: (a: number, b: number, c: number, d: any) => void;
  updateItemAmount: (a: number, b: number, c: number, d: number) => void;
  removeFoodItem: (a: number, b: number, c: number) => void;
  replaceMealWithRecipe: (recipe: Recipe, mealIdx: number, dayIdx?: number) => void;
  addFoodToMeal: (dayIdx: number, mealIdx: number, food: any) => void;
  generatePlan: (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean }) => void;
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
  generateFullNutritionReport: () => void;
  renderMealList: (dayData: any, editable?: boolean, dayIdx?: number) => React.ReactNode;
  cyclePhase: string; setCyclePhase: (v: any) => void;
  bbCategory: BBCategory; setBBCategory: (v: any) => void;
  peakWeekEnabled: boolean; setPeakWeekEnabled: (v: boolean) => void;
  peakWeekShowDay: number; setPeakWeekShowDay: (v: number) => void;
  lifeStage: LifeStage; setLifeStage: (v: any) => void;
  hungerLevel: number; setHungerLevel: (v: number) => void;
  householdActivity: string; setHouseholdActivity: (v: any) => void;
  customNotes: string; setCustomNotes: (v: string) => void;
  // v2 scoring profile
  v2Phase: string; setV2Phase: (v: string) => void;
  v2Labs: Record<string, string>; setV2Labs: (v: any) => void;
  v2Pharma: Record<string, boolean>; setV2Pharma: (v: any) => void;
  histamineSensitive: boolean; setHistamineSensitive: (v: boolean) => void;
  dietPrefs: string[]; setDietPrefs: (v: string[]) => void;
  errorMsg: string | null; setErrorMsg: (v: string | null) => void;
  // P0-2: useProEngine — всегда TRUE (мёртвый toggle удалён); защита от деградации — try/catch fallback на классический путь в generatePlan.
  // Cross-tab navigation: allows sub-tabs to switch to each other
  planTab: string; setPlanTab: (v: string) => void;
}

const _DEFAULT_CALC_TARGETS = { kcal: 2500, protein: 160, fats: 70, carbs: 300, bmr: 0, tdee: 0, adjustment: 0 };
const _DEFAULT_CTX: any = { calcTargets: _DEFAULT_CALC_TARGETS, profileTargets: _DEFAULT_CALC_TARGETS, effectiveKcal: 2500, effectiveP: 160, effectiveF: 70, effectiveC: 300, weight: 80, height: 180, age: 30, sex: 'male' as const };
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
  const [cravingMode, setCravingMode] = useState<boolean>(!!_pf.cravingMode);
  const [cravingDays, setCravingDays] = useState<number>(typeof _pf.cravingDays === 'number' ? _pf.cravingDays : 1);
  const [lazyDayMode, setLazyDayMode] = useState<boolean>(!!_pf.lazyDayMode);
  const [lazyDayDays, setLazyDayDays] = useState<number>(typeof _pf.lazyDayDays === 'number' ? _pf.lazyDayDays : 1);
  const [periodizationEnabled, setPeriodizationEnabled] = useState<boolean>(!!_pf.periodizationEnabled);
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
  const [peakWeekEnabled, setPeakWeekEnabled] = useState<boolean>(() => {
    try {
      const v = (s as any)?.goals?.peakWeek;
      if (typeof v === 'boolean') return v;
    } catch {}
    try { return localStorage.getItem('he_peak_week') === 'true'; } catch {}
    return false;
  });
  useEffect(() => { try { updateSection('goals', { peakWeek: peakWeekEnabled }); } catch {} }, [peakWeekEnabled]);
  const [peakWeekShowDay, setPeakWeekShowDay] = useState<number>(() => {
    try {
      const v = (s as any)?.goals?.peakShowDay;
      if (typeof v === 'string') {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d.getDay();
      }
    } catch {}
    try {
      const n = parseInt(localStorage.getItem('he_peak_show_day') || '6');
      return isNaN(n) ? 6 : Math.max(0, Math.min(6, n));
    } catch {}
    return 6;
  });
  useEffect(() => { try { updateSection('goals', { peakShowDay: new Date(Date.now() + peakWeekShowDay * 86400000).toISOString().slice(0, 10) }); } catch {} }, [peakWeekShowDay]);
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
  const [hungerLevel, setHungerLevel] = useState<number>(typeof _pf.hungerLevel === 'number' ? _pf.hungerLevel : 5);
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
    setWeightLogWeek(weightLogEntries.map(e => e.weight));
  }, [weightLogEntries]);
  const [metabolicAdaptEnabled, setMetabolicAdaptEnabled] = useState<boolean>(!!_pf.metabolicAdaptEnabled);
  const [metabolicAdaptPct, setMetabolicAdaptPct] = useState<number>(typeof _pf.metabolicAdaptPct === 'number' ? _pf.metabolicAdaptPct : 10);
  const [dietPauseMode, setDietPauseMode] = useState<'none' | 'refeed' | 'flex_80_20' | 'periodization_2_1' | 'diet_5_2'>((['none', 'refeed', 'flex_80_20', 'periodization_2_1', 'diet_5_2'] as const).includes(_pf.dietPauseMode as any) ? _pf.dietPauseMode : 'none');
  // P1-fix: manualGPerKg инициализируется из Profile (UnifiedSettings.nutrition.manualGPerKg) + legacy
  const [manualGPerKg, setManualGPerKg] = useState<Record<string, number>>(() => {
    try {
      const v = (s as any)?.nutrition?.manualGPerKg;
      if (v && typeof v === 'object') {
        return {
          protein: typeof v.protein === 'number' && !isNaN(v.protein) ? v.protein : 0,
          fat: typeof v.fat === 'number' && !isNaN(v.fat) ? v.fat : 0,
          carbs: typeof v.carbs === 'number' && !isNaN(v.carbs) ? v.carbs : 0,
        };
      }
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_manual_g_per_kg') || 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return {
          protein: typeof v.protein === 'number' && !isNaN(v.protein) ? v.protein : 0,
          fat: typeof v.fat === 'number' && !isNaN(v.fat) ? v.fat : 0,
          carbs: typeof v.carbs === 'number' && !isNaN(v.carbs) ? v.carbs : 0,
        };
      }
    } catch {}
    return { protein: 0, fat: 0, carbs: 0 };
  });
  const [monthPlanMode, setMonthPlanMode] = useState(() => { try { return localStorage.getItem("he_plan_month_mode") === "true"; } catch { return false; } });
  const [monthPlan, setMonthPlan] = useState<any[]>(() => { try { const v = JSON.parse(localStorage.getItem("he_plan_month") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [goal, setGoal] = useState<GoalId>((s?.primaryGoal as GoalId) || 'maintenance');
  const [phase, setPhase] = useState<PhaseId>((_pf.phase && (GOALS.some(g => g.id === _pf.phase) || PHASES.some(p => p.id === _pf.phase))) ? _pf.phase as PhaseId : 'course');
  const phaseToGoal: Record<PhaseId, GoalId> = { course: 'mass', bridge: 'maintenance', pct: 'maintenance', recovery: 'maintenance', cutting: 'cutting', maintenance: 'maintenance', recomp: 'recomposition', fat_loss: 'fat_loss', post_cut: 'post_cut' };
  const autoGoal = phaseToGoal[phase] || 'maintenance';
  const [goalUserSet, setGoalUserSet] = useState(false);
  useEffect(() => { if (!goalUserSet) setGoal(autoGoal); }, [phase, autoGoal, goalUserSet]);

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
  const injectDrugTypes = ['инсулин', 'ГР', 'ИФР-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', 'меланотан', 'семаглутид', 'тирзепатид', 'другое'];

  const calcTargets = useMemo(() => {
    try {
      return computePlannerTargets({
        weightKg: weight, heightCm: height, age, sex, goal, phase, bodyFatPct,
        workoutsPerWeek: s?.workoutsPerWeek || 3, avgWorkoutMinutes: s?.avgWorkoutMinutes || 60,
        dailySteps, householdActivity, trainType, trainIntensity, surplusPct,
        injections: injections.map(i => ({ type: i.type, dose: i.dose, esterType: i.esterType })),
        weightAdaptMode, weightLogWeek, expectedLossKgWeek,
        metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg: { protein: manualGPerKg.protein || 0, fat: manualGPerKg.fat || 0, carbs: manualGPerKg.carbs || 0 },
      });
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; }
  }, [weight, height, age, sex, goal, s?.workoutsPerWeek, s?.avgWorkoutMinutes, injections, phase, bodyFatPct, weightAdaptMode, weightLogWeek, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, dailySteps, householdActivity, trainType, trainIntensity]);

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

  // D-22: nutrition-level multiplier folded INTO effective* so the KБЖУ target shown and
  // the goal passed to the engine are the SAME number. Previously the engine built at
  // effectiveP*nutrMult while the UI displayed bare effectiveP -> at level 'Максимум' (1.5)
  // the plan read +50% / ~+100g protein over the displayed target.
  const [nutrLevel, setNutrLevel] = useState<NutritionLevel>((['base', 'medium', 'enhanced', 'max'] as const).includes(_pf.nutrLevel as any) ? _pf.nutrLevel : 'base');
  const _nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
  const effectiveKcal = Math.round((kbjuMode === 'profile' ? profileTargets.kcal : (manualKcal ?? calcTargets.kcal)) * _nutrMult);
  const effectiveP = Math.round((kbjuMode === 'profile' ? profileTargets.protein : (manualP ?? calcTargets.protein)) * _nutrMult);
  const effectiveF = Math.round((kbjuMode === 'profile' ? profileTargets.fats : (manualF ?? calcTargets.fats)) * _nutrMult);
  const _effectiveCRaw = kbjuMode === 'profile' ? profileTargets.carbs : (() => { if (manualC !== null) return manualC; if (manualKcal !== null && manualP !== null && manualF !== null && manualC === null) { const fromPF = (manualP * 4) + (manualF * 9); return Math.max(0, Math.round((manualKcal - fromPF) / 4)); } return calcTargets.carbs; })();
  const effectiveC = Math.round(_effectiveCRaw * _nutrMult);

  const switchKbjuMode = (mode: typeof kbjuMode) => { if (mode === 'manual' && kbjuMode !== 'manual') { setManualKcal(effectiveKcal); setManualP(effectiveP); setManualF(effectiveF); setManualC(effectiveC); } if (mode !== 'manual') { setManualKcal(null); setManualP(null); setManualF(null); setManualC(null); } setKbjuMode(mode); };

  const resultsRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState<BudgetLevel>((['low', 'medium', 'max', 'enhanced'] as const).includes(_pf.budget as any) ? _pf.budget : 'medium');
  const [variety, setVariety] = useState<'minimal' | 'medium' | 'max'>((['minimal', 'medium', 'max'] as const).includes(_pf.variety as any) ? _pf.variety : 'max');
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
  // P1-fix: mealsCount из Profile (UnifiedSettings.nutrition.mealsPerDay) + legacy
  const [mealsCount, setMealsCount] = useState<number>(() => {
    try {
      const v = (s as any)?.nutrition?.mealsPerDay;
      if (typeof v === 'number' && v >= 2 && v <= 8) return v;
    } catch {}
    return 4;
  });
  useEffect(() => { if (!wakeTime?.includes(':') || !bedTime?.includes(':')) return; const wMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]); const bMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]); const awakeHours = (bMin - wMin) / 60; if (awakeHours >= 16) setMealsCount(5); else if (awakeHours >= 14) setMealsCount(4); else setMealsCount(3); }, [wakeTime, bedTime]);

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

  const [planType, setPlanType] = useState<PlanType>((['classic', 'keto', 'highcarb', 'mediterranean', 'vegetarian'] as const).includes(_pf.planType as any) ? _pf.planType : 'classic');
  // FIX persist-settings: пишем все локальные предпочтения в he_planner_prefs (debounce не нужен —
  // пишем на каждое изменение, объём крошечный). Раньше эти настройки не сохранялись вообще.
  useEffect(() => {
    try {
      safeWriteJSON('he_planner_prefs', {
        cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, periodizationEnabled,
        trainType, trainIntensity, householdActivity, cyclePhase, hungerLevel,
        weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct,
        dietPauseMode, weightLogPeriod, phase, nutrLevel, budget, variety,
        lunchTime, dinnerTime, workFood, planType,
      });
    } catch {}
  }, [cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, periodizationEnabled, trainType, trainIntensity, householdActivity, cyclePhase, hungerLevel, weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, dietPauseMode, weightLogPeriod, phase, nutrLevel, budget, variety, lunchTime, dinnerTime, workFood, planType]);
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
  const [quickAddMealIdx, setQuickAddMealIdx] = useState<number | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [customNotes, setCustomNotes] = useState(() => {
    try { const v = (s as any)?.nutrition?.dietNotes; if (typeof v === 'string') return v; } catch {}
    try { return localStorage.getItem('he_nutrition_notes') || ''; } catch { return ''; }
  });
  // FIX save-buttons: заметки читались, но не сохранялись — терялись при перезагрузке
  useEffect(() => { try { safeWriteJSON('he_nutrition_notes', customNotes); } catch {} }, [customNotes]);
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
    try {
      const v = (s as any)?.nutrition?.foodIntolerances;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Intolerances;
    } catch {}
    try {
      const v = JSON.parse(localStorage.getItem('he_intolerances') || '{}');
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch {}
    return {};
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
  const [allergenExcludedCount, setAllergenExcludedCount] = useState(0);
  const [planTargets, setPlanTargets] = useState<{ kcal: number; protein: number; fats: number; carbs: number }>({ kcal: 2500, protein: 160, fats: 70, carbs: 300 });
  // Bug-1 fix: planTargets must mirror effective* so the full nutrition report
  // (generateFullNutritionReport uses `targets: planTargets`, `userTDEE: planTargets.kcal`)
  // compares against the REAL planner targets, not the hardcoded default 2500/160/70/300.
  useEffect(() => { setPlanTargets({ kcal: effectiveKcal, protein: effectiveP, fats: effectiveF, carbs: effectiveC }); }, [effectiveKcal, effectiveP, effectiveF, effectiveC]);
  const [cyclingMode, setCyclingMode] = useState<CycleType>('none');
  const [heavyTrainDay, setHeavyTrainDay] = useState('');
  const [workScheduleEnabled, setWorkScheduleEnabled] = useState(false);
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [workScheduleType, setWorkScheduleType] = useState('standard');
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
  const [generated, setGenerated] = useState(false);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(() => { try { const v = parseInt(localStorage.getItem("he_plan_days") || "1"); return (v === 3 || v === 7) ? v : 1; } catch { return 1; } });
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => { try { return parseInt(localStorage.getItem("he_plan_day_idx") || "0") || 0; } catch { return 0; } });
  const [planView, setPlanView] = useState<'list' | 'calendar'>(() => { try { return (localStorage.getItem("he_plan_view") === "calendar") ? "calendar" : "list"; } catch { return "list"; } });
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [threeDayPlan, setThreeDayPlan] = useState<any>(null);
  const [weekPlan, setWeekPlan] = useState<any>(null);
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
  useEffect(() => { try { localStorage.setItem('he_planner_labs', JSON.stringify(v2Labs)); } catch {} }, [v2Labs]);
  useEffect(() => { try { localStorage.setItem('he_planner_pharma', JSON.stringify(v2Pharma)); } catch {} }, [v2Pharma]);
  useEffect(() => { try { localStorage.setItem('he_planner_histamine', histamineSensitive ? 'true' : 'false'); } catch {} }, [histamineSensitive]);
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

  const calcItemTotals = (items: any[]) => ({ kcal: items.reduce((s: number, i: any) => s + (i.kcal || 0), 0), p: items.reduce((s: number, i: any) => s + (i.p || 0), 0), f: items.reduce((s: number, i: any) => s + (i.f || 0), 0), c: items.reduce((s: number, i: any) => s + (i.c || 0), 0), fiber: items.reduce((s: number, i: any) => s + (i.fiber || 0), 0) });
  const calcMealTotals = (meals: any[]) => ({ kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0), fiber: meals.reduce((s: number, m: any) => s + (m.totals?.fiber || 0), 0) });
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
    const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0) };
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

  const moveFoodItem = (fromMealIdx: number, toMealIdx: number, itemIdx: number) => {
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m: any) => ({ ...m, items: [...m.items], totals: { ...m.totals } }));
      const item = meals[fromMealIdx].items.splice(itemIdx, 1)[0];
      if (!item) return prev;
      meals[toMealIdx].items.push(item);
      meals.forEach((m: any, i: number) => { meals[i] = { ...m, totals: { kcal: m.items.reduce((s: number, it: any) => s + it.kcal, 0), p: m.items.reduce((s: number, it: any) => s + it.p, 0), f: m.items.reduce((s: number, it: any) => s + it.f, 0), c: m.items.reduce((s: number, it: any) => s + it.c, 0), fiber: m.items.reduce((s: number, it: any) => s + (it.fiber || 0), 0) } }; });
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0), fiber: meals.reduce((s: number, m: any) => s + (m.totals?.fiber || 0), 0) };
      return { ...prev, meals, totals };
    });
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

  // FIX button-audit: быстрый «+ Продукт» в любом дне плана (раньше всегда правил dayPlan)
  const addFoodToMeal = (dayIdx: number, mealIdx: number, food: any) => {
    if (!food || !food.name) return;
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]) return;
    saveUndo();
    const item = { name: food.name, id: food.id, amount: 100, kcal: food.kcal || 0, p: food.protein || 0, f: food.fat || 0, c: food.carbs || 0, fiber: food.fiber || 0 };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => [...items, item]);
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => [...items, item]);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => [...items, item]);
    }
  };

  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    if (!newFood || typeof newFood !== 'object' || !newFood.name) return; // FIX button-audit: guard
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    saveUndo();
    const old = dayData.meals[mealIdx].items[itemIdx]; const portion = (old.amount || 100) / 100;
    const replacement = { ...old, name: newFood.name, id: newFood.id, kcal: Math.round(newFood.kcal * portion), p: Math.round(newFood.protein * portion), f: Math.round(newFood.fat * portion), c: Math.round(newFood.carbs * portion), fiber: Math.round((newFood.fiber || 0) * portion), amount: Math.round(portion * (parseServingSizeGrams(newFood.servingSize) || 100)) };
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
    const amt = Math.max(1, newAmount);
    const ratio = amt / Math.max(1, it.amount || 1);
    const scaled = { ...it, amount: amt, kcal: Math.round((it.kcal || 0) * ratio), p: Math.round((it.p || 0) * ratio), f: Math.round((it.f || 0) * ratio), c: Math.round((it.c || 0) * ratio), fiber: Math.round((it.fiber || 0) * ratio) };
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

  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number, dayIdx = 0) => {
    saveUndo();
    // P0-fix: пропорциональное распределение КБЖУ по ингредиентам рецепта вместо хардкода 100г.
    // Каждый ингредиент получает долю kcal = recipe.kcal / N, а граммовка выводится из
    // энергетической плотности продукта (kcal/100g). Белок/жиры/угл берутся из FOOD_DB
    // и масштабируются к фактической граммовке, а не к 100г.
    const buildRecipeItems = () => {
      const n = Math.max(1, recipe.ingredients.length);
      const perItemKcal = recipe.kcal / n;
      return recipe.ingredients.map((ing) => {
        const lower = ing.toLowerCase();
        const food = FOOD_DB.find(f => lower.includes(f.name.toLowerCase()) || lower.includes(f.id));
        if (food) {
          // P0-fix: считаем граммовку из kcal-плотности: grams = perItemKcal / (food.kcal/100)
          const grams = food.kcal > 0 ? Math.round(perItemKcal / food.kcal * 100) : 100;
          const ratio = grams / 100;
          return {
            name: food.name,
            id: food.id,
            amount: grams,
            kcal: Math.round((food.kcal || 0) * ratio),
            p: Math.round((food.protein || 0) * ratio * 10) / 10,
            f: Math.round((food.fat || 0) * ratio * 10) / 10,
            c: Math.round((food.carbs || 0) * ratio * 10) / 10,
            fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
          };
        }
        // Fallback: ингредиент не найден в FOOD_DB — распределяем макросы равномерно
        const fallbackGrams = 100;
        return {
          name: ing,
          id: ing,
          amount: fallbackGrams,
          kcal: Math.round(perItemKcal),
          p: Math.round(recipe.protein / n * 10) / 10,
          f: Math.round(recipe.fat / n * 10) / 10,
          c: Math.round(recipe.carbs / n * 10) / 10,
        };
      });
    };
    if (dayIdx === 0) {
      const matchedItems = buildRecipeItems();
      setDayPlan((prev: any) => {
        if (!prev || !Array.isArray(prev.meals)) return prev;
        // P0-fix: bounds check на mealIdx — предотвращает молчаливую порчу данных
        if (mealIdx < 0 || mealIdx >= prev.meals.length) return prev;
        const meals = [...prev.meals];
        const totals = calcItemTotals(matchedItems);
        meals[mealIdx] = { ...meals[mealIdx], items: matchedItems, totals };
        return { ...prev, meals, totals: calcMealTotals(meals) };
      });
      // FIX button-audit: синхронизация правок обратно в недельный план
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        updateMultiDayPlan(weekPlan, weekEditDay, mealIdx, () => matchedItems);
      }
    } else {
      // FIX button-audit: недельные дни (dayIdx >= 7) идут в weekPlan, 1..3 — в threeDayPlan
      const resolved = _resolvePlanDay(dayIdx);
      if (!resolved) { setRecipePickerMeal(null); return; }
      if (resolved.plan === 'three') {
        updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, () => buildRecipeItems());
      } else if (resolved.plan === 'week') {
        updateMultiDayPlan(weekPlan, resolved.day, mealIdx, () => buildRecipeItems());
      }
    }
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
        if (s.nutrition.proteinPerKg) setManualGPerKg(s.nutrition.proteinPerKg);
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
      if (manualGPerKg) next.nutrition.proteinPerKg = manualGPerKg;
      next.nutrition.eveningLowCarb = eveningLowCarb;
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
   const generatePlan = (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean }) => {
     try {
     // P1-fix: опция skipUndo для массовой генерации (месяц) — иначе 5×saveUndo заполняет
     // undoStack (cap=5) и уничтожает историю отмен пользователя.
     if (!opts?.skipUndo) saveUndo();
     setPlanDays(days);
     if (dayIndex !== undefined) setSelectedDayIndex(dayIndex);
     setWeekEditDay(null); // FIX button-audit: новая генерация сбрасывает редактирование недели

     // ─── Pro Engine path (MPS-based, professional bodybuilding dietology) ───
     if (useProEngine) {
       try {
       const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
       const bfPct = bodyFatPct > 3 ? bodyFatPct : (sex === 'male' ? 15 : 22);
       const lbmKg = weight * (1 - bfPct / 100);
       const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
        const trainStartMin = linkToTraining && trainStart?.includes(':') ? toMin(trainStart) : undefined;
        const excludedIds = new Set<string>(excludedFoods || []);
        (healthIssues || []).forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
        getAutoExcludedFoodIds(FOOD_DB, healthIssues || []).forEach(fid => excludedIds.add(fid));
        // FIX allergens-restrictions: аллергены и dietPrefs-ограничения теперь исключаются
        // единым резолвером в ОБОИХ путях генерации (раньше pro-движок их игнорировал).
        for (const fid of resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || [])) excludedIds.add(fid);
        try { setAllergenExcludedCount(countExcludedByAllergens(FOOD_DB, allergens || [])); } catch {}
       const lockedIds = new Set<string>([...(lockedFoodIds || [])]);
       const recentFoodIds = new Set<string>();
       const collectFoods = (plan: any) => { if (plan?.meals) plan.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); })); if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); }))); };
       if (days >= 3 && dayPlan) collectFoods(dayPlan);
       if (days >= 7 && threeDayPlan) collectFoods(threeDayPlan);
       if ((dietPrefs || []).includes('vegetarian')) {
         Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => { if (tags.isVegetarian === false) excludedIds.add(fid); });
       }
       const dayIdx = days === 1 ? selectedDayIndex : 0;
        const isTrainingDay = isTrainDay(dayIdx);
      // Каждый вызов generatePlan → новый salt → разный набор продуктов
      const planRandomSalt = Math.floor(Math.random() * 1000000);

      // 🧪 Собираем lab values из v2Labs (строки → числа) для диетической коррекции
      const labValuesForPlan: Record<string, number> = {};
      Object.entries(v2Labs).forEach(([key, val]) => {
        const num = parseFloat(val as string);
        if (!isNaN(num) && num > 0) labValuesForPlan[key.toUpperCase()] = num;
      });

      // Адаптация по дневнику: компенсация вчерашнего отклонения для сегодняшнего дня.
      const baseGoalKcal = Math.max(1200, effectiveKcal || weight * 30 || 2500);
      const baseGoalP = Math.max(80, effectiveP || weight * 2 || 160);
      const baseGoalF = Math.max(30, effectiveF || weight * 0.8 || 70);
      const baseGoalC = Math.max(50, effectiveC || weight * 3.5 || 300);
      // #6 rolling 7-day компенсация (вчера 50% + старшие дни 25% от среднего; алкоголь-осведомлённая #15)
      const diaryComp: CompensationResult | null = diaryAdaptation
        ? computeRollingCompensation({ kcal: baseGoalKcal, p: baseGoalP, f: baseGoalF, c: baseGoalC }, 7)
        : null;
      // Smart 7-day variety: rolling window of food IDs from the last 2 built days.
      // recentFoodIds (existing) accumulates ALL prior days; hardWindow holds the last 2
      // for the stricter hard-exclusion (adjacent days don't repeat products).
      const hardWindow: string[][] = [];
      const collectDayFoods = (day: any): string[] => {
        const ids: string[] = [];
        if (day?.meals) day.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) ids.push(it.id); }));
        return ids;
      };

      const buildOneDay = (offset: number): any => {
        // Apply cycling mode adjustments per-day
        const isTrain = isTrainDay(offset);
        let dayKcalMod = 1.0, dayCarbMod = 1.0;
        // #13 Настоящий refeed: высоко-углеводный день (carb x2.5, fat x0.5, protein hold) для восстановления лептина/гликогена на сушке.
        // Назначается на определённый день недели (используем isTrain=false — refeed обычно в день отдыха от тяжёлой тренировки).
        let isRefeedDay = false;
        if (cyclingMode === 'cheatmeal') {
          isRefeedDay = (offset % 7 === 6) || (!isTrain && (offset % 7 === 0 || ![0, 1, 2, 3, 4, 5, 6].every(d => !isTrainDay(d))));
          if (isRefeedDay) { dayKcalMod = 1.15; dayCarbMod = 2.5; }
          else { dayKcalMod = 0.85; dayCarbMod = 0.5; }
        } else if (cyclingMode === 'macro') {
          if (isTrain) { dayKcalMod = 1.15; dayCarbMod = 1.3; }
          else { dayKcalMod = 0.85; dayCarbMod = 0.7; }
        } else if (cyclingMode === 'butch') {
          // Д-9: BUTCH aligned to training days (matches UI text "3 дня ВУ (тренировочные) + 1 день НУ (отдых)"
          // and the legacy buildDay path). High carb on training days, low carb on rest days — the previous
          // time-based cyclePos%4 could put a low-carb day on a training day, underfueling the session.
          if (isTrain) { dayKcalMod = 1.1; dayCarbMod = 1.4; }
          else { dayKcalMod = 0.85; dayCarbMod = 0.4; }
        } else if (dietPauseMode === 'flex_80_20') {
          // #6 80/20: лёгкий профицит (+5%) для adherence, без жёсткого cycling.
          dayKcalMod = 1.05; dayCarbMod = 1.0;
        } else if (dietPauseMode === 'periodization_2_1') {
          // #6 2 дня ВУ / 1 день НУ: 2 дня выше ккал+carb, 3-й день ниже.
          const _cycPos = offset % 3;
          if (_cycPos < 2) { dayKcalMod = 1.12; dayCarbMod = 1.25; } else { dayKcalMod = 0.85; dayCarbMod = 0.6; }
        } else if (dietPauseMode === 'diet_5_2') {
          // #6 5:2 — 5 дней дефицит, 2 дня maintenance (восстановление лептина).
          const _isMaint = (offset % 7 >= 5); // последние 2 дня недели — maintenance
          if (_isMaint) { dayKcalMod = 1.0; dayCarbMod = 1.0; } else { dayKcalMod = 0.8; dayCarbMod = 0.7; }
        }
        // #1 Женская фаза цикла: калорийно-углеводные моды + преферты (apply поверх cycling).
        const _mp = (sex === 'female') ? getMenstrualPhaseNutrition((cyclePhase as MenstrualPhase) || 'none') : null;
        if (_mp) { dayKcalMod *= _mp.kcalMod; dayCarbMod *= _mp.carbMod; }
        // #2 Кости/кальций для женщин: повышенный Ca при низком %жира/аменорее/менопаузе.
        const _caInfo = (sex === 'female') ? getCalciumTarget('female', bfPct, (cyclePhase as MenstrualPhase) || 'none', age) : null;
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
        // #4 Peak-week: корректировка углеводов/воды/натрия по дням до выступления.
        const _daysBefore = peakWeekEnabled ? (peakWeekShowDay - (offset % 7)) : -1;
        const _peakDay = (_daysBefore >= 0 && _daysBefore <= 6) ? getPeakWeekDay(_daysBefore) : null;
        if (_peakDay) { dayCarbMod *= _peakDay.carbMod; }
        const _peakNote: string | undefined = _peakDay ? _peakDay.note : undefined;
        // #10 Жизненные этапы / контрацепция.
        const _lifeStageNote: string | undefined = (sex === 'female') ? (getLifeStageNote(lifeStage) || undefined) : undefined;
        const _dietBreakNote: string | undefined = ((goal === 'cutting' || goal === 'fat_loss') && metabolicAdaptEnabled && metabolicAdaptPct > 0)
          ? '📉 Diet break рекомендован: метаболическая адаптация обнаружена. Перейдите на 2 недели maintenance (калорий поддержания) для восстановления лептина/гормонов и щитовидной. Белок 2.2 г/кг, углеводы восстановления, тренировки сохранить.'
          : undefined;
        const _sleepNote: string | undefined = (sleepHours < 7 || sleepQuality < 6)
          ? '😴 Сон слабый: добавьте tryptophan-источники (индейка, яйцо, творог, овсянка) + Mg glycinate на ночь. Тарт-вишня (мелатонин) перед сном. Избегать кофеин/алкоголя после 15:00.'
          : undefined;
        // #7 Anti-oscillation: если компенсация и cycling толкают в одну сторону —
        // демпфируем компенсацию (не стекаем +15% training-day с +200 недобора).
        const _diaryActive = (offset === dayIdx && diaryComp && diaryComp.applied);
        const _cycDir = dayKcalMod - 1; // >0 = up-day, <0 = down-day
        const _dampK = (_diaryActive && Math.sign(_cycDir) === Math.sign(diaryComp.delta.kcal)) ? (1 - Math.abs(_cycDir)) : 1;
        const _dampC = (_diaryActive && Math.sign(dayCarbMod - 1) === Math.sign(diaryComp.delta.c)) ? (1 - Math.abs(dayCarbMod - 1)) : 1;
        const input: MealPlanInput = {
          weightKg: weight, lbmKg, bodyFatPct: bfPct, sex,
          // D-22: nutrMult already folded into effective* above — do NOT multiply again.
          // D-22: nutrMult folded into effective* above. Адаптация по дневнику: компенсация
          // вчерашнего отклонения применяется только к «сегодня» (offset === dayIdx).
          goalKcal: Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
          goalProteinG: Math.round(Math.max(80, baseGoalP) * (hungerLevel >= 8 ? 1.1 : 1) + (_diaryActive ? diaryComp.delta.p : 0)),
          goalFatG: Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
          goalCarbsG: Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
          mealsCount, isTrainingDay: isTrainDay(offset),
          trainStartMin: linkToTraining && isTrainDay(offset) ? toMin(trainStart) : undefined,
          allowIntraWorkout: trainIntensity === 'high',
          trainDurationMin: (s?.avgWorkoutMinutes || 60),
          excludedIds: (() => { const s = new Set(excludedIds); if (_mp) _mp.avoidIds.forEach((id: string) => s.add(id)); return s; })(),
          allergenTags: (() => { const t = new Set<string>(); (allergens || []).forEach(a => (USER_ALLERGEN_TO_TAGS[a] || [a]).forEach(v => t.add(v))); dietRestrictionTags(dietPrefs || []).forEach(v => t.add(v)); return t; })(),
          preferredIds: (() => { const s = new Set(expandRecipePreferred(preferredFoods, [...getRecipes(), ...(userRecipes||[])], FOOD_DB)); if (_mp) _mp.priorityIds.forEach((id: string) => s.add(id)); if (hungerLevel >= 6) ['broccoli','cucumber','cabbage','zucchini','spinach','kale','green_bean','oats','lentils','cottage_cheese_5'].forEach((id: string) => s.add(id)); return s; })(),
          preferredByMeal: Object.fromEntries(Object.entries(preferredByMeal || {}).map(([k, v]) => [k, new Set(v as string[] || [])])),
          specificity, intolerances, tasteProfile,
          categoryPref: { preferred: [], excluded: excludedCategories },
          deprioritizedIds: getDeprioritizedIds(),
          lockedIds, recentFoodIds,
          hardRecentIds: new Set(hardWindow.flat()),
          varietyStrictness,
          diaryCompensation: (offset === dayIdx && diaryComp && diaryComp.applied) ? { kcalDelta: diaryComp.delta.kcal, pDelta: diaryComp.delta.p, fDelta: diaryComp.delta.f, cDelta: diaryComp.delta.c, note: diaryComp.note, severity: diaryComp.severity } : undefined,
          budget, isVegetarian: dietPrefs.includes('vegetarian'),
          isCutting: goal === 'cutting' || goal === 'fat_loss',
          dayOffset: offset, cyclePhase: phase as any,
          randomSalt: planRandomSalt,
          variety,
          wakeTime, lunchTime, dinnerTime, bedTime,
          planTypeMod: (() => { const pt = PLAN_TYPES.find(p => p.id === (dietPrefs.includes('vegetarian') ? 'vegetarian' : planType)); return { pMult: pt?.pMult || 1.0, fMult: pt?.fMult || 1.0, cMult: pt?.cMult || 1.0 }; })(),
          eveningLowCarb,
          labValues: Object.keys(labValuesForPlan).length > 0 ? labValuesForPlan : undefined,
          calciumTargetOverride: _caInfo ? _caInfo.target : undefined,
          sodiumTargetOverride: _peakDay ? Math.round((isTrain ? Math.max(3000, 3000 + weight * 5) : 2300) * _peakDay.sodiumMod) : undefined,
          menstrualPhaseNote: _mp ? _mp.note : undefined,
          carbGiPref: _mp ? _mp.carbGiPref : undefined,
        };
        // #1 RED-S / Energy Availability: критично для женщин-спортсменок (EA < 30 ккал/кг FFM).
        const _ea = computeEnergyAvailability(input.goalKcal, weight, lbmKg, !!input.isTrainingDay, input.trainDurationMin || 60, (trainIntensity as any) || 'medium', sex);
        // #2 Голод: высокий → белок/клетчатка/объхм; хронический → refeed.
        const _hungerNote: string | undefined = hungerLevel >= 8 ? '🔥 Высокий голод: +белок (сытость), добавлены объхмные овощи/клетчатка. Если хронически — refeed/повышение калорий.' : hungerLevel >= 6 ? '🔥 Повышенный голод: акцент на объхмную плотность.' : undefined;
        const _redSNote: string | undefined = _ea.note || undefined;
        const rawV2 = buildDayPlanV2(input);
        const v2: any = {
          ...rawV2,
          meals: Array.isArray(rawV2?.meals) ? rawV2.meals : [],
          totals: rawV2?.totals || { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 },
          diversity: rawV2?.diversity || { uniqueFoods: 0, categories: {} },
          mpsSummary: rawV2?.mpsSummary || { feedings: 0 },
          microSummary: rawV2?.microSummary || { coverage: [] },
        };
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
        // Преобразуем DayPlanV2 → совместимый формат старого dayPlan
        const meals = v2.meals.map((m: any) => ({
          label: m?.label || 'Приём пищи', time: m?.time || '', items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({
            name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c, fiber: it.fiber, leucine_mg: it.leucine_mg,
          })), totals: { kcal: m?.totals?.kcal || 0, p: m?.totals?.p || 0, f: m?.totals?.f || 0, c: m?.totals?.c || 0, fiber: m?.totals?.fiber || 0 },
          conflictWarnings: undefined, synergyNotes: undefined,
          rationale: m.rationale, mpsCheck: m.mpsCheck, target: m.target,
        }));
        const dayKcalForPct = Math.max(1, v2.totals.kcal);
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
        return {
          meals, totals: { kcal: v2.totals.kcal, p: v2.totals.p, f: v2.totals.f, c: v2.totals.c, fiber: v2.totals.fiber },
          isTrainingDay: v2.isTrainingDay,
          allergenWarnings: _allergenWarnings,
          supplementTimeline: buildSupplementTimeline(mealTimesPro, v2.isTrainingDay),
          waterTimeline: (() => { const wl = buildWaterTimeline(weight, mealTimesPro, v2.isTrainingDay, trainStart); if (_peakDay) return wl.map((w: any) => ({ ...w, ml: Math.round(w.ml * _peakDay.waterMod) })); return wl; })(),
          nutritionLogic: [],
          dietDiversity: { uniqueFoods: v2.diversity.uniqueFoods, totalPortions: 0, categories: v2.diversity.categories, score: Math.min(10, v2.diversity.uniqueFoods), note: `${v2.diversity.uniqueFoods} уникальных продуктов` },
          timingScores: [], intraWorkout: null, mpsSummary: v2.mpsSummary, proNotes: v2.notes,
          microSummary: v2.microSummary,
          diaryCompensation: (offset === dayIdx && diaryComp && diaryComp.applied) ? diaryComp : undefined,
          isRefeedDay,
          refeedNote: isRefeedDay ? '🔄 Refeed-день: углеводы ×2.5 (восстановление гликогена/лептина), жиры снижены, белок удержан. Психологическая разгрузка на сушке.' : undefined,
          menstrualPhaseNote: _mp ? _mp.note : undefined,
          boneNotes: _boneNotes.length > 0 ? _boneNotes : undefined,
          sleepNote: _sleepNote,
          dietBreakNote: _dietBreakNote,
          categoryNote: _categoryNote,
          peakWeekNote: _peakNote,
          lifeStageNote: _lifeStageNote,
          redSNote: _redSNote,
          energyAvailability: _ea,
          hungerNote: _hungerNote,
          healthScore: { score: _healthScore, status: _healthStatus, micro: _microAvg, fiber: _fiberScore, mps: _mpsScore, ea: _eaScore, diversity: _divScore, conflicts: _conflicts },
        };
      };

      const d1 = buildOneDay(dayIdx);
      let d2: any = null, d3: any = null, weekDays: any[] = [], weekData: any = null;
      setDayPlan(d1);
      if (days >= 3) {
        d2 = buildOneDay(1); d3 = buildOneDay(2);
        setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: (d1?.totals?.kcal || 0) + (d2?.totals?.kcal || 0) + (d3?.totals?.kcal || 0), p: (d1?.totals?.p || 0) + (d2?.totals?.p || 0) + (d3?.totals?.p || 0), f: (d1?.totals?.f || 0) + (d2?.totals?.f || 0) + (d3?.totals?.f || 0), c: (d1?.totals?.c || 0) + (d2?.totals?.c || 0) + (d3?.totals?.c || 0), fiber: (d1?.totals?.fiber||0) + (d2?.totals?.fiber||0) + (d3?.totals?.fiber||0) } });
      }
      if (days >= 7) {
        // FIX train-bind: месяц смещает offset на weekIndex*7 — плавающий график (eod/pattern)
        // продолжается через границу недель (раньше каждый месяц-week рестартовал паттерн,
        // давая две тренировки подряд на стыке недель).
        const _weekBase = weekIndex !== undefined ? weekIndex * 7 : 0;
        weekDays = Array.from({ length: 7 }, (_, i) => buildOneDay(_weekBase + i));
        weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + (d?.totals?.kcal || 0), 0), p: weekDays.reduce((s: any,d: any) => s + (d?.totals?.p || 0), 0), f: weekDays.reduce((s: any,d: any) => s + (d?.totals?.f || 0), 0), c: weekDays.reduce((s: any,d: any) => s + (d?.totals?.c || 0), 0) }};
        if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
        else setWeekPlan(weekData);
      }
      // Shopping list — use already-generated plan data (not regenerate!)
      const shoppingMap = new Map<string, any>();
      let allDayPlans: any[];
      if (days >= 7 && weekDays.length > 0) { allDayPlans = weekDays; }
      else if (days >= 3 && d2 && d3) { allDayPlans = [d1, d2, d3]; }
      else { allDayPlans = [d1]; }
      // #12 Batch-cook: считаем в скольких днях встречается продукт + готовка партиями.
      const BATCH_COOKABLE = new Set(['chicken_breast','chicken_thigh','turkey_breast','beef_lean','beef_minced','rice_white','rice_brown','buckwheat','quinoa','oats','lentils','chickpeas','beans','pasta_durum','bulgur','barley','millet','sweet_potato','potato_boiled','tofu','tempeh','whey_protein','whey_isolate','casein']);
      allDayPlans.forEach((dp: any, dayIdx: number) => { (dp.meals || []).forEach((m: any) => { (m.items || []).forEach((it: any) => {
        const ex = shoppingMap.get(it.id);
        if (ex) { ex.amount += it.amount || 0; ex.kcal += it.kcal || 0; ex.p += it.p || 0; ex.f += it.f || 0; ex.c += it.c || 0; ex.daySet.add(dayIdx); }
        else { const food = FOOD_DB.find(f => f.id === it.id); shoppingMap.set(it.id, { name: it.name, id: it.id, amount: it.amount || 100, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: food?.category || 'other', daySet: new Set([dayIdx]) }); }
      }); }); });
      const shoppingArr = Array.from(shoppingMap.values()).map((e: any) => {
        const dayCount = e.daySet ? e.daySet.size : 1;
        const batchCookable = BATCH_COOKABLE.has(e.id);
        const batchCook = batchCookable && dayCount >= 2 ? `Готовить сразу ${dayCount}-дневную партию (${Math.round(e.amount)}г)` : undefined;
        return { name: e.name, id: e.id, amount: e.amount, kcal: e.kcal, p: e.p, f: e.f, c: e.c, category: e.category, dayCount, batchCook };
      }).sort((a: any, b: any) => b.amount - a.amount);
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
       setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
       return; // Bug-2 fix: Pro успешно — НЕ проваливаемся в классический путь (иначе classic перетирал Pro-план, и юзер всегда видел классический результат).
      } catch (v2Err: any) {
        // Bug-2 fix: Pro упал — РЕАЛЬНЫЙ фоллбэк на классический движок (раньше был return = тупик без плана и ложное сообщение «переключитесь вручную»).
        const errMsg = (v2Err && (v2Err.message || String(v2Err))) || 'Unknown error';
        try { console.warn('[IndividualPlan] V2 engine failed, falling back to classic:', errMsg, v2Err); } catch {}
        try { setErrorMsg('Pro-движок не смог собрать план (возможно, слишком жёсткие исключения/фильтры). Собрано классическим движком — проверьте рацион.'); } catch {}
        try { setDayPlan(null); setThreeDayPlan(null); setWeekPlan(null); } catch {}
        // НЕ return — проваливаемся в классический путь ниже
      }
    }
    // P2-fix: nutrMult удалён (dead code) — multiplier уже включён в effectiveKcal/P/F/C
    const budgetFilter = (id: BudgetLevel): number[] => { const map: Record<string, number[]> = { low:[0,5],medium:[5,8],max:[8,10],enhanced:[9,15] }; return map[id] || [5,10]; };
    const [bMin, bMax] = budgetFilter(budget);
    const qualityRange = (pool: any[]) => pool.filter((f: any) => { const q = compositeQualityScore(f); return q >= bMin && q <= bMax; });
     const effectivePlanType = (dietPrefs || []).includes('vegetarian') ? ('vegetarian' as PlanType) : planType;
     const planTypeMod = PLAN_TYPES.find(p => p.id === effectivePlanType);
     const pMod = planTypeMod?.pMult || 1.0; const fMod = planTypeMod?.fMult || 1.0; const cMod = planTypeMod?.cMult || 1.0;
     const excludedIds = new Set(excludedFoods || []);
     (healthIssues || []).forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
     // P2-12: organ-load auto restrictions — динамические исключения по metabolic_flags
     getAutoExcludedFoodIds(FOOD_DB, healthIssues || []).forEach(fid => excludedIds.add(fid));
     // N2: vegetarian mode — exclude all non-vegetarian foods (meat, fish, poultry)
     if ((dietPrefs || []).includes('vegetarian')) {
      Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => {
        if (tags.isVegetarian === false) excludedIds.add(fid);
      });
    }
    // FIX allergens-restrictions: единый резолвер аллергенов и dietPrefs-ограничений
    // (раньше аллергены работали только здесь, в legacy, и только по тегам;
    // текстовый фолбэк был фактически мёртв, а pro-движок не знал о них вовсе).
    for (const fid of resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || [])) excludedIds.add(fid);
    try { setAllergenExcludedCount(countExcludedByAllergens(FOOD_DB, allergens || [])); } catch {}
    const allergenIds = new Set<string>();
    allergens.forEach(a => { (USER_ALLERGEN_TO_TAGS[a] || [a]).forEach(v => allergenIds.add(v)); });
    dietRestrictionTags(dietPrefs || []).forEach(v => allergenIds.add(v));
    const allergenLabel = (code: string): string => ALLERGEN_LIST.find(a => a.id === code)?.label || code;
    const preferredSet = new Set(preferredFoods);
    const qualitySort = (pool: any[], highFirst: boolean) => [...pool].sort((a, b) => highFirst ? ((b.bb_quality_score || 5) - (a.bb_quality_score || 5)) : ((a.bb_quality_score || 5) - (b.bb_quality_score || 5)));
    const limitPool = (pool: any[], seed: number) => {
      if (pool.length <= 8) return pool;
      const highQuality = budget === 'max' || budget === 'enhanced';
      const lowQuality = budget === 'low';
      let sorted = [...pool];
      if (highQuality) sorted = qualitySort(sorted, true);
      else if (lowQuality) sorted = qualitySort(sorted, false);
      else sorted = [...sorted].sort(() => Math.random() - 0.5);
      return sorted.slice(0, variety === 'minimal' ? 4 : variety === 'medium' ? 8 : 12);
    };
    // N1: track used food IDs across meals to avoid duplicates when budget=max
    const usedFoodIds = new Set<string>();
    const portableFilter = (pool: any[]) => { if (workFood !== 'portable') return pool; const nonPortableIds = new Set(['kfc_wings','kfc_soup','kfc_bucket','mcd_big_mac','mcd_royale','bk_whopper','vt_big_smoke','pizza_margherita','french_fries','soup_chicken','soup_borscht','soup_mushroom','porridge_oat','porridge_buckwheat','rice_white_cooked','pasta_durum','mayonnaise','ketchup','cream_sauce','bouillon_cube','soda','coca_cola','juice_apple','juice_orange','ice_cream','condensed_milk','cheese_processed','marmalade','cookie','chocolate']); return pool.filter(f => !nonPortableIds.has(f.id)); };
    const applyFoodPrefs = (pool: any[], prefType: string) => { const lower = prefType.toLowerCase(); if (pool.length <= 3) return pool; return portableFilter(pool).filter(f => !excludedIds.has(f.id) && [...allergenIds].every(a => !getFoodAllergenTags(f.id, FOOD_DB).includes(a) && !allergenTextMatches(a, f.name))); };
    const seedRand = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
    // ═══════════════════════════════════════════════════════════════════════
    // T1.1 — Smart breakfast templates by day type
    // ═══════════════════════════════════════════════════════════════════════
    const getBreakfastTemplate = (isTraining: boolean, isCutting: boolean, isVeg: boolean) => {
      const vegProts = ['supp_pea_protein','soy_isolate'];
      const fastProts = isVeg ? vegProts : ['whey_isolate','whey_concentrate','egg_white'];
      const slowCarbs = isVeg ? ['oats','buckwheat','quinoa'] : ['oats','buckwheat','quinoa','egg_whole'];
      const fastCarbs = isVeg ? ['rice_cakes','banana'] : ['rice_cakes','banana','bread_white'];
      const fatSources = isVeg ? ['avocado','chia_seeds','almonds','flaxseed_oil'] : ['egg_whole','avocado','chia_seeds','almonds','peanut_butter'];
      const berries = ['fruit_blueberry','fruit_strawberry','fruit_raspberry'];
      const greens = ['veg_spinach','veg_kale'];
      if (isCutting) return { name:'Омлет + зелень', pId:isVeg?'supp_pea_protein':'egg_white', carbId:'veg_spinach', fatId:'avocado', berryId:'fruit_blueberry', pG:0.5, cG:0.15, fG:0.3, note:'Сушка: белок + клетчатка + min углеводов' };
      if (isTraining) return { name:'Рисовый крем + протеин + ягоды', pId:fastProts[Math.floor(Math.random()*fastProts.length)], carbId:fastCarbs[Math.floor(Math.random()*fastCarbs.length)], fatId:fatSources[Math.floor(Math.random()*fatSources.length)], berryId:berries[Math.floor(Math.random()*berries.length)], pG:0.4, cG:0.7, fG:0.3, note:'Тренировочный день: быстрые углеводы + белок + омега-3' };
      return { name:'Овсянка + протеин + орехи', pId:fastProts[Math.floor(Math.random()*fastProts.length)], carbId:'oats', fatId:'almonds', berryId:berries[Math.floor(Math.random()*berries.length)], pG:0.4, cG:0.5, fG:0.5, note:'День отдыха: медленные углеводы + жиры для сытости' };
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T1.2 — Protein source rotation (4 sources across week)
    // ═══════════════════════════════════════════════════════════════════════
    const ROTATION_PLAN: Record<number, { label: string; ids: string[]; vegIds: string[] }> = {
      0: { label:'Птица', ids:['chicken_breast','turkey_breast','chicken_thighs','duck_breast'], vegIds:['tofu','tempeh'] },
      1: { label:'Красная рыба', ids:['salmon','trout','tuna','mackerel'], vegIds:['tofu','tempeh'] },
      2: { label:'Красное мясо', ids:['beef_steak','beef_minced','veal','lamb'], vegIds:['lentils','chickpeas'] },
      3: { label:'Белая рыба', ids:['cod','pollock','tilapia','pike_perch'], vegIds:['tofu','tempeh'] },
      4: { label:'Яйца/молочка', ids:['egg_whole','cottage_cheese_5','yogurt_greek'], vegIds:['tofu','soy_isolate'] },
      5: { label:'Смешанный', ids:['chicken_breast','salmon','egg_whole','turkey_breast'], vegIds:['tofu','lentils','tempeh','soy_isolate'] },
      6: { label:'Морепродукты', ids:['shrimp','mussels','squid'], vegIds:['tofu','tempeh'] },
    };
    const getProteinForDay = (dayOffset: number, isVeg: boolean): string[] => {
      const daySlot = Math.abs(dayOffset) % 7;
      const plan = ROTATION_PLAN[daySlot] || ROTATION_PLAN[5];
      return isVeg ? plan.vegIds : plan.ids;
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T1.3 — Fat timing matrix
    // ═══════════════════════════════════════════════════════════════════════
    const FAT_TIMING: Record<string, { pct: number; reason: string }> = {
      'Завтрак': { pct: 0.25, reason: 'Утро: желчный полон, липаза активна → жиры усваиваются' },
      'Второй завтрак': { pct: 0.15, reason: 'Умеренные жиры для сытости' },
      'Обед': { pct: 0.20, reason: 'Нейтральное время для жиров' },
      'Полдник': { pct: 0.10, reason: 'Лёгкий перекус — минимум жиров' },
      'Предтрен': { pct: 0.00, reason: 'Pre-workout: 0-5г жира — не замедляем gastric emptying' },
      'Пост-трен': { pct: 0.00, reason: 'Post-workout: 0-5г жира — не тормозим абсорбцию аминокислот' },
      'Ужин': { pct: 0.30, reason: 'Вечер: жиры + казеин = медленная абсорбция на ночь' },
      'Перекус': { pct: 0.00, reason: 'Лёгкий приём' },
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T2.1 — Vegetable rotation by color
    // ═══════════════════════════════════════════════════════════════════════
    const VEG_ROTATION: Record<number, { color: string; ids: string[]; benefit: string }> = {
      0: { color:'Зелёные', ids:['broccoli','veg_spinach','veg_asparagus','green_beans'], benefit:'Сульфорафан + хлорофилл → детокс печени' },
      1: { color:'Красные', ids:['tomato','red_pepper','beetroot'], benefit:'Ликопин + нитраты → простата + NO (пампинг)' },
      2: { color:'Оранжевые', ids:['carrot','pumpkin','sweet_potato'], benefit:'Бета-каротин → витамин A' },
      3: { color:'Белые', ids:['cauliflower','mushrooms','garlic'], benefit:'Бета-глюканы + аллицин → иммунитет' },
      4: { color:'Зелёные', ids:['broccoli','cucumber','zucchini','celery'], benefit:'Сульфорафан + хлорофилл → детокс печени' },
      5: { color:'Красные', ids:['tomato','red_cabbage','radish'], benefit:'Ликопин + антоцианы → антиоксиданты' },
      6: { color:'Смешанные', ids:['broccoli','tomato','carrot','cauliflower'], benefit:'Полный спектр фитонутриентов' },
    };
    // 🟡18 — Seasonal produce preferences
    const MONTH_SEASONAL: Record<number, string[]> = {
      0: ['broccoli','cauliflower','carrot','beetroot','cabbage','celery'], 1: ['broccoli','cauliflower','carrot','beetroot','cabbage'],
      2: ['spinach','asparagus','green_beans','radish','cucumber'], 3: ['spinach','asparagus','green_beans','strawberry','radish'],
      4: ['asparagus','spinach','strawberry','green_beans','cucumber','zucchini'], 5: ['tomato','cucumber','zucchini','strawberry','cherry','broccoli'],
      6: ['tomato','cucumber','zucchini','cherry','pepper','eggplant'], 7: ['tomato','cucumber','pepper','eggplant','watermelon','corn'],
      8: ['pumpkin','apple','mushrooms','beetroot','cabbage','carrot'], 9: ['pumpkin','apple','mushrooms','cabbage','beetroot','cauliflower'],
      10: ['cabbage','carrot','beetroot','celery','broccoli','cauliflower'], 11: ['cabbage','carrot','beetroot','broccoli','cauliflower','celery'],
    };
    const getVegForDay = (dayOffset: number): { ids: string[]; color: string; benefit: string } => {
      const slot = Math.abs(dayOffset) % 7;
      const veg = VEG_ROTATION[slot] || VEG_ROTATION[6];
      const month = new Date().getMonth();
      const seasonal = MONTH_SEASONAL[month] || [];
      const seasonalPriority = veg.ids.filter(id => seasonal.includes(id));
      const merged = [...new Set([...seasonalPriority, ...veg.ids])];
      return { ids: merged, color: veg.color, benefit: veg.benefit + (seasonalPriority.length > 0 ? ' (сезонное)' : '') };
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T2.2 — Pre-bed sleep protocol
    // ═══════════════════════════════════════════════════════════════════════
    const SLEEP_FOODS: Record<string, { id: string; dose: number; reason: string }> = {
      casein: { id:'casein', dose:30, reason:'Медленный белок → ночной анаболизм 6-8ч' },
      cottage: { id:'cottage_cheese_5', dose:200, reason:'Казеин + кальций → релаксация мышц' },
      pumpkin_seeds: { id:'pumpkin_seeds', dose:30, reason:'Магний 150мг + триптофан → GABA + мелатонин' },
      almonds: { id:'almonds', dose:20, reason:'Магний 50мг → релаксация нервной системы' },
      kiwi: { id:'kiwi', dose:100, reason:'Серотонин + антиоксиданты → качество сна +42%' },
      cherry: { id:'cherry', dose:100, reason:'Естественный мелатонин → засыпание −17 мин' },
      yogurt: { id:'yogurt_greek', dose:150, reason:'Казеин + пробиотики → ось кишечник-мозг' },
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T2.3 — Food synergy & antagonism matrix
    // ═══════════════════════════════════════════════════════════════════════
    const SYNERGY_CHECK: [RegExp, RegExp, string, string][] = [
      [/шпинат|spinach|щавель|chard/, /творог|сыр|молок|йогурт|кефир|calcium|молоч/, 'negative', 'Оксалаты + кальций → риск оксалатных камней'],
      [/чай|tea|кофе|coffee/, /желез|iron|гречк|говяд|печен|liver/, 'negative', 'Танины блокируют железо (−60% абсорбции)'],
      [/кальций|calcium|творог|сыр|молоч/, /цинк|zinc|тыквен|pumpkin_seed/, 'negative', 'Ca конкурирует с Zn за абсорбцию'],
      [/витамин C|vitamin c|лимон|апельсин|киви|перец|шиповник/, /желез|iron|гречк|шпинат|чечевиц/, 'positive', 'Витамин C ×2-3 абсорбцию железа'],
      [/куркум|turmeric|curcum/, /перец|pepper|piperine/, 'positive', 'Пиперин +2000% биодоступность куркумина'],
      [/жир|масл|авокадо|орех|семя|семеч|лосос|fat|oil|avocado|nut|seed|salmon/, /витамин D|vitamin d|витамин A|витамин K|морков|тыкв|шпинат/, 'positive', 'Жиры → транспорт витаминов ADEK'],
      [/чеснок|garlic/, /лук|onion/, 'positive', 'Аллицин + кверцетин → синергия NO + иммунитет'],
      [/зелёный чай|green tea/, /лимон|lemon/, 'positive', 'Катехины стабильны в кислой среде → +30% антиоксидантов'],
      [/фитат|phytate|цельнозер|отруб|bran/, /цинк|zinc|желез|iron|кальций|calcium/, 'negative', 'Фитаты связывают минералы → замачивать/ферментировать'],
      [/соев|soy|тофу|tempeh/, /йод|iodine|морск|seaweed/, 'negative', 'Соевые изофлавоны → конкуренция за йод щитовидной'],
    ];
    const checkFoodConflicts = (items: { name: string; id: string }[], label: string): { negative: string[]; positive: string[] } => {
      const neg: string[] = []; const pos: string[] = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = (items[i].name + ' ' + items[i].id).toLowerCase();
          const b = (items[j].name + ' ' + items[j].id).toLowerCase();
          for (const [rxA, rxB, type, msg] of SYNERGY_CHECK) {
            if (rxA.test(a) && rxB.test(b)) {
              if (type === 'negative') neg.push(`${items[i].name} + ${items[j].name} — ${msg}`);
              else pos.push(`✅ ${items[i].name} + ${items[j].name}: ${msg}`);
            }
          }
        }
      }
      return { negative: neg, positive: pos };
    };
    // ═══════════════════════════════════════════════════════════════════════
    // T3.1 — Micronutrient periodization by cycle phase
    // ═══════════════════════════════════════════════════════════════════════
    const PHASE_FOOD_BOOST: Record<string, { priorityIds: string[]; avoidIds: string[]; note: string }> = {
      course: { priorityIds:['broccoli','cauliflower','brussels_sprouts','garlic','beetroot','avocado','egg_whole','spinach','almonds'], avoidIds:['alcohol','sugar','grapefruit'], note:'Курс ААС: крестоцветные (гепатопротекция), свёкла (NO), яйца (холин), авокадо (глутатион)' },
      pct: { priorityIds:['egg_whole','oysters','pumpkin_seeds','red_meat','salmon','nuts_brazil','avocado','olive_oil'], avoidIds:['soy','flaxseed','mint'], note:'ПКТ: холестерин→тестостерон (яйца/мясо), цинк (устрицы/семечки), омега-3, селен' },
      cutting: { priorityIds:['chicken_breast','turkey_breast','cod','egg_white','broccoli','spinach','cucumber','berries','grapefruit'], avoidIds:['sugar','bread','pasta_durum','rice_white','potato_boiled','banana','dates'], note:'Сушка: белковая плотность, клетчатка, термогенные продукты' },
      bridge: { priorityIds:['salmon','avocado','olive_oil','almonds','egg_whole','broccoli','spinach'], avoidIds:['sugar','fast_food'], note:'Мост: омега-3, мононенасыщенные жиры, поддержка липидного профиля' },
      recovery: { priorityIds:['beef_steak','salmon','egg_whole','sweet_potato','spinach','berries','bone_broth','orange'], avoidIds:['alcohol','processed_food'], note:'Восстановление: цинк+железо (говядина), коллаген (костный бульон), витамин C' },
    };
    const phaseFoodBoost = PHASE_FOOD_BOOST[phase] || null;
    // 🟠12 — Lab-based food adjustments
    const labBoosts: string[] = []; const labAvoids: string[] = [];
    if (v2Labs.alt && parseFloat(v2Labs.alt) > 45) { labBoosts.push('broccoli','cauliflower','garlic','beetroot','avocado'); labAvoids.push('alcohol','sugar','grapefruit'); }
    if (v2Labs.ast && parseFloat(v2Labs.ast) > 40) { labBoosts.push('spinach','almonds','olive_oil'); }
    if (v2Labs.ldl && parseFloat(v2Labs.ldl) > 4.2) { labAvoids.push('butter','cheese_cream','sausage','bacon','fatty_meat'); labBoosts.push('salmon','avocado','olive_oil','oats'); }
    if (v2Labs.crp && parseFloat(v2Labs.crp) > 3) { labBoosts.push('salmon','berries','green_tea'); }
    if (v2Labs.creatinine && parseFloat(v2Labs.creatinine) > 110) { labAvoids.push('red_meat','salt','processed_food'); labBoosts.push('watermelon','cucumber','celery'); }
    const effectivePhaseBoost = phaseFoodBoost ? {
      priorityIds: [...new Set([...phaseFoodBoost.priorityIds, ...labBoosts])],
      avoidIds: [...new Set([...phaseFoodBoost.avoidIds, ...labAvoids])],
      note: phaseFoodBoost.note + (labBoosts.length > 0 ? ` | Лаб: ${labBoosts.slice(0,3).join(', ')}` : '')
    } : (labBoosts.length > 0 ? { priorityIds: labBoosts, avoidIds: labAvoids, note: `Лаб. коррекция: ${labBoosts.slice(0,4).join(', ')}` } : null);
    // ═══════════════════════════════════════════════════════════════════════
    // ── Nutrition logic builder — explains WHY each food was chosen ──
    const buildNutritionLogic = (dayOffset: number, isTraining: boolean, mealTimes: { time: string; label: string }[]) => {
      const isVeg = dietPrefs.includes('vegetarian');
      const logic: { label: string; rules: string[] }[] = [];
      const veg = getVegForDay(dayOffset);
      const prots = getProteinForDay(dayOffset, isVeg);
      const rot = ROTATION_PLAN[Math.abs(dayOffset) % 7];
      const bf = getBreakfastTemplate(isTraining, goal === 'cutting' || goal === 'fat_loss', isVeg);
      mealTimes.forEach(mt => {
        const rules: string[] = [];
        if (mt.label === 'Завтрак') {
          rules.push(`Шаблон: «${bf.name}» — ${bf.note}`);
        } else if (mt.label === 'Предтрен') {
          rules.push('Pre-workout: 0.3 г/кг белка + 0.6 г/кг быстрых углеводов');
          rules.push('Жиры исключены — не замедляем gastric emptying');
        } else if (mt.label === 'Пост-трен') {
          rules.push('Post-workout: 0.4 г/кг белка + 0.8 г/кг углеводов');
          rules.push('Жиры исключены — не тормозим абсорбцию аминокислот');
        } else if (mt.label === 'Ужин') {
          rules.push('Жиры 30% дневной нормы — медленная абсорбция');
        }
        if (!mt.label.includes('Предтрен') && !mt.label.includes('Пост-трен') && mt.label !== 'Завтрак') {
          rules.push(`Белковая ротация: день «${rot?.label || 'смешанный'}» — ${(prots||[]).slice(0,2).join(', ')}`);
        }
        rules.push(`Овощи: ${veg.color} группа — ${veg.benefit}`);
        const fatPct = FAT_TIMING[mt.label];
        if (fatPct) rules.push(`Жировой тайминг: ${Math.round(fatPct.pct * 100)}% дневных жиров — ${fatPct.reason}`);
        if (mt.label === 'Ужин' || mt.label === 'Перекус') {
          rules.push('Pre-bed протокол: казеин + Mg (тыквенные семечки) + мелатонин (киви/вишня)');
        }
        if (effectivePhaseBoost) rules.push(`Фаза «${phase}»: ${effectivePhaseBoost.note}`);
        logic.push({ label: mt.label, rules });
      });
      return logic;
    };
    const buildDiversityBreakdown = (allIds: string[]) => {
      const unique = new Set(allIds);
      const categories = new Map<string, number>();
      allIds.forEach(id => { const f = FOOD_DB.find(x => x.id === id); const cat = f?.category || 'other'; categories.set(cat, (categories.get(cat) || 0) + 1); });
      return { uniqueFoods: unique.size, totalPortions: allIds.length, categories: Object.fromEntries(categories), score: Math.min(10, Math.round(unique.size / Math.max(1, allIds.length) * 10 * 10) / 10), note: unique.size < 5 ? 'Низкое разнообразие — добавьте ротацию' : unique.size < 8 ? 'Среднее разнообразие' : 'Отличное разнообразие продуктов' };
    };
    const buildTimingScore = (meal: any) => {
      const label = meal.label || '';
      let score = 5;
      const p = meal.totals?.p || 0; const f = meal.totals?.f || 0; const c = meal.totals?.c || 0;
      if (label === 'Завтрак') { if (p >= 25 && c >= 30) score += 3; if (f >= 10) score += 1; if (c > 80) score -= 1; }
      else if (label === 'Предтрен') { if (p >= 20 && c >= 30 && f <= 5) score += 4; if (f > 10) score -= 3; }
      else if (label === 'Пост-трен') { if (p >= 30 && c >= 50 && f <= 5) score += 4; if (f > 10) score -= 3; }
      else if (label === 'Ужин') { if (p >= 30 && f >= 15) score += 3; if (c > 60) score -= 1; }
      else if (label === 'Обед') { if (p >= 25 && c >= 30 && f >= 10) score += 2; }
      else { if (p >= 15) score += 1; }
      const status = score >= 8 ? 'ideal' : score >= 5 ? 'good' : 'suboptimal';
      return { score: Math.min(10, score), status, note: status === 'ideal' ? '✅ Идеальный тайминг' : status === 'good' ? '👍 Хороший тайминг' : '⚠ Можно улучшить' };
    };
    const buildIntraWorkout = () => {
      const items: { name: string; id: string; amount: number; kcal: number; p: number; f: number; c: number }[] = [];
      // FIX allergens-restrictions: EAA/BCAA только если не исключены пользователем
      const eaa = ['supp_eaas', 'bcaa'].map(id => FOOD_DB.find(f => f.id === id)).find(f => f && !excludedIds.has(f.id)) || null;
      if (eaa) { items.push({name:eaa.name,id:eaa.id,amount:15,kcal:Math.round(eaa.kcal*0.15),p:Math.round(eaa.protein*0.15),f:Math.round(eaa.fat*0.15),c:Math.round(eaa.carbs*0.15)}); }
      items.push({name:'Cluster Dextrin (циклический декстрин)',id:'cyclic_dextrin',amount:40,kcal:160,p:0,f:0,c:40});
      return { label:'🏋️ Intra-workout', time: trainStart?.includes(':') ? (() => { const h = parseInt(trainStart.split(':')[0]); const m = parseInt(trainStart.split(':')[1]) + 30; return `${String(h + Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; })() : '16:30', items, totals: {kcal:items.reduce((s,i)=>s+i.kcal,0),p:items.reduce((s,i)=>s+i.p,0),f:items.reduce((s,i)=>s+i.f,0),c:items.reduce((s,i)=>s+i.c,0)}, note:'EAA 10-15г + циклический декстрин 30-60г/ч — снижает катаболизм, поддерживает гликоген' };
    };
    // Track all food IDs for diversity scoring
    const allDayFoodIds: string[] = [];
    const buildDay = (dayOffset: number, isTrainingDay: boolean) => {
      const mealTimes: { time: string; label: string; pct: number }[] = [];
      const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
      const wakeMin = toMin(wakeTime);
      const lunchMin = toMin(lunchTime);
      const dinnerMin = toMin(dinnerTime);
      const bedMin = toMin(bedTime);
      const trainMin = linkToTraining && isTrainingDay ? toMin(trainStart) : 0;

      // Work schedule: determine if work day + shift anchors
      let isWorkDay = false;
      let workStartMin = 0, workEndMin = 0;
      if (workScheduleEnabled) {
        const ws = workScheduleType;
        if (ws === 'standard') { isWorkDay = dayOffset < 5; }
        else if (ws === 'sliding' || ws === 'custom') { isWorkDay = workDays[dayOffset % 7]; }
        else if (ws === 'shift_day_night') {
          const cyclePos = dayOffset % 4;
          isWorkDay = cyclePos < 2;
        }
        else if (ws.startsWith('shift_')) {
          const parts = ws.split('_');
          const workLen = parseInt(parts[1]) || 1;
          const offLen = parseInt(parts[2]) || workLen;
          const cycleLen = workLen + offLen;
          const pos = ((dayOffset % cycleLen) + cycleLen) % cycleLen;
          isWorkDay = pos < workLen;
        }
        workStartMin = toMin(workStartTime);
        workEndMin = toMin(workEndTime);
      }
      const isNightShift = workScheduleEnabled && isWorkDay && (workEndMin < workStartMin);
      const effectiveWake = isNightShift ? Math.max(workStartMin - 300, 600) : wakeMin;
      const effectiveBed = isNightShift ? Math.min(workEndMin + 180, 600) : bedMin;
      const effectiveLunch = isWorkDay && workScheduleEnabled ? workStartMin + Math.round((workEndMin - workStartMin + (isNightShift ? 1440 : 0)) / 2) % 1440 : lunchMin;
      const effectiveDinner = isWorkDay && workScheduleEnabled ? (isNightShift ? workEndMin + 60 : Math.min(workEndMin + 30, 1380)) : dinnerMin;

      const effectiveMealsCount = lazyDayMode ? Math.min(3, mealsCount) : cookTimeMin < 30 ? Math.min(3, mealsCount) : cookTimeMin < 60 ? Math.min(4, mealsCount) : mealsCount;
      const mealDefs: { label: string; anchor?: number }[] = [];
      mealDefs.push({ label: 'Завтрак', anchor: effectiveWake + 30 });
      if (effectiveMealsCount >= 5) mealDefs.push({ label: 'Второй завтрак' });
      if (effectiveMealsCount >= 3) mealDefs.push({ label: 'Обед', anchor: Math.min(effectiveLunch, 1320) });
      if (effectiveMealsCount >= 4) mealDefs.push({ label: 'Полдник' });
      mealDefs.push({ label: 'Ужин', anchor: Math.min(effectiveDinner, 1380) });
      if (effectiveMealsCount >= 6) mealDefs.push({ label: 'Перекус' });
      const anchored = mealDefs.map((m, i) => {
        if (m.anchor) return { ...m, time: m.anchor, fixed: true };
        let leftAnchorIdx = i; let leftTime = effectiveWake; while (leftAnchorIdx >= 0 && !mealDefs[leftAnchorIdx].anchor) leftAnchorIdx--; if (leftAnchorIdx >= 0) leftTime = mealDefs[leftAnchorIdx].anchor!;
        let rightAnchorIdx = i; let rightTime = effectiveBed - 30; while (rightAnchorIdx < mealDefs.length && !mealDefs[rightAnchorIdx].anchor) rightAnchorIdx++; if (rightAnchorIdx < mealDefs.length) rightTime = mealDefs[rightAnchorIdx].anchor!;
        const totalSlots = rightAnchorIdx - leftAnchorIdx; const thisSlot = i - leftAnchorIdx; let interp = totalSlots > 0 ? thisSlot / totalSlots : 0.5;
        let t = Math.round(leftTime + (rightTime - leftTime) * interp);
        if (trainMin > 0 && t >= trainMin && t <= trainMin + 90) t = Math.max(leftTime + 15, trainMin - 45);
        return { ...m, time: t, fixed: false };
      });
      anchored.forEach((m, i) => { const mMin = Math.max(effectiveWake + 15, Math.min(effectiveBed - 15, m.time)); const hh = Math.floor(mMin / 60); const mm = mMin % 60; mealTimes.push({ time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`, label: m.label, pct: [0.2,0.2,0.3,0.15,0.1,0.05][i] || 0.15 }); });
      if (linkToTraining && isTrainingDay && trainStart?.includes(':')) { const trainH = parseInt(trainStart.split(':')[0]); const preTime = `${String(trainH-2).padStart(2,'0')}:00`; const postTime = `${String(trainH+1).padStart(2,'0')}:30`; const hasNearby = (t: string) => mealTimes.some(mt => { const mtMin = toMin(mt.time); const tMin = toMin(t); return Math.abs(mtMin - tMin) <= 45; }); if (!hasNearby(preTime)) mealTimes.push({ time: preTime, label: 'Предтрен', pct: 0.1 }); if (!hasNearby(postTime)) mealTimes.push({ time: postTime, label: 'Пост-трен', pct: 0.15 }); mealTimes.sort((a, b) => { const aMin = toMin(a.time); const bMin = toMin(b.time); return aMin - bMin; }); }
      // 🔴1 — Insulin synchronization: ensure meals at insulin injection times
      const insulinInjs = injections.filter(i => i.type === 'инсулин');
      insulinInjs.forEach(inj => {
        const injMin = toMin(inj.time || '08:00');
        const hasMealAtTime = mealTimes.some(mt => Math.abs(toMin(mt.time) - injMin) <= 15);
        if (!hasMealAtTime) {
          const hh = Math.floor(injMin / 60); const mm = injMin % 60;
          mealTimes.push({ time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`, label: `Приём (инсулин ${inj.name})`, pct: 0.1 });
          mealTimes.sort((a, b) => toMin(a.time) - toMin(b.time));
        }
      });
      const nMult = 1; // D-22: nutrMult already folded into effective*
      const tKcal = Math.round((effectiveKcal || weight * 30) * nMult);
      let tP = Math.round(Math.max(50, (effectiveP || weight * 2) * nMult * (pMod || 1)));
      const tF = Math.round(Math.max(20, (effectiveF || weight * 0.8) * nMult * (fMod || 1)));
      const tC = Math.round(Math.max(50, (effectiveC || weight * 3.5) * nMult * (cMod || 1)));
      let tKcalAdj = tKcal; let tCAdj = tC;
      if (cyclingMode === 'macro') { tKcalAdj = isTrainingDay ? tKcal : Math.round(tKcal * 0.85); tCAdj = isTrainingDay ? tC : Math.round(tC * 0.6); }
      if (cyclingMode === 'butch') { tKcalAdj = isTrainingDay ? Math.round(tKcal * 1.05) : Math.round(tKcal * 0.8); tCAdj = isTrainingDay ? Math.round(tC * 1.4) : Math.round(tC * 0.4); tP = isTrainingDay ? Math.round(tP * 0.95) : Math.round(tP * 1.05); }
      if (cyclingMode === 'cheatmeal' && !isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); }
      if (cyclingMode === 'carbload' && isTrainingDay) { tCAdj = Math.round(tC * 1.6); tKcalAdj = Math.round(tKcal * 1.1); }
      let mealCAdjust: Record<number, number> = {};
      {
        // Carb periodization (как в Pro-движке): ужин — самое лёгкое углеводное окно,
        // основная масса углеводов идёт в обед и peri-workout (pre/post). Без этого ужин
        // получает 1/N всех углеводов = «куча углеводов на ужине, не разделена на перекусы».
        const dinnerIdx = mealTimes.findIndex(m => m.label === 'Ужин');
        const lunchIdx = mealTimes.findIndex(m => m.label === 'Обед');
        if (dinnerIdx >= 0) {
          const share = tCAdj / mealTimes.length;
          const cutPct = eveningLowCarb ? 0.70 : 0.45; // ужин режем на 45% (или 70% при eveningLowCarb)
          const carbReduction = Math.round(share * cutPct);
          mealCAdjust[dinnerIdx] = -carbReduction;
          // Срезанные углеводы — в обед + pre/post-workout (если есть); иначе всё в обед
          const targets: number[] = [];
          if (lunchIdx >= 0) targets.push(lunchIdx);
          mealTimes.forEach((m, i) => { if (m.label === 'Предтрен' || m.label === 'Пост-трен') targets.push(i); });
          if (targets.length === 0) targets.push(dinnerIdx); // fallback: вернуть в ужин
          let remaining = carbReduction;
          targets.forEach((ti, k) => { const part = k === targets.length - 1 ? remaining : Math.round(carbReduction / targets.length); mealCAdjust[ti] = (mealCAdjust[ti] || 0) + part; remaining -= part; });
        }
      }
      const foodSeed = dayOffset * 10007;
      const meals = mealTimes.map((mt, idx) => {
        const fatPct = FAT_TIMING[mt.label]?.pct ?? (1 / mealTimes.length);
        const f = Math.round(tF * fatPct);
        const p = Math.round(tP / mealTimes.length);
        const c = Math.round(tCAdj / mealTimes.length) + (mealCAdjust[idx] || 0);
        const kcalAdj = Math.round((mealCAdjust[idx] || 0) * 4);
        const kcal = Math.round(tKcalAdj / mealTimes.length) + kcalAdj - Math.round(tF / mealTimes.length - f) * 9;
        const items: any[] = []; let remainingP = p; let remainingF = f; let remainingC = c;
        const sSeed = dayOffset * 10007 + idx * 997 + (isTrainingDay ? 3000 : 0) + (cyclingMode === 'butch' ? 5000 : 0);
        const isPreWorkout = mt.label === 'Предтрен'; const isPostWorkout = mt.label === 'Пост-трен'; const isPeriWorkout = isPreWorkout || isPostWorkout;
        const highQuality = budget === 'max' || budget === 'enhanced'; const lowQuality = budget === 'low';
        const effectiveTierFilter = lazyDayMode ? (f: any) => f.tier === 'basic' : (f: any) => f.tier === 'basic' || f.tier === 'mid' || f.tier === 'max';
        const fastCarbs = qualityRange(FOOD_DB.filter(f => f.gi && f.gi >= 80)); const slowCarbs = qualityRange(FOOD_DB.filter(f => f.category === 'carb' || f.category === 'grain')); const proteinFoods = qualityRange(FOOD_DB.filter(f => f.category === 'protein' && effectiveTierFilter(f))); const allProtein = applyFoodPrefs(proteinFoods, 'protein');         const topProtein = highQuality ? qualitySort(allProtein, true).slice(0, 12) : qualitySort(allProtein, true).slice(0, 8);
        // pickItem: selects foods to meet macro target. macroType: 'p'|'f'|'c' controls which macro is used for portion calc
        const SUPP_CAP: Record<string, number> = { creatine:10, whey_isolate:60, whey_protein:60, casein:60, bcaa:20, supp_eaas:20, glutamine:15, supp_hmb:6, supp_beta_alanine:6 };
        const pickItem = (foodPool: any[], targetG: number, macroType: 'p'|'f'|'c', seed: number, maxItems = 2): any[] => {
          const result: any[] = [];
          let pool = applyFoodPrefs(foodPool, 'any');
          if (pool.length === 0) return result;
          if (highQuality) pool = qualitySort(pool, true);
          else if (lowQuality) pool = qualitySort(pool, false);
          const preferPool = preferredSet.size > 0 ? pool.filter(f => preferredSet.has(f.id)) : [];
          let mainPool = preferPool.length > 0 ? preferPool : pool;
          if (lazyDayMode) mainPool = mainPool.filter(f => f.tier === 'basic');
          if (usedFoodIds.size > 0) { const unused = mainPool.filter(f => !usedFoodIds.has(f.id)); if (unused.length >= 3) mainPool = unused; }
          const lm = lazyDayMode ? 1 : maxItems;
          for (let i = 0; i < lm && targetG > 3; i++) {
            const getMacro = (f: any) => macroType === 'p' ? (f.protein||0) : macroType === 'f' ? (f.fat||0) : (f.carbs||0);
            const scored = mainPool.map(f => {
              const mv = getMacro(f);
              const ratio = mv > 0 ? targetG / mv : 999;
              const fitScore = ratio < 0.25 ? 0.3 : ratio > 3.0 ? 0.5 : 1.0;
              const detRand = ((Math.sin(seed + mainPool.indexOf(f) * 1337) * 10000) % 1 + 1) % 1;
              return { food: f, score: fitScore * (detRand * 0.4 + 0.6) };
            }).sort((a,b) => b.score - a.score);
            const food = scored[0]?.food;
            if (!food) break;
            mainPool = mainPool.filter(f => f.id !== food.id);
            usedFoodIds.add(food.id); allDayFoodIds.push(food.id);
            const macroPer100 = getMacro(food);
            if (!macroPer100 || macroPer100 <= 0) continue;
            const portion = Math.min(3.5, targetG / macroPer100);
            let amount = Math.round(portion * 100);
            const idCap = SUPP_CAP[food.id];
            if (idCap) amount = Math.min(idCap, amount);
            const r = portion;
            result.push({name:food.name,id:food.id,amount,kcal:Math.round(food.kcal*r),p:Math.round(food.protein*r),f:Math.round(food.fat*r),c:Math.round(food.carbs*r)});
            targetG -= macroPer100 * r;
          }
          return result;
        };
        if (isPreWorkout) {
          const isVeg = dietPrefs.includes('vegetarian');
          const preProts = isVeg ? ['supp_pea_protein','soy_isolate','egg_white','cottage_cheese_5'] : ['whey_isolate','whey_concentrate','egg_white','chicken_breast'];
          const preCarbsFiltered = FOOD_DB.filter(f => (f.gi||0) >= 70 && (f.category==='carb'||f.category==='grain'||f.category==='veg_fruit') && f.carbs>10);
          const preCarbs = preCarbsFiltered.length > 0 ? preCarbsFiltered.map(f=>f.id) : ['banana','rice_cakes'];
          const prePG = Math.max(20, Math.round(weight * 0.3));
          const preCG = Math.max(30, Math.round(weight * 0.6));
          const prePIdx = Math.abs(dayOffset * 7 + idx * 3) % preProts.length;
          const prePId = preProts[prePIdx];
          const preCIdx = Math.abs(dayOffset * 13 + idx * 7) % preCarbs.length;
          const preCId = preCarbs[preCIdx];
          const preP = FOOD_DB.find(f=>f.id===prePId);
          if (preP) {
            const ratio = Math.min(2.0, prePG / Math.max(1, preP.protein));
            let amt = Math.round(ratio * 100);
            const preCap = SUPP_CAP[prePId]; if (preCap) amt = Math.min(preCap, amt);
            items.push({name:preP.name,id:prePId,amount:amt,kcal:Math.round(preP.kcal*ratio),p:Math.round(preP.protein*ratio),f:Math.round(preP.fat*ratio),c:Math.round(preP.carbs*ratio)});
          }
          const preC = FOOD_DB.find(f=>f.id===preCId);
          if (preC) {
            const ratio = Math.min(2.5, preCG / Math.max(1, preC.carbs || 1));
            let amt = Math.round(ratio * 100);
            items.push({name:preC.name,id:preCId,amount:amt,kcal:Math.round(preC.kcal*ratio),p:Math.round(preC.protein*ratio),f:Math.round(preC.fat*ratio),c:Math.round(preC.carbs*ratio)});
          }
        } else if (isPostWorkout) {
          const isVeg = dietPrefs.includes('vegetarian');
          const postProts = isVeg ? ['supp_pea_protein','soy_isolate','egg_white'] : ['whey_isolate','whey_concentrate','chicken_breast','egg_whole','turkey_breast'];
          const postCarbsFiltered = FOOD_DB.filter(f => (f.gi||0) >= 75 && (f.category==='carb'||f.category==='grain'||f.category==='veg_fruit') && f.carbs>10);
          const postCarbs = postCarbsFiltered.length > 0 ? postCarbsFiltered.map(f=>f.id) : ['rice_white','potato_boiled','bread_white'];
          const postPG = Math.max(30, Math.round(weight * 0.4));
          const postCG = Math.max(40, Math.round(weight * 0.8));
          const ppIdx = Math.abs(dayOffset * 17 + idx * 11) % postProts.length;
          const ppId = postProts[ppIdx];
          const pcIdx = Math.abs(dayOffset * 19 + idx * 5) % postCarbs.length;
          const pcId = postCarbs[pcIdx];
          const pp = FOOD_DB.find(f=>f.id===ppId);
          if (pp) {
            const ratio = Math.min(2.5, postPG / Math.max(1, pp.protein));
            let amt = Math.round(ratio * 100);
            const ppCap = SUPP_CAP[ppId]; if (ppCap) amt = Math.min(ppCap, amt);
            items.push({name:pp.name,id:ppId,amount:amt,kcal:Math.round(pp.kcal*ratio),p:Math.round(pp.protein*ratio),f:Math.round(pp.fat*ratio),c:Math.round(pp.carbs*ratio)});
          }
          const pc = FOOD_DB.find(f=>f.id===pcId);
          if (pc) {
            const ratio = Math.min(3.0, postCG / Math.max(1, pc.carbs || 1));
            let amt = Math.round(ratio * 100);
            items.push({name:pc.name,id:pcId,amount:amt,kcal:Math.round(pc.kcal*ratio),p:Math.round(pc.protein*ratio),f:Math.round(pc.fat*ratio),c:Math.round(pc.carbs*ratio)});
          }
        } else {
          if (cravingMode && idx === 2) {
            const treatPool = ['chocolate','cookie','ice_cream','marmalade'];
            const treatId = treatPool[Math.floor(Math.random() * treatPool.length)];
            const treat = FOOD_DB.find(f => f.id === treatId);
            if (treat && !excludedIds.has(treat.id) && !allergenIds.has(treat.id)) {
              items.push({ name: treat.name, id: treat.id, amount: 30, kcal: Math.round(treat.kcal * 0.3), p: Math.round(treat.protein * 0.3), f: Math.round(treat.fat * 0.3), c: Math.round(treat.carbs * 0.3) });
              remainingC -= (treat.carbs || 0) * 0.3;
            }
          }
          // T1.1 — Smart breakfast template
          const isBreakfast = mt.label === 'Завтрак';
          const isDinner = mt.label === 'Ужин' || mt.label === 'Перекус';
          const isCutting = goal === 'cutting' || goal === 'fat_loss';
          const isVeg = dietPrefs.includes('vegetarian');
          if (isBreakfast) {
            // FIX allergens-restrictions: шаблон завтрака подменяет исключённые продукты
            // безопасными альтернативами (раньше egg_white/миндаль попадали в план при аллергии)
            const bf = getBreakfastTemplate(isTrainingDay, isCutting, isVeg);
            const _bfSafe = (id: string, fallbacks: string[]): string | null => {
              if (!excludedIds.has(id)) return id;
              const fb = fallbacks.find(x => !excludedIds.has(x));
              return fb || null;
            };
            const bfPId = _bfSafe(bf.pId, isVeg ? ['supp_pea_protein', 'soy_isolate', 'lentils'] : ['chicken_breast', 'turkey_breast', 'supp_pea_protein', 'egg_white']);
            const bfCId = _bfSafe(bf.carbId, ['oats', 'buckwheat', 'rice_white', 'potato_boiled', 'quinoa']);
            const bfFatId = _bfSafe(bf.fatId, ['olive_oil', 'avocado', 'sunflower_seeds', 'chia_seeds']);
            const bfBerryId = _bfSafe(bf.berryId, ['kiwi', 'apple', 'pear', 'blueberries']);
            const bfP = bfPId ? FOOD_DB.find(f => f.id === bfPId) : null;
            const bfC = bfCId ? FOOD_DB.find(f => f.id === bfCId) : null;
            const bfFat = bfFatId ? FOOD_DB.find(f => f.id === bfFatId) : null;
            const bfBerry = bfBerryId ? FOOD_DB.find(f => f.id === bfBerryId) : null;
            if (bfP && bfPId) { const r = Math.min(2.5, (weight * bf.pG) / Math.max(1, bfP.protein)); let amt = Math.round(r * 100); const bfPCap = SUPP_CAP[bfPId]; if (bfPCap) amt = Math.min(bfPCap, amt); items.push({name:bfP.name,id:bfPId,amount:amt,kcal:Math.round(bfP.kcal*r),p:Math.round(bfP.protein*r),f:Math.round(bfP.fat*r),c:Math.round(bfP.carbs*r)}); }
            if (bfC && bfCId) { const r = Math.min(2.5, (weight * bf.cG) / Math.max(1, bfC.carbs || 1)); const amt = Math.round(r * 100); items.push({name:bfC.name,id:bfCId,amount:amt,kcal:Math.round(bfC.kcal*r),p:Math.round(bfC.protein*r),f:Math.round(bfC.fat*r),c:Math.round(bfC.carbs*r)}); }
            if (bfFat && bfFatId) { const r = Math.min(2.0, (weight * bf.fG) / Math.max(1, bfFat.fat || 1)); const amt = Math.round(r * 100); items.push({name:bfFat.name,id:bfFatId,amount:amt,kcal:Math.round(bfFat.kcal*r),p:Math.round(bfFat.protein*r),f:Math.round(bfFat.fat*r),c:Math.round(bfFat.carbs*r)}); }
            if (bfBerry && bfBerryId) { items.push({name:bfBerry.name,id:bfBerryId,amount:80,kcal:Math.round(bfBerry.kcal*0.8),p:Math.round(bfBerry.protein*0.8),f:Math.round(bfBerry.fat*0.8),c:Math.round(bfBerry.carbs*0.8)}); }
            remainingP -= items.reduce((s:number,i:any)=>s+(i.p||0),0);
            remainingF -= items.reduce((s:number,i:any)=>s+(i.f||0),0);
            remainingC -= items.reduce((s:number,i:any)=>s+(i.c||0),0);
          } else {
            // T1.2 — Protein rotation: prioritize rotation sources
            const rotProts = getProteinForDay(dayOffset, isVeg);
            const rotProteinPool = proteinFoods.filter(f => rotProts.includes(f.id));
            const effectiveProteinPool = rotProteinPool.length >= 2 ? rotProteinPool : topProtein;
            // T3.1 — Phase-based food boosts
            if (effectivePhaseBoost) {
              const boosted = effectiveProteinPool.filter(f => effectivePhaseBoost.priorityIds.includes(f.id));
              if (boosted.length > 0) {
                const sorted = qualitySort(boosted, true);
                const protItems = pickItem(sorted, remainingP, 'p', sSeed, 2);
                protItems.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
              }
            }
            // Main protein: rotation-based
            if (remainingP > 10) {
              const protItems = pickItem(effectiveProteinPool.length >= 2 ? effectiveProteinPool : topProtein, remainingP, 'p', sSeed, 2);
              protItems.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
            }
            // Fat sources for dinner (T1.3 — evening fat emphasis)
            if (isDinner && remainingF > 8) {
              const fatPool = applyFoodPrefs(qualityRange(FOOD_DB.filter(f => f.category === 'fat' && f.fat > 10)), 'fat');
              if (fatPool.length > 0) {
                const fatItem = pickItem(fatPool, remainingF, 'f', sSeed + 77, 1);
                fatItem.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
              }
            }
          }
          const carbPool = applyFoodPrefs(slowCarbs, 'carb');
          if (carbPool.length > 0 && remainingC > 8 && !isBreakfast) {
            const carbItems = pickItem(carbPool, remainingC, 'c', sSeed + 1, 1);
            carbItems.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
          }
          // T2.1 — Vegetable color rotation
          const vegRot = getVegForDay(dayOffset);
          const vegRotPool = FOOD_DB.filter(f => f.category === 'veg_fruit' && vegRot.ids.some(vid => f.id === vid || f.id.includes(vid)));
          const effectiveVegPool = vegRotPool.length >= 2 ? vegRotPool : limitPool(applyFoodPrefs(qualityRange(FOOD_DB.filter(f => f.category === 'veg_fruit')), 'veg'), foodSeed + 4);
          if (effectiveVegPool.length > 0) {
            const vIdx = Math.floor(Math.random() * effectiveVegPool.length);
            const v = effectiveVegPool[vIdx % effectiveVegPool.length];
            const vegAmt = variety === 'max' ? 120 : variety === 'minimal' ? 60 : 80;
            usedFoodIds.add(v.id); allDayFoodIds.push(v.id);
            items.push({ name: v.name, id: v.id, amount: vegAmt, kcal: Math.round(v.kcal * vegAmt / 100), p: Math.round(v.protein * vegAmt / 100), f: Math.round(v.fat * vegAmt / 100), c: Math.round(v.carbs * vegAmt / 100) });
          }
          if (remainingP > 10 && !isBreakfast) {
            const extraPool = topProtein.filter((f: any) => !items.some((it: any) => it.id === f.id));
            if (extraPool.length > 0) {
              const extraP = pickItem(extraPool, remainingP, 'p', sSeed + 9, 1);
              extraP.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
            }
          }
          if (remainingC > 15 && carbPool.length > 0 && !isBreakfast && !items.some((it: any) => carbPool.some((cf: any) => cf.id === it.id))) {
            const extraPool = carbPool.filter((cf: any) => !items.some((it: any) => it.id === cf.id));
            if (extraPool.length > 0) {
              const extraC = pickItem(extraPool, remainingC, 'c', sSeed + 99, 1);
              extraC.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
            }
          }
        }
        // T2.3 — Food conflict check
        const conflicts = checkFoodConflicts(items, mt.label);
        const conflictWarnings = conflicts.negative;
        const synergyNotes = conflicts.positive;
        const tot = { kcal: items.reduce((s,i) => s + i.kcal, 0), p: items.reduce((s,i) => s + i.p, 0), f: items.reduce((s,i) => s + i.f, 0), c: items.reduce((s,i) => s + i.c, 0) };
        return { ...mt, items, totals: tot, idx, conflictWarnings: conflictWarnings.length > 0 ? conflictWarnings : undefined, synergyNotes: synergyNotes.length > 0 ? synergyNotes : undefined };
      });
      let totals = { kcal: meals.reduce((s,m) => s + m.totals.kcal, 0), p: meals.reduce((s,m) => s + m.totals.p, 0), f: meals.reduce((s,m) => s + m.totals.f, 0), c: meals.reduce((s,m) => s + m.totals.c, 0) };
      // KBJU correction: iterative per-macro refinement, tolerance ≤2%
      const tK = tKcalAdj || 1; const tP_ = tP || 1; const tF_ = tF || 1; const tC_ = tCAdj || 1;
      const TOL = 0.02;
      const addMacroTopUp = (macro: 'p' | 'f' | 'c', deficit: number) => {
        if (deficit <= 0 || meals.length === 0) return;
        const targetMeal = meals[meals.length - 1];
        const PROTEIN_TOPPERS = ['whey_isolate','chicken_breast','egg_whole','cottage_cheese_5','turkey_breast'];
        const FAT_TOPPERS = ['olive_oil','avocado','almonds','flaxseed_oil'];
        const CARB_TOPPERS = ['rice_white','buckwheat','pasta_durum','oats','potato_boiled'];
        const topperPool = macro === 'p' ? PROTEIN_TOPPERS : macro === 'f' ? FAT_TOPPERS : CARB_TOPPERS;
        const candidateId = topperPool[Math.floor(Math.random() * topperPool.length)];
        const food = FOOD_DB.find(f => f.id === candidateId);
        const SUPP_CAPS: Record<string, number> = { creatine:10, whey_isolate:60, whey_protein:60, casein:60, bcaa:20, supp_eaas:20, glutamine:15, supp_hmb:6, supp_beta_alanine:6 };
        const pickFood = (f: any): boolean => {
          if (!f) return false;
          const per100 = macro === 'p' ? (f.protein || 0) : macro === 'f' ? (f.fat || 0) : (f.carbs || 0);
          if (!per100) return false;
          const rawAmount = Math.min(macro === 'f' ? 25 : 120, Math.max(macro === 'f' ? 5 : 20, Math.round(deficit / per100 * 100)));
          const suppCap = SUPP_CAPS[f.id];
          const amount = suppCap ? Math.min(suppCap, rawAmount) : rawAmount;
          const r = amount / 100;
          targetMeal.items.push({ name: f.name, id: f.id, amount, kcal: Math.round((f.kcal || 0) * r), p: Math.round((f.protein || 0) * r), f: Math.round((f.fat || 0) * r), c: Math.round((f.carbs || 0) * r) });
          targetMeal.totals = { kcal: targetMeal.items.reduce((s: number, i: any) => s + i.kcal, 0), p: targetMeal.items.reduce((s: number, i: any) => s + i.p, 0), f: targetMeal.items.reduce((s: number, i: any) => s + i.f, 0), c: targetMeal.items.reduce((s: number, i: any) => s + i.c, 0) };
          return true;
        };
        if (pickFood(food)) return;
        const fallbackId = macro === 'p' ? 'whey_isolate' : macro === 'f' ? 'olive_oil' : 'rice_white';
        const fb = FOOD_DB.find(f => f.id === fallbackId);
        if (!pickFood(fb)) return;
      };
      for (let iter = 0; iter < 3; iter++) {
        const devK = Math.abs(totals.kcal - tK) / tK; const devP = Math.abs(totals.p - tP_) / tP_;
        const devF = Math.abs(totals.f - tF_) / tF_; const devC = Math.abs(totals.c - tC_) / tC_;
        if (devK <= TOL && devP <= TOL && devF <= TOL && devC <= TOL) break;
        if (iter === 0) {
          const scales = [tK / Math.max(1, totals.kcal), tP_ / Math.max(1, totals.p), tF_ / Math.max(1, totals.f), tC_ / Math.max(1, totals.c)];
          const effScale = Math.min(1.3, Math.max(0.7, scales.reduce((s, v) => s + v, 0) / scales.length));
          meals.forEach((m: any) => {
            m.items.forEach((it: any) => {
              const suppCap = ({ creatine:10, whey_isolate:60, whey_protein:60, casein:60, bcaa:20, supp_eaas:20, glutamine:15, supp_hmb:6, supp_beta_alanine:6 } as Record<string, number>)[it.id];
              let newAmount = Math.round(it.amount * effScale);
              if (suppCap) newAmount = Math.min(suppCap, newAmount);
              const ratio = newAmount / (it.amount || 1);
              it.amount = newAmount;
              it.kcal = Math.round(it.kcal * ratio);
              it.p = Math.round(it.p * ratio);
              it.f = Math.round(it.f * ratio);
              it.c = Math.round(it.c * ratio);
            });
            m.totals = { kcal: m.items.reduce((s: number, i: any) => s + i.kcal, 0), p: m.items.reduce((s: number, i: any) => s + i.p, 0), f: m.items.reduce((s: number, i: any) => s + i.f, 0), c: m.items.reduce((s: number, i: any) => s + i.c, 0) };
          });
          totals = { kcal: meals.reduce((s: number, m: any) => s + m.totals.kcal, 0), p: meals.reduce((s: number, m: any) => s + m.totals.p, 0), f: meals.reduce((s: number, m: any) => s + m.totals.f, 0), c: meals.reduce((s: number, m: any) => s + m.totals.c, 0) };
        }
        if (iter < 2) {
          const thresholds = { p: Math.max(3, tP_ * TOL), f: Math.max(3, tF_ * TOL), c: Math.max(5, tC_ * TOL) };
          const pDeficit = tP_ - totals.p; const fDeficit = tF_ - totals.f; const cDeficit = tC_ - totals.c;
          if (pDeficit > thresholds.p) addMacroTopUp('p', pDeficit);
          if (fDeficit > thresholds.f) addMacroTopUp('f', fDeficit);
          if (cDeficit > thresholds.c) addMacroTopUp('c', cDeficit);
          totals = { kcal: meals.reduce((s: number, m: any) => s + m.totals.kcal, 0), p: meals.reduce((s: number, m: any) => s + m.totals.p, 0), f: meals.reduce((s: number, m: any) => s + m.totals.f, 0), c: meals.reduce((s: number, m: any) => s + m.totals.c, 0) };
        }
      }
      // ── MPS optimization: ensure each meal triggers mTOR (>=25g protein, >=2.5g leucine) ──
      const mpsMinProtein = 25;
      const mpsMinLeucine = 2500;
      const mpsWheyId = dietPrefs.includes('vegetarian') ? 'supp_pea_protein' : 'whey_isolate';
      const mpsWhey = FOOD_DB.find(f => f.id === mpsWheyId);
      if (mpsWhey) {
        meals.forEach((m: any) => {
          const mealP = m.items.reduce((s: number, i: any) => s + (i.p || 0), 0);
          const mealLeu = m.items.reduce((s: number, i: any) => {
            const food = FOOD_DB.find(f => f.id === i.id);
            const leu100 = food?.amino_acid_profile_100g?.leucine_mg ?? food?.micros?.Leucine ?? (() => { const p = food?.protein || 0; const cat = food?.category || ''; if (cat==='dairy') return Math.round(p * 95); if (cat==='protein') { const n = (food?.name||'').toLowerCase(); if (n.includes('соя')||n.includes('тофу')||n.includes('чечевиц')||n.includes('горох')||n.includes('фасол')||n.includes('нут')) return Math.round(p * 68); return Math.round(p * 85); } return Math.round(p * 68); })();
            return s + Math.round(leu100 * (i.amount || 100) / 100);
          }, 0);
          if (mealP < mpsMinProtein || mealLeu < mpsMinLeucine) {
            const deficitP = Math.max(0, mpsMinProtein - mealP);
            const deficitLeu = Math.max(0, mpsMinLeucine - mealLeu);
            const needGrams = Math.max(
              Math.ceil(deficitP / (mpsWhey.protein || 25) * 100),
              Math.ceil(deficitLeu / ((mpsWhey.amino_acid_profile_100g?.leucine_mg || 3000) / 100) * 100)
            );
            const topUpGrams = Math.min(40, needGrams || 10);
            const r = topUpGrams / 100;
            m.items.push({
              name: mpsWhey.name, id: mpsWheyId, amount: topUpGrams,
              kcal: Math.round(mpsWhey.kcal * r), p: Math.round(mpsWhey.protein * r),
              f: Math.round(mpsWhey.fat * r), c: Math.round(mpsWhey.carbs * r)
            });
            m.totals = {
              kcal: m.items.reduce((s: number, i: any) => s + i.kcal, 0),
              p: m.items.reduce((s: number, i: any) => s + i.p, 0),
              f: m.items.reduce((s: number, i: any) => s + i.f, 0),
              c: m.items.reduce((s: number, i: any) => s + i.c, 0)
            };
          }
        });
        totals = {
          kcal: meals.reduce((s: number, m: any) => s + m.totals.kcal, 0),
          p: meals.reduce((s: number, m: any) => s + m.totals.p, 0),
          f: meals.reduce((s: number, m: any) => s + m.totals.f, 0),
          c: meals.reduce((s: number, m: any) => s + m.totals.c, 0)
        };
      }
      // ── Protein timing optimization: morning fast protein + casein pre-bed ──
      const fastProteinIds = ['whey_isolate','whey_concentrate','egg_white','egg_whole','chicken_breast','turkey_breast','supp_pea_protein','soy_isolate'];
      const caseinIds = ['casein','cottage_cheese_5','cottage_cheese_5_2','cottage_cheese_5_0','yogurt_greek'];
      const morningMeal = meals.find((m: any) => m.label === 'Завтрак');
      if (morningMeal) {
        const hasFastProtein = morningMeal.items.some((it: any) => fastProteinIds.includes(it.id));
        const morningP = morningMeal.items.reduce((s: number, i: any) => s + (i.p || 0), 0);
        if (!hasFastProtein || morningP < 25) {
          // FIX allergens-restrictions: whey не добавляется при аллергии на молочные/яйца —
          // ищем первый безопасный быстрый белок из цепочки
          const mpChain = dietPrefs.includes('vegetarian')
            ? ['supp_pea_protein', 'soy_isolate', 'whey_isolate', 'egg_white']
            : ['whey_isolate', 'egg_white', 'chicken_breast', 'supp_pea_protein'];
          const mpId = mpChain.find(id => !excludedIds.has(id)) || null;
          const mp = mpId ? FOOD_DB.find(f => f.id === mpId) : null;
          if (mp && mpId) {
            const needG = Math.max(10, 25 - Math.max(0, morningP));
            const r = Math.min(0.5, needG / Math.max(1, mp.protein));
            const amt = Math.round(r * 100);
            morningMeal.items.push({name:mp.name,id:mpId,amount:amt,kcal:Math.round(mp.kcal*r),p:Math.round(mp.protein*r),f:Math.round(mp.fat*r),c:Math.round(mp.carbs*r)});
            morningMeal.totals = {kcal:morningMeal.items.reduce((s:number,i:any)=>s+i.kcal,0),p:morningMeal.items.reduce((s:number,i:any)=>s+i.p,0),f:morningMeal.items.reduce((s:number,i:any)=>s+i.f,0),c:morningMeal.items.reduce((s:number,i:any)=>s+i.c,0)};
          }
        }
      }
      const lastMeal = meals[meals.length - 1];
      if (lastMeal && (lastMeal.label === 'Ужин' || lastMeal.label === 'Перекус')) {
        // T2.2 — Pre-bed sleep protocol: casein + Mg + melatonin foods
        const hasCasein = lastMeal.items.some((it: any) => caseinIds.includes(it.id));
        if (!hasCasein) {
          // FIX allergens-restrictions: казеин/творог только если не исключены
          // (раньше при аллергии на молочные всё равно добавлялся casein)
          const caseinChain = dietPrefs.includes('vegetarian')
            ? ['cottage_cheese_5', 'casein', 'yogurt_greek']
            : ['casein', 'cottage_cheese_5', 'yogurt_greek'];
          const caseinId = caseinChain.find(id => !excludedIds.has(id)) || null;
          const casein = caseinId ? FOOD_DB.find(f => f.id === caseinId) : null;
          if (casein && caseinId) {
            const caseinPG = Math.min(40, Math.round(weight * 0.4));
            const r = Math.min(2.0, caseinPG / Math.max(1, casein.protein));
            const amt = Math.round(r * 100);
            lastMeal.items.push({name:casein.name,id:caseinId,amount:amt,kcal:Math.round(casein.kcal*r),p:Math.round(casein.protein*r),f:Math.round(casein.fat*r),c:Math.round(casein.carbs*r)});
          }
        }
        // Add Mg-rich food for GABA/melatonin pathway
        const hasMg = lastMeal.items.some((it: any) => ['pumpkin_seeds','almonds','spinach'].includes(it.id));
        if (!hasMg) {
          // FIX allergens-restrictions: миндаль не добавляется при аллергии на орехи
          const mgFood = ['pumpkin_seeds', 'almonds', 'spinach'].map(id => FOOD_DB.find(f => f.id === id)).find(f => f && !excludedIds.has(f.id)) || null;
          if (mgFood) {
            lastMeal.items.push({name:mgFood.name,id:mgFood.id,amount:20,kcal:Math.round(mgFood.kcal*0.2),p:Math.round(mgFood.protein*0.2),f:Math.round(mgFood.fat*0.2),c:Math.round(mgFood.carbs*0.2)});
          }
        }
        // Add natural melatonin source (kiwi or cherry) if not already present
        const hasMelatonin = lastMeal.items.some((it: any) => ['kiwi','cherry','tart_cherry'].includes(it.id));
        if (!hasMelatonin) {
          const melFood = ['kiwi', 'cherry'].map(id => FOOD_DB.find(f => f.id === id)).find(f => f && !excludedIds.has(f.id)) || null;
          if (melFood) {
            lastMeal.items.push({name:melFood.name,id:melFood.id,amount:100,kcal:Math.round(melFood.kcal),p:Math.round(melFood.protein),f:Math.round(melFood.fat),c:Math.round(melFood.carbs)});
          }
        }
        lastMeal.totals = {kcal:lastMeal.items.reduce((s:number,i:any)=>s+i.kcal,0),p:lastMeal.items.reduce((s:number,i:any)=>s+i.p,0),f:lastMeal.items.reduce((s:number,i:any)=>s+i.f,0),c:lastMeal.items.reduce((s:number,i:any)=>s+i.c,0)};
        totals = {kcal:meals.reduce((s:number,m:any)=>s+m.totals.kcal,0),p:meals.reduce((s:number,m:any)=>s+m.totals.p,0),f:meals.reduce((s:number,m:any)=>s+m.totals.f,0),c:meals.reduce((s:number,m:any)=>s+m.totals.c,0)};
      }
      const allergenWarnings: { food: string; allergens: string[] }[] = [];
      meals.forEach(m => {
        m.items.forEach((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id);
          if (!food || excludedIds.has(food.id) || allergenIds.size === 0) return;
          const matched = allergens.filter(a => matchesSelectedAllergen(food, a, FOOD_DB));
          if (matched.length > 0) allergenWarnings.push({ food: it.name, allergens: matched.map(allergenLabel) });
        });
      });
      const uniqueAllergenWarnings = Array.from(
        new Map(allergenWarnings.map(w => [`${w.food}:${w.allergens.join('|')}`, w])).values()
      );
      return { meals, totals, isTrainingDay, isWorkDay, allergenWarnings: uniqueAllergenWarnings,
        supplementTimeline: buildSupplementTimeline(mealTimes, isTrainingDay),
        waterTimeline: buildWaterTimeline(weight, mealTimes, isTrainingDay, trainStart),
        nutritionLogic: buildNutritionLogic(dayOffset, isTrainingDay, mealTimes),
        dietDiversity: buildDiversityBreakdown(allDayFoodIds),
        timingScores: meals.map((m: any) => buildTimingScore(m)),
        intraWorkout: isTrainingDay ? buildIntraWorkout() : null,
      };
    };
    const dayIdx = days === 1 ? selectedDayIndex : 0;
    const d1 = buildDay(dayIdx, isTrainDay(dayIdx));
    // P1-fix: строим d2/d3 только при days>=3 (раньше строились всегда, тратя CPU
    // и загрязняя usedFoodIds для 1-дневного плана).
    const d2 = days >= 3 ? buildDay(1, isTrainDay(1)) : null;
    const d3 = days >= 3 ? buildDay(2, isTrainDay(2)) : null;
    setDayPlan(d1);
    if (days >= 3 && d2 && d3) setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: d1.totals.kcal + d2.totals.kcal + d3.totals.kcal, p: d1.totals.p + d2.totals.p + d3.totals.p, f: d1.totals.f + d2.totals.f + d3.totals.f, c: d1.totals.c + d2.totals.c + d3.totals.c } });
    let weekDays: any[] | null = null;
    if (days >= 7) {
      // FIX train-bind: смещение месяца (см. V2-путь) — плавающий график не рвётся на границе недель
      const _weekBase = weekIndex !== undefined ? weekIndex * 7 : 0;
      weekDays = Array.from({ length: 7 }, (_, i) => buildDay(_weekBase + i, isTrainDay(_weekBase + i)));
      if (periodizationEnabled) {
        const pWeek = weekIndex !== undefined ? weekIndex % 5 : 0;
        if (pWeek === 0 || pWeek === 4) {
          weekDays = weekDays.map((d: any) => ({ ...d, meals: (Array.isArray(d?.meals) ? d.meals : []).map((m: any) => ({ ...m, items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({ ...it, amount: Math.round((it.amount || 0) * 1.15), kcal: Math.round((it.kcal || 0) * 1.15), p: Math.round((it.p || 0) * 1.15), f: Math.round((it.f || 0) * 1.15), c: Math.round((it.c || 0) * 1.15) })) })), totals: { kcal: Math.round((d?.totals?.kcal || 0) * 1.15), p: Math.round((d?.totals?.p || 0) * 1.15), f: Math.round((d?.totals?.f || 0) * 1.15), c: Math.round((d?.totals?.c || 0) * 1.15) } }));
        } else if (pWeek === 2) {
          weekDays = weekDays.map((d: any) => ({ ...d, meals: (Array.isArray(d?.meals) ? d.meals : []).map((m: any) => ({ ...m, items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({ ...it, amount: Math.round((it.amount || 0) * 0.8), kcal: Math.round((it.kcal || 0) * 0.8), p: Math.round((it.p || 0) * 0.8), f: Math.round((it.f || 0) * 0.8), c: Math.round((it.c || 0) * 0.8) })) })), totals: { kcal: Math.round((d?.totals?.kcal || 0) * 0.8), p: Math.round((d?.totals?.p || 0) * 0.8), f: Math.round((d?.totals?.f || 0) * 0.8), c: Math.round((d?.totals?.c || 0) * 0.8) } }));
        }
      }
      const weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + (d?.totals?.kcal || 0), 0), p: weekDays.reduce((s: any,d: any) => s + (d?.totals?.p || 0), 0), f: weekDays.reduce((s: any,d: any) => s + (d?.totals?.f || 0), 0), c: weekDays.reduce((s: any,d: any) => s + (d?.totals?.c || 0), 0), fiber: weekDays.reduce((s: any,d: any) => s + (d?.totals?.fiber||0), 0) }};
      if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
      else setWeekPlan(weekData);
     }
     try { generateRecommendations(); } catch (e: any) { try { console.warn('[Planner] recommendations failed (classic):', e); } catch {} }
     const allDayPlans = days >= 7 ? weekDays! : days >= 3 ? [d1, d2, d3] : [d1];
    // T4.5 — Weekly diversity score
    const allWeekFoodIds: string[] = [];
    allDayPlans.forEach((dp: any) => { (dp.meals || []).forEach((m: any) => { (m.items || []).forEach((it: any) => { allWeekFoodIds.push(it.id); }); }); });
    const uniqueWeekFoods = new Set(allWeekFoodIds).size;
    const shoppingMap = new Map<string, { name: string; id: string; amount: number; kcal: number; p: number; f: number; c: number; category: string }>();
    allDayPlans.forEach((dp: any) => {
      (dp.meals || []).forEach((m: any) => {
        (m.items || []).forEach((it: any) => {
          const existing = shoppingMap.get(it.id);
          if (existing) { existing.amount += it.amount || 0; existing.kcal += it.kcal || 0; existing.p += it.p || 0; existing.f += it.f || 0; existing.c += it.c || 0; }
          else { const food = FOOD_DB.find(f => f.id === it.id); shoppingMap.set(it.id, { name: it.name, id: it.id, amount: it.amount || 100, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: food?.category || 'other' }); }
        });
      });
    });
    const shoppingArr = Array.from(shoppingMap.values()).sort((a, b) => b.amount - a.amount);
    (shoppingArr as any)._diversity = { uniqueFoods: uniqueWeekFoods, totalItems: allWeekFoodIds.length, score: Math.min(10, Math.round(uniqueWeekFoods / Math.max(1, allDayPlans.length) * 10) / 10), note: uniqueWeekFoods < 8 ? 'Низкое недельное разнообразие — увеличьте ротацию' : uniqueWeekFoods < 15 ? 'Среднее разнообразие' : 'Отличное недельное разнообразие' };
    setShoppingList(shoppingArr);
    const safeInjections = Array.isArray(injections) ? injections : [];
    const hasPharma = safeInjections.length > 0 || (courseEntries?.length || 0) > 0;
    const aasCount = safeInjections.filter(i => i.type === 'ААС').length; const insulinCount = safeInjections.filter(i => i.type === 'инсулин').length; const ghCount = safeInjections.filter(i => i.type === 'ГР').length;
    const pharmaHeavy = aasCount + insulinCount + ghCount; const pharmaBaseMl = hasPharma ? Math.min(45, 40 + pharmaHeavy * 1.5) : 30;
    const baseWaterMl = weight * pharmaBaseMl; const baseWater = baseWaterMl / 1000;
    const weeklyTrainMin = (s?.workoutsPerWeek || 0) * (s?.avgWorkoutMinutes || 60); const trainBonus = Math.round((weeklyTrainMin / 60) * 0.3 * 10) / 10;
    const fiberTarget = Math.round(effectiveC * 0.025); const fiberFactor = Math.round((fiberTarget / 10) * 0.1 * 10) / 10;
    const pharmaBonus = hasPharma ? Math.round((0.5 + aasCount * 0.15 + insulinCount * 0.3 + ghCount * 0.1) * 10) / 10 : 0;
    const waterTotal = Math.max(1.5, Math.round((baseWater + trainBonus + fiberFactor + pharmaBonus) * 10) / 10);
    // T3.2 — Electrolyte context: Na/K/Mg targets
    const isAAS = injections.some(i => i.type === 'ААС');
    const naTarget = isAAS ? 2500 : 3500;
    const kTarget = isAAS ? 5000 : 3500;
    const mgTarget = isAAS ? 500 : 400;
    const electrolytes = {
      sodiumMg: naTarget, potassiumMg: kTarget, magnesiumMg: mgTarget,
      note: isAAS ? 'Курс ААС: ↑K (бананы/картофель/шпинат), ↓Na (задержка), ↑Mg (сон/давление)'
        : injections.some(i => i.type === 'инсулин') ? 'Инсулин: контроль Na, ↑K для гликогена'
        : 'Стандарт: Na 3-5г, K 3.5г, Mg 400мг'
    };
    setWaterCalc({ baseWater: Math.round(baseWater * 10) / 10, pharmaBaseMl: Math.round(pharmaBaseMl), trainBonus, fiberFactor, pharmaBonus, total: waterTotal, hasPharma, electrolytes });
    setGenerated(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e: any) {
      const message = e?.message || String(e) || 'Ошибка генерации плана. Проверьте введённые данные.';
      console.error('[PlanGen] Error:', e);
      try { localStorage.setItem('he_planner_last_error', JSON.stringify({ message, at: new Date().toISOString() })); } catch {}
      setErrorMsg(message);
    }
  };

const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // P0-2: Pro Engine — единственный движок (был всегда true, переключатель в UI отсутствовал).
  // Сохраняем fallback на классический путь внутри generatePlan через try/catch для живучести.
  const useProEngine: true = true;
  const [planTab, setPlanTab] = useState<string>(() => { try { return localStorage.getItem('he_plan_active_tab') || 'settings'; } catch { return 'settings'; } });
  useEffect(() => { try { localStorage.setItem('he_plan_active_tab', planTab); } catch {} }, [planTab]);

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
  const _trainDaysArr = Array.from({ length: 7 }, (_, i) => isTrainDay(i));
  // FIX allergens-restrictions: спец-режимы уважают исключения пользователя
  const _smExcludedIds = [...resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || [])];
  const generateCheatMeal = () => { const _smDeps = { weight, effectiveKcal, effectiveP, effectiveF, effectiveC, goal, cravingDays, lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCheatMealPlan(generateCheatMealSm(_smDeps)); };

  const generateCarbload = () => { const _smDeps = { weight, effectiveKcal, effectiveP, effectiveF, effectiveC, goal, cravingDays, lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCarbloadPlan(generateCarbloadSm(_smDeps)); };

  const generateBUTCH = () => { const _smDeps = { weight, effectiveKcal, effectiveP, effectiveF, effectiveC, goal, cravingDays, lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setButchPlan(generateBUTCHSm(_smDeps)); };

  const generateCravingPlan = () => { const _smDeps = { weight, effectiveKcal, effectiveP, effectiveF, effectiveC, goal, cravingDays, lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setCravingPlan(generateCravingPlanSm(_smDeps)); };

  const generateLazyDayPlan = () => { const _smDeps = { weight, effectiveKcal, effectiveP, effectiveF, effectiveC, goal, cravingDays, lazyDayDays, trainingDays: _trainDaysArr, excludedIds: _smExcludedIds }; setLazyDayPlan(generateLazyDayPlanSm(_smDeps)); };

  const generateRecommendations = () => { setRecommendations(buildRecommendations({ goal, phase, weight, effectiveKcal, effectiveP, effectiveF, effectiveC, injections: Array.isArray(injections) ? injections : [], linkToTraining, trainStart, trainEnd, sex, bodyFatPct, trainType, v2Phase, v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {}, v2Labs: v2Labs && typeof v2Labs === 'object' ? v2Labs : {}, histamineSensitive, generated, planDays, dayPlan, threeDayPlan, weekPlan, dietPauseMode })); };

  useEffect(() => { if (generated && dayPlan) { try { generateRecommendations(); } catch (e: any) { try { console.warn('[Planner] recommendations useEffect failed:', e); } catch {} } } }, [Array.isArray(injections) ? injections.length : 0]);

  const saveCurrentPlan = () => {
    const name = prompt('Название плана:', `${new Date().toLocaleDateString('ru-RU')} · ${Math.round(dayPlan?.totals?.kcal || 0)} ккал`);
    if (name === null) return;
    const plan: SavedPlan = { id: Date.now(), date: new Date().toISOString().split('T')[0], name, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc };
    const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10);
    setSavedPlans(updated);
    // P1-fix: показываем ошибку пользователю при неудаче сохранения (раньше только console.warn)
    if (!safeWriteJSON('he_saved_nutrition_plans', updated)) {
      try { console.warn('[Planner] saved plans not saved (quota?)'); } catch {}
      setErrorMsg('⚠️ Не удалось сохранить план: превышен лимит localStorage. Удалите старые планы или отчёты.');
    } else {
      setErrorMsg(null);
    }
  };

  const autoCorrectPlan = () => {
    if (!dayPlan || !dayPlan.meals) return;
    // P1-fix: добавлен saveUndo — раньше автокоррекция была неотменяемой
    saveUndo();
    const remaining = {
      kcal: Math.max(0, effectiveKcal - (dayPlan.totals?.kcal || 0)),
      p: Math.max(0, effectiveP - (dayPlan.totals?.p || 0)),
      f: Math.max(0, effectiveF - (dayPlan.totals?.f || 0)),
      c: Math.max(0, effectiveC - (dayPlan.totals?.c || 0))
    };
    const futureMeals = dayPlan.meals.filter((m: any) => !m.label.includes('Завтрак') && !m.label.includes('Предтрен'));
    if (futureMeals.length === 0) return;
    const perMeal = {
      kcal: Math.round(remaining.kcal / futureMeals.length),
      p: Math.round(remaining.p / futureMeals.length),
      f: Math.round(remaining.f / futureMeals.length),
      c: Math.round(remaining.c / futureMeals.length)
    };
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m: any) => {
        if (m.label.includes('Завтрак') || m.label.includes('Предтрен')) return m;
        // P1-fix: per-macro ratios вместо единого ratio по kcal.
        // Раньше один ratio применялся ко всем макросам, что не работало при
        // смешанном дисбалансе (жир выше, углеводы ниже).
        const ratioP = Math.max(0.3, Math.min(1.7, perMeal.p / Math.max(1, m.totals?.p || 1)));
        const ratioF = Math.max(0.3, Math.min(1.7, perMeal.f / Math.max(1, m.totals?.f || 1)));
        const ratioC = Math.max(0.3, Math.min(1.7, perMeal.c / Math.max(1, m.totals?.c || 1)));
        const ratioK = Math.max(0.3, Math.min(1.7, perMeal.kcal / Math.max(1, m.totals?.kcal || 1)));
        const items = m.items.map((it: any) => {
          // Белковые продукты масштабируем по ratioP, жировые — по ratioF, углеводные — по ratioC
          const isProteinDom = (it.p || 0) >= (it.f || 0) && (it.p || 0) >= (it.c || 0);
          const isFatDom = (it.f || 0) > (it.p || 0) && (it.f || 0) > (it.c || 0);
          const ratio = isProteinDom ? ratioP : isFatDom ? ratioF : ratioC;
          return {
            ...it,
            amount: Math.round(it.amount * ratio),
            kcal: Math.round(it.kcal * ratioK),
            p: Math.round(it.p * ratioP * 10) / 10,
            f: Math.round(it.f * ratioF * 10) / 10,
            c: Math.round(it.c * ratioC * 10) / 10
          };
        });
        const totals = {
          kcal: items.reduce((s: number, i: any) => s + i.kcal, 0),
          p: items.reduce((s: number, i: any) => s + i.p, 0),
          f: items.reduce((s: number, i: any) => s + i.f, 0),
          c: items.reduce((s: number, i: any) => s + i.c, 0)
        };
        return { ...m, items, totals };
      });
      const totals = {
        kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0),
        p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0),
        f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0),
        c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0)
      };
      return { ...prev, meals, totals };
    });
  };

  const [mealPrepPlan, setMealPrepPlan] = useState<{ steps: MealPrepStep[]; totalTime: number; containers: number } | null>(null);
  const [mealPrepDays, setMealPrepDays] = useState<1 | 3 | 7>(1);

  const generateMealPrep = () => { const _r = buildMealPrep({ mealPrepDays, dayPlan, threeDayPlan, weekPlan }); if (!_r) { generatePlan(mealPrepDays as 1|3|7); return; } setMealPrepPlan(_r); };

  const [activeReports, setActiveReports] = useState<string[]>([]);
  const [allergenReport, setAllergenReport] = useState<any>(null);
  const [nutrientReport, setNutrientReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<any>(null);
  const [drugCompatReport, setDrugCompatReport] = useState<any>(null);
  const [nutritionReport, setNutritionReport] = useState<any>(null);

  const generateAllergenReport = () => { if (!dayPlan) return; setAllergenReport(generateAllergenReportPure(dayPlan, allergens, FOOD_DB)); setActiveReports(prev => prev.includes('allergen') ? prev : [...prev, 'allergen']); };
  const generateNutrientReport = () => { if (!dayPlan) return; setNutrientReport(generateNutrientReportPure(dayPlan, FOOD_DB)); setActiveReports(prev => prev.includes('nutrient') ? prev : [...prev, 'nutrient']); };
  const generateQualityReport = () => { if (!dayPlan) return; setQualityReport(generateQualityReportPure(dayPlan, budget, FOOD_DB)); setActiveReports(prev => prev.includes('quality') ? prev : [...prev, 'quality']); };
  const generateRiskReport = () => { if (!dayPlan) return; setRiskReport(generateRiskReportPure(dayPlan, weight)); setActiveReports(prev => prev.includes('risk') ? prev : [...prev, 'risk']); };
  const generateDrugCompatReport = () => { const safeInjections = Array.isArray(injections) ? injections : []; if (!dayPlan || safeInjections.length === 0) return; setDrugCompatReport(generateDrugCompatReportPure({ dayPlan, injections: safeInjections, weight, v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {}, phase, takenSupplements: Array.isArray(takenSupplements) ? takenSupplements : [] })); setActiveReports(prev => prev.includes('drug') ? prev : [...prev, 'drug']); };
  const generateFullNutritionReport = (planArg?: any, archve = true) => {
    const src = planArg || dayPlan; if (!src) return;
    try { const rep = generateNutritionReport({ meals: src.meals.map((m:any)=>({ label:m.label, items:m.items.map((i:any)=>({name:i.name||'',id:i.id||'',amount:i.amount||100,kcal:i.kcal||0,p:i.p||0,f:i.f||0,c:i.c||0,fiber:i.fiber||0})), totals:m.totals||{kcal:0,p:0,f:0,c:0}, time:m.time||'' })), totals: src.totals||{kcal:0,p:0,f:0,c:0}, targets: planTargets, userWeight: getProfileSafe()?.settings?.weight||80, userTDEE: planTargets.kcal, healthIssues, planType, variety, budget, allergens, cyclingMode, goal: getProfileSafe()?.settings?.primaryGoal||'maintenance', waterMl: waterCalc?.total?Math.round(waterCalc.total*1000):0, injections: injections.map(i=>({type:i.type,dose:i.dose,name:i.name,time:i.time})), workoutTime: linkToTraining&&_trainDaysArr.some(Boolean)?trainStart:undefined });
      if (rep) { setNutritionReport(rep); setActiveReports(prev=>prev.includes('nutrition')?prev:[...prev,'nutrition']);
        if (archve) { try { const arch = JSON.parse(localStorage.getItem('he_nutrition_report_archive')||'[]'); arch.unshift(rep); safeWriteJSON('he_nutrition_report_archive', arch.slice(0,50)); safeWriteJSON('he_nutrition_report_current', rep); try { safeWriteJSON('he_profile_nutrition_reports', arch.slice(0,20)); } catch {} } catch {} }
      }
    } catch(e) { try { console.error('Report failed:', e); } catch {} }
  };
  // D-26: auto-run drug-compat check when the plan changes (live food-drug warnings).
  useEffect(() => { try { generateDrugCompatReport(); } catch (e: any) { try { console.warn('[Planner] drug-compat report failed:', e); } catch {} } }, [dayPlan, injections, v2Pharma, phase, takenSupplements]);
  // D-25: auto-generate the report (without archiving) whenever the day plan changes,
  // so the dietology scorecard in the day card is live without opening the Отчёт tab.
  useEffect(() => { if (dayPlan) generateFullNutritionReport(dayPlan, false); }, [dayPlan]);

  // P1-7: renderMealList вынесен в MealListRender.tsx (267 строк → 1 строка)
  const ctx = useMemo<Omit<PlanCtx, 'renderMealList'>>(() => ({
    profile, s, courseEntries,
    weight, setWeight, height, setHeight, age, setAge, sex, setSex,
    dailySteps, setDailySteps, cookTimeMin, setCookTimeMin,
    cravingMode, setCravingMode, cravingDays, setCravingDays,
    lazyDayMode, setLazyDayMode, lazyDayDays, setLazyDayDays,
    periodizationEnabled, setPeriodizationEnabled,
    trainType, setTrainType, trainIntensity, setTrainIntensity,
    householdActivity, setHouseholdActivity,
    bodyFatPct, setBodyFatPct, sleepHours, setSleepHours,
    sleepQuality, setSleepQuality, stressLevel, setStressLevel,
    cyclePhase, setCyclePhase, hungerLevel, setHungerLevel,
    weightAdaptMode, setWeightAdaptMode, weightLogWeek, setWeightLogWeek,
    expectedLossKgWeek, setExpectedLossKgWeek,
    showWeightAdaptModal, setShowWeightAdaptModal,
    weightLogEntries, setWeightLogEntries,
    weightLogPeriod, setWeightLogPeriod,
    metabolicAdaptEnabled, setMetabolicAdaptEnabled, metabolicAdaptPct, setMetabolicAdaptPct,
    dietPauseMode, setDietPauseMode, manualGPerKg, setManualGPerKg,
    monthPlanMode, setMonthPlanMode, monthPlan, setMonthPlan, selectedWeek, setSelectedWeek,
    goal, setGoal, phase, setPhase, autoGoal,
    goalUserSet, setGoalUserSet,
    injections, setInjections,
    injName, setInjName, injTime, setInjTime, injDose, setInjDose,
    injUnit, setInjUnit, injType, setInjType, injEster, setInjEster,
    trainStart, setTrainStart, trainEnd, setTrainEnd, linkToTraining, setLinkToTraining,
    trainScheduleType, setTrainScheduleType, trainPattern, setTrainPattern, isTrainDay,
    injectDrugTypes, calcTargets, profileTargets,
    effectiveKcal, effectiveP, effectiveF, effectiveC,
    kbjuMode, setKbjuMode, switchKbjuMode,
    manualKcal, setManualKcal, manualP, setManualP, manualF, setManualF, manualC, setManualC,
    resultsRef, budget, setBudget, nutrLevel, setNutrLevel,
    variety, setVariety, diaryAdaptation, setDiaryAdaptation, varietyStrictness, setVarietyStrictness, bbCategory, setBBCategory, peakWeekEnabled, setPeakWeekEnabled, peakWeekShowDay, setPeakWeekShowDay, lifeStage, setLifeStage, wakeTime, setWakeTime, bedTime, setBedTime,
    lunchTime, setLunchTime, dinnerTime, setDinnerTime, mealsCount, setMealsCount,
    workFood, setWorkFood, allergens, setAllergens, healthIssues, setHealthIssues,
    eveningLowCarb, setEveningLowCarb, planType, setPlanType,
    preferredFoods, setPreferredFoods, preferredByMeal, setPreferredByMeal, specificity, setSpecificity, intolerances, setIntolerances, tasteProfile, setTasteProfile, excludedCategories, setExcludedCategories, excludedFoods, setExcludedFoods,
    allergenExcludedCount, setAllergenExcludedCount, planTargets, setPlanTargets,
    cyclingMode, setCyclingMode, heavyTrainDay, setHeavyTrainDay,
    workScheduleEnabled, setWorkScheduleEnabled,
    workStartTime, setWorkStartTime, workEndTime, setWorkEndTime,
    workDays, setWorkDays, workScheduleType, setWorkScheduleType,
    trainingDays, setTrainingDays, DAY_LABELS,
    generated, setGenerated, planDays, setPlanDays, selectedDayIndex, setSelectedDayIndex,
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
    updateItemAmount, removeFoodItem, replaceMealWithRecipe, generatePlan,
    weekEditDay, openWeekDayForEdit, switchPlanDays,
    addFoodToMeal, undoLast,
    toggleAllergen, toggleHealthIssue, loadSavedPlan,
    autofillFromProfile, saveToProfile,
    generateCheatMeal, generateCarbload, generateBUTCH,
    generateCravingPlan, generateLazyDayPlan,
    generateRecommendations, autoCorrectPlan, saveCurrentPlan,
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
    histamineSensitive, setHistamineSensitive,
    labAnalysis,
    errorMsg, setErrorMsg,
    useProEngine,
    planTab, setPlanTab,
    labs,
  }), [weight, height, age, sex, dailySteps, cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, periodizationEnabled, surplusPct, trainType, trainIntensity, householdActivity, bodyFatPct, sleepHours, sleepQuality, stressLevel, cyclePhase, hungerLevel, weightAdaptMode, weightLogWeek, expectedLossKgWeek, showWeightAdaptModal, weightLogEntries, weightLogPeriod, metabolicAdaptEnabled, metabolicAdaptPct, dietPauseMode, manualGPerKg, monthPlanMode, monthPlan, selectedWeek, goal, phase, goalUserSet, injections, injName, injTime, injDose, injUnit, injType, injEster, trainStart, trainEnd, linkToTraining, trainScheduleType, trainPattern, manualKcal, manualP, manualF, manualC, kbjuMode, budget, nutrLevel, variety, wakeTime, bedTime, lunchTime, dinnerTime, workFood, mealsCount, allergens, healthIssues, eveningLowCarb, planType, preferredFoods, quickAddMealIdx, quickAddSearch, customNotes, excludedFoods, dietPrefs, allergenExcludedCount, planTargets, cyclingMode, heavyTrainDay, workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType, trainingDays, generated, planDays, selectedDayIndex, planView, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc, savedPlans, lockedFoodIds, expandedSavedId, editItem, editAmount, replacingItem, recipePickerMeal, mealPrep, dayPlanNotes, draggedItem, dropTarget, undoStack, userRecipes, showRecipeCreator, showAddDrug, showDrugTypePicker, takenSupplements, showSuppPicker, suppSearch, newRecipe, v2Phase, v2Labs, v2Pharma, histamineSensitive, errorMsg, planTab, specialMealMode, specialMealGoal, specialMealProteinG, specialMealFatG, specialMealCarbsG, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget, cheatMealPlan, carbloadPlan, butchPlan, cravingPlan, lazyDayPlan, recommendations, mealPrepPlan, mealPrepDays, activeReports, allergenReport, nutrientReport, qualityReport, riskReport, drugCompatReport, nutritionReport, profile, s, courseEntries, labAnalysis, labs, autoGoal, injectDrugTypes, calcTargets, profileTargets, effectiveKcal, effectiveP, effectiveF, effectiveC, allergenExcludedCount]);

  const renderMealList = useRenderMealList(ctx);
  const finalCtx = useMemo<PlanCtx>(() => ({ ...ctx, renderMealList }), [ctx, renderMealList]);
  return <PlanContext.Provider value={finalCtx}>{children}</PlanContext.Provider>;
};
