import React, { useState, useMemo, useCallback } from 'react';
import { SUPPORT_CATALOG_DATA, type SupportCatalogEntry } from '../../../data/support-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import { PEPTIDE_DB } from '../../../engines/peptide-calculator.engine';
import { InfoErrorBoundary } from './SupportScreenData';
import { S } from './SupportShared';
import {
  type FormWithBio, type EnrichedEntry, type EnhancerInfo, type CompetitorInfo, type StatsInfo,
  getCatalogFormBio, detectEnhancers, detectCompetition, classifySubstance,
  bioColor, bioLabel, COST_PER_GRAM, FORM_BIOAVAIL,
  ABSORPTION_SITES, THERAPEUTIC_WINDOWS, HALF_LIFE_INFO, FOOD_TIMING, PERSONAL_ADJUSTERS, MODIFIERS,
  TIMING_SLOTS, CATEGORY_TIMING, type TimeSlot, type TimingSlot, type SubstanceTiming,
  LAB_MARKERS, type LabMarker, LOADING_PROTOCOLS, type LoadingProtocol,
  FORM_RECOMMENDER, type FormRecommendation,
} from './SupportBioavailabilityData';

// ─── Build enriched catalog ───
function buildCatalog(): EnrichedEntry[] {
  const entries: EnrichedEntry[] = [];
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (!entry?.nameRu) continue;
    const forms: FormWithBio[] = (entry.forms || []).map(f => {
      const bio = getCatalogFormBio(f);
      return { ...f, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (doseMg: number) => Math.round(doseMg * bio) };
    });
    const bios = forms.map(f => f.bioavailability);
    const clinical = classifySubstance(entry.nameRu, entry.category || []);
    entries.push({
      id, source: 'catalog', nameRu: entry.nameRu, nameEn: entry.name || id,
      tier: entry.tier, category: entry.category || [], description: entry.description || '',
      forms, maxBio: bios.length ? Math.max(...bios) : 0, minBio: bios.length ? Math.min(...bios) : 0,
      avgBio: bios.length ? bios.reduce((a, b) => a + b, 0) / bios.length : 0,
      bestForm: forms.find(f => f.best) || null,
      enhancers: detectEnhancers(entry), competitors: detectCompetition(entry, entry.nameRu, entry.category),
      absorptionKey: clinical.abs, halfLifeKey: clinical.hl, foodKey: clinical.food, windowKey: clinical.win, costPerGram: clinical.cost,
    });
  }
  for (const [pid, ph] of Object.entries(PHARMA_DB)) {
    if (!ph || !ph.name) continue;
    const bio = ph.pk?.bioavailability ?? (ph.bioavailability ? (typeof ph.bioavailability === 'number' ? ph.bioavailability : (typeof ph.bioavailability === 'object' && 'avg' in (ph.bioavailability as any) ? (ph.bioavailability as any).avg : 0.85)) : 0.85);
    const forms: FormWithBio[] = [{ id: pid, name: ph.name, nameRu: ph.name, dose: ph.dosageRange ? `${ph.dosageRange.min}-${ph.dosageRange.max} ${ph.dosageRange.unit}` : '—', best: true, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (d: number) => Math.round(d * bio) }];
    entries.push({ id: pid, source: 'pharma', nameRu: ph.name, nameEn: ph.name || pid, tier: 'standard', category: ['pharma', (ph as any).class || 'aas'].filter(Boolean), description: ph.description || '', forms, maxBio: bio, minBio: bio, avgBio: bio, bestForm: forms[0], enhancers: [], competitors: [], absorptionKey: 'stomach', halfLifeKey: '', foodKey: 'antioxidant', windowKey: '', costPerGram: null });
  }
  for (const [pepId, pp] of Object.entries(PEPTIDE_DB)) {
    if (!pp || !pp.name) continue;
    const forms: FormWithBio[] = (pp.routes || []).map(rt => {
      const b = pp.bioavailability?.[rt]; const bio = b ? (b.min + b.max) / 2 / 100 : 0.80;
      return { id: `${pepId}_${rt}`, name: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`, nameRu: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`, dose: `${pp.amountMg} мг`, best: rt === 'sc', bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, notes: b ? `диапазон ${b.min}-${b.max}%` : '', effectiveDose: (d: number) => Math.round(d * bio) };
    });
    const bios = forms.map(f => f.bioavailability);
    entries.push({ id: pepId, source: 'peptide', nameRu: pp.name, nameEn: pp.name || pepId, tier: 'advanced', category: ['peptide', pp.className || 'gh_peptide'].filter(Boolean), description: `${pp.effects?.join(', ') || ''}`, forms, maxBio: bios.length ? Math.max(...bios) : 0, minBio: bios.length ? Math.min(...bios) : 0, avgBio: bios.length ? bios.reduce((a, b) => a + b, 0) / bios.length : 0, bestForm: forms[0] || null, enhancers: [], competitors: [], absorptionKey: 'sublingual_area', halfLifeKey: '', foodKey: 'antioxidant', windowKey: '', costPerGram: null });
  }
  return entries;
}

// Missing import from data module
import { ROUTE_LABELS_MAP } from './SupportBioavailabilityData';

// ─── Main component ───
type BTab = 'catalog' | 'calculator' | 'stats' | 'timing' | 'synergy';

