/**
 * phase-periodization.ts — Фазовая периодизация для ручного конструктора.
 * BB-фазы: accumulation (накопление) → intensification (интенсификация) → deload → peaking (пик).
 * Каждая фаза имеет свои RIR, объём, темп, распределение упражнений.
 * Прогрессия: вес растёт по неделям внутри фазы, RIR снижается.
 */
import { RIR_WAVE_PATTERNS, PCT_FOR_RIR, type ManualExercise, type ManualDay } from './types';
import { VOLUME_LANDMARKS_DB, type TrainingLevel, normLevel } from '../../../../engines/volume-landmarks.engine';

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
    tempo: '4-2-2-1',
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

/* ──────────── Распределение недель по фазам ──────────── */
export interface PhaseDistribution {
  phase: BBPhase;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  config: PhaseConfig;
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
 */
export function distributePhases(mesoLength: number, deloadFreq: number, goal: string): PhaseDistribution[] {
  const dist: PhaseDistribution[] = [];
  const deloadWeeks = new Set<number>();
  
  if (deloadFreq > 0) {
    for (let w = deloadFreq; w <= mesoLength; w += deloadFreq) {
      deloadWeeks.add(w);
    }
  }

  const hasPeak = goal === 'strength' || goal === 'powerlifting';
  const peakWeeks = hasPeak ? Math.min(2, Math.floor(mesoLength * 0.15)) : 0;

  // Активные недели (без делода)
  const activeWeeks: number[] = [];
  for (let w = 1; w <= mesoLength - peakWeeks; w++) {
    if (!deloadWeeks.has(w)) activeWeeks.push(w);
  }
  const totalActive = activeWeeks.length;

  // Половина на accum, половина на intens
  const accumEnd = totalActive > 1 ? Math.ceil(totalActive / 2) : 1;

  for (let w = 1; w <= mesoLength; w++) {
    if (deloadWeeks.has(w)) {
      dist.push({ phase: 'deload', startWeek: w, endWeek: w, weeks: [w], config: PHASE_CONFIGS.deload });
      continue;
    }
    if (w > mesoLength - peakWeeks) {
      dist.push({ phase: 'peaking', startWeek: w, endWeek: w, weeks: [w], config: PHASE_CONFIGS.peaking });
      continue;
    }
    // Определяем позицию среди активных недель
    const activeIdx = activeWeeks.indexOf(w);
    if (activeIdx < 0) continue;
    if (activeIdx < accumEnd) {
      dist.push({ phase: 'accumulation', startWeek: w, endWeek: w, weeks: [w], config: PHASE_CONFIGS.accumulation });
    } else {
      dist.push({ phase: 'intensification', startWeek: w, endWeek: w, weeks: [w], config: PHASE_CONFIGS.intensification });
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
export function getPhaseVolumeMult(phase: BBPhase): number {
  return PHASE_CONFIGS[phase]?.volumeMultiplier ?? 1.0;
}

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
 */
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
): ManualWeek[] {
  const dist = distributePhases(mesoLength, deloadFreq, goal);
  
  // Группируем распределение по фазам для отслеживания недели внутри фазы
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  const weeks: ManualWeek[] = dist.map((pd) => {
    const w = pd.startWeek;
    phaseWeekCounter[pd.phase] += 1;
    const phaseWeek = phaseWeekCounter[pd.phase];
    const rir = getRirForWeek(w, mesoLength, rirWaveKey, pd.phase, phaseWeek);
    const cfg = pd.config;
    const corrections: string[] = [];

    // Строим дни для этой недели: копируем структуру, но меняем RIR/вес/объём
    const weakSet = new Set(weakPoints);
    const days: ManualDay[] = baseDays.map((d, di) => {
      const exercises: ManualExercise[] = d.exercises.map((ex) => {
        const role = classifyExercise(ex);
        const rirAdj = role === 'primary' ? Math.max(0, rir - 1) : role === 'accessory' ? Math.min(5, rir + 1) : rir;
        const baseW = workMax[ex.group] || 80;
        const weight = calcPhaseWeight(baseW, w, pd.phase, phaseWeek, rirAdj);
        const isWeak = weakSet.has(ex.group);
        const volMult = (role === 'accessory' ? cfg.volumeMultiplier : cfg.volumeMultiplier * 1.15) * (isWeak ? 1.2 : 1);
        const sets = Math.max(1, Math.round(ex.sets * volMult));
        const reps = ex.reps;
        const rest = role === 'primary' ? Math.max(180, cfg.restBase + 60) : role === 'secondary' ? cfg.restBase + 30 : cfg.restBase;

        return {
          ...ex,
          sets,
          weight,
          rir: isWeak ? Math.max(0, rirAdj - 1) : rirAdj,
          rest,
          reps: reps,
          tempo: globalTempoStr || ex.tempo,
          note: isWeak ? '🎯 Слабая группа — акцент на объём и MMC' : ex.note,
        };
      });

      return { day: di + 1, groups: d.groups, exercises };
    });

    corrections.push(`${PHASE_LABELS[pd.phase]} — неделя ${w}: RIR ${rir}, объём ×${cfg.volumeMultiplier}, вес ×${cfg.intensityMultiplier}.`);

    return { weekNumber: w, phase: pd.phase, phaseLabel: PHASE_LABELS[pd.phase], rir, days, corrections };
  });

  return weeks;
}
