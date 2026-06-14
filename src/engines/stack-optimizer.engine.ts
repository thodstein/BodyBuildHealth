import { SUPPORT_BASE_COVERAGE, RISK_SYSTEMS, ALL_RISK_SYSTEMS, COVERAGE_ID_ALIAS } from '../core/constants';
import {
  ALL_SUBSTANCES,
  ALL_INTERACTIONS,
  type SupportInteraction,
} from '../data/support-database';
import {
  SYNERGY_PAIRS,
  type SynergyPair,
} from './support.engine';

export const RISK_SYSTEMS_8 = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'] as const;
export type RiskSystem = typeof RISK_SYSTEMS_8[number];

/* ---------- Organ → System mapping (UPPERCASE from DB) ---------- */
const ORGAN_TO_SYSTEM: Record<string, { system: string; weight: number }[]> = {
  ADRENALS: [{ system: 'endocrine', weight: 0.35 }],
  BILE_DUCTS: [{ system: 'hepatic', weight: 0.25 }],
  BLADDER: [{ system: 'renal', weight: 0.3 }],
  BLOOD: [{ system: 'hematologic', weight: 0.35 }],
  BONE_MARROW: [{ system: 'hematologic', weight: 0.4 }],
  BONES: [{ system: 'musculoskeletal', weight: 0.35 }],
  BRAIN: [{ system: 'neuro', weight: 0.4 }],
  CELLS: [], // too generic
  ESOPHAGUS: [{ system: 'hepatic', weight: 0.15 }],
  EYES: [{ system: 'neuro', weight: 0.3 }],
  FAT_TISSUE: [{ system: 'endocrine', weight: 0.2 }],
  GALLBLADDER: [{ system: 'hepatic', weight: 0.25 }],
  GI: [{ system: 'hepatic', weight: 0.3 }],
  GONADS: [{ system: 'reproductive', weight: 0.35 }],
  HAIR: [{ system: 'musculoskeletal', weight: 0.15 }],
  HEART: [{ system: 'cardio', weight: 0.4 }],
  HORMONES: [{ system: 'endocrine', weight: 0.3 }],
  HYPOTHALAMUS: [{ system: 'neuro', weight: 0.3 }, { system: 'endocrine', weight: 0.25 }],
  IMMUNE_SYSTEM: [{ system: 'endocrine', weight: 0.3 }, { system: 'hematologic', weight: 0.2 }],
  JOINTS: [{ system: 'musculoskeletal', weight: 0.35 }],
  KIDNEYS: [{ system: 'renal', weight: 0.4 }],
  LIGAMENTS: [{ system: 'musculoskeletal', weight: 0.3 }],
  LIVER: [{ system: 'hepatic', weight: 0.4 }],
  LUNGS: [{ system: 'cardio', weight: 0.3 }],
  LYMPH: [{ system: 'hematologic', weight: 0.3 }],
  METABOLISM: [{ system: 'endocrine', weight: 0.25 }],
  MICROBIOME: [{ system: 'hepatic', weight: 0.25 }],
  MITOCHONDRIA: [{ system: 'cardio', weight: 0.15 }, { system: 'neuro', weight: 0.15 }, { system: 'endocrine', weight: 0.15 }],
  MOUTH: [{ system: 'hepatic', weight: 0.1 }],
  MUSCLES: [{ system: 'musculoskeletal', weight: 0.4 }],
  NAILS: [{ system: 'musculoskeletal', weight: 0.15 }],
  NERVES: [{ system: 'neuro', weight: 0.35 }],
  ORGANS: [],
  OVARIES: [{ system: 'reproductive', weight: 0.35 }],
  PANCREAS: [{ system: 'endocrine', weight: 0.35 }],
  PARATHYROID: [{ system: 'endocrine', weight: 0.3 }],
  PINEAL_GLAND: [{ system: 'neuro', weight: 0.3 }],
  PITUITARY: [{ system: 'endocrine', weight: 0.35 }, { system: 'neuro', weight: 0.15 }],
  PLACENTA: [{ system: 'reproductive', weight: 0.3 }],
  PLATELETS: [{ system: 'hematologic', weight: 0.3 }],
  PROSTATE: [{ system: 'reproductive', weight: 0.35 }],
  SKIN: [{ system: 'musculoskeletal', weight: 0.3 }],
  SPINE: [{ system: 'musculoskeletal', weight: 0.3 }],
  STOMACH: [{ system: 'hepatic', weight: 0.2 }],
  TEETH: [{ system: 'musculoskeletal', weight: 0.25 }],
  TENDONS: [{ system: 'musculoskeletal', weight: 0.3 }],
  TESTES: [{ system: 'reproductive', weight: 0.4 }],
  THYROID: [{ system: 'endocrine', weight: 0.4 }],
  TISSUES: [],
  URINARY: [{ system: 'renal', weight: 0.3 }],
  UTERUS: [{ system: 'reproductive', weight: 0.3 }],
  VESSELS: [{ system: 'cardio', weight: 0.35 }],
};

