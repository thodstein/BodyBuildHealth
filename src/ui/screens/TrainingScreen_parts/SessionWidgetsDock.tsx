/**
 * SessionWidgetsDock.tsx — единый телефонный док для зала (АПК).
 * Собирает 9 виджетов: проведение (пульт/день/BIG) + таймеры + календарь.
 * Монтаж 1 строкой: <SessionWidgetsDock /> в ExecutionZone / Дневник.
 * Липкий низ над пилюлей-навигацией, safe-area, кнопки ≥44px.
 */
import React, { useState } from 'react';
import { WorkoutMiniPult } from './WorkoutSessionWidgets';
import { RestTimerPill, IntervalTimer, SessionClock } from './WorkoutTimersPanel';
import { ScheduleDayStrip, ScheduleWeekMatrix, ScheduleMonthHeat } from './MedScheduleCalendar';

const WHITE = '#fff';
const ACCENT = '#00e68a';

export const SessionWidgetsDock: React.FC<{
  /** Открыть проведение тренировки (плеер). Без него кнопки не рисуем — мёртвых кнопок нет. */
  onOpen?: () => void;
}> = ({ onOpen }) => {
  const [tab, setTab] = useState<'train' | 'timers' | 'sched'>('train');
  // Свёрнут по умолчанию: док — вспомогательный, а не второй экран тренировки.
  // Раньше он занимал 3 ряда кнопок + карточку и оттеснял «Начать» вниз.
  const [open, setOpen] = useState(false);
  return (
    <section data-widget="session-dock" aria-label="Док зала" style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div role="tablist" aria-label="Раздел дока" style={{ display: 'flex', gap: 8, flex: 1 }}>
          {([['train', '🏋️ Зал'], ['timers', '⏳ Таймеры'], ['sched', '📅 График']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} data-dock={k} onClick={() => setTab(k)}
              style={{
                flex: 1, minHeight: 48, borderRadius: 14, fontWeight: 800, fontSize: 13, color: WHITE,
                background: tab === k ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)',
                border: tab === k ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)',
              }}>{label}</button>
          ))}
        </div>
        <button type="button" data-act="dock-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? 'Свернуть док' : 'Развернуть док'}
          style={{ minWidth: 48, minHeight: 48, borderRadius: 14, background: 'transparent', color: WHITE, border: '1px solid rgba(255,255,255,0.12)', fontSize: 16 }}>
          {open ? '▾' : '▴'}
        </button>
      </div>
      {open && (
        <div data-dock-body={tab} style={{ marginTop: 8 }}>
          {/* Только пульт: у «Карточки дня» и BIG-режима в доке не было
              обработчиков, поэтому «Начать», «ГОТОВО» и «Завершить» молчали.
              Проведение открывается одним действием — onOpen. */}
          {tab === 'train' && <WorkoutMiniPult onOpen={onOpen} />}
          {tab === 'timers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <RestTimerPill />
              <IntervalTimer />
              <SessionClock />
            </div>
          )}
          {tab === 'sched' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ScheduleDayStrip />
              <ScheduleWeekMatrix />
              <ScheduleMonthHeat />
            </div>
          )}
        </div>
      )}
    </section>
  );
};
