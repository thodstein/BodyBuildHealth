/**
 * planner-micro-coverage.ts — Микронутриентный coverage плана питания.
 *
 * FOOD_DB.micros содержит Ca/Fe/Mg/P/K/Na/Zn/Se/витамины/Omega3 на 100г.
 * Этот модуль суммирует микронутриенты по плану, сравнивает с RDA-таргетами
 * (зависят от пола/веса/фазы курса/тренировочного дня) и выявляет дефициты/избытки.
 *
 * RDA-источники: IOM DRI (мужчина 19-50 по умолчанию), скорректировано для
 * бодибилдера (повышенный Mg/Zn при нагрузке, управление Fe на AAS-курсе).
 */

export interface FoodLike { id: string; amount: number; }
export interface FoodDbLike { id: string; micros?: Record<string, number>; }

export type Sex = 'male' | 'female';
export type CyclePhase = 'course' | 'pct' | 'cutting' | 'bridge' | 'recovery' | 'maintenance' | undefined;

export interface MicroTarget { nutrient: string; target: number; unit: string; }
export interface MicroCoverageEntry { nutrient: string; actual: number; target: number; pct: number; unit: string; status: 'deficit' | 'low' | 'ok' | 'high'; }
export interface MicroCoverageResult {
  totals: Record<string, number>;
  coverage: MicroCoverageEntry[];
  deficits: string[];   // человеко-читаемые warnings для plan notes
  surpluses: string[];
  /** ID продуктов-источников для самого дефицитного нутриента (для prefer-логики следующего дня). */
  topDeficitNutrient: string | null;
}

// Канонические RDA (мужчина 19-50, бодибилдер). Размерность — единицы micros в FOOD_DB.
const RDA_BASE: Record<string, { male: number; female: number; unit: string; label: string }> = {
  Ca:   { male: 1000, female: 1000, unit: 'мг', label: 'Кальций' },
  Fe:   { male: 8,    female: 18,   unit: 'мг', label: 'Железо' },
  Mg:   { male: 420,  female: 320,  unit: 'мг', label: 'Магний' },
  Zn:   { male: 11,   female: 8,    unit: 'мг', label: 'Цинк' },
  Se:   { male: 55,   female: 55,   unit: 'мкг', label: 'Селен' },
  K:    { male: 3500, female: 3500, unit: 'мг', label: 'Калий' },
  Na:   { male: 2300, female: 2300, unit: 'мг', label: 'Натрий' },
  VitC: { male: 90,   female: 75,   unit: 'мг', label: 'Витамин C' },
  VitD: { male: 15,   female: 15,   unit: 'мкг', label: 'Витамин D' },
  VitB12:{ male: 2.4, female: 2.4,  unit: 'мкг', label: 'B12' },
  VitB6:{ male: 1.7,  female: 1.5,  unit: 'мг', label: 'B6' },
  VitB9:{ male: 400,  female: 400,  unit: 'мкг', label: 'Фолат' },
  VitA: { male: 900,  female: 700,  unit: 'мкг', label: 'Витамин A' },
  VitE: { male: 15,   female: 15,   unit: 'мг', label: 'Витамин E' },
  VitK: { male: 120,  female: 90,   unit: 'мкг', label: 'Витамин K' },
  Omega3:{ male: 1600, female: 1100, unit: 'мг', label: 'Омега-3' },
};

// Пороги покрытия: <70% = deficit (warning), 70-90% = low, 90-150% = ok, >upperLimit = high.
const DEFICIT_PCT = 70;
const LOW_PCT = 90;
// Верхние пределы (только для нутриентов с риском избытка).
// Расширено: VitC (UL 2000мг), Ca (UL 2500мг), Mg (UL 350мг из добавок), Omega3 (6000мг).
const UPPER_LIMIT: Record<string, number> = {
  Na: 5000,    // мг — гипертензия
  Se: 400,     // мкг — токсичность
  Fe: 45,      // мг — overload (особенно на AAS-курсе)
  VitA: 3000,  // мкг — гипервитаминоз
  VitD: 100,   // мкг
  Zn: 40,      // мг
  VitC: 2000,  // мг — IOM UL
  Ca: 2500,    // мг — IOM UL
  Mg: 350,     // мг из добавок (IOM UL)
  Omega3: 6000, // мг EPA+DHA — FDA/EFSA
};

