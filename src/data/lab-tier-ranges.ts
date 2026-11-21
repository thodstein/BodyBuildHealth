// ════════════════════════════════════════════════════════════════════════════
//  LAB-TIER-RANGES — 4-уровневая система порогов для анализов
//
//  TIER 0 = норма (протокол без изменений)
//  TIER 1 = грань (профилактика «до»: +1-2 адаптива + нутри-AC)
//  TIER 2 = лечение (усиленный стэк, дозы↑, ↓dose AAS)
//  TIER 3 = ⛔ экстрено (STOP COURSE + к врачу)
//
//  deriveTier(marker, value, sex?) → 0|1|2|3
// ════════════════════════════════════════════════════════════════════════════

import {
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN, UA_STAGE_ULN, UA_LLN, NT_PROBNP_STEPS, CK_MB_STEPS, E2_MALE_BAND,
  FT_MALE_BAND,
  DHT_BAND,
  RETIC_BAND,
} from '../engines/lab-norms.engine';
import { ucumInfo } from '../core/constants';
import { unitsIncommensurable } from '../core/labs-mapping';

export type Tier = 0 | 1 | 2 | 3;

export interface LabTierThreshold {
  marker: string;
  normal: [number, number];      // [min, max] — TIER 0
  borderline: ([number, number]) | [number, number, number, number];   // TIER 1 (грань)
  treatment: ([number, number]) | [number, number, number, number];    // TIER 2 (лечение)
  emergencyLow?: number;          // TIER 3 — нижняя граница экстрено
  emergencyHigh?: number;         // TIER 3 — верхняя граница экстрено
  direction: 'high' | 'low' | 'both';
  unit: string;
  label: string;
}

