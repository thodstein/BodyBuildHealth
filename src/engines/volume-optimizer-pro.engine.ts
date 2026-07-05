/**
 * volume-optimizer-pro.engine.ts — Профессиональный движок расчёта и оптимизации объёма.
 *
 * Реализует:
 *  1. SFR-экономику упражнений (Stimulus-to-Fatigue Ratio)
 *  2. SRA-анализ (Stimulus-Recovery-Adaptation) по группам мышц
 *  3. CNS-оценка усталости ЦНС
 *  4. Оценка качества сплита (SplitQualityScore 0-100)
 *  5. Планировщик прогрессии объёма по неделям (мезоцикл)
 *  6. Экономика тренировки: эффективность, покрытие, дубли
 *  7. Рекомендации по замене упражнений на основе SFR
 *
 * Источники: Israetel (RP), Schoenfeld, Helms, Tuchscherer (RTS).
 */

import { EXERCISE_CATALOG, getExerciseById } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { getVolumeLandmarks, getAllVolumeLandmarks, normLevel, normMuscle, checkVolumeStatus } from './volume-landmarks.engine';
import type { MuscleVolumeLandmarks, TrainingLevel } from './volume-landmarks.engine';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProExerciseRow {
  id: string;
  exerciseId: string;
  week: number;       // 1-based week in mesocycle
  day: number;        // 1-7
  weight: number;     // kg
  reps: number;
  sets: number;
  rpe?: number;       // 5-10
  oneRM?: number;
}

export interface SFRProfile {
  stimulus: number;         // 0-100 — hypertrophic stimulus
  localFatigue: number;     // 0-100 — local muscle fatigue
  systemicFatigue: number;  // 0-100 — CNS/systemic cost
  sfrRatio: number;         // stimulus / (localFatigue + systemicFatigue) — higher = better
  tier: 'S' | 'A' | 'B' | 'C'; // SFR tier
  bestFor: string;
}

export interface MuscleVolumeProAnaly {
  muscle: string;
  muscleRu: string;
  currentSets: number;
  mev: number;
  mav: number;
  mrv: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv';
  compoundSets: number;
  isolationSets: number;
  heavySets: number;          // sets ≥85% 1RM
  recoveryHoursEst: number;   // estimated recovery needed
  optimalFreq: number;        // optimal sessions/week
  currentFreq: number;
  avgSFR: number;             // average SFR ratio for selected exercises
  efficiencyScore: number;    // 0-100
  actionableTips: string[];
}

export interface CNSFatigueReport {
  totalCNSScore: number;      // weighted CNS fatigue
  heavyCompoundSets: number;
  heavyIsolationSets: number;
  maxRecommended: number;      // before deload needed
  warning: string | null;
  recommendation: string;
}

export interface RecoveryCapacityReport {
  totalWeeklySets: number;
  estimatedMaxRecoverable: number;
  utilizationPercent: number;
  systemicFatigue: number;
  localFatigueByMuscle: Record<string, number>;
  deloadRecommended: boolean;
  deloadReason: string | null;
}

export interface VolumeProgressionPlan {
  weeks: { weekIndex: number; phase: string; phaseRu: string; targetTotalSets: number; intensityZone: string; rirTarget: number; setsByMuscle: Record<string, number>; }[];
  totalWeeks: number;
  progressionModel: string;
}

export interface SplitQualityScore {
  overall: number;
  volumeDistribution: number;
  frequencyOptimization: number;
  exerciseSelection: number;
  intensityManagement: number;
  recoveryBalance: number;
  compoundIsolationRatio: number;
  issues: string[];
  strengths: string[];
}

