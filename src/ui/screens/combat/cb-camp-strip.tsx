/**
 * cb-camp-strip.tsx — E5 «календарь лагеря».
 *
 * Раньше неделя цикла была пассивным чипом «Н3 · 42 сетов» — нельзя было ни
 * перейти к неделе, ни увидеть траекторию нагрузки. Здесь лента недель с
 * полосой объёма, фазой и переходом прямо к неделе в аккордеоне.
 */
import React from 'react';
import { Highlight } from './CombatUI';
import { ruLabel, PHASE_RU } from './CombatUI';
import type { CombatPlan } from '../../../engines/combat/combat.types';

const phaseColor = (w: any) => (w.deload ? '#f59e0b' : w.taper ? '#60a5fa' : '#a855f7');

export const CampStrip: React.FC<{
  plan: CombatPlan;
  expandedWeek: number | null;
  onPickWeek: (idx: number | null) => void;
}> = ({ plan, expandedWeek, onPickWeek }) => {
  const weeks = plan?.weeksData || [];
  const maxSets = Math.max(1, ...weeks.map(w => w.totalSets || 0));
  const firstSets = weeks.length ? (weeks[0].totalSets || 0) : 0;
  const lastSets = weeks.length ? (weeks[weeks.length - 1].totalSets || 0) : 0;
  const heatSessions = Number((plan?.inputSnapshot as any)?.heatSessionsCount || 0);
  const heatActive = !!(plan?.inputSnapshot as any)?.heatSessions;

  return (
    <div data-cb="camp-strip" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="cb-plan-weeks" style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: 2 }}>
        {weeks.map((w: any, i: number) => {
          const active = expandedWeek === i;
          const col = phaseColor(w);
          const pct = Math.round((w.totalSets || 0) / maxSets * 100);
          const phase = ruLabel(PHASE_RU, (w as any).phase);
          return (
            <button
              key={w.week}
              data-cb="camp-week"
              data-week={w.week}
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'true' : undefined}
              onClick={() => onPickWeek(active ? null : i)}
              aria-label={`Неделя ${w.week}, ${phase}, ${w.totalSets || 0} сетов`}
              style={{
                flex: '0 0 auto', scrollSnapAlign: 'start', minWidth: 62, minHeight: 44,
                display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
                padding: '6px 7px', borderRadius: 10,
                background: active ? `${col}26` : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${active ? col : 'rgba(255,255,255,0.06)'}`,
                color: '#fff', fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
              }}
            >
              <span>Н{w.week}</span>
              <span style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
              </span>
              <span style={{ color: col }}>{w.totalSets || 0}</span>
              <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.9 }}>{phase}</span>
            </button>
          );
        })}
      </div>
      {heatActive && (
        <div style={{ fontSize: 10.5, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Highlight color="#f59e0b">🌡 Тепловая адаптация</Highlight>
          <span>
            пауза <Highlight>{heatSessions || '—'}</Highlight> из {plan.weeks} нед
            {weeks.length > 1 && <> · нагрузка падает по неделям на {firstSets - lastSets} сетов</>}
          </span>
        </div>
      )}
    </div>
  );
};
