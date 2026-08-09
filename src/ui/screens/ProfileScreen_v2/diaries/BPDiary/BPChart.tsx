import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

interface DataPoint {
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number;
}

interface BPChartProps {
  data: DataPoint[];
  goalSystolic: number;
  goalDiastolic: number;
  normalRange: { low: number; high: number };
  width?: number;
  height?: number;
}

type SeriesKey = 'systolic' | 'diastolic' | 'pulse' | 'map' | 'pp';

const SERIES_COLORS: Record<SeriesKey, string> = {
  systolic: '#ef4444',
  diastolic: '#f59e0b',
  pulse: '#8b5cf6',
  map: '#06b6d4',
  pp: '#22c55e',
};
const SERIES_LABELS: Record<SeriesKey, string> = {
  systolic: 'Систола',
  diastolic: 'Диастола',
  pulse: 'Пульс',
  map: 'MAP',
  pp: 'ПД',
};
const SERIES_DASH: Record<SeriesKey, string | undefined> = {
  systolic: undefined,
  diastolic: '5 3',
  pulse: '3 3',
  map: '8 4',
  pp: '2 4',
};

function movingAvg(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = 0; j < window; j++) sum += values[i - j];
    return sum / window;
  });
}

function formatDateShort(d: string) {
  return d.slice(5); // MM-DD
}

