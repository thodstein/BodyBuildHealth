import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import type { LabCompositeResult } from './lab-analysis.engine';
import { INTERACTIONS_DB, resolveInteractionId } from '../data/support-interactions-db';
import { hasBlockingInteraction, getDDIForPair, getDDIForDrug } from '../data/drug-drug-interactions';

/* ─── Daily Upper Limits (UL) in mg ─── */
export const SUPPLEMENT_UPPER_LIMITS: Record<string, number> = {
  zinc: 40, zinc_picolinate: 40, zinc_carnosine: 40,
  selenium: 0.4, vitamin_b6: 100, vitamin_a: 3, vitamin_d3: 0.1,
  vitamin_e: 1000, vitamin_c: 2000, calcium: 2500,
  magnesium: 350, magnesium_citrate: 350, magnesium_glycinate: 350, magnesium_l_threonate: 350,
  iron: 45, copper: 10, manganese: 11, boron: 20,
  chromium: 1, iodine: 1.1, potassium: 4700,
  coq10: 1200, alpha_lipoic: 1800, nac: 3000,
  curcumin: 8000, berberine: 1500, ashwagandha: 6000,
  l_carnitine: 4000, creatine: 20000, taurine: 6000,
  theanine: 400, glycine: 30000, glutamine: 40000,
};

/* ─── Daily OPTIMAL doses (mg) — above opt*1.5 flag for titrate/cycling ───
   Used by checkStackToxicity to warn not just at UL but when a stack pushes
   a substance well above its evidence-based optimal dose. */
export const SUPPLEMENT_OPTIMAL_LIMITS: Record<string, number> = {
  zinc: 30, selenium: 0.2, vitamin_b6: 25, vitamin_c: 1000,
  calcium: 1200, iron: 18, copper: 3, manganese: 5, boron: 10,
  chromium: 0.2, iodine: 0.15, coq10: 300, alpha_lipoic: 600,
  nac: 1200, curcumin: 1000, berberine: 1000, ashwagandha: 600,
  l_carnitine: 2000, creatine: 5000, taurine: 2000, theanine: 200,
  glycine: 5000, glutamine: 10000, vitamin_e: 400,
};

/* ─── Nutrient competition pairs (antagonists) ─── */
interface CompetitionPair { a: string; b: string; effect: string; recommendation: string; }
export const NUTRIENT_COMPETITION: CompetitionPair[] = [
  { a: 'zinc', b: 'copper', effect: 'Цинк в высоких дозах (>40 мг/день) истощает запасы меди', recommendation: 'Разнести приём: цинк утром, медь вечером. Или добавить 2 мг меди на каждые 30 мг цинка' },
  { a: 'calcium', b: 'iron', effect: 'Кальций блокирует всасывание железа на 50-60%', recommendation: 'Разнести на 2+ часа. Железо натощак с витамином C, кальций с едой' },
  { a: 'calcium', b: 'magnesium', effect: 'Высокие дозы кальция (>1500 мг) конкурируют с магнием за всасывание', recommendation: 'Разнести: кальций утром, магний вечером. Соотношение Ca:Mg = 2:1' },
  { a: 'calcium', b: 'zinc', effect: 'Кальций снижает абсорбцию цинка при совместном приёме', recommendation: 'Разнести на 2+ часа' },
  { a: 'iron', b: 'zinc', effect: 'Железо и цинк конкурируют за транспортёр DMT1', recommendation: 'Разнести на 2+ часа. Цинк на ночь, железо утром' },
  { a: 'magnesium', b: 'zinc', effect: 'Высокие дозы магния (>400 мг) могут снижать абсорбцию цинка', recommendation: 'Разнести: магний вечером, цинк утром/днём' },
  { a: 'potassium', b: 'magnesium', effect: 'Калий и магний — синергисты, но высокие дозы калия (>2000 мг) требуют адекватного магния', recommendation: 'Принимать вместе для баланса электролитов' },
  { a: 'iron', b: 'copper', effect: 'Железо в высоких дозах может снижать уровень меди', recommendation: 'При длительном приёме железа добавить 1-2 мг меди' },
];

/* ─── Chelation pairs (minerals that bind each other in gut) ─── */
interface ChelationPair { a: string; b: string; effect: string; }
export const CHELATION_PAIRS: ChelationPair[] = [
  { a: 'calcium', b: 'iron', effect: 'Кальций образует нерастворимые комплексы с железом в ЖКТ' },
  { a: 'magnesium', b: 'calcium', effect: 'Магний и кальций — конкуренты за транспортёры' },
  { a: 'zinc', b: 'calcium', effect: 'Цинк и кальций конкурируют за всасывание' },
  { a: 'iron', b: 'zinc', effect: 'Железо и цинк конкурируют за DMT1 транспортёр' },
  { a: 'magnesium', b: 'zinc', effect: 'Магний (>400 мг) конкурирует с цинком' },
  { a: 'copper', b: 'zinc', effect: 'Цинк индуцирует металлотионеин → связывает медь' },
];

/* ─── Fat-soluble substance IDs ─── */
export const FAT_SOLUBLE_IDS = new Set([
  'vitamin_d3', 'vitamin_k2', 'vitamin_a', 'vitamin_e',
  'coq10', 'omega3', 'curcumin', 'idebenone', 'pqq',
  'astaxanthin', 'lutein', 'zeaxanthin', 'resveratrol',
  'flax_oil', 'fish_oil', 'krill_oil', 'evening_primrose',
]);

/* ─── Absorption enhancers ─── */
export const ABSORPTION_ENHANCERS: Array<{ target: string; enhancer: string; effect: string }> = [
  { target: 'iron', enhancer: 'vitamin_c', effect: 'Витамин C повышает всасывание железа в 2-3 раза' },
  { target: 'calcium', enhancer: 'vitamin_d3', effect: 'Витамин D необходим для всасывания кальция' },
  { target: 'magnesium', enhancer: 'vitamin_b6', effect: 'B6 улучшает усвоение и удержание магния в клетках' },
  { target: 'zinc', enhancer: 'vitamin_b6', effect: 'B6 улучшает транспорт цинка через мембраны' },
  { target: 'curcumin', enhancer: 'piperine', effect: 'Пиперин повышает биодоступность куркумина на 2000%' },
  { target: 'coq10', enhancer: 'vitamin_e', effect: 'Витамин E стабилизирует CoQ10 и улучшает его транспорт' },
  { target: 'selenium', enhancer: 'vitamin_e', effect: 'Синергия: селен + витамин E усиливают антиоксидантный эффект' },
];

