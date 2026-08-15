/**
 * CardioVolumeChart.tsx — график объёма кардио по неделям (мин/ккал),
 * цвета по фазам цикла. Inline, без внешних библиотек.
 */
import React, { useMemo, useState } from 'react';
import { cardioVolumeSeries, CARDIO_PHASE_LABELS, type CardioCycle } from '../../../engines/lms/cardio.engine';

const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 36, whiteSpace: 'nowrap',
};
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};

const PHASE_COLOR: Record<string, string> = {
  base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#71717a',
};

export const CardioVolumeChart: React.FC<{ cycle: CardioCycle | null }> = ({ cycle }) => {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<'minutes' | 'kcal'>('minutes');

  const series = useMemo(() => (cycle ? cardioVolumeSeries(cycle) : []), [cycle]);
  if (!cycle || series.length === 0) return null;

  const values = series.map(s => s[metric]);
  const max = Math.max(1, ...values);
  const label = metric === 'minutes' ? 'мин' : 'ккал';
  const peak = Math.max(...values);
  const peakWeek = values.indexOf(peak) + 1;
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>📈 Объём по неделям</span>
        <button style={metric === 'minutes' ? { ...BTN, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a' } : BTN} onClick={() => setMetric('minutes')}>мин</button>
        <button style={metric === 'kcal' ? { ...BTN, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a' } : BTN} onClick={() => setMetric('kcal')}>ккал</button>
        <button style={{ ...BTN, marginLeft: 'auto' }} onClick={() => setOpen(v => !v)}>{open ? '▾ Скрыть' : '▸ Показать'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
            {series.map(s => {
              const h = Math.max(2, Math.round((s[metric] / max) * 78));
              const phaseLabel = CARDIO_PHASE_LABELS[s.phase] ?? s.phase;
              const tip = 'Нед ' + s.week + ': ' + s[metric] + ' ' + label + ' · ' + phaseLabel + (s.taper ? ' · taper/делод' : '');
              return (
                <div key={s.week} title={tip} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', borderRadius: '2px 2px 0 0', height: h, background: PHASE_COLOR[s.phase] ?? '#888', opacity: s.taper ? 0.55 : 1 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {series.map(s => (
              <div key={s.week} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{s.week}</div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            Пик: {peak} {label} (нед {peakWeek}) · Средняя: {avg} {label}
          </div>
        </div>
      )}
    </div>
  );
};
