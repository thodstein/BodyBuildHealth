/**
 * CalendarViewSwitch.tsx — единый переключатель календаря ПЛ: оригинал / с тапером.
 *
 * Фаза 2 дедупа: раньше разметка была скопирована дважды в PLPlanView
 * (карточка календаря мезоцикла и карточка плана). Метки передаются готовыми
 * (в них разные счётчики недель), цвета/поведение — канон здесь.
 */
import React from 'react';

export type PLCalendarView = 'original' | 'tapered';

export const CalendarViewSwitch: React.FC<{
  value: PLCalendarView;
  onChange: (v: PLCalendarView) => void;
  originalLabel: string;
  taperedLabel: string;
  dataHook?: string;
}> = ({ value, onChange, originalLabel, taperedLabel, dataHook }) => {
  const btn = (v: PLCalendarView, color: string): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
    border: value === v ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
    background: value === v ? `${color}26` : 'rgba(255,255,255,0.02)',
    color: value === v ? color : '#fff',
  });
  return (
    <div data-pl={dataHook ?? 'calendar-view'} style={{ display: 'flex', gap: 4 }}>
      <button type="button" aria-pressed={value === 'original'} onClick={() => onChange('original')} style={btn('original', '#60a5fa')}>{originalLabel}</button>
      <button type="button" aria-pressed={value === 'tapered'} onClick={() => onChange('tapered')} style={btn('tapered', '#f59e0b')}>{taperedLabel}</button>
    </div>
  );
};
