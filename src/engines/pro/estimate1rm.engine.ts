/**
 * estimate1rm.engine.ts — P1: канонический модель оценки 1RM (проф. уровень).
 * UNIFY: собирает все формулы в один модуль (были разбросаны по 6 файлам).
 * Бэкворд-совместимо: существующий progression.estimate1RM (Epley≤10/Brzycki>10 blend)
 * не трогается — здесь новый более богатый API для проф-фич (P2..P12).
 *
 * Формулы: Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathen.
 + Консенсус (медиана применимых) + load-velocity e1RM (через LVP-таблицу, расширится в P2).
 */

export type RMFormula = 'epley' | 'brzycki' | 'lander' | 'lombardi' | 'mayhew' | 'oconner' | 'wathen';

export interface FormulaResult { formula: RMFormula; value: number; }

export interface Consensus1RM {
  value: number;        // медиана применимых формул (кг, округлено до 0.1)
  mean: number;
  min: number;
  max: number;
  spread: number;       // max - min
  n: number;            // число применимых формул
  formulas: FormulaResult[];
  repsClamped: number;  // фактические повт, использованные (зажим ≤15)
}

/** Применимость формул по диапазону повторений (на основе литературы). */
const APPLICABLE: Record<RMFormula, [number, number]> = {
  epley:   [1, 10],
  brzycki: [1, 12],
  lander:  [1, 10],
  lombardi:[1, 15],
  mayhew:  [1, 15],
  oconner: [1, 10],
  wathen:  [1, 12],
};

function round1(v: number): number { return Math.round(v * 10) / 10; }

/** Одна формула по имени. reps зажимается к [1, 15]. */
export function estimate1RMFormula(weight: number, reps: number, formula: RMFormula): number {
  if (weight <= 0) return 0;
  const r = Math.max(1, Math.min(15, reps));
  if (r <= 1) return weight;
  switch (formula) {
    case 'epley':    return weight * (1 + r / 30);
    case 'brzycki':  return weight * 36 / (37 - r);
    case 'lander':   return 100 * weight / (101.3 - 2.67123 * r);
    case 'lombardi': return weight * Math.pow(r, 0.10);
    case 'mayhew':   return 100 * weight / (52.2 + 41.9 * Math.exp(-0.055 * r));
    case 'oconner':  return weight * (1 + 0.025 * r);
    case 'wathen':   return 100 * weight / (48.8 + 53.8 * Math.exp(-0.075 * r));
  }
}

/** Консенсус e1RM: медиана всех применимых к диапазону повторений формул. */
export function estimate1RMConsensus(weight: number, reps: number): Consensus1RM {
  const rClamped = Math.max(1, Math.min(15, reps));
  if (weight <= 0) return { value: 0, mean: 0, min: 0, max: 0, spread: 0, n: 0, formulas: [], repsClamped: rClamped };
  if (rClamped <= 1) {
    const v = round1(weight);
    return { value: v, mean: v, min: v, max: v, spread: 0, n: 1, formulas: [{ formula: 'epley', value: v }], repsClamped: rClamped };
  }
  const formulas: FormulaResult[] = [];
  (Object.keys(APPLICABLE) as RMFormula[]).forEach(f => {
    const [lo, hi] = APPLICABLE[f];
    if (rClamped >= lo && rClamped <= hi) formulas.push({ formula: f, value: estimate1RMFormula(weight, rClamped, f) });
  });
  const vals = formulas.map(f => f.value).sort((a, b) => a - b);
  const n = vals.length;
  const median = n % 2 === 1 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  return {
    value: round1(median),
    mean: round1(mean),
    min: round1(vals[0]),
    max: round1(vals[n - 1]),
    spread: round1(vals[n - 1] - vals[0]),
    n,
    formulas: formulas.map(f => ({ formula: f.formula, value: round1(f.value) })),
    repsClamped: rClamped,
  };
}

/** Backward-compat-совместимая сигнатура: возвращает консенсус-значение (кг, 0.1). */
export function estimate1RM(weight: number, reps: number): number {
  return estimate1RMConsensus(weight, reps).value;
}

/** Метод сведения формул в одно число: медиана (устойчива к выбросам) или trimmed-mean (стандарт индустрии: отброс min/max → среднее). */
export type ConsensusMethod = 'median' | 'trimmed';

/** Trimmed-mean консенсус: отброс min/max → среднее остальных (как 1rmcalculator.org/HubFit). При n<3 — медиана. */
export function estimate1RMTrimmedMean(weight: number, reps: number): Consensus1RM {
  const base = estimate1RMConsensus(weight, reps);
  if (base.n < 3) return base;
  const vals = base.formulas.map(f => f.value).sort((a, b) => a - b).slice(1, -1);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return { ...base, value: round1(mean), mean: round1(mean) };
}

/** Сведение по выбранному методу (дефолт median — backward-compat). */
export function estimate1RMByMethod(weight: number, reps: number, method: ConsensusMethod = 'median'): Consensus1RM {
  return method === 'trimmed' ? estimate1RMTrimmedMean(weight, reps) : estimate1RMConsensus(weight, reps);
}

