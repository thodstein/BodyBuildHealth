import React, { useState, useMemo, useCallback, useRef } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { explainStack, findReplacement, type ReplacementResult } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS } from '../../data/support-database';
import { GlassCard, StatBox, ORGANS, toFinderProfile } from './BioStackAIConstants';

export function StackTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    const fp = toFinderProfile(profile);
    return explainStack(stackIds, fp);
  }, [stackIds, profile]);

  const [replaceState, setReplaceState] = useState<Record<string, { open: boolean; results: ReplacementResult[]; loading: boolean }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);
  const [savedStacks, setSavedStacks] = useState<string[][]>(() => {
    try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; }
  });

  const handleRemove = useCallback((id: string) => {
    setStackIds(stackIds.filter(s => s !== id));
  }, [stackIds, setStackIds]);

  const handleOpenReplace = useCallback((id: string) => {
    if (replaceState[id]?.open) { setReplaceState(prev => ({ ...prev, [id]: { ...prev[id], open: false } })); return; }
    setReplaceState(prev => ({ ...prev, [id]: { open: true, results: [], loading: true } }));
    const fp = toFinderProfile(profile);
    const results = findReplacement(id, 'functional', fp);
    setReplaceState(prev => ({ ...prev, [id]: { open: true, results, loading: false } }));
  }, [profile, replaceState]);

  const handleReplace = useCallback((oldId: string, newId: string) => {
    setStackIds(stackIds.map(s => s === oldId ? newId : s));
    setReplaceState(prev => ({ ...prev, [oldId]: { open: false, results: [], loading: false } }));
  }, [stackIds, setStackIds]);

  const handleSaveStack = useCallback(() => {
    if (stackIds.length === 0) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [stackIds, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
    setSavedStacks(updated);
  }, [stackIds]);

  const handleClear = useCallback(() => {
    setStackIds([]);
  }, [setStackIds]);

  /* ── Drag & Drop ── */
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragNode.current = idx;
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedIdx(idx), 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = dragNode.current;
    if (fromIdx === null || fromIdx === toIdx) { setDraggedIdx(null); setDropTarget(null); return; }
    const arr = [...stackIds];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setStackIds(arr);
    setDraggedIdx(null);
    setDropTarget(null);
    dragNode.current = null;
  }, [stackIds, setStackIds]);

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null);
    setDropTarget(null);
    dragNode.current = null;
  }, []);

  const catLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c;

  const cardHeaderS: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
    padding: '12px 14px', borderRadius: 12,
    background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)',
  };
  const cardBodyS: React.CSSProperties = {
    padding: '0 14px 14px', marginTop: -6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    background: 'rgba(24,24,27,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none',
  };

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5, marginBottom: 16 }}>
          Добавьте препараты через 🔍 Поиск или 🧩 Сборка
        </div>
        {savedStacks.length > 0 && (
          <GlassCard title="💾 Сохранённые стеки" icon="📂" color="#8b5cf6">
            {savedStacks.map((stk, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Стек #{i + 1} ({stk.length} шт)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setStackIds(stk)}
                    style={{ padding: '4px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                    📥 Загрузить
                  </button>
                  <button onClick={() => {
                    const updated = savedStacks.filter((_, j) => j !== i);
                    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
                    setSavedStacks(updated);
                  }}
                    style={{ padding: '4px 8px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </GlassCard>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title={`📋 Стек • ${stackIds.length} компонентов`} icon="📊" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          <StatBox label="Компонентов" value={stackIds.length} color="#00e68a" />
          <StatBox label="Синергия" value={explanation?.totalSynergyScore ?? 0} color="#8b5cf6" />
          <StatBox label="Покрытие" value={`${explanation?.completeness ?? 0}%`} color="#60a5fa" />
          <StatBox label="С дозой" value={`${explanation?.totalDoseCount ?? 0}/${stackIds.length}`} color="#f59e0b" />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleSaveStack} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a',
          }}>💾 Сохранить стек</button>
          <button onClick={handleClear} style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
          }}>🗑 Очистить</button>
        </div>
      </GlassCard>

      {explanation?.warnings && explanation.warnings.length > 0 && (
        <GlassCard title="⚠ Предупреждения" icon="⚠" color="#ef4444">
          {explanation.warnings.slice(0, 6).map((w, i) => (
            <div key={i} style={{ fontSize: 9, color: '#f87171', lineHeight: 1.4, padding: '2px 0' }}>• {w}</div>
          ))}
        </GlassCard>
      )}

      {explanation?.substances.map((entry, idx) => {
        const cat = SUPPORT_CATALOG_DATA[entry.id];
        if (!cat) return null;
        const isExpanded = expanded[entry.id];
        const replace = replaceState[entry.id];
        const isDragging = draggedIdx === idx;
        const isDropOver = dropTarget === idx && draggedIdx !== idx;
        const synergiesInStack = explanation.substances
          .filter(s => s.id !== entry.id)
          .map(s => {
            const found = entry.synergiesWith.find(x => x.with === s.id);
            return found ? { name: s.name || '', effect: found.effect } : null;
          })
          .filter((x): x is { name: string; effect: string } => x !== null);

        return (
          <div key={entry.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, idx)} onDragEnd={handleDragEnd}
            className={isDragging ? 'bio-dragging' : isDropOver ? 'bio-drag-over' : ''}
            style={{ marginBottom: 8, transition: 'all 0.15s ease' }}>
          <GlassCard style={{ marginBottom: 0 }}>
            <div onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} style={cardHeaderS}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                  {cat.nameRu || cat.name}
                  <span style={{ fontSize: 8, color: '#00e68a', marginLeft: 6, fontWeight: 600 }}>({entry.role})</span>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[cat.tier, ...(cat.category?.slice(0, 2) || [])].filter(Boolean).map((c: any, i: number) => (
                    <span key={i} style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 7 }}>{catLabel(c)}</span>
                  ))}
                  <span style={{ color: '#60a5fa', fontSize: 7 }}>{cat.bestForm || (cat.forms?.find(f => f.best)?.nameRu || cat.forms?.[0]?.nameRu || '')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={cardBodyS}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 8 }}>
                  🧬 <strong style={{ color: '#a78bfa' }}>Механизм:</strong> {entry.mechanism}
                </div>

                {cat.description && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginBottom: 6 }}>
                    📝 {cat.description}
                  </div>
                )}

                {entry.dose && (
                  <div style={{ fontSize: 9, color: '#60a5fa', marginBottom: 6 }}>
                    💊 <strong>Дозировка:</strong> {entry.dose}
                  </div>
                )}
                {cat.dosage && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    ⏱ {cat.dosage.timing ? `Приём: ${cat.dosage.timing}` : ''} {cat.dosage.mg ? `• ${cat.dosage.mg} мг${cat.dosage.form ? ' (' + cat.dosage.form + ')' : ''}` : ''}
                  </div>
                )}

                {synergiesInStack.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600, marginBottom: 2 }}>🤝 Синергии в стеке:</div>
                    {synergiesInStack.map((s, i) => (
                      <div key={i} style={{ fontSize: 8, color: '#a78bfa', lineHeight: 1.3 }}>• {s.name} → {s.effect}</div>
                    ))}
                  </div>
                )}

                {cat.organs && cat.organs.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    {cat.organs.map((o: string, i: number) => (
                      <span key={i} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', color: '#60a5fa', fontSize: 7 }}>
                        {ORGANS.find(x => x.key === o)?.label || o}
                      </span>
                    ))}
                  </div>
                )}

                {cat.contraindications && cat.contraindications.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Противопоказания:</div>
                    <div style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>{cat.contraindications.slice(0, 3).join(', ')}</div>
                  </div>
                )}

                {cat.sideEffects && cat.sideEffects.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.06)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>⚡ Побочные:</div>
                    <div style={{ fontSize: 8, color: '#fbbf24', lineHeight: 1.3 }}>{cat.sideEffects.slice(0, 3).join(', ')}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button onClick={() => handleOpenReplace(entry.id)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#8b5cf6',
                  }}>
                    {replace?.open ? '✕ Закрыть замены' : '🔄 Заменить'}
                  </button>
                  <button onClick={() => handleRemove(entry.id)} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
                  }}>✕ Удалить</button>
                </div>

                {replace?.open && (
                  <div style={{ marginTop: 8 }}>
                    {replace.loading ? (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>Загрузка замен...</div>
                    ) : replace.results.length > 0 ? (
                      <>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>🔁 Рекомендуемые замены:</div>
                        {replace.results.slice(0, 6).map((r, i) => (
                          <div key={i} onClick={() => handleReplace(entry.id, r.replacementId)}
                            style={{
                              padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                              background: r.personalMatch ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${r.personalMatch ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'}`,
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{r.replacementName}</span>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                                  background: r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.1)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: r.tierChange === 'upgrade' ? '#00e68a' : r.tierChange === 'downgrade' ? '#ef4444' : 'rgba(255,255,255,0.3)',
                                }}>
                                  {r.tierChange === 'upgrade' ? '↑ UPGRADE' : r.tierChange === 'downgrade' ? '↓ DOWNGRADE' : '∼ SAME'}
                                </span>
                                <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                                  background: r.priceDelta === 'cheaper' ? 'rgba(0,230,138,0.1)' : r.priceDelta === 'expensive' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: r.priceDelta === 'cheaper' ? '#00e68a' : r.priceDelta === 'expensive' ? '#ef4444' : 'rgba(255,255,255,0.3)',
                                }}>
                                  {r.priceDelta === 'cheaper' ? '💰 Дешевле' : r.priceDelta === 'expensive' ? '💰 Дороже' : '💰 ∼'}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{r.reason}</div>
                            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>
                              {r.explanation}
                              {r.bestForm && <span style={{ color: '#60a5fa' }}> • 💊 {r.bestForm}</span>}
                            </div>
                            {r.safetyNote && (
                              <div style={{ fontSize: 7, color: '#f59e0b', marginTop: 2 }}>🛡️ {r.safetyNote}</div>
                            )}
                            {r.personalMatch && (
                              <div style={{ fontSize: 7, color: '#00e68a', marginTop: 2 }}>🎯 Персональная рекомендация</div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 8 }}>Нет подходящих замен</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.12)', textAlign: 'center', padding: '1px 0' }}>⠿</div>
          </div>
        );
      })}
    </div>
  );
}
