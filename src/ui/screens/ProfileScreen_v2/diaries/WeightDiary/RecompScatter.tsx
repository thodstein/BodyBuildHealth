import React, { useMemo, useState } from 'react';
import { colors } from '../../ui';

interface Point {
  x: number;
  y: number;
  size: number;
  date: string;
  weight: number;
  bf: number;
  muscle?: number;
  color: string;
}

interface RecompScatterProps {
  points: Point[];
}

const PAD = 50;
const SVG_W = 600;
const SVG_H = 280;
const TICKS = 5;

const toPoint = (pts: Point[]): Point[] => {
  if (!pts.length) return [];
  const ws = pts.map(p => p.x);
  const bs = pts.map(p => p.y);
  const minW = Math.min(...ws);
  const maxW = Math.max(...ws);
  const minB = Math.min(...bs);
  const maxB = Math.max(...bs);
  const padW = Math.max((maxW - minW) * 0.15, 0.5);
  const padB = Math.max((maxB - minB) * 0.15, 0.5);
  const loW = minW - padW;
  const hiW = maxW + padW;
  const loB = minB - padB;
  const hiB = maxB + padB;
  const tx = (v: number) => PAD + ((v - loW) / (hiW - loW)) * (SVG_W - PAD * 2);
  const ty = (v: number) => SVG_H - PAD - ((v - loB) / (hiB - loB)) * (SVG_H - PAD * 2);
  return pts.map(p => ({
    ...p,
    x: tx(p.x),
    y: ty(p.y),
    rawW: p.x,
    rawB: p.y,
  }));
};

const tickValues = (min: number, max: number, n: number): number[] => {
  const arr: number[] = [];
  const step = (max - min) / (n - 1);
  for (let i = 0; i < n; i++) arr.push(min + step * i);
  return arr;
};

