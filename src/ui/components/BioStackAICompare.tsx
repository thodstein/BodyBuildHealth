import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack } from '../../engines/supplement-finder.engine';
import { GlassCard, StatBox } from './BioStackAIConstants';
import { toFinderProfile } from './BioStackAIConstants';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';

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
  dostinex: 1000, hcg: 2000, hmg: 3000, enclomiphene: 1200,
};

function estMonthlyCost(id: string): number {
  const p = PRICE_RUB[id];
  if (p) return p;
  const cat = SUPPORT_CATALOG_DATA[id];
  if (!cat) return 500;
  const tierMults: Record<string, number> = { core: 800, standard: 500, advanced: 300, specialty: 1200 };
  return tierMults[cat.tier as string] || 500;
}

export function CompareTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [optimized, setOptimized] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCost, setShowCost] = useState(false);

  const currentExplanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const optimizedExplanation = useMemo(() => {
    if (!optimized) return null;
    return explainStack(optimized, toFinderProfile(profile));
  }, [optimized, profile]);

  const currentCost = useMemo(() => stackIds.reduce((s, id) => s + estMonthlyCost(id), 0), [stackIds]);
  const optimizedCost = useMemo(() => optimized?.reduce((s, id) => s + estMonthlyCost(id), 0) ?? 0, [optimized]);
  const costDiff = optimized ? ((optimizedCost - currentCost) / currentCost * 100).toFixed(0) : null;

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

  const handleReplace = useCallback(() => {
    if (optimized) setStackIds(optimized);
  }, [optimized, setStackIds]);

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚖</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Сначала соберите стек в 🔍 Поиск или 🧩 Сборка</div>
      </div>
    );
  }

  const MetricRow: React.FC<{ label: string; current: string | number; optimized: string | number; color: string; better: 'up' | 'down' | 'same' }> =
    ({ label, current, optimized, color, better }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{current}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>→</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{optimized}</span>
        <span style={{ fontSize: 7 }}>
          {better === 'up' ? '▲' : better === 'down' ? '▼' : '—'}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="⚖ Сравнение стеков" icon="📊" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.4 }}>
          Текущий стек: <strong style={{ color: '#fff' }}>{stackIds.length} компонентов</strong> · <strong style={{ color: '#f59e0b' }}>≈{currentCost}₽/мес</strong>
          {optimized ? ` → Оптимизированный: ${optimized.length} компонентов · ≈${optimizedCost}₽/мес` : ''}
        </div>
        {!optimized && (
          <button onClick={handleOptimize} disabled={loading} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
          }}>
            {loading ? '⏳ Оптимизация...' : '⚡ Оптимизировать стек'}
          </button>
        )}
      </GlassCard>

      {/* 💰 Cost Calculator */}
      <GlassCard title="💰 Калькулятор стоимости" icon="💰" color="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 8 }}>
          <StatBox label="Текущий стек" value={`${currentCost}₽`} color="#f59e0b" />
          {optimized && <StatBox label="Оптимизированный" value={`${optimizedCost}₽`} color="#8b5cf6" />}
          <StatBox label="Разница" value={optimized ? (costDiff || '0') + '%' : '—'} color={+(costDiff || 0) < 0 ? '#00e68a' : +(costDiff || 0) > 0 ? '#ef4444' : 'rgba(255,255,255,0.3)'} />
        </div>
        <button onClick={() => setShowCost(!showCost)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 4,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
        }}>
          {showCost ? '▲ Скрыть детали' : '▼ Детали по препаратам'}
        </button>
        {showCost && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {stackIds.map(id => {
              const cat = SUPPORT_CATALOG_DATA[id];
              const cost = estMonthlyCost(id);
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.02)', fontSize: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{cat?.nameRu || cat?.name || id}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{cost}₽</span>
                </div>
              );
            })}
            <div style={{ padding: '3px 6px', fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
              * Цены ориентировочные, на основе Ozon/Яндекс.Маркет
            </div>
          </div>
        )}
      </GlassCard>

      {optimized && (
        <>
          <GlassCard title="📊 Метрики" icon="📈" color="#60a5fa">
            <MetricRow label="Синергия" color="#8b5cf6"
              current={currentExplanation?.totalSynergyScore ?? 0}
              optimized={optimizedExplanation?.totalSynergyScore ?? 0}
              better={(optimizedExplanation?.totalSynergyScore ?? 0) >= (currentExplanation?.totalSynergyScore ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Покрытие целей" color="#60a5fa"
              current={`${currentExplanation?.completeness ?? 0}%`}
              optimized={`${optimizedExplanation?.completeness ?? 0}%`}
              better={(optimizedExplanation?.completeness ?? 0) >= (currentExplanation?.completeness ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Компонентов" color="#00e68a"
              current={stackIds.length}
              optimized={optimized.length}
              better={optimized.length !== stackIds.length ? 'up' : 'same'} />
            <MetricRow label="Стоимость" color="#f59e0b"
              current={`${currentCost}₽`}
              optimized={`${optimizedCost}₽`}
              better={optimizedCost <= currentCost ? 'up' : 'down'} />
            <MetricRow label="Предупреждений" color="#ef4444"
              current={currentExplanation?.warnings.length ?? 0}
              optimized={optimizedExplanation?.warnings.length ?? 0}
              better={(optimizedExplanation?.warnings.length ?? 0) <= (currentExplanation?.warnings.length ?? 0) ? 'up' : 'down'} />
          </GlassCard>

          <GlassCard title="🔍 Состав: текущий vs оптимизированный" icon="📋" color="#00e68a">
            <button onClick={() => setShowDetails(!showDetails)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
              {showDetails ? '▲ Скрыть детали' : '▼ Показать детали'}
            </button>
            {showDetails && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 }}>Текущий стек:</div>
                  {currentExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#fff', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 4 }}>Оптимизированный:</div>
                  {optimizedExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#00e68a', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          <button onClick={handleReplace} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
            background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
          }}>
            📥 Заменить текущий стек оптимизированным
          </button>

          {optimizedExplanation?.warnings && optimizedExplanation.warnings.length > 0 && (
            <GlassCard title="⚠ Предупреждения оптимизированного" icon="⚠" color="#ef4444">
              {optimizedExplanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3, padding: '2px 0' }}>• {w}</div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
