import type { CalculatorState, CalculatorResult, LabSlice } from './support-calculator.types';
import { PHARMA_DB } from '../core/pharma-database';
import { MECHANISM_TO_SUPPORT, ORGAN_TO_SUPPORT, SYSTEM_TO_SUPPORT, CATEGORY_TO_SUPPORT, DRUG_PD_EFFECT_TO_SUPPORT, getSupportEntry, findByMechanisms, findByLabMarker, findByCategoryAndMech, findByOrganAndMech, SUPPORT_CATALOG_DATA, ALL_SUPPORT_IDS, filterByCoverageLevel, getEntryTier, getSynergyScore, getConflictScore, scoreCombination, COVERAGE_TIER_MAP, getBoostSubstances } from '../data/support-index';
import { getSupportByMechanism, getSupportBySystem, getFullChainSupport } from '../data/mechanism-support-bridge';
import { normalizeLabValue } from '../core/constants';

export type RecSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RecStatus = 'active' | 'escalated' | 'blocked' | 'covered';

export interface RecSubstance {
  id: string;
  name: string;
  dose: string;
  reasoning: string;
  tier: 'base' | 'first' | 'second' | 'third';
}

export interface Recommendation {
  id: string;
  severity: RecSeverity;
  system: string;
  systemLabel: string;
  title: string;
  status: RecStatus;
  substances: RecSubstance[];
  escalation: string;
  monitoring: string;
  conflicts: string[];
}

export interface CoverageResult {
  level: string;
  riskBefore: number;
  riskAfter: number;
  coverage: Record<string, number>;
  avgCoverage: number;
  warning: string | null;
  substanceCount: number;
  synergyScore: number;
}

function getV(fp: LabSlice | null | undefined, panel: keyof LabSlice, key: string): number | null {
  if (!fp) return null;
  const pv = fp[panel] as Record<string, string> | undefined;
  if (!pv) return null;
  const v = parseFloat(pv[key]);
  if (isNaN(v)) return null;
  // Нормализация гормонов к единицам РФ
  if (key === 'E2' || key === 'Prolactin' || key === 'Total T' || key === 'Cortisol' || key === 'DHEA-S') {
    return normalizeLabValue(key, v);
  }
  return v;
}

// Get substance info from SUPPORT_CATALOG_DATA or fallback
function subInfo(id: string): { name: string; dose: string; tier: 'first' | 'second' | 'third' | 'base' } {
  const entry = getSupportEntry(id);
  if (entry) {
    const dose = entry.dosage ? `${entry.dosage.mg} мг` : '';
    const tierMap: Record<string, 'first' | 'second' | 'third' | 'base'> = { core: 'first', standard: 'second', advanced: 'third', specialty: 'third' };
    return { name: entry.nameRu || entry.name || id, dose, tier: tierMap[entry.tier] || 'base' };
  }
  return { name: id, dose: '', tier: 'base' };
}

// Build substance entry with reasoning from catalog
function makeSub(id: string, reasoning: string): { id: string; name: string; dose: string; reasoning: string; tier: 'first' | 'second' | 'third' | 'base' } {
  const info = subInfo(id);
  return { id, name: info.name, dose: info.dose, reasoning, tier: info.tier };
}

// Find support substances by mechanisms, deduplicate, limit to top N
function findSupportByMechanisms(mechs: string[], maxResults: number = 6): string[] {
  const ids = new Set<string>();
  for (const m of mechs) {
    for (const id of (MECHANISM_TO_SUPPORT[m] || [])) ids.add(id);
  }
  return [...ids].slice(0, maxResults);
}

// Find support by category + mechanism intersection
function findSupportByCategoryAndMech(category: string, ...mechs: string[]): string[] {
  const catIds = new Set(CATEGORY_TO_SUPPORT[category] || []);
  const mechIds = new Set(findSupportByMechanisms(mechs, 50));
  return [...catIds].filter(x => mechIds.has(x)).slice(0, 4);
}

