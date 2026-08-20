/**
 * daily-quality-score.ts — агрегированный «скор качества дня» (P1-5).
 *
 * Чистая функция поверх V2: берёт скоры отдельных приёмов (calcMealScoreV2),
 * объединяет их по калорийности (ккал-взвешенное среднее) и корректирует
 * штрафами по флагам дневного отчёта (analyzeDailyDiet): гликемическая нагрузка,
 * аммонийная нагрузка, закисление, электролиты, HOMA-IR, незапущенный mTOR.
 * НЕ редактирует существующие движки — только импортирует их (read-only).
 */
import { calcMealScoreV2, analyzeDailyDiet, type UserDietProfile } from './product-usefulness-v2.engine';

export interface DayMealPartScore {
  score: number;
  kcal: number;
}

export interface DayQualityResult {
  /** 1-10, 0 если день пустой */
  score: number;
  label: string;
  color: string;
  mealScores: DayMealPartScore[];
  penalties: string[];
}

const clampDay = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10));

export function computeDayQualityScore(
  meals: { timing?: string; products: { foodId: string; weightGrams: number }[] }[],
  profile: UserDietProfile,
): DayQualityResult {
  const mealScores: DayMealPartScore[] = [];
  for (const m of meals) {
    const prods = (m.products || []).filter(p => p.weightGrams > 0);
    if (prods.length === 0) continue;
    const res = calcMealScoreV2(prods, profile, m.timing as any);
    if (!res || !(res.compositeScore > 0)) continue;
    const kcal = res.macros?.kcal || 0;
    if (kcal <= 0) continue;
    mealScores.push({ score: res.compositeScore, kcal });
  }

  if (mealScores.length === 0) {
    return { score: 0, label: 'Нет данных', color: 'rgba(255,255,255,0.4)', mealScores: [], penalties: [] };
  }

  const totalKcal = mealScores.reduce((s, x) => s + x.kcal, 0);
  // ккал-взвешенное среднее скоров приёмов
  let score = mealScores.reduce((s, x) => s + x.score * x.kcal, 0) / totalKcal;

  // штрафы по флагам дня
  const penalties: string[] = [];
  const day = analyzeDailyDiet(meals as Parameters<typeof analyzeDailyDiet>[0], profile);
  if (day.giLoadWarning) { score -= 0.5; penalties.push('Высокая гликемическая нагрузка дня'); }
  if (day.ammoniaRisk) { score -= 0.5; penalties.push('Аммонийная нагрузка (белок/LBM > 2.5, низкая клетчатка)'); }
  if (day.pralWarning === 'Закисление') { score -= 0.5; penalties.push('Закисление (PRAL)'); }
  if (day.electrolyteRisk) { score -= 0.5; penalties.push('Дисбаланс электролитов (K/Mg)'); }
  if (day.homaIr !== null && day.homaIr > 2.5) { score -= 0.5; penalties.push('HOMA-IR > 2.5'); }
  if (!day.mtorTriggered) { score -= 0.4; penalties.push('mTOR не запущен (лейцин < 3 г)'); }

  score = clampDay(score);
  return {
    score,
    label: score >= 8 ? 'Отлично' : score >= 5 ? 'Допустимо' : 'Низко',
    color: score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444',
    mealScores,
    penalties,
  };
}
