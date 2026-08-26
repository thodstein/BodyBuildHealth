/**
 * phase-periodization.ts — Фазовая периодизация для ручного конструктора.
 * BB-фазы: accumulation (накопление) → intensification (интенсификация) → deload → peaking (пик).
 * Каждая фаза имеет свои RIR, объём, темп, распределение упражнений.
 * Прогрессия: вес растёт по неделям внутри фазы, RIR снижается.
 * Ротация упражнений: каждые N недель заменяет часть упражнений на альтернативы
 * из той же substitutionGroup (предотвращает адаптацию).
 */
import { RIR_WAVE_PATTERNS, PCT_FOR_RIR, type ManualExercise, type ManualDay } from './program-types';
import { VOLUME_LANDMARKS_DB, type TrainingLevel, normLevel } from '../../../engines/volume-landmarks.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { BBTrainingFocus } from '../../../engines/bb/bb-goal-types';
import { FOCUS_PHASE_OVERRIDES } from '../../../engines/bb/bb-goal-types';

/* ──────────── Типы фаз ──────────── */
export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
export const PHASES: BBPhase[] = ['accumulation', 'intensification', 'deload', 'peaking'];

export interface PhaseConfig {
  phase: BBPhase;
  label: string;
  rirRange: [number, number];
  volumeMultiplier: number;
  intensityMultiplier: number;
  repRange: [number, number];
  restBase: number;
  tempo: string;
  description: string;
  exerciseMix: { compoundPct: number; isolationPct: number; machinePct: number; cablePct: number; feederPct: number };
}

export const PHASE_CONFIGS: Record<BBPhase, PhaseConfig> = {
  accumulation: {
    phase: 'accumulation',
    label: 'Накопление',
    rirRange: [3, 1],
    volumeMultiplier: 1.0,
    intensityMultiplier: 0.75,
    repRange: [10, 15],
    restBase: 90,
    tempo: '3-1-1-0',
    description: 'Высокий объём, умеренные веса, метаболический стресс. Цель: гипертрофия, пампинг, накопление.',
    exerciseMix: { compoundPct: 0.35, isolationPct: 0.30, machinePct: 0.15, cablePct: 0.15, feederPct: 0.05 },
  },
  intensification: {
    phase: 'intensification',
    label: 'Интенсификация',
    rirRange: [2, 0],
    volumeMultiplier: 0.85,
    intensityMultiplier: 0.85,
    repRange: [6, 10],
    restBase: 120,
    tempo: '2-1-1-0',
    description: 'Умеренный объём, высокие веса, механическое натяжение. Цель: сила+масса.',
    exerciseMix: { compoundPct: 0.50, isolationPct: 0.15, machinePct: 0.20, cablePct: 0.10, feederPct: 0.05 },
  },
  deload: {
    phase: 'deload',
    label: 'Разгрузка',
    rirRange: [4, 4],
    volumeMultiplier: 0.5,
    intensityMultiplier: 0.55,
    repRange: [12, 20],
    restBase: 60,
    tempo: '3-1-1-0',
    description: 'Резкое снижение объёма и веса. Восстановление ЦНС и суставов.',
    exerciseMix: { compoundPct: 0.15, isolationPct: 0.30, machinePct: 0.20, cablePct: 0.25, feederPct: 0.10 },
  },
  peaking: {
    phase: 'peaking',
    label: 'Пик',
    rirRange: [1, 0],
    volumeMultiplier: 0.65,
    intensityMultiplier: 0.95,
    repRange: [3, 6],
    restBase: 180,
    tempo: '2-1-1-0',
    description: 'Минимальный объём, максимальные веса, RIR 0-1. Цель: выход на пик силы.',
    exerciseMix: { compoundPct: 0.55, isolationPct: 0.10, machinePct: 0.20, cablePct: 0.10, feederPct: 0.05 },
  },
};

export const PHASE_LABELS: Record<BBPhase, string> = {
  accumulation: 'Накопление',
  intensification: 'Интенсификация',
  deload: 'Разгрузка',
  peaking: 'Пик',
};

/**
 * Focus-специфичный конфиг фазы: базовый PHASE_CONFIGS + оверрайд по BBTrainingFocus.
 * Если focus не задан — инвариант (hypertrophy = базовые значения).
 */
export function getPhaseConfig(phase: BBPhase, focus?: BBTrainingFocus): PhaseConfig {
  const base = PHASE_CONFIGS[phase];
  if (!focus) return base;
  const override = FOCUS_PHASE_OVERRIDES[focus]?.[phase];
  if (!override) return base;
  return { ...base, ...override } as PhaseConfig;
}

/* ──────────── Распределение недель по фазам ──────────── */
export interface PhaseDistribution {
  phase: BBPhase;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  config: PhaseConfig;
}

