import { RiskResult } from '../core/types';
import { SUPPORT_BASE_COVERAGE } from '../core/constants';

export interface SupportItem { id: string; name: string; dose: string; category: 'supplement' | 'pharma' | 'peptide'; covers: string[]; synergy: string; mechanisms: Record<string, number>; }

export const SUPPORT_DB: SupportItem[] = [
  { id:'telmisartan', name:'Телмисартан 40-80 мг', dose:'1×40-80 мг утро', category:'pharma', covers:['cardio_2','cardio_3','renal_1'], synergy:'+Небилет: АД/ЧСС контроль', mechanisms: SUPPORT_BASE_COVERAGE.telmisartan },
  { id:'nebivolol', name:'Небилет (небиволол) 5 мг', dose:'5 мг утро', category:'pharma', covers:['cardio_1','cardio_7'], synergy:'+Телмисартан: контроль ЧСС', mechanisms: SUPPORT_BASE_COVERAGE.nebivolol },
  { id:'nac', name:'NAC 1200 мг', dose:'2×600 мг с едой', category:'supplement', covers:['hepatic_3','hepatic_2','cardio_5'], synergy:'+TUDCA: гепатопротекция', mechanisms: SUPPORT_BASE_COVERAGE.nac },
  { id:'tudca', name:'TUDCA 1000 мг', dose:'1000 мг/день с едой', category:'supplement', covers:['hepatic_1','hepatic_5'], synergy:'+NAC: синергия по фиброзу', mechanisms: SUPPORT_BASE_COVERAGE.tudca },
  { id:'omega3', name:'Омега-3 (EPA/DHA) 3 г', dose:'2 г EPA + 1 г DHA', category:'supplement', covers:['cardio_1','cardio_4','neuro_4'], synergy:'+Телмисартан: кардиориск -45%', mechanisms: SUPPORT_BASE_COVERAGE.omega3 },
  { id:'magnesium', name:'Магний бисглицинат 400 мг', dose:'400 мг вечер', category:'supplement', covers:['neuro_2','neuro_3','cardio_7'], synergy:'+L-теанин: сон/стресс', mechanisms: SUPPORT_BASE_COVERAGE.magnesium },
  { id:'berberine', name:'Берберин 1000 мг', dose:'2×500 мг до еды', category:'supplement', covers:['endocrine_4','cardio_1'], synergy:'+Ретрутид: чувствительность к инсулину', mechanisms: SUPPORT_BASE_COVERAGE.berberine },
  { id:'coq10', name:'CoQ10 (Убихинол) 200 мг', dose:'200 мг утро', category:'supplement', covers:['cardio_4','neuro_5'], synergy:'+Омега-3: эндотелий', mechanisms: SUPPORT_BASE_COVERAGE.coq10 },
  { id:'vitamin_d3', name:'Витамин D3 5000 МЕ', dose:'5000 МЕ/день', category:'supplement', covers:['endocrine_2','immune_1'], synergy:'+K2/Mg: усвоение', mechanisms: SUPPORT_BASE_COVERAGE.vitamin_d3 },
  { id:'zinc', name:'Цинк пиколинат 30 мг', dose:'30 мг/день', category:'supplement', covers:['repro_2','immune_1'], synergy:'+Магний: тестостерон', mechanisms: SUPPORT_BASE_COVERAGE.zinc },
  { id:'hcg', name:'HCG 500 МЕ', dose:'2×/нед (3/1)', category:'pharma', covers:['repro_1','repro_2'], synergy:'Профилактика атрофии тестикул', mechanisms: SUPPORT_BASE_COVERAGE.hcg }
];

export function generateSupportStack(rawRisks:Record<string,number>, genetics:Record<string,string>={}, userDrugs:string[]=[]):{items:SupportItem[];coverageMap:Record<string,number>;netRisk:Record<string,number>}{
  const selected:SupportItem[]=[]; const threshold=35;
  if(rawRisks['cardio']>threshold)selected.push(SUPPORT_DB[0], SUPPORT_DB[1], SUPPORT_DB[4]);
  if(rawRisks['hepatic']>threshold)selected.push(SUPPORT_DB[2], SUPPORT_DB[3]);
  if(rawRisks['neuro']>threshold)selected.push(SUPPORT_DB[5]);
  if(rawRisks['endocrine']>threshold)selected.push(SUPPORT_DB[6], SUPPORT_DB[8]);
  if(rawRisks['reproductive']>threshold)selected.push(SUPPORT_DB[9], SUPPORT_DB[10]);
  
  const unique=[...new Map(selected.map(i=>[i.id,i])).values()];
  const coverage:Record<string,number>={}; 
  Object.keys(rawRisks).forEach(sys=>{
    for(let m=1;m<=7;m++){
      const mechId=`${sys}_${m}`; 
      coverage[mechId]=unique.reduce((sum,item)=>sum+(item.mechanisms[mechId]||0),0); 
      if(coverage[mechId]>1)coverage[mechId]=1;
    }
  });
  
  const netRisk:Record<string,number>={}; 
  Object.entries(rawRisks).forEach(([sys,raw])=>{
    let product=1; 
    for(let m=1;m<=7;m++){
      const mechId=`${sys}_${m}`; 
      const cov=coverage[mechId]||0; 
      product*=(1-cov);
    } 
    netRisk[sys]=Math.round(raw*product);
  });
  return {items:unique,coverageMap:coverage,netRisk};
}