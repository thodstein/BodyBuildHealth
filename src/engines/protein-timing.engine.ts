/**
 * protein-timing.engine.ts — протеин-тайминг по полезной массе (FFM) (доп. функция 3).
 *
 * Оценивает распределение белка по приёмам относительно FFM:
 * - целевое окно на приём 0.4-0.55 г/кг FFM (кап ~50 г);
 * - минимум лейцина для запуска MPS ~2.5-3 г/приём (при неполном амино-профиле — оценка
 *   protein × 75 мг/г);
 * - вердикт «MPS-окна» по числу качественно закрытых приёмов.
 */
import { FOOD_DB } from '../core/nutrition-database';

export interface ProteinMealInput {
  products: { foodId: string; weightGrams: number }[];
}

export interface ProteinMealAssessment {
  proteinG: number;
  leucineMg: number;
  /** above/within/below FFM-окна */
  status: 'above' | 'within' | 'below';
}

export interface ProteinTimingResult {
  ffmKg: number;
  /** целевое окно на приём */
  targetPerMealMin: number;
  targetPerMealMax: number;
  meals: ProteinMealAssessment[];
  goodMeals: number;
  totalMeals: number;
  /** вердикт «MPS-окна» */
  verdict: 'отлично' | 'хорошо' | 'достаточно' | 'недостаточно';
  rationale: string[];
}

const MPS_LEUCINE_MG = 2500;

export function analyzeProteinTiming(
  meals: ProteinMealInput[],
  ffmKg: number,
): ProteinTimingResult {
  const ffm = Math.max(20, ffmKg || 70);
  const minPerMeal = Math.min(50, Math.round(ffm * 0.4 * 10) / 10);
  const maxPerMeal = Math.min(50, Math.round(ffm * 0.55 * 10) / 10);

  const assessments: ProteinMealAssessment[] = meals.map(m => {
    let proteinG = 0;
    let leucineMg = 0;
    for (const p of (m.products || [])) {
      const food = FOOD_DB.find(f => f.id === p.foodId);
      if (!food || !(p.weightGrams > 0)) continue;
      const w = p.weightGrams / 100;
      proteinG += (food.protein || 0) * w;
      leucineMg += (food.amino_acid_profile_100g?.leucine_mg ?? (food.protein || 0) * 75) * w;
    }
    proteinG = Math.round(proteinG * 10) / 10;
    const status: ProteinMealAssessment['status'] = proteinG > maxPerMeal + 5 ? 'above' : proteinG >= minPerMeal ? 'within' : 'below';
    return { proteinG, leucineMg: Math.round(leucineMg), status };
  });

  const considered = assessments.filter(a => a.proteinG > 0);
  const goodMeals = considered.filter(a => a.proteinG >= minPerMeal && a.leucineMg >= MPS_LEUCINE_MG).length;
  const totalMeals = considered.length;

  let verdict: ProteinTimingResult['verdict'];
  if (totalMeals === 0) verdict = 'недостаточно';
  else if (goodMeals === totalMeals) verdict = 'отлично';
  else if (goodMeals >= Math.ceil(totalMeals * 0.67)) verdict = 'хорошо';
  else if (goodMeals >= Math.ceil(totalMeals * 0.34)) verdict = 'достаточно';
  else verdict = 'недостаточно';

  const rationale = [
    `Целевое окно приёма: ${minPerMeal}-${maxPerMeal} г белка (FFM ${ffm} кг, 0.4-0.55 г/кг, кап 50 г).`,
    `Приёмов с белом: ${totalMeals}; MPS-закрыто (белок в окне + лейцин ≥ 2.5 г): ${goodMeals}.`,
    verdict === 'отлично' ? 'Все приёмы закрывают окно MPS — распределение белка равномерное.' : verdict === 'недостаточно' ? 'Мало приёмов закрывают MPS-окно — распределите белок равномернее (25-40 г либо 0.4-0.55 г/кг FFM на приём).' : 'Часть приёмов не закрывает MPS-окно — подтяните белок в слабые приёмы.',
  ];

  return { ffmKg: ffm, targetPerMealMin: minPerMeal, targetPerMealMax: maxPerMeal, meals: assessments, goodMeals, totalMeals, verdict, rationale };
}
