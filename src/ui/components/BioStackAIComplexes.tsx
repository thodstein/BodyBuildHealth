import React, { useState, useMemo } from 'react';
import { SUPPLEMENT_COMPOSITION, COMPLEX_NAMES } from '../../data/support-meta';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { decomposeComplex } from '../../engines/biostack-clinical-v2.engine';
import { findComplexForStack, type ComplexMatch } from '../../engines/supplement-finder.engine';
import { GlassCard, showToast } from './BioStackAIConstants';

interface Props { stackIds: string[]; setStackIds: (ids: string[]) => void; }

function cn(id: string): string {
  return COMPLEX_NAMES[id] || SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id;
}

export const ComplexTab: React.FC<Props> = ({ stackIds, setStackIds }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'catalog' | 'assemble' | 'decompose'>('catalog');

  // ── Каталог комплексов ──
  const catalog = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = Object.keys(SUPPLEMENT_COMPOSITION).map(id => {
      const comps = decomposeComplex(id);
      const fallback = SUPPLEMENT_COMPOSITION[id] || [];
      const components = comps.length > 0
        ? comps
        : fallback.map(cid => ({ componentId: cid, componentName: cn(cid) }));
      return { id, name: cn(id), description: SUPPORT_CATALOG_DATA[id]?.description || '', components };
    });
    if (!q) return all;
    return all.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) ||
      c.components.some(cp => cp.componentName.toLowerCase().includes(q)));
  }, [query]);

  // ── Сборка стека в комплексы (обратное: stack → complex) ──
  const stackMatches = useMemo(() => {
    if (stackIds.length < 2) return [];
    return findComplexForStack(stackIds);
  }, [stackIds]);

  // ── Разборка: какие комплексы сейчас в стеке ──
  const complexesInStack = useMemo(() => {
    return stackIds.filter(id => SUPPLEMENT_COMPOSITION[id]);
  }, [stackIds]);

  // ── Действия ──
  const addComplex = (cid: string) => {
    if (stackIds.includes(cid)) {
      setStackIds(stackIds.filter(s => s !== cid));
    } else {
      setStackIds([...stackIds, cid]);
    }
  };

  const replaceWithComplex = (match: ComplexMatch) => {
    const remaining = stackIds.filter(id => !match.matchedIds.includes(id));
    if (!remaining.includes(match.complexId)) remaining.push(match.complexId);
    setStackIds(remaining);
    showToast(`🔄 Заменено ${match.matchedIds.length} веществ на ${match.complexName}`, 'success');
  };

  const decomposeOne = (cid: string) => {
    const comps = decomposeComplex(cid);
    const ids = comps.length > 0
      ? comps.map(c => c.componentId)
      : (SUPPLEMENT_COMPOSITION[cid] || []);
    const remaining = stackIds.filter(id => id !== cid);
    const newIds = [...remaining, ...ids.filter(id => !remaining.includes(id))];
    setStackIds(newIds);
    if (ids.length > 0) showToast(`🧪 ${cn(cid)} разобран на ${ids.length} компонентов`, 'success');
  };

  const decomposeAll = () => {
    const allIds = new Set(stackIds);
    for (const cid of complexesInStack) {
      allIds.delete(cid);
      const comps = decomposeComplex(cid);
      const ids = comps.length > 0
        ? comps.map(c => c.componentId)
        : (SUPPLEMENT_COMPOSITION[cid] || []);
      ids.forEach(id => allIds.add(id));
    }
    setStackIds([...allIds]);
    showToast(`🧪 Разобрано ${complexesInStack.length} комплексов`, 'success');
  };

  return (
    <div style={{ padding: '4px 0 60px' }}>
      {/* ── Header ── */}
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24', marginBottom: 4 }}>🧪 Комплексы</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 10, lineHeight: 1.4 }}>
        Сборка нескольких препаратов в один комплекс или разборка комплекса на отдельные компоненты
      </div>

      {/* ── Mode tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[
          { id:'catalog' as const, label:'📚 Каталог', count: Object.keys(SUPPLEMENT_COMPOSITION).length },
          { id:'assemble' as const, label:'🧩 Собрать в комплекс', count: stackMatches.length },
          { id:'decompose' as const, label:'🔬 Разобрать комплекс', count: complexesInStack.length },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, border: 'none',
            background: mode === m.id ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
            color: mode === m.id ? '#fbbf24' : 'rgba(255,255,255,0.5)',
            borderLeft: mode === m.id ? '3px solid #fbbf24' : '3px solid transparent',
            transition: 'all 0.15s',
          }}>
            <div>{m.label}</div>
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>{m.count} шт</div>
          </button>
        ))}
      </div>

      {/* ── CATALOG MODE ── */}
      {mode === 'catalog' && (
        <>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Поиск по комплексу или компоненту..."
            style={{ width:'100%',padding:'10px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box',marginBottom:12 }} />
          {catalog.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 24 }}>Комплексы не найдены</div>
          ) : catalog.map(c => {
            const inStack = stackIds.includes(c.id);
            const isComplex = !!SUPPLEMENT_COMPOSITION[c.id];
            return (
              <div key={c.id} style={{
                padding: '12px 14px', marginBottom: 8, borderRadius: 14,
                background: inStack ? 'rgba(34,197,94,0.06)' : 'rgba(251,191,36,0.04)',
                border: `1px solid ${inStack ? 'rgba(34,197,94,0.22)' : 'rgba(251,191,36,0.12)'}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6, gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 9, color:'rgba(255,255,255,0.35)', marginTop:2, lineHeight:1.3 }}>{c.description.slice(0, 100)}{c.description.length>100?'…':''}</div>}
                  </div>
                  <div style={{ display:'flex', gap: 4, flexShrink: 0 }}>
                    {isComplex && (
                      <button onClick={(e) => { e.stopPropagation(); decomposeOne(c.id); }} title="Разобрать на компоненты" style={{
                        padding:'6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                        background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#a78bfa',
                      }}>🔬</button>
                    )}
                    <button onClick={() => addComplex(c.id)} style={{
                      padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700, border: 'none',
                      background: inStack ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                      color: inStack ? '#22c55e' : '#fbbf24',
                    }}>{inStack ? '✓ В стеке' : '＋ В стек'}</button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize: 9, color:'rgba(255,255,255,0.4)', alignSelf:'center' }}>Состав ({c.components.length}):</span>
                  {c.components.slice(0, 6).map((cp, j) => (
                    <span key={j} style={{
                      padding: '2px 7px', borderRadius: 5, fontSize: 9,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.55)',
                    }}>{cp.componentName}</span>
                  ))}
                  {c.components.length > 6 && <span style={{ fontSize: 8, color:'rgba(255,255,255,0.25)', alignSelf:'center' }}>+{c.components.length-6}</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── ASSEMBLE MODE: stack → complex ── */}
      {mode === 'assemble' && (
        <>
          {stackIds.length < 2 ? (
            <GlassCard title="🧩 Сборка в комплекс" icon="🧩" color="#f59e0b">
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                Добавьте 2+ веществ в стек — система найдёт комплексы, которые могут заменить несколько препаратов сразу.
                Меньше капсул, проще приём, дешевле.
              </div>
            </GlassCard>
          ) : stackMatches.length === 0 ? (
            <GlassCard title="🧩 Комплексы для вашего стека" icon="🧩" color="#f59e0b">
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                Для текущего состава стека ({stackIds.length} веществ) не найдено подходящих комплексов.
                Попробуйте поискать в каталоге или добавить другие вещества.
              </div>
            </GlassCard>
          ) : (
            <GlassCard title={`🧩 Комплексы для стека (${stackMatches.length})`} icon="🧩" color="#f59e0b">
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 1.3 }}>
                Комплексы, покрывающие вещества вашего стека. Замена уменьшает количество капсул.
              </div>
              {stackMatches.map(m => (
                <div key={m.complexId} style={{
                  padding: '12px 14px', marginBottom: 8, borderRadius: 14,
                  background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color:'#fbbf24', marginBottom: 2 }}>{m.complexName}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                        Покрытие: {Math.round(m.coverage * 100)}% · {m.matchedIds.length}/{m.totalComponents} компонентов
                      </div>
                    </div>
                    <button onClick={() => replaceWithComplex(m)} style={{
                      flexShrink: 0, padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#000',
                    }}>🔄 Заменить</button>
                  </div>
                  <div style={{ fontSize: 10, color:'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                    {m.explanation}
                  </div>
                  <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop: 4 }}>
                    {m.matchedIds.map(id => (
                      <span key={id} style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 8,
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.15)',
                      }}>{cn(id)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </>
      )}

      {/* ── DECOMPOSE MODE: complex → components ── */}
      {mode === 'decompose' && (
        <>
          {complexesInStack.length === 0 ? (
            <GlassCard title="🔬 Разборка комплексов" icon="🔬" color="#a78bfa">
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                В вашем стеке нет комплексов. Добавьте комплекс во вкладке «📚 Каталог» — здесь вы сможете разобрать его на отдельные компоненты.
              </div>
            </GlassCard>
          ) : (
            <GlassCard title={`🔬 Разборка (${complexesInStack.length} комплексов)`} icon="🔬" color="#a78bfa">
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 1.3 }}>
                Разберите комплексы на отдельные препараты для гибкой настройки доз и тайминга.
              </div>
              {complexesInStack.map(cid => {
                const comps = decomposeComplex(cid);
                const ids = comps.length > 0
                  ? comps.map(c => c.componentId)
                  : (SUPPLEMENT_COMPOSITION[cid] || []);
                return (
                  <div key={cid} style={{
                    padding: '12px 14px', marginBottom: 8, borderRadius: 14,
                    background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color:'#c4b5fd' }}>{cn(cid)}</div>
                      <button onClick={() => decomposeOne(cid)} style={{
                        padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700, border: 'none',
                        background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
                      }}>🔬 Разобрать</button>
                    </div>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize: 9, color:'rgba(255,255,255,0.4)', alignSelf:'center' }}>→ Компоненты ({ids.length}):</span>
                      {ids.slice(0, 8).map(cid2 => (
                        <span key={cid2} style={{
                          padding: '2px 7px', borderRadius: 5, fontSize: 9,
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.55)',
                        }}>{cn(cid2)}</span>
                      ))}
                      {ids.length > 8 && <span style={{ fontSize: 8, color:'rgba(255,255,255,0.25)', alignSelf:'center' }}>+{ids.length-8}</span>}
                    </div>
                  </div>
                );
              })}
              {complexesInStack.length > 1 && (
                <button onClick={decomposeAll} style={{
                  width: '100%', padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, border: 'none',
                  background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
                }}>🔬 Разобрать все комплексы</button>
              )}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
};
