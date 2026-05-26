export const GENETIC_MULTIPLIERS: Record<string, Record<string, number>> = {
  COMT_Val158Met: { 'Met/Met': 2.0, 'Val/Met': 1.5, 'Val/Val': 1.0 },
  MTHFR_C677T: { TT: 1.7, CT: 1.3, CC: 1.0 },
  AGTR1_A1166C: { CC: 1.4, AC: 1.2, AA: 1.0 }
};
export const DRUG_THRESHOLDS: Record<string, {dosePerWeek: number; androgenicity: number}> = {
  testosterone_enanthate: {dosePerWeek:300,androgenicity:1.0},
  trenbolone_acetate: {dosePerWeek:200,androgenicity:1.5},
  nandrolone_decanoate: {dosePerWeek:400,androgenicity:0.8},
  oxandrolone: {dosePerWeek:350,androgenicity:0.6}
};
export const SYRINGE_SPECS: Record<number, {maxVolume:number;divisionsPerMl:number}> = {
  0.3:{maxVolume:0.3,divisionsPerMl:30}, 0.5:{maxVolume:0.5,divisionsPerMl:50},
  1.0:{maxVolume:1.0,divisionsPerMl:100}, 2.0:{maxVolume:2.0,divisionsPerMl:50}, 5.0:{maxVolume:5.0,divisionsPerMl:20}
};
export const RISK_SYSTEMS = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive'];
export const BASE_RISK = 0.12;

// ТЗ §12.6, §18: Обязательные маркеры по фазам
export const REQUIRED_LABS_PER_PHASE: Record<string, string[]> = {
  baseline: ['ALT','AST','GGT','HCT','TT','E2','PRL','LH','FSH','CRP','HbA1c','FERRITIN','VITD'],
  on_cycle: ['ALT','AST','GGT','HCT','TT','E2','PRL','LH','FSH','LDL','HDL','TG','CREATININE','HOMA'],
  bridge: ['TT','E2','LH','FSH','HCT','ALT','CRP'],
  pct: ['TT','LH','FSH','E2','PRL','SHBG','IGF1'],
  post_pct: ['TT','LH','FSH','HCT','ALT','E2','SHBG'],
  course_bridge_course: ['TT','E2','LH','HCT','ALT','AST','CRP','HOMA']
};

export const REQUIRED_DIAGNOSTICS_PER_PHASE: Record<string, string[]> = {
  baseline: ['echocg','usg_obp','dexa'],
  on_cycle: ['joint_usg','echocg'],
  bridge: ['joint_mri'],
  pct: ['usg_obp'],
  post_pct: ['echocg'],
  course_bridge_course: ['joint_usg','echocg']
};

export const DIAGNOSTIC_TEMPLATES: Record<string, {name: string; keyMetrics: string[]; refRanges: Record<string, [number, number]>}> = {
  usg_obp: { name:'УЗИ ОБП', keyMetrics:['liver_size_mm','gallbladder_wall_mm','pancreas_echogenicity','spleen_size_mm'], refRanges:{liver_size_mm:[120,140], gallbladder_wall_mm:[0,3]} },
  echocg: { name:'ЭхоКГ', keyMetrics:['LVED_mm','LVES_mm','EF_percent','LV_mass_g','LA_diameter_mm','RV_sPAP_mmHg'], refRanges:{EF_percent:[50,70], LV_mass_g:[90,140]} },
  joint_usg: { name:'УЗИ суставов/связок', keyMetrics:['joint_effusion_mm','tendon_thickness_mm','bursa_fluid_mm','synovium_hypertrophy'], refRanges:{joint_effusion_mm:[0,3], tendon_thickness_mm:[2,6]} },
  joint_mri: { name:'МРТ суставов', keyMetrics:['cartilage_thickness_mm','bone_edema_score','meniscus_integrity','ligament_signal'], refRanges:{cartilage_thickness_mm:[2,4]} },
  dexa: { name:'DEXA (костная/состав)', keyMetrics:['BMD_spine','BMD_femur','T_score','body_fat_pct','visceral_fat_level'], refRanges:{T_score:[-1,1]} }
};

export const PENALTY_THRESHOLDS = {
  warning: 25, critical: 50, block_advanced: 75, max: 100
};