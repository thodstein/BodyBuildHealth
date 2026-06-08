import React from 'react';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { RISK_SYSTEMS } from '../../../core/constants';
import { MECHANISM_INFO, SYSTEM_INFO } from '../../../core/risk-info';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface MatrixRow {
  mechanismKey: string;
  systemKey: string;
  mechanismLabel: string;
  mechanismDescription: string;
  systemLabel: string;
  raw: number;
  net: number;
  coverage: number;
  contributors: string[];
  mitigations: { substance: string; reduction: number }[];
}

const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label])
);

function getCellColor(value: number): string {
  if (value < 20) return 'rgba(34,197,94,0.15)';
  if (value < 40) return 'rgba(132,204,22,0.15)';
  if (value < 60) return 'rgba(234,179,8,0.15)';
  if (value < 80) return 'rgba(249,115,22,0.2)';
  return 'rgba(239,68,68,0.2)';
}

function getTextColor(value: number): string {
  if (value < 20) return '#22c55e';
  if (value < 40) return '#84cc16';
  if (value < 60) return '#eab308';
  if (value < 80) return '#f97316';
  return '#ef4444';
}

export const RiskMatrix: React.FC<{
  riskResult: RiskResult;
}> = ({ riskResult }) => {
  const rows: MatrixRow[] = React.useMemo(() => {
    const result: MatrixRow[] = [];
    const mechDetail = riskResult.mechanismDetail || {};

    for (const [key, cell] of Object.entries(mechDetail)) {
      const parts = key.split('_');
      const sysKey = parts[0];
      const mechNum = parseInt(parts[1], 10);
      const mechInfo = MECHANISM_INFO[mechNum];
      const sysInfo = SYSTEM_INFO[sysKey];

      result.push({
        mechanismKey: key,
        systemKey: sysKey,
        mechanismLabel: mechInfo ? mechInfo.label : `Механизм ${mechNum}`,
        mechanismDescription: mechInfo ? mechInfo.description : '',
        systemLabel: sysInfo ? sysInfo.label : sysKey,
        raw: cell.raw,
        net: cell.net,
        coverage: cell.coverage ?? 0,
        contributors: cell.contributors || [],
        mitigations: cell.mitigations || [],
      });
    }

    // Sort by net risk descending
    return result.sort((a, b) => b.net - a.net);
  }, [riskResult.mechanismDetail]);

  // Group by system for system view
  const systemGroups = React.useMemo(() => {
    const groups: Record<string, MatrixRow[]> = {};
    for (const row of rows) {
      if (!groups[row.systemKey]) groups[row.systemKey] = [];
      groups[row.systemKey].push(row);
    }
    return groups;
  }, [rows]);

  const [view, setView] = React.useState<'matrix' | 'systems'>('matrix');

  return (
    <div className="risk-matrix">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>🔬 Матрица механизмов</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setView('matrix')}
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: view === 'matrix' ? 'var(--accent)' : 'transparent', color: view === 'matrix' ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
            >
              Механизмы
            </button>
            <button
              onClick={() => setView('systems')}
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: view === 'systems' ? 'var(--accent)' : 'transparent', color: view === 'systems' ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
            >
              По системам
            </button>
          </div>
        </div>

        {view === 'matrix' ? (
          <div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>🟢 &lt;20%</span>
              <span>🟡 20-40%</span>
              <span>🟠 40-60%</span>
              <span>🔴 60-80%</span>
              <span>⛔ &gt;80%</span>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.7fr 0.7fr 0.7fr 1fr', gap: 4, marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>
              <div>Механизм</div>
              <div>Система</div>
              <div>Raw</div>
              <div>Net</div>
              <div>Защита</div>
              <div>Статус</div>
            </div>

            {/* Table rows */}
            {rows.map((row) => (
              <div key={row.mechanismKey} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.7fr 0.7fr 0.7fr 1fr', gap: 4, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{row.mechanismLabel}</div>
                  {row.mechanismDescription && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.mechanismDescription.substring(0, 60)}...
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11 }}>{row.systemLabel}</div>
                <div style={{ background: getCellColor(row.raw), borderRadius: 4, padding: '2px 4px', textAlign: 'center', fontWeight: 600 }}>{Math.round(row.raw)}%</div>
                <div style={{ background: getCellColor(row.net), borderRadius: 4, padding: '2px 4px', textAlign: 'center', fontWeight: 600, color: getTextColor(row.net) }}>{Math.round(row.net)}%</div>
                <div style={{ textAlign: 'center', color: row.coverage > 0.5 ? '#22c55e' : 'var(--text-dim)' }}>
                  {Math.round(row.coverage * 100)}%
                </div>
                <div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    background: row.net > 60 ? 'rgba(239,68,68,0.2)' : row.net > 30 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                    color: row.net > 60 ? '#ef4444' : row.net > 30 ? '#eab308' : '#22c55e',
                  }}>
                    {row.net > 60 ? '❗ Высокий' : row.net > 30 ? '⚡ Умеренный' : '✓ Низкий'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Systems view */
          <div>
            {Object.entries(systemGroups).sort(([a], [b]) => a.localeCompare(b)).map(([sysKey, sysRows]) => {
              const sysInfo = SYSTEM_INFO[sysKey];
              const avgNet = sysRows.reduce((s, r) => s + r.net, 0) / sysRows.length;

              return (
                <div key={sysKey} style={{ marginBottom: 12, background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 16 }}>{sysInfo?.icon || '⚠️'}</span>
                      <span style={{ fontWeight: 700, marginLeft: 6 }}>{sysInfo?.label || sysKey}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: getRiskColor(avgNet), fontSize: 16 }}>{Math.round(avgNet)}%</span>
                  </div>

                  {/* Mechanism bars */}
                  {sysRows.map((row) => (
                    <div key={row.mechanismKey} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>{row.mechanismLabel}</span>
                        <span style={{ color: getTextColor(row.net) }}>{Math.round(row.net)}%</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, row.net)}%`, height: '100%', background: getRiskColor(row.net), borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}

                  {/* Key markers */}
                  {sysInfo?.keyMarkers && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {sysInfo.keyMarkers.map((m, i) => (
                        <span key={i} style={{ background: 'rgba(0,230,138,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