/* ════════════════════════════════════════════════════════════════════
   TOXICITY UL CHECK
   ════════════════════════════════════════════════════════════════════ */

export interface ToxWarning {
  substanceId: string;
  name: string;
  totalDose: number;
  ul: number;
  percentUL: number;
  severity: 'safe' | 'warning' | 'danger' | 'titrate';
  message: string;
}

// Canonical nutrient → UL key (resolves compound forms to base nutrient)
export const UL_CANONICAL: Record<string, string> = {
  'zinc_picolinate': 'zinc', 'zinc_carnosine': 'zinc', 'zinc_gluconate': 'zinc',
  'magnesium_citrate': 'magnesium', 'magnesium_glycinate': 'magnesium', 'magnesium_l_threonate': 'magnesium', 'magnesium_oxide': 'magnesium',
  'iron_bisglycinate': 'iron', 'iron_sulfate': 'iron', 'iron_fumarate': 'iron',
  'calcium_citrate': 'calcium', 'calcium_carbonate': 'calcium', 'calcium_gluconate': 'calcium',
  'copper_bisglycinate': 'copper', 'copper_gluconate': 'copper',
  'selenium_methylselenocysteine': 'selenium', 'selenium_yeast': 'selenium',
  'vitamin_b6': 'vitamin_b6', 'vitamin_b12': 'vitamin_b12',
  'alpha_lipoic': 'alpha_lipoic', 'l_carnitine': 'l_carnitine',
  'chromium_picolate': 'chromium', 'iodine_kelp': 'iodine', 'potassium_citrate': 'potassium',
};

/* ─── Dose-unit normalization ───
   SUPPLEMENT_UPPER_LIMITS are in mg of ELEMENTAL nutrient.
   Some catalog entries store dosage.mg in IU (МЕ), mcg (мкг) or whole SALT mass
   (e.g. "Магний 400 мг" = 400 мг цитрата/глицината ≈ 56–64 мг элементарного Mg).
   factor converts stored dosage.mg → true elemental mg before UL check.
   (Prevents false "danger" alerts: D3 5000 МЕ, or Mg 400 мг соли vs UL 350 мг.) */
export const DOSE_TO_ELEMENTAL_MG: Record<string, number> = {
  vitamin_d3: 0.000025,          // 1 МЕ = 0.025 мкг → 5000 МЕ = 0.125 мг
  selenium: 0.001,               // мкг → мг (200 мкг = 0.2 мг)
  selenium_methylselenocysteine: 0.001,
  selenium_yeast: 0.001,
  vitamin_k2: 0.001,             // мкг → мг
  vitamin_b12: 0.001,            // мкг → мг
  folate: 0.001,                 // мкг → мг
  magnesium_l_threonate: 0.072,  // ~7.2% элементарного Mg (144 мг из 2000 мг соли)
};

/* Elemental fraction of the salt by compound form (Cyrillic keywords from catalog `form`).
   Used when a mineral is stored as salt mass (not the special IU/mcg cases above). */
const MINERAL_FORM_FRACTION: Record<string, Record<string, number>> = {
  magnesium: {
    'оксид': 0.603, 'треонат': 0.072, 'цитрат': 0.16, 'глицинат': 0.139,
    'бисглицинат': 0.139, 'лизинат': 0.106, 'малат': 0.155, 'таурат': 0.087,
    'хлорид': 0.12, 'лактат': 0.12,
  },
  zinc: {
    'пиколинат': 0.20, 'глюконат': 0.143, 'карнозин': 0.22, 'цитрат': 0.345,
    'оксид': 0.80, 'сульфат': 0.23, 'бисглицинат': 0.16, 'хелат': 0.16,
  },
  iron: {
    'бисглицинат': 0.16, 'сульфат': 0.20, 'фумарат': 0.329, 'глюконат': 0.12, 'цитрат': 0.18,
  },
  calcium: {
    'карбонат': 0.40, 'цитрат': 0.21, 'глюконат': 0.089, 'лактат': 0.13, 'малат': 0.13,
  },
  copper: {
    'бисглицинат': 0.154, 'глюконат': 0.143, 'цитрат': 0.38, 'сульфат': 0.254,
  },
  manganese: {
    'глицинат': 0.136, 'глюконат': 0.228, 'сульфат': 0.368, 'цитрат': 0.30,
  },
  boron: {
    'цитрат': 0.16, 'глицинат': 0.16,
  },
  potassium: {
    'цитрат': 0.28, 'хлорид': 0.52, 'глюконат': 0.14, 'оратат': 0.30,
  },
};

/* Conservative default elemental fraction if the exact form keyword is not recognized. */
const MINERAL_DEFAULT_FRACTION: Record<string, number> = {
  magnesium: 0.15, zinc: 0.20, iron: 0.16, calcium: 0.30,
  copper: 0.15, manganese: 0.15, boron: 0.16, potassium: 0.30,
};

/**
 * Resolve the conversion factor (stored salt mass → elemental mg) for a catalog id.
 * Returns `undefined` when the nutrient is stored directly as elemental (factor 1).
 */
export function resolveElementalFactor(id: string, cat: any): number | undefined {
  const lc = id.toLowerCase();
  // 1) Explicit IU/mcg/special-salt override
  if (DOSE_TO_ELEMENTAL_MG[lc] !== undefined) return DOSE_TO_ELEMENTAL_MG[lc];
  // 2) Mineral salt → derive from compound form
  const keyHint = lc.includes('magnesium') ? 'magnesium'
    : lc.includes('zinc') ? 'zinc'
    : lc.includes('iron') ? 'iron'
    : lc.includes('calcium') ? 'calcium'
    : lc.includes('copper') ? 'copper'
    : lc.includes('manganese') ? 'manganese'
    : lc.includes('boron') ? 'boron'
    : lc.includes('potassium') ? 'potassium'
    : '';
  if (!keyHint) return undefined; // non-mineral: stored as-is (factor 1)
  const form = ((cat?.dosage?.form || '') + ' ' + (cat?.nameRu || '')).toLowerCase();
  const table = MINERAL_FORM_FRACTION[keyHint];
  for (const kw of Object.keys(table)) {
    if (form.includes(kw)) return table[kw];
  }
  return MINERAL_DEFAULT_FRACTION[keyHint];
}

