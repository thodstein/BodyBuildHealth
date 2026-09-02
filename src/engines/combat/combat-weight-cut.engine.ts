/**
 * combat-weight-cut.engine.ts — весогонка ISSN 2025 (full).
 * Источники: ISSN 2025 Fight Camp 8-10нед, тапер 1-2нед -40% vol + heat + water/sodium/carb манипуляции,
 * Barley et al. Sports 2019 weight-cut prevalence, rehydration 125-150%.
 * Изолировано.
 */
export type WaterMode = 'stable' | 'load_cut'; // load 8-10л → 2л fight week
export type SodiumMode = 'stable' | 'moderate_cut'; // 5г→3г→1.5г
export type CarbMode = 'stable' | 'deplete_reload'; // 4г/кг →1г/кг 3д →8г/кг 2д
export type WeighInType = 'day_before_24h' | 'same_day_2h'; // ISSN: 24-36ч MMA/бокс vs 1-2ч борьба/джиу

export interface WeightCutProtocol {
  targetLossKg: number;
  weeksOut: number; // 4-12
  startWeightKg?: number;
  targetWeightKg?: number;
  waterMode: WaterMode;
  sodiumMode: SodiumMode;
  carbMode: CarbMode;
  heatSessions?: boolean; // сауна 15-20′×3/нед в тапер
  dailyStepsTarget?: number;
  weighInType?: WeighInType; // окно восстановления
  fiberGPerDay?: number; // <10г fight week (ISSN)
  orsSodiumMmolPerDl?: number; // 50-90 после взвешивания
  confirmedManipulation?: boolean; // гейт для экстремальных протоколов (как bb-contest-prep)
  notes?: string[];
}

export function getWeighInTypeForDiscipline(discipline: string): WeighInType {
  const d = (discipline || '').toLowerCase();
  // same-day: wrestling, jiujitsu/bjj, judo — 1-2ч окно (Barley: acute cut ограничен)
  if (d.includes('wrest') || d.includes('борь') || d.includes('jiu') || d.includes('джиу') || d.includes('judo') || d.includes('дзюдо') || d.includes('sambo') || d.includes('самбо')) return 'same_day_2h';
  // day-before: MMA, boxing, kickboxing, muay thai — 24-36ч
  return 'day_before_24h';
}

export function buildWeightCutProtocol(
  lossKg: number,
  opts?: Partial<WeightCutProtocol> & { startWeightKg?: number; discipline?: string }
): WeightCutProtocol | null {
  if (!lossKg || lossKg <= 0) return null;
  const w = Math.max(2, Math.min(12, Math.round(lossKg > 6 ? 10 : lossKg > 3 ? 8 : 6)));
  const weighInType: WeighInType = (opts?.weighInType as WeighInType) || (opts?.discipline ? getWeighInTypeForDiscipline(opts.discipline) : (lossKg >= 3 ? 'day_before_24h' : 'day_before_24h'));
  const isSameDay = weighInType === 'same_day_2h';
  // same-day: ограничиваем агрессивность — вода/sodium/carb стабильнее (ISSN: нет времени на регидратацию)
  let waterMode: WaterMode = (opts?.waterMode as WaterMode) ?? (isSameDay ? 'stable' : (lossKg >= 4 ? 'load_cut' : 'stable'));
  let sodiumMode: SodiumMode = (opts?.sodiumMode as SodiumMode) ?? (isSameDay ? 'stable' : (lossKg >= 3 ? 'moderate_cut' : 'stable'));
  let carbMode: CarbMode = (opts?.carbMode as CarbMode) ?? (isSameDay ? 'stable' : (lossKg >= 5 ? 'deplete_reload' : 'stable'));
  // confirmed gate: без подтверждения — форсим stable для load_cut у >5кг
  if (!opts?.confirmedManipulation && lossKg > 5) {
    if (waterMode === 'load_cut') waterMode = 'stable';
    if (carbMode === 'deplete_reload') carbMode = 'stable';
  }
  return {
    targetLossKg: lossKg,
    weeksOut: opts?.weeksOut ?? w,
    startWeightKg: opts?.startWeightKg,
    targetWeightKg: opts?.startWeightKg ? opts.startWeightKg - lossKg : undefined,
    waterMode,
    sodiumMode,
    carbMode,
    heatSessions: opts?.heatSessions ?? (isSameDay ? false : lossKg >= 3),
    dailyStepsTarget: opts?.dailyStepsTarget,
    weighInType,
    fiberGPerDay: opts?.fiberGPerDay ?? (lossKg >= 2 ? 10 : 28),
    orsSodiumMmolPerDl: opts?.orsSodiumMmolPerDl ?? 65,
    confirmedManipulation: !!opts?.confirmedManipulation,
    notes: opts?.notes,
  };
}

