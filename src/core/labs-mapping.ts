import synonyms from '../data/labs-synonyms.json';
import { UCUM_MAP, DYNAMIC_REFS, TT_NMOL_TO_NG_DL, DHT_NMOL_TO_PG, ucumInfo, ucumKey } from './constants';
import { getLabNorm, E2_PG_TO_PMOL, PRL_NG_TO_MIU, PROG_NG_TO_NMOL } from '../engines/lab-norms.engine';

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
  // Проход 132: насыщение трансферрина — один анализ под тремя кодами.
  // `IRON_SAT` — как его зовут списки каталога «Анализы», `TSAT` — как его зовёт
  // мост механизмов (`tz-bridge-marker`), `TRANSFERRIN_SAT` — склад анализов
  // (`labs-derived`, `labs-overdue`). Канон — `TRANSFERRIN_SAT`.
  'TRANSFERRIN_SAT': 'TRANSFERRIN_SAT',
  'IRON_SAT': 'TRANSFERRIN_SAT',
  'TSAT': 'TRANSFERRIN_SAT',
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
    .replace(/Ед/g, 'IU')
    // «Е/л» и «Е/мл» — русская запись единицы активности (U/L, U/mL): так печатают
    // бланки. Без этого единица не разбиралась, и КФК-МВ 25 Е/л сравнивался с
    // нормой в нг/мл как «25 нг/мл» (проход 178). Замена идёт ПОСЛЕ «МЕ», поэтому
    // «МЕ/л» (IU) сюда не попадает.
    .replace(/Е\s*\/\s*(л|мл)/g, 'U/$1')
    // Строчная запись «ед/л» / «ЕД/мл» — та же активность. Граница `[^а-яё]`
    // не даёт задеть «мЕд»/«мМЕ» и слова: они уже переведены выше.
    .replace(/(^|[^а-яё])ед\s*\/\s*(л|мл)/gi, '$1U/$2');
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

  // Проход 186: физически равные пары сводятся к одному ключу.
  //
  // Ключ строился из написания, и «МЕ/л» (IU/L) отличался от «mIU/mL», хотя это
  // ОДНА величина: 1 IU/L = 1 mIU/mL (милли-единица на миллилитр = единица на
  // литр). Цена различия — не косметика: `readLabInUnit` видел «разные единицы»,
  // шёл пересчитывать, клинический коэффициент конкретного анализа не срабатывал,
  // и пролактин в «МЕ/л» (частый бланк РФ) уходил в «не прочитано» вместо числа.
  // Так же равны `мг/л` ≡ `мкг/мл`, `нг/мл` ≡ `мкг/л`, `пг/мл` ≡ `нг/л` и
  // молярные `нмоль/мл` ≡ `мкмоль/л`.
  //
  // Представитель класса выбран так, чтобы не сломать буквальные проверки ниже
  // по коду (`from === 'miu/ml'` у пролактина, `from.includes('ng/ml')` у
  // тестостерона): активности — `miu/ml`/`miu/l`, массы — `mg/l`/`ng/ml`/`pg/ml`,
  // моли — `.../l`. Замены идут в одну сторону, поэтому цепочки не зацикливаются.
  key = key
    .replace(/^iu\/l$/, 'miu/ml')
    .replace(/^uiu\/ml$/, 'miu/l')
    .replace(/^mg\/ml$/, 'g/l')
    .replace(/^ug\/ml$/, 'mg/l')
    .replace(/^ug\/l$/, 'ng/ml')
    .replace(/^ng\/l$/, 'pg/ml')
    .replace(/^mmol\/ml$/, 'mol/l')
    .replace(/^umol\/ml$/, 'mmol/l')
    .replace(/^nmol\/ml$/, 'umol/l')
    .replace(/^pmol\/ml$/, 'nmol/l');

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
  TT: 288.42, FT: 288.42, E2: 272.38, ESTRADIOL: 272.38, PROG: 314.46, PROGESTERONE: 314.46,
  // Проход 192: ДГТ — та же молярная масса, что и в `LAB_UNIT_READ`, один литерал
  // на два читателя (`DHT_NMOL_TO_PG`).
  DHT: DHT_NMOL_TO_PG,
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
  // Проход 174: поиск записи каталога — одно правило (`ucumInfo`), а не три
  // варианта регистра, продублированные в этом файле и в UI.
  const info = ucumInfo(canonicalCode);
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

  // Проход 132: насыщение трансферрина печатают и долей (0.45), и процентом (45 %).
  // Тот же случай, что HCT: канон — процент, доля меньше 1 в клинике не встречается
  // (0.45 % насыщения — не результат анализа, а доля).
  if (canonical === 'TRANSFERRIN_SAT' && value >= 0 && value <= 1 && (!from || from === 'fraction' || from === '%')) {
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
    case 'E2': if (from.includes('pmol') || /пмоль|pmol/i.test(unit)) { factor = 1 / E2_PG_TO_PMOL; converted = true; } break;
    // Пролактин: 1 ng/mL = 21.2 mIU/L. mIU/mL — это 1000 mIU/L, раньше
    // делитель применялся так же, как к mIU/L, и результат был занижен в 1000 раз.
    case 'PRL':
      if (from === 'miu/ml') { factor = 1000 / PRL_NG_TO_MIU; converted = true; }
      else if (from.includes('miu') || from.includes('uiu')) { factor = 1 / PRL_NG_TO_MIU; converted = true; }
      break;
    case 'TT':
      if (from.includes('nmol')) { factor = TT_NMOL_TO_NG_DL; converted = true; }
      else if (from.includes('ng/ml')) { factor = 100; converted = true; }
      break;
    case 'FT':
      // Канон приложения — pg/mL. Оба пересчёта выводятся из молярной массы
      // тестостерона (`MOLAR_MASS.FT` = 288.42): 1 pg/mL = 1000/MW pmol/L (≈3.4672),
      // 1 nmol/L = MW pg/mL. Литералы 3.467 и 288.4 были её округлениями — проход 101.
      if (from.includes('pmol')) { factor = MOLAR_MASS.FT / 1000; converted = true; }
      else if (from.includes('nmol')) { factor = MOLAR_MASS.FT; converted = true; }
      break;
    // Витамин D: молярная масса 400.64 → 1 ng/mL = 2.496 nmol/L (1000/MW).
    case 'VITD': if (from.includes('nmol')) { factor = MOLAR_MASS.VITD / 1000; converted = true; } break;
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
    case 'PROG': if (from.includes('nmol')) { factor = 1 / PROG_NG_TO_NMOL; converted = true; } break;
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
  //
  // Проход 182: правило распространилось и на НЕразобранные единицы («балл»,
  // «10⁹/л», «—»). Раньше здесь стоял канон каталога, и число без пересчёта
  // подписывалось чужой единицей — «5 нмоль/л» общего тестостерона с единицей
  // «—» превращалось в «5 ng/dL» (0.17 нмоль/л), то есть в тяжёлый дефицит.
  // Единица без пересчёта — единица бланка; канон ставится только тогда, когда
  // пересчёт был или единицы бланка не было вовсе.
  if (!converted) {
    return { value: round(value), unit: unit.trim() || info.prefUnit };
  }
  return { value: round(value * factor), unit: info.prefUnit };
}

