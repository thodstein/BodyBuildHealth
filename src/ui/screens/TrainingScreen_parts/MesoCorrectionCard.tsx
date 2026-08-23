import React, { useMemo } from 'react';
import { analyzeMesoCycle, loadRirCalibrationStats, type MesoCorrectionInput } from '../../../engines/meso-correction.engine';
import type { TrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };

interface Props {
  profile: TrainingProfile;
  acwr: number;
  monotony: number;
  avgReadiness: number;
  mesoWeeks: number;
  missedSessions: number;
  exercises: Array<{ name: string; e1rmBefore: number; e1rmAfter: number }>;
  currentVolume: number;
  currentRir: number;
}

const MesoCorrectionCard: React.FC<Props> = ({
  profile, acwr, monotony, avgReadiness, mesoWeeks, missedSessions,
  exercises, currentVolume, currentRir,
}) => {
  const input: MesoCorrectionInput = useMemo(() => {
    const rirStats = loadRirCalibrationStats();
    return {
      exercises,
      rirBias: rirStats.bias,
      rirConsistency: rirStats.consistency,
      mesoWeeks,
      avgAcwr: acwr,
      monotony,
      avgReadiness,
      missedSessions,
      profile,
      currentVolume,
      currentRir,
    };
  }, [exercises, mesoWeeks, acwr, monotony, avgReadiness, missedSessions, profile, currentVolume, currentRir]);

  const output = useMemo(() => analyzeMesoCycle(input), [input]);

  const severityColor = (s: string) => {
    if (s === 'critical') return '#ff4444';
    if (s === 'warning') return '#ffaa00';
    return ACCENT;
  };

  return (
    <div style={GLASS}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🔄 Анализ и коррекция мезоцикла</div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>{output.comment}</div>

      {/* Итоговые параметры */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Объём</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: output.recommendedVolume > currentVolume ? ACCENT : '#ff4444' }}>
            {output.recommendedVolume} <span style={{ fontSize: 10, color: '#fff' }}>сетов</span>
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>было {currentVolume}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>RIR</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: output.recommendedRir !== currentRir ? '#ffaa00' : ACCENT }}>
            {output.recommendedRir}
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>было {currentRir}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Делоад</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: output.needsDeloadFirst ? '#ff4444' : ACCENT }}>
            {output.needsDeloadFirst ? '⚠ Нужен' : output.recommendedDeloadFreq + ' нед'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Прогрессия</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>
            +{output.recommendedProgressionPct}%
          </div>
        </div>
      </div>

      {/* Список корректировок */}
      {output.adjustments.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: severityColor(a.severity), flexShrink: 0 }}>
            {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}
          </span>
          <span style={{ color: '#fff' }}>{a.reason}</span>
        </div>
      ))}
<div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить коррекцию мезоцикла к планировщику — рекомендуемый объём {output.recommendedVolume} сет/нед, RIR→{output.recommendedRir}, делод каждые {output.recommendedDeloadFreq} нед.</div>
        <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'Мезо-коррекция: MRV ' + output.recommendedVolume + ' сет/нед, RIR→' + output.recommendedRir, data: { mrv: output.recommendedVolume } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить коррекцию мезо к планировщику</button>
      </div>
    </div>
  );
};

export default MesoCorrectionCard;
