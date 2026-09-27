/**
 * planner-meal-count.ts — единый расчёт рекомендуемого числа приёмов пищи.
 *
 * Задача (жалоба «рекомендация считается по времени, а не по тому, сколько
 * можно НОРМАЛЬНО разбить»): число приёмов должно определяться ёмкостью
 * нормальной тарелки, а не только длиной дня. Часы бодрствования — лишь
 * физиологический ПОЛ (3–5), чтобы окно приёмов не сжималось в 2 гигантских.
 *
 * Ёмкость «нормальной» тарелки (единый источник для UI и движка):
 *  - белок: ≤ perMealProteinCapG (0.45 г/кг, зажато 45–70 г — больше 70 г за
 *    приём на практике уже «ведро», меньше 45 — недобор MPS у крупного атлета);
 *  - углеводы: ≤ 120 г/приём (капы движка: мейны ~200-250 г, снеки 120, peri 60-75);
 *  - калории: ≤ 900 ккал/приём (полноценная плотная тарелка).
 *
 * Возврат max(пол по часам, ёмкость белка, ёмкость углей, ёмкость ккал) в [3..10].
 * Батч-совместимость: без opts считается по прежним константам (вес 80, без ккал).
 */
export interface RecommendMealCountOpts {
  weightKg?: number;
  kcal?: number;
  onCourse?: boolean;
}

/** Нормальная тарелка белка (г/приём): 0.45 г/кг, на курсе/ААС 0.55 (верх 0.4–0.55), зажато 45–75. */
export function perMealProteinCapG(weightKg?: number, onCourse?: boolean): number {
  const w = Number.isFinite(weightKg) && (weightKg as number) > 0 ? (weightKg as number) : 80;
  const perKg = onCourse ? 0.55 : 0.45;
  return Math.max(45, Math.min(75, Math.round(w * perKg)));
}

export type MealCountBinding = 'awake' | 'protein' | 'carbs' | 'kcal' | 'insulin';

export interface MealCountRecommendation {
  count: number;
  binding: MealCountBinding;
  awakeFloor: number;
  pCap: number;
  byProtein: number;
  byCarbs: number;
  byKcal: number;
}

/** Полная разбивка рекомендации — для честного текста в UI. */
export function recommendMealCountDetailed(
  awakeH: number,
  proteinG: number,
  carbsG: number,
  opts: RecommendMealCountOpts = {},
): MealCountRecommendation {
  const h = Number.isFinite(awakeH) ? awakeH : 16;
  const awakeFloor = h >= 16 ? 5 : h >= 14 ? 4 : 3;
  const pCap = perMealProteinCapG(opts.weightKg, opts.onCourse);
  const byProtein = Math.ceil(Math.max(0, Number.isFinite(proteinG) ? proteinG : 0) / pCap);
  const byCarbs = Math.ceil(Math.max(0, Number.isFinite(carbsG) ? carbsG : 0) / 120);
  const byKcal = Number.isFinite(opts.kcal) && (opts.kcal as number) > 0 ? Math.ceil((opts.kcal as number) / 900) : 0;
  const count = Math.max(3, Math.min(10, Math.max(awakeFloor, byProtein, byCarbs, byKcal)));
  const binding: MealCountBinding =
    count === awakeFloor ? 'awake'
      : count === byKcal ? 'kcal'
        : count === byCarbs ? 'carbs'
          : 'protein';
  return { count, binding, awakeFloor, pCap, byProtein, byCarbs, byKcal };
}

export function recommendMealCount(
  awakeH: number,
  proteinG: number,
  carbsG: number,
  opts: RecommendMealCountOpts = {},
): number {
  return recommendMealCountDetailed(awakeH, proteinG, carbsG, opts).count;
}

// ─── Волна 1: HV-расширение ──────────────────────────────────────────────────
// При 1500г У / 500г Б стандартный кап 45-75г белка на приём не подходит:
// нужно 8-12 приёмов с прогрессивным капом.

/** Прогрессивный кап белка на приём для HV-дней. */
export function hvProteinCapPerMeal(
  totalProteinG: number,
  mealsCount: number,
  weightKg: number,
): number {
  const perMeal = totalProteinG / mealsCount;
  const base = perMeal <= 40 ? perMeal : perMeal <= 60 ? perMeal * 1.1 : Math.min(perMeal * 1.2, 350);
  const weightBonus = Math.max(1, Math.min(1.3, weightKg / 80));
  return Math.round(base * weightBonus);
}

