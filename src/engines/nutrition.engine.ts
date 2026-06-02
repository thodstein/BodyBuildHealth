import { NutritionInput, NutritionTargets, FoodItem } from '../core/types';
import { FOOD_DB, RATION_TIERS, getTopByProtein, getTopByCarbs, getTopByFat } from '../core/nutrition-database';

const PHARMA_INTERACTIONS: Record<string, { note: string; foods: string[] }> = {
  'кленбутерол': { note: 'Снижает K/Mg/Таурин. Добавьте курагу, гречку, магний 400 мг, таурин 2 г.', foods: ['buckwheat', 'banana', 'potato_boiled', 'nuts_mix'] },
  'телмисартан': { note: 'Повышает K. Ограничьте калий до 3 г/день, избегайте заменителей соли.', foods: ['sweet_potato', 'apple'] },
  'метформин': { note: 'Снижает B12/фолат. Добавьте метилкобаламин 1000 мкг/мес, контроль B12.', foods: ['beef_lean', 'spinach', 'egg_whole'] },
  'статины': { note: 'Снижают CoQ10, повышают ALT. Добавьте CoQ10 200 мг, контроль печени.', foods: ['salmon', 'fish_oil_food', 'olive_oil'] },
  'анастрозол': { note: 'Снижает E2 → возможны боли в суставах. Добавьте Омега-3 + Хондроитин.', foods: ['salmon', 'fish_oil', 'avocado', 'olive_oil'] },
  'диклофенак': { note: 'Повреждает слизистую ЖКТ. Добавьте продукты защиты желудка.', foods: ['apple', 'broccoli', 'kefir', 'oats'] },
  'мелоксикам': { note: 'Менее токсичен для ЖКТ чем диклофенак, но всё равно нужна защита.', foods: ['apple', 'kefir', 'broccoli'] },
};

const GOAL_COMMENTS: Record<string, { title: string; protein: string; fats: string; carbs: string; timing: string }> = {
  bulk: {
    title: 'Набор массы',
    protein: 'Белок 1.8-2.2 г/кг — стимуляция mTOR и синтеза мышц. Лейцин (whey, яйца, говядина) — ключевой триггер.',
    fats: 'Жиры 0.9-1.1 г/кг — минимум для гормонов (тестостерон, лептин). Ниже 0.8 — риск падения T.',
    carbs: 'Углеводы заполняют остаток — энергия для тренировок, восстановление гликогена. +15% в тренировочные дни.',
    timing: 'Завтрак: белки + медленные углеводы. После тренировки: быстрый белок + быстрые углеводы (рис/банан). Перед сном: казеин/творог.'
  },
  cut: {
    title: 'Похудение / Сушка',
    protein: 'Белок 2.2-2.6 г/кг — защита мышц в дефиците. Каждый приём — 30-40 г белка.',
    fats: 'Жиры 0.7-0.9 г/кг — минимум для гормонов. Не ниже 0.7 — падение тестостерона и либидо.',
    carbs: 'Углеводы минимальные — только вокруг тренировки и завтрак. -15% в дни отдыха.',
    timing: 'Утро: белки +少量 углеводы. До тренировки: лёгкий белок. После тренировки: белок + углеводы. Вечер: белки + жиры, мин. углеводов.'
  },
  maintenance: {
    title: 'Поддержание',
    protein: 'Белок 1.6-2.0 г/кг — поддержание сухой массы и восстановление.',
    fats: 'Жиры 0.8-1.0 г/кг — баланс для гормонов и здоровья.',
    carbs: 'Углеводы по остатку — поддержание уровня энергии и гликогена.',
    timing: '3-4 приёма пищи. Белок в каждом приёме. Углеводы равномерно с акцентом на обед.'
  },
  recomp: {
    title: 'Рекомпозиция',
    protein: 'Белок 1.8-2.2 г/кг — одновременно рост мышц и потеря жира. Высокий белок критичен.',
    fats: 'Жиры 0.8-1.0 г/кг — поддержание гормонального фона.',
    carbs: 'Тренировочные дни выше (+8%), дни отдыха ниже (-5%). Макроциклирование обязательно.',
    timing: 'Тренировочный день: углеводы вокруг тренировки. День отдыха: белки + жиры, минимум углеводов.'
  },
  rehab: {
    title: 'Восстановление',
    protein: 'Белок 2.0-2.4 г/кг — усиленное восстановление тканей, иммунитет, антикатаболизм.',
    fats: 'Жиры 0.9-1.1 г/кг — анти-воспалительные (Омега-3, оливковое масло) приоритет.',
    carbs: 'Углеводы mod +7% — энергия для восстановления, не для набора.',
    timing: '3-5 приёмов. Акцент на антиоксиданты (ягоды, овощи), Омега-3 (рыба). Перед сном — казеин.'
  },
  strength: {
    title: 'Силовой период',
    protein: 'Белок 2.0-2.4 г/кг — поддержка ЦНС и связок при тяжёлых нагрузках.',
    fats: 'Жиры 1.0-1.2 г/кг — стабильные гормоны при пиковых нагрузках.',
    carbs: 'Углеводы high — энергообеспечение максимальных силовых усилий.',
    timing: 'Перед тренировкой: белки + углеводы за 2 ч. После тренировки: быстрый белок + углеводы. Перед сном: казеин.'
  },
};

