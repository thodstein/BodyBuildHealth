import { UserRole } from './types';

export const GENETIC_MULTIPLIERS: Record<string, Record<string, number>> = {
  COMT_Val158Met: { 'Met/Met': 2.0, 'Val/Met': 1.5, 'Val/Val': 1.0 },
  MTHFR_C677T:    { TT: 1.7, CT: 1.3, CC: 1.0 },
  AGTR1_A1166C:   { CC: 1.4, AC: 1.2, AA: 1.0 },
  CYP3A4_22:      { '*22/*22': 1.35, '*1/*22': 1.15, '*1/*1': 1.0 },
  NOS3_G894T:     { TT: 1.3, GT: 1.15, GG: 1.0 }
} as const;

export const DRUG_THRESHOLDS: Record<string, { dosePerWeek: number; androgenicity: number }> = {
  testosterone_enanthate:  { dosePerWeek: 300, androgenicity: 1.0 },
  testosterone_cypionate:  { dosePerWeek: 300, androgenicity: 1.0 },
  testosterone_propionate: { dosePerWeek: 200, androgenicity: 1.0 },
  trenbolone_acetate:      { dosePerWeek: 200, androgenicity: 1.5 },
  trenbolone_enanthate:    { dosePerWeek: 200, androgenicity: 1.5 },
  nandrolone_decanoate:    { dosePerWeek: 400, androgenicity: 0.8 },
  nandrolone_phenylprop:   { dosePerWeek: 350, androgenicity: 0.8 },
  boldenone_undecylenate:  { dosePerWeek: 400, androgenicity: 0.7 },
  methenolone_enanthate:   { dosePerWeek: 300, androgenicity: 0.6 },
  oxandrolone:             { dosePerWeek: 50,  androgenicity: 0.6 },
  methandienone:           { dosePerWeek: 200, androgenicity: 1.1 },
  stanozolol:              { dosePerWeek: 30,  androgenicity: 1.0 },
  chlorodehydromethyltestosterone: { dosePerWeek: 20, androgenicity: 0.9 },
  ostarine_mk2866:         { dosePerWeek: 175, androgenicity: 0.0 },
  ligandrol_lgd4033:       { dosePerWeek: 70,  androgenicity: 0.0 },
  rad140:                  { dosePerWeek: 70,  androgenicity: 0.0 },
  gh_peptide:              { dosePerWeek: 35,  androgenicity: 0.0 }
} as const;

export const SYRINGE_SPECS: Record<number, { maxVolume: number; divisionsPerMl: number }> = {
  0.3: { maxVolume: 0.3, divisionsPerMl: 30 },
  0.5: { maxVolume: 0.5, divisionsPerMl: 50 },
  1.0: { maxVolume: 1.0, divisionsPerMl: 100 },
  2.0: { maxVolume: 2.0, divisionsPerMl: 50 },
  5.0: { maxVolume: 5.0, divisionsPerMl: 20 }
} as const;

export const RISK_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive'] as const;
export const BASE_RISK = 0.12;

export const REQUIRED_LABS_PER_PHASE: Record<string, string[]> = {
  baseline:              ['ALT','AST','GGT','HCT','HGB','PLT','WBC','TT','FT3','FT4','TSH','E2','PRL','LH','FSH','SHBG','CRP','HbA1c','FERRITIN','VITD','LDL','HDL','TG','GLU','INS','CREATININE','UA'],
  on_cycle:              ['ALT','AST','GGT','HCT','HGB','PLT','WBC','TT','E2','PRL','LH','FSH','LDL','HDL','TG','GLU','INS','HOMA','CRP','CREATININE','UA','CORTISOL','IGF1'],
  bridge:                ['TT','FT3','FT4','TSH','E2','LH','FSH','HCT','ALT','CRP','SHBG','IGF1'],
  pct:                   ['TT','LH','FSH','E2','PRL','SHBG','IGF1','FT3','FT4','TSH','ALT','HCT','CRP'],
  post_pct:              ['TT','LH','FSH','HCT','ALT','E2','SHBG','IGF1','TSH','CRP','HbA1c','LDL','HDL'],
  course_bridge_course:  ['TT','E2','LH','HCT','ALT','AST','CRP','HOMA','GLU','INS','CREATININE','TG']
} as const;

export const REQUIRED_DIAGNOSTICS_PER_PHASE: Record<string, string[]> = {
  baseline:              ['echocg','usg_obp','dexa','ecg','bp_monitor'],
  on_cycle:              ['joint_usg','echocg','bp_monitor'],
  bridge:                ['joint_mri','echocg'],
  pct:                   ['usg_obp','usg_testes'],
  post_pct:              ['echocg','dexa','bp_monitor'],
  course_bridge_course:  ['joint_usg','echocg','usg_testes']
} as const;