/**
 * ПЛ-цели ручного конструктора и ПЛ-авто (4 канонические):
 *  - pl_endurance (Выносливость: GPP, work capacity, ОФП) — Verkhoshansky 1985 GPP block,
 *    Bompa 2019 anatomical adaptation: 60-70% ×10-20, RIR 3-5, rest 60-90, tempo 3-1-1-0,
 *    высокий объём (×1.0), низкая интенсивность (×0.65), частый делод (каждые 3 нед),
 *    подготовка сухожилий/техники перед тяжёлым блоком.
 *  - pl_strength (Сила: max strength) — Zatsiorsky 2021, Прилепин: 75-90% ×1-6, RIR 0-2,
 *    rest 180-300, tempo 2-0-1-0, volume ×0.85 в интенсификации, пик 1-3 повт.
 *  - pl_speed (Скорость/Координация: speed-strength, dynamic effort, RFD) —
 *    Zatsiorsky power zone 50-75% ×2-5 с акцентом на скорость, Siff/Verkhoshansky 2009
 *    speed-strength method, Simmons 2000 dynamic effort: RIR 4-5 (далеко от отказа),
 *    rest 120-180, tempo X (взрыв), включения: паузы/цепи/дефициты, техника.
 *  - pl_peaking (Выход на пик: taper + competition) — Bosquet 2007 taper meta:
 *    объём ×0.45-0.65, интенс ×0.97, RIR 0-1, rest 240+, singles 90-105%, mock meet,
 *    минимум аксессуаров, последние 2-3 нед — пик/тапер.
 *
 * ББ-цели (отличаются по источнику):
 *  - hypertrophy/mass (Масса) — Schoenfeld 2017 6-30 повт, Roberts 2022 RIR 0-3,
 *    Helms 2016: 10-20 сет/нед, deficit/surplus via nutrition, volume ×1.0, интенс ×0.75.
 *  - cut (Сушка) — Helms 2014: объём ×0.60-0.75 на дефиците, RIR 3-4, deload чаще.
 *  - recomp (Рекомпозиция) — умеренный объём, RIR 2-3, 60/40 accum/intens.
 *  - maintenance (Поддержание) — MEV 0.5×, редкий делод (6 нед), RIR 4.
 *  - strength_mass (Сила+масса, powerbuilding) — гибрид: объём как масса, интенс как сила, пик 2 нед.
 *  Различие источников: ПЛ-логика — SR cycles/periodization (Sir/Verk/Bompa), ББ-логика — Schoenfeld/Israetel/Helms.
 */

/** ПЛ-оверрайды фаз по 4 целям (источники выше). Применяются поверх PHASE_CONFIGS. */
export const PL_GOAL_PHASE_OVERRIDES: Record<string, Partial<Record<BBPhase, Partial<PhaseConfig>>>> = {
  pl_endurance: {
    accumulation:    { repRange: [12, 20], intensityMultiplier: 0.65, volumeMultiplier: 1.00, rirRange: [4, 3] as [number, number], restBase: 70, tempo: '3-1-1-0', description: 'Выносливость: GPP — высокий объём, 60-65% ×10-20, RIR 3-4, пауза 60-90с' },
    intensification: { repRange: [10, 15], intensityMultiplier: 0.70, volumeMultiplier: 0.90, rirRange: [3, 2] as [number, number], restBase: 90,  tempo: '3-1-1-0' },
    peaking:         { repRange: [6, 10],  intensityMultiplier: 0.75, volumeMultiplier: 0.75, rirRange: [2, 1] as [number, number], restBase: 120 },
    deload:          { repRange: [12, 20], intensityMultiplier: 0.55, volumeMultiplier: 0.50, restBase: 60 },
  },
  pl_strength: {
    accumulation:    { repRange: [6, 10], intensityMultiplier: 0.75, volumeMultiplier: 1.00, rirRange: [3, 1] as [number, number], restBase: 120, tempo: '2-1-1-0' },
    intensification: { repRange: [3, 6],  intensityMultiplier: 0.85, volumeMultiplier: 0.85, rirRange: [2, 0] as [number, number], restBase: 180, tempo: '2-0-1-0' },
    peaking:         { repRange: [1, 3],  intensityMultiplier: 0.95, volumeMultiplier: 0.55, rirRange: [1, 0] as [number, number], restBase: 240, tempo: '2-0-1-0' },
    deload:          { repRange: [5, 8],  intensityMultiplier: 0.60, volumeMultiplier: 0.40, restBase: 90 },
  },
  pl_speed: {
    accumulation:    { repRange: [5, 8], intensityMultiplier: 0.65, volumeMultiplier: 0.80, rirRange: [5, 4] as [number, number], restBase: 90,  tempo: '1-0-X-0', description: 'Скорость: 50-65% ×5-8 с акцентом на скорость, паузы/цепи/дефициты, RIR 4-5' },
    intensification: { repRange: [2, 5], intensityMultiplier: 0.68, volumeMultiplier: 0.75, rirRange: [5, 4] as [number, number], restBase: 120, tempo: '1-0-X-0' },
    peaking:         { repRange: [1, 3], intensityMultiplier: 0.75, volumeMultiplier: 0.60, rirRange: [4, 3] as [number, number], restBase: 150, tempo: '1-0-X-0' },
    deload:          { repRange: [8, 12], intensityMultiplier: 0.55, volumeMultiplier: 0.50, restBase: 90 },
  },
  pl_peaking: {
    accumulation:    { repRange: [5, 8], intensityMultiplier: 0.75, volumeMultiplier: 0.90, rirRange: [3, 1] as [number, number], restBase: 120 },
    intensification: { repRange: [3, 6], intensityMultiplier: 0.85, volumeMultiplier: 0.70, rirRange: [2, 0] as [number, number], restBase: 180 },
    peaking:         { repRange: [1, 3], intensityMultiplier: 0.97, volumeMultiplier: 0.45, rirRange: [1, 0] as [number, number], restBase: 240, tempo: '2-0-1-0', description: 'Пик: Bosquet taper — объём ×0.45, интенс ×0.97, RIR 0-1, singles 90-105%' },
    deload:          { repRange: [3, 5], intensityMultiplier: 0.60, volumeMultiplier: 0.35, restBase: 120 },
  },
};

