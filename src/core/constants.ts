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
  test_enan:  { dosePerWeek: 300, androgenicity: 1.0 },
  test_cyp:  { dosePerWeek: 300, androgenicity: 1.0 },
  test_undec:  { dosePerWeek: 400, androgenicity: 1.0 },
  test_prop:  { dosePerWeek: 200, androgenicity: 1.0 },
  trenbolone_acetate:  { dosePerWeek: 200, androgenicity: 1.5 },
  trenbolone_enanthate:  { dosePerWeek: 200, androgenicity: 1.5 },
  tren_acet:  { dosePerWeek: 200, androgenicity: 1.5 },
  tren_enan:  { dosePerWeek: 200, androgenicity: 1.5 },
  tren_hex:  { dosePerWeek: 200, androgenicity: 1.5 },
  trena:  { dosePerWeek: 200, androgenicity: 1.5 },
  nandrolone_decanoate:  { dosePerWeek: 400, androgenicity: 0.8 },
  nandrolone_phenylprop:  { dosePerWeek: 350, androgenicity: 0.8 },
  npp:  { dosePerWeek: 350, androgenicity: 0.8 },
  deca:  { dosePerWeek: 400, androgenicity: 0.8 },
  boldenone_undecylenate:  { dosePerWeek: 400, androgenicity: 0.7 },
  bold_undec:  { dosePerWeek: 400, androgenicity: 0.7 },
  methenolone_enanthate:  { dosePerWeek: 300, androgenicity: 0.6 },
  prim_enan:  { dosePerWeek: 300, androgenicity: 0.6 },
  oxandrolone:  { dosePerWeek: 50, androgenicity: 0.6 },
  oxan:  { dosePerWeek: 50, androgenicity: 0.6 },
  stanozolol:  { dosePerWeek: 30, androgenicity: 1.0 },
  stan:  { dosePerWeek: 30, androgenicity: 1.0 },
  methandienone:  { dosePerWeek: 200, androgenicity: 1.1 },
  methand:  { dosePerWeek: 200, androgenicity: 1.1 },
  oxymetholone:  { dosePerWeek: 150, androgenicity: 1.2 },
  anadrol:  { dosePerWeek: 150, androgenicity: 1.2 },
  superdrol:  { dosePerWeek: 30, androgenicity: 1.3 },
  halotestin:  { dosePerWeek: 20, androgenicity: 1.8 },
  halo:  { dosePerWeek: 20, androgenicity: 1.8 },
  drostanolone_prop:  { dosePerWeek: 350, androgenicity: 0.8 },
  drostanolone_enan:  { dosePerWeek: 400, androgenicity: 0.8 },
  mesterolone:  { dosePerWeek: 100, androgenicity: 0.4 },
  chlorodehydromethyltestosterone: { dosePerWeek: 20, androgenicity: 0.9 },
  ostarine_mk2866:  { dosePerWeek: 175, androgenicity: 0.0 },
  ostarine:  { dosePerWeek: 175, androgenicity: 0.0 },
  ligandrol_lgd4033:  { dosePerWeek: 70, androgenicity: 0.0 },
  lgd:  { dosePerWeek: 70, androgenicity: 0.0 },
  lgd4033:  { dosePerWeek: 70, androgenicity: 0.0 },
  rad140:  { dosePerWeek: 70, androgenicity: 0.0 },
  s23:  { dosePerWeek: 30, androgenicity: 0.0 },
  cjc1295:  { dosePerWeek: 7, androgenicity: 0.0 },
  ghrp6:  { dosePerWeek: 14, androgenicity: 0.0 },
  ghrp2:  { dosePerWeek: 14, androgenicity: 0.0 },
  ipamorelin:  { dosePerWeek: 14, androgenicity: 0.0 },
  mk677:  { dosePerWeek: 7, androgenicity: 0.0 },
  igf1_lr3:  { dosePerWeek: 1, androgenicity: 0.0 },
  igf1_des:  { dosePerWeek: 1, androgenicity: 0.0 },
  mgf:  { dosePerWeek: 1, androgenicity: 0.0 },
  peg_mgf:  { dosePerWeek: 1, androgenicity: 0.0 },
  hgh_frag:  { dosePerWeek: 7, androgenicity: 0.0 },
  sermorelin:  { dosePerWeek: 7, androgenicity: 0.0 },
  bpc157:  { dosePerWeek: 7, androgenicity: 0.0 },
  tb500:  { dosePerWeek: 7, androgenicity: 0.0 },
  thymosin_a1:  { dosePerWeek: 7, androgenicity: 0.0 },
  semax:  { dosePerWeek: 7, androgenicity: 0.0 },
  selank:  { dosePerWeek: 7, androgenicity: 0.0 },
  epitalon:  { dosePerWeek: 7, androgenicity: 0.0 },
  gonadorelin:  { dosePerWeek: 7, androgenicity: 0.0 },
  gh_peptide:  { dosePerWeek: 35, androgenicity: 0.0 },
  dsip:  { dosePerWeek: 7, androgenicity: 0.0 },
  melanotan2:  { dosePerWeek: 7, androgenicity: 0.0 },
  aod9604:  { dosePerWeek: 7, androgenicity: 0.0 },
  mots_c:  { dosePerWeek: 7, androgenicity: 0.0 },
  ss31:  { dosePerWeek: 7, androgenicity: 0.0 },
  foxo4_dri:  { dosePerWeek: 7, androgenicity: 0.0 },
  ghk_cu:  { dosePerWeek: 7, androgenicity: 0.0 },
  ins_short:  { dosePerWeek: 50, androgenicity: 0.0 },
  ins_long:  { dosePerWeek: 50, androgenicity: 0.0 },
  ins_aspart:  { dosePerWeek: 50, androgenicity: 0.0 },
  ins_detemir:  { dosePerWeek: 50, androgenicity: 0.0 },
  clomi:  { dosePerWeek: 35, androgenicity: 0.0 },
  tamox:  { dosePerWeek: 35, androgenicity: 0.0 },
  anastro:  { dosePerWeek: 7, androgenicity: 0.0 },
  letrozole:  { dosePerWeek: 3.5, androgenicity: 0.0 },
  caberg:  { dosePerWeek: 3.5, androgenicity: 0.0 },
  bromocriptine:  { dosePerWeek: 7, androgenicity: 0.0 },
  hcg:  { dosePerWeek: 1000, androgenicity: 0.0 },
  telmi:  { dosePerWeek: 70, androgenicity: 0.0 },
  nebivolol:  { dosePerWeek: 35, androgenicity: 0.0 },
  nac:  { dosePerWeek: 1400, androgenicity: 0.0 },
  tudca:  { dosePerWeek: 1400, androgenicity: 0.0 },
  omega3:  { dosePerWeek: 14000, androgenicity: 0.0 },
  magnesium:  { dosePerWeek: 3500, androgenicity: 0.0 },
  berberine:  { dosePerWeek: 1400, androgenicity: 0.0 },
  aspirin:  { dosePerWeek: 700, androgenicity: 0.0 },
  milk_thistle:  { dosePerWeek: 1400, androgenicity: 0.0 },
  curcumin_sup:  { dosePerWeek: 2800, androgenicity: 0.0 },
  alpha_lipoic:  { dosePerWeek: 1400, androgenicity: 0.0 },
  coq10:  { dosePerWeek: 1400, androgenicity: 0.0 },
  phosphatidylcholine:  { dosePerWeek: 2800, androgenicity: 0.0 },
  ashwagandha:  { dosePerWeek: 3500, androgenicity: 0.0 },
  tongkat_ali:  { dosePerWeek: 3500, androgenicity: 0.0 },
  fadogia:  { dosePerWeek: 3500, androgenicity: 0.0 },
  shilajit:  { dosePerWeek: 3500, androgenicity: 0.0 },
  ginseng_sup:  { dosePerWeek: 3500, androgenicity: 0.0 },
  saw_palmetto:  { dosePerWeek: 5600, androgenicity: 0.0 },
  probiotics_sup:  { dosePerWeek: 1, androgenicity: 0.0 },
  taurine_sup:  { dosePerWeek: 3500, androgenicity: 0.0 },
  vitamin_d3:  { dosePerWeek: 7000, androgenicity: 0.0 },
  vitamin_k2:  { dosePerWeek: 700, androgenicity: 0.0 },
  zinc_sup:  { dosePerWeek: 350, androgenicity: 0.0 },
  boron:  { dosePerWeek: 70, androgenicity: 0.0 },
  selenium_sup:  { dosePerWeek: 350, androgenicity: 0.0 },
  vitamin_b6:  { dosePerWeek: 70, androgenicity: 0.0 },
  vitamin_b12:  { dosePerWeek: 7, androgenicity: 0.0 },
  folate:  { dosePerWeek: 7, androgenicity: 0.0 },
} as const;