export const DIAGNOSTIC_TEMPLATES: Record<string, { name: string; keyMetrics: string[]; refRanges: Record<string, [number, number]> }> = {
  usg_obp:       { name: 'РЈР—Р РћР‘Рџ', keyMetrics: ['liver_size_mm','gallbladder_wall_mm','pancreas_echogenicity','spleen_size_mm','kidney_length_mm'], refRanges: { liver_size_mm: [120, 140], gallbladder_wall_mm: [0, 3], spleen_size_mm: [110, 120] } },
  echocg:        { name: 'Р­С…РѕРљР“', keyMetrics: ['LVED_mm','LVES_mm','EF_percent','LV_mass_g','LA_diameter_mm','RV_sPAP_mmHg','IVS_mm','LVPW_mm'], refRanges: { EF_percent: [50, 70], LV_mass_g: [90, 140], LA_diameter_mm: [30, 40] } },
  joint_usg:     { name: 'РЈР—Р СЃСѓСЃС‚Р°РІРѕРІ/СЃРІСЏР·РѕРє', keyMetrics: ['joint_effusion_mm','tendon_thickness_mm','bursa_fluid_mm','synovium_hypertrophy','cartilage_surface_mm'], refRanges: { joint_effusion_mm: [0, 3], tendon_thickness_mm: [2, 6] } },
  joint_mri:     { name: 'РњР Рў СЃСѓСЃС‚Р°РІРѕРІ', keyMetrics: ['cartilage_thickness_mm','bone_edema_score','meniscus_integrity','ligament_signal','synovial_fluid_ml'], refRanges: { cartilage_thickness_mm: [2, 4], bone_edema_score: [0, 1] } },
  dexa:          { name: 'DEXA (РєРѕСЃС‚СЊ/СЃРѕСЃС‚Р°РІ)', keyMetrics: ['BMD_spine','BMD_femur','T_score','body_fat_pct','visceral_fat_level','lean_mass_kg'], refRanges: { T_score: [-1, 1], body_fat_pct: [8, 20] } },
  ecg:           { name: 'Р­РљР“ (12 РѕС‚РІРµРґРµРЅРёР№)', keyMetrics: ['HR_bpm','QTc_ms','PR_ms','QRS_ms','ST_segment_mv'], refRanges: { HR_bpm: [60, 90], QTc_ms: [350, 440], PR_ms: [120, 200] } },
  bp_monitor:    { name: 'РЎРњРђР” (24С‡)', keyMetrics: ['SBP_avg_mmHg','DBP_avg_mmHg','HR_avg_bpm','nocturnal_dip_pct'], refRanges: { SBP_avg_mmHg: [110, 130], DBP_avg_mmHg: [70, 85], nocturnal_dip_pct: [10, 20] } },
  usg_testes:    { name: 'РЈР—Р РјРѕС€РѕРЅРєРё', keyMetrics: ['testis_volume_ml','epididymis_mm','varicocele_grade','blood_flow_velocity_cm_s'], refRanges: { testis_volume_ml: [12, 25], varicocele_grade: [0, 1] } }
} as const;

export const PENALTY_THRESHOLDS = { warning: 25, critical: 50, block_advanced: 75, max: 100 } as const;

// MRR (Minimum Risk Range) factors - optimal biomarker ranges for minimal risk
export const MRR_FACTORS: Record<string, { optimalMin: number; optimalMax: number }> = {
   cardio:     { optimalMin: 0.8, optimalMax: 1.2 },   // Blood pressure, cholesterol ratio
   hepatic:    { optimalMin: 0.7, optimalMax: 1.3 },   // Liver enzymes, bilirubin
   renal:      { optimalMin: 0.8, optimalMax: 1.2 },   // Creatinine, BUN, eGFR
   neuro:      { optimalMin: 0.85, optimalMax: 1.15 }, // Neurotransmitters, inflammation
   endocrine:  { optimalMin: 0.75, optimalMax: 1.25 }, // Hormones (thyroid, testosterone, cortisol)
   hematologic:{ optimalMin: 0.8, optimalMax: 1.2 },   // Blood cells, coagulation
   reproductive:{ optimalMin: 0.7, optimalMax: 1.3 },  // Reproductive hormones
   overall:    { optimalMin: 0.8, optimalMax: 1.2 }    // Overall biomarker composite
} as const;

