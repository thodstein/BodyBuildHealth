import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS, ALL_SUBSTANCES } from '../../data/support-database';
import { INTERACTION_ENRICHMENT } from '../../data/support-interaction-enrichment';
import { GlassCard, estCost, showToast } from './BioStackAIConstants';
import { toFinderProfile } from './BioStackAIConstants';
import { PopupSelect } from './PopupXxx';
import type { LinkedData } from '../../core/data-link';
import { calcStackSynergyScore, suggestSynergyAdditions } from '../../engines/support-plan/display';
import { selectStack } from '../../engines/biostack-clinical-v2.engine';
import { loadBioStackProfile } from '../../engines/biostack-ai.engine';

type CompareView = 'all' | 'price' | 'mechanisms' | 'synergy' | 'coverage' | 'safety';

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
  return MECH_TRANSLATIONS_RU[m] || '—';
}

/* ─── Interactions helpers ─── */
const MAX_ITEMS = 10;
const TIER_COLORS: Record<string, string> = { core: '#00e68a', standard: '#60a5fa', advanced: '#a78bfa', specialty: '#f59e0b' };
const LVL_COLORS: Record<string, string> = { excellent: '#22c55e', good: '#4ade80', moderate: '#f59e0b', poor: '#ef4444', risky: '#dc2626' };
const LVL_LABELS: Record<string, string> = { excellent: 'Отлично', good: 'Хорошо', moderate: 'Умеренно', poor: 'Плохо', risky: 'Рискованно' };

function cardTitleColor(tier?: string): string { return TIER_COLORS[tier || ''] || 'rgba(255,255,255,0.5)'; }

const HEPATIC_KEYWORDS = ['hepatotox', 'liver', 'печень', 'ALT', 'AST', 'ГГТ'];
const RENAL_KEYWORDS = ['nephrotox', 'kidney', 'почк', 'creatinine', 'креатинин'];
const CARDIO_KEYWORDS = ['cardiotox', 'blood pressure', 'heart rate', 'pressure', 'давление', 'ЧСС', 'тромб'];

function estimateOrganLoad(ids: string[]) {
  const h = { score: 0, items: [] as string[] };
  const r = { score: 0, items: [] as string[] };
  const c = { score: 0, items: [] as string[] };
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id]; if (!e) return;
    const desc = (e.description || '').toLowerCase();
    const si = (e.specialInstructions || []).join(' ').toLowerCase();
    const contra = (e.contraindications || []).join(' ').toLowerCase();
    const se = (e.sideEffects || []).join(' ').toLowerCase();
    const all = [desc, si, contra, se].join(' ');
    const cat = Array.isArray(e.category) ? e.category.map((x: string) => x.toLowerCase()) : [];
    if (HEPATIC_KEYWORDS.some(k => all.includes(k)) || cat.includes('hepatoprotector') || cat.includes('liver')) { h.score += 1; h.items.push(e.nameRu || e.name || id); }
    if (RENAL_KEYWORDS.some(k => all.includes(k))) { r.score += 1; r.items.push(e.nameRu || e.name || id); }
    if (CARDIO_KEYWORDS.some(k => all.includes(k)) || cat.includes('cardioprotector') || cat.includes('heart')) { c.score += 1; c.items.push(e.nameRu || e.name || id); }
  });
  return { hepatic: { score: Math.min(h.score, 5), items: h.items }, renal: { score: Math.min(r.score, 5), items: r.items }, cardio: { score: Math.min(c.score, 5), items: c.items } };
}

function buildTimingAdvice(ids: string[]): string[] {
  const tips: string[] = [];
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id]; if (!e) return;
    const si = (e.specialInstructions || []).join(' ').toLowerCase();
    const name = e.nameRu || e.name || id;
    if (si.includes('жир') || si.includes('fat') || si.includes('с едой')) tips.push(`${name} — принимать с жирной пищей для абсорбции`);
    if (si.includes('натощак') || si.includes('fasting') || si.includes('до еды') || si.includes('за 30')) tips.push(`${name} — натощак за 30 мин до еды`);
    if (si.includes('вечер') || si.includes('перед сном')) tips.push(`${name} — вечером перед сном`);
    else if (si.includes('утро') || si.includes('утром')) tips.push(`${name} — утром после завтрака`);
    if (si.includes('calcium') || si.includes('кальций') || si.includes('железо') || si.includes('iron') || si.includes('цинк') || si.includes('zinc')) tips.push(`⚠ ${name}: разделить с кальцием/железом/цинком (интервал 2 ч)`);
  });
  return [...new Set(tips)].slice(0, 6);
}

