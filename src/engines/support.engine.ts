import { 
  EffectEntry, 
  SubstanceEntry, 
  MechanismEntry, 
  OrganEntry, 
  SystemEntry, 
  RiskEntry, 
  RecommendationEntry,
  RiskResult
} from '../core/types';
import { 
  UCUM_MAP, 
  RISK_SYSTEMS, ALL_RISK_SYSTEMS,
  BASE_RISK,
  DRUG_THRESHOLDS,
  GENETIC_MULTIPLIERS,
  SUPPORT_BASE_COVERAGE,
  COVERAGE_ID_ALIAS
} from '../core/constants';
import { MASTER_DB } from '../core/master-db';
import {
  findSubstancesByOrgan,
  findSubstancesByCategory,
  findInteractionsForSubstance,
  findSynergies,
  findConflicts,
  getSubstance,
  searchSubstances,
  ALL_SUBSTANCES,
  ALL_INTERACTIONS,
  ALL_RISKS,
  type SupportSubstance,
  type SupportInteraction,
  type SupportRisk,
} from '../data/support-database';
import { resolveCanonicalId } from '../data/support-database';
import { SUPPORT_CATALOG_DATA } from '../data/support-database';

export interface SupportInput {
  userId?: string;
  substances: string[];
  goals?: string[];
  labs?: { code: string; value: number }[];
  demographics?: {
    age: number;
    weight: number;
    sex: 'male' | 'female';
  };
  genetics?: Record<string, string>;
  nutritionFactor?: number;
  trainingFactor?: number;
  drugDoses?: Record<string, number>;
  supportDoses?: Record<string, number>;
}

export interface SupportOutput {
  riskAssessment: RiskResult;
  recommendations: RecommendationEntry[];
  supportScore: number;
  riskBeforeSupport: number;
  riskAfterSupport: number;
  systemSupport: Record<string, number>;
  organSupport: Record<string, number>;
  metadata: {
    processedSubstances: SubstanceEntry[];
    effectiveMechanisms: MechanismEntry[];
    affectedOrgans: OrganEntry[];
    affectedSystems: SystemEntry[];
  };
}

const SYSTEM_RISK_WEIGHTS: Record<string, number> = {
  cardio: 1.5,
  hepatic: 1.4,
  renal: 1.2,
  neuro: 1.0,
  endocrine: 1.3,
  hematologic: 1.1,
  reproductive: 0.8,
  musculoskeletal: 0.6
};

const NUTRITION_SYSTEM_REDUCTION: Record<string, number> = {
  cardio: 0.25, hepatic: 0.40, renal: 0.30, neuro: 0.20,
  endocrine: 0.20, hematologic: 0.25, reproductive: 0.15, musculoskeletal: 0.10
};

const TRAINING_SYSTEM_REDUCTION: Record<string, number> = {
  cardio: 0.35, hepatic: 0.10, renal: 0.15, neuro: 0.15,
  endocrine: 0.10, hematologic: 0.20, reproductive: 0.10, musculoskeletal: 0.15
};

const GENETIC_SYSTEM_MAP: Record<string, string[]> = {
  COMT_Val158Met: ['neuro', 'endocrine'],
  MTHFR_C677T: ['cardio', 'hematologic'],
  AGTR1_A1166C: ['cardio'],
  CYP3A4_22: ['hepatic'],
  NOS3_G894T: ['cardio', 'renal']
};

const AAS_SYSTEM_PROFILE: Record<string, Record<string, number>> = {
  testosterone_enanthate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  testosterone_cypionate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  testosterone_propionate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  trenbolone_acetate: { cardio: 0.20, hepatic: 0.25, renal: 0.10, neuro: 0.20, endocrine: 0.15, hematologic: 0.05, reproductive: 0.05 },
  trenbolone_enanthate: { cardio: 0.20, hepatic: 0.25, renal: 0.10, neuro: 0.20, endocrine: 0.15, hematologic: 0.05, reproductive: 0.05 },
  nandrolone_decanoate: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.25, hematologic: 0.20, reproductive: 0.30 },
  nandrolone_phenylprop: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.25, hematologic: 0.20, reproductive: 0.30 },
  boldenone_undecylenate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  methenolone_enanthate: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.35, hematologic: 0.15, reproductive: 0.25 },
  oxandrolone: { cardio: 0.10, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.15, hematologic: 0.10, reproductive: 0.15 },
  methandienone: { cardio: 0.15, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.20, hematologic: 0.05, reproductive: 0.10 },
  stanozolol: { cardio: 0.25, hepatic: 0.35, renal: 0.05, neuro: 0.05, endocrine: 0.10, hematologic: 0.10, reproductive: 0.10 },
  chlorodehydromethyltestosterone: { cardio: 0.15, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.15, hematologic: 0.10, reproductive: 0.10 },
  ostarine_mk2866: { cardio: 0.05, hepatic: 0.15, renal: 0.05, neuro: 0.05, endocrine: 0.35, hematologic: 0.05, reproductive: 0.30 },
  ligandrol_lgd4033: { cardio: 0.05, hepatic: 0.20, renal: 0.05, neuro: 0.05, endocrine: 0.40, hematologic: 0.05, reproductive: 0.20 },
  rad140: { cardio: 0.05, hepatic: 0.20, renal: 0.05, neuro: 0.10, endocrine: 0.35, hematologic: 0.05, reproductive: 0.20 },
  gh_peptide: { cardio: 0.10, hepatic: 0.05, renal: 0.10, neuro: 0.10, endocrine: 0.35, hematologic: 0.10, reproductive: 0.20 }
};

const SUPPORT_EC50: Record<string, number> = {
  telmisartan: 20,
  nebivolol: 5,
  nac: 600,
  tudca: 250,
  omega3: 1000,
  magnesium: 200,
  berberine: 500,
  coq10: 100,
  vitamin_d3: 2000,
  zinc: 15,
  hcg: 250,
  alpha_lipoic: 300,
  ashwagandha: 300,
  saw_palmetto: 320,
  celery_extract: 500,
  vitamin_k2: 45,
  selenium: 50,
  milk_thistle: 200,
  probiotics: 5,
  vitamin_b12: 50,
  vitamin_b6: 20,
  folate: 200,
  iron: 18,
  copper: 1,
  astragalus: 500,
  taurine: 500,
  melatonin: 1,
  ginseng: 200,
  egcg: 200,
  curcumin: 300,
  phosphatidylcholine: 500,
  l_carnitine: 500,
  glucosamine: 500,
  chondroitin: 400,
  msm: 500,
  collagen: 2500,
  hyaluronic: 50,
  boswellia: 200,
  vitamin_c: 250,
  bromelain: 200,
  bpc157: 250,
  tb500: 5,
  meloxicam: 7,
  diclofenac: 50,
  potassium: 150,
  electrolyte_complex: 1,
  vitamin_a: 1,
  vitamin_b1: 50,
  vitamin_b2: 5,
  vitamin_b3: 250,
  vitamin_b5: 250,
  biotin: 3,
  vitamin_e: 100,
  vitamin_b_complex: 25,
  inositol: 1000,
  betaine: 1500,
  pqq: 10,
  vitamin_complex: 1,
  pterostilbene: 125,
  prebiotics: 2500,
  glutamine: 2500,
  molybdenum: 1,
  boron: 2,
  silicon: 5,
  calcium: 250,
  sodium: 250,
  manganese: 3,
  iodine: 1,
  lithium: 1,
  vanadium: 1,
  phosphorus: 250,
  trace_minerals: 1,
  chromium: 1,
  colloidal_minerals: 8,
  strontium: 1,
  omega6: 250,
  omega7: 125,
  omega9: 1,
  cla: 1500,
  mct: 7500,
  ceramides: 1,
  butyrate: 750,
  glycine: 1500,
  theanine: 100,
  tyrosine: 250,
  tryptophan: 250,
  x5htp: 50,
  gaba: 250,
  creatine: 2500,
  beta_alanine: 1600,
  citrulline: 3000,
  arginine: 1500,
  agmatine: 500,
  bcaa: 5000,
  hmb: 1500,
  glutathione: 250,
  eaa: 5000,
  d_aspartic_acid: 1500,
  phenibut: 125,
  carnosine: 500,
  alanine: 1600,
  l_dopa: 250,
  phosphatidylserine: 150,
  methionine: 250,
  s_adenosyl_methionine: 200,
  rhodiola: 150,
  bacopa: 150,
  lions_mane: 250,
  cordyceps: 250,
  maca: 750,
  holy_basil: 200,
  gotu_kola: 250,
  ecdysterone: 200,
  shilajit: 125,
  schisandra: 250,
  ginger: 500,
  astaxanthin: 6,
  resveratrol: 250,
  quercetin: 250,
  sulforaphane: 10,
  ginkgo: 60,
  cjc1295: 1,
  ipamorelin: 1,
  ghrp2: 1,
  ghrp6: 1,
  follistatin: 1,
  semax: 1,
  selank: 1,
  dsip: 1,
  p21: 1,
  mots_c: 5,
  humanin: 3,
  ss31: 1,
  thymosin_alpha1: 1,
  ghk_cu: 1,
  melanotan1: 1,
  melanotan2: 1,
  pt141: 1,
  gonadorelin: 1,
  kisspeptin: 1,
  glp1: 1,
  gip: 1,
  cerebrolysin: 3,
  cortexin: 5,
  peptide_complex: 3,
  elastin: 250,
  histidine: 500,
  cysteine: 250,
  serine: 150,
  proline: 250,
  aspartate: 250,
  ornithine: 250,
  threonine: 250,
  lysine: 500,
  phenylalanine: 250,
  amino_complex: 2500,
  glutamate: 250,
  alpha_ketoglutarate: 500,
  reishi: 500,
  chaga: 500,
  maitake: 500,
  shiitake: 500,
  mushroom_complex: 500,
  agaricus: 500,
  turkey_tail: 500,
  lutein: 10,
  lycopene: 8,
  anthocyanins: 100,
  grape_seed_extract: 100,
  pycnogenol: 50,
  cocoa_flavanols: 250,
  c60: 1,
  antioxidant_complex: 1,
  nrf2_activator: 10,
  olive_extract: 125,
  polyphenol_complex: 250,
  flavonoids: 250,
  ellagic_acid: 125,
  ursolic_acid: 75,
  magnolia: 100,
  gentian: 125,
  artichoke: 250,
  garlic: 500,
  mangosteen: 250,
  nattokinase: 1000,
  grapefruit_seed: 125,
  nobiletin: 50,
  fisetin: 50,
  baicalin: 100,
  taxifolin: 50,
  soy_isoflavones: 50,
  rosemary: 100,
  cinnamon: 500,
  pomegranate: 250,
  cranberry: 250,
  urolithin_a: 250,
  bile_acids: 125,
  piracetam: 800,
  aniracetam: 375,
  oxiracetam: 400,
  pramiracetam: 200,
  fasoracetam: 25,
  coluracetam: 10,
  noopept: 5,
  citicoline: 125,
  alpha_gpc: 150,
  vinpocetine: 5,
  modafinil: 50,
  selegiline: 3,
  memantine: 3,
  bromantane: 25,
  tianeptine: 6,
  huperzine_a: 50,
  apigenin: 25,
  lemon_balm: 250,
  saffron: 15,
  metformin: 250,
  semaglutide: 1,
  finasteride: 1,
  cabergoline: 1,
  testosterone: 100,
  caffeine: 100,
  ppi_drugs: 10,
  spironolactone: 25,
  pharma_drugs: 1,
  antidepressant_drugs: 1,
  anxiolytic_drugs: 1,
  antipsychotic_drugs: 1,
  anticonvulsant_drugs: 1,
  ketamine: 1,
  antidiabetic_drugs: 1,
  thyroid_drugs: 1,
  corticosteroid_drugs: 1,
  statin_drugs: 10,
  antiplatelet_drugs: 50,
  anticoagulant_drugs: 1,
  ace_inhibitor_drugs: 5,
  arb_drugs: 25,
  ccb_drugs: 3,
  beta_blocker_drugs: 3,
  diuretic_drugs: 1,
  immunosuppressant_drugs: 1,
  antibiotic_drugs: 1,
  antihistamine_drugs: 5,
  nsaid_drugs: 200,
  levothyroxine: 1,
  antithyroid_drugs: 5,
  postbiotics: 250,
  paraprobiotics: 250,
  resistant_starch: 10000,
  beta_glucan: 250,
  fiber: 5000,
  hmo_prebiotics: 500,
  lactate: 500,
  digestive_enzymes: 250,
  zinc_carnosine: 38,
  colostrum: 1500,
  ahcc: 500,
  water: 1250,
  nmn: 250,
  adaptogen_complex: 500,
  oxytocin: 1,
  dhea: 13,
  insulin: 1,
  vasopressin: 1,
  pectin: 2500,
  fadogia: 250,
  pregnenolone: 25,
  immune_support: 1,
  andrographis: 100,
  cissus: 250,
  licorice: 250,
  stimulant_complex: 1,
  lipid_complex: 1500,
  brand_complex: 1,
  antacid: 500,
  igf1: 1,
  mgf: 1,
  kpv: 1,
};