export function checkStackToxicity(stackIds: string[]): ToxWarning[] {
  const warnings: ToxWarning[] = [];
  const doseSum: Record<string, { total: number; ids: string[]; names: string[] }> = {};

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat?.dosage?.mg) continue;
    const lc = id.toLowerCase();
    // Normalize IU/mcg/salt-mass → elemental mg before UL comparison
    const convFactor = resolveElementalFactor(id, cat);
    const doseMg = convFactor !== undefined ? cat.dosage.mg * convFactor : cat.dosage.mg;
    const name = cat.nameRu || cat.name || id;

    let mappedKey = UL_CANONICAL[lc] || '';
    if (!mappedKey) {
      for (const ulKey of Object.keys(SUPPLEMENT_UPPER_LIMITS)) {
        if (lc.includes(ulKey) || ulKey.includes(lc)) { mappedKey = ulKey; break; }
      }
    }
    if (!mappedKey) {
      const names = cat.nameRu?.toLowerCase() || '';
      for (const ulKey of Object.keys(SUPPLEMENT_UPPER_LIMITS)) {
        if (names.includes(ulKey)) { mappedKey = ulKey; break; }
      }
    }
    if (!mappedKey) continue;

    if (!doseSum[mappedKey]) doseSum[mappedKey] = { total: 0, ids: [], names: [] };
    doseSum[mappedKey].total += doseMg;
    doseSum[mappedKey].ids.push(id);
    doseSum[mappedKey].names.push(name);
  }

  for (const [key, data] of Object.entries(doseSum)) {
    const ul = SUPPLEMENT_UPPER_LIMITS[key];
    const opt = SUPPLEMENT_OPTIMAL_LIMITS[key];
    if (!ul && !opt) continue;

    let pushed = false;

    if (ul) {
      const pct = (data.total / ul) * 100;
      if (pct >= 80) {
        const severity = pct > 150 ? 'danger' : pct > 100 ? 'warning' : 'safe';
        warnings.push({
          substanceId: key,
          name: data.names.join(' + '),
          totalDose: Math.round(data.total),
          ul,
          percentUL: Math.round(pct),
          severity,
          message: severity === 'danger'
            ? `⛔ СУММАРНАЯ ДОЗА ${Math.round(data.total)} мг превышает UL ${ul} мг в ${Math.round(pct / 100)}x! Опасно.`
            : severity === 'warning'
            ? `⚠ Суммарная доза ${Math.round(data.total)} мг близка к UL ${ul} мг (${Math.round(pct)}%). Риск токсичности.`
            : `⚡ Суммарно ${Math.round(data.total)} мг из UL ${ul} мг (${Math.round(pct)}%) — OK, но следите.`,
        });
        pushed = true;
      }
    }

    // Point D: also warn when a stack pushes a substance well above its
    // evidence-based OPTIMAL dose (not just UL) → suggest titration/cycling.
    if (!pushed && opt && data.total > opt * 1.5) {
      const pctOpt = Math.round((data.total / opt) * 100);
      warnings.push({
        substanceId: key,
        name: data.names.join(' + '),
        totalDose: Math.round(data.total),
        ul: opt,
        percentUL: pctOpt,
        severity: 'titrate',
        message: `↕ Суммарная доза ${Math.round(data.total)} мг выше оптимальной (~${opt} мг, ${pctOpt}%). Рассмотрите снижение/циклирование.`,
      });
    }
  }
  return warnings;
}

/* ════════════════════════════════════════════════════════════════════
   LAB-GUIDED DOSE ADJUSTMENT
   ════════════════════════════════════════════════════════════════════ */

export interface LabAdjustment {
  substanceId: string;
  name: string;
  originalDose: number;
  adjustedDose: number;
  multiplier: number;
  reason: string;
  labMarker: string;
  severity: 'info' | 'warning' | 'danger';
}

