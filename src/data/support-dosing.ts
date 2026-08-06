// ════════════════════════════════════════════════════════════════════════════
//  SUPPORT DOSING REGISTRY — Единый источник доз для протоколов, каталога, движка риска
//  ════════════════════════════════════════════════════════════════════════════
//  Использование:
//    import { getProtocolDose, SUPPORT_DOSING } from '../data/support-dosing';
//    const dose = getProtocolDose('telmisartan', 'Cardio_Phase2');
//  ════════════════════════════════════════════════════════════════════════════

export interface DosingRecord {
  id: string;
  name: string;
  nameRu: string;
  category: 'supplement' | 'pharma' | 'peptide' | 'vitamin' | 'mineral' | 'amino' | 'herb';
  doseRange: { min: number; max: number; unit: string; frequency: string };
  phaseDosing?: Record<string, { min: number; max: number; unit: string; frequency: string }>;
  indications: string[];
  mechanisms: string[];
  warnings: string[];
  evidenceLevel: 'A' | 'B' | 'C';
  lastUpdated: string;
  protocolRefs: string[];
  riskThresholdKey?: string;
}

export const SUPPORT_DOSING: Record<string, DosingRecord> = {

  // ═══════════════════════════════════════════════════════════════
  // CARDIO / HYPERTENSION
  // ═══════════════════════════════════════════════════════════════
  telmisartan: {
    id: 'telmisartan', name: 'Telmisartan', nameRu: 'Телмисартан',
    category: 'pharma',
    doseRange: { min: 20, max: 80, unit: 'mg', frequency: 'daily' },
    indications: ['hypertension', 'cardioprotection', 'insulin_sensitivity', 'renoprotection'],
    mechanisms: ['ARB_AGONISM', 'PPAR_GAMMA_ACTIVATION'],
    warnings: ['hyperkalemia', 'renal_function_monitor'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase2', 'Renal_Phase2', 'Metabolic_Phase1'],
    riskThresholdKey: 'telmi',
  },
  nebivolol: {
    id: 'nebivolol', name: 'Nebivolol', nameRu: 'Небиволол',
    category: 'pharma',
    doseRange: { min: 2.5, max: 20, unit: 'mg', frequency: 'daily' },
    indications: ['hypertension', 'tachycardia', 'cardioprotection', 'no_enhancement'],
    mechanisms: ['BETA1_BLOCKADE', 'NO_RELEASE', 'ANTIOXIDANT'],
    warnings: ['bradycardia', 'hypotension', 'monitor_hr'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase2', 'Renal_Phase3', 'Neuro_Phase2'],
    riskThresholdKey: 'nebivolol',
  },
  amlodipine: {
    id: 'amlodipine', name: 'Amlodipine', nameRu: 'Амлодипин',
    category: 'pharma',
    doseRange: { min: 2.5, max: 10, unit: 'mg', frequency: 'daily' },
    indications: ['hypertension', 'angina'],
    mechanisms: ['CALCIUM_CHANNEL_BLOCKER', 'VASODILATION'],
    warnings: ['peripheral_edema', 'gingival_hyperplasia'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase3'],
  },

  // ═══════════════════════════════════════════════════════════════
  // LIPID MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  atorvastatin: {
    id: 'atorvastatin', name: 'Atorvastatin', nameRu: 'Аторвастатин',
    category: 'pharma',
    doseRange: { min: 10, max: 80, unit: 'mg', frequency: 'any' },
    indications: ['dyslipidemia', 'ldl_reduction', 'cardiovascular_prevention'],
    mechanisms: ['HMG_COA_REDUCTASE_INHIBITION', 'LDL_RECEPTOR_UPREGULATION'],
    warnings: ['hepatotoxicity', 'myopathy', 'ck_elevation', 'long_half_life_14h_timing_irrelevant'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase3'],
  },
  rosuvastatin: {
    id: 'rosuvastatin', name: 'Rosuvastatin', nameRu: 'Розувастатин',
    category: 'pharma',
    doseRange: { min: 5, max: 40, unit: 'mg', frequency: 'any' },
    indications: ['dyslipidemia', 'ldl_reduction'],
    mechanisms: ['HMG_COA_REDUCTASE_INHIBITION', 'LDL_RECEPTOR_UPREGULATION'],
    warnings: ['myopathy', 'hepatotoxicity', 'long_half_life_19h_timing_irrelevant'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase3'],
  },
  ezetimibe: {
    id: 'ezetimibe', name: 'Ezetimibe', nameRu: 'Эзетимиб',
    category: 'pharma',
    doseRange: { min: 10, max: 10, unit: 'mg', frequency: 'evening' },
    indications: ['hypercholesterolemia', 'ldl_reduction', 'statin_intolerance'],
    mechanisms: ['NPC1L1_INHIBITION', 'CHOLESTEROL_ABSORPTION_INHIBITION'],
    warnings: ['hepatic_function_monitor'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase3', 'Metabolic_Phase2'],
    riskThresholdKey: 'ezetimibe',
  },
  red_yeast_rice: {
    id: 'red_yeast_rice', name: 'Red Yeast Rice', nameRu: 'Красный дрожжевой рис',
    category: 'supplement',
    doseRange: { min: 1200, max: 2400, unit: 'mg', frequency: 'daily' },
    indications: ['dyslipidemia', 'ldl_reduction', 'statin_alternative'],
    mechanisms: ['HMG_COA_INHIBITION', 'STATIN_LIKE'],
    warnings: ['statin_myopathy_risk', 'avoid_with_statin', 'hepatotoxicity'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase2'],
    riskThresholdKey: 'red_yeast_rice',
  },
  niacin: {
    id: 'niacin', name: 'Niacin', nameRu: 'Ниацин (B3)',
    category: 'vitamin',
    doseRange: { min: 500, max: 1500, unit: 'mg', frequency: 'night' },
    indications: ['hdl_increase', 'lipid_management'],
    mechanisms: ['HDL_AUGMENTATION', 'TRIGLYCERIDE_REDUCTION'],
    warnings: ['flushing', 'hepatotoxicity_high_dose', 'glucose_elevation', 'AIM_HIGH_HPS2_no_CV_benefit'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase2', 'Cardio_Phase3'],
  },
  omega3: {
    id: 'omega3', name: 'Omega-3', nameRu: 'Омега-3 (EPA/DHA)',
    category: 'supplement',
    doseRange: { min: 1000, max: 6000, unit: 'mg', frequency: 'daily' },
    indications: ['dyslipidemia', 'inflammation', 'thrombosis_prevention', 'neuroprotection'],
    mechanisms: ['EPA_DHA', 'TG_REDUCTION', 'ANTI_INFLAMMATORY'],
    warnings: ['bleeding_risk_with_anticoagulants', 'fish_burp'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase1', 'Cardio_Phase3'],
  },

  // ═══════════════════════════════════════════════════════════════
  // HORMONAL / PCT
  // ═══════════════════════════════════════════════════════════════
  anastrozole: {
    id: 'anastrozole', name: 'Anastrozole', nameRu: 'Анастрозол',
    category: 'pharma',
    doseRange: { min: 0.25, max: 1, unit: 'mg', frequency: 'eod_to_daily' },
    indications: ['estradiol_control', 'gynecomastia_prevention', 'aromatase_inhibition'],
    mechanisms: ['AROMATASE_INHIBITION', 'E2_SUPPRESSION'],
    warnings: ['e2_crash_risk', 'joint_pain', 'libido_loss', 'lipid_worsening', 'bone_loss_longterm'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase2', 'E2_Phase3', 'Reproductive_Phase3'],
    riskThresholdKey: 'anastro',
  },
  letrozole: {
    id: 'letrozole', name: 'Letrozole', nameRu: 'Летрозол',
    category: 'pharma',
    doseRange: { min: 0.25, max: 2.5, unit: 'mg', frequency: 'eod_to_daily' },
    indications: ['estradiol_control', 'severe_gynecomastia'],
    mechanisms: ['AROMATASE_INHIBITION', 'E2_SUPPRESSION'],
    warnings: ['e2_crash_risk_severe', 'lipid_disaster', 'bone_loss'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase3', 'Reproductive_Phase4'],
    riskThresholdKey: 'letrozole',
  },
  exemestane: {
    id: 'exemestane', name: 'Exemestane', nameRu: 'Экземестан',
    category: 'pharma',
    doseRange: { min: 6.25, max: 25, unit: 'mg', frequency: 'daily_to_eod' },
    indications: ['estradiol_control', 'steroidal_ai', 'less_lipid_impact'],
    mechanisms: ['AROMATASE_INHIBITION_IRREVERSIBLE', 'E2_SUPPRESSION'],
    warnings: ['e2_crash_risk', 'joint_pain'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase2', 'Reproductive_Phase3'],
    riskThresholdKey: 'exemestane',
  },
  tamoxifen: {
    id: 'tamoxifen', name: 'Tamoxifen', nameRu: 'Тамоксифен',
    category: 'pharma',
    doseRange: { min: 10, max: 40, unit: 'mg', frequency: 'daily' },
    indications: ['gynecomastia_treatment', 'pct', 'estrogen_blockade'],
    mechanisms: ['SERM', 'ER_ANTAGONISM_BREAST'],
    warnings: ['thromboembolism', 'hot_flashes', 'ocular_toxicity'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase3', 'PCT_Phase1', 'PCT_Phase2'],
    riskThresholdKey: 'tamox',
  },
  clomiphene: {
    id: 'clomiphene', name: 'Clomiphene', nameRu: 'Кломифен',
    category: 'pharma',
    doseRange: { min: 25, max: 100, unit: 'mg', frequency: 'daily' },
    indications: ['pct', 'hpta_restoration', 'fertility'],
    mechanisms: ['SERM', 'GNRH_STIMULATION', 'LH_FSH_SECRETION'],
    warnings: ['visual_disturbances', 'mood_swings', 'ovarian_hyperstimulation'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['PCT_Phase1', 'Fertility_Phase1'],
    riskThresholdKey: 'clomi',
  },
  enclomiphene: {
    id: 'enclomiphene', name: 'Enclomiphene', nameRu: 'Энкломифен',
    category: 'pharma',
    doseRange: { min: 12.5, max: 25, unit: 'mg', frequency: 'daily' },
    indications: ['hpta_restoration', 'testosterone_boost', 'fertility'],
    mechanisms: ['SERM', 'GNRH_STIMULATION'],
    warnings: ['testosterone_overshoot'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['PCT_Phase1', 'Fertility_Phase2'],
  },
  hcg: {
    id: 'hcg', name: 'hCG', nameRu: 'ХГЧ',
    category: 'pharma',
    doseRange: { min: 250, max: 1000, unit: 'IU', frequency: '2-3x_weekly' },
    indications: ['testicular_atrophy_prevention', 'pct', 'fertility'],
    mechanisms: ['LH_MIMETIC', 'LEYDIG_CELL_STIMULATION', 'INTRATESTICULAR_TESTOSTERONE'],
    warnings: ['estradiol_elevation', 'desensitization', 'ai_may_be_required'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['PCT_Phase2', 'Fertility_Phase2', 'Fertility_Phase3'],
    riskThresholdKey: 'hcg',
  },

  // ═══════════════════════════════════════════════════════════════
  // DOPAMINE AGONISTS
  // ═══════════════════════════════════════════════════════════════
  cabergoline: {
    id: 'cabergoline', name: 'Cabergoline', nameRu: 'Каберголин',
    category: 'pharma',
    doseRange: { min: 0.25, max: 0.5, unit: 'mg', frequency: '2x_weekly' },
    indications: ['prolactin_reduction', 'nandrolone_pct', 'libido_recovery'],
    mechanisms: ['D2_AGONISM', 'PROLACTIN_SUPPRESSION'],
    warnings: ['cardiac_valve_risk_longterm', 'nausea', 'dizziness'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Neuro_Phase2', 'PCT_Phase2'],
    riskThresholdKey: 'caberg',
  },

  // ═══════════════════════════════════════════════════════════════
  // HEPATIC SUPPORT
  // ═══════════════════════════════════════════════════════════════
  nac: {
    id: 'nac', name: 'N-Acetylcysteine', nameRu: 'N-Ацетилцистеин',
    category: 'amino',
    doseRange: { min: 600, max: 1800, unit: 'mg', frequency: 'bid' },
    indications: ['glutathione_synthesis', 'liver_protection', 'mucolytic'],
    mechanisms: ['GLUTATHIONE_PRECURSOR', 'ANTIOXIDANT', 'CYTOTOXICITY_REDUCTION'],
    warnings: ['gastric_discomfort_fasting', 'unpleasant_taste'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase1', 'Hepatic_Phase3'],
  },
  tudca: {
    id: 'tudca', name: 'TUDCA', nameRu: 'Тауроурсодезоксихолевая кислота',
    category: 'supplement',
    doseRange: { min: 250, max: 500, unit: 'mg', frequency: 'daily' },
    phaseDosing: { 'Hepatic_Phase3': { min: 500, max: 1000, unit: 'mg', frequency: 'bid' }, 'Hepatic_Phase4': { min: 0, max: 0, unit: 'mg', frequency: 'CONTRAINDICATED' } },
    indications: ['cholestasis', 'liver_protection', 'bile_flow'],
    mechanisms: ['BSEP_ACTIVATION', 'CHOLERESIS', 'ER_STRESS_REDUCTION'],
    warnings: ['diarrhea_initial', 'biliary_obstruction_contraindication', 'CONTRAINDICATED_at_ALT_5x_ULN'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase1', 'Hepatic_Phase2', 'Hepatic_Phase3'],
  },
  milk_thistle: {
    id: 'milk_thistle', name: 'Milk Thistle', nameRu: 'Расторопша (силимарин)',
    category: 'herb',
    doseRange: { min: 300, max: 600, unit: 'mg', frequency: 'bid' },
    indications: ['liver_protection', 'membrane_stabilization', 'antifibrotic'],
    mechanisms: ['SILYMARIN', 'MEMBRANE_STABILIZATION', 'RNA_POLYMERASE_STIMULATION'],
    warnings: ['cyp3a4_moderate_inhibition'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase1', 'Hepatic_Phase2'],
  },
  glycyrrhizic_acid: {
    id: 'glycyrrhizic_acid', name: 'Glycyrrhizic Acid', nameRu: 'Глицирризиновая кислота',
    category: 'pharma',
    doseRange: { min: 50, max: 100, unit: 'mg', frequency: 'bid' },
    indications: ['liver_protection', 'anti_inflammatory', 'membrane_stabilization'],
    mechanisms: ['GLYCYRRHIZIN', 'ANTI_INFLAMMATORY', 'MINERALOCORTICOID_EFFECT'],
    warnings: ['hypertension', 'hypokalemia', 'edema'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase2'],
    riskThresholdKey: 'glycyrrhizin',
  },
  sam_e: {
    id: 'sam_e', name: 'S-Adenosyl-L-Methionine', nameRu: 'S-Аденозилметионин (SAMe)',
    category: 'amino',
    doseRange: { min: 400, max: 800, unit: 'mg', frequency: 'morning_fasting' },
    indications: ['liver_protection', 'methylation_support', 'mood'],
    mechanisms: ['METHYLATION', 'GLUTATHIONE_SYNTHESIS', 'MEMBRANE_FLUIDITY'],
    warnings: ['mania_risk_bipolar', 'gastrointestinal'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase3'],
    riskThresholdKey: 'sam_e',
  },
  phosphatidylcholine: {
    id: 'phosphatidylcholine', name: 'Phosphatidylcholine', nameRu: 'Фосфатидилхолин',
    category: 'supplement',
    doseRange: { min: 1200, max: 3600, unit: 'mg', frequency: 'daily' },
    indications: ['liver_protection', 'membrane_repair', 'fatty_liver'],
    mechanisms: ['MEMBRANE_PHOSPHOLIPID', 'VLDL_SECRETION', 'HEPATOCYTE_REPAIR'],
    warnings: ['rare_tmao_elevation'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hepatic_Phase2'],
  },

  // ═══════════════════════════════════════════════════════════════
  // RENAL SUPPORT
  // ═══════════════════════════════════════════════════════════════
  ketosteril: {
    id: 'ketosteril', name: 'Ketosteril', nameRu: 'Кетостерил',
    category: 'pharma',
    doseRange: { min: 4, max: 8, unit: 'tablets', frequency: 'tid_with_meals' },
    indications: ['ckd', 'protein_restriction_support', 'uremic_toxin_reduction'],
    mechanisms: ['KETO_ANALOGUES', 'NITROGEN_BALANCE', 'UREA_REDUCTION'],
    warnings: ['protein_restriction_required', 'monitor_amino_acids'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Renal_Phase4'],
    riskThresholdKey: 'ketosteril',
  },
  sodium_bicarbonate: {
    id: 'sodium_bicarbonate', name: 'Sodium Bicarbonate', nameRu: 'Бикарбонат натрия',
    category: 'pharma',
    doseRange: { min: 500, max: 2000, unit: 'mg', frequency: 'bid' },
    indications: ['metabolic_acidosis', 'ckd', 'acid_load_reduction'],
    mechanisms: ['BASE_SUPPLEMENT', 'ACIDOSIS_CORRECTION', 'UREMIC_TOXIN_REDUCTION'],
    warnings: ['sodium_load', 'hypertension', 'monitor_bicarbonate'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Renal_Phase4'],
    riskThresholdKey: 'sodium_bicarbonate',
  },
  astragalus: {
    id: 'astragalus', name: 'Astragalus', nameRu: 'Астрагал',
    category: 'herb',
    doseRange: { min: 500, max: 1500, unit: 'mg', frequency: 'bid' },
    indications: ['renoprotection', 'egfr_preservation', 'anti_fibrotic'],
    mechanisms: ['TGF_BETA_INHIBITION', 'RENOPROTECTION', 'ANTI_INFLAMMATORY'],
    warnings: ['rare_hypotension'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Renal_Phase1', 'Renal_Phase3'],
  },
  cordyceps: {
    id: 'cordyceps', name: 'Cordyceps', nameRu: 'Кордицепс',
    category: 'herb',
    doseRange: { min: 500, max: 2000, unit: 'mg', frequency: 'daily' },
    indications: ['renoprotection', 'kidney_function', 'bun_creatinine_reduction'],
    mechanisms: ['RENOPROTECTION', 'ANTI_INFLAMMATORY'],
    warnings: ['autoimmune_caution'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Renal_Phase2'],
  },

  // ═══════════════════════════════════════════════════════════════
  // HEMATOLOGIC / ANTICOAGULANTS
  // ═══════════════════════════════════════════════════════════════
  pentoxifylline: {
    id: 'pentoxifylline', name: 'Pentoxifylline', nameRu: 'Пентоксифиллин',
    category: 'pharma',
    doseRange: { min: 400, max: 800, unit: 'mg', frequency: 'bid_with_food' },
    indications: ['peripheral_vascular_disease', 'blood_viscosity_reduction', 'microcirculation'],
    mechanisms: ['HEMORHEOLOGY', 'RBC_FLEXIBILITY', 'TNF_ALPHA_INHIBITION'],
    warnings: ['bleeding_risk', 'hypotension', 'retinal_hemorrhage_rare'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hematologic_Phase2'],
    riskThresholdKey: 'pentoxifylline',
  },
  enoxaparin: {
    id: 'enoxaparin', name: 'Enoxaparin', nameRu: 'Эноксапарин (НМГ)',
    category: 'pharma',
    doseRange: { min: 40, max: 40, unit: 'mg', frequency: 'daily' },
    indications: ['thrombosis_prevention', 'd_dimer_elevation', 'venous_thromboembolism'],
    mechanisms: ['ANTI_XA', 'ANTICOAGULATION', 'THROMBIN_INHIBITION'],
    warnings: ['bleeding_risk_major', 'heparin_thrombocytopenia', 'renal_adjustment'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hematologic_Phase4'],
    riskThresholdKey: 'enoxaparin',
  },
  serrapeptase: {
    id: 'serrapeptase', name: 'Serrapeptase', nameRu: 'Серрапептаза',
    category: 'supplement',
    doseRange: { min: 10, max: 20, unit: 'mg', frequency: 'tid_fasting' },
    indications: ['fibrinolysis', 'inflammation_reduction', 'blood_viscosity'],
    mechanisms: ['PROTEOLYSIS', 'FIBRIN_DEGRADATION', 'ALPHA2_MACROGLOBULIN_INHIBITION'],
    warnings: ['bleeding_risk', 'stop_before_surgery'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hematologic_Phase1', 'Hematologic_Phase2'],
  },
  nattokinase: {
    id: 'nattokinase', name: 'Nattokinase', nameRu: 'Наттокиназа',
    category: 'supplement',
    doseRange: { min: 100, max: 200, unit: 'mg', frequency: 'daily_fasting' },
    indications: ['fibrinolysis', 'blood_viscosity', 'thrombosis_prevention'],
    mechanisms: ['FIBRINOLYSIS', 'PLASMINOGEN_ACTIVATION', 'PAI1_INHIBITION'],
    warnings: ['bleeding_risk', 'stop_before_surgery'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Hematologic_Phase1', 'Hematologic_Phase2'],
  },

  // ═══════════════════════════════════════════════════════════════
  // ANTI-INFLAMMATORY / METABOLIC
  // ═══════════════════════════════════════════════════════════════
  berberine: {
    id: 'berberine', name: 'Berberine', nameRu: 'Берберин',
    category: 'supplement',
    doseRange: { min: 500, max: 1500, unit: 'mg', frequency: 'bid_before_meals' },
    indications: ['insulin_resistance', 'lipid_management', 'ampk_activation'],
    mechanisms: ['AMPK_ACTIVATION', 'INSULIN_SENSITIVITY', 'LDL_RECEPTOR_UPREGULATION'],
    warnings: ['hypoglycemia_with_diabetes_meds', 'gastrointestinal', 'max_2000_mg_day'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Metabolic_Phase1', 'Metabolic_Phase2'],
  },
  metformin: {
    id: 'metformin', name: 'Metformin', nameRu: 'Метформин',
    category: 'pharma',
    doseRange: { min: 500, max: 2550, unit: 'mg', frequency: 'bid' },
    indications: ['insulin_resistance', 'gh_induced_hyperglycemia', 'diabetes'],
    mechanisms: ['AMPK_ACTIVATION', 'HEPATIC_GLUCOSE_OUTPUT_REDUCTION', 'INSULIN_SENSITIVITY'],
    warnings: ['lactic_acidosis_risk', 'gi_distress', 'stop_before_contrast', 'max_2550_mg_day_FDA'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Metabolic_Phase2'],
  },
  alpha_lipoic: {
    id: 'alpha_lipoic', name: 'Alpha-Lipoic Acid', nameRu: 'Альфа-липоевая кислота',
    category: 'supplement',
    doseRange: { min: 300, max: 600, unit: 'mg', frequency: 'bid' },
    indications: ['antioxidant', 'insulin_sensitivity', 'neuropathy'],
    mechanisms: ['ANTIOXIDANT', 'GLUTATHIONE_REGENERATION', 'NRF2_ACTIVATION'],
    warnings: ['hypoglycemia_rare'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Metabolic_Phase1', 'Neuro_Phase1'],
  },

  // ═══════════════════════════════════════════════════════════════
  // CLENBUTEROL SUPPORT
  // ═══════════════════════════════════════════════════════════════
  taurine: {
    id: 'taurine', name: 'Taurine', nameRu: 'Таурин',
    category: 'amino',
    doseRange: { min: 2000, max: 5000, unit: 'mg', frequency: 'tid' },
    indications: ['osmoregulation', 'cardioprotection', 'cramp_prevention'],
    mechanisms: ['OSMOLYTE', 'CALCIUM_HOMEOSTASIS', 'BILE_ACID_CONJUGATION'],
    warnings: ['none_significant'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Clen_Phase1', 'Cardio_Phase1'],
  },
  potassium: {
    id: 'potassium', name: 'Potassium', nameRu: 'Калий',
    category: 'mineral',
    doseRange: { min: 400, max: 2000, unit: 'mg', frequency: 'daily' },
    indications: ['electrolyte_repletion', 'cramp_prevention', 'clenbuterol'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'MEMBRANE_POTENTIAL'],
    warnings: ['hyperkalemia_with_acei_arb'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Clen_Phase1'],
  },
  magnesium: {
    id: 'magnesium', name: 'Magnesium', nameRu: 'Магний',
    category: 'mineral',
    doseRange: { min: 200, max: 800, unit: 'mg', frequency: 'daily' },
    indications: ['cramp_prevention', 'heart_rhythm', 'sleep', 'd3_activation'],
    mechanisms: ['NMDA_ANTAGONISM', 'GABA_AGONISM', 'COFACTOR_300_ENZYMES'],
    warnings: ['diarrhea_high_dose'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Clen_Phase1', 'Neuro_Phase1', 'Cardio_Phase1'],
  },

  // ═══════════════════════════════════════════════════════════════
  // THYROID / T3-T4
  // ═══════════════════════════════════════════════════════════════
  calcium: {
    id: 'calcium', name: 'Calcium', nameRu: 'Кальций',
    category: 'mineral',
    doseRange: { min: 500, max: 1000, unit: 'mg', frequency: 'daily' },
    indications: ['bone_protection', 'thyroid_osteoporosis', 'muscle_function'],
    mechanisms: ['BONE_MINERALIZATION', 'NEUROMUSCULAR'],
    warnings: ['hypercalcemia_with_high_d3'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Thyroid_Phase1'],
  },
  vitamin_d3: {
    id: 'vitamin_d3', name: 'Vitamin D3', nameRu: 'Витамин D3',
    category: 'vitamin',
    doseRange: { min: 2000, max: 10000, unit: 'IU', frequency: 'daily' },
    indications: ['bone_health', 'immune_function', 'testosterone_support'],
    mechanisms: ['VDR_ACTIVATION', 'CALCIUM_ABSORPTION', 'IMMUNOMODULATION'],
    warnings: ['hypercalcemia_rare', 'monitor_25ohd'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Thyroid_Phase1', 'Bone_Phase1', 'Immunity_Phase1'],
  },
  vitamin_k2: {
    id: 'vitamin_k2', name: 'Vitamin K2 MK-7', nameRu: 'Витамин K2 MK-7',
    category: 'vitamin',
    doseRange: { min: 100, max: 200, unit: 'mcg', frequency: 'daily' },
    indications: ['calcium_direction', 'bone_health', 'arterial_calcification_prevention'],
    mechanisms: ['OSTEOCALCIN_ACTIVATION', 'MGP_ACTIVATION'],
    warnings: ['none_significant'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Thyroid_Phase1', 'Bone_Phase1'],
  },
  vitamin_c: {
    id: 'vitamin_c', name: 'Vitamin C', nameRu: 'Витамин C',
    category: 'vitamin',
    doseRange: { min: 500, max: 2000, unit: 'mg', frequency: 'bid' },
    indications: ['antioxidant', 'collagen_synthesis', 'iron_absorption'],
    mechanisms: ['ANTIOXIDANT', 'COLLAGEN_SYNTHESIS', 'IRON_REDUCTION'],
    warnings: ['diarrhea_high_dose', 'oxalate_stones_risk'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Antioxidant_Phase1'],
  },
  vitamin_e: {
    id: 'vitamin_e', name: 'Vitamin E', nameRu: 'Витамин E (d-альфа-токоферол)',
    category: 'vitamin',
    doseRange: { min: 200, max: 400, unit: 'IU', frequency: 'daily_with_fat' },
    indications: ['antioxidant', 'ldl_protection', 'membrane_stabilization'],
    mechanisms: ['LIPID_PEROXIDATION_INHIBITION', 'MEMBRANE_ANTIOXIDANT'],
    warnings: ['bleeding_risk_with_anticoagulants', 'prostate_cancer_risk_high_dose'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase4'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DIM / E2 CONTROL
  // ═══════════════════════════════════════════════════════════════
  dim: {
    id: 'dim', name: 'DIM', nameRu: 'Дииндолилметан',
    category: 'supplement',
    doseRange: { min: 100, max: 600, unit: 'mg', frequency: 'daily' },
    phaseDosing: { 'E2_Phase2': { min: 200, max: 400, unit: 'mg', frequency: 'bid' }, 'E2_Phase3': { min: 400, max: 600, unit: 'mg', frequency: 'bid' } },
    indications: ['estrogen_metabolism', 'aromatase_modulation', 'prostate_health'],
    mechanisms: ['ESTROGEN_METABOLISM', '2_HYDROXY_ESTRONE_FAVORING', 'AROMATASE_MODULATION'],
    warnings: ['none_significant', 'max_600_mg_day'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase1'],
  },
  calcium_d_glucarate: {
    id: 'calcium_d_glucarate', name: 'Calcium D-Glucarate', nameRu: 'Кальций-D-глюкарат',
    category: 'supplement',
    doseRange: { min: 500, max: 2000, unit: 'mg', frequency: 'daily' },
    indications: ['estrogen_clearance', 'glucuronidation'],
    mechanisms: ['GLUCURONIDATION', 'ESTROGEN_EXCRETION', 'BETA_GLUCURONIDASE_INHIBITION'],
    warnings: ['none_significant', 'max_2000_mg_day'],
    evidenceLevel: 'C',
    lastUpdated: '2024-07-19',
    protocolRefs: ['E2_Phase1'],
  },

  // ═══════════════════════════════════════════════════════════════
  // OTHER SUPPORT
  // ═══════════════════════════════════════════════════════════════
  coq10: {
    id: 'coq10', name: 'CoQ10', nameRu: 'Коэнзим Q10',
    category: 'supplement',
    doseRange: { min: 100, max: 300, unit: 'mg', frequency: 'daily_with_food' },
    indications: ['mitochondrial_support', 'cardioprotection', 'statin_myopathy_prevention'],
    mechanisms: ['ELECTRON_TRANSPORT', 'ATP_PRODUCTION', 'ANTIOXIDANT'],
    warnings: ['interaction_with_warfarin'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Cardio_Phase1', 'Neuro_Phase1'],
  },
  zinc: {
    id: 'zinc', name: 'Zinc', nameRu: 'Цинк',
    category: 'mineral',
    doseRange: { min: 15, max: 50, unit: 'mg', frequency: 'daily' },
    indications: ['testosterone_support', 'immune_function', 'prostate_health'],
    mechanisms: ['AROMATASE_MODULATION', '5AR_INHIBITION', 'IMMUNE_SUPPORT'],
    warnings: ['copper_depletion_longterm', 'nausea_fasting'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Reproductive_Phase1', 'Immunity_Phase1'],
  },
  selenium: {
    id: 'selenium', name: 'Selenium', nameRu: 'Селен',
    category: 'mineral',
    doseRange: { min: 100, max: 200, unit: 'mcg', frequency: 'daily' },
    indications: ['thyroid_support', 'antioxidant', 'fertility'],
    mechanisms: ['GPX_COFACTOR', 'DIO2_ACTIVATION', 'SELENOPROTEIN_SYNTHESIS'],
    warnings: ['toxicity_above_400mcg'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Thyroid_Phase1', 'Reproductive_Phase1'],
  },
  ashwagandha: {
    id: 'ashwagandha', name: 'Ashwagandha', nameRu: 'Ашваганда',
    category: 'herb',
    doseRange: { min: 300, max: 600, unit: 'mg', frequency: 'evening' },
    indications: ['cortisol_reduction', 'stress_adaptation', 'testosterone_support'],
    mechanisms: ['CORTISOL_REDUCTION', 'GABA_AGONISM', 'HPA_MODULATION'],
    warnings: ['hyperthyroidism_caution', 'sedation'],
    evidenceLevel: 'B',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Neuro_Phase1', 'Reproductive_Phase1'],
  },
  melatonin: {
    id: 'melatonin', name: 'Melatonin', nameRu: 'Мелатонин',
    category: 'supplement',
    doseRange: { min: 1, max: 5, unit: 'mg', frequency: 'bedtime' },
    indications: ['sleep', 'circadian_rhythm', 'antioxidant'],
    mechanisms: ['MT1_MT2_AGONISM', 'CIRCADIAN_REGULATION'],
    warnings: ['daytime_sedation_high_dose', 'phase3_option_10mg_for_severe_cases'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Neuro_Phase1'],
  },
  b_complex: {
    id: 'b_complex', name: 'B-Complex', nameRu: 'Витамины группы B',
    category: 'vitamin',
    doseRange: { min: 1, max: 1, unit: 'capsule', frequency: 'daily_morning' },
    indications: ['methylation', 'energy_metabolism', 'homocysteine_lowering'],
    mechanisms: ['METHYLATION', 'ONE_CARBON_METABOLISM', 'HOMOCYSTEINE_REDUCTION'],
    warnings: ['urine_discoloration_normal'],
    evidenceLevel: 'A',
    lastUpdated: '2024-07-19',
    protocolRefs: ['Metabolic_Phase1'],
  },
  // ════════════════════════════════════════════════════════════════════════════
  //  ЭТАП 3: Вещества из ТЗ «Нейротоксичность ААС» + «Суставы.txt»
  // ════════════════════════════════════════════════════════════════════════════
  grandaxine: {
    id: 'grandaxine', name: 'Tofisopam (Grandaxine)', nameRu: 'Тофизопам (Грандаксин)',
    category: 'pharma',
    doseRange: { min: 25, max: 100, unit: 'mg', frequency: 'bid' },
    indications: ['anxiety', 'GABAergic_support', 'PDE4_inhibition'],
    mechanisms: ['PDE4_INHIBITION', 'GABA_MODULATION'],
    warnings: ['prescription_only', 'no_tolerance_no_dependence'],
    evidenceLevel: 'B',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV2'],
  },
  dihexa: {
    id: 'dihexa', name: 'Dihexa', nameRu: 'Дигекса',
    category: 'peptide',
    doseRange: { min: 5, max: 20, unit: 'mg', frequency: 'daily' },
    indications: ['cognitive_enhancement', 'neurogenesis', 'HGF_activation'],
    mechanisms: ['HGF_CMET_AGONISM', 'SYNAPTOGENESIS'],
    warnings: ['research_chemical', 'contraindicated_with_cancer_history'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV3'],
  },
  phenylpiracetam: {
    id: 'phenylpiracetam', name: 'Phenylpiracetam', nameRu: 'Фенилпирацетам (Фенотропил)',
    category: 'supplement',
    doseRange: { min: 100, max: 300, unit: 'mg', frequency: 'daily_morning' },
    indications: ['cognitive_enhancement', 'motivation', 'dopamine_support'],
    mechanisms: ['DOPAMINE_REUPTAKE_INHIBITION', 'NOREPINEPHRINE_REUPTAKE_INHIBITION'],
    warnings: ['increases_blood_pressure', 'tolerance_develops'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV3'],
  },
  tropoflavin: {
    id: 'tropoflavin', name: 'Tropoflavin (7,8-DHF)', nameRu: 'Тропофлавин (7,8-DHF)',
    category: 'supplement',
    doseRange: { min: 5, max: 30, unit: 'mg', frequency: 'daily' },
    indications: ['neurogenesis', 'TrkB_agonist', 'BDNF_mimetic'],
    mechanisms: ['TrkB_AGONISM', 'NEURONAL_SURVIVAL'],
    warnings: ['research_chemical', 'mild_sedation'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV3'],
  },
  fluvoxamine: {
    id: 'fluvoxamine', name: 'Fluvoxamine', nameRu: 'Флувоксамин',
    category: 'pharma',
    doseRange: { min: 50, max: 300, unit: 'mg', frequency: 'bedtime' },
    indications: ['depression', 'OCD', 'anxiety', 'sigma1_agonism'],
    mechanisms: ['SERT_INHIBITION', 'SIGMA1_AGONISM'],
    warnings: ['prescription_only', 'CYP1A2_CYP2C19_inhibition', 'drug_interactions'],
    evidenceLevel: 'A',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV3'],
  },
  amantadine: {
    id: 'amantadine', name: 'Amantadine', nameRu: 'Амантадин',
    category: 'pharma',
    doseRange: { min: 50, max: 200, unit: 'mg', frequency: 'daily_morning' },
    indications: ['NMDA_antagonism', 'dopamine_support', 'neuroprotection'],
    mechanisms: ['NMDA_ANTAGONISM', 'DOPAMINE_RELEASE', 'BDNF_UPREGULATION'],
    warnings: ['prescription_only', 'anticholinergic_side_effects', 'sedation_first_month'],
    evidenceLevel: 'B',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV4'],
  },
  naltrexone: {
    id: 'naltrexone', name: 'LDN (Low Dose Naltrexone)', nameRu: 'LDN (низкодозовый налтрексон)',
    category: 'pharma',
    doseRange: { min: 1, max: 5, unit: 'mg', frequency: 'bedtime' },
    indications: ['neuroinflammation', 'autoimmune', 'opioid_system_modulation'],
    mechanisms: ['TLR4_ANTAGONISM', 'ENDOGENOUS_OPIOID_UPREGULATION'],
    warnings: ['prescription_only', 'contraindicated_with_opioids'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV4'],
  },
  guanfacine: {
    id: 'guanfacine', name: 'Guanfacine', nameRu: 'Гуанфацин',
    category: 'pharma',
    doseRange: { min: 0.5, max: 4, unit: 'mg', frequency: 'bedtime' },
    indications: ['ADHD', 'impulsivity', 'alpha2_adrenergic'],
    mechanisms: ['ALPHA2_ADRENERGIC_AGONISM_POSTSYNAPTIC'],
    warnings: ['prescription_only', 'sedation_first_weeks', 'hypotension'],
    evidenceLevel: 'A',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV4'],
  },
  tizanidine: {
    id: 'tizanidine', name: 'Tizanidine (Sirdalud)', nameRu: 'Тизанидин (Сирдалуд)',
    category: 'pharma',
    doseRange: { min: 2, max: 6, unit: 'mg', frequency: 'bedtime' },
    indications: ['muscle_relaxation', 'sleep_induction', 'alpha2_adrenergic'],
    mechanisms: ['ALPHA2_ADRENERGIC_AGONISM_PRESYNAPTIC', 'NOREPINEPHRINE_REDUCTION'],
    warnings: ['prescription_only', 'sedation', 'tolerance_3_months_max', 'hypotension'],
    evidenceLevel: 'B',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Neuro_LV4'],
  },
  havinson_a4: {
    id: 'havinson_a4', name: 'Havinson A4 (Cartilage)', nameRu: 'Хавинсон A4 (хрящ)',
    category: 'peptide',
    doseRange: { min: 1, max: 2, unit: 'capsule', frequency: 'daily_morning' },
    indications: ['cartilage_repair', 'chondrocyte_stimulation'],
    mechanisms: ['PEPTIDE_BIOREGULATION_CARTILAGE'],
    warnings: ['research_peptide'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV2'],
  },
  havinson_a19: {
    id: 'havinson_a19', name: 'Havinson A19 (Vessels)', nameRu: 'Хавинсон A19 (сосуды)',
    category: 'peptide',
    doseRange: { min: 1, max: 2, unit: 'capsule', frequency: 'daily_evening' },
    indications: ['vascular_health', 'endothelial_support'],
    mechanisms: ['PEPTIDE_BIOREGULATION_VASCULAR'],
    warnings: ['research_peptide'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV2'],
  },
  ligamentide: {
    id: 'ligamentide', name: 'LigamenTIDE PLUS', nameRu: 'LigamenTIDE PLUS',
    category: 'peptide',
    doseRange: { min: 1, max: 2, unit: 'capsule', frequency: 'daily_morning' },
    indications: ['ligament_repair', 'tendon_health'],
    mechanisms: ['PEPTIDE_BIOREGULATION_LIGAMENT'],
    warnings: ['research_peptide'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV2'],
  },
  neovitin: {
    id: 'neovitin', name: 'Neovitin', nameRu: 'Неовитин',
    category: 'herb',
    doseRange: { min: 1, max: 2, unit: 'ml', frequency: 'daily' },
    indications: ['antioxidant', 'anti_inflammatory', 'immune_support'],
    mechanisms: ['ANTIOXIDANT', 'NF_KB_INHIBITION'],
    warnings: ['herbal_extract'],
    evidenceLevel: 'C',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV2'],
  },
  voltaren_gel: {
    id: 'voltaren_gel', name: 'Voltaren Gel (Diclofenac topical)', nameRu: 'Вольтарен гель (диклофенак местно)',
    category: 'pharma',
    doseRange: { min: 2, max: 3, unit: 'applications', frequency: 'daily_topical' },
    indications: ['joint_pain', 'local_inflammation', 'tendonitis'],
    mechanisms: ['COX2_INHIBITION_TOPICAL'],
    warnings: ['topical_only', 'avoid_open_wounds'],
    evidenceLevel: 'A',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV1'],
  },
  artra: {
    id: 'artra', name: 'Artra (Glucosamine+Chondroitin)', nameRu: 'Артра (глюкозамин+хондроитин)',
    category: 'supplement',
    doseRange: { min: 1, max: 2, unit: 'tablet', frequency: 'bid' },
    indications: ['osteoarthritis', 'chondroprotection'],
    mechanisms: ['GAG_SUBSTRATE', 'MMP13_INHIBITION'],
    warnings: ['combination_product'],
    evidenceLevel: 'B',
    lastUpdated: '2026-08-06',
    protocolRefs: ['Joints_LV1'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
//  API FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

export function getDosingRecord(id: string): DosingRecord | undefined {
  return SUPPORT_DOSING[id.toLowerCase()];
}

export function getProtocolDose(id: string, protocolPhase: string): string {
  const record = getDosingRecord(id);
  if (!record) return '';
  const range = record.phaseDosing?.[protocolPhase] || record.doseRange;
  const { min, max, unit, frequency } = range;
  return min === max
    ? `${min} ${unit} ${frequency}`
    : `${min}-${max} ${unit} ${frequency}`;
}

export function getMinDose(id: string): number {
  const record = getDosingRecord(id);
  return record?.doseRange.min || 0;
}

export function getMaxDose(id: string): number {
  const record = getDosingRecord(id);
  return record?.doseRange.max || 0;
}

export function getMechanisms(id: string): string[] {
  return getDosingRecord(id)?.mechanisms || [];
}

export function getWarnings(id: string): string[] {
  return getDosingRecord(id)?.warnings || [];
}

export function getEvidenceLevel(id: string): 'A' | 'B' | 'C' | undefined {
  return getDosingRecord(id)?.evidenceLevel;
}

export function getRiskThresholdKey(id: string): string | undefined {
  return getDosingRecord(id)?.riskThresholdKey;
}

export function getProtocolRefs(id: string): string[] {
  return getDosingRecord(id)?.protocolRefs || [];
}

export function getAllDosingIds(): string[] {
  return Object.keys(SUPPORT_DOSING);
}