/** Гибрид/повербилдер — третий ручной конструктор (PL+BB). Смесь PL-логики и BB-логики: объём как ББ (Israetel) + интенсивность как ПЛ (Bompa), PHUL/PHAT стиль. */
export const HYBRID_GOAL_PHASE_OVERRIDES: Record<string, Partial<Record<BBPhase, Partial<PhaseConfig>>>> = {
  pb_endurance: {
    accumulation:    { repRange: [10, 18], intensityMultiplier: 0.68, volumeMultiplier: 1.00, rirRange: [4, 3] as [number, number], restBase: 75, description: 'ПБ выносливость: функц. 10-18, 65-70%, многосет, RIR3-4' },
    intensification: { repRange: [8, 12],  intensityMultiplier: 0.73, volumeMultiplier: 0.90, rirRange: [3, 2] as [number, number], restBase: 90 },
    peaking:         { repRange: [6, 10],  intensityMultiplier: 0.78, volumeMultiplier: 0.75, rirRange: [2, 1] as [number, number], restBase: 120 },
    deload:          { repRange: [12, 18], intensityMultiplier: 0.55, volumeMultiplier: 0.50, restBase: 70 },
  },
  pb_strength: {
    accumulation:    { repRange: [6, 10], intensityMultiplier: 0.78, volumeMultiplier: 0.95, rirRange: [3, 1] as [number, number], restBase: 150, tempo: '2-1-1-0', description: 'ПБ сила: тяж 3-6 + памп 8-12, PHUL' },
    intensification: { repRange: [4, 8],  intensityMultiplier: 0.86, volumeMultiplier: 0.85, rirRange: [2, 0] as [number, number], restBase: 160 },
    peaking:         { repRange: [2, 5],  intensityMultiplier: 0.92, volumeMultiplier: 0.60, rirRange: [1, 0] as [number, number], restBase: 200 },
    deload:          { repRange: [8, 12], intensityMultiplier: 0.62, volumeMultiplier: 0.45, restBase: 90 },
  },
  pb_mass: {
    accumulation:    { repRange: [8, 15], intensityMultiplier: 0.75, volumeMultiplier: 1.00, rirRange: [3, 1] as [number, number], restBase: 90,  description: 'ПБ масса: 8-15, 70-80%, RIR1-3, объём как ББ но с базой 5×5' },
    intensification: { repRange: [6, 12], intensityMultiplier: 0.80, volumeMultiplier: 0.88, rirRange: [2, 1] as [number, number], restBase: 120 },
    peaking:         { repRange: [4, 8],  intensityMultiplier: 0.85, volumeMultiplier: 0.70, rirRange: [2, 0] as [number, number], restBase: 150 },
    deload:          { repRange: [12, 20], intensityMultiplier: 0.55, volumeMultiplier: 0.50, restBase: 70 },
  },
  pb_peaking: {
    accumulation:    { repRange: [6, 10], intensityMultiplier: 0.76, volumeMultiplier: 0.92, rirRange: [3, 1] as [number, number], restBase: 120 },
    intensification: { repRange: [3, 6],  intensityMultiplier: 0.88, volumeMultiplier: 0.75, rirRange: [2, 0] as [number, number], restBase: 180 },
    peaking:         { repRange: [1, 3],  intensityMultiplier: 0.96, volumeMultiplier: 0.50, rirRange: [1, 0] as [number, number], restBase: 220, description: 'ПБ пик: taper сила + сушка ББ, ×0.50/0.96' },
    deload:          { repRange: [5, 8],  intensityMultiplier: 0.60, volumeMultiplier: 0.40, restBase: 90 },
  },
};

/** ББ-цели (отличаются источником: Schoenfeld/Helms/Israetel, не Sir/Verk). Для документации — используются в BB-builder, тут только сводка. */
export const BB_MANUAL_GOALS = ['hypertrophy', 'mass', 'cut', 'recomp', 'maintenance', 'strength_mass', 'rehab'] as const;
export const PL_MANUAL_GOALS = ['pl_endurance', 'pl_strength', 'pl_speed', 'pl_peaking', 'rehab'] as const;
/** Гибрид/повербилдер — третий ручной конструктор (PL+BB). Источники: Helms + Israetel + Zatsiorsky powerbuilding blend (PHUL/PHAT). */
export const HYBRID_MANUAL_GOALS = ['pb_endurance', 'pb_strength', 'pb_mass', 'pb_peaking', 'rehab'] as const;

/** Нормализовать legacy/alias goal → канонический id (ПЛ 4 + ББ). */
export function normalizeManualGoal(goal: string): string {
  const g = (goal || '').toLowerCase().trim();
  if (['pb_endurance','pb_выносливость','гибрид_вынос'].includes(g)) return 'pb_endurance';
  if (['pb_strength','pb_сила','гибрид_сила','powerbuilder_strength'].includes(g)) return 'pb_strength';
  if (['pb_mass','pb_масса','гибрид_масса','powerbuilder_mass','гипертрофия_пб'].includes(g)) return 'pb_mass';
  if (['pb_peaking','pb_пик','гибрид_пик','powerbuilder_peak'].includes(g)) return 'pb_peaking';
  if (['pl_endurance','endurance','выносливость','gpp','офп'].includes(g)) return 'pl_endurance';
  if (['pl_strength','strength','max_strength','powerlifting','сила','силовая'].includes(g)) return 'pl_strength';
  if (['pl_speed','speed','speed_coordination','скорость','координация','скорость/координация'].includes(g)) return 'pl_speed';
  if (['pl_peaking','peaking','peak','пик','выход на пик'].includes(g)) return 'pl_peaking';
  // ББ-алиасы
  if (['hypertrophy','mass','масса','гипертрофия','бб_масса'].includes(g)) return 'hypertrophy';
  if (['cut','cutting','сушка','дефицит'].includes(g)) return 'cut';
  if (['recomp','рекомпозиция'].includes(g)) return 'recomp';
  if (['maintenance','поддержание'].includes(g)) return 'maintenance';
  if (['strength_mass','powerbuilding','bb_strength','сила+масса'].includes(g)) return 'strength_mass';
  if (['rehab','реабилитация'].includes(g)) return 'rehab';
  return g;
}
export function isPLManualGoal(goal: string): boolean {
  return ['pl_endurance','pl_strength','pl_speed','pl_peaking'].includes(normalizeManualGoal(goal));
}
export function isBBManualGoal(goal: string): boolean {
  return ['hypertrophy','mass','cut','recomp','maintenance','strength_mass'].includes(normalizeManualGoal(goal));
}
export function isHybridManualGoal(goal: string): boolean {
  return ['pb_endurance','pb_strength','pb_mass','pb_peaking'].includes(normalizeManualGoal(goal));
}

