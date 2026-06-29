import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard } from './BioStackAIConstants';
import { toFinderProfile } from './BioStackAIConstants';

const PRICE_RUB: Record<string, number> = {
  nac: 650, milk_thistle: 400, tudca: 900, omega3: 800, coq10: 1200, magnesium: 350,
  zinc: 200, vitamin_d3: 300, vitamin_c: 250, vitamin_e: 350, selenium: 200,
  berberine: 600, curcumin: 500, alpha_lipoic: 700, collagen: 1200, glucosamine: 800,
  msm: 500, chondroitin: 900, ashwagandha: 600, rhodiola: 550, theanine: 450,
  glycine: 300, creatine: 400, l_carnitine: 700, taurine: 350, inositol: 500,
  probiotics: 1200, prebiotics: 400, glutamine: 500, bcaa: 800, beta_alanine: 400,
  citrulline: 500, agmatine: 600, tm_glycine: 700, same: 1500, phosphatidylserine: 900,
  phosphatidylcholine: 800, lecithin: 350, artichoke: 400, pycnogenol: 1200,
  colostrum: 1500, astragalus: 600, diosmin: 700, hesperidin: 400, horse_chestnut: 500,
  nattokinase: 800, lumbrokinase: 1200, serrapeptase: 900, papain: 400, bromelain: 500,
  bergamot: 600, vitamin_b1: 200, biotin: 250, folate: 300, inosine: 400,
  naringin: 500, bromantane: 1500, fasoracetam: 1200, caffeine: 200,
  melatonin: 200, '5_htp': 600, gaba: 400, phenibut: 700, lions_mane: 900,
  tongkat_ali: 1200, fadogia: 1100, daa: 600, tribulus: 500, ecdysterone: 800,
  turkesterone: 1200, mk677: 2000, cardarine: 1500, sr9009: 1800,
  telmi: 800, nebivolol: 900, eplerenone: 1200, spironolactone: 600,
  aspirin: 200, metformin: 400, atorvastatin: 500, rosuvastatin: 800,
  finasteride: 600, dutasteride: 900, tamoxifen: 800, clomid: 600,
  anastrozole: 700, letrozole: 700, exemestane: 800, cabergoline: 900,
};

function estCost(id: string): number {
  const p = PRICE_RUB[id];
  if (p) return p;
  const cat = SUPPORT_CATALOG_DATA[id];
  if (!cat) return 500;
  const tm: Record<string, number> = { core: 800, standard: 500, advanced: 300, specialty: 1200 };
  return tm[cat.tier as string] || 500;
}