export const LAB_TIERS: Record<string, LabTierThreshold> = {

  // ─── CARDIO ───
  LDL:               { marker:' LDL', normal:[0,3.0], borderline:[3.0,3.5], treatment:[3.5,5], emergencyHigh:5, direction:'high', unit:'mmol/L', label:'LDL' },
  HDL:               { marker:'HDL', normal:[1.0,5], borderline:[0.8,1.0], treatment:[0.4,0.8], emergencyLow:0.4, direction:'low', unit:'mmol/L', label:'HDL' },
  TRIGLYCERIDES:     { marker:'TRIGLYCERIDES', normal:[0,1.7], borderline:[1.7,2.3], treatment:[2.3,5.6], emergencyHigh:5.6, direction:'high', unit:'mmol/L', label:'ТГ' },
  CHOLESTEROL_TOTAL: { marker:'CHOLESTEROL_TOTAL', normal:[0,5.2], borderline:[5.2,6.2], treatment:[6.2,7.8], emergencyHigh:7.8, direction:'high', unit:'mmol/L', label:'Холестерин' },
  BP_SYSTOLIC:      { marker:'BP_SYSTOLIC', normal:[90,130], borderline:[130,140], treatment:[140,160], emergencyHigh:160, direction:'high', unit:'mmHg', label:'АД сист' },
  BP_DIASTOLIC:     { marker:'BP_DIASTOLIC', normal:[60,85], borderline:[85,90], treatment:[90,110], emergencyHigh:110, direction:'high', unit:'mmHg', label:'АД диаст' },
  HR:               { marker:'HR', normal:[50,80], borderline:[80,90], treatment:[90,110], emergencyHigh:110, direction:'high', unit:'уд/мин', label:'ЧСС' },
  CK:               { marker:'CK', normal:[0,200], borderline:[200,1000], treatment:[1000,5000], emergencyHigh:5000, direction:'high', unit:'U/L', label:'КФК' },
  NT_PROBNP:        { marker:'NT_PROBNP', normal:[0, NT_PROBNP_STEPS[0]], borderline:[NT_PROBNP_STEPS[0], NT_PROBNP_STEPS[1]], treatment:[NT_PROBNP_STEPS[1], NT_PROBNP_STEPS[2]], emergencyHigh:NT_PROBNP_STEPS[2], direction:'high', unit:'pg/mL', label:'NT-proBNP' },
  D_DIMER:          { marker:'D_DIMER', normal:[0,0.5], borderline:[0.5,1], treatment:[1,2.5], emergencyHigh:2.5, direction:'high', unit:'мг/L', label:'D-димер' },
  FIBRINOGEN:       { marker:'FIBRINOGEN', normal:[2,4], borderline:[4,5.5], treatment:[5.5,8], emergencyHigh:8, direction:'high', unit:'г/L', label:'Фибриноген' },
  ESR:              { marker:'ESR', normal:[0,15], borderline:[15,30], treatment:[30,60], emergencyHigh:60, direction:'high', unit:'мм/ч', label:'СОЭ' },
  TROPONIN_I:       { marker:'TROPONIN_I', normal:[0,0.04], borderline:[0.04,0.1], treatment:[0.1,1], emergencyHigh:1, direction:'high', unit:'ng/mL', label:'Тропонин I' },
  CK_MB:            { marker:'CK_MB', normal:[0, CK_MB_STEPS.borderline], borderline:[CK_MB_STEPS.borderline, CK_MB_STEPS.treatment], treatment:[CK_MB_STEPS.treatment, CK_MB_STEPS.emergency], emergencyHigh:CK_MB_STEPS.emergency, direction:'high', unit:'Е/л', label:'КФК-MB' },
  APO_B:            { marker:'APO_B', normal:[0,1.0], borderline:[1.0,1.2], treatment:[1.2,1.8], emergencyHigh:1.8, direction:'high', unit:'g/L', label:'ApoB' },
  LP_A:             { marker:'LP_A', normal:[0,30], borderline:[30,50], treatment:[50,100], emergencyHigh:100, direction:'high', unit:'mg/dL', label:'Lp(a)' },

  // ─── HEPATIC ───
  ALT:              { marker:'ALT', normal:[0, LFT_ULN.ALT.male], borderline:[LFT_ULN.ALT.male, LFT_STAGE_ULN.reduce.male], treatment:[LFT_STAGE_ULN.reduce.male, LFT_STAGE_ULN.stopOral.male], emergencyHigh:LFT_STAGE_ULN.stopOral.male, direction:'high', unit:'U/L', label:'АЛТ' },
  AST:              { marker:'AST', normal:[0, LFT_ULN.AST.male], borderline:[LFT_ULN.AST.male, LFT_STAGE_ULN.reduce.male], treatment:[LFT_STAGE_ULN.reduce.male, LFT_STAGE_ULN.stopOral.male], emergencyHigh:LFT_STAGE_ULN.stopOral.male, direction:'high', unit:'U/L', label:'АСТ' },
  GGT:              { marker:'GGT', normal:[0, GGT_ULN.male], borderline:[GGT_ULN.male, GGT_STAGE_ULN.double.male], treatment:[GGT_STAGE_ULN.double.male, GGT_STAGE_ULN.triple.male], emergencyHigh:GGT_STAGE_ULN.triple.male, direction:'high', unit:'U/L', label:'ГГТ' },
  BILIRUBIN:        { marker:'BILIRUBIN', normal:[0,21], borderline:[21,40], treatment:[40,100], emergencyHigh:100, direction:'high', unit:'mcmol/L', label:'Билирубин' },
  ALP:              { marker:'ALP', normal:[0,120], borderline:[120,200], treatment:[200,400], emergencyHigh:400, direction:'high', unit:'U/L', label:'ЩФ' },
  AMMONIA:          { marker:'AMMONIA', normal:[0,50], borderline:[50,80], treatment:[80,150], emergencyHigh:150, direction:'high', unit:'mcmol/L', label:'Аммиак' },
  BILE_ACIDS:       { marker:'BILE_ACIDS', normal:[0,10], borderline:[10,20], treatment:[20,50], emergencyHigh:50, direction:'high', unit:'mcmol/L', label:'Жёлчные кислоты' },

  // ─── RENAL ───
  CREATININE:       { marker:'CREATININE', normal:[40, CREATININE_ULN.male], borderline:[CREATININE_ULN.male, 130], treatment:[130,200], emergencyHigh:200, direction:'high', unit:'mcmol/L', label:'Креатинин' },
  EGFR:             { marker:'EGFR', normal:[90,200], borderline:[60,90], treatment:[30,60], emergencyLow:30, direction:'low', unit:'mL/min', label:'eGFR' },
  CYSTATIN_C:       { marker:'CYSTATIN_C', normal:[0,1.0], borderline:[1.0,1.3], treatment:[1.3,2], emergencyHigh:2, direction:'high', unit:'mg/L', label:'Цистатин C' },
  UREA:             { marker:'UREA', normal:[2.5,8], borderline:[8,12], treatment:[12,20], emergencyHigh:20, direction:'high', unit:'mmol/L', label:'Мочевина' },
  URIC_ACID:        { marker:'URIC_ACID', normal:[UA_LLN.male, UA_STAGE_ULN.male[0]], borderline:[UA_STAGE_ULN.male[0], UA_STAGE_ULN.male[1]], treatment:[UA_STAGE_ULN.male[1], 600], emergencyHigh:600, direction:'high', unit:'mcmol/L', label:'Мочевая кислота' },
  PROTEIN_URINE:    { marker:'PROTEIN_URINE', normal:[0,0.15], borderline:[0.15,0.5], treatment:[0.5,1.0], emergencyHigh:1.0, direction:'high', unit:'g/L', label:'Протеинурия' },
  MICROALB:         { marker:'MICROALB', normal:[0,20], borderline:[20,30], treatment:[30,300], emergencyHigh:300, direction:'high', unit:'mg/L', label:'Микроальбумин' },
  NGAL:             { marker:'NGAL', normal:[0,100], borderline:[100,200], treatment:[200,500], emergencyHigh:500, direction:'high', unit:'ng/mL', label:'NGAL' },
  KIM1:             { marker:'KIM1', normal:[0,1.5], borderline:[1.5,3], treatment:[3,6], emergencyHigh:6, direction:'high', unit:'ng/mL', label:'KIM-1' },

  // ─── HEMATOLOGIC ───
  HCT:              { marker:'HCT', normal:[36, HCT_THRESHOLDS.male.erythrocytosis], borderline:[HCT_THRESHOLDS.male.erythrocytosis, HCT_THRESHOLDS.male.block], treatment:[HCT_THRESHOLDS.male.block, HCT_THRESHOLDS.male.block + 6], emergencyHigh:HCT_THRESHOLDS.male.block + 6, direction:'high', unit:'%', label:'Гематокрит' },
  HEMOGLOBIN:       { marker:'HEMOGLOBIN', normal:[120, HGB_THRESHOLDS.male.upper], borderline:[HGB_THRESHOLDS.male.upper, HGB_THRESHOLDS.male.block], treatment:[HGB_THRESHOLDS.male.block, 200], emergencyHigh:200, direction:'high', unit:'g/L', label:'Гемоглобин' },
  PLT:              { marker:'PLT', normal:[150,350], borderline:[350,450], treatment:[450,600], emergencyHigh:600, emergencyLow:100, direction:'both', unit:'10⁹/L', label:'Тромбоциты' },
  RBC:              { marker:'RBC', normal:[4,5.5], borderline:[5.5,6], treatment:[6,6.5], emergencyHigh:6.5, direction:'high', unit:'10¹²/L', label:'Эритроциты' },
  WBC:              { marker:'WBC', normal:[4,10], borderline:[10,12], treatment:[12,20], emergencyHigh:20, emergencyLow:3, direction:'both', unit:'10⁹/L', label:'Лейкоциты' },
  // Проход 193: ретикулоциты — относительное число в процентах, как в РФ-бланке
  // (`RETIC_BAND`: ♂ 0.67–1.92, ♀ 0.59–2.07; Хеликс 02-027/КДЛ). Прежняя строка
  // 20–100/100–150/150–300 в 10⁹/л была тем же анализом в ДРУГОЙ величине:
  // бланк в процентах (1.5) читался как «ниже нормы 20» и получал «лечение».
  // Ступени — кратности от границ (`halfLow` 0.5·LLN, `doubleHigh` 2×ВГН), новых
  // клинических порогов нет. Верхней экстренной ступени нет: высокий ответ
  // эритропоэза — находка, а не повод «STOP COURSE».
  RETICULOCYTES:    { marker:'RETICULOCYTES', normal:[RETIC_BAND.low, RETIC_BAND.high], borderline:[RETIC_BAND.halfLow, RETIC_BAND.low, RETIC_BAND.high, RETIC_BAND.doubleHigh], treatment:[0, RETIC_BAND.halfLow, RETIC_BAND.doubleHigh, Number.MAX_SAFE_INTEGER], direction:'both', unit:'%', label:'Ретикулоциты' },

  // ─── COAGULATION ───
  INR:              { marker:'INR', normal:[0.8,1.2], borderline:[1.2,1.5], treatment:[1.5,3], emergencyHigh:3, emergencyLow:0.7, direction:'both', unit:'', label:'МНО' },
  // Проход 136: строка `TT` (протромбин, 0.9–2, unit 'INR') удалена. Она была
  // недостижима из формы (поле «Total T» переименовывается в TESTOSTERONE), дублировала
  // `INR` другими числами и делила имя `TT` с тестостероном, который в словарях
  // маркеров (`lab-priority-map`, `pharma-lab-marker-map`, `constants`) — то же `TT`.
  // Теперь `TT` — псевдоним тестостерона (`TIER_MARKER_ALIAS`), а протромбин живёт
  // одной строкой `INR`.

  // ─── HORMONAL ───
  E2:               { marker:'E2', normal:[E2_MALE_BAND.targetLow, E2_MALE_BAND.steps[0]], borderline:[E2_MALE_BAND.steps[0], E2_MALE_BAND.steps[1]], treatment:[E2_MALE_BAND.steps[1], E2_MALE_BAND.steps[2]], emergencyHigh:E2_MALE_BAND.steps[2], direction:'high', unit:'pg/mL', label:'Эстрадиол' },
  PRL:              { marker:'PRL', normal:[2,15], borderline:[15,25], treatment:[25,50], emergencyHigh:50, direction:'high', unit:'ng/mL', label:'Пролактин' },
  TSH:              { marker:'TSH', normal:[0.4,4], borderline:[4,6], treatment:[6,10], emergencyHigh:10, emergencyLow:0.1, direction:'high', unit:'mU/L', label:'ТТГ' },
  CORTISOL:         { marker:'CORTISOL', normal:[100,535], borderline:[535,700], treatment:[700,1000], emergencyHigh:1000, direction:'high', unit:'nmol/L', label:'Кортизол' },
  LH:               { marker:'LH', normal:[1.7,9], borderline:[1,1.7], treatment:[0.5,1], emergencyLow:0.5, direction:'low', unit:'mU/L', label:'ЛГ' },
  FSH:              { marker:'FSH', normal:[1.5,12], borderline:[1,1.5], treatment:[0.5,1], emergencyLow:0.5, direction:'low', unit:'mU/L', label:'ФСГ' },
  TESTOSTERONE:     { marker:'TESTOSTERONE', normal:[15,50], borderline:[10,15], treatment:[5,10], emergencyLow:5, direction:'low', unit:'nmol/L', label:'Тестостерон' },
  // Проход 191: свободный тестостерон — в единице РФ-бланка (пг/мл, иммуноанализ),
  // норма из каталога (`UCUM_MAP.FT` = референс ИНВИТРО/Хеликс 18–40 лет 12.3–46.6).
  // Возраста в плоском мире нет, поэтому полосы вложены в один и тот же референс:
  // ниже 12.3 — ниже референса 18–40, но внутри полосы 40–60 (9.57) и ≥ 60 (7.72) →
  // «грань» (повтор утром натощак, без тренировок 48 ч); ниже 7.72 — ниже ЛЮБОЙ
  // взрослой полосы → «лечение» (эндокринолог). Нижней экстренной границы нет: для
  // амбулаторного гормона источника на такое число нет, а выдуманное давало бы
  // «⛔ STOP COURSE» здоровому. `direction:'low'`: высокий свободный T на курсе —
  // не болезнь шкалы, ступени у него нет.
  FREE_TESTOSTERONE: { marker:'FREE_TESTOSTERONE', normal:[FT_MALE_BAND.low, FT_MALE_BAND.high], borderline:[FT_MALE_BAND.elderlyLow, FT_MALE_BAND.low], treatment:[0, FT_MALE_BAND.elderlyLow], direction:'low', unit:'pg/mL', label:'Своб. T' },
  // Проход 192: ДГТ — двусторонняя шкала в пг/мл от нормы РФ-бланка
  // (`DHT_BAND`: 143–842, Хеликс/КДЛ/CMD). Прежняя строка 1.0–3.0 нмоль/л с
  // `direction:'low'` жила в другой единице, поэтому число в пг/мл было больше 3
  // почти всегда: ДГТ не получал ни ступени, ни совета ни при каком значении.
  // Низкая сторона — 5α-редуктаза (финастерид/дутастерид) и гипогонадизм,
  // высокая — андрогенная нагрузка. Ступени — кратности от границ (`halfLow` =
  // 0.5·LLN, `doubleHigh` = 2×ВГН), новых клинических порогов нет. Верхней
  // экстренной ступени нет: ряд «лечения» тянется до арифметического предела, а
  // «STOP COURSE» по одному ДГТ не выдаётся (`docs/LAB-NORMS-SINGLE-SOURCE.md`,
  // проход 192).
  DHT: { marker:'DHT', normal:[DHT_BAND.low, DHT_BAND.high], borderline:[DHT_BAND.halfLow, DHT_BAND.low, DHT_BAND.high, DHT_BAND.doubleHigh], treatment:[0, DHT_BAND.halfLow, DHT_BAND.doubleHigh, Number.MAX_SAFE_INTEGER], direction:'both', unit:'pg/mL', label:'ДГТ' },
  DHEA_S:           { marker:'DHEA_S', normal:[200,500], borderline:[150,200], treatment:[100,150], emergencyLow:100, direction:'low', unit:'mcg/dL', label:'ДГЭА-С' },
  SHBG:             { marker:'SHBG', normal:[20,60], borderline:[60,80], treatment:[80,120], emergencyHigh:120, direction:'high', unit:'nmol/L', label:'ГСПГ' },
  // Проход 190: шкала — пороги ДЕЙСТВИЯ в нг/мл, а не «лабораторная норма».
  // Верх референса у РФ-лабораторий метод-зависим и расходится почти в 10 раз:
  // <0.47 нмоль/л (АКСИС, ECLIA), <1.9 (ИНВИТРО >18 лет), 0.159–0.474
  // (ИНВИТРО/ECLIA Snibe), ≤4.0 нмоль/л (набор ХЕМА, ИФА), 0.2–1.4 нг/мл
  // (Roche/ECLIA, Krasowski 2014) — пять источников в §4
  // `docs/LAB-NORMS-SINGLE-SOURCE.md`. В плоский мир число приходит в нг/мл
  // (`flatLabUnit`), в том числе из каталога `PROGESTERONE` (нмоль/л): поэтому
  // шкала и второе написание живут в одной единице.
  PROG:             { marker:'PROG', normal:[0.3,1.5], borderline:[1.5,3], treatment:[3,10], emergencyHigh:10, direction:'high', unit:'ng/mL', label:'Прогестерон' },
  IGF1:             { marker:'IGF1', normal:[100,400], borderline:[400,500], treatment:[500,700], emergencyHigh:700, direction:'high', unit:'ng/mL', label:'ИФР-1' },
  AMH:              { marker:'AMH', normal:[1.0,5.0], borderline:[0.5,1.0], treatment:[0.2,0.5], emergencyLow:0.2, direction:'low', unit:'ng/mL', label:'АМГ' },

  // ─── THYROID ───
  FT3:              { marker:'FT3', normal:[3.5,6.5], borderline:[6.5,8], treatment:[8,12], emergencyHigh:12, direction:'high', unit:'pmol/L', label:'T3 св' },
  FT4:              { marker:'FT4', normal:[9,22], borderline:[22,26], treatment:[26,35], emergencyHigh:35, direction:'high', unit:'pmol/L', label:'T4 св' },
  TPO_AB:           { marker:'TPO_AB', normal:[0,34], borderline:[34,100], treatment:[100,500], emergencyHigh:500, direction:'high', unit:'IU/mL', label:'АТ-ТПО' },

  // ─── METABOLIC ───
  GLUCOSE:          { marker:'GLUCOSE', normal:[3.9,5.6], borderline:[5.6,6.1], treatment:[6.1,11], emergencyHigh:11, emergencyLow:3.0, direction:'high', unit:'mmol/L', label:'Глюкоза' },
  HBA1C:            { marker:'HBA1C', normal:[0,5.7], borderline:[5.7,6.4], treatment:[6.4,8], emergencyHigh:8, direction:'high', unit:'%', label:'Гликированный Hb' },
  INS:              { marker:'INS', normal:[2,10], borderline:[10,15], treatment:[15,25], emergencyHigh:25, direction:'high', unit:'mcU/mL', label:'Инсулин' },
  HOMAIR:           { marker:'HOMAIR', normal:[0,2.5], borderline:[2.5,3.5], treatment:[3.5,5], emergencyHigh:5, direction:'high', unit:'', label:'HOMA-IR' },
  HOMOCYSTEINE:     { marker:'HOMOCYSTEINE', normal:[0,10], borderline:[10,15], treatment:[15,30], emergencyHigh:30, direction:'high', unit:'mcmol/L', label:'Гомоцистеин' },
  CRP:              { marker:'CRP', normal:[0,3], borderline:[3,10], treatment:[10,20], emergencyHigh:20, direction:'high', unit:'mg/L', label:'СРБ' },
  IL6:              { marker:'IL6', normal:[0,7], borderline:[7,20], treatment:[20,80], emergencyHigh:80, direction:'high', unit:'pg/mL', label:'ИЛ-6' },
  TNF_ALPHA:        { marker:'TNF_ALPHA', normal:[0,8], borderline:[8,15], treatment:[15,40], emergencyHigh:40, direction:'high', unit:'pg/mL', label:'ФНО-α' },
  FERRITIN:         { marker:'FERRITIN', normal:[30,400], borderline:[15,30,400,600], treatment:[5,15,600,1000], emergencyHigh:1000, emergencyLow:10, direction:'both', unit:'ng/mL', label:'Ферритин' },

  // ─── VITAMINS/MINERALS ───
  VITAMIN_D:        { marker:'VITAMIN_D', normal:[30,100], borderline:[20,30], treatment:[10,20], emergencyLow:10, direction:'low', unit:'ng/mL', label:'Витамин D' },
  B12:              { marker:'B12', normal:[200,900], borderline:[150,200], treatment:[100,150], emergencyLow:100, direction:'low', unit:'pg/mL', label:'B12' },
  FOL:              { marker:'FOL', normal:[7,50], borderline:[5,7], treatment:[3,5], emergencyLow:3, direction:'low', unit:'ng/mL', label:'Фолат' },
  IRON:             { marker:'IRON', normal:[13,32], borderline:[10,13], treatment:[5,10], emergencyLow:5, direction:'low', unit:'mcmol/L', label:'Железо' },
  MAGNESIUM:        { marker:'MAGNESIUM', normal:[0.85,1.1], borderline:[0.7,0.85], treatment:[0.5,0.7], emergencyLow:0.5, direction:'low', unit:'mmol/L', label:'Магний' },
  ZINC:             { marker:'ZINC', normal:[11,18], borderline:[9,11], treatment:[7,9], emergencyLow:7, direction:'low', unit:'mcmol/L', label:'Цинк' },
  SELENIUM:         { marker:'SELENIUM', normal:[80,190], borderline:[60,80], treatment:[40,60], emergencyLow:40, direction:'low', unit:'mcg/L', label:'Селен' },
  POTASSIUM:        { marker:'POTASSIUM', normal:[3.5,5.0], borderline:[3.0,3.5,5.0,5.5], treatment:[2.5,3,5.5,6.5], emergencyHigh:6.5, emergencyLow:2.5, direction:'both', unit:'mmol/L', label:'Калий' },
  SODIUM:           { marker:'SODIUM', normal:[135,145], borderline:[130,135,145,150], treatment:[125,130,150,155], emergencyHigh:155, emergencyLow:125, direction:'both', unit:'mmol/L', label:'Натрий' },
  CALCIUM:          { marker:'CALCIUM', normal:[2.2,2.6], borderline:[2.0,2.2,2.6,2.8], treatment:[1.8,2.0,2.8,3.0], emergencyHigh:3.0, emergencyLow:1.8, direction:'both', unit:'mmol/L', label:'Кальций' },
  PHOSPHORUS:       { marker:'PHOSPHORUS', normal:[0.8,1.5], borderline:[0.6,0.8,1.5,1.8], treatment:[0.4,0.6,1.8,2.5], emergencyHigh:2.5, emergencyLow:0.4, direction:'both', unit:'mmol/L', label:'Фосфор' },
  VITAMIN_B6:       { marker:'VITAMIN_B6', normal:[20,100], borderline:[10,20], treatment:[5,10], emergencyLow:5, direction:'low', unit:'nmol/L', label:'B6' },
};