/**
 * Распределить N недель мезоцикла по фазам.
 * Правила распределения (тренерские): 
 * - accumulation: первая половина (кроме последней части)
 * - intensification: вторая половина (кроме последней части)
 * - deload: фиксированные недели (по deloadFreq)
 * - peaking: последние 1-2 недели (если цель strength/powerlifting)
 * @param mesoLength — длина мезоцикла
 * @param deloadFreq — частота делода (0=нет)
 * @param goal — цель (strength/powerlifting → peaking)
 * @param trainingFocus — фокус силы/гипертрофии/выносливости (оверрайд repRange/intensity)
 */
export function getPhaseConfigForGoal(phase: BBPhase, goal: string, focus?: BBTrainingFocus): PhaseConfig {
  const base = getPhaseConfig(phase, focus);
  const norm = normalizeManualGoal(goal);
  const plOverride = (PL_GOAL_PHASE_OVERRIDES as Record<string, Record<string, Partial<PhaseConfig>>>)[norm]?.[phase];
  if (plOverride) return { ...base, ...plOverride } as PhaseConfig;
  const hybOverride = (HYBRID_GOAL_PHASE_OVERRIDES as Record<string, Record<string, Partial<PhaseConfig>>>)[norm]?.[phase];
  if (hybOverride) return { ...base, ...hybOverride } as PhaseConfig;
  return base;
}

export function distributePhases(mesoLength: number, deloadFreq: number, goal: string, trainingFocus?: BBTrainingFocus): PhaseDistribution[] {
  const dist: PhaseDistribution[] = [];
  const normGoal = normalizeManualGoal(goal);
  // maintenance: редкий deload (6 нед), не 4 — MV-поддержка не требует частой разгрузки
  if (normGoal === 'maintenance' && deloadFreq === 4) deloadFreq = 6;
  // ПЛ/ПБ-выносливость: частый делод каждые 3 нед (GPP высокий объём, восстановление)
  if ((normGoal === 'pl_endurance' || normGoal === 'pb_endurance') && deloadFreq === 4) deloadFreq = 3;
  // ПЛ/ПБ-пик: делод каждые 3 нед (интенсивный стресс)
  if ((normGoal === 'pl_peaking' || normGoal === 'pb_peaking') && deloadFreq === 4) deloadFreq = 3;
  const deloadWeeks = new Set<number>();
  
  if (deloadFreq > 0) {
    for (let w = deloadFreq; w <= mesoLength; w += deloadFreq) {
      deloadWeeks.add(w);
    }
  }

  // Пик только для силы/пика (ПЛ, ПБ и ББ). Выносливость и скорость — без пика (подготовительный блок, Verkhoshansky)
  const hasPeak = ['pl_strength','pl_peaking','pb_strength','pb_peaking','pb_mass','strength_mass'].includes(normGoal) || goal === 'strength' || goal === 'powerlifting' || normGoal === 'strength_mass';
  // ПЛ/ПБ-пик: 3 недели пика при цикле >=8 нед (Bosquet 2007 extended taper), остальные 1-2; ПБ-масса/сила — 1-2н пика
  let peakWeeks = 0;
  if (hasPeak) {
    if (normGoal === 'pl_peaking' || normGoal === 'pb_peaking') peakWeeks = mesoLength >= 8 ? 3 : Math.min(2, Math.floor(mesoLength * 0.20));
    else peakWeeks = Math.min(2, Math.floor(mesoLength * 0.15));
  }

  // Активные недели (без делода)
  const activeWeeks: number[] = [];
  for (let w = 1; w <= mesoLength - peakWeeks; w++) {
    if (!deloadWeeks.has(w)) activeWeeks.push(w);
  }
  const totalActive = activeWeeks.length;

  // recomp 60/40 (accum/intens), выносливость 65/35 (больше GPP), скорость 55/45, остальные 50/50; ПБ — blend
  let accumRatio = 0.5;
  if (normGoal === 'recomp') accumRatio = 0.6;
  else if (normGoal === 'pl_endurance' || normGoal === 'pb_endurance') accumRatio = 0.65;
  else if (normGoal === 'pl_speed') accumRatio = 0.55;
  else if (normGoal === 'pl_strength' || normGoal === 'pb_strength') accumRatio = 0.50;
  else if (normGoal === 'pl_peaking' || normGoal === 'pb_peaking') accumRatio = 0.45; // пик: короче accumulation, дольше intens
  else if (normGoal === 'pb_mass') accumRatio = 0.55; // ПБ масса: чуть больше accum чем сила
  const accumEnd = totalActive > 1 ? Math.ceil(totalActive * accumRatio) : 1;

  for (let w = 1; w <= mesoLength; w++) {
    // P1-2: peaking проверяется ПЕРЕД deload — финальные недели peaking
    // не должны перекрываться регулярным deload (taper → peak, не deload → peak).
    if (w > mesoLength - peakWeeks) {
      dist.push({ phase: 'peaking', startWeek: w, endWeek: w, weeks: [w], config: getPhaseConfigForGoal('peaking', goal, trainingFocus) });
      continue;
    }
    if (deloadWeeks.has(w)) {
      dist.push({ phase: 'deload', startWeek: w, endWeek: w, weeks: [w], config: getPhaseConfigForGoal('deload', goal, trainingFocus) });
      continue;
    }
    // Определяем позицию среди активных недель
    const activeIdx = activeWeeks.indexOf(w);
    if (activeIdx < 0) continue;
    if (activeIdx < accumEnd) {
      dist.push({ phase: 'accumulation', startWeek: w, endWeek: w, weeks: [w], config: getPhaseConfigForGoal('accumulation', goal, trainingFocus) });
    } else {
      dist.push({ phase: 'intensification', startWeek: w, endWeek: w, weeks: [w], config: getPhaseConfigForGoal('intensification', goal, trainingFocus) });
    }
  }

  return dist;
}