const TIMING_LABELS: Record<string, string> = {
  morning: 'Завтрак (7:00-9:00)',
  lunch: 'Обед (12:00-14:00)',
  after_train: 'После тренировки (30 мин)',
  before_sleep: 'Перед сном (21:00-22:00)',
  any: 'Любое время',
};

export interface RationTierData {
  level: 'basic' | 'mid' | 'max';
  label: string;
  desc: string;
  foods: { category: string; items: typeof FOOD_DB }[];
}

export interface NutritionAdviceData {
  goalComment: typeof GOAL_COMMENTS[string] | null;
  deficits: { label: string; current: number; target: number; unit: string; pct: number; isLow: boolean }[];
  pharmaNotes: { drug: string; note: string; foods: { id: string; name: string; reason: string }[] }[];
  rationTiers: RationTierData[];
  topProtein: typeof FOOD_DB;
  topCarbs: typeof FOOD_DB;
  topFats: typeof FOOD_DB;
  timingAdvice: { period: string; foods: string }[];
}

export function calcNutrition(i: NutritionInput): NutritionTargets {
  const bmrKatch = i.bodyFatPercent ? 370 + 21.6 * (i.weightKg * (100 - i.bodyFatPercent) / 100) : 0;
  const bmrMifflin = i.sex === 'male'
    ? 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + 5
    : 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age - 161;
  const bmr = i.bodyFatPercent ? Math.max(bmrMifflin, bmrKatch) : bmrMifflin;
  const tdee = bmr * i.pal;
  let kcal = tdee;
  if (i.goal === 'bulk') kcal += Math.min(500, tdee * 0.15);
  else if (i.goal === 'cut') kcal = Math.max(bmr, tdee - tdee * 0.2);
  else if (i.goal === 'rehab') kcal += tdee * 0.07;

  const proRange: Record<string, [number, number]> = { bulk: [1.8, 2.2], cut: [2.2, 2.6], maintenance: [1.6, 2.0], recomp: [1.8, 2.2], rehab: [2.0, 2.4], strength: [2.0, 2.4] };
  const [pMin, pMax] = proRange[i.goal] || [1.6, 2.0];
  const protein = Math.round(((pMin + pMax) / 2) * i.weightKg);

  const fatRange: Record<string, [number, number]> = { bulk: [0.9, 1.1], cut: [0.7, 0.9], maintenance: [0.8, 1.0], recomp: [0.8, 1.0], rehab: [0.9, 1.1], strength: [1.0, 1.2] };
  const [fMin, fMax] = fatRange[i.goal] || [0.8, 1.0];
  const fats = Math.max(0.8 * i.weightKg, Math.round(((fMin + fMax) / 2) * i.weightKg));

  const carbsKcal = Math.max(0, kcal - (protein * 4 + fats * 9));
  const carbs = Math.round(carbsKcal / 4);

  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: Math.round(kcal), protein, fats, carbs,
    water: Math.round((0.033 * i.weightKg + 0.5) * 10) / 10, fiber: i.sex === 'male' ? 35 : 25,
    micros: { Mg: i.goal === 'cut' ? 400 : 300, Zn: 15, VitD: 3000, VitC: 1000 }
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
      const key = Object.keys(PHARMA_INTERACTIONS).find(k => d.toLowerCase().includes(k));
      if (key) txt += `• ${key}: ${PHARMA_INTERACTIONS[key].note}\n`;
    });
  }
  return txt;
}