/** Авто-расширение приёмов для HV-дней (1500г У / 500г Б). */
export function autoMealCountForHv(
  targetCarbsG: number,
  targetProteinG: number,
  weightKg: number,
  baseMealsCount: number,
): number {
  const isHv = targetCarbsG >= 1200 || targetProteinG >= 400;
  if (!isHv) return baseMealsCount;
  const byCarbs = Math.ceil(targetCarbsG / 180);
  const byProtein = Math.ceil(targetProteinG / 50);
  const needed = Math.max(byCarbs, byProtein, 8);
  return Math.min(needed, 12);
}

// ─── E1: структура дня — приёмы, окна инсулина, peri ────────────────────────
export interface MealStructureInput {
  awakeH: number;
  proteinG: number;
  carbsG: number;
  kcal?: number;
  weightKg?: number;
  /** Курс/ААС: белок на приём тянется к верхней границе 0.5–0.55 г/кг. */
  onCourse?: boolean;
  /** Число болюсов инсулина: каждое окно dose×10 г У требует своего приёма. */
  insulinBoluses?: number;
  isTrainingDay?: boolean;
  allowIntraWorkout?: boolean;
}

export interface MealStructure {
  /** Число ОСНОВНЫХ приёмов (завтрак/обед/ужин/перекусы/pre-sleep). */
  regularMeals: number;
  /** Peri-приёмы сверх основных (предтрен/пост-трен/intra). */
  periMeals: number;
  /** Окна болюсов (инжектируются движком отдельными приёмами). */
  insulinWindows: number;
  /** Итог для показа и guardrail. */
  totalMeals: number;
  binding: MealCountBinding;
  pCap: number;
}

/**
 * Оптимальная структура дня. Белок 0.4–0.55 г/кг на приём (на курсе — к верхней
 * границе), углеводы ≤130 г и ккал ≤950 на приём; окна инсулина не «съедают»
 * обычные приёмы (идут сверх, как в движке); часы — только пол.
 */
export function planMealStructure(input: MealStructureInput): MealStructure {
  const onCourse = !!input.onCourse;
  const opts: RecommendMealCountOpts = { weightKg: input.weightKg, kcal: input.kcal, onCourse };
  const rec = recommendMealCountDetailed(input.awakeH, input.proteinG, input.carbsG, opts);
  const pCap = perMealProteinCapG(input.weightKg, onCourse);
  const byProtein = Math.ceil(Math.max(0, input.proteinG) / pCap);
  const byCarbs = Math.ceil(Math.max(0, input.carbsG) / 130);
  const byKcal = Number.isFinite(input.kcal) && (input.kcal as number) > 0 ? Math.ceil((input.kcal as number) / 950) : 0;
  const insulinWindows = Math.max(0, Math.min(6, Math.round(input.insulinBoluses || 0)));
  let regular = Math.max(rec.awakeFloor, byProtein, byCarbs, byKcal, 3);
  // Каждому болюсному окну нужен «свой» регулярный приём-хозяин (движок инжектирует
  // окно отдельным приёмом — но раскладка остальных углеводов требует минимум +1 слот).
  if (insulinWindows > 0) regular = Math.max(regular, Math.min(9, insulinWindows + 3));
  // Волна 1: HV-расширение для экстремальных КБЖУ (1500г У / 500г Б)
  regular = autoMealCountForHv(input.carbsG, input.proteinG, input.weightKg || 80, regular);
  regular = Math.max(3, Math.min(12, regular));
  const periMeals = input.isTrainingDay ? (input.allowIntraWorkout ? 3 : 2) : 0;
  const binding: MealCountBinding =
    regular === rec.awakeFloor ? 'awake'
      : regular === byKcal ? 'kcal'
        : regular === byCarbs ? 'carbs'
          : regular === byProtein ? 'protein'
            : 'insulin';
  return { regularMeals: regular, periMeals, insulinWindows, totalMeals: regular + periMeals, binding, pCap };
}

/** Часы бодрствования из строк «HH:MM» (учитывает переход через полночь). */
export function awakeHoursFromTimes(wakeTime?: string, bedTime?: string): number {
  const toMin = (t: string): number => {
    try {
      const [h, m] = (t || '').split(':').map(Number);
      return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : NaN;
    } catch { return NaN; }
  };
  let a = toMin(wakeTime || '07:30');
  let b = toMin(bedTime || '22:30');
  if (!Number.isFinite(a)) a = 7 * 60 + 30;
  if (!Number.isFinite(b)) b = 22 * 60 + 30;
  if (b <= a) b += 1440;
  return Math.round((b - a) / 60);
}