export const SupportBioavailability: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [tab, setTab] = useState<BTab>(() => (localStorage.getItem('he_bio_tab') as BTab) || 'catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'bio' | 'name' | 'forms'>('bio');
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem('he_bio_selected'));
  const [compareIds, setCompareIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_bio_compare') || '[]'); } catch { return []; } });
  const [showCompare, setShowCompare] = useState(compareIds.length > 0);

  const catalog = useMemo(() => buildCatalog(), []);
  const allCategories = useMemo(() => { const c = new Set<string>(); catalog.forEach(e => e.category.forEach(cat => c.add(cat))); return Array.from(c).sort(); }, [catalog]);
  const filtered = useMemo(() => {
    let list = catalog; const q = searchQuery.toLowerCase();
    if (q) list = list.filter(e => e.nameRu.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.category.some(c => c.toLowerCase().includes(q)));
    if (categoryFilter !== 'all') list = list.filter(e => e.category.includes(categoryFilter));
    if (sourceFilter !== 'all') list = list.filter(e => e.source === sourceFilter);
    if (sortBy === 'bio') list.sort((a, b) => b.maxBio - a.maxBio);
    else if (sortBy === 'name') list.sort((a, b) => a.nameRu.localeCompare(b.nameRu));
    else list.sort((a, b) => b.forms.length - a.forms.length);
    return list;
  }, [catalog, searchQuery, categoryFilter, sourceFilter, sortBy]);
  const selected = selectedId ? catalog.find(e => e.id === selectedId) : null;
  const handleSelect = useCallback((id: string | null) => { setSelectedId(id); if (id) localStorage.setItem('he_bio_selected', id); else localStorage.removeItem('he_bio_selected'); }, []);
  const handleCompare = useCallback((id: string) => { let next: string[]; if (compareIds.includes(id)) next = compareIds.filter(x => x !== id); else if (compareIds.length < 4) next = [...compareIds, id]; else return; setCompareIds(next); localStorage.setItem('he_bio_compare', JSON.stringify(next)); }, [compareIds]);
  const compareEntries = showCompare ? compareIds.map(id => catalog.find(e => e.id === id)).filter(Boolean) as EnrichedEntry[] : [];

  const stats: StatsInfo = useMemo(() => {
    const all = catalog.filter(e => e.source === 'catalog'), pharma = catalog.filter(e => e.source === 'pharma'), peptides = catalog.filter(e => e.source === 'peptide');
    const allBio = all.map(e => e.maxBio), avg = allBio.length ? allBio.reduce((a, b) => a + b, 0) / allBio.length : 0;
    const sorted = [...allBio].sort((a, b) => a - b), median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return { total: catalog.length, supp: all.length, pharma: pharma.length, peptides: peptides.length, avgBio: avg, medianBio: median, highBio: all.filter(e => e.maxBio >= 0.6).length, midBio: all.filter(e => e.maxBio >= 0.35 && e.maxBio < 0.6).length, lowBio: all.filter(e => e.maxBio < 0.35).length, multiForm: all.filter(e => e.forms.length > 1).length };
  }, [catalog]);

  return (
    <InfoErrorBoundary label="Калькулятор биодоступности">
      <div style={{ padding: '4px 0 80px' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={S.h2}>🧬 Калькулятор биодоступности</div>
          <div style={{ ...S.sub, marginBottom: 6 }}>
            Сравнение форм, расчёт эффективной дозы, стратегии улучшения всасывания · {stats.total} веществ
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['catalog', 'calculator', 'timing', 'synergy', 'stats'] as BTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); localStorage.setItem('he_bio_tab', t); }}
              style={{ padding: '5px 10px', borderRadius: 14, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: tab === t ? 'var(--accent)' : 'var(--bg-secondary)', color: tab === t ? '#000' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              {t === 'catalog' ? '📋 Каталог' : t === 'calculator' ? '🧮 Расчёт' : t === 'timing' ? '⏰ Тайминг' : t === 'synergy' ? '🔄 Синергия' : '📊 Статистика'}
            </button>
          ))}
        </div>
        {tab === 'catalog' && <CatalogTab catalog={catalog} filtered={filtered} allCategories={allCategories} searchQuery={searchQuery} setSearchQuery={setSearchQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} sortBy={sortBy} setSortBy={setSortBy} selectedId={selectedId} handleSelect={handleSelect} compareIds={compareIds} handleCompare={handleCompare} showCompare={showCompare} setShowCompare={setShowCompare} compareEntries={compareEntries} />}
        {tab === 'calculator' && <CalculatorTab catalog={catalog} />}
        {tab === 'timing' && <TimingTab catalog={catalog} />}
        {tab === 'synergy' && <SynergyTab catalog={catalog} />}
        {tab === 'stats' && <StatsTab stats={stats} catalog={catalog} />}
      </div>
    </InfoErrorBoundary>
  );
};

// ─── Catalog tab ───
interface CatalogTabProps { catalog: EnrichedEntry[]; filtered: EnrichedEntry[]; allCategories: string[]; searchQuery: string; setSearchQuery: (v: string) => void; categoryFilter: string; setCategoryFilter: (v: string) => void; sourceFilter: string; setSourceFilter: (v: string) => void; sortBy: 'bio' | 'name' | 'forms'; setSortBy: (v: 'bio' | 'name' | 'forms') => void; selectedId: string | null; handleSelect: (id: string | null) => void; compareIds: string[]; handleCompare: (id: string) => void; showCompare: boolean; setShowCompare: (v: boolean) => void; compareEntries: EnrichedEntry[]; }
const CatalogTab: React.FC<CatalogTabProps> = ({ catalog, filtered, allCategories, searchQuery, setSearchQuery, categoryFilter, setCategoryFilter, sourceFilter, setSourceFilter, sortBy, setSortBy, selectedId, handleSelect, compareIds, handleCompare, showCompare, setShowCompare, compareEntries }) => {
  const selected = selectedId ? catalog.find(e => e.id === selectedId) : null;
  if (selected) return <DetailView entry={selected} onBack={() => handleSelect(null)} catalog={catalog} />;
  return (
    <div>
      <div style={{ ...S.card, marginBottom: 10, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск..." style={{ flex: 1, minWidth: 100, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 10 }} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '5px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 100 }}><option value="all">Все категории</option>{allCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ padding: '5px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 80 }}><option value="all">Все типы</option><option value="catalog">БАД</option><option value="pharma">Фарма</option><option value="peptide">Пептиды</option></select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '5px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 100 }}><option value="bio">По био</option><option value="name">По алфавиту</option><option value="forms">По формам</option></select>
        <button onClick={() => setShowCompare(!showCompare)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: showCompare ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)', color: showCompare ? '#00e68a' : 'var(--text-dim)', fontSize: 9, fontWeight: 700 }}>{showCompare ? '✓ Сравнение' : '⚖'}</button>
      </div>
      {showCompare && <ComparePanel compareEntries={compareEntries} compareIds={compareIds} handleCompare={handleCompare} />}
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>{filtered.length} из {catalog.length} веществ</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(item => (
          <div key={item.id} onClick={() => handleSelect(item.id)} style={{ ...S.card, cursor: 'pointer', border: compareIds.includes(item.id) ? '1px solid rgba(0,230,138,0.4)' : S.card.border, background: compareIds.includes(item.id) ? 'rgba(0,230,138,0.04)' : S.card.background }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 1 }}>{item.nameRu}<span style={{ fontSize: 7, color: 'var(--text-dim)', marginLeft: 4 }}>{item.source === 'catalog' ? (item.tier === 'core' ? '⭐' : '✦') : item.source === 'pharma' ? '💊' : '🧬'} · {item.category.slice(0, 2).join(', ')}</span></div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{item.forms.length} форм · {bioLabel(item.maxBio)}</div>
              </div>
              {showCompare && <div onClick={e => { e.stopPropagation(); handleCompare(item.id); }} style={{ padding: '2px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: compareIds.includes(item.id) ? '1px solid #00e68a' : '1px solid var(--border)', color: compareIds.includes(item.id) ? '#00e68a' : 'var(--text-dim)', background: compareIds.includes(item.id) ? 'rgba(0,230,138,0.08)' : 'transparent', flexShrink: 0 }}>{compareIds.includes(item.id) ? '✓' : '+'}</div>}
            </div>
            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ height: 4, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, minWidth: 3, background: item.forms.length > 1 ? `linear-gradient(90deg, #f44336 ${item.minBio * 100}%, #ff9800 ${(item.minBio + (item.maxBio - item.minBio) * 0.4) * 100}%, #00e68a ${item.maxBio * 100}%)` : bioColor(item.maxBio), width: `${item.maxBio * 100}%` }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, color: bioColor(item.maxBio) }}>{(item.maxBio * 100).toFixed(0)}%</span>
            </div>
            {item.enhancers.length > 0 && <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>{item.enhancers.slice(0, 3).map(e => <span key={e.label} style={{ padding: '1px 4px', borderRadius: 3, fontSize: 6, fontWeight: 600, background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>{e.label}</span>)}{item.enhancers.length > 3 && <span style={{ fontSize: 6, color: 'var(--text-dim)' }}>+{item.enhancers.length - 3}</span>}</div>}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ ...S.card, textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 11 }}>Ничего не найдено</div>}
      </div>
    </div>
  );
};

// ─── Compare panel ───
const ComparePanel: React.FC<{ compareEntries: EnrichedEntry[]; compareIds: string[]; handleCompare: (id: string) => void }> = ({ compareEntries, compareIds, handleCompare }) => {
  if (compareEntries.length === 0) return null;
  return (
    <div style={{ ...S.card, marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareEntries.length, 3)}, 1fr)`, gap: 6 }}>
        {compareEntries.map(ce => (
          <div key={ce.id} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{ce.nameRu}</div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{ce.forms.length} форм · {ce.source}</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, margin: '2px 0', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, #f44336 ${ce.minBio * 100}%, #ff9800 ${(ce.minBio + (ce.maxBio - ce.minBio) * 0.4) * 100}%, #00e68a ${ce.maxBio * 100}%)`, width: `${ce.maxBio * 100}%`, minWidth: 3 }} />
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{(ce.minBio * 100).toFixed(0)}–{(ce.maxBio * 100).toFixed(0)}%</div>
            <button onClick={() => handleCompare(ce.id)} style={{ marginTop: 1, padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(244,63,94,0.3)', background: 'transparent', color: '#f44336', fontSize: 7, cursor: 'pointer' }}>Убрать</button>
          </div>
        ))}
      </div>
      {compareEntries.length >= 2 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 8, borderTop: '1px solid var(--border)' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><th style={{ padding: 2, textAlign: 'left', color: 'var(--text-dim)', fontSize: 7 }}>Параметр</th>{compareEntries.map(ce => <th key={ce.id} style={{ padding: 2, textAlign: 'center', color: 'var(--text-dim)', fontSize: 7 }}>{ce.nameRu}</th>)}</tr></thead>
          <tbody>
            <tr><td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 7 }}>Форм</td>{compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 7 }}>{ce.forms.length}</td>)}</tr>
            <tr><td style={{ padding: 2, color: '#f44336', fontSize: 7 }}>Мин</td>{compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 7, color: '#f44336' }}>{(ce.minBio * 100).toFixed(0)}%</td>)}</tr>
            <tr><td style={{ padding: 2, color: '#00e68a', fontSize: 7 }}>Макс</td>{compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 7, color: '#00e68a' }}>{(ce.maxBio * 100).toFixed(0)}%</td>)}</tr>
            <tr><td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 7 }}>Лучшая</td>{compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 7 }}>{ce.bestForm?.nameRu || '—'}</td>)}</tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