// HGI (Hemostasis/Immune Function) factors - weights for immune/inflammatory markers
export const HGI_FACTORS: Record<string, number> = {
   crp:        0.30,   // C-reactive protein
   il6:        0.25,   // Interleukin-6
   tnfAlpha:   0.20,   // Tumor necrosis factor-alpha
   fibrinogen: 0.15,   // Fibrinogen
   esr:        0.10    // Erythrocyte sedimentation rate
} as const;

// RIR (Risk Intervention Response) factors - how interventions reduce risk over time
export const RIR_FACTORS: Record<string, number> = {
   exercise:   0.25,   // Exercise effectiveness
   nutrition:  0.20,   // Nutrition effectiveness
   sleep:      0.15,   // Sleep effectiveness
   stressMgmt: 0.15,   // Stress management
   supplements:0.15,   // Supplement effectiveness
   medication: 0.10    // Medication adherence
} as const;

export const NUTRITION_MACRO_RANGES: Record<string, { protein: [number, number]; fats: [number, number]; carbs_mod: 'fill' | 'low' | 'mod' | 'high' }> = {
   bulk:       { protein: [1.8, 2.2], fats: [0.9, 1.1], carbs_mod: 'high' },
   cut:        { protein: [2.2, 2.6], fats: [0.7, 0.9], carbs_mod: 'low' },
   maintenance:{ protein: [1.6, 2.0], fats: [0.8, 1.0], carbs_mod: 'mod' },
   recomp:     { protein: [1.8, 2.2], fats: [0.8, 1.0], carbs_mod: 'mod' },
   rehab:      { protein: [2.0, 2.4], fats: [0.9, 1.1], carbs_mod: 'mod' },
   strength:   { protein: [2.0, 2.4], fats: [1.0, 1.2], carbs_mod: 'high' }
} as const;

export const FERTILITY_WEIGHTS = { volume: 0.15, concentration: 0.20, totalCount: 0.10, PR: 0.25, morphology: 0.20, pH: 0.10 } as const;
export const FERTILITY_PENALTIES = { viscosity: 0.95, mar_gt_50: 0.90, leukocytes_gt_1: 0.85, agglutination: 0.80 } as const;
export const FERTILITY_TARGET = 75;
export const FERTILITY_TAU_WEEKS = 12;

export const SUPPORT_BASE_COVERAGE: Record<string, Record<string, number>> = {
  telmisartan:    { cardio_2: 0.55, cardio_3: 0.45, renal_1: 0.50 },
  nebivolol:      { cardio_1: 0.40, cardio_7: 0.35 },
  nac:            { hepatic_3: 0.45, hepatic_2: 0.50, cardio_5: 0.30 },
  tudca:          { hepatic_1: 0.65, hepatic_5: 0.50 },
  omega3:         { cardio_1: 0.40, cardio_4: 0.35, neuro_4: 0.25 },
  magnesium:      { neuro_2: 0.45, neuro_3: 0.50, cardio_7: 0.30 },
  berberine:      { endocrine_4: 0.50, cardio_1: 0.20 },
  coq10:          { cardio_4: 0.40, neuro_5: 0.30 },
  vitamin_d3:     { endocrine_2: 0.35, immune_1: 0.30 },
  zinc:           { repro_2: 0.40, immune_1: 0.25 },
  hcg:            { repro_1: 0.60, repro_2: 0.40 }
} as const;

export const TRUST_WEIGHTS = { diaryFillRate: 20, nutritionAdherence: 30, labMatchRate: 30, trainerFeedback: 20 } as const;
export const TRUST_LEVELS = {
  conservative: { min: 0, max: 39, multiplier: 0.8 },
  standard:     { min: 40, max: 79, multiplier: 1.0 },
  aggressive:   { min: 80, max: 100, multiplier: 1.15 }
} as const;

export const PREDICTIVE_DEFAULTS = { alpha: 0.4, beta: 0.15, steps: 7, ci_z_score: 1.96, lab_saturation_weeks: 8 } as const;
export const PKPD_DEFAULTS = { ka: 0.024, k10: 0.055, k12: 0.020, k21: 0.015, Vd_liters: 35, bioavailability: 1.0, dt_hours: 0.25, kTol: 0.00005, maxTol: 0.8 } as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  user: ['view_own_labs', 'add_labs', 'view_risks', 'view_schedule', 'export_csv'],
  coach: ['view_own_labs', 'add_labs', 'view_risks', 'view_schedule', 'view_trends', 'add_notes'],
  doctor: ['view_own_labs', 'add_labs', 'view_risks', 'view_schedule', 'view_trends', 'add_notes', 'export_pdf', 'view_raw_data', 'override_ref'],
  admin: ['view_own_labs', 'add_labs', 'view_risks', 'view_schedule', 'view_trends', 'add_notes', 'export_pdf', 'view_raw_data', 'override_ref'],
  editor: ['view_own_labs', 'add_labs', 'view_risks', 'view_schedule', 'view_trends', 'add_notes'],
} as const;

