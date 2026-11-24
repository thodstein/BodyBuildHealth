/**
 * Analytics Domain — Core Analytics Engine
 *
 * Computes training metrics from logged session data:
 *  - Volume (weekly, per muscle group, per pattern)
 *  - Intensity (average %1RM, zone distribution)
 *  - Velocity trends
 *  - ROM analysis
 *  - Technique stability
 *  - Fatigue & Recovery
 *  - Strength trends (1RM progression)
 *  - Risk trends
 *
 * Pure functions — no state, no external dependencies.
 * Works in browser (Telegram Mini App).
 *
 * @module analytics-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════@@@@═════════════════════

export interface SetLogEntry {
  exerciseId: string;
  exerciseName: string;
  /** Группа мышц из записи (если источник её знает) — приоритетнее id-маппинга. */
  muscleGroup?: string;
  reps: number;
  weight: number;
  /** 0 = RPE не записан (не подставляем фейковое значение). */
  rpe: number;
  rir: number;
  velocity?: number;
  rom?: number;
  techniqueScore?: number;
  date: string;
  setIndex: number;
}

export interface SessionLogEntry {
  sessionId: string;
  date: string;
  focus: string;
  durationMin: number;
  sets: SetLogEntry[];
}

export interface AnalyticsInput {
  sessions: SessionLogEntry[];
  weeks: number;
  /** Опорный момент для «последней недели» (мс). По умолчанию Date.now(). */
  now?: number;
}

export interface VolumeMetrics {
  weeklyVolumeKg: number;
  weeklySets: number;
  weeklyReps: number;
  avgVolumePerSession: number;
  volumeByPattern: Record<string, number>;
  volumeByGroup: Record<string, number>;
  volumeTrend: number; // % change vs previous period; 0 когда базы нет
  /** Было ли предыдущее окно с тоннажом: без базы «↑0%» — выдумка, UI пишет «нет сравнения». */
  hasPreviousPeriod: boolean;
}

export interface IntensityMetrics {
  /** Средний измеренный RPE в процентах (RPE × 10); 0 — ни один подход не оценён.
   *  Раньше здесь было среднее по «зонам повторов» (85/70/55), и UI показывал это
   *  как «% интенсивности» — при отсутствии RPE это была выдумка. */
  avgIntensity: number;
  /** Зоны по числу повторов (без %1RM — его в дневнике нет). */
  intensityDistribution: {
    strength: number; // 1-6 reps
    hypertrophy: number; // 7-12 reps
    endurance: number; // 13+ reps
  };
  avgRPE: number;
  rpeDistribution: Record<string, number>; // RPE 5..10 counts
}

export interface StrengthMetrics {
  estimated1RM: Record<string, number>;
  strengthTrend: Record<string, number>; // % change vs last period; упражнения без базы в записи нет
  peakWeights: Record<string, number>;
  volumeByExercise: Record<string, { sets: number; reps: number; tonnage: number }>;
}

export interface FatigueMetrics {
  sessionFatigue: number;
  weeklyFatigue: number;
  monotony: number;
  strain: number;
  cnsFatigue: number; // based on avg RPE × sets
}

export interface RecoveryMetrics {
  recoveryScore: number;
  readinessEstimate: number;
}

export interface TechniqueMetrics {
  avgTechniqueScore: number;
  techniqueTrend: number;
  commonErrors: string[];
  romStability: number;
}

export interface VelocityMetrics {
  avgVelocity: number;
  peakVelocity: number;
  velocityLoss: number;
  velocityTrend: number;
}

export interface AnalyticsSnapshot {
  volume: VolumeMetrics;
  intensity: IntensityMetrics;
  strength: StrengthMetrics;
  fatigue: FatigueMetrics;
  recovery: RecoveryMetrics;
  technique: TechniqueMetrics;
  velocity: VelocityMetrics;
  weeklyBreakdown: WeeklyBreakdown[];
}

