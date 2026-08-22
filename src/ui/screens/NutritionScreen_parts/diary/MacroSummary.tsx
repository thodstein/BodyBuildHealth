import React from 'react';

interface MacroSummaryProps {
  dayTotals: { kcal: number; p: number; f: number; c: number };
  targets?: { kcal: number; protein: number; fats: number; carbs: number };
}

export const MacroSummary: React.FC<MacroSummaryProps> = ({ dayTotals, targets }) => {
  const t = targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
  
  const items = [
    { l: 'Ккал', v: Math.round(dayTotals.kcal), t: t.kcal, u: '', c: '#00e68a', icon: '🔥', bg: 'rgba(0,230,138,0.08)' },
    { l: 'Белки', v: Math.round(dayTotals.p), t: t.protein, u: 'г', c: '#3b82f6', icon: '🥩', bg: 'rgba(59,130,246,0.08)' },
    { l: 'Жиры', v: Math.round(dayTotals.f), t: t.fats, u: 'г', c: '#f59e0b', icon: '🧈', bg: 'rgba(245,158,11,0.08)' },
    { l: 'Углев.', v: Math.round(dayTotals.c), t: t.carbs, u: 'г', c: '#f97316', icon: '🍞', bg: 'rgba(249,115,22,0.08)' },
  ];

  const remainingKcal = t.kcal - dayTotals.kcal;
  const isOverKcal = remainingKcal < 0;
  const kcalPct = t.kcal>0 ? Math.min(100, Math.round(dayTotals.kcal / t.kcal *100)) : 0;
  const r=14; const circ=2*Math.PI*r; const dash = circ * kcalPct/100;
  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {items.map(m => {
        const pct = m.t > 0 ? Math.min(100, Math.round(m.v / m.t * 100)) : 0;
        const isOver = pct > 100;
        return (
          <div key={m.l} style={{ 
          padding: '10px 8px', borderRadius: 14, background: m.bg, 
          border: `1px solid ${isOver ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, 
          display: 'flex', flexDirection: 'column', gap: 4, minHeight: 56,
          boxShadow: isOver ? '0 4px 12px rgba(239,68,68,0.15)' : '0 2px 8px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(6px)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: m.c, fontWeight: 600 }}>{m.icon} {m.l}</span>
              <span style={{ fontSize: 9, color: isOver ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: -0.5 }}>
              {m.v}<span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/{m.t}{m.u}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 2, background: isOver ? '#ef4444' : m.c, transition: 'width 0.4s' }} />
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ marginTop:6, padding:'6px 10px', borderRadius:10, background: isOverKcal ? 'rgba(239,68,68,0.08)' : 'rgba(0,230,138,0.06)', border:`1px solid ${isOverKcal ? 'rgba(239,68,68,0.2)' : 'rgba(0,230,138,0.12)'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <span style={{ fontSize:10, color: isOverKcal ? '#ef4444' : '#00e68a', fontWeight:700 }}>{isOverKcal ? `Перебор ${Math.abs(remainingKcal)} ккал` : `Осталось ${remainingKcal} ккал`}</span>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{isOverKcal ? '˃ цель' : `${Math.round(remainingKcal/t.kcal*100)}% от цели`}</span>
      </div>
      <div style={{ position:'relative', width:36, height:36, flexShrink:0 }}>
        <svg width={36} height={36} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          <circle cx={18} cy={18} r={r} fill="none" stroke={isOverKcal ? '#ef4444' : '#00e68a'} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} style={{ transition:'stroke-dasharray 0.5s' }} />
        </svg>
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color: isOverKcal ? '#ef4444' : '#00e68a' }}>{kcalPct}%</span>
      </div>
    </div>
    </>
  );
};
