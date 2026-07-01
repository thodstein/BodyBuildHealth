// SUPPORT DB — unified catalog with all drugs including pharmacy
import { SUPPLEMENTS_DB } from './supplements';
import { PHARMACY_DB } from './pharmacy-db';

// в”Ђв”Ђ РўРёРїС‹ в”Ђв”Ђ
export interface TzDrugEntry {
  name: string;
  class: 'aas' | 'gh' | 'insulin' | 'glp1' | 'pct' | 'sarm';
  form: 'inject' | 'oral';
  targetOrgans: string[];
  organMechanisms: Record<string, string[]>;
  mechanismWeights: Record<string, number>;
  doseModifier: number;
}

export interface TzSupportEntry {
  organId: string;
  mechId: string;
  k: number;
  q: 'A' | 'B' | 'C';
  source: string;
}

export interface TzStackSubstance {
  id: string;
  name: string;
  targets: string[];   // mechIds РёР· 28 РўР—
  k: number;            // РІРєР»Р°Рґ РІ РїРѕРєСЂС‹С‚РёРµ
  q: 'A' | 'B' | 'C';
}

export interface TzStackEntry {
  id: string;
  name: string;
  substances: string[];
  coverage: Record<string, TzStackSubstance>;  // organId в†’ РІРµС‰РµСЃС‚РІРѕ
  organCoverage: string[];
  totalK: Record<string, number>;  // organId в†’ СЃСѓРјРјР°СЂРЅС‹Р№ k
}

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 1. Р‘Р” РћРЎРќРћР’РќР«РҐ РџР Р•РџРђР РђРўРћР’ (РђРђРЎ/GH/РРЅСЃСѓР»РёРЅ)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// targetOrgans вЂ” С‚РѕР»СЊРєРѕ РёР· 6 СЃРёСЃС‚РµРј РўР—
// organMechanisms вЂ” С‚РѕР»СЊРєРѕ РёР· 28 РјРµС…Р°РЅРёР·РјРѕРІ РўР—
// mechanismWeights вЂ” СѓСЂРѕРІРµРЅСЊ 1-4 (1=РІС‚РѕСЂРёС‡РЅС‹Р№, 2=СѓРјРµСЂРµРЅРЅС‹Р№, 3=РІРµРґСѓС‰РёР№, 4=РІС‹СЃРѕРєРёР№)
// doseModifier вЂ” РјРЅРѕР¶РёС‚РµР»СЊ РґРѕР·С‹ (1.0 СЃС‚Р°РЅРґР°СЂС‚, 1.3-1.5 РґР»СЏ 17О±-Р°Р»РєРёР»)

