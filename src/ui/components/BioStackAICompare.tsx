import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard, estCost, showToast } from './BioStackAIConstants';
import { toFinderProfile } from './BioStackAIConstants';
import { PopupSelect } from './PopupXxx';

type CompareView = 'all' | 'price' | 'mechanisms' | 'synergy' | 'coverage';

const MECH_TRANSLATIONS_RU: Record<string, string> = {
  ANTIOXIDANT: 'Антиоксидант', GLUTATHIONE_SYNTHESIS: 'Синтез глутатиона',
  NRF2_ACTIVATION: 'Активация Nrf2', AMPK_ACTIVATION: 'Активация AMPK',
  BILE_FLOW_STIMULATION: 'Желчеотток', MEMBRANE_STABILIZATION: 'Мембраны',
  ER_STRESS_REDUCTION: 'ER-стресс', NEUROPROTECTION: 'Нейропротекция',
  COLLAGEN_SYNTHESIS: 'Коллаген', ANTI_INFLAMMATORY: 'Противовоспалительное',
  MITOCHONDRIAL: 'Митохондрии', NITRIC_OXIDE: 'NO',
  DOPAMINE: 'Дофамин', SEROTONIN: 'Серотонин', GABAERGIC: 'GABA',
  CORTISOL: 'Кортизол', TESTOSTERONE: 'Тестостерон', BDNF: 'BDNF',
  LIVER_DETOX: 'Детокс печени', ADAPTOGEN: 'Адаптоген'
};

