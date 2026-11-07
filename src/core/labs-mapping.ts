import synonyms from '../data/labs-synonyms.json';
import { UCUM_MAP, DYNAMIC_REFS } from './constants';
import { getLabNorm } from '../engines/lab-norms.engine';

const SYNONYM_MAP = synonyms as Record<string, string>;

/** Служебные слова бланка — fuzzy-сопоставление маркеров для них запрещено. */
const NON_MARKER_WORDS = new Set([
  'дата', 'время', 'заказ', 'номер', 'пациент', 'пациентка', 'возраст', 'пол',
  'врач', 'лаборатория', 'результат', 'норма', 'референс', 'единица', 'итог',
  'всего', 'сумма', 'скидка', 'оплата', 'адрес', 'телефон', 'сайт', 'страница',
  'лист', 'отчет', 'комментарий', 'примечание', 'исследование', 'материал',
  'биоматериал', 'способ', 'метод', 'тест', 'проба', 'образец', 'штрих', 'код',
  'статус', 'готов', 'готовность', 'выдан', 'подписан', 'исполнитель', 'услуга',
  'комплекс', 'профиль', 'панель', 'каталог', 'направление', 'договор', 'счет',
  'касса', 'квитанция', 'итого', 'диагноз', 'показатель', 'наименование',
]);

/** Maps LAB_PATTERNS codes to UCUM_MAP keys where they differ */
const CODE_ALIAS: Record<string, string> = {
  // ── pdf-parser engine codes ──
  'CREATININE': 'CREATININE',
  'HEMATOCRIT': 'HCT',
  'HEMOGLOBIN': 'HGB',
  'PLATELETS': 'PLT',
  'TRIGLYCERIDES': 'TG',
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
  'BILIRUBIN_INDIRECT': 'BIL',
  'DIRECT_BIL': 'DBIL',
  'PROGESTERONE': 'PROGESTERONE',
  'ESTRADIOL_SENS': 'ESTRADIOL_SENS',
  'INHIBIN_B': 'INHIBIN_B',
  'NT_PROBNP': 'NT_PROBNP',
  'APO_A1': 'APO_A1',
  'APO_B': 'APO_B',
  'LP_A': 'LP_A',
  'HOMAIR': 'HOMAIR',
  'EGFR': 'EGFR',
  'MICROALBUMIN': 'MICROALB',
  'CYSTATIN_C': 'CYSTATIN_C',
  'KIM-1': 'KIM1',
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
  'PSA_FREE': 'PSA_FREE',
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
  'TROPONIN_I': 'TROPONIN_I',
  'TROPONIN_T': 'TROPONIN_I',
  'CK_MB': 'CK_MB',
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
  // ── Коды BIOMARKER_DICTIONARY, у которых не было UCUM-канона ──
  // Без алиаса один и тот же показатель приходил дважды: «CHOL» из
  // табличного парсера и «Cholesterol_Total» из regex-движка.
  'CHOLESTEROL_TOTAL': 'CHOL',
  'TESTOSTERONE_TOTAL': 'TT',
  'TESTOSTERONE_FREE': 'FT',
  'NT-PROBNP': 'NT_PROBNP',
  // ── Канонизация кодов парсеров ──
  // Один и тот же показатель приходил под двумя кодами: табличный парсер
  // писал PARATHYROID/ERYTHROPOIETIN/APO_B, а regex-движок и синонимы —
  // PTH/EPO/APOB. В импорте это давало ДВЕ строки на один анализ, у второй
  // не было норм и пересчёта единиц. Все алиасы ведут в ключи UCUM_MAP.
  'APOB': 'APO_B',
  'APOA1': 'APO_A1',
  'PTH': 'PARATHYROID',
  'EPO': 'ERYTHROPOIETIN',
  'ALD': 'ALDOSTERONE',
  'ANDRO': 'ANDROSTENEDIONE',
  'CL': 'CHLORIDE',
  'TRANSF': 'TRANSFERRIN',
  'CKMB': 'CK_MB',
  'AMY': 'AMYLASE',
  'CT': 'CALCITONIN',
  'PSAF': 'PSA_FREE',
  // Свободный ПСА — отдельный показатель: слияние с общим ПСА затирало
  // результат, если в бланке были обе строки.
};

/**
 * Канонический ключ единицы измерения.
 *
 * Порядок замен критичен: активность (МЕ/мЕд/мкМЕ) разбирается ДО массовых
 * единиц, иначе кириллическая «д» в «мЕд» превращается в латинскую и
 * «мЕд/л» перестаёт распознаваться как mIU/L — коэффициент для пролактина
 * (mIU/L → ng/mL) не применялся, значение сохранялось как «240 ng/mL»
 * вместо 11.3 ng/mL.
 */
