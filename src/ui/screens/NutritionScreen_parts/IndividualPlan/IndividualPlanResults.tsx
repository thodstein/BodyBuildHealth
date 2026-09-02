import React, { useState, useRef } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import { generateNutritionReport } from "../../../../engines/nutrition-report.engine";
import { ALLERGEN_LIST, HEALTH_ISSUES } from "./types";
import { resolveAllergenFoodIds } from "./planner-restrictions";
import type { DrugInjection } from "./types";
import { GlassCard, greenBtn, reportPillStyle } from "./ui";
import { usePlanCtx } from "./IndividualPlanContext";
import { carbPeriodizationLabel, expectedWeekKcal } from "./planner-carb-periodization";
import { computeDayScoreTrend, loadDayScores, clearDayScores } from "../../../../engines/day-score-trend";
import { DailyDietDashboard } from "../DailyDietDashboard";
import { NutritionQualityCard } from '../../../components/NutritionQualityCard';
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type MealTiming, type DailyDietReport, type MealScoreV2 } from '../../../../engines/product-usefulness-v2.engine';
import { MealQuickControls } from "./MealQuickControls";
import { readDiaryV2 } from "../diary-storage-v2";
import { buildDayReportPrintHtml, printDayReport, buildMealTimelinePrintHtml, printMealTimeline, buildRecipePlanPrintHtml, buildCoachExportHtml, downloadCoachExport } from "./planner-day-print";
import { buildDayBriefing } from "./planner-briefing";

const getDiaryEntriesForDate = (date: string): any[] => {
  try {
    const diary = readDiaryV2();
    if (Array.isArray(diary)) return diary.filter((d: any) => (d.date || d.createdAt || '').startsWith(date));
    const meals = diary?.[date]?.meals || {};
    return Object.values(meals).flatMap((meal: any) => Array.isArray(meal) ? meal : []);
  } catch {
    return [];
  }
};

const getDiaryLoggedDayCount = (): number => {
  try {
    const diary = readDiaryV2();
    if (!Array.isArray(diary)) return Object.keys(diary).length;
    return new Set(diary.map((d: any) => (d.date || d.createdAt || '').slice(0, 10)).filter(Boolean)).size;
  } catch {
    return 0;
  }
};

