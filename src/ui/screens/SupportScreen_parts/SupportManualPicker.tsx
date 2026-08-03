// @ts-nocheck
import React from 'react';
import { decodeGarbled } from '../../../utils/text-sanitizer';

interface ManualPickerProps {
  onClose: () => void;
  enhancedSubs: string[];
  setEnhancedSubs: (v: string[] | ((prev: string[]) => string[])) => void;
  catalogSubstances: any[];
  allSupport: any[];
  ALL_STACKS: any[];
  catalogSupport: any[];
  SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }>;
  supportLevel: string;
  MECH_TRANSLATIONS_RU: Record<string, string>;
  MECH_LABELS: Record<string, string>;
  setFavRefresh?: (v: any) => void;
  showToast?: (msg: string, type?: string) => void;
}

export const SupportManualPicker: React.FC<ManualPickerProps> = ({
  onClose,
  enhancedSubs,
  setEnhancedSubs,
  catalogSubstances,
  allSupport,
  ALL_STACKS,
  catalogSupport,
  SUPPORT_LEVELS,
  supportLevel,
  MECH_TRANSLATIONS_RU,
  MECH_LABELS,
  setFavRefresh,
  showToast,
}) => {
  const [tab, setTab] = React.useState<'catalog' | 'stacks' | 'favorites' | 'saved'>('catalog');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [favSearch, setFavSearch] = React.useState('');

  const catSubs = React.useMemo(() => {
    const source = catalogSubstances.length > 0 ? catalogSubstances : catalogSupport;
    return source.filter((s: any) => !search || (s.name||'').toLowerCase().includes(search.toLowerCase()) || (s.id||'').toLowerCase().includes(search.toLowerCase()));
  }, [catalogSubstances, catalogSupport, search]);

  const favIds = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_support_favorites') || '[]') as string[]; } catch { return []; }
  }, []);

  const savedPlans = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_saved_support_plans') || '[]') as any[]; } catch { return []; }
  }, []);

  const savedCalcResults = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]') as any[]; } catch { return []; }
  }, []);

  const myStacks = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_my_stacks') || '[]') as any[]; } catch { return []; }
  }, []);

  const addToPlan = (ids: string[]) => {
    setEnhancedSubs((prev: string[]) => [...new Set([...prev, ...ids])]);
    if (showToast) showToast(`✅ Добавлено: ${ids.length} веществ`, 'success');
    onClose();
  };

  const toggleSelected = (id: string) => {
    setSelected((prev: string[]) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const renderSubstanceItem = (sub: any, isSelected: boolean, onToggle: () => void) => (
    <div key={sub.id} onClick={onToggle} style={{
      padding:'7px 10px', borderRadius:8, cursor:'pointer',
      background: isSelected ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.02)',
      border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:10, minWidth:14, color: isSelected ? '#00e68a' : 'var(--text-dim)' }}>{isSelected ? '✓' : '○'}</span>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
      </div>
      {sub.description && <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginLeft:20, marginTop:2 }}>{decodeGarbled(sub.description)}</div>}
      {sub.mechanisms && sub.mechanisms.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginLeft:20, marginTop:2 }}>
          {sub.mechanisms.slice(0,3).map((m: string) => (
            <span key={m} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU)[m] || m.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div style={{ background:'var(--bg-primary)', borderRadius:16, maxWidth:460, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        
        {/* Header */}
        <div style={{ padding:'14px 14px 4px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:800 }}>🖐️ Ручной выбор поддержки</h3>
            <button onClick={onClose} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕</button>
          </div>
          
          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', flexWrap:'wrap' }}>
            {[
              ['catalog','📋 Каталог'],
              ['favorites','⭐ Избранное'],
              ['saved','💾 Сохранённые'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id as any); setSearch(''); setSelected([]); }}
                style={{
                  padding:'6px 12px', borderRadius:16, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                  background: tab === id ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: tab === id ? '#000' : 'var(--text-dim)',
                  border: '1px solid ' + (tab === id ? 'var(--accent)' : 'var(--border)'),
                }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
          
          {/* ===== TAB 1: CATALOG ===== */}
          {tab === 'catalog' && (
            <div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск препарата..." style={{
                width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8,
              }} />
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>
                {search ? `Найдено: ${catSubs.length}` : `Всего: ${catSubs.length} препаратов`}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:8 }}>
                {catSubs.length === 0 ? (
                  <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Ничего не найдено</div>
                ) : (
                  catSubs.map((s: any) => {
                    const isSel = selected.includes(s.id);
                    const alreadyIn = enhancedSubs.includes(s.id) || SUPPORT_LEVELS[supportLevel]?.subs?.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => { if (!alreadyIn) toggleSelected(s.id); }}
                        style={{
                          padding:'7px 10px', borderRadius:8, cursor: alreadyIn ? 'not-allowed' : 'pointer',
                          background: isSel ? 'rgba(0,230,138,0.08)' : alreadyIn ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
                          border: isSel ? '1px solid rgba(0,230,138,0.3)' : alreadyIn ? '1px solid rgba(0,230,138,0.12)' : '1px solid transparent',
                          opacity: alreadyIn ? 0.6 : 1,
                        }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, minWidth:14, color: isSel ? '#00e68a' : alreadyIn ? '#22c55e' : 'var(--text-dim)' }}>
                            {alreadyIn ? '✓' : (isSel ? '✓' : '○')}
                          </span>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{s.name}</div>
                          {alreadyIn && <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.12)', color:'#22c55e' }}>в плане</span>}
                        </div>
                        {s.description && <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginLeft:20, marginTop:1 }}>{decodeGarbled(s.description)}</div>}
                        {s.mechanisms && s.mechanisms.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginLeft:20, marginTop:2 }}>
                            {s.mechanisms.slice(0,3).map((m: string) => (
                              <span key={m} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU)[m] || m.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {catSubs.length > 50 && <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginBottom:4 }}>Всего {catSubs.length} препаратов. Используйте поиск для фильтрации.</div>}
              <button onClick={() => { if (selected.length > 0) addToPlan(selected); }}
                style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
                  background: selected.length > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  color: selected.length > 0 ? '#000' : 'var(--text-dim)', fontWeight:700, fontSize:11 }}>
                {selected.length > 0 ? `✅ Добавить в план (${selected.length})` : 'Выберите препараты'}
              </button>
            </div>
          )}

          {/* ===== TAB 3: FAVORITES ===== */}
          {tab === 'favorites' && (
            <div>
              <input value={favSearch} onChange={e => setFavSearch(e.target.value)} placeholder="🔍 Поиск в избранном..." style={{
                width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box', marginBottom:8,
              }} />
              {(() => {
                const favSubstances = favIds.map((id: string) => catalogSubstances.find((s: any) => s.id === id)).filter(Boolean);
                const filtered = favSearch ? favSubstances.filter((s: any) => (s.name||'').toLowerCase().includes(favSearch.toLowerCase())) : favSubstances;
                if (filtered.length === 0) return <div style={{ padding:20, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>Нет избранных препаратов. Добавьте из каталога ⭐.</div>;
                const notInPlan = filtered.filter((s: any) => !enhancedSubs.includes(s.id) && !SUPPORT_LEVELS[supportLevel]?.subs?.includes(s.id));
                return (
                  <div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>{favSearch ? `Найдено: ${filtered.length}` : `В избранном: ${filtered.length} · В плане: ${filtered.length - notInPlan.length}`}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:8 }}>
                      {filtered.map((sub: any) => {
                        const inPlan = enhancedSubs.includes(sub.id) || SUPPORT_LEVELS[supportLevel]?.subs?.includes(sub.id);
                        const isSel = selected.includes(sub.id);
                        return (
                          <div key={sub.id} onClick={() => { if (!inPlan) toggleSelected(sub.id); }}
                            style={{
                              padding:'7px 10px', borderRadius:8, cursor: inPlan ? 'not-allowed' : 'pointer',
                              background: isSel ? 'rgba(0,230,138,0.08)' : inPlan ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
                              border: isSel ? '1px solid rgba(0,230,138,0.3)' : inPlan ? '1px solid rgba(0,230,138,0.12)' : '1px solid transparent',
                              opacity: inPlan ? 0.6 : 1,
                            }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:10, minWidth:14, color: isSel ? '#00e68a' : inPlan ? '#22c55e' : 'var(--text-dim)' }}>{inPlan ? '✓' : (isSel ? '✓' : '○')}</span>
                              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
                              {inPlan && <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.12)', color:'#22c55e' }}>в плане</span>}
                            </div>
                            {sub.categories?.length > 0 && (
                              <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginLeft:20, marginTop:2 }}>
                                {sub.categories.slice(0,3).map((c: string) => (
                                  <span key={c} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)' }}>{c}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => {
                      const toAdd = selected.filter(id => !enhancedSubs.includes(id) && !SUPPORT_LEVELS[supportLevel]?.subs?.includes(id));
                      if (toAdd.length > 0) addToPlan(toAdd);
                    }}
                      style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
                        background: selected.length > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        color: selected.length > 0 ? '#000' : 'var(--text-dim)', fontWeight:700, fontSize:11 }}>
                      {selected.length > 0 ? `✅ Добавить в план (${selected.length})` : 'Выберите из избранного'}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== TAB 4: SAVED ===== */}
          {tab === 'saved' && (
            <div>
              <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', padding:'4px 0' }}>Выберите сохранённый план или результат расчёта:</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'50vh', overflowY:'auto' }}>
                {/* My Plans (he_my_plans) */}
                {savedPlans.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>📋 Сохранённые планы ({savedPlans.length})</div>
                    {[...savedPlans].reverse().slice(0, 10).map((sp: any, i: number) => {
                      const p = sp.plan || sp;
                      const pSubs: string[] = p.subs || [];
                      return (
                        <div key={sp.id || i} style={{ padding:'7px 10px', marginBottom:4, borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sp.name || p.levelLabel || 'План'} · {pSubs.length} препаратов</div>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(sp.date || sp.timestamp).toLocaleDateString('ru-RU')}</div>
                          </div>
                          <button onClick={() => addToPlan(pSubs)}
                            style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer',
                              background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:600, whiteSpace:'nowrap' }}>
                            📋 Добавить
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Saved calc results */}
                {savedCalcResults.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginTop:8, marginBottom:4 }}>🧮 Сохранённые расчёты ({savedCalcResults.length})</div>
                    {[...savedCalcResults].reverse().slice(0, 10).map((r: any, i: number) => {
                      const subs: string[] = r.enhancedSubs || r.calcResult?.selectedSubstances || [];
                      return (
                        <div key={r.id || i} style={{ padding:'7px 10px', marginBottom:4, borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>Расчёт: {r.supportLevel || '—'} · {subs.length} препаратов</div>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{new Date(r.timestamp || r.date).toLocaleDateString('ru-RU')} · риск {r.calcResult ? `${Math.round(r.calcResult.riskBeforeSupport)}%→${Math.round(r.calcResult.riskAfterSupport)}%` : ''}</div>
                          </div>
                          <button onClick={() => addToPlan(subs)}
                            style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer',
                              background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:600, whiteSpace:'nowrap' }}>
                            📋 Добавить
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* My stacks (he_my_stacks) */}
                {myStacks.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginTop:8, marginBottom:4 }}>📦 Мои сохранённые стеки ({myStacks.length})</div>
                    {[...myStacks].reverse().slice(0, 10).map((st: any, i: number) => {
                      const stackSubIds: string[] = (st.subs || st.substances || []).map((s: any) => typeof s === 'string' ? s : (s.id || s));
                      return (
                        <div key={st.id || i} style={{ padding:'7px 10px', marginBottom:4, borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{st.name || 'Стек'} · {stackSubIds.length} веществ</div>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{st.system ? `Система: ${st.system} · ` : ''}{st.date ? new Date(st.date).toLocaleDateString('ru-RU') : ''}</div>
                          </div>
                          <button onClick={() => addToPlan(stackSubIds)}
                            style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer',
                              background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:600, whiteSpace:'nowrap' }}>
                            📋 Добавить
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {savedPlans.length === 0 && savedCalcResults.length === 0 && myStacks.length === 0 && (
                  <div style={{ padding:30, textAlign:'center', color:'var(--text-dim)', fontSize:11 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>💾</div>
                    Нет сохранённых планов, расчётов или стеков.<br />
                    Сначала выполните расчёт и сохраните результат.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
