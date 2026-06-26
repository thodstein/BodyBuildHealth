import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { type GoalType } from '../../engines/biostack-ai.engine';
import { findSupplements, type FinderMatch, type FinderQuery } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS, MECHANISM_LABELS } from '../../data/support-database';
import { GlassCard, PillBtn, inputS, PURE_GOALS, TARGET_SYSTEMS, ORGANS, SYSTEMS, TOP_MECHANISMS, SYMPTOMS, toFinderProfile } from './BioStackAIConstants';

type FilterGroup = 'goals' | 'targets' | 'organs' | 'systems' | 'mechanisms';

export function SearchTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [searchText, setSearchText] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedMechs, setSelectedMechs] = useState<string[]>([]);
  const [results, setResults] = useState<FinderMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [openGroup, setOpenGroup] = useState<FilterGroup | null>(null);
  const [expandedCard, setExpandedCard] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_favorites') || '[]'); } catch { return []; }
  });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  type BrowseMode = 'search' | 'by_type' | 'by_organ' | 'by_tier';
  const [browseMode, setBrowseMode] = useState<BrowseMode>('search');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const toggleFav = useCallback((id: string) => {
    const updated = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem('he_biostack_favorites', JSON.stringify(updated));
  }, [favorites]);

  const displayedResults = useMemo(() => {
    if (!showFavoritesOnly) return results;
    return results.filter(r => favorites.includes(r.id));
  }, [results, showFavoritesOnly, favorites]);

  const clearSearch = useCallback(() => {
    setSearchText(''); setSelectedGoal(null); setSelectedOrgans([]);
    setSelectedSystems([]); setSelectedMechs([]); setResults([]); setHasSearched(false);
  }, []);

  const hasAnyFilter = searchText || selectedGoal || selectedOrgans.length > 0 || selectedSystems.length > 0 || selectedMechs.length > 0;

  const handleSearch = useCallback(() => {
    const organs = selectedOrgans.length > 0 ? selectedOrgans : undefined;
    const query: FinderQuery = {
      searchText: searchText || undefined,
      goal: selectedGoal || undefined,
      organs,
      profile: toFinderProfile(profile),
    };
    if (selectedMechs.length > 0) query.mechanisms = selectedMechs;
    const res = findSupplements(query);
    setResults([...res].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 50));
    setHasSearched(true);
  }, [searchText, selectedGoal, selectedOrgans, selectedMechs, profile]);

  const toggleGoal = useCallback((g: GoalType) => { setSelectedGoal(prev => prev === g ? null : g); }, []);

  const toggleArray = useCallback((arr: string[], set: (v: string[]) => void, val: string) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }, []);

  const addToStack = useCallback((id: string) => {
    if (!stackIds.includes(id)) setStackIds([...stackIds, id]);
  }, [stackIds, setStackIds]);

  const removeFromStack = useCallback((id: string) => {
    setStackIds(stackIds.filter(s => s !== id));
  }, [stackIds, setStackIds]);

  const catLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c;
  const mechLabel = (m: string) => MECHANISM_LABELS[m] || m;

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{
      padding: '4px 8px', borderRadius: 10, fontSize: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? 'rgba(0,230,138,0.1)' : '#202023',
      border: active ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)',
      color: active ? '#00e68a' : 'rgba(255,255,255,0.5)',
    }}>{label}</button>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Search input + filters */}
      {/* Browse mode tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {[
          { id:'search' as BrowseMode, label:'🔍 Поиск' },
          { id:'by_type' as BrowseMode, label:'📂 Категории' },
          { id:'by_organ' as BrowseMode, label:'🫀 Органы' },
          { id:'by_tier' as BrowseMode, label:'📊 Уровни' },
        ].map(m => (
          <button key={m.id} onClick={() => setBrowseMode(m.id)} style={{
            flexShrink:0, padding:'5px 12px', borderRadius:12, fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            background: browseMode === m.id ? 'rgba(96,165,250,0.12)' : '#202023',
            border: browseMode === m.id ? '1.5px solid #60a5fa' : '1px solid rgba(255,255,255,0.04)',
            color: browseMode === m.id ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            transition:'all 0.12s',
          }}>{m.label}</button>
        ))}
      </div>

      {/* Search mode */}
      {browseMode === 'search' && (
      <GlassCard title="🔍 Поиск препаратов" icon="🔍" color="#60a5fa">
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Название, механизм, орган..." style={inputS} />
          <button onClick={handleSearch} style={{
            padding: '10px 16px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', whiteSpace: 'nowrap',
          }}>🔍</button>
          {hasAnyFilter && <button onClick={clearSearch} style={{
            padding: '10px 12px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
            background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap',
          }}>✕</button>}
        </div>

        {/* Quick symptom chips */}
        {!hasAnyFilter && !hasSearched && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Быстрый поиск по симптомам:</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {SYMPTOMS.map(s => (
                <PillBtn key={s.label} small onClick={() => { setSelectedGoal(s.goal); setTimeout(handleSearch, 0); }}>{s.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible filter groups */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
          {(['goals','targets','organs','systems','mechanisms'] as FilterGroup[]).map(g => (
            <button key={g} onClick={() => setOpenGroup(openGroup === g ? null : g)} style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 7, cursor: 'pointer', fontWeight: 600,
              background: openGroup === g ? 'rgba(139,92,246,0.1)' : '#202023',
              border: `1px solid ${openGroup === g ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
              color: openGroup === g ? '#8b5cf6' : 'rgba(255,255,255,0.5)',
            }}>
              {g === 'goals' ? '🎯 Цели' : g === 'targets' ? '📍 Мишени' : g === 'organs' ? '🫀 Органы' : g === 'systems' ? '⚙️ Системы' : '🧬 Механизмы'}
              {g === 'goals' && selectedGoal ? ` (1)` : (g === 'organs' && selectedOrgans.length > 0) ? ` (${selectedOrgans.length})` : (g === 'systems' && selectedSystems.length > 0) ? ` (${selectedSystems.length})` : (g === 'mechanisms' && selectedMechs.length > 0) ? ` (${selectedMechs.length})` : ''}
            </button>
          ))}
          <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 7, cursor: 'pointer', fontWeight: 600,
            background: showFavoritesOnly ? 'rgba(251,191,36,0.1)' : '#202023',
            border: `1px solid ${showFavoritesOnly ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)'}`,
            color: showFavoritesOnly ? '#f59e0b' : 'rgba(255,255,255,0.5)',
          }}>⭐ {showFavoritesOnly ? `(${favorites.length})` : ''}</button>
        </div>

        {openGroup === 'goals' && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '4px 0', marginBottom: 4 }}>
            {PURE_GOALS.map(g => filterBtn(g.label, selectedGoal === g.key, () => toggleGoal(g.key)))}
          </div>
        )}
        {openGroup === 'targets' && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '4px 0', marginBottom: 4 }}>
            {TARGET_SYSTEMS.map(t => filterBtn(t.label, selectedGoal === t.key, () => toggleGoal(t.key)))}
          </div>
        )}
        {openGroup === 'organs' && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '4px 0', marginBottom: 4 }}>
            {ORGANS.map(o => filterBtn(o.label, selectedOrgans.includes(o.key), () => toggleArray(selectedOrgans, setSelectedOrgans, o.key)))}
          </div>
        )}
        {openGroup === 'systems' && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '4px 0', marginBottom: 4 }}>
            {SYSTEMS.map(s => filterBtn(s.label, selectedSystems.includes(s.key), () => toggleArray(selectedSystems, setSelectedSystems, s.key)))}
          </div>
        )}
        {openGroup === 'mechanisms' && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '4px 0', marginBottom: 4 }}>
            {TOP_MECHANISMS.map(m => filterBtn(m.label, selectedMechs.includes(m.key), () => toggleArray(selectedMechs, setSelectedMechs, m.key)))}
          </div>
        )}

        {/* Active chips */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
          {stackIds.slice(-5).map(id => {
            const cat = SUPPORT_CATALOG_DATA[id];
            return (
              <span key={id} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
                {cat?.nameRu || cat?.name || id}
                <span onClick={() => removeFromStack(id)} style={{ cursor: 'pointer', marginLeft: 2 }}>✕</span>
              </span>
            );
          })}
          {stackIds.length > 5 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>+{stackIds.length - 5}...</span>}
        </div>
      </GlassCard>
      )}

      {/* Search mode results */}
      {browseMode === 'search' && (
        <>
        {hasSearched && displayedResults.length === 0 && (
          <GlassCard title="Результаты" icon="🔍" color="#f59e0b">
            <div style={{ textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.3)', padding:12 }}>
              {showFavoritesOnly ? '⭐ Нет избранных препаратов. Нажмите ☆ чтобы добавить.' : 'Ничего не найдено. Попробуйте изменить фильтры.'}
            </div>
          </GlassCard>
        )}
        {(() => {
          const visibleCount = page * PAGE_SIZE;
          const paginated = displayedResults.slice(0, visibleCount);
          return paginated.map(match => {
          const cat = SUPPORT_CATALOG_DATA[match.id];
          if (!cat) return null;
          const isInStack = stackIds.includes(match.id);
          const exp = expandedCard[match.id];
          return (
            <GlassCard key={match.id} style={{ marginBottom: 6 }}>
              <div onClick={() => setExpandedCard(prev => ({ ...prev, [match.id]: !exp }))} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{cat.nameRu || cat.name}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, fontWeight: 700,
                      background: match.relevanceScore > 80 ? 'rgba(0,230,138,0.12)' : match.relevanceScore > 50 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                      color: match.relevanceScore > 80 ? '#00e68a' : match.relevanceScore > 50 ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                    }}>{(match.relevanceScore)}%</span>
                    <span onClick={e => { e.stopPropagation(); toggleFav(match.id); }} style={{ cursor: 'pointer', fontSize: 9 }}>
                      {favorites.includes(match.id) ? '⭐' : '☆'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {isInStack ? (
                      <button onClick={e => { e.stopPropagation(); removeFromStack(match.id); }}
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: 7, cursor: 'pointer', fontWeight: 600,
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        ✕ Убрать
                      </button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); addToStack(match.id); }}
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: 7, cursor: 'pointer', fontWeight: 600,
                          background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                        + Стек
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                  {cat.tier && <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 7, background: 'rgba(0,230,138,0.06)', color: '#00e68a' }}>{catLabel(cat.tier)}</span>}
                  {cat.category?.slice(0, 3).map((c: string, i: number) => (
                    <span key={i} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 7, background: 'rgba(96,165,250,0.06)', color: '#60a5fa' }}>{catLabel(c)}</span>
                  ))}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
                  {match.matchReasons?.slice(0, 1).join('; ')}
                </div>
              </div>
              {exp && (
                <div className="bio-fade-fast" style={{ marginTop: 6 }}>
                  {cat.description && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginBottom: 4 }}>📝 {cat.description}</div>}
                  {match.personalNotes?.length > 0 && (
                    <div style={{ fontSize: 7, color: '#00e68a', marginBottom: 2 }}>🎯 Совпадения: {match.personalNotes.slice(0, 3).join(', ')}</div>
                  )}
                  {cat.organs?.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 3 }}>
                      {cat.organs.map((o: string, i: number) => (
                        <span key={i} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 7, background: 'rgba(96,165,250,0.06)', color: '#60a5fa' }}>{o}</span>
                      ))}
                    </div>
                  )}
                  {cat.synergies?.length > 0 && (
                    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.06)', marginBottom: 3 }}>
                      <div style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600 }}>🤝 Синергии:</div>
                      {cat.synergies.slice(0, 3).map((s, i) => (
                        <div key={i} style={{ fontSize: 7, color: '#a78bfa' }}>• {s.effect}</div>
                      ))}
                    </div>
                  )}
                  {cat.conflicts?.length > 0 && (
                    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: 3 }}>
                      <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>🚫 Конфликты:</div>
                      {cat.conflicts.slice(0, 2).map((c, i) => (
                        <div key={i} style={{ fontSize: 7, color: '#f87171' }}>• {c.effect}</div>
                      ))}
                    </div>
                  )}
                  {cat.contraindications?.length > 0 && (
                    <div style={{ fontSize: 7, color: '#f59e0b', marginBottom: 2 }}>⚠ {cat.contraindications.slice(0, 2).join(', ')}</div>
                  )}
                  {cat.dosage && <div style={{ fontSize: 7, color: '#60a5fa', marginTop: 2 }}>💊 {cat.dosage.mg} мг {cat.dosage.timing ? `• ${cat.dosage.timing}` : ''}</div>}
                </div>
              )}
              {!exp && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'right', marginTop: 2 }}>▼</div>}
            </GlassCard>
          );
        });
      })()
    }
    {displayedResults.length > page * PAGE_SIZE && (
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={() => setPage(p => p + 1)} style={{
          padding: '8px 24px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer',
          background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)', color: '#00e68a',
        }}>
          Показать ещё {Math.min(PAGE_SIZE, displayedResults.length - page * PAGE_SIZE)} из {displayedResults.length}
        </button>
      </div>
    )}
    </>
    )}

    {/* Browse by type */}
    {browseMode === 'by_type' && (
      <div>
        {Array.from(new Set(Object.values(SUPPORT_CATALOG_DATA).flatMap(c => c.category || []).filter(Boolean))).sort().map(cat => {
          const subs = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.category?.includes(cat));
          if (subs.length === 0) return null;
          return (
            <GlassCard key={cat} title={`${catLabel(cat)} (${subs.length})`}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                {subs.slice(0,12).map(s => {
                  const sel = stackIds.includes(s.id);
                  return (
                    <span key={s.id} onClick={() => sel ? removeFromStack(s.id) : addToStack(s.id)} style={{
                      padding:'3px 7px', borderRadius:6, fontSize:8, cursor:'pointer', whiteSpace:'nowrap',
                      background: sel ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)',
                      color: sel ? '#00e68a' : 'rgba(255,255,255,0.6)',
                    }}>{s.nameRu || s.name}</span>
                  );
                })}
                {subs.length > 12 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)', padding:'3px 4px' }}>+{subs.length-12}</span>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    )}

    {/* Browse by organ */}
    {browseMode === 'by_organ' && (
      <div>
        {ORGANS.map(o => {
          const subs = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.organs?.includes(o.key));
          if (subs.length === 0) return null;
          return (
            <GlassCard key={o.key} title={`${o.label} (${subs.length})`}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                {subs.slice(0,10).map(s => {
                  const sel = stackIds.includes(s.id);
                  return (
                    <span key={s.id} onClick={() => sel ? removeFromStack(s.id) : addToStack(s.id)} style={{
                      padding:'3px 7px', borderRadius:6, fontSize:8, cursor:'pointer', whiteSpace:'nowrap',
                      background: sel ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)',
                      color: sel ? '#00e68a' : 'rgba(255,255,255,0.6)',
                    }}>{s.nameRu || s.name}</span>
                  );
                })}
                {subs.length > 10 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)', padding:'3px 4px' }}>+{subs.length-10}</span>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    )}

    {/* Browse by tier */}
    {browseMode === 'by_tier' && (
      <div>
        {[['core','🔵 Core'],['standard','🟢 Standard'],['advanced','🟠 Advanced'],['specialty','🔴 Specialty']].map(([tier, label]) => {
          const subs = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.tier === tier);
          if (subs.length === 0) return null;
          return (
            <GlassCard key={tier} title={`${label} (${subs.length})`}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                {subs.slice(0,12).map(s => {
                  const sel = stackIds.includes(s.id);
                  return (
                    <span key={s.id} onClick={() => sel ? removeFromStack(s.id) : addToStack(s.id)} style={{
                      padding:'3px 7px', borderRadius:6, fontSize:8, cursor:'pointer', whiteSpace:'nowrap',
                      background: sel ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)',
                      color: sel ? '#00e68a' : 'rgba(255,255,255,0.6)',
                    }}>{s.nameRu || s.name}</span>
                  );
                })}
                {subs.length > 12 && <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)', padding:'3px 4px' }}>+{subs.length-12}</span>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    )}
    </div>
  );
}
