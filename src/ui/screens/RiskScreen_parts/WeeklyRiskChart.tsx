import React from 'react';
import type { WeeklyRiskDynamics } from '../../../engines/weekly-risk-dynamics.engine';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface Props {
  dynamics: WeeklyRiskDynamics;
  selectedWeek: number | null;
  onWeekSelect: (w: number | null) => void;
  mode: 'week' | 'average';
  onModeChange: (m: 'week' | 'average') => void;
}

export const WeeklyRiskChart: React.FC<Props> = ({ dynamics, selectedWeek, onWeekSelect, mode, onModeChange }) => {
  const data = dynamics.weeks || [];
  if (data.length === 0) return <div style={{ color:'var(--text-dim)',textAlign:'center',padding:20 }}>Нет данных динамики</div>;

  const maxVal = Math.max(...data.map(d => Math.max(d.overallNet, d.overallRaw)), 5);
  const w = 320;
  const h = 180;
  const pad = { top: 10, right: 20, bottom: 30, left: 35 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const stepX = cw / Math.max(1, data.length - 1);

  const toX = (i: number) => pad.left + i * stepX;
  const toY = (v: number) => pad.top + ch - (v / maxVal) * ch;

  const rawPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.overallRaw)}`).join(' ');
  const netPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.overallNet)}`).join(' ');

  return (
    <div>
      <div style={{ display:'flex', gap:2, marginBottom:8, background:'var(--bg-secondary)', borderRadius:8, padding:2, width:'fit-content' }}>
        {(['average','week'] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            padding:'4px 12px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', border:'none',
            background: mode === m ? 'var(--accent)' : 'transparent',
            color: mode === m ? '#000' : 'var(--text-dim)', transition:'all 0.15s',
          }}>{m === 'average' ? 'Средний' : 'Понедельно'}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={pad.left} y1={toY(maxVal * f)} x2={w - pad.right} y2={toY(maxVal * f)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={pad.left - 4} y={toY(maxVal * f) + 3} fill="var(--text-dim)" fontSize={8} textAnchor="end">{Math.round(maxVal * f)}%</text>
          </g>
        ))}
        {/* Raw area */}
        <path d={`${rawPath} L${toX(data.length - 1)},${pad.top + ch} L${toX(0)},${pad.top + ch} Z`} fill="rgba(239,68,68,0.08)" />
        {/* Net area */}
        <path d={`${netPath} L${toX(data.length - 1)},${pad.top + ch} L${toX(0)},${pad.top + ch} Z`} fill="rgba(0,230,138,0.1)" />
        {/* Raw line */}
        <path d={rawPath} fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth={2} strokeDasharray="4 2" />
        {/* Net line */}
        <path d={netPath} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        {/* Dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.overallNet)} r={3} fill="var(--accent)" style={{ cursor:'pointer' }} onClick={() => onWeekSelect(i)} />
            <circle cx={toX(i)} cy={toY(d.overallRaw)} r={2} fill="#ef4444" opacity={0.6} />
            {selectedWeek === i && <circle cx={toX(i)} cy={toY(d.overallNet)} r={6} fill="none" stroke="var(--accent)" strokeWidth={2} />}
          </g>
        ))}
        {/* X axis labels */}
        {data.map((d, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 ? (
          <text key={`l${i}`} x={toX(i)} y={h - 8} fill="var(--text-dim)" fontSize={7} textAnchor="middle">Нед. {d.week}</text>
        ) : null)}
      </svg>
      {/* Legend */}
      <div style={{ display:'flex', gap:12, marginTop:6, fontSize:9, color:'var(--text-dim)', justifyContent:'center' }}>
        <span><span style={{ display:'inline-block', width:12, height:2, background:'var(--accent)', verticalAlign:'middle', marginRight:4 }} /> Net риск</span>
        <span><span style={{ display:'inline-block', width:12, height:2, background:'rgba(239,68,68,0.5)', verticalAlign:'middle', marginRight:4, border:'1px dashed #ef4444' }} /> Raw риск</span>
      </div>
    </div>
  );
};
