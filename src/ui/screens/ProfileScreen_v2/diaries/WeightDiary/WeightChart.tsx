import React, { useState, useRef, useMemo } from 'react';
import { colors } from '../../ui';

/* ── field colors ──────────────────────────────────────────── */

export const FIELD_COLORS: Record<string, string> = {
  weight: '#22c55e',
  bodyFat: '#f59e0b',
  muscleMass: '#3b82f6',
  waterMass: '#06b6d4',
  waistCm: '#a855f7',
  chestCm: '#ec4899',
  hipCm: '#f97316',
  bicepCm: '#84cc16',
  thighCm: '#14b8a6',
  neckCm: '#6366f1',
  forearmCm: '#f43f5e',
};

export const FIELD_LABELS: Record<string, string> = {
  weight: 'Вес',
  bodyFat: '% жира',
  muscleMass: 'Мышцы',
  waterMass: 'Вода',
  waistCm: 'Талия',
  chestCm: 'Грудь',
  hipCm: 'Бёдра',
  bicepCm: 'Бицепс',
  thighCm: 'Бедро',
  neckCm: 'Шея',
  forearmCm: 'Предплечье',
};

export const PERCENT_FIELDS = new Set(['bodyFat', 'waterMass']);

/* ── types ─────────────────────────────────────────────────── */

export interface Point {
  date: string;
  value: number;
}

export interface Series {
  field: string;
  points: Point[];
  color: string;
  useRightAxis?: boolean;
}

export interface OverlayChartProps {
  series: Series[];
  target?: number;
  targetZone?: number;
  projections?: Point[];
  movingAverage?: Point[];
  onSvg?: (svg: SVGSVGElement) => void;
  onPng?: (svg: SVGSVGElement) => void;
  notes?: { date: string; text: string }[];
  rightAxis?: { min: number; max: number; label?: string; ticks?: number };
  onSwipeField?: (field: string) => void;
}

/* ── helpers ───────────────────────────────────────────────── */

const pad = (n: number) => Math.max(Math.abs(n) * 0.12, 0.5);

const toNum = (v: unknown) => Number(v);

const filterFinite = (pts: Point[]) =>
  pts.map(p => ({ ...p, value: toNum(p.value) })).filter(p => Number.isFinite(p.value));

/* ── Tooltip ───────────────────────────────────────────────── */

interface TooltipState {
  x: number;
  y: number;
  date: string;
  values: { field: string; color: string; value: number; label: string }[];
}