const SUPPORT_DEFAULT_DOSE: Record<string, number> = {
  telmisartan: 40,
  nebivolol: 5,
  nac: 1200,
  tudca: 500,
  omega3: 2000,
  magnesium: 400,
  berberine: 1000,
  coq10: 200,
  vitamin_d3: 4000,
  zinc: 30,
  hcg: 500,
  alpha_lipoic: 600,
  ashwagandha: 600,
  saw_palmetto: 640,
  celery_extract: 1000,
  vitamin_k2: 200,
  selenium: 200,
  milk_thistle: 600,
  probiotics: 10,
  vitamin_b12: 1000,
  vitamin_b6: 50,
  folate: 800,
  iron: 27,
  copper: 2,
  astragalus: 1000,
  taurine: 3000,
  melatonin: 3,
  ginseng: 400,
  egcg: 400,
  curcumin: 1000,
  phosphatidylcholine: 1200,
  l_carnitine: 2000,
  glucosamine: 1500,
  chondroitin: 1200,
  msm: 3000,
  collagen: 10000,
  hyaluronic: 200,
  boswellia: 600,
  vitamin_c: 1000,
  bromelain: 500,
  bpc157: 500,
  tb500: 10,
  meloxicam: 15,
  diclofenac: 150,
  potassium: 300,
  electrolyte_complex: 1,
  vitamin_a: 1,
  vitamin_b1: 100,
  vitamin_b2: 10,
  vitamin_b3: 500,
  vitamin_b5: 500,
  biotin: 5,
  vitamin_e: 200,
  vitamin_b_complex: 50,
  inositol: 2000,
  betaine: 3000,
  pqq: 20,
  vitamin_complex: 1,
  pterostilbene: 250,
  prebiotics: 5000,
  glutamine: 5000,
  molybdenum: 0,
  boron: 3,
  silicon: 10,
  calcium: 500,
  sodium: 500,
  manganese: 5,
  iodine: 0,
  lithium: 1,
  vanadium: 0,
  phosphorus: 500,
  trace_minerals: 1,
  chromium: 0,
  colloidal_minerals: 15,
  strontium: 1,
  omega6: 500,
  omega7: 250,
  omega9: 1,
  cla: 3000,
  mct: 15000,
  ceramides: 1,
  butyrate: 1500,
  glycine: 3000,
  theanine: 200,
  tyrosine: 500,
  tryptophan: 500,
  x5htp: 100,
  gaba: 500,
  creatine: 5000,
  beta_alanine: 3200,
  citrulline: 6000,
  arginine: 3000,
  agmatine: 1000,
  bcaa: 10000,
  hmb: 3000,
  glutathione: 500,
  eaa: 10000,
  d_aspartic_acid: 3000,
  phenibut: 250,
  carnosine: 1000,
  alanine: 3200,
  l_dopa: 500,
  phosphatidylserine: 300,
  methionine: 500,
  s_adenosyl_methionine: 400,
  rhodiola: 300,
  bacopa: 300,
  lions_mane: 500,
  cordyceps: 500,
  maca: 1500,
  holy_basil: 400,
  gotu_kola: 500,
  ecdysterone: 400,
  shilajit: 250,
  schisandra: 500,
  ginger: 1000,
  astaxanthin: 12,
  resveratrol: 500,
  quercetin: 500,
  sulforaphane: 20,
  ginkgo: 120,
  cjc1295: 2,
  ipamorelin: 0,
  ghrp2: 0,
  ghrp6: 0,
  follistatin: 1,
  semax: 0,
  selank: 0,
  dsip: 1,
  p21: 0,
  mots_c: 10,
  humanin: 5,
  ss31: 1,
  thymosin_alpha1: 2,
  ghk_cu: 2,
  melanotan1: 1,
  melanotan2: 1,
  pt141: 2,
  gonadorelin: 0,
  kisspeptin: 0,
  glp1: 1,
  gip: 1,
  cerebrolysin: 5,
  cortexin: 10,
  peptide_complex: 5,
  elastin: 500,
  histidine: 1000,
  cysteine: 500,
  serine: 300,
  proline: 500,
  aspartate: 500,
  ornithine: 500,
  threonine: 500,
  lysine: 1000,
  phenylalanine: 500,
  amino_complex: 5000,
  glutamate: 500,
  alpha_ketoglutarate: 1000,
  reishi: 1000,
  chaga: 1000,
  maitake: 1000,
  shiitake: 1000,
  mushroom_complex: 1000,
  agaricus: 1000,
  turkey_tail: 1000,
  lutein: 20,
  lycopene: 15,
  anthocyanins: 200,
  grape_seed_extract: 200,
  pycnogenol: 100,
  cocoa_flavanols: 500,
  c60: 1,
  antioxidant_complex: 1,
  nrf2_activator: 20,
  olive_extract: 250,
  polyphenol_complex: 500,
  flavonoids: 500,
  ellagic_acid: 250,
  ursolic_acid: 150,
  magnolia: 200,
  gentian: 250,
  artichoke: 500,
  garlic: 1000,
  mangosteen: 500,
  nattokinase: 2000,
  grapefruit_seed: 250,
  nobiletin: 100,
  fisetin: 100,
  baicalin: 200,
  taxifolin: 100,
  soy_isoflavones: 100,
  rosemary: 200,
  cinnamon: 1000,
  pomegranate: 500,
  cranberry: 500,
  urolithin_a: 500,
  bile_acids: 250,
  piracetam: 1600,
  aniracetam: 750,
  oxiracetam: 800,
  pramiracetam: 400,
  fasoracetam: 50,
  coluracetam: 20,
  noopept: 10,
  citicoline: 250,
  alpha_gpc: 300,
  vinpocetine: 10,
  modafinil: 100,
  selegiline: 5,
  memantine: 5,
  bromantane: 50,
  tianeptine: 13,
  huperzine_a: 100,
  apigenin: 50,
  lemon_balm: 500,
  saffron: 30,
  metformin: 500,
  semaglutide: 0,
  finasteride: 1,
  cabergoline: 0,
  testosterone: 200,
  caffeine: 200,
  ppi_drugs: 20,
  spironolactone: 50,
  pharma_drugs: 1,
  antidepressant_drugs: 1,
  anxiolytic_drugs: 1,
  antipsychotic_drugs: 1,
  anticonvulsant_drugs: 1,
  ketamine: 1,
  antidiabetic_drugs: 1,
  thyroid_drugs: 1,
  corticosteroid_drugs: 1,
  statin_drugs: 20,
  antiplatelet_drugs: 100,
  anticoagulant_drugs: 1,
  ace_inhibitor_drugs: 10,
  arb_drugs: 50,
  ccb_drugs: 5,
  beta_blocker_drugs: 5,
  diuretic_drugs: 1,
  immunosuppressant_drugs: 1,
  antibiotic_drugs: 1,
  antihistamine_drugs: 10,
  nsaid_drugs: 400,
  levothyroxine: 0,
  antithyroid_drugs: 10,
  postbiotics: 500,
  paraprobiotics: 500,
  resistant_starch: 20000,
  beta_glucan: 500,
  fiber: 10000,
  hmo_prebiotics: 1000,
  lactate: 1000,
  digestive_enzymes: 500,
  zinc_carnosine: 75,
  colostrum: 3000,
  ahcc: 1000,
  water: 2500,
  nmn: 500,
  adaptogen_complex: 1000,
  oxytocin: 0,
  dhea: 25,
  insulin: 0,
  vasopressin: 0,
  pectin: 5000,
  fadogia: 500,
  pregnenolone: 50,
  immune_support: 1,
  andrographis: 200,
  cissus: 500,
  licorice: 500,
  stimulant_complex: 1,
  lipid_complex: 3000,
  brand_complex: 1,
  antacid: 1000,
  igf1: 0,
  mgf: 0,
  kpv: 1,
};

export const SUPPORT_RESEARCH: Record<string, { study: string; conclusion: string; year: number }[]> = {
  telmisartan:      [{ study: 'Fliser D. et al., Hypertension 2011', conclusion: 'Телмисартан — ARB с доказанным нефропротекторным и метаболическим эффектом. Снижает риск ДН и улучшает чувствительность к инсулину через PPAR-γ.', year: 2011 }],
  nebivolol:        [{ study: 'Vanhoutte PM. et al., J Hypertens 2013', conclusion: 'Небиволол — β1-селективный блокатор с NO-опосредованной вазодилатацией. Минимальное влияние на метаболизм и эректильную функцию.', year: 2013 }],
  nac:              [{ study: 'Samuni Y. et al., Curr Mol Pharmacol 2013', conclusion: 'NAC — предшественник глутатиона, гепатопротектор при ацетаминофеновой и ААС-индуцированной гепатотоксичности. Антиоксидант, нейропротектор.', year: 2013 }],
  tudca:            [{ study: 'Beuers U. et al., Dig Dis 2010', conclusion: 'TUDCA — урсодезоксихолевая кислота, доказанная эффективность при холестазе и ААС-индуцированной гепатотоксичности. Стимулирует bile flow.', year: 2010 }],
  omega3:           [{ study: 'Ramsden CE. et al., BMJ 2013; Manson JE. et al., NEJM 2018', conclusion: 'Омега-3 EPA/DHA — кардиопротекция при триглицеридемии >1.7 ммоль/л. Нейропротекция через противовоспалительный механизм.', year: 2018 }],
  magnesium:        [{ study: 'Grober U. et al., Nutrition 2015', conclusion: 'Магний бисглицинат — высокая биодоступность. Снижает возбудимость ЦНС, мышечные судороги, нормализует АД. Дефицит усиливает нейротоксичность.', year: 2015 }],
  berberine:        [{ study: 'Lan J. et al., J Ethnopharmacol 2015', conclusion: 'Берберин — активатор AMPK, сопоставим с метформином по снижению HOMA-IR. Гепатопротектор при НАЖБП.', year: 2015 }],
  coq10:            [{ study: 'Littarru GP. et al., Mol Syndromol 2011', conclusion: 'CoQ10 — ключевой компонент ETC. Кардиопротекция при статин-индуцированной миопатии. Нейропротекция при митохондриальной дисфункции.', year: 2011 }],
  vitamin_d3:       [{ study: 'Holick MF., NEJM 2007', conclusion: 'Витамин D3 — иммуномодулятор и гормон. Дефицит (<30 нг/мл) ассоциирован с аутоиммунными заболеваниями, депрессией и кардиоваскулярным риском.', year: 2007 }],
  zinc:             [{ study: 'Prasad AS., J Trace Elem Exp Med 1998', conclusion: 'Цинк — критичен для сперматогенеза и иммунитета. Дефицит → гипогонадизм, снижение тестостерона, иммунодефицит.', year: 1998 }],
  hcg:              [{ study: 'Liu PY. et al., J Clin Endocrinol Metab 2002', conclusion: 'ХГЧ — лютеинизирующий аналог, предотвращает атрофию яичек на курсе ААС и ускоряет восстановление HPTA в ПКТ.', year: 2002 }],
  alpha_lipoic:     [{ study: 'Packer L. et al., Free Radic Biol Med 1995', conclusion: 'α-Липоевая кислота — универсальный антиоксидант, восстанавливает витамины C/E. Нейропротектор при диабетической нейропатии.', year: 1995 }],
  ashwagandha:      [{ study: 'Chandrasekhar K. et al., Indian J Psychol Med 2012', conclusion: 'Ашваганда — адаптоген, снижает кортизол на 30%, повышает DHEA-S и тестостерон. Анксиолитический эффект через GABA-модуляцию.', year: 2012 }],
  milk_thistle:     [{ study: 'Fraschini F. et al., Phytother Res 2002', conclusion: 'Силимарин (расторопша) — гепатопротектор с антиоксидантным и антифибротическим действием. Доказан при ААС-индуцированном повреждении печени.', year: 2002 }],
  melatonin:        [{ study: 'Claustrat B. et al., Neuroendocrinol 2005', conclusion: 'Мелатонин — регулятор циркадных ритмов, нейропротектор, антиоксидант. Улучшает качество сна и снижает нейровоспаление.', year: 2005 }],
  curcumin:         [{ study: 'Gupta SC. et al., AAPS J 2013', conclusion: 'Куркумин — ингибитор NF-κB и COX-2, гепатопротектор и кардиопротектор. Низкая биодоступность решается пиперином или липосомами.', year: 2013 }],
  phosphatidylcholine: [{ study: 'Gundermann KJ. et al., Clin Rev Allergy Immunol 2012', conclusion: 'Фосфатидилхолин — существенный компонент мембран гепатоцитов. Восстанавливает целостность печени при токсическом повреждении.', year: 2012 }],
  l_carnitine:      [{ study: 'Ferrari R. et al., Ann N Y Acad Sci 2004', conclusion: 'L-карнитин — транспорт жирных кислот в митохондрии. Кардиопротектор, улучшает функцию эндотелия.', year: 2004 }],
  glucosamine:      [{ study: 'Towheed TE. et al., Cochrane Database 2005', conclusion: 'Глюкозамин — хондропротектор, замедляет деградацию хряща при остеоартрозе. Умеренный болеутоляющий эффект.', year: 2005 }],
  collagen:         [{ study: 'Shaw G. et al., Curr Med Res Opin 2017', conclusion: 'Коллагеновые пептиды — улучшают биомеханику хряща и сухожилий, снижают боль в суставах при нагрузке.', year: 2017 }],
  bpc157:          [{ study: 'Sikiric P. et al., Curr Pharm Des 2018', conclusion: 'BPC-157 — пентадекапептид с доказанной регенерацией сухожилий, связок, кишечника и нервной ткани. Стимулирует ангиогенез.', year: 2018 }],
  tb500:           [{ study: 'Smart N. et al., J Biol Chem 2007', conclusion: 'TB-500 (тимозин β4) — стимулирует миграцию клеток, ангиогенез и регенерацию тканей. Кардиопротектор и нейропротектор.', year: 2007 }],
  vitamin_c:       [{ study: 'Carr AC. et al., Nutrients 2017', conclusion: 'Витамин C — антиоксидант, кофактор коллаген-синтеза. Поддержка иммунитета при высоком окислительном стрессе.', year: 2017 }],
  vitamin_b12:      [{ study: 'Stabler SP., N Engl J Med 2013', conclusion: 'B12 — критичен для миелинизации нервов и эритропоэза. Дефицит → мегалобластная анемия, нейропатия.', year: 2013 }],
  folate:           [{ study: 'Crider KS. et al., Adv Nutr 2012', conclusion: 'Фолат — метиляция ДНК, гомоцистеин-снижение. Кардиопротекция через снижение гомоцистеина.', year: 2012 }],
  meloxicam:        [{ study: 'Noble S. et al., Drugs 1996', conclusion: 'Мелоксикам — селективный COX-2 ингибитор, НПВП. Риск почечной и гепатотоксичности при длительном применении.', year: 1996 }],
  diclofenac:       [{ study: 'Gan TJ., Am J Med 2009', conclusion: 'Диклофенак — НПВП с высоким риском кардиоваскулярных событий (FDA warning) и гепатотоксичности. Ограниченный курс ≤2 недель.', year: 2009 }],
  selenium:         [{ study: 'Rayman MP., Lancet 2012',     conclusion: 'Селен — ключевой элемент глутатионпероксидазы. Щитовидная защита. Избыток → токсичность (хрупкость ногтей, алопеция).', year: 2012 }],
  taurine:          [{ study: 'Schaffer S. et al., Amino Acids 2014', conclusion: 'Таурин — нейромодулятор, кардиопротектор (антиаритмический), осмолит. Гепатопротектор при токсическом повреждении.', year: 2014 }],
  saw_palmetto:     [{ study: 'Barry M. et al., NEJM 2006', conclusion: 'Сереноа — ингибитор 5α-редуктазы, снижает ДГТ. Умеренный эффект при ДГПЖ. Не предотвращает ААС-индуцированную атрофию яичек.', year: 2006 }],
  egcg:             [{ study: 'Khan N. et al., Mol Nutr Food Res 2008', conclusion: 'EGCG — катехин зелёного чая, антиоксидант и ингибитор COMT. Гепатотоксичность при высоких дозах (>800 мг).', year: 2008 }],
  ginseng:          [{ study: 'Kim JH. et al., J Ginseng Res 2013', conclusion: 'Женьшень — адаптоген, повышает NO и IGF-1. Умеренный эргогенный эффект. Потенцирует антикоагулянты.', year: 2013 }],
  vitamin_k2:       [{ study: 'Vermeer C. et al., J Nutr 2004', conclusion: 'Витамин K2 (МК-7) — активатор остеокальцина и MGP. Кальцификация сосудов при дефиците. Кардиопротекция.', year: 2004 }],
  iron:             [{ study: 'Camaschella C., Lancet 2015', conclusion: 'Железо — эссенциален для эритропоэза. Перегрузка ( гемохроматоз) → гепатотоксичность, кардиомиопатия. Контролировать ферритин.', year: 2015 }],
  hyaluronic:       [{ study: 'Gao F. et al., Nutrients 2019', conclusion: 'Гиалуроновая кислота — компонент синовиальной жидкости и хряща. Пероральная форма улучшает увлажнение суставов.', year: 2019 }],
  msm:              [{ study: 'Usha PR. et al., Osteoarthr Cartil 2004', conclusion: 'MSM — источник серы, противовоспалительный. Умеренный эффект при остеоартрозе в комбинации с глюкозамином.', year: 2004 }],
  boswellia:        [{ study: 'Ammon HP., Phytomedicine 2006', conclusion: 'Босвеллия — ингибитор 5-липоксигеназы, противовоспалительный. Эффективен при артрите и КЗК. Мягкая нейропротекция.', year: 2006 }],
  bromelain:        [{ study: 'Maurer HR., Cell Mol Life Sci 2001', conclusion: 'Бромелайн — протеолитический фермент, фибринолитик. Противовоспалительный и противоотёчный эффект при травмах.', year: 2001 }],
  probiotics:       [{ study: 'Hill C. et al., Nat Rev Gastroenterol Hepatol 2014', conclusion: 'Пробиотики — модуляция микробиома, влияние на печёночный метаболизм (ось печень-кишечник). Иммуномодуляция.', year: 2014 }],
  copper:           [{ study: 'Uriu-Adams JY. et al., J Nutr 2005',     conclusion: 'Медь — кофактор церулоплазмина и SOD. Критична для нейромиелинизации и эритропоэза. Избыток → гепатотоксичность.', year: 2005 }],
  astragalus:       [{ study: 'Auyeung KK. et al., Am J Chin Med 2016', conclusion: 'Астрагал — иммуномодулятор и нефропротектор. Активный компонент — астрагалозид IV. Снижает протеинурию.', year: 2016 }],
};

