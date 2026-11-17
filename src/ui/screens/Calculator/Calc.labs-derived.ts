import type { CalculatorState, LabSlice, LabFlagOverride } from '../../../engines/support-plan';
import {
  getLabNorm, HCT_THRESHOLDS, HGB_THRESHOLDS, HCT_CORRECTION_MARGIN,
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  BILIRUBIN_FLAG_STEPS, LDL_FLAG_STEPS, TG_FLAG_STEPS, HDL_LOW,
  CREATININE_ULN, CREATININE_FLAG_STEP,
} from '../../../engines/lab-norms.engine';
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

/**
 * Маржинальная зона гематокрита — ПРОДУКТОВОЕ правило приложения, не клиническая
 * норма (проход 75). «Коррекция» начинается на 4 п.п. ниже верхней нормы: это
 * запас, в котором уже пора снижать нагрузку/добавлять гидратацию, но порог
 * терапии ещё не достигнут. Женские 44 — следствие (48 − 4), отдельного источника
 * чисел нет.
 *
 * Проход 94: константа переехала в `lab-norms.engine` — потребителей стало двое
 * (калькулятор и метаболический хаб), а второй `4` в движке был бы пятой копией
 * порога. Здесь остаётся ре-экспорт, чтобы прежние импорты не менялись.
 */
export { HCT_CORRECTION_MARGIN };

/**
 * §6.2 (P2, проход 39): ЕДИНАЯ шкала гематокрита для подписи, баннера и
 * состояния лабораторий. Границы:
 *   коррекция = ULN − `HCT_CORRECTION_MARGIN` (♂ 48, ♀ 44)
 *   терапия   = ULN     (♂ 52, ♀ 48)
 *   ургент    = порог блока первичной модели (`HCT_THRESHOLDS`: ♂ 54, ♀ 52)
 * До 39-го прохода на одном экране жили три шкалы: подпись 48/52/57, состояние
 * 52/56/60 и баннер 57 — при Hct 55 подпись говорила «терапия», баннер молчал,
 * а контраиндикация тромбофилии включалась только с 60.
 */
export function hctCuts(sex?: 'male' | 'female'): { correction: number; therapy: number; urgent: number } {
  const s = sex === 'female' ? 'female' : 'male';
  const therapy = getLabNorm('HCT', s)?.uln ?? (s === 'female' ? 48 : 52);
  return { correction: therapy - HCT_CORRECTION_MARGIN, therapy, urgent: HCT_THRESHOLDS[s].block };
}

/** UI-градация гематокрита — по `hctCuts` (мужские 48/52/54, женские 44/48/52). */
export function hctGradationLabel(hct: number, sex?: 'male' | 'female'): string {
  const c = hctCuts(sex);
  return hct >= c.urgent ? '🔴 ургент'
    : hct >= c.therapy ? '🟠 терапия'
    : hct >= c.correction ? '🟡 коррекция'
    : '🟢 норма';
}

/**
 * Пороги HCT для доменной карты симптомов (калькулятор): ♂ 48/52, ♀ 44/48.
 * Считаются от ULN единого резолвера (`lab-norms.engine`) через `hctCuts`.
 */
export function hctSymptomCuts(sex?: 'male' | 'female'): { correction: number; therapy: number } {
  const { correction, therapy } = hctCuts(sex);
  return { correction, therapy };
}

/**
 * Порог «Гемоглобин выше нормы» для доменной карты: ♂ 170, ♀ 150 — верх нормы
 * из `HGB_THRESHOLDS` (проход 74). Раньше у мужчины стоял литерал 175: он не
 * совпадал ни с верхом нормы (170), ни с порогом вмешательства (185), поэтому
 * мужчина с Hb 172 читал «норма», хотя это уже выше нормы.
 */
export function hgbSymptomCut(sex?: 'male' | 'female'): number {
  const s = sex === 'female' ? 'female' : 'male';
  return HGB_THRESHOLDS[s].upper;
}

