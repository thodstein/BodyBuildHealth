// @ts-nocheck
import React from 'react';
import { ALL_INTERACTIONS } from '../../../data/support-database';

export const SupportFavoritesView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    catalogSubstances,
    favTab, setFavTab,
    favSearch, setFavSearch,
    favRefresh, setFavRefresh,
    SUPPORT_LEVELS, supportLevel,
    calcSupport,
    setPlanSaved,
    planSubTab, setPlanSubTab,
    archivedPlans, setArchivedPlans,
    expandedArchiveId, setExpandedArchiveId,
    cartItems, setCartItems,
    setCalcResult, setCalcDone,
    setSupportLevel,
    setCourseWeekState,
    setBoostEnabled,
    setJointMode,
    setEnhancedSubs,
    setMyPlansRefresh,
    reportGenerated, setReportGenerated,
    mixGoals, setMixGoals,
    mixWorkoutType, setMixWorkoutType,
    mixTimeOfDay, setMixTimeOfDay,
    setSection, setTab, setSupportView, setCalcView,
    linked,
  } = s;

  let favIds: string[] = [];
  try { favIds = JSON.parse(localStorage.getItem('he_support_favorites') || '[]'); } catch {}
  const favSubstances = favIds.map((id: string) => catalogSubstances.find((sub: any) => sub.id === id)).filter(Boolean);
  const filtered = favSearch ? favSubstances.filter((sub: any) => (sub?.name||'').toLowerCase().includes(favSearch.toLowerCase())) : favSubstances;

  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
        {[['favorites','⭐ Избранное'],['mySubstances','💊 Мои препараты'],['myStacks','📦 Мои стеки'],['calculator','🧮 Расчёты'],['mixes','🎯 Миксы'],['plan','📋 План'],['reports','📊 Отчеты']].map(([id,label]:any) => (
          <button key={id} onClick={() => setFavTab(id)} style={{
            padding:'7px 14px', borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
            background: favTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
            color: favTab === id ? '#000' : 'var(--text-dim)',
            border: '1px solid ' + (favTab === id ? 'var(--accent)' : 'var(--border)'),
          }}>{label}</button>
        ))}
      </div>

      {/* === FAVORITES TAB === */}
      {favTab === 'favorites' && (
      <div>
        <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
          placeholder="🔍 Поиск в избранном..."
          style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8 }} />
        {filtered.length === 0 ? (
          <div style={{ padding:24, textAlign:'center' }}>
            <div style={{ fontSize:24, marginBottom:6 }}>⭐</div>
            <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет избранных препаратов.</div>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога ➕</div>
          </div>
        ) : (
          filtered.map((sub: any) => (
            <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sub.name||sub.id}</div>
                <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                  {(sub.categories||[]).slice(0,3).map((c: string) => <span key={c} style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)' }}>{c}</span>)}
                </div>
              </div>
              <button onClick={() => {
                try {
                  let f: string[] = JSON.parse(localStorage.getItem('he_support_favorites') || '[]');
                  const idx = f.indexOf(sub.id);
                  if (idx >= 0) f.splice(idx, 1);
                  localStorage.setItem('he_support_favorites', JSON.stringify(f));
                  setFavRefresh((prev:number) => prev + 1);
                } catch {}
              }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>★ Убрать</button>
            </div>
          ))
        )}
      </div>
      )}

      {/* === MY SUBSTANCES TAB === */}
      {favTab === 'mySubstances' && (
      <div style={{ paddingBottom:80 }}>
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
            placeholder="🔍 Поиск в Моих препаратах..."
            style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
        </div>
        {(() => {
          let mySubs: any[] = [];
          try { mySubs = JSON.parse(localStorage.getItem('he_my_substances') || '[]'); } catch {}
          const filteredSubs = favSearch ? mySubs.filter((sub:any) => (sub.name||sub.id||'').toLowerCase().includes(favSearch.toLowerCase())) : mySubs;
          if (filteredSubs.length === 0) return (
            <div style={{ padding:24, textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>💊</div>
              <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых препаратов.</div>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога или BioStack AI (кнопка ★ или «В мои препараты»).</div>
            </div>
          );
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filteredSubs.map((sub: any) => (
                <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sub.name || sub.id}</div>
                    {sub.dose && <div style={{ fontSize:8, color:'var(--text-dim)' }}>{sub.dose}</div>}
                    {sub.source && <div style={{ fontSize:8, color:'rgba(0,230,138,0.6)' }}>📌 {sub.source}</div>}
                  </div>
                  <button onClick={() => {
                    try {
                      let arr: any[] = JSON.parse(localStorage.getItem('he_my_substances') || '[]');
                      localStorage.setItem('he_my_substances', JSON.stringify(arr.filter((x:any) => x.id !== sub.id)));
                      setFavRefresh((prev:number) => prev + 1);
                    } catch {}
                  }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>✕ Убрать</button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      {/* === MY STACKS TAB === */}
      {favTab === 'myStacks' && (
      <div style={{ paddingBottom:80 }}>
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          <input value={favSearch} onChange={e => setFavSearch(e.target.value)}
            placeholder="🔍 Поиск в Моих стеках..."
            style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
        </div>
        {(() => {
          let myStacksArr: any[] = [];
          try { myStacksArr = JSON.parse(localStorage.getItem('he_my_stacks') || '[]'); } catch {}
          const filteredStacks = favSearch ? myStacksArr.filter((st:any) => (st.name||st.id||'').toLowerCase().includes(favSearch.toLowerCase())) : myStacksArr;
          if (filteredStacks.length === 0) return (
            <div style={{ padding:24, textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>📦</div>
              <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых стеков.</div>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Добавьте из каталога стеков или BioStack AI (кнопка «В мои стеки»).</div>
            </div>
          );
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filteredStacks.map((st: any) => (
                <div key={st.id} style={{ padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{st.name || st.id}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{st.subs?.length || 0} препаратов · {st.system || '—'}</div>
                    </div>
                    <button onClick={() => {
                      try {
                        let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
                        localStorage.setItem('he_my_stacks', JSON.stringify(arr.filter((x:any) => x.id !== st.id)));
                        setFavRefresh((prev:number) => prev + 1);
                      } catch {}
                    }} style={{ padding:'3px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', whiteSpace:'nowrap', flexShrink:0 }}>✕ Удалить</button>
                  </div>
                  {st.description && <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.3 }}>{st.description.slice(0, 120)}{st.description.length > 120 ? '...' : ''}</div>}
                  {st.subs && st.subs.length > 0 && (
                    <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                      {(st.subs as string[]).slice(0, 6).map((sid: string) => {
                        const cn = catalogSubstances.find((c:any) => c.id === sid);
                        return <span key={sid} style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>{cn?.name || sid}</span>;
                      })}
                      {st.subs.length > 6 && <span style={{ fontSize:7, color:'var(--text-dim)' }}>+{st.subs.length - 6}</span>}
                    </div>
                  )}
                  <button onClick={() => {
                    const subs = (st.subs || []).filter((id:string) => SUPPORT_LEVELS[supportLevel]?.subs ? !SUPPORT_LEVELS[supportLevel].subs.includes(id) : true);
                    if (subs.length === 0) { alert('Все препараты стека уже в плане'); return; }
                    const level = SUPPORT_LEVELS[supportLevel];
                    if (level) {
                      const newDosages = { ...level.dosages };
                      subs.forEach((id:string) => { const d = (st.dosages||{})[id]; if (d) newDosages[id] = typeof d === 'number' ? { mg: d, timing: '' } : d; });
                      SUPPORT_LEVELS[supportLevel] = { ...level, subs: [...level.subs, ...subs], dosages: newDosages };
                    }
                    alert(`✅ ${subs.length} препаратов добавлено в план`);
                    setFavRefresh((prev:number) => prev + 1);
                  }} style={{ marginTop:4, padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:600 }}>📋 В план</button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      {/* === PLAN TAB === */}
      {favTab === 'plan' && (
        <div style={{ padding:'0 0 80px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setPlanSubTab('active')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'active' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'active' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'active' ? 'var(--accent)' : 'var(--border)'}` }}>✅ Действующий план</button>
            <button onClick={() => setPlanSubTab('myplans')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'myplans' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'myplans' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'myplans' ? 'var(--accent)' : 'var(--border)'}` }}>📋 Мои планы</button>
            <button onClick={() => setPlanSubTab('archive')} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', background: planSubTab === 'archive' ? 'var(--accent)' : 'var(--bg-secondary)', color: planSubTab === 'archive' ? '#000' : 'var(--text-dim)', border: `1px solid ${planSubTab === 'archive' ? 'var(--accent)' : 'var(--border)'}` }}>📦 Архив ({archivedPlans.length})</button>
          </div>

          {planSubTab === 'active' && (() => {
            const level = SUPPORT_LEVELS[supportLevel];
            const subs = level?.subs || [];
            const dosages = level?.dosages || {};
            const getInfo = (id: string) => {
              const sub = catalogSubstances.find((s:any) => s.id === id);
              const d = dosages[id];
              return { id, name: sub?.name || id.replace(/_/g, ' '), mg: d?.mg ?? 0, timing: d?.timing || '', desc: sub?.description || '' };
            };
            return (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>📋 Действующий план поддержки</div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Уровень: {level?.label || supportLevel}</div>

                {/* Action buttons */}
                <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                  <button onClick={() => {
                    const saved = localStorage.getItem('savedStacks');
                    if (!saved || JSON.parse(saved).length === 0) { alert('Нет сохранённых стеков'); return; }
                    const stacks = JSON.parse(saved);
                    const names = stacks.map((s: any,i: number) => `${i+1}. ${s.name || ''}`).join('\n');
                    const idx = parseInt(prompt(`Выберите стек:\n${names}`) || '-1') - 1;
                    if (idx < 0 || idx >= stacks.length) return;
                    const stack = stacks[idx];
                    const stackSubs = (stack.subs || []).filter((id: string) => !subs.includes(id));
                    if (stackSubs.length === 0) { alert('Все препараты уже в плане'); return; }
                    const newDosages = { ...dosages };
                    (stackSubs || []).forEach((id: string) => {
                      const d = stack.dosages?.[id];
                      if (d) newDosages[id] = typeof d === 'number' ? { mg: d, timing: '' } : d;
                    });
                    SUPPORT_LEVELS[supportLevel] = { ...level, subs: [...subs, ...stackSubs], dosages: newDosages };
                    window.location.reload();
                  }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontWeight:600 }}>📦 Из моих стеков</button>
                  <button onClick={() => {
                    const items = subs.map((id: string) => { const info = getInfo(id); return { id, name: info.name, dose: info.mg, timing: info.timing }; });
                    const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
                    localStorage.setItem('supportCart', JSON.stringify([...existing, ...items]));
                    setCartItems([...cartItems, ...items]);
                    alert('✅ Добавлено в корзину');
                  }} style={{ padding:'6px 12px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(255,152,0,0.15)', border:'1px solid rgba(255,152,0,0.3)', color:'#ff9800', fontWeight:600 }}>🛒 В корзину</button>
                </div>

                {/* Timing table */}
                {subs.length > 0 && (
                  <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📋 Таблица приёма</div>
                    <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                      <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                        <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                        <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                        <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                      </tr></thead>
                      <tbody>
                        {subs.map((id: string) => {
                          const sub = catalogSubstances.find((s:any) => s.id === id);
                          const d = dosages[id];
                          if (!sub || !d) return null;
                          return (
                            <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                              <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d.timing || '—'}</td>
                              <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub.name || id.replace(/_/g, ' ')}</td>
                              <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d.mg >= 1000 && id !== 'omega3' ? `${(d.mg/1000).toFixed(d.mg%1000===0?0:1)}г` : `${d.mg}мг`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {subs.length === 0 && <div style={{ fontSize:10, color:'var(--text-dim)' }}>Нет препаратов в плане. Сначала выполните расчёт в калькуляторе.</div>}

                {/* Save plan */}
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  <button onClick={() => {
                    const plan = { level:supportLevel, date:new Date().toISOString(), subs, dosages, label:supportLevel||level?.label, budget: supportLevel };
                    const existing = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                    existing.push({ id:Date.now(), date:new Date().toISOString(), plan });
                    localStorage.setItem('he_saved_support_plans', JSON.stringify(existing));
                    setPlanSaved(true);
                  }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:11 }}>💾 Сохранить план</button>
                </div>
                {planSubTab === 'active' && setPlanSaved && s.planSaved && <div style={{ textAlign:'center', fontSize:10, color:'#22c55e', marginTop:4 }}>✅ План сохранён</div>}

                {/* My plans */}
                {(() => {
                  let savedPlans: any[] = [];
                  try { savedPlans = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]'); } catch {}
                  if (savedPlans.length === 0) return null;
                  return (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📋 Мои планы</div>
                      {[...savedPlans].reverse().map((sp: any, i: any) => {
                        const p = sp.plan || {};
                        const pSubs = p.subs || [];
                        return (
                          <div key={sp.id || i} style={{ padding:'6px 10px', marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.levelLabel || 'План'} · {pSubs.length} препаратов</div>
                              <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(sp.date).toLocaleDateString('ru-RU')}</div>
                            </div>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => {
                                const lvl = (p.level || 'mid') as 'basic' | 'mid' | 'max' | 'boost';
                                setSupportLevel(lvl);
                                calcSupport(lvl, pSubs);
                                setPlanSaved(`✅ Загружен: ${p.levelLabel || lvl}`);
                                setTimeout(() => setPlanSaved(''), 3000);
                              }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                              <button onClick={() => {
                                try {
                                  let saved: any[] = JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]');
                                  localStorage.setItem('he_saved_support_plans', JSON.stringify(saved.filter((x:any) => x.id !== sp.id)));
                                  window.location.reload();
                                } catch {}
                              }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {/* Archive */}
          {planSubTab === 'archive' && (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>📦 Архив планов</div>
              {archivedPlans.length === 0 ? (
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Архив пуст. При сохранении нового плана старый автоматически помещается в архив.</div>
              ) : (
                [...archivedPlans].reverse().map((plan: any, idx: any) => {
                  const planId = `arch_${idx}_${plan.archivedAt || plan.date}`;
                  const isExpanded = expandedArchiveId === planId;
                  const planSubs = plan.subs || [];
                  const planDosages = plan.dosages || {};
                  return (
                    <div key={planId} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                      <div onClick={() => setExpandedArchiveId(isExpanded ? null : planId)} style={{ padding:'8px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{plan.label || 'План'}</div>
                          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{new Date(plan.archivedAt || plan.date).toLocaleDateString('ru-RU')} · {planSubs.length} препаратов</div>
                        </div>
                        <span style={{ fontSize:12, color:'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:'8px 12px' }}>
                          {planSubs.length > 0 && (
                            <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                              <thead><tr style={{ background:'rgba(0,0,0,0.1)' }}>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Препарат</th>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Доза</th>
                                <th style={{ padding:'3px 5px', textAlign:'left' }}>Время</th>
                              </tr></thead>
                              <tbody>
                                {planSubs.map((id: string) => {
                                  const sub = catalogSubstances.find((s: any) => s.id === id);
                                  const d = planDosages[id];
                                  return (
                                    <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                                      <td style={{ padding:'3px 5px', fontWeight:600, color:'var(--text-light)' }}>{sub?.name || id.replace(/_/g, ' ')}</td>
                                      <td style={{ padding:'3px 5px', color:'#00e68a' }}>{d?.mg ? `${d.mg}мг` : '—'}</td>
                                      <td style={{ padding:'3px 5px', color:'var(--text-dim)' }}>{d?.timing || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          <button onClick={() => {
                            const archive = JSON.parse(localStorage.getItem('supportPlanArchive') || '[]');
                            const key = [...archivedPlans].reverse()[idx];
                            const realIdx = archivedPlans.indexOf(key);
                            if (realIdx >= 0) { archive.splice(realIdx, 1); localStorage.setItem('supportPlanArchive', JSON.stringify(archive)); setArchivedPlans(archive); }
                          }} style={{ marginTop:6, padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑 Удалить из архива</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* === MY SAVED PLANS === */}
          {planSubTab === 'myplans' && (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📋 Мои планы поддержки</div>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Сохранённые планы с уровнем, составом и рисками. Можно загрузить в калькулятор.</div>
              {(() => {
                let myPlans: any[] = [];
                try { myPlans = JSON.parse(localStorage.getItem('he_my_plans') || '[]'); } catch {}
                if (myPlans.length === 0) return (
                  <div style={{ padding:24, textAlign:'center' }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>📋</div>
                    <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых планов.</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Выполните расчёт и сохраните его через кнопку «Сохранить план в Мои планы».</div>
                  </div>
                );
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {[...myPlans].reverse().map((p: any, i: any) => (
                      <div key={p.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.name}</div>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(p.date).toLocaleDateString('ru-RU')} · ур. {p.level} · нед. {p.week}</div>
                          </div>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => {
                              if (p.level) setSupportLevel(p.level);
                              if (p.week) setCourseWeekState(p.week);
                              if (p.boostEnabled !== undefined) setBoostEnabled(p.boostEnabled);
                              if (p.jointMode !== undefined) setJointMode(p.jointMode);
                              if (p.enhancedSubs) setEnhancedSubs(p.enhancedSubs);
                              setPlanSaved('✅ План загружен в калькулятор');
                              setTimeout(() => setPlanSaved(''), 3000);
                            }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                            <button onClick={() => {
                              try {
                                let arr: any[] = JSON.parse(localStorage.getItem('he_my_plans') || '[]');
                                localStorage.setItem('he_my_plans', JSON.stringify(arr.filter((x: any) => x.id !== p.id)));
                                setMyPlansRefresh((prev:number) => prev + 1);
                              } catch {}
                            }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                          </div>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                          {p.subs?.length || 0} препаратов · Риск: {Math.round(p.riskBefore)}% → {Math.round(p.riskAfter)}% · Покрытие: {Math.round(p.supportScore)}/100
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* === CALCULATOR SAVED DATA === */}
      {favTab === 'calculator' && (
        <div style={{ paddingBottom:80 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🧮 Сохранённые расчёты калькулятора</div>
          <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Здесь хранятся расчёты поддержки — результат + уровень + неделя. Можно загрузить обратно в калькулятор.</div>
          {(() => {
            let saved: any[] = [];
            try { saved = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]'); } catch {}
            if (saved.length === 0) return (
              <div style={{ padding:24, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>🧮</div>
                <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых расчётов.</div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Выполните расчёт и сохраните его через кнопку в карточке расчёта.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[...saved].reverse().map((r: any, i: any) => (
                  <div key={r.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>Уровень: {r.supportLevel || '—'}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(r.timestamp || r.date).toLocaleDateString('ru-RU')}</div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => {
                          if (r.supportLevel) setSupportLevel(r.supportLevel);
                          if (r.calcResult) { setCalcResult(r.calcResult); setCalcDone(true); }
                          if (r.boostEnabled !== undefined) setBoostEnabled(r.boostEnabled);
                          if (r.jointMode !== undefined) setJointMode(r.jointMode);
                          if (r.courseWeekState) setCourseWeekState(r.courseWeekState);
                          if (r.enhancedSubs) setEnhancedSubs(r.enhancedSubs);
                          setPlanSaved('✅ Расчёт загружен из избранного');
                          setTimeout(() => setPlanSaved(''), 3000);
                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                        <button onClick={() => {
                          try {
                            let arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                            localStorage.setItem('he_saved_calc_results', JSON.stringify(arr.filter((x: any) => x.id !== r.id)));
                            setFavRefresh((prev:number) => prev + 1);
                          } catch {}
                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                      </div>
                    </div>
                    {r.calcResult && (
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                        Риск: {Math.round(r.calcResult.riskBeforeSupport)}% → {Math.round(r.calcResult.riskAfterSupport)}% · Покрытие: {Math.round(r.calcResult.supportScore)}/100
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* === MIXES TAB === */}
      {favTab === 'mixes' && (
        <div style={{ paddingBottom:80 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🎯 Сохранённые комплекты миксов</div>
          <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Полные комплекты (пред + интра + пост), сохранённые из калькулятора тренировочных миксов.</div>
          {(() => {
            let saved: any[] = [];
            try { saved = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]').filter((x: any) => x.type === 'mix'); } catch {}
            if (saved.length === 0) return (
              <div style={{ padding:24, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>🎯</div>
                <div style={{ fontSize:11, color:'var(--text-dim)' }}>Нет сохранённых комплектов.</div>
                <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Соберите микс и нажмите «💾 Комплект» в карточке расчёта.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[...saved].reverse().map((kit: any, i: number) => (
                  <div key={kit.id || i} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>{kit.goal}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)' }}>
                          {kit.workoutType} · {kit.timeOfDay} · {kit.isOnCycle ? 'курс' : 'натурал'}
                          · {new Date(kit.date).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => {
                          setMixGoals([kit.goal]);
                          setMixWorkoutType(kit.workoutType);
                          setMixTimeOfDay(kit.timeOfDay);
                          setPlanSaved('✅ Комплект загружен, переключите тайминги');
                          setTimeout(() => setPlanSaved(''), 3000);
                          setSection('info'); setTab('main'); setSupportView('calc'); setCalcView('mixcalc');
                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', color:'#60a5fa' }}>📂</button>
                        <button onClick={() => {
                          try {
                            let arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                            localStorage.setItem('he_saved_calc_results', JSON.stringify(arr.filter((x: any) => x.id !== kit.id)));
                            setFavRefresh((p:number) => p + 1);
                          } catch {}
                        }} style={{ padding:'3px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:7, color:'var(--text-dim)' }}>
                      <div><b style={{color:'#f97316'}}>🔥 Pre:</b> {(kit.pre||[]).length} веществ</div>
                      <div><b style={{color:'#06b6d4'}}>💧 Intra:</b> {(kit.intra||[]).length} веществ</div>
                      <div><b style={{color:'#22c55e'}}>🍗 Post:</b> {(kit.post||[]).length} веществ</div>
                    </div>
                    <div style={{ marginTop:4, fontSize:7, lineHeight:1.3, color:'rgba(255,255,255,0.6)' }}>
                      <div><b>Pre:</b> {(kit.pre||[]).slice(0,5).map((s:any)=>s.name).join(', ')}{(kit.pre||[]).length>5?` +${kit.pre.length-5}`:''}</div>
                      <div><b>Intra:</b> {(kit.intra||[]).slice(0,4).map((s:any)=>s.name).join(', ')}{(kit.intra||[]).length>4?` +${kit.intra.length-4}`:''}</div>
                      <div><b>Post:</b> {(kit.post||[]).slice(0,5).map((s:any)=>s.name).join(', ')}{(kit.post||[]).length>5?` +${kit.post.length-5}`:''}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* === REPORTS TAB === */}
      {favTab === 'reports' && (
        <div style={{ paddingBottom:80 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📊 Отчёты поддержки</div>
          <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8, lineHeight:1.3 }}>Полный отчёт по рискам, поддержке, взаимодействиям и курсу. Сохраняется в архив.</div>

          <button onClick={() => {
            const profile = linked.profile;
            const course = linked.course || [];
            const weightKg = profile?.settings?.weight ?? 80;
            const age = profile?.settings?.age ?? 30;
            const sex = profile?.settings?.sex ?? 'male';
            const levelSubIds = SUPPORT_LEVELS[supportLevel]?.subs || [];
            const planItems = levelSubIds.map((id:string) => {
              const sub = catalogSubstances.find((s:any) => s.id === id);
              const dos = { mg:500, timing:'с едой' };
              return { id, name:sub?.name||id, dose:dos.mg+'мг', timing:dos.timing, categories:sub?.categories||[], mechanisms:sub?.mechanisms||[] };
            });
            const report = {
              id: Date.now().toString(),
              date: new Date().toISOString(), level:supportLevel, items:planItems,
              substanceCount: catalogSubstances.length, interactionCount: ALL_INTERACTIONS.length,
              timestamp: Date.now()
            };
            const archive = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]');
            archive.unshift(report);
            localStorage.setItem('he_support_reports_archive', JSON.stringify(archive));
            localStorage.setItem('he_support_report_current', JSON.stringify(report));
            try { localStorage.setItem('he_support_reports', JSON.stringify(archive.slice(0, 20))); } catch {}
            try { localStorage.setItem('he_profile_support_reports', JSON.stringify(archive.slice(0, 10))); } catch {}
            setReportGenerated(true);
          }} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:11 }}>📊 Сгенерировать отчёт</button>

          {/* Archive */}
          {(() => {
            let archive: any[] = [];
            try { archive = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]'); } catch {}
            if (archive.length === 0) return null;
            return (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>Архив отчётов</div>
                {archive.slice(0,10).map((r: any, i: any) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', marginBottom:4, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:9, color:'var(--text-light)' }}>Отчёт {r.level || ''} · {r.items?.length || 0} препаратов</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(r.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <button onClick={() => {
                      try {
                        const arch: any[] = JSON.parse(localStorage.getItem('he_support_reports_archive') || '[]');
                        const realIdx = arch.findIndex((x: any) => x.id === r.id);
                        if (realIdx >= 0) { arch.splice(realIdx, 1); localStorage.setItem('he_support_reports_archive', JSON.stringify(arch)); window.location.reload(); }
                      } catch {}
                    }} style={{ padding:'3px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444' }}>🗑</button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};