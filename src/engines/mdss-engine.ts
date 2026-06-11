/**
 * MDSS — Medical Decision Support System v2.0
 * Hill + Monte Carlo + Logistic Sigmoid Pipeline
 *
 * v2.0 CHANGES:
 *  - 14 organ systems (was 6): +vascular, +metabolic, +musculoskeletal,
 *    +thyroid, +skin, +immunity, +hematologic, +reproductive
 *  - Monte Carlo now uses ALL matching biomarkers per organ, not just worst
 *  - Compliance penalty baked into Z_total via weeksSinceLab multiplier
 *  - Organ report auto-sorted: worst organ first
 *  - Drug impact tracking: which drugs drive which organ risk
 *
 * @module mdss-engine
 */

// ── Types ──

export interface BiomarkerInput {
  name: string;
  value: number;
  ec50: number;
  isInverted?: boolean;
}

export interface OrganRiskResult {
  organKey: string;
  organName: string;
  markersUsed: string[];
  allHillScores: number[];
  hillScore: number;
  severity95: number;
  zTotal: number;
  riskPercentage: number;
  status: string;
  alertLevel: number;
  geneticFactor: number;
}

export interface MDSSInput {
  tWeeks: number;
  weeksSinceLab?: number;
  genetics: string[];
  markers: BiomarkerInput[];
}

export interface MDSSOutput {
  patientExposureWeeks: number;
  weeksSinceLastLab: number;
  compliancePenalty: number;
  organSystemsReport: Record<string, OrganRiskResult>;
  sortedOrgans: OrganRiskResult[];
  overallMaxRisk: number;
  overallAlertLevel: number;
  allMarkersUsed: string[];
  markersNotFound: string[];
}

// ── Organ Config ──

interface OrganConfig {
  name: string;
  linkedMarkers: string[];
  kAggression: number;
  zCrit: number;
  genetics: Record<string, number>;
}

