/** DiaryChart.tsx — унифицированные мини-диаграммы дневника (SVG, без внешних библиотек).
 *  Grid, подписи, tooltip через <title>. Заменяет разрозненные inline-SVG в хабе. */
import React from 'react';

interface BaseProps {
  width?: number;
  height?: number;
  color?: string;
}

export const MiniLineChart: React.FC<{
  data: number[];
  labels?: string[];
  color?: string;
  width?: number;
  height?: number;
  showDots?: boolean;
  ySuffix?: string;
  /** Несколько серий на одном графике (оверлей мезоциклов и т.п.). */
  series?: Array<{ name: string; color: string; data: number[]; labels?: string[] }>;
}> = ({ data, labels, color = '#00e68a', width = 280, height = 50, showDots = true, ySuffix = '', series }) => {
  const allData = series ? series.flatMap(s => s.data) : data;
  if (allData.length < 2) return null;
  const min = Math.min(...allData, 0);
  const max = Math.max(...allData, 1);
  const range = max - min || 1;
  const px = (i: number, len: number) => 4 + (i / Math.max(len - 1, 1)) * (width - 8);
  const py = (v: number) => height - 4 - ((v - min) / range) * (height - 12);
  const renderSeries = (pts: number[], lbls: string[] | undefined, col: string, dots: boolean, lastBold: boolean) => {
    if (pts.length < 2) return null;
    const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i, pts.length).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    return (
      <g key={col + pts.length}>
        <path d={path} fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        {dots && pts.map((v, i) => (
          <circle key={i} cx={px(i, pts.length)} cy={py(v)} r={lastBold && i === pts.length - 1 ? 3 : 1.8}
            fill={lastBold && i === pts.length - 1 ? col : 'rgba(255,255,255,0.3)'} stroke={lastBold && i === pts.length - 1 ? '#000' : 'none'} strokeWidth={0.5}>
            <title>{`${lbls?.[i] ?? i + 1}: ${Math.round(v)}${ySuffix}`}</title>
          </circle>
        ))}
      </g>
    );
  };
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: width }}>
        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1={4} x2={width - 4} y1={height - 4 - p * (height - 12)} y2={height - 4 - p * (height - 12)}
            stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
        ))}
        <text x={2} y={height - 4} fontSize={7} fill="rgba(255,255,255,0.3)">{Math.round(min)}{ySuffix}</text>
        <text x={2} y={10} fontSize={7} fill="rgba(255,255,255,0.3)">{Math.round(max)}{ySuffix}</text>
        {series
          ? series.map(s => renderSeries(s.data, s.labels, s.color, showDots, false))
          : renderSeries(data, labels, color, showDots, true)}
      </svg>
      {series && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 2 }}>
          {series.map(s => <span key={s.name} style={{ fontSize: 9, color: s.color }}>● {s.name}</span>)}
        </div>
      )}
    </div>
  );
};

export const MiniBarChart: React.FC<{
  data: Array<{ value: number; label?: string; color?: string }>;
  width?: number;
  height?: number;
  valueSuffix?: string;
}> = ({ data, width = 280, height = 50, valueSuffix = '' }) => {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map(d => d.value));
  const bw = Math.max(2, (width - 8) / data.length - 3);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: width }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (height - 16));
        const x = 4 + i * ((width - 8) / data.length);
        const y = height - 8 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={2} fill={d.color || '#00e68a'} opacity={d.value > 0 ? 0.85 : 0.05}>
              <title>{`${d.label ?? i + 1}: ${Math.round(d.value)}${valueSuffix}`}</title>
            </rect>
            {d.value > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={7}>{Math.round(d.value)}</text>}
            {d.label && <text x={x + bw / 2} y={height - 1} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7}>{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
};
