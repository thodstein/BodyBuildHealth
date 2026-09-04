import React, { useMemo } from 'react';
import { formatDate } from '../../../../core/utils/date-utils';

interface WeekViewProps {
  diaryData: Record<string, any>;
  targets: { kcal: number; protein: number; fats: number; carbs: number };
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({ diaryData, targets, selectedDate, onSelectDate }) => {
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });
  }, [weekStart]);

  const daysData = useMemo(() => {
    return weekDays.map(date => {
      const day = diaryData[date];
      if (!day?.meals) return { date, kcal: 0, p: 0, f: 0, c: 0, meals: 0, items: 0 };
      const items = Object.values(day.meals).filter(Array.isArray).flat();
      const kcal = items.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
      const p = items.reduce((s: number, i: any) => s + (i.p || 0), 0);
      const f = items.reduce((s: number, i: any) => s + (i.f || 0), 0);
      const c = items.reduce((s: number, i: any) => s + (i.c || 0), 0);
      return { date, kcal, p, f, c, meals: Object.keys(day.meals).length, items: items.length };
    });
  }, [diaryData, weekDays]);

  const weeklyTotals = useMemo(() => {
    return daysData.reduce((acc, d) => ({
      kcal: acc.kcal + d.kcal,
      p: acc.p + d.p,
      f: acc.f + d.f,
      c: acc.c + d.c,
      meals: acc.meals + d.meals,
      days: acc.days + (d.meals > 0 ? 1 : 0),
    }), { kcal: 0, p: 0, f: 0, c: 0, meals: 0, days: 0 });
  }, [daysData]);

  const avgKcal = weeklyTotals.days > 0 ? Math.round(weeklyTotals.kcal / weeklyTotals.days) : 0;
  const avgP = weeklyTotals.days > 0 ? Math.round(weeklyTotals.p / weeklyTotals.days * 10) / 10 : 0;
  const avgF = weeklyTotals.days > 0 ? Math.round(weeklyTotals.f / weeklyTotals.days * 10) / 10 : 0;
  const avgC = weeklyTotals.days > 0 ? Math.round(weeklyTotals.c / weeklyTotals.days * 10) / 10 : 0;

  const today = formatDate(new Date());
  const weekRangeLabel = (() => {
    try {
      const a = new Date(weekDays[0]); const b = new Date(weekDays[6]);
      const sameMonth = a.getMonth()===b.getMonth();
      const fmt = (d:Date) => d.toLocaleDateString('ru-RU', { day:'numeric', month: sameMonth ? undefined : 'short' });
      return `${fmt(a)} — ${fmt(b)} ${b.toLocaleDateString('ru-RU',{month:'long', year:'numeric'})}`;
    } catch { return ''; }
  })();

  return (
    <div className="nut-weekview" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Weekly summary — enhanced */}
      <div style={{ padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow:'0 6px 24px rgba(0,0,0,0.18)', backdropFilter:'blur(8px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 12 }}>
          <span style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, boxShadow:'0 2px 8px rgba(0,230,138,0.25)' }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing:-0.2 }}>Итоги недели</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>{weekRangeLabel} • {weeklyTotals.days}/7 дн заполнено</div>
          </div>
          <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, padding:'4px 8px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>{weeklyTotals.days ? `${Math.round(weeklyTotals.days/7*100)}%` : '0%'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { l: 'Ккал/день', v: avgKcal, t: targets.kcal, c: '#00e68a', bg:'rgba(0,230,138,0.08)', icon:'🔥' },
            { l: 'Белки/день', v: avgP, t: targets.protein, c: '#3b82f6', bg:'rgba(59,130,246,0.08)', u: 'г', icon:'🥩' },
            { l: 'Жиры/день', v: avgF, t: targets.fats, c: '#f59e0b', bg:'rgba(245,158,11,0.08)', u: 'г', icon:'🧈' },
            { l: 'Угл./день', v: avgC, t: targets.carbs, c: '#a78bfa', bg:'rgba(167,139,250,0.08)', u: 'г', icon:'🍞' },
          ].map(m => {
            const pct = m.t > 0 ? Math.min(100, Math.round((m.v || 0) / m.t * 100)) : 0;
            const isLow = pct < 70; const isGood = pct>=85 && pct<=115;
            return (
              <div key={m.l} style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 14, background: m.bg, border:`1px solid ${isGood ? m.c+'30' : isLow ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.06)'}`, boxShadow: isGood ? `0 4px 12px ${m.c}15` : '0 2px 8px rgba(0,0,0,0.08)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-10, right:-10, width:36, height:36, background:`radial-gradient(circle, ${m.c}12 0%, transparent 70%)`, borderRadius:'50%' }} />
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:600, letterSpacing:0.3 }}>{m.icon} {m.l}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: m.c, lineHeight: 1, marginTop:4, letterSpacing:-0.5 }}>{m.v}{m.u || ''}</div>
                <div style={{ fontSize: 8, color: isGood ? m.c : isLow ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight:700, marginTop:2 }}>{pct}% от цели</div>
                <div style={{ height:4, borderRadius:999, background:'rgba(255,255,255,0.07)', marginTop:6, overflow:'hidden', padding:1 }}><div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background: isGood? m.c : isLow ? '#f59e0b' : 'rgba(255,255,255,0.25)', borderRadius:999, transition:'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} /></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6, height:6, borderRadius:4, background:'#00e68a' }} />{weeklyTotals.days}/7 дней</span>
          <span style={{ width:1, height:12, background:'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>🍽 {weeklyTotals.meals} приёмов</span>
          <span style={{ marginLeft:'auto', fontSize: 11, color: '#00e68a', fontWeight: 800 }}>∑ {Math.round(weeklyTotals.kcal)} ккал</span>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>• ср {avgKcal}</span>
        </div>
      </div>

      {/* Day-by-day breakdown — enhanced */}
      <div style={{ padding: 14, borderRadius: 18, background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 12 }}>
          <span style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#a78bfa,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📅</span>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing:-0.2 }}>По дням</div>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:500, marginLeft:6, padding:'3px 7px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>тап → открыть</span>
          <span style={{ marginLeft:'auto', fontSize:9, color:'rgba(255,255,255,0.4)' }}>{daysData.filter(d=>d.kcal>0).length}/7 дн</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {daysData.map(d => {
            const isToday = d.date === today;
            const isEmpty = d.meals===0;
            const pct = targets.kcal > 0 ? Math.min(100, Math.round(d.kcal / targets.kcal * 100)) : 0;
            const isOver = pct > 105;
            const isGood = pct>=85 && pct<=105;
            const isSelected = d.date === selectedDate;
            return (
              <div key={d.date} onClick={() => onSelectDate?.(d.date)} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter') onSelectDate?.(d.date); }}
                style={{ 
                padding: '12px', borderRadius: 14, cursor: onSelectDate ? 'pointer' : 'default',
                background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.08))' : isToday ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,230,138,0.02))' : isEmpty ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? 'rgba(0,230,138,0.30)' : isToday ? 'rgba(0,230,138,0.18)' : isEmpty ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)'}`,
                borderLeft: isSelected ? '3px solid #00e68a' : isToday ? '3px solid #00e68a' : isEmpty ? '3px solid transparent' : '3px solid rgba(255,255,255,0.06)',
                opacity: isEmpty ? 0.6 : 1,
                transition:'all 0.18s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: isSelected ? '0 4px 16px rgba(0,230,138,0.12)' : isToday ? '0 2px 10px rgba(0,230,138,0.08)' : 'none',
              }}
                onMouseEnter={e=>{ if(!isEmpty) e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.borderColor = isSelected ? 'rgba(0,230,138,0.40)' : 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor = isSelected ? 'rgba(0,230,138,0.30)' : isToday ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.05)'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? '#00e68a' : '#fff', letterSpacing:-0.2 }}>
                      {new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && <span style={{ fontSize: 8, color: '#00e68a', background: 'rgba(0,230,138,0.12)', padding: '2px 6px', borderRadius: 999, border:'1px solid rgba(0,230,138,0.18)', fontWeight:700 }}>Сегодня</span>}
                    {isSelected && !isToday && <span style={{ fontSize: 8, color:'#a78bfa', background:'rgba(167,139,250,0.12)', padding:'2px 6px', borderRadius:999, border:'1px solid rgba(167,139,250,0.18)', fontWeight:700 }}>Выбран</span>}
                    {d.meals === 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:999 }}>Нет данных</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: isOver ? '#f87171' : isGood ? '#00e68a' : 'rgba(255,255,255,0.75)', fontWeight: 800 }}>
                      {d.kcal > 0 ? `${Math.round(d.kcal)} ккал` : '—'}
                    </span>
                    {d.kcal > 0 && (
                      <span style={{ fontSize: 10, color: isOver ? '#ef4444' : isGood ? '#00e68a' : 'rgba(255,255,255,0.45)', fontWeight: 700, minWidth: 36, textAlign: 'right', padding:'2px 6px', borderRadius:999, background: isOver ? 'rgba(239,68,68,0.10)' : isGood ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.04)', border:`1px solid ${isOver ? 'rgba(239,68,68,0.15)' : isGood ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
                {d.kcal > 0 && (
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', padding:1 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 999, 
                      background: isOver ? 'linear-gradient(90deg,#ef4444,#f87171)' : isGood ? 'linear-gradient(90deg,#00e68a,#00c8a0)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)', boxShadow: isGood? '0 0 6px rgba(0,230,138,0.35)' : isOver? '0 0 6px rgba(239,68,68,0.35)' : 'none' }} />
                  </div>
                )}
                {d.items > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 9, flexWrap:'wrap' }}>
                    <span style={{ padding:'2px 6px', borderRadius:6, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.12)', color:'#60a5fa', fontWeight:600 }}>Б {Math.round(d.p)}г</span>
                    <span style={{ padding:'2px 6px', borderRadius:6, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.12)', color:'#fbbf24', fontWeight:600 }}>Ж {Math.round(d.f)}г</span>
                    <span style={{ padding:'2px 6px', borderRadius:6, background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.12)', color:'#a78bfa', fontWeight:600 }}>У {Math.round(d.c)}г</span>
                    <span style={{ marginLeft:'auto', color: 'rgba(255,255,255,0.35)', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>🍽 {d.meals} приёмов • {d.items} поз.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
