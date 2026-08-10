import synonyms from '../data/labs-synonyms.json';
import { UCUM_MAP, DYNAMIC_REFS } from './constants';

const SYNONYM_MAP = synonyms as Record<string, string>;

/** Maps LAB_PATTERNS codes to UCUM_MAP keys where they differ */
const CODE_ALIAS: Record<string, string> = {
  // ── pdf-parser engine codes ──
  'CREATININE': 'CREATININE',
  'HEMATOCRIT': 'HCT',
  'HEMOGLOBIN': 'HGB',
  'PLATELETS': 'PLT',
  'TRIGLYCERIDES': 'TG',
  'CHOLESTEROL_TOTAL': 'CHOL',
  'TESTOSTERONE_TOTAL': 'TT',
  'TESTOSTERONE_FREE': 'FT',
  'PROLACTIN': 'PRL',
  'GLUCOSE': 'GLU',
  'VITAMIN_D': 'VITD',
  'MAGNESIUM': 'MG',
  'CALCIUM': 'CA',
  'POTASSIUM': 'K',
  'SODIUM': 'NA',
  'TESTO': 'TT',
  'ESTR': 'E2',
  'FER': 'FERRITIN',
  'PROL': 'PRL',
  'CORT': 'CORTISOL',
  'DHEA': 'DHEA_S',
  'FTESTO': 'FT',
  'CREAT': 'CREATININE',
  'URIC': 'UA',
  'BILD': 'DBIL',
  'HBA1C': 'HbA1c',
  'FOLATE': 'FOL',
  'B9': 'FOL',
  'INSULIN': 'INS',
  'DIMER': 'D_DIMER',
  'FIB': 'FIBRINOGEN',
  'TROP': 'TROPONIN',
  'PHOS': 'P',
  'BILIR': 'BIL',
  // ── biomarker-regex engine codes (snake_case English names) ──
  // These must map to the same UCUM_MAP keys so markers found by both
  // engines are deduplicated instead of appearing twice.
  'BILIRUBIN_TOTAL': 'BIL',
  'BILIRUBIN_DIRECT': 'DBIL',
  'TOTAL_PROTEIN': 'TP',
  'ALBUMIN': 'ALB',
  'URIC_ACID': 'UA',
  'CHOLESTEROL': 'CHOL',
  'TRIGLYCERIDE': 'TG',
  'HOMOCYSTEINE': 'HOMOCYSTEINE',
  'VITAMIN_B12': 'B12',
  'T3_FREE': 'FT3',
  'T4_FREE': 'FT4',
  // T3/T4 (общие) — отдельные от FT3/FT4 (свободных). Было WRONG: T3→FT3, T4→FT4.
  'IGF-1': 'IGF1',
  'IGF1': 'IGF1',
  'PSA_FREE': 'PSA',
  'PHOSPHORUS': 'P',
  'FIBRINOGEN': 'FIBRINOGEN',
  'D_DIMER': 'D_DIMER',
  'APTT': 'APTT',
  'PT': 'PT',
  'INR': 'INR',
  'ESR': 'ESR',
  'HOMA-IR': 'HOMA',
  'CK': 'CK',
  'LDH': 'LDH',
  'ALP': 'ALP',
  'GGT': 'GGT',
  'ALT': 'ALT',
  'AST': 'AST',
  'CRP': 'CRP',
  'HS-CRP': 'CRP',
  'TROPONIN_I': 'TROPONIN',
  'TROPONIN_T': 'TROPONIN',
  'CK_MB': 'CKMB',
  'PTH': 'PTH',
  'MPV': 'MPV',
  'C-PEPTIDE': 'C_PEPTIDE',
  'ACTH': 'ACTH',
  'ALDOSTERONE': 'ALDOSTERONE',
  'TPO_AB': 'TPO_AB',
  'TG_AB': 'TG_AB',
  'AMYLASE': 'AMYLASE',
  'LIPASE': 'LIPASE',
  'PROINSULIN': 'PROINSULIN',
  'FRUCTOSAMINE': 'FRUCTOSAMINE',
  'TRANSFERRIN': 'TRANSFERRIN',
  'TIBC': 'TIBC',
  'FERRITIN': 'FERRITIN',
  'IRON': 'IRON',
  'SHBG': 'SHBG',
  'PSA': 'PSA',
  'DHEA_S': 'DHEA_S',
  'TSH': 'TSH',
  'E2': 'E2',
  'LH': 'LH',
  'FSH': 'FSH',
  'CORTISOL': 'CORTISOL',
  'VITD': 'VITD',
  'FOL': 'FOL',
  'INS': 'INS',
  'HGB': 'HGB',
  'HCT': 'HCT',
  'PLT': 'PLT',
  'WBC': 'WBC',
  'RBC': 'RBC',
  // ── Russian/aliases ──
  'ВЛДЛ': 'VLDL',
  'ЛПВНП': 'VLDL',
  'АКТГ': 'ACTH',
  '17-ОН': 'OH17_PROGESTERONE',
  'Альдост': 'ALDOSTERONE',
  'АТ-ТПО': 'TPO_AB',
  'АТ-ТГ': 'TG_AB',
  'МПВ': 'MPV',
  'Амилаз': 'AMYLASE',
  'Липаз': 'LIPASE',
  'Фруктоз': 'FRUCTOSAMINE',
  'UIBC': 'UIBC',
  'GLOB': 'GLOBULIN',
  'C_PEPTIDE': 'C_PEPTIDE',
  'AG_RATIO': 'A_G_RATIO',
  // ── Новые алиасы для маркёров из BIOMARKER_DICTIONARY ──
  'CK-18': 'CK_18',
  'OXLDL': 'OXLDL',
  'CORTISOL_NIGHT': 'CORTISOL_NIGHT',
  'MANGANESE': 'MANGANESE',
  'IODINE': 'IODINE',
  'CHROMIUM': 'CHROMIUM',
  'GALECTIN-3': 'GALECTIN3',
  'NEPHRIN': 'NEPHRIN',
  // ── ОАМ алиасы (для совпадения кодов парсеров с UCUM_MAP) ──
  'URINE_PROTEIN': 'PROTEIN_URINE',
  'URINE_CA': 'URINE_CALCIUM',
  'URINE_OX': 'URINE_OXALATE',
  'NECHIP_LEUKOCYTES': 'NECHIP_LEU',
  'NECHIP_ERYTHROCYTES': 'NECHIP_ERY',
  'NECHIP_CYLINDERS': 'NECHIP_CYL',
  'URINE_LEUKOCYTES': 'URINE_LEU',
  'URINE_ERYTHROCYTES': 'URINE_ERY',
  'URINE_EPITHELIUM': 'URINE_EPITHELIAL',
  'URINE_CASTS': 'URINE_CYLINDERS',
  'URINE_SPECIFIC_GRAVITY': 'URINE_SG',
  'URINE_SG_VALUE': 'URINE_SG',
  'URINE_VOLUME': 'URINE_VOLUME_24H',
  'URINE_CREATININE': 'CREATININE_URINE',
  'URINE_KETONES': 'URINE_KETONES_Q',
  'URINE_GLUCOSE': 'URINE_GLUCOSE_Q',
  'URINE_NITRITE': 'URINE_NITRITE_Q',
  'URINE_BILIRUBIN': 'URINE_BILIRUBIN_Q',
  'URINE_URATE': 'URINE_URATE',
  'URINE_OXALATES': 'URINE_OXALATE',
  'PROTEIN_URINE_24H': 'PROTEIN_24H',
  'URINE_PROTEIN_24H': 'PROTEIN_24H',
};