export function evaluateRecommendations(state: CalculatorState, result: CalculatorResult, courseWeek?: number): Recommendation[] {
  const fp = state.labs?.fullPanel;
  const sex = state.profile.sex;
  const drugs = state.pharma.aas;
  const recs: Recommendation[] = [];
  const blockedIds = state.journal.negative.map(n => n.substanceId);
  const week = courseWeek || Math.min(state.goals.cycleWeeks || 12, Math.max(1, ...drugs.map(a => a.weeks || 12)));
  // Track which drugs are active at the selected week
  const activeDrugs = drugs.filter(a => (a.weeks || 12) >= week);
  const futureDrugs = drugs.filter(a => (a.weeks || 12) >= week && (a.startWeek || 1) > 1);
  const startingThisWeek = drugs.filter(a => (a.startWeek || 1) === week);
  const endingSoon = drugs.filter(a => (a.endWeek || (a.weeks || 12)) === week);

  const addRec = (id: string, severity: RecSeverity, system: string, systemLabel: string, title: string, substanceIds: string[], reasoningMap: Record<string, string>, escalation: string, monitoring: string) => {
    const substances = substanceIds.filter(sid => !blockedIds.includes(sid)).map(sid => {
      const s = makeSub(sid, reasoningMap[sid] || '');
      if (blockedIds.includes(sid)) { s.name += ' [⚠ ЗАБЛОКИРОВАН]'; s.reasoning += ' — замена по механизму'; }
      return s;
    });
    if (substances.length === 0) return;
    recs.push({ id, severity, system, systemLabel, title, status: 'active', substances, escalation, monitoring, conflicts: [] });
  };

  // ════════════════════════════════════════════════════════════════
  //  PHASE 1: Scan each drug in course → pd effects → query index
  // ════════════════════════════════════════════════════════════════
  let maxHct = 0, maxHep = 0, maxNeuro = 0, maxAro = 0, maxProg = 0, maxLipid = 0;
  let hasOral = false, has19Nor = false;
  const drugNames: string[] = [];

  for (const aas of activeDrugs) {
    const drug = (PHARMA_DB as any)[aas.id];
    if (!drug) continue;
    drugNames.push(drug.name || aas.id);
    const pd = drug.pd || {};
    if (typeof pd.hct_impact === 'number') maxHct = Math.max(maxHct, pd.hct_impact);
    if (typeof pd.hepatotoxicity === 'number') maxHep = Math.max(maxHep, pd.hepatotoxicity);
    if (typeof pd.neuro_toxicity === 'number') maxNeuro = Math.max(maxNeuro, pd.neuro_toxicity);
    if (typeof pd.aromatization === 'number') maxAro = Math.max(maxAro, pd.aromatization);
    if (typeof pd.progestogenic === 'number') maxProg = Math.max(maxProg, pd.progestogenic);
    if (typeof pd.lipid_impact === 'number') maxLipid = Math.max(maxLipid, Math.abs(pd.lipid_impact));
    if (drug.class === 'oral_17aa') hasOral = true;
    if (drug.class === 'nandrolone' || pd.progestogenic >= 0.3) has19Nor = true;
  }

  // Week-change notifications
  const weekChanges: string[] = [];
  if (startingThisWeek.length > 0) {
    weekChanges.push(`📌 Начало: ${startingThisWeek.map(a => (PHARMA_DB as any)[a.id]?.name || a.id).join(', ')}`);
  }
  if (endingSoon.length > 0) {
    weekChanges.push(`🔄 Окончание: ${endingSoon.map(a => (PHARMA_DB as any)[a.id]?.name || a.id).join(', ')}`);
  }
  if (futureDrugs.length > 0 && week < futureDrugs[0]?.weeks) {
    weekChanges.push(`⏳ Ожидаются: ${futureDrugs.map(a => `${(PHARMA_DB as any)[a.id]?.name || a.id} (с ${a.startWeek || 1} нед)`).join(', ')}`);
  }
  if (weekChanges.length > 0) {
    recs.push({ id:'__week_change', severity:'info', system:'', systemLabel:'📅 Неделя ' + week, title: weekChanges.join(' · '), status:'active', substances:[], escalation:'', monitoring:'', conflicts:[] });
  }

  // ── HCT impact → query support by mechanism ──
  const hctVal = getV(fp, 'panelHematology', 'HCT');
  if (maxHct >= 3 || state.cardio.hctElevation !== 'none' || (hctVal !== null && hctVal > (sex === 'male' ? 47 : 44))) {
    const severe = maxHct >= 5 || (hctVal !== null && hctVal > 52) || state.cardio.hctElevation === 'severe';
    let hctIds: string[] = findSupportByMechanisms(['PLATELET_AGGREGATION_INHIBITION', 'FIBRINOLYSIS']);
    if (hctIds.length < 2) hctIds = ['serrapeptase', 'nattokinase'];
    const hctReasoning: Record<string, string> = {};
    hctIds.forEach(id => { hctReasoning[id] = `Фибринолитик${severe ? ' (усиленный режим)' : ''}`; });
    if (severe || state.contraindications.hasThrombophilia) {
      const extra = findSupportByMechanisms(['ANTICOAGULANT']);
      extra.forEach(id => { if (!hctIds.includes(id)) { hctIds.push(id); hctReasoning[id] = 'Антикоагулянт'; } });
    }
    addRec('hct', severe ? 'critical' : 'high', 'hematologic', 'Кровь',
      `HCT ↑${hctVal !== null ? ': ' + hctVal + '%' : ''} от ${drugNames.join(', ')}${state.contraindications.hasThrombophilia ? ' (тромбофилия)' : ''}`,
      hctIds, hctReasoning,
      `HCT > 52: усилить фибринолиз. Контроль D-димера. Гидратация 3+ л/день.`,
      'HCT, Hb, RBC, D-димер, фибриноген каждые 2 нед');
  }

  // ── Hepatotoxicity → query hepatoprotectors ──
  const altVal = getV(fp, 'panelBiochem', 'ALT');
  if (maxHep > 0 || hasOral || state.hepatobiliary.altAstElevation !== 'none' || (altVal !== null && altVal > 40)) {
    const severe = maxHep >= 2.5 || hasOral || (altVal !== null && altVal > 100);
    let ids: string[] = findSupportByCategoryAndMech('hepatoprotector', 'GLUTATHIONE_SYNTHESIS', 'ANTIOXIDANT', 'BILE_ACID_MOD');
    if (ids.length < 3) ids = ['nac', 'tudca', 'milk_thistle'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => {
      const entry = getSupportEntry(id);
      reasoning[id] = entry?.description?.slice(0, 100) || `Гепатопротектор${severe ? ' (усиленный)' : ''}`;
    });
    if (severe || hasOral) {
      const extra = findByMechanisms('MEMBRANE_PHOSPHOLIPID');
      extra.forEach(id => { if (!ids.includes(id)) { ids.push(id); reasoning[id] = 'Мембранная защита при высокотоксичных ААС'; } });
    }
    addRec('hepatic', severe ? 'critical' : 'high', 'hepatic', 'Печень',
      `Гепатотоксичность${altVal !== null ? ': АЛТ ' + altVal : ''}${hasOral ? ' (оральные ААС)' : ''} от ${drugNames.join(', ')}`,
      ids, reasoning,
      `АЛТ > 100: NAC → 2400 мг. ${hasOral ? 'Курс оральных не более 6 нед.' : ''}Контроль каждые 2 нед.`,
      'АЛТ, АСТ, ГГТ, ЩФ, билирубин каждые 2-4 нед');
  }

  // ── Neurotoxicity → query neuroprotectors ──
  if (maxNeuro >= 0.3 || state.neuro.memoryIssues || state.neuro.focusIssues) {
    let ids: string[] = findSupportByCategoryAndMech('neuroprotector', 'NGF_STIMULATION', 'NEUROPROTECTION', 'DOPAMINE_PRECURSOR', 'GABA_MODULATION');
    if (ids.length < 3) ids = ['citicoline', 'fasoracetam', 'bromantane', 'lions_mane'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { reasoning[id] = 'Нейропротектор, поддержка когнитивных функций'; });
    if (state.neuro.dopamineScore <= 2) {
      const dopa = findByMechanisms('DOPAMINE_PRECURSOR');
      dopa.forEach(id => { if (!ids.includes(id)) { ids.push(id); reasoning[id] = 'Поддержка дофаминового синтеза'; } });
    }
    addRec('neuro', maxNeuro >= 0.6 ? 'critical' : 'high', 'neuro', 'Нервная',
      `Нейротоксичность от ${drugNames.join(', ')}`,
      ids, reasoning,
      `Дофамин ${state.neuro.dopamineScore}/5 → добавлены дофаминергики. Контроль когниции.`,
      'Когнитивные функции, качество сна, агрессия каждую нед');
  }

  // ── Aromatization → E2 control ──
  const e2Val = getV(fp, 'panelSex', 'E2');
  if (maxAro > 0 || state.epicrisis.pastGyno || (e2Val !== null && e2Val > 150)) {
    let ids: string[] = findSupportByMechanisms(['AROMATASE_INHIBITION', 'ESTROGEN_MODULATION']);
    if (ids.length === 0) ids = ['dim', 'indinol'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { reasoning[id] = 'Модуляция эстрогеновых рецепторов'; });
    if (maxAro >= 0.5 || (e2Val !== null && e2Val > 200)) {
      ids.push('anastrozole');
      reasoning['anastrozole'] = 'Ингибитор ароматазы — доза по E2';
    }
    addRec('estradiol', (e2Val !== null && e2Val > 200) ? 'critical' : 'high', 'endocrine', 'Гормоны',
      `Ароматизация${e2Val !== null ? ' (E2: ' + e2Val + ')' : ''} от ${drugNames.join(', ')}${state.epicrisis.pastGyno ? ' · гинекомастия в анамнезе' : ''}`,
      ids, reasoning,
      'E2 > 200: +Анастрозол 1 мг 2×/нед, доза по E2. Контроль E2 каждые 4 нед.',
      'E2, пролактин, ЛГ, ФСГ каждые 4 нед');
  }

  // ── Progestogenic / 19-nor → prolactin control ──
  const prolVal = getV(fp, 'panelSex', 'Prolactin');
  if (maxProg > 0 || has19Nor || (prolVal !== null && prolVal > 25)) {
    let ids: string[] = findSupportByMechanisms(['PROLACTIN_SUPPRESSION', 'DOPAMINE_PRECURSOR']);
    if (ids.length === 0) ids = ['vitex', 'p5p'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { reasoning[id] = 'Снижение пролактина'; });
    if (maxProg >= 0.4 || has19Nor) {
      ids.push('cabergoline');
      reasoning['cabergoline'] = 'D2-агонист — доза и приём по пролактину';
    }
    addRec('prolactin', (prolVal !== null && prolVal > 40) ? 'critical' : 'high', 'endocrine', 'Пролактин',
      `Прогестиновая активность от ${drugNames.filter(n => ['tren','nandrolone','deca','npp','trest'].some(x => n.toLowerCase().includes(x))).join(', ')}${prolVal !== null ? ' (пролактин: ' + prolVal + ')' : ''}`,
      ids, reasoning,
      'Пролактин > 40: +Каберголин 0.25 мг. Контроль пролактина каждые 4 нед.',
      'Пролактин, E2, ЛГ, ФСГ каждые 4 нед');
  }

  // ── hCG auto-assign: any AAS → hCG 500 IU 2×/week, 3 weeks on / 1 week off ──
  if (state.pharma.aas.length > 0 && !state.pharma.hasHCG) {
    const hcgIds = ['hcg'];
    const hcgReasoning: Record<string, string> = { hcg: 'ХГЧ 500 МЕ 2р/нед, схема 3/1 (3 нед приём, 1 нед отдых). Поддержка яичек, профилактика атрофии на курсе ААС' };
    addRec('hcg', 'high', 'endocrine', 'ХГЧ',
      `Курс ААС (${state.pharma.aas.map((a: any) => a.id).join(', ')}) — автоназначение ХГЧ`,
      hcgIds, hcgReasoning,
      'ХГЧ 500 МЕ 2р/нед, схема 3/1. Контроль E2 каждые 4 нед.',
      'E2, тестостерон, ЛГ, ФСГ каждые 4 нед');
  }

  // ── Anastrozole note: always add note when AI not yet present ──
  if (state.pharma.aas.length > 0 && !state.pharma.hasAI) {
    addRec('anastrozole_note', 'medium', 'endocrine', 'Анастрозол',
      'Анастрозол — доза по результатам анализов динамики эстрадиола',
      [], {},
      'Доза И ПРИЁМ по результатам анализов динамики эстрадиола. Контроль E2 каждые 4 нед.',
      'E2 каждые 4 нед');
  }

  // ── Cabergoline note at 19-nor ──
  if (has19Nor && !state.pharma.hasCaber) {
    addRec('cabergoline_note', 'medium', 'endocrine', 'Каберголин',
      'Каберголин — доза и приём по результатам анализов динамики пролактина',
      [], {},
      'Доза И ПРИЁМ по результатам анализов динамики пролактина. Контроль пролактина каждые 4 нед.',
      'Пролактин каждые 4 нед');
  }

  // ── Lipid impact ──
  const ldlVal = getV(fp, 'panelLipid', 'LDL');
  if (maxLipid > 0.2 || state.cardio.ldlElevation !== 'none' || state.goals.lipidCorrection) {
    let ids: string[] = findSupportByMechanisms(['CHOLESTEROL_REDUCTION', 'AMPK_ACTIVATION', 'LIPID_LOWERING', 'EPA_DHA_UP']);
    if (ids.length < 3) ids = ['omega3', 'bergamot', 'vitamin_e', 'berberine', 'coq10'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { const e = getSupportEntry(id); reasoning[id] = e?.description?.slice(0, 80) || 'Липидная поддержка'; });
    if (state.cardio.ldlElevation === 'severe' || (ldlVal !== null && ldlVal > 4.5)) {
      ['red_yeast_rice', 'ezetimibe'].forEach(id => { if (!ids.includes(id)) { ids.push(id); reasoning[id] = 'Ингибитор HMG-CoA / NPC1L1'; } });
    }
    addRec('lipid', state.cardio.ldlElevation === 'severe' ? 'critical' : 'high', 'cardio', 'Липиды',
      `Дислипидемия${ldlVal !== null ? ': ЛПНП ' + ldlVal : ''} от ${drugNames.join(', ')}`,
      ids, reasoning,
      'ЛПНП > 4.5: +Красный рис + Эзетимиб. Контроль АЛТ на красном рисе.',
      'Липидограмма, АЛТ каждые 4 нед');
  }

  // ── BP / Cardiovascular ──
  if (state.cardio.bpStage !== 'normal' || state.cardio.heartRate > 85) {
    let ids: string[] = findSupportByMechanisms(['BP_REDUCTION', 'NO_RELEASE', 'BETA1_BLOCKADE', 'PPAR_GAMMA_ACTIVATION']);
    if (ids.length < 2) ids = ['telmisartan', 'diosmin', 'hesperidin', 'pycnogenol'];
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { const e = getSupportEntry(id); reasoning[id] = e?.description?.slice(0, 80) || 'Поддержка ССС'; });
    if (state.cardio.bpStage === 'hypertension2' || state.cardio.heartRate > 90) {
      ids.push('nebivolol'); reasoning['nebivolol'] = 'β1-блокатор + NO-донор, ↓ ЧСС и АД';
    }
    addRec('bp', state.cardio.bpStage === 'hypertension2' ? 'critical' : 'high', 'cardio', 'ССС',
      `АД: ${state.cardio.bpStage}, ЧСС: ${state.cardio.heartRate}`,
      ids, reasoning,
      'АД > 130/80 через 2 нед: +Небиволол 5 мг. Контроль калия и креатинина.',
      'АД ежедневно, ЧСС, калий, креатинин, ЭКГ каждые 4 нед');
  }

  // ════════════════════════════════════════════════════════════════
  //  PHASE 2: Always-on protocols
  // ════════════════════════════════════════════════════════════════
  if (drugs.length > 0 && state.pharma.phase === 'course') {
    addRec('always_hcg', 'info', 'reproductive', 'HPTA',
      'ХГЧ на курсе: 500 МЕ 2×/нед, 3/1',
      ['hcg'], { hcg: 'Имитация ЛГ, поддержка стероидогенеза, профилактика атрофии яичек. Схема 3/1.' },
      'При E2 > 200: снизить до 250 МЕ. При пропуске >2 нед: возобновить с 250 МЕ.',
      'E2, ЛГ, ФСГ, размер яичек каждые 4 нед');
  }

  // ════════════════════════════════════════════════════════════════
  //  PHASE 3: Labs → query index for each marker
  // ════════════════════════════════════════════════════════════════
  const labRules: { marker: string; panels: (keyof LabSlice)[]; threshold: { higherIsWorse: boolean; value: number }; system: string; label: string }[] = [
    { marker:'ALT', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:40 }, system:'hepatic', label:'Печень' },
    { marker:'AST', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:40 }, system:'hepatic', label:'Печень' },
    { marker:'GGT', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:55 }, system:'hepatic', label:'Печень' },
    { marker:'Bilirubin', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:21 }, system:'hepatic', label:'Печень' },
    { marker:'Creatinine', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:105 }, system:'renal', label:'Почки' },
    { marker:'Urea', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:8 }, system:'renal', label:'Почки' },
    { marker:'Glucose', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:5.6 }, system:'metabolic', label:'Метаболизм' },
    { marker:'Homocysteine', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:15 }, system:'', label:'Метилирование' },
    { marker:'LDL', panels:['panelLipid'], threshold:{ higherIsWorse:true, value:3 }, system:'cardio', label:'Липиды' },
    { marker:'Triglycerides', panels:['panelLipid'], threshold:{ higherIsWorse:true, value:1.7 }, system:'cardio', label:'Липиды' },
    { marker:'HDL', panels:['panelLipid'], threshold:{ higherIsWorse:false, value:1.0 }, system:'cardio', label:'Липиды' },
    { marker:'CRP', panels:['panelBiochem'], threshold:{ higherIsWorse:true, value:5 }, system:'', label:'Воспаление' },
    { marker:'Cortisol', panels:['panelSex'], threshold:{ higherIsWorse:true, value:550 }, system:'neuro', label:'Стресс' },
    { marker:'D-dimer', panels:['panelCoagulation'], threshold:{ higherIsWorse:true, value:0.5 }, system:'hematologic', label:'Гемостаз' },
    { marker:'Fibrinogen', panels:['panelCoagulation'], threshold:{ higherIsWorse:true, value:4 }, system:'hematologic', label:'Гемостаз' },
    { marker:'Ferritin', panels:['panelIron'], threshold:{ higherIsWorse:true, value:300 }, system:'', label:'Железо' },
    { marker:'Vitamin D (25-OH)', panels:['panelVitamin'], threshold:{ higherIsWorse:false, value:30 }, system:'endocrine', label:'Витамины' },
    { marker:'B12', panels:['panelVitamin'], threshold:{ higherIsWorse:false, value:210 }, system:'', label:'Витамины' },
    { marker:'TSH', panels:['panelThyroid'], threshold:{ higherIsWorse:true, value:4.5 }, system:'endocrine', label:'Щитовидная' },
    { marker:'E2', panels:['panelSex'], threshold:{ higherIsWorse:true, value:150 }, system:'endocrine', label:'Гормоны' },
    { marker:'Prolactin', panels:['panelSex'], threshold:{ higherIsWorse:true, value:25 }, system:'endocrine', label:'Гормоны' },
    { marker:'PSA total', panels:['panelTumor'], threshold:{ higherIsWorse:true, value:4 }, system:'', label:'Простата' },
    { marker:'DHEA-S', panels:['panelAdrenal'], threshold:{ higherIsWorse:false, value:100 }, system:'endocrine', label:'Надпочечники' },
  ];

  // Track which markers already have recs from Phase 1 to avoid duplication
  const coveredSystems = new Set(recs.map(r => r.id));

  for (const rule of labRules) {
    const val = rule.panels.reduce((acc, p) => acc ?? getV(fp, p, rule.marker), null as number | null);
    if (val === null) continue;
    const triggered = rule.threshold.higherIsWorse ? val > rule.threshold.value : val < rule.threshold.value;
    if (!triggered) continue;

    // Find support substances from index
    const labMatches = findByLabMarker(rule.marker);
    const ids = labMatches.slice(0, 3).map(m => m.substanceId);
    if (ids.length === 0) continue;

    const recId = 'lab_' + rule.marker;
    if (coveredSystems.has(recId)) continue;
    coveredSystems.add(recId);

    const reasoning: Record<string, string> = {};
    ids.forEach(id => { const m = labMatches.find(x => x.substanceId === id); reasoning[id] = m?.mechanism || 'По результатам анализов'; });

    addRec(recId, 'medium', rule.system, rule.label,
      `${rule.marker}: ${val} ${rule.threshold.higherIsWorse ? '>' : '<'} ${rule.threshold.value}`,
      ids, reasoning,
      `Повторный контроль ${rule.marker} через 2-4 нед. Коррекция дозы по динамике.`,
      `${rule.marker} каждые 2-4 нед`);
  }

  // ════════════════════════════════════════════════════════════════
  //  PHASE 3.5: Special drug classes (insulin, IGF, GLP-1, GH, peptides)
  // ════════════════════════════════════════════════════════════════
  const hasGH = state.pharma.hasGH || state.pharma.aas.some(a => (PHARMA_DB as any)[a.id]?.class === 'peptide_ghrh' || (PHARMA_DB as any)[a.id]?.class === 'peptide_ghrp' || a.id.includes('gh') || a.id.includes('somatropin') || a.id.includes('hgh') || a.id.includes('genotropin') || a.id.includes('mk677') || a.id.includes('ibutamoren'));
  const hasIGF = state.pharma.hasIGF || state.pharma.aas.some(a => (PHARMA_DB as any)[a.id]?.class === 'igf1' || a.id.includes('igf') || a.id.includes('mecasermin'));
  const hasInsulin = state.pharma.hasInsulin || state.pharma.aas.some(a => (PHARMA_DB as any)[a.id]?.class === 'insulin' || a.id.includes('ins'));
  const hasGLP1 = state.pharma.aas.some(a => (PHARMA_DB as any)[a.id]?.class === 'glp1' || a.id.includes('sema') || a.id.includes('tirz'));
  const hasMGF = state.pharma.aas.some(a => (PHARMA_DB as any)[a.id]?.class === 'mgf' || a.id.includes('mgf'));
  const hasPeptideGH = hasGH || hasIGF;

  // ── Insulin → glucose monitoring + electrolyte support ──
  if (hasInsulin) {
    addRec('special_insulin', 'high', 'metabolic', 'Инсулин',
      'Инсулин в курсе: обязательный мониторинг глюкозы, риск гипогликемии',
      ['berberine', 'alpha_lipoic', 'magnesium', 'taurine'],
      { berberine:'AMPK-активатор, ↓ инсулинорезистентность', alpha_lipoic:'↑ чувствительность к инсулину', magnesium:'Электролитный баланс, ↓ риск гипогликемии', taurine:'Глюкозный метаболизм, осморегуляция' },
      'Глюкоза натощак + через 2ч после еды ежедневно. HbA1C каждые 4 нед. Всегда носить источник сахара.',
      'Глюкоза, HbA1C, C-пептид, калий, магний каждые 2-4 нед');
  }

  // ── IGF-1 LR3 / DES → hypoglycemia risk + electrolyte management ──
  if (hasIGF) {
    addRec('special_igf', 'critical', 'metabolic', 'IGF-1',
      'IGF-1: риск гипогликемии, гиперплазия органов. Мониторинг глюкозы + электролитов обязателен.',
      ['taurine', 'magnesium', 'coq10'],
      { taurine:'Осморегуляция, защита миокарда от гипогликемии', magnesium:'Электролит, кардиопротекция', coq10:'Митохондриальная защита при IGF-стимуляции' },
      'Глюкоза 3р/день. Калий, магний, КФК каждые 2 нед. Не превышать 80 мкг/день IGF-1.',
      'Глюкоза, K, Mg, CK, тропонин каждые 2 нед');
  }

  // ── GLP-1 (semaglutide/tirzepatide) → GI support + B12 + hydration ──
  if (hasGLP1) {
    addRec('special_glp1', 'medium', 'metabolic', 'GLP-1',
      'GLP-1 агонист: замедление опорожнения желудка, ↓ аппетит, риск дефицита B12 и электролитов.',
      ['vitamin_b12', 'taurine', 'magnesium', 'probiotic', 'glutamine'],
      { vitamin_b12:'↓ всасывания B12 на GLP-1 → заместительная терапия', taurine:'Осморегуляция, ↓ тошноту', magnesium:'Электролит при ↓ потребления пищи', probiotic:'Микробиом при замедленной моторике', glutamine:'Репарация энтероцитов' },
      'B12 каждые 4 нед. Глюкоза, HbA1C. Пить 2+ л воды. При тошноте: дробное питание.',
      'B12, глюкоза, HbA1C, K, Na каждые 4 нед');
  }

  // ── MGF / PEG-MGF → satellite cell activation ──
  if (hasMGF) {
    addRec('special_mgf', 'low', 'musculoskeletal', 'MGF',
      'MGF: активация сателлитных клеток. Синергия с IGF-1 для гиперплазии.',
      ['collagen_ii', 'vitamin_c'],
      { collagen_ii:'Матрикс для сателлитной интеграции', vitamin_c:'Кофактор синтеза коллагена' },
      'Локальные инъекции, ротация зон. Курс 4-6 нед.',
      'Локальный осмотр, КФК, миоглобин');
  }

  // ── GH peptides → prolactin + cortisol monitoring ──
  if (hasPeptideGH) {
    addRec('special_gh', 'medium', 'endocrine', 'ГР/Пептиды',
      'GH-секретагоги: контроль пролактина, кортизола, IGF-1.',
      ['vitex', 'p5p', 'ashwagandha', 'magnesium_l_threonate'],
      { vitex:'D2-агонист при ↑ пролактина от GHRP', p5p:'Кофактор дофамина', ashwagandha:'↓ кортизол, адаптоген', magnesium_l_threonate:'↓ кортизол, ↑ ГАМК' },
      'GH-пульс тест, пролактин, кортизол, IGF-1 каждые 4 нед. Принимать натощак.',
      'Пролактин, кортизол, IGF-1, ГР каждые 4 нед');
  }

  // ════════════════════════════════════════════════════════════════
  //  PHASE 4: User state → organ/systems → query index
  //  (ALL remaining input fields mapped here)
  // ════════════════════════════════════════════════════════════════
  const stateRecipes: { condition: boolean; id: string; severity: RecSeverity; system: string; label: string; title: string; organs?: string[]; categories?: string[]; mechanisms?: string[]; fallback?: string[]; reasoning?: string; escalation: string; monitoring: string }[] = [
    // ── Hepatobiliary ──
    { condition: state.hepatobiliary.fattyLiver, id:'state_fatty_liver', severity:'medium', system:'hepatic', label:'Печень', title:'Жировой гепатоз', organs:['LIVER'], categories:['hepatoprotector'], fallback:['phosphatidylcholine'], reasoning:'Мембранная защита, ↓ стеатоз', escalation:'УЗИ печени, диета, ↓ углеводы', monitoring:'УЗИ печени 1р/3мес' },
    { condition: state.hepatobiliary.cholecystitis, id:'state_cholecystitis', severity:'medium', system:'hepatic', label:'Печень', title:'Холецистит', mechanisms:['BILE_ACID_MOD'], fallback:['tudca'], reasoning:'Желчеотток', escalation:'Контроль ЩФ, ГГТ', monitoring:'ЩФ, ГГТ, УЗИ' },
    { condition: state.hepatobiliary.alcoholHistory === 'current', id:'state_alcohol', severity:'high', system:'hepatic', label:'Печень', title:'Алкоголь: токсическая нагрузка на печень', mechanisms:['GLUTATHIONE_SYNTHESIS','ANTIOXIDANT'], categories:['hepatoprotector'], fallback:['nac','milk_thistle','alpha_lipoic'], reasoning:'Детоксикация, антиоксидант', escalation:'Исключить алкоголь на курсе. NAC 1200 мг обязательно.', monitoring:'АЛТ, АСТ, ГГТ каждые 2 нед' },

    // ── Renal / Urinary ──
    { condition: state.urinary.proteinuria, id:'state_proteinuria', severity:'high', system:'renal', label:'Почки', title:'Протеинурия', organs:['KIDNEYS'], categories:['renoprotector'], fallback:['astragalus'], reasoning:'Нефропротекция', escalation:'eGFR, альбумин/креатинин каждые 2 нед', monitoring:'eGFR, альбуминурия' },
    { condition: state.urinary.nephrotoxicDrugs, id:'state_nephrotoxic', severity:'high', system:'renal', label:'Почки', title:'Нефротоксичные препараты', organs:['KIDNEYS'], mechanisms:['RENOPROTECTION'], fallback:['astragalus','taurine','cordyceps'], reasoning:'Нефропротекция', escalation:'Креатинин, мочевина, eGFR каждые 2 нед', monitoring:'Креатинин, eGFR, мочевина каждые 2 нед' },
    { condition: state.urinary.urinationPattern !== 'normal', id:'state_urination', severity:'low', system:'renal', label:'Мочевое', title:'Нарушение мочеиспускания', categories:['urinary_protector'], fallback:['d_mannose','taurine'], reasoning:'Поддержка МВП', escalation:'ОАМ, PSA', monitoring:'ОАМ, PSA каждые 4 нед' },

    // ── ODA/Joints (separate button, excluded in applyCoverageLevel) ──
    { condition: state.oda.jointPain !== 'none' || state.oda.ligamentIssues || state.oda.backPain, id:'state_oda', severity: state.oda.jointPain === 'severe' ? 'high' : 'medium', system:'musculoskeletal', label:'ОДА', title:`ОДА: ${state.oda.jointPain !== 'none' ? 'боль ' + state.oda.jointPain : ''}${state.oda.ligamentIssues ? '· связки ' : ''}${state.oda.backPain ? '· спина ' : ''}${state.oda.injuries.length > 0 ? '· травмы' : ''}`, categories:['joint'], fallback:['collagen_ii','vitamin_c','msm','hyaluronic_acid'], reasoning:'Поддержка ОДА', escalation: state.oda.jointPain === 'severe' ? '+Глюкозамин +Хондроитин' : '', monitoring:'Боль VAS, объем движений, функция' },

    // ── Sleep / Cortisol ──
    { condition: state.neuro.sleepQuality === 'poor' || state.profile.sleepHours < 6 || state.profile.stressLevel >= 7 || state.neuro.gabaBalance === 'overexcited', id:'state_sleep', severity: state.profile.sleepHours < 5 ? 'high' : 'medium', system:'neuro', label:'Сон', title:`Сон: ${state.profile.sleepHours}ч · качество: ${state.neuro.sleepQuality} · стресс: ${state.profile.stressLevel}/10`, mechanisms:['GABA_MODULATION', 'CORTISOL_REDUCTION'], categories:['sleep','adaptogen'], fallback:['magnesium_l_threonate','l_theanine','ashwagandha','glycine'], reasoning:'Улучшение сна, ↓ кортизол', escalation: state.profile.stressLevel >= 7 ? '+Фосфатидилсерин 400 мг' : 'При ГАМК-возбуждении: ↑ Mg L-треонат до 3000 мг', monitoring:'Качество сна, кортизол утро/вечер, АКТГ каждые 4 нед' },

    // ── Neuro status (remaining) ──
    { condition: state.neuro.aggressionScore >= 4, id:'state_aggression', severity:'medium', system:'neuro', label:'Нейро', title:`Агрессия: ${state.neuro.aggressionScore}/5`, mechanisms:['GABA_MODULATION','SEROTONIN_PRECURSOR'], fallback:['magnesium_l_threonate','l_theanine','5htp'], reasoning:'↓ агрессия, ↑ ГАМК', escalation:'+Фенибут 250 мг при необходимости', monitoring:'Агрессия, качество сна' },
    { condition: state.neuro.headaches, id:'state_headaches', severity:'low', system:'neuro', label:'Нейро', title:'Головные боли', mechanisms:['GABA_MODULATION','NMDA_BLOCK'], fallback:['magnesium','taurine','coq10'], reasoning:'↓ головные боли', escalation:'Проверить АД, исключить дегидратацию', monitoring:'Частота головных болей, АД' },
    { condition: state.neuro.weatherDependent, id:'state_weather', severity:'low', system:'neuro', label:'Нейро', title:'Метеозависимость', mechanisms:['CORTISOL_REDUCTION','ADAPTOGENIC'], categories:['adaptogen'], fallback:['ashwagandha','ginseng_sup','shilajit'], reasoning:'Адаптоген, ↓ чувствительность к перепадам', escalation:'+Магний 400 мг', monitoring:'Самочувствие, АД' },

    // ── GI / Microbiome ──
    { condition: state.gi.bloating || state.gi.heartburn || state.gi.diarrhea || state.gi.constipation || state.gi.diagnosedIBS, id:'state_gi', severity: state.gi.diagnosedIBS ? 'medium' : 'low', system:'', label:'ЖКТ', title:`${state.gi.bloating?'вздутие ':''}${state.gi.heartburn?'изжога ':''}${state.gi.diarrhea?'диарея ':''}${state.gi.constipation?'запоры ':''}${state.gi.diagnosedIBS?'· СРК ':''}${state.gi.enzymeSupport?'· ферменты ':''}${state.gi.probioticUse?'· пробиотики':''}`, categories:['probiotic','gastrointestinal'], mechanisms:['GUT_BARRIER_INTEGRITY','SHORT_CHAIN_FATTY_ACID_PRODUCTION'], fallback:['probiotic','glutamine'], reasoning:'Восстановление микробиома', escalation: state.gi.diagnosedIBS ? '+Масло мяты 200 мг' : state.gi.enzymeSupport ? '+Панкреатин 10000 ЕД' : '', monitoring:'Стул (Бристоль), вес, альбумин, преальбумин' },

    // ── Genetics ──
    { condition: state.genetics.mthfr === 'c677t', id:'genetics_mthfr', severity:'medium', system:'', label:'Генетика', title:'MTHFR C677T: нарушение метилирования', mechanisms:['METHYLATION', 'HOMOCYSTEINE_LOWERING'], categories:['methylation'], fallback:['methylfolate','methylcobalamin','tmg'], reasoning:'Поддержка метилирования', escalation:'Гомоцистеин > 15: +ТМГ 1 г', monitoring:'Гомоцистеин, B12, фолат каждые 4 нед' },
    { condition: state.genetics.srd5a2 === 'hypersensitive', id:'genetics_srd5a2', severity:'medium', system:'', label:'Генетика', title:'SRD5A2 гиперчувствительность', mechanisms:['5AR_INHIBITION'], fallback:['saw_palmetto','zinc_sup'], reasoning:'Ингибиция 5AR', escalation:'+Дутастерид (под контролем)', monitoring:'ДГТ, PSA, 3a-ADG, волосы/кожа' },
    { condition: state.genetics.cyp19a1 === 'high', id:'genetics_cyp19', severity:'medium', system:'endocrine', label:'Генетика', title:'CYP19A1 высокая активность: риск ↑ E2', mechanisms:['AROMATASE_INHIBITION'], categories:['hormonal'], fallback:['dim','indinol','zinc_sup'], reasoning:'Контроль ароматазы', escalation:'+Анастрозол 1 мг 2×/нед при E2 > 150', monitoring:'E2, пролактин каждые 4 нед' },

    // ── Psych ──
    { condition: state.psych.mirrorObsession >= 4 || state.psych.fearOfLoss >= 4 || state.psych.apathyOffCycle >= 4, id:'psych', severity:'medium', system:'neuro', label:'Психология', title:`${state.psych.mirrorObsession>=4?'· зеркало ':''}${state.psych.fearOfLoss>=4?'· страх ':''}${state.psych.apathyOffCycle>=4?'· апатия':''}`, categories:['anxiolytic','antidepressant'], mechanisms:['SEROTONIN_PRECURSOR','DOPAMINE_PRECURSOR'], fallback:['l_tryptophan','ashwagandha','l_tyrosine'], reasoning:'Психологическая поддержка', escalation:'Нет эффекта 4 нед → психотерапевт', monitoring:'PHQ-9, GAD-7 каждые 2 нед' },

    // ── Dental / Mineral ──
    { condition: state.dental.bleedingGums || state.dental.looseTeeth, id:'state_dental', severity:'medium', system:'', label:'Стоматология', title:`${state.dental.bleedingGums?'кровоточивость дёсен ':''}${state.dental.looseTeeth?'шатаются зубы ':''}`, mechanisms:['COLLAGEN_SYNTHESIS','BONE_MINERALIZATION','VDR_AGONISM'], fallback:['vitamin_c','vitamin_d3','vitamin_k2','collagen_ii'], reasoning:'Коллаген, минерализация', escalation:'Консультация стоматолога, исключить дефицит Vit C и D', monitoring:'Vit D, Ca, P, PTH' },
    { condition: state.dental.boneFractures || state.dental.cramps, id:'state_bone', severity:'medium', system:'musculoskeletal', label:'Кости', title:`${state.dental.boneFractures?'переломы ':''}${state.dental.cramps?'судороги ':''}`, mechanisms:['BONE_MINERALIZATION','CALCIUM_REGULATION','ELECTROLYTE_BALANCE'], fallback:['vitamin_d3','vitamin_k2','magnesium','calcium_supplement'], reasoning:'Минеральная плотность, электролиты', escalation:'Денситометрия, Ca, P, PTH, Mg каждые 8 нед', monitoring:'Ca, P, Mg, Vit D, PTH каждые 4-8 нед' },
    { condition: state.dental.nightGrinding, id:'state_grinding', severity:'low', system:'neuro', label:'Бруксизм', title:'Ночной бруксизм (скрежет зубами)', mechanisms:['GABA_MODULATION','MAGNESIUM_THERAPY'], fallback:['magnesium','magnesium_l_threonate','glycine'], reasoning:'↓ тонус жевательных мышц, ↑ ГАМК', escalation:'+Баклофен (под контролем невролога)', monitoring:'Износ зубов, качество сна' },

    // ── Injection zones ──
    { condition: !!((state.injection.glutes && state.injection.glutes !== 'ok' && state.injection.glutes !== '') || (state.injection.quads && state.injection.quads !== 'ok' && state.injection.quads !== '') || (state.injection.delts && state.injection.delts !== 'ok' && state.injection.delts !== '')), id:'state_injection', severity:'low', system:'', label:'Инъекции', title:`${state.injection.glutes && state.injection.glutes !== 'ok' ? 'ягодицы: ' + state.injection.glutes + ' ' : ''}${state.injection.quads && state.injection.quads !== 'ok' ? 'квадрицепсы: ' + state.injection.quads + ' ' : ''}${state.injection.delts && state.injection.delts !== 'ok' ? 'дельты: ' + state.injection.delts + ' ' : ''}`, mechanisms:['ANTIINFLAMMATORY','TISSUE_REPAIR'], categories:['antiinflammatory'], fallback:['bromelain','curcumin_sup'], reasoning:'↓ воспаление в зоне инъекций', escalation:'Ротация зон каждые 3 дня. Тонкая игла 25-27G. Теплый компресс.', monitoring:'Визуальный осмотр, температура, пальпация' },

    // ── Toxic load ──
    { condition: state.toxicLoad.bowelFrequency !== 'regular', id:'state_bowel', severity:'low', system:'', label:'ЖКТ', title:'Нарушение стула', categories:['probiotic','gastrointestinal'], fallback:['probiotic','glutamine','psyllium'], reasoning:'Регуляция стула', escalation: state.toxicLoad.bowelFrequency === 'constipation' ? '+Магний цитрат 200 мг' : '+Пробиотик', monitoring:'Бристольская шкала, частота' },

    // ── Contraindications (all) ──
    { condition: state.contraindications.hasThrombophilia, id:'safety_thrombophilia', severity:'critical', system:'hematologic', label:'Противопоказания', title:'Тромбофилия: усилить фибринолиз, HCT < 45%', mechanisms:['PLATELET_AGGREGATION_INHIBITION','ANTICOAGULANT'], fallback:['serrapeptase','nattokinase'], reasoning:'Профилактика тромбозов', escalation:'D-димер > 500 → LMWH. Гидратация 3+ л/день.', monitoring:'HCT, D-димер, фибриноген, тромбоциты каждые 2 нед' },
    { condition: state.contraindications.hasCVD || state.cardio.previousCVD, id:'safety_cvd', severity:'critical', system:'cardio', label:'Противопоказания', title:'ССЗ в анамнезе: исключить стимуляторы, усилить кардиомониторинг', mechanisms:['BP_REDUCTION','NO_RELEASE','COENZYME_ELECTRON_TRANSPORT'], categories:['cardioprotector'], fallback:['telmisartan','coq10','omega3','magnesium'], reasoning:'Кардиопротекция', escalation:'ЭКГ + ЭхоКГ каждые 4 нед. АД ежедневно.', monitoring:'АД ежедневно, ЧСС, ЭКГ, тропонин каждые 2-4 нед' },
    { condition: state.contraindications.hasGI, id:'safety_gi', severity:'medium', system:'', label:'Противопоказания', title:'ЖКТ заболевания: исключить берберин высокие дозы, НПВС', mechanisms:['GUT_BARRIER_INTEGRITY','ANTIINFLAMMATORY'], categories:['probiotic','gastrointestinal'], fallback:['probiotic','glutamine','curcumin_sup'], reasoning:'Защита слизистой', escalation:'Гастроскопия, исключить НПВС', monitoring:'Альбумин, преальбумин, стул' },
    { condition: state.contraindications.hasDiabetes || state.urinary.diabetes, id:'safety_diabetes', severity:'high', system:'metabolic', label:'Противопоказания', title:'Диабет: гликемический контроль обязателен', mechanisms:['AMPK_ACTIVATION','INSULIN_SENSITIVITY','GLUCOSE_METABOLISM'], categories:['metabolic'], fallback:['berberine','alpha_lipoic','chromium','taurine'], reasoning:'Гликемический контроль', escalation:'HbA1C > 7% → эндокринолог. Глюкоза ежедневно.', monitoring:'Глюкоза, HbA1C, инсулин, HOMA-IR каждые 4 нед' },
    { condition: state.contraindications.hasEpilepsy, id:'safety_epilepsy', severity:'critical', system:'neuro', label:'Противопоказания', title:'Эпилепсия: исключить стимуляторы, контроль кетогенной диеты', mechanisms:['GABA_MODULATION','NMDA_BLOCK'], categories:['neuroprotector'], fallback:['magnesium','taurine','l_theanine'], reasoning:'↑ ГАМК, ↓ возбудимость', escalation:'Консультация невролога перед курсом. Исключить все стимуляторы.', monitoring:'ЭЭГ, частота приступов' },
    { condition: state.contraindications.hasMentalIllness, id:'safety_mental', severity:'critical', system:'neuro', label:'Противопоказания', title:'Психические расстройства: исключить нейротоксичные ААС, стимуляторы', mechanisms:['SEROTONIN_PRECURSOR','GABA_MODULATION'], categories:['anxiolytic','adaptogen'], fallback:['ashwagandha','l_theanine','magnesium_l_threonate'], reasoning:'Стабилизация настроения', escalation:'Психиатр. Исключить тренболон, высокие дозы ААС.', monitoring:'PHQ-9, GAD-7, качество сна' },
    { condition: state.contraindications.hasProstateIssues, id:'safety_prostate', severity:'medium', system:'reproductive', label:'Противопоказания', title:'Простата: контроль PSA, ДГТ', mechanisms:['5AR_INHIBITION','DHT_REDUCTION'], categories:['hormonal'], fallback:['saw_palmetto','zinc_sup'], reasoning:'Поддержка простаты', escalation:'PSA, ДГТ, DRE каждые 4 нед', monitoring:'PSA, ДГТ, 3a-ADG каждые 4 нед' },

    // ── Epicrisis (pharma history) ──
    { condition: state.epicrisis.pastGyno, id:'epicrisis_gyno', severity:'medium', system:'endocrine', label:'Анамнез', title:'Гинекомастия в прошлом: контроль E2', mechanisms:['AROMATASE_INHIBITION','ESTROGEN_MODULATION'], categories:['hormonal'], fallback:['dim','indinol','zinc_sup'], reasoning:'Профилактика рецидива гинекомастии', escalation:'При первых признаках: тамоксифен 20 мг/день', monitoring:'E2, осмотр сосков еженедельно' },
    { condition: state.epicrisis.pastLibidoDrop, id:'epicrisis_libido', severity:'low', system:'endocrine', label:'Анамнез', title:'Падение либидо в прошлом', mechanisms:['TESTOSTERONE_SUPPORT','DOPAMINE_PRECURSOR','SHBG_REGULATION'], fallback:['boron','tongkat_ali','zinc_sup','l_tyrosine'], reasoning:'Поддержка либидо', escalation:'+Провирон 25 мг/день при SHBG > 50', monitoring:'Общий T, свободный T, SHBG, пролактин' },
    { condition: state.epicrisis.pastHctSpike, id:'epicrisis_hct', severity:'high', system:'hematologic', label:'Анамнез', title:'Скачок HCT в прошлом: усиленный контроль', mechanisms:['PLATELET_AGGREGATION_INHIBITION','FIBRINOLYSIS'], categories:['anticoagulant'], fallback:['serrapeptase','nattokinase','aspirin'], reasoning:'Профилактика рецидива HCT↑', escalation:'Гидратация 3+ л/день. Донорство при HCT > 54.', monitoring:'HCT, Hb, D-димер каждые 2 нед' },
    { condition: state.epicrisis.pastLiverIssues, id:'epicrisis_liver', severity:'high', system:'hepatic', label:'Анамнез', title:'Проблемы с печенью в прошлом', mechanisms:['GLUTATHIONE_SYNTHESIS','ANTIOXIDANT','BILE_ACID_MOD'], categories:['hepatoprotector'], fallback:['nac','tudca','milk_thistle','alpha_lipoic'], reasoning:'Гепатопротекция', escalation:'Исключить оральные ААС. АЛТ/АСТ каждые 2 нед.', monitoring:'АЛТ, АСТ, ГГТ, билирубин каждые 2 нед' },
    { condition: state.epicrisis.pastKidneyIssues, id:'epicrisis_kidney', severity:'high', system:'renal', label:'Анамнез', title:'Проблемы с почками в прошлом', mechanisms:['RENOPROTECTION','OSMOREGULATION'], categories:['renoprotector'], fallback:['astragalus','taurine','cordyceps'], reasoning:'Нефропротекция', escalation:'Креатинин, eGFR каждые 2 нед. Гидратация.', monitoring:'Креатинин, eGFR, мочевина, альбумин каждые 2 нед' },

    // ── Goals ──
    { condition: state.goals.bloodThinning, id:'goal_blood', severity:'low', system:'hematologic', label:'Цели', title:'Разжижение крови', mechanisms:['PLATELET_AGGREGATION_INHIBITION','FIBRINOLYSIS'], fallback:['aspirin','omega3','nattokinase','serrapeptase'], reasoning:'Антикоагуляция', escalation:'Контроль HCT, D-димера. Гидратация.', monitoring:'HCT, D-димер, фибриноген' },
    { condition: state.goals.liverDetox, id:'goal_liver', severity:'low', system:'hepatic', label:'Цели', title:'Детокс печени', mechanisms:['GLUTATHIONE_SYNTHESIS','BILE_ACID_MOD','LIVER_REGENERATION'], categories:['hepatoprotector'], fallback:['nac','tudca','milk_thistle','alpha_lipoic'], reasoning:'Детоксикация', escalation:'АЛТ, АСТ, ГГТ каждые 4 нед', monitoring:'АЛТ, АСТ, ГГТ, билирубин' },
    { condition: state.goals.bpControl, id:'goal_bp', severity:'low', system:'cardio', label:'Цели', title:'Контроль АД', mechanisms:['BP_REDUCTION','NO_RELEASE','BETA1_BLOCKADE'], fallback:['telmisartan','diosmin','hesperidin','pycnogenol'], reasoning:'↓ АД', escalation:'+Небиволол 5 мг при ЧСС > 85', monitoring:'АД ежедневно, ЧСС, калий, креатинин' },

    // ── Training ──
    { condition: state.goals.trainingCycle === 'mass' && (state.profile.workoutsPerWeek >= 4 || state.profile.avgWorkoutMinutes > 75), id:'training_high', severity:'low', system:'musculoskeletal', label:'Тренировки', title:`Высокий объём тренировок: ${state.profile.workoutsPerWeek}×/нед по ${state.profile.avgWorkoutMinutes} мин`, mechanisms:['MITOCHONDRIAL_ENERGY','PROTEIN_SYNTHESIS','MUSCLE_PROTEIN_SYNTHESIS'], categories:['amino','mitochondrial'], fallback:['bcaa','creatine','beta_alanine','citrulline'], reasoning:'Поддержка восстановления', escalation:'+HMB 3 г при объёме > 420 мин/нед', monitoring:'КФК, усталость, качество восстановления' },
    { condition: state.profile.workoutsPerWeek <= 2 || state.profile.avgWorkoutMinutes < 30, id:'training_low', severity:'info', system:'', label:'Тренировки', title:`Низкая активность: ${state.profile.workoutsPerWeek}×/нед`, mechanisms:['MITOCHONDRIAL_ENERGY','CIRCULATION_ENHANCEMENT'], fallback:['citrulline','taurine','shilajit'], reasoning:'Повышение энергии и кровотока', escalation:'Увеличить активность до 3×/нед', monitoring:'Вес, состав тела, АД' },

    // ── Nutrition ──
    { condition: state.nutrition.omega3 === false && maxLipid > 0, id:'nutrition_omega3', severity:'low', system:'cardio', label:'Питание', title:'Омега-3 не принимается → добавить', mechanisms:['EPA_DHA_UP','ANTIINFLAMMATORY'], categories:['fatty_acid'], fallback:['omega3'], reasoning:'Липидная поддержка', escalation:'EPA+DHA минимум 2000 мг/день', monitoring:'Липидограмма' },
    { condition: (state.nutrition.fiberG || 0) < 20, id:'nutrition_fiber', severity:'low', system:'', label:'Питание', title:`Клетчатка ${state.nutrition.fiberG} г/день (< 20 г)`, mechanisms:['GUT_BARRIER_INTEGRITY','SHORT_CHAIN_FATTY_ACID_PRODUCTION','BINDING_TOXINS'], categories:['gastrointestinal'], fallback:['psyllium','glutamine','probiotic'], reasoning:'Поддержка ЖКТ, связывание токсинов', escalation:'↑ овощи, клетчатка до 30 г/день', monitoring:'Стул, альбумин, липиды' },
    { condition: (state.nutrition.waterL || 0) < 2, id:'nutrition_water', severity:'low', system:'renal', label:'Питание', title:`Гидратация ${state.nutrition.waterL} л/день (< 2 л)`, mechanisms:['OSMOREGULATION','RENOPROTECTION'], fallback:['taurine'], reasoning:'Улучшение гидратации', escalation:'Пить 3+ л/день, особенно на ААС', monitoring:'HCT, креатинин, мочевина' },
    { condition: state.nutrition.saltIntake === 'high' && (state.cardio.bpStage !== 'normal' || state.cardio.heartRate > 85), id:'nutrition_salt', severity:'low', system:'cardio', label:'Питание', title:'Избыток соли при склонности к ↑ АД', mechanisms:['BP_REDUCTION','OSMOREGULATION'], fallback:['telmisartan','taurine'], reasoning:'Контроль АД и натрия', escalation:'↓ соль до 3-5 г/день', monitoring:'АД, Na, K' },
    { condition: (state.nutrition.proteinG || 0) < 1.6 * (state.profile.weight || 80), id:'nutrition_protein', severity:'low', system:'musculoskeletal', label:'Питание', title:`Белок ${state.nutrition.proteinG} г (< ${Math.round(1.6 * (state.profile.weight || 80))} г)`, mechanisms:['PROTEIN_SYNTHESIS','MUSCLE_PROTEIN_SYNTHESIS'], categories:['amino'], fallback:['bcaa','glutamine','eaa'], reasoning:'Восполнение белка для анаболизма', escalation:'↑ до 2 г/кг массы тела', monitoring:'Азотистый баланс, альбумин' },
  ];

  for (const sr of stateRecipes) {
    if (!sr.condition) continue;
    if (coveredSystems.has(sr.id)) continue;
    coveredSystems.add(sr.id);

    let ids: string[] = [];
    if (sr.mechanisms) ids = findSupportByMechanisms(sr.mechanisms, 4);
    if (ids.length < 2 && sr.categories) ids = findSupportByCategoryAndMech(sr.categories[0], ...(sr.mechanisms || [''])).slice(0, 4);
    if (ids.length < 2 && sr.fallback) ids = sr.fallback;
    const reasoning: Record<string, string> = {};
    ids.forEach(id => { reasoning[id] = getSupportEntry(id)?.description?.slice(0, 100) || sr.reasoning || 'Поддержка'; });
    addRec(sr.id, sr.severity, sr.system, sr.label, sr.title, ids, reasoning, sr.escalation, sr.monitoring);
  }

  // ── Base antioxidant + mineral support (always, if not already covered) ──
  if (!coveredSystems.has('base_antioxidant')) {
    coveredSystems.add('base_antioxidant');
    const baseIds: string[] = [];
    const hasNac = recs.some(r => r.substances.some(s => s.id === 'nac'));
    if (!hasNac) baseIds.push('nac');
    baseIds.push('vitamin_d3', 'vitamin_k2', 'zinc_sup');
    if (state.toxicLoad.hazardousWork || state.toxicLoad.otherHeavyDrugs) baseIds.push('glutathione');
    const reasoning: Record<string, string> = {};
    baseIds.forEach(id => { const e = getSupportEntry(id); reasoning[id] = e?.description?.slice(0, 100) || 'Базовая поддержка'; });
    addRec('base_antioxidant', 'info', '', 'Базовая защита',
      `Базовая поддержка: ${drugs.length > 0 ? 'курс ' + state.goals.cycleWeeks + ' нед' : ''}${state.toxicLoad.hazardousWork ? ', токсическая нагрузка' : ''}`,
      baseIds, reasoning,
      state.toxicLoad.hazardousWork ? 'Токсическая нагрузка: +Глутатион' : '',
      '25(OH)D, Mg, Zn каждые 8-12 нед');
  }

  return recs;
}

