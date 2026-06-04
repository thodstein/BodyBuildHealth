import { NutritionInput, NutritionTargets } from '../core/types';
import { NUTRITION_MACRO_RANGES, MICRONUTRIENT_TARGETS } from '../core/constants';

export function calcNutrition(i: NutritionInput, weightDelta?: number): NutritionTargets {
  const bmrKatch = i.bodyFatPercent ? 370 + 21.6 * (i.weightKg * (100 - i.bodyFatPercent) / 100) : 0;
  const bmrMifflin = i.sex === 'male' 
    ? 10*i.weightKg + 6.25*i.heightCm - 5*i.age + 5 
    : 10*i.weightKg + 6.25*i.heightCm - 5*i.age - 161;
  const bmr = i.bodyFatPercent ? Math.max(bmrMifflin, bmrKatch) : bmrMifflin;
  const tdee = bmr * i.pal;
  let kcal = tdee;

  // Адаптация по дельте веса за неделю
  if (weightDelta !== undefined) {
    const targetDelta = i.goal === 'bulk' ? 0.5 : i.goal === 'cut' ? -0.5 : 0;
    kcal += (weightDelta - targetDelta) * 150;
  }

  if(i.goal==='bulk') kcal += Math.min(500, tdee*0.15);
  else if(i.goal==='cut') kcal = Math.max(bmr, tdee - tdee*0.2);
  else if(i.goal==='rehab') kcal += tdee*0.07;

  const ranges = NUTRITION_MACRO_RANGES[i.goal] || NUTRITION_MACRO_RANGES.maintenance;
  const [pMin, pMax] = ranges.protein;
  const protein = Math.round(((pMin+pMax)/2) * i.weightKg);
  const [fMin, fMax] = ranges.fats;
  const fats = Math.max(0.8*i.weightKg, Math.round(((fMin+fMax)/2) * i.weightKg));
  const carbsKcal = Math.max(0, kcal - (protein*4 + fats*9));
  const carbs = Math.round(carbsKcal/4);

  const micros: Record<string, number> = {};
  Object.entries(MICRONUTRIENT_TARGETS).forEach(([k, v]) => {
    micros[k] = i.goal === 'cut' ? Math.round(v.amount * 1.2) : v.amount;
  });

  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: Math.round(kcal),
    protein, fats, carbs,
    water: Math.round((0.033*i.weightKg + 0.5)*10)/10,
    fiber: i.sex==='male' ? 35 : 25,
    micros
  };
}

export function generateNutritionAdvice(target: NutritionTargets, actual?: {kcal:number; pro:number; fiber:number; water:number; steps:number}, drugs?: string[]): string {
  if(!actual) return `🥗 Цель: ${target.kcal} ккал | Б:${target.protein} Ж:${target.fats} У:${target.carbs} | Вода: ${target.water} л`;
  let txt = `📊 Факт vs Цель:\n`;
  txt += `• Ккал: ${actual.kcal}/${target.kcal} (${actual.kcal<target.kcal*0.9?'⬇️ Недобор':'✅'})\n`;
  txt += `• Белок: ${actual.pro}/${target.protein} г (${actual.pro<target.protein*0.9?'⬇️ Добавьте источник':'✅'})\n`;
  txt += `• Клетчатка: ${actual.fiber||18}/${target.fiber} г (${(actual.fiber||18)<target.fiber*0.7?'🔺 Обязательно овощи!':'✅'})\n`;
  txt += `• Вода: ${actual.water||1.5}/${target.water} л (${(actual.water||1.5)<target.water*0.8?'💧 Пейте больше':'✅'})\n`;
  if(actual.steps) txt += `• Шаги: ${actual.steps} (${actual.steps>=10000?'✅ Норма':'⬇️ Добавьте 2-3к шагов'})\n`;
  
  if(drugs?.length) {
    txt += `\n⚠️ Фармако-взаимодействия:\n`;
    const pharmaNotes: Record<string, string> = {
      'клeнбутерол':'Снижает K/Mg/Таурин. Добавьте курагу, гречку, магний 400 мг, таурин 2 г.',
      'телмисартан':'Повышает K. Ограничьте калий до 3 г/день.',
      'метформин':'Снижает B12/фолат. Добавьте метилкобаламин 1000 мкг/мес.',
      'статины':'Снижают CoQ10, повышают ALT. Добавьте CoQ10 200 мг.',
      'анастрозол':'Снижает E2 → возможны боли в суставах. Добавьте Омега-3 + Хондроитин.'
    };
    drugs.forEach(d => { const key = Object.keys(pharmaNotes).find(k => d.toLowerCase().includes(k)); if(key) txt += `• ${key}: ${pharmaNotes[key]}\n`; });
  }
  return txt;
}