import React from 'react';

interface WeekDaySelectorProps {
  weekDays: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  diaryData: Record<string, any>;
}

export const WeekDaySelector: React.FC<WeekDaySelectorProps> = ({ weekDays, selectedDate, onSelectDate, diaryData }) => {
  const today = new Date().toISOString().slice(0, 10);
  
  return (
    <div style={{ padding: 12, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 12px rgba(0,0,0,0.12)' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
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
          
          return (
            <div key={i} onClick={() => onSelectDate(ds)} role="button" tabIndex={0} 
              onKeyDown={e=>{ if(e.key==='Enter') onSelectDate(ds); }}
              aria-label={`${dayName} ${dayNum}${hasData ? ` ${dayKcal} ккал` : ''}`}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '7px 0 6px', borderRadius: 12, cursor: 'pointer',
                background: isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : isToday ? 'rgba(0,230,138,0.08)' : 'transparent',
                color: isSelected ? '#000' : 'rgba(255,255,255,0.6)', fontWeight: isSelected ? 800 : 500,
                transition: 'all 0.15s', border: isSelected ? '2px solid #00e68a' : isToday ? '1px solid rgba(0,230,138,0.25)' : '1px solid transparent',
                minHeight: 54, boxShadow: isSelected ? '0 4px 12px rgba(0,230,138,0.25)' : isToday ? '0 2px 8px rgba(0,230,138,0.12)' : 'none',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : isToday ? 'rgba(0,230,138,0.08)' : 'transparent'; }}
            >
              <span style={{ fontSize: 9, color: isSelected ? 'rgba(0,0,0,0.55)' : isToday ? '#00e68a' : 'rgba(255,255,255,0.4)', marginBottom: 1, fontWeight: isToday ? 700 : 400 }}>{dayName}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: isSelected ? '#000' : isToday ? '#00e68a' : 'rgba(255,255,255,0.85)', lineHeight: 1 }}>{dayNum}</span>
              {hasData ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#000' : '#00e68a', boxShadow: isSelected ? 'none' : '0 0 6px rgba(0,230,138,0.5)' }} />
                  <span style={{ fontSize:7, color: isSelected ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.35)', marginTop:1, fontWeight:600 }}>{dayKcal>0 ? `${dayKcal}` : ''}</span>
                </div>
              ) : (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'transparent', marginTop:2 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