// ─── Budget-aware filtering + synergy ranking ───
export function applyCoverageLevel(recs: Recommendation[], level: string, jointExclude: boolean = true): { recs: Recommendation[]; synergyScore: number; allIds: string[] } {
  const result: Recommendation[] = [];
  const allIds: string[] = [];

  for (const rec of recs) {
    // Skip ODA/joint when not in joint mode + week change info
    if (jointExclude && (rec.id === 'oda' || rec.system === 'musculoskeletal')) continue;
    if (rec.id === '__week_change') continue;

    const allowed = filterByCoverageLevel(rec.substances.map(s => s.id), level);
    if (allowed.length === 0) continue;

    // Sort by synergy with already-selected substances
    const scored = allowed.map(id => {
      let synScore = 0;
      for (const existing of allIds) synScore += getSynergyScore(id, existing);
      let conScore = 0;
      for (const existing of allIds) conScore += getConflictScore(id, existing);
      return { id, netScore: synScore - conScore };
    });
    scored.sort((a, b) => b.netScore - a.netScore);
    const sortedIds = scored.map(s => s.id);

    // Conflict resolution: try time separation across all 5 slots
    // morning / afternoon / evening / night / fasting → any orthogonal pair = OK
    let conflictWarnings: string[] = [];
    const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night', 'fasting'];
    const keep: string[] = [];
    for (const id of sortedIds) {
      const conflictsWith = allIds.filter(existing => getConflictScore(id, existing) > 0.5);
      if (conflictsWith.length > 0) {
        const entryA = getSupportEntry(id);
        const timeA = (entryA as any)?.dosage?.timing || (entryA as any)?.timing || '';
        // Assign default slot if none specified
        const slotA = TIME_SLOTS.find(s => timeA.toLowerCase().includes(s)) || TIME_SLOTS[0];
        const canSeparateAll = conflictsWith.every(conflictId => {
          const entryB = getSupportEntry(conflictId);
          const timeB = (entryB as any)?.dosage?.timing || (entryB as any)?.timing || '';
          const slotB = TIME_SLOTS.find(s => timeB.toLowerCase().includes(s)) || TIME_SLOTS[TIME_SLOTS.length - 1];
          return slotA !== slotB;
        });
        if (canSeparateAll) {
          keep.push(id);
          // Track time separation for the plan output
          const sepMsg = conflictsWith.map(cid => {
            const en = getSupportEntry(cid);
            const tn = (en as any)?.dosage?.timing || '';
            return `${getSupportEntry(id)?.name || id} (${slotA}) ↔ ${en?.name || cid} (${TIME_SLOTS.find(s => tn.toLowerCase().includes(s)) || 'вечер'}) — разнесены по времени`;
          }).join('; ');
          conflictWarnings.push(sepMsg);
        } else {
          // Cannot separate → exclude, warn user
          conflictWarnings.push(`⚠ Исключён ${getSupportEntry(id)?.name || id}: конфликт с ${conflictsWith.map(c => getSupportEntry(c)?.name || c).join(', ')} — невозможно разнести по времени`);
        }
      } else {
        keep.push(id);
      }
    }

    // Keep best synergy combination up to 3 substances per rec
    const finalIds = keep.slice(0, 3);
    finalIds.forEach(id => { if (!allIds.includes(id)) allIds.push(id); });

    const substances = finalIds.map(id => rec.substances.find(s => s.id === id)!).filter(Boolean);
    if (substances.length > 0) {
      result.push({ ...rec, substances });
    }
  }

  const synergyScore = scoreCombination(allIds);
  return { recs: result, synergyScore, allIds };
}

