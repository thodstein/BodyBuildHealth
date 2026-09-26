/**
 * Recovery Optimization Engine — Sleep, HRV, Readiness, Periodization Sync
 *
 * Recovery metrics:
 *  - HRV-based readiness
 *  - Sleep quality & optimization
 *  - Training-readiness sync (periodization-aware)
 *  - Deload detection & scheduling
 *  - Overtraining risk assessment
 *  - Supercompensation window calculation
 *
 * @module recovery-optimization-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SleepData {
  hours: number;
  quality: number;    // 1-5 (1-10 тоже принимается и приводится)
  bedtime?: string;   // "23:00" — опционально: нет данных — нет и начисления баллов
  wakeTime?: string;  // "07:00"
  latencyMin?: number;// minutes to fall asleep
  awakenings?: number;// times woke up
}

export interface HRVData {
  rmssd: number;      // ms
  sdnn?: number;      // ms (движком не используется — нет канала данных)
  restingHR: number;  // bpm
  readinessScore: number; // 0-100 (вход самоотчёта, не результат расчёта)
}

export interface RecoveryInput {
  sleep: SleepData;
  hrv: HRVData;
  /** Усталость. Движок принимает ЛЮБУЮ из трёх шкал и нормализует сам (см. normalizeFatigue):
   *  0–1 (канон хаба), 1–10 (экран восстановления), 0–100 (сырой процент). */
  fatigueScore: number;
  trainingDaysThisWeek: number;
  /** Неделя цикла. 0 / нечисло = «неизвестно» → недельное правило делода не применяется (честно, а не по выдуманной неделе). */
  currentWeek: number;
  periodizationPhase: 'accumulation' | 'intensification' | 'peaking' | 'deload';
  recentPR: boolean;
  /** Legacy-поле: движок его не читает (нет валидированного вклада). Оставлено, чтобы не ломать вызовы. */
  injuryHistory?: string[];
  /** Персональная HRV-база (lnRMSSD/SWC): персональное бьёт популяционное (Plews/Buchheit).
   *  Опционально — без неё поведение байт-в-байт как раньше. */
  hrvBaseline?: { status: 'need_base' | 'normal' | 'reduced' | 'low' | 'elevated'; n: number } | null;
}

export interface RecoveryOutput {
  overallRecoveryIndex: number; // 0-100
  sleepScore: number;
  hrvScore: number;
  /** ВХОДНОЙ самоотчёт готовности (hrv.readinessScore), а не результат расчёта.
   *  Считаемый показатель — overallRecoveryIndex. Оставлено для обратной совместимости потребителей. */
  readinessScore: number;
  deloadRecommended: boolean;
  deloadReason: string;
  overtrainingRisk: number; // 0-100
  /** Часы до возврата к базе (эвристика 24–72ч). НЕ «окно для тяжёлой сессии» — см. supercompensationReady. */
  supercompensationHours: number;
  /** Есть ли основание считать, что суперкомпенсация достигнута (восстановление достаточное).
   *  При false окно — это время ВОССТАНОВЛЕНИЯ, а не повод нагружаться. */
  supercompensationReady: boolean;
  /** Честное объяснение по supercompensationReady (UI не должен додумывать причину сам). */
  supercompensationReason: string;
  /** true — вход содержал нечисловые значения, которые заменены безопасными дефолтами. */
  inputsSanitized: boolean;
  recommendations: string[];
  readinessLabel: 'Отлично' | 'Хорошо' | 'Средне' | 'Низко' | 'Критично';
}

// ── Нормализация шкал входа ────────────────────────────────────────────────
// Раньше контракт 0–1 соблюдали только хаб, а экран восстановления передавал 1–10:
// индекс уходил в минус, «день отдыха» выдавался всегда, а detectOvertraining срабатывал всегда.
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 0–1 / 1–10 / 0–100 → 0–1. */
export function normalizeFatigue(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0.3;
  if (v <= 1) return Math.max(0, v);
  if (v <= 10) return Math.max(0, Math.min(1, v / 10));
  return Math.max(0, Math.min(1, v / 100));
}

/** Качество сна 1–5; 1–10 (шкала экрана) приводится к 1–5. */
export function normalizeSleepQuality(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v > 5 ? v / 2 : v));
}