/**
 * Единицы разных величин (проход 178): масса (`mg/dL`, `ng/mL`) против
 * количества вещества (`nmol/L`) или активности (`U/L`).
 *
 * Если после `normalizeLabMeasurement` число осталось в своей единице, а норма
 * маркера записана в другой величине, сравнивать их нельзя: КФК-МВ 25 Е/л
 * (активность) против нормы 0–5 нг/мл (масса) давало «отклонение 400 %» —
 * число из одного измерения против границы из другого. Пересчитать такую пару
 * нечем (нет молярной массы/коэффициента), поэтому единственный честный ответ —
 * «нормы в этой единице нет».
 *
 * Не путаем с разным написанием одной единицы (`г/л` и `g/L`, `мЕд/л` и
 * `mIU/L`): `unitKey` сводит их к одному ключу, и такие пары сюда не попадают.
 * Неразобранная единица (`10^9/л`, `балл`) тоже не повод молчать — там ключи
 * просто не сравниваются, поведение прежнее.
 */
export function unitsIncommensurable(a: string, b: string): boolean {
  const ka = unitKey(a || '');
  const kb = unitKey(b || '');
  if (!ka || !kb || ka === kb) return false;
  const da = parseConcentrationUnit(ka);
  const db = parseConcentrationUnit(kb);
  return !!da && !!db && da.kind !== db.kind;
}