/**
 * Один анализ — одна строка порогов (проход 175).
 *
 * Десять анализов жили в `LAB_TIERS` **двумя** полными строками с одинаковыми
 * числами: гемоглобин (`HEMOGLOBIN` и `HGB`), эстрадиол (`E2`/`ESTRADIOL`),
 * пролактин (`PRL`/`PROLACTIN`), тестостерон (`TESTOSTERONE`/`TOTAL_T`),
 * прогестерон (`PROG`/`PROGESTERONE`), свободные Т3/Т4 (`FT3`/`T3_FREE`,
 * `FT4`/`T4_FREE`), инсулин (`INS`/`INSULIN`), фолат (`FOL`/`FOLATE`) и
 * вчСРБ (`CRP`/`HSCRP`). Пока строк было две, правка одной оставляла вторую со
 * старым числом: гемоглобин судился по `HGB_THRESHOLDS` только если приходил
 * под своим именем, а подпись «hs-СРБ» могла жить со шкалой, которой больше нет.
 *
 * Теперь числа у второго имени нет вовсе — строка собирается из канонической.
 * Имя остаётся своим (`marker`), поэтому подписи и поиск ступеней не меняются.
 * Обе строки одинаковы и раньше — ответ движка тот же.
 */
const TIER_SAME_ANALYSIS: Record<string, { canon: string; label?: string; /** Своя строка правил: анализ идёт отдельной находкой (вчСРБ рядом с СРБ), хотя шкала общая. */ distinct?: boolean }> = {
  HGB: { canon: 'HEMOGLOBIN' },
  ESTRADIOL: { canon: 'E2' },
  PROLACTIN: { canon: 'PRL' },
  TOTAL_T: { canon: 'TESTOSTERONE' },
  // Проход 190: `PROGESTERONE` в каталоге — нмоль/л, а шкала `PROG` — нг/мл.
  // Строка общая только потому, что плоский мир пересчитывает число в единицу
  // шкалы (`flatLabUnit` → `readFlatLabs`/`labSliceToValues`); равенство держит
  // гард `data/__tests__/tier-alias-flat-unit.test.ts`.
  PROGESTERONE: { canon: 'PROG' },
  T3_FREE: { canon: 'FT3' },
  T4_FREE: { canon: 'FT4' },
  INSULIN: { canon: 'INS' },
  FOLATE: { canon: 'FOL' },
  // Своей шкалы у вчСРБ нет (клинического источника тоже), поэтому он судится
  // общей шкалой СРБ; подпись анализа при этом остаётся «hs-СРБ». Правило у него
  // своё, и рядом с обычным СРБ он остаётся отдельной находкой — поэтому `distinct`.
  HSCRP: { canon: 'CRP', label: 'hs-СРБ', distinct: true },
};
export { TIER_SAME_ANALYSIS };
for (const [alias, { canon, label }] of Object.entries(TIER_SAME_ANALYSIS)) {
  const row = LAB_TIERS[canon];
  if (!row) continue;
  LAB_TIERS[alias] = { ...row, marker: alias, ...(label ? { label } : {}) };
}

