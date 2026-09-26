/**
 * autoregulation-pro.engine.ts — P4: проф-авторегуляция (проф. уровень).
 * Склейка сигналов → суточная корректировка плана (REUSE P1/P2/P3 outputs):
 *   readiness + HRV + ACWR (P3) + velocity-loss (P2) + last-RPE → % топ-сета, объём-множитель, RIR-сдвиг, триггер deload.
 * + RPE→%1RM (через модель RIR: нагрузка для r повторов @RPE e = нагрузка для (r+RIR)-повторного максимума).
 * + per-exercise weight correction: adjustedWorkingWeight(e1RM, plannedWeight, autoRegOutput)
 * + sessionAutoRegulate: полный контекст → скорректированные веса для каждого упражнения сессии.
 */
function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function r3(v: number) { return Math.round(v * 1000) / 1000; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

import type { ACWRZone } from './training-load.engine';
export type { ACWRZone };

export interface AutoRegInput {
  readiness: number;            // 0-100
  acwr: { ratio: number; zone: ACWRZone };
  fatigue?: number;              // 0-100
  hrvRatio?: number;             // текущий RMSSD / baseline RMSSD (0.7=снижен, 1.0=норма, 1.2+=рост)
  sleepScore?: number;           // 0-100 качество сна
  lastSessionRPE?: number;       // 1-10
  lastVelocityLossPct?: number; // % потери скорости последнего сета
  plannedTopSetPct?: number;    // напр. 0.85
  plannedVolumeMult?: number;    // 1
  plannedRIR?: number;           // 0-4
  /** Цель блока: силовой порог VL строже (Pareja-Blanco: ≤25% — сила, выше — утомление без силы). */
  goal?: 'strength' | 'hypertrophy' | 'general';
  /** Суммарный сдвиг RIR из нескольких авторегуляционных источников. */
  combinedRirShift?: number;
}

/**
 * Прозрачность решения (P1-А, 26.09.2026).
 *
 * Источник: Schaffarczyk M., Sperlich B. Heart rate variability-guided endurance training: evaluating
 * strengths, weaknesses, opportunities, and threats for load prescription and adjustment.
 * Front Sports Act Living 2026;8:1858271 · PMID 42724227. Ключевое из abstract: узкое место —
 * «уже не в нехватке физиологических данных, а в ОТСУТСТВИИ прозрачных и физиологически
 * обоснованных фреймворков решений»; среди угроз — «rule-based decision frameworks, которые могут
 * неадекватно улавливать контекстную зависимость адаптации» и «растущая зависимость от
 * проприетарных метрик, чьи алгоритмы непрозрачны и могут чрезмерно упрощать решения».
 *
 * Что из этого следует для кода: пользователь должен видеть, из КАКИХ маркеров собрано решение,
 * что сделал каждый и СКОЛЬКО маркеров реально было. Раньше `decisions[]` давал текст, но не вес,
 * а все пропущенные маркеры подставлялись идеальными дефолтами (hrvRatio→1.0, fatigue→0,
 * sleepScore→0, RPE→0, VLoss→0) — то есть «маркера нет» выглядело как «маркер идеален».
 *
 * reliability — ОРИЕНТИР ПРОЗРАЧНОСТИ, а не валидированный порог: он показывает долю реально
 * присутствующих маркеров, чтобы решение по 2 из 7 не выглядело так же уверенно, как по 6 из 7.
 */
export type AutoRegReliability = 'low' | 'medium' | 'high';
export const AUTOREG_MARKERS_TOTAL = 7;
export const AUTOREG_RELIABILITY_NOTE =
  'Надёжность решения — доля реально переданных маркеров, а не «качество» алгоритма: '
  + 'правила авторегуляции не учитывают контекстную адаптацию (PMID 42724227). '
  + 'Маркер, которого нет, НЕ считается идеальным — он просто не участвует.';

export interface AutoRegFactor {
  key: 'acwr' | 'readiness' | 'hrv' | 'sleep' | 'fatigue' | 'lastRpe' | 'velocityLoss';
  label: string;
  provided: boolean;      // false → маркер не передан, взят нейтральный дефолт
  value: string;          // значение для показа (пусто, если не передан)
  effect: string;         // что сделал маркер
  volumeMult: number;     // применённый множитель объёма (1 = не менял)
  topMult: number;        // применённый множитель топ-сета (1 = не менял)
}

export interface AutoRegOutput {
  topSetPctMultiplier: number;
  volumeMultiplier: number;
  rirShift: number;
  deload: boolean;
  intensityNote?: string;        // рекомендация по интенсивности (силовая/восстановительная)
  adjustedTopSetPct?: number;
  adjustedRIR?: number;
  decisions: string[];
  /** Прозрачность решения (P1-А): вклад каждого маркера. Необязательное — для потребителей,
   *  которым достаточно чисел. */
  factors?: AutoRegFactor[];
  markersProvided?: number;
  markersTotal?: number;
  reliability?: AutoRegReliability;
}

/** %1RM для «повторов до отказа» (Epley-обратная, r=1→100%). */
function pctForRepsToFailure(reps: number): number {
  if (reps <= 1) return 1;
  return 1 / (1 + reps / 30);
}

/** %1RM для r повторов @ RPE e: max-повторов = r + (10-e), значит %1RM = % для (r+RIR) повторов. */
export function pctForRPE(rpe: number, reps: number): number {
  const rir = Math.max(0, 10 - rpe);
  const n = Math.max(1, reps + rir);
  return r3(pctForRepsToFailure(n));
}

/** Рабочий вес для r повторов @ RPE e при известном e1RM. */
export function loadForRPE(e1RM: number, rpe: number, reps: number): number {
  return r1(e1RM * pctForRPE(rpe, reps));
}

/** RPE по факту: r повторов с весом w, e1RM известен → обратный расчёт RPE. */
export function rpeFromLoad(e1RM: number, weight: number, reps: number): number {
  if (e1RM <= 0 || weight <= 0) return 5;
  const pct = weight / e1RM;
  // найти n: pctForRepsToFailure(n) ≈ pct → n ≈ 30×(1/pct - 1)
  const n = Math.max(1, Math.round(30 * (1 / pct - 1)));
  const rir = Math.max(0, n - reps);
  return r1(clamp(10 - rir, 1, 10));
}

/** Склейка сигналов → корректировка плана. */
export function autoRegulate(input: AutoRegInput): AutoRegOutput {
  const decisions: string[] = [];
  const factors: AutoRegFactor[] = [];
  let volMult = input.plannedVolumeMult ?? 1;
  let topMult = 1;
  let deload = false;
  let intensityNote: string | undefined;
  // Прозрачность (P1-А): вклад маркера в множители, который он реально применил.
  // Арифметика не меняется — константы те же, просто они пишутся в фактор, а не «в никуда».
  const apply = (f: AutoRegFactor) => { volMult *= f.volumeMult; topMult *= f.topMult; factors.push(f); };
  // Маркер, которого нет, обязан называться «нет данных», а не «без корректировки»:
  // иначе потребитель прочитает отсутствие данных как «всё в норме» (прозрачность, P1-А).
  const MISSING_EFFECT = 'нет данных — не участвует';
  const f = (key: AutoRegFactor['key'], label: string, provided: boolean, value: string, effect: string, vMult: number, tMult: number): AutoRegFactor =>
    ({ key, label, provided, value, effect: provided ? effect : MISSING_EFFECT, volumeMult: vMult, topMult: tMult });

  // ACWR (P3)
  const z = input.acwr.zone;
  if (z === "dangerous") { deload = true; decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)}>1.5 (опасно) → объём×0.65, deload`); apply(f('acwr', 'ACWR', true, input.acwr.ratio.toFixed(2), 'объём×0.65, deload', 0.65, 1)); }
  else if (z === "caution") { decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)} (caution) → объём×0.85, RIR+1`); apply(f('acwr', 'ACWR', true, input.acwr.ratio.toFixed(2), 'объём×0.85, RIR+1', 0.85, 1)); }
  else if (z === "undertrained") { decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)}<0.8 (недотрен) → объём×1.1`); apply(f('acwr', 'ACWR', true, input.acwr.ratio.toFixed(2), 'объём×1.1', 1.1, 1)); }
  else { decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)} optimal → базовый объём`); apply(f('acwr', 'ACWR', true, input.acwr.ratio.toFixed(2), 'без корректировки', 1, 1)); }

  // Readiness
  const r = input.readiness;
  if (r < 35) { intensityNote = 'восстановительная'; decisions.push(`Готовность ${r}<35 → RIR+3, топ-сет×0.88, объём×0.85 (восстановительная)`); apply(f('readiness', 'Готовность', true, String(r), 'RIR+3, топ-сет×0.88, объём×0.85', 0.85, 0.88)); }
  else if (r < 50) { intensityNote = 'лёгкая'; decisions.push(`Готовность ${r}<50 → RIR+2, топ-сет×0.94, объём×0.92 (лёгкая)`); apply(f('readiness', 'Готовность', true, String(r), 'RIR+2, топ-сет×0.94, объём×0.92', 0.92, 0.94)); }
  else if (r < 65) { decisions.push(`Готовность ${r}<65 → RIR+1, топ-сет×0.97`); apply(f('readiness', 'Готовность', true, String(r), 'RIR+1, топ-сет×0.97', 1, 0.97)); }
  else if (r >= 80 && z === "optimal") { intensityNote = 'силовая'; decisions.push(`Готовность ${r}≥80 + ACWR optimal → топ-сет×1.03 (силовая)`); apply(f('readiness', 'Готовность', true, String(r), 'топ-сет×1.03 (силовая)', 1, 1.03)); }
  else { decisions.push(`Готовность ${r} → без корректировки`); apply(f('readiness', 'Готовность', true, String(r), 'без корректировки', 1, 1)); }

  // HRV-specific: RMSSD ratio ниже baseline → ЦНС утомлена → снижаем интенсивность, не объём
  const hrv = input.hrvRatio ?? 1.0;
  const hrvProvided = input.hrvRatio != null;
  if (hrv < 0.75) { decisions.push(`HRV-ratio ${hrv.toFixed(2)}<0.75 (ЦНС подавлена) → топ-сет×0.92, RIR+1`); apply(f('hrv', 'HRV (к базе)', hrvProvided, hrv.toFixed(2), 'топ-сет×0.92, RIR+1', 1, 0.92)); }
  else if (hrv < 0.88) { decisions.push(`HRV-ratio ${hrv.toFixed(2)}<0.88 (снижена) → топ-сет×0.96`); apply(f('hrv', 'HRV (к базе)', hrvProvided, hrv.toFixed(2), 'топ-сет×0.96', 1, 0.96)); }
  else if (hrv > 1.15) { decisions.push(`HRV-ratio ${hrv.toFixed(2)}>1.15 (суперкомпенсация) → топ-сет×1.02, объём×1.05`); apply(f('hrv', 'HRV (к базе)', hrvProvided, hrv.toFixed(2), 'топ-сет×1.02, объём×1.05', 1.05, 1.02)); }
  else apply(f('hrv', 'HRV (к базе)', hrvProvided, hrvProvided ? hrv.toFixed(2) : '—', 'без корректировки', 1, 1));

  // Sleep quality
  const sleep = input.sleepScore ?? 0;
  const sleepProvided = input.sleepScore != null;
  if (sleep > 0 && sleep < 45) { decisions.push(`Сон ${sleep}<45 → RIR+1, объём×0.9`); apply(f('sleep', 'Качество сна', sleepProvided, String(sleep), 'RIR+1, объём×0.9', 0.9, 1)); }
  else apply(f('sleep', 'Качество сна', sleepProvided, sleepProvided ? String(sleep) : '—', 'без корректировки', 1, 1));

  // Fatigue
  const fat = input.fatigue ?? 0;
  const fatProvided = input.fatigue != null;
  if (fat > 75) { deload = true; decisions.push(`Усталость ${fat}>75 → объём×0.8, RIR+2, deload`); apply(f('fatigue', 'Усталость', fatProvided, String(fat), 'объём×0.8, RIR+2, deload', 0.8, 1)); }
  else if (fat > 60) { decisions.push(`Усталость ${fat}>60 → объём×0.9, RIR+1`); apply(f('fatigue', 'Усталость', fatProvided, String(fat), 'объём×0.9, RIR+1', 0.9, 1)); }
  else apply(f('fatigue', 'Усталость', fatProvided, fatProvided ? String(fat) : '—', 'без корректировки', 1, 1));

  // Last session RPE
  const lrpe = input.lastSessionRPE ?? 0;
  const lrpeProvided = input.lastSessionRPE != null;
  if (lrpe >= 9.5) { decisions.push(`RPE прошлой сессии ${lrpe}≥9.5 → RIR+2, объём×0.85`); apply(f('lastRpe', 'RPE прошлой сессии', lrpeProvided, String(lrpe), 'RIR+2, объём×0.85', 0.85, 1)); }
  else if (lrpe >= 9 && lrpe > 0) { decisions.push(`RPE прошлой сессии ${lrpe}≥9 → RIR+1, контроль`); apply(f('lastRpe', 'RPE прошлой сессии', lrpeProvided, String(lrpe), 'RIR+1, контроль', 1, 1)); }
  else apply(f('lastRpe', 'RPE прошлой сессии', lrpeProvided, lrpeProvided ? String(lrpe) : '—', 'без корректировки', 1, 1));

  // Velocity loss (P2 + P4): пороги по цели блока (Pareja-Blanco 2017; Chiang 2025 — межиндивидуальный разброс велик,
  // поэтому это зоны-предупреждения, а deload-гейт 40% общий). Epley-канон для RPE↔% — осознанно (Helms/Zourdos).
  const vl = input.lastVelocityLossPct ?? 0;
  const goal = input.goal ?? 'general';
  const vlProvided = input.lastVelocityLossPct != null;
  if (vl > 40) { deload = true; decisions.push(`VLoss ${vl}%>40 → deload, объём×0.5, топ-сет×0.92`); apply(f('velocityLoss', 'Потеря скорости', vlProvided, vl + '%', 'deload, объём×0.5, топ-сет×0.92', 0.5, 0.92)); }
  else if (goal === 'strength' && vl > 25) { decisions.push(`VLoss ${vl}%>25 при силовой цели → объём×0.75 (лишний объём не в силу, Pareja-Blanco)`); apply(f('velocityLoss', 'Потеря скорости', vlProvided, vl + '%', 'объём×0.75', 0.75, 1)); }
  else if (goal !== 'strength' && vl > 30) { decisions.push(`VLoss ${vl}%>30 → объём×0.85`); apply(f('velocityLoss', 'Потеря скорости', vlProvided, vl + '%', 'объём×0.85', 0.85, 1)); }
  else if (vl > 25) { decisions.push(`VLoss ${vl}%>25 → объём×0.8`); apply(f('velocityLoss', 'Потеря скорости', vlProvided, vl + '%', 'объём×0.8', 0.8, 1)); }
  else if (vl > 0 && vl < 10) { decisions.push(`VLoss ${vl}%<10 (свежесть) → объём×1.05`); apply(f('velocityLoss', 'Потеря скорости', vlProvided, vl + '%', 'объём×1.05', 1.05, 1)); }
  else apply(f('velocityLoss', 'Потеря скорости', vlProvided, vlProvided ? vl + '%' : '—', 'без корректировки', 1, 1));

  volMult = r2(clamp(volMult, 0.4, 1.25));
  topMult = r2(clamp(topMult, 0.85, 1.05));
  // Avoid stacking every signal into an unsafe RIR jump. Readiness/HRV are
  // intensity signals; ACWR/fatigue/RPE are load signals.
  const intensityRir = Math.min(3, (r < 35 ? 3 : r < 50 ? 2 : r < 65 ? 1 : 0) + (hrv < 0.75 ? 1 : 0));
  const loadRir = Math.min(2, (z === 'caution' || z === 'dangerous' ? 1 : 0) + (fat > 75 ? 2 : fat > 60 ? 1 : 0) + (lrpe >= 9.5 ? 2 : lrpe >= 9 ? 1 : 0));
  const rirShift = Math.round(clamp(intensityRir + loadRir, 0, 4));

  // Прозрачность решения (P1-А): сколько маркеров реально пришло.
  const markersProvided = factors.filter(x => x.provided).length;
  const reliability: AutoRegReliability =
    markersProvided >= 5 ? 'high' : markersProvided >= 3 ? 'medium' : 'low';

  const out: AutoRegOutput = {
    topSetPctMultiplier: topMult,
    volumeMultiplier: volMult,
    rirShift,
    deload,
    intensityNote,
    decisions,
    factors,
    markersProvided,
    markersTotal: AUTOREG_MARKERS_TOTAL,
    reliability,
  };
  if (input.plannedTopSetPct != null) {
    out.adjustedTopSetPct = r3(clamp(input.plannedTopSetPct * topMult, 0.5, 1.0));
  }
  if (input.plannedRIR != null) {
    out.adjustedRIR = Math.max(0, input.plannedRIR + rirShift);
  }
  return out;
}

