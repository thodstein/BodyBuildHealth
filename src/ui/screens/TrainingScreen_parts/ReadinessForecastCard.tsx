/**
 * ReadinessForecastCard.tsx — прогноз готовности/усталости на 2-4 недели
 * (Хольт-линейный через generateReadinessForecast) + история тренда.
 */
import React, { useMemo, useState } from 'react';
import { generateReadinessForecast } from '../../../engines/predictive.engine';
import { loadReadinessHistory, type ReadinessHistoryPoint } from './readiness-history';
import { MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };

export const ReadinessForecastCard: React.FC = () => {
  const [history] = useState<ReadinessHistoryPoint[]>(() => loadReadinessHistory());
  const recs = useMemo(() => history.map(p => p.recovery), [history]);
  const forecast = useMemo(() => recs.length >= 3 ? generateReadinessForecast(recs) : null, [recs]);

  if (recs.length < 3) {
    return <div className="card" style={{ padding: 12 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13, color: ACCENT }}>📈 Прогноз готовности</h3>
      <div style={{ ...SMALL, color: 'var(--text-dim)' }}>Недостаточно данных ({recs.length}/3 дней). Открывайте приложение ежедневно — готовность записывается в историю, и прогноз появится.</div>
    </div>;
  }

  const all = [...recs, ...(forecast?.values || [])];
  const minV = Math.min(...all), maxV = Math.max(...all);
  const W = 320, H = 70, pad = 8;
  const px = (i: number) => pad + (i / Math.max(1, all.length - 1)) * (W - 2 * pad);
  const py = (v: number) => H - pad - ((v - minV) / Math.max(1, maxV - minV)) * (H - 2 * pad);
  const histPts = recs.map((v: number, i: number) => `${px(i)},${py(v)}`).join(' ');
  const fcPts = (forecast?.values || []).map((v: number, i: number) => `${px(recs.length - 1 + i)},${py(v)}`).join(' ');

  return (
    <div className="card" style={{ padding: 12, marginBottom: 8 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13, color: ACCENT }}>📈 Прогноз готовности (Хольт, {recs.length} дн истории)</h3>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 360, margin: '4px auto', display: 'block' }}>
        <polyline points={histPts} fill="none" stroke="#60a5fa" strokeWidth={1.6} />
        <polyline points={fcPts} fill="none" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="4 3" />
        {forecast?.values.map((v: number, i: number) => <circle key={i} cx={px(recs.length - 1 + i)} cy={py(v)} r={2.5} fill={ACCENT} />)}
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#60a5fa' }}>● история</span>
        <span style={{ fontSize: 10, color: ACCENT }}>● прогноз</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
        {forecast?.values.map((v: number, i: number) => (
          <div key={i} style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>+{i + 1} дн</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: v >= 70 ? '#22c55e' : v >= 50 ? '#eab308' : '#ef4444' }}>{Math.round(v)}</div>
            {forecast.ci95[i] && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>ДИ {Math.round(forecast.ci95[i][0])}-{Math.round(forecast.ci95[i][1])}</div>}
          </div>
        ))}
      </div>
      {forecast && forecast.warnings.length > 0 && <div style={{ ...SMALL, marginTop: 8, padding: 6, background: 'rgba(239,68,68,0.06)', borderRadius: 6, color: '#ef4444' }}>{forecast.warnings.join(' ')}</div>}
    </div>
  );
};

export default ReadinessForecastCard;