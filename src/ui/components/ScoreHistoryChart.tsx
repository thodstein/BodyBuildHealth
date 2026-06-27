import React, { useMemo, useState } from 'react';
import { getScoreHistory } from '../../engines/score-history';

interface ScoreHistoryChartProps {
  modules?: Array<{ key: string; icon: string; label: string; color: string }>;
  days?: number;
}

const DEFAULT_MODULES = [
  { key: 'support', icon: '💊', label: 'Поддержка', color: '#818cf8' },
  { key: 'pharma', icon: '💉', label: 'Фарма', color: '#f472b6' },
  { key: 'labs', icon: '🧪', label: 'Анализы', color: '#34d399' },
  { key: 'nutrition', icon: '🥗', label: 'Питание', color: '#fbbf24' },
  { key: 'training', icon: '🏋️', label: 'Тренинг', color: '#fb923c' },
];

const W = 280, H = 140, PAD = { top: 12, right: 8, bottom: 18, left: 28 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({ modules = DEFAULT_MODULES, days = 14 }) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const { series, dates, yMax } = useMemo(() => {
    const history = getScoreHistory().slice(0, days).reverse();
    const dates = history.map(h => {
      const d = new Date(h.date);
      return `${d.getDate()}.${d.getMonth() + 1}`;
    });
    const series = modules.map(m => {
      const values = history.map(h => h.modules[m.key]?.overallRaw ?? null);
      return { ...m, values };
    });
    const yMax = Math.max(100, ...series.flatMap(s => s.values.filter((v): v is number => v !== null)));
    return { series, dates, yMax };
  }, [modules, days]);

  const toX = (i: number) => PAD.left + (i / Math.max(dates.length - 1, 1)) * IW;
  const toY = (v: number) => PAD.top + IH - (v / yMax) * IH;

  if (dates.length < 2) {
    return (
      <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
        Недостаточно данных для графика (нужно ≥2 записи). Сгенерируйте отчёты в разных модулях.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, justifyContent: 'center' }}>
        {series.map(s => (
          <button key={s.key} onClick={() => setHighlighted(highlighted === s.key ? null : s.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
              opacity: highlighted && highlighted !== s.key ? 0.4 : 1,
              transition: 'opacity 0.2s',
              padding: '1px 4px',
            }}>
            <span style={{ fontSize: 10 }}>{s.icon}</span>
            <span style={{ fontSize: 7, color: s.color, fontWeight: 600 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 160 }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            <text x={PAD.left - 4} y={toY(v) + 2} textAnchor="end" fill="var(--text-dim)" fontSize={6}>{v}%</text>
          </g>
        ))}

        {/* X-axis labels */}
        {dates.map((d, i) => {
          if (i % Math.max(1, Math.floor(dates.length / 6)) !== 0) return null;
          return (
            <text key={d + i} x={toX(i)} y={H - 2} textAnchor="middle" fill="var(--text-dim)" fontSize={6}>{d}</text>
          );
        })}

        {/* Lines */}
        {series.map(s => {
          const pts = s.values.map((v, i) => v !== null ? `${toX(i)},${toY(v)}` : null).filter(Boolean);
          if (pts.length < 2) return null;
          return (
            <polyline key={s.key} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={1.5}
              strokeLinejoin="round" strokeLinecap="round"
              style={{ opacity: highlighted && highlighted !== s.key ? 0.2 : 1, transition: 'opacity 0.2s' }} />
          );
        })}

        {/* Dots */}
        {series.map(s =>
          s.values.map((v, i) =>
            v !== null ? (
              <circle key={`${s.key}-${i}`} cx={toX(i)} cy={toY(v)} r={2} fill={s.color}
                style={{ opacity: highlighted && highlighted !== s.key ? 0.1 : 1, transition: 'opacity 0.2s' }} />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

export default ScoreHistoryChart;
