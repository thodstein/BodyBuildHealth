/**
 * planner-special-meals.ts — P1-7: генераторы специальных режимов еды вынесены из IndividualPlanContext.
 *
 * Чистые функции (без React state): возвращают объект плана. Parent вызывает setter-ы.
 * Контракт: каждый генератор берёт ВХОДЫ (вес, цель, тренировочные дни и пр.) — НЕ state-сеттеры.
 */
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getNutritionV2Data } from "../../../../core/nutrition-v2-data";

export interface SpecialMealDeps {
  weight: number;
  effectiveKcal: number;
  effectiveP: number;
  effectiveF: number;
  effectiveC: number;
  goal: string;
  cravingDays: number;
  lazyDayDays: number;
  trainingDays: boolean[];
  // FIX allergens-restrictions: спец-режимы тоже уважают исключения пользователя
  excludedIds?: string[];
}

// FIX allergens-restrictions: общий фильтр продуктов для спец-режимов
const notExcluded = (excludedIds: string[] | undefined) => (f: any) =>
  !excludedIds || excludedIds.length === 0 || !excludedIds.includes(f.id);

export function generateCheatMeal(deps: SpecialMealDeps): any {
  const cals = Math.round(deps.effectiveKcal * 0.35);
  const items = FOOD_DB.filter(f => f.category === 'fast_food' || (f.kcal > 200 && (f.name.toLowerCase().includes('бургер') || f.name.toLowerCase().includes('пицц') || f.name.toLowerCase().includes('картофель фри') || f.name.toLowerCase().includes('чипс') || f.name.toLowerCase().includes('шоколад') || f.name.toLowerCase().includes('морожен') || f.name.toLowerCase().includes('пончик')))).filter(notExcluded(deps.excludedIds)).sort(() => Math.random() - 0.5).slice(0, 2);
  const bju = { kcal: cals, p: Math.round(cals * 0.08 / 4), f: Math.round(cals * 0.40 / 9), c: Math.round(cals * 0.52 / 4) };
  // P1-fix: добавляем bjuBreakdown (раньше UI рендерил undefined)
  const bjuBreakdown = `${Math.round(bju.p * 4 / cals * 100)}% Б / ${Math.round(bju.f * 9 / cals * 100)}% Ж / ${Math.round(bju.c * 4 / cals * 100)}% У`;
  return {
    items, totalKcal: items.reduce((s, i) => s + i.kcal, 0), cals,
    note: 'Читмил ПОСЛЕ тяжёлой тренировки. Не более 1500 ккал.',
    principles: ['🍔 Психологическая разгрузка', '⏰ Только ПОСЛЕ тренировки', '📏 Макс 1 раз/нед, до 1500 ккал', '🔄 Не компенсировать на след.день', '💧 Пить воду, не газировку'],
    bju,
    bjuBreakdown,
    recommendation: deps.goal === 'mass' ? '1-2р/нед' : (deps.goal === 'fat_loss' || deps.goal === 'cutting') ? '1р в 7-10 дней' : '1р/нед',
  };
}

export function generateCarbload(deps: SpecialMealDeps): any {
  const carbsPerKg = 8; const totalCarbs = Math.round(deps.weight * carbsPerKg);
  const carbFoods = FOOD_DB.filter(f => (f.category === 'carb' || f.category === 'grain') && f.carbs > 20).filter(notExcluded(deps.excludedIds)).sort(() => Math.random() - 0.5).slice(0, 5);
  // P1-fix: белок протокола загрузки = 1.0-1.5 г/кг (не суточный effectiveP),
  // жиры = 0.5 г/кг (минимум для гормонов), углеводы = totalCarbs.
  const proteinG = Math.round(deps.weight * 1.2);
  const fatG = Math.round(deps.weight * 0.5);
  const kcal = totalCarbs * 4 + proteinG * 4 + fatG * 9;
  const bjuBreakdown = `${Math.round(proteinG * 4 / kcal * 100)}% Б / ${Math.round(fatG * 9 / kcal * 100)}% Ж / ${Math.round(totalCarbs * 4 / kcal * 100)}% У`;
  return {
    totalCarbs,
    foods: carbFoods.map(f => ({ name: f.name, carbs: f.carbs, amount: Math.round(totalCarbs * 0.3 / f.carbs * 100) })),
    note: 'За 24-48ч до тренировки. Воды +1-1.5л.',
    principles: ['🍚 Заполнение гликогена', '⏰ За 24-48ч до тяжёлой тренировки', '📏 6-8 г/кг углеводов', '💧 Воды +1-1.5л', '🧂 Натрий 200-500мг', '⬇ Жиры до 0.5г/кг'],
    bju: { c: totalCarbs, p: proteinG, f: fatG, kcal },
    bjuBreakdown,
  };
}

