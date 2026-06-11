/**
 * Compliance & Uncertainty Engine — Penalty Module + Survival Sigmoid
 *
 * Tracks lab discipline. If labs are overdue (>4 weeks grace period),
 * applies a Penalty Multiplier to cumulative organ risk (Data Decay).
 *
 * Integrated with MDSS Hill + Monte Carlo + Logistic Sigmoid pipeline.
 * Runs entirely in-browser (Telegram Mini App / PWA).
 *
 * @module compliance-engine
 */

import { runMDSS, type MDSSInput, type MDSSOutput, type BiomarkerInput } from './mdss-engine';

// ═══════════════════════════════════════════════════════════════════════════
// Compliance Engine — Core
// ═══════════════════════════════════════════════════════════════════════════

/** Grace period in weeks — labs valid for 4 weeks after draw date */
const GRACE_PERIOD_WEEKS = 4.0;

/** Penalty rate per overdue week (15% increase per week) */
const PENALTY_RATE_PER_WEEK = 0.15;

/** Maximum penalty multiplier cap */
const MAX_PENALTY = 3.0;

// ── Input ──

export interface ComplianceInput {
  cycleStartDate: string; // ISO date 'YYYY-MM-DD'
  latestLabDate: string;  // ISO date 'YYYY-MM-DD'
  currentDate?: string;   // defaults to today
  genetics: string[];
  markers: BiomarkerInput[];
  kAggressionOverride?: number; // for testing
  zCritOverride?: number;       // for testing
}

// ── Output ──

export interface ComplianceWarning {
  disclaimer: string;
  penaltyStatus: string;
  weeksOnCycle: number;
  weeksSinceLastLab: number;
  complianceStatus: 'compliant' | 'overdue' | 'critical';
}

export interface ComplianceRiskAnalysis {
  penaltyMultiplierApplied: number;
  worstHillScore: number;
  severity95th: number;
  zTotalRaw: number;
  zTotalAdjusted: number;
  probabilityPercent: number;
  clinicalStatus: string;
  active19NorPenalty: boolean;
}

export interface ComplianceReport {
  systemWarnings: ComplianceWarning;
  riskAnalysis: ComplianceRiskAnalysis;
  organDetails: Record<string, {
    organName: string;
    hillScore: number;
    zTotalAdjusted: number;
    riskPercent: number;
    alertLevel: number;
    status: string;
    penaltyFactor: number;
  }>;
}

// ── Disclaimers ──

const DISCLAIMER_TEXT = (
  'ВАЖНО: Несоблюдение графика сдачи анализов (раз в 4 недели) делает расчет рисков ' +
  'некорректным. Расчет вероятности патологий производится на основании динамики ' +
  'маркеров. В случае несвоевременного заполнения данных, система переходит в режим ' +
  '"пессимистичного прогноза" и риски пересчитываются со штрафным коэффициентом ' +
  'неопределенности.'
);

// ═══════════════════════════════════════════════════════════════════════════
// Penalty Calculator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates the penalty multiplier based on lab freshness.
 *
 * Formula:
 *   weeks_since_lab <= 4.0 → multiplier = 1.0
 *   weeks_since_lab > 4.0  → multiplier = 1.0 + ((weeks_since_lab - 4.0) * 0.15)
 *   Capped at MAX_PENALTY (3.0x)
 *
 * @param weeksSinceLab - Weeks elapsed since the last lab draw.
 * @returns Penalty multiplier in range [1.0, MAX_PENALTY].
 */
export function calcPenaltyMultiplier(weeksSinceLab: number): number {
  if (weeksSinceLab <= GRACE_PERIOD_WEEKS) return 1.0;
  const raw = 1.0 + (weeksSinceLab - GRACE_PERIOD_WEEKS) * PENALTY_RATE_PER_WEEK;
  return Math.min(MAX_PENALTY, raw);
}

/**
 * Returns the compliance status label.
 */
export function getComplianceStatus(weeksSinceLab: number): 'compliant' | 'overdue' | 'critical' {
  if (weeksSinceLab <= GRACE_PERIOD_WEEKS) return 'compliant';
  if (weeksSinceLab <= 12) return 'overdue';
  return 'critical';
}

