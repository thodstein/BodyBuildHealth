import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import { ALL_SUBSTANCES, ALL_INTERACTIONS } from '../data/support-database';
import { SUPPORT_SUBSTANCE_MAP } from '../data/support-substances';
import { getSubstanceTier } from '../data/support-database';
import { SUBSTANCE_ANALOGS, SUPPLEMENT_COMPOSITION, COMPONENT_TO_COMPLEX } from '../data/support-meta';

export type GoalType =
  | 'sleep' | 'energy' | 'concentration' | 'muscle_gain' | 'fat_loss'
  | 'endurance' | 'recovery' | 'immunity' | 'liver_health' | 'cardio_health'
  | 'joints' | 'skin' | 'hair' | 'hormones' | 'stress' | 'longevity'
  | 'detox' | 'libido' | 'mood' | 'brain' | 'digestion' | 'kidney';

export type ReplacementType =
  | 'direct_analog' | 'functional' | 'safer' | 'stronger' | 'cheaper'
  | 'stack_to_single' | 'single_to_stack';

export type HealthCondition = 'liver' | 'kidney' | 'heart' | 'thyroid' | 'stomach' | 'pressure_high' | 'pressure_low' | 'diabetes' | 'autoimmune';

export type AASStatus = 'none' | 'trt' | 'course' | 'pct' | 'bridge' | 'fertility';

export type BudgetLevel = 'economy' | 'medium' | 'premium';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface FinderProfile {
  age: number;
  weight: number;
  height: number;
  sex: 'male' | 'female';
  experience: ExperienceLevel;
  goals: GoalType[];
  aasStatus: AASStatus;
  healthConditions: HealthCondition[];
  budget: BudgetLevel;
  avoidIds: string[];
  maxStackSize: number;
}

export interface FinderQuery {
  goal?: GoalType;
  organs?: string[];
  mechanisms?: string[];
  categories?: string[];
  searchText?: string;
  excludeIds?: string[];
  maxResults?: number;
  tierFilter?: string;
  profile?: FinderProfile;
}

export interface FinderMatch {
  id: string;
  name: string;
  relevanceScore: number;
  matchReasons: string[];
  tier: string;
  categories: string[];
  organs: string[];
  mechanisms: string[];
  targetOrgan: string;
  mechanismOfAction: string;
  clinicalEffect: string;
  bestForm: string;
  bestForCourse: boolean;
  conflictCount: number;
  synergyCount: number;
  formCount: number;
  personalScore: number;
  personalNotes: string[];
  estimatedDose: string;
  contraindicationWarnings: string[];
  priceEstimate: 'low' | 'medium' | 'high';
}

export interface ReplacementResult {
  originalId: string;
  replacementId: string;
  replacementName: string;
  type: ReplacementType;
  reason: string;
  explanation: string;
  tierLabel: string;
  tierChange: 'upgrade' | 'downgrade' | 'same';
  safetyNote: string;
  bestForm: string;
  priceDelta: 'cheaper' | 'same' | 'expensive';
  safetyDelta: number;
  personalMatch: boolean;
}

export interface StackEntry {
  id: string;
  name: string;
  role: string;
  mechanism: string;
  synergiesWith: { with: string; effect: string }[];
  dose: string;
}

export interface StackExplanation {
  name: string;
  substances: StackEntry[];
  pairwiseSynergies: { a: string; b: string; effect: string; severity: string }[];
  coverage: { goals: string[]; organs: string[]; mechanisms: string[] };
  warnings: string[];
  totalSynergyScore: number;
  completeness: number;
  totalDoseCount: number;
}

