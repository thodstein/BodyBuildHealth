export interface NutritionReportInput {
  meals: { label: string; items: { name: string; id: string; amount: number; kcal: number; p: number; f: number; c: number }[]; totals: { kcal: number; p: number; f: number; c: number } }[];
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

export function generateNutritionReport(input: NutritionReportInput): NutritionReport {
  const { meals, totals, targets, userWeight, userTDEE, healthIssues, planType, variety, budget, allergens, cyclingMode, goal } = input;

  // 1. KBJU per meal
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

  // 2. KBJU % completion
  const kbjuPct = {
    kcal: targets.kcal > 0 ? Math.round(totals.kcal / targets.kcal * 100) : 0,
    p: targets.protein > 0 ? Math.round(totals.p / targets.protein * 100) : 0,
    f: targets.fats > 0 ? Math.round(totals.f / targets.fats * 100) : 0,
    c: targets.carbs > 0 ? Math.round(totals.c / targets.carbs * 100) : 0,
  };

  // 3. Micros from all food items
  const microTotals: Record<string, number> = {};
  const microFoods: Record<string, Set<string>> = {};
  const allItems = meals.flatMap(m => m.items);
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

  const micros: Record<string, { actual: number; target: number; pct: number; status: 'ok' | 'low' | 'critical'; foods: string[] }> = {};
  const microDeficiencies: string[] = [];
  Object.entries(MICRO_TARGETS).forEach(([k, target]) => {
    const actual = Math.round((microTotals[k] || 0) * 10) / 10;
    const pct = Math.round(actual / target * 100);
    const status: 'ok' | 'low' | 'critical' = pct >= 80 ? 'ok' : pct >= 50 ? 'low' : 'critical';
    micros[k] = { actual, target, pct, status, foods: [...(microFoods[k] || [])] };
    if (status !== 'ok') microDeficiencies.push(`${MICRO_LABELS[k] || k}: ${actual} из ${target} (${pct}%)`);
  });

  // 4. Weight dynamics
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

  // 5. Food quality score
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

  // 6. Risk analysis
  const fatKcalPct = totals.kcal > 0 ? (totals.f * 9 / totals.kcal * 100) : 0;
  const proteinGperKgVal = userWeight > 0 ? totals.p / userWeight : 0;
  const riskAnalysis = [
    { system: 'Печень', score: fatKcalPct > 40 ? 6 : fatKcalPct > 35 ? 4 : 2, maxScore: 7, impact: fatKcalPct > 40 ? 'Высокое содержание жиров' : 'Умеренное', recommendation: fatKcalPct > 40 ? 'Снизить долю жиров до 25-30%' : 'Норма' },
    { system: 'Почки', score: proteinGperKgVal > 2.5 ? 6 : proteinGperKgVal > 2.0 ? 4 : 2, maxScore: 7, impact: proteinGperKgVal > 2.0 ? 'Повышенная нагрузка' : 'Норма', recommendation: proteinGperKgVal > 2.5 ? 'Снизить белок до 2г/кг' : 'Адекватно' },
    { system: 'Воспаление', score: healthIssues.includes('oedema') || healthIssues.includes('gi_issues') ? 5 : 3, maxScore: 7, impact: 'Системное воспаление', recommendation: 'Омега-3, куркумин, исключение трансжиров' },
    { system: 'Инсулин', score: totals.c / Math.max(1, meals.length) > 60 ? 5 : 3, maxScore: 7, impact: 'Гликемическая нагрузка', recommendation: 'Дробные углеводы, до 50г/приём' },
    { system: 'Электролиты', score: 3, maxScore: 5, impact: 'Баланс Na/K', recommendation: 'Достаточно K из овощей' },
  ];

  // 7. Allergen warnings
  const allergenWarnings: { food: string; allergens: string[] }[] = [];
  allItems.forEach(item => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (food?.allergens) {
      const matched = food.allergens.filter(a => allergens.includes(a));
      if (matched.length > 0) allergenWarnings.push({ food: item.name, allergens: matched });
    }
  });

  // 8. Plan decisions documentation
  const planDecisions = [
    { param: 'Цель', value: goal === 'mass' ? 'Набор массы' : goal === 'cut' ? 'Сушка' : goal === 'strength' ? 'Сила' : 'Поддержание', impact: goal === 'mass' ? 'Профицит 10-15%' : goal === 'cut' ? 'Дефицит 20%' : 'Баланс' },
    { param: 'Тип плана', value: planType || 'Классический', impact: `Коррекция БЖУ под ${planType}` },
    { param: 'Бюджет', value: budget || 'Средний', impact: `Фильтр продуктов по цене` },
    { param: 'Разнообразие', value: variety || 'Максимум', impact: variety === 'minimal' ? '2-3 продукта/категорию' : variety === 'medium' ? '4-5 продуктов' : 'Весь пул' },
    { param: 'Циклирование', value: cyclingMode || 'Нет', impact: cyclingMode !== 'none' ? 'Чередование дней' : 'Одинаковый режим' },
    { param: 'Аллергены', value: allergens.length > 0 ? `${allergens.length} исключено` : 'Нет', impact: allergens.length > 0 ? 'Исключены продукты-аллергены' : 'Без ограничений' },
    { param: 'Проблемы со здоровьем', value: healthIssues.length > 0 ? healthIssues.join(', ') : 'Нет', impact: healthIssues.length > 0 ? 'Исключены провоцирующие продукты' : 'Без ограничений' },
  ];

  // 9. Overall grade
  const targetPct = (kbjuPct.kcal + kbjuPct.p + kbjuPct.f + kbjuPct.c) / 4;
  const deficitCount = microDeficiencies.filter(d => d.includes('critical')).length;
  let overallGrade: 'A' | 'B' | 'C' | 'D';
  if (targetPct >= 85 && targetPct <= 115 && deficitCount === 0 && foodQualityScore >= 7) overallGrade = 'A';
  else if (targetPct >= 70 && targetPct <= 130 && deficitCount <= 2 && foodQualityScore >= 5) overallGrade = 'B';
  else if (targetPct >= 60 && targetPct <= 140 && deficitCount <= 4) overallGrade = 'C';
  else overallGrade = 'D';

  const overallGradeLabel = overallGrade === 'A' ? 'Отлично — сбалансированный рацион' : overallGrade === 'B' ? 'Хорошо — небольшие отклонения' : overallGrade === 'C' ? 'Удовлетворительно — есть пробелы' : 'Требует коррекции';

  // 10. Recommendations
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
  recommendations.push(`🏷 Основная рекомендация: ${overallGradeLabel}`);

  return {
    kbjuPerMeal, kbjuPct, micros, microDeficiencies,
    weightDynamicsBasic, weightDynamicsEnhanced,
    foodQualityScore, foodQualityDetails: { bestItems, weakItems, avgTier },
    riskAnalysis, allergenWarnings, planDecisions,
    overallGrade, overallGradeLabel, recommendations,
    generatedAt: new Date().toISOString(),
  };
}
