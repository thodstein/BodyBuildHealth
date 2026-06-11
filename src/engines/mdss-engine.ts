// ============================================================
// MDSS — Medical Decision Support System v1.0
// Hill + Monte Carlo + Logistic Sigmoid Pipeline
// ============================================================

export interface BiomarkerInput {
  name: string;
  value: number;
  ec50: number;
  isInverted?: boolean;
}

export interface OrganRiskResult {
  organName: string;
  markersUsed: string[];
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
  genetics: string[];
  markers: BiomarkerInput[];
}

export interface MDSSOutput {
  patientExposureWeeks: number;
  organSystemsReport: Record<string, OrganRiskResult>;
  overallMaxRisk: number;
  overallAlertLevel: number;
}

// ── Clinical Database ──
interface OrganConfig {
  name: string;
  linkedMarkers: string[];
  kAggression: number;
  zCrit: number;
  genetics: Record<string, number>;
}

const CLINICAL_DB: Record<string, OrganConfig> = {
  renal_fsgs: {
    name: 'Фокальный сегментарный гломерулосклероз (Почки)',
    linkedMarkers: ['KIM-1', 'Cystatin_C', 'Nephrin', 'UACR', 'Creatinine'],
    kAggression: 0.4, zCrit: 12.0,
    genetics: { 'APOL1_mutation': 1.8, 'ACE_DD': 1.2 },
  },
  hepatic_cholestasis: {
    name: 'Токсический гепатит и Холестаз (Печень)',
    linkedMarkers: ['CK-18', 'GLDH', 'GGT', 'Bile_Acids', 'ALT', 'AST'],
    kAggression: 0.6, zCrit: 6.0,
    genetics: { 'UGT2B17_deletion': 2.0, 'CYP3A4_slow': 1.5 },
  },
  cardiac_fibrosis: {
    name: 'Фиброз миокарда и ГЛЖ (Сердце)',
    linkedMarkers: ['Galectin-3', 'NT-proBNP', 'ADMA', 'oxLDL', 'hs-CRP'],
    kAggression: 0.2, zCrit: 24.0,
    genetics: { 'ApoE4': 1.4, 'MTHFR_mutation': 1.3 },
  },
  cns_neurotoxicity: {
    name: 'Токсическая энцефалопатия (ЦНС)',
    linkedMarkers: ['Cortisol_night', 'HVA', 'Prolactin'],
    kAggression: 0.5, zCrit: 8.0,
    genetics: { 'COMT_slow': 1.7, 'MAOA_mutation': 1.5 },
  },
  hpta_suppression: {
    name: 'Тотальная супрессия Оси HPTA (Эндокринная система)',
    linkedMarkers: ['Inhibin_B', 'SHBG', 'LH', 'FSH'],
    kAggression: 0.3, zCrit: 10.0,
    genetics: { 'AR_CAG_short': 1.3 },
  },
  prostate_hyperplasia: {
    name: 'Гиперплазия предстательной железы',
    linkedMarkers: ['PSA', 'DHT'],
    kAggression: 0.15, zCrit: 30.0,
    genetics: { 'AR_CAG_short': 1.6 },
  },
};

// ── Step 1: Hill Function ──
function hillScore(x: number, ec50: number, isInverted: boolean): number {
  if (x <= 0 || ec50 <= 0) return 0;
  const n = 2.0;
  const xn = Math.pow(x, n);
  const ec50n = Math.pow(ec50, n);
  if (isInverted) {
    return ec50n / (ec50n + xn);
  }
  return xn / (ec50n + xn);
}

// ── Step 2: Monte Carlo ──
function monteCarlo(hillVal: number, iterations: number = 10000): number {
  const noise = 0.15;
  const simulations = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    // Box-Muller for normal distribution
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    let s = hillVal + z * noise;
    s = Math.max(0, Math.min(1.2, s));
    simulations[i] = s;
  }
  simulations.sort((a, b) => a - b);
  return simulations[Math.floor(iterations * 0.95)];
}

// ── Step 3: Logistic Sigmoid ──
function logisticRisk(zTotal: number, kAggression: number): number {
  // Overflow Guard
  const arg = -kAggression * (zTotal - 6.0);
  if (arg > 50) return 0;
  if (arg < -50) return 100;
  return 100 / (1 + Math.exp(arg));
}

// ── Risk Stratification ──
function stratify(riskPct: number): { status: string; alertLevel: number } {
  if (riskPct < 20) return { status: 'ЗЕЛЕНАЯ ЗОНА (Безопасно)', alertLevel: 0 };
  if (riskPct < 50) return { status: 'ЖЕЛТАЯ ЗОНА (Субкомпенсация)', alertLevel: 1 };
  if (riskPct < 80) return { status: 'ОРАНЖЕВАЯ ЗОНА (Начало разрушения)', alertLevel: 2 };
  return { status: 'КРАСНАЯ ЗОНА (Критический порог. Необходима отмена!)', alertLevel: 3 };
}

// ── Genetic Factor ──
function calcGeneticFactor(organKey: string, patientGenetics: string[]): number {
  const config = CLINICAL_DB[organKey];
  if (!config) return 1.0;
  let factor = 1.0;
  for (const gene of patientGenetics) {
    if (config.genetics[gene]) {
      factor *= config.genetics[gene];
    }
  }
  return factor;
}

// ── Main Pipeline ──
export function runMDSS(input: MDSSInput): MDSSOutput {
  const tWeeks = Math.max(0, input.tWeeks);
  const report: Record<string, OrganRiskResult> = {};
  let overallMax = 0;
  let overallAlert = 0;

  for (const [organKey, config] of Object.entries(CLINICAL_DB)) {
    // Find matching markers
    const matchedMarkers = input.markers.filter(m =>
      config.linkedMarkers.includes(m.name)
    );
    if (matchedMarkers.length === 0) continue;

    // Step 1: Hill scores — take worst
    let maxHill = 0;
    for (const m of matchedMarkers) {
      const hs = hillScore(m.value, m.ec50, m.isInverted ?? false);
      if (hs > maxHill) maxHill = hs;
    }

    // Step 2: Monte Carlo — 95th percentile
    const severity95 = monteCarlo(maxHill);

    // Genetic multiplier
    const genFactor = calcGeneticFactor(organKey, input.genetics);

    // Step 3: Cumulative damage + Sigmoid
    const zTotal = severity95 * tWeeks * genFactor;
    const riskPct = logisticRisk(zTotal, config.kAggression);
    const { status, alertLevel } = stratify(riskPct);

    const result: OrganRiskResult = {
      organName: config.name,
      markersUsed: matchedMarkers.map(m => m.name),
      hillScore: maxHill,
      severity95,
      zTotal,
      riskPercentage: Math.round(riskPct * 10) / 10,
      status,
      alertLevel,
      geneticFactor: genFactor,
    };

    report[organKey] = result;
    if (riskPct > overallMax) overallMax = riskPct;
    if (alertLevel > overallAlert) overallAlert = alertLevel;
  }

  return {
    patientExposureWeeks: tWeeks,
    organSystemsReport: report,
    overallMaxRisk: Math.round(overallMax * 10) / 10,
    overallAlertLevel: overallAlert,
  };
}