/** Скорректировать рабочий вес топ-сета под авторегуляцию. */
export function adjustedLoad(e1RM: number, plannedPct: number, adj: AutoRegOutput): number {
  return r1(e1RM * (adj.adjustedTopSetPct ?? plannedPct));
}

/** Скорректировать любой рабочий вес по коэффициенту авторегуляции. */
export function adjustedWorkingWeight(plannedWeight: number, adj: AutoRegOutput): number {
  return r1(plannedWeight * adj.topSetPctMultiplier);
}

export interface ExerciseTarget {
  name: string;                  // название упражнения
  e1RM: number;                  // расчётный 1ПМ
  plannedWeight: number;        // запланированный рабочий вес
  plannedReps: number;          // запланированные повторения
  plannedSets: number;          // запланированные подходы
  plannedRIR: number;           // запланированный RIR
  isCompound: boolean;          // базовое или изоляция
}

export interface AdjustedExercise {
  name: string;
  originalWeight: number;
  adjustedWeight: number;       // скорректированный вес
  adjustedSets: number;         // скорректированное число подходов
  adjustedRIR: number;          // скорректированный RIR
  note: string;                 // пояснение корректировки
}

/**
 * Полная авторегуляция сессии: корректирует веса и подходы для каждого упражнения
 * на основе дневной готовности, HRV, ACWR и усталости.
 */
