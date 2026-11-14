// Lab Analysis Engine — interprets lab values into mechanisms, organs, systems, risks
import type { LabPoint } from '../core/types';
import {
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN, FEMALE_HORMONE_ULN,
} from './lab-norms.engine';

export interface LabInterpretation {
  code: string;
  value: number;
  status: 'low' | 'normal' | 'high' | 'critical_high';
  mechanism: string;
  organ: string;
  system: string;
  risk: string;
  riskPercent: number;
}

export interface LabCompositeResult {
  homaIR: number | null;
  liverStress: number;
  cardioRisk: number;
  inflammation: number;
  kidneyStress: number;
  hormoneScore: number;
  interpretations: LabInterpretation[];
}

export type RiskModelType = 'standard' | 'lab_weighted' | 'mechanism_driven' | 'pharma_integrated';

export const RISK_MODEL_LABELS: Record<RiskModelType, string> = {
  standard: '📊 Стандартная (базовые риски)',
  lab_weighted: '🧪 По анализам (лабораторный вес)',
  mechanism_driven: '🧬 Механистическая (анализ→механизм→риск)',
  pharma_integrated: '💊 Фарма-интегрированная (PK/PD + анализы)',
};

const REFERENCE_RANGES: Record<string, { low: number; high: number; criticalHigh: number; unit: string }> = {
  TESTOSTERONE_TOTAL: { low: 10, high: 35, criticalHigh: 52, unit: 'нмоль/л' },
  TESTOSTERONE_FREE: { low: 0.2, high: 0.6, criticalHigh: 0.9, unit: 'нмоль/л' },
  ESTRADIOL: { low: 10, high: 40, criticalHigh: 60, unit: 'пг/мл' },
  PROLACTIN: { low: 50, high: 350, criticalHigh: 500, unit: 'мЕд/л' },
  LH: { low: 1, high: 10, criticalHigh: 15, unit: 'МЕ/л' },
  FSH: { low: 1, high: 12, criticalHigh: 18, unit: 'МЕ/л' },
  TSH: { low: 0.4, high: 4.0, criticalHigh: 10, unit: 'мЕд/л' },
  T3: { low: 2.5, high: 6.5, criticalHigh: 8, unit: 'пмоль/л' },
  T4: { low: 10, high: 24, criticalHigh: 30, unit: 'пмоль/л' },
  FREE_T3: { low: 3.1, high: 6.8, criticalHigh: 9, unit: 'пмоль/л' },
  FREE_T4: { low: 9, high: 22, criticalHigh: 30, unit: 'пмоль/л' },
  ALT: { low: 5, high: 40, criticalHigh: 80, unit: 'Ед/л' },
  AST: { low: 5, high: 40, criticalHigh: 80, unit: 'Ед/л' },
  GGT: { low: 5, high: 55, criticalHigh: 110, unit: 'Ед/л' },
  BILIRUBIN: { low: 3, high: 20, criticalHigh: 35, unit: 'мкмоль/л' },
  CREATININE: { low: 60, high: 110, criticalHigh: 140, unit: 'мкмоль/л' },
  UREA: { low: 2.5, high: 8.3, criticalHigh: 12, unit: 'ммоль/л' },
  GLUCOSE: { low: 3.5, high: 6.1, criticalHigh: 7.0, unit: 'ммоль/л' },
  INSULIN: { low: 2, high: 10, criticalHigh: 15, unit: 'мкЕд/мл' },
  LDL: { low: 1.5, high: 3.0, criticalHigh: 4.9, unit: 'ммоль/л' },
  HDL: { low: 1.0, high: 2.0, criticalHigh: 2.5, unit: 'ммоль/л' },
  TRIGLYCERIDES: { low: 0.5, high: 1.7, criticalHigh: 2.3, unit: 'ммоль/л' },
  APOB: { low: 0.5, high: 1.0, criticalHigh: 1.3, unit: 'г/л' },
  CRP: { low: 0, high: 3, criticalHigh: 10, unit: 'мг/л' },
  FERRITIN: { low: 20, high: 300, criticalHigh: 500, unit: 'мкг/л' },
  HOMOCYSTEINE: { low: 5, high: 12, criticalHigh: 15, unit: 'мкмоль/л' },
  HEMOGLOBIN: { low: 130, high: 170, criticalHigh: 185, unit: 'г/л' },
  HEMATOCRIT: { low: 39, high: 50, criticalHigh: 54, unit: '%' },
  ERYTHROCYTES: { low: 4.2, high: 5.8, criticalHigh: 6.2, unit: '10^12/л' },
  LEUKOCYTES: { low: 4, high: 10, criticalHigh: 12, unit: '10^9/л' },
  THROMBOCYTES: { low: 150, high: 400, criticalHigh: 500, unit: '10^9/л' },
  POTASSIUM: { low: 3.5, high: 5.1, criticalHigh: 6.0, unit: 'ммоль/л' },
  SODIUM: { low: 135, high: 145, criticalHigh: 155, unit: 'ммоль/л' },
};