export interface WeeklyBreakdown {
  /** Бакет «7 дней от эпохи» (epoch/604800000), НЕ календарная ISO-неделя: границы —
   *  произвольные сутки (эпоха началась в четверг), номер не является «неделей года».
   *  Показывать это число как «нед. N» нельзя; для подписи нужно брать дату начала бакета. */
  week: number;
  sessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  avgIntensity: number;
  avgRPE: number;
  avgFatigue: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Muscle group mapping (exercise → primary group)
// ═══════════════════════════════════════════════════════════════════════════

const LEGACY_MUSCLE_GROUP_MAP: Record<string, string> = {
  back_squat: 'quads',
  front_squat: 'quads',
  leg_press: 'quads',
  leg_extension: 'quads',
  bench_press: 'chest',
  incline_bench: 'chest',
  dumbbell_bench: 'chest',
  deadlift: 'back',
  barbell_row: 'back',
  pull_up: 'back',
  lat_pulldown: 'back',
  seated_row: 'back',
  overhead_press: 'shoulders',
  lateral_raise: 'shoulders',
  face_pull: 'shoulders',
  bicep_curl: 'arms',
  tricep_extension: 'arms',
  romanian_deadlift: 'hamstrings',
  leg_curl: 'hamstrings',
  glute_bridge: 'glutes',
  calf_raise: 'calves',
  plank: 'core',
  hanging_leg_raise: 'core',
};

/** Актуальные id каталога (src/core/exercise-catalog.ts). */
const CATALOG_MUSCLE_GROUP_MAP: Record<string, string> = {
  bench_bar: 'chest',
  bench_db: 'chest',
  incline_bar: 'chest',
  incline_db: 'chest',
  dips_chest: 'chest',
  cable_fly: 'chest',
  pec_deck: 'chest',
  machine_chest_press: 'chest',
  pushup: 'chest',
  squat: 'quads',
  hack_squat: 'quads',
  squat_ssb: 'quads',
  goblet_squat: 'quads',
  lunge: 'quads',
  bulgarian_split: 'quads',
  walking_lunge: 'quads',
  leg_ext: 'quads',
  sissy_squat: 'quads',
  step_up_glute: 'quads',
  rdl: 'hamstrings',
  rdl_db: 'hamstrings',
  deadlift_romanian: 'hamstrings',
  good_morning: 'hamstrings',
  leg_curl_seated: 'hamstrings',
  leg_curl_standing: 'hamstrings',
  nordic_curl: 'hamstrings',
  hip_thrust: 'glutes',
  b_stance_hip_thrust: 'glutes',
  hip_abduction_machine: 'glutes',
  cable_kickback: 'glutes',
  back_ext_glute: 'glutes',
  calf_raise_seated: 'calves',
  calf_raise_standing: 'calves',
  calf_press_leg: 'calves',
  donkey_calf_raise: 'calves',
  pullup: 'back',
  chinup: 'back',
  pullup_neutral: 'back',
  pulldown: 'back',
  pulldown_rev: 'back',
  row_bar: 'back',
  row_tbar: 'back',
  row_db: 'back',
  sumo_dl: 'back',
  straight_pull: 'back',
  ohp: 'shoulders',
  ohp_seated: 'shoulders',
  db_press: 'shoulders',
  push_press: 'shoulders',
  rear_delt_fly: 'shoulders',
  rear_delt_machine: 'shoulders',
  face_pull_sh: 'shoulders',
  cable_lateral: 'shoulders',
  upright_row: 'shoulders',
  curl_bar: 'arms',
  curl_db: 'arms',
  hammer_curl: 'arms',
  preacher_curl: 'arms',
  incline_db_curl: 'arms',
  spider_curl: 'arms',
  cable_curl: 'arms',
  tricep_cable: 'arms',
  tricep_push: 'arms',
  rope_pushdown: 'arms',
  overhead_tricep_ext: 'arms',
  skullcrusher: 'arms',
  dips_tricep: 'arms',
  kickback: 'arms',
  tricep_pushdown_rope: 'arms',
  ab_rollout_feet: 'core',
  dragon_flag_v2: 'core',
  pallof_press_v3: 'core',
};

const MUSCLE_GROUP_MAP: Record<string, string> = {
  ...LEGACY_MUSCLE_GROUP_MAP,
  ...CATALOG_MUSCLE_GROUP_MAP,
};

function resolveMuscleGroup(set: SetLogEntry): string | null {
  if (set.muscleGroup) return set.muscleGroup;
  const id = set.exerciseId || '';
  return MUSCLE_GROUP_MAP[id] || MUSCLE_GROUP_MAP[id.toLowerCase()] || null;
}

const LEGACY_PATTERN_MAP: Record<string, string> = {
  back_squat: 'squat',
  front_squat: 'squat',
  leg_press: 'squat',
  bench_press: 'horizontal_push',
  incline_bench: 'horizontal_push',
  dumbbell_bench: 'horizontal_push',
  deadlift: 'hinge',
  romanian_deadlift: 'hinge',
  barbell_row: 'horizontal_pull',
  seated_row: 'horizontal_pull',
  pull_up: 'vertical_pull',
  lat_pulldown: 'vertical_pull',
  overhead_press: 'vertical_push',
  lateral_raise: 'accessory',
  bicep_curl: 'accessory',
  tricep_extension: 'accessory',
  leg_extension: 'accessory',
  leg_curl: 'accessory',
  calf_raise: 'accessory',
  plank: 'accessory',
};

/** Актуальные id каталога (src/core/exercise-catalog.ts). */
const CATALOG_PATTERN_MAP: Record<string, string> = {
  squat: 'squat',
  hack_squat: 'squat',
  squat_ssb: 'squat',
  goblet_squat: 'squat',
  lunge: 'squat',
  bulgarian_split: 'squat',
  walking_lunge: 'squat',
  bench_bar: 'horizontal_push',
  bench_db: 'horizontal_push',
  incline_bar: 'horizontal_push',
  incline_db: 'horizontal_push',
  dips_chest: 'horizontal_push',
  pushup: 'horizontal_push',
  rdl: 'hinge',
  rdl_db: 'hinge',
  sumo_dl: 'hinge',
  good_morning: 'hinge',
  row_bar: 'horizontal_pull',
  row_db: 'horizontal_pull',
  row_tbar: 'horizontal_pull',
  pullup: 'vertical_pull',
  chinup: 'vertical_pull',
  pulldown: 'vertical_pull',
  pulldown_rev: 'vertical_pull',
  ohp: 'vertical_push',
  ohp_seated: 'vertical_push',
  db_press: 'vertical_push',
  push_press: 'vertical_push',
  leg_ext: 'accessory',
  leg_curl_seated: 'accessory',
  leg_curl_standing: 'accessory',
  calf_raise_seated: 'accessory',
  hip_thrust: 'accessory',
  face_pull: 'accessory',
  face_pull_sh: 'accessory',
  cable_lateral: 'accessory',
  rear_delt_fly: 'accessory',
  upright_row: 'accessory',
  curl_bar: 'accessory',
  curl_db: 'accessory',
  hammer_curl: 'accessory',
  tricep_cable: 'accessory',
  tricep_push: 'accessory',
  rope_pushdown: 'accessory',
  ab_rollout_feet: 'accessory',
};

const PATTERN_MAP: Record<string, string> = {
  ...LEGACY_PATTERN_MAP,
  ...CATALOG_PATTERN_MAP,
};

function resolvePattern(set: SetLogEntry): string {
  const id = set.exerciseId || '';
  return PATTERN_MAP[id] || PATTERN_MAP[id.toLowerCase()] || 'accessory';
}

// ═══════════════════════════════════════════════════════════════════════════
// 1RM estimation
// ═══════════════════════════════════════════════════════════════════════════

function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  return weight * (1 + reps / 30);
}