export function weightCutPhaseForWeek(week: number, totalWeeks: number, protocol: WeightCutProtocol | null): 'camp' | 'taper' | 'fight_week' | null {
  if (!protocol) return null;
  if (week === totalWeeks) return 'fight_week';
  if (week >= totalWeeks - 1) return 'taper';
  return 'camp';
}

export function weightCutVolumeMultiplier(week: number, totalWeeks: number, protocol: WeightCutProtocol | null): number {
  if (!protocol) return 1;
  const ph = weightCutPhaseForWeek(week, totalWeeks, protocol);
  if (ph === 'fight_week') return 0.65; // fight week — минимум зала
  if (ph === 'taper') return 0.82;
  // camp — дефицит: срез объёма (ISSN: дефицит -10-25% в зависимости от сгонки)
  if (protocol.targetLossKg >= 5) return 0.70;
  if (protocol.targetLossKg >= 3) return 0.75;
  return 1;
}

export function weightCutFiberForWeek(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocol | null
): number {
  if (!protocol) return 28;
  const ph = weightCutPhaseForWeek(week, totalWeeks, protocol);
  // ISSN: <10г/день ×4д fight week даёт 1-2% BM (гликоген+вода+клетчатка)
  if (ph === 'fight_week') return Math.min(10, protocol.fiberGPerDay ?? 10);
  if (ph === 'taper') return protocol.fiberGPerDay ?? 12;
  return 28;
}

export function weightCutOrsProtocol(protocol: WeightCutProtocol | null, lossKg: number): { orsSodium: number; fluidPerHour: string; carbPerHour: string; notes: string[] } {
  const ors = protocol?.orsSodiumMmolPerDl ?? 65;
  const clampedOrs = Math.max(50, Math.min(90, ors));
  return {
    orsSodium: clampedOrs,
    fluidPerHour: '1-1.5 л/ч ORS',
    carbPerHour: '≤60 г/ч быстрых углей (низко-осмолярные)',
    notes: [
      `ORS ${clampedOrs} mmol/дл Na (ISSN: 50-90 при >3% дегидратации; <3% — спорт-напиток <30)`,
      'Первые 1-2ч: только ORS 1-1.5л/ч → затем угли ≤60г/ч (солевые крекеры/бейглы/рисовые хлебцы)',
      'Не пить >1л/ч залпом — риск гипонатриемии; моча светло-жёлтая, вес каждые 60мин',
    ],
  };
}

