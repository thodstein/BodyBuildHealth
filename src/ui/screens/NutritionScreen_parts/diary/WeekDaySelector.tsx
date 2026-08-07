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
    <div style={{ padding: 12, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
        {weekDays.map((ds, i) => {
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const hasData = !!diaryData[ds];
          const dayNum = new Date(ds).getDate();
          const dayName = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(ds).getDay()];
          
          return (
            <div key={i} onClick={() => onSelectDate(ds)} role="button" tabIndex={0} 
              aria-label={`${dayName} ${dayNum}`}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', borderRadius: 12, cursor: 'pointer',
                background: isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'transparent',
                color: isSelected ? '#000' : 'rgba(255,255,255,0.6)', fontWeight: isSelected ? 800 : 500,
                transition: 'all 0.15s', border: isSelected ? '2px solid #00e68a' : '1px solid transparent',
                minHeight: 44,
              }}>
              <span style={{ fontSize: 9, color: isSelected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{dayName}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: isToday ? '#00e68a' : isSelected ? '#fff' : 'rgba(255,255,255,0.8)', lineHeight: 1 }}>{dayNum}</span>
              {hasData && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e68a', marginTop: 3 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
