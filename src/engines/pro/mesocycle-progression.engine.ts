/**
 * mesocycle-progression.engine.ts — P7: кривые прогрессии мезоцикла (проф. уровень).
 * Неделя N+1 из N: объём/интенсивность/RIR по фазам (base/build/peak/deload),
 * fatigue-driven volume drop, taper-кривая. Расширяет lms-progression / bb-builder
 * канонической мезо-логикой (REUSE mesocyclePhaseForWeek из rir-matrix).
 */
import { mesocyclePhaseForWeek, type MesocyclePhase } from "../rir-matrix.engine";

export type MesoGoal = "strength" | "hypertrophy" | "power";

export interface MesocycleConfig {
  weeks: number;
  startVolumeSets: number;   // сетов/нед на неделе 1
  startIntensityPct: number;  // %1RM топ-сета нед 1 (напр. 0.75)
  startRIR: number;           // RIR нед 1 (напр. 3)
  goal: MesoGoal;
  fatigueTrajectory?: number[]; // опц. усталость 0-100 по неделям → снижение объёма
}

export interface WeekProgression {
  week: number;
  phase: MesocyclePhase;
  volumeMultiplier: number;  // относительно нед 1
  volumeSets: number;
  intensityPct: number;
  rir: number;
  fatigueAdjusted: boolean;
  rationale: string;
}

