import type { CalculatorState, LabSlice } from '../../../engines/support-plan';
import { FULL_PANELS } from './Calc.lab';

// ═══════════════════════════════════════════════════════════════
//  Маркер → панель: авт-определение панели для code из LabPoint
// ═══════════════════════════════════════════════════════════════
const MARKER_TO_PANEL: Record<string, keyof LabSlice> = {};
for (const p of FULL_PANELS) {
  for (const m of p.markers) {
    MARKER_TO_PANEL[m.toLowerCase()] = p.key;
    // Также — альтернативные написания
    const alt = m.replace(/\s+/g, '_').replace(/[()]/g, '').toLowerCase();
    if (alt !== m.toLowerCase()) MARKER_TO_PANEL[alt] = p.key;
  }
}
// Дополнительные синонимы маркеров (UCUM-коды из labs_log)
MARKER_TO_PANEL['alt'] = 'panelBiochem';
MARKER_TO_PANEL['ast'] = 'panelBiochem';
MARKER_TO_PANEL['ggt'] = 'panelBiochem';
MARKER_TO_PANEL['bilirubin'] = 'panelBiochem';
MARKER_TO_PANEL['bilirubin_direct'] = 'panelBiochem';
MARKER_TO_PANEL['bilirubin_total'] = 'panelBiochem';
MARKER_TO_PANEL['glucose'] = 'panelBiochem';
MARKER_TO_PANEL['creatinine'] = 'panelBiochem';
MARKER_TO_PANEL['urea'] = 'panelBiochem';
MARKER_TO_PANEL['uric_acid'] = 'panelBiochem';
MARKER_TO_PANEL['uric acid'] = 'panelBiochem';
MARKER_TO_PANEL['crp'] = 'panelBiochem';
MARKER_TO_PANEL['hscrp'] = 'panelInflammatory';
MARKER_TO_PANEL['hs-crp'] = 'panelInflammatory';
MARKER_TO_PANEL['homocysteine'] = 'panelBiochem';
MARKER_TO_PANEL['hematocrit'] = 'panelHematology';
MARKER_TO_PANEL['hct'] = 'panelHematology';
MARKER_TO_PANEL['hemoglobin'] = 'panelHematology';
MARKER_TO_PANEL['hb'] = 'panelHematology';
MARKER_TO_PANEL['rbc'] = 'panelHematology';
MARKER_TO_PANEL['wbc'] = 'panelHematology';
MARKER_TO_PANEL['platelets'] = 'panelHematology';
MARKER_TO_PANEL['neutrophils'] = 'panelHematology';
MARKER_TO_PANEL['lymphocytes'] = 'panelHematology';
MARKER_TO_PANEL['total_cholesterol'] = 'panelLipid';
MARKER_TO_PANEL['ldl'] = 'panelLipid';
MARKER_TO_PANEL['hdl'] = 'panelLipid';
MARKER_TO_PANEL['triglycerides'] = 'panelLipid';
MARKER_TO_PANEL['tg'] = 'panelLipid';
MARKER_TO_PANEL['vldl'] = 'panelLipid';
MARKER_TO_PANEL['apob'] = 'panelLipid';
MARKER_TO_PANEL['apoa1'] = 'panelLipid';
MARKER_TO_PANEL['tsh'] = 'panelThyroid';
MARKER_TO_PANEL['t3_free'] = 'panelThyroid';
MARKER_TO_PANEL['t4_free'] = 'panelThyroid';
MARKER_TO_PANEL['anti_tpo'] = 'panelThyroid';
MARKER_TO_PANEL['ferritin'] = 'panelIron';
MARKER_TO_PANEL['iron'] = 'panelIron';
MARKER_TO_PANEL['tibc'] = 'panelIron';
MARKER_TO_PANEL['transferrin'] = 'panelIron';
MARKER_TO_PANEL['vitamin_d'] = 'panelVitamin';
MARKER_TO_PANEL['vitamin_d_25_oh'] = 'panelVitamin';
MARKER_TO_PANEL['b12'] = 'panelVitamin';
MARKER_TO_PANEL['folate'] = 'panelVitamin';
MARKER_TO_PANEL['dhea_s'] = 'panelAdrenal';
MARKER_TO_PANEL['dhea-s'] = 'panelAdrenal';
MARKER_TO_PANEL['aldosterone'] = 'panelAdrenal';
MARKER_TO_PANEL['lh'] = 'panelSex';
MARKER_TO_PANEL['fsh'] = 'panelSex';
MARKER_TO_PANEL['total_t'] = 'panelSex';
MARKER_TO_PANEL['free_t'] = 'panelSex';
MARKER_TO_PANEL['e2'] = 'panelSex';
MARKER_TO_PANEL['estradiol'] = 'panelSex';
MARKER_TO_PANEL['prolactin'] = 'panelSex';
MARKER_TO_PANEL['shbg'] = 'panelSex';
MARKER_TO_PANEL['dht'] = 'panelSex';
MARKER_TO_PANEL['cortisol'] = 'panelSex';
MARKER_TO_PANEL['testosterone'] = 'panelSex';
MARKER_TO_PANEL['test_total'] = 'panelSex';
MARKER_TO_PANEL['ck'] = 'panelCardiac';
MARKER_TO_PANEL['ck_mb'] = 'panelCardiac';
MARKER_TO_PANEL['troponin_t'] = 'panelCardiac';
MARKER_TO_PANEL['troponin_i'] = 'panelCardiac';
MARKER_TO_PANEL['nt_probnp'] = 'panelCardiac';
MARKER_TO_PANEL['nt-probnp'] = 'panelCardiac';
MARKER_TO_PANEL['d_dimer'] = 'panelCoagulation';
MARKER_TO_PANEL['d-dimer'] = 'panelCoagulation';
MARKER_TO_PANEL['fibrinogen'] = 'panelCoagulation';
MARKER_TO_PANEL['il_6'] = 'panelInflammatory';
MARKER_TO_PANEL['tnf_alpha'] = 'panelInflammatory';
MARKER_TO_PANEL['calcium'] = 'panelMineral';
MARKER_TO_PANEL['magnesium'] = 'panelMineral';
MARKER_TO_PANEL['sodium'] = 'panelMineral';
MARKER_TO_PANEL['potassium'] = 'panelMineral';
MARKER_TO_PANEL['psa_total'] = 'panelTumor';
MARKER_TO_PANEL['psa_free'] = 'panelTumor';
MARKER_TO_PANEL['ph'] = 'panelUrinalysis';
MARKER_TO_PANEL['protein'] = 'panelUrinalysis';
MARKER_TO_PANEL['ketones'] = 'panelUrinalysis';