export function applyLabAdjustments(
  stackIds: string[],
  lab: LabCompositeResult | null | undefined
): LabAdjustment[] {
  const adjustments: LabAdjustment[] = [];
  if (!lab) return adjustments;

  // Helper: read a single lab interpretation by marker code (set by
  // lab-analysis.engine from real lab values).
  const findInterp = (code: string): { code: string; status?: string; riskPercent?: number } | undefined =>
    (lab as any).interpretations?.find((x: any) => x?.code === code);
  const statusOf = (code: string): string => {
    const i = findInterp(code);
    return i?.status || 'normal';
  };
  // Normalize interpretation status → 0..1 risk score (LabInterpretation stores
  // `risk` as a string code + `riskPercent` 0-40, so derive from status instead).
  const riskOf = (code: string): number => {
    const s = statusOf(code);
    if (s === 'critical_high') return 0.9;
    if (s === 'high' || s === 'low') return 0.6;
    return 0;
  };
  // Derived electrolyte flags — POTASSIUM now present in REFERENCE_RANGES so
  // interpretations are actually built (was previously always normal/dead).
  const potassiumHigh = statusOf('POTASSIUM') === 'high' || statusOf('POTASSIUM') === 'critical_high';
  const potassiumLow = statusOf('POTASSIUM') === 'low';
  const homaIR = typeof (lab as any).homaIR === 'number' ? (lab as any).homaIR : 0;

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat?.dosage?.mg) continue;
    const dose = cat.dosage.mg;
    const name = cat.nameRu || cat.name || id;
    const lc = id.toLowerCase();

    let multiplier = 1.0;
    let reason = '';
    let labMarker = '';
    let severity: LabAdjustment['severity'] = 'info';

    // Renal impairment → reduce renally-cleared supplements
    if ((lab as any).kidneyStress > 60) {
      const renalIds = ['magnesium', 'potassium', 'creatine', 'taurine', 'calcium', 'zinc', 'selenium'];
      if (renalIds.some(r => lc.includes(r))) {
        multiplier = 0.7;
        reason = 'Почечный стресс (eGFR): снижение дозы на 30%';
        labMarker = `kidneyStress: ${Math.round((lab as any).kidneyStress)}`;
        severity = 'warning';
      }
    }

    // Hepatic impairment → reduce hepatically-metabolized supplements
    if ((lab as any).liverStress > 60) {
      const hepaticIds = ['berberine', 'curcumin', 'resveratrol', 'nac', 'milk_thistle', 'alpha_lipoic', 'ashwagandha', 'tongkat_ali'];
      if (hepaticIds.some(h => lc.includes(h))) {
        multiplier = Math.min(multiplier, 0.5);
        reason = 'Печёночный стресс (ALT/AST): снижение дозы на 50%';
        labMarker = `liverStress: ${Math.round((lab as any).liverStress)}`;
        severity = 'danger';
      }
    }

    // Hyperkalemia risk → reduce potassium (derived from interpretations)
    if (potassiumHigh && lc.includes('potassium')) {
      multiplier = 0.3;
      reason = 'Гиперкалиемия: резкое снижение дозы калия';
      labMarker = 'K+ elevated';
      severity = 'danger';
    }
    // Hypokalemia → flag potassium/cramps supplements for emphasis
    if (potassiumLow && (lc.includes('potassium') || lc.includes('magnesium'))) {
      multiplier = Math.max(multiplier, 1.0);
      reason = 'Гипокалиемия: добор калия/магния под контролем анализов';
      labMarker = 'K+ low';
      severity = 'warning';
    }

    // Thyroid stress (low free T4 / high TSH / abnormal free T3) →
    // reduce thyroid-sensitive adaptogens (ashwagandha, iodine)
    if (riskOf('FREE_T4') > 0.5 || riskOf('FREE_T3') > 0.5 || riskOf('TSH') > 0.5) {
      const thyroidIds = ['ashwagandha', 'iodine', 'lithium'];
      if (thyroidIds.some(t => lc.includes(t))) {
        multiplier = Math.min(multiplier, 0.7);
        reason = 'Нарушение функции ЩЖ: снижение дозы на 30% (контроль ТТГ)';
        labMarker = `thyroid risk: ${Math.round(Math.max(riskOf('FREE_T4'), riskOf('FREE_T3'), riskOf('TSH')) * 100)}%`;
        severity = 'warning';
      }
    }

    // Glucose / HOMA-IR stress → reduce glycemia-aggravating stimulants
    if (riskOf('GLUCOSE') > 0.5 || homaIR > 2.5) {
      const glucoseIds = ['caffeine'];
      if (glucoseIds.some(g => lc.includes(g))) {
        multiplier = Math.min(multiplier, 0.5);
        reason = 'Инсулинорезистентность/гипергликемия: снижение стимуляторов на 50%';
        labMarker = homaIR > 2.5 ? `HOMA-IR: ${homaIR.toFixed(1)}` : `glucose risk: ${Math.round(riskOf('GLUCOSE') * 100)}%`;
        severity = 'warning';
      }
    }

    // Sodium imbalance → creatine draws water/Na, reduce if Na abnormal
    if (riskOf('SODIUM') > 0.5 && lc.includes('creatine')) {
      multiplier = Math.min(multiplier, 0.8);
      reason = 'Нарушение натриевого баланса: снижение креатина на 20%, контроль воды';
      labMarker = `Na risk: ${Math.round(riskOf('SODIUM') * 100)}%`;
      severity = 'warning';
    }

    // Cardio risk → reduce stimulants
    if ((lab as any).cardioRisk > 60) {
      const stimIds = ['caffeine', 'yohimbine', 'synephrine', 'dmaa', 'ephedra', 'green_tea', 'guarana'];
      if (stimIds.some(s => lc.includes(s))) {
        multiplier = 0.3;
        reason = 'Сердечно-сосудистый риск: отмена/снижение стимуляторов';
        labMarker = `cardioRisk: ${Math.round((lab as any).cardioRisk)}`;
        severity = 'danger';
      }
    }

    if (multiplier < 1.0) {
      adjustments.push({
        substanceId: id,
        name,
        originalDose: dose,
        adjustedDose: Math.round(dose * multiplier),
        multiplier,
        reason,
        labMarker,
        severity,
      });
    }
  }
  return adjustments;
}

/* ════════════════════════════════════════════════════════════════════
   NUTRIENT COMPETITION & CHELATION CHECK
   ════════════════════════════════════════════════════════════════════ */

export interface CompetitionWarning {
  idA: string; nameA: string;
  idB: string; nameB: string;
  effect: string;
  recommendation: string;
  type: 'competition' | 'chelation';
}

export function checkNutrientConflicts(stackIds: string[]): CompetitionWarning[] {
  const warnings: CompetitionWarning[] = [];

  const checkList = [...NUTRIENT_COMPETITION, ...CHELATION_PAIRS.map(c => ({
    a: c.a, b: c.b, effect: c.effect, recommendation: 'Разнести приём на 2+ часа',
  }))];

  for (const pair of checkList) {
    const idA = stackIds.find(id => id.toLowerCase().includes(pair.a));
    const idB = stackIds.find(id => id.toLowerCase().includes(pair.b));
    if (!idA || !idB) continue;
    if (idA === idB) continue;

    const nameA = SUPPORT_CATALOG_DATA[idA]?.nameRu || SUPPORT_CATALOG_DATA[idA]?.name || idA;
    const nameB = SUPPORT_CATALOG_DATA[idB]?.nameRu || SUPPORT_CATALOG_DATA[idB]?.name || idB;

    const isChelation = CHELATION_PAIRS.some(c => c.a === pair.a && c.b === pair.b);
    warnings.push({
      idA, nameA, idB, nameB,
      effect: pair.effect,
      recommendation: pair.recommendation,
      type: isChelation ? 'chelation' : 'competition',
    });
  }
  return warnings;
}

/* ════════════════════════════════════════════════════════════════════
   FAT-SOLUBLE TIMING
   ════════════════════════════════════════════════════════════════════ */

export interface TimingRecommendation {
  substanceId: string;
  name: string;
  currentTiming: string;
  recommendedTiming: 'morning' | 'afternoon' | 'evening' | 'night' | 'fasting';
  reason: string;
  type: 'fat_soluble' | 'water_soluble' | 'chelating' | 'stimulant' | 'sedative';
}

