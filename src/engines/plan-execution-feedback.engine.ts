/**
 * plan-execution-feedback.engine.ts — Недельный фидбэк план→выполнение.
 *
 * Читает sRPE-сессии за прошлую неделю (7д) и предлагает корректировки
 * на следующую неделю: вес, RIR, объём, рекомендация разгрузки.
 */
import { loadSRPESessions } from './pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, type TrainingSession } from './pro/training-load.engine';

export interface WeekFeedback {
  /** Множитель веса для следующей недели (0.85–1.10) */
  weightMultiplier: number;
  /** Сдвиг RIR (+1 = легче, -1 = тяжелее) */
  rirShift: number;
  /** Множитель объёма (0.5–1.0) */
  volumeMultiplier: number;
  /** Рекомендация разгрузки */
  deloadRecommended: boolean;
  /** Обоснование */
  reasons: string[];
  /** Оценка среднего RPE за последнюю неделю */
  avgRpe: number;
  /** Тренд (усталость растёт/падает/стабильно) */
  fatigueTrend: 'rising' | 'falling' | 'stable';
}

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Получить фидбэк для следующей недели */
export function getPlanFeedback(): WeekFeedback {
  const reasons: string[] = [];
  const all = loadSRPESessions();
  const weekAgo = daysAgoDate(7);
  const sessions = all.filter(s => s.date >= weekAgo);

  if (sessions.length === 0) {
    return { weightMultiplier: 1.0, rirShift: 0, volumeMultiplier: 1.0, deloadRecommended: false, reasons: [], avgRpe: 0, fatigueTrend: 'stable' };
  }

  const avgRpe = sessions.reduce((s, x) => s + x.sRPE, 0) / sessions.length;
  const trainingSessions: TrainingSession[] = sessions.map(s => ({ date: s.date, sRPE: s.sRPE, durationMin: s.durationMin }));
  const loads = toDailyLoads(trainingSessions);
  const acwr = acuteChronicRatio(loads);

  let weightMult = 1.0;
  let rirShift = 0;
  let volMult = 1.0;
  let deloadRec = false;
  let fatigueTrend: 'rising' | 'falling' | 'stable' = 'stable';

  if (acwr.ratio > 1.5) {
    deloadRec = true;
    volMult = 0.6;
    weightMult = 0.9;
    rirShift = 2;
    reasons.push('⛔ ACWR ' + acwr.ratio.toFixed(2) + ' (>1.5) — рекомендована разгрузка: объём −40%, RIR +2.');
    fatigueTrend = 'rising';
  } else if (acwr.ratio > 1.3) {
    volMult = 0.85;
    rirShift = 1;
    weightMult = 0.95;
    reasons.push('⚠ ACWR ' + acwr.ratio.toFixed(2) + ' (>1.3) — снизьте объём на 15%, добавьте RIR +1.');
    fatigueTrend = 'rising';
  } else if (acwr.ratio < 0.8) {
    volMult = 1.05;
    weightMult = 1.03;
    rirShift = -1;
    reasons.push('⬇ ACWR ' + acwr.ratio.toFixed(2) + ' (<0.8) — можно увеличить нагрузку: объём +5%, вес +3%.');
    fatigueTrend = 'falling';
  } else {
    reasons.push('✅ ACWR ' + acwr.ratio.toFixed(2) + ' — в зоне оптимума (0.8–1.3).');
  }

  if (avgRpe > 8) {
    weightMult = Math.min(weightMult, 0.93);
    rirShift = Math.max(rirShift, 1);
    reasons.push('🔴 Средний RPE ' + avgRpe.toFixed(1) + ' (>8) — высокая интенсивность. Снизьте вес на 5-7%.');
    fatigueTrend = 'rising';
  } else if (avgRpe < 5 && sessions.length >= 3) {
    weightMult = Math.max(weightMult, 1.05);
    rirShift = Math.min(rirShift, -1);
    reasons.push('🟢 Средний RPE ' + avgRpe.toFixed(1) + ' (<5) — можно повысить интенсивность на 5%.');
  } else {
    reasons.push('🟡 Средний RPE ' + avgRpe.toFixed(1) + ' — в норме.');
  }

  if (sessions.length < 3) {
    reasons.push('📉 Маловато тренировок (' + sessions.length + ') за неделю — проверьте регулярность.');
  } else if (sessions.length >= 5) {
    reasons.push('📈 ' + sessions.length + ' тренировок/нед — отличная регулярность.');
  }

  return {
    weightMultiplier: Math.round(weightMult * 100) / 100,
    rirShift,
    volumeMultiplier: Math.round(volMult * 100) / 100,
    deloadRecommended: deloadRec,
    reasons,
    avgRpe: Math.round(avgRpe * 10) / 10,
    fatigueTrend,
  };
}