export function deriveStateFromLabs(fp: LabSlice, sex?: 'male' | 'female', prev?: Partial<CalculatorState>): {
  hepatobiliary: Partial<CalculatorState['hepatobiliary']>;
  cardio: Partial<CalculatorState['cardio']>;
  urinary: Partial<CalculatorState['urinary']>;
  goals: Partial<CalculatorState['goals']>;
  contraindications: Partial<CalculatorState['contraindications']>;
  derivedFields: string[];
  /** Перекрытия ответов анкеты (проход 105) — чтобы показать оба значения. */
  overrides: LabFlagOverride[];
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

  // §6.2 (P2, проход 24): границы — от ULN единого резолвера (`lab-norms`), пол
  // учитывается. Раньше здесь жили мужские литералы (40/80/120, 55/100/200,
  // 21/40/60, 110/130/150): у женщины АЛТ 35 одновременно была «нормой» и
  // «отклонением» на разных экранах.
  // Проход 103: ступени тоже из таблиц резолвера (`LFT_STAGE_ULN`, `GGT_STAGE_ULN`,
  // `BILIRUBIN_FLAG_STEPS`), а не множителями «×2 / ×4 / ×3.5». Пока множители жили
  // здесь, ГГТ 200 у мужчины на этом экране был «moderate», а в «Поддержке» — уже
  // «severe» (там шкала ×3 = 165); билирубин 35 — «moderate» здесь и «mild» там,
  // а 18–21 — «mild» здесь и «норма» там.
  const sexKey: 'male' | 'female' = sex === 'female' ? 'female' : 'male';
  const lftUln = LFT_ULN.ALT[sexKey];
  const lftReduce = LFT_STAGE_ULN.reduce[sexKey];
  const lftStopOral = LFT_STAGE_ULN.stopOral[sexKey];

  if (alt !== null || ast !== null) {
    const maxTransam = Math.max(alt ?? 0, ast ?? 0);
    if (maxTransam < lftUln) hep.altAstElevation = 'none';
    else if (maxTransam < lftReduce) hep.altAstElevation = 'mild';
    else if (maxTransam < lftStopOral) hep.altAstElevation = 'moderate';
    else hep.altAstElevation = 'severe';
    derived.push('hepatobiliary.altAstElevation');
  }

  if (ggt !== null) {
    if (ggt < GGT_ULN[sexKey]) hep.ggtElevation = 'none';
    else if (ggt < GGT_STAGE_ULN.double[sexKey]) hep.ggtElevation = 'mild';
    else if (ggt < GGT_STAGE_ULN.triple[sexKey]) hep.ggtElevation = 'moderate';
    else hep.ggtElevation = 'severe';
    derived.push('hepatobiliary.ggtElevation');
  }

  if (bilirubin !== null) {
    if (bilirubin < BILIRUBIN_FLAG_STEPS.mild) hep.bilirubinElevation = 'none';
    else if (bilirubin < BILIRUBIN_FLAG_STEPS.moderate) hep.bilirubinElevation = 'mild';
    else if (bilirubin < BILIRUBIN_FLAG_STEPS.severe) hep.bilirubinElevation = 'moderate';
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
    if (ldl < LDL_FLAG_STEPS.mild) card.ldlElevation = 'none';
    else if (ldl < LDL_FLAG_STEPS.moderate) card.ldlElevation = 'mild';
    else if (ldl < LDL_FLAG_STEPS.severe) card.ldlElevation = 'moderate';
    else card.ldlElevation = 'severe';
    derived.push('cardio.ldlElevation');
  }

  if (hdl !== null) {
    // Проход 103: женская цель ЛПВП выше (1.2), как в «Поддержке» и в таблице
    // рекомендаций. Общий порог 1.0 давал женщине «норму» на двух экранах из трёх.
    card.hdlLow = hdl < HDL_LOW[sexKey];
    derived.push('cardio.hdlLow');
  }

  if (tg !== null) {
    // 'elevated' — то же значение, что пишет «Поддержка»: `engine-helpers` считает
    // +10 к кардио-риску только за него, а 'mild' не понимал ни один потребитель.
    if (tg < TG_FLAG_STEPS.elevated) card.triglycerides = 'normal';
    else if (tg < TG_FLAG_STEPS.high) card.triglycerides = 'elevated';
    else card.triglycerides = 'high';
    derived.push('cardio.triglycerides');
  }

  if (hct !== null) {
    // §6.2 (P2, проход 39): та же шкала, что подпись и баннер (`hctCuts`):
    // none < ULN−4, mild < ULN, moderate < порог флеботомии, severe ≥ него
    // (♂ 48/52/54, ♀ 44/48/52). Раньше здесь жили 52/56/60 — Hct 55 давал
    // «mild», хотя STOP-таблица и гейт курса уже требовали решения.
    const c = hctCuts(sex);
    const t1 = c.correction, t2 = c.therapy, t3 = c.urgent;
    if (hct < t1) card.hctElevation = 'none';
    else if (hct < t2) card.hctElevation = 'mild';
    else if (hct < t3) card.hctElevation = 'moderate';
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
    // §6.2 (P2): ULN по полу (♂ 110, ♀ 97), шаг +20/+40 — одна пара на приложение.
    const crUln = CREATININE_ULN[sexKey];
    if (creatinine < crUln) urin.creatinineElevation = 'none';
    else if (creatinine < crUln + CREATININE_FLAG_STEP) urin.creatinineElevation = 'mild';
    else if (creatinine < crUln + 2 * CREATININE_FLAG_STEP) urin.creatinineElevation = 'moderate';
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

  // ── Проход 105: анализы главнее анкеты, но перекрытие не молчит ──
  // На расчёт `prev` не влияет: флаг берётся из бланка. Если в анкете стоял другой
  // ответ, оба значения уезжают наверх — экран покажет «по анализам «умеренно»
  // (АЛТ 85, предел <40), в анкете было «норма»» вместо молчаливой подмены.
  const overrides: LabFlagOverride[] = [];
  const noteOverride = (
    field: string, title: string, manual: string | undefined, lab: string | undefined,
    marker: string, value: number | null, limit: string,
  ) => {
    if (!manual || !lab || manual === lab || value === null) return;
    overrides.push({ field, title, manual, lab, marker, value, limit });
  };
  const transamPeak = alt !== null || ast !== null ? Math.max(alt ?? 0, ast ?? 0) : null;
  noteOverride('hepatobiliary.altAstElevation', 'АЛТ/АСТ', prev?.hepatobiliary?.altAstElevation, hep.altAstElevation,
    (alt ?? 0) >= (ast ?? 0) ? 'ALT' : 'AST', transamPeak, `<${lftUln}`);
  noteOverride('hepatobiliary.ggtElevation', 'ГГТ', prev?.hepatobiliary?.ggtElevation, hep.ggtElevation,
    'GGT', ggt, `<${GGT_ULN[sexKey]}`);
  noteOverride('hepatobiliary.bilirubinElevation', 'Билирубин', prev?.hepatobiliary?.bilirubinElevation, hep.bilirubinElevation,
    'Bilirubin', bilirubin, `<${BILIRUBIN_FLAG_STEPS.mild}`);
  noteOverride('urinary.creatinineElevation', 'Креатинин', prev?.urinary?.creatinineElevation, urin.creatinineElevation,
    'Creatinine', creatinine, `<${CREATININE_ULN[sexKey]}`);
  noteOverride('urinary.ureaElevation', 'Мочевина', prev?.urinary?.ureaElevation, urin.ureaElevation, 'Urea', urea, '<8.3');
  // Если ЛПНП не сдан, флаг идёт от общего холестерина — и в подписи должно стоять
  // то же, чем считали.
  const tcVal = ldl === null ? getV('panelLipid', 'Total Cholesterol') : null;
  noteOverride('cardio.ldlElevation', 'ЛПНП', prev?.cardio?.ldlElevation, card.ldlElevation,
    ldl !== null ? 'LDL' : 'Холестерин общий', ldl ?? tcVal, ldl !== null ? `<${LDL_FLAG_STEPS.mild}` : '<5');
  noteOverride('cardio.hdlLow', 'ЛПВП',
    prev?.cardio === undefined ? undefined : (prev.cardio.hdlLow ? 'низко' : 'норма'),
    card.hdlLow === undefined ? undefined : (card.hdlLow ? 'низко' : 'норма'),
    'HDL', hdl, `≥${HDL_LOW[sexKey]}`);
  noteOverride('cardio.triglycerides', 'Триглицериды', prev?.cardio?.triglycerides, card.triglycerides,
    'Triglycerides', tg, `<${TG_FLAG_STEPS.elevated}`);
  noteOverride('cardio.hctElevation', 'Гематокрит', prev?.cardio?.hctElevation, card.hctElevation,
    'HCT', hct, `<${hctCuts(sex).correction}`);

  return { hepatobiliary: hep, cardio: card, urinary: urin, goals, contraindications: contr, derivedFields: derived, overrides };
}