/**
 * RIRCalibrationCard.tsx — сводка RIR-калибровки.
 * Показывает общий bias, согласованность, топ-упражнений по отклонению,
 * скорректированные RIR-рекомендации.
 */
import React, { useMemo, useState } from 'react';
import { getCalibrationStats, clearCalibrationData, type RIRCalibrationStats } from '../../../engines/rir-calibration.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { recordSessionRIR } from '../../../engines/rir-calibration.engine';
import { applyToPlanner } from './planner-bridge';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };

export const RIRCalibrationCard: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [reprocessing, setReprocessing] = useState(false);

  const stats: RIRCalibrationStats | null = useMemo(() => {
    try { return getCalibrationStats(); } catch { return null; }
  }, [refresh]);

  const reprocessAll = () => {
    setReprocessing(true);
    try {
      clearCalibrationData();
      const sessions = loadSessions();
      const planFallback = { exercises: [] as { name: string; targetSets: { rir: number }[] }[] };
      sessions.forEach(s => {
        try { recordSessionRIR(s, planFallback); } catch { /* skip */ }
      });
      setRefresh(v => v + 1);
    } finally { setReprocessing(false); }
  };

  if (!stats || stats.totalSets === 0) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>🎯 RIR-калибровка</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Нет данных для калибровки. Заполняйте RPE в каждой тренировке — чем больше данных, тем точнее корректировка RIR.
        </div>
        <button style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 10, cursor: 'pointer', minHeight: 32 }} onClick={reprocessAll} disabled={reprocessing}>
          {reprocessing ? 'Обработка...' : 'Переобработать из истории тренировок'}
        </button>
      </div>
    );
  }

  const topWorst = [...stats.exercises].sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias)).slice(0, 5);
  const topConsistent = [...stats.exercises].sort((a, b) => b.consistencyScore - a.consistencyScore).slice(0, 3);

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>🎯 RIR-калибровка</div>
        <button style={{ padding: '4px 8px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: 9, cursor: 'pointer', minHeight: 28 }} onClick={() => { setRefresh(v => v + 1); }}>🔄</button>
      </div>

      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: Math.abs(stats.overallAvgBias) > 1 ? '#ef4444' : Math.abs(stats.overallAvgBias) > 0.3 ? '#eab308' : ACCENT }}>
            {stats.overallAvgBias > 0 ? '+' : ''}{stats.overallAvgBias}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Общий bias RIR</div>
        </div>
        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: stats.overallConsistency >= 70 ? ACCENT : stats.overallConsistency >= 40 ? '#eab308' : '#ef4444' }}>
            {stats.overallConsistency}%
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Согласованность</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
        bias &gt; 0: выполняете легче плана · bias &lt; 0: тяжелее плана · всего {stats.totalSets} подходов, {stats.totalExercises} упражнений
      </div>

      {/* Упражнения с наибольшим отклонением */}
      {topWorst.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={LABEL}>🔴 Наибольшее отклонение</div>
          {topWorst.map((ex, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
              <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
              <span style={{ color: Math.abs(ex.avgBias) > 1 ? '#ef4444' : '#eab308' }}>
                bias {ex.avgBias > 0 ? '+' : ''}{ex.avgBias} · {ex.totalPoints} подходов
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Самые стабильные */}
      {topConsistent.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={LABEL}>🟢 Лучшая согласованность</div>
          {topConsistent.map((ex, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10 }}>
              <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
              <span style={{ color: ACCENT }}>{ex.consistencyScore}% · bias {ex.avgBias > 0 ? '+' : ''}{ex.avgBias}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bias-интерпретация */}
      <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
        {stats.overallAvgBias > 1
          ? '⚠ Вы систематически недобираете RIR на ' + stats.overallAvgBias + '. Пробуйте увеличить вес на 2.5-5% или добавлять +1 повтор.'
          : stats.overallAvgBias < -1
          ? '⚠ Вы систематически перебираете RIR на ' + Math.abs(stats.overallAvgBias) + '. Снизьте вес на 2.5-5% или увеличьте RIR на 1.'
          : '✅ Ваше восприятие RIR близко к плановому. Хорошая работа!'}
      </div>

      {/* Кнопка переобработки */}
      <button style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: 9, cursor: 'pointer', minHeight: 28 }} onClick={reprocessAll} disabled={reprocessing}>
        {reprocessing ? 'Обработка...' : '🔄 Переобработать из истории'}
      </button>
      {stats && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить RIR-калибровку (bias {stats.overallAvgBias > 0 ? '+' : ''}{stats.overallAvgBias}) к планировщику — целевой RIR всех упражнений плана сместится на {stats.overallAvgBias > 0 ? '+' : ''}{stats.overallAvgBias}.</div>
          <button onClick={() => applyToPlanner({ kind: 'rir', label: 'RIR-калибровка ' + (stats.overallAvgBias > 0 ? '+' : '') + stats.overallAvgBias, data: { rirShift: stats.overallAvgBias } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить RIR-коррекцию к планировщику</button>
        </div>
      )}
    </div>
  );
};

export default RIRCalibrationCard;
