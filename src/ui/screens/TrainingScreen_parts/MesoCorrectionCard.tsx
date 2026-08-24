import React, { useMemo } from 'react';
import { analyzeMesoCycle, loadRirCalibrationStats, type MesoCorrectionInput } from '../../../engines/meso-correction.engine';
import type { TrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background:'rgba(24,24,27,0.42)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', borderRadius:14, padding:12 } as any;

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
    if (s === 'critical') return '#ef4444';
    if (s === 'warning') return '#f59e0b';
    return ACCENT;
  };

  return (
    <div style={GLASS}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
        <div style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff', fontWeight:900, fontSize:13, flexShrink:0 }}>🔄</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>Коррекция мезоцикла</div>
      </div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 10, lineHeight:1.5, opacity:0.92 }}>{output.comment}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 9, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.7, marginBottom: 3, fontWeight:700 }}>Объём</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: output.recommendedVolume > currentVolume ? '#fff' : '#fbbf24' }}>
            {output.recommendedVolume} <span style={{ fontSize: 9, color: '#fff', opacity:0.7 }}>сетов</span>
          </div>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.6 }}>было {currentVolume}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 9, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.7, marginBottom: 3, fontWeight:700 }}>RIR</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
            {output.recommendedRir}
          </div>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.6 }}>было {currentRir}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 9, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.7, marginBottom: 3, fontWeight:700 }}>Делоад</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: output.needsDeloadFirst ? '#ef4444' : '#fff' }}>
            {output.needsDeloadFirst ? '⚠ Нужен' : output.recommendedDeloadFreq + ' нед'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 9, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#fff', opacity:0.7, marginBottom: 3, fontWeight:700 }}>Прогрессия</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>
            +{output.recommendedProgressionPct}%
          </div>
        </div>
      </div>

      {output.adjustments.length>0 && (
        <div style={{ padding:8, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:10 }}>
          {output.adjustments.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', fontSize: 10, borderBottom: i < output.adjustments.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ color: severityColor(a.severity), flexShrink: 0, fontSize:11 }}>
                {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}
              </span>
              <span style={{ color: '#fff', lineHeight:1.4 }}>{a.reason}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8, lineHeight:1.4, opacity:0.92 }}>Рекомендуемый объём {output.recommendedVolume} сет/нед, RIR→{output.recommendedRir}, делоад каждые {output.recommendedDeloadFreq} нед — одной кнопкой в планировщик.</div>
        <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'Мезо-коррекция: MRV ' + output.recommendedVolume + ' сет/нед, RIR→' + output.recommendedRir, data: { mrv: output.recommendedVolume } })} style={{ width: '100%', padding: 11, borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 11, minHeight: 40 }}>🛠 Применить коррекцию мезо к планировщику</button>
      </div>
    </div>
  );
};

export default MesoCorrectionCard;
