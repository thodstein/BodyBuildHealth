// meal-tier-generator.engine.ts
// Meal tier plan generator with regime advice and custom food support

import { FOOD_DB, RATION_TIERS, getFoodsByTier } from '../core/nutrition-database';
import type { FoodItem } from '../core/nutrition-database';

export type MealTier = 'basic' | 'mid' | 'max' | 'boost';
export type MealGoal = 'bulk' | 'cut' | 'maintenance' | 'recomp' | 'rehab' | 'health';

export interface MealTiming {
  name: string;
  time: string;
  proteinPct: number;
  fatPct: number;
  carbPct: number;
  isWorkout?: boolean;
}

export interface TrainingState {
  dayType: 'training' | 'rest';
  trainingTime?: 'morning' | 'afternoon' | 'evening';
}

export interface MealItem {
  foodName: string;
  foodId: string;
  amount: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealSlot {
  name: string;
  time: string;
  items: MealItem[];
}

export interface DayPlan {
  dayIndex: number;
  isTrainingDay: boolean;
  meals: MealSlot[];
  totals: { kcal: number; protein: number; fat: number; carbs: number };
}

export interface WorkoutMeal {
  name: string;
  time: string;
  items: MealItem[];
}

export interface WorkoutMealPlan {
  description: string;
  meals: WorkoutMeal[];
  supplements: { name: string; dose: string; timing: string; reason: string }[];
}

export interface MealPlanResult {
  dayPlans: DayPlan[];
  workoutMealPlan: WorkoutMealPlan | null;
  recommendations: string[];
  regimeAdvice: string[];
  summary: { avgKcal: number; avgProtein: number; avgFat: number; avgCarbs: number; tier: MealTier; goal: MealGoal };
}

export interface LabsContext {
  homaIR?: number;
  liverStress?: number;
  kidneyStress?: number;
  inflammation?: number;
  hormoneScore?: number;
}

export interface MealPlanInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  goal: MealGoal;
  tier: MealTier;
  trainingDaysPerWeek: number;
  avgWorkoutMinutes: number;
  includeWorkoutMeals?: boolean;
  labsContext?: LabsContext;
}

export interface CustomFoodEntry {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  category: FoodItem['category'];
  servingSize: string;
  potassium_mg?: number;
  magnesium_mg?: number;
  calcium_mg?: number;
  sodium_mg?: number;
  phosphorus_mg?: number;
  zinc_mg?: number;
  iron_mg?: number;
  selenium_mcg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  iodine_mcg?: number;
  chromium_mcg?: number;
  omega3_mg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  vitamin_b1_mg?: number;
  vitamin_b2_mg?: number;
  vitamin_b3_mg?: number;
  vitamin_b5_mg?: number;
  vitamin_b6_mg?: number;
  vitamin_b7_mcg?: number;
  vitamin_b9_mcg?: number;
  vitamin_b12_mcg?: number;
  leucine_mg?: number;
  isoleucine_mg?: number;
  valine_mg?: number;
  lysine_mg?: number;
  methionine_mg?: number;
  arginine_mg?: number;
  glutamine_mg?: number;
  tryptophan_mg?: number;
  threonine_mg?: number;
  cysteine_mg?: number;
  creatine_mg?: number;
  taurine_mg?: number;
  coenzyme_q10_mg?: number;
  polyphenols_mg?: number;
  flavonoids_mg?: number;
}

const TIER_CONFIG: Record<MealTier, { proteinPerKg: number; fatPerKg: number; kcalMultiplier: number; label: string; description: string }> = {
  basic: {
    proteinPerKg: 1.8, fatPerKg: 0.8, kcalMultiplier: 1.0,
    label: 'База',
    description: 'Минимальный набор продуктов. Доступно, дёшево.',
  },
  mid: {
    proteinPerKg: 2.0, fatPerKg: 1.0, kcalMultiplier: 1.1,
    label: 'Средний',
    description: 'Оптимум цена/качество. Баланс микро.',
  },
  max: {
    proteinPerKg: 2.2, fatPerKg: 1.2, kcalMultiplier: 1.2,
    label: 'Максимум',
    description: 'Премиум продукты. Макс нутриентов.',
  },
  boost: {
    proteinPerKg: 2.4, fatPerKg: 1.4, kcalMultiplier: 1.35,
    label: 'Усиление',
    description: 'Суперфуды + специфические продукты.',
  },
};

