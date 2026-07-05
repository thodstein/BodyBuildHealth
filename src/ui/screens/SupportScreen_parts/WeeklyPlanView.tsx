import React from 'react';
import type { PlanResult } from '../../../engines/support-plan';
import { computeWeekScale } from '../../../engines/support-plan/substances';

const ACCENT = '#00e68a';

const TIME_LABELS: Record<string, string> = {
  morning: 'Утро (с завтраком)',
  afternoon: 'День (с обедом)',
  evening: 'Вечер (за 1-2 ч до сна)',
};

const TIME_ICONS: Record<string, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
};

export interface WeeklyPlanViewProps {
  planResult: PlanResult;
  courseWeek: number;
}

export const WeeklyPlanView: React.FC<WeeklyPlanViewProps> = ({ planResult, courseWeek }) => {
  const currentWeek = courseWeek || 1;
  const totalWeeks = Math.max(currentWeek, 12);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div style={{ padding: '0' }}>
      {/* Week Timeline Bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          📅 План по неделям (титрация доз)
        </div>
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {weeks.map(w => {
            const scale = computeWeekScale(w);
            const isCurrent = w === currentWeek;
            const color = scale < 0.6 ? '#f59e0b' : scale < 0.8 ? '#eab308' : scale < 1.0 ? '#22c55e' : ACCENT;
            return (
              <div
                key={w}
                style={{
                  flex: '0 0 auto',
                  textAlign: 'center',
                  padding: '2px 4px',
                  borderRadius: 4,
                  background: isCurrent ? 'rgba(0,230,138,0.12)' : 'transparent',
                  border: isCurrent ? '1px solid ' + ACCENT : '1px solid transparent',
                  minWidth: 28,
                }}
              >
                <div style={{ fontSize: 7, fontWeight: 700, color: isCurrent ? ACCENT : 'rgba(255,255,255,0.5)' }}>
                  {w}
                </div>
                <div style={{
                  height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 1, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: (scale * 100) + '%', borderRadius: 2,
                    background: color, transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 5, color, fontWeight: 600 }}>
                  ×{scale.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>
          <span>🟡 Адаптация</span>
          <span>🟢 Основной</span>
          <span style={{ color: ACCENT }}>Текущая нед.</span>
        </div>
      </div>

      {/* Weekly dosage info */}
      <div style={{
        padding: '8px 10px', borderRadius: 8, marginBottom: 10,
        background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>
            Нед. {currentWeek}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700,
            color: computeWeekScale(currentWeek) < 1.0 ? '#f59e0b' : ACCENT,
            padding: '2px 8px', borderRadius: 6,
            background: computeWeekScale(currentWeek) < 1.0 ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,138,0.1)',
          }}>
            {computeWeekScale(currentWeek) < 1.0
              ? `Адаптация: дозы ×${computeWeekScale(currentWeek).toFixed(1)}`
              : 'Полные дозы'}
          </span>
        </div>
        {computeWeekScale(currentWeek) < 1.0 && (
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
            Постепенное наращивание доз для адаптации ЖКТ и минимизации побочных эффектов.
            Полные дозы с недели {Math.max(7, Math.ceil(currentWeek / 7) * 7)}.
          </div>
        )}
      </div>

      {/* Schedule — 3 time blocks */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          ⏰ Расписание приёма
        </div>
        {['morning', 'afternoon', 'evening'].map(block => {
          const timeData = planResult.schedule.find(s => s.timeBlock === block);
          const substances = timeData?.substances || [];
          if (substances.length === 0) return null;
          return (
            <div
              key={block}
              style={{
                padding: '8px', borderRadius: 8, marginBottom: 5,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                {TIME_ICONS[block]} {TIME_LABELS[block]}
                <span style={{ marginLeft: 6, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
                  {substances.length} преп.
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {substances.map(s => {
                  const scaledDose = `${s.dose}`;
                  return (
                    <span
                      key={s.id}
                      style={{
                        padding: '2px 7px', borderRadius: 5,
                        background: block === 'morning' ? 'rgba(251,191,36,0.08)' : block === 'afternoon' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
                        border: '1px solid ' + (block === 'morning' ? 'rgba(251,191,36,0.2)' : block === 'afternoon' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)'),
                        fontSize: 7, color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                      }}
                    >
                      {s.name}
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 3 }}>
                        {scaledDose}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-mechanism coverage summary */}
      {planResult.mechanisms && planResult.mechanisms.length > 0 && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)' }}>
          <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 700, marginBottom: 3 }}>
            🎯 Механизмы с покрытием ({planResult.mechanisms.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {planResult.mechanisms.map((m, i) => (
              <span key={i} style={{
                padding: '1px 4px', borderRadius: 3,
                background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                fontSize: 6, color: '#60a5fa',
              }}>
                {m.mechKey}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanView;