/**
 * ♀ Границы, которые у женщины отличаются от мужских. `interpretLabs` брал
 * мужской ряд для всех: женщина с АЛТ 35, ГГТ 40, HCT 49, гемоглобином 160,
 * креатинином 100, эстрадиолом 200 пг/мл или пролактином 600 мЕд/л читала
 * «норма», а тестостерон 1 нмоль/л давал ей «андрогенный дефицит».
 * Числа — из резолвера норм, не литералы.
 *  - ТТ у женщины: низкий не является дефицитом (low = 0), верх 6 нмоль/л —
 *    порог вирилизации (женский протокол); критический — 10.
 *  - E2: норма фазовая, поэтому «высоко» — от жёлтого бэнда (>400 пг/мл),
 *    критично — от красного (>800).
 */
const FEMALE_REFERENCE_OVERRIDES: Record<string, { low?: number; high?: number; criticalHigh?: number }> = {
  ALT: { high: LFT_ULN.ALT.female, criticalHigh: LFT_STAGE_ULN.reduce.female },
  AST: { high: LFT_ULN.AST.female, criticalHigh: LFT_STAGE_ULN.reduce.female },
  GGT: { high: GGT_ULN.female, criticalHigh: GGT_STAGE_ULN.double.female },
  CREATININE: { low: 44, high: CREATININE_ULN.female, criticalHigh: 120 },
  HEMOGLOBIN: { low: 120, high: HGB_THRESHOLDS.female.upper, criticalHigh: HGB_THRESHOLDS.female.block },
  HEMATOCRIT: { low: 36, high: HCT_THRESHOLDS.female.erythrocytosis, criticalHigh: HCT_THRESHOLDS.female.block },
  TESTOSTERONE_TOTAL: { low: 0, high: 6, criticalHigh: 10 },
  TESTOSTERONE_FREE: { low: 0 },
  ESTRADIOL: { low: FEMALE_HORMONE_ULN.E2.low, high: FEMALE_HORMONE_ULN.E2.high, criticalHigh: FEMALE_HORMONE_ULN.E2.criticalHigh },
  PROLACTIN: { high: FEMALE_HORMONE_ULN.PRL.high, criticalHigh: FEMALE_HORMONE_ULN.PRL.criticalHigh },
};

