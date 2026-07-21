import React, { useState, useMemo, useCallback } from 'react';
import { InfoErrorBoundary } from './SupportScreenData';
import { S } from './SupportShared';
import { PopupSelect } from '../../components/PopupXxx';
import {
  type FormWithBio, type EnrichedEntry, type EnhancerInfo, type CompetitorInfo, type StatsInfo,
  getCatalogFormBio, detectEnhancers, detectCompetition, classifySubstance,
  bioColor, bioLabel, COST_PER_GRAM, FORM_BIOAVAIL,
  ABSORPTION_SITES, THERAPEUTIC_WINDOWS, HALF_LIFE_INFO, FOOD_TIMING, PERSONAL_ADJUSTERS, MODIFIERS,
  TIMING_SLOTS, CATEGORY_TIMING, type TimeSlot, type TimingSlot, type SubstanceTiming,
  LAB_MARKERS, type LabMarker,
  FORM_RECOMMENDER, type FormRecommendation,
  buildBioavailabilityCatalog,
} from './SupportBioavailabilityData';


// ─── Category labels (RU) ───
const CATEGORY_LABELS_RU: Record<string, string> = {
  antioxidant: 'Антиоксидант', hepatoprotector: 'Гепатопротектор', cardioprotector: 'Кардиопротектор',
  mineral: 'Минерал', vitamin: 'Витамин', amino_acid: 'Аминокислота', omega3: 'Омега-3', omega: 'Омега',
  adaptogen: 'Адаптоген', nootropic: 'Ноотроп', antiinflammatory: 'Противовоспалительное',
  immune: 'Иммунитет', detox: 'Детоксикация', liver: 'Печень', renal: 'Почки', cardio: 'Сердце',
  neuro: 'Нервная система', endocrine: 'Эндокринная', reproductive: 'Репродуктивная',
  metabolic: 'Метаболизм', bone: 'Кости', joint: 'Суставы', skin: 'Кожа', sleep: 'Сон',
  energy: 'Энергия', recovery: 'Восстановление', stress: 'Стресс', anxiolytic: 'Анксиолитик',
  collagen: 'Коллаген', flavonoid: 'Флавоноид', herbal: 'Травяной', peptide: 'Пептид',
  pharma: 'Фарма', protein: 'Протеин', mitochondrial: 'Митохондрии', methylation: 'Метилирование',
  gut: 'ЖКТ', digestion: 'Пищеварение', enzyme: 'Фермент', probiotic: 'Пробиотик',
  lipid: 'Липиды', lipid_low: 'Снижение липидов', cholesterol: 'Холестерин',
  hypоcholesterolemic: 'Гипохолестеринемическое', bp: 'Давление', heart_rate: 'Пульс',
  venotonic: 'Венотоник', hemorheologic: 'Гемореология', anticoagulant: 'Антикоагулянт',
  antiagg: 'Антиагрегант', fibrinolytic: 'Фибринолитик', coagulation: 'Свёртываемость',
  antifibrinolytic: 'Антифибринолитик', electrolyte: 'Электролит', thyroid: 'Щитовидная железа',
  glyc: 'Гликемия', gi: 'ЖКТ', bile: 'Желчь', bile_acid: 'Желчные кислоты',
  beauty: 'Красота', dopaminе: 'Дофамин', dopamine_modulator: 'Модулятор дофамина',
  serotonin: 'Серотонин', prolactin: 'Пролактин', gh_releasing: 'Высвобождение ГР',
  gh_secretagogue: 'Секретагог ГР', mTOR: 'mTOR', ppar: 'PPAR',
  anabolic: 'Анаболик', androgen: 'Андроген', ai: 'Ингибитор ароматазы',
  aromatase_inhibitor: 'Ингибитор ароматазы', estrogen: 'Эстроген', steroidal: 'Стероидный',
  aas_derivative: 'Производное ААС', ace_inhibitor: 'Ингибитор АПФ', antihypertensive: 'Антигипертензивный',
  injectable: 'Инъекционный', oral: 'Пероральный', enyzme_inhibitor: 'Ингибитор фермента',
  glucosinolate: 'Глюкозинолат', mucolytic: 'Муколитик', nephroprotector: 'Нефропротектор',
  neuroprotector: 'Нейропротектор', adenoma_prevention: 'Профилактика аденом',
  intestinal: 'Кишечник',
};

// ─── Main component ───

