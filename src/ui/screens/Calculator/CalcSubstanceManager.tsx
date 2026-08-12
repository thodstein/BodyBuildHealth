// ════════════════════════════════════════════════════════════════════
//  CalcSubstanceManager — управление препаратами: добавить/удалить/заменить
//  с детальным логом изменений и финальным подтверждением
// ════════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useCallback } from 'react';
import type { SupportRecommendation } from '../../../engines/tz-mapper-engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { ALL_STACKS } from '../../../data/support-stacks';
import { DEFAULT_DOSAGES } from '../../../data/support-meta';

// ── справочник русских названий ──
const FALLBACK_NAMES: Record<string, string> = {
  hydration:'Гидратация', cardio_aerobic:'Кардио (аэробная)', electrolyte_balance:'Электролиты Na/K/Mg',
  niacin:'Ниацин', phosphatidylserine:'Фосфатидилсерин', glycine:'Глицин',
  theanine:'L-Теанин', quercetin:'Кверцетин', garlic:'Чеснок', beetroot:'Beetroot',
  lecithin:'Лецитин', iron_bisglycinate:'Железо', tadalafil:'Тадалафил',
  agmatine:'Агматин', tmg:'Бетаин', pycnogenol:'Пикногенол', citrulline:'Цитруллин',
  bergamot:'Бергамот', astaxanthin:'Астаксантин', dandelion:'Одуванчик',
  hesperidin:'Гесперидин+Диосмин', serrapeptase:'Серрапептаза', nattokinase:'Наттокиназа',
  bromelain:'Бромелайн', anastrozole:'Анастрозол', cabergoline:'Каберголин',
  hcg:'ХГЧ', telmisartan:'Тельмисартан', tudca:'TUDCA', nac:'NAC',
  milk_thistle:'Силимарин', omega3:'Омега-3', coq10:'CoQ10', taurine:'Таурин',
  curcumin:'Куркумин', piperine:'Пиперин', berberine:'Берберин',
  astragalus:'Астрагал', cordyceps:'Кордицепс', vitamin_d3:'D3', vitamin_k2:'K2',
  magnesium:'Магний', vitamin_b6:'B6', vitamin_b12:'B12', folate:'Фолат',
  vitamin_c:'Витамин C', vitamin_e:'Витамин E', b_complex:'B-Complex',
  nebivolol:'Небиволол', chromium:'Хром', tamoxifen:'Тамоксифен',
  spironolactone:'Спиронолактон', hydrochlorothiazide:'Гидрохлоротиазид',
  indapamide:'Индапамид', melatonin:'Мелатонин', calcium:'Кальций',
  metformin:'Метформин', potassium:'Калий', leucine:'Лейцин',
  saw_palmetto:'Saw Palmetto', alpha_lipoic:'α-Липоевая', l_carnitine:'L-Карнитин',
  d_mannose:'Д-манноза',
};
function subNameRu(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  return e?.nameRu || e?.name || FALLBACK_NAMES[id] || FALLBACK_NAMES[id?.toLowerCase()] || id;
}

// ── типы лога изменений ──
interface ChangeEntry {
  type: 'added' | 'removed' | 'replaced';
  substanceId: string;
  replacedWith?: string;
  reason?: string;
}

interface Props {
  /** Текущий финальный список рекомендаций */
  finalRec: SupportRecommendation;
  /** Колбэк: применить изменения к плану (получает итоговый массив substanceId) */
  onApplyChanges: (subs: string[]) => void;
  /** Флаг — показывать кнопки управления */
  showControls?: boolean;
}