export const PHASE_SCHEDULE_RULES: Record<string, { checkpoints: { type: string; week: number; markers: string[] }[] }> = {
  course: {
    checkpoints: [
      { type: 'baseline', week: 0, markers: REQUIRED_LABS_PER_PHASE.baseline },
      { type: 'mid_course', week: 4, markers: REQUIRED_LABS_PER_PHASE.on_cycle.slice(0, 8) },
      { type: 'end_course', week: 8, markers: REQUIRED_LABS_PER_PHASE.on_cycle },
      { type: 'end_course', week: 12, markers: REQUIRED_LABS_PER_PHASE.on_cycle }
    ]
  },
  'course-bridge-course': {
    checkpoints: [
      { type: 'baseline', week: 0, markers: REQUIRED_LABS_PER_PHASE.baseline },
      { type: 'end_course', week: 8, markers: REQUIRED_LABS_PER_PHASE.on_cycle },
      { type: 'bridge', week: 10, markers: REQUIRED_LABS_PER_PHASE.bridge },
      { type: 'baseline', week: 12, markers: REQUIRED_LABS_PER_PHASE.baseline }
    ]
  },
  'course-pct': {
    checkpoints: [
      { type: 'baseline', week: 0, markers: REQUIRED_LABS_PER_PHASE.baseline },
      { type: 'end_course', week: 8, markers: REQUIRED_LABS_PER_PHASE.on_cycle },
      { type: 'start_pct', week: 9, markers: REQUIRED_LABS_PER_PHASE.pct },
      { type: 'mid_pct', week: 11, markers: REQUIRED_LABS_PER_PHASE.pct.slice(0, 6) },
      { type: 'end_pct', week: 13, markers: REQUIRED_LABS_PER_PHASE.post_pct }
    ]
  },
  pct: {
    checkpoints: [
      { type: 'start_pct', week: 0, markers: REQUIRED_LABS_PER_PHASE.pct },
      { type: 'mid_pct', week: 2, markers: REQUIRED_LABS_PER_PHASE.pct.slice(0, 6) },
      { type: 'end_pct', week: 4, markers: REQUIRED_LABS_PER_PHASE.post_pct }
    ]
  }
} as const;

interface DynamicRefRange {
  baseULN: number;
  baseLLN: number;
  ageFactor: (age: number) => number;
  sexFactor: (sex: string) => number;
  phaseFactor: (phase: string) => number;
}

export const DYNAMIC_REFS: Record<string, DynamicRefRange> = {
  TT: { baseULN: 1000, baseLLN: 300, ageFactor: (a) => a > 40 ? 0.9 : 1.0, sexFactor: () => 1.0, phaseFactor: (p) => p.includes('pct') ? 0.6 : p.includes('course') ? 1.4 : 1.0 },
  HCT: { baseULN: 52, baseLLN: 36, ageFactor: () => 1.0, sexFactor: (s) => s === 'female' ? 0.85 : 1.0, phaseFactor: (p) => p.includes('course') ? 1.1 : 1.0 },
  E2: { baseULN: 40, baseLLN: 10, ageFactor: () => 1.0, sexFactor: () => 1.0, phaseFactor: (p) => p.includes('pct') ? 0.7 : 1.0 }
} as const;

// Re-export PHARMA_DB from pharma-database
export { PHARMA_DB } from './pharma-database';

// НОВЫЕ: Микронутриенты (расширено)
export const MICRONUTRIENT_TARGETS: Record<string, { amount: number; unit: string; upperLimit?: number }> = {
  Mg: { amount: 400, unit: 'mg', upperLimit: 700 }, Zn: { amount: 15, unit: 'mg', upperLimit: 40 },
  VitD: { amount: 3000, unit: 'IU', upperLimit: 10000 }, VitC: { amount: 1000, unit: 'mg', upperLimit: 2000 },
  VitB12: { amount: 2.4, unit: 'mcg', upperLimit: 50 }, Omega3_EPA_DHA: { amount: 2000, unit: 'mg', upperLimit: 5000 },
  Potassium: { amount: 3500, unit: 'mg', upperLimit: 4700 }, Sodium: { amount: 2300, unit: 'mg', upperLimit: 5000 },
  Iron: { amount: 8, unit: 'mg', upperLimit: 45 }, Calcium: { amount: 1000, unit: 'mg', upperLimit: 2500 },
  Iodine: { amount: 150, unit: 'mcg', upperLimit: 1100 }, Selenium: { amount: 55, unit: 'mcg', upperLimit: 400 },
  Copper: { amount: 0.9, unit: 'mg', upperLimit: 10 }, Chromium: { amount: 35, unit: 'mcg', upperLimit: 1000 }
} as const;

