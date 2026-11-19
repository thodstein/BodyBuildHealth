// Lab Analysis Engine — interprets lab values into mechanisms, organs, systems, risks
import type { LabPoint } from '../core/types';
import { convertToUnit } from '../core/labs-mapping';
import { boundProvesSide, boundsComparable, type LabBound } from '../core/lab-bound';
import {
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN, FEMALE_HORMONE_ULN, e2PgPerMl,
} from './lab-norms.engine';
import { phaseHormoneBand, phaseUnionBand, type CycleState } from './female-cycle-phase.engine';

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
  /**
   * Маркеры, у которых в бланке стоит граница, а сторону она не доказывает
   * (проход 150): «СРБ <5» при верхней 3 не говорит ни «выше», ни «в норме».
   * Такие записи не превращаются в вывод и не исчезают молча — их называет этот
   * список (экран маркеров считает их «без вывода» своим счётчиком, проход 147).
   */
  boundUnproven?: { code: string; value: number; bound: LabBound }[];
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

/**
 * Значение маркера вместе со знаком границы из бланка (проход 150).
 *
 * Возвращает `null`, если записи нет. Знак едет рядом с числом: без него
 * «СРБ <5» не отличается от «СРБ 5», и движок делал вывод о стороне, которую
 * бланк не доказал.
 */
function findLabPoint(labs: LabPoint[], code: string): { value: number; bound?: LabBound } | null {
  const upper = code.toUpperCase();
  const lab = labs.find(l => {
    const lc = l.code?.toUpperCase() || '';
    if (lc === upper) return true;
    if (lc.replace(/[^A-Z0-9]/g, '_') === upper) return true;
    const aliases = LAB_CODE_ALIASES[lc];
    if (aliases && aliases.includes(upper)) return true;
    return false;
  });
  if (!lab) return null;
  // Проход 86: значение приводится из единицы бланка к единице приложения
  // (`REFERENCE_RANGES[code].unit`). Поле единицы в форме — свободный текст,
  // поэтому без пересчёта «600 нг/дл» тестостерона читалось как 600 нмоль/л, а
  // пролактин «15 нг/мл» — как 15 мЕд/л. Проход 84: если единицу разобрать не
  // удалось, у E2 остаётся честный перевод пмоль/л.
  const converted = convertToUnit(code, lab.value, lab.unit || '', REFERENCE_RANGES[code]?.unit || '');
  // Пересчёт единицы — умножение на положительный коэффициент: знак границы
  // при этом не меняется, поэтому он переносится как есть.
  if (converted !== null) return { value: converted, bound: lab.bound };
  if (upper === 'ESTRADIOL') return { value: e2PgPerMl(lab.value, lab.unit), bound: lab.bound };
  return { value: lab.value, bound: lab.bound };
}

function findLab(labs: LabPoint[], code: string): number | null {
  return findLabPoint(labs, code)?.value ?? null;
}

/**
 * Число, пригодное для вывода (проход 150).
 *
 * Точное число — как есть. С границей — только если граница доказывает сторону,
 * которая для этого маркера означает «плохо» (`bad`): «ALT >1000» доказывает
 * высокое, «HDL <0.5» — низкое, а «СРБ <5» при верхней 3 не доказывает ничего и
 * считается отсутствующим измерением, а не точным числом.
 */
function usable(
  read: { value: number; bound?: LabBound } | null,
  low: number | undefined,
  high: number | undefined,
  bad: 'high' | 'low' | 'both' = 'high',
): number | null {
  if (!read) return null;
  if (!read.bound) return read.value;
  const side = boundProvesSide(read.bound, read.value, low, high);
  if (!side) return null;
  if (bad === 'both') return read.value;
  return side === bad ? read.value : null;
}

/**
 * Число маркера для составного индекса (проход 150).
 *
 * Точное — как есть. С границей — только если доказана «плохая» сторона
 * (`usable`), иначе маркер считается неизмеренным и берётся прежнее значение по
 * умолчанию: индекс не должен ни расти, ни падать от обрезанного числа.
 */
function metric(labs: LabPoint[], code: string, fallback: number, bad: 'high' | 'low' | 'both' = 'high'): number {
  const ref = REFERENCE_RANGES[code];
  return usable(findLabPoint(labs, code), ref?.low, ref?.high, bad) ?? fallback;
}

/** Число без границы: «>N» не даёт ни отношения, ни вывода о стороне. */
function exactOnly(read: { value: number; bound?: LabBound } | null): number | null {
  return read && !read.bound ? read.value : null;
}

