import React, { useState, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { type GoalType } from '../../engines/biostack-ai.engine';
import { findSupplements, findReplacement, findComplexesForSubstance, type ReplacementType, type ReplacementResult, type ComplexMatch } from '../../engines/supplement-finder.engine';
import { searchBioStack, type RecGoal } from '../../engines/biostack-recommender.engine';
import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS } from '../../data/support-database';
import { PillBtn, inputS, PURE_GOALS, ORGANS, SYSTEMS, TOP_MECHANISMS, SYMPTOMS, toFinderProfile, PRICE_RUB } from './BioStackAIConstants';
import { getEvidenceGrade, checkIngredientAllergens, findMeaningfulReplacement, fuzzySearchSupplements, decomposeComplex } from '../../engines/biostack-clinical-v2.engine';

const SRCH_EVIDENCE: Record<string, { label: string; color: string }> = {
  A: { label: 'A', color: '#22c55e' },
  B: { label: 'B', color: '#f59e0b' },
  C: { label: 'C', color: '#6366f1' },
};
import { resolveLabMarker } from '../../core/labs-mapping';
import { LAB_MARKER_MAP } from '../../data/lab-marker-map';
import type { LinkedData } from '../../core/data-link';

const TIERS = [
  { key: 'core', label: '🟢 Базовый (core)', color: '#22c55e', desc: 'Обязательно на любом курсе' },
  { key: 'standard', label: '🟡 Стандарт', color: '#eab308', desc: 'Рекомендовано при дозах >500 мг/нед' },
  { key: 'advanced', label: '🟠 Продвинутый', color: '#f97316', desc: 'При специфических целях' },
  { key: 'specialty', label: '🔴 Фарма', color: '#ef4444', desc: 'Фармакология, рецептурные' },
];

/* ─── Поисковый индекс: термин → ID веществ ─── */
function buildSearchTermMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const add = (term: string, ids: string[]) => {
    const key = term.toLowerCase().trim();
    if (!key) return;
    if (!map[key]) map[key] = [];
    ids.forEach(id => { if (!map[key].includes(id)) map[key].push(id); });
  };

  // 1. Lab markers: название маркера → correctionIds
  LAB_MARKER_MAP.forEach(m => {
    add(m.name, m.correctionIds);
    add(m.marker, m.correctionIds);
    // добавляем слова-части для частичного поиска
    m.name.split(/[\s,/-]+/).forEach(word => { if (word.length > 1) add(word, m.correctionIds); });
  });

  // 2. Все вещества: nameRu / name
  Object.values(SUPPORT_CATALOG_DATA).forEach(c => {
    const names = [c.nameRu, c.name, c.id].filter(Boolean);
    names.forEach(n => add(n, [c.id]));
  });

  // 3. Органы (из ORGANS) → вещества с этим органом
  ORGANS.forEach(o => {
    const ids = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.organs?.includes(o.key)).map(c => c.id);
    if (ids.length) add(o.label.replace(/[🫀🧠❤️🫁💪🦴🛡️⚡🫃🩸⚖️🧬🔴👁️🔬🔋]/g,'').trim(), ids);
  });

  // 4. Системы (из SYSTEMS) → вещества с этой системой
  SYSTEMS.forEach(s => {
    const ids = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.systems?.includes(s.key)).map(c => c.id);
    if (ids.length) add(s.label.replace(/[🫀🧠❤️🫁💪🦴🛡️⚡🫃🩸⚖️🧬🔴👁️🔬🔋]/g,'').trim(), ids);
  });

  // 5. Механизмы (ТЗ) → вещества — ищем по mechanismOfAction тексту
  TOP_MECHANISMS.forEach(m => {
    const kw = (m.label || '').replace(/[🛡️😌💎😊⚡🔥🔋🩸🧠💪🫁❤️🫘🧬]/g,'').trim().toLowerCase();
    if (!kw) return;
    const ids = Object.values(SUPPORT_CATALOG_DATA).filter(c => (c.mechanismOfAction || '').toLowerCase().includes(kw)).map(c => c.id);
    if (ids.length) add(m.label.replace(/[🛡️😌💎😊⚡🔥🔋🩸🧠💪🫁]/g,'').trim(), ids);
  });

  // 6. Категории → вещества
  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const ids = Object.values(SUPPORT_CATALOG_DATA).filter(c => c.category?.includes(key)).map(c => c.id);
    if (ids.length) add(label.replace(/[🛡️🫁❤️💊🧬🐟🌿🔥🦠🫘🦴⚖️🧠💪⚡🕰🔋🦋🩸😌😊🦴🧴💅👁️💧🍄🔄💊🫐🧪🔬💉]/g,'').trim(), ids);
  });

  return map;
}
const SEARCH_TERM_MAP = buildSearchTermMap();

