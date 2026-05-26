import { GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS, BASE_RISK } from '../core/constants';
import { RiskInput, RiskResult } from '../core/types';
function geom(arr:number[]){if(!arr.length)return 0;const l=arr.reduce((a,v)=>a+Math.log(Math.max(0.0001,v)),0);return Math.exp(l/arr.length)*100;}
export function calculateRisks(i:RiskInput):RiskResult{
  const brk:Record<string,{raw:number;net:number}>={}; const oR:number[]=[]; const oN:number[]=[];
  for(const s of RISK_SYSTEMS){const rM:number[]=[];const nM:number[]=[];
    for(let m=1;m<=7;m++){const id=`${s}_${m}`;
      const G=GENETIC_MULTIPLIERS[s]?.[i.genetics?.[s]||'Val/Val']||1.0;
      const N=Math.max(0.5,Math.min(1.5,i.nutritionFactor||1)); const T=Math.max(1,Math.min(1.5,i.trainingFactor||1));
      let prod=1;
      for(const[drug,d]of Object.entries(i.activeDrugs||{})){const cfg=DRUG_THRESHOLDS[drug];if(!cfg)continue;
        const D=Math.min(2,Math.pow((d.dosePerWeek||0)/cfg.dosePerWeek,1.2)); prod*=(1-Math.min(0.99,BASE_RISK*D*G*N*T));}
      const raw=Math.max(0,Math.min(100,(1-prod)*100)); const cov=(i.supportCoverage||{})[id]||0; const net=Math.max(0,raw*(1-cov));
      rM.push(raw/100); nM.push(net/100);}
    brk[s]={raw:geom(rM),net:geom(nM)}; oR.push(brk[s].raw/100); oN.push(brk[s].net/100);}
  return {systemBreakdown:brk,overallRaw:geom(oR),overallNet:geom(oN)};}