export function weightCutPostWeighInPlan(
  lossKg: number,
  protocol: WeightCutProtocol | null,
  bodyweightKg: number
): { stage: string; fluids: string; carbs: string; protein: string; fat: string; fiber: string; notes: string[] }[] {
  const isSameDay = protocol?.weighInType === 'same_day_2h';
  if (isSameDay) {
    return [
      { stage: 'Немедленно (0-60мин)', fluids: 'ORS 0.5-1л (Na 50-90)', carbs: '30-40г быстрых (гель/банан)', protein: '10-15г whey', fat: '0г — избегать', fiber: '<5г', notes: ['Same-day 1-2ч: нет времени на полный рефид — лёгкая еда, не перегружать ЖКТ'] },
      { stage: 'До боя (1-2ч)', fluids: 'по жажде + электролиты', carbs: '1-2 г/кг мелкими порциями', protein: '0.3г/кг', fat: 'минимум', fiber: '<10г', notes: ['Цель +2-3% BM, не +10% — времени нет'] },
    ];
  }
  // 24-36ч window (MMA/бокс)
  return [
    { stage: 'Острый (1-2ч post)', fluids: `ORS ${protocol?.orsSodiumMmolPerDl ?? 65} mmol/дл 1-1.5л/ч`, carbs: '≤60г/ч быстрые (низко-осмоляр)', protein: 'минимум', fat: 'исключить (замедляет)', fiber: '<5г', notes: ['ORS приоритет — сначала жидкость+Na, затем угли'] },
    { stage: 'Переход (3-6ч)', fluids: 'вода+электролиты Na/K/Cl', carbs: 'крахмал (рис/картофель/паста) по переносимости', protein: 'умеренно', fat: 'низко', fiber: '<10г', notes: ['Простые крахмалы — легко, без ЖКТ-стресса'] },
    { stage: 'Гликоген (6-24ч)', fluids: `125-150% от сгонки = ${(lossKg * 1.25).toFixed(1)}-${(lossKg * 1.5).toFixed(1)}л за 12-24ч`, carbs: bodyweightKg > 30 ? `${8 * bodyweightKg}-${12 * bodyweightKg}г (8-12г/кг при сильной деплитации) / 4-7г/кг при умеренной` : '8-12г/кг', protein: `~0.4г/кг каждые 3-4ч`, fat: 'низко', fiber: '<10-15г', notes: ['Маленькие частые приёмы, не один болюс; повтор 125-150%'] },
  ];
}