export const SYRINGE_SPECS: Record<number, { maxVolume: number; divisionsPerMl: number }> = {
  0.3: { maxVolume: 0.3, divisionsPerMl: 30 },
  0.5: { maxVolume: 0.5, divisionsPerMl: 50 },
  1.0: { maxVolume: 1.0, divisionsPerMl: 100 },
  2.0: { maxVolume: 2.0, divisionsPerMl: 50 },
  5.0: { maxVolume: 5.0, divisionsPerMl: 20 }
} as const;

export const RISK_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal', 'metabolic', 'ghigf', 'ins_axis', 'neuro_toxicity', 'blood', 'vessels', 'immunity', 'thyroid', 'prostate', 'skin'] as const;

// Subsystem mapping: subsystems are computed INSIDE parent systems
export const SUBSYSTEM_MAP: Record<string, string[]> = {
  cardio: ['vessels'],
  endocrine: ['metabolic', 'ghigf', 'ins_axis', 'thyroid'],
  neuro: ['neuro_toxicity'],
  hematologic: ['blood'],
  hepatic: ['skin'],
  reproductive: ['prostate'],
  renal: ['immunity'],
};

// Reverse mapping: subsystem -> parent system
export const SUBSYSTEM_PARENT: Record<string, string> = {
  vessels: 'cardio',
  metabolic: 'endocrine',
  ghigf: 'endocrine',
  ins_axis: 'endocrine',
  neuro_toxicity: 'neuro',
  blood: 'hematologic',
  thyroid: 'endocrine',
  skin: 'hepatic',
  prostate: 'reproductive',
  immunity: 'renal',
};

// For backward compat and iteration - only the 8 core systems
export const ALL_RISK_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal', 'metabolic', 'ghigf', 'ins_axis', 'neuro_toxicity', 'blood', 'vessels', 'immunity', 'thyroid', 'prostate', 'skin'] as const;
export const BASE_RISK = 0.30;