export const RecompScatter: React.FC<RecompScatterProps> = ({ points }) => {
  const data = useMemo(() => toPoint(points), [points]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; date: string } | null>(null);

  if (!data.length) return <div style={{ padding: 20, color: colors.textMuted }}>Недостаточно данных. Нужен вес и % жира.</div>;

  const ws = points.map(p => p.x);
  const bs = points.map(p => p.y);
  const minW = Math.min(...ws);
  const maxW = Math.max(...ws);
  const minB = Math.min(...bs);
  const maxB = Math.max(...bs);
  const padW = Math.max((maxW - minW) * 0.15, 0.5);
  const padB = Math.max((maxB - minB) * 0.15, 0.5);
  const loW = minW - padW;
  const hiW = maxW + padW;
  const loB = minB - padB;
  const hiB = maxB + padB;

  const tx = (v: number) => PAD + ((v - loW) / (hiW - loW)) * (SVG_W - PAD * 2);
  const ty = (v: number) => SVG_H - PAD - ((v - loB) / (hiB - loB)) * (SVG_H - PAD * 2);

  const xTicks = tickValues(loW, hiW, TICKS);
  const yTicks = tickValues(loB, hiB, TICKS);

  const midX = (minW + maxW) / 2;
  const midY = (minB + maxB) / 2;

  const onMove = (ev: React.MouseEvent | React.TouchEvent, p: typeof data[0]) => {
    const rect = (ev.currentTarget as SVGElement).getBoundingClientRect();
    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const text = `${p.date}\n${p.weight} кг, ${p.bf}% жира${p.muscle ? `\nмышцы ${p.muscle} кг` : ''}`;
    setTooltip({ x: relX, y: relY, text, date: p.date });
  };

  const onLeave = () => setTooltip(null);

  return (
    <div>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" role="img" aria-label="Рекомпозиция: вес vs % жира">
        <defs>
          <linearGradient id="recompGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* quadrants */}
        <rect x={tx(midX)} y={PAD} width={SVG_W - PAD * 2 - tx(midX) + PAD} height={ty(midY) - PAD} fill="#22c55e" opacity={0.04} />
        <rect x={PAD} y={ty(midY)} width={tx(midX) - PAD} height={SVG_H - PAD * 2 - ty(midY) + PAD} fill="#ef4444" opacity={0.04} />
        <rect x={tx(midX)} y={ty(midY)} width={SVG_W - PAD * 2 - tx(midX) + PAD} height={SVG_H - PAD * 2 - ty(midY) + PAD} fill="#f59e0b" opacity={0.04} />
        <rect x={PAD} y={PAD} width={tx(midX) - PAD} height={ty(midY) - PAD} fill="#3b82f6" opacity={0.04} />

        {/* quadrant labels */}
        <text x={tx(midX) + (SVG_W - PAD - tx(midX)) / 2} y={PAD + 14} textAnchor="middle" fill="#22c55e" fontSize="9" opacity={0.7}>
          ▲ Рекомпозиция
        </text>
        <text x={PAD + (tx(midX) - PAD) / 2} y={PAD + 14} textAnchor="middle" fill="#3b82f6" fontSize="9" opacity={0.7}>
          ▼ Недостаток веса
        </text>
        <text x={tx(midX) + (SVG_W - PAD - tx(midX)) / 2} y={SVG_H - PAD - 6} textAnchor="middle" fill="#f59e0b" fontSize="9" opacity={0.7}>
          ▲ Bulk
        </text>
        <text x={PAD + (tx(midX) - PAD) / 2} y={SVG_H - PAD - 6} textAnchor="middle" fill="#ef4444" fontSize="9" opacity={0.7}>
          ▼ Cut
        </text>

        {/* grid */}
        <line x1={PAD} y1={SVG_H - PAD} x2={SVG_W - PAD} y2={SVG_H - PAD} stroke="#555" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={SVG_H - PAD} stroke="#555" />
        {xTicks.map((v, i) => (
          <line key={`x-${i}`} x1={tx(v)} y1={SVG_H - PAD} x2={tx(v)} y2={SVG_H - PAD + 4} stroke="#888" />
        ))}
        {yTicks.map((v, i) => (
          <line key={`y-${i}`} x1={PAD - 4} y1={ty(v)} x2={PAD} y2={ty(v)} stroke="#888" />
        ))}

        {/* path */}
        {data.length > 1 && (
          <path
            d={data.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="url(#recompGrad)"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity={0.5}
          />
        )}

        {/* points */}
        {data.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.size || 4}
            fill={p.color}
            opacity={0.85}
            stroke="#000"
            strokeWidth={0.5}
            style={{ cursor: 'pointer', transition: 'r 0.15s' }}
            onMouseEnter={(e) => { onMove(e, p); (e.target as SVGElement).setAttribute('r', '6'); }}
            onMouseMove={(e) => onMove(e, p)}
            onMouseLeave={(e) => { onLeave(); (e.target as SVGElement).setAttribute('r', String(p.size || 4)); }}
            onTouchStart={(e) => { e.preventDefault(); onMove(e, p); }}
          />
        ))}

        {/* axes labels */}
        <text x={SVG_W / 2} y={SVG_H - 6} textAnchor="middle" fill="#ffffff" fontSize="10">
          Вес, кг
        </text>
        <text x={12} y={SVG_H / 2} textAnchor="middle" fill="#ffffff" fontSize="10" transform={`rotate(-90 12 ${SVG_H / 2})`}>
          % жира
        </text>

        {/* tick labels */}
        {xTicks.map((v, i) => (
          <text key={`xl-${i}`} x={tx(v)} y={SVG_H - PAD + 16} textAnchor="middle" fill="#888" fontSize="9">
            {Number.isInteger(v) ? v : v.toFixed(1)}
          </text>
        ))}
        {yTicks.map((v, i) => (
          <text key={`yl-${i}`} x={PAD - 6} y={ty(v) + 3} textAnchor="end" fill="#888" fontSize="9">
            {Number.isInteger(v) ? v : v.toFixed(1)}%
          </text>
        ))}

        {/* tooltip */}
        {tooltip && (
          <>
            <rect x={Math.min(tooltip.x + 12, SVG_W - 230)} y={Math.max(tooltip.y - 55, 5)} width={220} height={tooltip.text.split('\n').length * 16 + 10} rx={6} fill="rgba(0,0,0,0.9)" stroke="#3f3f46" />
            {tooltip.text.split('\n').map((line, i) => (
              <text key={i} x={Math.min(tooltip.x + 18, SVG_W - 220)} y={Math.max(tooltip.y - 40 + i * 16, 18)} fill="#fff" fontSize="10">
                {line}
              </text>
            ))}
          </>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 11, color: colors.textMuted }}>
        <span>Цвет: от старой к новой записи</span>
        <span>·</span>
        <span>Размер: мышечная масса</span>
        <span>·</span>
        <span>Линия: путь изменений</span>
      </div>
    </div>
  );
};