function unitKey(unit: string): string {
  // Регистр «МЕ» важен: заглавные «МЕ/л», «МЕ/мл» — это IU (международные
  // единицы), а «мЕд», «мМЕ», «мкМЕ» — тысячные доли mIU/µIU. После
  // toLowerCase() различить их нельзя, и новый пересчёт активности уменьшал
  // анти-ТГ 1.8 МЕ/мл в 1000 раз (0.002 IU/мл).
  const cased = unit
    .replace(/мк\s*ме/gi, 'uIU')
    .replace(/мк\s*ед/gi, 'uIU')
    .replace(/м\s*мед/gi, 'mIU')
    .replace(/м\s*ме/gi, 'mIU')
    .replace(/м\s*ед/gi, 'mIU')
    .replace(/МЕ/g, 'IU')
    .replace(/Ед/g, 'IU');
  let key = cased.toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[µμ]/g, 'u')
    .replace(/\?/g, 'u')
    .replace(/mcmol/g, 'umol')
    .replace(/mcg/g, 'ug')
    .replace(/[\s.]/g, '');

  // Каталитическая активность (МЕ/кат): в международных бланках ферменты
  // печатают в мккат/л. Без этой замены единица не распознавалась и число
  // подписывалось каноническим U/L без пересчёта (0.58 мккат/л → 0.58 U/L).
  key = key
    .replace(/мккат\/л/g, 'ukat/l')
    .replace(/мккат\/мл/g, 'ukat/ml')
    .replace(/мкат\/л/g, 'mkat/l')
    .replace(/нкат\/л/g, 'nkat/l')
    .replace(/кат\/л/g, 'kat/l');

  // Активность: мкМЕ < мМЕ < МЕ/Ед. Более длинные префиксы — первыми.
  key = key
    .replace(/мкме\/мл/g, 'uiu/ml')
    .replace(/мкме\/л/g, 'uiu/l')
    .replace(/мкмед\/мл/g, 'uiu/ml')
    .replace(/мкмед\/л/g, 'uiu/l')
    .replace(/мкед\/мл/g, 'uiu/ml')
    .replace(/мкед\/л/g, 'uiu/l')
    .replace(/мке\/мл/g, 'uiu/ml')
    .replace(/мке\/л/g, 'uiu/l')
    .replace(/мкмед|мкме|мкед|мке/g, 'uiu')
    .replace(/мме\/мл/g, 'miu/ml')
    .replace(/мме\/л/g, 'miu/l')
    .replace(/мед\/мл/g, 'miu/ml')
    .replace(/мед\/л/g, 'miu/l')
    .replace(/ме\/мл/g, 'miu/ml')
    .replace(/ме\/л/g, 'miu/l')
    .replace(/мме|мед/g, 'miu');

  // Концентрации и массы. «нмоль/пмоль» — до «моль».
  key = key
    .replace(/ммоль\/моль/g, 'mmol/mol')
    .replace(/мкмоль/g, 'umol')
    .replace(/нмоль/g, 'nmol')
    .replace(/пмоль/g, 'pmol')
    .replace(/ммоль/g, 'mmol')
    .replace(/моль/g, 'mol')
    .replace(/мкг/g, 'ug')
    .replace(/мг/g, 'mg')
    .replace(/нг/g, 'ng')
    .replace(/пг/g, 'pg')
    .replace(/мл/g, 'ml')
    .replace(/дл/g, 'dl')
    .replace(/мкл/g, 'ul')
    .replace(/литр/g, 'l')
    .replace(/мм\/ч/g, 'mm/h')
    .replace(/сек(?:унд[а-я]*)?/g, 'sec')
    .replace(/фл/g, 'fl')
    .replace(/л(?![a-z])/g, 'l')
    .replace(/г(?![a-z])/g, 'g');

  return key;
}

/** Массовые единицы в граммах (база — g/L концентрации). */
const MASS_TO_GRAM: Record<string, number> = { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 };
/** Объёмные единицы в литрах. */
const VOLUME_TO_LITRE: Record<string, number> = { l: 1, dl: 0.1, ml: 1e-3, ul: 1e-6 };
/** Молярные единицы в молях. */
const MOLE_TO_MOL: Record<string, number> = { mol: 1, mmol: 1e-3, umol: 1e-6, nmol: 1e-9, pmol: 1e-12 };
/** Активность в МЕ (IU); численно U = IU для ферментов. */
const ACTIVITY_TO_IU: Record<string, number> = { u: 1, iu: 1, mu: 1e-3, miu: 1e-3, uiu: 1e-6 };