function resolveMech(m: string): string {
  return MECH_TRANSLATIONS_RU[m] || m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CompareTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [stackB, setStackB] = useState<string[]>(() => {
    try { const s = localStorage.getItem('he_biostack_compare_b'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [showStackBPicker, setShowStackBPicker] = useState(false);
  const [view, setView] = useState<CompareView>('all');

  // Save stackB to localStorage
  const setStackBAndSave = useCallback((ids: string[]) => {
    setStackB(ids);
    localStorage.setItem('he_biostack_compare_b', JSON.stringify(ids));
  }, []);

  // Collect all stacks from localStorage
  const savedStacks = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_my_stacks');
      if (!raw) return [] as { name: string; ids: string[] }[];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((s: any) => Array.isArray(s.substances) || Array.isArray(s.ids)).map((s: any) => ({
        name: s.name || 'Стек без названия',
        ids: s.substances || s.ids || []
      })) : [];
    } catch { return []; }
  }, []);

  const curExp = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const bExp = useMemo(() => {
    if (stackB.length === 0) return null;
    return explainStack(stackB, toFinderProfile(profile));
  }, [stackB, profile]);

  const curCost = useMemo(() => stackIds.reduce((s, id) => s + estCost(id), 0), [stackIds]);
  const bCost = useMemo(() => stackB.reduce((s, id) => s + estCost(id), 0), [stackB]);

  // Optimize stackB based on stackA
  const handleOptimize = useCallback(() => {
    if (stackIds.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      const fp = toFinderProfile(profile);
      const result = buildStack({
        baseIds: stackIds, targetSize: Math.max(stackIds.length, 8),
        goal: profile.goals[0] || undefined,
        autoFill: true, profile: fp,
      });
      setStackBAndSave(result.stack);
      setLoading(false);
    }, 300);
  }, [stackIds, profile, setStackBAndSave]);

  // Overlap analysis
  const overlap = useMemo(() => {
    if (stackB.length === 0) return null;
    const aSet = new Set(stackIds);
    const bSet = new Set(stackB);
    const common = stackIds.filter(id => bSet.has(id));
    const onlyA = stackIds.filter(id => !bSet.has(id));
    const onlyB = stackB.filter(id => !aSet.has(id));
    const aMechs = new Set<string>();
    const bMechs = new Set<string>();
    stackIds.forEach(id => SUPPORT_CATALOG_DATA[id]?.mechanisms?.forEach(m => aMechs.add(m)));
    stackB.forEach(id => SUPPORT_CATALOG_DATA[id]?.mechanisms?.forEach(m => bMechs.add(m)));
    const commonMechs = [...aMechs].filter(m => bMechs.has(m));
    const onlyAMechs = [...aMechs].filter(m => !bMechs.has(m));
    const onlyBMechs = [...bMechs].filter(m => !aMechs.has(m));
    return { common, onlyA, onlyB, commonMechs, onlyAMechs, onlyBMechs };
  }, [stackIds, stackB]);

  // Synergy pair analysis
  const synergyAnalysis = useMemo(() => {
    if (stackIds.length < 2 || stackB.length < 2) return null;
    const aPairs: { a: string; b: string; idA: string; idB: string }[] = [];
    const bPairs: { a: string; b: string; idA: string; idB: string }[] = [];
    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        aPairs.push({ a: SUPPORT_CATALOG_DATA[stackIds[i]]?.nameRu || stackIds[i], b: SUPPORT_CATALOG_DATA[stackIds[j]]?.nameRu || stackIds[j], idA: stackIds[i], idB: stackIds[j] });
      }
    }
    for (let i = 0; i < stackB.length; i++) {
      for (let j = i + 1; j < stackB.length; j++) {
        bPairs.push({ a: SUPPORT_CATALOG_DATA[stackB[i]]?.nameRu || stackB[i], b: SUPPORT_CATALOG_DATA[stackB[j]]?.nameRu || stackB[j], idA: stackB[i], idB: stackB[j] });
      }
    }
    return { aPairs, bPairs, aCount: aPairs.length, bCount: bPairs.length };
  }, [stackIds, stackB]);

  if (stackIds.length === 0 && stackB.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚖</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Нет стеков для сравнения</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Добавьте вещества в 🔍 Поиск, затем выберите второй стек для сравнения</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Stack A / Stack B header */}
      <GlassCard title="⚖ Сравнение стеков" icon="📊" color="#8b5cf6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: stackIds.length > 0 ? 'rgba(139,92,246,0.04)' : 'rgba(255,255,255,0.02)', border: stackIds.length > 0 ? '1px solid rgba(139,92,246,0.08)' : '1px dashed rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Стек A (текущий)</div>
            {stackIds.length > 0 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{stackIds.length} в-в</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>{curCost}₽</div>
              </>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.15)' }}>пусто</div>
            )}
          </div>
          <button onClick={handleOptimize} disabled={loading || stackIds.length === 0}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
            {loading ? '⏳' : '⚡ AI → B'}
          </button>
          <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: stackB.length > 0 ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)', border: stackB.length > 0 ? '1px solid rgba(0,230,138,0.08)' : '1px dashed rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Стек B</div>
            {stackB.length > 0 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{stackB.length} в-в</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>{bCost}₽</div>
              </>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.15)' }}>пусто</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowStackBPicker(true)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 9, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
          }}>📂 Выбрать стек B</button>
          {stackB.length > 0 && (
            <button onClick={() => setStackBAndSave([])} style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 9, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>✕</button>
          )}
        </div>
      </GlassCard>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { id: 'all' as const, label: '📊 Всё' },
          { id: 'price' as const, label: '💰 Цена' },
          { id: 'mechanisms' as const, label: '🧬 Механизмы' },
          { id: 'synergy' as const, label: '🤝 Синергия' },
          { id: 'coverage' as const, label: '🎯 Покрытие' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s',
            background: view === v.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
            border: view === v.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: view === v.id ? '#00e68a' : 'rgba(255,255,255,0.7)',
          }}>{v.label}</button>
        ))}
      </div>

      {/* ── COMPARISON OUTPUT ── */}

      {/* ALL VIEW: metrics + composition + mechanisms + price */}
      {(view === 'all') && stackB.length > 0 && overlap && (
        <>
          {/* Quick summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
            {[
              { label: 'Синергия A', value: curExp?.totalSynergyScore ?? 0, color: '#8b5cf6' },
              { label: 'Синергия B', value: bExp?.totalSynergyScore ?? 0, color: '#00e68a' },
              { label: 'Покрытие A', value: `${curExp?.completeness ?? 0}%`, color: '#8b5cf6' },
              { label: 'Покрытие B', value: `${bExp?.completeness ?? 0}%`, color: '#00e68a' },
              { label: 'Механизмы A', value: curExp?.coverage.mechanisms.length ?? 0, color: '#8b5cf6' },
              { label: 'Механизмы B', value: bExp?.coverage.mechanisms.length ?? 0, color: '#00e68a' },
              { label: 'Предупр. A', value: curExp?.warnings.length ?? 0, color: '#ef4444' },
              { label: 'Предупр. B', value: bExp?.warnings.length ?? 0, color: '#f59e0b' },
            ].map(m => (
              <div key={m.label} style={{ padding: '6px 8px', borderRadius: 8, background: m.color + '08', border: '1px solid ' + m.color + '18', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Composition diff */}
          <GlassCard title="🔍 Состав" icon="📋" color="#00e68a">
            {overlap.common.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 3 }}>✅ Общие ({overlap.common.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {overlap.common.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.1)' }}>{c?.nameRu || c?.name || id}</span>;
                  })}
                </div>
              </div>
            )}
            {overlap.onlyA.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>➖ Только в A ({overlap.onlyA.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {overlap.onlyA.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.06)', color: '#f59e0b', textDecoration: 'line-through', border: '1px solid rgba(245,158,11,0.1)' }}>{c?.nameRu || c?.name || id}</span>;
                  })}
                </div>
              </div>
            )}
            {overlap.onlyB.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 600, marginBottom: 3 }}>➕ Только в B ({overlap.onlyB.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {overlap.onlyB.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.06)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.1)' }}>{c?.nameRu || c?.name || id}</span>;
                  })}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Mechanisms */}
          <GlassCard title="🧬 Механизмы" icon="🧬" color="#a855f7">
            <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 3 }}>Общие ({overlap.commonMechs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
              {overlap.commonMechs.slice(0, 10).map(m => (
                <span key={m} style={{ fontSize: 6, padding: '2px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.1)' }}>{resolveMech(m)}</span>
              ))}
              {overlap.commonMechs.length > 10 && <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{overlap.commonMechs.length - 10}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <div>
                <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>Только в A ({overlap.onlyAMechs.length})</div>
                {overlap.onlyAMechs.slice(0, 5).map(m => (
                  <div key={m} style={{ fontSize: 6, color: '#f59e0b', padding: '1px 0' }}>{resolveMech(m)}</div>
                ))}
                {overlap.onlyAMechs.length > 5 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{overlap.onlyAMechs.length - 5}</div>}
              </div>
              <div>
                <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 2 }}>Только в B ({overlap.onlyBMechs.length})</div>
                {overlap.onlyBMechs.slice(0, 5).map(m => (
                  <div key={m} style={{ fontSize: 6, color: '#60a5fa', padding: '1px 0' }}>{resolveMech(m)}</div>
                ))}
                {overlap.onlyBMechs.length > 5 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{overlap.onlyBMechs.length - 5}</div>}
              </div>
            </div>
          </GlassCard>

          {/* Cost */}
          <GlassCard title="💰 Стоимость" icon="💰" color="#f59e0b">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 6 }}>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: 'rgba(245,158,11,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Стек A</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{curCost}₽</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: 'rgba(0,230,138,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Стек B</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>{bCost}₽</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: bCost <= curCost ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Разница</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: bCost <= curCost ? '#00e68a' : '#ef4444' }}>
                  {bCost - curCost > 0 ? '+' : ''}{bCost - curCost}₽
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...new Set([...stackIds, ...stackB])].map(id => {
                const c = SUPPORT_CATALOG_DATA[id];
                const cost = estCost(id);
                const inA = stackIds.includes(id);
                const inB = stackB.includes(id);
                const status = inA && inB ? 'both' : inA ? 'onlyA' : 'onlyB';
                const statusColor = status === 'both' ? '#4ade80' : status === 'onlyA' ? '#f59e0b' : '#60a5fa';
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.015)', fontSize: 7 }}>
                    <span style={{ color: statusColor }}>{status === 'onlyB' ? '+ ' : ''}{c?.nameRu || c?.name || id}</span>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{cost}₽</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setStackIds(stackB)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
            }}>📥 Заменить стек A на B</button>
            <button onClick={() => {
              const merged = [...new Set([...stackIds, ...stackB])];
              setStackIds(merged);
            }} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
            }}>🔀 Объединить</button>
          </div>
        </>
      )}

      {/* PRICE VIEW */}
      {view === 'price' && stackB.length > 0 && (
        <GlassCard title="💰 Детальный разбор стоимости" icon="💰" color="#f59e0b">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Стек A</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{curCost}₽</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{stackIds.length} в-в · ср. {Math.round(curCost / Math.max(stackIds.length, 1))}₽/шт</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,256,0.4)' }}>Стек B</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{bCost}₽</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{stackB.length} в-в · ср. {Math.round(bCost / Math.max(stackB.length, 1))}₽/шт</div>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: 6, display: 'flex' }}>
            <div style={{ width: `${(curCost / Math.max(curCost + bCost, 1)) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
            <div style={{ width: `${(bCost / Math.max(curCost + bCost, 1)) * 100}%`, height: '100%', background: '#00e68a', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...new Set([...stackIds, ...stackB])].map(id => {
              const c = SUPPORT_CATALOG_DATA[id];
              const cost = estCost(id);
              const inA = stackIds.includes(id);
              const inB = stackB.includes(id);
              const inBoth = inA && inB;
              const tier = c?.tier || 'standard';
              const tierColor = tier === 'core' ? '#00e68a' : tier === 'standard' ? '#60a5fa' : tier === 'advanced' ? '#a78bfa' : '#f59e0b';
              return (
                <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 4, alignItems: 'center', padding: '4px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.015)', fontSize: 7 }}>
                  <span style={{ color: inBoth ? '#4ade80' : inA ? '#f59e0b' : '#60a5fa' }}>
                    {inBoth ? '✅ ' : inA ? 'A ' : '+ '}{c?.nameRu || c?.name || id}
                  </span>
                  <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: tierColor + '22', color: tierColor, textAlign: 'center' }}>{tier}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{cost}₽</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Экономия при выборе B: {bCost < curCost ? `${curCost - bCost}₽/мес` : bCost > curCost ? `переплата ${bCost - curCost}₽/мес` : 'одинаково'}
          </div>
        </GlassCard>
      )}

      {/* MECHANISMS VIEW */}
      {view === 'mechanisms' && stackB.length > 0 && overlap && (
        <GlassCard title="🧬 Детальное покрытие механизмов" icon="🧬" color="#a855f7">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Стек A</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{curExp?.coverage.mechanisms.length || 0} мех.</div>
            </div>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Стек B</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{bExp?.coverage.mechanisms.length || 0} мех.</div>
            </div>
          </div>
          {/* Venn: общие / только A / только B */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 3 }}>✅ Общие ({overlap.commonMechs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {overlap.commonMechs.map(m => (
                <span key={m} style={{ fontSize: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.1)' }}>{resolveMech(m)}</span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>🟡 Только A ({overlap.onlyAMechs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {overlap.onlyAMechs.map(m => (
                <span key={m} style={{ fontSize: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.06)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.1)' }}>{resolveMech(m)}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 600, marginBottom: 3 }}>🔵 Только B ({overlap.onlyBMechs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {overlap.onlyBMechs.map(m => (
                <span key={m} style={{ fontSize: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.06)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.1)' }}>{resolveMech(m)}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', fontSize: 7, color: '#a78bfa', lineHeight: 1.4 }}>
            💡 Объединение A+B покрывает <b>{overlap.commonMechs.length + overlap.onlyAMechs.length + overlap.onlyBMechs.length} уникальных механизмов</b>
          </div>
        </GlassCard>
      )}

      {/* SYNERGY VIEW */}
      {view === 'synergy' && stackB.length > 0 && synergyAnalysis && (
        <GlassCard title="🤝 Синергия и пары" icon="🤝" color="#22c55e">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Пар в стеке A</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{synergyAnalysis.aCount}</div>
            </div>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Пар в стеке B</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{synergyAnalysis.bCount}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>
              <div style={{ fontSize: 8, color: '#c4b5fd', fontWeight: 600, marginBottom: 2 }}>Стек A — пары</div>
              {synergyAnalysis.aPairs.slice(0, 15).map((p, i) => (
                <div key={i} style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>• {p.a} + {p.b}</div>
              ))}
              {synergyAnalysis.aCount > 15 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{synergyAnalysis.aCount - 15}</div>}
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 2 }}>Стек B — пары</div>
              {synergyAnalysis.bPairs.slice(0, 15).map((p, i) => (
                <div key={i} style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>• {p.a} + {p.b}</div>
              ))}
              {synergyAnalysis.bCount > 15 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{synergyAnalysis.bCount - 15}</div>}
            </div>
          </div>
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)', fontSize: 7, color: '#4ade80', lineHeight: 1.4 }}>
            💡 Стек A: скор {curExp?.totalSynergyScore ?? '—'} · Стек B: скор {bExp?.totalSynergyScore ?? '—'}
            {curExp?.totalSynergyScore != null && bExp?.totalSynergyScore != null && (
              <span> · {bExp.totalSynergyScore > curExp.totalSynergyScore ? 'B синергичнее на ' + (bExp.totalSynergyScore - curExp.totalSynergyScore) : curExp.totalSynergyScore > bExp.totalSynergyScore ? 'A синергичнее на ' + (curExp.totalSynergyScore - bExp.totalSynergyScore) : 'синергия одинакова'}</span>
            )}
          </div>
        </GlassCard>
      )}

      {/* COVERAGE VIEW */}
      {view === 'coverage' && stackB.length > 0 && (
        <GlassCard title="🎯 Покрытие систем и целей" icon="🎯" color="#60a5fa">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Покрытие A</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{curExp?.completeness ?? 0}%</div>
            </div>
            <div style={{ padding: '6px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Покрытие B</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{bExp?.completeness ?? 0}%</div>
            </div>
          </div>
          {/* Системы из explainStack */}
          {curExp?.coverage.organs && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 8, color: '#8b5cf6', fontWeight: 600, marginBottom: 2 }}>Системы A</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {curExp.coverage.organs.map((sys: string) => (
                  <span key={sys} style={{ fontSize: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.06)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.1)' }}>{sys}</span>
                ))}
              </div>
            </div>
          )}
          {bExp?.coverage.organs && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>Системы B</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {bExp.coverage.organs.map((sys: string) => (
                  <span key={sys} style={{ fontSize: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.1)' }}>{sys}</span>
                ))}
              </div>
            </div>
          )}
          {/* Цели */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>Цели A</div>
              {curExp?.coverage.goals?.slice(0, 8).map((cat: string) => (
                <div key={cat} style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>• {cat}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>Цели B</div>
              {bExp?.coverage.goals?.slice(0, 8).map((cat: string) => (
                <div key={cat} style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>• {cat}</div>
              ))}
            </div>
          </div>
          {curExp?.warnings && curExp.warnings.length > 0 && (
            <div style={{ marginBottom: 4, padding: '4px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>⚠ Предупреждения A:</div>
              {curExp.warnings.slice(0, 3).map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 6, color: '#f87171' }}>• {w}</div>
              ))}
            </div>
          )}
          {bExp?.warnings && bExp.warnings.length > 0 && (
            <div style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
              <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600 }}>⚠ Предупреждения B:</div>
              {bExp.warnings.slice(0, 3).map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 6, color: '#fbbf24' }}>• {w}</div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Stack B Picker Modal */}
      {showStackBPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowStackBPicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '88%', maxWidth: 340, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00e68a', marginBottom: 8 }}>📂 Выбрать стек B</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.3 }}>Выберите стек для сравнения с текущим. Можно загрузить из сохранённых стеков или использовать AI-оптимизацию.</div>
              {savedStacks.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: '#8b5cf6', fontWeight: 600, marginBottom: 4 }}>💾 Сохранённые стеки</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {savedStacks.map((s, i) => (
                      <button key={i} onClick={() => { setStackBAndSave(s.ids); setShowStackBPicker(false); showToast(`✅ Загружен стек: ${s.name}`, 'success'); }}
                        style={{ textAlign: 'left', width: '100%', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 9, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', color: 'rgba(255,255,255,0.85)' }}>
                        <span style={{ fontWeight: 600, color: '#c4b5fd' }}>{s.name}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>{s.ids.length} в-в</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { handleOptimize(); setShowStackBPicker(false); }}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 700, fontSize: 11 }}>
                ⚡ AI-оптимизация стека B
              </button>
              <button onClick={() => setShowStackBPicker(false)}
                style={{ width: '100%', marginTop: 6, padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 10 }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