/**
 * Таргеты с поправкой на фазу курса/тренировочный день.
 * - course/AAS: Fe снижен (гематокрит), Mg/Zn повышены (андрогенная нагрузка).
 * - cutting: Na нижний порог снижен (потовые потери), K важнее.
 * - тренировочный день: Na таргет выше (потовые потери).
 */
export function getMicroTargets(sex: Sex, weightKg: number, phase: CyclePhase, isTrainingDay: boolean): MicroTarget[] {
  const s = sex || 'male';
  return Object.entries(RDA_BASE).map(([nutrient, v]) => {
    let target = s === 'male' ? v.male : v.female;
    // Поправки по фазе
    if (nutrient === 'Fe' && (phase === 'course' || phase === 'recovery')) {
      target = s === 'male' ? 6 : 12; // ниже на AAS (гематокрит)
    }
    if (nutrient === 'Mg' && (phase === 'course' || phase === 'recovery' || isTrainingDay)) {
      target = Math.round(target * 1.15); // мышечная/андрогенная нагрузка
    }
    if (nutrient === 'Zn' && (phase === 'course' || phase === 'recovery')) {
      target = Math.round(target * 1.25); // андрогенная поддержка
    }
    // Натрий: тренировочный день — выше (потеря с потом ~1г/ч тренинга)
    if (nutrient === 'Na') {
      if (isTrainingDay) target = Math.max(target, 3000 + Math.round(weightKg * 5));
      if (phase === 'cutting') target = Math.max(target, 2500); // не урезать Na на сушке
    }
    if (nutrient === 'K') {
      target = Math.max(target, 3500 + (isTrainingDay ? 500 : 0));
    }
    // Омега-3: на курсе выше (противовоспалительное)
    if (nutrient === 'Omega3' && (phase === 'course' || phase === 'pct')) {
      target = Math.round(target * 1.3);
    }
    return { nutrient, target: Math.round(target), unit: v.unit };
  });
}

const MICRO_CONVERSIONS: Record<string, (v: number) => number> = {
  Omega3: (v: number) => v < 100 ? v * 1000 : v,
};

function normalizeMicroValue(key: string, value: number): number {
  const conv = MICRO_CONVERSIONS[key];
  if (conv) return conv(value);
  return value;
}

/** Суммировать микронутриенты по всем items плана (через FOOD_DB lookup). */
export function sumMicros(items: FoodLike[], foodDb: FoodDbLike[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const it of items) {
    const food = foodDb.find(f => f.id === it.id);
    if (!food || !food.micros) continue;
    const r = (it.amount || 0) / 100;
    for (const [k, v] of Object.entries(food.micros)) {
      const nv = normalizeMicroValue(k, (v || 0));
      totals[k] = (totals[k] || 0) + nv * r;
    }
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k] * 10) / 10;
  return totals;
}

const NUTRIENT_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(RDA_BASE).map(([k, v]) => [k, v.label])
);

/**
 * Анализ покрытия: сравнивает totals с таргетами, формирует warnings.
 */
