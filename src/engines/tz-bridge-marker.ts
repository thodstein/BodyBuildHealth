// ════════════════════════════════════════════════════════════════════════════
//  TZ-BRIDGE-MARKER — мост: лабораторные маркёры → 28 механизмов ТЗ
//
//  Отображение ~85 лаб маркёров (UCUM_MAP + lab-marker-map + lab-priority-map)
//  на 28 кодов ТЗ (cv1-cv5, liv1-liv3, ren1-ren4, cns1-cns6, rep1-rep5, hem1-hem5).
//
//  getActivatedTzMechs(labs) — главная функция:
//    вход — LabValues (Record<string, number>)
//    выход — массив { mechId, organId, severity, markers[] }
//    активирует механизм если маркёр отклонён от нормы (ULN/LLN)
//
//  Источник: только 28 кодов ТЗ (AGENTS.md правило №15)
//  Не зависит от BRIDGE_MECH_TO_CATALOG / MECHANISM_LABELS
// ════════════════════════════════════════════════════════════════════════════

export type TzMechId =
  | 'cv1' | 'cv2' | 'cv3' | 'cv4' | 'cv5'
  | 'liv1' | 'liv2' | 'liv3'
  | 'ren1' | 'ren2' | 'ren3' | 'ren4'
  | 'cns1' | 'cns2' | 'cns3' | 'cns4' | 'cns5' | 'cns6'
  | 'rep1' | 'rep2' | 'rep3' | 'rep4' | 'rep5'
  | 'hem1' | 'hem2' | 'hem3' | 'hem4' | 'hem5';

export type TzOrganId = 'cardio' | 'hepatic' | 'renal' | 'cns' | 'reproductive' | 'hematologic';

export type Severity = 'mild' | 'moderate' | 'severe' | 'normal';

export interface MarkerMechLink {
  marker: string;          // UCUM_MAP key (ALT, AST, GGT, ...)
  organId: TzOrganId;
  mechId: TzMechId;
  direction: 'up' | 'down'; // up = выше ULN активирует, down = ниже LLN активирует
  uln?: number;            // upper limit of normal
  lln?: number;            // lower limit of normal
}

export interface ActivatedMech {
  mechId: TzMechId;
  organId: TzOrganId;
  severity: Severity;
  markers: { marker: string; value: number; severity: Severity }[];
}

// ════════════════════════════════════════════════════════════════════════════
//  ТАБЛИЦА МАРКЁР → МЕХАНИЗМ ТЗ
//  Пороги взяты из UCUM_MAP (src/core/constants.ts) и lab-marker-map.ts
//  direction=up: активируется когда value > uln
//  direction=down: активируется когда value < lln
// ════════════════════════════════════════════════════════════════════════════