export const SupportBioavailability: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [tab, setTab] = useState<'catalog'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'bio' | 'name' | 'forms'>('bio');
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem('he_bio_selected'));
  const [compareIds, setCompareIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_bio_compare') || '[]'); } catch { return []; } });
  const [showCompare, setShowCompare] = useState(compareIds.length > 0);

  const catalog = useMemo(() => buildBioavailabilityCatalog(), []);
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
<CatalogTab catalog={catalog} filtered={filtered} allCategories={allCategories} searchQuery={searchQuery} setSearchQuery={setSearchQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} sortBy={sortBy} setSortBy={setSortBy} selectedId={selectedId} handleSelect={handleSelect} compareIds={compareIds} handleCompare={handleCompare} showCompare={showCompare} setShowCompare={setShowCompare} compareEntries={compareEntries} />
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
      <div style={{ ...S.card, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '4px 10px' }}>
          <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.5 }}>🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию, описанию..." style={{ flex: 1, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 11, outline: 'none', padding: '6px 0', fontFamily: 'inherit' }} />
          {searchQuery && <span onClick={() => setSearchQuery('')} style={{ fontSize: 12, cursor: 'pointer', opacity: 0.4, padding: '2px 4px' }}>✕</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <PopupSelect label="📂 Категория" value={categoryFilter} options={[{id:'all',label:'Все категории'},...allCategories.map(c => ({id:c,label:CATEGORY_LABELS_RU[c] || c}))]} onChange={setCategoryFilter} />
          <PopupSelect label="📦 Тип" value={sourceFilter} options={[{id:'all',label:'Все типы'},{id:'catalog',label:'БАД'},{id:'pharma',label:'Фарма'},{id:'peptide',label:'Пептиды'}]} onChange={setSourceFilter} />
          <PopupSelect label="🔀 Сортировка" value={sortBy} options={[{id:'bio',label:'По биодоступности'},{id:'name',label:'По алфавиту'},{id:'forms',label:'По числу форм'}]} onChange={v => setSortBy(v as any)} />
        </div>
      </div>
      {/* Compare card-button */}
      <div onClick={() => setShowCompare(!showCompare)} style={{ ...S.card, cursor: 'pointer', border: showCompare ? '1px solid rgba(0,230,138,0.4)' : S.card.border, background: showCompare ? 'rgba(0,230,138,0.04)' : S.card.background, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, transition: 'all 0.15s' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: showCompare ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)', fontSize: 18, fontWeight: 800, color: showCompare ? '#000' : 'rgba(255,255,255,0.6)', flexShrink: 0 }}>{showCompare ? '✓' : '⚖'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: showCompare ? '#00e68a' : 'var(--text-light)' }}>Сравнение форм</div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{compareIds.length > 0 ? `${compareIds.length} из 4 · нажмите + на препаратах` : 'Выберите 2–4 препарата для сравнения'}</div>
        </div>
        {compareIds.length > 0 && <div style={{ display: 'flex', gap: 3 }}>{compareIds.map(id => { const e = catalog.find(x => x.id === id); return e ? <span key={id} style={{ padding: '2px 6px', borderRadius: 5, fontSize: 9, fontWeight: 600, background: 'rgba(0,230,138,0.12)', color: '#00e68a', whiteSpace: 'nowrap' }}>{e.nameRu}</span> : null; })}</div>}
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
              <div onClick={e => { e.stopPropagation(); handleCompare(item.id); }} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: compareIds.includes(item.id) ? '1.5px solid #00e68a' : '1px solid rgba(255,255,255,0.1)', color: compareIds.includes(item.id) ? '#00e68a' : 'rgba(255,255,255,0.5)', background: compareIds.includes(item.id) ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36, transition: 'all 0.15s' }}>{compareIds.includes(item.id) ? '✓' : '+'}</div>
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
  const [fromIdx, setFromIdx] = useState(0); const [toIdx, setToIdx] = useState(entry.forms.length > 1 ? 1 : 0);   const [enhancersOn, setEnhancersOn] = useState(false); const [showChart, setShowChart] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const fromForm = entry.forms[fromIdx]; const toForm = entry.forms[toIdx];
  const enhMult = enhancersOn ? entry.enhancers.reduce((p, e) => p * e.mult, 1.0) : 1.0;
  const baseEff = fromForm ? fromForm.effectiveDose(doseMg) : 0;
  const effWithEnh = Math.round(baseEff * enhMult);
  const equiv = fromForm && toForm ? Math.round(doseMg * (fromForm.bioavailability / toForm.bioavailability)) : doseMg;
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

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
      {entry.description && <div style={{ ...S.card }}><div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>{entry.description}</div></div>}
      {entry.source === 'pharma' && <div style={{ ...S.card, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}><div style={{ fontSize: 8, color: '#f59e0b', lineHeight: 1.3 }}>⚠ Биодоступность фармпрепаратов зависит от рецептуры, генетики CYP450, состояния ЖКТ и взаимодействий. Значения ориентировочные — для выбора формы, а не расчёта точной дозы.</div></div>}

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
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => toggleSection('enhancers')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['enhancers'] ? 'rgba(167,139,250,0.1)' : 'var(--bg-primary)', color: expandedSections['enhancers'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['enhancers'] ? '▲' : '▼'}</button>
              <button onClick={() => setEnhancersOn(!enhancersOn)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: enhancersOn ? '1px solid #00e68a' : '1px solid var(--border)', background: enhancersOn ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)', color: enhancersOn ? '#00e68a' : 'var(--text-dim)' }}>{enhancersOn ? '✓ Учтены' : 'Учесть'}</button>
            </div>
          </div>
          {expandedSections['enhancers'] && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entry.enhancers.map(e => (<div key={e.label} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa' }}>{e.label}</span><span style={{ fontSize: 8, color: enhancersOn ? '#00e68a' : 'var(--text-dim)' }}>×{e.mult.toFixed(1)}</span></div><div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{e.desc}</div></div>))}
          </div>
          {enhancersOn && <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, textAlign: 'center', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Эфф. доза с усилителями: </span><span style={{ fontSize: 13, fontWeight: 800, color: '#00e68a' }}>{effWithEnh} мг </span><span style={{ fontSize: 8, color: 'var(--text-dim)' }}>(было {baseEff} мг · ×{enhMult.toFixed(2)})</span>{enhMult > 2.0 && <div style={{ fontSize: 7, color: '#ff9800', marginTop: 3 }}>⚠ Множители не суммируются линейно — эффект ограничен биологическими механизмами. Ориентируйтесь на ×1.5–2.0 как реалистичный максимум.</div>}</div>}
          </>}
        </div>
      )}

      {/* Competition */}
      {entry.competitors.length > 0 && (<div style={{ ...S.cardPink }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#f44336' }}>⚠ Конкуренция за всасывание</div><button onClick={() => toggleSection('competition')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['competition'] ? 'rgba(167,139,250,0.1)' : 'var(--bg-primary)', color: expandedSections['competition'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['competition'] ? '▲' : '▼'}</button></div>{expandedSections['competition'] && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{entry.competitors.map(c => (<div key={c.withLabel} style={{ padding: '4px 6px', borderRadius: 4, background: c.severity === 'HIGH' ? 'rgba(244,63,94,0.06)' : 'rgba(244,63,94,0.03)', border: '1px solid ' + (c.severity === 'HIGH' ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.08)'), fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3 }}><span style={{ fontWeight: 700, color: '#f44336' }}>{c.withLabel}</span>: {c.effect}</div>))}</div>}</div>)}

      {/* Equivalent dose */}
      {entry.forms.length > 1 && <EquivDoseCard entry={entry} fromIdx={fromIdx} toIdx={toIdx} setFromIdx={setFromIdx} setToIdx={setToIdx} doseMg={doseMg} setDoseMg={setDoseMg} equiv={equiv} expandedSections={expandedSections} toggleSection={toggleSection} />}

      {/* Clinical cards */}
      {entry.source === 'catalog' && <ClinicalCards entry={entry} expandedSections={expandedSections} toggleSection={toggleSection} />}

      {/* Principles */}
      <div style={{ ...S.card }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['principles'] ? 6 : 0 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>📋 Принципы биодоступности</div><button onClick={() => toggleSection('principles')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['principles'] ? 'rgba(167,139,250,0.1)' : 'var(--bg-primary)', color: expandedSections['principles'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['principles'] ? '▲' : '▼'}</button></div>{expandedSections['principles'] && <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 3 }}><div>• <b>Липосомы</b> — фосфолипидная мембрана защищает от ЖКТ, био до 90%</div><div>• <b>Хелаты</b> — аминокислоты защищают от фитатов (в 2-5× лучше оксидов)</div><div>• <b>Пиперин</b> — ↑ био куркумина на 2000%, ресвератрола на 300%</div><div>• <b>Жиры ≥10г</b> — обязательны для D3, A, E, K, CoQ10, куркумина</div><div>• <b>Интервал ≥2ч</b> — Ca↔Mg, Zn↔Fe, Cu↔Zn. ИПП и минералы: 4ч.</div><div>• <b>Вит. C + Fe</b> — восстановление Fe³⁺→Fe²⁺, ↑ всасывание в 3-6×</div><div>• <b>pH-зависимость</b> — антациды/ИПП ↓ Ca, Mg, Fe, Zn, B12</div></div>}</div>
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

// ─── Equivalent dose card ───
const EquivDoseCard: React.FC<{
  entry: EnrichedEntry; fromIdx: number; toIdx: number;
  setFromIdx: (v: number) => void; setToIdx: (v: number) => void;
  doseMg: number; setDoseMg: (v: number) => void; equiv: number;
  expandedSections: Record<string, boolean>; toggleSection: (k: string) => void;
}> = ({ entry, fromIdx, toIdx, setFromIdx, setToIdx, doseMg, setDoseMg, equiv, expandedSections, toggleSection }) => {
  const fromForm = entry.forms[fromIdx];
  const toForm = entry.forms[toIdx];
  const pct = Math.round((fromForm?.bioavailability || 0.4) / (toForm?.bioavailability || 0.4) * 100);
  const formOpts = entry.forms.map((f, i) => ({ idx: i, nameRu: f.nameRu, bio: f.bioavailability }));
  return (
    <div style={{ ...S.cardAccent }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>🔄 Эквивалентная доза</div>
        <button onClick={() => toggleSection('equiv')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['equiv'] ? 'rgba(167,139,250,0.1)' : 'var(--bg-primary)', color: expandedSections['equiv'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['equiv'] ? '▲' : '▼'}</button>
      </div>
      {expandedSections['equiv'] && <>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6 }}>Новая доза = текущая × (био₁ / био₂)</div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>Из:</span>
          <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>
            {formOpts.map(o => <option key={o.idx} value={o.idx}>{o.nameRu} ({(o.bio * 100).toFixed(0)}%)</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>В:</span>
          <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>
            {formOpts.map(o => <option key={o.idx} value={o.idx}>{o.nameRu} ({(o.bio * 100).toFixed(0)}%)</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 18 }}>Доза:</span>
          <input type="number" value={doseMg} min={0} max={10000} onChange={e => setDoseMg(Math.max(0, Number(e.target.value) || 0))} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 70 }} />
          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг</span>
        </div>
        <div style={{ marginTop: 8, padding: 8, borderRadius: 6, textAlign: 'center', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Эквивалент <b>{toForm?.nameRu}</b>:</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{equiv} <span style={{ fontSize: 10 }}>мг</span></div>
          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{doseMg} мг × ({pct}%)</div>
        </div>
      </>}
    </div>
  );
};

// ─── Clinical cards ───
const ClinicalCards: React.FC<{ entry: EnrichedEntry; expandedSections: Record<string, boolean>; toggleSection: (k: string) => void }> = ({ entry, expandedSections, toggleSection }) => {
  const labKey = entry.windowKey || (entry.absorptionKey === 'mineral' ? entry.windowKey : '');
  const labs = labKey ? LAB_MARKERS[labKey] : null;
  const recommender = entry.windowKey ? FORM_RECOMMENDER[entry.windowKey] : null;
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {entry.absorptionKey && ABSORPTION_SITES[entry.absorptionKey] && (
      <div style={{ ...S.cardBlue }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_absorption'] ? 3 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>🔬 Место всасывания</div><button onClick={() => toggleSection('clinical_absorption')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_absorption'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_absorption'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_absorption'] ? '▲' : '▼'}</button></div>{expandedSections['clinical_absorption'] && <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3 }}><b>{ABSORPTION_SITES[entry.absorptionKey].site}</b> · {ABSORPTION_SITES[entry.absorptionKey].ph} · {ABSORPTION_SITES[entry.absorptionKey].note}</div>}</div>
    )}
    {entry.windowKey && THERAPEUTIC_WINDOWS[entry.windowKey] && (() => { const tw = THERAPEUTIC_WINDOWS[entry.windowKey]; const u = tw.unit || 'мг'; return (
      <div style={{ ...S.cardAccent }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_window'] ? 3 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>🎯 Терапевтическое окно</div><button onClick={() => toggleSection('clinical_window')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_window'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_window'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_window'] ? '▲' : '▼'}</button></div>{expandedSections['clinical_window'] && <><div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>{[{ label: 'Мин', value: tw.minMg, color: '#ff9800' }, { label: 'Оптим', value: tw.optMg, color: '#00e68a' }, { label: 'Макс', value: tw.maxMg, color: '#f44336' }].map(s => (<div key={s.label} style={{ textAlign: 'center', flex: 1, padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{u} {s.label}</div></div>))}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{tw.note}</div></>}</div>
    ); })()}
    {entry.halfLifeKey && HALF_LIFE_INFO[entry.halfLifeKey] && (() => { const hl = HALF_LIFE_INFO[entry.halfLifeKey]; return (
      <div style={{ ...S.card }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_halflife'] ? 3 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa' }}>⏱ Период полувыведения</div><button onClick={() => toggleSection('clinical_halflife')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_halflife'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_halflife'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_halflife'] ? '▲' : '▼'}</button></div>{expandedSections['clinical_halflife'] && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 8 }}><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>{hl.t12h < 24 ? hl.t12h + 'ч' : (hl.t12h / 24).toFixed(0) + 'д'}</div><div style={{ color: 'var(--text-dim)' }}>T½</div></div><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a' }}>{hl.freq}</div><div style={{ color: 'var(--text-dim)' }}>Кратность</div></div><div style={{ textAlign: 'center', padding: '3px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#ff9800' }}>{hl.steadyState}</div><div style={{ color: 'var(--text-dim)' }}>Равн.</div></div></div>}</div>
    ); })()}
    {entry.foodKey && FOOD_TIMING[entry.foodKey] && (() => { const ft = FOOD_TIMING[entry.foodKey]; return (
      <div style={{ ...S.cardBlue }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_food'] ? 3 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>🍽 С чем и когда</div><button onClick={() => toggleSection('clinical_food')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_food'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_food'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_food'] ? '▲' : '▼'}</button></div>{expandedSections['clinical_food'] && <div style={{ fontSize: 8, lineHeight: 1.3, display: 'flex', flexDirection: 'column', gap: 2 }}><div><span style={{ fontWeight: 700, color: '#00e68a' }}>Лучше:</span> {ft.best}</div><div><span style={{ fontWeight: 700, color: '#f44336' }}>Избегать:</span> {ft.avoid}</div><div style={{ color: 'var(--text-dim)' }}>{ft.note}</div></div>}</div>
    ); })()}
    {/* Lab markers */}
    {labs && labs.length > 0 && (
      <div style={{ ...S.cardPink }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_labs'] ? 4 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#f44336' }}>🩸 Лабораторный контроль</div><button onClick={() => toggleSection('clinical_labs')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_labs'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_labs'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_labs'] ? '▲' : '▼'}</button></div>
        {expandedSections['clinical_labs'] && labs.map((l, i) => (<div key={i} style={{ padding: '3px 0', borderBottom: i < labs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 8, lineHeight: 1.3 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}><b style={{ color: 'var(--text-light)' }}>{l.marker}</b><span style={{ color: '#ff9800', fontSize: 7 }}>{l.when}</span></div><div style={{ color: 'var(--text-dim)' }}>{l.what} · Цель: <span style={{ color: '#00e68a' }}>{l.target}</span></div><div style={{ color: 'var(--text-dim)', fontSize: 7 }}>{l.note}</div></div>))}
      </div>
    )}
    {/* Smart form recommender */}
    {recommender && recommender.length > 0 && (
      <div style={{ ...S.cardAccent }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedSections['clinical_form'] ? 4 : 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>💡 Умный подбор формы</div><button onClick={() => toggleSection('clinical_form')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer', border: '1px solid var(--border)', background: expandedSections['clinical_form'] ? 'rgba(167,139,250,0.1)' : 'transparent', color: expandedSections['clinical_form'] ? '#a78bfa' : 'var(--text-dim)' }}>{expandedSections['clinical_form'] ? '▲' : '▼'}</button></div>
        {expandedSections['clinical_form'] && recommender.map((r, i) => (<div key={i} style={{ padding: '4px 0', borderBottom: i < recommender.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ padding: '1px 4px', borderRadius: 3, fontSize: 7, fontWeight: 700, background: r.tier === 'premium' ? 'rgba(167,139,250,0.15)' : r.tier === 'standard' ? 'rgba(0,230,138,0.12)' : 'rgba(255,152,0,0.12)', color: r.tier === 'premium' ? '#a78bfa' : r.tier === 'standard' ? '#00e68a' : '#ff9800' }}>{r.tier === 'premium' ? '💎' : r.tier === 'standard' ? '⭐' : '💰'}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-light)' }}>{r.label}</div><div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{r.goal}</div></div>
          <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'right' }}>{r.budget}</span>
        </div>))}
      </div>
    )}
  </div>
); };



