/**
 * planner-bb-nutrition.ts — чистая логика применения ББ-плана к дневным целям питания (Ф4.25).
 *
 * Читается из заметки `he_bb_nutrition_note` (калораж + трен-дни для циклирования
 * углеводов). Выделена в чистую функцию для тестируемости: IndividualPlanContext
 * вызывает её и добавляет breakdown-заметки в цели дня.
 */

export interface BBNutritionNote {
  kcal?: number;
  trainDays?: number[];
  weeklySets?: number;
  text?: string;
}

export interface BBNutritionTargetsInput {
  protein: number;
  fats: number;
  carbs: number;
  bbNote: BBNutritionNote | null;
  todayDow?: number; // Пн=1 .. Вс=7; по умолчанию сегодня
}

export interface BBNutritionTargetsResult {
  protein: number;
  fats: number;
  carbs: number;
  kcal: number;
  isTrainToday: boolean | null; // null = без циклирования (нет трен-дней)
  breakdown: string[];
}

const dowToday = (): number => new Date().getDay() || 7;

export function applyBBNutritionToTargets(input: BBNutritionTargetsInput): BBNutritionTargetsResult {
  const note = input.bbNote;
  const breakdown: string[] = [];
  const trainDays = Array.isArray(note?.trainDays) && (note!.trainDays as number[]).length ? (note!.trainDays as number[]) : null;
  const isTrainToday = trainDays ? trainDays.includes(input.todayDow ?? dowToday()) : null;
  let fats = input.fats;
  let carbs = input.carbs;
  if (isTrainToday != null) {
    const shiftG = isTrainToday ? 30 : -25;
    carbs = Math.max(20, Math.round(input.carbs + shiftG));
    fats = Math.max(35, Math.round(input.fats - (shiftG * 4) / 9));
    breakdown.push(`⚡ ББ-план: ${isTrainToday ? 'трен-день' : 'день отдыха'} — углеводы ${isTrainToday ? '+' : ''}${shiftG} г (циклирование по трен-дням плана).`);
  }
  const atwater = Math.round(input.protein * 4 + carbs * 4 + fats * 9);
  const bbKcal = (note && note.kcal != null && Number.isFinite(note.kcal) && (note.kcal as number) > 0) ? Math.round(note.kcal as number) : null;
  const kcal = (bbKcal && Math.abs(bbKcal - atwater) / Math.max(1, atwater) <= 0.15) ? bbKcal : atwater;
  if (bbKcal) {
    breakdown.push(`🎯 Целевой калораж ББ-плана: ${bbKcal} ккал (применён${kcal === bbKcal ? '' : ' с учётом макросов'}); объём ~${note?.weeklySets ?? '—'} сетов/нед.`);
  }
  return { protein: input.protein, fats, carbs, kcal, isTrainToday, breakdown };
}