export interface StackQuery {
  baseIds: string[];
  targetSize: number;
  goal?: GoalType;
  organs?: string[];
  mechanisms?: string[];
  categories?: string[];
  avoidIds?: string[];
  autoFill: boolean;
  profile?: FinderProfile;
}
// ─── GOAL MAP ───────────────────────────────────────────────────────────────
const GOAL_MAP: Record<GoalType, { organs: string[]; mechanisms: string[]; categories: string[]; keywords: string[] }> = {
  sleep: { organs: ['BRAIN', 'NERVES'], mechanisms: ['GABAERGIC', 'MELATONIN', 'SEROTONIN', 'NEUROTRANSMITTER_REGULATION', 'ANXIOLYTIC'], categories: ['anxiolytic', 'adaptogen', 'mineral'], keywords: ['сон', 'sleep', 'мелатонин', 'gaba', 'магний'] },
  energy: { organs: ['MITOCHONDRIA', 'MUSCLES', 'BRAIN'], mechanisms: ['ATP_SYNTHESIS', 'ELECTRON_TRANSPORT_CHAIN', 'ENERGY_PRODUCTION', 'MITOCHONDRIAL', 'CREATINE'], categories: ['mitochondrial', 'stimulant', 'vitamin', 'mineral'], keywords: ['энергия', 'energy', 'atp', 'mito', 'b12', 'железо'] },
  concentration: { organs: ['BRAIN', 'NERVES'], mechanisms: ['CHOLINERGIC', 'DOPAMINE', 'NEUROTRANSMITTER_REGULATION', 'BDNF', 'CEREBRAL_BLOOD_FLOW'], categories: ['nootropic', 'neuroprotector'], keywords: ['концентрация', 'focus', 'память', 'memory', 'дофамин', 'ацетилхолин'] },
  muscle_gain: { organs: ['MUSCLES', 'ENDOCRINE', 'LIVER'], mechanisms: ['MTOR', 'PROTEIN_SYNTHESIS', 'ANABOLIC', 'TESTOSTERONE', 'CREATINE', 'NITROGEN'], categories: ['amino', 'anabolic', 'hormonal'], keywords: ['мышцы', 'muscle', 'mass', 'тестостерон', 'mTOR', 'белок', 'креатин'] },
  fat_loss: { organs: ['LIVER', 'PANCREAS', 'ENDOCRINE', 'ADRENALS'], mechanisms: ['THERMOGENESIS', 'FAT_OXIDATION', 'LIPOLYSIS', 'METABOLIC', 'THYROID', 'AMPK_ACTIVATION'], categories: ['metabolic', 'thyroid', 'stimulant'], keywords: ['жир', 'fat', 'loss', 'термогенез', 'metabolism', 'липолиз'] },
  endurance: { organs: ['HEART', 'LUNGS', 'BLOOD', 'MUSCLES'], mechanisms: ['OXYGEN', 'NITRIC_OXIDE', 'BLOOD_FLOW', 'MITOCHONDRIAL', 'ATP_SYNTHESIS', 'VO2'], categories: ['cardioprotector', 'fatty_acid', 'amino'], keywords: ['endurance', 'выносливость', 'vo2', 'оксид азота', 'железо'] },
  recovery: { organs: ['MUSCLES', 'LIVER', 'IMMUNE_SYSTEM', 'JOINTS'], mechanisms: ['ANTI_INFLAMMATORY', 'ANTIOXIDANT', 'PROTEIN_SYNTHESIS', 'GLUTATHIONE', 'COLLAGEN'], categories: ['antioxidant', 'anti_inflammatory', 'amino', 'joint'], keywords: ['восстановление', 'recovery', 'collagen', 'глутамин', 'bcaa'] },
  immunity: { organs: ['IMMUNE_SYSTEM', 'BLOOD', 'GUT'], mechanisms: ['IMMUNE_MODULATION', 'ANTIOXIDANT', 'ANTIMICROBIAL', 'LYMPHOCYTE'], categories: ['immunomodulator', 'vitamin', 'mineral', 'mushroom'], keywords: ['иммунитет', 'immune', 'витамин с', 'цинк', 'эхинацея'] },
  liver_health: { organs: ['LIVER', 'GALLBLADDER'], mechanisms: ['LIVER_DETOX', 'ANTIOXIDANT', 'CHOLERETIC', 'GLUTATHIONE', 'BILE_ACID'], categories: ['hepatoprotector', 'choleretic', 'bile_acid', 'antioxidant'], keywords: ['печень', 'liver', 'detox', 'гепатопротектор', 'силимарин'] },
  cardio_health: { organs: ['HEART', 'VESSELS', 'BLOOD'], mechanisms: ['COQ10', 'BLOOD_PRESSURE', 'ANTICOAGULANT', 'LIPID', 'VASODILATION'], categories: ['cardioprotector', 'fatty_acid', 'anticoagulant', 'electrolyte'], keywords: ['сердце', 'heart', 'coq10', 'омега-3', 'калий', 'магний'] },
  joints: { organs: ['JOINTS', 'BONES', 'CARTILAGE'], mechanisms: ['COLLAGEN', 'ANTI_INFLAMMATORY', 'CHONDROPROTECTIVE', 'BONE_DENSITY'], categories: ['joint', 'anti_inflammatory', 'bone', 'enzyme'], keywords: ['суставы', 'joints', 'коллаген', 'глюкозамин', 'хондроитин'] },
  skin: { organs: ['SKIN', 'HAIR'], mechanisms: ['COLLAGEN', 'ANTIOXIDANT', 'KERATIN', 'SEBUM'], categories: ['skin', 'vitamin', 'antioxidant', 'fatty_acid'], keywords: ['кожа', 'skin', 'коллаген', 'витамин с', 'биотин'] },
  hair: { organs: ['HAIR', 'SKIN', 'PROSTATE'], mechanisms: ['KERATIN', 'DHT', 'ANTIOXIDANT', 'BLOOD_FLOW'], categories: ['skin', 'vitamin', 'mineral'], keywords: ['волосы', 'hair', 'биотин', 'dht', 'пальметто'] },
  hormones: { organs: ['ENDOCRINE', 'ADRENALS', 'THYROID', 'PITUITARY', 'TESTES'], mechanisms: ['TESTOSTERONE', 'THYROID_HORMONE', 'CORTISOL', 'HPG_AXIS', 'AROMATASE'], categories: ['hormonal', 'adaptogen', 'thyroid'], keywords: ['гормоны', 'hormones', 'тестостерон', 'щитовидная', 'кортизол'] },
  stress: { organs: ['ADRENALS', 'BRAIN', 'NERVES'], mechanisms: ['CORTISOL', 'GABAERGIC', 'ADAPTOGEN', 'SEROTONIN', 'ANXIOLYTIC'], categories: ['adaptogen', 'anxiolytic', 'antidepressant'], keywords: ['стресс', 'stress', 'кортизол', 'адаптоген', 'ашваганда'] },
  longevity: { organs: ['CELLS', 'MITOCHONDRIA', 'BRAIN', 'HEART'], mechanisms: ['ANTIOXIDANT', 'SIRT1', 'AMPK_ACTIVATION', 'NAD', 'AUTOPHAGY', 'TELOMERE'], categories: ['anti_aging', 'mitochondrial', 'antioxidant', 'polyphenol'], keywords: ['долголетие', 'longevity', 'nmn', 'nad', 'resveratrol', 'sirtuin'] },
  detox: { organs: ['LIVER', 'KIDNEYS', 'GUT', 'INTESTINES'], mechanisms: ['LIVER_DETOX', 'GLUTATHIONE', 'ANTIOXIDANT', 'CHELATION', 'BILE_ACID'], categories: ['hepatoprotector', 'antioxidant', 'choleretic', 'gut'], keywords: ['детокс', 'detox', 'печень', 'глутатион', 'клетчатка'] },
  libido: { organs: ['REPRODUCTIVE', 'PROSTATE', 'TESTES', 'BRAIN'], mechanisms: ['TESTOSTERONE', 'NITRIC_OXIDE', 'BLOOD_FLOW', 'DOPAMINE', 'HPG_AXIS'], categories: ['hormonal', 'adaptogen', 'herb'], keywords: ['либидо', 'libido', 'testosterone', 'эрекция', 'dhea', 'трибулус'] },
  mood: { organs: ['BRAIN', 'NERVES'], mechanisms: ['SEROTONIN', 'DOPAMINE', 'GABAERGIC', 'BDNF', 'NEUROTRANSMITTER_REGULATION'], categories: ['antidepressant', 'anxiolytic', 'adaptogen', 'nootropic'], keywords: ['настроение', 'mood', 'депрессия', 'serotonin', 'дофамин', 'зверобой'] },
  brain: { organs: ['BRAIN', 'NERVES', 'EYES'], mechanisms: ['NEUROPROTECTION', 'BDNF', 'CEREBRAL_BLOOD_FLOW', 'CHOLINERGIC', 'DOPAMINE', 'NAD'], categories: ['neuroprotector', 'nootropic', 'antioxidant'], keywords: ['мозг', 'brain', 'память', 'нейропротектор', 'bdnf', 'пирацетам'] },
  digestion: { organs: ['GUT', 'INTESTINES', 'STOMACH', 'PANCREAS'], mechanisms: ['DIGESTIVE_ENZYME', 'GUT_BARRIER', 'MICROBIOME', 'BILE_ACID', 'ANTI_INFLAMMATORY'], categories: ['gut', 'enzyme', 'probiotic', 'choleretic'], keywords: ['жкт', 'digestion', 'пищеварение', 'пробиотики', 'ферменты'] },
  kidney: { organs: ['KIDNEYS', 'VESSELS'], mechanisms: ['RENAL_PROTECTION', 'ANTIOXIDANT', 'ELECTROLYTE', 'BLOOD_PRESSURE'], categories: ['renoprotector', 'antioxidant', 'electrolyte'], keywords: ['почки', 'kidney', 'renal', 'электролиты'] },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getEntry(id: string) {
  return SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()];
}

