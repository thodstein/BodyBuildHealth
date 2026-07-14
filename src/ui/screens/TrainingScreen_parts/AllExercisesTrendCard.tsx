import React, { useMemo } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { getAllExerciseProgressions, type ExerciseProgressionData } from '../../../engines/log-analytics-progression.engine';

const EXERCISE_KEYS: Record<string, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга',
  'bench press': 'Жим лёжа', overhead_press: 'Жим стоя', row: 'Тяга штанги',
  pulldown: 'Тяга вертикальная', 'barbell row': 'Тяга штанги',
  dip: 'Отжимания на брусьях', pullup: 'Подтягивания',
};

const AllExercisesTrendCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const progressions = useMemo(() => {
    if (!sessions.length) return [];
    const logs: any[] = [];
    sessions.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
      (e.sets || []).forEach((s: any) => {
        logs.push({
          date: w.date, exerciseName: e.exerciseName || e.exerciseId || '—',
          setNumber: s.setIndex || 0, weightKg: s.weight || 0, reps: s.reps || 0,
          rpe: s.rpe || 7, rir: s.rir || 3, restSec: s.rest || 90, tempo: '', isPR: false,
        });
      });
    }));
    const all = getAllExerciseProgressions(logs);
    return all.sort((a, b) => b.current1RM - a.current1RM);
  }, [sessions]);

  const totalTrend = useMemo(() => {
    if (progressions.length === 0) return null;
    const sum = progressions.reduce((s, p) => s + (p.progressPerWeek || 0), 0);
    return sum / progressions.length;
  }, [progressions]);

  if (!progressions.length) return null;

  return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
        📊 Сводная таблица прогрессии e1RM по всем упражнениям
        {totalTrend !== null && (
          <span style={{ fontSize: 10, marginLeft: 8, color: totalTrend > 0 ? '#22c55e' : totalTrend < 0 ? '#ef4444' : 'var(--text-dim)' }}>
            Общий тренд: {totalTrend > 0 ? '+' : ''}{totalTrend.toFixed(1)}%/нед
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{progressions.length} упражнений</div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: '3px 4px' }}>Упражнение</th>
              <th style={{ textAlign: 'right', padding: '3px 4px' }}>Текущий e1RM</th>
              <th style={{ textAlign: 'right', padding: '3px 4px' }}>Тренд</th>
              <th style={{ textAlign: 'right', padding: '3px 4px' }}>+/− кг/нед</th>
              <th style={{ textAlign: 'right', padding: '3px 4px' }}>Плато (нед)</th>
            </tr>
          </thead>
          <tbody>
            {progressions.map((p, i) => {
              const trendColor = p.trend === 'strongly_up' || p.trend === 'up' ? '#22c55e'
                : p.trend === 'down' || p.trend === 'strongly_down' ? '#ef4444' : 'var(--text-dim)';
              return (
                <tr key={p.exercise} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '3px 4px', color: 'var(--text)' }}>
                    <span title={p.exercise}>{p.exercise.length > 22 ? p.exercise.slice(0, 20) + '…' : p.exercise}</span>
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, color: '#00e68a' }}>
                    {p.current1RM} кг
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: trendColor }}>
                    {p.trend === 'strongly_up' ? '↑↑' : p.trend === 'up' ? '↑' : p.trend === 'down' ? '↓' : p.trend === 'strongly_down' ? '↓↓' : '→'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: p.progressPerWeek > 0 ? '#22c55e' : p.progressPerWeek < 0 ? '#ef4444' : 'var(--text-dim)' }}>
                    {p.progressPerWeek > 0 ? '+' : ''}{p.progressPerWeek.toFixed(1)}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: p.plateauWeeks >= 3 ? '#ef4444' : 'var(--text-dim)' }}>
                    {p.plateauWeeks >= 3 ? `⚠ ${p.plateauWeeks}` : p.plateauWeeks}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {progressions.filter(p => p.plateauWeeks >= 3).length > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '4px 6px' }}>
          ⚠ {progressions.filter(p => p.plateauWeeks >= 3).length} упражнений в плато ≥3 нед. Рекомендуется смена программы или делод.
        </div>
      )}
    </div>
  );
};

export default React.memo(AllExercisesTrendCard);