function checkProfileContraindications(ids: string[], profile: BioStackProfile) {
  const issues: Array<{ id: string; name: string; issue: string }> = [];
  if (!profile?.healthConditions?.length) return issues;
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id]; if (!e?.contraindications?.length) return;
    const name = e.nameRu || e.name || id;
    const c = e.contraindications.map((x: string) => x.toLowerCase());
    profile.healthConditions!.forEach(cond => {
      if (cond === 'heart' && c.some(x => x.includes('серд') || x.includes('cardio') || x.includes('pressure'))) issues.push({ id, name, issue: 'Противопоказан при заболеваниях ССС' });
      if (cond === 'kidney' && c.some(x => x.includes('почк') || x.includes('kidney') || x.includes('renal'))) issues.push({ id, name, issue: 'Противопоказан при заболеваниях почек' });
      if (cond === 'liver' && c.some(x => x.includes('печен') || x.includes('liver') || x.includes('hepat'))) issues.push({ id, name, issue: 'Противопоказан при заболеваниях печени' });
      if (cond === 'diabetes' && c.some(x => x.includes('диабет') || x.includes('diabet') || x.includes('glucose'))) issues.push({ id, name, issue: 'Противопоказан при сахарном диабете' });
      if (cond === 'stomach' && c.some(x => x.includes('желуд') || x.includes('ulcer') || x.includes('gastr'))) issues.push({ id, name, issue: 'Противопоказан при заболеваниях ЖКТ' });
    });
  });
  return issues;
}

function getEnrichedMechanisms(pairKey: string): string[] {
  const enr = INTERACTION_ENRICHMENT[pairKey]; if (enr?.mechanismRu?.length) return enr.mechanismRu; return [];
}

