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
import { sumMicros, analyzeMicroCoverage, getMicroTargets, type Sex, type CyclePhase, type FoodDbLike } from "./planner-micro-coverage";

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
  // P0-fix: null-guard на allergens — new Set(null) бросает TypeError
  const allergenIds = new Set(Array.isArray(allergens) ? allergens : []);
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
  return generateNutrientReportDetailed(dayPlan, foodDb, 'male', 80, undefined, false);
}

export function generateNutrientReportDetailed(
  dayPlan: any, foodDb: FoodItem[],
  sex: Sex, weightKg: number, phase: CyclePhase, isTrainingDay: boolean,
): NutrientReport {
  if (!dayPlan) return { micros: {}, gaps: [] };
  const items = planItems(dayPlan).map((it: any) => ({ id: it.id, amount: it.amount || 0 }));
  const totals = sumMicros(items, foodDb as unknown as FoodDbLike[]);
  const res = analyzeMicroCoverage(totals, sex, weightKg, phase, isTrainingDay);
  const results: Record<string, any> = {};
  for (const c of res.coverage) {
    results[c.nutrient] = { actual: c.actual, target: c.target, pct: c.pct, status: c.status === 'ok' ? 'ok' : c.status === 'high' ? 'high' : c.status === 'low' ? 'low' : 'critical', unit: c.unit };
  }
  const gaps = res.deficits.length === 0 && res.surpluses.length === 0
    ? ['✅: всё в норме']
    : [...res.deficits, ...res.surpluses];
  return { micros: results, gaps };
}

export function generateQualityReportPure(dayPlan: any, budget: string, foodDb: FoodItem[]): QualityReport {
  // Эпик 4 (NUTRITION-PROFESSIONAL-PLAN): ЕДИНЫЙ источник качества — bb_quality_score
  // (V2-скоринг продукта, product-usefulness-v2). Прежняя самодельная эвристика
  // (pd/fiber/tier) удалена — отчёт «Качество» и V2-карточки показывают одну шкалу.
  // P2-fix: guard на budget=null — раньше давал "Ваш бюджет «undefined»" в UI
  const b = budget || 'medium';
  if (!dayPlan) return { avgScore: 0, bbsAvg: 0, budget: b, budgetRange: '?', budgetOk: true, bestItems: [], weakItems: [], recommendations: [] };
  const scores: any[] = [];
  planItems(dayPlan).forEach((it: any) => {
    const food = foodDb.find(f => f.id === it.id || f.name === it.name);
    if (!food) return;
    const bbs = Number(food.bb_quality_score) || 0;
    // fallback-эвристика только для продуктов без V2-скора (не должно случаться в FOOD_DB)
    let score = bbs > 0 ? bbs : 5;
    if (bbs <= 0) {
      const pd = (food.protein * 4) / Math.max(food.kcal, 1);
      if (pd > 0.6) score += 2; else if (pd > 0.3) score += 1;
      if ((food.fiber || 0) >= 3) score += 1;
    }
    scores.push({ name: it.name, score: Math.min(10, score), bbs, category: food.category });
  });
  const avg = Math.round(scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length) * 10) / 10;
  const bbsAvg = Math.round(scores.reduce((s, x) => s + x.bbs, 0) / Math.max(1, scores.length) * 10) / 10;
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const budgetRange = b === 'low' ? '?1-5' : b === 'medium' ? '?5-8' : b === 'max' ? '?8-10' : '?9-10';
  const budgetOk = (b === 'low' && bbsAvg <= 5) || (b === 'medium' && bbsAvg >= 5 && bbsAvg <= 8) || (b === 'max' && bbsAvg >= 8);
  const recommendations: string[] = !budgetOk
    ? [`Ваш бюджет «${b}» (${budgetRange}), но средний bb_quality_score составил ${bbsAvg}. ${b === 'low' ? 'Смените категорию на более дорогие продукты.' : b === 'max' ? 'Попробуйте подобрать более качественные продукты.' : 'Откорректируйте бюджет или продуктовую корзину.'}`]
    : avg < 6 ? ['Качество продуктов слабое, пересмотрите подбор'] : avg >= 8 ? [`✅: Отлично! Средний bb_quality_score ${bbsAvg} соответствуют категории ${budgetRange}.`] : [];
  return {
    avgScore: avg, bbsAvg, budget: b, budgetRange, budgetOk,
    bestItems: sorted.filter(s => s.score >= 8).map(s => s.name).slice(0, 5),
    weakItems: sorted.filter(s => s.score <= 5).map(s => s.name).slice(0, 5),
    recommendations,
  };
}

export function generateRiskReportPure(dayPlan: any, weight: number): RiskReport {
  if (!dayPlan) return { systems: {}, totalRisk: '—', summary: 'Нет плана' };
  // P0-fix: weight guard — деление на 0/null даёт Infinity, ломая медклассификацию
  const w = weight && weight > 0 ? weight : 80;
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
  const proteinGPerKg = Math.round((allItems.reduce((s: number, it: any) => s + (it.p || 0), 0) / w) * 10) / 10;
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