/**
 * Одна и та же единица после сведения написаний (проход 182).
 *
 * «МЕ/л» и «mIU/L», «мкг/л» и «ug/L», «пг/мл» и «pg/mL» — один ключ `unitKey`,
 * поэтому числа можно сравнивать без пересчёта. Проход 186 добавил к этому
 * физически равные пары (`МЕ/л` ≡ `mIU/mL`, `мг/л` ≡ `мкг/мл`, `нг/мл` ≡ `мкг/л`,
 * `пг/мл` ≡ `нг/л`, `нмоль/мл` ≡ `мкмоль/л`): у них разное только написание
 * единицы, а величина одна. Пустое написание считается «неизвестным» и тоже не
 * мешает: пересчитывать нечего (см. `readLabInUnit`).
 */
export function sameLabUnit(a: string, b: string): boolean {
  const ka = unitKey(a || '');
  const kb = unitKey(b || '');
  return !ka || !kb || ka === kb;
}

/**
 * Коэффициенты «масса ↔ активность» (проход 87): мМЕ/л на 1 нг/мл.
 *
 * Пролактин — единственный гормон разбора, где бланк даёт нг/мл (и `ng/mL` —
 * единица приложения по умолчанию в `UCUM_MAP`), а шкала `REFERENCE_RANGES`
 * задана в мЕд/л. Без пересчёта нормальные 12 нг/мл читались как 12 мЕд/л и
 * получали «низко». Коэффициент — один на приложение (`PRL_NG_TO_MIU`).
 */
const MASS_ACTIVITY_FACTOR: Record<string, number> = {
  PRL: PRL_NG_TO_MIU,
  PROLACTIN: PRL_NG_TO_MIU,
};

/**
 * Пересчёт значения из единицы бланка в единицу приложения (проход 86).
 *
 * `interpretLabs` сравнивает число с `REFERENCE_RANGES[code].unit`, а `LabPoint`
 * хранит то, что ввёл пользователь: поле единицы в форме — свободный текст.
 * Поэтому тестостерон «600 нг/дл» без пересчёта читался как 600 нмоль/л, а
 * пролактин «15 нг/мл» — как 15 мЕд/л (у него есть коэффициент вещества,
 * `MASS_ACTIVITY_FACTOR`). Правило: обе единицы обязаны разбираться
 * как концентрации; иначе `null` и вызывающий оставляет значение как есть —
 * гадать вслепую хуже, чем не пересчитывать.
 */
export function convertToUnit(code: string, value: number, fromUnit: string, toUnit: string): number | null {
  if (!Number.isFinite(value)) return null;
  const from = unitKey(fromUnit || '');
  const to = unitKey(toUnit || '');
  if (!from || !to) return null;
  if (from === to) return value;
  const sourceDim = parseConcentrationUnit(from);
  const targetDim = parseConcentrationUnit(to);
  if (!sourceDim || !targetDim) return null;
  if (sourceDim.kind === targetDim.kind) {
    return round((value * sourceDim.perBase) / targetDim.perBase);
  }
  // Активность ↔ масса — только там, где коэффициент вещества известен
  // (пролактин: 1 нг/мл = 21.2 мМЕ/л). Иначе `null`: выдумывать фактор нельзя.
  if (sourceDim.kind === 'activity' || targetDim.kind === 'activity') {
    const perNgPerMl = MASS_ACTIVITY_FACTOR[mapToUcumCode(code).toUpperCase()];
    if (!perNgPerMl) return null;
    if (sourceDim.kind === 'mass') {
      const ngPerMl = (value * sourceDim.perBase) / 1e-9 / 1000;
      return round((ngPerMl * perNgPerMl * 1e-3) / targetDim.perBase);
    }
    const miuPerL = (value * sourceDim.perBase) / 1e-3;
    return round(((miuPerL / perNgPerMl) * 1e-9 * 1000) / targetDim.perBase);
  }
  const canonical = mapToUcumCode(code);
  const molarMass = MOLAR_MASS[canonical] ?? MOLAR_MASS[canonical.toUpperCase()];
  if (!molarMass) return null;
  const factor = sourceDim.kind === 'mass'
    ? sourceDim.perBase / (molarMass * targetDim.perBase)
    : (sourceDim.perBase * molarMass) / targetDim.perBase;
  return round(value * factor);
}

function round(value: number): number {
  return Number(value.toFixed(Math.abs(value) >= 100 ? 1 : 3));
}