function unitKey(unit: string): string {
  return unit.toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\?/g, 'u')
    .replace(/д/g, 'd')
    .replace(/ё/g, 'е')
    .replace(/[\s.]/g, '')
    .replace(/литр|л(?![a-z])/g, 'l')
    .replace(/мкмоль/g, 'umol')
    .replace(/пмоль/g, 'pmol')
    .replace(/мкед/g, 'miu')
    .replace(/мед/g, 'miu')
    .replace(/мме?д/g, 'miu')
    .replace(/ммоль/g, 'mmol')
    .replace(/мг/g, 'mg')
    .replace(/нг/g, 'ng')
    .replace(/пг/g, 'pg')
    .replace(/мкг/g, 'ug')
    .replace(/мл/g, 'ml')
    .replace(/ед/g, 'u')
    .replace(/г/g, 'g');
}

/** Convert common Russian/foreign lab units to the canonical UCUM_MAP unit. */
export function normalizeLabMeasurement(code: string, value: number, unit: string): { value: number; unit: string } {
  const canonical = mapToUcumCode(code).toUpperCase();
  const info = UCUM_MAP[canonical];
  if (!info || !Number.isFinite(value)) return { value, unit: unit || info?.prefUnit || '' };
  const from = unitKey(unit);
  const target = unitKey(info.prefUnit);
  let factor = 1;

  if (from && from === target) return { value: round(value), unit: info.prefUnit };
  switch (canonical) {
    case 'CREATININE': if (from.includes('mg/dl')) factor = 88.42; break;
    case 'GLU': if (from.includes('mg/dl')) factor = 1 / 18.018; break;
    case 'UREA': if (from.includes('mg/dl')) factor = 1 / 2.801; break;
    case 'UA': if (from.includes('mg/dl')) factor = 59.48; break;
    case 'BIL': case 'DBIL': if (from.includes('mg/dl')) factor = 17.104; break;
    case 'E2': if (from.includes('pmol') || /пмоль|pmol/i.test(unit)) factor = 1 / 3.671; break;
    case 'PRL': if (from.includes('miu') || from.includes('uiu')) factor = 1 / 21.2; break;
    case 'TT': if (from.includes('nmol')) factor = 28.84; break;
    case 'FT': if (from.includes('pmol')) factor = 1 / 10; break;
    case 'VITD': if (from.includes('nmol')) factor = 1 / 2.496; break;
    case 'HGB': if (from.includes('g/dl')) factor = 10; break;
    case 'CHOL': case 'HDL': case 'LDL': if (from.includes('mg/dl')) factor = 1 / 38.67; break;
    case 'TG': if (from.includes('mg/dl')) factor = 1 / 88.57; break;
    default: break;
  }
  return { value: round(value * factor), unit: info.prefUnit };
}

