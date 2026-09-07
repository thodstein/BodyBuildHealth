import React, { useState, useMemo } from 'react';
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
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const displayWeek = hoverWeek != null ? hoverWeek : selectedWeek;

  if (data.length === 0) return <div style={{ color:'#fff',textAlign:'center',padding:20 }}>Нет данных динамики</div>;

  const maxVal = Math.max(...data.map(d => Math.max(d.overallNet, d.overallRaw)), 5);
  const pad = { top: 14, right: 16, bottom: 30, left: 38 };
  const chartW = 340;
  const chartH = 190;
  const cw = chartW - pad.left - pad.right;
  const ch = chartH - pad.top - pad.bottom;
  const stepX = cw / Math.max(1, data.length - 1);

  const toX = (i: number) => pad.left + i * stepX;
  const toY = (v: number) => pad.top + ch - (v / maxVal) * ch;

  const rawPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.overallRaw)}`).join(' ');
  const netPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.overallNet)}`).join(' ');

  const activePoint = displayWeek != null && displayWeek >= 0 && displayWeek < data.length ? data[displayWeek] : null;

  return (
    <div className="card risk-weekly-chart" style={{ padding: 16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>📈 Динамика рисков</span>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:999, padding:3 }}>
          {(['average','week'] as const).map(m => (
            <button key={m} onClick={() => onModeChange(m)} style={{
              minHeight:44, padding:'10px 18px', borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', border:'none',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#000' : '#fff', transition:'all 0.15s',
            }}>{m === 'average' ? 'Средний' : 'Понедельно'}</button>
          ))}
        </div>
      </div>

      {/* Hover/Selected values card */}
      {activePoint && (
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Нед. {activePoint.week}</div>
          <div style={{ fontSize:13, fontWeight:800, color:getRiskColor(activePoint.overallNet) }}>Net: {Math.round(activePoint.overallNet)}%</div>
          <div style={{ fontSize:13, fontWeight:800, color:getRiskColor(activePoint.overallRaw) }}>Raw: {Math.round(activePoint.overallRaw)}%</div>
        </div>
      )}

      <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = toY(maxVal * f);
          return (
            <g key={f}>
              <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
              <text x={pad.left - 4} y={y + 3} fill="#fff" fontSize={10} fontWeight={700} textAnchor="end">{Math.round(maxVal * f)}%</text>
            </g>
          );
        })}

        {/* Raw area fill */}
        <path d={`${rawPath} L${toX(data.length - 1)},${pad.top + ch} L${toX(0)},${pad.top + ch} Z`} fill="rgba(239,68,68,0.06)" />
        {/* Net area fill */}
        <path d={`${netPath} L${toX(data.length - 1)},${pad.top + ch} L${toX(0)},${pad.top + ch} Z`} fill="rgba(0,230,138,0.08)" />

        {/* Raw line — bold and visible */}
        <path d={rawPath} fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        {/* Net line */}
        <path d={netPath} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* Raw dots */}
        {data.map((d, i) => (
          <circle key={`r${i}`} cx={toX(i)} cy={toY(d.overallRaw)} r={3} fill="#ef4444" opacity={0.7} />
        ))}

        {/* Net dots */}
        {data.map((d, i) => (
          <circle key={`n${i}`} cx={toX(i)} cy={toY(d.overallNet)} r={4} fill="var(--accent)"
            style={{ cursor:'pointer' }}
            onClick={() => onWeekSelect(i)}
            onMouseEnter={() => setHoverWeek(i)}
            onMouseLeave={() => setHoverWeek(null)} />
        ))}

        {/* Selected week highlight */}
        {displayWeek != null && displayWeek >= 0 && displayWeek < data.length && (
          <>
            <line x1={toX(displayWeek)} y1={pad.top} x2={toX(displayWeek)} y2={pad.top + ch}
              stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
            <circle cx={toX(displayWeek)} cy={toY(data[displayWeek].overallNet)} r={7} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
            <circle cx={toX(displayWeek)} cy={toY(data[displayWeek].overallRaw)} r={5} fill="none" stroke="#ef4444" strokeWidth={2} />
          </>
        )}

        {/* X axis labels */}
        {data.map((d, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 ? (
          <text key={`l${i}`} x={toX(i)} y={chartH - 8} fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">Нед.{d.week}</text>
        ) : null)}
      </svg>

      {/* Slider for week selection — APK: крупный тач */}
      <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:12, fontWeight:800, color:'#fff', whiteSpace:'nowrap', minWidth:30, textAlign:'right' }}>
          {data.length > 0 ? `1` : ''}
        </span>
        <input type="range" min={0} max={Math.max(0, data.length - 1)} value={displayWeek ?? 0}
          onChange={e => {
            const idx = Number(e.target.value);
            onWeekSelect(idx);
            setHoverWeek(null);
          }}
          style={{ flex:1, accentColor:'var(--accent)', height:28, cursor:'pointer' }} />
        <span style={{ fontSize:12, fontWeight:800, color:'#fff', whiteSpace:'nowrap', minWidth:30 }}>
          {data.length > 0 ? `${data.length}` : ''}
        </span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'0 2px', marginTop:2 }}>
        {data.slice(0, Math.min(7, data.length)).map((d, i) => {
          const idx = Math.round((data.length - 1) * i / 6);
          return (
            <span key={i} onClick={() => { onWeekSelect(idx); setHoverWeek(null); }} style={{
              width:6, height:6, borderRadius:'50%', cursor:'pointer',
              background: displayWeek === idx ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
              transition:'all 0.2s',
            }} />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginTop:10, fontSize:12, fontWeight:700, color:'#fff', justifyContent:'center' }}>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:16, height:3, background:'var(--accent)', borderRadius:2 }} /> Net риск
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:16, height:3, background:'#ef4444', borderRadius:2 }} /> Raw риск
        </span>
      </div>
    </div>
  );
};
