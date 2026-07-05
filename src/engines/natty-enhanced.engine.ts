/**
 * natty-enhanced.engine.ts — Два режима периодизации: NATTY vs ENHANCED.
 *
 * Все параметры (объём, частота, интенсивность, RIR, длительность мезо)
 * зависят от допинг-статуса.
 */
export type StatusType = 'natty' | 'enhanced';

export interface NattyEnhancedParams {
  /** Оптимальная частота на группу в неделю */
  frequencyPerGroup: number;
  /** Рабочий объём на группу/нед (подходов) */
  workingSetsPerGroup: [number, number]; // min, max
  /** RIR в рабочих подходах */
  workingRIR: [number, number]; // min, max
  /** Длительность мезоцикла до делода */
  mesoWeeksBeforeDeload: [number, number]; // min, max
  /** Интенсивность (% 1ПМ) */
  intensityPct: [number, number];
  /** Прогрессия (% увеличения веса/нед) */
  progressionPct: number;
  /** MRV буст */
  mrvMultiplier: number;
  /** Восстановление между подходами (сек) */
  restSeconds: number;
  /** Максимум подходов к отказу за неделю */
  maxFailureSetsPerWeek: number;
}

export const NATTY_PARAMS: NattyEnhancedParams = {
  frequencyPerGroup: 2,
  workingSetsPerGroup: [8, 14],
  workingRIR: [1, 2],
  mesoWeeksBeforeDeload: [4, 5],
  intensityPct: [75, 90],
  progressionPct: 2.5,
  mrvMultiplier: 1.0,
  restSeconds: 90,
  maxFailureSetsPerWeek: 6,
};

export const ENHANCED_PARAMS: NattyEnhancedParams = {
  frequencyPerGroup: 1.5,
  workingSetsPerGroup: [14, 24],
  workingRIR: [2, 4],
  mesoWeeksBeforeDeload: [6, 8],
  intensityPct: [65, 85],
  progressionPct: 2.0,
  mrvMultiplier: 1.25,
  restSeconds: 120,
  maxFailureSetsPerWeek: 12,
};

export function getNattyEnhancedParams(status: StatusType, courseIntensity?: string): NattyEnhancedParams {
  const base = status === 'enhanced' ? { ...ENHANCED_PARAMS } : { ...NATTY_PARAMS };

  if (status === 'enhanced' && courseIntensity) {
    if (courseIntensity === 'heavy') {
      base.mrvMultiplier = 1.35;
      base.workingSetsPerGroup = [16, 28];
      base.maxFailureSetsPerWeek = 16;
    } else if (courseIntensity === 'mild') {
      base.mrvMultiplier = 1.15;
      base.workingSetsPerGroup = [12, 20];
    }
  }

  return base;
}

/** Применить параметры к настройкам тренировки */
export function applyNattyEnhancedToConfig(
  status: StatusType,
  courseIntensity: string | undefined,
  config: {
    volumeMod: number;
    rirBase: number;
    deloadFreq: number;
    progressionPct: number;
    maxMRV: number;
    frequency: number;
  }
): {
  volumeMod: number;
  rirBase: number;
  deloadFreq: number;
  progressionPct: number;
  maxMRV: number;
  frequency: number;
  rationale: string[];
} {
  const params = getNattyEnhancedParams(status, courseIntensity);
  const rationale: string[] = [];

  const newConfig = { ...config };

  // Объём
  const avgVol = (params.workingSetsPerGroup[0] + params.workingSetsPerGroup[1]) / 2;
  const defaultVol = 12; // средний NATTY
  const volRatio = avgVol / defaultVol;
  newConfig.volumeMod = Math.round(config.volumeMod * volRatio * 10) / 10;
  rationale.push(`Объём: ${status === 'enhanced' ? 'повышен' : 'стандартный'} (${params.workingSetsPerGroup[0]}-${params.workingSetsPerGroup[1]} подходов/группу)`);

  // RIR
  const avgRIR = (params.workingRIR[0] + params.workingRIR[1]) / 2;
  newConfig.rirBase = Math.round(avgRIR * 2) / 2;
  rationale.push(`RIR: ${params.workingRIR[0]}-${params.workingRIR[1]} (${status === 'enhanced' ? 'дальше от отказа, меньше ЦНС-усталость' : 'ближе к отказу'})`);

  // Частота делода
  const avgMesoWeeks = (params.mesoWeeksBeforeDeload[0] + params.mesoWeeksBeforeDeload[1]) / 2;
  newConfig.deloadFreq = Math.round(avgMesoWeeks);
  rationale.push(`Делоад каждые ${avgMesoWeeks} нед (${status === 'enhanced' ? 'реже — медленнее накопление усталости' : 'чаще — быстрое накопление усталости'})`);

  // Прогрессия
  newConfig.progressionPct = params.progressionPct;
  rationale.push(`Прогрессия: +${params.progressionPct}%/нед`);

  // MRV
  newConfig.maxMRV = Math.round(config.maxMRV * params.mrvMultiplier);
  rationale.push(`MRV: ×${params.mrvMultiplier} (${status === 'enhanced' ? 'повышен на курсе' : 'натуральный'})`);

  // Частота
  newConfig.frequency = Math.round(params.frequencyPerGroup);
  rationale.push(`Частота: ${params.frequencyPerGroup}×/нед на группу`);

  return { ...newConfig, rationale };
}
