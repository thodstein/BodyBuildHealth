// SUPPORT DB — unified catalog with all drugs including pharmacy
import { SUPPLEMENTS_DB } from './supplements';
import { PHARMACY_DB } from './pharmacy-db';

// ── Типы ──
export interface TzDrugEntry {
  name: string;
  class: 'aas' | 'gh' | 'insulin' | 'glp1' | 'pct' | 'sarm';
  form: 'inject' | 'oral';
  targetOrgans: string[];
  organMechanisms: Record<string, string[]>;
  mechanismWeights: Record<string, number>;
  doseModifier: number;
  pk?: { halfLifeHours?: number };
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
  targets: string[];   // mechIds из 28 ТЗ
  k: number;            // вклад в покрытие
  q: 'A' | 'B' | 'C';
}

export interface TzStackEntry {
  id: string;
  name: string;
  substances: string[];
  coverage: Record<string, TzStackSubstance>;  // organId → вещество
  organCoverage: string[];
  totalK: Record<string, number>;  // organId → суммарный k
}

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 1. БД ОСНОВНЫХ ПРЕПАРАТОВ (ААС/GH/Инсулин)
// ────────────────────────────────────────────────────────
// targetOrgans — только из 6 систем ТЗ
// organMechanisms — только из 28 механизмов ТЗ
// mechanismWeights — уровень 1-4 (1=вторичный, 2=умеренный, 3=ведущий, 4=высокий)
// doseModifier — множитель дозы (1.0 стандарт, 1.3-1.5 для 17α-алкил)

