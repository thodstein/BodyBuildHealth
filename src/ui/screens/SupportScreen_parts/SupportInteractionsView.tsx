// @ts-nocheck
import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { INTERACTION_ENRICHMENT } from '../../../data/support-interaction-enrichment';
import { checkDrugInteractions, getClassInstructions, getCourseRecommendations } from '../../../engines/pharma-interactions.engine';
import type { CourseEntry } from '../../../core/types';
import { PopupSelect } from '../../components/PopupXxx';
import { MECH_TRANSLATIONS_RU, MECH_LABELS, EFFECT_LABELS } from './SupportScreenData';
import { calcStackSynergyScore, suggestSynergyAdditions } from '../../../engines/support-plan/display';

/* ─── Профессиональные хелперы ─── */
const ORGANS_H = { hepatic: { label: '🫁 Печень', kw: ['hepatotox','liver','печень','ALT','AST','ГГТ'] }, renal: { label: '🫘 Почки', kw: ['nephrotox','kidney','почк','creatinine','креатинин'] }, cardio: { label: '❤️ ССС', kw: ['cardiotox','blood pressure','heart','pressure','давление','ЧСС','тромб'] } };

function calcOrganLoad(ids: string[]) {
  const r: Record<string,{score:number;items:string[]}> = {};
  Object.entries(ORGANS_H).forEach(([k,o]) => {
    const items: string[] = [];
    ids.forEach(id => {
      const e = SUPPORT_CATALOG_DATA[id]; if (!e) return;
      const txt = [e.description||'', ...(e.specialInstructions||[]), ...(e.contraindications||[]), ...(e.sideEffects||[])].join(' ').toLowerCase();
      if (o.kw.some(w => txt.includes(w))) items.push(e.nameRu || e.name || id);
    });
    r[k] = { score: Math.min(items.length, 5), items };
  });
  return r;
}

function buildTimingTips(ids: string[]): string[] {
  const tips: string[] = []; const seen = new Set<string>();
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id]; if (!e?.specialInstructions?.length) return;
    const n = e.nameRu || e.name || id;
    e.specialInstructions.forEach((si: string) => {
      const lsi = si.toLowerCase();
      if ((lsi.includes('жир')||lsi.includes('с едой')) && !seen.has(n+'_fat')) { seen.add(n+'_fat'); tips.push(`${n} — принимать с жирной пищей`); }
      if ((lsi.includes('натощак')||lsi.includes('до еды')) && !seen.has(n+'_fast')) { seen.add(n+'_fast'); tips.push(`${n} — натощак за 30 мин до еды`); }
      if ((lsi.includes('вечер')||lsi.includes('перед сном')) && !seen.has(n+'_eve')) { seen.add(n+'_eve'); tips.push(`${n} — вечером/перед сном`); }
      if (lsi.includes('утром') && !seen.has(n+'_morn')) { seen.add(n+'_morn'); tips.push(`${n} — утром после завтрака`); }
    });
  });
  return [...new Set(tips)].slice(0, 5);
}

function buildConclusion(ids: string[], score: number, organLoad: Record<string,{score:number;items:string[]}>, criticalCount: number): string[] {
  const lines: string[] = [`Комбинация: ${ids.length} препаратов`];
  lines.push(score >= 80 ? '✅ Совместимость высокая' : score >= 60 ? '🟡 Совместимость умеренная — контроль' : '🔴 Совместимость низкая — пересмотр');
  if (criticalCount > 0) lines.push(`🔴 ${criticalCount} критических пар — разделить приём ≥4 ч или заменить`);
  if (organLoad.hepatic?.score >= 3) lines.push('🫁 Нагрузка на печень — добавьте гепатопротектор (NAC/TUDCA)');
  if (organLoad.renal?.score >= 3) lines.push('🫘 Нагрузка на почки — контроль креатинина каждые 4 нед');
  if (organLoad.cardio?.score >= 3) lines.push('❤️ Нагрузка на ССС — контроль давления и ЧСС');
  if (lines.length === 2) lines.push('📋 Дополнительных мер не требуется');
  return lines;
}
/* ─── Конец хелперов ─── */