export const MARKER_TO_TZ_MECH: MarkerMechLink[] = [
  // ─── ПЕЧЕНЬ / Гепатобилиарная ───
  { marker: 'ALT',           organId: 'hepatic', mechId: 'liv1', direction: 'up', uln: 40 },
  { marker: 'AST',           organId: 'hepatic', mechId: 'liv1', direction: 'up', uln: 40 },
  { marker: 'GGT',           organId: 'hepatic', mechId: 'liv2', direction: 'up', uln: 55 },
  { marker: 'BILIRUBIN',     organId: 'hepatic', mechId: 'liv2', direction: 'up', uln: 21 },
  { marker: 'DIRECT_BIL',    organId: 'hepatic', mechId: 'liv2', direction: 'up', uln: 5 },
  { marker: 'ALP',           organId: 'hepatic', mechId: 'liv2', direction: 'up', uln: 130 },
  { marker: 'BILE_ACIDS',    organId: 'hepatic', mechId: 'liv2', direction: 'up', uln: 10 },
  { marker: 'AMMONIA',       organId: 'hepatic', mechId: 'liv1', direction: 'up', uln: 50 },
  { marker: 'LACTATE',       organId: 'hepatic', mechId: 'liv1', direction: 'up', uln: 2.2 },
  { marker: 'AFP',           organId: 'hepatic', mechId: 'liv3', direction: 'up', uln: 10 },
  { marker: 'TOTAL_PROTEIN', organId: 'hepatic', mechId: 'liv1', direction: 'down', lln: 65 },
  { marker: 'ALB',           organId: 'hepatic', mechId: 'liv1', direction: 'down', lln: 35 },
  { marker: 'CHOLINESTERASE',organId: 'hepatic', mechId: 'liv1', direction: 'down', lln: 5000 },

  // ─── ССС / Сердечно-сосудистая ───
  { marker: 'LDL',           organId: 'cardio', mechId: 'cv2', direction: 'up', uln: 3.0 },
  { marker: 'HDL',           organId: 'cardio', mechId: 'cv2', direction: 'down', lln: 1.0 },
  { marker: 'TG',           organId: 'cardio', mechId: 'cv2', direction: 'up', uln: 1.7 },
  { marker: 'CHOL',         organId: 'cardio', mechId: 'cv2', direction: 'up', uln: 5.2 },
  { marker: 'ApoB',         organId: 'cardio', mechId: 'cv2', direction: 'up', uln: 1.1 },
  { marker: 'Lpa',          organId: 'cardio', mechId: 'cv2', direction: 'up', uln: 30 },
  { marker: 'HsCRP',        organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 2.0 },
  { marker: 'HSTNI',        organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 0.014 },
  { marker: 'NTproBNP',     organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 125 },
  { marker: 'D_DIMER',      organId: 'cardio', mechId: 'cv4', direction: 'up', uln: 0.5 },
  { marker: 'FIBRINOGEN',   organId: 'cardio', mechId: 'cv4', direction: 'up', uln: 4.0 },
  { marker: 'BLOOD_PRESSURE_SYS', organId: 'cardio', mechId: 'cv3', direction: 'up', uln: 140 },
  { marker: 'BLOOD_PRESSURE_DIA', organId: 'cardio', mechId: 'cv3', direction: 'up', uln: 90 },
  { marker: 'HEART_RATE',    organId: 'cardio', mechId: 'cv5', direction: 'up', uln: 90 },
  { marker: 'QT_INTERVAL',  organId: 'cardio', mechId: 'cv5', direction: 'up', uln: 440 },
  { marker: 'ECHO_LV_MASS', organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 220 },
  { marker: 'ECHO_EF',      organId: 'cardio', mechId: 'cv1', direction: 'down', lln: 55 },
  { marker: 'ECHO_LA',      organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 40 },

  // ─── ПОЧКИ / Мочевыделительная ───
  { marker: 'CREATININE',   organId: 'renal', mechId: 'ren1', direction: 'up', uln: 110 },
  { marker: 'UREA',         organId: 'renal', mechId: 'ren1', direction: 'up', uln: 8.3 },
  { marker: 'CYSTATIN_C',   organId: 'renal', mechId: 'ren1', direction: 'up', uln: 1.0 },
  { marker: 'EGFR',         organId: 'renal', mechId: 'ren1', direction: 'down', lln: 90 },
  { marker: 'UACR',         organId: 'renal', mechId: 'ren3', direction: 'up', uln: 30 },
  { marker: 'PROTEIN_URINE',organId: 'renal', mechId: 'ren3', direction: 'up', uln: 0.15 },
  { marker: 'URIC_ACID',    organId: 'renal', mechId: 'ren2', direction: 'up', uln: 420 },
  { marker: 'K',            organId: 'renal', mechId: 'ren4', direction: 'up', uln: 5.1 },
  { marker: 'NA',           organId: 'renal', mechId: 'ren4', direction: 'up', uln: 145 },
  { marker: 'CA',           organId: 'renal', mechId: 'ren4', direction: 'up', uln: 2.6 },
  { marker: 'PHOSPHORUS',   organId: 'renal', mechId: 'ren4', direction: 'up', uln: 1.78 },
  { marker: 'MG',           organId: 'renal', mechId: 'ren4', direction: 'down', lln: 0.7 },

  // ─── ЦНС / Нервная система ───
  { marker: 'PROLACTIN',    organId: 'cns', mechId: 'cns1', direction: 'up', uln: 15 },
  { marker: 'CORTISOL',     organId: 'cns', mechId: 'cns4', direction: 'up', uln: 700 },
  { marker: 'DOPAMINE',     organId: 'cns', mechId: 'cns1', direction: 'down', lln: 50 },
  { marker: 'SEROTONIN',    organId: 'cns', mechId: 'cns1', direction: 'down', lln: 100 },
  { marker: 'MELATONIN',    organId: 'cns', mechId: 'cns1', direction: 'down', lln: 3 },
  { marker: 'GABA',         organId: 'cns', mechId: 'cns1', direction: 'down', lln: 100 },
  { marker: 'GLUTAMATE',    organId: 'cns', mechId: 'cns2', direction: 'up', uln: 50 },
  { marker: 'MDA',          organId: 'cns', mechId: 'cns2', direction: 'up', uln: 3.5 },
  { marker: 'HOMOCYSTEINE', organId: 'cns', mechId: 'cns2', direction: 'up', uln: 15 },
  { marker: 'MOXI',         organId: 'cns', mechId: 'cns3', direction: 'up', uln: 0.25 },
  { marker: 'NEURON_SPECIFIC_ENOLASE', organId: 'cns', mechId: 'cns3', direction: 'up', uln: 15 },
  { marker: 'TSH',          organId: 'cns', mechId: 'cns4', direction: 'up', uln: 4.0 },
  { marker: 'GLUCOSE',      organId: 'cns', mechId: 'cns5', direction: 'down', lln: 3.5 },
  { marker: 'INSULIN',      organId: 'cns', mechId: 'cns5', direction: 'up', uln: 25 },
  { marker: 'HOMA_IR',      organId: 'cns', mechId: 'cns5', direction: 'up', uln: 2.7 },
  { marker: 'PROLACTINOMA', organId: 'cns', mechId: 'cns6', direction: 'up', uln: 1 },

  // ─── РЕПРОДУКТИВНАЯ / HPG-ось ───
  { marker: 'TESTOSTERONE', organId: 'reproductive', mechId: 'rep1', direction: 'down', lln: 12 },
  { marker: 'FREE_TESTO',   organId: 'reproductive', mechId: 'rep1', direction: 'down', lln: 0.25 },
  { marker: 'LH',           organId: 'reproductive', mechId: 'rep1', direction: 'down', lln: 1.7 },
  { marker: 'FSH',          organId: 'reproductive', mechId: 'rep1', direction: 'down', lln: 1.5 },
  { marker: 'INTRATEST_T',  organId: 'reproductive', mechId: 'rep2', direction: 'down', lln: 50 },
  { marker: 'SPERM_COUNT',  organId: 'reproductive', mechId: 'rep3', direction: 'down', lln: 15 },
  { marker: 'SPERM_MOTILITY',organId:'reproductive', mechId: 'rep3', direction: 'down', lln: 40 },
  { marker: 'SPERM_MORPHOLOGY',organId:'reproductive',mechId:'rep3', direction: 'down', lln: 4 },
  { marker: 'ESTRADIOL',    organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 200 },
  { marker: 'E2_LH_RATIO',  organId:'reproductive', mechId: 'rep4', direction: 'up', uln: 20 },
  { marker: 'SHBG',         organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 60 },
  { marker: 'INHIBIN_B',    organId: 'reproductive', mechId: 'rep3', direction: 'down', lln: 80 },
  { marker: 'AMH',          organId: 'reproductive', mechId: 'rep3', direction: 'down', lln: 1.0 },
  { marker: 'PROGESTERONE', organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 1.4 },
  { marker: 'PROLAC_REP',   organId: 'reproductive', mechId: 'rep1', direction: 'up', uln: 15 },

  // ─── ГЕМАТОЛОГО-МЕТАБОЛИЧЕСКИЙ ───
  { marker: 'HEMOGLOBIN',   organId: 'hematologic', mechId: 'hem1', direction: 'up', uln: 180 },
  { marker: 'HEMATOCRIT',   organId: 'hematologic', mechId: 'hem1', direction: 'up', uln: 54 },
  { marker: 'RBC',          organId: 'hematologic', mechId: 'hem1', direction: 'up', uln: 5.9 },
  { marker: 'GLUCOSE_FAST', organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 5.6 },
  { marker: 'INSULIN_FAST',organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 25 },
  { marker: 'HBA1C',        organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 5.7 },
  { marker: 'HOMA_IR_H',    organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 2.7 },
  { marker: 'GLUCOSE_LOW',  organId: 'hematologic', mechId: 'hem3', direction: 'down', lln: 3.5 },
  { marker: 'CPEPTIDE_LOW', organId: 'hematologic', mechId: 'hem3', direction: 'down', lln: 0.5 },
  { marker: 'POTASSIUM',    organId: 'hematologic', mechId: 'hem4', direction: 'down', lln: 3.5 },
  { marker: 'POTASSIUM_HIGH',organId:'hematologic', mechId: 'hem4', direction: 'up', uln: 5.5 },
  { marker: 'SODIUM',       organId: 'hematologic', mechId: 'hem5', direction: 'down', lln: 135 },
  { marker: 'CHLORIDE',     organId: 'hematologic', mechId: 'hem5', direction: 'down', lln: 98 },
  { marker: 'RENIN',        organId: 'hematologic', mechId: 'hem5', direction: 'up', uln: 25 },
  { marker: 'ALDOSTERONE', organId: 'hematologic', mechId: 'hem5', direction: 'up', uln: 15 },
  { marker: 'COPEPTIN',     organId: 'hematologic', mechId: 'hem5', direction: 'up', uln: 14 },

  // ─── Эндокринный блок (перекрёстный) ───
  { marker: 'IGF1',         organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 280 },
  { marker: 'GH',           organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 5 },
  { marker: 'INSULIN_GENE',organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 25 },
  { marker: 'TROPONIN',     organId: 'cardio', mechId: 'cv4', direction: 'up', uln: 0.04 },
  { marker: 'PROCALCITONIN',organId: 'cardio', mechId: 'cv1', direction: 'up', uln: 0.5 },
  { marker: 'FERRITIN',     organId: 'hematologic', mechId: 'hem1', direction: 'down', lln: 30 },
  { marker: 'IRON',         organId: 'hematologic', mechId: 'hem1', direction: 'down', lln: 10 },
  { marker: 'TSAT',         organId: 'hematologic', mechId: 'hem1', direction: 'down', lln: 20 },
  { marker: 'VITAMIN_D',     organId: 'reproductive', mechId: 'rep2', direction: 'down', lln: 30 },
  { marker: 'ZINC',         organId: 'reproductive', mechId: 'rep2', direction: 'down', lln: 10 },
  { marker: 'SELENIUM',     organId: 'hematologic', mechId: 'hem1', direction: 'down', lln: 70 },
  { marker: 'MAGNESIUM_H',  organId: 'hematologic', mechId: 'hem4', direction: 'down', lln: 0.7 },
  { marker: 'CALCIUM_ION',  organId: 'hematologic', mechId: 'hem4', direction: 'up', uln: 1.32 },
  { marker: 'PHOSPHATASE',  organId: 'hematologic', mechId: 'hem4', direction: 'up', uln: 120 },
  { marker: 'PTH',          organId: 'hematologic', mechId: 'hem4', direction: 'up', uln: 65 },
  { marker: 'PROINSULIN',   organId: 'hematologic', mechId: 'hem3', direction: 'up', uln: 15 },
  { marker: 'CPEPTIDE',     organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 3.5 },
  { marker: 'GLUCAGRONS',   organId: 'hematologic', mechId: 'hem3', direction: 'up', uln: 200 },
  { marker: 'CORTISOL_H',   organId: 'hematologic', mechId: 'hem2', direction: 'up', uln: 700 },
  { marker: 'TESTOSTERONE_FREE', organId: 'reproductive', mechId: 'rep2', direction: 'down', lln: 65 },
  { marker: 'EPI_TESTO',    organId: 'reproductive', mechId: 'rep5', direction: 'down', lln: 5 },
  // ─── ДОПОЛНИТЕЛЬНЫЕ МАРКЁРЫ (отсутствовали в MARKER_TO_TZ_MECH) ───
  { marker: 'DHT',          organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 3.5 },
  { marker: 'CK',           organId: 'cardio',       mechId: 'cv1',  direction: 'up', uln: 200 },
  { marker: 'ESR',          organId: 'cardio',       mechId: 'cv1',  direction: 'up', uln: 15 },
  { marker: 'PLT',          organId: 'hematologic',  mechId: 'hem1', direction: 'up', uln: 400 },
  { marker: 'PSA_TOTAL',    organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 4.0 },
  { marker: 'PSA_FREE',     organId: 'reproductive', mechId: 'rep4', direction: 'down', lln: 0.8 },
  { marker: 'B12',          organId: 'hematologic',  mechId: 'hem1', direction: 'down', lln: 200 },
  { marker: 'DHEA_S',       organId: 'reproductive', mechId: 'rep1', direction: 'down', lln: 200 },
  { marker: 'T3_FREE',      organId: 'cns',          mechId: 'cns4', direction: 'down', lln: 3.5 },
  { marker: 'T4_FREE',      organId: 'cns',          mechId: 'cns4', direction: 'down', lln: 9.0 },
  { marker: 'ANTI_TPO',     organId: 'cns',          mechId: 'cns4', direction: 'up', uln: 34 },
  { marker: 'IL_6',         organId: 'cardio',       mechId: 'cv1',  direction: 'up', uln: 7.0 },
  { marker: 'TNF_ALPHA',    organId: 'cardio',       mechId: 'cv1',  direction: 'up', uln: 8.1 },
  { marker: 'CALCIUM',      organId: 'hematologic',  mechId: 'hem4', direction: 'up', uln: 2.6 },
  { marker: 'MAGNESIUM',    organId: 'hematologic',  mechId: 'hem4', direction: 'down', lln: 0.7 },
  { marker: 'PSA',          organId: 'reproductive', mechId: 'rep4', direction: 'up', uln: 4.0 },
  // GLUCOSE как маркер hem2 (инсулинорезистентность) — повторная запись,
  // чтобы GLUCOSE активировал ОБА меха: cns5 (гипо) и hem2 (IR)
  { marker: 'GLUCOSE',      organId: 'hematologic',  mechId: 'hem2', direction: 'up', uln: 5.6 },
];

