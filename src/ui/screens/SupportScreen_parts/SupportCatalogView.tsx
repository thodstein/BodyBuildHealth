// @ts-nocheck
/**
 * SupportCatalogView.tsx — извлечено из SupportScreen.tsx (каталог).
 * SupportCatalogView — info-view 'catalog' (тело renderView callback body).
 * SupportCatalogTab — tab='catalog' полный блок с InfoErrorBoundary.
 */
import React from 'react';
import { PopupSelect } from '../../components/PopupXxx';
import { InfoErrorBoundary, getCategoryInfo, CLASS_BASE_NAMES, MECH_TRANSLATIONS_RU, TYPE_LABELS_RU, MECH_LABELS, CATEGORY_LABELS } from './SupportScreenData';
import { ALL_STACKS, ALL_INTERACTIONS, SUPPORT_CATALOG_DATA, getSubstanceTier, TIER_LABELS, SYSTEM_LABELS_CATALOG, ORGAN_LABELS, type SupportSubstance } from '../../../data/support-database';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../../data/support-db';
import { UnifiedSynergyCalculator } from './UnifiedSynergyCalculator';


export const SupportCatalogView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    catalogSubTab, setCatalogSubTab,
    searchQuery, setSearchQuery,
    expandedCategories, setExpandedCategories,
    selectedSub, setSelectedSub,
    enhancedSubs, setEnhancedSubs,
    setFavRefresh,
    catalogSubstances,
    groupedSubstances,
    OrganGroupedSubstances,
    typeGroupedSubstances,
    SUPPORT_TIER_GROUPS,
    filteredStacks,
    stackSystems,
    stkFilterSystem, setStkFilterSystem,
    stkFilterQty, setStkFilterQty,
    stkFilterScore, setStkFilterScore,
    stackExpanded, setStackExpanded,
    mergedInteractions,
    catDetailInteractions,
    renderCatalogDetail,
    toast,
  } = s;
  return (
              <div>
                 {/* Sub-tabs: По типам / По органам / Стеки / Взаимодействия */}
                  <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
                    {(['type','organ','stack'] as const).map((t: any) => (
                      <button key={t} onClick={() => { if (t === 'organ') { setExpandedCategories(prev => { const n: Record<string,boolean>={}; Object.keys(prev).forEach((k: any) =>{if(k.startsWith('organ_'))n[k]=true}); return {...prev,...n}; }); } setCatalogSubTab(t); }} style={{
                        padding:'6px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                        background: catalogSubTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: catalogSubTab === t ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${catalogSubTab === t ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{t === 'stack' ? '🧩 Готовые стеки' : t === 'type' ? '📋 По типам' : t === 'organ' ? '🫀 По органам' : '⚠ Взаимодействия'}</button>
                    ))}
                 </div>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-light)', fontSize:12 }} />
                </div>
                <div style={{height:4}} />
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:6 }}>
            {catalogSubTab === 'stack' ? (searchQuery ? `Найдено стеков: ${filteredStacks.length} из ${ALL_STACKS.length}` : `Всего стеков: ${ALL_STACKS.length}`) : (searchQuery ? `Найдено: ${groupedSubstances.reduce((a: any, g: any) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`)}
                </div>
                {catalogSubTab === 'organ' && (
                  /* По органам */
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(OrganGroupedSubstances||[]).map((group: any) => {
                      const isExpanded = expandedCategories[group.key] ?? (group.count <= 5);
                      return (
                        <div key={group.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{group.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{group.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{group.count}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (group.items||[]).map((sub: any) => {
                            const isSelected = selectedSub === sub?.id;
                            return (
                              <div key={sub?.id||'x'}>
                                <div onClick={() => setSelectedSub(isSelected ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map((c: any) => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c||''}</span>)}
                                          {(sub?.mechanisms||[]).slice(0,4).map((m: any) => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                    </div>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                   <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                   <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                   <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                 </div>
                                 {isSelected && sub && (
                                  <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                    <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                       {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).map((c: any) => CATEGORY_LABELS[c]?.label || c).join(', ') : ''}
                                     </div>
                                     {(sub.mechanisms||[]).length > 0 && (
                                       <div style={{ marginBottom:3 }}>
                                         <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                         <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                          {(sub.mechanisms||[]).map((m: any, i: any) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogSubTab === 'tier' && (
                  /* По уровням */
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {SUPPORT_TIER_GROUPS.map((tg: any, tgi: any) => {
                      const isExpanded = expandedCategories[tg.key] ?? true;
                      return (
                        <div key={tg.key} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div onClick={() => setExpandedCategories(prev => ({ ...prev, [tg.key]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                            <span style={{ fontSize:14 }}>{tg.emoji}</span>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:tg.color }}>{tg.label}</div>
                            <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600 }}>{tg.substances.length}</span>
                            <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop:'1px solid var(--border)' }}>
                              {tg.substances.map((id: any) => {
                                const sub = catalogSubstances.find((s: any) => s.id === id);
                                if (!sub) return null;
                                const isSelected = selectedSub === id;
                                return (
                                  <div key={id}>
                                    <div onClick={() => setSelectedSub(isSelected ? null : id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ flex:1 }}>
                                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                         <div style={{ fontSize:8, color:'var(--text-dim)' }}>{(sub.categories||[]).slice(0,2).map((c: any) => CATEGORY_LABELS[c]?.label || c).join(', ')}</div>
                                      </div>
                                      <button onClick={e => { e.stopPropagation(); if (!enhancedSubs.includes(id)) setEnhancedSubs(prev => [...prev, id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(id) ? '✓' : '+ Мой стек'}</button>
                                       <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(id);if(idx>=0)f.splice(idx,1);else f.push(id);localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(id)?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                       <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===id)) { arr.push({id, name:sub?.name||id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                      <span style={{ fontSize:9, color:'var(--text-dim)', transform:isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
                                    </div>
                                    {isSelected && (
                                      <div style={{ padding:'6px 10px 8px 18px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description}</div>
                                        {(sub.mechanisms||[]).length > 0 && (
                                          <div style={{ marginBottom:3 }}>
                                            <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                              {(sub.mechanisms||[]).map((m: any, i: any) => <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                            </div>
                                          </div>
                                        )}
                                        {catDetailInteractions(sub, ALL_INTERACTIONS)}
                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                   {catalogSubTab === 'stack' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                        <PopupSelect label="🫀 Система" value={stkFilterSystem} options={[{id:'all',label:'🫀 Все системы'},...stackSystems.map((sys: any) =>({id:sys,label:SYSTEM_LABELS_CATALOG[sys]||sys}))]} onChange={setStkFilterSystem} />
                        <PopupSelect label="🧪 Количество" value={stkFilterQty} options={[{id:'all',label:'🧪 Любое кол-во'},{id:'1-3',label:'1-3 вещества'},{id:'4-7',label:'4-7 веществ'},{id:'8-15',label:'8-15 веществ'},{id:'16-25',label:'16-25 веществ'},{id:'25+',label:'25+ веществ'}]} onChange={setStkFilterQty} />
                        <PopupSelect label="⭐ Рейтинг" value={stkFilterScore} options={[{id:'all',label:'⭐ Любой рейтинг'},{id:'0-50',label:'⭐ до 50'},{id:'51-74',label:'⭐ 51-74'},{id:'75-84',label:'⭐ 75-84'},{id:'85-100',label:'⭐ 85+'}]} onChange={setStkFilterScore} />
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', textAlign:'center' }}>{filteredStacks.length} из {ALL_STACKS.length}</div>
                      {filteredStacks.map((stk: any) => {
                        const isExp = stackExpanded === stk.id;
                        return (
                        <div key={stk.id} style={{ borderRadius:12, background:'var(--bg-secondary)', border:'1px solid var(--border)', overflow:'hidden' }}>
                          <div style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>{stk.name}</span>
                              <span style={{ fontSize:8, padding:'2px 6px', borderRadius:6, background:'rgba(0,230,138,0.1)', color:'#00e68a', fontWeight:600 }}>⭐ {stk.synergyScore}</span>
                            </div>
                            <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4 }}>{stk.problem}</div>
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
                              {stk.substances.slice(0,6).map((s: any) => {
                                const cat = SUPPORT_CATALOG_DATA[s.id];
                                return <span key={s.id} style={{ padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.06)', color:'#00e68a', fontSize:7 }}>{cat?.nameRu || cat?.name || s.id}</span>;
                              })}
                              {stk.substances.length > 6 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>+{stk.substances.length-6}</span>}
                            </div>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => {
                                const ids = stk.substances.map((s: any) => s.id);
                                const existing = JSON.parse(localStorage.getItem('he_finder_saved_stacks')||'[]');
                                localStorage.setItem('he_finder_saved_stacks', JSON.stringify([ids, ...existing].slice(0,10)));
                                setEnhancedSubs(prev => [...new Set([...prev, ...ids])]);
                              }} style={{ flex:1, padding:'4px 0', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a' }}>📥 + Мой стек</button>
                              <button onClick={() => {
                                try {
                                  let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
                                  if (!arr.find((x:any) => x.id === stk.id)) {
                                    arr.push({
                                      id: stk.id, name: stk.name, description: stk.description, system: stk.system,
                                      subs: stk.substances.map((s: any) => s.id), dosages: Object.fromEntries(stk.substances.map((s: any) => [s.id, s.dose])),
                                      timingSummary: stk.timingSummary, monitoring: stk.monitoring,
                                      specialInstructions: stk.specialInstructions, contraindications: stk.contraindications,
                                      warnings: stk.warnings, synergyScore: stk.synergyScore,
                                      source: 'Каталог стеков', date: new Date().toISOString()
                                    });
                                    localStorage.setItem('he_my_stacks', JSON.stringify(arr));
                                    setFavRefresh(p => p + 1);
                                  }
                                } catch {}
                              }} style={{ padding:'4px 8px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', color:'#818cf8' }}>📦 В мои стеки</button>
                              <button onClick={() => setStackExpanded(isExp ? null : stk.id)} style={{
                                padding:'4px 10px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer',
                                background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', color:'#8b5cf6',
                              }}>📋 {isExp ? 'Скрыть' : 'Подробнее'}</button>
                            </div>
                          </div>
                          {isExp && (
                            <div style={{ padding:'0 12px 10px', borderTop:'1px solid var(--border)', marginTop:0, display:'flex', flexDirection:'column', gap:4, fontSize:7, color:'rgba(255,255,255,0.6)' }}>
                              <div>🧬 <b>Синергия:</b> {stk.synergyPrinciple}</div>
                              <div>⏰ <b>Приём:</b> {stk.timingSummary}</div>
                              {stk.anatomicalMapping?.organSystems && <div>🫀 <b>Системы:</b> {stk.anatomicalMapping.organSystems.join(', ')}</div>}
                              <div>🔬 <b>Контроль:</b> {stk.monitoring}</div>
                              {stk.specialInstructions && <div>💡 <b>Указания:</b> {stk.specialInstructions}</div>}
                              {stk.contraindications && <div style={{ color:'#ef4444' }}>⛔ <b>Противопоказания:</b> {stk.contraindications}</div>}
                              {stk.warnings && <div style={{ color:'#f59e0b' }}>⚠️ <b>Предупреждения:</b> {stk.warnings}</div>}
                              {stk.structuredLabControl?.markers && stk.structuredLabControl.markers.length > 0 && (
                                <div>📊 <b>Маркеры:</b> {stk.structuredLabControl.markers.slice(0,5).map((m: any) => `${m.marker} (${m.when} — ${m.targetRange})`).join('; ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                {/* Complexes tab removed — all substances now in type/organ/tier views */}
                {(catalogSubTab === 'type' || !catalogSubTab) && (
                /* По типам — все 280 препаратов, сгруппированы по типу (без органов/функций) */
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {(typeGroupedSubstances||[]).map((group: any) => {
                    const catInfo = getCategoryInfo(group.cat);
                    const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
                    return (
                      <div key={group.cat} style={{ background:'var(--bg-secondary)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', cursor:'pointer', userSelect:'none' }}>
                          <span style={{ fontSize:14 }}>{catInfo.emoji}</span>
                          <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{catInfo.label}</div>
                          <span style={{ fontSize:9, color:'var(--text-dim)', fontWeight:600, marginRight:2 }}>{group.count}</span>
                          {(group.classBadges||[]).slice(0,4).map((b: any) => (
                            <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                          ))}
                          <span style={{ fontSize:9, color:'var(--text-dim)', transform:isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop:'1px solid var(--border)' }}>
                            {/* Class sub-groups (3+ matching substances) */}
                            {Object.entries(group.classItems || {}).map(([clsKey, clsSubs]: [string, any]) => {
                              const clsInfo = CLASS_BASE_NAMES[clsKey];
                              const clsExpKey = `cls_${group.cat}_${clsKey}`;
                              const clsExpanded = expandedCategories[clsExpKey] ?? true;
                              return (
                                <div key={clsKey}>
                                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [clsExpKey]: !clsExpanded }))} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px 6px 18px', cursor:'pointer', userSelect:'none', background:'rgba(0,230,138,0.03)', borderBottom:'1px solid rgba(0,230,138,0.1)' }}>
                                    <span style={{ fontSize:11 }}>{clsInfo?.emoji || '📦'}</span>
                                    <div style={{ flex:1, fontSize:9, fontWeight:700, color:'#00e68a' }}>{clsInfo?.label || clsKey} ({clsSubs.length} форм{clsSubs.length === 1 ? 'а' : clsSubs.length < 5 ? 'ы' : ''})</div>
                                    <span style={{ fontSize:8, color:'var(--text-dim)', transform:clsExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                                  </div>
                                  {clsExpanded && clsSubs.map((sub: any) => (
                                    <div key={sub?.id||'x'}>
                                      <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 22px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map((c: any) => { const ci = getCategoryInfo(c); return <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{ci.label||c||''}</span>; })}
                                      {(sub?.mechanisms||[]).slice(0,4).map((m: any) => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                          </div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                        <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                        <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                         <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                       </div>
                                       {selectedSub === sub?.id && sub && (
                                         <div style={{ padding:'6px 10px 8px 22px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                           <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                          <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                           {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).map((c: any) => CATEGORY_LABELS[c]?.label || c).join(', ') : ''}
                                           </div>
                                           {(sub.mechanisms||[]).length > 0 && (
                                             <div style={{ marginBottom:3 }}>
                                               <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                               <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                                {(sub.mechanisms||[]).map((m: any, i: any) => (
                                                  <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || (m||'').replace(/_/g, ' ')}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                           {sub.deficiency && sub.deficiency !== 'NONE' && (
                                              <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                           )}
                                          {(sub as any).forms && (sub as any).forms.length > 0 && (
                                            <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                              <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                              {((sub as any).forms as any[]).map((f: any, fi: any) => (
                                                <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                                  <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                                  {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:1000,
          padding:'8px 20px', borderRadius:12, fontSize:10, fontWeight:700,
          background: toast.type==='success'?'rgba(0,230,138,0.9)':toast.type==='warning'?'rgba(245,158,11,0.9)':'rgba(239,68,68,0.9)',
          color: toast.type==='success'?'#000':'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </div>
                                              ))}
                                            </div>
                                          )}
                                          {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Remaining items (not in any class sub-group) */}
                            {(() => {
                              const classSubsSet = new Set<string>();
                              for (const clsSubs of Object.values(group.classItems || {})) {
                                for (const s of clsSubs as SupportSubstance[]) { if (s?.id) classSubsSet.add(s.id); }
                              }
                              const remaining = (group.items||[]).filter((sub: any) => sub?.id && !classSubsSet.has(sub.id));
                              if (remaining.length === 0) return null;
                              return remaining.map((sub: any) => (
                                <div key={sub?.id||'x'}>
                                  <div onClick={() => setSelectedSub(selectedSub === sub?.id ? null : (sub?.id||null))} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'6px 10px 6px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)', lineHeight:1.3 }}>{sub?.name||(sub?.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
                                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:1 }}>
                                      {(sub?.categories||[]).slice(0,3).map((c: any) => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{CATEGORY_LABELS[c]?.label || c||''}</span>)}
                                            {(sub?.mechanisms||[]).slice(0,4).map((m: any) => <span key={m||''} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')||''}</span>)}
                                      </div>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); if (sub?.id && !enhancedSubs.includes(sub.id)) setEnhancedSubs(prev => [...prev, sub.id]); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', whiteSpace:'nowrap', flexShrink:0 }}>{enhancedSubs.includes(sub?.id||'') ? '✓' : '+ Мой стек'}</button>
                                    <button onClick={e => { e.stopPropagation(); try { let f:string[]=JSON.parse(localStorage.getItem('he_support_favorites')||'[]');const idx=f.indexOf(sub?.id||'');if(idx>=0)f.splice(idx,1);else f.push(sub?.id||'');localStorage.setItem('he_support_favorites',JSON.stringify(f));setFavRefresh(p=>p+1);}catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:10, cursor:'pointer', background:'transparent', border:'none', color:(()=>{try{return JSON.parse(localStorage.getItem('he_support_favorites')||'[]').includes(sub?.id||'')?'#fbbf24':'var(--text-dim)';}catch{return 'var(--text-dim)';}})() }}>★</button>
                                    <button onClick={e => { e.stopPropagation(); try { let arr:any[]=JSON.parse(localStorage.getItem('he_my_substances')||'[]'); if(!arr.find((x:any)=>x.id===sub?.id)) { arr.push({id:sub?.id, name:sub?.name||sub?.id, source:'Каталог', date:new Date().toISOString()}); localStorage.setItem('he_my_substances',JSON.stringify(arr)); setFavRefresh(p=>p+1); } }catch{} }} style={{ padding:'2px 6px', borderRadius:6, fontSize:9, cursor:'pointer', background:'transparent', border:'none', color:'var(--text-dim)', whiteSpace:'nowrap', flexShrink:0 }}>💊</button>
                                    <span style={{ fontSize:9, color:'var(--text-dim)', transform:selectedSub === sub?.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                  </div>
                                  {selectedSub === sub?.id && sub && (
                                    <div style={{ padding:'6px 10px 8px 14px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)' }}>
                                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.9)', lineHeight:1.4, marginBottom:4 }}>{sub.description||''}</div>
                                      <div style={{ fontSize:7, color:'var(--accent-green, #00e68a)', marginBottom:3 }}>
                                         {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0,3).map((c: any) => CATEGORY_LABELS[c]?.label || c).join(', ') : ''}
                                       </div>
                                       {(sub.mechanisms||[]).length > 0 && (
                                         <div style={{ marginBottom:3 }}>
                                           <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Механизмы действия:</div>
                                           <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                            {(sub.mechanisms||[]).map((m: any, i: any) => (
                                              <span key={i} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>{(m||'')}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
{(sub.organs||[]).length > 0 && (
                                         <div style={{ marginBottom:3 }}>
                                           <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginBottom:1 }}>Органы-мишени:</div>
                                           <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                                              {[...new Set(sub.organs||[])].map((o: any) => <span key={o||''} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.15)' }}>{ORGAN_LABELS[o]?.replace(/^[^\s]+\s/,'') || o||''}</span>)}
                                           </div>
                                         </div>
                                       )}
                                       {sub.deficiency && sub.deficiency !== 'NONE' && (
                                         <div style={{ fontSize:9, color:'#f59e0b', marginTop:2 }}>⚠ Дефицит: {sub.deficiency}</div>
                                       )}
                                       {(sub as any).forms && (sub as any).forms.length > 0 && (
                                        <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(59,130,246,0.05)', borderRadius:4, border:'1px solid rgba(59,130,246,0.1)' }}>
                                          <div style={{ fontSize:8, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>💊 Формы выпуска:</div>
                                          {((sub as any).forms as any[]).map((f: any, fi: any) => (
                                            <div key={fi} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                              <span style={{ fontSize:9, fontWeight: f.best ? 700 : 400, color: f.best ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{f.best ? '★' : '○'} {f.name}</span>
                                              <span style={{ fontSize:8, color:'rgba(255,255,255,0.6)' }}>{f.dose}</span>
                                              {f.best && <span style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.1)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.2)' }}>Рекоменд.</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {catDetailInteractions(sub, mergedInteractions)}
                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(groupedSubstances||[]).length === 0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>}
                </div>
                )}
              </div>
  );
};

export const SupportCatalogTab: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    section, tab, catalogSubTab,
    searchQuery, setSearchQuery,
    showOrganPopup, setShowOrganPopup,
    catalogOrgans, setCatalogOrgans,
    groupedSubstances, catalogSubstances,
    expandedCategories, setExpandedCategories,
    selectedSub, setSelectedSub,
    mergedInteractions,
    resolveSubName,
  } = s;
  return (
    <>
      {(section === 'home' || section === 'info') && tab === 'catalog' && catalogSubTab !== 'stack' && (<InfoErrorBoundary label="Каталог">
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, категориям, механизмам" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }} />
          </div>
          {/* ── ТЗ-системы фильтр (Popup) ── */}
          <div style={{ marginBottom: 6 }}>
            <button onClick={() => setShowOrganPopup(!showOrganPopup)} style={{
              width:'100%', padding:'10px 12px', borderRadius:10, cursor:'pointer',
              fontSize:10, fontWeight:700, textAlign:'center',
              background: catalogOrgans.length > 0 ? 'rgba(0,230,138,0.1)' : 'rgba(24,24,27,0.6)',
              border: catalogOrgans.length > 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: catalogOrgans.length > 0 ? '#00e68a' : 'rgba(255,255,255,0.7)',
            }}>
              {catalogOrgans.length > 0
                ? `🧬 Системы (${catalogOrgans.length}): ${catalogOrgans.map((o: any) => TZ_SYSTEM_LABELS[o]?.slice(0,10)||o).join(', ')}`
                : '🧬 Все системы организма'}
            </button>
            {showOrganPopup && (
              <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }}
                onClick={() => setShowOrganPopup(false)}>
                <div onClick={e => e.stopPropagation()} style={{ width:'85%', maxWidth:320, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 }}>🧬 Системы организма (ТЗ)</div>
                    <button onClick={() => { setCatalogOrgans([]); setShowOrganPopup(false); }}
                      style={{ display:'block', width:'100%', padding:'10px 12px', marginBottom:4, borderRadius:10, cursor:'pointer', textAlign:'left',
                        fontSize:11, fontWeight: catalogOrgans.length === 0 ? 700 : 400,
                        background: catalogOrgans.length === 0 ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        border: catalogOrgans.length === 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: catalogOrgans.length === 0 ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                      🏠 Все системы {catalogOrgans.length === 0 ? ' ✓' : ''}
                    </button>
                    {['cardio','hepatic','renal','cns','reproductive','hematologic'].map((sys: any) => {
                      const active = catalogOrgans.includes(sys);
                      return (
                        <button key={sys} onClick={() => {
                          setCatalogOrgans(prev => active ? prev.filter((x: any) =>x!==sys) : [...prev, sys]);
                        }}
                          style={{ display:'block', width:'100%', padding:'10px 12px', marginBottom:4, borderRadius:10, cursor:'pointer', textAlign:'left',
                            fontSize:11, fontWeight: active ? 700 : 400,
                            background: active ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                            border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            color: active ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {TZ_SYSTEM_ICONS[sys] || '•'} {TZ_SYSTEM_LABELS[sys] || sys}{active ? ' ✓' : ''}
                        </button>
                      );
                    })}
                    <button onClick={() => setShowOrganPopup(false)}
                      style={{ width:'100%', marginTop:6, padding:'10px', borderRadius:8, border:'none',
                        background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            {searchQuery ? `Найдено: ${groupedSubstances.reduce((a: any, g: any) => a + g.count, 0)} из ${catalogSubstances.length}` : `Всего: ${catalogSubstances.length} препаратов`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '68vh', overflowY: 'auto', paddingRight: 2 }}>
            {groupedSubstances.map((group: any) => {
              const catInfo = getCategoryInfo(group.cat);
              const isExpanded = expandedCategories[group.cat] ?? (group.count <= 5);
              return (
                <div key={group.cat} style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div onClick={() => setExpandedCategories(prev => ({ ...prev, [group.cat]: !isExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: 16 }}>{catInfo.emoji}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>{catInfo.label}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, marginRight: 4 }}>{group.count}</span>
                    {(group.classBadges||[]).slice(0,4).map((b: any) => (
                      <span key={b.clsKey} style={{ fontSize:7, padding:'0px 4px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a', fontWeight:600, marginRight:2 }}>{b.emoji}{b.count}</span>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {group.items.map((sub: any) => (
                        <div key={sub.id}>
                          <div onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 12px 7px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', lineHeight: 1.3 }}>{sub.name||(sub.id||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}{' '}<span style={{fontSize:8,padding:'0 3px',borderRadius:3,fontWeight:700,color:TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)',background:(TIER_LABELS[getSubstanceTier(sub.id)]?.color||'var(--text-dim)')+'18'}}>{TIER_LABELS[getSubstanceTier(sub.id)]?.label||'Стд'}</span></div>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                                 {(sub.categories||[]).slice(0, 3).map((c: any) => (
                                   <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{CATEGORY_LABELS[c]?.label || c}</span>
                                 ))}
                                {(sub.mechanisms||[]).slice(0, 3).map((m: any) => {
                                  const tzLabel = TZ_MECH_LABELS[m as keyof typeof TZ_MECH_LABELS];
                                  return <span key={m} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent-green, #00e68a)' }}>{tzLabel || m.replace(/_/g, ' ').toLowerCase()}</span>;
                                })}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: selectedSub === sub.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                          </div>
                          {selectedSub === sub.id && (
                            <div style={{ padding: '8px 12px 10px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: 6 }}>{sub.description}</div>
                              {/* Type badge */}
                              <div style={{ fontSize: 8, color: 'var(--accent-green, #00e68a)', marginBottom: 4 }}>
                                {TYPE_LABELS_RU[sub.type] || sub.type || 'Без категории'}{(sub.categories||[]).length > 0 ? ' · ' + (sub.categories||[]).slice(0, 3).map((c: any) => CATEGORY_LABELS[c]?.label || c).join(', ') : ''}
                              </div>
                              {/* All mechanisms */}
                              {sub.mechanisms && sub.mechanisms.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Механизмы действия:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {(sub.mechanisms || []).map((m: any, i: any) => (
                                      <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g, ' ')}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Organs */}
                              {sub.organs && sub.organs.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Органы-мишени:</div>
                                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {[...new Set(sub.organs||[])].map((o: any) => (
                                      <span key={o} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{ORGAN_LABELS[o]?.replace(/^[^\s]+\s/,'') || o}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {sub.deficiency && sub.deficiency !== 'NONE' && (
                                <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 2, marginBottom: 4 }}>
                                  Дефицит: {sub.deficiency}
                                </div>
                              )}
                              {/* Cross-referenced interactions with this substance */}
                              {(() => {
                                const subsInteractions = mergedInteractions.filter((i: any) =>
                                  i.substanceA === sub.id || i.substanceB === sub.id
                                ).slice(0, 12);
                                return subsInteractions.length > 0 ? (
                                  <div style={{ marginTop: 4 }}>
                                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>Взаимодействия:</div>
                                    {subsInteractions.map((i: any) => {
                                      const isA = i.substanceA === sub.id;
                                      const partner = isA ? i.substanceB : i.substanceA;
                                      const pName = resolveSubName(partner);
                                      const tColor = i.type === 'synergy' ? '#22c55e' : i.type === 'conflict' ? '#ef4444' : '#f59e0b';
                                      return (
                                        <div key={i.interactionId} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', lineHeight: 1.3 }}>
                                          <span style={{ color: tColor, fontWeight: 600 }}>
                                            {i.type === 'synergy' ? '⊕' : i.type === 'conflict' ? '⊖' : '⚡'}
                                          </span>
                                          {' '}{pName} — {i.type === 'synergy' ? 'синергия' : i.type === 'conflict' ? 'конфликт' : 'осторожно'}
                                          {i.severity && <span style={{ opacity: 0.6 }}> · {i.severity}</span>}
                                          {i.notes && <div style={{ opacity: 0.5 }}>{i.notes}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedSubstances.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Ничего не найдено по запросу "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </InfoErrorBoundary>)}    </>
  );
};