export const DRUG_DB: Record<string, TzDrugEntry> = {
  // ── ААС инъекционные (17) ──
  test_prop: { name:'Тестостерон пропионат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3, cv3:2, cv4:2, liv2:2, cns2:2, cns4:2, rep3:2, rep4:2, rep5:2, hem2:2, ren1:2, ren2:2}, pk:{halfLifeHours:72}, doseModifier:1.0 },
  test_enan: { name:'Тестостерон энантат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3, cv3:2, cv4:2, liv2:2, cns2:2, cns4:2, rep3:2, rep4:2, rep5:2, hem2:2, ren1:2, ren2:2}, pk:{halfLifeHours:168}, doseModifier:1.0 },
  test_cyp: { name:'Тестостерон ципионат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3, cv3:2, cv4:2, liv2:2, cns2:2, cns4:2, rep3:2, rep4:2, rep5:2, hem2:2, ren1:2, ren2:2}, pk:{halfLifeHours:192}, doseModifier:1.0 },
  test_undec: { name:'Тестостерон ундеканоат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, rep1:4, rep2:4, liv1:3, hem1:3, cns1:3, cv3:2, cv4:2, liv2:2, cns2:2, cns4:2, rep3:2, rep4:2, rep5:2, hem2:2, ren1:2, ren2:2}, pk:{halfLifeHours:576}, doseModifier:1.0 },
  tren_acet: { name:'Тренболон ацетат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3, cv3:2, cv4:2, liv3:2, cns3:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:2, ren4:2}, pk:{halfLifeHours:72}, doseModifier:1.5 },
  tren_enan: { name:'Тренболон энантат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3, cv3:2, cv4:2, liv3:2, cns3:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:2, ren4:2}, pk:{halfLifeHours:168}, doseModifier:1.5 },
  tren_hex: { name:'Тренболон гексагидробензилкарбонат', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv3'], cns:['cns1','cns2','cns3','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:4, cns1:4, cns2:3, rep1:4, rep2:4, hem1:3, liv1:3, cv3:2, cv4:2, liv3:2, cns3:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:2, ren4:2}, pk:{halfLifeHours:192}, doseModifier:1.5 },
  npp: { name:'Нандролон фенилпропионат', class:'aas', form:'inject',
    targetOrgans:['cardio','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv2:3, rep1:3, rep2:3, hem1:3, cns1:2, cv4:2, cv3:1, cns2:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:1, ren2:1}, pk:{halfLifeHours:108}, doseModifier:0.8 },
  deca: { name:'Нандролон деканоат', class:'aas', form:'inject',
    targetOrgans:['cardio','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{cv2:3, rep1:3, rep2:3, hem1:3, cns1:2, cv4:2, cv3:1, cns2:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:1, ren2:1}, pk:{halfLifeHours:384}, doseModifier:0.8 },
  trest_acet: { name:'Трестолон ацетат (МЕНТ)', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:3, rep1:4, rep2:4, rep4:3, hem1:3, liv1:2, cv3:2, liv2:2, cns1:2, cns2:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:2, ren4:2}, pk:{halfLifeHours:72}, doseModifier:1.2 },
  trest_enan: { name:'Трестолон энантат (МЕНТ)', class:'aas', form:'inject',
    targetOrgans:['cardio','hepatic','cns','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], cns:['cns1','cns2','cns4'], reproductive:['rep1','rep2','rep3','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren1','ren4'] },
    mechanismWeights:{cv1:4, cv2:4, cv5:3, rep1:4, rep2:4, rep4:3, hem1:3, liv1:2, cv3:2, liv2:2, cns1:2, cns2:2, cns4:2, rep3:2, rep5:2, hem2:2, ren1:2, ren4:2}, pk:{halfLifeHours:168}, doseModifier:1.2 },
  dhb: { name:'Дигидроболденон (DHB)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{hem1:4, cv2:3, hem2:2, cv4:2, liv1:2}, pk:{halfLifeHours:72}, doseModifier:1.1 },
  dhb_acetate: { name:'Дигидроболденон ацетат (DHB-A)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{hem1:4, cv2:3, hem2:2, cv4:2, liv1:2}, pk:{halfLifeHours:48}, doseModifier:1.1 },
  dhb_propionate: { name:'Дигидроболденон пропионат (DHB-P)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{hem1:4, cv2:3, hem2:2, cv4:2, liv1:2}, pk:{halfLifeHours:108}, doseModifier:1.1 },
  dhb_cyp: { name:'Дигидроболденон ципионат (DHB-C)', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','hepatic'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], hepatic:['liv1'] },
    mechanismWeights:{hem1:4, cv2:3, hem2:2, cv4:2, liv1:2}, pk:{halfLifeHours:336}, doseModifier:1.1 },
  bold_undec: { name:'Болденон ундециленат', class:'aas', form:'inject',
    targetOrgans:['cardio','hematologic','renal'],
    organMechanisms:{ cardio:['cv2','cv4'], hematologic:['hem1','hem2'], renal:['ren1','ren2'] },
    mechanismWeights:{hem1:4, cv2:3, hem2:2, cv4:2, cv3:1, cns2:1, rep1:2, rep2:2, rep5:1, ren2:1, ren1:1}, pk:{halfLifeHours:420}, doseModifier:0.9 },
  prim_enan: { name:'Метенолон энантат (Примоболан)', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{rep1:3, rep2:3, cv2:2, hem2:2, cv3:1, rep3:1, hem1:1, ren1:1, cns1:1, rep5:1}, pk:{halfLifeHours:240}, doseModifier:0.7 },
  drostanolone_prop: { name:'Дростанолон пропионат (Мастерон)', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{rep1:3, rep2:3, rep4:2, cv2:2, hem1:2, cv3:1, cv4:1, rep3:1, rep5:1, hem2:1, cns1:1}, pk:{halfLifeHours:96}, doseModifier:1.0 },
  drostanolone_enan: { name:'Дростанолон энантат', class:'aas', form:'inject',
    targetOrgans:['cardio','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{rep1:3, rep2:3, rep4:2, cv2:2, hem1:2, cv3:1, cv4:1, rep3:1, rep5:1, hem2:1, cns1:1}, pk:{halfLifeHours:216}, doseModifier:1.0 },

  // ── ААС пероральные 17α-алкилированные (7) ──
  methand: { name:'Метандиенон', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv5'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren4'] },
    mechanismWeights:{liv1:4, cv2:4, cv1:3, cv5:3, rep1:3, rep2:3, hem1:3, rep4:2, cv3:2, cv4:2, liv2:3, rep3:2, rep5:2, hem2:2, ren4:2, cns1:2}, pk:{halfLifeHours:5}, doseModifier:1.5 },
  oxan: { name:'Оксандролон', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{liv1:4, liv2:3, cv2:3, rep1:3, rep2:3, hem2:2, cv3:1, cv4:1, rep3:2, rep5:2, cns1:1, hem1:1}, pk:{halfLifeHours:10}, doseModifier:1.3 },
  stan: { name:'Станозолол', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{liv1:4, liv2:3, cv2:3, hem1:3, rep1:3, rep2:3, cv3:1, cv4:2, rep3:2, rep5:2, hem2:1, cns1:1}, pk:{halfLifeHours:9}, doseModifier:1.4 },
  trena: { name:'Туринабол', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem2'] },
    mechanismWeights:{liv1:4, liv2:3, cv2:3, rep1:3, rep2:3, rep5:2, cns1:2, hem1:2, hem2:1}, pk:{halfLifeHours:16}, doseModifier:1.4 },
  halo: { name:'Хлордегидрометилтестостерон', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1'] },
    mechanismWeights:{liv1:4, cv2:4, hem1:3, liv2:3, rep1:3, rep2:3, cv3:1, cv4:2, rep3:2, rep5:2, cns1:3}, pk:{halfLifeHours:9}, doseModifier:1.5 },
  superdrol: { name:'Метилдростанолон', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep5'], hematologic:['hem1','hem2'] },
    mechanismWeights:{liv1:4, cv2:4, hem1:3, liv2:3, rep1:3, rep2:3, cv4:2, cv3:1, rep3:2, rep5:2, hem2:1, cns1:1}, pk:{halfLifeHours:8}, doseModifier:1.5 },
  anadrol: { name:'Оксиметолон', class:'aas', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','hematologic','renal'],
    organMechanisms:{ cardio:['cv1','cv2','cv3','cv4','cv5'], hepatic:['liv1','liv2'], reproductive:['rep1','rep2','rep4','rep5'], hematologic:['hem1','hem2'], renal:['ren4'] },
    mechanismWeights:{hem1:4, liv1:4, cv2:4, cv1:3, cv5:3, rep1:3, rep2:3, cv4:3, rep4:2, cv3:2, liv2:3, hem2:2, rep3:2, rep5:2, ren4:2, cns1:2}, pk:{halfLifeHours:9}, doseModifier:1.5 },

  // ── DHT производные (1) ──
  mesterolone: { name:'Местеролон (Провирон)', class:'aas', form:'oral',
    targetOrgans:['reproductive','cardio'],
    organMechanisms:{ reproductive:['rep1','rep2','rep4'], cardio:['cv2'] },
    mechanismWeights:{rep1:3, rep2:3, rep4:2, cv2:1, cv3:1, rep3:1, rep5:1, hem1:1}, doseModifier:0.6 },

  // ── SARMs (4) ──
  ostarine: { name:'Ostarine MK-2866', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{rep1:2, rep2:2, cv2:2, liv1:2, cv3:1, rep3:1, rep5:1, hem1:1, cns1:1}, doseModifier:1.0 },
  lgd: { name:'Ligandrol LGD-4033', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{rep1:3, rep2:3, cv2:2, liv1:2, cv3:1, rep3:1, rep5:1, hem1:1, cns1:1}, doseModifier:1.0 },
  rad140: { name:'RAD-140', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive','cns'],
    organMechanisms:{ cardio:['cv2'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'], cns:['cns1'] },
    mechanismWeights:{rep1:3, rep2:3, cns1:2, cv2:2, liv1:2, cv3:1, rep3:1, rep5:1, hem1:1, cns2:1}, doseModifier:1.0 },
  s23: { name:'S-23', class:'sarm', form:'oral',
    targetOrgans:['cardio','hepatic','reproductive'],
    organMechanisms:{ cardio:['cv2','cv4'], hepatic:['liv1'], reproductive:['rep1','rep2','rep5'] },
    mechanismWeights:{rep1:3, rep2:3, cv2:3, hem1:2, liv1:2, cv3:1, cv4:1, rep3:1, rep5:1, cns1:1}, doseModifier:1.0 },

  // ── GH / Пептиды (25) ──
  cjc1295: { name:'CJC-1295', class:'gh', form:'inject',
    targetOrgans:['cardio','renal','cns','hematologic'],
    organMechanisms:{ cardio:['cv3'], renal:['ren1','ren4'], cns:['cns5','cns6'], hematologic:['hem2'] },
    mechanismWeights:{cns6:2, ren1:2, hem2:2, cv3:1, ren4:1, cns5:1}, doseModifier:1.0 },
  ghrp6: { name:'GHRP-6', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{hem2:2, cns5:1, ren4:1}, doseModifier:1.0 },
  ipamorelin: { name:'Ipamorelin', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{hem2:2, cns5:1, ren4:1}, doseModifier:0.8 },
  ghrp2: { name:'GHRP-2', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'], renal:['ren4'] },
    mechanismWeights:{hem2:2, cns5:1, ren4:1}, doseModifier:1.0 },
  sermorelin: { name:'Sermorelin', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2'] },
    mechanismWeights:{hem2:2, cns5:1}, doseModifier:0.8 },
  mk677: { name:'Ibutamoren MK-677', class:'gh', form:'oral',
    targetOrgans:['cardio','renal','cns','hematologic'],
    organMechanisms:{ cardio:['cv3'], renal:['ren1','ren4'], cns:['cns5','cns6'], hematologic:['hem2'] },
    mechanismWeights:{cns6:2, ren1:2, hem2:2, cv3:1, ren4:1, cns5:1}, doseModifier:0.9 },
  igf1_lr3: { name:'IGF-1 LR3', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem2'] },
    mechanismWeights:{hem3:4, cns5:3, hem2:2}, doseModifier:1.2 },
  igf1_des: { name:'IGF-1 DES', class:'gh', form:'inject',
    targetOrgans:['cns','hematologic'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem2'] },
    mechanismWeights:{hem3:4, cns5:2, hem2:2}, doseModifier:1.2 },
  mgf: { name:'Механо-Фактор (МГФ)', class:'gh', form:'inject',
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
  semax: { name:'Семакс', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{cns1:1}, doseModifier:0.0 },
  selank: { name:'Селанк', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{cns1:1}, doseModifier:0.0 },
  epitalon: { name:'Эпиталон', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  dsip: { name:'DSIP', class:'gh', form:'inject',
    targetOrgans:['cns'], organMechanisms:{ cns:['cns1'] }, mechanismWeights:{cns1:1}, doseModifier:0.0 },
  mots_c: { name:'MOTS-C', class:'gh', form:'inject',
    targetOrgans:['hematologic'], organMechanisms:{ hematologic:['hem2'] }, mechanismWeights:{hem2:1}, doseModifier:0.0 },
  hgh_frag: { name:'HGH Fragment 176-191', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  aod9604: { name:'AOD-9604', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  thymosin_a1: { name:'Тимозин альфа-1', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  gonadorelin: { name:'Гонадорелин', class:'gh', form:'inject',
    targetOrgans:['reproductive'], organMechanisms:{ reproductive:['rep1'] }, mechanismWeights:{rep1:2}, doseModifier:0.0 },
  melanotan2: { name:'Меланотан II', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },
  foxo4_dri: { name:'FOXO4-DRI', class:'gh', form:'inject',
    targetOrgans:[], organMechanisms:{}, mechanismWeights:{}, doseModifier:0.0 },

  // ── GLP-1 агонисты (2) ──
  semaglutide: { name:'Семаглутид', class:'glp1', form:'inject',
    targetOrgans:['hematologic','cardio','cns'],
    organMechanisms:{ hematologic:['hem2','hem3'], cardio:['cv3'], cns:['cns5'] },
    mechanismWeights:{hem3:3, hem2:2, cv3:1, cns5:1}, doseModifier:0.5 },
  tirzepatide: { name:'Тирзепатид', class:'glp1', form:'inject',
    targetOrgans:['hematologic','cardio','cns'],
    organMechanisms:{ hematologic:['hem2','hem3'], cardio:['cv3'], cns:['cns5'] },
    mechanismWeights:{hem3:3, hem2:2, cv3:1, cns5:1}, doseModifier:0.5 },

  // ── Инсулины (4) ──
  ins_short: { name:'Инсулин короткий', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem4','hem5'], cardio:['cv3','cv5'], renal:['ren4'] },
    mechanismWeights:{hem3:4, cns5:4, hem4:3, cv5:3, hem5:2, cv3:2, ren4:2}, doseModifier:1.0 },
  ins_long: { name:'Инсулин длинный', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2','hem3','hem5'], cardio:['cv3'], renal:['ren4'] },
    mechanismWeights:{hem3:3, cns5:3, hem2:3, hem5:2, cv3:2, ren4:2}, doseModifier:0.8 },
  ins_aspart: { name:'Инсулин аспарт', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem3','hem4','hem5'], cardio:['cv3','cv5'], renal:['ren4'] },
    mechanismWeights:{hem3:4, cns5:4, hem4:3, cv5:3, hem5:2, cv3:2, ren4:2}, doseModifier:1.0 },
  ins_detemir: { name:'Инсулин детемир', class:'insulin', form:'inject',
    targetOrgans:['cns','hematologic','cardio','renal'],
    organMechanisms:{ cns:['cns5'], hematologic:['hem2','hem3','hem5'], cardio:['cv3'], renal:['ren4'] },
    mechanismWeights:{hem3:3, cns5:3, hem2:3, hem5:2, cv3:2, ren4:2}, doseModifier:0.8 },
};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 2. ПОЛНАЯ БД ПРЕПАРАТОВ ПОДДЕРЖКИ (328 веществ × ТЗ-механизмы)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// k — 0..1 коэффициент снижения механизма
// q → A (прямые данные) / B (суррогатные маркеры) / C (правдоподобность)
// source — источник обоснования
// Запрещено: generic-строки, нереалистичные k, механизмы не из ТЗ
// [] — вещество не имеет прямого маппинга на 28 механизмов ТЗ

export const SUPPORT_DB: Record<string, TzSupportEntry[]> = {};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 3. БД СТЕКОВ (ТЗ-механизмы)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// coverage → какие механизмы ТЗ покрывает стек
// substances — список ID веществ в стеке
// totalK → суммарный k по органу

export const STACK_DB: Record<string, TzStackEntry> = {
  hepatoprotection_stack: { id:'hepatoprotection_stack', name:'Гепатопротекция: глутатион + ER-стресс + мембраны',
    substances:['nac','tudca','milk_thistle','alpha_lipoic'],
    coverage:{ h1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, h2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  cardioprotection_stack: { id:'cardioprotection_stack', name:'Кардиопротекция: липиды + энергия + электролиты',
    substances:['omega3','magnesium','coq10','taurine_sup'],
    coverage:{ c1:{ id:'omega3', name:'Омега-3', targets:['cv2','cv4'], k:0.30, q:'B' }, c2:{ id:'magnesium', name:'Магний', targets:['cv5'], k:0.35, q:'B' } },
    organCoverage:['cardio'], totalK:{ cardio:0.52 } },
  nephroprotection_stack: { id:'nephroprotection_stack', name:'Нефропротекция',
    substances:['telmi','omega3','nac'],
    coverage:{ n1:{ id:'telmi', name:'Телмисартан', targets:['ren1','ren3'], k:0.45, q:'A' }, n2:{ id:'omega3', name:'Омега-3', targets:['ren1'], k:0.15, q:'C' } },
    organCoverage:['renal'], totalK:{ renal:0.53 } },
  neuroprotection_stack: { id:'neuroprotection_stack', name:'Нейропротекция',
    substances:['alpha_lipoic','magnesium','ashwagandha','coq10'],
    coverage:{ ns1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2'], k:0.30, q:'C' }, ns2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.44 } },
  fibrinolytic_stack: { id:'fibrinolytic_stack', name:'Фибринолитический',
    substances:['aspirin','omega3'],
    coverage:{ f1:{ id:'aspirin', name:'Аспирин', targets:['cv4'], k:0.35, q:'B' }, f2:{ id:'omega3', name:'Омега-3', targets:['hem1'], k:0.15, q:'C' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.32 } },
  hormonal_pct_stack: { id:'hormonal_pct_stack', name:'Гормональная поддержка HPTA',
    substances:['hcg','tamoxifen','enclomiphene'],
    coverage:{ r1:{ id:'hcg', name:'ХГЧ', targets:['rep1','rep2','rep3','rep5'], k:0.50, q:'A' }, r2:{ id:'tamoxifen', name:'Тамоксифен', targets:['rep4','rep5'], k:0.40, q:'A' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.70 } },
  glycemic_control_stack: { id:'glycemic_control_stack', name:'Метаболический контроль',
    substances:['berberine','alpha_lipoic','omega3'],
    coverage:{ g1:{ id:'berberine', name:'Берберин', targets:['hem2'], k:0.40, q:'B' }, g2:{ id:'alpha_lipoic', name:'АЛЬК', targets:['hem2'], k:0.20, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.52 } },
  adaptogenic_stack: { id:'adaptogenic_stack', name:'Адаптогенный',
    substances:['ashwagandha','magnesium','rhodiola','ginseng_sup'],
    coverage:{ a1:{ id:'ashwagandha', name:'Ашваганда', targets:['cns1','cns4'], k:0.15, q:'C' }, a2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  articular_stack: { id:'articular_stack', name:'Суставной',
    substances:['collagen','msm','glucosamine','vitamin_d3'],
    coverage:{ ac1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.10 } },
  immune_stack: { id:'immune_stack', name:'Иммунный',
    substances:['vitamin_d3','zinc_sup','probiotics_sup'],
    coverage:{ i1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' }, i2:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['hematologic','reproductive'], totalK:{ hematologic:0.10, reproductive:0.15 } },
  mitochondrial_stack: { id:'mitochondrial_stack', name:'Митохондриальный',
    substances:['coq10','alpha_lipoic','shilajit'],
    coverage:{ m1:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' }, m2:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  nootropic_stack: { id:'nootropic_stack', name:'Ноотропный',
    substances:['alpha_lipoic','coq10','vitamin_b6','vitamin_b12'],
    coverage:{ no1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2'], k:0.30, q:'C' }, no2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.48 } },
  anti_stress_stack: { id:'anti_stress_stack', name:'Антистрессовый',
    substances:['ashwagandha','magnesium'],
    coverage:{ as1:{ id:'ashwagandha', name:'Ашваганда', targets:['cns1','cns4'], k:0.15, q:'C' }, as2:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  bone_stack: { id:'bone_stack', name:'Костный',
    substances:['vitamin_d3','vitamin_k2','magnesium','boron'],
    coverage:{ b1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' }, b2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' } },
    organCoverage:['hematologic','reproductive'], totalK:{ hematologic:0.10, reproductive:0.10 } },
  gi_microbiome_stack: { id:'gi_microbiome_stack', name:'ЖКТ-протекция',
    substances:['probiotics_sup','glutamine','zinc_sup'],
    coverage:{ g1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  antioxidant_network_stack: { id:'antioxidant_network_stack', name:'Антиоксидантный',
    substances:['alpha_lipoic','coq10','selenium_sup','vitamin_b6'],
    coverage:{ ao1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' }, ao2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  sleep_stack: { id:'sleep_stack', name:'Сон',
    substances:['magnesium','ashwagandha','taurine_sup'],
    coverage:{ sl1:{ id:'magnesium', name:'Mg', targets:['cns1'], k:0.20, q:'C' }, sl2:{ id:'ashwagandha', name:'Ашваганда', targets:['cns1','cns4'], k:0.15, q:'C' } },
    organCoverage:['cns'], totalK:{ cns:0.32 } },
  thyroid_stack: { id:'thyroid_stack', name:'Тиреоидная поддержка',
    substances:['selenium_sup','zinc_sup','ashwagandha'],
    coverage:{ th1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, th2:{ id:'ashwagandha', name:'Ашваганда', targets:['cns4'], k:0.15, q:'C' } },
    organCoverage:['reproductive','cns'], totalK:{ reproductive:0.15, cns:0.15 } },
  endothelial_no_stack: { id:'endothelial_no_stack', name:'Сосудистая поддержка',
    substances:['omega3','coq10','taurine_sup'],
    coverage:{ en1:{ id:'omega3', name:'Омега-3', targets:['cv2','cv4'], k:0.30, q:'B' }, en2:{ id:'coq10', name:'CoQ10', targets:['cv2','cv5'], k:0.20, q:'C' } },
    organCoverage:['cardio'], totalK:{ cardio:0.44 } },
  anti_inflammatory_stack: { id:'anti_inflammatory_stack', name:'Противовоспалительный',
    substances:['omega3','curcumin_sup','coq10'],
    coverage:{ ai1:{ id:'omega3', name:'Омега-3', targets:['cv2','hem2'], k:0.30, q:'B' }, ai2:{ id:'curcumin_sup', name:'Куркумин', targets:['cv2','cns2','hem2'], k:0.20, q:'C' } },
    organCoverage:['cardio','hematologic','cns'], totalK:{ cardio:0.44, hematologic:0.44, cns:0.20 } },
  skin_collagen_stack: { id:'skin_collagen_stack', name:'Кожа и коллаген',
    substances:['zinc_sup','selenium_sup','vitamin_d3'],
    coverage:{ sk1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  detox_stack: { id:'detox_stack', name:'Детоксикация',
    substances:['nac','milk_thistle','alpha_lipoic'],
    coverage:{ dt1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, dt2:{ id:'milk_thistle', name:'Силимарин', targets:['liv1'], k:0.25, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.55 } },
  post_cycle_recovery_stack: { id:'post_cycle_recovery_stack', name:'PCT',
    substances:['hcg','tamoxifen','clomi','zinc_sup','ashwagandha'],
    coverage:{ pc1:{ id:'hcg', name:'ХГЧ', targets:['rep1','rep2','rep3','rep5'], k:0.50, q:'A' }, pc2:{ id:'tamoxifen', name:'Тамоксифен', targets:['rep4','rep5'], k:0.40, q:'A' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.70 } },
  hair_skin_nails_stack: { id:'hair_skin_nails_stack', name:'Волосы-кожа-ногти',
    substances:['zinc_sup','selenium_sup','vitamin_b6','biotin'],
    coverage:{ hs1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  detox_heavy_metals_stack: { id:'detox_heavy_metals_stack', name:'Детокс тяжелых металлов',
    substances:['alpha_lipoic','nac','selenium_sup','zinc_sup'],
    coverage:{ dh1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, dh2:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2'], k:0.30, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.40, cns:0.30 } },
  sleep_recovery_stack: { id:'sleep_recovery_stack', name:'Сон и восстановление',
    substances:['magnesium','ashwagandha','taurine_sup','glycine'],
    coverage:{ sr1:{ id:'magnesium', name:'Mg', targets:['cns1','cv5'], k:0.35, q:'B' }, sr2:{ id:'ashwagandha', name:'Ашваганда', targets:['cns1','cns4'], k:0.15, q:'C' } },
    organCoverage:['cns','cardio'], totalK:{ cns:0.44, cardio:0.35 } },
  nootropic_energy_stack: { id:'nootropic_energy_stack', name:'Ноотропный энергетик',
    substances:['alpha_lipoic','coq10','creatine','vitamin_b6','vitamin_b12'],
    coverage:{ ne1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' }, ne2:{ id:'coq10', name:'CoQ10', targets:['cns2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.44, hematologic:0.20 } },
  anti_catabolic_stack: { id:'anti_catabolic_stack', name:'Антикатаболический',
    substances:['omega3','vitamin_d3','taurine_sup'],
    coverage:{ ac1:{ id:'omega3', name:'Омега-3', targets:['hem2'], k:0.15, q:'C' }, ac2:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.24 } },
  blood_flow_no_stack: { id:'blood_flow_no_stack', name:'Кровоток и NO',
    substances:['omega3','taurine_sup','coq10'],
    coverage:{ bf1:{ id:'omega3', name:'Омега-3', targets:['cv2','cv4'], k:0.30, q:'B' }, bf2:{ id:'taurine_sup', name:'Таурин', targets:['cv5','cv3'], k:0.20, q:'C' } },
    organCoverage:['cardio'], totalK:{ cardio:0.44 } },
  insulin_sensitivity_stack: { id:'insulin_sensitivity_stack', name:'Инсулиновая чувствительность',
    substances:['berberine','alpha_lipoic','magnesium'],
    coverage:{ is1:{ id:'berberine', name:'Берберин', targets:['hem2'], k:0.40, q:'B' }, is2:{ id:'alpha_lipoic', name:'АЛЬК', targets:['hem2'], k:0.20, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.52 } },
  pancreas_liver_stack: { id:'pancreas_liver_stack', name:'Поджелудочная и печень',
    substances:['berberine','nac','alpha_lipoic','tudca','milk_thistle'],
    coverage:{ pl1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, pl2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, pl3:{ id:'berberine', name:'Берберин', targets:['hem2'], k:0.40, q:'B' } },
    organCoverage:['hepatic','hematologic'], totalK:{ hepatic:0.61, hematologic:0.40 } },
  iron_absorption_stack: { id:'iron_absorption_stack', name:'Повышение железа',
    substances:['lactoferrin','vitamin_c','zinc_sup'],
    coverage:{ ia1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.15 } },
  iron_b_complex_stack: { id:'iron_b_complex_stack', name:'B-комплекс+железо',
    substances:['vitamin_b6','vitamin_b12','folate','zinc_sup'],
    coverage:{ ib1:{ id:'vitamin_b6', name:'B6', targets:['cns1','hem1'], k:0.10, q:'C' }, ib2:{ id:'vitamin_b12', name:'B12', targets:['cns1'], k:0.10, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.20, hematologic:0.05 } },
  cholinergic_nootropic_stack: { id:'cholinergic_nootropic_stack', name:'Холинергический ноотроп',
    substances:['alpha_gpc','cdp_choline','huperzine_a'],
    coverage:{ cn1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.30, hematologic:0.20 } },
  fibrinolytic_lumbro_brome_stack: { id:'fibrinolytic_lumbro_brome_stack', name:'Фибринолиз: лумбро+броме',
    substances:['lumbrokinase','nattokinase','bromelain'],
    coverage:{ fl1:{ id:'aspirin', name:'Аспирин*', targets:['cv4','hem1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.20 } },
  fibrinolytic_quad_stack: { id:'fibrinolytic_quad_stack', name:'Фибринолитик квадро',
    substances:['serrapeptase','nattokinase','lumbrokinase','bromelain'],
    coverage:{ fq1:{ id:'aspirin', name:'Аспирин*', targets:['cv4','hem1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic'], totalK:{ cardio:0.35, hematologic:0.20 } },
  methylation_tmg_mthf_stack: { id:'methylation_tmg_mthf_stack', name:'Метилирование',
    substances:['tmg','folate','vitamin_b12','vitamin_b6','zinc_sup'],
    coverage:{ mt1:{ id:'folate', name:'Фолат', targets:['cns1'], k:0.10, q:'C' }, mt2:{ id:'vitamin_b12', name:'B12', targets:['cns1'], k:0.08, q:'C' } },
    organCoverage:['cns','reproductive'], totalK:{ cns:0.20, reproductive:0.15 } },
  hepatic_nac_udca_se_mo_stack: { id:'hepatic_nac_udca_se_mo_stack', name:'Гепатопротекция базовая: NAC+UDCA+Se+Mo',
    substances:['nac','tudca','selenium_sup','molybdenum'],
    coverage:{ hn1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hn2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  hepatic_nac_udca_tudca_stack: { id:'hepatic_nac_udca_tudca_stack', name:'Гепатопротекция усиленная',
    substances:['nac','tudca','udca'],
    coverage:{ hu1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hu2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.61 } },
  hepatic_extended_pc_stack: { id:'hepatic_extended_pc_stack', name:'Гепатокомплекс',
    substances:['nac','tudca','udca','phosphatidylcholine','alpha_lipoic'],
    coverage:{ he1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, he2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, he3:{ id:'phosphatidylcholine', name:'ФА', targets:['liv2'], k:0.15, q:'C' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.67 } },
  hepatic_max_stack: { id:'hepatic_max_stack', name:'Гепатокомплекс максимум',
    substances:['nac','tudca','udca','phosphatidylcholine','alpha_lipoic','milk_thistle'],
    coverage:{ hm1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, hm2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, hm3:{ id:'milk_thistle', name:'Силимарин', targets:['liv1'], k:0.25, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.71 } },
  libido_stack: { id:'libido_stack', name:'Либидо и эрекция',
    substances:['zinc_sup','boron','fadogia','tongkat_ali'],
    coverage:{ lb1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, lb2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' }, lb3:{ id:'fadogia', name:'Фадоджия', targets:['rep1'], k:0.10, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.33 } },
  libido_erectile_stack: { id:'libido_erectile_stack', name:'Либидо продвинутый',
    substances:['zinc_sup','boron','fadogia','tongkat_ali','macuna'],
    coverage:{ le1:{ id:'zinc_sup', name:'Zn', targets:['rep2'], k:0.15, q:'C' }, le2:{ id:'boron', name:'B', targets:['rep2'], k:0.10, q:'C' }, le3:{ id:'fadogia', name:'Фадоджия', targets:['rep1'], k:0.10, q:'C' } },
    organCoverage:['reproductive'], totalK:{ reproductive:0.33 } },
  mito_benfo_stack: { id:'mito_benfo_stack', name:'Митохондриальная защита',
    substances:['benfotiamine','alpha_lipoic','coq10','astaxanthin','pqq','vitamin_b12'],
    coverage:{ mb1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' }, mb2:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' } },
    organCoverage:['cns','hematologic','cardio'], totalK:{ cns:0.44, hematologic:0.20, cardio:0.15 } },
  membrane_ps_ump_pc_stack: { id:'membrane_ps_ump_pc_stack', name:'Мембранный ноотроп',
    substances:['phosphatidylserine','phosphatidylcholine','ump'],
    coverage:{ mp1:{ id:'phosphatidylcholine', name:'ФА', targets:['liv2','cns1'], k:0.15, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.15, cns:0.10 } },
  longevity_nad_stack: { id:'longevity_nad_stack', name:'NAD+/долголетие',
    substances:['spermidine','nicotinamide_riboside','resveratrol','coq10','piperine'],
    coverage:{ ln1:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' } },
    organCoverage:['cns','cardio'], totalK:{ cns:0.25, cardio:0.15 } },
  choline_ginkgo_stack: { id:'choline_ginkgo_stack', name:'Холиновый ноотроп',
    substances:['alpha_gpc','choline_bitartrate','ginkgo'],
    coverage:{ cg1:{ id:'phosphatidylcholine', name:'ФА', targets:['liv2','cns1'], k:0.15, q:'C' } },
    organCoverage:['hepatic','cns'], totalK:{ hepatic:0.15, cns:0.10 } },
  neuro_vascular_stack: { id:'neuro_vascular_stack', name:'Нейро-васкулярный',
    substances:['benfotiamine','alpha_lipoic','chromium'],
    coverage:{ nv1:{ id:'alpha_lipoic', name:'АЛЬК', targets:['cns2','hem2'], k:0.30, q:'C' } },
    organCoverage:['cns','hematologic'], totalK:{ cns:0.30, hematologic:0.20 } },
  liver_emergency_stack: { id:'liver_emergency_stack', name:'Экстренная коррекция печени',
    substances:['nac','tudca','milk_thistle','phosphatidylcholine','taurine_sup','alpha_lipoic'],
    coverage:{ le1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' }, le2:{ id:'tudca', name:'TUDCA', targets:['liv1','liv2'], k:0.45, q:'B' }, le3:{ id:'milk_thistle', name:'Силимарин', targets:['liv1'], k:0.25, q:'B' }, le4:{ id:'phosphatidylcholine', name:'ФА', targets:['liv2'], k:0.15, q:'C' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.74 } },
  joints_regeneration_stack: { id:'joints_regeneration_stack', name:'Суставы',
    substances:['bpc157','tb500','uc2','boswellia','msm','vitamin_d3'],
    coverage:{ jr1:{ id:'vitamin_d3', name:'D3', targets:['hem2'], k:0.10, q:'C' } },
    organCoverage:['hematologic'], totalK:{ hematologic:0.10 } },
  total_health_optimization_stack: { id:'total_health_optimization_stack', name:'Тотальная оптимизация',
    substances:['omega3','coq10','magnesium','alpha_lipoic','vitamin_d3','ashwagandha'],
    coverage:{ to1:{ id:'omega3', name:'Омега-3', targets:['cv2','cv4','hem2'], k:0.30, q:'B' }, to2:{ id:'coq10', name:'CoQ10', targets:['cns2','cv2'], k:0.25, q:'C' }, to3:{ id:'magnesium', name:'Mg', targets:['cv5','cns1'], k:0.35, q:'B' } },
    organCoverage:['cardio','hematologic','cns'], totalK:{ cardio:0.60, hematologic:0.30, cns:0.44 } },
  allergy_stack: { id:'allergy_stack', name:'Противоаллергический',
    substances:['quercetin','bromelain','vitamin_c','msm','nac'],
    coverage:{ al1:{ id:'nac', name:'NAC', targets:['liv1'], k:0.40, q:'B' } },
    organCoverage:['hepatic'], totalK:{ hepatic:0.40 } },
};

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// 4. МЕТКИ 28 МЕХАНИЗМОВ ТЗ (для UI-карточек)
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
export const TZ_MECH_LABELS: Record<string, string> = {
  cv1: 'Миокардиальное ремоделирование / фиброз / гипертрофия',
  cv2: 'Дислипидемический механизм',
  cv3: 'Задержка натрия и воды / гемодинамическая перегрузка',
  cv4: 'Протромботический / гипервязкостный механизм',
  cv5: 'Аритмогенный / электрофизиологический механизм',
  liv1: 'Гепатоцеллюлярная токсичность',
  liv2: 'Холестатический механизм',
  liv3: 'Сосудисто-пролиферативный / пренеопластический механизм',
  ren1: 'Гемодинамическое нефроповреждение',
  ren2: 'Гиперфильтрационное / клубочковое перенапряжение',
  ren3: 'Гломерулярно-протеинурическое повреждение',
  ren4: 'Водно-электролитный механизм',
  cns1: 'Нейромедиаторная дизрегуляция',
  cns2: 'Оксидативный стресс / митохондриальная дисфункция',
  cns3: 'Апоптоз / нейродегенеративный механизм',
  cns4: 'Нейроэндокринная дизрегуляция',
  cns5: 'Нейроглюкопения / энергетический дефицит нейронов',
  cns6: 'Внутричерепная гипертензия / компрессионно-нейропатический механизм',
  rep1: 'Супрессия GnRH/LH/FSH',
  rep2: 'Снижение интратестикулярного тестостерона',
  rep3: 'Нарушение сперматогенеза',
  rep4: 'Эстрогенный сдвиг / ароматизация',
  rep5: 'Постцикловая супрессия / вторичный гипогонадизм',
  hem1: 'Эритропоэз / эритроцитоз',
  hem2: 'Инсулинорезистентность / гипергликемический механизм',
  hem3: 'Гипогликемический механизм',
  hem4: 'Гипокалиемический механизм',
  hem5: 'Водно-электролитный сдвиг / отечный механизм',
};

export const TZ_SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая система',
  hepatic: 'Печень',
  renal: 'Почки',
  cns: 'Центральная нервная система',
  reproductive: 'Репродуктивная система / HPG-ось',
  hematologic: 'Гематолого-метаболический блок',
};

export const TZ_SYSTEM_ICONS: Record<string, string> = {
  cardio: '❤️', hepatic: '🫁', renal: '🫘',
  cns: '🧠', reproductive: '🧬', hematologic: '🩸',
};

// ── Вспомогательные функции ──
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
  const drugEntry = DRUG_DB[drugId];
  if (drugEntry) {
    const result: { organId: string; mechId: string; weight: number }[] = [];
    for (const [organId, mechs] of Object.entries(drugEntry.organMechanisms)) {
      for (const mechId of mechs) {
        result.push({ organId, mechId, weight: drugEntry.mechanismWeights[mechId] || 1 });
      }
    }
    return result;
  }

  const key = drugId.toLowerCase();
  const suppEntries = SUPPLEMENTS_DB[key] || SUPPLEMENTS_DB[drugId] || PHARMACY_DB[key] || PHARMACY_DB[drugId];
  if (!suppEntries?.length) return [];
  return suppEntries.map(e => ({
    organId: e.organId,
    mechId: e.mechId,
    weight: 1,
  }));
}

export function formatTzDrugMapping(drugId: string): string {
  const mechs = getDrugTzMechanisms(drugId);
  if (!mechs.length) return 'Нет данных по ТЗ';
  return mechs.map(m => `${TZ_SYSTEM_LABELS[m.organId]?.slice(0,15) || m.organId}: ${TZ_MECH_LABELS[m.mechId]?.slice(0,30) || m.mechId} (w=${m.weight})`).join('; ');
}

export function getSystemMechsForDrug(drugId: string, organId: string): { mechId: string; label: string; weight: number }[] {
  const drugEntry = DRUG_DB[drugId];
  if (drugEntry?.organMechanisms[organId]) {
    return drugEntry.organMechanisms[organId].map(m => ({
      mechId: m,
      label: TZ_MECH_LABELS[m] || m,
      weight: drugEntry.mechanismWeights[m] || 1,
    }));
  }

  const key = drugId.toLowerCase();
  const suppEntries = SUPPLEMENTS_DB[key] || SUPPLEMENTS_DB[drugId] || PHARMACY_DB[key] || PHARMACY_DB[drugId];
  if (!suppEntries?.length) return [];
  return suppEntries
    .filter(e => e.organId === organId)
    .map(e => ({
      mechId: e.mechId,
      label: TZ_MECH_LABELS[e.mechId] || e.mechId,
      weight: 1,
    }));
}

// ── Для карточек поддержки: читает SUPPORT_DB ──
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