export const CalcSubstanceManager: React.FC<Props> = ({ finalRec, onApplyChanges, showControls = true }) => {
  // ── состояние ──
  const [mode, setMode] = useState<'idle' | 'add' | 'remove' | 'replace' | 'changes'>('idle');
  const [selectedForRemove, setSelectedForRemove] = useState<string[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [replaceSelection, setReplaceSelection] = useState<string[]>([]);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  // кэш подписи «добавлен вручную» для каждого вещества
  const [manualAdds, setManualAdds] = useState<string[]>([]);
  const [manualRemoves, setManualRemoves] = useState<string[]>([]);
  const [manualReplacements, setManualReplacements] = useState<Record<string, string>>({});

  // текущие ID в плане
  const currentIds = useMemo(() => finalRec.subs.map(s => s.substanceId), [finalRec]);

  // ── выбор из каталога (inline) ──
  const [addSearch, setAddSearch] = useState('');
  const [addTab, setAddTab] = useState<'catalog' | 'stacks' | 'favorites'>('catalog');
  const [addSelection, setAddSelection] = useState<string[]>([]);

  // ── избранное ──
  const favIds = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_support_favorites') || '[]') as string[]; } catch { return []; }
  }, []);

  // ── каталог ──
  const catalogEntries = useMemo(() => {
    const all: { id: string; name: string }[] = [];
    for (const key of Object.keys(SUPPORT_CATALOG_DATA)) {
      const e = SUPPORT_CATALOG_DATA[key];
      if (e?.id || e?.name || e?.nameRu) {
        all.push({ id: e.id || key, name: subNameRu(e.id || key) });
      }
    }
    // fallback — часто используемые
    const extra = ['nac','tudca','omega3','coq10','curcumin','berberine','telmisartan',
      'nebivolol','astragalus','cordyceps','magnesium','vitamin_d3','vitamin_k2',
      'milk_thistle','taurine','glycine','theanine','ashwagandha','garlic',
      'nattokinase','serrapeptase','bromelain','anastrozole','cabergoline','hcg',
      'tamoxifen','spironolactone','melatonin','metformin','chromium',
    ];
    for (const id of extra) {
      if (!all.some(a => a.id === id)) all.push({ id, name: subNameRu(id) });
    }
    if (!addSearch) return all.slice(0, 30);
    const q = addSearch.toLowerCase();
    return all.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 50);
  }, [addSearch]);

  const filteredStacks = useMemo(() => {
    return ALL_STACKS.filter(s =>
      !addSearch || s.name.toLowerCase().includes(addSearch.toLowerCase()) || (s.problem || '').toLowerCase().includes(addSearch.toLowerCase())
    ).slice(0, 30);
  }, [addSearch]);

  const filteredFavs = useMemo(() => {
    const all = favIds.map(id => ({ id, name: subNameRu(id) }));
    if (!addSearch) return all.slice(0, 50);
    const q = addSearch.toLowerCase();
    return all.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 50);
  }, [favIds, addSearch]);

  // ── вспомогательные функции ──
  const toggleAddSelect = (id: string) => {
    setAddSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddFinalize = useCallback(() => {
    const ids = addSelection.filter(id => !currentIds.includes(id));
    if (ids.length === 0) return;
    setManualAdds(prev => [...new Set([...prev, ...ids])]);
    setChanges(prev => [...prev, ...ids.map(id => ({ type: 'added' as const, substanceId: id, reason: 'Ручное добавление' }))]);
    setAddSelection([]);
    setMode('changes');
  }, [addSelection, currentIds]);

  const handleRemoveFinalize = useCallback(() => {
    if (selectedForRemove.length === 0) return;
    setManualRemoves(prev => [...new Set([...prev, ...selectedForRemove])]);
    setChanges(prev => [...prev, ...selectedForRemove.map(id => ({ type: 'removed' as const, substanceId: id, reason: 'Ручное удаление' }))]);
    setSelectedForRemove([]);
    setMode('changes');
  }, [selectedForRemove]);

  const handleReplaceSelectTarget = useCallback((id: string) => {
    setReplaceTarget(id);
    setReplacePickerOpen(true);
    setReplaceSelection([]);
  }, []);

  const handleReplaceWith = useCallback((newIds: string[]) => {
    if (!replaceTarget || newIds.length === 0) return;
    const actualNew = newIds.filter(n => n !== replaceTarget);
    if (actualNew.length === 0) return;
    setManualRemoves(prev => [...new Set([...prev, replaceTarget])]);
    setManualAdds(prev => [...new Set([...prev, ...actualNew])]);
    setManualReplacements(prev => ({ ...prev, [replaceTarget]: actualNew[0] }));
    setChanges(prev => [...prev,
      { type: 'replaced', substanceId: replaceTarget, replacedWith: actualNew[0], reason: 'Ручная замена' },
      ...actualNew.slice(1).map(id => ({ type: 'added' as const, substanceId: id, reason: 'Добавлено при замене' })),
    ]);
    setReplaceTarget(null);
    setReplacePickerOpen(false);
    setReplaceSelection([]);
    setMode('changes');
  }, [replaceTarget]);

  // ── финальное подтверждение ──
  const handleConfirm = useCallback(() => {
    let finalList = [...currentIds];
    // удаляем
    for (const id of manualRemoves) {
      finalList = finalList.filter(s => s !== id);
    }
    // добавляем (только которых ещё нет)
    for (const id of manualAdds) {
      if (!finalList.includes(id)) finalList.push(id);
    }
    onApplyChanges(finalList);
    setConfirmed(true);
  }, [currentIds, manualRemoves, manualAdds, onApplyChanges]);

  const resetManager = useCallback(() => {
    setMode('idle');
    setSelectedForRemove([]);
    setReplaceTarget(null);
    setReplacePickerOpen(false);
    setReplaceSelection([]);
    setAddSelection([]);
    setAddSearch('');
    setManualAdds([]);
    setManualRemoves([]);
    setManualReplacements({});
    setChanges([]);
    setConfirmed(false);
  }, []);

  // ── подсветка если есть несохранённые изменения ──
  const hasUnsaved = changes.length > 0 && !confirmed;

  // ── стили ──
  const sBtn = (bg: string, col: string, border: string) => ({
    flex: 1, padding: '5px 4px', borderRadius: 6, fontSize: 7, fontWeight: 600,
    cursor: 'pointer', background: bg, border, color: col,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
  } as React.CSSProperties);

  const popupOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
  };
  const popupBox: React.CSSProperties = {
    width: '90%', maxWidth: 380, borderRadius: 18,
    background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  };
  const popupHeader = (col: string): React.CSSProperties => ({
    height: 3, background: `linear-gradient(90deg,${col},${col}88)`,
  });
  const popupBody: React.CSSProperties = {
    padding: '12px 14px 10px', overflowY: 'auto', flex: 1,
  };
  const stickyHeader: React.CSSProperties = {
    position: 'sticky', top: -12, zIndex: 10, background: '#1a1a1d',
    padding: '12px 14px 8px', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const tabBtn = (a: boolean, col: string): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 6, fontSize: 8, fontWeight: 700,
    cursor: 'pointer', border: 'none',
    background: a ? `${col}22` : 'rgba(255,255,255,0.04)',
    color: a ? col : 'rgba(255,255,255,0.5)',
  });

  const searchInput: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 9,
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff', boxSizing: 'border-box', marginBottom: 8, outline: 'none',
  };

  const itemBtn = (a: boolean, col: string): React.CSSProperties => ({
    display: 'block', width: '100%', padding: '7px 10px', marginBottom: 3,
    borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600,
    textAlign: 'left', border: a ? `1px solid ${col}50` : '1px solid rgba(255,255,255,0.05)',
    background: a ? `${col}15` : 'rgba(255,255,255,0.02)',
    color: a ? col : 'rgba(255,255,255,0.7)',
  });

  const primaryBtn = (col: string): React.CSSProperties => ({
    width: '100%', padding: '9px', borderRadius: 10, border: 'none',
    cursor: 'pointer', fontSize: 10, fontWeight: 700,
    background: `linear-gradient(135deg,${col},${col}cc)`, color: '#000',
  });

  // ── RENDER ──
  if (!showControls) return null;

  return (
    <div style={{ marginTop: 4 }}>
      {/* ══ Кнопки управления ══ */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <button onClick={() => { setMode('add'); setAddTab('catalog'); setAddSelection([]); setAddSearch(''); }}
            style={sBtn('rgba(0,230,138,0.1)', '#00e68a', '1px solid rgba(0,230,138,0.2)')}>
            ➕ Добавить
          </button>
          <button onClick={() => { setMode('remove'); setSelectedForRemove([]); }}
            style={sBtn('rgba(239,68,68,0.08)', '#f87171', '1px solid rgba(239,68,68,0.15)')}>
            ➖ Удалить
          </button>
          <button onClick={() => { setMode('replace'); setReplaceTarget(null); }}
            style={sBtn('rgba(99,102,241,0.08)', '#818cf8', '1px solid rgba(99,102,241,0.2)')}>
            🔄 Заменить
          </button>
        </div>
      )}

      {/* ══ ПОПАП ДОБАВЛЕНИЯ ══ */}
      {mode === 'add' && (
        <div style={popupOverlay} onClick={() => setMode('idle')}>
          <div onClick={e => e.stopPropagation()} style={popupBox}>
            <div style={popupHeader('#00e68a')} />
            <div style={popupBody}>
              <div style={stickyHeader}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 8 }}>
                  ➕ Добавить препараты
                </div>
                {/* табы */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {(['catalog','stacks','favorites'] as const).map(t => (
                    <button key={t} onClick={() => { setAddTab(t); setAddSearch(''); }} style={tabBtn(addTab === t, '#00e68a')}>
                      {t === 'catalog' ? '📋 Каталог' : t === 'stacks' ? '📦 Стек' : '⭐ Избранное'}
                    </button>
                  ))}
                </div>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  placeholder={addTab === 'catalog' ? 'Поиск препарата...' : addTab === 'stacks' ? 'Поиск стека...' : 'Поиск в избранном...'}
                  style={searchInput} autoFocus />
                {addTab === 'catalog' && !addSearch && (
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:3 }}>Показано 30. Введите поиск для остальных.</div>
                )}
              </div>

              {/* Каталог */}
              {addTab === 'catalog' && (
                <div style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: 8 }}>
                  {catalogEntries.map(entry => (
                    <button key={entry.id} onClick={() => toggleAddSelect(entry.id)}
                      style={itemBtn(addSelection.includes(entry.id), '#00e68a')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 7 }}>{addSelection.includes(entry.id) ? '✓' : '○'}</span>
                        <span style={{ flex: 1 }}>{entry.name}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{entry.id}</span>
                        {currentIds.includes(entry.id) && <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.15)', color: '#00e68a' }}>в плане</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Стеки */}
              {addTab === 'stacks' && (
                <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 8 }}>
                  {filteredStacks.map(st => {
                    const stackAdd: string[] = st.substances?.map((s: any) => (typeof s === 'string' ? s : s.id)) || [];
                    const active = stackAdd.some((id: string) => addSelection.includes(id));
                    return (
                      <div key={st.id} style={{
                        padding: '6px 8px', marginBottom: 4, borderRadius: 8,
                        background: active ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                        border: active ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{st.name}</span>
                          <button onClick={() => {
                            const ids = (st.substances?.map((s: any) => typeof s === 'string' ? s : s.id) || []).filter((id: string) => !currentIds.includes(id));
                            setChanges(prev => [...prev, ...ids.map((id: string) => ({ type: 'added' as const, substanceId: id, reason: `Стек: ${st.name}` }))]);
                            setManualAdds(prev => [...new Set([...prev, ...ids])]);
                            setMode('changes');
                          }} style={{
                            padding: '3px 8px', borderRadius: 5, fontSize: 7, fontWeight: 700,
                            cursor: 'pointer', border: 'none',
                            background: 'rgba(0,230,138,0.15)', color: '#00e68a',
                          }}>➕ Добавить стек</button>
                        </div>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{st.problem || ''}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {(st.substances?.map((s: any) => typeof s === 'string' ? s : s.id) || []).map((id: string) => (
                            <span key={id} style={{
                              fontSize: 6, padding: '1px 4px', borderRadius: 3,
                              background: currentIds.includes(id) ? 'rgba(0,230,138,0.1)' : 'rgba(99,102,241,0.1)',
                              color: currentIds.includes(id) ? '#00e68a' : '#a5b4fc',
                            }}>{subNameRu(id)}{currentIds.includes(id) ? ' ✓' : ''}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Избранное */}
              {addTab === 'favorites' && (
                <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 8 }}>
                  {filteredFavs.map(entry => (
                    <button key={entry.id} onClick={() => toggleAddSelect(entry.id)}
                      style={itemBtn(addSelection.includes(entry.id), '#fbbf24')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 7 }}>{addSelection.includes(entry.id) ? '✓' : '○'}</span>
                        <span style={{ flex: 1 }}>{entry.name}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{entry.id}</span>
                        {currentIds.includes(entry.id) && <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.15)', color: '#00e68a' }}>в плане</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Кнопки действий */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setMode('idle')} style={{
                  flex: 1, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
                }}>Отмена</button>
                {addTab !== 'stacks' && (
                  <button onClick={handleAddFinalize} disabled={addSelection.length === 0} style={{
                    flex: 2, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                    cursor: addSelection.length === 0 ? 'not-allowed' : 'pointer',
                    background: addSelection.length === 0 ? 'rgba(0,230,138,0.06)' : 'linear-gradient(135deg,#00e68a,#00c853)',
                    border: 'none', color: addSelection.length === 0 ? '#00e68a' : '#000',
                    opacity: addSelection.length === 0 ? 0.5 : 1,
                  }}>
                    ✅ Добавить ({addSelection.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ ПОПАП УДАЛЕНИЯ ══ */}
      {mode === 'remove' && (
        <div style={popupOverlay} onClick={() => setMode('idle')}>
          <div onClick={e => e.stopPropagation()} style={popupBox}>
            <div style={popupHeader('#ef4444')} />
            <div style={popupBody}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
                ➖ Удалить препараты
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                Отметьте препараты для удаления из плана:
              </div>
              {finalRec.subs.length === 0 ? (
                <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
                  Нет препаратов в плане
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 8 }}>
                  {finalRec.subs.map(s => {
                    const sid = s.substanceId;
                    const isSelected = selectedForRemove.includes(sid);
                    return (
                      <button key={sid} onClick={() => setSelectedForRemove(prev =>
                        isSelected ? prev.filter(x => x !== sid) : [...prev, sid]
                      )} style={{
                        ...itemBtn(isSelected, '#ef4444'),
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ fontSize: 10, color: isSelected ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                          {isSelected ? '✕' : '○'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, color: isSelected ? '#fca5a5' : 'var(--text)' }}>
                            {subNameRu(sid)}
                          </span>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                            {s.reason.slice(0, 40)}
                          </span>
                        </div>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>k={s.k.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setMode('idle')} style={{
                  flex: 1, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
                }}>Отмена</button>
                <button onClick={handleRemoveFinalize} disabled={selectedForRemove.length === 0} style={{
                  flex: 2, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: selectedForRemove.length === 0 ? 'not-allowed' : 'pointer',
                  background: selectedForRemove.length === 0 ? 'rgba(239,68,68,0.06)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
                  border: 'none', color: '#fff', opacity: selectedForRemove.length === 0 ? 0.5 : 1,
                }}>
                  🗑 Удалить ({selectedForRemove.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ ПОПАП ЗАМЕНЫ ══ */}
      {mode === 'replace' && !replacePickerOpen && (
        <div style={popupOverlay} onClick={() => setMode('idle')}>
          <div onClick={e => e.stopPropagation()} style={popupBox}>
            <div style={popupHeader('#818cf8')} />
            <div style={popupBody}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 8 }}>
                🔄 Заменить препарат
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                Выберите препарат для замены:
              </div>
              {finalRec.subs.length === 0 ? (
                <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
                  Нет препаратов в плане
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 8 }}>
                  {finalRec.subs.map(s => {
                    const sid = s.substanceId;
                    const isSelected = replaceTarget === sid;
                    return (
                      <button key={sid} onClick={() => setReplaceTarget(sid)}
                        style={{
                          ...itemBtn(isSelected, '#818cf8'),
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 700,
                          border: isSelected ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.15)',
                          color: isSelected ? '#818cf8' : 'transparent',
                        }}>
                          {isSelected ? '●' : ''}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: isSelected ? '#a5b4fc' : 'var(--text)', fontSize: 9 }}>
                            {subNameRu(sid)}
                          </div>
                          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{s.reason.slice(0, 50)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setMode('idle')} style={{
                  flex: 1, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
                }}>Отмена</button>
                <button onClick={() => { if (replaceTarget) { setReplacePickerOpen(true); setAddSearch(''); } }}
                  disabled={!replaceTarget} style={{
                    flex: 2, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                    cursor: !replaceTarget ? 'not-allowed' : 'pointer',
                    background: !replaceTarget ? 'rgba(99,102,241,0.06)' : 'linear-gradient(135deg,#818cf8,#6366f1)',
                    border: 'none', color: !replaceTarget ? '#818cf8' : '#000',
                    opacity: !replaceTarget ? 0.5 : 1,
                  }}>
                  Далее → выбрать замену
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ ПИКЕР ЗАМЕНЫ (выбор нового препарата) ══ */}
      {replacePickerOpen && (
        <div style={popupOverlay} onClick={() => { setReplacePickerOpen(false); setReplaceTarget(null); setMode('idle'); }}>
          <div onClick={e => e.stopPropagation()} style={popupBox}>
            <div style={popupHeader('#818cf8')} />
            <div style={popupBody}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 4 }}>
                🔄 Замена: {replaceTarget ? subNameRu(replaceTarget) : ''}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                Выберите препарат, на который заменить:
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(['catalog','favorites'] as const).map(t => (
                  <button key={t} onClick={() => setAddTab(t)} style={tabBtn(addTab === t, '#818cf8')}>
                    {t === 'catalog' ? '📋 Каталог' : '⭐ Избранное'}
                  </button>
                ))}
              </div>
              <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                placeholder="Поиск..." style={searchInput} autoFocus />

              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 8 }}>
                {(addTab === 'catalog' ? catalogEntries : filteredFavs).map(entry => {
                  if (entry.id === replaceTarget) return null;
                  const isSelected = addSelection.includes(entry.id);
                  return (
                    <button key={entry.id} onClick={() => setAddSelection(prev => isSelected ? [] : [entry.id])}
                      style={itemBtn(isSelected, '#818cf8')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 7 }}>{isSelected ? '●' : '○'}</span>
                        <span style={{ flex: 1 }}>{entry.name}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{entry.id}</span>
                        {currentIds.includes(entry.id) && <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>в плане</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setReplacePickerOpen(false); }} style={{
                  flex: 1, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
                }}>Назад</button>
                <button onClick={() => handleReplaceWith(addSelection)} disabled={addSelection.length === 0} style={{
                  flex: 2, padding: '9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  cursor: addSelection.length === 0 ? 'not-allowed' : 'pointer',
                  background: addSelection.length === 0 ? 'rgba(99,102,241,0.06)' : 'linear-gradient(135deg,#818cf8,#6366f1)',
                  border: 'none', color: addSelection.length === 0 ? '#818cf8' : '#000',
                  opacity: addSelection.length === 0 ? 0.5 : 1,
                }}>
                  ✅ Подтвердить замену
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ КАРТОЧКА ИЗМЕНЕНИЙ ══ */}
      {mode === 'changes' && (
        <div style={{
          marginBottom: 6, padding: '8px 10px', borderRadius: 12,
          background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.2)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📝</span>
            <span>Изменения в плане ({changes.length})</span>
          </div>

          {/* детальный лог */}
          <div style={{ marginBottom: 8 }}>
            {changes.filter(c => c.type === 'removed').length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>
                  🗑 Удалено ({changes.filter(c => c.type === 'removed').length}):
                </div>
                {changes.filter(c => c.type === 'removed').map((c, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#fca5a5', paddingLeft: 8, marginBottom: 1 }}>
                    • {subNameRu(c.substanceId)} {c.reason ? `— ${c.reason}` : ''}
                  </div>
                ))}
              </div>
            )}

            {changes.filter(c => c.type === 'added').length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a', marginBottom: 2 }}>
                  ➕ Добавлено ({changes.filter(c => c.type === 'added').length}):
                </div>
                {changes.filter(c => c.type === 'added').map((c, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#86efac', paddingLeft: 8, marginBottom: 1 }}>
                    • {subNameRu(c.substanceId)} {c.reason ? `— ${c.reason}` : ''}
                  </div>
                ))}
              </div>
            )}

            {changes.filter(c => c.type === 'replaced').length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#818cf8', marginBottom: 2 }}>
                  🔄 Заменено ({changes.filter(c => c.type === 'replaced').length}):
                </div>
                {changes.filter(c => c.type === 'replaced').map((c, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#a5b4fc', paddingLeft: 8, marginBottom: 1 }}>
                    • {subNameRu(c.substanceId)} → {c.replacedWith ? subNameRu(c.replacedWith) : '?'} {c.reason ? `— ${c.reason}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!confirmed ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={resetManager} style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 8, fontWeight: 600,
                cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
              }}>✕ Отменить</button>
              <button onClick={handleConfirm} style={{
                flex: 2, padding: '8px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                ✅ Подтвердить и применить
              </button>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#00e68a',
              padding: '6px', borderRadius: 8, background: 'rgba(0,230,138,0.1)',
              border: '1px solid rgba(0,230,138,0.2)',
            }}>
              ✓ Изменения подтверждены и применены к плану
            </div>
          )}
        </div>
      )}

      {/* ══ ИНДИКАТОР НЕСОХРАНЁННЫХ ИЗМЕНЕНИЙ ══ */}
      {hasUnsaved && mode === 'idle' && (
        <div style={{
          marginBottom: 6, padding: '6px 9px', borderRadius: 8,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>📝</span>
          <span style={{ flex: 1, fontSize: 8, color: '#fbbf24' }}>
            Есть несохранённые изменения ({changes.length})
          </span>
          <button onClick={() => setMode('changes')} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 7, fontWeight: 700,
            cursor: 'pointer', border: 'none',
            background: 'rgba(245,158,11,0.2)', color: '#fbbf24',
          }}>Показать</button>
          <button onClick={resetManager} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 7, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: 'rgba(239,68,68,0.1)', color: '#f87171',
          }}>✕</button>
        </div>
      )}
    </div>
  );
};