// ═══════════════════════════════════════════════════════════════════════════
// Volume Analytics
// ═══════════════════════════════════════════════════════════════════════════

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function setTimestamp(set: SetLogEntry, sessionDate: string): number {
  // Дата подхода хранится как YYYY-MM-DD, а Date.parse даёт UTC-полночь: в UTC+3 сегодняшние
  // подходы до 03:00 выпадали из окна, а границы недели съезжали на смещение зоны.
  // Считаем в локальной зоне — так же, как недельные цели и остальные карточки дневника.
  const iso = String(set.date || sessionDate || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function computeVolume(
  sessions: SessionLogEntry[],
  prevSessions: SessionLogEntry[] = [],
  nowMs: number = Date.now(),
): VolumeMetrics {
  // «Объём за 7 дней» — честно за последние 7 дней, а не сумма по всей переданной истории.
  const weekStart = nowMs - WEEK_MS;
  const prevWeekStart = nowMs - 2 * WEEK_MS;
  let totalVolume = 0;
  let weekVolume = 0;
  let weekSets = 0;
  let weekReps = 0;
  const patternVol: Record<string, number> = {};
  const groupVol: Record<string, number> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      const vol = set.reps * set.weight;
      totalVolume += vol;

      const t = setTimestamp(set, sess.date);
      if (Number.isFinite(t) && t > weekStart && t <= nowMs) {
        weekVolume += vol;
        weekSets++;
        weekReps += set.reps;
      }

      const pattern = resolvePattern(set);
      patternVol[pattern] = (patternVol[pattern] || 0) + vol;

      // Неизвестный id не прячем молча в «other»: сначала группа из самой записи.
      const group = resolveMuscleGroup(set) || 'other';
      groupVol[group] = (groupVol[group] || 0) + vol;
    }
  }

  // Trend: previous 7-day window vs the last 7-day window
  let prevVolume = 0;
  for (const sess of prevSessions) {
    for (const set of sess.sets) {
      const t = setTimestamp(set, sess.date);
      if (Number.isFinite(t) && t > prevWeekStart && t <= weekStart) {
        prevVolume += set.reps * set.weight;
      }
    }
  }
  const volumeTrend = prevVolume > 0 ? ((weekVolume - prevVolume) / prevVolume) * 100 : 0;

  return {
    weeklyVolumeKg: Math.round(weekVolume),
    weeklySets: weekSets,
    weeklyReps: weekReps,
    avgVolumePerSession: sessions.length > 0 ? Math.round(totalVolume / sessions.length) : 0,
    volumeByPattern: patternVol,
    volumeByGroup: groupVol,
    volumeTrend: Math.round(volumeTrend),
    hasPreviousPeriod: prevVolume > 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Intensity Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeIntensity(sessions: SessionLogEntry[]): IntensityMetrics {
  let totalRPESets = 0;
  let sumRPE = 0;
  let strengthCount = 0;
  let hypertrophyCount = 0;
  let enduranceCount = 0;
  const rpeDist: Record<string, number> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.rpe > 0) {
        sumRPE += set.rpe;
        totalRPESets++;
        const rpeKey = String(Math.round(set.rpe));
        rpeDist[rpeKey] = (rpeDist[rpeKey] || 0) + 1;
      }

      // Зона — по числу повторов. Это не «% 1RM»: в дневнике %1RM нет, и подписывать
      // зону процентами интенсивности было бы выдумкой. Порядок зон — по reps.
      if (set.reps <= 6) {
        strengthCount++;
      } else if (set.reps <= 12) {
        hypertrophyCount++;
      } else {
        enduranceCount++;
      }
    }
  }

  const total = strengthCount + hypertrophyCount + enduranceCount || 1;

  return {
    // Только измеренный RPE: нет оценок — 0, а не «средняя зона» под видом процента.
    avgIntensity: totalRPESets > 0 ? Math.round((sumRPE / totalRPESets) * 10) : 0,
    intensityDistribution: {
      strength: Math.round((strengthCount / total) * 100),
      hypertrophy: Math.round((hypertrophyCount / total) * 100),
      endurance: Math.round((enduranceCount / total) * 100),
    },
    avgRPE: totalRPESets > 0 ? Math.round((sumRPE / totalRPESets) * 10) / 10 : 0,
    rpeDistribution: rpeDist,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Strength Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeStrength(sessions: SessionLogEntry[], prevSessions: SessionLogEntry[] = []): StrengthMetrics {
  const best1RMs: Record<string, { rm: number; date: string }> = {};
  const peakWeights: Record<string, number> = {};
  const volumeByEx: Record<string, { sets: number; reps: number; tonnage: number }> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      const exId = set.exerciseId;
      const estRM = epley1RM(set.weight, set.reps);

      if (!best1RMs[exId] || estRM > best1RMs[exId].rm) {
        best1RMs[exId] = { rm: estRM, date: set.date };
      }
      if (!peakWeights[exId] || set.weight > peakWeights[exId]) {
        peakWeights[exId] = set.weight;
      }

      if (!volumeByEx[exId]) {
        volumeByEx[exId] = { sets: 0, reps: 0, tonnage: 0 };
      }
      volumeByEx[exId].sets++;
      volumeByEx[exId].reps += set.reps;
      volumeByEx[exId].tonnage += set.reps * set.weight;
    }
  }

  // Previous 1RMs for trend
  const prevRMs: Record<string, number> = {};
  for (const sess of prevSessions) {
    for (const set of sess.sets) {
      const estRM = epley1RM(set.weight, set.reps);
      prevRMs[set.exerciseId] = Math.max(prevRMs[set.exerciseId] || 0, estRM);
    }
  }

  const strengthTrend: Record<string, number> = {};
  const estimated1RM: Record<string, number> = {};
  for (const [exId, data] of Object.entries(best1RMs)) {
    estimated1RM[exId] = Math.round(data.rm);
    const prevRM = prevRMs[exId];
    // Без прошлого окна сравнения нет: подстановка текущего значения давала «↑0%» —
    // выдуманный тренд. Нет базы — нет записи в strengthTrend.
    if (prevRM && prevRM > 0) strengthTrend[exId] = Math.round(((data.rm - prevRM) / prevRM) * 100);
  }

  return { estimated1RM, strengthTrend, peakWeights, volumeByExercise: volumeByEx };
}