/* ──────────── RIR по неделе ──────────── */
/**
 * Получить RIR для конкретной недели.
 * Учитывает: rirWave (по четвертям) + фазу (phaseConfig.rirRange) + позицию внутри фазы.
 */
export function getRirForWeek(week: number, mesoLength: number, rirWaveKey: string, phase: BBPhase, phaseWeek: number): number {
  const wave = RIR_WAVE_PATTERNS[rirWaveKey];
  const qLen = Math.ceil(mesoLength / 4);
  const quarter = Math.min(3, Math.floor((week - 1) / qLen));
  const waveRir = wave ? wave.rirByQuarter[quarter] : 2;

  // Корректировка по фазе
  const phaseCfg = PHASE_CONFIGS[phase];
  const [startRir, endRir] = phaseCfg.rirRange;
  const drift = Math.min(startRir - endRir, Math.floor(phaseWeek / 2));
  const phaseRir = Math.max(endRir, startRir - drift);

  // Среднее между волной и фазой
  return Math.round((waveRir + phaseRir) / 2);
}

/* ──────────── Вес с прогрессией ──────────── */
/**
 * Рассчитать вес для недели с прогрессией.
 * Прогрессия внутри фазы: +2.5% каждую неделю от базового веса.
 */
export function calcPhaseWeight(baseWeight: number, week: number, phase: BBPhase, phaseWeek: number, rir: number): number {
  const cfg = PHASE_CONFIGS[phase];
  const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, rir))] ?? 0.85;
  const phaseProgression = Math.max(0, (phaseWeek - 1) * 0.025);
  const weight = baseWeight * cfg.intensityMultiplier * (1 + phaseProgression) * pct;
  return Math.round(weight);
}

/* ──────────── Дельта веса для primary/secondary упражнений ──────────── */
export type ExerciseRole = 'primary' | 'secondary' | 'accessory';

export function classifyExercise(ex: ManualExercise): ExerciseRole {
  const rest = ex.rest || 120;
  if (rest >= 150) return 'primary';
  if (rest >= 90) return 'secondary';
  return 'accessory';
}

/* ──────────── Per-muscle MRV ──────────── */
/**
 * Получить MRV для конкретной мышцы из volume-landmarks.engine.
 * С учётом курса (PED) и лабораторной коррекции.
 */