export const REQUIRED_LABS_PER_PHASE: Record<string, string[]> = {
  baseline:              ['ALT','AST','GGT','ALP','BIL','DBIL','HCT','HGB','PLT','WBC','TT','FT3','FT4','TSH','E2','PRL','LH','FSH','SHBG','CRP','HbA1c','FERRITIN','VITD','LDL','HDL','TG','GLU','INS','HOMA','CREATININE','UA','B12','FOLATE','ALB','TP','K','NA','CA','P','MG','CORTISOL','DHT','PSA','INHB','AMH','EGFR','UACR'],
  on_cycle:              ['ALT','AST','GGT','ALP','HCT','HGB','PLT','WBC','TT','E2','PRL','LH','FSH','LDL','HDL','TG','GLU','INS','HOMA','CRP','CREATININE','UA','CORTISOL','IGF1','BIL','DBIL','K','NA','D_DIMER','FIBRINOGEN','TROPONIN','BNP','EGFR','UACR','HbA1c'],
  bridge:                ['TT','FT3','FT4','TSH','E2','LH','FSH','HCT','ALT','AST','CRP','SHBG','IGF1','GLU','INS','HOMA','CREATININE','LDL','HDL','TG','GGT','ALP','BIL','HGB','K','NA','HbA1c','EGFR','UACR','PRL'],
  pct:                   ['TT','LH','FSH','E2','PRL','SHBG','IGF1','FT3','FT4','TSH','ALT','AST','GGT','HCT','HGB','CRP','LDL','HDL','CORTISOL','TG','ALP','BIL','CREATININE','K','NA','GLU','HbA1c','EGFR','UACR'],
  post_pct:              ['TT','LH','FSH','HCT','ALT','AST','GGT','E2','SHBG','IGF1','TSH','FT3','FT4','CRP','HbA1c','LDL','HDL','TG','GLU','INS','CREATININE','FERRITIN','VITD','PSA','ALP','BIL','HGB','K','NA','PRL','EGFR','UACR'],
} as const;



export const REQUIRED_DIAGNOSTICS_PER_PHASE: Record<string, string[]> = {
  baseline:              ['echocg','usg_obp','dexa','ecg','bp_monitor'],
  on_cycle:              ['joint_usg','echocg','bp_monitor'],
  bridge:                ['joint_mri','echocg'],
  pct:                   ['usg_obp','usg_testes'],
  post_pct:              ['echocg','dexa','bp_monitor'],
} as const;

export const DIAGNOSTIC_TEMPLATES: Record<string, { name: string; keyMetrics: string[]; refRanges: Record<string, [number, number]> }> = {
  usg_obp:       { name: 'УЗИ ОБП', keyMetrics: ['liver_size_mm','gallbladder_wall_mm','pancreas_echogenicity','spleen_size_mm','kidney_length_mm'], refRanges: { liver_size_mm: [120, 140], gallbladder_wall_mm: [0, 3], spleen_size_mm: [110, 120] } },
  echocg:        { name: 'ЭхоКГ', keyMetrics: ['LVED_mm','LVES_mm','EF_percent','LV_mass_g','LA_diameter_mm','RV_sPAP_mmHg','IVS_mm','LVPW_mm'], refRanges: { EF_percent: [50, 70], LV_mass_g: [90, 140], LA_diameter_mm: [30, 40] } },
  joint_usg:     { name: 'УЗИ суставов/связок', keyMetrics: ['joint_effusion_mm','tendon_thickness_mm','bursa_fluid_mm','synovium_hypertrophy','cartilage_surface_mm'], refRanges: { joint_effusion_mm: [0, 3], tendon_thickness_mm: [2, 6] } },
  joint_mri:     { name: 'МРТ суставов', keyMetrics: ['cartilage_thickness_mm','bone_edema_score','meniscus_integrity','ligament_signal','synovial_fluid_ml'], refRanges: { cartilage_thickness_mm: [2, 4], bone_edema_score: [0, 1] } },
  dexa:          { name: 'DEXA (кость/состав)', keyMetrics: ['BMD_spine','BMD_femur','T_score','body_fat_pct','visceral_fat_level','lean_mass_kg'], refRanges: { T_score: [-1, 1], body_fat_pct: [8, 20] } },
  ecg:           { name: 'ЭКГ (12 отведений)', keyMetrics: ['HR_bpm','QTc_ms','PR_ms','QRS_ms','ST_segment_mv'], refRanges: { HR_bpm: [60, 90], QTc_ms: [350, 440], PR_ms: [120, 200] } },
  bp_monitor:    { name: 'СМАД (24ч)', keyMetrics: ['SBP_avg_mmHg','DBP_avg_mmHg','HR_avg_bpm','nocturnal_dip_pct'], refRanges: { SBP_avg_mmHg: [110, 130], DBP_avg_mmHg: [70, 85], nocturnal_dip_pct: [10, 20] } },
  usg_testes:    { name: 'УЗИ мошонки', keyMetrics: ['testis_volume_ml','epididymis_mm','varicocele_grade','blood_flow_velocity_cm_s'], refRanges: { testis_volume_ml: [12, 25], varicocele_grade: [0, 1] } }
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
   hypertrophy:{ protein: [2.0, 2.4], fats: [0.9, 1.1], carbs_mod: 'high' },
   strength:   { protein: [2.0, 2.4], fats: [1.0, 1.2], carbs_mod: 'high' }
 } as const;