function getEntryName(id: string): string {
  const e = getEntry(id);
  if (e) return e.nameRu || e.name;
  const s = ALL_SUBSTANCES.find(x => x.id.toLowerCase() === id.toLowerCase());
  return s?.name || SUPPORT_SUBSTANCE_MAP[id]?.name || id.replace(/_/g, ' ');
}

function getAllIds(): string[] {
  return Object.keys(SUPPORT_CATALOG_DATA);
}

function estimatePrice(id: string): 'low' | 'medium' | 'high' {
  const e = getEntry(id);
  if (!e) return 'medium';
  const tier = e.tier;
  if (tier === 'core') return 'low';
  if (tier === 'standard') return 'medium';
  if (tier === 'specialty') return 'high';
  const hasMultiForms = (e.forms?.length || 0) > 2;
  const hasSpecialtyForm = e.forms?.some(f => f.name?.toLowerCase().includes('injection') || f.name?.toLowerCase().includes('forte'));
  if (hasSpecialtyForm) return 'high';
  if (hasMultiForms) return 'medium';
  return 'medium';
}

function estimateDose(id: string, weight: number): string {
  const e = getEntry(id);
  if (!e) return '';
  if (e.bestForm) return `${e.bestForm} (${weight} кг)`;
  if (e.dosage) {
    const mg = e.dosage.mg;
    const perKg = weight > 0 ? Math.round(mg / weight * 10) / 10 : mg;
    return `${mg} мг/день (${perKg} мг/кг) · ${e.dosage.timing || ''}`;
  }
  return '';
}

function checkContraindications(id: string, profile?: FinderProfile): string[] {
  const warnings: string[] = [];
  if (!profile) return warnings;
  const e = getEntry(id);
  if (!e || !e.contraindications) return warnings;
  for (const ci of e.contraindications) {
    const ciLower = ci.toLowerCase();
    for (const hc of profile.healthConditions) {
      if (ciLower.includes(hc) || hc.includes(ciLower)) {
        warnings.push(`Противопоказание при ${hc}: ${ci}`);
      }
    }
    if (profile.aasStatus !== 'none' && ciLower.includes('гормон')) {
      warnings.push(`Возможное взаимодействие с ААС: ${ci}`);
    }
  }
  return warnings;
}

function personalScoreEntry(id: string, profile?: FinderProfile): { score: number; notes: string[] } {
  if (!profile) return { score: 0, notes: [] };
  const e = getEntry(id);
  if (!e) return { score: 0, notes: [] };
  let score = 0;
  const notes: string[] = [];

  // Course match
  if (profile.aasStatus === 'course' || profile.aasStatus === 'pct') {
    if (e.bestForCourse) { score += 8; notes.push('Рекомендован на курсе ААС'); }
  }
  if (profile.aasStatus === 'trt') {
    if (e.tier === 'core') { score += 4; notes.push('Core-препарат для TRT'); }
  }

  // Goal match
  if (profile.goals.length > 0) {
    for (const g of profile.goals) {
      const gm = GOAL_MAP[g];
      if (!gm) continue;
      if (e.category?.some(c => gm.categories.includes(c))) { score += 3; notes.push(`Подходит для цели: ${g}`); break; }
    }
  }

  // Age adjustments
  if (profile.age > 40) {
    if (e.category?.includes('cardioprotector')) { score += 2; notes.push('Кардиопротекция для 40+'); }
    if (e.category?.includes('joint')) { score += 2; notes.push('Поддержка суставов для 40+'); }
  }
  if (profile.age > 50) {
    if (e.category?.includes('anti_aging')) { score += 2; notes.push('Anti-aging для 50+'); }
    if (e.organs?.includes('BONES')) { score += 2; notes.push('Костная поддержка для 50+'); }
  }

  // Weight-based bonus for core
  if (profile.weight > 90 && e.tier === 'core') { score += 2; notes.push('Core для веса >90 кг'); }

  // Budget
  const price = estimatePrice(id);
  if (profile.budget === 'economy' && price === 'low') { score += 2; notes.push('Эконом-вариант'); }
  if (profile.budget === 'premium' && price === 'high') { score += 1; notes.push('Премиум'); }

  return { score, notes };
}