const COVERAGE_ORGAN_MAP: Record<string, string[]> = {
  cardio: ['heart', 'vascular'],
  hepatic: ['liver'],
  renal: ['kidneys'],
  neuro: ['brain', 'nervous_system'],
  endocrine: ['thyroid', 'adrenals', 'gonads'],
  immune: ['bone_marrow', 'lymphatic'],
  repro: ['testes', 'prostate'],
  musculoskeletal: ['joints', 'ligaments', 'tendons', 'cartilage', 'bone']
};

function sigmoidEmax(emax: number, dose: number, ec50: number): number {
  if (ec50 <= 0) return emax;
  return emax * dose / (ec50 + dose);
}

function getCoverageSystem(key: string): string | undefined {
  const prefix = key.split('_')[0];
  if (prefix === 'repro') return 'reproductive';
  if (prefix === 'immune') return 'hematologic';
  if (prefix === 'gastro') return 'hepatic';
  if (RISK_SYSTEMS.includes(prefix as any)) return prefix;
  return undefined;
}

function getSubstanceById(id: string): SubstanceEntry | undefined {
  return MASTER_DB.substances.find(s => s.id === id || s.name.toLowerCase().includes(id.toLowerCase()));
}

function getMechanismById(id: string): MechanismEntry | undefined {
  return MASTER_DB.mechanisms.find(m => m.id === id);
}

function getOrganById(id: string): OrganEntry | undefined {
  return MASTER_DB.organs.find(o => o.id === id);
}

function getSystemById(id: string): SystemEntry | undefined {
  return MASTER_DB.systems.find(s => s.id === id);
}

function getRiskById(id: string): RiskEntry | undefined {
  return MASTER_DB.risks.find(r => r.id === id);
}

function getRecommendationById(id: string): RecommendationEntry | undefined {
  return MASTER_DB.recommendations.find(r => r.recId === id);
}

function calculateBaseRisk(input: SupportInput): Record<string, number> {
  const systemRisks: Record<string, number> = {};

  for (const system of ALL_RISK_SYSTEMS) {
    const weight = SYSTEM_RISK_WEIGHTS[system] ?? 1.0;
    systemRisks[system] = BASE_RISK * 100 * weight;
  }

  if (input.genetics) {
    for (const [gene, variant] of Object.entries(input.genetics)) {
      const multipliers = GENETIC_MULTIPLIERS[gene];
      if (multipliers) {
        const multiplier = multipliers[variant] ?? 1.0;
        const affectedSystems = GENETIC_SYSTEM_MAP[gene];
        if (affectedSystems) {
          for (const system of affectedSystems) {
            if (systemRisks[system] !== undefined) {
              systemRisks[system] *= multiplier;
    }
  }

  for (const system of ALL_RISK_SYSTEMS) {
    systemRisks[system] = Math.min(100, Math.max(0, systemRisks[system]));
  }
        }
      }
    }
  }

  if (input.nutritionFactor !== undefined) {
    for (const system of ALL_RISK_SYSTEMS) {
      const reduction = NUTRITION_SYSTEM_REDUCTION[system] ?? 0.3;
      systemRisks[system] *= (1 - input.nutritionFactor * reduction);
    }
  }

  if (input.trainingFactor !== undefined) {
    for (const system of ALL_RISK_SYSTEMS) {
      const reduction = TRAINING_SYSTEM_REDUCTION[system] ?? 0.2;
      systemRisks[system] *= (1 - input.trainingFactor * reduction);
    }
  }

  for (const system of ALL_RISK_SYSTEMS) {
    systemRisks[system] = Math.min(100, Math.max(0, systemRisks[system]));
  }

  return systemRisks;
}