// ════════════════════════════════════════════════════════════════════════════
//  АЛИАСЫ: синонимы маркёров → ключ UCUM_MAP / MARKER_TO_TZ_MECH
// ════════════════════════════════════════════════════════════════════════════
export const MARKER_ALIASES: Record<string, string> = {
  'АЛТ': 'ALT', 'АСТ': 'AST', 'ГГТ': 'GGT', 'ЩФ': 'ALP',
  'Билирубин': 'BILIRUBIN', 'Билирубин общий': 'BILIRUBIN',
  'Билирубин прямой': 'DIRECT_BIL', 'Креатинин': 'CREATININE',
  'Мочевина': 'UREA', 'Мочевая кислота': 'URIC_ACID',
  'Гемоглобин': 'HEMOGLOBIN', 'Гематокрит': 'HEMATOCRIT',
  'ЛПНП': 'LDL', 'ЛПВП': 'HDL', 'ТГ': 'TG', 'Холестерин': 'CHOL',
  'Глюкоза': 'GLUCOSE_FAST', 'Глюкоза натощак': 'GLUCOSE_FAST',
  'Инсулин': 'INSULIN_FAST', 'Инсулин натощак': 'INSULIN_FAST',
  'Гликированный гемоглобин': 'HBA1C', 'HbA1c': 'HBA1C',
  'Калий': 'POTASSIUM', 'Натрий': 'SODIUM',
  'Гомоцистеин': 'HOMOCYSTEINE', 'Ферритин': 'FERRITIN',
  'Витамин D': 'VITAMIN_D', '25-OH-D': 'VITAMIN_D',
  'Цинк': 'ZINC', 'Селен': 'SELENIUM',
  'Альбумин': 'ALB', 'Общий белок': 'TOTAL_PROTEIN',
  'ТТГ': 'TSH', 'Тестостерон': 'TESTOSTERONE',
  'Тестостерон свободный': 'FREE_TESTO',
  'Эстрадиол': 'ESTRADIOL', 'Прогестерон': 'PROGESTERONE',
  'Пролактин': 'PROLACTIN', 'ЛГ': 'LH', 'ФСГ': 'FSH',
  'ГСПГ': 'SHBG', 'ГСПГ высокий': 'SHBG',
  'Спермограмма': 'SPERM_COUNT', 'Подвижность': 'SPERM_MOTILITY',
  'Морфология': 'SPERM_MORPHOLOGY',
  'D-димер': 'D_DIMER', 'Фибриноген': 'FIBRINOGEN',
  'hsCRP': 'HsCRP', 'СРБ': 'HsCRP',
  'NT-proBNP': 'NTproBNP', 'NTproBNP': 'NTproBNP',
  'Тропонин': 'TROPONIN', 'hsTnI': 'HSTNI',
  'АпоB': 'ApoB', 'Лп(а)': 'Lpa', 'Apo(a)': 'Lpa',
  'АД сист': 'BLOOD_PRESSURE_SYS', 'АД диаст': 'BLOOD_PRESSURE_DIA',
  'ЧСС': 'HEART_RATE', 'Интервал QT': 'QT_INTERVAL',
  'ЭхоКГ ЛЖ масса': 'ECHO_LV_MASS', 'ЭхоКГ ФВ': 'ECHO_EF',
  'ЭхоКГ ЛП': 'ECHO_LA',
  'Ингибин B': 'INHIBIN_B', 'АМГ': 'AMH', 'Антимюллеров': 'AMH',
  'С-пептид': 'CPEPTIDE', 'Проинсулин': 'PROINSULIN',
  'Цистатин C': 'CYSTATIN_C', 'Расчёт СКФ': 'EGFR',
  'СКФ расчётная': 'EGFR', 'СКФ': 'EGFR',
  'Альбумин/креатинин мочи': 'UACR',
  'Белок в моче': 'PROTEIN_URINE',
  'АФП': 'AFP', 'ТГ-LOW': 'GLUCOSE_LOW',
  'Калий-LOW': 'POTASSIUM', 'К-LOW': 'POTASSIUM',
  // ─── АНГЛИЙСКИЕ АЛИАСЫ (UI отправляет эти имена через toUpperCase/MARKER_RENAME) ───
  'TRIGLYCERIDES': 'TG',
  'TOTAL_CHOLESTEROL': 'CHOL',
  'CHOLESTEROL_LDL': 'LDL',
  'CHOLESTEROL_HDL': 'HDL',
  'FREE_TESTOSTERONE': 'FREE_TESTO',
  'CRP': 'HsCRP',
  'HSCRP': 'HsCRP',
  'HGB': 'HEMOGLOBIN',
  'PRL': 'PROLACTIN',
  'BIL': 'BILIRUBIN',
  'BILIRUBIN_TOTAL': 'BILIRUBIN',
  'TOTAL_BILIRUBIN': 'BILIRUBIN',
  'PROG': 'PROGESTERONE',
  'CALCIUM': 'CA',
  'MAGNESIUM': 'MG',
  'HCT': 'HEMATOCRIT',
  'E2': 'ESTRADIOL',
  'TOTAL_TESTOSTERONE': 'TESTOSTERONE',
  'TG_LIPID': 'TG',
  'LP_A': 'Lpa',
  'PSA_TOTAL': 'PSA_TOTAL',
  'PSA_FREE': 'PSA_FREE',
  'DHEA_S': 'DHEA_S',
  'IL_6': 'IL_6',
  'TNF_ALPHA': 'TNF_ALPHA',
  'TRANSFERRIN_SAT': 'TSAT',
  'CK_MB': 'CK_MB',
  'T3_FREE': 'T3_FREE',
  'T4_FREE': 'T4_FREE',
  'ANTI_TPO': 'ANTI_TPO',
  'ANTI_TG': 'ANTI_TG',
  '3A_ADG': '3A_ADG',
  'CA_125': 'CA_125',
};