const ORGAN_SYSTEMS_MAP: Record<string, string> = {};
const ORGAN_WEIGHTS: Record<string, number> = {};
for (const [org, mappings] of Object.entries(ORGAN_TO_SYSTEM)) {
  if (mappings.length > 0) {
    ORGAN_SYSTEMS_MAP[org] = mappings[0].system;
    ORGAN_WEIGHTS[org] = mappings[0].weight;
  }
}

/* ---------- Coverage from SUPPORT_BASE_COVERAGE ---------- */
function compressCoverageKey(key: string): string | null {
  const sys = RISK_SYSTEMS_8.find(s => key.startsWith(s));
  return sys || null;
}

function getCoverageFromBase(simpleId: string): Record<string, number> {
  const cov: Record<string, number> = {};
  const coverage = SUPPORT_BASE_COVERAGE[simpleId as keyof typeof SUPPORT_BASE_COVERAGE];
  if (!coverage) return cov;
  for (const [key, value] of Object.entries(coverage)) {
    const sys = compressCoverageKey(key);
    if (sys && value > 0) {
      cov[sys] = (cov[sys] ?? 0) + value;
    }
  }
  for (const sys of RISK_SYSTEMS_8) {
    if (cov[sys]) cov[sys] = Math.min(1, cov[sys]);
  }
  return cov;
}

/* ---------- Coverage from organs ---------- */
function getCoverageFromOrgans(organs: string[]): Record<string, number> {
  const cov: Record<string, number> = {};
  for (const organ of organs) {
    const upperOrgan = organ.toUpperCase();
    const mappings = ORGAN_TO_SYSTEM[upperOrgan];
    if (!mappings) continue;
    for (const m of mappings) {
      cov[m.system] = (cov[m.system] ?? 0) + m.weight;
    }
  }
  for (const sys of RISK_SYSTEMS_8) {
    if (cov[sys]) cov[sys] = Math.min(1, cov[sys]);
  }
  return cov;
}

/* ---------- Derive simpleId from prefixed ID ---------- */
export function getSimpleId(id: string): string {
  const sub = ALL_SUBSTANCES.find(s => s.id === id);
  if (sub) return sub.id;
  const lower = id.toLowerCase();
  const found = ALL_SUBSTANCES.find(s => s.id.toLowerCase().includes(lower));
  if (found) return found.id;
  return id;
}

/* ---------- Main: derive system coverage for ANY substance ---------- */
export function deriveSystemCoverage(substanceId: string): Record<string, number> {
  const sub = ALL_SUBSTANCES.find(s => s.id === substanceId);
  if (!sub) {
    const empty: Record<string, number> = {};
    for (const s of RISK_SYSTEMS_8) empty[s] = 0;
    return empty;
  }

  const subLower = substanceId.toLowerCase();
  const aliasKey = COVERAGE_ID_ALIAS[substanceId];
  const simpleKey = aliasKey || Object.keys(SUPPORT_BASE_COVERAGE).find(k =>
    substanceId === k || substanceId.toLowerCase().includes(k) || k.includes(substanceId.toLowerCase())
  );

  let baseCov: Record<string, number> = {};
  if (simpleKey) {
    baseCov = getCoverageFromBase(simpleKey);
  }

  const organCov = getCoverageFromOrgans(sub.organs || []);

  const merged: Record<string, number> = {};
  for (const sys of RISK_SYSTEMS_8) {
    const base = baseCov[sys] ?? 0;
    const organ = organCov[sys] ?? 0;
    merged[sys] = Math.min(1, Math.max(base, organ));
  }
  return merged;
}