// ═══════════════════════════════════════════════════════════════
//  Конвертация из LabPoint[] → LabSlice
//  Принимает: LabPoint[], массив {code,value,unit,date}, LabDiaryEntry[]
// ═══════════════════════════════════════════════════════════════
export function labPointsToSlice(input: any): LabSlice | null {
  if (!input) return null;
  const slice: LabSlice = {
    date: '', panelSex: {}, panelBiochem: {}, panelHematology: {},
    panelThyroid: {}, panelLipid: {}, panelIron: {}, panelVitamin: {},
    panelCardiac: {}, panelCoagulation: {}, panelInflammatory: {},
    panelAdrenal: {}, panelMineral: {}, panelTumor: {}, panelUrinalysis: {},
  };
  let count = 0;

  // ── Case 1: массив LabPoint [{code, value, ...}] ──
  if (Array.isArray(input)) {
    for (const lp of input) {
      if (!lp || typeof lp !== 'object') continue;
      const code = String(lp.code || lp.name || lp.marker || '').trim();
      if (!code) continue;
      const panel = MARKER_TO_PANEL[code.toLowerCase()];
      if (!panel) continue;
      const val = lp.value != null ? String(lp.value) : '';
      if (!val && lp.valueStr) (slice[panel] as Record<string, string>)[code] = lp.valueStr;
      else (slice[panel] as Record<string, string>)[code] = val;
      if (lp.date && !slice.date) slice.date = lp.date;
      count++;
    }
  }
  // ── Case 2: LabDiaryEntry {markers: [{code, value, ...}]} ──
  else if (input.markers && Array.isArray(input.markers)) {
    if (input.date) slice.date = String(input.date);
    for (const m of input.markers) {
      const code = String(m.code || m.name || '').trim();
      if (!code) continue;
      const panel = MARKER_TO_PANEL[code.toLowerCase()];
      if (!panel) continue;
      (slice[panel] as Record<string, string>)[code] = String(m.value ?? '');
      count++;
    }
  }
  // ── Case 3: уже LabSlice {panelBiochem: {...}, ...} ──
  else if (input.panelBiochem || input.panelSex || input.panelHematology) {
    return input as LabSlice;
  }
  // ── Case 4: plain record {ALT: '40', AST: '35', ...} ──
  else if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      const panel = MARKER_TO_PANEL[k.toLowerCase()];
      if (!panel) continue;
      (slice[panel] as Record<string, string>)[k] = String(v ?? '');
      count++;
    }
  }

  return count > 0 ? slice : null;
}