export function CompareTab({ profile, stackIds, setStackIds, linked }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void; linked?: LinkedData }) {
  const [stackB, setStackB] = useState<string[]>(() => {
    try { const s = localStorage.getItem('he_biostack_compare_b'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [showStackBPicker, setShowStackBPicker] = useState(false);
  const [view, setView] = useState<CompareView>('all');

  /* ── Interactions state ── */
  const [intSearch, setIntSearch] = useState('');
  const [intSelected, setIntSelected] = useState<string[]>([]);
  const [intExpandedSub, setIntExpandedSub] = useState<Record<string, boolean>>({});
  const [intExpandedPair, setIntExpandedPair] = useState<Record<string, boolean>>({});

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
        goal: undefined,
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

  /* ── Safety aggregate (selectStack) ── */
  const safetyAnalysis = useMemo(() => {
    if (stackB.length === 0) return null;
    const prof = profile || loadBioStackProfile();
    const lab = linked?.labAnalysis || null;
    const compute = (ids: string[]) => {
      if (ids.length === 0) return null;
      const r = selectStack(ids, prof, 'comprehensive', lab);
      const critUL = r.ulWarnings.filter(w => w.severity === 'high' || w.severity === 'critical').length;
      // Safety score: 100 − penalties
      const score = Math.max(0, 100
        - r.hardStops.length * 25
        - r.drugExclusions.length * 15
        - r.drugTitrations.length * 5
        - critUL * 10
        - (r.ulWarnings.length - critUL) * 3
        - r.redundancy.length * 2);
      return {
        hardStops: r.hardStops.length,
        drugExclusions: r.drugExclusions.length,
        drugTitrations: r.drugTitrations.length,
        ulWarnings: r.ulWarnings.length,
        critUL,
        redundancy: r.redundancy.length,
        labAdjustments: r.labAdjustments.length,
        score,
        raw: r,
      };
    };
    return { a: compute(stackIds), b: compute(stackB) };
  }, [stackIds, stackB, profile, linked]);

  /* ── Interactions useMemo ── */
  const intAllSubstances = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; name: string; tier: string; category: string[] }> = [];
    ALL_SUBSTANCES.forEach(s => {
      const id = (s.id || '').toLowerCase();
      if (!seen.has(id) && SUPPORT_CATALOG_DATA[id]) {
        seen.add(id);
        const entry = SUPPORT_CATALOG_DATA[id];
        items.push({ id, name: entry?.nameRu || entry?.name || id, tier: entry?.tier || '', category: (entry?.category || []).slice(0, 2) });
      }
    });
    Object.entries(SUPPORT_CATALOG_DATA).forEach(([key, val]) => {
      const id = key.toLowerCase();
      if (!seen.has(id)) { seen.add(id); items.push({ id, name: val?.nameRu || val?.name || id, tier: val?.tier || '', category: (val?.category || []).slice(0, 2) }); }
    });
    return items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, []);

  const intFiltered = useMemo(() => {
    if (!intSearch) return intAllSubstances.slice(0, 20);
    const q = intSearch.toLowerCase();
    return intAllSubstances.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 15);
  }, [intSearch, intAllSubstances]);

  const intAddItem = (id: string) => { if (intSelected.length >= MAX_ITEMS || intSelected.includes(id)) return; setIntSelected(prev => [...prev, id]); setIntSearch(''); };
  const intRemoveItem = (id: string) => setIntSelected(prev => prev.filter(x => x !== id));
  const intClearAll = () => { setIntSelected([]); setIntExpandedSub({}); setIntExpandedPair({}); };
  const intLoadFromStack = () => { setIntSelected(prev => { const set = new Set(prev); stackIds.forEach(id => set.add(id)); return Array.from(set).slice(0, MAX_ITEMS); }); };
  const intToggleSub = (id: string) => setIntExpandedSub(prev => ({ ...prev, [id]: !prev[id] }));

  const intAnalysis = useMemo(() => {
    if (intSelected.length < 2) return null;
    const ids = intSelected;
    const stackScore = calcStackSynergyScore(ids);
    const suggestions = suggestSynergyAdditions(ids, 5);
    const pairs: any[] = [];
    const pairSet = new Set<string>();
    ALL_INTERACTIONS.forEach((i: any) => {
      const a = (i.substanceA || '').toLowerCase(); const b = (i.substanceB || '').toLowerCase();
      if (ids.includes(a) && ids.includes(b)) {
        const key = [a, b].sort().join('|');
        if (!pairSet.has(key)) {
          pairSet.add(key);
          pairs.push({ key, a, b, nameA: SUPPORT_CATALOG_DATA[a]?.nameRu || a, nameB: SUPPORT_CATALOG_DATA[b]?.nameRu || b, type: i.type || 'unknown', severity: i.severity || 'LOW', effect: i.effect || '', mechanisms: i.mechanisms || [], notes: i.notes || '' });
        }
      }
    });
    const critical = pairs.filter((p: any) => p.severity === 'HIGH' && p.type === 'conflict');
    const moderate = pairs.filter((p: any) => p.severity === 'MEDIUM' || (p.severity === 'HIGH' && p.type !== 'conflict'));
    const safe = pairs.filter((p: any) => p.severity === 'LOW' || p.type === 'synergy');
    const organLoad = estimateOrganLoad(ids);
    const timingTips = buildTimingAdvice(ids);
    const contraIssues = checkProfileContraindications(ids, profile);
    return { stackScore, suggestions, pairs, critical, moderate, safe, organLoad, timingTips, contraIssues };
  }, [intSelected, profile]);

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
          { id: 'safety' as const, label: '🛡 Безопасность' },
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

      {/* SAFETY VIEW */}
      {view === 'safety' && stackB.length > 0 && safetyAnalysis && safetyAnalysis.a && safetyAnalysis.b && (
        <GlassCard title="🛡 Клиническая безопасность" icon="🛡" color="#ef4444">
          {/* Safety score gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
            {[
              { label: 'Индекс безопасности A', value: safetyAnalysis.a.score, color: '#8b5cf6' },
              { label: 'Индекс безопасности B', value: safetyAnalysis.b.score, color: '#00e68a' },
            ].map(g => {
              const barColor = g.value >= 80 ? '#22c55e' : g.value >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <div key={g.label} style={{ padding: '8px', borderRadius: 8, background: g.color + '08', border: '1px solid ' + g.color + '18', textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{g.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: barColor }}>{g.value}<span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>/100</span></div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ width: `${g.value}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed safety metrics table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 3, fontSize: 8 }}>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.4)', padding: '3px 4px' }}>Метрика</div>
            <div style={{ fontWeight: 700, color: '#c4b5fd', textAlign: 'center', padding: '3px 4px' }}>Стек A</div>
            <div style={{ fontWeight: 700, color: '#00e68a', textAlign: 'center', padding: '3px 4px' }}>Стек B</div>
            {[
              { label: '⛔ Абс. противопоказания', a: safetyAnalysis.a.hardStops, b: safetyAnalysis.b.hardStops, invert: true },
              { label: '💊 Исключения по ЛС', a: safetyAnalysis.a.drugExclusions, b: safetyAnalysis.b.drugExclusions, invert: true },
              { label: '⚖ Титрации доз', a: safetyAnalysis.a.drugTitrations, b: safetyAnalysis.b.drugTitrations, invert: true },
              { label: '🧪 Превыш. UL (крит.)', a: safetyAnalysis.a.critUL, b: safetyAnalysis.b.critUL, invert: true },
              { label: '🧪 Превыш. UL (всего)', a: safetyAnalysis.a.ulWarnings, b: safetyAnalysis.b.ulWarnings, invert: true },
              { label: '🔁 Дублир. путей', a: safetyAnalysis.a.redundancy, b: safetyAnalysis.b.redundancy, invert: true },
              { label: '🩸 Лаб. коррекции', a: safetyAnalysis.a.labAdjustments, b: safetyAnalysis.b.labAdjustments, invert: false },
            ].map((row, i) => {
              const better = row.invert ? (row.a < row.b ? 'a' : row.b < row.a ? 'b' : '') : (row.a > row.b ? 'a' : row.b > row.a ? 'b' : '');
              const cell = (v: number, side: 'a' | 'b') => {
                const isBetter = better === side;
                const isWorse = better && better !== side;
                const col = v === 0 && row.invert ? '#4ade80' : isWorse ? '#ef4444' : isBetter ? '#4ade80' : 'rgba(255,255,255,0.7)';
                return <div style={{ textAlign: 'center', padding: '3px 4px', borderRadius: 4, fontWeight: 700, color: col, background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>{v}</div>;
              };
              return (
                <React.Fragment key={row.label}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', padding: '3px 4px', background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>{row.label}</div>
                  {cell(row.a, 'a')}
                  {cell(row.b, 'b')}
                </React.Fragment>
              );
            })}
          </div>

          {/* Hard-stop / exclusion details */}
          {(safetyAnalysis.a.raw.hardStops.length > 0 || safetyAnalysis.b.raw.hardStops.length > 0) && (
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>⛔ Абсолютные противопоказания</div>
              {safetyAnalysis.a.raw.hardStops.map((h, i) => (
                <div key={'a' + i} style={{ fontSize: 7, color: '#f87171', padding: '1px 0' }}>A: {h.substanceName || h.substanceId} — {h.reason}</div>
              ))}
              {safetyAnalysis.b.raw.hardStops.map((h, i) => (
                <div key={'b' + i} style={{ fontSize: 7, color: '#fbbf24', padding: '1px 0' }}>B: {h.substanceName || h.substanceId} — {h.reason}</div>
              ))}
            </div>
          )}

          {/* Verdict */}
          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)', fontSize: 8, color: '#4ade80', lineHeight: 1.4 }}>
            {(() => {
              const sa = safetyAnalysis.a.score, sb = safetyAnalysis.b.score;
              if (sb > sa + 5) return `🏆 Стек B безопаснее (индекс ${sb} против ${sa}). Меньше противопоказаний и рисков передозировки.`;
              if (sa > sb + 5) return `🏆 Стек A безопаснее (индекс ${sa} против ${sb}). Сохраняйте текущий состав.`;
              return `⚖ Стеки сопоставимы по безопасности (A: ${sa}, B: ${sb}). Выбирайте по покрытию и цене.`;
            })()}
          </div>
        </GlassCard>
      )}

      {/* AI-анализ: текстовый вывод рекомендации */}
      {stackB.length > 0 && overlap && (
        <GlassCard title="🤖 AI-анализ: какой стек лучше" icon="🤖" color="#22c55e">
          <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
            <div style={{ fontSize: 9, color: '#4ade80', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {(() => {
                const aSyn = curExp?.totalSynergyScore ?? 0;
                const bSyn = bExp?.totalSynergyScore ?? 0;
                const aCov = curExp?.completeness ?? 0;
                const bCov = bExp?.completeness ?? 0;
                const aWarn = curExp?.warnings.length ?? 0;
                const bWarn = bExp?.warnings.length ?? 0;
                const aOnlyCount = overlap.onlyA.length;
                const bOnlyCount = overlap.onlyB.length;
                const commonCount = overlap.common.length;

                const lines: string[] = [];
                lines.push(`📊 Стек A (${stackIds.length} в-в) vs Стек B (${stackB.length} в-в)`);
                lines.push('');
                if (commonCount > 0) lines.push(`🔄 Общих веществ: ${commonCount}.`);
                if (aOnlyCount > 0) {
                  const namesA = overlap.onlyA.slice(0, 3).map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join(', ');
                  lines.push(`➖ Только в A: ${aOnlyCount} шт (${namesA}${aOnlyCount > 3 ? '...' : ''})`);
                }
                if (bOnlyCount > 0) {
                  const namesB = overlap.onlyB.slice(0, 3).map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join(', ');
                  lines.push(`➕ Только в B: ${bOnlyCount} шт (${namesB}${bOnlyCount > 3 ? '...' : ''})`);
                }
                lines.push('');
                if (bSyn > aSyn) lines.push(`🤝 Стек B синергичнее (+${bSyn - aSyn} пунктов).`);
                else if (aSyn > bSyn) lines.push(`🤝 Стек A синергичнее (+${aSyn - bSyn} пунктов).`);
                if (bCov > aCov) lines.push(`🎯 Стек B лучше покрывает системы (${bCov}% vs ${aCov}%).`);
                else if (aCov > bCov) lines.push(`🎯 Стек A лучше покрывает системы (${aCov}% vs ${bCov}%).`);
                if (curCost !== bCost) {
                  const diff = Math.abs(bCost - curCost);
                  lines.push(`💰 Разница в цене: ${bCost > curCost ? 'B дороже' : 'B дешевле'} на ${diff}₽/мес.`);
                }
                if (aWarn !== bWarn) lines.push(`⚠ Предупреждений: A (${aWarn}) vs B (${bWarn}).`);
                lines.push('');
                const aScore = aSyn + aCov - aWarn * 5;
                const bScore = bSyn + bCov - bWarn * 5;
                if (bScore > aScore + 10) {
                  lines.push(`🏆 Рекомендация: Стек B — лучшее покрытие при сопоставимых рисках.`);
                  lines.push(`💡 Замените A на B кнопкой «Заменить стек A на B» выше.`);
                } else if (aScore > bScore + 10) {
                  lines.push(`🏆 Рекомендация: Стек A — оптимален.`);
                  lines.push(`💡 Если цель — снизить стоимость, посмотрите «Сделать дешевле» во вкладке Стек.`);
                } else {
                  lines.push(`⚖ Стеки примерно равнозначны.`);
                  lines.push(`💡 Выберите по бюджету: A (${curCost}₽) vs B (${bCost}₽).`);
                }
                if (profile.healthConditions && profile.healthConditions.length > 0) {
                  lines.push('');
                  lines.push(`👤 Учитывая: ${profile.healthConditions.join(', ')} — проверьте на вкладке «Риски».`);
                }
                return lines.join('\n');
              })()}
            </div>
          </div>
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

      {/* ── Interactions Calculator ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0', paddingTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6, textAlign: 'center' }}>🔬 Калькулятор совместимости БАД</div>

        <GlassCard title="🧪 Подбор препаратов для проверки" icon="⚡" color="#a855f7">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Проверка совместимости: синергии, конфликты, нагрузка на органы, режим приёма</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, minHeight: 24 }}>
            {intSelected.length === 0 ? (
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>Нет выбранных препаратов</span>
            ) : intSelected.map(id => {
              const e = SUPPORT_CATALOG_DATA[id];
              const n = e?.nameRu || e?.name || id; const tc = cardTitleColor(e?.tier);
              return <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 6, fontSize: 8, fontWeight: 600, background: tc + '12', border: `1px solid ${tc}25`, color: tc }}>{n}<span onClick={() => intRemoveItem(id)} style={{ cursor: 'pointer', opacity: 0.4, fontSize: 10, marginLeft: 2 }}>✕</span></span>;
            })}
          </div>
          {intSelected.length < MAX_ITEMS && (
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <input value={intSearch} placeholder="🔍 Введите название БАД/препарата..." onChange={e => setIntSearch(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 9, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', boxSizing: 'border-box', outline: 'none' }} />
              {intSearch && intFiltered.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#202023', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                  {intFiltered.map(s => { const tc = cardTitleColor(s.tier);
                    return <div key={s.id} onClick={() => intAddItem(s.id)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 9, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{s.name}</span>
                      {s.tier && <span style={{ fontSize: 6, padding: '1px 5px', borderRadius: 3, background: tc + '22', color: tc, fontWeight: 600 }}>{s.tier}</span>}
                      {intSelected.includes(s.id) && <span style={{ color: '#22c55e', fontSize: 8 }}>✓</span>}
                    </div>;
                  })}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {intSelected.length > 0 && <button onClick={intClearAll} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>✕ Очистить все</button>}
            {stackIds.length > 0 && <button onClick={intLoadFromStack} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>📋 Из активного стека</button>}
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginLeft: 'auto' }}>{intSelected.length}/{MAX_ITEMS}</span>
          </div>
        </GlassCard>

        {intAnalysis && (
          <>
            <GlassCard title="📊 Сводка совместимости" icon="🏥" color={LVL_COLORS[intAnalysis.stackScore.level]}>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LVL_COLORS[intAnalysis.stackScore.level]}08`, border: `1px solid ${LVL_COLORS[intAnalysis.stackScore.level]}22`, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: LVL_COLORS[intAnalysis.stackScore.level] }}>{intAnalysis.stackScore.score}/100</span>
                  <span style={{ fontSize: 9, padding: '2px 10px', borderRadius: 6, fontWeight: 700, background: `${LVL_COLORS[intAnalysis.stackScore.level]}22`, color: LVL_COLORS[intAnalysis.stackScore.level] }}>{LVL_LABELS[intAnalysis.stackScore.level]}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: intAnalysis.stackScore.score + '%', height: '100%', background: LVL_COLORS[intAnalysis.stackScore.level], borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#22c55e' }}>⊕ {intAnalysis.stackScore.synergies} синергий</span>
                  <span style={{ color: '#ef4444' }}>⊖ {intAnalysis.stackScore.conflicts} конфликтов</span>
                  <span style={{ color: '#f59e0b' }}>⚠ {intAnalysis.stackScore.cautions} осторожностей</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>? {intAnalysis.stackScore.unknownPairs} неизвестно</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 6 }}>
                {[{ key: 'hepatic', label: '🫁 Печень', color: intAnalysis.organLoad.hepatic.score >= 3 ? '#ef4444' : intAnalysis.organLoad.hepatic.score >= 2 ? '#f59e0b' : '#22c55e', score: intAnalysis.organLoad.hepatic.score },
                 { key: 'renal', label: '🫘 Почки', color: intAnalysis.organLoad.renal.score >= 3 ? '#ef4444' : intAnalysis.organLoad.renal.score >= 2 ? '#f59e0b' : '#22c55e', score: intAnalysis.organLoad.renal.score },
                 { key: 'cardio', label: '❤️ ССС', color: intAnalysis.organLoad.cardio.score >= 3 ? '#ef4444' : intAnalysis.organLoad.cardio.score >= 2 ? '#f59e0b' : '#22c55e', score: intAnalysis.organLoad.cardio.score },
                ].map(g => <div key={g.key} style={{ padding: '6px 4px', borderRadius: 8, background: g.color + '06', border: `1px solid ${g.color}15`, textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{g.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: g.color }}>{g.score}/5</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', marginTop: 3 }}><div style={{ width: (g.score / 5) * 100 + '%', height: '100%', borderRadius: 2, background: g.color }} /></div>
                </div>)}
              </div>
              {intAnalysis.timingTips.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>🕐 Рекомендации по режиму приёма</div>
                  {intAnalysis.timingTips.map((tip: string, i: number) => <div key={i} style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.04)', marginBottom: 2 }}>{tip}</div>)}
                </div>
              )}
              {intAnalysis.contraIssues.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>⚠ Противопоказания с учётом профиля</div>
                  {intAnalysis.contraIssues.map((ci: any, i: number) => <div key={i} style={{ fontSize: 8, color: '#ef4444', padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.04)', marginBottom: 2 }}><strong>{ci.name}</strong>: {ci.issue}</div>)}
                </div>
              )}
              {/* Recommendations */}
              {intAnalysis.suggestions.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔮 Рекомендации для усиления</div>
                  {intAnalysis.suggestions.map((sug: any, si: number) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, marginBottom: 2, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                      <button onClick={() => intAddItem(sug.id)} disabled={intSelected.includes(sug.id) || intSelected.length >= MAX_ITEMS} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', background: intSelected.includes(sug.id) ? 'rgba(255,255,255,0.05)' : 'rgba(168,85,247,0.15)', border: `1px solid ${intSelected.includes(sug.id) ? 'rgba(255,255,255,0.1)' : 'rgba(168,85,247,0.3)'}`, color: intSelected.includes(sug.id) ? 'rgba(255,255,255,0.2)' : '#a855f7', fontWeight: 700 }}>{intSelected.includes(sug.id) ? '✓' : '+ Добавить'}</button>
                      <span style={{ fontSize: 8, fontWeight: 600, color: '#fff' }}>{sug.name}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{sug.synergiesWith?.length || 0} синергий</span>
                      <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 700 }}>{sug.score}</span>
                    </div>
                  ))}
                </div>
              )}
              {setStackIds && <button onClick={() => setStackIds(intSelected)} style={{ width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>📋 Сохранить как активный стек</button>}
            </GlassCard>

            {/* Critical pairs */}
            {intAnalysis.critical.length > 0 && (
              <GlassCard title={`🔴 Критические (${intAnalysis.critical.length})`} icon="🚫" color="#ef4444">
                {intAnalysis.critical.map((p: any, i: number) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 3, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>🚫</span><span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameA} + {p.nameB}</span><span style={{ marginLeft: 'auto', padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: '#ef444418', color: '#ef4444' }}>🔴 Высокий</span></div>
                    {p.effect && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, marginTop: 2, paddingLeft: 16 }}>{p.effect}</div>}
                  </div>
                ))}
              </GlassCard>
            )}
            {intAnalysis.moderate.length > 0 && (
              <GlassCard title={`🟡 Умеренные (${intAnalysis.moderate.length})`} icon="⚡" color="#f59e0b">
                {intAnalysis.moderate.map((p: any, i: number) => {
                  const pk = p.key || `${p.a}|${p.b}`; const open = intExpandedPair[pk] ?? false;
                  return <div key={i} style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 3, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <div onClick={() => setIntExpandedPair(prev => ({ ...prev, [pk]: !open }))} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10 }}>{p.type === 'caution' ? '⚡' : '⚠'}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameA} ↔ {p.nameB}</span>
                      <span style={{ marginLeft: 'auto', padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: '#f59e0b18', color: '#f59e0b' }}>{p.severity === 'MEDIUM' ? '🟡 Средний' : '⚠ Высокий'}</span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{open ? '▲' : '▼'}</span>
                    </div>
                    {open && <div style={{ paddingLeft: 16, marginTop: 3 }}>{p.effect && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{p.effect}</div>}{p.notes && <div style={{ fontSize: 7, color: '#f59e0b' }}>{p.notes}</div>}</div>}
                  </div>;
                })}
              </GlassCard>
            )}
            {intAnalysis.safe.length > 0 && (
              <GlassCard title={`🟢 Безопасные (${intAnalysis.safe.length})`} icon="🤝" color="#22c55e">
                {intAnalysis.safe.slice(0, 8).map((p: any, i: number) => <div key={i} style={{ padding: '4px 6px', borderRadius: 6, marginBottom: 2, background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: 4 }}><span>{p.type === 'synergy' ? '🤝' : '➖'}</span><span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>{p.nameA} ↔ {p.nameB}</span></div>)}
                {intAnalysis.safe.length > 8 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>+ ещё {intAnalysis.safe.length - 8}</div>}
              </GlassCard>
            )}
            {intAnalysis.pairs.length === 0 && (
              <GlassCard title="🔬 Нет зарегистрированных взаимодействий" icon="➖" color="#60a5fa">
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 10 }}>Для данной комбинации не найдено известных взаимодействий в базе.</div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