export const FERTILITY_WEIGHTS = { volume: 0.15, concentration: 0.20, totalCount: 0.10, PR: 0.25, morphology: 0.20, pH: 0.10 } as const;
export const FERTILITY_PENALTIES = { viscosity: 0.95, mar_gt_50: 0.90, leukocytes_gt_1: 0.85, agglutination: 0.80 } as const;
export const FERTILITY_TARGET = 75;
export const FERTILITY_TAU_WEEKS = 12;

export const FERTILITY_WEIGHTS_V2 = { sperm: 0.55, hormonal: 0.30, structural: 0.15 } as const;

export const SPERM_WEIGHTS = {
  volume: 0.12, concentration: 0.18, totalCount: 0.08,
  pr: 0.22, morphology: 0.18, pH: 0.06,
  np: 0.05, viability: 0.06, fructose: 0.03, zinc: 0.02
} as const;

export const HORMONAL_WEIGHTS = {
  tt: 0.15, ft: 0.15, e2: 0.12, lh: 0.12, fsh: 0.12,
  shbg: 0.08, prl: 0.08, inhb: 0.12, amh: 0.06
} as const;

export const NAVY_BF_FORMULAS = {
  male:   { a: 86.010, b: 70.041, c: 36.76 },
  female: { a: 163.205, b: 97.684, c: -78.387 }
} as const;

export const INJURY_LOCATIONS = [
  'Плечо', 'Локоть', 'Запястье', 'Кисть', 'Грудной отдел',
  'Поясница', 'Тазобедренный', 'Колено', 'Голеностоп', 'Стопа',
  'Шея', 'Предплечье', 'Бицепс', 'Трицепс', 'Дельта',
  'Трапеция', 'Широчайшие', 'Пресс', 'Квадрицепс', 'Бицепс бедра'
] as const;

export const MUSCLE_GROUPS_FULL = [
  { id: 'chest', label: 'Грудь' },
  { id: 'upper_back', label: 'Верх спины' },
  { id: 'lats', label: 'Широчайшие' },
  { id: 'lower_back', label: 'Поясница' },
  { id: 'front_delts', label: 'Передняя дельта' },
  { id: 'rear_delts', label: 'Задняя дельта' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'quads', label: 'Квадрицепсы' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'calves', label: 'Икры' }
] as const;

