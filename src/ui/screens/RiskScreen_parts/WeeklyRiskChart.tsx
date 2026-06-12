import React, { useState, useMemo } from 'react';
import type { WeeklyRiskDynamics, WeeklyRiskPoint } from '../../../engines/weekly-risk-dynamics.engine';
import { getRiskColor } from '../../../core/utils/risk-colors';
import { PHARMA_DB } from '../../../core/pharma-database';

interface Props {
  dynamics: WeeklyRiskDynamics | null;
  selectedWeek: number | null;
  onWeekSelect: (week: number | null) => void;
  mode: 'week' | 'average';
  onModeChange: (mode: 'week' | 'average') => void;
}

function getDrugName(id: string): string {
  const sub = (PHARMA_DB as any)[id];
  return sub?.name || id;
}

// Smooth curve interpolation (catmull-rom в†’ cubic bezier)
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const WeeklyRiskChart: React.FC<Props> = ({ dynamics, selectedWeek, onWeekSelect, mode, onModeChange }) => {
  if (!dynamics || dynamics.weeks.length === 0) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          РќРµС‚ РґР°РЅРЅС‹С… Рѕ РєСѓСЂСЃРµ РґР»СЏ СЂР°СЃС‡С‘С‚Р° РґРёРЅР°РјРёРєРё СЂРёСЃРєРѕРІ
        </div>
      </div>
    );
  }

  const weeks = dynamics.weeks;
  const maxWeek = weeks.length - 1;

  // Responsive dimensions (wider)
  const W = 560;
  const H = 180;
  const PAD = { top: 24, right: 16, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const courseStart = Math.min(...weeks.filter(w => w.activeDrugs.length > 0).map(w => w.week));
  const courseEnd = Math.max(...weeks.filter(w => w.activeDrugs.length > 0).map(w => w.week));

  const toX = (w: number) => PAD.left + (w / maxWeek) * chartW;
  const toY = (v: number) => H - PAD.bottom - (Math.min(v, 100) / 100) * chartH;

  const pointsNet = weeks.map(p => ({ x: toX(p.week), y: toY(p.overallNet) }));
  const pointsRaw = weeks.map(p => ({ x: toX(p.week), y: toY(p.overallRaw) }));
  const netPath = smoothPath(pointsNet);
  const rawPath = smoothPath(pointsRaw);

  // Area paths (smooth curve to bottom)
  const bottom = H - PAD.bottom;
  const netAreaPath = pointsNet.length > 0
    ? smoothPath(pointsNet) + ` L${toX(maxWeek).toFixed(1)},${bottom} L${toX(0).toFixed(1)},${bottom} Z`
    : '';
  const rawAreaPath = pointsRaw.length > 0
    ? smoothPath(pointsRaw) + ` L${toX(maxWeek).toFixed(1)},${bottom} L${toX(0).toFixed(1)},${bottom} Z`
    : '';

  // Grid lines
  const gridValues = [0, 25, 50, 75, 100];
  const gridLines = gridValues.map(v => ({
    y: toY(v),
    label: `${v}`,
  }));

  // Week markers
  const step = maxWeek <= 16 ? 2 : maxWeek <= 30 ? 4 : 8;
  const weekTicks: number[] = [];
  for (let w = 0; w <= maxWeek; w += step) weekTicks.push(w);
  if (weekTicks[weekTicks.length - 1] !== maxWeek) weekTicks.push(maxWeek);

  const selectedPoint = selectedWeek !== null ? weeks.find(p => p.week === selectedWeek) : null;

  // Concentration area smoothing
  const concPoints = weeks.map(p => ({ x: toX(p.week), y: bottom - p.peakConcentration * chartH }));
  const concAreaPath = smoothPath(concPoints) + ` L${toX(maxWeek).toFixed(1)},${bottom} L${toX(0).toFixed(1)},${bottom} Z`;

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>рџ“€ Р”РёРЅР°РјРёРєР° СЂРёСЃРєРѕРІ РїРѕ РЅРµРґРµР»СЏРј</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onModeChange('average')}
            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: mode === 'average' ? 'var(--accent)' : 'transparent', color: mode === 'average' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer' }}
          >РЎСЂРµРґРЅРµРµ</button>
          <button
            onClick={() => onModeChange('week')}
            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: mode === 'week' ? 'var(--accent)' : 'transparent', color: mode === 'week' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer' }}
          >РџРѕ РЅРµРґРµР»Рµ</button>
        </div>
      </div>

      {mode === 'week' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>РќРµРґРµР»СЏ:</label>
          <input
            type="range" min={0} max={maxWeek}
            value={selectedWeek ?? 0}
            onChange={e => onWeekSelect(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30, color: 'var(--accent)' }}>{selectedWeek ?? 0}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#7c4dff' }}>в—Џ Raw (Р±РµР· РїРѕРґРґРµСЂР¶РєРё)</span>
        <span style={{ color: '#00e68a' }}>в—Џ Net (СЃ РїРѕРґРґРµСЂР¶РєРѕР№)</span>
        <span style={{ color: 'rgba(255,152,0,0.5)' }}>в–“ РљРѕРЅС†РµРЅС‚СЂР°С†РёСЏ (PK)</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: H + 20 }}>
        <defs>
          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e68a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00e68a" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="rawGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c4dff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#7c4dff" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="concGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9800" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ff9800" stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Course shading */}
        {courseStart !== undefined && courseEnd !== undefined && (
          <rect x={toX(courseStart)} y={PAD.top} width={toX(courseEnd) - toX(courseStart)} height={chartH}
            fill="rgba(0,230,138,0.06)" rx="2" />
        )}

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={`g${i}`}>
            <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="var(--border)" strokeWidth="0.5" opacity={0.5} />
            <text x={PAD.left - 4} y={g.y + 3} fill="var(--text-dim)" fontSize="8" textAnchor="end">{g.label}</text>
          </g>
        ))}

        {/* Concentration area */}
        <path d={concAreaPath} fill="url(#concGrad)" stroke="rgba(255,152,0,0.25)" strokeWidth="0.5" />

        {/* Raw area + line */}
        <path d={rawAreaPath} fill="url(#rawGrad)" />
        <path d={rawPath} fill="none" stroke="#7c4dff" strokeWidth="2" opacity={0.7} filter="url(#glow)" />

        {/* Net area + line */}
        <path d={netAreaPath} fill="url(#netGrad)" />
        <path d={netPath} fill="none" stroke="#00e68a" strokeWidth="2.5" filter="url(#glow)" />

        {/* Average line */}
        {mode === 'average' && (
          <line x1={PAD.left} y1={toY(dynamics.averageRisk.overallNet)} x2={W - PAD.right} y2={toY(dynamics.averageRisk.overallNet)}
            stroke="#00e68a" strokeWidth="1.5" strokeDasharray="6 3" opacity={0.7} />
        )}

        {/* Selected week indicator */}
        {selectedWeek !== null && selectedPoint && (
          <>
            <line x1={toX(selectedWeek)} y1={PAD.top} x2={toX(selectedWeek)} y2={H - PAD.bottom}
              stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="4 3" opacity={0.6} />
            <circle cx={toX(selectedWeek)} cy={toY(selectedPoint.overallNet)} r="5" fill="#00e68a" stroke="#000" strokeWidth="1.5" filter="url(#glow)" />
            <circle cx={toX(selectedWeek)} cy={toY(selectedPoint.overallRaw)} r="4" fill="#7c4dff" stroke="#000" strokeWidth="1.5" />
            <circle cx={toX(selectedWeek)} cy={toY(0)} r="2" fill="#ff9800" />
          </>
        )}

        {/* Week labels */}
        {weekTicks.map((w, i) => (
          <text key={`w${i}`} x={toX(w)} y={H - 4} fill="var(--text-dim)" fontSize="8" textAnchor="middle">{w}</text>
        ))}

        <text x={PAD.left - 2} y={PAD.top + 8} fill="var(--text-dim)" fontSize="8">%</text>
        <text x={W / 2} y={H - 1} fill="var(--text-dim)" fontSize="8" textAnchor="middle">РќРµРґРµР»Рё</text>
      </svg>

      {/* Selected week details */}
      {selectedPoint && mode === 'week' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>РќРµРґРµР»СЏ {selectedPoint.week}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: selectedPoint.accumulationPhase === 'steady' ? 'rgba(0,230,138,0.15)' : selectedPoint.accumulationPhase === 'ramp-up' ? 'rgba(234,179,8,0.15)' : selectedPoint.accumulationPhase === 'washout' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
              color: selectedPoint.accumulationPhase === 'steady' ? '#00e68a' : selectedPoint.accumulationPhase === 'ramp-up' ? '#eab308' : selectedPoint.accumulationPhase === 'washout' ? '#3b82f6' : '#6b7280',
            }}>
              {selectedPoint.accumulationPhase === 'steady' ? '' : selectedPoint.accumulationPhase === 'ramp-up' ? '' : selectedPoint.accumulationPhase === 'washout' ? '' : 'вЂ”'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Raw</div>
              <div style={{ fontWeight: 700, color: getRiskColor(selectedPoint.overallRaw) }}>{Math.round(selectedPoint.overallRaw)}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Net</div>
              <div style={{ fontWeight: 700, color: getRiskColor(selectedPoint.overallNet) }}>{Math.round(selectedPoint.overallNet)}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>РљРѕРЅС†.</div>
              <div style={{ fontWeight: 700 }}>{Math.round(selectedPoint.peakConcentration * 100)}%</div>
            </div>
          </div>
          {selectedPoint.activeDrugs.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {selectedPoint.activeDrugs.map(d => (
                <span key={d} style={{ background: 'rgba(0,230,138,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 9, color: 'var(--accent)' }}>
                  {getDrugName(d)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8, fontSize: 10 }}>
        <div className="risk-row" style={{ flexDirection: 'column', gap: 0, padding: '6px 4px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РџРёРє СЂРёСЃРєР°</div>
          <div className="risk-badge" style={{ background: getRiskColor(dynamics.peakRiskValue), fontSize: 13 }}>{Math.round(dynamics.peakRiskValue)}%</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>РЅРµРґ. {dynamics.peakRiskWeek}</div>
        </div>
        <div className="risk-row" style={{ flexDirection: 'column', gap: 0, padding: '6px 4px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РњРёРЅРёРјСѓРј</div>
          <div className="risk-badge" style={{ background: getRiskColor(dynamics.minRiskValue), fontSize: 13 }}>{Math.round(dynamics.minRiskValue)}%</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>РЅРµРґ. {dynamics.minRiskWeek}</div>
        </div>
        <div className="risk-row" style={{ flexDirection: 'column', gap: 0, padding: '6px 4px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>РЎСЂРµРґРЅРµРµ</div>
          <div className="risk-badge" style={{ background: getRiskColor(dynamics.averageRisk.overallNet), fontSize: 13 }}>{Math.round(dynamics.averageRisk.overallNet)}%</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>overall</div>
        </div>
        <div className="risk-row" style={{ flexDirection: 'column', gap: 0, padding: '6px 4px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Р”Р»РёС‚.</div>
          <div className="risk-badge" style={{ background: '#6b7280', fontSize: 13 }}>{dynamics.courseDuration} РЅРµРґ</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>РєСѓСЂСЃ</div>
        </div>
      </div>
    </div>
  );
};