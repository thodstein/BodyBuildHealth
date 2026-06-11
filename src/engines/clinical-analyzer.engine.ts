/**
 * Clinical Pathology Analyzer — Integration Engine
 *
 * Connects clinical-pathology-db.ts with existing drug-mapper.engine.ts.
 * Runs Hill + Monte Carlo + Sigmoid pipeline on the expanded 28-pathology database.
 *
 * Used by: PharmaScreen mapper tab, RiskScreen clinical subtab
 *
 * @module clinical-analyzer-engine
 */

import {
  CLINICAL_PATHOLOGIES, CLINICAL_MARKERS, COMPOUND_RISK_MAP, SYSTEM_GROUPS,
  type ClinicalPathology, type CompoundRiskMapping,
} from '../data/clinical-pathology-db';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface UserMarker {
  code: string;
  value: number;
}

export interface PathologyResult {
  pathologyId: string;
  pathologyName: string;
  systemName: string;
  systemIcon: string;
  hillScore: number;
  severity95: number;
  riskPercent: number;
  status: string;
  alertLevel: number; // 0-3
  markersUsed: string[];
  pharmaTriggers: string[];
  instrumental: string;
  contributingCompounds: string[];
}

export interface ClinicalAnalysisInput {
  compounds: string[];       // drug names from user's course
  markers: UserMarker[];     // lab values from user
  tWeeks: number;            // weeks on cycle
  weeksSinceLab: number;     // compliance penalty
  genetics: string[];        // patient genetics
}

