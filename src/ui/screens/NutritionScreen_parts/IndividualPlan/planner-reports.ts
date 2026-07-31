/**
 * planner-reports.ts — чистые функции отчётов планировщика (P1-7: вынесены из IndividualPlanContext.tsx).
 *
 * Imam API: generateAllergenReport/generateNutrientReport/generateQualityReport/generateRiskReport
 * принимают явные входы (dayPlan + параметры) и возвращают отчёт-объект.
 *
 * Контекст вызова (state, allergens, weight) остаётся в IndividualPlanContext; чистые функции
 * здесь тестируемы и не зависят от React.
 */

import type { FoodItem } from "../../../../core/nutrition-database";

export interface AllergenReport { conflicts: { food: string; allergens: string[] }[]; riskLevel: 'low' | 'medium' | 'high'; summary: string; }
export interface NutrientReport { micros: Record<string, any>; gaps: string[]; }
export interface QualityReport { avgScore: number; bbsAvg: number; budget: string; budgetRange: string; budgetOk: boolean; bestItems: string[]; weakItems: string[]; recommendations: string[]; }
export interface RiskReport { systems: Record<string, any>; totalRisk: string; summary: string; }
export interface DrugCompatReport { interactions: any[]; warnings: string[]; positions?: any[]; }

function matchesSelectedAllergen(food: any, allergen: string): boolean {
  if (!food?.allergens) return false;
  const fa = food.allergens as string[];
  return fa.some(a => a.toLowerCase().includes(allergen.toLowerCase()) || allergen.toLowerCase().includes(a.toLowerCase()));
}

function planItems(dayPlan: any): any[] {
  const meals = Array.isArray(dayPlan?.meals) ? dayPlan.meals : [];
  return meals.flatMap((m: any) => Array.isArray(m?.items) ? m.items : []);
}

export function generateAllergenReportPure(dayPlan: any, allergens: string[], foodDb: FoodItem[]): AllergenReport {
  if (!dayPlan) return { conflicts: [], riskLevel: 'low', summary: 'Нет плана' };
  const allergenIds = new Set(allergens);
  const conflicts: { food: string; allergens: string[] }[] = [];
  planItems(dayPlan).forEach((it: any) => {
    const food = foodDb.find(f => f.id === it.id || f.name === it.name);
    if (food?.allergens) {
      const matched = [...allergenIds].filter(a => matchesSelectedAllergen(food, a));
      if (matched.length > 0) conflicts.push({ food: it.name, allergens: matched });
    }
  });
  const riskLevel = conflicts.length === 0 ? 'low' : conflicts.length <= 3 ? 'medium' : 'high';
  return {
    conflicts,
    riskLevel,
    summary: conflicts.length === 0 ? '✅: всех аллергенов нет' : `⚠ ${conflicts.length} аллергенов найдено`,
  };
}

export function generateNutrientReportPure(dayPlan: any, foodDb: FoodItem[]): NutrientReport {
  if (!dayPlan) return { micros: {}, gaps: [] };
  const micros: Record<string, number> = {};
  planItems(dayPlan).forEach((it: any) => {
    const food = foodDb.find(f => f.id === it.id || f.name === it.name);
    if (food?.micros) Object.entries(food.micros).forEach(([k, v]) => { if (v) micros[k] = (micros[k] || 0) + (v as number) * (it.amount / 100); });
  });
  const targets: Record<string, number> = { Ca: 1000, Fe: 18, Mg: 400, Zn: 15, K: 3500, Se: 55, VitC: 100, VitD: 15, VitB12: 2.4, Omega3: 1.6 };
  const results: Record<string, any> = {};
  const gaps: string[] = [];
  Object.entries(targets).forEach(([k, t]) => {
    const actual = Math.round((micros[k] || 0) * 10) / 10;
    const pct = Math.round(actual / t * 100);
    results[k] = { actual, target: t, pct, status: pct >= 80 ? 'ok' : pct >= 50 ? 'low' : 'critical' };
    if (pct < 80) gaps.push(`${k}: ${actual} из ${t} (${pct}%)`);
  });
  return { micros: results, gaps: gaps.length === 0 ? ['✅: всё в норме'] : gaps };
}

