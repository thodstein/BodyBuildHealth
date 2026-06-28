import { SUPPORT_CATALOG_DATA as SUPPORT_CATALOG } from './support-catalog-data';
import { LAB_MARKER_MAP } from './lab-marker-map';

// ─── Reverse indexes from SUPPORT_CATALOG_DATA ───
export const SUPPORT_CATALOG_DATA = SUPPORT_CATALOG;
export const MECHANISM_TO_SUPPORT: Record<string, string[]> = {};
export const ORGAN_TO_SUPPORT: Record<string, string[]> = {};
export const SYSTEM_TO_SUPPORT: Record<string, string[]> = {};
export const CATEGORY_TO_SUPPORT: Record<string, string[]> = {};
export const ALL_SUPPORT_IDS: string[] = [];
export const LAB_MARKER_TO_SUPPORT: Record<string, { substanceId: string; mechanism: string; organ: string; system: string }[]> = {};

(function buildIndex() {
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    ALL_SUPPORT_IDS.push(id);
    for (const m of entry.mechanisms || []) {
      if (!MECHANISM_TO_SUPPORT[m]) MECHANISM_TO_SUPPORT[m] = [];
      if (!MECHANISM_TO_SUPPORT[m].includes(id)) MECHANISM_TO_SUPPORT[m].push(id);
    }
    for (const o of entry.organs || []) {
      if (!ORGAN_TO_SUPPORT[o]) ORGAN_TO_SUPPORT[o] = [];
      if (!ORGAN_TO_SUPPORT[o].includes(id)) ORGAN_TO_SUPPORT[o].push(id);
    }
    for (const s of entry.systems || []) {
      if (!SYSTEM_TO_SUPPORT[s]) SYSTEM_TO_SUPPORT[s] = [];
      if (!SYSTEM_TO_SUPPORT[s].includes(id)) SYSTEM_TO_SUPPORT[s].push(id);
    }
    for (const c of entry.category || []) {
      if (!CATEGORY_TO_SUPPORT[c]) CATEGORY_TO_SUPPORT[c] = [];
      if (!CATEGORY_TO_SUPPORT[c].includes(id)) CATEGORY_TO_SUPPORT[c].push(id);
    }
  }

  // Build LAB_MARKER_TO_SUPPORT from lab-marker-map + mechanism index
  for (const lm of LAB_MARKER_MAP) {
    const marker = lm.marker;
    if (!LAB_MARKER_TO_SUPPORT[marker]) LAB_MARKER_TO_SUPPORT[marker] = [];
    const seen = new Set<string>();
    // Use correctionIds from map
    for (const cid of lm.correctionIds) {
      if (seen.has(cid)) continue;
      seen.add(cid);
      LAB_MARKER_TO_SUPPORT[marker].push({
        substanceId: cid,
        mechanism: lm.mechanisms.join(', '),
        organ: lm.organ,
        system: lm.system,
      });
    }
    // Also find from mechanism index
    for (const mech of lm.mechanisms) {
      const ids = MECHANISM_TO_SUPPORT[mech] || [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        LAB_MARKER_TO_SUPPORT[marker].push({
          substanceId: id,
          mechanism: mech,
          organ: lm.organ,
          system: lm.system,
        });
      }
    }
  }
})();

export function getSupportEntry(id: string) {
  return SUPPORT_CATALOG_DATA[id] || null;
}

export function findByMechanisms(...mechs: string[]): string[] {
  if (mechs.length === 0) return [];
  const result = new Set<string>();
  for (const m of mechs) for (const id of (MECHANISM_TO_SUPPORT[m] || [])) result.add(id);
  return [...result];
}

export function findByMechanismSubset(mechs: string[], max: number = 6): string[] {
  const result = new Set<string>();
  for (const m of mechs) for (const id of (MECHANISM_TO_SUPPORT[m] || [])) { result.add(id); if (result.size >= max) break; }
  if (result.size === 0) return [];
  return [...result].slice(0, max);
}

export function findByOrgan(organ: string): string[] {
  return ORGAN_TO_SUPPORT[organ] || [];
}

export function findBySystem(system: string): string[] {
  return SYSTEM_TO_SUPPORT[system] || [];
}

export function findByCategory(category: string): string[] {
  return CATEGORY_TO_SUPPORT[category] || [];
}

export function findByLabMarker(marker: string): { substanceId: string; mechanism: string; organ: string; system: string }[] {
  return LAB_MARKER_TO_SUPPORT[marker] || [];
}

export function findByCategoryAndMech(category: string, ...mechs: string[]): string[] {
  const catIds = new Set(CATEGORY_TO_SUPPORT[category] || []);
  const mechIds = new Set(findByMechanisms(...mechs));
  return [...catIds].filter(x => mechIds.has(x)).slice(0, 6);
}

export function findByOrganAndMech(organ: string, ...mechs: string[]): string[] {
  const organIds = new Set(ORGAN_TO_SUPPORT[organ] || []);
  const mechIds = new Set(findByMechanisms(...mechs));
  return [...organIds].filter(x => mechIds.has(x)).slice(0, 6);
}

// ─── SYNERGY GRAPH from SUPPORT_CATALOG_DATA ───
// synergyScore[a][b] = strength of synergy between a and b (0-1)
// conflictScore[a][b] = severity of conflict between a and b (0-1)
export const SYNERGY_SCORE: Record<string, Record<string, number>> = {};
export const CONFLICT_SCORE: Record<string, Record<string, number>> = {};

