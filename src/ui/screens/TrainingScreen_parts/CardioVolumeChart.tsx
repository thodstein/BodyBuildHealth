/**
 * CardioVolumeChart.tsx — график объёма кардио по неделям (мин/ккал),
 * цвета по фазам цикла + факт-оверлей из дневника (план vs факт) и сводка
 * выполнения прошедших недель. Inline, без внешних библиотек.
 */
import React, { useMemo, useState } from 'react';
import { cardioVolumeSeries, CARDIO_PHASE_LABELS, cardioWeekForDate, cardioCtlSeries, cardioFactCtlSeries, type CardioCycle } from '../../../engines/lms/cardio.engine';
import { cardioWeekFact, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { addDaysIso } from '../../../engines/lms/cardio-date-utils.engine';
import { CARD, BTN, BTN_SMALL, PHASE_COLOR, HINT_SM } from './CardioUI';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TRIMP_FACTOR: Record<string, number> = { zone2: 2, miss: 3, hiit: 5, recovery: 1 };

export const CardioVolumeChart: React.FC<{ cycle: CardioCycle | null; log?: CardioLogEntry[]; defaultOpen?: boolean }> = ({ cycle, log = [], defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [metric, setMetric] = useState<'minutes' | 'kcal' | 'trimp' | 'ctl'>('minutes');

  const series = useMemo(() => {
    if (!cycle) return [];
    const base = cardioVolumeSeries(cycle);
    if (metric === 'trimp') {
      return cycle.weeks.map(w => {
        const trimp = w.sessions.reduce((s, sess) => s + sess.durationMin * sess.weeklyFrequency * (TRIMP_FACTOR[sess.type] ?? 2), 0);
        const row = base.find(r => r.week === w.week);
        return { ...row!, trimp } as typeof row & { trimp: number };
      });
    }
    if (metric === 'ctl') {
      const ctlSeries = cardioCtlSeries(cycle, cycle.config?.restingHr ?? undefined, cycle.config?.age ? (cycle.config.sex === 'female' ? 226 - cycle.config.age : 220 - cycle.config.age) : undefined, cycle.config?.sex);
      return cycle.weeks.map(w => {
        const ctl = ctlSeries.find(x => x.week === w.week);
        const row = base.find(r => r.week === w.week);
        return { ...row!, ctl: ctl?.ctl ?? 0, atl: ctl?.atl ?? 0, tsb: ctl?.tsb ?? 0 } as typeof row & { ctl: number; atl: number; tsb: number };
      });
    }
    return base;
  }, [cycle, metric]);

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
      factKcal: rows.reduce((s, r) => s + r.factKcal, 0),
      factKm: Math.round(rows.reduce((s, r) => s + r.factKm, 0) * 10) / 10,
    };
  }, [cycle, log]);

  const factCtlWeekly = useMemo(() => {
    if (metric !== 'ctl' || !cycle || log.length === 0 || !cycle.startDate) return [] as number[];
    try {
      const daily = cardioFactCtlSeries(log, {
        restHr: cycle.config?.restingHr ?? undefined,
        maxHr: cycle.config?.age ? (cycle.config.sex === 'female' ? 226 - cycle.config.age : 220 - cycle.config.age) : undefined,
        sex: cycle.config?.sex,
        referenceIso: todayIso(),
        days: cycle.totalWeeks * 7 + 7,
      });
      const map = new Map(daily.map(d => [d.date, d.ctl]));
      return cycle.weeks.map(w => {
        const endIso = addDaysIso(cycle.startDate!, w.week * 7 - 1);
        return map.get(endIso) ?? 0;
      });
    } catch { return [] as number[]; }
  }, [cycle, log, metric]);

  if (!cycle || series.length === 0) return null;

  const factCtlWeeklyForMax = factCtlWeekly.length > 0 ? factCtlWeekly : [];
  const values = series.map(s => (s as unknown as Record<string, number>)[metric] ?? 0);
  // Точный TRIMP факта — по датам недели, а не хак 2.2
  const factValues = fact
    ? series.map(s => {
        const f = fact.rows.find(r => r.week === s.week);
        if (!f) return 0;
        if (metric === 'minutes') return f.doneMinutes;
        if (metric === 'kcal') return f.factKcal;
        // TRIMP факта: сумма по лог-записям недели, взвешенная по типу
        const start = (() => {
          if (!cycle.startDate) return null;
          const d = new Date(cycle.startDate + 'T00:00:00');
          d.setDate(d.getDate() + (s.week - 1) * 7);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return iso;
        })();
        const end = start ? (() => {
          const d = new Date(start + 'T00:00:00');
          d.setDate(d.getDate() + 6);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })() : null;
        if (!start || !end) return Math.round(f.doneMinutes * 2.2);
        const weekLog = log.filter(e => e.completed && e.date >= start && e.date <= end);
        if (weekLog.length === 0) return 0;
        return weekLog.reduce((sum, e) => sum + e.durationMin * (TRIMP_FACTOR[e.type] ?? 2), 0);
      })
    : [];
  const max = Math.max(1, ...values, ...factValues, ...(metric === 'ctl' ? factCtlWeeklyForMax : []));
  const label = metric === 'minutes' ? 'мин' : metric === 'kcal' ? 'ккал' : metric === 'trimp' ? 'TRIMP' : 'CTL';
  const peak = Math.max(...values);
  const peakWeek = values.indexOf(peak) + 1;
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <div className="train-cardiovol" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 850, color: '#fff', letterSpacing: -0.1 }}>📈 Объём по неделям</span>
        <button style={metric === 'minutes' ? { ...BTN_SMALL, borderColor: 'rgba(0,230,138,0.50)', color: '#4ade80', boxShadow: '0 0 10px rgba(0,230,138,0.16)' } : BTN_SMALL} onClick={() => setMetric('minutes')} aria-pressed={metric === 'minutes'}>мин</button>
        <button style={metric === 'kcal' ? { ...BTN_SMALL, borderColor: 'rgba(0,230,138,0.50)', color: '#4ade80', boxShadow: '0 0 10px rgba(0,230,138,0.16)' } : BTN_SMALL} onClick={() => setMetric('kcal')} aria-pressed={metric === 'kcal'}>ккал</button>
        <button style={metric === 'trimp' ? { ...BTN_SMALL, borderColor: 'rgba(139,92,246,0.50)', color: '#a78bfa', boxShadow: '0 0 10px rgba(139,92,246,0.16)' } : BTN_SMALL} onClick={() => setMetric('trimp')} title="TRIMP = нагрузка (Banister)" aria-pressed={metric === 'trimp'}>TRIMP</button>
        <button style={metric === 'ctl' ? { ...BTN_SMALL, borderColor: 'rgba(59,130,246,0.50)', color: '#60a5fa', boxShadow: '0 0 10px rgba(59,130,246,0.16)' } : BTN_SMALL} onClick={() => setMetric('ctl')} title="CTL/ATL/TSB (Fitness-Fatigue)" aria-pressed={metric === 'ctl'}>CTL</button>
        {fact && (
          <span style={{ fontSize: 11, fontWeight: 800, color: fact.pct != null && fact.pct >= 80 ? '#4ade80' : fact.pct != null && fact.pct >= 50 ? '#fbbf24' : '#f87171', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 10px', fontVariantNumeric: 'tabular-nums' }}>
            план vs факт: {fact.pct ?? 0}% · {fact.doneS}/{fact.plannedS} сесс
          </span>
        )}
        <button style={{ ...BTN_SMALL, marginLeft: 'auto' }} onClick={() => setOpen(v => !v)} aria-expanded={open}>{open ? '▾ Скрыть' : '▸ Показать'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 104, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 6px 4px' }}>
            {series.map((s, i) => {
              if (metric === 'ctl') {
                const ctl = (s as unknown as Record<string, number>).ctl ?? 0;
                const atl = (s as unknown as Record<string, number>).atl ?? 0;
                const tsb = (s as unknown as Record<string, number>).tsb ?? 0;
                const hCtl = Math.max(2, Math.round((ctl / max) * 70));
                const hAtl = Math.max(2, Math.round((atl / max) * 70));
                const hTsb = Math.max(1, Math.round((Math.abs(tsb) / max) * 40));
                const tsbPos = tsb >= 0 ? 'top' : 'bottom';
                const factCtl = factCtlWeeklyForMax[i] ?? 0;
                const hFact = factCtl > 0 ? Math.max(2, Math.round((factCtl / max) * 70)) : 0;
                return (
                  <div key={s.week} title={`Нед ${s.week}: CTL ${ctl} · ATL ${atl} · TSB ${tsb}${factCtl > 0 ? ` · факт CTL ${factCtl}` : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', justifyContent: 'center', height: 82 }}>
                      <div style={{ flex: 1, borderRadius: '2px 2px 0 0', height: hCtl, background: '#60a5fa', opacity: 0.9 }} title={`CTL ${ctl}`} />
                      <div style={{ flex: 1, borderRadius: '2px 2px 0 0', height: hAtl, background: '#f87171', opacity: 0.9 }} title={`ATL ${atl}`} />
                      <div style={{ flex: 1, borderRadius: 2, height: hTsb, background: tsb >= 0 ? '#4ade80' : '#fbbf24', opacity: 0.9, alignSelf: tsbPos === 'top' ? 'flex-start' : 'flex-end' }} title={`TSB ${tsb}`} />
                    </div>
                    {hFact > 0 && <div style={{ width: '100%', height: 3, borderRadius: 1, background: '#f8fafc', opacity: 0.9, marginTop: 1 }} title={`факт CTL ${factCtl}`} />}
                  </div>
                );
              }
              const val = (s as unknown as Record<string, number>)[metric] ?? 0;
              const h = Math.max(2, Math.round((val / max) * 78));
              const phaseLabel = CARDIO_PHASE_LABELS[s.phase] ?? s.phase;
              const fVal = factValues[i] ?? 0;
              const fh = fVal > 0 ? Math.max(2, Math.round((fVal / max) * 78)) : 0;
              const tip = 'Нед ' + s.week + ': план ' + val + ' ' + label + ' · ' + phaseLabel + (s.taper ? ' · taper/делод' : '') + (fVal > 0 ? ' · факт ' + fVal + ' ' + label : '');
              return (
                <div key={s.week} title={tip} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 88 }}>
                    <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: h, background: `linear-gradient(180deg, ${PHASE_COLOR[s.phase] ?? '#888'}, ${PHASE_COLOR[s.phase] ?? '#888'}cc)`, opacity: s.taper ? 0.55 : 1, boxShadow: val === peak ? `0 0 8px ${PHASE_COLOR[s.phase] ?? '#888'}88` : 'none' }} />
                    {fh > 0 && (
                      <div style={{ position: 'absolute', bottom: 0, width: '42%', borderRadius: '3px 3px 0 0', height: fh, background: '#f8fafc', opacity: 0.9, boxShadow: '0 0 6px rgba(248,250,252,0.5)' }} title={'факт: ' + fVal + ' ' + label} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {series.map(s => (
              <div key={s.week} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: s.week === peakWeek ? 850 : 500, color: s.week === peakWeek ? '#4ade80' : 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>{s.week}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '7px 10px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.55 }}>
            Пик: {peak} {label} (нед {peakWeek}) · Средняя: {avg} {label}
            {fact && <span style={{ color: fact.pct != null && fact.pct < 60 ? '#f87171' : '#fff' }}> · Выполнение прошедших недель: {fact.pct}% (сессий {fact.doneS}/{fact.plannedS})</span>}
            {fact && fact.factKcal > 0 && <span> · Факт: {fact.factKcal} ккал{fact.factKm > 0 ? ` · ${fact.factKm} км` : ''}</span>}
          </div>
          <div style={{ display: 'flex', gap: 9, fontSize: 10.5, color: '#fff' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#3b82f6', marginRight: 5 }} />план</span>
            {fact && <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#f8fafc', marginRight: 5 }} />факт (дневник)</span>}
          </div>
          {metric === 'trimp' && <div style={HINT_SM}>TRIMP Banister (HRr) где есть HR, иначе фактор zone2×2/miss×3/hiit×5. Резкий рост {'>'}15% — риск.</div>}
          {metric === 'ctl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={HINT_SM}>CTL 42д (фитнес) — синий, ATL 7д (усталость) — красный, TSB = CTL-ATL: +5..+15 пик, &lt;-10 перегруз.</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#fff', flexWrap: 'wrap' }}>
                {(() => {
                  const ctlS = cardioCtlSeries(cycle, cycle.config?.restingHr ?? undefined, cycle.config?.age ? (cycle.config.sex === 'female' ? 226 - cycle.config.age : 220 - cycle.config.age) : undefined, cycle.config?.sex);
                  const last = ctlS[ctlS.length - 1];
                  if (!last) return null;
                  const tsbColor = last.tsb > 5 && last.tsb < 15 ? '#4ade80' : last.tsb < -10 ? '#f87171' : '#fbbf24';
                  return (
                    <>
                      <span style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.28)', borderRadius: 20, padding: '2px 8px', color: '#60a5fa' }}>CTL {last.ctl}</span>
                      <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 20, padding: '2px 8px', color: '#f87171' }}>ATL {last.atl}</span>
                      <span style={{ background: `${tsbColor}18`, border: `1px solid ${tsbColor}40`, borderRadius: 20, padding: '2px 8px', color: tsbColor }}>TSB {last.tsb > 0 ? '+' + last.tsb : last.tsb}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