/**
 * ♀ Ступени, которые у женщины считаются от её ВГН. `deriveTier` брал мужской
 * ряд для всех: женщина с АЛТ 35 читала «норма» (её ВГН 31), с ГГТ 40 — «норма»
 * (ВГН 31), с HCT 49 — «норма» (её эритроцитоз начинается с 48), с гемоглобином
 * 160 — «норма» (её верх 150), с креатинином 100 — «норма» (её ВГН 97).
 * Числа — из резолвера норм, не литералы. Крайняя ступень = ступень действия
 * (`stopOral` для трансаминаз, `triple` для ГГТ, блок флеботомии + 6 п.п. для
 * HCT, блок + 15 г/л для HGB).
 */
const FEMALE_TIER_OVERRIDES: Record<string, Partial<LabTierThreshold>> = {
  ALT: {
    normal: [0, LFT_ULN.ALT.female],
    borderline: [LFT_ULN.ALT.female, LFT_STAGE_ULN.reduce.female],
    treatment: [LFT_STAGE_ULN.reduce.female, LFT_STAGE_ULN.stopOral.female],
    emergencyHigh: LFT_STAGE_ULN.stopOral.female,
  },
  AST: {
    normal: [0, LFT_ULN.AST.female],
    borderline: [LFT_ULN.AST.female, LFT_STAGE_ULN.reduce.female],
    treatment: [LFT_STAGE_ULN.reduce.female, LFT_STAGE_ULN.stopOral.female],
    emergencyHigh: LFT_STAGE_ULN.stopOral.female,
  },
  GGT: {
    normal: [0, GGT_ULN.female],
    borderline: [GGT_ULN.female, GGT_STAGE_ULN.double.female],
    treatment: [GGT_STAGE_ULN.double.female, GGT_STAGE_ULN.triple.female],
    emergencyHigh: GGT_STAGE_ULN.triple.female,
  },
  HCT: {
    normal: [36, HCT_THRESHOLDS.female.erythrocytosis],
    borderline: [HCT_THRESHOLDS.female.erythrocytosis, HCT_THRESHOLDS.female.block],
    treatment: [HCT_THRESHOLDS.female.block, HCT_THRESHOLDS.female.block + 6],
    emergencyHigh: HCT_THRESHOLDS.female.block + 6,
  },
  HGB: {
    normal: [120, HGB_THRESHOLDS.female.upper],
    borderline: [HGB_THRESHOLDS.female.upper, HGB_THRESHOLDS.female.block],
    treatment: [HGB_THRESHOLDS.female.block, HGB_THRESHOLDS.female.block + 15],
    emergencyHigh: HGB_THRESHOLDS.female.block + 15,
  },
  CREATININE: {
    normal: [44, CREATININE_ULN.female],
    borderline: [CREATININE_ULN.female, 130],
    treatment: [130, 200],
    emergencyHigh: 200,
  },
  // Мочевая кислота: у женщины ВГН 350 (женский протокол, `UA_STAGE_ULN.female`),
  // поэтому «внимание» начинается с неё, а не с общего 420; переход к «лечению» —
  // по тому же множителю ×1.14 (400), а экстренный 600 остаётся клиническим
  // порогом (подагра с приступом), а не половым. Низ — женский 150, мужской 210
  // (`UA_LLN`, проход 189), а не литерал 150 для обоих полов.
  URIC_ACID: {
    normal: [UA_LLN.female, UA_STAGE_ULN.female[0]],
    borderline: [UA_STAGE_ULN.female[0], UA_STAGE_ULN.female[1]],
    treatment: [UA_STAGE_ULN.female[1], 600],
    emergencyHigh: 600,
  },
  // Проход 193: у женщины своя норма ретикулоцитов 0.59–2.07 % (Хеликс 02-027/
  // КДЛ). Мужской ряд 0.67–1.92 делал её 2.0 % «высоким», хотя это её норма.
  // Ступени — те же кратности от её же границ; экстренной ступени нет, как и у
  // мужчины.
  RETICULOCYTES: {
    normal: [RETIC_BAND.femaleLow, RETIC_BAND.femaleHigh],
    borderline: [RETIC_BAND.femaleHalfLow, RETIC_BAND.femaleLow, RETIC_BAND.femaleHigh, RETIC_BAND.femaleDoubleHigh],
    treatment: [0, RETIC_BAND.femaleHalfLow, RETIC_BAND.femaleDoubleHigh, Number.MAX_SAFE_INTEGER],
  },
};

