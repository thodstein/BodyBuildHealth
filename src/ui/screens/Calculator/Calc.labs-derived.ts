import type { CalculatorState, LabSlice, LabFlagOverride } from '../../../engines/support-plan';
import {
  getLabNorm, HCT_THRESHOLDS, HGB_THRESHOLDS, HCT_CORRECTION_MARGIN,
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  BILIRUBIN_FLAG_STEPS, LDL_FLAG_STEPS, TG_FLAG_STEPS, HDL_LOW,
  CREATININE_ULN, CREATININE_FLAG_STEP,
} from '../../../engines/lab-norms.engine';
import { LAB_UNIT_CHOICES, labUnitKey, ucumInfo } from '../../../core/constants';
import { labFieldNumber } from '../../../engines/support-plan';
import { normalizeLabMeasurement, resolveLabMarker, mapToUcumCode, unitsIncommensurable, reticulocytePercentFromAbsolute } from '../../../core/labs-mapping';
import { FULL_PANELS, ruMarker } from './Calc.lab';
import { MARKER_TO_UCUM } from './Calc.lab-units';

// ═══════════════════════════════════════════════════════════════
//  Маркер → панель: авт-определение панели для code из LabPoint
// ═══════════════════════════════════════════════════════════════
const MARKER_TO_PANEL: Record<string, keyof LabSlice> = {};
/** Точное имя маркера в бланке по любому написанию (регистр не важен). */
const MARKER_BY_NAME: Record<string, string> = {};
for (const p of FULL_PANELS) {
  for (const m of p.markers) {
    // Проход 111: первое совпадение главнее. «Glucose» есть и в биохимии, и в
    // анализе мочи; кровяная глюкоза (`GLU`/`GLUCOSE`) — это биохимия, а моча
    // приходит отдельными кодами. Раньше побеждала моча, и импорт ложился не туда.
    if (!MARKER_BY_NAME[m.toLowerCase()]) MARKER_BY_NAME[m.toLowerCase()] = m;
    if (!MARKER_TO_PANEL[m.toLowerCase()]) MARKER_TO_PANEL[m.toLowerCase()] = p.key;
    // Также — альтернативные написания
    const alt = m.replace(/\s+/g, '_').replace(/[()]/g, '').toLowerCase();
    if (alt !== m.toLowerCase() && !MARKER_TO_PANEL[alt]) MARKER_TO_PANEL[alt] = p.key;
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
MARKER_TO_PANEL['phosphorus'] = 'panelMineral';
MARKER_TO_PANEL['magnesium'] = 'panelMineral';
MARKER_TO_PANEL['sodium'] = 'panelMineral';
MARKER_TO_PANEL['potassium'] = 'panelMineral';
MARKER_TO_PANEL['psa_total'] = 'panelTumor';
MARKER_TO_PANEL['psa_free'] = 'panelTumor';
MARKER_TO_PANEL['ph'] = 'panelUrinalysis';
MARKER_TO_PANEL['protein'] = 'panelUrinalysis';
MARKER_TO_PANEL['ketones'] = 'panelUrinalysis';

// ═══════════════════════════════════════════════════════════════
//  Код анализа → имя маркера бланка (проход 111)
// ═══════════════════════════════════════════════════════════════
//  Один анализ живёт в приложении в трёх словарях: имя в бланке калькулятора
//  ('Total T', 'Prolactin', 'Hemoglobin'), плоский код риска и тиров ('TT',
//  'PRL', 'HGB') и то, что вернул `resolveLabMarker` для бумажного бланка
//  ('HGB', 'BIL', 'GLU', а для незнакомого названия — имя в верхнем регистре).
//  Импорт (LabPoint, маркеры дневника) приносит второй и третий, а `LabSlice`
//  читается по первому — поэтому без моста значение либо терялось совсем
//  (`PRL`, `TT`), либо ложилось под ключом, которого не видит ни форма, ни
//  движок (`HEMOGLOBIN`, `DHEA_S`). Вывести таблицу из `resolveLabMarker`
//  нельзя: он не сводит 'Total T' к 'TT', а незнакомое возвращает как есть.
const LAB_CODE_TO_MARKER: Record<string, string> = {
  // ── половые гормоны и надпочечники ──
  'TT': 'Total T', 'TOTAL_T': 'Total T', 'TESTO': 'Total T', 'TESTOSTERONE': 'Total T', 'TESTOSTERONE_TOTAL': 'Total T',
  'FT': 'Free T', 'FREE_T': 'Free T', 'FTESTO': 'Free T', 'FREE_TESTOSTERONE': 'Free T', 'TESTOSTERONE_FREE': 'Free T',
  'E2': 'E2', 'ESTR': 'E2', 'ESTRADIOL': 'E2',
  'PRL': 'Prolactin', 'PROL': 'Prolactin', 'PROLACTIN': 'Prolactin',
  'PROG': 'Progesterone', 'PROGESTERONE': 'Progesterone',
  'CORT': 'Cortisol', 'CORTISOL': 'Cortisol',
  'DHEA_S': 'DHEA-S', 'DHEAS': 'DHEA-S', 'DHEA': 'DHEA-S',
  // ── кровь ──
  'HGB': 'Hemoglobin', 'HB': 'Hemoglobin', 'HEMOGLOBIN': 'Hemoglobin',
  'HCT': 'HCT', 'HEMATOCRIT': 'HCT',
  'PLT': 'Platelets', 'PLATELETS': 'Platelets',
  'NEUT': 'Neutrophils', 'NEUTROPHILS': 'Neutrophils',
  'LYMPH': 'Lymphocytes', 'LYM': 'Lymphocytes', 'LYMPHOCYTES': 'Lymphocytes',
  // Проход 196: ретикулоциты. Без записи код склада не находил поля, и анализ
  // с бланка пропадал целиком — «шкала есть, ввести некуда».
  'RETICULOCYTES': 'Reticulocytes', 'RETIC': 'Reticulocytes', 'RET': 'Reticulocytes',
  // ── биохимия ──
  'GLU': 'Glucose', 'GLUCOSE': 'Glucose',
  'CREAT': 'Creatinine', 'CREA': 'Creatinine', 'CREATININE': 'Creatinine',
  // Проход 203: маркеры фильтрации. `EGFR` находит поле по имени, а у цистатина C
  // имя бланка с пробелом («Cystatin C»), и код `CYSTATIN_C` без этой строки
  // пропускался бы мимо готового поля.
  'CYSTATIN_C': 'Cystatin C',
  // Проход 134: инсулин — поле «Биохимии»; без него HOMA-IR не считался.
  'INS': 'Insulin', 'INSULIN': 'Insulin',
  'BUN': 'Urea', 'UREA': 'Urea',
  'UA': 'Uric acid', 'URIC': 'Uric acid', 'URIC_ACID': 'Uric acid',
  'BIL': 'Bilirubin', 'BILIRUBIN': 'Bilirubin', 'BILIRUBIN_TOTAL': 'Bilirubin',
  'HCY': 'Homocysteine', 'HOMOCYSTEINE': 'Homocysteine',
  'CRP': 'CRP', 'HS_CRP': 'hsCRP', 'HSCRP': 'hsCRP',
  // ── липиды ──
  'TC': 'Total Cholesterol', 'TOTAL_CHOLESTEROL': 'Total Cholesterol', 'CHOLESTEROL': 'Total Cholesterol',
  // Проход 169: код склада `CHOL` (`UCUM_MAP`) — тот же анализ; без него бланк
  // из склада не находил поля «Холестерин общий» и молча терялся.
  'CHOL': 'Total Cholesterol',
  'TG': 'Triglycerides', 'TRIGLYCERIDES': 'Triglycerides',
  'APO_B': 'ApoB', 'APOB': 'ApoB', 'APO_A1': 'ApoA1', 'APOA1': 'ApoA1',
  'LP_A': 'Lp(a)', 'LPA': 'Lp(a)',
  // ── щитовидная железа ──
  'FT3': 'T3 free', 'T3_FREE': 'T3 free', 'FT4': 'T4 free', 'T4_FREE': 'T4 free',
  'TPO_AB': 'Anti-TPO', 'ANTI_TPO': 'Anti-TPO', 'TG_AB': 'Anti-TG', 'ANTI_TG': 'Anti-TG',
  // ── железо, витамины ──
  'FERR': 'Ferritin', 'FERRITIN': 'Ferritin', 'FE': 'Iron', 'IRON': 'Iron',
  'TIBC': 'TIBC', 'TRANSFERRIN': 'Transferrin', 'TRANSFERRIN_SAT': 'Transferrin Sat',
  'B12': 'B12', 'VITAMIN_B12': 'B12',
  'FOL': 'Folate', 'FOLATE': 'Folate', 'B9': 'Folate',
  'VITD': 'Vitamin D (25-OH)', 'VITAMIN_D': 'Vitamin D (25-OH)',
  'VITAMIN_D_25_OH': 'Vitamin D (25-OH)', '25_OH_D': 'Vitamin D (25-OH)', '25(OH)D': 'Vitamin D (25-OH)',
  // ── свёртывание, сердце, воспаление, опухолевые маркеры ──
  'D_DIMER': 'D-dimer', 'DDIMER': 'D-dimer', 'DIMER': 'D-dimer',
  'FIB': 'Fibrinogen', 'FIBRINOGEN': 'Fibrinogen',
  'CK_MB': 'CK-MB', 'TROPONIN_I': 'Troponin I', 'TROPONIN_T': 'Troponin T',
  'NT_PROBNP': 'NT-proBNP', 'PROBNP': 'NT-proBNP',
  'IL_6': 'IL-6', 'IL6': 'IL-6', 'TNF_ALPHA': 'TNF-alpha', 'TNF': 'TNF-alpha',
  'PSA': 'PSA total', 'PSA_TOTAL': 'PSA total', 'PSA_FREE': 'PSA free',
  'CA125': 'CA-125', 'CA_125': 'CA-125', 'CEA': 'CEA', 'AFP': 'AFP',
  // ── электролиты и прочее ──
  'CA': 'Calcium', 'CALCIUM': 'Calcium', 'MG': 'Magnesium', 'MAGNESIUM': 'Magnesium',
  'NA': 'Sodium', 'SODIUM': 'Sodium', 'K': 'Potassium', 'POTASSIUM': 'Potassium',
  'CL': 'Chloride', 'CHLORIDE': 'Chloride', 'PHOS': 'Phosphorus', 'PHOSPHORUS': 'Phosphorus',
  // Проход 169: код склада `P` — фосфор (`UCUM_MAP.P`), а не «неизвестный код».
  'P': 'Phosphorus',
  'ALDO': 'Aldosterone', 'ALDOSTERONE': 'Aldosterone', 'RENIN': 'Renin',
  'PTH': 'PTH', 'PARATHYROID': 'PTH', 'ANDROSTENEDIONE': 'Androstenedione',
  '3A_ADG': '3a-ADG',
  'PH': 'pH', 'PROTEIN': 'Protein', 'KETONES': 'Ketones',
  'LEUKOCYTES': 'Leukocytes', 'NITRITE': 'Nitrite',
  // моча приходит отдельными кодами — маркер тот же, панель выбирается по коду
  'URINE_GLUCOSE': 'Glucose', 'GLUCOSE_URINE': 'Glucose',
  'URINE_PROTEIN': 'Protein', 'PROTEIN_URINE': 'Protein',
  'URINE_KETONES': 'Ketones', 'KETONES_URINE': 'Ketones',
  'URINE_LEUKOCYTES': 'Leukocytes', 'URINE_NITRITE': 'Nitrite', 'URINE_PH': 'pH',
  'INR': 'INR', 'PT': 'PT', 'APTT': 'APTT', 'CK': 'CK',
  'LDL': 'LDL', 'HDL': 'HDL', 'VLDL': 'VLDL', 'LH': 'LH', 'FSH': 'FSH',
  'SHBG': 'SHBG', 'DHT': 'DHT', 'TSH': 'TSH',
  'ALT': 'ALT', 'AST': 'AST', 'GGT': 'GGT', 'ALP': 'ALP', 'HBA1C': 'HbA1c', 'RBC': 'RBC', 'WBC': 'WBC',
};

// Проход 114: таблица «маркер бланка → код UCUM» переехала в `Calc.lab-units`,
// чтобы ею же пользовалась подсказка единицы в форме — и без цикла импортов
// (`Calc.lab` → `Calc.lab-units`, `Calc.labs-derived` → `Calc.lab-units`).
// Пересчёт есть только у маркеров, для которых он описан в общем конвертере
// (`normalizeLabMeasurement`). Гормонов с выбором единицы там нет: их единица
// остаётся частью данных (`slice.units`), а пересчёт делает `readLabValue`.
export { MARKER_TO_UCUM, markerReadUnit } from './Calc.lab-units';

/** Имя маркера бланка по коду в любом написании; null — это не наш маркер. */
export function sliceMarkerFor(code: string): string | null {
  const raw = String(code || '').trim();
  if (!raw) return null;
  const direct = MARKER_BY_NAME[raw.toLowerCase()];
  if (direct) return direct;
  const norm = raw.toUpperCase().replace(/[\s-]+/g, '_');
  const byTable = LAB_CODE_TO_MARKER[norm];
  if (byTable) return byTable;
  // Свободное или русское название («Эстрадиол», «гемоглобин») — через общий
  // резолвер бланков; он же отсекает мусор, возвращая незнакомое как есть.
  const resolved = resolveLabMarker(raw);
  if (resolved && resolved !== norm) {
    return MARKER_BY_NAME[resolved.toLowerCase()] ?? LAB_CODE_TO_MARKER[resolved] ?? null;
  }
  return null;
}

/**
 * Единица бланка → `slice.units` (проход 111), если её вообще можно выбрать
 * в форме. Иначе значение читалось бы по величине, хотя единица была в данных:
 * пролактин 15 нг/мл из дневника превращался в 15 мМЕ/л, эстрадиол 1800 пмоль/л
 * — в 1800 пг/мл. Незнакомая единица не выдумывается и не подменяется.
 */
function putMarkerUnit(slice: LabSlice, panel: string, marker: string, unit?: string) {
  if (!unit) return;
  const choices = LAB_UNIT_CHOICES[marker];
  if (!choices) return;
  const key = labUnitKey(unit);
  if (!key || !choices.includes(key)) return;
  const units = slice.units || (slice.units = {});
  const bucket = units[panel] || (units[panel] = {});
  bucket[marker] = key;
}

/**
 * Проход 151: по одному маркеру — самая свежая запись.
 *
 * `labPointsToSlice` перебирал список в том порядке, в каком записи вернула база,
 * и последняя по порядку перекрывала предыдущие. Порядок хранения — не
 * клинический факт: анализ, введённый вчера за прошлый месяц, «побеждал» свежий
 * бланк, и форма считала риск по старому числу. Здесь главнее дата: у маркера
 * остаётся запись с позднейшей датой, запись без даты — самая старая (при равных
 * датах главнее записанная позже). Архивная запись (удалённая из Лаборатории) в
 * форму не возвращается — иначе удалённый анализ «воскресал» в калькуляторе.
 */
export function latestLabPoints(input: any[]): any[] {
  if (!Array.isArray(input)) return [];
  const best = new Map<string, { row: any; date: string; index: number }>();
  input.forEach((row, index) => {
    if (!row || typeof row !== 'object' || row.archived) return;
    const code = String(row.code || row.name || row.marker || '').trim();
    if (!code) return;
    const value = row.value != null && row.value !== '' ? row.value : row.valueStr;
    if (value == null || value === '') return;
    // Ключ — имя маркера бланка: `GLU` и `Glucose` — один и тот же анализ, и
    // сравнивать их даты надо как один маркер, а не как две строки.
    const key = sliceMarkerFor(code) || code.toUpperCase();
    const date = String(row.date || '');
    const prev = best.get(key);
    if (!prev || date > prev.date || (date === prev.date && index > prev.index)) {
      best.set(key, { row, date, index });
    }
  });
  return Array.from(best.values()).sort((a, b) => a.index - b.index).map(v => v.row);
}

/** Сколько маркеров реально записано в срез (строки базы ≠ распознанные анализы). */
export function countSliceMarkers(slice: LabSlice | null): number {
  if (!slice) return 0;
  let n = 0;
  for (const [panel, markers] of Object.entries(slice)) {
    if (panel === 'units' || panel === 'date') continue;
    if (!markers || typeof markers !== 'object') continue;
    for (const v of Object.values(markers as Record<string, unknown>)) {
      if (v != null && v !== '') n++;
    }
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════
//  Конвертация из LabPoint[] → LabSlice
//  Принимает: LabPoint[], массив {code,value,unit,date}, LabDiaryEntry[]
// ═══════════════════════════════════════════════════════════════

/**
 * Запись, о которой импорт обязан сказать (проходы 196–197).
 *
 * Три причины, и все раньше были тишиной:
 *  - `unit` — у поля есть своя величина (ретикулоциты в %), а запись пришла в
 *    другой (абсолютное 10⁹/л), и пересчитать её нечем. Положить число «как
 *    есть» значило бы выдать 50 ‰ за 50 %;
 *  - `marker` — анализ есть в каталоге, но поля в бланке у него нет. Раньше
 *    такая строка просто исчезала, а «анализы подставлены» всё равно звучало;
 *  - `derived` — запись в бланк легла, но числом из другой записи того же бланка
 *    (ретикулоциты в 10⁹/л и эритроциты: `% = RET# / (RBC × 10)`). Это честный
 *    пересчёт, а не догадка, — но человек должен знать, что видит не строку из
 *    бланка, а вычисленное число.
 * Незнакомый код (LOINC и прочий мусор) сюда не попадает: назвать его нечем.
 */
export interface LabImportNote {
  /** Код записи, как он лежал в данных. */
  code: string;
  /** Русское имя для человека: подпись поля бланка или имя каталога. */
  label: string;
  /** Значение, как оно было записано (у `derived` — исходное абсолютное число). */
  value: string;
  unit?: string;
  /** У `derived` — что получилось после пересчёта. */
  computed?: string;
  reason: 'unit' | 'marker' | 'derived';
}

/**
 * Одна строка «что не перенесено / что пересчитано» для статуса импорта.
 *
 * Список не режется молча: первые три названы, остаток — числом. Дубли
 * (одна и та же запись в двух источниках) схлопываются, иначе счёт врал бы.
 * «Не перенесено» и «пересчитано» — разные фразы: первое значит, что числа в
 * форме нет, второе — что оно есть, но получено из двух строк бланка.
 */
export function labImportNoteLine(notes: LabImportNote[]): string {
  if (!notes.length) return '';
  const seen = new Set<string>();
  const unique = notes.filter((s) => {
    // Одна и та же строка из двух источников (склад и зеркало дневника) —
    // одно и то же значение; разные даты одного маркера — разные строки.
    const key = `${s.code}|${s.unit ?? ''}|${s.reason}|${s.value}|${s.computed ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const parts: string[] = [];
  const skipped = unique.filter((s) => s.reason !== 'derived');
  if (skipped.length) {
    const shown = skipped.slice(0, 3).map((s) => {
      const why = s.reason === 'unit' ? 'единица другой величины' : 'нет поля в бланке';
      return `${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ''} — ${why}`;
    });
    const rest = skipped.length > shown.length ? `, и ещё ${skipped.length - shown.length}` : '';
    parts.push(`не перенесено ${skipped.length}: ${shown.join('; ')}${rest}`);
  }
  const derived = unique.filter((s) => s.reason === 'derived');
  if (derived.length) {
    const shown = derived.slice(0, 3).map((s) =>
      `${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ''} — пересчитано по эритроцитам (${s.computed} %)`);
    const rest = derived.length > shown.length ? `, и ещё ${derived.length - shown.length}` : '';
    parts.push(`пересчитано ${derived.length}: ${shown.join('; ')}${rest}`);
  }
  return parts.join(' · ');
}

export function labPointsToSlice(input: any, notes?: LabImportNote[]): LabSlice | null {
  if (!input) return null;
  const slice: LabSlice = {
    date: '', panelSex: {}, panelBiochem: {}, panelHematology: {},
    panelThyroid: {}, panelLipid: {}, panelIron: {}, panelVitamin: {},
    panelCardiac: {}, panelCoagulation: {}, panelInflammatory: {},
    panelAdrenal: {}, panelMineral: {}, panelTumor: {}, panelUrinalysis: {},
  };
  let count = 0;

  // ── Проход 111: код → имя маркера бланка, панель — по имени маркера. Код,
  // который не наш, просто пропускается (как и раньше), но пустое значение
  // больше не считается «импортированным»: раньше счётчик врал, и бланк с
  // нераспознанными кодами возвращался как заполненный.
  //
  // Проход 196: пропуск, который человеку важно знать, называется в `notes`:
  // анализ каталога без поля в бланке и запись в величине, которую поле не
  // читает. Панель бланка — не место для догадки: сменить единицу в записи
  // нельзя, поэтому такая строка не входит в бланк вовсе.
  const put = (
    rawCode: string, rawVal: any, unit?: string, valueStr?: string,
    rbc?: { value: any; unit?: string },
  ): boolean => {
    const marker = sliceMarkerFor(rawCode);
    const val = rawVal != null && rawVal !== '' ? String(rawVal) : '';
    const rawText = val || (valueStr != null ? String(valueStr) : '');
    if (!marker) {
      if (!rawText) return false;
      const info = ucumInfo(mapToUcumCode(String(rawCode || '').trim()));
      if (info) {
        notes?.push({
          code: rawCode, label: info.name || String(rawCode),
          value: rawText, unit, reason: 'marker',
        });
      }
      return false;
    }
    // Моча приходит отдельными кодами (`GLUCOSE_URINE`, `URINE_PROTEIN`): у неё
    // свои поля, иначе глюкоза мочи заняла бы место кровяной.
    const isUrine = /(^|[_\s-])(URINE|МОЧА?|MOCH)/i.test(rawCode);
    const panel = isUrine ? 'panelUrinalysis' : MARKER_TO_PANEL[marker.toLowerCase()];
    if (!panel) return false;
    let text = rawText;
    if (!text) return false;
    // Проход 197: абсолютные ретикулоциты пересчитываются в проценты только по
    // эритроцитам того же бланка (`% = RET# / (RBC × 10)`). Это единственный
    // случай, когда поле получает число из двух записей; строка отчёта говорит
    // об этом прямо, а без RBC ниже срабатывает отказ `unit`.
    if (marker === 'Reticulocytes' && unit && rbc) {
      const abs = Number(text.replace(',', '.'));
      const red = Number(String(rbc.value ?? '').replace(',', '.'));
      const pct = reticulocytePercentFromAbsolute(abs, unit, red, rbc.unit || '');
      if (pct !== null) {
        notes?.push({
          code: rawCode, label: ruMarker(marker), value: text, unit,
          computed: String(pct), reason: 'derived',
        });
        text = String(pct);
        unit = '%';
      }
    }
    // Проход 112: значение приводится к единице приложения тем же конвертером,
    // что и в остальном импорте. Без этого гемоглобин 15 г/дл из FHIR или
    // дневника ложился как «15» в поле, где норма 130–170 г/л, и нормальный
    // бланк читался как тяжёлая анемия.
    const ucum = MARKER_TO_UCUM[marker];
    const choices = LAB_UNIT_CHOICES[marker];
    // Проход 196: величина, которую поле не читает (ретикулоциты в 10⁹/л против
    // процентов), не переименовывается в единицу поля. Пересчитать её нечем —
    // значит, записи здесь нет, а не «есть число».
    //
    // У маркеров с выбором единицы число не пересчитывается на импорте: единица
    // едет вместе с числом, и читает её `readLabValue` (проходы 121–124).
    // Поэтому проверяем только «другую величину», которую выбор не знает:
    // «‰» у ретикулоцитов выбор знает, а «10⁹/л» — нет.
    if (choices && unit && !choices.includes(labUnitKey(unit)) && unitsIncommensurable(unit, choices[0])) {
      notes?.push({
        code: rawCode, label: ruMarker(marker),
        value: text, unit, reason: 'unit',
      });
      return false;
    }
    if (ucum && unit && !choices) {
      const num = Number(text.replace(',', '.'));
      if (Number.isFinite(num)) {
        const norm = normalizeLabMeasurement(ucum, num, unit);
        if (Number.isFinite(norm.value)) text = String(norm.value);
        if (norm.unit) unit = norm.unit;
      }
      // Пересчёт не состоялся, а величины разные (КФК-МВ в нг/мл против Ед/л):
      // число из одного измерения нельзя подписать единицей другого.
      const appUnit = ucumInfo(ucum)?.prefUnit ?? '';
      if (appUnit && unitsIncommensurable(unit, appUnit)) {
        notes?.push({
          code: rawCode, label: ruMarker(marker),
          value: text, unit, reason: 'unit',
        });
        return false;
      }
    }
    (slice[panel] as Record<string, string>)[marker] = text;
    putMarkerUnit(slice, panel, marker, unit);
    return true;
  };

  // ── Case 1: массив LabPoint [{code, value, unit, ...}] ──
  if (Array.isArray(input)) {
    // Проход 151: у маркера побеждает самая свежая запись (`latestLabPoints`), а
    // дата среза — самая поздняя из прочитанных. Раньше дата бралась у первой
    // строки массива, поэтому бланк со смешанными датами подписывался старой.
    const rows = latestLabPoints(input);
    // Проход 197: эритроциты ищутся по дате бланка. Абсолютные ретикулоциты
    // одного бланка с эритроцитами другого — не пара: пересчёт по чужой дате
    // такой же вымысел, как число без RBC вовсе.
    const rbcByDate = new Map<string, { value: any; unit?: string }>();
    for (const lp of rows) {
      const code = String(lp.code || lp.name || lp.marker || '').trim();
      if (!code || sliceMarkerFor(code) !== 'RBC') continue;
      const value = lp.value != null && lp.value !== '' ? lp.value : lp.valueStr;
      if (value == null || value === '') continue;
      rbcByDate.set(String(lp.date || ''), { value, unit: lp.unit });
    }
    for (const lp of rows) {
      const code = String(lp.code || lp.name || lp.marker || '').trim();
      if (!code) continue;
      const date = String(lp.date || '');
      if (!put(code, lp.value, lp.unit, lp.valueStr, rbcByDate.get(date))) continue;
      count++;
      if (date > slice.date) slice.date = date;
    }
  }
  // ── Case 2: LabDiaryEntry {markers: [{code, value, unit, ...}]} ──
  else if (input.markers && Array.isArray(input.markers)) {
    if (input.date) slice.date = String(input.date);
    // Проход 197: в записи дневника все маркеры одной даты — эритроциты ищутся
    // среди её же строк.
    const rbcRow = input.markers.find((m: any) =>
      sliceMarkerFor(String(m.code || m.name || '').trim()) === 'RBC' && m.value != null && m.value !== '');
    const rbc = rbcRow ? { value: rbcRow.value, unit: rbcRow.unit } : undefined;
    for (const m of input.markers) {
      const code = String(m.code || m.name || '').trim();
      if (!code) continue;
      if (put(code, m.value, m.unit, undefined, rbc)) count++;
    }
  }
  // ── Case 3: уже LabSlice {panelBiochem: {...}, ...} ──
  else if (input.panelBiochem || input.panelSex || input.panelHematology) {
    return input as LabSlice;
  }
  // ── Case 4: plain record {ALT: '40', AST: '35', ...} ──
  else if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (put(k, v)) count++;
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
    // Проход 141: здесь был свой `parseFloat`, то есть третье правило чтения поля.
    // Он не понимал «>40» (АЛТ «>40» не включал авто-вывод в анкете, хотя риск-модель
    // читала 40) и обрывался на разрядах («1 000» → 1). Правило теперь одно —
    // `labFieldNumber`, то же, что у плана поддержки и у риск-модели.
    const v = labFieldNumber(pv[key]);
    return v === undefined ? null : v;
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