/**
 * tonnage-prilepin.engine.ts — тоннаж PRO: таблица Прилепина + INOL.
 *
 * Канон: Prilepin 1974 (4 зоны %1RM: <70→24 / 70–80→18 / 80–90→15 / 90+→7,
 * диапазоны 18–30/12–24/10–20/4–10) + Hristov INOL (reps/(100−intensity),
 * оптимум 0.8/упражнение, 0.2/сет; день 2.4, неделя 7.2) + StratFit-уточнение
 * (минуенд 100 точен ≥90%, ниже — приближение; для аксессуаров — ориентир, не гейт)
 * + PoinT GO: становая −20…−30% к оптимуму (нейро-спинальная цена).
 *
 * Заменяет crude-формулу `КПШ = tonnage × intensity` и зоны `<60/60-80/>80%`.
 */

import { velocityForPct, mvtForLift, type VBTLift } from './pro/vbt.engine';

export interface PrilepinZone {
  id: 'tech' | 'hypertrophy' | 'strength' | 'max';
  label: string;
  minPct: number; // включительно
  maxPct: number; // исключительно (100 для последней)
  repsPerSet: [number, number];
  optimalTotal: number;
  rangeTotal: [number, number];
  focus: string;
}

/** Таблица Прилепина 1974 (оригинал; для ПЛ/гипертрофии применяется как есть, становая — со скидкой). */
export const PRILEPIN_TABLE: PrilepinZone[] = [
  { id: 'tech', label: 'Техника · ОФП (<70%)', minPct: 0, maxPct: 70, repsPerSet: [3, 6], optimalTotal: 24, rangeTotal: [18, 30], focus: 'Техника · объём · GPP' },
  { id: 'hypertrophy', label: 'Гипертрофия · сил-объём (70–80%)', minPct: 70, maxPct: 80, repsPerSet: [3, 6], optimalTotal: 18, rangeTotal: [12, 24], focus: 'Гипертрофия · силовой объём' },
  { id: 'strength', label: 'Сила · нейроадаптация (80–90%)', minPct: 80, maxPct: 90, repsPerSet: [2, 4], optimalTotal: 15, rangeTotal: [10, 20], focus: 'Сила · мощность' },
  { id: 'max', label: 'Макс · подводка (90%+)', minPct: 90, maxPct: 101, repsPerSet: [1, 2], optimalTotal: 7, rangeTotal: [4, 10], focus: 'Макс сила · пик' },
];

export function prilepinZoneFor(intensityPct: number): PrilepinZone {
  const p = Math.max(0, Math.min(100, intensityPct));
  for (const z of PRILEPIN_TABLE) {
    if (p >= z.minPct && p < z.maxPct) return z;
  }
  return PRILEPIN_TABLE[PRILEPIN_TABLE.length - 1];
}

/** INOL сета/упражнения: reps / (100 − intensity). Intensity в % (0–100, кламп 99). */
export function inolForReps(reps: number, intensityPct: number): number {
  const i = Math.max(0, Math.min(99, intensityPct));
  if (reps <= 0) return 0;
  return reps / (100 - i);
}

/** INOL сета: sets × reps / (100 − intensity). */
export function inolForSet(sets: number, reps: number, intensityPct: number): number {
  return sets * inolForReps(reps, intensityPct);
}

// Оптимумы Hristov/StratFit
export const INOL_OPT_SET = 0.2;
export const INOL_OPT_EXERCISE = 0.8;
export const INOL_OPT_DAY = 2.4;
export const INOL_OPT_WEEK_SINGLE = 1.6;
export const INOL_OPT_WEEK_ALL = 7.2;

export interface InolScopeVerdict {
  kind: 'below' | 'optimal' | 'high' | 'over';
  ratio: number;
  message: string;
}

/**
 * Вердикт суммарного INOL дня/недели (Hristov: день 2.4, неделя-все 7.2).
 * Шкала по доле от оптимума: <0.5 недобор, 0.5–1.5 оптимум, 1.5–2.5 высоко, >2.5 перебор.
 */
export function inolScopeVerdict(
  totalInol: number,
  scope: 'day' | 'week',
  label?: string,
): InolScopeVerdict {
  const opt = scope === 'day' ? INOL_OPT_DAY : INOL_OPT_WEEK_ALL;
  const ratio = opt > 0 ? totalInol / opt : 0;
  const name = label || (scope === 'day' ? 'День' : 'Неделя');
  if (ratio < 0.5) return { kind: 'below', ratio, message: `${name}: INOL ${totalInol.toFixed(2)} (${(ratio * 100).toFixed(0)}% от оптимума ${opt}) — недобор` };
  if (ratio <= 1.5) return { kind: 'optimal', ratio, message: `${name}: INOL ${totalInol.toFixed(2)} — оптимум (${opt})` };
  if (ratio <= 2.5) return { kind: 'high', ratio, message: `${name}: INOL ${totalInol.toFixed(2)} — высоко, следите за скоростью/техникой` };
  return { kind: 'over', ratio, message: `${name}: INOL ${totalInol.toFixed(2)} — перебор, резать объём` };
}