// Гемоглобин: женский ряд один и тот же под обоими именами (проход 175) — как и
// строка порогов; копии чисел здесь больше нет.
FEMALE_TIER_OVERRIDES.HEMOGLOBIN = FEMALE_TIER_OVERRIDES.HGB;

// ════════════════════════════════════════════════════════════════════════════
//  deriveTier — определение уровня по значению маркёра
// ════════════════════════════════════════════════════════════════════════════
/**
 * Гормоны, чья ступенчатая шкала и действия написаны мужчине (проход 83).
 *
 * `LAB_TIERS` для них — «норма на курсе» мужчины: E2 20–40 пг/мл, прогестерон
 * 0.3–1.5 нг/мл, ЛГ 1.7–9, тестостерон 15–50, пролактин 2–15 нг/мл. Ступени
 * ведут в `TIER_RULES` к действиям, которые женщине вредны: «титровать
 * анастрозол» на её лютеиновую E2 450, «кломифен» на подавленный ЛГ 0.5,
 * «каберголин» на нормальный пролактин 300 мМЕ/л. Поэтому у женщины эти
 * маркеры ступень не получают вовсе: её оценка живёт в фазовой строке
 * результата и женском паспорте, а тревожные бэнды печатаются своей
 * формулировкой в `computeTierAdjustments` (`femaleHormoneAlert`).
 *
 * Проход 175: в наборе — КАНОНИЧЕСКИЕ имена, а проверка идёт через
 * `TIER_SAME_ANALYSIS`. Раньше здесь перечислялись оба написания, и `TOTAL_T`
 * и `PROLACTIN` в список забыли: женщина с тестостероном 6 нмоль/л под именем
 * `TOTAL_T` получала мужскую лестницу с советом про hCG, а под именем
 * `TESTOSTERONE` — ничего.
 *
 * Проход 191: сюда же свободный тестостерон. У женщины его верх — 5.45 пг/мл
 * (ИНВИТРО/Хеликс), то есть мужская норма 12.3 начинается там, где у неё уже
 * вирилизация: без строки женщина с 3 пг/мл (её норма) получала бы мужскую
 * ступень «лечение». Низкий свободный T у женщины клинически не действуют
 * (Helix: «снижение не принимают во внимание»), поэтому её ступени нет вовсе.
 */
