// ============================================================================
// periodization-full.engine.ts
// FULL PERIODIZATION ENGINE V17.5 ULTRA
// Integration of pereodization_engine.js with TypeScript types
// ============================================================================

// ---------------------------------------------------------------------------
// INTERNAL TYPES (встроенные для авт��номности)
// ---------------------------------------------------------------------------

export interface TrainingInput {
  goal?: { type?: string };
  periodization?: { type?: string; weeks?: number; mesoLength?: number };
  schedule?: { daysPerWeek?: number };
  readiness?: {
    hrv?: number;
    sleepQuality?: number;
    stress?: number;
    soreness?: number;
    mood?: number;
  };
}

export interface MacrocyclePlan {
  id: string;
  name: string;
  durationWeeks: number;
  phases: MesocyclePlan[];
}

export interface MesocyclePlan {
  id: string;
  name: string;
  phase: MesocyclePhase;
  weeks: number;
  microcycles: Microcycle[];
}

export interface Microcycle {
  id: string;
  name: string;
  weekIndex: number;
  days: TrainingDay[];
}

export interface TrainingDay {
  id: string;
  name: string;
  dayIndex: number;
  blockType: string;
  intensity: number;
  volume: number;
  energySystem: EnergySystem;
  biomechBias: BiomechBias;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

export const PHASES = [
  "accumulation",
  "intensification",
  "transmutation",
  "peak",
  "deload"
] as const;

export type MesocyclePhase = typeof PHASES[number];

export const PERIODIZATION_TYPES = [
  "linear",
  "undulating",
  "block"
] as const;

export type PeriodizationType = typeof PERIODIZATION_TYPES[number];

export const DEFAULT_MACRO_WEEKS = 16;

// распределение фаз по макроциклу (до адаптации)
export const PHASE_DISTRIBUTION = {
  accumulation: 0.35,
  intensification: 0.25,
  transmutation: 0.2,
  peak: 0.1,
  deload: 0.1
} as const;

// базовые профили нагрузки по фазам
export const PHASE_LOAD_PROFILE = {
  accumulation: { intensity: 0.65, volume: 1.0, density: 0.9 },
  intensification: { intensity: 0.75, volume: 0.85, density: 1.0 },
  transmutation: { intensity: 0.8, volume: 0.7, density: 1.1 },
  peak: { intensity: 0.9, volume: 0.5, density: 1.0 },
  deload: { intensity: 0.55, volume: 0.4, density: 0.7 }
};

// SRA окна по качествам (в часах)
export const SRA_WINDOWS = {
  strength: { min: 48, max: 96 },
  hypertrophy: { min: 24, max: 72 },
  power: { min: 48, max: 96 },
  endurance: { min: 12, max: 48 }
} as const;

// biomechanical bias по фазам
export const BIOMECH_BIAS = {
  accumulation: { lengthTension: "mid", torqueCurve: "balanced", stiffness: "moderate" },
  intensification: { lengthTension: "mid-short", torqueCurve: "peak", stiffness: "high" },
  transmutation: { lengthTension: "mid-long", torqueCurve: "dynamic", stiffness: "elastic" },
  peak: { lengthTension: "optimal", torqueCurve: "peak", stiffness: "high" },
  deload: { lengthTension: "mid-long", torqueCurve: "reduced", stiffness: "low" }
} as const;

// energy system bias по фазам
export const ENERGY_WAVE = {
  accumulation: { atp_pc: 0.2, glycolytic: 0.5, oxidative: 0.3 },
  intensification: { atp_pc: 0.4, glycolytic: 0.5, oxidative: 0.1 },
  transmutation: { atp_pc: 0.5, glycolytic: 0.4, oxidative: 0.1 },
  peak: { atp_pc: 0.6, glycolytic: 0.3, oxidative: 0.1 },
  deload: { atp_pc: 0.2, glycolytic: 0.3, oxidative: 0.5 }
} as const;

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function safe(v: number | undefined, fallback: number = 0): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

// ---------------------------------------------------------------------------
// READINESS / FATIGUE / ACWR / STRESS / SLEEP
// ---------------------------------------------------------------------------

export interface ReadinessInput {
  readiness?: {
    hrv?: number;
    sleepQuality?: number;
    stress?: number;
    soreness?: number;
    mood?: number;
  };
}

export interface LoadHistory {
  sessions?: Array<{ load?: number }>;
  weeks?: Array<{ totalLoad?: number }>;
}

export interface FatigueResult {
  acute: number;
  chronic: number;
  acwr: number;
  fatigue: number;
}

export function calcReadiness(input: ReadinessInput): number {
  const r = input.readiness || {};
  const hrv = safe(r.hrv, 0.7);
  const sleep = safe(r.sleepQuality, 0.7);
  const stress = safe(r.stress, 0.5);
  const soreness = safe(r.soreness, 0.4);
  const mood = safe(r.mood, 0.6);

  let score = 0;
  score += hrv * 0.3;
  score += sleep * 0.25;
  score += (1 - stress) * 0.2;
  score += (1 - soreness) * 0.15;
  score += mood * 0.1;

  return clamp(score, 0, 1);
}

export function calcAcuteLoad(history: LoadHistory | undefined): number {
  if (!history || !Array.isArray(history.sessions)) return 0;
  const last7 = history.sessions.slice(-7);
  let sum = 0;
  for (const s of last7) sum += safe(s.load, 0);
  return sum;
}

export function calcChronicLoad(history: LoadHistory | undefined): number {
  if (!history || !Array.isArray(history.sessions)) return 0;
  const last28 = history.sessions.slice(-28);
  let sum = 0;
  for (const s of last28) sum += safe(s.load, 0);
  return sum / 4;
}

export function calcACWR(acute: number, chronic: number): number {
  if (chronic <= 0) return 1.0;
  return clamp(acute / chronic, 0.3, 2.5);
}

export function calcFatigue(history: LoadHistory | undefined): FatigueResult {
  const acute = calcAcuteLoad(history);
  const chronic = calcChronicLoad(history);
  const acwr = calcACWR(acute, chronic);

  // локальная/системная/нейронная усталость можно будет расширить,
  // пока даём агрегированный индекс
  const fatigue = clamp((acwr - 0.8) / 1.2, 0, 1);

  return { acute, chronic, acwr, fatigue };
}

// ---------------------------------------------------------------------------
// PERIODIZATION TYPE / PRIMARY QUALITY
// ---------------------------------------------------------------------------

export function resolvePeriodizationType(input: TrainingInput): PeriodizationType {
  const t = input.periodization?.type;
  if (PERIODIZATION_TYPES.includes(t as PeriodizationType)) return t as PeriodizationType;

  const goal = input.goal?.type;

  if (goal === "strength") return "block";
  if (goal === "endurance") return "undulating";
  if (goal === "power") return "undulating";

  return "linear";
}

export function resolvePrimaryQuality(input: TrainingInput): string {
  const goal = input.goal?.type;
  if (goal === "strength") return "strength";
  if (goal === "endurance") return "endurance";
  if (goal === "power") return "power";
  return "hypertrophy";
}

export function getSRAWindow(quality: string): { min: number; max: number } {
  return SRA_WINDOWS[quality as keyof typeof SRA_WINDOWS] || SRA_WINDOWS.hypertrophy;
}

// ---------------------------------------------------------------------------
// MACRO → MESO → MICRO
// ---------------------------------------------------------------------------

export function buildPhaseMap(totalWeeks: number): MesocyclePhase[] {
  const accWeeks = Math.max(2, Math.round(totalWeeks * PHASE_DISTRIBUTION.accumulation));
  const intWeeks = Math.max(2, Math.round(totalWeeks * PHASE_DISTRIBUTION.intensification));
  const transWeeks = Math.max(2, Math.round(totalWeeks * PHASE_DISTRIBUTION.transmutation));
  const peakWeeks = Math.max(1, Math.round(totalWeeks * PHASE_DISTRIBUTION.peak));
  const deloadWeeks = Math.max(1, Math.round(totalWeeks * PHASE_DISTRIBUTION.deload));

  let phases: MesocyclePhase[] = [];
  phases = phases.concat(Array(accWeeks).fill("accumulation") as MesocyclePhase[]);
  phases = phases.concat(Array(intWeeks).fill("intensification") as MesocyclePhase[]);
  phases = phases.concat(Array(transWeeks).fill("transmutation") as MesocyclePhase[]);
  phases = phases.concat(Array(peakWeeks).fill("peak") as MesocyclePhase[]);
  phases = phases.concat(Array(deloadWeeks).fill("deload") as MesocyclePhase[]);

  if (phases.length > totalWeeks) {
    phases = phases.slice(0, totalWeeks);
  } else if (phases.length < totalWeeks) {
    while (phases.length < totalWeeks) phases.push("accumulation");
  }

  return phases;
}

export interface MesoCycle {
  mesoIndex: number;
  startWeek: number;
  endWeek: number;
  length: number;
}

export function buildMesoCycles(totalWeeks: number, mesoLength: number = 4): MesoCycle[] {
  const mesoCycles: MesoCycle[] = [];
  let index = 0;
  let mesoIndex = 0;

  while (index < totalWeeks) {
    const length = Math.min(mesoLength, totalWeeks - index);
    mesoCycles.push({
      mesoIndex,
      startWeek: index,
      endWeek: index + length - 1,
      length
    });
    index += length;
    mesoIndex++;
  }

  return mesoCycles;
}

// ---------------------------------------------------------------------------
// NEURO-ADAPTIVE PHASE SHIFTING
// ---------------------------------------------------------------------------

export function applyReadinessGatesToPhase(
  phase: MesocyclePhase,
  readiness: number,
  fatigue: number,
  acwr: number,
  stress: number,
  sleepQuality: number
): MesocyclePhase {
  // жёсткий защитный режим
  const highRisk =
    readiness < 0.3 ||
    fatigue > 0.85 ||
    acwr > 1.6 ||
    stress > 0.8 ||
    sleepQuality < 0.4;

  if (highRisk) {
    if (phase === "peak" || phase === "transmutation") return "deload";
    if (phase === "intensification") return "accumulation";
  }

  // мягкая защита
  const moderateRisk =
    readiness < 0.45 ||
    fatigue > 0.7 ||
    acwr > 1.4 ||
    stress > 0.7 ||
    sleepQuality < 0.5;

  if (moderateRisk) {
    if (phase === "peak") return "transmutation";
    if (phase === "transmutation") return "intensification";
  }

  // возможность агрессивного продвижения
  const overreachPossible =
    readiness > 0.8 &&
    fatigue < 0.4 &&
    acwr < 1.2 &&
    stress < 0.6 &&
    sleepQuality > 0.7;

  if (overreachPossible) {
    if (phase === "accumulation") return "intensification";
    if (phase === "intensification") return "transmutation";
  }

  return phase;
}

// ---------------------------------------------------------------------------
// DAY QUALITY MIX / DAILY UNDULATION
// ---------------------------------------------------------------------------

export interface QualityMix {
  strength: number;
  hypertrophy: number;
  power: number;
  endurance: number;
}

export function pickDayQualityMix(
  periodizationType: PeriodizationType,
  phase: MesocyclePhase,
  dayIndex: number,
  daysPerWeek: number,
  primaryQuality: string
): QualityMix {
  const base: QualityMix = {
    strength: 0,
    hypertrophy: 0,
    power: 0,
    endurance: 0
  };

  const isUpperDay = dayIndex % 2 === 0;
  const mod3 = dayIndex % 3;

  if (periodizationType === "linear") {
    if (phase === "accumulation") {
      base.hypertrophy = 0.6;
      base.strength = 0.3;
      base.endurance = primaryQuality === "endurance" ? 0.1 : 0.05;
    } else if (phase === "intensification") {
      base.strength = 0.6;
      base.hypertrophy = 0.3;
      base.power = primaryQuality === "power" ? 0.1 : 0.05;
    } else if (phase === "transmutation") {
      base.strength = 0.45;
      base.power = 0.35;
      base.hypertrophy = 0.2;
    } else if (phase === "peak") {
      base.power = 0.5;
      base.strength = 0.4;
      base.hypertrophy = 0.1;
    } else if (phase === "deload") {
      base.hypertrophy = 0.4;
      base.endurance = 0.3;
      base.strength = 0.2;
    }
  } else if (periodizationType === "undulating") {
    if (mod3 === 0) {
      base.strength = 0.6;
      base.hypertrophy = 0.3;
    } else if (mod3 === 1) {
      base.hypertrophy = 0.6;
      base.endurance = primaryQuality === "endurance" ? 0.25 : 0.15;
    } else {
      base.power = 0.5;
      base.strength = 0.3;
      base.hypertrophy = 0.2;
    }
    if (phase === "deload") {
      base.strength *= 0.6;
      base.power *= 0.6;
      base.hypertrophy *= 0.8;
      base.endurance *= 1.1;
    }
  } else if (periodizationType === "block") {
    if (phase === "accumulation") {
      base.hypertrophy = 0.7;
      base.strength = 0.2;
    } else if (phase === "intensification") {
      base.strength = 0.7;
      base.hypertrophy = 0.2;
    } else if (phase === "transmutation") {
      base.power = 0.5;
      base.strength = 0.4;
    } else if (phase === "peak") {
      base.power = 0.6;
      base.strength = 0.3;
    } else if (phase === "deload") {
      base.hypertrophy = 0.4;
      base.endurance = 0.3;
    }
  }

  // daily undulation: лёгкий сдвиг по дням
  if (dayIndex === 0) {
    base.strength *= 1.05;
  } else if (dayIndex === daysPerWeek - 1) {
    base.endurance *= 1.1;
    base.hypertrophy *= 1.05;
  }

  // upper/lower bias
  if (isUpperDay) {
    base.strength *= 1.05;
    base.power *= 1.05;
  } else {
    base.hypertrophy *= 1.05;
    base.endurance *= 1.05;
  }

  const sum = base.strength + base.hypertrophy + base.power + base.endurance || 1;
  base.strength /= sum;
  base.hypertrophy /= sum;
  base.power /= sum;
  base.endurance /= sum;

  return base;
}

// ---------------------------------------------------------------------------
// ENERGY SYSTEM / BIOMECH BIAS
// ---------------------------------------------------------------------------

export type EnergySystem = "atp_pc" | "glycolytic" | "oxidative";

export function resolveEnergySystem(
  phase: MesocyclePhase,
  primaryQuality: string,
  qualityMix: QualityMix
): EnergySystem {
  const wave = ENERGY_WAVE[phase] || ENERGY_WAVE.accumulation;

  let es: EnergySystem = "glycolytic";

  if (primaryQuality === "endurance" || qualityMix.endurance > 0.4) {
    es = "oxidative";
  } else if (primaryQuality === "strength" || primaryQuality === "power") {
    es = "atp_pc";
  } else {
    // смешанный
    if (wave.atp_pc > wave.oxidative && wave.atp_pc > wave.glycolytic) es = "atp_pc";
    else if (wave.oxidative > wave.glycolytic) es = "oxidative";
    else es = "glycolytic";
  }

  return es;
}

export type BiomechBias = {
  lengthTension: string;
  torqueCurve: string;
  stiffness: string;
};

export function resolveBiomechBias(phase: MesocyclePhase): BiomechBias {
  return BIOMECH_BIAS[phase] || BIOMECH_BIAS.accumulation;
}

// ---------------------------------------------------------------------------
// CNS / NEURO REGULATION / SRA BIAS
// ---------------------------------------------------------------------------

export type CNSState = "up" | "down" | "neutral";

export function resolveCNSState(readiness: number, fatigue: number): CNSState {
  if (readiness > 0.8 && fatigue < 0.4) return "up";
  if (readiness < 0.4 || fatigue > 0.7) return "down";
  return "neutral";
}

export type NeuroRegulation = "facilitation" | "inhibition" | "neutral";

export function resolveNeuroRegulation(cnsState: CNSState): NeuroRegulation {
  if (cnsState === "up") return "facilitation";
  if (cnsState === "down") return "inhibition";
  return "neutral";
}

export type SRABias = "stimulus" | "adaptation" | "expression" | "recovery";

export function resolveSRABias(phase: MesocyclePhase): SRABias {
  if (phase === "accumulation") return "stimulus";
  if (phase === "intensification") return "adaptation";
  if (phase === "transmutation") return "expression";
  if (phase === "peak") return "expression";
  if (phase === "deload") return "recovery";
  return "stimulus";
}

// ---------------------------------------------------------------------------
// DAY CONTEXT
// ---------------------------------------------------------------------------

export interface DayContext {
  macroWeekIndex: number;
  mesoIndex: number;
  mesoWeekIndex: number;
  dayIndex: number;