export function optimizeTiming(stackIds: string[]): TimingRecommendation[] {
  const recs: TimingRecommendation[] = [];

  for (const id of stackIds) {
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat) continue;
    const name = cat.nameRu || cat.name || id;
    const lc = id.toLowerCase();
    const currentTiming = (cat as any)?.timingDosage || cat?.dosage?.timing || '—';

    let recTiming: TimingRecommendation['recommendedTiming'] = 'morning';
    let reason = '';
    let type: TimingRecommendation['type'] = 'water_soluble';

    // Fat-soluble → with largest meal (morning/lunch)
    if (FAT_SOLUBLE_IDS.has(id) || FAT_SOLUBLE_IDS.has(lc)) {
      recTiming = 'morning';
      reason = 'Жирорастворимый: требует приёма с жирной пищей для усвоения. Лучше с завтраком или обедом';
      type = 'fat_soluble';
    }
    // Stimulants → morning only
    else if (lc.includes('caffeine') || lc.includes('synephrine') || lc.includes('yohimbine') || lc.includes('green_tea')) {
      recTiming = 'morning';
      reason = 'Стимулятор: только утром, не позже 14:00 во избежание нарушения сна';
      type = 'stimulant';
    }
    // Sedatives/sleep aids → evening
    else if (lc.includes('melatonin') || lc.includes('ashwagandha') || lc.includes('magnesium') || lc.includes('glycine') || lc.includes('theanine') || lc.includes('gaba')) {
      recTiming = 'evening';
      reason = 'Седативный/расслабляющий эффект: оптимален вечером за 30-60 мин до сна';
      type = 'sedative';
    }
    // Testosterone boosters → morning (follows diurnal rhythm)
    else if (lc.includes('tongkat') || lc.includes('fadogia') || lc.includes('dhea') || lc.includes('boron')) {
      recTiming = 'morning';
      reason = 'Поддержка тестостерона: утренний приём соответствует циркадному пику тестостерона';
      type = 'water_soluble';
    }
    // Berberine → with meals (glucose management)
    else if (lc.includes('berberine') || lc.includes('chromium') || lc.includes('metformin')) {
      recTiming = 'morning';
      reason = 'Контроль глюкозы: принимать с едой для снижения постпрандиальной гликемии';
      type = 'water_soluble';
    }
    else { continue; }

    if (currentTiming !== '—' && currentTiming.toLowerCase().includes(recTiming)) continue;

    recs.push({ substanceId: id, name, currentTiming, recommendedTiming: recTiming, reason, type });
  }
  return recs;
}

/* ════════════════════════════════════════════════════════════════════
   ABSORPTION ENHANCER SUGGESTIONS
   ════════════════════════════════════════════════════════════════════ */

export interface EnhancerSuggestion {
  targetId: string; targetName: string;
  enhancerId: string; enhancerName: string;
  effect: string;
  inStack: boolean;
}

export function findAbsorptionEnhancers(stackIds: string[]): EnhancerSuggestion[] {
  const suggestions: EnhancerSuggestion[] = [];

  for (const pair of ABSORPTION_ENHANCERS) {
    const target = stackIds.find(id => id.toLowerCase().includes(pair.target));
    if (!target) continue;
    const enhancer = stackIds.find(id => id.toLowerCase().includes(pair.enhancer));
    const tName = SUPPORT_CATALOG_DATA[target]?.nameRu || SUPPORT_CATALOG_DATA[target]?.name || target;
    const eName = enhancer ? (SUPPORT_CATALOG_DATA[enhancer]?.nameRu || SUPPORT_CATALOG_DATA[enhancer]?.name || enhancer) : pair.enhancer;
    suggestions.push({
      targetId: target, targetName: tName,
      enhancerId: enhancer || pair.enhancer,
      enhancerName: eName,
      effect: pair.effect,
      inStack: !!enhancer,
    });
  }
  return suggestions;
}

/* ════════════════════════════════════════════════════════════════════
   DRUG-SAFETY FILTER: exclude substances with HIGH-severity drug interactions
   ════════════════════════════════════════════════════════════════════ */

export interface DrugSafetyExclusion {
  substanceId: string;
  substanceName: string;
  drug: string;
  effect: string;
  severity: string;
  mechanism: string;
}

export interface DrugSafetyTitration {
  substanceId: string;
  substanceName: string;
  drug: string;
  effect: string;
  mechanism: string;
  recommendation: string;
}

// Нормализация для сопоставления (убирает пунктуацию/подчёркивания, lower)
function normId(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
}

function interactionTokens(value: string): string[] {
  const normalized = normId(value);
  return [...new Set([
    normalized,
    normalized.replace(/^pharma/, ''),
    ...expandDrug(value).map(normId),
  ].filter(Boolean))];
}

/* ════════════════════════════════════════════════════════════════════
   DRUG ALIASES — единый источник en↔ru синонимов ЛС.
   РАНЕЕ: взаимодействия ЛС↔БАД матчились ТОЛЬКО по русским именам →
   ввод «tadalafil»/«warfarin»/«nitrates» НИКОГДА не давал предупреждения
   (жизнеугрожающие комбинации PDE5i+нитраты, варфарин+наттокиназа были
   молчаливо отключены). Теперь обе стороны (ввод пользователя и БД)
   расширяются до объединённого набора токенов и матчатся по пересечению.
   ════════════════════════════════════════════════════════════════════ */