// ═══════════════════════════════════════════════════════════════════════════
// Fatigue Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeFatigue(sessions: SessionLogEntry[]): FatigueMetrics {
  let totalRPESets = 0;
  let sumRPE = 0;
  let cnsLoad = 0;
  const dailyLoads: number[] = [];

  for (const sess of sessions) {
    let sessionLoad = 0;
    for (const set of sess.sets) {
      sessionLoad += set.reps * set.weight * (set.rpe / 10);
      if (set.rpe > 0) {
        sumRPE += set.rpe;
        totalRPESets++;
      }
      if (set.rpe >= 8 && set.reps <= 5) {
        cnsLoad += set.weight * set.rpe * 0.1;
      }
    }
    dailyLoads.push(sessionLoad);
  }

  const meanLoad = dailyLoads.length > 0 ? dailyLoads.reduce((s, v) => s + v, 0) / dailyLoads.length : 0;
  const variance =
    dailyLoads.length > 1 ? dailyLoads.reduce((s, v) => s + (v - meanLoad) ** 2, 0) / (dailyLoads.length - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const monotony = stdDev > 0 ? meanLoad / stdDev : 1;
  const weeklyLoad = dailyLoads.reduce((s, v) => s + v, 0);
  const strain = weeklyLoad * monotony * 0.01;

  const sessionFatigue =
    totalRPESets > 0 ? Math.min(1, sumRPE / totalRPESets / 10 + (dailyLoads.length / 7) * 0.3) : 0.3;
  const weeklyFatigue = Math.min(1, sessionFatigue * 1.2);

  return {
    sessionFatigue: Math.round(sessionFatigue * 100) / 100,
    weeklyFatigue: Math.round(weeklyFatigue * 100) / 100,
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    cnsFatigue: Math.round(Math.min(1, cnsLoad / 5000) * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Recovery + Technique + Velocity
// ═══════════════════════════════════════════════════════════════════════════

export function computeRecovery(fatigue: FatigueMetrics): RecoveryMetrics {
  const recoveryScore = Math.max(
    0,
    1 - fatigue.weeklyFatigue * 0.8 - fatigue.monotony * 0.1 - fatigue.cnsFatigue * 0.3,
  );
  return {
    recoveryScore: Math.round(recoveryScore * 100) / 100,
    readinessEstimate: Math.round(Math.max(0.2, recoveryScore * 0.9) * 100),
  };
}

export function computeTechnique(sessions: SessionLogEntry[]): TechniqueMetrics {
  let totalScore = 0;
  let count = 0;
  const errors: Record<string, number> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.techniqueScore !== undefined) {
        totalScore += set.techniqueScore;
        count++;
      }
      if (set.rom !== undefined && set.rom < 0.7) {
        errors['rom_deficit'] = (errors['rom_deficit'] || 0) + 1;
      }
    }
  }

  const avgScore = count > 0 ? totalScore / count : 0.7;
  const commonErrors = Object.entries(errors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  return {
    avgTechniqueScore: Math.round(avgScore * 100) / 100,
    techniqueTrend: 0,
    commonErrors,
    romStability: Math.round(Math.min(1, 1 - (errors['rom_deficit'] || 0) / (count || 1)) * 100) / 100,
  };
}

export function computeVelocity(sessions: SessionLogEntry[]): VelocityMetrics {
  const velocities: number[] = [];
  let peak = 0;

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.velocity !== undefined) {
        velocities.push(set.velocity);
        if (set.velocity > peak) peak = set.velocity;
      }
    }
  }

  const avg = velocities.length > 0 ? velocities.reduce((s, v) => s + v, 0) / velocities.length : 0;
  const first = velocities.length > 0 ? velocities[0] : 0;
  const last = velocities.length > 0 ? velocities[velocities.length - 1] : 0;
  const vLoss = first > 0 ? ((first - last) / first) * 100 : 0;

  return {
    avgVelocity: Math.round(avg * 100) / 100,
    peakVelocity: Math.round(peak * 100) / 100,
    velocityLoss: Math.round(vLoss),
    velocityTrend: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Weekly breakdown
// ═══════════════════════════════════════════════════════════════════════════

export function computeWeeklyBreakdown(sessions: SessionLogEntry[]): WeeklyBreakdown[] {
  const weeks: Record<number, SessionLogEntry[]> = {};

  for (const sess of sessions) {
    const date = new Date(sess.date);
    // Approximate week number from epoch
    const weekNum = Math.floor(date.getTime() / (7 * 24 * 3600 * 1000));
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(sess);
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, sessList]) => {
      let totalSets = 0,
        totalReps = 0,
        totalVol = 0,
        rpeSum = 0,
        rpeCount = 0;
      for (const sess of sessList) {
        for (const set of sess.sets) {
          totalSets++;
          totalReps += set.reps;
          totalVol += set.reps * set.weight;
          if (set.rpe > 0) {
            rpeSum += set.rpe;
            rpeCount++;
          }
        }
      }
      return {
        week: Number(week),
        sessions: sessList.length,
        totalSets,
        totalReps,
        totalVolume: Math.round(totalVol),
        avgIntensity: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) : 0,
        avgRPE: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : 0,
        avgFatigue: Math.round(Math.min(1, totalSets / 80 + (rpeCount > 0 ? rpeSum / rpeCount / 20 : 0)) * 100) / 100,
      };
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main pipeline
// ═══════════════════════════════════════════════════════════════════════════

export function computeAnalytics(input: AnalyticsInput): AnalyticsSnapshot {
  const nowMs = input.now ?? Date.now();
  // Окно — по датам, а не по числу сессий: `slice(-weeks * 7)` брал 28 последних
  // тренировок, что при 4 тренировках в неделю растягивало «4 недели» до 7.
  const spanMs = Math.max(0, Number(input.weeks) || 0) * WEEK_MS;
  const sessionTs = (s: SessionLogEntry): number => {
    const iso = String(s.date || '').slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return NaN;
    const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    return Number.isFinite(t) ? t : NaN;
  };
  const inCurrent = (s: SessionLogEntry) => {
    const t = sessionTs(s);
    // Запись без валидной даты не теряем: её нельзя отнести к окну, но и молча
    // выкидывать из истории силы нельзя. Будущие даты (кривой импорт, часовой пояс)
    // в «текущее» окно не пускаем — иначе они навсегда раздувают объём и усталость.
    return !Number.isFinite(t) || (t >= nowMs - spanMs && t <= nowMs + 86_400_000);
  };
  const inPrev = (s: SessionLogEntry) => {
    const t = sessionTs(s);
    return Number.isFinite(t) && t >= nowMs - 2 * spanMs && t < nowMs - spanMs;
  };
  const current = input.sessions.filter(inCurrent);
  const prev = input.sessions.filter(inPrev);
  // Тренд объёма — честное сравнение «последние 7 дней против предыдущих 7». Поэтому в
  // computeVolume идёт именно 7-дневное окно, а не весь предыдущий период weeks (иначе
  // неделя-сравнения лежала внутри `current`, и база для тренда всегда была пустой).
  const inVolumePrev = (s: SessionLogEntry) => {
    const t = sessionTs(s);
    return Number.isFinite(t) && t >= nowMs - 2 * WEEK_MS && t < nowMs - WEEK_MS;
  };
  const volumePrev = input.sessions.filter(inVolumePrev);

  const volume = computeVolume(current, volumePrev, nowMs);
  const intensity = computeIntensity(current);
  const strength = computeStrength(current, prev);
  const fatigue = computeFatigue(current);
  const recovery = computeRecovery(fatigue);
  const technique = computeTechnique(current);
  const velocity = computeVelocity(current);
  const weeklyBreakdown = computeWeeklyBreakdown(current);

  return {
    volume,
    intensity,
    strength,
    fatigue,
    recovery,
    technique,
    velocity,
    weeklyBreakdown,
  };
}
