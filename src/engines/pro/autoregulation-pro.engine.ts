/**
 * autoregulation-pro.engine.ts — P4: проф-авторегуляция (проф. уровень).
 * Склейка сигналов → суточная корректировка плана (REUSE P1/P2/P3 outputs):
 *   readiness + ACWR (P3) + velocity-loss (P2) + last-RPE → % топ-сета, объём-множитель, RIR-сдвиг, триггер deload.
 * + RPE→%1RM (через модель RIR: нагрузка для r повторов @RPE e = нагрузка для (r+RIR)-повторного максимума).
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
  const baseVol = volMult;

  // ACWR (P3)
  const z = input.acwr.zone;
  if (z === "dangerous") { volMult *= 0.7; deload = true; decisions.push(`ACWR ${input.acwr.ratio}>1.5 (опасно) → объём×0.7, deload-триггер`); }
  else if (z === "caution") { volMult *= 0.85; decisions.push(`ACWR ${input.acwr.ratio} (caution) → объём×0.85`); }
  else if (z === "undertrained") { volMult *= 1.1; decisions.push(`ACWR ${input.acwr.ratio}<0.8 (недотрен) → объём×1.1 (плавный рост)`); }
  else { decisions.push(`ACWR ${input.acwr.ratio} optimal — базовый объём`); }

  // Readiness
  const r = input.readiness;
  if (r < 40) { rirShift += 2; topMult *= 0.92; decisions.push(`Готовность ${r}<40 → RIR+2, топ-сет×0.92`); }
  else if (r < 55) { rirShift += 1; topMult *= 0.96; decisions.push(`Готовность ${r}<55 → RIR+1, топ-сет×0.96`); }
  else if (r >= 80 && z === "optimal") { topMult *= 1.02; decisions.push(`Готовность ${r}≥80 + optimal ACWR → топ-сет×1.02 (пуш)`); }
  else { decisions.push(`Готовность ${r} — без корректировки по готовности`); }

  // Fatigue
  const fat = input.fatigue ?? 0;
  if (fat > 70) { volMult *= 0.9; rirShift += 1; decisions.push(`Усталость ${fat}>70 → объём×0.9, RIR+1`); }

  // Last session RPE
  const lrpe = input.lastSessionRPE ?? 0;
  if (lrpe >= 9.5) { rirShift += 1; volMult *= 0.9; decisions.push(`Последняя RPE ${lrpe}≥9.5 → RIR+1, объём×0.9`); }
  else if (lrpe >= 9 && lrpe > 0) { decisions.push(`Последняя RPE ${lrpe} — на грани, контроль`); }

  // Velocity loss (P2)
  const vl = input.lastVelocityLossPct ?? 0;
  if (vl > 40) { deload = true; volMult *= 0.6; decisions.push(`Потеря скорости ${vl}%>40 → deload, объём×0.6`); }
  else if (vl > 25) { volMult *= 0.8; decisions.push(`Потеря скорости ${vl}%>25 → объём×0.8`); }

  volMult = r2(clamp(volMult, 0.5, 1.2));
  topMult = r2(clamp(topMult, 0.85, 1.05));
  rirShift = Math.round(clamp(rirShift, 0, 4));

  const out: AutoRegOutput = {
    topSetPctMultiplier: topMult,
    volumeMultiplier: volMult,
    rirShift,
    deload,
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