// ═══════════════════════════════════════════════════════════════════════════
// Sleep Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scoreSleep(sleep: SleepData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 50;

  // Duration
  if (sleep.hours >= 7.5 && sleep.hours <= 9) score += 25;
  else if (sleep.hours >= 6) { score += 10; issues.push('Недостаточно сна (< 7.5ч)'); }
  else { score -= 10; issues.push('Критический недосып (< 6ч)'); }

  // Quality
  score += (sleep.quality - 3) * 5;

  // Latency — только если реально измерено (нет данных = нет начисления баллов)
  if (typeof sleep.latencyMin === 'number' && Number.isFinite(sleep.latencyMin)) {
    if (sleep.latencyMin <= 20) score += 10;
    else if (sleep.latencyMin <= 40) score += 3;
    else { score -= 5; issues.push('Долгое засыпание (> 40мин)'); }
  }

  // Awakenings — то же
  if (typeof sleep.awakenings === 'number' && Number.isFinite(sleep.awakenings)) {
    if (sleep.awakenings <= 1) score += 5;
    else { score -= sleep.awakenings * 3; issues.push(`${sleep.awakenings} пробуждений за ночь`); }
  }

  // Consistency — только при известных временах отбоя/подъёма
  if (sleep.bedtime && sleep.wakeTime) {
    const bed = sleep.bedtime.split(':').map(Number);
    const wake = sleep.wakeTime.split(':').map(Number);
    if (bed[0] >= 0 && wake[0] >= 0) {
      const mid = (bed[0] + wake[0] + 24) / 2;
      if (mid >= 2 && mid <= 4) score += 5; // optimal midpoint 2-4am
    }
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// HRV Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scoreHRV(hrv: HRVData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 50;

  // RMSSD
  if (hrv.rmssd >= 50) score += 25;
  else if (hrv.rmssd >= 35) score += 10;
  else { score -= 5; issues.push(`Низкий RMSSD: ${hrv.rmssd}мс`); }

  // Resting HR
  if (hrv.restingHR <= 60) score += 15;
  else if (hrv.restingHR <= 70) score += 5;
  else { score -= 10; issues.push(`Повышенный пульс покоя: ${hrv.restingHR} уд/мин`); }

  // Readiness
  score += (hrv.readinessScore - 50) * 0.2;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// Overtraining Detection
// ═══════════════════════════════════════════════════════════════════════════

function detectOvertraining(
  sleepScore: number, hrvScore: number, fatigueScore: number,
  trainingDays: number, phase: string, recentPR: boolean,
): { risk: number; reason: string } {
  let signals = 0;
  const reasons: string[] = [];

  if (sleepScore < 40) { signals++; reasons.push('Сон < 40 баллов'); }
  if (hrvScore < 40) { signals++; reasons.push('HRV < 40 баллов'); }
  if (fatigueScore > 0.7) { signals++; reasons.push('Усталость > 0.7'); }
  if (trainingDays >= 6) { signals++; reasons.push('6+ тренировок/нед'); }
  if (phase === 'intensification' && fatigueScore > 0.6) { signals++; reasons.push('Интенсификация + усталость'); }
  if (recentPR && fatigueScore > 0.5) { signals++; reasons.push('Недавний PR + усталость'); }

  const risk = Math.min(100, signals * 20 + fatigueScore * 30);
  return { risk: Math.round(risk), reason: reasons.join('; ') || 'Нет признаков' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Supercompensation Window
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Окно до возврата к базе (эвристика 24–72ч) + признак «суперкомпенсация достигнута».
 * НАПРАВЛЕНИЕ ИСПРАВЛЕНО: раньше множитель был `1.5 − (сон+HRV)/200`, то есть чем ХУЖЕ
 * восстановление, тем ДЛИННЕЕ «окно», и UI советовал планировать туда тяжёлую сессию.
 * Теперь хорошее восстановление СОКРАЩАЕТ время до пика (Banister: performance возвращается к базе
 * раньше при адекватном восстановлении), а плохое — растягивает его и снимает флаг готовности.
 */
function calcSupercompensation(fatigueScore: number, sleepScore: number, hrvScore: number): { hours: number; ready: boolean; reason: string } {
  const base = 24 + fatigueScore * 48;                 // усталость растягивает окно: 24…72ч
  const recoveryMod = Math.max(0, Math.min(1, (sleepScore + hrvScore) / 200));
  const hours = Math.round(base * (1.4 - 0.8 * recoveryMod)); // 0.6…1.4 от базы
  const ready = recoveryMod >= 0.5 && sleepScore >= 50;     // нет смысла «нагружаться в окно» при плохом сне/HRV
  const reason = ready
    ? 'восстановление достаточное — окно можно использовать под нагрузку'
    : (sleepScore < 50
      ? `сон ${Math.round(sleepScore)}/100 — ниже 50, окно считаем только восстановительным`
      : `сумма сон+HRV ${Math.round(sleepScore + hrvScore)}/200 < 100 — суперкомпенсация не подтверждена`);
  return { hours: Math.max(6, Math.min(120, hours)), ready, reason };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeRecovery(input: RecoveryInput): RecoveryOutput {
  // ── Вход нормализуется: мусорные/чужие шкалы не должны ронять индекс в минус и давать «всегда отдых» ──
  const rawFatigue = input.fatigueScore;
  const rawQuality = input.sleep?.quality;
  const fatigueScore = normalizeFatigue(rawFatigue);
  const sleep: SleepData = {
    hours: num(input.sleep?.hours, 7),
    quality: normalizeSleepQuality(rawQuality),
    bedtime: typeof input.sleep?.bedtime === 'string' && input.sleep.bedtime.includes(':') ? input.sleep.bedtime : undefined,
    wakeTime: typeof input.sleep?.wakeTime === 'string' && input.sleep.wakeTime.includes(':') ? input.sleep.wakeTime : undefined,
    latencyMin: Number.isFinite(input.sleep?.latencyMin as number) ? input.sleep.latencyMin : undefined,
    awakenings: Number.isFinite(input.sleep?.awakenings as number) ? input.sleep.awakenings : undefined,
  };
  const inputsSanitized = !Number.isFinite(rawFatigue as number)
    || !Number.isFinite(rawQuality as number)
    || !Number.isFinite(input.hrv?.rmssd as number)
    || !Number.isFinite(input.hrv?.restingHR as number);
  const hrv: HRVData = {
    rmssd: num(input.hrv?.rmssd, 0),
    sdnn: Number.isFinite(input.hrv?.sdnn as number) ? input.hrv.sdnn : undefined,
    restingHR: num(input.hrv?.restingHR, 60),
    readinessScore: num(input.hrv?.readinessScore, 50),
  };
  const sleepScored = scoreSleep(sleep);
  const hrvScored = scoreHRV(hrv);
  const recommendations: string[] = [];
  if (inputsSanitized) recommendations.push('⚠ Часть входных значений была некорректной — заменены безопасными дефолтами (проверьте сон/HRV/усталость).');

  // Персональная база перебивает популяционные пороги: низкая личная — кап вниз,
  // нормальная личная при «низком» абсолютном — пол вверх (иначе атлета с базой 35 мс вечно красно).
  let hrvScore = hrvScored.score;
  const bb = input.hrvBaseline;
  if (bb && bb.n >= 3 && bb.status !== 'need_base') {
    if (bb.status === 'low') {
      hrvScore = Math.min(hrvScore, 35);
      recommendations.push('💓 HRV ниже вашей личной базы (≥2 SWC) — только восстановление; абсолютная норма тут не важна.');
    } else if (bb.status === 'reduced') {
      hrvScore = Math.min(hrvScore, 55);
      recommendations.push('💓 HRV ниже вашей личной базы (1–2 SWC) — лёгкий режим.');
    } else {
      hrvScore = Math.max(hrvScore, 60);
    }
  }

  // Индекс восстановления: 0.3·сон + 0.3·HRV + 0.3·(100−усталость) + 10 — веса равные, +10 даёт ровно 100 на максимуме.
  // Эвристика, НЕ валидированный предиктор результата (Ruddy 2020 MSSE; Hills 2018; McGuinness 2020).
  const recoveryIndex = Math.round(sleepScored.score * 0.3 + hrvScore * 0.3
    + (100 - fatigueScore * 100) * 0.3 + 10);

  // Readiness label
  let readinessLabel: RecoveryOutput['readinessLabel'] = 'Средне';
  if (recoveryIndex >= 80) readinessLabel = 'Отлично';
  else if (recoveryIndex >= 60) readinessLabel = 'Хорошо';
  else if (recoveryIndex >= 40) readinessLabel = 'Средне';
  else if (recoveryIndex >= 20) readinessLabel = 'Низко';
  else readinessLabel = 'Критично';

  // Overtraining
  const ot = detectOvertraining(sleepScored.score, hrvScore, fatigueScore, num(input.trainingDaysThisWeek, 0), input.periodizationPhase, !!input.recentPR);

  // Supercompensation
  const supercomp = calcSupercompensation(fatigueScore, sleepScored.score, hrvScore);

  // Deload recommendation
  let deloadRecommended = false;
  let deloadReason = '';
  // Недельное правило — только при ИЗВЕСТНОЙ неделе цикла (иначе это выдуманный триггер на константе).
  const currentWeek = num(input.currentWeek, 0);
  if (input.periodizationPhase !== 'deload' && currentWeek >= 4 && recoveryIndex < 35) {
    deloadRecommended = true;
    deloadReason = `Неделя ${currentWeek}, восстановление ${recoveryIndex}% — запланируйте deload`;
  }
  if (ot.risk >= 70) {
    deloadRecommended = true;
    deloadReason = `Риск перетренированности ${ot.risk}% — срочный deload`;
  }
  if (input.periodizationPhase === 'deload') {
    deloadRecommended = false;
    deloadReason = 'Уже в фазе deload';
  }

  // Recommendations (поведенческие; дозы и добавки — только в калькуляторе поддержки, не здесь)
  if (sleepScored.score < 50) {
    recommendations.push('Приоритет: гигиена сна — тёмная прохладная спальня, экранный детокс за 1ч до сна, стабильное время подъёма. Добавки и дозы — только в калькуляторе поддержки.');
  }
  if (hrvScore < 50) {
    recommendations.push('HRV снижен — добавьте дыхательные практики (4-7-8), лёгкое кардио 20-30мин.');
  }
  if (fatigueScore > 0.7 && input.periodizationPhase !== 'deload') {
    recommendations.push('Высокая усталость — снизьте объём на 30% или добавьте день отдыха.');
  }
  if (!supercomp.ready && input.periodizationPhase !== 'deload') {
    recommendations.push('Суперкомпенсации сейчас нет (сон/HRV ниже нормы) — сначала восстановление, тяжёлую сессию переносите.');
  }
  if (deloadRecommended) {
    recommendations.push(deloadReason);
  }

  return {
    overallRecoveryIndex: recoveryIndex,
    sleepScore: sleepScored.score,
    hrvScore,
    readinessScore: hrv.readinessScore,
    deloadRecommended,
    deloadReason: deloadReason || 'Deload не требуется',
    overtrainingRisk: ot.risk,
    supercompensationHours: supercomp.hours,
    supercompensationReady: supercomp.ready,
    supercompensationReason: supercomp.reason,
    inputsSanitized,
    recommendations,
    readinessLabel,
  };
}

/**
 * Быстрый чек: тренироваться ли сегодня. fatigueScore принимает 0–1 / 1–10 / 0–100 (нормализуется),
 * нечисловые значения дают безопасный дефолт вместо «стандартной тренировки» вслепую.
 */
export function shouldTrain(recoveryIndex: number, fatigueScore: number): { train: boolean; intensityMod: number; message: string } {
  const ri = num(recoveryIndex, 50);
  const f = normalizeFatigue(fatigueScore);
  if (ri < 20) {
    return { train: false, intensityMod: 0, message: 'Критически низкое восстановление — день отдыха' };
  }
  if (ri < 35 && f > 0.7) {
    return { train: false, intensityMod: 0, message: 'Низкое восстановление + высокая усталость — активный отдых' };
  }
  if (ri < 45) {
    return { train: true, intensityMod: -0.15, message: 'Пониженная интенсивность (-15%) — восстановление ниже нормы' };
  }
  if (ri > 80 && f < 0.3) {
    return { train: true, intensityMod: 0.05, message: 'Отличное восстановление — можно увеличить нагрузку' };
  }
  return { train: true, intensityMod: 0, message: 'Стандартная тренировка' };
}
