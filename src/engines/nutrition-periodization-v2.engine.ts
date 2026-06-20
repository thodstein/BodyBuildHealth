import { getNutritionV2Data, saveNutritionV2Data } from '../core/nutrition-v2-data';

export interface PeriodizationSuggestion {
  type: 'refeed' | 'diet_pause' | 'mini_cut' | 'cycle_change' | 'maintenance';
  reason: string;
  action: string;
  urgency: 'info' | 'warning' | 'critical';
}

export function checkMetabolicAdaptation(): { adaptation: number; suggestions: PeriodizationSuggestion[] } {
  const v2 = getNutritionV2Data();
  const suggestions: PeriodizationSuggestion[] = [];

  // Calculate how long user has been in deficit
  let adaptation = 0;
  if (v2.currentPhase === 'deficit' || v2.currentPhase === 'mini_cut') {
    const weeksOnDeficit = v2.dietWeeks;
    if (weeksOnDeficit > 8) {
      adaptation = 0.12;
      suggestions.push({ type: 'diet_pause', reason: `Вы на дефиците >8 нед (${weeksOnDeficit} нед)`, action: 'Рекомендуется диетическая пауза: 1-2 недели на поддержании', urgency: 'critical' });
    } else if (weeksOnDeficit > 4) {
      adaptation = 0.06;
      suggestions.push({ type: 'refeed', reason: `Вы на дефиците >4 нед (${weeksOnDeficit} нед)`, action: 'Рекомендуется рефид: 1 день на поддержании с высокими углеводами', urgency: 'warning' });
    }
  }

  // Check weight trend for plateau
  if (v2.weightHistory.length >= 7) {
    const trend = calcTrendLocal(v2.weightHistory);
    if ((v2.currentPhase === 'deficit' || v2.currentPhase === 'mini_cut') && trend > -0.1 && v2.dietWeeks > 3) {
      suggestions.push({ type: 'mini_cut', reason: 'Вес стоит более 2 недель', action: 'Рассмотрите мини-сушку (2 нед, -20% ккал) или рефид', urgency: 'warning' });
    }
    if (v2.currentPhase === 'bulk' && trend < 0.1 && v2.dietWeeks > 3) {
      suggestions.push({ type: 'cycle_change', reason: 'Набор веса замедлился', action: 'Увеличьте калории на 200-300 ккал или добавьте читмил', urgency: 'info' });
    }
  }

  return { adaptation, suggestions };
}

export function suggestNextPhase(): { phase: string; reason: string } {
  const v2 = getNutritionV2Data();
  if (v2.currentPhase === 'deficit' && v2.dietWeeks > 6) {
    return { phase: 'maintenance', reason: 'Длительный дефицит — нужна пауза' };
  }
  if (v2.currentPhase === 'maintenance' && v2.dietWeeks <= 2) {
    return { phase: 'deficit', reason: 'Пауза завершена — можно вернуться к дефициту' };
  }
  return { phase: v2.currentPhase, reason: 'Продолжайте текущую стратегию' };
}

export function calcCycleMacros(baseKcal: number, isTrainingDay: boolean, proteinG: number, fatGPerKg: number, weightKg: number): { proteinG: number; fatG: number; carbsG: number; kcal: number } {
  const pG = proteinG;
  const pKcal = pG * 4;
  let fG: number;
  let cG: number;
  let kcal: number;

  if (isTrainingDay) {
    // Training day: more carbs, less fat
    fG = Math.round(weightKg * fatGPerKg * 0.7);
    kcal = Math.round(baseKcal * 1.1);
  } else {
    // Rest day: more fat, fewer carbs
    fG = Math.round(weightKg * fatGPerKg * 1.3);
    kcal = Math.round(baseKcal * 0.9);
  }

  const fKcal = fG * 9;
  const cKcal = kcal - pKcal - fKcal;
  cG = Math.max(50, Math.round(cKcal / 4));

  return { proteinG: pG, fatG: fG, carbsG: cG, kcal };
}

function calcTrendLocal(history: { date: string; kg: number }[]): number {
  if (history.length < 3) return 0;
  const recent = history.slice(-7);
  if (recent.length < 2) return 0;
  const first = recent[0].kg;
  const last = recent[recent.length - 1].kg;
  const days = (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) / 86400000;
  if (days < 3) return 0;
  return (last - first) / (days / 7);
}