export const SUPPORT_BASE_COVERAGE: Record<string, Record<string, number>> = {
  telmisartan:      { cardio_2: 0.55, cardio_3: 0.45, renal_1: 0.50 },
  nebivolol:        { cardio_1: 0.40, cardio_7: 0.35 },
  nac:              { hepatic_3: 0.45, hepatic_2: 0.50, cardio_5: 0.30, neuro_1: 0.25 },
  tudca:            { hepatic_1: 0.65, hepatic_5: 0.50 },
  omega3:           { cardio_1: 0.40, cardio_4: 0.35, neuro_4: 0.25, neuro_6: 0.20 },
  magnesium:        { neuro_2: 0.45, neuro_3: 0.50, neuro_6: 0.35, cardio_7: 0.30 },
  berberine:        { endocrine_4: 0.50, cardio_1: 0.20, hepatic_4: 0.20 },
  coq10:            { cardio_4: 0.40, neuro_5: 0.30, cardio_6: 0.25 },
  vitamin_d3:       { endocrine_2: 0.35, immune_1: 0.30, neuro_7: 0.15 },
  zinc:             { reproductive_2: 0.40, immunity_1: 0.25, hematologic_4: 0.20 },
  hcg:              { reproductive_1: 0.60, reproductive_2: 0.40 },
  alpha_lipoic:     { neuro_1: 0.45, neuro_3: 0.40, neuro_7: 0.30, cardio_5: 0.15 },
  ashwagandha:      { neuro_2: 0.35, neuro_5: 0.40, endocrine_5: 0.25, reproductive_5: 0.20 },
  saw_palmetto:     { reproductive_1: 0.35, reproductive_7: 0.30, reproductive_4: 0.25 },
  celery_extract:   { renal_3: 0.30, renal_2: 0.25, cardio_6: 0.20 },
  vitamin_k2:       { cardio_3: 0.30, endocrine_3: 0.20, hepatic_6: 0.25 },
  selenium:         { endocrine_6: 0.35, immune_1: 0.25, hematologic_4: 0.20, neuro_7: 0.15 },
  milk_thistle:     { hepatic_1: 0.55, hepatic_2: 0.45, hepatic_4: 0.30, hepatic_6: 0.20 },
  probiotics:       { hepatic_6: 0.30, immune_1: 0.25, hematologic_5: 0.20 },
  vitamin_b12:      { hematologic_1: 0.50, hematologic_2: 0.40, neuro_4: 0.20 },
  vitamin_b6:       { neuro_4: 0.25, neuro_6: 0.20, hematologic_3: 0.30, hepatic_6: 0.15 },
  folate:           { hematologic_1: 0.40, hematologic_3: 0.35, cardio_3: 0.20 },
  iron:             { hematologic_1: 0.55, hematologic_2: 0.45, cardio_6: 0.15 },
  copper:           { hematologic_3: 0.30, neuro_3: 0.20, immune_1: 0.20 },
  astragalus:       { renal_1: 0.30, renal_2: 0.25, immune_1: 0.20, cardio_6: 0.15 },
  taurine:          { cardio_7: 0.30, hepatic_3: 0.25, neuro_2: 0.20, renal_3: 0.20 },
  melatonin:        { neuro_2: 0.40, neuro_5: 0.35, endocrine_5: 0.15, cardio_7: 0.15 },
  ginseng:          { endocrine_5: 0.25, neuro_4: 0.20, cardio_6: 0.15, immune_1: 0.15 },
  egcg:             { cardio_5: 0.25, hepatic_4: 0.20, neuro_7: 0.15, immune_1: 0.20 },
  curcumin:         { hepatic_4: 0.30, cardio_5: 0.25, neuro_1: 0.15, immune_1: 0.20 },
  phosphatidylcholine: { hepatic_1: 0.35, hepatic_6: 0.30, neuro_4: 0.20, cardio_3: 0.15 },
  l_carnitine:      { cardio_4: 0.30, cardio_6: 0.25, hepatic_3: 0.15, neuro_5: 0.15 },
  glucosamine:     { musculoskeletal_1: 0.50, musculoskeletal_2: 0.40, musculoskeletal_3: 0.30 },
  chondroitin:     { musculoskeletal_2: 0.45, musculoskeletal_3: 0.35, musculoskeletal_4: 0.25 },
  msm:             { musculoskeletal_3: 0.40, musculoskeletal_5: 0.30, immune_1: 0.15 },
  collagen:        { musculoskeletal_1: 0.45, musculoskeletal_4: 0.40, musculoskeletal_5: 0.30, musculoskeletal_6: 0.25 },
  hyaluronic:      { musculoskeletal_4: 0.35, musculoskeletal_6: 0.30 },
  boswellia:       { musculoskeletal_3: 0.35, musculoskeletal_5: 0.30, immune_1: 0.20, neuro_1: 0.10 },
  vitamin_c:       { musculoskeletal_4: 0.35, immune_1: 0.30, cardio_5: 0.20, neuro_1: 0.15, hematologic_4: 0.15 },
  bromelain:       { musculoskeletal_5: 0.30, musculoskeletal_3: 0.25, immune_1: 0.15, cardio_5: 0.10 },
  bpc157:          { musculoskeletal_1: 0.70, musculoskeletal_2: 0.60, musculoskeletal_4: 0.55, musculoskeletal_5: 0.50, neuro_1: 0.25, gastro_1: 0.40 },
  tb500:           { musculoskeletal_4: 0.55, musculoskeletal_5: 0.50, musculoskeletal_6: 0.45, cardio_7: 0.15 },
  meloxicam:       { musculoskeletal_3: 0.50, musculoskeletal_5: 0.45, renal_1: -0.10, hepatic_3: -0.15, cardio_5: -0.10 },
  diclofenac:      { musculoskeletal_3: 0.55, musculoskeletal_5: 0.50, renal_1: -0.15, hepatic_3: -0.20, cardio_5: -0.15, hematologic_4: -0.10 },
} as const;

