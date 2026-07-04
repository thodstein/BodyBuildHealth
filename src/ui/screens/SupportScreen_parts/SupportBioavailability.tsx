import React, { useState, useMemo, useCallback } from 'react';
import { SUPPORT_CATALOG_DATA, type SupportCatalogEntry, type CatalogSubstanceForm } from '../../../data/support-database';
import { ALL_SUBSTANCES, type SubstanceForm } from '../../../data/support-substances';
import { PHARMA_DB } from '../../../core/pharma-database';
import { PEPTIDE_DB, ROUTE_LABELS } from '../../../engines/peptide-calculator.engine';
import { InfoErrorBoundary } from './SupportScreenData';
import { S } from './SupportShared';

// ─── Types ───
interface FormWithBio extends CatalogSubstanceForm {
  bioavailability: number;
  bioLabel: string;
  effectiveDose: (doseMg: number) => number;
}

interface EnrichedEntry {
  id: string;
  source: 'catalog' | 'pharma' | 'peptide';
  nameRu: string;
  nameEn: string;
  tier: string;
  category: string[];
  description: string;
  forms: FormWithBio[];
  maxBio: number;
  minBio: number;
  avgBio: number;
  bestForm: FormWithBio | null;
  enhancers: EnhancerInfo[];
  competitors: CompetitorInfo[];
}

interface EnhancerInfo {
  label: string;
  mult: number;
  desc: string;
}

