/**
 * bb-course-sync.ts — чистый мост «Активный курс (settings.pharma) → BB-Auto».
 *
 * Решает две критические проблемы без поломки существующих тестов course-sync.test.ts:
 *  1) Ежедневные препараты (GH, insulin, IGF-1, clen, T3) в course-sync хранятся
 *     в НЕДЕЛЬНОЙ сумме (28 МЕ/нед = 4 МЕ/день), а BB-движок ожидает ДНЕВНЫЕ
 *     единицы (МЕ/день, мкг/день) — здесь недельная сумма корректно делится на 7.
 *  2) Учитываются фазы фармакологии: course/blast, cruise/bridge (потолок ~200 мг,
 *     объём ×0.85, RIR +1), pct (onCourse=false, восст ×0.80, RIR +1, без отказных),
 *     off/baseline.
 */
import type { CourseIntensity, PED } from './bb-ped-adaptation.engine';
import { computeAASEquivDose } from './bb-ped-adaptation.engine';

export type BBPharmaPhase = 'course' | 'cruise' | 'pct' | 'off';

export interface BBPharmaSubstanceLike {
  id?: string;
  name?: string;
  category?: string;
  route?: string;
  doseMg?: number;
  weeklyDose?: number;
  unit?: string;
}

export interface BBPharmaSyncInput {
  phase?: string;
  onCourse?: boolean;
  substances?: BBPharmaSubstanceLike[];
  courseIntensity?: string;
  age?: number;
}

export interface BBPharmaSyncResult {
  hasActiveCourse: boolean;
  phase: BBPharmaPhase;
  onCourse: boolean;
  peds: PED[];
  pedDoses: Record<string, number>;
  courseIntensity: CourseIntensity;
  volumeMult: number;
  recoveryMult: number;
  rirShift: number;
  disallowFailureTechniques: boolean;
  summary: string;
}

export function normalizeBBPharmaPhase(rawPhase?: string, onCourse?: boolean): BBPharmaPhase {
  const s = String(rawPhase || '').toLowerCase().trim();
  if (s === 'pct' || s === 'пкт') return 'pct';
  if (s === 'cruise' || s === 'bridge' || s === 'круиз' || s === 'мост' || s === 'trt' || s === 'гзт') return 'cruise';
  if (s === 'course' || s === 'blast' || s === 'курс' || s === 'бласт') return 'course';
  if (s === 'off' || s === 'baseline' || s === 'natural') return 'off';
  return onCourse ? 'course' : 'off';
}

const AAS_RE = /test|tren|deca|nandro|npp|bold|equip|prim|mast|drost|stan|winstrol|oxan|anavar|dianabol|dbol|methan|anadrol|oxymeth|turinabol|tbol|superdrol|sdrol|halo|provir|dhb|trest|ment|sust|aas|sarm|ostarine|lgd|rad140|yk11/i;
const ORAL_17AA_RE = /dianabol|dbol|methand|anadrol|oxymeth|turinabol|tbol|winstrol|stan|anavar|oxan|superdrol|sdrol|halo|methyltest/i;
const GH_RE = /^(gh|hgh|somatrop|ghrp|cjc|sermorelin|ipamorelin)/i;
const INS_RE = /^(ins|insulin|humalog|novorapid|lantus|apida)/i;
const IGF_RE = /^igf/i;
const MGF_RE = /^(peg[-_]?)?mgf/i;