/** Maps prefixed substance IDs to SUPPORT_BASE_COVERAGE keys where fuzzy matching fails */
export const COVERAGE_ID_ALIAS: Record<string, string> = {
  VIT_Q10: 'coq10',
  VIT_Q10_UBIQUINOL: 'coq10',
  VIT_D3: 'vitamin_d3',
  VIT_D3_LIP: 'vitamin_d3',
  VIT_LIPOIC_R: 'alpha_lipoic',
  VIT_K2_MK7: 'vitamin_k2',
  VIT_K2_MK4: 'vitamin_k2',
  VIT_B6: 'vitamin_b6',
  VIT_B12_METHYL: 'vitamin_b12',
  VIT_B12_CYANO: 'vitamin_b12',
  VIT_B12_ADENO: 'vitamin_b12',
  VIT_B12_HYDROXO: 'vitamin_b12',
  VIT_C: 'vitamin_c',
  VIT_CARNITINE_LC: 'l_carnitine',
};

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
export const UCUM_MAP: Record<string, { prefUnit: string; coeff: number; uln: number; lln: number; name: string }> & Record<string, any> = {
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
  'CORTISOL': { prefUnit: 'nmol/L', coeff: 1, uln: 550, lln: 100, name: 'Кортизол' },
  'INHB': { prefUnit: 'pg/mL', coeff: 1, uln: 340, lln: 80, name: 'Ингибин Б' },
  'AMH':  { prefUnit: 'ng/mL', coeff: 1, uln: 15, lln: 1.0, name: 'АМГ' },
  'FT':   { prefUnit: 'pg/mL', coeff: 1, uln: 30, lln: 8.0, name: 'Тестостерон свободный' },
  'DHT':  { prefUnit: 'pg/mL', coeff: 1, uln: 870, lln: 130, name: 'Дигидротестостерон' },
  'PROG': { prefUnit: 'ng/mL', coeff: 1, uln: 1.2, lln: 0.1, name: 'Прогестерон' },
  'ALB':  { prefUnit: 'g/L', coeff: 1, uln: 50, lln: 35, name: 'Альбумин' },
  'TP':   { prefUnit: 'g/L', coeff: 1, uln: 80, lln: 60, name: 'Общий белок' },
  'BIL':  { prefUnit: 'umol/L', coeff: 1, uln: 17.1, lln: 3.4, name: 'Билирубин общий' },
  'DBIL': { prefUnit: 'umol/L', coeff: 1, uln: 5, lln: 0, name: 'Билирубин прямой' },
  'ALP':  { prefUnit: 'U/L', coeff: 1, uln: 130, lln: 40, name: 'Щёлочная фосфатаза' },
  'K':    { prefUnit: 'mmol/L', coeff: 1, uln: 5.1, lln: 3.5, name: 'Калий' },
  'NA':   { prefUnit: 'mmol/L', coeff: 1, uln: 145, lln: 135, name: 'Натрий' },
  'CA':   { prefUnit: 'mmol/L', coeff: 1, uln: 2.6, lln: 2.1, name: 'Кальций' },
  'P':    { prefUnit: 'mmol/L', coeff: 1, uln: 1.5, lln: 0.8, name: 'Фосфор' },
  'MG':   { prefUnit: 'mmol/L', coeff: 1, uln: 1.1, lln: 0.7, name: 'Магний' },
  'B12':  { prefUnit: 'pg/mL', coeff: 1, uln: 900, lln: 200, name: 'Витамин B12' },
  'FOL':  { prefUnit: 'ng/mL', coeff: 1, uln: 20, lln: 3, name: 'Фолат' },
  'TIBC': { prefUnit: 'umol/L', coeff: 1, uln: 70, lln: 45, name: 'ОЖСС' },
  'PSA':  { prefUnit: 'ng/mL', coeff: 1, uln: 4, lln: 0, name: 'ПСА' },
  'DHEA_S': { prefUnit: 'ug/dL', coeff: 1, uln: 560, lln: 80, name: 'ДГЭА-С' },
  'D_DIMER': { prefUnit: 'ug/mL', coeff: 1, uln: 0.5, lln: 0, name: 'D-димер' },
  'FIBRINOGEN': { prefUnit: 'g/L', coeff: 1, uln: 4.0, lln: 2.0, name: 'Фибриноген' },
  'TROPONIN': { prefUnit: 'ng/mL', coeff: 1, uln: 0.04, lln: 0, name: 'Тропонин' },
  'BNP': { prefUnit: 'pg/mL', coeff: 1, uln: 100, lln: 0, name: 'BNP' },
  'INR': { prefUnit: '', coeff: 1, uln: 1.2, lln: 0.8, name: 'МНО' },
  'APTT': { prefUnit: 'sec', coeff: 1, uln: 40, lln: 25, name: 'АЧТВ' },
  'HOMAIR': { prefUnit: '', coeff: 1, uln: 2.7, lln: 1.0, name: 'HOMA-IR' },
  'EGFR': { prefUnit: 'mL/min', coeff: 1, uln: 120, lln: 60, name: 'СКФ' },
  'UACR': { prefUnit: 'mg/g', coeff: 1, uln: 30, lln: 0, name: 'Альбумин/креатинин мочи' },
  'PROTEIN_URINE': { prefUnit: 'mg/L', coeff: 1, uln: 150, lln: 0, name: 'Протеинурия' },
  'MICROALB': { prefUnit: 'mg/L', coeff: 1, uln: 30, lln: 0, name: 'Микроальбумин' },
  'ECHO_LV_MASS': { prefUnit: 'g', coeff: 1, uln: 200, lln: 90, name: 'Масса ЛЖ' },
  'ECHO_EF': { prefUnit: '%', coeff: 1, uln: 70, lln: 50, name: 'ФУ ЛЖ' },
  'ECHO_LA': { prefUnit: 'mm', coeff: 1, uln: 40, lln: 30, name: 'ЛП' },
  'BP_SYSTOLIC': { prefUnit: 'mmHg', coeff: 1, uln: 130, lln: 90, name: 'АД сист.' },
  'BP_DIASTOLIC': { prefUnit: 'mmHg', coeff: 1, uln: 85, lln: 60, name: 'АД диаст.' },
  'HR': { prefUnit: 'bpm', coeff: 1, uln: 90, lln: 60, name: 'ЧСС' },
  'ENDOTHELIN1': { prefUnit: 'pg/mL', coeff: 1, uln: 3.0, lln: 0, name: 'Эндотелин-1' },
  'NO_MARKER': { prefUnit: '?mol/L', coeff: 1, uln: 50, lln: 10, name: 'Оксид азота' },
  // ── Extended markers: +50 для 80+ total ──
  'ANDROSTENEDIONE': { prefUnit: 'nmol/L', coeff: 1, uln: 6, lln: 1, name: 'Андростендион' },
  'ESTRADIOL_SENS': { prefUnit: 'pmol/L', coeff: 1, uln: 150, lln: 40, name: 'Эстрадиол чувств.' },
  'PROGESTERONE': { prefUnit: 'nmol/L', coeff: 1, uln: 1.5, lln: 0.3, name: 'Прогестерон' },
  'PREALBUMIN': { prefUnit: 'mg/L', coeff: 1, uln: 400, lln: 200, name: 'Преальбумин' },
  'CK': { prefUnit: 'U/L', coeff: 1, uln: 200, lln: 30, name: 'КФК' },
  'CK_MB': { prefUnit: 'ng/mL', coeff: 1, uln: 5, lln: 0, name: 'КФК-МВ' },
  'LDH': { prefUnit: 'U/L', coeff: 1, uln: 250, lln: 120, name: 'ЛДГ' },
  'AMYLASE': { prefUnit: 'U/L', coeff: 1, uln: 100, lln: 25, name: 'Амилаза' },
  'LIPASE': { prefUnit: 'U/L', coeff: 1, uln: 60, lln: 10, name: 'Липаза' },
  'TROPONIN_I': { prefUnit: 'ng/mL', coeff: 1, uln: 0.04, lln: 0, name: 'Тропонин I' },
  'NT_PROBNP': { prefUnit: 'pg/mL', coeff: 1, uln: 125, lln: 0, name: 'NT-proBNP' },
  'HOMOCYSTEINE': { prefUnit: '?mol/L', coeff: 1, uln: 15, lln: 5, name: 'Гомоцистеин' },
  'APO_A1': { prefUnit: 'g/L', coeff: 1, uln: 2.0, lln: 1.0, name: 'АпоA1' },
  'APO_B': { prefUnit: 'g/L', coeff: 1, uln: 1.2, lln: 0.5, name: 'АпоB' },
  'LP_A': { prefUnit: 'mg/dL', coeff: 1, uln: 30, lln: 0, name: 'Липопротеин(a)' },
  'TRANSFERRIN': { prefUnit: 'g/L', coeff: 1, uln: 3.8, lln: 2.0, name: 'Трансферрин' },
  'IRON': { prefUnit: '?mol/L', coeff: 1, uln: 30, lln: 10, name: 'Железо' },
  'RETICULOCYTES': { prefUnit: '%', coeff: 1, uln: 2.5, lln: 0.5, name: 'Ретикулоциты' },
  'ERYTHROPOIETIN': { prefUnit: 'mIU/mL', coeff: 1, uln: 25, lln: 5, name: 'Эритропоэтин' },
  'HAPTOGLOBIN': { prefUnit: 'g/L', coeff: 1, uln: 3.0, lln: 0.5, name: 'Гаптоглобин' },
  'URIC_ACID': { prefUnit: '?mol/L', coeff: 1, uln: 420, lln: 150, name: 'Мочевая кислота' },
  'CYSTATIN_C': { prefUnit: 'mg/L', coeff: 1, uln: 1.0, lln: 0.5, name: 'Цистатин C' },
  'NGAL': { prefUnit: 'ng/mL', coeff: 1, uln: 150, lln: 0, name: 'NGAL' },
  'KIM1': { prefUnit: 'ng/mL', coeff: 1, uln: 2.0, lln: 0, name: 'KIM-1' },
  'PARATHYROID': { prefUnit: 'pg/mL', coeff: 1, uln: 65, lln: 15, name: 'Паратгормон' },
  'CALCITONIN': { prefUnit: 'pg/mL', coeff: 1, uln: 10, lln: 0, name: 'Кальцитонин' },
  'OSTEOCALCIN': { prefUnit: 'ng/mL', coeff: 1, uln: 30, lln: 5, name: 'Остеокальцин' },
  'ESR': { prefUnit: 'mm/hr', coeff: 1, uln: 20, lln: 0, name: 'СОЭ' },
  'TNF_ALPHA': { prefUnit: 'pg/mL', coeff: 1, uln: 8, lln: 0, name: 'ФНО-α' },
  'IL6': { prefUnit: 'pg/mL', coeff: 1, uln: 7, lln: 0, name: 'ИЛ-6' },
  'IL1B': { prefUnit: 'pg/mL', coeff: 1, uln: 5, lln: 0, name: 'ИЛ-1β' },
  'LACTATE': { prefUnit: 'mmol/L', coeff: 1, uln: 2.2, lln: 0.5, name: 'Лактат' },
  'AMMONIA': { prefUnit: '?mol/L', coeff: 1, uln: 50, lln: 15, name: 'Аммиак' },
  'IGFBP3': { prefUnit: 'mg/L', coeff: 1, uln: 5, lln: 2, name: 'ИФР-СБ3' },
  'GH': { prefUnit: 'ng/mL', coeff: 1, uln: 5, lln: 0.5, name: 'Гормон роста' },
  'INHIBIN_B': { prefUnit: 'pg/mL', coeff: 1, uln: 300, lln: 80, name: 'Ингибин B' },
  'SODIUM': { prefUnit: 'mmol/L', coeff: 1, uln: 145, lln: 135, name: 'Натрий' },
  'POTASSIUM': { prefUnit: 'mmol/L', coeff: 1, uln: 5.1, lln: 3.5, name: 'Калий' },
  'CHLORIDE': { prefUnit: 'mmol/L', coeff: 1, uln: 108, lln: 98, name: 'Хлор' },
  'CALCIUM': { prefUnit: 'mmol/L', coeff: 1, uln: 2.6, lln: 2.1, name: 'Кальций' },
  'PHOSPHORUS': { prefUnit: 'mmol/L', coeff: 1, uln: 1.45, lln: 0.8, name: 'Фосфор' },
  'MAGNESIUM': { prefUnit: 'mmol/L', coeff: 1, uln: 1.0, lln: 0.7, name: 'Магний' },
  'COPPER': { prefUnit: '?mol/L', coeff: 1, uln: 30, lln: 10, name: 'Медь' },
  'ZINC': { prefUnit: '?mol/L', coeff: 1, uln: 20, lln: 11, name: 'Цинк' },
  'SELENIUM': { prefUnit: '?g/L', coeff: 1, uln: 150, lln: 70, name: 'Селен' },
  'VITAMIN_E': { prefUnit: '?mol/L', coeff: 1, uln: 35, lln: 12, name: 'Витамин E' },
  'VITAMIN_A': { prefUnit: '?mol/L', coeff: 1, uln: 2.8, lln: 1.0, name: 'Витамин A' },
  'C_PEPTIDE': { prefUnit: 'pmol/L', coeff: 1, uln: 1200, lln: 250, name: 'C-пептид' },
  'PROINSULIN': { prefUnit: 'pmol/L', coeff: 1, uln: 10, lln: 3, name: 'Проинсулин' },
  'FRUCTOSAMINE': { prefUnit: '?mol/L', coeff: 1, uln: 285, lln: 205, name: 'Фруктозамин' },
  'CHOLINESTERASE': { prefUnit: 'U/L', coeff: 1, uln: 12000, lln: 5000, name: 'Холинэстераза' },
  'BILE_ACIDS': { prefUnit: '?mol/L', coeff: 1, uln: 10, lln: 0, name: 'Желчные кислоты' },
  'DIRECT_BIL': { prefUnit: '?mol/L', coeff: 1, uln: 5, lln: 0, name: 'Билирубин прямой' },
  'TOTAL_PROTEIN': { prefUnit: 'g/L', coeff: 1, uln: 85, lln: 65, name: 'Общий белок' },
  'GLOBULIN': { prefUnit: 'g/L', coeff: 1, uln: 35, lln: 20, name: 'Глобулин' },
  'A_G_RATIO': { prefUnit: '', coeff: 1, uln: 2.0, lln: 1.1, name: 'А/Г коэффициент' },
  'OSMOLALITY': { prefUnit: 'mOsm/kg', coeff: 1, uln: 295, lln: 275, name: 'Осмоляльность' },
  'ANION_GAP': { prefUnit: 'mmol/L', coeff: 1, uln: 16, lln: 8, name: 'Анионный провал' },
} as const;

