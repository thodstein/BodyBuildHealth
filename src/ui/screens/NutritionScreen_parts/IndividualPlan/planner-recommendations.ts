/**
 * planner-recommendations.ts — P1-7: generateRecommendations вынесен из IndividualPlanContext.
 *
 * Чистая функция: берёт собранный `RecsInput` и возвращает массив строк-рекомендаций.
 * Parent вызывает `setRecommendations(buildRecommendations(deps))`.
 */
import { FOOD_DB } from "../../../../core/nutrition-database";
import { analyzeDailyDiet, getDefaultProfile } from "../../../../engines/product-usefulness-v2.engine";
import { getNutritionV2Data } from "../../../../core/nutrition-v2-data";

export interface RecsInput {
  goal: string;
  phase: string;
  weight: number;
  effectiveKcal: number;
  effectiveP: number;
  effectiveF: number;
  effectiveC: number;
  injections: { type: string; dose: number; esterType?: string; name?: string }[];
  linkToTraining: boolean;
  trainStart: string;
  trainEnd: string;
  sex: 'male' | 'female';
  bodyFatPct: number;
  trainType: string;
  v2Phase: string;
  v2Pharma: Record<string, boolean>;
  v2Labs: Record<string, string>;
  histamineSensitive: boolean;
  generated: boolean;
  planDays: 1 | 3 | 7;
  dayPlan: any;
  threeDayPlan: any;
  weekPlan: any;
  dietPauseMode: string;
}

