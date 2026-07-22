/**
 * planner-female-cycle.ts — Женская физиология для планировщика.
 *
 * #1 Менструальный цикл: питание зависит от фазы (follicular/ovulation/
 * luteal/menstrual). Движок собирает фазу, но раньше не использовал её.
 *
 * Физиология (на основе спортивной диетологии для женщин — Stacy Sims,
 * ICMJE,Position stands):
 *   follicular (эстроген ↑, прогестерон ↓): лучшая инсулиночувствительность,
 *       выше толерантность к углеводам, пик силы/интенсивности → ккал basal,
 *       нормальный GI carbs.
 *   ovulation: короткий пик эстрогена → slight kcal+, нормальные carbs.
 *   luteal (прогестерон ↑↑): +100–300 ккал BMR, инсулинорезистентность,
 *       тяги, задержка воды → ниже GI carbs, больше белка/жиров, Mg/B6/
 *       триптофан (настроение/сон), выше Fe-фокус.
 *   menstrual: потеря железа, воспаление, судороги → гемовый Fe + вит C,
 *       противовоспалительные (омега-3, куркумин, имбирь), ниже интенсивность.
 *
 * #2 Кости/кальций: у женщин с низким %жира / аменореей / на определённых
 *    контрацептивах — потеря плотности костей. Ca target 1200–1500 мг,
 *    дробно (≤500 мг за приём для абсорбции), VitD + VitK2.
 */

export type MenstrualPhase = 'none' | 'follicular' | 'ovulation' | 'luteal' | 'menstrual';

export interface MenstrualPhaseNutrition {
  kcalMod: number;      // множитель дневной калорийности
  carbMod: number;      // множитель углеводов
  carbGiPref: 'low' | 'normal' | 'high'; // предпочтение по GI
  priorityIds: string[];  // prefer-продукты (богатые фокус-нутриентами)
  avoidIds: string[];     // исключить/деприоритизировать
  microFocus: string[];   // фокусные нутриенты (для заметок/предпочтений)
  note: string;
}

export const MENSTRUAL_PHASE_NUTRITION: Record<Exclude<MenstrualPhase, 'none'>, MenstrualPhaseNutrition> = {
  follicular: {
    kcalMod: 1.0,
    carbMod: 1.0,
    carbGiPref: 'normal',
    priorityIds: ['chicken_breast','salmon','egg_whole','oats','quinoa','sweet_potato','berries','spinach','almonds'],
    avoidIds: ['alcohol','processed_food'],
    microFocus: ['protein','Mg','Zn'],
    note: '🌸 Фолликулярная фаза: пиковая инсулиночувствительность и сила — нормальные углеводы, можно высокую интенсивность. Белок 2.2–2.5 г/кг.',
  },
  ovulation: {
    kcalMod: 1.03,
    carbMod: 1.05,
    carbGiPref: 'normal',
    priorityIds: ['salmon','egg_whole','avocado','olive_oil','spinach','berries','dark_chocolate'],
    avoidIds: ['alcohol','sugar','processed_food'],
    microFocus: ['Mg','Zn','VitE'],
    note: '🌸 Овуляция: кратковременный пик эстрогена — лёгкий профицит, антиоксиданты (VitE, омега-3). Mg/Zn для гормональной оси.',
  },
  luteal: {
    kcalMod: 1.08,        // +~150-250 ккал BMR
    carbMod: 0.85,        // ниже углеводы (инсулинорезистентность)
    carbGiPref: 'low',    // низкий GI
    priorityIds: ['salmon','avocado','olive_oil','nuts_almonds','dark_chocolate','turkey_breast','egg_whole','spinach','pumpkin_seeds','flaxseed','tart_cherry','chickpeas','lentils'],
    avoidIds: ['sugar','bread_white','rice_white','potato_boiled','alcohol','caffeine_high'],
    microFocus: ['Mg','B6','tryptophan','Fe','omega3'],
    note: '🌸 Лютеиновая фаза: +100–300 ккал BMR, инсулинорезистентность → НИЗКИЙ GI углеводов, больше белка/здоровых жиров. Mg (400мг, PMS/судороги), B6, триптофан (настроение/сон, индейка/яйцо), омега-3 (противовоспалительно). Возможны тяги — удовлетворяй через complex carbs/тёмный шоколад, не сахар.',
  },
  menstrual: {
    kcalMod: 0.97,
    carbMod: 0.95,
    carbGiPref: 'low',
    priorityIds: ['beef_lean','beef_liver','salmon','spinach','lentils','pumpkin_seeds','orange','kiwi','pepper','turmeric','ginger','bone_broth','dark_chocolate'],
    avoidIds: ['alcohol','caffeine_high','processed_food','sugar'],
    microFocus: ['Fe','VitC','Mg','omega3','Ca'],
    note: '🌸 Менструация: потеря железа → гемовый Fe (говядина/печень) + витамин C (цитрус/перец/киви) для абсорбции. Противовоспалительные: омега-3, куркумин, имбирь. Mg от судорог. Ниже интенсивность тренировок. Избегать кофеина/алкоголя.',
  },
};