export const SupportInteractionsView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    mergedInteractions,
    infoSynergySeverity, setInfoSynergySeverity,
    synergyCountFilter, setSynergyCountFilter,
    synergyOrganFilter, setSynergyOrganFilter,
    ORGAN_CATEGORY_MAP,
    synergySubTab,
    synergySearch, setSynergySearch,
    synergiesContent,
    expandedCategories,
    interactTab, setInteractTab,
    interactionIds, setInteractionIds,
    updateInteraction,
    interactionSearch, setInteractionSearch,
    interactionSearchIdx, setInteractionSearchIdx,
    addInteraction,
    maxInteractionsReached,
    allSupport,
    catalogSubstances,
    validInteractionIds,
    hasSupportInteractions,
    supportSynergiesList,
    supportConflicts,
    supportCautions,
    resolveSubName,
    showEffect,
    pharmaInteractIds, setPharmaInteractIds,
    pharmaInteractSearch, setPharmaInteractSearch,
  } = s;

  const allItems = mergedInteractions || [];
  const stats = [
    { label: '🤝 Синергии', count: allItems.filter((i:any) => i?.type === 'synergy').length, color: '#22c55e' },
    { label: '🔴 Конфликты', count: allItems.filter((i:any) => i?.type === 'conflict').length, color: '#ef4444' },
    { label: '🟡 Осторожности', count: allItems.filter((i:any) => i?.type === 'caution').length, color: '#f59e0b' },
  ];

  return (
    <div>
      {/* Stats cards */}
      <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
        {stats.map((st: any) => (
          <div key={st.label} style={{ flex:1, minWidth:80, padding:'8px 6px', borderRadius:10, textAlign:'center', background:st.color+'12', border:`1px solid ${st.color}22` }}>
            <div style={{ fontSize:18, fontWeight:800, color:st.color }}>{st.count}</div>
            <div style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* Interactions: все 3 типа с закрытыми секциями */}
      {/* Sub-tab bar removed — show all types at once */}

      {/* Severity / Count / Organ filters — кнопки-карточки с попапом */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
        <PopupSelect label="⚡ Эффективность" value={infoSynergySeverity} options={[['all','Все'],['LOW','Низкая'],['MEDIUM','Средняя'],['HIGH','Высокая']].map(([v, l]: [any, any]) =>({id:v as string,label:l as string}))} onChange={setInfoSynergySeverity} />
        <PopupSelect label="🧪 Веществ" value={String(synergyCountFilter)} options={[[0,'Любое'],[2,'2'],[3,'3'],[5,'5'],[10,'10+']].map(([v, l]: [any, any]) =>({id:String(v),label:l as string}))} onChange={(v:string)=>setSynergyCountFilter(Number(v))} />
        <PopupSelect label="🫀 Орган" value={synergyOrganFilter} options={[['','Все'], ...Object.entries(ORGAN_CATEGORY_MAP).filter(([k,v]:any,i:number,a:any[])=>a.findIndex((x:any)=>x[1].key===v.key)===i).map(([k,v]:any)=>[v.key,v.emoji+v.label])].map(([v, l]: [any, any]) =>({id:v as string,label:l as string}))} onChange={setSynergyOrganFilter} />
      </div>

      {synergySubTab === 'calculator' ? (
        /* ─── КАЛЬКУЛЯТОР ВЗАИМОДЕЙСТВИЙ ─── */
        <div>
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            {(['support','pharma'] as const).map((t: 'support'|'pharma') => (
              <button key={t} onClick={() => setInteractTab(t)} style={{
                flex:1, padding:'7px 0', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                background: interactTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: interactTab === t ? '#000' : 'var(--text-dim)', border: 'none',
              }}>{t === 'support' ? '💊 Поддержка' : '💉 Фарма'}</button>
            ))}
          </div>
          {interactTab === 'support' ? (
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                {interactionIds.map((id: string, idx: number) => {
                  const selectedName = id ? (allSupport.find((s:any) => s.id === id)?.name || id) : '';
                  return (
                    <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                        <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                        <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                        {id && <button onClick={() => { updateInteraction(idx, ''); setInteractionSearch(''); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                      </div>
                      <div style={{ position:'relative' }}>
                        {id ? (
                          <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontSize:10, fontWeight:600 }}>{selectedName}</div>
                        ) : (
                          <>
                            <input value={interactionSearchIdx===idx ? interactionSearch : ''} placeholder="🔍 Введите название..." onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }} onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); }} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                            {interactionSearch && interactionSearchIdx===idx && (
                              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                {[...allSupport, ...catalogSubstances.filter((x:any) => !allSupport.find((s:any) => s.id === x.id))].filter((s:any) => (s.name||s.id||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,10).map((s:any) => (
                                  <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); setInteractionSearchIdx(-1); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                    <span style={{ fontWeight:600, color:'var(--text)' }}>{s.name}</span>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{s.id}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <button onClick={addInteraction} disabled={maxInteractionsReached} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: maxInteractionsReached ? 'not-allowed' : 'pointer', background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color: maxInteractionsReached ? '#666' : '#00e68a', opacity: maxInteractionsReached ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>{interactionIds.length}/10</span>
                </div>
              </div>
              {validInteractionIds.length<2 && <div style={{ textAlign:'center', padding:'20px 12px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div><div style={{ fontSize:10, color:'var(--text-dim)' }}>Выберите минимум 2 препарата</div></div>}
              {validInteractionIds.length>=2 && (() => {
                const stackScore = calcStackSynergyScore(validInteractionIds);
                const suggestions = suggestSynergyAdditions(validInteractionIds, 5);
                const levelColors: Record<string, string> = { excellent:'#22c55e', good:'#4ade80', moderate:'#f59e0b', poor:'#ef4444', risky:'#dc2626' };
                const levelLabels: Record<string, string> = { excellent:'Отлично', good:'Хорошо', moderate:'Умеренно', poor:'Плохо', risky:'Рискованно' };
                const cellColor = (type: string) => type === 'synergy' ? '#22c55e' : type === 'conflict' ? '#ef4444' : type === 'caution' ? '#f59e0b' : 'rgba(255,255,255,0.15)';
                const cellEmoji = (type: string) => type === 'synergy' ? '⊕' : type === 'conflict' ? '⊖' : type === 'caution' ? '⚠' : '—';
                const ids = validInteractionIds;
                const pairCell = (a: string, b: string) => {
                  if (a === b) return null;
                  const pair = stackScore.matrix.find(m =>
                    (m.a === a && m.b === b) || (m.a === b && m.b === a) ||
                    (m.a.toLowerCase() === a.toLowerCase() && m.b.toLowerCase() === b.toLowerCase()) ||
                    (m.a.toLowerCase() === b.toLowerCase() && m.b.toLowerCase() === a.toLowerCase())
                  );
                  return pair || null;
                };
                return (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, border:`2px solid ${levelColors[stackScore.level]}44`, marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:levelColors[stackScore.level] }}>📊 Совместимость стека</div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:20, fontWeight:800, color:levelColors[stackScore.level] }}>{stackScore.score}</span>
                          <span style={{ fontSize:8, color:'var(--text-dim)' }}>/ 100</span>
                          <span style={{ fontSize:8, padding:'2px 8px', borderRadius:6, background:levelColors[stackScore.level]+'22', color:levelColors[stackScore.level], fontWeight:700 }}>{levelLabels[stackScore.level]}</span>
                        </div>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
                        <div style={{ width:stackScore.score+'%', height:'100%', background:levelColors[stackScore.level], borderRadius:3, transition:'width 0.3s' }} />
                      </div>
                      <div style={{ display:'flex', gap:8, fontSize:8, color:'var(--text-dim)', flexWrap:'wrap' }}>
                        <span style={{ color:'#22c55e' }}>⊕ {stackScore.synergies} синергий</span>
                        <span style={{ color:'#ef4444' }}>⊖ {stackScore.conflicts} конфликтов</span>
                        <span style={{ color:'#f59e0b' }}>⚠ {stackScore.cautions} осторожностей</span>
                        <span style={{ color:'var(--text-dim)' }}>??? {stackScore.unknownPairs} неизвестно</span>
                      </div>
                    </div>
                    {(() => { const ol = calcOrganLoad(ids); const tt = buildTimingTips(ids); return (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                        {['hepatic','renal','cardio'].map(k => {
                          const o = ol[k]; if (!o) return null;
                          const c = o.score >= 3 ? '#ef4444' : o.score >= 2 ? '#f59e0b' : '#22c55e';
                          return (
                            <div key={k} style={{ padding:'6px 4px', borderRadius:8, background:c+'06', border:`1px solid ${c}15`, textAlign:'center' }}>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginBottom:1 }}>{ORGANS_H[k as keyof typeof ORGANS_H]?.label}</div>
                              <div style={{ fontSize:13, fontWeight:800, color:c }}>{o.score}/5</div>
                              <div style={{ height:2, borderRadius:2, background:'rgba(255,255,255,0.04)', marginTop:3 }}>
                                <div style={{ width:(o.score/5)*100+'%', height:'100%', borderRadius:2, background:c }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ); })()}
                    {(() => { const tt = buildTimingTips(ids); if (!tt.length) return null; return (
                      <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.1)' }}>
                        <div style={{ fontSize:7, fontWeight:700, color:'#60a5fa', marginBottom:2 }}>🕐 Режим приёма</div>
                        {tt.map((t,i) => <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>{t}</div>)}
                      </div>
                    ); })()}
                    {ids.length >= 2 && ids.length <= 8 && (() => {
                      const names = ids.map((id: string) => resolveSubName(id) || id);
                      const shortNames = names.map((n: string) => n.length > 8 ? n.substring(0,7)+'…' : n);
                      const cellSize = Math.max(28, Math.min(48, Math.floor(280 / ids.length)));
                      return (
                        <div style={{ marginBottom:8, overflowX:'auto' }}>
                          <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>🔬 Матрица совместимости {ids.length}×{ids.length}</div>
                          <div style={{ display:'inline-block', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                            <div style={{ display:'grid', gridTemplateColumns:`${cellSize+4}px repeat(${ids.length}, ${cellSize}px)`, gap:0 }}>
                              <div style={{ padding:'2px', background:'rgba(0,0,0,0.2)' }} />
                              {shortNames.map((n: string, ci: number) => (
                                <div key={ci} style={{ padding:'2px', background:'rgba(0,0,0,0.2)', fontSize:5, color:'var(--text-dim)', textAlign:'center', writingMode:ids.length > 5 ? 'vertical-rl' : 'horizontal-tb', transform: ids.length > 5 ? 'rotate(180deg)' : 'none', lineHeight:1.1 }}>{n}</div>
                              ))}
                              {ids.map((rowId: string, ri: number) => (
                                <React.Fragment key={ri}>
                                  <div style={{ padding:'2px 4px', background:'rgba(0,0,0,0.2)', fontSize:5, color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'flex-end', whiteSpace:'nowrap', overflow:'hidden' }}>{shortNames[ri]}</div>
                                  {ids.map((colId: string, ci: number) => {
                                    const cell = pairCell(rowId, colId);
                                    return (
                                      <div key={ci} style={{ width:cellSize, height:cellSize, display:'flex', alignItems:'center', justifyContent:'center', background:cell ? cellColor(cell.type)+'15' : 'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', fontSize:cellSize > 32 ? 10 : 7, color:cell ? cellColor(cell.type) : 'rgba(255,255,255,0.2)', fontWeight:700, cursor:'default' }} title={cell ? `${cell.aName} + ${cell.bName}: ${cell.effect}` : ''}>
                                        {cell ? cellEmoji(cell.type) : '·'}
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6, marginTop:4, fontSize:6, color:'var(--text-dim)' }}>
                            <span><span style={{ color:'#22c55e', fontWeight:700 }}>⊕</span> синергия</span>
                            <span><span style={{ color:'#ef4444', fontWeight:700 }}>⊖</span> конфликт</span>
                            <span><span style={{ color:'#f59e0b', fontWeight:700 }}>⚠</span> осторожность</span>
                            <span><span style={{ color:'rgba(255,255,255,0.3)' }}>·</span> неизвестно</span>
                          </div>
                        </div>
                      );
                    })()}
                    {suggestions.length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:4 }}>🔮 Рекомендации для усиления синергии</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {suggestions.map((sug, si) => (
                            <div key={si} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 8px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
                              <button onClick={() => { if (!interactionIds.includes(sug.id) && interactionIds.length < 10) { updateInteraction(interactionIds.findIndex(x => !x), sug.id); } }} style={{ padding:'2px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', color:'#a855f7', fontWeight:700 }}>+ Добавить</button>
                              <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)', minWidth:50 }}>{sug.name}</span>
                              <span style={{ fontSize:7, color:'var(--text-dim)', flex:1 }}>⊕{sug.synergiesWith.length} синергий: {sug.synergiesWith.map(x => resolveSubName(x) || x).slice(0,3).join(', ')}</span>
                              <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(168,85,247,0.15)', color:'#a855f7', fontWeight:700 }}>{sug.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* ─── Фармацевтическое заключение ─── */}
              <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.12)', marginBottom:8 }}>
                <div style={{ fontSize:8, fontWeight:700, color:'#22c55e', marginBottom:3 }}>📋 Фармацевтическое заключение</div>
                {(() => {
                  const ol = calcOrganLoad(ids);
                  const lines = buildConclusion(ids, stackScore.score, ol, stackScore.conflicts);
                  return lines.map((l,i) => <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{l}</div>);
                })()}
              </div>

              {/* ─── Data per substance (expandable monographs) ─── */}
              <div style={{ marginBottom:8 }}>
                <h4 style={{ margin:'0 0 6px 0', fontSize:9, color:'var(--text-dim)' }}>💊 Монографии препаратов</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {ids.map((id:string, idx:number) => {
                    const entry = SUPPORT_CATALOG_DATA[id];
                    if (!entry) return null;
                    const [open, setOpen] = React.useState(false);
                    const name = entry.nameRu || entry.name || id;
                    const tierColor = ({ core:'#00e68a', standard:'#60a5fa', advanced:'#a78bfa', specialty:'#f59e0b' })[entry.tier||''] || 'rgba(255,255,255,0.4)';
                    return (
                      <div key={idx} style={{ borderRadius:8, background:'rgba(255,255,255,0.012)', border:'1px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
                        <div onClick={() => setOpen(!open)} style={{ padding:'6px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{name}</span>
                          {entry.tier && <span style={{ fontSize:6, padding:'1px 5px', borderRadius:3, background:tierColor+'22', color:tierColor, fontWeight:600 }}>{entry.tier}</span>}
                          <span style={{ marginLeft:'auto', fontSize:7, color:'rgba(255,255,255,0.2)' }}>{open ? '▲' : '▼'}</span>
                        </div>
                        {open && (
                          <div style={{ padding:'0 8px 8px', fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.35 }}>
                            {entry.description && <div style={{ marginBottom:3 }}>{entry.description}</div>}
                            {entry.mechanisms?.length > 0 && <div style={{ marginBottom:2 }}><span style={{ color:'#a78bfa', fontWeight:600 }}>⚙️ </span>{entry.mechanisms.join(', ')}</div>}
                            {entry.contraindications?.length > 0 && <div style={{ marginBottom:2 }}><span style={{ color:'#ef4444', fontWeight:600 }}>🚫 </span>{entry.contraindications.join('; ')}</div>}
                            {entry.sideEffects?.length > 0 && <div style={{ marginBottom:2 }}><span style={{ color:'#f59e0b', fontWeight:600 }}>⚠ </span>{entry.sideEffects.join(', ')}</div>}
                            {entry.specialInstructions?.length > 0 && <div style={{ marginBottom:2 }}><span style={{ color:'#60a5fa', fontWeight:600 }}>📋 </span>{entry.specialInstructions.join(' · ')}</div>}
                            {entry.monitoring?.length > 0 && <div><span style={{ color:'#22c55e', fontWeight:600 }}>🔬 </span>{(entry.monitoring||[]).map((m:any)=>typeof m === 'string' ? m : `${m.what||''} (${m.when||''})`).join('; ')}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasSupportInteractions && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { list: supportSynergiesList, label:'Синергия', color:'#22c55e', emoji:'🤝' },
                    { list: supportConflicts, label:'Конфликт', color:'#ef4444', emoji:'🔴' },
                    { list: supportCautions, label:'Осторожность', color:'#f59e0b', emoji:'🟡' },
                  ].filter((section:any) => section.list.length>0).map((section:any) => (
                    <div key={section.label}>
                      <div style={{ fontSize:10, fontWeight:700, color:section.color, marginBottom:4 }}>
                        {section.emoji} {section.label} <span style={{ fontSize:8, opacity:0.6 }}>({section.list.length})</span>
                      </div>
                      {(section.list || []).map((i:any) => {
                        const sevColor = i.severity === 'HIGH' ? '#ef4444' : i.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                        const sevLabel = i.severity === 'HIGH' ? 'Высокий' : i.severity === 'MEDIUM' ? 'Средний' : 'Низкий';
                        const aName = resolveSubName(i.substanceA) || i.substanceA;
                        const bName = resolveSubName(i.substanceB) || i.substanceB;
                        const effText = showEffect(i);
                        const mechTexts = (i.mechanisms || []).map((m: string) =>
                          MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')
                        );
                        return (
                          <div key={i.interactionId} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px 12px', border:'1px solid '+section.color+'22', marginBottom:4 }}>
                            {/* Header: pair names + severity badge */}
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <span style={{ color:section.color, fontWeight:700, fontSize:10 }}>{aName} + {bName}</span>
                              <div style={{ display:'flex', gap:3 }}>
                                {i.severity && (
                                  <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:sevColor+'22', color:sevColor, fontWeight:600 }}>
                                    {sevLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Severity bar */}
                            <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginBottom:5, overflow:'hidden' }}>
                              <div style={{ width: i.severity === 'HIGH' ? '100%' : i.severity === 'MEDIUM' ? '60%' : '30%', height:'100%', background:sevColor, borderRadius:2 }} />
                            </div>
                            {/* Эффект */}
                            {effText && (
                              <div style={{ fontSize:9, color: section.color, fontWeight:600, lineHeight:1.3, marginBottom:4 }}>
                                🎯 {effText}
                              </div>
                            )}
                            {/* Пояснения (из обогащения) */}
                            {(INTERACTION_ENRICHMENT[i.interactionId]?.mechanismRu?.length > 0 ? INTERACTION_ENRICHMENT[i.interactionId].mechanismRu : mechTexts).length > 0 && (
                              <div style={{ marginBottom:3 }}>
                                <div style={{ fontSize:7, color:'#a78bfa', fontWeight:600, marginBottom:1 }}>⚙️ Почему:</div>
                                <ul style={{ margin:0, paddingLeft:14, fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.3 }}>
                                  {(INTERACTION_ENRICHMENT[i.interactionId]?.mechanismRu?.length > 0 ? INTERACTION_ENRICHMENT[i.interactionId].mechanismRu : mechTexts).map((txt: string, mi: number) => (
                                    <li key={mi}>{txt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Риск (из обогащения) */}
                            {INTERACTION_ENRICHMENT[i.interactionId]?.riskDescription && (
                              <div style={{ background:'rgba(239,68,68,0.06)', borderRadius:6, padding:'5px 8px', marginBottom:3, border:'1px solid rgba(239,68,68,0.15)' }}>
                                <div style={{ fontSize:7, color:'#ef4444', fontWeight:700, marginBottom:1 }}>⚠️ Риск:</div>
                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>{INTERACTION_ENRICHMENT[i.interactionId].riskDescription}</div>
                              </div>
                            )}
                            {/* Параметры (из обогащения) */}
                            {INTERACTION_ENRICHMENT[i.interactionId]?.parameters && (
                              <div style={{ background:'rgba(245,158,11,0.06)', borderRadius:6, padding:'5px 8px', marginBottom:3, border:'1px solid rgba(245,158,11,0.15)' }}>
                                <div style={{ fontSize:7, color:'#f59e0b', fontWeight:700, marginBottom:1 }}>📋 Параметры:</div>
                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>{INTERACTION_ENRICHMENT[i.interactionId].parameters}</div>
                              </div>
                            )}
                            {/* Запасные механизмы (когда enrichment нет) */}
                            {!INTERACTION_ENRICHMENT[i.interactionId] && mechTexts.length > 0 && (
                              <div style={{ marginBottom:3 }}>
                                <div style={{ fontSize:7, color:'#a78bfa', fontWeight:600, marginBottom:1 }}>⚙️ Почему:</div>
                                <ul style={{ margin:0, paddingLeft:14, fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.3 }}>
                                  {mechTexts.map((txt: string, mi: number) => (
                                    <li key={mi}>{txt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Параметры / Рекомендации (запасные) */}
                            {!INTERACTION_ENRICHMENT[i.interactionId] && i.notes && (
                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.3, background:'rgba(245,158,11,0.06)', padding:'4px 6px', borderRadius:4, marginTop:2 }}>
                                <span style={{ color:'#f59e0b', fontWeight:600 }}>💊 </span>
                                {i.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Per-substance data merged into monographs above */}
            </div>
          ) : (
            /* ─── ФАРМА-ВЗАИМОДЕЙСТВИЯ ─── */
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                {pharmaInteractIds.map((id: string, idx: number) => {
                  const pharmaEntry = id ? PHARMA_DB[id] : null;
                  const selectedName = pharmaEntry?.name || '';
                  return (
                    <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                        <span style={{ fontSize:8, color:'var(--text-dim)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                        <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>{id ? selectedName : 'Препарат'}</span>
                        {id && <button onClick={() => { const next = [...pharmaInteractIds]; next[idx] = ''; setPharmaInteractIds(next); }} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                      </div>
                      <div style={{ position:'relative' }}>
                        {id ? (
                          <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>{selectedName} ({id})</div>
                        ) : (
                          <>
                            <input value={pharmaInteractSearch} placeholder="🔍 Введите название препарата..." onChange={e => setPharmaInteractSearch(e.target.value)} style={{ width:'100%', padding:'7px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
                            {pharmaInteractSearch && (
                              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, maxHeight:150, overflowY:'auto', marginTop:1 }}>
                                {Object.entries(PHARMA_DB)
                                  .filter(([key, val]:any) => (val.name||'').toLowerCase().includes(pharmaInteractSearch.toLowerCase()) || key.toLowerCase().includes(pharmaInteractSearch.toLowerCase()))
                                  .slice(0, 10).map(([key, val]:any) => (
                                  <div key={key} onClick={() => { const next = [...pharmaInteractIds]; next[idx] = key; setPharmaInteractIds(next); setPharmaInteractSearch(''); }} style={{ padding:'7px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid var(--border)' }}>
                                    <span style={{ fontWeight:600, color:'var(--text)' }}>{val.name}</span>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>{key}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <button onClick={() => setPharmaInteractIds((prev:any[]) => prev.length < 10 ? [...prev, ''] : prev)} disabled={pharmaInteractIds.length >= 10} style={{ flex:1, padding:'8px', borderRadius:8, fontSize:10, fontWeight:600, cursor: pharmaInteractIds.length >= 10 ? 'not-allowed' : 'pointer', background:'rgba(59,130,246,0.06)', border:'1px dashed rgba(59,130,246,0.3)', color: pharmaInteractIds.length >= 10 ? '#666' : '#60a5fa', opacity: pharmaInteractIds.length >= 10 ? 0.5 : 1 }}>+ ДОБАВИТЬ ПРЕПАРАТ</button>
                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>{pharmaInteractIds.length}/10</span>
                </div>
              </div>
              {(() => {
                try {
                  const course: CourseEntry[] = pharmaInteractIds.filter(Boolean).map((id:string,ix:number) => ({ id: 'interact_'+ix, substanceId: id, doseValue: 100, doseUnit: 'mg', frequency: 7, startWeek: 1, endWeek: 12 }));
                  const alerts = checkDrugInteractions(course);
                  if (alerts.length === 0) return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize:10, color:'#4caf50', fontWeight:600 }}>✓ Конфликтов не обнаружено</span></div>;
                  const color = (t: string) => t === 'critical' ? '#ef4444' : t === 'warning' ? '#f59e0b' : '#60a5fa';
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {alerts.map((alert:any, ai:number) => {
                        const c = color(alert.type);
                        const alertSevLabel = alert.type === 'critical' ? 'Критично' : alert.type === 'warning' ? 'Предупреждение' : 'Инфо';
                        return (
                          <div key={`alert_${ai}`} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'10px 12px', border:'1px solid '+c+'33' }}>
                            {/* Header */}
                            <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                              <span style={{ fontSize:10, fontWeight:700, color:c }}>{alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}</span>
                              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:c+'22', color:c, fontWeight:600 }}>{alertSevLabel}</span>
                              <span style={{ fontSize:8, color:'var(--text-dim)' }}>{(alert.drugs||[]).map((d:string) => resolveSubName(d)).join(', ')}</span>
                            </div>
                            {/* Severity bar */}
                            <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginBottom:5, overflow:'hidden' }}>
                              <div style={{ width: alert.type === 'critical' ? '100%' : alert.type === 'warning' ? '60%' : '30%', height:'100%', background:c, borderRadius:2 }} />
                            </div>
                            {/* Эффект / Почему */}
                            {alert.mechanism && (
                              <div style={{ fontSize:9, color:'rgba(255,255,255,0.9)', lineHeight:1.3, marginBottom:5 }}>
                                <span style={{ color:'#a78bfa', fontWeight:600, fontSize:8 }}>⚙️ Механизм: </span>
                                {alert.mechanism}
                              </div>
                            )}
                            {/* Рекомендация */}
                            {alert.recommendation && (
                              <div style={{ fontSize:8, color:'#f59e0b', lineHeight:1.3, background:'rgba(245,158,11,0.06)', padding:'4px 6px', borderRadius:4 }}>
                                💊 Рекомендация: {alert.recommendation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                } catch (e) {
                  return <div style={{ textAlign:'center', padding:'10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize:9, color:'#ef4444' }}>Ошибка: {String(e)}</span></div>;
                }
              })()}

              {/* ── Фармацевтическое заключение (фарма) ── */}
              {pharmaInteractIds.filter(Boolean).length >= 2 && (() => {
                const ids = pharmaInteractIds.filter(Boolean);
                const ol = calcOrganLoad(ids);
                const tt = buildTimingTips(ids);
                return (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                      {['hepatic','renal','cardio'].map(k => {
                        const o = ol[k]; if (!o) return null;
                        const c = o.score >= 3 ? '#ef4444' : o.score >= 2 ? '#f59e0b' : '#22c55e';
                        return (
                          <div key={k} style={{ padding:'6px 4px', borderRadius:8, background:c+'06', border:`1px solid ${c}15`, textAlign:'center' }}>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginBottom:1 }}>{ORGANS_H[k as keyof typeof ORGANS_H]?.label}</div>
                            <div style={{ fontSize:13, fontWeight:800, color:c }}>{o.score}/5</div>
                            <div style={{ height:2, borderRadius:2, background:'rgba(255,255,255,0.04)', marginTop:3 }}>
                              <div style={{ width:(o.score/5)*100+'%', height:'100%', borderRadius:2, background:c }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {tt.length > 0 && (
                      <div style={{ marginBottom:6, padding:'5px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.1)' }}>
                        <div style={{ fontSize:7, fontWeight:700, color:'#60a5fa', marginBottom:2 }}>🕐 Режим приёма</div>
                        {tt.map((t,i) => <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>{t}</div>)}
                      </div>
                    )}
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.12)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#22c55e', marginBottom:2 }}>📋 Заключение</div>
                      {buildConclusion(ids, 70, ol, 0).map((l,i) => <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{l}</div>)}
                    </div>
                  </div>
                );
              })()}

              {/* ── CLASS INSTRUCTIONS (pharma) ── */}
              {(() => {
                const validPharmaIds = pharmaInteractIds.filter(Boolean);
                if (validPharmaIds.length < 1) return null;
                try {
                  const course: CourseEntry[] = validPharmaIds.map((id:string,ix:number) => ({ id: 'interact_'+ix, substanceId: id, doseValue: 100, doseUnit: 'mg', frequency: 7, startWeek: 1, endWeek: 12 }));
                  const clsInstr = getClassInstructions(course);
                  const courseRecs = getCourseRecommendations(course);
                  if (clsInstr.length === 0 && courseRecs.length === 0) return null;
                  return (
                    <div style={{ marginTop: 10 }}>
                      {/* Course recommendations */}
                      {courseRecs.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: 10, color: '#3b82f6' }}>📋 Рекомендации для курса</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {courseRecs.map((rec, ri) => {
                              const tc = rec.type === 'critical' ? '#ef4444' : rec.type === 'warning' ? '#f59e0b' : '#3b82f6';
                              return (
                                <div key={ri} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'8px 10px', border:'1px solid '+tc+'22' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: tc, marginBottom: 4 }}>{rec.title}</div>
                                  {rec.items.map((item, ij) => (
                                    <div key={ij} style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, padding: '2px 0 2px 10px', position: 'relative' }}>
                                      <span style={{ position: 'absolute', left: 0, color: tc }}>•</span> {item}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Class instructions */}
                      {clsInstr.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: 10, color: '#f59e0b' }}>📋 Особые указания по классам</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {clsInstr.map((cls, ci) => (
                              <div key={ci} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'9px 11px', border:'1px solid rgba(245,158,11,0.15)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>💊 {cls.className}</div>
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>Инструкции</div>
                                  {cls.instructions.map((inst, ii) => (
                                    <div key={ii} style={{ fontSize: 8, color: 'rgba(255,255,255,0.72)', lineHeight: 1.3, padding: '2px 0 2px 10px', position: 'relative' }}>
                                      <span style={{ position: 'absolute', left: 0, color: '#00e68a' }}>•</span> {inst}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 7, fontWeight: 700, color: '#ff9800', marginBottom: 2 }}>🩸 Мониторинг</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                    {cls.monitoring.map((m, mi) => (
                                      <span key={mi} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,152,0,0.1)', color: '#ff9800' }}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 7, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>⚠ Предупреждения</div>
                                  {cls.warnings.map((w, wi) => (
                                    <div key={wi} style={{ fontSize: 8, color: 'rgba(255,255,255,0.72)', lineHeight: 1.3, padding: '2px 0 2px 10px', position: 'relative', borderLeft: '2px solid rgba(239,68,68,0.25)', marginBottom: 2 }}>
                                      {w}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } catch (e) { return null; }
              })()}

              {/* Per-entry data for pharma substances */}
              {pharmaInteractIds.filter(Boolean).length >= 1 && (
                <div style={{ marginTop: 10 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 10, color: 'var(--text-dim)' }}>📋 Данные по препаратам</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {pharmaInteractIds.filter(Boolean).map((id: string, idx: number) => {
                      const sub = PHARMA_DB[id];
                      if (!sub) return null;
                      const classLabel = (sub.class||'').replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());
                      const cvIcons: Record<string,string> = { up:'↑', down:'↓', neutral:'→' };
                      return (
                        <div key={idx} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'9px 11px', border:'1px solid var(--border)' }}>
                          {/* Name + class badge */}
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                            <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa' }}>{sub.name}</span>
                            {classLabel && <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(129,140,248,0.1)', color:'#818cf8', fontWeight:600 }}>{classLabel}</span>}
                          </div>
                          {/* Target systems chips */}
                          {(sub.targetSystems||[]).length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:3 }}>
                              {(sub.targetSystems||[]).slice(0,4).map((sys:string, i:number) => (
                                <span key={i} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>{sys}</span>
                              ))}
                            </div>
                          )}
                          {/* cvProfile summary */}
                          {sub.cvProfile && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:3, fontSize:7, color:'rgba(255,255,255,0.5)' }}>
                              <span style={{ color:'#f59e0b', fontWeight:600 }}>❤️ </span>
                              <span style={{ color: sub.cvProfile.bloodPressure==='up'?'#ef4444':sub.cvProfile.bloodPressure==='down'?'#22c55e':'#888' }}>АД {cvIcons[sub.cvProfile.bloodPressure]||sub.cvProfile.bloodPressure}</span>
                              <span style={{ color: sub.cvProfile.heartRate==='up'?'#ef4444':sub.cvProfile.heartRate==='down'?'#22c55e':'#888' }}>ЧСС {cvIcons[sub.cvProfile.heartRate]||sub.cvProfile.heartRate}</span>
                              <span style={{ color: sub.cvProfile.thrombosisRisk==='high'?'#ef4444':sub.cvProfile.thrombosisRisk==='medium'?'#f59e0b':'#22c55e' }}>Тромбоз: {sub.cvProfile.thrombosisRisk}</span>
                            </div>
                          )}
                          {/* Conflict chips */}
                          {sub.conflicts && sub.conflicts.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                              <span style={{ fontSize:7, color:'#ef4444', fontWeight:600 }}>🔴 Конфликты: </span>
                              {sub.conflicts.map((c:any, i:number) => (
                                <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)', color: c.severity === 'HIGH' ? '#ef4444' : '#eab308' }}>{c.with}: {c.effect}</span>
                              ))}
                            </div>
                          )}
                          {/* Linked substances chips */}
                          {sub.linkedSubstances && sub.linkedSubstances.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginBottom:2 }}>
                              <span style={{ fontSize:7, color:'#22c55e', fontWeight:600 }}>🟢 Связанные: </span>
                              {sub.linkedSubstances.map((ls:any, i:number) => {
                                const linkedName = PHARMA_DB[ls.id]?.name || ls.id;
                                return <span key={i} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background: ls.type === 'synergy' ? 'rgba(34,197,94,0.1)' : 'rgba(255,23,68,0.1)', color: ls.type === 'synergy' ? '#22c55e' : '#ff1744' }}>{linkedName}: {ls.mechanism}</span>;
                              })}
                            </div>
                          )}
                          {/* Special instructions */}
                          {sub.specialInstructions && sub.specialInstructions.length > 0 && (
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.2, marginTop:2, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:3 }}>
                              <span style={{ color:'#f59e0b', fontWeight:600 }}>📋 </span>
                              {sub.specialInstructions.join(' · ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ─── СИНЕРГИИ/КОНФЛИКТЫ/ОСТОРОЖНОСТИ ─── */
        <>
          <div style={{ marginBottom:6 }}>
            <input value={synergySearch} onChange={e => setSynergySearch(e.target.value)} placeholder="🔍 Поиск по веществу/эффекту..." style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10, boxSizing:'border-box' }} />
          </div>
           <div style={{ maxHeight:'calc(70vh)', overflowY:'auto', paddingRight:4 }}>{synergiesContent(
              (() => {
                let list = infoSynergySeverity === 'all' ? mergedInteractions : mergedInteractions.filter((i: any) => i.severity === infoSynergySeverity);
               if (synergySubTab !== 'all') {
                 const typeMap: Record<string, string> = { synergies: 'synergy', conflicts: 'conflict', cautions: 'caution' };
                 list = list.filter((i: any) => i.type === typeMap[synergySubTab]);
               }
                if (synergyCountFilter > 0) {
                  list = list.filter((i: any) => {
                    const countA = mergedInteractions.filter((x: any) => x.substanceA === i.substanceA || x.substanceB === i.substanceA).length;
                    const countB = mergedInteractions.filter((x: any) => x.substanceA === i.substanceB || x.substanceB === i.substanceB).length;
                    return Math.max(countA, countB) >= synergyCountFilter;
                  });
                }
                 if (synergyOrganFilter) {
                   list = list.filter((i: any) => {
                     const checkOrg = (subId: string) => {
                       const sub = catalogSubstances.find((s:any) => s.id === subId);
                       if (sub && sub.organs && sub.organs.length > 0) {
                         return sub.organs.some((o: string) => {
                           const norm = (o||'').trim().toUpperCase();
                           const mapping = ORGAN_CATEGORY_MAP[norm];
                           return mapping?.key === synergyOrganFilter;
                         });
                       }
                       const pharm = PHARMA_DB?.[subId];
                       if (pharm && pharm.targetSystems) {
                         const sysToOrg: Record<string, string> = {
                           cardio: 'heart_vessels', heart: 'heart_vessels', vessels: 'heart_vessels',
                           hepatic: 'liver', liver: 'liver',
                           neuro: 'brain_nerves', neuro_toxicity: 'brain_nerves', brain: 'brain_nerves', cns: 'brain_nerves',
                           endocrine: 'endocrine', thyroid: 'endocrine', pancreas: 'endocrine', adrenal: 'endocrine', pituitary: 'endocrine',
                           reproductive: 'reproductive', prostate: 'reproductive', gonads: 'reproductive', testes: 'reproductive', ovaries: 'reproductive',
                           hematologic: 'blood', blood: 'blood',
                           musculoskeletal: 'muscles', muscle: 'muscles', joints: 'joints_bones', bone: 'joints_bones', skeletal: 'joints_bones',
                           skin: 'skin_hair', hair: 'skin_hair', dermal: 'skin_hair',
                           ghigf: 'endocrine', ins_axis: 'endocrine', metabolic: 'mitochondria', mitochondria: 'mitochondria',
                           immunity: 'immune', immune: 'immune',
                           renal: 'kidneys', kidney: 'kidneys', urinary: 'kidneys',
                           gi: 'gi', gastrointestinal: 'gi', gut: 'gi', stomach: 'gi', intestine: 'gi',
                           respiratory: 'lungs', lung: 'lungs', pulmonary: 'lungs',
                         };
                         return pharm.targetSystems.some((o: string) => {
                           const key = sysToOrg[o.toLowerCase().trim()];
                           return key === synergyOrganFilter;
                         });
                       }
                       if (subId) {
                         const pharmKeys = Object.keys(PHARMA_DB);
                         const baseLower = subId.toLowerCase();
                         for (const pk of pharmKeys) {
                           if (pk.includes(baseLower) || baseLower.includes(pk)) {
                             const pfall = PHARMA_DB[pk];
                             if (pfall?.targetSystems) {
                               const sysToOrg2: Record<string, string> = {
                                 cardio: 'heart_vessels', heart: 'heart_vessels', vessels: 'heart_vessels',
                                 hepatic: 'liver', liver: 'liver',
                                 neuro: 'brain_nerves', neuro_toxicity: 'brain_nerves', brain: 'brain_nerves', cns: 'brain_nerves',
                                 endocrine: 'endocrine', thyroid: 'endocrine', pancreas: 'endocrine', adrenal: 'endocrine',
                                 reproductive: 'reproductive', prostate: 'reproductive', gonads: 'reproductive', testes: 'reproductive',
                                 hematologic: 'blood', blood: 'blood',
                                 musculoskeletal: 'muscles', muscle: 'muscles', joints: 'joints_bones', bone: 'joints_bones',
                                 skin: 'skin_hair', hair: 'skin_hair',
                                 ghigf: 'endocrine', ins_axis: 'endocrine', metabolic: 'mitochondria',
                                 immunity: 'immune', immune: 'immune',
                                 renal: 'kidneys', kidney: 'kidneys',
                                 gi: 'gi', gastrointestinal: 'gi', gut: 'gi',
                               };
                               return pfall.targetSystems.some((o: string) => {
                                 const key = sysToOrg2[o.toLowerCase().trim()];
                                 return key === synergyOrganFilter;
                               });
                             }
                           }
                         }
                       }
                       return false;
                     };
                     return checkOrg(i.substanceA) || checkOrg(i.substanceB);
                  });
                }
                if (synergySearch) {
                 const sq = synergySearch.toLowerCase();
                 list = list.filter((i: any) => (i.effect||'').toLowerCase().includes(sq) || (i.substanceA||'').toLowerCase().includes(sq) || (i.substanceB||'').toLowerCase().includes(sq) || (i.notes||'').toLowerCase().includes(sq));
              }
              return list;
           })(), mergedInteractions, expandedCategories, synergySubTab)}</div>
        </>
      )}
    </div>
  );
};