/* ---------- Lookup substance name ---------- */
export function getSubstanceName(id: string): string {
  const sub = ALL_SUBSTANCES.find(s => s.id === id);
  if (sub) return sub.name;
  const lower = id.toLowerCase();
  const found = ALL_SUBSTANCES.find(s => s.id.toLowerCase().includes(lower));
  if (found) return found.name;
  return id;
}

/* ---------- Lookup categories ---------- */
export function getSubstanceCategories(id: string): string[] {
  const sub = ALL_SUBSTANCES.find(s => s.id === id);
  return sub?.categories ?? [];
}

/* ---------- Interaction helpers ---------- */
function normalizeId(id: string): string {
  return id.replace(/^[A-Z]+_/, '').toUpperCase();
}

function matchIds(a: string, b: string): boolean {
  return a === b || normalizeId(a) === normalizeId(b) || a.toUpperCase() === b.toUpperCase();
}

export interface StackSynergyInfo {
  a: string;
  aName: string;
  b: string;
  bName: string;
  mechanism: string;
  type: 'synergy' | 'conflict' | 'caution';
  severity: string;
  separationGap?: number;
}

function findInteractionsBetween(a: string, b: string): StackSynergyInfo[] {
  const results: StackSynergyInfo[] = [];
  const aNorm = normalizeId(a);
  const bNorm = normalizeId(b);

  for (const pair of SYNERGY_PAIRS) {
    const pA = normalizeId(pair.substanceA);
    const pB = normalizeId(pair.substanceB);
    if ((matchIds(pA, aNorm) && matchIds(pB, bNorm)) || (matchIds(pA, bNorm) && matchIds(pB, aNorm))) {
      results.push({
        a: pair.substanceA, aName: getSubstanceName(pair.substanceA),
        b: pair.substanceB, bName: getSubstanceName(pair.substanceB),
        mechanism: pair.mechanism, type: pair.synergyType as 'synergy' | 'conflict' | 'caution',
        severity: 'MEDIUM',
      });
    }
  }

  for (const inter of ALL_INTERACTIONS) {
    const iA = normalizeId(inter.substanceA);
    const iB = normalizeId(inter.substanceB);
    if ((matchIds(iA, aNorm) && matchIds(iB, bNorm)) || (matchIds(iA, bNorm) && matchIds(iB, aNorm))) {
      const sevScore: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const existing = results.find(r =>
        normalizeId(r.a) === iA && normalizeId(r.b) === iB
      );
      if (!existing || sevScore[inter.severity] > sevScore[existing.severity]) {
        if (existing) {
          existing.mechanism = inter.effect;
          existing.type = inter.type;
          existing.severity = inter.severity;
        } else {
          results.push({
            a: inter.substanceA, aName: getSubstanceName(inter.substanceA),
            b: inter.substanceB, bName: getSubstanceName(inter.substanceB),
            mechanism: inter.effect, type: inter.type, severity: inter.severity,
          });
        }
      }
    }
  }

  return results;
}

/* ---------- Types ---------- */
export interface RankedEntry {
  id: string;
  name: string;
  incrementalCoverage: number;
  totalCoverage: number;
  systemsGained: string[];
  perSystemDelta: Record<string, number>;
}

export interface StackSnapshot {
  size: number;
  substanceIds: string[];
  substanceNames: string[];
  averageCoverage: number;
  systemCoverage: Record<string, number>;
  weakestSystem: string;
  weakestCoverage: number;
}

export interface PerSubstanceCoverage {
  id: string;
  name: string;
  systems: Record<string, number>;
  categories: string[];
}

export interface StackResult {
  rankedSubstances: RankedEntry[];
  stackBySize: Record<number, StackSnapshot>;
  systemCoverage: Record<string, number>;
  perSubstance: PerSubstanceCoverage[];
  synergiesInStack: StackSynergyInfo[];
  conflictsInStack: StackSynergyInfo[];
}

