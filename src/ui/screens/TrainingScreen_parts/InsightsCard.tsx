/** InsightsCard.tsx — авто-инсайты дневника (ранее неиспользуемый diary-engine, 0/4).
 * REUSE: createSession/createSet/buildHistoryContext/generateInsights.
 * Источник: WorkoutLogs из StrengthDiary → маппинг в DiarySet[]/DiarySession[]. */
import React, { useState, useEffect, useMemo } from 'react';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import { buildHistoryContext, generateInsights, type AutoInsight } from '../../../engines/diary-insights.engine';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };

const TYPE_COLOR: Record<AutoInsight['type'], string> = { positive: '#22c55e', negative: '#ef4444', warning: '#eab308', info: '#60a5fa' };
const TYPE_ICON: Record<AutoInsight['type'], string> = { positive: '✅', negative: '⛔', warning: '⚠️', info: '💡' };

export const InsightsCard: React.FC = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = new StrengthDiary();
        const w = await d.getWorkoutLogs();
        setLogs(w.reverse());
      } catch { setLogs([]); }
      setLoading(false);
    })();
  }, []);

  const { insights, ctx } = useMemo(() => {
    if (logs.length === 0) return { insights: [], ctx: null };
    const sessions = logs.map(w => ({
      sessionId: w.id, date: w.date, focus: w.split || 'fullbody', durationMin: w.duration || 0,
      completed: true, terminatedEarly: false, sessionVolume: w.exercises.reduce((s, e) => s + (e.totalVolume || 0), 0),
      sessionIntensity: w.overallRPE || 5, overallRPE: w.overallRPE || 5, notes: w.notes || '',
    }));
    const sets: any[] = [];
    const prevSets: any[] = [];
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    for (const w of logs) {
      const isCurrent = new Date(w.date) >= weekAgo;
      const isPrev = new Date(w.date) >= twoWeeksAgo && new Date(w.date) < weekAgo;
      for (const ex of w.exercises || []) {
        for (let i = 0; i < (ex.sets || []).length; i++) {
          const st = ex.sets[i];
          const setData = {
            setId: ex.id + '_' + i, sessionId: w.id, exerciseId: ex.exerciseId, exerciseName: ex.exerciseName,
            setIndex: i + 1, targetReps: st.reps, targetWeight: st.weight, actualReps: st.reps, actualWeight: st.weight,
            actualRPE: st.rpe || 5, actualRIR: st.rir ?? 3, errors: [], restSeconds: 120, terminatedEarly: false,
            techniqueScore: (st as any).techniqueScore,
          };
          if (isCurrent) sets.push(setData);
          else if (isPrev) prevSets.push(setData);
        }
      }
    }
    const c = buildHistoryContext(sets, sessions);
    const ins = generateInsights(sets, sessions, prevSets);
    return { insights: ins, ctx: c };
  }, [logs]);

  const last1RM = useMemo(() => ctx ? Object.entries(ctx.last1RMs).sort((a, b) => b[1] - a[1]).slice(0, 6) : [], [ctx]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>💡 Авто-инсайты дневника</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Автоматический анализ тренировочного дневника: тренды силы, усталости, техники, объёма, регулярности и восстановления. Ранее diary-engine (generateInsights/buildHistoryContext) не использовался в UI.
      </div>

      {loading && <div style={{ color: DIM, fontSize: 11 }}>Загрузка дневника...</div>}

      {!loading && logs.length === 0 && (
        <div style={CARD}><div style={{ color: DIM, fontSize: 11, textAlign: 'center' }}>Нет записанных тренировок. Запишите тренировку во вкладке «Тренировка» (проведение), чтобы появились инсайты.</div></div>
      )}

      {!loading && ctx && (
        <>
          <div style={CARD}>
            <div style={H}>📊 Сводка истории</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 10, color: DIM }}>Всего тренировок</div><div style={{ fontSize: 16, fontWeight: 700 }}>{ctx.totalSessions}</div></div>
              <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 10, color: DIM }}>Объём за неделю</div><div style={{ fontSize: 14, fontWeight: 700 }}>{ctx.weeklyVolume.toLocaleString()} кг·пов</div></div>
              <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 10, color: DIM }}>Серия</div><div style={{ fontSize: 16, fontWeight: 700 }}>{ctx.currentStreak} <span style={{ fontSize: 10, color: DIM }}>/ {ctx.bestStreak}</span></div></div>
            </div>
            {ctx.firstSessionDate && <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>первая запись: {ctx.firstSessionDate}</div>}
          </div>

          {last1RM.length > 0 && (
            <div style={CARD}>
              <div style={H}>💪 Текущие 1RM (по дневнику)</div>
              {last1RM.map(([name, rm]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                  <span style={{ color: '#fff' }}>{name}</span>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>{rm} кг</span>
                </div>
              ))}
            </div>
          )}

          <div style={CARD}>
            <div style={H}>💡 Инсайты ({insights.length})</div>
            {insights.length === 0
              ? <div style={{ fontSize: 10, color: DIM }}>Недостаточно данных для инсайтов.</div>
              : insights.map((ins, i) => (
                <div key={i} style={{ marginBottom: 6, padding: 10, borderRadius: 8, background: (TYPE_COLOR[ins.type] || ACCENT) + '0a', border: '1px solid ' + (TYPE_COLOR[ins.type] || ACCENT) + '33' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[ins.type] || ACCENT }}>{TYPE_ICON[ins.type] || '•'} {ins.message}</div>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{ins.detail}</div>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2, textTransform: 'uppercase' }}>{ins.category}</div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
};