// ─── Estimate risk after coverage level ───
export function computeCoverageRisk(recs: Recommendation[], level: string, state: CalculatorState, result: CalculatorResult): CoverageResult {
  const { recs: filtered, synergyScore, allIds } = applyCoverageLevel(recs, level);
  const totalSubs = allIds.length;

  // Estimate risk reduction: each substance reduces risk proportionally
  const baseBefore = result.overallRiskBefore;
  // Coverage per system from filtered recs
  const coverage: Record<string, number> = {};
  const systemSet = new Set(filtered.map(r => r.system).filter(Boolean));
  for (const sys of systemSet) {
    const sysRecs = filtered.filter(r => r.system === sys);
    let cov = 0;
    for (const r of sysRecs) cov += r.substances.length * 8; // ~8% per substance
    coverage[sys] = Math.min(80, cov);
  }
  // Average coverage across affected systems
  const avgCov = Object.values(coverage).length > 0 ? Object.values(coverage).reduce((a, b) => a + b, 0) / Object.values(coverage).length : 0;
  const riskAfter = Math.max(5, baseBefore - avgCov);

  const coverageLevels = ['basic', 'mid', 'max', 'boost'];
  const currentIdx = coverageLevels.indexOf(level);
  const warning = riskAfter > 50 && currentIdx < 3
    ? `⚠️ Текущий уровень «${level}» не обеспечивает достаточного снижения рисков (${Math.round(riskAfter)}%). Рекомендуется уровень «${coverageLevels[currentIdx + 1]}».`
    : null;

  return { level, riskBefore: Math.round(baseBefore), riskAfter: Math.round(riskAfter), coverage, avgCoverage: Math.round(avgCov), warning, substanceCount: totalSubs, synergyScore: Math.round(synergyScore * 100) };
}