export function generateQualityReportPure(dayPlan: any, budget: string, foodDb: FoodItem[]): QualityReport {
  if (!dayPlan) return { avgScore: 0, bbsAvg: 0, budget, budgetRange: '?', budgetOk: true, bestItems: [], weakItems: [], recommendations: [] };
  const scores: any[] = [];
  planItems(dayPlan).forEach((it: any) => {
    const food = foodDb.find(f => f.id === it.id || f.name === it.name);
    if (!food) return;
    let score = 5;
    const pd = (food.protein * 4) / Math.max(food.kcal, 1);
    if (pd > 0.6) score += 2; else if (pd > 0.3) score += 1;
    if ((food.fiber || 0) >= 3) score += 1;
    if (food.tier === 'max') score = 10;
    else if (food.tier === 'mid') score = Math.max(score, 8);
    else if (food.tier === 'basic') score = Math.max(score, 6);
    scores.push({ name: it.name, score: Math.min(10, score), bbs: food.bb_quality_score || 0, category: food.category });
  });
  const avg = Math.round(scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length) * 10) / 10;
  const bbsAvg = Math.round(scores.reduce((s, x) => s + x.bbs, 0) / Math.max(1, scores.length) * 10) / 10;
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const budgetRange = budget === 'low' ? '?1-5' : budget === 'medium' ? '?5-8' : budget === 'max' ? '?8-10' : '?9-10';
  const budgetOk = (budget === 'low' && bbsAvg <= 5) || (budget === 'medium' && bbsAvg >= 5 && bbsAvg <= 8) || ((budget === 'max' || budget === 'enhanced') && bbsAvg >= 8);
  const recommendations: string[] = !budgetOk
    ? [`Ваш бюджет «${budget}» (${budgetRange}), но средний bb_quality_score составил ${bbsAvg}. ${budget === 'low' ? 'Смените категорию на более дорогие продукты.' : (budget === 'max' || budget === 'enhanced') ? 'Попробуйте подобрать более качественные продукты.' : 'Откорректируйте бюджет или продуктовую корзину.'}`]
    : avg < 6 ? ['Качество продуктов слабое, пересмотрите подбор'] : avg >= 8 ? [`✅: Отлично! Средний bb_quality_score ${bbsAvg} соответствуют категории ${budgetRange}.`] : [];
  return {
    avgScore: avg, bbsAvg, budget, budgetRange, budgetOk,
    bestItems: sorted.filter(s => s.score >= 8).map(s => s.name).slice(0, 5),
    weakItems: sorted.filter(s => s.score <= 5).map(s => s.name).slice(0, 5),
    recommendations,
  };
}

export function generateRiskReportPure(dayPlan: any, weight: number): RiskReport {
  if (!dayPlan) return { systems: {}, totalRisk: '—', summary: 'Нет плана' };
  const systems: Record<string, any> = {};
  const allItems = planItems(dayPlan);
  const totalFat = allItems.reduce((s: number, it: any) => s + (it.f || 0), 0);
  const totalKcal = allItems.reduce((s: number, it: any) => s + (it.kcal || 0), 0);
  const fatPct = totalKcal > 0 ? totalFat * 9 / totalKcal * 100 : 0;
  systems.hepatic = {
    score: fatPct > 40 ? 7 : fatPct > 30 ? 5 : fatPct > 20 ? 3 : 1,
    impact: fatPct > 35 ? 'перегрузка печени' : 'в норме',
    recommendation: fatPct > 35 ? 'Снизьте жиры до 25-30%' : 'в норме',
  };
  const proteinGPerKg = Math.round((allItems.reduce((s: number, it: any) => s + (it.p || 0), 0) / weight) * 10) / 10;
  systems.renal = {
    score: proteinGPerKg > 3 ? 7 : proteinGPerKg > 2.5 ? 5 : proteinGPerKg > 2 ? 3 : 1,
    impact: `${proteinGPerKg.toFixed(1)} г/кг`,
    recommendation: proteinGPerKg > 2.5 ? 'Белковый переизбыток' : 'в норме',
  };
  const totalScore = Object.values(systems).reduce((s: number, sys: any) => s + sys.score, 0);
  return {
    systems,
    totalRisk: totalScore <= 8 ? 'Низкий' : totalScore <= 14 ? 'Средний' : 'Высокий',
    summary: totalScore <= 8 ? '✅: низкая нагрузка на ССС' : totalScore <= 14 ? '⚠ есть зона нагрузки' : '🚨 перегрузка системы организма',
  };
}

// ─── P1-7: generateDrugCompatReport вынесен из context ──────────────
export interface DrugCompatInput {
  dayPlan: any;
  injections: { type: string; dose: number; name?: string; esterType?: string }[];
  weight: number;
  v2Pharma: Record<string, boolean>;
  phase: string;
  takenSupplements: string[];
}

