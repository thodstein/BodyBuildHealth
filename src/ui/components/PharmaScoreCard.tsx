import React, { useMemo, useState } from 'react';
import { analyzePharma } from '../../engines/score-pharma';
import type { ModuleResult } from '../../engines/score-engine';

interface PharmaScoreCardProps {
  course: Array<{ substanceId: string; dose: number; unit: string; weeks: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

const LEVEL_META: Record<string, { icon: string; color: string; bg:string; border:string }> = {
  low: { icon: '🟢', color: '#22c55e', bg:'rgba(34,197,94,0.10)', border:'rgba(34,197,94,0.16)' },
  moderate: { icon: '🟡', color: '#f59e0b', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.16)' },
  high: { icon: '🔴', color: '#ef4444', bg:'rgba(239,68,68,0.10)', border:'rgba(239,68,68,0.16)' },
};

export const PharmaScoreCard: React.FC<PharmaScoreCardProps> = ({ course, weight, age, sex }) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo<ModuleResult>(() => analyzePharma({ course, weight, age, sex }), [course, weight, age, sex]);
  if (!course || course.length === 0) return null;

  const d = result.details as any;
  const pkProfiles = d?.pkProfiles || [];
  const interactions = d?.interactions || [];
  const active = result.systems.filter(s => s.weightedScore > 5);
  const display = expanded ? active : active.slice(0, 4);
  const risk = result.overallRaw;
  const riskColor = risk >=60 ? '#ef4444' : risk>=30 ? '#f59e0b' : '#22c55e';
  const riskBg = risk>=60 ? 'rgba(239,68,68,0.12)' : risk>=30 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';

  return (
    <div style={{ background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:12, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
        <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.18)', fontSize:12 }}>💉</span>
        <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>PK/PD анализ</span>
        <span style={{ marginLeft:'auto', fontSize:11, fontWeight:800, padding:'4px 9px', borderRadius:20, background: riskBg, color: riskColor, border:`1px solid ${riskColor}22` }}>PD риск {risk}%</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:8 }}>
        {display.map(sys => {
          const meta = LEVEL_META[sys.level] || LEVEL_META.low;
          return (
            <div key={sys.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:10, background:'rgba(0,0,0,0.16)', border:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ width:20, height:20, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background: meta.bg, border:`1px solid ${meta.border}`, fontSize:9 }}>{meta.icon}</span>
              <span style={{ fontSize:11, color:'#fff', flex:1, fontWeight:600, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sys.label}</span>
              <span style={{ fontSize:11, fontWeight:800, color: meta.color, background: meta.bg, padding:'2px 7px', borderRadius:20, border:`1px solid ${meta.border}` }}>{sys.weightedScore}%</span>
              <div style={{ width:56, height:6, background:'rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden', flexShrink:0 }}>
                <div style={{ height:'100%', width:`${Math.min(sys.weightedScore, 100)}%`, background: meta.color, borderRadius:20, boxShadow:`0 0 8px ${meta.color}55` }} />
              </div>
            </div>
          );
        })}
      </div>
      {active.length > 4 && (
        <button onClick={() => setExpanded(!expanded)} style={{ background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.16)', color:'#a78bfa', fontSize:11, cursor:'pointer', padding:'6px 10px', fontWeight:700, borderRadius:20, width:'100%' }}>
          {expanded ? '▲ Свернуть' : `▼ Ещё ${active.length - 4} систем`}
        </button>
      )}
      {pkProfiles.length > 0 && (
        <div style={{ fontSize:10, color:'#fff', marginTop:8, background:'rgba(0,0,0,0.16)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(255,255,255,0.04)' }}>T½: {pkProfiles.map((p: any) => `${p.name} ${p.halfLifeHours}ч`).join(' • ')}</div>
      )}
      {interactions.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
          {interactions.slice(0, expanded ? 99 : 3).map((ix: any, i: number) => (
            <span key={i} style={{ padding:'4px 8px', borderRadius:20, fontSize:10, fontWeight:700,
              background: ix.type === 'synergy' ? 'rgba(34,197,94,0.10)' : ix.type === 'conflict' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
              color: ix.type === 'synergy' ? '#4ade80' : ix.type === 'conflict' ? '#f87171' : '#fbbf24',
              border:`1px solid ${ix.type==='synergy'?'rgba(34,197,94,0.16)': ix.type==='conflict'?'rgba(239,68,68,0.16)':'rgba(245,158,11,0.16)'}`,
            }}>{ix.type === 'synergy' ? '✓' : ix.type === 'conflict' ? '✕' : '!'} {ix.effect}</span>
          ))}
        </div>
      )}
      {result.recommendations.length > 0 && (
        <div style={{ fontSize:11, color:'#fbbf24', marginTop:8, background:'rgba(245,158,11,0.08)', padding:'7px 8px', borderRadius:9, border:'1px solid rgba(245,158,11,0.14)' }}>💡 {result.recommendations[0]}</div>
      )}
    </div>
  );
};

export default PharmaScoreCard;
