import React, { useMemo, useState } from 'react';
import { colors } from '../../ui';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { detectAnomalies } from '../../diary-helpers';

interface WeeklyHistogramImprovedProps {
  rows: WeightEntry[];
}

interface WeekData {
  week: string;
  mean: number;
  min: number;
  max: number;
  count: number;
  anomaly?: boolean;
}

const WeeklyHistogramImproved: React.FC<WeeklyHistogramImprovedProps> = ({ rows }) => {
  const [hover, setHover] = useState<{ week: string; mean: number; min: number; max: number; count: number; anomaly?: boolean; x: number; y: number } | null>(null);

  const weeks = useMemo<WeekData[]>(() => {
    if (!rows.length) return [];
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const groups: Record<string, { dates: string[]; values: number[] }> = {};
    for (const r of sorted) {
      const d = new Date(r.date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      start.setDate(d.getDate() - dow);
      const key = start.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = { dates: [], values: [] };
      groups[key].dates.push(r.date);
      groups[key].values.push(r.weight);
    }
    const anomalies = detectAnomalies('weight', rows.map(r => ({ date: r.date, fields: [{ label: 'weight', value: String(r.weight), unit: 'кг' }] })));
    const anomalyDates = new Set(anomalies.map(a => a.date));
    return Object.entries(groups)
      .map(([week, data]) => {
        const mean = data.values.reduce((s, v) => s + v, 0) / data.values.length;
        return {
          week,
          mean,
          min: Math.min(...data.values),
          max: Math.max(...data.values),
          count: data.values.length,
          anomaly: data.dates.some(d => anomalyDates.has(d)),
        };
      })
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [rows]);

  if (!weeks.length) return null;

  const maxMean = Math.max(...weeks.map(w => w.mean));
  const minMean = Math.min(...weeks.map(w => w.mean));
  const chartH = 120;
  const barMaxH = chartH - 20;
  const globalMean = weeks.reduce((s, w) => s + w.mean, 0) / weeks.length;

  return (
    <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
      <b>📊 Среднее по неделям</b>
      <div style={{ position: 'relative', height: chartH + 30, marginTop: 8 }}>
        {/* Y axis */}
        <div style={{ position: 'absolute', left: 0, top: 0, height: barMaxH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: '#888' }}>
          <span>{maxMean.toFixed(1)}</span>
          <span>{((maxMean + minMean) / 2).toFixed(1)}</span>
          <span>{minMean.toFixed(1)}</span>
        </div>
        {/* Grid lines */}
        <div style={{ position: 'absolute', left: 35, right: 0, top: 0, height: barMaxH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ borderTop: '1px solid #ffffff12', height: 0 }} />
          ))}
        </div>
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: barMaxH, marginLeft: 35 }}>
          {weeks.map((w, i) => {
            const h = Math.max(6, ((w.mean - minMean) / Math.max(maxMean - minMean, 0.1)) * (barMaxH - 10));
            const bg = w.anomaly ? '#ef444499' : w.mean > globalMean ? '#22c55e99' : '#3b82f699';
            return (
              <div
                key={w.week}
                style={{ flex: 1, textAlign: 'center', minWidth: 16, cursor: 'pointer', position: 'relative' }}
                onMouseEnter={() => setHover({ ...w, x: 0, y: 0 })}
                onMouseLeave={() => setHover(null)}
              >
                <div style={{ fontSize: 8, color: '#ccc', marginBottom: 1 }}>{w.mean.toFixed(1)}</div>
                <div style={{ height: h, background: bg, borderRadius: '2px 2px 0 0', transition: 'opacity 0.15s' }} />
                <div style={{ fontSize: 7, color: '#888', marginTop: 2, whiteSpace: 'nowrap' }}>{w.week.slice(5)}</div>
              </div>
            );
          })}
        </div>
        {/* Tooltip */}
        {hover && (
          <div style={{
            position: 'absolute', left: 40, top: 10, background: 'rgba(0,0,0,0.9)', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '6px 8px', fontSize: 11, pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap',
          }}>
            <div style={{ color: '#aaa', marginBottom: 2 }}>{hover.week}</div>
            <div>Среднее: <b>{hover.mean.toFixed(1)} кг</b></div>
            <div>Мин/макс: {hover.min.toFixed(1)} / {hover.max.toFixed(1)}</div>
            <div>Записей: {hover.count}</div>
            {hover.anomaly && <div style={{ color: '#ef4444', marginTop: 2 }}>⚠ Аномалия</div>}
          </div>
        )}
      </div>
    </section>
  );
};

export { WeeklyHistogramImproved };
