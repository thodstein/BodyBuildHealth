/**
 * combat-ped-adaptation.ts — изолированный PED адаптер для единоборств.
 * Кап ниже чем в ББ/стронге (масса не всегда плюс). Учитывает GH/ins, дисциплину.
 */
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
  if (mg < 300) return 1.0 + (mg / 300) * 0.10;
  if (mg < 700) return 1.10 + ((mg - 300) / 400) * 0.10;
  if (mg < 1500) return 1.20 + ((mg - 700) / 800) * 0.10;
  if (mg < 3000) return 1.30 + ((mg - 1500) / 1500) * 0.05;
  return 1.35;
}
function curveGH(iu: number): number {
  if (iu <= 0) return 1.0;
  if (iu < 4) return 1.0 + (iu / 4) * 0.04;
  if (iu < 8) return 1.04 + ((iu - 4) / 4) * 0.03;
  return 1.07;
}
function curveInsulin(iu: number): number {
  if (iu <= 0) return 1.0;
  if (iu < 10) return 1.0 + (iu / 10) * 0.03;
  return 1.03;
}

export function adaptForPEDsCombat(
  peds: string[] | undefined,
  pedDoses: PedDoses | undefined,
  courseIntensity?: string,
  discipline?: string,
  goal?: string
): { mrvMult: number; details: string } {
  const doses = pedDoses || {};
  const has = (k: string) => (peds || []).some(p => p.toLowerCase().includes(k.toLowerCase()));
  const aasTeq = has('tren') ? 2.5 : has('nand') || has('deca') ? 1.3 : has('bold') || has('eq') ? 1.1 : 1.0;
  let aasDose = 0;
  const aasKeys = ['aas','test','tren','deca','nand','bold','eq','primo','mast','drol','anavar','winstrol','oxan','stan'];
  for (const [k,v] of Object.entries(doses)) {
    const lk = String(k).toLowerCase();
    if (aasKeys.some(x=> lk.includes(x))) aasDose += parseDose(v);
  }
  if (aasDose===0) aasDose = parseDose((doses as any)['mg'] ?? doses['aas'] ?? doses['AAS'] ?? 0);
  const ghDose = parseDose((doses as any)['gh'] ?? (doses as any)['hgh'] ?? 0);
  const insDose = parseDose((doses as any)['insulin'] ?? (doses as any)['ins'] ?? 0);
  const mgfDose = parseDose((doses as any)['mgf'] ?? 0);
  const igfDose = parseDose((doses as any)['igf1'] ?? (doses as any)['igf'] ?? 0);

  let mult = 1.0;
  const parts: string[] = [];
  if (has('aas') || has('tren') || has('deca') || has('nand') || has('test') || aasDose > 0) {
    const eff = Math.round(aasDose * aasTeq);
    const m = curveAAS(eff || (has('tren')||has('aas') ? 500 : 0));
    mult *= m;
    parts.push(`AAS ${aasDose||500}mg${aasTeq!==1?` ×tEq${aasTeq}→${eff}mg`:''} → ×${m.toFixed(2)}`);
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
  if (has('mgf') || mgfDose > 0) mult *= 1.02;
  if (has('igf') || igfDose > 0) mult *= 1.02;
  // GH+IGF синергия — лёгкий буст 2% но с diminishing 0.90 (как в tz-spec)
  if ((has('gh') || ghDose > 0) && (has('igf') || igfDose > 0)) mult *= 1.01;

  if (courseIntensity === 'heavy') mult *= 1.03;
  else if (courseIntensity === 'mild') mult *= 0.97;

  const count = [has('aas')||aasDose>0, has('gh')||ghDose>0, has('insulin')||insDose>0, has('mgf'), has('igf')].filter(Boolean).length;
  if (count >= 2) mult = 1 + (mult - 1) * 0.85;
  // весогонка — дефицит съедает PED-выгоду
  if (goal === 'weight_cut') mult = 1 + (mult - 1) * 0.70;

  // cap по дисциплине: борьба выигрывает от массы чуть больше
  let cap = 1.35;
  const d = (discipline||'').toLowerCase();
  if (d.includes('wrest')) cap = 1.45;
  else if (d.includes('mma')) cap = 1.38;
  else if (d.includes('box')) cap = 1.32;
  else if (d.includes('kick')) cap = 1.33;
  if (goal === 'weight_cut') cap = Math.min(cap, 1.18);

  mult = Math.min(cap, Math.max(1.0, Math.round(mult * 100) / 100));
  return { mrvMult: mult, details: parts.join(', ') || 'natural' };
}