// ════════════════════════════════════════════════════════════════════════════
//  Нормализация маркёра
// ════════════════════════════════════════════════════════════════════════════
export function normalizeMarker(m: string): string {
  if (!m) return '';
  const trimmed = m.trim();
  // точное совпадение
  if (MARKER_TO_TZ_MECH.some(x => x.marker === trimmed)) return trimmed;
  // алиас
  const aliased = MARKER_ALIASES[trimmed];
  if (aliased) return aliased;
  // case-insensitive
  const lower = trimmed.toLowerCase();
  for (const x of MARKER_TO_TZ_MECH) {
    if (x.marker.toLowerCase() === lower) return x.marker;
  }
  return trimmed; // вернуть как есть — возможно canonical
}

// ════════════════════════════════════════════════════════════════════════════
//  Расчёт severity
//    для direction=up:   value > uln → mild/moderate/severe
//    для direction=down: value < lln → mild/moderate/severe
//  mild     = 1.0-1.5× ULN  (или 0.7-0.9× LLN)
//  moderate = 1.5-3.0× ULN  (или 0.4-0.7× LLN)
//  severe   = >3.0× ULN     (или <0.4× LLN)
// ════════════════════════════════════════════════════════════════════════════
export function calcSeverity(
  value: number,
  link: MarkerMechLink
): Severity {
  if (link.direction === 'up' && link.uln != null) {
    const uln = link.uln;
    if (value <= uln) return 'normal';
    const ratio = value / uln;
    if (ratio >= 3.0) return 'severe';
    if (ratio >= 1.5) return 'moderate';
    return 'mild';
  }
  if (link.direction === 'down' && link.lln != null) {
    const lln = link.lln;
    if (value >= lln) return 'normal';
    const ratio = value / lln;
    if (ratio <= 0.4) return 'severe';
    if (ratio <= 0.7) return 'moderate';
    return 'mild';
  }
  return 'normal';
}