export interface ExerciseSwapRec {
  currentExerciseId: string;
  currentName: string;
  currentSFR: number;
  betterOptions: { exerciseId: string; name: string; sfr: number; muscleMatch: number; reason: string; }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SFR DATABASE — Профессиональная оценка стимул/усталость
// ═══════════════════════════════════════════════════════════════════════════

/** SFR-профили для ключевых паттернов движений.
 *  stimulus: гипертрофический стимул для целевой мышцы (0-100)
 *  localFatigue: локальная мышечная усталость (0-100)
 *  systemicFatigue: системная/ЦНС усталость (0-100)
 *  sfrRatio = stimulus / (localFatigue + systemicFatigue)
 */
const SFR_DB: Record<string, SFRProfile> = {
  // ── Грудь ──
  bench_bar:       { stimulus: 85, localFatigue: 55, systemicFatigue: 60, sfrRatio: 0, tier: 'B', bestFor: 'Сила + масса груди/трицепса' },
  bench_db:        { stimulus: 90, localFatigue: 45, systemicFatigue: 35, sfrRatio: 0, tier: 'A', bestFor: 'Масса груди, ROM, баланс' },
  incline_bar:     { stimulus: 80, localFatigue: 50, systemicFatigue: 50, sfrRatio: 0, tier: 'B', bestFor: 'Верх груди, сила' },
  incline_db:      { stimulus: 88, localFatigue: 40, systemicFatigue: 30, sfrRatio: 0, tier: 'A', bestFor: 'Верх груди, масса' },
  dips_chest:      { stimulus: 82, localFatigue: 60, systemicFatigue: 50, sfrRatio: 0, tier: 'B', bestFor: 'Низ груди, трицепс' },
  fly_db:          { stimulus: 65, localFatigue: 30, systemicFatigue: 10, sfrRatio: 0, tier: 'A', bestFor: 'Растяжение груди, изоляция' },
  cable_fly:       { stimulus: 70, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Пиковое сокращение, пампинг' },
  pec_deck:        { stimulus: 65, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Безопасная изоляция груди' },

  // ── Спина ──
  deadlift:        { stimulus: 70, localFatigue: 60, systemicFatigue: 95, sfrRatio: 0, tier: 'C', bestFor: 'Общая сила, задняя цепь' },
  pullup:          { stimulus: 90, localFatigue: 55, systemicFatigue: 45, sfrRatio: 0, tier: 'A', bestFor: 'Ширина спины, V-образ' },
  pulldown:        { stimulus: 82, localFatigue: 35, systemicFatigue: 15, sfrRatio: 0, tier: 'A', bestFor: 'Широчайшие, объём' },
  row_bar:         { stimulus: 85, localFatigue: 60, systemicFatigue: 50, sfrRatio: 0, tier: 'B', bestFor: 'Толщина спины, сила' },
  row_db:          { stimulus: 80, localFatigue: 35, systemicFatigue: 20, sfrRatio: 0, tier: 'A', bestFor: 'Односторонняя, толщина' },
  seated_row:      { stimulus: 78, localFatigue: 30, systemicFatigue: 15, sfrRatio: 0, tier: 'A', bestFor: 'Центр спины, объём' },
  face_pull:       { stimulus: 55, localFatigue: 20, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Здоровье плеч, задняя дельта' },
  straight_pull:   { stimulus: 60, localFatigue: 25, systemicFatigue: 10, sfrRatio: 0, tier: 'A', bestFor: 'Изоляция широчайших' },

  // ── Ноги ──
  squat:           { stimulus: 95, localFatigue: 75, systemicFatigue: 90, sfrRatio: 0, tier: 'C', bestFor: 'Масса ног, сила, гормон' },
  front_squat:     { stimulus: 88, localFatigue: 65, systemicFatigue: 70, sfrRatio: 0, tier: 'B', bestFor: 'Квадрицепсы, кор' },
  hack_squat:      { stimulus: 85, localFatigue: 55, systemicFatigue: 35, sfrRatio: 0, tier: 'A', bestFor: 'Квадрицепсы, безопасно' },
  leg_press:       { stimulus: 82, localFatigue: 50, systemicFatigue: 25, sfrRatio: 0, tier: 'A', bestFor: 'Масса ног, безопасно' },
  rdl:             { stimulus: 85, localFatigue: 55, systemicFatigue: 45, sfrRatio: 0, tier: 'A', bestFor: 'Задняя цепь, бицепс бедра' },
  lunge:           { stimulus: 75, localFatigue: 60, systemicFatigue: 50, sfrRatio: 0, tier: 'B', bestFor: 'Баланс, ягодицы, квадры' },
  bulgarian_split: { stimulus: 80, localFatigue: 65, systemicFatigue: 45, sfrRatio: 0, tier: 'B', bestFor: 'Односторонняя, квадры' },
  leg_ext:         { stimulus: 60, localFatigue: 35, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Изоляция квадрицепсов' },
  leg_curl:        { stimulus: 60, localFatigue: 30, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Изоляция бицепса бедра' },
  hip_thrust:      { stimulus: 78, localFatigue: 40, systemicFatigue: 25, sfrRatio: 0, tier: 'A', bestFor: 'Ягодицы, сила' },
  calf_raise:      { stimulus: 45, localFatigue: 35, systemicFatigue: 5,  sfrRatio: 0, tier: 'A', bestFor: 'Икры, выносливость' },

  // ── Плечи ──
  ohp:             { stimulus: 82, localFatigue: 55, systemicFatigue: 55, sfrRatio: 0, tier: 'B', bestFor: 'Сила плеч, трицепс' },
  lateral_raise:   { stimulus: 65, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Ширина плеч, средняя дельта' },
  rear_delt_fly:   { stimulus: 55, localFatigue: 20, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Задняя дельта, осанка' },
  upright_row:     { stimulus: 60, localFatigue: 35, systemicFatigue: 25, sfrRatio: 0, tier: 'B', bestFor: 'Трапеции, средняя дельта' },

  // ── Руки ──
  barbell_curl:    { stimulus: 65, localFatigue: 35, systemicFatigue: 15, sfrRatio: 0, tier: 'A', bestFor: 'Бицепс, сила' },
  db_curl:         { stimulus: 62, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Бицепс, баланс' },
  hammer_curl:     { stimulus: 55, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'A', bestFor: 'Брахиалис, предплечья' },
  preacher_curl:   { stimulus: 68, localFatigue: 40, systemicFatigue: 10, sfrRatio: 0, tier: 'A', bestFor: 'Пик бицепса, изоляция' },
  cgbp:            { stimulus: 78, localFatigue: 45, systemicFatigue: 35, sfrRatio: 0, tier: 'B', bestFor: 'Трицепс, сила' },
  pushdown:        { stimulus: 60, localFatigue: 25, systemicFatigue: 5,  sfrRatio: 0, tier: 'S', bestFor: 'Трицепс, изоляция' },
  overhead_ext:    { stimulus: 65, localFatigue: 30, systemicFatigue: 10, sfrRatio: 0, tier: 'A', bestFor: 'Длинная головка трицепса' },
};

// Calculate SFR ratios
for (const key of Object.keys(SFR_DB)) {
  const p = SFR_DB[key];
  p.sfrRatio = p.stimulus / (p.localFatigue + p.systemicFatigue + 0.001);
}

// Exact exercise ID match or fuzzy match from catalog
function resolveExerciseId(rawId: string): string | null {
  if (SFR_DB[rawId]) return rawId;
  const ex = getExerciseById(rawId) as Exercise | undefined;
  if (!ex) return null;

  // Try common mappings
  const name = (ex.name || '').toLowerCase();
  const group = ex.group;

  // Fuzzy match by name keyword
  const keywords: Record<string, string[]> = {
    'squat': ['squat', 'присед'], 'front_squat': ['front', 'фронт'],
    'hack_squat': ['hack', 'гакк'], 'leg_press': ['leg_press', 'жим ногами'],
    'bench_bar': ['жим штанги', 'bench_bar', 'жим лёжа'], 'bench_db': ['жим гантелей лёжа', 'bench_db'],
    'incline_bar': ['наклон', 'incline_bar'], 'incline_db': ['наклон', 'incline_db'],
    'dips_chest': ['брусь', 'dips_chest'], 'fly_db': ['разводка', 'fly_db'],
    'cable_fly': ['кроссовер', 'сведение', 'cable_fly'], 'pec_deck': ['butterfly', 'pec_deck'],
    'deadlift': ['тяга становая', 'deadlift'], 'pullup': ['подтягивани', 'pullup'],
    'pulldown': ['тяга верхнего', 'pulldown'], 'row_bar': ['тяга штанги', 'row_bar'],
    'row_db': ['тяга гантели', 'row_db'], 'seated_row': ['тяга горизонтального', 'seated_row'],
    'face_pull': ['face_pull', 'к лицу'], 'rdl': ['румынск', 'rdl'],
    'lunge': ['выпад', 'lunge'], 'bulgarian_split': ['болгарск', 'bulgarian'],
    'leg_ext': ['разгибани', 'leg_ext'], 'leg_curl': ['сгибани', 'leg_curl'],
    'hip_thrust': ['ягодичный', 'hip_thrust'], 'calf_raise': ['икро', 'calf_raise'],
    'ohp': ['жим над головой', 'ohp', 'армейский'], 'lateral_raise': ['махи', 'lateral_raise'],
    'rear_delt_fly': ['задн', 'rear_delt'], 'barbell_curl': ['сгибание рук со штангой', 'barbell_curl'],
    'db_curl': ['сгибание гантел', 'db_curl'], 'hammer_curl': ['молот', 'hammer_curl'],
    'preacher_curl': ['скамья скотта', 'preacher_curl'],
    'cgbp': ['узким хватом', 'cgbp'], 'pushdown': ['разгибани', 'pushdown', 'трицепс блок'],
    'overhead_ext': ['французский', 'overhead'],
  };

  for (const [sfrKey, kwds] of Object.entries(keywords)) {
    if (kwds.some(k => name.includes(k))) return sfrKey;
  }

  // Fallback: use group-based generic SFR
  if (ex.type === 'compound') {
    if (group === 'legs') return 'squat';
    if (group === 'chest') return 'bench_bar';
    if (group === 'back') return 'row_bar';
    if (group === 'shoulders') return 'ohp';
    if (group === 'arms') return 'barbell_curl';
  } else {
    if (group === 'legs') return 'leg_ext';
    if (group === 'chest') return 'cable_fly';
    if (group === 'back') return 'face_pull';
    if (group === 'shoulders') return 'lateral_raise';
    if (group === 'arms') return 'pushdown';
  }
  return null;
}

export function getSFRProfile(exerciseId: string): SFRProfile | null {
  const key = resolveExerciseId(exerciseId);
  if (!key || !SFR_DB[key]) return null;
  return { ...SFR_DB[key] };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. MUSCLE GROUP RUSSIAN NAMES
// ═══════════════════════════════════════════════════════════════════════════

const MUSCLE_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи',
  arms: 'Руки', core: 'Кор', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра',
  biceps: 'Бицепс', triceps: 'Трицепс', calves: 'Икры', glutes: 'Ягодицы',
  abs: 'Пресс', forearms: 'Предплечья',
};

export function muscleRu(en: string): string { return MUSCLE_RU[en] || en; }

// ═══════════════════════════════════════════════════════════════════════════
// 3. PRO ANALYSIS PER MUSCLE
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeMuscleVolumePro(
  entries: ProExerciseRow[],
  level: TrainingLevel,
  muscle: string,
): MuscleVolumeProAnaly | null {
  const lm = getVolumeLandmarks(level, muscle);
  if (!lm) return null;

  const muscleEntries = entries.filter(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    return ex?.group === muscle || normMuscle(ex?.group || '') === muscle;
  });

  let currentSets = 0, compoundSets = 0, isolationSets = 0, heavySets = 0;
  let totalSFR = 0, sfrCount = 0;
  const daysSeen = new Set<number>();

  muscleEntries.forEach(e => {
    currentSets += e.sets;
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    const type = ex?.type || 'isolation';
    if (type === 'compound') compoundSets += e.sets;
    else isolationSets += e.sets;

    const oneRM = e.oneRM && e.oneRM > 0 ? e.oneRM : 100;
    if (e.weight / oneRM >= 0.85) heavySets += e.sets;

    const sfr = getSFRProfile(e.exerciseId);
    if (sfr) { totalSFR += sfr.sfrRatio * e.sets; sfrCount += e.sets; }

    daysSeen.add(e.day);
  });

  const status = checkVolumeStatus(currentSets, lm);
  const avgSFR = sfrCount > 0 ? totalSFR / sfrCount : 0;

  // Recovery estimation (hours) — based on volume and intensity
  const recoveryHours = Math.round(currentSets * 4 + heavySets * 8 + compoundSets * 3);
  const optimalFreq = currentSets <= lm.mev ? 2 : currentSets <= lm.mav ? 2 : 1.5;

  // Efficiency score: how well are we using our sets?
  const volScore = status === 'optimal' ? 100 : status === 'approaching_mrv' ? 70 : status === 'below_mev' ? 30 : 10;
  const sfrScore = Math.min(100, avgSFR * 60);
  const compRatio = currentSets > 0 ? compoundSets / currentSets : 0;
  const ratioScore = compRatio >= 0.4 && compRatio <= 0.7 ? 100 : 80;
  const efficiencyScore = Math.round(volScore * 0.4 + sfrScore * 0.35 + ratioScore * 0.25);

  // Actionable tips
  const tips: string[] = [];
  if (status === 'below_mev') {
    tips.push(`Добавьте ${lm.mev - currentSets} подходов для выхода на MEV`);
  } else if (status === 'exceeding_mrv') {
    tips.push(`Сократите на ${currentSets - lm.mrv} подходов — превышен MRV`);
  } else if (status === 'approaching_mrv') {
    tips.push(`Объём близок к MRV — следите за восстановлением`);
  }
  if (heavySets > currentSets * 0.5) {
    tips.push('Слишком много тяжёлых подходов (>50%) — снизьте интенсивность части подходов');
  }
  if (compRatio < 0.3 && currentSets > 0) {
    tips.push('Мало базовых упражнений — добавьте 1-2 компаунда для стимула');
  }
  if (compRatio > 0.8 && currentSets > 0) {
    tips.push('Слишком много базы — добавьте изоляцию для целевой проработки');
  }
  if (currentFreq(muscleEntries) === 1 && currentSets > lm.mav * 0.8) {
    tips.push('Большой объём в 1 день — разнесите на 2 сессии для лучшего восстановления');
  }

  return {
    muscle, muscleRu: muscleRu(muscle),
    currentSets, mev: lm.mev, mav: lm.mav, mrv: lm.mrv, status,
    compoundSets, isolationSets, heavySets,
    recoveryHoursEst: recoveryHours,
    optimalFreq, currentFreq: daysSeen.size,
    avgSFR, efficiencyScore,
    actionableTips: tips,
  };
}

function currentFreq(entries: ProExerciseRow[]): number {
  return new Set(entries.map(e => e.day)).size;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. CNS FATIGUE REPORT
// ═══════════════════════════════════════════════════════════════════════════

export function computeCNSFatigue(entries: ProExerciseRow[]): CNSFatigueReport {
  let totalScore = 0;
  let heavyCompound = 0;
  let heavyIsolation = 0;

  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    const oneRM = e.oneRM && e.oneRM > 0 ? e.oneRM : 100;
    const isHeavy = e.weight / oneRM >= 0.85;
    const isCompound = ex?.type === 'compound';

    if (isHeavy && isCompound) {
      heavyCompound += e.sets;
      totalScore += e.sets * 5;
    } else if (isHeavy) {
      heavyIsolation += e.sets;
      totalScore += e.sets * 2;
    } else if (isCompound) {
      totalScore += e.sets * 2;
    } else {
      totalScore += e.sets * 0.5;
    }
  });

  const maxRec = 80;
  let warning: string | null = null;
  let recommendation = 'Нагрузка на ЦНС в пределах нормы';

  if (totalScore > maxRec * 1.3) {
    warning = 'КРИТИЧЕСКАЯ нагрузка на ЦНС — запланируйте разгрузку';
    recommendation = 'Сократите тяжёлые подходы на 40-50%, уберите становую/присед на неделю';
  } else if (totalScore > maxRec) {
    warning = 'Высокая нагрузка на ЦНС — контролируйте восстановление';
    recommendation = 'Снизьте число тяжёлых компаунд-подходов, добавьте 1 день отдыха';
  } else if (totalScore > maxRec * 0.7) {
    recommendation = 'Умеренная нагрузка — следите за сном и питанием';
  }

  return { totalCNSScore: totalScore, heavyCompoundSets: heavyCompound, heavyIsolationSets: heavyIsolation, maxRecommended: maxRec, warning, recommendation };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. RECOVERY CAPACITY REPORT
// ═══════════════════════════════════════════════════════════════════════════

export function computeRecoveryCapacity(entries: ProExerciseRow[], level: TrainingLevel): RecoveryCapacityReport {
  const totalSets = entries.reduce((s, e) => s + e.sets, 0);
  const allLandmarks = getAllVolumeLandmarks(level);
  let totalMRV = 0;
  for (const lm of Object.values(allLandmarks)) totalMRV += lm.mrv;

  const levelMultiplier = level === 'beginner' ? 0.8 : level === 'intermediate' ? 1.0 : level === 'enhanced' ? 1.3 : 1.15;
  const maxRecoverable = Math.round(totalMRV * levelMultiplier * 0.7); // ~70% of total MRV sum
  const utilization = maxRecoverable > 0 ? Math.round((totalSets / maxRecoverable) * 100) : 0;

  // Local fatigue by muscle
  const localFatigue: Record<string, number> = {};
  const muscleSets: Record<string, number> = {};
  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!ex) return;
    const m = ex.group;
    muscleSets[m] = (muscleSets[m] || 0) + e.sets;
  });
  for (const [m, sets] of Object.entries(muscleSets)) {
    const lm = allLandmarks[normalizeMuscleForLM(m)] || { mrv: 20 };
    localFatigue[m] = Math.round((sets / lm.mrv) * 100);
  }

  // Systemic fatigue from CNS + total volume
  const cns = computeCNSFatigue(entries);
  const systemicFatigue = Math.round((cns.totalCNSScore / cns.maxRecommended) * 50 + (utilization / 100) * 50);

  let deloadRecommended = false;
  let deloadReason: string | null = null;
  if (utilization > 100) { deloadRecommended = true; deloadReason = `Объём превышает расчётный максимум восстановления (${utilization}%)`; }
  else if (systemicFatigue > 85) { deloadRecommended = true; deloadReason = 'Высокая системная усталость — необходим делод'; }

  return { totalWeeklySets: totalSets, estimatedMaxRecoverable: maxRecoverable, utilizationPercent: utilization, systemicFatigue, localFatigueByMuscle: localFatigue, deloadRecommended, deloadReason };
}

function normalizeMuscleForLM(group: string): string {
  const map: Record<string, string> = { chest: 'chest', back: 'back', legs: 'quads', shoulders: 'shoulders', arms: 'biceps', core: 'abs' };
  return map[group] || group;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. VOLUME PROGRESSION PLANNER
// ═══════════════════════════════════════════════════════════════════════════

export function planVolumeProgression(
  entries: ProExerciseRow[],
  level: TrainingLevel,
  totalWeeks: number,
): VolumeProgressionPlan {
  const muscleSets: Record<string, number> = {};
  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!ex) return;
    const m = ex.group;
    muscleSets[m] = (muscleSets[m] || 0) + e.sets;
  });

  const allLM = getAllVolumeLandmarks(level);
  const phases: { weekIndex: number; phase: string; phaseRu: string; intensityZone: string; rirTarget: number; volMultiplier: number }[] = [];

  // Standard RP-style mesocycle: accumulation (MEV→MRV) → deload
  const accumWeeks = Math.min(totalWeeks - 1, Math.max(3, totalWeeks - 1));
  for (let w = 0; w < accumWeeks; w++) {
    const progress = accumWeeks > 1 ? w / (accumWeeks - 1) : 0;
    // Volume ramps from ~MEV+20% to ~MRV-10%
    const volMult = 0.7 + progress * 0.4;
    const rirTarget = Math.round(3 - progress * 1.5); // RIR 3 → 1-2
    const intensity = rirTarget >= 3 ? '60-75% 1RM' : rirTarget >= 2 ? '70-82% 1RM' : '78-88% 1RM';
    phases.push({
      weekIndex: w, phase: 'accumulation', phaseRu: `Накопление (нед ${w + 1})`,
      intensityZone: intensity, rirTarget, volMultiplier: volMult,
    });
  }

  // Deload week
  if (accumWeeks < totalWeeks) {
    phases.push({
      weekIndex: accumWeeks, phase: 'deload', phaseRu: 'Разгрузка',
      intensityZone: '50-65% 1RM', rirTarget: 4, volMultiplier: 0.4,
    });
  }

  const weeks = phases.map(p => {
    const setsByMuscle: Record<string, number> = {};
    for (const [muscle, baseSets] of Object.entries(muscleSets)) {
      const lm = allLM[normalizeMuscleForLM(muscle)] || { mev: 8, mav: 12, mrv: 20 };
      const target = Math.round(lm.mev + (lm.mrv - lm.mev) * p.volMultiplier);
      setsByMuscle[muscleRu(muscle)] = Math.min(target, lm.mrv);
    }
    const totalTarget = Object.values(setsByMuscle).reduce((a, b) => a + b, 0);
    return { weekIndex: p.weekIndex, phase: p.phase, phaseRu: p.phaseRu, targetTotalSets: totalTarget, intensityZone: p.intensityZone, rirTarget: p.rirTarget, setsByMuscle };
  });

  return { weeks, totalWeeks, progressionModel: 'RP-стиль: накопление MEV→MRV + делод' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SPLIT QUALITY SCORE (0-100)
// ═══════════════════════════════════════════════════════════════════════════

export function scoreSplitQuality(
  entries: ProExerciseRow[],
  level: TrainingLevel,
  weakPoints: string[] = [],
): SplitQualityScore {
  const muscleMap = new Map<string, ProExerciseRow[]>();
  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!ex) return;
    const m = ex.group;
    if (!muscleMap.has(m)) muscleMap.set(m, []);
    muscleMap.get(m)!.push(e);
  });

  const issues: string[] = [];
  const strengths: string[] = [];
  const allLM = getAllVolumeLandmarks(level);

  // 1. Volume Distribution (is each muscle between MEV and MRV?)
  let volDistScore = 100;
  let muscleCount = 0;
  const targetMuscles = ['chest', 'back', 'legs', 'shoulders', 'arms'];
  for (const m of targetMuscles) {
    const entries_m = muscleMap.get(m) || [];
    const sets = entries_m.reduce((s, e) => s + e.sets, 0);
    const lm = allLM[normalizeMuscleForLM(m)] || { mev: 6, mrv: 20 };
    muscleCount++;

    if (sets === 0) { volDistScore -= 25; issues.push(`${muscleRu(m)}: нет подходов — добавьте упражнения`); }
    else if (sets < lm.mev) { volDistScore -= 12; issues.push(`${muscleRu(m)}: ${sets}/${lm.mev} подходов — ниже MEV`); }
    else if (sets > lm.mrv) { volDistScore -= 18; issues.push(`${muscleRu(m)}: ${sets}/${lm.mrv} подходов — превышен MRV`); }
    else { strengths.push(`${muscleRu(m)}: объём в норме (${sets} подходов)`); }

    // Weak points get bonus if they have extra volume
    if (weakPoints.includes(m) && sets >= (lm.mav || 10)) {
      strengths.push(`${muscleRu(m)}: отстающая группа проработана (${sets} подх > MAV)`);
    }
  }
  volDistScore = Math.max(0, Math.min(100, volDistScore));

  // 2. Frequency Optimization
  let freqScore = 100;
  for (const m of targetMuscles) {
    const days = new Set((muscleMap.get(m) || []).map(e => e.day));
    if (days.size === 0) { freqScore -= 10; issues.push(`${muscleRu(m)}: 0 дней — нет частоты`); }
    else if (days.size === 1) { freqScore -= 5; }
    // 2x/week is ideal for most
  }
  if (entries.length >= 3 && muscleMap.size >= 4) strengths.push('Хорошее распределение по дням');
  freqScore = Math.max(0, Math.min(100, freqScore));

  // 3. Exercise Selection (compound vs isolation ratio, SFR efficiency)
  let exSelScore = 100;
  let totalSFR = 0, sfrSets = 0;
  let compSets = 0, isoSets = 0;
  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!ex) return;
    if (ex.type === 'compound') compSets += e.sets;
    else isoSets += e.sets;

    const sfr = getSFRProfile(e.exerciseId);
    if (sfr) { totalSFR += sfr.sfrRatio * e.sets; sfrSets += e.sets; }
  });
  const total = compSets + isoSets;
  const compRatio = total > 0 ? compSets / total : 0;

  if (compRatio < 0.25 && total > 0) { exSelScore -= 15; issues.push('Слишком мало базовых упражнений (<25%)'); }
  if (compRatio > 0.85 && total > 0) { exSelScore -= 10; issues.push('Слишком много базы (>85%) — не хватает изоляции'); }
  if (compRatio >= 0.3 && compRatio <= 0.7) strengths.push('Хороший баланс базы/изоляции');

  const avgSFR = sfrSets > 0 ? totalSFR / sfrSets : 0;
  if (avgSFR < 0.6) { exSelScore -= 10; issues.push('Низкая SFR-эффективность упражнений — пересмотрите выбор'); }
  if (avgSFR > 1.0) strengths.push('Высокая SFR-эффективность упражнений');

  exSelScore = Math.max(0, Math.min(100, exSelScore));

  // 4. Intensity Management (heavy/medium/light distribution)
  let intScore = 100;
  let heavyTonnage = 0, medTonnage = 0, lightTonnage = 0;
  entries.forEach(e => {
    const oneRM = e.oneRM && e.oneRM > 0 ? e.oneRM : 100;
    const pct = e.weight / oneRM;
    const t = e.weight * e.reps * e.sets;
    if (pct >= 0.85) heavyTonnage += t;
    else if (pct >= 0.65) medTonnage += t;
    else lightTonnage += t;
  });
  const totalTonnage = heavyTonnage + medTonnage + lightTonnage;
  if (totalTonnage > 0) {
    const heavyPct = heavyTonnage / totalTonnage;
    if (heavyPct > 0.5) { intScore -= 20; issues.push('>50% тоннажа в тяжёлой зоне — риск перетрена ЦНС'); }
    else if (heavyPct < 0.15 && totalTonnage > 1000) { intScore -= 10; issues.push('<15% тоннажа в тяжёлой зоне — не хватает интенсивности'); }
    strengths.push(`Распределение интенсивности: тяж ${Math.round(heavyPct * 100)}% / сред ${Math.round(medTonnage / totalTonnage * 100)}% / лёг ${Math.round(lightTonnage / totalTonnage * 100)}%`);
  }
  intScore = Math.max(0, Math.min(100, intScore));

  // 5. Recovery Balance
  const cns = computeCNSFatigue(entries);
  let recScore = 100;
  if (cns.totalCNSScore > cns.maxRecommended * 1.3) recScore -= 35;
  else if (cns.totalCNSScore > cns.maxRecommended) recScore -= 18;
  else strengths.push('Нагрузка на ЦНС в норме');
  recScore = Math.max(0, Math.min(100, recScore));

  const overall = Math.round(volDistScore * 0.3 + freqScore * 0.15 + exSelScore * 0.25 + intScore * 0.15 + recScore * 0.15);

  return {
    overall, volumeDistribution: volDistScore, frequencyOptimization: freqScore,
    exerciseSelection: exSelScore, intensityManagement: intScore, recoveryBalance: recScore,
    compoundIsolationRatio: Math.round(compRatio * 100),
    issues, strengths,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. EXERCISE SWAP RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

export function findBetterExerciseSwaps(
  entries: ProExerciseRow[],
  level: TrainingLevel,
): ExerciseSwapRec[] {
  const swaps: ExerciseSwapRec[] = [];

  entries.forEach(e => {
    const currentSFR = getSFRProfile(e.exerciseId);
    const currentSFRVal = currentSFR?.sfrRatio || 0;
    const curEx = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!curEx) return;

    // Find exercises for the SAME muscle with better SFR
    const betterOptions: ExerciseSwapRec['betterOptions'] = [];

    EXERCISE_CATALOG.forEach(catEx => {
      if (catEx.id === e.exerciseId) return;
      if (catEx.group !== curEx.group) return;

      const sfr = getSFRProfile(catEx.id);
      if (!sfr || sfr.sfrRatio <= currentSFRVal + 0.1) return;

      const muscleMatch = catEx.group === curEx.group ? 100 : 50;
      let reason = '';
      if (sfr.tier === 'S') reason = 'Высший SFR-тир — максимум стимула при минимуме усталости';
      else if (sfr.sfrRatio > currentSFRVal * 1.5) reason = `SFR в ${(sfr.sfrRatio / currentSFRVal).toFixed(1)}× выше — значительно эффективнее`;
      else reason = 'Более эффективная альтернатива';

      betterOptions.push({ exerciseId: catEx.id, name: catEx.name, sfr: sfr.sfrRatio, muscleMatch, reason });
    });

    if (betterOptions.length > 0) {
      betterOptions.sort((a, b) => b.sfr - a.sfr);
      swaps.push({
        currentExerciseId: e.exerciseId,
        currentName: curEx.name,
        currentSFR: currentSFRVal,
        betterOptions: betterOptions.slice(0, 3),
      });
    }
  });

  // Deduplicate by current exercise
  const seen = new Set<string>();
  return swaps.filter(s => { if (seen.has(s.currentExerciseId)) return false; seen.add(s.currentExerciseId); return true; });
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. COVERAGE GAP ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export interface CoverageGap {
  muscle: string;
  muscleRu: string;
  missing: boolean;
  sets: number;
  mev: number;
  suggestion: string;
}

export function findCoverageGaps(entries: ProExerciseRow[], level: TrainingLevel): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const allLM = getAllVolumeLandmarks(level);
  const muscleSets: Record<string, number> = {};

  entries.forEach(e => {
    const ex = getExerciseById(e.exerciseId) as Exercise | undefined;
    if (!ex) return;
    muscleSets[ex.group] = (muscleSets[ex.group] || 0) + e.sets;
  });

  for (const [muscle, lm] of Object.entries(allLM)) {
    const sets = muscleSets[muscle] || 0;
    if (sets < lm.mev) {
      const missing = sets === 0;
      gaps.push({
        muscle, muscleRu: muscleRu(muscle),
        missing, sets, mev: lm.mev,
        suggestion: missing
          ? `Добавьте 1-2 упражнения на ${muscleRu(muscle)} (минимум ${lm.mev} подх/нед)`
          : `Добавьте ${lm.mev - sets} подходов до MEV`,
      });
    }
  }

  return gaps;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. COMPLETE ANALYSIS (одним вызовом)
// ═══════════════════════════════════════════════════════════════════════════

export interface FullVolumeAnalysis {
  perMuscle: MuscleVolumeProAnaly[];
  cnsFatigue: CNSFatigueReport;
  recovery: RecoveryCapacityReport;
  quality: SplitQualityScore;
  coverageGaps: CoverageGap[];
  swapRecommendations: ExerciseSwapRec[];
  totalSets: number;
  totalTonnage: number;
  totalKPSh: number;
  weekCount: number;
}

export function analyzeFullVolume(
  entries: ProExerciseRow[],
  level: TrainingLevel,
  weakPoints: string[] = [],
): FullVolumeAnalysis {
  const targetMuscles = ['chest', 'back', 'legs', 'shoulders', 'arms'];
  const perMuscle = targetMuscles
    .map(m => analyzeMuscleVolumePro(entries, level, m))
    .filter((a): a is MuscleVolumeProAnaly => a !== null);

  let totalSets = 0, totalTonnage = 0, totalKPSh = 0;
  const weeks = new Set<number>();
  entries.forEach(e => {
    totalSets += e.sets;
    const oneRM = e.oneRM && e.oneRM > 0 ? e.oneRM : 100;
    const setTonnage = e.weight * e.reps * e.sets;
    totalTonnage += setTonnage;
    totalKPSh += setTonnage * (e.weight / oneRM);
    weeks.add(e.week);
  });

  return {
    perMuscle,
    cnsFatigue: computeCNSFatigue(entries),
    recovery: computeRecoveryCapacity(entries, level),
    quality: scoreSplitQuality(entries, level, weakPoints),
    coverageGaps: findCoverageGaps(entries, level),
    swapRecommendations: findBetterExerciseSwaps(entries, level),
    totalSets, totalTonnage, totalKPSh,
    weekCount: weeks.size,
  };
}