export const DRUG_DB: Record<string, TzDrugEntry> = {
  // в”Ђв”Ђ РђРђРЎ РёРЅСЉРµРєС†РёРѕРЅРЅС‹Рµ (17) в”Ђв”Ђ
  test_prop: { name:'РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ РїСЂРѕРїРёРѕРЅР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3 }, doseModifier:1.0 },
  test_enan: { name:'РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ СЌРЅР°РЅС‚Р°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3 }, doseModifier:1.0 },
  test_cyp: { name:'РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ С†РёРїРёРѕРЅР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3 }, doseModifier:1.0 },
  test_undec: { name:'РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ СѓРЅРґРµРєР°РЅРѕР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3 }, doseModifier:1.0 },
  tren_acet: { name:'РўСЂРµРЅР±РѕР»РѕРЅ Р°С†РµС‚Р°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3 }, doseModifier:1.5 },
  tren_enan: { name:'РўСЂРµРЅР±РѕР»РѕРЅ СЌРЅР°РЅС‚Р°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3 }, doseModifier:1.5 },
  tren_hex: { name:'РўСЂРµРЅР±РѕР»РѕРЅ РіРµРєСЃР°РіРёРґСЂРѕР±РµРЅР·РёР»РєР°СЂР±РѕРЅР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3 }, doseModifier:1.5 },
  npp: { name:'РќР°РЅРґСЂРѕР»РѕРЅ С„РµРЅРёР»РїСЂРѕРїРёРѕРЅР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv2:3, rep1:3, rep2:3, hem1:3, cns1:2, cv4:2 }, doseModifier:0.8 },
  deca: { name:'РќР°РЅРґСЂРѕР»РѕРЅ РґРµРєР°РЅРѕР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ cv2:3, rep1:3, rep2:3, hem1:3, cns1:2, cv4:2 }, doseModifier:0.8 },
  trest_acet: { name:'РўСЂРµСЃС‚РѕР»РѕРЅ Р°С†РµС‚Р°С‚ (РњР•РќРў)', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:3, rep1:4, rep2:4, rep4:3, hem1:3, liv1:2 }, doseModifier:1.2 },
  trest_enan: { name:'РўСЂРµСЃС‚РѕР»РѕРЅ СЌРЅР°РЅС‚Р°С‚ (РњР•РќРў)', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{ cv1:4, cv2:4, cv5:3, rep1:4, rep2:4, rep4:3, hem1:3, liv1:2 }, doseModifier:1.2 },
  dhb: { name:'Р”РёРіРёРґСЂРѕР±РѕР»РґРµРЅРѕРЅ (DHB)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{ hem1:4, cv2:3, hem2:2, cv4:2, liv1:2 }, doseModifier:1.1 },
  dhb_cyp: { name:'Р”РёРіРёРґСЂРѕР±РѕР»РґРµРЅРѕРЅ С†РёРїРёРѕРЅР°С‚ (DHB-C)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{ hem1:4, cv2:3, hem2:2, cv4:2, liv1:2 }, doseModifier:1.1 },
  bold_undec: { name:'Р‘РѕР»РґРµРЅРѕРЅ СѓРЅРґРµС†РёР»РµРЅР°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{ hem1:4, cv2:3, hem2:2, cv4:2 }, doseModifier:0.9 },
  prim_enan: { name:'РњРµС‚РµРЅРѕР»РѕРЅ СЌРЅР°РЅС‚Р°С‚ (РџСЂРёРјРѕР±РѕР»Р°РЅ)', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{ rep1:3, rep2:3, cv2:2, hem2:2 }, doseModifier:0.7 },
  drostanolone_prop: { name:'Р”СЂРѕСЃС‚Р°РЅРѕР»РѕРЅ РїСЂРѕРїРёРѕРЅР°С‚ (РњР°СЃС‚РµСЂРѕРЅ)', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{ rep1:3, rep2:3, rep4:2, cv2:2, hem1:2 }, doseModifier:1.0 },
  drostanolone_enan: { name:'Р”СЂРѕСЃС‚Р°РЅРѕР»РѕРЅ СЌРЅР°РЅС‚Р°С‚', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{ rep1:3, rep2:3, rep4:2, cv2:2, hem1:2 }, doseModifier:1.0 },

  // в”Ђв”Ђ РђРђРЎ РїРµСЂРѕСЂР°Р»СЊРЅС‹Рµ 17О±-Р°Р»РєРёР»РёСЂРѕРІР°РЅРЅС‹Рµ (7) в”Ђв”Ђ
  methand: { name:'РњРµС‚Р°РЅРґРёРµРЅРѕРЅ', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren4'] },
    mechanismWeights:{ liv1:4, cv2:4, cv1:3, cv5:3, rep1:3, rep2:3, hem1:3, rep4:2 }, doseModifier:1.5 },
  oxan: { name:'РћРєСЃР°РЅРґСЂРѕР»РѕРЅ', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{ liv1:4, liv2:3, cv2:3, rep1:3, rep2:3, hem2:2 }, doseModifier:1.3 },
  stan: { name:'РЎС‚Р°РЅРѕР·РѕР»РѕР»', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{ liv1:4, liv2:3, cv2:3, hem1:3, rep1:3, rep2:3 }, doseModifier:1.4 },
  trena: { name:'РўСѓСЂРёРЅР°Р±РѕР»', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{ liv1:4, liv2:3, cv2:3, rep1:3, rep2:3 }, doseModifier:1.4 },
  halo: { name:'РҐР»РѕСЂРґРµРіРёРґСЂРѕРјРµС‚РёР»С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1'] },
    mechanismWeights:{ liv1:4, cv2:4, hem1:3, liv2:3, rep1:3, rep2:3 }, doseModifier:1.5 },
  superdrol: { name:'РњРµС‚РёР»РґСЂРѕСЃС‚Р°РЅРѕР»РѕРЅ', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{ liv1:4, cv2:4, hem1:3, liv2:3, rep1:3, rep2:3, cv4:2 }, doseModifier:1.5 },
  anadrol: { name:'РћРєСЃРёРјРµС‚РѕР»РѕРЅ', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren4'] },
    mechanismWeights:{ hem1:4, liv1:4, cv2:4, cv1:3, cv5:3, rep1:3, rep2:3, cv4:3, rep4:2 }, doseModifier:1.5 },

  // в”Ђв”Ђ DHT РїСЂРѕРёР·РІРѕРґРЅС‹Рµ (1) в”Ђв”Ђ
  mesterolone: { name:'РњРµСЃС‚РµСЂРѕР»РѕРЅ (РџСЂРѕРІРёСЂРѕРЅ)', class:'aas', form:'oral',
    targetOrgans:['reproductive','cardio'],
    organMechanisms:{ reproductive:['rep1','rep2','rep4'], cardio:['cv2'] },
    mechanismWeights:{ rep1:3, rep2:3, rep4:2, cv2:1 }, doseModifier:0.6 },

  // в”Ђв”Ђ SARMs (4) в”Ђв”Ђ
  ostarine: { name:'Ostarine MK-2866', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{ rep1:2, rep2:2, cv2:2, liv1:2 }, doseModifier:1.0 },
  lgd: { name:'Ligandrol LGD-4033', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{ rep1:3, rep2:3, cv2:2, liv1:2 }, doseModifier:1.0 },
  rad140: { name:'RAD-140', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','cns'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'], cns:['cns1'] },
    mechanismWeights:{ rep1:3, rep2:3, cns1:2, cv2:2, liv1:2 }, doseModifier:1.0 },
  s23: { name:'S-23', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{ rep1:3, rep2:3, cv2:3, hem1:2, liv1:2 }, doseModifier:1.0 },

  // в”Ђв”Ђ GH / РџРµРїС‚РёРґС‹ (25) в”Ђв”Ђ
  cjc1295: { name:'CJC-1295', class:'gh', form:'inject',
    targetOrgans:['cardio','renal','cns','hematologic'],
    organMechanisms:{ cardio:['cv3'], renal:['ren1','ren4'], cns:['cns5','cns6'], hematologic:['hem2'] },
    mechanismWeights:{ cns6:2, ren1:2, hem2:2, cv3:1 }, doseModifier:1.0 },
  ghrp6: { name:'GHRP-6', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{ hem2:2, cns5:1 }, doseModifier:1.0 },
  ipamorelin: { name:'Ipamorelin', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{ hem2:2, cns5:1 }, doseModifier:0.8 },
  ghrp2: { name:'GHRP-2', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{ hem2:2, cns5:1 }, doseModifier:1.0 },
  sermorelin: { name:'Sermorelin', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'] },
    mechanismWeights:{ hem2:2, cns5:1 }, doseModifier:0.8 },
  mk677: { name:'Ibutamoren MK-677', class:'gh', form:'oral',
    targetOrgans:['cardio','renal','cns','hematologic'],
    organMechanisms:{ cardio:['cv3'], renal:['ren1','ren4'], cns:['cns5','cns6'], hematologic:['hem2'] },
    mechanismWeights:{ cns6:2, ren1:2, hem2:2, cv3:1 }, doseModifier:0.9 },
  igf1_lr3: { name:'IGF-1 LR3', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem2'] },
    mechanismWeights:{ hem3:4, cns5:3, hem2:2 }, doseModifier:1.2 },
  igf1_des: { name:'IGF-1 DES', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem2'] },
    mechanismWeights:{ hem3:4, cns5:2, hem2:2 }, doseModifier:1.2 },
  mgf: { name:'РњРµС…Р°РЅРѕ-Р¤Р°РєС‚РѕСЂ (РњР“Р¤)', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.5 },
  peg_mgf: { name:'PEG-MGF', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.5 },
  bpc157: { name:'BPC-157', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  tb500: { name:'TB-500', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  ghk_cu: { name:'GHK-Cu', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  ss31: { name:'SS-31 (Elamipretide)', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  semax: { name:'РЎРµРјР°РєСЃ', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{ cns1:1 }, doseModifier:0.0 },
  selank: { name:'РЎРµР»Р°РЅРє', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{ cns1:1 }, doseModifier:0.0 },
  epitalon: { name:'Р­РїРёС‚Р°Р»РѕРЅ', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  dsip: { name:'DSIP', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{ cns1:1 }, doseModifier:0.0 },
  mots_c: { name:'MOTS-C', class:'gh', form:'inject',
    targetOrgans:['hematologic'], organMechanisms:{ hematologic:['hem2'] }, mechanismWeights:{ hem2:1 }, doseModifier:0.0 },
  hgh_frag: { name:'HGH Fragment 176-191', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  aod9604: { name:'AOD-9604', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  thymosin_a1: { name:'РўРёРјРѕР·РёРЅ Р°Р»СЊС„Р°-1', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  gonadorelin: { name:'Р“РѕРЅР°РґРѕСЂРµР»РёРЅ', class:'gh', form:'inject',
    targetOrgans:['reproductive'], organMechanisms:{ reproductive:['rep1'] }, mechanismWeights:{ rep1:2 }, doseModifier:0.0 },
  melanotan2: { name:'РњРµР»Р°РЅРѕС‚Р°РЅ II', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  foxo4_dri: { name:'FOXO4-DRI', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },

  // в”Ђв”Ђ GLP-1 Р°РіРѕРЅРёСЃС‚С‹ (2) в”Ђв”Ђ
  semaglutide: { name:'РЎРµРјР°РіР»СѓС‚РёРґ', class:'glp1', form:'inject',
    targetOrgans:['hematologic','cardio','cns'],
    organMechanisms:{ hematologic:['hem2','hem3'], cardio:['cv3'], cns:['cns5'] },
    mechanismWeights:{ hem3:3, hem2:2, cv3:1, cns5:1 }, doseModifier:0.5 },
  tirzepatide: { name:'РўРёСЂР·РµРїР°С‚РёРґ', class:'glp1', form:'inject',
    targetOrgans:['hematologic','cardio','cns'],
    organMechanisms:{ hematologic:['hem2','hem3'], cardio:['cv3'], cns:['cns5'] },
    mechanismWeights:{ hem3:3, hem2:2, cv3:1, cns5:1 }, doseModifier:0.5 },

  // в”Ђв”Ђ РРЅСЃСѓР»РёРЅС‹ (4) в”Ђв”Ђ
  ins_short: { name:'РРЅСЃСѓР»РёРЅ РєРѕСЂРѕС‚РєРёР№', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem4','hem5'], cardio:['cv3','cv5'], renal:['ren4'] },
    mechanismWeights:{ hem3:4, cns5:4, hem4:3, cv5:3, hem5:2, cv3:2, ren4:2 }, doseModifier:1.0 },
  ins_long: { name:'РРЅСЃСѓР»РёРЅ РґР»РёРЅРЅС‹Р№', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2','hem3','hem5'], cardio:['cv3'], renal:['ren4'] },
    mechanismWeights:{ hem3:3, cns5:3, hem2:3, hem5:2, cv3:2 }, doseModifier:0.8 },
  ins_aspart: { name:'РРЅСЃСѓР»РёРЅ Р°СЃРїР°СЂС‚', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem4','hem5'], cardio:['cv3','cv5'], renal:['ren4'] },
    mechanismWeights:{ hem3:4, cns5:4, hem4:3, cv5:3, hem5:2, cv3:2, ren4:2 }, doseModifier:1.0 },
  ins_detemir: { name:'РРЅСЃСѓР»РёРЅ РґРµС‚РµРјРёСЂ', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2','hem3','hem5'], cardio:['cv3'], renal:['ren4'] },
    mechanismWeights:{ hem3:3, cns5:3, hem2:3, hem5:2, cv3:2 }, doseModifier:0.8 },
};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 2. РџРћР›РќРђРЇ Р‘Р” РџР Р•РџРђР РђРўРћР’ РџРћР”Р”Р•Р Р–РљР (328 РІРµС‰РµСЃС‚РІ Г— РўР—-РјРµС…Р°РЅРёР·РјС‹)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// k вЂ” 0..1 РєРѕСЌС„С„РёС†РёРµРЅС‚ СЃРЅРёР¶РµРЅРёСЏ РјРµС…Р°РЅРёР·РјР°
// q вЂ” A (РїСЂСЏРјС‹Рµ РґР°РЅРЅС‹Рµ) / B (СЃСѓСЂСЂРѕРіР°С‚РЅС‹Рµ РјР°СЂРєРµСЂС‹) / C (РїСЂР°РІРґРѕРїРѕРґРѕР±РЅРѕСЃС‚СЊ)
// source вЂ” РёСЃС‚РѕС‡РЅРёРє РѕР±РѕСЃРЅРѕРІР°РЅРёСЏ
// Р—Р°РїСЂРµС‰РµРЅРѕ: generic-СЃС‚СЂРѕРєРё, РЅРµСЂРµР°Р»РёСЃС‚РёС‡РЅС‹Рµ k, РјРµС…Р°РЅРёР·РјС‹ РЅРµ РёР· РўР—
// [] вЂ” РІРµС‰РµСЃС‚РІРѕ РЅРµ РёРјРµРµС‚ РїСЂСЏРјРѕРіРѕ РјР°РїРїРёРЅРіР° РЅР° 28 РјРµС…Р°РЅРёР·РјРѕРІ РўР—

export const SUPPORT_DB: Record<string, TzSupportEntry[]> = {};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 3. Р‘Р” РЎРўР•РљРћР’ (РўР—-РјРµС…Р°РЅРёР·РјС‹)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// coverage вЂ” РєР°РєРёРµ РјРµС…Р°РЅРёР·РјС‹ РўР— РїРѕРєСЂС‹РІР°РµС‚ СЃС‚РµРє
// substances вЂ” СЃРїРёСЃРѕРє ID РІРµС‰РµСЃС‚РІ РІ СЃС‚РµРєРµ
// totalK вЂ” СЃСѓРјРјР°СЂРЅС‹Р№ k РїРѕ РѕСЂРіР°РЅСѓ

export const STACK_DB: Record<string, TzStackEntry> = {
  hepatoprotection_stack: { id:'hepatoprotection_stack', name:'Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ: РіР»СѓС‚Р°С‚РёРѕРЅ + ER-СЃС‚СЂРµСЃСЃ + РјРµРјР±СЂР°РЅС‹',
    substances:['nac','tudca','milk_thistle','alpha_lipoic'],
    coverage:{ h1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, h2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  cardioprotection_stack: { id:'cardioprotection_stack', name:'РљР°СЂРґРёРѕРїСЂРѕС‚РµРєС†РёСЏ: Р»РёРїРёРґС‹ + СЌРЅРµСЂРіРёСЏ + СЌР»РµРєС‚СЂРѕР»РёС‚С‹',
    substances:['omega3','magnesium','coq10','taurine_sup'],
    coverage:{ c1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','cv4'], k:0.30, q:'B' }, c2:{ id:'magnesium', name:'РњР°РіРЅРёР№', targets:['cv5'], k:0.35, q:'B' } },
    organCoverage:['cardio'], totalK:{ cardio:0.52 } },
  nephroprotection_stack: { id:'nephroprotection_stack', name:'РќРµС„СЂРѕРїСЂРѕС‚РµРєС†РёСЏ',
    substances:['telmi','omega3','nac'],
    coverage:{ n1:{ id:'telmi', name:'РўРµР»РјРёСЃР°СЂС‚Р°РЅ', targets:['ren1','ren3'], k:0.45, q:'A' }, n2:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['ren1'], k:0.15, q:'C' } },
    organCoverage:['renal'], totalK:{ renal:0.53 } },
  neuroprotection_stack: { id:'neuroprotection_stack', name:'РќРµР№СЂРѕРїСЂРѕС‚РµРєС†РёСЏ',
    substances:['alpha_lipoic','magnesium','ashwagandha','coq10'],
    coverage:{ ns1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2'], k:0.30, q:'C' }, ns2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.44 } },
  fibrinolytic_stack: { id:'fibrinolytic_stack', name:'Р¤РёР±СЂРёРЅРѕР»РёС‚РёС‡РµСЃРєРёР№',
    substances:['aspirin','omega3'],
    coverage:{ f1:{ id:'aspirin', name:'РђСЃРїРёСЂРёРЅ', targets:['cv4'], k:0.35, q:'B' }, f2:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['hem1'], k:0.15, q:'C' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.32 } },
  hormonal_pct_stack: { id:'hormonal_pct_stack', name:'Р“РѕСЂРјРѕРЅР°Р»СЊРЅР°СЏ РїРѕРґРґРµСЂР¶РєР° HPTA',
    substances:['hcg','tamoxifen','enclomiphene'],
    coverage:{ r1:{ id:'hcg', name:'РҐР“Р§', targets:['rep1','rep2','rep3','rep5'], k:0.50, q:'A' }, r2:{ id:'tamoxifen', name:'РўР°РјРѕРєСЃРёС„РµРЅ', targets:['rep4','rep5'], k:0.40, q:'A' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.70 } },
  glycemic_control_stack: { id:'glycemic_control_stack', name:'РњРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ РєРѕРЅС‚СЂРѕР»СЊ',
    substances:['berberine','alpha_lipoic','omega3'],
    coverage:{ g1:{ id:'berberine', name:'Р‘РµСЂР±РµСЂРёРЅ', targets:['hem2'], k:0.40, q:'B' }, g2:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['hem2'], k:0.20, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.52 } },
  adaptogenic_stack: { id:'adaptogenic_stack', name:'РђРґР°РїС‚РѕРіРµРЅРЅС‹Р№',
    substances:['ashwagandha','magnesium','rhodiola','ginseng_sup'],
    coverage:{ a1:{ id:'ashwagandha', name:'РђС€РІР°РіР°РЅРґР°', targets:['cns1','cns4'], k:0.15, q:'C' }, a2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  articular_stack: { id:'articular_stack', name:'РЎСѓСЃС‚Р°РІРЅРѕР№',
    substances:['collagen','msm','glucosamine','vitamin_d3'],
    coverage:{ ac1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.10 } },
  immune_stack: { id:'immune_stack', name:'РРјРјСѓРЅРЅС‹Р№',
    substances:['vitamin_d3','zinc_sup','probiotics_sup'],
    coverage:{ i1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' }, i2:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['hematologic','reproductive'], totalK:{ hematologic:0.10, reproductive:0.15 } },
  mitochondrial_stack: { id:'mitochondrial_stack', name:'РњРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅС‹Р№',
    substances:['coq10','alpha_lipoic','shilajit'],
    coverage:{ m1:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' }, m2:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  nootropic_stack: { id:'nootropic_stack', name:'РќРѕРѕС‚СЂРѕРїРЅС‹Р№',
    substances:['alpha_lipoic','coq10','vitamin_b6','vitamin_b12'],
    coverage:{ no1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2'], k:0.30, q:'C' }, no2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.48 } },
  anti_stress_stack: { id:'anti_stress_stack', name:'РђРЅС‚РёСЃС‚СЂРµСЃСЃРѕРІС‹Р№',
    substances:['ashwagandha','magnesium'],
    coverage:{ as1:{ id:'ashwagandha', name:'РђС€РІР°РіР°РЅРґР°', targets:['cns1','cns4'], k:0.15, q:'C' }, as2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  bone_stack: { id:'bone_stack', name:'РљРѕСЃС‚РЅС‹Р№',
    substances:['vitamin_d3','vitamin_k2','magnesium','boron'],
    coverage:{ b1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' }, b2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' } },
    organCoverage:['hematologic','reproductive'], totalK:{ hematologic:0.10, reproductive:0.10 } },
  gi_microbiome_stack: { id:'gi_microbiome_stack', name:'Р–РљРў-РїСЂРѕС‚РµРєС†РёСЏ',
    substances:['probiotics_sup','glutamine','zinc_sup'],
    coverage:{ g1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  antioxidant_network_stack: { id:'antioxidant_network_stack', name:'РђРЅС‚РёРѕРєСЃРёРґР°РЅС‚РЅС‹Р№',
    substances:['alpha_lipoic','coq10','selenium_sup','vitamin_b6'],
    coverage:{ ao1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' }, ao2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  sleep_stack: { id:'sleep_stack', name:'РЎРѕРЅ',
    substances:['magnesium','ashwagandha','taurine_sup'],
    coverage:{ sl1:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' }, sl2:{ id:'ashwagandha', name:'РђС€РІР°РіР°РЅРґР°', targets:['cns1','cns4'], k:0.15, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  thyroid_stack: { id:'thyroid_stack', name:'РўРёСЂРµРѕРёРґРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°',
    substances:['selenium_sup','zinc_sup','ashwagandha'],
    coverage:{ th1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, th2:{ id:'ashwagandha', name:'РђС€РІР°РіР°РЅРґР°', targets:['cns4'], k:0.15, q:'C' } },
    organCoverage:['reproductive','cns'], totalK:{ reproductive:0.15, cns:0.15 } },
  endothelial_no_stack: { id:'endothelial_no_stack', name:'РЎРѕСЃСѓРґРёСЃС‚Р°СЏ РїРѕРґРґРµСЂР¶РєР°',
    substances:['omega3','coq10','taurine_sup'],
    coverage:{ en1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','cv4'], k:0.30, q:'B' }, en2:{ id:'coq10', name:'CoQ10', targets:['cv2','cv5'], k:0.20, q:'C' } },
    organCoverage:['cardio'], totalK:{ cardio:0.44 } },
  anti_inflammatory_stack: { id:'anti_inflammatory_stack', name:'РџСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№',
    substances:['omega3','curcumin_sup','coq10'],
    coverage:{ ai1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','hem2'], k:0.30, q:'B' }, ai2:{ id:'curcumin_sup', name:'РљСѓСЂРєСѓРјРёРЅ', targets:['cv2','cns2','hem2'], k:0.20, q:'C' } },
    organCoverage:['cardio','hematologic','cns'], totalK:{ cardio:0.44, hematologic:0.44, cns:0.20 } },
  skin_collagen_stack: { id:'skin_collagen_stack', name:'РљРѕР¶Р° Рё РєРѕР»Р»Р°РіРµРЅ',
    substances:['zinc_sup','selenium_sup','vitamin_d3'],
    coverage:{ sk1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  detox_stack: { id:'detox_stack', name:'Р”РµС‚РѕРєСЃРёРєР°С†РёСЏ',
    substances:['nac','milk_thistle','alpha_lipoic'],
    coverage:{ dt1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, dt2:{ id:'milk_thistle', name:'РЎРёР»РёРјР°СЂРёРЅ', targets:['liv1'], k:0.25, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.55 } },
  post_cycle_recovery_stack: { id:'post_cycle_recovery_stack', name:'PCT',
    substances:['hcg','tamoxifen','clomi','zinc_sup','ashwagandha'],
    coverage:{ pc1:{ id:'hcg', name:'РҐР“Р§', targets:['rep1','rep2','rep3','rep5'], k:0.50, q:'A' }, pc2:{ id:'tamoxifen', name:'РўР°РјРѕРєСЃРёС„РµРЅ', targets:['rep4','rep5'], k:0.40, q:'A' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.70 } },
  hair_skin_nails_stack: { id:'hair_skin_nails_stack', name:'Р’РѕР»РѕСЃС‹-РєРѕР¶Р°-РЅРѕРіС‚Рё',
    substances:['zinc_sup','selenium_sup','vitamin_b6','biotin'],
    coverage:{ hs1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  detox_heavy_metals_stack: { id:'detox_heavy_metals_stack', name:'Р”РµС‚РѕРєСЃ РјРµС‚Р°Р»Р»РѕРІ',
    substances:['alpha_lipoic','nac','selenium_sup','zinc_sup'],
    coverage:{ dh1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, dh2:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2'], k:0.30, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.40, cns:0.30 } },
  sleep_recovery_stack: { id:'sleep_recovery_stack', name:'РЎРѕРЅ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ',
    substances:['magnesium','ashwagandha','taurine_sup','glycine'],
    coverage:{ sr1:{ id:'magnesium', name:'Mg', targets:['cns1','cv5'], k:0.35, q:'B' }, sr2:{ id:'ashwagandha', name:'РђС€РІР°РіР°РЅРґР°', targets:['cns1','cns4'], k:0.15, q:'C' } },
    organCoverage:['cns','cardio'], totalK:{ cns:0.44, cardio:0.35 } },
  nootropic_energy_stack: { id:'nootropic_energy_stack', name:'РќРѕРѕС‚СЂРѕРїРЅС‹Р№ СЌРЅРµСЂРіРµС‚РёРє',
    substances:['alpha_lipoic','coq10','creatine','vitamin_b6','vitamin_b12'],
    coverage:{ ne1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' }, ne2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  anti_catabolic_stack: { id:'anti_catabolic_stack', name:'РђРЅС‚РёРєР°С‚Р°Р±РѕР»РёС‡РµСЃРєРёР№',
    substances:['omega3','vitamin_d3','taurine_sup'],
    coverage:{ ac1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['hem2'], k:0.15, q:'C' }, ac2:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.24 } },
  blood_flow_no_stack: { id:'blood_flow_no_stack', name:'РљСЂРѕРІРѕС‚РѕРє Рё NO',
    substances:['omega3','taurine_sup','coq10'],
    coverage:{ bf1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','cv4'], k:0.30, q:'B' }, bf2:{ id:'taurine_sup', name:'РўР°СѓСЂРёРЅ', targets:['cv5','cv3'], k:0.20, q:'C' } },
    organCoverage:['cardio'], totalK:{ cardio:0.44 } },
  insulin_sensitivity_stack: { id:'insulin_sensitivity_stack', name:'РРЅСЃСѓР»РёРЅРѕРІР°СЏ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ',
    substances:['berberine','alpha_lipoic','magnesium'],
    coverage:{ is1:{ id:'berberine', name:'Р‘РµСЂР±РµСЂРёРЅ', targets:['hem2'], k:0.40, q:'B' }, is2:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['hem2'], k:0.20, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.52 } },
  pancreas_liver_stack: { id:'pancreas_liver_stack', name:'РџРѕРґР¶РµР»СѓРґРѕС‡РЅР°СЏ Рё РїРµС‡РµРЅСЊ',
    substances:['berberine','nac','alpha_lipoic','tudca','milk_thistle'],
    coverage:{ pl1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, pl2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, pl3:{ id:'berberine', name:'Р‘РµСЂР±РµСЂРёРЅ', targets:['hem2'], k:0.40, q:'B' } },
    organCoverage:['hepatic','hematologic'], totalK:{ hepatic:0.61, hematologic:0.40 } },
  iron_absorption_stack: { id:'iron_absorption_stack', name:'РџРѕРІС‹С€РµРЅРёРµ Р¶РµР»РµР·Р°',
    substances:['lactoferrin','vitamin_c','zinc_sup'],
    coverage:{ ia1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  iron_b_complex_stack: { id:'iron_b_complex_stack', name:'B-РєРѕРјРїР»РµРєСЃ+Р¶РµР»РµР·Рѕ',
    substances:['vitamin_b6','vitamin_b12','folate','zinc_sup'],
    coverage:{ ib1:{ id:'vitamin_b6', name:'B6', targets:['cns1','hem1'], k:0.10, q:'C' }, ib2:{ id:'vitamin_b12', name:'B12', targets:['cns1'], k:0.10, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.20, hematologic:0.05 } },
  cholinergic_nootropic_stack: { id:'cholinergic_nootropic_stack', name:'РҐРѕР»РёРЅРµСЂРіРёС‡РµСЃРєРёР№ РЅРѕРѕС‚СЂРѕРї',
    substances:['alpha_gpc','cdp_choline','huperzine_a'],
    coverage:{ cn1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.30, hematologic:0.20 } },
  fibrinolytic_lumbro_brome_stack: { id:'fibrinolytic_lumbro_brome_stack', name:'Р¤РёР±СЂРёРЅРѕР»РёС‚РёРє',
    substances:['lumbrokinase','nattokinase','bromelain'],
    coverage:{ fl1:{ id:'aspirin', name:'РђСЃРїРёСЂРёРЅ*', targets:['cv4','hem1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.20 } },
  fibrinolytic_quad_stack: { id:'fibrinolytic_quad_stack', name:'Р¤РёР±СЂРёРЅРѕР»РёС‚РёРє РєРІР°РґСЂРѕ',
    substances:['serrapeptase','nattokinase','lumbrokinase','bromelain'],
    coverage:{ fq1:{ id:'aspirin', name:'РђСЃРїРёСЂРёРЅ*', targets:['cv4','hem1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.20 } },
  methylation_tmg_mthf_stack: { id:'methylation_tmg_mthf_stack', name:'РњРµС‚РёР»РёСЂРѕРІР°РЅРёРµ',
    substances:['tmg','folate','vitamin_b12','vitamin_b6','zinc_sup'],
    coverage:{ mt1:{ id:'folate', name:'Р¤РѕР»Р°С‚', targets:['cns1'], k:0.10, q:'C' }, mt2:{ id:'vitamin_b12', name:'B12', targets:['cns1'], k:0.10, q:'C' }, mt3:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['cns','reproductive'], totalK:{ cns:0.20, reproductive:0.15 } },
  hepatic_nac_udca_se_mo_stack: { id:'hepatic_nac_udca_se_mo_stack', name:'Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ Р±Р°Р·РѕРІР°СЏ',
    substances:['nac','tudca','selenium_sup','molybdenum'],
    coverage:{ hn1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hn2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  hepatic_nac_udca_tudca_stack: { id:'hepatic_nac_udca_tudca_stack', name:'Р“РµРїР°С‚РѕРїСЂРѕС‚РµРєС†РёСЏ СѓСЃРёР»РµРЅРЅР°СЏ',
    substances:['nac','tudca','udca'],
    coverage:{ hu1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hu2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  hepatic_extended_pc_stack: { id:'hepatic_extended_pc_stack', name:'Р“РµРїР°С‚РѕРєРѕРјРїР»РµРєСЃ',
    substances:['nac','tudca','udca','phosphatidylcholine','alpha_lipoic'],
    coverage:{ he1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, he2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, he3:{ id:'phosphatidylcholine', name:'Р¤РҐ', targets:['liv2'], k:0.15, q:'C' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.67 } },
  hepatic_max_stack: { id:'hepatic_max_stack', name:'Р“РµРїР°С‚РѕРєРѕРјРїР»РµРєСЃ РјР°РєСЃРёРјСѓРј',
    substances:['nac','tudca','udca','phosphatidylcholine','alpha_lipoic','milk_thistle'],
    coverage:{ hm1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hm2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, hm3:{ id:'milk_thistle', name:'РЎРёР»РёРјР°СЂРёРЅ', targets:['liv1'], k:0.25, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.71 } },
  libido_stack: { id:'libido_stack', name:'Р›РёР±РёРґРѕ Рё СЌСЂРµРєС†РёСЏ',
    substances:['zinc_sup','boron','fadogia','tongkat_ali'],
    coverage:{ lb1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, lb2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' }, lb3:{ id:'fadogia', name:'Р¤Р°РґРѕРіРёСЏ', targets:['rep1'], k:0.10, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.33 } },
  libido_erectile_stack: { id:'libido_erectile_stack', name:'Р›РёР±РёРґРѕ РїСЂРѕРґРІРёРЅСѓС‚С‹Р№',
    substances:['zinc_sup','boron','fadogia','tongkat_ali','macuna'],
    coverage:{ le1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, le2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' }, le3:{ id:'fadogia', name:'Р¤Р°РґРѕРіРёСЏ', targets:['rep1'], k:0.10, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.33 } },
  mito_benfo_stack: { id:'mito_benfo_stack', name:'РњРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅР°СЏ Р·Р°С‰РёС‚Р°',
    substances:['benfotiamine','alpha_lipoic','coq10','astaxanthin','pqq','vitamin_b12'],
    coverage:{ mb1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' }, mb2:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic','cardio'], totalK:{ cns:0.44, hematologic:0.20, cardio:0.15 } },
  membrane_ps_ump_pc_stack: { id:'membrane_ps_ump_pc_stack', name:'РњРµРјР±СЂР°РЅРЅС‹Р№ РЅРѕРѕС‚СЂРѕРї',
    substances:['phosphatidylserine','phosphatidylcholine','ump'],
    coverage:{ mp1:{ id:'phosphatidylcholine', name:'Р¤РҐ', targets:['liv2','cns1'], k:0.15, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.15, cns:0.10 } },
  longevity_nad_stack: { id:'longevity_nad_stack', name:'NAD+/РґРѕР»РіРѕР»РµС‚РёРµ',
    substances:['spermidine','nicotinamide_riboside','resveratrol','coq10','piperine'],
    coverage:{ ln1:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' } },
    organCoverage:['cns','cardio'], totalK:{ cns:0.25, cardio:0.15 } },
  choline_ginkgo_stack: { id:'choline_ginkgo_stack', name:'РҐРѕР»РёРЅРѕРІС‹Р№ РЅРѕРѕС‚СЂРѕРї',
    substances:['alpha_gpc','choline_bitartrate','ginkgo'],
    coverage:{ cg1:{ id:'phosphatidylcholine', name:'Р¤РҐ', targets:['liv2','cns1'], k:0.15, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.15, cns:0.10 } },
  neuro_vascular_stack: { id:'neuro_vascular_stack', name:'РќРµР№СЂРѕ-РІР°СЃРєСѓР»СЏСЂРЅС‹Р№',
    substances:['benfotiamine','alpha_lipoic','chromium'],
    coverage:{ nv1:{ id:'alpha_lipoic', name:'РђР›Р¬Рљ', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.30, hematologic:0.20 } },
  liver_emergency_stack: { id:'liver_emergency_stack', name:'Р­РєСЃС‚СЂРµРЅРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ РїРµС‡РµРЅРё',
    substances:['nac','tudca','milk_thistle','phosphatidylcholine','taurine_sup','alpha_lipoic'],
    coverage:{ le1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, le2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, le3:{ id:'milk_thistle', name:'РЎРёР»РёРјР°СЂРёРЅ', targets:['liv1'], k:0.25, q:'B' }, le4:{ id:'phosphatidylcholine', name:'Р¤РҐ', targets:['liv2'], k:0.15, q:'C' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.74 } },
  joints_regeneration_stack: { id:'joints_regeneration_stack', name:'РЎСѓСЃС‚Р°РІС‹',
    substances:['bpc157','tb500','uc2','boswellia','msm','vitamin_d3'],
    coverage:{ jr1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.10 } },
  mega_total_support_35: { id:'mega_total_support_35', name:'РњРµРіР°-СЃС‚РµРє С‚РѕС‚Р°Р»СЊРЅРѕР№ РїРѕРґРґРµСЂР¶РєРё',
    substances:['nac','tudca','milk_thistle','omega3','coq10','magnesium','telmi','aspirin','berberine','vitamin_d3','zinc_sup','selenium_sup','ashwagandha','taurine_sup','alpha_lipoic'],
    coverage:{ ms1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, ms2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, ms3:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','cv4','hem2','hem1'], k:0.30, q:'B' }, ms4:{ id:'telmi', name:'РўРµР»РјРёСЃР°СЂС‚Р°РЅ', targets:['cv3','ren1','ren3'], k:0.50, q:'A' }, ms5:{ id:'magnesium', name:'Mg', targets:['cv5','cns1','hem4'], k:0.35, q:'B' }, ms6:{ id:'berberine', name:'Р‘РµСЂР±РµСЂРёРЅ', targets:['hem2'], k:0.40, q:'B' } },
    organCoverage:['cardio','hepatic','renal','cns','hematologic'], totalK:{ cardio:0.68, hepatic:0.61, renal:0.45, cns:0.44, hematologic:0.64 } },
  total_health_optimization_stack: { id:'total_health_optimization_stack', name:'РўРѕС‚Р°Р»СЊРЅР°СЏ РѕРїС‚РёРјРёР·Р°С†РёСЏ',
    substances:['omega3','coq10','magnesium','alpha_lipoic','vitamin_d3','ashwagandha'],
    coverage:{ to1:{ id:'omega3', name:'РћРјРµРіР°-3', targets:['cv2','cv4','hem2'], k:0.30, q:'B' }, to2:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' }, to3:{ id:'magnesium', name:'Mg', targets:['cv5','cns1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic','cns'], totalK:{ cardio:0.60, hematologic:0.30, cns:0.44 } },
  allergy_stack: { id:'allergy_stack', name:'РџСЂРѕС‚РёРІРѕР°Р»Р»РµСЂРіРёС‡РµСЃРєРёР№',
    substances:['quercetin','bromelain','vitamin_c','msm','nac'],
    coverage:{ al1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.40 } },
};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 4. РњР•РўРљР 28 РњР•РҐРђРќРР—РњРћР’ РўР— (РґР»СЏ UI-РєР°СЂС‚РѕС‡РµРє)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
export const TZ_MECH_LABELS: Record<string, string> = {
  cv1: 'РњРёРѕРєР°СЂРґРёР°Р»СЊРЅРѕРµ СЂРµРјРѕРґРµР»РёСЂРѕРІР°РЅРёРµ / С„РёР±СЂРѕР· / РіРёРїРµСЂС‚СЂРѕС„РёСЏ',
  cv2: 'Р”РёСЃР»РёРїРёРґРµРјРёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  cv3: 'Р—Р°РґРµСЂР¶РєР° РЅР°С‚СЂРёСЏ Рё РІРѕРґС‹ / РіРµРјРѕРґРёРЅР°РјРёС‡РµСЃРєР°СЏ РїРµСЂРµРіСЂСѓР·РєР°',
  cv4: 'РџСЂРѕС‚СЂРѕРјР±РѕС‚РёС‡РµСЃРєРёР№ / РіРёРїРµСЂРІСЏР·РєРѕСЃС‚РЅС‹Р№ РјРµС…Р°РЅРёР·Рј',
  cv5: 'РђСЂРёС‚РјРѕРіРµРЅРЅС‹Р№ / СЌР»РµРєС‚СЂРѕС„РёР·РёРѕР»РѕРіРёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  liv1: 'Р“РµРїР°С‚РѕС†РµР»Р»СЋР»СЏСЂРЅР°СЏ С‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ',
  liv2: 'РҐРѕР»РµСЃС‚Р°С‚РёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  liv3: 'РЎРѕСЃСѓРґРёСЃС‚Рѕ-РїСЂРѕР»РёС„РµСЂР°С‚РёРІРЅС‹Р№ / РїСЂРµРЅРµРѕРїР»Р°СЃС‚РёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  ren1: 'Р“РµРјРѕРґРёРЅР°РјРёС‡РµСЃРєРѕРµ РЅРµС„СЂРѕРїРѕРІСЂРµР¶РґРµРЅРёРµ',
  ren2: 'Р“РёРїРµСЂС„РёР»СЊС‚СЂР°С†РёРѕРЅРЅРѕРµ / РєР»СѓР±РѕС‡РєРѕРІРѕРµ РїРµСЂРµРЅР°РїСЂСЏР¶РµРЅРёРµ',
  ren3: 'Р“Р»РѕРјРµСЂСѓР»СЏСЂРЅРѕ-РїСЂРѕС‚РµРёРЅСѓСЂРёС‡РµСЃРєРѕРµ РїРѕРІСЂРµР¶РґРµРЅРёРµ',
  ren4: 'Р’РѕРґРЅРѕ-СЌР»РµРєС‚СЂРѕР»РёС‚РЅС‹Р№ РјРµС…Р°РЅРёР·Рј',
  cns1: 'РќРµР№СЂРѕРјРµРґРёР°С‚РѕСЂРЅР°СЏ РґРёР·СЂРµРіСѓР»СЏС†РёСЏ',
  cns2: 'РћРєСЃРёРґР°С‚РёРІРЅС‹Р№ СЃС‚СЂРµСЃСЃ / РјРёС‚РѕС…РѕРЅРґСЂРёР°Р»СЊРЅР°СЏ РґРёСЃС„СѓРЅРєС†РёСЏ',
  cns3: 'РђРїРѕРїС‚РѕР· / РЅРµР№СЂРѕРґРµРіРµРЅРµСЂР°С‚РёРІРЅС‹Р№ РјРµС…Р°РЅРёР·Рј',
  cns4: 'РќРµР№СЂРѕСЌРЅРґРѕРєСЂРёРЅРЅР°СЏ РґРёР·СЂРµРіСѓР»СЏС†РёСЏ',
  cns5: 'РќРµР№СЂРѕРіР»СЋРєРѕРїРµРЅРёСЏ / СЌРЅРµСЂРіРµС‚РёС‡РµСЃРєРёР№ РґРµС„РёС†РёС‚ РЅРµР№СЂРѕРЅРѕРІ',
  cns6: 'Р’РЅСѓС‚СЂРёС‡РµСЂРµРїРЅР°СЏ РіРёРїРµСЂС‚РµРЅР·РёСЏ / РєРѕРјРїСЂРµСЃСЃРёРѕРЅРЅРѕ-РЅРµР№СЂРѕРїР°С‚РёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  rep1: 'РЎСѓРїСЂРµСЃСЃРёСЏ GnRH/LH/FSH',
  rep2: 'РЎРЅРёР¶РµРЅРёРµ РёРЅС‚СЂР°С‚РµСЃС‚РёРєСѓР»СЏСЂРЅРѕРіРѕ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅР°',
  rep3: 'РќР°СЂСѓС€РµРЅРёРµ СЃРїРµСЂРјР°С‚РѕРіРµРЅРµР·Р°',
  rep4: 'Р­СЃС‚СЂРѕРіРµРЅРЅС‹Р№ СЃРґРІРёРі / Р°СЂРѕРјР°С‚РёР·Р°С†РёСЏ',
  rep5: 'РџРѕСЃС‚С†РёРєР»РѕРІР°СЏ СЃСѓРїСЂРµСЃСЃРёСЏ / РІС‚РѕСЂРёС‡РЅС‹Р№ РіРёРїРѕРіРѕРЅР°РґРёР·Рј',
  hem1: 'Р­СЂРёС‚СЂРѕРїРѕСЌР· / СЌСЂРёС‚СЂРѕС†РёС‚РѕР·',
  hem2: 'РРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ / РіРёРїРµСЂРіР»РёРєРµРјРёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  hem3: 'Р“РёРїРѕРіР»РёРєРµРјРёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  hem4: 'Р“РёРїРѕРєР°Р»РёРµРјРёС‡РµСЃРєРёР№ РјРµС…Р°РЅРёР·Рј',
  hem5: 'Р’РѕРґРЅРѕ-СЌР»РµРєС‚СЂРѕР»РёС‚РЅС‹Р№ СЃРґРІРёРі / РѕС‚РµС‡РЅС‹Р№ РјРµС…Р°РЅРёР·Рј',
};

export const TZ_SYSTEM_LABELS: Record<string, string> = {
  cardio: 'РЎРµСЂРґРµС‡РЅРѕ-СЃРѕСЃСѓРґРёСЃС‚Р°СЏ СЃРёСЃС‚РµРјР°',
  hepatic: 'РџРµС‡РµРЅСЊ',
  renal: 'РџРѕС‡РєРё',
  cns: 'Р¦РµРЅС‚СЂР°Р»СЊРЅР°СЏ РЅРµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°',
  reproductive: 'Р РµРїСЂРѕРґСѓРєС‚РёРІРЅР°СЏ СЃРёСЃС‚РµРјР° / HPG-РѕСЃСЊ',
  hematologic: 'Р“РµРјР°С‚РѕР»РѕРіРѕ-РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ Р±Р»РѕРє',
};

export const TZ_SYSTEM_ICONS: Record<string, string> = {
  cardio: 'вќ¤пёЏ', hepatic: 'рџ«Ѓ', renal: 'рџ«',
  cns: 'рџ§ ', reproductive: 'рџ§¬', hematologic: 'рџ©ё',
};

// в”Ђв”Ђ Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Рµ С„СѓРЅРєС†РёРё в”Ђв”Ђ
export function getTzDrugEntry(drugId: string): TzDrugEntry | undefined {
  return DRUG_DB[drugId];
}

export function getTzSupportEntries(drugId: string): TzSupportEntry[] | undefined {
  return SUPPLEMENTS_DB[drugId] || null;
}

export function getTzMechLabel(mechId: string): string {
  return TZ_MECH_LABELS[mechId] || mechId;
}

export function getTzSystemLabel(sysId: string): string {
  return TZ_SYSTEM_LABELS[sysId] || sysId;
}

export function getDrugTzMechanisms(drugId: string): { organId: string; mechId: string; weight: number }[] {
  const entry = DRUG_DB[drugId];
  if (!entry) return [];
  const result: { organId: string; mechId: string; weight: number }[] = [];
  for (const [organId, mechs] of Object.entries(entry.organMechanisms)) {
    for (const mechId of mechs) {
      result.push({ organId, mechId, weight: entry.mechanismWeights[mechId] || 1 });
    }
  }
  return result;
}

export function formatTzDrugMapping(drugId: string): string {
  const mechs = getDrugTzMechanisms(drugId);
  if (!mechs.length) return 'РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РўР—';
  return mechs.map(m => `${TZ_SYSTEM_LABELS[m.organId]?.slice(0,15) || m.organId}: ${TZ_MECH_LABELS[m.mechId]?.slice(0,30) || m.mechId} (w=${m.weight})`).join('; ');
}

export function getSystemMechsForDrug(drugId: string, organId: string): { mechId: string; label: string; weight: number }[] {
  const entry = DRUG_DB[drugId];
  if (!entry?.organMechanisms[organId]) return [];
  return entry.organMechanisms[organId].map(m => ({
    mechId: m,
    label: TZ_MECH_LABELS[m] || m,
    weight: entry.mechanismWeights[m] || 1,
  }));
}

// в”Ђв”Ђ Р”Р»СЏ РєР°СЂС‚РѕС‡РµРє РїРѕРґРґРµСЂР¶РєРё: С‡РёС‚Р°РµС‚ SUPPORT_DB в”Ђв”Ђ
export interface TzSupportDisplay {
  organId: string;
  organLabel: string;
  mechId: string;
  mechLabel: string;
  k: number;
  q: string;
  source: string;
}
export function getSupportTzDisplay(drugId: string): TzSupportDisplay[] {
  const id = drugId.toLowerCase();
  const entries = SUPPLEMENTS_DB[id] || SUPPLEMENTS_DB[id.toUpperCase()] || PHARMACY_DB[id] || PHARMACY_DB[id.toUpperCase()];
  if (!entries?.length) return [];
  return entries.map(e => ({
    organId: e.organId,
    organLabel: TZ_SYSTEM_LABELS[e.organId] || e.organId,
    mechId: e.mechId,
    mechLabel: TZ_MECH_LABELS[e.mechId] || e.mechId,
    k: e.k,
    q: e.q,
    source: e.source,
  }));
}