// ── Нормализация лабораторных значений к единицам РФ (Гемотест, Инвитро, Хеликс, КДЛ) ──
// Российские лаборатории используют специфичные единицы для ряда гормонов.
// Функция определяет единицу по величине значения и приводит к стандарту, используемому в UCUM_MAP.
//
// Целевые единицы (после нормализации):
//   E2 (Эстрадиол) → pg/mL (РФ-лаборатории: pmol/L, 1 pg/mL = 3.67 pmol/L)
//   Prolactin → ng/mL (РФ-лаборатории: mIU/L, 1 ng/mL = 21.2 mIU/L)
//   Total T → nmol/L (РФ-лаборатории: nmol/L или ng/dL, 1 nmol/L = 28.8 ng/dL)
//   Free T → pg/mL (РФ-лаборатории: pg/mL)
//   Cortisol → nmol/L (РФ-лаборатории: nmol/L)
//   DHEA-S → μg/dL (РФ-лаборатории: μg/dL или μmol/L, 1 μg/dL = 0.0271 μmol/L)
//
// Эвристика: если значение > порога — считаем что оно в «нецелевой» единице и конвертируем.
export function normalizeLabValue(marker: string, rawValue: number): number {
  if (isNaN(rawValue)) return rawValue;
  switch (marker) {
    case 'E2':
    case 'Эстрадиол':
      // РФ: pmol/L (мужчины: 40-150). Цель: pg/mL (мужчины: 10-40).
      // Если > 50 — точно pmol/L (pg/mL > 50 для мужчин = крайне редко)
      // 1 pg/mL = 3.67 pmol/L → pmol/L ÷ 3.67 = pg/mL
      if (rawValue > 50) return Math.round(rawValue / 3.67 * 10) / 10;
      return rawValue;

    case 'Prolactin':
    case 'Пролактин':
    case 'PRL':
      // РФ: mIU/L (мужчины: 50-350). Цель: ng/mL (мужчины: 3-15).
      // Если > 100 — точно mIU/L (ng/mL > 100 = нереально)
      if (rawValue > 100) return Math.round(rawValue / 21.2 * 10) / 10;
      return rawValue;

    case 'Total T':
    case 'TT':
    case 'Тестостерон общий':
      // РФ: nmol/L (мужчины: 12-33). Может быть ng/dL (300-1000).
      // Если > 100 — точно ng/dL. Конвертируем в nmol/L.
      if (rawValue > 100) return Math.round(rawValue * 0.0347 * 10) / 10;
      return rawValue;

    case 'Cortisol':
    case 'Кортизол':
      // РФ: nmol/L (мужчины: 100-550). Может быть μg/dL (5-25).
      // Если < 50 — точно μg/dL. Конвертируем в nmol/L (×27.59).
      if (rawValue < 50) return Math.round(rawValue * 27.59 * 10) / 10;
      return rawValue;

    case 'DHEA-S':
    case 'ДГЭА-С':
      // РФ: μg/dL (мужчины: 80-560). Может быть μmol/L (2-15).
      // Если < 20 — точно μmol/L. Конвертируем в μg/dL (×36.9).
      if (rawValue < 20) return Math.round(rawValue * 36.9 * 10) / 10;
      return rawValue;

    case 'SHBG':
    case 'ГСПГ':
      // РФ: nmol/L (мужчины: 15-60). Стандартная единица — nmol/L.
      return rawValue;

    default:
      return rawValue;
  }
}
