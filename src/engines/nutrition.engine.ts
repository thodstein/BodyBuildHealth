import { NutritionInput, NutritionTargets, FoodItem } from '../core/types';

const PHARMA_INTERACTIONS: Record<string, string> = {
  'клeнбутерол':'Снижает K/Mg/Таурин. Добавьте курагу, гречку, магний 400 мг, таурин 2 г.',
  'телмисартан':'Повышает K. Ограничьте калий до 3 г/день, избегайте заменителей соли.',
  'метформин':'Снижает B12/фолат. Добавьте метилкобаламин 1000 мкг/мес, контроль B12.',
  'статины':'Снижают CoQ10, повышают ALT. Добавьте CoQ10 200 мг, контроль печени.'
};

export function calcNutrition(i: NutritionInput): NutritionTargets {
  const bmrKatch = i.bodyFatPercent ? 370 + 21.6 * (i.weightKg * (100 - i.bodyFatPercent) / 100) : 0;
  const bmrMifflin = i.sex === 'male' 
    ? 10*i.weightKg + 6.25*i.heightCm - 5*i.age + 5 
    : 10*i.weightKg + 6.25*i.heightCm - 5*i.age - 161;
  const bmr = i.bodyFatPercent ? Math.max(bmrMifflin, bmrKatch) : bmrMifflin;

  const tdee = bmr * i.pal;
  let kcal = tdee;
  if(i.goal==='bulk') kcal += Math.min(500, tdee*0.15);
  else if(i.goal==='cut') kcal = Math.max(bmr, tdee - tdee*0.2);
  else if(i.goal==='rehab') kcal += tdee*0.07;

  const proRange: Record<string, [number, number]> = { bulk:[1.8,2.2], cut:[2.2,2.6], maintenance:[1.6,2.0], recomp:[1.8,2.2], rehab:[2.0,2.4] };
  const [pMin,pMax] = proRange[i.goal]||[1.6,2.0];
  const protein = Math.round(((pMin+pMax)/2)*i.weightKg);
  
  const fatRange: Record<string, [number, number]> = { bulk:[0.9,1.1], cut:[0.7,0.9], maintenance:[0.8,1.0], recomp:[0.8,1.0], rehab:[0.9,1.1] };
  const [fMin,fMax] = fatRange[i.goal]||[0.8,1.0];
  const fats = Math.max(0.8*i.weightKg, Math.round(((fMin+fMax)/2)*i.weightKg));

  const carbsKcal = Math.max(0, kcal - (protein*4 + fats*9));
  const carbs = Math.round(carbsKcal/4);

  return { 
    bmr:Math.round(bmr), tdee:Math.round(tdee), kcal:Math.round(kcal), protein, fats, carbs,
    water: Math.round((0.033*i.weightKg + 0.5)*10)/10, fiber: i.sex==='male'?35:25,
    micros: { Mg: i.goal==='cut'?400:300, Zn: 15, VitD: 3000, VitC: 1000 }
  };
}

export function generateNutritionAdvice(target: NutritionTargets, actual?: {kcal:number, pro:number, fiber:number, water:number}, drugs?: string[]): string {
  if(!actual) return `🥗 Цель: ${target.kcal} ккал | Б:${target.protein} Ж:${target.fats} У:${target.carbs} | Вода: ${target.water} л`;
  
  let txt = `📊 Факт vs Цель:\n`;
  txt += `• Ккал: ${actual.kcal}/${target.kcal} (${actual.kcal<target.kcal*0.9?'⬇️ Недобор':'✅'})\n`;
  txt += `• Белок: ${actual.pro}/${target.protein} г (${actual.pro<target.protein*0.9?'⬇️ Добавьте курицу/рыбу':'✅'})\n`;
  txt += `• Клетчатка: ${(actual as any).fiber||18}/${target.fiber} г (${(actual as any).fiber<target.fiber*0.7?'🔺 Обязательно овощи!':'✅'})\n`;
  txt += `• Вода: ${(actual as any).water||1.5}/${target.water} л (${(actual as any).water<target.water*0.8?'💧 Пейте больше в тренировочные дни':'✅'})\n`;

  if(drugs?.length) {
    txt += `\n⚠️ Взаимодействия:\n`;
    drugs.forEach(d => { if(PHARMA_INTERACTIONS[d]) txt += `• ${d}: ${PHARMA_INTERACTIONS[d]}\n`; });
  }
  return txt;
}