/** Скидка становой к оптимуму (PoinT GO: −20…−30% из-за спинальной/нейро-цены). */
export const DEADLIFT_OPT_FACTOR = 0.75;

const DEADLIFT_RE = /станов|deadlift|сумо|sumo/i;

export function isDeadliftLike(name: string): boolean {
  return DEADLIFT_RE.test(name || '');
}

const BW_RE = /подтяг|pull.?up|брус|dips|отжим/i;

export function isBodyweightLike(name: string): boolean {
  return BW_RE.test(name || '');
}

/** Нагрузка с весом тела: external + 0.65×BW (подтягивания/брусья/отжимания). */
export function bodyweightLoad(externalKg: number, bodyweightKg: number): number {
  return Math.max(0, externalKg) + 0.65 * Math.max(0, bodyweightKg);
}

// Pattern-множители тоннажа (GymCreek): сравнение лифтов без «все репы стоят одинаково».
export const PATTERN_MULT: Record<string, number> = {
  barbell: 1.0,
  secondary: 0.85,
  isolation: 0.65,
  olympic: 0.75,
};

export function patternOf(name: string, type?: string): keyof typeof PATTERN_MULT {
  const n = (name || '').toLowerCase();
  if (/рывок|толчок|snatch|clean|jerk|олимп/i.test(n)) return 'olympic';
  if (type === 'isolation' || /разгибан|сгибан|curl|raise|fly|мах|развод|pushdown|скручив/i.test(n)) return 'isolation';
  if (/фронт|front|узк|close|наклон|incline|пауз/i.test(n)) return 'secondary';
  return 'barbell';
}

export type InolVerdictKind = 'below' | 'optimal' | 'high' | 'over';

// ── Ж1: VBT-линк (reuse pro/vbt.engine, без дубля LVP-таблиц) ───
export interface VbtLiftMatch {
  lift: VBTLift;
  /** true — ближайший профиль (не канон): инклайн→bench, пулдаун→row, сумо→deadlift. */
  isEstimate: boolean;
}

/**
 * Маппинг упражнения на VBT-профиль. Канон (Gonzalez-Badillo): присед/жим/становая/ОHP/тяга.
 * Изоляции (curl/raise/fly) — null (VBT-метрика там невалидна, честно молчим).
 */
export function vbtLiftForExercise(name: string): VbtLiftMatch | null {
  const n = (name || '').toLowerCase();
  if (/фронт|front/i.test(n)) return { lift: 'squat', isEstimate: true };
  if (/присед|squat|жим.*ног|leg.?press|гакк|hack/i.test(n)) return { lift: 'squat', isEstimate: /жим.*ног|leg.?press|гакк|hack/i.test(n) };
  if (/сумо|sumo/i.test(n)) return { lift: 'deadlift', isEstimate: true };
  if (/станов|deadlift|румын|rdl|тяга.*(стан|мертв)/i.test(n)) return { lift: 'deadlift', isEstimate: /румын|rdl/i.test(n) };
  if (/наклон|incline/i.test(n) && /жим|bench|press/i.test(n)) return { lift: 'bench', isEstimate: true };
  if (/жим.*(леж|лёж)|bench|груд/i.test(n)) return { lift: 'bench', isEstimate: false };
  if (/брус|dips|отжим/i.test(n)) return { lift: 'bench', isEstimate: true };
  if (/армей|воен|overhead|ohp|стоя.*жим|сидя.*жим.*плеч|плеч.*жим/i.test(n)) return { lift: 'ohp', isEstimate: false };
  if (/подтяг|pull.?up|пуллдаун|pulldown|верх.*блок/i.test(n)) return { lift: 'row', isEstimate: true };
  if (/тяга|row|подтягивани/i.test(n)) return { lift: 'row', isEstimate: false };
  return null;
}

export interface EstimatedMpv {
  velocity: number; // м/с, средняя концентрическая (оценка LVP, НЕ замер!)
  lift: VBTLift;
  isEstimate: boolean;
  mvt: number; // минимальная скорость порога (скорость 1ПМ)
}