export function generateStructuredAdvice(
  target: NutritionTargets,
  goal: string,
  actual?: { kcal: number; pro: number; fiber: number; water: number },
  drugs?: string[]
): NutritionAdviceData {
  const catLabels: Record<string, string> = {
    protein: 'Белки', carb: 'Углеводы', fat: 'Жиры', dairy: 'Молочные', veg_fruit: 'Овощи/Фрукты', grain: 'Злаки', supplement: 'Добавки'
  };
  const tierLabels: Record<string, { label: string; desc: string }> = {
    basic: { label: 'Базовый', desc: 'Минимум для закрытия потребности. Доступно и дёшево.' },
    mid: { label: 'Средний', desc: 'Оптимальное соотношение цена/качество. Больше микроэлементов.' },
    max: { label: 'Максимум', desc: 'Максимальная питательная плотность. Премиум-продукты.' },
  };
  const tiers: ('basic' | 'mid' | 'max')[] = ['basic', 'mid', 'max'];
  const rationTiers: RationTierData[] = tiers.map(t => ({
    level: t,
    label: tierLabels[t].label,
    desc: tierLabels[t].desc,
    foods: Object.entries(RATION_TIERS).map(([cat, tierData]) => {
      const ids = tierData[t as 'basic' | 'mid' | 'max'] || [];
      const items = ids.map(id => FOOD_DB.find(f => f.id === id.trim())).filter((f): f is typeof FOOD_DB[number] => !!f);
      return { category: catLabels[cat] || cat, items };
    }).filter(c => c.items.length > 0),
  }));

  const deficits: NutritionAdviceData['deficits'] = [];
  if (actual) {
    const rows: { label: string; current: number; target: number; unit: string }[] = [
      { label: 'Ккалории', current: actual.kcal, target: target.kcal, unit: 'ккал' },
      { label: 'Белки', current: actual.pro, target: target.protein, unit: 'г' },
      { label: 'Клетчатка', current: actual.fiber || 0, target: target.fiber, unit: 'г' },
      { label: 'Вода', current: Math.round((actual.water || 0) * 10) / 10, target: target.water, unit: 'л' },
    ];
    for (const r of rows) {
      const pct = r.target > 0 ? Math.round((r.current / r.target) * 100) : 0;
      deficits.push({ ...r, pct, isLow: pct < 80 });
    }
  }

  const pharmaNotes: NutritionAdviceData['pharmaNotes'] = [];
  if (drugs?.length) {
    drugs.forEach(d => {
      const key = Object.keys(PHARMA_INTERACTIONS).find(k => d.toLowerCase().includes(k));
      if (key) {
        const inter = PHARMA_INTERACTIONS[key];
        const foodItems = inter.foods.map(fId => {
          const food = FOOD_DB.find(f => f.id === fId);
          return food ? { id: food.id, name: food.name, reason: food.pharmaNote || '' } : { id: fId, name: fId, reason: '' };
        });
        pharmaNotes.push({ drug: key, note: inter.note, foods: foodItems });
      }
    });
  }

  const goalData = GOAL_COMMENTS[goal] || null;
  const timingAdvice: NutritionAdviceData['timingAdvice'] = [];
  if (goalData) {
    timingAdvice.push({ period: TIMING_LABELS['morning'], foods: 'Белки + медленные углеводы (овсянка, яйца, хлеб ржаной)' });
    if (['bulk', 'strength', 'recomp'].includes(goal)) {
      timingAdvice.push({ period: TIMING_LABELS['after_train'], foods: 'Сывороточный протеин + быстрые углеводы (банан, рис)' });
    }
    timingAdvice.push({ period: TIMING_LABELS['lunch'], foods: 'Белки + жиры + овощи (мясо/рыба, масло, брокколи)' });
    if (['cut', 'recomp', 'maintenance'].includes(goal)) {
      timingAdvice.push({ period: TIMING_LABELS['before_sleep'], foods: 'Казеин / творог — антикатаболизм на 6-8 часов' });
    }
  }

  return {
    goalComment: goalData,
    deficits,
    pharmaNotes,
    rationTiers,
    topProtein: getTopByProtein(8),
    topCarbs: getTopByCarbs(8),
    topFats: getTopByFat(6),
    timingAdvice,
  };
}