interface CompetitorInfo {
  withLabel: string;
  effect: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Bioavailability coefficients ───
const FORM_BIOAVAIL: Record<string, number> = {
  ubiquinol: 0.90, ubiquinone: 0.20, mitoq: 0.95,
  d3_regular: 0.60, d3_liposomal: 0.95, d3_oil: 0.85,
  curcumin_std: 0.05, curcumin_piperine: 0.30, curcumin_meriva: 0.60,
  curcumin_theracurmin: 0.70, curcumin_liposomal: 0.80,
  silymarin_std: 0.15, silymarin_phospho: 0.60, silymarin_liposomal: 0.80,
  vitc_std: 0.45, vitc_liposomal: 0.90, vitc_buffered: 0.55,
  ala_racemic: 0.30, ala_r_form: 0.90,
  mg_oxide: 0.04, mg_citrate: 0.30, mg_glycinate: 0.45,
  mg_threonate: 0.55, mg_malate: 0.35, mg_taurate: 0.40,
  zn_oxide: 0.20, zn_picolinate: 0.60, zn_bisglycinate: 0.55,
  zn_citrate: 0.45, zn_sulfate: 0.35,
  se_selenite: 0.50, se_selenomethionine: 0.90, se_methylselenocysteine: 0.70,
  fe_sulfate: 0.15, fe_bisglycinate: 0.40, fe_fumarate: 0.20,
  ca_carbonate: 0.25, ca_citrate: 0.40, ca_malate: 0.35,
  omega3_ee: 0.60, omega3_tg: 0.85, omega3_pl: 0.95,
  standard: 0.40, liposomal: 0.85, chelated: 0.60, pharma_oral: 0.85,
};

const MODIFIERS: Record<string, EnhancerInfo> = {
  with_fat: { label: 'С жирной пищей', mult: 1.4, desc: 'Жиры образуют мицеллы для жирорастворимых веществ' },
  with_piperine: { label: 'С пиперином', mult: 4.0, desc: 'Ингибирует глюкуронидацию, ↑ биодоступность до 2000%' },
  liposomal: { label: 'Липосомальная форма', mult: 2.5, desc: 'Липосомы минуют разрушение в ЖКТ, ↑ проникновение в клетки' },
  empty_stomach: { label: 'Натощак', mult: 1.2, desc: 'Без конкуренции с пищей для некоторых аминокислот и минералов' },
  with_vitamin_c: { label: 'С витамином C', mult: 1.5, desc: 'C восстанавливает Fe³⁺→Fe²⁺, усиливает всасывание Fe и Zn' },
  sublingual: { label: 'Сублингвально', mult: 3.0, desc: 'Минует ЖКТ и first-pass метаболизм в печени' },
  phytosome: { label: 'Фитосомы', mult: 2.2, desc: 'Связывание с фосфолипидами для трансмембранного транспорта' },
  nanoparticle: { label: 'Наночастицы', mult: 2.5, desc: 'Наноразмер увеличивает растворимость в 2-5×' },
  with_black_pepper: { label: 'С чёрным перцем', mult: 2.0, desc: 'Пиперин в перце ингибирует CYP3A4' },
  chelated_mineral: { label: 'Хелатная форма', mult: 1.8, desc: 'Хелатирование с аминокислотами защищает от связывания в ЖКТ' },
};

const COMPETITION_PAIRS: CompetitorInfo[] = [
  { withLabel: 'Кальций (Ca)', effect: 'Ca и Mg, Fe, Zn конкурируют за DMT1 — интервал 2ч', severity: 'HIGH' },
  { withLabel: 'Цинк (Zn)', effect: 'Zn и Fe, Cu конкурируют за DMT1 — интервал 2ч', severity: 'HIGH' },
  { withLabel: 'Железо (Fe)', effect: 'Fe и Ca, Zn, Mg конкурируют за всасывание', severity: 'HIGH' },
  { withLabel: 'Магний (Mg)', effect: 'Mg и Ca конкурируют — интервал 2ч', severity: 'MEDIUM' },
  { withLabel: 'Медь (Cu)', effect: 'Высокие дозы Zn индуцируют металлотионеин, связывающий Cu', severity: 'MEDIUM' },
  { withLabel: 'Танины (чай/кофе)', effect: 'Танины связывают негемовое Fe, ↓ абсорбцию до 60%', severity: 'MEDIUM' },
  { withLabel: 'Антациды/ИПП', effect: '↑ pH желудка ↓ растворимость Ca, Zn, Fe, Cr', severity: 'HIGH' },
  { withLabel: 'Клетчатка', effect: 'Фитиновая кислота в злаках связывает Zn, Ca, Mg', severity: 'MEDIUM' },
];

const COMPETITION_KEYWORDS: Record<string, string[]> = {
  zn: ['calcium', 'calcium', 'calcium', 'iron', 'copper', 'iron'],
  fe: ['calcium', 'calcium', 'calcium', 'zinc', 'zinc', 'tannins'],
  ca: ['magnesium', 'magnesium', 'zinc', 'iron', 'ppis', 'iron'],
  mg: ['calcium', 'calcium', 'calcium', 'calcium'],
  cu: ['zinc', 'zinc', 'zinc', 'molybdenum'],
  cr: ['antacids', 'pharma'],
};

// ─── Detect bio category from form name ───
function detectFormBioKey(formName: string, formRu: string, notes?: string): string {
  const t = (formName + ' ' + formRu + ' ' + (notes || '')).toLowerCase();
  if (t.includes('ubiquinol') || t.includes('убихинол')) return 'ubiquinol';
  if (t.includes('mitoq')) return 'mitoq';
  if (t.includes('ubiquinone') || t.includes('убихинон')) return 'ubiquinone';
  if (t.includes('r-') || t.includes('r лип') || t.includes('r-лип')) return 'ala_r_form';
  if (t.includes('lipo') || t.includes('липосом')) return 'liposomal';
  if (t.includes('phytos') || t.includes('meriva') || t.includes('фитосом')) return 'phytosome';
  if (t.includes('nanoparticle') || t.includes('theracurmin') || t.includes('нано')) return 'nanoparticle';
  if (t.includes('picolinate') || t.includes('пиколинат')) return 'zn_picolinate';
  if (t.includes('glycinate') || t.includes('глицинат') || t.includes('bisglycinate') || t.includes('бисглицинат')) return 'mg_glycinate';
  if (t.includes('citrate') || t.includes('цитрат')) return 'mg_citrate';
  if (t.includes('oxide') || t.includes('оксид')) return 'mg_oxide';
  if (t.includes('threonate') || t.includes('треонат')) return 'mg_threonate';
  if (t.includes('malate') || t.includes('малат')) return 'mg_malate';
  if (t.includes('taurate') || t.includes('таурат')) return 'mg_taurate';
  if (t.includes('selenomethionine') || t.includes('селенометионин')) return 'se_selenomethionine';
  if (t.includes('curcumin') || t.includes('куркумин')) {
    if (t.includes('piperine') || t.includes('пиперин')) return 'curcumin_piperine';
    if (t.includes('theracurmin') || t.includes('теракурмин')) return 'curcumin_theracurmin';
    if (t.includes('meriva') || t.includes('фитосом')) return 'curcumin_meriva';
    return 'curcumin_piperine';
  }
  if (t.includes('silymarin') || t.includes('силимарин')) {
    if (t.includes('phospho') || t.includes('фосфолипид')) return 'silymarin_phospho';
    return 'silymarin_std';
  }
  if (t.includes('sulfate') || t.includes('сульфат')) return 'zn_sulfate';
  if (t.includes('carbonate') || t.includes('карбонат')) return 'ca_carbonate';
  if (t.includes('tg') || t.includes('триглицерид')) return 'omega3_tg';
  if (t.includes('ee') || t.includes('этиловый') || t.includes('ethyl')) return 'omega3_ee';
  if (t.includes('phospholipid') || t.includes('крил') || t.includes('kril')) return 'omega3_pl';
  if (t.includes('buffered') || t.includes('буферизированный')) return 'vitc_buffered';
  if (t.includes('sublingual') || t.includes('сублингвально')) return 'sublingual';
  if (t.includes('chelate') || t.includes('хелат')) return 'chelated';
  return 'standard';
}

// ─── Get bioavailability for a catalog form ───
function getCatalogFormBio(form: CatalogSubstanceForm): number {
  const canonicalId = form.id.toLowerCase();
  const sub = ALL_SUBSTANCES.find(s =>
    s.id.toLowerCase() === canonicalId || s.id.toLowerCase().replace(/_/g, '') === canonicalId);
  if (sub?.forms?.length) {
    const mf = sub.forms.find(f =>
      form.name.toLowerCase().includes(f.form.toLowerCase().slice(0, 6)) ||
      f.form.toLowerCase().includes(form.name.toLowerCase().slice(0, 6)));
    if (mf && mf.bioavailability > 0) return mf.bioavailability;
  }
  const key = detectFormBioKey(form.name, form.nameRu, form.notes);
  if (FORM_BIOAVAIL[key] !== undefined) return FORM_BIOAVAIL[key];
  if (form.notes?.includes('Лучшая') || form.notes?.includes('Максимальная')) return 0.80;
  if (form.notes?.includes('Менее биодоступен')) return 0.25;
  if (form.notes?.includes('более биодоступна')) return 0.70;
  return form.best ? 0.65 : 0.40;
}

// ─── ROUTE_LABELS_MAP for lookups ───
const ROUTE_LABELS_MAP: Record<string, string> = ROUTE_LABELS;

// ─── Detect enhancers ───
function detectEnhancers(entry: SupportCatalogEntry): EnhancerInfo[] {
  const res: EnhancerInfo[] = [];
  const nru = (entry.nameRu || '').toLowerCase();
  const cats = (entry.category || []).map(c => c.toLowerCase());
  const desc = (entry.description || '').toLowerCase();
  const si = (entry.specialInstructions || []).join(' ').toLowerCase();
  const allForms = (entry.forms || []).map(f => (f.name + f.nameRu + (f.notes || '')).toLowerCase()).join(' ');

  const add = (key: string) => {
    if (!res.some(e => e.label === MODIFIERS[key].label)) res.push(MODIFIERS[key]);
  };

  if (cats.some(c => c.includes('fat')) || desc.includes('жирорастворим') ||
      ['витамин d', 'витамин a', 'витамин e', 'витамин k', 'коэнзим', 'коq10', 'омега-3', 'ликопин', 'лютеин', 'астаксантин', 'куркум'].some(k => nru.includes(k)) ||
      si.includes('жир') || si.includes('масл')) add('with_fat');

  if (nru.includes('куркум') || desc.includes('пиперин') || si.includes('пиперин')) add('with_piperine');

  if (['витамин c', 'витамин с', 'аскорбин', 'vitamin c', 'iron', 'железо', 'ferrum'].some(k => nru.includes(k))) {
    add('with_vitamin_c');
  }
  if (cats.some(c => c.includes('mineral') || c.includes('минерал')) &&
      !res.some(e => e.label === MODIFIERS.with_vitamin_c.label)) {
    add('with_vitamin_c');
  }

  if (allForms.includes('lipo') || allForms.includes('липосом')) add('liposomal');

  if (allForms.includes('phytosom') || allForms.includes('фитосом') || allForms.includes('phospho')) add('phytosome');
  if (allForms.includes('nano') || allForms.includes('theracurmin') || allForms.includes('нано')) add('nanoparticle');
  if (allForms.includes('chelate') || allForms.includes('хелат')) add('chelated_mineral');
  if (allForms.includes('sublingual') || allForms.includes('сублингвально')) add('sublingual');
  if (allForms.includes('empty') || allForms.includes('натощак') || si.includes('натощак') ||
      (cats.includes('amino') || cats.includes('аминокислота'))) add('empty_stomach');

  return res;
}

// ─── Detect competition ───
const MINERAL_IDS = ['zinc', 'magnesium', 'calcium', 'iron', 'copper', 'chromium', 'manganese'];
function detectCompetition(entry: SupportCatalogEntry, nameRu: string, category: string[]): CompetitorInfo[] {
  const res: CompetitorInfo[] = [];
  const n = nameRu.toLowerCase();
  const cats = category.map(c => c.toLowerCase());
  const isMineral = cats.some(c => c.includes('mineral')) || MINERAL_IDS.some(id => n.includes(id));

  if (!isMineral) return res;

  if (n.includes('цинк') || n.includes('zinc')) {
    COMPETITION_PAIRS.filter(p => p.withLabel.includes('Цинк')).forEach(p => res.push(p));
  }
  if (n.includes('кальц') || n.includes('calcium') || n.includes('ca_')) {
    COMPETITION_PAIRS.filter(p => p.withLabel.includes('Кальций')).forEach(p => res.push(p));
  }
  if (n.includes('желез') || n.includes('iron') || n.includes('fe_') || n.includes('феррум')) {
    COMPETITION_PAIRS.filter(p => p.withLabel.includes('Железо')).forEach(p => res.push(p));
  }
  if (n.includes('магн') || n.includes('magnesium')) {
    COMPETITION_PAIRS.filter(p => p.withLabel.includes('Магний')).forEach(p => res.push(p));
  }
  if (n.includes('мед') || n.includes('copper')) {
    COMPETITION_PAIRS.filter(p => p.withLabel.includes('Медь')).forEach(p => res.push(p));
  }

  if (isMineral && res.length === 0) {
    COMPETITION_PAIRS.forEach(p => {
      if (!res.find(r => r.withLabel === p.withLabel)) res.push(p);
    });
  }

  return res.slice(0, 4);
}

// ─── Build enriched catalog ───
function buildCatalog(): EnrichedEntry[] {
  const entries: EnrichedEntry[] = [];

  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (!entry?.nameRu) continue;
    const forms: FormWithBio[] = (entry.forms || []).map(f => {
      const bio = getCatalogFormBio(f);
      return {
        ...f,
        bioavailability: bio,
        bioLabel: `${(bio * 100).toFixed(0)}%`,
        effectiveDose: (doseMg: number) => Math.round(doseMg * bio),
      };
    });
    const bios = forms.map(f => f.bioavailability);
    entries.push({
      id, source: 'catalog',
      nameRu: entry.nameRu, nameEn: entry.name || id,
      tier: entry.tier, category: entry.category || [],
      description: entry.description || '',
      forms, maxBio: bios.length ? Math.max(...bios) : 0,
      minBio: bios.length ? Math.min(...bios) : 0,
      avgBio: bios.length ? bios.reduce((a, b) => a + b, 0) / bios.length : 0,
      bestForm: forms.find(f => f.best) || null,
      enhancers: detectEnhancers(entry),
      competitors: detectCompetition(entry, entry.nameRu, entry.category),
    });
  }