/* ---------- Stack Optimizer ---------- */
export function optimizeStack(
  availableIds: string[],
  targets?: Partial<Record<string, number>>,
): StackResult {
  const uniqueIds = [...new Set(availableIds)].filter(Boolean);
  const systemNames = [...RISK_SYSTEMS_8];

  const defaultTargets: Record<string, number> = {};
  for (const s of systemNames) defaultTargets[s] = 1.0;

  const tgt = targets ?? defaultTargets;

  const coverageCache = new Map<string, Record<string, number>>();
  const namesCache = new Map<string, string>();
  const idToName = new Map<string, string>();

  for (const id of uniqueIds) {
    if (!coverageCache.has(id)) coverageCache.set(id, deriveSystemCoverage(id));
    if (!namesCache.has(id)) namesCache.set(id, getSubstanceName(id));
    idToName.set(id, getSubstanceName(id));
  }

  const selected: string[] = [];
  const selectedSet = new Set<string>();
  const runningCoverage: Record<string, number> = {};
  for (const s of systemNames) runningCoverage[s] = 0;

  const ranked: RankedEntry[] = [];
  const stackBySize: Record<number, StackSnapshot> = {};

  const remaining = [...uniqueIds];
  let previousTotal = 0;

  const maxSteps = Math.min(uniqueIds.length, 50);

  for (let step = 0; step < maxSteps; step++) {
    let bestId: string | null = null;
    let bestDelta = -1;
    let bestSystemsGained: string[] = [];
    let bestPerSystemDelta: Record<string, number> = {};

    for (const id of remaining) {
      if (selectedSet.has(id)) continue;
      const cov = coverageCache.get(id)!;
      const weakestSystem = systemNames.reduce((a, b) =>
        runningCoverage[a] < runningCoverage[b] ? a : b
      );
      const weakestTarget = tgt[weakestSystem] ?? 1.0;
      const weakestGap = weakestTarget - runningCoverage[weakestSystem];

      let minSysCov = 1;
      for (const s of systemNames) {
        if (cov[s] > 0) {
          minSysCov = Math.min(minSysCov, runningCoverage[s] + cov[s] * 0.5);
        }
      }
      const improvement = 1 - minSysCov;

      let synergies = 0;
      let conflicts = 0;
      for (const sel of selected) {
        const interactions = findInteractionsBetween(sel, id);
        for (const inter of interactions) {
          if (inter.type === 'synergy') synergies += 0.1;
          else if (inter.type === 'conflict') conflicts += 0.3;
          else if (inter.type === 'caution') conflicts += 0.15;
        }
      }

      const delta = improvement * (1 + synergies) * (1 - conflicts);

      if (delta > bestDelta) {
        bestDelta = delta;
        bestId = id;
        const perSys: Record<string, number> = {};
        for (const s of systemNames) {
          perSys[s] = Math.min(tgt[s] ?? 1, runningCoverage[s] + cov[s]) - runningCoverage[s];
        }
        bestPerSystemDelta = perSys;

        bestSystemsGained = systemNames.filter(s => {
          const target = tgt[s] ?? 1;
          return (cov[s] ?? 0) > 0 && runningCoverage[s] < target;
        });
      }
    }

    if (!bestId) break;

    selected.push(bestId);
    selectedSet.add(bestId);

    const bestCov = coverageCache.get(bestId)!;
    let totalDelta = 0;
    for (const s of systemNames) {
      const target = tgt[s] ?? 1;
      const increment = Math.min(target - runningCoverage[s], bestCov[s] ?? 0);
      runningCoverage[s] += Math.max(0, increment);
      totalDelta += increment;
    }
    const avgDelta = totalDelta / systemNames.length;
    previousTotal += avgDelta;

    const weakestSys = systemNames.reduce((a, b) =>
      runningCoverage[a] < runningCoverage[b] ? a : b
    );

    ranked.push({
      id: bestId,
      name: namesCache.get(bestId) ?? bestId,
      incrementalCoverage: Math.round(avgDelta * 100) / 100,
      totalCoverage: Math.round(previousTotal * 100) / 100,
      systemsGained: bestSystemsGained,
      perSystemDelta: bestPerSystemDelta,
    });

    const sysCov: Record<string, number> = {};
    for (const s of systemNames) {
      sysCov[s] = Math.round(runningCoverage[s] * 100) / 100;
    }

    const size = selected.length;
    if ([2, 4, 6, 10, 15, 20, 25, 30, 35, 40, 50].includes(size) || size === maxSteps || avgDelta < 0.01) {
      stackBySize[size] = {
        size,
        substanceIds: [...selected],
        substanceNames: selected.map(id => namesCache.get(id) ?? id),
        averageCoverage: Math.round(previousTotal * 100) / 100,
        systemCoverage: sysCov,
        weakestSystem: weakestSys,
        weakestCoverage: Math.round(runningCoverage[weakestSys] * 100) / 100,
      };
    }

    const idx = remaining.indexOf(bestId);
    if (idx >= 0) remaining.splice(idx, 1);

    if (avgDelta < 0.005) break;
  }

  const finalSysCov: Record<string, number> = {};
  for (const s of systemNames) {
    finalSysCov[s] = Math.round(runningCoverage[s] * 100) / 100;
  }

  const perSub: PerSubstanceCoverage[] = selected.map(id => ({
    id,
    name: namesCache.get(id) ?? id,
    systems: coverageCache.get(id) ?? {},
    categories: getSubstanceCategories(id),
  }));

  const synergiesInStack: StackSynergyInfo[] = [];
  const conflictsInStack: StackSynergyInfo[] = [];

  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const interactions = findInteractionsBetween(selected[i], selected[j]);
      for (const inter of interactions) {
        if (inter.type === 'synergy') {
          synergiesInStack.push(inter);
        } else {
          conflictsInStack.push(inter);
        }
      }
    }
  }

  const finalRanked = ranked.map(r => ({
    ...r,
    incrementalCoverage: Math.round(r.incrementalCoverage * 100) / 100,
    totalCoverage: Math.round(r.totalCoverage * 100) / 100,
  }));

  return {
    rankedSubstances: finalRanked,
    stackBySize,
    systemCoverage: finalSysCov,
    perSubstance: perSub,
    synergiesInStack,
    conflictsInStack,
  };
}

