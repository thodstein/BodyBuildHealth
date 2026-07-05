import { NutritionInput, NutritionTargets } from '../core/types';
import { calcNutritionV2 } from './nutrition-v2.engine';
import { FOOD_DRUG_INTERACTIONS } from './nutrition-pharma-interactions';

const GOAL_MAP: Record<string, 'deficit' | 'maintenance' | 'bulk' | 'mini_cut'> = {
  mass: 'bulk', hypertrophy: 'bulk', bulk: 'bulk',
  cut: 'deficit', fat_loss: 'deficit', cutting: 'deficit', mini_cut: 'deficit',
  maintenance: 'maintenance', health: 'maintenance', fitness: 'maintenance',
  strength: 'maintenance', endurance: 'maintenance', recomposition: 'maintenance', rehab: 'maintenance',
};

export function calcNutrition(i: NutritionInput): NutritionTargets {
  const v2 = calcNutritionV2({
    weightKg: i.weightKg,
    heightCm: i.heightCm,
    age: i.age,
    sex: i.sex,
    pal: i.pal,
    goal: GOAL_MAP[i.goal] || 'maintenance',
    bodyFatPercent: i.bodyFatPercent,
  });
  return {
    bmr: Math.round(v2.tdee / i.pal),
    tdee: v2.tdee,
    kcal: v2.kcal,
    protein: v2.proteinG,
    fats: v2.fatG,
    carbs: v2.carbsG,
    water: Math.round((0.033 * i.weightKg + 0.5) * 10) / 10,
    fiber: i.sex === 'male' ? 35 : 25,
    micros: { Mg: ['deficit', 'mini_cut'].includes(GOAL_MAP[i.goal] || '') ? 400 : 300, Zn: 15, VitD: 3000, VitC: 1000 },
  };
}

export function generateNutritionAdvice(target: NutritionTargets, actual?: { kcal: number; pro: number; fiber: number; water: number }, drugs?: string[]): string {
  if (!actual) return `Цель: ${target.kcal} ккал | Б:${target.protein} Ж:${target.fats} У:${target.carbs} | Вода: ${target.water} л`;

  let txt = `Факт vs Цель:\n`;
  txt += `• Ккал: ${actual.kcal}/${target.kcal} (${actual.kcal < target.kcal * 0.9 ? '⬇️ Недобор' : '✅'})\n`;
  txt += `• Белок: ${actual.pro}/${target.protein} г (${actual.pro < target.protein * 0.9 ? '⬇️ Добавьте курицу/рыбу' : '✅'})\n`;
  txt += `• Клетчатка: ${(actual as any).fiber || 18}/${target.fiber} г (${(actual as any).fiber < target.fiber * 0.7 ? '🔺 Обязательно овощи!' : '✅'})\n`;
  txt += `• Вода: ${(actual as any).water || 1.5}/${target.water} л (${(actual as any).water < target.water * 0.8 ? '💧 Пейте больше в тренировочные дни' : '✅'})\n`;

  if (drugs?.length) {
    txt += `\nВзаимодействия:\n`;
    drugs.forEach(d => {
      const matched = FOOD_DRUG_INTERACTIONS.filter(i => d.toLowerCase().includes(i.drugClass));
      matched.slice(0, 3).forEach(i => {
        txt += `• ${i.foodGroup} → ${i.recommendation}\n`;
      });
    });
  }
  return txt;
}