// ════════════════════════════════════════════════════════════════════════════
//  Главная функция: LabValues → активированные ТЗ-механизмы
//
//  labs: Record<string, number> — маркёр → значение
//  возвращает массив ActivatedMech (один на механизм, агрегируя маркёры)
// ════════════════════════════════════════════════════════════════════════════
export interface LabValues {
  [marker: string]: number;
}

export function getActivatedTzMechs(labs: LabValues): ActivatedMech[] {
  if (!labs || typeof labs !== 'object') return [];

  const map = new Map<string, ActivatedMech>();
  const sevRank: Record<Severity, number> = { normal: 0, mild: 1, moderate: 2, severe: 3 };

  for (const [rawMarker, value] of Object.entries(labs)) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    const marker = normalizeMarker(rawMarker);
    // filter (не find) — один маркер может активировать несколько мехов
    // (например, GLUCOSE → cns5 гипогликемия + hem2 инсулинорезистентность)
    const links = MARKER_TO_TZ_MECH.filter(x => x.marker === marker);
    if (links.length === 0) continue;

    for (const link of links) {
      const sev = calcSeverity(value, link);
      if (sev === 'normal') continue;

      const key = link.mechId;
      const existing = map.get(key);
      const entry = { marker, value, severity: sev };

      if (!existing) {
        map.set(key, {
          mechId: link.mechId,
          organId: link.organId,
          severity: sev,
          markers: [entry],
        });
      } else {
        existing.markers.push(entry);
        // эскалация до максимальной severity
        if (sevRank[sev] > sevRank[existing.severity]) {
          existing.severity = sev;
        }
      }
    }
  }

  return Array.from(map.values());
}

