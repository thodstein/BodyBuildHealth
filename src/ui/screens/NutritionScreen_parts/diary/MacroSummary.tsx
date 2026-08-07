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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {items.map(m => {
        const pct = m.t > 0 ? Math.min(100, Math.round(m.v / m.t * 100)) : 0;
        const isOver = pct > 100;
        return (
          <div key={m.l} style={{ 
          padding: '10px 8px', borderRadius: 14, background: m.bg, 
          border: `1px solid ${isOver ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, 
          display: 'flex', flexDirection: 'column', gap: 4, minHeight: 44,
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
  );
};
