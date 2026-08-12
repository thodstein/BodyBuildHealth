/**
 * Diary Engine + History Manager + Auto-Insights
 *
 * Diary Engine: structured training log management (session/set/rep/video)
 * History Manager: queries past training data for analysis context
 * Auto-Insights: automatic pattern detection (plateaus, improvements, warnings)
 *
 * @module diary-engine
 */

import { epley1RM } from './e1rm';
import { formatDate } from '../core/utils/date-utils';
import { EXERCISE_CATALOG } from '../core/exercise-catalog';

/** Человекочитаемое имя упражнения по id (bench_press → «Жим штанги лёжа»). */
export function exerciseDisplayName(exerciseId: string): string {
  const found = EXERCISE_CATALOG.find(e => e.id === exerciseId);
  return found?.name || exerciseId;
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DiarySession {
  sessionId: string;
  date: string;
  focus: string;
  durationMin: number;
  completed: boolean;
  terminatedEarly: boolean;
  terminationReason?: string;
  sessionVolume: number;
  sessionIntensity: number;
  overallRPE: number;
  notes: string;
}

export interface DiarySet {
  setId: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  targetReps: number;
  targetWeight: number;
  actualReps: number;
  actualWeight: number;
  actualRPE: number;
  actualRIR: number;
  velocityMps?: number;
  velocityLoss?: number;
  romCm?: number;
  techniqueScore?: number;
  errors: string[];
  restSeconds: number;
  terminatedEarly: boolean;
}

export interface HistoryContext {
  lastWeights: Record<string, number>;
  last1RMs: Record<string, number>;
  lastRPES: Record<string, number>;
  lastErrors: Record<string, number>;
  weeklyVolume: number;
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
  firstSessionDate: string | null;
}

export interface AutoInsight {
  type: 'positive' | 'negative' | 'warning' | 'info';
  category: 'strength' | 'fatigue' | 'technique' | 'volume' | 'consistency' | 'recovery';
  message: string;
  detail: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Diary Engine
// ═══════════════════════════════════════════════════════════════════════════

export function createSession(session: Partial<DiarySession>): DiarySession {
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    sessionId: session.sessionId || uid,
    date: session.date || new Date().toISOString().slice(0, 10),
    focus: session.focus || 'fullbody',
    durationMin: session.durationMin || 0,
    completed: session.completed ?? true,
    terminatedEarly: session.terminatedEarly ?? false,
    terminationReason: session.terminationReason,
    sessionVolume: session.sessionVolume || 0,
    sessionIntensity: session.sessionIntensity || 0,
    overallRPE: session.overallRPE || 5,
    notes: session.notes || '',
  };
}

export function createSet(set: Partial<DiarySet>): DiarySet {
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    setId: set.setId || uid,
    sessionId: set.sessionId || '',
    exerciseId: set.exerciseId || '',
    exerciseName: set.exerciseName || '',
    setIndex: set.setIndex || 1,
    targetReps: set.targetReps || 0,
    targetWeight: set.targetWeight || 0,
    actualReps: set.actualReps || 0,
    actualWeight: set.actualWeight || 0,
    actualRPE: set.actualRPE || 5,
    actualRIR: set.actualRIR || 3,
    velocityMps: set.velocityMps,
    velocityLoss: set.velocityLoss,
    romCm: set.romCm,
    techniqueScore: set.techniqueScore,
    errors: set.errors || [],
    restSeconds: set.restSeconds || 120,
    terminatedEarly: set.terminatedEarly ?? false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// History Manager
// ═══════════════════════════════════════════════════════════════════════════

export function buildHistoryContext(
  sets: DiarySet[],
  sessions: DiarySession[],
): HistoryContext {
  const lastWeights: Record<string, number> = {};
  const last1RMs: Record<string, number> = {};
  const lastRPES: Record<string, number> = {};
  const lastErrors: Record<string, number> = {};

  // Sort by date for time-series analysis
  const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));
  const sortedSets = [...sets].sort((a, b) => {
    const sessA = sessionMap.get(a.sessionId);
    const sessB = sessionMap.get(b.sessionId);
    return (sessA?.date || '').localeCompare(sessB?.date || '');
  });

  // Latest values per exercise
  const exLatest: Record<string, number> = {};
  for (const set of sortedSets) {
    lastWeights[set.exerciseId] = set.actualWeight;
    lastRPES[set.exerciseId] = set.actualRPE;

    // Epley 1RM
    const estRM = epley1RM(set.actualWeight, set.actualReps);
    if (!last1RMs[set.exerciseId] || estRM > last1RMs[set.exerciseId]) {
      last1RMs[set.exerciseId] = estRM;
    }

    for (const err of set.errors) {
      lastErrors[err] = (lastErrors[err] || 0) + 1;
    }
  }

  // Weekly volume
  let weeklyVolume = 0;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const cutoff = oneWeekAgo.toISOString().slice(0, 10);

  for (const set of sortedSets) {
    const sess = sessionMap.get(set.sessionId);
    if (sess && sess.date >= cutoff) {
      weeklyVolume += set.actualReps * set.actualWeight;
    }
  }

  // Streaks
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let currentStreak = 0;
  let bestStreak = 0;
  let streak = 0;

  for (let i = 0; i < sortedSessions.length; i++) {
    if (sortedSessions[i].completed) {
      if (i > 0) {
        const prev = new Date(sortedSessions[i-1].date);
        const curr = new Date(sortedSessions[i].date);
        const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
        if (diffDays > 1.5) streak = 0;
      }
      streak++;
      if (streak > bestStreak) bestStreak = streak;
    } else {
      streak = 0;
    }
  }
  currentStreak = streak;
  if (currentStreak > 0 && sortedSessions.length > 0) {
    const last = [...sortedSessions].reverse().find(s => s.completed);
    if (last) {
      const today = formatDate(new Date());
      const yesterday = formatDate(new Date(Date.now() - 86400000));
      if (last.date !== today && last.date !== yesterday) currentStreak = 0;
    }
  }

  return {
    lastWeights,
    last1RMs,
    lastRPES,
    lastErrors,
    weeklyVolume: Math.round(weeklyVolume),
    totalSessions: sessions.length,
    currentStreak,
    bestStreak,
    firstSessionDate: sortedSessions.length > 0 ? sortedSessions[0].date : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-Insights Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateInsights(
  sets: DiarySet[],
  sessions: DiarySession[],
  previousSets: DiarySet[] = [],
): AutoInsight[] {
  const insights: AutoInsight[] = [];
  const history = buildHistoryContext(sets, sessions);
  const prevHistory = previousSets.length > 0 ? buildHistoryContext(previousSets, sessions) : null;

  // ── Strength insights ──
  for (const [exId, currentRM] of Object.entries(history.last1RMs)) {
    const prevRM = prevHistory?.last1RMs?.[exId];
    if (prevRM && currentRM > prevRM * 1.05) {
      insights.push({
        type: 'positive',
        category: 'strength',
        message: `💪 ${exerciseDisplayName(exId)}: +${Math.round(((currentRM - prevRM) / prevRM) * 100)}% 1RM`,
        detail: `Прогресс с ${prevRM} кг до ${currentRM} кг`,
        timestamp: new Date().toISOString(),
      });
    }
    if (prevRM && currentRM < prevRM * 0.95) {
      insights.push({
        type: 'warning',
        category: 'strength',
        message: `⚠️ ${exerciseDisplayName(exId)}: -${Math.round(((prevRM - currentRM) / prevRM) * 100)}% 1RM`,
        detail: `Снижение с ${prevRM} кг до ${currentRM} кг. Проверьте восстановление и питание.`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Volume insights ──
  if (prevHistory && history.weeklyVolume > prevHistory.weeklyVolume * 1.3) {
    insights.push({
      type: 'warning',
      category: 'volume',
      message: `⚠️ Резкий рост объёма: +${Math.round(((history.weeklyVolume - prevHistory.weeklyVolume) / prevHistory.weeklyVolume) * 100)}%`,
      detail: 'Увеличивайте объём постепенно (не более 10-15% в неделю) для снижения риска травм.',
      timestamp: new Date().toISOString(),
    });
  }

  // ── Technique insights ──
  const totalErrors = Object.values(history.lastErrors).reduce((s, c) => s + c, 0);
  if (totalErrors > 10) {
    const topError = Object.entries(history.lastErrors).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      type: 'warning',
      category: 'technique',
      message: `⚠️ ${totalErrors} ошибок техники за период`,
      detail: `Самая частая: ${topError[0]} (${topError[1]} раз). Приоритет — исправление техники.`,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Technique quality (оценка 3-5 за подход) ──
  const scored = sets.filter(s => typeof s.techniqueScore === 'number' && s.techniqueScore >= 1);
  if (scored.length >= 3) {
    const avgTech = scored.reduce((s, x) => s + (x.techniqueScore || 0), 0) / scored.length;
    if (avgTech < 4) {
      insights.push({
        type: 'warning',
        category: 'technique',
        message: `⚠️ Средняя техника ${avgTech.toFixed(1)}/5 (${scored.length} подходов)`,
        detail: 'Более половины подходов с оценкой ниже 4. Снизьте вес или повторы, сфокусируйтесь на форме.',
        timestamp: new Date().toISOString(),
      });
    } else {
      insights.push({
        type: 'positive',
        category: 'technique',
        message: `✅ Техника: ${avgTech.toFixed(1)}/5 (${scored.length} подходов)`,
        detail: 'Стабильное качество выполнения. Можно повышать нагрузку.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Consistency insights ──
  if (history.currentStreak >= 10) {
    insights.push({
      type: 'positive',
      category: 'consistency',
      message: `🔥 Серия: ${history.currentStreak} тренировок подряд!`,
      detail: `Лучшая серия: ${history.bestStreak}. Отличная дисциплина.`,
      timestamp: new Date().toISOString(),
    });
  }

  if (history.totalSessions >= 100) {
    insights.push({
      type: 'positive',
      category: 'consistency',
      message: `🏆 100+ тренировок в дневнике!`,
      detail: `Всего ${history.totalSessions} тренировок с ${history.firstSessionDate}`,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Recovery insight ──
  const recentSessions = sessions.slice(-3).filter(s => s.overallRPE >= 8);
  if (recentSessions.length >= 3) {
    insights.push({
      type: 'warning',
      category: 'recovery',
      message: '⚠️ 3 тяжёлые тренировки подряд (RPE ≥ 8)',
      detail: 'ЦНС требуется восстановление. Добавьте лёгкий день или день отдыха.',
      timestamp: new Date().toISOString(),
    });
  }

  return insights;
}