export function weightCutNutritionForWeek(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocol | null,
  bodyweightKg?: number,
  sex?: 'male' | 'female'
): { kcal: number | null; proteinG: number | null; carbsG: number | null; waterMl: number | null; sodiumMg: number | null; fiberG: number | null; orsMmol: number | null; notes: string[] } {
  if (!protocol || bodyweightKg == null || bodyweightKg <= 30) return { kcal: null, proteinG: null, carbsG: null, waterMl: null, sodiumMg: null, fiberG: null, orsMmol: null, notes: [] };
  const ph = weightCutPhaseForWeek(week, totalWeeks, protocol);
  const notes: string[] = [];
  const isSameDay = protocol.weighInType === 'same_day_2h';
  // белок 2.2г/кг camp, 2.3г/кг taper (защита мышц), female — 2.3 г/кг минимум
  const proteinPerKg = ph === 'taper' || ph === 'fight_week' ? 2.3 : 2.2;
  const protein = Math.round(bodyweightKg * proteinPerKg);
  let carbs = Math.round(bodyweightKg * 4); // camp
  let water = Math.round(bodyweightKg * 35); // 35мл/кг
  let sodium = 5000;
  const fiber = weightCutFiberForWeek(week, totalWeeks, protocol);
  if (ph === 'taper') {
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 1) : Math.round(bodyweightKg * 3);
    const rawWater = Math.round(bodyweightKg * 100);
    // confirmed gate: без подтверждения — не делаем экстремальный load 8л
    if (!protocol.confirmedManipulation && protocol.waterMode === 'load_cut') {
      water = Math.round(bodyweightKg * 40);
      notes.push('Load-cut требует подтверждения — вода ограничена 40мл/кг');
    } else {
      water = protocol.waterMode === 'load_cut' ? Math.min(bodyweightKg > 110 ? 5000 : 8000, rawWater) : Math.round(bodyweightKg * 30);
    }
    if (bodyweightKg > 110 && water > 5000) water = 5000;
    sodium = protocol.sodiumMode === 'moderate_cut' ? 3000 : 4000;
    if (bodyweightKg > 110) sodium = Math.min(sodium, 5000);
    notes.push(`Тапер: углеводы ↓ до ${carbs}г, вода ${water}мл (load перед сливом), клетчатка ${fiber}г`);
    if (isSameDay) notes.push('Same-day: острая дегидратация минимизирована — упор на жир/гликоген, не воду');
    if (bodyweightKg > 110) notes.push('Heavy >110кг: вода cap 5л, Na ≤5г');
  } else if (ph === 'fight_week') {
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 1) : Math.round(bodyweightKg * 2);
    if (isSameDay) {
      // same-day: не режем так жёстко
      carbs = Math.max(carbs, Math.round(bodyweightKg * 3));
      notes.push('Same-day 1-2ч: угли не ниже 3г/кг — нет времени на рефид');
    }
    water = protocol.waterMode === 'load_cut' ? (isSameDay ? Math.round(bodyweightKg * 25) : 2000) : Math.round(bodyweightKg * 20);
    if (bodyweightKg > 110 && water > 3500) water = 3500;
    sodium = protocol.sodiumMode === 'moderate_cut' ? 1500 : 2500;
    if (bodyweightKg > 110) sodium = Math.min(sodium, 3500);
    notes.push(`Fight week: вода ${water}мл + Na ${sodium}мг + угли ${carbs}г (клетчатка ${fiber}г) → взвешивание → рефид 8г/кг + вода 150% + Na 1г/кг за 12-24ч`);
    if (!isSameDay) notes.push(`ORS ${protocol.orsSodiumMmolPerDl ?? 65} mmol/дл 1-1.5л/ч сразу после, угли ≤60г/ч, волокно <10г`);
    if (protocol.heatSessions) notes.push('Сауна 15-20′×3 + sweat suit — компенсация ↓ объёма зала (≤4% BM/24ч по ISSN)');
    if (bodyweightKg > 110) notes.push('Heavy >110кг: вода/Na скорректированы под массу');
  } else {
    // camp — дефицит -15-20% TDEE, но ккал считаем вне (нужен TDEE), здесь только макро-ориентир
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 4) : Math.round(bodyweightKg * 5);
    water = Math.round(bodyweightKg * 35);
    if (bodyweightKg > 110 && water > 4500) water = 4500;
    sodium = 5000;
    if (bodyweightKg > 110) notes.push('Heavy >110кг: вода cap 4.5л');
  }
  // жиры: female ≥0.8г/кг (мин 40г RED-S), male ≥0.6 (мин 30г) — как bb-contest-prep + recovery-budget
  const fatPerKg = sex === 'female' ? 0.8 : 0.6;
  let fat = Math.round(bodyweightKg * fatPerKg);
  if (sex === 'female' && fat < 40) fat = 40;
  if (sex !== 'female' && fat < 30) fat = 30;
  let kcal = protein * 4 + carbs * 4 + fat * 9;
  // RED-S floor: female 1400, male 1500 — если ниже, поднимаем угли
  const floor = sex === 'female' ? 1400 : 1500;
  if (sex && kcal < floor) {
    const neededCarbs = Math.ceil((floor - protein * 4 - fat * 9) / 4);
    if (neededCarbs > carbs) {
      notes.push(`Ккал ${kcal} < floor ${floor} (RED-S) — угли подняты с ${carbs}г до ${neededCarbs}г`);
      carbs = neededCarbs;
      kcal = floor;
    }
  }
  if (ph === 'fight_week' && protocol.weighInType === 'same_day_2h') {
    notes.push('Same-day: острая потеря воды ≤2% BM — основа: жир + регуляция lean mass');
  }
  return { kcal, proteinG: protein, carbsG: carbs, waterMl: water, sodiumMg: sodium, fiberG: fiber, orsMmol: protocol.orsSodiumMmolPerDl ?? 65, notes };
}

export function weightCutRehydrationNotes(lossKg: number): string[] {
  return [
    `Регидрейшн после взвешивания: 125-150% от потерянного (${(lossKg * 1.25).toFixed(1)}-${(lossKg * 1.5).toFixed(1)}л) за 12-24ч`,
    'ORS 50-90 mmol/дл Na 1-1.5л/ч первые 1-2ч → затем быстрые угли ≤60г/ч (низко-осмоляр)',
    'Натрий 1г/л + углеводы 8-12г/кг (сильная деплитация) / 4-7г/кг (умеренная) за 24ч, белок 0.4г/кг каждые 3-4ч, жиры исключить 6ч',
    'Контроль: вес каждые 60мин, моча светло-жёлтая, не переливать >1л/ч — риск гипонатриемии',
  ];
}

