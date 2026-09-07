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
      <div className="card" style={{ padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap:8, marginBottom: 12, flexWrap:'wrap' }}>
          <h3 style={{ margin: 0, fontSize:15, fontWeight:800, color:'#fff' }}>🔬 Матрица механизмов</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setView('matrix')}
              style={{ minHeight:44, padding: '10px 18px', borderRadius: 999, border: view === 'matrix' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)', background: view === 'matrix' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: view === 'matrix' ? '#000' : '#fff', fontSize: 13, fontWeight:800, cursor: 'pointer' }}
            >
              Механизмы
            </button>
            <button
              onClick={() => setView('systems')}
              style={{ minHeight:44, padding: '10px 18px', borderRadius: 999, border: view === 'systems' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)', background: view === 'systems' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: view === 'systems' ? '#000' : '#fff', fontSize: 13, fontWeight:800, cursor: 'pointer' }}
            >
              По системам
            </button>
          </div>
        </div>

        {view === 'matrix' ? (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap:'wrap', marginBottom: 10, fontSize: 12, fontWeight:700, color: '#fff' }}>
              <span>🟢 &lt;20%</span>
              <span>🟡 20-40%</span>
              <span>🟠 40-60%</span>
              <span>🔴 60-80%</span>
              <span>⛔ &gt;80%</span>
            </div>

            {rows.map((row) => (
              <div key={row.mechanismKey} style={{ background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px', marginBottom: 8, borderLeft: `4px solid ${getTextColor(row.net)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', minWidth:0 }}>{row.mechanismLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink:0 }}>
                    <span style={{ fontSize: 11, color: '#fff' }}>{row.systemLabel}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: row.net > 60 ? 'rgba(239,68,68,0.16)' : row.net > 30 ? 'rgba(234,179,8,0.16)' : 'rgba(34,197,94,0.14)', border:`1px solid ${row.net > 60 ? 'rgba(239,68,68,0.30)' : row.net > 30 ? 'rgba(234,179,8,0.30)' : 'rgba(34,197,94,0.26)'}`, color: '#fff' }}>
                      {row.net > 60 ? '❗ Высокий' : row.net > 30 ? '⚡ Умеренный' : '✓ Низкий'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, row.net)}%`, height: '100%', background: getRiskColor(row.net), borderRadius: 999, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: getTextColor(row.net), minWidth: 44, textAlign:'right' }}>{Math.round(row.net)}%</span>
                </div>
                {row.mechanismDescription && row.mechanismDescription.length > 0 && (
                  <div style={{ fontSize: 12, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>{row.mechanismDescription.substring(0, 120)}{row.mechanismDescription.length > 120 ? '...' : ''}</div>
                )}
                {row.coverage > 0 && (
                  <div style={{ fontSize: 12, fontWeight:700, color: '#fff', marginTop: 4 }}>
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
                <div key={sysKey} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ color:'#fff' }}>
                      <span style={{ fontSize: 18 }}>{sysInfo?.icon || '⚠️'}</span>
                      <span style={{ fontWeight: 800, fontSize:14, marginLeft: 8 }}>{sysInfo?.label || sysKey}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: getRiskColor(avgNet), fontSize: 18 }}>{Math.round(avgNet)}%</span>
                  </div>

                  {sysRows.map((row) => {
                    const sysKey = row.systemKey;
                    const mechNum = row.mechanismKey?.includes('_') ? parseInt(row.mechanismKey.split('_')[1], 10) : 0;
                    const specificMechs = SYSTEM_MECHANISMS[sysKey] || [];
                    const specMech = specificMechs.find(m => m.num === mechNum);
                    return (
                      <div key={row.mechanismKey} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center', gap:8, fontSize: 12 }}>
                          <div style={{ color:'#fff' }}>
                            <span style={{ fontWeight: 700 }}>{row.mechanismLabel}</span>
                            {specMech && <div style={{ fontSize: 11, color: '#fff', marginTop: 2 }}>{specMech.description.substring(0, 60)}…</div>}
                          </div>
                          <span style={{ color: getTextColor(row.net), fontWeight: 800, fontSize:13 }}>{Math.round(row.net)}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden', marginTop:4 }}>
                          <div style={{ width: `${Math.min(100, row.net)}%`, height: '100%', background: getRiskColor(row.net), borderRadius: 999 }} />
                        </div>
                      </div>
                    );
                  })}

                  {sysInfo?.keyMarkers && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {sysInfo.keyMarkers.map((m, i) => (
                        <span key={i} style={{ background: 'rgba(0,230,138,0.10)', border:'1px solid rgba(0,230,138,0.20)', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight:700, color:'#fff' }}>{m}</span>
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