export interface ClinicalAnalysisOutput {
  results: PathologyResult[];
  systems: {
    systemKey: string;
    systemName: string;
    icon: string;
    maxRisk: number;
    pathologies: PathologyResult[];
  }[];
  overallMaxRisk: number;
  requiredLabPanel: string[];
  requiredInstrumental: string[];
  markersAnalyzed: number;
  markersMissing: string[];
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Hill function
// ═══════════════════════════════════════════════════════════════════════════

function hillScore(value: number, ec50: number, inverted: boolean): number {
  const x2 = value * value;
  const e2 = ec50 * ec50;
  return inverted ? e2 / (x2 + e2) : x2 / (e2 + x2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Box-Muller normal noise
// ═══════════════════════════════════════════════════════════════════════════

function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function monteCarlo95(hillVal: number, iterations = 10000): number {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(Math.max(0, Math.min(1.2, hillVal + boxMuller() * 0.15)));
  }
  results.sort((a, b) => a - b);
  return results[Math.floor(iterations * 0.95)];
}

// ═══════════════════════════════════════════════════════════════════════════
// Sigmoid
// ═══════════════════════════════════════════════════════════════════════════

function logisticRisk(zTotal: number, k: number, zCrit: number): number {
  const exp = -k * (zTotal - zCrit);
  if (exp > 50) return 100;
  if (exp < -50) return 0;
  return 100 / (1 + Math.exp(exp));
}

function stratify(pct: number): { status: string; alertLevel: number } {
  if (pct >= 80) return { status: 'КРАСНАЯ ЗОНА — Немедленное вмешательство', alertLevel: 3 };
  if (pct >= 50) return { status: 'ОРАНЖЕВАЯ ЗОНА — Повышенный риск', alertLevel: 2 };
  if (pct >= 20) return { status: 'ЖЁЛТАЯ ЗОНА — Мониторинг', alertLevel: 1 };
  return { status: 'ЗЕЛЁНАЯ ЗОНА — Низкий риск', alertLevel: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Compound name normalization (match PHARMA_DB → COMPOUND_RISK_MAP)
// ═══════════════════════════════════════════════════════════════════════════

function normalizeCompoundName(name: string): string {
  const n = name.toLowerCase().trim();
  // Direct matches in COMPOUND_RISK_MAP
  if (COMPOUND_RISK_MAP[n]) return n;
  // PHARMA_DB ester IDs → generic names
  if (n.includes('test')) return 'testosterone';
  if (n.includes('tren')) return 'trenbolone';
  if (n === 'npp' || n === 'deca' || n.includes('nandrolone')) return 'nandrolone';
  if (n.includes('bold') || n === 'eq') return 'boldenone';
  if (n.includes('drostanolone') || n.includes('masteron')) return 'masteron';
  if (n.includes('prim') || n.includes('methenolone')) return 'masteron'; // closest match
  if (n === 'methand' || n.includes('dianabol') || n === 'dbol' || n === 'trena' || n.includes('turinabol')) return 'dianabol';
  if (n.includes('stan') || n.includes('winstrol')) return 'stanozolol';
  if (n.includes('oxan') || n.includes('anavar')) return 'oxandrolone';
  if (n.includes('anadrol') || n.includes('oxymetholone')) return 'dianabol'; // closest
  if (n === 'halo' || n.includes('halotestin') || n.includes('fluoxymesterone')) return 'halotestin';
  if (n === 'superdrol' || n.includes('methyltrien') || n.includes('metribolone')) return 'methyltrienolone';
  if (n.includes('proviron') || n.includes('mesterolone')) return 'masteron';
  if (n.includes('hgh') || n.includes('growth') || n.includes('somatropin')) return 'growth_hormone';
  if (n.includes('insulin') || n.startsWith('ins_')) return 'insulin';
  if (n.includes('ghrp') || n.includes('hexarelin') || n.includes('ipamorelin')) return 'peptides_ghrp';
  if (n.includes('cjc') || n.includes('sermorelin') || n.includes('tesamorelin') || n.includes('mk677')) return 'peptides_ghrh';
  if (n.includes('igf')) return 'igf1';
  // SARMs → no clinical mapping, skip
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Analysis Pipeline
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeClinicalRisks(input: ClinicalAnalysisInput): ClinicalAnalysisOutput {
  const results: PathologyResult[] = [];
  const allMarkerCodes = new Set(input.markers.map(m => m.code));
  const markerValueMap = new Map(input.markers.map(m => [m.code, m.value]));

  // Collect required panels from user's compounds
  const requiredLab = new Set<string>();
  const requiredInst = new Set<string>();
  const normalizedCompounds = input.compounds.map(normalizeCompoundName).filter(n => COMPOUND_RISK_MAP[n]);

  for (const c of normalizedCompounds) {
    const map = COMPOUND_RISK_MAP[c];
    if (map) {
      map.labPanel.forEach(l => requiredLab.add(l));
      map.instrumentalPanel.forEach(i => requiredInst.add(i));
    }
  }

  // Analyze each pathology
  for (const [id, pathology] of Object.entries(CLINICAL_PATHOLOGIES)) {
    // Find which markers the user has for this pathology
    const userMarkers: { code: string; value: number }[] = [];
    for (const mc of pathology.linkedMarkers) {
      const val = markerValueMap.get(mc);
      if (val !== undefined) userMarkers.push({ code: mc, value: val });
    }

    if (userMarkers.length === 0) continue;

    // Hill scores for all matched markers
    const hillScores: number[] = [];
    for (const m of userMarkers) {
      const markerDef = CLINICAL_MARKERS[m.code];
      if (!markerDef) continue;
      hillScores.push(hillScore(m.value, markerDef.ec50, markerDef.isInverted));
    }

    if (hillScores.length === 0) continue;

    // Worst-case Hill
    const maxHill = Math.max(...hillScores);

    // Monte Carlo 95th
    const sev95 = monteCarlo95(maxHill);

    // Genetic factor
    let genFactor = 1.0;
    for (const g of input.genetics) {
      const gf = pathology.genetics[g];
      if (gf) genFactor = Math.max(genFactor, gf);
    }

    // Compliance penalty
    const compliancePenalty = input.weeksSinceLab > 4
      ? Math.min(3.0, 1.0 + (input.weeksSinceLab - 4) * 0.15)
      : 1.0;

    // Z_total
    const zTotal = sev95 * Math.max(1, input.tWeeks) * genFactor * compliancePenalty;

    // Sigmoid
    const riskPct = logisticRisk(zTotal, pathology.kAggression, pathology.zCrit);
    const { status, alertLevel } = stratify(riskPct);

    // Which user compounds trigger this pathology
    const contributingCompounds = normalizedCompounds.filter(c => {
      const map = COMPOUND_RISK_MAP[c];
      return map?.riskIds.includes(id);
    });

    results.push({
      pathologyId: id,
      pathologyName: pathology.name,
      systemName: pathology.systemName,
      systemIcon: pathology.systemIcon,
      hillScore: Math.round(maxHill * 100) / 100,
      severity95: Math.round(sev95 * 100) / 100,
      riskPercent: Math.round(riskPct * 10) / 10,
      status,
      alertLevel,
      markersUsed: userMarkers.map(m => m.code),
      pharmaTriggers: pathology.pharmaTriggers,
      instrumental: pathology.instrumentalVerification,
      contributingCompounds,
    });
  }

  // Sort by risk
  results.sort((a, b) => b.riskPercent - a.riskPercent);

  // ── Add drug-only pathologies (from compound mapping, no lab markers needed) ──
  const seenPathologyIds = new Set(results.map(r => r.pathologyId));
  const compliancePenalty = input.weeksSinceLab > 4
    ? Math.min(3.0, 1.0 + (input.weeksSinceLab - 4) * 0.15)
    : 1.0;

  for (const compoundName of normalizedCompounds) {
    const riskMap = COMPOUND_RISK_MAP[compoundName];
    if (!riskMap) continue;

    for (const riskId of riskMap.riskIds) {
      if (seenPathologyIds.has(riskId)) continue;
      seenPathologyIds.add(riskId);

      const pathology = CLINICAL_PATHOLOGIES[riskId];
      if (!pathology) continue;

      // Estimate risk from drug exposure only
      const baseRisk = Math.min(40, Math.max(10, (15 / pathology.zCrit) * 50));
      const exposureMod = Math.min(1.5, 1 + (input.tWeeks - 4) * 0.02);
      const drugRisk = Math.min(95, Math.round(baseRisk * exposureMod * compliancePenalty * 10) / 10);

      const { status, alertLevel } = stratify(drugRisk);

      results.push({
        pathologyId: riskId,
        pathologyName: pathology.name,
        systemName: pathology.systemName,
        systemIcon: pathology.systemIcon,
        hillScore: 0,
        severity95: 0,
        riskPercent: drugRisk,
        status,
        alertLevel,
        markersUsed: [],
        pharmaTriggers: pathology.pharmaTriggers,
        instrumental: pathology.instrumentalVerification,
        contributingCompounds: [compoundName],
      });
    }
  }

  // Re-sort after adding drug-only pathologies
  results.sort((a, b) => b.riskPercent - a.riskPercent);

  // Group by system
  const systemMap = new Map<string, PathologyResult[]>();
  for (const r of results) {
    const sysKey = SYSTEM_GROUPS.find(g => g.pathologyIds.includes(r.pathologyId))?.systemKey || 'other';
    if (!systemMap.has(sysKey)) systemMap.set(sysKey, []);
    systemMap.get(sysKey)!.push(r);
  }

  const systems = SYSTEM_GROUPS.map(g => ({
    systemKey: g.systemKey,
    systemName: g.systemName,
    icon: g.icon,
    maxRisk: Math.max(0, ...(systemMap.get(g.systemKey) || []).map(r => r.riskPercent)),
    pathologies: systemMap.get(g.systemKey) || [],
  })).filter(s => s.pathologies.length > 0);

  // Markers missing (in DB but not in user's labs)
  const allLabMarkers = new Set<string>();
  for (const [, p] of Object.entries(CLINICAL_PATHOLOGIES)) {
    p.linkedMarkers.forEach(m => allLabMarkers.add(m));
  }
  const markersMissing = [...allLabMarkers].filter(m => !allMarkerCodes.has(m)).sort();

  // Summary
  const criticalCount = results.filter(r => r.alertLevel >= 3).length;
  const highCount = results.filter(r => r.alertLevel === 2).length;
  const drugOnlyCount = results.filter(r => r.markersUsed.length === 0).length;
  const summary = criticalCount > 0
    ? `🔴 ${criticalCount} критических рисков, ${highCount} повышенных. ${drugOnlyCount > 0 ? `${drugOnlyCount} — оценка по препаратам (без анализов).` : ''} Требуется внимание.`
    : highCount > 0
      ? `🟡 ${highCount} повышенных рисков. ${drugOnlyCount > 0 ? `${drugOnlyCount} — по препаратам.` : ''} Рекомендуется коррекция.`
      : drugOnlyCount > 0
        ? `📋 ${drugOnlyCount} патологий оценено по препаратам. Сдайте анализы для точного прогноза.`
        : `✅ Все показатели в норме.`;

  return {
    results,
    systems,
    overallMaxRisk: results.length > 0 ? results[0].riskPercent : 0,
    requiredLabPanel: [...requiredLab].sort(),
    requiredInstrumental: [...requiredInst].sort(),
    markersAnalyzed: new Set(results.flatMap(r => r.markersUsed)).size,
    markersMissing,
    summary,
  };
}
