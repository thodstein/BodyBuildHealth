import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { ALL_RISK_SYSTEMS, SUBSYSTEM_PARENT } from '../../../core/constants';
import { SYSTEM_INFO, SYSTEM_INFO_ALL, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface LabRiskContribution {
  systemContributions: Record<string, number>;
  totalRisk: number;
}

function getSystemIcon(sys: string): string { return SYSTEM_INFO_ALL[sys]?.icon || SYSTEM_INFO[sys]?.icon || '??'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO_ALL[sys]?.label || SYSTEM_INFO[sys]?.label || sys; }
function isSubsystem(sys: string): boolean { return sys in SUBSYSTEM_PARENT; }
function getParentSystem(sys: string): string { return SUBSYSTEM_PARENT[sys] || sys; }

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
  labRiskContributions: LabRiskContribution | null;
}> = ({ riskResult, labRiskContributions }) => {
  const [expandedSys, setExpandedSys] = React.useState<string | null>(null);
  const [showAllRecs, setShowAllRecs] = React.useState(false);

  const recommendations: { text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (riskResult.overallNet > 60) recommendations.push({ text: '?? Общий риск ВЫСОКИЙ — обязательная консультация врача', priority: 'high' });
  if (riskResult.overallNet > 40) recommendations.push({ text: 'Рекомендуется расширенный чек-ап анализов', priority: 'medium' });
  for (const sys of ALL_RISK_SYSTEMS) {
    const bd = riskResult.systemBreakdown[sys];
    if (bd && bd.net > 70) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': риск ' + Math.round(bd.net) + '% — необходим мониторинг', priority: 'high' });
    else if (bd && bd.net > 50) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': риск ' + Math.round(bd.net) + '% — рекомендуется контроль', priority: 'medium' });
  }
  if (riskResult.overallNet < 30) recommendations.push({ text: '? Общий риск низкий — продолжайте текущую стратегию', priority: 'low' });

  const contributorMap: Record<string, string[]> = {};
  const mitigationMap: Record<string, { substance: string; reduction: number }[]> = {};
  if (riskResult.mechanismDetail) {
    for (const [key, cell] of Object.entries(riskResult.mechanismDetail)) {
      const sys = key.split('_')[0];
      if (!contributorMap[sys]) contributorMap[sys] = [];
      if (!mitigationMap[sys]) mitigationMap[sys] = [];
      if (cell.contributors) contributorMap[sys].push(...cell.contributors);
      if (cell.mitigations) mitigationMap[sys].push(...cell.mitigations);
    }
  }
  for (const sys of Object.keys(contributorMap)) contributorMap[sys] = [...new Set(contributorMap[sys])];

  return (
    <div className="risk-details">
      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>?? Детали по системам</h3>
        <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          Нажмите на систему, чтобы увидеть механизмы повреждения, маркеры и рекомендации.
          {Object.keys(SUBSYSTEM_PARENT).length > 0 && <span style={{ color: 'var(--accent)' }}> Серым отмечены подсистемы основных органов.</span>}
        </p>

        {ALL_RISK_SYSTEMS.map((sys: string) => {
          const bd = riskResult.systemBreakdown[sys];
          if (!bd) return null;
          const icon = getSystemIcon(sys);
          const label = getSystemLabel(sys);
          const info = SYSTEM_INFO_ALL[sys] || SYSTEM_INFO[sys];
          const mechanisms = SYSTEM_MECHANISMS[sys] || [];
          const labContrib = labRiskContributions?.systemContributions?.[sys] || 0;
          const isSub = isSubsystem(sys);
          const parentLabel = isSub ? getSystemLabel(getParentSystem(sys)) : '';
          const isExpanded = expandedSys === sys;

          return (
            <div key={sys} style={{
              background: isExpanded ? 'rgba(0,230,138,0.05)' : 'var(--bg-secondary)',
              borderRadius: 8, marginBottom: 4, borderLeft: `3px solid ${getRiskColor(bd.net)}`,
              transition: 'all 0.2s'
            }}>
              <div
                style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setExpandedSys(isExpanded ? null : sys)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                    {isSub && <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }}>(? {parentLabel})</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, bd.net)}%`, height: '100%', background: getRiskColor(bd.net), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(bd.net), minWidth: 36 }}>{Math.round(bd.net)}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ў</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border)' }}>
                  {/* System description */}
                  {info?.description && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>{info.description}</div>}

                  {/* Specific mechanisms */}
                  {mechanisms.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>?? Специфичные механизмы ({mechanisms.length})</div>
                      {mechanisms.map(m => {
                        const mechKey = `${sys}_m${m.num}`;
                        const mechDetail = riskResult.mechanismDetail?.[mechKey];
                        const mechNet = mechDetail?.net ?? 0;
                        return (
                          <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 4, marginBottom: 3, borderLeft: `2px solid ${getRiskColor(mechNet)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 500 }}>{m.num}. {m.label}</span>
                              {mechNet > 0 && <span style={{ fontSize: 10, color: getRiskColor(mechNet), fontWeight: 600 }}>{Math.round(mechNet)}%</span>}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>{m.description}</div>
                            <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1 }}>?? {m.drugs.slice(0, 3).join(', ')}{m.drugs.length > 3 ? '...' : ''}</div>
                            <div style={{ fontSize: 9, color: '#eab308', marginTop: 1 }}>??? {m.mitigation}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Lab contribution */}
                  {labContrib > 0 && <div style={{ fontSize: 10, marginBottom: 4, color: 'var(--text-dim)' }}>?? Лаб. вклад: <strong style={{ color: getRiskColor(labContrib) }}>{Math.round(labContrib)}%</strong></div>}

                  {/* Drug contributors */}
                  {contributorMap[sys] && contributorMap[sys].length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>?? Препараты-источники риска:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {contributorMap[sys].map((id: string) => <span key={id} style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 10, color: '#f97316' }}>{(PHARMA_DB as any)[id]?.name || id}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Mitigations */}
                  {mitigationMap[sys] && mitigationMap[sys].length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>??? Защита:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {[...new Map(mitigationMap[sys].map(m => [m.substance, m])).values()].map(m => <span key={m.substance} style={{ background: 'rgba(0,230,138,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 10, color: 'var(--accent)' }}>{m.substance} (?{Math.round(m.reduction * 100)}%)</span>)}
                      </div>
                    </div>
                  )}

                  {/* Organs and markers */}
                  {SYSTEM_ORGANS[sys] && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}><strong>Органы:</strong> {SYSTEM_ORGANS[sys].join(', ')}</div>}
                  {info?.keyMarkers && info.keyMarkers.length > 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}><strong>Маркеры:</strong> {info.keyMarkers.join(', ')}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* General mechanisms */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>?? 7 общих механизмов повреждения</h3>
        <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 6px' }}>Эти 7 механизмов применяются ко всем системам органов и являются универсальными паттернами повреждения.</p>
        <div style={{ display: 'grid', gap: 4 }}>
          {Object.values(MECHANISM_INFO).map(m => (
            <div key={m.id} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{m.id}. {m.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{m.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>?? Рекомендации</h3>
        {recommendations.length > 0 ? (
          <div style={{ display: 'grid', gap: 4 }}>
            {(showAllRecs ? recommendations : recommendations.slice(0, 5)).map((rec, i) => (
              <div key={i} style={{ padding: 6, borderRadius: 6, background: rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)', fontSize: 11 }}>{rec.text}</div>
            ))}
            {recommendations.length > 5 && <button onClick={() => setShowAllRecs(!showAllRecs)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 4 }}>{showAllRecs ? 'Скрыть' : 'Показать ещё'}</button>}
          </div>
        ) : <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 12, fontSize: 12 }}>Нет специфических рекомендаций</div>}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        Данные расчёты носят информационный характер и не заменяют консультацию врача.<br/>
        Модель Health Engine v9 — {ALL_RISK_SYSTEMS.length} систем органов ? 7-9 механизмов каждая.
      </div>
    </div>
  );
};