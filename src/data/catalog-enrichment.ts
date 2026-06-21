// ===========================================================================
// CATALOG ENRICHMENT — дополнительная информация для каждого препарата
// Не изменяет исходный каталог, добавляет данные сверху.
// ===========================================================================

export interface CatalogEnrichment {
  targetSystems: string[];
  targetMechanisms: string[];
  linkedRisks?: { system: string; direction: 'up' | 'down' | 'both'; strength: number }[];
  cvProfile: { bloodPressure: 'up'|'down'|'neutral'; heartRate: 'up'|'down'|'neutral'; vascularTone: 'constrict'|'dilate'|'neutral'; thrombosisRisk: 'low'|'medium'|'high'; cnsLoad: 'low'|'medium'|'high' };
  analog?: string[];
  maxUsageWeeks?: number;
  labMarkers?: string[];
  restrictions?: string[];
}

export const CATALOG_ENRICHMENT: Record<string, CatalogEnrichment> = {
  // ═══════════════════════════════════════════════════════════════════
  // CORE — ЯДРО (обязательно на любом курсе)
  // ═══════════════════════════════════════════════════════════════════

  nac: {
    targetSystems: ['hepatic','renal','neuro'],
    targetMechanisms: ['GLUTATHIONE_SYNTHESIS','MUCOLYTIC','ANTIOXIDANT','DETOXIFICATION'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.4},{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['tudca','milk_thistle'],
    maxUsageWeeks: 52, labMarkers: ['АЛТ','АСТ','ГГТ','Креатинин'], restrictions:['Не принимать с активированным углём','Интервал 2ч с антибиотиками']
  },
  tudca: {
    targetSystems: ['hepatic'],
    targetMechanisms: ['BILE_ACID_MODULATION','MITOCHONDRIAL_PROTECTION','ER_STRESS_REDUCTION','ANTIAPOPTOTIC'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.5}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['nac','milk_thistle']
  },
  magnesium: {
    targetSystems: ['cardio','neuro','musculoskeletal'],
    targetMechanisms: ['NMDA_BLOCK','GABA_MOD','MUSCLE_RELAXATION','ATP_SYNTHESIS','CALCIUM_ANTAGONISM'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3},{system:'neuro',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['taurine','glycine']
  },
  coq10: {
    targetSystems: ['cardio','renal','hepatic'],
    targetMechanisms: ['ELECTRON_TRANSPORT_CHAIN','ANTIOXIDANT','ATP_PRODUCTION','MEMBRANE_STABILIZATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['alpha_lipoic','pqq']
  },
  vitamin_d3: {
    targetSystems: ['endocrine','hepatic','hematologic'],
    targetMechanisms: ['VDR_RECEPTOR_ACTIVATION','CALCIUM_REGULATION','IMMUNE_MODULATION','TESTOSTERONE_SYNTHESIS'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_k2']
  },
  zinc: {
    targetSystems: ['reproductive','endocrine','hematologic'],
    targetMechanisms: ['TESTOSTERONE_SYNTHESIS','AR_RECEPTOR_MODULATION','IMMUNE_CELL_PROLIFERATION','WOUND_HEALING'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['boron']
  },
  selenium: {
    targetSystems: ['endocrine','hepatic','hematologic'],
    targetMechanisms: ['GPX_SYNTHESIS','THYROID_HORMONE_ACTIVATION','ANTIOXIDANT','DNA_REPAIR'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['zinc']
  },
  milk_thistle: {
    targetSystems: ['hepatic'],
    targetMechanisms: ['MEMBRANE_STABILIZATION','ANTIOXIDANT','PROTEIN_SYNTHESIS_STIMULATION','ANTIFIBROTIC'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.4},{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['nac','tudca']
  },
  curcumin: {
    targetSystems: ['hepatic','musculoskeletal','neuro'],
    targetMechanisms: ['NF_KB_INHIBITION','COX2_INHIBITION','ANTIOXIDANT','ANTI_FIBROTIC','BDNF_INCREASE'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'neuro',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['boswellia','ginger']
  },
  ashwagandha: {
    targetSystems: ['neuro','endocrine','reproductive'],
    targetMechanisms: ['CORTISOL_REDUCTION','GABA_RECEPTOR_AGONISM','THYROID_T3_INCREASE','TESTOSTERONE_SUPPORT'],
    linkedRisks: [{system:'endocrine',direction:'down',strength:0.2},{system:'neuro',direction:'down',strength:0.2},{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['rhodiola','holy_basil']
  },
  vitamin_c: {
    targetSystems: ['hematologic','hepatic','immunity'],
    targetMechanisms: ['COLLAGEN_SYNTHESIS','ANTIOXIDANT','IMMUNE_CELL_FUNCTION','IRON_ABSORPTION','GLUTATHIONE_REGENERATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['alpha_lipoic','nac']
  },
  taurine: {
    targetSystems: ['cardio','neuro','hepatic','renal'],
    targetMechanisms: ['OSMOREGULATION','ANTIOXIDANT','CALCIUM_REGULATION','GABA_RECEPTOR_MODULATION','BILE_ACID_CONJUGATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3},{system:'neuro',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','glycine']
  },
  alpha_lipoic: {
    targetSystems: ['neuro','hepatic','renal'],
    targetMechanisms: ['ANTIOXIDANT_NETWORK','GLUTATHIONE_REGENERATION','MITOCHONDRIAL_FUNCTION','INSULIN_SENSITIVITY'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2},{system:'neuro',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['nac','coq10']
  },
  berberine: {
    targetSystems: ['endocrine','hepatic','cardio'],
    targetMechanisms: ['AMPK_ACTIVATION','INSULIN_SENSITIVITY','CYP3A4_INHIBITION','NF_KB_INHIBITION','CHOLESTEROL_REDUCTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['metformin']
  },
  vitamin_k2: {
    targetSystems: ['cardio','hematologic'],
    targetMechanisms: ['OSTEOCALCIN_ACTIVATION','MATRIX_GLA_PROTEIN_ACTIVATION','CALCIUM_DISTRIBUTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_d3']
  },
  probiotics: {
    targetSystems: ['hepatic','immunity','hematologic'],
    targetMechanisms: ['GUT_MICROBIOME_MODULATION','IMMUNE_REGULATION','GUT_BARRIER_INTEGRITY','SHORT_CHAIN_FATTY_ACID_PRODUCTION','PATHOGEN_EXCLUSION'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.4}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['prebiotics','glutamine']
  },
  vitamin_b12: {
    targetSystems: ['hematologic','neuro'],
    targetMechanisms: ['METHYLATION','DNA_SYNTHESIS','MYELIN_SYNTHESIS','HOMOCYSTEINE_LOWERING'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['folate']
  },
  omega3: {
    targetSystems: ['cardio','neuro','endocrine'],
    targetMechanisms: ['EPA_DHA_UP','ANTIINFLAMMATORY','TRIGLYCERIDE_LOWERING','MEMBRANE_FLUIDITY'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.4},{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['krill_oil','algae_oil']
  },
  iron: {
    targetSystems: ['hematologic','hepatic','musculoskeletal'],
    targetMechanisms: ['HEMOGLOBIN_SYNTHESIS','MYOGLOBIN_SYNTHESIS','OXYGEN_TRANSPORT','ENERGY_PRODUCTION'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['b12','folate']
  },
  copper: {
    targetSystems: ['hepatic','hematologic','musculoskeletal'],
    targetMechanisms: ['IRON_METABOLISM','CERULOPLASMIN','COLLAGEN_CROSS_LINKING','MELANIN_SYNTHESIS'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['zinc']
  },
  telmisartan: {
    targetSystems: ['cardio','renal','endocrine'],
    targetMechanisms: ['ANGIOTENSIN_RECEPTOR_BLOCKADE','PPAR_GAMMA_ACTIVATION','BP_REDUCTION','RENOPROTECTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['nebivolol','magnesium'],
    maxUsageWeeks: 156, labMarkers: ['АД','Калий','Креатинин'], restrictions:['Не с калийсберегающими','Контроль АД ежедневно']
  },
  nebivolol: {
    targetSystems: ['cardio'],
    targetMechanisms: ['BETA1_BLOCKADE','NO_RELEASE','HR_REDUCTION','BP_REDUCTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'down',heartRate:'down',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['telmisartan','magnesium']
  },
  collagen: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['COLLAGEN_SYNTHESIS','CARTILAGE_REPAIR','SKIN_ELASTICITY','TENDON_STRENGTH'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['glucosamine','msm']
  },
  glucosamine: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['CARTILAGE_REPAIR','SYNOVIAL_FLUID_PRODUCTION','ANTI_INFLAMMATORY'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['chondroitin','msm']
  },

  // ═══════════════════════════════════════════════════════════════════
  // STANDARD — СТАНДАРТ
  // ═══════════════════════════════════════════════════════════════════

  vitamin_b6: {
    targetSystems: ['neuro','endocrine'],
    targetMechanisms: ['NEUROTRANSMITTER_SUPPORT','HOMOCYSTEINE_REDUCTION','ENZYME_COFACTOR'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium']
  },
  folate: {
    targetSystems: ['hematologic','neuro','hepatic'],
    targetMechanisms: ['METHYLATION','DNA_SYNTHESIS','HOMOCYSTEINE_LOWERING','CELL_DIVISION'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b12']
  },
  vitamin_e: {
    targetSystems: ['cardio','skin','vessels'],
    targetMechanisms: ['MEMBRANE_PROTECTION','ANTIOXIDANT','LIPID_PEROXIDATION_INHIBITION','IMMUNE_MODULATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['selenium','vitamin_c']
  },
  vitamin_a: {
    targetSystems: ['neuro','skin','immunity'],
    targetMechanisms: ['RETINOID_SIGNALING','COLLAGEN_SUPPORT','EPITHELIAL_HEALTH','IMMUNE_CELL_DIFFERENTIATION'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_d3']
  },
  vitamin_b1: {
    targetSystems: ['cardio','hepatic','neuro'],
    targetMechanisms: ['TPP_PATHWAY','CARB_METABOLISM','NERVE_CONDUCTION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b6']
  },
  vitamin_b2: {
    targetSystems: ['neuro','hepatic','skin'],
    targetMechanisms: ['FLAVIN_PATHWAY','MITO_REPAIR','OXIDATIVE_STRESS_REDUCTION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b3']
  },
  vitamin_b3: {
    targetSystems: ['cardio','hepatic','neuro'],
    targetMechanisms: ['NAD_PATHWAY','LIPID_BALANCE','DNA_REPAIR'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'up',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b3_nm']
  },
  vitamin_b5: {
    targetSystems: ['endocrine','hepatic','skin'],
    targetMechanisms: ['COA_PATHWAY','HORMONE_SYNTHESIS','ENERGY_METABOLISM'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b6']
  },
  vitamin_b7: {
    targetSystems: ['skin','hepatic','neuro'],
    targetMechanisms: ['CARBOXYLASE_SUPPORT','SKIN_HEALTH','HAIR_GROWTH'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b5']
  },
  rose_hips: {
    targetSystems: ['immunity','skin','vessels'],
    targetMechanisms: ['VITAMIN_C_SOURCE','ANTIOXIDANT','COLLAGEN_SUPPORT','IMMUNE_BOOST'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_c','acerola']
  },
  acerola: {
    targetSystems: ['immunity','skin'],
    targetMechanisms: ['VITAMIN_C_SOURCE','ANTIOXIDANT','COLLAGEN_SUPPORT'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_c','rose_hips']
  },
  ginger: {
    targetSystems: ['hepatic','musculoskeletal','neuro'],
    targetMechanisms: ['ANTIINFLAMMATORY','ANTIOXIDANT','DIGESTIVE_STIMULANT','NAUSEA_RELIEF'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1},{system:'hepatic',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['curcumin','boswellia']
  },
  garlic: {
    targetSystems: ['cardio','vessels','immunity'],
    targetMechanisms: ['ALLICIN_ACTIVITY','BP_REDUCTION','IMMUNE_BOOST','LIPID_LOWERING'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['omega3','ginger']
  },
  ginseng: {
    targetSystems: ['neuro','endocrine','immunity'],
    targetMechanisms: ['ADAPTOGENIC','ENERGY_BOOST','IMMUNE_MODULATION','COGNITIVE_ENHANCEMENT'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'up',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'},
    analog:['ashwagandha','rhodiola']
  },
  rhodiola: {
    targetSystems: ['neuro','endocrine'],
    targetMechanisms: ['ADAPTOGENIC','FATIGUE_REDUCTION','COGNITIVE_ENHANCEMENT','STRESS_RESILIENCE'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','ginseng']
  },
  glycine: {
    targetSystems: ['neuro'],
    targetMechanisms: ['GLYCINERGIC','NEUROTRANSMITTER','SLEEP_PROMOTION','NMDA_MODULATION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','taurine']
  },
  glutamine: {
    targetSystems: ['immunity','musculoskeletal'],
    targetMechanisms: ['GUT_BARRIER','IMMUNE_FUEL','MUSCLE_PRESERVATION','NITROGEN_TRANSPORT'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['probiotics','zinc']
  },
  msm: {
    targetSystems: ['musculoskeletal','skin'],
    targetMechanisms: ['SULFUR_DONATION','COLLAGEN_CROSS_LINKING','ANTIINFLAMMATORY','ANTIOXIDANT'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['glucosamine','chondroitin']
  },
  chondroitin: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['CARTILAGE_PROTECTION','WATER_RETENTION','COLLAGEN_NETWORK_STABILIZATION'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['glucosamine','msm']
  },
  phosphatidylcholine: {
    targetSystems: ['hepatic','neuro'],
    targetMechanisms: ['MEMBRANE_REPAIR','LIPID_TRANSPORT','CHOLINE_DONATION','NEUROPROTECTION'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['nac','tudca']
  },
  inositol: {
    targetSystems: ['endocrine','neuro'],
    targetMechanisms: ['INSULIN_SENSITIVITY','NEUROTRANSMITTER_SIGNALING','CELL_SIGNALING','LIPID_METABOLISM'],
    linkedRisks: [{system:'endocrine',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['berberine','magnesium']
  },
  prebiotics: {
    targetSystems: ['hepatic','immunity'],
    targetMechanisms: ['MICROBIOME_FEEDING','SCFA_PRODUCTION','GUT_HEALTH','IMMUNE_REGULATION'],
    linkedRisks: [{system:'hepatic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['probiotics']
  },
  carnitine: {
    targetSystems: ['cardio','musculoskeletal','metabolic'],
    targetMechanisms: ['FATTY_ACID_TRANSPORT','MITOCHONDRIAL_FUNCTION','ENERGY_PRODUCTION','ANTIOXIDANT'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['taurine','coq10']
  },
  creatine: {
    targetSystems: ['musculoskeletal','neuro'],
    targetMechanisms: ['ATP_REGENERATION','STRENGTH_INCREASE','COGNITIVE_ENHANCEMENT','PHOSPHOCREATINE_SYSTEM'],
    linkedRisks: [{system:'renal',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['beta_alanine','carnitine']
  },
  beta_alanine: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['CARNOSINE_SYNTHESIS','BUFFER_CAPACITY','ENDURANCE','FATIGUE_DELAY'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['creatine','carnitine']
  },
  hmb: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['PROTEIN_BREAKDOWN_INHIBITION','MUSCLE_PRESERVATION','ANTI_CATABOLIC','LEUCINE_METABOLITE'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['creatine','carnitine']
  },
  bcaa: {
    targetSystems: ['musculoskeletal'],
    targetMechanisms: ['MPS_STIMULATION','LEUCINE_ACTIVATION','ENERGY_SUPPLY','FATIGUE_REDUCTION'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['creatine','hmb']
  },
  tryptophan: {
    targetSystems: ['neuro','endocrine'],
    targetMechanisms: ['SEROTONIN_SYNTHESIS','MELATONIN_PRECURSOR','MOOD_REGULATION','SLEEP_PROMOTION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['5htp','magnesium']
  },
  tyrosine: {
    targetSystems: ['neuro','endocrine'],
    targetMechanisms: ['DOPAMINE_SYNTHESIS','NOREPINEPHRINE_SYNTHESIS','COGNITIVE_ENHANCEMENT','STRESS_RESILIENCE'],
    linkedRisks: [{system:'neuro',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'},
    analog:['phenylalanine','rhodiola']
  },
  theanine: {
    targetSystems: ['neuro'],
    targetMechanisms: ['GABA_MODULATION','RELAXATION','FOCUS_ENHANCEMENT','ALPHA_WAVE_INDUCTION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','taurine']
  },
  caffeine: {
    targetSystems: ['neuro','cardio'],
    targetMechanisms: ['ADENOSINE_ANTAGONISM','CNS_STIMULATION','ENERGY_BOOST','FOCUS_ENHANCEMENT'],
    linkedRisks: [{system:'cardio',direction:'up',strength:0.2},{system:'neuro',direction:'up',strength:0.2}],
    cvProfile: {bloodPressure:'up',heartRate:'up',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'high'},
    analog:['theanine','tyrosine']
  },
  melatonin: {
    targetSystems: ['neuro','endocrine'],
    targetMechanisms: ['CIRCADIAN_RHYTHM','SLEEP_INDUCTION','ANTIOXIDANT','IMMUNE_MODULATION'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','glycine']
  },
  holy_basil: {
    targetSystems: ['endocrine','neuro'],
    targetMechanisms: ['ADAPTOGENIC','CORTISOL_REDUCTION','ANTIOXIDANT','IMMUNE_MODULATION'],
    linkedRisks: [{system:'endocrine',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','rhodiola']
  },
  tongkat_ali: {
    targetSystems: ['endocrine','reproductive'],
    targetMechanisms: ['TESTOSTERONE_BOOST','CORTISOL_REDUCTION','LIBIDO_ENHANCEMENT','STRESS_REDUCTION'],
    linkedRisks: [{system:'endocrine',direction:'up',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','fadogia']
  },
  fadogia: {
    targetSystems: ['endocrine','reproductive'],
    targetMechanisms: ['TESTOSTERONE_BOOST','LH_STIMULATION','LIBIDO_ENHANCEMENT','MOOD_ELEVATION'],
    linkedRisks: [{system:'endocrine',direction:'up',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['tongkat_ali','ashwagandha']
  },
  shilajit: {
    targetSystems: ['endocrine','neuro','mitochondrial'],
    targetMechanisms: ['FULVIC_ACID','MITOCHONDRIAL_FUNCTION','TESTOSTERONE_SUPPORT','ENERGY_BOOST'],
    linkedRisks: [{system:'endocrine',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','tongkat_ali']
  },
  pygeum: {
    targetSystems: ['reproductive','prostate'],
    targetMechanisms: ['PROSTATE_HEALTH','URINARY_FLOW','ANTIINFLAMMATORY','BETA_SITOSTEROL'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['saw_palmetto','zinc']
  },
  saw_palmetto: {
    targetSystems: ['reproductive','prostate'],
    targetMechanisms: ['5AR_INHIBITION','DHT_BLOCKADE','PROSTATE_HEALTH','URINARY_FUNCTION'],
    linkedRisks: [{system:'reproductive',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['pygeum','zinc']
  },
  centella: {
    targetSystems: ['skin','vessels','neuro'],
    targetMechanisms: ['COLLAGEN_STIMULATION','VENOUS_TONIC','WOUND_HEALING','COGNITIVE_ENHANCEMENT'],
    linkedRisks: [{system:'vessels',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['collagen','vitamin_c']
  },
  boswellia: {
    targetSystems: ['musculoskeletal','neuro'],
    targetMechanisms: ['5LOX_INHIBITION','ANTIINFLAMMATORY','JOINT_HEALTH','IMMUNE_MODULATION'],
    linkedRisks: [{system:'musculoskeletal',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['curcumin','ginger']
  },
  bromelain: {
    targetSystems: ['musculoskeletal','immunity'],
    targetMechanisms: ['PROTEOLYTIC','ANTIINFLAMMATORY','EDEMA_REDUCTION','FIBRINOLYTIC'],
    linkedRisks: [{system:'musculoskeletal',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['curcumin','boswellia']
  },
  quercetin: {
    targetSystems: ['cardio','immunity','neuro'],
    targetMechanisms: ['ANTIOXIDANT','ANTIINFLAMMATORY','MAST_CELL_STABILIZATION','IMMUNE_MODULATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2},{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['curcumin','vitamin_c']
  },
  resveratrol: {
    targetSystems: ['cardio','neuro','metabolic'],
    targetMechanisms: ['SIRT1_ACTIVATION','ANTIOXIDANT','ANTIINFLAMMATORY','LONGEVITY'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['quercetin','curcumin']
  },
  pqq: {
    targetSystems: ['cardio','neuro','mitochondrial'],
    targetMechanisms: ['MITOCHONDRIAL_BIOGENESIS','ANTIOXIDANT','ENERGY_METABOLISM','NEUROPROTECTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['coq10','alpha_lipoic']
  },
  astaxanthin: {
    targetSystems: ['cardio','neuro','skin'],
    targetMechanisms: ['POTENT_ANTIOXIDANT','MEMBRANE_PROTECTION','SKIN_PROTECTION','EYE_HEALTH'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['coq10','vitamin_e']
  },
  lutein: {
    targetSystems: ['neuro','skin'],
    targetMechanisms: ['EYE_PROTECTION','MACULA_SUPPORT','ANTIOXIDANT','BLUE_LIGHT_FILTER'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['astaxanthin','zeaxanthin']
  },
  lycopene: {
    targetSystems: ['cardio','prostate','skin'],
    targetMechanisms: ['ANTIOXIDANT','PROSTATE_PROTECTION','SKIN_PROTECTION','CARDIO_PROTECTION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['astaxanthin','lutein']
  },
  zeaxanthin: {
    targetSystems: ['neuro'],
    targetMechanisms: ['EYE_PROTECTION','MACULA_SUPPORT','ANTIOXIDANT','BLUE_LIGHT_FILTER'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['lutein','astaxanthin']
  },
  hyaluronic: {
    targetSystems: ['musculoskeletal','skin'],
    targetMechanisms: ['HYDRATION','JOINT_LUBRICATION','SKIN_ELASTICITY','TISSUE_REPAIR'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['collagen','msm']
  },
  gaba: {
    targetSystems: ['neuro'],
    targetMechanisms: ['GABA_AGONISM','RELAXATION','SLEEP_PROMOTION','ANXIOLYTIC'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','theanine']
  },
  dlpa: {
    targetSystems: ['neuro'],
    targetMechanisms: ['OPIOID_MODULATION','NMDA_MODULATION','MOOD_ELEVATION','ANALGESIC'],
    linkedRisks: [{system:'neuro',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'},
    analog:['tyrosine','rhodiola']
  },
  sam_e: {
    targetSystems: ['neuro','hepatic'],
    targetMechanisms: ['METHYL_DONATION','MOOD_ENHANCEMENT','LIVER_DETOX','JOINT_HEALTH'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['folate','vitamin_b12']
  },
  niacinamide: {
    targetSystems: ['skin','neuro','cardio'],
    targetMechanisms: ['NAD_PRECURSOR','SKIN_HEALTH','ANTIINFLAMMATORY','SIRT1_ACTIVATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b3','nmn']
  },
  nmn: {
    targetSystems: ['neuro','cardio','metabolic'],
    targetMechanisms: ['NAD_SYNTHESIS','MITO_REPAIR','LONGEVITY','ENERGY_METABOLISM'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['niacinamide','resveratrol']
  },
  '5htp': {
    targetSystems: ['neuro'],
    targetMechanisms: ['SEROTONIN_SYNTHESIS','MOOD_REGULATION','SLEEP_PROMOTION','APPETITE_CONTROL'],
    linkedRisks: [{system:'neuro',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['tryptophan','magnesium']
  },
  potassium: {
    targetSystems: ['cardio','renal','musculoskeletal'],
    targetMechanisms: ['ELECTROLYTE_BALANCE','BP_REGULATION','MUSCLE_FUNCTION','HEART_RHYTHM'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','calcium']
  },
  calcium: {
    targetSystems: ['musculoskeletal','cardio','neuro'],
    targetMechanisms: ['BONE_MINERALIZATION','MUSCLE_CONTRACTION','NERVE_TRANSMISSION','COAGULATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.05}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['magnesium','vitamin_d3']
  },
  chromium: {
    targetSystems: ['metabolic','endocrine'],
    targetMechanisms: ['INSULIN_SENSITIVITY','GLUCOSE_UPTAKE','LIPID_METABOLISM','APPETITE_CONTROL'],
    linkedRisks: [{system:'metabolic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['berberine','cinnamon']
  },
  cinnamon: {
    targetSystems: ['metabolic','cardio'],
    targetMechanisms: ['INSULIN_SENSITIVITY','GLUCOSE_LOWERING','ANTIOXIDANT','ANTIINFLAMMATORY'],
    linkedRisks: [{system:'metabolic',direction:'down',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['berberine','chromium']
  },
  iodine: {
    targetSystems: ['endocrine','thyroid'],
    targetMechanisms: ['THYROID_HORMONE_SYNTHESIS','METABOLISM_REGULATION','BREAST_HEALTH','DETOXIFICATION'],
    linkedRisks: [{system:'thyroid',direction:'up',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['selenium','zinc']
  },
  coenzyme_a: {
    targetSystems: ['metabolic','endocrine'],
    targetMechanisms: ['ACETYLATION','ENERGY_METABOLISM','FATTY_ACID_SYNTHESIS','NEUROTRANSMITTER_SYNTHESIS'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['vitamin_b5','carnitine']
  },
  dong_quai: {
    targetSystems: ['endocrine','hematologic'],
    targetMechanisms: ['BLOOD_TONIC','HORMONAL_BALANCE','ANTIINFLAMMATORY','CIRCULATION'],
    linkedRisks: [{system:'endocrine',direction:'down',strength:0.05}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','holy_basil']
  },
  maca: {
    targetSystems: ['endocrine','reproductive','neuro'],
    targetMechanisms: ['LIBIDO_ENHANCEMENT','ENERGY_BOOST','HORMONAL_BALANCE','MOOD_ENHANCEMENT'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['ashwagandha','tongkat_ali']
  },
  tribulus: {
    targetSystems: ['endocrine','reproductive'],
    targetMechanisms: ['TESTOSTERONE_BOOST','LIBIDO_ENHANCEMENT','LH_STIMULATION','STRENGTH_INCREASE'],
    linkedRisks: [{system:'endocrine',direction:'up',strength:0.1}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['tongkat_ali','maca']
  },
  boron: {
    targetSystems: ['endocrine','musculoskeletal'],
    targetMechanisms: ['SHBG_REDUCTION','TESTOSTERONE_BOOST','BONE_HEALTH','VITAMIN_D_METABOLISM'],
    linkedRisks: [{system:'endocrine',direction:'up',strength:0.2}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['zinc','selenium']
  },
  collagen_hydrolyzed: {
    targetSystems: ['musculoskeletal','skin'],
    targetMechanisms: ['COLLAGEN_SYNTHESIS','JOINT_HEALTH','SKIN_ELASTICITY','TENDON_STRENGTH'],
    linkedRisks: [],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['collagen','msm']
  },
  coq10_ubiquinol: {
    targetSystems: ['cardio','renal','hepatic'],
    targetMechanisms: ['ELECTRON_TRANSPORT_CHAIN','ANTIOXIDANT','ATP_PRODUCTION','MEMBRANE_STABILIZATION'],
    linkedRisks: [{system:'cardio',direction:'down',strength:0.3}],
    cvProfile: {bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'},
    analog:['coq10','alpha_lipoic']
  },

  // ═══════════════════════════════════════════════════════════════════
  // ADDITIONAL UNIQUE SUPPLEMENTS (not in core/standard above)
  // ═══════════════════════════════════════════════════════════════════

  arginine: { targetSystems:['cardio','vessels'], targetMechanisms:['NO_SYNTHESIS','VASODILATION','BLOOD_FLOW'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['citrulline','agmatine'] },
  citrulline: { targetSystems:['cardio','vessels'], targetMechanisms:['NO_BOOST','ARGININE_CONVERSION','VASODILATION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['arginine','agmatine'] },
  agmatine: { targetSystems:['cardio','neuro'], targetMechanisms:['NO_BOOST','NMDA_BLOCK','MOOD_ENHANCEMENT'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['arginine','citrulline'] },
  methionine: { targetSystems:['hepatic','neuro'], targetMechanisms:['METHYLATION','SAM_PRECURSOR','LIPID_METABOLISM'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['betaine','choline'] },
  lysine: { targetSystems:['immunity','skin'], targetMechanisms:['COLLAGEN_CROSS_LINKING','IMMUNE_SUPPORT','HERPES_PREVENTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['proline','vitamin_c'] },
  proline: { targetSystems:['skin','musculoskeletal'], targetMechanisms:['COLLAGEN_SYNTHESIS','WOUND_HEALING','JOINT_HEALTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['lysine','glycine'] },
  serine: { targetSystems:['neuro'], targetMechanisms:['SPHINGOLIPID_SYNTHESIS','NEUROPROTECTION','MEMBRANE_FLUIDITY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['glycine','theanine'] },
  threonine: { targetSystems:['skin','musculoskeletal'], targetMechanisms:['COLLAGEN_SYNTHESIS','ELASTIN_FORMATION','IMMUNE_FUNCTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['lysine','proline'] },
  histidine: { targetSystems:['immunity','neuro'], targetMechanisms:['HISTAMINE_PRECURSOR','IMMUNE_RESPONSE','TISSUE_REPAIR'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['beta_alanine','carnosine'] },
  alanine: { targetSystems:['musculoskeletal','metabolic'], targetMechanisms:['GLUCOSE_ALANINE_CYCLE','ENERGY_METABOLISM','GLUCONEOGENESIS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['glutamine','glycine'] },
  aspartate: { targetSystems:['neuro','metabolic'], targetMechanisms:['NMDA_AGONIST','ENERGY_METABOLISM','UREA_CYCLE'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['glutamate','theanine'] },
  ornithine: { targetSystems:['metabolic','hepatic'], targetMechanisms:['UREA_CYCLE','AMMONIA_DETOX','GH_RELEASE'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['arginine','citrulline'] },
  cysteine: { targetSystems:['hepatic','neuro'], targetMechanisms:['GLUTATHIONE_PRECURSOR','ANTIOXIDANT','DETOXIFICATION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nac','methionine'] },
  lions_mane: { targetSystems:['neuro'], targetMechanisms:['NGF_STIMULATION','NEUROGENESIS','COGNITIVE_ENHANCEMENT','NERVE_REPAIR'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['bacopa','noopept'] },
  bacopa: { targetSystems:['neuro'], targetMechanisms:['MEMORY_ENHANCEMENT','ANTIOXIDANT','ACETYLCHOLINE_MODULATION','ANXIOLYTIC'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['lions_mane','ginkgo'] },
  ginkgo: { targetSystems:['neuro','vessels'], targetMechanisms:['BLOOD_FLOW_INCREASE','COGNITIVE_ENHANCEMENT','ANTIOXIDANT','PLATELET_INHIBITION'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1},{system:'vessels',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'medium',cnsLoad:'low'}, analog:['bacopa','vinpocetine'] },
  vinpocetine: { targetSystems:['neuro','vessels'], targetMechanisms:['CEREBRAL_BLOOD_FLOW','VASODILATION','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ginkgo','bacopa'] },
  noopept: { targetSystems:['neuro'], targetMechanisms:['NMDA_MODULATION','BDNF_INCREASE','COGNITIVE_ENHANCEMENT','MEMORY_FORMATION'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['piracetam','lions_mane'] },
  piracetam: { targetSystems:['neuro'], targetMechanisms:['ACETYLCHOLINE_MODULATION','MEMORY_ENHANCEMENT','NEUROPLASTICITY'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['noopept','aniracetam'] },
  aniracetam: { targetSystems:['neuro'], targetMechanisms:['AMPA_MODULATION','COGNITIVE_ENHANCEMENT','ANXIOLYTIC'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['piracetam','noopept'] },
  oxiracetam: { targetSystems:['neuro'], targetMechanisms:['AMPA_MODULATION','MEMORY_ENHANCEMENT','FOCUS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['piracetam','aniracetam'] },
  pramiracetam: { targetSystems:['neuro'], targetMechanisms:['CHOLINE_UPTAKE','MEMORY_FORMATION','FOCUS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['piracetam','oxiracetam'] },
  citicoline: { targetSystems:['neuro'], targetMechanisms:['ACETYLCHOLINE_PRECURSOR','MEMBRANE_SYNTHESIS','COGNITIVE_ENHANCEMENT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['alpha_gpc','phosphatidylcholine'] },
  alpha_gpc: { targetSystems:['neuro'], targetMechanisms:['ACETYLCHOLINE_PRECURSOR','GH_RELEASE','COGNITIVE_ENHANCEMENT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['citicoline','phosphatidylcholine'] },
  phosphatidylserine: { targetSystems:['neuro','endocrine'], targetMechanisms:['CORTISOL_REDUCTION','MEMBRANE_FLUIDITY','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['phosphatidylcholine','ashwagandha'] },
  huperzine_a: { targetSystems:['neuro'], targetMechanisms:['ACHE_INHIBITION','ACETYLCHOLINE_UP','MEMORY_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['citicoline','alpha_gpc'] },
  semax: { targetSystems:['neuro'], targetMechanisms:['BDNF_INCREASE','COGNITIVE_ENHANCEMENT','NEUROPROTECTION'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['lions_mane','noopept'] },
  selank: { targetSystems:['neuro'], targetMechanisms:['GABA_MODULATION','ANXIOLYTIC','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['semax','theanine'] },
  bpc157: { targetSystems:['musculoskeletal','neuro','hepatic'], targetMechanisms:['TISSUE_REPAIR','ANGIOGENESIS','GASTROPROTECTION','TENDON_HEALING'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['tb500','ghk_cu'] },
  tb500: { targetSystems:['musculoskeletal'], targetMechanisms:['ACTIN_POLYMERIZATION','TISSUE_REPAIR','WOUND_HEALING'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['bpc157','ghk_cu'] },
  ghk_cu: { targetSystems:['skin','musculoskeletal'], targetMechanisms:['COPPER_PEPTIDE','COLLAGEN_SYNTHESIS','WOUND_HEALING','SKIN_REPAIR'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['bpc157','collagen'] },
  'ss-31': { targetSystems:['cardio','neuro','mitochondrial'], targetMechanisms:['MITOCHONDRIAL_PROTECTION','CARDIOLIPIN_STABILIZATION','ROS_REDUCTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['mots_c','coq10'] },
  mots_c: { targetSystems:['metabolic','mitochondrial'], targetMechanisms:['AMPK_ACTIVATION','MITOCHONDRIAL_FUNCTION','INSULIN_SENSITIVITY'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ss31','coq10'] },
  d_aspartic_acid: { targetSystems:['endocrine','reproductive'], targetMechanisms:['LH_STIMULATION','TESTOSTERONE_BOOST','FERTILITY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['zinc','boron'] },
  dhea: { targetSystems:['endocrine','neuro'], targetMechanisms:['ANDROGEN_PRECURSOR','NEUROSTEROID','IMMUNE_MODULATION','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.2},{system:'reproductive',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['pregnenolone','testosterone'] },
  pregnenolone: { targetSystems:['endocrine','neuro'], targetMechanisms:['NEUROSTEROID_PRECURSOR','HORMONAL_BALANCE','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['dhea','pregnenolone'] },
  egcg: { targetSystems:['cardio','metabolic','neuro'], targetMechanisms:['ANTIOXIDANT','FAT_OXIDATION','THERMOGENESIS','CATECHIN_ACTIVITY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','curcumin'] },
  fisetin: { targetSystems:['cardio','neuro'], targetMechanisms:['SENOLYTIC','ANTIOXIDANT','ANTIINFLAMMATORY','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','resveratrol'] },
  sulforaphane: { targetSystems:['hepatic','neuro','cardio'], targetMechanisms:['NRF2_ACTIVATION','ANTIOXIDANT','DETOXIFICATION','PHASE2_ENZYME_INDUCTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2},{system:'hepatic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['curcumin','alpha_lipoic'] },
  grape_seed_extract: { targetSystems:['cardio','vessels','skin'], targetMechanisms:['OLIGOMERIC_PROANTHOCYANIDINS','ANTIOXIDANT','COLLAGEN_PROTECTION','VENOUS_TONIC'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['pycnogenol','pine_bark'] },
  pycnogenol: { targetSystems:['cardio','vessels','skin'], targetMechanisms:['PINE_BARK_EXTRACT','ANTIOXIDANT','COLLAGEN_PROTECTION','CIRCULATION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['grape_seed_extract','pine_bark'] },
  pomegranate: { targetSystems:['cardio','vessels'], targetMechanisms:['PUNICALAGIN','ANTIOXIDANT','NO_BOOST','CARDIO_PROTECTION','TESTOSTERONE_SUPPORT'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['grape_seed_extract','beetroot'] },
  nattokinase: { targetSystems:['cardio','blood'], targetMechanisms:['FIBRINOLYTIC','BLOOD_THINNING','BP_REDUCTION','THROMBUS_PREVENTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2},{system:'blood',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['aspirin','omega3'] },
  astragalus: { targetSystems:['immunity','renal','cardio'], targetMechanisms:['IMMUNE_STIMULATION','TELOMERASE_ACTIVATION','ANTIOXIDANT','CARDIOPROTECTION','RENOPROTECTION'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['echinacea','astragalus'] },
  cordyceps: { targetSystems:['renal','immunity','musculoskeletal'], targetMechanisms:['ATP_PRODUCTION','OXYGEN_UTILIZATION','ENDURANCE','IMMUNE_MODULATION','KIDNEY_FUNCTION'], linkedRisks:[{system:'renal',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['reishi','shiitake'] },
  reishi: { targetSystems:['immunity','neuro','endocrine'], targetMechanisms:['IMMUNE_MODULATION','ADAPTOGENIC','ANTIOXIDANT','SLEEP_PROMOTION'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['cordyceps','ashwagandha'] },
  shiitake: { targetSystems:['immunity','cardio'], targetMechanisms:['LENTINAN','BETA_GLUCAN','IMMUNE_STIMULATION','CHOLESTEROL_LOWERING'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['reishi','cordyceps'] },
  maitake: { targetSystems:['immunity','metabolic'], targetMechanisms:['BETA_GLUCAN','IMMUNE_STIMULATION','BLOOD_SUGAR_CONTROL'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['reishi','cordyceps'] },
  chaga: { targetSystems:['immunity','hepatic'], targetMechanisms:['BETULINIC_ACID','ANTIOXIDANT','IMMUNE_MODULATION','GUT_HEALTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['reishi','cordyceps'] },
  betaine: { targetSystems:['hepatic','neuro','cardio'], targetMechanisms:['METHYL_DONATION','HOMOCYSTEINE_LOWERING','LIVER_PROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['trimethylglycine','folate'] },
  mct: { targetSystems:['metabolic','neuro'], targetMechanisms:['KETONE_PRODUCTION','ENERGY_SOURCE','COGNITIVE_ENHANCEMENT','WEIGHT_MANAGEMENT'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['coconut_oil','bhb_salts'] },
  ecdysterone: { targetSystems:['musculoskeletal'], targetMechanisms:['PHYTOSECDYSTEROID','PROTEIN_SYNTHESIS','STRENGTH_INCREASE','ESTROGEN_RECEPTOR_BETA'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['creatine','bcaa'] },
  ursolic_acid: { targetSystems:['musculoskeletal','metabolic'], targetMechanisms:['PROTEIN_SYNTHESIS','FAT_LOSS','MUSCLE_PRESERVATION','AMPK_ACTIVATION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ecdysterone','creatine'] },
  olive_extract: { targetSystems:['cardio','metabolic'], targetMechanisms:['HYDROXYTYROSOL','ANTIOXIDANT','BP_REDUCTION','LIPID_LOWERING'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['omega3','grape_seed_extract'] },
  artichoke: { targetSystems:['hepatic','cardio'], targetMechanisms:['CYNARIN','BILE_STIMULATION','CHOLESTEROL_LOWERING','LIVER_PROTECTION'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['milk_thistle','gentian'] },
  schisandra: { targetSystems:['hepatic','neuro','endocrine'], targetMechanisms:['ADAPTOGENIC','LIVER_PROTECTION','COGNITIVE_ENHANCEMENT','STRESS_RESILIENCE'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ashwagandha','rhodiola'] },
  magnolia: { targetSystems:['neuro','gut'], targetMechanisms:['ANXIOLYTIC','HONOKIOL','MAGNOLOL','SLEEP_PROMOTION'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ashwagandha','lemon_balm'] },
  lemon_balm: { targetSystems:['neuro','gut'], targetMechanisms:['ANXIOLYTIC','GABA_MODULATION','SLEEP_PROMOTION','DIGESTIVE_RELIEF'], linkedRisks:[{system:'neuro',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['magnolia','ashwagandha'] },
  rosemary: { targetSystems:['neuro','immunity'], targetMechanisms:['ROSEMARINIC_ACID','COGNITIVE_ENHANCEMENT','ANTIOXIDANT','CIRCULATION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ginkgo','bacopa'] },
  saffron: { targetSystems:['neuro','endocrine'], targetMechanisms:['CROCIN','SAFRANAL','MOOD_ENHANCEMENT','ANTIOXIDANT','LIBIDO'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ashwagandha','rhodiola'] },
  cranberry: { targetSystems:['renal','immunity'], targetMechanisms:['PROANTHOCYANIDINS','UTI_PREVENTION','ANTIOXIDANT','BACTERIAL_ADHESION_INHIBITION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['d_mannose','vitamin_c'] },
  butyrate: { targetSystems:['gut','immunity','metabolic'], targetMechanisms:['SCFA','GUT_HEALTH','INFLAMMATION_CONTROL','INSULIN_SENSITIVITY','HDAC_INHIBITION'], linkedRisks:[{system:'gut',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['probiotics','prebiotics'] },
  ahcc: { targetSystems:['immunity'], targetMechanisms:['NK_CELL_ACTIVATION','IMMUNE_STIMULATION','ANTIVIRAL'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['beta_glucan','reishi'] },
  andrographis: { targetSystems:['immunity','hepatic'], targetMechanisms:['ANTIINFLAMMATORY','IMMUNE_STIMULATION','LIVER_PROTECTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['echinacea','goldenseal'] },
  colostrum: { targetSystems:['immunity','gut'], targetMechanisms:['IGF1_PRECURSOR','IMMUNE_FACTORS','GUT_HEALING','PROLINE_RICH_PEPTIDE'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['probiotics','beta_glucan'] },
  beta_glucan: { targetSystems:['immunity'], targetMechanisms:['IMMUNE_STIMULATION','MACROPHAGE_ACTIVATION','NEUTROPHIL_ACTIVITY'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['probiotics','colostrum'] },
  digestive_enzymes: { targetSystems:['hepatic','gut'], targetMechanisms:['PROTEOLYSIS','LIPOLYSIS','AMYLOLYSIS','NUTRIENT_ABSORPTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['probiotics','betaine_hcl'] },
  cla: { targetSystems:['metabolic','immunity'], targetMechanisms:['FAT_OXIDATION','LIPOLYSIS','IMMUNE_MODULATION','BODY_COMPOSITION'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['omega3','conjugated_linoleic'] },
  leucine: { targetSystems:['musculoskeletal','metabolic'], targetMechanisms:['MPS_STIMULATION','MTOR_ACTIVATION','PROTEIN_SYNTHESIS','INSULIN_RELEASE'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['bcaa','hmb'] },
  isoleucine: { targetSystems:['musculoskeletal'], targetMechanisms:['BCAA_METABOLISM','ENERGY_PRODUCTION','GLUCOSE_UPTAKE','MUSCLE_REPAIR'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['leucine','valine'] },
  valine: { targetSystems:['musculoskeletal'], targetMechanisms:['BCAA_METABOLISM','ENERGY_PRODUCTION','MUSCLE_REPAIR','NITROGEN_BALANCE'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['leucine','isoleucine'] },
  glutamic_acid: { targetSystems:['neuro','metabolic'], targetMechanisms:['EXCITATORY_NEUROTRANSMITTER','METABOLISM','AMMONIA_DETOX'], linkedRisks:[{system:'neuro',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['glutamine','gaba'] },
  nopal: { targetSystems:['metabolic','hepatic'], targetMechanisms:['FIBER_SOURCE','BLOOD_SUGAR_CONTROL','LIPID_LOWERING','LIVER_PROTECTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['psyllium','glucomannan'] },
  glucomannan: { targetSystems:['metabolic','cardio'], targetMechanisms:['SOLUBLE_FIBER','WEIGHT_MANAGEMENT','CHOLESTEROL_LOWERING','SATIETY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['psyllium','nopal'] },
  psyllium: { targetSystems:['cardio','metabolic'], targetMechanisms:['SOLUBLE_FIBER','CHOLESTEROL_LOWERING','BLOOD_SUGAR_CONTROL'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['glucomannan','nopal'] },
  acetyl_l_carnitine: { targetSystems:['cardio','neuro','metabolic'], targetMechanisms:['MITOCHONDRIAL_FUNCTION','ACETYL_TRANSPORT','ENERGY','COGNITIVE_ENHANCEMENT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['l_carnitine','alpha_lipoic'] },
  eaa: { targetSystems:['musculoskeletal'], targetMechanisms:['MPS_STIMULATION','COMPLETE_PROTEIN_SYNTHESIS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['bcaa','whey_protein'] },
  apigenin: { targetSystems:['neuro','cardio'], targetMechanisms:['ANXIOLYTIC','GABA_MODULATION','ANTIOXIDANT','ANTIINFLAMMATORY','BDNF_INCREASE'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['theanine','magnesium'] },
  baicalin: { targetSystems:['neuro','hepatic'], targetMechanisms:['ANTIOXIDANT','ANTIINFLAMMATORY','COGNITIVE_ENHANCEMENT','LIVER_PROTECTION','GABA_MODULATION'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['curcumin','quercetin'] },
  bromantane: { targetSystems:['neuro'], targetMechanisms:['ANXIOLYTIC','STIMULATION','DOPAMINE_MODULATION','FATIGUE_REDUCTION','ADAPTOGENIC'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['rhodiola','lions_mane'] },
  biotin: { targetSystems:['skin','hepatic','neuro'], targetMechanisms:['CARBOXYLASE_SUPPORT','SKIN_HEALTH','HAIR_GROWTH','NAIL_STRENGTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['vitamin_b5','zinc'] },
  carnosine: { targetSystems:['musculoskeletal','neuro','cardio'], targetMechanisms:['CARNOSINE_SYNTHESIS','ANTIOXIDANT','ANTI_GLYCATION','BUFFER_CAPACITY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['beta_alanine','carnitine'] },
  c60: { targetSystems:['cardio','neuro','metabolic'], targetMechanisms:['ANTIOXIDANT','LONGEVITY','MITOCHONDRIAL_PROTECTION','ROS_SCAVENGING'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['coq10','astaxanthin'] },
  ceramides: { targetSystems:['skin'], targetMechanisms:['SKIN_BARRIER','MOISTURE_RETENTION','SKIN_REPAIR','ANTIINFLAMMATORY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['collagen','hyaluronic'] },
  cissus: { targetSystems:['musculoskeletal'], targetMechanisms:['JOINT_HEALTH','ANTIINFLAMMATORY','BONE_DENSITY','ANALGESIC'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['curcumin','boswellia'] },
  citrus_bioflavonoids: { targetSystems:['cardio','vessels','immunity'], targetMechanisms:['VITAMIN_C_SYNERGY','ANTIOXIDANT','VENOUS_TONIC','CAPILLARY_STRENGTH'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['vitamin_c','grape_seed_extract'] },
  cocoa_flavanols: { targetSystems:['cardio','neuro'], targetMechanisms:['FLAVANOL_ACTIVITY','NO_BOOST','BP_REDUCTION','COGNITIVE_ENHANCEMENT','ANTIOXIDANT'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['grape_seed_extract','green_tea'] },
  coluracetam: { targetSystems:['neuro'], targetMechanisms:['CHOLINE_UPTAKE','COGNITIVE_ENHANCEMENT','MEMORY','FOCUS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['piracetam','citicoline'] },
  dsip: { targetSystems:['neuro'], targetMechanisms:['SLEEP_INDUCTION','DELTA_SLEEP','CORTISOL_REDUCTION','MELATONIN_SYNERGY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['melatonin','magnesium'] },
  elastin: { targetSystems:['skin','vessels'], targetMechanisms:['ELASTICITY','SKIN_FIRMNESS','VASCULAR_ELASTICITY','TISSUE_REPAIR'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['collagen','hyaluronic'] },
  ellagic_acid: { targetSystems:['cardio','skin'], targetMechanisms:['ANTIOXIDANT','CHEMOPROTECTION','SKIN_PROTECTION','ANTIINFLAMMATORY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','resveratrol'] },
  fasoracetam: { targetSystems:['neuro'], targetMechanisms:['GABA_MODULATION','COGNITIVE_ENHANCEMENT','MEMORY','FOCUS','ANXIOLYTIC'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['aniracetam','noopept'] },
  fiber: { targetSystems:['metabolic','cardio','gut'], targetMechanisms:['SOLUBLE_FIBER','CHOLESTEROL_LOWERING','BLOOD_SUGAR_CONTROL','REGULARITY','SATIETY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['psyllium','glucomannan'] },
  flavonoids: { targetSystems:['cardio','neuro','vessels'], targetMechanisms:['ANTIOXIDANT','ANTIINFLAMMATORY','VASODILATION','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','citrus_bioflavonoids'] },
  glutathione: { targetSystems:['hepatic','neuro','immunity'], targetMechanisms:['MASTER_ANTIOXIDANT','DETOXIFICATION','IMMUNE_FUNCTION','MITOCHONDRIAL_SUPPORT'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.3},{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nac','alpha_lipoic'] },
  gotu_kola: { targetSystems:['neuro','skin','vessels'], targetMechanisms:['COGNITIVE_ENHANCEMENT','VENOUS_TONIC','WOUND_HEALING','ANXIOLYTIC','COLLAGEN_STIMULATION'], linkedRisks:[{system:'vessels',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ginkgo','bacopa'] },
  hmo_prebiotics: { targetSystems:['gut','immunity'], targetMechanisms:['PREBIOTIC','BIFIDOBACTERIUM_FEEDING','IMMUNE_MODULATION','GUT_BARRIER'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['prebiotics','probiotics'] },
  l_dopa: { targetSystems:['neuro','endocrine'], targetMechanisms:['DOPAMINE_PRECURSOR','PROLACTIN_REDUCTION','GH_RELEASE','MOOD_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['tyrosine','mucuna'] },
  licorice: { targetSystems:['endocrine','hepatic','immunity'], targetMechanisms:['GLYCRRHIZIN','CORTISOL_MODULATION','ANTIINFLAMMATORY','LIVER_PROTECTION','EXPECTORANT'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.2},{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'up',heartRate:'neutral',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ashwagandha','rhodiola'] },
  manganese: { targetSystems:['musculoskeletal','neuro','metabolic'], targetMechanisms:['BONE_FORMATION','ANTIOXIDANT','GLUCOSE_METABOLISM','COFACTOR_SOD'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['zinc','magnesium'] },
  mangosteen: { targetSystems:['immunity','cardio','skin'], targetMechanisms:['XANTHONES','ANTIOXIDANT','ANTIINFLAMMATORY','IMMUNE_STIMULATION','SKIN_PROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['resveratrol','quercetin'] },
  memantine: { targetSystems:['neuro'], targetMechanisms:['NMDA_ANTAGONISM','COGNITIVE_ENHANCEMENT','NEUROPROTECTION','MEMORY'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['noopept','piracetam'] },
  molybdenum: { targetSystems:['hepatic','metabolic'], targetMechanisms:['COFACTOR_SULFITE_OXIDASE','URIC_ACID_METABOLISM','DETOXIFICATION','ENZYME_COFACTOR'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['selenium','chromium'] },
  neurosteroid: { targetSystems:['neuro','endocrine'], targetMechanisms:['GABA_MODULATION','NEUROSTEROID_ACTIVITY','ANXIOLYTIC','COGNITIVE'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['pregnenolone','dhea'] },
  nobiletin: { targetSystems:['cardio','neuro','metabolic'], targetMechanisms:['ANTIOXIDANT','COGNITIVE_ENHANCEMENT','ANTIINFLAMMATORY','AMPK_ACTIVATION','NEUROPROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['resveratrol','quercetin'] },
  oxytocin: { targetSystems:['neuro','endocrine'], targetMechanisms:['SOCIAL_BONDING','STRESS_REDUCTION','PAIN_MODULATION','TRUST_AND_EMPATHY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['pregnenolone','dhea'] },
  p21: { targetSystems:['neuro','cardio','mitochondrial'], targetMechanisms:['MITOCHONDRIAL_FUNCTION','LONGEVITY','CELLULAR_REPAIR','ANTIOXIDANT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ss31','mots_c'] },
  pectin: { targetSystems:['metabolic','gut'], targetMechanisms:['SOLUBLE_FIBER','CHOLESTEROL_LOWERING','BLOOD_SUGAR_CONTROL','PREBIOTIC'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['psyllium','glucomannan'] },
  phenibut: { targetSystems:['neuro'], targetMechanisms:['GABA_B_AGONIST','ANXIOLYTIC','SLEEP_PROMOTION','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['gaba','theanine'] },
  phosphorus: { targetSystems:['musculoskeletal','metabolic'], targetMechanisms:['BONE_MINERALIZATION','ATP_SYNTHESIS','PHOSPHOLIPID_FORMATION','PH_BUFFERING'], linkedRisks:[{system:'renal',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['calcium','magnesium'] },
  polyphenol_complex: { targetSystems:['cardio','neuro','immunity'], targetMechanisms:['POLYPHENOL_ACTIVITY','ANTIOXIDANT','ANTIINFLAMMATORY','COGNITIVE_ENHANCEMENT','CARDIO_PROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['resveratrol','quercetin'] },
  pt141: { targetSystems:['neuro','endocrine'], targetMechanisms:['MELANOCORTIN_AGONIST','LIBIDO_ENHANCEMENT','MOOD_ELEVATION','APPETITE_SUPPRESSION'], linkedRisks:[{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'up',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['melanotan2','oxytocin'] },
  resistant_starch: { targetSystems:['gut','metabolic'], targetMechanisms:['PREBIOTIC','SCFA_PRODUCTION','BLOOD_SUGAR_CONTROL','INSULIN_SENSITIVITY','GUT_HEALTH'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['prebiotics','fiber'] },
  s_adenosyl_methionine: { targetSystems:['neuro','hepatic'], targetMechanisms:['METHYL_DONATION','MOOD_ENHANCEMENT','LIVER_DETOX','JOINT_HEALTH'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['folate','vitamin_b12'] },
  selegiline: { targetSystems:['neuro'], targetMechanisms:['MAOB_INHIBITION','DOPAMINE_UP','NEUROPROTECTION','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'up',heartRate:'up',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['deprenyl','rasagiline'] },
  silicon: { targetSystems:['skin','musculoskeletal','vessels'], targetMechanisms:['COLLAGEN_SYNTHESIS','BONE_DENSITY','SKIN_ELASTICITY','VASCULAR_HEALTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['silica','collagen'] },
  sodium: { targetSystems:['cardio','renal','musculoskeletal'], targetMechanisms:['ELECTROLYTE_BALANCE','NERVE_CONDUCTION','MUSCLE_CONTRACTION','HYDRATION'], linkedRisks:[{system:'cardio',direction:'up',strength:0.2},{system:'renal',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'up',heartRate:'neutral',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'low'}, analog:['potassium','magnesium'] },
  soy_isoflavones: { targetSystems:['endocrine','cardio','prostate'], targetMechanisms:['PHYTOESTROGEN','ANTIOXIDANT','CHOLESTEROL_LOWERING','BONE_HEALTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['red_clover','dhea'] },
  strontium: { targetSystems:['musculoskeletal'], targetMechanisms:['BONE_DENSITY','OSTEOBLAST_STIMULATION','CALCIUM_DEPOSITION','FRACTURE_PREVENTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['calcium','vitamin_d3'] },
  taxifolin: { targetSystems:['cardio','neuro'], targetMechanisms:['ANTIOXIDANT','ANTIINFLAMMATORY','COGNITIVE_ENHANCEMENT','VASCULAR_PROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','resveratrol'] },
  tianeptine: { targetSystems:['neuro'], targetMechanisms:['SEROTONIN_MODULATION','ANXIOLYTIC','MOOD_ENHANCEMENT','COGNITIVE'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['sertraline','phenibut'] },
  trace_minerals: { targetSystems:['endocrine','metabolic','neuro'], targetMechanisms:['TRACE_ELEMENT_SUPPLEMENT','ENZYME_COFACTOR','ELECTROLYTE_BALANCE','METABOLIC_SUPPORT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['colloidal_minerals','electrolyte_complex'] },
  urolithin_a: { targetSystems:['musculoskeletal','neuro','mitochondrial'], targetMechanisms:['MITOCHONDRIAL_AUTOPHAGY','MITOPHAGY','LONGEVITY','MUSCLE_HEALTH'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['pterostilbene','resveratrol'] },
  vanadium: { targetSystems:['metabolic','musculoskeletal'], targetMechanisms:['INSULIN_MIMETIC','GLUCOSE_UPTAKE','BONE_DENSITY','CHOLESTEROL_LOWERING'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['chromium','berberine'] },
  vasopressin: { targetSystems:['neuro','cardio','renal'], targetMechanisms:['SOCIAL_BONDING','FOCUS','WATER_RETENTION','BP_REGULATION'], linkedRisks:[{system:'cardio',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'up',heartRate:'neutral',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'low'}, analog:['oxytocin','caffeine'] },
  zinc_carnosine: { targetSystems:['gut','immunity'], targetMechanisms:['ZINC_DELIVERY','CARNOSINE_CHELATION','GUT_HEALING','ANTIOXIDANT','MUCOSAL_PROTECTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['zinc','carnosine'] },
  anthocyanins: { targetSystems:['cardio','neuro','vessels'], targetMechanisms:['ANTHOCYANIN_ACTIVITY','ANTIOXIDANT','VASCULAR_PROTECTION','COGNITIVE_ENHANCEMENT','ANTIINFLAMMATORY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['quercetin','resveratrol'] },
  collagen_type2: { targetSystems:['musculoskeletal'], targetMechanisms:['COLLAGEN_TYPE_II','JOINT_HEALTH','CARTILAGE_REPAIR','IMMUNE_TOLERANCE'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['collagen','glucosamine'] },
  chlorella: { targetSystems:['immunity','hepatic','gut'], targetMechanisms:['CHLOROPHYLL','DETOXIFICATION','IMMUNE_STIMULATION','NUTRIENT_DENSITY','ALKALIZING'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['spirulina','wheatgrass'] },
  spirulina: { targetSystems:['immunity','cardio','metabolic'], targetMechanisms:['PHYCOCYANIN','ANTIOXIDANT','IMMUNE_STIMULATION','CHOLESTEROL_LOWERING','ANTIINFLAMMATORY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['chlorella','wheatgrass'] },
  phosphatidylserine_done: { targetSystems:['neuro'], targetMechanisms:['CORTISOL_REDUCTION','MEMBRANE_FLUIDITY','COGNITIVE_ENHANCEMENT','MEMORY'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['phosphatidylcholine','ashwagandha'] },
  agmatine_sulfate: { targetSystems:['cardio','neuro'], targetMechanisms:['NO_BOOST','NMDA_BLOCK','PUMP','MOOD_ENHANCEMENT','ANALGESIC'], linkedRisks:[{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['arginine','citrulline'] },
  beetroot: { targetSystems:['cardio','vessels'], targetMechanisms:['NITRATE_SOURCE','NO_BOOST','BP_REDUCTION','ENDURANCE_ENHANCEMENT','BLOOD_FLOW'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['arginine','citrulline'] },

  // ═══════════════════════════════════════════════════════════════════
  // MEDICATIONS (prescription & OTC for system support)
  // ═══════════════════════════════════════════════════════════════════
  hcg: { targetSystems:['endocrine','reproductive'], targetMechanisms:['LH_MIMETIC','TESTOSTERONE_PRODUCTION','LEYDIG_STIMULATION','FERTILITY_PRESERVATION'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.3},{system:'reproductive',direction:'up',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['gonadorelin','kisspeptin'] },
  anastrozole: { targetSystems:['endocrine','reproductive'], targetMechanisms:['AROMATASE_INHIBITION','E2_SUPPRESSION','ESTROGEN_BLOCKADE'], linkedRisks:[{system:'endocrine',direction:'down',strength:0.4},{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['letrozole','exemestane'] },
  letrozole: { targetSystems:['endocrine','reproductive'], targetMechanisms:['AROMATASE_INHIBITION','E2_SUPPRESSION','ESTROGEN_BLOCKADE','LH_STIMULATION'], linkedRisks:[{system:'endocrine',direction:'down',strength:0.5},{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['anastrozole','exemestane'] },
  exemestane: { targetSystems:['endocrine','reproductive'], targetMechanisms:['AROMATASE_INHIBITOR_IRREVERSIBLE','E2_SUPPRESSION','ANDROGEN_PRECURSOR'], linkedRisks:[{system:'endocrine',direction:'down',strength:0.4}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['anastrozole','letrozole'] },
  cabergoline: { targetSystems:['neuro','endocrine'], targetMechanisms:['D2_AGONIST','PROLACTIN_SUPPRESSION','DOPAMINE_MODULATION','LH_RESTORATION'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['bromocriptine','pramipexole'] },
  bromocriptine: { targetSystems:['neuro','endocrine'], targetMechanisms:['D2_AGONIST','PROLACTIN_SUPPRESSION','DOPAMINE_MODULATION'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1},{system:'cardio',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['cabergoline','pramipexole'] },
  clomiphene: { targetSystems:['endocrine','reproductive'], targetMechanisms:['SERM_ACTIVITY','LH_STIMULATION','FSH_STIMULATION','HPTA_RESTORATION','ESTROGEN_RECEPTOR_MODULATION'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.3},{system:'reproductive',direction:'up',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'medium',cnsLoad:'low'}, analog:['tamoxifen','enclomiphene'] },
  tamoxifen: { targetSystems:['endocrine','reproductive'], targetMechanisms:['SERM_ACTIVITY','ESTROGEN_RECEPTOR_ANTAGONIST','LH_STIMULATION','HPTA_RESTORATION'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.2},{system:'cardio',direction:'up',strength:0.1},{system:'blood',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'medium',cnsLoad:'low'}, analog:['clomiphene','raloxifene'] },
  enclomiphene: { targetSystems:['endocrine','reproductive'], targetMechanisms:['SERM_ACTIVITY','LH_STIMULATION','FSH_STIMULATION','HPTA_RESTORATION','PURE_ISOMER'], linkedRisks:[{system:'endocrine',direction:'up',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['clomiphene','tamoxifen'] },
  metformin: { targetSystems:['metabolic','hepatic','cardio'], targetMechanisms:['AMPK_ACTIVATION','GLUCOSE_LOWERING','INSULIN_SENSITIVITY','LIPID_LOWERING','MTO_INHIBITION'], linkedRisks:[{system:'metabolic',direction:'down',strength:0.3},{system:'hepatic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['berberine','semaglutide'] },
  finasteride: { targetSystems:['reproductive','prostate','skin'], targetMechanisms:['5AR_INHIBITION','DHT_SUPPRESSION','PROSTATE_HEALTH','HAIR_PRESERVATION'], linkedRisks:[{system:'reproductive',direction:'down',strength:0.3},{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['dutasteride','saw_palmetto'] },
  dutasteride: { targetSystems:['reproductive','prostate','skin'], targetMechanisms:['5AR_INHIBITION_TYPES_1_2','DHT_SUPPRESSION','PROSTATE_HEALTH'], linkedRisks:[{system:'reproductive',direction:'down',strength:0.4}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['finasteride','saw_palmetto'] },
  spironolactone: { targetSystems:['cardio','renal','endocrine'], targetMechanisms:['ALDOSTERONE_ANTAGONIST','K_SPARING','BP_REDUCTION','ANDROGEN_RECEPTOR_BLOCKADE','DIURETIC'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2},{system:'renal',direction:'down',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['eplerenone','amiloride'] },
  hydrochlorothiazide: { targetSystems:['cardio','renal'], targetMechanisms:['THIAZIDE_DIURETIC','BP_REDUCTION','SODIUM_EXCRETION','VOLUME_REDUCTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2},{system:'metabolic',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['indapamide','chlorthalidone'] },
  indapamide: { targetSystems:['cardio','renal'], targetMechanisms:['THIAZIDE_LIKE_DIURETIC','BP_REDUCTION','VASODILATION','SODIUM_EXCRETION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['hydrochlorothiazide','chlorthalidone'] },
  eplerenone: { targetSystems:['cardio','renal'], targetMechanisms:['SELECTIVE_ALDOSTERONE_ANTAGONIST','BP_REDUCTION','K_SPARING','HEART_FAILURE'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['spironolactone','amiloride'] },
  torsemide: { targetSystems:['cardio','renal'], targetMechanisms:['LOOP_DIURETIC','BP_REDUCTION','VOLUME_REDUCTION','EDEMA'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2},{system:'metabolic',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['furosemide','hydrochlorothiazide'] },
  bisoprolol: { targetSystems:['cardio'], targetMechanisms:['BETA1_BLOCKADE','HR_REDUCTION','BP_REDUCTION','CARDIOPROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'down',heartRate:'down',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nebivolol','atenolol'] },
  carvedilol: { targetSystems:['cardio'], targetMechanisms:['BETA_ALPHA_BLOCKADE','HR_REDUCTION','BP_REDUCTION','VASODILATION','HEART_FAILURE'], linkedRisks:[{system:'cardio',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'down',heartRate:'down',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nebivolol','bisoprolol'] },
  amlodipine: { targetSystems:['cardio','vessels'], targetMechanisms:['CALCIUM_CHANNEL_BLOCKER','VASODILATION','BP_REDUCTION','ANGINA'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nifedipine','felodipine'] },
  lisinopril: { targetSystems:['cardio','renal'], targetMechanisms:['ACE_INHIBITOR','BP_REDUCTION','RENAL_PROTECTION','HEART_FAILURE'], linkedRisks:[{system:'cardio',direction:'down',strength:0.3},{system:'renal',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['telmisartan','enalapril'] },
  losartan: { targetSystems:['cardio','renal'], targetMechanisms:['ARB_BLOCKADE','BP_REDUCTION','RENAL_PROTECTION','STROKE_PREVENTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.3},{system:'renal',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['telmisartan','valsartan'] },
  atorvastatin: { targetSystems:['cardio','hepatic'], targetMechanisms:['HMG_COA_REDUCTASE_INHIBITOR','LDL_LOWERING','CARDIO_PROTECTION','ANTIINFLAMMATORY'], linkedRisks:[{system:'cardio',direction:'down',strength:0.4},{system:'hepatic',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['rosuvastatin','simvastatin'] },
  rosuvastatin: { targetSystems:['cardio','hepatic'], targetMechanisms:['HMG_COA_REDUCTASE_INHIBITOR','LDL_LOWERING','CARDIO_PROTECTION','HDL_INCREASE'], linkedRisks:[{system:'cardio',direction:'down',strength:0.4},{system:'hepatic',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['atorvastatin','pitavastatin'] },
  ursodeoxycholic: { targetSystems:['hepatic'], targetMechanisms:['BILE_ACID_THERAPY','CHOLESTEROL_LOWERING','LIVER_PROTECTION','CHOLESTASIS'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['tudca','milk_thistle'] },
  heptral: { targetSystems:['hepatic','neuro'], targetMechanisms:['ADEMETIONINE','METHYL_DONATION','LIVER_DETOX','CHOLERETIC','ANTIDEPRESSANT'], linkedRisks:[{system:'hepatic',direction:'down',strength:0.3},{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['sam_e','nac'] },
  panangin: { targetSystems:['cardio','musculoskeletal'], targetMechanisms:['K_MG_SUPPLEMENT','ELECTROLYTE_BALANCE','ANTIARRHYTHMIC','CARDIOPROTECTION'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['magnesium','potassium'] },
  mildronate: { targetSystems:['cardio','neuro','musculoskeletal'], targetMechanisms:['FATTY_ACID_OXIDATION_INHIBITION','GLUCOSE_SHIFT','CARDIOPROTECTION','ENDURANCE'], linkedRisks:[{system:'cardio',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['carnitine','taurine'] },
  meldonium: { targetSystems:['cardio','neuro'], targetMechanisms:['GAMMA_BUTYROBETAINE_INHIBITOR','CARDIOPROTECTION','ENDURANCE_ENHANCEMENT','NEUROPROTECTION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['mildronate','carnitine'] },
  phenytoin: { targetSystems:['neuro','musculoskeletal'], targetMechanisms:['SODIUM_CHANNEL_BLOCKER','ANTICONVULSANT','NERVE_PAIN','WOUND_HEALING'], linkedRisks:[{system:'hepatic',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['carbamazepine','gabapentin'] },
  piracetam_done: { targetSystems:['neuro'], targetMechanisms:['ACETYLCHOLINE_MODULATION','MEMORY_ENHANCEMENT','NEUROPLASTICITY','CEREBRAL_BLOOD_FLOW'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['noopept','aniracetam'] },
  phenylpiracetam: { targetSystems:['neuro'], targetMechanisms:['DOPAMINE_MODULATION','COGNITIVE_ENHANCEMENT','STIMULATION','FATIGUE_RESISTANCE'], linkedRisks:[{system:'cardio',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'up',heartRate:'up',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'high'}, analog:['modafinil','piracetam'] },
  noopept_done: { targetSystems:['neuro'], targetMechanisms:['NMDA_MODULATION','BDNF_INCREASE','COGNITIVE_ENHANCEMENT','MEMORY_FORMATION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['piracetam','lions_mane'] },
  picamilon: { targetSystems:['neuro','vessels'], targetMechanisms:['GABA_NIACIN_CONJUGATE','CEREBRAL_BLOOD_FLOW','ANXIOLYTIC','VASODILATION'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['gaba','vinpocetine'] },
  mexidol: { targetSystems:['neuro','cardio'], targetMechanisms:['ANTIOXIDANT','MEMBRANE_PROTECTION','NOOTROPIC','ANTIHYPOXANT','COGNITIVE_ENHANCEMENT'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['emoxypine','cytoflavin'] },
  cytoflavin: { targetSystems:['neuro','metabolic'], targetMechanisms:['MITOCHONDRIAL_CYTOPROTECTION','ENERGY_METABOLISM','COGNITIVE_ENHANCEMENT','ANTIHYPOXANT'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['mexidol','carnitine'] },
  trental: { targetSystems:['vessels','blood'], targetMechanisms:['PENTOXIFYLLINE','BLOOD_FLOW','MICROCIRCULATION','RBC_FLEXIBILITY','ANTIINFLAMMATORY'], linkedRisks:[{system:'blood',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['nattokinase','ginkgo'] },
  actovegin: { targetSystems:['neuro','musculoskeletal'], targetMechanisms:['TISSUE_REPAIR','OXYGEN_UTILIZATION','ENERGY_METABOLISM','WOUND_HEALING'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['solcoseryl','cerebrolysin'] },
  solcoseryl: { targetSystems:['neuro','skin'], targetMechanisms:['TISSUE_REPAIR','COLLAGEN_SYNTHESIS','WOUND_HEALING','ANGIOGENESIS'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['actovegin','bpc157'] },
  pentoxifylline: { targetSystems:['vessels','blood'], targetMechanisms:['METHYLXANTHINE','BLOOD_VISCOSITY','MICROCIRCULATION','RHEOLOGY'], linkedRisks:[{system:'blood',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['trental','nattokinase'] },

  // ═══════════════════════════════════════════════════════════════════
  // GH/IGF AXIS, INSULIN AXIS, THYROID, NEUROTOXICITY — SYSTEM COVERAGE
  // ═══════════════════════════════════════════════════════════════════
  igf1: { targetSystems:['ghigf','musculoskeletal'], targetMechanisms:['IGF1_AGONISM','MUSCLE_GROWTH','PROTEIN_SYNTHESIS','CELL_DIVISION'], linkedRisks:[{system:'ghigf',direction:'up',strength:0.4}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['mk677','cjc1295'] },
  cjc1295: { targetSystems:['ghigf','endocrine'], targetMechanisms:['GHRH_AGONISM','GH_RELEASE','IGF1_PRODUCTION'], linkedRisks:[{system:'ghigf',direction:'up',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['sermorelin','mk677'] },
  mk677: { targetSystems:['ghigf','endocrine'], targetMechanisms:['GHSR_AGONISM','GH_RELEASE','IGF1_PRODUCTION','ORAL_BIOAVAILABILITY'], linkedRisks:[{system:'ghigf',direction:'up',strength:0.3},{system:'metabolic',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['cjc1295','sermorelin'] },
  ghrp6: { targetSystems:['ghigf','endocrine'], targetMechanisms:['GHSR_AGONISM','GH_RELEASE','APPETITE_STIMULATION'], linkedRisks:[{system:'ghigf',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ghrp2','ipamorelin'] },
  ipamorelin: { targetSystems:['ghigf','endocrine'], targetMechanisms:['GHSR_AGONISM','GH_RELEASE','LOW_APPETITE_STIMULATION'], linkedRisks:[{system:'ghigf',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['ghrp6','ghrp2'] },
  mgf: { targetSystems:['ghigf','musculoskeletal'], targetMechanisms:['MGF_AGONISM','SATELLITE_CELL_ACTIVATION','MUSCLE_REPAIR','HYPERTROPHY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['igf1','mechano_growth'] },
  insulin: { targetSystems:['ins_axis','metabolic','cardio'], targetMechanisms:['INSULIN_AGONISM','GLUCOSE_UPTAKE','ANABOLIC','GLYCOGEN_SYNTHESIS'], linkedRisks:[{system:'ins_axis',direction:'up',strength:0.3},{system:'metabolic',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'down',heartRate:'up',vascularTone:'dilate',thrombosisRisk:'low',cnsLoad:'low'}, analog:['metformin','berberine'] },
  semaglutide: { targetSystems:['ins_axis','metabolic','cardio'], targetMechanisms:['GLP1_AGONISM','INSULIN_RELEASE','APPETITE_SUPPRESSION','WEIGHT_LOSS'], linkedRisks:[{system:'ins_axis',direction:'down',strength:0.3},{system:'metabolic',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['tirzepatide','liraglutide'] },
  tirzepatide: { targetSystems:['ins_axis','metabolic','cardio'], targetMechanisms:['GLP1_GIP_AGONISM','INSULIN_RELEASE','APPETITE_SUPPRESSION','WEIGHT_LOSS'], linkedRisks:[{system:'ins_axis',direction:'down',strength:0.3},{system:'metabolic',direction:'down',strength:0.3}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['semaglutide','liraglutide'] },
  thyroxine: { targetSystems:['thyroid','endocrine','metabolic'], targetMechanisms:['THYROID_HORMONE','T4_REPLACEMENT','METABOLISM_INCREASE','THERMOGENESIS'], linkedRisks:[{system:'thyroid',direction:'up',strength:0.4},{system:'cardio',direction:'up',strength:0.2}], cvProfile:{bloodPressure:'up',heartRate:'up',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['liothyronine','thyroid_extract'] },
  liothyronine: { targetSystems:['thyroid','endocrine','metabolic'], targetMechanisms:['T3_AGONISM','METABOLISM_INCREASE','THERMOGENESIS','CARDIO_STIMULATION'], linkedRisks:[{system:'thyroid',direction:'up',strength:0.5},{system:'cardio',direction:'up',strength:0.3}], cvProfile:{bloodPressure:'up',heartRate:'up',vascularTone:'constrict',thrombosisRisk:'low',cnsLoad:'high'}, analog:['thyroxine','thyroid_extract'] },
  baclofen: { targetSystems:['neuro','neuro_toxicity','musculoskeletal'], targetMechanisms:['GABA_B_AGONIST','MUSCLE_RELAXANT','SPASTICITY_REDUCTION'], linkedRisks:[{system:'neuro',direction:'down',strength:0.2}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['phenibut','tizanidine'] },

  amantadine: { targetSystems:['neuro','neuro_toxicity'], targetMechanisms:['NMDA_ANTAGONIST','DOPAMINE_AGONIST','ANTIVIRAL','FATIGUE_REDUCTION'], linkedRisks:[{system:'neuro',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'medium'}, analog:['memantine','selegiline'] },
  echinacea: { targetSystems:['immunity','hematologic'], targetMechanisms:['IMMUNE_STIMULATION','NK_ACTIVATION','ANTIVIRAL','MACROPHAGE_ACTIVATION'], linkedRisks:[{system:'immunity',direction:'up',strength:0.1}], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['astragalus','andrographis'] },
  propolis: { targetSystems:['immunity','skin','gut'], targetMechanisms:['ANTIMICROBIAL','ANTIOXIDANT','IMMUNE_STIMULATION','WOUND_HEALING','ANTIINFLAMMATORY'], linkedRisks:[], cvProfile:{bloodPressure:'neutral',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'low',cnsLoad:'low'}, analog:['honey','bee_pollen'] },
};