// ─── MAIN SEARCH ────────────────────────────────────────────────────────────
function scoreEntry(entryId: string, query: FinderQuery): { score: number; reasons: string[] } {
  const entry = getEntry(entryId);
  if (!entry) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];
  const profile = query.profile;

  if (query.searchText) {
    const q = query.searchText.toLowerCase();
    const text = ((entry.nameRu || '') + ' ' + (entry.name || '') + ' ' + (entry.description || '')).toLowerCase();
    const catText = (entry.category || []).join(' ').toLowerCase();
    const mechText = (entry.mechanisms || []).join(' ').toLowerCase();
    const organText = (entry.organs || []).join(' ').toLowerCase();
    const targetText = ((entry.targetOrgan || '') + ' ' + (entry.mechanismOfAction || '') + ' ' + (entry.clinicalEffect || '')).toLowerCase();
    if (text.includes(q)) { score += 5; reasons.push('Совпадение в названии/описании'); }
    if (catText.includes(q)) { score += 3; reasons.push('Совпадение в категории'); }
    if (mechText.includes(q)) { score += 3; reasons.push('Совпадение в механизмах'); }
    if (organText.includes(q)) { score += 2; reasons.push('Совпадение в органах'); }
    if (targetText.includes(q)) { score += 2; reasons.push('Совпадение в описании действия'); }
    return { score, reasons };
  }

  if (query.goal) {
    const goal = GOAL_MAP[query.goal];
    if (goal) {
      for (const m of goal.mechanisms) {
        if ((entry.mechanisms || []).some(em => em.includes(m) || m.includes(em))) { score += 5; reasons.push('Механизм отвечает цели'); break; }
      }
      for (const o of goal.organs) {
        if ((entry.organs || []).some(eo => eo.includes(o) || o.includes(eo))) { score += 4; reasons.push('Орган-мишень соответствует цели'); break; }
      }
      for (const c of goal.categories) {
        if ((entry.category || []).some(ec => ec.includes(c) || c.includes(ec))) { score += 3; reasons.push('Категория подходит под цель'); break; }
      }
    }
  }

  if (query.organs && query.organs.length > 0) {
    for (const qOrg of query.organs) {
      if ((entry.organs || []).some(o => o === qOrg || o.includes(qOrg) || qOrg.includes(o))) { score += 5; reasons.push(`Действует на орган: ${qOrg}`); break; }
    }
  }
  if (query.mechanisms && query.mechanisms.length > 0) {
    for (const qMech of query.mechanisms) {
      if ((entry.mechanisms || []).some(m => m.includes(qMech) || qMech.includes(m))) { score += 5; reasons.push(`Механизм: ${qMech}`); break; }
    }
  }
  if (query.categories && query.categories.length > 0) {
    for (const qCat of query.categories) {
      if ((entry.category || []).some(c => c === qCat || c.includes(qCat) || qCat.includes(c))) { score += 3; reasons.push(`Категория: ${qCat}`); break; }
    }
  }

  if (profile) {
    if (profile.aasStatus === 'course' && entry.bestForCourse) { score += 4; reasons.push('Обязателен на курсе ААС'); }
    if (profile.age > 40 && entry.category?.includes('cardioprotector')) { score += 2; reasons.push('Кардиопротекция для 40+'); }
    if (profile.weight > 90 && entry.tier === 'core') { score += 1; reasons.push('Core для веса >90 кг'); }
  } else if (entry.bestForCourse) {
    score += 2; reasons.push('Обязателен на курсе ААС');
  }

  return { score, reasons };
}

export function findSupplements(query: FinderQuery): FinderMatch[] {
  const ids = getAllIds();
  const scored: { id: string; score: number; reasons: string[]; personalScore: number; personalNotes: string[]; contra: string[] }[] = [];

  for (const id of ids) {
    if (query.excludeIds?.some(e => e.toLowerCase() === id.toLowerCase())) continue;
    const { score, reasons } = scoreEntry(id, query);
    if (score > 0) {
      const ps = personalScoreEntry(id, query.profile);
      const contra = checkContraindications(id, query.profile);
      scored.push({ id, score, reasons, personalScore: ps.score, personalNotes: ps.notes, contra });
    }
  }

  scored.sort((a, b) => (b.score + b.personalScore) - (a.score + a.personalScore));
  const max = query.maxResults || 20;
  const top = scored.slice(0, max);

  return top.map(s => {
    const entry = getEntry(s.id);
    const tier = getSubstanceTier(s.id);
    return {
      id: s.id,
      name: getEntryName(s.id),
      relevanceScore: s.score,
      matchReasons: s.reasons,
      tier: tier || 'unknown',
      categories: entry?.category || [],
      organs: entry?.organs || [],
      mechanisms: entry?.mechanisms || [],
      targetOrgan: entry?.targetOrgan || '',
      mechanismOfAction: entry?.mechanismOfAction || '',
      clinicalEffect: entry?.clinicalEffect || '',
      bestForm: entry?.bestForm || '',
      bestForCourse: entry?.bestForCourse || false,
      conflictCount: entry?.conflicts?.length || 0,
      synergyCount: entry?.synergies?.length || 0,
      formCount: entry?.forms?.length || 0,
      personalScore: s.personalScore,
      personalNotes: s.personalNotes,
      estimatedDose: estimateDose(s.id, query.profile?.weight || 80),
      contraindicationWarnings: s.contra,
      priceEstimate: estimatePrice(s.id),
    };
  });
}