  phase: MesocyclePhase;
  periodizationType: PeriodizationType;
  primaryQuality: string;
  qualityMix: QualityMix;

  intensityTarget: number;
  volumeTarget: number;

  cnsState: CNSState;
  neuroRegulation: NeuroRegulation;
  sraBias: SRABias;
  energySystem: EnergySystem;
  biomechBias: BiomechBias;

  readiness: number;
  fatigue: number;
  acwr: number;
  stress: number;
  sleepQuality: number;
}

export function buildDayContext(params: {
  macroWeekIndex: number;
  mesoIndex: number;
  mesoWeekIndex: number;
  dayIndex: number;
  phase: MesocyclePhase;
  periodizationType: PeriodizationType;
  primaryQuality: string;
  daysPerWeek: number;
  readiness: number;
  fatigue: number;
  acwr: number;
  stress: number;
  sleepQuality: number;
}): DayContext {
  const { phase, readiness, fatigue, acwr, stress, sleepQuality } = params;
  const phaseProfile = PHASE_LOAD_PROFILE[phase] || PHASE_LOAD_PROFILE.accumulation;

  const qualityMix = pickDayQualityMix(
    params.periodizationType,
    phase,
    params.dayIndex,
    params.daysPerWeek,
    params.primaryQuality
  );

  let baseIntensity = phaseProfile.intensity;
  let baseVolume = phaseProfile.volume;

  // readiness / fatigue / ACWR / stress / sleep модификация
  if (readiness < 0.4) {
    baseIntensity *= 0.9;
    baseVolume *= 0.85;
  } else if (readiness > 0.8) {
    baseIntensity *= 1.05;
  }

  if (fatigue > 0.7 || acwr > 1.4) {
    baseIntensity *= 0.9;
    baseVolume *= 0.8;
  }

  if (stress > 0.7) {
    baseIntensity *= 0.95;
    baseVolume *= 0.9;
  }

  if (sleepQuality < 0.5) {
    baseIntensity *= 0.95;
  }

  baseIntensity = clamp(baseIntensity, 0.4, 0.95);
  baseVolume = clamp(baseVolume, 0.3, 1.3);

  const cnsState = resolveCNSState(readiness, fatigue);
  const neuroRegulation = resolveNeuroRegulation(cnsState);
  const sraBias = resolveSRABias(phase);
  const energySystem = resolveEnergySystem(phase, params.primaryQuality, qualityMix);
  const biomechBias = resolveBiomechBias(phase);

  let blockType = "hypertrophy";
  if (qualityMix.strength > 0.5) blockType = "strength";
  else if (qualityMix.power > 0.4) blockType = "power";
  else if (qualityMix.endurance > 0.4) blockType = "endurance";

  return {
    macroWeekIndex: params.macroWeekIndex,
    mesoIndex: params.mesoIndex,
    mesoWeekIndex: params.mesoWeekIndex,
    dayIndex: params.dayIndex,

    phase,
    periodizationType: params.periodizationType,
    primaryQuality: params.primaryQuality,
    qualityMix,

    intensityTarget: baseIntensity,
    volumeTarget: baseVolume,

    cnsState,
    neuroRegulation,
    sraBias,
    energySystem,
    biomechBias,

    readiness,
    fatigue,
    acwr,
    stress,
    sleepQuality
  };
}

// ---------------------------------------------------------------------------
// MAIN: BUILD PERIODIZATION (MACRO → MESO → DAY)
// ---------------------------------------------------------------------------

export interface PeriodizationPlan {
  macroWeeks: number;
  periodizationType: PeriodizationType;
  primaryQuality: string;
  readiness: number;
  fatigue: number;
  acwr: number;
  acute: number;
  chronic: number;
  stress: number;
  sleepQuality: number;
  mesoCycles: MesoCycle[];
  weeks: Array<{
    weekIndex: number;
    phase: MesocyclePhase;
    mesoIndex: number;
    mesoWeekIndex: number;
    days: DayContext[];
  }>;
}

export function buildPeriodization(
  input: TrainingInput,
  trainingState: { history?: LoadHistory } = {}
): PeriodizationPlan {
  const macroWeeks = input.periodization?.weeks
    ? clamp(input.periodization.weeks, 4, 32)
    : DEFAULT_MACRO_WEEKS;

  const periodizationType = resolvePeriodizationType(input);
  const primaryQuality = resolvePrimaryQuality(input);
  const daysPerWeek = input.schedule?.daysPerWeek
    ? clamp(input.schedule.daysPerWeek, 1, 7)
    : 4;

  const readiness = calcReadiness(input);
  const { acute, chronic, acwr, fatigue } = calcFatigue(trainingState.history);

  const stress = safe(input.readiness?.stress, 0.5);
  const sleepQuality = safe(input.readiness?.sleepQuality, 0.7);

  const phaseMap = buildPhaseMap(macroWeeks);
  const mesoCycles = buildMesoCycles(
    macroWeeks,
    input.periodization?.mesoLength || 4
  );

  const weeks: PeriodizationPlan["weeks"] = [];

  for (let w = 0; w < macroWeeks; w++) {
    let phase = phaseMap[w];

    // нейро-адаптивный сдвиг фазы
    phase = applyReadinessGatesToPhase(
      phase,
      readiness,
      fatigue,
      acwr,
      stress,
      sleepQuality
    );

    const meso = mesoCycles.find((m) => w >= m.startWeek && w <= m.endWeek);
    const mesoIndex = meso ? meso.mesoIndex : 0;
    const mesoWeekIndex = meso ? w - meso.startWeek : 0;

    const days: DayContext[] = [];

    for (let d = 0; d < daysPerWeek; d++) {
      const dayCtx = buildDayContext({
        macroWeekIndex: w,
        mesoIndex,
        mesoWeekIndex,
        dayIndex: d,
        phase,
        periodizationType,
        primaryQuality,
        daysPerWeek,
        readiness,
        fatigue,
        acwr,
        stress,
        sleepQuality
      });

      days.push(dayCtx);
    }

    weeks.push({
      weekIndex: w,
      phase,
      mesoIndex,
      mesoWeekIndex,
      days
    });
  }

  return {
    macroWeeks,
    periodizationType,
    primaryQuality,
    readiness,
    fatigue,
    acwr,
    acute,
    chronic,
    stress,
    sleepQuality,
    mesoCycles,
    weeks
  };
}

// ---------------------------------------------------------------------------
// FLATTEN TO DAY-LEVEL CONTEXT (для rawPlan / ADV_METHODS)
// ---------------------------------------------------------------------------

export interface DayLevelContext {
  macroWeekIndex: number;
  weekIndex: number;
  mesoIndex: number;
  mesoWeekIndex: number;
  dayIndex: number;

