/** RIRCalibrationCard.tsx — сводка RIR-калибровки в стиле CalcSection/PopupToggle.
 *  Все raw-стили заменены на CalcSection/MetricCard. */
import React, { useMemo, useState } from 'react';
import { getCalibrationStats, clearCalibrationData, type RIRCalibrationStats } from '../../../engines/rir-calibration.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { recordSessionRIR } from '../../../engines/rir-calibration.engine';
import { applyToPlanner } from './planner-bridge';
import { CalcSection, PopupToggle, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';

export const RIRCalibrationCard: React.FC = () => {
  const [refresh, setRefresh] = useState(0);
  const [reprocessing, setReprocessing] = useState(false);
  const [applyOn, setApplyOn] = useState(false);

  const stats: RIRCalibrationStats | null = useMemo(() => {
    try { return getCalibrationStats(); } catch { return null; }
  }, [refresh]);

  const reprocessAll = () => {
    setReprocessing(true);
    try {
      clearCalibrationData();
      const sessions = loadSessions();
      const planFallback = { exercises: [] as { name: string; targetSets: { rir: number }[] }[] };
      sessions.forEach(s => { try { recordSessionRIR(s, planFallback); } catch { /* skip */ } });
      setRefresh(v => v + 1);
    } finally { setReprocessing(false); }
  };

  if (!stats || stats.totalSets === 0) {
    return (
      <CalcSection icon="🎯" title="RIR-калибровка" accent={ACCENT} desc="Нет данных. Заполняйте RPE в каждой тренировке">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4, padding: 8 }}>
          Нет данных для калибровки. Заполняйте RPE в каждой тренировке — чем больше данных, тем точнее корректировка RIR.
        </div>
        <button onClick={reprocessAll} disabled={reprocessing} style={{
          width: '100%', padding: '10px', borderRadius: 8, cursor: reprocessing ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 700,
        }}>
          {reprocessing ? '⏳ Обработка...' : '🔄 Переобработать из истории'}
        </button>
      </CalcSection>
    );
  }

  const topWorst = [...stats.exercises].sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias)).slice(0, 5);
  const topConsistent = [...stats.exercises].sort((a, b) => b.consistencyScore - a.consistencyScore).slice(0, 3);

  return (
    <CalcSection icon="🎯" title="RIR-калибровка" accent={ACCENT} desc={`${stats.totalSets} записанных подходов`}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <MetricCard title="Общий bias" accent="#60a5fa">
            <div style={{ fontSize: 16, fontWeight: 800, color: Math.abs(stats.overallAvgBias) > 1.5 ? '#ef4444' : Math.abs(stats.overallAvgBias) > 0.5 ? '#eab308' : '#22c55e' }}>
              {stats.overallAvgBias.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{stats.overallAvgBias > 0.5 ? 'Вы тяжелее, чем думаете' : stats.overallAvgBias < -0.5 ? 'Вы легче, чем думаете' : 'Точная оценка'}</div>
          </MetricCard>
          <MetricCard title="Согласованность" accent={stats.overallConsistency >= 0.7 ? '#22c55e' : '#eab308'}>
            <div style={{ fontSize: 16, fontWeight: 800, color: stats.overallConsistency >= 0.7 ? '#22c55e' : '#eab308' }}>
              {(stats.overallConsistency * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{stats.overallConsistency >= 0.7 ? 'Стабильная оценка' : 'Разброс >30%'}</div>
          </MetricCard>
        </div>

        {topWorst.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Топ-5 по отклонению</div>
              {topWorst.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{ex.exerciseName}</span>
                <span style={{ fontWeight: 700, color: Math.abs(ex.avgBias) > 1 ? '#ef4444' : '#eab308' }}>{ex.avgBias.toFixed(1)} (n={ex.totalPoints})</span>
              </div>
            ))}
          </div>
        )}

        {topConsistent.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>✅ Самые точные</div>
            {topConsistent.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{ex.exerciseName}</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{(ex.consistencyScore * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        <MetricCard title="Коррекция RIR" accent="#a855f7">
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
            {stats.overallAvgBias > 0.5
              ? `Рекомендуется RIR+${Math.round(stats.overallAvgBias)}: ваши RIR-оценки на ${Math.abs(stats.overallAvgBias).toFixed(1)} пункта жестче реальности.`
              : stats.overallAvgBias < -0.5
                ? `Рекомендуется RIR${Math.round(stats.overallAvgBias)}: вы недооцениваете интенсивность на ${Math.abs(stats.overallAvgBias).toFixed(1)} пункта.`
                : 'Ваши RIR-оценки точны. Продолжайте в том же духе.'}
          </div>
        </MetricCard>

        <PopupToggle label="Применить калибровку к плану" value={applyOn} onChange={v => { setApplyOn(v); if (v) applyToPlanner({ kind: 'pri', label: `RIR-калибровка: bias ${stats.overallAvgBias.toFixed(1)}`, data: { rirShift: Math.round(stats.overallAvgBias), volumeMult: 1 } }); }} icon="🔄" />

        <button onClick={reprocessAll} disabled={reprocessing} style={{
          width: '100%', marginTop: 6, padding: '8px', borderRadius: 8, cursor: reprocessing ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text-dim)', fontSize: 10, fontWeight: 600,
        }}>
          {reprocessing ? '⏳ Переобработка...' : '🔄 Переобработать калибровку из истории'}
        </button>
      </div>
    </CalcSection>
  );
};