const MALE_ONLY_TIER = new Set(['E2', 'PROG', 'LH', 'FSH', 'TESTOSTERONE', 'PRL', 'DHT', 'FREE_TESTOSTERONE']);

/** Имя анализа в словаре лестниц с учётом второго написания (проход 175). */
function tierCanonicalKey(key: string): string {
  return TIER_SAME_ANALYSIS[key]?.canon ?? key;
}

/**
 * Одно имя на один анализ (проход 136).
 *
 * Один и тот же анализ приходит в лестницы под разными именами: форма
 * (`support-plan/mapper-ctx`) отдаёт `HEMATOCRIT`, `TOTAL_CHOLESTEROL`, `PROTEIN`
 * (моча), `ANTI_TPO`, `IL_6`, а `LAB_TIERS`/`TIER_RULES` знают `HCT`,
 * `CHOLESTEROL_TOTAL`, `PROTEIN_URINE`, `TPO_AB`, `IL6`. Из-за этого анализ молча
 * не получал ни ступени, ни совета: `deriveTier('HEMATOCRIT', 58)` возвращал 0, хотя
 * `deriveTier('HCT', 58)` — ступень лечения. Таблица — единственное место перевода:
 * через неё читают `deriveTier` (и `computeTierAdjustments` через него).
 *
 * `TT` здесь — тестостерон общий: так его называют все словари маркеров
 * (`lab-priority-map`, `pharma-lab-marker-map`, `constants`), а протромбин
 * остался одной строкой `INR`.
 */
