import React, { useMemo } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { loadReadinessHistory } from './readiness-history';
import { applyToPlanner } from './planner-bridge';

interface WeeklyPoint {
  weekStart: string;
  volume: number;
  avgReadiness: number;
}

function computeWeeklyVolume(sessions: WorkoutLog[]): { weekStart: string; volume: number }[] {
  const weekMap: Record<string, number[]> = {};
  sessions.forEach((w: any) => {
    const d = new Date(w.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    const vol = (w.exercises || []).reduce((s: number, e: any) => {
      return s + (e.sets || []).reduce((ss: number, st: any) => ss + (st.weight || 0) * (st.reps || 0), 0);
    }, 0);
    if (!weekMap[key]) weekMap[key] = [];
    weekMap[key].push(vol);
  });
  return Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, vols]) => ({
    weekStart: week,
    volume: vols.reduce((s, v) => s + v, 0),
  }));
}

function computeCorrelation(xs: number[], ys: number[]): { r: number; slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return { r: 0, slope: 0, intercept: 0 };
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const r = Math.sqrt(denX * denY) > 0 ? num / Math.sqrt(denX * denY) : 0;
  const slope = denX > 0 ? num / denX : 0;
  return { r, slope, intercept: meanY - slope * meanX };
}

const VolumeRecoveryCorrelationCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const analysis = useMemo(() => {
    if (!sessions.length) return null;
    const weekly = computeWeeklyVolume(sessions);
    const history = loadReadinessHistory();
    if (!weekly.length || !history.length) return null;
    // Match weekly volume to average readiness for that week
    const points: WeeklyPoint[] = weekly.map(w => {
      const weekEnd = new Date(w.weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const endStr = weekEnd.toISOString().slice(0, 10);
      const weekReadiness = history
        .filter(h => h.date >= w.weekStart && h.date < endStr)
        .map(h => h.recovery);
      return {
        weekStart: w.weekStart,
        volume: w.volume,
        avgReadiness: weekReadiness.length > 0
          ? weekReadiness.reduce((s, v) => s + v, 0) / weekReadiness.length
          : 0,
      };
    }).filter(p => p.avgReadiness > 0);
    if (points.length < 3) return null;
    const vols = points.map(p => p.volume / 1000);
    const reads = points.map(p => p.avgReadiness);
    const corr = computeCorrelation(vols, reads);
    // Estimate MRV: volume where readiness drops below 40
    const estimatedMRV = corr.slope < 0 && corr.intercept > 0
      ? Math.round(((40 - corr.intercept) / corr.slope) * 1000)
      : null;
    return { points, corr, estimatedMRV };
  }, [sessions]);

  if (!analysis) return null;

  const { points, corr, estimatedMRV } = analysis;
  const maxVol = Math.max(...points.map(p => p.volume), 1);
  const maxRead = Math.max(...points.map(p => p.avgReadiness), 50);

  // SVG scatter plot
  const W = 280, H = 120, PAD = 24;
  const scaleX = (v: number) => PAD + ((v / 1000) / (maxVol / 1000)) * (W - PAD * 2);
  const scaleY = (r: number) => H - PAD - (r / Math.max(1, maxRead)) * (H - PAD * 2);
  // Trend line
  const trendX1 = 0, trendY1 = corr.intercept + corr.slope * trendX1;
  const trendX2 = maxVol / 1000, trendY2 = corr.intercept + corr.slope * trendX2;

  return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        🔄 Корреляция объём ↔ восстановление
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
        {points.length} точек (недель с данными) · r = {corr.r.toFixed(2)}
        {corr.r < -0.3 ? ' (умеренная обратная)' : corr.r < -0.1 ? ' (слабая обратная)' : Math.abs(corr.r) < 0.1 ? ' (нет корреляции)' : ' (положительная)'}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 320, margin: '0 auto', display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = scaleY(f * maxRead);
          return <line key={y} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />;
        })}
        {/* Trend line */}
        {corr.slope !== 0 && (
          <line
            x1={scaleX(0)} y1={Math.max(PAD, Math.min(H - PAD, scaleY(Math.max(0, trendY1))))}
            x2={scaleX(trendX2)} y2={Math.max(PAD, Math.min(H - PAD, scaleY(Math.max(0, trendY2))))}
            stroke={corr.r < 0 ? '#ef4444' : '#22c55e'} strokeWidth={1.2} strokeDasharray="3,2"
          />
        )}
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i} cx={scaleX(p.volume)} cy={scaleY(p.avgReadiness)}
            r={3} fill={p.avgReadiness > 60 ? '#22c55e' : p.avgReadiness > 40 ? '#f59e0b' : '#ef4444'}
            opacity={0.7}
          />
        ))}
        {/* Labels */}
        <text x={W / 2} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7}>Объём (тыс. кг)</text>
        <text x={6} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7} transform={`rotate(-90, 6, ${H / 2})`}>Готовность (%)</text>
      </svg>
      {estimatedMRV && estimatedMRV > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, padding: '4px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)' }}>
          <span style={{ fontWeight: 600 }}>📊 Оценка индивидуального MRV:</span>{' '}
          ~{estimatedMRV.toLocaleString()} кг/нед (готовность падает ниже 40%)
        </div>
      )}
      {corr.r < -0.3 && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '4px 6px' }}>
          ⚠ При увеличении объёма готовность снижается. Рекомендуется не превышать {Math.round(points[points.length - 1]?.volume || 0).toLocaleString()} кг/нед.
        </div>
      )}
{estimatedMRV != null && (
      <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>🔗 MRV из корреляции объём↔восстановление: <b style={{ color: '#00e68a' }}>{estimatedMRV}</b> (объём, где готовность падает до 40).</div>
        <button onClick={() => applyToPlanner({ kind: 'mrv', label: 'MRV (корреляция) ' + estimatedMRV, data: { mrv: estimatedMRV } })} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, minHeight: 40 }}>🛠 Применить MRV к планировщику</button>
      </div>
    )}
    </div>
  );
};

export default React.memo(VolumeRecoveryCorrelationCard);