const GOAL_ADJUST: Record<MealGoal, { kcalAdj: number; protAdj: number; label: string }> = {
  bulk: { kcalAdj: 400, protAdj: 0.3, label: 'Набор массы' },
  cut: { kcalAdj: -400, protAdj: 0.4, label: 'Сушка' },
  maintenance: { kcalAdj: 0, protAdj: 0, label: 'Поддержание' },
  recomp: { kcalAdj: -100, protAdj: 0.3, label: 'Рекомпозиция' },
  rehab: { kcalAdj: 200, protAdj: 0.2, label: 'Реабилитация' },
  health: { kcalAdj: 0, protAdj: 0, label: 'Здоровье' },
};

const MEAL_TIMING: Record<string, MealTiming> = {
  morning: { name: 'Завтрак', time: '07:00', proteinPct: 0.25, fatPct: 0.30, carbPct: 0.20 },
  lunch: { name: 'Обед', time: '13:00', proteinPct: 0.30, fatPct: 0.25, carbPct: 0.30 },
  dinner: { name: 'Ужин', time: '19:00', proteinPct: 0.25, fatPct: 0.25, carbPct: 0.25 },
  snack: { name: 'Перекус', time: '16:00', proteinPct: 0.10, fatPct: 0.10, carbPct: 0.15 },
  pre_workout: { name: 'Перед тренировкой', time: '-1h', proteinPct: 0.15, fatPct: 0.05, carbPct: 0.25, isWorkout: true },
  post_workout: { name: 'После тренировки', time: '+30m', proteinPct: 0.20, fatPct: 0.05, carbPct: 0.30, isWorkout: true },
};