export function sessionAutoRegulate(
  exercises: ExerciseTarget[],
  input: AutoRegInput
): { exercises: AdjustedExercise[]; summary: AutoRegOutput } {
  const adj = autoRegulate(input);

  const adjusted = exercises.map(ex => {
    const w = adjustedWorkingWeight(ex.plannedWeight, adj);
    const sets = Math.max(1, Math.round(ex.plannedSets * adj.volumeMultiplier));
    const rir = Math.max(0, ex.plannedRIR + adj.rirShift);

    let note = '';
    if (adj.deload) note = '⭐ Делод: снижен объём и интенсивность';
    else if (adj.intensityNote === 'восстановительная') note = '🟢 Восстановительная сессия';
    else if (adj.intensityNote === 'лёгкая') note = '🟡 Лёгкая сессия';
    else if (adj.intensityNote === 'силовая') note = '🔴 Силовая сессия (пуш)';
    else if (adj.topSetPctMultiplier < 0.95) note = '📉 Вес снижен по готовности';
    else if (adj.topSetPctMultiplier > 1.01) note = '📈 Вес повышен (суперкомпенсация)';

    return { name: ex.name, originalWeight: ex.plannedWeight, adjustedWeight: w, adjustedSets: sets, adjustedRIR: rir, note };
  });

  return { exercises: adjusted, summary: adj };
}

/** Быстрая оценка: стоит ли тренироваться сегодня (по readiness + HRV). */
export function shouldTrainToday(input: AutoRegInput): { train: boolean; reason: string } {
  if ((input.combinedRirShift ?? 0) >= 3) {
    return { train: false, reason: `Суммарный RIR-сдвиг ${input.combinedRirShift}≥3 — восстановление приоритетно` };
  }
  if (input.readiness < 25) return { train: false, reason: `Готовность ${input.readiness}<25 — полный отдых` };
  if (input.readiness < 35 && (input.hrvRatio ?? 1) < 0.7) return { train: false, reason: `Готовность ${input.readiness}<35 + HRV<0.7 — восстановление приоритетно` };
  if (input.acwr.zone === 'dangerous') return { train: false, reason: 'ACWR в опасной зоне — пропуск тренировки рекомендован' };
  if (input.readiness < 45) return { train: true, reason: `Готовность ${input.readiness}<45 — только восстановительная сессия` };
  if ((input.hrvRatio ?? 1) < 0.8) return { train: true, reason: `HRV снижена (${(input.hrvRatio ?? 1).toFixed(2)}) — лёгкая сессия` };
  return { train: true, reason: 'Готовность в норме — полная тренировка' };
}