// ─── REPLACEMENT ────────────────────────────────────────────────────────────
function getAnalogScore(id: string): { sideEffects: number; contraindications: number; formCount: number; hasBestForm: boolean; tierScore: number } {
  const e = getEntry(id);
  if (!e) return { sideEffects: 99, contraindications: 99, formCount: 0, hasBestForm: false, tierScore: 3 };
  const tierMap: Record<string, number> = { core: 4, standard: 3, advanced: 2, specialty: 1 };
  return {
    sideEffects: e.sideEffects?.length || 0,
    contraindications: e.contraindications?.length || 0,
    formCount: e.forms?.length || 0,
    hasBestForm: !!e.bestForm,
    tierScore: tierMap[e.tier] || 2,
  };
}

export function findReplacement(id: string, type: ReplacementType, profile?: FinderProfile): ReplacementResult[] {
  const entry = getEntry(id);
  if (!entry) return [];
  const results: ReplacementResult[] = [];
  const allIds = getAllIds().filter(i => i !== id && getEntry(i));

  switch (type) {
    case 'direct_analog': {
      const analogs = SUBSTANCE_ANALOGS[id];
      if (analogs) {
        for (const a of analogs) {
          if (a.id === id) continue;
          const ce = getEntry(a.id);
          const contra = checkContraindications(a.id, profile);
          results.push({
            originalId: id, replacementId: a.id, replacementName: a.name || getEntryName(a.id),
            type: 'direct_analog', reason: a.reason || 'Прямой аналог',
            explanation: `Форма: ${a.form || ''}. Дозировка: ${a.mg || ''} ${a.timing || ''}`,
            tierLabel: getSubstanceTier(a.id) || 'standard', tierChange: 'same', safetyNote: contra.length > 0 ? `⚠ ${contra[0]}` : '', bestForm: a.form || ce?.bestForm || '',
            priceDelta: estimatePrice(a.id) === estimatePrice(id) ? 'same' : estimatePrice(a.id) === 'low' && estimatePrice(id) !== 'low' ? 'cheaper' : 'expensive',
            safetyDelta: (ce?.sideEffects?.length || 0) - (entry.sideEffects?.length || 0), personalMatch: contra.length === 0,
          });
        }
      }
      break;
    }
    case 'functional': {
      for (const candidateId of allIds) {
        const ce = getEntry(candidateId);
        if (!ce) continue;
        const sharedOrgans = (entry.organs || []).filter(o => (ce.organs || []).includes(o));
        const sharedMechanisms = (entry.mechanisms || []).filter(m => (ce.mechanisms || []).includes(m));
        const sharedCategories = (entry.category || []).filter(c => (ce.category || []).includes(c));
        if (sharedOrgans.length > 0 && sharedMechanisms.length > 0 && !sharedCategories.length) {
          const contra = checkContraindications(candidateId, profile);
          results.push({
            originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
            type: 'functional', reason: 'Функциональный аналог',
            explanation: `Общие органы: ${sharedOrgans.join(', ')}. Механизмы: ${sharedMechanisms.slice(0,3).join(', ')}. Другая категория — иной подход.`,
            tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: 'same', safetyNote: contra.length > 0 ? `⚠ ${contra[0]}` : '', bestForm: ce.bestForm || '',
            priceDelta: 'same', safetyDelta: 0, personalMatch: contra.length === 0,
          });
          if (results.length >= 5) break;
        }
      }
      break;
    }
    case 'safer': {
      const baseScore = getAnalogScore(id);
      for (const candidateId of allIds) {
        const cs = getAnalogScore(candidateId);
        if (cs.sideEffects < baseScore.sideEffects && cs.contraindications <= baseScore.contraindications) {
          const ce = getEntry(candidateId);
          if ((entry.organs || []).filter(o => (ce?.organs || []).includes(o)).length > 0) {
            const contra = checkContraindications(candidateId, profile);
            const delta = baseScore.sideEffects - cs.sideEffects;
            results.push({
              originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
              type: 'safer', reason: 'Более безопасная альтернатива',
              explanation: `Побочных эффектов: ${cs.sideEffects} (было ${baseScore.sideEffects}), противопоказаний: ${cs.contraindications} (было ${baseScore.contraindications})`,
              tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: 'same', safetyNote: `На ${delta} меньше побочных эффектов`, bestForm: ce?.bestForm || '',
              priceDelta: 'same', safetyDelta: delta, personalMatch: contra.length === 0,
            });
            if (results.length >= 3) break;
          }
        }
      }
      break;
    }
    case 'stronger': {
      const baseTier = getAnalogScore(id).tierScore;
      for (const candidateId of allIds) {
        const cs = getAnalogScore(candidateId);
        const ce = getEntry(candidateId);
        if (!ce) continue;
        const sharedOrgans = (entry.organs || []).filter(o => (ce.organs || []).includes(o));
        const moreMechs = (ce.mechanisms || []).length > (entry.mechanisms || []).length;
        if (sharedOrgans.length > 0 && (cs.tierScore > baseTier || moreMechs)) {
          results.push({
            originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
            type: 'stronger', reason: cs.tierScore > baseTier ? 'Более высокий тир' : 'Больше механизмов',
            explanation: `Тир: ${ce.tier} (был ${entry.tier}), механизмов: ${(ce.mechanisms||[]).length} (было ${(entry.mechanisms||[]).length})`,
            tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: 'upgrade', safetyNote: '', bestForm: ce.bestForm || '',
            priceDelta: 'expensive', safetyDelta: 0, personalMatch: checkContraindications(candidateId, profile).length === 0,
          });
          if (results.length >= 3) break;
        }
      }
      break;
    }
    case 'cheaper': {
      for (const candidateId of allIds) {
        const ce = getEntry(candidateId);
        if (!ce) continue;
        const sharedCategories = (entry.category || []).filter(c => (ce.category || []).includes(c));
        if (sharedCategories.length > 0 && estimatePrice(candidateId) === 'low' && estimatePrice(id) !== 'low') {
          results.push({
            originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
            type: 'cheaper', reason: 'Бюджетная альтернатива', explanation: 'Тот же спектр действия по более низкой цене.',
            tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: 'downgrade', safetyNote: '', bestForm: ce.bestForm || '',
            priceDelta: 'cheaper', safetyDelta: 0, personalMatch: checkContraindications(candidateId, profile).length === 0,
          });
          if (results.length >= 3) break;
        }
      }
      break;
    }
    case 'stack_to_single': {
      for (const candidateId of allIds) {
        const ce = getEntry(candidateId);
        if (!ce) continue;
        const cSet = new Set(ce.mechanisms || []);
        const eSet = new Set(entry.mechanisms || []);
        const intersection = [...cSet].filter(m => eSet.has(m));
        const coverage = eSet.size > 0 ? intersection.length / eSet.size : 0;
        if (coverage >= 0.4 && (ce.organs || []).length >= 2) {
          results.push({
            originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
            type: 'stack_to_single', reason: 'Замена стека одним препаратом',
            explanation: `Покрытие ${Math.round(coverage*100)}% механизмов. Меньше капсул — проще приём.`,
            tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: coverage >= 0.7 ? 'upgrade' : 'same', safetyNote: '', bestForm: ce.bestForm || '',
            priceDelta: 'cheaper', safetyDelta: 0, personalMatch: checkContraindications(candidateId, profile).length === 0,
          });
          if (results.length >= 3) break;
        }
      }
      break;
    }
    case 'single_to_stack': {
      const mechGroups = splitMechanisms(entry.mechanisms || []);
      for (const group of mechGroups) {
        for (const candidateId of allIds) {
          const ce = getEntry(candidateId);
          if (!ce) continue;
          const shared = group.filter(m => (ce.mechanisms || []).some(cm => cm.includes(m) || m.includes(cm)));
          if (shared.length >= Math.ceil(group.length / 2) && !results.some(r => r.replacementId === candidateId)) {
            results.push({
              originalId: id, replacementId: candidateId, replacementName: getEntryName(candidateId),
              type: 'single_to_stack', reason: 'Узкая специализация',
              explanation: `Покрывает: ${shared.slice(0,3).join(', ')}. Разделение даёт гибкость доз.`,
              tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: 'same', safetyNote: '', bestForm: ce.bestForm || '',
              priceDelta: 'expensive', safetyDelta: 0, personalMatch: checkContraindications(candidateId, profile).length === 0,
            });
          }
        }
      }
      break;
    }
  }
  return results.slice(0, 8);
}

