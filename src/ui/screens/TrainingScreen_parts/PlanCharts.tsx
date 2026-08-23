/**
 * PlanCharts.tsx — SVG-графики в плане: объём по неделям, RIR-drift.
 *
 * Используется в BbAutoConstructor (шаг «План»/«Качество») и PlanDisplay.
 */
import React from 'react';

// ── Типы данных ──

export interface WeekVolume {
  week: number;
  totalSets: number;
  /** sets per muscle */
  muscles: Record<string, number>;
}

export interface RirRecord {
  week: number;
  exercise: string;
  rir: number;
}

const COLORS = ['#60a5fa', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];
const W = 580;
const H = 200;
const PAD = { top: 24, right: 20, bottom: 32, left: 32 };

// ── Объём по неделям (столбчатый) ──

export const VolumeByWeekChart: React.FC<{
  data: WeekVolume[];
  muscleFilter?: string[];
}> = ({ data, muscleFilter }) => {
  if (data.length < 2) return null;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxSets = Math.max(...data.map(d => d.totalSets), 1);

  // Collect muscles
  const allMuscles = new Set<string>();
  data.forEach(d => Object.keys(d.muscles).forEach(m => allMuscles.add(m)));
  const filtered = muscleFilter ? muscleFilter.filter(m => allMuscles.has(m)) : [...allMuscles];
  const top = filtered.slice(0, 5);
  const barW = chartW / data.length * 0.7;
  const barGap = chartW / data.length * 0.3;

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct}
          x1={PAD.left} y1={PAD.top + chartH * (1 - pct)}
          x2={PAD.left + chartW} y2={PAD.top + chartH * (1 - pct)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * (chartW / data.length) + barGap / 2;
        const totalH = (d.totalSets / maxSets) * chartH;
        let yOffset = 0;
        return (
          <g key={d.week}>
            {top.map((muscle, mi) => {
              const muscSets = d.muscles[muscle] || 0;
              const h = (muscSets / maxSets) * chartH;
              const y = PAD.top + chartH - totalH + yOffset;
              yOffset += h;
              return <rect key={muscle} x={x} y={y} width={barW} height={Math.max(1, h)}
                fill={COLORS[mi % COLORS.length]} opacity={0.85} rx={2} />;
            })}
            <text x={x + barW / 2} y={PAD.top + chartH + 14} textAnchor="middle"
              fill="rgba(255,255,255,0.85)" fontSize={9}>н{d.week}</text>
            <text x={x + barW / 2} y={PAD.top + chartH - totalH - 4} textAnchor="middle"
              fill="rgba(255,255,255,0.7)" fontSize={8}>{d.totalSets}</text>
          </g>
        );
      })}
      {/* Y-axis labels */}
      <text x={6} y={PAD.top + 4} fill="rgba(255,255,255,0.85)" fontSize={8}>{maxSets}</text>
      <text x={6} y={PAD.top + chartH - 1} fill="rgba(255,255,255,0.85)" fontSize={8}>0</text>
      {/* Legend */}
      <g transform={'translate(' + PAD.left + ', ' + (H - 4) + ')'}>
        {top.map((m, i) => (
          <g key={m} transform={'translate(' + (i * 70) + ', 0)'}>
            <rect x={0} y={-4} width={8} height={8} fill={COLORS[i % COLORS.length]} rx={1} />
            <text x={11} y={3} fill="rgba(255,255,255,0.85)" fontSize={7}>{m}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ── RIR-drift по неделям (линейный) ──

export const RirDriftChart: React.FC<{
  data: RirRecord[];
}> = ({ data }) => {
  if (data.length < 2) return null;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const weeks = [...new Set(data.map(d => d.week))].sort((a, b) => a - b);
  const exercises = [...new Set(data.map(d => d.exercise))];

  // Aggregate RIR per week (average)
  const weeklyAvg: Record<number, number> = {};
  const weeklyCount: Record<number, number> = {};
  data.forEach(d => { weeklyAvg[d.week] = (weeklyAvg[d.week] || 0) + d.rir; weeklyCount[d.week] = (weeklyCount[d.week] || 0) + 1; });
  const points = weeks.map(w => ({
    week: w,
    avg: weeklyAvg[w] / weeklyCount[w],
  }));

  const maxRir = Math.max(...points.map(p => p.avg), 3);
  const minRir = Math.min(...points.map(p => p.avg), 0);
  const range = Math.max(maxRir - minRir, 1);

  // Lines per exercise
  const exLines: Record<string, { week: number; rir: number }[]> = {};
  data.forEach(d => { if (!exLines[d.exercise]) exLines[d.exercise] = []; exLines[d.exercise].push(d); });

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct}
          x1={PAD.left} y1={PAD.top + chartH * (1 - pct)}
          x2={PAD.left + chartW} y2={PAD.top + chartH * (1 - pct)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {/* Average line */}
      {points.length > 1 && (
        <polyline
          points={points.map(p => {
            const x = PAD.left + ((p.week - weeks[0]) / (weeks[weeks.length - 1] - weeks[0])) * chartW;
            const y = PAD.top + chartH - ((p.avg - minRir) / range) * chartH;
            return x.toFixed(0) + ',' + y.toFixed(0);
          }).join(' ')}
          fill="none" stroke="#00e68a" strokeWidth={2} opacity={0.6}
        />
      )}
      {/* Points */}
      {points.map(p => {
        const x = PAD.left + ((p.week - weeks[0]) / (weeks[weeks.length - 1] - weeks[0])) * chartW;
        const y = PAD.top + chartH - ((p.avg - minRir) / range) * chartH;
        return (
          <g key={p.week}>
            <circle cx={x} cy={y} r={3} fill="#00e68a" />
            <text x={x} y={PAD.top + chartH + 14} textAnchor="middle"
              fill="rgba(255,255,255,0.85)" fontSize={9}>н{p.week}</text>
            <text x={x - 6} y={y - 6} textAnchor="end" fill="#00e68a" fontSize={8}>{p.avg.toFixed(1)}</text>
          </g>
        );
      })}
      {/* Y-axis */}
      <text x={6} y={PAD.top + 4} fill="rgba(255,255,255,0.85)" fontSize={8}>RIR {maxRir.toFixed(0)}</text>
      <text x={6} y={PAD.top + chartH - 1} fill="rgba(255,255,255,0.85)" fontSize={8}>{minRir.toFixed(0)}</text>
      {/* RIR zone bg */}
      <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH * (1 / range)} fill="rgba(0,230,138,0.04)" />
      <text x={PAD.left + 4} y={PAD.top + 14} fill="rgba(0,230,138,0.3)" fontSize={8}>RIR 0-1</text>
    </svg>
  );
};