export interface InterMesoStep {
  mesoIndex: number;
  startVolumeSets: number;
  startIntensityPct: number;
  startRIR: number;
  growthRationale: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Прирост интенсивности (%1RM) на неделю по фазе/цели. */
function intensityStep(goal: MesoGoal, phase: MesocyclePhase): number {
  if (phase === "deload") return 0;
  if (goal === "strength") return phase === "peak" ? 0.025 : phase === "build" ? 0.02 : 0.012;
  if (goal === "power") return phase === "peak" ? 0.03 : 0.015;
  return phase === "peak" ? 0.02 : 0.012; // hypertrophy
}

/** Изменение объёма (множитель относительно прошлой недели) по фазе/цели. */
function volumeDelta(goal: MesoGoal, phase: MesocyclePhase): number {
  if (phase === "deload") return -0.5;     // 50% от прошлой
  if (phase === "peak") return goal === "hypertrophy" ? -0.15 : -0.12; // объём падает
  if (phase === "build") return goal === "hypertrophy" ? 0.06 : 0.03; // рост объёма
  return goal === "hypertrophy" ? 0.04 : 0.02; // base: плавный рост
}

/** RIR-цель по фазе. */
function rirForPhase(goal: MesoGoal, phase: MesocyclePhase, startRIR: number): number {
  if (phase === "deload") return 4;
  if (phase === "peak") return goal === "strength" ? 0 : 1;
  if (phase === "build") return Math.max(1, startRIR - 1);
  return startRIR; // base
}

/** Сгенерировать недельную прогрессию мезоцикла. */
export function generateMesocycleProgression(config: MesocycleConfig): WeekProgression[] {
  const { weeks, startVolumeSets, startIntensityPct, startRIR, goal, fatigueTrajectory } = config;
  const out: WeekProgression[] = [];
  let curVolMult = 1;
  let curIntensity = startIntensityPct;
  for (let w = 1; w <= weeks; w++) {
    const phase = mesocyclePhaseForWeek(w, weeks);
    if (w > 1) {
      curVolMult = curVolMult * (1 + volumeDelta(goal, phase));
      // при переходе в deload берём долю от прошлой недели
      if (phase === "deload") curVolMult = out[out.length - 1].volumeMultiplier * 0.5;
      curIntensity = out[out.length - 1].intensityPct + intensityStep(goal, phase);
    }
    let fatigueAdjusted = false;
    const fat = fatigueTrajectory?.[w - 1] ?? 0;
    if (fat > 70 && phase !== "deload") { curVolMult *= 0.9; fatigueAdjusted = true; }
    curVolMult = r2(clamp(curVolMult, 0.4, 1.25));
    curIntensity = r2(clamp(curIntensity, 0.5, 1));
    const rir = rirForPhase(goal, phase, startRIR);
    out.push({
      week: w,
      phase,
      volumeMultiplier: curVolMult,
      volumeSets: Math.round(startVolumeSets * curVolMult),
      intensityPct: curIntensity,
      rir,
      fatigueAdjusted,
      rationale: phaseLine(phase, goal, curVolMult, curIntensity, rir, fatigueAdjusted),
    });
  }
  return out;
}

/** Сгенерировать прогрессию МЕЖДУ мезоциклами (Трек Мезо 1→2→3). */
export function generateInterMesocycleProgression(config: MesocycleConfig, mesoCount: number = 3): InterMesoStep[] {
  const { startVolumeSets, startIntensityPct, startRIR, goal } = config;
  const steps: InterMesoStep[] = [];
  
  let curVol = startVolumeSets;
  let curInt = startIntensityPct;
  let curRir = startRIR;

  // Коэффициенты роста между мезоциклами
  const growth = {
    hypertrophy: { vol: 1.08, int: 0.02, rir: 0 },
    strength: { vol: 1.05, int: 0.03, rir: -0.2 },
    power: { vol: 1.02, int: 0.04, rir: 0 },
  }[goal];

  for (let i = 1; i <= mesoCount; i++) {
    if (i > 1) {
      curVol = Math.round(curVol * growth.vol);
      curInt = r2(clamp(curInt + growth.int, 0.5, 1));
      curRir = r1(clamp(curRir + growth.rir, 0, 5));
    }
    
    steps.push({
      mesoIndex: i,
      startVolumeSets: curVol,
      startIntensityPct: curInt,
      startRIR: curRir,
      growthRationale: i === 1 
        ? "Стартовые параметры первого мезоцикла" 
        : `Прогрессия от Мезо ${i-1}: объём +${Math.round((growth.vol-1)*100)}%, интенсивность +${Math.round(growth.int*100)}%`,
    });
  }
  
  return steps;
}

function phaseLine(phase: MesocyclePhase, goal: MesoGoal, vm: number, ip: number, rir: number, fa: boolean): string {
  const map: Record<MesocyclePhase, string> = {
    base: "База: рост объёма, акклиматизация",
    build: "Накопление: пик объёма (MAV), ↑ интенсивности",
    peak: "Пик: ↑↑ интенсивности, ↓ объёма, RIR 0-1",
    deload: "Разгрузка: 50% объёма, RIR 4",
  };
  return `${map[phase]} · объём×${vm} (${Math.round(ip * 100)}%, RIR ${rir})${fa ? " · ↓объём (усталость>70)" : ""}`;
}

export interface TaperWeek { week: number; volumePctOfPeak: number; intensityPct: number; rir: number; rationale: string; }

/** Taper-кривая (перед соревнованием): объём ↓40-60% за 1-3 нед, интенсивность удерживается. */
export function taperCurve(taperWeeks: number, peakIntensityPct = 0.92): TaperWeek[] {
  const out: TaperWeek[] = [];
  for (let w = 1; w <= taperWeeks; w++) {
    const volPct = r2(clamp(1 - (0.2 * w + 0.15), 0.4, 1)); // нед1 ~0.65, нед2 ~0.45, нед3 ~0.40
    const intensity = w === taperWeeks ? r2(peakIntensityPct) : r2(clamp(peakIntensityPct - 0.03 + 0.03 * (w / taperWeeks), 0.7, 1));
    const rir = w === taperWeeks ? 1 : 2;
    out.push({
      week: w,
      volumePctOfPeak: r2(volPct),
      intensityPct: intensity,
      rir,
      rationale: `Taper нед${w}: объём ${Math.round(volPct * 100)}% от пика, интенсивность удержание ${Math.round(intensity * 100)}%, RIR ${rir}`,
    });
  }
  return out;
}

/** Сводка: фаза-распределение мезоцикла. */
export function phaseDistribution(weeks: number): Record<MesocyclePhase, number> {
  const dist: Record<MesocyclePhase, number> = { base: 0, build: 0, peak: 0, deload: 0 };
  for (let w = 1; w <= weeks; w++) dist[mesocyclePhaseForWeek(w, weeks)]++;
  return dist;
}