// НОВЫЕ: Лабораторные маркеры (расширено до 30+)
export const UCUM_MAP: Record<string, { prefUnit: string; coeff: number; uln: number; lln: number; name: string }> = {
  'ALT': { prefUnit: 'U/L', coeff: 1, uln: 40, lln: 7, name: 'АЛТ' },
  'AST': { prefUnit: 'U/L', coeff: 1, uln: 40, lln: 10, name: 'АСТ' },
  'HCT': { prefUnit: '%', coeff: 1, uln: 52, lln: 36, name: 'Гематокрит' },
  'TT':  { prefUnit: 'ng/dL', coeff: 1, uln: 1000, lln: 300, name: 'Тестостерон общий' },
  'E2':  { prefUnit: 'pg/mL', coeff: 1, uln: 40, lln: 10, name: 'Эстрадиол' },
  'PRL': { prefUnit: 'ng/mL', coeff: 1, uln: 15, lln: 2, name: 'Пролактин' },
  'LH':  { prefUnit: 'mIU/mL', coeff: 1, uln: 12, lln: 1, name: 'ЛГ' },
  'FSH': { prefUnit: 'mIU/mL', coeff: 1, uln: 15, lln: 1, name: 'ФСГ' },
  'TSH': { prefUnit: 'mIU/L', coeff: 1, uln: 4.0, lln: 0.4, name: 'ТТГ' },
  'FT3': { prefUnit: 'pmol/L', coeff: 1, uln: 6.0, lln: 3.1, name: 'Т3 свободный' },
  'FT4': { prefUnit: 'pmol/L', coeff: 1, uln: 19.0, lln: 10.0, name: 'Т4 свободный' },
  'IGF1':{ prefUnit: 'ng/mL', coeff: 1, uln: 250, lln: 100, name: 'ИФР-1' },
  'HbA1c':{ prefUnit: '%', coeff: 1, uln: 5.7, lln: 4.0, name: 'Гликированный Hb' },
  'GLU': { prefUnit: 'mmol/L', coeff: 1, uln: 5.6, lln: 3.9, name: 'Глюкоза' },
  'INS': { prefUnit: 'mIU/L', coeff: 1, uln: 17, lln: 3, name: 'Инсулин' },
  'HOMA':{ prefUnit: '', coeff: 1, uln: 2.7, lln: 1.0, name: 'HOMA-IR' },
  'LDL': { prefUnit: 'mmol/L', coeff: 1, uln: 3.0, lln: 1.0, name: 'ЛПНП' },
  'HDL': { prefUnit: 'mmol/L', coeff: 1, uln: 1.5, lln: 0.9, name: 'ЛПВП' },
  'TG':  { prefUnit: 'mmol/L', coeff: 1, uln: 1.7, lln: 0.4, name: 'Триглицериды' },
  'CRP': { prefUnit: 'mg/L', coeff: 1, uln: 5, lln: 0.1, name: 'СРБ' },
  'CREATININE': { prefUnit: '?mol/L', coeff: 88.42, uln: 110, lln: 60, name: 'Креатинин' },
  'UREA': { prefUnit: 'mmol/L', coeff: 1, uln: 7.1, lln: 2.5, name: 'Мочевина' },
  'UA': { prefUnit: '?mol/L', coeff: 1, uln: 420, lln: 200, name: 'Мочевая к-та' },
  'FERRITIN': { prefUnit: '?g/L', coeff: 1, uln: 300, lln: 30, name: 'Ферритин' },
  'VITD': { prefUnit: 'ng/mL', coeff: 1, uln: 100, lln: 30, name: 'Витамин D' },
  'HGB': { prefUnit: 'g/L', coeff: 10, uln: 170, lln: 130, name: 'Гемоглобин' },
  'PLT': { prefUnit: '10^9/L', coeff: 1, uln: 400, lln: 150, name: 'Тромбоциты' },
  'WBC': { prefUnit: '10^9/L', coeff: 1, uln: 9.0, lln: 4.0, name: 'Лейкоциты' },
  'SHBG':{ prefUnit: 'nmol/L', coeff: 1, uln: 60, lln: 15, name: 'ГСПГ' },
  'CORTISOL': { prefUnit: 'nmol/L', coeff: 1, uln: 550, lln: 100, name: 'Кортизол' }
} as const;