// ════════════════════════════════════════════════════════════════════════════
//  Утилиты
// ════════════════════════════════════════════════════════════════════════════

export function getActivatedMechIds(labs: LabValues): TzMechId[] {
  return getActivatedTzMechs(labs).map(m => m.mechId);
}

export function getActivatedOrgans(labs: LabValues): TzOrganId[] {
  const set = new Set<TzOrganId>();
  for (const m of getActivatedTzMechs(labs)) set.add(m.organId);
  return Array.from(set);
}

export function hasSevereMech(labs: LabValues, mechId: TzMechId): boolean {
  return getActivatedTzMechs(labs).some(m => m.mechId === mechId && m.severity === 'severe');
}

// Подсчёт активированных механизмов по органам
export function countMechsByOrgan(labs: LabValues): Record<TzOrganId, number> {
  const result: Record<TzOrganId, number> = {
    cardio: 0, hepatic: 0, renal: 0, cns: 0, reproductive: 0, hematologic: 0,
  };
  for (const m of getActivatedTzMechs(labs)) {
    result[m.organId] = (result[m.organId] || 0) + 1;
  }
  return result;
}

// Найти все маркёры, активирующие конкретный механизм
export function getMarkersForMech(mechId: TzMechId): MarkerMechLink[] {
  return MARKER_TO_TZ_MECH.filter(x => x.mechId === mechId);
}

// Все 28 кодов ТЗ
export const ALL_TZ_MECH_IDS: TzMechId[] = [
  'cv1','cv2','cv3','cv4','cv5',
  'liv1','liv2','liv3',
  'ren1','ren2','ren3','ren4',
  'cns1','cns2','cns3','cns4','cns5','cns6',
  'rep1','rep2','rep3','rep4','rep5',
  'hem1','hem2','hem3','hem4','hem5',
];

// Все 6 органов ТЗ
export const ALL_TZ_ORGANS: TzOrganId[] = [
  'cardio','hepatic','renal','cns','reproductive','hematologic',
];