/* ---------- Generate text description for UI ---------- */
export function describeStack(result: StackResult, targetSizes: number[] = [2, 4, 6, 10, 15, 20, 30]): string {
  const lines: string[] = [];
  lines.push('=== ОПТИМИЗАЦИЯ СТЕКА ПОДДЕРЖКЫ ===');
  lines.push('');

  for (const size of targetSizes) {
    const snap = result.stackBySize[size];
    if (!snap) continue;
    const pct = Math.round(snap.averageCoverage * 100);
    lines.push(`  ${size} препаратов: ${pct}% покрытия`);
    lines.push(`    Состав: ${snap.substanceNames.join(', ')}`);
    lines.push(`    Слабая зона: ${snap.weakestSystem} (${Math.round(snap.weakestCoverage * 100)}%)`);
    lines.push('');
  }

  const allSizes = Object.keys(result.stackBySize).map(Number).sort((a, b) => a - b);
  if (allSizes.length > 0) {
    const max = allSizes[allSizes.length - 1];
    const maxSnap = result.stackBySize[max];
    lines.push(`=== МАКСИМАЛЬНЫЙ СТЕК (${max} препаратов) ===`);
    lines.push(`  Общее покрытие: ${Math.round(maxSnap.averageCoverage * 100)}%`);
    for (const sys of RISK_SYSTEMS_8) {
      const cov = (maxSnap.systemCoverage[sys] ?? 0) * 100;
      const bar = '█'.repeat(Math.round(cov / 5));
      const empty = '░'.repeat(20 - Math.round(cov / 5));
      lines.push(`  ${sys.padEnd(15)} ${bar}${empty} ${Math.round(cov)}%`);
    }
  }

  if (result.synergiesInStack.length > 0) {
    lines.push('');
    lines.push(`=== СИНЕРГИИ В СТЕКЕ (${result.synergiesInStack.length}) ===`);
    for (const s of result.synergiesInStack.slice(0, 10)) {
      lines.push(`  ${s.aName} ⊕ ${s.bName}: ${s.mechanism}`);
    }
    if (result.synergiesInStack.length > 10) {
      lines.push(`  ...и ещё ${result.synergiesInStack.length - 10}`);
    }
  }

  if (result.conflictsInStack.length > 0) {
    lines.push('');
    lines.push(`=== КОНФЛИКТЫ/ОСТОРОЖНОСТЬ В СТЕКЕ (${result.conflictsInStack.length}) ===`);
    for (const c of result.conflictsInStack) {
      const sep = c.separationGap ? ` (разнести на ${c.separationGap}ч)` : '';
      lines.push(`  ${c.aName} ⊖ ${c.bName}: ${c.mechanism}${sep}`);
    }
  }

  return lines.join('\n');
}
