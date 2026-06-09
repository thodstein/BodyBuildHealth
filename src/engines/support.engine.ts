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
  SUPPORT_BASE_COVERAGE
} from '../core/constants';
import { MASTER_DB } from '../core/master-db';

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
  selenium:         [{ study: 'Rayman MP., Lancet 2012', conclusion: 'РЎРµР»РµРЅ вЂ” РєР»СЋС‡РµРІРѕР№ СЌР»РµРјРµРЅС‚ РіР»СѓС‚Р°С‚РёРѕРЅРїРµСЂРѕРєСЃРёРґР°Р·С‹. Р©РёС‚РѕРІРёРґРЅР°СЏ Р·Р°С‰РёС‚Р°. РР·Р±С‹С‚РѕРє в†’ С‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ (С…СЂСѓРїРєРѕСЃС‚СЊ РЅРѕРіС‚РµР№, Р°Р»РѕРїРµС†РёСЏ).', year: 2012 }],
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
  copper:           [{ study: 'Uriu-Adams JY. et al., J Nutr 2005', conclusion: 'РњРµРґСЊ вЂ” РєРѕС„Р°РєС‚РѕСЂ С†РµСЂСѓР»РѕРїР»Р°Р·РјРёРЅР° Рё SOD. РљСЂРёС‚РёС‡РЅР° РґР»СЏ РЅРµР№СЂРѕРјРёРµР»РёРЅРёР·Р°С†РёРё Рё СЌСЂРёС‚СЂРѕРїРѕСЌР·Р°. РР·Р±С‹С‚РѕРє в†’ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ.', year: 2005 }],
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
        } else {
          for (const system of ALL_RISK_SYSTEMS) {
            systemRisks[system] *= multiplier;
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

function calculateSupportCoverage(
  substances: SubstanceEntry[],
  substanceIds: string[],
  supportDoses?: Record<string, number>
): { totalSupport: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  const systemSupport: Record<string, number> = {};
  const organSupport: Record<string, number> = {};
  let totalSupport = 0;

  for (const system of ALL_RISK_SYSTEMS) {
    systemSupport[system] = 0;
  }

  for (const [supKey, coverage] of Object.entries(SUPPORT_BASE_COVERAGE)) {
    const isInStack = substanceIds.some(sid =>
      sid === supKey || sid.toLowerCase().includes(supKey) || supKey.includes(sid.toLowerCase())
    );
    if (!isInStack) continue;

    const dose = supportDoses?.[supKey] ?? supportDoses?.[substanceIds.find(sid => sid === supKey || sid.toLowerCase().includes(supKey)) ?? ''] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
    const ec50 = SUPPORT_EC50[supKey] ?? 100;

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
    }
  }

  if (substances.length > 0) {
    for (const substance of substances) {
      const supKey = Object.keys(SUPPORT_BASE_COVERAGE).find(k =>
        substance.id === k || substance.id.toLowerCase().includes(k) || k.includes(substance.id.toLowerCase())
      );
      if (!supKey) continue;
      const coverage = SUPPORT_BASE_COVERAGE[supKey];
      const dose = supportDoses?.[supKey] ?? supportDoses?.[substance.id] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
      const ec50 = SUPPORT_EC50[supKey] ?? 100;
      let substanceTotal = 0;

      for (const [coverageKey, emax] of Object.entries(coverage)) {
        substanceTotal += sigmoidEmax(emax, dose, ec50);
      }
      totalSupport += substanceTotal;
    }
  }

  totalSupport += (substanceIds.filter(sid =>
    Object.keys(SUPPORT_BASE_COVERAGE).some(k => sid === k || sid.toLowerCase().includes(k) || k.includes(sid.toLowerCase()))
  ).length) * 5;

  for (const system of ALL_RISK_SYSTEMS) {
    systemSupport[system] = Math.min(100, systemSupport[system]);
  }
  for (const organ of Object.keys(organSupport)) {
    organSupport[organ] = Math.min(100, organSupport[organ]);
  }

  return { totalSupport: Math.min(35, totalSupport), systemSupport, organSupport };
}

function calculateSupportScore(
  input: SupportInput,
  substances: SubstanceEntry[],
  substanceIds: string[]
): { score: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  const coverage = calculateSupportCoverage(substances, substanceIds, input.supportDoses);
  // Lifestyle factors (nutrition, training) are already priced into base risk.
  // Only actual supplement coverage reduces risk — lifestyleSupport removed to avoid
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

  const riskBeforeSupport = Math.min(100, totalRaw / ALL_RISK_SYSTEMS.length);

  const { score: supportScore, systemSupport, organSupport } = calculateSupportScore(input, substances, input.substances);

  for (const system of ALL_RISK_SYSTEMS) {
    const raw = systemBreakdownRaw[system];
    const protectionFraction = Math.min(1, (systemSupport[system] ?? 0) / 100);
    const lifestyleReduction = ((input.nutritionFactor ?? 0) * (NUTRITION_SYSTEM_REDUCTION[system] ?? 0.3) + (input.trainingFactor ?? 0) * (TRAINING_SYSTEM_REDUCTION[system] ?? 0.2));
    const netRisk = raw * (1 - protectionFraction) * (1 - Math.min(0.5, lifestyleReduction));
    systemBreakdownNet[system] = Math.min(100, Math.max(0, netRisk));
  }

  let totalNet = 0;
  for (const system of ALL_RISK_SYSTEMS) {
    totalNet += systemBreakdownNet[system];
  }
  const riskAfterSupport = Math.min(100, totalNet / ALL_RISK_SYSTEMS.length);

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
  telmisartan: 'РўРµР»РјРёСЃР°СЂС‚Р°РЅ вЂ” СЃР°СЂС‚Р°РЅ (ARB) СЃ СѓРЅРёРєР°Р»СЊРЅРѕР№ С‡Р°СЃС‚РёС‡РЅРѕР№ Р°РіРѕРЅРёСЃС‚РёС‡РµСЃРєРѕР№ Р°РєС‚РёРІРЅРѕСЃС‚СЊСЋ Рє PPAR-Оі, РѕР±РµСЃРїРµС‡РёРІР°СЋС‰РµР№ РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєСѓСЋ Р·Р°С‰РёС‚Сѓ РїРѕРјРёРјРѕ Р°РЅС‚РёРіРёРїРµСЂС‚РµРЅР·РёРІРЅРѕРіРѕ СЌС„С„РµРєС‚Р°. РЎРЅРёР¶Р°РµС‚ СЂРёСЃРє РґРёР°Р±РµС‚РёС‡РµСЃРєРѕР№ РЅРµС„СЂРѕРїР°С‚РёРё, СѓР»СѓС‡С€Р°РµС‚ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ Рє РёРЅСЃСѓР»РёРЅСѓ Рё СЃРЅРёР¶Р°РµС‚ С‚СЂРёРіР»РёС†РµСЂРёРґС‹, С‡С‚Рѕ РґРµР»Р°РµС‚ РµРіРѕ РїСЂРµРїР°СЂР°С‚РѕРј РІС‹Р±РѕСЂР° РґР»СЏ РєР°СЂРґРёРѕ-РЅРµС„СЂРѕРїСЂРѕС‚РµРєС†РёРё РЅР° РєСѓСЂСЃР°С… РђРђРЎ.',
  nebivolol: 'РќРµР±РёРІРѕР»РѕР» вЂ” РІС‹СЃРѕРєРѕСЃРµР»РµРєС‚РёРІРЅС‹Р№ ОІ1-Р±Р»РѕРєР°С‚РѕСЂ С‚СЂРµС‚СЊРµРіРѕ РїРѕРєРѕР»РµРЅРёСЏ СЃ NO-РѕРїРѕСЃСЂРµРґРѕРІР°РЅРЅРѕР№ РІР°Р·РѕРґРёР»Р°С‚Р°С†РёРµР№, РјРёРЅРёРјРёР·РёСЂСѓСЋС‰РёР№ РІР»РёСЏРЅРёРµ РЅР° РјРµС‚Р°Р±РѕР»РёР·Рј РіР»СЋРєРѕР·С‹ Рё СЌСЂРµРєС‚РёР»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ. РџСЂРµРїР°СЂР°С‚ РІС‹Р±РѕСЂР° РґР»СЏ РєРѕРЅС‚СЂРѕР»СЏ РђР” Рё Р·Р°С‰РёС‚С‹ СЃРµСЂРґРµС‡РЅРѕ-СЃРѕСЃСѓРґРёСЃС‚РѕР№ СЃРёСЃС‚РµРјС‹ Р±РµР· С‚РёРїРёС‡РЅС‹С… РїРѕР±РѕС‡РЅС‹С… СЌС„С„РµРєС‚РѕРІ ОІ-Р±Р»РѕРєР°С‚РѕСЂРѕРІ.',
  nac: 'N-Р°С†РµС‚РёР»С†РёСЃС‚РµРёРЅ вЂ” РїСЂРµРґС€РµСЃС‚РІРµРЅРЅРёРє РіР»СѓС‚Р°С‚РёРѕРЅР°, РіР»Р°РІРЅРѕРіРѕ РІРЅСѓС‚СЂРёРєР»РµС‚РѕС‡РЅРѕРіРѕ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚Р° РїРµС‡РµРЅРё. РћР±РµСЃРїРµС‡РёРІР°РµС‚ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЋ РїСЂРё С‚РѕРєСЃРёС‡РµСЃРєРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё, РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЋ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ РѕРєРёСЃР»РёС‚РµР»СЊРЅРѕРіРѕ СЃС‚СЂРµСЃСЃР° Рё РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЋ С‡РµСЂРµР· Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ РЅР° СЌРЅРґРѕС‚РµР»РёР№.',
  tudca: 'РўР°СѓСЂРѕСѓСЂСЃРѕРґРµР·РѕРєСЃРёС…РѕР»РµРІР°СЏ РєРёСЃР»РѕС‚Р° вЂ” СѓСЂСЃРѕРґРµР·РѕРєСЃРёС…РѕР»РµРІР°СЏ РєРёСЃР»РѕС‚Р°, РєРѕРЅСЉСЋРіРёСЂРѕРІР°РЅРЅР°СЏ СЃ С‚Р°СѓСЂРёРЅРѕРј, РґРѕРєР°Р·Р°РЅРЅРѕ СЃС‚РёРјСѓР»РёСЂСѓСЋС‰Р°СЏ bile flow Рё Р·Р°С‰РёС‰Р°СЋС‰Р°СЏ РіРµРїР°С‚РѕС†РёС‚С‹ РѕС‚ С…РѕР»РµСЃС‚Р°С‚РёС‡РµСЃРєРѕРіРѕ РїРѕРІСЂРµР¶РґРµРЅРёСЏ. РЇРІР»СЏРµС‚СЃСЏ РїСЂРµРїР°СЂР°С‚РѕРј РїРµСЂРІРѕРіРѕ РІС‹Р±РѕСЂР° РїСЂРё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРј С…РѕР»РµСЃС‚Р°Р·Рµ Рё РѕСЂР°Р»СЊРЅРѕР№ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё.',
  omega3: 'РћРјРµРіР°-3 (EPA/DHA) вЂ” СЌСЃСЃРµРЅС†РёР°Р»СЊРЅС‹Рµ Р¶РёСЂРЅС‹Рµ РєРёСЃР»РѕС‚С‹ СЃ РґРѕРєР°Р·Р°РЅРЅРѕР№ РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёРµР№ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ С‚СЂРёРіР»РёС†РµСЂРёРґРѕРІ, РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅСѓСЋ РјРѕРґСѓР»СЏС†РёСЋ Рё СЃС‚Р°Р±РёР»РёР·Р°С†РёСЋ РјРµРјР±СЂР°РЅ. РћР±РµСЃРїРµС‡РёРІР°РµС‚ РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЋ С‡РµСЂРµР· РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ РјРµС…Р°РЅРёР·Рј Рё РїРѕРґРґРµСЂР¶РєСѓ СЃРµСЂРѕС‚РѕРЅРёРЅРµСЂРіРёС‡РµСЃРєРѕР№ РїРµСЂРµРґР°С‡Рё.',
  magnesium: 'РњР°РіРЅРёР№ Р±РёСЃРіР»РёС†РёРЅР°С‚ вЂ” РєРѕС„Р°РєС‚РѕСЂ Р±РѕР»РµРµ 300 С„РµСЂРјРµРЅС‚РѕРІ, РєСЂРёС‚РёС‡РЅС‹Р№ РґР»СЏ РЅРµСЂРІРЅРѕ-РјС‹С€РµС‡РЅРѕР№ РїРµСЂРµРґР°С‡Рё, СЌРЅРµСЂРіРµС‚РёС‡РµСЃРєРѕРіРѕ РјРµС‚Р°Р±РѕР»РёР·РјР° Рё СЂРµРіСѓР»СЏС†РёРё РђР”. Р”РµС„РёС†РёС‚ СѓСЃРёР»РёРІР°РµС‚ РЅРµР№СЂРѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ, РјС‹С€РµС‡РЅС‹Рµ СЃСѓРґРѕСЂРѕРіРё Рё Р°СЂРёС‚РјРёРё; supplementation РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ Р±Р°Р»Р°РЅСЃ GABA Рё СЃРЅРёР¶Р°РµС‚ РІРѕР·Р±СѓРґРёРјРѕСЃС‚СЊ Р¦РќРЎ.',
  berberine: 'Р‘РµСЂР±РµСЂРёРЅ вЂ” Р°Р»РєР°Р»РѕРёРґ СЃ РґРѕРєР°Р·Р°РЅРЅРѕР№ Р°РєС‚РёРІР°С†РёРµР№ AMPK, СЃРѕРїРѕСЃС‚Р°РІРёРјРѕР№ СЃ РјРµС‚С„РѕСЂРјРёРЅРѕРј РїРѕ СЃРЅРёР¶РµРЅРёСЋ HOMA-IR Рё СѓР»СѓС‡С€РµРЅРёСЋ Р»РёРїРёРґРЅРѕРіРѕ РїСЂРѕС„РёР»СЏ. РћР±РµСЃРїРµС‡РёРІР°РµС‚ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЋ РїСЂРё РќРђР–Р‘Рџ Рё РєРѕРЅС‚СЂРѕР»СЊ РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё, РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РђРђРЎ РёР»Рё GH-РїРµРїС‚РёРґР°РјРё.',
  coq10: 'РљРѕСЌРЅР·РёРј Q10 вЂ” РєР»СЋС‡РµРІРѕР№ РєРѕРјРїРѕРЅРµРЅС‚ СЌР»РµРєС‚СЂРѕРЅ-С‚СЂР°РЅСЃРїРѕСЂС‚РЅРѕР№ С†РµРїРё РјРёС‚РѕС…РѕРЅРґСЂРёР№ Рё Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ Р»РёРїРёРґРЅС‹С… РјРµРјР±СЂР°РЅ. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё СЃС‚Р°С‚РёРЅ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РјРёРѕРїР°С‚РёРё Рё РђРђРЎ-Р°СЃСЃРѕС†РёРёСЂРѕРІР°РЅРЅРѕР№ РєР°СЂРґРёРѕРјРёРѕРїР°С‚РёРё, РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕР№ РґРёСЃС„СѓРЅРєС†РёРё.',
  vitamin_d3: 'Р’РёС‚Р°РјРёРЅ D3 вЂ” РїСЂРѕРіРѕСЂРјРѕРЅ Рё РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС‚РѕСЂ, РґРµС„РёС†РёС‚ РєРѕС‚РѕСЂРѕРіРѕ Р°СЃСЃРѕС†РёРёСЂРѕРІР°РЅ СЃ Р°СѓС‚РѕРёРјРјСѓРЅРЅС‹РјРё Р·Р°Р±РѕР»РµРІР°РЅРёСЏРјРё, РґРµРїСЂРµСЃСЃРёРµР№ Рё РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅС‹Рј СЂРёСЃРєРѕРј. Р РµРіСѓР»РёСЂСѓРµС‚ СЌРєСЃРїСЂРµСЃСЃРёСЋ Р±РѕР»РµРµ 200 РіРµРЅРѕРІ, РєСЂРёС‚РёС‡РµРЅ РґР»СЏ РєР°Р»СЊС†РёРµРІРѕРіРѕ РіРѕРјРµРѕСЃС‚Р°Р·Р°, СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·Р° Рё РёРјРјСѓРЅРЅРѕР№ С„СѓРЅРєС†РёРё.',
  zinc: 'Р¦РёРЅРє вЂ” СЌСЃСЃРµРЅС†РёР°Р»СЊРЅС‹Р№ РјРёРєСЂРѕСЌР»РµРјРµРЅС‚, РєСЂРёС‚РёС‡РЅС‹Р№ РґР»СЏ СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·Р°, РёРјРјСѓРЅРёС‚РµС‚Р° Рё СЃРёРЅС‚РµР·Р° С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°. Р”РµС„РёС†РёС‚ РїСЂРёРІРѕРґРёС‚ Рє РіРёРїРѕРіРѕРЅР°РґРёР·РјСѓ, СЃРЅРёР¶РµРЅРёСЋ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР° Рё РёРјРјСѓРЅРѕРґРµС„РёС†РёС‚Сѓ; supplementation РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ С„СѓРЅРєС†РёСЋ РєР»РµС‚РѕРє Р›РµР№РґРёРіР° Рё Р°РєС‚РёРІРЅРѕСЃС‚СЊ С‚РёРјСѓСЃР°.',
  hcg: 'РҐРѕСЂРёРѕРЅРёС‡РµСЃРєРёР№ РіРѕРЅР°РґРѕС‚СЂРѕРїРёРЅ вЂ” Р»СЋС‚РµРёРЅРёР·РёСЂСѓСЋС‰РёР№ Р°РЅР°Р»РѕРі, РїСЂРµРґРѕС‚РІСЂР°С‰Р°СЋС‰РёР№ Р°С‚СЂРѕС„РёСЋ СЏРёС‡РµРє РЅР° РєСѓСЂСЃРµ РђРђРЎ Рё СѓСЃРєРѕСЂСЏСЋС‰РёР№ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ HPTA РІ РџРљРў. РЎС‚РёРјСѓР»РёСЂСѓРµС‚ РєР»РµС‚РєРё Р›РµР№РґРёРіР° Рє РїСЂРѕРґСѓРєС†РёРё С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°, РїРѕРґРґРµСЂР¶РёРІР°СЏ РёРЅС‚СЂР°С‚РµСЃС‚РёРєСѓР»СЏСЂРЅС‹Р№ СѓСЂРѕРІРµРЅСЊ Рё С„РµСЂС‚РёР»СЊРЅРѕСЃС‚СЊ.',
  alpha_lipoic: 'О±-Р›РёРїРѕРµРІР°СЏ РєРёСЃР»РѕС‚Р° вЂ” СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РІРѕРґРѕСЂР°СЃС‚РІРѕСЂРёРјС‹Р№ Рё Р¶РёСЂРѕСЂР°СЃС‚РІРѕСЂРёРјС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚, РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°СЋС‰РёР№ РІРёС‚Р°РјРёРЅС‹ C Рё E Рё РїРѕРІС‹С€Р°СЋС‰РёР№ РІРЅСѓС‚СЂРёРєР»РµС‚РѕС‡РЅС‹Р№ РіР»СѓС‚Р°С‚РёРѕРЅ. РќРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РґРёР°Р±РµС‚РёС‡РµСЃРєРѕР№ РЅРµР№СЂРѕРїР°С‚РёРё, РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё С‚РѕРєСЃРёС‡РµСЃРєРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё.',
  ashwagandha: 'РђС€РІР°РіР°РЅРґР° (Withania somnifera) вЂ” Р°РґР°РїС‚РѕРіРµРЅ СЃ РґРѕРєР°Р·Р°РЅРЅС‹Рј СЃРЅРёР¶РµРЅРёРµРј РєРѕСЂС‚РёР·РѕР»Р° РЅР° 30%, РїРѕРІС‹С€РµРЅРёРµРј DHEA-S Рё С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°. РђРЅРєСЃРёРѕР»РёС‚РёС‡РµСЃРєРёР№ СЌС„С„РµРєС‚ СЂРµР°Р»РёР·СѓРµС‚СЃСЏ С‡РµСЂРµР· GABA-РјРѕРґСѓР»СЏС†РёСЋ, Р° Р°РґР°РїС‚РѕРіРµРЅРЅС‹Р№ вЂ” С‡РµСЂРµР· СЂРµРіСѓР»СЏС†РёСЋ РѕСЃРё HPA Рё РїРѕРІС‹С€РµРЅРёРµ РєР»РµС‚РѕС‡РЅРѕР№ СЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё Рє СЃС‚СЂРµСЃСЃСѓ.',
  saw_palmetto: 'РЎРµСЂРµРЅРѕР° РїРѕР»Р·СѓС‡Р°СЏ вЂ” РёРЅРіРёР±РёС‚РѕСЂ 5О±-СЂРµРґСѓРєС‚Р°Р·С‹, СЃРЅРёР¶Р°СЋС‰РёР№ РєРѕРЅРІРµСЂСЃРёСЋ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР° РІ Р”Р“Рў. РЈРјРµСЂРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ РїСЂРё Р”Р“РџР– Рё Р°РЅРґСЂРѕРіРµРЅРЅРѕР№ Р°Р»РѕРїРµС†РёРё; РЅРµ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅСѓСЋ Р°С‚СЂРѕС„РёСЋ СЏРёС‡РµРє, РЅРѕ РјРѕР¶РµС‚ СѓРјРµРЅСЊС€РёС‚СЊ Р”Р“Рў-Р·Р°РІРёСЃРёРјСѓСЋ СЃРёРјРїС‚РѕРјР°С‚РёРєСѓ.',
  celery_extract: 'Р­РєСЃС‚СЂР°РєС‚ СЃРµР»СЊРґРµСЂРµСЏ вЂ” РёСЃС‚РѕС‡РЅРёРє Р°РїРёРіРµРЅРёРЅР° Рё С„С‚Р°Р»РёРґРѕРІ, РѕР±РµСЃРїРµС‡РёРІР°СЋС‰РёС… РЅРµС„СЂРѕРїСЂРѕС‚РµРєС†РёСЋ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ РјРѕС‡РµРІРѕР№ РєРёСЃР»РѕС‚С‹ Рё Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ. РЈРјРµСЂРµРЅРЅС‹Р№ РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂРЅС‹Р№ СЌС„С„РµРєС‚ С‡РµСЂРµР· РІР°Р·РѕРґРёР»Р°С‚Р°С†РёСЋ Рё СЃРЅРёР¶РµРЅРёРµ РђР”.',
  vitamin_k2: 'Р’РёС‚Р°РјРёРЅ K2 (РњРљ-7) вЂ” Р°РєС‚РёРІР°С‚РѕСЂ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР° Рё РјР°С‚СЂРёРєСЃРЅРѕРіРѕ Gla-Р±РµР»РєР°, РїСЂРµРґРѕС‚РІСЂР°С‰Р°СЋС‰РёР№ РєР°Р»СЊС†РёС„РёРєР°С†РёСЋ СЃРѕСЃСѓРґРѕРІ Рё РѕР±РµСЃРїРµС‡РёРІР°СЋС‰РёР№ РєРѕСЃС‚РЅСѓСЋ РјРёРЅРµСЂР°Р»РёР·Р°С†РёСЋ. РЎРёРЅРµСЂРіРёС‡РµРЅ СЃ РІРёС‚Р°РјРёРЅРѕРј D3: K2 РЅР°РїСЂР°РІР»СЏРµС‚ РєР°Р»СЊС†РёР№ РІ РєРѕСЃС‚Рё, Р° РЅРµ РІ СЃС‚РµРЅРєРё СЃРѕСЃСѓРґРѕРІ.',
  selenium: 'РЎРµР»РµРЅ вЂ” РєР»СЋС‡РµРІРѕР№ РєРѕРјРїРѕРЅРµРЅС‚ РіР»СѓС‚Р°С‚РёРѕРЅРїРµСЂРѕРєСЃРёРґР°Р·С‹ Рё РґРµР№РѕРґРёРЅР°Р· С‰РёС‚РѕРІРёРґРЅРѕР№ Р¶РµР»РµР·С‹. РћР±РµСЃРїРµС‡РёРІР°РµС‚ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅСѓСЋ Р·Р°С‰РёС‚Сѓ, РїРѕРґРґРµСЂР¶РєСѓ РёРјРјСѓРЅРёС‚РµС‚Р° Рё РЅРѕСЂРјР°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ С‰РёС‚РѕРІРёРґРЅРѕР№ Р¶РµР»РµР·С‹; РёР·Р±С‹С‚РѕРє С‚РѕРєСЃРёС‡РµРЅ (С…СЂСѓРїРєРѕСЃС‚СЊ РЅРѕРіС‚РµР№, Р°Р»РѕРїРµС†РёСЏ).',
  milk_thistle: 'РЎРёР»РёРјР°СЂРёРЅ (СЂР°СЃС‚РѕСЂРѕРїС€Р° РїСЏС‚РЅРёСЃС‚Р°СЏ) вЂ” РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ СЃ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅС‹Рј, Р°РЅС‚РёС„РёР±СЂРѕС‚РёС‡РµСЃРєРёРј Рё РјРµРјР±СЂР°РЅРѕСЃС‚Р°Р±РёР»РёР·РёСЂСѓСЋС‰РёРј РґРµР№СЃС‚РІРёРµРј. Р”РѕРєР°Р·Р°РЅ РїСЂРё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё РїРµС‡РµРЅРё; РёРЅРіРёР±РёСЂСѓРµС‚ CYP3A4, С‡С‚Рѕ РјРѕР¶РµС‚ РІР»РёСЏС‚СЊ РЅР° РјРµС‚Р°Р±РѕР»РёР·Рј РґСЂСѓРіРёС… РїСЂРµРїР°СЂР°С‚РѕРІ.',
  probiotics: 'РџСЂРѕР±РёРѕС‚РёРєРё вЂ” РјРѕРґСѓР»СЏС‚РѕСЂС‹ РјРёРєСЂРѕР±РёРѕРјР° РєРёС€РµС‡РЅРёРєР°, РІР»РёСЏСЋС‰РёРµ РЅР° РјРµС‚Р°Р±РѕР»РёР·Рј РїРµС‡РµРЅРё С‡РµСЂРµР· РѕСЃСЊ РєРёС€РµС‡РЅРёРє-РїРµС‡РµРЅСЊ. РЈР»СѓС‡С€Р°СЋС‚ Р±Р°СЂСЊРµСЂРЅСѓСЋ С„СѓРЅРєС†РёСЋ РєРёС€РµС‡РЅРёРєР°, СЃРЅРёР¶Р°СЋС‚ СЌРЅРґРѕС‚РѕРєСЃРµРјРёСЋ Рё РѕР±РµСЃРїРµС‡РёРІР°СЋС‚ РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС†РёСЋ С‡РµСЂРµР· РїСЂРѕРґСѓРєС†РёСЋ РєРѕСЂРѕС‚РєРѕС†РµРїРѕС‡РµС‡РЅС‹С… Р¶РёСЂРЅС‹С… РєРёСЃР»РѕС‚.',
  vitamin_b12: 'Р’РёС‚Р°РјРёРЅ B12 (С†РёР°РЅРѕРєРѕР±Р°Р»Р°РјРёРЅ/РјРµС‚РёР»РєРѕР±Р°Р»Р°РјРёРЅ) вЂ” РєСЂРёС‚РёС‡РµРЅ РґР»СЏ РјРёРµР»РёРЅРёР·Р°С†РёРё РЅРµСЂРІРѕРІ, СЌСЂРёС‚СЂРѕРїРѕСЌР·Р° Рё РјРµС‚РёР»СЏС†РёРё РіРѕРјРѕС†РёСЃС‚РµРёРЅР°. Р”РµС„РёС†РёС‚ РїСЂРёРІРѕРґРёС‚ Рє РјРµРіР°Р»РѕР±Р»Р°СЃС‚РЅРѕР№ Р°РЅРµРјРёРё, РїРµСЂРёС„РµСЂРёС‡РµСЃРєРѕР№ РЅРµР№СЂРѕРїР°С‚РёРё Рё РєРѕРіРЅРёС‚РёРІРЅС‹Рј РЅР°СЂСѓС€РµРЅРёСЏРј.',
  vitamin_b6: 'Р’РёС‚Р°РјРёРЅ B6 (РїРёСЂРёРґРѕРєСЃР°Р»СЊ-5-С„РѕСЃС„Р°С‚) вЂ” РєРѕС„Р°РєС‚РѕСЂ Р±РѕР»РµРµ 100 С„РµСЂРјРµРЅС‚РЅС‹С… СЂРµР°РєС†РёР№, РІРєР»СЋС‡Р°СЏ СЃРёРЅС‚РµР· РЅРµР№СЂРѕРјРµРґРёР°С‚РѕСЂРѕРІ (СЃРµСЂРѕС‚РѕРЅРёРЅ, GABA, РґРѕС„Р°РјРёРЅ) Рё РјРµС‚Р°Р±РѕР»РёР·Рј РіРѕРјРѕС†РёСЃС‚РµРёРЅР°. РљСЂРёС‚РёС‡РµРЅ РґР»СЏ РЅРµСЂРІРЅРѕР№ С„СѓРЅРєС†РёРё Рё РіРµРјР°С‚РѕРїРѕСЌР·Р°.',
  folate: 'Р¤РѕР»Р°С‚ (5-РјРµС‚РёР»С‚РµС‚СЂР°РіРёРґСЂРѕС„РѕР»Р°С‚) вЂ” РєР»СЋС‡РµРІРѕР№ РєРѕС„Р°РєС‚РѕСЂ РјРµС‚РёР»СЏС†РёРё Р”РќРљ Рё СЂРµРјРµС‚РёР»СЏС†РёРё РіРѕРјРѕС†РёСЃС‚РµРёРЅР° РІ РјРµС‚РёРѕРЅРёРЅ. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ РіРѕРјРѕС†РёСЃС‚РµРёРЅР°; СЃРёРЅРµСЂРіРёС‡РµРЅ СЃ РІРёС‚Р°РјРёРЅРѕРј B12 РґР»СЏ СЌСЂРёС‚СЂРѕРїРѕСЌР·Р° Рё РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёРё.',
  iron: 'Р–РµР»РµР·Рѕ вЂ” СЌСЃСЃРµРЅС†РёР°Р»СЊРЅС‹Р№ СЌР»РµРјРµРЅС‚ РґР»СЏ СЌСЂРёС‚СЂРѕРїРѕСЌР·Р° Рё РєРёСЃР»РѕСЂРѕРґС‚СЂР°РЅСЃРїРѕСЂС‚РЅРѕР№ С„СѓРЅРєС†РёРё РіРµРјРѕРіР»РѕР±РёРЅР°. РџРµСЂРµРіСЂСѓР·РєР° (РіРµРјРѕС…СЂРѕРјР°С‚РѕР·) РїСЂРёРІРѕРґРёС‚ Рє РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё Рё РєР°СЂРґРёРѕРјРёРѕРїР°С‚РёРё; supplementation С‚СЂРµР±СѓРµС‚ РјРѕРЅРёС‚РѕСЂРёРЅРіР° С„РµСЂСЂРёС‚РёРЅР° Рё РћР–РЎРЎ.',
  copper: 'РњРµРґСЊ вЂ” РєРѕС„Р°РєС‚РѕСЂ С†РµСЂСѓР»РѕРїР»Р°Р·РјРёРЅР°, СЃСѓРїРµСЂРѕРєСЃРёРґРґРёСЃРјСѓС‚Р°Р·С‹ Рё Р»РёР·РёР»РѕРєСЃРёРґР°Р·С‹. РљСЂРёС‚РёС‡РЅР° РґР»СЏ РЅРµР№СЂРѕРјРёРµР»РёРЅРёР·Р°С†РёРё, СЌСЂРёС‚СЂРѕРїРѕСЌР·Р° Рё СЃРёРЅС‚РµР·Р° РєРѕР»Р»Р°РіРµРЅР°; РёР·Р±С‹С‚РѕРє РІС‹Р·С‹РІР°РµС‚ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ, РґРµС„РёС†РёС‚ вЂ” Р°РЅРµРјРёСЋ Рё РґРµРіРµРЅРµСЂР°С†РёСЋ Р¦РќРЎ.',
  astragalus: 'РђСЃС‚СЂР°РіР°Р» вЂ” РёРјРјСѓРЅРѕРјРѕРґСѓР»СЏС‚РѕСЂ Рё РЅРµС„СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ, Р°РєС‚РёРІРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ вЂ” Р°СЃС‚СЂР°РіР°Р»РѕР·РёРґ IV. РЎРЅРёР¶Р°РµС‚ РїСЂРѕС‚РµРёРЅСѓСЂРёСЋ РїСЂРё РґРёР°Р±РµС‚РёС‡РµСЃРєРѕР№ РЅРµС„СЂРѕРїР°С‚РёРё, РјРѕРґСѓР»РёСЂСѓРµС‚ РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚ С‡РµСЂРµР· T-РєР»РµС‚РєРё Рё С†РёС‚РѕРєРёРЅС‹, РїРѕРґРґРµСЂР¶РёРІР°РµС‚ С„СѓРЅРєС†РёСЋ РїРѕС‡РµРє.',
  taurine: 'РўР°СѓСЂРёРЅ вЂ” РЅРµР№СЂРѕРјРѕРґСѓР»СЏС‚РѕСЂ, РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ (Р°РЅС‚РёР°СЂРёС‚РјРёС‡РµСЃРєРёР№, РѕСЃРјРѕР»РёС‚) Рё РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ. РљРѕРЅСЉСЋРіРёСЂСѓРµС‚ СЃ bile acids, СѓР»СѓС‡С€Р°СЏ bile flow; РјРѕРґСѓР»РёСЂСѓРµС‚ РєР°Р»СЊС†РёРµРІС‹Рµ РєР°РЅР°Р»С‹ РІ РєР°СЂРґРёРѕРјРёРѕС†РёС‚Р°С… Рё СЃРЅРёР¶Р°РµС‚ РЅРµР№СЂРѕРІРѕСЃРїР°Р»РµРЅРёРµ.',
  melatonin: 'РњРµР»Р°С‚РѕРЅРёРЅ вЂ” РЅРµР№СЂРѕРіРѕСЂРјРѕРЅ СЌРїРёС„РёР·Р°, СЂРµРіСѓР»СЏС‚РѕСЂ С†РёСЂРєР°РґРЅС‹С… СЂРёС‚РјРѕРІ Рё РјРѕС‰РЅС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚. РЈР»СѓС‡С€Р°РµС‚ РєР°С‡РµСЃС‚РІРѕ СЃРЅР°, СЃРЅРёР¶Р°РµС‚ РЅРµР№СЂРѕРІРѕСЃРїР°Р»РµРЅРёРµ, РјРѕРґСѓР»РёСЂСѓРµС‚ РёРјРјСѓРЅРёС‚РµС‚ Рё РѕРєР°Р·С‹РІР°РµС‚ РѕРЅРєРѕРїСЂРѕС‚РµРєС‚РёРІРЅС‹Р№ СЌС„С„РµРєС‚ С‡РµСЂРµР· СЂРµРіСѓР»СЏС†РёСЋ Р°РїРѕРїС‚РѕР·Р°.',
  ginseng: 'Р–РµРЅСЊС€РµРЅСЊ (Panax ginseng) вЂ” Р°РґР°РїС‚РѕРіРµРЅ, РїРѕРІС‹С€Р°СЋС‰РёР№ СЃРёРЅС‚РµР· NO Рё IGF-1, СЃ СѓРјРµСЂРµРЅРЅС‹Рј СЌСЂРіРѕРіРµРЅРЅС‹Рј Рё РЅРѕРѕС‚СЂРѕРїРЅС‹Рј СЌС„С„РµРєС‚РѕРј. РџРѕС‚РµРЅС†РёСЂСѓРµС‚ Р°РЅС‚РёРєРѕР°РіСѓР»СЏРЅС‚С‹; РіРёРЅР·РµРЅРѕР·РёРґС‹ РјРѕРґСѓР»РёСЂСѓСЋС‚ РѕСЃСЊ HPA Рё РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚.',
  egcg: 'EGCG (СЌРїРёРіР°Р»Р»РѕРєР°С‚РµС…РёРЅ РіР°Р»Р»Р°С‚) вЂ” РєР°С‚РµС…РёРЅ Р·РµР»С‘РЅРѕРіРѕ С‡Р°СЏ, РјРѕС‰РЅС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ Рё РёРЅРіРёР±РёС‚РѕСЂ COMT. Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂ РІ СѓРјРµСЂРµРЅРЅС‹С… РґРѕР·Р°С…, РѕРґРЅР°РєРѕ РїСЂРё РІС‹СЃРѕРєРёС… РґРѕР·Р°С… (>800 РјРі) РјРѕР¶РµС‚ РІС‹Р·С‹РІР°С‚СЊ РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ; РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ С‡РµСЂРµР· СЌРЅРґРѕС‚РµР»РёР°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ.',
  curcumin: 'РљСѓСЂРєСѓРјРёРЅ вЂ” РїРѕР»РёС„РµРЅРѕР» РєСѓСЂРєСѓРјС‹, РёРЅРіРёР±РёС‚РѕСЂ NF-ОєB Рё COX-2 СЃ РґРѕРєР°Р·Р°РЅРЅС‹Рј РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂРЅС‹Рј, РєР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂРЅС‹Рј Рё РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂРЅС‹Рј РґРµР№СЃС‚РІРёРµРј. РќРёР·РєР°СЏ РЅР°С‚РёРІРЅР°СЏ Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СЂРµС€Р°РµС‚СЃСЏ РєРѕРјР±РёРЅР°С†РёРµР№ СЃ РїРёРїРµСЂРёРЅРѕРј РёР»Рё Р»РёРїРѕСЃРѕРјР°Р»СЊРЅРѕР№ С„РѕСЂРјРѕР№.',
  phosphatidylcholine: 'Р¤РѕСЃС„Р°С‚РёРґРёР»С…РѕР»РёРЅ вЂ” СЌСЃСЃРµРЅС†РёР°Р»СЊРЅС‹Р№ С„РѕСЃС„РѕР»РёРїРёРґ, РєР»СЋС‡РµРІРѕР№ СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ РјРµРјР±СЂР°РЅ РіРµРїР°С‚РѕС†РёС‚РѕРІ. Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ С†РµР»РѕСЃС‚РЅРѕСЃС‚СЊ РєР»РµС‚РѕС‡РЅС‹С… РјРµРјР±СЂР°РЅ РїСЂРё С‚РѕРєСЃРёС‡РµСЃРєРѕРј РїРѕРІСЂРµР¶РґРµРЅРёРё РїРµС‡РµРЅРё Рё СѓР»СѓС‡С€Р°РµС‚ С‚СЂР°РЅСЃРїРѕСЂС‚ Р»РёРїРёРґРѕРІ.',
  l_carnitine: 'L-РєР°СЂРЅРёС‚РёРЅ вЂ” С‚СЂР°РЅСЃРїРѕСЂС‚ РґР»РёРЅРЅРѕС†РµРїРѕС‡РµС‡РЅС‹С… Р¶РёСЂРЅС‹С… РєРёСЃР»РѕС‚ РІ РјРёС‚РѕС…РѕРЅРґСЂРёРё РґР»СЏ ОІ-РѕРєРёСЃР»РµРЅРёСЏ. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РёС€РµРјРёРё РјРёРѕРєР°СЂРґР° Рё РђРђРЎ-РёРЅРґСѓС†РёСЂРѕРІР°РЅРЅРѕР№ РєР°СЂРґРёРѕРјРёРѕРїР°С‚РёРё, СѓР»СѓС‡С€Р°РµС‚ С„СѓРЅРєС†РёСЋ СЌРЅРґРѕС‚РµР»РёСЏ Рё СЃРЅРёР¶Р°РµС‚ РѕРєРёСЃР»РёС‚РµР»СЊРЅС‹Р№ СЃС‚СЂРµСЃСЃ.',
  glucosamine: 'Р“Р»СЋРєРѕР·Р°РјРёРЅ вЂ” Р°РјРёРЅРѕСЃР°С…Р°СЂ, С…РѕРЅРґСЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ Рё СЃСѓР±СЃС‚СЂР°С‚ РґР»СЏ СЃРёРЅС‚РµР·Р° РіР»РёРєРѕР·Р°РјРёРЅРѕРіР»РёРєР°РЅРѕРІ С…СЂСЏС‰Р°. Р—Р°РјРµРґР»СЏРµС‚ РґРµРіСЂР°РґР°С†РёСЋ С…СЂСЏС‰Р° РїСЂРё РѕСЃС‚РµРѕР°СЂС‚СЂРѕР·Рµ Рё РѕР±РµСЃРїРµС‡РёРІР°РµС‚ СѓРјРµСЂРµРЅРЅС‹Р№ Р±РѕР»РµСѓС‚РѕР»СЏСЋС‰РёР№ СЌС„С„РµРєС‚ С‡РµСЂРµР· СЃС‚РёРјСѓР»СЏС†РёСЋ СЃРёРЅС‚РµР·Р° РїСЂРѕС‚РµРѕРіР»РёРєР°РЅРѕРІ.',
  chondroitin: 'РҐРѕРЅРґСЂРѕРёС‚РёРЅСЃСѓР»СЊС„Р°С‚ вЂ” РіР»РёРєРѕР·Р°РјРёРЅРѕРіР»РёРєР°РЅ С…СЂСЏС‰РµРІРѕРіРѕ РјР°С‚СЂРёРєСЃР°, СѓРґРµСЂР¶РёРІР°СЋС‰РёР№ РІРѕРґСѓ Рё РѕР±РµСЃРїРµС‡РёРІР°СЋС‰РёР№ СѓРїСЂСѓРіРѕСЃС‚СЊ С…СЂСЏС‰Р°. Р—Р°РјРµРґР»СЏРµС‚ РґРµРіСЂР°РґР°С†РёСЋ РєРѕР»Р»Р°РіРµРЅР° II С‚РёРїР° Рё РїРѕРґР°РІР»СЏРµС‚ Р°РєС‚РёРІРЅРѕСЃС‚СЊ РјР°С‚СЂРёРєСЃРЅС‹С… РјРµС‚Р°Р»Р»РѕРїСЂРѕС‚РµРёРЅР°Р·.',
  msm: 'MSM (РјРµС‚РёР»СЃСѓР»СЊС„РѕРЅРёР»РјРµС‚Р°РЅ) вЂ” РѕСЂРіР°РЅРёС‡РµСЃРєРёР№ РёСЃС‚РѕС‡РЅРёРє СЃРµСЂС‹ РґР»СЏ СЃРёРЅС‚РµР·Р° С…РѕРЅРґСЂРѕРёС‚РёРЅР°, РєРѕР»Р»Р°РіРµРЅР° Рё РєРµСЂР°С‚РёРЅР°. РџСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ СЌС„С„РµРєС‚ С‡РµСЂРµР· РёРЅРіРёР±РёСЂРѕРІР°РЅРёРµ NF-ОєB; СЃРёРЅРµСЂРіРёС‡РµРЅ СЃ РіР»СЋРєРѕР·Р°РјРёРЅРѕРј РїСЂРё РѕСЃС‚РµРѕР°СЂС‚СЂРѕР·Рµ.',
  collagen: 'РљРѕР»Р»Р°РіРµРЅРѕРІС‹Рµ РїРµРїС‚РёРґС‹ вЂ” РіРёРґСЂРѕР»РёР·Р°С‚ РєРѕР»Р»Р°РіРµРЅР° I Рё III С‚РёРїРѕРІ, СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Р№ РјР°С‚РµСЂРёР°Р» РґР»СЏ СЃСѓС…РѕР¶РёР»РёР№, СЃРІСЏР·РѕРє, С…СЂСЏС‰Р° Рё РєРѕР¶Рё. РЈР»СѓС‡С€Р°СЋС‚ Р±РёРѕРјРµС…Р°РЅРёРєСѓ С…СЂСЏС‰Р°, СЃРЅРёР¶Р°СЋС‚ Р±РѕР»СЊ РІ СЃСѓСЃС‚Р°РІР°С… РїСЂРё РЅР°РіСЂСѓР·РєРµ Рё СЃС‚РёРјСѓР»РёСЂСѓСЋС‚ С„РёР±СЂРѕР±Р»Р°СЃС‚С‹ Рє СЃРёРЅС‚РµР·Сѓ СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ РєРѕР»Р»Р°РіРµРЅР°.',
  hyaluronic: 'Р“РёР°Р»СѓСЂРѕРЅРѕРІР°СЏ РєРёСЃР»РѕС‚Р° вЂ” РєРѕРјРїРѕРЅРµРЅС‚ СЃРёРЅРѕРІРёР°Р»СЊРЅРѕР№ Р¶РёРґРєРѕСЃС‚Рё Рё С…СЂСЏС‰РµРІРѕРіРѕ РјР°С‚СЂРёРєСЃР°, РѕР±РµСЃРїРµС‡РёРІР°СЋС‰РёР№ РІСЏР·РєРѕСЃС‚СЊ Рё РіРёРґСЂР°С‚Р°С†РёСЋ СЃСѓСЃС‚Р°РІРѕРІ. РџРµСЂРѕСЂР°Р»СЊРЅР°СЏ С„РѕСЂРјР° СѓР»СѓС‡С€Р°РµС‚ СѓРІР»Р°Р¶РЅРµРЅРёРµ СЃСѓСЃС‚Р°РІРѕРІ Рё РєРѕР¶Сѓ, СЃС‚РёРјСѓР»РёСЂСѓРµС‚ РїСЂРѕР»РёС„РµСЂР°С†РёСЋ СЃРёРЅРѕРІРёРѕС†РёС‚РѕРІ.',
  boswellia: 'Р‘РѕСЃРІРµР»Р»РёСЏ (Boswellia serrata) вЂ” РёРЅРіРёР±РёС‚РѕСЂ 5-Р»РёРїРѕРєСЃРёРіРµРЅР°Р·С‹ СЃ РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Рј СЌС„С„РµРєС‚РѕРј РїСЂРё Р°СЂС‚СЂРёС‚Рµ Рё РІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹С… Р·Р°Р±РѕР»РµРІР°РЅРёСЏС… РєРёС€РµС‡РЅРёРєР°. Р‘РѕСЃРІРµР»Р»РёРµРІС‹Рµ РєРёСЃР»РѕС‚С‹ РїРѕРґР°РІР»СЏСЋС‚ Р»РµР№РєРѕС‚СЂРёРµРЅС‹, РѕР±РµСЃРїРµС‡РёРІР°СЏ РјСЏРіРєСѓСЋ РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЋ.',
  vitamin_c: 'Р’РёС‚Р°РјРёРЅ C (Р°СЃРєРѕСЂР±РёРЅРѕРІР°СЏ РєРёСЃР»РѕС‚Р°) вЂ” РІРѕРґРѕСЂР°СЃС‚РІРѕСЂРёРјС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚, РєРѕС„Р°РєС‚РѕСЂ СЃРёРЅС‚РµР·Р° РєРѕР»Р»Р°РіРµРЅР° Рё РєР°СЂРЅРёС‚РёРЅР°, РјРѕРґСѓР»СЏС‚РѕСЂ РёРјРјСѓРЅРёС‚РµС‚Р°. РџРѕРґРґРµСЂР¶РёРІР°РµС‚ СЂРµРіРµРЅРµСЂР°С†РёСЋ РІРёС‚Р°РјРёРЅР° E Рё РіР»СѓС‚Р°С‚РёРѕРЅР°, РЅРµР№С‚СЂР°Р»РёР·СѓРµС‚ СЃРІРѕР±РѕРґРЅС‹Рµ СЂР°РґРёРєР°Р»С‹ РїСЂРё РІС‹СЃРѕРєРѕРј РѕРєРёСЃР»РёС‚РµР»СЊРЅРѕРј СЃС‚СЂРµСЃСЃРµ.',
  bromelain: 'Р‘СЂРѕРјРµР»Р°Р№РЅ вЂ” РїСЂРѕС‚РµРѕР»РёС‚РёС‡РµСЃРєРёР№ С„РµСЂРјРµРЅС‚ Р°РЅР°РЅР°СЃР° СЃ С„РёР±СЂРёРЅРѕР»РёС‚РёС‡РµСЃРєРёРј, РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Рј Рё РїСЂРѕС‚РёРІРѕРѕС‚С‘С‡РЅС‹Рј РґРµР№СЃС‚РІРёРµРј. РЈСЃРєРѕСЂСЏРµС‚ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїСЂРё С‚СЂР°РІРјР°С… РјСЏРіРєРёС… С‚РєР°РЅРµР№, СѓР»СѓС‡С€Р°РµС‚ РїРёС‰РµРІР°СЂРµРЅРёРµ Рё РјРѕРґСѓР»РёСЂСѓРµС‚ РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚.',
  bpc157: 'BPC-157 вЂ” РїРµРЅС‚Р°РґРµРєР°РїРµРїС‚РёРґ РёР· Р¶РµР»СѓРґРѕС‡РЅРѕРіРѕ СЃРѕРєР° СЃ РґРѕРєР°Р·Р°РЅРЅРѕР№ СЂРµРіРµРЅРµСЂР°С†РёРµР№ СЃСѓС…РѕР¶РёР»РёР№, СЃРІСЏР·РѕРє, РєРёС€РµС‡РЅРёРєР° Рё РЅРµСЂРІРЅРѕР№ С‚РєР°РЅРё. РЎС‚РёРјСѓР»РёСЂСѓРµС‚ Р°РЅРіРёРѕРіРµРЅРµР· С‡РµСЂРµР· VEGF Рё FGF, СѓСЃРєРѕСЂСЏРµС‚ Р·Р°Р¶РёРІР»РµРЅРёРµ СЂР°РЅ Рё РѕР±РµСЃРїРµС‡РёРІР°РµС‚ С†РёС‚РѕРїСЂРѕС‚РµРєС†РёСЋ С‡РµСЂРµР· NO-РїСѓС‚СЊ.',
  tb500: 'TB-500 (С‚РёРјРѕР·РёРЅ ОІ4) вЂ” РїРµРїС‚РёРґ, СЃС‚РёРјСѓР»РёСЂСѓСЋС‰РёР№ РјРёРіСЂР°С†РёСЋ РєР»РµС‚РѕРє, Р°РЅРіРёРѕРіРµРЅРµР· Рё СЂРµРіРµРЅРµСЂР°С†РёСЋ С‚РєР°РЅРµР№. РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС‚РѕСЂ РїСЂРё РёС€РµРјРёРё РјРёРѕРєР°СЂРґР° Рё РЅРµР№СЂРѕРїСЂРѕС‚РµРєС‚РѕСЂ; СЃРёРЅРµСЂРіРёС‡РµРЅ СЃ BPC-157 РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ СЃСѓС…РѕР¶РёР»СЊРЅРѕ-СЃРІСЏР·РѕС‡РЅРѕРіРѕ Р°РїРїР°СЂР°С‚Р°.',
  meloxicam: 'РњРµР»РѕРєСЃРёРєР°Рј вЂ” СЃРµР»РµРєС‚РёРІРЅС‹Р№ COX-2 РёРЅРіРёР±РёС‚РѕСЂ РёР· РіСЂСѓРїРїС‹ РќРџР’Рџ СЃ РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Рј Рё Р°РЅР°Р»СЊРіРµС‚РёС‡РµСЃРєРёРј СЌС„С„РµРєС‚РѕРј. Р РёСЃРє РїРѕС‡РµС‡РЅРѕР№ Рё РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё РїСЂРё РґР»РёС‚РµР»СЊРЅРѕРј РїСЂРёРјРµРЅРµРЅРёРё; РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕРµ РІР»РёСЏРЅРёРµ РЅР° РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅСѓСЋ СЃРёСЃС‚РµРјСѓ.',
  diclofenac: 'Р”РёРєР»РѕС„РµРЅР°Рє вЂ” РќРџР’Рџ СЃ РІС‹СЃРѕРєРёРј СЂРёСЃРєРѕРј РєР°СЂРґРёРѕРІР°СЃРєСѓР»СЏСЂРЅС‹С… СЃРѕР±С‹С‚РёР№ (FDA warning) Рё РіРµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚Рё. Р­С„С„РµРєС‚РёРІРЅС‹Р№ РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ Рё Р°РЅР°Р»СЊРіРµС‚РёС‡РµСЃРєРёР№ РїСЂРµРїР°СЂР°С‚, РѕРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РєСѓСЂСЃ в‰¤2 РЅРµРґРµР»СЊ; РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕ РІР»РёСЏРµС‚ РЅР° РїРѕС‡РєРё Рё Р–РљРў.',
  tongkat_ali: 'РўРѕРЅРіРєР°С‚ РђР»Рё (Eurycoma longifolia) вЂ” Р°РґР°РїС‚РѕРіРµРЅ СЃ РґРѕРєР°Р·Р°РЅРЅС‹Рј РїРѕРІС‹С€РµРЅРёРµРј С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР° С‡РµСЂРµР· СЃС‚РёРјСѓР»СЏС†РёСЋ РІС‹СЃРІРѕР±РѕР¶РґРµРЅРёСЏ LH Рё СѓРІРµР»РёС‡РµРЅРёРµ СѓСЂРѕРІРЅСЏ 17-РєРµС‚РѕСЃС‚РµСЂРѕРёРґРѕРІ. РђРЅС‚РёРєРѕСЂС‚РёР·РѕР»СЊРЅС‹Р№ СЌС„С„РµРєС‚; СЃРёРЅРµСЂРіРёС‡РµРЅ СЃ С„Р°РґРѕРіРёРµР№ РґР»СЏжњЂе¤§еЊ– РіРёРїРѕС‚Р°Р»Р°РјРѕ-РіРёРїРѕС„РёР·Р°СЂРЅРѕР№ СЃС‚РёРјСѓР»СЏС†РёРё.',
  fadogia: 'Р¤Р°РґРѕРіРёСЏ (Fadogia agrestis) вЂ” Р°С„СЂРёРєР°РЅСЃРєРѕРµ СЂР°СЃС‚РµРЅРёРµ, СЃС‚РёРјСѓР»РёСЂСѓСЋС‰РµРµ РІС‹СЃРІРѕР±РѕР¶РґРµРЅРёРµ LH РёР· РіРёРїРѕС„РёР·Р° Рё РїСЂСЏРјСѓСЋ СЃС‚РёРјСѓР»СЏС†РёСЋ РєР»РµС‚РѕРє Р›РµР№РґРёРіР°. РњРµС…Р°РЅРёР·Рј РѕС‚Р»РёС‡Р°РµС‚СЃСЏ РѕС‚ С‚РѕРЅРіРєР°С‚ Р°Р»Рё, РѕР±РµСЃРїРµС‡РёРІР°СЏ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ РїРѕРІС‹С€РµРЅРёСЏ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°; СЃРёРЅРµСЂРіРёС‡РµРЅ РІ РєРѕРјР±РёРЅР°С†РёРё.',
  shilajit: 'РњСѓРјРёС‘ (С€РёР»Р°РґР¶РёС‚) вЂ” РѕСЂРіР°РЅРѕРјРёРЅРµСЂР°Р»СЊРЅС‹Р№ РєРѕРјРїР»РµРєСЃ СЃ С„СѓР»СЊРІРѕРєРёСЃР»РѕС‚Р°РјРё, СѓР»СѓС‡С€Р°СЋС‰РёР№ Р±РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РјРёРєСЂРѕСЌР»РµРјРµРЅС‚РѕРІ Рё РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ. Р“РµРјР°С‚РѕРїРѕСЌС‚РёС‡РµСЃРєР°СЏ РїРѕРґРґРµСЂР¶РєР° С‡РµСЂРµР· С…РµР»Р°С‚РёСЂРѕРІР°РЅРёРµ Р¶РµР»РµР·Р°, Р°РґР°РїС‚РѕРіРµРЅРЅС‹Р№ СЌС„С„РµРєС‚ С‡РµСЂРµР· РјРѕРґСѓР»СЏС†РёСЋ ATP-РїСЂРѕРґСѓРєС†РёРё.',
  boron: 'Р‘РѕСЂ вЂ” РјРёРєСЂРѕСЌР»РµРјРµРЅС‚, СѓСЃРёР»РёРІР°СЋС‰РёР№ РїРѕР»СѓСЂР°СЃРїР°Рґ РІРёС‚Р°РјРёРЅР° D Рё СЃРЅРёР¶Р°СЋС‰РёР№ СЌРєСЃРєСЂРµС†РёСЋ РєР°Р»СЊС†РёСЏ Рё РјР°РіРЅРёСЏ. РњРѕРґСѓР»РёСЂСѓРµС‚ СЌРєСЃРїСЂРµСЃСЃРёСЋ РѕСЃС‚РµРѕРєР°Р»СЊС†РёРЅР° Рё РёРјРјСѓРЅРЅС‹Р№ РѕС‚РІРµС‚; РїРѕРІС‹С€Р°РµС‚ СѓСЂРѕРІРµРЅСЊ СЃРІРѕР±РѕРґРЅРѕРіРѕ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР° С‡РµСЂРµР· СЃРЅРёР¶РµРЅРёРµ SHBG.',
};

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
    mechanism: 'GHRH (CJC-1295) + GHRP (РРїР°РјРѕСЂРµР»РёРЅ) вЂ” РєР»Р°СЃСЃРёС‡РµСЃРєР°СЏ СЃРёРЅРµСЂРіРёСЏ: CJC-1295 СѓРІРµР»РёС‡РёРІР°РµС‚ Р°РјРїР»РёС‚СѓРґСѓ GH-РїСѓР»СЊСЃР°, РРїР°РјРѕСЂРµР»РёРЅ СѓРІРµР»РёС‡РёРІР°РµС‚ С‡Р°СЃС‚РѕС‚Сѓ. Р’РјРµСЃС‚Рµ РґР°СЋС‚ 3-5Г— РїСЂРёСЂРѕСЃС‚ GH vs РјРѕРЅРѕ-С‚РµСЂР°РїРёСЏ.',
    affectedSystems: ['endocrine', 'musculoskeletal'],
    strength: 0.85,
    clinicalNote: 'Р—РѕР»РѕС‚РѕР№ СЃС‚Р°РЅРґР°СЂС‚ GH-С‚РµСЂР°РїРёРё: CJC-1295 100РјРєРі + РРїР°РјРѕСЂРµР»РёРЅ 100РјРєРі 1-3Г—/РґРµРЅСЊ'
  },
  {
    substanceA: 'semax',
    substanceB: 'selank',
    synergyType: 'synergistic',
    mechanism: 'РЎРµРјР°РєСЃ (BDNFв†‘, РЅРµР№СЂРѕРіРµРЅРµР·) + РЎРµР»Р°РЅРє (Р“РђРњРљ-Р°РіРѕРЅРёР·Рј, Р°РЅРєСЃРёРѕР»РёР·РёСЃ) = РЅРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ + СЃРїРѕРєРѕР№СЃС‚РІРёРµ. РљРѕРјР±РёРЅР°С†РёСЏ РґР°С‘С‚ РєРѕРіРЅРёС‚РёРІРЅСѓСЋ СЃС‚РёРјСѓР»СЏС†РёСЋ Р±РµР· С‚СЂРµРІРѕР¶РЅРѕСЃС‚Рё.',
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
    mechanisms: ['СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ Р°РЅС‚РёРѕРєСЃРёРґР°РЅС‚ (РІРѕРґРЅС‹Р№ + Р»РёРїРёРґРЅС‹Р№)', 'СЂРµРіРµРЅРµСЂР°С†РёСЏ РІРёС‚Р°РјРёРЅРѕРІ C Рё E', 'РїРѕРІС‹С€РµРЅРёРµ РіР»СѓС‚Р°С‚РёРѕРЅР° С‡РµСЂРµР· Nrf2', 'С…РµР»Р°С‚РёСЂРѕРІР°РЅРёРµ С‚СЏР¶С‘Р»С‹С… РјРµС‚Р°Р»Р»РѕРІ', 'ж”№е–„ РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅРѕР№ С„СѓРЅРєС†РёРё']
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