function splitMechanisms(mechs: string[]): string[][] {
  if (mechs.length <= 2) return [mechs];
  const groups: string[][] = [];
  const size = Math.ceil(mechs.length / Math.min(mechs.length, 3));
  for (let i = 0; i < mechs.length; i += size) groups.push(mechs.slice(i, i + size));
  return groups;
}

// ─── STACK ──────────────────────────────────────────────────────────────────
export function explainStack(substanceIds: string[], profile?: FinderProfile): StackExplanation {
  const entries = substanceIds.map(id => ({ id, entry: getEntry(id) }));
  const substances: StackEntry[] = [];
  const pairwiseSynergies: { a: string; b: string; effect: string; severity: string }[] = [];
  const allOrgans = new Set<string>();
  const allMechs = new Set<string>();
  const warnings: string[] = [];
  let totalSynergyScore = 0;
  const knownPairs = new Set<string>();

  for (const { id, entry: e } of entries) {
    const role = e ? (e.category || [])[0] || 'support' : 'support';
    const mech = e?.mechanismOfAction || (e?.mechanisms || []).slice(0, 2).join(', ') || '';
    const dose = e ? estimateDose(id, profile?.weight || 80) : '';
    const syns: { with: string; effect: string }[] = [];
    if (e?.synergies) {
      for (const syn of e.synergies) {
        if (substanceIds.includes(syn.with)) syns.push({ with: syn.with, effect: syn.effect || '' });
      }
    }
    substances.push({ id, name: getEntryName(id), role, mechanism: mech, synergiesWith: syns, dose });
    e?.organs?.forEach(o => allOrgans.add(o));
    e?.mechanisms?.forEach(m => allMechs.add(m));
  }

  for (let i = 0; i < substanceIds.length; i++) {
    for (let j = i + 1; j < substanceIds.length; j++) {
      const a = substanceIds[i], b = substanceIds[j];
      const pairKey = [a, b].sort().join('::');
      if (knownPairs.has(pairKey)) continue;
      knownPairs.add(pairKey);
      const found = ALL_INTERACTIONS.find(ix =>
        (ix.substanceA === a && ix.substanceB === b) || (ix.substanceA === b && ix.substanceB === a)
      );
      if (found) {
        pairwiseSynergies.push({ a, b, effect: found.effect || '', severity: String(found.severity || 'MEDIUM') });
        totalSynergyScore += found.severity === 'HIGH' ? 3 : found.severity === 'MEDIUM' ? 2 : 1;
        if (found.type === 'conflict') warnings.push(`Конфликт: ${getEntryName(a)} + ${getEntryName(b)} — ${found.effect || 'несовместимы'}`);
      }
    }
  }

  for (const e of entries) {
    if (e.entry?.contraindications) {
      for (const ci of e.entry.contraindications) warnings.push(`${getEntryName(e.id)}: ${ci}`);
    }
    if (profile) {
      const contra = checkContraindications(e.id, profile);
      contra.forEach(c => warnings.push(`[${getEntryName(e.id)}] ${c}`));
    }
  }

  const maxPossibleSynergies = (substanceIds.length * (substanceIds.length - 1)) / 2;
  const completeness = maxPossibleSynergies > 0 ? pairwiseSynergies.length / maxPossibleSynergies : 0;

  return {
    name: `Стек из ${substanceIds.length} компонентов`,
    substances,
    pairwiseSynergies,
    coverage: { goals: [], organs: [...allOrgans], mechanisms: [...allMechs] },
    warnings: [...new Set(warnings)],
    totalSynergyScore,
    completeness: Math.round(completeness * 100),
    totalDoseCount: substances.filter(s => s.dose).length,
  };
}

