/**
 * meso-correction.engine.ts — Авто-корректировка следующего мезоцикла по дневнику.
 *
 * Анализирует:
 * 1. e1RM до/после мезоцикла (прогресс)
 * 2. RIR-точность (bias из калибровки)
 * 3. Стагнация (плато >2 нед)
 * 4. ACWR, монотонность, готовность
 * → рекомендации для следующего цикла (объём, RIR, частота, прогрессия)
 */
import type { TrainingProfile } from '../ui/screens/TrainingScreen_parts/training-profile';

export interface MesoCorrectionInput {
  /** Названия топ-упражнений с e1RM до/после */
  exercises: Array<{ name: string; e1rmBefore: number; e1rmAfter: number }>;
  /** RIR bias из калибровки: >0 = легче плана, <0 = тяжелее */
  rirBias: number;
  /** RIR consistencyScore 0-100 */
  rirConsistency: number;
  /** Количество недель в мезоцикле */
  mesoWeeks: number;
  /** Средний ACWR за мезоцикл */
  avgAcwr: number;
  /** Монотонность (>2 = плохо) */
  monotony: number;
  /** Средняя готовность */
  avgReadiness: number;
  /** Количество травм/пропусков */
  missedSessions: number;
  /** Профиль */
  profile: TrainingProfile;
  /** Текущий объём (сетов/нед) */
  currentVolume: number;
  /** Текущий RIR */
  currentRir: number;
}

export interface MesoCorrectionOutput {
  /** Что менять в следующем мезоцикле */
  adjustments: MesoAdjustment[];
  /** Новые рекомендованные параметры */
  recommendedVolume: number;
  recommendedRir: number;
  recommendedDeloadFreq: number;
  recommendedProgressionPct: number;
  /** Флаг: нужна ли смена сплита */
  changeSplit: boolean;
  /** Флаг: нужен ли делод перед следующим мезо */
  needsDeloadFirst: boolean;
  /** Комментарий для UI */
  comment: string;
}

export interface MesoAdjustment {
  type: 'volume_up' | 'volume_down' | 'rir_up' | 'rir_down' | 'deload_sooner' | 'deload_later'
    | 'split_change' | 'exercise_replace' | 'frequency_up' | 'frequency_down'
    | 'progression_slower' | 'progression_faster' | 'deload_now';
  reason: string;
  severity: 'info' | 'warning' | 'critical';
}