// ═══════════════════════════════════════════════════════════════════════════
// Survival Sigmoid — Overflow Guard
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Logistic sigmoid risk calculator with overflow protection.
 *
 * Formula: Risk (%) = 100 / (1 + exp(-k * (Z_total - Z_crit)))
 *
 * Overflow guard:
 *   If k*(Z-Zcrit) > 50  → risk = 100.0% (saturation)
 *   If k*(Z-Zcrit) < -50 → risk = 0.0%   (negligible)
 *
 * @param zTotal - Cumulative organ damage score.
 * @param kAggression - Aggression coefficient (organ-specific).
 * @param zCrit - Critical threshold.
 * @returns Risk percentage [0-100].
 */
export function survivalSigmoid(
  zTotal: number,
  kAggression: number = 0.4,
  zCrit: number = 12.0,
): number {
  const exponent = -kAggression * (zTotal - zCrit);

  // Overflow guard
  if (exponent > 50) return 100.0;
  if (exponent < -50) return 0.0;

  return 100.0 / (1.0 + Math.exp(exponent));
}

/**
 * Hill function for biomarker severity.
 * Formula: H(X) = X² / (EC50² + X²)
 * Inverted variant: H(X) = EC50² / (X² + EC50²)
 */
export function hillScore(value: number, ec50: number, inverted: boolean = false): number {
  const x2 = value * value;
  const ec2 = ec50 * ec50;
  if (inverted) {
    // Lower values → higher risk
    return ec2 / (x2 + ec2);
  }
  return x2 / (ec2 + x2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Clinical Status Classification
// ═══════════════════════════════════════════════════════════════════════════

export function classifyRisk(probability: number): { status: string; alertLevel: number } {
  if (probability >= 80) {
    return { status: 'КРАСНАЯ ЗОНА — Немедленное вмешательство', alertLevel: 3 };
  }
  if (probability >= 50) {
    return { status: 'ОРАНЖЕВАЯ ЗОНА — Повышенный риск', alertLevel: 2 };
  }
  if (probability >= 20) {
    return { status: 'ЖЁЛТАЯ ЗОНА — Мониторинг', alertLevel: 1 };
  }
  return { status: 'ЗЕЛЁНАЯ ЗОНА — Низкий риск', alertLevel: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Compliance Engine — Main Pipeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full compliance-aware risk analysis pipeline.
 *
 * Steps:
 *  1. Calculate weeks on cycle and weeks since last lab from dates.
 *  2. Compute penalty multiplier (0 if within grace period).
 *  3. Compute Hill scores for each biomarker → worst marker.
 *  4. Apply worst-case simulation (95th percentile, 15% upward noise).
 *  5. Z_total = severity95 * tWeeks * genFactor * penaltyMultiplier.
 *  6. Sigmoid → risk probability with overflow guard.
 *  7. Return compliance warnings + risk analysis.
 */
export function analyzeWithCompliance(input: ComplianceInput): ComplianceReport {
  // ── Step 1: Date arithmetic ──
  const now = input.currentDate ? new Date(input.currentDate + 'T12:00:00Z') : new Date();
  const cycleStart = new Date(input.cycleStartDate + 'T12:00:00Z');
  const lastLab = new Date(input.latestLabDate + 'T12:00:00Z');

  const msPerWeek = 7 * 24 * 3600 * 1000;
  const weeksOnCycle = Math.max(0, (now.getTime() - cycleStart.getTime()) / msPerWeek);
  const weeksSinceLab = Math.max(0, (now.getTime() - lastLab.getTime()) / msPerWeek);

  // ── Step 2: Penalty ──
  const penaltyMult = calcPenaltyMultiplier(weeksSinceLab);
  const compliance = getComplianceStatus(weeksSinceLab);

  // ── Compliance warning ──
  let penaltyStatus: string;
  if (penaltyMult <= 1.0) {
    penaltyStatus = 'Анализы актуальны. Штраф не применяется.';
  } else {
    const daysOverdue = Math.round((weeksSinceLab - GRACE_PERIOD_WEEKS) * 7);
    penaltyStatus =
      `[АКТИВНО] Применен штрафной коэффициент: ${penaltyMult.toFixed(2)}x ` +
      `из-за просрочки анализов на ${daysOverdue} дней.`;
  }

  const systemWarnings: ComplianceWarning = {
    disclaimer: DISCLAIMER_TEXT,
    penaltyStatus,
    weeksOnCycle: Math.round(weeksOnCycle * 10) / 10,
    weeksSinceLastLab: Math.round(weeksSinceLab * 10) / 10,
    complianceStatus: compliance,
  };

  // ── Step 3: Hill scores — worst marker ──
  let worstHill = 0;
  if (input.markers.length > 0) {
    for (const m of input.markers) {
      const hs = hillScore(m.value, m.ec50, m.isInverted ?? false);
      if (hs > worstHill) worstHill = hs;
    }
  }

  // ── Step 4: Worst-case 95th percentile (15% noise) ──
  const severity95 = worstHill * 1.15;

  // ── Step 5: Genetic factor ──
  let genFactor = 1.0;
  for (const g of input.genetics) {
    // Check all organ genetic factors from MDSS CLINICAL_DB
    for (const config of Object.values(CLINICAL_DB_REF)) {
      const gf = config.genetics[g];
      if (gf) genFactor = Math.max(genFactor, gf);
    }
  }

  // ── Step 6: Z_total with penalty ──
  const zRaw = severity95 * weeksOnCycle * genFactor;
  const zAdjusted = zRaw * penaltyMult;

  // ── Step 7: Sigmoid ──
  const k = input.kAggressionOverride ?? 0.4;
  const zCrit = input.zCritOverride ?? 12.0;
  const probability = survivalSigmoid(zAdjusted, k, zCrit);
  const { status: clinicalStatus } = classifyRisk(probability);

  // ── Step 8: Per-organ breakdown ──
  const organDetails: ComplianceReport['organDetails'] = {};
  for (const [organKey, config] of Object.entries(CLINICAL_DB_REF)) {
    const matchedMarkers = input.markers.filter(m => config.linkedMarkers.includes(m.name));
    if (matchedMarkers.length === 0) continue;

    let organHill = 0;
    for (const m of matchedMarkers) {
      const hs = hillScore(m.value, m.ec50, m.isInverted ?? false);
      if (hs > organHill) organHill = hs;
    }

    const organSev95 = organHill * 1.15;
    const organGen = calcOrganGeneticFactor(organKey, input.genetics);
    const organZ = organSev95 * weeksOnCycle * organGen * penaltyMult;
    const organRisk = survivalSigmoid(organZ, config.kAggression, config.zCrit);
    const { status, alertLevel } = classifyRisk(organRisk);

    organDetails[organKey] = {
      organName: config.name,
      hillScore: Math.round(organHill * 100) / 100,
      zTotalAdjusted: Math.round(organZ * 10) / 10,
      riskPercent: Math.round(organRisk * 10) / 10,
      alertLevel,
      status,
      penaltyFactor: penaltyMult,
    };
  }

  return {
    systemWarnings,
    riskAnalysis: {
      penaltyMultiplierApplied: Math.round(penaltyMult * 100) / 100,
      worstHillScore: Math.round(worstHill * 100) / 100,
      severity95th: Math.round(severity95 * 100) / 100,
      zTotalRaw: Math.round(zRaw * 10) / 10,
      zTotalAdjusted: Math.round(zAdjusted * 10) / 10,
      probabilityPercent: Math.round(probability * 10) / 10,
      clinicalStatus,
      active19NorPenalty: input.genetics.some(g => g.includes('19nor')),
    },
    organDetails,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Re-exported from MDSS for self-containment
// ═══════════════════════════════════════════════════════════════════════════

interface OrganConfig {
  name: string;
  linkedMarkers: string[];
  kAggression: number;
  zCrit: number;
  genetics: Record<string, number>;
}

const CLINICAL_DB_REF: Record<string, OrganConfig> = {
  // ── Kidney (common markers) ──
  renal: {
    name: 'Токсическая нефропатия (Почки)',
    linkedMarkers: ['Creatinine', 'Cystatin_C', 'eGFR', 'Urea', 'Uric_Acid', 'KIM-1', 'UACR'],
    kAggression: 0.4, zCrit: 12.0,
    genetics: { 'APOL1_mutation': 1.8, 'ACE_DD': 1.2 },
  },
  // ── Liver (common markers) ──
  hepatic: {
    name: 'Токсический гепатит (Печень)',
    linkedMarkers: ['ALT', 'AST', 'GGT', 'ALP', 'Bilirubin_Total', 'Bilirubin_Direct', 'Bile_Acids', 'CK-18'],
    kAggression: 0.6, zCrit: 6.0,
    genetics: { 'UGT2B17_deletion': 2.0, 'CYP3A4_slow': 1.5 },
  },
  // ── Heart (common markers) ──
  cardiac: {
    name: 'Кардиомиопатия (Сердце)',
    linkedMarkers: ['NT-proBNP', 'Troponin_I', 'CK-MB', 'Galectin-3', 'ADMA', 'hs-CRP'],
    kAggression: 0.25, zCrit: 20.0,
    genetics: { 'ApoE4': 1.4, 'MTHFR_mutation': 1.3 },
  },
  // ── Blood vessels / lipids ──
  vascular: {
    name: 'Атеросклероз и дислипидемия (Сосуды)',
    linkedMarkers: ['LDL', 'HDL', 'Triglycerides', 'ApoB', 'ApoA1', 'Cholesterol_Total', 'oxLDL'],
    kAggression: 0.35, zCrit: 14.0,
    genetics: { 'ApoE4': 1.5, 'LDLR_mutation': 1.6 },
  },
  // ── Blood / hematology ──
  hematologic: {
    name: 'Эритроцитоз и гипервязкость (Кровь)',
    linkedMarkers: ['Hematocrit', 'Hemoglobin', 'RBC', 'Ferritin', 'EPO', 'Platelets'],
    kAggression: 0.3, zCrit: 15.0,
    genetics: { 'JAK2_V617F': 2.5 },
  },
  // ── CNS ──
  cns: {
    name: 'Нейротоксичность (ЦНС)',
    linkedMarkers: ['Cortisol_night', 'Cortisol', 'Prolactin', 'HVA', 'Serotonin', 'Dopamine'],
    kAggression: 0.55, zCrit: 7.0,
    genetics: { 'COMT_slow': 1.7, 'MAOA_mutation': 1.5 },
  },
  // ── HPTA / Endocrine ──
  endocrine: {
    name: 'Подавление HPTA (Эндокринная)',
    linkedMarkers: ['LH', 'FSH', 'Testosterone_Total', 'Testosterone_Free', 'SHBG', 'Inhibin_B', 'Prolactin', 'DHEA_S'],
    kAggression: 0.3, zCrit: 12.0,
    genetics: { 'AR_CAG_short': 1.3, 'SHBG_rs1799941': 1.3 },
  },
  // ── Prostate ──
  prostate: {
    name: 'Гиперплазия простаты',
    linkedMarkers: ['PSA', 'PSA_Free', 'DHT'],
    kAggression: 0.15, zCrit: 30.0,
    genetics: { 'AR_CAG_short': 1.6, 'SRD5A2_V89L': 1.3 },
  },
  // ── Metabolism / Insulin ──
  metabolic: {
    name: 'Инсулинорезистентность (Метаболизм)',
    linkedMarkers: ['Glucose', 'HbA1c', 'HOMA-IR', 'Insulin', 'C-Peptide', 'Fructosamine'],
    kAggression: 0.4, zCrit: 10.0,
    genetics: { 'TCF7L2': 1.5 },
  },
  // ── Thyroid ──
  thyroid: {
    name: 'Гипотиреоз (Щитовидная)',
    linkedMarkers: ['TSH', 'T4_free', 'T3_free'],
    kAggression: 0.25, zCrit: 18.0,
    genetics: {},
  },
  // ── Immune / Inflammation ──
  immunity: {
    name: 'Системное воспаление (Иммунитет)',
    linkedMarkers: ['hs-CRP', 'CRP', 'Homocysteine', 'Fibrinogen', 'ESR'],
    kAggression: 0.35, zCrit: 14.0,
    genetics: {},
  },
  // ── Musculoskeletal ──
  musculoskeletal: {
    name: 'Десикация суставов (ОДА)',
    linkedMarkers: ['CTX', 'COMP', 'Calcium', 'Vitamin_D', 'PTH', 'Osteocalcin'],
    kAggression: 0.3, zCrit: 16.0,
    genetics: { 'COL1A1': 1.4 },
  },
};

function calcOrganGeneticFactor(organKey: string, genetics: string[]): number {
  const config = CLINICAL_DB_REF[organKey];
  if (!config) return 1.0;
  let maxFactor = 1.0;
  for (const g of genetics) {
    const factor = config.genetics[g];
    if (factor) maxFactor = Math.max(maxFactor, factor);
  }
  return maxFactor;
}
