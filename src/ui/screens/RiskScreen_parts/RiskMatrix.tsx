import React from 'react';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { RISK_SYSTEMS } from '../../../core/constants';
import { MECHANISM_INFO, SYSTEM_INFO } from '../../../core/risk-info';
import { getRiskColor } from '../../../core/utils/risk-colors';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';

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

    return result.sort((a, b) => b.net - a.net);
  }, [riskResult.mechanismDetail]);

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
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: view === 'matrix' ? 'var(--accent)' : 'transparent', color: view === 'matrix' ? '#000' : 'var(--text)', fontSize: 10, cursor: 'pointer' }}
            >
              Механизмы
            </button>
            <button
              onClick={() => setView('systems')}
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: view === 'systems' ? 'var(--accent)' : 'transparent', color: view === 'systems' ? '#000' : 'var(--text)', fontSize: 10, cursor: 'pointer' }}
            >
              По системам
            </button>
          </div>
        </div>

        {view === 'matrix' ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>🟢 &lt;20%</span>
              <span>🟡 20-40%</span>
              <span>🟠 40-60%</span>
              <span>🔴 60-80%</span>
              <span>⛔ &gt;80%</span>
            </div>

            {rows.map((row) => (
              <div key={row.mechanismKey} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, borderLeft: `3px solid ${getTextColor(row.net)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: getTextColor(row.net) }}>{row.mechanismLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{row.systemLabel}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: row.net > 60 ? 'rgba(239,68,68,0.2)' : row.net > 30 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)', color: row.net > 60 ? '#ef4444' : row.net > 30 ? '#eab308' : '#22c55e' }}>
                      {row.net > 60 ? '❗ Высокий' : row.net > 30 ? '⚡ Умеренный' : '✓ Низкий'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, row.net)}%`, height: '100%', background: getRiskColor(row.net), borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: getTextColor(row.net), minWidth: 32 }}>{Math.round(row.net)}%</span>
                </div>
                {row.mechanismDescription && row.mechanismDescription.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.3 }}>{row.mechanismDescription.substring(0, 120)}{row.mechanismDescription.length > 120 ? '...' : ''}</div>
                )}
                {row.coverage > 0 && (
                  <div style={{ fontSize: 9, color: row.coverage > 0.5 ? '#22c55e' : 'var(--text-dim)', marginTop: 2 }}>
                    🛡️ Защита: {Math.round(row.coverage * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {Object.entries(systemGroups).sort(([a], [b]) => a.localeCompare(b)).map(([sysKey, sysRows]) => {
              const sysInfo = SYSTEM_INFO[sysKey];
              const avgNet = sysRows.length > 0 ? sysRows.reduce((s, r) => s + r.net, 0) / sysRows.length : 0;

              return (
                <div key={sysKey} style={{ marginBottom: 12, background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 16 }}>{sysInfo?.icon || '⚠️'}</span>
                      <span style={{ fontWeight: 700, marginLeft: 6 }}>{sysInfo?.label || sysKey}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: getRiskColor(avgNet), fontSize: 16 }}>{Math.round(avgNet)}%</span>
                  </div>

                  {sysRows.map((row) => {
                    const sysKey = row.systemKey;
                    const mechNum = row.mechanismKey?.includes('_') ? parseInt(row.mechanismKey.split('_')[1], 10) : 0;
                    const specificMechs = SYSTEM_MECHANISMS[sysKey] || [];
                    const specMech = specificMechs.find(m => m.num === mechNum);
                    return (
                      <div key={row.mechanismKey} style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{row.mechanismLabel}</span>
                            {specMech && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>{specMech.description.substring(0, 60)}…</div>}
                          </div>
                          <span style={{ color: getTextColor(row.net), fontWeight: 700 }}>{Math.round(row.net)}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, row.net)}%`, height: '100%', background: getRiskColor(row.net), borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}

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