/**
 * Оценочная скорость для %1RM по LVP-канону. Для владельцев VBT-датчиков —
 * точка сравнения «ожидалось vs замерено»; без датчика — ориентир темпа.
 */
export function estimatedMpv(name: string, intensityPct: number): EstimatedMpv | null {
  const m = vbtLiftForExercise(name);
  if (!m) return null;
  if (!(intensityPct > 0)) return null;
  // velocityForPct берёт долю 0–1, у нас проценты 0–100
  const frac = Math.max(0.3, Math.min(1, intensityPct / 100));
  return { velocity: velocityForPct(m.lift, frac), lift: m.lift, isEstimate: m.isEstimate, mvt: mvtForLift(m.lift) };
}

export interface InolVerdict {
  kind: InolVerdictKind;
  message: string;
}

/**
 * Вердикт INOL упражнения за сессию.
 * Шкала Hristov (single exercise/day): <0.4 недобор, 0.4–1.2 оптимум, 1.2–2.0 высоко, >2.0 перебор.
 * Становая: оптимум ×0.75. Аксессуары (isolation): только info-ориентир, не critical.
 */
export function verdictForInol(
  inol: number,
  opts?: { isDeadlift?: boolean; isAccessory?: boolean; label?: string },
): InolVerdict {
  const label = opts?.label || 'Упражнение';
  const lo = 0.4 * (opts?.isDeadlift ? DEADLIFT_OPT_FACTOR : 1);
  const hi = 1.2 * (opts?.isDeadlift ? DEADLIFT_OPT_FACTOR : 1);
  const max = 2.0 * (opts?.isDeadlift ? DEADLIFT_OPT_FACTOR : 1);
  if (inol < lo) {
    return { kind: 'below', message: `${label}: INOL ${inol.toFixed(2)} < ${lo.toFixed(2)} — недобор объёма в зоне` };
  }
  if (inol <= hi) {
    return { kind: 'optimal', message: `${label}: INOL ${inol.toFixed(2)} — оптимум Прилепина` };
  }
  if (inol <= max) {
    if (opts?.isAccessory) {
      return { kind: 'high', message: `${label}: INOL ${inol.toFixed(2)} выше оптимума — для аксессуара ориентир, следите за восстановлением` };
    }
    return { kind: 'high', message: `${label}: INOL ${inol.toFixed(2)} > ${hi.toFixed(2)} — высоко, скорость/техника пострадают` };
  }
  if (opts?.isAccessory) {
    return { kind: 'over', message: `${label}: INOL ${inol.toFixed(2)} — много для аксессуара (ориентир, не гейт)` };
  }
  return { kind: 'over', message: `${label}: INOL ${inol.toFixed(2)} > ${max.toFixed(2)} — перебор, резать объём` };
}

export interface TonnageRowInput {
  exerciseId: string;
  name: string;
  type?: string;
  weight: number; // внешний вес (без тела)
  reps: number;
  sets: number;
  oneRM: number; // 1RM упражнения (0 = неизвестен)
  bodyweightKg?: number;
}

export interface TonnageRowResult {
  loadPerRep: number;
  tonnage: number;
  totalReps: number;
  intensityPct: number | null;
  zone: PrilepinZone | null;
  inol: number | null;
  pattern: keyof typeof PATTERN_MULT;
  patternTonnage: number;
  verdict: InolVerdict | null;
}

/** Полный расчёт строки: нагрузка (с телом) → тоннаж → %1RM → зона Прилепина → INOL → вердикт. */
export function tonnageRowResult(r: TonnageRowInput): TonnageRowResult {
  const bw = isBodyweightLike(r.name);
  const loadPerRep = bw ? bodyweightLoad(r.weight, r.bodyweightKg || 0) : Math.max(0, r.weight);
  const tonnage = loadPerRep * Math.max(0, r.reps) * Math.max(0, r.sets);
  const totalReps = Math.max(0, r.reps) * Math.max(0, r.sets);
  const intensityPct = r.oneRM > 0 ? (loadPerRep / r.oneRM) * 100 : null;
  const zone = intensityPct !== null ? prilepinZoneFor(intensityPct) : null;
  const inol = intensityPct !== null ? inolForSet(r.sets, r.reps, intensityPct) : null;
  const pattern = patternOf(r.name, r.type);
  const patternTonnage = tonnage * PATTERN_MULT[pattern];
  const verdict = inol !== null
    ? verdictForInol(inol, { isDeadlift: isDeadliftLike(r.name), isAccessory: pattern === 'isolation', label: r.name })
    : null;
  return { loadPerRep, tonnage, totalReps, intensityPct, zone, inol, pattern, patternTonnage, verdict };
}