export function getPerMuscleMrv(muscle: string, level: string, onCourse: boolean, courseIntensity: string, labMultiplier: number): { mev: number; mav: number; mrv: number } {
  const lvl = normLevel(level);
  const data = VOLUME_LANDMARKS_DB[lvl];
  // Map old group names to canonical
  const mMap: Record<string, string> = {
    chest: 'chest', back: 'back', legs: 'quads', shoulders: 'shoulders',
    arms: 'biceps', core: 'abs', quads: 'quads', hamstrings: 'hamstrings',
    glutes: 'glutes', calves: 'calves', biceps: 'biceps', triceps: 'triceps',
    delt_front: 'delt_front', delt_mid: 'delt_mid', delt_rear: 'delt_rear',
    abs: 'abs', traps: 'traps', forearms: 'forearms',
  };
  const canon = mMap[muscle] || muscle;
  const landmarks = data?.[canon] ?? { mev: 6, mav: 10, mrv: 15 };
  const courseMult = onCourse ? (courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
  return {
    mev: landmarks.mev,
    mav: landmarks.mav,
    mrv: Math.round(landmarks.mrv * courseMult * labMultiplier),
  };
}

/* ──────────── Volume multiplier по фазе ──────────── */
export function getPhaseVolumeMult(phase: BBPhase, focus?: BBTrainingFocus): number {
  return getPhaseConfig(phase, focus).volumeMultiplier ?? 1.0;
}

/* ──────────── DUP: недельная вариация повторений ──────────── */

/**
 * Вычислить диапазон повторений для конкретной недели фазы.
 * Ранние недели → больше повторений (метаболический стресс),
 * поздние → меньше (механическое натяжение).
 * Принцип Daily Undulating Periodization, адаптированный под недельный блок.
 */
export function getDupReps(config: PhaseConfig, phaseWeek: number, totalPhaseWeeks: number): string {
  const [min, max] = config.repRange;
  if (totalPhaseWeeks <= 1) return `${min}-${max}`;
  const ratio = Math.min(1, (phaseWeek - 1) / (totalPhaseWeeks - 1));
  const target = max - Math.round(ratio * (max - min));
  const lo = Math.max(min, target - 2);
  const hi = Math.min(max, target + 2);
  return lo >= hi ? `${lo}` : `${lo}-${hi}`;
}

/* ──────────── Волна объёма внутри фазы ──────────── */

/**
 * Волновой множитель объёма для конкретной недели внутри фазы.
 * Паттерн Israetel (RP Strength): средняя → высокая → низкая → средняя.
 *
 * Неделя 1: 1.00 (база/адаптация)
 * Неделя 2: 1.15 (перегрузка)
 * Неделя 3: 0.75 (восстановление)
 * Неделя 4: 1.05 (консолидация)
 * Циклы повторяются с +2.5% на базу (прогрессивная перегрузка).
 */
export function getVolumeWaveFactor(phaseWeek: number, phase: BBPhase): number {
  if (phase === 'deload') return 0.5;
  const cycle = (phaseWeek - 1) % 4;
  const cycleNum = Math.floor((phaseWeek - 1) / 4);
  const base = 1.0 + cycleNum * 0.025;
  const wave = [1.0, 1.15, 0.75, 1.05][cycle];
  return base * wave;
}

/* ──────────── Делод по цели ──────────── */

interface DeloadOverride {
  volumeMultiplier: number;
  intensityMultiplier: number;
  repRange: [number, number];
  label: string;
}

export function getDeloadOverride(goal: string): DeloadOverride {
  const norm = normalizeManualGoal(goal);
  // ПЛ 4 цели — раздельные протоколы делода (Verkhoshansky/Bompa)
  if (norm === 'pl_strength') {
    return { volumeMultiplier: 0.30, intensityMultiplier: 0.85, repRange: [1, 3], label: 'интенсивный (сила ПЛ, тяж. делод)' };
  }
  if (norm === 'pl_endurance') {
    return { volumeMultiplier: 0.45, intensityMultiplier: 0.55, repRange: [10, 15], label: 'восстановительный (выносливость, GPP)' };
  }
  if (norm === 'pl_speed') {
    return { volumeMultiplier: 0.50, intensityMultiplier: 0.60, repRange: [3, 5], label: 'технический (скорость, паузы/цепи)' };
  }
  if (norm === 'pl_peaking') {
    return { volumeMultiplier: 0.25, intensityMultiplier: 0.65, repRange: [1, 2], label: 'тапер (пик, Bosquet ×0.25)' };
  }
  // ПБ гибрид — гибридные делоды (Helms+Israetel+Zatsiorsky)
  if (norm === 'pb_endurance') {
    return { volumeMultiplier: 0.48, intensityMultiplier: 0.55, repRange: [12, 18], label: 'восстановительный (ПБ выносл.)' };
  }
  if (norm === 'pb_strength') {
    return { volumeMultiplier: 0.38, intensityMultiplier: 0.75, repRange: [3, 6], label: 'силовой (ПБ сила, PHUL)' };
  }
  if (norm === 'pb_mass') {
    return { volumeMultiplier: 0.45, intensityMultiplier: 0.55, repRange: [12, 20], label: 'объёмный (ПБ масса)' };
  }
  if (norm === 'pb_peaking') {
    return { volumeMultiplier: 0.35, intensityMultiplier: 0.70, repRange: [2, 4], label: 'тапер (ПБ пик, сила+сушка)' };
  }
  if (norm === 'strength' || goal === 'powerlifting') {
    return { volumeMultiplier: 0.30, intensityMultiplier: 0.85, repRange: [1, 3], label: 'интенсивный (сила)' };
  }
  if (norm === 'hypertrophy' || goal === 'mass' || goal === 'bulk') {
    return { volumeMultiplier: 0.40, intensityMultiplier: 0.50, repRange: [12, 20], label: 'объёмный (масса)' };
  }
  if (norm === 'cut') {
    return { volumeMultiplier: 0.35, intensityMultiplier: 0.40, repRange: [15, 25], label: 'активный (сушка)' };
  }
  return { volumeMultiplier: 0.50, intensityMultiplier: 0.55, repRange: [12, 20], label: 'стандартный' };
}

/**

/* ──────────── Построить многонедельный план ──────────── */
export interface ManualWeek {
  weekNumber: number;
  phase: BBPhase;
  phaseLabel: string;
  rir: number;
  days: ManualDay[];
  corrections: string[];
}

/**
 * Построить план на ВСЕ недели мезоцикла с учётом фаз.
 * @param baseDays — дни из генератора (сплит/упражнения, неделя 1)
 * @param mesoLength — длина мезоцикла
 * @param deloadFreq — частота делода
 * @param goal — цель
 * @param rirWaveKey — ключ волны RIR
 * @param level — уровень
 * @param onCourse — на курсе?
 * @param courseIntensity — интенсивность курса
 * @param labMultiplier — лабораторный множитель MRV
 * @param workMax — рабочие максимумы
 * @param weakPoints — слабые группы
 * @param globalTempoStr — глобальный темп
 * @param rotationFreq — частота ротации (нед), 0 = откл
 * @param rotationEnabled — включить ротацию
 */
/* ──────────── Ротация упражнений (anti-адаптация) ──────────── */

/**
 * Детерминированный random от seed (0..1).
 * Используется вместо Math.random() для воспроизводимости плана.
 */
function seededRandom(weekNum: number, dayIdx: number, exIdx: number): number {
  const h = ((weekNum * 31 + dayIdx * 17 + exIdx * 7) * 2654435761) >>> 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Применить ротацию упражнений к плану.
 * Каждые rotationFreq недель заменяет ~30% compounds и ~50% isolations
 * на альтернативы из той же substitutionGroup.
 * Детерминировано — при одном seed даёт одинаковый результат.
 * @param weeks          — сгенерированные недели
 * @param rotationFreq   — частота ротации (каждые N недель, 0 = откл)
 * @param equipment      — доступное оборудование
 * @returns обновлённые недели
 */
export function applyExerciseRotation(
  weeks: ManualWeek[],
  rotationFreq: number = 3,
  equipment: string[] = [],
): ManualWeek[] {
  const weekCount = weeks.length;
  if (rotationFreq < 1) return weeks;

  const rotateWeeks = new Set<number>();
  for (let w = rotationFreq; w <= weekCount; w += rotationFreq) rotateWeeks.add(w);
  if (rotateWeeks.size === 0) return weeks;

  // swapPool: для каждого substitutionGroup — доступные альтернативы
  const poolCache = new Map<string, Set<string>>();
  for (const ex of EXERCISE_CATALOG) {
    if (!ex.substitutionGroup) continue;
    if (!poolCache.has(ex.substitutionGroup)) poolCache.set(ex.substitutionGroup, new Set());
    poolCache.get(ex.substitutionGroup)!.add(ex.name);
  }

  return weeks.map((w) => {
    if (!rotateWeeks.has(w.weekNumber)) return w;

    const days = w.days.map((d, di) => {
      const dayNames = new Set(d.exercises.map(e => e.name));
      const exercises = d.exercises.map((ex, ei) => {
        const rnd = seededRandom(w.weekNumber, di, ei);
        const isCompound = ex.role === 'main' || ex.role === 'secondary';
        const swapChance = isCompound ? 0.3 : 0.5;
        if (rnd > swapChance) return ex;

        // Найти catalog-запись
        const orig = EXERCISE_CATALOG.find(e => e.name === ex.name);
        if (!orig || !orig.substitutionGroup) return ex;

        const pool = poolCache.get(orig.substitutionGroup);
        if (!pool || pool.size < 2) return ex;

        // Выбрать альтернативу, не используемую в этом дне
        const alts = [...pool].filter(n => n !== ex.name && !dayNames.has(n));
        if (alts.length === 0) return ex;

        // Фильтр по оборудованию
        const eqFiltered = equipment.length > 0
          ? alts.filter(n => EXERCISE_CATALOG.find(e => e.name === n)?.equipment && equipment.includes(EXERCISE_CATALOG.find(e => e.name === n)!.equipment))
          : alts;
        const candidates = eqFiltered.length > 0 ? eqFiltered : alts;

        const pickIdx = Math.floor(seededRandom(w.weekNumber, di, ei + 100) * candidates.length);
        const pick = candidates[pickIdx];
        dayNames.delete(ex.name);
        dayNames.add(pick);
        const catalogEx = EXERCISE_CATALOG.find(e => e.name === pick);
        return {
          ...ex,
          name: pick,
          equipment: catalogEx?.equipment || ex.equipment,
          substitutionGroup: catalogEx?.substitutionGroup || ex.substitutionGroup,
          jointStress: catalogEx?.jointStress || ex.jointStress,
          fatigueCost: catalogEx?.fatigueCost || ex.fatigueCost,
        };
      });
      return { ...d, exercises };
    });
    const corr = `Неделя ${w.weekNumber}: ротация упражнений (цикл ${rotationFreq} нед).`;
    return { ...w, days, corrections: [...w.corrections, corr] };
  });
}

export function buildPhasePlan(
  baseDays: ManualDay[],
  mesoLength: number,
  deloadFreq: number,
  goal: string,
  rirWaveKey: string,
  level: string,
  onCourse: boolean,
  courseIntensity: string,
  labMultiplier: number,
  workMax: Record<string, number>,
  weakPoints: string[] = [],
  globalTempoStr?: string,
  rotationFreq: number = 3,
  rotationEnabled: boolean = true,
  addFinalDeload: boolean = false,
): ManualWeek[] {
  const dist = distributePhases(mesoLength, deloadFreq, goal);
  if (addFinalDeload) {
    dist.push({ phase: 'deload', startWeek: mesoLength + 1, endWeek: mesoLength + 1, weeks: [mesoLength + 1], config: PHASE_CONFIGS.deload });
  }
  
  // Подсчёт общего числа недель в каждой фазе (для DUP-повторений)
  const phaseTotals: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };
  dist.forEach(pd => { phaseTotals[pd.phase] = (phaseTotals[pd.phase] || 0) + 1; });
  
  // Группируем распределение по фазам для отслеживания недели внутри фазы
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  // Процент accessory-упражнений для сохранения (изоляции/кабели) — по фазам
  const ACCESSORY_RETENTION: Record<string, number> = {
    accumulation: 1.0,     // все изоляции
    intensification: 0.50, // половина изоляций
    deload: 1.0,          // все (лёгкая работа)
    peaking: 0.0,         // никаких изоляций
  };

  const weeks: ManualWeek[] = dist.map((pd) => {
    const w = pd.startWeek;
    phaseWeekCounter[pd.phase] += 1;
    const phaseWeek = phaseWeekCounter[pd.phase];
    const rir = getRirForWeek(w, mesoLength, rirWaveKey, pd.phase, phaseWeek);
    const cfg = pd.phase === 'deload'
      ? { ...pd.config, ...getDeloadOverride(goal) }
      : pd.config;
    const corrections: string[] = [];
    const retainRatio = ACCESSORY_RETENTION[pd.phase] ?? 1.0;
    const waveFactor = getVolumeWaveFactor(phaseWeek, pd.phase);

    // Строим дни для этой недели: фильтруем упражнения по фазе + меняем RIR/вес/объём/темп
    const weakSet = new Set(weakPoints);
    const days: ManualDay[] = baseDays.map((d, di) => {
      // Фазовая фильтрация: compounds всегда, isolations — по retainRatio
      const kept: ManualExercise[] = [];
      let accCount = 0;
      for (const ex of d.exercises) {
        const isAccessory = (ex.role === 'accessory');
        if (isAccessory) {
          accCount++;
          // В peaking: убираем все изоляции
          if (pd.phase === 'peaking') continue;
          // В intensification: убираем половину изоляций (чётные)
          if (pd.phase === 'intensification' && accCount % 2 === 0) continue;
        }
        // В deload: compounds → минимальный объём, isolations остаются
        if (pd.phase === 'deload' && !isAccessory && ex.rest >= 150) {
          // Primary compound → делаем лёгкий вариант или убираем
          // Оставляем с минимальным объёмом (×0.4)
        }

        const role = classifyExercise(ex);
        const rirAdj = role === 'primary' ? Math.max(0, rir - 1) : role === 'accessory' ? Math.min(5, rir + 1) : rir;
        const baseW = workMax[ex.group] || 80;
        const roleWeightMult = role === 'secondary' ? 0.85 : 1.0;
        const weight = Math.round(calcPhaseWeight(baseW, w, pd.phase, phaseWeek, rirAdj) * roleWeightMult);
        const isWeak = weakSet.has(ex.group);
        const volMult = (role === 'accessory' ? cfg.volumeMultiplier : cfg.volumeMultiplier * 1.15) * (isWeak ? 1.2 : 1) * waveFactor;
        const sets = Math.max(1, Math.round(ex.sets * volMult));
        const reps = getDupReps(cfg, phaseWeek, phaseTotals[pd.phase] || 1);
        // Отдых: база = fatigueCost × 20с, минимум = restBase фазы
        const fatigueRest = (ex.fatigueCost || 5) * 20;
        const rest = Math.max(cfg.restBase, fatigueRest);

        // Прогрессивная разминка: чем ближе к workMax, тем больше подходов
        const wmForWarmup = workMax[ex.group] || 80;
        const weightPct = wmForWarmup > 0 ? weight / wmForWarmup : 0;
        const warmupSets = role === 'accessory' ? 1 : weightPct >= 0.90 ? 4 : weightPct >= 0.80 ? 3 : weightPct >= 0.60 ? 2 : 1;

        // Детальная схема разминки
        const warmupScheme: { pct: number; reps: number; weight: number }[] = [];
        if (warmupSets >= 1) warmupScheme.push({ pct: 0.50, reps: 8, weight: Math.round(wmForWarmup * 0.50) });
        if (warmupSets >= 2) warmupScheme.push({ pct: 0.65, reps: 5, weight: Math.round(wmForWarmup * 0.65) });
        if (warmupSets >= 3) warmupScheme.push({ pct: 0.80, reps: 3, weight: Math.round(wmForWarmup * 0.80) });
        if (warmupSets >= 4) warmupScheme.push({ pct: 0.90, reps: 2, weight: Math.round(wmForWarmup * 0.90) });
        // Back-off сеты: для mass/hypertrophy цели в accumulation/интенсификации
        const backoffSets = (role !== 'accessory' && (goal === 'mass' || goal === 'bulk' || goal === 'hypertrophy') && pd.phase !== 'deload' && pd.phase !== 'peaking') ? 2 : 0;

        kept.push({
          ...ex,
          sets,
          weight,
          rir: isWeak ? Math.max(0, rirAdj - 1) : rirAdj,
          rest,
          reps: reps,
          tempo: globalTempoStr || cfg.tempo || ex.tempo,
          warmupSets,
          backoffSets,
          warmupScheme: warmupScheme.length > 0 ? warmupScheme : undefined,
          backoffWeight: backoffSets > 0 ? Math.round(weight * 0.80) : undefined,
          note: isWeak ? 'Слабая группа — акцент на объём и MMC' : ex.note,
        });
      }

        // sRPE: ориентир интенсивности сессии: базовый RPE фазы × волна
        const phaseBaseRpe = pd.phase === 'accumulation' ? 6 : pd.phase === 'intensification' ? 8 : pd.phase === 'deload' ? 3 : 9;
        const sessionRpe = Math.max(1, Math.min(10, Math.round(phaseBaseRpe * waveFactor)));
        const rpeLabel = sessionRpe <= 3 ? 'лёгкая' : sessionRpe <= 5 ? 'умеренная' : sessionRpe <= 7 ? 'тяжёлая' : 'очень тяжёлая';

        // Оценка длительности: sum(сеты × (отдых + 30с)) + 10 мин разминка
        const totalWorkSec = kept.reduce((s, ex) => s + ex.sets * ((ex.rest || 90) + 30), 0);
        const warmupSec = kept.some(e => (e.role !== 'accessory')) ? 600 : 300;
        const estimatedMin = Math.round((totalWorkSec + warmupSec) / 60);

      return { day: di + 1, groups: d.groups, exercises: kept, sRPE: { rpe: sessionRpe, label: rpeLabel }, estimatedMin };
    });

    // Тоннаж недели: sum(сеты × вес × среднее повторений)
    const weekTonnage = Math.round(days.reduce((sum, d) => sum + d.exercises.reduce((s, ex) => {
      const repAvg = ex.reps.includes('-') ? (parseInt(ex.reps) + parseInt(ex.reps.split('-')[1] || ex.reps)) / 2 : parseInt(ex.reps) || 10;
      return s + ex.sets * ex.weight * repAvg;
    }, 0), 0));

    const phaseName = PHASE_LABELS[pd.phase];
    const dupRepsSample = getDupReps(cfg, phaseWeek, phaseTotals[pd.phase] || 1);
    const waveLabel = waveFactor > 1.1 ? '▲ пик' : waveFactor < 0.9 ? '▼ разгруз' : '— норма';
    corrections.push(`${phaseName} — нед ${w}: RIR ${rir}, повт ${dupRepsSample}, волна ${waveLabel}, объём ×${cfg.volumeMultiplier}, вес ×${cfg.intensityMultiplier}.`);
    if (pd.phase === 'peaking') corrections.push('Пик: изолирующие упражнения убраны, только базовые движения.');
    if (pd.phase === 'deload') {
      const dt = getDeloadOverride(goal);
      corrections.push(`Разгрузка (${dt.label}): объём ×${dt.volumeMultiplier}, вес ×${dt.intensityMultiplier}.`);
    }
    if (pd.phase === 'intensification') corrections.push('Интенсификация: изоляции сокращены, упор на базовые движения.');

    return { weekNumber: w, phase: pd.phase, phaseLabel: phaseName, rir, days, corrections, totalTonnage: weekTonnage };
  });

  // Пост-процесс: ротация упражнений для предотвращения адаптации
  if (rotationEnabled && rotationFreq > 0 && rotationFreq < mesoLength) {
    return applyExerciseRotation(weeks, rotationFreq);
  }

  return weeks;
}
