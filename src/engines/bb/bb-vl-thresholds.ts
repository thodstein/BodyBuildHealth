/**
 * bb-vl-thresholds.ts — индивидуальные пороги velocity loss по мышцам.
 *
 * Исследования показывают, что оптимальный порог потери скорости варьируется
 * между мышцами и людьми (PMC8762534: VL≤25% для силы, >20-25% для гипертрофии).
 *
 * Этот модуль позволяет:
 * 1. Хранить индивидуальные пороги для каждой мышцы
 * 2. Использовать пороги при расчёте объёма
 * 3. Обновлять пороги на основе данных из дневника
 */

/** Порог velocity loss для мышцы (в процентах) */
export interface VlThreshold {
  muscle: string;
  /** Порог для силы (обычно ниже, например 15-20%) */
  strengthVl: number;
  /** Порог для гипертрофии (обычно выше, например 25-30%) */
  hypertrophyVl: number;
  /** Достоверность порога (0-1) */
  confidence: number;
}

/** Дефолтные пороги (из литературы) */
const DEFAULT_VL_THRESHOLDS: Record<string, Omit<VlThreshold, 'muscle' | 'confidence'>> = {
  chest: { strengthVl: 0.20, hypertrophyVl: 0.25 },
  back: { strengthVl: 0.20, hypertrophyVl: 0.25 },
  quads: { strengthVl: 0.20, hypertrophyVl: 0.30 },
  hamstrings: { strengthVl: 0.20, hypertrophyVl: 0.30 },
  delts: { strengthVl: 0.20, hypertrophyVl: 0.25 },
  biceps: { strengthVl: 0.20, hypertrophyVl: 0.25 },
  triceps: { strengthVl: 0.20, hypertrophyVl: 0.25 },
  calves: { strengthVl: 0.20, hypertrophyVl: 0.30 },
};

/** Хранилище порогов */
const thresholds = new Map<string, VlThreshold>();

/** Получить порог для мышцы */
export function getVlThreshold(muscle: string): VlThreshold {
  return thresholds.get(muscle) ?? {
    muscle,
    ...DEFAULT_VL_THRESHOLDS[muscle] ?? { strengthVl: 0.20, hypertrophyVl: 0.25 },
    confidence: 0,
  };
}

/** Обновить порог для мышцы */
export function updateVlThreshold(
  muscle: string,
  strengthVl: number,
  hypertrophyVl: number,
): VlThreshold {
  const existing = thresholds.get(muscle);
  const confidence = existing
    ? Math.min(1, existing.confidence + 0.1)
    : 0.1;
  
  const updated: VlThreshold = {
    muscle,
    strengthVl: Math.max(0.10, Math.min(0.50, strengthVl)),
    hypertrophyVl: Math.max(0.15, Math.min(0.60, hypertrophyVl)),
    confidence,
  };
  
  thresholds.set(muscle, updated);
  return updated;
}

/** Проверить, допустима ли потеря скорости для данного качества */
export function isVlAcceptable(
  muscle: string,
  actualVl: number,
  quality: 'strength' | 'hypertrophy',
): boolean {
  const threshold = getVlThreshold(muscle);
  const limit = quality === 'strength' ? threshold.strengthVl : threshold.hypertrophyVl;
  return actualVl <= limit;
}

/** Получить все пороги */
export function getAllVlThresholds(): VlThreshold[] {
  return Array.from(thresholds.values());
}

/** Очистить все пороги (для тестов) */
export function clearVlThresholds(): void {
  thresholds.clear();
}
