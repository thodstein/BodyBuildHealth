import React, { useMemo } from 'react';
import { colors } from '../../ui';

export interface Ratio {
  id: string;
  label: string;
  value: number | null;
  ideal: [number, number];
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  delta?: number;
}

interface MeasurementRatiosProps {
  ratios: Ratio[];
}

const band = (v: number | null, ideal: [number, number]) => {
  if (v === null) return { color: '#27272a', text: '#ffffff', label: '—' };
  if (v >= ideal[0] && v <= ideal[1]) return { color: '#22c55e18', text: '#22c55e', label: 'В норме' };
  if (v < ideal[0]) return { color: '#ef444418', text: '#ef4444', label: 'Ниже нормы' };
  return { color: '#f59e0b18', text: '#f59e0b', label: 'Выше нормы' };
};

export const MeasurementRatios: React.FC<MeasurementRatiosProps> = ({ ratios }) => {
  if (!ratios.length) return null;
  return (
    <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
      <b>📐 Пропорции</b>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
          marginTop: 8,
        }}
      >
        {ratios.map(r => {
          const state = band(r.value, r.ideal);
          const trendIcon = r.trend === 'up' ? '▲' : r.trend === 'down' ? '▼' : '●';
          const trendColor = r.trend === 'up' ? '#22c55e' : r.trend === 'down' ? '#ef4444' : '#ffffff';
          return (
            <div key={r.id} style={{ padding: 10, background: state.color, borderRadius: 8, border: `1px solid ${state.text}44` }}>
              <div style={{ fontSize: 11, color: colors.textMuted, display: 'flex', justifyContent: 'space-between' }}>
                <span>{r.label}</span>
                <span style={{ color: trendColor }}>{trendIcon}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <b style={{ fontSize: 16, color: state.text }}>
                  {r.value !== null ? r.value.toFixed(2) : '—'}
                </b>
                {r.unit && <small style={{ color: colors.textMuted }}>{r.unit}</small>}
                {r.delta !== undefined && Math.abs(r.delta) > 0.001 && (
                  <small style={{ color: r.delta > 0 ? '#22c55e' : '#ef4444', fontSize: 10 }}>
                    {r.delta > 0 ? '+' : ''}{r.delta.toFixed(2)}
                  </small>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <div style={{ fontSize: 10, color: state.text }}>{state.label}</div>
                <div style={{ fontSize: 10, color: '#ffffff' }}>
                  идеал {r.ideal[0]}-{r.ideal[1]}
                </div>
              </div>
              {r.value !== null && (
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#3f3f46', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, ((r.value - r.ideal[0]) / (r.ideal[1] - r.ideal[0])) * 100))}%`,
                      height: '100%',
                      background: state.text,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