  for (const [pid, ph] of Object.entries(PHARMA_DB)) {
    if (!ph || !ph.name) continue;
    const bio = ph.pk?.bioavailability ?? (ph.bioavailability ? (
      typeof ph.bioavailability === 'number' ? ph.bioavailability :
      typeof ph.bioavailability === 'object' && 'avg' in (ph.bioavailability as any) ? (ph.bioavailability as any).avg :
      0.85
    ) : 0.85);
    const forms: FormWithBio[] = [{
      id: pid, name: ph.name, nameRu: ph.name,
      dose: ph.dosageRange ? `${ph.dosageRange.min}-${ph.dosageRange.max} ${ph.dosageRange.unit}` : '—',
      best: true, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`,
      effectiveDose: (d: number) => Math.round(d * bio),
    }];
    entries.push({
      id: pid, source: 'pharma',
      nameRu: ph.name, nameEn: ph.name || pid,
      tier: 'standard', category: ['pharma', (ph as any).class || 'aas'].filter(Boolean),
      description: ph.description || '',
      forms, maxBio: bio, minBio: bio, avgBio: bio,
      bestForm: forms[0], enhancers: [], competitors: [],
    });
  }

  for (const [pepId, pp] of Object.entries(PEPTIDE_DB)) {
    if (!pp || !pp.name) continue;
    const forms: FormWithBio[] = (pp.routes || []).map(rt => {
      const b = pp.bioavailability?.[rt];
      const bio = b ? (b.min + b.max) / 2 / 100 : 0.80;
      return {
        id: `${pepId}_${rt}`, name: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`,
        nameRu: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`,
        dose: `${pp.amountMg} мг`, best: rt === 'sc',
        bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`,
        notes: b ? `диапазон ${b.min}-${b.max}%` : '',
        effectiveDose: (d: number) => Math.round(d * bio),
      };
    });
    const bios = forms.map(f => f.bioavailability);
    entries.push({
      id: pepId, source: 'peptide',
      nameRu: pp.name, nameEn: pp.name || pepId,
      tier: 'advanced', category: ['peptide', pp.className || 'gh_peptide'].filter(Boolean),
      description: `${pp.effects?.join(', ') || ''} · ${pp.mechanisms?.join(', ') || ''}`,
      forms, maxBio: bios.length ? Math.max(...bios) : 0,
      minBio: bios.length ? Math.min(...bios) : 0,
      avgBio: bios.length ? bios.reduce((a, b) => a + b, 0) / bios.length : 0,
      bestForm: forms[0] || null, enhancers: [], competitors: [],
    });
  }

  return entries;
}

