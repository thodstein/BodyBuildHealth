import type { CalculatorState, LabSlice } from '../../../engines/support-plan';

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