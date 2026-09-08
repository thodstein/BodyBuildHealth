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

  const allOpen = CORE_SYSTEMS.every(s => expanded.has(s));
  return (
    <div className="risk-details">
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <button onClick={() => setExpanded(new Set(CORE_SYSTEMS))} style={{ flex:1, minHeight:44, borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', background: allOpen ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.06)', border: allOpen ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.10)', color:'#fff' }}>▼ Развернуть все</button>
        <button onClick={() => setExpanded(new Set())} style={{ flex:1, minHeight:44, borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>▲ Свернуть{allOpen || expanded.size > 0 ? ` (${expanded.size})` : ''}</button>
      </div>
      <div className="risk-systems-nav" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 10px', marginBottom:10, scrollbarWidth:'none' }}>
        {CORE_SYSTEMS.map(s => (
          <button key={s} onClick={() => { setExpanded(prev => new Set(prev).add(s)); try { setTimeout(() => document.getElementById(`risk-detail-${s}`)?.scrollIntoView({ behavior:'smooth', block:'start' }), 50); } catch {} }} aria-label={SYSTEM_LABELS_RU[s] || s} style={{ flexShrink:0, minHeight:44, padding:'8px 14px', borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', background: expanded.has(s) ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.06)', border: expanded.has(s) ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.10)', color:'#fff' }}>{SYSTEM_ICONS[s] || ''} {(SYSTEM_LABELS_RU[s] || s).split(' ')[0]}</button>
        ))}
      </div>
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
          <div key={coreSys} id={`risk-detail-${coreSys}`} className="risk-system-card" style={{ marginBottom:10, borderRadius:18, overflow:'hidden', background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 10px 26px rgba(0,0,0,0.18)', scrollMarginTop:170 }}>
            <button onClick={() => toggle(coreSys)} aria-expanded={isOpen} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%', minHeight:60, padding:'13px 14px', cursor:'pointer', textAlign:'left',
              background: netPct > 40 ? `rgba(${netPct > 70 ? '239,68,68' : '249,115,22'},0.08)` : 'transparent',
              border:'none', borderBottom: isOpen ? '1px solid rgba(255,255,255,0.07)' : 'none', color:'#fff', fontWeight:800, fontSize:14,
            }}>
              <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'rotate(0deg)', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', flexShrink:0 }}>▶</span>
              <span style={{ fontSize:22 }}>{icon}</span>
              <span style={{ flex:1, color:'#fff' }}>{label}</span>
              <span style={{ fontSize:15, fontWeight:800, color:getRiskColor(netPct), background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', padding:'5px 12px', borderRadius:999 }}>{netPct}%</span>
            </button>

            {isOpen && (
              <div style={{ padding:'12px 14px 16px' }}>
                {/* Description */}
                {info?.description && <div style={{ fontSize:12, color:'#fff', marginBottom:10, lineHeight:1.55 }}>{info.description}</div>}

                {/* Subsystems */}
                {subs.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                    {subs.map(sub => {
                      const sbd = riskResult.systemBreakdown[sub];
                      const sNet = sbd ? Math.round(sbd.net) : 0;
                      const labCont = labRiskContributions?.systemContributions?.[sub] || 0;
                      return (
                        <div key={sub} style={{
                          padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:700,
                          background: sNet > 30 ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${sNet > 30 ? 'rgba(239,68,68,0.26)' : 'rgba(255,255,255,0.09)'}`,
                          color: '#fff',
                        }}>
                          {getSystemLabel(sub)}: {sNet}%
                          {labCont > 0 && <span style={{ color:'#fff' }}> (лаб: {Math.round(labCont)}%)</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mechanisms */}
                {mechs.length > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:8 }}>⚙️ Механизмы</div>
                    <div style={{ display:'grid', gap:8 }}>
                      {mechs.map((m, i) => {
                        const mechNet = bd ? Math.min(100, Math.max(0, (bd.net * 0.3))) : 0;
                        return (
                          <div key={i} style={{ padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:4 }}>
                              <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{i+1}. {m.label}</span>
                              <span style={{ fontSize:13, fontWeight:800, color:getRiskColor(mechNet) }}>{Math.round(mechNet)}%</span>
                            </div>
                            {m.description && <div style={{ fontSize:12, color:'#fff', lineHeight:1.5, marginBottom:5 }}>{m.description}</div>}
                            {m.drugs && m.drugs.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                {m.drugs.slice(0, 4).map((d, j) => (
                                  <span key={j} style={{ fontSize:11, fontWeight:700, padding:'4px 9px', borderRadius:999, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.20)', color:'#fff' }}>{d}</span>
                                ))}
                              </div>
                            )}
                            {m.mitigation && <div style={{ fontSize:12, color:'#fff', marginTop:5, fontWeight:600 }}>🛡️ {m.mitigation}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lab contribution */}
                {labRiskContributions && (
                  <div style={{ fontSize:12, color:'#fff', fontWeight:600, marginBottom:8 }}>
                    Лаб. вклад: {Math.round(labRiskContributions.systemContributions?.[coreSys] || 0)}%
                    {isSyntheticLab && <span style={{ marginLeft:6, color:'#fff', fontWeight:800 }}>⚠️ штраф</span>}
                  </div>
                )}

                {/* Contributing drugs */}
                {contributorMap[coreSys] && contributorMap[coreSys].length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {(contributorMap[coreSys] || []).map(id => (
                      <span key={id} style={{ fontSize:11, fontWeight:700, padding:'5px 10px', borderRadius:999, background:'rgba(249,115,22,0.10)', border:'1px solid rgba(249,115,22,0.22)', color:'#fff' }}>
                        {(PHARMA_DB as any)[id]?.name || id}
                      </span>
                    ))}
                  </div>
                )}

                {/* Organs */}
                {SYSTEM_ORGANS[coreSys] && (
                  <div style={{ fontSize:12, color:'#fff', marginBottom:6, lineHeight:1.5 }}>
                    <strong>Органы:</strong> {SYSTEM_ORGANS[coreSys].join(', ')}
                  </div>
                )}

                {/* Key markers */}
                {info?.keyMarkers && info.keyMarkers.length > 0 && (
                  <div style={{ fontSize:12, color:'#fff', lineHeight:1.5 }}>
                    <strong>Маркеры:</strong> {info.keyMarkers.slice(0, 5).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Recommendations — APK PRO */}
      <div style={{ marginTop:10, borderRadius:18, overflow:'hidden', background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 10px 26px rgba(0,0,0,0.18)' }}>
        <div style={{ padding:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>✅ Рекомендации</span>
          {recommendations.length > 5 && (
            <button onClick={() => setShowAllRecs(!showAllRecs)} style={{ minHeight:44, fontSize:13, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:999, padding:'8px 16px', cursor:'pointer' }}>
              {showAllRecs ? '▲ Скрыть' : `▼ Все (${recommendations.length})`}
            </button>
          )}
        </div>
        <div style={{ padding:'0 14px 16px' }}>
          {recommendations.length > 0 ? (
            <div style={{ display:'grid', gap:8 }}>
              {(showAllRecs ? recommendations : recommendations.slice(0, 5)).map((rec, i) => (
                <div key={i} style={{
                  padding:'12px', borderRadius:12, fontSize:12, fontWeight:600, lineHeight:1.5,
                  background: rec.priority === 'high' ? 'rgba(239,68,68,0.10)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.10)' : 'rgba(34,197,94,0.10)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `4px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#eab308' : '#22c55e'}`,
                  color: '#fff',
                }}>
                  {rec.text}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:'#fff', textAlign:'center', padding:14, fontSize:13 }}>Нет специфических рекомендаций</div>
          )}
        </div>
      </div>

      <div style={{ fontSize:12, color:'#fff', textAlign:'center', marginTop:10, fontStyle:'italic', lineHeight:1.5 }}>
        Расчёты носят информационный характер и не заменяют консультацию врача. {CORE_SYSTEMS.length} систем × механика каждого.
      </div>
    </div>
  );
};
