import React, { useState, useMemo, useCallback, useRef } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, findReplacement, type ReplacementResult } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS, ALL_INTERACTIONS } from '../../data/support-database';
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

  /* ── Compliance Tracker ── */
  const todayKey = new Date().toISOString().slice(0, 10);
  const [compliance, setCompliance] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_compliance') || '{}'); } catch { return {}; }
  });
  const todayTaken = compliance[todayKey] || [];

  const toggleTaken = useCallback((id: string) => {
    setCompliance(prev => {
      const taken = prev[todayKey] || [];
      const next = taken.includes(id) ? taken.filter(x => x !== id) : [...taken, id];
      const updated = { ...prev, [todayKey]: next };
      localStorage.setItem('he_biostack_compliance', JSON.stringify(updated));
      return updated;
    });
  }, [todayKey]);

  const todayPct = stackIds.length > 0 ? Math.round(todayTaken.length / stackIds.length * 100) : 0;
  const streakDays = (() => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const k = d.toISOString().slice(0, 10);
      const t = compliance[k];
      if (!t || t.length === 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  })();

  /* ── Stack Actions ── */
  const [actionResult, setActionResult] = useState<{ title: string; text: string; resultStack?: string[] } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const ACTIONS: { id: string; label: string; icon: string; color: string; run: () => void }[] = useMemo(() => [
    { id: 'best', label: 'Собрать лучший', icon: '🏆', color: '#8b5cf6',
      run: () => {
        setActionLoading('best');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const r = buildStack({ baseIds: [], targetSize: profile.maxStackSize || 10, autoFill: true, profile: fp });
          const exp = explainStack(r.stack, fp);
          const lines = r.stack.map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• ${c?.nameRu || c?.name || id}`; });
          setActionResult({ title: '🏆 Лучший стек под ваш профиль', text: `Состав (${r.stack.length} компонентов):\n${lines.join('\n')}\n\nСинергия: ${exp.totalSynergyScore}\nПокрытие: ${exp.completeness}%`, resultStack: r.stack });
          setActionLoading(null);
        }, 400);
      }},
    { id: 'optimize', label: 'Оптимизировать', icon: '⚡', color: '#f59e0b',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('optimize');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const r = buildStack({ baseIds: stackIds, targetSize: Math.max(stackIds.length, 10), autoFill: true, profile: fp });
          const exp = explainStack(r.stack, fp);
          const added = r.stack.filter(id => !stackIds.includes(id));
          const lines = added.map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• ${c?.nameRu || c?.name || id} (добавлен)`; });
          setActionResult({ title: '⚡ Оптимизированный стек', text: `Добавлено ${added.length} компонентов:\n${lines.join('\n')}\n\nСинергия: ${exp.totalSynergyScore} (было ${explanation?.totalSynergyScore ?? 0})\nПокрытие: ${exp.completeness}% (было ${explanation?.completeness ?? 0}%)`, resultStack: r.stack });
          setActionLoading(null);
        }, 400);
      }},
    { id: 'risks', label: 'Убрать риски', icon: '🛡️', color: '#ef4444',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('risks');
        setTimeout(() => {
          const risky = new Set<string>();
          for (const a of stackIds) {
            for (const b of stackIds) {
              if (a === b) continue;
              const pair = ALL_INTERACTIONS.find(inx =>
                (inx.substanceA === a && inx.substanceB === b) || (inx.substanceA === b && inx.substanceB === a));
              if (pair && pair.severity === 'HIGH' && (pair.type === 'conflict' || pair.type === 'caution')) {
                risky.add(a); risky.add(b);
              }
            }
          }
          const clean = stackIds.filter(id => !risky.has(id));
          if (clean.length === stackIds.length) {
            setActionResult({ title: '🛡️ Риски не найдены', text: 'В вашем стеке нет критических взаимодействий.' });
          } else {
            const lines = stackIds.filter(id => risky.has(id)).map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• ${c?.nameRu || c?.name || id} (удалён)`; });
            setActionResult({ title: `🛡️ Убрано ${risky.size} рискованных компонентов`, text: `Удалены:\n${lines.join('\n')}\n\nОсталось: ${clean.length} компонентов`, resultStack: clean });
          }
          setActionLoading(null);
        }, 300);
      }},
    { id: 'cheaper', label: 'Сделать дешевле', icon: '💰', color: '#22c55e',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('cheaper');
        setTimeout(() => {
          const P: Record<string, number> = { nac: 650, tudca: 900, omega3: 800, coq10: 1200, magnesium: 350, zinc: 200, vitamin_d3: 300, curcumin: 500, alpha_lipoic: 700, ashwagandha: 600, rhodiola: 550, theanine: 450, creatine: 400, l_carnitine: 700, lions_mane: 900, tongkat_ali: 1200, collagen: 1200, probiotics: 1200, berberine: 600 };
          const ALT: Record<string, string[]> = { omega3: ['flax_oil', 'chia'], coq10: ['idebenone', 'pqq'], probiotics: ['kefir', 'sauerkraut'], collagen: ['bone_broth', 'gelatin'], ashwagandha: ['rhodiola', 'schisandra'], lions_mane: ['alpha_gpc', 'phosphatidylserine'], tongkat_ali: ['fadogia', 'shilajit'] };
          const swaps: string[] = [];
          const ns = [...stackIds];
          for (let i = 0; i < ns.length; i++) {
            const id = ns[i];
            const alts = ALT[id];
            if (alts) {
              const ch = alts.find(a => (P[a] || 999) < (P[id] || 999));
              if (ch && SUPPORT_CATALOG_DATA[ch]) {
                swaps.push(`• ${SUPPORT_CATALOG_DATA[id]?.nameRu || id} (${P[id]}₽) → ${SUPPORT_CATALOG_DATA[ch]?.nameRu || ch} (${P[ch]}₽) — экономия ${P[id] - (P[ch]||0)}₽/мес`);
                ns[i] = ch;
              }
            }
          }
          if (swaps.length === 0) {
            setActionResult({ title: '💰 Оптимизация стоимости', text: 'Не найдено более дешёвых аналогов в базе.' });
          } else {
            setActionResult({ title: `💰 ${swaps.length} замен на более дешёвые`, text: swaps.join('\n'), resultStack: ns });
          }
          setActionLoading(null);
        }, 300);
      }},
    { id: 'why', label: 'Почему мне хуже', icon: '🤔', color: '#60a5fa',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('why');
        setTimeout(() => {
          const issues: string[] = [];
          for (const id of stackIds) {
            const cat = SUPPORT_CATALOG_DATA[id];
            if (!cat) continue;
            const organs = (cat as any).organs || (cat as any).targetOrgans || [];
            if (profile.healthConditions?.includes('hypertension' as any) && organs.some((o: string) => ['HEART', 'VESSELS'].includes(o))) {
              issues.push(`• ${cat.nameRu || cat.name} — влияет на ССС. При гипертонии — контроль давления.`);
            }
            if (organs.some((o: string) => ['LIVER'].includes(o)) && profile.goals?.includes('liver_health' as any)) {
              issues.push(`• ${cat.nameRu || cat.name} — ✅ поддерживает печень, совпадает с целями.`);
            }
            if (!cat.dosage) {
              issues.push(`• ${cat.nameRu || cat.name} — ⚠ нет дозировки.`);
            }
          }
          if (issues.length === 0) issues.push('✅ Все компоненты соответствуют профилю.');
          setActionResult({ title: '🤔 Анализ совместимости с профилем', text: issues.join('\n\n') });
          setActionLoading(null);
        }, 400);
      }},
  ], [stackIds, profile, explanation]);

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

      {/* ✅ Compliance Check */}
      <GlassCard title={`✅ Комплаенс • ${todayPct}% сегодня`} icon="✅" color="#22c55e">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: todayPct + '%', height: '100%', borderRadius: 3, background: todayPct >= 80 ? '#22c55e' : todayPct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: todayPct >= 80 ? '#22c55e' : todayPct >= 50 ? '#f59e0b' : '#ef4444' }}>{todayTaken.length}/{stackIds.length}</span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>🔥 {streakDays} дней</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {stackIds.map(id => {
            const cat = SUPPORT_CATALOG_DATA[id];
            const taken = todayTaken.includes(id);
            return (
              <button key={id} onClick={() => toggleTaken(id)} style={{
                padding: '4px 8px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: taken ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${taken ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                color: taken ? '#22c55e' : 'rgba(255,255,255,0.4)',
                textDecoration: taken ? 'line-through' : 'none',
              }}>
                {taken ? '✅' : '○'} {cat?.nameRu || cat?.name || id}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
          Нажмите на препарат, чтобы отметить как принятый
        </div>
      </GlassCard>

      {/* 🚀 Stack Actions */}
      <GlassCard title="🚀 Действия со стеком" icon="🚀" color="#8b5cf6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {ACTIONS.map(btn => (
            <button key={btn.id} onClick={btn.run} disabled={actionLoading !== null} style={{
              padding: '8px 6px', borderRadius: 10, fontSize: 8, fontWeight: 700, cursor: actionLoading ? 'wait' : 'pointer',
              background: actionLoading === btn.id ? `${btn.color}15` : `${btn.color}08`,
              border: `1px solid ${actionLoading === btn.id ? btn.color : btn.color + '25'}`,
              color: actionLoading === btn.id ? btn.color : btn.color,
              transition: 'all 0.15s',
            }}>
              {actionLoading === btn.id ? '⏳' : btn.icon} {btn.label}
            </button>
          ))}
        </div>

        {actionResult && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{actionResult.title}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{actionResult.text}</div>
            {actionResult.resultStack && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button onClick={() => { setStackIds(actionResult.resultStack!); setActionResult(null); }} style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                  background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
                }}>📥 Применить стек</button>
                <button onClick={() => setActionResult(null)} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                }}>✕</button>
              </div>
            )}
            {!actionResult.resultStack && (
              <button onClick={() => setActionResult(null)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer', marginTop: 4,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
              }}>✕ Закрыть</button>
            )}
          </div>
        )}
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