export function generateBUTCH(deps: SpecialMealDeps): any {
  const highCarb = Math.round(deps.effectiveC * 1.3);
  const lowCarb = Math.round(deps.effectiveC * 0.5);
  const protein = deps.effectiveP;
  const fatHigh = Math.round(deps.effectiveF * 0.8);
  const fatLow = Math.round(deps.effectiveF * 1.2);
  const kcalHigh = highCarb * 4 + protein * 4 + fatHigh * 9;
  const kcalLow = lowCarb * 4 + protein * 4 + fatLow * 9;
  return {
    pattern: deps.trainingDays.filter(Boolean).length + ' тр + ' + deps.trainingDays.filter(d => !d).length + ' отдых',
    highCarb, lowCarb,
    protein,
    fatHigh, fatLow,
    bjuHigh: { kcal: kcalHigh, p: protein, f: fatHigh, c: highCarb },
    bjuLow: { kcal: kcalLow, p: protein, f: fatLow, c: lowCarb },
    note: 'Цикл по тренировочным дням',
    principles: ['⤴️⤵️ БУЧ для жиросжигания', '📊 ВУ дни: угл +30%', '📊 НУ дни: угл -50%', '💪 Белок 2-2.5г/кг', '🧈 Жиры: ВУ 0.8×, НУ 1.2×', '⏳ Макс 4 недели'],
  };
}

export function generateCravingPlan(deps: SpecialMealDeps): any {
  const sweetToothKcal = Math.min(500, Math.round(deps.effectiveKcal * 0.12));
  const sweetItems = FOOD_DB.filter(f => {
    const n = f.name.toLowerCase();
    return n.includes('шоколад') || n.includes('морожен') || n.includes('печень') || n.includes('конфет') || n.includes('мед') || n.includes('варень') || n.includes('джем') || n.includes('банан') || n.includes('яблоко') || n.includes('виноград') || n.includes('финик');
  }).filter(notExcluded(deps.excludedIds)).sort(() => Math.random() - 0.5).slice(0, 2);
  return {
    kcal: sweetToothKcal,
    days: deps.cravingDays,
    items: sweetItems,
    bju: { kcal: sweetToothKcal, p: Math.round(sweetToothKcal * 0.06 / 4), f: Math.round(sweetToothKcal * 0.25 / 9), c: Math.round(sweetToothKcal * 0.69 / 4) },
    note: `Сладкий перекус на ${deps.cravingDays} ${deps.cravingDays === 1 ? 'день' : 'дня'}. Вписывайте в КБЖУ.`,
    principles: ['🍬 Разовый десерт без чувства вины', '📏 Не более 12% дневной калорийности', '⏰ Лучше в первой половине дня', '🥜 Добавить белок/жиры для сытости', '💧 Пить воду перед десертом'],
    recommendation: (deps.goal === 'cutting' || deps.goal === 'fat_loss') ? '1-2р/нед' : '2-3р/нед',
  };
}

export function generateLazyDayPlan(deps: SpecialMealDeps): any {
  const lazyKcal = Math.round(deps.effectiveKcal * 0.85);
  const lazyItems = FOOD_DB.filter(f => {
    const n = f.name.toLowerCase();
    return (f.category === 'dairy' && f.carbs < 10) || n.includes('яйц') || n.includes('творог') || n.includes('йогурт') || n.includes('протеин') || n.includes('кефир') || n.includes('хлеб') || n.includes('овсян') || n.includes('банан') || n.includes('орех') || n.includes('авокадо');
  }).filter(notExcluded(deps.excludedIds)).filter(f => f.carbs < 40).sort(() => Math.random() - 0.5).slice(0, 5);
  return {
    kcal: lazyKcal,
    days: deps.lazyDayDays,
    items: lazyItems,
    bju: { kcal: lazyKcal, p: Math.round(lazyKcal * 0.30 / 4), f: Math.round(lazyKcal * 0.25 / 9), c: Math.round(lazyKcal * 0.45 / 4) },
    note: `Минимум готовки: ${deps.lazyDayDays} ${deps.lazyDayDays === 1 ? 'день' : 'дней'}. Простые блюда за 5-10 мин.`,
    principles: ['⏱️ Блюда до 10 минут', '🔥 Не требует варки/жарки', '🥛 Молочка + хлопья + фрукты', '🥪 Бутерброды с авокадо/рыбой', '💪 Протеиновый коктейль — база'],
    recommendation: 'Не чаще 2-3 раз/нед, иначе замедление метаболизма',
  };
}