export function buildRecommendations(d: RecsInput): string[] {
  const recs: string[] = [];
  if (d.goal === 'mass') recs.push('💪 Профицит 300-500 ккал. Белок 1.8-2.2г/кг. Углеводы 4-5г/кг.');
  if (d.goal === 'fat_loss' || d.goal === 'cutting') recs.push('🔥 Дефицит 300-500 ккал. Белок 2.5г/кг критически важен.');
  if (d.goal === 'strength') recs.push('🏋️ Профицит 200-300 ккал. Углеводы 5-6г/кг в тренировочные дни.');
  if (d.goal === 'maintenance') recs.push('⚖️ Калории на уровне TDEE. Баланс 30/20/50.');
  if (d.goal === 'recomposition') recs.push('🔄 Калории = TDEE или -100-200. Белок 2.5г/кг.');
  if (d.goal === 'rehab') recs.push('🩹 Белок 2.5-3г/кг. ВСАА 15-20г/день. Омега-3 3-5г/день.');
  if (d.phase === 'course') recs.push('💉 Курс: белок 2.5г/кг, контроль печени, вода 40мл/кг.');
  if (d.phase === 'pct') recs.push('🔄 ПКТ: белок 2.2г/кг, цинк 50мг, D 5000МЕ, магний.');
  if (d.phase === 'cutting') recs.push('✂️ Сушка: 5-6 приёмов, контроль натрия, клетчатка.');
  if (d.injections.length > 0) {
    const hasInsulin = d.injections.some(i => i.type === 'инсулин');
    const hasShortInsulin = d.injections.some(i => i.type === 'инсулин' && i.esterType !== 'long');
    const hasGH = d.injections.some(i => i.type === 'ГР' || i.type === 'GHRP' || i.type === 'CJC');
    const hasIGF = d.injections.some(i => i.type === 'ИФР-1');
    const hasGLP = d.injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');
    const hasAAS = d.injections.some(i => i.type === 'ААС');
    const totalInsulinDose = d.injections.filter(i => i.type === 'инсулин' && i.esterType !== 'long').reduce((s, i) => s + i.dose, 0);
    if (hasAAS) recs.push('💉 ААС: белок +0.3г/кг, вода 40мл/кг, NAC/расторопша.');
    if (hasShortInsulin || hasInsulin) { recs.push(`💉 Инсулин: ${totalInsulinDose}ЕД × 10г = ${totalInsulinDose * 10}г угл. Минимум 150г угл/день.`); recs.push('🍔 На инсулине — минимум жиров в окне действия.'); }
    if (hasGH) recs.push('🧬 ГР: избегать угл в окне 60мин до/после. Вода +0.5-1л.');
    if (hasIGF) recs.push('🧬 ИФР-1: натощак за 30-45мин до еды. Контроль глюкозы.');
    if (hasGLP) recs.push('💊 GLP-1: дробно 5-6р по 100-200г. Жиры <5г/приём.');
  }
  if (d.linkToTraining) recs.push(`🏋️ Тренировка ${d.trainStart}-${d.trainEnd}. Предтрен за 1.5-2ч, пост-трен в течение 60-90мин.`);
  recs.push('✅ Белок с каждым приёмом. Овощи 300-500г/день. Вода 2.5-4л. Сон 7-9ч.');

  // ── v2-анализ сгенерированного рациона и правил справочника ──
  if (d.generated && d.dayPlan) {
    const profile = getDefaultProfile();
    profile.sex = d.sex;
    profile.bodyFatPct = d.bodyFatPct || 15;
    profile.discipline = (d.trainType === 'strength' ? 'powerlifting' : 'bodybuilding') as any;
    profile.phase = (d.v2Phase as any) || 'LEAN_MASS';
    profile.pharma.AAS_ORAL = d.v2Pharma.AAS_ORAL || false;
    profile.pharma.AAS_INJECTABLE = d.v2Pharma.AAS_INJECTABLE || false;
    profile.pharma.HGH = d.v2Pharma.HGH || false;
    profile.pharma.DIURETICS = d.v2Pharma.DIURETICS || false;
    profile.pharma.STIMULATORS = d.v2Pharma.STIMULATORS || false;
    profile.pharma.INSULIN_USE = d.v2Pharma.INSULIN_USE || false;
    profile.pharma.LIVER_SUPPORT = d.v2Pharma.LIVER_SUPPORT || false;
    profile.pharma.GUT_SUPPORT = d.v2Pharma.GUT_SUPPORT || false;
    profile.histamineSensitive = d.histamineSensitive;
    profile.labs.hematocrit = d.v2Labs.hematocrit ? parseFloat(d.v2Labs.hematocrit) : undefined;
    profile.labs.hemoglobin = d.v2Labs.hemoglobin ? parseFloat(d.v2Labs.hemoglobin) : undefined;
    profile.labs.ldl = d.v2Labs.ldl ? parseFloat(d.v2Labs.ldl) : undefined;
    profile.labs.alt = d.v2Labs.alt ? parseFloat(d.v2Labs.alt) : undefined;
    profile.labs.ast = d.v2Labs.ast ? parseFloat(d.v2Labs.ast) : undefined;
    profile.labs.crp = d.v2Labs.crp ? parseFloat(d.v2Labs.crp) : undefined;
    profile.weightKg = d.weight || 80;
    profile.lbm = profile.weightKg * (100 - profile.bodyFatPct) / 100;

    const planDaysForAnalysis = d.planDays >= 7 ? (d.weekPlan?.days || [d.dayPlan]).filter(Boolean)
      : d.planDays >= 3 ? (d.threeDayPlan?.days || [d.dayPlan]).filter(Boolean)
      : [d.dayPlan].filter(Boolean);
    const allMealsForV2 = planDaysForAnalysis.flatMap((dp: any) =>
      (dp.meals || []).map((m: any) => ({
        timing: (m.timing || 'regular') as any,
        products: (m.items || []).map((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
          return { foodId: food?.id || it.name || 'unknown', weightGrams: it.amount || 100 };
        }).filter((p: any) => p.weightGrams > 0),
      }))
    );
    // P1-fix: guard от деления на 0 — если planDaysForAnalysis пуст (dayPlan=null),
    // daysCount был 0 → reduce/0 = NaN в рекомендациях
    const daysCount = Math.max(1, planDaysForAnalysis.length);
    const daily = analyzeDailyDiet(allMealsForV2, profile);
    const totalKcal = Math.round(planDaysForAnalysis.reduce((s: number, dp: any) => s + (dp.totals?.kcal || 0), 0) / daysCount);
    const totalP = Math.round(planDaysForAnalysis.reduce((s: number, dp: any) => s + (dp.totals?.p || 0), 0) / daysCount);
    const mealsCount = Math.round(allMealsForV2.length / daysCount);

    if (!daily.mtorTriggered) recs.push(`🧬 mTOR не запущен — дефицит ${daily.mtorDeficitMg}мг лейцина. Добавьте 30-40г сывороточного протеина или 200г курицы.`);
    else recs.push('🧬 mTOR запущен — лейцин >3г/день ✅');
    if (daily.diaasWarning) recs.push(`💪 ${daily.diaasWarning}`);
    if (daily.giLoadWarning) recs.push(`🧬 Высокая гликемическая нагрузка (${Math.round(daily.giLoad)} GL). Разнесите углеводы по приёмам и замените часть быстрых углеводов на низко-GI источники.`);
    if (daily.electrolyteRisk) recs.push(`💧 Риск электролитов: K ${Math.round(daily.potassiumMg)}мг, Mg ${Math.round(daily.magnesiumMg)}мг. Добавьте шпинат, авокадо, орехи.`);
    if (daily.omegaWarning) recs.push(`🐟 ${daily.omegaWarning}. Добавьте жирную рыбу 2-3р/нед или омега-3 2-4г/день.`);
    if (daily.antinutrientWarning) recs.push(daily.antinutrientWarning);
    if (daily.glutathioneWarning) recs.push(daily.glutathioneWarning);
    if (daily.histamineWarning) recs.push(daily.histamineWarning);
    if (daily.microDeficits.length > 0) recs.push(`⚠️ Дефициты микронутриентов: ${daily.microDeficits.join(', ')}. Рассмотрите приём ВМК.`);
    if (mealsCount < 4) recs.push('📋 Меньше 4 приёмов — распределите белок равномерно для MPS.');
    if (mealsCount > 6) recs.push('📋 Больше 6 приёмов — возможно дробление порций, проверьте насыщение.');
    if (totalP < d.weight * 1.8) recs.push(`🥩 Белок ${totalP}г (${(totalP / d.weight).toFixed(1)}г/кг) — ниже ${d.weight * 1.8}г. Увеличьте белок до 2г/кг.`);
    if (profile.labs.ldl && profile.labs.ldl > 4.2) recs.push('🩸 ЛПНП >4.2 ммоль/л — ограничьте насыщенные жиры (жирное мясо, сливочное масло).');
    if (profile.labs.alt && profile.labs.alt > 45) recs.push('🫁 АЛТ >45 Ед/л — добавьте NAC 600-1200мг, расторопшу 280мг, TUDCA 500мг.');
    if (profile.labs.crp && profile.labs.crp > 3) recs.push('🔥 СРБ >3 мг/л — добавьте омега-3 3-5г/день, полифенолы (куркума 500мг, зелёный чай).');

    const targetKcal = d.effectiveKcal || (d.weight * 33);
    if (Math.abs(totalKcal - targetKcal) > 200) {
      const dir = totalKcal > targetKcal ? 'превышение' : 'недобор';
      recs.push(`📊 ${dir.toUpperCase()} ${Math.abs(totalKcal - targetKcal)} ккал от цели (${targetKcal}). Откорректируйте приёмы.`);
    }
  }

  // ── Refeed / Reverse diet рекомендации ──
  if (d.goal === 'fat_loss' || d.goal === 'cutting') {
    const deficitWeeks = (() => { try { const nv2 = getNutritionV2Data(); return nv2.dietWeeks || 0; } catch { return 0; } })();
    if (deficitWeeks >= 2) {
      const refeedCarbsG = Math.round(d.weight * 5);
      const refeedKcal = Math.round(d.effectiveP * 4 + d.effectiveF * 9 + refeedCarbsG * 4);
      recs.push(`🔄 Refeed: каждые 7-14 дней — ${refeedCarbsG}г углеводов (~${refeedKcal} ккал). Жиры ≤0.5 г/кг. Длительность: 24ч.`);
      if (deficitWeeks >= 8) {
        const reverseKcal = Math.round(d.effectiveKcal * 1.15);
        recs.push(`📈 Reverse diet: метаболическая адаптация ${deficitWeeks}+ нед. Выход: +50-100 ккал/нед до TDEE. Текущий целевой разгон: ~${reverseKcal} ккал.`);
      }
    }
  }
  if (d.dietPauseMode === 'refeed') {
    recs.push(`🍽 Refeed активен: ${d.weight > 0 ? Math.round(d.weight * 5) : '300'}г углеводов, жиры ${d.weight > 0 ? Math.round(d.weight * 0.5) : '40'}г. Не чаще 1р/нед на дефиците.`);
  }
  if (d.dietPauseMode === 'diet_5_2') {
    recs.push(`📅 5:2 протокол: 5 дней maintenance + 2 дня дефицит (~${Math.round(d.effectiveKcal * 0.7)} ккал). Поддерживает метаболизм.`);
  }
  return recs;
}