export function CompareTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [optimized, setOptimized] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const curExp = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const optExp = useMemo(() => {
    if (!optimized) return null;
    return explainStack(optimized, toFinderProfile(profile));
  }, [optimized, profile]);

  const curCost = useMemo(() => stackIds.reduce((s, id) => s + estCost(id), 0), [stackIds]);
  const optCost = useMemo(() => optimized?.reduce((s, id) => s + estCost(id), 0) ?? 0, [optimized]);

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
      setOptimized(result.stack);
      setLoading(false);
    }, 300);
  }, [stackIds, profile]);

  // Overlap analysis
  const overlap = useMemo(() => {
    if (!optimized) return null;
    const aSet = new Set(stackIds);
    const bSet = new Set(optimized);
    const common = stackIds.filter(id => bSet.has(id));
    const onlyA = stackIds.filter(id => !bSet.has(id));
    const onlyB = optimized.filter(id => !aSet.has(id));
    const aMechs = new Set<string>();
    const bMechs = new Set<string>();
    stackIds.forEach(id => SUPPORT_CATALOG_DATA[id]?.mechanisms?.forEach(m => aMechs.add(m)));
    optimized.forEach(id => SUPPORT_CATALOG_DATA[id]?.mechanisms?.forEach(m => bMechs.add(m)));
    const commonMechs = [...aMechs].filter(m => bMechs.has(m));
    const onlyAMechs = [...aMechs].filter(m => !bMechs.has(m));
    const onlyBMechs = [...bMechs].filter(m => !aMechs.has(m));
    return { common, onlyA, onlyB, commonMechs, onlyAMechs, onlyBMechs };
  }, [stackIds, optimized]);

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚖</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Сначала соберите стек в 🔍 Поиск или 🧩 Сборка</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Header */}
      <GlassCard title="⚖ Сравнение стеков" icon="📊" color="#8b5cf6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Текущий</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{stackIds.length}</div>
            <div style={{ fontSize: 7, color: '#f59e0b' }}>{curCost}₽</div>
          </div>
          {!optimized ? (
            <button onClick={handleOptimize} disabled={loading}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
              {loading ? '⏳' : '⚡ Оптимизировать'}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Оптимизированный</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{optimized.length}</div>
              <div style={{ fontSize: 7, color: '#f59e0b' }}>{optCost}₽</div>
            </div>
          )}
        </div>
      </GlassCard>

      {optimized && overlap && (
        <>
          {/* Metrics comparison */}
          <GlassCard title="📊 Сравнение метрик" icon="📈" color="#60a5fa">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                { label: 'Синергия', cur: curExp?.totalSynergyScore ?? 0, opt: optExp?.totalSynergyScore ?? 0, color: '#8b5cf6', up: true },
                { label: 'Покрытие', cur: `${curExp?.completeness ?? 0}%`, opt: `${optExp?.completeness ?? 0}%`, color: '#60a5fa', up: true },
                { label: 'Кол-во', cur: stackIds.length, opt: optimized.length, color: '#00e68a', up: true },
                { label: 'Стоимость', cur: `${curCost}₽`, opt: `${optCost}₽`, color: '#f59e0b', up: false },
                { label: 'Механизмы', cur: curExp?.coverage.mechanisms.length ?? 0, opt: optExp?.coverage.mechanisms.length ?? 0, color: '#22c55e', up: true },
                { label: 'Предупреждения', cur: curExp?.warnings.length ?? 0, opt: optExp?.warnings.length ?? 0, color: '#ef4444', up: false },
              ].map(m => {
                const better = m.up
                  ? (m.opt > m.cur ? 'up' : m.opt < m.cur ? 'down' : 'same')
                  : (m.opt < m.cur ? 'up' : m.opt > m.cur ? 'down' : 'same');
                return (
                  <div key={m.label} style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{m.cur}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)' }}>→</span>
                      <span style={{ fontSize: 10, color: m.color, fontWeight: 700 }}>{m.opt}</span>
                      <span style={{ fontSize: 7 }}>{better === 'up' ? '▲' : better === 'down' ? '▼' : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Composition diff */}
          <GlassCard title="🔍 Состав: что изменилось" icon="📋" color="#00e68a">
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
                <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>➖ Только в текущем ({overlap.onlyA.length})</div>
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
                <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 600, marginBottom: 3 }}>➕ Только в оптимизированном ({overlap.onlyB.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {overlap.onlyB.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.06)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.1)' }}>{c?.nameRu || c?.name || id}</span>;
                  })}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Mechanism coverage overlap */}
          <GlassCard title="🧬 Покрытие механизмов" icon="🧬" color="#a855f7">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
              <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }}>
                <div style={{ fontSize: 8, color: '#c4b5fd', fontWeight: 600 }}>Текущий</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{curExp?.coverage.mechanisms.length || 0} мех.</div>
              </div>
              <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
                <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600 }}>Оптимизированный</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{optExp?.coverage.mechanisms.length || 0} мех.</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 3 }}>Общие ({overlap.commonMechs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
              {overlap.commonMechs.slice(0, 8).map(m => (
                <span key={m} style={{ fontSize: 6, padding: '2px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.1)' }}>{m.replace(/_/g, ' ').slice(0, 20)}</span>
              ))}
              {overlap.commonMechs.length > 8 && <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>+{overlap.commonMechs.length - 8}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <div>
                <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>Только в текущем ({overlap.onlyAMechs.length})</div>
                {overlap.onlyAMechs.slice(0, 4).map(m => (
                  <div key={m} style={{ fontSize: 6, color: '#f59e0b', padding: '1px 0' }}>{m.replace(/_/g, ' ').slice(0, 22)}</div>
                ))}
                {overlap.onlyAMechs.length > 4 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{overlap.onlyAMechs.length - 4}</div>}
              </div>
              <div>
                <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 2 }}>Только в оптим. ({overlap.onlyBMechs.length})</div>
                {overlap.onlyBMechs.slice(0, 4).map(m => (
                  <div key={m} style={{ fontSize: 6, color: '#60a5fa', padding: '1px 0' }}>{m.replace(/_/g, ' ').slice(0, 22)}</div>
                ))}
                {overlap.onlyBMechs.length > 4 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{overlap.onlyBMechs.length - 4}</div>}
              </div>
            </div>
          </GlassCard>

          {/* Cost comparison */}
          <GlassCard title="💰 Стоимость" icon="💰" color="#f59e0b">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 6 }}>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: 'rgba(245,158,11,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Текущий</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{curCost}₽</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: 'rgba(0,230,138,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Оптимизир.</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>{optCost}₽</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: optCost <= curCost ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Разница</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: optCost <= curCost ? '#00e68a' : '#ef4444' }}>
                  {optCost - curCost > 0 ? '+' : ''}{optCost - curCost}₽
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {optimized.map(id => {
                const c = SUPPORT_CATALOG_DATA[id];
                const cost = estCost(id);
                const inCurrent = stackIds.includes(id);
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.015)', fontSize: 7 }}>
                    <span style={{ color: inCurrent ? 'rgba(255,255,255,0.7)' : '#60a5fa' }}>
                      {inCurrent ? '' : '+ '}{c?.nameRu || c?.name || id}
                    </span>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{cost}₽</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Apply / Merge buttons */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setStackIds(optimized)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
            }}>📥 Заменить оптимизированным</button>
            <button onClick={() => {
              const merged = [...new Set([...stackIds, ...optimized])];
              setStackIds(merged);
            }} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
            }}>🔀 Объединить (оба)</button>
          </div>

          {/* Warnings */}
          {optExp?.warnings && optExp.warnings.length > 0 && (
            <GlassCard title="⚠ Предупреждения оптимизированного" icon="⚠" color="#ef4444">
              {optExp.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3, padding: '2px 0' }}>• {w}</div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
