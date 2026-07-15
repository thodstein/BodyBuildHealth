export interface NutritionReportInput {
  meals: { label: string; items: { name: string; id: string; amount: number; kcal: number; p: number; f: number; c: number }[]; totals: { kcal: number; p: number; f: number; c: number }; time?: string }[];
  totals: { kcal: number; p: number; f: number; c: number };
  targets: { kcal: number; protein: number; fats: number; carbs: number };
  userWeight: number;
  userTDEE: number;
  healthIssues: string[];
  planType: string;
  variety: string;
  budget: string;
  allergens: string[];
  cyclingMode: string;
  goal: string;
  waterMl?: number;
  injections?: { type: string; dose: number; name: string; time?: string }[];
  workoutTime?: string;
}

export interface NutritionReport {
  kbjuPerMeal: { label: string; kcal: number; p: number; f: number; c: number; pctKcal: number; pctP: number; pctF: number; pctC: number }[];
  kbjuPct: { kcal: number; p: number; f: number; c: number };
  micros: Record<string, { actual: number; target: number; pct: number; status: 'ok' | 'low' | 'critical'; foods: string[] }>;
  microDeficiencies: string[];
  weightDynamicsBasic: { weeklyKg: number; direction: 'loss' | 'gain' | 'maintenance'; monthlyKg: number; explanation: string };
  weightDynamicsEnhanced: { weeklyKg: number; monthlyKg: number; confidence: 'low' | 'medium' | 'high'; explanation: string; factors: string[] };
  foodQualityScore: number;
  foodQualityDetails: { bestItems: string[]; weakItems: string[]; avgTier: number };
  riskAnalysis: { system: string; score: number; maxScore: number; impact: string; recommendation: string }[];
  allergenWarnings: { food: string; allergens: string[] }[];
  planDecisions: { param: string; value: string; impact: string }[];
  overallGrade: 'A' | 'B' | 'C' | 'D';
  overallGradeLabel: string;
  recommendations: string[];
  generatedAt: string;
  // New comprehensive sections
  waterBalance: { intakeMl: number; targetMl: number; deficitMl: number; intakePerKg: number; targetPerKg: number; status: 'ok' | 'low' | 'critical'; pharmaAdjusted: boolean; recommendation: string };
  sodiumPotassium: { naMg: number; kMg: number; ratio: number; targetRatio: number; status: 'ok' | 'high' | 'low'; recommendation: string };
  proteinTiming: { evennessScore: number; gaps: string[]; maxGapHours: number; recommendation: string };
  glycemicLoad: { totalGL: number; avgGI: number; maxPerMeal: number; mealsHighGI: number; status: 'ok' | 'high' | 'low'; recommendation: string };
  fatQuality: { satG: number; unsatG: number; satPct: number; targetSatPct: number; omega3G: number; omega6to3ratio: number | null; status: string; recommendation: string };
  mealTiming: { mealCount: number; longestGapHours: number; hasPreWorkout: boolean; hasPostWorkout: boolean; eveningCarbOk: boolean; proteinSpreadOk: boolean; gaps: string[]; recommendation: string };
  fiberAnalysis: { totalG: number; targetG: number; pct: number; status: 'ok' | 'low' | 'critical'; recommendation: string };
  calciumMagnesium: { caMg: number; mgMg: number; ratio: number; targetRatio: number; status: string; recommendation: string };
}

const MICRO_TARGETS: Record<string, number> = {
  Ca: 1000, Fe: 18, Mg: 400, Zn: 15, K: 3500, Se: 55,
  VitC: 100, VitD: 15, VitE: 15, VitA: 900, VitB1: 1.2, VitB2: 1.3,
  VitB3: 16, VitB5: 5, VitB6: 1.3, VitB9: 400, VitB12: 2.4,
  Omega3: 1.6, Fiber: 30, Cholesterol: 300,
};

const MICRO_LABELS: Record<string, string> = {
  Ca: 'Кальций', Fe: 'Железо', Mg: 'Магний', Zn: 'Цинк', K: 'Калий', Se: 'Селен',
  VitC: 'Витамин C', VitD: 'Витамин D', VitE: 'Витамин E', VitA: 'Витамин A',
  VitB1: 'B1 (тиамин)', VitB2: 'B2 (рибофлавин)', VitB3: 'B3 (ниацин)',
  VitB5: 'B5 (пантотеновая)', VitB6: 'B6 (пиридоксин)', VitB9: 'B9 (фолат)', VitB12: 'B12',
  Omega3: 'Омега-3', Fiber: 'Клетчатка', Cholesterol: 'Холестерин',
};

import { FOOD_DB } from '../core/nutrition-database';

// Sodium estimation by food category (mg per 100g typical)
const NA_BY_CATEGORY: Record<string, number> = {
  protein: 60, carb: 5, fat: 50, dairy: 100, veg_fruit: 10, grain: 200, supplement: 50, fast_food: 400, other: 100,
};

