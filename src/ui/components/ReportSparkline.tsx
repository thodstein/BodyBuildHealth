import React from 'react';

export interface ReportSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDots?: boolean;
  showArea?: boolean;
}

export const ReportSparkline: React.FC<ReportSparklineProps> = ({
  data,
  color = '#00e68a',
  height = 28,
  width = 100,
  showDots = false,
  showArea = false,
}) => {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} style={{ opacity: 0.3 }}><line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#666" strokeWidth="1" /></svg>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return { x, y, v };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  const area = showArea ? ` ${points.map(p => `${p.x},${p.y}`).join(' ')} ${points[points.length-1].x},${height} ${points[0].x},${height}` : '';

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {showArea && (
        <polygon points={area} fill={color} opacity={0.12} />
      )}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
      ))}
      {points.length > 0 && <circle cx={points[0].x} cy={points[0].y} r="2.5" fill={color} opacity={0.7} />}
      {points.length > 1 && <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="2.5" fill={color} />}
    </svg>
  );
};