export function buildStack(query: StackQuery): { stack: string[]; explanation: StackExplanation } {
  const selected = [...query.baseIds];
  const usedSet = new Set(selected.map(s => s.toLowerCase()));
  const avoidSet = new Set((query.avoidIds || []).map(a => a.toLowerCase()));
  const allIds = getAllIds().filter(id => !usedSet.has(id.toLowerCase()) && !avoidSet.has(id.toLowerCase()));

  const finderQuery: FinderQuery = {
    goal: query.goal, organs: query.organs, mechanisms: query.mechanisms,
    categories: query.categories, excludeIds: [...query.baseIds, ...(query.avoidIds || [])],
    maxResults: query.targetSize * 3, profile: query.profile,
  };
  const candidates = findSupplements(finderQuery);

  if (query.autoFill) {
    for (const c of candidates) {
      if (selected.length >= query.targetSize) break;
      if (!usedSet.has(c.id.toLowerCase()) && !avoidSet.has(c.id.toLowerCase())) {
        selected.push(c.id); usedSet.add(c.id.toLowerCase());
      }
    }
  }

  if (query.autoFill && selected.length < query.targetSize) {
    for (const id of allIds) {
      if (selected.length >= query.targetSize) break;
      const e = getEntry(id);
      if (e && e.bestForCourse) { selected.push(id); usedSet.add(id.toLowerCase()); }
    }
  }

  if (query.autoFill && selected.length < query.targetSize) {
    const baseCats = new Set<string>();
    for (const baseId of query.baseIds) { getEntry(baseId)?.category?.forEach(c => baseCats.add(c)); }
    for (const id of allIds) {
      if (selected.length >= query.targetSize) break;
      const e = getEntry(id);
      if (e && (e.category || []).some(c => baseCats.has(c))) { selected.push(id); usedSet.add(id.toLowerCase()); }
    }
  }

  const explanation = explainStack(selected, query.profile);
  return { stack: selected, explanation };
}

export function findSingleReplacementForStack(substanceIds: string[], profile?: FinderProfile): ReplacementResult | null {
  if (substanceIds.length < 2) return null;
  const allMechs = new Set<string>();
  const allOrgans = new Set<string>();
  for (const id of substanceIds) {
    const e = getEntry(id);
    e?.mechanisms?.forEach(m => allMechs.add(m));
    e?.organs?.forEach(o => allOrgans.add(o));
  }
  for (const candidateId of getAllIds()) {
    if (substanceIds.some(s => s.toLowerCase() === candidateId.toLowerCase())) continue;
    const ce = getEntry(candidateId);
    if (!ce) continue;
    const mechHit = (ce.mechanisms || []).filter(m => [...allMechs].some(am => am.includes(m) || m.includes(am)));
    const organHit = (ce.organs || []).filter(o => [...allOrgans].some(ao => ao === o));
    const coverageMech = allMechs.size > 0 ? mechHit.length / allMechs.size : 0;
    if (coverageMech >= 0.3) {
      const contra = checkContraindications(candidateId, profile);
      return {
        originalId: substanceIds.join('+'), replacementId: candidateId, replacementName: getEntryName(candidateId),
        type: 'stack_to_single', reason: 'Замена стека одним препаратом',
        explanation: `Покрывает ${Math.round(coverageMech*100)}% механизмов. Упрощает приём.`,
        tierLabel: getSubstanceTier(candidateId) || 'standard', tierChange: coverageMech >= 0.7 ? 'upgrade' : 'same', safetyNote: contra.length > 0 ? `⚠ ${contra[0]}` : '', bestForm: ce.bestForm || '',
        priceDelta: 'cheaper', safetyDelta: 0, personalMatch: contra.length === 0,
      };
    }
  }
  return null;
}

export function autoCompleteStack(baseIds: string[], targetSize: number, constraints?: { avoidIds?: string[]; preferredCategories?: string[]; profile?: FinderProfile }): string[] {
  const q: StackQuery = { baseIds, targetSize, autoFill: true, avoidIds: constraints?.avoidIds, categories: constraints?.preferredCategories, profile: constraints?.profile };
  return buildStack(q).stack;
}

