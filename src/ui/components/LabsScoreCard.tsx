import React, { useMemo, useState } from 'react';
import { analyzeLabs } from '../../engines/score-labs';
import type { ModuleResult } from '../../engines/score-engine';

interface LabsScoreCardProps {
  markers: Array<{ id: string; value: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

const G: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(21,38,66,0.72), rgba(12,23,40,0.72))',
  border: '1px solid rgba(140,190,255,0.14)',
  borderRadius: 18,
  padding: 14,
};
const LEVEL_META: Record<string, { icon: string; color: string }> = {
  low: { icon: '🟢', color: '#22c55e' },
  moderate: { icon: '🟡', color: '#fbbf24' },
  high: { icon: '🔴', color: '#ef4444' },
};

export const LabsScoreCard: React.FC<LabsScoreCardProps> = ({ markers, weight, age, sex }) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo<ModuleResult>(() => analyzeLabs({ markers, weight, age, sex }), [markers, weight, age, sex]);
  if (!markers || markers.length === 0) return null;

  const active = result.systems.filter(s => s.weightedScore > 0);
  const display = expanded ? active : active.slice(0, 4);

  const riskColor = result.overallRaw >= 60 ? '#ef4444' : result.overallRaw >= 30 ? '#fbbf24' : '#22c55e';
  return (
    <div style={{ ...G, marginBottom:10, borderLeft:`3px solid ${riskColor}`, boxShadow:'0 10px 28px rgba(0,0,0,0.40)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, borderLeft:`3px solid ${riskColor}`, paddingLeft:10, marginBottom:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>🧪 Анализы Score Engine</div>
          <div style={{ fontSize:11, color:'#fff', marginTop:2 }}>{markers.length} маркеров в оценке</div>
        </div>
        <span style={{ fontSize:14, fontWeight:900, padding:'8px 12px', borderRadius:999, fontVariantNumeric:'tabular-nums',
          background: result.overallRaw >= 60 ? 'rgba(239,68,68,0.14)' : result.overallRaw >= 30 ? 'rgba(251,191,36,0.14)' : 'rgba(34,197,94,0.14)',
          border:`1px solid ${riskColor}40`,
          color: riskColor, flexShrink:0,
        }}>Risk {result.overallRaw}%</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {display.map(sys => {
          const meta = LEVEL_META[sys.level];
          return (
            <div key={sys.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(140,190,255,0.10)', borderLeft:`3px solid ${meta.color}`, minHeight:52 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{sys.icon}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#fff', flex:1, minWidth:0 }}>{sys.label}</span>
              <span style={{ fontSize:14, fontWeight:900, color:meta.color, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{sys.weightedScore}%</span>
              <div style={{ width:56, height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden', flexShrink:0 }}>
                <div style={{ height:'100%', width:`${Math.min(sys.weightedScore, 100)}%`, background:meta.color, borderRadius:999 }} />
              </div>
            </div>
          );
        })}
      </div>
      {active.length > 4 && (
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} style={{ background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', padding:'10px 16px', borderRadius:999, minHeight:44, marginTop:8, width:'100%' }}>
          {expanded ? '▲ Свернуть' : `▼ Ещё ${active.length - 4} систем`}
        </button>
      )}
      {result.recommendations.length > 0 && (
        <div style={{ fontSize:12, color:'#fbbf24', marginTop:8, lineHeight:1.5 }}>{result.recommendations[0]}</div>
      )}
    </div>
  );
};

export default LabsScoreCard;