// ─── Bio score color ───
function bioColor(bio: number): string {
  return bio >= 0.60 ? '#00e68a' : bio >= 0.35 ? '#ff9800' : '#f44336';
}

// ─── Bio score label ───
function bioLabel(bio: number): string {
  if (bio >= 0.80) return 'Отличная';
  if (bio >= 0.60) return 'Высокая';
  if (bio >= 0.40) return 'Средняя';
  if (bio >= 0.20) return 'Низкая';
  return 'Очень низкая';
}

// ─── Main component ───
type BTab = 'catalog' | 'calculator' | 'stats';

export const SupportBioavailability: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [tab, setTab] = useState<BTab>(() => (localStorage.getItem('he_bio_tab') as BTab) || 'catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'bio' | 'name' | 'forms'>('bio');
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem('he_bio_selected'));
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_bio_compare') || '[]'); } catch { return []; }
  });
  const [showCompare, setShowCompare] = useState(compareIds.length > 0);

  const catalog = useMemo(() => buildCatalog(), []);

  const allCategories = useMemo(() => {
    const c = new Set<string>();
    catalog.forEach(e => e.category.forEach(cat => c.add(cat)));
    return Array.from(c).sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    let list = catalog;
    const q = searchQuery.toLowerCase();
    if (q) {
      list = list.filter(e =>
        e.nameRu.toLowerCase().includes(q) ||
        e.nameEn.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.some(c => c.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== 'all') list = list.filter(e => e.category.includes(categoryFilter));
    if (sourceFilter !== 'all') list = list.filter(e => e.source === sourceFilter);
    if (sortBy === 'bio') list.sort((a, b) => b.maxBio - a.maxBio);
    else if (sortBy === 'name') list.sort((a, b) => a.nameRu.localeCompare(b.nameRu));
    else list.sort((a, b) => b.forms.length - a.forms.length);
    return list;
  }, [catalog, searchQuery, categoryFilter, sourceFilter, sortBy]);

  const selected = selectedId ? catalog.find(e => e.id === selectedId) : null;

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) localStorage.setItem('he_bio_selected', id);
    else localStorage.removeItem('he_bio_selected');
  }, []);

  const handleCompare = useCallback((id: string) => {
    let next: string[];
    if (compareIds.includes(id)) next = compareIds.filter(x => x !== id);
    else if (compareIds.length < 4) next = [...compareIds, id];
    else return;
    setCompareIds(next);
    localStorage.setItem('he_bio_compare', JSON.stringify(next));
  }, [compareIds]);

  const compareEntries = showCompare ? compareIds.map(id => catalog.find(e => e.id === id)).filter(Boolean) as EnrichedEntry[] : [];

  // Stats
  const stats = useMemo(() => {
    const all = catalog.filter(e => e.source === 'catalog');
    const pharma = catalog.filter(e => e.source === 'pharma');
    const peptides = catalog.filter(e => e.source === 'peptide');
    const allBio = all.map(e => e.maxBio);
    const avg = allBio.length ? allBio.reduce((a, b) => a + b, 0) / allBio.length : 0;
    const sorted = [...allBio].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return {
      total: catalog.length, supp: all.length, pharma: pharma.length, peptides: peptides.length,
      avgBio: avg, medianBio: median,
      highBio: all.filter(e => e.maxBio >= 0.6).length,
      midBio: all.filter(e => e.maxBio >= 0.35 && e.maxBio < 0.6).length,
      lowBio: all.filter(e => e.maxBio < 0.35).length,
      multiForm: all.filter(e => e.forms.length > 1).length,
    };
  }, [catalog]);

  return (
    <InfoErrorBoundary label="Калькулятор биодоступности">
      <div style={{ padding: '4px 0 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <div style={S.h2}>🧬 Калькулятор биодоступности</div>
          <div style={{ ...S.sub, marginBottom: 6 }}>
            Сравнение форм, расчёт эффективной дозы, стратегии улучшения всасывания
            <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 6 }}>
              · {stats.total} веществ ({stats.supp} БАД, {stats.pharma} фарма, {stats.peptides} пептиды)
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {(['catalog', 'calculator', 'stats'] as BTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); localStorage.setItem('he_bio_tab', t); }}
              style={{
                padding: '6px 14px', borderRadius: 16, fontSize: 10, fontWeight: 700,
                whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid var(--border)',
                background: tab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tab === t ? '#000' : 'var(--text-dim)',
              }}>
              {t === 'catalog' ? '📋 Каталог' : t === 'calculator' ? '🧮 Калькулятор доз' : '📊 Статистика'}
            </button>
          ))}
        </div>

        {tab === 'catalog' && (
          <CatalogTab
            catalog={catalog}
            filtered={filtered}
            allCategories={allCategories}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            selectedId={selectedId}
            handleSelect={handleSelect}
            compareIds={compareIds}
            handleCompare={handleCompare}
            showCompare={showCompare}
            setShowCompare={setShowCompare}
            compareEntries={compareEntries}
          />
        )}

        {tab === 'calculator' && (
          <CalculatorTab catalog={catalog} />
        )}

        {tab === 'stats' && (
          <StatsTab stats={stats} catalog={catalog} />
        )}
      </div>
    </InfoErrorBoundary>
  );
};