const LAB_MECHANISM_MAP: Record<string, { mechanism: string; organ: string; system: string; risk: string }> = {
  TESTOSTERONE_TOTAL: { mechanism: 'ANDROGEN_DEFICIT', organ: 'testes', system: 'endocrine', risk: 'HORMONE_LOW_T' },
  TESTOSTERONE_FREE: { mechanism: 'ANDROGEN_DEFICIT', organ: 'testes', system: 'endocrine', risk: 'HORMONE_LOW_T' },
  ESTRADIOL: { mechanism: 'AROMATIZATION_UP', organ: 'liver', system: 'endocrine', risk: 'HORMONE_HIGH_E2' },
  PROLACTIN: { mechanism: 'DOPAMINE_DOWN', organ: 'pituitary', system: 'endocrine', risk: 'HORMONE_HIGH_CORTISOL' },
  LH: { mechanism: 'HPTA_SUPPRESSION', organ: 'pituitary', system: 'endocrine', risk: 'HORMONE_LOW_T' },
  FSH: { mechanism: 'HPTA_SUPPRESSION', organ: 'pituitary', system: 'endocrine', risk: 'HORMONE_LOW_T' },
  TSH: { mechanism: 'THYROID_DYSFUNCTION', organ: 'thyroid', system: 'endocrine', risk: 'HORMONE_HYPO' },
  T3: { mechanism: 'THYROID_DYSFUNCTION', organ: 'thyroid', system: 'endocrine', risk: 'HORMONE_HYPO' },
  T4: { mechanism: 'THYROID_DYSFUNCTION', organ: 'thyroid', system: 'endocrine', risk: 'HORMONE_HYPO' },
  FREE_T3: { mechanism: 'THYROID_DYSFUNCTION', organ: 'thyroid', system: 'endocrine', risk: 'HORMONE_HYPO' },
  FREE_T4: { mechanism: 'THYROID_DYSFUNCTION', organ: 'thyroid', system: 'endocrine', risk: 'HORMONE_HYPO' },
  ALT: { mechanism: 'HEPATOCYTE_DAMAGE', organ: 'liver', system: 'hepatic', risk: 'LIVER_ENZYMES_HIGH' },
  AST: { mechanism: 'HEPATOCYTE_DAMAGE', organ: 'liver', system: 'hepatic', risk: 'LIVER_ENZYMES_HIGH' },
  GGT: { mechanism: 'BILE_STASIS', organ: 'liver', system: 'hepatic', risk: 'LIVER_CHOLESTASIS' },
  BILIRUBIN: { mechanism: 'BILE_STASIS', organ: 'liver', system: 'hepatic', risk: 'LIVER_CHOLESTASIS' },
  CREATININE: { mechanism: 'RENAL_FILTRATION_DOWN', organ: 'kidneys', system: 'renal', risk: 'KIDNEY_GFR_LOW' },
  UREA: { mechanism: 'PROTEIN_CATABOLISM', organ: 'kidneys', system: 'renal', risk: 'KIDNEY_GFR_LOW' },
  GLUCOSE: { mechanism: 'INSULIN_RESISTANCE', organ: 'pancreas', system: 'endocrine', risk: 'HORMONE_INSULIN_RESISTANCE' },
  INSULIN: { mechanism: 'INSULIN_RESISTANCE', organ: 'pancreas', system: 'endocrine', risk: 'HORMONE_INSULIN_RESISTANCE' },
  LDL: { mechanism: 'LIPID_DYSREGULATION', organ: 'vascular', system: 'cardio', risk: 'BLOOD_HIGH_LDL' },
  HDL: { mechanism: 'LIPID_DYSREGULATION', organ: 'vascular', system: 'cardio', risk: 'BLOOD_LOW_HDL' },
  TRIGLYCERIDES: { mechanism: 'LIPID_DYSREGULATION', organ: 'liver', system: 'cardio', risk: 'BLOOD_HIGH_TG' },
  APOB: { mechanism: 'ATHEROGENESIS', organ: 'vascular', system: 'cardio', risk: 'HEART_ATHEROSCLEROSIS' },
  CRP: { mechanism: 'SYSTEMIC_INFLAMMATION', organ: 'vascular', system: 'cardio', risk: 'IMMUNE_CHRONIC_INFLAMMATION' },
  FERRITIN: { mechanism: 'IRON_OVERLOAD', organ: 'liver', system: 'hepatic', risk: 'BLOOD_ANEMIA' },
  HOMOCYSTEINE: { mechanism: 'METHYLATION_DEFECT', organ: 'vascular', system: 'cardio', risk: 'BLOOD_CLOTS' },
  HEMOGLOBIN: { mechanism: 'ERYTHROPOIESIS_SHIFT', organ: 'bone_marrow', system: 'hematologic', risk: 'BLOOD_ANEMIA' },
  HEMATOCRIT: { mechanism: 'BLOOD_VISCOSITY', organ: 'bone_marrow', system: 'hematologic', risk: 'BLOOD_THICK' },
  ERYTHROCYTES: { mechanism: 'ERYTHROPOIESIS_UP', organ: 'bone_marrow', system: 'hematologic', risk: 'BLOOD_THICK' },
  LEUKOCYTES: { mechanism: 'IMMUNE_ACTIVATION', organ: 'bone_marrow', system: 'hematologic', risk: 'IMMUNE_CHRONIC_INFLAMMATION' },
  THROMBOCYTES: { mechanism: 'CLOTTING_SHIFT', organ: 'bone_marrow', system: 'hematologic', risk: 'BLOOD_CLOTS' },
  POTASSIUM: { mechanism: 'ELECTROLYTE_IMBALANCE', organ: 'kidneys', system: 'renal', risk: 'ELECTROLYTE_POTASSIUM' },
  SODIUM: { mechanism: 'ELECTROLYTE_IMBALANCE', organ: 'kidneys', system: 'renal', risk: 'ELECTROLYTE_SODIUM' },
};