const Tooltip: React.FC<TooltipState> = ({ x, y, date, values }) => {
  if (!values.length) return null;
  const top = Math.max(0, y - 80);
  return (
    <div
      style={{
        position: 'fixed',
        left: x + 12,
        top,
        background: 'rgba(0,0,0,0.92)',
        border: '1px solid #3f3f46',
        borderRadius: 10,
        padding: '8px 10px',
        pointerEvents: 'none',
        zIndex: 50,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{date}</div>
      {values.map(v => (
        <div key={v.field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: v.color, display: 'inline-block' }} />
          <span style={{ color: '#ccc' }}>{v.label}:</span>
          <b>{Number.isInteger(v.value) ? v.value : v.value.toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
};

/* ── Legend ────────────────────────────────────────────────── */

export const ChartLegend: React.FC<{ series: Series[] }> = ({ series }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
    {series.map(s => (
      <span key={s.field} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
        <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color, display: 'inline-block' }} />
        {FIELD_LABELS[s.field] || s.field}
        {s.useRightAxis ? <small style={{ color: '#888' }}>(%)</small> : null}
      </span>
    ))}
  </div>
);

/* ── Main chart ────────────────────────────────────────────── */

export const OverlayChart: React.FC<OverlayChartProps> = ({
  series,
  target,
  targetZone,
  projections = [],
  movingAverage,
  onSvg,
  onPng,
  notes,
  rightAxis,
  onSwipeField,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);
  const [swipeIndex, setSwipeIndex] = useState(0);

  const activeSeries = useMemo(
    () =>
      series
        .filter(s => s.points.length > 0)
        .map(s => ({ ...s, points: [...s.points].sort((a, b) => a.date.localeCompare(b.date)) })),
    [series],
  );
  const leftSeries = useMemo(() => activeSeries.filter(s => !s.useRightAxis), [activeSeries]);
  const rightSeries = useMemo(() => activeSeries.filter(s => s.useRightAxis), [activeSeries]);

  const leftValues = useMemo(() => leftSeries.flatMap(s => s.points.map(p => p.value)), [leftSeries]);
  const rightValues = useMemo(() => rightSeries.flatMap(s => s.points.map(p => p.value)), [rightSeries]);
  const projValues = useMemo(() => projections.map(p => p.value), [projections]);

  const leftMin = useMemo(() => {
    const base = leftValues.length ? Math.min(...leftValues) : Infinity;
    return Math.min(base, target ?? Infinity);
  }, [leftValues, target]);
  const leftMax = useMemo(() => {
    const base = leftValues.length ? Math.max(...leftValues) : -Infinity;
    return Math.max(base, target ?? -Infinity);
  }, [leftValues, target]);
  const rightMin = rightAxis?.min ?? (rightValues.length ? Math.min(...rightValues) : 0);
  const rightMax = rightAxis?.max ?? (rightValues.length ? Math.max(...rightValues) : 100);

  const leftPad = Math.max((leftMax - leftMin) * 0.12, 0.5);
  const rightPad = Math.max((rightMax - rightMin) * 0.12, 0.5);
  const leftLo = leftMin - leftPad;
  const leftHi = leftMax + leftPad;
  const rightLo = rightMin - rightPad;
  const rightHi = rightMax + rightPad;

  const x = (i: number) => 42 + (i * 540) / Math.max(1, activeSeries[0]?.points.length ? activeSeries[0].points.length - 1 : 1);
  const yLeft = (v: number) => 170 - ((v - leftLo) / (leftHi - leftLo)) * 140;
  const yRight = (v: number) => 170 - ((v - rightLo) / (rightHi - rightLo)) * 140;
  const y = (v: number, useRight?: boolean) => (useRight ? yRight(v) : yLeft(v));

  const dates = activeSeries[0]?.points.map(p => p.date) ?? [];
  const noteIndexes = useMemo(() => {
    if (!notes?.length) return [] as number[];
    const set = new Set<number>();
    for (const n of notes) {
      const idx = dates.findIndex(d => d === n.date);
      if (idx >= 0) set.add(idx);
    }
    return [...set];
  }, [notes, dates]);

  const onMove = (ev: React.MouseEvent | React.TouchEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const idx = Math.round(((relX - 42) / 540) * (dates.length - 1));
    if (idx < 0 || idx >= dates.length) { setTooltip(null); setHoverIdx(null); return; }
    const date = dates[idx];
    const vals = activeSeries
      .map(s => {
        const pt = s.points[idx];
        if (!pt || !Number.isFinite(pt.value)) return null;
        return { field: s.field, color: s.color, value: pt.value, label: FIELD_LABELS[s.field] || s.field };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    setHoverIdx(idx);
    setTooltip({ x: relX, y: relY, date, values: vals });
  };

  const onLeave = () => { setTooltip(null); setHoverIdx(null); };

  const handleSwipe = (dir: 1 | -1) => {
    if (!onSwipeField || activeSeries.length <= 1) return;
    const nextIdx = (swipeIndex + dir + activeSeries.length) % activeSeries.length;
    onSwipeField(activeSeries[nextIdx].field);
  };

  const rightTicks = rightAxis?.ticks ?? 5;
  const rightTickValues = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= rightTicks; i++) arr.push(rightLo + (rightHi - rightLo) * (i / rightTicks));
    return arr;
  }, [rightLo, rightHi, rightTicks]);

  if (activeSeries.length === 0) {
    return <div style={{ padding: 20, color: colors.textMuted }}>Недостаточно данных для графика.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        {onSvg && (
          <button
            style={{
              minHeight: 32, padding: '4px 10px', borderRadius: 6, background: '#27272a',
              border: '1px solid #3f3f46', color: '#fff', cursor: 'pointer', fontSize: 12,
            }}
            onClick={() => svgRef.current && onSvg(svgRef.current)}
          >
            SVG
          </button>
        )}
        {onPng && (
          <button
            style={{
              minHeight: 32, padding: '4px 10px', borderRadius: 6, background: '#27272a',
              border: '1px solid #3f3f46', color: '#fff', cursor: 'pointer', fontSize: 12,
            }}
            onClick={() => svgRef.current && onPng(svgRef.current)}
          >
            PNG
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 600 200"
        width="100%"
        role="img"
        aria-label="График веса и замеров"
        onMouseMove={onMove}
        onTouchMove={onMove}
        onMouseLeave={onLeave}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0].clientX;
          const diff = endX - touchStartX.current;
          if (Math.abs(diff) > 50) {
            handleSwipe(diff > 0 ? -1 : 1);
            setSwipeIndex(prev => (prev + (diff > 0 ? -1 : 1) + activeSeries.length) % activeSeries.length);
          }
          onLeave();
        }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          {activeSeries.map(s => (
            <linearGradient key={`grad-${s.field}`} id={`grad-${s.field}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {/* grid + left axis */}
        <line x1="42" y1="170" x2="582" y2="170" stroke="#555" />
        <line x1="42" y1="30" x2="42" y2="170" stroke="#555" />
        {[0, 1, 2, 3, 4].map(i => (
          <line key={`g-${i}`} x1="42" y1={30 + i * 35} x2="582" y2={30 + i * 35} stroke="#ffffff12" />
        ))}
        {leftValues.length > 0 && [0, 1, 2, 3, 4].map(i => {
          const v = leftLo + (leftHi - leftLo) * ((4 - i) / 4);
          const label = Number.isInteger(v) ? String(v) : v.toFixed(1);
          return (
            <text key={`lt-${i}`} x="36" y={30 + i * 35} textAnchor="end" fill="#888" fontSize="9">{label}</text>
          );
        })}

        {/* right axis */}
        {rightSeries.length > 0 && (
          <>
            <line x1="582" y1="30" x2="582" y2="170" stroke="#555" />
            {rightTickValues.map((v, i) => (
              <text key={`rt-${i}`} x="590" y={yRight(v)} textAnchor="start" fill="#888" fontSize="9">
                {Number.isInteger(v) ? String(v) : v.toFixed(1)}%
              </text>
            ))}
          </>
        )}

        {/* target zone band */}
        {target !== undefined && targetZone !== undefined && (
          <rect
            x="42"
            y={yLeft(target + targetZone)}
            width="540"
            height={Math.max(1, yLeft(target - targetZone) - yLeft(target + targetZone))}
            fill="#22c55e0d"
          />
        )}

        {/* series + gradient fill */}
        {activeSeries.map(s => {
          const useR = !!s.useRightAxis;
          const yFn = (v: number) => y(v, useR);
          const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yFn(p.value).toFixed(1)}`).join(' ');
          const area = `${path} L${x(s.points.length - 1).toFixed(1)},170 L42,170 Z`;
          return (
            <g key={s.field}>
              <path d={area} fill={`url(#grad-${s.field})`} opacity={hoverIdx !== null && activeSeries.length > 1 ? 0.35 : 1} />
              <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" opacity={hoverIdx !== null && activeSeries.length > 1 ? 0.35 : 1} />
              {s.points.map((p, i) => (
                <circle
                  key={`${s.field}-${i}`}
                  cx={x(i)}
                  cy={yFn(p.value)}
                  r={hoverIdx === i ? 4.5 : 2.8}
                  fill={s.color}
                  opacity={hoverIdx !== null && hoverIdx !== i && activeSeries.length > 1 ? 0.25 : 1}
                />
              ))}
            </g>
          );
        })}

        {/* moving average (7d) */}
        {movingAverage && movingAverage.length > 1 && (() => {
          const maByDate = new Map(movingAverage.map(p => [p.date, p.value]));
          let d = '';
          for (let i = 0; i < dates.length; i++) {
            const mv = maByDate.get(dates[i]);
            if (mv === undefined || !Number.isFinite(mv)) continue;
            d += (d ? 'L' : 'M') + x(i).toFixed(1) + ',' + yLeft(mv).toFixed(1);
          }
          return d ? (
            <path d={d} fill="none" stroke="rgba(34,197,94,0.55)" strokeWidth="2.8" strokeLinecap="round" />
          ) : null;
        })()}

        {/* note markers */}
        {noteIndexes.map(idx => (
          <g key={`note-${idx}`}>
            <line x1={x(idx)} y1="30" x2={x(idx)} y2="170" stroke="#fbbf2488" strokeDasharray="3 3" strokeWidth="1" />
            <circle cx={x(idx)} cy="28" r="3" fill="#fbbf24" />
            <title>{dates[idx]}</title>
          </g>
        ))}

        {/* projections */}
        {projections.length > 0 && (
          <path
            d={projections.map((p, i) => `${i ? 'L' : 'M'}${x(dates.length - 1 + i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="#fbbf24"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
        )}

        {/* target */}
        {target !== undefined && (
          <>
            <line x1="42" y1={yLeft(target)} x2="582" y2={yLeft(target)} stroke="#22c55e" strokeDasharray="5 4" />
            <text x="578" y={yLeft(target) - 4} textAnchor="end" fill="#22c55e" fontSize="10">
              цель {target}
            </text>
          </>
        )}

        {/* hover guide */}
        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} y1="30" x2={x(hoverIdx)} y2="170" stroke="#ffffff22" strokeWidth="1" />
        )}

        {/* dates */}
        <text x="42" y="194" fill="#aaa" fontSize="10">{dates[0]}</text>
        <text x="582" y="194" textAnchor="end" fill="#aaa" fontSize="10">{dates.at(-1)}</text>
      </svg>

      <ChartLegend series={activeSeries} />

      {tooltip && <Tooltip {...tooltip} />}
    </div>
  );
};