// Saturated fat estimate by category (as fraction of total fat)
const SAT_FRACTION_BY_CATEGORY: Record<string, number> = {
  protein: 0.35, carb: 0.15, fat: 0.20, dairy: 0.60, veg_fruit: 0.15, grain: 0.20, supplement: 0.10, fast_food: 0.40, other: 0.30,
};

// Omega-6 estimate by category (g per 100g fat)
const OMEGA6_PER_100G_FAT: Record<string, number> = {
  protein: 0.5, carb: 0.5, fat: 10, dairy: 0.3, veg_fruit: 0.5, grain: 1.0, supplement: 1.0, fast_food: 5.0, other: 1.0,
};

export function generateNutritionReport(input: NutritionReportInput): NutritionReport {
  const { meals, totals, targets, userWeight, userTDEE, healthIssues, planType, variety, budget, allergens, cyclingMode, goal, waterMl, injections, workoutTime } = input;
  const allItems = meals.flatMap(m => m.items);

  // ─── 1. KBJU per meal ───
  const kbjuPerMeal = meals.map(m => ({
    label: m.label,
    kcal: m.totals.kcal,
    p: m.totals.p,
    f: m.totals.f,
    c: m.totals.c,
    pctKcal: targets.kcal > 0 ? Math.round(m.totals.kcal / targets.kcal * 100) : 0,
    pctP: targets.protein > 0 ? Math.round(m.totals.p / targets.protein * 100) : 0,
    pctF: targets.fats > 0 ? Math.round(m.totals.f / targets.fats * 100) : 0,
    pctC: targets.carbs > 0 ? Math.round(m.totals.c / targets.carbs * 100) : 0,
  }));

  // ─── 2. KBJU % completion ───
  const kbjuPct = {
    kcal: targets.kcal > 0 ? Math.round(totals.kcal / targets.kcal * 100) : 0,
    p: targets.protein > 0 ? Math.round(totals.p / targets.protein * 100) : 0,
    f: targets.fats > 0 ? Math.round(totals.f / targets.fats * 100) : 0,
    c: targets.carbs > 0 ? Math.round(totals.c / targets.carbs * 100) : 0,
  };

  // ─── 3. Micros from all food items ───
  const microTotals: Record<string, number> = {};
  const microFoods: Record<string, Set<string>> = {};
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (food?.micros) {
      const ratio = item.amount / 100;
      Object.entries(food.micros).forEach(([k, v]) => {
        if (typeof v === 'number') {
          microTotals[k] = (microTotals[k] || 0) + v * ratio;
          if (!microFoods[k]) microFoods[k] = new Set();
          microFoods[k].add(food.name);
        }
      });
    }
  });
  // NOTE: Omega3 is already collected via Object.entries(food.micros) above — no duplicate block needed

  const micros: Record<string, { actual: number; target: number; pct: number; status: 'ok' | 'low' | 'critical'; foods: string[] }> = {};
  const microDeficiencies: string[] = [];
  Object.entries(MICRO_TARGETS).forEach(([k, target]) => {
    const actual = Math.round((microTotals[k] || 0) * 10) / 10;
    const pct = Math.round(actual / target * 100);
    const status: 'ok' | 'low' | 'critical' = pct >= 80 ? 'ok' : pct >= 50 ? 'low' : 'critical';
    micros[k] = { actual, target, pct, status, foods: [...(microFoods[k] || [])] };
    if (status !== 'ok') microDeficiencies.push(`${MICRO_LABELS[k] || k}: ${actual} из ${target} (${pct}%)`);
  });

  // ─── 4. Weight dynamics ───
  const kcalDiff = totals.kcal - userTDEE;
  const weeklyKg = Math.round((kcalDiff * 7 / 7700) * 100) / 100;
  const direction: 'loss' | 'gain' | 'maintenance' = weeklyKg < -0.1 ? 'loss' : weeklyKg > 0.1 ? 'gain' : 'maintenance';
  const weightDynamicsBasic = {
    weeklyKg: Math.abs(weeklyKg),
    direction,
    monthlyKg: Math.round(Math.abs(weeklyKg) * 4.33 * 100) / 100,
    explanation: direction === 'loss'
      ? `Дефицит ${Math.round(Math.abs(kcalDiff))} ккал/день → ожидаемая потеря ${Math.abs(weeklyKg)} кг/нед (${Math.round(Math.abs(weeklyKg) * 4.33 * 10) / 10} кг/мес).`
      : direction === 'gain'
      ? `Профицит ${Math.round(kcalDiff)} ккал/день → ожидаемый набор ${weeklyKg} кг/нед (${Math.round(weeklyKg * 4.33 * 10) / 10} кг/мес).`
      : `Энергетический баланс: ${Math.round(totals.kcal)} / ${userTDEE} ккал — вес стабилен.`,
  };

  // Enhanced dynamics
  const proteinGperKg = userWeight > 0 ? totals.p / userWeight : 0;
  const fatPct = totals.kcal > 0 ? (totals.f * 9 / totals.kcal * 100) : 0;
  const qualityModifier = proteinGperKg >= 2.0 ? 1.15 : proteinGperKg >= 1.6 ? 1.10 : 1.0;
  const fatModifier = fatPct > 40 ? 0.90 : fatPct > 35 ? 0.95 : 1.0;
  const enhancedWeeklyKg = Math.round(Math.abs(weeklyKg) * qualityModifier * fatModifier * 100) / 100;
  const factors: string[] = [];
  if (proteinGperKg >= 2.0) factors.push('Высокий белок (+15% к термогенезу)');
  else if (proteinGperKg < 1.2) factors.push('Низкий белок — риск потери мышц');
  if (fatPct > 40) factors.push('Высокий % жира — замедление жиросжигания');
  if (qualityModifier > 1) factors.push('Качество питания повышает метаболический ответ');
  const confidence: 'low' | 'medium' | 'high' = proteinGperKg >= 1.6 && fatPct < 35 ? 'high' : proteinGperKg >= 1.0 ? 'medium' : 'low';
  const weightDynamicsEnhanced = {
    weeklyKg: enhancedWeeklyKg,
    monthlyKg: Math.round(enhancedWeeklyKg * 4.33 * 100) / 100,
    confidence,
    explanation: `С учётом качества рациона (белок ${proteinGperKg.toFixed(1)} г/кг, жиры ${Math.round(fatPct)}%): скорректированная динамика ~${enhancedWeeklyKg} кг/нед.`,
    factors,
  };

  // ─── 5. Food quality score ───
  let totalTierScore = 0; let tierCount = 0;
  const bestItems: string[] = []; const weakItems: string[] = [];
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (food) {
      const tierVal = food.tier === 'max' ? 9 : food.tier === 'mid' ? 7 : food.tier === 'basic' ? 5 : 5;
      totalTierScore += tierVal; tierCount++;
      if (tierVal >= 8) bestItems.push(food.name);
      else if (tierVal <= 5) weakItems.push(food.name);
    }
  });
  const avgTier = tierCount > 0 ? Math.round(totalTierScore / tierCount * 10) / 10 : 0;
  const foodQualityScore = Math.min(10, avgTier);

  // ─── 6. Risk analysis ───
  const fatKcalPct = totals.kcal > 0 ? (totals.f * 9 / totals.kcal * 100) : 0;
  const proteinGperKgVal = userWeight > 0 ? totals.p / userWeight : 0;
  const riskAnalysis = [
    { system: 'Печень', score: fatKcalPct > 40 ? 6 : fatKcalPct > 35 ? 4 : 2, maxScore: 7, impact: fatKcalPct > 40 ? 'Высокое содержание жиров' : 'Умеренное', recommendation: fatKcalPct > 40 ? 'Снизить долю жиров до 25-30%' : 'Норма' },
    { system: 'Почки', score: proteinGperKgVal > 2.5 ? 6 : proteinGperKgVal > 2.0 ? 4 : 2, maxScore: 7, impact: proteinGperKgVal > 2.0 ? 'Повышенная нагрузка' : 'Норма', recommendation: proteinGperKgVal > 2.5 ? 'Снизить белок до 2г/кг' : 'Адекватно' },
    { system: 'Воспаление', score: healthIssues.includes('oedema') || healthIssues.includes('gi_issues') ? 5 : 3, maxScore: 7, impact: 'Системное воспаление', recommendation: 'Омега-3, куркумин, исключение трансжиров' },
    { system: 'Инсулин', score: totals.c / Math.max(1, meals.length) > 60 ? 5 : 3, maxScore: 7, impact: 'Гликемическая нагрузка', recommendation: 'Дробные углеводы, до 50г/приём' },
    { system: 'Электролиты', score: 3, maxScore: 5, impact: 'Баланс Na/K', recommendation: 'Достаточно K из овощей' },
  ];

  // ─── 7. Allergen warnings ───
  const allergenWarnings: { food: string; allergens: string[] }[] = [];
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (food?.allergens) {
      const matched = food.allergens.filter(a => allergens.includes(a));
      if (matched.length > 0) allergenWarnings.push({ food: item.name, allergens: matched });
    }
  });

  // ─── 8. Plan decisions ───
  const planDecisions = [
    { param: 'Цель', value: goal === 'mass' ? 'Набор массы' : goal === 'cut' ? 'Сушка' : goal === 'strength' ? 'Сила' : 'Поддержание', impact: goal === 'mass' ? 'Профицит 10-15%' : goal === 'cut' ? 'Дефицит 20%' : 'Баланс' },
    { param: 'Тип плана', value: planType || 'Классический', impact: `Коррекция БЖУ под ${planType}` },
    { param: 'Бюджет', value: budget || 'Средний', impact: 'Фильтр продуктов по цене' },
    { param: 'Разнообразие', value: variety || 'Максимум', impact: variety === 'minimal' ? '2-3 продукта/категорию' : variety === 'medium' ? '4-5 продуктов' : 'Весь пул' },
    { param: 'Циклирование', value: cyclingMode || 'Нет', impact: cyclingMode !== 'none' ? 'Чередование дней' : 'Одинаковый режим' },
    { param: 'Аллергены', value: allergens.length > 0 ? `${allergens.length} исключено` : 'Нет', impact: allergens.length > 0 ? 'Исключены продукты-аллергены' : 'Без ограничений' },
    { param: 'Проблемы со здоровьем', value: healthIssues.length > 0 ? healthIssues.join(', ') : 'Нет', impact: healthIssues.length > 0 ? 'Исключены провоцирующие продукты' : 'Без ограничений' },
  ];

  // ════════════════════════════════════════════════
  // NEW COMPREHENSIVE SECTIONS
  // ════════════════════════════════════════════════

  // ─── 9. Water balance ───
  const hasAAS = (injections || []).some(i => i.type === 'ААС' || i.type.toLowerCase().includes('тест') || i.type.toLowerCase().includes('трен') || i.type.toLowerCase().includes('стан'));
  const waterBaseTarget = userWeight * 30; // 30 ml/kg
  const waterPharmaTarget = hasAAS ? userWeight * 40 : userWeight * 35; // 40 on AAS, 35 otherwise
  const waterTarget = waterPharmaTarget;
  const waterActual = waterMl || 0;
  const waterDeficit = Math.max(0, waterTarget - waterActual);
  const waterIntakePerKg = userWeight > 0 ? Math.round(waterActual / userWeight) : 0;
  const waterTargetPerKg = Math.round(waterTarget / userWeight);
  let waterStatus: 'ok' | 'low' | 'critical' = 'ok';
  if (waterActual < waterTarget * 0.7) waterStatus = 'critical';
  else if (waterActual < waterTarget * 0.9) waterStatus = 'low';
  const waterRecommendations: string[] = [];
  if (waterStatus === 'critical') waterRecommendations.push(`Критический дефицит воды: ${Math.round(waterDeficit / waterTarget * 100)}% от нормы. Пейте ${Math.round(waterTarget / 8)} мл каждые 1.5-2 часа.`);
  else if (waterStatus === 'low') waterRecommendations.push(`Недостаточно воды: нужно ещё ${waterDeficit} мл/день. Добавьте ${Math.round(waterDeficit / 250)} стаканов.`);
  if (hasAAS) waterRecommendations.push('На ААС норма повышена до 40 мл/кг — дополнительная нагрузка на почки.');
  if (healthIssues.includes('oedema')) waterRecommendations.push('При отёках: вода по жажде, не заливайтесь насильно. Контроль Na.');
  if (healthIssues.includes('kidney_stones')) waterRecommendations.push('При камнях: строго 35-40 мл/кг, лимонный сок в воду.');
  const waterBalance = {
    intakeMl: waterActual,
    targetMl: waterTarget,
    deficitMl: waterDeficit,
    intakePerKg: waterIntakePerKg,
    targetPerKg: waterTargetPerKg,
    status: waterStatus,
    pharmaAdjusted: hasAAS,
    recommendation: waterRecommendations.join(' '),
  };

  // ─── 10. Sodium/Potassium ratio ───
  let estimatedNaMg = 0;
  let kMg = 0;
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    const ratio = item.amount / 100;
    // Na from micros if available, otherwise estimate by category
    if (food?.micros?.Na !== undefined) {
      estimatedNaMg += (food.micros.Na as number) * ratio;
    } else {
      const catNa = NA_BY_CATEGORY[food?.category || 'other'] || 100;
      estimatedNaMg += catNa * ratio;
    }
    // K from micros
    if (food?.micros?.K !== undefined) {
      kMg += (food.micros.K as number) * ratio;
    }
  });
  const naKRatio = kMg > 0 ? estimatedNaMg / kMg : 3;
  const targetNaKRatio = 0.75; // ideal Na/K < 1
  let naKStatus: 'ok' | 'high' | 'low' = 'ok';
  if (naKRatio > 1.5) naKStatus = 'high';
  else if (naKRatio > 1.0) naKStatus = 'low'; // borderline
  const naKRecommendations: string[] = [];
  if (naKRatio > 1.5) naKRecommendations.push('Na/K > 1.5 — избыток натрия. Исключите солёное (колбасы, соусы, фастфуд). Добавьте K: овощи, картофель, бананы.');
  else if (naKRatio > 1.0) naKRecommendations.push('Na/K выше оптимального. Уменьшите добавленную соль, увеличьте овощи.');
  else naKRecommendations.push('Na/K в норме.');
  if (healthIssues.includes('hypertension')) naKRecommendations.push('При гипертонии строгий контроль Na < 1500 мг/день.');
  const sodiumPotassium = {
    naMg: Math.round(estimatedNaMg),
    kMg: Math.round(kMg),
    ratio: Math.round(naKRatio * 100) / 100,
    targetRatio: targetNaKRatio,
    status: naKStatus,
    recommendation: naKRecommendations.join(' '),
  };

  // ─── 11. Protein timing quality ───
  const mealProteins = meals.map(m => m.totals.p).filter(p => p > 0);
  const proteinGaps: string[] = [];
  let maxGapHours = 0;
  if (meals.length >= 2) {
    for (let i = 0; i < meals.length - 1; i++) {
      const t1 = meals[i].time || '';
      const t2 = meals[i + 1].time || '';
      if (t1 && t2 && t1.includes(':') && t2.includes(':')) {
        const h1 = parseInt(t1.split(':')[0]) + parseInt(t1.split(':')[1]) / 60;
        const h2 = parseInt(t2.split(':')[0]) + parseInt(t2.split(':')[1]) / 60;
        if (h2 > h1) {
          const gap = Math.round((h2 - h1) * 10) / 10;
          if (gap > maxGapHours) maxGapHours = gap;
          if (gap > 5) proteinGaps.push(`Перерыв ${gap}ч между ${t1} и ${t2} — риск катаболизма`);
        }
      }
    }
  }
  if (mealProteins.some(p => p < 20)) proteinGaps.push('Есть приёмы с <20г белка — недостаточно для MPS');
  if (mealProteins.some(p => p > 50)) proteinGaps.push('Есть приёмы с >50г белка за раз — избыток');
  // Evenness: coefficient of variation
  const avgP = mealProteins.length > 0 ? mealProteins.reduce((s, v) => s + v, 0) / mealProteins.length : 0;
  let evennessScore = 0;
  if (avgP > 0 && mealProteins.length > 1) {
    const variance = mealProteins.reduce((s, v) => s + Math.pow(v - avgP, 2), 0) / mealProteins.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / avgP;
    evennessScore = Math.round((1 - Math.min(cv, 1)) * 100);
  } else if (mealProteins.length === 1) {
    evennessScore = 100;
  }
  const proteinTiming = {
    evennessScore,
    gaps: proteinGaps,
    maxGapHours,
    recommendation: evennessScore < 60
      ? `Неравномерное распределение белка (${evennessScore}%). Оптимум: 20-40г каждые 3-4 часа, всего ${Math.round(targets.protein / 4)}-${Math.round(targets.protein / 3)}г/приём.`
      : evennessScore < 80
      ? `Распределение белка приемлемое (${evennessScore}%), но можно улучшить.`
      : `Белок распределён равномерно (${evennessScore}%) — отлично для MPS.`,
  };

  // ─── 12. Glycemic load ───
  let totalGL = 0;
  let totalGIWeighted = 0;
  let totalCarbsForGI = 0;
  let mealsHighGI = 0;
  const mealGLs: number[] = [];
  meals.forEach(m => {
    let mealGL = 0;
    m.items.forEach(item => {
      const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
      if (food && food.gi && food.gi > 0 && item.c > 0) {
        const itemGL = (food.gi * item.c) / 100;
        mealGL += itemGL;
        totalGL += itemGL;
        totalGIWeighted += food.gi * item.c;
        totalCarbsForGI += item.c;
      }
    });
    mealGLs.push(mealGL);
    if (mealGL > 20) mealsHighGI++;
  });
  const avgGI = totalCarbsForGI > 0 ? Math.round(totalGIWeighted / totalCarbsForGI) : 0;
  const maxPerMeal = mealGLs.length > 0 ? Math.round(Math.max(...mealGLs)) : 0;
  let glStatus: 'ok' | 'high' | 'low' = 'ok';
  if (totalGL > 120) glStatus = 'high';
  else if (totalGL < 40) glStatus = 'low';
  const glRecs: string[] = [];
  if (totalGL > 120) glRecs.push(`Общая гликемическая нагрузка ${Math.round(totalGL)} — высокая. Рекомендуется <100 (диабет) / <120 (норма).`);
  if (maxPerMeal > 25) glRecs.push(`ГН за один приём ${maxPerMeal} — выше 25. Дробите углеводы, добавляйте клетчатку и белок к каждому приёму.`);
  if (healthIssues.includes('diabetes') && totalGL > 80) glRecs.push('При диабете целевая ГН <80/день, <15 за приём.');
  if (avgGI > 60) glRecs.push(`Средний GI рациона ${avgGI} — высокий. Замените белый рис/картофель на бурый рис/гречку/киноа.`);
  if (glStatus === 'ok') glRecs.push('Гликемическая нагрузка в норме.');
  const glycemicLoad = {
    totalGL: Math.round(totalGL),
    avgGI,
    maxPerMeal,
    mealsHighGI,
    status: glStatus,
    recommendation: glRecs.join(' '),
  };

  // ─── 13. Fat quality ───
  let satG = 0;
  let omega3G = 0;
  let omega6G = 0;
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    const ratio = item.amount / 100;
    const itemFatG = item.f || (food ? food.fat * ratio : 0);
    if (itemFatG > 0) {
      const satFrac = food?.category === 'dairy' ? 0.60 : food?.category === 'protein' ? 0.35 : food?.category === 'fast_food' ? 0.40 : SAT_FRACTION_BY_CATEGORY[food?.category || 'other'] || 0.30;
      satG += itemFatG * satFrac;
    }
    // Omega3 from known micros
    if (food?.micros?.Omega3 !== undefined) {
      omega3G += (food.micros.Omega3 as number) * ratio;
    }
    // Omega6 estimate
    if (food && food.fat > 0) {
      const fatG = food.fat * ratio;
      omega6G += (OMEGA6_PER_100G_FAT[food.category || 'other'] || 1.0) * (fatG / 100);
    }
  });
  const totalFatG = totals.f;
  const satPct = totalFatG > 0 ? Math.round(satG / totalFatG * 100) : 0;
  const targetSatPct = 35; // saturated fat <35% of total fat (≈10% of calories at 30% fat diet)
  const omega6to3ratio = omega3G > 0.1 ? Math.round((omega6G / omega3G) * 10) / 10 : null as number | null;
  let fatQualityStatus: 'ok' | 'fair' | 'high' = satPct <= targetSatPct ? 'ok' : satPct <= 45 ? 'fair' : 'high';
  const fatRecs: string[] = [];
  if (satPct > targetSatPct) fatRecs.push(`Насыщенные жиры ${satPct}% от всех жиров (цель <${targetSatPct}%). Уменьшите: сливочное масло, жирное мясо, сыр.`);
  if (satPct <= targetSatPct) fatRecs.push('Насыщенные жиры в норме.');
  if (omega3G < 1.6) fatRecs.push(`Омега-3: ${omega3G.toFixed(1)}г/день. Норма 1.6-3г. Добавьте: лосось, скумбрия, льняное масло, рыбий жир.`);
  if (omega6to3ratio !== null && omega6to3ratio > 6) fatRecs.push(`Омега-6/Омега-3 = ${omega6to3ratio}:1 (норма 2-4:1). Избыток омега-6 из растительных масел/фастфуда → хроническое воспаление.`);
  if (fatPct > 35) fatRecs.push(`Жиры ${Math.round(fatPct)}% калорий — выше 35%. Цель 20-30%.`);
  if (fatPct < 20) fatRecs.push(`Жиры ${Math.round(fatPct)}% калорий — ниже 20%. Риск дефицита жирорастворимых витаминов. Минимум 0.8г/кг.`);
  const fatQuality = {
    satG: Math.round(satG * 10) / 10,
    unsatG: Math.round((totalFatG - satG) * 10) / 10,
    satPct,
    targetSatPct,
    omega3G: Math.round(omega3G * 100) / 100,
    omega6to3ratio,
    status: fatQualityStatus,
    recommendation: fatRecs.join(' '),
  };

  // ─── 14. Meal timing quality ───
  const mealTimes = meals.filter(m => m.time).map(m => m.time!).sort((a, b) => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    return toMin(a) - toMin(b);
  });
  const timingGaps: string[] = [];
  let longestGap = 0;
  for (let i = 0; i < mealTimes.length - 1; i++) {
    if (!mealTimes[i].includes(':') || !mealTimes[i + 1].includes(':')) continue;
    const h1 = parseInt(mealTimes[i].split(':')[0]) + parseInt(mealTimes[i].split(':')[1]) / 60;
    const h2 = parseInt(mealTimes[i + 1].split(':')[0]) + parseInt(mealTimes[i + 1].split(':')[1]) / 60;
    const gap = h2 - h1;
    if (gap > longestGap) longestGap = gap;
    if (gap > 4.5) timingGaps.push(`Перерыв ${Math.round(gap * 10) / 10}ч (${mealTimes[i]}-${mealTimes[i + 1]})`);
  }
  // Pre/post workout detection
  let hasPreWorkout = false;
  let hasPostWorkout = false;
  if (workoutTime) {
    const wh = parseInt(workoutTime.split(':')[0]);
    meals.forEach(m => {
      if (m.time) {
        const mh = parseInt(m.time.split(':')[0]);
        if (mh >= wh - 2 && mh <= wh - 1) hasPreWorkout = true;
        if (mh >= wh + 1 && mh <= wh + 2) hasPostWorkout = true;
      }
    });
  }
  // Evening carb check
  const dinnerMeal = meals.find(m => m.label === 'Ужин' || m.label.toLowerCase().includes('ужин'));
  const eveningCarbOk = !dinnerMeal || dinnerMeal.totals.c < 60;
  // Protein spread check
  const proteinSpreadOk = evennessScore >= 60;
  const mealTiming = {
    mealCount: meals.length,
    longestGapHours: Math.round(longestGap * 10) / 10,
    hasPreWorkout,
    hasPostWorkout,
    eveningCarbOk,
    proteinSpreadOk,
    gaps: timingGaps,
    recommendation: [
      meals.length < 4 ? `Всего ${meals.length} приёмов — рекомендуется 4-6.` : `Приёмов пищи: ${meals.length} — оптимально.`,
      longestGap > 5 ? `Самый длинный перерыв ${Math.round(longestGap * 10) / 10}ч — добавьте перекус.` : 'Перерывы между приёмами в норме.',
      hasPreWorkout ? '' : workoutTime ? 'Нет приёма за 1-2ч до тренировки — добавьте белок + углеводы.' : '',
      hasPostWorkout ? '' : workoutTime ? 'Нет приёма после тренировки — пост-трен питание критически важно.' : '',
      eveningCarbOk ? '' : 'Ужин содержит >60г углеводов — при отёках/диабете рекомендуется снизить.',
      proteinSpreadOk ? '' : 'Белок распределён неравномерно — равномерное питание улучшает MPS.',
    ].filter(Boolean).join(' '),
  };

  // ─── 15. Fiber analysis ───
  let totalFiberG = 0;
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (food && food.fiber) {
      const ratio = item.amount / 100;
      totalFiberG += food.fiber * ratio;
    }
  });
  const fiberTarget = 30;
  const fiberPct = Math.round(totalFiberG / fiberTarget * 100);
  let fiberStatus: 'ok' | 'low' | 'critical' = 'ok';
  if (fiberPct < 50) fiberStatus = 'critical';
  else if (fiberPct < 80) fiberStatus = 'low';
  const fiberRec: string[] = [];
  if (fiberStatus === 'critical') fiberRec.push(`Критически мало клетчатки: ${totalFiberG.toFixed(1)}г из ${fiberTarget}г (${fiberPct}%). Добавьте: овсянка, гречка, бобовые, овощи, семена чиа.`);
  else if (fiberStatus === 'low') fiberRec.push(`Мало клетчатки: ${totalFiberG.toFixed(1)}г. Цель ${fiberTarget}г. Добавьте овощи к каждому приёму.`);
  else fiberRec.push(`Клетчатки достаточно: ${totalFiberG.toFixed(1)}г/день.`);
  const fiberAnalysis = {
    totalG: Math.round(totalFiberG * 10) / 10,
    targetG: fiberTarget,
    pct: fiberPct,
    status: fiberStatus,
    recommendation: fiberRec.join(' '),
  };

  // ─── 16. Calcium/Magnesium ratio ───
  const caMg = microTotals['Ca'] || 0;
  const mgMg = microTotals['Mg'] || 0;
  const caMgRatio = mgMg > 0 ? caMg / mgMg : 3;
  const targetCaMgRatio = 2.5;
  let caMgStatus = caMgRatio >= 1.5 && caMgRatio <= 3.5 ? 'ok' : caMgRatio > 3.5 ? 'high_ca' : 'low_ca';
  const caMgRecs: string[] = [];
  if (caMgRatio > 3.5) caMgRecs.push(`Ca/Mg = ${caMgRatio.toFixed(1)} (>3.5). Избыток Ca блокирует Mg. Добавьте Mg: орехи, семена, гречка, шпинат.`);
  else if (caMgRatio < 1.5) caMgRecs.push(`Ca/Mg = ${caMgRatio.toFixed(1)} — низкое соотношение.`);
  else caMgRecs.push(`Ca/Mg = ${caMgRatio.toFixed(1)} — оптимально (1.5-3.5).`);
  const calciumMagnesium = {
    caMg: Math.round(caMg * 10) / 10,
    mgMg: Math.round(mgMg * 10) / 10,
    ratio: Math.round(caMgRatio * 10) / 10,
    targetRatio: targetCaMgRatio,
    status: caMgStatus,
    recommendation: caMgRecs.join(' '),
  };

  // ════════════════════════════════════════════════
  // OVERALL GRADE (expanded with all new metrics)
  // ════════════════════════════════════════════════
  const targetPct = (kbjuPct.kcal + kbjuPct.p + kbjuPct.f + kbjuPct.c) / 4;
  const deficitCount = Object.values(micros).filter(m => m.status === 'critical').length;
  let gradePenalties = 0;
  if (waterStatus === 'critical') gradePenalties++;
  if (fiberStatus === 'critical') gradePenalties++;
  if (naKStatus === 'high') gradePenalties++;
  if (evennessScore < 50) gradePenalties++;
  if (satPct > 15) gradePenalties += 0.5;
  if (totalGL > 120) gradePenalties += 0.5;
  if (omega6to3ratio !== null && omega6to3ratio > 8) gradePenalties += 0.5;

  let overallGrade: 'A' | 'B' | 'C' | 'D';
  if (targetPct >= 85 && targetPct <= 115 && deficitCount === 0 && foodQualityScore >= 7 && gradePenalties <= 0.5) overallGrade = 'A';
  else if (targetPct >= 70 && targetPct <= 130 && deficitCount <= 2 && foodQualityScore >= 5 && gradePenalties <= 2) overallGrade = 'B';
  else if (targetPct >= 60 && targetPct <= 140 && deficitCount <= 4 && gradePenalties <= 3) overallGrade = 'C';
  else overallGrade = 'D';

  const gradeFactors: string[] = [];
  if (targetPct >= 85 && targetPct <= 115) gradeFactors.push('КБЖУ в норме');
  if (deficitCount === 0) gradeFactors.push('микронутриенты в норме');
  if (gradePenalties > 0) gradeFactors.push(`${gradePenalties} штрафов`);
  if (foodQualityScore < 7) gradeFactors.push('качество продуктов низкое');
  const overallGradeLabel = overallGrade === 'A'
    ? `Отлично — сбалансированный рацион (${gradeFactors.join(', ')})`
    : overallGrade === 'B'
    ? `Хорошо — небольшие отклонения (${gradeFactors.join(', ')})`
    : overallGrade === 'C'
    ? `Удовлетворительно — есть пробелы (${gradeFactors.join(', ')})`
    : `Требует коррекции (${gradeFactors.join(', ')})`;

  // ════════════════════════════════════════════════
  // RECOMMENDATIONS (expanded)
  // ════════════════════════════════════════════════
  const recommendations: string[] = [];
  if (deficitCount > 0) recommendations.push(`🔴 Критический дефицит ${deficitCount} микронутриентов. Добавьте: ${microDeficiencies.slice(0, 3).join('; ')}`);
  if (kbjuPct.kcal > 110) recommendations.push('📈 Калораж превышает цель на >10% — снизьте порции или увеличьте активность');
  if (kbjuPct.kcal < 90) recommendations.push('📉 Калораж ниже цели на >10% — добавьте приём пищи или увеличьте порции');
  if (kbjuPct.p < 90) recommendations.push('🥩 Белка недостаточно — добавьте курицу, рыбу, творог или протеин');
  if (kbjuPct.p > 120) recommendations.push('🥩 Белка избыточно — снизьте до 2г/кг для снижения нагрузки на почки');
  if (healthIssues.includes('oedema')) recommendations.push('🫧 При отёках: исключите солёное (кетчуп, соусы, колбасы), пейте 30-40мл/кг');
  if (healthIssues.includes('diabetes') && totals.c / Math.max(1, meals.length) > 50) recommendations.push('💉 При диабете: не более 50г углеводов за приём, предпочтение низкому GI');
  if (healthIssues.includes('gout')) recommendations.push('🦶 При подагре: исключите субпродукты, сардины, шпинат, алкоголь');
  if (healthIssues.includes('gi_issues')) recommendations.push('🫀 При проблемах ЖКТ: исключите газообразующие (капуста, бобовые), ешьте дробно');
  if (foodQualityScore < 6) recommendations.push('📦 Качество продуктов низкое — замените базовые на фермерские/премиум');
  if (allergenWarnings.length > 0) recommendations.push(`⚠️ ${allergenWarnings.length} продуктов содержат аллергены: ${[...new Set(allergenWarnings.flatMap(w => w.allergens))].join(', ')}`);
  // New recs
  if (waterStatus !== 'ok') recommendations.push(`💧 ${waterBalance.recommendation}`);
  if (naKStatus === 'high') recommendations.push(`🧂 ${sodiumPotassium.recommendation}`);
  if (evennessScore < 60) recommendations.push(`⏱ ${proteinTiming.recommendation}`);
  if (totalGL > 120) recommendations.push(`🍚 ${glycemicLoad.recommendation}`);
  if (satPct > 15) recommendations.push(`🥓 ${fatQuality.recommendation}`);
  if (longestGap > 5 || !hasPostWorkout) recommendations.push(`🕐 ${mealTiming.recommendation}`);
  if (fiberStatus !== 'ok') recommendations.push(`🥬 ${fiberAnalysis.recommendation}`);
  recommendations.push(`🏷 Основная рекомендация: ${overallGradeLabel}`);

  return {
    kbjuPerMeal, kbjuPct, micros, microDeficiencies,
    weightDynamicsBasic, weightDynamicsEnhanced,
    foodQualityScore, foodQualityDetails: { bestItems, weakItems, avgTier },
    riskAnalysis, allergenWarnings, planDecisions,
    overallGrade, overallGradeLabel, recommendations,
    generatedAt: new Date().toISOString(),
    // New sections
    waterBalance,
    sodiumPotassium,
    proteinTiming,
    glycemicLoad,
    fatQuality,
    mealTiming,
    fiberAnalysis,
    calciumMagnesium,
  };
}