// ─── Boost: усилить выбранный уровень элитными препаратами ───
export function applyBoost(recs: Recommendation[], level: string): { recs: Recommendation[]; addedSubstances: string[]; riskReduction: number; message: string } {
  const { recs: filtered } = applyCoverageLevel(recs, level);
  const allIds = new Set<string>();
  filtered.forEach(r => r.substances.forEach(s => allIds.add(s.id)));

  // Get boost substances — elite forms with HIGH synergy
  const boostIds = getBoostSubstances(Array.from(allIds), 8);
  if (boostIds.length === 0) {
    return { recs: filtered, addedSubstances: [], riskReduction: 0, message: 'Нет доступных элитных препаратов для усиления. Выберите уровень Максимум.' };
  }

  // Add boost substances to the most relevant recommendations
  const boostSubstances = boostIds.map(id => {
    const entry = getSupportEntry(id);
    return { id, name: entry?.name || id, dose: (entry as any)?.dosage?.timingDosage || (entry as any)?.dosage?.dose || '—', reasoning: `Усиление: элитная форма, максимальная биодоступность`, tier: getEntryTier(id) };
  });

  // Append to existing recs
  const boosted = filtered.map(r => ({ ...r }));
  if (boosted.length > 0) {
    // Find the best rec to add boost substances to (by severity)
    const criticalRec = boosted.find(r => r.severity === 'critical');
    const target = criticalRec || boosted[0];
    target.substances = [...target.substances, ...boostSubstances.filter(s => !target.substances.some(ts => ts.id === s.id))];
  }

  // Estimate additional risk reduction (elite forms = better coverage)
  const extraReduction = Math.min(25, boostIds.length * 3);
  const riskReduction = extraReduction;

  // Build synergy scores for reporting
  let totalSyn = 0;
  for (const a of allIds) for (const b of boostIds) totalSyn += getSynergyScore(a, b);

  const message = [
    `⚡ Усиление: +${boostIds.length} элитных препаратов`,
    `+${totalSyn.toFixed(1)} очков синергии`,
    `Доп. снижение риска ≈ ${riskReduction}%`,
  ].join(' · ');

  return {
    recs: boosted,
    addedSubstances: boostIds,
    riskReduction,
    message,
  };
}

