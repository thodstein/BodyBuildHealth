/**
 * CardioVolumeChart.tsx — график объёма кардио по неделям (мин/ккал),
 * цвета по фазам цикла + факт-оверлей из дневника (план vs факт) и сводка
 * выполнения прошедших недель. Inline, без внешних библиотек.
 */
import React, { useMemo, useState } from 'react';
import { cardioVolumeSeries, CARDIO_PHASE_LABELS, cardioWeekForDate, type CardioCycle } from '../../../engines/lms/cardio.engine';
import { cardioWeekFact, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { CARD, BTN, PHASE_COLOR } from './CardioUI';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioVolumeChart: React.FC<{ cycle: CardioCycle | null; log?: CardioLogEntry[] }> = ({ cycle, log = [] }) => {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<'minutes' | 'kcal'>('minutes');

  const series = useMemo(() => (cycle ? cardioVolumeSeries(cycle) : []), [cycle]);

  // Факт по неделям цикла (только прошедшие недели — будущее не штрафуется).
  const fact = useMemo(() => {
    if (!cycle || log.length === 0) return null;
    const current = cardioWeekForDate(cycle, todayIso(), cycle.startDate)?.week ?? cycle.totalWeeks;
    const rows = cycle.weeks
      .filter(w => w.week < current)
      .map(w => cardioWeekFact(cycle, w.week, log, cycle.startDate));
    const planned = rows.reduce((s, r) => s + r.plannedMinutes, 0);
    const done = rows.reduce((s, r) => s + r.doneMinutes, 0);
    const plannedS = rows.reduce((s, r) => s + r.plannedSessions, 0);
    const doneS = rows.reduce((s, r) => s + r.doneSessions, 0);
    return {
      rows,
      pct: planned > 0 ? Math.round((done / planned) * 100) : null,
      doneS,
      plannedS,
    };
  }, [cycle, log]);

  if (!cycle || series.length === 0) return null;

  const values = series.map(s => s[metric]);
  const factValues = fact
    ? series.map(s => {
        const f = fact.rows.find(r => r.week === s.week);
        if (!f) return 0;
        return metric === 'minutes' ? f.doneMinutes : f.factKcal;
      })
    : [];
  const max = Math.max(1, ...values, ...factValues);
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
        {fact && (
          <span style={{ fontSize: 10, color: fact.pct != null && fact.pct >= 80 ? '#4ade80' : fact.pct != null && fact.pct >= 50 ? '#fbbf24' : '#f87171' }}>
            план vs факт: {fact.pct ?? 0}% · сессий {fact.doneS}/{fact.plannedS}
          </span>
        )}
        <button style={{ ...BTN, marginLeft: 'auto' }} onClick={() => setOpen(v => !v)}>{open ? '▾ Скрыть' : '▸ Показать'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
            {series.map((s, i) => {
              const h = Math.max(2, Math.round((s[metric] / max) * 78));
              const phaseLabel = CARDIO_PHASE_LABELS[s.phase] ?? s.phase;
              const fVal = factValues[i] ?? 0;
              const fh = fVal > 0 ? Math.max(2, Math.round((fVal / max) * 78)) : 0;
              const tip = 'Нед ' + s.week + ': план ' + s[metric] + ' ' + label + ' · ' + phaseLabel + (s.taper ? ' · taper/делод' : '') + (fVal > 0 ? ' · факт ' + fVal + ' ' + label : '');
              return (
                <div key={s.week} title={tip} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 82 }}>
                    <div style={{ width: '100%', borderRadius: '2px 2px 0 0', height: h, background: PHASE_COLOR[s.phase] ?? '#888', opacity: s.taper ? 0.55 : 1 }} />
                    {fh > 0 && (
                      <div style={{ position: 'absolute', bottom: 0, width: '42%', borderRadius: '2px 2px 0 0', height: fh, background: '#f8fafc', opacity: 0.85 }} title={'факт: ' + fVal + ' ' + label} />
                    )}
                  </div>
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
            {fact && <span style={{ color: fact.pct != null && fact.pct < 60 ? '#f87171' : 'rgba(255,255,255,0.35)' }}> · Выполнение прошедших недель: {fact.pct}% (сессий {fact.doneS}/{fact.plannedS})</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#3b82f6', marginRight: 4 }} />план</span>
            {fact && <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f8fafc', marginRight: 4 }} />факт (дневник)</span>}
          </div>
        </div>
      )}
    </div>
  );
};