// ─── Catalog tab ───
interface CatalogTabProps {
  catalog: EnrichedEntry[];
  filtered: EnrichedEntry[];
  allCategories: string[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  sortBy: 'bio' | 'name' | 'forms';
  setSortBy: (v: 'bio' | 'name' | 'forms') => void;
  selectedId: string | null;
  handleSelect: (id: string | null) => void;
  compareIds: string[];
  handleCompare: (id: string) => void;
  showCompare: boolean;
  setShowCompare: (v: boolean) => void;
  compareEntries: EnrichedEntry[];
}

const CatalogTab: React.FC<CatalogTabProps> = ({
  catalog, filtered, allCategories, searchQuery, setSearchQuery,
  categoryFilter, setCategoryFilter, sourceFilter, setSourceFilter,
  sortBy, setSortBy, selectedId, handleSelect,
  compareIds, handleCompare, showCompare, setShowCompare, compareEntries,
}) => {
  const selected = selectedId ? catalog.find(e => e.id === selectedId) : null;

  if (selected) {
    return <DetailView entry={selected} onBack={() => handleSelect(null)} />;
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ ...S.card, marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Поиск..." style={{
            flex: 1, minWidth: 130, padding: '7px 8px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 10,
          }} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '6px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 110 }}>
          <option value="all">Все категории</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          style={{ padding: '6px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 90 }}>
          <option value="all">Все типы</option>
          <option value="catalog">БАД</option>
          <option value="pharma">Фарма</option>
          <option value="peptide">Пептиды</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: '6px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 110 }}>
          <option value="bio">По биодоступности</option>
          <option value="name">По алфавиту</option>
          <option value="forms">По числу форм</option>
        </select>
        <button onClick={() => setShowCompare(!showCompare)}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
            background: showCompare ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)',
            color: showCompare ? '#00e68a' : 'var(--text-dim)', fontSize: 9, fontWeight: 700,
          }}>
          {showCompare ? '✓ Сравнение' : '⚖ Сравнить'}
        </button>
      </div>

      {/* Compare panel */}
      {showCompare && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
            Выберите до 4 веществ (текущие: {compareIds.length})
          </div>
          {compareEntries.length > 0 && (
            <div style={{ ...S.card, marginBottom: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareEntries.length, 3)}, 1fr)`, gap: 6 }}>
                {compareEntries.map(ce => (
                  <div key={ce.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{ce.nameRu}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                      {ce.forms.length} форм · {ce.source}
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                      <div style={{ height: '100%', borderRadius: 2, minWidth: 3,
                        background: `linear-gradient(90deg, #f44336 ${ce.minBio * 100}%, #ff9800 ${(ce.minBio + (ce.maxBio - ce.minBio) * 0.4) * 100}%, #00e68a ${ce.maxBio * 100}%)`,
                        width: `${ce.maxBio * 100}%` }} />
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)'}}>
                      {(ce.minBio * 100).toFixed(0)}–{(ce.maxBio * 100).toFixed(0)}%
                    </div>
                    <button onClick={() => handleCompare(ce.id)}
                      style={{ marginTop: 2, padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(244,63,94,0.3)',
                        background: 'transparent', color: '#f44336', fontSize: 7, cursor: 'pointer' }}>
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
              {compareEntries.length >= 2 && (
                <div style={{ marginTop: 8, fontSize: 9, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 2, textAlign: 'left', color: 'var(--text-dim)', fontSize: 8 }}>Параметр</th>
                        {compareEntries.map(ce => (
                          <th key={ce.id} style={{ padding: 2, textAlign: 'center', color: 'var(--text-dim)', fontSize: 8 }}>{ce.nameRu}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 8 }}>Форм</td>
                        {compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 8 }}>{ce.forms.length}</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 8 }}>Мин. био</td>
                        {compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 8, color: '#f44336' }}>{(ce.minBio * 100).toFixed(0)}%</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 8 }}>Макс. био</td>
                        {compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 8, color: '#00e68a' }}>{(ce.maxBio * 100).toFixed(0)}%</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 8 }}>Лучшая форма</td>
                        {compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 7 }}>{ce.bestForm?.nameRu || '—'}</td>)}
                      </tr>
                      <tr>
                        <td style={{ padding: 2, color: 'var(--text-dim)', fontSize: 8 }}>Тип</td>
                        {compareEntries.map(ce => <td key={ce.id} style={{ padding: 2, textAlign: 'center', fontSize: 8, color: 'var(--text-dim)' }}>{ce.source}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
        {filtered.length} из {catalog.length} веществ
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {filtered.map(item => (
          <div key={item.id} onClick={() => handleSelect(item.id)}
            style={{
              ...S.card, cursor: 'pointer', transition: 'all 0.15s',
              border: compareIds.includes(item.id) ? '1px solid rgba(0,230,138,0.4)' : S.card.border,
              background: compareIds.includes(item.id) ? 'rgba(0,230,138,0.04)' : S.card.background,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 1 }}>
                  {item.nameRu}
                  <span style={{ fontSize: 7, fontWeight: 600, color: 'var(--text-dim)', marginLeft: 4 }}>
                    {item.source === 'catalog' ? (item.tier === 'core' ? '⭐' : '✦') : item.source === 'pharma' ? '💊' : '🧬'}
                    · {item.category.slice(0, 2).join(', ')}
                  </span>
                </div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.forms.length} форм · {bioLabel(item.maxBio)}
                </div>
              </div>
              {showCompare && (
                <div onClick={e => { e.stopPropagation(); handleCompare(item.id); }}
                  style={{
                    padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 8,
                    border: compareIds.includes(item.id) ? '1px solid #00e68a' : '1px solid var(--border)',
                    color: compareIds.includes(item.id) ? '#00e68a' : 'var(--text-dim)',
                    background: compareIds.includes(item.id) ? 'rgba(0,230,138,0.08)' : 'transparent',
                    flexShrink: 0,
                  }}>
                  {compareIds.includes(item.id) ? '✓' : '+'}
                </div>
              )}
            </div>
            <div style={{ marginTop: 3 }}>
              {item.forms.length > 1 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>Биодоступность форм</span>
                    <span style={{ fontSize: 7, fontWeight: 700, color: bioColor(item.maxBio) }}>
                      {(item.minBio * 100).toFixed(0)}% – {(item.maxBio * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, minWidth: 3,
                      background: `linear-gradient(90deg, #f44336 ${item.minBio * 100}%, #ff9800 ${(item.minBio + (item.maxBio - item.minBio) * 0.4) * 100}%, #00e68a ${item.maxBio * 100}%)`,
                      width: `${item.maxBio * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ height: 4, flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, minWidth: 3,
                      background: bioColor(item.maxBio), width: `${item.maxBio * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: bioColor(item.maxBio) }}>
                    {(item.maxBio * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
            {item.enhancers.length > 0 && (
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                {item.enhancers.slice(0, 3).map(e => (
                  <span key={e.label} style={{ padding: '1px 4px', borderRadius: 3, fontSize: 6, fontWeight: 600,
                    background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>{e.label}</span>
                ))}
                {item.enhancers.length > 3 && (
                  <span style={{ fontSize: 6, color: 'var(--text-dim)' }}>+{item.enhancers.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ ...S.card, textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 11 }}>
            Ничего не найдено
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Detail view ───
const DetailView: React.FC<{ entry: EnrichedEntry; onBack: () => void }> = ({ entry, onBack }) => {
  const [doseMg, setDoseMg] = useState(entry.forms[0] && !isNaN(Number(entry.forms[0]?.dose?.match(/\d+/)?.[0])) ? Number(entry.forms[0]?.dose?.match(/\d+/)?.[0]) : 500);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(entry.forms.length > 1 ? 1 : 0);
  const [enhancersOn, setEnhancersOn] = useState(false);

  const fromForm = entry.forms[fromIdx];
  const toForm = entry.forms[toIdx];
  const baseEff = fromForm ? fromForm.effectiveDose(doseMg) : 0;
  const enhMult = enhancersOn ? entry.enhancers.reduce((p, e) => p * e.mult, 1.0) : 1.0;
  const effWithEnh = Math.round(baseEff * enhMult);
  const equiv = fromForm && toForm ? Math.round(doseMg * (fromForm.bioavailability / toForm.bioavailability)) : doseMg;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onBack} style={{
          padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 9, cursor: 'pointer',
        }}>←</button>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{entry.nameRu}</div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
            {entry.nameEn} · {entry.source === 'catalog' ? 'БАД' : entry.source === 'pharma' ? 'Фарма' : 'Пептид'} · {entry.category.join(', ')}
          </div>
        </div>
      </div>

      {entry.description && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>
            {entry.description.slice(0, 300)}{entry.description.length > 300 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Forms table */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
          💊 Формы выпуска ({entry.forms.length})
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
          Эффективная доза = доза × биодоступность. Например, {doseMg} мг × {((fromForm?.bioavailability || 0.4) * 100).toFixed(0)}% = {baseEff} мг усвоится
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '2px 3px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>Форма</th>
              <th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Доза</th>
              <th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Био</th>
              <th style={{ padding: '2px 3px', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>Эфф. доза</th>
            </tr>
          </thead>
          <tbody>
            {entry.forms.map((f, i) => {
              const eff = f.effectiveDose(doseMg);
              return (
                <tr key={f.id || i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: f.best ? 'rgba(0,230,138,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '3px 3px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-light)', fontSize: 9 }}>{f.nameRu}</div>
                    {f.notes && <div style={{ fontSize: 6, color: 'var(--text-dim)' }}>{f.notes}</div>}
                  </td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', color: 'var(--text-dim)' }}>{f.dose}</td>
                  <td style={{ padding: '3px 3px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                      <div style={{ width: 35, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, minWidth: 2,
                          background: bioColor(f.bioavailability), width: `${f.bioavailability * 100}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 8, color: bioColor(f.bioavailability) }}>
                        {f.bioLabel}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', fontWeight: 700, fontSize: 9, color: 'var(--text-light)' }}>
                    {eff} мг
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Enhancers */}
      {entry.enhancers.length > 0 && (
        <div style={{ ...S.cardBlue }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>🚀 Усилители всасывания</div>
            <button onClick={() => setEnhancersOn(!enhancersOn)}
              style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                border: enhancersOn ? '1px solid #00e68a' : '1px solid var(--border)',
                background: enhancersOn ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)',
                color: enhancersOn ? '#00e68a' : 'var(--text-dim)',
              }}>
              {enhancersOn ? '✓ Учтены' : 'Учесть'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entry.enhancers.map(e => (
              <div key={e.label} style={{
                padding: '5px 8px', borderRadius: 6,
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa' }}>{e.label}</span>
                  <span style={{ fontSize: 8, color: enhancersOn ? '#00e68a' : 'var(--text-dim)' }}>
                    ×{e.mult.toFixed(1)}
                  </span>
                </div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{e.desc}</div>
              </div>
            ))}
          </div>
          {enhancersOn && (
            <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, textAlign: 'center',
              background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                Эффективная доза с усилителями: </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#00e68a' }}>
                {effWithEnh} мг </span>
              <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                (было {baseEff} мг · множитель ×{enhMult.toFixed(2)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Competition */}
      {entry.competitors.length > 0 && (
        <div style={{ ...S.cardPink }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f44336', marginBottom: 6 }}>
            ⚠ Конкуренция за всасывание
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {entry.competitors.map(c => (
              <div key={c.withLabel} style={{
                padding: '4px 6px', borderRadius: 4,
                background: c.severity === 'HIGH' ? 'rgba(244,63,94,0.06)' : 'rgba(244,63,94,0.03)',
                border: '1px solid ' + (c.severity === 'HIGH' ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.08)'),
                fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.3,
              }}>
                <span style={{ fontWeight: 700, color: '#f44336' }}>{c.withLabel}</span>: {c.effect}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equivalent dose calculator */}
      {entry.forms.length > 1 && (
        <div style={{ ...S.cardAccent }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>
            🔄 Калькулятор эквивалентной дозы
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
            Новая доза = текущая доза × (био₁ / био₂)
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20 }}>Из:</span>
            <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))}
              style={{ flex: 1, padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>
              {entry.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20 }}>В:</span>
            <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))}
              style={{ flex: 1, padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }}>
              {entry.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20 }}>Доза:</span>
            <input type="number" value={doseMg} min={0} max={10000}
              onChange={e => setDoseMg(Math.max(0, Number(e.target.value) || 0))}
              style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 9, maxWidth: 80 }} />
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг</span>
          </div>
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6, textAlign: 'center',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
              Эквивалент <b>{toForm?.nameRu}</b>:
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>
              {equiv} <span style={{ fontSize: 10 }}>мг</span>
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
              {doseMg} мг × ({(fromForm?.bioavailability || 0.4) / (toForm?.bioavailability || 0.4) * 100 | 0}%)
            </div>
          </div>
        </div>
      )}

      {/* Principles */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>
          📋 Принципы биодоступности
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div>• <b>Липосомы</b> — защита от разрушения в ЖКТ, био до 90%</div>
          <div>• <b>Хелаты</b> — аминокислоты защищают минералы от связывания (в 2-5× лучше оксидов)</div>
          <div>• <b>Пиперин</b> — ↑ био куркумина на 2000%, ресвератрола на 200%+</div>
          <div>• <b>Жиры</b> — обязательны для D3, A, E, K, CoQ10, куркумина</div>
          <div>• <b>Интервал 2ч</b> — Ca↔Mg, Zn↔Fe, Cu↔Zn</div>
          <div>• <b>Витамин C + Fe</b> — ↑ всасывание Fe в 3-6×</div>
        </div>
      </div>
    </div>
  );
};

// ─── Calculator tab ───
const CalculatorTab: React.FC<{ catalog: EnrichedEntry[] }> = ({ catalog }) => {
  const [sub1Id, setSub1Id] = useState('');
  const [sub2Id, setSub2Id] = useState('');
  const [dose1, setDose1] = useState(500);
  const [dose2, setDose2] = useState(500);
  const [form1Idx, setForm1Idx] = useState(0);
  const [form2Idx, setForm2Idx] = useState(0);

  const sub1 = sub1Id ? catalog.find(e => e.id === sub1Id) : null;
  const sub2 = sub2Id ? catalog.find(e => e.id === sub2Id) : null;
  const f1 = sub1?.forms[form1Idx];
  const f2 = sub2?.forms[form2Idx];
  const eff1 = f1 ? f1.effectiveDose(dose1) : 0;
  const eff2 = f2 ? f2.effectiveDose(dose2) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
          🧮 Расчёт эффективной дозы
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.3 }}>
          Эффективная доза = принятая доза × биодоступность. Сравните два вещества или две формы одного вещества.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Substance 1 */}
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>Вещество 1</div>
            <select value={sub1Id} onChange={e => { setSub1Id(e.target.value); setForm1Idx(0); }}
              style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
              <option value="">Выберите...</option>
              {catalog.map(e => <option key={e.id} value={e.id}>{e.nameRu} ({e.source})</option>)}
            </select>
            {sub1 && sub1.forms.length > 0 && (
              <select value={form1Idx} onChange={e => setForm1Idx(Number(e.target.value))}
                style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
                {sub1.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}
              </select>
            )}
            <input type="number" value={dose1} min={0} onChange={e => setDose1(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Доза мг"
              style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }} />
            {f1 && (
              <div style={{ marginTop: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Эффективная доза:</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a' }}>{eff1} <span style={{ fontSize: 9 }}>мг</span></div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{dose1} мг × {((f1.bioavailability) * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>

          {/* Substance 2 */}
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>Вещество 2</div>
            <select value={sub2Id} onChange={e => { setSub2Id(e.target.value); setForm2Idx(0); }}
              style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
              <option value="">Выберите...</option>
              {catalog.map(e => <option key={e.id} value={e.id}>{e.nameRu} ({e.source})</option>)}
            </select>
            {sub2 && sub2.forms.length > 0 && (
              <select value={form2Idx} onChange={e => setForm2Idx(Number(e.target.value))}
                style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
                {sub2.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}
              </select>
            )}
            <input type="number" value={dose2} min={0} onChange={e => setDose2(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Доза мг"
              style={{ width: '100%', padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8 }} />
            {f2 && (
              <div style={{ marginTop: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Эффективная доза:</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{eff2} <span style={{ fontSize: 9 }}>мг</span></div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{dose2} мг × {((f2.bioavailability) * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison result */}
        {f1 && f2 && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, textAlign: 'center',
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>
              ⚖ Сравнение
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 8, color: '#00e68a' }}>{f1.nameRu}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{eff1} мг</div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>био {((f1.bioavailability) * 100).toFixed(0)}%</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-dim)' }}>vs</div>
              <div>
                <div style={{ fontSize: 8, color: '#60a5fa' }}>{f2.nameRu}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{eff2} мг</div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>био {((f2.bioavailability) * 100).toFixed(0)}%</div>
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
              Разница: {eff1 > eff2
                ? `${f1.nameRu} эффективнее на ${(eff1 / eff2 * 100 - 100).toFixed(0)}%`
                : eff2 > eff1
                  ? `${f2.nameRu} эффективнее на ${(eff2 / eff1 * 100 - 100).toFixed(0)}%`
                  : 'Одинаково'}
            </div>
          </div>
        )}
      </div>

      {/* Efficiency ranking */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>
          📊 Топ веществ по эффективной биодоступности
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>
          Вещества с наилучшей максимальной биодоступностью форм:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {catalog
            .filter(e => e.source === 'catalog')
            .sort((a, b) => b.maxBio - a.maxBio)
            .slice(0, 15)
            .map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
                borderRadius: 4, background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-dim)', minWidth: 14 }}>#{i + 1}</span>
                <div style={{ flex: 1, fontSize: 9, fontWeight: i < 3 ? 700 : 400, color: 'var(--text-light)' }}>{item.nameRu}</div>
                <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, minWidth: 2,
                    background: bioColor(item.maxBio), width: `${item.maxBio * 100}%` }} />
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, color: bioColor(item.maxBio), minWidth: 32, textAlign: 'right' }}>
                  {(item.maxBio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── Stats tab ───
interface StatsInfo {
  total: number; supp: number; pharma: number; peptides: number;
  avgBio: number; medianBio: number;
  highBio: number; midBio: number; lowBio: number; multiForm: number;
}

const StatsTab: React.FC<{ stats: StatsInfo; catalog: EnrichedEntry[] }> = ({ stats, catalog }) => {
  const suppEntries = catalog.filter(e => e.source === 'catalog');

  // By category
  const catStats = useMemo(() => {
    const map = new Map<string, { count: number; totalBio: number; totalForms: number }>();
    suppEntries.forEach(e => {
      e.category.forEach(cat => {
        const prev = map.get(cat) || { count: 0, totalBio: 0, totalForms: 0 };
        prev.count++;
        prev.totalBio += e.maxBio;
        prev.totalForms += e.forms.length;
        map.set(cat, prev);
      });
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({ cat, count: v.count, avgBio: v.count ? v.totalBio / v.count : 0, avgForms: v.count ? v.totalForms / v.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [suppEntries]);

  // Tier distribution
  const tierStats = useMemo(() => {
    const map = new Map<string, { count: number; totalBio: number }>();
    suppEntries.forEach(e => {
      const t = e.tier;
      const prev = map.get(t) || { count: 0, totalBio: 0 };
      prev.count++; prev.totalBio += e.maxBio;
      map.set(t, prev);
    });
    return Array.from(map.entries()).map(([tier, v]) => ({ tier, count: v.count, avgBio: v.count ? v.totalBio / v.count : 0 }));
  }, [suppEntries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Overview */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
          📊 Общая статистика
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'Всего веществ', value: stats.total, color: 'var(--text-light)' },
            { label: 'БАД', value: stats.supp, color: '#00e68a' },
            { label: 'Фарма', value: stats.pharma, color: '#60a5fa' },
            { label: 'Пептиды', value: stats.peptides, color: '#a78bfa' },
            { label: 'Средняя био', value: `${(stats.avgBio * 100).toFixed(1)}%`, color: bioColor(stats.avgBio) },
            { label: 'Медиана био', value: `${(stats.medianBio * 100).toFixed(1)}%`, color: bioColor(stats.medianBio) },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution chart */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
          📈 Распределение биодоступности (БАД)
        </div>
        {[
          { label: 'Высокая (≥60%)', count: stats.highBio, color: '#00e68a' },
          { label: 'Средняя (35-60%)', count: stats.midBio, color: '#ff9800' },
          { label: 'Низкая (<35%)', count: stats.lowBio, color: '#f44336' },
        ].map(b => {
          const pct = stats.supp ? (b.count / stats.supp * 100).toFixed(0) : '0';
          return (
            <div key={b.label} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginBottom: 1 }}>
                <span>{b.label}</span>
                <span style={{ fontWeight: 700, color: b.color }}>{b.count} ({pct}%)</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: b.color,
                  width: `${pct}%`, minWidth: 4 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* By category */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>
          📂 По категориям
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {catStats.slice(0, 25).map(cs => (
            <div key={cs.cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-light)', minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cs.cat}
              </span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, minWidth: 2,
                  background: bioColor(cs.avgBio), width: `${cs.avgBio * 100}%` }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 600, color: bioColor(cs.avgBio), minWidth: 30, textAlign: 'right' }}>
                {(cs.avgBio * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 7, color: 'var(--text-dim)', minWidth: 24, textAlign: 'right' }}>
                {cs.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-form stats */}
      <div style={{ ...S.cardBlue }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
          🔄 Множественные формы
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {stats.multiForm} из {stats.supp} БАД ({stats.supp ? (stats.multiForm / stats.supp * 100).toFixed(0) : 0}%) имеют несколько форм выпуска.
          {stats.multiForm > 0 && ` Это позволяет выбирать форму с лучшей биодоступностью.`}
        </div>
      </div>

      {/* Tier stats */}
      {tierStats.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
            🏆 По уровню (tier)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tierStats.map(ts => (
              <div key={ts.tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 7, fontWeight: 700,
                  background: ts.tier === 'core' ? 'rgba(0,230,138,0.15)' : ts.tier === 'standard' ? 'rgba(59,130,246,0.12)' : 'rgba(167,139,250,0.12)',
                  color: ts.tier === 'core' ? '#00e68a' : ts.tier === 'standard' ? '#60a5fa' : '#a78bfa',
                }}>
                  {ts.tier === 'core' ? '⭐ Core' : ts.tier === 'standard' ? '✦ Standard' : ts.tier === 'advanced' ? '⚡ Advanced' : ts.tier}
                </span>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{ts.count} веществ</span>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, minWidth: 2,
                    background: bioColor(ts.avgBio), width: `${ts.avgBio * 100}%` }} />
                </div>
                <span style={{ fontSize: 8, fontWeight: 600, color: bioColor(ts.avgBio), minWidth: 30, textAlign: 'right' }}>
                  {(ts.avgBio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