// Short-code to canonical-code alias map for lab marker lookup
const LAB_CODE_ALIASES: Record<string, string[]> = {
  TT: ['TESTOSTERONE', 'TESTOSTERONE_TOTAL'],
  E2: ['ESTRADIOL'],
  PRL: ['PROLACTIN'],
  FT3: ['FREE_T3', 'T3_FREE'],
  FT4: ['FREE_T4', 'T4_FREE'],
  GLU: ['GLUCOSE'],
  INS: ['INSULIN'],
  HOMA: ['HOMA_IR'],
  TG: ['TRIGLYCERIDES'],
  HGB: ['HEMOGLOBIN'],
  HCT: ['HEMATOCRIT'],
  RBC: ['ERYTHROCYTES'],
  WBC: ['LEUKOCYTES'],
  PLT: ['THROMBOCYTES', 'PLATELETS'],
  BIL: ['BILIRUBIN', 'BILIRUBIN_TOTAL'],
  ALB: ['ALBUMIN'],
  VITD: ['VITAMIN_D'],
  B12: ['VITAMIN_B12'],
  FOL: ['FOLATE'],
  PROG: ['PROGESTERONE'],
  INHB: ['INHIBIN_B'],
  K: ['POTASSIUM'],
  NA: ['SODIUM'],
  // Канонические коды UCUM_MAP, под которыми теперь сохраняются анализы;
  // старые записи с APOB/APOA1 должны находиться через этот алиас.
  APO_B: ['APOB'],
  APO_A1: ['APOA1'],
};

function findLab(labs: LabPoint[], code: string): number | null {
  const upper = code.toUpperCase();
  const lab = labs.find(l => {
    const lc = l.code?.toUpperCase() || '';
    if (lc === upper) return true;
    if (lc.replace(/[^A-Z0-9]/g, '_') === upper) return true;
    const aliases = LAB_CODE_ALIASES[lc];
    if (aliases && aliases.includes(upper)) return true;
    return false;
  });
  return lab?.value ?? null;
}

export function computeHOMA_IR(glucose: number, insulin: number): number {
  if (!glucose || !insulin || glucose <= 0 || insulin <= 0) return 0;
  return (glucose * insulin) / 22.5;
}

