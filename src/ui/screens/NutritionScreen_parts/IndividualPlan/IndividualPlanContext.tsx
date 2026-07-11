import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB, FOOD_ALLERGEN_DIET, compositeQualityScore } from "../../../../core/nutrition-database";
import { PHARMA_DB } from "../../../../core/pharma-database";
import { calcNutrition } from "../../../../engines/nutrition.engine";
import { calcNutritionV2 } from "../../../../engines/nutrition-v2.engine";
import { updateProfile } from "../../../../core/profile-manager";
import { getRecipesByMeal, type Recipe } from "../../../../engines/nutrition-periodization.engine";
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type MealScoreV2 } from "../../../../engines/product-usefulness-v2.engine";
import { scoreFoodsForKBJU, getMealKBJUTarget, getMealCurrentKBJU, parseServingSizeGrams } from "../../../../engines/kbju-food-match.engine";
import { generateNutritionReport, type NutritionReport } from "../../../../engines/nutrition-report.engine";
import type { UserProfile, LabPoint } from "../../../../core/types";
import { getContraindications, saveContraindications } from "../../../../core/contraindications";
import { getNutritionV2Data, saveNutritionV2Data } from "../../../../core/nutrition-v2-data";
import { ALL_SUBSTANCES } from "../../../../data/support-substances";
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
import type { LabCompositeResult } from "../../../../engines/lab-analysis.engine";
import { buildDayPlan as buildDayPlanV2, type DayPlanV2, type MealPlanInput } from "./meal-plan-engine";
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
  replaceMealWithRecipe: (recipe: Recipe, mealIdx: number) => void;
  generatePlan: (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number) => void;
  toggleAllergen: (id: string) => void;
  toggleHealthIssue: (id: string) => void;
  loadSavedPlan: (plan: SavedPlan) => void;
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
  renderMealList: (dayData: any, editable?: boolean) => React.ReactNode;
  cyclePhase: string; setCyclePhase: (v: any) => void;
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
  useProEngine: boolean; setUseProEngine: (v: boolean) => void;
}

const PlanContext = createContext<PlanCtx>(null as any);
export const usePlanCtx = () => useContext(PlanContext);