/**
 * Молярные массы (г/моль) для пересчёта массовая ↔ молярная концентрация.
 * Нужны, когда бланк даёт результат в mg/dL, а канон приложения — µmol/L
 * (кортизол, гормоны, железо, ТИБЦ…). Источник — PubChem/стандартные
 * коэффициенты клинических лабораторий.
 */
const MOLAR_MASS: Record<string, number> = {
  GLU: 180.156, CREATININE: 113.12, UREA: 60.06, UA: 168.11, URIC_ACID: 168.11,
  BIL: 584.66, DBIL: 584.66, DIRECT_BIL: 584.66,
  CHOL: 386.65, HDL: 386.65, LDL: 386.65, VLDL: 386.65, TG: 885.4,
  CA: 40.078, CALCIUM: 40.078, MG: 24.305, MAGNESIUM: 24.305,
  P: 30.974, PHOSPHORUS: 30.974, IRON: 55.845, TIBC: 55.845, UIBC: 55.845,
  TT: 288.42, FT: 288.42, E2: 272.38, PROG: 314.46, PROGESTERONE: 314.46,
  DHEA_S: 368.49, CORTISOL: 362.46, CORTISOL_NIGHT: 362.46,
  FT4: 776.87, T4: 776.87, FT3: 650.97, T3: 650.97,
  ALDOSTERONE: 360.44, ACTH: 4541.1, PARATHYROID: 9424.8,
  C_PEPTIDE: 3020.3, HOMOCYSTEINE: 135.19, B12: 1355.37,
  FOL: 441.4, FOLATE: 441.4, VITD: 400.64,
  VITAMIN_A: 286.45, VITAMIN_E: 430.71, INS: 5808,
  SELENIUM: 78.96, COPPER: 63.546, ZINC: 65.38, MANGANESE: 54.94,
  CHROMIUM: 52.0, IODINE: 126.904, LACTATE: 90.08, AMMONIA: 17.031,
};

type ConcentrationUnit = { kind: 'mass' | 'mole' | 'activity'; perBase: number };

/** Разбор единицы-концентрации вида «мг/дл» / «nmol/L» / «mIU/mL». */
function parseConcentrationUnit(key: string): ConcentrationUnit | null {
  if (!key) return null;
  const mass = key.match(/^(g|mg|ug|ng|pg)\/(l|dl|ml|ul)$/);
  if (mass) return { kind: 'mass', perBase: MASS_TO_GRAM[mass[1]] / VOLUME_TO_LITRE[mass[2]] };
  const mole = key.match(/^(mol|mmol|umol|nmol|pmol)\/(l|dl|ml|ul)$/);
  if (mole) return { kind: 'mole', perBase: MOLE_TO_MOL[mole[1]] / VOLUME_TO_LITRE[mole[2]] };
  const activity = key.match(/^(u|iu|mu|miu|uiu)\/(l|dl|ml|ul)$/);
  if (activity) return { kind: 'activity', perBase: ACTIVITY_TO_IU[activity[1]] / VOLUME_TO_LITRE[activity[2]] };
  return null;
}

/** Ферменты, которые в бланках печатают в мккат/л (SI). 1 U = 1 мкмоль/мин. */
const ENZYME_CODES = new Set([
  'ALT', 'AST', 'GGT', 'ALP', 'LDH', 'CK', 'AMYLASE', 'LIPASE', 'CHOLINESTERASE', 'CK_18', 'GLDH',
]);