export const TIER_MARKER_ALIAS: Record<string, string> = {
  TT: 'TESTOSTERONE',
  HEMATOCRIT: 'HCT',
  TOTAL_CHOLESTEROL: 'CHOLESTEROL_TOTAL',
  PROTEIN: 'PROTEIN_URINE',
  ANTI_TPO: 'TPO_AB',
  IL_6: 'IL6',
  PLATELETS: 'PLT',
  // Проход 139: канон моста (`labMarkerCanon`) даёт `APOB`, а шкала называется
  // `APO_B` — без этого ApoB 1.5 г/л молчал (ни ступени, ни совета), хотя правило
  // в `TIER_RULES` для него есть.
  APOB: 'APO_B',
  // Проход 185: «CKMB» — написание парсера/формы, строка называется `CK_MB`.
  // Единицы теперь одной величины (каталог и шкала в Ед/л), поэтому перевод
  // доказан; масса (нг/мл) в эту строку не попадает — она не читается вовсе.
  CKMB: 'CK_MB',
};

/**
 * Код склада → строка порогов (проход 180).
 *
 * `labSliceToValues` отдаёт коды склада/UCUM (`UA`, `GLU`, `TG`, `K`), а строки
 * `LAB_TIERS` названы клиническими именами (`URIC_ACID`, `GLUCOSE`,
 * `TRIGLYCERIDES`, `POTASSIUM`). Пока таблицы не было, `tierMarkerKey` знал
 * только подписи формы и повторы, поэтому анализ из бланка молча не получал ни
 * ступени, ни совета: мочевая кислота 500 мкмоль/л давала `deriveTier` = 0, и
 * `computeTierAdjustments` не печатал ни строки.
 *
 * Запись добавляется только при ДОКАЗАННОМ равенстве единиц: единица каталога
 * (`UCUM_MAP[code].prefUnit`) и единица строки обязаны быть одной величины
 * (`unitsIncommensurable`). Двойник, который этому не отвечает, сюда не внесён —
 * число его шкалы пришлось бы толковать в чужой единице, а клинического
 * источника на выбор единицы нет (`docs/LAB-NORMS-SINGLE-SOURCE.md`).
 * КФК-МВ (проход 185) переведён в Ед/л вместе со строкой, поэтому блокера
 * «активность против массы» больше нет: масса честно не читается.
 * Проход 191: `FT` тоже переведён — строка `FREE_TESTOSTERONE` переехала в пг/мл
 * вместе с каталогом (референс РФ-бланка 12.3–46.6, ИНВИТРО/Хеликс). До этого в
 * строке стояли 0.3–1.0 нмоль/л: это числа ДРУГОГО метода (диализ/расчёт), а не
 * другой перевод, поэтому свободный тестостерон из бланка молча не получал ни
 * ступени, ни совета.
 */