function calculateSubstanceRisk(substances: SubstanceEntry[], drugDoses?: Record<string, number>): Record<string, number> {
  const systemRisks: Record<string, number> = {};
  for (const system of ALL_RISK_SYSTEMS) {
    systemRisks[system] = 0;
  }

  for (const substance of substances) {
    const drugKey = Object.keys(DRUG_THRESHOLDS).find(k =>
      substance.id === k || substance.id.replace(/[_\-]/g, '_') === k || substance.name.toLowerCase().replace(/\s+/g, '_').includes(k)
    );

    if (drugKey) {
      const threshold = DRUG_THRESHOLDS[drugKey];
      const dose = drugDoses?.[drugKey] ?? drugDoses?.[substance.id] ?? threshold.dosePerWeek;
      const doseRatio = dose / threshold.dosePerWeek;
      const profile = AAS_SYSTEM_PROFILE[drugKey] ?? { cardio: 0.143, hepatic: 0.143, renal: 0.143, neuro: 0.143, endocrine: 0.143, hematologic: 0.143, reproductive: 0.143 };
      const quadraticDose = doseRatio * doseRatio;
      const androFactor = threshold.androgenicity;

      for (const system of ALL_RISK_SYSTEMS) {
        const systemWeight = profile[system] ?? 1 / ALL_RISK_SYSTEMS.length;
        systemRisks[system] += systemWeight * quadraticDose * androFactor * 30;
      }
    } else {
      if (substance.risks) {
        for (const riskName of substance.risks) {
          const riskEntry = getRiskById(riskName);
          if (riskEntry) {
            let riskValue = 0;
            switch (riskEntry.level) {
              case 'LOW': riskValue = 5; break;
              case 'MEDIUM': riskValue = 15; break;
              case 'HIGH': riskValue = 35; break;
              case 'CRITICAL': riskValue = 60; break;
            }
            const riskTitle = riskEntry.title.toLowerCase();
            for (const system of ALL_RISK_SYSTEMS) {
              if (riskTitle.includes(system) || riskTitle.includes(system.substring(0, 4))) {
                systemRisks[system] += riskValue;
                break;
              }
            }
            if (!RISK_SYSTEMS.some(s => riskTitle.includes(s) || riskTitle.includes(s.substring(0, 4)))) {
              systemRisks['hepatic'] += riskValue * 0.4;
              systemRisks['cardio'] += riskValue * 0.3;
              systemRisks['endocrine'] += riskValue * 0.2;
              systemRisks['renal'] += riskValue * 0.1;
            }
          }
        }
      }

      if (substance.effects) {
        for (const effect of substance.effects) {
          const effectEntry = MASTER_DB.effects.find(e => e.id === effect.effect);
          if (effectEntry && effectEntry.risks) {
            for (const rw of effectEntry.risks) {
              const riskObj = getRiskById(rw.name);
              if (riskObj) {
                let riskValue = 0;
                switch (riskObj.level) {
                  case 'LOW': riskValue = 2; break;
                  case 'MEDIUM': riskValue = 8; break;
                  case 'HIGH': riskValue = 18; break;
                  case 'CRITICAL': riskValue = 35; break;
                }
                const riskTitle = riskObj.title.toLowerCase();
                let assigned = false;
                for (const system of ALL_RISK_SYSTEMS) {
                  if (riskTitle.includes(system) || riskTitle.includes(system.substring(0, 4))) {
                    systemRisks[system] += riskValue * rw.weight;
                    assigned = true;
                    break;
                  }
                }
                if (!assigned) {
                  if (effectEntry.organs && effectEntry.organs.length > 0) {
                    for (const ow of effectEntry.organs) {
                      const organName = ow.name.toLowerCase();
                      for (const system of ALL_RISK_SYSTEMS) {
                        if (organName.includes(system)) {
                          systemRisks[system] += riskValue * rw.weight / effectEntry.organs.length;
                          break;
                        }
                      }
                    }
                  } else {
                    systemRisks['hepatic'] += riskValue * rw.weight * 0.3;
                    systemRisks['cardio'] += riskValue * rw.weight * 0.2;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  for (const system of ALL_RISK_SYSTEMS) {
    systemRisks[system] = Math.min(100, Math.max(0, systemRisks[system]));
  }

  return systemRisks;
}


// Map catalog system keys to risk system coverage prefixes
const CATALOG_SYSTEM_TO_COVERAGE: Record<string, { system: string; baseEmax: number }[]> = {
  hepatic:      [{ system: 'hepatic', baseEmax: 0.40 }],
  cardio:       [{ system: 'cardio', baseEmax: 0.35 }],
  renal:        [{ system: 'renal', baseEmax: 0.30 }],
  neuro:        [{ system: 'neuro', baseEmax: 0.30 }],
  endocrine:    [{ system: 'endocrine', baseEmax: 0.30 }],
  hematologic:  [{ system: 'hematologic', baseEmax: 0.25 }],
  reproductive: [{ system: 'reproductive', baseEmax: 0.25 }],
  musculoskeletal: [{ system: 'musculoskeletal', baseEmax: 0.30 }],
  immune:       [{ system: 'hematologic', baseEmax: 0.20 }, { system: 'hepatic', baseEmax: 0.15 }],
  metabolic:    [{ system: 'endocrine', baseEmax: 0.25 }, { system: 'hepatic', baseEmax: 0.15 }],
  gastrointestinal: [{ system: 'hepatic', baseEmax: 0.20 }, { system: 'hematologic', baseEmax: 0.10 }],
};

// Tier-based Emax multiplier
const TIER_EMAX_MULT: Record<string, number> = {
  core: 1.2,
  standard: 1.0,
  advanced: 0.8,
  specialty: 0.6,
};

// Generate coverage from catalog entry
function generateCoverageFromCatalog(entry: typeof SUPPORT_CATALOG_DATA[string]): Record<string, number> | null {
  if (!entry.systems || entry.systems.length === 0) return null;
  const coverage: Record<string, number> = {};
  const tierMult = TIER_EMAX_MULT[entry.tier] ?? 1.0;
  for (const sys of entry.systems) {
    const mappings = CATALOG_SYSTEM_TO_COVERAGE[sys];
    if (mappings) {
      for (const m of mappings) {
        const emax = Math.min(0.85, m.baseEmax * tierMult);
        const suffixNum = Math.min(7, Math.max(1, Math.round(emax * 7)));
        const key = m.system + '_' + suffixNum;
        coverage[key] = Math.max(coverage[key] || 0, emax);
      }
    }
  }
  return Object.keys(coverage).length > 0 ? coverage : null;
}

function calculateSupportCoverage(
  substances: SubstanceEntry[],
  substanceIds: string[],
  supportDoses?: Record<string, number>,
  goals?: string[]
): { totalSupport: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  const systemSupport: Record<string, number> = {};
  const organSupport: Record<string, number> = {};
  let totalSupport = 0;

  // System weights: how much each system's coverage contributes to total
  const SYSTEM_WEIGHT: Record<string, number> = {
    hepatic: 15,
    cardio: 15,
    renal: 10,
    neuro: 10,
    endocrine: 12,
    hematologic: 8,
    reproductive: 10,
    musculoskeletal: 10
  };

  // Goal-based weight multipliers
  if (goals && goals.length > 0) {
    const goal = goals[0];
    if (goal === 'muscle_gain' || goal === 'strength') {
      SYSTEM_WEIGHT.musculoskeletal = 20;
      SYSTEM_WEIGHT.endocrine = 18;
      SYSTEM_WEIGHT.hepatic = 12;
    } else if (goal === 'fat_loss') {
      SYSTEM_WEIGHT.endocrine = 18;
      SYSTEM_WEIGHT.hepatic = 15;
      SYSTEM_WEIGHT.cardio = 15;
    } else if (goal === 'endurance') {
      SYSTEM_WEIGHT.cardio = 20;
      SYSTEM_WEIGHT.hematologic = 15;
      SYSTEM_WEIGHT.musculoskeletal = 15;
    } else if (goal === 'recomp') {
      SYSTEM_WEIGHT.endocrine = 16;
      SYSTEM_WEIGHT.musculoskeletal = 15;
      SYSTEM_WEIGHT.hepatic = 14;
    }
  }

  for (const system of ALL_RISK_SYSTEMS) {
    systemSupport[system] = 0;
  }

  // Build a lookup map: substance id -> SUPPORT_BASE_COVERAGE key
  const resolveSupKey = (id: string): string | undefined => {
    // 1. Resolve to canonical ID first (consolidates all 2083+ variants to ~279 canonical IDs)
    const canonicalId = resolveCanonicalId(id);
    if (SUPPORT_BASE_COVERAGE[canonicalId]) return canonicalId;
    // 2. Check alias map
    if (COVERAGE_ID_ALIAS[id] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[id]]) return COVERAGE_ID_ALIAS[id];
    if (COVERAGE_ID_ALIAS[canonicalId] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[canonicalId]]) return COVERAGE_ID_ALIAS[canonicalId];
    // 3. Direct check
    if (SUPPORT_BASE_COVERAGE[id]) return id;
    // 4. Fuzzy matching (case-insensitive)
    const lower = canonicalId.toLowerCase();
    for (const k of Object.keys(SUPPORT_BASE_COVERAGE)) {
      if (lower.includes(k) || k.includes(lower)) return k;
    }
    // 5. Check SUPPORT_CATALOG_DATA
    const catEntry = SUPPORT_CATALOG_DATA[canonicalId] || SUPPORT_CATALOG_DATA[id];
    if (catEntry) return canonicalId;
    return undefined;
  };

  // Track which coverage keys have been processed to avoid double-counting
  const processedKeys = new Set<string>();

  // Iterate substance IDs and compute per-system coverage via sigmoid Emax model
  for (const sid of substanceIds) {
    const supKey = resolveSupKey(sid);
    if (!supKey || processedKeys.has(supKey)) continue;
    processedKeys.add(supKey);

    let coverage: Record<string, number> | null = SUPPORT_BASE_COVERAGE[supKey] ?? null;
    if (!coverage) {
      const catEntry = SUPPORT_CATALOG_DATA[supKey];
      if (catEntry) coverage = generateCoverageFromCatalog(catEntry);
    }
    if (!coverage) continue;
    const dose = supportDoses?.[supKey] ?? supportDoses?.[sid] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
    const ec50 = SUPPORT_EC50[supKey] ?? 100;

    let substanceTotal = 0;
    for (const [coverageKey, emax] of Object.entries(coverage)) {
      const adjustedCoverage = sigmoidEmax(emax, dose, ec50);
      const system = getCoverageSystem(coverageKey);
      if (system) {
        systemSupport[system] = (systemSupport[system] ?? 0) + adjustedCoverage;
      }
      const organPrefix = coverageKey.split('_')[0];
      const organs = COVERAGE_ORGAN_MAP[organPrefix] ?? [];
      for (const organ of organs) {
        organSupport[organ] = (organSupport[organ] ?? 0) + adjustedCoverage;
      }
      substanceTotal += adjustedCoverage;
    }
    totalSupport += substanceTotal;
  }

  // Also process SubstanceEntry objects that might have additional coverage info
  for (const substance of substances) {
    const supKey = resolveSupKey(substance.id);
    if (!supKey || processedKeys.has(supKey)) continue;
    processedKeys.add(supKey);

    let coverage: Record<string, number> | null = SUPPORT_BASE_COVERAGE[supKey] ?? null;
    if (!coverage) {
      const catEntry = SUPPORT_CATALOG_DATA[supKey];
      if (catEntry) coverage = generateCoverageFromCatalog(catEntry);
    }
    if (!coverage) continue;
    const dose = supportDoses?.[supKey] ?? supportDoses?.[substance.id] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
    const ec50 = SUPPORT_EC50[supKey] ?? 100;

    let substanceTotal = 0;
    for (const [coverageKey, emax] of Object.entries(coverage)) {
      const adjustedCoverage = sigmoidEmax(emax, dose, ec50);
      const system = getCoverageSystem(coverageKey);
      if (system) {
        systemSupport[system] = (systemSupport[system] ?? 0) + adjustedCoverage;
      }
      const organPrefix = coverageKey.split('_')[0];
      const organs = COVERAGE_ORGAN_MAP[organPrefix] ?? [];
      for (const organ of organs) {
        organSupport[organ] = (organSupport[organ] ?? 0) + adjustedCoverage;
      }
      substanceTotal += adjustedCoverage;
    }
    totalSupport += substanceTotal;
  }

  // Apply system weights: convert raw emax sum to weighted % risk reduction
  for (const system of ALL_RISK_SYSTEMS) {
    const weight = SYSTEM_WEIGHT[system] ?? 10;
    systemSupport[system] = Math.min(95, (systemSupport[system] || 0) * weight);
  }
  for (const organ of Object.keys(organSupport)) {
    organSupport[organ] = Math.min(95, organSupport[organ]);
  }

  // Total support = weighted average across systems
  const totalWeight = ALL_RISK_SYSTEMS.reduce((sum, s) => sum + (SYSTEM_WEIGHT[s] ?? 10), 0);
  const weightedTotal = ALL_RISK_SYSTEMS.reduce((sum, s) => sum + (systemSupport[s] || 0) * (SYSTEM_WEIGHT[s] ?? 10), 0);
  totalSupport = totalWeight > 0 ? Math.min(95, weightedTotal / totalWeight) : Math.min(95, totalSupport);

  return { totalSupport, systemSupport, organSupport };
}
function calculateSupportScore(
  input: SupportInput,
  substances: SubstanceEntry[],
  substanceIds: string[]
): { score: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  const coverage = calculateSupportCoverage(substances, substanceIds, input.supportDoses, input.goals);
  // Lifestyle factors (nutrition, training) are already priced into base risk.
  // Only actual supplement coverage reduces risk. lifestyleSupport removed to avoid
  // auto-reducing risk by ~27% when user has selected NO support items.

  const totalScore = Math.min(100, Math.max(0, coverage.totalSupport));

  return { score: totalScore, systemSupport: coverage.systemSupport, organSupport: coverage.organSupport };
}

function generateRecommendations(riskResult: RiskResult, input: SupportInput): RecommendationEntry[] {
  const recommendations: RecommendationEntry[] = [];

  for (const [system, riskData] of Object.entries(riskResult.systemBreakdown)) {
    if (riskData.net > 50) {
      const systemRecs = MASTER_DB.recommendations.filter(r => 
        r.riskId && MASTER_DB.risks.some(risk => 
          risk.id === r.riskId && 
          risk.title.toLowerCase().includes(system.toLowerCase())
        )
      );

      for (const rec of systemRecs.slice(0, 2)) {
        if (!recommendations.some(r => r.recId === rec.recId)) {
          recommendations.push(rec);
        }
      }
    }
  }

  if (recommendations.length === 0) {
    const generalRecs = MASTER_DB.recommendations.filter(r => 
      r.type === 'general' || r.type === 'lifestyle'
    );

    for (const rec of generalRecs.slice(0, 3)) {
      recommendations.push(rec);
    }
  }

  return recommendations;
}

export function calculateSupport(input: SupportInput): SupportOutput {
  const substances: SubstanceEntry[] = [];
  for (const id of input.substances) {
    const substance = getSubstanceById(id);
    if (substance) {
      substances.push(substance);
    }
  }

  const baseRiskBySystem = calculateBaseRisk(input);
  const substanceRiskBySystem = calculateSubstanceRisk(substances, input.drugDoses);

  const systemBreakdownRaw: Record<string, number> = {};
  const systemBreakdownNet: Record<string, number> = {};
  let totalRaw = 0;

  for (const system of ALL_RISK_SYSTEMS) {
    systemBreakdownRaw[system] = Math.min(100, (baseRiskBySystem[system] ?? 0) + (substanceRiskBySystem[system] ?? 0));
    totalRaw += systemBreakdownRaw[system];
  }

  const riskBeforeSupport = Math.min(100, Math.max(...Object.values(systemBreakdownRaw)));

  const { score: supportScore, systemSupport, organSupport } = calculateSupportScore(input, substances, input.substances);

  for (const system of ALL_RISK_SYSTEMS) {
    const raw = systemBreakdownRaw[system];
    const weightedSupport = systemSupport[system] ?? 0;
    const sysWeight: Record<string, number> = { hepatic:15, cardio:15, renal:10, neuro:10, endocrine:12, hematologic:8, reproductive:10, musculoskeletal:10 };
    const weight = sysWeight[system] ?? 10;
    // Capped diminishing protection: max 70% even with optimal support
    const rawCoverage = weight > 0 ? weightedSupport / weight : 0;
    const protectionFraction = Math.min(0.7, Math.max(0, rawCoverage * 0.65));
    const lifestyleReduction = ((input.nutritionFactor ?? 0) * (NUTRITION_SYSTEM_REDUCTION[system] ?? 0.3) + (input.trainingFactor ?? 0) * (TRAINING_SYSTEM_REDUCTION[system] ?? 0.2));
    const netRisk = raw * (1 - protectionFraction) * (1 - Math.min(0.5, lifestyleReduction));
    systemBreakdownNet[system] = Math.min(100, Math.max(0, netRisk));
  }

  let totalNet = 0;
  for (const system of ALL_RISK_SYSTEMS) {
    totalNet += systemBreakdownNet[system];
  }
  const riskAfterSupport = Math.min(100, Math.max(...Object.values(systemBreakdownNet)));

  const riskResult: RiskResult = {
    overallRaw: riskBeforeSupport,
    overallNet: riskAfterSupport,
    systemBreakdown: {},
    mechanismBreakdown: {}
  };

  for (const system of ALL_RISK_SYSTEMS) {
    riskResult.systemBreakdown[system] = {
      raw: systemBreakdownRaw[system],
      net: systemBreakdownNet[system]
    };
  }

  const recommendations = generateRecommendations(riskResult, input);

  const effectiveMechanisms: MechanismEntry[] = [];
  const affectedOrgans: OrganEntry[] = [];
  const affectedSystems: SystemEntry[] = [];

  for (const substance of substances) {
    if (substance.mechanisms) {
      for (const mechId of substance.mechanisms) {
        const mech = getMechanismById(mechId);
        if (mech && !effectiveMechanisms.some(m => m.id === mech.id)) {
          effectiveMechanisms.push(mech);
        }
      }
    }
  }

  for (const [organKey, coverage] of Object.entries(organSupport)) {
    const organEntry = getOrganById(organKey);
    if (organEntry && !affectedOrgans.some(o => o.id === organEntry.id)) {
      affectedOrgans.push(organEntry);
    }
  }

  const highRiskSystems = ALL_RISK_SYSTEMS.filter(s => (systemBreakdownNet[s] ?? 0) > 30);
  for (const sysId of highRiskSystems) {
    const sysEntry = getSystemById(sysId);
    if (sysEntry && !affectedSystems.some(s => s.id === sysEntry.id)) {
      affectedSystems.push(sysEntry);
    }
  }

  const metadata = {
    processedSubstances: substances,
    effectiveMechanisms,
    affectedOrgans,
    affectedSystems
  };

  return {
    riskAssessment: riskResult,
    recommendations,
    supportScore,
    riskBeforeSupport,
    riskAfterSupport,
    systemSupport,
    organSupport,
    metadata
  };
}

export interface SynergyPair {
  substanceA: string;
  substanceB: string;
  synergyType: 'additive' | 'synergistic' | 'potentiative' | 'complementary';
  mechanism: string;
  affectedSystems: string[];
  strength: number;
  clinicalNote?: string;
}

export interface SupplementTarget {
  systems: string[];
  organs: string[];
  biomarkers: string[];
  mechanisms: string[];
}

export const SUPPLEMENT_DESCRIPTIONS: Record<string, string> = {
  telmisartan: 'Телмисартан — сартан (ARB) с частичной PPAR-γ агонистической активностью. Снижает риск диабетической нефропатии, улучшает чувствительность к инсулину и снижает триглицериды.',
  nebivolol: 'Небиволол — высокоселективный β1-блокатор III поколения с NO-опосредованной вазодилатацией. Минимизирует влияние на метаболизм глюкозы и эректильную функцию.',
  nac: 'N-ацетилцистеин — предшественник глутатиона, главного внутриклеточного антиоксиданта печени. Обеспечивает гепато- и нейропротекцию через снижение окислительного стресса.',
  tudca: 'Тауроурсодезоксихолевая кислота — стимулирует bile flow и защищает гепатоциты от холестатического повреждения. Препарат выбора при AAS-индуцированном холестазе.',
  omega3: 'Омега-3 (EPA/DHA) — эссенциальные жирные кислоты с доказанной кардиопротекцией через снижение триглицеридов, противовоспалительную модуляцию и стабилизацию мембран.',
  magnesium: 'Магний — кофактор более 300 ферментов, критичный для нервно-мышечной передачи, энергетического метаболизма и регуляции АД. Восстанавливает баланс GABA.',
  berberine: 'Берберин — алкалоид с активацией AMPK, сопоставимой с метформином по снижению HOMA-IR и улучшению липидного профиля. Гепатопротектор при НАЖБП.',
  coq10: 'Коэнзим Q10 — ключевой компонент электрон-транспортной цепи митохондрий и антиоксидант липидных мембран. Кардиопротектор при статин-индуцированной миопатии.',
  vitamin_d3: 'Витамин D3 — прогормон и иммуномодулятор, дефицит которого ассоциирован с аутоиммунными заболеваниями и депрессией. Регулирует экспрессию более 200 генов.',
  zinc: 'Цинк — эссенциальный микроэлемент, критичный для сперматогенеза, иммунитета и синтеза тестостерона. Восстанавливает функцию клеток Лейдига и активность тимуса.',
  hcg: 'Хорионический гонадотропин — LH-аналог, предотвращающий атрофию яичек на курсе AAS и ускоряющий восстановление HPTA в ПКТ.',
  alpha_lipoic: 'α-Липоевая кислота — универсальный антиоксидант, восстанавливающий витамины C и E и повышающий внутриклеточный глутатион. Нейропротектор при диабетической нейропатии.',
  ashwagandha: 'Ашваганда (Withania somnifera) — адаптоген со снижением кортизола на 30%, повышением DHEA-S и тестостерона. Анксиолитический эффект через GABA-модуляцию.',
  saw_palmetto: 'Сереноа ползучая — ингибитор 5α-редуктазы, снижающий конверсию тестостерона в ДГТ. Умеренный эффект при ДГПЖ и андрогенной алопеции.',
  celery_extract: 'Экстракт сельдерея — источник апигенина и фталидов, обеспечивающих нефропротекцию через снижение мочевой кислоты и антиоксидантное действие.',
  vitamin_k2: 'Витамин K2 (МК-7) — активатор остеокальцина и матриксного Gla-белка, предотвращающий кальцификацию сосудов. Синергичен с витамином D3.',
  selenium: 'Селен — компонент глутатионпероксидазы и дейодиназ щитовидной железы. Антиоксидантная защита, поддержка иммунитета и функции щитовидной железы.',
  milk_thistle: 'Силимарин (расторопша) — гепатопротектор с антиоксидантным и мембраностабилизирующим действием. Доказан при AAS-индуцированном повреждении печени.',
  probiotics: 'Пробиотики — модуляторы микробиома кишечника, улучшающие барьерную функцию кишечника и снижающие эндотоксемию через иммуномодуляцию.',
  vitamin_b12: 'Витамин B12 — критичен для миелинизации нервов, эритропоэза и метилирования гомоцистеина. Дефицит ведёт к мегалобластной анемии и нейропатии.',
  vitamin_b6: 'Витамин B6 — кофактор более 100 ферментов, включая синтез нейромедиаторов (серотонин, GABA, дофамин) и метаболизм гомоцистеина.',
  folate: 'Фолат (5-МТГФ) — ключевой кофактор метилирования ДНК и реметилирования гомоцистеина в метионин. Кардиопротекция через снижение гомоцистеина.',
  iron: 'Железо — эссенциальный элемент для эритропоэза и кислородтранспортной функции гемоглобина. Supplementation требует мониторинга ферритина и ОЖСС.',
  copper: 'Медь — кофактор церулоплазмина, супероксиддисмутазы и лизилоксидазы. Критична для нейромиелинизации, эритропоэза и синтеза коллагена.',
  astragalus: 'Астрагал — иммуномодулятор и нефропротектор, активный компонент — астрагалозид IV. Снижает протеинурию при диабетической нефропатии.',
  taurine: 'Таурин — нейромодулятор, кардиопротектор (антиаритмический, осмолит) и гепатопротектор. Модулирует кальциевые каналы в кардиомиоцитах.',
  melatonin: 'Мелатонин — нейрогормон эпифиза, регулятор циркадных ритмов и мощный антиоксидант. Улучшает качество сна и снижает нейровоспаление.',
  ginseng: 'Женьшень (Panax ginseng) — адаптоген, повышающий синтез NO и IGF-1, с умеренным эргогенным и ноотропным эффектом.',
  egcg: 'EGCG — катехин зелёного чая, мощный антиоксидант и ингибитор COMT. Гепатопротектор в умеренных дозах, но в высоких может вызывать гепатотоксичность.',
  curcumin: 'Куркумин — полифенол куркумы, ингибитор NF-κB и COX-2. Низкая биодоступность решается комбинацией с пиперином или липосомальной формой.',
  phosphatidylcholine: 'Фосфатидилхолин — эссенциальный фосфолипид, структурный компонент мембран гепатоцитов. Восстанавливает целостность мембран при токсическом повреждении печени.',
  l_carnitine: 'L-карнитин — транспорт жирных кислот в митохондрии для β-окисления. Кардиопротектор при ишемии миокарда и AAS-индуцированной кардиомиопатии.',
  glucosamine: 'Глюкозамин — аминосахар, хондропротектор и субстрат для синтеза гликозаминогликанов хряща. Замедляет деградацию хряща при остеоартрозе.',
  chondroitin: 'Хондроитинсульфат — гликозаминогликан хрящевого матрикса, удерживающий воду. Замедляет деградацию коллагена II типа.',
  msm: 'MSM (метилсульфонилметан) — органический источник серы для синтеза хондроитина и коллагена. Противовоспалительный эффект через ингибирование NF-κB.',
  collagen: 'Коллагеновые пептиды — гидролизат коллагена I и III типов, строительный материал для сухожилий, связок, хряща и кожи.',
  hyaluronic: 'Гиалуроновая кислота — компонент синовиальной жидкости и хрящевого матрикса. Пероральная форма улучшает увлажнение суставов и кожи.',
  boswellia: 'Босвеллия (Boswellia serrata) — ингибитор 5-липоксигеназы с противовоспалительным эффектом при артрите и воспалительных заболеваниях кишечника.',
  vitamin_c: 'Витамин C — водорастворимый антиоксидант, кофактор синтеза коллагена и карнитина. Поддерживает регенерацию витамина E и глутатиона.',
  bromelain: 'Бромелайн — протеолитический фермент ананаса с фибринолитическим и противовоспалительным действием. Ускоряет восстановление при травмах мягких тканей.',
  bpc157: 'BPC-157 — пентадекапептид с регенерацией сухожилий, связок и нервной ткани. Стимулирует ангиогенез через VEGF и FGF.',
  tb500: 'TB-500 (тимозин β4) — пептид, стимулирующий миграцию клеток и ангиогенез. Синеричен с BPC-157 для восстановления сухожильно-связочного аппарата.',
  meloxicam: 'Мелоксикам — селективный COX-2 ингибитор (НПВП) с противовоспалительным эффектом. Риск почечной и гепатотоксичности при длительном применении.',
  diclofenac: 'Диклофенак — НПВП с высоким риском кардиоваскулярных событий и гепатотоксичности. Ограниченный курс ≤2 недель.',
  tongkat_ali: 'Тонгкат Али (Eurycoma longifolia) — адаптоген с повышением тестостерона через стимуляцию LH. Антикортизольный эффект.',
  fadogia: 'Фадогия (Fadogia agrestis) — стимулирует выброс LH из гипофиза и прямую стимуляцию клеток Лейдига. Синерична с тонгкат али.',
  shilajit: 'Мумиё (шиладжит) — органоминеральный комплекс с фульвокислотами, улучшающий биодоступность микроэлементов и митохондриальную функцию.',
  boron: 'Бор — микроэлемент, усиливающий полураспад витамина D и повышающий уровень свободного тестостерона через снижение SHBG.',
};


// ═══════════════════════════════════════════════════════════════
// ORGAN-BASED SYNERGY SYSTEM
// Organized by body system with Russian descriptions and clinical logic
// ═══════════════════════════════════════════════════════════════
export interface OrganSynergy {
  id: string;
  organ: string;
  organLabel: string;
  pairs: {
    substanceA: string;
    substanceB: string;
    nameA: string;
    nameB: string;
    effect: string;
    mechanism: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    type: 'synergy' | 'conflict' | 'caution';
  }[];
}

export const ORGAN_SYNERGIES: OrganSynergy[] = [
  {
    id: 'liver',
    organ: 'liver',
    organLabel: '🫁 Печень',
    pairs: [
      { substanceA: 'nac', substanceB: 'tudca', nameA: 'НАК', nameB: 'ТУДКА', effect: 'Двойной гепатопротектор: НАК → глутатион, ТУДКА → желчеотток', mechanism: 'НАК восстанавливает глутатион (антиоксидантный путь), ТУДКА стимулирует bile flow и защищает от холестаза. Покрытие обоих путей повреждения печени.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'milk_thistle', nameA: 'НАК', nameB: 'Расторопша', effect: 'НАК + силимарин: комплексная гепатопротекция', mechanism: 'НАК восстанавливает глутатион, силимарин стабилизирует мембраны гепатоцитов и активирует GST. Двойной механизм защиты.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'tudca', substanceB: 'milk_thistle', nameA: 'ТУДКА', nameB: 'Расторопша', effect: 'Антихолестаз + мембранная защита печени', mechanism: 'ТУДКА покрывает холестатический путь, силимарин — цитотоксический путь. Комплексная гепатопротекция при ААС.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'vit_c', nameA: 'НАК', nameB: 'Витамин C', effect: 'Каскадная антиоксидантная защита печени', mechanism: 'НАК → глутатион (водная фаза), витамин C → прямая нейтрализация ROS + регенерация витамина E (липидная фаза).', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'alpha_lipoic_acid', nameA: 'НАК', nameB: 'Альфа-липоевая кислота', effect: 'Антиоксидантный каскад: НАК → глутатион, АЛК → регенерация витаминов C/E', mechanism: 'НАК предоставляет цистеин для синтеза глутатиона, АЛК напрямую нейтрализует ROS и регенерирует витамины C и E. Полная антиоксидантная защита.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'berberine', substanceB: 'milk_thistle', nameA: 'Берберин', nameB: 'Расторопша', effect: 'Метаболическая + гепатопротекторная поддержка', mechanism: 'Берберин (AMPK-активация) снижает сахар и липиды, силимарин защищает печень от берберин-индуцированного метаболического стресса.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'cardio',
    organ: 'cardio',
    organLabel: '❤️ Сердце и сосуды',
    pairs: [
      { substanceA: 'omega3', substanceB: 'coq10', nameA: 'Омега-3', nameB: 'CoQ10', effect: 'Максимальная кардиопротекция: омега-3 + коэнзим Q10', mechanism: 'Омега-3 встраивается в мембраны кардиомиоцитов (стабилизация), CoQ10 переносит электроны в ETC (энергия). Комбинация оптимизирует митохондриальную функцию.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_k2', nameA: 'Витамин D3', nameB: 'Витамин K2', effect: 'D3+K2: кальций в кости, не в сосуды', mechanism: 'D3 обеспечивает абсорбцию кальция, K2 активирует остеокальцин (направляет Ca в кости) и матриксный Gla-белок (предотвращает кальцификацию сосудов).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'omega3', substanceB: 'magnesium', nameA: 'Омега-3', nameB: 'Магний', effect: 'Омега-3 + магний: антиаритмический + противовоспалительный', mechanism: 'Омега-3 снижает ТГ и воспаление, магний стабилизирует электрическую активность миокарда (блокада Ca2+ каналов). Комбинация снижает риск аритмий.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'magnesium', nameA: 'Витамин D3', nameB: 'Магний', effect: 'D3+Mg: активация витамина D и минерализация костей', mechanism: 'Магний — кофактор 1α-гидроксилазы (конвертирует 25-OH-D → 1,25-(OH)2-D). Без магния витамин D не активируется полностью.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'brain',
    organ: 'brain',
    organLabel: '🧠 Мозг и нервы',
    pairs: [
      { substanceA: 'magnesium', substanceB: 'ashwagandha', nameA: 'Магний', nameB: 'Ашваганда', effect: 'Мощный анксиолитический синергизм', mechanism: 'Магний потенцирует GABA-A рецепторы и блокирует NMDA, ашваганда снижает кортизол через HPA-ось и усиливает GABA-ергическую передачу. Комбинация эффективно купирует тревожность.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_b6', substanceB: 'magnesium', nameA: 'Витамин B6', nameB: 'Магний', effect: 'B6+Mg: кофакторы синтеза серотонина и GABA', mechanism: 'P5P (активный B6) — кофакмент декарбоксилазы (серотонин, GABA, дофамин), магний — кофакмент всех киназных реакций. Магний активирует пиридоксалькиназу.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_b9', substanceB: 'vit_b12', nameA: 'Фолат', nameB: 'Витамин B12', effect: 'Фолат+B12: метилирование и гомоцистеин', mechanism: 'Фолат — донор метильных групп для реметиляции гомоцистеина в метионин, B12 — кофактор метионинсинтазы. B12-дефицит блокирует фолатный цикл (фолатная ловушка).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'magnesium', substanceB: 'melatonin', nameA: 'Магний', nameB: 'Мелатонин', effect: 'Улучшение качества сна', mechanism: 'Магний расслабляет мышцы и потенцирует GABA, мелатонин регулирует циркадные ритмы. Комбинация улучшает onset и глубину сна.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'immune',
    organ: 'immune',
    organLabel: '🛡 Иммунитет',
    pairs: [
      { substanceA: 'vit_d3', substanceB: 'zinc', nameA: 'Витамин D3', nameB: 'Цинк', effect: 'D3+цинк: синергичная иммунная поддержка', mechanism: 'D3 модулирует врождённый и адаптивный иммунитет через VDR, цинк критичен для T-клеток и тимуса. Цинк повышает активность витамин D-связывающего белка.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_c', substanceB: 'zinc', nameA: 'Витамин C', nameB: 'Цинк', effect: 'Комплексная иммунная защита', mechanism: 'Витамин C — антимикробный, нейтрализует ROS в фагоцитах. Цинк — T-клеточный иммунитет и функция тимуса. Комбинация сокращает длительность ОРВИ.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_c', nameA: 'Витамин D3', nameB: 'Витамин C', effect: 'Иммуномодуляция + антиоксидант', mechanism: 'D3 модулирует иммунный ответ (VDR), витамин C поддерживает функцию нейтрофилов и макрофагов. Синергичная защита от инфекций.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'bones',
    organ: 'bones',
    organLabel: '🦴 Кости и суставы',
    pairs: [
      { substanceA: 'bpc157', substanceB: 'tb500', nameA: 'BPC-157', nameB: 'TB-500', effect: 'Максимальная регенерация связок и сухожилий', mechanism: 'BPC-157 стимулирует VEGF/FGF (ангиогенез), TB-500 стимулирует миграцию эндотелиальных клеток и актин-полимеризацию. Комбинация ускоряет восстановление в 3-5 раз.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'bpc157', substanceB: 'vit_c', nameA: 'BPC-157', nameB: 'Витамин C', effect: 'Регенерация + синтез коллагена', mechanism: 'BPC-157 стимулирует ангиогенез и пролиферацию фибробластов, витамин C — кофактор пролил/лизил-гидроксилаз для синтеза коллагена. Структурная + сигнальная поддержка.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_k2', nameA: 'Витамин D3', nameB: 'Витамин K2', effect: 'Минерализация костей без кальцификации сосудов', mechanism: 'D3 → абсорбция кальция, K2 → активация остеокальцина (направляет Ca в кости) и MGP (предотвращает кальцификацию сосудов).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'glucosamine', substanceB: 'chondroitin', nameA: 'Глюкозамин', nameB: 'Хондроитин', effect: 'Синергичная защита суставного хряща', mechanism: 'Глюкозамин — строительный блок гликозаминогликанов, хондроитин — удерживает воду и обеспечивает упругость хряща. Комбинация эффективнее монотерапии.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'hormones',
    organ: 'hormones',
    organLabel: '⚖️ Гормоны',
    pairs: [
      { substanceA: 'zinc', substanceB: 'vit_d3', nameA: 'Цинк', nameB: 'Витамин D3', effect: 'Повышение свободного тестостерона', mechanism: 'Бор усиливает полураспад витамина D и повышает активность 1α-гидроксилазы. Цинк снижает SHBG → больше свободного тестостерона. D3 → рецепция в клетках Лейдига.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'ashwagandha', substanceB: 'magnesium', nameA: 'Ашваганда', nameB: 'Магний', effect: 'Снижение кортизола + повышение тестостерона', mechanism: 'Ашваганда снижает кортизол и повышает DHEA-S (антистресс), магний снижает кортизол через GABA-ергический путь. Синергичный антикортизоловый эффект.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'ashwagandha', substanceB: 'tongkat_ali', nameA: 'Ашваганда', nameB: 'Тонгкат Али', effect: 'Двойной путь повышения тестостерона', mechanism: 'Ашваганда снижает кортизол (антистресс-путь), тонгкат али стимулирует высвобождение LH и увеличивает 17-кетостероиды (HPTA-путь). Покрытие обоих уровней.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'gut',
    organ: 'gut',
    organLabel: '🫃 ЖКТ и микробиом',
    pairs: [
      { substanceA: 'curcumin', substanceB: 'piperine', nameA: 'Куркумин', nameB: 'Пиперин', effect: '10-кратное увеличение биодоступности куркумина', mechanism: 'Пиперин ингибирует UGT и CYP3A4 в кишечнике и печени, повышая абсорбцию куркумина в 10 раз. Также ингибирует P-гликопротеин.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'probiotics', substanceB: 'prebiotic_fiber', nameA: 'Пробиотики', nameB: 'Пребиотическая клетчатка', effect: 'Синбиотик: пробиотики + пребиотики = максимальный микробиомный эффект', mechanism: 'Пребиотики предоставляют субстрат для ферментации пробиотиков, увеличивая их выживаемость и продукцию короткоцепочечных жирных кислот.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'conflicts',
    organ: 'conflicts',
    organLabel: '⚠️ Конфликты и осторожность',
    pairs: [
      { substanceA: 'zinc', substanceB: 'copper', nameA: 'Цинк', nameB: 'Медь', effect: 'Высокие дозы цинка истощают медь', mechanism: 'Цинк ≥50 мг индунцирует металлотионеин, который связывает медь и снижает её абсорбцию. Рекомендация: 2 мг меди на каждые 30 мг цинка.', severity: 'HIGH', type: 'caution' },
      { substanceA: 'iron', substanceB: 'calcium', nameA: 'Железо', nameB: 'Кальций', effect: 'Конкуренция за абсорбцию', mechanism: 'Кальций и железо конкурируют за DMT1-транспортёр. Принимать отдельно: железо натощак, кальций с едой.', severity: 'MEDIUM', type: 'conflict' },
      { substanceA: 'iron', substanceB: 'zinc', nameA: 'Железо', nameB: 'Цинк', effect: 'Конкуренция за абсорбцию', mechanism: 'Высокие дозы железа конкурируют с цинком за DMT1. Принимать с интервалом 2+ часа.', severity: 'MEDIUM', type: 'conflict' },
      { substanceA: 'calcium', substanceB: 'magnesium', nameA: 'Кальций', nameB: 'Магний', effect: 'Конкуренция за абсорбцию при высоких дозах', mechanism: 'Высокие дозы кальция могут снижать абсорбцию магния. Рекомендуемое соотношение Ca:Mg = 2:1.', severity: 'LOW', type: 'caution' },
      { substanceA: 'curcumin', substanceB: 'berberine', nameA: 'Куркумин', nameB: 'Берберин', effect: 'Двойное ингибирование CYP3A4', mechanism: 'Оба ингибируют CYP3A4. Комбинация может повысить концентрацию других препаратов. Осторожность при приёме лекарств.', severity: 'MEDIUM', type: 'caution' },
      { substanceA: 'vit_d3', substanceB: 'calcium', nameA: 'Витамин D3', nameB: 'Кальций', effect: 'Риск гиперкальциемии при высоких дозах', mechanism: 'D3 увеличивает абсорбцию кальция. При дозах D3 >10000 МЕ + кальций >1000 мг возможна гиперкальциемия. Мониторить уровень Ca.', severity: 'LOW', type: 'caution' },
    ]
  },
];


export const SYNERGY_PAIRS: SynergyPair[] = [
  {
    substanceA: 'nac',
    substanceB: 'tudca',
    synergyType: 'synergistic',
    mechanism: 'Синергическая гепатопротекция через разные механизмы: NAC восстанавливает глутатион и нейтрализует свободные радикалы, TUDCA стимулирует bile flow и защищает от холестаза. Комбинация покрывает оба основных пути ААС-индуцированного повреждения печени.',
    affectedSystems: ['hepatic', 'cardio'],
    strength: 0.85,
    clinicalNote: 'Золотой стандарт гепатопротекции на курсах оральных ААС'
  },
  {
    substanceA: 'omega3',
    substanceB: 'telmisartan',
    synergyType: 'complementary',
    mechanism: 'Кардиопротекция через разные пути: телмисартан обеспечивает PPAR-γ агонизм и снижение АД, омега-3 снижает триглицериды и модулирует воспаление. Комбинация максимально снижает кардиоваскулярный риск.',
    affectedSystems: ['cardio', 'renal'],
    strength: 0.75,
    clinicalNote: 'Рекомендуемая комбинация для кардиозащиты на курсаx ААС'
  },
  {
    substanceA: 'magnesium',
    substanceB: 'ashwagandha',
    synergyType: 'synergistic',
    mechanism: 'Анксиолитический синергизм: магний потенцирует GABA-A рецепторы и блокирует NMDA, ашваганда снижает кортизол через модуляцию оси HPA и усиливает GABA-ергическую передачу. Комбинация эффективно купирует нейротоксичность и тревожность.',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.70,
  },
  {
    substanceA: 'zinc',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'Иммуномодуляция синергическая: цинк критичен для функции T-клеток и тимуса, витамин D3 модулирует врождённый и адаптивный иммунитет через VDR. Цинк также повышает активность витамин D-связывающего белка.',
    affectedSystems: ['hematologic', 'endocrine', 'reproductive'],
    strength: 0.65,
  },
  {
    substanceA: 'bpc157',
    substanceB: 'tb500',
    synergyType: 'synergistic',
    mechanism: 'Регенерация через ангиогенез + миграцию клеток: BPC-157 стимулирует VEGF/FGF и ангиогенез, TB-500 (тимозин β4) стимулирует миграцию эндотелиальных клеток и актин-полимеризацию. Комбинация ускоряет восстановление сухожилий, связок и мышц.',
    affectedSystems: ['musculoskeletal', 'cardio', 'neuro'],
    strength: 0.90,
    clinicalNote: 'Наиболее мощная комбинация для восстановления травм мягких тканей'
  },
  {
    substanceA: 'curcumin',
    substanceB: 'piperine',
    synergyType: 'potentiative',
    mechanism: 'Биодоступность куркумина увеличивается в 10 раз при комбинации с пиперином через ингибирование UGT и CYP3A4 в кишечнике и печени. Пиперин также ингибирует P-гликопротеин, усиливая абсорбцию.',
    affectedSystems: ['hepatic', 'cardio'],
    strength: 0.80,
    clinicalNote: 'Пиперин 5-10 мг достаточно для потенциации; более высокие дозы могут усилить токсичность'
  },
  {
    substanceA: 'coq10',
    substanceB: 'omega3',
    synergyType: 'complementary',
    mechanism: 'Митохондриальная защита мембран: коэнзим Q10 переносит электроны в ETC и является антиоксидантом внутренних мембран, омега-3 встраивается в липидный бислой и стабилизирует мембранную структуру. Комбинация оптимизирует митохондриальную функцию кардиомиоцитов.',
    affectedSystems: ['cardio', 'neuro'],
    strength: 0.70,
  },
  {
    substanceA: 'boron',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'Бор усиливает полураспад витамина D в плазме и повышает активность 1α-гидроксилазы в почках. Увеличивает конверсию витамина D в активную форму (25-OH-D3 → 1,25-(OH)2-D3) и снижает SHBG, повышая уровень свободного тестостерона.',
    affectedSystems: ['endocrine', 'musculoskeletal'],
    strength: 0.60,
    clinicalNote: 'Бор 3-6 мг/день достаточен для потенциации витамина D3'
  },
  {
    substanceA: 'ashwagandha',
    substanceB: 'tongkat_ali',
    synergyType: 'synergistic',
    mechanism: 'Повышение тестостерона через два пути: ашваганда снижает кортизол и повышает DHEA-S (антистресс-путь), тонгкат али стимулирует высвобождение LH и увеличивает 17-кетостероиды (гипоталамо-гипофизарный путь). Двойная стимуляция максимизирует эндогенный тестостерон.',
    affectedSystems: ['endocrine', 'reproductive', 'neuro'],
    strength: 0.75,
  },
  {
    substanceA: 'fadogia',
    substanceB: 'tongkat_ali',
    synergyType: 'synergistic',
    mechanism: 'LH/Лейдиг-стимуляция через разные механизмы: фадогия стимулирует гипоталамо-гипофизарную ось к выбросу LH, тонгкат али действует на клетки Лейдига, повышая 17-кетостероиды. Комбинация покрывает оба уровня HPTA.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.70,
    clinicalNote: 'Высокие дозы фадогии могут быть токсичны для яичек при длительном применении'
  },
  {
    substanceA: 'shilajit',
    substanceB: 'iron',
    synergyType: 'complementary',
    mechanism: 'Гематопоэз: фульвокислоты мумиё хелатируют железо, улучшая его транспорт и усвоение, а также стимулируют эритропоэз через митохондриальную поддержку. Комбинация эффективнее монотерапии железом при анемии.',
    affectedSystems: ['hematologic', 'hepatic'],
    strength: 0.55,
    clinicalNote: 'Мумиё также защищает от железо-индуцированного окислительного стресса'
  },
  {
    substanceA: 'milk_thistle',
    substanceB: 'tudca',
    synergyType: 'synergistic',
    mechanism: 'Двойной гепатопротектор: силимарин стабилизирует мембраны гепатоцитов и обеспечивает антиоксидантную защиту (мембранный путь), TUDCA стимулирует bile flow и предотвращает холестаз (холерезный путь). Покрытие обоих механизмов повреждения.',
    affectedSystems: ['hepatic'],
    strength: 0.80,
  },
  {
    substanceA: 'nac',
    substanceB: 'vitamin_c',
    synergyType: 'synergistic',
    mechanism: 'Регенерация глутатиона + прямой антиоксидант: NAC предоставляет цистеин для ресинтеза глутатиона, витамин C напрямую нейтрализует ROS и регенерирует витамин E. Комбинация обеспечивает полную антиоксидантную защиту водной и липидной фаз.',
    affectedSystems: ['hepatic', 'cardio', 'hematologic'],
    strength: 0.70,
  },
  {
    substanceA: 'folate',
    substanceB: 'vitamin_b12',
    synergyType: 'synergistic',
    mechanism: 'Гомоцистеин-снижение синергическое: фолат предоставляет метильную группу для реметиляции гомоцистеина в метионин (через MS), витамин B12 служит кофактором метионинсинтазы. B12-дефицит блокирует фолатный цикл (фолат-ловушка).',
    affectedSystems: ['cardio', 'hematologic', 'neuro'],
    strength: 0.80,
    clinicalNote: 'B12-дефицит делает приём фолата неэффективным — сначала нормализовать B12'
  },
  {
    substanceA: 'bpc157',
    substanceB: 'collagen',
    synergyType: 'complementary',
    mechanism: 'Восстановление сухожилий + строительный материал: BPC-157 стимулирует ангиогенез и пролиферацию фибробластов (сигнальный путь), коллаген предоставляет аминокислоты для синтеза нового матрикса (структурный путь).',
    affectedSystems: ['musculoskeletal'],
    strength: 0.75,
    clinicalNote: 'Оптимальная комбинация для реабилитации после травм сухожилий и связок'
  },
  {
    substanceA: 'trenbolone_acetate',
    substanceB: 'cabergoline',
    synergyType: 'complementary',
    mechanism: 'Контроль пролактина: тренболон повышает пролактин через прогестагенный механизм, каберголин — D2-агонист, подавляющий секрецию пролактина лактотрофами гипофиза. Превентивный приём предотвращает гинекомастию и либидо-дисфункцию.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.70,
    clinicalNote: 'Каберголин 0.25 мг × 2/нед при тренболон-курсах'
  },
  {
    substanceA: 'nandrolone_decanoate',
    substanceB: 'cabergoline',
    synergyType: 'complementary',
    mechanism: 'Контроль прогестаген-индуцированной гиперпролактинемии: нандролон действует как прогестаген, потенцируя секрецию пролактина; каберголин через D2-агонизм подавляет лактотрофы и нормализует уровень пролактина.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.65,
    clinicalNote: 'Нандролон менее пролактиногенен чем тренболон, но контроль необходим'
  },
  {
    substanceA: 'testosterone_enanthate',
    substanceB: 'anastrozole',
    synergyType: 'complementary',
    mechanism: 'Контроль E2: тестостерон ароматизируется в эстрадиол, анастрозол ингибирует ароматазу, предотвращая эстроген-опосредованные побочные эффекты (гинекомастия, задержка жидкости, эмоциональная лабильность).',
    affectedSystems: ['endocrine', 'cardio', 'reproductive'],
    strength: 0.75,
    clinicalNote: 'Анастрозол 0.25-0.5 мг × 2/нед; контролировать E2 в референсе'
  },
  {
    substanceA: 'testosterone_enanthate',
    substanceB: 'hcg',
    synergyType: 'complementary',
    mechanism: 'Предотвращение атрофии яичек: экзогенный тестостерон подавляет LH → атрофия яичек; ХГЧ — LH-аналог, стимулирующий клетки Лейдига и поддерживающий интратестикулярный тестостерон и сперматогенез.',
    affectedSystems: ['reproductive', 'endocrine'],
    strength: 0.85,
    clinicalNote: 'ХГЧ 250-500 МЕ × 2/нед предотвращает атрофию и ускоряет ПКТ'
  },
  {
    substanceA: 'methandienone',
    substanceB: 'tudca',
    synergyType: 'complementary',
    mechanism: 'Контроль холестатического повреждения: оральные ААС (метандиенон) вызывают холестаз через нарушение bile flow и гепатоцитарный стресс; TUDCA восстанавливает bile flow и цитопротекцию гепатоцитов.',
    affectedSystems: ['hepatic'],
    strength: 0.70,
    clinicalNote: 'Применяется при любом орале: метандиенон, станозолол, оксандролон и др.'
  },
  {
    substanceA: 'mk677',
    substanceB: 'berberine',
    synergyType: 'complementary',
    mechanism: 'Контроль инсулинорезистентности: MK-677 (ибутаморен) повышает GH/IGF-1, но вызывает инсулинорезистентность; берберин активирует AMPK, снижает HOMA-IR и глюконеогенез, компенсируя метаболический побочный эффект.',
    affectedSystems: ['endocrine', 'cardio'],
    strength: 0.60,
    clinicalNote: 'Мониторинг HbA1c и HOMA-IR обязателен при MK-677 курсах'
  },
  {
    substanceA: 'vitamin_d3',
    substanceB: 'vitamin_k2',
    synergyType: 'synergistic',
    mechanism: 'Метаболизм кальция: витамин D3 повышает абсорбцию кальция в кишечнике, витамин K2 направляет кальций в кости (через активацию остеокальцина) и предотвращает кальцификацию сосудов (через активацию MGP). Без K2 кальций депонируется в сосудах.',
    affectedSystems: ['musculoskeletal', 'cardio', 'endocrine'],
    strength: 0.75,
    clinicalNote: 'K2 обязателен при дозах витамина D3 >2000 МЕ/день'
  },
  {
    substanceA: 'magnesium',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'Магний — кофактор витамин D-связывающего белка и ферментов метаболизма витамина D (1α-гидроксилаза, 24-гидроксилаза). Дефицит магния снижает конверсию витамина D в активную форму.',
    affectedSystems: ['endocrine', 'musculoskeletal', 'neuro'],
    strength: 0.55,
  },
  {
    substanceA: 'glucosamine',
    substanceB: 'chondroitin',
    synergyType: 'synergistic',
    mechanism: 'Хондропротекция через два компонента: глюкозамин стимулирует синтез гликозаминогликанов и протеогликанов, хондроитин удерживает воду в хряще и подавляет MMP. Комбинация замедляет деградацию хряща эффективнее монотерапии.',
    affectedSystems: ['musculoskeletal'],
    strength: 0.60,
  },
  {
    substanceA: 'collagen',
    substanceB: 'vitamin_c',
    synergyType: 'potentiative',
    mechanism: 'Витамин C — кофактор пролил- и лизилгидроксилазы, критичных ферментов синтеза коллагена. Без витамина C синтез нового коллагена невозможен; комбинация значительно ускоряет восстановление хряща и сухожилий.',
    affectedSystems: ['musculoskeletal'],
    strength: 0.70,
  },
  {
    substanceA: 'alpha_lipoic',
    substanceB: 'nac',
    synergyType: 'synergistic',
    mechanism: 'Универсальная антиоксидантная защита: α-липоевая кислота восстанавливает витамин C/E и повышает глутатион, NAC предоставляет цистеин для синтеза нового глутатиона. Комбинация покрывает водную и липидную фазы антиоксидантной защиты.',
    affectedSystems: ['hepatic', 'neuro', 'cardio'],
    strength: 0.65,
  },
  {
    substanceA: 'omega3',
    substanceB: 'vitamin_d3',
    synergyType: 'additive',
    mechanism: 'Кардио-иммунная защита: омега-3 снижает триглицериды и модулирует воспаление, витамин D3 регулирует иммунный ответ и ренин-ангиотензиновую систему. Жирорастворимый витамин D3 лучше абсорбируется с жирами омега-3.',
    affectedSystems: ['cardio', 'hematologic', 'endocrine'],
    strength: 0.50,
  },
  {
    substanceA: 'selenium',
    substanceB: 'vitamin_e',
    synergyType: 'synergistic',
    mechanism: 'Селен — кофактор глутатионпероксидазы, витамин E — цепнорающий антиоксидант липидных мембран. Селен регенерирует окисленный витамин E; комбинация обеспечивает полную антиоксидантную защиту клеточных мембран.',
    affectedSystems: ['cardio', 'hepatic', 'endocrine'],
    strength: 0.55,
  },
  {
    substanceA: 'melatonin',
    substanceB: 'magnesium',
    synergyType: 'synergistic',
    mechanism: 'Улучшение качества сна: мелатонин инициирует циркадный сигнал засыпания, магний потенцирует GABA-ергическую передачу и расслабляет мышцы. Комбинация обеспечивает глубокую фазу сна и мышечное восстановление.',
    affectedSystems: ['neuro', 'musculoskeletal'],
    strength: 0.65,
  },
  {
    substanceA: 'cjc1295',
    substanceB: 'ipamorelin',
    synergyType: 'synergistic',
    mechanism: 'GHRH (CJC-1295) + GHRP (ипаморелин) — классическая синергия: CJC-1295 увеличивает амплитуду GH-пульса, ипаморелин увеличивает частоту. Вместе дают 3-5× прирост GH vs моно-терапия.',
    affectedSystems: ['endocrine', 'musculoskeletal'],
    strength: 0.85,
    clinicalNote: 'Золотой стандарт GH-терапии: CJC-1295 100мкг + ипаморелин 100мкг 1-3×/день'
  },
  {
    substanceA: 'semax',
    substanceB: 'selank',
    synergyType: 'synergistic',
    mechanism: 'Семакс (BDNF-стимуляция, нейропротекция через TrkB-рецепторы) + Селанк (анксиолитик-пептид, модуляция GABA-рецепторов) = синергетическая нейропротекция + анксиолиз. Оптимальный циркадный профиль: стимулирующий (утро) и седативный (вечер).',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.7,
    clinicalNote: 'Семакс утром, Селанк вечером — оптимальный циркадный профиль'
  },
  {
    substanceA: 'ghk_cu',
    substanceB: 'vitamin_c',
    synergyType: 'synergistic',
    mechanism: 'GHK-Cu (медь-пептид) активирует синтез коллагена I/III через регуляцию генов. Витамин C — кофактор пролилгидроксилазы, необходимой для гидроксилирования пролина в коллагене. Без витамина C синтезированный коллаген нестабилен.',
    affectedSystems: ['musculoskeletal', 'hepatic'],
    strength: 0.75,
  },
  {
    substanceA: 'mots_c',
    substanceB: 'aod9604',
    synergyType: 'complementary',
    mechanism: 'MOTS-C (AMPK-активация → метаболическая нормализация) + AOD-9604 (липолиз, ингибирование липогенеза) = синергия жиросжигания и метаболического здоровья.',
    affectedSystems: ['endocrine', 'cardio'],
    strength: 0.65,
  },
  {
    substanceA: 'dsip',
    substanceB: 'melatonin',
    synergyType: 'synergistic',
    mechanism: 'DSIP (ГAMК-модуляция → дельта-сон) + Мелатонин (циркадный ритм → засыпание) = усиление глубоких фаз сна. Комбинация превосходит моно-терапию по качеству сна на 40%.',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.7,
  },
  {
    substanceA: 'ss31',
    substanceB: 'coq10',
    synergyType: 'complementary',
    mechanism: 'SS-31 стабилизирует кардиолипин внутренней митохондриальной мембраны → CoQ10 эффективнее переносит электроны в дыхательной цепи. Комбинация ↑ АТФ-продукцию на 30-50% vs моно.',
    affectedSystems: ['cardio', 'hepatic'],
    strength: 0.7,
  },
  {
    substanceA: 'foxo4_dri',
    substanceB: 'bpc157',
    synergyType: 'complementary',
    mechanism: 'FOXO4-DRI удаляет стареющие клетки (сенолитик) → BPC-157 стимулирует регенерацию в освободившемся тканевом пространстве. Комбинация сенолизис + регенерация = омоложение тканей.',
    affectedSystems: ['musculoskeletal', 'hepatic', 'renal'],
    strength: 0.65,
    clinicalNote: 'FOXO4-DRI 1×/нед + BPC-157 ежедневно = оптимальный протокол'
  },
];

export const SUPPLEMENT_TARGETS: Record<string, SupplementTarget> = {
  telmisartan: {
    systems: ['cardio', 'renal', 'endocrine'],
    organs: ['heart', 'vascular', 'kidneys'],
    biomarkers: ['АД', 'TG', 'HOMA-IR', 'CREATININE', 'UREA'],
    mechanisms: ['ANG II блокада', 'PPAR-γ частичный агонизм', 'снижение TGF-β1', 'нефропротекция через снижение внутриклубочкового давления']
  },
  nebivolol: {
    systems: ['cardio'],
    organs: ['heart', 'vascular'],
    biomarkers: ['АД', 'ЧСС', 'NO биодоступность'],
    mechanisms: ['β1-селективная блокада', 'NO-опосредованная вазодилатация', 'эндотелиальная функция', 'антиоксидант сосудистой стенки']
  },
  nac: {
    systems: ['hepatic', 'neuro', 'cardio', 'hematologic'],
    organs: ['liver', 'brain', 'lungs'],
    biomarkers: ['ALT', 'AST', 'GGT', 'глутатион', 'BIL', 'CRP'],
    mechanisms: ['предшественник глутатиона', 'цистеин-пулирование', 'NF-κB ингибирование', 'детоксикация через конъюгацию', 'муколитик (расщепление дисульфидных связей)']
  },
  tudca: {
    systems: ['hepatic'],
    organs: ['liver', 'gallbladder'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'BIL', 'DBIL'],
    mechanisms: ['стимуляция bile flow', 'холерез', 'цитопротекция гепатоцитов', 'анти-апоптоз через ER stress reduction', 'стабилизация митохондриальных мембран']
  },
  omega3: {
    systems: ['cardio', 'neuro', 'hematologic'],
    organs: ['heart', 'vascular', 'brain'],
    biomarkers: ['TG', 'HDL', 'CRP', 'IL-6', 'TNF-α'],
    mechanisms: ['снижение синтеза триглицеридов в печени', 'резольвин/протектин медиация', 'стабилизация мембран', 'анти-тромботический эффект', 'модуляция ионных каналов кардиомиоцитов']
  },
  magnesium: {
    systems: ['neuro', 'cardio', 'musculoskeletal'],
    organs: ['brain', 'heart', 'nervous_system', 'muscles'],
    biomarkers: ['MG', 'Калий', 'АД', 'CRP', 'кортизол'],
    mechanisms: ['GABA-A потенцирование', 'NMDA блокада', 'блокада кальциевых каналов', 'расслабление гладкой мускулатуры', 'кофактор АТФазы']
  },
  berberine: {
    systems: ['endocrine', 'hepatic', 'cardio'],
    organs: ['liver', 'pancreas', 'vascular'],
    biomarkers: ['HbA1c', 'HOMA-IR', 'LDL', 'TG', 'GLU', 'INS'],
    mechanisms: ['AMPK активация', 'ингибирование глюконеогенеза', 'LDL-R вверхрегуляция', 'модуляция микробиома', 'ингибирование CYP3A4']
  },
  coq10: {
    systems: ['cardio', 'neuro'],
    organs: ['heart', 'brain', 'mitochondria'],
    biomarkers: ['LDL', 'AST', 'CK', 'CRP'],
    mechanisms: ['электронный перенос в ETC (Complex III → Complex II)', 'антиоксидант липидных мембран', 'регенерация витамина E', 'стабилизация митохондриального мембранного потенциала']
  },
  vitamin_d3: {
    systems: ['endocrine', 'hematologic', 'neuro', 'musculoskeletal'],
    organs: ['bone_marrow', 'bones', 'thyroid', 'gut'],
    biomarkers: ['VITD', 'CA', 'P', 'ALP', 'iPTH', 'SHBG'],
    mechanisms: ['VDR-опосредованная транскрипция', 'кальциевый гомеостаз', 'иммуномодуляция Th1/Th2', 'модуляция ренин-ангиотензиновой системы', 'регуляция остеокальцина']
  },
  zinc: {
    systems: ['reproductive', 'hematologic', 'endocrine'],
    organs: ['testes', 'prostate', 'bone_marrow', 'thymus'],
    biomarkers: ['TT', 'FT', 'WBC', 'SHBG', 'DHT'],
    mechanisms: ['кофактор 5α-редуктазы', 'стимуляция клеток Лейдига', 'T-клеточная пролиферация', 'инсулин-подобный фактор роста модуляция', 'металлотионеин индукция']
  },
  hcg: {
    systems: ['reproductive', 'endocrine'],
    organs: ['testes', 'hypothalamus', 'pituitary'],
    biomarkers: ['TT', 'LH', 'FSH', 'интра-тестикулярный T', 'спермограмма'],
    mechanisms: ['LH-рецептор агонизм', 'стимуляция клеток Лейдига', 'стимуляция клеток Сертоли', 'поддержание сперматогенеза', 'превентирование атрофии яичек']
  },
  alpha_lipoic: {
    systems: ['neuro', 'cardio', 'hepatic'],
    organs: ['nervous_system', 'brain', 'liver'],
    biomarkers: ['CRP', 'ALT', 'AST', 'HbA1c', 'гликированный Hb'],
    mechanisms: ['универсальный антиоксидант (водный + липидный)', 'регенерация витаминов C и E', 'повышение глутатиона через Nrf2', 'хелатирование тяжёлых металлов', 'улучшение митохондриальной функции']
  },
  ashwagandha: {
    systems: ['neuro', 'endocrine', 'reproductive'],
    organs: ['brain', 'adrenals', 'testes', 'thyroid'],
    biomarkers: ['кортизол', 'DHEA-S', 'TT', 'TSH', 'FT3', 'FT4'],
    mechanisms: ['GABA-A модуляция', 'снижение кортизола (ось HPA)', 'андрогенный эффект (повышение LH)', 'тиреоидная стимуляция', 'антистресс-адаптогенез']
  },
  saw_palmetto: {
    systems: ['reproductive'],
    organs: ['prostate', 'testes', 'hair_follicles'],
    biomarkers: ['DHT', 'PSA', 'TT/DHT ratio'],
    mechanisms: ['5α-редуктаза ингибирование (тип II)', 'антиандрогенный эффект на DHT', 'α1-адреноблокада', 'анти-пролиферативный эффект на простату']
  },
  celery_extract: {
    systems: ['renal', 'cardio'],
    organs: ['kidneys', 'vascular'],
    biomarkers: ['UA', 'CREATININE', 'АД', 'UREA'],
    mechanisms: ['снижение мочевой кислоты', 'апигенин-опосредованная вазодилатация', 'антиоксидант фталидов', 'диуретический эффект']
  },
  vitamin_k2: {
    systems: ['cardio', 'musculoskeletal', 'endocrine'],
    organs: ['vascular', 'bones', 'liver'],
    biomarkers: ['кальцификация сосудов', 'остеокальцин', 'DPD', 'CA', 'ALP'],
    mechanisms: ['γ-карбоксилирование остеокальцина', 'γ-карбоксилирование MGP', 'направление кальция в кости', 'предотвращение кальцификации сосудов', 'синергия с витамином D3']
  },
  selenium: {
    systems: ['endocrine', 'hematologic', 'neuro'],
    organs: ['thyroid', 'bone_marrow', 'brain'],
    biomarkers: ['TSH', 'FT3', 'FT4', 'GPx активность', 'selenoprotein P'],
    mechanisms: ['кофактор глутатионпероксидазы', 'кофактор дейодиназ (T4→T3)', 'антиоксидант щитовидной железы', 'T-клеточная модуляция', 'Nrf2 путь активации']
  },
  milk_thistle: {
    systems: ['hepatic'],
    organs: ['liver', 'gallbladder'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'BIL', 'фиброз-маркеры'],
    mechanisms: ['силибинин — мембраностабилизация', 'антиоксидант через Nrf2', 'антифибротический (TGF-β1 ингибирование)', 'CYP3A4 ингибирование', 'стимуляция рибосомальной РНК-полимеразы']
  },
  probiotics: {
    systems: ['hepatic', 'hematologic'],
    organs: ['gut', 'liver', 'lymphatic'],
    biomarkers: ['CRP', 'endotoxin LPS', 'SCFA', 'ALT', 'GGT'],
    mechanisms: ['модуляция микробиома', 'ось кишечник-печень (печёночный клиренс LPS)', 'продукция бутирата (SCFA)', 'барьерная функция кишечника', 'иммуноглобулин A стимуляция']
  },
  vitamin_b12: {
    systems: ['hematologic', 'neuro'],
    organs: ['bone_marrow', 'nervous_system', 'brain'],
    biomarkers: ['B12', 'HGB', 'HCT', 'MCV', 'гомоцистеин', 'FOL'],
    mechanisms: ['метионинсинтаза кофактор', 'миелинизация нервов', 'эритропоэз (ДНК-синтез)', 'реметиляция гомоцистеина', 'фолатный цикл кофактор']
  },
  vitamin_b6: {
    systems: ['neuro', 'hematologic', 'hepatic'],
    organs: ['brain', 'nervous_system', 'bone_marrow', 'liver'],
    biomarkers: ['PLP', 'гомоцистеин', 'ALT', 'AST', 'HGB'],
    mechanisms: ['PLP-зависимый синтез нейромедиаторов', 'трансаминаза кофактор', 'метаболизм гомоцистеина', 'гем-синтез', 'глюконеогенез']
  },
  folate: {
    systems: ['hematologic', 'cardio', 'neuro'],
    organs: ['bone_marrow', 'vascular', 'nervous_system'],
    biomarkers: ['FOL', 'гомоцистеин', 'HGB', 'MCV', 'B12'],
    mechanisms: ['5-метилTHF — донор метильных групп', 'реметиляция гомоцистеина', 'пурино-пиримидиновый синтез', 'ДНК-метиляция', 'эритропоэз поддержка']
  },
  iron: {
    systems: ['hematologic', 'cardio'],
    organs: ['bone_marrow', 'liver', 'heart'],
    biomarkers: ['FERRITIN', 'HGB', 'HCT', 'TIBC', 'FOL', 'TRANSFERRIN'],
    mechanisms: ['гем-синтез', 'эритропоэз', 'кислородный транспорт', 'митохондриальное железо-серные кластеры', 'каталаза кофактор']
  },
  copper: {
    systems: ['hematologic', 'neuro'],
    organs: ['bone_marrow', 'liver', 'nervous_system'],
    biomarkers: ['Церулоплазмин', 'Cu/Zn-SOD', 'HGB', 'MCV'],
    mechanisms: ['церулоплазмин (Fe2+→Fe3+ оксидаза)', 'Cu/Zn-SOD антиоксидант', 'лизилоксидаза (cross-link collagen)', 'цитохром c оксидаза', 'миелинизация ЦНС']
  },
  astragalus: {
    systems: ['renal', 'hematologic', 'cardio'],
    organs: ['kidneys', 'bone_marrow', 'vascular'],
    biomarkers: ['CREATININE', 'протеинурия', 'UREA', 'CRP', 'WBC'],
    mechanisms: ['астрагалозид IV — нефропротекция', 'T-клеточная модуляция', 'анти-фибротический TGF-β1', 'антиоксидант (Nrf2 путь)', 'NO-опосредованная вазодилатация']
  },
  taurine: {
    systems: ['cardio', 'neuro', 'hepatic', 'renal'],
    organs: ['heart', 'brain', 'liver', 'retina'],
    biomarkers: ['АД', 'ЧСС', 'ALT', 'AST', 'CREATININE'],
    mechanisms: ['осмолит кардиомиоцитов', 'антиаритмический (Ca2+ модуляция)', 'конъюгация bile acids', 'GABA-A модуляция', 'антиоксидант (таурин-хлорамин)']
  },
  melatonin: {
    systems: ['neuro', 'endocrine', 'cardio'],
    organs: ['brain', 'pineal', 'heart', 'gut'],
    biomarkers: ['мелатонин слюны', 'кортизол', 'CRP', 'IL-6', 'TNF-α'],
    mechanisms: ['MT1/MT2 рецептор агонизм', 'циркадная регуляция', 'антиоксидант (прямое нейтральное ROS)', 'Nrf2 активация', 'модуляция иммунитета (Th1/Th2)']
  },
  ginseng: {
    systems: ['endocrine', 'neuro', 'cardio', 'hematologic'],
    organs: ['adrenals', 'brain', 'heart', 'gonads'],
    biomarkers: ['NO', 'IGF-1', 'кортизол', 'АД', 'WBC'],
    mechanisms: ['гинзенозиды — адаптогенный эффект', 'NO-синтаза активация', 'HPA-ось модуляция', 'IGF-1 повышение', 'иммуномодуляция макрофагов']
  },
  egcg: {
    systems: ['cardio', 'hepatic', 'neuro', 'hematologic'],
    organs: ['liver', 'vascular', 'brain'],
    biomarkers: ['ALT', 'TG', 'CRP', 'LDL', 'COMT активность'],
    mechanisms: ['COMT ингибирование', 'Nrf2 активация', 'антиангиогенез (VEGF ингибирование)', 'AMPK активация', 'антиоксидант (Fe-хелатирование)']
  },
  curcumin: {
    systems: ['hepatic', 'cardio', 'neuro', 'hematologic'],
    organs: ['liver', 'brain', 'vascular', 'gut'],
    biomarkers: ['ALT', 'CRP', 'IL-6', 'TNF-α', 'NF-κB'],
    mechanisms: ['NF-κB ингибирование', 'COX-2/LOX ингибирование', 'Nrf2 активация', 'антифибротический', 'биодоступность ×10 с пиперином']
  },
  phosphatidylcholine: {
    systems: ['hepatic', 'neuro', 'cardio'],
    organs: ['liver', 'brain', 'vascular'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'HDL', 'ApoA1'],
    mechanisms: ['мембранная реставрация гепатоцитов', 'синтез VLDL (липидный транспорт)', 'ацетилхолин прекурсор', 'анти-фиброзный', 'холерезный эффект']
  },
  l_carnitine: {
    systems: ['cardio', 'neuro', 'hepatic'],
    organs: ['heart', 'brain', 'liver', 'muscles'],
    biomarkers: ['TG', 'LDL', 'HDL', 'AST', 'CK', 'АД'],
    mechanisms: ['транспорт LCFA в митохондрии (CPT I/II)', 'ацил-КоA/КоA баланс', 'антиоксидант (ROS в митохондриях)', 'NO-опосредованная эндотелиальная функция', 'удаление ацильных групп']
  },
  glucosamine: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'cartilage'],
    biomarkers: ['клиническая боль в суставах', 'WOMAC', 'рентген-прогрессия'],
    mechanisms: ['субстрат гликозаминогликанов', 'стимуляция протеогликанов', 'ингибирование MMP', 'снижение IL-1β в хряще', 'stimуляция хондроцитов']
  },
  chondroitin: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'cartilage'],
    biomarkers: ['WOMAC', 'синовиальная жидкость гиалуронан', 'CTX-II'],
    mechanisms: ['удержание воды в хряще', 'подавление MMP-3/MMP-9', 'ингибирование эластазы лейкоцитов', 'стимуляция протеогликанов', 'конкуренция с катепсинами']
  },
  msm: {
    systems: ['musculoskeletal', 'hematologic'],
    organs: ['joints', 'cartilage', 'skin'],
    biomarkers: ['CRP', 'IL-6', 'WOMAC', 'суставная подвижность'],
    mechanisms: ['донор серы для хондроитина/кератина', 'NF-κB ингибирование', 'анти-воспалительный', 'коллаген-синтез поддержка', 'GLUTATHIONE повышение']
  },
  collagen: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'tendons', 'ligaments', 'skin', 'bone'],
    biomarkers: ['PRO-COLLAGEN II', 'CTx-II', 'PIIINP', 'клиническая боль'],
    mechanisms: ['субстрат для фибробластов', 'глицин/пролин/гидроксипролин поставка', 'стимуляция хондроцитов', 'стимуляция синтеза коллагена I и III', 'биомеханика сухожилий']
  },
  hyaluronic: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'skin'],
    biomarkers: ['синовиальная вязкость', 'WOMAC', 'кожная гидратация'],
    mechanisms: ['осмотический буфер сустава', 'смазка суставных поверхностей', 'стимуляция синовиоцитов', 'CD44-опосредованная сигнализация', 'анти-воспалительный (TLR4 ингибирование)']
  },
  boswellia: {
    systems: ['musculoskeletal', 'neuro', 'hematologic'],
    organs: ['joints', 'gut', 'brain'],
    biomarkers: ['CRP', 'IL-6', 'LTB4', 'WOMAC'],
    mechanisms: ['5-LOX ингибирование (босвеллиевые кислоты)', 'антагонизм LTB4', 'C4S ингибирование (цитокин-супрессор)', 'микроциркуляция', 'мягкая нейропротекция']
  },
  vitamin_c: {
    systems: ['hematologic', 'musculoskeletal', 'cardio', 'neuro'],
    organs: ['bone_marrow', 'skin', 'joints', 'vascular', 'brain'],
    biomarkers: ['витамин C плазмы', 'CRP', 'HGB', 'лейкоциты', 'коллаген-маркеры'],
    mechanisms: ['антиоксидант водной фазы', 'кофактор пролил-/лизилгидроксилазы (коллаген)', 'кофактор карнитин-синтеза', 'регенерация витамина E', 'иммуностимуляция (NK-клетки, фагоцитоз)']
  },
  bromelain: {
    systems: ['musculoskeletal', 'hematologic'],
    organs: ['joints', 'gut', 'skin'],
    biomarkers: ['CRP', 'отёк', 'фибриноген', 'WOMAC'],
    mechanisms: ['протеолиз фибрина (фибринолитик)', 'брадикинин-разрушение (противоотёчный)', 'COX-2 ингибирование', 'TGF-β модуляция', 'модуляция цитокинов']
  },
  bpc157: {
    systems: ['musculoskeletal', 'neuro', 'hepatic'],
    organs: ['tendons', 'ligaments', 'gut', 'brain', 'liver'],
    biomarkers: ['VEGF', 'FGF', 'NO', 'заживление ран', 'ANG-1/2'],
    mechanisms: ['ангиогенез (VEGF/FGF)', 'NO-путь цитопротекции', 'стимуляция фибробластов', 'стимуляция миофибробластов', 'модуляция допаминергической системы']
  },
  tb500: {
    systems: ['musculoskeletal', 'cardio', 'neuro'],
    organs: ['heart', 'tendons', 'ligaments', 'skin', 'brain'],
    biomarkers: ['тимозин β4', 'VEGF', 'актин', 'миокардиальныйRepair'],
    mechanisms: ['миграция эндотелиальных клеток', 'актин-полимеризация', 'ангиогенез', 'противоспалительный (NF-κB)', 'кардиякопротекция при ишемии']
  },
  meloxicam: {
    systems: ['musculoskeletal'],
    organs: ['joints'],
    biomarkers: ['CRP', 'IL-6', 'PGE2', 'CREATININE', 'ALT'],
    mechanisms: ['COX-2 селективное ингибирование', 'PGE2 снижение', 'анальгезия', 'противовоспалительный']
  },
  diclofenac: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'liver', 'kidneys'],
    biomarkers: ['CRP', 'IL-6', 'PGE2', 'ALT', 'CREATININE', 'TG'],
    mechanisms: ['COX-1/COX-2 ингибирование', 'PGE2/PGI2 снижение', 'анальгезия', 'противовоспалительный', 'липоксин ингибирование']
  },
  tongkat_ali: {
    systems: ['endocrine', 'reproductive', 'neuro'],
    organs: ['testes', 'hypothalamus', 'pituitary', 'adrenals'],
    biomarkers: ['TT', 'FT', 'LH', 'SHBG', 'кортизол', 'DHEA-S'],
    mechanisms: ['LH высвобождение стимуляция', '17-кетостероиды повышение', 'SHBG снижение', 'антикортизольный эффект', 'кверцин/A-антиоксидант']
  },
  fadogia: {
    systems: ['endocrine', 'reproductive'],
    organs: ['testes', 'hypothalamus', 'pituitary'],
    biomarkers: ['LH', 'TT', 'FT', 'интра-тестикулярный T'],
    mechanisms: ['гипоталамо-гипофизарная LH-стимуляция', 'прямая Лейдиг-стимуляция', 'отличный от тонгкат али механизм', 'сапонин-опосредованная активация']
  },
  shilajit: {
    systems: ['hematologic', 'hepatic', 'endocrine'],
    organs: ['bone_marrow', 'liver', 'testes', 'mitochondria'],
    biomarkers: ['FERRITIN', 'HGB', 'ATP', 'коэнзим Q10', 'TSH'],
    mechanisms: ['фульвокислоты — минеральный транспорт', 'Fe-хелатирование и гематопоэз', 'митохондриальная ATP-оптимизация', 'Dibenzo-α-пироны — антиоксидант', 'тиреоидная поддержка']
  },
  boron: {
    systems: ['endocrine', 'musculoskeletal'],
    organs: ['bones', 'testes', 'thyroid'],
    biomarkers: ['VITD', 'SHBG', 'TT', 'CA', 'остеокальцин'],
    mechanisms: ['витамин D полураспад увеличение', '1α-гидроксилаза потенциация', 'SHBG снижение', 'остеокальцин модуляция', 'магний/кальций реабсорбция']
  },
};

export function checkSupportInteractions(
  substanceIds: string[]
): { synergies: SupportInteraction[]; conflicts: SupportInteraction[]; cautions: SupportInteraction[] } {
  const synergies: SupportInteraction[] = [];
  const conflicts: SupportInteraction[] = [];
  const cautions: SupportInteraction[] = [];
  const seen = new Set<string>();
  for (const id of substanceIds) {
    const interactions = findInteractionsForSubstance(id);
    for (const inter of interactions) {
      const otherId = inter.substanceA === id ? inter.substanceB : inter.substanceA;
      if (substanceIds.includes(otherId) && !seen.has(inter.interactionId)) {
        seen.add(inter.interactionId);
        if (inter.type === 'synergy') synergies.push(inter);
        else if (inter.type === 'conflict') conflicts.push(inter);
        else if (inter.type === 'caution') cautions.push(inter);
      }
    }
  }
  return { synergies, conflicts, cautions };
}

export function findSupportForSystem(systemId: string): SupportSubstance[] {
  return findSubstancesByOrgan(systemId);
}

export function findSupportForGoal(
  goalRisks: string[],
  maxResults: number = 20
): { substance: SupportSubstance; relevanceScore: number }[] {
  const scored: { substance: SupportSubstance; score: number }[] = [];
  for (const sub of ALL_SUBSTANCES) {
    let score = 0;
    for (const risk of goalRisks) {
      const riskLower = risk.toLowerCase();
      if (sub.deficiency && (sub.deficiency||'').toLowerCase().includes(riskLower)) score += 3;
      if ((sub.organs||[]).some(o => riskLower.includes((o||'').toLowerCase()))) score += 1;
      if ((sub.mechanisms||[]).some(m => riskLower.includes((m||'').toLowerCase()))) score += 1;
      if (sub.description && (sub.description||'').toLowerCase().includes(riskLower)) score += 1;
      if ((sub.categories||[]).some(c => riskLower.includes((c||'').toLowerCase()))) score += 2;
    }
    if (score > 0) scored.push({ substance: sub, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => ({ substance: s.substance, relevanceScore: s.score }));
}

/** Goal-aware substance scoring: scores substances by how well they support a given fitness goal */
export function findSupportByGoal(
  goal: string,
  maxResults: number = 20
): { substance: SupportSubstance; relevanceScore: number }[] {
  // Map goals to relevant systems, mechanisms, and organ targets
  const goalMap: Record<string, { organs: string[]; mechs: string[]; cats: string[] }> = {
    muscle_gain: {
      organs: ['musculoskeletal', 'endocrine', 'hepatic'],
      mechs: ['protein synthesis', 'testosterone', 'anabolic', 'anti-catabolic', 'growth hormone', 'mTOR', 'nitrogen', 'creatine'],
      cats: ['amino acid', 'mineral', 'protein', 'testosterone booster', 'adaptogen'],
    },
    strength: {
      organs: ['musculoskeletal', 'neuro', 'endocrine'],
      mechs: ['testosterone', 'strength', 'power', 'neural', 'creatine', 'cns', 'atp', 'phosphocreatine'],
      cats: ['amino acid', 'mineral', 'testosterone booster', 'nootropic'],
    },
    fat_loss: {
      organs: ['endocrine', 'hepatic', 'cardio'],
      mechs: ['metabolism', 'fat oxidation', 'thermogenesis', 'insulin', 'thyroid', 'lipolysis', 'beta-oxidation'],
      cats: ['thermogenic', 'metabolism', 'fat burner', 'adaptogen', 'mineral'],
    },
    endurance: {
      organs: ['cardio', 'hematologic', 'musculoskeletal'],
      mechs: ['oxygen', 'mitochondrial', 'atp', 'endurance', 'vo2', 'nitric oxide', 'blood flow', 'red blood cell'],
      cats: ['amino acid', 'mineral', 'vasodilator', 'adaptogen', 'cardio'],
    },
    recomp: {
      organs: ['endocrine', 'musculoskeletal', 'hepatic'],
      mechs: ['metabolism', 'testosterone', 'muscle', 'fat', 'hormone', 'thyroid', 'protein synthesis'],
      cats: ['adaptogen', 'amino acid', 'mineral', 'testosterone booster', 'metabolism'],
    },
    maintenance: {
      organs: ['cardio', 'hepatic', 'endocrine', 'neuro'],
      mechs: ['antioxidant', 'health', 'immune', 'vitamin', 'mineral', 'inflammation'],
      cats: ['vitamin', 'mineral', 'antioxidant', 'adaptogen', 'omega'],
    },
  };

  const cfg = goalMap[goal] || goalMap.maintenance;
  const scored: { substance: SupportSubstance; score: number }[] = [];

  for (const sub of ALL_SUBSTANCES) {
    let score = 0;
    for (const organ of cfg.organs) {
      if ((sub.organs||[]).some(o => (o||'').toLowerCase().includes(organ))) score += 4;
    }
    for (const mech of cfg.mechs) {
      if ((sub.mechanisms||[]).some(m => (m||'').toLowerCase().includes(mech))) score += 3;
    }
    for (const cat of cfg.cats) {
      if ((sub.categories||[]).some(c => (c||'').toLowerCase().includes(cat))) score += 2;
    }
    if (sub.description && cfg.mechs.some(m => sub.description.toLowerCase().includes(m))) score += 1;
    if (score > 0) scored.push({ substance: sub, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => ({ substance: s.substance, relevanceScore: s.score }));
}

export function getSupportDatabaseStats() {
  return {
    totalSubstances: ALL_SUBSTANCES.length,
    totalInteractions: ALL_INTERACTIONS.length,
    totalRisks: ALL_RISKS.length,
  };
}

export function generateSupportStack(goal: string, blacklist: string[] = []): SubstanceEntry[] {
  const goalEntry = MASTER_DB.goals.find(g => g.id === goal);
  if (!goalEntry) {
    return [];
  }

  const supportingSubstances: SubstanceEntry[] = [];

  for (const substance of MASTER_DB.substances) {
    if (blacklist.includes(substance.id)) {
      continue;
    }

    let supportsGoal = false;
    for (const [effectId, priority] of Object.entries(goalEntry.effectPriority)) {
      if (priority > 0) {
        const hasEffect = substance.effects?.some(e => e.effect === effectId) || false;
        if (hasEffect) {
          supportsGoal = true;
          break;
        }
      }
    }

    if (supportsGoal) {
      supportingSubstances.push(substance);
    }
  }

  return supportingSubstances.slice(0, 5);
}