/**
 * Число бланка в единице расчёта (проход 182).
 *
 * Модель риска и шкалы ждут число в своей единице (`target`: пг/мл у эстрадиола,
 * нмоль/л у общего тестостерона, Е/л у ферментов). Плоский список анализов
 * (`normalizeFlatLabs`) переводил единицу только у шести гормонов, а всем
 * остальным отдавал число как есть: 60 пмоль/л инсулина читались как 60 мЕд/л
 * (норма 17), 90 мг/дл глюкозы — как 90 ммоль/л, 15 г/дл гемоглобина — как
 * 15 г/л. Догадка по величине здесь тем более не нужна: единица известна.
 *
 * Один порядок чтения:
 *  1) единица уже та — число не трогаем (и не округляем);
 *  2) общий пересчёт каталога (`normalizeLabMeasurement`: масса↔моль, ферменты,
 *     мккат/л, HbA1c mmol/mol, инсулин пмоль/л);
 *  3) остаток до нужной единицы (`convertToUnit`);
 *  4) пересчитать нечем и величины разные (`unitsIncommensurable`) — `null`:
 *     число нельзя выдавать за прочитанное в единице расчёта.
 *
 * Неразобранная единица («10⁹/л», «балл», «—») остаётся как есть: «не знаю
 * единицу» ≠ «другая величина», и отнимать за это число нельзя. Единицы нет
 * вовсе — тоже как есть: что делать с числом без единицы, решает вызывающий.
 */
export function readLabInUnit(code: string, value: number, unit: string, target: string): number | null {
  if (!Number.isFinite(value)) return null;
  if (!target || !unit) return value;
  if (sameLabUnit(unit, target)) return value;

  // Проход 182: первым идёт общий пересчёт каталога — в нём живут клинические
  // коэффициенты (глюкоза 18.018, молярные массы, HbA1c, инсулин). `convertToUnit`
  // считает ту же пару по молярной массе и давал 90 мг/дл = 4.996 вместо 4.995:
  // одно преобразование — одно число.
  const measured = normalizeLabMeasurement(code, value, unit);
  // Единица не сменилась — пересчёта не было (единица не разобрана или её нет):
  // второй шаг из такой «единицы» увёл бы число из чужого измерения.
  if (!sameLabUnit(measured.unit, unit)) {
    if (sameLabUnit(measured.unit, target)) return measured.value;
    const toTarget = convertToUnit(code, measured.value, measured.unit, target);
    if (toTarget !== null) return toTarget;
  }

  // Канон каталога и единица расчёта разошлись (общий тестостерон: ng/dL против
  // нмоль/л) — прямой пересчёт из единицы бланка.
  const direct = convertToUnit(code, value, unit, target);
  if (direct !== null) return direct;

  if (unitsIncommensurable(measured.unit, target)) return null;
  return value;
}

/** Convert any known code to a UCUM_MAP key (returns the code itself if no alias exists) */
export function mapToUcumCode(code: string): string {
  const upper = code.trim().toUpperCase();
  // Check alias FIRST — if there's a canonical mapping, use it even if the
  // code exists directly in UCUM_MAP. This prevents duplicate entries when
  // both a long-form key (e.g. TOTAL_PROTEIN) and its canonical short-form
  // (e.g. TP) exist as separate UCUM_MAP keys.
  const alias = CODE_ALIAS[upper];
  if (alias && ucumInfo(alias)) return alias;
  // Проход 174: ключ каталога возвращается в его собственном регистре — иначе
  // `hba1c` превращался бы в `HBA1C`, которого в каталоге нет, и анализ терял
  // имя и единицу `%`.
  return ucumKey(upper) ?? code;
}

/** Resolve free-text marker name to canonical UCUM code when possible. */
export function resolveLabMarker(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();
  const direct = ucumKey(upper);
  if (direct) return direct;

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
  const visualKey = ucumKey(visualLatin);
  if (visualKey) return visualKey;

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
  // Проход 174: поиск записи каталога — одно правило (`ucumInfo`).
  const ucum = ucumInfo(code);
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

/**
 * Подпись «доля от нормы» для предпросмотра импорта.
 *
 * Проход 144: у обрезанного числа доля обрезана так же — «>1000» при верхней
 * границе 400 это «не меньше 250%», а не 250%. При границе подписи нет: рядом
 * уже стоит значение со знаком, и точный процент рядом с ним читался бы как
 * измерение.
 */
export function ratioPercentLabel(ratio: number | null | undefined, bound?: '<' | '>'): string {
  if (ratio == null || bound) return '';
  return ` (${Math.round(ratio * 100)}%)`;
}

export function interpretScale(score: number): string {
  if (score < 0.2) return 'Отлично';
  if (score < 0.4) return 'Хорошо';
  if (score < 0.6) return 'Норма';
  if (score < 0.8) return 'Проблемы';
  return 'Высокий риск';
}
