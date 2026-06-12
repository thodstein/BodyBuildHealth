import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { RISK_SYSTEMS, SUBSYSTEM_MAP, SUBSYSTEM_PARENT } from '../../../core/constants';
import { SYSTEM_INFO, SYSTEM_INFO_ALL, SYSTEM_ORGANS } from '../../../core/risk-info';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface LabRiskContribution {
  systemContributions: Record<string, number>;
  totalRisk: number;
}

function getSystemIcon(sys: string): string { return SYSTEM_INFO_ALL[sys]?.icon || SYSTEM_INFO[sys]?.icon || 'вљ пёЏ'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO_ALL[sys]?.label || SYSTEM_INFO[sys]?.label || sys; }

// Core systems for display - subsystems shown nested under parents
const CORE_DISPLAY_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'];

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
  labRiskContributions: LabRiskContribution | null;
  isSyntheticLab?: boolean;
}> = ({ riskResult, labRiskContributions, isSyntheticLab }) => {
  const [expandedSys, setExpandedSys] = React.useState<string | null>(null);
  const [showAllRecs, setShowAllRecs] = React.useState(false);

  const recommendations: { text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (riskResult.overallNet > 60) recommendations.push({ text: '', priority: 'high' });
  if (riskResult.overallNet > 40) recommendations.push({ text: '', priority: 'medium' });
  for (const sys of RISK_SYSTEMS) {
    const bd = riskResult.systemBreakdown[sys];
    if (bd && bd.net > 70) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': СЂРёСЃРє ' + Math.round(bd.net) + '% вЂ” РЅРµРѕР±С…РѕРґРёРј РјРѕРЅРёС‚РѕСЂРёРЅРі', priority: 'high' });
    else if (bd && bd.net > 50) recommendations.push({ text: getSystemIcon(sys) + ' ' + getSystemLabel(sys) + ': СЂРёСЃРє ' + Math.round(bd.net) + '% вЂ” СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ РєРѕРЅС‚СЂРѕР»СЊ', priority: 'medium' });
  }
  if (riskResult.overallNet < 30) recommendations.push({ text: 'вњ… РћР±С‰РёР№ СЂРёСЃРє РЅРёР·РєРёР№ вЂ” РїСЂРѕРґРѕР»Р¶Р°Р№С‚Рµ С‚РµРєСѓС‰СѓСЋ СЃС‚СЂР°С‚РµРіРёСЋ', priority: 'low' });

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

  // Get all systems to display for a core system (including its subsystems)
  const getSystemGroup = (coreSys: string): string[] => {
    const subs = SUBSYSTEM_MAP[coreSys] || [];
    return [coreSys, ...subs];
  };

  // Get the maximum risk for a system group
  const getGroupRisk = (systems: string[]): { raw: number; net: number } => {
    let maxRaw = 0, maxNet = 0;
    for (const s of systems) {
      const bd = riskResult.systemBreakdown[s];
      if (bd) {
        maxRaw = Math.max(maxRaw, bd.raw);
        maxNet = Math.max(maxNet, bd.net);
      }
    }
    return { raw: maxRaw, net: maxNet };
  };

  return (
    <div className="risk-details">
      {CORE_DISPLAY_SYSTEMS.map((coreSys) => {
        const group = getSystemGroup(coreSys);
        const groupRisk = getGroupRisk(group);
        const icon = getSystemIcon(coreSys);
        const label = getSystemLabel(coreSys);
        const info = SYSTEM_INFO[coreSys] || SYSTEM_INFO_ALL[coreSys];
        const isExpanded = expandedSys === coreSys;

        return (
          <div key={coreSys} className="card" style={{ marginBottom: 6, padding: 0, overflow: 'hidden' }}>
            <div
              style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? 'rgba(0,230,138,0.08)' : 'transparent', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}
              onClick={() => setExpandedSys(isExpanded ? null : coreSys)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                  {group.length > 1 && <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>+{group.length - 1} РїРѕРґСЃРёСЃС‚РµРј</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 50, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, groupRisk.net)}%`, height: '100%', background: getRiskColor(groupRisk.net), borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, color: getRiskColor(groupRisk.net), minWidth: 40 }}>{Math.round(groupRisk.net)}%</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>в–ѕ</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '8px 12px 12px' }}>
                {info?.description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>{info.description}</div>}

                {group.map(sys => {
                  const bd = riskResult.systemBreakdown[sys];
                  const isSub = sys !== coreSys && SUBSYSTEM_PARENT[sys] === coreSys;
                  const sysIcon = getSystemIcon(sys);
                  const sysLabel = getSystemLabel(sys);
                  const mechanisms = SYSTEM_MECHANISMS[sys] || [];
                  const labContrib = labRiskContributions?.systemContributions?.[sys] || 0;

                  return (
                    <div key={sys} style={{ marginBottom: 8, background: isSub ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px', borderLeft: isSub ? '2px solid var(--accent)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12 }}>{sysIcon}</span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{sysLabel}</span>
                          {isSub && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>(РїРѕРґСЃРёСЃС‚РµРјР°)</span>}
                          {bd && <span style={{ fontSize: 11, fontWeight: 700, color: getRiskColor(bd.net), marginLeft: 6 }}>{Math.round(bd.net)}%</span>}
                        </div>
                      </div>

                      {mechanisms.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>РЎРїРµС†РёС„РёС‡РЅС‹Рµ РјРµС…Р°РЅРёР·РјС‹ ({mechanisms.length}):</div>
                          {mechanisms.map(m => {
                            const mechKey = `${sys}_${m.num}`;
                            const mechDetail = riskResult.mechanismDetail?.[mechKey];
                            const mechNet = mechDetail?.net ?? 0;
                            return (
                              <div key={m.id} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 500, color: mechNet > 30 ? getRiskColor(mechNet) : 'var(--text)' }}>{m.num}. {m.label}</span>
                                  {mechNet > 0 && <span style={{ fontSize: 10, color: getRiskColor(mechNet) }}>{Math.round(mechNet)}%</span>}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>{m.description}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                  {m.drugs.slice(0, 3).map(d => <span key={d} style={{ background: 'rgba(239,68,68,0.1)', padding: '0 4px', borderRadius: 3, fontSize: 9, color: '#f97316' }}>{d}</span>)}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 1 }}>вљ пёЏ {m.mitigation}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {labContrib > 0 && (
                        <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>рџ”¬ Р›Р°Р±. РІРєР»Р°Рґ:</span>
                          <strong style={{ color: getRiskColor(labContrib) }}>{Math.round(labContrib)}%</strong>
                          {isSyntheticLab && (
                            <span style={{ color: '#eab308', fontSize: 9, fontWeight: 600 }}>вљ пёЏ С€С‚СЂР°С„</span>
                          )}
                        </div>
                      )}

                      {contributorMap[sys] && contributorMap[sys].length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {contributorMap[sys].slice(0, 5).map((id: string) => <span key={id} style={{ background: 'rgba(239,68,68,0.1)', padding: '0 5px', borderRadius: 4, fontSize: 9, color: '#f97316' }}>{(PHARMA_DB as any)[id]?.name || id}</span>)}
                        </div>
                      )}

                      {SYSTEM_ORGANS[sys] && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}><strong>РћСЂРіР°РЅС‹:</strong> {SYSTEM_ORGANS[sys].join(', ')}</div>}
                      {info?.keyMarkers && info.keyMarkers.length > 0 && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}><strong>РњР°СЂРєРµСЂС‹:</strong> {info.keyMarkers.slice(0, 5).join(', ')}</div>}
                    </div>
                  );
                })}

                {/* Recommendations for this system */}
                {(() => {
                  const sysRecs = recommendations.filter(r => r.text.includes(getSystemLabel(coreSys)) || group.some(s => r.text.includes(getSystemLabel(s))));
                  return sysRecs.length > 0 ? (
                    <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.08)' }}>
                      {sysRecs.map((r, i) => <div key={i} style={{ fontSize: 11, color: r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#eab308' : '#22c55e' }}>{r.text}</div>)}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* Recommendations */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>вњ… Р РµРєРѕРјРµРЅРґР°С†РёРё</h3>
        {recommendations.length > 0 ? (
          <div style={{ display: 'grid', gap: 4 }}>
            {(showAllRecs ? recommendations : recommendations.slice(0, 5)).map((rec, i) => (
              <div key={i} style={{ padding: 6, borderRadius: 6, background: rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)', fontSize: 11 }}>{rec.text}</div>
            ))}
            {recommendations.length > 5 && <button onClick={() => setShowAllRecs(!showAllRecs)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 4 }}>{showAllRecs ? '' : ''}</button>}
          </div>
        ) : <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 12, fontSize: 12 }}>РќРµС‚ СЃРїРµС†РёС„РёС‡РµСЃРєРёС… СЂРµРєРѕРјРµРЅРґР°С†РёР№</div>}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        Р”Р°РЅРЅС‹Рµ СЂР°СЃС‡С‘С‚С‹ РЅРѕСЃСЏС‚ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Р№ С…Р°СЂР°РєС‚РµСЂ Рё РЅРµ Р·Р°РјРµРЅСЏСЋС‚ РєРѕРЅСЃСѓР»СЊС‚Р°С†РёСЋ РІСЂР°С‡Р°.<br/>
        {RISK_SYSTEMS.length} СЃРёСЃС‚РµРј РѕСЂРіР°РЅРѕРІ Г— 7-9 СЃРїРµС†РёС„РёС‡РЅС‹С… РјРµС…Р°РЅРёР·РјРѕРІ РєР°Р¶РґР°СЏ.
      </div>
    </div>
  );
};