function calcBMR(weight: number, height: number, age: number, sex: 'male' | 'female'): number {
  if (sex === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calcPAL(workoutsPerWeek: number, avgMin: number): number {
  return Math.min(1.9, 1.2 + workoutsPerWeek * 0.075 + (avgMin > 60 ? 0.1 : 0));
}

function getFoodsForTier(cat: string, tier: MealTier): FoodItem[] {
  const mapTier = (t: MealTier): 'basic' | 'mid' | 'max' => {
    if (t === 'basic') return 'basic';
    if (t === 'mid') return 'mid';
    return 'max';
  };
  const rt = mapTier(tier);
  let foods = getFoodsByTier(cat, rt);
  if (tier === 'boost') {
    if (rt !== 'mid') foods = [...foods, ...getFoodsByTier(cat, 'mid')];
    if (rt !== 'basic') foods = [...foods, ...getFoodsByTier(cat, 'basic')];
  }
  const seen = new Set<string>();
  return foods.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
}

function pickFoodForCategory(cat: string, tier: MealTier, count: number): FoodItem[] {
  const all = getFoodsForTier(cat, tier);
  if (all.length === 0) {
    const fallback = FOOD_DB.filter(f => f.category === cat);
    return [...fallback].sort(() => Math.random() - 0.5).slice(0, count);
  }
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const result: FoodItem[] = [];
  for (let i = 0; i < count && i < shuffled.length; i++) {
    result.push(shuffled[i]);
  }
  return result;
}

function mkItem(food: FoodItem, grams: number): MealItem {
  const r = grams / 100;
  return {
    foodName: food.name, foodId: food.id, amount: Math.round(grams),
    kcal: Math.round(food.kcal * r), protein: Math.round(food.protein * r),
    fat: Math.round(food.fat * r), carbs: Math.round(food.carbs * r),
  };
}

function generateDayPlan(
  dayIndex: number, isTrainingDay: boolean,
  totalKcal: number, totalProtein: number, totalFat: number, totalCarbs: number,
  tier: MealTier, includeWorkoutMeals: boolean,
): DayPlan {
  const meals: MealSlot[] = [];
  const proteinFoods = pickFoodForCategory('protein', tier, 4);
  const carbFoods = pickFoodForCategory('carb', tier, 4);
  const fatFoods = pickFoodForCategory('fat', tier, 2);
  const vegFoods = pickFoodForCategory('veg_fruit', tier, 2);
  const shift = dayIndex % Math.max(proteinFoods.length, 1);

  if (isTrainingDay && includeWorkoutMeals) {
    const preW = MEAL_TIMING.pre_workout;
    const postW = MEAL_TIMING.post_workout;
    const preItems: MealItem[] = [];
    const preProt = proteinFoods[(0 + shift) % proteinFoods.length];
    const preCarb = carbFoods[(1 + shift) % carbFoods.length];
    preItems.push(mkItem(preProt, Math.round((totalProtein * preW.proteinPct) / Math.max(preProt.protein, 0.1) * 100 / 100 * 100)));
    preItems.push(mkItem(preCarb, Math.round((totalCarbs * preW.carbPct) / Math.max(preCarb.carbs, 0.1) * 100 / 100 * 100)));
    meals.push({ name: preW.name, time: preW.time, items: preItems });

    const postItems: MealItem[] = [];
    const postProt = proteinFoods[(1 + shift) % proteinFoods.length];
    const postCarb = carbFoods[(2 + shift) % carbFoods.length];
    postItems.push(mkItem(postProt, Math.round((totalProtein * postW.proteinPct) / Math.max(postProt.protein, 0.1) * 100 / 100 * 100)));
    postItems.push(mkItem(postCarb, Math.round((totalCarbs * postW.carbPct) / Math.max(postCarb.carbs, 0.1) * 100 / 100 * 100)));
    meals.push({ name: postW.name, time: postW.time, items: postItems });

    const remProtPct = 1.0 - preW.proteinPct - postW.proteinPct;
    const remFatPct = 1.0 - preW.fatPct - postW.fatPct;
    const remCarbPct = 1.0 - preW.carbPct - postW.carbPct;

    const mornProt = proteinFoods[(2 + shift) % proteinFoods.length];
    const mornCarb = carbFoods[(0 + shift) % carbFoods.length];
    const mornFat = fatFoods[(0 + shift) % fatFoods.length];
    meals.push({ name: 'Завтрак', time: '07:00', items: [
      mkItem(mornProt, Math.round(totalProtein * 0.30 * remProtPct / Math.max(mornProt.protein, 0.1) * 100)),
      mkItem(mornCarb, Math.round(totalCarbs * 0.35 * remCarbPct / Math.max(mornCarb.carbs, 0.1) * 100)),
      mkItem(mornFat, Math.round(totalFat * 0.40 * remFatPct / Math.max(mornFat.fat, 0.1) * 100)),
    ]});

    const lunchProt = proteinFoods[(3 + shift) % proteinFoods.length];
    const lunchCarb = carbFoods[(3 + shift) % carbFoods.length];
    const lunchFat = fatFoods[(1 + shift) % fatFoods.length];
    const lunchVeg = vegFoods[(0 + shift) % vegFoods.length];
    const lunchItems = [
      mkItem(lunchProt, Math.round(totalProtein * 0.40 * remProtPct / Math.max(lunchProt.protein, 0.1) * 100)),
      mkItem(lunchCarb, Math.round(totalCarbs * 0.40 * remCarbPct / Math.max(lunchCarb.carbs, 0.1) * 100)),
      mkItem(lunchFat, Math.round(totalFat * 0.35 * remFatPct / Math.max(lunchFat.fat, 0.1) * 100)),
    ];
    if (lunchVeg) lunchItems.push(mkItem(lunchVeg, 150));
    meals.push({ name: 'Обед', time: '13:00', items: lunchItems });

    const dinnerProt = proteinFoods[(0 + shift) % proteinFoods.length];
    const dinnerCarb = carbFoods[(1 + shift) % carbFoods.length];
    const dinnerVeg = vegFoods[(1 + shift) % vegFoods.length];
    const dinnerItems = [
      mkItem(dinnerProt, Math.round(totalProtein * 0.30 * remProtPct / Math.max(dinnerProt.protein, 0.1) * 100)),
      mkItem(dinnerCarb, Math.round(totalCarbs * 0.25 * remCarbPct / Math.max(dinnerCarb.carbs, 0.1) * 100)),
    ];
    if (dinnerVeg) dinnerItems.push(mkItem(dinnerVeg, 120));
    meals.push({ name: 'Ужин', time: '19:00', items: dinnerItems });
  } else {
    const mornProt = proteinFoods[(0 + shift) % proteinFoods.length];
    const mornCarb = carbFoods[(0 + shift) % carbFoods.length];
    const mornFat = fatFoods[(0 + shift) % fatFoods.length];
    meals.push({ name: 'Завтрак', time: '07:00', items: [
      mkItem(mornProt, Math.round(totalProtein * 0.25 / Math.max(mornProt.protein, 0.1) * 100)),
      mkItem(mornCarb, Math.round(totalCarbs * 0.20 / Math.max(mornCarb.carbs, 0.1) * 100)),
      mkItem(mornFat, Math.round(totalFat * 0.30 / Math.max(mornFat.fat, 0.1) * 100)),
    ]});

    const lunchProt = proteinFoods[(1 + shift) % proteinFoods.length];
    const lunchCarb = carbFoods[(1 + shift) % carbFoods.length];
    const lunchFat = fatFoods[(1 + shift) % fatFoods.length];
    const lunchVeg = vegFoods[(0 + shift) % vegFoods.length];
    const lunchItems = [
      mkItem(lunchProt, Math.round(totalProtein * 0.30 / Math.max(lunchProt.protein, 0.1) * 100)),
      mkItem(lunchCarb, Math.round(totalCarbs * 0.30 / Math.max(lunchCarb.carbs, 0.1) * 100)),
      mkItem(lunchFat, Math.round(totalFat * 0.25 / Math.max(lunchFat.fat, 0.1) * 100)),
    ];
    if (lunchVeg) lunchItems.push(mkItem(lunchVeg, 150));
    meals.push({ name: 'Обед', time: '13:00', items: lunchItems });

    const snackProt = proteinFoods[(2 + shift) % proteinFoods.length];
    const snackCarb = carbFoods[(2 + shift) % carbFoods.length];
    meals.push({ name: 'Перекус', time: '16:00', items: [
      mkItem(snackProt, Math.round(totalProtein * 0.10 / Math.max(snackProt.protein, 0.1) * 100)),
      mkItem(snackCarb, Math.round(totalCarbs * 0.15 / Math.max(snackCarb.carbs, 0.1) * 100)),
    ]});

    const dinnerProt = proteinFoods[(3 + shift) % proteinFoods.length];
    const dinnerCarb = carbFoods[(3 + shift) % carbFoods.length];
    const dinnerVeg = vegFoods[(1 + shift) % vegFoods.length];
    const dinnerItems = [
      mkItem(dinnerProt, Math.round(totalProtein * 0.25 / Math.max(dinnerProt.protein, 0.1) * 100)),
      mkItem(dinnerCarb, Math.round(totalCarbs * 0.25 / Math.max(dinnerCarb.carbs, 0.1) * 100)),
    ];
    if (dinnerVeg) dinnerItems.push(mkItem(dinnerVeg, 120));
    meals.push({ name: 'Ужин', time: '19:00', items: dinnerItems });
  }

  let tKcal = 0, tProt = 0, tFat2 = 0, tCarb = 0;
  for (const meal of meals) for (const item of meal.items) { tKcal += item.kcal; tProt += item.protein; tFat2 += item.fat; tCarb += item.carbs; }
  return { dayIndex, isTrainingDay, meals, totals: { kcal: tKcal, protein: tProt, fat: tFat2, carbs: tCarb } };
}

export function generateTierMealPlan(input: MealPlanInput): MealPlanResult {
  const { weightKg, heightCm, age, sex, goal, tier, trainingDaysPerWeek, avgWorkoutMinutes, includeWorkoutMeals, labsContext } = input;
  const tc = TIER_CONFIG[tier];
  const ga = GOAL_ADJUST[goal];
  const bmr = calcBMR(weightKg, heightCm, age, sex);
  const pal = calcPAL(trainingDaysPerWeek, avgWorkoutMinutes);
  const tdee = bmr * pal;
  const totalKcal = Math.round(tdee * tc.kcalMultiplier + ga.kcalAdj);
  const totalProtein = Math.round(weightKg * (tc.proteinPerKg + ga.protAdj));
  const totalFat = Math.round(weightKg * tc.fatPerKg);
  const totalCarbs = Math.round((totalKcal - totalProtein * 4 - totalFat * 9) / 4);

  const trainingDays = new Set<number>();
  if (trainingDaysPerWeek >= 1) {
    const step = Math.max(1, Math.floor(7 / trainingDaysPerWeek));
    for (let i = 0; i < trainingDaysPerWeek && i < 7; i++) trainingDays.add(i * step);
  }

  const dayPlans: DayPlan[] = [];
  for (let d = 0; d < 7; d++) {
    dayPlans.push(generateDayPlan(d, trainingDays.has(d), totalKcal, totalProtein, totalFat, totalCarbs, tier, includeWorkoutMeals ?? false));
  }

  let workoutMealPlan: WorkoutMealPlan | null = null;
  if (includeWorkoutMeals) {
    workoutMealPlan = {
      description: 'Питание до и после тренировки. Жиры минимизированы, углеводы с высоким ГИ перед тренировкой, быстрый протеин + углеводы после.',
      meals: [
        { name: 'За 1-2ч до тренировки', time: '-1-2h', items: [
          { foodName: 'Филе курицы / индейки', foodId: 'turkey_breast', amount: 150, kcal: 165, protein: 34, fat: 2, carbs: 0 },
          { foodName: 'Рис / макароны', foodId: 'rice_white', amount: 200, kcal: 260, protein: 5, fat: 1, carbs: 57 },
        ]},
        { name: 'После тренировки (30мин)', time: '+30m', items: [
          { foodName: 'Протеин сывороточный', foodId: 'whey_protein', amount: 40, kcal: 160, protein: 30, fat: 2, carbs: 3 },
          { foodName: 'Банан / амилопектин', foodId: 'banana', amount: 150, kcal: 135, protein: 2, fat: 0, carbs: 35 },
        ]},
      ],
      supplements: tier === 'boost' ? [
        { name: 'Креатин', dose: '5г', timing: 'после тренировки', reason: 'восстановление АТФ' },
        { name: 'Амилопектин', dose: '30г', timing: 'перед тренировкой', reason: 'быстрый гликоген' },
      ] : tier === 'max' ? [
        { name: 'Креатин', dose: '5г', timing: 'после тренировки', reason: 'восстановление АТФ' },
      ] : [],
    };
  }

  const recommendations: string[] = [];
  recommendations.push('✅ Уровень: ' + tc.label + ' — ' + tc.description);
  recommendations.push('🏋️ Цель: ' + ga.label + ' (дефицит: ' + (ga.kcalAdj > 0 ? '+' : '') + ga.kcalAdj + ' ккал)');
  recommendations.push('📊 КБЖУ: ' + totalKcal + ' ккал | Б:' + totalProtein + 'г | Ж:' + totalFat + 'г | У:' + totalCarbs + 'г');
  if (tier === 'boost') recommendations.push('💊 Добавки: креатин, омега-3, витамин D3, куркумин, амилопектин');
  else if (tier === 'max') recommendations.push('💊 Добавки: креатин, омега-3, витамин D3');

  if (labsContext) {
    if (labsContext.homaIR && labsContext.homaIR > 2.5) recommendations.push('⚠️ HOMA-IR повышен — снизить углеводы, использовать низко-ГИ продукты');
    if (labsContext.liverStress && labsContext.liverStress > 40) recommendations.push('⚠️ Печёночная нагрузка — исключить алкоголь, добавить NAC, омега-3');
    if (labsContext.kidneyStress && labsContext.kidneyStress > 40) recommendations.push('⚠️ Почечная нагрузка — контроль белка и соли');
  }

  const regimeAdvice = generateRegimeAdvice();

  return {
    dayPlans, workoutMealPlan, recommendations, regimeAdvice,
    summary: { avgKcal: totalKcal, avgProtein: totalProtein, avgFat: totalFat, avgCarbs: totalCarbs, tier, goal },
  };
}

export function generateRegimeAdvice(): string[] {
  const advice: string[] = [];
  advice.push('🥛 Осторожность с молочными: лактоза повышает СРБ и провоцирует застой желчи, что может вызвать акне.');
  advice.push('🌿 Индивидуальные нормы клетчатки: 3–30 г/сут. Избыток может вызвать диарею.');
  advice.push('🏋️ Ешь за 1–2ч до тренировки — для лучшей продуктивности.');
  advice.push('🍊 Контроль фруктозы: если гликоген заполнен — фруктоза идёт в жир. Следи за количеством.');
  advice.push('✨ Основа — свежая пища. Джанк допустим не более 15–20% от рациона.');
  advice.push('🥩 Белок не более 50 г за приём — эффективное распределение нутриентов.');
  advice.push('🍽️ Есть только при чувстве голода. Не нужно в себя пихать через силу.');
  advice.push('⚖️ Баланс нутриентов: каждый приём — Б+Ж+У. До/после тренировки — минимум жиров.');
  advice.push('🪰 Еда не должна вызывать дискомфорт: вздутие, нарушения стула — пересмотреть рацион или ЖКТ.');
  advice.push('⏰ 3–4 основных приёма + протеиновый коктейль после тренировки. При СРК — меньше приёмов.');
  advice.push('⚠️ Квашеная капуста и соления — не ежедневно. Грибки (закваска) + натрий — негативно.');
  return advice;
}

export function generateLabsBasedAdvice(labs?: LabsContext): string[] {
  const advice: string[] = [];
  if (!labs) { advice.push('Данные анализов недоступны — используются базовые рекомендации.'); return advice; }
  if (labs.homaIR !== undefined && labs.homaIR > 2.5) advice.push('⚠️ HOMA-IR ' + labs.homaIR.toFixed(1) + ' — инсулинорезистентность. Низко-ГИ углеводы, ограничить фруктозу, добавить берберин.');
  if (labs.liverStress !== undefined && labs.liverStress > 40) advice.push('⚠️ Печёночная нагрузка ' + labs.liverStress + '% — исключить алкоголь, добавить NAC, омега-3, расторопшу.');
  if (labs.kidneyStress !== undefined && labs.kidneyStress > 40) advice.push('⚠️ Почечная нагрузка ' + labs.kidneyStress + '% — контроль белка до 1.6 г/кг, ограничить соль.');
  if (labs.inflammation !== undefined && labs.inflammation > 4) advice.push('⚠️ Воспаление ' + labs.inflammation.toFixed(1) + ' — противовоспалительная диета: омега-3, куркумин, ягоды.');
  if (labs.hormoneScore !== undefined && labs.hormoneScore > 40) advice.push('⚠️ Гормональный дисбаланс ' + labs.hormoneScore + '% — цинк, витамин D, крестоцветные.');
  if (advice.length === 0) advice.push('✅ Все показатели в норме — стандартный план питания.');
  return advice;
}

const CUSTOM_FOODS_KEY = 'custom_foods_v1';
const CUSTOM_TARGETS_KEY = 'custom_targets_v1';

export function saveCustomFood(entry: CustomFoodEntry): void {
  const foods = loadCustomFoods();
  const idx = foods.findIndex(f => f.id === entry.id);
  if (idx >= 0) foods[idx] = entry; else foods.push(entry);
  localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
}

export function loadCustomFoods(): CustomFoodEntry[] {
  try { const raw = localStorage.getItem(CUSTOM_FOODS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function deleteCustomFood(id: string): void {
  const foods = loadCustomFoods().filter(f => f.id !== id);
  localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
}

export function saveCustomTargets(targets: { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number }): void {
  localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(targets));
}

export function loadCustomTargets(): { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number } | null {
  try { const raw = localStorage.getItem(CUSTOM_TARGETS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
