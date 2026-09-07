// ============================================================
// HysteresisChart.tsx — PK/PD Hysteresis visualization
// Shows drug concentration, effect, and biomarker over time
// ============================================================

import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { simulateHysteresis, type HysteresisResult } from '../../../engines/pharma-hysteresis.engine';
import { PHARMA_DB } from '../../../core/pharma-database';

const CHART_W = 360;
const CHART_H = 180;
const MARGIN = { top: 8, right: 8, bottom: 22, left: 30 };
const INNER_W = CHART_W - MARGIN.left - MARGIN.right;
const INNER_H = CHART_H - MARGIN.top - MARGIN.bottom;

/**
 * Инъекций в неделю из CourseEntry.frequency. В проде лежат строки
 * '2x/wk', 'daily', 'eod' и числа (раз в неделю), а старый код брал
 * parseFloat (2x/wk→2→24ч вместо 84ч; daily→NaN→168ч вместо 24ч).
 * Экспортируется для тестов.
 */
export function injectionsPerWeek(freq: number | string | undefined): number {
  if (typeof freq === 'number' && Number.isFinite(freq)) return Math.max(1, freq);
  const s = String(freq ?? '').trim().toLowerCase();
  if (!s) return 1;
  if (s === 'daily' || s === 'qd' || s === 'ed' || s === '1x/d' || s === 'sid') return 7;
  if (s === 'eod' || s === 'qod') return 3.5;
  if (s === 'weekly' || s === 'qw' || s === '1x/w' || s === '1x/wk' || s === '1x/week') return 1;
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*x\s*\/\s*(d|day|w|wk|week)/);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return m[2].startsWith('d') ? n * 7 : n;
  }
  const leading = parseFloat(s);
  if (Number.isFinite(leading) && leading > 0) return leading;
  return 1;
}

export const HysteresisChart: React.FC = () => {
  const linked = useDataLink();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const drugs = useMemo(() => {
    return (linked.course || []).filter(c => {
      const ph = PHARMA_DB[c.substanceId] as any;
      return ph?.pk && ph?.pd;
    });
  }, [linked.course]);

  const result = useMemo<HysteresisResult | null>(() => {
    if (!drugs.length) return null;
    const drug = drugs[Math.min(selectedIdx, drugs.length - 1)];
    const ph = PHARMA_DB[drug.substanceId] as any;
    if (!ph?.pk || !ph?.pd) return null;
    const perWeek = injectionsPerWeek(drug.frequency as number | string | undefined);
    return simulateHysteresis({
      doseMg: drug.doseValue || 100,
      dosingIntervalHours: 168 / perWeek,
      halfLifeHours: ph.pk.halfLifeHours || 72,
      ec50: ph.ec50 || 300,
      nHill: ph.n_hill || 2,
      tauResponse: 24,  // 24hr biological response delay
      tauDelay: 2,       // 2hr absorption delay
      volumeOfDistribution: ph.pk.Vd || 40,
      bioavailability: ph.pk.bioavailability || 1,
      ka: ph.pk.ka || 0.3,
      ke: ph.pk.k10,
      totalHours: 168,   // 1 week
      dtHours: 0.5,
    });
  }, [drugs, selectedIdx]);

  if (!result || !result.points.length) {
    return <div className="risk-hysteresis" style={{ padding: 20, textAlign: 'center', color: '#fff', fontSize: 12 }}>Добавьте препараты в курс для симуляции гистерезиса</div>;
  }

  // SVG chart
  const maxMarker = Math.max(...result.points.map(p => p.marker), 0.01);
  const maxConc = Math.max(...result.points.map(p => p.concentration), 0.01);
  const maxHours = result.points[result.points.length - 1].timeHours;

  const scaleX = (t: number) => MARGIN.left + (t / maxHours) * INNER_W;
  const scaleY_marker = (v: number) => MARGIN.top + INNER_H - (v / maxMarker) * INNER_H;
  const scaleY_conc = (v: number) => MARGIN.top + INNER_H - (v / maxConc) * INNER_H * 0.3;

  // Build SVG path for marker
  const markerPath = result.points
    .filter((_, i) => i % 4 === 0)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.timeHours)},${scaleY_marker(p.marker)}`)
    .join(' ');

  const concPath = result.points
    .filter((_, i) => i % 4 === 0)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.timeHours)},${scaleY_conc(p.concentration)}`)
    .join(' ');

  return (
    <div className="risk-hysteresis" style={{ marginTop: 12, background: 'rgba(20,22,30,0.55)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: 16, overflowX: 'hidden', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>🧪 Гистерезис — PK/PD</div>
        <div style={{ fontSize: 11, color: '#fff' }}>dMarker/dt = (E−Marker)/τ</div>
      </div>

      {/* Drug selector */}
      {drugs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {drugs.map((d, i) => {
            const ph = PHARMA_DB[d.substanceId] as any;
            return (
              <button key={i} onClick={() => setSelectedIdx(i)} style={{
                minHeight:44, padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight:800, cursor: 'pointer',
                background: i === selectedIdx ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: i === selectedIdx ? '#000' : '#fff',
                border: '1px solid ' + (i === selectedIdx ? 'var(--accent)' : 'rgba(255,255,255,0.10)'),
              }}>
                {ph?.name || d.substanceId}
              </button>
            );
          })}
        </div>
      )}

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Background grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <line key={'h' + v} x1={MARGIN.left} y1={scaleY_marker(v / 100 * maxMarker)} x2={CHART_W - MARGIN.right} y2={scaleY_marker(v / 100 * maxMarker)} stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
        ))}
        {/* Concentration — thin blue */}
        <path d={concPath} fill="none" stroke="#60a5fa" strokeWidth={1} opacity={0.5} />
        {/* Marker — thick green */}
        <path d={markerPath} fill="none" stroke="#00e68a" strokeWidth={2.5} />
        {/* Time labels */}
        <text x={MARGIN.left} y={CHART_H - 4} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">0</text>
        <text x={scaleX(maxHours * 0.5)} y={CHART_H - 4} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">{Math.round(maxHours / 2)}ч</text>
        <text x={scaleX(maxHours)} y={CHART_H - 4} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">{Math.round(maxHours)}ч</text>
        {/* Y-axis label */}
        <text x={2} y={MARGIN.top + INNER_H / 2} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle" transform={`rotate(-90, 4, ${MARGIN.top + INNER_H / 2})`}>Эффект</text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight:700, color:'#fff', marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#60a5fa', fontWeight: 800 }}>━</span> Концентрация</span>
        <span><span style={{ color: '#00e68a', fontWeight: 800 }}>━</span> Биомаркер</span>
        <span style={{ color: '#fff' }}>Пик: +{result.peakMarkerTime.toFixed(0)}ч</span>
        <span style={{ color: '#fff' }}>Стаб: {result.timeToSteadyState.toFixed(0)}ч</span>
      </div>
    </div>
  );
};

export default HysteresisChart;
