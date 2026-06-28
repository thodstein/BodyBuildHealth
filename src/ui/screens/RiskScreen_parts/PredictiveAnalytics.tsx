// ============================================================
// PredictiveAnalytics.tsx — ARIMA + Holt-Winters display
// ============================================================

import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { predict, type ForecastPoint } from '../../../engines/predictive-analytics.engine';

const GLASS = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 };

export const PredictiveAnalytics: React.FC = () => {
  const linked = useDataLink();
  const [marker, setMarker] = useState('ALT');

  const forecast = useMemo<ForecastPoint[]>(() => {
    const labs = linked.labs || [];
    const filtered = labs.filter(l => l.code === marker || l.name === marker);
    if (filtered.length < 2) return [];
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    const points = sorted.map((l, i) => ({ time: i, value: l.value }));
    try {
      return predict({ history: points, method: 'auto', seasonality: 4, horizon: 6 });
    } catch { return []; }
  }, [linked.labs, marker]);

  const availableMarkers = useMemo(() => {
    const labs = linked.labs || [];
    return [...new Set(labs.map(l => l.code || l.name).filter(Boolean))].slice(0, 20);
  }, [linked.labs]);

  const allPoints = useMemo(() => {
    const labs = linked.labs || [];
    return labs.filter(l => l.code === marker || l.name === marker)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [linked.labs, marker]);

  return (
    <div style={{ ...GLASS, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>📈 Предиктивная аналитика</div>
          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>ARIMA(1,1,1) / Holt-Winters · прогноз + 95% ДИ</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {availableMarkers.map(m => (
          <button key={m} onClick={() => setMarker(m)} style={{
            padding: '4px 8px', borderRadius: 8, fontSize: 8, fontWeight: marker === m ? 700 : 400, cursor: 'pointer',
            background: marker === m ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
            border: marker === m ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.06)',
            color: marker === m ? '#818cf8' : 'rgba(255,255,255,0.5)',
          }}>{m}</button>
        ))}
      </div>

      {allPoints.length < 2 ? (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 16 }}>
          Недостаточно данных для прогноза. Добавьте минимум 2 измерения.
        </div>
      ) : (
        <div>
          {/* Mini SVG chart */}
          <svg width={360} height={150} style={{ display: 'block', maxWidth: '100%' }}>
            {[0, 25, 50, 75, 100].map(p => (
              <line key={'g'+p} x1={30} y1={10+(100-p)*1.15} x2={350} y2={10+(100-p)*1.15} stroke="rgba(255,255,255,0.04)" strokeDasharray="2,2" />
            ))}
            {/* Actual values */}
            {allPoints.map((p, i) => {
              const maxV = Math.max(...allPoints.map(x => x.value), ...forecast.map(f => f.value), 1);
              const x = 30 + (i / (allPoints.length + forecast.length - 1)) * 310;
              const y = 10 + 115 - (p.value / maxV) * 115;
              return <circle key={'a'+i} cx={x} cy={y} r={3} fill="#00e68a" />;
            })}
            {/* Forecast line */}
            {forecast.length > 0 && (() => {
              const pts = [
                ...allPoints.map((p, i) => {
                  const maxV = Math.max(...allPoints.map(x => x.value), ...forecast.map(f => f.value), 1);
                  return { x: 30 + (i / (allPoints.length + forecast.length - 1)) * 310, y: 10 + 115 - (p.value / maxV) * 115 };
                }),
                ...forecast.map((f, i) => {
                  const maxV = Math.max(...allPoints.map(x => x.value), ...forecast.map(f => f.value), 1);
                  return { x: 30 + ((allPoints.length + i) / (allPoints.length + forecast.length - 1)) * 310, y: 10 + 115 - (f.value / maxV) * 115 };
                })
              ];
              return <path d={pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ')} fill="none" stroke="#818cf8" strokeWidth={2} strokeDasharray={allPoints.length > 0 ? `${allPoints.length * 15} 300` : '0'} />;
            })()}
            {/* CI bands */}
            {forecast.map((f, i) => {
              const maxV = Math.max(...allPoints.map(x => x.value), ...forecast.map(f => f.value), 1);
              const baseX = 30 + ((allPoints.length + i) / (allPoints.length + forecast.length - 1)) * 310;
              const yHi = 10 + 115 - (f.ci95_high / maxV) * 115;
              const yLo = 10 + 115 - (f.ci95_low / maxV) * 115;
              return <line key={'ci'+i} x1={baseX} y1={yLo} x2={baseX} y2={yHi} stroke="#818cf8" strokeWidth={1} opacity={0.3} />;
            })}
          </svg>

          <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.4)', justifyContent: 'center', marginTop: 4 }}>
            <span>🟢 Факт</span>
            <span style={{ color: '#818cf8' }}>━ Прогноз</span>
            <span style={{ color: '#818cf8' }}>┊ 95% ДИ</span>
          </div>

          {/* Forecast table */}
          {forecast.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
              {forecast.slice(0, 6).map((f, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 6, borderRadius: 6, background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.08)' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Неделя +{i + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#818cf8' }}>{f.value}</div>
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>±{Math.round((f.ci95_high - f.ci95_low) / 2 * 100) / 100}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictiveAnalytics;