  phase: MesocyclePhase;
  periodizationType: PeriodizationType;
  primaryQuality: string;
  qualityMix: QualityMix;

  intensityTarget: number;
  volumeTarget: number;

  cnsState: CNSState;
  neuroRegulation: NeuroRegulation;
  sraBias: SRABias;
  energySystem: EnergySystem;
  biomechBias: BiomechBias;

  readiness: number;
  fatigue: number;
  acwr: number;
  stress: number;
  sleepQuality: number;
}

export function buildDayLevelContextFromPeriodization(
  periodization: PeriodizationPlan
): DayLevelContext[] {
  const result: DayLevelContext[] = [];

  for (const week of periodization.weeks) {
    for (const day of week.days) {
      result.push({
        macroWeekIndex: day.macroWeekIndex,
        weekIndex: week.weekIndex,
        mesoIndex: day.mesoIndex,
        mesoWeekIndex: day.mesoWeekIndex,
        dayIndex: day.dayIndex,

        phase: day.phase,
        periodizationType: day.periodizationType,
        primaryQuality: day.primaryQuality,
        qualityMix: day.qualityMix,

        intensityTarget: day.intensityTarget,
        volumeTarget: day.volumeTarget,

        cnsState: day.cnsState,
        neuroRegulation: day.neuroRegulation,
        sraBias: day.sraBias,
        energySystem: day.energySystem,
        biomechBias: day.biomechBias,

        readiness: day.readiness,
        fatigue: day.fatigue,
        acwr: day.acwr,
        stress: day.stress,
        sleepQuality: day.sleepQuality
      });
    }
  }

  return result;
}