export function computeHOMA_IR(glucose: number, insulin: number): number {
  if (!glucose || !insulin || glucose <= 0 || insulin <= 0) return 0;
  return (glucose * insulin) / 22.5;
}

export function interpretLabs(labs: LabPoint[], sex?: 'male' | 'female', cycle?: CycleState | null): LabCompositeResult {
  const fem = sex === 'female';
  const interpretations: LabInterpretation[] = [];
  const boundUnproven: { code: string; value: number; bound: LabBound }[] = [];

  for (const [code, ref] of Object.entries(REFERENCE_RANGES)) {
    const read = findLabPoint(labs, code);
    if (read === null) continue;
    const value = read.value;

    // ♀ — женские границы того же маркера (без sex — прежний мужской ряд).
    const r = fem ? { ...ref, ...(FEMALE_REFERENCE_OVERRIDES[code] || {}) } : ref;

    // Проход 77: у женщины верх E2 — коридор её фазы (фолл. 200 / лют. 500 пг/мл),
    // а не общий жёлтый бэнд 400: значок маркера и гормональный балл должны читать
    // одно и то же число. Без фазы (и в овуляторную) — прежние 400/800.
    let bounds = r;
    if (fem && code === 'ESTRADIOL') {
      const band = phaseHormoneBand('E2', cycle?.phase);
      if (band) bounds = { ...r, high: band.high };
    }

    // Проход 82: у женщины ЛГ и ФСГ — тоже фазовые. Мужская строка (ЛГ 1–10,
    // «критично» от 15; ФСГ 1–12, «критично» от 18) её нормальную лютеиновую ЛГ 20
    // и пик овуляции читала как «критично». Верх — коридор её фазы (или
    // объединение фаз, если даты нет): красной границы у женщины нет вовсе, пик
    // овуляции не «экстрено». Низ оставляем прежним (1 МЕ/л): подавление оси на
    // курсе — как раз то, что этот порог и должен ловить.
    if (fem && (code === 'LH' || code === 'FSH')) {
      const band = phaseHormoneBand(code, cycle?.phase) ?? phaseUnionBand(code);
      bounds = { ...r, high: band.high, criticalHigh: Number.POSITIVE_INFINITY };
    }

    let status: LabInterpretation['status'] = 'normal';
    // Проход 150: сторону отклонения доказывает либо точное число, либо граница
    // (`boundProvesSide` — то же правило, что у дневника, трендов и отчёта).
    // «СРБ <5» при верхней границе 3 не говорит ни «выше», ни «в норме»: вывода
    // нет, запись попадает в `boundUnproven`, а не в «системное воспаление».
    const proven = boundProvesSide(read.bound, value, bounds.low, bounds.high);
    if (!proven) {
      if (read.bound) boundUnproven.push({ code, value, bound: read.bound });
      continue;
    }
    status = proven;
    // P0 fix: high = >high, critical = >criticalHigh (раньше было max(high, critical-1)=79 для ALT 40/80 → 50 считался нормой).
    // Проход 150: «>N» при N ≥ критической границы доказывает критическое, а
    // точное число — строгим сравнением, как раньше.
    if (proven === 'high' && (value > bounds.criticalHigh || (read.bound === '>' && value >= bounds.criticalHigh))) {
      status = 'critical_high';
    }

    // Проход 82: женщине высокий ЛГ/ФСГ не приписываем мужской механизм
    // «подавление оси» и риск «низкий тестостерон». Высокий гонадотропин у неё
    // — не подавление, а пик овуляции / СПКЯ / перименопауза, и разбирается он
    // фазой (строка результата уже фазово-честная) и клиникой, а не этой
    // механикой. Низкий гонадотропин остаётся: подавление оси на курсе — ровно
    // то, что этот механизм и должен ловить.
    const maleFramedHigh = fem && (code === 'LH' || code === 'FSH') && status !== 'low';
    const mapped = LAB_MECHANISM_MAP[code];
    if (mapped && !maleFramedHigh) {
      const riskPct = status === 'critical_high' ? 40 : status === 'high' ? 25 : 15;
      interpretations.push({ code, value, status, ...mapped, riskPercent: riskPct });
    }
  }

  // Проход 89: прогестерон в разборе — женский и строго фазовый.
  //
  // Мужской шкалы не заводим намеренно: у мужчины прогестерон почти не
  // заказывают, а «норма 0.3–1.5 нг/мл» без клинической линии дала бы ложные
  // значки ровно там, где ничего не значит. Женский сигнал один: в лютеиновую
  // прогестерон ниже 5 нг/мл означает, что овуляции, вероятно, не было (жёлтое
  // тело не сформировалось). В фолликулярную низкий прогестерон — норма, а без
  // дня цикла судить нельзя вовсе, поэтому фазы нет — молчим.
  if (fem && cycle?.phase === 'luteal') {
    // Проход 150: обрезанный прогестерон («<5») не доказывает ановуляцию —
    // отношение/сравнение с коридором требует точного числа.
    const prog = exactOnly(findLabPoint(labs, 'PROGESTERONE'));
    const band = phaseHormoneBand('PROG', 'luteal');
    if (prog !== null && band && prog < band.low) {
      interpretations.push({
        code: 'PROGESTERONE',
        value: prog,
        status: 'low',
        mechanism: 'ANOVULATION',
        organ: 'ovary',
        system: 'endocrine',
        risk: 'HORMONE_LOW_PROG',
        riskPercent: 25,
      });
    }
  }

  // Проход 90: у женщины высокие ЛГ/ФСГ разбираются своей линией — и только в
  // базовой фазе (2–5 день), где они вообще интерпретируемы. Пик овуляции и
  // лютеиновая ЛГ — физиология, а не СПКЯ, поэтому в других фазах молчим.
  // ЛГ > 10 при ЛГ/ФСГ > 2 — повод исключить СПКЯ; ФСГ выше верха фолликулярного
  // коридора (10 МЕ/л) на базовой линии — снижение овариального резерва. Оба
  // порога — те же, что в панелях либидо и фертильности, не новые числа.
  if (fem && (cycle?.phase === 'follicular' || cycle?.phase === 'menstrual')) {
    // Проход 150: ЛГ/ФСГ берутся только точными — отношение «>N»/«<N» не
    // считается, иначе «ЛГ >10» превращалось в «СПКЯ» без числа.
    const lh = exactOnly(findLabPoint(labs, 'LH'));
    const fsh = exactOnly(findLabPoint(labs, 'FSH'));
    const fshBand = phaseHormoneBand('FSH', 'follicular');
    const lhBaseHigh = fshBand ? fshBand.high : null;
    if (lhBaseHigh !== null) {
      if (fsh !== null && fsh > lhBaseHigh) {
        interpretations.push({
          code: 'FSH',
          value: fsh,
          status: 'high',
          mechanism: 'OVARIAN_RESERVE_LOW',
          organ: 'ovary',
          system: 'endocrine',
          risk: 'FERTILITY_LOW_RESERVE',
          riskPercent: 15,
        });
      }
      if (lh !== null && fsh !== null && fsh > 0 && lh > lhBaseHigh && lh / fsh > 2) {
        interpretations.push({
          code: 'LH',
          value: lh,
          status: 'high',
          mechanism: 'PCOS_SUSPECT',
          organ: 'ovary',
          system: 'endocrine',
          risk: 'PCOS_SUSPECT',
          riskPercent: 15,
        });
      }
    }
  }

  const glucose = findLab(labs, 'GLUCOSE') ?? 0;
  const insulin = findLab(labs, 'INSULIN') ?? 0;
  // Проход 150: HOMA-IR — только по двум точным числам. Граница любой половины
  // («глюкоза >20») делает HOMA неизвестным, а не нижней оценкой.
  const glucoseRead = findLabPoint(labs, 'GLUCOSE');
  const insulinRead = findLabPoint(labs, 'INSULIN');
  const homaIR =
    boundsComparable(glucoseRead?.bound, insulinRead?.bound) && glucose > 0 && insulin > 0
      ? computeHOMA_IR(glucose, insulin)
      : null;

  // Индекс печени — в долях ВГН пациента (♀ 31, ♂ 40): раньше всегда делили на
  // мужские 40, и её АЛТ 35 давал заниженный «стресс печени». Пустые значения по
  // умолчанию держат индекс на прежнем уровне (75) у обоих полов.
  const lftBase = fem ? LFT_ULN.ALT.female : LFT_ULN.ALT.male;
  const defaultLft = Math.round(30 * (lftBase / 40));
  const alt = metric(labs, 'ALT', defaultLft);
  const ast = metric(labs, 'AST', defaultLft);
  const ggt = metric(labs, 'GGT', defaultLft);
  const liverStress = Math.round(((alt + ast + ggt) / 3 / lftBase) * 100);

  // Проход 150: для HDL «плохо» — низкое, для остальных липидов — высокое.
  const ldl = metric(labs, 'LDL', 2.5);
  const hdl = metric(labs, 'HDL', 1.3, 'low');
  const tg = metric(labs, 'TRIGLYCERIDES', 1.2);
  const apob = metric(labs, 'APOB', 0.8);
  const cardioRisk = Math.round(((ldl + apob * 3 + tg / 2) / (hdl || 1)) * 10);

  const crp = metric(labs, 'CRP', 1.5);
  const ferritin = metric(labs, 'FERRITIN', 100);
  const inflammation = Math.round(crp + (ferritin / 100));

  // Индекс почек — от ВГН креатинина пациента (♀ 97, ♂ 110), а не от 110 для всех.
  const crBase = fem ? CREATININE_ULN.female : CREATININE_ULN.male;
  const creatinine = metric(labs, 'CREATININE', Math.round(90 * (crBase / 110)));
  const urea = metric(labs, 'UREA', 5);
  const kidneyStress = Math.round(((creatinine / crBase) * 60 + (urea / 8.3) * 40));

  // Гормоны штрафуются за обе стороны, поэтому доказанная граница годится в любую
  // сторону; недоказанная — как отсутствие записи (штрафа нет, вывода нет).
  const refTT = REFERENCE_RANGES.TESTOSTERONE_TOTAL;
  const refFT = REFERENCE_RANGES.TESTOSTERONE_FREE;
  const refE2 = REFERENCE_RANGES.ESTRADIOL;
  const refPrl = REFERENCE_RANGES.PROLACTIN;
  const testTotal = usable(findLabPoint(labs, 'TESTOSTERONE_TOTAL'), refTT.low, refTT.high, 'both');
  const testFree = usable(findLabPoint(labs, 'TESTOSTERONE_FREE'), refFT.low, refFT.high, 'both');
  const e2 = usable(findLabPoint(labs, 'ESTRADIOL'), refE2.low, refE2.high, 'both');
  const prolactin = usable(findLabPoint(labs, 'PROLACTIN'), refPrl.low, refPrl.high, 'high');
  let hormoneScore = 0;
  // ♀ Низкий тестостерон — не дефицит (у неё нормы другие), штраф только мужчинам.
  if (!fem && testTotal !== null && testTotal < 15) hormoneScore += 30;
  if (!fem && testFree !== null && testFree < 0.3) hormoneScore += 25;
  // E2 у женщины — фазовая модель: нижняя граница остаётся красным бэндом (<30),
  // потому что в менструальную фазу E2 низкий по природе; верхняя берётся из
  // коридора ЕЁ фазы (фолл. 200 / лют. 500 пг/мл), а когда фазы нет (или она
  // овуляторная) — прежний красный бэнд 800. Без этого её нормальная 450 в
  // лютеиновую читалась бы по мужскому окну, а 300 в фолликулярную — как «норма».
  if (e2 !== null) {
    if (fem) {
      const band = phaseHormoneBand('E2', cycle?.phase);
      const highCut = band ? band.high : FEMALE_HORMONE_ULN.E2.criticalHigh;
      if (e2 < FEMALE_HORMONE_ULN.E2.low || e2 > highCut) hormoneScore += 25;
    } else if (e2 > 160 || e2 < 40) {
      hormoneScore += 25;
    }
  }
  const prlCut = fem ? FEMALE_HORMONE_ULN.PRL.high : 350;
  if (prolactin !== null && prolactin > prlCut) hormoneScore += 20;

  // Проход 91: женские механизмы (ановуляция, снижение овариального резерва,
  // СПКЯ-подозрение) входят в гормональный балл — только женщине и ровно по тем
  // условиям, что уже дали интерпретацию. Второго набора порогов нет: балл читает
  // то же, что видит человек в разборе, поэтому они не могут разойтись.
  // Ановуляция весит больше остальных: без овуляции нет ни лютеиновой фазы, ни
  // беременности, и это единственный из трёх механизмов, который виден по числу
  // без УЗИ и анамнеза.
  if (fem) {
    for (const interp of interpretations) {
      if (interp.mechanism === 'ANOVULATION') hormoneScore += 20;
      else if (interp.mechanism === 'OVARIAN_RESERVE_LOW' || interp.mechanism === 'PCOS_SUSPECT') hormoneScore += 15;
    }
  }

  hormoneScore = Math.min(100, hormoneScore);

  return { homaIR, liverStress, cardioRisk, inflammation, kidneyStress, hormoneScore, interpretations, boundUnproven };
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