export function interpretLabs(labs: LabPoint[], sex?: 'male' | 'female'): LabCompositeResult {
  const fem = sex === 'female';
  const interpretations: LabInterpretation[] = [];

  for (const [code, ref] of Object.entries(REFERENCE_RANGES)) {
    const value = findLab(labs, code);
    if (value === null) continue;

    // ♀ — женские границы того же маркера (без sex — прежний мужской ряд).
    const r = fem ? { ...ref, ...(FEMALE_REFERENCE_OVERRIDES[code] || {}) } : ref;

    let status: LabInterpretation['status'] = 'normal';
    // P0 fix: high = >high, critical = >criticalHigh (раньше было max(high, critical-1)=79 для ALT 40/80 → 50 считался нормой)
    if (value < r.low) status = 'low';
    else if (value > r.criticalHigh) status = 'critical_high';
    else if (value > r.high) status = 'high';

    if (status !== 'normal') {
      const mapped = LAB_MECHANISM_MAP[code];
      if (mapped) {
        const riskPct = status === 'critical_high' ? 40 : status === 'high' ? 25 : 15;
        interpretations.push({ code, value, status, ...mapped, riskPercent: riskPct });
      }
    }
  }

  const glucose = findLab(labs, 'GLUCOSE') ?? 0;
  const insulin = findLab(labs, 'INSULIN') ?? 0;
  const homaIR = glucose > 0 && insulin > 0 ? computeHOMA_IR(glucose, insulin) : null;

  // Индекс печени — в долях ВГН пациента (♀ 31, ♂ 40): раньше всегда делили на
  // мужские 40, и её АЛТ 35 давал заниженный «стресс печени». Пустые значения по
  // умолчанию держат индекс на прежнем уровне (75) у обоих полов.
  const lftBase = fem ? LFT_ULN.ALT.female : LFT_ULN.ALT.male;
  const defaultLft = Math.round(30 * (lftBase / 40));
  const alt = findLab(labs, 'ALT') ?? defaultLft;
  const ast = findLab(labs, 'AST') ?? defaultLft;
  const ggt = findLab(labs, 'GGT') ?? defaultLft;
  const liverStress = Math.round(((alt + ast + ggt) / 3 / lftBase) * 100);

  const ldl = findLab(labs, 'LDL') ?? 2.5;
  const hdl = findLab(labs, 'HDL') ?? 1.3;
  const tg = findLab(labs, 'TRIGLYCERIDES') ?? 1.2;
  const apob = findLab(labs, 'APOB') ?? 0.8;
  const cardioRisk = Math.round(((ldl + apob * 3 + tg / 2) / (hdl || 1)) * 10);

  const crp = findLab(labs, 'CRP') ?? 1.5;
  const ferritin = findLab(labs, 'FERRITIN') ?? 100;
  const inflammation = Math.round(crp + (ferritin / 100));

  // Индекс почек — от ВГН креатинина пациента (♀ 97, ♂ 110), а не от 110 для всех.
  const crBase = fem ? CREATININE_ULN.female : CREATININE_ULN.male;
  const creatinine = findLab(labs, 'CREATININE') ?? Math.round(90 * (crBase / 110));
  const urea = findLab(labs, 'UREA') ?? 5;
  const kidneyStress = Math.round(((creatinine / crBase) * 60 + (urea / 8.3) * 40));

  const testTotal = findLab(labs, 'TESTOSTERONE_TOTAL');
  const testFree = findLab(labs, 'TESTOSTERONE_FREE');
  const e2 = findLab(labs, 'ESTRADIOL');
  const prolactin = findLab(labs, 'PROLACTIN');
  let hormoneScore = 0;
  // ♀ Низкий тестостерон — не дефицит (у неё нормы другие), штраф только мужчинам.
  if (!fem && testTotal !== null && testTotal < 15) hormoneScore += 30;
  if (!fem && testFree !== null && testFree < 0.3) hormoneScore += 25;
  // E2 у женщины — фазовая модель: штраф только за красный бэнд (<30 / >800), не
  // за мужское окно 40–160, иначе её норма читалась бы как отклонение.
  if (e2 !== null) {
    if (fem ? (e2 < FEMALE_HORMONE_ULN.E2.low || e2 > FEMALE_HORMONE_ULN.E2.criticalHigh) : (e2 > 160 || e2 < 40)) hormoneScore += 25;
  }
  const prlCut = fem ? FEMALE_HORMONE_ULN.PRL.high : 350;
  if (prolactin !== null && prolactin > prlCut) hormoneScore += 20;
  hormoneScore = Math.min(100, hormoneScore);

  return { homaIR, liverStress, cardioRisk, inflammation, kidneyStress, hormoneScore, interpretations };
}