function round(value: number): number {
  return Number(value.toFixed(Math.abs(value) >= 100 ? 1 : 3));
}

/** Convert any known code to a UCUM_MAP key (returns the code itself if no alias exists) */
export function mapToUcumCode(code: string): string {
  const upper = code.trim().toUpperCase();
  // Check alias FIRST — if there's a canonical mapping, use it even if the
  // code exists directly in UCUM_MAP. This prevents duplicate entries when
  // both a long-form key (e.g. TOTAL_PROTEIN) and its canonical short-form
  // (e.g. TP) exist as separate UCUM_MAP keys.
  const alias = CODE_ALIAS[upper];
  if (alias && UCUM_MAP[alias]) return alias;
  if (UCUM_MAP[upper]) return upper;
  return code;
}

/** Resolve free-text marker name to canonical UCUM code when possible. */
export function resolveLabMarker(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();
  if (UCUM_MAP[upper]) return upper;

  // OCR frequently mixes visually identical Cyrillic and Latin letters in
  // short laboratory abbreviations (e.g. АЛТ/ALT, ТТГ/TTG, СРБ/CRP).
  const visualLatin = upper
    .replace(/[АА]/g, 'A')
    .replace(/[ВВ]/g, 'B')
    .replace(/[ЕЕ]/g, 'E')
    .replace(/[КК]/g, 'K')
    .replace(/[ММ]/g, 'M')
    .replace(/[НН]/g, 'H')
    .replace(/[ОР]/g, ch => ch === 'О' ? 'O' : 'P')
    .replace(/[СС]/g, 'C')
    .replace(/[ТТ]/g, 'T')
    .replace(/[ГГ]/g, 'G')
    .replace(/[ХХ]/g, 'X');
  if (visualLatin === 'TTG') return 'TSH';
  if (UCUM_MAP[visualLatin]) return visualLatin;

  const fromSynonym = SYNONYM_MAP[trimmed.toLowerCase()];
  if (fromSynonym) {
    return mapToUcumCode(fromSynonym.toUpperCase());
  }

  const normalized = trimmed.toLowerCase().replace(/[0о]/g, 'о').replace(/[1л]/g, 'л');
  const visualSynonym = Object.keys(SYNONYM_MAP).find(key => key === normalized);
  if (visualSynonym) return mapToUcumCode(SYNONYM_MAP[visualSynonym].toUpperCase());

  return upper;
}

/** 0..1 position within reference range; null if unknown. */
export function normalizedRatio(code: string, value: number, unit: string, age?: number, sex?: 'male' | 'female'): number | null {
  const ucum = UCUM_MAP[code];
  if (!ucum) return null;
  const norm = value * ucum.coeff;
  let lln = ucum.lln;
  let uln = ucum.uln;

  const dynamic = DYNAMIC_REFS[code];
  if (dynamic && age != null && sex) {
    const ageF = typeof dynamic.ageFactor === 'function' ? dynamic.ageFactor(age) : 1;
    const sexF = typeof dynamic.sexFactor === 'function' ? dynamic.sexFactor(sex) : 1;
    lln = dynamic.baseLLN * ageF * sexF;
    uln = dynamic.baseULN * ageF * sexF;
  }

  const span = uln - lln;
  if (span <= 0) return null;
  const midpoint = (lln + uln) / 2;
  if (norm <= midpoint) {
    return Math.max(0, 0.5 * (norm - lln) / Math.max(0.001, midpoint - lln));
  } else if (norm <= uln) {
    return 0.5 + 0.5 * (norm - midpoint) / Math.max(0.001, uln - midpoint);
  } else {
    const foldAboveUln = norm / uln;
    return 1.0 + Math.log2(Math.max(1, foldAboveUln)) * 1.5;
  }
}

export function interpretRatio(ratio: number | null): string {
  if (ratio == null) return 'Нет данных';
  if (ratio < 0.2) return 'Сильно ниже нормы';
  if (ratio < 0.4) return 'Ниже нормы';
  if (ratio < 0.6) return 'В пределах нормы';
  if (ratio < 0.8) return 'Выше нормы';
  return 'Сильно выше нормы';
}

export function interpretScale(score: number): string {
  if (score < 0.2) return 'Отлично';
  if (score < 0.4) return 'Хорошо';
  if (score < 0.6) return 'Норма';
  if (score < 0.8) return 'Проблемы';
  return 'Высокий риск';
}