(function buildSynergyGraph() {
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    for (const syn of entry.synergies || []) {
      const target = syn.with;
      if (!target) continue;
      const sev: Record<string, number> = { LOW: 0.3, MEDIUM: 0.6, HIGH: 0.9 };
      const s = sev[syn.severity] || 0.5;
      if (!SYNERGY_SCORE[id]) SYNERGY_SCORE[id] = {};
      SYNERGY_SCORE[id][target] = Math.max(SYNERGY_SCORE[id][target] || 0, s);
      if (!SYNERGY_SCORE[target]) SYNERGY_SCORE[target] = {};
      SYNERGY_SCORE[target][id] = Math.max(SYNERGY_SCORE[target][id] || 0, s);
    }
    for (const con of entry.conflicts || []) {
      const target = con.with;
      if (!target) continue;
      const sev: Record<string, number> = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.8 };
      const s = sev[con.severity] || 0.4;
      if (!CONFLICT_SCORE[id]) CONFLICT_SCORE[id] = {};
      CONFLICT_SCORE[id][target] = Math.max(CONFLICT_SCORE[id][target] || 0, s);
      if (!CONFLICT_SCORE[target]) CONFLICT_SCORE[target] = {};
      CONFLICT_SCORE[target][id] = Math.max(CONFLICT_SCORE[target][id] || 0, s);
    }
  }
})();

export function getSynergyScore(a: string, b: string): number {
  return SYNERGY_SCORE[a]?.[b] || SYNERGY_SCORE[b]?.[a] || 0;
}

export function getConflictScore(a: string, b: string): number {
  return CONFLICT_SCORE[a]?.[b] || CONFLICT_SCORE[b]?.[a] || 0;
}

// ─── Score a set of substances for synergy density ───
export function scoreCombination(ids: string[]): number {
  let synergySum = 0, conflictSum = 0, pairs = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      synergySum += getSynergyScore(ids[i], ids[j]);
      conflictSum += getConflictScore(ids[i], ids[j]);
      pairs++;
    }
  }
  if (pairs === 0) return 0;
  return (synergySum - conflictSum * 2) / pairs; // conflicts weighted double
}

// ─── TIER-based filtering: each budget level maps to different tier compositions ───
export const BUDGET_TIER_MAP: Record<string, ('base' | 'first' | 'second' | 'third')[]> = {
  basic: ['base', 'first'],
  mid: ['base', 'first', 'second'],
  max: ['base', 'first', 'second', 'third'],
  boost: ['base', 'second', 'third'], // skip basic first-tier forms, use only quality
};

// Get tier from SUPPORT_CATALOG_DATA tier field
export function getEntryTier(id: string): 'base' | 'first' | 'second' | 'third' {
  const entry = SUPPORT_CATALOG_DATA[id];
  if (!entry) return 'base';
  const map: Record<string, 'base' | 'first' | 'second' | 'third'> = { core: 'first', standard: 'second', advanced: 'third', specialty: 'third' };
  return map[entry.tier] || 'base';
}

// Filter substances by budget level
export function filterByBudget(ids: string[], budget: string): string[] {
  const allowedTiers = BUDGET_TIER_MAP[budget] || BUDGET_TIER_MAP.basic;
  return ids.filter(id => allowedTiers.includes(getEntryTier(id)));
}

export const DRUG_PD_EFFECT_TO_SUPPORT: Record<string, { mechanisms: string[]; categories: string[]; severityKey: string; threshold: number }[]> = {
  hct_impact: [
    { mechanisms: ['PLATELET_AGGREGATION_INHIBITION', 'FIBRINOLYSIS'], categories: ['anticoagulant'], severityKey: 'hct', threshold: 3 },
  ],
  hepatotoxicity: [
    { mechanisms: ['GLUTATHIONE_SYNTHESIS', 'ANTIOXIDANT', 'LIVER_REGENERATION', 'BILE_ACID_MOD'], categories: ['hepatoprotector'], severityKey: 'hepatic', threshold: 0.5 },
  ],
  neuro_toxicity: [
    { mechanisms: ['NGF_STIMULATION', 'NEUROPROTECTION', 'DOPAMINE_PRECURSOR', 'SEROTONIN_PRECURSOR', 'MEMORY_ENHANCEMENT', 'MYELIN_REPAIR'], categories: ['neuroprotector', 'nootropic'], severityKey: 'neuro', threshold: 0.3 },
  ],
  aromatization: [
    { mechanisms: ['AROMATASE_INHIBITION', 'ESTROGEN_MODULATION'], categories: ['hormonal'], severityKey: 'estradiol', threshold: 0.3 },
  ],
  progestogenic: [
    { mechanisms: ['PROLACTIN_SUPPRESSION', 'DOPAMINE_PRECURSOR'], categories: ['hormonal'], severityKey: 'prolactin', threshold: 0.2 },
  ],
  lipid_impact: [
    { mechanisms: ['CHOLESTEROL_REDUCTION', 'AMPK_ACTIVATION', 'LIPID_LOWERING', 'EPA_DHA_UP'], categories: ['antioxidant', 'fatty_acid'], severityKey: 'lipid', threshold: 0.2 },
  ],
};