const CLINICAL_DB: Record<string, OrganConfig> = {
  // ── 1. Почки (renal) ──
  renal: {
    name: 'Фокальный сегментарный гломерулосклероз (Почки)',
    linkedMarkers: ['KIM-1', 'Cystatin_C', 'Nephrin', 'UACR', 'Creatinine', 'eGFR', 'Microalbumin'],
    kAggression: 0.4, zCrit: 12.0,
    genetics: { 'APOL1_mutation': 1.8, 'ACE_DD': 1.2 },
  },

  // ── 2. Печень (hepatic) ──
  hepatic: {
    name: 'Токсический гепатит и холестаз (Печень)',
    linkedMarkers: ['CK-18', 'GLDH', 'GGT', 'Bile_Acids', 'ALT', 'AST', 'ALP', 'Bilirubin_Total', 'Bilirubin_Direct'],
    kAggression: 0.6, zCrit: 6.0,
    genetics: { 'UGT2B17_deletion': 2.0, 'CYP3A4_slow': 1.5, 'GSTT1_null': 1.4 },
  },

  // ── 3. Сердце (cardiac) ──
  cardiac: {
    name: 'Фиброз миокарда и кардиомиопатия (Сердце)',
    linkedMarkers: ['Galectin-3', 'NT-proBNP', 'Troponin_I', 'Troponin_T', 'ADMA', 'CK_MB'],
    kAggression: 0.25, zCrit: 20.0,
    genetics: { 'ApoE4': 1.4, 'MTHFR_mutation': 1.3, 'ACTN3_RR': 1.2 },
  },

  // ── 4. Сосуды (vascular) ──
  vascular: {
    name: 'Атеросклероз и эндотелиальная дисфункция (Сосуды)',
    linkedMarkers: ['ApoB', 'oxLDL', 'HDL', 'LDL', 'Lp_a', 'Cholesterol_Total', 'Triglycerides', 'ApoA1'],
    kAggression: 0.35, zCrit: 14.0,
    genetics: { 'ApoE4': 1.5, 'LDLR_mutation': 1.8, 'PCSK9_gain': 1.6 },
  },

  // ── 5. ЦНС (cns) ──
  cns: {
    name: 'Нейротоксичность и энцефалопатия (ЦНС)',
    linkedMarkers: ['Cortisol_night', 'HVA', 'Prolactin', 'BDNF', 'Serotonin', 'Dopamine', 'Cortisol'],
    kAggression: 0.55, zCrit: 7.0,
    genetics: { 'COMT_slow': 1.7, 'MAOA_mutation': 1.5, 'BDNF_val66met': 1.5 },
  },

  // ── 6. Эндокринная / HPTA ──
  endocrine: {
    name: 'Подавление оси HPTA (Эндокринная система)',
    linkedMarkers: ['LH', 'FSH', 'Testosterone_Total', 'Testosterone_Free', 'Prolactin', 'SHBG', 'Inhibin_B', 'DHEA_S'],
    kAggression: 0.3, zCrit: 12.0,
    genetics: { 'AR_CAG_short': 1.3, 'SHBG_rs1799941': 1.3 },
  },

  // ── 7. Кровь / гематология ──
  hematologic: {
    name: 'Эритроцитоз и гипервязкость крови',
    linkedMarkers: ['Hematocrit', 'Hemoglobin', 'Ferritin', 'EPO', 'RBC', 'Platelets'],
    kAggression: 0.3, zCrit: 15.0,
    genetics: { 'JAK2_V617F': 2.5, 'HFE_C282Y': 1.4 },
  },

  // ── 8. Иммунитет / воспаление ──
  immunity: {
    name: 'Системное воспаление и иммуносупрессия',
    linkedMarkers: ['hs-CRP', 'CRP', 'Homocysteine', 'ESR', 'WBC', 'Fibrinogen'],
    kAggression: 0.35, zCrit: 14.0,
    genetics: { 'IL6_174GC': 1.5, 'TNF_308A': 1.4 },
  },

  // ── 9. Метаболизм / инсулин ──
  metabolic: {
    name: 'Инсулинорезистентность и метаболический синдром',
    linkedMarkers: ['HOMA-IR', 'HbA1c', 'C-Peptide', 'Glucose', 'Insulin', 'Triglycerides'],
    kAggression: 0.4, zCrit: 10.0,
    genetics: { 'TCF7L2': 1.5, 'PPARG_Pro12Ala': 1.3, 'FTO': 1.2 },
  },

  // ── 10. GH/IGF ось ──
  ghigf: {
    name: 'Дисрегуляция оси GH/IGF-1',
    linkedMarkers: ['IGF-1', 'Glucose', 'Insulin', 'Cortisol'],
    kAggression: 0.3, zCrit: 14.0,
    genetics: { 'GHR_exon3': 1.3, 'IGF1_promoter': 1.2 },
  },

  // ── 11. Костно-мышечная ──
  musculoskeletal: {
    name: 'Десикация суставов и остеопороз (Костно-мышечная)',
    linkedMarkers: ['CTX', 'COMP', 'P1NP', 'Osteocalcin', 'Calcium', 'Vitamin_D', 'PTH'],
    kAggression: 0.3, zCrit: 16.0,
    genetics: { 'COL1A1': 1.4, 'VDR_TaqI': 1.3, 'LRP5': 1.2 },
  },

  // ── 12. Щитовидная ──
  thyroid: {
    name: 'Дисфункция щитовидной железы',
    linkedMarkers: ['TSH', 'T3_Free', 'T4_Free'],
    kAggression: 0.25, zCrit: 18.0,
    genetics: { 'TSHR': 1.3, 'DIO2': 1.2 },
  },

  // ── 13. Простата ──
  prostate: {
    name: 'Гиперплазия и карцинома простаты',
    linkedMarkers: ['PSA', 'PSA_Free', 'DHT', 'Testosterone_Total'],
    kAggression: 0.15, zCrit: 30.0,
    genetics: { 'AR_CAG_short': 1.6, 'SRD5A2_V89L': 1.3, 'BRCA2': 2.0 },
  },

  // ── 14. Кожа / андрогенные эффекты ──
  skin: {
    name: 'Андрогенная алопеция и акне (Кожа)',
    linkedMarkers: ['DHT', 'Testosterone_Total', 'SHBG', 'Zinc', 'Vitamin_D'],
    kAggression: 0.2, zCrit: 22.0,
    genetics: { 'AR_CAG_short': 1.5, 'SRD5A2_V89L': 1.4, 'AR_EDA2R': 1.3 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Hill function with n=2.0 */
function hillScore(x: number, ec50: number, isInverted = false): number {
  const xn = x * x;
  const en = ec50 * ec50;
  if (isInverted) return en / (xn + en);
  return xn / (en + xn);
}

/** Box-Muller normal noise generator */
function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Monte Carlo simulation — uses ALL biomarkers per organ.
 * Computes Hill scores for ALL matched markers, takes geometric mean,
 * adds 15% noise (σ=0.15) via Box-Muller, runs 10K iterations,
 * returns 95th percentile. Clamped [0, 1.2].
 */
function monteCarlo(hillScores: number[], iterations = 10000): number {
  if (hillScores.length === 0) return 0.05;
  // Geometric mean of all Hill scores
  const gmean = hillScores.length === 1
    ? hillScores[0]
    : Math.exp(hillScores.reduce((s, h) => s + Math.log(Math.max(0.001, h)), 0) / hillScores.length);

  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const noise = boxMuller() * 0.15;
    results.push(Math.max(0, Math.min(1.2, gmean + noise)));
  }
  results.sort((a, b) => a - b);
  return results[Math.floor(iterations * 0.95)];
}

/** Sigmoid with overflow guard */
function logisticRisk(zTotal: number, kAggression: number, zCrit: number): number {
  const exponent = -kAggression * (zTotal - zCrit);
  if (exponent > 50) return 100.0;
  if (exponent < -50) return 0.0;
  return 100.0 / (1.0 + Math.exp(exponent));
}

function stratify(riskPct: number): { status: string; alertLevel: number } {
  if (riskPct >= 80) return { status: 'КРАСНАЯ ЗОНА — Немедленное вмешательство', alertLevel: 3 };
  if (riskPct >= 50) return { status: 'ОРАНЖЕВАЯ ЗОНА — Повышенный риск', alertLevel: 2 };
  if (riskPct >= 20) return { status: 'ЖЁЛТАЯ ЗОНА — Мониторинг', alertLevel: 1 };
  return { status: 'ЗЕЛЁНАЯ ЗОНА — Низкий риск', alertLevel: 0 };
}

function calcGeneticFactor(organKey: string, patientGenetics: string[]): number {
  const config = CLINICAL_DB[organKey];
  if (!config || !config.genetics) return 1.0;
  let factor = 1.0;
  for (const g of patientGenetics) {
    const f = config.genetics[g];
    if (f) factor = Math.max(factor, f);
  }
  return factor;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE PENALTY
// ═══════════════════════════════════════════════════════════════════════════

function calcCompliancePenalty(weeksSinceLab: number): number {
  if (weeksSinceLab <= 4) return 1.0;
  return Math.min(3.0, 1.0 + (weeksSinceLab - 4) * 0.15);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

export function runMDSS(input: MDSSInput): MDSSOutput {
  const tWeeks = Math.max(0, input.tWeeks);
  const weeksSinceLab = Math.max(0, input.weeksSinceLab ?? 0);
  const compliancePenalty = calcCompliancePenalty(weeksSinceLab);

  const report: Record<string, OrganRiskResult> = {};
  const allUsed = new Set<string>();
  const allMarkerNames = new Set(input.markers.map(m => m.name));

  for (const [organKey, config] of Object.entries(CLINICAL_DB)) {
    // Match ALL markers for this organ
    const matched = input.markers.filter(m => config.linkedMarkers.includes(m.name));
    if (matched.length === 0) continue;

    // Step 1: Hill scores for ALL matched markers
    const allHillScores: number[] = matched.map(m =>
      hillScore(m.value, m.ec50, m.isInverted ?? false)
    );
    const worstHill = Math.max(...allHillScores);

    // Track used markers
    matched.forEach(m => allUsed.add(m.name));

    // Step 2: Monte Carlo over ALL Hill scores
    const sev95 = monteCarlo(allHillScores);

    // Genetic factor
    const genFactor = calcGeneticFactor(organKey, input.genetics);

    // Step 3: Z_total with compliance penalty
    const zTotal = sev95 * tWeeks * genFactor * compliancePenalty;

    // Step 4: Sigmoid
    const riskPct = logisticRisk(zTotal, config.kAggression, config.zCrit);
    const { status, alertLevel } = stratify(riskPct);

    report[organKey] = {
      organKey,
      organName: config.name,
      markersUsed: matched.map(m => m.name),
      allHillScores: allHillScores.map(h => Math.round(h * 100) / 100),
      hillScore: Math.round(worstHill * 100) / 100,
      severity95: Math.round(sev95 * 100) / 100,
      zTotal: Math.round(zTotal * 10) / 10,
      riskPercentage: Math.round(riskPct * 10) / 10,
      status,
      alertLevel,
      geneticFactor: genFactor,
    };
  }

  // Sort organs: worst first
  const sortedOrgans = Object.values(report).sort((a, b) => b.riskPercentage - a.riskPercentage);

  const overallMax = sortedOrgans.length > 0 ? sortedOrgans[0].riskPercentage : 0;
  const overallAlert = sortedOrgans.length > 0 ? sortedOrgans[0].alertLevel : 0;

  // Markers in CLINICAL_DB but not in user's labs
  const allKnownMarkers = new Set<string>();
  for (const c of Object.values(CLINICAL_DB)) {
    c.linkedMarkers.forEach(m => allKnownMarkers.add(m));
  }
  const markersNotFound = [...allKnownMarkers].filter(m => !allMarkerNames.has(m)).sort();

  return {
    patientExposureWeeks: tWeeks,
    weeksSinceLastLab: weeksSinceLab,
    compliancePenalty: Math.round(compliancePenalty * 100) / 100,
    organSystemsReport: report,
    sortedOrgans,
    overallMaxRisk: Math.round(overallMax * 10) / 10,
    overallAlertLevel: overallAlert,
    allMarkersUsed: [...allUsed].sort(),
    markersNotFound,
  };
}