// ─── Detail view ───
const DetailView: React.FC<{ entry: EnrichedEntry; onBack: () => void; catalog: EnrichedEntry[] }> = ({ entry, onBack, catalog }) => {
  const [doseMg, setDoseMg] = useState(entry.forms[0] && !isNaN(Number(entry.forms[0]?.dose?.match(/\d+/)?.[0])) ? Number(entry.forms[0]?.dose?.match(/\d+/)?.[0]) : 500);
  const [fromIdx, setFromIdx] = useState(0); const [toIdx, setToIdx] = useState(entry.forms.length > 1 ? 1 : 0); const [enhancersOn, setEnhancersOn] = useState(false); const [showChart, setShowChart] = useState(false);
  const fromForm = entry.forms[fromIdx]; const toForm = entry.forms[toIdx];
  const enhMult = enhancersOn ? entry.enhancers.reduce((p, e) => p * e.mult, 1.0) : 1.0;
  const baseEff = fromForm ? fromForm.effectiveDose(doseMg) : 0;
  const effWithEnh = Math.round(baseEff * enhMult);
  const equiv = fromForm && toForm ? Math.round(doseMg * (fromForm.bioavailability / toForm.bioavailability)) : doseMg;

  // Find cost for forms
  const getFormBioKey = (f: FormWithBio) => {
    const bioKey = (f.id + f.name + f.nameRu + (f.notes || '')).toLowerCase();
    if (bioKey.includes('glycinate') || bioKey.includes('глицинат')) return 'mg_glycinate';
    if (bioKey.includes('citrate') || bioKey.includes('цитрат')) return 'mg_citrate';
    if (bioKey.includes('oxide') || bioKey.includes('оксид')) return 'mg_oxide';
    if (bioKey.includes('threonate') || bioKey.includes('треонат')) return 'mg_threonate';
    return 'standard';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onBack} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 9, cursor: 'pointer' }}>←</button>
        <div><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{entry.nameRu}</div><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{entry.nameEn} · {entry.source === 'catalog' ? 'БАД' : entry.source === 'pharma' ? 'Фарма' : 'Пептид'} · {entry.category.join(', ')}</div></div>
      </div>
      {entry.description && <div style={{ ...S.card }}><div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>{entry.description.slice(0, 300)}{entry.description.length > 300 ? '...' : ''}</div></div>}

      {/* Forms table */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>💊 Формы выпуска ({entry.forms.length})</div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6 }}>Эффективная доза = доза × био. {doseMg} мг × {((fromForm?.bioavailability || 0.4) * 100).toFixed(0)}% = {baseEff} мг усвоится</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><th style={{ padding: '2px 3px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>Форма</th><th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Доза</th><th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Био</th><th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Эфф. доза</th><th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>₽/г эфф</th></tr></thead>
          <tbody>
            {entry.forms.map((f, i) => {
              const eff = f.effectiveDose(doseMg);
              const bioKey = getFormBioKey(f); const cost = COST_PER_GRAM[bioKey] || COST_PER_GRAM[f.id.toLowerCase()] || null;
              const costPerEff = cost !== null && f.bioavailability > 0 ? Math.round(cost / f.bioavailability) : null;
              return (
                <tr key={f.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: f.best ? 'rgba(0,230,138,0.04)' : 'transparent' }}>
                  <td style={{ padding: '3px 3px' }}><div style={{ fontWeight: 700, color: 'var(--text-light)', fontSize: 9 }}>{f.nameRu}</div>{f.notes && <div style={{ fontSize: 6, color: 'var(--text-dim)' }}>{f.notes}</div>}</td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', color: 'var(--text-dim)' }}>{f.dose}</td>
                  <td style={{ padding: '3px 3px', textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}><div style={{ width: 30, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, background: bioColor(f.bioavailability), width: `${f.bioavailability * 100}%`, minWidth: 2 }} /></div><span style={{ fontWeight: 700, fontSize: 8, color: bioColor(f.bioavailability) }}>{f.bioLabel}</span></div></td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', fontWeight: 700, fontSize: 9, color: 'var(--text-light)' }}>{eff} мг</td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', fontSize: 8, color: costPerEff !== null ? (costPerEff > 200 ? '#f44336' : costPerEff > 80 ? '#ff9800' : '#00e68a') : 'var(--text-dim)' }}>{costPerEff !== null ? `${costPerEff}₽` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bio dose chart */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa' }}>📈 График эффективной дозы</div>
          <button onClick={() => setShowChart(!showChart)} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: showChart ? 'rgba(167,139,250,0.1)' : 'var(--bg-primary)', color: showChart ? '#a78bfa' : 'var(--text-dim)' }}>{showChart ? 'Скрыть' : 'Раскрыть'}</button>
        </div>
        {showChart && (
          <div style={{ position: 'relative', height: 180, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 4px', overflow: 'hidden' }}>
            <BioChart entry={entry} doseMg={doseMg} enhancersOn={enhancersOn} enhMult={enhMult} />
          </div>
        )}
      </div>

      {/* Enhancers */}
      {entry.enhancers.length > 0 && (
        <div style={{ ...S.cardBlue }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>🚀 Усилители всасывания</div>
            <button onClick={() => setEnhancersOn(!enhancersOn)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: enhancersOn ? '1px solid #00e68a' : '1px solid var(--border)', background: enhancersOn ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)', color: enhancersOn ? '#00e68a' : 'var(--text-dim)' }}>{enhancersOn ? '✓ Учтены' : 'Учесть'}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entry.enhancers.map(e => (<div key={e.label} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa' }}>{e.label}</span><span style={{ fontSize: 8, color: enhancersOn ? '#00e68a' : 'var(--text-dim)' }}>×{e.mult.toFixed(1)}</span></div><div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{e.desc}</div></div>))}
          </div>
          {enhancersOn && <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, textAlign: 'center', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Эфф. доза с усилителями: </span><span style={{ fontSize: 13, fontWeight: 800, color: '#00e68a' }}>{effWithEnh} мг </span><span style={{ fontSize: 8, color: 'var(--text-dim)' }}>(было {baseEff} мг · ×{enhMult.toFixed(2)})</span></div>}
        </div>
      )}

      {/* Competition */}
      {entry.competitors.length > 0 && (<div style={{ ...S.cardPink }}><div style={{ fontSize: 11, fontWeight: 700, color: '#f44336', marginBottom: 6 }}>⚠ Конкуренция за всасывание</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{entry.competitors.map(c => (<div key={c.withLabel} style={{ padding: '4px 6px', borderRadius: 4, background: c.severity === 'HIGH' ? 'rgba(244,63,94,0.06)' : 'rgba(244,63,94,0.03)', border: '1px solid ' + (c.severity === 'HIGH' ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.08)'), fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3 }}><span style={{ fontWeight: 700, color: '#f44336' }}>{c.withLabel}</span>: {c.effect}</div>))}</div></div>)}

      {/* Equivalent dose */}
      {entry.forms.length > 1 && (<div style={{ ...S.cardAccent }}><div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>🔄 Эквивалентная доза</div><div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6 }}>Новая доза = текущая × (био₁ / био₂)</div><div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}><span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>Из:</span><select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>{entry.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}</select></div><div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}><span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>В:</span><select value={toIdx} onChange={e => setToIdx(Number(e.target.value))} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>{entry.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}</select></div><div style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>Доза:</span><input type="number" value={doseMg} min={0} max={10000} onChange={e => setDoseMg(Math.max(0, Number(e.target.value) || 0))} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 70 }} /><span style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг</span></div><div style={{ marginTop: 8, padding: 8, borderRadius: 6, textAlign: 'center', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Эквивалент <b>{toForm?.nameRu}</b>:</div><div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{equiv} <span style={{ fontSize: 10 }}>мг</span></div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{doseMg} мг × ({(fromForm?.bioavailability || 0.4) / (toForm?.bioavailability || 0.4) * 100 | 0}%)</div></div></div>)}

      {/* Clinical cards */}
      {entry.source === 'catalog' && <ClinicalCards entry={entry} />}

      {/* Principles */}
      <div style={{ ...S.card }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>📋 Принципы биодоступности</div><div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 3 }}><div>• <b>Липосомы</b> — фосфолипидная мембрана защищает от ЖКТ, био до 90%</div><div>• <b>Хелаты</b> — аминокислоты защищают от фитатов (в 2-5× лучше оксидов)</div><div>• <b>Пиперин</b> — ↑ био куркумина на 2000%, ресвератрола на 300%</div><div>• <b>Жиры ≥10г</b> — обязательны для D3, A, E, K, CoQ10, куркумина</div><div>• <b>Интервал ≥2ч</b> — Ca↔Mg, Zn↔Fe, Cu↔Zn. ИПП и минералы: 4ч.</div><div>• <b>Вит. C + Fe</b> — восстановление Fe³⁺→Fe²⁺, ↑ всасывание в 3-6×</div><div>• <b>pH-зависимость</b> — антациды/ИПП ↓ Ca, Mg, Fe, Zn, B12</div></div></div>
    </div>
  );
};

// ─── Bio dose chart (inline SVG) ───
const BioChart: React.FC<{ entry: EnrichedEntry; doseMg: number; enhancersOn: boolean; enhMult: number }> = ({ entry, doseMg, enhancersOn, enhMult }) => {
  const w = 340; const h = 160; const pad = { l: 45, r: 10, t: 15, b: 25 };
  const sorted = [...entry.forms].sort((a, b) => b.bioavailability - a.bioavailability);
  const maxEff = Math.max(...sorted.map(f => f.effectiveDose(doseMg)), 1) * (enhancersOn ? enhMult : 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', fontSize: 7 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(v => {
        const x = pad.l; const y = pad.t + (h - pad.b - pad.t) * (1 - v);
        return <g key={v}>
          <line x1={x} y1={y} x2={w - pad.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
          <text x={x - 5} y={y + 3} fill="var(--text-dim)" textAnchor="end">{Math.round(maxEff * v)}</text>
        </g>;
      })}
      {sorted.map((f, i) => {
        const barW = (w - pad.l - pad.r - sorted.length * 6) / sorted.length;
        const x = pad.l + i * (barW + 6) + 3;
        const eff = f.effectiveDose(doseMg) * (enhancersOn ? enhMult : 1);
        const barH = maxEff > 0 ? ((h - pad.b - pad.t) * eff) / maxEff : 0;
        return <g key={i}>
          <rect x={x} y={pad.t + (h - pad.b - pad.t) - barH} width={barW} height={Math.max(barH, 2)} rx={3} fill={bioColor(f.bioavailability)} opacity={0.85} />
          <text x={x + barW / 2} y={h - 5} textAnchor="middle" fill="var(--text-dim)" fontSize={5} transform={`rotate(-30, ${x + barW / 2}, ${h - 5})`}>{f.nameRu.slice(0, 12)}{f.nameRu.length > 12 ? '…' : ''}</text>
          <text x={x + barW / 2} y={pad.t + (h - pad.b - pad.t) - barH - 4} textAnchor="middle" fill={bioColor(f.bioavailability)} fontSize={6} fontWeight={700}>{eff}мг</text>
        </g>;
      })}
      {enhancersOn && <rect x={w - 50} y={pad.t} width={42} height={14} rx={3} fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.3)" strokeWidth={0.5} />}
      {enhancersOn && <text x={w - 29} y={pad.t + 10} textAnchor="middle" fill="#f44336" fontSize={7} fontWeight={700}>×{enhMult.toFixed(1)}</text>}
    </svg>
  );
};

// ─── Clinical cards ───
const ClinicalCards: React.FC<{ entry: EnrichedEntry }> = ({ entry }) => {
  const labKey = entry.windowKey || entry.absorptionKey === 'mineral' ? entry.windowKey : '';
  const labs = labKey ? LAB_MARKERS[labKey] : null;
  const recommender = entry.windowKey ? FORM_RECOMMENDER[entry.windowKey] : null;
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {entry.absorptionKey && ABSORPTION_SITES[entry.absorptionKey] && (
      <div style={{ ...S.cardBlue }}><div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>🔬 Место всасывания</div><div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3 }}><b>{ABSORPTION_SITES[entry.absorptionKey].site}</b> · {ABSORPTION_SITES[entry.absorptionKey].ph} · {ABSORPTION_SITES[entry.absorptionKey].note}</div></div>
    )}
    {entry.windowKey && THERAPEUTIC_WINDOWS[entry.windowKey] && (() => { const tw = THERAPEUTIC_WINDOWS[entry.windowKey]; return (
      <div style={{ ...S.cardAccent }}><div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>🎯 Терапевтическое окно</div><div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>{[{ label: 'Мин', value: tw.minMg, color: '#ff9800' }, { label: 'Оптим', value: tw.optMg, color: '#00e68a' }, { label: 'Макс', value: tw.maxMg, color: '#f44336' }].map(s => (<div key={s.label} style={{ textAlign: 'center', flex: 1, padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>мг {s.label}</div></div>))}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{tw.note}</div></div>
    ); })()}
    {entry.halfLifeKey && HALF_LIFE_INFO[entry.halfLifeKey] && (() => { const hl = HALF_LIFE_INFO[entry.halfLifeKey]; return (
      <div style={{ ...S.card }}><div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>⏱ Период полувыведения</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 8 }}><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>{hl.t12h < 24 ? hl.t12h + 'ч' : (hl.t12h / 24).toFixed(0) + 'д'}</div><div style={{ color: 'var(--text-dim)' }}>T½</div></div><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a' }}>{hl.freq}</div><div style={{ color: 'var(--text-dim)' }}>Кратность</div></div><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#ff9800' }}>{hl.steadyState}</div><div style={{ color: 'var(--text-dim)' }}>Равн.</div></div></div></div>
    ); })()}
    {entry.foodKey && FOOD_TIMING[entry.foodKey] && (() => { const ft = FOOD_TIMING[entry.foodKey]; return (
      <div style={{ ...S.cardBlue }}><div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>🍽 С чем и когда</div><div style={{ fontSize: 8, lineHeight: 1.3, display: 'flex', flexDirection: 'column', gap: 2 }}><div><span style={{ fontWeight: 700, color: '#00e68a' }}>Лучше:</span> {ft.best}</div><div><span style={{ fontWeight: 700, color: '#f44336' }}>Избегать:</span> {ft.avoid}</div><div style={{ color: 'var(--text-dim)' }}>{ft.note}</div></div></div>
    ); })()}
    {/* Lab markers */}
    {labs && labs.length > 0 && (
      <div style={{ ...S.cardPink }}><div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>🩸 Лабораторный контроль</div>
        {labs.map((l, i) => (<div key={i} style={{ padding: '3px 0', borderBottom: i < labs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 8, lineHeight: 1.3 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}><b style={{ color: 'var(--text-light)' }}>{l.marker}</b><span style={{ color: '#ff9800', fontSize: 7 }}>{l.when}</span></div><div style={{ color: 'var(--text-dim)' }}>{l.what} · Цель: <span style={{ color: '#00e68a' }}>{l.target}</span></div><div style={{ color: 'var(--text-dim)', fontSize: 7 }}>{l.note}</div></div>))}
      </div>
    )}
    {/* Smart form recommender */}
    {recommender && recommender.length > 0 && (
      <div style={{ ...S.cardAccent }}><div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>💡 Умный подбор формы</div>
        {recommender.map((r, i) => (<div key={i} style={{ padding: '4px 0', borderBottom: i < recommender.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ padding: '1px 4px', borderRadius: 3, fontSize: 7, fontWeight: 700, background: r.tier === 'premium' ? 'rgba(167,139,250,0.15)' : r.tier === 'standard' ? 'rgba(0,230,138,0.12)' : 'rgba(255,152,0,0.12)', color: r.tier === 'premium' ? '#a78bfa' : r.tier === 'standard' ? '#00e68a' : '#ff9800' }}>{r.tier === 'premium' ? '💎' : r.tier === 'standard' ? '⭐' : '💰'}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-light)' }}>{r.label}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{r.goal}</div></div>
          <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'right' }}>{r.budget}</span>
        </div>))}
      </div>
    )}
  </div>
); };

