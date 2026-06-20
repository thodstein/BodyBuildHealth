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
import { resolveCanonicalId } from '../data/canonical-map';
import { SUPPORT_CATALOG_DATA } from '../data/support-catalog';

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
  telmisartan:      [{ study: 'Fliser D. et al., Hypertension 2011', conclusion: 'РўРµР»РјРёСЃР°СЂС‚Р°РЅ вЂ” ARB СЃ РґРѕРєР°Р·Р°РЅРЅС‹Рј РЅРµС„СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂРЅС‹Рј Рё РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёРј СЌС„С„РµРєС‚РѕРј. РЎРЅРёР¶Р°РµС‚ СЂРёСЃРє Р”Рќ Рё СѓР»СѓС‡С€Р°РµС‚ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ Рє РёРЅСЃСѓР»РёРЅСѓ С‡РµСЂРµР· PPAR-Оі.', year: 2011 }],
  nebivolol:        [{ study: 'Vanhoutte PM. et al., J Hypertens 2013', conclusion: 'РќРµР±РёРІРѕР»РѕР» вЂ” ОІ1-СЃРµР»РµРєС‚РёРІРЅС‹Р№ Р±Р»РѕРєР°С‚РѕСЂ СЃ NO-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅРѕР№ РІР°Р·РѕРґРёР»Р°С‚Р°С†РёРµР№. РњРёРЅРёРјР°Р»СЊРЅРѕРµ РІР»РёСЏРЅРёРµ РЅР° РјРµС‚Р°Р±РѕР»РёР·Рј Рё СЌСЂРµРєС‚РёР»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ.', year: 2013 }],
  nac:              [{ study: 'Samuni Y. et al., Curr Mol Pharmacol 2013', conclusion: 'NAC вЂ” РїСЂРµРґС€РµСЃС‚РІРµРЅРЅРёРє РіР»СѓС‚Р°С‚РёРѕРЅР°, РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё Р°С†РµС‚Р°РјРёРЅРѕС„РµРЅРѕРІРѕР№ Рё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё. РђРЅС‚РёРѕРєСЃРёРґР°РЅС‚, РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ.', year: 2013 }],
  tudca:            [{ study: 'Beuers U. et al., Dig Dis 2010', conclusion: 'TUDCA вЂ” СѓСЂСЃРѕРґРµР·РѕРєСЃРёС…РѕР»РµРІР°СЏ РєРёСЃР»РѕС‚Р°, РґРѕРєР°Р·Р°РЅРЅР°СЏ СЌС„С„РµРєС‚РёРІРЅРѕСЃС‚СЊ РїСЂРё С…РѕР»РµСЃС‚Р°Р·Рµ Рё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё. РЎС‚РёРјСѓР»РёСЂСѓРµС‚ bile flow.', year: 2010 }],
  omega3:           [{ study: 'Ramsden CE. et al., BMJ 2013; Manson JE. et al., NEJM 2018', conclusion: 'РћРјРµРіР°-3 EPA/DHA вЂ” РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ РїСЂРё С‚СЂРёРіР»РёС†РµСЂРёРґРµРјРёРё >1.7 РјРјРѕР»СЊ/Р». РќРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ РјРµС…Р°РЅРёР·Рј.', year: 2018 }],
  magnesium:        [{ study: 'Grober U. et al., Nutrition 2015', conclusion: 'РњР°РіРЅРёР№ Р±РёСЃРіР»РёС†РёРЅР°С‚ вЂ” РІС‹СЃРѕРєР°СЏ Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ. РЎРЅРёР¶Р°РµС‚ РІРѕР·Р±СѓРґРёРјРѕСЃС‚СЊ Р¦РќРЎ, РјС‹С€РµС‡РЅС‹Рµ СЃСѓРґРѕСЂРѕРіРё, РЅРѕСЂРјР°Р»РёР·СѓРµС‚ РђР”. Р”РµС„РёС†РёС‚ СѓСЃРёР»РёРІР°РµС‚ РЅРµР№СЂРѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ.', year: 2015 }],
  berberine:        [{ study: 'Lan J. et al., J Ethnopharmacol 2015', conclusion: 'Р‘РµСЂР±РµСЂРёРЅ вЂ” Р°РєС‚РёРІР°С‚РѕСЂ AMPK, СЃРѕРїРѕСЃС‚Р°РІРёРј СЃ РјРµС‚С„РѕСЂРјРёРЅРѕРј РїРѕ СЃРЅРёР¶РµРЅРёСЋ HOMA-IR. Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РќРђР–Р‘Рџ.', year: 2015 }],
  coq10:            [{ study: 'Littarru GP. et al., Mol Syndromol 2011', conclusion: 'CoQ10 вЂ” РєР»СЋС‡РµРІРѕР№ РєРѕРјРїРѕРЅРµРЅС‚ ETC. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ РїСЂРё СЃС‚Р°С‚РёРЅ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РјРёРѕРїР°С‚РёРё. РќРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ РїСЂРё РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕР№ РґРёСЃС„СѓРЅРєС†РёРё.', year: 2011 }],
  vitamin_d3:       [{ study: 'Holick MF., NEJM 2007', conclusion: 'Р’РёС‚Р°РјРёРЅ D3 вЂ” РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС‚РѕСЂ Рё РіРѕСЂРјРѕРЅ. Р”РµС„РёС†РёС‚ (<30 РЅРі/РјР») Р°СЃСЃРѕС†РёРёСЂРѕРІР°РЅ СЃ Р°СѓС‚РѕРёРјРјСѓРЅРЅС‹РјРё Р·Р°Р±РѕР»РµРІР°РЅРёСЏРјРё, РґРµРїСЂРµСЃСЃРёРµР№ Рё РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅС‹Рј СЂРёСЃРєРѕРј.', year: 2007 }],
  zinc:             [{ study: 'Prasad AS., J Trace Elem Exp Med 1998', conclusion: 'Р¦РёРЅРє вЂ” РєСЂРёС‚РёС‡РµРЅ РґР»СЏ СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·Р° Рё РёРјРјСѓРЅРёС‚РµС‚Р°. Р”РµС„РёС†РёС‚ в†’ РіРёРїРѕРіРѕРЅР°РґРёР·Рј, СЃРЅРёР¶РµРЅРёРµ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°, РёРјРјСѓРЅРѕРґРµС„РёС†РёС‚.', year: 1998 }],
  hcg:              [{ study: 'Liu PY. et al., J Clin Endocrinol Metab 2002', conclusion: 'РҐР“Р§ вЂ” Р»СЋС‚РµРёРЅРёР·РёСЂСѓСЋС‰РёР№ Р°РЅР°Р»РѕРі, РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ Р°С‚СЂРѕС„РёСЋ СЏРёС‡РµРє РЅР° РєСѓСЂСЃРµ РђРђРЎ Рё СѓСЃРєРѕСЂСЏРµС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ HPTA РІ РџРљРў.', year: 2002 }],
  alpha_lipoic:     [{ study: 'Packer L. et al., Free Radic Biol Med 1995', conclusion: 'О±-Р›РёРїРѕРµРІР°СЏ РєРёСЃР»РѕС‚Р° вЂ” СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚, РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РІРёС‚Р°РјРёРЅС‹ C/E. РќРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РґРёР°Р±РµС‚РёС‡РµСЃРєРѕР№ РЅРµР№СЂРѕРїР°С‚РёРё.', year: 1995 }],
  ashwagandha:      [{ study: 'Chandrasekhar K. et al., Indian J Psychol Med 2012', conclusion: 'РђС€РІР°РіР°РЅРґР° вЂ” Р°РґР°РїС‚РѕРіРµРЅ, СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» РЅР° 30%, РїРѕРІС‹С€Р°РµС‚ DHEA-S Рё С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ. РђРЅРєСЃРёРѕР»РёС‚РёС‡РµСЃРєРёР№ СЌС„С„РµРєС‚ С‡РµСЂРµР· GABA-РјРѕРґСѓР»СЏС†РёСЋ.', year: 2012 }],
  milk_thistle:     [{ study: 'Fraschini F. et al., Phytother Res 2002', conclusion: 'РЎРёР»РёРјР°СЂРёРЅ (СЂР°СЃС‚РѕСЂРѕРїС€Р°) вЂ” РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ СЃ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅС‹Рј Рё Р°РЅС‚РёС„РёР±СЂРѕС‚РёС‡РµСЃРєРёРј РґРµР№СЃС‚РІРёРµРј. Р”РѕРєР°Р·Р°РЅ РїСЂРё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё РїРµС‡РµРЅРё.', year: 2002 }],
  melatonin:        [{ study: 'Claustrat B. et al., Neuroendocrinol 2005', conclusion: 'РњРµР»Р°С‚РѕРЅРёРЅ вЂ” СЂРµРіСѓР»СЏС‚РѕСЂ С†РёСЂРєР°РґРЅС‹С… СЂРёС‚РјРѕРІ, РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ, Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚. РЈР»СѓС‡С€Р°РµС‚ РєР°С‡РµСЃС‚РІРѕ СЃРЅР° Рё СЃРЅРёР¶Р°РµС‚ РЅРµР№СЂРѕРІРѕСЃРїР°Р»РµРЅРёРµ.', year: 2005 }],
  curcumin:         [{ study: 'Gupta SC. et al., AAPS J 2013', conclusion: 'РљСѓСЂРєСѓРјРёРЅ вЂ” РёРЅРіРёР±РёС‚РѕСЂ NF-ОєB Рё COX-2, РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ Рё РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ. РќРёР·РєР°СЏ Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СЂРµС€Р°РµС‚СЃСЏ РїРёРїРµСЂРёРЅРѕРј РёР»Рё Р»РёРїРѕСЃРѕРјР°РјРё.', year: 2013 }],
  phosphatidylcholine: [{ study: 'Gundermann KJ. et al., Clin Rev Allergy Immunol 2012', conclusion: 'Р¤РѕСЃС„Р°С‚РёРґРёР»С…РѕР»РёРЅ вЂ” СЃСѓС‰РµСЃС‚РІРµРЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ РјРµРјР±СЂР°РЅ РіРµРїР°С‚РѕС†РёС‚РѕРІ. Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ С†РµР»РѕСЃС‚РЅРѕСЃС‚СЊ РїРµС‡РµРЅРё РїСЂРё С‚РѕРєСЃРёС‡РµСЃРєРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё.', year: 2012 }],
  l_carnitine:      [{ study: 'Ferrari R. et al., Ann N Y Acad Sci 2004', conclusion: 'L-РєР°СЂРЅРёС‚РёРЅ вЂ” С‚СЂР°РЅСЃРїРѕСЂС‚ Р¶РёСЂРЅС‹С… РєРёСЃР»РѕС‚ РІ РјРёС‚РѕС…РѕРЅРґСЂРёРё. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ, СѓР»СѓС‡С€Р°РµС‚ С„СѓРЅРєС†РёСЋ СЌРЅРґРѕС‚РµР»РёСЏ.', year: 2004 }],
  glucosamine:      [{ study: 'Towheed TE. et al., Cochrane Database 2005', conclusion: 'Р“Р»СЋРєРѕР·Р°РјРёРЅ вЂ” С…РѕРЅРґСЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ, Р·Р°РјРµРґР»СЏРµС‚ РґРµРіСЂР°РґР°С†РёСЋ С…СЂСЏС‰Р° РїСЂРё РѕСЃС‚РµРѕР°СЂС‚СЂРѕР·Рµ. РЈРјРµСЂРµРЅРЅС‹Р№ Р±РѕР»РµСѓС‚РѕР»СЏСЋС‰РёР№ СЌС„С„РµРєС‚.', year: 2005 }],
  collagen:         [{ study: 'Shaw G. et al., Curr Med Res Opin 2017', conclusion: 'РљРѕР»Р»Р°РіРµРЅРѕРІС‹Рµ РїРµРїС‚РёРґС‹ вЂ” СѓР»СѓС‡С€Р°СЋС‚ Р±РёРѕРјРµС…Р°РЅРёРєСѓ С…СЂСЏС‰Р° Рё СЃСѓС…РѕР¶РёР»РёР№, СЃРЅРёР¶Р°СЋС‚ Р±РѕР»СЊ РІ СЃСѓСЃС‚Р°РІР°С… РїСЂРё РЅР°РіСЂСѓР·РєРµ.', year: 2017 }],
  bpc157:          [{ study: 'Sikiric P. et al., Curr Pharm Des 2018', conclusion: 'BPC-157 вЂ” РїРµРЅС‚Р°РґРµРєР°РїРµРїС‚РёРґ СЃ РґРѕРєР°Р·Р°РЅРЅРѕР№ СЂРµРіРµРЅРµСЂР°С†РёРµР№ СЃСѓС…РѕР¶РёР»РёР№, СЃРІСЏР·РѕРє, РєРёС€РµС‡РЅРёРєР° Рё РЅРµСЂРІРЅРѕР№ С‚РєР°РЅРё. РЎС‚РёРјСѓР»РёСЂСѓРµС‚ Р°РЅРіРёРѕРіРµРЅРµР·.', year: 2018 }],
  tb500:           [{ study: 'Smart N. et al., J Biol Chem 2007', conclusion: 'TB-500 (С‚РёРјРѕР·РёРЅ ОІ4) вЂ” СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РјРёРіСЂР°С†РёСЋ РєР»РµС‚РѕРє, Р°РЅРіРёРѕРіРµРЅРµР· Рё СЂРµРіРµРЅРµСЂР°С†РёСЋ С‚РєР°РЅРµР№. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ Рё РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ.', year: 2007 }],
  vitamin_c:       [{ study: 'Carr AC. et al., Nutrients 2017', conclusion: 'Р’РёС‚Р°РјРёРЅ C вЂ” Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚, РєРѕС„Р°РєС‚РѕСЂ РєРѕР»Р»Р°РіРµРЅ-СЃРёРЅС‚РµР·Р°. РџРѕРґРґРµСЂР¶РєР° РёРјРјСѓРЅРёС‚РµС‚Р° РїСЂРё РІС‹СЃРѕРєРѕРј РѕРєРёСЃР»РёС‚РµР»СЊРЅРѕРј СЃС‚СЂРµСЃСЃРµ.', year: 2017 }],
  vitamin_b12:      [{ study: 'Stabler SP., N Engl J Med 2013', conclusion: 'B12 вЂ” РєСЂРёС‚РёС‡РµРЅ РґР»СЏ РјРёРµР»РёРЅРёР·Р°С†РёРё РЅРµСЂРІРѕРІ Рё СЌСЂРёС‚СЂРѕРїРѕСЌР·Р°. Р”РµС„РёС†РёС‚ в†’ РјРµРіР°Р»РѕР±Р»Р°СЃС‚РЅР°СЏ Р°РЅРµРјРёСЏ, РЅРµР№СЂРѕРїР°С‚РёСЏ.', year: 2013 }],
  folate:           [{ study: 'Crider KS. et al., Adv Nutr 2012', conclusion: 'Р¤РѕР»Р°С‚ вЂ” РјРµС‚РёР»СЏС†РёСЏ Р”РќРљ, РіРѕРјРѕС†РёСЃС‚РµРёРЅ-СЃРЅРёР¶РµРЅРёРµ. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ РіРѕРјРѕС†РёСЃС‚РµРёРЅР°.', year: 2012 }],
  meloxicam:        [{ study: 'Noble S. et al., Drugs 1996', conclusion: 'РњРµР»РѕРєСЃРёРєР°Рј вЂ” СЃРµР»РµРєС‚РёРІРЅС‹Р№ COX-2 РёРЅРіРёР±РёС‚РѕСЂ, РќРџР’Рџ. Р РёСЃРє РїРѕС‡РµС‡РЅРѕР№ Рё РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё РїСЂРё РґР»РёС‚РµР»СЊРЅРѕРј РїСЂРёРјРµРЅРµРЅРёРё.', year: 1996 }],
  diclofenac:       [{ study: 'Gan TJ., Am J Med 2009', conclusion: 'Р”РёРєР»РѕС„РµРЅР°Рє вЂ” РќРџР’Рџ СЃ РІС‹СЃРѕРєРёРј СЂРёСЃРєРѕРј РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅС‹С… СЃРѕР±С‹С‚РёР№ (FDA warning) Рё РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё. РћРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РєСѓСЂСЃ в‰¤2 РЅРµРґРµР»СЊ.', year: 2009 }],
  selenium:         [{ study: 'Rayman MP., Lancet 2012',     conclusion: 'РЎРµР»РµРЅ вЂ” РєР»СЋС‡РµРІРѕР№ СЌР»РµРјРµРЅС‚ РіР»СѓС‚Р°С‚РёРѕРЅРїРµСЂРѕРєСЃРёРґР°Р·С‹. Р©РёС‚РѕРІРёРґРЅР°СЏ Р·Р°С‰РёС‚Р°. РР·Р±С‹С‚РѕРє в†’ С‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ (С…СЂСѓРїРєРѕСЃС‚СЊ РЅРѕРіС‚РµР№, Р°Р»РѕРїРµС†РёСЏ).', year: 2012 }],
  taurine:          [{ study: 'Schaffer S. et al., Amino Acids 2014', conclusion: 'РўР°СѓСЂРёРЅ вЂ” РЅРµР№СЂРѕРјРѕРґСѓР»СЏС‚РѕСЂ, РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ (Р°РЅС‚РёР°СЂРёС‚РјРёС‡РµСЃРєРёР№), РѕСЃРјРѕР»РёС‚. Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё С‚РѕРєСЃРёС‡РµСЃРєРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё.', year: 2014 }],
  saw_palmetto:     [{ study: 'Barry M. et al., NEJM 2006', conclusion: 'РЎРµСЂРµРЅРѕР° вЂ” РёРЅРіРёР±РёС‚РѕСЂ 5О±-СЂРµРґСѓРєС‚Р°Р·С‹, СЃРЅРёР¶Р°РµС‚ Р”Р“Рў. РЈРјРµСЂРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ РїСЂРё Р”Р“РџР–. РќРµ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅСѓСЋ Р°С‚СЂРѕС„РёСЋ СЏРёС‡РµРє.', year: 2006 }],
  egcg:             [{ study: 'Khan N. et al., Mol Nutr Food Res 2008', conclusion: 'EGCG вЂ” РєР°С‚РµС…РёРЅ Р·РµР»С‘РЅРѕРіРѕ С‡Р°СЏ, Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ Рё РёРЅРіРёР±РёС‚РѕСЂ COMT. Р“РµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ РїСЂРё РІС‹СЃРѕРєРёС… РґРѕР·Р°С… (>800 РјРі).', year: 2008 }],
  ginseng:          [{ study: 'Kim JH. et al., J Ginseng Res 2013', conclusion: 'Р–РµРЅСЊС€РµРЅСЊ вЂ” Р°РґР°РїС‚РѕРіРµРЅ, РїРѕРІС‹С€Р°РµС‚ NO Рё IGF-1. РЈРјРµСЂРµРЅРЅС‹Р№ СЌСЂРіРѕРіРµРЅРЅС‹Р№ СЌС„С„РµРєС‚. РџРѕС‚РµРЅС†РёСЂСѓРµС‚ Р°РЅС‚РёРєРѕР°РіСѓР»СЏРЅС‚С‹.', year: 2013 }],
  vitamin_k2:       [{ study: 'Vermeer C. et al., J Nutr 2004', conclusion: 'Р’РёС‚Р°РјРёРЅ K2 (РњРљ-7) вЂ” Р°РєС‚РёРІР°С‚РѕСЂ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР° Рё MGP. РљР°Р»СЊС†РёС„РёРєР°С†РёСЏ СЃРѕСЃСѓРґРѕРІ РїСЂРё РґРµС„РёС†РёС‚Рµ. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ.', year: 2004 }],
  iron:             [{ study: 'Camaschella C., Lancet 2015', conclusion: 'Р–РµР»РµР·Рѕ вЂ” СЌСЃСЃРµРЅС†РёР°Р»РµРЅ РґР»СЏ СЌСЂРёС‚СЂРѕРїРѕСЌР·Р°. РџРµСЂРµРіСЂСѓР·РєР° ( РіРµРјРѕС…СЂРѕРјР°С‚РѕР·) в†’ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ, РєР°СЂРґРёРѕРјРёРѕРїР°С‚РёСЏ. РљРѕРЅС‚СЂРѕР»РёСЂРѕРІР°С‚СЊ С„РµСЂСЂРёС‚РёРЅ.', year: 2015 }],
  hyaluronic:       [{ study: 'Gao F. et al., Nutrients 2019', conclusion: 'Р“РёР°Р»СѓСЂРѕРЅРѕРІР°СЏ РєРёСЃР»РѕС‚Р° вЂ” РєРѕРјРїРѕРЅРµРЅС‚ СЃРёРЅРѕРІРёР°Р»СЊРЅРѕР№ Р¶РёРґРєРѕСЃС‚Рё Рё С…СЂСЏС‰Р°. РџРµСЂРѕСЂР°Р»СЊРЅР°СЏ С„РѕСЂРјР° СѓР»СѓС‡С€Р°РµС‚ СѓРІР»Р°Р¶РЅРµРЅРёРµ СЃСѓСЃС‚Р°РІРѕРІ.', year: 2019 }],
  msm:              [{ study: 'Usha PR. et al., Osteoarthr Cartil 2004', conclusion: 'MSM вЂ” РёСЃС‚РѕС‡РЅРёРє СЃРµСЂС‹, РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№. РЈРјРµСЂРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ РїСЂРё РѕСЃС‚РµРѕР°СЂС‚СЂРѕР·Рµ РІ РєРѕРјР±РёРЅР°С†РёРё СЃ РіР»СЋРєРѕР·Р°РјРёРЅРѕРј.', year: 2004 }],
  boswellia:        [{ study: 'Ammon HP., Phytomedicine 2006', conclusion: 'Р‘РѕСЃРІРµР»Р»РёСЏ вЂ” РёРЅРіРёР±РёС‚РѕСЂ 5-Р»РёРїРѕРєСЃРёРіРµРЅР°Р·С‹, РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№. Р­С„С„РµРєС‚РёРІРµРЅ РїСЂРё Р°СЂС‚СЂРёС‚Рµ Рё РљР—Рљ. РњСЏРіРєР°СЏ РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ.', year: 2006 }],
  bromelain:        [{ study: 'Maurer HR., Cell Mol Life Sci 2001', conclusion: 'Р‘СЂРѕРјРµР»Р°Р№РЅ вЂ” РїСЂРѕС‚РµРѕР»РёС‚РёС‡РµСЃРєРёР№ С„РµСЂРјРµРЅС‚, С„РёР±СЂРёРЅРѕР»РёС‚РёРє. РџСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ Рё РїСЂРѕС‚РёРІРѕРѕС‚С‘С‡РЅС‹Р№ СЌС„С„РµРєС‚ РїСЂРё С‚СЂР°РІРјР°С….', year: 2001 }],
  probiotics:       [{ study: 'Hill C. et al., Nat Rev Gastroenterol Hepatol 2014', conclusion: 'РџСЂРѕР±РёРѕС‚РёРєРё вЂ” РјРѕРґСѓР»СЏС†РёСЏ РјРёРєСЂРѕР±РёРѕРјР°, РІР»РёСЏРЅРёРµ РЅР° РїРµС‡С‘РЅРѕС‡РЅС‹Р№ РјРµС‚Р°Р±РѕР»РёР·Рј (РѕСЃСЊ РїРµС‡РµРЅСЊ-РєРёС€РµС‡РЅРёРє). РРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЏ.', year: 2014 }],
  copper:           [{ study: 'Uriu-Adams JY. et al., J Nutr 2005',     conclusion: 'РњРµРґСЊ вЂ” РєРѕС„Р°РєС‚РѕСЂ С†РµСЂСѓР»РѕРїР»Р°Р·РјРёРЅР° Рё SOD. РљСЂРёС‚РёС‡РЅР° РґР»СЏ РЅРµР№СЂРѕРјРёРµР»РёРЅРёР·Р°С†РёРё Рё СЌСЂРёС‚СЂРѕРїРѕСЌР·Р°. РР·Р±С‹С‚РѕРє в†’ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ.', year: 2005 }],
  astragalus:       [{ study: 'Auyeung KK. et al., Am J Chin Med 2016', conclusion: 'РђСЃС‚СЂР°РіР°Р» вЂ” РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС‚РѕСЂ Рё РЅРµС„СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ. РђРєС‚РёРІРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ вЂ” Р°СЃС‚СЂР°РіР°Р»РѕР·РёРґ IV. РЎРЅРёР¶Р°РµС‚ РїСЂРѕС‚РµРёРЅСѓСЂРёСЋ.', year: 2016 }],
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


// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// ORGAN-BASED SYNERGY SYSTEM
// Organized by body system with Russian descriptions and clinical logic
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
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
    organLabel: 'рџ«Ѓ РџРµС‡РµРЅСЊ',
    pairs: [
      { substanceA: 'nac', substanceB: 'tudca', nameA: 'РќРђРљ', nameB: 'РўРЈР”РљРђ', effect: 'Р”РІРѕР№РЅРѕР№ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ: РќРђРљ в†’ РіР»СѓС‚Р°С‚РёРѕРЅ, РўРЈР”РљРђ в†’ Р¶РµР»С‡РµРѕС‚С‚РѕРє', mechanism: 'РќРђРљ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РіР»СѓС‚Р°С‚РёРѕРЅ (Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅС‹Р№ РїСѓС‚СЊ), РўРЈР”РљРђ СЃС‚РёРјСѓР»РёСЂСѓРµС‚ bile flow Рё Р·Р°С‰РёС‰Р°РµС‚ РѕС‚ С…РѕР»РµСЃС‚Р°Р·Р°. РџРѕРєСЂС‹С‚РёРµ РѕР±РѕРёС… РїСѓС‚РµР№ РїРѕРІСЂРµР¶РґРµРЅРёСЏ РїРµС‡РµРЅРё.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'milk_thistle', nameA: 'РќРђРљ', nameB: 'Р Р°СЃС‚РѕСЂРѕРїС€Р°', effect: 'РќРђРљ + СЃРёР»РёРјР°СЂРёРЅ: РєРѕРјРїР»РµРєСЃРЅР°СЏ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ', mechanism: 'РќРђРљ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РіР»СѓС‚Р°С‚РёРѕРЅ, СЃРёР»РёРјР°СЂРёРЅ СЃС‚Р°Р±РёР»РёР·РёСЂСѓРµС‚ РјРµРјР±СЂР°РЅС‹ РіРµРїР°С‚РѕС†РёС‚РѕРІ Рё Р°РєС‚РёРІРёСЂСѓРµС‚ GST. Р”РІРѕР№РЅРѕР№ РјРµС…Р°РЅРёР·Рј Р·Р°С‰РёС‚С‹.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'tudca', substanceB: 'milk_thistle', nameA: 'РўРЈР”РљРђ', nameB: 'Р Р°СЃС‚РѕСЂРѕРїС€Р°', effect: 'РђРЅС‚РёС…РѕР»РµСЃС‚Р°Р· + РјРµРјР±СЂР°РЅРЅР°СЏ Р·Р°С‰РёС‚Р° РїРµС‡РµРЅРё', mechanism: 'РўРЈР”РљРђ РїРѕРєСЂС‹РІР°РµС‚ С…РѕР»РµСЃС‚Р°С‚РёС‡РµСЃРєРёР№ РїСѓС‚СЊ, СЃРёР»РёРјР°СЂРёРЅ вЂ” С†РёС‚РѕС‚РѕРєСЃРёС‡РµСЃРєРёР№ РїСѓС‚СЊ. РљРѕРјРїР»РµРєСЃРЅР°СЏ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ РїСЂРё РђРђРЎ.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'vit_c', nameA: 'РќРђРљ', nameB: 'Р’РёС‚Р°РјРёРЅ C', effect: 'РљР°СЃРєР°РґРЅР°СЏ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅР°СЏ Р·Р°С‰РёС‚Р° РїРµС‡РµРЅРё', mechanism: 'РќРђРљ в†’ РіР»СѓС‚Р°С‚РёРѕРЅ (РІРѕРґРЅР°СЏ С„Р°Р·Р°), РІРёС‚Р°РјРёРЅ C в†’ РїСЂСЏРјР°СЏ РЅРµР№С‚СЂР°Р»РёР·Р°С†РёСЏ ROS + СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅР° E (Р»РёРїРёРґРЅР°СЏ С„Р°Р·Р°).', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'nac', substanceB: 'alpha_lipoic_acid', nameA: 'РќРђРљ', nameB: 'РђР»СЊС„Р°-Р»РёРїРѕРµРІР°СЏ РєРёСЃР»РѕС‚Р°', effect: 'РђРЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅС‹Р№ РєР°СЃРєР°Рґ: РќРђРљ в†’ РіР»СѓС‚Р°С‚РёРѕРЅ, РђР›Рљ в†’ СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅРѕРІ C/E', mechanism: 'РќРђРљ РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ С†РёСЃС‚РµРёРЅ РґР»СЏ СЃРёРЅС‚РµР·Р° РіР»СѓС‚Р°С‚РёРѕРЅР°, РђР›Рљ РЅР°РїСЂСЏРјСѓСЋ РЅРµР№С‚СЂР°Р»РёР·СѓРµС‚ ROS Рё СЂРµРіРµРЅРµСЂРёСЂСѓРµС‚ РІРёС‚Р°РјРёРЅС‹ C Рё E. РџРѕР»РЅР°СЏ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅР°СЏ Р·Р°С‰РёС‚Р°.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'berberine', substanceB: 'milk_thistle', nameA: 'Р‘РµСЂР±РµСЂРёРЅ', nameB: 'Р Р°СЃС‚РѕСЂРѕРїС€Р°', effect: 'РњРµС‚Р°Р±РѕР»РёС‡РµСЃРєР°СЏ + РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°', mechanism: 'Р‘РµСЂР±РµСЂРёРЅ (AMPK-Р°РєС‚РёРІР°С†РёСЏ) СЃРЅРёР¶Р°РµС‚ СЃР°С…Р°СЂ Рё Р»РёРїРёРґС‹, СЃРёР»РёРјР°СЂРёРЅ Р·Р°С‰РёС‰Р°РµС‚ РїРµС‡РµРЅСЊ РѕС‚ Р±РµСЂР±РµСЂРёРЅ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРіРѕ РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРѕРіРѕ СЃС‚СЂРµСЃСЃР°.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'cardio',
    organ: 'cardio',
    organLabel: 'вќ¤пёЏ РЎРµСЂРґС†Рµ Рё СЃРѕСЃСѓРґС‹',
    pairs: [
      { substanceA: 'omega3', substanceB: 'coq10', nameA: 'РћРјРµРіР°-3', nameB: 'CoQ10', effect: 'РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ: РѕРјРµРіР°-3 + РєРѕСЌРЅР·РёРј Q10', mechanism: 'РћРјРµРіР°-3 РІСЃС‚СЂР°РёРІР°РµС‚СЃСЏ РІ РјРµРјР±СЂР°РЅС‹ РєР°СЂРґРёРѕРјРёРѕС†РёС‚РѕРІ (СЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ), CoQ10 РїРµСЂРµРЅРѕСЃРёС‚ СЌР»РµРєС‚СЂРѕРЅС‹ РІ ETC (СЌРЅРµСЂРіРёСЏ). РљРѕРјР±РёРЅР°С†РёСЏ РѕРїС‚РёРјРёР·РёСЂСѓРµС‚ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_k2', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'Р’РёС‚Р°РјРёРЅ K2', effect: 'D3+K2: РєР°Р»СЊС†РёР№ РІ РєРѕСЃС‚Рё, РЅРµ РІ СЃРѕСЃСѓРґС‹', mechanism: 'D3 РѕР±РµСЃРїРµС‡РёРІР°РµС‚ Р°Р±СЃРѕСЂР±С†РёСЋ РєР°Р»СЊС†РёСЏ, K2 Р°РєС‚РёРІРёСЂСѓРµС‚ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅ (РЅР°РїСЂР°РІР»СЏРµС‚ Ca РІ РєРѕСЃС‚Рё) Рё РјР°С‚СЂРёРєСЃРЅС‹Р№ Gla-Р±РµР»РѕРє (РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РєР°Р»СЊС†РёС„РёРєР°С†РёСЋ СЃРѕСЃСѓРґРѕРІ).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'omega3', substanceB: 'magnesium', nameA: 'РћРјРµРіР°-3', nameB: 'РњР°РіРЅРёР№', effect: 'РћРјРµРіР°-3 + РјР°РіРЅРёР№: Р°РЅС‚РёР°СЂРёС‚РјРёС‡РµСЃРєРёР№ + РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№', mechanism: 'РћРјРµРіР°-3 СЃРЅРёР¶Р°РµС‚ РўР“ Рё РІРѕСЃРїР°Р»РµРЅРёРµ, РјР°РіРЅРёР№ СЃС‚Р°Р±РёР»РёР·РёСЂСѓРµС‚ СЌР»РµРєС‚СЂРёС‡РµСЃРєСѓСЋ Р°РєС‚РёРІРЅРѕСЃС‚СЊ РјРёРѕРєР°СЂРґР° (Р±Р»РѕРєР°РґР° Ca2+ РєР°РЅР°Р»РѕРІ). РљРѕРјР±РёРЅР°С†РёСЏ СЃРЅРёР¶Р°РµС‚ СЂРёСЃРє Р°СЂРёС‚РјРёР№.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'magnesium', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'РњР°РіРЅРёР№', effect: 'D3+Mg: Р°РєС‚РёРІР°С†РёСЏ РІРёС‚Р°РјРёРЅР° D Рё РјРёРЅРµСЂР°Р»РёР·Р°С†РёСЏ РєРѕСЃС‚РµР№', mechanism: 'РњР°РіРЅРёР№ вЂ” РєРѕС„Р°РєС‚РѕСЂ 1О±-РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹ (РєРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ 25-OH-D в†’ 1,25-(OH)2-D). Р‘РµР· РјР°РіРЅРёСЏ РІРёС‚Р°РјРёРЅ D РЅРµ Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ РїРѕР»РЅРѕСЃС‚СЊСЋ.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'brain',
    organ: 'brain',
    organLabel: 'рџ§  РњРѕР·Рі Рё РЅРµСЂРІС‹',
    pairs: [
      { substanceA: 'magnesium', substanceB: 'ashwagandha', nameA: 'РњР°РіРЅРёР№', nameB: 'РђС€РІР°РіР°РЅРґР°', effect: 'РњРѕС‰РЅС‹Р№ Р°РЅРєСЃРёРѕР»РёС‚РёС‡РµСЃРєРёР№ СЃРёРЅРµСЂРіРёР·Рј', mechanism: 'РњР°РіРЅРёР№ РїРѕС‚РµРЅС†РёСЂСѓРµС‚ GABA-A СЂРµС†РµРїС‚РѕСЂС‹ Рё Р±Р»РѕРєРёСЂСѓРµС‚ NMDA, Р°С€РІР°РіР°РЅРґР° СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» С‡РµСЂРµР· HPA-РѕСЃСЊ Рё СѓСЃРёР»РёРІР°РµС‚ GABA-РµСЂРіРёС‡РµСЃРєСѓСЋ РїРµСЂРµРґР°С‡Сѓ. РљРѕРјР±РёРЅР°С†РёСЏ СЌС„С„РµРєС‚РёРІРЅРѕ РєСѓРїРёСЂСѓРµС‚ С‚СЂРµРІРѕР¶РЅРѕСЃС‚СЊ.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_b6', substanceB: 'magnesium', nameA: 'Р’РёС‚Р°РјРёРЅ B6', nameB: 'РњР°РіРЅРёР№', effect: 'B6+Mg: РєРѕС„Р°РєС‚РѕСЂС‹ СЃРёРЅС‚РµР·Р° СЃРµСЂРѕС‚РѕРЅРёРЅР° Рё GABA', mechanism: 'P5P (Р°РєС‚РёРІРЅС‹Р№ B6) вЂ” РєРѕС„Р°РєРјРµРЅС‚ РґРµРєР°СЂР±РѕРєСЃРёР»Р°Р·С‹ (СЃРµСЂРѕС‚РѕРЅРёРЅ, GABA, РґРѕС„Р°РјРёРЅ), РјР°РіРЅРёР№ вЂ” РєРѕС„Р°РєРјРµРЅС‚ РІСЃРµС… РєРёРЅР°Р·РЅС‹С… СЂРµР°РєС†РёР№. РњР°РіРЅРёР№ Р°РєС‚РёРІРёСЂСѓРµС‚ РїРёСЂРёРґРѕРєСЃР°Р»СЊРєРёРЅР°Р·Сѓ.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_b9', substanceB: 'vit_b12', nameA: 'Р¤РѕР»Р°С‚', nameB: 'Р’РёС‚Р°РјРёРЅ B12', effect: 'Р¤РѕР»Р°С‚+B12: РјРµС‚РёР»РёСЂРѕРІР°РЅРёРµ Рё РіРѕРјРѕС†РёСЃС‚РµРёРЅ', mechanism: 'Р¤РѕР»Р°С‚ вЂ” РґРѕРЅРѕСЂ РјРµС‚РёР»СЊРЅС‹С… РіСЂСѓРїРї РґР»СЏ СЂРµРјРµС‚РёР»СЏС†РёРё РіРѕРјРѕС†РёСЃС‚РµРёРЅР° РІ РјРµС‚РёРѕРЅРёРЅ, B12 вЂ” РєРѕС„Р°РєС‚РѕСЂ РјРµС‚РёРѕРЅРёРЅСЃРёРЅС‚Р°Р·С‹. B12-РґРµС„РёС†РёС‚ Р±Р»РѕРєРёСЂСѓРµС‚ С„РѕР»Р°С‚РЅС‹Р№ С†РёРєР» (С„РѕР»Р°С‚РЅР°СЏ Р»РѕРІСѓС€РєР°).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'magnesium', substanceB: 'melatonin', nameA: 'РњР°РіРЅРёР№', nameB: 'РњРµР»Р°С‚РѕРЅРёРЅ', effect: 'РЈР»СѓС‡С€РµРЅРёРµ РєР°С‡РµСЃС‚РІР° СЃРЅР°', mechanism: 'РњР°РіРЅРёР№ СЂР°СЃСЃР»Р°Р±Р»СЏРµС‚ РјС‹С€С†С‹ Рё РїРѕС‚РµРЅС†РёСЂСѓРµС‚ GABA, РјРµР»Р°С‚РѕРЅРёРЅ СЂРµРіСѓР»РёСЂСѓРµС‚ С†РёСЂРєР°РґРЅС‹Рµ СЂРёС‚РјС‹. РљРѕРјР±РёРЅР°С†РёСЏ СѓР»СѓС‡С€Р°РµС‚ onset Рё РіР»СѓР±РёРЅСѓ СЃРЅР°.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'immune',
    organ: 'immune',
    organLabel: 'рџ›Ў РРјРјСѓРЅРёС‚РµС‚',
    pairs: [
      { substanceA: 'vit_d3', substanceB: 'zinc', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'Р¦РёРЅРє', effect: 'D3+С†РёРЅРє: СЃРёРЅРµСЂРіРёС‡РЅР°СЏ РёРјРјСѓРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°', mechanism: 'D3 РјРѕРґСѓР»РёСЂСѓРµС‚ РІСЂРѕР¶РґС‘РЅРЅС‹Р№ Рё Р°РґР°РїС‚РёРІРЅС‹Р№ РёРјРјСѓРЅРёС‚РµС‚ С‡РµСЂРµР· VDR, С†РёРЅРє РєСЂРёС‚РёС‡РµРЅ РґР»СЏ T-РєР»РµС‚РѕРє Рё С‚РёРјСѓСЃР°. Р¦РёРЅРє РїРѕРІС‹С€Р°РµС‚ Р°РєС‚РёРІРЅРѕСЃС‚СЊ РІРёС‚Р°РјРёРЅ D-СЃРІСЏР·С‹РІР°СЋС‰РµРіРѕ Р±РµР»РєР°.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'vit_c', substanceB: 'zinc', nameA: 'Р’РёС‚Р°РјРёРЅ C', nameB: 'Р¦РёРЅРє', effect: 'РљРѕРјРїР»РµРєСЃРЅР°СЏ РёРјРјСѓРЅРЅР°СЏ Р·Р°С‰РёС‚Р°', mechanism: 'Р’РёС‚Р°РјРёРЅ C вЂ” Р°РЅС‚РёРјРёРєСЂРѕР±РЅС‹Р№, РЅРµР№С‚СЂР°Р»РёР·СѓРµС‚ ROS РІ С„Р°РіРѕС†РёС‚Р°С…. Р¦РёРЅРє вЂ” T-РєР»РµС‚РѕС‡РЅС‹Р№ РёРјРјСѓРЅРёС‚РµС‚ Рё С„СѓРЅРєС†РёСЏ С‚РёРјСѓСЃР°. РљРѕРјР±РёРЅР°С†РёСЏ СЃРѕРєСЂР°С‰Р°РµС‚ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РћР Р’Р.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_c', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'Р’РёС‚Р°РјРёРЅ C', effect: 'РРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЏ + Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚', mechanism: 'D3 РјРѕРґСѓР»РёСЂСѓРµС‚ РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚ (VDR), РІРёС‚Р°РјРёРЅ C РїРѕРґРґРµСЂР¶РёРІР°РµС‚ С„СѓРЅРєС†РёСЋ РЅРµР№С‚СЂРѕС„РёР»РѕРІ Рё РјР°РєСЂРѕС„Р°РіРѕРІ. РЎРёРЅРµСЂРіРёС‡РЅР°СЏ Р·Р°С‰РёС‚Р° РѕС‚ РёРЅС„РµРєС†РёР№.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'bones',
    organ: 'bones',
    organLabel: 'рџ¦ґ РљРѕСЃС‚Рё Рё СЃСѓСЃС‚Р°РІС‹',
    pairs: [
      { substanceA: 'bpc157', substanceB: 'tb500', nameA: 'BPC-157', nameB: 'TB-500', effect: 'РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ СЂРµРіРµРЅРµСЂР°С†РёСЏ СЃРІСЏР·РѕРє Рё СЃСѓС…РѕР¶РёР»РёР№', mechanism: 'BPC-157 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ VEGF/FGF (Р°РЅРіРёРѕРіРµРЅРµР·), TB-500 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РјРёРіСЂР°С†РёСЋ СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅС‹С… РєР»РµС‚РѕРє Рё Р°РєС‚РёРЅ-РїРѕР»РёРјРµСЂРёР·Р°С†РёСЋ. РљРѕРјР±РёРЅР°С†РёСЏ СѓСЃРєРѕСЂСЏРµС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РІ 3-5 СЂР°Р·.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'bpc157', substanceB: 'vit_c', nameA: 'BPC-157', nameB: 'Р’РёС‚Р°РјРёРЅ C', effect: 'Р РµРіРµРЅРµСЂР°С†РёСЏ + СЃРёРЅС‚РµР· РєРѕР»Р»Р°РіРµРЅР°', mechanism: 'BPC-157 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ Р°РЅРіРёРѕРіРµРЅРµР· Рё РїСЂРѕР»РёС„РµСЂР°С†РёСЋ С„РёР±СЂРѕР±Р»Р°СЃС‚РѕРІ, РІРёС‚Р°РјРёРЅ C вЂ” РєРѕС„Р°РєС‚РѕСЂ РїСЂРѕР»РёР»/Р»РёР·РёР»-РіРёРґСЂРѕРєСЃРёР»Р°Р· РґР»СЏ СЃРёРЅС‚РµР·Р° РєРѕР»Р»Р°РіРµРЅР°. РЎС‚СЂСѓРєС‚СѓСЂРЅР°СЏ + СЃРёРіРЅР°Р»СЊРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'vit_d3', substanceB: 'vit_k2', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'Р’РёС‚Р°РјРёРЅ K2', effect: 'РњРёРЅРµСЂР°Р»РёР·Р°С†РёСЏ РєРѕСЃС‚РµР№ Р±РµР· РєР°Р»СЊС†РёС„РёРєР°С†РёРё СЃРѕСЃСѓРґРѕРІ', mechanism: 'D3 в†’ Р°Р±СЃРѕСЂР±С†РёСЏ РєР°Р»СЊС†РёСЏ, K2 в†’ Р°РєС‚РёРІР°С†РёСЏ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР° (РЅР°РїСЂР°РІР»СЏРµС‚ Ca РІ РєРѕСЃС‚Рё) Рё MGP (РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РєР°Р»СЊС†РёС„РёРєР°С†РёСЋ СЃРѕСЃСѓРґРѕРІ).', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'glucosamine', substanceB: 'chondroitin', nameA: 'Р“Р»СЋРєРѕР·Р°РјРёРЅ', nameB: 'РҐРѕРЅРґСЂРѕРёС‚РёРЅ', effect: 'РЎРёРЅРµСЂРіРёС‡РЅР°СЏ Р·Р°С‰РёС‚Р° СЃСѓСЃС‚Р°РІРЅРѕРіРѕ С…СЂСЏС‰Р°', mechanism: 'Р“Р»СЋРєРѕР·Р°РјРёРЅ вЂ” СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Р№ Р±Р»РѕРє РіР»РёРєРѕР·Р°РјРёРЅРѕРіР»РёРєР°РЅРѕРІ, С…РѕРЅРґСЂРѕРёС‚РёРЅ вЂ” СѓРґРµСЂР¶РёРІР°РµС‚ РІРѕРґСѓ Рё РѕР±РµСЃРїРµС‡РёРІР°РµС‚ СѓРїСЂСѓРіРѕСЃС‚СЊ С…СЂСЏС‰Р°. РљРѕРјР±РёРЅР°С†РёСЏ СЌС„С„РµРєС‚РёРІРЅРµРµ РјРѕРЅРѕС‚РµСЂР°РїРёРё.', severity: 'MEDIUM', type: 'synergy' },
    ]
  },
  {
    id: 'hormones',
    organ: 'hormones',
    organLabel: 'вљ–пёЏ Р“РѕСЂРјРѕРЅС‹',
    pairs: [
      { substanceA: 'zinc', substanceB: 'vit_d3', nameA: 'Р¦РёРЅРє', nameB: 'Р’РёС‚Р°РјРёРЅ D3', effect: 'РџРѕРІС‹С€РµРЅРёРµ СЃРІРѕР±РѕРґРЅРѕРіРѕ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°', mechanism: 'Р‘РѕСЂ СѓСЃРёР»РёРІР°РµС‚ РїРѕР»СѓСЂР°СЃРїР°Рґ РІРёС‚Р°РјРёРЅР° D Рё РїРѕРІС‹С€Р°РµС‚ Р°РєС‚РёРІРЅРѕСЃС‚СЊ 1О±-РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹. Р¦РёРЅРє СЃРЅРёР¶Р°РµС‚ SHBG в†’ Р±РѕР»СЊС€Рµ СЃРІРѕР±РѕРґРЅРѕРіРѕ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°. D3 в†’ СЂРµС†РµРїС†РёСЏ РІ РєР»РµС‚РєР°С… Р›РµР№РґРёРіР°.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'ashwagandha', substanceB: 'magnesium', nameA: 'РђС€РІР°РіР°РЅРґР°', nameB: 'РњР°РіРЅРёР№', effect: 'РЎРЅРёР¶РµРЅРёРµ РєРѕСЂС‚РёР·РѕР»Р° + РїРѕРІС‹С€РµРЅРёРµ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°', mechanism: 'РђС€РІР°РіР°РЅРґР° СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» Рё РїРѕРІС‹С€Р°РµС‚ DHEA-S (Р°РЅС‚РёСЃС‚СЂРµСЃСЃ), РјР°РіРЅРёР№ СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» С‡РµСЂРµР· GABA-РµСЂРіРёС‡РµСЃРєРёР№ РїСѓС‚СЊ. РЎРёРЅРµСЂРіРёС‡РЅС‹Р№ Р°РЅС‚РёРєРѕСЂС‚РёР·РѕР»РѕРІС‹Р№ СЌС„С„РµРєС‚.', severity: 'MEDIUM', type: 'synergy' },
      { substanceA: 'ashwagandha', substanceB: 'tongkat_ali', nameA: 'РђС€РІР°РіР°РЅРґР°', nameB: 'РўРѕРЅРіРєР°С‚ РђР»Рё', effect: 'Р”РІРѕР№РЅРѕР№ РїСѓС‚СЊ РїРѕРІС‹С€РµРЅРёСЏ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°', mechanism: 'РђС€РІР°РіР°РЅРґР° СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» (Р°РЅС‚РёСЃС‚СЂРµСЃСЃ-РїСѓС‚СЊ), С‚РѕРЅРіРєР°С‚ Р°Р»Рё СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РІС‹СЃРІРѕР±РѕР¶РґРµРЅРёРµ LH Рё СѓРІРµР»РёС‡РёРІР°РµС‚ 17-РєРµС‚РѕСЃС‚РµСЂРѕРёРґС‹ (HPTA-РїСѓС‚СЊ). РџРѕРєСЂС‹С‚РёРµ РѕР±РѕРёС… СѓСЂРѕРІРЅРµР№.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'gut',
    organ: 'gut',
    organLabel: 'рџ«ѓ Р–РљРў Рё РјРёРєСЂРѕР±РёРѕРј',
    pairs: [
      { substanceA: 'curcumin', substanceB: 'piperine', nameA: 'РљСѓСЂРєСѓРјРёРЅ', nameB: 'РџРёРїРµСЂРёРЅ', effect: '10-РєСЂР°С‚РЅРѕРµ СѓРІРµР»РёС‡РµРЅРёРµ Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё РєСѓСЂРєСѓРјРёРЅР°', mechanism: 'РџРёРїРµСЂРёРЅ РёРЅРіРёР±РёСЂСѓРµС‚ UGT Рё CYP3A4 РІ РєРёС€РµС‡РЅРёРєРµ Рё РїРµС‡РµРЅРё, РїРѕРІС‹С€Р°СЏ Р°Р±СЃРѕСЂР±С†РёСЋ РєСѓСЂРєСѓРјРёРЅР° РІ 10 СЂР°Р·. РўР°РєР¶Рµ РёРЅРіРёР±РёСЂСѓРµС‚ P-РіР»РёРєРѕРїСЂРѕС‚РµРёРЅ.', severity: 'HIGH', type: 'synergy' },
      { substanceA: 'probiotics', substanceB: 'prebiotic_fiber', nameA: 'РџСЂРѕР±РёРѕС‚РёРєРё', nameB: 'РџСЂРµР±РёРѕС‚РёС‡РµСЃРєР°СЏ РєР»РµС‚С‡Р°С‚РєР°', effect: 'РЎРёРЅР±РёРѕС‚РёРє: РїСЂРѕР±РёРѕС‚РёРєРё + РїСЂРµР±РёРѕС‚РёРєРё = РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ РјРёРєСЂРѕР±РёРѕРјРЅС‹Р№ СЌС„С„РµРєС‚', mechanism: 'РџСЂРµР±РёРѕС‚РёРєРё РїСЂРµРґРѕСЃС‚Р°РІР»СЏСЋС‚ СЃСѓР±СЃС‚СЂР°С‚ РґР»СЏ С„РµСЂРјРµРЅС‚Р°С†РёРё РїСЂРѕР±РёРѕС‚РёРєРѕРІ, СѓРІРµР»РёС‡РёРІР°СЏ РёС… РІС‹Р¶РёРІР°РµРјРѕСЃС‚СЊ Рё РїСЂРѕРґСѓРєС†РёСЋ РєРѕСЂРѕС‚РєРѕС†РµРїРѕС‡РµС‡РЅС‹С… Р¶РёСЂРЅС‹С… РєРёСЃР»РѕС‚.', severity: 'HIGH', type: 'synergy' },
    ]
  },
  {
    id: 'conflicts',
    organ: 'conflicts',
    organLabel: 'вљ пёЏ РљРѕРЅС„Р»РёРєС‚С‹ Рё РѕСЃС‚РѕСЂРѕР¶РЅРѕСЃС‚СЊ',
    pairs: [
      { substanceA: 'zinc', substanceB: 'copper', nameA: 'Р¦РёРЅРє', nameB: 'РњРµРґСЊ', effect: 'Р’С‹СЃРѕРєРёРµ РґРѕР·С‹ С†РёРЅРєР° РёСЃС‚РѕС‰Р°СЋС‚ РјРµРґСЊ', mechanism: 'Р¦РёРЅРє в‰Ґ50 РјРі РёРЅРґСѓРЅС†РёСЂСѓРµС‚ РјРµС‚Р°Р»Р»РѕС‚РёРѕРЅРµРёРЅ, РєРѕС‚РѕСЂС‹Р№ СЃРІСЏР·С‹РІР°РµС‚ РјРµРґСЊ Рё СЃРЅРёР¶Р°РµС‚ РµС‘ Р°Р±СЃРѕСЂР±С†РёСЋ. Р РµРєРѕРјРµРЅРґР°С†РёСЏ: 2 РјРі РјРµРґРё РЅР° РєР°Р¶РґС‹Рµ 30 РјРі С†РёРЅРєР°.', severity: 'HIGH', type: 'caution' },
      { substanceA: 'iron', substanceB: 'calcium', nameA: 'Р–РµР»РµР·Рѕ', nameB: 'РљР°Р»СЊС†РёР№', effect: 'РљРѕРЅРєСѓСЂРµРЅС†РёСЏ Р·Р° Р°Р±СЃРѕСЂР±С†РёСЋ', mechanism: 'РљР°Р»СЊС†РёР№ Рё Р¶РµР»РµР·Рѕ РєРѕРЅРєСѓСЂРёСЂСѓСЋС‚ Р·Р° DMT1-С‚СЂР°РЅСЃРїРѕСЂС‚С‘СЂ. РџСЂРёРЅРёРјР°С‚СЊ РѕС‚РґРµР»СЊРЅРѕ: Р¶РµР»РµР·Рѕ РЅР°С‚РѕС‰Р°Рє, РєР°Р»СЊС†РёР№ СЃ РµРґРѕР№.', severity: 'MEDIUM', type: 'conflict' },
      { substanceA: 'iron', substanceB: 'zinc', nameA: 'Р–РµР»РµР·Рѕ', nameB: 'Р¦РёРЅРє', effect: 'РљРѕРЅРєСѓСЂРµРЅС†РёСЏ Р·Р° Р°Р±СЃРѕСЂР±С†РёСЋ', mechanism: 'Р’С‹СЃРѕРєРёРµ РґРѕР·С‹ Р¶РµР»РµР·Р° РєРѕРЅРєСѓСЂРёСЂСѓСЋС‚ СЃ С†РёРЅРєРѕРј Р·Р° DMT1. РџСЂРёРЅРёРјР°С‚СЊ СЃ РёРЅС‚РµСЂРІР°Р»РѕРј 2+ С‡Р°СЃР°.', severity: 'MEDIUM', type: 'conflict' },
      { substanceA: 'calcium', substanceB: 'magnesium', nameA: 'РљР°Р»СЊС†РёР№', nameB: 'РњР°РіРЅРёР№', effect: 'РљРѕРЅРєСѓСЂРµРЅС†РёСЏ Р·Р° Р°Р±СЃРѕСЂР±С†РёСЋ РїСЂРё РІС‹СЃРѕРєРёС… РґРѕР·Р°С…', mechanism: 'Р’С‹СЃРѕРєРёРµ РґРѕР·С‹ РєР°Р»СЊС†РёСЏ РјРѕРіСѓС‚ СЃРЅРёР¶Р°С‚СЊ Р°Р±СЃРѕСЂР±С†РёСЋ РјР°РіРЅРёСЏ. Р РµРєРѕРјРµРЅРґСѓРµРјРѕРµ СЃРѕРѕС‚РЅРѕС€РµРЅРёРµ Ca:Mg = 2:1.', severity: 'LOW', type: 'caution' },
      { substanceA: 'curcumin', substanceB: 'berberine', nameA: 'РљСѓСЂРєСѓРјРёРЅ', nameB: 'Р‘РµСЂР±РµСЂРёРЅ', effect: 'Р”РІРѕР№РЅРѕРµ РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ CYP3A4', mechanism: 'РћР±Р° РёРЅРіРёР±РёСЂСѓСЋС‚ CYP3A4. РљРѕРјР±РёРЅР°С†РёСЏ РјРѕР¶РµС‚ РїРѕРІС‹СЃРёС‚СЊ РєРѕРЅС†РµРЅС‚СЂР°С†РёСЋ РґСЂСѓРіРёС… РїСЂРµРїР°СЂР°С‚РѕРІ. РћСЃС‚РѕСЂРѕР¶РЅРѕСЃС‚СЊ РїСЂРё РїСЂРёС‘РјРµ Р»РµРєР°СЂСЃС‚РІ.', severity: 'MEDIUM', type: 'caution' },
      { substanceA: 'vit_d3', substanceB: 'calcium', nameA: 'Р’РёС‚Р°РјРёРЅ D3', nameB: 'РљР°Р»СЊС†РёР№', effect: 'Р РёСЃРє РіРёРїРµСЂРєР°Р»СЊС†РёРµРјРёРё РїСЂРё РІС‹СЃРѕРєРёС… РґРѕР·Р°С…', mechanism: 'D3 СѓРІРµР»РёС‡РёРІР°РµС‚ Р°Р±СЃРѕСЂР±С†РёСЋ РєР°Р»СЊС†РёСЏ. РџСЂРё РґРѕР·Р°С… D3 >10000 РњР• + РєР°Р»СЊС†РёР№ >1000 РјРі РІРѕР·РјРѕР¶РЅР° РіРёРїРµСЂРєР°Р»СЊС†РёРµРјРёСЏ. РњРѕРЅРёС‚РѕСЂРёС‚СЊ СѓСЂРѕРІРµРЅСЊ Ca.', severity: 'LOW', type: 'caution' },
    ]
  },
];


export const SYNERGY_PAIRS: SynergyPair[] = [
  {
    substanceA: 'nac',
    substanceB: 'tudca',
    synergyType: 'synergistic',
    mechanism: 'РЎРёРЅРµСЂРіРёС‡РµСЃРєР°СЏ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· СЂР°Р·РЅС‹Рµ РјРµС…Р°РЅРёР·РјС‹: NAC РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РіР»СѓС‚Р°С‚РёРѕРЅ Рё РЅРµР№С‚СЂР°Р»РёР·СѓРµС‚ СЃРІРѕР±РѕРґРЅС‹Рµ СЂР°РґРёРєР°Р»С‹, TUDCA СЃС‚РёРјСѓР»РёСЂСѓРµС‚ bile flow Рё Р·Р°С‰РёС‰Р°РµС‚ РѕС‚ С…РѕР»РµСЃС‚Р°Р·Р°. РљРѕРјР±РёРЅР°С†РёСЏ РїРѕРєСЂС‹РІР°РµС‚ РѕР±Р° РѕСЃРЅРѕРІРЅС‹С… РїСѓС‚Рё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРіРѕ РїРѕРІСЂРµР¶РґРµРЅРёСЏ РїРµС‡РµРЅРё.',
    affectedSystems: ['hepatic', 'cardio'],
    strength: 0.85,
    clinicalNote: 'Р—РѕР»РѕС‚РѕР№ СЃС‚Р°РЅРґР°СЂС‚ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёРё РЅР° РєСѓСЂСЃР°С… РѕСЂР°Р»СЊРЅС‹С… РђРђРЎ'
  },
  {
    substanceA: 'omega3',
    substanceB: 'telmisartan',
    synergyType: 'complementary',
    mechanism: 'РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· СЂР°Р·РЅС‹Рµ РїСѓС‚Рё: С‚РµР»РјРёСЃР°СЂС‚Р°РЅ РѕР±РµСЃРїРµС‡РёРІР°РµС‚ PPAR-Оі Р°РіРѕРЅРёР·Рј Рё СЃРЅРёР¶РµРЅРёРµ РђР”, РѕРјРµРіР°-3 СЃРЅРёР¶Р°РµС‚ С‚СЂРёРіР»РёС†РµСЂРёРґС‹ Рё РјРѕРґСѓР»РёСЂСѓРµС‚ РІРѕСЃРїР°Р»РµРЅРёРµ. РљРѕРјР±РёРЅР°С†РёСЏ РјР°РєСЃРёРјР°Р»СЊРЅРѕ СЃРЅРёР¶Р°РµС‚ РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅС‹Р№ СЂРёСЃРє.',
    affectedSystems: ['cardio', 'renal'],
    strength: 0.75,
    clinicalNote: 'Р РµРєРѕРјРµРЅРґСѓРµРјР°СЏ РєРѕРјР±РёРЅР°С†РёСЏ РґР»СЏ РєР°СЂРґРёРѕР·Р°С‰РёС‚С‹ РЅР° РєСѓСЂСЃР°x РђРђРЎ'
  },
  {
    substanceA: 'magnesium',
    substanceB: 'ashwagandha',
    synergyType: 'synergistic',
    mechanism: 'РђРЅРєСЃРёРѕР»РёС‚РёС‡РµСЃРєРёР№ СЃРёРЅРµСЂРіРёР·Рј: РјР°РіРЅРёР№ РїРѕС‚РµРЅС†РёСЂСѓРµС‚ GABA-A СЂРµС†РµРїС‚РѕСЂС‹ Рё Р±Р»РѕРєРёСЂСѓРµС‚ NMDA, Р°С€РІР°РіР°РЅРґР° СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» С‡РµСЂРµР· РјРѕРґСѓР»СЏС†РёСЋ РѕСЃРё HPA Рё СѓСЃРёР»РёРІР°РµС‚ GABA-РµСЂРіРёС‡РµСЃРєСѓСЋ РїРµСЂРµРґР°С‡Сѓ. РљРѕРјР±РёРЅР°С†РёСЏ СЌС„С„РµРєС‚РёРІРЅРѕ РєСѓРїРёСЂСѓРµС‚ РЅРµР№СЂРѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ Рё С‚СЂРµРІРѕР¶РЅРѕСЃС‚СЊ.',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.70,
  },
  {
    substanceA: 'zinc',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'РРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЏ СЃРёРЅРµСЂРіРёС‡РµСЃРєР°СЏ: С†РёРЅРє РєСЂРёС‚РёС‡РµРЅ РґР»СЏ С„СѓРЅРєС†РёРё T-РєР»РµС‚РѕРє Рё С‚РёРјСѓСЃР°, РІРёС‚Р°РјРёРЅ D3 РјРѕРґСѓР»РёСЂСѓРµС‚ РІСЂРѕР¶РґС‘РЅРЅС‹Р№ Рё Р°РґР°РїС‚РёРІРЅС‹Р№ РёРјРјСѓРЅРёС‚РµС‚ С‡РµСЂРµР· VDR. Р¦РёРЅРє С‚Р°РєР¶Рµ РїРѕРІС‹С€Р°РµС‚ Р°РєС‚РёРІРЅРѕСЃС‚СЊ РІРёС‚Р°РјРёРЅ D-СЃРІСЏР·С‹РІР°СЋС‰РµРіРѕ Р±РµР»РєР°.',
    affectedSystems: ['hematologic', 'endocrine', 'reproductive'],
    strength: 0.65,
  },
  {
    substanceA: 'bpc157',
    substanceB: 'tb500',
    synergyType: 'synergistic',
    mechanism: 'Р РµРіРµРЅРµСЂР°С†РёСЏ С‡РµСЂРµР· Р°РЅРіРёРѕРіРµРЅРµР· + РјРёРіСЂР°С†РёСЋ РєР»РµС‚РѕРє: BPC-157 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ VEGF/FGF Рё Р°РЅРіРёРѕРіРµРЅРµР·, TB-500 (С‚РёРјРѕР·РёРЅ ОІ4) СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РјРёРіСЂР°С†РёСЋ СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅС‹С… РєР»РµС‚РѕРє Рё Р°РєС‚РёРЅ-РїРѕР»РёРјРµСЂРёР·Р°С†РёСЋ. РљРѕРјР±РёРЅР°С†РёСЏ СѓСЃРєРѕСЂСЏРµС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃСѓС…РѕР¶РёР»РёР№, СЃРІСЏР·РѕРє Рё РјС‹С€С†.',
    affectedSystems: ['musculoskeletal', 'cardio', 'neuro'],
    strength: 0.90,
    clinicalNote: 'РќР°РёР±РѕР»РµРµ РјРѕС‰РЅР°СЏ РєРѕРјР±РёРЅР°С†РёСЏ РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ С‚СЂР°РІРј РјСЏРіРєРёС… С‚РєР°РЅРµР№'
  },
  {
    substanceA: 'curcumin',
    substanceB: 'piperine',
    synergyType: 'potentiative',
    mechanism: 'Р‘РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РєСѓСЂРєСѓРјРёРЅР° СѓРІРµР»РёС‡РёРІР°РµС‚СЃСЏ РІ 10 СЂР°Р· РїСЂРё РєРѕРјР±РёРЅР°С†РёРё СЃ РїРёРїРµСЂРёРЅРѕРј С‡РµСЂРµР· РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ UGT Рё CYP3A4 РІ РєРёС€РµС‡РЅРёРєРµ Рё РїРµС‡РµРЅРё. РџРёРїРµСЂРёРЅ С‚Р°РєР¶Рµ РёРЅРіРёР±РёСЂСѓРµС‚ P-РіР»РёРєРѕРїСЂРѕС‚РµРёРЅ, СѓСЃРёР»РёРІР°СЏ Р°Р±СЃРѕСЂР±С†РёСЋ.',
    affectedSystems: ['hepatic', 'cardio'],
    strength: 0.80,
    clinicalNote: 'РџРёРїРµСЂРёРЅ 5-10 РјРі РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґР»СЏ РїРѕС‚РµРЅС†РёР°С†РёРё; Р±РѕР»РµРµ РІС‹СЃРѕРєРёРµ РґРѕР·С‹ РјРѕРіСѓС‚ СѓСЃРёР»РёС‚СЊ С‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ'
  },
  {
    substanceA: 'coq10',
    substanceB: 'omega3',
    synergyType: 'complementary',
    mechanism: 'РњРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅР°СЏ Р·Р°С‰РёС‚Р° РјРµРјР±СЂР°РЅ: РєРѕСЌРЅР·РёРј Q10 РїРµСЂРµРЅРѕСЃРёС‚ СЌР»РµРєС‚СЂРѕРЅС‹ РІ ETC Рё СЏРІР»СЏРµС‚СЃСЏ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РѕРј РІРЅСѓС‚СЂРµРЅРЅРёС… РјРµРјР±СЂР°РЅ, РѕРјРµРіР°-3 РІСЃС‚СЂР°РёРІР°РµС‚СЃСЏ РІ Р»РёРїРёРґРЅС‹Р№ Р±РёСЃР»РѕР№ Рё СЃС‚Р°Р±РёР»РёР·РёСЂСѓРµС‚ РјРµРјР±СЂР°РЅРЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ. РљРѕРјР±РёРЅР°С†РёСЏ РѕРїС‚РёРјРёР·РёСЂСѓРµС‚ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ РєР°СЂРґРёРѕРјРёРѕС†РёС‚РѕРІ.',
    affectedSystems: ['cardio', 'neuro'],
    strength: 0.70,
  },
  {
    substanceA: 'boron',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'Р‘РѕСЂ СѓСЃРёР»РёРІР°РµС‚ РїРѕР»СѓСЂР°СЃРїР°Рґ РІРёС‚Р°РјРёРЅР° D РІ РїР»Р°Р·РјРµ Рё РїРѕРІС‹С€Р°РµС‚ Р°РєС‚РёРІРЅРѕСЃС‚СЊ 1О±-РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹ РІ РїРѕС‡РєР°С…. РЈРІРµР»РёС‡РёРІР°РµС‚ РєРѕРЅРІРµСЂСЃРёСЋ РІРёС‚Р°РјРёРЅР° D РІ Р°РєС‚РёРІРЅСѓСЋ С„РѕСЂРјСѓ (25-OH-D3 в†’ 1,25-(OH)2-D3) Рё СЃРЅРёР¶Р°РµС‚ SHBG, РїРѕРІС‹С€Р°СЏ СѓСЂРѕРІРµРЅСЊ СЃРІРѕР±РѕРґРЅРѕРіРѕ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°.',
    affectedSystems: ['endocrine', 'musculoskeletal'],
    strength: 0.60,
    clinicalNote: 'Р‘РѕСЂ 3-6 РјРі/РґРµРЅСЊ РґРѕСЃС‚Р°С‚РѕС‡РµРЅ РґР»СЏ РїРѕС‚РµРЅС†РёР°С†РёРё РІРёС‚Р°РјРёРЅР° D3'
  },
  {
    substanceA: 'ashwagandha',
    substanceB: 'tongkat_ali',
    synergyType: 'synergistic',
    mechanism: 'РџРѕРІС‹С€РµРЅРёРµ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР° С‡РµСЂРµР· РґРІР° РїСѓС‚Рё: Р°С€РІР°РіР°РЅРґР° СЃРЅРёР¶Р°РµС‚ РєРѕСЂС‚РёР·РѕР» Рё РїРѕРІС‹С€Р°РµС‚ DHEA-S (Р°РЅС‚РёСЃС‚СЂРµСЃСЃ-РїСѓС‚СЊ), С‚РѕРЅРіРєР°С‚ Р°Р»Рё СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РІС‹СЃРІРѕР±РѕР¶РґРµРЅРёРµ LH Рё СѓРІРµР»РёС‡РёРІР°РµС‚ 17-РєРµС‚РѕСЃС‚РµСЂРѕРёРґС‹ (РіРёРїРѕС‚Р°Р»Р°РјРѕ-РіРёРїРѕС„РёР·Р°СЂРЅС‹Р№ РїСѓС‚СЊ). Р”РІРѕР№РЅР°СЏ СЃС‚РёРјСѓР»СЏС†РёСЏ РјР°РєСЃРёРјРёР·РёСЂСѓРµС‚ СЌРЅРґРѕРіРµРЅРЅС‹Р№ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ.',
    affectedSystems: ['endocrine', 'reproductive', 'neuro'],
    strength: 0.75,
  },
  {
    substanceA: 'fadogia',
    substanceB: 'tongkat_ali',
    synergyType: 'synergistic',
    mechanism: 'LH/Р›РµР№РґРёРі-СЃС‚РёРјСѓР»СЏС†РёСЏ С‡РµСЂРµР· СЂР°Р·РЅС‹Рµ РјРµС…Р°РЅРёР·РјС‹: С„Р°РґРѕРіРёСЏ СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РіРёРїРѕС‚Р°Р»Р°РјРѕ-РіРёРїРѕС„РёР·Р°СЂРЅСѓСЋ РѕСЃСЊ Рє РІС‹Р±СЂРѕСЃСѓ LH, С‚РѕРЅРіРєР°С‚ Р°Р»Рё РґРµР№СЃС‚РІСѓРµС‚ РЅР° РєР»РµС‚РєРё Р›РµР№РґРёРіР°, РїРѕРІС‹С€Р°СЏ 17-РєРµС‚РѕСЃС‚РµСЂРѕРёРґС‹. РљРѕРјР±РёРЅР°С†РёСЏ РїРѕРєСЂС‹РІР°РµС‚ РѕР±Р° СѓСЂРѕРІРЅСЏ HPTA.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.70,
    clinicalNote: 'Р’С‹СЃРѕРєРёРµ РґРѕР·С‹ С„Р°РґРѕРіРёРё РјРѕРіСѓС‚ Р±С‹С‚СЊ С‚РѕРєСЃРёС‡РЅС‹ РґР»СЏ СЏРёС‡РµРє РїСЂРё РґР»РёС‚РµР»СЊРЅРѕРј РїСЂРёРјРµРЅРµРЅРёРё'
  },
  {
    substanceA: 'shilajit',
    substanceB: 'iron',
    synergyType: 'complementary',
    mechanism: 'Р“РµРјР°С‚РѕРїРѕСЌР·: С„СѓР»СЊРІРѕРєРёСЃР»РѕС‚С‹ РјСѓРјРёС‘ С…РµР»Р°С‚РёСЂСѓСЋС‚ Р¶РµР»РµР·Рѕ, СѓР»СѓС‡С€Р°СЏ РµРіРѕ С‚СЂР°РЅСЃРїРѕСЂС‚ Рё СѓСЃРІРѕРµРЅРёРµ, Р° С‚Р°РєР¶Рµ СЃС‚РёРјСѓР»РёСЂСѓСЋС‚ СЌСЂРёС‚СЂРѕРїРѕСЌР· С‡РµСЂРµР· РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅСѓСЋ РїРѕРґРґРµСЂР¶РєСѓ. РљРѕРјР±РёРЅР°С†РёСЏ СЌС„С„РµРєС‚РёРІРЅРµРµ РјРѕРЅРѕС‚РµСЂР°РїРёРё Р¶РµР»РµР·РѕРј РїСЂРё Р°РЅРµРјРёРё.',
    affectedSystems: ['hematologic', 'hepatic'],
    strength: 0.55,
    clinicalNote: 'РњСѓРјРёС‘ С‚Р°РєР¶Рµ Р·Р°С‰РёС‰Р°РµС‚ РѕС‚ Р¶РµР»РµР·Рѕ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРіРѕ РѕРєРёСЃР»РёС‚РµР»СЊРЅРѕРіРѕ СЃС‚СЂРµСЃСЃР°'
  },
  {
    substanceA: 'milk_thistle',
    substanceB: 'tudca',
    synergyType: 'synergistic',
    mechanism: 'Р”РІРѕР№РЅРѕР№ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ: СЃРёР»РёРјР°СЂРёРЅ СЃС‚Р°Р±РёР»РёР·РёСЂСѓРµС‚ РјРµРјР±СЂР°РЅС‹ РіРµРїР°С‚РѕС†РёС‚РѕРІ Рё РѕР±РµСЃРїРµС‡РёРІР°РµС‚ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅСѓСЋ Р·Р°С‰РёС‚Сѓ (РјРµРјР±СЂР°РЅРЅС‹Р№ РїСѓС‚СЊ), TUDCA СЃС‚РёРјСѓР»РёСЂСѓРµС‚ bile flow Рё РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ С…РѕР»РµСЃС‚Р°Р· (С…РѕР»РµСЂРµР·РЅС‹Р№ РїСѓС‚СЊ). РџРѕРєСЂС‹С‚РёРµ РѕР±РѕРёС… РјРµС…Р°РЅРёР·РјРѕРІ РїРѕРІСЂРµР¶РґРµРЅРёСЏ.',
    affectedSystems: ['hepatic'],
    strength: 0.80,
  },
  {
    substanceA: 'nac',
    substanceB: 'vitamin_c',
    synergyType: 'synergistic',
    mechanism: 'Р РµРіРµРЅРµСЂР°С†РёСЏ РіР»СѓС‚Р°С‚РёРѕРЅР° + РїСЂСЏРјРѕР№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚: NAC РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ С†РёСЃС‚РµРёРЅ РґР»СЏ СЂРµСЃРёРЅС‚РµР·Р° РіР»СѓС‚Р°С‚РёРѕРЅР°, РІРёС‚Р°РјРёРЅ C РЅР°РїСЂСЏРјСѓСЋ РЅРµР№С‚СЂР°Р»РёР·СѓРµС‚ ROS Рё СЂРµРіРµРЅРµСЂРёСЂСѓРµС‚ РІРёС‚Р°РјРёРЅ E. РљРѕРјР±РёРЅР°С†РёСЏ РѕР±РµСЃРїРµС‡РёРІР°РµС‚ РїРѕР»РЅСѓСЋ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅСѓСЋ Р·Р°С‰РёС‚Сѓ РІРѕРґРЅРѕР№ Рё Р»РёРїРёРґРЅРѕР№ С„Р°Р·.',
    affectedSystems: ['hepatic', 'cardio', 'hematologic'],
    strength: 0.70,
  },
  {
    substanceA: 'folate',
    substanceB: 'vitamin_b12',
    synergyType: 'synergistic',
    mechanism: 'Р“РѕРјРѕС†РёСЃС‚РµРёРЅ-СЃРЅРёР¶РµРЅРёРµ СЃРёРЅРµСЂРіРёС‡РµСЃРєРѕРµ: С„РѕР»Р°С‚ РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ РјРµС‚РёР»СЊРЅСѓСЋ РіСЂСѓРїРїСѓ РґР»СЏ СЂРµРјРµС‚РёР»СЏС†РёРё РіРѕРјРѕС†РёСЃС‚РµРёРЅР° РІ РјРµС‚РёРѕРЅРёРЅ (С‡РµСЂРµР· MS), РІРёС‚Р°РјРёРЅ B12 СЃР»СѓР¶РёС‚ РєРѕС„Р°РєС‚РѕСЂРѕРј РјРµС‚РёРѕРЅРёРЅСЃРёРЅС‚Р°Р·С‹. B12-РґРµС„РёС†РёС‚ Р±Р»РѕРєРёСЂСѓРµС‚ С„РѕР»Р°С‚РЅС‹Р№ С†РёРєР» (С„РѕР»Р°С‚-Р»РѕРІСѓС€РєР°).',
    affectedSystems: ['cardio', 'hematologic', 'neuro'],
    strength: 0.80,
    clinicalNote: 'B12-РґРµС„РёС†РёС‚ РґРµР»Р°РµС‚ РїСЂРёС‘Рј С„РѕР»Р°С‚Р° РЅРµСЌС„С„РµРєС‚РёРІРЅС‹Рј вЂ” СЃРЅР°С‡Р°Р»Р° РЅРѕСЂРјР°Р»РёР·РѕРІР°С‚СЊ B12'
  },
  {
    substanceA: 'bpc157',
    substanceB: 'collagen',
    synergyType: 'complementary',
    mechanism: 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃСѓС…РѕР¶РёР»РёР№ + СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Р№ РјР°С‚РµСЂРёР°Р»: BPC-157 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ Р°РЅРіРёРѕРіРµРЅРµР· Рё РїСЂРѕР»РёС„РµСЂР°С†РёСЋ С„РёР±СЂРѕР±Р»Р°СЃС‚РѕРІ (СЃРёРіРЅР°Р»СЊРЅС‹Р№ РїСѓС‚СЊ), РєРѕР»Р»Р°РіРµРЅ РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ Р°РјРёРЅРѕРєРёСЃР»РѕС‚С‹ РґР»СЏ СЃРёРЅС‚РµР·Р° РЅРѕРІРѕРіРѕ РјР°С‚СЂРёРєСЃР° (СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Р№ РїСѓС‚СЊ).',
    affectedSystems: ['musculoskeletal'],
    strength: 0.75,
    clinicalNote: 'РћРїС‚РёРјР°Р»СЊРЅР°СЏ РєРѕРјР±РёРЅР°С†РёСЏ РґР»СЏ СЂРµР°Р±РёР»РёС‚Р°С†РёРё РїРѕСЃР»Рµ С‚СЂР°РІРј СЃСѓС…РѕР¶РёР»РёР№ Рё СЃРІСЏР·РѕРє'
  },
  {
    substanceA: 'trenbolone_acetate',
    substanceB: 'cabergoline',
    synergyType: 'complementary',
    mechanism: 'РљРѕРЅС‚СЂРѕР»СЊ РїСЂРѕР»Р°РєС‚РёРЅР°: С‚СЂРµРЅР±РѕР»РѕРЅ РїРѕРІС‹С€Р°РµС‚ РїСЂРѕР»Р°РєС‚РёРЅ С‡РµСЂРµР· РїСЂРѕРіРµСЃС‚Р°РіРµРЅРЅС‹Р№ РјРµС…Р°РЅРёР·Рј, РєР°Р±РµСЂРіРѕР»РёРЅ вЂ” D2-Р°РіРѕРЅРёСЃС‚, РїРѕРґР°РІР»СЏСЋС‰РёР№ СЃРµРєСЂРµС†РёСЋ РїСЂРѕР»Р°РєС‚РёРЅР° Р»Р°РєС‚РѕС‚СЂРѕС„Р°РјРё РіРёРїРѕС„РёР·Р°. РџСЂРµРІРµРЅС‚РёРІРЅС‹Р№ РїСЂРёС‘Рј РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РіРёРЅРµРєРѕРјР°СЃС‚РёСЋ Рё Р»РёР±РёРґРѕ-РґРёСЃС„СѓРЅРєС†РёСЋ.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.70,
    clinicalNote: 'РљР°Р±РµСЂРіРѕР»РёРЅ 0.25 РјРі Г— 2/РЅРµРґ РїСЂРё С‚СЂРµРЅР±РѕР»РѕРЅ-РєСѓСЂСЃР°С…'
  },
  {
    substanceA: 'nandrolone_decanoate',
    substanceB: 'cabergoline',
    synergyType: 'complementary',
    mechanism: 'РљРѕРЅС‚СЂРѕР»СЊ РїСЂРѕРіРµСЃС‚Р°РіРµРЅ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РіРёРїРµСЂРїСЂРѕР»Р°РєС‚РёРЅРµРјРёРё: РЅР°РЅРґСЂРѕР»РѕРЅ РґРµР№СЃС‚РІСѓРµС‚ РєР°Рє РїСЂРѕРіРµСЃС‚Р°РіРµРЅ, РїРѕС‚РµРЅС†РёСЂСѓСЏ СЃРµРєСЂРµС†РёСЋ РїСЂРѕР»Р°РєС‚РёРЅР°; РєР°Р±РµСЂРіРѕР»РёРЅ С‡РµСЂРµР· D2-Р°РіРѕРЅРёР·Рј РїРѕРґР°РІР»СЏРµС‚ Р»Р°РєС‚РѕС‚СЂРѕС„С‹ Рё РЅРѕСЂРјР°Р»РёР·СѓРµС‚ СѓСЂРѕРІРµРЅСЊ РїСЂРѕР»Р°РєС‚РёРЅР°.',
    affectedSystems: ['endocrine', 'reproductive'],
    strength: 0.65,
    clinicalNote: 'РќР°РЅРґСЂРѕР»РѕРЅ РјРµРЅРµРµ РїСЂРѕР»Р°РєС‚РёРЅРѕРіРµРЅРµРЅ С‡РµРј С‚СЂРµРЅР±РѕР»РѕРЅ, РЅРѕ РєРѕРЅС‚СЂРѕР»СЊ РЅРµРѕР±С…РѕРґРёРј'
  },
  {
    substanceA: 'testosterone_enanthate',
    substanceB: 'anastrozole',
    synergyType: 'complementary',
    mechanism: 'РљРѕРЅС‚СЂРѕР»СЊ E2: С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ Р°СЂРѕРјР°С‚РёР·РёСЂСѓРµС‚СЃСЏ РІ СЌСЃС‚СЂР°РґРёРѕР», Р°РЅР°СЃС‚СЂРѕР·РѕР» РёРЅРіРёР±РёСЂСѓРµС‚ Р°СЂРѕРјР°С‚Р°Р·Сѓ, РїСЂРµРґРѕС‚РІСЂР°С‰Р°СЏ СЌСЃС‚СЂРѕРіРµРЅ-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅС‹Рµ РїРѕР±РѕС‡РЅС‹Рµ СЌС„С„РµРєС‚С‹ (РіРёРЅРµРєРѕРјР°СЃС‚РёСЏ, Р·Р°РґРµСЂР¶РєР° Р¶РёРґРєРѕСЃС‚Рё, СЌРјРѕС†РёРѕРЅР°Р»СЊРЅР°СЏ Р»Р°Р±РёР»СЊРЅРѕСЃС‚СЊ).',
    affectedSystems: ['endocrine', 'cardio', 'reproductive'],
    strength: 0.75,
    clinicalNote: 'РђРЅР°СЃС‚СЂРѕР·РѕР» 0.25-0.5 РјРі Г— 2/РЅРµРґ; РєРѕРЅС‚СЂРѕР»РёСЂРѕРІР°С‚СЊ E2 РІ СЂРµС„РµСЂРµРЅСЃРµ'
  },
  {
    substanceA: 'testosterone_enanthate',
    substanceB: 'hcg',
    synergyType: 'complementary',
    mechanism: 'РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ Р°С‚СЂРѕС„РёРё СЏРёС‡РµРє: СЌРєР·РѕРіРµРЅРЅС‹Р№ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ РїРѕРґР°РІР»СЏРµС‚ LH в†’ Р°С‚СЂРѕС„РёСЏ СЏРёС‡РµРє; РҐР“Р§ вЂ” LH-Р°РЅР°Р»РѕРі, СЃС‚РёРјСѓР»РёСЂСѓСЋС‰РёР№ РєР»РµС‚РєРё Р›РµР№РґРёРіР° Рё РїРѕРґРґРµСЂР¶РёРІР°СЋС‰РёР№ РёРЅС‚СЂР°С‚РµСЃС‚РёРєСѓР»СЏСЂРЅС‹Р№ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ Рё СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·.',
    affectedSystems: ['reproductive', 'endocrine'],
    strength: 0.85,
    clinicalNote: 'РҐР“Р§ 250-500 РњР• Г— 2/РЅРµРґ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ Р°С‚СЂРѕС„РёСЋ Рё СѓСЃРєРѕСЂСЏРµС‚ РџРљРў'
  },
  {
    substanceA: 'methandienone',
    substanceB: 'tudca',
    synergyType: 'complementary',
    mechanism: 'РљРѕРЅС‚СЂРѕР»СЊ С…РѕР»РµСЃС‚Р°С‚РёС‡РµСЃРєРѕРіРѕ РїРѕРІСЂРµР¶РґРµРЅРёСЏ: РѕСЂР°Р»СЊРЅС‹Рµ РђРђРЎ (РјРµС‚Р°РЅРґРёРµРЅРѕРЅ) РІС‹Р·С‹РІР°СЋС‚ С…РѕР»РµСЃС‚Р°Р· С‡РµСЂРµР· РЅР°СЂСѓС€РµРЅРёРµ bile flow Рё РіРµРїР°С‚РѕС†РёС‚Р°СЂРЅС‹Р№ СЃС‚СЂРµСЃСЃ; TUDCA РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ bile flow Рё С†РёС‚РѕРїСЂРѕС‚РµРєС†РёСЋ РіРµРїР°С‚РѕС†РёС‚РѕРІ.',
    affectedSystems: ['hepatic'],
    strength: 0.70,
    clinicalNote: 'РџСЂРёРјРµРЅСЏРµС‚СЃСЏ РїСЂРё Р»СЋР±РѕРј РѕСЂР°Р»Рµ: РјРµС‚Р°РЅРґРёРµРЅРѕРЅ, СЃС‚Р°РЅРѕР·РѕР»РѕР», РѕРєСЃР°РЅРґСЂРѕР»РѕРЅ Рё РґСЂ.'
  },
  {
    substanceA: 'mk677',
    substanceB: 'berberine',
    synergyType: 'complementary',
    mechanism: 'РљРѕРЅС‚СЂРѕР»СЊ РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё: MK-677 (РёР±СѓС‚Р°РјРѕСЂРµРЅ) РїРѕРІС‹С€Р°РµС‚ GH/IGF-1, РЅРѕ РІС‹Р·С‹РІР°РµС‚ РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ; Р±РµСЂР±РµСЂРёРЅ Р°РєС‚РёРІРёСЂСѓРµС‚ AMPK, СЃРЅРёР¶Р°РµС‚ HOMA-IR Рё РіР»СЋРєРѕРЅРµРѕРіРµРЅРµР·, РєРѕРјРїРµРЅСЃРёСЂСѓСЏ РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ РїРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚.',
    affectedSystems: ['endocrine', 'cardio'],
    strength: 0.60,
    clinicalNote: 'РњРѕРЅРёС‚РѕСЂРёРЅРі HbA1c Рё HOMA-IR РѕР±СЏР·Р°С‚РµР»РµРЅ РїСЂРё MK-677 РєСѓСЂСЃР°С…'
  },
  {
    substanceA: 'vitamin_d3',
    substanceB: 'vitamin_k2',
    synergyType: 'synergistic',
    mechanism: 'РњРµС‚Р°Р±РѕР»РёР·Рј РєР°Р»СЊС†РёСЏ: РІРёС‚Р°РјРёРЅ D3 РїРѕРІС‹С€Р°РµС‚ Р°Р±СЃРѕСЂР±С†РёСЋ РєР°Р»СЊС†РёСЏ РІ РєРёС€РµС‡РЅРёРєРµ, РІРёС‚Р°РјРёРЅ K2 РЅР°РїСЂР°РІР»СЏРµС‚ РєР°Р»СЊС†РёР№ РІ РєРѕСЃС‚Рё (С‡РµСЂРµР· Р°РєС‚РёРІР°С†РёСЋ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР°) Рё РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РєР°Р»СЊС†РёС„РёРєР°С†РёСЋ СЃРѕСЃСѓРґРѕРІ (С‡РµСЂРµР· Р°РєС‚РёРІР°С†РёСЋ MGP). Р‘РµР· K2 РєР°Р»СЊС†РёР№ РґРµРїРѕРЅРёСЂСѓРµС‚СЃСЏ РІ СЃРѕСЃСѓРґР°С….',
    affectedSystems: ['musculoskeletal', 'cardio', 'endocrine'],
    strength: 0.75,
    clinicalNote: 'K2 РѕР±СЏР·Р°С‚РµР»РµРЅ РїСЂРё РґРѕР·Р°С… РІРёС‚Р°РјРёРЅР° D3 >2000 РњР•/РґРµРЅСЊ'
  },
  {
    substanceA: 'magnesium',
    substanceB: 'vitamin_d3',
    synergyType: 'synergistic',
    mechanism: 'РњР°РіРЅРёР№ вЂ” РєРѕС„Р°РєС‚РѕСЂ РІРёС‚Р°РјРёРЅ D-СЃРІСЏР·С‹РІР°СЋС‰РµРіРѕ Р±РµР»РєР° Рё С„РµСЂРјРµРЅС‚РѕРІ РјРµС‚Р°Р±РѕР»РёР·РјР° РІРёС‚Р°РјРёРЅР° D (1О±-РіРёРґСЂРѕРєСЃРёР»Р°Р·Р°, 24-РіРёРґСЂРѕРєСЃРёР»Р°Р·Р°). Р”РµС„РёС†РёС‚ РјР°РіРЅРёСЏ СЃРЅРёР¶Р°РµС‚ РєРѕРЅРІРµСЂСЃРёСЋ РІРёС‚Р°РјРёРЅР° D РІ Р°РєС‚РёРІРЅСѓСЋ С„РѕСЂРјСѓ.',
    affectedSystems: ['endocrine', 'musculoskeletal', 'neuro'],
    strength: 0.55,
  },
  {
    substanceA: 'glucosamine',
    substanceB: 'chondroitin',
    synergyType: 'synergistic',
    mechanism: 'РҐРѕРЅРґСЂРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· РґРІР° РєРѕРјРїРѕРЅРµРЅС‚Р°: РіР»СЋРєРѕР·Р°РјРёРЅ СЃС‚РёРјСѓР»РёСЂСѓРµС‚ СЃРёРЅС‚РµР· РіР»РёРєРѕР·Р°РјРёРЅРѕРіР»РёРєР°РЅРѕРІ Рё РїСЂРѕС‚РµРѕРіР»РёРєР°РЅРѕРІ, С…РѕРЅРґСЂРѕРёС‚РёРЅ СѓРґРµСЂР¶РёРІР°РµС‚ РІРѕРґСѓ РІ С…СЂСЏС‰Рµ Рё РїРѕРґР°РІР»СЏРµС‚ MMP. РљРѕРјР±РёРЅР°С†РёСЏ Р·Р°РјРµРґР»СЏРµС‚ РґРµРіСЂР°РґР°С†РёСЋ С…СЂСЏС‰Р° СЌС„С„РµРєС‚РёРІРЅРµРµ РјРѕРЅРѕС‚РµСЂР°РїРёРё.',
    affectedSystems: ['musculoskeletal'],
    strength: 0.60,
  },
  {
    substanceA: 'collagen',
    substanceB: 'vitamin_c',
    synergyType: 'potentiative',
    mechanism: 'Р’РёС‚Р°РјРёРЅ C вЂ” РєРѕС„Р°РєС‚РѕСЂ РїСЂРѕР»РёР»- Рё Р»РёР·РёР»РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹, РєСЂРёС‚РёС‡РЅС‹С… С„РµСЂРјРµРЅС‚РѕРІ СЃРёРЅС‚РµР·Р° РєРѕР»Р»Р°РіРµРЅР°. Р‘РµР· РІРёС‚Р°РјРёРЅР° C СЃРёРЅС‚РµР· РЅРѕРІРѕРіРѕ РєРѕР»Р»Р°РіРµРЅР° РЅРµРІРѕР·РјРѕР¶РµРЅ; РєРѕРјР±РёРЅР°С†РёСЏ Р·РЅР°С‡РёС‚РµР»СЊРЅРѕ СѓСЃРєРѕСЂСЏРµС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ С…СЂСЏС‰Р° Рё СЃСѓС…РѕР¶РёР»РёР№.',
    affectedSystems: ['musculoskeletal'],
    strength: 0.70,
  },
  {
    substanceA: 'alpha_lipoic',
    substanceB: 'nac',
    synergyType: 'synergistic',
    mechanism: 'РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅР°СЏ Р·Р°С‰РёС‚Р°: О±-Р»РёРїРѕРµРІР°СЏ РєРёСЃР»РѕС‚Р° РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РІРёС‚Р°РјРёРЅ C/E Рё РїРѕРІС‹С€Р°РµС‚ РіР»СѓС‚Р°С‚РёРѕРЅ, NAC РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ С†РёСЃС‚РµРёРЅ РґР»СЏ СЃРёРЅС‚РµР·Р° РЅРѕРІРѕРіРѕ РіР»СѓС‚Р°С‚РёРѕРЅР°. РљРѕРјР±РёРЅР°С†РёСЏ РїРѕРєСЂС‹РІР°РµС‚ РІРѕРґРЅСѓСЋ Рё Р»РёРїРёРґРЅСѓСЋ С„Р°Р·С‹ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅРѕР№ Р·Р°С‰РёС‚С‹.',
    affectedSystems: ['hepatic', 'neuro', 'cardio'],
    strength: 0.65,
  },
  {
    substanceA: 'omega3',
    substanceB: 'vitamin_d3',
    synergyType: 'additive',
    mechanism: 'РљР°СЂРґРёРѕ-РёРјРјСѓРЅРЅР°СЏ Р·Р°С‰РёС‚Р°: РѕРјРµРіР°-3 СЃРЅРёР¶Р°РµС‚ С‚СЂРёРіР»РёС†РµСЂРёРґС‹ Рё РјРѕРґСѓР»РёСЂСѓРµС‚ РІРѕСЃРїР°Р»РµРЅРёРµ, РІРёС‚Р°РјРёРЅ D3 СЂРµРіСѓР»РёСЂСѓРµС‚ РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚ Рё СЂРµРЅРёРЅ-Р°РЅРіРёРѕС‚РµРЅР·РёРЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ. Р–РёСЂРѕСЂР°СЃС‚РІРѕСЂРёРјС‹Р№ РІРёС‚Р°РјРёРЅ D3 Р»СѓС‡С€Рµ Р°Р±СЃРѕСЂР±РёСЂСѓРµС‚СЃСЏ СЃ Р¶РёСЂР°РјРё РѕРјРµРіР°-3.',
    affectedSystems: ['cardio', 'hematologic', 'endocrine'],
    strength: 0.50,
  },
  {
    substanceA: 'selenium',
    substanceB: 'vitamin_e',
    synergyType: 'synergistic',
    mechanism: 'РЎРµР»РµРЅ вЂ” РєРѕС„Р°РєС‚РѕСЂ РіР»СѓС‚Р°С‚РёРѕРЅРїРµСЂРѕРєСЃРёРґР°Р·С‹, РІРёС‚Р°РјРёРЅ E вЂ” С†РµРїРЅРѕСЂР°СЋС‰РёР№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ Р»РёРїРёРґРЅС‹С… РјРµРјР±СЂР°РЅ. РЎРµР»РµРЅ СЂРµРіРµРЅРµСЂРёСЂСѓРµС‚ РѕРєРёСЃР»РµРЅРЅС‹Р№ РІРёС‚Р°РјРёРЅ E; РєРѕРјР±РёРЅР°С†РёСЏ РѕР±РµСЃРїРµС‡РёРІР°РµС‚ РїРѕР»РЅСѓСЋ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅСѓСЋ Р·Р°С‰РёС‚Сѓ РєР»РµС‚РѕС‡РЅС‹С… РјРµРјР±СЂР°РЅ.',
    affectedSystems: ['cardio', 'hepatic', 'endocrine'],
    strength: 0.55,
  },
  {
    substanceA: 'melatonin',
    substanceB: 'magnesium',
    synergyType: 'synergistic',
    mechanism: 'РЈР»СѓС‡С€РµРЅРёРµ РєР°С‡РµСЃС‚РІР° СЃРЅР°: РјРµР»Р°С‚РѕРЅРёРЅ РёРЅРёС†РёРёСЂСѓРµС‚ С†РёСЂРєР°РґРЅС‹Р№ СЃРёРіРЅР°Р» Р·Р°СЃС‹РїР°РЅРёСЏ, РјР°РіРЅРёР№ РїРѕС‚РµРЅС†РёСЂСѓРµС‚ GABA-РµСЂРіРёС‡РµСЃРєСѓСЋ РїРµСЂРµРґР°С‡Сѓ Рё СЂР°СЃСЃР»Р°Р±Р»СЏРµС‚ РјС‹С€С†С‹. РљРѕРјР±РёРЅР°С†РёСЏ РѕР±РµСЃРїРµС‡РёРІР°РµС‚ РіР»СѓР±РѕРєСѓСЋ С„Р°Р·Сѓ СЃРЅР° Рё РјС‹С€РµС‡РЅРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ.',
    affectedSystems: ['neuro', 'musculoskeletal'],
    strength: 0.65,
  },
  {
    substanceA: 'cjc1295',
    substanceB: 'ipamorelin',
    synergyType: 'synergistic',
    mechanism: 'GHRH (CJC-1295) + GHRP (РёРїР°РјРѕСЂРµР»РёРЅ) вЂ” РєР»Р°СЃСЃРёС‡РµСЃРєР°СЏ СЃРёРЅРµСЂРіРёСЏ: CJC-1295 СѓРІРµР»РёС‡РёРІР°РµС‚ Р°РјРїР»РёС‚СѓРґСѓ GH-РїСѓР»СЊСЃР°, РёРїР°РјРѕСЂРµР»РёРЅ СѓРІРµР»РёС‡РёРІР°РµС‚ С‡Р°СЃС‚РѕС‚Сѓ. Р’РјРµСЃС‚Рµ РґР°СЋС‚ 3-5Г— РїСЂРёСЂРѕСЃС‚ GH vs РјРѕРЅРѕ-С‚РµСЂР°РїРёСЏ.',
    affectedSystems: ['endocrine', 'musculoskeletal'],
    strength: 0.85,
    clinicalNote: 'Р—РѕР»РѕС‚РѕР№ СЃС‚Р°РЅРґР°СЂС‚ GH-С‚РµСЂР°РїРёРё: CJC-1295 100РјРєРі + РёРїР°РјРѕСЂРµР»РёРЅ 100РјРєРі 1-3Г—/РґРµРЅСЊ'
  },
  {
    substanceA: 'semax',
    substanceB: 'selank',
    synergyType: 'synergistic',
    mechanism: 'РЎРµРјР°РєСЃ (BDNF-СЃС‚РёРјСѓР»СЏС†РёСЏ, РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· TrkB-СЂРµС†РµРїС‚РѕСЂС‹) + РЎРµР»Р°РЅРє (Р°РЅРєСЃРёРѕР»РёС‚РёРє-РїРµРїС‚РёРґ, РјРѕРґСѓР»СЏС†РёСЏ GABA-СЂРµС†РµРїС‚РѕСЂРѕРІ) = СЃРёРЅРµСЂРіРµС‚РёС‡РµСЃРєР°СЏ РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ + Р°РЅРєСЃРёРѕР»РёР·. РћРїС‚РёРјР°Р»СЊРЅС‹Р№ С†РёСЂРєР°РґРЅС‹Р№ РїСЂРѕС„РёР»СЊ: СЃС‚РёРјСѓР»РёСЂСѓСЋС‰РёР№ (СѓС‚СЂРѕ) Рё СЃРµРґР°С‚РёРІРЅС‹Р№ (РІРµС‡РµСЂ).',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.7,
    clinicalNote: 'РЎРµРјР°РєСЃ СѓС‚СЂРѕРј, РЎРµР»Р°РЅРє РІРµС‡РµСЂРѕРј вЂ” РѕРїС‚РёРјР°Р»СЊРЅС‹Р№ С†РёСЂРєР°РґРЅС‹Р№ РїСЂРѕС„РёР»СЊ'
  },
  {
    substanceA: 'ghk_cu',
    substanceB: 'vitamin_c',
    synergyType: 'synergistic',
    mechanism: 'GHK-Cu (РјРµРґСЊ-РїРµРїС‚РёРґ) Р°РєС‚РёРІРёСЂСѓРµС‚ СЃРёРЅС‚РµР· РєРѕР»Р»Р°РіРµРЅР° I/III С‡РµСЂРµР· СЂРµРіСѓР»СЏС†РёСЋ РіРµРЅРѕРІ. Р’РёС‚Р°РјРёРЅ C вЂ” РєРѕС„Р°РєС‚РѕСЂ РїСЂРѕР»РёР»РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹, РЅРµРѕР±С…РѕРґРёРјРѕР№ РґР»СЏ РіРёРґСЂРѕРєСЃРёР»РёСЂРѕРІР°РЅРёСЏ РїСЂРѕР»РёРЅР° РІ РєРѕР»Р»Р°РіРµРЅРµ. Р‘РµР· РІРёС‚Р°РјРёРЅР° C СЃРёРЅС‚РµР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕР»Р»Р°РіРµРЅ РЅРµСЃС‚Р°Р±РёР»РµРЅ.',
    affectedSystems: ['musculoskeletal', 'hepatic'],
    strength: 0.75,
  },
  {
    substanceA: 'mots_c',
    substanceB: 'aod9604',
    synergyType: 'complementary',
    mechanism: 'MOTS-C (AMPK-Р°РєС‚РёРІР°С†РёСЏ в†’ РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєР°СЏ РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ) + AOD-9604 (Р»РёРїРѕР»РёР·, РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ Р»РёРїРѕРіРµРЅРµР·Р°) = СЃРёРЅРµСЂРіРёСЏ Р¶РёСЂРѕСЃР¶РёРіР°РЅРёСЏ Рё РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРѕРіРѕ Р·РґРѕСЂРѕРІСЊСЏ.',
    affectedSystems: ['endocrine', 'cardio'],
    strength: 0.65,
  },
  {
    substanceA: 'dsip',
    substanceB: 'melatonin',
    synergyType: 'synergistic',
    mechanism: 'DSIP (Р“AMРљ-РјРѕРґСѓР»СЏС†РёСЏ в†’ РґРµР»СЊС‚Р°-СЃРѕРЅ) + РњРµР»Р°С‚РѕРЅРёРЅ (С†РёСЂРєР°РґРЅС‹Р№ СЂРёС‚Рј в†’ Р·Р°СЃС‹РїР°РЅРёРµ) = СѓСЃРёР»РµРЅРёРµ РіР»СѓР±РѕРєРёС… С„Р°Р· СЃРЅР°. РљРѕРјР±РёРЅР°С†РёСЏ РїСЂРµРІРѕСЃС…РѕРґРёС‚ РјРѕРЅРѕ-С‚РµСЂР°РїРёСЋ РїРѕ РєР°С‡РµСЃС‚РІСѓ СЃРЅР° РЅР° 40%.',
    affectedSystems: ['neuro', 'endocrine'],
    strength: 0.7,
  },
  {
    substanceA: 'ss31',
    substanceB: 'coq10',
    synergyType: 'complementary',
    mechanism: 'SS-31 СЃС‚Р°Р±РёР»РёР·РёСЂСѓРµС‚ РєР°СЂРґРёРѕР»РёРїРёРЅ РІРЅСѓС‚СЂРµРЅРЅРµР№ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕР№ РјРµРјР±СЂР°РЅС‹ в†’ CoQ10 СЌС„С„РµРєС‚РёРІРЅРµРµ РїРµСЂРµРЅРѕСЃРёС‚ СЌР»РµРєС‚СЂРѕРЅС‹ РІ РґС‹С…Р°С‚РµР»СЊРЅРѕР№ С†РµРїРё. РљРѕРјР±РёРЅР°С†РёСЏ в†‘ РђРўР¤-РїСЂРѕРґСѓРєС†РёСЋ РЅР° 30-50% vs РјРѕРЅРѕ.',
    affectedSystems: ['cardio', 'hepatic'],
    strength: 0.7,
  },
  {
    substanceA: 'foxo4_dri',
    substanceB: 'bpc157',
    synergyType: 'complementary',
    mechanism: 'FOXO4-DRI СѓРґР°Р»СЏРµС‚ СЃС‚Р°СЂРµСЋС‰РёРµ РєР»РµС‚РєРё (СЃРµРЅРѕР»РёС‚РёРє) в†’ BPC-157 СЃС‚РёРјСѓР»РёСЂСѓРµС‚ СЂРµРіРµРЅРµСЂР°С†РёСЋ РІ РѕСЃРІРѕР±РѕРґРёРІС€РµРјСЃСЏ С‚РєР°РЅРµРІРѕРј РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµ. РљРѕРјР±РёРЅР°С†РёСЏ СЃРµРЅРѕР»РёР·РёСЃ + СЂРµРіРµРЅРµСЂР°С†РёСЏ = РѕРјРѕР»РѕР¶РµРЅРёРµ С‚РєР°РЅРµР№.',
    affectedSystems: ['musculoskeletal', 'hepatic', 'renal'],
    strength: 0.65,
    clinicalNote: 'FOXO4-DRI 1Г—/РЅРµРґ + BPC-157 РµР¶РµРґРЅРµРІРЅРѕ = РѕРїС‚РёРјР°Р»СЊРЅС‹Р№ РїСЂРѕС‚РѕРєРѕР»'
  },
];

export const SUPPLEMENT_TARGETS: Record<string, SupplementTarget> = {
  telmisartan: {
    systems: ['cardio', 'renal', 'endocrine'],
    organs: ['heart', 'vascular', 'kidneys'],
    biomarkers: ['РђР”', 'TG', 'HOMA-IR', 'CREATININE', 'UREA'],
    mechanisms: ['ANG II Р±Р»РѕРєР°РґР°', 'PPAR-Оі С‡Р°СЃС‚РёС‡РЅС‹Р№ Р°РіРѕРЅРёР·Рј', 'СЃРЅРёР¶РµРЅРёРµ TGF-ОІ1', 'РЅРµС„СЂРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ РІРЅСѓС‚СЂРёРєР»СѓР±РѕС‡РєРѕРІРѕРіРѕ РґР°РІР»РµРЅРёСЏ']
  },
  nebivolol: {
    systems: ['cardio'],
    organs: ['heart', 'vascular'],
    biomarkers: ['РђР”', 'Р§РЎРЎ', 'NO Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ'],
    mechanisms: ['ОІ1-СЃРµР»РµРєС‚РёРІРЅР°СЏ Р±Р»РѕРєР°РґР°', 'NO-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ РІР°Р·РѕРґРёР»Р°С‚Р°С†РёСЏ', 'СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ СЃРѕСЃСѓРґРёСЃС‚РѕР№ СЃС‚РµРЅРєРё']
  },
  nac: {
    systems: ['hepatic', 'neuro', 'cardio', 'hematologic'],
    organs: ['liver', 'brain', 'lungs'],
    biomarkers: ['ALT', 'AST', 'GGT', 'РіР»СѓС‚Р°С‚РёРѕРЅ', 'BIL', 'CRP'],
    mechanisms: ['РїСЂРµРґС€РµСЃС‚РІРµРЅРЅРёРє РіР»СѓС‚Р°С‚РёРѕРЅР°', 'С†РёСЃС‚РµРёРЅ-РїСѓР»РёСЂРѕРІР°РЅРёРµ', 'NF-ОєB РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'РґРµС‚РѕРєСЃРёРєР°С†РёСЏ С‡РµСЂРµР· РєРѕРЅСЉСЋРіР°С†РёСЋ', 'РјСѓРєРѕР»РёС‚РёРє (СЂР°СЃС‰РµРїР»РµРЅРёРµ РґРёСЃСѓР»СЊС„РёРґРЅС‹С… СЃРІСЏР·РµР№)']
  },
  tudca: {
    systems: ['hepatic'],
    organs: ['liver', 'gallbladder'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'BIL', 'DBIL'],
    mechanisms: ['СЃС‚РёРјСѓР»СЏС†РёСЏ bile flow', 'С…РѕР»РµСЂРµР·', 'С†РёС‚РѕРїСЂРѕС‚РµРєС†РёСЏ РіРµРїР°С‚РѕС†РёС‚РѕРІ', 'Р°РЅС‚Рё-Р°РїРѕРїС‚РѕР· С‡РµСЂРµР· ER stress reduction', 'СЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅС‹С… РјРµРјР±СЂР°РЅ']
  },
  omega3: {
    systems: ['cardio', 'neuro', 'hematologic'],
    organs: ['heart', 'vascular', 'brain'],
    biomarkers: ['TG', 'HDL', 'CRP', 'IL-6', 'TNF-О±'],
    mechanisms: ['СЃРЅРёР¶РµРЅРёРµ СЃРёРЅС‚РµР·Р° С‚СЂРёРіР»РёС†РµСЂРёРґРѕРІ РІ РїРµС‡РµРЅРё', 'СЂРµР·РѕР»СЊРІРёРЅ/РїСЂРѕС‚РµРєС‚РёРЅ РјРµРґРёР°С†РёСЏ', 'СЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ РјРµРјР±СЂР°РЅ', 'Р°РЅС‚Рё-С‚СЂРѕРјР±РѕС‚РёС‡РµСЃРєРёР№ СЌС„С„РµРєС‚', 'РјРѕРґСѓР»СЏС†РёСЏ РёРѕРЅРЅС‹С… РєР°РЅР°Р»РѕРІ РєР°СЂРґРёРѕРјРёРѕС†РёС‚РѕРІ']
  },
  magnesium: {
    systems: ['neuro', 'cardio', 'musculoskeletal'],
    organs: ['brain', 'heart', 'nervous_system', 'muscles'],
    biomarkers: ['MG', 'РљР°Р»РёР№', 'РђР”', 'CRP', 'РєРѕСЂС‚РёР·РѕР»'],
    mechanisms: ['GABA-A РїРѕС‚РµРЅС†РёСЂРѕРІР°РЅРёРµ', 'NMDA Р±Р»РѕРєР°РґР°', 'Р±Р»РѕРєР°РґР° РєР°Р»СЊС†РёРµРІС‹С… РєР°РЅР°Р»РѕРІ', 'СЂР°СЃСЃР»Р°Р±Р»РµРЅРёРµ РіР»Р°РґРєРѕР№ РјСѓСЃРєСѓР»Р°С‚СѓСЂС‹', 'РєРѕС„Р°РєС‚РѕСЂ РђРўР¤Р°Р·С‹']
  },
  berberine: {
    systems: ['endocrine', 'hepatic', 'cardio'],
    organs: ['liver', 'pancreas', 'vascular'],
    biomarkers: ['HbA1c', 'HOMA-IR', 'LDL', 'TG', 'GLU', 'INS'],
    mechanisms: ['AMPK Р°РєС‚РёРІР°С†РёСЏ', 'РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ РіР»СЋРєРѕРЅРµРѕРіРµРЅРµР·Р°', 'LDL-R РІРІРµСЂС…СЂРµРіСѓР»СЏС†РёСЏ', 'РјРѕРґСѓР»СЏС†РёСЏ РјРёРєСЂРѕР±РёРѕРјР°', 'РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ CYP3A4']
  },
  coq10: {
    systems: ['cardio', 'neuro'],
    organs: ['heart', 'brain', 'mitochondria'],
    biomarkers: ['LDL', 'AST', 'CK', 'CRP'],
    mechanisms: ['СЌР»РµРєС‚СЂРѕРЅРЅС‹Р№ РїРµСЂРµРЅРѕСЃ РІ ETC (Complex III в†’ Complex II)', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ Р»РёРїРёРґРЅС‹С… РјРµРјР±СЂР°РЅ', 'СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅР° E', 'СЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕРіРѕ РјРµРјР±СЂР°РЅРЅРѕРіРѕ РїРѕС‚РµРЅС†РёР°Р»Р°']
  },
  vitamin_d3: {
    systems: ['endocrine', 'hematologic', 'neuro', 'musculoskeletal'],
    organs: ['bone_marrow', 'bones', 'thyroid', 'gut'],
    biomarkers: ['VITD', 'CA', 'P', 'ALP', 'iPTH', 'SHBG'],
    mechanisms: ['VDR-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ С‚СЂР°РЅСЃРєСЂРёРїС†РёСЏ', 'РєР°Р»СЊС†РёРµРІС‹Р№ РіРѕРјРµРѕСЃС‚Р°Р·', 'РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЏ Th1/Th2', 'РјРѕРґСѓР»СЏС†РёСЏ СЂРµРЅРёРЅ-Р°РЅРіРёРѕС‚РµРЅР·РёРЅРѕРІРѕР№ СЃРёСЃС‚РµРјС‹', 'СЂРµРіСѓР»СЏС†РёСЏ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР°']
  },
  zinc: {
    systems: ['reproductive', 'hematologic', 'endocrine'],
    organs: ['testes', 'prostate', 'bone_marrow', 'thymus'],
    biomarkers: ['TT', 'FT', 'WBC', 'SHBG', 'DHT'],
    mechanisms: ['РєРѕС„Р°РєС‚РѕСЂ 5О±-СЂРµРґСѓРєС‚Р°Р·С‹', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РєР»РµС‚РѕРє Р›РµР№РґРёРіР°', 'T-РєР»РµС‚РѕС‡РЅР°СЏ РїСЂРѕР»РёС„РµСЂР°С†РёСЏ', 'РёРЅСЃСѓР»РёРЅ-РїРѕРґРѕР±РЅС‹Р№ С„Р°РєС‚РѕСЂ СЂРѕСЃС‚Р° РјРѕРґСѓР»СЏС†РёСЏ', 'РјРµС‚Р°Р»Р»РѕС‚РёРѕРЅРµРёРЅ РёРЅРґСѓРєС†РёСЏ']
  },
  hcg: {
    systems: ['reproductive', 'endocrine'],
    organs: ['testes', 'hypothalamus', 'pituitary'],
    biomarkers: ['TT', 'LH', 'FSH', 'РёРЅС‚СЂР°-С‚РµСЃС‚РёРєСѓР»СЏСЂРЅС‹Р№ T', 'СЃРїРµСЂРјРѕРіСЂР°РјРјР°'],
    mechanisms: ['LH-СЂРµС†РµРїС‚РѕСЂ Р°РіРѕРЅРёР·Рј', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РєР»РµС‚РѕРє Р›РµР№РґРёРіР°', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РєР»РµС‚РѕРє РЎРµСЂС‚РѕР»Рё', 'РїРѕРґРґРµСЂР¶Р°РЅРёРµ СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·Р°', 'РїСЂРµРІРµРЅС‚РёСЂРѕРІР°РЅРёРµ Р°С‚СЂРѕС„РёРё СЏРёС‡РµРє']
  },
  alpha_lipoic: {
    systems: ['neuro', 'cardio', 'hepatic'],
    organs: ['nervous_system', 'brain', 'liver'],
    biomarkers: ['CRP', 'ALT', 'AST', 'HbA1c', 'РіР»РёРєРёСЂРѕРІР°РЅРЅС‹Р№ Hb'],
    mechanisms: ['СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (РІРѕРґРЅС‹Р№ + Р»РёРїРёРґРЅС‹Р№)', 'СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅРѕРІ C Рё E', 'РїРѕРІС‹С€РµРЅРёРµ РіР»СѓС‚Р°С‚РёРѕРЅР° С‡РµСЂРµР· Nrf2', 'С…РµР»Р°С‚РёСЂРѕРІР°РЅРёРµ С‚СЏР¶С‘Р»С‹С… РјРµС‚Р°Р»Р»РѕРІ', 'СѓР»СѓС‡С€РµРЅРёРµ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕР№ С„СѓРЅРєС†РёРё']
  },
  ashwagandha: {
    systems: ['neuro', 'endocrine', 'reproductive'],
    organs: ['brain', 'adrenals', 'testes', 'thyroid'],
    biomarkers: ['РєРѕСЂС‚РёР·РѕР»', 'DHEA-S', 'TT', 'TSH', 'FT3', 'FT4'],
    mechanisms: ['GABA-A РјРѕРґСѓР»СЏС†РёСЏ', 'СЃРЅРёР¶РµРЅРёРµ РєРѕСЂС‚РёР·РѕР»Р° (РѕСЃСЊ HPA)', 'Р°РЅРґСЂРѕРіРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ (РїРѕРІС‹С€РµРЅРёРµ LH)', 'С‚РёСЂРµРѕРёРґРЅР°СЏ СЃС‚РёРјСѓР»СЏС†РёСЏ', 'Р°РЅС‚РёСЃС‚СЂРµСЃСЃ-Р°РґР°РїС‚РѕРіРµРЅРµР·']
  },
  saw_palmetto: {
    systems: ['reproductive'],
    organs: ['prostate', 'testes', 'hair_follicles'],
    biomarkers: ['DHT', 'PSA', 'TT/DHT ratio'],
    mechanisms: ['5О±-СЂРµРґСѓРєС‚Р°Р·Р° РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ (С‚РёРї II)', 'Р°РЅС‚РёР°РЅРґСЂРѕРіРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ РЅР° DHT', 'О±1-Р°РґСЂРµРЅРѕР±Р»РѕРєР°РґР°', 'Р°РЅС‚Рё-РїСЂРѕР»РёС„РµСЂР°С‚РёРІРЅС‹Р№ СЌС„С„РµРєС‚ РЅР° РїСЂРѕСЃС‚Р°С‚Сѓ']
  },
  celery_extract: {
    systems: ['renal', 'cardio'],
    organs: ['kidneys', 'vascular'],
    biomarkers: ['UA', 'CREATININE', 'РђР”', 'UREA'],
    mechanisms: ['СЃРЅРёР¶РµРЅРёРµ РјРѕС‡РµРІРѕР№ РєРёСЃР»РѕС‚С‹', 'Р°РїРёРіРµРЅРёРЅ-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ РІР°Р·РѕРґРёР»Р°С‚Р°С†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ С„С‚Р°Р»РёРґРѕРІ', 'РґРёСѓСЂРµС‚РёС‡РµСЃРєРёР№ СЌС„С„РµРєС‚']
  },
  vitamin_k2: {
    systems: ['cardio', 'musculoskeletal', 'endocrine'],
    organs: ['vascular', 'bones', 'liver'],
    biomarkers: ['РєР°Р»СЊС†РёС„РёРєР°С†РёСЏ СЃРѕСЃСѓРґРѕРІ', 'РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅ', 'DPD', 'CA', 'ALP'],
    mechanisms: ['Оі-РєР°СЂР±РѕРєСЃРёР»РёСЂРѕРІР°РЅРёРµ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР°', 'Оі-РєР°СЂР±РѕРєСЃРёР»РёСЂРѕРІР°РЅРёРµ MGP', 'РЅР°РїСЂР°РІР»РµРЅРёРµ РєР°Р»СЊС†РёСЏ РІ РєРѕСЃС‚Рё', 'РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РєР°Р»СЊС†РёС„РёРєР°С†РёРё СЃРѕСЃСѓРґРѕРІ', 'СЃРёРЅРµСЂРіРёСЏ СЃ РІРёС‚Р°РјРёРЅРѕРј D3']
  },
  selenium: {
    systems: ['endocrine', 'hematologic', 'neuro'],
    organs: ['thyroid', 'bone_marrow', 'brain'],
    biomarkers: ['TSH', 'FT3', 'FT4', 'GPx Р°РєС‚РёРІРЅРѕСЃС‚СЊ', 'selenoprotein P'],
    mechanisms: ['РєРѕС„Р°РєС‚РѕСЂ РіР»СѓС‚Р°С‚РёРѕРЅРїРµСЂРѕРєСЃРёРґР°Р·С‹', 'РєРѕС„Р°РєС‚РѕСЂ РґРµР№РѕРґРёРЅР°Р· (T4в†’T3)', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ С‰РёС‚РѕРІРёРґРЅРѕР№ Р¶РµР»РµР·С‹', 'T-РєР»РµС‚РѕС‡РЅР°СЏ РјРѕРґСѓР»СЏС†РёСЏ', 'Nrf2 РїСѓС‚СЊ Р°РєС‚РёРІР°С†РёРё']
  },
  milk_thistle: {
    systems: ['hepatic'],
    organs: ['liver', 'gallbladder'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'BIL', 'С„РёР±СЂРѕР·-РјР°СЂРєРµСЂС‹'],
    mechanisms: ['СЃРёР»РёР±РёРЅРёРЅ вЂ” РјРµРјР±СЂР°РЅРѕСЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ С‡РµСЂРµР· Nrf2', 'Р°РЅС‚РёС„РёР±СЂРѕС‚РёС‡РµСЃРєРёР№ (TGF-ОІ1 РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ)', 'CYP3A4 РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'СЃС‚РёРјСѓР»СЏС†РёСЏ СЂРёР±РѕСЃРѕРјР°Р»СЊРЅРѕР№ Р РќРљ-РїРѕР»РёРјРµСЂР°Р·С‹']
  },
  probiotics: {
    systems: ['hepatic', 'hematologic'],
    organs: ['gut', 'liver', 'lymphatic'],
    biomarkers: ['CRP', 'endotoxin LPS', 'SCFA', 'ALT', 'GGT'],
    mechanisms: ['РјРѕРґСѓР»СЏС†РёСЏ РјРёРєСЂРѕР±РёРѕРјР°', 'РѕСЃСЊ РєРёС€РµС‡РЅРёРє-РїРµС‡РµРЅСЊ (РїРµС‡С‘РЅРѕС‡РЅС‹Р№ РєР»РёСЂРµРЅСЃ LPS)', 'РїСЂРѕРґСѓРєС†РёСЏ Р±СѓС‚РёСЂР°С‚Р° (SCFA)', 'Р±Р°СЂСЊРµСЂРЅР°СЏ С„СѓРЅРєС†РёСЏ РєРёС€РµС‡РЅРёРєР°', 'РёРјРјСѓРЅРѕРіР»РѕР±СѓР»РёРЅ A СЃС‚РёРјСѓР»СЏС†РёСЏ']
  },
  vitamin_b12: {
    systems: ['hematologic', 'neuro'],
    organs: ['bone_marrow', 'nervous_system', 'brain'],
    biomarkers: ['B12', 'HGB', 'HCT', 'MCV', 'РіРѕРјРѕС†РёСЃС‚РµРёРЅ', 'FOL'],
    mechanisms: ['РјРµС‚РёРѕРЅРёРЅСЃРёРЅС‚Р°Р·Р° РєРѕС„Р°РєС‚РѕСЂ', 'РјРёРµР»РёРЅРёР·Р°С†РёСЏ РЅРµСЂРІРѕРІ', 'СЌСЂРёС‚СЂРѕРїРѕСЌР· (Р”РќРљ-СЃРёРЅС‚РµР·)', 'СЂРµРјРµС‚РёР»СЏС†РёСЏ РіРѕРјРѕС†РёСЃС‚РµРёРЅР°', 'С„РѕР»Р°С‚РЅС‹Р№ С†РёРєР» РєРѕС„Р°РєС‚РѕСЂ']
  },
  vitamin_b6: {
    systems: ['neuro', 'hematologic', 'hepatic'],
    organs: ['brain', 'nervous_system', 'bone_marrow', 'liver'],
    biomarkers: ['PLP', 'РіРѕРјРѕС†РёСЃС‚РµРёРЅ', 'ALT', 'AST', 'HGB'],
    mechanisms: ['PLP-Р·Р°РІРёСЃРёРјС‹Р№ СЃРёРЅС‚РµР· РЅРµР№СЂРѕРјРµРґРёР°С‚РѕСЂРѕРІ', 'С‚СЂР°РЅСЃР°РјРёРЅР°Р·Р° РєРѕС„Р°РєС‚РѕСЂ', 'РјРµС‚Р°Р±РѕР»РёР·Рј РіРѕРјРѕС†РёСЃС‚РµРёРЅР°', 'РіРµРј-СЃРёРЅС‚РµР·', 'РіР»СЋРєРѕРЅРµРѕРіРµРЅРµР·']
  },
  folate: {
    systems: ['hematologic', 'cardio', 'neuro'],
    organs: ['bone_marrow', 'vascular', 'nervous_system'],
    biomarkers: ['FOL', 'РіРѕРјРѕС†РёСЃС‚РµРёРЅ', 'HGB', 'MCV', 'B12'],
    mechanisms: ['5-РјРµС‚РёР»THF вЂ” РґРѕРЅРѕСЂ РјРµС‚РёР»СЊРЅС‹С… РіСЂСѓРїРї', 'СЂРµРјРµС‚РёР»СЏС†РёСЏ РіРѕРјРѕС†РёСЃС‚РµРёРЅР°', 'РїСѓСЂРёРЅРѕ-РїРёСЂРёРјРёРґРёРЅРѕРІС‹Р№ СЃРёРЅС‚РµР·', 'Р”РќРљ-РјРµС‚РёР»СЏС†РёСЏ', 'СЌСЂРёС‚СЂРѕРїРѕСЌР· РїРѕРґРґРµСЂР¶РєР°']
  },
  iron: {
    systems: ['hematologic', 'cardio'],
    organs: ['bone_marrow', 'liver', 'heart'],
    biomarkers: ['FERRITIN', 'HGB', 'HCT', 'TIBC', 'FOL', 'TRANSFERRIN'],
    mechanisms: ['РіРµРј-СЃРёРЅС‚РµР·', 'СЌСЂРёС‚СЂРѕРїРѕСЌР·', 'РєРёСЃР»РѕСЂРѕРґРЅС‹Р№ С‚СЂР°РЅСЃРїРѕСЂС‚', 'РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕРµ Р¶РµР»РµР·Рѕ-СЃРµСЂРЅС‹Рµ РєР»Р°СЃС‚РµСЂС‹', 'РєР°С‚Р°Р»Р°Р·Р° РєРѕС„Р°РєС‚РѕСЂ']
  },
  copper: {
    systems: ['hematologic', 'neuro'],
    organs: ['bone_marrow', 'liver', 'nervous_system'],
    biomarkers: ['Р¦РµСЂСѓР»РѕРїР»Р°Р·РјРёРЅ', 'Cu/Zn-SOD', 'HGB', 'MCV'],
    mechanisms: ['С†РµСЂСѓР»РѕРїР»Р°Р·РјРёРЅ (Fe2+в†’Fe3+ РѕРєСЃРёРґР°Р·Р°)', 'Cu/Zn-SOD Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚', 'Р»РёР·РёР»РѕРєСЃРёРґР°Р·Р° (cross-link collagen)', 'С†РёС‚РѕС…СЂРѕРј c РѕРєСЃРёРґР°Р·Р°', 'РјРёРµР»РёРЅРёР·Р°С†РёСЏ Р¦РќРЎ']
  },
  astragalus: {
    systems: ['renal', 'hematologic', 'cardio'],
    organs: ['kidneys', 'bone_marrow', 'vascular'],
    biomarkers: ['CREATININE', 'РїСЂРѕС‚РµРёРЅСѓСЂРёСЏ', 'UREA', 'CRP', 'WBC'],
    mechanisms: ['Р°СЃС‚СЂР°РіР°Р»РѕР·РёРґ IV вЂ” РЅРµС„СЂРѕРїСЂРѕС‚РµРєС†РёСЏ', 'T-РєР»РµС‚РѕС‡РЅР°СЏ РјРѕРґСѓР»СЏС†РёСЏ', 'Р°РЅС‚Рё-С„РёР±СЂРѕС‚РёС‡РµСЃРєРёР№ TGF-ОІ1', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (Nrf2 РїСѓС‚СЊ)', 'NO-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ РІР°Р·РѕРґРёР»Р°С‚Р°С†РёСЏ']
  },
  taurine: {
    systems: ['cardio', 'neuro', 'hepatic', 'renal'],
    organs: ['heart', 'brain', 'liver', 'retina'],
    biomarkers: ['РђР”', 'Р§РЎРЎ', 'ALT', 'AST', 'CREATININE'],
    mechanisms: ['РѕСЃРјРѕР»РёС‚ РєР°СЂРґРёРѕРјРёРѕС†РёС‚РѕРІ', 'Р°РЅС‚РёР°СЂРёС‚РјРёС‡РµСЃРєРёР№ (Ca2+ РјРѕРґСѓР»СЏС†РёСЏ)', 'РєРѕРЅСЉСЋРіР°С†РёСЏ bile acids', 'GABA-A РјРѕРґСѓР»СЏС†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (С‚Р°СѓСЂРёРЅ-С…Р»РѕСЂР°РјРёРЅ)']
  },
  melatonin: {
    systems: ['neuro', 'endocrine', 'cardio'],
    organs: ['brain', 'pineal', 'heart', 'gut'],
    biomarkers: ['РјРµР»Р°С‚РѕРЅРёРЅ СЃР»СЋРЅС‹', 'РєРѕСЂС‚РёР·РѕР»', 'CRP', 'IL-6', 'TNF-О±'],
    mechanisms: ['MT1/MT2 СЂРµС†РµРїС‚РѕСЂ Р°РіРѕРЅРёР·Рј', 'С†РёСЂРєР°РґРЅР°СЏ СЂРµРіСѓР»СЏС†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (РїСЂСЏРјРѕРµ РЅРµР№С‚СЂР°Р»СЊРЅРѕРµ ROS)', 'Nrf2 Р°РєС‚РёРІР°С†РёСЏ', 'РјРѕРґСѓР»СЏС†РёСЏ РёРјРјСѓРЅРёС‚РµС‚Р° (Th1/Th2)']
  },
  ginseng: {
    systems: ['endocrine', 'neuro', 'cardio', 'hematologic'],
    organs: ['adrenals', 'brain', 'heart', 'gonads'],
    biomarkers: ['NO', 'IGF-1', 'РєРѕСЂС‚РёР·РѕР»', 'РђР”', 'WBC'],
    mechanisms: ['РіРёРЅР·РµРЅРѕР·РёРґС‹ вЂ” Р°РґР°РїС‚РѕРіРµРЅРЅС‹Р№ СЌС„С„РµРєС‚', 'NO-СЃРёРЅС‚Р°Р·Р° Р°РєС‚РёРІР°С†РёСЏ', 'HPA-РѕСЃСЊ РјРѕРґСѓР»СЏС†РёСЏ', 'IGF-1 РїРѕРІС‹С€РµРЅРёРµ', 'РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЏ РјР°РєСЂРѕС„Р°РіРѕРІ']
  },
  egcg: {
    systems: ['cardio', 'hepatic', 'neuro', 'hematologic'],
    organs: ['liver', 'vascular', 'brain'],
    biomarkers: ['ALT', 'TG', 'CRP', 'LDL', 'COMT Р°РєС‚РёРІРЅРѕСЃС‚СЊ'],
    mechanisms: ['COMT РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'Nrf2 Р°РєС‚РёРІР°С†РёСЏ', 'Р°РЅС‚РёР°РЅРіРёРѕРіРµРЅРµР· (VEGF РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ)', 'AMPK Р°РєС‚РёРІР°С†РёСЏ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (Fe-С…РµР»Р°С‚РёСЂРѕРІР°РЅРёРµ)']
  },
  curcumin: {
    systems: ['hepatic', 'cardio', 'neuro', 'hematologic'],
    organs: ['liver', 'brain', 'vascular', 'gut'],
    biomarkers: ['ALT', 'CRP', 'IL-6', 'TNF-О±', 'NF-ОєB'],
    mechanisms: ['NF-ОєB РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'COX-2/LOX РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'Nrf2 Р°РєС‚РёРІР°С†РёСЏ', 'Р°РЅС‚РёС„РёР±СЂРѕС‚РёС‡РµСЃРєРёР№', 'Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ Г—10 СЃ РїРёРїРµСЂРёРЅРѕРј']
  },
  phosphatidylcholine: {
    systems: ['hepatic', 'neuro', 'cardio'],
    organs: ['liver', 'brain', 'vascular'],
    biomarkers: ['ALT', 'AST', 'GGT', 'ALP', 'HDL', 'ApoA1'],
    mechanisms: ['РјРµРјР±СЂР°РЅРЅР°СЏ СЂРµСЃС‚Р°РІСЂР°С†РёСЏ РіРµРїР°С‚РѕС†РёС‚РѕРІ', 'СЃРёРЅС‚РµР· VLDL (Р»РёРїРёРґРЅС‹Р№ С‚СЂР°РЅСЃРїРѕСЂС‚)', 'Р°С†РµС‚РёР»С…РѕР»РёРЅ РїСЂРµРєСѓСЂСЃРѕСЂ', 'Р°РЅС‚Рё-С„РёР±СЂРѕР·РЅС‹Р№', 'С…РѕР»РµСЂРµР·РЅС‹Р№ СЌС„С„РµРєС‚']
  },
  l_carnitine: {
    systems: ['cardio', 'neuro', 'hepatic'],
    organs: ['heart', 'brain', 'liver', 'muscles'],
    biomarkers: ['TG', 'LDL', 'HDL', 'AST', 'CK', 'РђР”'],
    mechanisms: ['С‚СЂР°РЅСЃРїРѕСЂС‚ LCFA РІ РјРёС‚РѕС…РѕРЅРґСЂРёРё (CPT I/II)', 'Р°С†РёР»-РљРѕA/РљРѕA Р±Р°Р»Р°РЅСЃ', 'Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (ROS РІ РјРёС‚РѕС…РѕРЅРґСЂРёСЏС…)', 'NO-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ', 'СѓРґР°Р»РµРЅРёРµ Р°С†РёР»СЊРЅС‹С… РіСЂСѓРїРї']
  },
  glucosamine: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'cartilage'],
    biomarkers: ['РєР»РёРЅРёС‡РµСЃРєР°СЏ Р±РѕР»СЊ РІ СЃСѓСЃС‚Р°РІР°С…', 'WOMAC', 'СЂРµРЅС‚РіРµРЅ-РїСЂРѕРіСЂРµСЃСЃРёСЏ'],
    mechanisms: ['СЃСѓР±СЃС‚СЂР°С‚ РіР»РёРєРѕР·Р°РјРёРЅРѕРіР»РёРєР°РЅРѕРІ', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РїСЂРѕС‚РµРѕРіР»РёРєР°РЅРѕРІ', 'РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ MMP', 'СЃРЅРёР¶РµРЅРёРµ IL-1ОІ РІ С…СЂСЏС‰Рµ', 'stimСѓР»СЏС†РёСЏ С…РѕРЅРґСЂРѕС†РёС‚РѕРІ']
  },
  chondroitin: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'cartilage'],
    biomarkers: ['WOMAC', 'СЃРёРЅРѕРІРёР°Р»СЊРЅР°СЏ Р¶РёРґРєРѕСЃС‚СЊ РіРёР°Р»СѓСЂРѕРЅР°РЅ', 'CTX-II'],
    mechanisms: ['СѓРґРµСЂР¶Р°РЅРёРµ РІРѕРґС‹ РІ С…СЂСЏС‰Рµ', 'РїРѕРґР°РІР»РµРЅРёРµ MMP-3/MMP-9', 'РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ СЌР»Р°СЃС‚Р°Р·С‹ Р»РµР№РєРѕС†РёС‚РѕРІ', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РїСЂРѕС‚РµРѕРіР»РёРєР°РЅРѕРІ', 'РєРѕРЅРєСѓСЂРµРЅС†РёСЏ СЃ РєР°С‚РµРїСЃРёРЅР°РјРё']
  },
  msm: {
    systems: ['musculoskeletal', 'hematologic'],
    organs: ['joints', 'cartilage', 'skin'],
    biomarkers: ['CRP', 'IL-6', 'WOMAC', 'СЃСѓСЃС‚Р°РІРЅР°СЏ РїРѕРґРІРёР¶РЅРѕСЃС‚СЊ'],
    mechanisms: ['РґРѕРЅРѕСЂ СЃРµСЂС‹ РґР»СЏ С…РѕРЅРґСЂРѕРёС‚РёРЅР°/РєРµСЂР°С‚РёРЅР°', 'NF-ОєB РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'Р°РЅС‚Рё-РІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№', 'РєРѕР»Р»Р°РіРµРЅ-СЃРёРЅС‚РµР· РїРѕРґРґРµСЂР¶РєР°', 'GLUTATHIONE РїРѕРІС‹С€РµРЅРёРµ']
  },
  collagen: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'tendons', 'ligaments', 'skin', 'bone'],
    biomarkers: ['PRO-COLLAGEN II', 'CTx-II', 'PIIINP', 'РєР»РёРЅРёС‡РµСЃРєР°СЏ Р±РѕР»СЊ'],
    mechanisms: ['СЃСѓР±СЃС‚СЂР°С‚ РґР»СЏ С„РёР±СЂРѕР±Р»Р°СЃС‚РѕРІ', 'РіР»РёС†РёРЅ/РїСЂРѕР»РёРЅ/РіРёРґСЂРѕРєСЃРёРїСЂРѕР»РёРЅ РїРѕСЃС‚Р°РІРєР°', 'СЃС‚РёРјСѓР»СЏС†РёСЏ С…РѕРЅРґСЂРѕС†РёС‚РѕРІ', 'СЃС‚РёРјСѓР»СЏС†РёСЏ СЃРёРЅС‚РµР·Р° РєРѕР»Р»Р°РіРµРЅР° I Рё III', 'Р±РёРѕРјРµС…Р°РЅРёРєР° СЃСѓС…РѕР¶РёР»РёР№']
  },
  hyaluronic: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'skin'],
    biomarkers: ['СЃРёРЅРѕРІРёР°Р»СЊРЅР°СЏ РІСЏР·РєРѕСЃС‚СЊ', 'WOMAC', 'РєРѕР¶РЅР°СЏ РіРёРґСЂР°С‚Р°С†РёСЏ'],
    mechanisms: ['РѕСЃРјРѕС‚РёС‡РµСЃРєРёР№ Р±СѓС„РµСЂ СЃСѓСЃС‚Р°РІР°', 'СЃРјР°Р·РєР° СЃСѓСЃС‚Р°РІРЅС‹С… РїРѕРІРµСЂС…РЅРѕСЃС‚РµР№', 'СЃС‚РёРјСѓР»СЏС†РёСЏ СЃРёРЅРѕРІРёРѕС†РёС‚РѕРІ', 'CD44-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ СЃРёРіРЅР°Р»РёР·Р°С†РёСЏ', 'Р°РЅС‚Рё-РІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ (TLR4 РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ)']
  },
  boswellia: {
    systems: ['musculoskeletal', 'neuro', 'hematologic'],
    organs: ['joints', 'gut', 'brain'],
    biomarkers: ['CRP', 'IL-6', 'LTB4', 'WOMAC'],
    mechanisms: ['5-LOX РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ (Р±РѕСЃРІРµР»Р»РёРµРІС‹Рµ РєРёСЃР»РѕС‚С‹)', 'Р°РЅС‚Р°РіРѕРЅРёР·Рј LTB4', 'C4S РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ (С†РёС‚РѕРєРёРЅ-СЃСѓРїСЂРµСЃСЃРѕСЂ)', 'РјРёРєСЂРѕС†РёСЂРєСѓР»СЏС†РёСЏ', 'РјСЏРіРєР°СЏ РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ']
  },
  vitamin_c: {
    systems: ['hematologic', 'musculoskeletal', 'cardio', 'neuro'],
    organs: ['bone_marrow', 'skin', 'joints', 'vascular', 'brain'],
    biomarkers: ['РІРёС‚Р°РјРёРЅ C РїР»Р°Р·РјС‹', 'CRP', 'HGB', 'Р»РµР№РєРѕС†РёС‚С‹', 'РєРѕР»Р»Р°РіРµРЅ-РјР°СЂРєРµСЂС‹'],
    mechanisms: ['Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ РІРѕРґРЅРѕР№ С„Р°Р·С‹', 'РєРѕС„Р°РєС‚РѕСЂ РїСЂРѕР»РёР»-/Р»РёР·РёР»РіРёРґСЂРѕРєСЃРёР»Р°Р·С‹ (РєРѕР»Р»Р°РіРµРЅ)', 'РєРѕС„Р°РєС‚РѕСЂ РєР°СЂРЅРёС‚РёРЅ-СЃРёРЅС‚РµР·Р°', 'СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅР° E', 'РёРјРјСѓРЅРѕСЃС‚РёРјСѓР»СЏС†РёСЏ (NK-РєР»РµС‚РєРё, С„Р°РіРѕС†РёС‚РѕР·)']
  },
  bromelain: {
    systems: ['musculoskeletal', 'hematologic'],
    organs: ['joints', 'gut', 'skin'],
    biomarkers: ['CRP', 'РѕС‚С‘Рє', 'С„РёР±СЂРёРЅРѕРіРµРЅ', 'WOMAC'],
    mechanisms: ['РїСЂРѕС‚РµРѕР»РёР· С„РёР±СЂРёРЅР° (С„РёР±СЂРёРЅРѕР»РёС‚РёРє)', 'Р±СЂР°РґРёРєРёРЅРёРЅ-СЂР°Р·СЂСѓС€РµРЅРёРµ (РїСЂРѕС‚РёРІРѕРѕС‚С‘С‡РЅС‹Р№)', 'COX-2 РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'TGF-ОІ РјРѕРґСѓР»СЏС†РёСЏ', 'РјРѕРґСѓР»СЏС†РёСЏ С†РёС‚РѕРєРёРЅРѕРІ']
  },
  bpc157: {
    systems: ['musculoskeletal', 'neuro', 'hepatic'],
    organs: ['tendons', 'ligaments', 'gut', 'brain', 'liver'],
    biomarkers: ['VEGF', 'FGF', 'NO', 'Р·Р°Р¶РёРІР»РµРЅРёРµ СЂР°РЅ', 'ANG-1/2'],
    mechanisms: ['Р°РЅРіРёРѕРіРµРЅРµР· (VEGF/FGF)', 'NO-РїСѓС‚СЊ С†РёС‚РѕРїСЂРѕС‚РµРєС†РёРё', 'СЃС‚РёРјСѓР»СЏС†РёСЏ С„РёР±СЂРѕР±Р»Р°СЃС‚РѕРІ', 'СЃС‚РёРјСѓР»СЏС†РёСЏ РјРёРѕС„РёР±СЂРѕР±Р»Р°СЃС‚РѕРІ', 'РјРѕРґСѓР»СЏС†РёСЏ РґРѕРїР°РјРёРЅРµСЂРіРёС‡РµСЃРєРѕР№ СЃРёСЃС‚РµРјС‹']
  },
  tb500: {
    systems: ['musculoskeletal', 'cardio', 'neuro'],
    organs: ['heart', 'tendons', 'ligaments', 'skin', 'brain'],
    biomarkers: ['С‚РёРјРѕР·РёРЅ ОІ4', 'VEGF', 'Р°РєС‚РёРЅ', 'РјРёРѕРєР°СЂРґРёР°Р»СЊРЅС‹Р№Repair'],
    mechanisms: ['РјРёРіСЂР°С†РёСЏ СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅС‹С… РєР»РµС‚РѕРє', 'Р°РєС‚РёРЅ-РїРѕР»РёРјРµСЂРёР·Р°С†РёСЏ', 'Р°РЅРіРёРѕРіРµРЅРµР·', 'РїСЂРѕС‚РёРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ (NF-ОєB)', 'РєР°СЂРґРёСЏРєРѕРїСЂРѕС‚РµРєС†РёСЏ РїСЂРё РёС€РµРјРёРё']
  },
  meloxicam: {
    systems: ['musculoskeletal'],
    organs: ['joints'],
    biomarkers: ['CRP', 'IL-6', 'PGE2', 'CREATININE', 'ALT'],
    mechanisms: ['COX-2 СЃРµР»РµРєС‚РёРІРЅРѕРµ РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'PGE2 СЃРЅРёР¶РµРЅРёРµ', 'Р°РЅР°Р»СЊРіРµР·РёСЏ', 'РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№']
  },
  diclofenac: {
    systems: ['musculoskeletal'],
    organs: ['joints', 'liver', 'kidneys'],
    biomarkers: ['CRP', 'IL-6', 'PGE2', 'ALT', 'CREATININE', 'TG'],
    mechanisms: ['COX-1/COX-2 РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ', 'PGE2/PGI2 СЃРЅРёР¶РµРЅРёРµ', 'Р°РЅР°Р»СЊРіРµР·РёСЏ', 'РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№', 'Р»РёРїРѕРєСЃРёРЅ РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ']
  },
  tongkat_ali: {
    systems: ['endocrine', 'reproductive', 'neuro'],
    organs: ['testes', 'hypothalamus', 'pituitary', 'adrenals'],
    biomarkers: ['TT', 'FT', 'LH', 'SHBG', 'РєРѕСЂС‚РёР·РѕР»', 'DHEA-S'],
    mechanisms: ['LH РІС‹СЃРІРѕР±РѕР¶РґРµРЅРёРµ СЃС‚РёРјСѓР»СЏС†РёСЏ', '17-РєРµС‚РѕСЃС‚РµСЂРѕРёРґС‹ РїРѕРІС‹С€РµРЅРёРµ', 'SHBG СЃРЅРёР¶РµРЅРёРµ', 'Р°РЅС‚РёРєРѕСЂС‚РёР·РѕР»СЊРЅС‹Р№ СЌС„С„РµРєС‚', 'РєРІРµСЂС†РёРЅ/A-Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚']
  },
  fadogia: {
    systems: ['endocrine', 'reproductive'],
    organs: ['testes', 'hypothalamus', 'pituitary'],
    biomarkers: ['LH', 'TT', 'FT', 'РёРЅС‚СЂР°-С‚РµСЃС‚РёРєСѓР»СЏСЂРЅС‹Р№ T'],
    mechanisms: ['РіРёРїРѕС‚Р°Р»Р°РјРѕ-РіРёРїРѕС„РёР·Р°СЂРЅР°СЏ LH-СЃС‚РёРјСѓР»СЏС†РёСЏ', 'РїСЂСЏРјР°СЏ Р›РµР№РґРёРі-СЃС‚РёРјСѓР»СЏС†РёСЏ', 'РѕС‚Р»РёС‡РЅС‹Р№ РѕС‚ С‚РѕРЅРіРєР°С‚ Р°Р»Рё РјРµС…Р°РЅРёР·Рј', 'СЃР°РїРѕРЅРёРЅ-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅР°СЏ Р°РєС‚РёРІР°С†РёСЏ']
  },
  shilajit: {
    systems: ['hematologic', 'hepatic', 'endocrine'],
    organs: ['bone_marrow', 'liver', 'testes', 'mitochondria'],
    biomarkers: ['FERRITIN', 'HGB', 'ATP', 'РєРѕСЌРЅР·РёРј Q10', 'TSH'],
    mechanisms: ['С„СѓР»СЊРІРѕРєРёСЃР»РѕС‚С‹ вЂ” РјРёРЅРµСЂР°Р»СЊРЅС‹Р№ С‚СЂР°РЅСЃРїРѕСЂС‚', 'Fe-С…РµР»Р°С‚РёСЂРѕРІР°РЅРёРµ Рё РіРµРјР°С‚РѕРїРѕСЌР·', 'РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅР°СЏ ATP-РѕРїС‚РёРјРёР·Р°С†РёСЏ', 'Dibenzo-О±-РїРёСЂРѕРЅС‹ вЂ” Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚', 'С‚РёСЂРµРѕРёРґРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°']
  },
  boron: {
    systems: ['endocrine', 'musculoskeletal'],
    organs: ['bones', 'testes', 'thyroid'],
    biomarkers: ['VITD', 'SHBG', 'TT', 'CA', 'РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅ'],
    mechanisms: ['РІРёС‚Р°РјРёРЅ D РїРѕР»СѓСЂР°СЃРїР°Рґ СѓРІРµР»РёС‡РµРЅРёРµ', '1О±-РіРёРґСЂРѕРєСЃРёР»Р°Р·Р° РїРѕС‚РµРЅС†РёР°С†РёСЏ', 'SHBG СЃРЅРёР¶РµРЅРёРµ', 'РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅ РјРѕРґСѓР»СЏС†РёСЏ', 'РјР°РіРЅРёР№/РєР°Р»СЊС†РёР№ СЂРµР°Р±СЃРѕСЂР±С†РёСЏ']
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

export function getSubstanceInfo(id: string): SupportSubstance | undefined {
  return getSubstance(id);
}

export function searchSupport(query: string): SupportSubstance[] {
  return searchSubstances(query);
}

export function getSupportSubstancesByCategory(category: string): SupportSubstance[] {
  return findSubstancesByCategory(category);
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
