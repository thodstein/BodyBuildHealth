/**
 * Calc.lab-units.ts — единицы, в которых калькулятор ждёт число.
 *
 * Один анализ живёт в приложении в трёх словарях (имя бланка `LabSlice`, плоский
 * код риска, код UCUM бланка лаборатории), и единицы у них тоже разные. Здесь
 * лежит мост «маркер бланка → код UCUM» для тех маркеров, у которых пересчёт
 * описан в общем конвертере `normalizeLabMeasurement`; этим же мостом пользуется
 * подсказка единицы в поле ввода, чтобы подсказка и пересчёт не расходились.
 *
 * Гормонов с выбором единицы (`LAB_UNIT_CHOICES`) тут нет намеренно: их единица
 * остаётся частью данных (`slice.units`), а пересчёт с полом и фазой делает
 * `readLabValue`.
 */
import { UCUM_MAP } from '../../../core/constants';

export const MARKER_TO_UCUM: Record<string, string> = {
  // ── кровь ──
  'Hemoglobin': 'HGB', 'HCT': 'HCT',
  'Platelets': 'PLT', 'RBC': 'RBC', 'WBC': 'WBC',
  'Neutrophils': 'NEUT', 'Lymphocytes': 'LYMPH',
  // ── биохимия ──
  'Creatinine': 'CREATININE', 'Urea': 'UREA', 'Uric acid': 'UA',
  'Bilirubin': 'BIL', 'Glucose': 'GLU',
  'CRP': 'CRP', 'IL-6': 'IL6',
  // ── липиды ──
  'Total Cholesterol': 'CHOL', 'LDL': 'LDL', 'HDL': 'HDL', 'Triglycerides': 'TG',
  // ── гормоны без выбора единицы ──
  'Free T': 'FT', 'Progesterone': 'PROG',
  'TSH': 'TSH', 'T3 free': 'FT3', 'T4 free': 'FT4', 'Anti-TPO': 'TPO_AB', 'Anti-TG': 'TG_AB',
  // ── железо, витамины ──
  'Iron': 'IRON', 'TIBC': 'TIBC', 'Transferrin': 'TRANSFERRIN', 'Ferritin': 'FERRITIN',
  'Vitamin D (25-OH)': 'VITD', 'B12': 'B12', 'Folate': 'FOL',
  // ── электролиты ──
  'Calcium': 'CA', 'Magnesium': 'MG', 'Sodium': 'NA', 'Potassium': 'K',
  // ── свёртывание, сердце, опухолевые маркеры ──
  'Fibrinogen': 'FIBRINOGEN', 'D-dimer': 'D_DIMER', 'PT': 'PT', 'APTT': 'APTT',
  'CK': 'CK', 'CK-MB': 'CK_MB', 'Troponin I': 'TROPONIN', 'NT-proBNP': 'BNP',
  'PSA total': 'PSA', 'PSA free': 'PSA_FREE',
  'CEA': 'CEA', 'AFP': 'AFP', 'CA-125': 'CA125', 'Renin': 'RENIN',
};

/** Как единица из каталога UCUM называется в форме. */
const UCUM_UNIT_RU: Record<string, string> = {
  'g/l': 'г/л', 'g/dl': 'г/дл', 'mg/dl': 'мг/дл',
  'umol/l': 'мкмоль/л', 'mmol/l': 'ммоль/л', 'nmol/l': 'нмоль/л', 'pmol/l': 'пмоль/л',
  'mg/l': 'мг/л', 'ug/ml': 'мкг/мл', 'ug/l': 'мкг/л', 'ug/dl': 'мкг/дл',
  'ng/ml': 'нг/мл', 'pg/ml': 'пг/мл',
  'u/l': 'Ед/л', 'u/ml': 'Ед/мл', 'iu/ml': 'МЕ/мл', 'miu/l': 'мМЕ/л',
  '%': '%', 'sec': 'сек', '10^9/l': '10⁹/л', '10^12/l': '10¹²/л',
  '10^9/л': '10⁹/л', '10^12/л': '10¹²/л', 'ед/л': 'Ед/л',
};

/**
 * Одно написание единицы в форме: каталог маркеров пишет где-то «U/L», где-то
 * «Ед/л», а рядом с ними стоят «г/л» и «мкмоль/л». Приводим к русскому виду.
 */
export function ruUnit(unit: string): string {
  return UCUM_UNIT_RU[unit.trim().toLowerCase()] ?? unit.trim();
}

/**
 * Единица, в которой движок сравнивает число. Источник — `prefUnit` общего
 * каталога UCUM: та же единица, к которой импорт приводит значение.
 */
export function markerReadUnit(marker: string): string | undefined {
  const code = MARKER_TO_UCUM[marker];
  if (!code) return undefined;
  const pref = UCUM_MAP[code]?.prefUnit;
  if (!pref) return undefined;
  return ruUnit(pref);
}