export const IndividualPlanResults: React.FC = () => {
  const {
    generatePlan, planDays, setPlanDays, selectedDayIndex, setSelectedDayIndex,
    weekEditDay, openWeekDayForEdit, switchPlanDays,
    DAY_LABELS, trainingDays, planView, setPlanView, weekPlan, setWeekPlan,
    monthPlanMode, setMonthPlanMode, monthPlan, setMonthPlan,
    selectedWeek, setSelectedWeek,
    generated, setGenerated, dayPlan, threeDayPlan, resultsRef, planBusy,
    mealsCount, setMealsCount,
    renderMealList, effectiveKcal, effectiveP, effectiveF, effectiveC,
    dayPlanNotes, setDayPlanNotes,
    autoCorrectPlan, allergens, allergenExcludedCount, excludedFoods, healthIssues,
    carbPeriodization, waterCalc, setWaterCalc, heavyTrainDay,
    showRecipeCreator, setShowRecipeCreator, newRecipe, setNewRecipe,
    userRecipes, setUserRecipes,
    shoppingList, setShoppingList, injections,
    recipePickerMeal, setRecipePickerMeal,
    replaceMealWithRecipe, addSecondRecipeToMeal, undoStack, setUndoStack, undoLast,
    saveCurrentPlan, savedPlans, setSavedPlans, expandedSavedId, setExpandedSavedId,
    loadSavedPlan, weight, budget, age, sex, bodyFatPct, trainType,
    generateCheatMeal, cheatMealPlan, setCheatMealPlan,
    generateCarbload, carbloadPlan, setCarbloadPlan,
    generateBUTCH, butchPlan, setButchPlan,
    generateCravingPlan, cravingPlan, setCravingPlan,
    generateLazyDayPlan, lazyDayPlan, setLazyDayPlan,
    generateRecommendations, recommendations, setRecommendations,
    specialMealMode, setSpecialMealMode, specialMealProteinG, specialMealFatG, specialMealCarbsG,
    specialMealGoal, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget,
    cravingMode, setCravingMode, lazyDayMode, setLazyDayMode, cravingDays, lazyDayDays,
    generateMealPrep, mealPrepPlan, mealPrepDays, setMealPrepDays,
    saveUndo,
    generateAllergenReport, allergenReport,
    generateNutrientReport, nutrientReport,
    generateQualityReport, qualityReport,
    generateRiskReport, riskReport,
    generateDrugCompatReport, drugCompatReport,
    generateFullNutritionReport, nutritionReport, activeReports,
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    removeFoodItem, replaceFoodItem, findSimilarFoods, updateItemAmount,
    setDayPlan, setThreeDayPlan, planTargets, planType, variety,
    linkToTraining, trainStart,
    workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType,
    v2Phase, v2Pharma, v2Labs, histamineSensitive,
    plannerMode,
    annualPhase,
    setErrorMsg,
    setPlanTab,
    addPlanToDiary,
  } = usePlanCtx();

  const [showCalcPopup, setShowCalcPopup] = useState(false);
  // E7: импорт плана — модалка (замена window.prompt)
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const _monthRunningRef = useRef(false); // FIX button-audit: guard двойного клика «План на месяц»
  const [calcTab, setCalcTab] = useState<'day' | 'week'>('day');
  const [calcSelections, setCalcSelections] = useState<Set<string>>(new Set());
  const [calcResults, setCalcResults] = useState<{ id: string; name: string; score: MealScoreV2; diaas: { diaas: number; limitingAA: string } }[] | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<any | null>(null);
  const [calcDailyReport, setCalcDailyReport] = useState<DailyDietReport | null>(null);
  // 🟠8 — Checked shopping items state (must be at top level — Rules of Hooks)
  const [checked, setChecked] = useState<Set<string>>(() => { try { const v = JSON.parse(localStorage.getItem('he_shopping_checked') || '[]'); return new Set(Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []); } catch { return new Set<string>(); } });
  // E7: чекбоксы закупок сбрасываются при новом плане (раньше галочки «переезжали» между
  // разными списками — «молоко уже отмечено» в чужом рационе).
  const _planKeyRef = useRef<string>('');
  const _planKey = `${dayPlan ? JSON.stringify(dayPlan.totals || {}) + (dayPlan.meals?.length || 0) : ''}|${weekPlan ? (weekPlan.days?.length || 0) : ''}|${threeDayPlan ? (threeDayPlan.days?.length || 0) : ''}`;
  React.useEffect(() => {
    if (_planKey && _planKey !== _planKeyRef.current) {
      if (_planKeyRef.current !== '') setChecked(new Set());
      _planKeyRef.current = _planKey;
    }
  }, [_planKey]);

  const [showCorrectPopup, setShowCorrectPopup] = useState(false);
  const [correctIssues, setCorrectIssues] = useState<{ mealIdx: number; mealName: string; issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] }[] | null>(null);

  const analyzePlanIssues = () => {
    // FIX button-audit: активный план по view + клэмп индекса (иначе после недельного вида
    // threeDayPlan.days[3..6] = undefined → попап зависал на «Анализ рациона...»)
    const _di = Math.max(0, Math.min(selectedDayIndex, planDays === 3 ? 2 : planDays === 7 ? 6 : 0));
    const activePlan = planDays === 1 ? dayPlan : planDays === 3 ? threeDayPlan?.days?.[_di] : weekPlan?.days?.[_di];
    if (!activePlan || !Array.isArray(activePlan.meals)) { setCorrectIssues([]); return; }
    if (plannerMode !== 'pro') { setCalcResults(null); setCalcDailyReport(null); return; }
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
    profile.histamineSensitive = histamineSensitive;
    profile.labs.hematocrit = v2Labs.hematocrit ? parseFloat(v2Labs.hematocrit) : undefined;
    profile.labs.ldl = v2Labs.ldl ? parseFloat(v2Labs.ldl) : undefined;
    profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
    profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
    profile.weightKg = weight || 80;
    profile.lbm = profile.weightKg * 0.85;

    const excludedSet = new Set(excludedFoods || []);
    // FIX button-audit: аллергены резолвятся в конкретные foodId (раньше сравнивались русские ID
    // аллергенов с food.id — никогда не совпадали, и предложения могли содержать аллергены)
    const allergenSet = resolveAllergenFoodIds(FOOD_DB, allergens || []);
    const healthIssueFoodIds = new Set<string>();
    (healthIssues || []).forEach((hi: string) => {
      const found = HEALTH_ISSUES.find(h => h.id === hi);
      if (found?.foodIds) found.foodIds.forEach(fid => healthIssueFoodIds.add(fid));
    });
    const isFoodBlocked = (foodId: string) => excludedSet.has(foodId) || healthIssueFoodIds.has(foodId) || allergenSet.has(foodId);

    const result: { mealIdx: number; mealName: string; issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] }[] = [];

    activePlan.meals.forEach((m: any, mi: number) => {
      const currentFoodIds = new Set((m.items || []).map((it: any) => it.id).filter(Boolean));
      const issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] = [];
      const products = (m.items || []).map((it: any) => {
        const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
        return { ...it, food };
      });
      const totalKcal = m.totals?.kcal || 0;
      const totalP = m.totals?.p || 0;
      const totalF = m.totals?.f || 0;
      const totalC = m.totals?.c || 0;

      // Low protein
      if (totalP < 25) {
        const highProteinFoods = FOOD_DB.filter(f => f.protein > 25 && f.category !== 'protein' && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `${f.protein}г белка/100г` }));
        if (highProteinFoods.length > 0) issues.push({ type: 'low_protein', text: `🥩 Мало белка (${totalP}г) — <25г за приём`, severity: 'high', suggestion: highProteinFoods });
      }
      // High fat
      if (totalF > 30) {
        const lowFatFoods = FOOD_DB.filter(f => f.fat < 5 && f.protein > 15 && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Жиры ${f.fat}г/100г, белок ${f.protein}г/100г` }));
        if (lowFatFoods.length > 0) issues.push({ type: 'high_fat', text: `🧈 Много жиров (${totalF}г) — >30г за приём`, severity: 'medium', suggestion: lowFatFoods });
      }
      // High carb
      if (totalC > 100 && profile.phase === 'EXTREME_CUT') {
        const lowCarbFoods = FOOD_DB.filter(f => f.carbs < 10 && f.protein > 15 && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Углеводы ${f.carbs}г/100г, белок ${f.protein}г/100г` }));
        if (lowCarbFoods.length > 0) issues.push({ type: 'high_carb', text: `🍚 Много углеводов (${totalC}г) на сушке`, severity: 'high', suggestion: lowCarbFoods });
      }
      // Missing mTOR trigger — per100 invariant: leucine_mg per100 via AA profile or 75*protein (научно 75-85, было 42 занижало на 44%)
      const totalLeucine = products.reduce((s: number, p: any) => {
        const leucineMg = p.food?.amino_acid_profile_100g?.leucine_mg ?? p.food?.micros?.Leucine;
        const fallbackLeucine = p.food?.protein ? Math.round(p.food.protein * 75) : 0;
        return s + (leucineMg ?? fallbackLeucine) * (p.amount || 100) / 100;
      }, 0);
      if (totalLeucine < 3000 && totalLeucine > 0) {
        const getLeucine = (f: any) => f.amino_acid_profile_100g?.leucine_mg ?? f.micros?.Leucine ?? (f.protein ? Math.round(f.protein * 75) : 0);
        const leucineFoods = FOOD_DB.filter(f => getLeucine(f) > 250 && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).sort((a, b) => getLeucine(b) - getLeucine(a)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Лейцин ${Math.round(getLeucine(f))}мг/100г` }));
        if (leucineFoods.length > 0) issues.push({ type: 'low_leucine', text: `🧬 Нет лейцинового триггера (${Math.round(totalLeucine)}мг)`, severity: 'high', suggestion: leucineFoods });
      }
      // Low fiber
      const totalFiber = products.reduce((s: number, p: any) => s + (p.food?.fiber || 0) * (p.amount || 100) / 100, 0);
      if (totalFiber < 3) {
        const fiberFoods = FOOD_DB.filter(f => f.fiber > 4 && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Клетчатка ${f.fiber}г/100г` }));
        if (fiberFoods.length > 0) issues.push({ type: 'low_fiber', text: `🌾 Мало клетчатки (${totalFiber.toFixed(0)}г)`, severity: 'medium', suggestion: fiberFoods });
      }
      // DIAAS per meal
      const v2Products = products.filter((p: any) => p.food).map((p: any) => ({ foodId: p.food.id, weightGrams: p.amount || 100 }));
      if (v2Products.length > 0) {
        const diaas = calcMealDIAAS(v2Products);
        if (diaas.diaas < 0.75 && diaas.diaas > 0) {
          const aaFoods = FOOD_DB.filter(f => f.protein > 15 && f.category === 'protein' && !currentFoodIds.has(f.id) && !isFoodBlocked(f.id)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Полноценный белок, ${f.protein}г/100г` }));
          if (aaFoods.length > 0) issues.push({ type: 'low_diaas', text: `💪 Низкий DIAAS (${diaas.diaas.toFixed(2)}) — лимит: ${diaas.limitingAA}`, severity: 'high', suggestion: aaFoods });
        }
      }

      if (issues.length > 0) result.push({ mealIdx: mi, mealName: m.label || `Приём ${mi + 1}`, issues });
    });

    setCorrectIssues(result);
  };

  const toggleCalcSelection = (id: string) => {
    const next = new Set(calcSelections);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCalcSelections(next);
  };

  const itemToProduct = (it: any) => {
    const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
    return { foodId: food?.id || it.name || 'unknown', weightGrams: it.amount || 100 };
  };

  const handleCalcUsefulness = () => {
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
    profile.labs.hdl = v2Labs.hdl ? parseFloat(v2Labs.hdl) : undefined;
    profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
    profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
    profile.labs.crp = v2Labs.crp ? parseFloat(v2Labs.crp) : undefined;
    profile.labs.estradiol = v2Labs.estradiol ? parseFloat(v2Labs.estradiol) : undefined;
    profile.labs.prolactin = v2Labs.prolactin ? parseFloat(v2Labs.prolactin) : undefined;
    profile.labs.testosterone = v2Labs.testosterone ? parseFloat(v2Labs.testosterone) : undefined;
    profile.labs.glucose_fasting = v2Labs.glucose ? parseFloat(v2Labs.glucose) : undefined;
    profile.labs.insulin_fasting = v2Labs.insulin ? parseFloat(v2Labs.insulin) : undefined;
    profile.weightKg = weight || 80;
    profile.lbm = profile.weightKg * (100 - profile.bodyFatPct) / 100;

    const allMeals: { timing?: MealTiming; products: { foodId: string; weightGrams: number }[] }[] = [];
    const results: { id: string; name: string; score: MealScoreV2; diaas: { diaas: number; limitingAA: string } }[] = [];

    if (dayPlan && Array.isArray(dayPlan.meals)) { // FIX button-audit: guard на meals=null
      calcSelections.forEach(id => {
        if (id.startsWith('meal_')) {
          const idx = parseInt(id.replace('meal_', ''));
          const meal = dayPlan.meals[idx];
          if (!meal) return;
          const products = (meal.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length === 0) return;
          const timing = (meal.timing || 'regular') as MealTiming;
          const score = calcMealScoreV2(products, profile, timing);
          const diaas = calcMealDIAAS(products);
          allMeals.push({ timing, products });
          results.push({ id, name: meal.label || `Приём ${idx + 1}`, score, diaas });
        }
        if (id === 'special_cheatmeal' && cheatMealPlan) {
          const products = (cheatMealPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'cheat_meal');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ timing: 'cheat_meal', products });
            results.push({ id, name: '🍔 Читмил', score, diaas });
          }
        }
        if (id === 'special_carbload' && carbloadPlan) {
          const products = (carbloadPlan.foods || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'carb_load');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ timing: 'carb_load', products });
            results.push({ id, name: '🍚 Углев. загрузка', score, diaas });
          }
        }
        if (id === 'special_lazy' && lazyDayPlan) {
          const products = (lazyDayPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'regular');
            const diaas = calcMealDIAAS(products);
            // P1-fix: добавлен timing для консистентности с другими special meals
            allMeals.push({ timing: 'regular', products });
            results.push({ id, name: '🛋 Ленивый день', score, diaas });
          }
        }
        if (id === 'special_craving' && cravingPlan) {
          const products = (cravingPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'regular');
            const diaas = calcMealDIAAS(products);
            // P1-fix: добавлен timing для консистентности
            allMeals.push({ timing: 'regular', products });
            results.push({ id, name: '🍬 Хочу сладкое', score, diaas });
          }
        }
      });
    }

  const dailyReport = allMeals.length > 0 ? analyzeDailyDiet(allMeals, profile) : null;
  setCalcResults(results);
  setCalcDailyReport(dailyReport);
};

// E7: импорт плана — модалка вместо prompt() + ВАЛИДАЦИЯ формы (раньше вставка мусора
// с полем meals давала кривой план без предупреждения).
const _validateImportedPlan = (p: any): boolean => {
  if (!p || typeof p !== 'object' || !Array.isArray(p.meals) || p.meals.length === 0) return false;
  return p.meals.every((m: any) => m && typeof m === 'object' && Array.isArray(m.items) && m.items.every((it: any) => it && typeof it === 'object' && typeof it.name === 'string' && (it.amount === undefined || typeof it.amount === 'number')));
};
const doImportPlan = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw);
    if (!_validateImportedPlan(parsed)) { setErrorMsg('Неверная структура плана: ожидаются meals[] с items[] (name/amount).'); return false; }
    setDayPlan(parsed);
    setGenerated(true);
    setPlanDays(1); // FIX button-audit: импорт всегда показывает 1-дневный план
    setErrorMsg(null);
    if (typeof (window as any).showToast === 'function') (window as any).showToast('📥 План импортирован', 'success');
    return true;
  } catch {
    setErrorMsg('Неверный формат. Скопируйте план через кнопку «Копировать».');
    return false;
  }
};


  // P0-3: Атомарная генерация месяца — явный async-цикл по 4 неделям с коротким yield для UI.
  // Раньше 5×setTimeout (120мс) расово перекрывали weekPlan — построенные недели терялись.
  // P1-fix: увеличен yield до 100мс (было 50мс) + skipUndo=true для генерации недели
  // (раньше 5×saveUndo заполняли undoStack cap=5, уничтожая историю отмен пользователя).
  const runMonthPlan = async () => {
    // FIX button-audit: защита от двойного клика (два конкурирующих цикла генерации)
    if (_monthRunningRef.current) return;
    _monthRunningRef.current = true;
    try {
      // P1-fix: один saveUndo до начала массовой генерации, а не 5 раз внутри
      saveUndo();
      setMonthPlanMode(true);
      setMonthPlan([]);
      for (let w = 0; w < 4; w++) {
        // короткий yield для UI-рендера между неделями (100мс), без расы перекрытия state.
        await new Promise<void>(r => setTimeout(() => r(), 100));
        // generatePlan стал async (неблокирующая генерация 3/7 дней) — ОБЯЗАТЕЛЬНО await:
        // иначе недели месяца генерируются конкурентно и расы на общих recentFoodIds/hardWindow
        // портят выбор продуктов и перекрывают weekPlan.
        try { await generatePlan(7, w, undefined, { skipUndo: true, async: true }); } catch (e: any) { try { console.warn('[Planner] month week', w, 'failed:', e); } catch {} }
      }
      await new Promise<void>(r => setTimeout(() => r(), 100));
      setSelectedWeek(0);
      // E4-fix: НЕЛЬЗЯ перегенерировать неделю 0 — monthPlan[0] уже сгенерирован в цикле выше
      // (повторный вызов с новой солью расходил отображаемую неделю и содержимое месяца).
      // Отображаем неделю 0 прямо из monthPlan.
      if (monthPlan[0]?.days?.length) setWeekPlan(monthPlan[0]);
    } finally {
      _monthRunningRef.current = false;
    }
  };

  return (
    <>
      <div ref={resultsRef as any} />
      {!generated && (
        <div style={{
          padding: '28px 18px 24px', textAlign: 'center', borderRadius: 20,
          background: 'linear-gradient(180deg, rgba(24,24,28,0.96) 0%, rgba(18,18,20,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{position:'absolute', top:-24, left:'50%', transform:'translateX(-50%)', width:220, height:120, background:'radial-gradient(220px 120px at 50% 100%, rgba(0,230,138,0.18), transparent 72%)', pointerEvents:'none'}} />
          <div style={{
            width:64, height:64, borderRadius:18, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center',
            background:'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.08))', border:'1px solid rgba(0,230,138,0.18)',
            boxShadow:'0 6px 20px rgba(0,230,138,0.14)', fontSize:30,
          }}>🥗</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 5, letterSpacing:'-0.3px' }}>План ещё не создан</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', marginBottom: 16, lineHeight: 1.5, maxWidth: 320, marginLeft:'auto', marginRight:'auto' }}>
            Задайте параметры во вкладке «Настройки» или сгенерируйте рацион в один клик — КБЖУ, время приёмов и закупки соберутся автоматически.
          </div>
          <button onClick={() => { setErrorMsg(null); generatePlan(1); }} style={{
            padding: '12px 22px', borderRadius: 999, cursor: 'pointer',
            fontSize: 13, fontWeight: 800, letterSpacing:'-0.2px',
            background: 'linear-gradient(135deg,#00e68a 0%, #00c8a0 48%, #00b894 100%)', border: '1px solid rgba(0,230,138,0.5)', color: '#0A0A0A',
            boxShadow: '0 6px 22px rgba(0,230,138,0.28), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}>✨ Создать план за 2 сек</button>
          <div style={{marginTop:10, fontSize:10, color:'rgba(255,255,255,0.32)'}}>Pro-движок · per100 · ±3% к цели</div>
        </div>
      )}
      {generated && (<>
        <MealQuickControls />
        {generated && dayPlan && Array.isArray(dayPlan.notes) && dayPlan.notes.some((n: string) => (n || '').includes('Перегрузка приёма')) && (
          <div role="alert" style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#fbbf24', lineHeight: 1.4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12 }}>⚠️</span>
            <span style={{ flex: 1, minWidth: 180 }}>Часть приёмов перегружена (каша/крупа упирается в лимит порции) — углеводы дня не добиваются.</span>
            <button onClick={() => { const next = Math.min(10, mealsCount + 1); setMealsCount(next); try { localStorage.setItem('he_planner_prefs', JSON.stringify({ ...(JSON.parse(localStorage.getItem('he_planner_prefs') || '{}')), mealsPerDay: next })); } catch {} generatePlan(1, undefined, selectedDayIndex, { overrides: { mealsCount: next } }); }} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#000', fontWeight: 700, fontSize: 9, cursor: 'pointer' }}>
              ➕ +1 приём ({mealsCount} → {Math.min(10, mealsCount + 1)}) и пересобрать
            </button>
          </div>
        )}
        <GlassCard title="Выбор дней" icon="📅" color="#00e68a">
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:999, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.14)', color:'rgba(255,255,255,0.68)', fontSize:10, margin:'0 auto 8px', fontWeight:600, textAlign:'center' }}>👆 Нажмите на день — откроется план на 1 день</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:10 }}>
            {DAY_LABELS.map((label, idx) => {
              const isTrain = trainingDays[idx];
              const isSelected = planDays === 1 && selectedDayIndex === idx;
              // Эпик E3: клик по дню = ПРОСМОТР существующего дня (из недели — без регенерации,
              // иначе правки недели уничтожались); генерируем только если дня ещё нет.
              const openDay = () => {
                setPlanDays(1); setSelectedDayIndex(idx);
                const weekDay = weekPlan?.days?.[idx];
                const threeDay = planDays === 3 ? threeDayPlan?.days?.[idx] : null;
                if (weekDay) { openWeekDayForEdit(idx); }
                else if (threeDay) {
                  try { setDayPlan(JSON.parse(JSON.stringify(threeDay))); } catch { setDayPlan(threeDay); }
                }
                else { generatePlan(1, undefined, idx); }
              };
              return (
                <button key={idx} onClick={openDay} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  padding:'9px 4px 8px', borderRadius:14, cursor:'pointer', minHeight: 56, position:'relative', overflow:'hidden',
                  background: isSelected ? 'linear-gradient(135deg,#00e68a 0%, #00c8a0 52%, #00b894 100%)' : isTrain ? 'linear-gradient(180deg, rgba(34,197,94,0.16), rgba(34,197,94,0.06))' : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                  border: isSelected ? '1px solid rgba(0,230,138,0.55)' : isTrain ? '1px solid rgba(34,197,94,0.22)' : '1px solid rgba(255,255,255,0.07)',
                  color: isSelected ? '#0A0A0A' : isTrain ? '#86efac' : 'rgba(255,255,255,0.72)',
                  fontWeight: isSelected ? 800 : isTrain ? 700 : 600,
                  fontSize:11, transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: isSelected ? '0 6px 18px rgba(0,230,138,0.30), inset 0 1px 0 rgba(255,255,255,0.22)' : isTrain ? '0 2px 10px rgba(34,197,94,0.10)' : '0 1px 6px rgba(0,0,0,0.18)',
                  transform: isSelected ? 'translateY(-1px)' : 'none',
                }}>
                  {isTrain && !isSelected && <span style={{position:'absolute', top:5, right:5, width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px rgba(34,197,94,0.6)'}} />}
                  {isSelected && <span style={{position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0) 100%)', opacity:0.45}} />}
                  <span style={{ fontSize:10, opacity: isSelected ? 0.9 : 0.66, fontWeight:700, letterSpacing:'0.2px' }}>{label}</span>
                  <span style={{ fontSize:15, lineHeight:1, filter: isSelected ? 'none' : isTrain ? 'none' : 'grayscale(0.25) saturate(0.85)' }}>{isTrain ? '🏋️' : '🛌'}</span>
                  <span style={{ fontSize:8, fontWeight:700, color: isSelected ? 'rgba(0,0,0,0.55)' : isTrain ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.36)', letterSpacing:'0.3px' }}>{isTrain ? 'ТРЕНЯ' : 'ОТДЫХ'}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6, padding:4, borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { setPlanDays(1); generatePlan(1); }} style={{
              padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', minHeight: 40,
              background: planDays === 1 ? 'linear-gradient(135deg,#00e68a 0%, #00c8a0 55%, #00b894 100%)' : 'transparent',
              border: planDays === 1 ? '1px solid rgba(0,230,138,0.45)' : '1px solid transparent',
              color: planDays === 1 ? '#0A0A0A' : 'rgba(255,255,255,0.72)',
              fontWeight:800, fontSize:12, letterSpacing:'-0.2px',
              boxShadow: planDays === 1 ? '0 4px 14px rgba(0,230,138,0.28)' : 'none',
            }}>📅 1 день</button>
            <button onClick={() => { setPlanDays(3); generatePlan(3, undefined, undefined, { async: true }); }} style={{
              padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', minHeight: 40,
              background: planDays === 3 ? 'linear-gradient(135deg,#00e68a 0%, #00c8a0 55%, #00b894 100%)' : 'transparent',
              border: planDays === 3 ? '1px solid rgba(0,230,138,0.45)' : '1px solid transparent',
              color: planDays === 3 ? '#0A0A0A' : 'rgba(255,255,255,0.72)',
              fontWeight:800, fontSize:12, letterSpacing:'-0.2px',
              boxShadow: planDays === 3 ? '0 4px 14px rgba(0,230,138,0.28)' : 'none',
            }}>{planBusy && planDays === 3 ? '⏳…' : '📅 3 дня'}</button>
            <button onClick={() => { setPlanDays(7); setPlanView('calendar'); generatePlan(7, undefined, undefined, { async: true }); }} style={{
              padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', minHeight: 40,
              background: planDays === 7 && !monthPlanMode ? 'linear-gradient(135deg,#8b5cf6 0%, #7c3aed 70%, #6d28d9 100%)' : 'transparent',
              border: planDays === 7 && !monthPlanMode ? '1px solid rgba(139,92,246,0.42)' : '1px solid transparent',
              color: planDays === 7 && !monthPlanMode ? '#fff' : 'rgba(255,255,255,0.72)',
              fontWeight:800, fontSize:12, letterSpacing:'-0.2px',
              boxShadow: planDays === 7 && !monthPlanMode ? '0 4px 14px rgba(139,92,246,0.28)' : 'none',
            }}>{planBusy && planDays === 7 ? '⏳…' : '📆 Неделя'}</button>
          </div>
          {planDays === 1 && generated && (
            <button onClick={() => generatePlan(1, undefined, selectedDayIndex)} style={{ width:'100%', padding:'11px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, marginTop:4, marginBottom:6, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', boxShadow:'0 4px 16px rgba(0,230,138,0.2)' }}>
              🔄 Перегенерировать день
            </button>
          )}
          {/* --- Month block --- */}
          <div style={{ marginBottom:6 }}>
            <button onClick={runMonthPlan} style={{
              padding:'11px', borderRadius:10, cursor:'pointer', textAlign:'center', width:'100%', minHeight: 40,
              background: monthPlanMode ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : 'rgba(139,92,246,0.08)',
              border: monthPlanMode ? 'none' : '1px solid rgba(139,92,246,0.25)',
              color: monthPlanMode ? '#fff' : '#a78bfa',
              fontWeight:700, fontSize:11,
            }}>
              📅 План на месяц (4 недели)
            </button>
          </div>
          {monthPlan.length > 0 && (
            <button onClick={() => {
              if (monthPlanMode) { setMonthPlanMode(false); switchPlanDays(7); }
              else { setMonthPlanMode(true); switchPlanDays(7); setSelectedWeek(0); if (monthPlan[0]) setWeekPlan(monthPlan[0]); }
            }} style={{
              marginBottom:6, padding:'10px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:600, width:'100%', minHeight: 36,
              background: monthPlanMode ? 'rgba(139,92,246,0.15)' : '#202023',
              border: monthPlanMode ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: monthPlanMode ? '#a78bfa' : 'rgba(255,255,255,0.85)',
            }}>
              {monthPlanMode ? '📋 Список недель (выйти из месяца)' : '📅 Месячное отображение'}
            </button>
          )}
          {planDays === 7 && !monthPlanMode && (
            <button onClick={() => setPlanView(planView === 'list' ? 'calendar' : 'list')} style={{
              marginTop: 0, marginBottom:6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%',
              background: planView === 'calendar' ? 'rgba(139,92,246,0.15)' : '#202023',
              border: planView === 'calendar' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: planView === 'calendar' ? '#a78bfa' : 'rgba(255,255,255,0.85)',
            }}>📅 {planView === 'calendar' ? 'Список' : 'Календарь'}</button>
          )}
          {planDays !== 1 && !monthPlanMode && (
            <button onClick={() => generatePlan(planDays, undefined, undefined, { async: true })} style={{ marginTop: 0, marginBottom:6, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
              {planBusy ? '⏳ Генерация…' : `🔄 Перегенерировать ${planDays === 3 ? '3 дня' : 'неделю'}`}
            </button>
          )}
          {monthPlanMode && monthPlan.length > 0 && (
            <button onClick={runMonthPlan} style={{ marginTop: 0, marginBottom:6, padding: '8px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.06)', color: '#a78bfa', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
              🔄 Перегенерировать месяц (4 недели)
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={() => {
              const txt = dayPlan ? `🍽 План питания\n${(Array.isArray(dayPlan.meals) ? dayPlan.meals : []).map((m: any) => `${m.time} ${m.label}: ${(Array.isArray(m.items) ? m.items : []).map((it: any) => `${it.name} ${it.amount}г`).join(', ')}  [${Math.round(m.totals?.kcal || 0)}ккал]`).join('\n')}\n\n📊 Итого: ${Math.round(dayPlan.totals?.kcal || 0)} ккал, Б${Math.round(dayPlan.totals?.p || 0)}/Ж${Math.round(dayPlan.totals?.f || 0)}/У${Math.round(dayPlan.totals?.c || 0)}, клетчатка ${Math.round(dayPlan.totals?.fiber||0)}г${(dayPlan as any).healthScore ? `\n\n🩺 Health-score: ${(dayPlan as any).healthScore.score}/100 (${(dayPlan as any).healthScore.status}) — микро ${(dayPlan as any).healthScore.micro}/клетч ${(dayPlan as any).healthScore.fiber}/MPS ${(dayPlan as any).healthScore.mps}/EA ${(dayPlan as any).healthScore.ea}/диверс ${(dayPlan as any).healthScore.diversity}` : ''}${(dayPlan as any).energyAvailability ? `\n⚡ EA: ${(dayPlan as any).energyAvailability.ea} ккал/кг FFM (${(dayPlan as any).energyAvailability.status})` : ''}${(dayPlan as any).menstrualPhaseNote ? `\n🌸 ${(dayPlan as any).menstrualPhaseNote}` : ''}${(dayPlan as any).categoryNote ? `\n🏋 ${(dayPlan as any).categoryNote}` : ''}${(dayPlan as any).redSNote ? `\n⚠️ ${(dayPlan as any).redSNote}` : ''}${(dayPlan as any).peakWeekNote ? `\n🏆 ${(dayPlan as any).peakWeekNote}` : ''}` : '';
              try { void (navigator.clipboard?.writeText(txt)?.catch(() => setErrorMsg('Не удалось скопировать план.'))); } catch { setErrorMsg('Не удалось скопировать план.'); }
            }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>📤 Копировать</button>
            <button onClick={() => setImportModalOpen(true)} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:10, fontWeight:600 }}>📥 Импорт</button>
          </div>
        </GlassCard>
      </>)}
      {/* Health-score — улучшена читаемость */}
      {plannerMode === 'pro' && generated && dayPlan && (dayPlan as any).healthScore && (() => {
        const hs = (dayPlan as any).healthScore;
        const col = hs.status === 'green' ? '#22c55e' : hs.status === 'yellow' ? '#f59e0b' : '#ef4444';
        const bg = hs.status === 'green' ? 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.04))' : hs.status === 'yellow' ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))' : 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04))';
        const bor = hs.status === 'green' ? '1px solid rgba(34,197,94,0.22)' : hs.status === 'yellow' ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(239,68,68,0.22)';
        const bars = [['Микро', hs.micro], ['Клетч', hs.fiber], ['MPS', hs.mps], ['EA', hs.ea], ['Диверс', hs.diversity]] as [string,number][];
        // Эпик 9в: тренд качества 7/30 дней (движок day-score-trend)
        let trend: { avg7: number; avg30: number; delta: number; direction: string; has30: boolean } | null = null;
        try { trend = computeDayScoreTrend(loadDayScores()); } catch {}
        return (
          <div style={{ padding:'12px 14px', borderRadius:16, background:bg, border:bor, marginBottom:10, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
            <div style={{ textAlign:'center', minWidth:56, padding:'6px 0', borderRadius:12, background:`${col}14`, border:`1px solid ${col}22` }}>
              <div style={{ fontSize:22, fontWeight:900, color:col, lineHeight:1, letterSpacing:'-0.6px' }}>{hs.score}</div>
              <div style={{ fontSize:9, color:col, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:1 }}>{hs.status === 'green' ? 'отлично' : hs.status === 'yellow' ? 'норма' : 'внимание'}</div>
            </div>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
              {bars.map(([lab,val]) => (
                <div key={lab} style={{ textAlign:'center', padding:'4px 2px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', fontWeight:600, letterSpacing:'0.2px' }}>{lab}</div>
                  <div style={{ fontSize:12, fontWeight:800, color: val >= 75 ? '#4ade80' : val >= 50 ? '#fbbf24' : '#f87171', marginTop:1 }}>{val}</div>
                  <div style={{ height:4, borderRadius:999, background:'rgba(255,255,255,0.07)', marginTop:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${Math.min(100,val)}%`, borderRadius:999, background: val >= 75 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444', boxShadow: `0 0 6px ${val >= 75 ? 'rgba(34,197,94,0.4)' : val >= 50 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}` }} /></div>
                </div>
              ))}
            </div>
            {trend && trend.has30 && (
              <div style={{ textAlign:'center', minWidth:64, padding:'6px 8px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }} title={`Средний скор за 7 дней: ${trend.avg7}/10 · за 30 дней: ${trend.avg30}/10`}>
                <div style={{ fontSize:13, fontWeight:900, color: trend.direction === 'up' ? '#4ade80' : trend.direction === 'down' ? '#f87171' : 'rgba(255,255,255,0.6)', lineHeight:1 }}>{trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '►'} {trend.delta > 0 ? '+' : ''}{trend.delta.toFixed(1)}</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', fontWeight:600, marginTop:2 }}>7д / {trend.avg30.toFixed(1)} за 30д</div>
                <button onClick={() => { try { clearDayScores(); (window as any).showToast?.('🗑 История качества дня сброшена', 'info'); } catch {} }} title="Сбросить историю качества дня" style={{ marginTop:2, fontSize:7, padding:'1px 6px', borderRadius:999, cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#f87171', border:'1px solid rgba(239,68,68,0.25)' }}>🗑</button>
              </div>
            )}
            {trend && !trend.has30 && (() => { const n = loadDayScores().length; return n > 0 ? (
              <div style={{ textAlign:'center', minWidth:64, padding:'6px 8px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }} title="Тренд появится после 7 записей дневных скоров">
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)' }}>📈</div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', fontWeight:600, marginTop:1 }}>тренд: {n} из 7 дн</div>
              </div>
            ) : null; })()}
            {hs.conflicts > 0 && <span style={{ fontSize:11, color:'#f87171', fontWeight:800, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', padding:'4px 8px', borderRadius:999, whiteSpace:'nowrap' }}>⚠ {hs.conflicts}</span>}
          </div>
        );
      })()}
      {/* Pro Engine MPS-сводка */}
      {plannerMode === 'pro' && generated && dayPlan && (dayPlan as any).mpsSummary && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)', marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:4 }}>🧬 Muscle Protein Synthesis</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{(dayPlan as any).mpsSummary.feedings}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>MPS feedings</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#3b82f6' }}>{(dayPlan as any).mpsSummary.avg_protein_per_meal_g}г</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>Белок/приём</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>{(dayPlan as any).mpsSummary.avg_leucine_g}г</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>Лейцин/приём</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
            {(dayPlan as any).mpsSummary.prePostWindow && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>✅ Pre/Post-W</span>}
            {(dayPlan as any).mpsSummary.intra_workout && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#a855f7', border:'1px solid rgba(168,85,247,0.2)' }}>✅ Intra-W</span>}
          </div>
          {(dayPlan as any).proNotes && (dayPlan as any).proNotes.length > 0 && (
            <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>
              {(dayPlan as any).proNotes.map((n: string, i: number) => <div key={i} style={{ marginBottom:1 }}>• {n}</div>)}
            </div>
          )}
        </div>
      )}
      {/* Адаптация по дневнику: баннер компенсации вчерашнего отклонения */}
      {/* #1 Микронутриентный coverage — структура по 16 нутриентам */}
      {plannerMode === 'pro' && generated && dayPlan && (dayPlan as any).microSummary && (dayPlan as any).microSummary.coverage && (() => {
        const cov = (dayPlan as any).microSummary.coverage as any[];
        const ordered = [...cov].sort((a,b) => a.pct - b.pct);
        const colorFor = (s: string) => s === 'deficit' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'low' ? '#f59e0b' : '#22c55e';
        const labelMap: Record<string,string> = { Ca:'Кальций', Fe:'Железо', Mg:'Магний', Zn:'Цинк', Se:'Селен', K:'Калий', Na:'Натрий', VitC:'C', VitD:'D', VitB12:'B12', VitB6:'B6', VitB9:'Фолат', VitA:'A', VitE:'E', VitK:'K', Omega3:'Омега-3' };
        return (
          <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', marginBottom:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🧪 Микронутриенты (RDA coverage)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
              {ordered.slice(0, 16).map(c => (
                <div key={c.nutrient} style={{ textAlign:'center', padding:'3px 2px', borderRadius:6, background:'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>{labelMap[c.nutrient] || c.nutrient}</div>
                  <div style={{ fontSize:11, fontWeight:800, color: colorFor(c.status) }}>{c.pct}%</div>
                  <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.08)', marginTop:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100, c.pct)}%`, background: colorFor(c.status) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {generated && dayPlan && (dayPlan as any).diaryCompensation && (() => {
        const dc = (dayPlan as any).diaryCompensation;
        const sev = dc.severity || 'low';
        const color = sev === 'high' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#10b981';
        return (
          <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:`rgba(${sev==='high'?'239,68,68':sev==='medium'?'245,158,11':'16,185,129'},0.08)`, border:`1px solid rgba(${sev==='high'?'239,68,68':sev==='medium'?'245,158,11':'16,185,129'},0.25)` }}>
            <div style={{ fontSize:9, fontWeight:700, color, marginBottom:2 }}>📊 Адаптация по дневнику</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{dc.note}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Цели на сегодня скорректированы по факту вчерашнего дня.</div>
          </div>
        );
      })()}
      {/* #1 Женская фаза цикла */}
      {generated && dayPlan && (dayPlan as any).menstrualPhaseNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.25)' }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#ec4899', marginBottom:2 }}>🌈 Фаза цикла</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{(dayPlan as any).menstrualPhaseNote}</div>
        </div>
      )}
      {/* #2 Кости/кальций (женское) */}
      {generated && dayPlan && (dayPlan as any).boneNotes && ((dayPlan as any).boneNotes as string[]).map((n: string, i: number) => (
        <div key={'bone'+i} style={{ marginBottom:4, padding:'6px 10px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', fontSize:9, color:'rgba(255,255,255,0.8)', lineHeight:1.4 }}>{n}</div>
      ))}
      {/* #7 Сон-питание */}
      {generated && dayPlan && (dayPlan as any).sleepNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{(dayPlan as any).sleepNote}</div>
      )}
      {/* #6 Diet-break диагностика */}
      {generated && dayPlan && (dayPlan as any).dietBreakNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{(dayPlan as any).dietBreakNote}</div>
      )}
      {/* Дневные заметки: рефид / волна / тяжёлый день / календарь цикла */}
      {generated && dayPlan && (() => {
        const notes = [
          { v: (dayPlan as any).refeedNote, c: '#22c55e' },
          { v: (dayPlan as any).periodizationWeekNote, c: '#8b5cf6' },
          { v: (dayPlan as any).heavyDayNote, c: '#fb923c' },
          { v: (dayPlan as any).cycleCalendarNote, c: '#ec4899' },
        ].filter((n: any) => !!n.v);
        if (notes.length === 0) return null;
        return (
          <div style={{ marginBottom:6, display:'flex', flexDirection:'column', gap:4 }}>
            {notes.map((n: any, i: number) => (
              <div key={i} style={{ padding:'6px 10px', borderRadius:10, background:`${n.c}0a`, border:`1px solid ${n.c}22`, fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{n.v}</div>
            ))}
          </div>
        );
      })()}
      {/* #5 Категория бодибилдинга */}
      {generated && dayPlan && (dayPlan as any).categoryNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.25)', fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{(dayPlan as any).categoryNote}</div>
      )}
      {/* п.18: карточка «📍 Текущий блок года» — активный блок годового плана на сегодня */}
      {generated && annualPhase && (() => {
        const b = annualPhase.block;
        const statusIcon = b.status === 'built' ? '✅' : b.status === 'stale' ? '⚠' : b.status === 'error' ? '❌' : '·';
        const statusLabel = b.status === 'built' ? 'собран' : b.status === 'stale' ? 'устарел' : b.status === 'error' ? 'ошибка' : 'не собран';
        const kindLabel = b.ref.kind === 'PL' ? 'ПЛ' : b.ref.kind === 'BB' ? 'ББ' : '✍ Ручной';
        const prepNote = b.ref.kind === 'BB' && b.ref.phase === 'contest_prep'
          ? ' · 🏁 contest prep — фаза сушки: питание по prep-плану' : '';
        return (
          <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}
            title={`Блок ${b.ref.phase} (нед ${b.ref.startWeek}–${b.ref.startWeek + b.ref.weeks - 1})`}>
            📍 Текущий блок года: нед {annualPhase.week} · {b.ref.phase} ({b.ref.startWeek}–{b.ref.startWeek + b.ref.weeks - 1}) · {kindLabel} {statusIcon} {statusLabel}{prepNote}
          </div>
        );
      })()}
      {generated && ((usePlanCtx() as any).combatNutrition) && (() => {
        const ctx:any = usePlanCtx() as any;
        const cn = ctx.combatNutrition as any;
        return (
          <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}
            title={cn.note || ''}>
            <span>🥊 План единоборств: {cn.kcal ? `${cn.kcal} ккал` : ''} {cn.proteinG ? `· P${cn.proteinG}` : ''} {cn.carbsG ? `· C${cn.carbsG}` : ''} {cn.fatG ? `· F${cn.fatG}` : ''} {cn.fiberG ? `· клетч ${cn.fiberG}г` : ''} {cn.waterMl ? `· 💧${cn.waterMl}мл` : ''} {cn.sodiumMg ? `· Na${cn.sodiumMg}мг` : ''} {cn.orsMmol ? `· ORS ${cn.orsMmol}` : ''} {cn.weighInType ? `· ${cn.weighInType==='same_day_2h'?'same-day':'24ч'}` : ''} {cn.planId ? `· #${String(cn.planId).slice(0,6)}` : ''}</span>
            <button onClick={() => ctx.applyCombatNutrition?.()} style={{ marginLeft:'auto', padding:'4px 8px', borderRadius:6, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.28)', color:'#d8b4fe', fontSize:9, fontWeight:700, cursor:'pointer' }}>⚡ Применить к плану</button>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }} title={cn.note || ''}>{cn.note ? String(cn.note).slice(0,80) : ''}</span>
          </div>
        );
      })()}
      {/* #4 Peak-week protocol */}
      {generated && dayPlan && (dayPlan as any).peakWeekNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', fontSize:9, color:'#fbbf24', fontWeight:600, lineHeight:1.4 }}>{(dayPlan as any).peakWeekNote}</div>
      )}
      {/* #10 Жизненный этап */}
      {generated && dayPlan && (dayPlan as any).lifeStageNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', fontSize:9, color:'rgba(255,255,255,0.85)', lineHeight:1.4 }}>{(dayPlan as any).lifeStageNote}</div>
      )}
      {/* #1 RED-S / Energy Availability */}
      {generated && dayPlan && (dayPlan as any).redSNote && (
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.35)', fontSize:9, color:'#fca5a5', fontWeight:600, lineHeight:1.4 }}>{(dayPlan as any).redSNote}</div>
      )}
      {generated && dayPlan && (dayPlan as any).energyAvailability && (dayPlan as any).energyAvailability.status !== 'risk' && (
        <div style={{ marginBottom:6, padding:'6px 10px', borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', fontSize:10, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>
          ⚡ Energy Availability: {(dayPlan as any).energyAvailability.ea} ккал/кг FFM ({(dayPlan as any).energyAvailability.status}) — трен. расход {(dayPlan as any).energyAvailability.exerciseKcal} ккал
        </div>
      )}
      {/* #2 Голод — hungerNote удалён из генерации (шумовый сигнал) */}
      {plannerMode === 'pro' && generated && dayPlan && <DailyDietDashboard />}
      {plannerMode === 'pro' && generated && dayPlan && (
        <NutritionQualityCard
          meals={(dayPlan as any)?.meals?.map((m: any) => ({
            foods: (m.items || []).map((it: any) => ({
              id: it.id || it.name || 'unknown',
              name: it.name || '',
              grams: it.amount || 100,
              protein: it.p || 0,
              fat: it.f || 0,
              carbs: it.c || 0,
              kcal: it.kcal || 0,
              fiber: 0,
            })),
          })) || []}
          weight={weight}
          age={age}
          sex={sex}
        />
      )}
      {generated && allergens.length > 0 && (
        <GlassCard title="Аллергены" icon="⚠️" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {allergenExcludedCount > 0 ? (
              <>🚫 Исключено <strong style={{ color: '#f97316' }}>{allergenExcludedCount}</strong> продуктов из {FOOD_DB.length} по вашим аллергенам: <span style={{ color: '#fb923c' }}>{allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}</span></>
            ) : (
              <>⚠️ Аллергены выбраны ({allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}), но ни один продукт не был исключён — проверьте список продуктов в базе</>
            )}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Чтобы применить изменения аллергенов, нажмите «Перегенерировать»</div>
        </GlassCard>
      )}

      {generated && planDays === 1 && dayPlan && (<>
        <GlassCard title={`План на день${carbPeriodization !== 'none' ? (dayPlan.isTrainingDay ? ' 🏋️ Тренировочный' : ' 🛌 Отдых') : ''}`} icon="📋" color={dayPlan.isTrainingDay ? '#00e68a' : '#8b5cf6'} style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {dayPlan.isTrainingDay !== undefined && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{dayPlan.isTrainingDay ? 'Тренировочный день' : 'День отдыха'}{carbPeriodization !== 'none' && ` · циклирование: ${carbPeriodizationLabel(carbPeriodization)}`}{workScheduleEnabled && ` · 💼${dayPlan.isWorkDay ? ' Рабочий' : ' Выходной'}${dayPlan.isWorkDay && workStartTime ? ` ${workStartTime}-${workEndTime}` : ''}`}</div>}
          {weekEditDay !== null && (
            <div style={{ marginBottom: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 9, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✏️ Редактируете {DAY_LABELS[weekEditDay]} из недельного плана — изменения сохранятся в неделе.</span>
              <button onClick={() => switchPlanDays(7)} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap' }}>↩ К неделе</button>
            </div>
          )}
          {/* 🧭 Брифинг дня — помощник спортсмена */}
          {(() => {
            try {
              const now = new Date();
              // Факт из дневника питания за сегодня (что реально съедено)
              let fact: { kcal: number; p: number } | null = null;
              try {
                const dateIso = now.toISOString().slice(0, 10);
                const data = readDiaryV2();
                const dayEntries = data?.[dateIso]?.meals || {};
                let fk = 0, fp = 0;
                Object.values(dayEntries).forEach((arr: any) => (Array.isArray(arr) ? arr : []).forEach((e: any) => { fk += e.kcal || 0; fp += e.p || 0; }));
                if (fk > 0) fact = { kcal: Math.round(fk), p: Math.round(fp * 10) / 10 };
              } catch {}
              const b = buildDayBriefing({
                totals: dayPlan.totals || { kcal: 0, p: 0, f: 0, c: 0 },
                goals: { kcal: effectiveKcal || 0, p: effectiveP || 0, f: effectiveF || 0, c: effectiveC || 0 },
                meals: dayPlan.meals || [],
                isTrainingDay: !!dayPlan.isTrainingDay,
                trainTime: linkToTraining ? trainStart : undefined,
                nowTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                waterL: waterCalc?.total,
                fact,
              });
              if (b.cookToday.length === 0 && !b.nextMeal && b.tips.length === 0 && b.factVsPlanPct === null) return null;
              return (
                <div style={{ margin: '4px 0 8px', padding: '8px 10px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(59,130,246,0.18)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>🧭 {b.dayTypeLabel}{waterCalc?.total ? ` · 💧 ${waterCalc.total} л/день` : ''}</div>
                  {b.cookToday.length > 0 && <div style={{ fontSize: 9, color: '#fbbf24', marginBottom: 3 }}>👨‍🍳 Готовить сегодня: <b>{b.cookToday.join(' · ')}</b></div>}
                  {b.nextMeal && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>⏰ Следующий приём: <b>{b.nextMeal.label}</b> в {b.nextMeal.time}</div>}
                  {fact && b.factVsPlanPct !== null && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>
                      🍽 Съедено: <b>{fact.kcal} ккал</b> ({b.factVsPlanPct}% плана){b.remainingKcalToGoal !== null && <> · осталось до цели ~<b>{Math.abs(b.remainingKcalToGoal)}</b> ккал{b.remainingKcalToGoal < 0 ? ' (перебор)' : ''}</>}
                    </div>
                  )}
                  {b.proteinLeftG >= 10 && <div style={{ fontSize: 9, color: '#60a5fa' }}>🎯 План: Б{Math.round(dayPlan.totals?.p || 0)}/{effectiveP} · К{Math.round(dayPlan.totals?.kcal || 0)} ({b.kcalDeltaPct > 0 ? '+' : ''}{b.kcalDeltaPct}%)</div>}
                  {b.tips.map((t: string, i: number) => <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', marginTop: 3 }}>{t}</div>)}
                </div>
              );
            } catch { return null; }
          })()}
          {renderMealList(dayPlan, false, 0)}
          <textarea value={dayPlanNotes} onChange={e => setDayPlanNotes(e.target.value)} onBlur={() => { try { localStorage.setItem('he_day_notes', dayPlanNotes); } catch {} }} maxLength={2000} placeholder="Заметки на сегодня..." style={{ width:'100%', marginTop:6, padding:'6px 10px', borderRadius:8, fontSize:9, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.85)', resize:'vertical', minHeight:30, boxSizing:'border-box' }} rows={1} />
          <button onClick={() => generatePlan(1, undefined, selectedDayIndex)} style={{ width:'100%', padding:'10px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, marginTop:8, marginBottom:4, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', boxShadow:'0 4px 16px rgba(0,230,138,0.2)' }}>
            🔄 Перегенерировать день
          </button>
          {(() => {
            const dayTotal = dayPlan.totals;
            const devKcal = Math.round(dayTotal?.kcal - effectiveKcal);
            const devP = Math.round(dayTotal?.p - effectiveP);
            if (Math.abs(devKcal) < 50 && Math.abs(devP) < 5) return null;
            return (
              <button onClick={autoCorrectPlan} style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                📊 Автокоррекция: откл. от цели {devKcal > 0 ? '+' : ''}{devKcal} ккал / {devP > 0 ? '+' : ''}{devP}г Б — подогнать оставшиеся приёмы
              </button>
            );
          })()}
        </GlassCard>

        {(() => {
          try {
            const today = new Date().toISOString().split('T')[0];
            const todayEntries = getDiaryEntriesForDate(today);
            if (todayEntries.length === 0) return null;
            const factKcal = Math.round(todayEntries.reduce((s: number, d: any) => s + (d.kcal || 0), 0));
            const factP = Math.round(todayEntries.reduce((s: number, d: any) => s + (d.p || d.protein || 0), 0));
            const factF = Math.round(todayEntries.reduce((s: number, d: any) => s + (d.f || d.fat || 0), 0));
            const factC = Math.round(todayEntries.reduce((s: number, d: any) => s + (d.c || d.carbs || 0), 0));
            const planKcal = dayPlan?.totals?.kcal || 0;
            const planP = dayPlan?.totals?.p || 0;
            if (factKcal === 0) return null;
            const kcalPct = planKcal > 0 ? Math.round(factKcal / planKcal * 100) : 0;
            return (
              <GlassCard title="📊 План vs Факт" icon="⚖️" color={kcalPct >= 90 && kcalPct <= 110 ? '#22c55e' : '#f59e0b'}>
                <div style={{ fontSize:9 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                    {[{label:'Ккал', plan:planKcal, fact:factKcal, unit:'', color:'#00e68a'},{label:'Белок', plan:planP, fact:factP, unit:'г', color:'#3b82f6'},{label:'Жиры', plan:dayPlan?.totals?.f||0, fact:factF, unit:'г', color:'#f59e0b'},{label:'Угл.', plan:dayPlan?.totals?.c||0, fact:factC, unit:'г', color:'#f97316'}].map(m=>(<div key={m.label} style={{textAlign:'center',padding:'4px',borderRadius:6,background:'rgba(255,255,255,0.02)'}}><div style={{color:m.color,fontWeight:700,fontSize:10}}>{m.fact}</div><div style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>План: {m.plan}{m.unit}</div></div>))}
                  </div>
                  <div style={{ color: kcalPct >= 90 && kcalPct <= 110 ? '#22c55e' : '#f59e0b', fontWeight:600 }}>
                    {kcalPct >= 90 && kcalPct <= 110 ? '✅ В рамках плана' : kcalPct > 110 ? `⚠️ Перебор на ${kcalPct-100}%` : `⚠️ Недобор на ${100-kcalPct}%`}
                    <span style={{fontWeight:400,color:'rgba(255,255,255,0.5)',marginLeft:4}}>({factKcal}/{planKcal} ккал)</span>
                  </div>
                </div>
              </GlassCard>
            );
          } catch { return null; }
        })()}
      </>)}

      {generated && planDays === 3 && threeDayPlan && (
        <GlassCard title="План на 3 дня" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 Всего: {Math.round(threeDayPlan.totals?.kcal || 0)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round((threeDayPlan.totals?.kcal || 0) / 3)} ккал/день</span>
          </div>
          {threeDayPlan.days.map((d: any, di: number) => {
            const dKcal = Math.round(d.totals?.kcal || 0);
            const dP = Math.round(d.totals?.p || 0);
            const dF = Math.round(d.totals?.f || 0);
            const dC = Math.round(d.totals?.c || 0);
            const dIsTrain = d.isTrainingDay;
            const kcalPct = effectiveKcal > 0 ? Math.round(dKcal / effectiveKcal * 100) : 0;
            const kcalColor = Math.abs(dKcal - (effectiveKcal||0)) <= Math.max(50, (effectiveKcal||0)*0.08) ? '#00e68a' : '#f59e0b';
            return (
            <div key={di} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: dIsTrain ? '#00e68a' : '#a78bfa', marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: dIsTrain ? 'rgba(0,230,138,0.06)' : 'rgba(139,92,246,0.06)', border: dIsTrain ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>{dIsTrain ? '🏋️' : '😴'}</span>
                <span>{DAY_LABELS[di]} · День {di + 1}</span>
                <span style={{ color: kcalColor, fontWeight: 800, marginLeft: 'auto' }}>{dKcal} <span style={{ fontSize: 7, fontWeight: 400 }}>/{effectiveKcal || '---'} ({kcalPct}%)</span></span>
                <span style={{ color: '#3b82f6', fontSize: 8 }}>{dP}г</span>
                <span style={{ color: '#f59e0b', fontSize: 8 }}>{dF}г</span>
                <span style={{ color: '#f97316', fontSize: 8 }}>{dC}г</span>
              </div>
              {renderMealList(d)}
            </div>
            );
          })}
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && (
        <GlassCard title={monthPlanMode ? `Месячный план — Неделя ${selectedWeek + 1} / 4` : 'Недельный план'} icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {monthPlanMode && monthPlan.length > 0 && (
            <div style={{ display:'flex', gap:4, marginBottom:8, justifyContent:'center', flexWrap:'wrap' }}>
              {monthPlan.map((_, wi) => (
                <div key={wi} style={{ display:'flex', alignItems:'center', gap:2, padding:'4px 6px 4px 10px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:700,
                  background: selectedWeek === wi ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : '#202023',
                  color: selectedWeek === wi ? '#fff' : 'rgba(255,255,255,0.85)',
                  border: selectedWeek === wi ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }} onClick={() => { setSelectedWeek(wi); if (monthPlan[wi]) setWeekPlan(monthPlan[wi]); }}>
                  Н{wi + 1}{monthPlan[wi]?.totals?.kcal ? ` · ${Math.round((monthPlan[wi].totals.kcal || 0) / 7)}` : ''}
                  <span title={`Перегенерировать неделю ${wi + 1} (без сброса остальных)`} onClick={(e) => { e.stopPropagation(); setSelectedWeek(wi); generatePlan(7, wi, undefined, { skipUndo: true, async: true }); }} style={{ cursor:'pointer', fontSize:10, padding:'1px 4px', borderRadius:5, color: selectedWeek === wi ? 'rgba(255,255,255,0.85)' : '#a78bfa', background: 'rgba(255,255,255,0.1)' }}>🔄</span>
                </div>
              ))}
              <button onClick={() => { setMonthPlanMode(false); }} style={{
                padding:'5px 8px', borderRadius:8, fontSize:9, cursor:'pointer',
                background:'transparent', color:'rgba(255,255,255,0.8)', border:'1px solid rgba(255,255,255,0.06)',
              }}>✕</button>
            </div>
          )}
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
             <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 За неделю: {Math.round(weekPlan.totals?.kcal || 0)} ккал</span>
             <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round((weekPlan.totals?.kcal || 0) / 7)} ккал/день</span>
          </div>
          {/* Эпик-хвост (9а): неделя vs план — ккал и Б/Ж/У против целей */}
          {(() => {
            // Хвост-4: «Неделя vs план» учитывает недельную периодизацию углеводов (волна 2+1 —
            // каждая 3-я неделя поддержание ×0.9; рефид/цикл/БУЧ меняют дневные цели). Раньше
            // сравнение шло против effectiveKcal × 7 → для недель месяца ложно «вне ±5%».
            const weekIdx = monthPlanMode ? (selectedWeek || 0) : 0;
            const isTrainArr = (Array.isArray(weekPlan?.days) ? weekPlan.days : []).map((d: any) => !!d?.isTrainingDay);
            const planK = monthPlanMode
              ? expectedWeekKcal(effectiveKcal, carbPeriodization, weekIdx, isTrainArr, heavyTrainDay, DAY_LABELS)
              : Math.round((effectiveKcal || 0) * 7);
            const factK = Math.round(weekPlan.totals?.kcal || 0);
            const devK = planK > 0 ? Math.round((factK - planK) / planK * 100) : 0;
            const okK = Math.abs(devK) <= 5;
            const rows: [string, number, number, string][] = [
              ['Б', Math.round(weekPlan.totals?.p || 0), Math.round((effectiveP || 0) * 7), '#3b82f6'],
              ['Ж', Math.round(weekPlan.totals?.f || 0), Math.round((effectiveF || 0) * 7), '#f59e0b'],
              ['У', Math.round(weekPlan.totals?.c || 0), Math.round((effectiveC || 0) * 7), '#f97316'],
            ];
            const waveNote = monthPlanMode && carbPeriodization === 'wave' && (weekIdx % 3 === 2)
              ? ' · волна 2+1: неделя поддержания ×0.9'
              : monthPlanMode && carbPeriodization !== 'none'
                ? ` · ${carbPeriodizationLabel(carbPeriodization)}`
                : '';
            return (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: okK ? '#22c55e' : '#fbbf24' }}>🎯 Неделя vs план: {factK} / {Math.round(planK)} ккал ({devK > 0 ? '+' : ''}{devK}%){waveNote}</span>
                  <span style={{ color: okK ? '#22c55e' : '#fbbf24' }}>{okK ? '✓ в коридоре ±5%' : 'вне ±5%'}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {rows.map(([lab, fact, plan, col]) => (
                    <span key={lab} style={{ color: col }}>● {lab}: {fact}г / {Math.round(plan)}г</span>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
             <span style={{ color: '#3b82f6' }}>● Б: {Math.round(weekPlan.totals?.p || 0)}г</span>
             <span style={{ color: '#f59e0b' }}>● Ж: {Math.round(weekPlan.totals?.f || 0)}г</span>
             <span style={{ color: '#f97316' }}>● У: {Math.round(weekPlan.totals?.c || 0)}г</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
             {(Array.isArray(weekPlan.days) ? weekPlan.days : []).map((d: any, di: number) => {
              const wKcal = Math.round(d.totals?.kcal || 0);
              const wP = Math.round(d.totals?.p || 0);
              const wF = Math.round(d.totals?.f || 0);
              const wC = Math.round(d.totals?.c || 0);
              const wIsTraining = d.isTrainingDay;
              return (
                <div key={di} onClick={() => openWeekDayForEdit(di)} style={{
                  padding: 10, borderRadius: 12, cursor: 'pointer',
                  background: wIsTraining ? 'rgba(0,230,138,0.03)' : '#202023',
                  border: wIsTraining ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.06)',
                }} title='Нажмите, чтобы открыть день подробно'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{wIsTraining ? '🏋️' : '😴'}</span>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: wIsTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {DAY_LABELS[di]} · День {di + 1}
                        </span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', display: 'flex', gap: 4 }}>
                          <span style={{ color: '#3b82f6' }}>Б {wP}</span>
                          <span style={{ color: '#f59e0b' }}>Ж {wF}</span>
                          <span style={{ color: '#f97316' }}>У {wC}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{wKcal} ккал</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {(Array.isArray(d.meals) ? d.meals : []).map((m: any, mi: number) => (
                      <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#00e68a', fontWeight: 600, minWidth: 50 }}>{m.time}</span>
                        <span style={{ color: '#00e68a', minWidth: 55 }}>{m.label}</span>
                        <span style={{ flex: 1 }}>{m.items?.map((it: any) => it.name)?.join(', ') || ''}</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{Math.round(m.totals?.kcal || 0)} ккал</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && planView === 'calendar' && (
        <GlassCard title="📅 Календарь питания на неделю" icon="📅" color="#a78bfa">
          {(() => {
             const allMealLabels = Array.from(new Set((Array.isArray(weekPlan.days) ? weekPlan.days : []).flatMap((d: any) => (Array.isArray(d?.meals) ? d.meals : []).map((m: any) => m.label))));
            return <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 7 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'center', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Приём</th>
                    {(Array.isArray(weekPlan.days) ? weekPlan.days : []).map((d: any, di: number) => (
                      <th key={di} style={{ padding: '4px 6px', textAlign: 'center', background: d.isTrainingDay ? 'rgba(0,230,138,0.12)' : '#202023', borderRadius: 6, fontSize: 7, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                        {DAY_LABELS[di]}
                        <div style={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{Math.round(d.totals?.kcal || 0)} ккал</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMealLabels.map((label: any) => (
                    <tr key={label}>
                      <td style={{ padding: '4px 6px', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</td>
                       {(Array.isArray(weekPlan.days) ? weekPlan.days : []).map((d: any, di: number) => {
                         const meal = (Array.isArray(d?.meals) ? d.meals : []).find((m: any) => m.label === label);
                        if (!meal) return <td key={di} style={{ padding: '4px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 6 }}>—</td>;
                        const kcal = Math.round(meal.totals?.kcal || 0);
                        return (
                          <td key={di} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 6, verticalAlign: 'top' }}>
                            <div style={{ color: '#00e68a', fontWeight: 700, fontSize: 7, marginBottom: 2 }}>{kcal} ккал</div>
                            {(meal.items || []).slice(0, 2).map((it: any, ii: number) => (
                              <div key={ii} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontSize: 6 }}>{it.name} {it.amount}г</div>
                            ))}
                             {(Array.isArray(meal.items) ? meal.items.length : 0) > 2 && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5 }}>+{(meal.items?.length || 0) - 2} ещё</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>;
          })()}
        </GlassCard>
      )}

      {generated && planDays === 1 && dayPlan && weekPlan && (
        <button onClick={() => switchPlanDays(7)} style={{ marginBottom:6, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(139,92,246,0.25)', background:'rgba(139,92,246,0.06)', color:'#a78bfa', cursor:'pointer', fontSize:9, fontWeight:600 }}>← Назад к неделе</button>
      )}
      {generated && planDays === 1 && dayPlan && (
        <GlassCard title="⏳ Таймлайн дня" icon="⏳" color="#06b6d4">
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'rgba(6,182,212,0.2)', borderRadius: 1 }} />
            {(Array.isArray(dayPlan.meals) ? dayPlan.meals : []).map((m: any, mi: number) => {
              const k = Math.round(m.totals?.kcal || 0);
              const w = Math.max(10, Math.round(k / Math.max(1, dayPlan.totals?.kcal) * 100));
              return (
                <div key={mi} style={{ position: 'relative', marginBottom: 8, paddingLeft: 16 }}>
                  <div style={{ position: 'absolute', left: -16, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', border: '2px solid #18181b' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap', wordBreak: 'break-word' }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: '#06b6d4', minWidth: 40 }}>{m.time}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{m.label}</span>
                    {m.mpsCheck && (m.mpsCheck.triggers_mTOR
                      ? <span style={{ fontSize: 6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', marginLeft:4 }}>⚡ mTOR</span>
                      : <span style={{ fontSize: 6, padding:'1px 4px', borderRadius:3, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', marginLeft:4 }}>⚠ {Math.round(m.mpsCheck.leucineG * 10) / 10}г лейц</span>)}
                    {m.rationale && m.rationale.length > 0 && (() => {
                      const _inter = (m.rationale as string[]).filter(r => r.startsWith('⚠') || r.includes('Синергия'));
                      const _regular = (m.rationale as string[]).filter(r => !r.startsWith('⚠') && !r.includes('Синергия')).slice(0, 2);
                      return (
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>
                          {_regular.map((r: string, i: number) => <div key={i}>• {r}</div>)}
                          {_inter.map((r: string, i: number) => (
                            <div key={'i'+i} style={{ marginTop: 2, padding: '1px 4px', borderRadius: 3, fontStyle: 'normal', fontWeight: 600,
                              background: r.startsWith('⚠') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                              border: `1px solid ${r.startsWith('⚠') ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
                              color: r.startsWith('⚠') ? '#ef4444' : '#22c55e' }}>{r}</div>
                          ))}
                        </div>
                      );
                    })()}
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>{k} ккал</span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Б {Math.round(m.totals?.p || 0)} Ж {Math.round(m.totals?.f || 0)} У {Math.round(m.totals?.c || 0)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#202023', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg, #06b6d4, #00e68a)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(m.items || []).map((it: any, ii: number) => (
                      <span key={ii} style={{ background: '#202023', padding: '1px 5px', borderRadius: 4 }}>{it.name} {it.amount}г</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {recipePickerMeal && generated && dayPlan && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', padding:'12px' }}
          onClick={() => setRecipePickerMeal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px', background:'#18181b', boxShadow:'0 18px 54px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>{(function(){ const _m = dayPlan?.meals?.[recipePickerMeal.mealIdx]; return _m?.recipeApplied ? (_m?.recipeApplied2 ? '🍳 Заменить второй рецепт' : '➕ Добавить второй рецепт') : '🍳 Заменить'; })()} «{recipePickerMeal.label}» рецептом</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>{(function(){ const _m = dayPlan?.meals?.[recipePickerMeal.mealIdx]; return _m?.recipeApplied2 ? `Уже: «${_m.recipeApplied}» + «${_m.recipeApplied2}» — выберите на замену второго` : _m?.recipeApplied ? `Уже: «${_m.recipeApplied}» — выберите второй рецепт (совместимый)` : 'Подходящие рецепты'; })()}</div>
            <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
              {getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').length === 0 ? (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>Нет рецептов для этого приёма.</div>
              ) : getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').map((r, i) => (
                <div key={i} style={{ display:'flex', gap:4, width:'100%' }}>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const _m = dayPlan?.meals?.[recipePickerMeal.mealIdx]; if (_m?.recipeApplied && !_m?.recipeApplied2) { addSecondRecipeToMeal(r, recipePickerMeal.mealIdx, recipePickerMeal.dayIdx); } else { replaceMealWithRecipe(r, recipePickerMeal.mealIdx, recipePickerMeal.dayIdx); } setRecipePickerMeal(null); }} style={{ flex:1, padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, transition:'all 0.15s' }}
                    onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'}>
                    <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{r.name}</div>
                    <div style={{ color:'rgba(255,255,255,0.85)', marginBottom:4 }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', display:'flex', gap:2, flexWrap:'wrap' }}>{(r.tags || []).map(t => <span key={t} style={{ padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'rgba(167,139,250,0.5)' }}>{t}</span>)}</div>
                  </button>
                  <button onClick={() => setRecipeDetail(r)} style={{ width:36, height:36, borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', fontSize:14, flexShrink:0, alignSelf:'flex-start', marginTop:8 }}>ℹ️</button>
                </div>
              ))}
            </div>
            <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:9, fontWeight:600 }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* Recipe detail popup */}
      {recipeDetail && (
        <div style={{ position:'fixed', inset:0, zIndex:110, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => setRecipeDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'90%', maxWidth:380, maxHeight:'80vh', padding:18, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>{recipeDetail.name}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>⏱ {recipeDetail.prepTimeMin} мин · {recipeDetail.kcal} ккал</div>
              </div>
              <button onClick={() => setRecipeDetail(null)} style={{ width:28, height:28, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.5)', fontSize:12 }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:10 }}>
              <div style={{ padding:'6px 4px', borderRadius:8, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#22c55e' }}>{recipeDetail.protein}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Белки</div>
              </div>
              <div style={{ padding:'6px 4px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#f59e0b' }}>{recipeDetail.fat}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Жиры</div>
              </div>
              <div style={{ padding:'6px 4px', borderRadius:8, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.1)', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#f97316' }}>{recipeDetail.carbs}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Угл</div>
              </div>
              <div style={{ padding:'6px 4px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.1)', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#8b5cf6' }}>{(recipeDetail.kcal && recipeDetail.kcal > 0) ? Math.round(recipeDetail.protein*4/recipeDetail.kcal*100) : 0}%</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>% белка</div>
              </div>
            </div>
            {recipeDetail.ingredients?.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#f97316', marginBottom:4 }}>🥕 Ингредиенты</div>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  {recipeDetail.ingredients.map((ing:string, i:number) => (
                    <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.85)', padding:'2px 6px', background:'rgba(249,115,22,0.04)', borderRadius:4 }}>• {ing}</div>
                  ))}
                </div>
              </div>
            )}
            {recipeDetail.instructions?.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>📝 Инструкция</div>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  {recipeDetail.instructions.map((step:string, i:number) => (
                    <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.85)', padding:'4px 6px', background:'rgba(96,165,250,0.04)', borderRadius:4, lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#60a5fa', marginRight:4 }}>{i+1}.</span>{step}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recipeDetail.tags?.length > 0 && (
              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                {recipeDetail.tags.map((t:string, i:number) => (
                  <span key={i} style={{ padding:'2px 7px', borderRadius:5, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.12)', color:'#a78bfa', fontSize:10, fontWeight:600 }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {generated && undoStack.length > 0 && (
        <button onClick={() => undoLast()} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>
          ↩ Отменить ({undoStack.length})
        </button>
      )}

      {generated && (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={saveCurrentPlan} style={{
            ...greenBtn, background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)',
            fontSize: 13, padding: 12, flex:1,
            boxShadow: '0 4px 16px rgba(139,92,246,0.2)',
          }}>
            💾 Сохранить в мои планы
          </button>
          <button onClick={() => {
            const ok = addPlanToDiary();
            if (ok) {
              const msg = planDays === 7 ? `📒 Неделя (${weekPlan?.days?.length || 7} дн) → дневник` : planDays === 3 ? '📒 3 дня → дневник' : '📒 День → дневник';
              // @ts-ignore
              if (typeof (window as any).showToast === 'function') (window as any).showToast(msg, 'success');
              else alert(msg);
            }
          }} style={{
            flex:1, padding:12, borderRadius:14, border:'none', cursor:'pointer',
            background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000',
            fontWeight:700, fontSize:13, boxShadow:'0 4px 16px rgba(0,230,138,0.2)',
          }}>
            {planDays === 7 ? '📒 В дневник (неделя)' : planDays === 3 ? '📒 В дневник (3 дня)' : '📒 В дневник'}
          </button>
        </div>
      )}

      {generated && (
        <GlassCard title="🏆 Достижения и сезон" icon="🏆" color="#f472b6">
          {(() => {
            const ach: { label: string; earned: boolean; icon: string }[] = [];
            try {
              const daysLogged = getDiaryLoggedDayCount();
              if (daysLogged >= 1) ach.push({ label: 'Первый день в дневнике', earned: true, icon: '📝' });
              if (daysLogged >= 7) ach.push({ label: 'Неделя дневника', earned: true, icon: '📆' });
              if (daysLogged >= 30) ach.push({ label: 'Месяц дневника', earned: true, icon: '📅' });
              const plansRaw = localStorage.getItem('he_saved_nutrition_plans');
              const plans = plansRaw ? JSON.parse(plansRaw) : [];
              if (plans.length >= 1) ach.push({ label: 'Первый сохранённый план', earned: true, icon: '💾' });
              if (plans.length >= 5) ach.push({ label: '5 планов', earned: true, icon: '📚' });
              if (localStorage.getItem('he_off_cache')) ach.push({ label: 'Сканировал штрих-код', earned: true, icon: '📷' });
            } catch {}
            const month = new Date().getMonth();
            const seasonal = [
              { months: [5,6,7,8], label: '🥒 Огурцы, помидоры, ягоды, зелень' },
              { months: [9,10], label: '🍂 Тыква, кабачки, яблоки, виноград' },
              { months: [11,12,1,2], label: '🥬 Цитрусовые, хурма, гранаты, свёкла' },
              { months: [3,4], label: '🌱 Спаржа, редис, шпинат, первая зелень' },
            ].find(s => s.months.includes(month));
            return <>
              {ach.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {ach.map(a => <span key={a.label} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.15)', color:'#f472b6' }}>{a.icon} {a.label}</span>)}
              </div>}
              {seasonal && <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', padding:'4px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>🌿 Сезонные продукты: {seasonal.label}</div>}
              {ach.length === 0 && <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)' }}>Начните вести дневник питания, чтобы получать достижения.</div>}
            </>;
          })()}
        </GlassCard>
      )}

      <button onClick={() => setShowRecipeCreator(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:9, fontWeight:600, marginTop:4 }}>
        🍳 Создать свой рецепт
      </button>
      {showRecipeCreator && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)' }}
          onClick={() => setShowRecipeCreator(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:380, maxHeight:'85vh', overflowY:'auto', padding:0, borderRadius:20, background:'#1c1c1e', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>🍳 Создать рецепт</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:2 }}>Заполните информацию о блюде</div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Название</div>
              <input value={newRecipe.name} onChange={e => setNewRecipe({...newRecipe, name: e.target.value})} placeholder="Название рецепта" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', fontWeight:500 }} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Приём и время</div>
              <div style={{ display:'flex', gap:6 }}>
                <select value={newRecipe.meal} onChange={e => setNewRecipe({...newRecipe, meal: e.target.value})} style={{ flex:1, padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', appearance:'none', fontWeight:500 }}>
                  <option value="breakfast">Завтрак</option><option value="lunch">Обед</option>
                  <option value="dinner">Ужин</option><option value="snack">Перекус</option>
                </select>
                <input type="number" min={0} value={newRecipe.prepTime} onChange={e => setNewRecipe({...newRecipe, prepTime: e.target.value === '' ? 10 : Math.max(0, +e.target.value)})} placeholder="Мин" style={{ width:80, padding:'12px 10px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:500 }} />
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>КБЖУ (на порцию)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:5 }}>
                {[{k:'kcal',l:'Ккал',c:'#22c55e'},{k:'protein',l:'Белки',c:'#3b82f6'},{k:'fat',l:'Жиры',c:'#f59e0b'},{k:'carbs',l:'Угл',c:'#f97316'}].map(f => <div key={f.k}><input type="number" min={0} value={(newRecipe as Record<string,number|string>)[f.k] as number} onChange={e => setNewRecipe({...newRecipe, [f.k]: Math.max(0, +e.target.value || 0)})} placeholder={f.l} style={{ width:'100%', padding:'14px 6px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:f.c, fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:700 }} /></div>)}
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Ингредиенты</div>
              <textarea value={newRecipe.ingredients} onChange={e => setNewRecipe({...newRecipe, ingredients: e.target.value})} placeholder="Ингредиенты (каждый с новой строки)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Приготовление</div>
              <textarea value={newRecipe.instructions} onChange={e => setNewRecipe({...newRecipe, instructions: e.target.value})} placeholder="Инструкция (каждый шаг с новой строки)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>Теги</div>
              <input value={newRecipe.tags} onChange={e => setNewRecipe({...newRecipe, tags: e.target.value})} placeholder="Теги (через запятую)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', fontSize:13 }} />
              <button onClick={() => {
                // FIX input-audit: рецепт с kcal<=0 ломал масштабирование граммовок при замене
                if (!Number.isFinite(newRecipe.kcal) || newRecipe.kcal <= 0) { setErrorMsg('Укажите калорийность рецепта больше 0'); return; }
                if (!newRecipe.name.trim()) { setErrorMsg('Укажите название рецепта'); return; }
                const recipe = { ...newRecipe, ingredients: newRecipe.ingredients.split('\n').filter(Boolean), instructions: newRecipe.instructions.split('\n').filter(Boolean), tags: newRecipe.tags.split(',').map((t: string) => t.trim()).filter(Boolean), userCreated: true };
                const updated = [...userRecipes, recipe];
                setUserRecipes(updated);
                try { localStorage.setItem('he_user_recipes', JSON.stringify(updated)); } catch {}
                setShowRecipeCreator(false);
                setNewRecipe({ name: '', meal: 'lunch', prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
              }} style={{ width:'100%', padding:'13px', borderRadius:14, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:15, fontWeight:700, letterSpacing:0.2 }}>✓ Сохранить рецепт</button>
            </div>
          </div>
        </div>
      )}

      {generated && shoppingList && (
        <GlassCard title="Список покупок" icon="🛒" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          {(() => {
            const CAT_RU: Record<string, string> = { protein:'🥩 Мясо/Рыба/Яйца', dairy:'🥛 Молочные продукты', grain:'🌾 Крупы/Хлеб', carb:'🥔 Овощи/Корнеплоды', veg_fruit:'🥦 Овощи/Фрукты', fat:'🥑 Жиры/Масла/Орехи', supplement:'💊 Спортпит', fast_food:'🍔 Фастфуд', other:'📦 Прочее' };
            const groups: Record<string, any[]> = {};
            shoppingList.forEach((item: any) => {
              const cat = CAT_RU[item.catLabel || item.category] || item.catLabel || item.category || '📦 Прочее';
              if (!groups[cat]) groups[cat] = [];
              const existing = groups[cat].find((g: any) => g.id === item.id);
              if (existing) { existing.amount += item.amount || 0; existing.packs = (existing.packs || 1) + 1; }
              else groups[cat].push({ ...item, packs: 1 });
            });
            const allItems = Object.values(groups).flat() as any[];
            const totalItems = allItems.length;
            const totalGrams = allItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);
            const pricePerKg: Record<string, number> = { low: 4, medium: 7, max: 12, enhanced: 18 };
            const estCost = Math.round(totalGrams / 1000 * (pricePerKg[budget] || 7));
            const exportText = allItems.map((i: any) => `${i.name} — ${i.amount >= 1000 ? `${(i.amount/1000).toFixed(1)} кг` : `${Math.round(i.amount)} г`}`).join('\n');
            // 🟠8 — Checked items state (already declared at top of component)
            const toggleChecked = (id: string) => { setChecked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); try { localStorage.setItem('he_shopping_checked', JSON.stringify([...n])); } catch {} return n; }); };
            const checkedCount = allItems.filter((i: any) => checked.has(i.id)).length;
            // 🟡13 — Pack estimates
            const PACK_SIZES: Record<string, number> = { chicken_breast:500, turkey_breast:500, beef_steak:400, salmon:300, cod:400, tuna:200, egg_whole:600, egg_white:500, rice_white:900, buckwheat:800, pasta:500, oatmeal:500, potato:1000, broccoli:400, cauliflower:500, carrot:1000, tomato:500, cucumber:400, spinach:200, milk:1000, yogurt_greek:500, cottage_cheese_5:250, cheese:200, butter:200, olive_oil:500, avocado:200, nuts_almonds:200, banana:1000, apple:1000, berries:300, bread_white:500, whey_isolate:1000, casein:1000, creatine:500 };
            return (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { allItems.forEach((i: any) => addToCart({ name: i.name, kcal: i.kcal || 0, amount: i.amount, category: i.catLabel || i.category })); }} style={{ flex:1, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    🛒 В корзину ({totalItems})
                  </button>
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: checkedCount === totalItems && totalItems > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(0,230,138,0.06)', border: checkedCount === totalItems && totalItems > 0 ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(0,230,138,0.15)', color: checkedCount === totalItems && totalItems > 0 ? '#22c55e' : '#00e68a', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    💰 ~{estCost * 100}₽
                  </div>
                  <button onClick={() => { try { void navigator.clipboard?.writeText(exportText).catch(() => setErrorMsg('Не удалось скопировать список покупок.')); } catch { setErrorMsg('Не удалось скопировать список покупок.'); } }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>📋</button>
                  {checkedCount > 0 && <button onClick={() => { try { localStorage.setItem('he_shopping_checked', '[]'); } catch {} setChecked(new Set()); }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#ef4444', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>✕ Сброс</button>}
                </div>
                {checkedCount > 0 && <div style={{marginBottom:6,height:4,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(checkedCount/totalItems*100)}%`,borderRadius:2,background:'#22c55e',transition:'width 0.3s'}}/></div>}
                {(shoppingList as any)._diversity && <div style={{marginBottom:6,fontSize:9,color:((shoppingList as any)._diversity.score >= 7 ? '#22c55e' : '#f59e0b'),fontWeight:600}}>🌈 Разнообразие: {((shoppingList as any)._diversity.uniqueFoods)} видов продуктов · {((shoppingList as any)._diversity.note)}</div>}
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2, padding: '2px 0 2px 4px', borderLeft: '2px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cat}
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' }}>{items.length} шт</span>
                    </div>
                    {items.map((data: any, i: number) => {
                      const isChecked = checked.has(data.id);
                      const packSize = PACK_SIZES[data.id];
                      const packEstimate = packSize ? `~${Math.max(1, Math.round(data.amount / packSize))} уп.` : '';
                      return (
                      <div key={data.name + i} style={{ fontSize: 9, padding: '3px 0 3px 8px', display: 'flex', flexDirection: 'column', gap: 1, color: isChecked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', textDecoration: isChecked ? 'line-through' : 'none', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{display:'flex',alignItems:'center',gap:4}}>
                            <span onClick={() => toggleChecked(data.id)} style={{cursor:'pointer',fontSize:11,color:isChecked?'#22c55e':'rgba(255,255,255,0.2)',userSelect:'none',width:16,textAlign:'center'}}>{isChecked ? '☑' : '☐'}</span>
                            <span>{data.name}</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {packEstimate && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{packEstimate}</span>}
                            {data.batchCook && <span title={data.batchCook} style={{ fontSize: 6, color: '#22c55e', fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>🍳{data.dayCount}д</span>}
                            <span style={{ color: isChecked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {data.amount >= 1000 ? `${(data.amount / 1000).toFixed(1)} кг` : `${Math.round(data.amount)} г`}
                            </span>
                            <button onClick={() => addToCart({ name: data.name, kcal: data.kcal || 0, amount: data.amount, category: data.catLabel || data.category })} style={{ padding: '2px 4px', borderRadius: 4, border: 'none', background: 'rgba(249,115,22,0.12)', color: '#f97316', cursor: 'pointer', fontSize: 7 }}>🛒</button>
                          </div>
                        </div>
                        {(() => {
                          const per100 = data.amount > 0 ? { kcal: Math.round((data.kcal || 0) / data.amount * 100), p: Math.round((data.p || 0) / data.amount * 100 * 10) / 10, f: Math.round((data.f || 0) / data.amount * 100 * 10) / 10, c: Math.round((data.c || 0) / data.amount * 100 * 10) / 10 } : null;
                          return (
                            <div style={{ display: 'flex', gap: 6, paddingLeft: 20, fontSize: 7, fontWeight: 500, color: isChecked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)', flexWrap: 'wrap' }}>
                              <span style={{ color: '#22c55e' }}>К:{Math.round(data.kcal || 0)} ккал</span>
                              <span style={{ color: '#3b82f6' }}>Б:{Math.round((data.p || 0) * 10) / 10}г</span>
                              <span style={{ color: '#f59e0b' }}>Ж:{Math.round((data.f || 0) * 10) / 10}г</span>
                              <span style={{ color: '#f97316' }}>У:{Math.round((data.c || 0) * 10) / 10}г</span>
                              {per100 && <span style={{ color: 'rgba(255,255,255,0.35)' }}>· на 100г: {per100.kcal}ккал Б{per100.p} Ж{per100.f} У{per100.c}</span>}
                            </div>
                          );
                        })()}
                      </div>
                      );
                    })}
                  </div>
                ))}
              </>
            );
          })()}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {generated && (Array.isArray(injections) ? injections.length : 0) > 0 && (
        <GlassCard title="Тайминг препаратов и приёмов пищи" icon="💊" color="#8b5cf6" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          {injections.map((inj: DrugInjection) => {
            const isInsulin = inj.type === 'инсулин';
            const isIGF = inj.type === 'IGF-1';
            const isGH = inj.type === 'ГР';
            const isPeptide = inj.type === 'пептид';
            const isAAS = inj.type === 'ААС';
            return (
              <div key={inj.id} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#a78bfa', marginBottom: 3 }}>
                  💉 {inj.name} ({inj.dose}{inj.unit}) — {inj.time}
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>
                    T½ {inj.halfLifeHours}ч
                    {inj.trainLinked && <span style={{ color: '#00e68a', marginLeft: 4 }}>🏋️ {inj.trainTiming === 'before' ? 'До тренировки' : inj.trainTiming === 'after' ? 'После тренировки' : 'До+После'}</span>}
                  </span>
                </div>
                {isInsulin && inj.esterType === 'rapid' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ⚡ <strong>Быстрый инсулин (аналог)</strong> — пик 30-90 мин, длительность 3-4ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Принять сразу перед едой или после. <strong>ПРОПУСК ЕДЫ = ГИПОГЛИКЕМИЯ!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). В приёме: изолят сывороточного белка + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы (изотоник/гейнер/бананы) каждые 20 мин!' : ''}
                    {!inj.trainLinked ? ' ⏰ Не ешь без углеводов — риск гипогликемии!' : ''}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> в окне действия (первые 90 мин) — не более 3-5г. Жиры замедляют опорожнение желудка и блокируют поступление глюкозы.<br />
                    🩸 <strong>Глюкоза:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель не ниже 4.0 ммоль/л.<br />
                    🍬 <strong>Экстренно:</strong> 200мл сока + 4 таблетки глюкозы при уровне {'<'}3.5 ммоль/л. 
                  </div>
                )}
                {isInsulin && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🕐 <strong>Короткий инсулин (человеческий)</strong> — пик 2-4ч, длительность 5-8ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Ввести за 20-30 мин до еды. <strong>ПРОПУСК ЕДЫ ОПАСЕН!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до+после'}). В приёме: изолят + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы каждые 20 мин!' : ''}<br />
                    🥑 <strong>Жиры {'<'}5г</strong> в окне 90 мин — иначе гипогликемия на фоне уже принятых углеводов.<br />
                    🩸 <strong>Правило 4 часов:</strong> каждый час после укола — минимум 10-15г углеводов на подержание.
                  </div>
                )}
                {isInsulin && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🌙 <strong>Длинный инсулин (базальный)</strong> — покрывает суточную потребность.<br />
                    🍚 Привязка к еде <strong>не требуется</strong>. Принимай в одно и то же время ежедневно.<br />
                    📊 Короткий инсулин считай отдельно от длинного (суточная норма + еда).<br />
                    📋 Контроль глюкозы натощак каждое утро — цель 4.0-6.0 ммоль/л.
                  </div>
                )}
                {isIGF && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>IGF-1/MGF</strong> — анаболический пептид, работает синергично с инсулином.<br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). Принимать НАТОЩАК за 30-45 мин до еды. Еда после — изолят + декстроза (МGF — натощак, локально в месте нагрузки).` : '⏰ Принимать натощак, за 30-45 мин до еды или согласно протоколу.'}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> — в комбинации с инсулином жиры критически замедляют анаболический ответ.<br />
                    🩸 <strong>Гипогликемия:</strong> IGF-1 + инсулин — риск гипо вдвойне. Глюкометр обязателен!<br />
                    🔬 <strong>MGF:</strong> активирует сателлитные клетки локально (только нагружаемая мышца). В комбинации с IGF-1 — каскад гиперплазии. Питание: глюкоза + аминокислоты (BCAA/изолят) в окне 30 мин после.
                  </div>
                )}
                {isGH && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>ГР/Пептиды</strong> — влияние на инсулин и глюкозу.<br />
                    ⏰ Натощак, за 30-60 мин до еды. Не есть углеводы 30 мин после.<br />
                    📊 Контролируй глюкозу — ГР снижает чувствительность к инсулину.
                  </div>
                )}
                {isAAS && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Короткий эфир</strong> — частая инъекция (EOD/ежедневно).<br />
                    ⏰ Привязка к еде минимальна. Следи за уровнем воды: +0.5л к норме.
                  </div>
                )}
                {isAAS && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Длинный эфир</strong> — редкая инъекция (1-2р/нед).<br />
                    ⏰ Пей 40мл/кг воды. Контролируй АД и липиды.
                  </div>
                )}
                {(inj.type === 'семаглутид' || inj.type === 'тирзепатид') && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💊 <strong>GLP-1 агонист</strong> — замедляет опорожнение желудка, подавляет аппетит.<br />
                    📏 <strong>Питание дробное:</strong> 5-6 раз/день по 100-200г. Не переедать — тошнота, рвота.<br />
                    🥑 <strong>Жиры {'<'}5г/приём</strong> — жирная пища задерживается в желудке на 4-6ч, вызывая тошноту и риск панкреатита.<br />
                    💧 <strong>Вода 30-40мл/кг</strong> — GLP-1 снижает моторику ЖКТ, риск запора. Клетчатка 25-30г/день.<br />
                    ⏰ <strong>Дни пик тошноты:</strong> первые 24-72ч после еженедельной инъекции — самые лёгкие приёмы, жиры {'<'}20г/день.<br />
                    🩸 <strong>B12 и электролиты:</strong> добавки обязательны — GLP-1 снижает всасывание через IF-фактор.<br />
                    🚫 <strong>Алкоголь</strong> — исключить полностью (панкреатит, гипогликемия).<br />
                    🚨 <strong>Боли в животе/подреберье:</strong> немедленно к врачу — исключить панкреатит.
                  </div>
                )}
                {inj.type === 'другое' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ℹ️ Следуй инструкции по препарату. При необходимости уточни тип.
                  </div>
                )}
              </div>
            );
          })}
          {injections.some((i: DrugInjection) => i.type === 'инсулин' && i.esterType !== 'long') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🚨 Чеклист гипогликемии (ОПАСНОСТЬ)</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                🩸 <strong>Глюкометр обязателен!</strong> Замеры: до, через 15, 30, 60, 90, 120 мин<br />
                🧃 <strong>Экстренный набор:</strong> 200мл сока + 3-4 таблетки глюкозы (15-20г) ВСЕГДА С СОБОЙ<br />
                🛌 <strong>Не принимать короткий инсулин после 18:00</strong> — риск ночной гипогликемии<br />
                ⏰ <strong>Каждый час после инъекции</strong> — минимум 10-15г углеводов (4-часовое окно действия)<br />
                🏋️ <strong>На тренировке:</strong> изотоник 6-8% (500-1000мл) + банан каждые 20 мин<br />
                🔴 <strong>Если глюкоза {'<'}3.5 ммоль/л:</strong> немедленно 15-20г быстрых углеводов, замер через 15 мин<br />
                🚑 <strong>Если {'<'}2.5 ммоль/л или потеря сознания:</strong> ВЫЗОВ 103! Глюкагон 1мг в/м или в/в глюкоза 40%<br />
                📋 <strong>Симптомы:</strong> потливость, дрожь, голод → спутанность, агрессия → потеря сознания, судороги<br />
                🥑 <strong>Жиры МИНИМУМ:</strong> в окне действия инсулина — не более 5г жиров за приём (жиры замедляют всасывание углеводов!)
              </div>
            </div>
          )}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>
            💡 <strong>БАЗОВЫЕ ПРАВИЛА ИНСУЛИНА:</strong><br />
            🧮 1 ЕД короткого/быстрого ≈ 10г углеводов (чувствительность индивидуальна — после курса ГР/ААС может требоваться на 20-30% больше).<br />
            🥑 <strong>ЖИРЫ МИНИМАЛЬНЫ</strong> в окне действия инсулина (первые 2ч) — не более 5г. Жиры блокируют выход глюкозы из желудка в кровь, вызывая гипогликемию при уже принятых углеводах!<br />
            🚫 <strong>НЕ ПРОПУСКАЙ ПРИЁМЫ ПИЩИ</strong> — гипогликемия развивается за 15-30 минут!<br />
            🩸 <strong>Глюкометр — твой лучший друг.</strong> Цель: 4.0-6.0 ммоль/л через 2ч после инъекции. Не выше 7.8, не ниже 3.9.<br />
            🧬 MGF активирует сателлитные клетки локально (место инъекции/тренировки). IGF-1 — системно. Оба требуют глюкозу и аминокислоты. Без еды в окне — нулевой эффект. 
          </div>
          {injections.some((i: DrugInjection) => i.type === 'семаглутид' || i.type === 'тирзепатид') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>💊 GLP-1 — справочник питания</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                📏 <strong>Дробное питание:</strong> 5-6 раз/день по 100-200г за приём. Не переполнять желудок — риск рвоты.<br />
                🥑 <strong>Жиры {'<'}5г/приём:</strong> GLP-1 замедляет опорожнение желудка — жиры задерживаются и вызывают тошноту, изжогу, риск панкреатита.<br />
                💧 <strong>Вода 30-40 мл/кг:</strong> GLP-1 снижает моторику ЖКТ — риск запоров. Клетчатка 25-30г/день дополнительно.<br />
                ⏰ <strong>График инъекций:</strong> пик тошноты — первые 24-72ч после инъекции. Планируй самые лёгкие приёмы на эти дни. Жиры в эти дни {'<'}20г/день.<br />
                🩸 <strong>Контроль B12 и электролитов:</strong> GLP-1 снижает всасывание B12 (через IF-фактор) и калия/магния — добавки обязательны.<br />
                🚨 <strong>Боли в левом подреберье/животе:</strong> прекратить приём, срочно к врачу — исключить острый панкреатит.<br />
                🚫 <strong>Алкоголь:</strong> исключить полностью — усиливает тошноту, риск гипогликемии, панкреатит.<br />
                🍬 <strong>Гипогликемия:</strong> в комбинации с инсулином — риск возрастает вдвое. Глюкометр обязателен!
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {injections.some((i: DrugInjection) => i.type === 'инсулин') && (
        <GlassCard title="📖 Справочник: Инсулин" icon="📖" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🧮 Правило 10г/1ЕД:</strong> 1 единица короткого/быстрого инсулина покрывает ~10г углеводов. Доза × 10 = необходимые углеводы.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🥑 Жиры МИНИМУМ:</strong> в окне 90 минут после инъекции — не более 5г жиров. Жиры замедляют опорожнение желудка, вызывая гипогликемию при уже принятых углеводах.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🚫 ПРОПУСК ЕДЫ КРИТИЧЕН:</strong> гипогликемия развивается за 15-30 минут. Каждый час после укола — минимум 10-15г углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🩸 Глюкометр:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель — не ниже 4.0 ммоль/л. При {'<'}3.5 — 15-20г быстрых углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🏋️ Тренировка + инсулин:</strong> предтрен — изолят (40-50г) + амилопектин (80-100г). Пост-трен — изолят + декстроза (10г/1ЕД). На тренировке изотоник каждые 20 мин.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🛑 Не на ночь:</strong> короткий инсулин после 18:00 — риск ночной гипогликемии. Длинный (Лантус/Левемир) — базальный, можно.
            </div>
          </div>
        </GlassCard>
      )}

      {generated && waterCalc && (
        <GlassCard title="Водный баланс" icon="💧" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
              <span>База: {waterCalc.hasPharma ? (waterCalc.pharmaBaseMl || 40) : '30'} мл × {weight} кг</span>
              <span>{waterCalc.baseWater} л</span>
            </div>
            {waterCalc.hasPharma && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Фармакология (повышенный метаболизм)</span>
                <span>+{waterCalc.pharmaBonus.toFixed(1)} л</span>
              </div>
            )}
            {waterCalc.trainBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Тренировка</span>
                <span>+{waterCalc.trainBonus} л</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
              <span>+ Клетчатка</span>
              <span>+{waterCalc.fiberFactor} л</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#06b6d4', textAlign: 'center', marginTop: 6 }}>
            {waterCalc.total} л/день
          </div>
        </GlassCard>
      )}

      {generated && healthIssues.length > 0 && (
        <GlassCard title="🩺 Здоровье — активные ограничения" icon="" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          {HEALTH_ISSUES.filter(h => healthIssues.includes(h.id)).map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', marginBottom:4, borderRadius:10, background:'rgba(6,182,212,0.06)', border:'1px solid rgba(6,182,212,0.1)' }}>
              <div style={{ fontSize:16, width:28, textAlign:'center' }}>{h.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#06b6d4' }}>{h.label}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{h.desc} — Исключено {h.foodIds.length} продуктов</div>
              </div>
              <div style={{ fontSize:9, color:'rgba(6,182,212,0.6)', background:'rgba(6,182,212,0.1)', padding:'2px 6px', borderRadius:6 }}>{h.foodIds.length}</div>
            </div>
          ))}
        </GlassCard>
      )}

      {generated && (
        <GlassCard title="Отчёты по рациону" icon="📊" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            <button onClick={generateAllergenReport} style={reportPillStyle('#ef4444', activeReports.includes('allergen') && !!allergenReport)}>⚠️ Аллергены</button>
            <button onClick={generateNutrientReport} style={reportPillStyle('#22c55e', activeReports.includes('nutrient') && !!nutrientReport)}>🧬 Нутриенты</button>
            {plannerMode === 'pro' && <button onClick={generateQualityReport} style={reportPillStyle('#f59e0b', activeReports.includes('quality') && !!qualityReport)}>⭐ Качество</button>}
            <button onClick={generateRiskReport} style={reportPillStyle('#ef4444', activeReports.includes('risk') && !!riskReport)}>🩺 Риски здоровья</button>
              {(Array.isArray(injections) ? injections.length : 0) > 0 && <button onClick={generateDrugCompatReport} style={reportPillStyle('#8b5cf6', activeReports.includes('drug') && !!drugCompatReport)}>💉 Совместимость</button>}
            <button onClick={generateFullNutritionReport} style={reportPillStyle('#3b82f6', activeReports.includes('nutrition') && !!nutritionReport)}>📋 Полный отчёт</button>
            <button onClick={() => {
              // P2-fix: проверка dayPlan перед массовой генерацией отчётов
              if (!dayPlan) { setErrorMsg('Сначала создайте план питания.'); return; }
              generateAllergenReport();
              generateNutrientReport();
              if (plannerMode === 'pro') generateQualityReport();
              generateRiskReport();
              if ((Array.isArray(injections) ? injections.length : 0) > 0) generateDrugCompatReport();
              generateRecommendations();
            }} style={reportPillStyle('#3b82f6', activeReports.length >= 3)}>📋 Общий отчёт</button>
          </div>
          {allergenReport && activeReports.includes('allergen') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: allergenReport.riskLevel === 'high' ? 'rgba(239,68,68,0.06)' : allergenReport.riskLevel === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e' }}>
                {allergenReport.summary}
              </div>
              {allergenReport.conflicts.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>
                  • {c.food}: {c.allergens.join(', ')}
                </div>
              ))}
            </div>
          )}
          {nutrientReport && activeReports.includes('nutrient') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🧬 Микронутриенты</div>
              {Object.entries(nutrientReport.micros).slice(0, 10).map(([k, v]: [string, any]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '1px 0', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>
                    {v.actual} / {v.target} ({v.pct}%)
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {nutrientReport.gaps.join('; ')}
              </div>
            </div>
          )}
          {plannerMode === 'pro' && qualityReport && activeReports.includes('quality') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3, flexWrap:'wrap', gap:4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: qualityReport.budgetOk ? '#22c55e' : '#f59e0b' }}>
                  ⭐ Скор продуктов (bb_quality): {qualityReport.avgScore}/10
                </div>
                <div style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background: qualityReport.budgetOk ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: qualityReport.budgetOk ? '#22c55e' : '#f59e0b' }}>
                  {qualityReport.budgetRange} · bb_quality {qualityReport.bbsAvg}
                </div>
              </div>
              {/* Эпик 4а: ЕДИНЫЙ скор дня — тот же, что в карточке «Качество дня» выше */}
              {typeof qualityReport.dayScore === 'number' && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:999, marginBottom:3,
                  background: (qualityReport.dayStatus === 'green' ? 'rgba(34,197,94,0.10)' : qualityReport.dayStatus === 'yellow' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)'),
                  border: `1px solid ${qualityReport.dayStatus === 'green' ? 'rgba(34,197,94,0.2)' : qualityReport.dayStatus === 'yellow' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: qualityReport.dayStatus === 'green' ? '#86efac' : qualityReport.dayStatus === 'yellow' ? '#fbbf24' : '#fca5a5' }}>
                  🩺 Скор дня: {qualityReport.dayScore}/100 ({qualityReport.dayStatus === 'green' ? 'отлично' : qualityReport.dayStatus === 'yellow' ? 'норма' : 'внимание'})
                </div>
              )}
              {qualityReport.bestItems.length > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Лучшие: {qualityReport.bestItems.join(', ')}</div>}
              {qualityReport.weakItems.length > 0 && <div style={{ fontSize: 8, color: '#ef4444' }}>Слабые: {qualityReport.weakItems.join(', ')}</div>}
              {qualityReport.recommendations.map((r: string, i: number) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>• {r}</div>)}
            </div>
          )}
          {riskReport && activeReports.includes('risk') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: riskReport.totalRisk === 'Низкий' ? '#22c55e' : riskReport.totalRisk === 'Средний' ? '#f59e0b' : '#ef4444' }}>
                🩺 Общий риск: {riskReport.totalRisk}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{riskReport.summary}</div>
              {Object.entries(riskReport.systems).map(([sys, data]: [string, any]) => (
                <div key={sys} style={{ fontSize: 8, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: data.score >= 5 ? '#ef4444' : data.score >= 3 ? '#f59e0b' : '#22c55e' }}>
                      {sys === 'hepatic' ? 'Печень' : sys === 'renal' ? 'Почки' : sys === 'inflammatory' ? 'Воспаление' : sys === 'insulin' ? 'Инсулин' : 'Электролиты'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>⚠ {data.score}/7</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{data.impact}</div>
                  {data.score >= 3 && <div style={{ color: '#f59e0b' }}>→ {data.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
          {dayPlan && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', marginBottom: 3 }}>🍬 Гликемическая нагрузка</div>
              {(() => {
                // P1-fix: null guard на dayPlan.meals — был crash при meals=null
                const items = (Array.isArray(dayPlan.meals) ? dayPlan.meals : []).flatMap((m: any) => m.items || []);
                const gl = Math.round(items.reduce((sum: number, it: any) => {
                  const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
                  if (!food?.gi) return sum;
                  const amountRatio = (it.amount || 100) / 100;
                  const availableCarbs = Math.max(0, (food.carbs || 0) - (food.fiber || 0)) * amountRatio;
                  return sum + availableCarbs * food.gi / 100;
                }, 0));
                const carbItems = items.filter((it: any) => {
                  const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
                  return food?.gi && (food.carbs || 0) > 0;
                });
                const avgGI = carbItems.length > 0 ? Math.round(carbItems.reduce((sum: number, it: any) => {
                  const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
                  return sum + (food?.gi || 0);
                }, 0) / carbItems.length) : 0;
                const totalCarbs = dayPlan.totals?.c || 0;
                const glPerMeal = dayPlan.meals?.length > 0 ? Math.round(gl / dayPlan.meals.length) : 0;
                const glLabel = gl <= 80 ? 'Низкая' : gl <= 120 ? 'Средняя' : 'Высокая';
                const glColor = gl <= 80 ? '#22c55e' : gl <= 120 ? '#f59e0b' : '#ef4444';
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Общий ГН (расчётный):</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: glColor }}>{gl} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)' }}>({glLabel})</span></span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)' }}>
                      Средний ГИ рациона: ~{avgGI} · ГН на приём: ~{glPerMeal} · Углеводы: {Math.round(dayPlan.totals?.c || 0)}г
                    </div>
                    {gl > 120 && <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>💡 Высокая нагрузка — рекомендуется увеличить долю низко-ГИ продуктов (бобовые, цельнозерновые, овощи)</div>}
                  </div>
                );
              })()}
            </div>
          )}
          {drugCompatReport && activeReports.includes('drug') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>💉 Совместимость с препаратами</div>
              {drugCompatReport.interactions.map((int: any, i: number) => (
                <div key={i} style={{ fontSize: 8, padding: '2px 0', color: int.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                  • {int.drug} + {int.food}: {int.effect}
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
                {drugCompatReport.warnings.join('; ')}
              </div>
            </div>
          )}
          {nutritionReport && activeReports.includes('nutrition') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>📋 Полный отчёт о питании</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: nutritionReport.overallGrade === 'A' ? '#22c55e' : nutritionReport.overallGrade === 'B' ? '#8b5cf6' : nutritionReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{nutritionReport.overallGrade}</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{nutritionReport.overallGradeLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
                {[{l:'Ккал',v:nutritionReport.kbjuPct.kcal},{l:'Белки',v:nutritionReport.kbjuPct.p},{l:'Жиры',v:nutritionReport.kbjuPct.f},{l:'Угл.',v:nutritionReport.kbjuPct.c}].map((s: any) => (
                  <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:4, padding:'3px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                    <div style={{ fontSize:11, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ flex: 1, background: 'rgba(59,130,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Вес/нед</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.weightDynamicsBasic.direction === 'loss' ? '#22c55e' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                    {nutritionReport.weightDynamicsBasic.direction === 'loss' ? '−' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}{nutritionReport.weightDynamicsBasic.weeklyKg} кг
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(139,92,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Качество</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{nutritionReport.foodQualityScore}/10</div>
                </div>
              </div>
              {nutritionReport.microDeficiencies.length > 0 && <div style={{ fontSize: 7, color: '#f59e0b', marginBottom: 2 }}>⚠ {nutritionReport.microDeficiencies.length} дефицитов: {nutritionReport.microDeficiencies.slice(0, 3).join('; ')}</div>}
              {nutritionReport.recommendations.length > 0 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>💡 {nutritionReport.recommendations.slice(0, 2).join(' • ')}</div>}
            </div>
          )}
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>⚡ Специальные режимы</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCheatMeal()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍔 Читмил
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Один приём пищи с повышенной калорийностью</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCarbload()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍚 Углев. загрузка
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Повышение углеводов на 1-2 дня</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateBUTCH()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', color:'#3b82f6', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              ⤴️⤵️ БУЧ
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Белково-углеводное чередование</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCravingPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: cravingMode ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: cravingMode ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)', color: cravingMode ? '#ef4444' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍬 Хочу сладкое
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Сладкий перекус на {cravingDays} {cravingDays === 1 ? 'день' : 'дня'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateLazyDayPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: lazyDayMode ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', border: lazyDayMode ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)', color: lazyDayMode ? '#f59e0b' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🛋 Ленивый день
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Минимум готовки, {lazyDayDays} {lazyDayDays === 1 ? 'день' : 'дней'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => setSpecialMealMode(!specialMealMode)} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: specialMealMode ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)', border: specialMealMode ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)', color: specialMealMode ? '#f97316' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍽️ Спецприём
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Приём с заданными макросами</div>
          </div>
        </div>
      </div>

      {cravingPlan && (
        <GlassCard title="Хочу сладкое" icon="🍬" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>~{cravingPlan.kcal} ккал ({cravingPlan.days} {cravingPlan.days === 1 ? 'день' : 'дня'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cravingPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cravingPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{cravingPlan.bju.c}г</div>
            </div>
          </div>
          {(Array.isArray(cravingPlan.items) ? cravingPlan.items : []).map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:9, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cravingPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#ef4444', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.note}</div>
        </GlassCard>
      )}

      {lazyDayPlan && (
        <GlassCard title="Ленивый день" icon="🛋️" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{lazyDayPlan.kcal} ккал (85% от нормы, {lazyDayPlan.days} {lazyDayPlan.days === 1 ? 'день' : 'дней'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{lazyDayPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.c}г</div>
            </div>
          </div>
          {(Array.isArray(lazyDayPlan.items) ? lazyDayPlan.items : []).map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:9, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {lazyDayPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.note}</div>
        </GlassCard>
      )}

      {cheatMealPlan && (
        <GlassCard title="Читмил" icon="🍔" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{cheatMealPlan.cals} ккал (35% от нормы)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cheatMealPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cheatMealPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{cheatMealPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>{cheatMealPlan.bjuBreakdown}</div>
          {(Array.isArray(cheatMealPlan.items) ? cheatMealPlan.items : []).map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || (cheatMealPlan.cals / cheatMealPlan.items.length), amount: 100 })} style={{ cursor:'pointer', fontSize:9, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cheatMealPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="Углеводная загрузка" icon="🍚" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>Всего: {carbloadPlan.totalCarbs} г ({Math.round(carbloadPlan.totalCarbs / Math.max(1, weight || 80))} г/кг)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{carbloadPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{carbloadPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{carbloadPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>~{carbloadPlan.bju.kcal} ккал всего</div>
          {(Array.isArray(carbloadPlan.foods) ? carbloadPlan.foods : []).map((f: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {f.name || f}</span>
              <span onClick={() => addToCart({ name: f.name || f, kcal: f.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:9, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f97316', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {carbloadPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)' }}>{carbloadPlan.note}</div>
        </GlassCard>
      )}

      {specialMealMode && (() => {
        const p = specialMealProteinG; const f = specialMealFatG; const c = specialMealCarbsG;
        const kcal = p * 4 + f * 9 + c * 4;
        const suggestFoods = (): { id: string; name: string; amount: string }[] => {
          const picks: { id: string; g: number }[] = [];
          if (p > 20) picks.push({ id: 'chicken_breast', g: Math.round(p / 31 * 100) });
          else picks.push({ id: 'egg_whole', g: Math.round(p / 13 * 60) });
          if (f > 10) picks.push({ id: 'salmon', g: Math.round(f / 13 * 100) });
          if (c > 30) picks.push({ id: 'rice_white', g: Math.round(c / 28 * 100) });
          else if (c > 10) picks.push({ id: 'buckwheat', g: Math.round(c / 30 * 100) });
          if (specialMealGoal === 'pre_workout' || specialMealGoal === 'post_workout') picks.push({ id: 'whey', g: 30 });
          if (specialMealGoal === 'before_bed') picks.push({ id: 'cottage_cheese', g: Math.round(p / 18 * 100) });
          if (specialMealGoal === 'keto' && f > 20) picks.push({ id: 'avocado', g: Math.round(f / 15 * 100) });
          return picks.map(pk => {
            const food = FOOD_DB.find(x => x.id === pk.id);
            return { id: pk.id, name: food?.name || pk.id, amount: pk.g + 'г' };
          });
        };
        const suggested = suggestFoods();
        return (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)', marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>🍽️ Спецприём{specialMealReplaceMode ? ` (замена: ${specialMealReplaceTarget})` : ' (дополнительно)'}</span>
            <span onClick={() => setSpecialMealMode(false)} style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>✕</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
            {specialMealGoal === 'pre_workout' ? '🏋️ Предтренировочный приём' :
             specialMealGoal === 'post_workout' ? '💪 Послетренировочный приём' :
             specialMealGoal === 'before_bed' ? '🌙 Приём на ночь (медленный белок)' :
             specialMealGoal === 'high_protein' ? '🥩 Высокобелковый приём' :
             specialMealGoal === 'keto' ? '🥑 Кето-приём' :
             specialMealGoal === 'low_cal_day' ? '📉 Низкокалорийный приём' : '⚙️ Свой приём'}
            · {specialMealTiming === 'breakfast' ? '🌅 Завтрак' : specialMealTiming === 'lunch' ? '🍽️ Обед' : specialMealTiming === 'dinner' ? '🌆 Ужин' : specialMealTiming === 'snack' ? '🍪 Перекус' : '🌙 Перед сном'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🥩 Белок</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{p}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🧈 Жиры</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{f}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🍚 Углеводы</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{c}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🔥 Ккал</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{kcal}</div>
            </div>
          </div>
          {suggested.length > 0 && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>🍽️ Рекомендуемые продукты:</div>
              {suggested.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.7)', padding: '2px 0' }}>
                  <span>{s.name}</span>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{s.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {butchPlan && (
        <GlassCard title="БУЧ (белково-углеводное чередование)" icon="⤴️⤵️" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>📋 {butchPlan.pattern}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>ВУ (тренировка)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{butchPlan.highCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↓ жиры {butchPlan.fatHigh}г</div>
              </div>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>НУ (отдых)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{butchPlan.lowCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↑ жиры {butchPlan.fatLow}г</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginBottom: 4 }}>
              ВУ: {butchPlan.bjuHigh.kcal} ккал · НУ: {butchPlan.bjuLow.kcal} ккал
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
              {butchPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)' }}>{butchPlan.note}</div>
          </div>
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>🎯 Расширенные инструменты</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={generateRecommendations} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)', color:'#a855f7', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              💡 Выдать рекомендации
            </button>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Персональные советы по питанию</div>
          </div>
          {generated && dayPlan && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
              <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                {([1, 3, 7] as const).map(n => (
                  <button key={n} onClick={() => setMealPrepDays(n)} style={{
                    flex:1, padding:'5px', borderRadius:6, cursor:'pointer', textAlign:'center',
                    background: mealPrepDays === n ? 'rgba(6,182,212,0.15)' : 'transparent',
                    border: mealPrepDays === n ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: mealPrepDays === n ? '#06b6d4' : 'rgba(255,255,255,0.6)',
                    fontWeight:600, fontSize:9,
                  }}>
                    {n === 1 ? '1 день' : n === 3 ? '3 дня' : 'Неделя'}
                  </button>
                ))}
              </div>
              <button onClick={generateMealPrep} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.2)', color:'#06b6d4', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
                👨‍🍳 Meal Prep
              </button>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>План приготовления на несколько дней</div>
            </div>
          )}
          {generated && dayPlan?.meals?.some((m: any) => m.recipeApplied) && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(249,115,22,0.06)', padding:'8px 6px', textAlign:'center' }}>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={() => printDayReport(buildRecipePlanPrintHtml(dayPlan))} title="Ингредиенты и пошаговые инструкции выбранных рецептов" style={{ flex:1, padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:'#fb923c', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
                  🖨 Печать меню
                </button>
                <button onClick={() => {
                  try {
                    const html = buildCoachExportHtml({
                      dateIso: new Date().toISOString().slice(0, 10),
                      totals: dayPlan.totals || { kcal: 0, p: 0, f: 0, c: 0 },
                      goals: { kcal: effectiveKcal || 0, p: effectiveP || 0, f: effectiveF || 0, c: effectiveC || 0 },
                      isTrainingDay: !!dayPlan.isTrainingDay,
                      meals: dayPlan.meals || [],
                      shopping: (shoppingList as any[])?.filter((s: any) => s.id !== 'unknown_x') || [],
                      notes: [...(dayPlan.proNotes || []), ...(dayPlanNotes ? [`💬 ${dayPlanNotes}`] : [])],
                    });
                    const ok = downloadCoachExport(html, `plan-coach-${new Date().toISOString().slice(0, 10)}.html`);
                    if (typeof (window as any).showToast === 'function') (window as any).showToast(ok ? '📤 Файл для тренера скачан' : 'Не удалось скачать файл', ok ? 'success' : 'warning');
                  } catch {}
                }} title="План + рецепты + закупки одним HTML-файлом" style={{ flex:1, padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', color:'#60a5fa', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
                  📤 Файл тренеру
                </button>
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Рецепты дня на печать · план+закупки файлом</div>
            </div>
          )}
          {generated && plannerMode === 'pro' && (
            <>
            <div style={{ background:'rgba(139,92,246,0.04)', borderRadius:10, padding:'8px 10px', border:'1px solid rgba(139,92,246,0.08)', marginBottom:6 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#8b5cf6', marginBottom:3 }}>🧬 v2 Скоринг — что это?</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.4 }}>
                <b>BB Quality Score (1-10)</b> — статический рейтинг качества продукта для бодибилдинга на основе макронутриентов, аминокислот и клетчатки.<br/>
                <b>Overall Dietary Score</b> — динамический рейтинг с учётом фазы (набор/сушка/ПКТ), фармакологии (ААС, инсулин, HGH, диуретики), анализов крови (гематокрит, липиды, печень, CRP) и тайминга приёма.<br/>
                <b>Почему дублируются кнопки?</b> Скоринг анализирует рацион в целом, а не отдельные приёмы. Кнопка «Рассчитать полезность» запускает общий анализ. Кнопка DIAAS на карточке приёма — показывает усвояемость белка конкретного приёма.
              </div>
            </div>
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(0,230,138,0.05)', padding:'8px 6px', textAlign:'center' }}>
              <button onClick={() => { setShowCalcPopup(true); setCalcResults(null); setCalcDailyReport(null); }} style={{ width:'100%', padding:'12px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,160,0.12))', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:800, fontSize:11, transition:'all 0.15s' }}>
                🧬 Рассчитать полезность
              </button>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>v2 скоринг выбранных приёмов + спецприёмов</div>
            </div>
            </>
          )}
          {generated && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(249,115,22,0.05)', padding:'8px 6px', textAlign:'center' }}>
              <button onClick={() => { setShowCorrectPopup(true); analyzePlanIssues(); }} style={{ width:'100%', padding:'12px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(245,158,11,0.12))', border:'1px solid rgba(249,115,22,0.3)', color:'#f97316', fontWeight:800, fontSize:11, transition:'all 0.15s' }}>
                🔀 Корректировка рациона
              </button>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Анализ недочётов + замена продуктов + перегенерация</div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <GlassCard title="Рекомендации" icon="💡" color="#a855f7" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
          {recommendations.map((r: string, i: number) => (
            <div key={i} style={{ fontSize: 9, color: '#fff', padding: '4px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', lineHeight: 1.4 }}>
              • {r}
            </div>
          ))}
        </GlassCard>
      )}

      {mealPrepPlan && (
        <GlassCard title="План готовки" icon="👨‍🍳" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>
            <span>⏱ {mealPrepPlan.totalTime} мин</span>
            <span>📦 {mealPrepPlan.containers} контейнеров</span>
          </div>
          {mealPrepPlan.steps.map((st: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>Шаг {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>{st.duration} мин</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {st.items.map((item: string, j: number) => <span key={j} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)', color: 'rgba(255,255,255,0.85)' }}>{item}</span>)}
              </div>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {savedPlans.length > 0 && (
        <GlassCard title="Сохранённые планы" icon="📂" color="#8b5cf6">
          {savedPlans.slice(0, 10).map((p: any, pi: number) => {
            const isExpanded = p.id === (expandedSavedId as any);
            return (
              <div key={p.id} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'rgba(139,92,246,0.04)' : '#202023' }}
                  onClick={() => setExpandedSavedId(isExpanded ? null : p.id)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{p.name || p.date}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                     <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600 }}>{p.dayPlan ? `${Math.round(p.dayPlan.totals?.kcal || 0)} ккал` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); loadSavedPlan(p); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 600 }}>📋</button>
                     <button onClick={(e) => { e.stopPropagation(); const txt = `🍽 План питания ${p.name || p.date}\n${p.dayPlan?.meals?.map((m: any) => `${m.time} ${m.label}: ${m.items?.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}`).join('\n') || ''}`; try { void navigator.clipboard?.writeText(txt).catch(() => setErrorMsg('Не удалось скопировать сохранённый план.')); } catch { setErrorMsg('Не удалось скопировать сохранённый план.'); } }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontWeight: 600 }}>📤</button>
                     <button onClick={(e) => { e.stopPropagation(); const updated = savedPlans.filter((_: any, j: number) => j !== pi); setSavedPlans(updated); try { localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); } catch {} }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>✕</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {p.dayPlan && (
                      <div>
                         <div style={{ fontWeight: 700, color: '#00e68a', marginBottom: 4, fontSize: 9 }}>🍽 План на день: {Math.round(p.dayPlan.totals?.kcal || 0)} ккал</div>
                        {p.dayPlan.meals?.map((m: any, mi: number) => (
                          <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{m.time}</span>
                            <span style={{ fontWeight: 600, color: '#00e68a' }}>{m.label}:</span>
                            <span>{m.items?.map((it: any) => it.name).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.shoppingList && p.shoppingList.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>🛒 {p.shoppingList.length} продуктов</span>
                      </div>
                    )}
                    {p.waterCalc && <div style={{ marginTop: 2, color: '#06b6d4', fontWeight: 600 }}>💧 {p.waterCalc.total} л/день</div>}
                  </div>
                )}
              </div>
            );
          })}
        </GlassCard>
      )}

      {importModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', padding: 16 }} onClick={() => setImportModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, padding: 18, borderRadius: 16, background: 'linear-gradient(135deg,#1a1c26,#18181b)', border: '1px solid rgba(249,115,22,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f97316', marginBottom: 4 }}>📥 Импорт плана</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Вставьте JSON плана (кнопка «📤 Копировать» выше)</div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              autoFocus
              rows={6}
              placeholder='{"meals": [...]}'
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, fontFamily: 'monospace', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setImportModalOpen(false); setImportText(''); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => { if (doImportPlan(importText)) { setImportModalOpen(false); setImportText(''); } }} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Импортировать</button>
            </div>
          </div>
        </div>
      )}

      {showCalcPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', background:'rgba(0,0,0,0.9)' }}
          onClick={() => { setShowCalcPopup(false); setCalcResults(null); setCalcDailyReport(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#00e68a' }}>🧬 Калькулятор полезности</div>
              <span onClick={() => { setShowCalcPopup(false); setCalcResults(null); setCalcDailyReport(null); }} style={{ cursor:'pointer', fontSize:10, color:'rgba(255,255,255,0.9)', padding:'2px 6px' }}>✕</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'0 12px 80px' }}>

            {/* Tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:10 }}>
              {['day','week','month'].map(t => (
                <button key={t} onClick={() => setCalcTab(t as any)} style={{
                  flex:1, padding:'8px', borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:9, fontWeight:700,
                  background: calcTab === t ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
                  border: calcTab === t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  color: calcTab === t ? '#00e68a' : 'rgba(255,255,255,0.7)',
                }}>{t === 'day' ? '📅 День' : t === 'week' ? '📆 Неделя' : '🗓 Месяц'}</button>
              ))}
            </div>

            {/* Day view */}
            {calcTab === 'day' && (
              <>
                {planDays !== 1 ? (
                  <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>Выберите день (нажмите на день недели сверху) и сгенерируйте план на 1 день</div>
                ) : dayPlan ? (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4, display:'flex', justifyContent:'space-between' }}>
                      <span>🍽 Приёмы пищи</span>
                      <span onClick={() => { const all: string[] = (Array.isArray(dayPlan.meals) ? dayPlan.meals : []).map((_: any, i: number) => `meal_${i}`); const next = new Set(calcSelections); all.forEach((id: string) => next.add(id)); setCalcSelections(next); }} style={{ cursor:'pointer', fontSize:10, color:'#00e68a', fontWeight:600 }}>Выбрать все</span>
                    </div>
                    {(Array.isArray(dayPlan.meals) ? dayPlan.meals : []).map((m: any, i: number) => {
                      const id = `meal_${i}`;
                      const sel = calcSelections.has(id);
                      return (
                        <div key={id} onClick={() => toggleCalcSelection(id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 9px', borderRadius:8, marginBottom:3, background: sel ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                          <div style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', background: sel ? '#00e68a' : 'rgba(255,255,255,0.06)', color: sel ? '#000' : 'transparent', fontSize:11, fontWeight:800, border: sel ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{sel ? '✓' : ''}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{m.label || `Приём ${i+1}`} {m.time && <span style={{ color:'rgba(255,255,255,0.9)', fontWeight:400, marginLeft:3 }}>{m.time}</span>}</div>
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>{Math.round(m.totals?.kcal || 0)} ккал · Б{m.totals?.p||0}/Ж{m.totals?.f||0}/У{m.totals?.c||0} · {m.items?.length || 0} продуктов</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>Сначала сгенерируйте план питания</div>
                )}

                {/* Special meals */}
                {(cheatMealPlan || carbloadPlan || lazyDayPlan || cravingPlan) && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>⚡ Спецприёмы</div>
                    {[
                      { id:'special_cheatmeal', label:'🍔 Читмил', desc: cheatMealPlan ? `~${cheatMealPlan.cals} ккал` : '', plan: cheatMealPlan },
                      { id:'special_carbload', label:'🍚 Углев. загрузка', desc: carbloadPlan ? `${carbloadPlan.totalCarbs}г углей` : '', plan: carbloadPlan },
                      { id:'special_lazy', label:'🛋 Ленивый день', desc: lazyDayPlan ? `~${lazyDayPlan.kcal} ккал` : '', plan: lazyDayPlan },
                      { id:'special_craving', label:'🍬 Хочу сладкое', desc: cravingPlan ? `~${cravingPlan.kcal} ккал` : '', plan: cravingPlan },
                    ].filter(s => s.plan).map(s => {
                      const sel = calcSelections.has(s.id);
                      return (
                        <div key={s.id} onClick={() => toggleCalcSelection(s.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 9px', borderRadius:8, marginBottom:3, background: sel ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                          <div style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', background: sel ? '#00e68a' : 'rgba(255,255,255,0.06)', color: sel ? '#000' : 'transparent', fontSize:11, fontWeight:800, border: sel ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{sel ? '✓' : ''}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{s.label}</div>
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)' }}>{s.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Week/Month view */}
            {calcTab !== 'day' && (
              <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>
                {calcTab === 'week' ? '📆 Выберите день на вкладке "День" для поимённого выбора приёмов' : '🗓 Выберите день на вкладке "День"'}
                <div style={{ fontSize:10, marginTop:4, color:'rgba(255,255,255,0.2)' }}>Недельный/месячный расчёт доступен через выбор каждого дня отдельно</div>
              </div>
            )}

            {/* Calculate button */}
            <button onClick={handleCalcUsefulness} disabled={calcSelections.size === 0} style={{
              width:'100%', padding:'12px', borderRadius:12, cursor: calcSelections.size === 0 ? 'default' : 'pointer', textAlign:'center',
              background: calcSelections.size === 0 ? 'rgba(0,230,138,0.05)' : 'linear-gradient(135deg,#00e68a,#00c8a0)',
              border: calcSelections.size === 0 ? '1px solid rgba(0,230,138,0.1)' : 'none',
              color: calcSelections.size === 0 ? 'rgba(0,230,138,0.4)' : '#000',
              fontSize:11, fontWeight:800, opacity: calcSelections.size === 0 ? 0.4 : 1, transition:'all 0.15s',
            }}>
              🔬 Рассчитать выбранное ({calcSelections.size})
            </button>

            {/* Results */}
            {calcResults && calcResults.length > 0 && (
              <div style={{ marginTop:12, borderTop:'1px solid rgba(0,230,138,0.1)', paddingTop:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📊 Результаты</div>
                {/* Summary row */}
                <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(0,230,138,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>Приёмов</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{calcResults.length}</div>
                  </div>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(139,92,246,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>Ср. скор</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#8b5cf6' }}>{(calcResults.reduce((s, r) => s + r.score.compositeScore, 0) / calcResults.length).toFixed(1)}</div>
                  </div>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(245,158,11,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>Всего ккал</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>{calcResults.reduce((s, r) => s + r.score.macros.kcal, 0)}</div>
                  </div>
                </div>

                {/* Per-meal results */}
                {calcResults.map((r, i) => {
                  const sc = r.score;
                  const grade = sc.compositeScore >= 8 ? 'A' : sc.compositeScore >= 6 ? 'B' : sc.compositeScore >= 4 ? 'C' : 'D';
                  const gradeColor = grade === 'A' ? '#00e68a' : grade === 'B' ? '#8b5cf6' : grade === 'C' ? '#f59e0b' : '#ef4444';
                  const color = gradeColor;
                  const totalKcal = sc.macros.protein * 4 + sc.macros.fat * 9 + sc.macros.carbs * 4;
                  const totalW = sc.productScores.reduce((s: number, p: any) => s + (p.weightG || 0), 0);
                  const pctP = totalKcal > 0 ? Math.round(sc.macros.protein * 4 / totalKcal * 100) : 0;
                  const pctF = totalKcal > 0 ? Math.round(sc.macros.fat * 9 / totalKcal * 100) : 0;
                  const pctC = totalKcal > 0 ? Math.round(sc.macros.carbs * 4 / totalKcal * 100) : 0;
                  const kcalPerG = totalW > 0 ? (totalKcal / totalW).toFixed(1) : '—';
                  const bestItems = sc.productScores.filter((p: any) => p.score >= 7).map((p: any) => p.name);
                  const weakItems = sc.productScores.filter((p: any) => p.score < 4).map((p: any) => p.name);
                  return (
                    <div key={r.id} style={{ marginBottom:6, borderRadius:10, padding:10, background:'rgba(24,24,27,0.8)', border:`1px solid ${color}20` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{r.name}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                            background:`${gradeColor}18`, border:`2px solid ${gradeColor}`, fontSize:12, fontWeight:800, color:gradeColor }}>{grade}</div>
                          <span style={{ fontSize:11, fontWeight:800, color }}>{sc.compositeScore.toFixed(1)}</span>
                          <span style={{ fontSize:6, color, opacity:0.6 }}>{sc.label}</span>
                        </div>
                      </div>
                      {/* Full macros grid */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, marginBottom:6 }}>
                        {[
                          ['🔥','Ккал',`${totalKcal} ккал`, '#fff'],
                          ['🥩','Белок',`${sc.macros.protein}г`,'#22c55e'],
                          ['🧈','Жиры',`${sc.macros.fat}г`,'#f59e0b'],
                          ['🍚','Углеводы',`${sc.macros.carbs}г`,'#3b82f6'],
                          ['🌾','Клетчатка',`${sc.macros.fiber}г`,'#22c55e'],
                          ['⚖️','Вес',`${totalW}г`,'rgba(255,255,255,0.8)'],
                          ['📊','Ккал/г',kcalPerG,'rgba(255,255,255,0.8)'],
                          ['💪','DIAAS',`${r.diaas.diaas.toFixed(2)}`,'#8b5cf6'],
                        ].map(([icon, label, val, c]) => (
                          <div key={label} style={{ padding:'3px 5px', borderRadius:5, background:'rgba(255,255,255,0.02)' }}>
                            <div style={{ fontSize:6, color:'rgba(255,255,255,0.8)' }}>{icon} {label}</div>
                            <div style={{ fontSize:9, fontWeight:700, color:c }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      {/* PFC ratio bar */}
                      <div style={{ marginBottom:6 }}>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>БЖУ %</div>
                        <div style={{ display:'flex', gap:3, height:5, borderRadius:3, overflow:'hidden' }}>
                          <div style={{ flex:pctP, background:'#22c55e' }} />
                          <div style={{ flex:pctF, background:'#f59e0b' }} />
                          <div style={{ flex:pctC, background:'#3b82f6' }} />
                        </div>
                        <div style={{ display:'flex', gap:6, marginTop:1, fontSize:6, color:'rgba(255,255,255,0.8)' }}>
                          <span>🥩 {pctP}%</span>
                          <span>🧈 {pctF}%</span>
                          <span>🍚 {pctC}%</span>
                        </div>
                      </div>
                      {/* Quality breakdown */}
                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginBottom:4 }}>
                        {bestItems.length > 0 && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#22c55e' }}>✅ {bestItems.join(', ')}</span>}
                        {weakItems.length > 0 && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>⚠️ {weakItems.join(', ')}</span>}
                      </div>
                      {/* Modifiers */}
                      {sc.modifiers.length > 0 && (
                        <div style={{ marginBottom:4 }}>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>🧬 Факторы:</div>
                          {sc.modifiers.map((m: any, mi: number) => (
                            <div key={mi} style={{ fontSize:10, padding:'2px 5px', marginBottom:1, borderRadius:4, background: m.value > 0 ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)', color: m.value > 0 ? '#22c55e' : '#ef4444' }}>
                              {m.name} <b>({m.value > 0 ? '+' : ''}{m.value.toFixed(1)})</b>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Weak links */}
                      {sc.weakLinks.length > 0 && (
                        <div style={{ marginBottom:4, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                          <div style={{ fontSize:10, color:'#f59e0b', fontWeight:600 }}>⚠️ Слабые звенья: {sc.weakLinks.join(', ')}</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:2 }}>Добавьте продукты с более высоким скором в эту категорию</div>
                        </div>
                      )}
                      {/* Product details */}
                      <div style={{ marginBottom:4 }}>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>📦 Продукты и скоры</div>
                        {sc.productScores.map((p: any) => (
                          <div key={p.foodId} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0', fontSize:10 }}>
                            <div style={{ width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:6, fontWeight:800, border:`1.5px solid ${p.score >= 7 ? '#22c55e' : p.score >= 4 ? '#f59e0b' : '#ef4444'}`,
                              color: p.score >= 7 ? '#22c55e' : p.score >= 4 ? '#f59e0b' : '#ef4444' }}>{p.score}</div>
                            <span style={{ flex:1, color:'#fff' }}>{p.name}</span>
                            <span style={{ color:'rgba(255,255,255,0.6)' }}>{p.weightG}г</span>
                          </div>
                        ))}
                      </div>
                      {/* Micro coverage */}
                      {(sc as any).microCoverage && (sc as any).microCoverage.length > 0 && (
                        <div style={{ marginTop:4 }}>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>💊 Микронутриенты (% от нормы)</div>
                          {(sc as any).microCoverage.slice(0, 8).map((m: any) => (
                            <div key={m.key} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:1 }}>
                              <span style={{ fontSize:6, color:'rgba(255,255,255,0.8)', minWidth:20 }}>{m.name}</span>
                              <div style={{ flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                                <div style={{ width:`${Math.min(100, m.percent)}%`, height:'100%', borderRadius:2,
                                  background: m.percent >= 50 ? '#22c55e' : m.percent >= 20 ? '#f59e0b' : '#ef4444' }} />
                              </div>
                              <span style={{ fontSize:6, color:'rgba(255,255,255,0.8)', minWidth:20, textAlign:'right' }}>{Math.min(500, m.percent)}%</span>
                            </div>
                          ))}
                          {(sc as any).microCoverage.length > 8 && (
                            <div style={{ fontSize:6, color:'rgba(255,255,255,0.2)', marginTop:1 }}>+ ещё {Math.min(8, (sc as any).microCoverage.length - 8)}</div>
                          )}
                        </div>
                      )}
                      {/* Recommendations */}
                      <div style={{ marginTop:4, fontSize:10, color:'#8b5cf6' }}>
                        {grade === 'A' && '🏆 Отличный состав — идеально для вашей фазы'}
                        {grade === 'B' && '👍 Хороший приём — добавьте зелени или клетчатки'}
                        {grade === 'C' && '⚡ Улучшите: больше белка, овощей, замените переработанное'}
                        {grade === 'D' && '⚠️ Слабый приём — замените низкокачественные продукты'}
                      </div>
                    </div>
                  );
                })}

                {/* Combined daily report */}
                {calcDailyReport && calcResults.length > 1 && (
                  <div style={{ marginTop:8, borderRadius:10, padding:10, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#8b5cf6', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:4 }}>
                      <span>📈 Совокупный анализ ({calcResults.length} приёма)</span>
                      <span style={{ display:'flex', gap:4 }}>
                        <button onClick={() => printDayReport(buildDayReportPrintHtml(calcDailyReport, {
                          dayScore: (dayPlan as any)?.healthScore?.score ?? null,
                          dayStatus: (dayPlan as any)?.healthScore?.status ?? null,
                          coverage: (Array.isArray((dayPlan as any)?.microSummary?.coverage) ? (dayPlan as any).microSummary.coverage : []).map((c: any) => ({ nutrient: c.nutrient, pct: c.pct, status: c.status })),
                        }))} style={{ padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:700, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa' }}>🖨 Печать отчёта</button>
                        <button onClick={() => printMealTimeline(buildMealTimelinePrintHtml(
                          (Array.isArray(dayPlan?.meals) ? dayPlan.meals : []).map((m: any) => ({ time: m.time, label: m.label, type: m.type, items: (m.items || []).map((it: any) => ({ name: it.name, amount: it.amount })), totals: m.totals || {} })),
                          { title: 'План на день', kcal: dayPlan?.totals?.kcal, trainStart }
                        ))} style={{ padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:9, fontWeight:700, background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.3)', color:'#22d3ee' }}>⏳ Таймлайн (PDF)</button>
                      </span>
                    </div>
                    {/* Overall grade */}
                    {(() => {
                      const avgScore = calcResults.reduce((s: number, r: any) => s + r.score.compositeScore, 0) / calcResults.length;
                      const overallGrade = avgScore >= 8 ? 'A' : avgScore >= 6 ? 'B' : avgScore >= 4 ? 'C' : 'D';
                      const overallColor = overallGrade === 'A' ? '#00e68a' : overallGrade === 'B' ? '#8b5cf6' : overallGrade === 'C' ? '#f59e0b' : '#ef4444';
                      return (
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                            background:`${overallColor}18`, border:`2px solid ${overallColor}`, fontSize:14, fontWeight:800, color:overallColor }}>{overallGrade}</div>
                          <span style={{ fontSize:10, color:overallColor, fontWeight:700 }}>Качество рациона: {avgScore.toFixed(1)}/10</span>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:4 }}>
                      Ккал: {Math.round(calcDailyReport.totalKcal)} | DIAAS: {calcDailyReport.diaas.toFixed(2)} | Лимит.АК: {calcDailyReport.diaasLimitingAA}
                      {calcDailyReport.histamineSensitive ? ' | ⚠️ Чувствителен к гистамину' : ''}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, fontSize:10, color:'rgba(255,255,255,0.85)' }}>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.mtorTriggered ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.06)', color: calcDailyReport.mtorTriggered ? '#22c55e' : '#ef4444' }}>
                        🧬 mTOR: {calcDailyReport.mtorTriggered ? '✅ Запущен' : `❌ Дефицит ${calcDailyReport.mtorDeficitMg}мг лейцина`}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.giLoadWarning ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.giLoadWarning ? '#ef4444' : '#22c55e' }}>
                        🧬 GL: {calcDailyReport.giLoad.toFixed(0)} {calcDailyReport.giLoadWarning ? '⚠️' : '✅'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.pralWarning ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.pralWarning ? '#f59e0b' : '#22c55e' }}>
                        🧂 PRAL: {calcDailyReport.pralTotal.toFixed(0)} {calcDailyReport.pralWarning || '✅'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.ammoniaRisk ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.ammoniaRisk ? '#ef4444' : '#22c55e' }}>
                        💨 Аммиак: {calcDailyReport.ammoniaScore.toFixed(1)} {calcDailyReport.ammoniaRisk ? '⚠️' : '✅'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.omegaWarning ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.omegaWarning ? '#f59e0b' : '#22c55e' }}>
                        🐟 Омега: {calcDailyReport.omegaRatio.toFixed(1)}:1 {calcDailyReport.omegaWarning ? '⚠️' : '✅'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.electrolyteRisk ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.electrolyteRisk ? '#ef4444' : '#22c55e' }}>
                        💧 K/Mg: {calcDailyReport.potassiumMg}/{calcDailyReport.magnesiumMg}мг {calcDailyReport.electrolyteRisk ? '⚠️' : '✅'}
                      </div>
                      <div title="Мало быстрых углеводов в post-workout приёме (< 0.5 г/кг) — риск кортизола" style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.cortisolRisk ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.cortisolRisk ? '#f59e0b' : '#22c55e' }}>
                        🧠 Кортизол: {calcDailyReport.cortisolRisk ? '⚠️ Риск (мало быстрых угл. post-WO)' : '✅ Норма'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.insulinRicohet ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.insulinRicohet ? '#ef4444' : '#22c55e' }}>
                        💉 Инсулин: {calcDailyReport.insulinRicohet ? '🚨 Рикшет' : '✅ Норма'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: (calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: (calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? '#ef4444' : '#22c55e' }}>
                        🔬 HOMA-IR: {calcDailyReport.homaIr !== null ? calcDailyReport.homaIr.toFixed(1) : '—'} {(calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? '🚨' : '✅'}
                      </div>
                      {calcDailyReport.overloadWarning && (
                        <div style={{ padding:'3px 6px', borderRadius:4, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                          ⚠ Перегрузка приёма: порция {calcDailyReport.maxSinglePortionG} г — увеличьте число приёмов, чтобы распределить нагрузку
                        </div>
                      )}
                    </div>
                    {calcDailyReport.diaasWarning && (
                      <div style={{ marginTop:4, fontSize:10, padding:'4px 8px', borderRadius:6, background: 'rgba(139,92,246,0.06)', color: '#8b5cf6' }}>
                        💪 DIAAS: {calcDailyReport.diaasWarning}
                      </div>
                    )}
                    {calcDailyReport.antinutrientWarning && (
                      <div style={{ marginTop:3, fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
                        {calcDailyReport.antinutrientWarning}
                      </div>
                    )}
                    {calcDailyReport.glutathioneWarning && (
                      <div style={{ marginTop:3, fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
                        {calcDailyReport.glutathioneWarning}
                      </div>
                    )}
                    {calcDailyReport.histamineWarning && (
                      <div style={{ marginTop:3, fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', color:'#ef4444' }}>
                        {calcDailyReport.histamineWarning}
                      </div>
                    )}
                    {/* Micro deficits */}
                    {calcDailyReport.microDeficits.length > 0 && (
                      <div style={{ marginTop:3 }}>
                        <div style={{ fontSize:10, color:'#f59e0b', fontWeight:600, marginBottom:2 }}>⚠️ Дефициты микронутриентов ({calcDailyReport.microDeficits.length})</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                          {calcDailyReport.microDeficits.map((def: string) => {
                            const criticalDefs = ['Железо','B12','Витамин D','Кальций','B9','C','Фолат','B6'];
                            const isCritical = criticalDefs.some(c => def.toLowerCase().includes(c.toLowerCase()));
                            return (
                              <span key={def} style={{ fontSize:6, padding:'1px 5px', borderRadius:3,
                                background: isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                                color: isCritical ? '#ef4444' : '#f59e0b' }}>
                                {isCritical ? '🔴' : '🟡'} {def}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Weight dynamics prediction */}
                    {(() => {
                      const tdeeEst = (weight || 80) * 35;
                      const kcalDiff = calcDailyReport.totalKcal - tdeeEst;
                      const weeklyKg = kcalDiff * 7 / 7700;
                      const direction = weeklyKg > 0.2 ? 'gain' : weeklyKg < -0.2 ? 'loss' : 'maintenance';
                      const arrow = direction === 'gain' ? '📈' : direction === 'loss' ? '📉' : '➡️';
                      const color = direction === 'gain' ? '#22c55e' : direction === 'loss' ? '#ef4444' : '#8b5cf6';
                      return (
                        <div style={{ marginTop:3, padding:'4px 8px', borderRadius:6, background:'rgba(6,182,212,0.04)', border:'1px solid rgba(6,182,212,0.08)' }}>
                          <div style={{ fontSize:10, color:'#06b6d4', fontWeight:600, marginBottom:2 }}>⚖️ Прогноз динамики веса</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)' }}>
                            Ккал: {Math.round(calcDailyReport.totalKcal)}/день · TDEE: ~{Math.round(tdeeEst)} · Баланс: {kcalDiff > 0 ? '+' : ''}{Math.round(kcalDiff)} ккал/день
                          </div>
                          <div style={{ fontSize:9, fontWeight:600, color, marginTop:1 }}>
                            {arrow} ~{Math.abs(weeklyKg).toFixed(2)} кг/нед ({direction === 'gain' ? 'набор' : direction === 'loss' ? 'снижение' : 'поддержание'})
                          </div>
                        </div>
                      );
                    })()}
                    {/* Food quality breakdown */}
                    {(() => {
                      const allProductScores = calcResults.flatMap((r: any) => r.score.productScores || []);
                      const bestItems = allProductScores.filter((p: any) => p.score >= 7).map((p: any) => p.name);
                      const weakItems = allProductScores.filter((p: any) => p.score < 4).map((p: any) => p.name);
                      return (
                        <>
                          {bestItems.length > 0 && (
                            <div style={{ marginTop:4, fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.04)', color:'#22c55e' }}>
                              ✅ Лучшие продукты: {bestItems.join(', ')}
                            </div>
                          )}
                          {weakItems.length > 0 && (
                            <div style={{ marginTop:3, fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', color:'#ef4444' }}>
                              ⚠️ Слабые продукты: {weakItems.join(', ')}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {/* Recommendations */}
                    {(() => {
                      const recs: string[] = [];
                      if (!calcDailyReport.mtorTriggered) recs.push('🥩 Увеличьте лейцин (красное мясо, яйца, сывороточный протеин)');
                      if (calcDailyReport.giLoadWarning) recs.push('🍚 Снизьте гликемическую нагрузку: часть быстрых углеводов замените на овсянку, гречку, бобовые или овощи');
                      if (calcDailyReport.omegaWarning) recs.push('🐟 Добавьте Омега-3 (лосось, скумбрия, льняное масло)');
                      if (calcDailyReport.electrolyteRisk) recs.push('🥑 Увеличьте калий (авокадо, шпинат, бананы) и магний (орехи, семена)');
                      if (calcDailyReport.microDeficits.length > 0) recs.push('💊 Обратите внимание на дефициты: ' + calcDailyReport.microDeficits.slice(0,3).join(', '));
                      return recs.length > 0 ? (
                        <div style={{ marginTop:4 }}>
                          <div style={{ fontSize:10, color:'#8b5cf6', fontWeight:600, marginBottom:2 }}>📋 Рекомендации</div>
                          {recs.map((rec, ri) => (
                            <div key={ri} style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:1 }}>• {rec}</div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {showCorrectPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'96%', maxWidth:440, maxHeight:'92vh', overflowY:'auto', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(249,115,22,0.12)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#f97316' }}>🔀 Корректировка рациона</div>
              <span onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }} style={{ cursor:'pointer', fontSize:10, color:'rgba(255,255,255,0.9)', padding:'2px 6px' }}>✕</span>
            </div>

            {!correctIssues ? (
              <div style={{ textAlign:'center', padding:20, fontSize:9, color:'rgba(255,255,255,0.75)' }}>Анализ рациона...</div>
            ) : correctIssues.length === 0 ? (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>Рацион сбалансирован</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)' }}>Не найдено критических недочётов</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:8 }}>
                  Найдено <strong style={{ color:'#f97316' }}>{correctIssues.reduce((s, m) => s + m.issues.length, 0)}</strong> недочёта(ов) в <strong style={{ color:'#f97316' }}>{correctIssues.length}</strong> приёмах
                </div>

                {correctIssues.map((meal, mi) => (
                  <div key={mi} style={{ marginBottom:8, borderRadius:10, background:'rgba(24,24,27,0.8)', border:'1px solid rgba(249,115,22,0.1)', overflow:'hidden' }}>
                    <div style={{ padding:'7px 10px', background:'rgba(249,115,22,0.06)', borderBottom:'1px solid rgba(249,115,22,0.08)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#f97316' }}>{meal.mealName}</span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.75)', marginLeft:6 }}>({meal.issues.length})</span>
                    </div>
                    <div style={{ padding:'6px 10px' }}>
                      {meal.issues.map((issue, ii) => (
                        <div key={ii} style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background: issue.severity === 'high' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)', border:`1px solid ${issue.severity === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                          <div style={{ fontSize:9, fontWeight:600, color: issue.severity === 'high' ? '#ef4444' : '#f59e0b', marginBottom:3 }}>{issue.text}</div>
                          {issue.suggestion && issue.suggestion.length > 0 && (
                            <div>
                              <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>🔀 Заменить на:</div>
                              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                                {issue.suggestion.map((s, si) => {
                                  // FIX button-audit: dayIdx по единой конвенции (7+ = неделя), guard на foodId
                                  const dayIdx = planDays === 7 ? selectedDayIndex + 7 : planDays === 3 ? selectedDayIndex + 1 : 0;
                                  const activeMeal = planDays === 1 ? dayPlan?.meals?.[meal.mealIdx] : (planDays === 3 ? threeDayPlan?.days?.[selectedDayIndex]?.meals?.[meal.mealIdx] : weekPlan?.days?.[selectedDayIndex]?.meals?.[meal.mealIdx]);
                                  return (
                                  <button key={si} onClick={() => {
                                    const itemIdx = activeMeal?.items?.findIndex((it: any) => {
                                      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
                                      return food?.id === s.foodId || it.name === s.name;
                                    });
                                    const target = FOOD_DB.find(f => f.id === s.foodId);
                                    if (itemIdx !== undefined && itemIdx >= 0 && target) {
                                      // FIX button-audit: replaceFoodItem сам вызывает saveUndo — убран дубль
                                      replaceFoodItem(dayIdx, meal.mealIdx, itemIdx, target);
                                      analyzePlanIssues();
                                    }
                                  }} style={{ padding:'3px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:600 }}>
                                    {s.name} <span style={{ fontWeight:400, color:'rgba(255,255,255,0.75)' }}>({s.reason})</span>
                                  </button>
                                  );
                                })}
                                <button onClick={() => {
                                  // E7-фикс: «🔄 Все» собирает ВСЕ замены в ОДИН saveUndo и один setDayPlan
                                  // (раньше каждая позиция мутировала план отдельно, а replaceFoodItem
                                  // внутри forEach терял актуальный state — часть замен могла не примениться)
                                  const dayIdx = planDays === 7 ? selectedDayIndex + 7 : planDays === 3 ? selectedDayIndex + 1 : 0;
                                  const activePlan = planDays === 1 ? dayPlan : (planDays === 3 ? threeDayPlan?.days?.[selectedDayIndex] : weekPlan?.days?.[selectedDayIndex]);
                                  if (!activePlan?.meals?.[meal.mealIdx]) return;
                                  saveUndo();
                                  const mealItems = [...activePlan.meals[meal.mealIdx].items];
                                  const suggestions = issue.suggestion || [];
                                  mealItems.forEach((it: any, i: number) => {
                                    const similar = findSimilarFoods(it);
                                    if (similar.length === 0) return;
                                    const targetFood = similar.find(f => suggestions.some(s => s.foodId === f.id));
                                    if (!targetFood) return;
                                    const ratio = (it.amount || 100) / 100;
                                    mealItems[i] = {
                                      ...it,
                                      name: targetFood.name, id: targetFood.id,
                                      amount: it.amount || 100,
                                      kcal: Math.round((targetFood.kcal || 0) * ratio),
                                      p: Math.round((targetFood.protein || 0) * ratio * 10) / 10,
                                      f: Math.round((targetFood.fat || 0) * ratio * 10) / 10,
                                      c: Math.round((targetFood.carbs || 0) * ratio * 10) / 10,
                                    };
                                  });
                                  const totals = { kcal: mealItems.reduce((s: number, x: any) => s + (x.kcal || 0), 0), p: mealItems.reduce((s: number, x: any) => s + (x.p || 0), 0), f: mealItems.reduce((s: number, x: any) => s + (x.f || 0), 0), c: mealItems.reduce((s: number, x: any) => s + (x.c || 0), 0) };
                                  const newMeals = activePlan.meals.map((m: any, mi2: number) => (mi2 === meal.mealIdx ? { ...m, items: mealItems, totals } : m));
                                  const apply = (p: any) => ({ ...p, meals: newMeals, totals: newMeals.reduce((s: number, m: any) => ({ kcal: s + (m.totals?.kcal || 0), p: s + (m.totals?.p || 0), f: s + (m.totals?.f || 0), c: s + (m.totals?.c || 0) }), { kcal: 0, p: 0, f: 0, c: 0 }) });
                                  if (dayIdx === 0) setDayPlan((prev: any) => apply(prev));
                                  else if (planDays === 3) setThreeDayPlan((prev: any) => { const days = [...prev.days]; days[selectedDayIndex] = apply(prev.days[selectedDayIndex]); return { ...prev, days }; });
                                  else setWeekPlan((prev: any) => { const days = [...prev.days]; days[selectedDayIndex] = apply(prev.days[selectedDayIndex]); return { ...prev, days }; });
                                  analyzePlanIssues();
                                }} style={{ padding:'3px 8px', borderRadius:6, fontSize:10, cursor:'pointer', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#a78bfa', fontWeight:600 }}>
                                  🔄 Все
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ display:'flex', gap:4, marginTop:8 }}>
                  <button onClick={() => {
                    setShowCorrectPopup(false);
                    setCorrectIssues(null);
                    // FIX button-audit: перегенерация в текущем виде (не сбрасывать на 1 день)
                    generatePlan(planDays === 3 ? 3 : planDays === 7 ? 7 : 1, undefined, selectedDayIndex);
                  }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#f97316,#fb923c)', color:'#fff', fontSize:10, fontWeight:800 }}>
                    ♻️ Перегенерировать рацион
                  </button>
                  <button onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', fontSize:10, fontWeight:600 }}>
                    ✕ Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