export const IndividualPlanProvider: React.FC<{ profile: UserProfile | null; course?: any[]; labs?: LabPoint[]; labAnalysis?: LabCompositeResult | null; children: React.ReactNode }> = ({ profile: _profile, course: _course, labs = [], labAnalysis, children }) => {
  const profile = _profile || getProfileSafe();
  const s = profile?.settings;
  const courseEntries = _course || [];

  const [weight, setWeight] = useState(s?.weight || 80);
  const [height, setHeight] = useState(s?.height || 180);
  const [age, setAge] = useState(s?.age || 30);
  const [sex, setSex] = useState<'male' | 'female'>(s?.sex || 'male');
  const [dailySteps, setDailySteps] = useState(s?.dailySteps || 8000);
  const [cookTimeMin, setCookTimeMin] = useState(60);
  const [cravingMode, setCravingMode] = useState(false);
  const [cravingDays, setCravingDays] = useState(1);
  const [lazyDayMode, setLazyDayMode] = useState(false);
  const [lazyDayDays, setLazyDayDays] = useState(1);
  const [periodizationEnabled, setPeriodizationEnabled] = useState(false);
  const [surplusPct, setSurplusPct] = useState(() => { try { const v = localStorage.getItem('he_surplus_pct'); return v ? parseInt(v) : 10; } catch { return 10; } });
  const [trainType, setTrainType] = useState<'strength' | 'cardio' | 'mixed' | 'hiit'>('strength');
  const [trainIntensity, setTrainIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [householdActivity, setHouseholdActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active'>('light');
  const [bodyFatPct, setBodyFatPct] = useState(profile?.settings?.bodyFat || 15);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(7);
  const [stressLevel, setStressLevel] = useState(5);
  const [cyclePhase, setCyclePhase] = useState<'none' | 'follicular' | 'ovulation' | 'luteal' | 'menstrual'>('none');
  const [hungerLevel, setHungerLevel] = useState(5);
  const [weightAdaptMode, setWeightAdaptMode] = useState(false);
  const [weightLogWeek, setWeightLogWeek] = useState<number[]>([80, 80, 80]);
  const [expectedLossKgWeek, setExpectedLossKgWeek] = useState(0.5);
  const [showWeightAdaptModal, setShowWeightAdaptModal] = useState(false);
  const [weightLogEntries, setWeightLogEntries] = useState<{ date: string; weight: number }[]>(() => {
    try { const savedEntries = JSON.parse(localStorage.getItem('he_weight_log_entries') || 'null'); if (savedEntries && Array.isArray(savedEntries) && savedEntries.length > 0) return savedEntries; } catch {}
    const e: { date: string; weight: number }[] = [];
    for (let i = 0; i < 3; i++) { const d = new Date(); d.setDate(d.getDate() - (2 - i)); e.push({ date: d.toISOString().split('T')[0], weight: 80 }); }
    return e;
  });
  const [weightLogPeriod, setWeightLogPeriod] = useState('every3');
  useEffect(() => {
    try { localStorage.setItem('he_weight_log_entries', JSON.stringify(weightLogEntries)); } catch {}
    setWeightLogWeek(weightLogEntries.map(e => e.weight));
  }, [weightLogEntries]);
  const [metabolicAdaptEnabled, setMetabolicAdaptEnabled] = useState(false);
  const [metabolicAdaptPct, setMetabolicAdaptPct] = useState(10);
  const [dietPauseMode, setDietPauseMode] = useState<'none' | 'refeed' | 'flex_80_20' | 'periodization_2_1' | 'diet_5_2'>('none');
  const [manualGPerKg, setManualGPerKg] = useState<Record<string, number>>({ protein: 0, fat: 0, carbs: 0 });
  const [monthPlanMode, setMonthPlanMode] = useState(() => { try { return localStorage.getItem("he_plan_month_mode") === "true"; } catch { return false; } });
  const [monthPlan, setMonthPlan] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem("he_plan_month") || "[]"); } catch { return []; } });
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [goal, setGoal] = useState<GoalId>((s?.primaryGoal as GoalId) || 'maintenance');
  const [phase, setPhase] = useState<PhaseId>('course');
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
  const [trainStart, setTrainStart] = useState('16:00');
  const [trainEnd, setTrainEnd] = useState('17:30');
  const [linkToTraining, setLinkToTraining] = useState(false);
  const injectDrugTypes = ['инсулин', 'ГР', 'ИФР-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', 'меланотан', 'семаглутид', 'тирзепатид', 'другое'];

  const calcTargets = useMemo(() => {
    try {
      const wpw = s?.workoutsPerWeek || 3; const awm = s?.avgWorkoutMinutes || 60;
      let pal = 1.2 + wpw * 0.075; if (awm > 60) pal += 0.1; if (awm > 90) pal += 0.05; if (wpw >= 6) pal += 0.05;
      if (dailySteps >= 15000) pal += 0.15; else if (dailySteps >= 10000) pal += 0.1; else if (dailySteps >= 7500) pal += 0.05;
      if (householdActivity === 'active') pal += 0.15; else if (householdActivity === 'moderate') pal += 0.1; else if (householdActivity === 'light') pal += 0.05;
      if (trainType === 'hiit') pal += 0.1; else if (trainType === 'cardio') pal += 0.05; else if (trainType === 'mixed') pal += 0.03;
      if (trainIntensity === 'high') pal += 0.1; else if (trainIntensity === 'medium') pal += 0.05;
      pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
      const goalMap: Record<string, string> = { mass:'bulk',strength:'strength',fat_loss:'cut',cutting:'cut',post_cut:'maintenance',maintenance:'maintenance',recomposition:'recomp',rehab:'rehab' };
      const engineGoal = goalMap[goal] || 'maintenance';
      let weightAdj = 1.0;
      if (weightAdaptMode && weightLogWeek.length >= 2) { const actualLoss = weightLogWeek[0] - weightLogWeek[weightLogWeek.length - 1]; const weeklyAvgLoss = actualLoss > 0 ? actualLoss / (weightLogWeek.length - 1) * 7 / Math.max(1, weightLogWeek.length - 1) : 0; if (expectedLossKgWeek > 0 && weeklyAvgLoss < expectedLossKgWeek * 0.7) weightAdj = 1 - (expectedLossKgWeek - Math.max(0, weeklyAvgLoss)) * 2 / Math.max(1, weight); else if (weeklyAvgLoss > expectedLossKgWeek * 1.3) weightAdj = 1 + (weeklyAvgLoss - expectedLossKgWeek) * 2 / Math.max(1, weight); weightAdj = Math.max(0.8, Math.min(1.2, weightAdj)); }
      const targetsV2 = (() => { try { return calcNutritionV2({ weightKg: weight, heightCm: height, age, sex: sex || 'male', pal: Math.min(1.9, Math.max(1.2, pal)), goal: engineGoal as any, bodyFatPercent: bodyFatPct, trainingDaysPerWeek: wpw, avgTrainingMinutes: awm }); } catch { return null; } })();
      const baseTdeeV2 = targetsV2?.baseTdee || 0; const adjV2 = targetsV2?.adjustment || 0;
      let targets: any = targetsV2 ? { bmr: baseTdeeV2 > 0 ? Math.round(baseTdeeV2 / (pal || 1.2)) : 0, tdee: baseTdeeV2 || Math.round(targetsV2.kcal - adjV2), kcal: targetsV2.kcal, protein: targetsV2.proteinG, fats: targetsV2.fatG, carbs: targetsV2.carbsG, adjustment: adjV2 } : (() => { try { const r = calcNutrition({ weightKg: weight, heightCm: height, age, sex, pal: Math.min(1.9, Math.max(1.2, pal)), goal: engineGoal }); return { bmr: r.bmr, tdee: r.tdee, kcal: r.kcal, protein: r.protein, fats: r.fats, carbs: r.carbs, adjustment: r.kcal - r.tdee }; } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; } })();
      if (engineGoal === 'bulk' && surplusPct !== 10) { targets.kcal = Math.round((targets.tdee || targets.kcal) * (1 + surplusPct / 100)); targets.carbs = Math.round((targets.kcal - targets.protein * 4 - targets.fats * 9) / 4); }
      const phaseMult: Record<string, { kcalMod: number; pAdd: number }> = { course:{kcalMod:1.0,pAdd:0.3},bridge:{kcalMod:0.95,pAdd:0},pct:{kcalMod:0.9,pAdd:0},recovery:{kcalMod:1.05,pAdd:0.3},cutting:{kcalMod:0.8,pAdd:0.2},maintenance:{kcalMod:1.0,pAdd:0},recomp:{kcalMod:0.9,pAdd:0.1},fat_loss:{kcalMod:0.75,pAdd:0.2},post_cut:{kcalMod:1.05,pAdd:0.1} };
      const pm = phaseMult[phase] || { kcalMod: 1.0, pAdd: 0 };
      targets.kcal = Math.round(targets.kcal * pm.kcalMod); targets.protein = Math.round(targets.protein + weight * pm.pAdd);
      if (pm.kcalMod !== 1.0 || pm.pAdd !== 0) { const pKcal = targets.protein * 4; const remaining = Math.max(0, targets.kcal - pKcal); if (targets.fats > 0 || targets.carbs > 0) { const fRatio = (targets.fats * 9) / Math.max(1, targets.fats * 9 + targets.carbs * 4); targets.fats = Math.round((remaining * fRatio) / 9); targets.carbs = Math.round((remaining * (1 - fRatio)) / 4); } else { targets.fats = Math.round((remaining * 0.25) / 9); targets.carbs = Math.round((remaining * 0.75) / 4); } }
      const hasAAS = injections.some(i => i.type === 'ААС'); const hasShortInsulin = injections.some(i => i.type === 'инсулин' && i.esterType !== 'long'); const hasInsulin = injections.some(i => i.type === 'инсулин'); const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');
      if (hasAAS) targets.protein = Math.round(targets.protein + weight * 0.3);
      if (hasShortInsulin) { const totalInsulinDose = injections.filter(i => i.type === 'инсулин' && i.esterType !== 'long').reduce((s, i) => s + i.dose, 0); const minInsulinCarbs = totalInsulinDose * 10; if (targets.carbs < minInsulinCarbs) targets.carbs = Math.round(minInsulinCarbs * 1.2); const maxFat = Math.round(weight * 0.5); if (targets.fats > maxFat) targets.fats = maxFat; targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4; }
      if (hasInsulin) { const maxFat = Math.round(weight * 0.5); if (targets.fats > maxFat) targets.fats = maxFat; targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4; }
      if (hasGLP) { targets.fats = Math.min(targets.fats, Math.round(weight * 0.4)); targets.protein = Math.round(targets.protein + weight * 0.2); targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4; }
      if (weightAdj !== 1.0) { targets.kcal = Math.round(targets.kcal * weightAdj); targets.protein = Math.round(targets.protein * weightAdj); targets.fats = Math.round(targets.fats * weightAdj); targets.carbs = Math.round(targets.carbs * weightAdj); }
      if (metabolicAdaptEnabled && metabolicAdaptPct > 0) { const adaptFactor = 1 - metabolicAdaptPct / 100; targets.kcal = Math.round(targets.kcal * adaptFactor); targets.protein = Math.round(targets.protein * adaptFactor); targets.fats = Math.round(targets.fats * adaptFactor); targets.carbs = Math.round(targets.carbs * adaptFactor); }
      if (manualGPerKg.protein > 0) targets.protein = Math.round(weight * manualGPerKg.protein);
      if (manualGPerKg.fat > 0) targets.fats = Math.round(weight * manualGPerKg.fat);
      if (manualGPerKg.carbs > 0) targets.carbs = Math.round(weight * manualGPerKg.carbs);
      if (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0) targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
      return targets;
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; }
  }, [weight, height, age, sex, goal, s?.workoutsPerWeek, s?.avgWorkoutMinutes, injections, phase, bodyFatPct, weightAdaptMode, weightLogWeek, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, dailySteps, householdActivity, trainType, trainIntensity]);

  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [manualP, setManualP] = useState<number | null>(null);
  const [manualF, setManualF] = useState<number | null>(null);
  const [manualC, setManualC] = useState<number | null>(null);
  const [kbjuMode, setKbjuMode] = useState<'auto' | 'manual' | 'profile'>('auto');

  const profileTargets = useMemo(() => {
    try {
      const wpw = s?.workoutsPerWeek || 3; const awm = s?.avgWorkoutMinutes || 60;
      let pal = 1.2 + wpw * 0.075; if (awm > 60) pal += 0.1; if (awm > 90) pal += 0.05; if (wpw >= 6) pal += 0.05;
      if (dailySteps >= 15000) pal += 0.15; else if (dailySteps >= 10000) pal += 0.1; else if (dailySteps >= 7500) pal += 0.05;
      if (householdActivity === 'active') pal += 0.15; else if (householdActivity === 'moderate') pal += 0.1; else if (householdActivity === 'light') pal += 0.05;
      if (trainType === 'hiit') pal += 0.1; else if (trainType === 'cardio') pal += 0.05; else if (trainType === 'mixed') pal += 0.03;
      if (trainIntensity === 'high') pal += 0.1; else if (trainIntensity === 'medium') pal += 0.05;
      pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
      const gm: Record<string, string> = { mass:'bulk',strength:'strength',fat_loss:'cut',cutting:'cut',post_cut:'maintenance',maintenance:'maintenance',recomposition:'recomp',rehab:'rehab' };
      return calcNutrition({ weightKg: s?.weight || weight, heightCm: s?.height || height, age: s?.age || age, sex: s?.sex || sex, pal, goal: gm[goal] || 'maintenance' });
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300 }; }
  }, [s?.weight, s?.height, s?.age, s?.sex, s?.workoutsPerWeek, s?.avgWorkoutMinutes, goal, dailySteps, householdActivity, trainType, trainIntensity]);

  const effectiveKcal = kbjuMode === 'profile' ? profileTargets.kcal : (manualKcal ?? calcTargets.kcal);
  const effectiveP = kbjuMode === 'profile' ? profileTargets.protein : (manualP ?? calcTargets.protein);
  const effectiveF = kbjuMode === 'profile' ? profileTargets.fats : (manualF ?? calcTargets.fats);
  const effectiveC = kbjuMode === 'profile' ? profileTargets.carbs : (() => { if (manualC !== null) return manualC; if (manualKcal !== null && manualP !== null && manualF !== null && manualC === null) { const fromPF = (manualP * 4) + (manualF * 9); return Math.max(0, Math.round((manualKcal - fromPF) / 4)); } return calcTargets.carbs; })();

  const switchKbjuMode = (mode: typeof kbjuMode) => { if (mode === 'manual' && kbjuMode !== 'manual') { setManualKcal(effectiveKcal); setManualP(effectiveP); setManualF(effectiveF); setManualC(effectiveC); } if (mode !== 'manual') { setManualKcal(null); setManualP(null); setManualF(null); setManualC(null); } setKbjuMode(mode); };

  const resultsRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState<BudgetLevel>('medium');
  const [nutrLevel, setNutrLevel] = useState<NutritionLevel>('base');
  const [variety, setVariety] = useState<'minimal' | 'medium' | 'max'>('max');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('23:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('19:00');
  const [workFood, setWorkFood] = useState<'any' | 'portable'>('any');
  const [mealsCount, setMealsCount] = useState(4);
  useEffect(() => { if (!wakeTime?.includes(':') || !bedTime?.includes(':')) return; const wMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]); const bMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]); const awakeHours = (bMin - wMin) / 60; if (awakeHours >= 16) setMealsCount(5); else if (awakeHours >= 14) setMealsCount(4); else setMealsCount(3); }, [wakeTime, bedTime]);

  const [allergens, setAllergens] = useState<string[]>(() => { try { const local = JSON.parse(localStorage.getItem('he_food_allergens') || 'null'); if (local && Array.isArray(local) && local.length > 0) return local; } catch {} try { return getContraindications().foodAllergies || []; } catch { return []; } });
  const [healthIssues, setHealthIssues] = useState<string[]>(() => { try { const local = JSON.parse(localStorage.getItem('he_health_issues') || 'null'); if (local && Array.isArray(local) && local.length > 0) return local; } catch {} try { return getContraindications().chronicConditions || []; } catch { return []; } });
  const [eveningLowCarb, setEveningLowCarb] = useState(() => { try { return localStorage.getItem('he_evening_low_carb') === 'true'; } catch { return false; } });
  React.useEffect(() => { const relevantActive = healthIssues.some(h => h === 'oedema' || h === 'diabetes'); if (relevantActive && !eveningLowCarb) { setEveningLowCarb(true); localStorage.setItem('he_evening_low_carb', 'true'); } }, [healthIssues]);

  const [planType, setPlanType] = useState<PlanType>('classic');
  const [preferredFoods, setPreferredFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_preferred_foods') || '["chicken_breast","rice_white","broccoli","egg_whole","avocado"]'); } catch { return ['chicken_breast','rice_white','broccoli','egg_whole','avocado']; } });
  const [quickAddMealIdx, setQuickAddMealIdx] = useState<number | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [customNotes, setCustomNotes] = useState(() => { try { return localStorage.getItem('he_nutrition_notes') || ''; } catch { return ''; } });
  const [excludedFoods, setExcludedFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_excluded_foods') || '[]'); } catch { return []; } });
  const [dietPrefs, setDietPrefs] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_diet_preferences') || '[]'); } catch { return []; } });
  const [allergenExcludedCount, setAllergenExcludedCount] = useState(0);
  const [planTargets, setPlanTargets] = useState<{ kcal: number; protein: number; fats: number; carbs: number }>({ kcal: 2500, protein: 160, fats: 70, carbs: 300 });
  const [cyclingMode, setCyclingMode] = useState<CycleType>('none');
  const [heavyTrainDay, setHeavyTrainDay] = useState('');
  const [workScheduleEnabled, setWorkScheduleEnabled] = useState(false);
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [workScheduleType, setWorkScheduleType] = useState('standard');
  const [trainingDays, setTrainingDays] = useState<boolean[]>([true, false, true, false, true, true, false]);
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const [generated, setGenerated] = useState(() => { try { return localStorage.getItem("he_plan_generated") === "true"; } catch { return false; } });
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(() => { try { const v = parseInt(localStorage.getItem("he_plan_days") || "1"); return (v === 3 || v === 7) ? v : 1; } catch { return 1; } });
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => { try { return parseInt(localStorage.getItem("he_plan_day_idx") || "0") || 0; } catch { return 0; } });
  const [planView, setPlanView] = useState<'list' | 'calendar'>(() => { try { return (localStorage.getItem("he_plan_view") === "calendar") ? "calendar" : "list"; } catch { return "list"; } });
  const [dayPlan, setDayPlan] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("he_plan_day") || "null"); } catch { return null; } });
  const [threeDayPlan, setThreeDayPlan] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("he_plan_3day") || "null"); } catch { return null; } });
  const [weekPlan, setWeekPlan] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("he_plan_week") || "null"); } catch { return null; } });
  const [shoppingList, setShoppingList] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("he_plan_shopping") || "null"); } catch { return null; } });
  const [waterCalc, setWaterCalc] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("he_plan_water") || "null"); } catch { return null; } });
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => { try { return JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]'); } catch { return []; } });
  const [lockedFoodIds, setLockedFoodIds] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('he_locked_foods') || '[]')); } catch { return new Set<string>(); } });
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
  const [userRecipes, setUserRecipes] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_user_recipes') || '[]'); } catch { return []; } });
  const [showRecipeCreator, setShowRecipeCreator] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showDrugTypePicker, setShowDrugTypePicker] = useState(false);
  const [takenSupplements, setTakenSupplements] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_nutrition_supps') || '[]'); } catch { return []; } });
  const [showSuppPicker, setShowSuppPicker] = useState(false);
  const [suppSearch, setSuppSearch] = useState('');
  const [newRecipe, setNewRecipe] = useState({ name: '', meal: 'lunch' as string, prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
  const [v2Phase, setV2Phase] = useState('LEAN_MASS');
  const [v2Labs, setV2Labs] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem('he_planner_labs') || '{}'); } catch { return {}; } });
  const [v2Pharma, setV2Pharma] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('he_planner_pharma') || '{}'); } catch { return {}; } });
  const [histamineSensitive, setHistamineSensitive] = useState(() => { try { return localStorage.getItem('he_planner_histamine') === 'true'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('he_planner_labs', JSON.stringify(v2Labs)); } catch {} }, [v2Labs]);
  useEffect(() => { try { localStorage.setItem('he_planner_pharma', JSON.stringify(v2Pharma)); } catch {} }, [v2Pharma]);
  useEffect(() => { try { localStorage.setItem('he_planner_histamine', histamineSensitive ? 'true' : 'false'); } catch {} }, [histamineSensitive]);
  useEffect(() => { try { localStorage.setItem('he_nutrition_supps', JSON.stringify(takenSupplements)); } catch {} }, [takenSupplements]);

  // B1: Persist generated plan data so it survives tab switching / remounts
  useEffect(() => { try { localStorage.setItem("he_plan_generated", generated ? "true" : "false"); } catch {} }, [generated]);
  useEffect(() => { try { localStorage.setItem("he_plan_days", String(planDays)); } catch {} }, [planDays]);
  useEffect(() => { try { localStorage.setItem("he_plan_day_idx", String(selectedDayIndex)); } catch {} }, [selectedDayIndex]);
  useEffect(() => { try { localStorage.setItem("he_plan_view", planView); } catch {} }, [planView]);
  useEffect(() => { try { if (dayPlan) localStorage.setItem("he_plan_day", JSON.stringify(dayPlan)); else localStorage.removeItem("he_plan_day"); } catch {} }, [dayPlan]);
  useEffect(() => { try { if (threeDayPlan) localStorage.setItem("he_plan_3day", JSON.stringify(threeDayPlan)); else localStorage.removeItem("he_plan_3day"); } catch {} }, [threeDayPlan]);
  useEffect(() => { try { if (weekPlan) localStorage.setItem("he_plan_week", JSON.stringify(weekPlan)); else localStorage.removeItem("he_plan_week"); } catch {} }, [weekPlan]);
  useEffect(() => { try { if (shoppingList) localStorage.setItem("he_plan_shopping", JSON.stringify(shoppingList)); else localStorage.removeItem("he_plan_shopping"); } catch {} }, [shoppingList]);
  useEffect(() => { try { if (waterCalc) localStorage.setItem("he_plan_water", JSON.stringify(waterCalc)); else localStorage.removeItem("he_plan_water"); } catch {} }, [waterCalc]);
  useEffect(() => { try { localStorage.setItem("he_plan_month_mode", monthPlanMode ? "true" : "false"); } catch {} }, [monthPlanMode]);
  useEffect(() => { try { if (monthPlan.length > 0) localStorage.setItem("he_plan_month", JSON.stringify(monthPlan)); else localStorage.removeItem("he_plan_month"); } catch {} }, [monthPlan]);

  const saveUndo = () => {
    const snap: any = {};
    if (dayPlan) snap.dayPlan = JSON.parse(JSON.stringify(dayPlan));
    if (threeDayPlan) snap.threeDayPlan = JSON.parse(JSON.stringify(threeDayPlan));
    if (weekPlan) snap.weekPlan = JSON.parse(JSON.stringify(weekPlan));
    setUndoStack(prev => [snap, ...prev].slice(0, 5));
  };

  const calcItemTotals = (items: any[]) => ({ kcal: items.reduce((s: number, i: any) => s + (i.kcal || 0), 0), p: items.reduce((s: number, i: any) => s + (i.p || 0), 0), f: items.reduce((s: number, i: any) => s + (i.f || 0), 0), c: items.reduce((s: number, i: any) => s + (i.c || 0), 0) });
  const calcMealTotals = (meals: any[]) => ({ kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) });
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
    if (plan === threeDayPlan) setThreeDayPlan({ ...plan, days, totals: allTotals } as any);
    else if (plan === weekPlan) setWeekPlan({ ...plan, days, totals: allTotals } as any);
  };

  const moveFoodItem = (fromMealIdx: number, toMealIdx: number, itemIdx: number) => {
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m: any) => ({ ...m, items: [...m.items], totals: { ...m.totals } }));
      const item = meals[fromMealIdx].items.splice(itemIdx, 1)[0];
      if (!item) return prev;
      meals[toMealIdx].items.push(item);
      meals.forEach((m: any, i: number) => { meals[i] = { ...m, totals: { kcal: m.items.reduce((s: number, it: any) => s + it.kcal, 0), p: m.items.reduce((s: number, it: any) => s + it.p, 0), f: m.items.reduce((s: number, it: any) => s + it.f, 0), c: m.items.reduce((s: number, it: any) => s + it.c, 0) } }; });
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
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
 
  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    const dayData = dayIdx === 0 ? dayPlan : threeDayPlan?.days?.[dayIdx - 1] || weekPlan?.days?.[dayIdx - 1];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    saveUndo();
    const old = dayData.meals[mealIdx].items[itemIdx]; const portion = (old.amount || 100) / 100;
    const replacement = { ...old, name: newFood.name, id: newFood.id, kcal: Math.round(newFood.kcal * portion), p: Math.round(newFood.protein * portion), f: Math.round(newFood.fat * portion), c: Math.round(newFood.carbs * portion), amount: Math.round(portion * (parseServingSizeGrams(newFood.servingSize) || 100)) };
    if (dayIdx === 0) {
      setDayPlan((prev: any) => updateMealsInPlan(prev, mealIdx, items => { items[itemIdx] = replacement; return items; }));
    } else if (threeDayPlan && dayIdx >= 1 && dayIdx <= 3) {
      updateMultiDayPlan(threeDayPlan, dayIdx - 1, mealIdx, items => { items[itemIdx] = replacement; return items; });
    } else if (weekPlan) {
      updateMultiDayPlan(weekPlan, dayIdx - 1, mealIdx, items => { items[itemIdx] = replacement; return items; });
    }
    setReplacingItem(null);
  };

  const updateItemAmount = (dayIdx: number, mealIdx: number, itemIdx: number, newAmount: number) => {
    if (dayIdx === 0) {
      setDayPlan((prev: any) => updateMealsInPlan(prev, mealIdx, items => {
        const it = { ...items[itemIdx], amount: Math.max(1, newAmount), kcal: Math.round(items[itemIdx].kcal / Math.max(1, items[itemIdx].amount) * Math.max(1, newAmount)) };
        items[itemIdx] = it; return items;
      }));
    } else if (threeDayPlan && dayIdx >= 1 && dayIdx <= 3) {
      updateMultiDayPlan(threeDayPlan, dayIdx - 1, mealIdx, items => {
        const it = { ...items[itemIdx], amount: Math.max(1, newAmount), kcal: Math.round(items[itemIdx].kcal / Math.max(1, items[itemIdx].amount) * Math.max(1, newAmount)) };
        items[itemIdx] = it; return items;
      });
    } else if (weekPlan) {
      updateMultiDayPlan(weekPlan, dayIdx - 1, mealIdx, items => {
        const it = { ...items[itemIdx], amount: Math.max(1, newAmount), kcal: Math.round(items[itemIdx].kcal / Math.max(1, items[itemIdx].amount) * Math.max(1, newAmount)) };
        items[itemIdx] = it; return items;
      });
    }
    setEditItem(null);
  };

  const removeFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number) => {
    saveUndo();
    if (dayIdx === 0) {
      setDayPlan((prev: any) => updateMealsInPlan(prev, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx)));
    } else if (threeDayPlan && dayIdx >= 1 && dayIdx <= 3) {
      updateMultiDayPlan(threeDayPlan, dayIdx - 1, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
    } else if (weekPlan) {
      updateMultiDayPlan(weekPlan, dayIdx - 1, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx));
    }
  };

  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number, dayIdx = 0) => {
    saveUndo();
    const buildRecipeItems = () => {
      return recipe.ingredients.map((ing) => { const lower = ing.toLowerCase(); const food = FOOD_DB.find(f => lower.includes(f.name.toLowerCase()) || lower.includes(f.id)); const item: any = food || { name: ing, id: ing, kcal: Math.round(recipe.kcal / recipe.ingredients.length), protein: Math.round(recipe.protein / recipe.ingredients.length), fat: Math.round(recipe.fat / recipe.ingredients.length), carbs: Math.round(recipe.carbs / recipe.ingredients.length) }; return { name: item.name || ing, id: item.id || ing, amount: 100, kcal: Math.round((item.kcal || 0) * (recipe.kcal / recipe.ingredients.length) / Math.max(1, item.kcal || 1)), p: Math.round(item.protein || recipe.protein / recipe.ingredients.length), f: Math.round(item.fat || recipe.fat / recipe.ingredients.length), c: Math.round(item.carbs || recipe.carbs / recipe.ingredients.length) }; });
    };
    if (dayIdx === 0) {
      setDayPlan((prev: any) => {
        if (!prev) return prev;
        const meals = [...prev.meals];
        const matchedItems = buildRecipeItems();
        const totals = calcItemTotals(matchedItems);
        meals[mealIdx] = { ...meals[mealIdx], items: matchedItems, totals };
        return { ...prev, meals, totals: calcMealTotals(meals) };
      });
    } else if (threeDayPlan && dayIdx >= 1 && dayIdx <= 3) {
      updateMultiDayPlan(threeDayPlan, dayIdx - 1, mealIdx, () => buildRecipeItems());
    } else if (weekPlan) {
      updateMultiDayPlan(weekPlan, dayIdx - 1, mealIdx, () => buildRecipeItems());
    }
    setRecipePickerMeal(null);
  };

  const toggleAllergen = (id: string) => { setAllergens(prev => { const updated = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]; localStorage.setItem('he_food_allergens', JSON.stringify(updated)); try { saveContraindications({ foodAllergies: updated }); } catch {} return updated; }); };
  const toggleHealthIssue = (id: string) => { setHealthIssues(prev => { const updated = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]; localStorage.setItem('he_health_issues', JSON.stringify(updated)); try { saveContraindications({ chronicConditions: updated }); } catch {} return updated; }); };

  const loadSavedPlan = (plan: SavedPlan) => {
    if (plan.dayPlan) { setDayPlan(plan.dayPlan); setGenerated(true); setPlanDays(1); }
    if (plan.threeDayPlan) setThreeDayPlan(plan.threeDayPlan);
    if (plan.weekPlan) setWeekPlan(plan.weekPlan);
    if (plan.shoppingList) setShoppingList(plan.shoppingList);
    if (plan.waterCalc) setWaterCalc(plan.waterCalc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => { if (profile) { try { updateProfile({ settings: { ...profile.settings, primaryGoal: goal as any } } as any); } catch {} } }, [goal]);
  // B4: Sync weight/height/age/sex/bodyFat back to profile so other screens see updated values
  useEffect(() => { if (profile) { try { const ps = profile.settings; if (ps?.weight !== weight || ps?.height !== height || ps?.age !== age || ps?.sex !== sex || ps?.bodyFat !== bodyFatPct) { updateProfile({ settings: { ...profile.settings, weight, height, age, sex, bodyFat: bodyFatPct } } as any); } } catch {} } }, [weight, height, age, sex, bodyFatPct]);

  // Auto-recalc macros when course changes
  useEffect(() => {
    const aasCount = injections.filter(i => i.type === 'ААС').length;
    if (aasCount > 0 && goal === 'mass') {
      setManualGPerKg(prev => ({ ...prev, protein: 2.5 }));
    } else if (aasCount === 0 && manualGPerKg.protein > 2.2) {
      setManualGPerKg(prev => ({ ...prev, protein: 1.8 }));
    }
    const insulinCount = injections.filter(i => i.type === 'инсулин').length;
    if (insulinCount > 0) {
      setManualKcal(prev => prev || Math.round(effectiveKcal * 1.1));
    }
  }, [injections.length]);

  // Sync from Profile Planner data (he_nutrition_profile)
  useEffect(() => {
    try {
      const pd = JSON.parse(localStorage.getItem('he_nutrition_profile') || '{}');
      if (!pd || Object.keys(pd).length === 0) return;
      if (pd.primaryGoal && !goalUserSet) { setGoal(pd.primaryGoal as GoalId); setGoalUserSet(true); }
      if (pd.budget) setBudget(pd.budget as BudgetLevel);
      if (pd.mealsCount) setMealsCount(pd.mealsCount);
      if (pd.dietType && pd.dietType !== 'omnivore') { setDietPrefs([pd.dietType === 'vegetarian' ? 'vegetarian' : pd.dietType]); }
      if (pd.allergens) {
        const newAl = Object.entries(pd.allergens).filter(([_,v]) => v).map(([k]) => k);
        if (newAl.length > 0) setAllergens(newAl);
      }
      if (pd.healthIssues) {
        const newHi = Object.entries(pd.healthIssues).filter(([_,v]) => v).map(([k]) => k);
        if (newHi.length > 0) setHealthIssues(newHi);
      }
      if (pd.targetKcal) { setManualKcal(pd.targetKcal); setKbjuMode('manual'); }
      if (pd.targetProtein) setManualP(pd.targetProtein);
      if (pd.targetFat) setManualF(pd.targetFat);
      if (pd.targetCarbs) setManualC(pd.targetCarbs);
      if (pd.lazyDayMode) setLazyDayMode(true);
      if (pd.carbCycling) setCyclingMode('macro');
      if (pd.trainingDays) setTrainingDays([...Array(pd.trainingDays)].map((_, i) => i < pd.trainingDays));
      if (pd.sodiumMg) { /* stored for future use in meal generation */ }
      if (pd.potassiumMg) { /* stored for future use */ }
      if (pd.magnesiumMg) { /* stored for future use */ }
      if (pd.pharma) {
        const ph = typeof pd.pharma === 'object' ? pd.pharma : {};
        setV2Pharma((prev:any) => ({ ...prev,
          AAS_ORAL: !!ph.aas_oral || prev.AAS_ORAL,
          AAS_INJECTABLE: !!ph.aas_inj || prev.AAS_INJECTABLE,
          HGH: !!ph.hgh || prev.HGH,
          INSULIN_USE: !!ph.insulin || prev.INSULIN_USE,
          DIURETICS: !!ph.diuretics || prev.DIURETICS,
          STIMULATORS: !!ph.stimulants || prev.STIMULATORS,
        }));
      }
    } catch {}
  }, []); // only on mount

  // ─── Generate Plan ───
  const generatePlan = (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number) => {
    try {
    setPlanDays(days);
    if (dayIndex !== undefined) setSelectedDayIndex(dayIndex);

    // ─── Pro Engine path (MPS-based, professional bodybuilding dietology) ───
    if (useProEngine) {
      const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
      const bfPct = bodyFatPct > 3 ? bodyFatPct : (sex === 'male' ? 15 : 22);
      const lbmKg = weight * (1 - bfPct / 100);
      const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
      const trainStartMin = linkToTraining && trainStart?.includes(':') ? toMin(trainStart) : undefined;
      const excludedIds = new Set<string>(excludedFoods);
      healthIssues.forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
      // P1.2: Pass locked foods to engine
      const lockedIds = new Set<string>([...lockedFoodIds]);
      // P1.3: Build recent foods set from existing plans to avoid repetition
      const recentFoodIds = new Set<string>();
      const collectFoods = (plan: any) => { if (plan?.meals) plan.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); })); if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); }))); };
      if (days >= 3 && dayPlan) collectFoods(dayPlan);
      if (days >= 7 && threeDayPlan) collectFoods(threeDayPlan);
      if (dietPrefs.includes('vegetarian')) {
        Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => { if (tags.isVegetarian === false) excludedIds.add(fid); });
      }
      const dayIdx = days === 1 ? selectedDayIndex : 0;
      const isTrainingDay = !!trainingDays[dayIdx];
      // Каждый вызов generatePlan → новый salt → разный набор продуктов
      const planRandomSalt = Math.floor(Math.random() * 1000000);

      const buildOneDay = (offset: number): any => {
        const input: MealPlanInput = {
          weightKg: weight, lbmKg, bodyFatPct: bfPct, sex,
          goalKcal: Math.round((effectiveKcal || weight * 30) * nutrMult),
          goalProteinG: Math.round((effectiveP || weight * 2) * nutrMult),
          goalFatG: Math.round((effectiveF || weight * 0.8) * nutrMult),
          goalCarbsG: Math.round((effectiveC || weight * 3.5) * nutrMult),
          mealsCount, isTrainingDay: !!trainingDays[offset % 7],
          trainStartMin: linkToTraining && trainingDays[offset % 7] ? toMin(trainStart) : undefined,
          allowIntraWorkout: trainIntensity === 'high',
          excludedIds, preferredIds: new Set(preferredFoods),
          lockedIds, recentFoodIds,
          budget, isVegetarian: dietPrefs.includes('vegetarian'),
          isCutting: goal === 'cutting' || goal === 'fat_loss',
          dayOffset: offset, cyclePhase: phase as any,
          randomSalt: planRandomSalt,
          variety,
          wakeTime, lunchTime, dinnerTime, bedTime,
        };
        const v2 = buildDayPlanV2(input);
        // Преобразуем DayPlanV2 → совместимый формат старого dayPlan
        const meals = v2.meals.map(m => ({
          label: m.label, time: m.time, items: m.items.map(it => ({
            name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c,
          })), totals: { kcal: m.totals.kcal, p: m.totals.p, f: m.totals.f, c: m.totals.c },
          conflictWarnings: undefined, synergyNotes: undefined,
          rationale: m.rationale, mpsCheck: m.mpsCheck,
        }));
        return {
          meals, totals: { kcal: v2.totals.kcal, p: v2.totals.p, f: v2.totals.f, c: v2.totals.c },
          isTrainingDay: v2.isTrainingDay,
          supplementTimeline: [], waterTimeline: [], nutritionLogic: [],
          dietDiversity: { uniqueFoods: v2.diversity.uniqueFoods, totalPortions: 0, categories: v2.diversity.categories, score: Math.min(10, v2.diversity.uniqueFoods), note: `${v2.diversity.uniqueFoods} уникальных продуктов` },
          timingScores: [], intraWorkout: null, mpsSummary: v2.mpsSummary, proNotes: v2.notes,
        };
      };

      const d1 = buildOneDay(dayIdx);
      setDayPlan(d1);
      if (days >= 3) {
        const d2 = buildOneDay(1); const d3 = buildOneDay(2);
        setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: d1.totals.kcal + d2.totals.kcal + d3.totals.kcal, p: d1.totals.p + d2.totals.p + d3.totals.p, f: d1.totals.f + d2.totals.f + d3.totals.f, c: d1.totals.c + d2.totals.c + d3.totals.c } });
      }
      if (days >= 7) {
        const weekDays = Array.from({ length: 7 }, (_, i) => buildOneDay(i));
        const weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + d.totals.kcal, 0), p: weekDays.reduce((s: any,d: any) => s + d.totals.p, 0), f: weekDays.reduce((s: any,d: any) => s + d.totals.f, 0), c: weekDays.reduce((s: any,d: any) => s + d.totals.c, 0) }};
        if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
        else setWeekPlan(weekData);
      }
      // Shopping list (упрощённый)
      const shoppingMap = new Map<string, any>();
      const allDayPlans = days >= 7 ? (Array.from({ length: 7 }, (_, i) => buildOneDay(i))) : days >= 3 ? [d1, buildOneDay(1), buildOneDay(2)] : [d1];
      allDayPlans.forEach((dp: any) => { (dp.meals || []).forEach((m: any) => { (m.items || []).forEach((it: any) => {
        const ex = shoppingMap.get(it.id);
        if (ex) { ex.amount += it.amount || 0; ex.kcal += it.kcal || 0; ex.p += it.p || 0; ex.f += it.f || 0; ex.c += it.c || 0; }
        else { const food = FOOD_DB.find(f => f.id === it.id); shoppingMap.set(it.id, { name: it.name, id: it.id, amount: it.amount || 100, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: food?.category || 'other' }); }
      }); }); });
      setShoppingList(Array.from(shoppingMap.values()).sort((a, b) => b.amount - a.amount));
      // Water
      const hasPharma = injections.length > 0 || (courseEntries?.length || 0) > 0;
      const aasCount = injections.filter(i => i.type === 'ААС').length;
      const pharmaHeavy = aasCount + injections.filter(i => i.type === 'инсулин').length + injections.filter(i => i.type === 'ГР').length;
      const baseWaterMl = weight * Math.min(45, 40 + pharmaHeavy * 1.5);
      setWaterCalc({ baseWater: Math.round(baseWaterMl / 10) / 10, pharmaBaseMl: 40, trainBonus: 0.3, fiberFactor: 0.1, pharmaBonus: hasPharma ? 0.5 : 0, total: Math.max(1.5, Math.round(baseWaterMl / 1000 * 10) / 10), hasPharma, electrolytes: { sodiumMg: 3500, potassiumMg: 3500, magnesiumMg: 400, note: 'Стандарт' } });
      setGenerated(true);
      generateRecommendations();
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return; // early return — Pro Engine завершён, старый код не выполняется
    }
    const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
    const budgetFilter = (id: BudgetLevel): number[] => { const map: Record<string, number[]> = { low:[0,5],medium:[5,8],max:[8,10],enhanced:[9,15] }; return map[id] || [5,10]; };
    const [bMin, bMax] = budgetFilter(budget);
    const qualityRange = (pool: any[]) => pool.filter((f: any) => { const q = compositeQualityScore(f); return q >= bMin && q <= bMax; });
    const effectivePlanType = dietPrefs.includes('vegetarian') ? ('vegetarian' as PlanType) : planType;
    const planTypeMod = PLAN_TYPES.find(p => p.id === effectivePlanType);
    const pMod = planTypeMod?.pMult || 1.0; const fMod = planTypeMod?.fMult || 1.0; const cMod = planTypeMod?.cMult || 1.0;
    const excludedIds = new Set(excludedFoods);
    healthIssues.forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
    // N2: vegetarian mode — exclude all non-vegetarian foods (meat, fish, poultry)
    if (dietPrefs.includes('vegetarian')) {
      Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => {
        if (tags.isVegetarian === false) excludedIds.add(fid);
      });
    }
    const getFoodAllergens = (foodId: string): string[] => { const fromDiet = FOOD_ALLERGEN_DIET[foodId]; if (fromDiet) return fromDiet.allergens; const food = FOOD_DB.find(f => f.id === foodId); return food?.allergens || []; };
    const userAllergenToValues: Record<string, string[]> = { 'лактоза':['dairy'],'молочные':['dairy'],'глютен':['gluten'],'орехи':['nuts','tree_nuts'],'арахис':['peanuts'],'яйца':['eggs'],'соя':['soy'],'рыба':['fish'],'морепродукты':['shellfish'],'кунжут':['sesame'],'горчица':['mustard'],'сельдерей':['celery'],'сульфиты':['sulfites'],'люпин':['lupin'] };
    const allergenTextMatches = (a: string, fName: string): boolean => { const n = fName.toLowerCase();
      if (a === 'лактоза' || a === 'молочные') { if (n.includes('молок')||n.includes('сыр')||n.includes('творог')||n.includes('кефир')||n.includes('сливк')||n.includes('йогурт')||n.includes('сметан')||n.includes('масл')||n.includes('морожен')||n.includes('сывороточ')||n.includes('whey')||n.includes('cas')||n.includes('casein')||n.includes('лактоз')) return true; }
      if (a === 'глютен') { if (n.includes('пшениц')||n.includes('мук')||n.includes('хлеб')||n.includes('макарон')||n.includes('пельмен')||n.includes('вареник')||n.includes('пицц')||n.includes('лаваш')||n.includes('булгур')||n.includes('кускус')||n.includes('манк')||n.includes('паниров')||n.includes('сухар')||n.includes('кляр')||n.includes('тест')||n.includes('блин')||n.includes('олад')||n.includes('круасс')||n.includes('багет')||n.includes('чиабат')||n.includes('лепёш')||n.includes('торт')||n.includes('пирож')||n.includes('пончик')||n.includes('печень')||n.includes('крекер')||n.includes('вафл')||n.includes('глютен')) return true; }
      if (a === 'орехи') { if (n.includes('миндаль')||n.includes('грецк')||n.includes('кешью')||n.includes('фундук')||n.includes('пекан')||n.includes('макадам')||n.includes('фисташк')||n.includes('орех')||n.includes('nut')||n.includes('almond')||n.includes('walnut')||n.includes('cashew')||n.includes('hazeln')||n.includes('pecan')||n.includes('pistach')) return true; }
      if (a === 'арахис') { if (n.includes('арахис')||n.includes('peanut')||n.includes('groundnut')||n.includes('ахид')||n.includes('землян')) return true; }
      if (a === 'яйца') { if (n.includes('яйц')||n.includes('яич')||n.includes('яичн')||n.includes('белок')||n.includes('желтк')||n.includes('омлет')||n.includes('egg')||n.includes('egg_')||n.includes('майонез')) return true; }
      if (a === 'соя') { if (n.includes('соя')||n.includes('соев')||n.includes('тофу')||n.includes('edamame')||n.includes('soy')||n.includes('мисо')||n.includes('miso')||n.includes('темпе')||n.includes('tamari')) return true; }
      if (a === 'рыба') { if (n.includes('рыб')||n.includes('лосос')||n.includes('тунец')||n.includes('треск')||n.includes('палтус')||n.includes('скумбр')||n.includes('форель')||n.includes('сардин')||n.includes('сельдь')||n.includes('anchov')||n.includes('fish')||n.includes('salmon')||n.includes('tuna')||n.includes('cod')||n.includes('halibut')) return true; }
      if (a === 'морепродукты') { if (n.includes('креветк')||n.includes('краб')||n.includes('лобстер')||n.includes('омар')||n.includes('мидии')||n.includes('кальмар')||n.includes('осьминог')||n.includes('shrimp')||n.includes('crab')||n.includes('lobster')||n.includes('mussel')||n.includes('squid')||n.includes('scallop')||n.includes('устриц')||n.includes('моллюск')||n.includes('ракушк')||n.includes('langoust')) return true; }
      if (a === 'кунжут') { if (n.includes('кунжут')||n.includes('сезам')||n.includes('тахини')||n.includes('sesame')||n.includes('tahini')) return true; }
      if (a === 'горчица') { if (n.includes('горчиц')||n.includes('mustard')) return true; }
      if (a === 'сельдерей') { if (n.includes('сельдерей')||n.includes('celery')) return true; }
      if (a === 'сульфиты') { if (n.includes('сульфит')||n.includes('sulfite')||n.includes('вино')||n.includes('пиво')||n.includes('сухофрукт')) return true; }
      if (a === 'люпин') { if (n.includes('люпин')||n.includes('lupin')) return true; }
      return false;
    };
    const allergenIds = new Set<string>();
    allergens.forEach(a => { const vals = userAllergenToValues[a] || [a]; vals.forEach(v => allergenIds.add(v)); });
    const allergenLabel = (code: string): string => ALLERGEN_LIST.find(a => a.id === code)?.label || code;
    const matchesSelectedAllergen = (food: any, selectedCode: string): boolean => {
      const tags = getFoodAllergens(food.id);
      return tags.includes(selectedCode) || allergenTextMatches(selectedCode, food.name);
    };
    // Wire diet preferences into allergen/exclusion system
    dietPrefs.forEach(dp => {
      if (dp === 'no_dairy' && !allergens.includes('молочные')) { ['dairy'].forEach(v => allergenIds.add(v)); }
      if (dp === 'no_gluten' && !allergens.includes('глютен')) { ['gluten'].forEach(v => allergenIds.add(v)); }
      if (dp === 'min_sugar') {
        FOOD_DB.filter(f => (f.carbs || 0) > 15 && (f.gi || 0) > 60).forEach(f => excludedIds.add(f.id));
      }
      if (dp === 'min_processed') {
        ['sausage','bacon','ham','kfc_wings','kfc_soup','kfc_bucket','mcd_big_mac','mcd_royale','bk_whopper','vt_big_smoke','pizza_margherita','french_fries','chips','nuggets','mayonnaise','ketchup','cream_sauce','marmalade','cookie','chocolate','ice_cream','condensed_milk','cheese_processed','bouillon_cube','soda','coca_cola','juice_apple','juice_orange','bread_white'].forEach(fid => excludedIds.add(fid));
      }
    });
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
    const portableFilter = (pool: any[]) => { if (workFood !== 'portable') return pool; const nonPortableIds = new Set(['kfc_wings','kfc_soup','kfc_bucket','mcd_big_mac','mcd_royale','bk_whopper','vt_big_smoke','pizza_margherita','french_fries','soup_chicken','soup_borscht','soup_mushroom','porridge_oat','porridge_buckwheat','rice_white_cooked','pasta_boiled','mayonnaise','ketchup','cream_sauce','bouillon_cube','soda','coca_cola','juice_apple','juice_orange','ice_cream','condensed_milk','cheese_processed','marmalade','cookie','chocolate']); return pool.filter(f => !nonPortableIds.has(f.id)); };
    const applyFoodPrefs = (pool: any[], prefType: string) => { const lower = prefType.toLowerCase(); if (pool.length <= 3) return pool; return portableFilter(pool).filter(f => !excludedIds.has(f.id) && [...allergenIds].every(a => !getFoodAllergens(f.id).includes(a) && !allergenTextMatches(a, f.name))); };
    const seedRand = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
    // ═══════════════════════════════════════════════════════════════════════
    // T1.1 — Smart breakfast templates by day type
    // ═══════════════════════════════════════════════════════════════════════
    const getBreakfastTemplate = (isTraining: boolean, isCutting: boolean, isVeg: boolean) => {
      const vegProts = ['pea_protein','soy_isolate'];
      const fastProts = isVeg ? vegProts : ['whey_isolate','whey_concentrate','egg_white'];
      const slowCarbs = isVeg ? ['oatmeal','buckwheat','quinoa'] : ['oatmeal','buckwheat','quinoa','egg_whole'];
      const fastCarbs = isVeg ? ['rice_cakes','banana'] : ['rice_cakes','banana','white_bread'];
      const fatSources = isVeg ? ['avocado','seed_chia','nuts_almonds','flaxseed_oil'] : ['egg_whole','avocado','seed_chia','nuts_almonds','butter_peanut'];
      const berries = ['fruit_blueberry','fruit_strawberry','fruit_raspberry'];
      const greens = ['veg_spinach','veg_kale'];
      if (isCutting) return { name:'Омлет + зелень', pId:isVeg?'pea_protein':'egg_white', carbId:'veg_spinach', fatId:'avocado', berryId:'fruit_blueberry', pG:0.5, cG:0.15, fG:0.3, note:'Сушка: белок + клетчатка + min углеводов' };
      if (isTraining) return { name:'Рисовый крем + протеин + ягоды', pId:fastProts[Math.floor(Math.random()*fastProts.length)], carbId:fastCarbs[Math.floor(Math.random()*fastCarbs.length)], fatId:fatSources[Math.floor(Math.random()*fatSources.length)], berryId:berries[Math.floor(Math.random()*berries.length)], pG:0.4, cG:0.7, fG:0.3, note:'Тренировочный день: быстрые углеводы + белок + омега-3' };
      return { name:'Овсянка + протеин + орехи', pId:fastProts[Math.floor(Math.random()*fastProts.length)], carbId:'oatmeal', fatId:'nuts_almonds', berryId:berries[Math.floor(Math.random()*berries.length)], pG:0.4, cG:0.5, fG:0.5, note:'День отдыха: медленные углеводы + жиры для сытости' };
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
      almonds: { id:'nuts_almonds', dose:20, reason:'Магний 50мг → релаксация нервной системы' },
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
      course: { priorityIds:['broccoli','cauliflower','brussels_sprouts','garlic','beetroot','avocado','egg_whole','spinach','nuts_almonds'], avoidIds:['alcohol','sugar','grapefruit'], note:'Курс ААС: крестоцветные (гепатопротекция), свёкла (NO), яйца (холин), авокадо (глутатион)' },
      pct: { priorityIds:['egg_whole','oyster','pumpkin_seeds','red_meat','salmon','nuts_brazil','avocado','olive_oil'], avoidIds:['soy','flaxseed','mint'], note:'ПКТ: холестерин→тестостерон (яйца/мясо), цинк (устрицы/семечки), омега-3, селен' },
      cutting: { priorityIds:['chicken_breast','turkey_breast','cod','egg_white','broccoli','spinach','cucumber','berries','grapefruit'], avoidIds:['sugar','bread','pasta','rice_white','potato','banana','dates'], note:'Сушка: белковая плотность, клетчатка, термогенные продукты' },
      bridge: { priorityIds:['salmon','avocado','olive_oil','nuts_almonds','egg_whole','broccoli','spinach'], avoidIds:['sugar','fast_food'], note:'Мост: омега-3, мононенасыщенные жиры, поддержка липидного профиля' },
      recovery: { priorityIds:['beef_steak','salmon','egg_whole','sweet_potato','spinach','berries','bone_broth','orange'], avoidIds:['alcohol','processed_food'], note:'Восстановление: цинк+железо (говядина), коллаген (костный бульон), витамин C' },
    };
    const phaseFoodBoost = PHASE_FOOD_BOOST[phase] || null;
    // 🟠12 — Lab-based food adjustments
    const labBoosts: string[] = []; const labAvoids: string[] = [];
    if (v2Labs.alt && parseFloat(v2Labs.alt) > 45) { labBoosts.push('broccoli','cauliflower','garlic','beetroot','avocado'); labAvoids.push('alcohol','sugar','grapefruit'); }
    if (v2Labs.ast && parseFloat(v2Labs.ast) > 40) { labBoosts.push('spinach','nuts_almonds','olive_oil'); }
    if (v2Labs.ldl && parseFloat(v2Labs.ldl) > 4.2) { labAvoids.push('butter','cheese_cream','sausage','bacon','fatty_meat'); labBoosts.push('salmon','avocado','olive_oil','oatmeal'); }
    if (v2Labs.crp && parseFloat(v2Labs.crp) > 3) { labBoosts.push('salmon','berries','green_tea'); }
    if (v2Labs.creatinine && parseFloat(v2Labs.creatinine) > 110) { labAvoids.push('red_meat','salt','processed_food'); labBoosts.push('watermelon','cucumber','celery'); }
    const effectivePhaseBoost = phaseFoodBoost ? {
      priorityIds: [...new Set([...phaseFoodBoost.priorityIds, ...labBoosts])],
      avoidIds: [...new Set([...phaseFoodBoost.avoidIds, ...labAvoids])],
      note: phaseFoodBoost.note + (labBoosts.length > 0 ? ` | Лаб: ${labBoosts.slice(0,3).join(', ')}` : '')
    } : (labBoosts.length > 0 ? { priorityIds: labBoosts, avoidIds: labAvoids, note: `Лаб. коррекция: ${labBoosts.slice(0,4).join(', ')}` } : null);
    // ═══════════════════════════════════════════════════════════════════════
    // ── Supplement timeline builder ──
    const buildSupplementTimeline = (mealTimes: { time: string; label: string; pct: number }[], isTrainingDay: boolean) => {
      const userSupps = takenSupplements.map(sid => ALL_SUBSTANCES.find(a => a.id === sid)).filter(Boolean);
      if (userSupps.length === 0) return [];
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
          if (userSupps.some(s => (s?.id||'').includes('creatine'))) slotItems.push({name:'Креатин',dose:'5г',note:'С пост-тренировочным приёмом'});
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
      // T4.4 — Phase-specific supplement recommendations
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
      if (phaseSupps.length > 0) {
        timeline.push({ time: '▸ Фаза', items: [{name:`Фаза «${phase}»`,dose:'—',note:phaseSupps.map(s=>`${s.name} ${s.dose}: ${s.note}`).join(' | ')}] });
        timeline.push(...phaseSupps.map(s => ({ time: '', items: [s] })));
      }
      return timeline;
    };
    const buildWaterTimeline = (w: number, mealTimes: { time: string; label: string }[], isTrainingDay: boolean, trainStart: string) => {
      const totalMl = Math.round(w * 40);
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
        timeline.push({ time: `${String(preH).padStart(2,'0')}:30`, ml: 400, note: 'За 60 мин до тренировки' });
        timeline.push({ time: `${String(postH).padStart(2,'0')}:00`, ml: 500, note: 'После тренировки: восстановление' });
      }
      timeline.push({ time: '21:00', ml: 300, note: 'Вечер: не позже чем за 1-2ч до сна' });
      return timeline;
    };
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
      const eaa = FOOD_DB.find(f => f.id === 'supp_eaas') || FOOD_DB.find(f => f.id === 'bcaa');
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
      const nMult = nutrMult || 1;
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
      if (eveningLowCarb) { const dinnerIdx = mealTimes.findIndex(m => m.label === 'Ужин'); const lunchIdx = mealTimes.findIndex(m => m.label === 'Обед'); if (dinnerIdx >= 0) { const carbReduction = Math.round((tCAdj / mealTimes.length) * 0.6); mealCAdjust[dinnerIdx] = -carbReduction; if (lunchIdx >= 0) mealCAdjust[lunchIdx] = carbReduction; } }
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
          const preProts = isVeg ? ['pea_protein','soy_isolate','egg_white','cottage_cheese_5'] : ['whey_isolate','whey_concentrate','egg_white','chicken_breast'];
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
          const postProts = isVeg ? ['pea_protein','soy_isolate','egg_white'] : ['whey_isolate','whey_concentrate','chicken_breast','egg_whole','turkey_breast'];
          const postCarbsFiltered = FOOD_DB.filter(f => (f.gi||0) >= 75 && (f.category==='carb'||f.category==='grain'||f.category==='veg_fruit') && f.carbs>10);
          const postCarbs = postCarbsFiltered.length > 0 ? postCarbsFiltered.map(f=>f.id) : ['rice_white','potato','white_bread'];
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
            const bf = getBreakfastTemplate(isTrainingDay, isCutting, isVeg);
            const bfP = FOOD_DB.find(f => f.id === bf.pId);
            const bfC = FOOD_DB.find(f => f.id === bf.carbId);
            const bfFat = FOOD_DB.find(f => f.id === bf.fatId);
            const bfBerry = FOOD_DB.find(f => f.id === bf.berryId);
            if (bfP) { const r = Math.min(2.5, (weight * bf.pG) / Math.max(1, bfP.protein)); let amt = Math.round(r * 100); const bfPCap = SUPP_CAP[bf.pId]; if (bfPCap) amt = Math.min(bfPCap, amt); items.push({name:bfP.name,id:bf.pId,amount:amt,kcal:Math.round(bfP.kcal*r),p:Math.round(bfP.protein*r),f:Math.round(bfP.fat*r),c:Math.round(bfP.carbs*r)}); }
            if (bfC) { const r = Math.min(2.5, (weight * bf.cG) / Math.max(1, bfC.carbs || 1)); const amt = Math.round(r * 100); items.push({name:bfC.name,id:bf.carbId,amount:amt,kcal:Math.round(bfC.kcal*r),p:Math.round(bfC.protein*r),f:Math.round(bfC.fat*r),c:Math.round(bfC.carbs*r)}); }
            if (bfFat) { const r = Math.min(2.0, (weight * bf.fG) / Math.max(1, bfFat.fat || 1)); const amt = Math.round(r * 100); items.push({name:bfFat.name,id:bf.fatId,amount:amt,kcal:Math.round(bfFat.kcal*r),p:Math.round(bfFat.protein*r),f:Math.round(bfFat.fat*r),c:Math.round(bfFat.carbs*r)}); }
            if (bfBerry) { items.push({name:bfBerry.name,id:bf.berryId,amount:80,kcal:Math.round(bfBerry.kcal*0.8),p:Math.round(bfBerry.protein*0.8),f:Math.round(bfBerry.fat*0.8),c:Math.round(bfBerry.carbs*0.8)}); }
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
        const PROTEIN_TOPPERS = ['whey_isolate','chicken_breast','egg_whole','cottage_cheese','turkey_breast'];
        const FAT_TOPPERS = ['olive_oil','avocado','nuts_almonds','flaxseed_oil'];
        const CARB_TOPPERS = ['rice_white','buckwheat','pasta','oatmeal','potato'];
        const topperPool = macro === 'p' ? PROTEIN_TOPPERS : macro === 'f' ? FAT_TOPPERS : CARB_TOPPERS;
        const candidateId = topperPool[Math.floor(Math.random() * topperPool.length)];
        const food = FOOD_DB.find(f => f.id === candidateId);
        if (!food) {
          const fallbackId = macro === 'p' ? 'whey_isolate' : macro === 'f' ? 'olive_oil' : 'rice_white';
          const fb = FOOD_DB.find(f => f.id === fallbackId);
          if (!fb) return;
          const per100 = macro === 'p' ? fb.protein : macro === 'f' ? fb.fat : fb.carbs;
          if (!per100) return;
        const rawAmount = Math.min(macro === 'f' ? 25 : 120, Math.max(macro === 'f' ? 5 : 20, Math.round(deficit / per100 * 100)));
        const suppCap = ({ creatine:10, whey_isolate:60, whey_protein:60, casein:60, bcaa:20, supp_eaas:20, glutamine:15, supp_hmb:6, supp_beta_alanine:6 } as Record<string, number>)[fb.id];
        const amount = suppCap ? Math.min(suppCap, rawAmount) : rawAmount;
        const r = amount / 100;
        const item = { name: fb.name, id: fb.id, amount, kcal: Math.round(fb.kcal * r), p: Math.round(fb.protein * r), f: Math.round(fb.fat * r), c: Math.round(fb.carbs * r) };
        targetMeal.items.push(item);
        targetMeal.totals = { kcal: targetMeal.items.reduce((s: number, i: any) => s + i.kcal, 0), p: targetMeal.items.reduce((s: number, i: any) => s + i.p, 0), f: targetMeal.items.reduce((s: number, i: any) => s + i.f, 0), c: targetMeal.items.reduce((s: number, i: any) => s + i.c, 0) };
        return;
      }

      const per100 = macro === 'p' ? food.protein : macro === 'f' ? food.fat : food.carbs;
      if (!per100) return;
      const rawAmount = Math.min(macro === 'f' ? 25 : 120, Math.max(macro === 'f' ? 5 : 20, Math.round(deficit / per100 * 100)));
      const suppCap2 = ({ creatine:10, whey_isolate:60, whey_protein:60, casein:60, bcaa:20, supp_eaas:20, glutamine:15, supp_hmb:6, supp_beta_alanine:6 } as Record<string, number>)[food.id];
      const amount = suppCap2 ? Math.min(suppCap2, rawAmount) : rawAmount;
        const r = amount / 100;
        const item = { name: food.name, id: food.id, amount, kcal: Math.round(food.kcal * r), p: Math.round(food.protein * r), f: Math.round(food.fat * r), c: Math.round(food.carbs * r) };
        targetMeal.items.push(item);
        targetMeal.totals = { kcal: targetMeal.items.reduce((s: number, i: any) => s + i.kcal, 0), p: targetMeal.items.reduce((s: number, i: any) => s + i.p, 0), f: targetMeal.items.reduce((s: number, i: any) => s + i.f, 0), c: targetMeal.items.reduce((s: number, i: any) => s + i.c, 0) };
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
      const mpsWheyId = dietPrefs.includes('vegetarian') ? 'pea_protein' : 'whey_isolate';
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
      const fastProteinIds = ['whey_isolate','whey_concentrate','egg_white','egg_whole','chicken_breast','turkey_breast','pea_protein','soy_isolate'];
      const caseinIds = ['casein','cottage_cheese_5','cottage_cheese_2','cottage_cheese_0','yogurt_greek'];
      const morningMeal = meals.find((m: any) => m.label === 'Завтрак');
      if (morningMeal) {
        const hasFastProtein = morningMeal.items.some((it: any) => fastProteinIds.includes(it.id));
        const morningP = morningMeal.items.reduce((s: number, i: any) => s + (i.p || 0), 0);
        if (!hasFastProtein || morningP < 25) {
          const mpId = dietPrefs.includes('vegetarian') ? 'pea_protein' : 'whey_isolate';
          const mp = FOOD_DB.find(f => f.id === mpId);
          if (mp) {
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
          const caseinId = dietPrefs.includes('vegetarian') ? 'cottage_cheese_5' : 'casein';
          const casein = FOOD_DB.find(f => f.id === caseinId);
          if (casein) {
            const caseinPG = Math.min(40, Math.round(weight * 0.4));
            const r = Math.min(2.0, caseinPG / Math.max(1, casein.protein));
            const amt = Math.round(r * 100);
            lastMeal.items.push({name:casein.name,id:caseinId,amount:amt,kcal:Math.round(casein.kcal*r),p:Math.round(casein.protein*r),f:Math.round(casein.fat*r),c:Math.round(casein.carbs*r)});
          }
        }
        // Add Mg-rich food for GABA/melatonin pathway
        const hasMg = lastMeal.items.some((it: any) => ['pumpkin_seeds','nuts_almonds','spinach'].includes(it.id));
        if (!hasMg) {
          const mgFood = FOOD_DB.find(f => f.id === 'pumpkin_seeds') || FOOD_DB.find(f => f.id === 'nuts_almonds');
          if (mgFood) {
            lastMeal.items.push({name:mgFood.name,id:mgFood.id,amount:20,kcal:Math.round(mgFood.kcal*0.2),p:Math.round(mgFood.protein*0.2),f:Math.round(mgFood.fat*0.2),c:Math.round(mgFood.carbs*0.2)});
          }
        }
        // Add natural melatonin source (kiwi or cherry) if not already present
        const hasMelatonin = lastMeal.items.some((it: any) => ['kiwi','cherry','tart_cherry'].includes(it.id));
        if (!hasMelatonin) {
          const melFood = FOOD_DB.find(f => f.id === 'kiwi') || FOOD_DB.find(f => f.id === 'cherry');
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
          const matched = [...allergenIds].filter(a => matchesSelectedAllergen(food, a));
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
    const d1 = buildDay(dayIdx, trainingDays[dayIdx]);
    const d2 = buildDay(1, trainingDays[1]);
    const d3 = buildDay(2, trainingDays[2]);
    setDayPlan(d1);
    if (days >= 3) setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: d1.totals.kcal + d2.totals.kcal + d3.totals.kcal, p: d1.totals.p + d2.totals.p + d3.totals.p, f: d1.totals.f + d2.totals.f + d3.totals.f, c: d1.totals.c + d2.totals.c + d3.totals.c } });
    let weekDays: any[] | null = null;
    if (days >= 7) {
      weekDays = Array.from({ length: 7 }, (_, i) => buildDay(i, trainingDays[i]));
      if (periodizationEnabled) {
        const pWeek = weekIndex !== undefined ? weekIndex % 5 : 0;
        if (pWeek === 0 || pWeek === 4) {
          weekDays = weekDays.map((d: any) => ({ ...d, meals: d.meals.map((m: any) => ({ ...m, items: m.items.map((it: any) => ({ ...it, amount: Math.round(it.amount * 1.15), kcal: Math.round(it.kcal * 1.15), p: Math.round(it.p * 1.15), f: Math.round(it.f * 1.15), c: Math.round(it.c * 1.15) })) })), totals: { kcal: Math.round(d.totals.kcal * 1.15), p: Math.round(d.totals.p * 1.15), f: Math.round(d.totals.f * 1.15), c: Math.round(d.totals.c * 1.15) } }));
        } else if (pWeek === 2) {
          weekDays = weekDays.map((d: any) => ({ ...d, meals: d.meals.map((m: any) => ({ ...m, items: m.items.map((it: any) => ({ ...it, amount: Math.round(it.amount * 0.8), kcal: Math.round(it.kcal * 0.8), p: Math.round(it.p * 0.8), f: Math.round(it.f * 0.8), c: Math.round(it.c * 0.8) })) })), totals: { kcal: Math.round(d.totals.kcal * 0.8), p: Math.round(d.totals.p * 0.8), f: Math.round(d.totals.f * 0.8), c: Math.round(d.totals.c * 0.8) } }));
        }
      }
      const weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + d.totals.kcal, 0), p: weekDays.reduce((s: any,d: any) => s + d.totals.p, 0), f: weekDays.reduce((s: any,d: any) => s + d.totals.f, 0), c: weekDays.reduce((s: any,d: any) => s + d.totals.c, 0) }};
      if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
      else setWeekPlan(weekData);
    }
    generateRecommendations();
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
    const hasPharma = injections.length > 0 || (courseEntries?.length || 0) > 0;
    const aasCount = injections.filter(i => i.type === 'ААС').length; const insulinCount = injections.filter(i => i.type === 'инсулин').length; const ghCount = injections.filter(i => i.type === 'ГР').length;
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
      console.warn('[PlanGen] Error:', e?.message || e);
      setErrorMsg(e?.message || 'Ошибка генерации плана. Проверьте введённые данные.');
    }
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useProEngine, setUseProEngine] = useState(() => { try { return localStorage.getItem('he_use_pro_engine') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('he_use_pro_engine', useProEngine ? 'true' : 'false'); } catch {} }, [useProEngine]);

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

  const generateCheatMeal = () => {
    const cals = Math.round(effectiveKcal * 0.35);
    const items = FOOD_DB.filter(f => f.category === 'fast_food' || (f.kcal > 200 && (f.name.toLowerCase().includes('бургер') || f.name.toLowerCase().includes('пицц') || f.name.toLowerCase().includes('картофель фри') || f.name.toLowerCase().includes('чипс') || f.name.toLowerCase().includes('шоколад') || f.name.toLowerCase().includes('морожен') || f.name.toLowerCase().includes('пончик')))).sort(() => Math.random() - 0.5).slice(0, 2);
    setCheatMealPlan({ items, totalKcal: items.reduce((s,i) => s + i.kcal, 0), cals, note:'Читмил ПОСЛЕ тяжёлой тренировки. Не более 1500 ккал.', principles:['🍔 Психологическая разгрузка','⏰ Только ПОСЛЕ тренировки','📏 Макс 1 раз/нед, до 1500 ккал','🔄 Не компенсировать на след.день','💧 Пить воду, не газировку'], bju:{kcal:cals,p:Math.round(cals*0.08/4),f:Math.round(cals*0.40/9),c:Math.round(cals*0.52/4)}, recommendation: goal === 'mass' ? '1-2р/нед' : goal === 'fat_loss' || goal === 'cutting' ? '1р в 7-10 дней' : '1р/нед' });
  };

  const generateCarbload = () => {
    const carbsPerKg = 8; const totalCarbs = Math.round(weight * carbsPerKg);
    const carbFoods = FOOD_DB.filter(f => (f.category === 'carb' || f.category === 'grain') && f.carbs > 20).sort(() => Math.random() - 0.5).slice(0, 5);
    setCarbloadPlan({ totalCarbs, foods: carbFoods.map(f => ({ name: f.name, carbs: f.carbs, amount: Math.round(totalCarbs * 0.3 / f.carbs * 100) })), note:'За 24-48ч до тренировки. Воды +1-1.5л.', principles:['🍚 Заполнение гликогена','⏰ За 24-48ч до тяжёлой тренировки','📏 6-8 г/кг углеводов','💧 Воды +1-1.5л','🧂 Натрий 200-500мг','⬇ Жиры до 0.5г/кг'], bju:{c:totalCarbs,p:Math.round(effectiveP),f:Math.round(weight*0.5),kcal:totalCarbs*4+Math.round(effectiveP)*4+Math.round(weight*0.5)*9} });
  };

  const generateBUTCH = () => { const highCarb = Math.round(effectiveC * 1.3); const lowCarb = Math.round(effectiveC * 0.5); setButchPlan({ pattern: trainingDays.filter(Boolean).length + ' тр + ' + trainingDays.filter(d=>!d).length + ' отдых', highCarb, lowCarb, protein: effectiveP, fatHigh: Math.round(effectiveF * 0.8), fatLow: Math.round(effectiveF * 1.2), note:'Цикл по тренировочным дням', principles:['⤴️⤵️ БУЧ для жиросжигания','📊 ВУ дни: угл +30%','📊 НУ дни: угл -50%','💪 Белок 2-2.5г/кг','🧈 Жиры: ВУ 0.8×, НУ 1.2×','⏳ Макс 4 недели'] }); };

  const generateCravingPlan = () => {
    const sweetToothKcal = Math.min(500, Math.round(effectiveKcal * 0.12));
    const sweetItems = FOOD_DB.filter(f => {
      const n = f.name.toLowerCase();
      return n.includes('шоколад') || n.includes('морожен') || n.includes('печень') || n.includes('конфет') || n.includes('мед') || n.includes('варень') || n.includes('джем') || n.includes('банан') || n.includes('яблоко') || n.includes('виноград') || n.includes('финик');
    }).sort(() => Math.random() - 0.5).slice(0, 2);
    setCravingPlan({
      kcal: sweetToothKcal,
      days: cravingDays,
      items: sweetItems,
      bju: {
        kcal: sweetToothKcal,
        p: Math.round(sweetToothKcal * 0.06 / 4),
        f: Math.round(sweetToothKcal * 0.25 / 9),
        c: Math.round(sweetToothKcal * 0.69 / 4),
      },
      note: `Сладкий перекус на ${cravingDays} ${cravingDays === 1 ? 'день' : 'дня'}. Вписывайте в КБЖУ.`,
      principles: ['🍬 Разовый десерт без чувства вины', '📏 Не более 12% дневной калорийности', '⏰ Лучше в первой половине дня', '🥜 Добавить белок/жиры для сытости', '💧 Пить воду перед десертом'],
      recommendation: goal === 'cutting' || goal === 'fat_loss' ? '1-2р/нед' : '2-3р/нед',
    });
  };

  const generateLazyDayPlan = () => {
    const lazyKcal = Math.round(effectiveKcal * 0.85);
    const lazyItems = FOOD_DB.filter(f => {
      const n = f.name.toLowerCase();
      return (f.category === 'dairy' && f.carbs < 10) || n.includes('яйц') || n.includes('творог') || n.includes('йогурт') || n.includes('протеин') || n.includes('кефир') || n.includes('хлеб') || n.includes('овсян') || n.includes('банан') || n.includes('орех') || n.includes('авокадо');
    }).filter(f => f.carbs < 40).sort(() => Math.random() - 0.5).slice(0, 5);
    setLazyDayPlan({
      kcal: lazyKcal,
      days: lazyDayDays,
      items: lazyItems,
      bju: {
        kcal: lazyKcal,
        p: Math.round(lazyKcal * 0.30 / 4),
        f: Math.round(lazyKcal * 0.25 / 9),
        c: Math.round(lazyKcal * 0.45 / 4),
      },
      note: `Минимум готовки: ${lazyDayDays} ${lazyDayDays === 1 ? 'день' : 'дней'}. Простые блюда за 5-10 мин.`,
      principles: ['⏱️ Блюда до 10 минут', '🔥 Не требует варки/жарки', '🥛 Молочка + хлопья + фрукты', '🥪 Бутерброды с авокадо/рыбой', '💪 Протеиновый коктейль — база'],
      recommendation: 'Не чаще 2-3 раз/нед, иначе замедление метаболизма',
    });
  };

  const generateRecommendations = () => {
    const recs: string[] = [];
    if (goal === 'mass') recs.push('💪 Профицит 300-500 ккал. Белок 1.8-2.2г/кг. Углеводы 4-5г/кг.');
    if (goal === 'fat_loss' || goal === 'cutting') recs.push('🔥 Дефицит 300-500 ккал. Белок 2.5г/кг критически важен.');
    if (goal === 'strength') recs.push('🏋️ Профицит 200-300 ккал. Углеводы 5-6г/кг в тренировочные дни.');
    if (goal === 'maintenance') recs.push('⚖️ Калории на уровне TDEE. Баланс 30/20/50.');
    if (goal === 'recomposition') recs.push('🔄 Калории = TDEE или -100-200. Белок 2.5г/кг.');
    if (goal === 'rehab') recs.push('🩹 Белок 2.5-3г/кг. ВСАА 15-20г/день. Омега-3 3-5г/день.');
    if (phase === 'course') recs.push('💉 Курс: белок 2.5г/кг, контроль печени, вода 40мл/кг.');
    if (phase === 'pct') recs.push('🔄 ПКТ: белок 2.2г/кг, цинк 50мг, D 5000МЕ, магний.');
    if (phase === 'cutting') recs.push('✂️ Сушка: 5-6 приёмов, контроль натрия, клетчатка.');
    if (injections.length > 0) {
      const hasInsulin = injections.some(i => i.type === 'инсулин'); const hasShortInsulin = injections.some(i => i.type === 'инсулин' && i.esterType !== 'long');
      const hasGH = injections.some(i => i.type === 'ГР' || i.type === 'GHRP' || i.type === 'CJC'); const hasIGF = injections.some(i => i.type === 'ИФР-1');
      const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид'); const hasAAS = injections.some(i => i.type === 'ААС');
      const totalInsulinDose = injections.filter(i => i.type === 'инсулин' && i.esterType !== 'long').reduce((s, i) => s + i.dose, 0);
      if (hasAAS) recs.push('💉 ААС: белок +0.3г/кг, вода 40мл/кг, NAC/расторопша.');
      if (hasShortInsulin || hasInsulin) { recs.push(`💉 Инсулин: ${totalInsulinDose}ЕД × 10г = ${totalInsulinDose*10}г угл. Минимум 150г угл/день.`); recs.push('🍔 На инсулине — минимум жиров в окне действия.'); }
      if (hasGH) recs.push('🧬 ГР: избегать угл в окне 60мин до/после. Вода +0.5-1л.');
      if (hasIGF) recs.push('🧬 ИФР-1: натощак за 30-45мин до еды. Контроль глюкозы.');
      if (hasGLP) recs.push('💊 GLP-1: дробно 5-6р по 100-200г. Жиры <5г/приём.');
    }
    if (linkToTraining) recs.push(`🏋️ Тренировка ${trainStart}-${trainEnd}. Предтрен за 1.5-2ч, пост-трен в течение 60-90мин.`);
    recs.push('✅ Белок с каждым приёмом. Овощи 300-500г/день. Вода 2.5-4л. Сон 7-9ч.');

    // ── v2-анализ сгенерированного рациона и правил справочника ──
    if (generated && dayPlan) {
      const profile = getDefaultProfile();
      profile.sex = sex;
      profile.bodyFatPct = bodyFatPct || 15;
      profile.discipline = (trainType === 'strength' ? 'powerlifting' : 'bodybuilding') as any;
      profile.phase = (v2Phase as any) || 'LEAN_MASS';
      profile.pharma.AAS_ORAL = v2Pharma.AAS_ORAL || false;
      profile.pharma.AAS_INJECTABLE = v2Pharma.AAS_INJECTABLE || false;
      profile.pharma.HGH = v2Pharma.HGH || false;
      profile.pharma.DIURETICS = v2Pharma.DIURETICS || false;
      profile.pharma.STIMULATORS = v2Pharma.STIMULATORS || false;
      profile.pharma.INSULIN_USE = v2Pharma.INSULIN_USE || false;
      profile.pharma.LIVER_SUPPORT = v2Pharma.LIVER_SUPPORT || false;
      profile.pharma.GUT_SUPPORT = v2Pharma.GUT_SUPPORT || false;
      profile.histamineSensitive = histamineSensitive;
      profile.labs.hematocrit = v2Labs.hematocrit ? parseFloat(v2Labs.hematocrit) : undefined;
      profile.labs.hemoglobin = v2Labs.hemoglobin ? parseFloat(v2Labs.hemoglobin) : undefined;
      profile.labs.ldl = v2Labs.ldl ? parseFloat(v2Labs.ldl) : undefined;
      profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
      profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
      profile.labs.crp = v2Labs.crp ? parseFloat(v2Labs.crp) : undefined;
      profile.weightKg = weight || 80;
      profile.lbm = profile.weightKg * (100 - profile.bodyFatPct) / 100;

      const planDaysForAnalysis = planDays >= 7 ? (weekPlan?.days || [dayPlan]).filter(Boolean)
        : planDays >= 3 ? (threeDayPlan?.days || [dayPlan]).filter(Boolean)
        : [dayPlan].filter(Boolean);
      const allMealsForV2 = planDaysForAnalysis.flatMap((dp: any) =>
        (dp.meals || []).map((m: any) => ({
          timing: (m.timing || 'regular') as any,
          products: (m.items || []).map((it: any) => {
            const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
            return { foodId: food?.id || it.name || 'unknown', weightGrams: it.amount || 100 };
          }).filter((p: any) => p.weightGrams > 0),
        }))
      );

      const daysCount = planDaysForAnalysis.length;
      const daily = analyzeDailyDiet(allMealsForV2, profile);
      const totalKcal = Math.round(planDaysForAnalysis.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0) / daysCount);
      const totalP = Math.round(planDaysForAnalysis.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0) / daysCount);
      const mealsCount = Math.round(allMealsForV2.length / daysCount);

      // mTOR
      if (!daily.mtorTriggered) recs.push(`🧬 mTOR не запущен — дефицит ${daily.mtorDeficitMg}мг лейцина. Добавьте 30-40г сывороточного протеина или 200г курицы.`);
      else recs.push('🧬 mTOR запущен — лейцин >3г/день ✅');

      // DIAAS
      if (daily.diaasWarning) recs.push(`💪 ${daily.diaasWarning}`);

      // GI load
      if (daily.giLoadWarning) recs.push(`🧬 Высокая гликемическая нагрузка (${Math.round(daily.giLoad)} GL). Разнесите углеводы по приёмам и замените часть быстрых углеводов на низко-GI источники.`);

      // Electrolytes
      if (daily.electrolyteRisk) recs.push(`💧 Риск электролитов: K ${Math.round(daily.potassiumMg)}мг, Mg ${Math.round(daily.magnesiumMg)}мг. Добавьте шпинат, авокадо, орехи.`);

      // Omega
      if (daily.omegaWarning) recs.push(`🐟 ${daily.omegaWarning}. Добавьте жирную рыбу 2-3р/нед или омега-3 2-4г/день.`);

      // Antinutrients
      if (daily.antinutrientWarning) recs.push(daily.antinutrientWarning);

      // Glutathione
      if (daily.glutathioneWarning) recs.push(daily.glutathioneWarning);

      // Histamine
      if (daily.histamineWarning) recs.push(daily.histamineWarning);

      // Micro deficits
      if (daily.microDeficits.length > 0) recs.push(`⚠️ Дефициты микронутриентов: ${daily.microDeficits.join(', ')}. Рассмотрите приём ВМК.`);

      // ── Правила справочника ──
      if (mealsCount < 4) recs.push('📋 Меньше 4 приёмов — распределите белок равномерно для MPS.');
      if (mealsCount > 6) recs.push('📋 Больше 6 приёмов — возможно дробление порций, проверьте насыщение.');
      if (totalP < weight * 1.8) recs.push(`🥩 Белок ${totalP}г (${(totalP/weight).toFixed(1)}г/кг) — ниже ${weight*1.8}г. Увеличьте белок до 2г/кг.`);
      if (profile.labs.ldl && profile.labs.ldl > 4.2) recs.push('🩸 ЛПНП >4.2 ммоль/л — ограничьте насыщенные жиры (жирное мясо, сливочное масло).');
      if (profile.labs.alt && profile.labs.alt > 45) recs.push('🫁 АЛТ >45 Ед/л — добавьте NAC 600-1200мг, расторопшу 280мг, TUDCA 500мг.');
      if (profile.labs.crp && profile.labs.crp > 3) recs.push('🔥 СРБ >3 мг/л — добавьте омега-3 3-5г/день, полифенолы (куркума 500мг, зелёный чай).');

      // Macros deviation
      const targetKcal = effectiveKcal || (weight * 33);
      if (Math.abs(totalKcal - targetKcal) > 200) {
        const dir = totalKcal > targetKcal ? 'превышение' : 'недобор';
        recs.push(`📊 ${dir.toUpperCase()} ${Math.abs(totalKcal - targetKcal)} ккал от цели (${targetKcal}). Откорректируйте приёмы.`);
      }
    }

      // ── Refeed / Reverse diet рекомендации ──
      if (goal === 'fat_loss' || goal === 'cutting') {
        const deficitWeeks = (() => { try { const nv2 = getNutritionV2Data(); return nv2.dietWeeks || 0; } catch { return 0; } })();
        if (deficitWeeks >= 2) {
          const refeedCarbsG = Math.round(weight * 5);
          const refeedKcal = Math.round(effectiveP * 4 + effectiveF * 9 + refeedCarbsG * 4);
          recs.push(`🔄 Refeed: каждые 7-14 дней — ${refeedCarbsG}г углеводов (~${refeedKcal} ккал). Жиры ≤0.5 г/кг. Длительность: 24ч.`);
          if (deficitWeeks >= 8) {
            const reverseKcal = Math.round(effectiveKcal * 1.15);
            recs.push(`📈 Reverse diet: метаболическая адаптация ${deficitWeeks}+ нед. Выход: +50-100 ккал/нед до TDEE. Текущий целевой разгон: ~${reverseKcal} ккал.`);
          }
        }
      }
      if (dietPauseMode === 'refeed') {
        recs.push(`🍽 Refeed активен: ${weight > 0 ? Math.round(weight * 5) : '300'}г углеводов, жиры ${weight > 0 ? Math.round(weight * 0.5) : '40'}г. Не чаще 1р/нед на дефиците.`);
      }
      if (dietPauseMode === 'diet_5_2') {
        recs.push(`📅 5:2 протокол: 5 дней maintenance + 2 дня дефицит (~${Math.round(effectiveKcal * 0.7)} ккал). Поддерживает метаболизм.`);
      }

    setRecommendations(recs);
  };

  useEffect(() => { if (generated && dayPlan) generateRecommendations(); }, [injections.length]);

  const saveCurrentPlan = () => { const name = prompt('Название плана:', `${new Date().toLocaleDateString('ru-RU')} · ${Math.round(dayPlan?.totals?.kcal || 0)} ккал`); if (name === null) return; const plan: SavedPlan = { id: Date.now(), date: new Date().toISOString().split('T')[0], name, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc }; const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10); setSavedPlans(updated); localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); };

  const autoCorrectPlan = () => { if (!dayPlan || !dayPlan.meals) return; const remaining = { kcal: Math.max(0, effectiveKcal - (dayPlan.totals?.kcal || 0)), p: Math.max(0, effectiveP - (dayPlan.totals?.p || 0)), f: Math.max(0, effectiveF - (dayPlan.totals?.f || 0)), c: Math.max(0, effectiveC - (dayPlan.totals?.c || 0)) }; const futureMeals = dayPlan.meals.filter((m: any) => !m.label.includes('Завтрак') && !m.label.includes('Предтрен')); if (futureMeals.length === 0) return; const perMeal = { kcal: Math.round(remaining.kcal / futureMeals.length), p: Math.round(remaining.p / futureMeals.length), f: Math.round(remaining.f / futureMeals.length), c: Math.round(remaining.c / futureMeals.length) }; setDayPlan((prev: any) => { if (!prev) return prev; const meals = prev.meals.map((m: any) => { if (m.label.includes('Завтрак') || m.label.includes('Предтрен')) return m; const ratio = Math.max(0.3, Math.min(1.7, perMeal.kcal / Math.max(1, m.totals?.kcal || 1))); const items = m.items.map((it: any) => ({ ...it, amount: Math.round(it.amount * ratio), kcal: Math.round(it.kcal * ratio), p: Math.round(it.p * ratio), f: Math.round(it.f * ratio), c: Math.round(it.c * ratio) })); const totals = { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) }; return { ...m, items, totals }; }); const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); };

  const [mealPrepPlan, setMealPrepPlan] = useState<{ steps: MealPrepStep[]; totalTime: number; containers: number } | null>(null);
  const [mealPrepDays, setMealPrepDays] = useState<1 | 3 | 7>(1);

  const generateMealPrep = () => {
    const src = mealPrepDays === 1 ? dayPlan : mealPrepDays === 3 ? threeDayPlan : weekPlan;
    if (!src) { generatePlan(mealPrepDays as 1|3|7); return; }
    const days = mealPrepDays === 1 ? [src] : src?.days || [src]; if (!days || days.length === 0) return;
    const steps: MealPrepStep[] = []; let stepNum = 1;
    const allItems = days.flatMap((d: any) => d.meals.flatMap((m: any) => m.items.map((it: any) => ({ ...it, mealLabel: m.label, mealTime: m.time }))));
    const uniqueItems = [...new Map(allItems.map((it: any) => [it.name, it])).values()];
    const n = (name: string) => name?.toLowerCase() || '';

    // ─── Фаза 1: Mise en place ───
    // Подготовка всех ингредиентов перед термообработкой
    const allNames = uniqueItems.map((it: any) => n(it.name));
    const hasOven = allNames.some(x => x.includes('лосос')||x.includes('форел')||x.includes('запеч')||x.includes('стейк')||x.includes('голяш')||x.includes('минт')||x.includes('батат')||x.includes('картоф'));
    const hasSimmer = allNames.some(x => x.includes('суп')||x.includes('бульон')||x.includes('туш')||x.includes('карри')||x.includes('болонь'));
    const hasPan = allNames.some(x => x.includes('куриц')||x.includes('индейк')||x.includes('говядин')||x.includes('котл')||x.includes('фарш')||x.includes('печен')||x.includes('гриб')||x.includes('шампиньон'));
    const hasBoilGrain = allNames.some(x => x.includes('рис')||x.includes('гречк')||x.includes('булгур')||x.includes('киноа')||x.includes('кус-кус')||x.includes('перловк')||x.includes('пшен')||x.includes('чечевиц')||x.includes('маш')||x.includes('нут')||x.includes('паст')||x.includes('макар')||x.includes('лапш'));
    const hasFreshVeg = allNames.some(x => x.includes('огурец')||x.includes('помидор')||x.includes('салат')||x.includes('руккол')||x.includes('шпинат')||x.includes('зелен'));
    const hasRawPrep = allNames.some(x => x.includes('брокколи')||x.includes('цветная капуст')||x.includes('морков')||x.includes('кабач')||x.includes('спарж')||x.includes('перец болгар')||x.includes('капуст')||x.includes('цукин')||x.includes('баклаж'));
    const hasMarinate = allNames.some(x => x.includes('куриц')||x.includes('индейк')||x.includes('говядин')||x.includes('свинин')||x.includes('баранин'));
    const hasCottageCheese = allNames.some(x => x.includes('творог')||x.includes('рикотт'));
    const hasBoiledEgg = allNames.some(x => x.includes('яйц')||x.includes('яич')||x.includes('омлет'));

    // 1. Mise en place — подготовка
    const miseItems: string[] = [];
    if (hasFreshVeg) miseItems.push('Овощи: вымыть, обсушить, нарезать');
    if (hasRawPrep) miseItems.push('Термообрабатываемые овощи: вымыть, нарезать кубиками/соломкой');
    if (hasPan || hasOven) miseItems.push('Мясо/рыбу: обсушить бумажными полотенцами');
    if (hasBoilGrain) miseItems.push('Крупы/бобовые: отмерить, промыть до прозрачной воды');
    if (hasCottageCheese) miseItems.push('Творог: откинуть на сито, если влажный');
    if (hasBoiledEgg) miseItems.push('Яйца: достать заранее — комнатной температуры равномернее готовятся');
    if (miseItems.length > 0) steps.push({ step: stepNum++, action:'🔪 Mise en place — подготовка ингредиентов', duration:15, items: miseItems });

    // 2. Поставить замачиваться бобовые / крупы
    const pulseItems = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('маш')||x.includes('нут сух')||x.includes('чечевиц'); });
    if (pulseItems.length > 0) steps.push({ step: stepNum++, action:'Замочить бобовые в холодной воде (1:3) на 2+ ч', duration:5, items: pulseItems.map((p:any) => `${p.name} — залить водой 1:3, щепотка соды`), items_standby: true });

    // 3. Поставить разогреваться духовку
    if (hasOven) steps.push({ step: stepNum++, action:'🔥 Разогреть духовку до 190°C', duration:3, items:['Верх-низ без конвекции', 'Противень внутри для равномерного прогрева'], items_parallel: true });

    // ─── Фаза 2: Термообработка (параллельные треки) ───
    // Трек A — крупы/гарниры
    const grains = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('рис')||x.includes('гречк')||x.includes('булгур')||x.includes('киноа')||x.includes('кус-кус')||x.includes('перловк')||x.includes('пшен')||x.includes('чечевиц')||x.includes('нут'); });
    if (grains.length > 0) {
      const grainSteps = grains.map((g: any) => {
        const gn = n(g.name);
        if (gn.includes('гречк')) return `${g.name}: промыть, залить водой 1:2, варить 12 мин, укутать полотенцем на 10 мин`;
        if (gn.includes('киноа')) return `${g.name}: промыть, залить водой 1:2, варить 15 мин, дать постоять 5 мин под крышкой`;
        if (gn.includes('кус-кус')) return `${g.name}: залить кипятком 1:1.5, накрыть, настоять 5 мин, разрыхлить вилкой`;
        if (gn.includes('перловк')) return `${g.name}: промыть, залить водой 1:3, варить 40 мин, слить лишнее`;
        if (gn.includes('булгур')) return `${g.name}: залить кипятком 1:1.5, накрыть, настоять 12 мин`;
        if (gn.includes('нут')) return `${g.name}: отварить 40-50 мин (если сухой) или прогреть 5 мин (консервированный)`;
        if (gn.includes('чечевиц')) return `${g.name}: промыть, залить водой 1:2.5, варить 15-20 мин до мягкости, не переваривать`;
        if (gn.includes('овсянк')||gn.includes('овсян')) return `${g.name}: залить молоком/водой 1:3, варить 5 мин помешивая, снять с огня, накрыть на 2 мин`;
        return `${g.name}: варить согласно инструкции на упаковке, промыть, заправить маслом`;
      });
      steps.push({ step: stepNum++, action:'🍚 Гарниры: крупы и бобовые', duration:40, items: grainSteps, items_can_boil_simultaneously: true });
    }

    // Трек B — мясо/рыба (параллельно)
    const meats = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('куриц')||x.includes('индейк')||x.includes('говядин')||x.includes('лосос')||x.includes('форел')||x.includes('треск')||x.includes('минт')||x.includes('хека')||x.includes('телят')||x.includes('язык')||x.includes('печен')||x.includes('сердц'); });
    if (meats.length > 0) {
      const meatSteps = meats.map((m: any) => {
        const mn = n(m.name);
        if (mn.includes('лосос')||mn.includes('форел')) return `${m.name}: обсушить, сбрызнуть лимоном+маслом, 4 мин на стороне на сильном огне (кожа хрустящая) или запечь 15 мин при 190°C`;
        if (mn.includes('стейк')||mn.includes('говядин')&&!mn.includes('фарш')&&!mn.includes('печен')) return `${m.name}: достать за 30 мин до готовки (комнатная темп.), промокнуть, соль+перец — на раскалённую сковороду, 4 мин сторона medium rare, 6 мин — medium, отдохнуть 5 мин под фольгой`;
        if (mn.includes('куриц')||mn.includes('индейк')) return `${m.name}: нарезать кубиками 2-3 см, обжарить партиями по 4 мин до золотистой корочки, не перегружать сковороду`;
        if (mn.includes('печен')) return `${m.name}: промыть, удалить протоки, обжарить с луком 5 мин на сильном огне, затем 3 мин под крышкой на среднем`;
        if (mn.includes('фарш')) return `${m.name}: обжарить на сильном огне, разбивая лопаткой, 6 мин до выпаривания жидкости, затем добавить лук/специи`;
        return `${m.name}: нарезать поперёк волокон, обжарить партиями по 3-4 мин`;
      });
      steps.push({ step: stepNum++, action:'🥩 Белковая часть: мясо/рыба', duration:25, items: meatSteps });
    }

    // Трек C — овощи, требующие термообработки
    const hotVeg = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('брокколи')||x.includes('цветная капуст')||x.includes('брюссель')||x.includes('спарж')||x.includes('фасол стручк'); });
    if (hotVeg.length > 0) steps.push({ step: stepNum++, action:'🥦 Овощи: бланшировать', duration:8, items: hotVeg.map((v:any)=>`${v.name}: бланшировать в подсоленном кипятке 2-3 мин, затем в ледяную воду (сохранить цвет и текстуру)`) });

    // Запечённые овощи/корнеплоды
    const rootVeg = uniqueItems.filter((it: any) => { const x = n(it.name); return (x.includes('батат')||x.includes('картоф')||x.includes('морков')||x.includes('тыкв')||x.includes('свёкл')||x.includes('кабач')||x.includes('баклаж')) && !x.includes('пюре'); });
    if (rootVeg.length > 0) steps.push({ step: stepNum++, action:'🌿 Корнеплоды: нарезать и запечь', duration:8, items: rootVeg.map((v:any)=>`${v.name}: нарезать кубиками/дольками 2см, сбрызнуть маслом, соль+розмарин, запечь 25-30 мин при 200°C`), items_parallel: true });

    // Трек D — соусы/заправки
    const hasSauce = allNames.some(x => x.includes('соус')||x.includes('песто')||x.includes('сметан')||x.includes('сливк')||x.includes('йогурт греч')||x.includes('заправк')||x.includes('томат паст'));
    if (hasSauce) steps.push({ step: stepNum++, action:'🧂 Соусы и заправки', duration:6, items: ['Готовить с вечера — вкус раскрывается за 8-12 ч в холодильнике', 'Сметанные/йогуртовые — хранить отдельно, смешивать перед подачей', 'Томатные — тушить 10 мин минимум для раскрытия ликопина'] });

    // ─── Фаза 3: Сборка ───
    // Свежие овощи (без термообработки)
    const freshVegItems = uniqueItems.filter((it: any) => { const x = n(it.name); return x.includes('огурец')||x.includes('помидор')||x.includes('салат')||x.includes('руккол')||x.includes('зелен'); });
    if (freshVegItems.length > 0) steps.push({ step: stepNum++, action:'🥗 Свежие овощи и зелень', duration:8, items: freshVegItems.map((v:any)=>`${v.name}: нарезать непосредственно перед сборкой, не хранить в нарезке дольше 24ч`) });

    // ─── Фаза 4: Охлаждение и фасовка ───
    const mealCount = days[0]?.meals?.length || 4;
    steps.push({ step: stepNum++, action:'🧊 Охладить до комнатной температуры (20 мин, не убирать горячее в холодильник!)', duration:1, items:['Разложить на решётке/разделочной доске', 'Накрыть чистым полотенцем'] });
    steps.push({ step: stepNum++, action:'📦 Разложить по контейнерам', duration:15, items:[
      `${mealCount} приёмов × ${mealPrepDays} дн = ${mealCount * mealPrepDays} контейнеров`,
      'Плотно утрамбовать — меньше воздуха = дольше свежесть',
      'Соус/заправку — в отдельный мини-контейнер',
      'Зелень и авокадо — добавлять утром перед едой',
    ]});
    steps.push({ step: stepNum++, action:'🏷️ Маркировка и хранение', duration:5, items:[
      `Каждый контейнер: день+приём (например: «ПН обед»)`,
      'Холодильник +2...+4°C — срок хранения 72ч (3 суток)',
      'Морозилка -18°C — срок хранения до 3 мес',
      'Разморозка: в холодильнике 12ч, не в микроволновке',
    ]});

    // ─── Фаза 5: Инструкции по разогреву ───
    steps.push({ step: stepNum++, action:'♨️ Разогрев перед едой', duration:2, items:[
      '🍚 Крупы: в микроволновке 2 мин с крышкой + 1 ст.л. воды',
      '🥩 Мясо/рыба: на сковороде 3 мин с каплей воды под крышкой (не микроволновка — сушит)',
      '🥦 Овощи: на пару 2 мин или микроволновка 1.5 мин',
      '❌ Не разогревать повторно — только разовая порция',
    ]});

    setMealPrepPlan({ steps, totalTime: steps.reduce((s, st) => s + st.duration, 0), containers: mealCount * mealPrepDays });
  };

  const [activeReports, setActiveReports] = useState<string[]>([]);
  const [allergenReport, setAllergenReport] = useState<any>(null);
  const [nutrientReport, setNutrientReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<any>(null);
  const [drugCompatReport, setDrugCompatReport] = useState<any>(null);
  const [nutritionReport, setNutritionReport] = useState<any>(null);

  const generateAllergenReport = () => { if (!dayPlan) return; const conflicts: any[] = []; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (food?.allergens) { const matched = food.allergens.filter((a: string) => allergens.includes(a)); if (matched.length > 0) conflicts.push({ food: it.name, allergens: matched }); } }); const riskLevel = conflicts.length === 0 ? 'low' : conflicts.length <= 3 ? 'medium' : 'high'; setAllergenReport({ conflicts, riskLevel, summary: conflicts.length === 0 ? '✅ Нет совпадений' : `⚠ ${conflicts.length} совпадений` }); setActiveReports(prev => prev.includes('allergen') ? prev : [...prev, 'allergen']); };
  const generateNutrientReport = () => { if (!dayPlan) return; const micros: Record<string, number> = {}; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (food?.micros) Object.entries(food.micros).forEach(([k, v]) => { if (v) micros[k] = (micros[k] || 0) + (v as number) * (it.amount / 100); }); }); const targets: Record<string, number> = { Ca:1000,Fe:18,Mg:400,Zn:15,K:3500,Se:55,VitC:100,VitD:15,VitB12:2.4,Omega3:1.6 }; const results: Record<string, any> = {}; const gaps: string[] = []; Object.entries(targets).forEach(([k, t]) => { const actual = Math.round((micros[k]||0)*10)/10; const pct = Math.round(actual/t*100); results[k] = { actual, target: t, pct, status: pct>=80?'ok':pct>=50?'low':'critical' }; if (pct < 80) gaps.push(`${k}: ${actual} из ${t} (${pct}%)`); }); setNutrientReport({ micros: results, gaps: gaps.length === 0 ? ['✅ Все в норме'] : gaps }); setActiveReports(prev => prev.includes('nutrient') ? prev : [...prev, 'nutrient']); };
  const generateQualityReport = () => { if (!dayPlan) return; const scores: any[] = []; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (!food) return; let score = 5; const pd = (food.protein*4)/Math.max(food.kcal,1); if (pd > 0.6) score += 2; else if (pd > 0.3) score += 1; if ((food.fiber||0)>=3) score += 1; if (food.tier === 'max') score = 10; else if (food.tier === 'mid') score = Math.max(score,8); else if (food.tier === 'basic') score = Math.max(score,6); scores.push({ name: it.name, score: Math.min(10, score), bbs: food.bb_quality_score || 0, category: food.category }); }); const avg = Math.round(scores.reduce((s,x)=>s+x.score,0)/Math.max(1,scores.length)*10)/10; const bbsAvg = Math.round(scores.reduce((s,x)=>s+x.bbs,0)/Math.max(1,scores.length)*10)/10; const sorted = [...scores].sort((a,b)=>b.score-a.score); const budgetRange = budget === 'low' ? '★1-5' : budget === 'medium' ? '★5-8' : budget === 'max' ? '★8-10' : '★9-10'; const budgetOk = (budget === 'low' && bbsAvg <= 5) || (budget === 'medium' && bbsAvg >= 5 && bbsAvg <= 8) || ((budget === 'max' || budget === 'enhanced') && bbsAvg >= 8); setQualityReport({ avgScore: avg, bbsAvg, budget, budgetRange, budgetOk, bestItems: sorted.filter(s=>s.score>=8).map(s=>s.name).slice(0,5), weakItems: sorted.filter(s=>s.score<=5).map(s=>s.name).slice(0,5), recommendations: !budgetOk ? [`Бюджет «${budget}» (${budgetRange}), а средний bb_quality_score рациона ${bbsAvg}. ${budget==='low'?'Снизьте бюджет или повысьте качество.':(budget==='max'||budget==='enhanced')?'Выберите более дешёвые продукты или повысьте бюджет.':'Настройте бюджет под качество.'}`] : avg<6 ? ['Повысьте качество продуктов, увеличьте бюджет'] : avg>=8 ? [`✅ Отлично! Средний bb_quality_score ${bbsAvg} соответствует бюджету ${budgetRange}.`] : [] }); setActiveReports(prev => prev.includes('quality') ? prev : [...prev, 'quality']); };
  const generateRiskReport = () => { if (!dayPlan) return; const systems: Record<string, any> = {}; const allItems = dayPlan.meals.flatMap((m: any)=>m.items); const totalFat = allItems.reduce((s:number,it:any)=>s+(it.f||0),0); const totalKcal = allItems.reduce((s:number,it:any)=>s+(it.kcal||0),0); const fatPct = totalKcal>0?totalFat*9/totalKcal*100:0; systems.hepatic = { score: fatPct>40?7:fatPct>30?5:fatPct>20?3:1, impact: fatPct>35?'Высокожировая':'Умеренные', recommendation: fatPct>35?'Снизить жиры до 25-30%':'Норма' }; const proteinGPerKg = Math.round((allItems.reduce((s:number,it:any)=>s+(it.p||0),0)/weight)*10)/10; systems.renal = { score: proteinGPerKg>3?7:proteinGPerKg>2.5?5:proteinGPerKg>2?3:1, impact: `${proteinGPerKg.toFixed(1)} г/кг`, recommendation: proteinGPerKg>2.5?'Контроль белка':'Норма' }; const totalScore = Object.values(systems).reduce((s:number,sys:any)=>s+sys.score,0); setRiskReport({ systems, totalRisk: totalScore<=8?'Низкий':totalScore<=14?'Средний':'Высокий', summary: totalScore<=8?'✅ Рацион сбалансирован':totalScore<=14?'⚠ Есть зоны для улучшения':'🔴 Требуется коррекция' }); setActiveReports(prev => prev.includes('risk')?prev:[...prev,'risk']); };
  const generateDrugCompatReport = () => { if (!dayPlan || injections.length === 0) return; const warnings: string[] = []; const allItems = dayPlan.meals.flatMap((m: any) => m.items); const allFoodNames = allItems.map((it: any) => ({ id: it.id, name: it.name?.toLowerCase() || '' })).join(' ');
  injections.forEach(inj => {
    const t = inj.type?.toLowerCase() || '';
    const name = inj.name?.toLowerCase() || '';
    // Insulin + carbs
    if (t.includes('инсулин')) { const totalCarbs = dayPlan.totals.c || 0; if (totalCarbs < 150) warnings.push(`💉 ${inj.name}: ${Math.round(totalCarbs)}г угл/день — риск гипогликемии. Минимум 150г.`); }
    // GLP-1 + high fat
    if (t.includes('семаглутид') || t.includes('тирзепатид')) { const totalFat = dayPlan.totals.f || 0; if (totalFat > weight * 0.6) warnings.push(`💊 ${inj.name}: жиры ${totalFat}г/день — риск тошноты/панкреатита при GLP-1. Ограничьте до ${Math.round(weight*0.5)}г.`); }
  });
  // 🔴3 — Drug-nutrient interaction checker (8 pairs)
  if (takenSupplements.some(s => s.includes('statin') || s.includes('atorva') || s.includes('rosuva') || s.includes('simva'))) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('💊 Статины + грейпфрут: ингибирование CYP3A4 → риск рабдомиолиза. Исключите грейпфрут!');
  }
  if (takenSupplements.some(s => s.includes('warfarin') || s.includes('варфарин'))) {
    if (/шпинат|капуст|брокколи|зелен|spinach|kale|broccoli|cabbage|green/i.test(allFoodNames)) warnings.push('💊 Варфарин + витамин K (зелень/капуста): снижение INR → риск тромбоза. Контролируйте потребление зелени.');
  }
  if (takenSupplements.some(s => s.includes('enalapril') || s.includes('lisino') || s.includes('ramipril') || s.includes('telmisartan') || s.includes('losartan'))) {
    if (/банан|картоф|шпинат|авокадо|томат|potato|banana|spinach|avocado|tomato/i.test(allFoodNames)) warnings.push('💊 ACEi/ARB + калий-богатые продукты: риск гиперкалиемии. Ограничьте бананы/картофель/шпинат.');
  }
  if (takenSupplements.some(s => s.includes('metformin') || s.includes('метформин'))) {
    if (/алкогол|пив|вин|водк|alcohol|beer|wine/i.test(allFoodNames)) warnings.push('💊 Метформин + алкоголь: риск лактатацидоза. Исключите алкоголь.');
  }
  if (takenSupplements.some(s => s.includes('nebivolol') || s.includes('metoprolol') || s.includes('bisoprolol') || s.includes('carvedilol'))) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('💊 Бета-блокаторы + грейпфрут: потенцирование гипотензии. Исключите грейпфрут.');
  }
  if (takenSupplements.some(s => s.includes('maoi') || s.includes('phenelzine') || s.includes('tranylcypromine'))) {
    if (/сыр|колбас|сосис|ветчин|копч|вялен|cheese|sausage|cured|smoked/i.test(allFoodNames)) warnings.push('💊 MAOI + тирамин (сыр/копчёности): риск гипертонического криза! Исключите выдержанные сыры и копчёности.');
  }
  if (takenSupplements.some(s => s.includes('finasteride') || s.includes('dutasteride') || s.includes('финастерид'))) {
    warnings.push('💊 Финастерид/Дутастерид: избегать контакта беременных с препаратом. Хранить отдельно.');
  }
  if (warnings.length === 0) warnings.push('✅ Все препараты совместимы с планом питания');
  setDrugCompatReport({ interactions: [], warnings });
  setActiveReports(prev => prev.includes('drug')?prev:[...prev,'drug']); };
  const generateFullNutritionReport = () => { if (!dayPlan) return; try { const rep = generateNutritionReport({ meals: dayPlan.meals.map((m:any)=>({ label:m.label, items:m.items.map((i:any)=>({name:i.name||'',id:i.id||'',amount:i.amount||100,kcal:i.kcal||0,p:i.p||0,f:i.f||0,c:i.c||0})), totals:m.totals||{kcal:0,p:0,f:0,c:0}, time:m.time||'' })), totals: dayPlan.totals||{kcal:0,p:0,f:0,c:0}, targets: planTargets, userWeight: getProfileSafe()?.settings?.weight||80, userTDEE: planTargets.kcal, healthIssues, planType, variety, budget, allergens, cyclingMode, goal: getProfileSafe()?.settings?.primaryGoal||'maintenance', waterMl: waterCalc?.total?Math.round(waterCalc.total*1000):0, injections: injections.map(i=>({type:i.type,dose:i.dose,name:i.name,time:i.time})), workoutTime: linkToTraining&&trainingDays.some(Boolean)?trainStart:undefined }); if (rep) { setNutritionReport(rep); setActiveReports(prev=>prev.includes('nutrition')?prev:[...prev,'nutrition']); try { const arch = JSON.parse(localStorage.getItem('he_nutrition_report_archive')||'[]'); arch.unshift(rep); localStorage.setItem('he_nutrition_report_archive', JSON.stringify(arch.slice(0,50))); localStorage.setItem('he_nutrition_report_current', JSON.stringify(rep)); try { localStorage.setItem('he_profile_nutrition_reports', JSON.stringify(arch.slice(0,20))); } catch {} } catch {} } } catch(e) { console.error('Report failed:', e); } };

  const renderMealList = (dayData: any, editable = false) => {
    if (!dayData) return null;
    const d = dayData; const totalKcal = Math.round(d.totals?.kcal || 0); const totalP = Math.round(d.totals?.p || 0); const totalF = Math.round(d.totals?.f || 0); const totalC = Math.round(d.totals?.c || 0);
    const pKcalPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0; const fKcalPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0; const cKcalPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
    return (
      <div>
        <div style={{marginBottom:10,borderRadius:12,overflow:'hidden',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{padding:'10px 12px',background:d.isTrainingDay?'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,200,160,0.03))':'#202023'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:20,filter:d.isTrainingDay?'none':'grayscale(0.5)'}}>{d.isTrainingDay?'🏋️':'😴'}</span>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,color:d.isTrainingDay?'#00e68a':'rgba(255,255,255,0.85)'}}>{d.isTrainingDay?'🏆 ТРЕНИРОВОЧНЫЙ ДЕНЬ':'😴 ДЕНЬ ОТДЫХА'}</div>
              {weightLogEntries.length >= 3 && (() => { const vals = weightLogEntries.map(e => e.weight); const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1; const h = 24; const w = 80; const pts = vals.map((v,i) => `${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v-min)/range*h)}`).join(' '); const trend = vals.length >= 2 && vals[vals.length-1] < vals[0]; return (<div style={{display:'inline-flex',alignItems:'center',gap:3,marginLeft:6}}><svg width={w} height={h} style={{verticalAlign:'middle'}}><polyline points={pts} fill="none" stroke={trend?'#22c55e':'#ef4444'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg><span style={{fontSize:7,color:trend?'#22c55e':'#ef4444',fontWeight:600}}>{trend?'↓':'↑'} {Math.abs(vals[vals.length-1]-vals[0]).toFixed(1)} кг</span></div>); })()}</div>
              <div style={{padding:'4px 10px',borderRadius:8,background:d.isTrainingDay?'rgba(0,230,138,0.1)':'rgba(255,255,255,0.03)',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:16,fontWeight:900,color:Math.abs(totalKcal-(effectiveKcal||0))<=Math.max(50,(effectiveKcal||0)*0.08)?'#00e68a':'#f59e0b',lineHeight:1}}>{totalKcal}<span style={{fontSize:8,fontWeight:400,color:'rgba(255,255,255,0.5)'}}>/{effectiveKcal||'---'}</span></div>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.85)',textAlign:'center'}}>ккал</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,fontSize:9}}>
              <span style={{color:'#3b82f6',fontWeight:600}}>💪 {totalP}г/{effectiveP||'—'} <span style={{fontSize:7,color:effectiveP?Math.abs(totalP-(effectiveP||0))<=5?'#22c55e':'#f59e0b':'rgba(255,255,255,0.5)'}}>{effectiveP>0?'('+Math.round(totalP/(effectiveP||1)*100)+'%)':''}</span></span>
              <span style={{color:'#f59e0b',fontWeight:600}}>🧈 {totalF}г/{effectiveF||'—'}</span>
              <span style={{color:'#f97316',fontWeight:600}}>🌾 {totalC}г/{effectiveC||'—'}</span>
              <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.85)'}}>{weight>0?`${Math.round(totalP/weight)}г/кг`:''}</span>
            </div>
          </div>
          <div style={{height:4,display:'flex'}}>
            <div style={{height:'100%',width:`${Math.max(2,pKcalPct)}%`,background:'#3b82f6',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,fKcalPct)}%`,background:'#f59e0b',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,cKcalPct)}%`,background:'#f97316',minWidth:2,flex:1}}/>
          </div>
        </div>
        {d.allergenWarnings?.length > 0 && <div style={{padding:'6px 10px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:8,color:'#ef4444',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:10}}>⚠️</span><span>{d.allergenWarnings.map((w: any) => typeof w === 'string' ? w : `${w.food}: ${w.allergens.join(', ')}`).join('; ')}</span></div>}
        {d.meals.map((m: any, mi: number) => {
          const mealKcal = Math.round(m.totals?.kcal || 0); const mealP = Math.round(m.totals?.p || 0); const mealF = Math.round(m.totals?.f || 0); const mealC = Math.round(m.totals?.c || 0);
          const mealDiaas = calcMealDIAAS((m.items || []).map((it: any) => ({ foodId: it.id || it.name, weightGrams: it.amount || 100 })));
          const isPreWorkout = m.label?.toLowerCase().includes('предтрен'); const isPostWorkout = m.label?.toLowerCase().includes('пост-трен'); const accentColor = isPreWorkout ? '#8b5cf6' : isPostWorkout ? '#f59e0b' : '#00e68a';
          return (
            <div key={mi} style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:`1px solid ${dropTarget===mi?'rgba(0,230,138,0.4)':isPreWorkout?'rgba(139,92,246,0.2)':isPostWorkout?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,transition:'all 0.2s',background:dropTarget===mi?'rgba(0,230,138,0.04)':undefined}}
              onDragOver={e=>{e.preventDefault();setDropTarget(mi);}} onDragLeave={()=>setDropTarget(null)} onDrop={e=>{e.preventDefault();if(draggedItem&&draggedItem.mealIdx!==mi)moveFoodItem(draggedItem.mealIdx,mi,draggedItem.itemIdx);setDropTarget(null);}}>
              <div style={{padding:'7px 10px 5px',background:isPreWorkout?'rgba(139,92,246,0.06)':isPostWorkout?'rgba(245,158,11,0.06)':'#202023',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{m.time}</span>
                  <span style={{width:3,height:12,borderRadius:2,background:accentColor}}/>
                  <span style={{fontSize:10,fontWeight:700,color:accentColor}}>{m.label}</span>
                  {isPreWorkout&&<span style={{fontSize:7,padding:'1px 5px',borderRadius:4,background:'rgba(139,92,246,0.15)',color:'#a855f7',fontWeight:600}}>ДО</span>}
                  {isPostWorkout&&<span style={{fontSize:7,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,0.15)',color:'#f59e0b',fontWeight:600}}>ПОСЛЕ</span>}
                  {d.timingScores?.[mi] && (
                    <span style={{fontSize:7,padding:'1px 5px',borderRadius:4,fontWeight:600,
                      background:d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.1)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.08)',
                      color:d.timingScores[mi].status==='ideal'?'#22c55e':d.timingScores[mi].status==='good'?'#f59e0b':'#ef4444',
                      border:`1px solid ${d.timingScores[mi].status==='ideal'?'rgba(34,197,94,0.2)':d.timingScores[mi].status==='good'?'rgba(245,158,11,0.2)':'rgba(239,68,68,0.12)'}`}}
                      title={d.timingScores[mi].note}
                    >★{d.timingScores[mi].score}/10</span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{mealKcal} ккал</span>
                  <span onClick={()=>setRecipePickerMeal({dayIdx:0,mealIdx:mi,label:m.label})} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🍳</span>
                  <span onClick={()=>{setQuickAddMealIdx(mi);setQuickAddSearch('');}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontWeight:600}}>+</span>
                  <span onClick={()=>{saveUndo();const copy=JSON.parse(JSON.stringify(dayPlan?.meals?.[mi]));if(!copy)return;setDayPlan((prev:any)=>{if(!prev)return prev;const meals=[...prev.meals];const insertAt=Math.min(mi+1,meals.length);const dup={...copy,label:copy.label+' (копия)',time:(()=>{const[h,m]=(copy.time||'12:00').split(':').map(Number);const t=h*60+m+30;return`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`})()};meals.splice(insertAt,0,dup);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',color:'#818cf8',cursor:'pointer',fontWeight:600}}>📋</span>
                  <span onClick={()=>{saveUndo();setDayPlan((prev:any)=>{if(!prev)return prev;const meals=prev.meals.filter((_:any,i:number)=>i!==mi);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.12)',color:'#ef4444',cursor:'pointer',fontWeight:600}}>✕</span>
                </div>
              </div>
              <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{m.items.map((it:any,ii:number)=>{const isEditing=editItem?.mealIdx===mi&&editItem?.itemIdx===ii;const isReplacing=replacingItem?.mealIdx===mi&&replacingItem?.itemIdx===ii;return<span key={ii} draggable={!isEditing&&!isReplacing} onDragStart={e=>{e.dataTransfer.setData('text/plain',`${mi}:${ii}`);setDraggedItem({mealIdx:mi,itemIdx:ii});}} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:isEditing?'rgba(59,130,246,0.08)':isReplacing?'rgba(245,158,11,0.08)':'#202023',border:`1px solid ${isEditing?'rgba(59,130,246,0.2)':isReplacing?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,cursor:'grab',color:'#fff',display:'inline-flex',alignItems:'center',gap:3,flexWrap:'wrap'}}>
                    {isEditing?<><input type="number" defaultValue={it.amount} onChange={e=>setEditAmount(+e.target.value||0)} style={{width:40,padding:'1px 4px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',fontSize:8}}/><span style={{fontSize:7,color:'rgba(255,255,255,0.85)'}}>г</span><button onClick={()=>setEditAmount(prev=>Math.round((prev||it.amount)+25))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(59,130,246,0.2)',background:'rgba(59,130,246,0.08)',color:'#60a5fa',cursor:'pointer',fontSize:6}}>+25</button><button onClick={()=>setEditAmount(prev=>Math.round((prev||it.amount)*2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(139,92,246,0.2)',background:'rgba(139,92,246,0.08)',color:'#a78bfa',cursor:'pointer',fontSize:6}}>×2</button><button onClick={()=>setEditAmount(prev=>Math.round((prev||it.amount)/2))} style={{padding:'1px 3px',borderRadius:3,border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.08)',color:'#f59e0b',cursor:'pointer',fontSize:6}}>÷2</button><button onClick={()=>updateItemAmount(0,mi,ii,editAmount||it.amount)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontSize:7}}>✓</button><button onClick={()=>setEditItem(null)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(239,68,68,0.1)',color:'#ef4444',cursor:'pointer',fontSize:7}}>✕</button></>
                    :isReplacing?<><span style={{fontWeight:600}}>{it.name}</span><select onChange={e=>{if(e.target.value){const f=FOOD_DB.find(x=>x.id===e.target.value);if(f)replaceFoodItem(0,mi,ii,f);}}} value="" style={{fontSize:7,padding:'1px 2px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',maxWidth:120}}><option value="">🔀 Заменить...</option>{findSimilarFoods(it).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></>
                    :<><span style={{fontWeight:600}}>{it.name}</span>{preferredFoods.includes(it.id)&&<span style={{fontSize:7,color:'#00e68a',padding:'0 1px'}} title="Любимый продукт">⭐</span>}<span style={{color:'rgba(255,255,255,0.9)',fontSize:8}}>{it.amount}г</span>{lockedFoodIds.has(it.id)&&<span style={{fontSize:7,color:'#f59e0b',padding:'0 2px'}} title="Закреплено — не изменится при регенерации">🔒</span>}<span onClick={()=>addToCart({name:it.name,kcal:it.kcal*(it.amount/100),amount:it.amount,category:it.category})} style={{cursor:'pointer',fontSize:7,color:'#00e68a',opacity:0.35,padding:'0 2px'}}>🛒</span><span onClick={()=>toggleLockFood(it.id)} style={{cursor:'pointer',fontSize:7,color:lockedFoodIds.has(it.id)?'#f59e0b':'rgba(255,255,255,0.4)',padding:'0 2px'}} title={lockedFoodIds.has(it.id)?'Открепить':'Закрепить (не изменится при регенерации)'}>{lockedFoodIds.has(it.id)?'🔓':'🔒'}</span><span onClick={()=>{setEditItem({dayIdx:0,mealIdx:mi,itemIdx:ii});setEditAmount(it.amount);}} style={{cursor:'pointer',fontSize:7,color:'rgba(255,255,255,0.8)',padding:'0 2px'}}>✏️</span><span onClick={()=>setReplacingItem({dayIdx:0,mealIdx:mi,itemIdx:ii})} style={{cursor:'pointer',fontSize:7,color:'rgba(245,158,11,0.4)',padding:'0 2px'}}>🔄</span><span onClick={()=>removeFoodItem(0,mi,ii)} style={{cursor:'pointer',fontSize:7,color:'rgba(239,68,68,0.3)',padding:'0 2px'}}>✕</span></>}
                  </span>;})}</div>
                {m.totals&&<div style={{display:'flex',gap:6,marginTop:4,fontSize:8,alignItems:'center',flexWrap:'wrap'}}><span style={{color:'#3b82f6',fontWeight:600}}>Б {mealP}г</span><span style={{color:'#f59e0b',fontWeight:600}}>Ж {mealF}г</span><span style={{color:'#f97316',fontWeight:600}}>У {mealC}г</span>{mealDiaas.diaas > 0 && <span style={{fontSize:7,fontWeight:600,color:mealDiaas.diaas >= 1 ? '#22c55e' : mealDiaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444',background:(mealDiaas.diaas >= 1 ? 'rgba(34,197,94,0.08)' : mealDiaas.diaas >= 0.75 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)') + ' none repeat scroll 0% 0%',padding:'1px 5px',borderRadius:4}}>DIAAS {mealDiaas.diaas.toFixed(2)}</span>}{m.synergyNotes&&m.synergyNotes.length>0&&<span style={{fontSize:7,color:'#22c55e',fontWeight:600}} title={m.synergyNotes.join('; ')}>✅ {(m.synergyNotes as string[]).length} синерги{((m.synergyNotes as string[]).length>1?'й':'я')}</span>}{m.conflictWarnings&&m.conflictWarnings.length>0&&<span style={{fontSize:7,color:'#ef4444',fontWeight:600}} title={m.conflictWarnings.join('; ')}>⚠️ {(m.conflictWarnings as string[]).length} конфликт{((m.conflictWarnings as string[]).length>1?'ов':'')}</span>}</div>}
                {quickAddMealIdx === mi && (
                  <div style={{padding:'4px 10px 8px',background:'#18181b',borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                    <input value={quickAddSearch} onChange={e=>setQuickAddSearch(e.target.value)} placeholder="Поиск продукта..." autoFocus style={{width:'100%',padding:'4px 8px',borderRadius:6,border:'1px solid rgba(0,230,138,0.2)',background:'#202023',color:'#fff',fontSize:9,marginBottom:4}} />
                    <div style={{maxHeight:120,overflowY:'auto',display:'flex',flexWrap:'wrap',gap:3}}>
                      {(() => {
                        const raw = FOOD_DB.filter(f => !quickAddSearch || f.name.toLowerCase().includes(quickAddSearch.toLowerCase())).slice(0, 20);
                        const mealTarget = getMealKBJUTarget(dayPlan, mi);
                        const mealCur = getMealCurrentKBJU(dayPlan, mi);
                        const defaultTarget = mealTarget || { kcal: 600, protein: 40, fat: 20, carbs: 60 };
                        const scored = scoreFoodsForKBJU(raw, defaultTarget, mealCur || undefined, undefined, 10);
                        const sorted = scored.length > 0 ? scored : raw.slice(0, 10).map(f => ({ foodId: f.id, foodName: f.name, matchScore: 0, color: '#00e68a', kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, fiber: f.fiber || 0 }));
                        return sorted.map((r: any) => {
                          const food = FOOD_DB.find((f: any) => f.id === r.foodId);
                          return (
                            <span key={r.foodId} onClick={() => { if (!food) return; setDayPlan((prev: any) => { if (!prev) return prev; const meals = prev.meals.map((m1: any, i: number) => { if (i !== mi) return m1; const items = [...m1.items, { name: food.name, id: food.id, amount: 100, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs }]; const totals = { kcal: items.reduce((s: number, it: any) => s + it.kcal, 0), p: items.reduce((s: number, it: any) => s + it.p, 0), f: items.reduce((s: number, it: any) => s + it.f, 0), c: items.reduce((s: number, it: any) => s + it.c, 0) }; return { ...m1, items, totals }; }); const totals = { kcal: meals.reduce((s: number, m2: any) => s + (m2.totals?.kcal || 0), 0), p: meals.reduce((s: number, m2: any) => s + (m2.totals?.p || 0), 0), f: meals.reduce((s: number, m2: any) => s + (m2.totals?.f || 0), 0), c: meals.reduce((s: number, m2: any) => s + (m2.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); setQuickAddMealIdx(null); setQuickAddSearch(''); }}
                              style={{padding:'3px 6px',borderRadius:4,fontSize:8,background:'#202023',border:'1px solid rgba(0,230,138,0.1)',color:'#fff',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}>
                              {r.foodName}{r.matchScore > 0 && <span style={{fontSize:6,color:r.color,fontWeight:600}}>{r.matchScore}%</span>}
                            </span>
                          );
                        });
                      })()}
                    </div>
                    <button onClick={() => { setQuickAddMealIdx(null); setQuickAddSearch(''); }} style={{marginTop:4,padding:'3px 8px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.04)',color:'#ef4444',cursor:'pointer',fontSize:8,width:'100%'}}>✕ Закрыть</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {d.intraWorkout && (
          <div style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(34,197,94,0.2)'}}>
            <div style={{padding:'7px 10px 5px',background:'rgba(34,197,94,0.05)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{d.intraWorkout.time}</span>
                <span style={{width:3,height:12,borderRadius:2,background:'#22c55e'}}/>
                <span style={{fontSize:10,fontWeight:700,color:'#22c55e'}}>{d.intraWorkout.label}</span>
                <span style={{fontSize:7,padding:'1px 5px',borderRadius:4,background:'rgba(34,197,94,0.12)',color:'#22c55e',fontWeight:600}}>ВО ВРЕМЯ</span>
              </div>
              <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{Math.round(d.intraWorkout.totals?.kcal||0)} ккал</span>
            </div>
            <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {d.intraWorkout.items.map((it: any, ii: number) => (
                  <span key={ii} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:'#202023',border:'1px solid rgba(34,197,94,0.15)',color:'#fff',display:'inline-flex',alignItems:'center',gap:3}}>
                    <span style={{fontWeight:600}}>{it.name}</span><span style={{color:'rgba(255,255,255,0.9)',fontSize:7}}>{it.amount}г</span>
                  </span>
                ))}
              </div>
              {d.intraWorkout.note && <div style={{fontSize:7,color:'rgba(255,255,255,0.5)',marginTop:3}}>{d.intraWorkout.note}</div>}
            </div>
          </div>
        )}
        {d.nutritionLogic && d.nutritionLogic.length > 0 && (
          <details style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(168,85,247,0.15)'}}>
            <summary style={{padding:'7px 10px',background:'rgba(168,85,247,0.04)',cursor:'pointer',fontSize:9,fontWeight:700,color:'#a78bfa',listStyle:'none'}}>🧠 Логика плана: почему выбраны эти продукты</summary>
            <div style={{padding:'8px 10px',background:'rgba(24,24,27,0.6)'}}>
              {d.nutritionLogic.map((nl: any, nli: number) => (
                <div key={nli} style={{marginBottom:4,padding:'4px 8px',borderRadius:6,background:'rgba(168,85,247,0.03)',border:'1px solid rgba(168,85,247,0.06)'}}>
                  <span style={{fontSize:8,fontWeight:700,color:'#c4b5fd'}}>{nl.label}:</span>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:2}}>
                    {nl.rules.map((r: string, ri: number) => (
                      <span key={ri} style={{fontSize:7,color:'rgba(255,255,255,0.6)',background:'rgba(168,85,247,0.06)',padding:'1px 5px',borderRadius:3}}>{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        {d.dietDiversity && (
          <div style={{marginBottom:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(245,158,11,0.15)'}}>
            <div style={{padding:'6px 10px',background:'rgba(245,158,11,0.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:9,fontWeight:700,color:'#f59e0b'}}>🌈 Разнообразие: {d.dietDiversity.uniqueFoods} продуктов</span>
              <span style={{fontSize:7,fontWeight:600,color:d.dietDiversity.score >= 7 ? '#22c55e' : d.dietDiversity.score >= 4 ? '#f59e0b' : '#ef4444'}}>{d.dietDiversity.note}</span>
            </div>
          </div>
        )}
        <div style={{marginTop:8,borderRadius:10,overflow:'hidden',border:'1px solid rgba(0,230,138,0.15)'}}>
          <div style={{padding:'10px 12px',background:'linear-gradient(135deg, rgba(0,230,138,0.06), transparent)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px'}}>ИТОГО ЗА ДЕНЬ</span><span style={{color:'#00e68a',fontWeight:900,fontSize:16}}>{totalKcal} ккал</span></div>
            <div style={{display:'flex',gap:8}}>
              {[{label:'Белки',val:totalP,unit:'г',color:'#3b82f6',target:effectiveP},{label:'Жиры',val:totalF,unit:'г',color:'#f59e0b',target:effectiveF},{label:'Углеводы',val:totalC,unit:'г',color:'#f97316',target:effectiveC}].map(m=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.target)*100));const isOver=pct>100;return(<div key={m.label} style={{flex:1}}><div style={{display:'flex',justifyContent:'space-between',fontSize:8,marginBottom:2}}><span style={{color:m.color,fontWeight:600}}>{m.label}</span><span style={{color:isOver?'#ef4444':'rgba(255,255,255,0.85)',fontWeight:700}}>{m.val}/{m.target}{m.unit}</span></div><div style={{height:5,borderRadius:3,background:'#202023',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:3,background:isOver?'#ef4444':`linear-gradient(90deg, ${m.color}, ${m.color}88)`,transition:'width 0.3s'}}/></div><div style={{fontSize:7,color:isOver?'#ef4444':'rgba(255,255,255,0.85)',textAlign:'right',marginTop:1}}>{isOver?`+${pct-100}%`:`${pct}%`}</div></div>);})}
            </div>
          </div>
        </div>
        {d.meals && (() => { const allItems = d.meals.flatMap((m: any) => (m.items || []).map((it: any) => ({...it, food: FOOD_DB.find((f: any) => f.id === it.id)}))); const calcMicro = (field: string, factor: number) => Math.round(allItems.reduce((s: number, it: any) => s + ((it.food?.micros?.[field] || it.food?.['trace_elements_100g']?.[field] || it.food?.electrolytes_100g?.[field] || 0) * (it.amount||100) / 100), 0)); const micros = [ {label:'Ca',val:calcMicro('Ca',1),rda:1000,unit:'мг'}, {label:'Fe',val:calcMicro('Fe',1),rda:18,unit:'мг'}, {label:'Mg',val:calcMicro('Mg',1),rda:400,unit:'мг'}, {label:'Zn',val:calcMicro('Zn',1),rda:15,unit:'мг'}, {label:'K',val:calcMicro('K',1),rda:3500,unit:'мг'}, {label:'Omega3',val:Math.round(allItems.reduce((s:number,it:any)=>s+((it.food?.macro_100g?.omega_3_mg||it.food?.micros?.Omega3||0)*(it.amount||100)/100),0)),rda:1600,unit:'мг'} ]; const visibleMicros = micros.filter(m => m.val > 0).slice(0, 5); return visibleMicros.length > 0 ? (<div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(34,197,94,0.15)'}}><div style={{padding:'6px 10px',background:'rgba(34,197,94,0.03)'}}><div style={{fontSize:9,fontWeight:700,color:'#22c55e',marginBottom:4}}>🧪 Микронутриенты (покрытие RDA)</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{visibleMicros.map((m,i)=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.rda)*100));return(<div key={i} style={{display:'flex',alignItems:'center',gap:3,fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.1)'}}><span style={{fontWeight:700,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444'}}>{m.label}</span><span style={{color:'rgba(255,255,255,0.7)'}}>{m.val}{m.unit}</span><span style={{fontSize:7,color:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444',fontWeight:600}}>{pct}%</span></div>)})}</div></div></div>) : null; })()}
        {d.supplementTimeline && d.supplementTimeline.length > 0 && (
          <div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(139,92,246,0.2)'}}>
            <div style={{padding:'8px 10px',background:'rgba(139,92,246,0.04)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#a78bfa',marginBottom:6}}>💊 Добавки по времени</div>
              {d.supplementTimeline.map((st: any, si: number) => (
                <div key={si} style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:4,padding:'4px 6px',borderRadius:6,background:'rgba(139,92,246,0.04)'}}>
                  <span style={{fontSize:7,color:'#a78bfa',fontWeight:600,minWidth:32}}>{st.time}</span>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {st.items.map((s: any, ii: number) => (
                      <span key={ii} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.15)',color:'#c4b5fd',fontWeight:600}} title={s.note}>{s.name} {s.dose}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.waterTimeline && d.waterTimeline.length > 0 && (
          <div style={{marginTop:6,borderRadius:10,overflow:'hidden',border:'1px solid rgba(59,130,246,0.2)'}}>
            <div style={{padding:'8px 10px',background:'rgba(59,130,246,0.04)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#60a5fa',marginBottom:6}}>💧 Гидратация (~{d.waterTimeline.reduce((s:number,w:any)=>s+w.ml,0)} мл/день)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {d.waterTimeline.map((w: any, wi: number) => (
                  <span key={wi} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.12)',color:'#93c5fd',fontWeight:600}} title={w.note}>{w.time} — {w.ml}мл</span>
                ))}
              </div>
              {waterCalc?.electrolytes && (
                <div style={{marginTop:6,padding:'5px 8px',borderRadius:6,background:'rgba(59,130,246,0.06)',fontSize:7}}>
                  <span style={{color:'#93c5fd',fontWeight:600}}>⚡ Na {waterCalc.electrolytes.sodiumMg}мг</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#f59e0b',fontWeight:600}}>K {waterCalc.electrolytes.potassiumMg}мг</span>
                  <span style={{margin:'0 6px',color:'rgba(255,255,255,0.15)'}}>|</span>
                  <span style={{color:'#a78bfa',fontWeight:600}}>Mg {waterCalc.electrolytes.magnesiumMg}мг</span>
                  <div style={{color:'rgba(255,255,255,0.5)',marginTop:2}}>{waterCalc.electrolytes.note}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const ctx = useMemo<PlanCtx>(() => ({
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
    injectDrugTypes, calcTargets, profileTargets,
    effectiveKcal, effectiveP, effectiveF, effectiveC,
    kbjuMode, setKbjuMode, switchKbjuMode,
    manualKcal, setManualKcal, manualP, setManualP, manualF, setManualF, manualC, setManualC,
    resultsRef, budget, setBudget, nutrLevel, setNutrLevel,
    variety, setVariety, wakeTime, setWakeTime, bedTime, setBedTime,
    lunchTime, setLunchTime, dinnerTime, setDinnerTime, mealsCount, setMealsCount,
    workFood, setWorkFood, allergens, setAllergens, healthIssues, setHealthIssues,
    eveningLowCarb, setEveningLowCarb, planType, setPlanType,
    preferredFoods, setPreferredFoods, excludedFoods, setExcludedFoods,
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
    toggleAllergen, toggleHealthIssue, loadSavedPlan,
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
    renderMealList,
    customNotes, setCustomNotes,
    dietPrefs, setDietPrefs,
    v2Phase, setV2Phase, v2Labs, setV2Labs, v2Pharma, setV2Pharma,
    histamineSensitive, setHistamineSensitive,
    labAnalysis,
    errorMsg, setErrorMsg,
    useProEngine, setUseProEngine,
    labs,
  }), [weight, height, age, sex, dailySteps, cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, periodizationEnabled, surplusPct, trainType, trainIntensity, householdActivity, bodyFatPct, sleepHours, sleepQuality, stressLevel, cyclePhase, hungerLevel, weightAdaptMode, weightLogWeek, expectedLossKgWeek, showWeightAdaptModal, weightLogEntries, weightLogPeriod, metabolicAdaptEnabled, metabolicAdaptPct, dietPauseMode, manualGPerKg, monthPlanMode, monthPlan, selectedWeek, goal, phase, goalUserSet, injections, injName, injTime, injDose, injUnit, injType, injEster, trainStart, trainEnd, linkToTraining, manualKcal, manualP, manualF, manualC, kbjuMode, budget, nutrLevel, variety, wakeTime, bedTime, lunchTime, dinnerTime, workFood, mealsCount, allergens, healthIssues, eveningLowCarb, planType, preferredFoods, quickAddMealIdx, quickAddSearch, customNotes, excludedFoods, dietPrefs, allergenExcludedCount, planTargets, cyclingMode, heavyTrainDay, workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType, trainingDays, generated, planDays, selectedDayIndex, planView, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc, savedPlans, lockedFoodIds, expandedSavedId, editItem, editAmount, replacingItem, recipePickerMeal, mealPrep, dayPlanNotes, draggedItem, dropTarget, undoStack, userRecipes, showRecipeCreator, showAddDrug, showDrugTypePicker, takenSupplements, showSuppPicker, suppSearch, newRecipe, v2Phase, v2Labs, v2Pharma, histamineSensitive, errorMsg, useProEngine, specialMealMode, specialMealGoal, specialMealProteinG, specialMealFatG, specialMealCarbsG, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget, cheatMealPlan, carbloadPlan, butchPlan, cravingPlan, lazyDayPlan, recommendations, mealPrepPlan, mealPrepDays, activeReports, allergenReport, nutrientReport, qualityReport, riskReport, drugCompatReport, nutritionReport, profile, s, courseEntries, labAnalysis, labs, autoGoal, injectDrugTypes, calcTargets, profileTargets, effectiveKcal, effectiveP, effectiveF, effectiveC, allergenExcludedCount]);

  return <PlanContext.Provider value={ctx}>{children}</PlanContext.Provider>;
};
