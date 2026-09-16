/**
 * armlift-conditions.engine.ts — условия замера (PRO-6 M5).
 * Срыв на помосте — не всегда слабость: версия RT (V1/V2/V3 крутятся по-разному
 * на рекордах), некалиброванные диски, жидкий мел, чужой диаметр грифа, холодный
 * зал. Чек-лист режет ложные «слабости» до диагноза. Чистые функции.
 */

export type ArmliftRtVersion = 'v1' | 'v2' | 'v3' | 'unknown';

export interface ArmliftConditionsInput {
  implement?: string;
  /** Версия вращающейся ручки (только для rolling_thunder). */
  rtVersion?: ArmliftRtVersion;
  /** Диски не калиброваны / не взвешены. */
  uncalibratedPlates?: boolean;
  /** Жидкий мел вместо обычной магнезии (запрещён IronMind). */
  liquidChalk?: boolean;
  /** Холодный зал / холодный снаряд (руки не держат). */
  coldGym?: boolean;
  /** Диаметр грифа мм, если известен (RT канон 60.3). */
  barDiameterMm?: number | null;
}

export interface ArmliftConditionsResult {
  /** true → замер тренировочный, в %WR не спорим, слабость не ставим. */
  trainingOnly: boolean;
  notes: string[];
  conditionsNote: string;
}

const RT_CANON_MM = 60.3;

export function assessArmliftConditions(i: ArmliftConditionsInput): ArmliftConditionsResult {
  const notes: string[] = [];
  const impl = String(i.implement || 'rolling_thunder');

  if ((impl === 'rolling_thunder' || impl === '') && (i.rtVersion || 'unknown') !== 'v3') {
    const v = i.rtVersion || 'unknown';
    notes.push(
      v === 'unknown'
        ? 'Версия RT неизвестна — на рекордных весах вращение версий V1/V2 гуляет (замер тренировочный)'
        : `RT ${v.toUpperCase()} — на рекордах крутится иначе, чем V3 (замер тренировочный)`,
    );
  }
  if (i.uncalibratedPlates) {
    notes.push('Диски не калиброваны — вес спорный (AUSA: калиброванные или взвешенные)');
  }
  if (i.liquidChalk) {
    notes.push('Жидкий мел — запрещён IronMind, замер тренировочный');
  }
  if (i.coldGym) {
    notes.push('Холодный зал/снаряд — хват плывёт раньше силы');
  }
  const d = i.barDiameterMm;
  if (d != null && Number.isFinite(d) && d > 0 && Math.abs(d - RT_CANON_MM) > 2) {
    notes.push(`Диаметр ${d} мм ≠ канон RT ${RT_CANON_MM} мм — сравнивать %WR нельзя`);
  }
  if (!notes.length) {
    return { trainingOnly: false, notes: [], conditionsNote: 'Условия чистые — замер идёт в зачёт' };
  }
  return {
    trainingOnly: true,
    notes,
    conditionsNote: `Замер тренировочный: ${notes.join(' · ')}`,
  };
}
