import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB, FOOD_ALLERGEN_DIET } from "../../../../core/nutrition-database";
import { PHARMA_DB } from "../../../../core/pharma-database";
import { calcNutrition } from "../../../../engines/nutrition.engine";
import { calcNutritionV2 } from "../../../../engines/nutrition-v2.engine";
import { updateProfile } from "../../../../core/profile-manager";
import { getRecipesByMeal, type Recipe } from "../../../../engines/nutrition-periodization.engine";
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type MealScoreV2 } from "../../../../engines/product-usefulness-v2.engine";
import { generateNutritionReport, type NutritionReport } from "../../../../engines/nutrition-report.engine";
import type { UserProfile } from "../../../../core/types";
import { getContraindications, saveContraindications } from "../../../../core/contraindications";
import { getNutritionV2Data, saveNutritionV2Data } from "../../../../core/nutrition-v2-data";
import { ALL_SUBSTANCES } from "../../../../data/support-substances";
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
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
  dietPrefs: string[]; setDietPrefs: (v: string[]) => void;
}

const PlanContext = createContext<PlanCtx>(null as any);
export const usePlanCtx = () => useContext(PlanContext);

export const IndividualPlanProvider: React.FC<{ profile: UserProfile | null; course?: any[]; children: React.ReactNode }> = ({ profile: _profile, course: _course, children }) => {
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
    try { const s = JSON.parse(localStorage.getItem('he_weight_log_entries') || 'null'); if (s && Array.isArray(s) && s.length > 0) return s; } catch {}
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
  const [monthPlanMode, setMonthPlanMode] = useState(false);
  const [monthPlan, setMonthPlan] = useState<any[]>([]);
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
    const wpw = s?.workoutsPerWeek || 3; const awm = s?.avgWorkoutMinutes || 60;
    let pal = 1.2 + wpw * 0.075; if (awm > 60) pal += 0.1; if (awm > 90) pal += 0.05; if (wpw >= 6) pal += 0.05;
    pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
    const goalMap: Record<string, string> = { mass:'bulk',strength:'strength',fat_loss:'cut',cutting:'cut',post_cut:'maintenance',maintenance:'maintenance',recomposition:'recomp',rehab:'rehab' };
    const engineGoal = goalMap[goal] || 'maintenance';
    let weightAdj = 1.0;
    if (weightAdaptMode && weightLogWeek.length >= 2) { const actualLoss = weightLogWeek[0] - weightLogWeek[weightLogWeek.length - 1]; const weeklyAvgLoss = actualLoss > 0 ? actualLoss / (weightLogWeek.length - 1) * 7 / Math.max(1, weightLogWeek.length - 1) : 0; if (expectedLossKgWeek > 0 && weeklyAvgLoss < expectedLossKgWeek * 0.7) weightAdj = 1 - (expectedLossKgWeek - Math.max(0, weeklyAvgLoss)) * 2 / Math.max(1, weight); else if (weeklyAvgLoss > expectedLossKgWeek * 1.3) weightAdj = 1 + (weeklyAvgLoss - expectedLossKgWeek) * 2 / Math.max(1, weight); weightAdj = Math.max(0.8, Math.min(1.2, weightAdj)); }
    const targetsV2 = (() => { try { return calcNutritionV2({ weightKg: weight, heightCm: height, age, sex: sex || 'male', pal: Math.min(1.9, Math.max(1.2, pal)), goal: engineGoal as any, bodyFatPercent: bodyFatPct }); } catch { return null; } })();
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
  }, [weight, height, age, sex, goal, s?.workoutsPerWeek, s?.avgWorkoutMinutes, injections, phase, bodyFatPct, weightAdaptMode, weightLogWeek, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, dietPauseMode, manualGPerKg]);

  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [manualP, setManualP] = useState<number | null>(null);
  const [manualF, setManualF] = useState<number | null>(null);
  const [manualC, setManualC] = useState<number | null>(null);
  const [kbjuMode, setKbjuMode] = useState<'auto' | 'manual' | 'profile'>('auto');

  const profileTargets = useMemo(() => {
    const wpw = s?.workoutsPerWeek || 3; const awm = s?.avgWorkoutMinutes || 60;
    let pal = 1.2 + wpw * 0.075; if (awm > 60) pal += 0.1; if (awm > 90) pal += 0.05; if (wpw >= 6) pal += 0.05;
    pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
    const gm: Record<string, string> = { mass:'bulk',strength:'strength',fat_loss:'cut',cutting:'cut',post_cut:'maintenance',maintenance:'maintenance',recomposition:'recomp',rehab:'rehab' };
    return calcNutrition({ weightKg: s?.weight || weight, heightCm: s?.height || height, age: s?.age || age, sex: s?.sex || sex, pal, goal: gm[goal] || 'maintenance' });
  }, [s?.weight, s?.height, s?.age, s?.sex, s?.workoutsPerWeek, s?.avgWorkoutMinutes, goal]);

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
  const [generated, setGenerated] = useState(false);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [planView, setPlanView] = useState<'list' | 'calendar'>('list');
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [threeDayPlan, setThreeDayPlan] = useState<any>(null);
  const [weekPlan, setWeekPlan] = useState<any>(null);
  const [shoppingList, setShoppingList] = useState<any>(null);
  const [waterCalc, setWaterCalc] = useState<any>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => { try { return JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]'); } catch { return []; } });
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
  useEffect(() => { try { localStorage.setItem('he_planner_labs', JSON.stringify(v2Labs)); } catch {} }, [v2Labs]);
  useEffect(() => { try { localStorage.setItem('he_planner_pharma', JSON.stringify(v2Pharma)); } catch {} }, [v2Pharma]);
  useEffect(() => { try { localStorage.setItem('he_nutrition_supps', JSON.stringify(takenSupplements)); } catch {} }, [takenSupplements]);

  const saveUndo = () => { if (dayPlan) setUndoStack(prev => [JSON.parse(JSON.stringify(dayPlan)), ...prev].slice(0, 5)); };

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

  const findSimilarFoods = (item: any, count = 5) => { const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name); if (!food) return []; const sameCat = FOOD_DB.filter(f => f.category === food.category && f.id !== food.id); const scored = sameCat.map(f => { const score = Math.abs(f.protein - food.protein) + Math.abs(f.fat - food.fat) * 0.5 + Math.abs(f.carbs - food.carbs) * 0.3; return { ...f, score }; }).sort((a, b) => a.score - b.score).slice(0, count); return scored; };

  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    const dayData = dayIdx === 0 ? dayPlan : threeDayPlan?.days?.[dayIdx] || weekPlan?.days?.[dayIdx];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    const old = dayData.meals[mealIdx].items[itemIdx]; const portion = (old.amount || 100) / 100;
    const replacement = { ...old, name: newFood.name, id: newFood.id, kcal: Math.round(newFood.kcal * portion), p: Math.round(newFood.protein * portion), f: Math.round(newFood.fat * portion), c: Math.round(newFood.carbs * portion), amount: Math.round(portion * (parseInt(newFood.servingSize) || 100)) };
    const updatePlan = (prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; const items = [...meals[mealIdx].items]; items[itemIdx] = replacement; meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } }; const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; };
    if (dayIdx === 0) setDayPlan(updatePlan); setReplacingItem(null);
  };

  const updateItemAmount = (dayIdx: number, mealIdx: number, itemIdx: number, newAmount: number) => {
    const updatePlan = (prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; const items = [...meals[mealIdx].items]; const it = { ...items[itemIdx], amount: Math.max(1, newAmount), kcal: Math.round(items[itemIdx].kcal / Math.max(1, items[itemIdx].amount) * Math.max(1, newAmount)) }; items[itemIdx] = it; meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } }; const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; };
    if (dayIdx === 0) setDayPlan(updatePlan); setEditItem(null);
  };

  const removeFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number) => {
    saveUndo();
    const updatePlan = (prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; const items = meals[mealIdx].items.filter((_: any, i: number) => i !== itemIdx); meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } }; const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; };
    if (dayIdx === 0) setDayPlan(updatePlan);
  };

  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number) => {
    saveUndo();
    const updatePlan = (prev: any) => {
      if (!prev) return prev;
      const meals = [...prev.meals];
      const matchedItems = recipe.ingredients.map((ing, ii) => { const lower = ing.toLowerCase(); const food = FOOD_DB.find(f => lower.includes(f.name.toLowerCase()) || lower.includes(f.id)); const item: any = food || { name: ing, id: ing, kcal: Math.round(recipe.kcal / recipe.ingredients.length), protein: Math.round(recipe.protein / recipe.ingredients.length), fat: Math.round(recipe.fat / recipe.ingredients.length), carbs: Math.round(recipe.carbs / recipe.ingredients.length) }; return { name: item.name || ing, id: item.id || ing, amount: 100, kcal: Math.round((item.kcal || 0) * (recipe.kcal / recipe.ingredients.length) / Math.max(1, item.kcal || 1)), p: Math.round(item.protein || recipe.protein / recipe.ingredients.length), f: Math.round(item.fat || recipe.fat / recipe.ingredients.length), c: Math.round(item.carbs || recipe.carbs / recipe.ingredients.length) }; });
      const totals = { kcal: matchedItems.reduce((s, i) => s + i.kcal, 0), p: matchedItems.reduce((s, i) => s + i.p, 0), f: matchedItems.reduce((s, i) => s + i.f, 0), c: matchedItems.reduce((s, i) => s + i.c, 0) };
      meals[mealIdx] = { ...meals[mealIdx], items: matchedItems, totals };
      const dayTotals = { kcal: meals.reduce((s, m) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s, m) => s + (m.totals?.p || 0), 0), f: meals.reduce((s, m) => s + (m.totals?.f || 0), 0), c: meals.reduce((s, m) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals: dayTotals };
    };
    setDayPlan(updatePlan); setRecipePickerMeal(null);
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

  // ─── Generate Plan ───
  const generatePlan = (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number) => {
    setPlanDays(days);
    if (dayIndex !== undefined) setSelectedDayIndex(dayIndex);
    const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
    const budgetFilter = (id: BudgetLevel): number[] => { const map: Record<string, number[]> = { low:[0,5],medium:[5,8],max:[8,10],enhanced:[9,15] }; return map[id] || [5,10]; };
    const [bMin, bMax] = budgetFilter(budget);
    const effectivePlanType = dietPrefs.includes('vegetarian') ? ('vegetarian' as PlanType) : planType;
    const planTypeMod = PLAN_TYPES.find(p => p.id === effectivePlanType);
    const pMod = planTypeMod?.pMult || 1.0; const fMod = planTypeMod?.fMult || 1.0; const cMod = planTypeMod?.cMult || 1.0;
    const excludedIds = new Set(excludedFoods);
    healthIssues.forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
    const getFoodAllergens = (foodId: string): string[] => { const fromDiet = FOOD_ALLERGEN_DIET[foodId]; if (fromDiet) return fromDiet.allergens; const food = FOOD_DB.find(f => f.id === foodId); return food?.allergens || []; };
    const userAllergenToValues: Record<string, string[]> = { 'лактоза':['dairy'],'молочные':['dairy'],'глютен':['gluten'],'орехи':['nuts','tree_nuts'],'арахис':['peanuts'],'яйца':['eggs'],'соя':['soy'],'рыба':['fish'],'морепродукты':['shellfish'],'кунжут':['sesame'],'горчица':['mustard'],'сельдерей':['celery'],'сульфиты':['sulfites'],'люпин':['lupin'] };
    const allergenTextMatches = (a: string, fName: string): boolean => { const n = fName.toLowerCase();
      if (a === 'лактоза' || a === 'молочные') { if (n.includes('молок')||n.includes('сыр')||n.includes('творог')||n.includes('кефир')||n.includes('сливк')||n.includes('йогурт')||n.includes('сметан')||n.includes('масл')||n.includes('морожен')||n.includes('сывороточ')||n.includes('whey')||n.includes('cas')||n.includes('casein')||n.includes('лактоз')) return true; }
      if (a === 'глютен') { if (n.includes('пшениц')||n.includes('мук')||n.includes('хлеб')||n.includes('макарон')||n.includes('пельмен')||n.includes('вареник')||n.includes('пицц')||n.includes('лаваш')||n.includes('булгур')||n.includes('кускус')||n.includes('манк')||n.includes('паниров')||n.includes('сухар')||n.includes('кляр')||n.includes('тест')||n.includes('блин')||n.includes('олад')||n.includes('круасс')||n.includes('багет')||n.includes('чиабат')||n.includes('лепёш')||n.includes('торт')||n.includes('пирож')||n.includes('пончик')||n.includes('печень')||n.includes('крекер')||n.includes('вафл')||n.includes('глютен')) return true; }
      if (a === 'орехи') { if (n.includes('миндаль')||n.includes('грецк')||n.includes('кешью')||n.includes('фундук')||n.includes('пекан')||n.includes('макадам')||n.includes('фисташк')||n.includes('орех')||n.includes('nut')||n.includes('almond')||n.includes('walnut')||n.includes('cashew')||n.includes('hazeln')||n.includes('pecan')||n.includes('pistach')) return true; }
      if (a === 'арахис') { if (n.includes('арахис')||n.includes('peanut')||n.includes('groundnut')||n.includes('ахид')||n.includes('землян')) return true; }
      if (a === 'яйца') { if (n.includes('яйц')||n.includes('яич')||n.includes('яичн')||n.includes('белок')||n.includes('желтк')||n.includes('омлет')||n.includes('egg')||n.includes('egg_')||n.includes('майонез')) return true; }
      if (a === 'соя') { if (n.includes('со')||n.includes('тофу')||n.includes('соев')||n.includes('edamame')||n.includes('soy')||n.includes('мисо')||n.includes('miso')||n.includes('темпе')||n.includes('tamari')) return true; }
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
      else sorted = [...sorted].sort((a, b) => { const sa = Math.sin(seed * 10007 + (a.id?.length || 0)); const sb = Math.sin(seed * 10007 + (b.id?.length || 0)); return sa - sb; });
      return sorted.slice(0, variety === 'minimal' ? 4 : variety === 'medium' ? 8 : 12);
    };
    const applyFoodPrefs = (pool: any[], prefType: string) => { const lower = prefType.toLowerCase(); if (pool.length <= 3) return pool; return pool.filter(f => !excludedIds.has(f.id) && [...allergenIds].every(a => !getFoodAllergens(f.id).includes(a) && !allergenTextMatches(a, f.name))); };
    const seedRand = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
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

      const mealDefs: { label: string; anchor?: number }[] = [];
      mealDefs.push({ label: 'Завтрак', anchor: effectiveWake + 30 });
      if (mealsCount >= 5) mealDefs.push({ label: 'Второй завтрак' });
      if (mealsCount >= 3) mealDefs.push({ label: 'Обед', anchor: Math.min(effectiveLunch, 1320) });
      if (mealsCount >= 4) mealDefs.push({ label: 'Полдник' });
      mealDefs.push({ label: 'Ужин', anchor: Math.min(effectiveDinner, 1380) });
      if (mealsCount >= 6) mealDefs.push({ label: 'Перекус' });
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
      const tKcal = Math.round(weight * 30 * (nutrMult || 1) * (pMod || 1)); const tP = Math.round(weight * 2 * (pMod || 1)); const tF = Math.round(weight * 0.8 * (fMod || 1)); const tC = Math.round(weight * 3.5 * (cMod || 1));
      let tKcalAdj = tKcal; let tCAdj = tC;
      if (cyclingMode === 'macro' && !isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); tCAdj = Math.round(tC * 0.7); }
      if (cyclingMode === 'butch') { tCAdj = isTrainingDay ? Math.round(tC * 1.3) : Math.round(tC * 0.5); }
      if (cyclingMode === 'cheatmeal' && isTrainingDay) tKcalAdj = Math.round(tKcal * 0.85);
      if (cyclingMode === 'carbload' && isTrainingDay) tCAdj = Math.round(tC * 1.5);
      let mealCAdjust: Record<number, number> = {};
      if (eveningLowCarb) { const dinnerIdx = mealTimes.findIndex(m => m.label === 'Ужин'); const lunchIdx = mealTimes.findIndex(m => m.label === 'Обед'); if (dinnerIdx >= 0) { const carbReduction = Math.round((tCAdj / mealTimes.length) * 0.6); mealCAdjust[dinnerIdx] = -carbReduction; if (lunchIdx >= 0) mealCAdjust[lunchIdx] = carbReduction; } }
      const foodSeed = dayOffset * 10007;
      const meals = mealTimes.map((mt, idx) => {
        const p = Math.round(tP / mealTimes.length); const f = Math.round(tF / mealTimes.length); const c = Math.round(tCAdj / mealTimes.length) + (mealCAdjust[idx] || 0); const kcalAdj = Math.round((mealCAdjust[idx] || 0) * 4); const kcal = Math.round(tKcalAdj / mealTimes.length) + kcalAdj;
        const items: any[] = []; let remainingP = p; let remainingF = f; let remainingC = c;
        const sSeed = dayOffset * 10007 + idx * 997 + (isTrainingDay ? 3000 : 0) + (cyclingMode === 'butch' ? 5000 : 0);
        const isPreWorkout = mt.label === 'Предтрен'; const isPostWorkout = mt.label === 'Пост-трен'; const isPeriWorkout = isPreWorkout || isPostWorkout;
        const highQuality = budget === 'max' || budget === 'enhanced'; const lowQuality = budget === 'low';
        const fastCarbs = FOOD_DB.filter(f => f.gi && f.gi >= 80); const slowCarbs = FOOD_DB.filter(f => f.category === 'carb' || f.category === 'grain'); const proteinFoods = FOOD_DB.filter(f => f.category === 'protein' && (f.tier === 'basic' || f.tier === 'mid' || f.tier === 'max')); const allProtein = applyFoodPrefs(proteinFoods, 'protein'); const topProtein = highQuality ? qualitySort(allProtein, true).slice(0, 8) : lowQuality ? qualitySort(allProtein, false).slice(0, 5) : allProtein.filter(f => f.protein > 15).sort(() => Math.random() - 0.5).slice(0, 5);
        const pickItem = (foodPool: any[], targetG: number, seed: number, maxItems = 2): any[] => { const result: any[] = []; let pool = applyFoodPrefs(foodPool, 'any'); if (pool.length === 0) return result; const highQ = budget === 'max' || budget === 'enhanced'; const lowQ = budget === 'low'; if (highQ) pool = qualitySort(pool, true); else if (lowQ) pool = qualitySort(pool, false); const preferPool = preferredSet.size > 0 ? pool.filter(f => preferredSet.has(f.id)) : []; const mainPool = preferPool.length > 0 ? preferPool : pool; for (let i = 0; i < maxItems && targetG > 5; i++) { const idx = highQ ? i : lowQ ? (mainPool.length - 1 - i) : Math.floor(seedRand(seed + i * 997) * mainPool.length); const food = mainPool[Math.min(idx, mainPool.length - 1)]; const portion = Math.min(1, targetG / Math.max(1, food.protein || food.fat || food.carbs || 1)); result.push({ name: food.name, id: food.id, amount: Math.round(portion * (parseInt(food.servingSize) || 100)), kcal: Math.round(food.kcal * portion), p: Math.round(food.protein * portion), f: Math.round(food.fat * portion), c: Math.round(food.carbs * portion) }); targetG -= food.protein * portion || 0; } return result; };
        if (isPreWorkout) {
          const preProtein = FOOD_DB.find(f => f.id === 'whey_isolate'); if (preProtein) items.push({ name: preProtein.name, id: 'whey_isolate', amount: 40, kcal: Math.round(preProtein.kcal * 0.4), p: Math.round(preProtein.protein * 0.4), f: Math.round(preProtein.fat * 0.4), c: Math.round(preProtein.carbs * 0.4) });
          const preCarb = FOOD_DB.find(f => f.id === 'banana'); if (preCarb) items.push({ name: preCarb.name, id: 'banana', amount: 100, kcal: Math.round(preCarb.kcal), p: Math.round(preCarb.protein), f: Math.round(preCarb.fat), c: Math.round(preCarb.carbs) });
        } else if (isPostWorkout) {
          const postProtein = FOOD_DB.find(f => f.id === 'whey_isolate'); if (postProtein) items.push({ name: postProtein.name, id: 'whey_isolate', amount: 50, kcal: Math.round(postProtein.kcal * 0.5), p: Math.round(postProtein.protein * 0.5), f: Math.round(postProtein.fat * 0.5), c: Math.round(postProtein.carbs * 0.5) });
          const postCarb = FOOD_DB.find(f => f.id === 'rice_white'); if (postCarb) items.push({ name: postCarb.name, id: 'rice_white', amount: 150, kcal: Math.round(postCarb.kcal * 1.5), p: Math.round(postCarb.protein * 1.5), f: Math.round(postCarb.fat * 1.5), c: Math.round(postCarb.carbs * 1.5) });
        } else {
          const protItems = pickItem(topProtein, remainingP, sSeed); protItems.forEach(i => { items.push(i); remainingP -= i.p || 0; remainingF -= i.f || 0; remainingC -= i.c || 0; });
          const carbPool = applyFoodPrefs(slowCarbs, 'carb'); if (carbPool.length > 0 && remainingC > 10) { const cIdx = Math.floor(seedRand(sSeed + 3) * carbPool.length); const cF = carbPool[cIdx % carbPool.length]; const cPortion = Math.min(1, remainingC / Math.max(1, cF.carbs || 1)); items.push({ name: cF.name, id: cF.id, amount: Math.round(cPortion * (parseInt(cF.servingSize) || 100)), kcal: Math.round(cF.kcal * cPortion), p: Math.round(cF.protein * cPortion), f: Math.round(cF.fat * cPortion), c: Math.round(cF.carbs * cPortion) }); }
          const vegPool = limitPool(applyFoodPrefs(FOOD_DB.filter(f => f.category === 'veg_fruit'), 'veg'), foodSeed + 4); if (vegPool.length > 0) { const vegIdx = Math.floor(seedRand(foodSeed + 4) * vegPool.length); const v = vegPool[vegIdx % vegPool.length]; items.push({ name: v.name, id: v.id, amount: 80, kcal: Math.round(v.kcal * 0.8), p: Math.round(v.protein * 0.8), f: Math.round(v.fat * 0.8), c: Math.round(v.carbs * 0.8) }); }
        }
        const tot = { kcal: items.reduce((s,i) => s + i.kcal, 0), p: items.reduce((s,i) => s + i.p, 0), f: items.reduce((s,i) => s + i.f, 0), c: items.reduce((s,i) => s + i.c, 0) };
        return { ...mt, items, totals: tot, idx };
      });
      const totals = { kcal: meals.reduce((s,m) => s + m.totals.kcal, 0), p: meals.reduce((s,m) => s + m.totals.p, 0), f: meals.reduce((s,m) => s + m.totals.f, 0), c: meals.reduce((s,m) => s + m.totals.c, 0) };
      const allergenWarnings: string[] = [];
      meals.forEach(m => { m.items.forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id); if (food?.allergens) { const matched = food.allergens.filter(a => !allergens.includes(a)); if (matched.length > 0 && !excludedIds.has(food.id)) allergenWarnings.push(`${it.name}: содержит ${matched.join(', ')}`); } }); });
      return { meals, totals, isTrainingDay, isWorkDay, allergenWarnings: [...new Set(allergenWarnings)] };
    };
    const dayIdx = days === 1 ? selectedDayIndex : 0;
    const d1 = buildDay(dayIdx, trainingDays[dayIdx]);
    const d2 = buildDay(1, trainingDays[1]);
    const d3 = buildDay(2, trainingDays[2]);
    setDayPlan(d1);
    if (days >= 3) setThreeDayPlan({ days: [d1, d2, d3], totals: { kcal: d1.totals.kcal + d2.totals.kcal + d3.totals.kcal, p: d1.totals.p + d2.totals.p + d3.totals.p, f: d1.totals.f + d2.totals.f + d3.totals.f, c: d1.totals.c + d2.totals.c + d3.totals.c } });
    if (days >= 7) { const week = Array.from({ length: 7 }, (_, i) => buildDay(i, trainingDays[i])); const weekData = { days: week, totals: { kcal: week.reduce((s,d) => s + d.totals.kcal, 0), p: week.reduce((s,d) => s + d.totals.p, 0), f: week.reduce((s,d) => s + d.totals.f, 0), c: week.reduce((s,d) => s + d.totals.c, 0) }}; if (weekIndex !== undefined) { const mPlan = [...monthPlan]; mPlan[weekIndex] = weekData; setMonthPlan(mPlan); } else setWeekPlan(weekData); }
    generateRecommendations();
    const sorted = [...FOOD_DB].sort(() => Math.random() - 0.5).slice(0, 10);
    setShoppingList(sorted);
    const hasPharma = injections.length > 0 || (courseEntries?.length || 0) > 0;
    const aasCount = injections.filter(i => i.type === 'ААС').length; const insulinCount = injections.filter(i => i.type === 'инсулин').length; const ghCount = injections.filter(i => i.type === 'ГР').length;
    const pharmaHeavy = aasCount + insulinCount + ghCount; const pharmaBaseMl = hasPharma ? Math.min(45, 40 + pharmaHeavy * 1.5) : 30;
    const baseWaterMl = weight * pharmaBaseMl; const baseWater = baseWaterMl / 1000;
    const weeklyTrainMin = (s?.workoutsPerWeek || 0) * (s?.avgWorkoutMinutes || 60); const trainBonus = Math.round((weeklyTrainMin / 60) * 0.3 * 10) / 10;
    const fiberTarget = Math.round(effectiveC * 0.025); const fiberFactor = Math.round((fiberTarget / 10) * 0.1 * 10) / 10;
    const pharmaBonus = hasPharma ? Math.round((0.5 + aasCount * 0.15 + insulinCount * 0.3 + ghCount * 0.1) * 10) / 10 : 0;
    const waterTotal = Math.max(1.5, Math.round((baseWater + trainBonus + fiberFactor + pharmaBonus) * 10) / 10);
    setWaterCalc({ baseWater: Math.round(baseWater * 10) / 10, pharmaBaseMl: Math.round(pharmaBaseMl), trainBonus, fiberFactor, pharmaBonus, total: waterTotal, hasPharma });
    setGenerated(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

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
      if (hasShortInsulin || hasInsulin) { recs.push(`💉 Инсулин: ${totalInsulinDose}ЕД × 10г = ${totalInsulinDose*10}г угл. Минимум 150г угл/день.`); recs.push('🍔 На инсулине — минимум жиров в окне действия.’);'); }
      if (hasGH) recs.push('🧬 ГР: избегать угл в окне 60мин до/после. Вода +0.5-1л.');
      if (hasIGF) recs.push('🧬 ИФР-1: натощак за 30-45мин до еды. Контроль глюкозы.');
      if (hasGLP) recs.push('💊 GLP-1: дробно 5-6р по 100-200г. Жиры <5г/приём.');
    }
    if (linkToTraining) recs.push(`🏋️ Тренировка ${trainStart}-${trainEnd}. Предтрен за 1.5-2ч, пост-трен в течение 60-90мин.`);
    recs.push('✅ Белок с каждым приёмом. Овощи 300-500г/день. Вода 2.5-4л. Сон 7-9ч.');

    // ── v2-анализ сгенерированного рациона и правил справочника ──
    if (generated && dayPlan) {
      const profile = getDefaultProfile();
      profile.phase = (v2Phase as any) || 'LEAN_MASS';
      profile.pharma.AAS_ORAL = v2Pharma.AAS_ORAL || false;
      profile.pharma.AAS_INJECTABLE = v2Pharma.AAS_INJECTABLE || false;
      profile.pharma.HGH = v2Pharma.HGH || false;
      profile.pharma.DIURETICS = v2Pharma.DIURETICS || false;
      profile.pharma.STIMULATORS = v2Pharma.STIMULATORS || false;
      profile.pharma.INSULIN_USE = v2Pharma.INSULIN_USE || false;
      profile.pharma.LIVER_SUPPORT = v2Pharma.LIVER_SUPPORT || false;
      profile.pharma.GUT_SUPPORT = v2Pharma.GUT_SUPPORT || false;
      profile.labs.hematocrit = v2Labs.hematocrit ? parseFloat(v2Labs.hematocrit) : undefined;
      profile.labs.ldl = v2Labs.ldl ? parseFloat(v2Labs.ldl) : undefined;
      profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
      profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
      profile.labs.crp = v2Labs.crp ? parseFloat(v2Labs.crp) : undefined;
      profile.weightKg = weight || 80;
      profile.lbm = profile.weightKg * 0.85;

      const meals = dayPlan.meals || [];
      const allMeals = meals.map((m: any) => ({
        timing: (m.timing || 'regular') as any,
        products: (m.items || []).map((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
          return { foodId: food?.id || it.name || 'unknown', weightGrams: it.amount || 100 };
        }).filter((p: any) => p.weightGrams > 0),
      }));

      const daily = analyzeDailyDiet(allMeals, profile);
      const totalKcal = Math.round(dayPlan.totals?.kcal || 0);
      const totalP = Math.round(dayPlan.totals?.p || 0);
      const mealsCount = meals.length;

      // mTOR
      if (!daily.mtorTriggered) recs.push(`🧬 mTOR не запущен — дефицит ${daily.mtorDeficitMg}мг лейцина. Добавьте 30-40г сывороточного протеина или 200г курицы.`);
      else recs.push('🧬 mTOR запущен — лейцин >3г/день ✅');

      // DIAAS
      if (daily.diaasWarning) recs.push(`💪 ${daily.diaasWarning}`);

      // GI load
      if (daily.giLoadWarning) recs.push(`🫃 Высокая нагрузка на ЖКТ (${Math.round(daily.giLoad)}). Добавьте пищеварительные ферменты или уменьшите порции.`);

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
    const grains = uniqueItems.filter((it: any) => { const n = it.name.toLowerCase(); return n.includes('рис')||n.includes('гречк')||n.includes('булгур')||n.includes('киноа')||n.includes('кус-кус')||n.includes('перловк')||n.includes('овсянк'); });
    if (grains.length > 0) steps.push({ step: stepNum++, action:'Поставить вариться крупы', duration:25, items: grains.map((g:any)=>`${g.name} ×порций`) });
    const meats = uniqueItems.filter((it: any) => { const n = it.name.toLowerCase(); return n.includes('куриц')||n.includes('индейк')||n.includes('говядин')||n.includes('лосос')||n.includes('треск'); });
    if (meats.length > 0) steps.push({ step: stepNum++, action:'Замариновать мясо/рыбу', duration:5, items: meats.map((m:any)=>m.name) });
    const ovenItems = meats; if (ovenItems.length > 0) steps.push({ step: stepNum++, action:'Поставить в духовку 180-200°C', duration:30, items: ovenItems.map((m:any)=>m.name) });
    const veg = uniqueItems.filter((it: any) => { const n = it.name.toLowerCase(); return n.includes('брокколи')||n.includes('цветная капуст')||n.includes('морков')||n.includes('кабач')||n.includes('спарж'); });
    if (veg.length > 0) steps.push({ step: stepNum++, action:'Нарезать и приготовить овощи', duration:15, items: veg.map((v:any)=>v.name) });
    const fresh = uniqueItems.filter((it: any) => { const n = it.name.toLowerCase(); return n.includes('огурец')||n.includes('помидор')||n.includes('салат')||n.includes('зелен'); });
    if (fresh.length > 0) steps.push({ step: stepNum++, action:'Помыть/нарезать свежие', duration:8, items: fresh.map((f:any)=>f.name) });
    const mealCount = days[0]?.meals?.length || 4;
    steps.push({ step: stepNum++, action:`Разложить по ${mealCount} контейнерам`, duration:12, items:[`${mealCount} контейнеров × ${mealPrepDays} дня(ей)`] });
    steps.push({ step: stepNum++, action:'Подписать и убрать', duration:5, items:['Холодильник: 3 дня','Морозилка: остальное'] });
    setMealPrepPlan({ steps, totalTime: steps.reduce((s, st) => s + st.duration, 0), containers: mealCount * mealPrepDays });
  };

  const [activeReports, setActiveReports] = useState<string[]>([]);
  const [allergenReport, setAllergenReport] = useState<any>(null);
  const [nutrientReport, setNutrientReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<any>(null);
  const [drugCompatReport, setDrugCompatReport] = useState<any>(null);
  const [nutritionReport, setNutritionReport] = useState<any>(null);
  useEffect(() => { try { const saved = localStorage.getItem('he_nutrition_report_current'); if (saved) { setNutritionReport(JSON.parse(saved)); setActiveReports(prev => prev.includes('nutrition') ? prev : [...prev, 'nutrition']); } } catch {} }, []);

  const generateAllergenReport = () => { if (!dayPlan) return; const conflicts: any[] = []; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (food?.allergens) { const matched = food.allergens.filter((a: string) => allergens.includes(a)); if (matched.length > 0) conflicts.push({ food: it.name, allergens: matched }); } }); const riskLevel = conflicts.length === 0 ? 'low' : conflicts.length <= 3 ? 'medium' : 'high'; setAllergenReport({ conflicts, riskLevel, summary: conflicts.length === 0 ? '✅ Нет совпадений' : `⚠ ${conflicts.length} совпадений` }); setActiveReports(prev => prev.includes('allergen') ? prev : [...prev, 'allergen']); };
  const generateNutrientReport = () => { if (!dayPlan) return; const micros: Record<string, number> = {}; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (food?.micros) Object.entries(food.micros).forEach(([k, v]) => { if (v) micros[k] = (micros[k] || 0) + (v as number) * (it.amount / 100); }); }); const targets: Record<string, number> = { Ca:1000,Fe:18,Mg:400,Zn:15,K:3500,Se:55,VitC:100,VitD:15,VitB12:2.4,Omega3:1.6 }; const results: Record<string, any> = {}; const gaps: string[] = []; Object.entries(targets).forEach(([k, t]) => { const actual = Math.round((micros[k]||0)*10)/10; const pct = Math.round(actual/t*100); results[k] = { actual, target: t, pct, status: pct>=80?'ok':pct>=50?'low':'critical' }; if (pct < 80) gaps.push(`${k}: ${actual} из ${t} (${pct}%)`); }); setNutrientReport({ micros: results, gaps: gaps.length === 0 ? ['✅ Все в норме'] : gaps }); setActiveReports(prev => prev.includes('nutrient') ? prev : [...prev, 'nutrient']); };
  const generateQualityReport = () => { if (!dayPlan) return; const scores: any[] = []; dayPlan.meals.flatMap((m: any) => m.items).forEach((it: any) => { const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name); if (!food) return; let score = 5; const pd = (food.protein*4)/Math.max(food.kcal,1); if (pd > 0.6) score += 2; else if (pd > 0.3) score += 1; if ((food.fiber||0)>=3) score += 1; if (food.tier === 'max') score = 10; else if (food.tier === 'mid') score = Math.max(score,8); else if (food.tier === 'basic') score = Math.max(score,6); scores.push({ name: it.name, score: Math.min(10, score), bbs: food.bb_quality_score || 0, category: food.category }); }); const avg = Math.round(scores.reduce((s,x)=>s+x.score,0)/Math.max(1,scores.length)*10)/10; const bbsAvg = Math.round(scores.reduce((s,x)=>s+x.bbs,0)/Math.max(1,scores.length)*10)/10; const sorted = [...scores].sort((a,b)=>b.score-a.score); const budgetRange = budget === 'low' ? '★1-5' : budget === 'medium' ? '★5-8' : budget === 'max' ? '★8-10' : '★9-10'; const budgetOk = (budget === 'low' && bbsAvg <= 5) || (budget === 'medium' && bbsAvg >= 5 && bbsAvg <= 8) || ((budget === 'max' || budget === 'enhanced') && bbsAvg >= 8); setQualityReport({ avgScore: avg, bbsAvg, budget, budgetRange, budgetOk, bestItems: sorted.filter(s=>s.score>=8).map(s=>s.name).slice(0,5), weakItems: sorted.filter(s=>s.score<=5).map(s=>s.name).slice(0,5), recommendations: !budgetOk ? [`Бюджет «${budget}» (${budgetRange}), а средний bb_quality_score рациона ${bbsAvg}. ${budget==='low'?'Снизьте бюджет или повысьте качество.':(budget==='max'||budget==='enhanced')?'Выберите более дешёвые продукты или повысьте бюджет.':'Настройте бюджет под качество.'}`] : avg<6 ? ['Повысьте качество продуктов, увеличьте бюджет'] : avg>=8 ? [`✅ Отлично! Средний bb_quality_score ${bbsAvg} соответствует бюджету ${budgetRange}.`] : [] }); setActiveReports(prev => prev.includes('quality') ? prev : [...prev, 'quality']); };
  const generateRiskReport = () => { if (!dayPlan) return; const systems: Record<string, any> = {}; const allItems = dayPlan.meals.flatMap((m: any)=>m.items); const totalFat = allItems.reduce((s:number,it:any)=>s+(it.f||0),0); const totalKcal = allItems.reduce((s:number,it:any)=>s+(it.kcal||0),0); const fatPct = totalKcal>0?totalFat*9/totalKcal*100:0; systems.hepatic = { score: fatPct>40?7:fatPct>30?5:fatPct>20?3:1, impact: fatPct>35?'Высокожировая':'Умеренные', recommendation: fatPct>35?'Снизить жиры до 25-30%':'Норма' }; const proteinGPerKg = Math.round((allItems.reduce((s:number,it:any)=>s+(it.p||0),0)/weight)*10)/10; systems.renal = { score: proteinGPerKg>3?7:proteinGPerKg>2.5?5:proteinGPerKg>2?3:1, impact: `${proteinGPerKg.toFixed(1)} г/кг`, recommendation: proteinGPerKg>2.5?'Контроль белка':'Норма' }; const totalScore = Object.values(systems).reduce((s:number,sys:any)=>s+sys.score,0); setRiskReport({ systems, totalRisk: totalScore<=8?'Низкий':totalScore<=14?'Средний':'Высокий', summary: totalScore<=8?'✅ Рацион сбалансирован':totalScore<=14?'⚠ Есть зоны для улучшения':'🔴 Требуется коррекция' }); setActiveReports(prev => prev.includes('risk')?prev:[...prev,'risk']); };
  const generateDrugCompatReport = () => { if (!dayPlan || injections.length === 0) return; const warnings: string[] = []; const allItems = dayPlan.meals.flatMap((m: any) => m.items); injections.forEach(inj => { const t = inj.type.toLowerCase(); if (t.includes('инсулин')) { const totalCarbs = dayPlan.totals.c || 0; if (totalCarbs < 150) warnings.push(`💉 ${inj.name}: ${Math.round(totalCarbs)}г угл/день — риск гипогликемии`); } }); if (warnings.length === 0) warnings.push('✅ Все препараты совместимы'); setDrugCompatReport({ interactions: [], warnings }); setActiveReports(prev => prev.includes('drug')?prev:[...prev,'drug']); };
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
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,color:d.isTrainingDay?'#00e68a':'rgba(255,255,255,0.85)'}}>{d.isTrainingDay?'🏆 ТРЕНИРОВОЧНЫЙ ДЕНЬ':'🛌 ДЕНЬ ОТДЫХА'}</div></div>
              <div style={{padding:'4px 10px',borderRadius:8,background:d.isTrainingDay?'rgba(0,230,138,0.1)':'rgba(255,255,255,0.03)',border:d.isTrainingDay?'1px solid rgba(0,230,138,0.2)':'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:16,fontWeight:900,color:'#00e68a',lineHeight:1}}>{totalKcal}</div>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.85)',textAlign:'center'}}>ккал</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,fontSize:9}}>
              <span style={{color:'#3b82f6',fontWeight:600}}>💪 {totalP}г Б</span>
              <span style={{color:'#f59e0b',fontWeight:600}}>🧈 {totalF}г Ж</span>
              <span style={{color:'#f97316',fontWeight:600}}>🌾 {totalC}г У</span>
              <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.85)'}}>{weight>0?`${Math.round(totalP/weight)}г/кг`:''}</span>
            </div>
          </div>
          <div style={{height:4,display:'flex'}}>
            <div style={{height:'100%',width:`${Math.max(2,pKcalPct)}%`,background:'#3b82f6',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,fKcalPct)}%`,background:'#f59e0b',minWidth:2}}/>
            <div style={{height:'100%',width:`${Math.max(2,cKcalPct)}%`,background:'#f97316',minWidth:2,flex:1}}/>
          </div>
        </div>
        {d.allergenWarnings?.length > 0 && <div style={{padding:'6px 10px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:8,color:'#ef4444',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:10}}>⚠️</span><span>{d.allergenWarnings.join('; ')}</span></div>}
        {d.meals.map((m: any, mi: number) => {
          const mealKcal = Math.round(m.totals?.kcal || 0); const mealP = Math.round(m.totals?.p || 0); const mealF = Math.round(m.totals?.f || 0); const mealC = Math.round(m.totals?.c || 0);
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
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{mealKcal} ккал</span>
                  <span onClick={()=>setRecipePickerMeal({dayIdx:0,mealIdx:mi,label:m.label})} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',cursor:'pointer',fontWeight:600}}>🍳</span>
                  <span onClick={()=>{const name=prompt('Добавить продукт:');if(!name)return;const food=FOOD_DB.find((f:any)=>f.name.toLowerCase().includes(name.toLowerCase()));if(!food)return;setDayPlan((prev:any)=>{if(!prev)return prev;const meals=prev.meals.map((m1:any,i:number)=>{if(i!==mi)return m1;const items=[...m1.items,{name:food.name,id:food.id,amount:100,kcal:food.kcal,p:food.protein,f:food.fat,c:food.carbs}];const totals={kcal:items.reduce((s:number,it:any)=>s+it.kcal,0),p:items.reduce((s:number,it:any)=>s+it.p,0),f:items.reduce((s:number,it:any)=>s+it.f,0),c:items.reduce((s:number,it:any)=>s+it.c,0)};return{...m1,items,totals}});const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontWeight:600}}>+</span>
                  <span onClick={()=>{saveUndo();const copy=JSON.parse(JSON.stringify(dayPlan?.meals?.[mi]));if(!copy)return;setDayPlan((prev:any)=>{if(!prev)return prev;const meals=[...prev.meals];const insertAt=Math.min(mi+1,meals.length);const dup={...copy,label:copy.label+' (копия)',time:(()=>{const[h,m]=(copy.time||'12:00').split(':').map(Number);const t=h*60+m+30;return`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`})()};meals.splice(insertAt,0,dup);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.12)',color:'#818cf8',cursor:'pointer',fontWeight:600}}>📋</span>
                  <span onClick={()=>{saveUndo();setDayPlan((prev:any)=>{if(!prev)return prev;const meals=prev.meals.filter((_:any,i:number)=>i!==mi);const totals={kcal:meals.reduce((s:number,m2:any)=>s+(m2.totals?.kcal||0),0),p:meals.reduce((s:number,m2:any)=>s+(m2.totals?.p||0),0),f:meals.reduce((s:number,m2:any)=>s+(m2.totals?.f||0),0),c:meals.reduce((s:number,m2:any)=>s+(m2.totals?.c||0),0)};return{...prev,meals,totals}});}} style={{fontSize:7,padding:'2px 5px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.12)',color:'#ef4444',cursor:'pointer',fontWeight:600}}>✕</span>
                </div>
              </div>
              <div style={{padding:'6px 10px 8px',background:'#18181b'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{m.items.map((it:any,ii:number)=>{const isEditing=editItem?.mealIdx===mi&&editItem?.itemIdx===ii;const isReplacing=replacingItem?.mealIdx===mi&&replacingItem?.itemIdx===ii;return<span key={ii} draggable={!isEditing&&!isReplacing} onDragStart={e=>{e.dataTransfer.setData('text/plain',`${mi}:${ii}`);setDraggedItem({mealIdx:mi,itemIdx:ii});}} style={{padding:'3px 6px',borderRadius:6,fontSize:8,background:isEditing?'rgba(59,130,246,0.08)':isReplacing?'rgba(245,158,11,0.08)':'#202023',border:`1px solid ${isEditing?'rgba(59,130,246,0.2)':isReplacing?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.15)'}`,cursor:'grab',color:'#fff',display:'inline-flex',alignItems:'center',gap:3,flexWrap:'wrap'}}>
                    {isEditing?<><input type="number" defaultValue={it.amount} onChange={e=>setEditAmount(+e.target.value||0)} style={{width:40,padding:'1px 4px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',fontSize:8}}/><span style={{fontSize:7,color:'rgba(255,255,255,0.85)'}}>г</span><button onClick={()=>updateItemAmount(0,mi,ii,editAmount||it.amount)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(0,230,138,0.15)',color:'#00e68a',cursor:'pointer',fontSize:7}}>✓</button><button onClick={()=>setEditItem(null)} style={{padding:'1px 4px',borderRadius:3,border:'none',background:'rgba(239,68,68,0.1)',color:'#ef4444',cursor:'pointer',fontSize:7}}>✕</button></>
                    :isReplacing?<><span style={{fontWeight:600}}>{it.name}</span><select onChange={e=>{if(e.target.value){const f=FOOD_DB.find(x=>x.id===e.target.value);if(f)replaceFoodItem(0,mi,ii,f);}}} value="" style={{fontSize:7,padding:'1px 2px',borderRadius:3,border:'1px solid rgba(255,255,255,0.06)',background:'#18181b',color:'#fff',maxWidth:120}}><option value="">🔀 Заменить...</option>{findSimilarFoods(it).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></>
                    :<><span style={{fontWeight:600}}>{it.name}</span><span style={{color:'rgba(255,255,255,0.9)',fontSize:7}}>{it.amount}г</span><span onClick={()=>addToCart({name:it.name,kcal:it.kcal*(it.amount/100),amount:it.amount,category:it.category})} style={{cursor:'pointer',fontSize:7,color:'#00e68a',opacity:0.35,padding:'0 2px'}}>🛒</span><span onClick={()=>{setEditItem({dayIdx:0,mealIdx:mi,itemIdx:ii});setEditAmount(it.amount);}} style={{cursor:'pointer',fontSize:7,color:'rgba(255,255,255,0.8)',padding:'0 2px'}}>✏️</span><span onClick={()=>setReplacingItem({dayIdx:0,mealIdx:mi,itemIdx:ii})} style={{cursor:'pointer',fontSize:7,color:'rgba(245,158,11,0.4)',padding:'0 2px'}}>🔄</span><span onClick={()=>removeFoodItem(0,mi,ii)} style={{cursor:'pointer',fontSize:7,color:'rgba(239,68,68,0.3)',padding:'0 2px'}}>✕</span></>}
                  </span>;})}</div>
                {m.totals&&<div style={{display:'flex',gap:6,marginTop:4,fontSize:7}}><span style={{color:'#3b82f6',fontWeight:600}}>Б {mealP}г</span><span style={{color:'#f59e0b',fontWeight:600}}>Ж {mealF}г</span><span style={{color:'#f97316',fontWeight:600}}>У {mealC}г</span></div>}
              </div>
            </div>
          );
        })}
        <div style={{marginTop:8,borderRadius:10,overflow:'hidden',border:'1px solid rgba(0,230,138,0.15)'}}>
          <div style={{padding:'10px 12px',background:'linear-gradient(135deg, rgba(0,230,138,0.06), transparent)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px'}}>ИТОГО ЗА ДЕНЬ</span><span style={{color:'#00e68a',fontWeight:900,fontSize:16}}>{totalKcal} ккал</span></div>
            <div style={{display:'flex',gap:8}}>
              {[{label:'Белки',val:totalP,unit:'г',color:'#3b82f6',target:effectiveP},{label:'Жиры',val:totalF,unit:'г',color:'#f59e0b',target:effectiveF},{label:'Углеводы',val:totalC,unit:'г',color:'#f97316',target:effectiveC}].map(m=>{const pct=Math.min(100,Math.round(m.val/Math.max(1,m.target)*100));const isOver=pct>100;return(<div key={m.label} style={{flex:1}}><div style={{display:'flex',justifyContent:'space-between',fontSize:8,marginBottom:2}}><span style={{color:m.color,fontWeight:600}}>{m.label}</span><span style={{color:isOver?'#ef4444':'rgba(255,255,255,0.85)',fontWeight:700}}>{m.val}/{m.target}{m.unit}</span></div><div style={{height:5,borderRadius:3,background:'#202023',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,borderRadius:3,background:isOver?'#ef4444':`linear-gradient(90deg, ${m.color}, ${m.color}88)`,transition:'width 0.3s'}}/></div><div style={{fontSize:7,color:isOver?'#ef4444':'rgba(255,255,255,0.85)',textAlign:'right',marginTop:1}}>{isOver?`+${pct-100}%`:`${pct}%`}</div></div>);})}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ctx: PlanCtx = {
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
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    recipePickerMeal, setRecipePickerMeal, mealPrep, setMealPrep,
    dayPlanNotes, setDayPlanNotes, draggedItem, setDraggedItem, dropTarget, setDropTarget,
    undoStack, setUndoStack, userRecipes, setUserRecipes,
    showRecipeCreator, setShowRecipeCreator,
    showAddDrug, setShowAddDrug, showDrugTypePicker, setShowDrugTypePicker,
    takenSupplements, setTakenSupplements, showSuppPicker, setShowSuppPicker,
    suppSearch, setSuppSearch, newRecipe, setNewRecipe,
    saveUndo, moveFoodItem, findSimilarFoods, replaceFoodItem,
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
  };

  return <PlanContext.Provider value={ctx}>{children}</PlanContext.Provider>;
};