export function analyzeMesoCycle(input: MesoCorrectionInput): MesoCorrectionOutput {
  const adj: MesoAdjustment[] = [];
  let vol = input.currentVolume;
  let rir = input.currentRir;
  let deloadFreq = input.mesoWeeks;
  let progPct = 2.5;
  let changeSplit = false;
  let needsDeloadFirst = false;

  // 1. Анализ прогресса e1RM
  let progressedExercises = 0;
  let regressedExercises = 0;
  for (const ex of input.exercises) {
    const change = ex.e1rmAfter - ex.e1rmBefore;
    const pct = ex.e1rmBefore > 0 ? (change / ex.e1rmBefore) * 100 : 0;
    if (pct > 2) progressedExercises++;
    else if (pct < -1) regressedExercises++;
  }

  if (regressedExercises > progressedExercises) {
    needsDeloadFirst = true;
    adj.push({
      type: 'deload_now',
      reason: `Регресс в ${regressedExercises} упражнениях — требуется разгрузка перед следующим циклом`,
      severity: 'critical',
    });
    vol = Math.round(vol * 0.85);
  } else if (progressedExercises > 0 && regressedExercises === 0) {
    // Хороший прогресс — можно увеличить объём или снизить RIR
    vol = Math.round(vol * 1.05);
    rir = Math.max(0, rir - 0.5);
    adj.push({
      type: 'volume_up',
      reason: `Прогресс в ${progressedExercises} упражнениях → объём +5%, RIR −0.5`,
      severity: 'info',
    });
  }

  // 2. Анализ RIR-точности
  if (input.rirBias > 1.0) {
    // Систематически легче плана — можно снизить RIR
    rir = Math.max(0, rir - 0.5);
    adj.push({
      type: 'rir_down',
      reason: `RIR bias ${input.rirBias.toFixed(1)} (легче плана) → снижаем RIR на 0.5`,
      severity: 'info',
    });
  } else if (input.rirBias < -1.0) {
    // Систематически тяжелее — нужно повысить RIR
    rir = rir + 0.5;
    adj.push({
      type: 'rir_up',
      reason: `RIR bias ${input.rirBias.toFixed(1)} (тяжелее плана) → повышаем RIR на 0.5`,
      severity: 'warning',
    });
  }

  if (input.rirConsistency < 40) {
    adj.push({
      type: 'exercise_replace',
      reason: `RIR-согласованность ${input.rirConsistency}% — заменить упражнения с высокой вариативностью`,
      severity: 'warning',
    });
  }

  // 3. ACWR-анализ
  if (input.avgAcwr > 1.5) {
    needsDeloadFirst = true;
    vol = Math.round(vol * 0.8);
    adj.push({
      type: 'deload_now',
      reason: `Средний ACWR ${input.avgAcwr.toFixed(2)} > 1.5 — перегрузка, требуется делод и снижение объёма на 20%`,
      severity: 'critical',
    });
  } else if (input.avgAcwr < 0.7) {
    vol = Math.round(vol * 1.15);
    adj.push({
      type: 'volume_up',
      reason: `Средний ACWR ${input.avgAcwr.toFixed(2)} < 0.7 — недогруз, увеличиваем объём на 15%`,
      severity: 'info',
    });
  }

  // 4. Монотонность
  if (input.monotony > 2.0) {
    changeSplit = true;
    adj.push({
      type: 'split_change',
      reason: `Монотонность ${input.monotony.toFixed(1)} > 2.0 — требуется смена сплита или добавление вариативности`,
      severity: 'warning',
    });
  }

  // 5. Пропуски
  if (input.missedSessions > input.mesoWeeks) {
    vol = Math.round(vol * 0.9);
    adj.push({
      type: 'volume_down',
      reason: `${input.missedSessions} пропусков — снижаем объём на 10% для лучшей адгеренции`,
      severity: 'warning',
    });
  }

  // 6. Прогрессия
  if (regressedExercises > 0 && progressedExercises === 0) {
    progPct = 1.5; // замедлить
    adj.push({
      type: 'progression_slower',
      reason: 'Регресс — замедляем прогрессию до 1.5%/нед',
      severity: 'warning',
    });
  } else if (progressedExercises >= 2) {
    progPct = 3.0; // ускорить
    adj.push({
      type: 'progression_faster',
      reason: 'Стабильный прогресс — ускоряем прогрессию до 3%/нед',
      severity: 'info',
    });
  }

  // Формируем комментарий
  const parts: string[] = [];
  if (needsDeloadFirst) parts.push('🔴 Требуется делод перед следующим мезоциклом');
  if (changeSplit) parts.push('🔄 Рекомендована смена сплита');
  if (adj.length === 0) parts.push('✅ Мезоцикл прошёл успешно — параметры оптимальны');
  parts.push(`📊 Рекомендации: объём ${vol} сетов/нед, RIR ${rir}, прогрессия ${progPct}%/нед`);

  return {
    adjustments: adj,
    recommendedVolume: Math.max(6, vol),
    recommendedRir: Math.max(0, Math.min(4, rir)),
    recommendedDeloadFreq: deloadFreq,
    recommendedProgressionPct: progPct,
    changeSplit,
    needsDeloadFirst,
    comment: parts.join('. '),
  };
}

/** Получить настройки из RIR-калибровки */
export function loadRirCalibrationStats(): { bias: number; consistency: number; totalSets: number } {
  try {
    const raw = localStorage.getItem('he_rir_calibration');
    if (!raw) return { bias: 0, consistency: 100, totalSets: 0 };
    const points: Array<{ plannedRIR: number; actualRIR: number }> = JSON.parse(raw);
    if (!points.length) return { bias: 0, consistency: 100, totalSets: 0 };

    const bias = points.reduce((s, p) => s + (p.plannedRIR - p.actualRIR), 0) / points.length;
    const variances = points.map(p => Math.abs((p.plannedRIR - p.actualRIR) - bias));
    const avgVar = variances.reduce((s, v) => s + v, 0) / variances.length;
    const consistency = Math.max(0, Math.min(100, 100 - avgVar * 20));

    return { bias, consistency: Math.round(consistency), totalSets: points.length };
  } catch { return { bias: 0, consistency: 100, totalSets: 0 }; }
}
