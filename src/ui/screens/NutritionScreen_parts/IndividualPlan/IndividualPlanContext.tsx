import React, { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { applyBBNutritionToTargets } from "./planner-bb-nutrition";
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
import { awakeHoursFromTimes, planMealStructure } from "./planner-meal-count";
import { isWorkDayForIndex } from "./planner-work";
import { readWeightMode, writeWeightMode } from "./planner-weight-mode";
import { applyCarbPeriodizationMods, carbPeriodizationLabel, isHeavyDayForOffset } from "./planner-carb-periodization";
import { microDeficitToPreferIds, diaasWeakLinkToPreferIds, repairDiaasWeakLinks } from "./planner-micro-pools";
import { applyMealTargetOverrides } from "./planner-meal-targets";
import { publishPlanTargets } from "./plan-targets-bridge";
import { correctDayToTargets } from "./day-target-corrector";
import { safeWriteJSON, migratePlannerStorage } from "./planner-storage";
import { readPlannerPrefs, writePlannerPrefsPatch } from "./planner-prefs";
import { localIsoDate } from "./planner-date-utils";
import { loadVarietyLedger, saveVarietyLedger, LEDGER_WEEK_FAMILIES_CAP } from "./planner-variety-ledger";
// P1-7: ������ ������� ������� �������� � planner-report-state.ts (�����-1)
import { buildMealPrep } from "./planner-mealprep"; // P1-7: generateMealPrep �������
import { useRenderMealList } from "./MealListRender"; // P1-7: renderMealList �������
import { usePlannerReportState } from "./planner-report-state"; // �����-1: ��������� ������� �������� � ���-���
import { usePlannerDerivedSync } from "./planner-derived-sync"; // G2: ������ ��������� �������/�������/������������
import { usePlannerSpecialMealState, effectiveSpecialMealTarget } from "./planner-special-meal-state"; // �����-1: ����-������/������������ � ���-���
import { getAutoExcludedFoodIds } from "./OrganLoadBadges"; // P2-12: organ-load auto restrictions
import { usePlannerModeState } from "./planner-mode-state";
import { usePlannerViewState } from "./planner-view-state";
import { usePlannerFoodPreferencesState } from "./planner-food-preferences-state";
import { usePlannerGenerationState } from "./planner-generation-state";
import { loadReplaceHistory, recordReplacement, getDeprioritizedIds, clearReplaceHistory, expandRecipePreferred, matchesCategoryPref, type CategoryPref, type Intolerances, type TasteProfile } from "./planner-preferences"; // Bug-infra: �����-���������� ������ // Bug-4: ������ ������� ������� ����-�����
import { resolveAllExcludedFoodIds, countExcludedByAllergens, matchesSelectedAllergen, selectedAllergenTags, getFoodAllergenTags } from "./planner-restrictions"; // FIX allergens-restrictions: ������ �������� ����������/�����������
import { DEFAULT_TRAIN_SCHEDULE, normalizeTrainSchedule, isTrainingDayFor, weeklyTrainingCount, buildTrainSchedule, type TrainScheduleType, type TrainSchedule } from "./planner-training-schedule"; // FIX train-bind: ��������� ������ ����������
import { decomposeRecipe, pickRecipeForMeal, pickRecipesForMeal, cookProfileFromSettings, prepTimeBudgetPerMeal, filterByCookSkill, type CookProfile } from "./recipe-engine";
import { kbjuFormulaDeviationPct, isMainMealLabel, mealTypeFromLabel, flattenRecipeOption, rebuildRecipeFromFlat, buildRecipeMealItems, sumMealTotals, sumDayTotals, pickRecipeOptions, rebalanceDayAfterRecipes, buildShoppingFromPlans, buildRecipeCookingPlan, collectAppliedRecipes, assembleRecipeDay, scaleRecipeToTarget, recipeCompatibility, shrinkFirstForSecond, filterRecipePoolForBand } from "./planner-recipe-mode";
import type { FlatRecipeOption } from "./planner-recipe-mode";
import { SUPPORT_CATALOG_DATA } from "../../../../data/support-catalog-data";
import type { LabCompositeResult } from "../../../../engines/lab-analysis.engine";
import { buildDayPlan as buildDayPlanV2, snapPortionG, type DayPlanV2, type MealPlanInput, type BreakfastStyle, type BreakfastTemplateId } from "./meal-plan-engine";
import { stapleFamilyOf, isPeriLikeMeal } from "./food-availability";
import { getYesterdaySummary, computeCompensation, computeRollingCompensation, type CompensationResult } from "./planner-diary-adaptation";
import { getMenstrualPhaseNutrition, getCalciumTarget, calciumDoseSplitNote, getFemaleSupplementRules, type MenstrualPhase, getLifeStageNote, type LifeStage, computeEnergyAvailability } from "./planner-female-cycle";
import { autoCyclePhase, CYCLE_PHASE_RU } from "./planner-cycle-calendar";
import { addDayScore } from "../../../../engines/day-score-trend";
import { getBBCategory, type BBCategory, getCategoryDeficitMod, getCombinedDeficitMod } from "./planner-categories";
import { computePeakWeekNutritionTargets, deserializeBBPrepConfig, serializeBBPrepConfig, legacyConfigFromProfile, isoToday, isoAddDays, planFromStored, configFromPlan, nutritionTargetsForPrepDate, prepPhaseForDate, PREP_SODIUM_BASE_MG, type BBContestPrepConfig, type BBContestPrepPlan } from "../../../../engines/bb/bb-contest-prep.engine";
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
import { usePlannerModeState } from "./planner-mode-state";
import { usePlannerViewState } from "./planner-view-state";
import { usePlannerFoodPreferencesState } from "./planner-food-preferences-state";
import { usePlannerGenerationState } from "./planner-generation-state";

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
  /** P0-�����: ��������� ������ ������ � weekPlan (��� stale-���������). */
  loadMonthWeekIntoPlan: (wi: number) => boolean;
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
  /** ���� A: ���������������� ������ ����� (TDEE > ������������ > �������). */
  dayTargetsBreakdown: string[];
  carbCapClipped: boolean;
  carbCapGPerKg: number;
  rawCarbsForCap: number;
  kbjuMode: string; setKbjuMode: (v: any) => void;
  switchKbjuMode: (mode: any) => void;
  manualKcal: number | null; setManualKcal: (v: any) => void;
  manualP: number | null; setManualP: (v: any) => void;
  manualF: number | null; setManualF: (v: any) => void;
  manualC: number | null; setManualC: (v: any) => void;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  budget: BudgetLevel; setBudget: (v: BudgetLevel) => void;
  /** ���� 3: �����-������ (1.6-2.2 �/��) � ������������ �������� ����� (legacy nutrLevel �����). */
  proteinPreset: NutritionLevel; setProteinPreset: (v: NutritionLevel) => void;
  variety: string; setVariety: (v: any) => void;
  diaryAdaptation: boolean; setDiaryAdaptation: (v: boolean) => void;
  varietyStrictness: 'soft' | 'strict'; setVarietyStrictness: (v: 'soft' | 'strict') => void;
  /** P1-6 (HV-����� 800-1500�/500�): real = ������ (����-�-����). */
  hvStyle: 'real' | 'practical' | 'mixed'; setHvStyle: (v: 'real' | 'practical' | 'mixed') => void;
  /** P1-9: ������ ������� � ����� �������� ���������������� ������� ����� �/��. */
  carbCapOverride: boolean; setCarbCapOverride: (v: boolean) => void;
  /** v6: ������ ������������ (low/medium/high = variety+strictness) */
  varietyLevel: VarietyLevel; setVarietyLevel: (v: VarietyLevel) => void;
  wakeTime: string; setWakeTime: (v: string) => void;
  bedTime: string; setBedTime: (v: string) => void;
  lunchTime: string; setLunchTime: (v: string) => void;
  dinnerTime: string; setDinnerTime: (v: string) => void;
  mealsCount: number;
  workFood: string; setWorkFood: (v: any) => void;
  morningTrainLoad: boolean; setMorningTrainLoad: (v: boolean) => void;
  allergens: string[]; setAllergens: (v: any) => void;
  healthIssues: string[]; setHealthIssues: (v: any) => void;
  eveningLowCarb: boolean; setEveningLowCarb: (v: boolean) => void;
  nightCarbs: number; setNightCarbs: (v: number) => void;
  addMilkToBreakfast: boolean; setAddMilkToBreakfast: (v: boolean) => void;
  // G4: coconutOilBoost ������� �� ���� (������ ��������� � ������� �� ������ �� ���������)
  breakfastStyle: BreakfastStyle; setBreakfastStyle: (v: BreakfastStyle) => void;
  breakfastTemplate: BreakfastTemplateId; setBreakfastTemplate: (v: BreakfastTemplateId) => void;
  planType: PlanType; setPlanType: (v: PlanType) => void;
  preferredFoods: string[]; setPreferredFoods: (v: any) => void;
  excludedFoods: string[]; setExcludedFoods: (v: any) => void;
  preferredByMeal: Record<string, string[]>; setPreferredByMeal: (v: any) => void;
  
intolerances: Intolerances; setIntolerances: (v: any) => void;
  tasteProfile: TasteProfile; setTasteProfile: (v: any) => void;
  excludedCategories: string[]; setExcludedCategories: (v: any) => void;
  allergenExcludedCount: number; setAllergenExcludedCount: (v: number) => void;
  planTargets: any; setPlanTargets: (v: any) => void;
  /** v6+ (���� 1): ������ ������������ ��������� (legacy cyclingMode/dietPause/periodizationEnabled �������). */
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
  addSecondRecipeToMeal: (recipe: Recipe, mealIdx: number, dayIdx: number, opts?: { shrinkFirst?: boolean; forceFull?: boolean; acceptedMini?: boolean; mealsOverride?: any[]; snackFreedKcal?: number }) => void;
  /** P4a-������: �������� ������� ������� � �������� ������ (null � ��� ���������). */
  secondRecipeConflict: { dayIdx: number; mealIdx: number; recipe: Recipe; targetKcal: number; firstKcal: number; roomKcal: number; miniKcal: number } | null;
  setSecondRecipeConflict: (v: any) => void;
  /** P4a-������: �������� ������ ���������, ���� �������� (������� �� ������). */
  addSecondRecipeWithSnackRoom: () => void;
  /** v2.1: ������ ������� ������� ������� (������ ?0.5/?1/?1.5/?2). ������ � �����������, �� ���������. ��������� ����� �������������� ���������� (�����). */
  rescaleSecondRecipeInMeal: (mealIdx: number, dayIdx: number, scale: number) => void;
  /** v2.1: ������ ������ ������ �� ����� (������ �������). ��������� ����� ��������������. */
  removeSecondRecipeFromMeal: (mealIdx: number, dayIdx: number) => void;
  addFoodToMeal: (dayIdx: number, mealIdx: number, food: any) => void;
addSnackComboToMeal: (dayIdx: number, mealIdx: number) => void;
  generatePlan: (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean; async?: boolean; overrides?: { mealsCount?: number } }) => void;
  /** ����� ���������: �������� (��������) ��� ������� (�������� ����� �� ������� ��������). */
  generationMode: 'products' | 'recipes'; setGenerationMode: (v: 'products' | 'recipes') => void;
  /** G1 (�����/�������): ����� ����������� ���� � 'cooked' (��� �� �������) / 'raw' (��� ���������� �����). */
  weightMode: 'cooked' | 'raw'; setWeightMode: (v: 'cooked' | 'raw') => void;
  /** ? ��������� �������: ����� + ������� + �������� (����� � �����, ����� ��������). */
  favoriteRecipes: Set<string>; toggleFavoriteRecipe: (name: string) => void; isFavoriteRecipe: (name: string) => boolean;
  /** ������� ���� �� 2�3 ��������� ������� ��� ����� (����� ��� ��������) � ���� �������������� � ���������� ��������, ���� ������������ �� �3%. */
  pickRecipeOption: (dayIdx: number, mealIdx: number, optionName: string) => void;
  /** �?? ������ ���������: ������������� ���� ���������� �������, �������� ����������. */
  moreRecipeOptions: (dayIdx: number, mealIdx: number) => void;
  /** ?? ������ �������: ������������� �����-��������� ���, �������� ��� ����������. */
  refreshRecipeSuggestions: (dayIdx?: number) => void;
  /** ?? ������� �����: ������� ���� � ����������� ���� (�������� �3%), ���� �������/�������. */
  removeMealRebalanced: (dayIdx: number, mealIdx: number) => void;
  /** P4b: ??-���� ����� ��������� ����� � �������� ��� (������� + �������� + ����). */
  applyMealTargetNow: (label: string, dayIdx?: number) => void;
  updateMealTime: (mealIdx: number, time: string) => void;
  duplicateMeal: (mealIdx: number) => void;
  toggleAllergen: (id: string) => void;
  toggleHealthIssue: (id: string) => void;
  loadSavedPlan: (plan: SavedPlan) => void;
  /** ��������� �������� �� ������� (UnifiedSettings) � ��������� useState. */
  autofillFromProfile: () => void;
  /** ��������� ������� ��������� �������� � ������� (UnifiedSettings). */
  saveToProfile: () => void;
  generateCheatMeal: () => void;
  generateCarbload: () => void;
  generateBUTCH: () => void;
  generateCravingPlan: () => void;
  generateLazyDayPlan: () => void;
  generateRecommendations: () => void;
  autoCorrectPlan: () => void;
  saveCurrentPlan: () => void;
  /** FatSecret-�������: 1-���� ���������� �������� ����� (����/��������� ���� ������) � ������� ������� */
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
  /** �.18: �������� ���� ���� ��� ������� ({ week, block } | null) � �������� �?? ������� ���� ����. */
  annualPhase: { week: number; block: AnnualBlockState } | null;
  /** Combat/Strength ����������: payload ������� �� ����� �����������/���� */
  combatNutrition: any;
  cyclePhase: string; setCyclePhase: (v: any) => void;
  bbCategory: BBCategory; setBBCategory: (v: any) => void;
  peakWeekEnabled: boolean; setPeakWeekEnabled: (v: boolean) => void;
  peakWeekShowDay: number; setPeakWeekShowDay: (v: number) => void;
  /** ������ ������� ������ �� (bb-contest-prep.engine): ������ ������-������. */
  bbPrepConfig: BBContestPrepConfig | null; setBBPrepConfig: (v: BBContestPrepConfig | null) => void;
  /** ��������� ������ � ������� � ���������������� ���� ������� � ��������. */
  applyBBPeakToPlan: (cfg: BBContestPrepConfig | null) => void;
  /** Combat/Strength > �������: ��������� payload ����������� � ������� ���� � ����������������. */
  applyCombatNutrition: () => void;
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
  // P0-2: useProEngine � ������ TRUE (������ toggle �����); ������ �� ���������� � try/catch fallback �� ������������ ���� � generatePlan.
  // Cross-tab navigation: allows sub-tabs to switch to each other
  planTab: string; setPlanTab: (v: string) => void;
}

const _DEFAULT_CALC_TARGETS = { kcal: 2500, protein: 160, fats: 70, carbs: 300, bmr: 0, tdee: 0, adjustment: 0 };
const _DEFAULT_CTX: any = { calcTargets: _DEFAULT_CALC_TARGETS, profileTargets: _DEFAULT_CALC_TARGETS, effectiveKcal: 2500, effectiveP: 160, effectiveF: 70, effectiveC: 300, weight: 80, height: 180, age: 30, sex: 'male' as const, annualPhase: null };
const PlanContext = createContext<PlanCtx>(_DEFAULT_CTX as PlanCtx);
export const usePlanCtx = (): PlanCtx => useContext(PlanContext);

/**
 * P4a: ����� ������� � ������ ������� (������ �������, �����������).
 * ������ ����� ����-������ � �������� ����: ����� ��� (������� ? 0) > 'abort'
 * (������������ ��� ?? ��� ������ ������); ���� ����� (< 25% ����) > 'mini';
 * ����� 'full'. ���������� �������� � ������� � ����.
 */
export function secondRecipeRoomDecision(targetKcal: number, firstKcal: number): { action: 'abort' | 'mini' | 'full'; roomKcal: number } {
  const t = Number.isFinite(targetKcal) && targetKcal > 0 ? targetKcal : 0;
  const rawRoom = t - (Number.isFinite(firstKcal) ? firstKcal : 0);
  if (t <= 0 || rawRoom <= 0) return { action: 'abort', roomKcal: 0 };
  if (rawRoom < 0.25 * t) return { action: 'mini', roomKcal: rawRoom };
  return { action: 'full', roomKcal: rawRoom };
}

/**
 * P4a-������: ������ ��������� ��� ������ ������ (������ �������, �����������).
 * ����������� needKcal, ��������������� ������ ������������ ������ ���������
 * (��� _fixedGrams), �� �� ���� 50% ������ � 10 �. ���������� ����� ������
 * ������ � ���������� ������������ ����.
 */
export function freeSnackRoomForSecond(
  mealsIn: any[], excludeMealIdx: number, needKcal: number, lockedIds?: Set<string>,
): { meals: any[]; freedKcal: number } {
  let need = Math.max(0, Math.round(needKcal || 0));
  let freed = 0;
  const meals = (mealsIn || []).map((m: any, mi: number) => {
    if (mi === excludeMealIdx || need <= freed) return m;
    const t = String(m?.type || '');
    const lb = String(m?.label || '');
    if (!(t.startsWith('snack') || /�������|�������/i.test(lb))) return m;
    const items = ((m.items || []) as any[]).map((it: any) => ({ ...it }));
    const order = items.map((_, ii) => ii).filter(ii => {
      const it = items[ii];
      if ((it as any)._fixedGrams) return false;
      if (lockedIds && lockedIds.has(it.id)) return false;
      return (it.kcal || 0) > 0 && (it.amount || 0) > 0;
    }).sort((a, b) => items[b].kcal - items[a].kcal);
    for (const ii of order) {
      if (need <= freed) break;
      const it = items[ii];
      const minAmount = Math.max(10, (it.amount || 0) * 0.5);
      if ((it.amount || 0) <= minAmount) continue;
      const take = Math.min(it.kcal || 0, need - freed);
      if (take <= 0) continue;
      const oldKcal = it.kcal || 0;
      const factor = Math.max(0, (oldKcal - take) / Math.max(1, oldKcal));
      const newAmount = Math.max(minAmount, Math.round((it.amount || 0) * factor));
      const r = newAmount / Math.max(1, it.amount || 1);
      it.amount = newAmount;
      it.p = Math.round((it.p || 0) * r * 10) / 10;
      it.f = Math.round((it.f || 0) * r * 10) / 10;
      it.c = Math.round((it.c || 0) * r * 10) / 10;
      it.fiber = Math.round((it.fiber || 0) * r * 10) / 10;
      it.kcal = Math.round(4 * it.p + 9 * it.f + 4 * it.c);
      freed = Math.round(freed + Math.max(0, oldKcal - it.kcal));
    }
    // �������� ����� ����� �� �������.
    let tk = 0, tp = 0, tf = 0, tc = 0, tfi = 0;
    for (const it of items) { tk += it.kcal || 0; tp += it.p || 0; tf += it.f || 0; tc += it.c || 0; tfi += it.fiber || 0; }
    return { ...m, items, totals: { ...(m.totals || {}), kcal: Math.round(tk), p: Math.round(tp * 10) / 10, f: Math.round(tf * 10) / 10, c: Math.round(tc * 10) / 10, fiber: Math.round(tfi * 10) / 10 } };
  });
  return { meals, freedKcal: Math.max(0, Math.round(freed)) };
}