export function generateDrugCompatReportPure(input: DrugCompatInput): { interactions: any[]; warnings: string[] } {
  const injections = Array.isArray(input.injections) ? input.injections : [];
  if (!input.dayPlan || injections.length === 0) return { interactions: [], warnings: [] };
  const warnings: string[] = [];
  const meals = Array.isArray(input.dayPlan.meals) ? input.dayPlan.meals : [];
  const allItems = meals.flatMap((m: any) => Array.isArray(m?.items) ? m.items : []);
  const allFoodNames = allItems.map((it: any) => ({ id: it.id, name: it.name?.toLowerCase() || '' })).join(' ');

  injections.forEach(inj => {
    const t = inj.type?.toLowerCase() || '';
    if (t.includes('инсулин')) { const totalCarbs = input.dayPlan.totals?.c || 0; if (totalCarbs < 150) warnings.push(`💉 ${inj.name}: ${Math.round(totalCarbs)}г угл/день — риск гипогликемии. Минимум 150г.`); }
    if (t.includes('семаглутид') || t.includes('тирзепатид')) { const totalFat = input.dayPlan.totals?.f || 0; if (totalFat > input.weight * 0.6) warnings.push(`💊 ${inj.name}: жиры ${totalFat}г/день — риск тошноты/панкреатита при GLP-1. Ограничьте до ${Math.round(input.weight * 0.5)}г.`); }
  });

  const _hasOralAAS = input.v2Pharma?.AAS_ORAL || injections.some(i => i.type === 'ААС' && /метан|станазол|оксан|туринаб|анадрол|анабол/i.test(i.name || ''));
  const _hasInjectAAS = input.v2Pharma?.AAS_INJECTABLE || injections.some(i => i.type === 'ААС');
  const _hasPCT = input.phase === 'pct';

  if (_hasOralAAS) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('🔴 Оральные ААС + грейпфрут: ингибирование CYP3A4 → рост гепатотоксичности. Полностью исключите грейпфрут!');
    if (/алкогол|пив|вин|водк|beer|wine|alcohol/i.test(allFoodNames)) warnings.push('🔴 Оральные ААС + алкоголь: аддитивное гепатотоксическое действие. Исключите алкоголь на курсе!');
    if (/творог|молоко|сыр|кефир|йогурт|dairy|cottage|milk|cheese|yogurt/i.test(allFoodNames)) warnings.push('🟡 Оральные ААС + молочные: кальций снижает эмульгацию/абсорбцию 17α-алкил-ААС. Интервал 2-3 ч.');
    if (/отруби|bran|чечевиц|lentils|фасол|beans|овсян|oats/i.test(allFoodNames)) warnings.push('🟡 Оральные ААС + высоко-клетчаточные: фитаты связывают липофильные ААС (−15-25% абсорбции). Интервал 1-2 ч.');
  }
  if (_hasInjectAAS && /алкогол|пив|вин|водк|alcohol/i.test(allFoodNames)) warnings.push('🟡 Инъекционные ААС + алкоголь: нагрузка на печень/липиды. Ограничьте алкоголь.');
  if (_hasPCT) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('🟠 ПКТ (SERM/AI) + грейпфрут: CYP3A4 → рост концентрации тамоксифена/кломифена. Избегайте грейпфрут.');
    if (!/творог|молоко|сыр|kefir|dairy|cheese|tofu|сардин|sardines|кальц/i.test(allFoodNames)) warnings.push('🟠 ПКТ + ингибиторы ароматазы → деминерализация костей. Увеличьте Ca (1200 мг): творог, сыр, сардины.');
  }

  const supps = input.takenSupplements || [];
  if (supps.some(s => s.includes('statin') || s.includes('atorva') || s.includes('rosuva') || s.includes('simva'))) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('💊 Статины + грейпфрут: ингибирование CYP3A4 → риск рабдомиолиза. Исключите грейпфрут!');
  }
  if (supps.some(s => s.includes('warfarin') || s.includes('варфарин'))) {
    if (/шпинат|капуст|брокколи|зелен|spinach|kale|broccoli|cabbage|green/i.test(allFoodNames)) warnings.push('💊 Варфарин + витамин K (зелень/капуста): снижение INR → риск тромбоза. Контролируйте потребление зелени.');
  }
  if (supps.some(s => s.includes('enalapril') || s.includes('lisino') || s.includes('ramipril') || s.includes('telmisartan') || s.includes('losartan'))) {
    if (/банан|картоф|шпинат|авокадо|томат|potato_boiled|banana|spinach|avocado|tomato/i.test(allFoodNames)) warnings.push('💊 ACEi/ARB + калий-богатые продукты: риск гиперкалиемии. Ограничьте бананы/картофель/шпинат.');
  }
  if (supps.some(s => s.includes('metformin') || s.includes('метформин'))) {
    if (/алкогол|пив|вин|водк|alcohol|beer|wine/i.test(allFoodNames)) warnings.push('💊 Метформин + алкоголь: риск лактатацидоза. Исключите алкоголь.');
  }
  if (supps.some(s => s.includes('nebivolol') || s.includes('metoprolol') || s.includes('bisoprolol') || s.includes('carvedilol'))) {
    if (/грейпфрут|grapefruit/i.test(allFoodNames)) warnings.push('💊 Бета-блокаторы + грейпфрут: потенцирование гипотензии. Исключите грейпфрут.');
  }
  if (supps.some(s => s.includes('maoi') || s.includes('phenelzine') || s.includes('tranylcypromine'))) {
    if (/сыр|колбас|сосис|ветчин|копч|вялен|cheese|sausage|cured|smoked/i.test(allFoodNames)) warnings.push('💊 MAOI + тирамин (сыр/копчёности): риск гипертонического криза! Исключите выдержанные сыры и копчёности.');
  }
  if (supps.some(s => s.includes('finasteride') || s.includes('dutasteride') || s.includes('финастерид'))) {
    warnings.push('💊 Финастерид/Дутастерид: избегать контакта беременных с препаратом. Хранить отдельно.');
  }

  if (warnings.length === 0) warnings.push('✅ Все препараты совместимы с планом питания');
  return { interactions: [], warnings };
}
