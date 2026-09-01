/**
 * strength-sport-ped-adaptation.ts — изолированный PED MRV адаптер (не трогает bb-ped-adaptation).
 * Упрощённая dose-aware кривая: AAS/GH/Insulin → mrvMult 1.0-1.7, cap 1.7 (как bb, но изолировано).
 */
import { applyPedDiminishing } from '../shared/ped-diminishing.engine';

export type PedDoses = Record<string, number>;

function parseDose(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function curveAAS(mg: number): number {
  if (mg <= 0) return 1.0;
  if (mg < 300) return 1.0 + (mg / 300) * 0.15;
  if (mg < 700) return 1.15 + ((mg - 300) / 400) * 0.15;
  if (mg < 1500) return 1.30 + ((mg - 700) / 800) * 0.20;
  if (mg < 3000) return 1.50 + ((mg - 1500) / 1500) * 0.20;
  return 1.70;
}
function curveGH(iu: number): number {
  if (iu <= 0) return 1.0;
  if (iu < 4) return 1.0 + (iu / 4) * 0.05;
  if (iu < 8) return 1.05 + ((iu - 4) / 4) * 0.05;
  return 1.10;
}
function curveInsulin(iu: number): number {
  if (iu <= 0) return 1.0;
  if (iu < 10) return 1.0 + (iu / 10) * 0.05;
  return 1.05;
}

export const PED_T_EQ: Record<string, number> = { tren: 2.5, nand: 1.3, deca: 1.3, bold: 1.1, eq: 1.1, primo: 1.0, mast: 1.0, drol: 1.2, anavar: 0.9, winstrol: 1.0, stan: 1.0, oxan: 0.9, halo: 1.1, superdrol: 1.4 };
export function getAasTeq(peds: string[] | undefined): number {
  if (!peds || peds.length === 0) return 1.0;
  const low = peds.map(p => p.toLowerCase());
  if (low.some(p => p.includes('tren'))) return 2.5;
  if (low.some(p => p.includes('nand') || p.includes('deca'))) return 1.3;
  if (low.some(p => p.includes('bold') || p.includes('eq'))) return 1.1;
  if (low.some(p => p.includes('drol') || p.includes('superdrol'))) return 1.2;
  return 1.0;
}
export function adaptForPEDsSS(peds: string[] | undefined, pedDoses: PedDoses | undefined, courseIntensity?: string, isWeightCut?: boolean): { mrvMult: number; details: string } {
  const doses = pedDoses || {};
  const has = (k: string) => (peds || []).some(p => p.toLowerCase().includes(k.toLowerCase()));
  const aasTeq = getAasTeq(peds);
  // пробуем найти дозы по ключам — сумма всех AAS-подобных
  let aasDose = 0;
  const aasKeys = ['aas','test','tren','deca','nand','bold','eq','primo','mast','drol','anavar','winstrol','oxan','stan'];
  for(const [k,v] of Object.entries(doses)){
    const lk = String(k).toLowerCase();
    if(aasKeys.some(x=> lk.includes(x))){ aasDose += parseDose(v); }
  }
  if(aasDose===0) aasDose = parseDose((doses as any)['mg'] ?? 0);
  const ghDose = parseDose(doses['gh'] ?? doses['hgh'] ?? 0);
  const insDose = parseDose(doses['insulin'] ?? doses['ins'] ?? 0);
  const mgfDose = parseDose(doses['mgf'] ?? 0);
  const igfDose = parseDose(doses['igf1'] ?? doses['igf'] ?? 0);

  let mult = 1.0;
  const parts: string[] = [];
  if (has('aas') || has('tren') || has('deca') || has('nand') || has('test') || aasDose > 0) {
    const effDose = Math.round(aasDose * aasTeq);
    const m = curveAAS(effDose || (has('tren') || has('aas') ? 500 : 0));
    mult *= m;
    parts.push(`AAS ${aasDose||500}mg${aasTeq!==1?` ×tEq${aasTeq}→${effDose}mg`:''} → ×${m.toFixed(2)}`);
  }
  if (has('gh') || ghDose > 0) {
    const m = curveGH(ghDose || 4);
    mult *= m;
    parts.push(`GH ${ghDose||4}IU → ×${m.toFixed(2)}`);
  }
  if (has('insulin') || insDose > 0) {
    const m = curveInsulin(insDose || 10);
    mult *= m;
    parts.push(`Ins ${insDose||10}IU → ×${m.toFixed(2)}`);
  }
  if (has('mgf') || mgfDose > 0) mult *= 1.03;
  if (has('igf') || igfDose > 0) mult *= 1.03;

  // intensity корректировка
  if (courseIntensity === 'heavy') mult *= 1.05;
  else if (courseIntensity === 'mild') mult *= 0.97;

  const count = [has('aas')||aasDose>0, has('gh')||ghDose>0, has('insulin')||insDose>0, has('mgf'), has('igf')].filter(Boolean).length;
  mult = applyPedDiminishing(mult, count, !!isWeightCut);

  let cap = 1.70;
  if (isWeightCut) cap = 1.35;
  mult = Math.min(cap, Math.max(1.0, Math.round(mult * 100) / 100));
  return { mrvMult: mult, details: parts.join(', ') || 'natural' };
}