// ─── Risk detail builder: per-recommendation risk analysis ───
function buildRiskDetail(rec: Recommendation, state?: CalculatorState): string | undefined {
  const systemLabels: Record<string, string> = {
    hepatic: 'Печень', cardio: 'ССС', renal: 'Почки', neuro: 'Нейротоксичность',
    endocrine: 'Эндокринная', hematologic: 'Кровь', metabolic: 'Метаболизм',
    reproductive: 'Репродуктивная', musculoskeletal: 'ОДА', immune: 'Иммунитет',
  };

  const sysLabel = systemLabels[rec.system] || rec.systemLabel || rec.system;
  const severityLabel = { critical: '🔴 Критический', high: '🟠 Высокий', medium: '🟡 Средний', low: '🟢 Низкий', info: 'ℹ️ Информация' }[rec.severity] || rec.severity;

  // Try to extract lab values from the recommendation title
  const labMatch = rec.title.match(/\([^)]*:\s*([\d.]+)[^)]*\)/);
  const labValue = labMatch ? labMatch[1] : null;

  if (labValue) {
    return `${severityLabel} риск · система: ${sysLabel} · значение: ${labValue}`;
  }

  // Check for specific known patterns
  if (rec.title.includes('Ароматизация')) return `${severityLabel} риск · ${sysLabel} · ароматизация ААС → E2↑`;
  if (rec.title.includes('Прогестиновая')) return `${severityLabel} риск · ${sysLabel} · 19-нор → пролактин↑`;
  if (rec.title.includes('Липид') || rec.title.includes('ЛПНП')) return `${severityLabel} риск · ${sysLabel} · дислипидемия от ААС`;
  if (rec.title.includes('Нейро') || rec.title.includes('нейротокс')) return `${severityLabel} риск · ${sysLabel} · нейротоксичность препаратов`;
  if (rec.title.includes('Давление') || rec.title.includes('АД')) return `${severityLabel} риск · ${sysLabel} · гипертензия`;
  if (rec.title.includes('Печень') || rec.title.includes('гепато')) return `${severityLabel} риск · ${sysLabel} · гепатотоксичность оральных ААС`;
  if (rec.title.includes('Почк') || rec.title.includes('ренал')) return `${severityLabel} риск · ${sysLabel} · нефротоксичность`;
  if (rec.title.includes('Курс ААС') && rec.id === 'hcg') return `🟡 Плановый · ${sysLabel} · автоназначение при ААС`;

  return `${severityLabel} риск · система: ${sysLabel}`;
}