// ─── COMPLEX FINDER ──────────────────────────────────────────────────────────

export interface ComplexMatch {
  complexId: string;
  complexName: string;
  matchedIds: string[];
  totalComponents: number;
  coverage: number;
  priceEstimate: 'low' | 'medium' | 'high';
  explanation: string;
}

/** Find complexes that contain a specific substance */
export function findComplexesForSubstance(id: string): ComplexMatch[] {
  const results: ComplexMatch[] = [];
  const lower = id.toLowerCase();
  for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
    if (components.some(c => c.toLowerCase() === lower || lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower))) {
      const entry = getEntry(complexId);
      if (!entry) continue;
      const matched = components.filter(c => {
        const e = getEntry(c);
        return !!e;
      });
      results.push({
        complexId,
        complexName: entry.nameRu || entry.name || complexId,
        matchedIds: matched,
        totalComponents: components.length,
        coverage: matched.length / components.length,
        priceEstimate: estimatePrice(complexId),
        explanation: `Комплекс содержит ${matched.length} из ${components.length} компонентов, связанных с ${getEntryName(id)}`,
      });
    }
  }
  // Also check COMPONENT_TO_COMPLEX for reverse mapping
  const reverseComplexes = COMPONENT_TO_COMPLEX[id] || COMPONENT_TO_COMPLEX[id.toLowerCase()] || [];
  for (const cid of reverseComplexes) {
    if (results.some(r => r.complexId === cid)) continue;
    const entry = getEntry(cid);
    if (!entry) continue;
    const components = SUPPLEMENT_COMPOSITION[cid] || [];
    results.push({
      complexId: cid,
      complexName: entry.nameRu || entry.name || cid,
      matchedIds: components,
      totalComponents: components.length,
      coverage: 1,
      priceEstimate: estimatePrice(cid),
      explanation: `Комплекс содержит компонент ${getEntryName(id)}`,
    });
  }
  return results.sort((a, b) => b.coverage - a.coverage).slice(0, 10);
}

/** Find a single complex that can replace multiple substances in a stack */
export function findComplexForStack(substanceIds: string[]): ComplexMatch[] {
  if (substanceIds.length < 2) return [];
  const lowerIds = new Set(substanceIds.map(id => id.toLowerCase()));
  const results: ComplexMatch[] = [];

  for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
    const entry = getEntry(complexId);
    if (!entry) continue;
    const lowerComps = components.map(c => c.toLowerCase());
    const matched = components.filter(c => lowerIds.has(c.toLowerCase()));
    // Also check if component names/aliases match
    const extraMatched: string[] = [];
    for (const sid of substanceIds) {
      if (matched.some(m => m.toLowerCase() === sid.toLowerCase())) continue;
      const sEntry = getEntry(sid);
      if (!sEntry) continue;
      const sName = (sEntry.nameRu || sEntry.name || '').toLowerCase();
      if (lowerComps.some(c => sName.includes(c) || c.includes(sName))) {
        extraMatched.push(sid);
      }
    }
    const allMatched = [...new Set([...matched, ...extraMatched])];
    if (allMatched.length >= 2) {
      results.push({
        complexId,
        complexName: entry.nameRu || entry.name || complexId,
        matchedIds: allMatched,
        totalComponents: components.length,
        coverage: allMatched.length / Math.max(substanceIds.length, 1),
        priceEstimate: estimatePrice(complexId),
        explanation: `Комплекс покрывает ${allMatched.length} из ${substanceIds.length} веществ стека: ${allMatched.map(m => getEntryName(m)).join(', ')}`,
      });
    }
  }

  // Also check COMPONENT_TO_COMPLEX: find complexes whose components intersect with stack
  for (const sid of substanceIds) {
    const complexes = COMPONENT_TO_COMPLEX[sid] || COMPONENT_TO_COMPLEX[sid.toLowerCase()] || [];
    for (const cid of complexes) {
      if (results.some(r => r.complexId === cid)) continue;
      const components = SUPPLEMENT_COMPOSITION[cid] || [];
      const lowerComps = components.map(c => c.toLowerCase());
      const matched = substanceIds.filter(id => lowerComps.includes(id.toLowerCase()));
      if (matched.length >= 2) {
        const entry = getEntry(cid);
        if (!entry) continue;
        results.push({
          complexId: cid,
          complexName: entry.nameRu || entry.name || cid,
          matchedIds: matched,
          totalComponents: components.length,
          coverage: matched.length / substanceIds.length,
          priceEstimate: estimatePrice(cid),
          explanation: `Комплекс содержит ${matched.length} из ${substanceIds.length} веществ: ${matched.map(m => getEntryName(m)).join(', ')}`,
        });
      }
    }
  }

  return results.sort((a, b) => b.coverage - a.coverage).slice(0, 10);
}

// ─── DEFAULT PROFILE ────────────────────────────────────────────────────────
export function getDefaultProfile(): FinderProfile {
  return {
    age: 30, weight: 80, height: 175, sex: 'male',
    experience: 'intermediate', goals: ['muscle_gain'],
    aasStatus: 'none', healthConditions: [], budget: 'medium',
    avoidIds: [], maxStackSize: 8,
  };
}

export function saveProfile(p: FinderProfile): void {
  try { localStorage.setItem('he_finder_profile', JSON.stringify(p)); } catch {}
}

export function loadProfile(): FinderProfile {
  try {
    const raw = localStorage.getItem('he_finder_profile');
    if (raw) return { ...getDefaultProfile(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultProfile();
}