/** Convert common Russian/foreign lab units to the canonical UCUM_MAP unit. */
export function normalizeLabMeasurement(code: string, value: number, unit: string): { value: number; unit: string } {
  const canonicalCode = mapToUcumCode(code);
  const canonical = canonicalCode.toUpperCase();
  // UCUM_MAP contains a few intentionally mixed-case keys (e.g. HbA1c).
  const info = UCUM_MAP[canonicalCode] || UCUM_MAP[canonical]
    || Object.entries(UCUM_MAP).find(([key]) => key.toUpperCase() === canonical)?.[1];
  if (!info || !Number.isFinite(value)) return { value, unit: unit || info?.prefUnit || '' };
  const from = unitKey(unit);
  const target = unitKey(info.prefUnit);
  let factor = 1;
  let converted = false;

  // IFCC HbA1c mmol/mol → NGSP % is affine, not a simple ratio. Handle it
  // before the equal-unit fast path (which otherwise treats mmol/mol as %).
  if (canonical === 'HBA1C' && from.includes('mmol/mol')) {
    return { value: round(value * 0.09148 + 2.152), unit: info.prefUnit };
  }

  // Some Russian reports print hematocrit as a fraction (0.45) while the
  // canonical profile stores percent (45%). This conversion is only applied
  // when the source is explicitly fractional or unitless.
  if (canonical === 'HCT' && value >= 0 && value <= 1 && (!from || from === 'fraction' || from === '%')) {
    return { value: round(value * 100), unit: info.prefUnit };
  }

  if (from && from === target) return { value: round(value), unit: info.prefUnit };
  switch (canonical) {
    case 'CREATININE': if (from.includes('mg/dl')) { factor = 88.42; converted = true; } break;
    // BUN (азот мочевины) в США: mg/dL × 0.357 = ммоль/л мочевины.
    case 'UREA': if (from.includes('mg/dl')) { factor = 1 / 2.801; converted = true; } break;
    case 'UA': if (from.includes('mg/dl')) { factor = 59.48; converted = true; } break;
    case 'BIL': case 'DBIL': if (from.includes('mg/dl')) { factor = 17.104; converted = true; } break;
    // Глюкоза: клинический коэффициент 18.018 (100 mg/dL = 5.55 ммоль/л).
    case 'GLU': if (from.includes('mg/dl')) { factor = 1 / 18.018; converted = true; } break;
    case 'E2': if (from.includes('pmol') || /пмоль|pmol/i.test(unit)) { factor = 1 / 3.671; converted = true; } break;
    // Пролактин: 1 ng/mL = 21.2 mIU/L. mIU/mL — это 1000 mIU/L, раньше
    // делитель применялся так же, как к mIU/L, и результат был занижен в 1000 раз.
    case 'PRL':
      if (from === 'miu/ml') { factor = 1000 / 21.2; converted = true; }
      else if (from.includes('miu') || from.includes('uiu')) { factor = 1 / 21.2; converted = true; }
      break;
    case 'TT':
      if (from.includes('nmol')) { factor = 28.84; converted = true; }
      else if (from.includes('ng/ml')) { factor = 100; converted = true; }
      break;
    case 'FT':
      // Canonical free-testosterone unit is pg/mL. 1 pg/mL = 3.467 pmol/L.
      if (from.includes('pmol')) { factor = 1 / 3.467; converted = true; }
      else if (from.includes('nmol')) { factor = 288.4; converted = true; }
      break;
    case 'VITD': if (from.includes('nmol')) { factor = 1 / 2.496; converted = true; } break;
    case 'HGB': if (from.includes('g/dl') && !from.includes('mg/dl')) { factor = 10; converted = true; } break;
    case 'CHOL': case 'HDL': case 'LDL': if (from.includes('mg/dl')) { factor = 1 / 38.67; converted = true; } break;
    case 'TG': if (from.includes('mg/dl')) { factor = 1 / 88.57; converted = true; } break;
    case 'CRP': if (from.includes('mg/dl')) { factor = 10; converted = true; } break;
    case 'CA': if (from.includes('mg/dl')) { factor = 1 / 4.008; converted = true; } break;
    case 'MG': if (from.includes('mg/dl')) { factor = 1 / 2.429; converted = true; } break;
    case 'P': if (from.includes('mg/dl')) { factor = 1 / 3.097; converted = true; } break;
    case 'B12': if (from.includes('pmol')) { factor = 1 / 0.738; converted = true; } break;
    case 'FOL': if (from.includes('nmol')) { factor = 1 / 2.266; converted = true; } break;
    case 'INS': if (from.includes('pmol')) { factor = 1 / 6.0; converted = true; } break;
    case 'PROG': if (from.includes('nmol')) { factor = 1 / 3.18; converted = true; } break;
    case 'DHEA_S': if (from.includes('umol')) { factor = 36.84; converted = true; } break;
    case 'IRON': if (from.includes('ug/dl')) { factor = 0.1791; converted = true; } break;
    default: break;
  }

  // Ферменты в кат/л: 1 мккат/л = 60 U/L, 1 нкат/л = 0.06 U/L.
  if (!converted && ENZYME_CODES.has(canonical) && factor === 1) {
    if (from === 'ukat/l' || from === 'ukat/ml') { factor = 60; converted = true; }
    else if (from === 'nkat/l') { factor = 0.06; converted = true; }
    else if (from === 'mkat/l') { factor = 60000; converted = true; }
    else if (from === 'kat/l') { factor = 6e7; converted = true; }
  }

  // Универсальный пересчёт концентраций: масса↔масса и моль↔моль считаются
  // через базовые единицы (g/L, mol/L), а масса↔моль — через молярную массу
  // показателя. Так fibrinogen 300 mg/dL → 3 g/L, трансферрин 250 mg/dL →
  // 2.5 g/L, кортизол 15 µg/dL → 414 nmol/L, ТТГ 5 mIU/mL остаётся mIU/L и т.д.
  const sourceDim = parseConcentrationUnit(from);
  const targetDim = parseConcentrationUnit(target);
  if (!converted && factor === 1 && from && from !== target && sourceDim && targetDim) {
    if (sourceDim.kind === targetDim.kind) {
      factor = sourceDim.perBase / targetDim.perBase;
      converted = true;
    } else if (sourceDim.kind !== 'activity' && targetDim.kind !== 'activity') {
      const molarMass = MOLAR_MASS[canonical];
      if (molarMass) {
        factor = sourceDim.kind === 'mass'
          ? sourceDim.perBase / (molarMass * targetDim.perBase)
          : (sourceDim.perBase * molarMass) / targetDim.perBase;
        converted = true;
      }
    }
  }

  // Концентрацию нельзя «переименовать» без коэффициента: раньше неизвестная
  // или обрезанная единица (например, «моль/л» вместо «нмоль/л») отдавала
  // исходное число с каноническим ярлыком — 18.4 нмоль/л тестостерона
  // превращалось в «18.4 ng/dL» (реально 530). Если обе единицы разобраны как
  // концентрации, но пересчёт невозможен (например, Лп(а) mg/dL → nmol/L или
  // КФК-МВ U/L → ng/mL), честно оставляем исходную единицу.
  if (!converted && from && from !== target && sourceDim && targetDim) {
    return { value: round(value), unit: unit.trim() };
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

  // OCR-толерантный fallback: опечатки/лишние пробелы в названии маркера
  // («Аланинаминотранс фераза», «Креатини») не должны ломать распознавание.
  // Ищем ближайший синоним по расстоянию Левенштейна, но только если он
  // уникален и достаточно близок (≤2 правок) и имя достаточно длинное,
  // чтобы не цеплять случайные короткие совпадения.
  //
  // P0: служебные слова бланка («Дата», «Норма», «Заказ»…) НЕЛЬЗЯ пропускать
  // через fuzzy. «Дата» отличается от «дгэа» на 2 правки и раньше давала
  // ложный ДГЭА-С со значением даты (12.08.2026 → 12.08 ug/dL).
  const normalizedWord = trimmed.toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
  const isNonMarkerWord = NON_MARKER_WORDS.has(normalizedWord) || /\d/.test(normalizedWord);
  if (trimmed.length >= 5 && !isNonMarkerWord) {
    let bestKey: string | null = null;
    let bestDist = 3;
    let bestCount = 0;
    const needle = trimmed.toLowerCase();
    for (const key of Object.keys(SYNONYM_MAP)) {
      // Короткие ключи («дгэа», «лг», «ттг») не участвуют в fuzzy:
      // расстояние в 1–2 правки для них статистически ничего не значит.
      if (key.length < 5) continue;
      const d = levenshtein(needle, key);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
        bestCount = 1;
      } else if (d === bestDist && bestKey !== null) {
        bestCount += 1;
      }
    }
    if (bestKey && bestDist <= 2 && bestCount === 1) {
      return mapToUcumCode(SYNONYM_MAP[bestKey].toUpperCase());
    }
  }

  return upper;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 position within reference range; null if unknown. */
export function normalizedRatio(code: string, value: number, unit: string, age?: number, sex?: 'male' | 'female'): number | null {
  // P0 fix: UCUM ключи смешанного регистра (HbA1c), code приходит upper
  const ucum = (UCUM_MAP as any)[code] || (UCUM_MAP as any)[code.toUpperCase()] || (UCUM_MAP as any)[code.toLowerCase()] || (Object.entries(UCUM_MAP as any).find(([k]) => k.toLowerCase() === code.toLowerCase())?.[1] as any);
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

  // Л8 (фаза 2 женского слоя): женские границы из единого источника
  // (getLabNorm/FEMALE_LAB_BOUNDS — HCT 36–48, Hb 120–150, RBC 4.0–5.2,
  // АЛТ/АСТ/ГГТ 31, креатинин 44–97, ферритин 15–200) вместо симметричного ×0.85.
  // Мужской путь и маркеры без женских отличий — байт-в-байт.
  if (sex === 'female') {
    const fem = getLabNorm(code, 'female');
    if (fem?.female) {
      lln = fem.lln;
      uln = fem.uln;
    }
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
