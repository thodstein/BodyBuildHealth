import React from 'react';
import {
  computeStructuredAnalytics,
  type SessionData,
  type StructuredAnalyticsOutput,
} from '../../../engines/structured-analytics.engine';

/**
 * Минимальная форма сессии для карточки: принимает и `SessionData` движка,
 * и `WorkoutLog` дневника (у него `duration`/`split`/`exerciseName`).
 */
export interface StructuredAnalyticsSessionInput {
  id: string;
  date: string;
  durationMin?: number;
  duration?: number;
  focus?: string;
  split?: string;
  exercises: ReadonlyArray<{
    name?: string;
    exerciseName?: string;
    sets: ReadonlyArray<{ reps: number; weight: number; rpe?: number; rir?: number }>;
  }>;
}

function toSessionData(input: StructuredAnalyticsSessionInput): SessionData {
  return {
    id: input.id,
    date: input.date,
    // Нет записанной длительности — 0 («не задано» для движка), не фабрикуем минуты.
    durationMin:
      typeof input.durationMin === 'number'
        ? input.durationMin
        : typeof input.duration === 'number'
          ? input.duration
          : 0,
    focus: input.focus || input.split || 'fullbody',
    exercises: (input.exercises || []).map((ex) => ({
      name: ex.name || ex.exerciseName || 'Exercise',
      sets: (ex.sets || []).map((set) => ({
        reps: Number(set.reps) || 0,
        weight: Number(set.weight) || 0,
        // Ноль — «оценку не вводили»: RPE не фабрикуем.
        rpe: typeof set.rpe === 'number' && set.rpe > 0 ? set.rpe : 0,
        rir: typeof set.rir === 'number' ? set.rir : 0,
      })),
    })),
  };
}

const STATUS_COLOR: Record<string, string> = {
  optimal: '#22c55e',
  excellent: '#22c55e',
  good: '#60a5fa',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export const StructuredAnalyticsCard: React.FC<{ sessions: StructuredAnalyticsSessionInput[] }> = ({ sessions }) => {
  const result = React.useMemo<StructuredAnalyticsOutput | null>(() => {
    if (sessions.length === 0) return null;
    try {
      // Движок сравнивает отдельные текущий и прошлый периоды — делим историю
      // по дате пополам, иначе тренд 1RM всегда «нет сравнимых данных».
      const sorted = [...sessions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const half = Math.floor(sorted.length / 2);
      const previous = sorted.slice(0, half).map(toSessionData);
      const current = sorted.slice(half).map(toSessionData);
      if (current.length === 0) return null;
      return computeStructuredAnalytics(current, previous);
    } catch {
      return null;
    }
  }, [sessions]);
  if (!result) return null;

  const level1 = result.levels.find((l) => l.level === 1);
  const level2 = result.levels.find((l) => l.level === 2);
  const sessionCount = level1?.metrics.sessions ?? '—';
  const prevCount = level1?.metrics.previous ?? '—';
  const avgVolume = level2?.metrics.avgVolume;
  const patterns = [...result.patterns].sort((a, b) => b.currentVolume - a.currentVolume).slice(0, 3);
  const warnings = result.levels.filter((l) => l.status === 'warning' || l.status === 'critical').slice(0, 3);

  return (
    <div className="card train-structured" data-analytics="structured" style={{ marginTop: 8, padding: 10 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📊 Структурная аналитика</h4>
      <div style={{ fontSize: 10, color: '#fff' }}>
        Оценка:{' '}
        <b style={{ color: STATUS_COLOR[result.overallStatus.toLowerCase()] || '#fff' }}>{result.overallScore}/100</b> ·{' '}
        {result.overallStatus}
      </div>
      <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>
        Объём: <b>{avgVolume != null ? `${avgVolume} кг` : '—'}</b> · Сессий: <b>{sessionCount}</b> / прошлых:{' '}
        <b>{prevCount}</b>
      </div>
      {patterns.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {patterns.map((p) => {
            // Прогноз имеет смысл только там, где тренд 1RM вообще сравним.
            const forecast = p.rmComparable === true ? result.predictions.nextWeek1RM[p.pattern] : undefined;
            return (
              <div key={p.pattern} style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>
                <b>{p.pattern}</b> · {p.estimated1RM > 0 ? `${p.estimated1RM} кг` : '—'} ·{' '}
                {p.rmComparable === true ? (
                  <span style={{ color: p.estimated1RMTrend >= 0 ? '#22c55e' : '#ef4444' }}>
                    {p.estimated1RMTrend > 0 ? `+${p.estimated1RMTrend} %` : `${p.estimated1RMTrend} %`}
                  </span>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>нет сравнимых данных</span>
                )}
                {forecast != null && <span style={{ color: '#60a5fa' }}> → {forecast} кг</span>}
              </div>
            );
          })}
        </div>
      )}
      {warnings.map((l) => (
        <div key={l.level} style={{ fontSize: 10, color: STATUS_COLOR[l.status] || '#fff', marginTop: 2 }}>
          {l.status === 'critical' ? '⛔' : '⚠'} {l.insight}
        </div>
      ))}
    </div>
  );
};
