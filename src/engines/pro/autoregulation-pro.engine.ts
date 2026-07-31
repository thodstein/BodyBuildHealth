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

export type ACWRZone = "undertrained" | "optimal" | "caution" | "dangerous";

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
}

export interface AutoRegOutput {
  topSetPctMultiplier: number;
  volumeMultiplier: number;
  rirShift: number;
  deload: boolean;
  intensityCap?: number;
  intensityNote?: string;        // рекомендация по интенсивности (силовая/восстановительная)
  adjustedTopSetPct?: number;
  adjustedRIR?: number;
  decisions: string[];
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
  let volMult = input.plannedVolumeMult ?? 1;
  let rirShift = 0;
  let topMult = 1;
  let deload = false;
  let intensityNote: string | undefined;

  // ACWR (P3)
  const z = input.acwr.zone;
  if (z === "dangerous") { volMult *= 0.65; deload = true; decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)}>1.5 (опасно) → объём×0.65, deload`); }
  else if (z === "caution") { volMult *= 0.85; rirShift += 1; decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)} (caution) → объём×0.85, RIR+1`); }
  else if (z === "undertrained") { volMult *= 1.1; decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)}<0.8 (недотрен) → объём×1.1`); }
  else { decisions.push(`ACWR ${input.acwr.ratio.toFixed(1)} optimal → базовый объём`); }

  // Readiness
  const r = input.readiness;
  if (r < 35) { rirShift += 3; topMult *= 0.88; volMult *= 0.85; intensityNote = 'восстановительная'; decisions.push(`Готовность ${r}<35 → RIR+3, топ-сет×0.88, объём×0.85 (восстановительная)`); }
  else if (r < 50) { rirShift += 2; topMult *= 0.94; volMult *= 0.92; intensityNote = 'лёгкая'; decisions.push(`Готовность ${r}<50 → RIR+2, топ-сет×0.94, объём×0.92 (лёгкая)`); }
  else if (r < 65) { rirShift += 1; topMult *= 0.97; decisions.push(`Готовность ${r}<65 → RIR+1, топ-сет×0.97`); }
  else if (r >= 80 && z === "optimal") { topMult *= 1.03; intensityNote = 'силовая'; decisions.push(`Готовность ${r}≥80 + ACWR optimal → топ-сет×1.03 (силовая)`); }
  else { decisions.push(`Готовность ${r} → без корректировки`); }

  // HRV-specific: RMSSD ratio ниже baseline → ЦНС утомлена → снижаем интенсивность, не объём
  const hrv = input.hrvRatio ?? 1.0;
  if (hrv < 0.75) { topMult *= 0.92; rirShift += 1; decisions.push(`HRV-ratio ${hrv.toFixed(2)}<0.75 (ЦНС подавлена) → топ-сет×0.92, RIR+1`); }
  else if (hrv < 0.88) { topMult *= 0.96; decisions.push(`HRV-ratio ${hrv.toFixed(2)}<0.88 (снижена) → топ-сет×0.96`); }
  else if (hrv > 1.15) { topMult *= 1.02; volMult *= 1.05; decisions.push(`HRV-ratio ${hrv.toFixed(2)}>1.15 (суперкомпенсация) → топ-сет×1.02, объём×1.05`); }

  // Sleep quality
  const sleep = input.sleepScore ?? 0;
  if (sleep > 0 && sleep < 45) { rirShift += 1; volMult *= 0.9; decisions.push(`Сон ${sleep}<45 → RIR+1, объём×0.9`); }

  // Fatigue
  const fat = input.fatigue ?? 0;
  if (fat > 75) { volMult *= 0.8; rirShift += 2; deload = true; decisions.push(`Усталость ${fat}>75 → объём×0.8, RIR+2, deload`); }
  else if (fat > 60) { volMult *= 0.9; rirShift += 1; decisions.push(`Усталость ${fat}>60 → объём×0.9, RIR+1`); }

  // Last session RPE
  const lrpe = input.lastSessionRPE ?? 0;
  if (lrpe >= 9.5) { rirShift += 2; volMult *= 0.85; decisions.push(`RPE прошлой сессии ${lrpe}≥9.5 → RIR+2, объём×0.85`); }
  else if (lrpe >= 9 && lrpe > 0) { rirShift += 1; decisions.push(`RPE прошлой сессии ${lrpe}≥9 → RIR+1, контроль`); }

  // Velocity loss (P2)
  const vl = input.lastVelocityLossPct ?? 0;
  if (vl > 40) { deload = true; volMult *= 0.5; topMult *= 0.92; decisions.push(`VLoss ${vl}%>40 → deload, объём×0.5, топ-сет×0.92`); }
  else if (vl > 25) { volMult *= 0.8; decisions.push(`VLoss ${vl}%>25 → объём×0.8`); }
  else if (vl > 0 && vl < 10) { volMult *= 1.05; decisions.push(`VLoss ${vl}%<10 (свежесть) → объём×1.05`); }

  volMult = r2(clamp(volMult, 0.4, 1.25));
  topMult = r2(clamp(topMult, 0.85, 1.05));
  // Avoid stacking every signal into an unsafe RIR jump. Readiness/HRV are
  // intensity signals; ACWR/fatigue/RPE are load signals.
  const intensityRir = Math.min(3, (r < 35 ? 3 : r < 50 ? 2 : r < 65 ? 1 : 0) + (hrv < 0.75 ? 1 : 0));
  const loadRir = Math.min(2, (z === 'caution' || z === 'dangerous' ? 1 : 0) + (fat > 75 ? 2 : fat > 60 ? 1 : 0) + (lrpe >= 9.5 ? 2 : lrpe >= 9 ? 1 : 0));
  rirShift = Math.round(clamp(intensityRir + loadRir, 0, 4));

  const out: AutoRegOutput = {
    topSetPctMultiplier: topMult,
    volumeMultiplier: volMult,
    rirShift,
    deload,
    intensityNote,
    decisions,
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
  if (input.readiness < 25) return { train: false, reason: `Готовность ${input.readiness}<25 — полный отдых` };
  if (input.readiness < 35 && (input.hrvRatio ?? 1) < 0.7) return { train: false, reason: `Готовность ${input.readiness}<35 + HRV<0.7 — восстановление приоритетно` };
  if (input.acwr.zone === 'dangerous') return { train: false, reason: 'ACWR в опасной зоне — пропуск тренировки рекомендован' };
  if (input.readiness < 45) return { train: true, reason: `Готовность ${input.readiness}<45 — только восстановительная сессия` };
  if ((input.hrvRatio ?? 1) < 0.8) return { train: true, reason: `HRV снижена (${(input.hrvRatio ?? 1).toFixed(2)}) — лёгкая сессия` };
  return { train: true, reason: 'Готовность в норме — полная тренировка' };
}