const DRUG_ALIASES: Record<string, string[]> = {
  // ── PDE5-ингибиторы ──
  'пдэ-5 (силденафил)': ['силденафил', 'sildenafil', 'виагра', 'viagra', 'пдэ5', 'pde5'],
  'пдэ-5 (тадалафил)': ['тадалафил', 'tadalafil', 'сиалис', 'cialis', 'пдэ5', 'pde5'],
  'ваденафил': ['vardenafil', 'левитра', 'levitra'],
  // ── Нитраты ──
  'нитраты': ['nitrates', 'нитроглицерин', 'nitroglycerin', 'изосорбида', 'isosorbide', 'моночик', 'мононитрат'],
  // ── α-блокаторы ──
  'альфа-блокатор': ['альфа1-блокатор', 'alphablocker', 'doxazosin', 'доксазозин', 'тамсулозин', 'tamsulosin', 'terazosin', 'теразозин', 'prazosin', 'празозин'],
  // ── Антикоагулянты / антиагреганты ──
  'варфарин': ['warfarin'],
  'клопидогрель': ['clopidogrel', 'плавикс', 'plavix'],
  'аспирин': ['aspirin', 'ацетилсалициловая', 'acetylsalicylic'],
  'апиксабан': ['apixaban', 'эликвис', 'eliquis'],
  'дабигатран': ['dabigatran', 'прадакса', 'pradaxa'],
  'ривароксабан': ['rivaroxaban', 'ксарелто', 'xarelto'],
  'гепарин': ['heparin', 'эноксапарин', 'enoxaparin', 'клексан', 'clexane'],
  // ── СИОЗС / СИОЗСиН / ИМАО ──
  'эсциталопрам (сиозс)': ['эсциталопрам', 'escitalopram', 'ципралекс', 'cipralex', 'сиозс', 'ssri'],
  'сиозсин (венлафаксин)': ['венлафаксин', 'venlafaxine', 'сиозсин', 'snri'],
  'сиозсин (дулоксетин)': ['дулоксетин', 'duloxetine', 'сиозсин', 'snri'],
  'имао': ['maoi', 'моклобемид', 'moclobemide', 'ниаламид', 'nialamide', 'транилципромин', 'tranylcypromine', 'селегилин', 'selegiline', 'фенелзин', 'phenelzine', 'ингибитор мао'],
  // ── Сердечно-сосудистые ──
  'иапф (рамиприл)': ['рамиприл', 'ramipril', 'эналаприл', 'enalapril', 'лизиноприл', 'lisinopril', 'каптоприл', 'captopril', 'периндоприл', 'perindopril', 'квинаприл', 'quinapril', 'фозиноприл', 'fosinopril', 'иапф', 'ace inhibitor'],
  'ара (лозартан)': ['лозартан', 'losartan', 'валсартан', 'valsartan', 'ирбесартан', 'irbesartan', 'кандесартан', 'candesartan', 'телмисартан', 'telmisartan', 'эпросартан', 'eprosartan', 'ара', 'arb'],
  'β-блокаторы (бисопролол)': ['бисопролол', 'bisoprolol', 'метопролол', 'metoprolol', 'атенолол', 'atenolol', 'пропранолол', 'propranolol', 'небиволол', 'nebivolol', 'карведилол', 'carvedilol', 'бета-блокатор', 'betablocker'],
  'бкк (амлодипин)': ['амлодипин', 'amlodipine', 'фелодипин', 'felodipine', 'нифедипин', 'nifedipine', 'бкк', 'ccb'],
  'бкк (верапамил)': ['верапамил', 'verapamil', 'дилтиазем', 'diltiazem', 'бкк', 'ccb'],
  'тиазидные (гидрохлоротиазид)': ['гидрохлоротиазид', 'hydrochlorothiazide', 'хлорталидон', 'chlorthalidone', 'тиазид', 'thiazide'],
  'петлевые (фуросемид)': ['фуросемид', 'furosemide', 'торасемид', 'torasemide', 'петлевой', 'loop diuretic'],
  'калийсберегающие (спиронолактон)': ['спиронолактон', 'spironolactone', 'эплеренон', 'eplerenone', 'калийсберегающий', 'potassium sparing'],
  'амиодарон': ['amiodarone'],
  'дигоксин': ['digoxin'],
  // ── НПВС / анальгетики ──
  'нпвс (ибупрофен)': ['ибупрофен', 'ibuprofen', 'диклофенак', 'diclofenac', 'напроксен', 'naproxen', 'кетопрофен', 'ketoprofen', 'мелоксикам', 'meloxicam', 'целекоксиб', 'celecoxib', 'нпвс', 'nsaid'],
  'нпвс (диклофенак)': ['диклофенак', 'diclofenac', 'ибупрофен', 'ibuprofen', 'нпвс', 'nsaid'],
  'трамадол': ['tramadol'],
  'прегабалин': ['pregabalin', 'лирика', 'lyrica'],
  'клозапин': ['clozapine'],
  'метадон': ['methadone'],
  'бупренорфин': ['buprenorphine'],
  'триптаны (суматриптан)': ['суматриптан', 'sumatriptan', 'золмитриптан', 'zolmitriptan', 'триптан', 'triptan'],
  'дифенгидрамин': ['diphenhydramine', 'димедрол', 'dimedrol'],
  // ── Иммуносупрессоры / противоопухолевые ──
  'циклоспорин': ['cyclosporine', 'cyclosporin', 'сандиммун', 'sandimmun'],
  'такролимус': ['tacrolimus', 'програф', 'prograf'],
  'метотрексат': ['methotrexate'],
  'колхицин': ['colchicine'],
  // ── Противосудорожные / нормотимики ──
  'вальпроат': ['valproate', 'депакин', 'depakine', 'вальпроевая'],
  'карбамазепин': ['carbamazepine'],
  'топирамат': ['topiramate'],
  // ── Психотропные ──
  'оланзапин': ['olanzapine'],
  'бензодиазепины': ['benzodiazepine', 'диазепам', 'diazepam', 'клоназепам', 'clonazepam', 'феназепам', 'phenazepam', 'лоразепам', 'lorazepam'],
  'z-гипнотики (золпидем)': ['золпидем', 'zolpidem', 'амбен', 'ambien'],
  // ── Паркинсонизм ──
  'леводопа': ['levodopa', 'l-dopa', 'синемет', 'sinemet'],
  // ── Бронхолитики ──
  'сальбутамол': ['salbutamol', 'albuterol', 'вентолин', 'ventolin'],
  'теофиллин': ['theophylline'],
  // ── Антибиотики ──
  'фторхинолоны (ципрофлоксацин)': ['ципрофлоксацин', 'ciprofloxacin', 'левофлоксацин', 'levofloxacin', 'офлоксацин', 'ofloxacin', 'фторхинолон', 'fluoroquinolone'],
  'тетрациклины (доксициклин)': ['доксициклин', 'doxycycline', 'тетрациклин', 'tetracycline', 'миноциклин', 'minocycline'],
  // ── Костная ткань ──
  'алендронат': ['alendronate', 'фосамакс', 'fosamax'],
  // ── Гормональные ──
  'пероральные контрацептивы': ['oral contraceptive', 'ок', 'жанин', 'janine', 'лексинет', 'lexinet', 'ригевидон', 'rigevidon', 'ярина', 'yarinа'],
  'глюкокортикоиды (преднизолон)': ['преднизолон', 'prednisolone', 'преднизон', 'prednisone', 'метилпреднизолон', 'methylprednisolone', 'дексаметазон', 'dexamethasone', 'гкс', 'глюкокортикоид', 'glucocorticoid'],
  'левотироксин': ['левотироксин', 'levothyroxine', 'lthyroxine', 'эутирокс', 'euthyrox', 'l-тироксин', 'lt4'],
  'левтироксин': ['левотироксин', 'levothyroxine', 'эутирокс', 'euthyrox'],
  'мерказолил (тиреостатики)': ['мерказолил', 'тиамазол', 'thiamazole', 'methimazole', 'тиреостатик', 'antithyroid'],
  'бигуаниды': ['biguanide', 'метформин', 'metformin', 'сиофор', 'glucophage', 'глюкофаж'],
  'глп-1 (агонисты)': ['glp1', 'liraglutide', 'лираглутид', 'semaglutide', 'семаглутид', 'оземпик', 'ozempic', 'эксенатид', 'exenatide', 'агонист глп1', 'glp1 agonist'],
  'sglt2 (глифлозины)': ['sglt2', 'empagliflozin', 'эмпаглифлозин', 'dapagliflozin', 'дапаглифлозин', 'глифлозин', 'gliflozin'],
  // ── Прочие ──
  'ингибиторы протонной помпы': ['ppi', 'омепразол', 'omeprazole', 'эзомепразол', 'esomeprazole', 'пантопразол', 'pantoprazole', 'рабепразол', 'rabeprazole', 'ипп'],
  'инсулин': ['insulin'],
  'метформин': ['metformin', 'сиофор', 'glucophage'],
  'литий': ['lithium'],
  'орлистат': ['orlistat', 'ксеникал', 'xenical'],
  'аллопуринол': ['allopurinol'],
  'ондансетрон': ['ondansetron'],
  'домперидон': ['domperidone', 'мотилиум', 'motilium'],
  'метоклопрамид': ['metoclopramide'],
  'варениклин': ['varenicline', 'чампикс', 'champix'],
  'бупропион': ['bupropion', 'зибан', 'zyban'],
  'тенофовир': ['tenofovir'],
  'ацикловир': ['acyclovir'],
  'тизанидин': ['tizanidine'],
  'клонидин': ['clonidine'],
  'баклофен': ['baclofen'],
  'кетоконазол': ['ketoconazole'],
  'ацетазоламид': ['acetazolamide', 'диакарб', 'diacarb'],
  'изониазид': ['isoniazid'],
  'рифампицин': ['rifampicin', 'rifampin', 'рифампицин'],
  'финастерид': ['finasteride', 'проскар', 'proscar', 'проpecia', 'propecia'],
  'дутастерид': ['dutasteride', 'аводарт', 'avodart'],
  'гинкго': ['ginkgo', 'гинкго билоба', 'ginkgo biloba'],
  'чеснок': ['garlic', 'garlic_extract', 'аджоен', 'ajoene'],
  'кофеин': ['caffeine', 'кофеин'],
};

