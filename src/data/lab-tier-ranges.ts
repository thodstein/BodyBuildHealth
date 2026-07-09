// ════════════════════════════════════════════════════════════════════════════
//  LAB-TIER-RANGES — 4-уровневая система порогов для анализов
//
//  TIER 0 = норма (протокол без изменений)
//  TIER 1 = грань (профилактика «до»: +1-2 адаптива + нутри-AC)
//  TIER 2 = лечение (усиленный стэк, дозы↑, ↓dose AAS)
//  TIER 3 = ⛔ экстрено (STOP COURSE + к врачу)
//
//  deriveTier(marker, value) → 0|1|2|3
// ════════════════════════════════════════════════════════════════════════════

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
  NT_PROBNP:        { marker:'NT_PROBNP', normal:[0,125], borderline:[125,450], treatment:[450,1800], emergencyHigh:1800, direction:'high', unit:'pg/mL', label:'NT-proBNP' },
  D_DIMER:          { marker:'D_DIMER', normal:[0,0.5], borderline:[0.5,1], treatment:[1,2.5], emergencyHigh:2.5, direction:'high', unit:'мг/L', label:'D-димер' },
  FIBRINOGEN:       { marker:'FIBRINOGEN', normal:[2,4], borderline:[4,5.5], treatment:[5.5,8], emergencyHigh:8, direction:'high', unit:'г/L', label:'Фибриноген' },
  ESR:              { marker:'ESR', normal:[0,15], borderline:[15,30], treatment:[30,60], emergencyHigh:60, direction:'high', unit:'мм/ч', label:'СОЭ' },
  TROPONIN_I:       { marker:'TROPONIN_I', normal:[0,0.04], borderline:[0.04,0.1], treatment:[0.1,1], emergencyHigh:1, direction:'high', unit:'ng/mL', label:'Тропонин I' },
  CK_MB:            { marker:'CK_MB', normal:[0,5], borderline:[5,10], treatment:[10,25], emergencyHigh:25, direction:'high', unit:'U/L', label:'КФК-MB' },
  APO_B:            { marker:'APO_B', normal:[0,1.0], borderline:[1.0,1.2], treatment:[1.2,1.8], emergencyHigh:1.8, direction:'high', unit:'g/L', label:'ApoB' },
  LP_A:             { marker:'LP_A', normal:[0,30], borderline:[30,50], treatment:[50,100], emergencyHigh:100, direction:'high', unit:'mg/dL', label:'Lp(a)' },

  // ─── HEPATIC ───
  ALT:              { marker:'ALT', normal:[0,40], borderline:[40,80], treatment:[80,200], emergencyHigh:200, direction:'high', unit:'U/L', label:'АЛТ' },
  AST:              { marker:'AST', normal:[0,40], borderline:[40,100], treatment:[100,200], emergencyHigh:200, direction:'high', unit:'U/L', label:'АСТ' },
  GGT:              { marker:'GGT', normal:[0,55], borderline:[55,110], treatment:[110,200], emergencyHigh:200, direction:'high', unit:'U/L', label:'ГГТ' },
  BILIRUBIN:        { marker:'BILIRUBIN', normal:[0,21], borderline:[21,40], treatment:[40,100], emergencyHigh:100, direction:'high', unit:'mcmol/L', label:'Билирубин' },
  ALP:              { marker:'ALP', normal:[0,120], borderline:[120,200], treatment:[200,400], emergencyHigh:400, direction:'high', unit:'U/L', label:'ЩФ' },
  AMMONIA:          { marker:'AMMONIA', normal:[0,50], borderline:[50,80], treatment:[80,150], emergencyHigh:150, direction:'high', unit:'mcmol/L', label:'Аммиак' },
  BILE_ACIDS:       { marker:'BILE_ACIDS', normal:[0,10], borderline:[10,20], treatment:[20,50], emergencyHigh:50, direction:'high', unit:'mcmol/L', label:'Жёлчные кислоты' },

  // ─── RENAL ───
  CREATININE:       { marker:'CREATININE', normal:[40,105], borderline:[105,130], treatment:[130,200], emergencyHigh:200, direction:'high', unit:'mcmol/L', label:'Креатинин' },
  EGFR:             { marker:'EGFR', normal:[90,200], borderline:[60,90], treatment:[30,60], emergencyLow:30, direction:'low', unit:'mL/min', label:'eGFR' },
  CYSTATIN_C:       { marker:'CYSTATIN_C', normal:[0,1.0], borderline:[1.0,1.3], treatment:[1.3,2], emergencyHigh:2, direction:'high', unit:'mg/L', label:'Цистатин C' },
  UREA:             { marker:'UREA', normal:[2.5,8], borderline:[8,12], treatment:[12,20], emergencyHigh:20, direction:'high', unit:'mmol/L', label:'Мочевина' },
  URIC_ACID:        { marker:'URIC_ACID', normal:[200,420], borderline:[420,480], treatment:[480,600], emergencyHigh:600, direction:'high', unit:'mcmol/L', label:'Мочевая кислота' },
  PROTEIN_URINE:    { marker:'PROTEIN_URINE', normal:[0,0.15], borderline:[0.15,0.5], treatment:[0.5,1.0], emergencyHigh:1.0, direction:'high', unit:'g/L', label:'Протеинурия' },
  MICROALB:         { marker:'MICROALB', normal:[0,20], borderline:[20,30], treatment:[30,300], emergencyHigh:300, direction:'high', unit:'mg/L', label:'Микроальбумин' },
  NGAL:             { marker:'NGAL', normal:[0,100], borderline:[100,200], treatment:[200,500], emergencyHigh:500, direction:'high', unit:'ng/mL', label:'NGAL' },
  KIM1:             { marker:'KIM1', normal:[0,1.5], borderline:[1.5,3], treatment:[3,6], emergencyHigh:6, direction:'high', unit:'ng/mL', label:'KIM-1' },

  // ─── HEMATOLOGIC ───
  HCT:              { marker:'HCT', normal:[35,50], borderline:[50,54], treatment:[54,58], emergencyHigh:60, direction:'high', unit:'%', label:'Гематокрит' },
  HEMOGLOBIN:       { marker:'HEMOGLOBIN', normal:[120,175], borderline:[175,185], treatment:[185,200], emergencyHigh:200, direction:'high', unit:'g/L', label:'Гемоглобин' },
  HGB:              { marker:'HGB', normal:[120,175], borderline:[175,185], treatment:[185,200], emergencyHigh:200, direction:'high', unit:'g/L', label:'Гемоглобин' },
  PLT:              { marker:'PLT', normal:[150,350], borderline:[350,450], treatment:[450,600], emergencyHigh:600, emergencyLow:100, direction:'both', unit:'10⁹/L', label:'Тромбоциты' },
  RBC:              { marker:'RBC', normal:[4,5.5], borderline:[5.5,6], treatment:[6,6.5], emergencyHigh:6.5, direction:'high', unit:'10¹²/L', label:'Эритроциты' },
  WBC:              { marker:'WBC', normal:[4,10], borderline:[10,12], treatment:[12,20], emergencyHigh:20, emergencyLow:3, direction:'both', unit:'10⁹/L', label:'Лейкоциты' },
  RETICULOCYTES:    { marker:'RETICULOCYTES', normal:[20,100], borderline:[100,150], treatment:[150,300], emergencyHigh:300, direction:'high', unit:'10⁹/L', label:'Ретикулоциты' },

  // ─── COAGULATION ───
  INR:              { marker:'INR', normal:[0.8,1.2], borderline:[1.2,1.5], treatment:[1.5,3], emergencyHigh:3, emergencyLow:0.7, direction:'both', unit:'', label:'МНО' },
  TT:               { marker:'TT', normal:[0.9,1.1], borderline:[1.1,1.3], treatment:[1.3,2], emergencyHigh:2, direction:'high', unit:'INR', label:'Протромбин' },

  // ─── HORMONAL ───
  E2:               { marker:'E2', normal:[20,40], borderline:[40,60], treatment:[60,100], emergencyHigh:100, direction:'high', unit:'pg/mL', label:'Эстрадиол' },
  ESTRADIOL:        { marker:'ESTRADIOL', normal:[20,40], borderline:[40,60], treatment:[60,100], emergencyHigh:100, direction:'high', unit:'pg/mL', label:'Эстрадиол' },
  PRL:              { marker:'PRL', normal:[2,15], borderline:[15,25], treatment:[25,50], emergencyHigh:50, direction:'high', unit:'ng/mL', label:'Пролактин' },
  PROLACTIN:        { marker:'PROLACTIN', normal:[2,15], borderline:[15,25], treatment:[25,50], emergencyHigh:50, direction:'high', unit:'ng/mL', label:'Пролактин' },
  TSH:              { marker:'TSH', normal:[0.4,4], borderline:[4,6], treatment:[6,10], emergencyHigh:10, emergencyLow:0.1, direction:'high', unit:'mU/L', label:'ТТГ' },
  CORTISOL:         { marker:'CORTISOL', normal:[100,535], borderline:[535,700], treatment:[700,1000], emergencyHigh:1000, direction:'high', unit:'nmol/L', label:'Кортизол' },
  LH:               { marker:'LH', normal:[1.7,9], borderline:[1,1.7], treatment:[0.5,1], emergencyLow:0.5, direction:'low', unit:'mU/L', label:'ЛГ' },
  FSH:              { marker:'FSH', normal:[1.5,12], borderline:[1,1.5], treatment:[0.5,1], emergencyLow:0.5, direction:'low', unit:'mU/L', label:'ФСГ' },
  TESTOSTERONE:     { marker:'TESTOSTERONE', normal:[15,50], borderline:[10,15], treatment:[5,10], emergencyLow:5, direction:'low', unit:'nmol/L', label:'Тестостерон' },
  TOTAL_T:          { marker:'TOTAL_T', normal:[15,50], borderline:[10,15], treatment:[5,10], emergencyLow:5, direction:'low', unit:'nmol/L', label:'Общ. T' },
  FREE_TESTOSTERONE: { marker:'FREE_TESTOSTERONE', normal:[0.3,1.0], borderline:[0.15,0.3], treatment:[0.05,0.15], emergencyLow:0.05, direction:'low', unit:'nmol/L', label:'Своб. T' },
  DHT:              { marker:'DHT', normal:[1.0,3.0], borderline:[0.5,1.0], treatment:[0.2,0.5], emergencyLow:0.2, direction:'low', unit:'nmol/L', label:'ДГТ' },
  DHEA_S:           { marker:'DHEA_S', normal:[200,500], borderline:[150,200], treatment:[100,150], emergencyLow:100, direction:'low', unit:'mcg/dL', label:'ДГЭА-С' },
  SHBG:             { marker:'SHBG', normal:[20,60], borderline:[60,80], treatment:[80,120], emergencyHigh:120, direction:'high', unit:'nmol/L', label:'ГСПГ' },
  PROG:             { marker:'PROG', normal:[0.3,1.5], borderline:[1.5,3], treatment:[3,10], emergencyHigh:10, direction:'high', unit:'ng/mL', label:'Прогестерон' },
  PROGESTERONE:     { marker:'PROGESTERONE', normal:[0.3,1.5], borderline:[1.5,3], treatment:[3,10], emergencyHigh:10, direction:'high', unit:'ng/mL', label:'Прогестерон' },
  IGF1:             { marker:'IGF1', normal:[100,400], borderline:[400,500], treatment:[500,700], emergencyHigh:700, direction:'high', unit:'ng/mL', label:'ИФР-1' },
  AMH:              { marker:'AMH', normal:[1.0,5.0], borderline:[0.5,1.0], treatment:[0.2,0.5], emergencyLow:0.2, direction:'low', unit:'ng/mL', label:'АМГ' },

  // ─── THYROID ───
  FT3:              { marker:'FT3', normal:[3.5,6.5], borderline:[6.5,8], treatment:[8,12], emergencyHigh:12, direction:'high', unit:'pmol/L', label:'T3 св' },
  FT4:              { marker:'FT4', normal:[9,22], borderline:[22,26], treatment:[26,35], emergencyHigh:35, direction:'high', unit:'pmol/L', label:'T4 св' },
  T3_FREE:          { marker:'T3_FREE', normal:[3.5,6.5], borderline:[6.5,8], treatment:[8,12], emergencyHigh:12, direction:'high', unit:'pmol/L', label:'T3 св' },
  T4_FREE:          { marker:'T4_FREE', normal:[9,22], borderline:[22,26], treatment:[26,35], emergencyHigh:35, direction:'high', unit:'pmol/L', label:'T4 св' },
  TPO_AB:           { marker:'TPO_AB', normal:[0,34], borderline:[34,100], treatment:[100,500], emergencyHigh:500, direction:'high', unit:'IU/mL', label:'АТ-ТПО' },

  // ─── METABOLIC ───
  GLUCOSE:          { marker:'GLUCOSE', normal:[3.9,5.6], borderline:[5.6,6.1], treatment:[6.1,11], emergencyHigh:11, emergencyLow:3.0, direction:'high', unit:'mmol/L', label:'Глюкоза' },
  HBA1C:            { marker:'HBA1C', normal:[0,5.7], borderline:[5.7,6.4], treatment:[6.4,8], emergencyHigh:8, direction:'high', unit:'%', label:'Гликированный Hb' },
  INS:              { marker:'INS', normal:[2,10], borderline:[10,15], treatment:[15,25], emergencyHigh:25, direction:'high', unit:'mcU/mL', label:'Инсулин' },
  INSULIN:          { marker:'INSULIN', normal:[2,10], borderline:[10,15], treatment:[15,25], emergencyHigh:25, direction:'high', unit:'mcU/mL', label:'Инсулин' },
  HOMAIR:           { marker:'HOMAIR', normal:[0,2.5], borderline:[2.5,3.5], treatment:[3.5,5], emergencyHigh:5, direction:'high', unit:'', label:'HOMA-IR' },
  HOMOCYSTEINE:     { marker:'HOMOCYSTEINE', normal:[0,10], borderline:[10,15], treatment:[15,30], emergencyHigh:30, direction:'high', unit:'mcmol/L', label:'Гомоцистеин' },
  CRP:              { marker:'CRP', normal:[0,3], borderline:[3,10], treatment:[10,20], emergencyHigh:20, direction:'high', unit:'mg/L', label:'СРБ' },
  HSCRP:            { marker:'HSCRP', normal:[0,3], borderline:[3,10], treatment:[10,20], emergencyHigh:20, direction:'high', unit:'mg/L', label:'hs-СРБ' },
  IL6:              { marker:'IL6', normal:[0,7], borderline:[7,20], treatment:[20,80], emergencyHigh:80, direction:'high', unit:'pg/mL', label:'ИЛ-6' },
  TNF_ALPHA:        { marker:'TNF_ALPHA', normal:[0,8], borderline:[8,15], treatment:[15,40], emergencyHigh:40, direction:'high', unit:'pg/mL', label:'ФНО-α' },
  FERRITIN:         { marker:'FERRITIN', normal:[30,400], borderline:[15,30,400,600], treatment:[5,15,600,1000], emergencyHigh:1000, emergencyLow:10, direction:'both', unit:'ng/mL', label:'Ферритин' },

  // ─── VITAMINS/MINERALS ───
  VITAMIN_D:        { marker:'VITAMIN_D', normal:[30,100], borderline:[20,30], treatment:[10,20], emergencyLow:10, direction:'low', unit:'ng/mL', label:'Витамин D' },
  B12:              { marker:'B12', normal:[200,900], borderline:[150,200], treatment:[100,150], emergencyLow:100, direction:'low', unit:'pg/mL', label:'B12' },
  FOL:              { marker:'FOL', normal:[7,50], borderline:[5,7], treatment:[3,5], emergencyLow:3, direction:'low', unit:'ng/mL', label:'Фолат' },
  FOLATE:           { marker:'FOLATE', normal:[7,50], borderline:[5,7], treatment:[3,5], emergencyLow:3, direction:'low', unit:'ng/mL', label:'Фолат' },
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

// ════════════════════════════════════════════════════════════════════════════
//  deriveTier — определение уровня по значению маркёра
// ════════════════════════════════════════════════════════════════════════════
export function deriveTier(marker: string, value: number): Tier {
  const key = marker.toUpperCase().replace('-', '');
  const t = LAB_TIERS[key] || LAB_TIERS[marker.toUpperCase()];
  if (!t) return 0;
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
  return LAB_TIERS[marker.toUpperCase()] || null;
}