// ─── Calculator tab ───
const CalculatorTab: React.FC<{ catalog: EnrichedEntry[] }> = ({ catalog }) => {
  const [sub1Id, setSub1Id] = useState(''); const [sub2Id, setSub2Id] = useState('');
  const [dose1, setDose1] = useState(500); const [dose2, setDose2] = useState(500);
  const [form1Idx, setForm1Idx] = useState(0); const [form2Idx, setForm2Idx] = useState(0);
  const [activeAdjusters, setActiveAdjusters] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_bio_adjusters') || '[]'); } catch { return []; } });
  const sub1 = sub1Id ? catalog.find(e => e.id === sub1Id) : null; const sub2 = sub2Id ? catalog.find(e => e.id === sub2Id) : null;
  const f1 = sub1?.forms[form1Idx]; const f2 = sub2?.forms[form2Idx];
  const adjMult = activeAdjusters.reduce((p, k) => p * (PERSONAL_ADJUSTERS[k]?.mult || 1), 1.0);
  const eff1 = f1 ? Math.round(f1.effectiveDose(dose1) * adjMult) : 0; const eff2 = f2 ? Math.round(f2.effectiveDose(dose2) * adjMult) : 0;
  const raw1 = f1 ? f1.effectiveDose(dose1) : 0; const raw2 = f2 ? f2.effectiveDose(dose2) : 0;

  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ ...S.card }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🧮 Расчёт эффективной дозы</div><div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8 }}>Эффективная доза = принятая × биодоступность. Сравните два вещества или две формы.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[ { side: 1, sub: sub1, f: f1, dose: dose1, setDose: setDose1, eff: eff1, raw: raw1, formIdx: form1Idx, setFormIdx: setForm1Idx, id: sub1Id, setId: setSub1Id, accent: '#00e68a' },
           { side: 2, sub: sub2, f: f2, dose: dose2, setDose: setDose2, eff: eff2, raw: raw2, formIdx: form2Idx, setFormIdx: setForm2Idx, id: sub2Id, setId: setSub2Id, accent: '#60a5fa' } ].map(p => (
          <div key={p.side} style={{ padding: 8, borderRadius: 8, background: `${p.accent}10`, border: `1px solid ${p.accent}20` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: p.accent, marginBottom: 4 }}>Вещество {p.side}</div>
            <select value={p.id} onChange={e => { p.setId(e.target.value); p.setFormIdx(0); }} style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}><option value="">Выберите...</option>{catalog.map(e => <option key={e.id} value={e.id}>{e.nameRu} ({e.source})</option>)}</select>
            {p.sub && p.sub.forms.length > 0 && <select value={p.formIdx} onChange={e => p.setFormIdx(Number(e.target.value))} style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>{p.sub.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}</select>}
            <input type="number" value={p.dose} min={0} onChange={e => p.setDose(Math.max(0, Number(e.target.value) || 0))} placeholder="Доза мг" style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }} />
            {p.f && (<div style={{ marginTop: 6, textAlign: 'center' }}><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Эффективная доза:</div><div style={{ fontSize: 16, fontWeight: 800, color: p.accent }}>{p.eff} <span style={{ fontSize: 9 }}>мг</span></div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{p.dose} мг × {((p.f.bioavailability) * 100).toFixed(0)}%{adjMult < 1 ? ` × ${adjMult.toFixed(2)}` : ''}</div>{adjMult < 1 && <div style={{ fontSize: 6, color: '#ff9800' }}>(без правок: {p.raw} мг)</div>}</div>)}
          </div>
        ))}
      </div>
      {f1 && f2 && (<div style={{ marginTop: 8, padding: 10, borderRadius: 8, textAlign: 'center', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}><div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>⚖ Сравнение</div><div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div><div style={{ fontSize: 8, color: '#00e68a' }}>{f1.nameRu}</div><div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{eff1} мг</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>био {((f1.bioavailability) * 100).toFixed(0)}%</div></div><div style={{ fontSize: 16, color: 'var(--text-dim)' }}>vs</div><div><div style={{ fontSize: 8, color: '#60a5fa' }}>{f2.nameRu}</div><div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{eff2} мг</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>био {((f2.bioavailability) * 100).toFixed(0)}%</div></div></div><div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>{eff1 > eff2 ? `${f1.nameRu} эффективнее на ${(eff1 / eff2 * 100 - 100).toFixed(0)}%` : eff2 > eff1 ? `${f2.nameRu} эффективнее на ${(eff2 / eff1 * 100 - 100).toFixed(0)}%` : 'Одинаково'}</div>{activeAdjusters.length > 0 && adjMult < 1 && <div style={{ marginTop: 3, fontSize: 7, color: '#ff9800' }}>С поправкой (×{adjMult.toFixed(2)}): {eff1} мг / {eff2} мг</div>}</div>)}
    </div>

    {/* Personal adjusters */}
    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.12)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>🩺 Персонализированная коррекция</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(PERSONAL_ADJUSTERS).map(([key, adj]) => { const active = activeAdjusters.includes(key); return (
          <div key={key} onClick={() => { const next = active ? activeAdjusters.filter(k => k !== key) : [...activeAdjusters, key]; setActiveAdjusters(next); localStorage.setItem('he_bio_adjusters', JSON.stringify(next)); }} style={{ padding: '3px 5px', borderRadius: 3, cursor: 'pointer', border: active ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border)', background: active ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 8, fontWeight: 700, color: active ? '#f44336' : 'var(--text-light)' }}>{adj.label}</span><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>×{adj.mult.toFixed(2)}</span></div>
            {active && <div style={{ fontSize: 6, color: 'var(--text-dim)', marginTop: 1 }}>{adj.desc}</div>}
          </div>
        ); })}
      </div>
      {activeAdjusters.length > 0 && <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 6, textAlign: 'center', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Множитель: </span><span style={{ fontSize: 13, fontWeight: 800, color: '#f44336' }}>×{adjMult.toFixed(2)}</span></div>}
    </div>

    {/* Loading protocols */}
    <div style={{ ...S.cardBlue }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>⚡ Протоколы загрузочной фазы</div>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>Для веществ, требующих насыщения тканевых депо перед поддерживающей дозой:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {LOADING_PROTOCOLS.map((lp, i) => (
          <div key={i} style={{ padding: '5px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>{lp.substance}</div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span>Загрузка: <b style={{ color: '#ff9800' }}>{lp.loadingDose}</b> × {lp.loadingDays} дн</span>
              <span>→ Поддержка: <b style={{ color: '#00e68a' }}>{lp.maintDose}</b></span>
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{lp.purpose}</div>
            <div style={{ fontSize: 7, color: '#ff9800', marginTop: 1 }}>{lp.note}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Top by bio */}
    <div style={{ ...S.card }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>📊 Топ веществ по биодоступности</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{catalog.filter(e => e.source === 'catalog').sort((a, b) => b.maxBio - a.maxBio).slice(0, 15).map((item, i) => (<div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}><span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-dim)', minWidth: 14 }}>#{i + 1}</span><div style={{ flex: 1, fontSize: 9, fontWeight: i < 3 ? 700 : 400, color: 'var(--text-light)' }}>{item.nameRu}</div><div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, minWidth: 2, background: bioColor(item.maxBio), width: `${item.maxBio * 100}%` }} /></div><span style={{ fontSize: 8, fontWeight: 700, color: bioColor(item.maxBio), minWidth: 30, textAlign: 'right' }}>{(item.maxBio * 100).toFixed(0)}%</span></div>))}</div></div>
  </div>);
};

// ─── Timing tab ───
const TimingTab: React.FC<{ catalog: EnrichedEntry[] }> = ({ catalog }) => {
  const [selectedSubs, setSelectedSubs] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_bio_timing_subs') || '[]'); } catch { return []; } });
  const [timingSearch, setTimingSearch] = useState('');
  const toggleSub = (id: string) => { const next = selectedSubs.includes(id) ? selectedSubs.filter(x => x !== id) : [...selectedSubs, id]; setSelectedSubs(next); localStorage.setItem('he_bio_timing_subs', JSON.stringify(next)); };
  const assignedSlots = useMemo(() => {
    const slots: Record<TimeSlot, { entry: EnrichedEntry; reason: string }[]> = { morning_empty: [], morning_food: [], noon_food: [], afternoon_empty: [], evening_food: [], night_empty: [] };
    selectedSubs.forEach(sid => {
      const entry = catalog.find(e => e.id === sid); if (!entry) return;
      const cats = entry.category.join(' ').toLowerCase(); const n = entry.nameRu.toLowerCase();
      let timing: SubstanceTiming | undefined;
      if (cats.includes('fat') || cats.includes('жирораствор') || n.match(/d3|coq10|куркум|curcumin|омега|omega/)) timing = CATEGORY_TIMING.fat_soluble;
      else if (n.match(/кальц|calcium|ca_/)) timing = CATEGORY_TIMING.mineral_ca;
      else if (n.match(/магн|magnesium/)) timing = CATEGORY_TIMING.mineral_mg;
      else if (n.match(/цинк|zinc/)) timing = CATEGORY_TIMING.mineral_zn;
      else if (n.match(/желез|iron|fe_/)) timing = CATEGORY_TIMING.mineral_fe;
      else if (n.match(/селен|selen/)) timing = CATEGORY_TIMING.mineral_se;
      else if (cats.includes('antiox') || n.match(/nac|ала|ala|глутатион/)) timing = CATEGORY_TIMING.antioxidant_am;
      else if (cats.includes('amino') || cats.includes('аминокислот')) timing = CATEGORY_TIMING.amino;
      else if (cats.includes('probiot')) timing = CATEGORY_TIMING.probiotic;
      else if (n.match(/ашваганд|ashwagan|валерьян|valerian|мелатон/)) timing = CATEGORY_TIMING.herb_sedative;
      else if (n.match(/родиол|rhodiol|женьшен|ginseng|элеутеро/)) timing = CATEGORY_TIMING.herb_adaptogen;
      else if (n.match(/b12|b-12|фолат|folat|b6|b2|b1/)) timing = CATEGORY_TIMING.b_vitamins;
      else if (n.match(/креатин|creatin/)) timing = CATEGORY_TIMING.creatine;
      else if (n.match(/коллаген|collagen/)) timing = CATEGORY_TIMING.collagen;
      else timing = CATEGORY_TIMING.antioxidant_am;
      if (timing) slots[timing.slot].push({ entry, reason: timing.reason });
    });
    return slots;
  }, [selectedSubs, catalog]);

  const suppEntries = catalog.filter(e => e.source === 'catalog');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>⏰ Тайминг-планировщик приёма БАД</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>Выберите свои добавки — система распределит их по времени суток с учётом конкуренции и совместимости.</div>
        <input value={timingSearch} onChange={e => setTimingSearch(e.target.value)} placeholder="Поиск БАД..." style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 10, marginBottom: 6 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 150, overflowY: 'auto', marginBottom: 6 }}>
          {suppEntries.filter(e => !selectedSubs.includes(e.id) && (!timingSearch || e.nameRu.toLowerCase().includes(timingSearch.toLowerCase()))).map(e => (
            <div key={e.id} onClick={() => toggleSub(e.id)} style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>+ {e.nameRu}</div>
          ))}
        </div>
        {selectedSubs.length > 0 && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>Выбрано: {selectedSubs.length}. Нажмите для удаления.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {selectedSubs.map(sid => { const e = catalog.find(x => x.id === sid); return e ? <div key={sid} onClick={() => toggleSub(sid)} style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>✓ {e.nameRu}</div> : null; })}
        </div>
      </div>
      {/* Schedule */}
      {selectedSubs.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>📋 Расписание приёма</div>
            <button onClick={() => {
              let text = 'РАСПИСАНИЕ ПРИЁМА БАД\n\n';
              TIMING_SLOTS.forEach(ts => { const items = assignedSlots[ts.key]; if (items.length === 0) return; text += `${ts.label} (${ts.time}):\n`; items.forEach(item => { text += `  • ${item.entry.nameRu} — ${item.reason}\n`; }); text += '\n'; });
              navigator.clipboard.writeText(text).then(() => { alert('Расписание скопировано в буфер обмена'); });
            }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>📋 Копировать план</button>
          </div>
          {TIMING_SLOTS.map(ts => { const items = assignedSlots[ts.key]; if (items.length === 0) return null; return (
            <div key={ts.key} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.03)', border: '1px solid rgba(0,230,138,0.08)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>{ts.label} ({ts.time})</div>
              {items.map((item, i) => (
                <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '2px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <b style={{ color: 'var(--text-light)' }}>{item.entry.nameRu}</b> · {item.reason}
                </div>
              ))}
            </div>
          ); })}
          {TIMING_SLOTS.every(ts => assignedSlots[ts.key].length === 0) && <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 12 }}>Выберите БАДы для составления расписания</div>}
        </div>
      )}
      {/* Competition warnings */}
      {selectedSubs.length >= 2 && (() => {
        const selectedEntries = selectedSubs.map(sid => catalog.find(e => e.id === sid)).filter(Boolean) as EnrichedEntry[];
        const mineralEntries = selectedEntries.filter(e => e.competitors.length > 0);
        if (mineralEntries.length === 0) return null;
        return (
          <div style={{ ...S.cardPink }}><div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>⚠ Предупреждения о конкуренции</div>
            {mineralEntries.map(e => (<div key={e.id} style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3 }}><b style={{ color: 'var(--text-light)' }}>{e.nameRu}</b>: {e.competitors.map(c => c.withLabel).join(', ')}</div>))}
          </div>
        );
      })()}
    </div>
  );
};