export function computeRiskByModel(
  model: RiskModelType,
  labResult: LabCompositeResult,
  baseRisk: Record<string, number>,
  substanceRisk: Record<string, number>,
  supportCoverage: Record<string, number>,
): Record<string, { raw: number; net: number }> {
  const result: Record<string, { raw: number; net: number }> = {};

  for (const system of ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal']) {
    let raw = (baseRisk[system] ?? 15) + (substanceRisk[system] ?? 0);

    if (model === 'lab_weighted' || model === 'mechanism_driven' || model === 'pharma_integrated') {
      switch (system) {
        case 'hepatic': raw += labResult.liverStress * 0.5; break;
        case 'cardio': raw += labResult.cardioRisk * 0.4; break;
        case 'renal': raw += labResult.kidneyStress * 0.4; break;
        case 'endocrine': raw += labResult.hormoneScore * 0.5; break;
        case 'hematologic': raw += labResult.inflammation * 0.3; break;
      }
    }

    if (model === 'mechanism_driven' || model === 'pharma_integrated') {
      for (const interp of labResult.interpretations) {
        if (interp.system === system) raw += interp.riskPercent * 0.3;
      }
    }

    const cov = supportCoverage[system] ?? 0;
    const net = Math.max(0, raw * (1 - Math.min(0.95, cov)));

    result[system] = {
      raw: Math.min(100, Math.round(raw)),
      net: Math.min(100, Math.round(net)),
    };
  }

  return result;
}

export function generateMechanismReport(labResult: LabCompositeResult): {
  mechanisms: { name: string; activation: number; organ: string; system: string }[];
  topRisks: { system: string; risk: string; percent: number }[];
} {
  const mechanisms: { name: string; activation: number; organ: string; system: string }[] = [];
  const riskAccum: Record<string, number> = {};

  for (const interp of labResult.interpretations) {
    mechanisms.push({
      name: interp.mechanism,
      activation: interp.status === 'critical_high' ? 100 : interp.status === 'high' ? 70 : 40,
      organ: interp.organ,
      system: interp.system,
    });
    const key = `${interp.system}:${interp.risk}`;
    riskAccum[key] = (riskAccum[key] ?? 0) + interp.riskPercent;
  }

  const topRisks = Object.entries(riskAccum)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, percent]) => {
      const [system, risk] = key.split(':');
      return { system, risk, percent: Math.min(100, Math.round(percent)) };
    });

  return { mechanisms, topRisks };
}

export function computePharmaAdjustedDose(
  baseDose: number,
  liverStress: number,
  kidneyStress: number,
  bioavailability: number,
): { liverAdjusted: number; kidneyAdjusted: number; finalDose: number } {
  const liverAdjusted = baseDose * Math.max(0.3, 1 - liverStress / 100);
  const kidneyAdjusted = baseDose * Math.max(0.3, 1 - kidneyStress / 100);
  const finalDose = Math.round(baseDose * (bioavailability / 100) * Math.max(0.3, 1 - (liverStress + kidneyStress) / 200));
  return { liverAdjusted, kidneyAdjusted, finalDose };
}

export function generateTimedPlan(
  topMechanisms: { name: string; activation: number; organ: string }[],
  goal: string,
): { morning: string[]; day: string[]; evening: string[] } {
  const stimulants = ['DOPAMINE_UP', 'ANDROGEN_DEFICIT', 'THYROID_DYSFUNCTION', 'GH_IGF_UP', 'ENERGY_UP'];
  const supports = ['INSULIN_RESISTANCE', 'LIPID_DYSREGULATION', 'ERYTHROPOIESIS_SHIFT'];
  const recovery = ['HEPATOCYTE_DAMAGE', 'BILE_STASIS', 'RENAL_FILTRATION_DOWN', 'SYSTEMIC_INFLAMMATION', 'CORTISOL_UP'];

  const morning: string[] = [], day: string[] = [], evening: string[] = [];

  for (const mech of topMechanisms) {
    if (stimulants.some(s => mech.name.includes(s))) morning.push(mech.name);
    else if (supports.some(s => mech.name.includes(s))) day.push(mech.name);
    else evening.push(mech.name);
  }

  if (morning.length === 0 && day.length === 0 && evening.length === 0) {
    morning.push('VITAMIN_D3', 'OMEGA3');
    day.push('MAGNESIUM', 'COQ10');
    evening.push('MELATONIN', 'NAC');
  }

  return { morning, day, evening };
}