export function validateWeightCutProtocol(p: WeightCutProtocol, opts?: { bodyweightKg?: number; sex?: 'male'|'female'; discipline?: string }): string[] {
  const errs: string[] = [];
  if (p.targetLossKg > 8) errs.push('Сгонка >8кг — высокий риск, требуется врач');
  if (p.targetLossKg / p.weeksOut > 1.5) errs.push(`Темп ${(p.targetLossKg / p.weeksOut).toFixed(1)}кг/нед >1.5 — агрессивно, риск срыва`);
  if (p.targetLossKg > 5 && p.weeksOut < 8) errs.push('При сгонке >5кг нужно ≥8 нед');
  // ISSN: острая потеря воды ≤4% BM /24ч
  if (p.startWeightKg && p.targetLossKg / p.startWeightKg > 0.04 && p.weeksOut <= 1) errs.push(`Острая потеря ${(p.targetLossKg/p.startWeightKg*100).toFixed(1)}% BM за 1нед >4% — ISSN лимит 2-4% /24ч`);
  // female cap 5%
  if (opts?.sex === 'female' && p.startWeightKg && p.targetLossKg / p.startWeightKg > 0.05) errs.push(`Женщины: сгонка ${(p.targetLossKg/p.startWeightKg*100).toFixed(1)}% >5% — ISSN консервативно, учтите цикл`);
  // same-day window
  if (p.weighInType === 'same_day_2h' && p.targetLossKg > 3) errs.push('Same-day 1-2ч: сгонка >3кг — нет времени на регидратацию, опирайтесь на жир/lean mass');
  if (p.weighInType === 'same_day_2h' && p.waterMode === 'load_cut') errs.push('Same-day: water load_cut не рекомендуется — window 1-2ч недостаточен');
  // fiber
  if ((p.fiberGPerDay ?? 28) > 15 && p.targetLossKg >= 4) errs.push('Fight week клетчатка >15г — ISSN <10г/день ×4д для 1-2% BM');
  // ORS
  if (p.orsSodiumMmolPerDl != null && (p.orsSodiumMmolPerDl < 30 || p.orsSodiumMmolPerDl > 100)) errs.push(`ORS Na ${p.orsSodiumMmolPerDl} вне 50-90 (ISSN) — скорректируйте`);
  // heat
  if (p.heatSessions && p.targetLossKg > 6) errs.push('Heat sessions + сгонка >6кг — только под наблюдением врача, не соло-сауна');
  if (!p.confirmedManipulation && (p.waterMode === 'load_cut' || p.carbMode === 'deplete_reload') && p.targetLossKg > 5) errs.push('Экстремальный протокол (load_cut/deplete) требует подтверждения — чекбокс "Подтверждаю манипуляции"');
  return errs;
}

export function weightCutSafetyBanner(p: WeightCutProtocol | null, bodyweightKg?: number, sex?: 'male'|'female'): string | null {
  if (!p) return null;
  const errs = validateWeightCutProtocol(p, { bodyweightKg, sex, discipline: undefined });
  if (errs.some(e => e.includes('врач') || e.includes('Same-day') || e.includes('подтвержд'))) return `⚠️ Требуется врач: ${errs[0]}`;
  if (errs.length) return `⚠️ ${errs[0]}`;
  return null;
}

/** Интеграция с планировщиком питания: весогонка → MealPlanInput (как bb-contest-prep prepToMealPlanInput). */
export function combatWeightCutToMealInput(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocol | null,
  bodyweightKg: number,
  sex?: 'male' | 'female'
): { kcal: number; protein: number; fat: number; carbs: number; waterMl: number; sodiumMg: number; fiberMaxG: number; weighInType?: WeighInType; orsMmol?: number } | null {
  const nut = weightCutNutritionForWeek(week, totalWeeks, protocol, bodyweightKg, sex);
  if (nut.kcal == null || nut.proteinG == null) return null;
  const fat = Math.round(bodyweightKg * (sex === 'female' ? 0.8 : 0.6));
  const fiberMaxG = weightCutFiberForWeek(week, totalWeeks, protocol);
  return { kcal: nut.kcal!, protein: nut.proteinG!, fat: fat < 30 ? 30 : fat, carbs: nut.carbsG!, waterMl: nut.waterMl!, sodiumMg: nut.sodiumMg!, fiberMaxG, weighInType: protocol?.weighInType, orsMmol: nut.orsMmol ?? 65 };
}