/* ─── Есть ли в индексе по части слова ─── */
function searchByIndex(query: string): Set<string> {
  const q = query.toLowerCase().trim();
  const found = new Set<string>();
  if (!SEARCH_TERM_MAP || Object.keys(SEARCH_TERM_MAP).length === 0) return found;
  Object.entries(SEARCH_TERM_MAP).forEach(([term, ids]) => {
    if (term.includes(q)) ids.forEach(id => found.add(id));
  });
  return found;
}

type FilterType = 'cat' | 'tier' | 'organ' | 'system' | 'mech' | 'goal';

export function SearchTab({ profile, stackIds, setStackIds, linked }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void; linked?: LinkedData }) {
  const [searchText, setSearchText] = useState('');
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [organFilter, setOrganFilter] = useState<string[]>([]);
  const [systemFilter, setSystemFilter] = useState<string[]>([]);
  const [mechFilter, setMechFilter] = useState<string[]>([]);
  const [goalFilter, setGoalFilter] = useState<GoalType | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_favorites') || '[]'); } catch { return []; }
  });
  const [favOnly, setFavOnly] = useState(false);
  const [profileOnly, setProfileOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc'>('name');
  const [swapMode, setSwapMode] = useState(false);
  /* ── Replacement / Complex search popup ── */
  const [replacePopup, setReplacePopup] = useState<{ id: string; name: string; type: ReplacementType; results: { key: ReplacementType; label: string; icon: string; results: ReplacementResult[] }[]; loading: boolean } | null>(null);
  const [complexPopup, setComplexPopup] = useState<{ id: string; name: string; matches: ComplexMatch[]; loading: boolean } | null>(null);

  /* ── Pre-compute ALL replacement types on open ── */
  const openReplacePopup = useCallback((id: string, name: string) => {
    let fp;
    try { fp = toFinderProfile(profile || ({} as any)); } catch { fp = undefined as any; }
    const allTypes: { key: ReplacementType; label: string; icon: string; results: ReplacementResult[] }[] = REPLACE_TYPES.map(rt => {
      const results = findReplacement(id, rt.key, fp);
      return { key: rt.key, label: rt.label, icon: rt.icon, results };
    });
    const nonEmpty = allTypes.filter(t => t.results.length > 0);
    setReplacePopup({ id, name, type: nonEmpty[0]?.key || 'functional', results: allTypes, loading: false });
  }, [profile]);

  const switchReplaceType = useCallback((type: ReplacementType) => {
    if (!replacePopup) return;
    setReplacePopup(prev => prev ? { ...prev, type } : null);
  }, [replacePopup]);

  const openComplexPopup = useCallback((id: string, name: string) => {
    setComplexPopup({ id, name, matches: [], loading: true });
    const matches = findComplexesForSubstance(id);
    setComplexPopup(prev => prev && prev.id === id ? { ...prev, matches, loading: false } : prev);
  }, [profile]);

  const REPLACE_TYPES: { key: ReplacementType; label: string; icon: string }[] = [
    { key: 'direct_analog', label: 'Прямые аналоги', icon: '🔄' },
    { key: 'functional', label: 'Функциональные', icon: '⚙' },
    { key: 'safer', label: 'Безопаснее', icon: '🛡️' },
    { key: 'stronger', label: 'Сильнее', icon: '⚡' },
    { key: 'cheaper', label: 'Дешевле', icon: '💰' },
    { key: 'stack_to_single', label: 'Стек→Один', icon: '⬇' },
    { key: 'single_to_stack', label: 'Один→Стек', icon: '⬆' },
  ];

  const profileRelevantIds = useMemo(() => {
    if (!profileOnly) return null;
    const recGoals = profile.goals.map(g => {
      const m: Record<string, RecGoal> = {
        muscle_gain: 'performance', fat_loss: 'energy', endurance: 'performance', sleep: 'sleep',
        recovery: 'recovery', energy: 'energy', immunity: 'immunity', liver_health: 'detox',
        cardio_health: 'longevity', joints: 'joints',
        hormones: 'libido', stress: 'stress', longevity: 'longevity', detox: 'detox',
        libido: 'libido', mood: 'stress', brain: 'focus', concentration: 'focus',
        digestion: 'digestion', kidney: 'detox',
      };
      return m[g] || 'immunity';
    }).filter(g => g) as RecGoal[];
    if (recGoals.length === 0) return null;
    const results = searchBioStack({ goals: recGoals, limit: 200 }, profile);
    const scores = new Map<string, number>();
    results.forEach(r => scores.set(r.id, r.score));
    return scores;
  }, [profileOnly, profile]);

  const toggleFav = useCallback((id: string) => {
    const u = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(u);
    localStorage.setItem('he_biostack_favorites', JSON.stringify(u));
  }, [favorites]);

  const activeCats = [...new Set(Object.values(SUPPORT_CATALOG_DATA).flatMap(c => c.category || []))].filter(Boolean).sort();

  const filtered = useMemo(() => {
    let list = Object.values(SUPPORT_CATALOG_DATA);
    if (catFilter.length > 0) list = list.filter(c => c.category?.some(cat => catFilter.includes(cat)));
    if (tierFilter.length > 0) list = list.filter(c => tierFilter.includes(c.tier || ''));
    if (organFilter.length > 0) list = list.filter(c => c.organs?.some(o => organFilter.includes(o)));
    if (systemFilter.length > 0) list = list.filter(c => c.systems?.some(s => systemFilter.includes(s)));
    if (mechFilter.length > 0) {
      const labels = mechFilter.map(k => (TOP_MECHANISMS.find(t => t.key === k)?.label || '').replace(/[🛡️😌💎😊⚡🔥🔋🩸🧠💪🫁❤️🫘🧬]/g,'').trim().toLowerCase()).filter(Boolean);
      list = list.filter(c => labels.some(l => (c.mechanismOfAction || '').toLowerCase().includes(l)));
    }
    if (goalFilter) {
      const matched = findSupplements({ goal: goalFilter, profile: toFinderProfile(profile), maxResults: 999 });
      const ids = new Set(matched.map(m => m.id));
      list = list.filter(c => ids.has(c.id));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const indexedIds = searchByIndex(q);
      const directMatch = (c: typeof list[0]) =>
        (c.nameRu || c.name || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        c.category?.some(cat => (CATEGORY_LABELS[cat] || cat).toLowerCase().includes(q)) ||
        c.organs?.some(o => o.toLowerCase().includes(q)) ||
        (c.mechanismOfAction || '').toLowerCase().includes(q);
      list = list.filter(c => directMatch(c) || indexedIds.has(c.id));
    }
    if (favOnly) list = list.filter(c => favorites.includes(c.id));
    if (profileOnly && profileRelevantIds) list = list.filter(c => profileRelevantIds.has(c.id));
    if (sortBy !== 'name') {
      list = [...list].sort((a, b) => {
        const pa = PRICE_RUB[a.id] || 999999;
        const pb = PRICE_RUB[b.id] || 999999;
        return sortBy === 'price_asc' ? pa - pb : pb - pa;
      });
    } else {
      // Tier first: core > standard > advanced > specialty
      const tierOrder: Record<string,number> = { core:0, standard:1, advanced:2, specialty:3 };
      list = [...list].sort((a, b) => (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2));
    }
    return list;
  }, [catFilter, tierFilter, organFilter, systemFilter, mechFilter, goalFilter, searchText, profile, favOnly, favorites]);

    const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    filtered.forEach(c => {
      const cats = (c.category?.length ? c.category : ['other']) as string[];
      cats.forEach(cat => {
        if (!g[cat]) g[cat] = [];
        g[cat].push(c);
      });
    });
    // sort groups: by count desc, then alpha
    const entries = Object.entries(g).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    return entries;
  }, [filtered]);

  // п.5 аудита: нечёткий поиск (fuzzy) — срабатывает, когда точное совпадение пусто
  const fuzzyHits = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q || filtered.length > 0) return [] as typeof filtered;
    return fuzzySearchSupplements(q, 20)
      .map(h => SUPPORT_CATALOG_DATA[h.id])
      .filter((c): c is typeof filtered[number] => Boolean(c)) as typeof filtered;
  }, [searchText, filtered]);

  const hasAnyFilter = catFilter.length > 0 || tierFilter.length > 0 || organFilter.length > 0 || systemFilter.length > 0 || mechFilter.length > 0 || goalFilter !== null || searchText.trim() || favOnly || profileOnly;

  const clearAll = useCallback(() => {
    setCatFilter([]); setTierFilter([]); setOrganFilter([]); setSystemFilter([]);
    setMechFilter([]); setGoalFilter(null); setSearchText(''); setFavOnly(false); setProfileOnly(false);
  }, []);

  const toggleArr = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const renderFilterPill = (label: string, active: boolean, onClick: () => void, color?: string) => (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 14, fontSize: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      background: active ? `${color || '#00e68a'}18` : 'rgba(255,255,255,0.04)',
      border: active ? `1.5px solid ${color || '#00e68a'}` : '1px solid rgba(255,255,255,0.06)',
      color: active ? (color || '#00e68a') : 'rgba(255,255,255,0.5)',
      transition: 'all 0.12s',
    }}>{label}</button>
  );

  const renderActiveChips = () => {
    const chips: { label: string; onRemove: () => void }[] = [];
    catFilter.forEach(c => chips.push({ label: CATEGORY_LABELS[c] || c, onRemove: () => toggleArr(catFilter, setCatFilter, c) }));
    tierFilter.forEach(t => chips.push({ label: TIERS.find(x => x.key === t)?.label || t, onRemove: () => toggleArr(tierFilter, setTierFilter, t) }));
    organFilter.forEach(o => chips.push({ label: o, onRemove: () => toggleArr(organFilter, setOrganFilter, o) }));
    systemFilter.forEach(s => chips.push({ label: s, onRemove: () => toggleArr(systemFilter, setSystemFilter, s) }));
    mechFilter.forEach(m => chips.push({ label: TOP_MECHANISMS.find(t => t.key === m)?.label || m, onRemove: () => toggleArr(mechFilter, setMechFilter, m) }));
    if (goalFilter) chips.push({ label: '🎯 ' + (PURE_GOALS.find(g => g.key === goalFilter)?.label || goalFilter), onRemove: () => setGoalFilter(null) });
    if (favOnly) chips.push({ label: '⭐ Избранное', onRemove: () => setFavOnly(false) });
    if (profileOnly) chips.push({ label: `🧩 Под профиль (${profileRelevantIds?.size || 0})`, onRemove: () => setProfileOnly(false) });
    if (swapMode) chips.push({ label: '🔁 Свап-режим (клик → замена)', onRemove: () => setSwapMode(false) });
    return chips;
  };

  const filterPopups: { key: FilterType; icon: string; label: string; color: string; count: number }[] = [
    { key: 'cat', icon: '📂', label: 'Категория', color: '#60a5fa', count: catFilter.length },
    { key: 'tier', icon: '📊', label: 'Уровень', color: '#f59e0b', count: tierFilter.length },
    { key: 'organ', icon: '🫀', label: 'Орган', color: '#ef4444', count: organFilter.length },
    { key: 'system', icon: '⚙️', label: 'Система', color: '#22c55e', count: systemFilter.length },
    { key: 'mech', icon: '🧬', label: 'Механизм', color: '#a855f7', count: mechFilter.length },
    { key: 'goal', icon: '🎯', label: 'Цель', color: '#f59e0b', count: goalFilter ? 1 : 0 },
  ];

  const catLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c;

  const matchedLabMarkers = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.toLowerCase();
    return LAB_MARKER_MAP.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.marker.toLowerCase().includes(q) ||
      m.organ.toLowerCase().includes(q) ||
      m.system.toLowerCase().includes(q)
    );
  }, [searchText]);

  const sysLabel = (s: string) => {
    const found = SYSTEMS.find(x => x.key.toLowerCase() === s.toLowerCase());
    return found?.label || s;
  };
  const organEmoji: Record<string, string> = {
    LIVER:'🫁', KIDNEYS:'🫘', HEART:'❤️', BRAIN:'🧠', LUNGS:'🫁', MUSCLES:'💪',
    BONES:'🦴', JOINTS:'🦴', SKIN:'🧴', IMMUNE_SYSTEM:'🛡️', NERVES:'⚡', GUT:'🫃',
    VESSELS:'🩸', ADRENALS:'⚖️', THYROID:'🦋', REPRODUCTIVE:'🧬', PROSTATE:'🔴',
    BLOOD:'🩸', EYES:'👁️', PANCREAS:'🫁', CELLS:'🔬', MITOCHONDRIA:'🔋',
    ENDOCRINE:'⚖️', PITUITARY:'🧠',
  };

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="🔍 Название, орган, механизм, категория..."
          style={{ ...inputS, fontSize: 11 }} />
        {hasAnyFilter && (
          <button onClick={clearAll} style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 9, cursor: 'pointer',
            background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap',
          }}>✕</button>
        )}
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {filterPopups.map(fp => (
          <button key={fp.key} onClick={() => setOpenFilter(openFilter === fp.key ? null : fp.key)}
            style={{
              flexShrink: 0, padding: '6px 10px', borderRadius: 12, fontSize: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: openFilter === fp.key ? fp.color + '15' : 'rgba(255,255,255,0.03)',
              border: openFilter === fp.key ? `1.5px solid ${fp.color}55` : '1px solid rgba(255,255,255,0.06)',
              color: openFilter === fp.key ? fp.color : 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>{fp.icon}</span> {fp.label}
            {fp.count > 0 && <span style={{ padding: '1px 5px', borderRadius: 8, background: fp.color + '25', color: fp.color, fontSize: 7, fontWeight: 700 }}>{fp.count}</span>}
          </button>
        ))}
        <button onClick={() => setFavOnly(!favOnly)} style={{
          flexShrink: 0, padding: '6px 10px', borderRadius: 12, fontSize: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          background: favOnly ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
          border: favOnly ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
          color: favOnly ? '#f59e0b' : 'rgba(255,255,255,0.5)',
        }}>⭐ Избранное</button>
        <button onClick={() => setProfileOnly(!profileOnly)} style={{
          flexShrink: 0, padding: '6px 10px', borderRadius: 12, fontSize: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          background: profileOnly ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
          border: profileOnly ? '1.5px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)',
          color: profileOnly ? '#8b5cf6' : 'rgba(255,255,255,0.5)',
        }}>🧩 Под профиль</button>
        <button onClick={() => setSortBy(sortBy === 'name' ? 'price_asc' : sortBy === 'price_asc' ? 'price_desc' : 'name')} style={{
          flexShrink: 0, padding: '6px 10px', borderRadius: 12, fontSize: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          background: sortBy !== 'name' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
          border: sortBy !== 'name' ? '1.5px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.06)',
          color: sortBy !== 'name' ? '#22c55e' : 'rgba(255,255,255,0.5)',
        }}>💰 {sortBy === 'price_asc' ? 'Дешевле' : sortBy === 'price_desc' ? 'Дороже' : 'По цене'}</button>
        <button onClick={() => setSwapMode(!swapMode)} style={{
          flexShrink: 0, padding: '6px 10px', borderRadius: 12, fontSize: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          background: swapMode ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
          border: swapMode ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
          color: swapMode ? '#ef4444' : 'rgba(255,255,255,0.5)',
        }} title="Клик по + открывает замену вместо добавления">🔁 Свап-режим</button>
      </div>

      {/* Filter popups */}
      {openFilter === 'cat' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {activeCats.map(c => renderFilterPill(catLabel(c), catFilter.includes(c), () => toggleArr(catFilter, setCatFilter, c), '#60a5fa'))}
        </div>
      )}
      {openFilter === 'tier' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {TIERS.map(t => renderFilterPill(t.label, tierFilter.includes(t.key), () => toggleArr(tierFilter, setTierFilter, t.key), t.color))}
        </div>
      )}
      {openFilter === 'organ' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {ORGANS.map(o => renderFilterPill(o.label, organFilter.includes(o.key), () => toggleArr(organFilter, setOrganFilter, o.key), '#ef4444'))}
        </div>
      )}
      {openFilter === 'system' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {SYSTEMS.map(s => renderFilterPill(s.label, systemFilter.includes(s.key), () => toggleArr(systemFilter, setSystemFilter, s.key), '#22c55e'))}
        </div>
      )}
      {openFilter === 'mech' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {TOP_MECHANISMS.map(m => renderFilterPill(m.label, mechFilter.includes(m.key), () => toggleArr(mechFilter, setMechFilter, m.key), '#a855f7'))}
        </div>
      )}
      {openFilter === 'goal' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0', marginBottom: 6 }}>
          {PURE_GOALS.map(g => renderFilterPill(g.label, goalFilter === g.key, () => setGoalFilter(goalFilter === g.key ? null : g.key), '#f59e0b'))}
        </div>
      )}

      {/* Active filter chips */}
      {renderActiveChips().length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
          {renderActiveChips().map((chip, i) => (
            <span key={i} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
              {chip.label}
              <span onClick={chip.onRemove} style={{ cursor: 'pointer', marginLeft: 2, color: '#ef4444' }}>✕</span>
            </span>
          ))}
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', alignSelf: 'center' }}>{filtered.length} препаратов</span>
        </div>
      )}

      {/* Quick symptoms when no filter */}
      {!hasAnyFilter && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Быстрый подбор по симптомам:</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {SYMPTOMS.map(s => (
              <PillBtn key={s.label} small onClick={() => setGoalFilter(s.goal)}>{s.label}</PillBtn>
            ))}
          </div>
        </div>
      )}

      {/* Current stack chips */}
      {stackIds.length > 0 && (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', alignSelf: 'center' }}>📋 Стек:</span>
          {stackIds.slice(0, 8).map(id => {
            const c = SUPPORT_CATALOG_DATA[id];
            return (
              <span key={id} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
                {c?.nameRu || c?.name || id}
                <span onClick={() => setStackIds(stackIds.filter(s => s !== id))} style={{ cursor: 'pointer', marginLeft: 2, color: '#ef4444' }}>✕</span>
              </span>
            );
          })}
          {stackIds.length > 8 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>+{stackIds.length - 8}</span>}
        </div>
      )}

      {/* Lab markers section */}
      {matchedLabMarkers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            padding: '6px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.08)', marginBottom: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa' }}>🧪 Анализы (лабораторные маркеры)</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{matchedLabMarkers.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {matchedLabMarkers.map(m => {
              const orgEmoji = organEmoji[m.organ] || '🫀';
              const sysLabelText = sysLabel(m.system);
              return (
                <div key={m.marker} style={{
                  borderRadius: 12, background: 'rgba(24,24,27,0.6)',
                  border: '1px solid rgba(139,92,246,0.08)', overflow: 'hidden',
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 4 }}>
                    {m.name} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>({m.marker})</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>норма: до {m.defaultValue} {m.unit}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 7, fontWeight: 600,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', color: '#f87171' }}>
                      {orgEmoji} {m.organ}
                    </span>
                    <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 7, fontWeight: 600,
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      ⚙️ {sysLabelText}
                    </span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', alignSelf: 'center' }}>
                      {m.higherIsWorse ? '↑ опасен' : '↓ опасен'}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>💊 Рекомендуемые препараты:</div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {m.correctionIds.map(id => {
                        const cat = SUPPORT_CATALOG_DATA[id];
                        if (!cat) return null;
                        const inStack = stackIds.includes(id);
                        return (
                          <div key={id} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer',
                            background: inStack ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
                            border: inStack ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.06)',
                            color: inStack ? '#00e68a' : 'rgba(255,255,255,0.5)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                            onClick={() => inStack ? setStackIds(stackIds.filter(s => s !== id)) : setStackIds([...stackIds, id])}>
                            {cat.nameRu || cat.name}
                            <span style={{ fontSize: 7, color: inStack ? '#ef4444' : '#00e68a' }}>
                              {inStack ? '✕' : '+'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Catalog groups */}
      {grouped.length === 0 && matchedLabMarkers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          {favOnly ? '⭐ Нет избранных препаратов' : 'Ничего не найдено. Измените фильтры.'}
        </div>
      )}

      {fuzzyHits.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b' }}>🔍 Нечёткие совпадения (fuzzy)</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{fuzzyHits.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {fuzzyHits.map(c => {
              const isFav = favorites.includes(c.id);
              const inStack = stackIds.includes(c.id);
              const tierInfo = TIERS.find(t => t.key === c.tier);
              return (
                <div key={c.id} style={{ borderRadius: 10, background: inStack ? 'rgba(0,230,138,0.04)' : 'rgba(24,24,27,0.5)', border: inStack ? '1px solid rgba(0,230,138,0.12)' : '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{c.nameRu || c.name}</span>
                        {(() => { const g = getEvidenceGrade(c.id); const ev = SRCH_EVIDENCE[g] || SRCH_EVIDENCE.C; return <span key="ev" title={`Доказательность: ${g}`} style={{ padding: '1px 4px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: ev.color + '18', color: ev.color, border: `1px solid ${ev.color}30` }}>{ev.label}</span>; })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {grouped.map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 8 }}>
          <div style={{
            padding: '6px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)',
            border: '1px solid rgba(96,165,250,0.08)', marginBottom: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa' }}>{catLabel(cat)}</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{items.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.map(c => {
              const isFav = favorites.includes(c.id);
              const inStack = stackIds.includes(c.id);
              const exp = expanded[c.id];
              const tierInfo = TIERS.find(t => t.key === c.tier);
              return (
                <div key={c.id} style={{
                  borderRadius: 10, background: inStack ? 'rgba(0,230,138,0.04)' : 'rgba(24,24,27,0.5)',
                  border: inStack ? '1px solid rgba(0,230,138,0.12)' : '1px solid rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                }}>
                  <div onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !exp }))}
                    style={{ padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div onClick={e => { e.stopPropagation(); toggleFav(c.id); }} style={{ cursor: 'pointer', fontSize: 9, flexShrink: 0 }}>
                      {isFav ? '⭐' : '☆'}
                    </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                         <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{c.nameRu || c.name}</span>
                         {(() => { const g = getEvidenceGrade(c.id); const ev = SRCH_EVIDENCE[g] || SRCH_EVIDENCE.C; return <span key="ev" title={`Доказательность: ${g}`} style={{ padding: '1px 4px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: ev.color + '18', color: ev.color, border: `1px solid ${ev.color}30` }}>{ev.label}</span>; })()}
                         {(() => { const hits = checkIngredientAllergens([c.id], profile?.drugAllergies || []); return hits.length > 0 ? <span key="al" title={`Возможная аллергия: ${hits.map(h => h.allergen).join(', ')}`} style={{ padding: '1px 4px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>⚠ Аллергия</span> : null; })()}
                       </div>
                       <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {tierInfo && (
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, fontWeight: 700, background: tierInfo.color + '20', color: tierInfo.color, border: `1px solid ${tierInfo.color}30` }}>
                              {tierInfo.label}
                            </span>
                          )}
                          {profileOnly && profileRelevantIds && profileRelevantIds.has(c.id) && (
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, fontWeight: 700, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                              🎯 {profileRelevantIds.get(c.id) || 0}
                            </span>
                          )}
                        {c.category?.slice(0, 3).map((cc: string) => (
                          <span key={cc} style={{ padding: '1px 4px', borderRadius: 3, fontSize: 6, background: 'rgba(96,165,250,0.08)', color: '#60a5fa' }}>
                            {catLabel(cc)}
                          </span>
                        ))}
                        {c.organs?.slice(0, 2).map((o: string) => (
                          <span key={o} style={{ padding: '1px 4px', borderRadius: 3, fontSize: 6, background: 'rgba(239,68,68,0.06)', color: '#f87171' }}>
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); openReplacePopup(c.id, c.nameRu || c.name); }}
                        title="Найти замену"
                        style={{ padding: '8px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6' }}>
                        🔄
                      </button>
                      {inStack ? (
                        <button onClick={e => { e.stopPropagation(); setStackIds(stackIds.filter(s => s !== c.id)); }}
                          style={{ padding: '8px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          ✕
                        </button>
                      ) : swapMode ? (
                        <button onClick={e => { e.stopPropagation(); openReplacePopup(c.id, c.nameRu || c.name); }}
                          style={{ padding: '8px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          🔁
                        </button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setStackIds([...stackIds, c.id]); }}
                          style={{ padding: '8px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                          +
                        </button>
                      )}
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{exp ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {exp && (
                    <div style={{ padding: '0 8px 6px' }}>
                      {c.description && (
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, marginBottom: 4 }}>
                          📝 {c.description}
                        </div>
                      )}
                      {c.organs && c.organs.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginRight: 2 }}>🫀</span>
                          {c.organs.map((o: string) => (
                            <span key={o} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 7, background: 'rgba(239,68,68,0.06)', color: '#f87171' }}>{o}</span>
                          ))}
                        </div>
                      )}
                      {c.synergies && c.synergies.length > 0 && (
                        <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.06)', marginBottom: 3 }}>
                          <div style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600 }}>🤝 Синергии:</div>
                          {c.synergies.slice(0, 3).map((s: any, i: number) => (
                            <div key={i} style={{ fontSize: 7, color: '#a78bfa' }}>• {s.effect}</div>
                          ))}
                        </div>
                      )}
                      {c.conflicts && c.conflicts.length > 0 && (
                        <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: 3 }}>
                          <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>🚫 Конфликты:</div>
                          {c.conflicts.slice(0, 2).map((cc: any, i: number) => (
                            <div key={i} style={{ fontSize: 7, color: '#f87171' }}>• {cc.effect}</div>
                          ))}
                        </div>
                      )}
                      {c.dosage && <div style={{ fontSize: 7, color: '#60a5fa', marginTop: 2 }}>💊 {c.dosage.mg} мг{c.dosage.timing ? ` • ${c.dosage.timing}` : ''}</div>}
                      {tierInfo && <div style={{ fontSize: 7, color: tierInfo.color, marginTop: 2 }}>{tierInfo.desc}</div>}
                      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); openReplacePopup(c.id, c.nameRu || c.name); }} style={{
                          flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 7, fontWeight: 700, cursor: 'pointer',
                          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#8b5cf6',
                        }}>🔄 Найти замену</button>
                        <button onClick={(e) => { e.stopPropagation(); openComplexPopup(c.id, c.nameRu || c.name); }} style={{
                          flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 7, fontWeight: 700, cursor: 'pointer',
                          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24',
                        }}>📦 Найти комплекс</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {/* ── Replacement popup (optimized: all types with counts) ── */}
      {replacePopup && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 251,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }} onClick={() => setReplacePopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '90%', maxWidth: 360, maxHeight: '80vh', borderRadius: 16,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)' }} />
            <div style={{ padding: '14px 16px', maxHeight: 'calc(80vh - 3px)', overflowY: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 10 }}>
                🔄 Замена: {replacePopup.name}
              </div>
              {replacePopup.loading ? (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>Загрузка...</div>
              ) : (
                <>
                  {/* Lab-aware meaningful replacement (v2 engine) */}
                  {(() => {
                    let mr: ReturnType<typeof findMeaningfulReplacement> = null;
                    try { mr = findMeaningfulReplacement(replacePopup.id, profile || ({} as any)); } catch { mr = null; }
                    if (!mr) return null;
                    const cat = SUPPORT_CATALOG_DATA[mr.replacementId];
                    if (!cat) return null;
                    const inStack = stackIds.includes(mr.replacementId);
                    return (
                      <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.14)' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>💊 Осмысленная замена (по анализам/профилю)</div>
                        <div onClick={() => {                         const oldLow = (replacePopup.id || '').toLowerCase();
                        const ns = stackIds.some(s => s.toLowerCase() === oldLow) ? stackIds.map(s => s.toLowerCase() === oldLow ? mr.replacementId : s) : [...stackIds.filter(s => s.toLowerCase() !== oldLow), mr.replacementId]; setStackIds(ns); setReplacePopup(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{mr.replacementName}{mr.gradeUpgrade ? <span style={{ marginLeft: 5, padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>↑ грейд</span> : null}</div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, marginTop: 2 }}>{mr.reason}</div>
                            {mr.safetyNote ? <div style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3, marginTop: 2 }}>⚠ {mr.safetyNote}</div> : null}
                          </div>
                          {!inStack && <span style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', flexShrink: 0 }}>Заменить →</span>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Type selector - vertical list with counts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                    {replacePopup.results.map(rt => (
                      <button key={rt.key} onClick={() => switchReplaceType(rt.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', border: 'none',
                        background: replacePopup.type === rt.key ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                        color: replacePopup.type === rt.key ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.12s',
                      }}>
                        <span style={{ fontSize: 10 }}>{rt.icon}</span>
                        <span style={{ flex: 1, textAlign: 'left' }}>{rt.label}</span>
                        <span style={{
                          padding: '2px 6px', borderRadius: 8, fontSize: 7, fontWeight: 700,
                          background: rt.results.length > 0 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                          color: rt.results.length > 0 ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                        }}>{rt.results.length}</span>
                      </button>
                    ))}
                  </div>
                  {/* Results for selected type */}
                  {(() => {
                    const active = replacePopup.results.find(rt => rt.key === replacePopup.type);
                    if (!active || active.results.length === 0) {
                      return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>
                        Нет результатов по этому типу
                      </div>;
                    }
                    return active.results.slice(0, 6).map((r, i) => (
                      <div key={i} onClick={() => {
                        const oldLow = (replacePopup.id || '').toLowerCase();
                        const newStack = stackIds.some(s => s.toLowerCase() === oldLow)
                          ? stackIds.map(s => s.toLowerCase() === oldLow ? r.replacementId : s)
                          : [...stackIds.filter(s => s.toLowerCase() !== oldLow), r.replacementId];
                        setStackIds(newStack);
                        setReplacePopup(null);
                      }} style={{
                        padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                        background: r.personalMatch ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${r.personalMatch ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{r.replacementName}</span>
                          <span style={{ fontSize: 7, padding: '2px 6px', borderRadius: 6,
                            background: r.tierChange === 'upgrade' ? 'rgba(34,197,94,0.1)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                            color: r.tierChange === 'upgrade' ? '#22c55e' : r.tierChange === 'downgrade' ? '#ef4444' : 'rgba(255,255,255,0.5)',
                          }}>{r.tierLabel}</span>
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{r.explanation}</div>
                        <div style={{ display: 'flex', gap: 4, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                          <span>{r.bestForm}</span>
                          <span style={{ color: r.priceDelta === 'cheaper' ? '#22c55e' : r.priceDelta === 'expensive' ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                            {r.priceDelta === 'cheaper' ? '💰' : r.priceDelta === 'expensive' ? '💎' : ''}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
              <button onClick={() => setReplacePopup(null)} style={{
                width: '100%', padding: '10px 0', borderRadius: 10, marginTop: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
              }}>✕ Закрыть</button>
            </div>
          </div>
        </div>
      , document.body)}
      {/* ── Complex popup ── */}
      {complexPopup && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 251,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }} onClick={() => setComplexPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '90%', maxWidth: 360, maxHeight: '75vh', borderRadius: 16,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />
            <div style={{ padding: '14px 16px', maxHeight: 'calc(75vh - 3px)', overflowY: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                📦 Комплексы с: {complexPopup.name}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                Комплексы, в состав которых входит это вещество
              </div>
              {complexPopup.loading ? (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>Загрузка...</div>
              ) : complexPopup.matches.length > 0 ? complexPopup.matches.map((m, i) => {
                const cEntry = SUPPORT_CATALOG_DATA[m.complexId];
                const allComps = m.matchedIds.map(cid => SUPPORT_CATALOG_DATA[cid]?.nameRu || SUPPORT_CATALOG_DATA[cid]?.name || cid);
                return (
                  <div key={i} onClick={() => {
                    const newStack = [...stackIds.filter(s => s !== complexPopup.id), m.complexId];
                    if (!newStack.includes(m.complexId)) newStack.push(m.complexId);
                    setStackIds(newStack);
                    setComplexPopup(null);
                  }} style={{
                    padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>
                        {m.complexName}
                      </span>
                      <span style={{ fontSize: 7, padding: '2px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        {m.matchedIds.length}/{m.totalComponents} компон.
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
                      {allComps.slice(0, 6).map((cn, j) => (
                        <span key={j} style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>
                          {cn}
                        </span>
                      ))}
                      {allComps.length > 6 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>+{allComps.length - 6}</span>}
                    </div>
                    {cEntry?.description && (
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>📝 {cEntry.description.slice(0, 120)}</div>
                    )}
                    {(() => {
                      const comps = decomposeComplex(m.complexId);
                      if (comps.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>🔬 Состав:</span>
                          {comps.slice(0, 8).map((cp, k) => (
                            <span key={k} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                              {cp.componentName}
                            </span>
                          ))}
                          {comps.length > 8 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>+{comps.length - 8}</span>}
                        </div>
                      );
                    })()}
                  </div>
                );
              }) : (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>
                  Комплексы не найдены в базе
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
