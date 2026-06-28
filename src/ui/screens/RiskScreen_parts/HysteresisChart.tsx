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
    const freq = typeof drug.frequency === 'number' ? drug.frequency : parseFloat(String(drug.frequency)) || 1;
    return simulateHysteresis({
      doseMg: drug.doseValue || 100,
      dosingIntervalHours: freq > 1 ? 24 : 7 * 24,
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
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Добавьте препараты в курс для симуляции гистерезиса</div>;
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
    <div style={{ marginTop: 10, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>🧪 Гистерезис — PK/PD</div>
        <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>dMarker/dt = (E−Marker)/τ</div>
      </div>

      {/* Drug selector */}
      {drugs.length > 1 && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
          {drugs.map((d, i) => {
            const ph = PHARMA_DB[d.substanceId] as any;
            return (
              <button key={i} onClick={() => setSelectedIdx(i)} style={{
                padding: '3px 8px', borderRadius: 8, fontSize: 8, cursor: 'pointer',
                background: i === selectedIdx ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                color: i === selectedIdx ? '#000' : 'rgba(255,255,255,0.6)',
                border: '1px solid ' + (i === selectedIdx ? 'var(--accent)' : 'rgba(255,255,255,0.06)'),
              }}>
                {ph?.name || d.substanceId}
              </button>
            );
          })}
        </div>
      )}

      {/* SVG Chart */}
      <svg width={CHART_W} height={CHART_H} style={{ display: 'block', maxWidth: '100%' }}>
        {/* Background grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <line key={'h' + v} x1={MARGIN.left} y1={scaleY_marker(v / 100 * maxMarker)} x2={CHART_W - MARGIN.right} y2={scaleY_marker(v / 100 * maxMarker)} stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
        ))}
        {/* Concentration — thin blue */}
        <path d={concPath} fill="none" stroke="#60a5fa" strokeWidth={1} opacity={0.5} />
        {/* Marker — thick green */}
        <path d={markerPath} fill="none" stroke="#00e68a" strokeWidth={2.5} />
        {/* Time labels */}
        <text x={MARGIN.left} y={CHART_H - 4} fontSize={8} fill="rgba(255,255,255,0.4)" textAnchor="middle">0</text>
        <text x={scaleX(maxHours * 0.5)} y={CHART_H - 4} fontSize={8} fill="rgba(255,255,255,0.4)" textAnchor="middle">{Math.round(maxHours / 2)}ч</text>
        <text x={scaleX(maxHours)} y={CHART_H - 4} fontSize={8} fill="rgba(255,255,255,0.4)" textAnchor="middle">{Math.round(maxHours)}ч</text>
        {/* Y-axis label */}
        <text x={2} y={MARGIN.top + INNER_H / 2} fontSize={7} fill="rgba(255,255,255,0.3)" textAnchor="middle" transform={`rotate(-90, 4, ${MARGIN.top + INNER_H / 2})`}>Эффект</text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, fontSize: 7, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#60a5fa', fontWeight: 700 }}>━</span> Концентрация</span>
        <span><span style={{ color: '#00e68a', fontWeight: 700 }}>━</span> Биомаркер</span>
        <span style={{ color: 'var(--text-dim)' }}>Пик: +{result.peakMarkerTime.toFixed(0)}ч</span>
        <span style={{ color: 'var(--text-dim)' }}>Стаб: {result.timeToSteadyState.toFixed(0)}ч</span>
      </div>
    </div>
  );
};

export default HysteresisChart;