export const IndividualPlanProvider: React.FC<{ profile: UserProfile | null; course?: any[]; labs?: LabPoint[]; labAnalysis?: LabCompositeResult | null; children: React.ReactNode }> = ({ profile: _profile, course: _course, labs = [], labAnalysis, children }) => {
  // Run schema migration first � drops stale localStorage entries that would crash
  // with "cannot read properties of undefined (reading length)" on first render.
  try { migratePlannerStorage(); } catch {}
  const profile = _profile || getProfileSafe();
  const s = profile?.settings;
  const courseEntries = _course || [];

  const [weight, setWeight] = useState(s?.personal?.weight || 80);
  const [height, setHeight] = useState(s?.personal?.height || 180);
  const [age, setAge] = useState(s?.personal?.age || 30);
  const [sex, setSex] = useState<'male' | 'female'>(s?.personal?.sex || 'male');
  const [dailySteps, setDailySteps] = useState(s?.lifestyle?.dailySteps || 8000);
  // FIX persist-settings: ������ ������ ��������� ������������ ������������ (he_planner_prefs).
  // ������ ~24 ��������� (������, �����, ����� ������, ���� ���� � �.�.) ������������ ���
  // ������������ � ������ ������������ �� ���� �� � localStorage, �� � �������.
  const _plannerPrefsRef = useRef<Record<string, any>>({});
  if (Object.keys(_plannerPrefsRef.current).length === 0) _plannerPrefsRef.current = readPlannerPrefs();
  const _pf = _plannerPrefsRef.current;
  const [cookTimeMin, setCookTimeMin] = useState<number>(typeof _pf.cookTimeMin === 'number' ? _pf.cookTimeMin : 60);
  const [cookingSkill, setCookingSkill] = useState<'basic' | 'medium' | 'advanced'>((_pf as any).cookingSkill === 'advanced' ? 'advanced' : (_pf as any).cookingSkill === 'medium' ? 'medium' : 'basic');
  const [cookingFrequency, setCookingFrequency] = useState<'daily' | 'every_3_days' | 'weekly'>((_pf as any).cookingFrequency === 'weekly' ? 'weekly' : (_pf as any).cookingFrequency === 'every_3_days' ? 'every_3_days' : 'daily');
  const [batchCooking, setBatchCooking] = useState<boolean>(!!(_pf as any).batchCooking);
  const [cravingMode, setCravingMode] = useState<boolean>(!!_pf.cravingMode);
  const [cravingDays, setCravingDays] = useState<number>(typeof _pf.cravingDays === 'number' ? _pf.cravingDays : 1);
  const [lazyDayMode, setLazyDayMode] = useState<boolean>(!!_pf.lazyDayMode);
  const [lazyDayDays, setLazyDayDays] = useState<number>(typeof _pf.lazyDayDays === 'number' ? _pf.lazyDayDays : 1);
  // P1-fix (Aug 5 2026): ������ �� UnifiedSettings ����� proxy, � �� �� ������� localStorage
  // (����� �������� he_surplus_pct ����� > default). �������� �������� � profile.nutrition.surplusPct.
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
  // ���� 3 (������-5): ����� ������������� intra-workout (�� ����� 'high').
  // �� ��������� ���.; �������� � ��� medium/low (������ ��� ������ �� ������������ ?75 ���).
  const [intraWorkoutEnabled, setIntraWorkoutEnabled] = useState<boolean>(typeof _pf.intraWorkoutEnabled === 'boolean' ? _pf.intraWorkoutEnabled : true);
  const [householdActivity, setHouseholdActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active'>((['sedentary', 'light', 'moderate', 'active'] as const).includes(_pf.householdActivity as any) ? _pf.householdActivity : 'light');
  const [bodyFatPct, setBodyFatPct] = useState<number>(() => {
    // P1-fix: ������ �� Profile (UnifiedSettings) ����� proxy
    try {
      const v = s?.personal?.bodyFat;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    return 15;
  });
  const [sleepHours, setSleepHours] = useState<number>(() => {
    try {
      const v = s?.lifestyle?.sleepHours;
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
      const v = s?.lifestyle?.stressLevel;
      if (typeof v === 'number' && v > 0) return v;
    } catch {}
    return 5;
  });
  const [cyclePhase, setCyclePhase] = useState<'none' | 'follicular' | 'ovulation' | 'luteal' | 'menstrual'>((['none', 'follicular', 'ovulation', 'luteal', 'menstrual'] as const).includes(_pf.cyclePhase as any) ? _pf.cyclePhase : 'none');
  // P1-fix: ������ �� UnifiedSettings (goals.bbCategory), � �� �� ������� he_bb_category
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
  // -- ������ ������� ������ ��: �������� �� ������� (bbPeakConfig) � legacy-fallback --
  const [bbPrepConfig, setBBPrepConfigState] = useState<BBContestPrepConfig | null>(() => {
    try {
      const raw = (s as any)?.goals?.bbPeakConfig;
      if (raw) {
        const cfg = deserializeBBPrepConfig(raw);
        if (cfg) return cfg;
      }
      // ������ ���������������� ���� (bbContestPrepPlan) ��� ������� �������: ������������
      // ������ �� ����� � ����� ���������� ����� �� ���������� (bbPrepConfig === null),
      // �� ���� ������� �������� � ����� �������� �� ���-��������� (~300 �).
      const p = planFromStored((s as any)?.goals?.bbContestPrepPlan, null, (s as any)?.goals, (s as any)?.personal);
      if (p) return configFromPlan(p);
      return legacyConfigFromProfile((s as any)?.goals, (s as any)?.personal);
    } catch { return null; }
  });
  // ?? ������ ���������������� ���� contest prep (goals.bbContestPrepPlan) � ��������� ��� ��������:
  // ��������� ����������/�����/���-������ �������� ������ (nutritionTargetsForPrepDate).
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
    // ������ ������: ���������������� ���� + ������� ������� + �������.
    // PRO-3 �1/�4: prepWeeks �� ������� (carry-over �� �����: �� ���������� 16 ��� � 12);
    // ������ ������ � �� �������� ������������ cfg.weeksOut.
    try {
      const plan = saveContestPrepEverywhere(cfg, { source: 'planner', taperWeeks: cfg.weeksOut });
      if (plan) {
        setBBPrepConfigState(cfg);
        setBBPrepPlan(plan);
        return;
      }
    } catch {}
    // fallback � ������ ������, ���� ������ ����� �� �������
    setBBPrepConfigState(cfg);
    setBBPrepPlan(null);
    try {
      updateSection('goals', { bbPeakConfig: serializeBBPrepConfig(cfg), peakWeek: true, peakShowDay: cfg.showDate });
    } catch {}
  };
  // legacy peakWeekEnabled/peakShowDay � ������ ����������� �� bbPrepConfig (������ ����)
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
      const iso = localIsoDate(d);
      setBBPrepConfig({ ...base, showDate: iso });
    } catch {}
  };
  // ?? ����� �������������: ������� he-bb-contest-prep-updated �� BB Auto / �������
  // (������/������� prep-����) > ���������� ������ ���� �� �������.
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
  // ����������� ��������: ����� bbPeakConfig > ���������������� ����
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
  // ?? ������� ���� (������� he-annual-training-plan-updated): ����� ������������
  // �������� ������ � ��� ��������� ������� ���� = contest prep� ��� �������.
  const [annualPlan, setAnnualPlan] = useState<AnnualTrainingPlan | null>(null);
  useEffect(() => {
    const onAnnualUpdated = () => {
      try { setAnnualPlan(loadAnnualTrainingPlan()); } catch { /* ignore */ }
    };
    try { setAnnualPlan(loadAnnualTrainingPlan()); } catch { /* ignore */ }
    window.addEventListener('he-annual-training-plan-updated', onAnnualUpdated);
    return () => window.removeEventListener('he-annual-training-plan-updated', onAnnualUpdated);
  }, []);
  // Combat/Strength ���������� � ������� he-combat-updated / he-strength-updated
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
  // �.18: �������� ���� ���� ��� ������� (�������� �?? ������� ���� ���� � UI �����).
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
  const applyCombatNutrition = () => {
    if (!combatNutrition) return;
    try {
      const cn: any = combatNutrition;
      if (cn.kcal) setManualKcal(Math.round(cn.kcal));
      if (cn.proteinG) setManualP(Math.round(cn.proteinG));
      if (cn.fatG) setManualF(Math.round(cn.fatG));
      if (cn.carbsG) setManualC(Math.round(cn.carbsG));
      setKbjuMode('manual');
      // ���������: ���� ���� ��������� � ������� ������� � ����
      setTimeout(() => {
        try { generatePlan(planDays as 1 | 3 | 7, undefined, selectedDayIndex); setPlanTab('plan'); } catch {}
      }, 0);
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
  const [heavyTrainDay, setHeavyTrainDay] = useState<string>(typeof _pf.heavyTrainDay === 'string' && ['��', '��', '��', '��', '��', '��', '��'].includes(_pf.heavyTrainDay) ? _pf.heavyTrainDay : '');
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
    for (let i = 0; i < 3; i++) { const d = new Date(); d.setDate(d.getDate() - (2 - i)); e.push({ date: localIsoDate(d), weight: 80 }); }
    return e;
  });
  const [weightLogPeriod, setWeightLogPeriod] = useState<string>(typeof _pf.weightLogPeriod === 'string' ? _pf.weightLogPeriod : 'every3');
  useEffect(() => {
    try {
      // ������������ ���: ��������� weight � ������������ �������, ��������� �����������
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
      // Legacy-������� ��� �������� �������������
      localStorage.setItem('he_weight_log_entries', JSON.stringify(weightLogEntries));
    } catch {}
    setWeightLogWeek(weightLogEntries.filter(e => Number.isFinite(e.weight) && e.weight > 0).map(e => e.weight));
  }, [weightLogEntries]);
  const [metabolicAdaptEnabled, setMetabolicAdaptEnabled] = useState<boolean>(!!_pf.metabolicAdaptEnabled);
  const [metabolicAdaptPct, setMetabolicAdaptPct] = useState<number>(typeof _pf.metabolicAdaptPct === 'number' ? _pf.metabolicAdaptPct : 10);
  // P1-fix: manualGPerKg ���������������� �� Profile (UnifiedSettings.nutrition.manualGPerKgSplit) + legacy
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
      // ��������: ������ ���������� �������� ������ ������ � numeric proteinPerKg.
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
  // P0-�����: ������� monthPlan � ref. ����� async-��������� ������ ������ ������
  // monthPlan �� ��������� (stale � ������ �� setMonthPlan([])), ����� �� ������
  // ������� ������/����� ������ 0. ������ ������ ��� ����� ref.
  const monthPlanRef = useRef<any[]>(monthPlan);
  useEffect(() => { monthPlanRef.current = monthPlan; }, [monthPlan]);
  /** ��������� ������ ������ � weekPlan (��� ���� �������� ������ ������). */
  const loadMonthWeekIntoPlan = (wi: number) => {
    const w = monthPlanRef.current[wi];
    if (w?.days?.length) { setWeekPlan(w); return true; }
    return false;
  };
  const [selectedWeek, setSelectedWeek] = useState(0);
  // E4-sync: ������ �������� ���� (����� weekPlan/weekEditDay � TDZ-guard).
  const [goal, setGoal] = useState<GoalId>(((s?.goals?.primaryGoal || s?.training?.primaryGoal) as GoalId) || 'maintenance');
  const [phase, setPhase] = useState<PhaseId>((_pf.phase && (GOALS.some(g => g.id === _pf.phase) || PHASES.some(p => p.id === _pf.phase))) ? _pf.phase as PhaseId : 'course');
  // ���� 2: ����-���� �� ��������� �� ���� (���� � �����-��������, �� ����).
  // ������������ � �� ������� (primaryGoal) ���� �����������.
  const profilePrimaryGoal = ((s?.goals?.primaryGoal || s?.training?.primaryGoal) as GoalId) || 'maintenance';
  const autoGoal: GoalId = profilePrimaryGoal !== 'maintenance' ? profilePrimaryGoal : 'maintenance';
  const [goalUserSet, setGoalUserSet] = useState(false);
  // FIX 1.2: ����-���� ����������� ������ ���� ������������ ���� �� ������ ����
  // � � ������� ��� ��-����������� ��������� ���� (����� goal = primaryGoal �� �������).
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
        const name = substance?.name || ce.substanceId || ce.name || '��������';
        const halfLife = substance?.pk?.halfLifeHours || 24;
        let type = '������';
        let esterType: 'rapid' | 'short' | 'long' | 'none' = 'none';
        if (substance?.class === 'insulin') { type = '�������'; if (halfLife < 2) esterType = 'rapid'; else if (halfLife <= 8) esterType = 'short'; else esterType = 'long'; }
        else if (substance?.id?.includes('ghrp') || substance?.id?.includes('cjc') || substance?.id?.includes('sermorelin') || substance?.class === 'peptide_ghrh' || substance?.class === 'peptide_ghrp') { type = '��'; esterType = 'short'; }
        else if (substance?.id?.includes('igf1') || substance?.id?.includes('mgf')) { type = '���-1'; esterType = 'short'; }
        else if (substance?.class === 'glp1') { type = '����������'; esterType = 'long'; }
        else if (substance?.id?.includes('bpc') || substance?.id?.includes('tb500')) { type = '������'; esterType = 'none'; }
        else if (substance?.class && ['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone'].includes(substance.class)) { type = '���'; const esters = substance.esters || []; if (esters.some((e: string) => ['propionate','acetate','phenylpropionate'].includes(e))) esterType = 'short'; else if (esters.some((e: string) => ['enanthate','cypionate'].includes(e))) esterType = 'long'; else esterType = 'long'; }
        return { id: `course_${ce.substanceId}_${Date.now()}`, name, time: type === '�������' ? (esterType === 'long' ? '22:00' : '08:00') : '08:00', dose: ce.doseValue || 10, unit: ce.doseUnit || 'mg', type, esterType, halfLifeHours: halfLife, trainLinked: false, trainTiming: 'before' as 'before' | 'after' | 'both' | 'none' };
      });
    }
    return [];
  });

  const [injName, setInjName] = useState('');
  const [injTime, setInjTime] = useState('08:00');
  const [injDose, setInjDose] = useState(10);
  const [injUnit, setInjUnit] = useState('mg');
  const [injType, setInjType] = useState('�������');
  const [injEster, setInjEster] = useState<'rapid' | 'short' | 'long' | 'none'>('none');
  // FIX train-bind: ������ ���������� ����������� � he_train_bind � �������� ��� ������
  // (������ linkToTraining/trainStart/trainEnd/trainingDays ������������ ��� ������������).
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
  // FIX train-bind: trainingDays ������ ���� �������� �� calcTargets (TDZ fix � ��� �����, ����� TS2448)
  const [trainingDays, setTrainingDays] = useState<boolean[]>([..._trainBindInit.weeklyDays]);
  // FIX train-bind: ������� ������� ���������� (�������� ����� ���������� trainingDays)
  useEffect(() => {
    try {
      safeWriteJSON('he_train_bind', buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern));
    } catch {}
  }, [linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern]);
  // FIX train-bind: ������ ������� �������������� ����?� ��� ���� ������� �������.
  const isTrainDay = (offset: number): boolean => linkToTraining && isTrainingDayFor(buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern), offset);
  const DAY_LABELS = ['��', '��', '��', '��', '��', '��', '��'];
  const injectDrugTypes = ['�������', '��', '���-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', '���������', '����������', '����������', '������'];

  const calcTargets = useMemo(() => {
    try {
      const _localWorkoutsPerWeek = (() => {
        if (linkToTraining) return weeklyTrainingCount(buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern));
        const profileDays = Number((s as any)?.training?.daysPerWeek);
        return Number.isFinite(profileDays) && profileDays > 0 ? Math.round(profileDays) : 3;
      })();
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
  }, [weight, height, age, sex, goal, trainingDays, linkToTraining, trainStart, trainEnd, trainScheduleType, trainPattern, s?.training?.daysPerWeek, s?.training?.minutesPerSession, injections, phase, bodyFatPct, weightAdaptMode, weightLogWeek, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, dailySteps, householdActivity, trainType, trainIntensity, surplusPct]);

  // FIX: manual KBJU + kbjuMode ������ ���������������� �� localStorage � �����������.
  // ������ ��� ������������ �������� ��� ������ ���� ���� ������������ �� null, � ����� � �� 'auto'.
  // P1-fix: manualKcal/P/F/C �� Profile (UnifiedSettings.nutrition.manualTargets) + legacy
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
    // P1-fix: ������ �� Profile (UnifiedSettings.nutrition.kbjuMode)
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
        weightKg: s?.personal?.weight || weight, heightCm: s?.personal?.height || height,
        age: s?.personal?.age || age, sex: s?.personal?.sex || sex,
        goal: 'maintenance', phase: 'maintenance', bodyFatPct,
        workoutsPerWeek: s?.training?.daysPerWeek || 3, avgWorkoutMinutes: s?.training?.minutesPerSession || 60,
        dailySteps, householdActivity, trainType, trainIntensity, surplusPct: 10,
        injections: [],
        weightAdaptMode: false, weightLogWeek: [], expectedLossKgWeek: 0,
        metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
        manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
      });
    } catch { return { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.personal?.weight, s?.personal?.height, s?.personal?.age, s?.personal?.sex, s?.training?.daysPerWeek, s?.training?.minutesPerSession, bodyFatPct, dailySteps, householdActivity, trainType, trainIntensity]);

  // ���� 3: �����-������ (�/��) � ������������ �������� �����; legacy nutrLevel
  // (������ ��������� ����� �� N% ������) ����� ���������.
  // ���� 1.6�2.2 �/��; legacy 'max' (2.6 �/��, ���� �� UI) ������������� � 'enhanced' (2.2),
  // ����� ������ ���������� �� ���������� ����� ������ 2.6 �/��. ���� 2.2 � ������ ����� ����.
  const _PROTEIN_PRESET_IDS = ['base', 'medium', 'enhanced'] as const;
  const _legacyProteinPreset = (['base', 'medium', 'enhanced', 'max'] as const).includes((_pf as any).proteinPreset as any)
    ? (_pf as any).proteinPreset
    : (['base', 'medium', 'enhanced', 'max'] as const).includes(_pf.nutrLevel as any) ? _pf.nutrLevel : 'base';
  const [proteinPreset, setProteinPreset] = useState<NutritionLevel>(
    (_PROTEIN_PRESET_IDS as readonly string[]).includes(_legacyProteinPreset as string) ? (_legacyProteinPreset as NutritionLevel) : 'enhanced',
  );
  const _proteinGPerKg = PROTEIN_PRESETS.find(p => p.id === proteinPreset)?.gPerKg || 2.0;
  // P1-9: ������ ������� � ����� �������� ���������������� ������� ����� �/��
  // (������ �������� carbCapGPerKg: 0 = ���� �������; UI-warning ����������).
  // �������� �� dayTargets: ���� ��� ������ ����, ����� TDZ �� ������ �������.
  const [carbCapOverride, setCarbCapOverrideState] = useState<boolean>(() => {
    try { return localStorage.getItem('he_planner_cap_override') === '1'; } catch { return false; }
  });
  const setCarbCapOverride = (v: boolean) => {
    setCarbCapOverrideState(v);
    try { localStorage.setItem('he_planner_cap_override', v ? '1' : '0'); } catch {}
  };

  // ���� A (NUTRITION-PLANNER-QUALITY-PLAN): ����������� ���� ��� � ������ ������ �������
  // buildDayTargets (planner-day-targets.ts). ����� (TDEE>surplus>����>�����>weight-adapt>
  // metabolic>female gate) ����� �������, ������ ����� � ��������, ���� � ������� �� ����.
  // effectiveP/F/C/Kcal ��������� ������� ����� (100+ ������������).
  const [budget, setBudget] = useState<BudgetLevel>((['low', 'medium', 'max', 'enhanced'] as const).includes(_pf.budget as any) ? (_pf.budget === 'enhanced' ? 'max' : _pf.budget) : 'medium');
  // ���� 3: ����� ������� (planType) � �������� �����-������� keto/highcarb � ����� ���.
  const [planType, setPlanType] = useState<PlanType>((['classic', 'keto', 'highcarb', 'mediterranean', 'vegetarian'] as const).includes(_pf.planType as any) ? _pf.planType : 'classic');
  const [variety, setVariety] = useState<'minimal' | 'medium' | 'max'>((['minimal', 'medium', 'max'] as const).includes(_pf.variety as any) ? _pf.variety : 'max');
  const _insulinUnits = (injections || []).filter((i: any) => String(i?.type || '').toLowerCase().includes('�������')).reduce((s: number, i: any) => s + (Number(i?.dose) || 0), 0);
  // P1-����������: ����� ������ ���� �� ������������ ���������� (weeklyTrainingCount
  // ��������� eod/pattern/��� ������), � �� �� `trainingDays.filter(Boolean).length`
  // (��� ������ 7 ������, ������������ ��� ����������). ��� ����������� ��������
  // � ����������� ����� = 0: �������� �� ������ ����� ��� ���� ����������.
  const _trainVolMin = (() => {
    try {
      if (!linkToTraining) return 0;
      const sched = buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern);
      return weeklyTrainingCount(sched) * ((s as any)?.training?.minutesPerSession || 60);
    } catch { return 0; }
  })();
  const dayTargets = useMemo(() => buildDayTargets({
    weightKg: weight,
    presetGPerKg: _proteinGPerKg,
    fatFloorGPerKg: 0.8,
    kbjuMode,
    manual: { kcal: manualKcal, p: manualP, f: manualF, c: manualC, gPerKg: { protein: manualGPerKg.protein || 0, fat: manualGPerKg.fat || 0, carbs: manualGPerKg.carbs || 0 } },
    calcTargets,
    profileTargets,
    goal,
    trainingVolumeMinPerWeek: _trainVolMin,
    budget,
    insulinTotalUnits: _insulinUnits,
    dietStyle: planType,
    // P1-9 ������ �������: ������ � UI ������ ������ ������� � ���� ��� ���������
    // � �������� �/��. 0 = ��� ������� (�������� computeDieteticCarbTarget).
    carbCapGPerKg: carbCapOverride ? 0 : undefined,
  }), [weight, _proteinGPerKg, kbjuMode, manualKcal, manualP, manualF, manualC, manualGPerKg, calcTargets, profileTargets, goal, _trainVolMin, budget, _insulinUnits, planType, carbCapOverride]);
  const dayTargetsBreakdown: string[] = [...dayTargets.breakdown];
  // �4.25: ������ ������� ��-����� (he_bb_nutrition_note) � ������� + ����-��� ���
  // ������������ ���������. ����������� ������ ���� ���� ������ (no-op �����).
  // �������������� �� ������� planner-apply (������ �?? � ����������� ��������), ������ �
  // �������� �� ������� � ����� ������� �������������� ���� ��� ��� �������������� ������.
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
  const bbApplied = applyBBNutritionToTargets({
    protein: dayTargets.protein,
    fats: dayTargets.fats,
    carbs: dayTargets.carbs,
    bbNote: bbNutritionNote,
    // Manual: ������������ ����� ������ ���� � ��-���� �� �������� ���/���� (������ �������).
    locked: kbjuMode === 'manual',
  });
  const effectiveP = bbApplied.protein;
  const effectiveF = bbApplied.fats;
  const effectiveC = bbApplied.carbs;
  const _rawCForCap = kbjuMode === 'manual' ? dayTargets.carbs : kbjuMode === 'profile' ? profileTargets.carbs : calcTargets.carbs;
  // P1-9: ������ ������� � ����� �������� (�������� �� �������� ��������: ����
  // ����������� �� useState-����������, ��������� ���������������� �� ������ ������).
  const _capOverride = (() => { try { return localStorage.getItem('he_planner_cap_override') === '1'; } catch { return false; } })();
  const carbCapGPerKg = (() => {
    try {
      const schedule = buildTrainSchedule(linkToTraining, trainStart, trainEnd, trainingDays, trainScheduleType, trainPattern);
      const vol = linkToTraining ? weeklyTrainingCount(schedule) * ((s as any)?.training?.minutesPerSession || 60) : 0;
      return contextualCarbCapGPerKg(plannerGoalCategory(goal), vol, budget);
    } catch { return 5; }
  })();
  const carbCapClipped = (() => {
    // ������ �����: ���� ������������ � �������� ������, ������� �� ��������� �����.
    try { if (_capOverride || kbjuMode === 'manual') return false; return _rawCForCap > carbCapGPerKg * weight + 1; } catch { return false; }
  })();
  // Kcal �� ������ ������ (Atwater-������������ + ������� ������� ��-����� � �������� 15%).
  const effectiveKcal = bbApplied.kcal;
  dayTargetsBreakdown.push(...bbApplied.breakdown);

  const switchKbjuMode = (mode: typeof kbjuMode) => { if (mode === 'manual' && kbjuMode !== 'manual') { setManualKcal(effectiveKcal); setManualP(effectiveP); setManualF(effectiveF); setManualC(effectiveC); } if (mode !== 'manual') { setManualKcal(null); setManualP(null); setManualF(null); setManualC(null); } setKbjuMode(mode); };

  const resultsRef = useRef<HTMLDivElement>(null);
  // P1-fix: wakeTime/bedTime �� Profile (UnifiedSettings.lifestyle.wakeTime/bedtime) + legacy
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
  // D-28: ��������� ��� �������� ���������� � ������� ����� ���������, ������� �����.
  const [morningTrainLoad, setMorningTrainLoad] = useState<boolean>(!!_pf.morningTrainLoad);
  // ����� ������ � ���� (����� ������������ �����): ������� ���������� �������
  // (����� 0.45 �/��, �� �����/��� 0.55; ���� ?130 �; ���� ?950/����) + ����
  // �������� (������ ����� � ��������� ����-������) + ��������������� ��� �����.
  const _insulinBolusCount = (injections || []).filter((i: any) => /�������/i.test(String(i?.type || i?.name || ''))).length;
  const _onCourse = phase === 'course' || (injections || []).some((i: any) => /�������|���|����|����|�������|����|������|������|�����|�������/i.test(String(i?.type || i?.name || '')));
  const mealsCount = planMealStructure({
    awakeH: awakeHoursFromTimes(wakeTime, bedTime),
    proteinG: effectiveP,
    carbsG: effectiveC,
    kcal: effectiveKcal,
    weightKg: weight,
    onCourse: _onCourse,
    insulinBoluses: _insulinBolusCount,
  }).regularMeals;

  const [allergens, setAllergens] = useState<string[]>(() => {
    // P1-fix: ������ �� Profile (UnifiedSettings), � �� �� ������ ������ he_food_allergens/he_contraindications
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
  // P1-fix: eveningLowCarb �� Profile (UnifiedSettings.nutrition.eveningLowCarb) + legacy
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
  // v3: ���� �� ���� 0/20/40 (��������� ����� � ����). 0 = legacy (������ ������).
  const [nightCarbs, setNightCarbs] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('he_night_carbs'));
      if (v === 20 || v === 40) return v;
    } catch {}
    return 0;
  });
  const setNightCarbsPersist = (v: number) => {
    const nv = v === 40 ? 40 : v === 20 ? 20 : 0;
    setNightCarbs(nv);
    try { localStorage.setItem('he_night_carbs', String(nv)); } catch {}
  };

  // E8: ���������� ����� ������������ � ������ � �������� / ��������� ����� � ������.
  const [addMilkToBreakfast, setAddMilkToBreakfast] = useState<boolean>(() => {
    try { return localStorage.getItem('he_add_milk_breakfast') === 'true'; } catch {}
    return false;
  });
  // G4 (���� G): ������ ��������� coconutOilBoost ������� � ��� ������� �� ������������
  // � MealPlanInput � �� ������ �� ��������� (������ ������� ������ � �����������).
  // N1: ������� ����� �������� (������: ����/������/����/������).
  const [breakfastStyle, setBreakfastStyle] = useState<BreakfastStyle>(() => {
    try {
      const v = localStorage.getItem('he_breakfast_style');
      if (v === 'porridge' || v === 'flakes' || v === 'eggs' || v === 'cottage') return v;
    } catch {}
    return 'auto';
  });
  // N7: �������-������ (������� ������������� ������� �����������).
  const [breakfastTemplate, setBreakfastTemplate] = useState<BreakfastTemplateId>(() => {
    try {
      const v = localStorage.getItem('he_breakfast_template');
      if (v === 'classic_oat' || v === 'protein_flakes' || v === 'eggs_toast' || v === 'cottage_berries') return v;
    } catch {}
    return 'auto';
  });
  // FIX persist-settings: ����� ��� ��������� ������������ � he_planner_prefs (debounce �� ����� �
  // ����� �� ������ ���������, ����� ���������). ������ ��� ��������� �� ����������� ������.
  // P1-fix: ������ � merge-patch (writePlannerPrefsPatch), � �� ������ ����������: ������ ������
  // ������ ����� ����� ��������� (������ ������ workSchedule*), � �� ����������� ����� ������������.
  useEffect(() => {
    writePlannerPrefsPatch({
      cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays,
      trainType, trainIntensity, intraWorkoutEnabled, householdActivity, cyclePhase,
      weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct,
      weightLogPeriod, phase, proteinPreset, budget, variety,
      lunchTime, dinnerTime, workFood, planType, morningTrainLoad, heavyTrainDay,
      cookingSkill, cookingFrequency, batchCooking,
    });
  }, [cookTimeMin, cravingMode, cravingDays, lazyDayMode, lazyDayDays, trainType, trainIntensity, intraWorkoutEnabled, householdActivity, cyclePhase, weightAdaptMode, expectedLossKgWeek, metabolicAdaptEnabled, metabolicAdaptPct, weightLogPeriod, phase, proteinPreset, budget, variety, lunchTime, dinnerTime, workFood, planType, morningTrainLoad, heavyTrainDay, cookingSkill, cookingFrequency, batchCooking]);

  // P1-fix: preferredFoods �� Profile (UnifiedSettings.nutrition.preferredFoods) + legacy
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
    if (/^[\s/\\|_\-=~*#��]+$/.test(t)) return null;
    return t;
  };
  const [customNotes, setCustomNotes] = useState(() => {
    try { const v = cleanPlannerNotes((s as any)?.nutrition?.dietNotes); if (v !== null) return v; } catch {}
    try { return cleanPlannerNotes(localStorage.getItem('he_nutrition_notes')) || ''; } catch { return ''; }
  });
  // FIX save-buttons: ������� ��������, �� �� ����������� � �������� ��� ������������.
  // ������������ �������: ������ ������� � � �������, ����� ������ dietNotes (�///////�) ����������� ����� ������������.
  useEffect(() => { try { safeWriteJSON('he_nutrition_notes', customNotes); updateSection('nutrition', { dietNotes: customNotes }); } catch {} }, [customNotes]);
  // D-28: meal-bound preferred foods (e.g. rice_cream > breakfast only)
  const [preferredByMeal, setPreferredByMeal] = useState<Record<string, string[]>>(() => {
    try { const v = (s as any)?.nutrition?.preferredByMeal; if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
    try { const v = JSON.parse(localStorage.getItem('he_preferred_by_meal') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  });
  useEffect(() => { try { updateSection('nutrition', { preferredByMeal }); } catch {} }, [preferredByMeal]);
  // D-28+: advanced preference states
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
    // ���� 8: ����-���� legacy histamineSensitive > lowHistamine (���� ���� ���������).
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
      // TasteProfile � ������ {spicy, sweet, ...}, �� ����������� � UnifiedSettings.nutrition.tasteProfile (��� string[]).
      // ��������� � nutrition ��� userPreference ����� extras? ��� ��������� � localStorage legacy.
      // ���������� localStorage ��� �������� �������������.
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
  // ��������� �� ������������ �������� (����� > ������� �����������).
  const [diaryAdaptation, setDiaryAdaptation] = useState<boolean>(() => { try { return localStorage.getItem('he_diary_adaptation') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('he_diary_adaptation', diaryAdaptation ? 'true' : 'false'); } catch {} }, [diaryAdaptation]);
  // Smart 7-day variety: 'soft' = ������ deprioritize recent, 'strict' = hard-exclude ��������� 1-2 ���.
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
  // P1-6 (HV-�����): real/practical/mixed � ��� ��������� 800-1500� (������� ��������� ������).
  const [hvStyle, setHvStyle] = useState<'real' | 'practical' | 'mixed'>(() => {
    try { const v = localStorage.getItem('he_planner_hv_style'); if (v === 'practical' || v === 'mixed' || v === 'real') return v; } catch {}
    return 'real';
  });
  useEffect(() => { try { localStorage.setItem('he_planner_hv_style', hvStyle); } catch {} }, [hvStyle]);
  // P1-9 ������ �������: ��������� carbCapOverride ��������� ���� dayTargets
  // (���� ��� ������ ���� ���� � ����� TDZ �� ������ �������).
  // v6: ������������ (variety + varietyStrictness > varietyLevel). ������ � _pf.varietyLevel,
  // ��������� �� ������ _pf.variety / _pf.varietyStrictness / he_variety_strictness.
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
  // P1-fix: excludedFoods �� Profile (UnifiedSettings.nutrition.excludedFoods) + legacy
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
  // P1-fix: dietPrefs �� Profile (UnifiedSettings.nutrition.tasteProfile) + legacy
  // dietPrefs � ��� ������ ����� (vegetarian, vegan, pescatarian � �.�.) �� UI.
  // � UnifiedSettings �� �������� � nutrition.tasteProfile ��� ������ (����� �������� diet_preferences).
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
  // ���� 1: ������ ������������ ���������. �������� legacy (cyclingMode/dietPauseMode/
  // periodizationEnabled > carbPeriodization) � ��� �������������; legacy-���� ������
  // �� ���������� ��� state � �� �������� ����������.
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
    writePlannerPrefsPatch({ varietyLevel, carbPeriodization });
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
    writePlannerPrefsPatch(patch);
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
  const {
    generated, setGenerated,
    planBusy,
    planDays, setPlanDays,
    dayPlan, setDayPlan,
    threeDayPlan, setThreeDayPlan,
    weekPlan, setWeekPlan,
    shoppingList, setShoppingList,
    waterCalc, setWaterCalc,
    savedPlans, setSavedPlans,
    lockedFoodIds, toggleLockFood,
    expandedSavedId, setExpandedSavedId,
    editItem, setEditItem,
    editAmount, setEditAmount,
    replacingItem, setReplacingItem,
    recipePickerMeal, setRecipePickerMeal,
    dayPlanNotes, setDayPlanNotes,
    draggedItem, setDraggedItem,
    dropTarget, setDropTarget,
  } = usePlannerGenerationState();
   const [userRecipes, setUserRecipes] = useState<any[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_user_recipes') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [showRecipeCreator, setShowRecipeCreator] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showDrugTypePicker, setShowDrugTypePicker] = useState(false);
   const [takenSupplements, setTakenSupplements] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_nutrition_supps') || '[]'); return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []; } catch { return []; } });
  const [showSuppPicker, setShowSuppPicker] = useState(false);
  const [suppSearch, setSuppSearch] = useState('');
  const [newRecipe, setNewRecipe] = useState({ name: '', meal: 'lunch' as string, prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
  // FIX persist-audit (B6): ���� v2-�������� �� ����������� � ������������ �� ������
  const [v2Phase, setV2Phase] = useState(() => {
    try { const v = localStorage.getItem('he_planner_v2_phase'); if (typeof v === 'string' && v.length > 0) return v; } catch {}
    return 'LEAN_MASS';
  });
  useEffect(() => { try { localStorage.setItem('he_planner_v2_phase', v2Phase); } catch {} }, [v2Phase]);
  const [v2Labs, setV2Labs] = useState<Record<string, string>>(() => { try { const v = JSON.parse(localStorage.getItem('he_planner_labs') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } });
  const [v2Pharma, setV2Pharma] = useState<Record<string, boolean>>(() => { try { const v = JSON.parse(localStorage.getItem('he_planner_pharma') || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } });
  const [histamineSensitive, setHistamineSensitive] = useState(() => {
    try { const v = (s as any)?.nutrition?.histamineSensitive; if (typeof v === 'boolean') return v; } catch {}
    try { return localStorage.getItem('he_planner_histamine') === 'true'; } catch { return false; }
  });
  // ���� 8: histamineSensitive � ������������������ ����� intolerances.lowHistamine
  // (���� �������� ��� ��������� � ���� ������ �� lowHistamine; �������� � ����
  // ��������� ������ �����������).
  const setHistamineSynced = useCallback((v: boolean) => {
    setHistamineSensitive(v);
    setIntolerances((prev: any) => ({ ...prev, lowHistamine: v }));
  }, []);
  const {
    plannerMode, setPlannerMode, plannerModeRef,
    generationMode, setGenerationMode,
    weightMode, setWeightMode,
    favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe,
  } = usePlannerModeState();
  const {
    planTab, setPlanTab,
    planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    planView, setPlanView,
    savePlanPrompt, setSavePlanPrompt,    dayPlanNotes, setDayPlanNotes,
    draggedItem, setDraggedItem,
    dropTarget, setDropTarget,
  } = usePlannerViewState();
  useEffect(() => { try { localStorage.setItem('he_planner_labs', JSON.stringify(v2Labs)); } catch {} }, [v2Labs]);
  useEffect(() => { try { localStorage.setItem('he_planner_pharma', JSON.stringify(v2Pharma)); } catch {} }, [v2Pharma]);
  useEffect(() => { try { localStorage.setItem('he_planner_histamine', histamineSensitive ? 'true' : 'false'); } catch {} }, [histamineSensitive]);

  // A4: �������� �????? ���� ������� ������ ���������� ����������� �������? � ����� ���
  // ����� �������� ������� ��� ���� �������������� �� ���������� ������.
  const recipeCookingActiveRef = useRef(false);
  // ������� �����: ������ 3 ���� (�����/�����/�����������) � ����������� ���� ��� �����,
  // ����� ��������� ����� ���� (����/������������ � �.�.) �� ������ ������ ��� ����������.
  useEffect(() => {
    if (plannerMode === 'minimal' && goal !== 'mass' && goal !== 'cutting' && goal !== 'maintenance') {
      setGoal('maintenance');
      setGoalUserSet(true);
    }
  }, [plannerMode, goal]);
   useEffect(() => { try { localStorage.setItem('he_nutrition_supps', JSON.stringify(takenSupplements)); } catch {} }, [takenSupplements]);
   // FIX save-buttons: ���������������� ������� �������� �� he_user_recipes, �� �������
   // �� ����������� � ��������� ������ �������� ��� ������������.
   useEffect(() => { try { safeWriteJSON('he_user_recipes', userRecipes); } catch {} }, [userRecipes]);

  // FIX: ��������������� ������ ����� ���� � ������
  useEffect(() => { try { if (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0) localStorage.setItem('he_manual_g_per_kg', JSON.stringify(manualGPerKg)); else localStorage.removeItem('he_manual_g_per_kg'); } catch {} }, [manualGPerKg]);
  useEffect(() => { try { if (manualKcal !== null) localStorage.setItem('he_manual_kcal', String(manualKcal)); else localStorage.removeItem('he_manual_kcal'); } catch {} }, [manualKcal]);
  useEffect(() => { try { if (manualP !== null) localStorage.setItem('he_manual_p', String(manualP)); else localStorage.removeItem('he_manual_p'); } catch {} }, [manualP]);
  useEffect(() => { try { if (manualF !== null) localStorage.setItem('he_manual_f', String(manualF)); else localStorage.removeItem('he_manual_f'); } catch {} }, [manualF]);
  useEffect(() => { try { if (manualC !== null) localStorage.setItem('he_manual_c', String(manualC)); else localStorage.removeItem('he_manual_c'); } catch {} }, [manualC]);
  useEffect(() => { try { localStorage.setItem('he_kbju_mode', kbjuMode); } catch {} }, [kbjuMode]);

  // FIX (hero/������� ? ���� �����): ��������� ����������� ���� ��� (effective*)
  // ������ ������ � hero ������� � ������� ������ �� ��� �������� ������ ������
  // ���������� ����������� ������� (calcNutrition), ��-�� �������� ����� �����������
  // � ������, ��������� � ����� (������ ���� / ���� / ���� / �������� / ��-�������).
  useEffect(() => {
    publishPlanTargets({
      kcal: Math.round(effectiveKcal),
      protein: Math.round(effectiveP),
      fats: Math.round(effectiveF),
      carbs: Math.round(effectiveC),
    });
  }, [effectiveKcal, effectiveP, effectiveF, effectiveC]);

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
    // P1-fix: �������� shoppingList/waterCalc/recommendations � �������,
    // ����� undo �� ������������������ ���� �� ������� ������� � ������ ��������.
    if (shoppingList) snap.shoppingList = JSON.parse(JSON.stringify(shoppingList));
    if (waterCalc) snap.waterCalc = JSON.parse(JSON.stringify(waterCalc));
    // P5 (HIGH-VOLUME): ���� �� mealPrepPlan � ����� ������ ������ ����, � ������� ���.
    if (mealPrepPlan) snap.mealPrepPlan = JSON.parse(JSON.stringify(mealPrepPlan));
    if (recommendations) snap.recommendations = JSON.parse(JSON.stringify(recommendations));
    setUndoStack(prev => [snap, ...prev].slice(0, 5));
  };

  // FIX button-audit: ������ ���������� undo � ��������������� ��� ����� ��������
  // (������ recommendations �� �����������������, � setState ��������� ������ updater)
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
    if (snap.mealPrepPlan) setMealPrepPlan(snap.mealPrepPlan);
    setUndoStack(prev => prev.slice(1));
  };

  const withoutSecondRecipe = (meal: any) => {
    const { recipeApplied2: _recipeApplied2, recipeAppliedData2: _recipeAppliedData2, ...rest } = meal || {};
    return rest;
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
  const updateMultiDayPlan = (plan: any, dayIdx: number, mealIdx: number, itemsUpdater: (items: any[]) => any[], compositionChange?: boolean) => {
    if (!plan?.days?.[dayIdx]) return;
    const days = [...plan.days];
    let updated = updateMealsInPlan(days[dayIdx], mealIdx, itemsUpdater);
    if (!updated) return;
    // P1-������: ����� ������� ���������� recipeApplied ����� (��. _applyDayPlanMealUpdate).
    if (compositionChange && updated.meals) {
      updated = {
        ...updated,
        meals: updated.meals.map((m: any, i: number) => {
          if (i !== mealIdx || (!m.recipeApplied && !m.recipeAppliedData && !m.recipeApplied2 && !m.recipeAppliedData2)) return m;
          const { recipeApplied, recipeAppliedData, recipeApplied2, recipeAppliedData2, ...rest } = m;
          return rest;
        }),
      };
    }
    days[dayIdx] = updated;
    const allTotals = { kcal: days.reduce((s: number, d: any) => s + (d.totals?.kcal || 0), 0), p: days.reduce((s: number, d: any) => s + (d.totals?.p || 0), 0), f: days.reduce((s: number, d: any) => s + (d.totals?.f || 0), 0), c: days.reduce((s: number, d: any) => s + (d.totals?.c || 0), 0), fiber: days.reduce((s: number, d: any) => s + (d.totals?.fiber || 0), 0), leucine_mg: days.reduce((s: number, d: any) => s + (d.totals?.leucine_mg || 0), 0) };
    // P1-fix: ���������� �������������� updaters ������ ��������� ������ (===).
    // ������ `plan === threeDayPlan` ��������� closure-captured ������ � ������� state,
    // ��� ����� ���� false � ���� �������� ������. ������ ���������� ��� ����� ��
    // ����� days (3 = threeDayPlan, 7 = weekPlan) � ���������� ��������������� setter.
    const dayCount = days.length;
    const newPlan = { ...plan, days, totals: allTotals };
    if (dayCount === 3) setThreeDayPlan(newPlan as any);
    else if (dayCount === 7) setWeekPlan(newPlan as any);
    else {
      // Fallback �� ������ ������ ��� ������������� ����
      if (plan === threeDayPlan) setThreeDayPlan(newPlan as any);
      else if (plan === weekPlan) setWeekPlan(newPlan as any);
    }
  };

  // P0-fix: drag&drop � 3/7-������� ���� ������ ������ ������ dayPlan (���� 0) ������ �������� ���.
  // ������ moveFoodItem ��������� dayIdx (0=dayPlan, 1..3=threeDayPlan, 7..=weekPlan) � �������� ���������� ����.
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
        // �������������� ������� � ��������� ���� ��� �������������� ��� ���
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
      // �������� ���������� meals ��� ����� ���
      const mealsCopy = day.meals.map((m: any, idx: number) => {
        if (idx === fromMealIdx) return { ...m, items: fromItems, totals: calcItemTotals(fromItems) };
        if (idx === toMealIdx) { const toItems = [...m.items, itm]; return { ...m, items: toItems, totals: calcItemTotals(toItems) }; }
        return m;
      });
      // ���� from � to ���������� � ��� ���������� splice, ������ ��������� ���� meal (����) � �� to==from ��� ���+������ � ����� � ��������:
      // ��� ���������� from==to ��� ��� �� ����� ������ ���; mealsCopy ���� ������� ����� � ��������
      let finalMeals: any[];
      if (fromMealIdx === toMealIdx) {
        const items = [...(day.meals[fromMealIdx].items || [])];
        const moved = items.splice(itemIdx, 1)[0];
        if (moved) items.splice(toMealIdx, 0, moved); // ��� ������ ������ ����� � ������ ������������ ������, �� UI ���� ������ ���������� ��� ����������� ������ �����
        finalMeals = day.meals.map((m: any, idx: number) => idx === fromMealIdx ? { ...m, items, totals: calcItemTotals(items) } : m);
      } else {
        finalMeals = mealsCopy;
      }
      const totals = calcMealTotals(finalMeals);
      // E7-����: placeholder-����� updateMultiDayPlan ����� � �� ���������� ������,
      // ������� ������ setThreeDayPlan ���� (������� ������ � ���� �����������).
      // �������� ������ threeDayPlan
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
 
  // FIX button-audit: ������ ��������� dayIdx � 0 = dayPlan, 1..3 = threeDayPlan.days[dayIdx-1],
  // 7..13 = weekPlan.days[dayIdx-7]. ������ ��������� ��� 1..3 �������� � ����� threeDayPlan
  // (������/�������� � ��������� ���� ����� ������� 3-������� �����).
  const _resolvePlanDay = (dayIdx: number): { plan: any; day: number } | null => {
    if (dayIdx === 0) return { plan: 'day', day: 0 };
    if (dayIdx >= 7 && weekPlan) return { plan: 'week', day: dayIdx - 7 };
    if (dayIdx >= 1 && dayIdx <= 3 && threeDayPlan) return { plan: 'three', day: dayIdx - 1 };
    if (dayIdx >= 1 && dayIdx <= 3 && weekPlan) return { plan: 'week', day: dayIdx - 1 }; // fallback: ��� threeDayPlan, �� ���� week
    return null;
  };

  // FIX button-audit: ��� �������� ��� ������ ��� �������������� dayPlan ���������� ������
  // ����� ���; ������ ���������������� ������� � weekPlan (������ �������� ��� �������� � ������).
  const [weekEditDay, setWeekEditDay] = useState<number | null>(null);
  // E4-fix: ������ ������ (weekEditDay) � ������ ������ ������������ � monthPlan[selectedWeek] �
  // ������ ������� � ������� ������� ������� ������, �.�. monthPlan ������ ����������� ����� ������.
  // ��������� ������ �� �������������: weekEditDay = null ��� ��������� (����� � generatePlan).
  useEffect(() => {
    if (!monthPlanMode || weekEditDay === null) return;
    if (!weekPlan?.days?.length || !monthPlan?.length) return;
    const wi = selectedWeek ?? 0;
    if (!monthPlan[wi] || monthPlan[wi] === weekPlan) return;
    setMonthPlan(prev => { const next = [...prev]; next[wi] = weekPlan; return next; });
    // monthPlan � deps: ����� setMonthPlan ���� `monthPlan[wi] === weekPlan` ������������� ������ �
    // ��� ���� ���� ��� �� ������� ������� ��������� monthPlan (stale-���������).
  }, [weekPlan, monthPlan, monthPlanMode, weekEditDay, selectedWeek]);
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
  const _applyDayPlanMealUpdate = (mealIdx: number, updater: (items: any[]) => any[], opts?: { compositionChange?: boolean }) => {
    // P1-������: ���� ������ ����� ������� ������� (��������/�������/����� �������),
    // recipeApplied �� ����� ������ �� ��������� ���������� � �������� ������� ����������
    // ����������� �������, ������� � ����� ��� ���. ���������� provenance.
    // ������ ������ ��������� ������ �� ������ � ������ ������� ���������� (�� ����������).
    // ���� ���������� ������� (_applyDayPlanMealUpdate �� ����������) � �� ��������.
    const _applyMeta = (day: any) => {
      if (!opts?.compositionChange || !day?.meals) return day;
      return {
        ...day,
        meals: day.meals.map((m: any, i: number) => {
          if (i !== mealIdx || (!m.recipeApplied && !m.recipeAppliedData && !m.recipeApplied2 && !m.recipeAppliedData2)) return m;
          const { recipeApplied, recipeAppliedData, recipeApplied2, recipeAppliedData2, ...rest } = m;
          return rest;
        }),
      };
    };
    setDayPlan((prev: any) => _applyMeta(updateMealsInPlan(prev, mealIdx, updater)));
    if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
      updateMultiDayPlan(weekPlan, weekEditDay, mealIdx, updater, opts?.compositionChange);
    }
  };

  // FIX per100 + dedup: ������� per100 ������ + ������ �� ����� (��� ����)
  // P1-01/P1-02/P1-06/P1-08: ������ ���� ����������� ��� ������ ��������.
  // ������������� ����������� ���������, � ������ ���������/��������/������� �����
  // ��� ���� ��� � ������� � ���������� ������/�����������/��-��������� ������� � ����.
  // ����� � planner-restrictions (��� �� ��������, ��� � ������ ���������).
  const _manualFoodBlockReason = (foodId: string): string | null => {
    if (!foodId) return null;
    try {
      if ((excludedFoods || []).includes(foodId)) return '������� � ������ �����������';
      if (resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || []).has(foodId)) return '������� �� �������� ���������/������';
      const food = FOOD_DB.find(f => f.id === foodId);
      if (food && !matchesCategoryPref(food, { preferred: [], excluded: excludedCategories || [] })) return '��������� �������� ���������';
      if ((dietPrefs || []).includes('vegetarian') && FOOD_ALLERGEN_DIET[foodId]?.isVegetarian === false) return '������� �� �������� ��� ��������������� �������';
      return null;
    } catch { return null; }
  };
  const _blockManualFood = (name: string, reason: string): boolean => {
    try { setErrorMsg(`�${name}� ������ ��������: ${reason}. �������� ������ �������.`); setTimeout(() => setErrorMsg(null), 3000); } catch {}
    if (typeof (window as any).showToast === 'function') (window as any).showToast('? ������� ������������ �������������', 'warning');
    return true;
  };

  const addFoodToMeal = (dayIdx: number, mealIdx: number, food: any) => {
    if (!food || !food.name) return;
    const _block = _manualFoodBlockReason(food.id);
    if (_block) { _blockManualFood(food.name, _block); return; }
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]) return;
    // dedup: ��� �� id ��� � ����� � �� ������ �����, ���������� �������� ���������
    if (dayData.meals[mealIdx].items.some((it: any) => it.id === food.id)) {
      try { setErrorMsg('���� ������� ��� � ����� � �������� ���������'); setTimeout(() => setErrorMsg(null), 2500); } catch {}
      return;
    }
    saveUndo();
    // per100 invariant: ������ �� servingSize (30� ��� �������) ��� 100�, spice ?10�
    let grams = parseServingSizeGrams(food.servingSize);
    if (!grams || !Number.isFinite(grams) || grams <= 0) grams = 100;
    // spice/other limit 10� (������ 247����/100� > 37� ������)
    if (food.category === 'other' && grams > 10) grams = 10;
    if (food.id && String(food.id).startsWith('spice_') && grams > 10) grams = 10;
    const ratio = grams / 100;
    const leuPer100 = (food as any).amino_acid_profile_100g?.leucine_mg ?? (food.micros?.Leucine != null ? (food.micros.Leucine as number) : Math.round((food.protein || 0) * 75));
    const _p = Math.round((food.protein || 0) * ratio * 10) / 10;
    const _f = Math.round((food.fat || 0) * ratio * 10) / 10;
    const _c = Math.round((food.carbs || 0) * ratio * 10) / 10;
    // KB��-��������������� ?3%: kcal �� �������
    const item = { name: food.name, id: food.id, amount: grams, kcal: Math.round(4 * _p + 9 * _f + 4 * _c), p: _p, f: _f, c: _c, fiber: Math.round((food.fiber || 0) * ratio * 10) / 10, leucine_mg: Math.round(leuPer100 * ratio) };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => [...items, item], { compositionChange: true });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => [...items, item], true);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => [...items, item], true);
    }
  };

  // E7: ������� �������� + ������� � ������� � �������-������ + ������� ������ � ������������� ����������.
  const addSnackComboToMeal = (dayIdx: number, mealIdx: number) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]) return;
    const mk = (f: any, grams: number) => { const p = Math.round((f.protein || 0) * grams / 100), f2 = Math.round((f.fat || 0) * grams / 100), c = Math.round((f.carbs || 0) * grams / 100); return { name: f.name, id: f.id, amount: grams, kcal: Math.round(4 * p + 9 * f2 + 4 * c), p, f: f2, c, fiber: Math.round((f.fiber || 0) * grams / 100) }; };
    const whey = FOOD_DB.find(f => f.id === 'whey_isolate') || FOOD_DB.find(f => f.id === 'whey_protein');
    // E3b: ������ ���� ������� (� �.�. �����) ������ ��������� ����� ��� shift_*.
    const isWorkDayForAdd = isWorkDayForIndex(dayIdx, { enabled: workScheduleEnabled, scheduleType: workScheduleType, workDays, dowBase: 0 });
    const usePortable = workFood === 'portable' && isWorkDayForAdd;
    const oats = FOOD_DB.find(f => f.id === (usePortable ? 'oats_dry' : 'oats')) || FOOD_DB.find(f => f.id === 'oats_dry') || FOOD_DB.find(f => f.id === 'oats');
    const additions = [] as any[];
    if (whey) {
      const _r = _manualFoodBlockReason(whey.id);
      if (_r) _blockManualFood(whey.name, _r); else additions.push(mk(whey, 30));
    }
    if (oats) {
      const _r = _manualFoodBlockReason(oats.id);
      if (_r) _blockManualFood(oats.name, _r); else additions.push(mk(oats, usePortable ? 70 : 50));
    }
    // ����������� ��� �� ������ � ��������� �����/����� ��� �������
    if (usePortable) {
      const alm = FOOD_DB.find(f => f.id === 'almonds');
      if (alm && !_manualFoodBlockReason(alm.id)) additions.push(mk(alm, 15));
    }
    if (additions.length === 0) return;
    // P1b: ����� � ������ �������� (������� + ������[/�����]), � �� ������� �����.
    const _grp = 'protein:snack-combo';
    for (const a of additions) (a as any)._cocktail = { kind: 'protein', name: '?? ����������� ��������', group: _grp };
    saveUndo();
    const apply = (items: any[]) => [...items, ...additions];
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, apply, { compositionChange: true });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, apply, true);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, apply, true);
    }
  };

  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    if (!newFood || typeof newFood !== 'object' || !newFood.name) return; // FIX button-audit: guard
    const _block = _manualFoodBlockReason(newFood.id);
    if (_block) { _blockManualFood(newFood.name, _block); return; }
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    saveUndo();
    const old = dayData.meals[mealIdx].items[itemIdx];
    // per100 invariant: ��������� ������ ������� ����� (�� servingSize ������), ������������� ���� ������ per100
    let grams = old.amount || 100;
    if (newFood.category === 'other' && grams > 10) grams = 10;
    if (newFood.id && String(newFood.id).startsWith('spice_') && grams > 10) grams = 10;
    const ratio = grams / 100;
    const leuPer100 = (newFood as any).amino_acid_profile_100g?.leucine_mg ?? (newFood.micros?.Leucine != null ? (newFood.micros.Leucine as number) : Math.round((newFood.protein || 0) * 75));
    const replacement = { ...old, name: newFood.name, id: newFood.id, amount: grams, kcal: (() => { const p = Math.round((newFood.protein || 0) * ratio * 10) / 10, f = Math.round((newFood.fat || 0) * ratio * 10) / 10, c = Math.round((newFood.carbs || 0) * ratio * 10) / 10; return Math.round(4 * p + 9 * f + 4 * c); })(), p: Math.round((newFood.protein || 0) * ratio * 10) / 10, f: Math.round((newFood.fat || 0) * ratio * 10) / 10, c: Math.round((newFood.carbs || 0) * ratio * 10) / 10, fiber: Math.round((newFood.fiber || 0) * ratio * 10) / 10, leucine_mg: Math.round(leuPer100 * ratio) };
    if (resolved.plan === 'day') {
      _applyDayPlanMealUpdate(mealIdx, items => { items[itemIdx] = replacement; return items; }, { compositionChange: true });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => { items[itemIdx] = replacement; return items; }, true);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => { items[itemIdx] = replacement; return items; }, true);
    }
    setReplacingItem(null);
  };

  const updateItemAmount = (dayIdx: number, mealIdx: number, itemIdx: number, newAmount: number) => {
    const resolved = _resolvePlanDay(dayIdx);
    if (!resolved) return;
    const dayData = resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan?.days?.[resolved.day] : weekPlan?.days?.[resolved.day];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) { setEditItem(null); return; }
    const it = dayData.meals[mealIdx].items[itemIdx];
    // P1-undo: ������ ��������� ������ ��� ��� saveUndo � ��������� ������ ���� ��������
    // (��� �������� �������� � ����������/������/�������� � ������ ������).
    saveUndo();
    // spice hard cap 10�
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
      _applyDayPlanMealUpdate(mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx), { compositionChange: true });
    } else if (resolved.plan === 'three') {
      updateMultiDayPlan(threeDayPlan, resolved.day, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx), true);
    } else if (resolved.plan === 'week') {
      updateMultiDayPlan(weekPlan, resolved.day, mealIdx, items => items.filter((_: any, i: number) => i !== itemIdx), true);
    }
  };

  // --- ����� ��� ��������: ���� ������� + ����� �������� / ������ �������� ---
  // F: ������� ������ �������� ����������� ���������� ������ (� �.�. ����������� ��������)
  const syncShoppingListFromPlans = () => {
    try {
      let plans: any[] = [];
      if (planDays >= 7 && weekPlan?.days?.length) plans = weekPlan.days;
      else if (planDays >= 3 && threeDayPlan?.days?.length) plans = threeDayPlan.days;
      else if (dayPlan) plans = [dayPlan];
      if (plans.length > 0) setShoppingList(buildShoppingFromPlans(plans));
    } catch {}
  };

  /** ���������� ����� �� ���������� �������� ������� + �������� ��� �� �3%. */
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

  /** ?? ������� �����: ������� � ������������ ���� � ������� ����������� ���-�����
   *  � ������ ����� (�������� �3%), ������-��� ��������. �������� �� ���� �������. */
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
      const notes = [`?? ���� �${removed.label || '����'}� (${Math.round(removed.totals?.kcal || 0)} ����) �������� � ���� ����������`, ...rb.notes];
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
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ���� ���������� ��� ������������ �����', 'success');
  };

  /** P4b: ??-���� ����� ����������� ����� � �������� ��� (������ � ������ localStorage
   * �� ��������� ���������, ������� ���� �� �������). ������� ����� � ���� �����
   * applyMealTargetOverrides (����� 0.7�1.4 + ��������� ��� �5%) + ���� ������/�������. */
  const applyMealTargetNow = (label: string, dayIdx?: number) => {
    let ov: { label: string; p?: number; f?: number; c?: number } | undefined;
    try {
      const cur: any[] = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
      ov = cur.find((o: any) => o && o.label === label);
    } catch { ov = undefined; }
    if (!ov || (ov.p == null && ov.f == null && ov.c == null)) return;
    const di = dayIdx ?? 0;
    const dayTargets = {
      kcal: effectiveKcal > 0 ? effectiveKcal : 0,
      p: effectiveP > 0 ? effectiveP : 0,
      f: effectiveF > 0 ? effectiveF : 0,
      c: effectiveC > 0 ? effectiveC : 0,
    };
    saveUndo();
    if (di === 0) {
      if (!dayPlan?.meals?.length) return;
      const applied = applyMealTargetOverrides(dayPlan.meals as any, [ov] as any, dayTargets as any);
      const nextDay = { ...dayPlan, meals: applied.meals, totals: sumDayTotals(applied.meals as any) };
      setDayPlan(nextDay as any);
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const days = [...weekPlan.days];
        days[weekEditDay] = { ...days[weekEditDay], meals: applied.meals, totals: sumDayTotals(applied.meals as any) };
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        setShoppingList(buildShoppingFromPlans(days));
      } else {
        setShoppingList(buildShoppingFromPlans([nextDay]));
      }
    } else {
      const resolved = _resolvePlanDay(di);
      if (!resolved || (resolved as any).plan === 'day') return;
      const srcPlan: any = (resolved as any).plan === 'three' ? threeDayPlan : weekPlan;
      const rday: number = (resolved as any).day;
      if (!srcPlan?.days?.[rday]) return;
      const applied = applyMealTargetOverrides(srcPlan.days[rday].meals as any, [ov] as any, dayTargets as any);
      const days = [...srcPlan.days];
      days[rday] = { ...days[rday], meals: applied.meals, totals: sumDayTotals(applied.meals as any) };
      const updated = { ...srcPlan, days, totals: sumMultiTotals(days) };
      if ((resolved as any).plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      setDayPlan(days[rday] as any);
      setShoppingList(buildShoppingFromPlans(days));
    }
    if (typeof (window as any).showToast === 'function') (window as any).showToast(`?? ���� �${label}� ��������� � �������� ���`, 'success');
  };

  // ���� E: ������ �������� ������ ���, ���������� � weekPlan ��� weekEditDay
  // (������ ??-�����/����� �� MealListRender � QuickControls ������ ������ dayPlan �
  // ������ ������ �������� ��� ��������).
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
      copy.label = (copy.label || '����') + ' (�����)';
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
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ���� �������������', 'success');
  };

  const pickRecipeOption = (dayIdx: number, mealIdx: number, optionName: string) => {    saveUndo();
    if (dayIdx === 0) {
      const res = rebuildMealsWithRecipeOption(dayPlan?.meals || [], mealIdx, optionName);
      if (!res.ok || !res.meals) return;
      const newDay = { ...dayPlan, meals: res.meals, totals: sumDayTotals(res.meals as any) };
      // FIX button-audit: ������������� ������ ������� � ��������� ����
      let weekDaysUpdated: any[] | null = null;
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const days = [...weekPlan.days];
        const wres = rebuildMealsWithRecipeOption(days[weekEditDay].meals || [], mealIdx, optionName);
        days[weekEditDay] = wres.ok && wres.meals ? { ...days[weekEditDay], meals: wres.meals } : newDay;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        weekDaysUpdated = days;
      }
      setDayPlan(newDay);
      // F: ������� ��������������� �� ���� ������� ���� ����� (����������������� ����
      // ����������), � �� ������ �� ������ ��� � ����� ������ ���������� �� ��� ������.
      const visiblePlans: any[] =
        planDays >= 7 && weekPlan?.days?.length
          ? (weekDaysUpdated ?? weekPlan.days)
          : planDays >= 3 && threeDayPlan?.days?.length
            ? threeDayPlan.days.map((d: any, i: number) => (i === selectedDayIndex ? newDay : d))
            : [newDay];
      setShoppingList(buildShoppingFromPlans(visiblePlans));
      // A4: �������� �������� ������� ������� �� ��������� ��������
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
      // A4: �������� �������� ������� ������� �� ��������� ��������
      refreshRecipeCookingCardIfActive(resolved.plan === 'week' ? days[resolved.day] : dayPlan, resolved.plan === 'three' ? updated : threeDayPlan, resolved.plan === 'week' ? updated : weekPlan);
    }
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ������ ���������� ��� ������', 'success');
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
    // �7.2-� (�): �?? ������ ��������� ���� �� ���������� ����-���� ��� �������-������ ���.
    const filtered = filterRecipePoolForBand(filterByCookSkill(pool, prof.skill), effectiveC, effectiveP, weight);
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
      if (typeof (window as any).showToast === 'function') (window as any).showToast('������ ���������� �������� ��� ����� ����� ���', 'warning');
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
    const _excludedRecipeNames = new Set<string>((excludedFoods || [])
      .filter(id => id.startsWith('__recipe__') || id.startsWith('__user_recipe__'))
      .map(id => id.replace(/^__(?:user_)?recipe__/, '')));
    const _excludedIds = new Set<string>([
      ...resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || []),
      ...(excludedFoods || []).filter(id => !id.startsWith('__recipe__') && !id.startsWith('__user_recipe__')),
    ]);
    const _categoryPref = { preferred: [] as string[], excluded: excludedCategories || [] };
    // �7.2-� (�): 'carb-load' ����� � ������ ��� �������-������ ���; ��� �� �� ����������
    // (����� ���������: �������腻 ��������� � ������� ���� � ������ portable-�������).
    const poolAll = filterRecipePoolForBand(filterByCookSkill([...getRecipes(), ...(userRecipes || [])].filter(r => !_excludedRecipeNames.has(r.name)), cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking }).skill), effectiveC, effectiveP, weight);
    const labelMap: Record<string, 'breakfast'|'lunch'|'snack'|'dinner'|'preworkout'|'postworkout'|'presleep'> = {
      '�������': 'breakfast', '����': 'lunch', '����': 'dinner', '�������': 'snack', '������ �������': 'snack',
      '�������': 'snack', '��������': 'preworkout', '����-����': 'postworkout', '����� ����': 'presleep',
    };
    const budget = prepTimeBudgetPerMeal(cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking }), mealsCount);
    const nextMeals = source.meals.map((m: any) => {
      const seen = new Set<string>([...((m.recipeSuggestions || []).map((r: any) => r?.name).filter(Boolean)), ...((m as any).suggestionSeenNames || [])]);
      const tgt = m.target || { p: m.totals.p, c: m.totals.c, f: m.totals.f };
      const sugg = pickRecipeOptions(poolAll, {
        mealType: (labelMap[m.label] || 'lunch'),
        targetKcal: m.totals.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15,
        excludedIds: _excludedIds,
        allergenTags: selectedAllergenTags(allergens || [], dietPrefs || []),
        excludedRecipeNames: _excludedRecipeNames.size > 0 ? _excludedRecipeNames : undefined,
        categoryPref: _categoryPref,
        isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: budget,
        preferredRecipeNames: favoriteRecipes.size > 0 ? favoriteRecipes : undefined,
      }, 3, seen);
      return { ...m,
        recipeSuggestions: sugg.map(r => ({ name: r.name, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, prepTimeMin: r.prepTimeMin, usefulness: r.usefulness, description: r.description, ingredients: r.ingredients, instructions: r.instructions, tags: r.tags })),
        suggestionSeenNames: Array.from(new Set([...seen, ...sugg.map(r => r.name)])),
      };
    });
    applyTo(nextMeals);
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ��������� ������ �������', 'success');
  };

  // v3 portable: ����� ��������� ��� ������ ������ (� ������� ���� � ������ ����������� �������).
  // ��������� ��� � ��� � ������� ������� ���� (workDays[dayIdx%7] ��� ���������� ����������).
  const _portableRebOpts = (dayIdx: number) => {
    try {
      const pws = String(workStartTime || '09:00').split(':').map(Number);
      const pwe = String(workEndTime || '18:00').split(':').map(Number);
      // E3b: ����� ����������� � � ��������� ������ ������ (������ ������ ��� ������).
      const isWork = !workScheduleEnabled ? true : isWorkDayForIndex(dayIdx || 0, { enabled: true, scheduleType: workScheduleType, workDays, dowBase: 0 });
      const isW = workFood === 'portable' && isWork;
      return { portableMode: workFood === 'portable', isWorkDay: isW, workStartMin: pws[0] * 60 + (pws[1] || 0), workEndMin: pwe[0] * 60 + (pwe[1] || 0) };
    } catch { return { portableMode: false, isWorkDay: false, workStartMin: 9 * 60, workEndMin: 18 * 60 }; }
  };

  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number, dayIdx = 0) => {
    // P1-01/P1-02: ������ ������ �������� ��� ���� ����������� � ������������ ���
    // ��������� ������ � ����������/����������� ���������, � �� ����� ������� � ����.
    // ��������� ����������� ������������ ������� (����� ������� ���������) �� ������.
    try {
      const _decomp = decomposeRecipe(recipe);
      const _blocked = new Set<string>([
        ...resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || []),
        ...(excludedFoods || []),
      ]);
      const _tags = selectedAllergenTags(allergens || [], dietPrefs || []);
      const _isVeg = (dietPrefs || []).includes('vegetarian');
      const _hits = _decomp.filter(it => {
        const food = FOOD_DB.find(f => f.id === it.id);
        return _blocked.has(it.id)
          || getFoodAllergenTags(it.id, FOOD_DB).some(t => _tags.has(t))
          || (!!food && !matchesCategoryPref(food, { preferred: [], excluded: excludedCategories || [] }))
          || (_isVeg && FOOD_ALLERGEN_DIET[it.id]?.isVegetarian === false);
      });
      if (_hits.length > 0) {
        setErrorMsg(`������ �${recipe.name}� �� �������� ���� �����������: ${_hits.slice(0, 3).map(x => x.name).join(', ')}${_hits.length > 3 ? '�' : ''}. �������� ������.`);
        if (typeof (window as any).showToast === 'function') (window as any).showToast('? ������ ������������ �������������', 'warning');
        return;
      }
    } catch { /* ������������ �� ������� � �� ��������� ����� �������� ������������ */ }
    saveUndo();
    // P0-fix: ���������������� ������������� ���� �� ������������ ������� ������ �������� 100�.
    // ������ ���������� �������� ���� kcal = recipe.kcal / N, � ��������� ��������� ��
    // �������������� ��������� �������� (kcal/100g). �����/����/��� ������� �� FOOD_DB
    // � �������������� � ����������� ���������, � �� � 100�.
    // ������� (����� ������� ������): ������ ������� �������������� � ���� ����� �� ���� �
    // ����� 100 �� � 80 �� �������� ������ ��������� ������ ������� (scaleRecipeToTarget).
    const buildRecipeItems = (targetKcal: number, targetP: number, targetF: number, targetC: number) => {
      const scaled = scaleRecipeToTarget(recipe, { kcal: targetKcal, p: targetP, f: targetF, c: targetC }, weight);
      if (scaled && scaled.items.length > 0) {
        return { items: scaled.items.map(it => ({ name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c, fiber: it.fiber })), scale: scaled.scale };
      }
      // fallback: ������ ������ ����� (������ ��� ingredientIds / ������ ������)
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
      // ������ ����������: ���� = ������ (��������� ������), ����� �������� ��� �� �3%
      // (������ ���������� recipeApplied > ������� �� �����), ���� ������� � �������.
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
          ? { ...withoutSecondRecipe(x), items, totals: calcItemTotals(items), recipeApplied: recipe.name, recipeAppliedData: flatOptScaled }
          : x);
        const pre = sumDayTotals(patched as any);
        const rb = rebalanceDayAfterRecipes(patched as any, {
          kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
          p: effectiveP > 0 ? effectiveP : pre.p,
          f: effectiveF > 0 ? effectiveF : pre.f,
          c: effectiveC > 0 ? effectiveC : pre.c,
          ..._portableRebOpts(dayIdx),
        });
        return rb.meals as any[];
      };
      const resMeals = applyRebalanced(dayPlan?.meals);
      if (!resMeals) return;
      _outerResMeals = resMeals;
      _outerVisibleMealsForOptions = resMeals;
      const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} ���������� ���������` }; })();
      const newDay = { ...dayPlan, meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
      // FIX button-audit: ������������� ������ ������� � ��������� ����
      let weekDaysUpdated: any[] | null = null;
      if (weekEditDay !== null && weekPlan?.days?.[weekEditDay]) {
        const wres = applyRebalanced(weekPlan.days[weekEditDay].meals);
        const days = [...weekPlan.days];
        days[weekEditDay] = wres ? { ...days[weekEditDay], meals: wres } : newDay;
        setWeekPlan({ ...weekPlan, days, totals: sumMultiTotals(days) });
        weekDaysUpdated = days;
      }
      setDayPlan(newDay);
      // F: ������� �� ���� ������� ���� ����� (����������������� ���� ����������)
      const visiblePlans: any[] =
        planDays >= 7 && weekPlan?.days?.length
          ? (weekDaysUpdated ?? weekPlan.days)
          : planDays >= 3 && threeDayPlan?.days?.length
            ? threeDayPlan.days.map((d: any, i: number) => (i === selectedDayIndex ? newDay : d))
            : [newDay];
      setShoppingList(buildShoppingFromPlans(visiblePlans));
      refreshRecipeCookingCardIfActive(newDay, threeDayPlan, weekDaysUpdated ? { days: weekDaysUpdated } : weekPlan);
    } else {
      // FIX button-audit: ��������� ��� (dayIdx >= 7) ���� � weekPlan, 1..3 � � threeDayPlan
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
          ? { ...withoutSecondRecipe(x), items, totals: calcItemTotals(items), recipeApplied: recipe.name, recipeAppliedData: flatOptScaled }
          : x);
        const pre = sumDayTotals(patched as any);
        const rb = rebalanceDayAfterRecipes(patched as any, {
          kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
          p: effectiveP > 0 ? effectiveP : pre.p,
          f: effectiveF > 0 ? effectiveF : pre.f,
          c: effectiveC > 0 ? effectiveC : pre.c,
          ..._portableRebOpts(dayIdx),
        });
        return rb.meals as any[];
      };
      const resMeals = applyRebalanced2(srcPlan.days[resolved.day].meals);
      if (!resMeals) return;
      _outerResMeals = resMeals;
      _outerVisibleMealsForOptions = resMeals;
      const days = [...srcPlan.days];
      days[resolved.day] = { ...srcPlan.days[resolved.day], meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} ���������� ���������` }; })() };
      const updated = { ...srcPlan, days, totals: sumMultiTotals(days) };
      if (resolved.plan === 'three') setThreeDayPlan(updated); else setWeekPlan(updated);
      if (resolved.plan === 'week') setDayPlan(days[resolved.day]);
      else if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day]);
      setShoppingList(buildShoppingFromPlans(days));
      refreshRecipeCookingCardIfActive(resolved.plan === 'week' ? days[resolved.day] : dayPlan, resolved.plan === 'three' ? updated : threeDayPlan, resolved.plan === 'week' ? updated : weekPlan);
    }
    // ������������ ������ �������� (recipeOptions) ��� ���� ������ � ����� ����� ������ ������ �� ��������������� � ��� ������� ������
    try {
      const allMealsForOptions = _outerResMeals || _outerVisibleMealsForOptions || (dayIdx !== 0 ? ((): any => { const r = _resolvePlanDay(dayIdx); if (!r) return null; const p = r.plan==='three'? threeDayPlan : r.plan==='week'? weekPlan : null; return p?.days?.[r.day]?.meals; })() : null);
      if (allMealsForOptions && Array.isArray(allMealsForOptions)) {
        const excludedRecipeNames = new Set<string>(allMealsForOptions.flatMap((meal: any) => [meal?.recipeApplied, meal?.recipeApplied2].filter(Boolean).map((v: any) => String(v))));
        const excludedIds = new Set<string>([
          ...resolveAllExcludedFoodIds(FOOD_DB, allergens, dietPrefs),
          ...(excludedFoods || []).filter((id: string) => !/^__(recipe|user_recipe)__/.test(id)),
        ]);
        const poolForOptions = [...getRecipes(), ...(userRecipes || [])]
          .filter(r => !excludedRecipeNames.has(r.name));
        const allergenTags = selectedAllergenTags(allergens, dietPrefs);
        const categoryPref = { preferred: [], excluded: excludedCategories || [] };
        for (let i = 0; i < allMealsForOptions.length; i++) {
          const m = allMealsForOptions[i];
          if (i === mealIdx) continue;
          if (!m || m.recipeApplied) continue;
          const label = m.label || '';
          const isMainOpt = ['�������', '����', '����'].includes(label);
          if (!isMainOpt && !/�������|�������/.test(label)) continue;
          const tgt = m.target || { p: m.totals?.p ?? 30, c: m.totals?.c ?? 40, f: m.totals?.f ?? 15 };
          const tKcal = m.totals?.kcal || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9) || 300;
          const opts = {
            mealType: label === '�������' ? 'breakfast' : label === '����' ? 'lunch' : label === '����' ? 'dinner' : 'snack' as any,
            targetKcal: tKcal, targetProteinG: tgt.p || 30, targetCarbsG: tgt.c || 40, targetFatG: tgt.f || 15,
            excludedIds, excludedRecipeNames, allergenTags, categoryPref,
            isVegetarian: dietPrefs.includes('vegetarian'), maxPrepTimeMin: 60,
          };
          const picks = pickRecipesForMeal(poolForOptions as any, opts as any, 3);
          if (picks.length > 0) {
            const flats = picks.map(r => flattenRecipeOption(r));
            m.recipeOptions = flats;
            m.recipeOptionNames = flats.map(f => f.name);
          }
        }
      }
    } catch {}
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ������ �������� � ������ ����������', 'success');
    setTimeout(() => syncShoppingListFromPlans(), 0);
    setRecipePickerMeal(null);
  };

  /**
   * ���������� ������� ������� � ����, ��� ��� ������ ������. ��� ����� ����� ���� �����:
   * ������ �������������� � ������� (���� ����� ? ���� ������� �������), �������������
   * ����������� (�� �����, �� ��� �� ��������/���������� �������). �������� ����� ��������
   * ������������, ���� ���������� recipeApplied2/recipeAppliedData2.
   * G3: �������������� ���� (��� �������������� +150 ��� �������� �����), ���������
   * ������� ������� ��� ������, ������ � peri/presleep, ������� �� ������������ ����.
   */
  const addSecondRecipeToMeal = (recipe: Recipe, mealIdx: number, dayIdx: number, opts?: { shrinkFirst?: boolean; forceFull?: boolean; acceptedMini?: boolean; mealsOverride?: any[]; snackFreedKcal?: number }) => {
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
    // P4a-������: ����-�������������� ����� (�������� ��� �����) ���� ������ ������ �� ������.
    const _srcMeals = opts?.mealsOverride ?? resolved.meals;
    const m = _srcMeals[mealIdx];
    if (!m || !m.recipeApplied) { setRecipePickerMeal(null); return; }
    // G3: ���� ���� = ���� ����� � ������ ������ �������� � peri/presleep.
    // �������� C: �������-���� ���� (isPeriLikeMeal ��������� ������; ����� � �� ������ ������).
    const _mLabel = String(m.label || '');
    if (isPeriLikeMeal(m as any) || /��������|����-����|intra|����� ����|pre-sleep|�������/i.test(_mLabel)) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast('? � peri-���� � �� ���� � ���� �����: ������ ������ ���� ������', 'warning');
      setRecipePickerMeal(null);
      return;
    }
    // �������������
    const comp = recipeCompatibility(m.recipeAppliedData as any, recipe as any);
    if (!comp.compatible) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast(`? ${comp.reason}`, 'warning');
      setRecipePickerMeal(null);
      return;
    }
    saveUndo();
    // G3: ������ ������� � ������� �������� �������� ������� ������� (�� ��� ingredientIds),
    // ����� ��������� ������� ����� ������ ���� ������ (���������� items).
    const _isReplace = !!(m as any).recipeApplied2;
    let _baseItems: any[] = [...(m.items || [])];
    if (_isReplace) {
      const _oldIds: string[] | undefined = (m as any).recipeAppliedData2?.ingredientIds;
      if (Array.isArray(_oldIds) && _oldIds.length > 0) {
        const _oldSet = new Set(_oldIds);
        const _filtered = _baseItems.filter(it => !_oldSet.has(it.id));
        // ������: ���� ������ ���� �� ���� ���� (������ ������ ��� ids-����������) � �� �������.
        if (_filtered.length > 0) _baseItems = _filtered;
      }
    }
    // G3: �������������� ���� � ������ ��� ���� �����, � �� ����� 150�.
    // ������ ��� ������ ���� > ������� �������������� + ����-������ (����� ������������).
    // ����� B (���� 8.2): shrinkFirst � ����� ������ ������ ?0.65, ��������� �����
    // ��� ����������� ������ (������ ����-������ ������ ��������� �����).
    const _mt = m?.target || { p: m?.totals?.p ?? 30, c: m?.totals?.c ?? 40, f: m?.totals?.f ?? 15 };
    const _targetKcal = Math.round((_mt.p || 0) * 4 + (_mt.f || 0) * 9 + (_mt.c || 0) * 4) || m?.totals?.kcal || 300;
    const _firstKcal = sumMealTotals(_baseItems as any).kcal || 0;
    const _rawRoom = _targetKcal - _firstKcal;
    let _roomKcal = _rawRoom;
    let _shrinkNote: string | null = null;
    if (opts?.shrinkFirst && !_isReplace && _rawRoom < 0.5 * _targetKcal) {
      const _ids1: string[] | undefined = (m as any).recipeAppliedData?.ingredientIds;
      const _core = _ids1 && _ids1.length > 0 ? new Set(_ids1) : null;
      const _shrunk = shrinkFirstForSecond(_baseItems as any, _core, 0.65);
      if (_shrunk.freedKcal >= 50) {
        _baseItems = _shrunk.items as any[];
        const _prevScale = Number((m as any).recipeAppliedData?.portionScale ?? (m as any).recipeAppliedData?.appliedScale ?? 1) || 1;
        const _newScale = Math.max(0.5, Math.round(_prevScale * 0.65 * 2) / 2);
        try {
          (m as any).recipeAppliedData = { ...(m as any).recipeAppliedData, portionScale: _newScale, appliedScale: _newScale };
        } catch {}
        _roomKcal = _targetKcal - sumMealTotals(_baseItems as any).kcal;
        _shrinkNote = `?? ������ ������ ���?� �� ?${_newScale} � ����� ��� ������ �����������`;
        if (typeof (window as any).showToast === 'function') (window as any).showToast(`?? ������ ���?� �� ?${_newScale} � ������ ������ ����������`, 'info' as any);
      }
    }
    // P4a: � �������� ���� ������ ����� ����-������� �� ���� (������: ����� 150 ���� +
    // ����� ����� ���������� + �������� ����� ������ ����� = ����). ������� � �����:
    // ������ [?? ����� ������ ?0.65 / ?? ������� �� ��������� / ���� / ������].
    // ������ ������� ��� ��� ������ (���� ��� ����). forceFull (������� �� ���������
    // ��� �����������) � acceptedMini (���� ������������ � �������) ����� ����������.
    const _dec = secondRecipeRoomDecision(_targetKcal, _targetKcal - _roomKcal);
    if (!_isReplace && !opts?.forceFull) {
      if (_dec.action === 'abort' && !_shrinkNote) {
        // ����� ������� ??, �� ������ ������ �� ���������� (<50 ����) � ������� �����
        // ��� ����� ������� > shrink > ������.
        if (opts?.shrinkFirst) {
          if (typeof (window as any).showToast === 'function') (window as any).showToast('? ����� ������ �� ����� � ����� �� ����� ���. �������� ������ ������', 'warning');
          setRecipePickerMeal(null);
          return;
        }
        setSecondRecipeConflict({ dayIdx, mealIdx, recipe, targetKcal: _targetKcal, firstKcal: _firstKcal, roomKcal: Math.max(0, Math.round(_roomKcal)), miniKcal: 0 });
        setRecipePickerMeal(null);
        return;
      }
      if (_dec.action === 'mini' && !_shrinkNote && !opts?.acceptedMini) {
        setSecondRecipeConflict({ dayIdx, mealIdx, recipe, targetKcal: _targetKcal, firstKcal: _firstKcal, roomKcal: Math.max(0, Math.round(_roomKcal)), miniKcal: Math.max(0, Math.round(_dec.roomKcal)) });
        setRecipePickerMeal(null);
        return;
      }
    }
    if (_isReplace && _roomKcal <= 0) _roomKcal = 150; // ������: ���� ��� ���� (��� ������)
    else if (_dec.action === 'mini' && !_shrinkNote && !_isReplace && !opts?.forceFull) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast(`?? ����� ��� ������ ������ ���� (~${Math.round(_dec.roomKcal)} ����) � ���� ����-������`, 'info' as any);
      _roomKcal = _dec.roomKcal;
    }
    // forceFull (������� �� ���������): ������ � ������� ��������, ��� ������ ��� �������.
    const scaled2 = opts?.forceFull ? null : scaleRecipeToTarget(recipe, { kcal: _roomKcal, p: _mt.p || 30, f: _mt.f || 15, c: _mt.c || 40 }, weight);
    const items2 = scaled2 ? scaled2.items : buildRecipeMealItems(recipe);
    if (!items2 || items2.length === 0) { setRecipePickerMeal(null); return; }
    const mergedItems = [..._baseItems, ...items2];
    const flat2 = flattenRecipeOption(recipe);
    if (scaled2) flat2.appliedScale = scaled2.scale;
    const _notes2: string[] = [];
    if (_shrinkNote) _notes2.push(_shrinkNote);
    if (opts?.snackFreedKcal && opts.snackFreedKcal >= 50) _notes2.push(`?? �������� ����� �� ~${Math.round(opts.snackFreedKcal)} ���� � ����� ��� ������ ������`);
    const patched = _srcMeals.map((x: any, i: number) => i === mealIdx
      ? { ...x, items: mergedItems, totals: sumMealTotals(mergedItems), recipeApplied2: recipe.name, recipeAppliedData2: flat2, rationale: _notes2.length > 0 ? [...(x.rationale || []), ..._notes2] : x.rationale }
      : x);
    const pre = sumDayTotals(patched as any);
    const rb = rebalanceDayAfterRecipes(patched as any, {
      kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
      p: effectiveP > 0 ? effectiveP : pre.p,
      f: effectiveF > 0 ? effectiveF : pre.f,
      c: effectiveC > 0 ? effectiveC : pre.c,
      ..._portableRebOpts(dayIdx),
    });
    const resMeals = rb.meals as any[];
    // �������� ��������� ������������� � ����� ������/���������� ������� ���������� ��������
    // ����������, ����� �������� (��������/������������/��������) ���������� �� stale-�����.
    const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} ���������� ���������` }; })();
    const _resDay = { ...(resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan!.days[resolved.day] : weekPlan!.days[resolved.day]), meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
    let _visiblePlans: any[];
    if (resolved.plan === 'day') {
      setDayPlan(_resDay);
      _visiblePlans = [_resDay];
    } else if (resolved.plan === 'three') {
      const days = [...threeDayPlan!.days];
      days[resolved.day] = _resDay;
      setThreeDayPlan({ ...threeDayPlan!, days, totals: sumMultiTotals(days) });
      if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any);
      _visiblePlans = days;
    } else {
      const days = [...weekPlan!.days];
      days[resolved.day] = _resDay;
      setWeekPlan({ ...weekPlan!, days, totals: sumMultiTotals(days) });
      if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any);
      _visiblePlans = days;
    }
    // G3: ������� �� ������������ ���� (������ three/week ������� �� ������ days � ������ ����).
    setShoppingList(buildShoppingFromPlans(_visiblePlans));
    refreshRecipeCookingCardIfActive(resolved.plan === 'day' ? _resDay : dayPlan, resolved.plan === 'three' ? { days: _visiblePlans } : threeDayPlan, resolved.plan === 'week' ? { days: _visiblePlans } : weekPlan);
    if (typeof (window as any).showToast === 'function') (window as any).showToast(_isReplace ? `?? ������ ������ ������� �� �${recipe.name}�` : `?? ������ ������ �${recipe.name}� �������� � ����${_shrinkNote ? ' (������ ���?�)' : opts?.snackFreedKcal && opts.snackFreedKcal >= 50 ? ' (�������� �����)' : ''}`, 'success');
    setRecipePickerMeal(null);
    setSecondRecipeConflict(null);
  };

  /**
   * P4a-������: �������� ������ ���������, ���� �������� (������� �� ������).
   * ������ secondRecipeConflict, ������� �������� ��� �� ���� ������� �������
   * (������ ������) � ���������� � addSecondRecipeToMeal � forceFull � ���� ���
   * ������, stale-������ ��� (�������������� ����� ���� ����� mealsOverride).
   */
  const addSecondRecipeWithSnackRoom = () => {
    const c = secondRecipeConflict;
    if (!c) return;
    try {
      const r = c.dayIdx === 0 ? { meals: dayPlan?.meals || [] } : (() => {
        const rr = _resolvePlanDay(c.dayIdx);
        if (!rr || rr.plan === 'day') return null;
        const p: any = rr.plan === 'three' ? threeDayPlan : weekPlan;
        if (!p?.days?.[rr.day]) return null;
        return { meals: p.days[rr.day].meals };
      })();
      if (!r || c.mealIdx < 0 || c.mealIdx >= r.meals.length) {
        if (typeof (window as any).showToast === 'function') (window as any).showToast('? ���� ��� ��������� � �������� ����� ������', 'warning');
        setSecondRecipeConflict(null);
        return;
      }
      const fullItems = buildRecipeMealItems(c.recipe);
      const fullKcal = (fullItems || []).reduce((s: number, it: any) => s + (it.kcal || 0), 0);
      if (!fullKcal || fullKcal <= 0) {
        if (typeof (window as any).showToast === 'function') (window as any).showToast('? ������ �� ���������� �� ��������', 'warning');
        setSecondRecipeConflict(null);
        return;
      }
      const needKcal = Math.max(0, fullKcal - Math.max(0, c.roomKcal || 0));
      const { meals: freedMeals, freedKcal } = freeSnackRoomForSecond(r.meals, c.mealIdx, needKcal, lockedFoodIds);
      addSecondRecipeToMeal(c.recipe, c.mealIdx, c.dayIdx, { forceFull: true, mealsOverride: freedMeals, snackFreedKcal: freedKcal });
    } catch {
      setSecondRecipeConflict(null);
    }
  };

  /**
   * v2.1: ������ ������� ������� �������. ������ ������ (����������� ��� ���� �����)
   * �� ���������; ������ �������������� � �������� �������� ������, ���� ����������
   * ������, ��������� ����� �������������� ���������� ��� (����������� ���� �� �������).
   */
  const rescaleSecondRecipeInMeal = (mealIdx: number, dayIdx: number, scale: number) => {
    const s = Math.max(0.5, Math.min(3, Math.round(scale * 2) / 2));
    const resolveMeals = (): { meals: any[]; plan: 'day' | 'three' | 'week'; day: number } | null => {
      if (dayIdx === 0) return { meals: dayPlan?.meals || [], plan: 'day', day: 0 };
      const r = _resolvePlanDay(dayIdx);
      if (!r || r.plan === 'day') return null;
      const p: any = r.plan === 'three' ? threeDayPlan : weekPlan;
      if (!p?.days?.[r.day]) return null;
      return { meals: p.days[r.day].meals, plan: r.plan, day: r.day };
    };
    const resolved = resolveMeals();
    if (!resolved || mealIdx < 0 || mealIdx >= resolved.meals.length) return;
    const m = resolved.meals[mealIdx];
    const flat2orig: any = (m as any)?.recipeAppliedData2;
    if (!m || !(m as any).recipeApplied2 || !flat2orig) return;
    const oldIds: string[] | undefined = flat2orig?.ingredientIds;
    if (!Array.isArray(oldIds) || oldIds.length === 0) {
      if (typeof (window as any).showToast === 'function') (window as any).showToast('? � ������� ������� ��� ������� ������� � ������� ����������', 'warning');
      return;
    }
    saveUndo();
    const oldSet = new Set(oldIds);
    const baseItems = [...(m.items || [])].filter(it => !oldSet.has(it.id));
    let rebuilt: any[] | null = null;
    try { rebuilt = buildRecipeMealItems(rebuildRecipeFromFlat(flat2orig)); } catch { rebuilt = null; }
    if (!rebuilt || rebuilt.length === 0) return;
    const items2 = rebuilt.map(it => {
      const amount = Math.max(5, Math.round((it.amount || 0) * s));
      const r = amount / Math.max(1, it.amount || 1);
      return { ...it, amount, kcal: Math.round((it.kcal || 0) * r), p: Math.round((it.p || 0) * r * 10) / 10, f: Math.round((it.f || 0) * r * 10) / 10, c: Math.round((it.c || 0) * r * 10) / 10, fiber: Math.round((it.fiber || 0) * r * 10) / 10 };
    });
    const mergedItems = [...baseItems, ...items2];
    const flat2 = { ...flat2orig, appliedScale: s, portionScale: s };
    const patched = resolved.meals.map((x: any, i: number) => i === mealIdx
      ? { ...x, items: mergedItems, totals: sumMealTotals(mergedItems), recipeAppliedData2: flat2 }
      : x);
    const pre = sumDayTotals(patched as any);
    const rb = rebalanceDayAfterRecipes(patched as any, {
      kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
      p: effectiveP > 0 ? effectiveP : pre.p,
      f: effectiveF > 0 ? effectiveF : pre.f,
      c: effectiveC > 0 ? effectiveC : pre.c,
      ..._portableRebOpts(dayIdx),
    });
    const resMeals = rb.meals as any[];
    const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} ���������� ���������` }; })();
    const _resDay = { ...(resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan!.days[resolved.day] : weekPlan!.days[resolved.day]), meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
    let _visiblePlans: any[];
    if (resolved.plan === 'day') { setDayPlan(_resDay); _visiblePlans = [_resDay]; }
    else if (resolved.plan === 'three') { const days = [...threeDayPlan!.days]; days[resolved.day] = _resDay; setThreeDayPlan({ ...threeDayPlan!, days, totals: sumMultiTotals(days) }); if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any); _visiblePlans = days; }
    else { const days = [...weekPlan!.days]; days[resolved.day] = _resDay; setWeekPlan({ ...weekPlan!, days, totals: sumMultiTotals(days) }); if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any); _visiblePlans = days; }
    setShoppingList(buildShoppingFromPlans(_visiblePlans));
    refreshRecipeCookingCardIfActive(resolved.plan === 'day' ? _resDay : dayPlan, resolved.plan === 'three' ? { days: _visiblePlans } : threeDayPlan, resolved.plan === 'week' ? { days: _visiblePlans } : weekPlan);
    if (typeof (window as any).showToast === 'function') (window as any).showToast(`?? ������ ������ � ������� ?${s}`, 'success');
  };

  /**
   * v2.1: ������ ������ ������. ������ ������� ��� ���, ���� � �����,
   * ��������� ����� �������������� ����������.
   */
  const removeSecondRecipeFromMeal = (mealIdx: number, dayIdx: number) => {
    const resolveMeals = (): { meals: any[]; plan: 'day' | 'three' | 'week'; day: number } | null => {
      if (dayIdx === 0) return { meals: dayPlan?.meals || [], plan: 'day', day: 0 };
      const r = _resolvePlanDay(dayIdx);
      if (!r || r.plan === 'day') return null;
      const p: any = r.plan === 'three' ? threeDayPlan : weekPlan;
      if (!p?.days?.[r.day]) return null;
      return { meals: p.days[r.day].meals, plan: r.plan, day: r.day };
    };
    const resolved = resolveMeals();
    if (!resolved || mealIdx < 0 || mealIdx >= resolved.meals.length) return;
    const m = resolved.meals[mealIdx];
    if (!m || !(m as any).recipeApplied2) return;
    saveUndo();
    const oldIds: string[] | undefined = (m as any).recipeAppliedData2?.ingredientIds;
    let baseItems: any[] = [...(m.items || [])];
    if (Array.isArray(oldIds) && oldIds.length > 0) {
      const oldSet = new Set(oldIds);
      const filtered = baseItems.filter(it => !oldSet.has(it.id));
      if (filtered.length > 0) baseItems = filtered;
    }
    const patched = resolved.meals.map((x: any, i: number) => {
      if (i !== mealIdx) return x;
      const nx: any = { ...x, items: baseItems, totals: sumMealTotals(baseItems) };
      delete nx.recipeApplied2; delete nx.recipeAppliedData2;
      return nx;
    });
    const pre = sumDayTotals(patched as any);
    const rb = rebalanceDayAfterRecipes(patched as any, {
      kcal: effectiveKcal > 0 ? effectiveKcal : pre.kcal,
      p: effectiveP > 0 ? effectiveP : pre.p,
      f: effectiveF > 0 ? effectiveF : pre.f,
      c: effectiveC > 0 ? effectiveC : pre.c,
      ..._portableRebOpts(dayIdx),
    });
    const resMeals = rb.meals as any[];
    const _newDiversity = (() => { const ids = new Set<string>(); resMeals.forEach((mm: any) => (mm.items || []).forEach((it: any) => { if (it?.id) ids.add(it.id); })); const uf = ids.size; return { uniqueFoods: uf, totalPortions: 0, categories: {}, score: Math.min(10, uf), note: `${uf} ���������� ���������` }; })();
    const _resDay = { ...(resolved.plan === 'day' ? dayPlan : resolved.plan === 'three' ? threeDayPlan!.days[resolved.day] : weekPlan!.days[resolved.day]), meals: resMeals, totals: sumDayTotals(resMeals as any), dietDiversity: _newDiversity };
    let _visiblePlans: any[];
    if (resolved.plan === 'day') { setDayPlan(_resDay); _visiblePlans = [_resDay]; }
    else if (resolved.plan === 'three') { const days = [...threeDayPlan!.days]; days[resolved.day] = _resDay; setThreeDayPlan({ ...threeDayPlan!, days, totals: sumMultiTotals(days) }); if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any); _visiblePlans = days; }
    else { const days = [...weekPlan!.days]; days[resolved.day] = _resDay; setWeekPlan({ ...weekPlan!, days, totals: sumMultiTotals(days) }); if (selectedDayIndex === resolved.day) setDayPlan(days[resolved.day] as any); _visiblePlans = days; }
    setShoppingList(buildShoppingFromPlans(_visiblePlans));
    refreshRecipeCookingCardIfActive(resolved.plan === 'day' ? _resDay : dayPlan, resolved.plan === 'three' ? { days: _visiblePlans } : threeDayPlan, resolved.plan === 'week' ? { days: _visiblePlans } : weekPlan);
    if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ������ ������ ����� � ���� ����������', 'success');
  };

  const toggleAllergen = (id: string) => {
    setAllergens(prev => {
      const updated = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id];
      // P1-fix: ����� � Profile (UnifiedSettings.nutrition.foodAllergies) + legacy he_food_allergens ��� backward-compat
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
   * ������ "?? �������������� �� �������" � ��������� �������� �� UnifiedSettings
   * � ��������� useState ������������. �� ����� �������. ������������ �����
   * ��������������� ����, � ������ ����� "��������� � �������" ��������� �� � �������.
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
          // �� ��������� minutesPerSession ��������, ������ � workout duration
        }
        if (s.training.primaryGoal) { setGoal(s.training.primaryGoal as GoalId); setGoalUserSet(true); }
        // FIX train-bind: ������ ���������� �� ������� (�� ������ ��� ��������)
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
        // mealsPerDay ������ ���� (������� �������) � �� ������� �� �����������.
        if (s.nutrition.foodAllergies) setAllergens(s.nutrition.foodAllergies);
        if (s.nutrition.foodIntolerances) setIntolerances({ ...intolerances, ...Object.fromEntries((Array.isArray(s.nutrition.foodIntolerances) ? s.nutrition.foodIntolerances : []).map((a: string) => [a, true])) });
        if (s.nutrition.excludedFoods) setExcludedFoods(s.nutrition.excludedFoods);
        if (s.nutrition.preferredFoods) setPreferredFoods(s.nutrition.preferredFoods);
        if (s.nutrition.preferredByMeal) setPreferredByMeal(s.nutrition.preferredByMeal);
        // FIX 1.1: ������ split-������ �/�� �� ������� (�� numeric proteinPerKg).
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
   * ������ "?? ��������� � �������" � ����� ������� ��������� �������� � UnifiedSettings.
   * ���������� �� ������ �������� ������������.
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
      // FIX train-bind: ������ ���������� � ������� (�� ������ ���������� � ��������)
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
      // FIX 1.1: ������ �/�� � ������ {protein,fat,carbs} ������� � ��������� ���� manualGPerKgSplit,
      // �� � numeric proteinPerKg (������ ����� �������� ���� ��� ��-����/organ-load).
      next.nutrition.manualGPerKgSplit = (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0)
        ? { protein: manualGPerKg.protein || 0, fat: manualGPerKg.fat || 0, carbs: manualGPerKg.carbs || 0 }
        : undefined;
      // ��������: heal ��� ������������ numeric proteinPerKg (������ > ����� 1.8, ������ ��������� � Split).
      if (next.nutrition.proteinPerKg && typeof next.nutrition.proteinPerKg === 'object' && !Array.isArray(next.nutrition.proteinPerKg)) {
        if (!next.nutrition.manualGPerKgSplit) next.nutrition.manualGPerKgSplit = next.nutrition.proteinPerKg;
        next.nutrition.proteinPerKg = 1.8;
      }
      next.nutrition.eveningLowCarb = eveningLowCarb;
      // FIX 1.4/1.5: ��������� ������ ���� ���� + ����� ������� � �������.
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

  // P0-fix (Aug 5 2026): ������ �������������� ������������� useState > updateProfile.
  // ������ ���� � ������������ ���������. ������ "?? ��������� � �������" �����
  // ��������� � useProfile() �� ������ �������� ������������. ��� �������������
  // ���������� ������ ������� ��� ������������� ���������� � ������������.
  // B4-fix: Sync weight/height/age/sex/bodyFat back to profile � ���������.
  // (������������ ������ ���� ������ "��������� � �������" � ��. `saveToProfile` ����)

  // Auto-recalc macros when course changes
  // P1-fix: dependency was `injections.length` which missed dose/type changes on
  // an existing injection (same length, different drug). Now keyed on a serialized
  // signature of types+doses so adding/removing/changing a drug all trigger recalc.
  const effectiveKcalRef = useRef(effectiveKcal);
  effectiveKcalRef.current = effectiveKcal;
  // D (���� D): �������� ������ ������������ ��� ����� ��������� ������ �
  // recent-��������, ���� ��������� 2 ���� � �������������� ������� �� ������������
  // ��� �������� ����� �������� ������ (weekIndex-defined ������).
  // P1-1/P1-4 (���� ������������): + weekFamilies (������� ����� ����� ?2 ����
  // ������), ������� he_planner_variety_ledger_v1 � ���������� ������������������.
  const varietyLedgerRef = useRef<{ foods: Set<string>; recipes: Set<string>; recent: string[][]; weekFamilies: string[][] }>({ foods: new Set(), recipes: new Set(), recent: [], weekFamilies: [] });
  // ����-����� (�����������): seeded-������� ���� ��������� (�������, ��������� �� �����).
  const genSaltRef = useRef<number>(0);
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem('he_planner_gen_salt') || '0');
      if (Number.isFinite(v) && v >= 0) genSaltRef.current = v;
    } catch {}
    // P1-1/P1-4: �������������� ledger ������������ � �������� �������/�������������.
    try {
      const l = loadVarietyLedger();
      l.foods.forEach(id => varietyLedgerRef.current.foods.add(id));
      l.recipes.forEach(r => varietyLedgerRef.current.recipes.add(r));
      varietyLedgerRef.current.recent = l.recent;
      varietyLedgerRef.current.weekFamilies = l.weekFamilies;
    } catch {}
  }, []);
  // ���� 4: �����/DIAAS-������ ����� ����� (�������� ����� > prefer-��������� �������).
  const microLedgerRef = useRef<{ preferIds: Set<string>; notes: string[] }>({ preferIds: new Set(), notes: [] });
  const manualGPerKgRef = useRef(manualGPerKg);
  manualGPerKgRef.current = manualGPerKg;
  const injectionsSignature = (Array.isArray(injections) ? injections : [])
    .map(i => `${i?.type || ''}:${i?.dose || 0}`).join('|');
  useEffect(() => {
    const safeInjections = Array.isArray(injections) ? injections : [];
    const aasCount = safeInjections.filter(i => i.type === '���').length;
    // FIX manual-card: ��� ���������, � �� ����������. ������ ��� ������ 2.5
    // ������ ������ �������� ��� ���+����� � ������� � 1.8 ��� ��� � �����
    // ����� ������ ���� �/�� (� ��� 2.5 ������ ��� ������������). ������ ������
    // ��������� ������ (suggest-if-empty), ����� ���� ������������ ����.
    if (aasCount > 0 && goal === 'mass' && !(manualGPerKgRef.current.protein > 0)) {
      setManualGPerKg(prev => ({ ...prev, protein: 2.5 }));
    }
    const insulinCount = safeInjections.filter(i => i.type === '�������').length;
    if (insulinCount > 0) {
      setManualKcal(prev => prev || Math.round(effectiveKcalRef.current * 1.1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectionsSignature, goal]);

  // P0-fix (Aug 5 2026): ������ useEffect ������ `he_nutrition_profile` ����� �
  // ���� ���� ����� �� �������, ��� ��� ����. �������� �� ����� ����� �� �����:
  // unified-profile.ts ��������� ��� ��������� � UnifiedSettings, � �����������
  // ������ �� ����� `getProfile()` + `useProfileSection()`.

  // -- Supplement / Water timeline builders (������� ���� generatePlan �� ��������� TDZ) --
  const buildSupplementTimeline = (mealTimes: { time: string; label: string; pct: number }[], isTrainingDay: boolean) => {
    const userSupps = takenSupplements.map(sid => ALL_SUBSTANCES.find(a => a.id === sid)).filter(Boolean);
    const timeline: { time: string; items: { name: string; dose: string; note: string }[] }[] = [];
    mealTimes.forEach(mt => {
      const isMorning = mt.label === '�������';
      const isEvening = mt.label === '����' || mt.label === '�������';
      const isPreW = mt.label === '��������';
      const isPostW = mt.label === '����-����';
      const isBed = mt.label === '����' || mt.label === '�������';
      const slotItems: { name: string; dose: string; note: string }[] = [];
      if (isMorning) {
        if (userSupps.some(s => (s?.id||'').includes('creatine'))) slotItems.push({name:'�������',dose:'5�',note:'� ��������� ��� ������� ��������'});
        if (userSupps.some(s => (s?.id||'').includes('d3')||(s?.id||'').includes('vitamin_d'))) slotItems.push({name:'D3+K2',dose:'5000ME+100���',note:'� ������ �����'});
        if (userSupps.some(s => (s?.id||'').includes('omega')||(s?.id||'').includes('fish_oil'))) slotItems.push({name:'�����-3',dose:'2-3�',note:'� ���� ��� ���������'});
        if (userSupps.some(s => (s?.id||'').includes('nac')||(s?.id||'').includes('n_acetyl'))) slotItems.push({name:'NAC',dose:'600-1200��',note:'������ ������'});
        if (userSupps.some(s => (s?.id||'').includes('tudca'))) slotItems.push({name:'TUDCA',dose:'500��',note:'� ����. ����������'});
      }
      if (isPreW && isTrainingDay && userSupps.some(s => (s?.id||'').includes('bcaa')||(s?.id||'').includes('eaa'))) slotItems.push({name:'BCAA/EAA',dose:'10-15�',note:'�� 30 ��� �� ����������'});
      if (isPostW && isTrainingDay) {
        if (userSupps.some(s => (s?.id||'').includes('whey')||(s?.id||'').includes('protein'))) slotItems.push({name:'�������',dose:'30-50�',note:'����� ����������'});
        if (userSupps.some(s => (s?.id||'').includes('creatine'))) slotItems.push({name:'�������',dose:'5�',note:'� ���������� postW (������� ��������� ��������� � �����)'});
      }
      if (isEvening) {
        if (userSupps.some(s => (s?.id||'').includes('omega')||(s?.id||'').includes('fish_oil'))) slotItems.push({name:'�����-3',dose:'2-3�',note:'������ ���� �� ����'});
        if (userSupps.some(s => (s?.id||'').includes('nac')||(s?.id||'').includes('n_acetyl'))) slotItems.push({name:'NAC',dose:'600-1200��',note:'�������� ����'});
        if (userSupps.some(s => (s?.id||'').includes('tudca'))) slotItems.push({name:'TUDCA',dose:'500��',note:'�������� ����'});
      }
      if (isBed) {
        if (userSupps.some(s => (s?.id||'').includes('magnesium')||(s?.id||'').includes('mg_'))) slotItems.push({name:'������',dose:'400��',note:'�� 30 ��� �� ���'});
        if (userSupps.some(s => (s?.id||'').includes('zinc')||(s?.id||'').includes('zn_'))) slotItems.push({name:'����',dose:'30��',note:'� ����, �� � ��������'});
        if (userSupps.some(s => (s?.id||'').includes('melatonin'))) slotItems.push({name:'���������',dose:'3-5��',note:'�� 30-60 ��� �� ���'});
        if (userSupps.some(s => (s?.id||'').includes('casein'))) slotItems.push({name:'������',dose:'30-40�',note:'��������� ����� �� ����'});
      }
      if (slotItems.length > 0) timeline.push({ time: mt.time, items: slotItems });
    });
    const phaseSupps: { name: string; dose: string; note: string }[] = [];
    const aasOral = injections.some(i => i.type === '���' && i.esterType !== 'long');
    const aasAny = injections.some(i => i.type === '���');
    const hasInsulin = injections.some(i => i.type === '�������');
    const hasGH = injections.some(i => i.type === '��');
    if (phase === 'course') {
      if (aasOral) { phaseSupps.push({name:'NAC',dose:'1200-1800��',note:'�������� ��� > ��������� ���� NAC'}); phaseSupps.push({name:'TUDCA',dose:'1000-1500��',note:'�������� ��� > ���������� ����������'}); }
      if (aasAny) { phaseSupps.push({name:'�����-3',dose:'3-6� EPA+DHA',note:'��������������� �� �����'}); phaseSupps.push({name:'CoQ10',dose:'200-300��',note:'���������������� ������ ��������'}); }
      if (hasGH) { phaseSupps.push({name:'��������',dose:'500�� 3?/����',note:'�������� ������� ��� ��'}); phaseSupps.push({name:'R-ALA',dose:'300-600��',note:'������������������� ��� ��'}); }
      if (hasInsulin) { phaseSupps.push({name:'��������',dose:'500�� 3?/����',note:'�������������������'}); phaseSupps.push({name:'����',dose:'400-600���',note:'�������� �������� ��������'}); }
    }
    if (phase === 'pct') {
      phaseSupps.push({name:'D3+K2',dose:'10000ME+200���',note:'��������� ������������ �� ���'}); phaseSupps.push({name:'����',dose:'50��',note:'��������� + �����������'}); phaseSupps.push({name:'������',dose:'500��',note:'��� + �������� �� ���'}); phaseSupps.push({name:'���������',dose:'600��',note:'���������: �������� + �����������'});
    }
    if (phase === 'cutting') {
      phaseSupps.push({name:'L-��������',dose:'2-3�',note:'������� + ��������� �� � �����������'}); phaseSupps.push({name:'������ ���',dose:'500�� EGCG',note:'���������� + ������������'}); phaseSupps.push({name:'��������',dose:'5-10��',note:'?2-���������� � stubborn fat'}); phaseSupps.push({name:'���������',dose:'10-15�',note:'������� + ��� �� ��������'});
    }
    // #3 ������� ������� ������� (������� �� ���� �����).
    if (sex === 'female') {
      const fRules = getFemaleSupplementRules((cyclePhase as MenstrualPhase) || 'none');
      if (fRules.length > 0) {
        timeline.push({ time: '? �������', items: [{name: '������� �������', dose: '�', note: fRules.map(r => `${r.supplement}: ${r.rule}`).join(' | ')}] });
        timeline.push(...fRules.map(r => ({ time: '', items: [{name: r.supplement, dose: '��. �������', note: r.rule}] })));
      }
    }
    if (phaseSupps.length > 0) {
      timeline.push({ time: '? ����', items: [{name:`���� �${phase}�`,dose:'�',note:phaseSupps.map(s=>`${s.name} ${s.dose}: ${s.note}`).join(' | ')}] });
      timeline.push(...phaseSupps.map(s => ({ time: '', items: [s] })));
    }
    return timeline;
  };
  const buildWaterTimeline = (w: number, mealTimes: { time: string; label: string }[], isTrainingDay: boolean, trainStart: string) => {
    // #8 ���������� �� ����: base 35 ��/�� + sweat �� �������������/������������.
    const _sweatMlPerH = trainIntensity === 'high' ? 1500 : trainIntensity === 'medium' ? 1000 : 600; // ��� ��/�
    const _trainDurH = (s?.training?.minutesPerSession || 60) / 60;
    const _sweatMl = isTrainingDay ? Math.round(_sweatMlPerH * _trainDurH) : 0;
    const totalMl = Math.round(w * 35) + _sweatMl;
    const slots = mealTimes.length;
    const perSlot = Math.round(totalMl / (slots + 2));
    const timeline: { time: string; ml: number; note: string }[] = [];
    timeline.push({ time: '07:30', ml: 500, note: '����: 500 �� ����� ����� �����������' });
    mealTimes.forEach((mt, i) => {
      const ml = i === 0 ? 300 : perSlot;
      timeline.push({ time: mt.time, ml, note: `${mt.label}: ${ml} ��` });
    });
    if (isTrainingDay && trainStart) {
      const tH = parseInt(trainStart.split(':')[0]);
      const preH = Math.max(0, tH - 1);
      const postH = Math.min(23, tH + 1);
      const _postMl = Math.min(800, 400 + Math.round(_sweatMl * 0.5));
      timeline.push({ time: `${String(preH).padStart(2,'0')}:30`, ml: 500, note: '�� 60 ��� �� ����������' });
      timeline.push({ time: `${String(postH).padStart(2,'0')}:00`, ml: _postMl, note: '����� ����������: ��������������' + (_sweatMl > 800 ? ' (��� ~' + _sweatMl + ' �� � �������� �����������: Na/K/Mg)' : '') });
    }
    timeline.push({ time: '21:00', ml: 300, note: '�����: �� ����� ��� �� 1-2� �� ���' });
    return timeline;
  };

  // --- Generate Plan ---
   const generatePlan = async (days: 1 | 3 | 7, weekIndex?: number, dayIndex?: number, opts?: { skipUndo?: boolean; async?: boolean; overrides?: { mealsCount?: number } }) => {
      // ? ������������� ��������� 3/7 ����: yield ����� �����, ����� UI �� ������.
      // ������������ ��������� (3/7) ������ ������������� � ���������� �� �����������
      // (����� � ������ ����� ����� �� ������� ������� ��� { async: true }).
      const isAsync = opts?.async === true || days >= 3;
      const maybeYield = async () => { if (isAsync) await new Promise<void>(r => setTimeout(() => r(), 20)); };
     if (isAsync) { try { setPlanBusy(true); setErrorMsg(null); } catch {} }
     try {
     // P1-fix: ����� skipUndo ��� �������� ��������� (�����) � ����� 5?saveUndo ���������
     // undoStack (cap=5) � ���������� ������� ����� ������������.
     if (!opts?.skipUndo) saveUndo();
     setPlanDays(days);
     if (dayIndex !== undefined) setSelectedDayIndex(dayIndex);
     setWeekEditDay(null); // FIX button-audit: ����� ��������� ���������� �������������� ������

        // v6: V2 � ������������ ������ (classic �����). simple/minimal � ������� pro (quality:'basic' + variety/budget).
        if (true) {
         try {
       const toMin = (t: string) => t?.includes(':') ? parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) : 0;
        const bfPct = bodyFatPct > 3 ? bodyFatPct : (sex === 'male' ? 15 : 22);
        const lbmKg = weight * (1 - bfPct / 100);
         const trainStartMin = linkToTraining && trainStart?.includes(':') ? toMin(trainStart) : undefined;
        const excludedIds = new Set<string>(excludedFoods || []);
        (healthIssues || []).forEach(hid => { const issue = HEALTH_ISSUES.find(h => h.id === hid); if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid)); });
        getAutoExcludedFoodIds(FOOD_DB, healthIssues || []).forEach(fid => excludedIds.add(fid));
        // FIX allergens-restrictions: ��������� � dietPrefs-����������� ������ �����������
        // ������ ���������� � ����� ����� ��������� (������ pro-������ �� �����������).
        for (const fid of resolveAllExcludedFoodIds(FOOD_DB, allergens || [], dietPrefs || [])) excludedIds.add(fid);
        try { setAllergenExcludedCount(countExcludedByAllergens(FOOD_DB, allergens || [])); } catch {}
        const lockedIds = new Set<string>([...(lockedFoodIds || [])]);
        // D (���� D): �������� ledger ������������ � ����� �� ���������� ���������
        // ��������/������� ����� �������� (������ ������ generatePlan(7, w) ��������
        // � ������� recentFoodIds/_usedRecipeNames > recipes ����������� week-to-week).
        // P1-1/P1-4 (���� NUTRITION-VARIETY-PLAN): ������ ������ ���������� � �������
        // ������������� (������� he_planner_variety_ledger_v1, ���� foods 60 / recipes 30 /
        // recent 2 ��� / weekFamilies 7 ����) � ������������������ ������ �� ��� ��� ��
        // ����. ������ ��������������� � fresh-������� � �������� (�����/����) �� ��������.
        const _ledger = varietyLedgerRef.current;
        const recentFoodIds = _ledger.foods;
       // B5 (���������� �������): ��������� �������� ���������� ���� ������� ��������� �
       // ������ ���������������� ���� � ������ �����, ���� ���� ?2 ������ �����������.
       const recentStapleFamilies = new Set<string>();
       const collectFoods = (plan: any) => { if (plan?.meals) plan.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); })); if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) recentFoodIds.add(it.id); }))); };
       const collectFamilies = (plan: any) => {
         const addFrom = (items: any[]) => items.forEach((it: any) => { const fam = stapleFamilyOf(it.id || ''); if (fam) recentStapleFamilies.add(fam); });
         if (plan?.meals) plan.meals.forEach((m: any) => addFrom(m.items || []));
         if (plan?.days) plan.days.forEach((d: any) => d?.meals?.forEach((m: any) => addFrom(m.items || [])));
       };
       if (days >= 3 && dayPlan) { collectFoods(dayPlan); collectFamilies(dayPlan); }
       if (days >= 7 && threeDayPlan) { collectFoods(threeDayPlan); collectFamilies(threeDayPlan); }
       // P0-7 (������������): ��� ��������� ������������� recents �������� ������ ��
       // 3��-����� � weekPlan (������� ������) �������������, � ����� ������ ����������
       // �� ������ ��������, �������� ����� ������� ������. ������ ���������������.
       if (days >= 7 && weekPlan) { collectFoods(weekPlan as any); collectFamilies(weekPlan as any); }
       if ((dietPrefs || []).includes('vegetarian')) {
         Object.entries(FOOD_ALLERGEN_DIET).forEach(([fid, tags]) => { if (tags.isVegetarian === false) excludedIds.add(fid); });
       }
       const dayIdx = days === 1 ? selectedDayIndex : 0;
        const isTrainingDay = isTrainDay(dayIdx);
      // ����-����� (�����������): seeded-���� � ������������� ������� (he_planner_gen_salt).
      // ������ ��������� ��� ������ ������ ������ ��� ���� ���� (���� 0), ������
      // ��������� ������������������ �������������� � ����� �������. ��������� �����
      // ������������ (seeded)� �����������: ���������� ������� + ������� = ��� �� �����.
      const planRandomSalt = (() => {
        const s = genSaltRef.current;
        genSaltRef.current = s + 1;
        try { localStorage.setItem('he_planner_gen_salt', String(genSaltRef.current)); } catch {}
        return s % 1000000;
      })();
      // ?? ����� ��� ��������: ����� ��������, ��� �������������� � ������������ �����
      // (������������ ����� ����� � ���� ������ �� ����������� �� ���������� ���������).
      // D (���� D): � ������ ������ �� ������������ ����� ��������.
      const _usedRecipeNames = _ledger.recipes;

      // ���� 4: �����/DIAAS-������ � ����� ������ ��� ������� ���������, �������� � ������.
      const _microLedger = weekIndex !== undefined
        ? microLedgerRef.current
        : (microLedgerRef.current = { preferIds: new Set(), notes: [] });

      // ?? �������� lab values �� v2Labs (������ > �����) ��� ����������� ���������.
      // ����� (units-fix): v2Labs �������� � ������������ ������� (ALT/AST/LDL/����������/�),
      // � ������� ������� ����������� ������� (������/�����/������ � ��). ������
      // computeLabDietAdjustment �������� Na/K ��� ������������ (K >5.0 �����/�, Na >145 �����/�);
      // unit-guard � ������ ��������� ������ �� ������������ �������� (K 2.5�10, Na 100�200),
      // ������� ������� 4500 �� ����� �� ���� ������ ���������������. ������� �� (uppercase),
      // � ������� � ������������ � � ������.
      const SERUM_LAB_KEYS = new Set([
        'glucose', 'insulin', 'homa_ir', 'alt', 'ast', 'ggt', 'creatinine', 'urea',
        'hematocrit', 'hemoglobin', 'hdl', 'ldl', 'apob', 'tsh', 'vitamin_d', 'ferritin',
        'homocysteine', 'crp', 'testosterone', 'estradiol', 'prolactin', 'hba1c', 'glycated_hemoglobin',
        'sodium', 'potassium', 'magnesium',
      ]);
      const labValuesForPlan: Record<string, number> = {};
      Object.entries(v2Labs).forEach(([key, val]) => {
        const k = (key || '').toLowerCase();
        if (!SERUM_LAB_KEYS.has(k)) return; // ������ ����� (�������/���������) �� �������
        const num = parseFloat(val as string);
        if (!isNaN(num) && num > 0) labValuesForPlan[k.toUpperCase()] = num;
      });

      // ��������� �� ��������: ����������� ���������� ���������� ��� ������������ ���.
      const baseGoalKcal = Math.max(1200, effectiveKcal || weight * 30 || 2500);
      const baseGoalP = Math.max(80, effectiveP || weight * 2 || 160);
      const baseGoalF = Math.max(30, effectiveF || weight * 0.8 || 70);
      const baseGoalC = Math.max(50, effectiveC || weight * 3.5 || 300);
      // ���� 5: rolling-����������� ��������� ������ buildOneDay �� ���� ������� ���
      // (���� N ������������ ���� ��� N?1) � ��. ����.
      // Smart 7-day variety: rolling window of food IDs from the last 2 built days.
      // recentFoodIds (existing) accumulates ALL prior days; hardWindow holds the last 2
      // for the stricter hard-exclusion (adjacent days don't repeat products).
      // D (���� D): � ������ ���� ��������� � ������� ������� (���� ������ �� ��������� �������).
      // P1-1: ������ ������ ����������� � ���� ��������� 2 ���� ���� � ����� ���������������.
      const hardWindow: string[][] = varietyLedgerRef.current.recent.length > 0
        ? [...varietyLedgerRef.current.recent]
        : [];
      // FIX �������: offset ��� �������� ��������� � weekFamilies (� week-���� ���� 0
      // �������� ������: d1 + week-���� � ������� ��� ����� ��� � ������� ��� ������).
      const _pushedFamOffsets = new Set<number>();
      const collectDayFoods = (day: any): string[] => {
        const ids: string[] = [];
        if (day?.meals) day.meals.forEach((m: any) => m.items?.forEach((it: any) => { if (it.id) ids.push(it.id); }));
        return ids;
      };

      const buildOneDay = (offset: number): any => {
        // ���� 1: ������ ������������ ��������� � ���� �������, ���� ��������.
        // Legacy cyclingMode/dietPauseMode/periodizationEnabled ������� �� ���������.
        const isTrain = isTrainDay(offset);
        const _perio = applyCarbPeriodizationMods(carbPeriodization, offset, isTrain);
        let dayKcalMod = _perio.dayKcalMod, dayCarbMod = _perio.dayCarbMod;
        let isRefeedDay = _perio.isRefeedDay;
        // ���� 6: ���� ������ ���/�������� ������ � ���� +25%, ���� +5%
        // (Helms 2014/2019: legs/high-volume ���� � ������������ ������������ �������).
        // heavyTrainDay � ���� ������ �� DAY_LABELS; ����������� ������ ������������.
        const _isHeavyDay = isHeavyDayForOffset(heavyTrainDay, offset, DAY_LABELS);
        if (_isHeavyDay) { dayKcalMod *= 1.05; dayCarbMod *= 1.25; }
        // #1 ������� ���� �����: ������ ����� � ��������; ����� ����-���� �� ���������
        // (���� 7: ������� ����� + ��������� ��� ������ �������, he_cycle_log).
        const _cyclePhaseEff: MenstrualPhase = (sex === 'female')
          ? (((cyclePhase as MenstrualPhase) && (cyclePhase as MenstrualPhase) !== 'none') ? (cyclePhase as MenstrualPhase) : (autoCyclePhase().phase))
          : 'none';
        const _cycleCalendarNote = (sex === 'female' && (!cyclePhase || cyclePhase === 'none') && _cyclePhaseEff !== 'none')
          ? `?? ���� ����� ���������� �� ���������: ${CYCLE_PHASE_RU[_cyclePhaseEff]} (����� ����� ${autoCyclePhase().length} ��). ������ ����� � ���������� �����������.`
          : undefined;
        const _mp = (sex === 'female') ? getMenstrualPhaseNutrition(_cyclePhaseEff) : null;
        if (_mp) { dayKcalMod *= _mp.kcalMod; dayCarbMod *= _mp.carbMod; }
        // #2 �����/������� ��� ������: ���������� Ca ��� ������ %����/��������/���������.
        const _caInfo = (sex === 'female') ? getCalciumTarget('female', bfPct, _cyclePhaseEff, age) : null;
        const _boneNotes: string[] = [];
        if (_caInfo && _caInfo.boneRisk) _boneNotes.push(_caInfo.note, calciumDoseSplitNote());
        // #7 ���-�������: ��� ������ ���/�������� � ���������/Mg/�����.
        // #6 Diet-break �����������: ������ ����� + �������������� ��������� > ������������ 2-���������� maintenance.
        // #5 ��������� ������������ > ������� %���� + ������.
        const _bbCat = getBBCategory(bbCategory, sex);
        const _categoryNote: string | undefined = _bbCat ? `${_bbCat.label}: ������� %���� ~${_bbCat.targetBodyFatPct}% � ${_bbCat.note}` : undefined;
        // #3 ��������� -> ������������� �������� ��� ����� (���� ��������� -> ������ �������, � ����� RED-S).
        // #3+#7 ��������� + target-BF: ��������������� �������-��� (����� ��������������, ��� RED-S).
        if (_bbCat) { const _defMod = getCombinedDeficitMod(bfPct, _bbCat.targetBodyFatPct, goal === 'cutting' || goal === 'fat_loss'); dayKcalMod *= _defMod; }
        // #4 ���-������ ��: legacy-��������� ������� � ������ ���� ����� bbContestPrepPlan
        let _peakNote: string | undefined = undefined;
        // #10 ��������� ����� / ������������.
        const _lifeStageNote: string | undefined = (sex === 'female') ? (getLifeStageNote(lifeStage) || undefined) : undefined;
        const _dietBreakNote: string | undefined = ((goal === 'cutting' || goal === 'fat_loss') && metabolicAdaptEnabled && metabolicAdaptPct > 0)
          ? '?? Diet break ������������: �������������� ��������� ����������. ��������� �� 2 ������ maintenance (������� �����������) ��� �������������� �������/�������� � ����������. ����� 2.2 �/��, �������� ��������������, ���������� ���������.'
          : undefined;
        const _sleepNote: string | undefined = (sleepHours < 7 || sleepQuality < 6)
          ? '?? ��� ������: �������� tryptophan-��������� (�������, ����, ������, �������) + Mg glycinate �� ����. ����-����� (���������) ����� ����. �������� ������/�������� ����� 15:00.'
          : undefined;
        // ���� 5: ���������� ����������� � ���� ���� ������� ��� ����� (���� N
        // ������������ ���� ��� N?1). ������ ����������� ������ � offset 0.
        const _prepDate = isoAddDays(isoToday(), offset);
        const diaryComp: CompensationResult | null = diaryAdaptation
          ? computeRollingCompensation({ kcal: baseGoalKcal, p: baseGoalP, f: baseGoalF, c: baseGoalC }, 7, _prepDate)
          : null;
        // #7 Anti-oscillation: ���� ����������� � cycling ������� � ���� ������� �
        // ���������� ����������� (�� ������� +15% training-day � +200 ��������).
        const _diaryActive = !!(diaryComp && diaryComp.applied);
        const _cycDir = dayKcalMod - 1; // >0 = up-day, <0 = down-day
        const _dampK = (_diaryActive && Math.sign(_cycDir) === Math.sign(diaryComp.delta.kcal)) ? (1 - Math.abs(_cycDir)) : 1;
        const _dampC = (_diaryActive && Math.sign(dayCarbMod - 1) === Math.sign(diaryComp.delta.c)) ? (1 - Math.abs(dayCarbMod - 1)) : 1;
        // ���� 1: ��������� ����� 2+1 (������ periodizationEnabled) � � applyCarbPeriodizationMods (mode 'wave').
        // #4b ���-������ �� / ?? Contest prep: ���������� ���� �� �������� ���� ���
        // (today + offset) � ��������� ��� cycling/������������.
        // ��������� ����������: ������ ���� (goals.bbContestPrepPlan, ��������� � ����������)
        // > legacy ������ (goals.bbPeakConfig, ������ ���-������).
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
                _specialNotes.push('?? ����� �� ����������: �������� ?2.2, ���� ������� � �������������� ��������� � �������.');
              }
            }
            const _cm = _todaySpecial.find((m: any) => m.type === 'cheat_meal');
            if (_cm && !isRefeedDay) {
              dayKcalMod = Math.max(dayKcalMod, 1.12);
              _specialNotes.push('?? ������ �� ����������: ������������ ��� ��������, ���� ���� � ��������� ����� (�� 1500 ����). �� �������������� �� ��������� ����.');
            }
            const _fast = _todaySpecial.find((m: any) => m.type === 'fast');
            if (_fast) {
              _fastingDay = true;
              dayKcalMod = Math.min(dayKcalMod, 0.75); dayCarbMod = Math.min(dayCarbMod, 0.7);
              _specialNotes.push('? ������� �� ����������: ������������ �������, ������ ������, ������ ���� ����� (���� ~8 �, ����. 12:00�20:00).');
            }
            // E6 (�������� > ������ �����): ������ ��������� � replaceMeal �������
            // ������������� ������� ���� (������ ������ ������ �������: �����).
            for (const _s of _todaySpecial) {
              if (!_s.replaceMeal) continue;
              _specialMealOverrides.push({
                targetLabel: _s.replaceMeal,
                kind: _s.type === 'cheat_meal' ? 'cheat' : _s.type === 'refeed' ? 'refeed' : 'fast',
              });
            }
          }
        } catch {}
        // E6: �������� ������������ ��������� (�������) � ���������� ������� � ����� �������.
        if (specialMealMode && specialMealReplaceMode) {
          // P1-fix: ����� ��������� ���� ������������, ����� ���� ������ �� �������� �����
          // (������ ��� ����� ���� ����� ������� �� ����� �� �� ��� � ��������� ? ������������).
          const _smTarget = effectiveSpecialMealTarget(specialMealReplaceTarget, specialMealTiming);
          if (_smTarget) _specialMealOverrides.push({ targetLabel: _smTarget, kind: 'custom', p: specialMealProteinG, c: specialMealCarbsG, f: specialMealFatG });
        }
        const _effMealsRaw = _fastingDay ? Math.max(3, (opts?.overrides?.mealsCount ?? mealsCount) - 1) : (opts?.overrides?.mealsCount ?? mealsCount);
        const _effMealsCount = _effMealsRaw;
        const _inPrepWindow = bbPrepPlan ? prepPhaseForDate(bbPrepPlan, _prepDate) !== null : false;
        // ?? ������� ����: �������� ���� �� ���� (��� ��������� ��� contest prep).
        const _annualPhase = annualPlan ? annualPlanPhaseForDate(annualPlan, _prepDate) : null;
        const _peakTargets = bbPrepPlan && _inPrepWindow
          ? nutritionTargetsForPrepDate(_prepDate, bbPrepPlan, {
              kcal: Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
              proteinG: Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
              fatG: Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
              carbsG: Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
              waterMl: 3000,
              sodiumMg: PREP_SODIUM_BASE_MG,
            }, { isHeavyTrainDay: isTrainDay(offset) })
          : bbPrepConfig
            ? computePeakWeekNutritionTargets(_prepDate, {
                kcal: Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
                proteinG: Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
                fatG: Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
                carbsG: Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
                waterMl: 3000,
                sodiumMg: PREP_SODIUM_BASE_MG,
              }, bbPrepConfig)
            : null;
        if (_peakTargets?.phase) _peakNote = _peakTargets.note;
        else if (bbPrepPlan && _peakTargets?.note) _peakNote = _peakTargets.note;
        else if (_annualPhase && _annualPhase.block.ref.kind === 'BB' && _annualPhase.block.ref.phase === 'contest_prep' && !bbPrepPlan && !bbPrepConfig && !_peakNote) {
          _peakNote = '?? ������� ����: ��� ������ � contest prep, �� prep-���� �� ������. �������� �?? Contest prep� � ��-���� (��� �������� �?? ���-������� � ����� � ������� �����) � ����� ���� ���������� �� �����������.';
        }
        const _applyPrepTargets = !!(_peakTargets && (_peakTargets.phase || _inPrepWindow));
        const input: MealPlanInput = {
          weightKg: weight, lbmKg, bodyFatPct: bfPct, sex,
          // D-22: nutrMult already folded into effective* above � do NOT multiply again.
          // D-22: nutrMult folded into effective* above. ��������� �� ��������: �����������
          // ���������� ���������� ����������� ������ � ��������� (offset === dayIdx).
          goalKcal: _applyPrepTargets ? _peakTargets.kcal : Math.round(Math.max(1200, baseGoalKcal * dayKcalMod) + (_diaryActive ? diaryComp.delta.kcal * _dampK : 0)),
          goalProteinG: _applyPrepTargets ? _peakTargets.proteinG : Math.round(Math.max(80, baseGoalP) + (_diaryActive ? diaryComp.delta.p : 0)),
          goalFatG: _applyPrepTargets ? _peakTargets.fatG : Math.round(Math.max(30, baseGoalF * (isRefeedDay ? 0.5 : 1)) + (_diaryActive ? diaryComp.delta.f : 0)),
           goalCarbsG: _applyPrepTargets ? _peakTargets.carbsG : Math.round(Math.max(50, baseGoalC * dayCarbMod) + (_diaryActive ? diaryComp.delta.c * _dampC : 0)),
           manualTargetsLocked: kbjuMode === 'manual',
           mealsCount: _effMealsCount, isTrainingDay: linkToTraining && plannerModeRef.current === 'pro' ? isTrainDay(offset) : false,
          trainStartMin: linkToTraining && isTrainDay(offset) && plannerModeRef.current === 'pro' ? toMin(trainStart) : undefined,
          allowIntraWorkout: linkToTraining && intraWorkoutEnabled && trainIntensity !== 'low' && plannerModeRef.current === 'pro',
          trainDurationMin: linkToTraining ? (s?.training?.minutesPerSession || 60) : undefined,
          trainIntensity: (trainIntensity as any) || 'medium',
          carbAutoCycle: (carbPeriodization === 'carb_cycle' || carbPeriodization === 'butch' || (carbPeriodization as any) === 'auto'),
          excludedIds: (() => { const s: Set<string> = new Set<string>(excludedIds); if (_mp) _mp.avoidIds.forEach((id: string) => s.add(id)); return s; })(),
          allergenTags: selectedAllergenTags(allergens || [], dietPrefs || []),
          preferredIds: (() => { const s = new Set(expandRecipePreferred(preferredFoods, [...getRecipes(), ...(userRecipes||[])], FOOD_DB)); if (_mp) _mp.priorityIds.forEach((id: string) => s.add(id)); _microLedger.preferIds.forEach((id: string) => s.add(id)); if (planType === 'mediterranean') ['salmon','mackerel','olive_oil','tomato','cucumber','yogurt_greek','avocado'].forEach((id: string) => { if (!excludedIds.has(id) && FOOD_DB.some(f => f.id === id)) s.add(id); }); return s; })(),
          preferredByMeal: Object.fromEntries(Object.entries(preferredByMeal || {}).map(([k, v]) => [k, new Set(v as string[] || [])])),
          // ����-����� (8�): specificity ����� �� ��������� (legacy no-op, UI ���) � ������ ���������� default
          intolerances, tasteProfile,
          categoryPref: { preferred: [], excluded: excludedCategories },
          deprioritizedIds: getDeprioritizedIds(),
          lockedIds, recentFoodIds,
          recentStapleFamilies: offset > 0 ? recentStapleFamilies : undefined,
          // P1-3: ��������� ������� ����� ����� ?2 ���� ������ � �� ledger weekFamilies.
          weekStapleFamilies: (() => {
            const _wf = varietyLedgerRef.current.weekFamilies;
            if (!_wf || _wf.length === 0) return undefined;
            const m: Record<string, number> = {};
            for (const day of _wf) for (const fam of day) m[fam] = (m[fam] || 0) + 1;
            return Object.keys(m).length > 0 ? m : undefined;
          })(),
          // P1-6: ����� HV (real � ������, ��������� ����-�-����).
          hvStyle,
          specialMealOverride: _specialMealOverrides.length > 0 ? _specialMealOverrides : undefined,
          hardRecentIds: new Set(hardWindow.flat()),
          varietyStrictness,
          diaryCompensation: _diaryActive ? { kcalDelta: diaryComp.delta.kcal, pDelta: diaryComp.delta.p, fDelta: diaryComp.delta.f, cDelta: diaryComp.delta.c, note: diaryComp.note, severity: diaryComp.severity } : undefined,
          budget: plannerModeRef.current === 'minimal' ? 'low' : plannerModeRef.current === 'simple' ? 'medium' : budget, isVegetarian: dietPrefs.includes('vegetarian'),
          isCutting: goal === 'cutting' || goal === 'fat_loss',
          dayOffset: offset, cyclePhase: phase as any,
          randomSalt: planRandomSalt,
          variety: plannerModeRef.current === 'minimal' ? 'minimal' : plannerModeRef.current === 'simple' ? 'medium' : variety,
          // P1-9: ������ ������� � 0 = ����� ���� ������� � ������; ��� ���������
          // ������ ���������� ���� ������ (����-�-����, ��� ������). ������ ���� �
          // ���� ������������: ������� ��������� �� ��������� (0 = ��� �������).
          carbCapGPerKg: (_capOverride || kbjuMode === 'manual') ? 0 : undefined,
          wakeTime, lunchTime, dinnerTime, bedTime,
          // �����-3: floor/MPS-������������ ����� ������� ������ �� ������� ���������
          // (planTypeFloorMods � planner-day-targets) � ������ ��� ������� �� �� planType.
          // ������������ planTypeMod (PLAN_TYPES pMult/fMult/cMult) �����.
          planType,
          eveningLowCarb,
          nightCarbsG: nightCarbs,
          addMilkToBreakfast,
          breakfastStyle,
          breakfastTemplate,
          labValues: Object.keys(labValuesForPlan).length > 0 ? labValuesForPlan : undefined,
          calciumTargetOverride: _caInfo ? _caInfo.target : undefined,
          // PRO-3 �6: Na-���� � �� ��� ���� ����� (�� ������ ���), ������ �������� (PREP_SODIUM_BASE_MG).
          sodiumTargetOverride: _peakTargets ? _peakTargets.sodiumMg : undefined,
          menstrualPhaseNote: _mp ? _mp.note : undefined,
          carbGiPref: _mp ? _mp.carbGiPref : undefined,
           quality: plannerModeRef.current === 'pro' ? 'full' : 'basic',
           // ���� 4 (���-15/16): �������� � V2-������ ��� �������� ������ � ������.
           injections: injections.map(i => ({ type: i.type, name: i.name, time: i.time, dose: i.dose, esterType: i.esterType, trainLinked: i.trainLinked, trainTiming: i.trainTiming })),
           // ���� 5: ��������� �����-���� � ������ �������� �������/����������������� ��������.
           refeedDay: isRefeedDay,
            // ���� 7: ����� ��������� �� prep/���-������ �� (fiberMaxG) � �� ���-��� ����� �����.
            fiberCapG: _peakTargets?.fiberMaxG,
            // �2-PRO-3: ����������������� ������ � ������ ���-���� (phase != null);
            // ����������/����� ������ ������� ������ ���� ��� ���� <35 (������� �����).
            lowFiberComposition: _peakTargets ? _peakTargets.phase != null : undefined,
            // D-28: ��������� ��� �������� ���������� + ���� �� ������ (portable) � pro-������.
            morningTrainLoad,
            portableMode: workFood === 'portable',
            // ������: ���� ����� ��� ������ �����/����� (������ ������ ��������)
            workStartMin: (()=>{ try{ const [h,m]=(workStartTime||'09:00').split(':').map(Number); return h*60+m; }catch{ return 9*60; }})(),
            workEndMin: (()=>{ try{ const [h,m]=(workEndTime||'18:00').split(':').map(Number); return h*60+m; }catch{ return 18*60; }})(),
            isWorkDay: (()=>{ try{ if(!workScheduleEnabled) return workFood === 'portable'; return isWorkDayForIndex(offset, { enabled: true, scheduleType: workScheduleType, workDays }); }catch{ return false; }})(),
          };
        // #1 RED-S / Energy Availability: �������� ��� ������-����������� (EA < 30 ����/�� FFM).
        const _ea = computeEnergyAvailability(input.goalKcal, weight, lbmKg, !!input.isTrainingDay, input.trainDurationMin || 60, (trainIntensity as any) || 'medium', sex);
        // ����-�����: hungerLevel ����� �� ��������� ��������� (��������� �����,
        // prefer-����� � hungerNote ���� ������� ��������).
        const _redSNote: string | undefined = _ea.note || undefined;
        const rawV2 = buildDayPlanV2(input);
        // D-28 �3: ������� ����-������ �� ���� (�����/������/�������) � � proNotes �����.
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
        // ���� 4: �����/DIAAS-������ � ��������/������ ������ ��� ���������� prefer-��������
        // ��� ���������� ��� ����� (������ ����, �� ����-������). ������� ���������� �������
        // �������� � proNotes ������������ ��� (offset > 0).
        try {
          const _def = microDeficitToPreferIds(v2.microSummary?.coverage, dietPrefs.includes('vegetarian'), excludedIds);
          const _diaasMeals = v2.meals.map((m: any) => ({
            label: m?.label || '',
            diaas: (() => { try { return calcMealDIAAS((Array.isArray(m?.items) ? m.items : []).map((it: any) => ({ foodId: it.id, weightGrams: it.amount || 0 }))).diaas; } catch { return null; } })(),
          }));
          const _weak = diaasWeakLinkToPreferIds(_diaasMeals, excludedIds);
          _microLedger.preferIds = new Set<string>([..._def.preferIds, ..._weak.preferIds]);
          _microLedger.notes = [_def.note, _weak.note].filter((n): n is string => Boolean(n));
        } catch { /* ������ �� ������ ������ ��������� */ }
        if (offset > 0 && _microLedger.notes.length > 0 && Array.isArray(v2.notes)) {
          v2.notes = [...v2.notes, ..._microLedger.notes];
        }
        // #8 Health-score ���: composite 0-100 (�����/fiber/MPS/EA/������ ? ���������).
        const _fiberT = sex === 'female' ? 25 : 35;
        const _cov = (v2.microSummary?.coverage || []).filter((c:any) => !['Na','VitA'].includes(c.nutrient));
        const _microAvg = _cov.length > 0 ? Math.min(100, Math.round(_cov.reduce((s:number,c:any)=>s + Math.min(100, c.pct), 0) / _cov.length)) : 70;
        const _fiberScore = Math.min(100, Math.round((v2.totals.fiber || 0) / _fiberT * 100));
        const _mpsScore = Math.min(100, Math.round((v2.mpsSummary.feedings || 0) / 4 * 100));
        const _eaScore = _ea.status === 'risk' ? 40 : _ea.status === 'reduced' ? 75 : 100;
        const _divScore = Math.min(100, Math.round((v2.diversity.uniqueFoods || 0) / 8 * 100));
        const _conflicts = v2.meals.reduce((s:number,m:any)=>s + (m.rationale||[]).filter((r:string)=>r.startsWith('?')).length, 0);
        const _healthScore = Math.max(0, Math.min(100, Math.round(_microAvg*0.3 + _fiberScore*0.15 + _mpsScore*0.2 + _eaScore*0.2 + _divScore*0.15) - _conflicts*5));
        const _healthStatus: 'green' | 'yellow' | 'red' = _healthScore >= 75 ? 'green' : _healthScore >= 55 ? 'yellow' : 'red';
        // ���� 9�: ����� �������� � ������ ����� ��� (0-10) � ������� (��� ������).
        try { addDayScore(_prepDate, _healthScore / 10); } catch {}
        // ����������� DayPlanV2 > ����������� ������ ������� dayPlan.
        // P1b: ��������� role � _cocktail ������� (����� ���� ���������-�������,
        // ����������� �������, �� ������� �� ������ � ������ �� ��������).
        const meals = v2.meals.map((m: any) => ({
          label: m?.label || '���� ����', time: m?.time || '', items: (Array.isArray(m?.items) ? m.items : []).map((it: any) => ({
            name: it.name, id: it.id, amount: it.amount, kcal: it.kcal, p: it.p, f: it.f, c: it.c, fiber: it.fiber, leucine_mg: it.leucine_mg,
            role: it.role, ...((it as any)._cocktail ? { _cocktail: (it as any)._cocktail } : {}),
          })), totals: { kcal: m?.totals?.kcal || 0, p: m?.totals?.p || 0, f: m?.totals?.f || 0, c: m?.totals?.c || 0, fiber: m?.totals?.fiber || 0 },
          type: m?.type,
          conflictWarnings: undefined, synergyNotes: undefined,
           rationale: m.rationale, mpsCheck: plannerModeRef.current === 'pro' ? m.mpsCheck : undefined, target: m.target,
        }));
        // ?? ����� ���������: 'recipes' > �������� ����� (�������/����/����) ����������
        // �� ������� ��������, �������� �������� ����������. 'products' > ��������.
        const _genRecipes = generationModeRef.current === 'recipes';
        // ?? �������-���������: � ������� ����� ��������� 1-3 ���������� �������
        // (���� 8: ������� useRecipesInPlan ����� � ��������� �������� ������;
        // � ������ ��� �������� �������� ����� �������������� assembleRecipeDay).
        const _cookProf: CookProfile | undefined = cookProfileFromSettings({ cookingSkill, cookingFrequency, cookTimeMin, batchCooking });
        const _allRecipes = [...getRecipes(), ...(userRecipes||[])];
        const _recipeBudget = _cookProf ? prepTimeBudgetPerMeal(_cookProf, _effMealsCount) : 60;
        // �7.2-� (�): ����-���� ����� � ������ � �������-������ ��� (����-��������� ������������).
        const _filteredRecipes = filterRecipePoolForBand(_cookProf ? filterByCookSkill(_allRecipes, _cookProf.skill) : _allRecipes, input.goalCarbsG, input.goalProteinG, weight);
        if (_filteredRecipes.length > 0) {
          meals.forEach((m: any) => {
            // � ������ ��� �������� �������� ����� �������� recipeOptions ���� � ����-��������� �� �� �����
            if (_genRecipes && isMainMealLabel(m.label)) return;
            const mealTypeMap: Record<string, 'breakfast'|'lunch'|'snack'|'dinner'|'preworkout'|'postworkout'|'presleep'|'snack2'> = {
              '�������': 'breakfast', '����': 'lunch', '����': 'dinner', '�������': 'snack', '������ �������': 'snack',
              '�������': 'snack', '��������': 'preworkout', '����-����': 'postworkout', '����� ����': 'presleep',
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
          // A1: ������ ������������ ��� � ������ ������� planner-recipe-mode
          const _asm = assembleRecipeDay({
            meals: meals as any,
            pool: _filteredRecipes,
            targets: { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG },
            excludedIds,
            allergenTags: selectedAllergenTags(allergens || [], dietPrefs || []),
            // P1-04: ����������� ������� (������� __recipe__/__user_recipe__ � he_excluded_foods).
            excludedRecipeNames: (() => {
              const _s = new Set<string>();
              for (const id of excludedFoods || []) {
                if (id.startsWith('__recipe__')) _s.add(id.replace(/^__recipe__/, ''));
                else if (id.startsWith('__user_recipe__')) _s.add(id.replace(/^__user_recipe__/, ''));
              }
              return _s.size > 0 ? _s : undefined;
            })(),
            cookProfile: _cookProf ?? undefined,
            maxPrepTimeMin: _recipeBudget,
             isVegetarian: dietPrefs.includes('vegetarian'),
             categoryPref: { preferred: [], excluded: excludedCategories || [] },
             preferredRecipeNames: favoriteRecipes.size > 0 ? favoriteRecipes : undefined,
            usedNamesAcrossDays: _usedRecipeNames,
            goal: goal === 'cutting' || goal === 'fat_loss' ? 'cut' : goal === 'maintenance' ? 'maintenance' : 'mass',
            athleteWeightKg: weight,
            // C2/C5 (���� C): peri-������� ������ � ����-����; ���������� ������� �� seed ���.
            trainDay: isTrainDay(offset),
            seed: planRandomSalt + offset,
            // P1-5/P1-6: ��������� ������������ � ����� HV � ������-����.
            varietyStrictness,
            hvStyle,
            // P1-7: ��������� ���������� ������� (�� ledger-������, �� �� ����).
            weekIndex: Math.floor(offset / 7),
            // v3 portable: ���� ������� ������������ ���� � ������� ����.
            portableMode: input.portableMode,
            isWorkDay: input.isWorkDay,
            workStartMin: input.workStartMin,
            workEndMin: input.workEndMin,
          });
          meals.splice(0, meals.length, ...(_asm.meals as any[]));
          if (_asm.notes.length > 0) v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._asm.notes];
        }
        // ����-����� (4�): ������������� DIAAS-������ � ������������ ����� � �����
        // �������� ���������� ������ (�����������������), �� ���������� �����.
        try {
          const _diaasRepair = repairDiaasWeakLinks(meals as any, excludedIds);
          if (_diaasRepair.notes.length > 0) {
            meals.splice(0, meals.length, ...(_diaasRepair.meals as any[]));
            v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._diaasRepair.notes];
          }
        } catch {}
        // ���� 6: ������ ���� �� ���� (??) � ����-������ ��������������� � �/�/� �����.
        // ���������: ���� �� ������� �� �5% �� ���� (applyMealTargetOverrides � dayTargets).
        try {
          const _ovRaw = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
          if (Array.isArray(_ovRaw) && _ovRaw.length > 0) {
            const _ov = _ovRaw.filter((o: any) => o && typeof o.label === 'string');
            const _applied = applyMealTargetOverrides(meals as any, _ov as any, { kcal: input.goalKcal, p: input.goalProteinG, f: input.goalFatG, c: input.goalCarbsG });
            meals.splice(0, meals.length, ...(_applied.meals as any[]));
            if (_applied.notes.length > 0) v2.notes = [...(Array.isArray(v2.notes) ? v2.notes : []), ..._applied.notes];
          }
        } catch {}
        // ?? ����� ��� ��������: ����� ��� ��������������� �� ����������� ������
        // (����� ������ �������� ������ � ���������), � �� �� V2-�������.
        const _finalDayTotals = _genRecipes ? sumDayTotals(meals as any) : null;
        const dayKcalForPct = Math.max(1, _finalDayTotals ? _finalDayTotals.kcal : v2.totals.kcal);
        const mealTimesPro = meals.map((m: { time: string; label: string; totals: { kcal: number } }) => ({ time: m.time, label: m.label, pct: Math.round((m.totals.kcal / dayKcalForPct) * 100) }));
        // FIX allergens-restrictions: ����-������������� �������� ���������� � pro-����
        // (������ ���� ������ � legacy; � ���������� � excludedIds ����������� ����� �
        // ������ ���� ������������ ������� ������� ������� �� �����������).
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
        // D (���� D): ������ ������ ���� ��������� 2 ���� � ���� ������ ������ �� ��������� �������.
        varietyLedgerRef.current.recent = hardWindow.slice();
        // P1-3: ��������� ��� > ��������� ledger (����� ����� ?2 ���� ������,
        // ���� weekStapleFamilies � ������). P1-1/P1-4: ���� ������ �����������
        // (���������� ������ � recents/fresh-���� ����� ����� �������������).
        // FIX ������� (������ Sep 09): ��� weekFamilies � ������ � ������������
        // ������� � 1 ��� �� offset (� week-���� ���� 0 �������� ������ � d1 +
        // week-���� � � ��� ��������� ����� ������ ?2 > ��� �������� � 1-�� ���);
        // ��������� ��������� ��� �� ����� (����� 2-� ����������� ��� ������
        // ����������� ������� > ������ ����� ������� ����).
        try {
          const _dayFams = Array.from(new Set(_dayFoodIds.map((id: string) => stapleFamilyOf(id)).filter(Boolean) as string[]));
          if (days >= 3 && !_pushedFamOffsets.has(offset)) {
            _pushedFamOffsets.add(offset);
            varietyLedgerRef.current.weekFamilies = [...varietyLedgerRef.current.weekFamilies, _dayFams].slice(-LEDGER_WEEK_FAMILIES_CAP);
          }
          saveVarietyLedger({
            foods: Array.from(varietyLedgerRef.current.foods),
            recipes: Array.from(varietyLedgerRef.current.recipes),
            recent: varietyLedgerRef.current.recent,
            weekFamilies: varietyLedgerRef.current.weekFamilies,
          });
        } catch {}
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
          dietDiversity: { uniqueFoods: v2.diversity.uniqueFoods, totalPortions: 0, categories: v2.diversity.categories, score: Math.min(10, v2.diversity.uniqueFoods), note: `${v2.diversity.uniqueFoods} ���������� ���������` },
          timingScores: [], intraWorkout: null, mpsSummary: v2.mpsSummary, proNotes: v2.notes,
          microSummary: v2.microSummary,
          diaryCompensation: _diaryActive ? diaryComp : undefined,
          isRefeedDay,
          refeedNote: isRefeedDay ? '?? Refeed-����: �������� ?2.2 (�������������� ���������/�������), ���� �������, ����� �������. ��������������� ��������� �� �����.' : undefined,
          // ���� 1: ����� 2+1 � ������� ������ �� ������ ������� ������������.
          periodizationWeekNote: _perio.weekNote,
          heavyDayNote: _isHeavyDay ? '??? ���� ������ ���/������: �������� +25%, ���� +5% (�������� � ������).' : undefined,
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

      // FIX �������: ���� weekFamilies � ������ ������� ������������ ���������
      // (������� � buildOneDay; ����� ����� = ����� ������ ���������� � ������� ����,
      // ���� �� ������� ����������� �� �����������).
      varietyLedgerRef.current.weekFamilies = [];
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
        // FIX train-bind: ����� ������� offset �� weekIndex*7 � ��������� ������ (eod/pattern)
        // ������������ ����� ������� ������ (������ ������ �����-week ����������� �������,
        // ����� ��� ���������� ������ �� ����� ������).
        const _weekBase = weekIndex !== undefined ? weekIndex * 7 : 0;
        const _weekAcc: any[] = [];
        // FIX �������: ����� ������ ������ � ������ ���� weekFamilies (��� �� �������
        // �� ������� ������/������� �����������).
        varietyLedgerRef.current.weekFamilies = [];
        for (let _i = 0; _i < 7; _i++) {
          await maybeYield();
          _weekAcc.push(buildOneDay(_weekBase + _i));
        }
        weekDays = _weekAcc;
        weekData = { days: weekDays, totals: { kcal: weekDays.reduce((s: any,d: any) => s + (d?.totals?.kcal || 0), 0), p: weekDays.reduce((s: any,d: any) => s + (d?.totals?.p || 0), 0), f: weekDays.reduce((s: any,d: any) => s + (d?.totals?.f || 0), 0), c: weekDays.reduce((s: any,d: any) => s + (d?.totals?.c || 0), 0) }};
        if (weekIndex !== undefined) { setMonthPlan(prev => { const next = [...prev]; next[weekIndex] = weekData; return next; }); }
        else setWeekPlan(weekData);
      }
      // Shopping list � use already-generated plan data (not regenerate!)
      // F: ������ ��������� (� �.�. ����� ������ ������ ���������) �������� � planner-recipe-mode
      let allDayPlans: any[];
      if (days >= 7 && weekDays.length > 0) { allDayPlans = weekDays; }
      else if (days >= 3 && d2 && d3) { allDayPlans = [d1, d2, d3]; }
      else { allDayPlans = [d1]; }
      const shoppingArr = buildShoppingFromPlans(allDayPlans);
      setShoppingList(shoppingArr);
      // Water
      const safeInjections = Array.isArray(injections) ? injections : [];
      const hasPharma = safeInjections.length > 0 || (courseEntries?.length || 0) > 0;
      const aasCount = safeInjections.filter(i => i.type === '���').length;
      const pharmaHeavy = aasCount + safeInjections.filter(i => i.type === '�������').length + safeInjections.filter(i => i.type === '��').length;
      const baseWaterMl = weight * Math.min(45, 40 + pharmaHeavy * 1.5);
      const trainBonusL = [0, 1, 2, 3, 4, 5, 6].some(d => isTrainDay(d)) ? 0.5 : 0.2;
      const fiberBonusL = 0.1;
      const pharmaBonusL = hasPharma ? 0.5 : 0;
      const totalWaterL = Math.max(1.5, Math.round((baseWaterMl / 1000 + trainBonusL + fiberBonusL + pharmaBonusL) * 10) / 10);
      setWaterCalc({ baseWater: Math.round(baseWaterMl / 10) / 10, pharmaBaseMl: 40, trainBonus: trainBonusL, fiberFactor: fiberBonusL, pharmaBonus: pharmaBonusL, total: totalWaterL, hasPharma, electrolytes: { sodiumMg: 3500, potassiumMg: 3500, magnesiumMg: 400, note: '��������' } });
      setGenerated(true);
      try { setPlanTab('plan'); } catch {}
       try { generateRecommendations(); } catch (e: any) { try { console.warn('[Planner] recommendations failed:', e); } catch {} }
       // P2-audit fix: guard scrollIntoView (jsdom/������ �������� ��� API � uncaught TypeError).
       setTimeout(() => { try { if (resultsRef.current && typeof resultsRef.current.scrollIntoView === 'function') resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 100);
       // P5-audit fix: planBusy ����������� ������ � ������������ ���� � � pro-���� �? ����������� �������� ��������.
       try { setPlanBusy(false); } catch {}
       return; // Bug-2 fix: Pro ������� � �� ������������� � ������������ ���� (����� classic ��������� Pro-����, � ���� ������ ����� ������������ ���������).
      } catch (v2Err: any) {
        // v6: classic ����� � ������� ������ �� ������������, � ������ � ����������.
        const errMsg = (v2Err && (v2Err.message || String(v2Err))) || 'Unknown error';
        try { console.warn('[IndividualPlan] V2 engine failed:', errMsg, v2Err); } catch {}
        try { setErrorMsg('�� ������� ������� ����: ' + errMsg + ' ���������� ��������� ����������/�������.'); } catch {}
        try { setDayPlan(null); setThreeDayPlan(null); setWeekPlan(null); } catch {}
        try { setPlanBusy(false); } catch {}
        return;
      }
    }
    // v6: classic-������ ����� (buildDay ~700 �����). simple/minimal � ������� pro.
    // classic fully removed (v6)

    } catch (e: any) {
      const message = e?.message || String(e) || '������ ��������� �����. ��������� �������� ������.';
      console.error('[PlanGen] Error:', e);
      try { localStorage.setItem('he_planner_last_error', JSON.stringify({ message, at: new Date().toISOString() })); } catch {}
      setErrorMsg(message);
    }
    if (isAsync) setPlanBusy(false);
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // �����-1 (god-component ��������): ����-�����/����-�����/������������ ��������
  // � ���-��� (planner-special-meal-state.ts). ���������� �� �� ����� � � PlanCtx ����.
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
    isTrainDay, allergens, dietPrefs, excludedFoods, excludedCategories, plannerModeRef, goal, phase, weight,
    effectiveKcal, effectiveP, effectiveF, effectiveC, cravingDays, lazyDayDays,
    injections, linkToTraining, trainStart, trainEnd, sex, bodyFatPct, trainType,
    v2Phase, v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {},
    v2Labs: v2Labs && typeof v2Labs === 'object' ? v2Labs : {},
    histamineSensitive, generated, planDays, dayPlan, threeDayPlan, weekPlan, carbPeriodization,
  });

  // E7: ������� ����� ����� (������ window.prompt)
  // FIX train-bind: ������������� ��� ��� ����������� 7-������� ������ � ����� � �������
  // (generateFullNutritionReport), ������� ������� � ����������.
  const _trainDaysArr = Array.from({ length: 7 }, (_, i) => isTrainDay(i));

  const saveCurrentPlan = () => {
    // E7: prompt() > ������� (��������� UX, �������� prompt ������������ � Telegram WebApp)
    setSavePlanPrompt({ open: true, value: `${new Date().toLocaleDateString('ru-RU')} � ${Math.round(dayPlan?.totals?.kcal || 0)} ����` });
  };
  const confirmSavePlan = () => {
    const name = (savePlanPrompt?.value || '').trim() || `���� ${new Date().toLocaleDateString('ru-RU')}`;
    setSavePlanPrompt(null);
    const plan: SavedPlan = { id: Date.now(), date: localIsoDate(new Date()), name, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc };
    const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10);
    setSavedPlans(updated);
    // P1-fix: ���������� ������ ������������ ��� ������� ���������� (������ ������ console.warn)
    if (!safeWriteJSON('he_saved_nutrition_plans', updated)) {
      try { console.warn('[Planner] saved plans not saved (quota?)'); } catch {}
      setErrorMsg('?? �� ������� ��������� ����: �������� ����� localStorage. ������� ������ ����� ��� ������.');
    } else {
      setErrorMsg(null);
      if (typeof (window as any).showToast === 'function') (window as any).showToast(`?? ���� �${name}� ��������`, 'success');
    }
  };

  const autoCorrectPlan = () => {
    // B6 (���� B): ������������� ����� ������ ��������� correctDayToTargets.
    // ����: ������� ratio-�������� ������ �������� (������� max(0,�)=0 ����� ��� �����
    // ?0.3), ������ ��������������� kcal=4�+9�+4�, �� �������� ��� 3/7-������� ������.
    // ������: ��������� ������ (���� ������, ���� �������, Atwater), ���� � ����, ����
    // ���������� ������ ���������� ��� 3/7-�������� ����� � �������.
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
    // B6: ��������������� � ������ ��������� ���� 3/7-�������� ����� (���� �����).
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
    // ���� ������� �� ����������� ������ (������� ���������� ������ ������� � ������).
    try {
      const allPlans: any[] = [];
      if (correctedDay) allPlans.push(correctedDay);
      if (planDays === 3 && threeDayPlan?.days) allPlans.push(...threeDayPlan.days);
      if (planDays >= 7 && weekPlan?.days) allPlans.push(...weekPlan.days);
      if (allPlans.length > 0) setShoppingList(buildShoppingFromPlans(allPlans));
    } catch {}
    try { if (typeof (window as any).showToast === 'function') (window as any).showToast('?? ������ �������������� � ����� ����', 'success'); } catch {}
  };

  const [mealPrepPlan, setMealPrepPlan] = useState<{ steps: MealPrepStep[]; totalTime: number; containers: number } | null>(null);
  const [mealPrepDays, setMealPrepDays] = useState<1 | 3 | 7>(1);

  const generateMealPrep = () => {
    // ?? ����� ��� ��������: ���� � ����� ���� ��������� ������� � �������� ��������
    // ������� �������� �� ���������� ���� �������� (� �� �� generic-��� mealprep).
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

  /** A4: ����� ���������� �������� ����������� �������� ������� �� ���������� ������. */
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

  // G2: ������ ��������� ����������� �������� (�������/�������/������������) �
  // ����� ������ ����� (������/������/��������/�������/�����/�����) �������� ��� ������.
  // ����� setShoppingList-������ �������� ����������� ���� (�� �� ������ ��������).
  usePlannerDerivedSync(
    { planDays, dayPlan, threeDayPlan, weekPlan, selectedDayIndex, weekEditDay, mealPrepDays, generated },
    {
      setShoppingList,
      refreshRecipeCookingCardIfActive,
      recipeCookingActive: () => recipeCookingActiveRef.current,
      setMealPrepPlan: (v: any) => setMealPrepPlan(v),
      getMealPrepPlan: () => mealPrepPlan,
      generateRecommendations,
    },
  );

  // FatSecret-�������: 1-���� � ������� � ���� ������� ���� (1 ���� / ��������� ���� 3/7) � ����� � nutrition_diary_v2
  // ��� planDays===7/3 ��������� ��� ������/3 ��� �� ���������������� ���� (FatSecret-������: ��������� ���� �����)
  const addPlanToDiary = useCallback((dateISO?: string): boolean => {
    try {
      // E7: ��������� ���� (UTC-����� ������ �� ������ ������� � UTC+3..+12)
      const _now = new Date();
      const baseDate = dateISO || `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
      const data = readDiaryV2();
      const addDay = (src: any, dateStr: string) => {
        if (!src?.meals || !Array.isArray(src.meals) || src.meals.length === 0) return 0;
        if (!data[dateStr]) data[dateStr] = { meals: {} };
        let added = 0;
        src.meals.forEach((m: any) => {
          const label = m.label || '���� ����';
          if (!data[dateStr].meals[label]) data[dateStr].meals[label] = [];
          (Array.isArray(m.items) ? m.items : []).forEach((it: any) => {
          (data[dateStr].meals[label] as any).push({
            name: it.name, qty: `${it.amount || 100} �` as any, kcal: Math.round(it.kcal || 0),
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
          const iso = localIsoDate(dt);
          totalAdded += addDay(d, iso);
        });
      } else if (planDays === 3 && threeDayPlan?.days) {
        const base = new Date(baseDate);
        threeDayPlan.days.forEach((d: any, i: number) => {
          const dt = new Date(base); dt.setDate(base.getDate() + i);
          const iso = localIsoDate(dt);
          totalAdded += addDay(d, iso);
        });
      } else {
        let source: any = null;
        if (planDays === 1) source = dayPlan;
        else if (planDays === 3) source = threeDayPlan?.days?.[selectedDayIndex] || dayPlan;
        else if (planDays === 7) source = weekPlan?.days?.[selectedDayIndex] || dayPlan;
        else source = dayPlan;
        if (!source?.meals || !Array.isArray(source.meals) || source.meals.length === 0) {
          setErrorMsg('��� ���������������� ����� ��� ���������� � �������');
          return false;
        }
        totalAdded += addDay(source, baseDate);
      }
      if (totalAdded === 0) { setErrorMsg('��� ���������������� ����� ��� ���������� � �������'); return false; }
      writeDiaryV2(data);
      setErrorMsg(null);
      return true;
    } catch (e: any) {
      setErrorMsg('�� ������� �������� � �������: ' + (e?.message || String(e)));
      return false;
    }
  }, [dayPlan, planDays, selectedDayIndex, threeDayPlan, weekPlan]);

  // �����-1 (god-component ��������): ��������� ������� + ���������� �������� � ���-���
  // (planner-report-state.ts). ���������� �� �� ����� � �������������� � PlanCtx ����.
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
    userTDEE: calcTargets.tdee > 0 ? calcTargets.tdee : profileTargets.tdee,
    sex, goal,
    isTrainingDay: (() => { try { return linkToTraining && isTrainDay(selectedDayIndex); } catch { return false; } })(),
    linkToTraining, trainStart, carbPeriodization,
  });

  // P1-7: renderMealList ������� � MealListRender.tsx (267 ����� > 1 ������)
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
    monthPlanMode, setMonthPlanMode, monthPlan, setMonthPlan, loadMonthWeekIntoPlan, selectedWeek, setSelectedWeek,
    goal, setGoal, phase, setPhase, autoGoal,
    goalUserSet, setGoalUserSet,
    injections, setInjections,
    injName, setInjName, injTime, setInjTime, injDose, setInjDose,
    injUnit, setInjUnit, injType, setInjType, injEster, setInjEster,
    trainStart, setTrainStart, trainEnd, setTrainEnd, linkToTraining, setLinkToTraining,
    trainScheduleType, setTrainScheduleType, trainPattern, setTrainPattern, isTrainDay,
    injectDrugTypes, calcTargets, profileTargets,
    effectiveKcal, effectiveP, effectiveF, effectiveC, dayTargetsBreakdown, carbCapClipped, carbCapGPerKg, rawCarbsForCap: _rawCForCap,
    kbjuMode, setKbjuMode, switchKbjuMode,
    manualKcal, setManualKcal, manualP, setManualP, manualF, setManualF, manualC, setManualC,
    resultsRef, budget, setBudget, proteinPreset, setProteinPreset,
    variety, setVariety, diaryAdaptation, setDiaryAdaptation, varietyStrictness, setVarietyStrictness, varietyLevel, setVarietyLevel, hvStyle, setHvStyle, carbCapOverride, setCarbCapOverride, bbCategory, setBBCategory, peakWeekEnabled, setPeakWeekEnabled, peakWeekShowDay, setPeakWeekShowDay, bbPrepConfig, setBBPrepConfig, applyBBPeakToPlan, applyCombatNutrition, lifeStage, setLifeStage, wakeTime, setWakeTime, bedTime, setBedTime,
    lunchTime, setLunchTime, dinnerTime, setDinnerTime, mealsCount,
    workFood, setWorkFood, allergens, setAllergens, healthIssues, setHealthIssues,
    morningTrainLoad, setMorningTrainLoad,
    eveningLowCarb, setEveningLowCarb, nightCarbs: nightCarbs, setNightCarbs: setNightCarbsPersist, planType, setPlanType,
    addMilkToBreakfast, setAddMilkToBreakfast, breakfastStyle, setBreakfastStyle, breakfastTemplate, setBreakfastTemplate,
    preferredFoods, setPreferredFoods, preferredByMeal, setPreferredByMeal, intolerances, setIntolerances, tasteProfile, setTasteProfile, excludedCategories, setExcludedCategories, excludedFoods, setExcludedFoods,
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
    recipePickerMeal, setRecipePickerMeal,
    dayPlanNotes, setDayPlanNotes, draggedItem, setDraggedItem, dropTarget, setDropTarget,
    undoStack, setUndoStack, userRecipes, setUserRecipes,
    showRecipeCreator, setShowRecipeCreator,
    showAddDrug, setShowAddDrug, showDrugTypePicker, setShowDrugTypePicker,
    takenSupplements, setTakenSupplements, showSuppPicker, setShowSuppPicker,
    suppSearch, setSuppSearch, newRecipe, setNewRecipe,
    saveUndo, moveFoodItem, findSimilarFoods, replaceFoodItem,
    quickAddMealIdx, setQuickAddMealIdx, quickAddSearch, setQuickAddSearch,
    updateItemAmount, removeFoodItem, replaceMealWithRecipe, addSecondRecipeToMeal, secondRecipeConflict, setSecondRecipeConflict, addSecondRecipeWithSnackRoom, rescaleSecondRecipeInMeal, removeSecondRecipeFromMeal, generatePlan,
    generationMode, setGenerationMode,
    weightMode, setWeightMode,
    favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe,
    pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced,
    applyMealTargetNow,
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
    planTab, setPlanTab,
    labs,
  }), [addPlanToDiary, weight, height, age, sex, dailySteps, cookTimeMin, combatNutrition, _rawCForCap, applyCombatNutrition, cookingSkill, cookingFrequency, batchCooking, cravingMode, cravingDays, lazyDayMode, lazyDayDays, surplusPct, trainType, trainIntensity, householdActivity, bodyFatPct, sleepHours, sleepQuality, stressLevel, cyclePhase, weightAdaptMode, weightLogWeek, expectedLossKgWeek, showWeightAdaptModal, weightLogEntries, weightLogPeriod, metabolicAdaptEnabled, metabolicAdaptPct, manualGPerKg, monthPlanMode, monthPlan, selectedWeek, goal, phase, goalUserSet, injections, injName, injTime, injDose, injUnit, injType, injEster, trainStart, trainEnd, linkToTraining, trainScheduleType, trainPattern, manualKcal, manualP, manualF, manualC, kbjuMode, budget, proteinPreset, variety, varietyLevel, wakeTime, bedTime, lunchTime, dinnerTime, workFood, morningTrainLoad, mealsCount, allergens, healthIssues, eveningLowCarb, nightCarbs, addMilkToBreakfast, breakfastStyle, breakfastTemplate, planType, preferredFoods, quickAddMealIdx, quickAddSearch, customNotes, excludedFoods, dietPrefs, allergenExcludedCount, planTargets, carbPeriodization, heavyTrainDay, workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType, trainingDays, generated, planDays, selectedDayIndex, planView, dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc, savedPlans, lockedFoodIds, expandedSavedId, editItem, editAmount, replacingItem, recipePickerMeal, dayPlanNotes, draggedItem, dropTarget, undoStack, userRecipes, showRecipeCreator, showAddDrug, showDrugTypePicker, takenSupplements, showSuppPicker, suppSearch, newRecipe, v2Phase, v2Labs, v2Pharma, histamineSensitive, errorMsg, planTab, specialMealMode, specialMealGoal, specialMealProteinG, specialMealFatG, specialMealCarbsG, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget, cheatMealPlan, carbloadPlan, butchPlan, cravingPlan, lazyDayPlan, recommendations, mealPrepPlan, mealPrepDays, activeReports, allergenReport, nutrientReport, qualityReport, riskReport, drugCompatReport, nutritionReport, profile, s, courseEntries, labAnalysis, labs, bbPrepConfig, autoGoal, injectDrugTypes, calcTargets, profileTargets, effectiveKcal, effectiveP, effectiveF, effectiveC, allergenExcludedCount]);

  const renderMealList = useRenderMealList({ ...ctx, plannerMode });
  const finalCtx = useMemo<PlanCtx>(() => ({ ...ctx, plannerMode, setPlannerMode, generationMode, setGenerationMode, weightMode, setWeightMode, favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced, updateMealTime, duplicateMeal, renderMealList, annualPhase }), [ctx, plannerMode, generationMode, weightMode, favoriteRecipes, pickRecipeOption, moreRecipeOptions, refreshRecipeSuggestions, removeMealRebalanced, updateMealTime, duplicateMeal, renderMealList, annualPhase]);
  return (
    <PlanContext.Provider value={finalCtx}>
      {children}
      {savePlanPrompt?.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', padding: 16 }} onClick={() => setSavePlanPrompt(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, padding: 18, borderRadius: 16, background: 'linear-gradient(135deg,#1a1c26,#18181b)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>?? ��������� ����</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>�������� �����</div>
            <input
              value={savePlanPrompt.value}
              onChange={e => setSavePlanPrompt({ open: true, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') confirmSavePlan(); }}
              autoFocus
              maxLength={60}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setSavePlanPrompt(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer' }}>������</button>
              <button onClick={confirmSavePlan} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>���������</button>
            </div>
          </div>
        </div>
      )}
    </PlanContext.Provider>
  );
};