/** Получить нутрицию по фазе (null если none). */
export function getMenstrualPhaseNutrition(phase: MenstrualPhase): MenstrualPhaseNutrition | null {
  if (phase === 'none') return null;
  return MENSTRUAL_PHASE_NUTRITION[phase] || null;
}

// ── #2 Кости / кальций ──────────────────────────────────────────────

/**
 * Женский кальциевый таргет: 1000 мг базово, 1200–1500 мг при факторах
 * риска потери костной массы (низкий %жира, аменорея, менопауза).
 *
 * @param sex пол
 * @param bodyFatPct процент жира
 * @param cyclePhase фаза цикла (amenorrhea ~ регулярный menstrual = ок; 'none' у спортсменок может означать аменорею)
 * @param age возраст (менопауза ~ 50+)
 * @param hasAmenorrhea явный флаг аменореи (опционально)
 */
export function getCalciumTarget(
  sex: 'male' | 'female',
  bodyFatPct: number | undefined,
  cyclePhase: MenstrualPhase,
  age: number,
  hasAmenorrhea = false,
): { target: number; boneRisk: boolean; note: string } {
  const base = 1000;
  if (sex !== 'female') return { target: base, boneRisk: false, note: '' };
  const lowBf = bodyFatPct !== undefined && bodyFatPct < 18;
  const menopausal = age >= 50;
  const amenorrhea = hasAmenorrhea || (cyclePhase === 'none' && lowBf); // спортсменки с низким %жира и без регулярного цикла
  const boneRisk = lowBf || menopausal || amenorrhea;
  if (menopausal) return { target: 1500, boneRisk: true, note: '🦴 Менопауза: Ca 1500 мг/день (потеря костной массы), VitD 2000–4000 МЕ + K2, силовые тренировки.' };
  if (amenorrhea) return { target: 1500, boneRisk: true, note: '🦴 Вероятная аменорея (низкий %жира + нет регулярного цикла): Ca 1500 мг, VitD/K2 — риск потери плотности костей.' };
  if (lowBf) return { target: 1200, boneRisk: true, note: '🦴 Низкий %жира: Ca 1200 мг (риск костной плотности), VitD + K2, отслеживать цикл.' };
  return { target: base, boneRisk: false, note: '' };
}

/**
 * Дробление кальция: ≤500 мг за приём для оптимальной абсорбции.
 * Возвращает рекомендацию по распределению.
 */
export function calciumDoseSplitNote(): string {
  return '💊 Кальций: дробите на дозы ≤500 мг (одномоментно усваивается не более ~500 мг). Ca отдельно от железа и кофе/чая (танины/оксалаты блокируют).';
}

// ── #3 Женский тайминг добавок ──────────────────────────────────────

export interface FemaleSupplementRule {
  supplement: string;
  rule: string;
  applies: (cyclePhase: MenstrualPhase) => boolean;
}

export const FEMALE_SUPPLEMENT_RULES: FemaleSupplementRule[] = [
  {
    supplement: 'Железо',
    rule: 'С витамином C (цитрус/перец), ОТДЕЛЬНО от кальция и кофе/чая (интервал 2 ч). Гемовое Fe (мясо/печень) лучше усваивается.',
    applies: () => true,
  },
  {
    supplement: 'Кальций',
    rule: 'Дробно ≤500 мг за приём, с едой. НЕ вместе с железом. Citrate — натощак, carbonate — с едой.',
    applies: () => true,
  },
  {
    supplement: 'Магний',
    rule: '400–600 мг на ночь, особенно в лютеиновой фазе (PMS, судороги, сон). Glycinate — для сна, citrate — при запорах.',
    applies: (p) => p === 'luteal' || p === 'menstrual' || p === 'none',
  },
  {
    supplement: 'B6',
    rule: '50–100 мг в лютеиновой фазе (снижение PMS-симптомов, поддержка серотонина).',
    applies: (p) => p === 'luteal',
  },
  {
    supplement: 'Омега-3',
    rule: '2–3 г EPA+DHA — противовоспалительно, особенно в менструацию/лютеиновую.',
    applies: (p) => p === 'luteal' || p === 'menstrual',
  },
];

/** Получить применимые женские правила добавок по фазе. */
export function getFemaleSupplementRules(cyclePhase: MenstrualPhase): FemaleSupplementRule[] {
  return FEMALE_SUPPLEMENT_RULES.filter(r => r.applies(cyclePhase));
}