/**
 * P1 (StrengthAnalysisHub PRO): применимость формул по движению.
 * Литература (LeSuer 1997; Macarilla 2022): жим держит точность до ~12 повт, присед/тяга — до ~10,
 * тяга на 8+ повт грубее (усталость хвата/спины). Кап повторов для ОЦЕНКИ (движок estimate1RMFormula не тронут).
 */
export const LIFT_REPS_CAP: Record<string, number> = {
  squat: 10, bench: 12, deadlift: 10, ohp: 10, row: 12,
};

export function liftRepsCap(lift: string | null | undefined): number {
  if (!lift) return 12;
  return LIFT_REPS_CAP[lift] ?? 12;
}

/** Формулы, применимые для движения и повторов (пересечение APPLICABLE-диапазона и лифт-капа). */
export function applicableFormulasForLift(lift: string | null | undefined, reps: number): RMFormula[] {
  const cap = liftRepsCap(lift);
  const r = Math.max(1, Math.min(15, reps));
  if (r > cap) return [];
  return (Object.keys(APPLICABLE) as RMFormula[]).filter(f => {
    const [lo, hi] = APPLICABLE[f];
    return r >= lo && r <= Math.min(hi, cap);
  });
}

/**
 * Честная пометка точности для движения/повт (источник: 1rmcalculator.org comparison 2026:
 * Brzycki ±3% <10 повт, Epley ±5%, Lombardi ±4%, O'Conner ±6%, Mayhew ±4% до 15, Wathan ±3% тяжёлые, Lander ±5%).
 */
export function rmAccuracyNote(lift: string | null | undefined, reps: number): string {
  const r = Math.max(1, Math.min(15, reps));
  const cap = liftRepsCap(lift);
  if (r > cap) return `>${cap} повт для этого движения — оценка грубая (±8–12%), тестируйте 3–6 повт`;
  if (r >= 12) return '12+ повт: точнее Mayhew (±4%), остальные грубее — тестируйте 3–6 повт';
  if (lift === 'deadlift' && r >= 8) return 'тяга на 8+ повт: точность ниже (хват/спина) — ориентир ±5%';
  if (r <= 6) return 'оптимальный диапазон: Brzycki/Wathan ±3%';
  return 'рабочий диапазон: формулы сходятся, ±3–5%';
}

// ── Load-velocity profile (P2 расширит; здесь минимальная таблица для e1RM-по-скорости) ──
// Средняя скорость (м/с) на %1RM для соревновательных движений (Jovanovic / Gonzalez-Badillo).
const LVP: Record<string, readonly [number, number][]> = {
  squat: [[1.00, 0.30], [0.90, 0.47], [0.80, 0.60], [0.70, 0.75], [0.60, 0.87], [0.50, 1.00]],
  bench: [[1.00, 0.16], [0.90, 0.33], [0.80, 0.47], [0.70, 0.60], [0.60, 0.75], [0.50, 0.90]],
  deadlift: [[1.00, 0.20], [0.90, 0.37], [0.80, 0.50], [0.70, 0.62], [0.60, 0.77], [0.50, 0.92]],
};
const DEFAULT_LIFT = 'squat';

function interpPctForVelocity(lift: string, v: number): number {
  // LVP отсортирован по %1RM по убыванию (tbl[0] = тяжелейший/медленнейший).
  const tbl = LVP[lift] || LVP[DEFAULT_LIFT];
  if (v <= tbl[0][1]) return tbl[0][0];                         // медленнее медленнейшего → тяжелейший %
  if (v >= tbl[tbl.length - 1][1]) return tbl[tbl.length - 1][0]; // быстрее быстрейшего → легчайший %
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1]; // v1 < v2 (скорость растёт), p1 > p2 (% падает)
    if (v >= v1 && v <= v2) return p1 + (p2 - p1) * (v - v1) / (v2 - v1);
  }
  return 0.5;
}

/** Оценка %1RM и e1RM по скорости штанги (mean velocity, м/с) и поднятому весу. */
export function estimate1RMFromVelocity(lift: string, velocityMps: number, weight: number): { e1RM: number; pct1RM: number } {
  if (velocityMps <= 0 || weight <= 0) return { e1RM: 0, pct1RM: 0 };
  const pct = interpPctForVelocity(lift, velocityMps);
  if (pct <= 0) return { e1RM: 0, pct1RM: 0 };
  return { e1RM: round1(weight / pct), pct1RM: round1(pct * 100) / 100 };
}

/** Обратная функция: целевая скорость для %1RM (для VBT-таргетов, расширится в P2). */
export function velocityForPct(lift: string, pct1RM: number): number {
  const tbl = LVP[lift] || LVP[DEFAULT_LIFT];
  if (pct1RM >= tbl[0][0]) return tbl[0][1];
  if (pct1RM <= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1];
    if (pct1RM <= p1 && pct1RM >= p2) return v1 + (v2 - v1) * (pct1RM - p1) / (p2 - p1);
  }
  return 0.5;
}

export const SUPPORTED_LIFTS = Object.keys(LVP);