// Индекс: каждый токен (нормализованный) → объединённый набор всех вариантов
const DRUG_ALIAS_INDEX = new Map<string, string[]>();
for (const [canon, aliases] of Object.entries(DRUG_ALIASES)) {
  const all = [canon, ...aliases].map(normId);
  const set = Array.from(new Set(all));
  for (const tok of set) DRUG_ALIAS_INDEX.set(tok, set);
}

/** Расширить название ЛС до объединённого набора нормализованных токенов (en+ru). */
export function expandDrug(s: string): string[] {
  const n = normId(s);
  const hit = DRUG_ALIAS_INDEX.get(n);
  if (hit) return [...hit];
  // частичное совпадение по подстроке (напр. ввод «рамиприл» ⊂ «иапф (рамиприл)»)
  for (const [, set] of DRUG_ALIAS_INDEX) {
    if (set.some(t => t.includes(n) || n.includes(t))) return [...set];
  }
  return [n];
}

// Критичные ЛЕКАРСТВО-ЛЕКАРСТВО комбинации (оба — ЛС, не добавки)
const DRUG_DRUG_BLACKLIST: Array<{ a: string; b: string; effect: string; severity: 'HIGH'; mechanism: string }> = [
  { a: 'силденафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ (жизнеугрожающее)', severity: 'HIGH', mechanism: 'NO/цГМФ путь — абсолютное противопоказание' },
  { a: 'тадалафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ', severity: 'HIGH', mechanism: 'NO-доноры + PDE5 = абсолютное противопоказание' },
  { a: 'ваденафил', b: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ', severity: 'HIGH', mechanism: 'NO/цГМФ путь — абсолютное противопоказание' },
  { a: 'альфа-блокатор', b: 'тадалафил', effect: 'Симптоматическая гипотония/коллапс', severity: 'HIGH', mechanism: 'α1-блокада + PDE5 вазодилатация' },
];

export function getDrugSafetyExclusions(
  candidateIds: string[],
  userMeds: string[]
): { excluded: DrugSafetyExclusion[]; titrations: DrugSafetyTitration[] } {
  if (!userMeds.length || !candidateIds.length) return { excluded: [], titrations: [] };
  const excluded: DrugSafetyExclusion[] = [];
  const titrations: DrugSafetyTitration[] = [];
  // Расширенные токены ЛС пользователя (en+ru алиасы) для точного матча
  const medTokens = userMeds.flatMap(m => expandDrug(m));

  // 1. КОМПРЕХЕНСИВНАЯ проверка Drug-Drug взаимодействий (новый модуль)
  const ddiBlocks = hasBlockingInteraction(userMeds, candidateIds);
  for (const ddi of ddiBlocks) {
    titrations.push({
      substanceId: '__DRUG_DRUG_BLOCK__',
      substanceName: `${ddi.drugA} + ${ddi.drugB}`,
      drug: `${ddi.drugA} + ${ddi.drugB}`,
      effect: ddi.clinicalEffect,
      mechanism: ddi.mechanism,
      recommendation: `🛑 ${ddi.severity === 'block' ? 'АБСОЛЮТНЫЙ ЗАПРЕТ' : 'КРИТИЧЕСКИЙ РИСК'}. ${ddi.management} Альтернативы: ${ddi.alternatives?.join(', ') || 'проконсультируйтесь с врачом'}.`,
    });
  }

  // 2. Существующий DRUG_DRUG_BLACKLIST (для обратной совместимости)
  for (const dd of DRUG_DRUG_BLACKLIST) {
    const aTok = expandDrug(dd.a);
    const bTok = expandDrug(dd.b);
    const hasA = medTokens.some(m => aTok.includes(m));
    const hasB = medTokens.some(m => bTok.includes(m));
    if (hasA && hasB) {
      titrations.push({
        substanceId: '__DRUG_DRUG__',
        substanceName: `${dd.a} + ${dd.b}`,
        drug: `${dd.a} + ${dd.b}`,
        effect: dd.effect,
        mechanism: dd.mechanism,
        recommendation: `🛑 АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ. Немедленно проконсультируйтесь с врачом. Данную комбинацию лекарств НЕ принимайте.`,
      });
    }
  }

  // 3. Проверка Drug-Drug для всех комбинаций userMeds × userMeds (новый модуль)
  const allUserMeds = userMeds.map(m => m.toLowerCase());
  for (let i = 0; i < allUserMeds.length; i++) {
    for (let j = i + 1; j < allUserMeds.length; j++) {
      const pairDDI = getDDIForPair(allUserMeds[i], allUserMeds[j]);
      for (const ddi of pairDDI) {
        if (ddi.severity === 'block' || ddi.severity === 'critical') {
          titrations.push({
            substanceId: '__DRUG_DRUG_PAIR__',
            substanceName: `${ddi.drugA} + ${ddi.drugB}`,
            drug: `${ddi.drugA} + ${ddi.drugB}`,
            effect: ddi.clinicalEffect,
            mechanism: ddi.mechanism,
            recommendation: `🛑 ${ddi.severity === 'block' ? 'АБСОЛЮТНЫЙ ЗАПРЕТ' : 'КРИТИЧЕСКИЙ РИСК'}. ${ddi.management} Альтернативы: ${ddi.alternatives?.join(', ') || 'проконсультируйтесь с врачом'}.`,
          });
        }
      }
    }
  }

  // 4. Drug-Supplement interactions (from INTERACTIONS_DB)
  for (const subId of candidateIds) {
    const cat = SUPPORT_CATALOG_DATA[subId];
    if (!cat) continue;
    const candidateTokens = new Set([
      ...interactionTokens(subId),
      ...interactionTokens(cat.nameRu || ''),
      ...interactionTokens(cat.name || ''),
    ]);

    for (const inter of INTERACTIONS_DB) {
      const aTokens = interactionTokens(inter.substanceA);
      const bTokens = interactionTokens(inter.substanceB);
      const aIsCandidate = aTokens.some(token => candidateTokens.has(token));
      const bIsCandidate = bTokens.some(token => candidateTokens.has(token));
      // Check if this interaction involves the candidate supplement
      if (aIsCandidate === bIsCandidate) continue;

      // Determine which side is the drug and which is the supplement
      // Check if the other side matches any user medication (using drug aliases)
      const otherSide = aIsCandidate ? inter.substanceB : inter.substanceA;
      const otherTokens = interactionTokens(otherSide);
      const drugMatch = medTokens.some(tok => otherTokens.some(other => tok.includes(other) || other.includes(tok)));
      if (!drugMatch) continue;

      const drugName = otherSide;
      if (inter.severity === 'HIGH') {
        excluded.push({
          substanceId: subId,
          substanceName: cat.nameRu || cat.name || subId,
          drug: drugName,
          effect: inter.effect,
          severity: inter.severity,
          mechanism: (inter.mechanisms || []).join('; '),
        });
      } else {
        titrations.push({
          substanceId: subId,
          substanceName: cat.nameRu || cat.name || subId,
          drug: drugName,
          effect: inter.effect,
          mechanism: (inter.mechanisms || []).join('; '),
          recommendation: `⚠ Снизить дозу и контролировать анализы (риск ${inter.severity}). ${inter.effect}`,
        });
      }
    }
  }
  return { excluded, titrations };
}

export function getSafeStackRecommendations(
  allRecommended: string[],
  userMeds: string[]
): { safe: string[]; excluded: DrugSafetyExclusion[]; titrations: DrugSafetyTitration[] } {
  const { excluded, titrations } = getDrugSafetyExclusions(allRecommended, userMeds);
  const excludeIds = new Set(excluded.map(e => e.substanceId));
  const safe = allRecommended.filter(id => !excludeIds.has(id));
  return { safe, excluded, titrations };
}

/* ════════════════════════════════════════════════════════════════════
   TELEGRAM REMINDER SCHEDULING
   ════════════════════════════════════════════════════════════════════ */

export interface ReminderConfig {
  morningTime: string;   // '08:00'
  eveningTime: string;   // '20:00'
  enabled: boolean;
}

const REMINDER_KEY = 'he_biostack_reminders';

export function getReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { morningTime: '08:00', eveningTime: '20:00', enabled: false };
}