const weeklyVal = (s: BBPharmaSubstanceLike): number => {
  const v = Number(s.weeklyDose ?? s.doseMg);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const toDailyDose = (s: BBPharmaSubstanceLike): number => {
  const wk = weeklyVal(s);
  if (wk <= 0) return 0;
  const unit = String(s.unit || '').toLowerCase();
  if (unit.includes('/day') || unit.includes('/д')) return Math.round(wk * 10) / 10;
  return Math.round((wk / 7) * 10) / 10;
};

export function deriveBBPedFromPharma(input: BBPharmaSyncInput): BBPharmaSyncResult {
  if (input.age != null && Number(input.age) > 0 && Number(input.age) < 18) {
    return {
      hasActiveCourse: false,
      phase: 'off',
      onCourse: false,
      peds: [],
      pedDoses: {},
      courseIntensity: 'mild',
      volumeMult: 1,
      recoveryMult: 1,
      rirShift: 0,
      disallowFailureTechniques: false,
      summary: 'Возраст < 18 лет: натуральный режим',
    };
  }

  const subs = Array.isArray(input.substances) ? input.substances.filter((s) => s && weeklyVal(s) > 0) : [];
  const hasAnyActiveSub = subs.some((s) => {
    const id = String(s.id || s.name || '');
    return s.category === 'aas' || s.category === 'sarm' || s.category === 'hgh' || s.category === 'insulin'
      || AAS_RE.test(id) || GH_RE.test(id) || INS_RE.test(id) || IGF_RE.test(id) || MGF_RE.test(id);
  });
  const phase = normalizeBBPharmaPhase(input.phase, input.onCourse || hasAnyActiveSub);

  if (phase === 'off') {
    return {
      hasActiveCourse: false,
      phase: 'off',
      onCourse: false,
      peds: [],
      pedDoses: {},
      courseIntensity: 'mild',
      volumeMult: 1,
      recoveryMult: 1,
      rirShift: 0,
      disallowFailureTechniques: false,
      summary: 'Натуральный режим (off)',
    };
  }

  if (phase === 'pct') {
    return {
      hasActiveCourse: true,
      phase: 'pct',
      onCourse: false,
      peds: [],
      pedDoses: {},
      courseIntensity: 'mild',
      volumeMult: 0.8,
      recoveryMult: 0.8,
      rirShift: 1,
      disallowFailureTechniques: true,
      summary: 'ПКТ: андрогены неактивны — объём ×0.80, восстановление ×0.80, RIR +1, без отказных техник',
    };
  }

  const perSubDoses: Record<string, number> = {};
  let ghDaily = 0;
  let insDaily = 0;
  let igfDaily = 0;
  let mgfWeekly = 0;
  let oral17aaCount = 0;
  let hasAasSub = false;

  for (const s of subs) {
    const id = String(s.id || '').toLowerCase();
    const label = `${s.id || ''} ${s.name || ''}`;
    const wk = weeklyVal(s);
    if (s.category === 'hgh' || GH_RE.test(id)) {
      ghDaily += toDailyDose(s);
    } else if (s.category === 'insulin' || INS_RE.test(id)) {
      insDaily += toDailyDose(s);
    } else if (IGF_RE.test(id)) {
      igfDaily += toDailyDose(s);
    } else if (MGF_RE.test(id)) {
      mgfWeekly += wk;
    } else if (s.category === 'aas' || s.category === 'sarm' || AAS_RE.test(label)) {
      hasAasSub = true;
      const key = id || 'AAS';
      perSubDoses[key] = (perSubDoses[key] || 0) + wk;
      if (s.route === 'oral' || ORAL_17AA_RE.test(label)) oral17aaCount++;
    }
  }

  const pedDoses: Record<string, number> = { ...perSubDoses };
  const teq = computeAASEquivDose(perSubDoses);
  const effectiveAas = phase === 'cruise' ? Math.min(200, teq || 150) : teq;
  const peds: PED[] = [];

  if (hasAasSub || effectiveAas > 0 || phase === 'cruise') {
    peds.push('AAS');
    if (effectiveAas > 0) pedDoses.AAS = Math.round(effectiveAas);
  }
  if (ghDaily > 0) {
    peds.push('GH');
    pedDoses.GH = Math.round(ghDaily * 10) / 10;
  }
  if (insDaily > 0) {
    peds.push('insulin');
    pedDoses.insulin = Math.round(insDaily * 10) / 10;
  }
  if (igfDaily > 0) {
    peds.push('IGF1');
    pedDoses.IGF1 = Math.round(igfDaily * 10) / 10;
  }
  if (mgfWeekly > 0) {
    peds.push('MGF');
    pedDoses.MGF = Math.round(mgfWeekly);
  }

  let courseIntensity: CourseIntensity = 'mild';
  if (phase === 'course') {
    if (effectiveAas >= 1000 || (effectiveAas >= 600 && (ghDaily > 0 || insDaily > 0))) courseIntensity = 'heavy';
    else if (effectiveAas >= 400 || oral17aaCount > 0 || ghDaily > 0 || insDaily > 0) courseIntensity = 'moderate';
  }

  const parts: string[] = [];
  if (pedDoses.AAS) parts.push(`AAS ~${pedDoses.AAS} мг T-eq/нед`);
  if (pedDoses.GH) parts.push(`ГР ${pedDoses.GH} МЕ/д`);
  if (pedDoses.insulin) parts.push(`Инсулин ${pedDoses.insulin} МЕ/д`);
  if (pedDoses.IGF1) parts.push(`IGF-1 ${pedDoses.IGF1} мкг/д`);
  if (pedDoses.MGF) parts.push(`MGF ${pedDoses.MGF} мкг/нед`);

  return {
    hasActiveCourse: true,
    phase,
    onCourse: true,
    peds,
    pedDoses,
    courseIntensity,
    volumeMult: phase === 'cruise' ? 0.85 : 1,
    recoveryMult: 1,
    rirShift: phase === 'cruise' ? 1 : 0,
    disallowFailureTechniques: phase === 'cruise',
    summary: phase === 'cruise'
      ? `Круиз (${parts.join(' · ') || 'TRT'}): объём ×0.85, RIR +1`
      : `Курс (${parts.join(' · ') || 'активный'})`,
  };
}