export const STORAGE_TIER_ALIAS: Record<string, string> = {
  UA: 'URIC_ACID',
  BIL: 'BILIRUBIN',
  GLU: 'GLUCOSE',
  TG: 'TRIGLYCERIDES',
  CHOL: 'CHOLESTEROL_TOTAL',
  K: 'POTASSIUM',
  NA: 'SODIUM',
  CA: 'CALCIUM',
  MG: 'MAGNESIUM',
  P: 'PHOSPHORUS',
  VITD: 'VITAMIN_D',
  HOMA: 'HOMAIR',
  // Проход 191: пг/мл в каталоге и в строке (см. выше) — перевод доказан.
  FT: 'FREE_TESTOSTERONE',
  // `TROPONIN` в каталоге — тропонин I (`UCUM_MAP` 0.04 нг/мл, как у строки).
  TROPONIN: 'TROPONIN_I',
};

// Ошибка на загрузке модуля, а не молчаливая ступень в чужой единице.
for (const [code, row] of Object.entries(STORAGE_TIER_ALIAS)) {
  const info = ucumInfo(code);
  if (!info) throw new Error(`STORAGE_TIER_ALIAS: в UCUM_MAP нет записи ${code}`);
  const tier = LAB_TIERS[row];
  if (!tier) throw new Error(`STORAGE_TIER_ALIAS: в LAB_TIERS нет строки ${row} (код ${code})`);
  if (unitsIncommensurable(info.prefUnit, tier.unit)) {
    throw new Error(
      `STORAGE_TIER_ALIAS: ${code} (${info.prefUnit}) и ${row} (${tier.unit}) — разные величины`,
    );
  }
  TIER_MARKER_ALIAS[code] = row;
}

/** Имя маркёра в словаре лестниц (`LAB_TIERS`/`TIER_RULES`). */
export function tierMarkerKey(marker: string): string {
  const up = marker.toUpperCase().replace('-', '');
  return TIER_MARKER_ALIAS[up] ?? up;
}

export function deriveTier(marker: string, value: number, sex?: 'male' | 'female'): Tier {
  const key = tierMarkerKey(marker);
  const base = LAB_TIERS[key] || LAB_TIERS[marker.toUpperCase()];
  if (!base) return 0;
  if (sex === 'female' && MALE_ONLY_TIER.has(tierCanonicalKey(key))) return 0;
  // ♀ — женский ряд той же шкалы (ВГН и ступени от неё); мужской ряд не меняем.
  const override = sex === 'female' ? FEMALE_TIER_OVERRIDES[key] : undefined;
  const t = override ? { ...base, ...override } : base;
  const b = t.borderline || [0,0];
  const tr = t.treatment || [0,0];

  if (t.direction === 'high') {
    if (t.emergencyHigh !== undefined && value >= t.emergencyHigh) return 3;
    if (t.emergencyLow !== undefined && value <= t.emergencyLow) return 3;
    if (value >= tr[1]) return 3;
    if (value >= tr[0]) return 2;
    if (value >= b[0]) return 1;
    return 0;
  }

  if (t.direction === 'low') {
    if (t.emergencyLow !== undefined && value <= t.emergencyLow) return 3;
    if (value <= tr[0]) return 3;
    if (value <= tr[1] && value > tr[0]) return 2;
    if (value <= b[1] && value > b[0]) return 1;
    return 0;
  }

  // both
  // TIER 3: экстрено
  if (t.emergencyHigh !== undefined && value >= t.emergencyHigh) return 3;
  if (t.emergencyLow !== undefined && value <= t.emergencyLow) return 3;
  // Низкая сторона (dual-range: borderline[0,1], treatment[0,1])
  if (value < t.normal[0]) {
    // بین normal[0] и borderline[0] — норма, ниже borderline[0] — грань
    if (tr.length >= 2 && value <= tr[0]) return 2;
    if (b.length >= 2 && value <= b[1] && value > b[0]) return 1;
    if (b.length >= 2 && value <= b[0]) return 2;
    return 1;
  }
  // Высокая сторона
  if (value > t.normal[1]) {
    // dual-range: borderline[2,3], treatment[2,3]
    if (b.length >= 4) {
      if (b[2] !== undefined && b[3] !== undefined && value >= b[2] && value < b[3]) return 1;
      if (b[3] !== undefined && value >= b[3]) {
        if (tr.length >= 4 && tr[2] !== undefined && tr[3] !== undefined && value >= tr[2] && value < tr[3]) return 2;
        if (tr.length >= 4 && tr[3] !== undefined && value >= tr[3]) return 3;
        return 2;
      }
    } else {
      // single high-side borderline/treatment
      if (value >= b[0] && value < b[1]) return 1;
      if (value >= b[1]) {
        if (value >= tr[0] && value < tr[1]) return 2;
        return 3;
      }
    }
  }
  // Норма
  return 0;
}

export function getTierLabel(tier: Tier): string {
  return ['Норма', 'Грань', 'Лечение', '⛔ Экстрено'][tier];
}

export function getTierColor(tier: Tier): string {
  return ['rgba(99,102,241,0.12)', 'rgba(245,158,11,0.15)', 'rgba(234,88,12,0.15)', 'rgba(239,68,68,0.18)'][tier];
}

export function getLabEntry(marker: string): LabTierThreshold | null {
  return LAB_TIERS[tierMarkerKey(marker)] || null;
}