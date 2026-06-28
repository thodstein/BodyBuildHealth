// ============================================================
// biostack-recommender.engine.ts — Full BioStack AI engine
// Goals, organs, systems, mechanisms, replacements, stacks
// ============================================================

import { SUPPORT_CATALOG_DATA, type SupportCatalogEntry } from '../data/support-database';
import { SUPPORT_COVERAGE_MAP } from '../data/support-coverage-map';
import type { BioStackProfile } from './biostack-ai.engine';

// ─── Types ───

export type RecGoal = 'sleep' | 'energy' | 'focus' | 'stress' | 'immunity' | 'recovery' | 'libido' | 'joints' | 'digestion' | 'detox' | 'longevity' | 'performance';
export type RecSystem = 'cardio' | 'hepatic' | 'renal' | 'neuro' | 'endocrine' | 'hematologic' | 'reproductive' | 'musculoskeletal' | 'immune' | 'metabolic';
export type RecOrgan = 'BRAIN' | 'HEART' | 'LIVER' | 'KIDNEYS' | 'IMMUNE_SYSTEM' | 'GUT' | 'BONES' | 'JOINTS' | 'MUSCLES' | 'PROSTATE' | 'TESTICLES' | 'THYROID' | 'PANCREAS' | 'SKIN' | 'LUNGS';

export interface RecMatch {
  id: string;
  name: string;
  nameRu: string;
  score: number;
  reason: string;
  tier: string;
  category: string[];
  forms: string;
  dose: string;
  mechanisms: string[];
  organs: string[];
  systems: string[];
  clinicalEffect: string;
  replacements: RecReplacement[];
  synergies: RecSynergy[];
  conflicts: RecConflict[];
}

export interface RecReplacement {
  id: string;
  name: string;
  type: 'direct_analog' | 'functional_analog' | 'safer' | 'stronger' | 'cheaper' | 'stack_replacement';
  score: number;
  reason: string;
  pros: string[];
  cons: string[];
}

