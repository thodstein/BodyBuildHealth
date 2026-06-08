import React, { useState, useMemo } from 'react';
import type { WeeklyRiskDynamics, WeeklyRiskPoint } from '../../../engines/weekly-risk-dynamics.engine';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface Props {
  dynamics: WeeklyRiskDynamics | null;
  selectedWeek: number | null;
  onWeekSelect: (week: number | null) => void;
  mode: 'week' | 'average';
  onModeChange: (mode: 'week' | 'average') => void;
}

export const WeeklyRiskChart: React.FC<Props> = ({ dynamics, selectedWeek, onWeekSelect, mode, onModeChange }) => {
  if (!dynamics || dynamics.weeks.length === 0) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          Нет данных о курсе для расчёта динамики рисков
        </div>
      </div>
    );
  }

  const weeks = dynamics.weeks;
  const maxWeek = weeks.length - 1;

  // SVG chart dimensions
  const W = 320;
  const H = 140;
  const PAD = 25;
  const chartW = W - PAD * 2;
  const chartH = H - PAD * 2;

  // Find course start/end for shading
  const courseStart = Math.min(...weeks.filter(w => w.activeDrugs.length > 0).map(w => w.week));
  const courseEnd = Math.max(...weeks.filter(w => w.activeDrugs.length > 0).map(w => w.week));

  const toX = (w: number) => PAD + (w / maxWeek) * chartW;
  const toY = (v: number) => H - PAD - (Math.min(v, 100) / 100) * chartH;

  // Build path for net risk line
  const netPath = weeks.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.overallNet).toFixed(1)}`).join(' ');
  const rawPath = weeks.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.overallRaw).toFixed(1)}`).join(' ');

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = toY(v);
    return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
  });

  // Week markers every 4 weeks
  const weekMarkers: string[] = [];
  const step = maxWeek <= 16 ? 2 : maxWeek <= 30 ? 4 : 8;
  for (let w = 0; w <= maxWeek; w += step) {
    const x = toX(w);
    weekMarkers.push(`<text x="${x}" y="${H - 5}" fill="var(--text-dim)" font-size="7" text-anchor="middle">${w}</text>`);
  }

  // Concentration area (shaded)
  const concArea = weeks.map((p, i) => {
    const x = toX(p.week);
    const y = H - PAD - (p.peakConcentration * chartH);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const concAreaPath = concArea + ` L${toX(maxWeek).toFixed(1)},${(H - PAD).toFixed(1)} L${toX(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  // Phase labels
  const phases = weeks.reduce((acc, p) => {
    if (p.accumulationPhase === 'ramp-up' && !acc.rampUp) acc.rampUp = p.week;
    if (p.accumulationPhase === 'steady' && !acc.steady) acc.steady = p.week;
    if (p.accumulationPhase === 'washout' && !acc.washout) acc.washout = p.week;
    return acc;
  }, {} as Record<string, number>);

  const selectedPoint = selectedWeek !== null ? weeks.find(p => p.week === selectedWeek) : null;

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>📈 Динамика рисков по неделям</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onModeChange('average')}
            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: mode === 'average' ? 'var(--accent)' : 'transparent', color: mode === 'average' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer' }}
          >
            Среднее
          </button>
          <button
            onClick={() => onModeChange('week')}
            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: mode === 'week' ? 'var(--accent)' : 'transparent', color: mode === 'week' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer' }}
          >
            По неделе
          </button>
        </div>
      </div>

      {mode === 'week' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Неделя:</label>
          <input
            type="range"
            min={0}
            max={maxWeek}
            value={selectedWeek ?? 0}
            onChange={e => onWeekSelect(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30 }}>{selectedWeek ?? 0}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#7c4dff' }}>● Raw (без поддержки)</span>
        <span style={{ color: '#00e68a' }}>● Net (с поддержкой)</span>
        <span style={{ color: 'rgba(255,152,0,0.4)' }}>▓ Концентрация (PK)</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Course shading */}
        {courseStart !== undefined && courseEnd !== undefined && (
          <rect x={toX(courseStart)} y={PAD} width={toX(courseEnd) - toX(courseStart)} height={chartH} fill="rgba(0,230,138,0.05)" />
        )}
        {gridLines.map((l, i) => <g key={`g${i}`} dangerouslySetInnerHTML={{ __html: l }} />)}
        {/* Concentration area */}
        <path d={concAreaPath} fill="rgba(255,152,0,0.12)" stroke="rgba(255,152,0,0.3)" strokeWidth="0.5" />
        {/* Risk lines */}
        <path d={rawPath} fill="none" stroke="#7c4dff" strokeWidth="1.5" opacity={0.6} />
        <path d={netPath} fill="none" stroke="#00e68a" strokeWidth="2" />
        {/* Selected week indicator */}
        {selectedWeek !== null && selectedPoint && (
          <>
            <line x1={toX(selectedWeek)} y1={PAD} x2={toX(selectedWeek)} y2={H - PAD} stroke="var(--text-dim)" strokeWidth="0.5" strokeDasharray="3 3" />
            <circle cx={toX(selectedWeek)} cy={toY(selectedPoint.overallNet)} r="3" fill="#00e68a" />
            <circle cx={toX(selectedWeek)} cy={toY(selectedPoint.overallRaw)} r="3" fill="#7c4dff" />
          </>
        )}
        {/* Average line */}
        {mode === 'average' && (
          <line x1={PAD} y1={toY(dynamics.averageRisk.overallNet)} x2={W - PAD} y2={toY(dynamics.averageRisk.overallNet)} stroke="#00e68a" strokeWidth="1" strokeDasharray="4 2" />
        )}
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        <text x={PAD} y={10} fill="var(--text-dim)" fontSize="8">%</text>
        <text x={W / 2} y={H - 1} fill="var(--text-dim)" fontSize="8" textAnchor="middle">Недели</text>
      </svg>

      {/* Selected week details */}
      {selectedPoint && mode === 'week' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Неделя {selectedPoint.week}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: selectedPoint.accumulationPhase === 'steady' ? 'rgba(0,230,138,0.15)' : selectedPoint.accumulationPhase === 'ramp-up' ? 'rgba(234,179,8,0.15)' : selectedPoint.accumulationPhase === 'washout' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
              color: selectedPoint.accumulationPhase === 'steady' ? '#00e68a' : selectedPoint.accumulationPhase === 'ramp-up' ? '#eab308' : selectedPoint.accumulationPhase === 'washout' ? '#3b82f6' : '#6b7280',
            }}>
              {selectedPoint.accumulationPhase === 'steady' ? '🔄 Стационар' : selectedPoint.accumulationPhase === 'ramp-up' ? '📈 Накопление' : selectedPoint.accumulationPhase === 'washout' ? '📉 Выведение' : '—'}
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
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Конц.</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8, fontSize: 10 }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)' }}>Пик риска</div>
          <div style={{ fontWeight: 600 }}>{Math.round(dynamics.peakRiskValue)}% (нед. {dynamics.peakRiskWeek})</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)' }}>Минимум</div>
          <div style={{ fontWeight: 600 }}>{Math.round(dynamics.minRiskValue)}% (нед. {dynamics.minRiskWeek})</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)' }}>Среднее</div>
          <div style={{ fontWeight: 600 }}>{Math.round(dynamics.averageRisk.overallNet)}%</div>
        </div>
      </div>
    </div>
  );
};

import { PHARMA_DB } from '../../../core/pharma-database';

// Drug name lookup helper
function getDrugName(id: string): string {
  const sub = (PHARMA_DB as any)[id] || (PHARMA_DB as any)[id.replace(/_/g, '_')] || (PHARMA_DB as any)[id.toLowerCase()];
  return sub?.name || id;
}
