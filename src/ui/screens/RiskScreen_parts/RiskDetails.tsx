import React, { useState } from 'react';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import { SYSTEM_INFO, SYSTEM_INFO_ALL, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { PHARMA_DB } from '../../../core/pharma-database';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../../core/constants';
import type { RiskResult } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

function getSystemIcon(sys: string): string { return SYSTEM_INFO[sys]?.icon || '⚠️'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || SYSTEM_INFO_ALL[sys]?.label || sys; }

const SYSTEM_ICONS: Record<string, string> = {
  cardio:'❤️', hepatic:'🫁', renal:'🫘', neuro:'🧠', endocrine:'⚖️', hematologic:'🩸',
  reproductive:'🧬', musculoskeletal:'💪', metabolic:'⚡',
};

const SYSTEM_LABELS_RU: Record<string, string> = {
  cardio:'Сердце', hepatic:'Печень', renal:'Почки', neuro:'Нервная',
  endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репрод.',
  musculoskeletal:'Мышцы', metabolic:'Метаболизм',
};

const CORE_SYSTEMS = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
  labRiskContributions: { systemContributions: Record<string, number>; totalRisk: number } | null;
  isSyntheticLab: boolean;
}> = ({ riskResult, labRiskContributions, isSyntheticLab }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['cardio']));
  const [showAllRecs, setShowAllRecs] = useState(false);
  const toggle = (s: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  // Generate recommendations from risk data
  const recommendations = React.useMemo(() => {
    const recs: { text: string; priority: string }[] = [];
    for (const sys of ALL_RISK_SYSTEMS) {
      const bd = riskResult.systemBreakdown[sys];
      if (!bd || bd.net <= 20) continue;
      const prio = bd.net > 70 ? 'high' : bd.net > 50 ? 'medium' : 'low';
      const label = getSystemLabel(sys);
      recs.push({ text: `${getSystemIcon(sys)} ${label}: риск ${Math.round(bd.net)}% — ${prio === 'high' ? 'необходим мониторинг' : prio === 'medium' ? 'рекомендован контроль' : 'наблюдение'}`, priority: prio });
    }
    return recs.sort((a, b) => (b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1) - (a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1));
  }, [riskResult.systemBreakdown]);

  // Group subsystems per core system
  const sysGroups = React.useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const core = CORE_SYSTEMS.includes(sys) ? sys :
        sys === 'vessels' ? 'cardio' : sys === 'blood' ? 'hematologic' :
        sys === 'ghigf' || sys === 'ins_axis' || sys === 'thyroid' ? 'endocrine' :
        sys === 'neuro_toxicity' ? 'neuro' : sys === 'immunity' ? 'renal' :
        sys === 'prostate' ? 'reproductive' : sys === 'metabolic' ? 'metabolic' :
        sys === 'skin' ? 'hepatic' : '';
      if (core && CORE_SYSTEMS.includes(core)) {
        if (!g[core]) g[core] = [];
        if (sys !== core) g[core].push(sys);
      }
    }
    return g;
  }, []);

  // Map system to contributing drugs
  const contributorMap = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const bd = riskResult.systemBreakdown[sys];
      if (!bd || bd.net <= 5) continue;
      const drugs: string[] = [];
      for (const [id, entry] of Object.entries(PHARMA_DB)) {
        if ((entry as any).systems?.includes?.(sys)) drugs.push(id);
      }
      if (drugs.length > 0) map[sys] = drugs.slice(0, 5);
    }
    return map;
  }, [riskResult.systemBreakdown]);

  return (
    <div>
      {/* Per-system detail cards */}
      {CORE_SYSTEMS.map(coreSys => {
        const info = SYSTEM_INFO[coreSys];
        const icon = SYSTEM_ICONS[coreSys] || getSystemIcon(coreSys);
        const label = SYSTEM_LABELS_RU[coreSys] || getSystemLabel(coreSys);
        const isOpen = expanded.has(coreSys);
        const bd = riskResult.systemBreakdown[coreSys];
        const netPct = bd ? Math.round(bd.net) : 0;
        const subs = sysGroups[coreSys] || [];
        const mechs = SYSTEM_MECHANISMS[coreSys] || [];

        return (
          <div key={coreSys} style={{ marginBottom:8, borderRadius:14, overflow:'hidden', background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
            <button onClick={() => toggle(coreSys)} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', cursor:'pointer', textAlign:'left',
              background: netPct > 40 ? `rgba(${netPct > 70 ? '239,68,68' : '249,115,22'},0.06)` : 'transparent',
              border:'none', color:'var(--text)', fontWeight:700, fontSize:13,
            }}>
              <span style={{ fontSize:12, transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'rotate(0deg)' }}>▶</span>
              <span style={{ fontSize:18 }}>{icon}</span>
              <span style={{ flex:1 }}>{label}</span>
              <span style={{ fontSize:14, fontWeight:800, color:getRiskColor(netPct), background:'var(--bg-secondary)', padding:'2px 10px', borderRadius:6 }}>{netPct}%</span>
            </button>

            {isOpen && (
              <div style={{ padding:'0 14px 14px' }}>
                {/* Description */}
                {info?.description && <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8, lineHeight:1.5 }}>{info.description}</div>}

                {/* Subsystems */}
                {subs.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                    {subs.map(sub => {
                      const sbd = riskResult.systemBreakdown[sub];
                      const sNet = sbd ? Math.round(sbd.net) : 0;
                      const labCont = labRiskContributions?.systemContributions?.[sub] || 0;
                      return (
                        <div key={sub} style={{
                          padding:'4px 10px', borderRadius:8, fontSize:9, fontWeight:600,
                          background: sNet > 30 ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                          border: `1px solid ${sNet > 30 ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                          color: sNet > 30 ? '#ef4444' : 'var(--text-dim)',
                        }}>
                          {getSystemLabel(sub)}: {sNet}%
                          {labCont > 0 && <span style={{ color:'#8b5cf6' }}> (лаб: {Math.round(labCont)}%)</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mechanisms */}
                {mechs.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>⚙️ Механизмы</div>
                    <div style={{ display:'grid', gap:4 }}>
                      {mechs.map((m, i) => {
                        const mechNet = bd ? Math.min(100, Math.max(0, (bd.net * 0.3))) : 0;
                        return (
                          <div key={i} style={{ padding:'6px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                              <span style={{ fontSize:10, fontWeight:600 }}>{i+1}. {m.label}</span>
                              <span style={{ fontSize:10, fontWeight:700, color:getRiskColor(mechNet) }}>{Math.round(mechNet)}%</span>
                            </div>
                            {m.description && <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.4, marginBottom:3 }}>{m.description}</div>}
                            {m.drugs && m.drugs.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                                {m.drugs.slice(0, 4).map((d, j) => (
                                  <span key={j} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{d}</span>
                                ))}
                              </div>
                            )}
                            {m.mitigation && <div style={{ fontSize:8, color:'#22c55e', marginTop:2 }}>🛡️ {m.mitigation}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lab contribution */}
                {labRiskContributions && (
                  <div style={{ fontSize:9, color:isSyntheticLab ? '#f97316' : 'var(--text-dim)', marginBottom:6 }}>
                    Лаб. вклад: {Math.round(labRiskContributions.systemContributions?.[coreSys] || 0)}%
                    {isSyntheticLab && <span style={{ marginLeft:4, color:'#ef4444', fontWeight:600 }}>⚠️ штраф</span>}
                  </div>
                )}

                {/* Contributing drugs */}
                {contributorMap[coreSys] && contributorMap[coreSys].length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:6 }}>
                    {(contributorMap[coreSys] || []).map(id => (
                      <span key={id} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(249,115,22,0.1)', color:'#f97316' }}>
                        {(PHARMA_DB as any)[id]?.name || id}
                      </span>
                    ))}
                  </div>
                )}

                {/* Organs */}
                {SYSTEM_ORGANS[coreSys] && (
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>
                    <strong>Органы:</strong> {SYSTEM_ORGANS[coreSys].join(', ')}
                  </div>
                )}

                {/* Key markers */}
                {info?.keyMarkers && info.keyMarkers.length > 0 && (
                  <div style={{ fontSize:9, color:'var(--text-dim)' }}>
                    <strong>Маркеры:</strong> {info.keyMarkers.slice(0, 5).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Recommendations */}
      <div style={{ marginTop:8, borderRadius:14, overflow:'hidden', background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
        <div style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:700 }}>✅ Рекомендации</span>
          {recommendations.length > 5 && (
            <button onClick={() => setShowAllRecs(!showAllRecs)} style={{ fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer' }}>
              {showAllRecs ? '▲ Скрыть' : `▼ Все (${recommendations.length})`}
            </button>
          )}
        </div>
        <div style={{ padding:'0 14px 14px' }}>
          {recommendations.length > 0 ? (
            <div style={{ display:'grid', gap:5 }}>
              {(showAllRecs ? recommendations : recommendations.slice(0, 5)).map((rec, i) => (
                <div key={i} style={{
                  padding:'8px 10px', borderRadius:8, fontSize:11,
                  background: rec.priority === 'high' ? 'rgba(239,68,68,0.1)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                  borderLeft: `3px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#eab308' : '#22c55e'}`,
                  color: rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#eab308' : '#22c55e',
                }}>
                  {rec.text}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:'var(--text-dim)', textAlign:'center', padding:12, fontSize:11 }}>Нет специфических рекомендаций</div>
          )}
        </div>
      </div>

      <div style={{ fontSize:9, color:'var(--text-dim)', textAlign:'center', marginTop:8, fontStyle:'italic' }}>
        Расчёты носят информационный характер и не заменяют консультацию врача. {CORE_SYSTEMS.length} систем × механика каждого.
      </div>
    </div>
  );
};
