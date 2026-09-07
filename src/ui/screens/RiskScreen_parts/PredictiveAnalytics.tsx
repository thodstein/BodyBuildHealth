// ============================================================
// PredictiveAnalytics.tsx — ARIMA + Holt-Winters display
// ============================================================

import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { predict, type ForecastPoint } from '../../../engines/predictive-analytics.engine';

const GLASS = { background: 'rgba(20,22,30,0.55)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: 16, boxShadow: '0 12px 30px rgba(0,0,0,0.20)' };

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
    <div className="risk-predictive" style={{ ...GLASS, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>📈 Предиктивная аналитика</div>
          <div style={{ fontSize: 12, color: '#fff', marginTop:2 }}>ARIMA(1,1,1) / Holt-Winters · прогноз + 95% ДИ</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {availableMarkers.map(m => (
          <button key={m} onClick={() => setMarker(m)} style={{
            minHeight:44, padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: marker === m ? 800 : 600, cursor: 'pointer',
            background: marker === m ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.06)',
            border: marker === m ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.10)',
            color: '#fff',
          }}>{m}</button>
        ))}
      </div>

      {allPoints.length < 2 ? (
        <div style={{ fontSize: 12, color: '#fff', textAlign: 'center', padding: 18, lineHeight:1.5 }}>
          Недостаточно данных для прогноза. Добавьте минимум 2 измерения.
        </div>
      ) : (
        <div>
          {/* Mini SVG chart */}
          <svg viewBox="0 0 360 150" style={{ display: 'block', width: '100%', height: 'auto' }}>
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

          <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight:700, color: '#fff', justifyContent: 'center', marginTop: 8 }}>
            <span>🟢 Факт</span>
            <span style={{ color: '#fff' }}>━ Прогноз</span>
            <span style={{ color: '#fff' }}>┊ 95% ДИ</span>
          </div>

          {/* Forecast table */}
          {forecast.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {forecast.slice(0, 6).map((f, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 12, background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.18)' }}>
                  <div style={{ fontSize: 11, color: '#fff', fontWeight:700 }}>Неделя +{i + 1}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop:2 }}>{f.value}</div>
                  <div style={{ fontSize: 11, color: '#fff', marginTop:2 }}>±{Math.round((f.ci95_high - f.ci95_low) / 2 * 100) / 100}</div>
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
