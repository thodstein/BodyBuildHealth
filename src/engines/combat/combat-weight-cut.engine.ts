/**
 * combat-weight-cut.engine.ts — весогонка ISSN 2025 (full).
 * Источники: ISSN 2025 Fight Camp 8-10нед, тапер 1-2нед -40% vol + heat + water/sodium/carb манипуляции,
 * Barley et al. Sports 2019 weight-cut prevalence, rehydration 125-150%.
 * Изолировано.
 */
export type WaterMode = 'stable' | 'load_cut'; // load 8-10л → 2л fight week
export type SodiumMode = 'stable' | 'moderate_cut'; // 5г→3г→1.5г
export type CarbMode = 'stable' | 'deplete_reload'; // 4г/кг →1г/кг 3д →8г/кг 2д

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
  notes?: string[];
}

export function buildWeightCutProtocol(
  lossKg: number,
  opts?: Partial<WeightCutProtocol> & { startWeightKg?: number }
): WeightCutProtocol | null {
  if (!lossKg || lossKg <= 0) return null;
  const w = Math.max(2, Math.min(12, Math.round(lossKg > 6 ? 10 : lossKg > 3 ? 8 : 6)));
  return {
    targetLossKg: lossKg,
    weeksOut: opts?.weeksOut ?? w,
    startWeightKg: opts?.startWeightKg,
    targetWeightKg: opts?.startWeightKg ? opts.startWeightKg - lossKg : undefined,
    waterMode: opts?.waterMode ?? (lossKg >= 4 ? 'load_cut' : 'stable'),
    sodiumMode: opts?.sodiumMode ?? (lossKg >= 3 ? 'moderate_cut' : 'stable'),
    carbMode: opts?.carbMode ?? (lossKg >= 5 ? 'deplete_reload' : 'stable'),
    heatSessions: opts?.heatSessions ?? lossKg >= 3,
    dailyStepsTarget: opts?.dailyStepsTarget,
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

export function weightCutNutritionForWeek(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocol | null,
  bodyweightKg?: number,
  sex?: 'male' | 'female'
): { kcal: number | null; proteinG: number | null; carbsG: number | null; waterMl: number | null; sodiumMg: number | null; notes: string[] } {
  if (!protocol || bodyweightKg == null || bodyweightKg <= 30) return { kcal: null, proteinG: null, carbsG: null, waterMl: null, sodiumMg: null, notes: [] };
  const ph = weightCutPhaseForWeek(week, totalWeeks, protocol);
  const notes: string[] = [];
  // белок 2.2г/кг camp, 2.3г/кг taper (защита мышц), female — 2.3 г/кг минимум
  const proteinPerKg = ph === 'taper' || ph === 'fight_week' ? 2.3 : 2.2;
  const protein = Math.round(bodyweightKg * proteinPerKg);
  let carbs = Math.round(bodyweightKg * 4); // camp
  let water = Math.round(bodyweightKg * 35); // 35мл/кг
  let sodium = 5000;
  if (ph === 'taper') {
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 1) : Math.round(bodyweightKg * 3);
    water = protocol.waterMode === 'load_cut' ? Math.min(8000, Math.round(bodyweightKg * 100)) : Math.round(bodyweightKg * 30);
    sodium = protocol.sodiumMode === 'moderate_cut' ? 3000 : 4000;
    notes.push('Тапер: углеводы ↓, вода ↑ (load) перед сливом');
  } else if (ph === 'fight_week') {
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 1) : Math.round(bodyweightKg * 2);
    water = protocol.waterMode === 'load_cut' ? 2000 : Math.round(bodyweightKg * 20);
    sodium = protocol.sodiumMode === 'moderate_cut' ? 1500 : 2500;
    notes.push('Fight week: вода 2л + натрий 1.5г + углеводы 1г/кг (деплитация) → взвешивание → рефид 8г/кг + вода 150% + Na 1г/кг за 12-24ч');
    if (protocol.heatSessions) notes.push('Сауна 15-20′×3 + sweat suit — компенсация ↓ объёма зала');
  } else {
    // camp — дефицит -15-20% TDEE, но ккал считаем вне (нужен TDEE), здесь только макро-ориентир
    carbs = protocol.carbMode === 'deplete_reload' ? Math.round(bodyweightKg * 4) : Math.round(bodyweightKg * 5);
    water = Math.round(bodyweightKg * 35);
    sodium = 5000;
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
  return { kcal, proteinG: protein, carbsG: carbs, waterMl: water, sodiumMg: sodium, notes };
}

export function weightCutRehydrationNotes(lossKg: number): string[] {
  return [
    `Регидрейшн после взвешивания: 125-150% от потерянного (${(lossKg * 1.25).toFixed(1)}-${(lossKg * 1.5).toFixed(1)}л) за 12-24ч`,
    'Натрий 1г/кг + углеводы 8г/кг в первые 12ч, контроль ЖКТ (не переливать >1л/ч)',
    'Электролиты: Na 1г, K 0.5г, Mg 400мг, вода по жажде + моча светло-жёлтая',
  ];
}

export function validateWeightCutProtocol(p: WeightCutProtocol): string[] {
  const errs: string[] = [];
  if (p.targetLossKg > 8) errs.push('Сгонка >8кг — высокий риск, требуется врач');
  if (p.targetLossKg / p.weeksOut > 1.5) errs.push(`Темп ${(p.targetLossKg / p.weeksOut).toFixed(1)}кг/нед >1.5 — агрессивно, риск срыва`);
  if (p.targetLossKg > 5 && p.weeksOut < 8) errs.push('При сгонке >5кг нужно ≥8 нед');
  return errs;
}