export function deriveStateFromLabs(fp: LabSlice): {
  hepatobiliary: Partial<CalculatorState['hepatobiliary']>;
  cardio: Partial<CalculatorState['cardio']>;
  urinary: Partial<CalculatorState['urinary']>;
  goals: Partial<CalculatorState['goals']>;
  contraindications: Partial<CalculatorState['contraindications']>;
  derivedFields: string[];
} {
  const getV = (panel: keyof LabSlice, key: string): number | null => {
    const pv = fp[panel] as Record<string, string> | undefined;
    if (!pv) return null;
    const v = parseFloat(pv[key]);
    return isNaN(v) ? null : v;
  };
  const getS = (panel: keyof LabSlice, key: string): string => {
    const pv = fp[panel] as Record<string, string> | undefined;
    return pv?.[key] || '';
  };

  const derived: string[] = [];
  const hep: Partial<CalculatorState['hepatobiliary']> = {};
  const card: Partial<CalculatorState['cardio']> = {};
  const urin: Partial<CalculatorState['urinary']> = {};
  const goals: Partial<CalculatorState['goals']> = {};
  const contr: Partial<CalculatorState['contraindications']> = {};

  const alt = getV('panelBiochem', 'ALT');
  const ast = getV('panelBiochem', 'AST');
  const ggt = getV('panelBiochem', 'GGT');
  const bilirubin = getV('panelBiochem', 'Bilirubin');

  if (alt !== null || ast !== null) {
    const maxTransam = Math.max(alt ?? 0, ast ?? 0);
    if (maxTransam < 40) hep.altAstElevation = 'none';
    else if (maxTransam < 80) hep.altAstElevation = 'mild';
    else if (maxTransam < 120) hep.altAstElevation = 'moderate';
    else hep.altAstElevation = 'severe';
    derived.push('hepatobiliary.altAstElevation');
  }

  if (ggt !== null) {
    if (ggt < 55) hep.ggtElevation = 'none';
    else if (ggt < 100) hep.ggtElevation = 'mild';
    else if (ggt < 200) hep.ggtElevation = 'moderate';
    else hep.ggtElevation = 'severe';
    derived.push('hepatobiliary.ggtElevation');
  }

  if (bilirubin !== null) {
    if (bilirubin < 21) hep.bilirubinElevation = 'none';
    else if (bilirubin < 40) hep.bilirubinElevation = 'mild';
    else if (bilirubin < 60) hep.bilirubinElevation = 'moderate';
    else hep.bilirubinElevation = 'severe';
    derived.push('hepatobiliary.bilirubinElevation');
  }

  if (alt !== null && ast !== null && ggt !== null) {
    if (alt / Math.max(1, ast) > 1.5 && ggt > 60) {
      hep.fattyLiver = true;
      derived.push('hepatobiliary.fattyLiver');
    } else if (alt !== null && ast !== null && ggt !== null) {
      hep.fattyLiver = false;
      derived.push('hepatobiliary.fattyLiver');
    }
  }

  const ldl = getV('panelLipid', 'LDL');
  const hdl = getV('panelLipid', 'HDL');
  const tg = getV('panelLipid', 'Triglycerides');
  const hct = getV('panelHematology', 'HCT');
  const hb = getV('panelHematology', 'Hemoglobin');

  if (ldl !== null) {
    if (ldl < 3.0) card.ldlElevation = 'none';
    else if (ldl < 4.0) card.ldlElevation = 'mild';
    else if (ldl < 5.0) card.ldlElevation = 'moderate';
    else card.ldlElevation = 'severe';
    derived.push('cardio.ldlElevation');
  }

  if (hdl !== null) {
    card.hdlLow = hdl < 1.0;
    derived.push('cardio.hdlLow');
  }

  if (tg !== null) {
    if (tg < 1.7) card.triglycerides = 'normal';
    else if (tg < 2.3) card.triglycerides = 'mild';
    else card.triglycerides = 'high';
    derived.push('cardio.triglycerides');
  }

  if (hct !== null) {
    if (hct < 52) card.hctElevation = 'none';
    else if (hct < 56) card.hctElevation = 'mild';
    else if (hct < 60) card.hctElevation = 'moderate';
    else card.hctElevation = 'severe';
    derived.push('cardio.hctElevation');
  }

  if (ldl === null) {
    const tc = getV('panelLipid', 'Total Cholesterol');
    if (tc !== null) {
      if (tc < 5.0) card.ldlElevation = 'none';
      else if (tc < 6.0) card.ldlElevation = 'mild';
      else if (tc < 7.0) card.ldlElevation = 'moderate';
      else card.ldlElevation = 'severe';
      derived.push('cardio.ldlElevation');
    }
  }

  const creatinine = getV('panelBiochem', 'Creatinine');
  const urea = getV('panelBiochem', 'Urea');
  const protein = getS('panelUrinalysis', 'Protein');

  if (creatinine !== null) {
    if (creatinine < 110) urin.creatinineElevation = 'none';
    else if (creatinine < 130) urin.creatinineElevation = 'mild';
    else if (creatinine < 150) urin.creatinineElevation = 'moderate';
    else urin.creatinineElevation = 'severe';
    derived.push('urinary.creatinineElevation');
  }

  if (urea !== null) {
    if (urea < 8.3) urin.ureaElevation = 'none';
    else if (urea < 12) urin.ureaElevation = 'mild';
    else if (urea < 20) urin.ureaElevation = 'moderate';
    else urin.ureaElevation = 'severe';
    derived.push('urinary.ureaElevation');
  }

  if (protein) {
    const pLower = protein.toLowerCase().trim();
    if (pLower.includes('нет') || pLower.includes('norm') || pLower === '-' || pLower === '0' || pLower === 'neg' || pLower === 'trace') {
      urin.proteinuria = false;
    } else {
      urin.proteinuria = true;
    }
    derived.push('urinary.proteinuria');
  }

  if (hep.altAstElevation && hep.altAstElevation !== 'none') {
    goals.liverDetox = true;
    derived.push('goals.liverDetox');
  }
  if ((card.ldlElevation && card.ldlElevation !== 'none') || card.hdlLow === true || (card.triglycerides && card.triglycerides !== 'normal')) {
    goals.lipidCorrection = true;
    derived.push('goals.lipidCorrection');
  }
  if (card.hctElevation && card.hctElevation !== 'none') {
    goals.bloodThinning = true;
    derived.push('goals.bloodThinning');
  }

  if (hep.altAstElevation === 'severe' || hep.bilirubinElevation === 'severe') {
    contr.hasLiverDisease = true;
    derived.push('contraindications.hasLiverDisease');
  }
  if (urin.creatinineElevation === 'severe') {
    contr.hasKidneyDisease = true;
    derived.push('contraindications.hasKidneyDisease');
  }
  if (card.hctElevation === 'severe' || (hb !== null && hb > 180)) {
    contr.hasThrombophilia = true;
    derived.push('contraindications.hasThrombophilia');
  }

  return { hepatobiliary: hep, cardio: card, urinary: urin, goals, contraindications: contr, derivedFields: derived };
}