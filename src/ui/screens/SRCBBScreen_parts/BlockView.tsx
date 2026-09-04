import React from 'react';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';

export const BlockView: React.FC<{ plan: LMSBuildOutput | null }> = ({ plan }) => {
  if (!plan || !plan.weeks.length) return <div className="pl-blockview" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: 8 }}>Нет плана — соберите цикл или сезон</div>;
  const weeks = plan.weeks;
  const maxDays = Math.max(...weeks.map(w => w.days.length));
  // e1RM тренд по неделям (средний по всем lifts, для velocity cap)
  const e1rmTrend = weeks.map(w => {
    const avg = w.days.reduce((a,d)=>a+d.exercises.reduce((aa,e)=>aa+e.workSets.reduce((aaa,ws)=>aaa+ws.weight/(ws.pct||0.7),0)/e.workSets.length,0)/d.exercises.length,0)/w.days.length;
    return Math.round(avg);
  });
  return (
    <div className="pl-blockview" style={{ overflowX: 'auto', marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${weeks.length}, 1fr)`, gap: 4, minWidth: 600 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', padding: 6 }}>День / Нед</div>
        {weeks.map(w => (
          <div key={w.week} style={{ fontSize: 10, fontWeight: 800, color: w.taperWeek ? '#f59e0b' : w.meetWeek ? '#ef4444' : '#fff', background: w.taperWeek ? 'rgba(245,158,11,0.1)' : w.meetWeek ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
            Нед {w.week} {w.taperWeek ? '📉' : w.meetWeek ? '🏁' : ''} {w.macroPhase ? `· ${w.macroPhase}` : ''}
          </div>
        ))}
        {Array.from({ length: maxDays }, (_, di) => (
          <React.Fragment key={di}>
            <div style={{ fontSize: 10, color: '#a78bfa', padding: 6, background: 'rgba(139,92,246,0.06)', borderRadius: 6 }}>День {di + 1}</div>
            {weeks.map(w => {
              const d = w.days[di];
              if (!d) return <div key={w.week + '-' + di} style={{ padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }} />;
              return (
                <div key={w.week + '-' + di} style={{ padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 10, lineHeight: 1.4 }}>
                  {d.exercises.slice(0, 3).map((e, ei) => (
                    <div key={ei} style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b>{e.name}</b> {e.workSets.map(ws => `${ws.sets}×${ws.reps}@${Math.round(ws.pct*100)}%`).join(' ')} RIR{e.rir}
                    </div>
                  ))}
                  {d.exercises.length > 3 && <div style={{ color: 'rgba(255,255,255,0.5)' }}>+{d.exercises.length - 3} упр</div>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>PowerSheets-стиль: недели side-by-side, RPE/RIR/%/вес в одной строке. e1RM тренд: {e1rmTrend.join(' → ')} кг. Прокрутите горизонтально.</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>First-rep velocity cap: падение &gt;8% от нед 1 → volume -20% (VBT). MVT squat 0.25 м/с.</div>
    </div>
  );
};
