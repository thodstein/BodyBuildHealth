/**
 * Sparkline.tsx — tiny inline SVG sparkline for trend visualization.
 */
import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data, width = 80, height = 24, color = '#00e68a', showDots = true, showArea = true,
}) => {
  if (!data || data.length < 2) return <span style={{ width, height: height + 4, display: 'inline-block' }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = pathD + ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const trend = data[data.length - 1] - data[0];
  const trendUp = trend > 0;

  return (
    <svg width={width} height={height + 4} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {showArea && (
        <path d={areaD} fill={color} opacity={0.12} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.length <= 12 && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 2.5 : 1.5}
          fill={i === points.length - 1 ? color : '#fff'}
          stroke={i === points.length - 1 ? '#000' : 'none'}
          strokeWidth={i === points.length - 1 ? 0.5 : 0}
        />
      ))}
    </svg>
  );
};
