import React from 'react';

interface WeekDaySelectorProps {
  weekDays: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  diaryData: Record<string, any>;
}

export const WeekDaySelector: React.FC<WeekDaySelectorProps> = ({ weekDays, selectedDate, onSelectDate, diaryData }) => {
  const today = new Date().toISOString().slice(0, 10);
  const shiftWeek = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    const iso = d.toISOString().slice(0,10);
    onSelectDate(iso);
  };
  const weekLabel = (() => {
    try {
      const a = new Date(weekDays[0]); const b = new Date(weekDays[6]);
      const fmt = (d:Date) => d.toLocaleDateString('ru-RU', { day:'numeric', month:'short', year: a.getFullYear()!==b.getFullYear() ? 'numeric' : undefined });
      return `${fmt(a)} — ${fmt(b)}`;
    } catch { return ''; }
  })();
  const weekKcalTotal = (() => {
    let s=0, cnt=0;
    weekDays.forEach(ds => {
      const day = diaryData[ds];
      if (!day?.meals) return;
      try { s += Object.values(day.meals).flat().reduce((a:number, it:any)=>a+(it.kcal||0),0); cnt++; } catch {}
    });
    return { total: Math.round(s), days: cnt };
  })();
  
  return (
    <div className="nut-weekday" style={{ padding: 14, borderRadius: 18, background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow:'0 6px 24px rgba(0,0,0,0.18)', backdropFilter:'blur(8px)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={()=>shiftWeek(-1)} aria-label="Пред. неделя" style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>‹</button>
          <button onClick={()=>shiftWeek(1)} aria-label="След. неделя" style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
          <div style={{ marginLeft:4 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fff', letterSpacing:-0.2, display:'flex', alignItems:'center', gap:6 }}><span style={{ width:7, height:7, borderRadius:4, background:'#00e68a', boxShadow:'0 0 8px #00e68a80' }} />{weekLabel}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:1 }}>{weekKcalTotal.days}/7 дн • ∑ {weekKcalTotal.total} ккал</div>
          </div>
        </div>
        <button onClick={()=>onSelectDate(today)} aria-label="Сегодня" style={{ padding:'7px 12px', borderRadius:10, border:selectedDate===today?'1.5px solid #00e68a':'1px solid rgba(0,230,138,0.18)', background: selectedDate===today ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(0,230,138,0.08)', color: selectedDate===today ? '#000' : '#00e68a', fontSize:10, fontWeight:800, cursor:'pointer', boxShadow: selectedDate===today ? '0 2px 10px rgba(0,230,138,0.25)' : 'none' }}>Сегодня</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {weekDays.map((ds, i) => {
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const hasData = !!diaryData[ds];
          const dayNum = new Date(ds).getDate();
          const dayName = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(ds).getDay()];
          const dayKcal = (() => {
            const day = diaryData[ds];
            if (!day?.meals) return 0;
            try { return Math.round(Object.values(day.meals).flat().reduce((s:number, it:any)=>s+(it.kcal||0),0)); } catch { return 0; }
          })();
          const dayItems = (() => {
            const day = diaryData[ds];
            if (!day?.meals) return 0;
            try { return Object.values(day.meals).flat().length as number; } catch { return 0; }
          })();
          // kcal progress vs 2500 target for mini bar
          const pct = Math.min(100, Math.round(dayKcal / 25));
          
          return (
            <div key={i} onClick={() => onSelectDate(ds)} role="button" tabIndex={0} 
              onKeyDown={e=>{ if(e.key==='Enter') onSelectDate(ds); }}
              aria-label={`${dayName} ${dayNum}${hasData ? ` ${dayKcal} ккал` : ''}`}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 2px 8px', borderRadius: 14, cursor: 'pointer',
                background: isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : isToday ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.08))' : hasData ? 'rgba(255,255,255,0.03)' : 'transparent',
                color: isSelected ? '#000' : 'rgba(255,255,255,0.6)', fontWeight: isSelected ? 800 : 500,
                transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)', border: isSelected ? '1.5px solid #00e68a' : isToday ? '1px solid rgba(0,230,138,0.28)' : hasData ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                minHeight: 72, boxShadow: isSelected ? '0 6px 16px rgba(0,230,138,0.28), inset 0 1px 0 rgba(255,255,255,0.2)' : isToday ? '0 2px 10px rgba(0,230,138,0.15)' : hasData ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transform: isSelected ? 'translateY(-2px) scale(1.02)' : 'scale(1)',
                position:'relative', overflow:'hidden',
              }}
              onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=isToday?'linear-gradient(135deg, rgba(0,230,138,0.20), rgba(0,200,160,0.12))':'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : isToday ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.08))' : hasData ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
            >
              {isSelected && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.35)', borderRadius:'2px 2px 0 0' }} />}
              <span style={{ fontSize: 9, color: isSelected ? 'rgba(0,0,0,0.55)' : isToday ? '#00e68a' : 'rgba(255,255,255,0.4)', fontWeight: isToday || isSelected ? 700 : 400, letterSpacing:0.3, textTransform:'uppercase' as const }}>{dayName}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: isSelected ? '#000' : isToday ? '#00e68a' : hasData ? '#fff' : 'rgba(255,255,255,0.65)', lineHeight: 1, marginTop:2, letterSpacing:-0.5 }}>{dayNum}</span>
              {hasData ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:4, gap:2, width:'100%', padding:'0 4px' }}>
                  <div style={{ width: '100%', height:3, borderRadius:999, background: isSelected ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:999, background: isSelected ? '#000' : dayKcal>2600 ? '#ef4444' : dayKcal>2200 ? '#00e68a' : '#f59e0b', transition:'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize:8, color: isSelected ? 'rgba(0,0,0,0.7)' : dayKcal>2600 ? '#f87171' : 'rgba(255,255,255,0.55)', fontWeight:700 }}>{dayKcal>0 ? `${dayKcal}` : ''}<span style={{ fontSize:6, fontWeight:400, opacity:0.7 }}>{dayKcal>0?'к':''}</span></span>
                  <span style={{ fontSize:6, color: isSelected ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.3)', fontWeight:600 }}>{dayItems?`${dayItems} поз.` : ''}</span>
                </div>
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'transparent', border: isSelected? '1px solid rgba(0,0,0,0.15)' : '1px dashed rgba(255,255,255,0.08)', marginTop:8 }} />
              )}
              {isToday && !isSelected && <div style={{ position:'absolute', top:4, right:5, width:6, height:6, borderRadius:4, background:'#00e68a', boxShadow:'0 0 6px #00e68a80' }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:6 }}>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:3, borderRadius:2, background:'#00e68a' }} /> ≥2200</span>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:3, borderRadius:2, background:'#f59e0b' }} /> 1500-2200</span>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:3, borderRadius:2, background:'#ef4444' }} /> &gt;2600</span>
      </div>
    </div>
  );
};