export function analyzeMicroCoverage(
  microTotals: Record<string, number>,
  sex: Sex,
  weightKg: number,
  phase: CyclePhase,
  isTrainingDay: boolean,
  calciumTargetOverride?: number,
  sodiumTargetOverride?: number,
): MicroCoverageResult {
  const targets = getMicroTargets(sex, weightKg, phase, isTrainingDay);
  const coverage: MicroCoverageEntry[] = [];
  const deficits: string[] = [];
  const surpluses: string[] = [];

  for (const t of targets) {
    if (t.nutrient === 'Ca' && calciumTargetOverride !== undefined) t.target = calciumTargetOverride;
    if (t.nutrient === 'Na' && sodiumTargetOverride !== undefined) t.target = sodiumTargetOverride;
    const actual = microTotals[t.nutrient] || 0;
    const pct = Math.round((actual / Math.max(1, t.target)) * 100);
    const upper = UPPER_LIMIT[t.nutrient];
    let status: MicroCoverageEntry['status'] = 'ok';
    if (pct < DEFICIT_PCT) status = 'deficit';
    else if (pct < LOW_PCT) status = 'low';
    else if (upper !== undefined && actual > upper) status = 'high';
    coverage.push({ nutrient: t.nutrient, actual: Math.round(actual), target: t.target, pct, unit: t.unit, status });

    const label = NUTRIENT_LABEL[t.nutrient] || t.nutrient;
    if (status === 'deficit') {
      const gap = Math.round(t.target - actual);
      deficits.push(`⚠ ${label}: ${Math.round(actual)}${t.unit} / ${t.target}${t.unit} (${pct}%) — дефицит −${gap}${t.unit}`);
    } else if (status === 'high') {
      surpluses.push(`⚠ ${label}: ${Math.round(actual)}${t.unit} > верхнего предела ${upper}${t.unit} — избыток`);
    }
  }

  // Самый дефицитный нутриент (для prefer-логики следующего дня)
  let topDeficitNutrient: string | null = null;
  let worstPct = 100;
  for (const c of coverage) {
    if (c.status === 'deficit' && c.pct < worstPct) { worstPct = c.pct; topDeficitNutrient = c.nutrient; }
  }

  return { totals: microTotals, coverage, deficits, surpluses, topDeficitNutrient };
}

/**
 * Карта нутриент → id-продуктов-источников (для prefer-логики следующего дня).
 * Используется движком чтобы при дефиците Ca/Mg/Zn/Fe... prefer-ить источники.
 */
export const NUTRIENT_SOURCES: Record<string, string[]> = {
  Ca: ['milk','yogurt_greek','cottage_cheese_5','cheese_hard','sardines','almonds','broccoli','kale','chia_seeds','sesame','tofu','fig','spinach'],
  Fe: ['beef_liver','beef_lean','red_meat','lentils','spinach','pumpkin_seeds','dark_chocolate','quinoa','turkey_leg','rabbit'],
  Mg: ['pumpkin_seeds','almonds','spinach','dark_chocolate','avocado','black_beans','quinoa','oats','buckwheat','nuts_mix','cashew'],
  Zn: ['beef_lean','beef_liver','oysters','pumpkin_seeds','cashew','chickpeas','yogurt_greek','cheese_hard','shellfish','dark_chocolate'],
  Se: ['brazil_nut','salmon','tuna','sardines','turkey_breast','beef_lean','eggs','mushrooms','cod'],
  K:  ['avocado','spinach','potato_boiled','salmon','banana','yogurt_greek','coconut','dried_apricots','beetroot','tomato'],
  VitC:['pepper','citrus','kiwi','strawberry','broccoli','kale','papaya','pineapple','berries','cranberry'],
  VitD:['salmon','mackerel','sardines','egg_whole','tuna','red_fish','mushrooms_uv','cod_liver'],
  Omega3:['salmon','mackerel','sardines','flaxseed','chia_seeds','walnuts','red_fish','herring','tuna_steak'],
  VitB12:['beef_liver','salmon','tuna','sardines','beef_lean','egg_whole','milk','cheese_hard','mackerel'],
  VitB9:['lentils','spinach','asparagus','chickpeas','broccoli','avocado','beetroot','kale','edamame'],
  VitA:['beef_liver','carrot','sweet_potato','spinach','kale','egg_whole','pumpkin','apricot'],
  VitE:['almonds','sunflower_seeds','spinach','avocado','olive_oil','hazelnut','dark_chocolate'],
  VitK:['kale','spinach','broccoli','brussels','green_bean','asparagus','cabbage','cucumber'],
};
