import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { RISK_SYSTEMS } from '../../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface LabRiskContribution {
  systemContributions: Record<string, number>;
  totalRisk: number;
}

function getSystemIcon(sys: string): string { return SYSTEM_INFO[sys]?.icon || '⚠'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || sys; }

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
  labRiskContributions: LabRiskContribution | null;
}> = ({ riskResult, labRiskContributions }) => {
  const [expandedSys, setExpandedSys] = React.useState<string | null>(null);
  const [showAllRecs, setShowAllRecs] = React.useState(false);
  const [mechView, setMechView] = React.useState<'specific' | 'general'>('specific');

  const recommendations: { text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (riskResult.overallNet > 60) recommendations.push({ text: '⚠ Общий риск ВЫСОКИЙ — обязательная консультация врача', priority: 'high' });
  if (riskResult.overallNet > 40) recommendations.push({ text: 'Рекомендуется расширенный чек-ап анализов', priority: 'medium' });
  for (const sys of RISK_SYSTEMS) {
    const bd = riskResult.systemBreakdown[sys];
    if (bd && bd.net > 70) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': риск ' + Math.round(bd.net) + '% — необходим мониторинг', priority: 'high' });
    else if (bd && bd.net > 50) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': риск ' + Math.round(bd.net) + '% — рекомендуется контроль', priority: 'medium' });
  }
  if (riskResult.overallNet < 30) recommendations.push({ text: '✅ Общий риск низкий — продолжайте текущую стратегию', priority: 'low' });

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>📋 Детали по системам</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setMechView('specific')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: mechView === 'specific' ? 'var(--accent)' : 'var(--bg-secondary)', color: mechView === 'specific' ? '#000' : 'var(--text-dim)', border: '1px solid var(--border)' }}>
              Специфичные
            </button>
            <button onClick={() => setMechView('general')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: mechView === 'general' ? 'var(--accent)' : 'var(--bg-secondary)', color: mechView === 'general' ? '#000' : 'var(--text-dim)', border: '1px solid var(--border)' }}>
              Общие
            </button>
          </div>
        </div>
        {RISK_SYSTEMS.map((sys: string) => {
          const bd = riskResult.systemBreakdown[sys];
          if (!bd) return null;
          const icon = getSystemIcon(sys);
          const label = getSystemLabel(sys);
          const info = SYSTEM_INFO[sys];
          const mechanisms = SYSTEM_MECHANISMS[sys] || [];
          const labContrib = labRiskContributions?.systemContributions?.[sys] || 0;
          const isExpanded = expandedSys === sys;
          const sysMechanisms: { mechNum: number; cell: MechanismCell }[] = [];
          if (riskResult.mechanismDetail) {
            for (const [key, cell] of Object.entries(riskResult.mechanismDetail)) {
              if (key.startsWith(sys + '_')) { const mechNum = parseInt(key.split('_')[1], 10); sysMechanisms.push({ mechNum, cell }); }
            }
          }
          return (
            <div key={sys} className="risk-sys-card" style={{ marginBottom: 6, borderRadius: 6, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }} onClick={() => setExpandedSys(isExpanded ? null : sys)}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(bd.net) }}>{Math.round(bd.net)}%</span>
                      <span style={{ fontSize: 10, color: getRiskColor(bd.raw) }}>raw {Math.round(bd.raw)}%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, bd.net)}%`, background: getRiskColor(bd.net), borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▶'}</span>
              </div>
              {isExpanded && (
                <div style={{ padding: '0 12px 12px', fontSize: 11 }}>
                  {info?.description && <div style={{ marginBottom: 8, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>{info.description}</div>}
                  {mechView === 'specific' && mechanisms.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>🔧 Специфичные механизмы ({mechanisms.length})</div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        {mechanisms.map(mech => {
                          const matchingMech = sysMechanisms.find(sm => sm.mechNum === mech.num);
                          return (
                            <div key={mech.id} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid ' + getRiskColor(matchingMech ? matchingMech.cell.net : 0) }}>
                              <div style={{ fontWeight: 600, fontSize: 10 }}>{mech.num}. {mech.label}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-dim)', margin: '2px 0' }}>{mech.description}</div>
                              {mech.drugs && mech.drugs.length > 0 && <div style={{ fontSize: 9, color: '#f97316' }}>💊 {mech.drugs.join(', ')}</div>}
                              {mech.markers && mech.markers.length > 0 && <div style={{ fontSize: 9, color: '#3b82f6' }}>📊 {mech.markers.join(', ')}</div>}
                              {mech.mitigation && <div style={{ fontSize: 9, color: 'var(--accent)' }}>🛡️ {mech.mitigation}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {mechView === 'general' && Object.keys(MECHANISM_INFO).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--accent)' }}>💠 Общие механизмы</div>
                      <div style={{ display: 'grid', gap: 3 }}>
                        {Object.values(MECHANISM_INFO).map((mech, idx) => {
                          const matchingCell = sysMechanisms.find(sm => sm.mechNum === idx + 1);
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                              <div style={{ width: 50, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, matchingCell ? matchingCell.cell.net : 0)}%`, height: '100%', background: getRiskColor(matchingCell ? matchingCell.cell.net : 0), borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 80 }}>{mech.label || ` Мех. ${idx + 1}`}</span>
                              <span style={{ fontWeight: 700, fontSize: 10, color: getRiskColor(matchingCell ? matchingCell.cell.net : 0), minWidth: 28, textAlign: 'right' }}>{Math.round(matchingCell ? matchingCell.cell.net : 0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {labContrib > 0 && <div style={{ marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}>🧪 Вклад анализов: <strong style={{ color: getRiskColor(labContrib) }}>{Math.round(labContrib)}%</strong></div>}
                  {contributorMap[sys] && contributorMap[sys].length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>💊 Препараты-источники риска:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {contributorMap[sys].map((id: string) => <span key={id} style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 10, color: '#f97316' }}>{(PHARMA_DB as any)[id]?.name || id}</span>)}
                      </div>
                    </div>
                  )}
                  {mitigationMap[sys] && mitigationMap[sys].length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>🛡️ Защита:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {[...new Map(mitigationMap[sys].map(m => [m.substance, m])).values()].map(m => <span key={m.substance} style={{ background: 'rgba(0,230,138,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 10, color: 'var(--accent)' }}>{m.substance} (−{Math.round(m.reduction * 100)}%)</span>)}
                      </div>
                    </div>
                  )}
                  {info?.whatAffects && info.whatAffects.length > 0 && <div style={{ marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}><strong>Влияет на:</strong> {info.whatAffects.join(', ')}</div>}
                  {info?.symptoms && info.symptoms.length > 0 && bd.net > 40 && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}><strong>Симптомы:</strong> {info.symptoms.join(', ')}</div>}
                  {SYSTEM_ORGANS[sys] && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}><strong>Органы:</strong> {SYSTEM_ORGANS[sys].join(', ')}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>💡 Рекомендации</h3>
        {recommendations.length > 0 ? (
          <div style={{ display: 'grid', gap: 4 }}>
            {(showAllRecs ? recommendations : recommendations.slice(0, 5)).map((rec, i) => (
              <div key={i} style={{ padding: 6, borderRadius: 6, background: rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)', fontSize: 11 }}>{rec.text}</div>
            ))}
            {recommendations.length > 5 && <button onClick={() => setShowAllRecs(!showAllRecs)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 4 }}>{showAllRecs ? 'Скрыть' : 'Показать ещё'}</button>}
          </div>
        ) : <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 12, fontSize: 12 }}>Нет специфических рекомендаций</div>}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>ℹ️ Оценка рисков</h3>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 4px' }}><strong>Raw</strong> — риск без учёта поддержки.</p>
          <p style={{ margin: '0 0 4px' }}><strong>Net</strong> — итоговый риск с учётом БАДов и образа жизни.</p>
          <p style={{ margin: '0 0 4px' }}>Риск рассчитывается по <strong>{RISK_SYSTEMS.length} системам</strong> и <strong>7–9 специфичных</strong> механизмов повреждения для каждой.</p>
          <p style={{ margin: '4px 0 0', fontSize: 10, fontStyle: 'italic' }}>Данные носят информационный характер и не заменяют консультацию врача.</p>
        </div>
      </div>
    </div>
  );
};
