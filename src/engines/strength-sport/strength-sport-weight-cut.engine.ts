/**
 * strength-sport-weight-cut.engine.ts — лайт-весогонка для ТА/стронга (порт ISSN 2025).
 * Для ТА угли не режем до 1г/кг так жёстко — 2г/кг минимум для ЦНС/техники.
 * Объём зала: fight week ×0.70, taper ×0.85, camp ×1.0.
 */
export type WaterMode = 'stable' | 'load_cut';
export type SodiumMode = 'stable' | 'moderate_cut';
export type CarbMode = 'stable' | 'moderate_cut';

export interface WeightCutProtocolSS {
  targetLossKg: number;
  weeksOut: number;
  startWeightKg?: number;
  targetWeightKg?: number;
  waterMode: WaterMode;
  sodiumMode: SodiumMode;
  carbMode: CarbMode;
  heatSessions?: boolean;
  notes?: string[];
}

export function buildWeightCutProtocolSS(
  lossKg: number,
  opts?: Partial<WeightCutProtocolSS> & { startWeightKg?: number },
): WeightCutProtocolSS | null {
  if (!lossKg || lossKg <= 0) return null;
  const w = Math.max(2, Math.min(12, Math.round(lossKg > 6 ? 10 : lossKg > 3 ? 8 : 6)));
  return {
    targetLossKg: lossKg,
    weeksOut: opts?.weeksOut ?? w,
    startWeightKg: opts?.startWeightKg,
    targetWeightKg: opts?.startWeightKg ? opts.startWeightKg - lossKg : undefined,
    waterMode: opts?.waterMode ?? (lossKg >= 4 ? 'load_cut' : 'stable'),
    sodiumMode: opts?.sodiumMode ?? (lossKg >= 3 ? 'moderate_cut' : 'stable'),
    carbMode: opts?.carbMode ?? (lossKg >= 5 ? 'moderate_cut' : 'stable'),
    heatSessions: opts?.heatSessions ?? lossKg >= 3,
    notes: opts?.notes,
  };
}

export function weightCutPhaseForWeekSS(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocolSS | null,
): 'camp' | 'taper' | 'fight_week' | null {
  if (!protocol) return null;
  if (week === totalWeeks) return 'fight_week';
  if (week >= totalWeeks - 1) return 'taper';
  return 'camp';
}

export function weightCutVolumeMultiplierSS(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocolSS | null,
): number {
  if (!protocol) return 1;
  const ph = weightCutPhaseForWeekSS(week, totalWeeks, protocol);
  if (ph === 'fight_week') return 0.70;
  if (ph === 'taper') return 0.85;
  if (protocol.targetLossKg >= 5) return 0.70;
  if (protocol.targetLossKg >= 3) return 0.75;
  return 1;
}

export function weightCutNutritionForWeekSS(
  week: number,
  totalWeeks: number,
  protocol: WeightCutProtocolSS | null,
  bodyweightKg?: number,
): { kcal: number | null; proteinG: number | null; carbsG: number | null; waterMl: number | null; sodiumMg: number | null; notes: string[] } {
  if (!protocol || bodyweightKg == null || bodyweightKg <= 30) return { kcal: null, proteinG: null, carbsG: null, waterMl: null, sodiumMg: null, notes: [] };
  const ph = weightCutPhaseForWeekSS(week, totalWeeks, protocol);
  const notes: string[] = [];
  const protein = Math.round(bodyweightKg * (ph === 'taper' || ph === 'fight_week' ? 2.3 : 2.2));
  let carbs = Math.round(bodyweightKg * 4);
  let water = Math.round(bodyweightKg * 35);
  let sodium = 5000;
  if (ph === 'taper') {
    carbs = protocol.carbMode === 'moderate_cut' ? Math.round(bodyweightKg * 2.5) : Math.round(bodyweightKg * 4);
    water = protocol.waterMode === 'load_cut' ? 7000 : Math.round(bodyweightKg * 30);
    sodium = protocol.sodiumMode === 'moderate_cut' ? 3000 : 4000;
    notes.push('Тапер: угли умеренно ↓, вода load перед сливом (для ТА мягче чем у единоборств)');
  } else if (ph === 'fight_week') {
    carbs = protocol.carbMode === 'moderate_cut' ? Math.round(bodyweightKg * 2) : Math.round(bodyweightKg * 3);
    water = protocol.waterMode === 'load_cut' ? 2000 : Math.round(bodyweightKg * 22);
    sodium = protocol.sodiumMode === 'moderate_cut' ? 2000 : 3000;
    notes.push('Fight week: вода 2л + Na 2г + угли ≥2г/кг (сохраняем ЦНС для техники) → взвешивание → рефид 4-5г/кг + 125% воды');
    if (protocol.heatSessions) notes.push('Сауна 12-15′×2 — только при сгонке ≥3кг');
  } else {
    carbs = Math.round(bodyweightKg * 5);
    water = Math.round(bodyweightKg * 35);
    sodium = 5000;
  }
  const fat = Math.round(bodyweightKg * 0.9);
  const kcal = protein * 4 + carbs * 4 + fat * 9;
  return { kcal, proteinG: protein, carbsG: carbs, waterMl: water, sodiumMg: sodium, notes };
}

export function weightCutRehydrationNotesSS(lossKg: number): string[] {
  return [
    `Регидрейшн: 125% от сгонки (${(lossKg * 1.25).toFixed(1)}л) за 12ч — ТА требует меньше чем у единоборств`,
    'Натрий 0.8г/кг + угли 4-5г/кг в первые 12ч, без перелива >0.8л/ч',
  ];
}

export function validateWeightCutProtocolSS(p: WeightCutProtocolSS): string[] {
  const errs: string[] = [];
  if (p.targetLossKg > 8) errs.push('Сгонка >8кг — риск, требуется врач');
  if (p.targetLossKg / p.weeksOut > 1.2) errs.push(`Темп ${(p.targetLossKg / p.weeksOut).toFixed(1)}кг/нед >1.2 — агрессивно для ТА`);
  if (p.targetLossKg > 5 && p.weeksOut < 8) errs.push('При сгонке >5кг нужно ≥8 нед');
  return errs;
}