// ─── Synergy tab (stack synergy) ───
const SynergyTab: React.FC<{ catalog: EnrichedEntry[] }> = ({ catalog }) => {
  const [stackIds, setStackIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_bio_synergy_stack') || '[]'); } catch { return []; } });
  const toggleInStack = (id: string) => { const next = stackIds.includes(id) ? stackIds.filter(x => x !== id) : [...stackIds, id]; setStackIds(next); localStorage.setItem('he_bio_synergy_stack', JSON.stringify(next)); };
  const stackEntries = stackIds.map(sid => catalog.find(e => e.id === sid)).filter(Boolean) as EnrichedEntry[];

  const synergyReport = useMemo(() => {
    if (stackEntries.length < 2) return null;
    const totalBio = stackEntries.reduce((s, e) => s + (e.bestForm?.bioavailability || e.maxBio), 0);
    const avgBio = totalBio / stackEntries.length;
    const hasMineralConflict = stackEntries.filter(e => e.competitors.length > 0).length >= 2;
    const hasEnhancerSynergy = stackEntries.filter(e => e.enhancers.some(en => en.label.includes('пиперин') || en.label.includes('жирн') || en.label.includes('витамин C'))).length >= 2;
    const broadCoverage = new Set<string>(); stackEntries.forEach(e => { if (e.absorptionKey) broadCoverage.add(e.absorptionKey); });
    const conflictPairs: { a: string; b: string; reason: string }[] = [];
    const mineralEnts = stackEntries.filter(e => e.competitors.length > 0);
    for (let i = 0; i < mineralEnts.length; i++) {
      for (let j = i + 1; j < mineralEnts.length; j++) {
        const a = mineralEnts[i]; const b = mineralEnts[j];
        const aNames = a.competitors.map(c => c.withLabel.replace(/[()]/g, '').split(' ')[0].toLowerCase());
        const bName = b.nameRu.toLowerCase();
        if (aNames.some(n => bName.includes(n)))
          conflictPairs.push({ a: a.nameRu, b: b.nameRu, reason: 'Конкуренция за транспортёры' });
      }
    }
    let score = 70; const notes: string[] = [];
    if (avgBio > 0.6) { score += 15; notes.push('Высокая средняя биодоступность стека'); }
    if (broadCoverage.size >= 2) { score += 10; notes.push(`Покрыто ${broadCoverage.size} разных зон всасывания`); }
    if (hasEnhancerSynergy) { score += 5; notes.push('Синергия усилителей всасывания'); }
    if (conflictPairs.length > 0) { score -= conflictPairs.length * 15; notes.push(`${conflictPairs.length} конфликтных пар`); }
    return { score: Math.max(0, Math.min(100, score)), avgBio, conflictPairs, notes, broadCoverage: broadCoverage.size, hasMineralConflict, hasEnhancerSynergy };
  }, [stackEntries]);

  const suppEntries = catalog.filter(e => e.source === 'catalog');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🔄 Синергия стека БАД</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>Соберите свой стек добавок — система оценит их совместимость по всасыванию.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 120, overflowY: 'auto', marginBottom: 6 }}>
          {suppEntries.filter(e => !stackIds.includes(e.id)).map(e => (<div key={e.id} onClick={() => toggleInStack(e.id)} style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)' }}>+ {e.nameRu}</div>))}
        </div>
        {stackEntries.length > 0 && (<div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>{stackEntries.map(e => (<div key={e.id} onClick={() => toggleInStack(e.id)} style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>✓ {e.nameRu} ({(e.maxBio * 100).toFixed(0)}%)</div>))}</div>)}
      </div>
      {synergyReport && (
        <div style={{ ...S.cardAccent }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a', marginBottom: 6, textAlign: 'center' }}>🎯 Оценка синергии: {synergyReport.score}/100</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
            <div style={{ textAlign: 'center', padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 14, fontWeight: 800, color: bioColor(synergyReport.avgBio) }}>{(synergyReport.avgBio * 100).toFixed(0)}%</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>Сред. био</div></div>
            <div style={{ textAlign: 'center', padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{synergyReport.broadCoverage}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>Зон всасыв.</div></div>
            <div style={{ textAlign: 'center', padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 14, fontWeight: 800, color: synergyReport.conflictPairs.length > 0 ? '#f44336' : '#00e68a' }}>{synergyReport.conflictPairs.length}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>Конфликтов</div></div>
          </div>
          <div style={{ fontSize: 8, lineHeight: 1.4 }}>
            {synergyReport.notes.map((n, i) => (<div key={i} style={{ color: n.includes('конфликт') ? '#f44336' : 'var(--text-dim)', marginBottom: 1 }}>{n.includes('конфликт') ? '⚠ ' : '✅ '}{n}</div>))}
          </div>
          {synergyReport.conflictPairs.length > 0 && (<div style={{ marginTop: 4, padding: 6, borderRadius: 4, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#f44336', marginBottom: 2 }}>Конфликтные пары:</div>{synergyReport.conflictPairs.map((cp, i) => (<div key={i} style={{ fontSize: 7, color: 'var(--text-dim)' }}>{cp.a} ↔ {cp.b}: {cp.reason}</div>))}</div>)}
        </div>
      )}
      {stackEntries.length >= 2 && (() => {
        const enhAll: { label: string; mult: number; subs: string[] }[] = [];
        stackEntries.forEach(e => { e.enhancers.forEach(en => { const existing = enhAll.find(x => x.label === en.label); if (existing) existing.subs.push(e.nameRu); else enhAll.push({ label: en.label, mult: en.mult, subs: [e.nameRu] }); }); });
        const shared = enhAll.filter(x => x.subs.length >= 2);
        if (shared.length === 0) return null;
        return (<div style={{ ...S.cardBlue }}><div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🚀 Общие усилители</div>{shared.map((s, i) => (<div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}><b style={{ color: '#60a5fa' }}>{s.label}</b> (×{s.mult.toFixed(1)}): {s.subs.join(', ')}</div>))}</div>);
      })()}
    </div>
  );
};

// ─── Stats tab ───
const StatsTab: React.FC<{ stats: StatsInfo; catalog: EnrichedEntry[] }> = ({ stats, catalog }) => {
  const suppEntries = catalog.filter(e => e.source === 'catalog');
  const catStats = useMemo(() => {
    const map = new Map<string, { count: number; totalBio: number }>();
    suppEntries.forEach(e => { e.category.forEach(cat => { const prev = map.get(cat) || { count: 0, totalBio: 0 }; prev.count++; prev.totalBio += e.maxBio; map.set(cat, prev); }); });
    return Array.from(map.entries()).map(([cat, v]) => ({ cat, count: v.count, avgBio: v.count ? v.totalBio / v.count : 0 })).sort((a, b) => b.count - a.count);
  }, [suppEntries]);
  const tierStats = useMemo(() => {
    const map = new Map<string, { count: number; totalBio: number }>();
    suppEntries.forEach(e => { const t = e.tier; const prev = map.get(t) || { count: 0, totalBio: 0 }; prev.count++; prev.totalBio += e.maxBio; map.set(t, prev); });
    return Array.from(map.entries()).map(([tier, v]) => ({ tier, count: v.count, avgBio: v.count ? v.totalBio / v.count : 0 }));
  }, [suppEntries]);

  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ ...S.card }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>📊 Общая статистика</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[{ label: 'Всего веществ', value: stats.total, color: 'var(--text-light)' }, { label: 'БАД', value: stats.supp, color: '#00e68a' }, { label: 'Фарма', value: stats.pharma, color: '#60a5fa' }, { label: 'Пептиды', value: stats.peptides, color: '#a78bfa' }, { label: 'Средняя био', value: `${(stats.avgBio * 100).toFixed(1)}%`, color: bioColor(stats.avgBio) }, { label: 'Медиана био', value: `${(stats.medianBio * 100).toFixed(1)}%`, color: bioColor(stats.medianBio) }].map(s => (<div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.label}</div></div>))}
      </div>
    </div>
    <div style={{ ...S.card }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>📈 Распределение биодоступности</div>
      {[{ label: 'Высокая (≥60%)', count: stats.highBio, color: '#00e68a' }, { label: 'Средняя (35-60%)', count: stats.midBio, color: '#ff9800' }, { label: 'Низкая (<35%)', count: stats.lowBio, color: '#f44336' }].map(b => { const pct = stats.supp ? (b.count / stats.supp * 100).toFixed(0) : '0'; return (<div key={b.label} style={{ marginBottom: 4 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginBottom: 1 }}><span>{b.label}</span><span style={{ fontWeight: 700, color: b.color }}>{b.count} ({pct}%)</span></div><div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 3, background: b.color, width: `${pct}%`, minWidth: 4 }} /></div></div>); })}
    </div>
    <div style={{ ...S.card }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>📂 По категориям</div><div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>{catStats.slice(0, 20).map(cs => (<div key={cs.cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-light)', minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cs.cat}</span><div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, minWidth: 2, background: bioColor(cs.avgBio), width: `${cs.avgBio * 100}%` }} /></div><span style={{ fontSize: 8, fontWeight: 600, color: bioColor(cs.avgBio), minWidth: 28, textAlign: 'right' }}>{(cs.avgBio * 100).toFixed(0)}%</span><span style={{ fontSize: 7, color: 'var(--text-dim)', minWidth: 20, textAlign: 'right' }}>{cs.count}</span></div>))}</div></div>
    {tierStats.length > 0 && (<div style={{ ...S.card }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🏆 По уровню (tier)</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{tierStats.map(ts => (<div key={ts.tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 7, fontWeight: 700, background: ts.tier === 'core' ? 'rgba(0,230,138,0.15)' : ts.tier === 'standard' ? 'rgba(59,130,246,0.12)' : 'rgba(167,139,250,0.12)', color: ts.tier === 'core' ? '#00e68a' : ts.tier === 'standard' ? '#60a5fa' : '#a78bfa' }}>{ts.tier === 'core' ? '⭐ Core' : ts.tier === 'standard' ? '✦ Standard' : '⚡ Advanced'}</span><span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{ts.count} веществ</span><div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, minWidth: 2, background: bioColor(ts.avgBio), width: `${ts.avgBio * 100}%` }} /></div><span style={{ fontSize: 8, fontWeight: 600, color: bioColor(ts.avgBio), minWidth: 28, textAlign: 'right' }}>{(ts.avgBio * 100).toFixed(0)}%</span></div>))}</div></div>)}
    <div style={{ ...S.cardPink }}><div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>🩺 Клинический контекст</div><div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3 }}><b>Уязвимые формы:</b> MgO (4%), CaCO₃ (25% без HCl), FeSO₄ (15%), B12 циано (2%).<br/><b>Критические факторы:</b> ИПП (↓ HCl → Ca, Fe, Mg, B12), возраст {'>'}60 (30% атрофия), метформин (↓ B12).<br/><b>Стратегия:</b> цитраты, бисглицинаты, липосомы + коррекция pH.</div></div>
  </div>);
};