export interface RecSynergy {
  withId: string;
  withName: string;
  effect: string;
  mechanism: string;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RecConflict {
  withId: string;
  withName: string;
  effect: string;
  mechanism: string;
}

export interface RecStack {
  id: string;
  name: string;
  substances: RecMatch[];
  totalScore: number;
  coverageSummary: string;
  synergySummary: string;
  timingSummary: string;
  monitoring: string;
}

export interface RecConstraints {
  budget?: 'low' | 'medium' | 'high';
  maxSubstances?: number;
  allergies?: string[];
  excludeIds?: string[];
  preferTier?: string;
  preferVegan?: boolean;
}

// ─── Goal → system+mechanism mapping ───

const GOAL_MAP: Record<RecGoal, { systems: RecSystem[]; mechanisms: string[]; organs: RecOrgan[] }> = {
  sleep: { systems: ['neuro'], mechanisms: ['GABA_MOD', 'NMDA_BLOCK'], organs: ['BRAIN'] },
  energy: { systems: ['cardio', 'neuro'], mechanisms: ['ATP_PRODUCTION', 'MITOCHONDRIAL_ENERGY', 'ELECTRON_TRANSPORT_CHAIN'], organs: ['HEART', 'MUSCLES'] },
  focus: { systems: ['neuro'], mechanisms: ['GABA_MOD', 'DOPAMINERGIC', 'NEUROPEPTIDE_MOD'], organs: ['BRAIN'] },
  stress: { systems: ['neuro', 'endocrine'], mechanisms: ['CORTISOL_REGULATION', 'GABA_MOD', 'ADAPTOGEN'], organs: ['BRAIN', 'THYROID'] },
  immunity: { systems: ['immune'], mechanisms: ['IMMUNE_MODULATION', 'IMMUNE_ACTIVATION'], organs: ['IMMUNE_SYSTEM'] },
  recovery: { systems: ['musculoskeletal', 'neuro'], mechanisms: ['TISSUE_REPAIR', 'COLLAGEN_SYNTHESIS', 'PROTEIN_SYNTHESIS'], organs: ['MUSCLES', 'JOINTS'] },
  libido: { systems: ['endocrine', 'reproductive'], mechanisms: ['TESTOSTERONE_UP', 'LH_UP', 'DOPAMINE_PRECURSOR'], organs: ['TESTICLES', 'BRAIN'] },
  joints: { systems: ['musculoskeletal'], mechanisms: ['COLLAGEN_SYNTHESIS', 'TISSUE_REPAIR'], organs: ['JOINTS', 'BONES'] },
  digestion: { systems: ['hepatic'], mechanisms: ['BILE_ACID_MOD', 'GUT_FLORA_MODULATION'], organs: ['GUT', 'LIVER', 'PANCREAS'] },
  detox: { systems: ['hepatic', 'renal'], mechanisms: ['GLUTATHIONE_UP', 'ANTIOXIDANT', 'CYP450_MODULATION'], organs: ['LIVER', 'KIDNEYS'] },
  longevity: { systems: ['cardio', 'neuro', 'hepatic'], mechanisms: ['ANTIOXIDANT', 'MITOCHONDRIAL_ENERGY', 'ANTI_INFLAMMATORY'], organs: ['HEART', 'BRAIN'] },
  performance: { systems: ['cardio', 'musculoskeletal'], mechanisms: ['ATP_PRODUCTION', 'PROTEIN_SYNTHESIS', 'ELECTRON_TRANSPORT_CHAIN'], organs: ['MUSCLES', 'HEART'] },
};

// ─── Tier cost weights ───
const TIER_COST: Record<string, number> = { core: 3, standard: 2, advanced: 1, specialty: 0.5 };

// ─── Main search ───

export function searchBioStack(
  params: {
    goals?: RecGoal[];
    organs?: RecOrgan[];
    systems?: RecSystem[];
    mechanisms?: string[];
    constraints?: RecConstraints;
    excludeIds?: string[];
    limit?: number;
  },
  profile?: BioStackProfile,
): RecMatch[] {
  const results: RecMatch[] = [];
  const catalogEntries = Object.entries(SUPPORT_CATALOG_DATA);
  const excludeSet = new Set([...(params.excludeIds || []), ...(params.constraints?.excludeIds || [])]);

  for (const [id, entry] of catalogEntries) {
    if (excludeSet.has(id) || excludeSet.has(id.toLowerCase())) continue;
    
    let score = 0;
    const reasons: string[] = [];

    // Goal match
    if (params.goals) {
      for (const goal of params.goals) {
        const gm = GOAL_MAP[goal];
        if (!gm) continue;
        // Check systems
        const sysMatch = (entry.systems || []).filter(s => gm.systems.includes(s as RecSystem));
        if (sysMatch.length > 0) { score += sysMatch.length * 15; reasons.push(`${goal}: системы ${sysMatch.join(',')}`); }
        // Check mechanisms  
        const mechMatch = (entry.mechanisms || []).filter(m => gm.mechanisms.some(gm => m.includes(gm)));
        if (mechMatch.length > 0) { score += mechMatch.length * 20; reasons.push(`${goal}: механизмы ${mechMatch.slice(0,2).join(',')}`); }
        // Check organs
        const orgMatch = (entry.organs || []).filter(o => gm.organs.includes(o as RecOrgan));
        if (orgMatch.length > 0) { score += orgMatch.length * 10; }
      }
    }

    // Organ match
    if (params.organs) {
      const orgMatch = (entry.organs || []).filter(o => params.organs!.includes(o as RecOrgan));
      if (orgMatch.length > 0) { score += orgMatch.length * 12; reasons.push(`органы: ${orgMatch.join(',')}`); }
    }

    // System match
    if (params.systems) {
      const sysMatch = (entry.systems || []).filter(s => params.systems!.includes(s as RecSystem));
      if (sysMatch.length > 0) { score += sysMatch.length * 10; reasons.push(`системы: ${sysMatch.join(',')}`); }
    }

    // Mechanism match
    if (params.mechanisms) {
      const mechMatch = (entry.mechanisms || []).filter(m => params.mechanisms!.some(pm => m.includes(pm) || pm.includes(m)));
      if (mechMatch.length > 0) { score += mechMatch.length * 25; reasons.push(`механизмы: ${mechMatch.slice(0,2).join(',')}`); }
    }

    // User constraints
    if (params.constraints) {
      if (params.constraints.preferVegan) {
        const isVegan = !(entry.organs || []).some(o => ['LIVER','HEART','TESTICLES','PROSTATE'].includes(o));
        if (isVegan) score += 5; else score -= 5;
      }
      if (params.constraints.preferTier && entry.tier === params.constraints.preferTier) score += 5;
    }

    // Allergy check
    if (params.constraints?.allergies) {
      const sideEffects = (entry.sideEffects || []).map((s: any) => typeof s === 'string' ? s : (s.effect || '')).join(' ');
      if (params.constraints.allergies.some(a => sideEffects.toLowerCase().includes(a))) continue;
    }

    if (score > 0 && (params.goals || params.organs || params.systems || params.mechanisms)) {
      const form = entry.forms?.[0];
      results.push({
        id: entry.id || id,
        name: entry.name || id,
        nameRu: entry.nameRu || entry.name || id,
        score,
        reason: reasons.join('; ') || 'по параметрам поиска',
        tier: entry.tier || 'standard',
        category: entry.category || [],
        forms: form ? `${form.nameRu || form.name}: ${form.dose}` : (entry.dosage ? `${entry.dosage.mg}мг ${entry.dosage.timing}` : '—'),
        dose: entry.dosage ? `${entry.dosage.mg}мг ${entry.dosage.timing}` : (form?.dose || '—'),
        mechanisms: entry.mechanisms || [],
        organs: entry.organs || [],
        systems: entry.systems || [],
        clinicalEffect: entry.clinicalEffect || '',
        replacements: [],
        synergies: [],
        conflicts: [],
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, params.limit || 20);
}

// ─── Replacements ───

export function findReplacements(
  substanceId: string,
  type?: RecReplacement['type'],
): RecReplacement[] {
  const entry = SUPPORT_CATALOG_DATA[substanceId];
  if (!entry) return [];

  const allIds = Object.keys(SUPPORT_CATALOG_DATA).filter(id => id !== substanceId);
  const replacements: RecReplacement[] = [];
  const entrySys = new Set(entry.systems || []);
  const entryOrg = new Set(entry.organs || []);
  const entryMech = new Set(entry.mechanisms || []);

  for (const id of allIds) {
    const other = SUPPORT_CATALOG_DATA[id];
    if (!other) continue;

    const otherSys = new Set(other.systems || []);
    const otherOrg = new Set(other.organs || []);
    const otherMech = new Set(other.mechanisms || []);

    // Functional overlap
    const sysOverlap = [...entrySys].filter(s => otherSys.has(s)).length;
    const orgOverlap = [...entryOrg].filter(o => otherOrg.has(o)).length;
    const mechOverlap = [...entryMech].filter(m => otherMech.has(m)).length;

    // Direct analog: same systems + mechanisms
    if (sysOverlap >= 2 && mechOverlap >= 1) {
      replacements.push({
        id: other.id || id,
        name: other.name || id,
        type: 'direct_analog',
        score: sysOverlap * 10 + mechOverlap * 15 + orgOverlap * 5,
        reason: `Совпадает по ${sysOverlap} системам и ${mechOverlap} механизмам`,
        pros: ['Схожий профиль действия', 'Может заменить напрямую'],
        cons: ['Проверьте индивидуальную переносимость'],
      });
    }

    // Functional analog: same systems
    if (sysOverlap >= 1 && mechOverlap === 0) {
      replacements.push({
        id: other.id || id,
        name: other.name || id,
        type: 'functional_analog',
        score: sysOverlap * 8 + orgOverlap * 5,
        reason: `Работает на те же системы через другие механизмы`,
        pros: ['Альтернативный механизм', 'Меньше перекрёстных взаимодействий'],
        cons: ['Может требоваться другая дозировка'],
      });
    }
  }

  // Deduplicate by best score per type
  const best: Record<string, RecReplacement> = {};
  for (const r of replacements) {
    const key = r.id + '_' + r.type;
    if (!best[key] || r.score > best[key].score) best[key] = r;
  }

  const result = Object.values(best).sort((a, b) => b.score - a.score);
  if (type) return result.filter(r => r.type === type).slice(0, 5);
  return result.slice(0, 8);
}

// ─── Build stack ───

export function buildSmartStack(
  goals: RecGoal[],
  constraints?: RecConstraints,
  profile?: BioStackProfile,
): RecStack {
  const allMatches = searchBioStack({ goals, constraints: { ...constraints, maxSubstances: constraints?.maxSubstances || 5 } }, profile);
  const selected: RecMatch[] = [];
  const coveredMechs = new Set<string>();

  for (const match of allMatches) {
    if (selected.length >= (constraints?.maxSubstances || 5)) break;
    const newMechs = (match.mechanisms || []).filter(m => !coveredMechs.has(m));
    if (newMechs.length > 0 || selected.length === 0) {
      selected.push(match);
      newMechs.forEach(m => coveredMechs.add(m));
    }
  }

  // Fill synergies
  for (const match of selected) {
    const entry = SUPPORT_CATALOG_DATA[match.id];
    if (entry?.synergies) {
      match.synergies = entry.synergies.map(s => ({
        withId: s.with,
        withName: SUPPORT_CATALOG_DATA[s.with]?.name || s.with,
        effect: s.effect,
        mechanism: s.mechanism,
        strength: s.severity as 'LOW' | 'MEDIUM' | 'HIGH',
      }));
    }
    if (entry?.conflicts) {
      match.conflicts = entry.conflicts.map(c => ({
        withId: c.with,
        withName: SUPPORT_CATALOG_DATA[c.with]?.name || c.with,
        effect: c.effect,
        mechanism: c.mechanism,
      }));
    }
  }

  // Coverage summary
  const allSystems = new Set<string>();
  selected.forEach(s => s.systems.forEach(sys => allSystems.add(sys)));
  const coverageSummary = `Покрыто систем: ${allSystems.size} (${[...allSystems].join(', ')})`;

  // Synergy summary
  const allSynergies = selected.flatMap(s => s.synergies.filter(syn => selected.some(s2 => s2.id === syn.withId)));
  const synergySummary = allSynergies.length > 0
    ? `${allSynergies.length} синергий в стеке`
    : 'Синергии не выявлены';

  // Timing
  const timing: string[] = [];
  selected.forEach(s => {
    const entry = SUPPORT_CATALOG_DATA[s.id];
    if (entry?.dosage) timing.push(`${s.nameRu || s.name}: ${entry.dosage.timing}`);
  });
  const timingSummary = timing.join('; ') || 'Принимать согласно инструкции';

  return {
    id: 'stack_' + Date.now(),
    name: goals.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' + '),
    substances: selected,
    totalScore: selected.reduce((s, m) => s + m.score, 0),
    coverageSummary,
    synergySummary,
    timingSummary,
    monitoring: selected.length > 0 ? 'Контролируйте самочувствие и лабораторные показатели' : 'Нет данных',
  };
}

// ─── Quick lookup ───

export function findById(id: string): RecMatch | null {
  const entry = SUPPORT_CATALOG_DATA[id];
  if (!entry) return null;
  const form = entry.forms?.[0];
  return {
    id: entry.id || id,
    name: entry.name || id,
    nameRu: entry.nameRu || entry.name || id,
    score: 100,
    reason: 'прямой запрос',
    tier: entry.tier || 'standard',
    category: entry.category || [],
    forms: form ? `${form.nameRu || form.name}: ${form.dose}` : '—',
    dose: entry.dosage ? `${entry.dosage.mg}мг ${entry.dosage.timing}` : (form?.dose || '—'),
    mechanisms: entry.mechanisms || [],
    organs: entry.organs || [],
    systems: entry.systems || [],
    clinicalEffect: entry.clinicalEffect || '',
    replacements: findReplacements(id),
    synergies: (entry.synergies || []).map(s => ({
      withId: s.with, withName: SUPPORT_CATALOG_DATA[s.with]?.name || s.with,
      effect: s.effect, mechanism: s.mechanism, strength: s.severity as 'LOW'|'MEDIUM'|'HIGH',
    })),
    conflicts: (entry.conflicts || []).map(c => ({
      withId: c.with, withName: SUPPORT_CATALOG_DATA[c.with]?.name || c.with,
      effect: c.effect, mechanism: c.mechanism,
    })),
  };
}