export const BPChart = forwardRef<SVGSVGElement, BPChartProps>(({
  data,
  goalSystolic,
  goalDiastolic,
  normalRange,
  width: propW,
  height: propH,
}, ref) => {
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(
    () => new Set<SeriesKey>(['systolic', 'diastolic', 'pulse']),
  );
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    date: string; s: number; d: number; p: number;
    map: number; pp: number;
    idx: number;
  } | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);

  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const SWIPE_FIELDS: SeriesKey[] = ['systolic', 'diastolic', 'pulse', 'map', 'pp'];
  const cycleSwipeField = (dir: 1 | -1) => {
    setSwipeIndex(prev => {
      const next = (prev + dir + SWIPE_FIELDS.length) % SWIPE_FIELDS.length;
      const key = SWIPE_FIELDS[next];
      setVisibleSeries(new Set([key]));
      return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    (e.currentTarget as HTMLElement).dataset.touchX = String(touch.clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const startX = Number(el.dataset.touchX || 0);
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;
    if (Math.abs(diff) > 50) {
      cycleSwipeField(diff > 0 ? -1 : 1);
    }
  };

  const viewBoxW = propW ?? 700;
  const viewBoxH = propH ?? 280;
  const padL = 48;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const plotW = viewBoxW - padL - padR;
  const plotH = viewBoxH - padT - padB;

  const allS = sorted.map(d => d.systolic);
  const allD = sorted.map(d => d.diastolic);
  const allP = sorted.map(d => d.pulse);
  const allMap = sorted.map(d => Math.round((d.systolic + 2 * d.diastolic) / 3));
  const allPp = sorted.map(d => d.systolic - d.diastolic);

  const minVal = Math.min(
    visibleSeries.has('pulse') ? Math.min(...allP) : 999,
    visibleSeries.has('pp') ? Math.min(...allPp) : 999,
    visibleSeries.has('map') ? Math.min(...allMap) : 999,
    ...(visibleSeries.has('systolic') ? allS : [999]),
    ...(visibleSeries.has('diastolic') ? allD : [999]),
    40,
  );
  const maxVal = Math.max(
    visibleSeries.has('pulse') ? Math.max(...allP) : 0,
    visibleSeries.has('pp') ? Math.max(...allPp) : 0,
    visibleSeries.has('map') ? Math.max(...allMap) : 0,
    ...(visibleSeries.has('systolic') ? allS : [0]),
    ...(visibleSeries.has('diastolic') ? allD : [0]),
    200,
  );
  const yMin = Math.floor(minVal / 10) * 10 - 10;
  const yMax = Math.ceil(maxVal / 10) * 10 + 10;
  const yRange = yMax - yMin;

  const xOf = (i: number) => padL + (sorted.length > 1 ? (i * plotW) / (sorted.length - 1) : plotW / 2);
  const yOf = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const buildPolyline = (values: (number | null)[], seriesKey: SeriesKey): string => {
    if (!visibleSeries.has(seriesKey)) return '';
    return values
      .map((v, i) => (v !== null ? `${xOf(i)},${yOf(v)}` : ''))
      .filter(Boolean)
      .join(' ');
  };

  const ma7S = useMemo(() => movingAvg(allS, 7), [allS]);
  const ma7D = useMemo(() => movingAvg(allD, 7), [allD]);

  const axisSteps = useMemo(() => {
    const step = yRange > 80 ? 20 : yRange > 40 ? 10 : 5;
    const out: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) out.push(v);
    return out;
  }, [yMin, yMax]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!sorted.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const svgX = (mx / rect.width) * viewBoxW;
    const idx = sorted.length === 1 ? 0 : Math.round(((svgX - padL) / plotW) * (sorted.length - 1));
    const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
    const pt = sorted[clamped];
    if (pt) {
      setTooltip({
        x: e.clientX, y: e.clientY,
        date: pt.date, s: pt.systolic, d: pt.diastolic, p: pt.pulse,
        map: Math.round((pt.systolic + 2 * pt.diastolic) / 3),
        pp: pt.systolic - pt.diastolic,
        idx: clamped,
      });
    }
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Legend / toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(Object.keys(SERIES_COLORS) as SeriesKey[]).map(key => (
          <button
            key={key}
            onClick={() => toggleSeries(key)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: visibleSeries.has(key) ? `1.5px solid ${SERIES_COLORS[key]}` : '1px solid #444',
              background: visibleSeries.has(key) ? `${SERIES_COLORS[key]}22` : '#18181b',
              color: visibleSeries.has(key) ? SERIES_COLORS[key] : '#666',
              fontFamily: 'inherit',
            }}
          >
            {visibleSeries.has(key) ? '●' : '○'} {SERIES_LABELS[key]}
          </button>
        ))}
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        width="100%"
        style={{ background: '#121216', borderRadius: 10, cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Normal range shading */}
        <rect
          x={padL} y={yOf(normalRange.high)} width={plotW}
          height={yOf(normalRange.low) - yOf(normalRange.high)}
          fill="#22c55e12" rx={2}
        />

        {/* Goal lines */}
        <line x1={padL} y1={yOf(goalSystolic)} x2={padL + plotW} y2={yOf(goalSystolic)}
          stroke="#22c55e" strokeDasharray="5 4" strokeWidth={1} opacity={0.6} />
        <line x1={padL} y1={yOf(goalDiastolic)} x2={padL + plotW} y2={yOf(goalDiastolic)}
          stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1} opacity={0.4} />

        {/* Axis lines */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#444" strokeWidth={1} />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#444" strokeWidth={1} />

        {/* Y-axis grid + labels */}
        {axisSteps.map(v => (
          <g key={v}>
            <line x1={padL} y1={yOf(v)} x2={padL + plotW} y2={yOf(v)} stroke="#29292f" strokeWidth={0.5} />
            <text x={padL - 4} y={yOf(v) + 4} textAnchor="end" fill="#777" fontSize={9}>{v}</text>
          </g>
        ))}

        {/* X-axis labels */}
        {sorted.map((pt, i) => {
          if (sorted.length > 14 && i % Math.ceil(sorted.length / 14) !== 0) return null;
          return (
            <text key={pt.date + i} x={xOf(i)} y={padT + plotH + 14} textAnchor="middle" fill="#777" fontSize={8}>
              {formatDateShort(pt.date)}
            </text>
          );
        })}

        {/* Series polylines */}
        {visibleSeries.has('map') && (
          <polyline points={buildPolyline(allMap, 'map')} fill="none" stroke={SERIES_COLORS.map} strokeWidth={2} strokeDasharray={SERIES_DASH.map} />
        )}
        {visibleSeries.has('pp') && (
          <polyline points={buildPolyline(allPp, 'pp')} fill="none" stroke={SERIES_COLORS.pp} strokeWidth={2} strokeDasharray={SERIES_DASH.pp} />
        )}
        {visibleSeries.has('pulse') && (
          <polyline points={buildPolyline(allP, 'pulse')} fill="none" stroke={SERIES_COLORS.pulse} strokeWidth={2} strokeDasharray={SERIES_DASH.pulse} />
        )}
        {/* Moving averages */}
        {visibleSeries.has('systolic') && (
          <polyline points={buildPolyline(ma7S, 'systolic')} fill="none" stroke={SERIES_COLORS.systolic} strokeWidth={2.5} opacity={0.85} />
        )}
        {visibleSeries.has('diastolic') && (
          <polyline points={buildPolyline(ma7D, 'diastolic')} fill="none" stroke={SERIES_COLORS.diastolic} strokeWidth={2} strokeDasharray={SERIES_DASH.diastolic} opacity={0.85} />
        )}
        {/* Raw points as dots */}
        {sorted.map((pt, i) => {
          const pts: { key: SeriesKey; v: number }[] = [];
          if (visibleSeries.has('systolic')) pts.push({ key: 'systolic', v: pt.systolic });
          if (visibleSeries.has('diastolic')) pts.push({ key: 'diastolic', v: pt.diastolic });
          if (visibleSeries.has('pulse')) pts.push({ key: 'pulse', v: pt.pulse });
          if (visibleSeries.has('map')) pts.push({ key: 'map', v: Math.round((pt.systolic + 2 * pt.diastolic) / 3) });
          if (visibleSeries.has('pp')) pts.push({ key: 'pp', v: pt.systolic - pt.diastolic });
          return pts.map(p => (
            <circle key={`${pt.date}-${p.key}`} cx={xOf(i)} cy={yOf(p.v)} r={3} fill={SERIES_COLORS[p.key]} opacity={0.8} />
          ));
        })}

        {/* Tooltip crosshair + dot highlight */}
        {tooltip && (() => {
          const tx = xOf(tooltip.idx);
          return (
            <g>
              <line x1={tx} y1={padT} x2={tx} y2={padT + plotH} stroke="#fff" strokeWidth={0.5} opacity={0.3} />
              {visibleSeries.has('systolic') && (
                <circle cx={tx} cy={yOf(tooltip.s)} r={5} fill={SERIES_COLORS.systolic} stroke="#fff" strokeWidth={1.5} />
              )}
              {visibleSeries.has('diastolic') && (
                <circle cx={tx} cy={yOf(tooltip.d)} r={5} fill={SERIES_COLORS.diastolic} stroke="#fff" strokeWidth={1.5} />
              )}
            </g>
          );
        })()}
      </svg>

      {/* Tooltip floating box */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 16, top: tooltip.y - 10,
            background: '#18181b', border: '1px solid #444', borderRadius: 8,
            padding: '8px 12px', fontSize: 12, color: '#eee',
            pointerEvents: 'none', zIndex: 2200,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.date}</div>
          <div style={{ color: SERIES_COLORS.systolic }}>Систола: <b>{tooltip.s}</b> мм рт.ст.</div>
          <div style={{ color: SERIES_COLORS.diastolic }}>Диастола: <b>{tooltip.d}</b> мм рт.ст.</div>
          <div style={{ color: SERIES_COLORS.pulse }}>Пульс: <b>{tooltip.p}</b> уд/мин</div>
          <div style={{ color: SERIES_COLORS.map }}>MAP: <b>{tooltip.map}</b> мм рт.ст.</div>
          <div style={{ color: SERIES_COLORS.pp }}>Пульсовое: <b>{tooltip.pp}</b> мм рт.ст.</div>
        </div>
      )}

      <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
        Клик по линиям легенды скрывает/показывает серии. Наведите на график для деталей.
      </div>
    </div>
  );
});
BPChart.displayName = 'BPChart';
