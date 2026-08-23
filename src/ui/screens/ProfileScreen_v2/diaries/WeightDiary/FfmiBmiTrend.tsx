import React, { useMemo, useState } from 'react';
import { colors } from '../../ui';
import { calcFFMI, calcBMI, ffmiLabel } from '../../../../../engines/body-composition.engine';

interface FfmiBmiTrendProps {
  rows: { date: string; weight: number; bodyFat?: number }[];
  heightCm?: number;
  sex?: 'male' | 'female';
}

interface DataPoint {
  date: string;
  ffmi: number;
  bmi: number;
}

export const FfmiBmiTrend: React.FC<FfmiBmiTrendProps> = ({ rows, heightCm, sex }) => {
  const data = useMemo<DataPoint[]>(() => {
    if (!heightCm || rows.length === 0) return [];
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const points: DataPoint[] = [];
    for (const r of sorted) {
      const bf = typeof r.bodyFat === 'number' ? r.bodyFat : null;
      const ffmi = bf !== null ? calcFFMI(r.weight, heightCm, bf) : null;
      const bmi = calcBMI(r.weight, heightCm);
      if (ffmi !== null && Number.isFinite(ffmi)) {
        points.push({ date: r.date, ffmi, bmi });
      }
    }
    return points;
  }, [rows, heightCm]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; ffmi: number; bmi: number } | null>(null);

  if (!data.length) return null;

  const latest = data[data.length - 1];
  const ffmiColor = latest.ffmi < 20 ? '#60a5fa' : latest.ffmi < 24 ? '#22c55e' : latest.ffmi < 26 ? '#f59e0b' : '#ef4444';

  const PAD = 35;
  const W = 400;
  const H = 120;
  const tx = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, data.length - 1);
  const tyFFMI = (v: number) => H - PAD - ((v - 15) / 15) * (H - PAD * 2);
  const tyBMI = (v: number) => H - PAD - ((v - 15) / 15) * (H - PAD * 2);

  const onMove = (ev: React.MouseEvent | React.TouchEvent, p: DataPoint, i: number) => {
    const rect = (ev.currentTarget as SVGElement).getBoundingClientRect();
    const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
    const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
    setTooltip({ x: clientX - rect.left, y: clientY - rect.top, date: p.date, ffmi: p.ffmi, bmi: p.bmi });
  };
  const onLeave = () => setTooltip(null);

  return (
    <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
      <b>📊 FFMI / BMI</b>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <div style={{ padding: 10, background: '#27272a', borderRadius: 8, minWidth: 100 }}>
          <div style={{ fontSize: 10, color: colors.textMuted }}>FFMI</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: ffmiColor }}>{latest.ffmi.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: colors.textMuted }}>{ffmiLabel(latest.ffmi)}</div>
        </div>
        <div style={{ padding: 10, background: '#27272a', borderRadius: 8, minWidth: 100 }}>
          <div style={{ fontSize: 10, color: colors.textMuted }}>BMI</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>{latest.bmi.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: colors.textMuted }}>
            {latest.bmi < 18.5 ? 'Дефицит' : latest.bmi < 25 ? 'Норма' : latest.bmi < 30 ? 'Избыток' : 'Ожирение'}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="FFMI и BMI тренд">
            <defs>
              <linearGradient id="ffmiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ffmiColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={ffmiColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#555" />
            <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#555" />
            {[15, 20, 24, 26, 30].map(v => (
              <text key={`ffmi-${v}`} x={PAD - 4} y={tyFFMI(v)} textAnchor="end" fill="#888" fontSize="8">{v}</text>
            ))}
            {data.map((p, i) => {
              const x = tx(i);
              const y = tyFFMI(p.ffmi);
              return <circle key={`ffmi-p-${i}`} cx={x} cy={y} r="3" fill={ffmiColor} opacity={0.9} style={{ cursor: 'pointer' }} onMouseEnter={(e) => onMove(e, p, i)} onMouseMove={(e) => onMove(e, p, i)} onMouseLeave={onLeave} onTouchStart={(e) => { e.preventDefault(); onMove(e, p, i); }} />;
            })}
            {data.map((p, i) => {
              if (i === 0) return null;
              const x1 = tx(i - 1);
              const x2 = tx(i);
              const y1 = tyFFMI(data[i - 1].ffmi);
              const y2 = tyFFMI(p.ffmi);
              return <line key={`ffmi-l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ffmiColor} strokeWidth="2" opacity={0.6} />;
            })}
            <text x={W / 2} y={H - 4} textAnchor="middle" fill="#ffffff" fontSize="9">{data[0]?.date}</text>
            <text x={W - PAD} y={H - 4} textAnchor="end" fill="#ffffff" fontSize="9">{data.at(-1)?.date}</text>
            {tooltip && (
              <>
                <rect x={Math.min(tooltip.x + 8, W - 140)} y={Math.max(tooltip.y - 50, 4)} width={130} height={44} rx={6} fill="rgba(0,0,0,0.9)" stroke="#3f3f46" />
                <text x={Math.min(tooltip.x + 12, W - 136)} y={Math.max(tooltip.y - 32, 18)} fill="#fff" fontSize="9">{tooltip.date}</text>
                <text x={Math.min(tooltip.x + 12, W - 136)} y={Math.max(tooltip.y - 18, 32)} fill={ffmiColor} fontSize="9">FFMI {tooltip.ffmi.toFixed(1)}</text>
                <text x={Math.min(tooltip.x + 12, W - 136)} y={Math.max(tooltip.y - 6, 46)} fill="#a78bfa" fontSize="9">BMI {tooltip.bmi.toFixed(1)}</text>
              </>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
};