export function saveReminderConfig(config: ReminderConfig): void {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(config));
}

export function scheduleTelegramReminder(config: ReminderConfig): void {
  if (!config.enabled) return;
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const now = new Date();
    const [mh, mm] = config.morningTime.split(':').map(Number);
    const [eh, em] = config.eveningTime.split(':').map(Number);
    const morningTarget = new Date(now); morningTarget.setHours(mh, mm, 0, 0);
    const eveningTarget = new Date(now); eveningTarget.setHours(eh, em, 0, 0);

    if (now < morningTarget) {
      const msUntil = morningTarget.getTime() - now.getTime();
      setTimeout(() => {
        tg.showPopup?.({ title: '💊 BioStack', message: 'Утренний приём БАДов! Отметьте compliance в стеке.', buttons: [{ type: 'ok' }] });
        tg.HapticFeedback?.notificationOccurred?.('warning');
      }, msUntil);
    }
    if (now < eveningTarget) {
      const msUntil = eveningTarget.getTime() - now.getTime();
      setTimeout(() => {
        tg.showPopup?.({ title: '💊 BioStack', message: 'Вечерний приём БАДов! Проверьте стек.', buttons: [{ type: 'ok' }] });
        tg.HapticFeedback?.notificationOccurred?.('warning');
      }, msUntil);
    }
  } catch {}
}