// ─── Pre-apply card: logic summary before plan output ───
export interface PreApplyLine {
  problem: string;          // e.g. "Гематокрит 53%"
  primarySubs: string[];    // e.g. ["Серрапептаза", "Наттокиназа"]
  escalation: string;       // e.g. "Если не изменится → +Нарингин +Люмброкиназа"
  monitoring: string;       // e.g. "Контроль HCT каждые 4 нед"
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  riskDetail?: string;      // e.g. "Риск тромбоза: HCT 53% (норма <48%)"
  riskCoverage?: string;    // e.g. "Покрытие: Серрапептаза 35%↓ + Наттокиназа 25%↓ = риск ↓ до среднего"
}

export function buildPreApplyCard(recs: Recommendation[], state?: CalculatorState): { lines: PreApplyLine[]; summary: string } {
  const lines: PreApplyLine[] = [];

  for (const rec of recs) {
    if (rec.id === '__week_change' || rec.id.startsWith('anastrozole_note') || rec.id.startsWith('cabergoline_note')) continue;
    const subNames = rec.substances.map(s => s.name).filter(Boolean);
    if (subNames.length === 0 && !rec.escalation) continue;

    lines.push({
      problem: rec.title,
      primarySubs: subNames.length > 0 ? subNames : [rec.escalation || '—'],
      escalation: subNames.length > 0 ? rec.escalation || (subNames.length > 0 ? 'При неэффективности — усиление дозы или замена' : '') : '',
      monitoring: rec.monitoring || 'Контроль анализов каждые 4 нед',
      severity: rec.severity,
      riskDetail: buildRiskDetail(rec, state),
      riskCoverage: subNames.length > 0 ? `Покрытие: ${subNames.slice(0, 3).join(' + ')} → снижение риска по системе ${rec.systemLabel || rec.system}` : '',
    });
  }

  // Sort: critical first, then high, medium, info
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  lines.sort((a, b) => (order[a.severity] || 5) - (order[b.severity] || 5));

  const criticalCount = lines.filter(l => l.severity === 'critical').length;
  const highCount = lines.filter(l => l.severity === 'high').length;
  const summary = `Обнаружено ${criticalCount} критических и ${highCount} высоких рисков. Всего ${lines.length} рекомендаций.`;

  return { lines, summary };
}
