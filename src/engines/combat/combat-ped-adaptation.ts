/**
 * combat-ped-adaptation.ts — изолированный PED адаптер для единоборств.
 * Те же кривые, но кап ниже (единоборцы меньше выигрывают от массы).
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
  return 1.30;
}
export function adaptForPEDsCombat(peds: string[] | undefined, pedDoses: PedDoses | undefined, courseIntensity?: string): { mrvMult: number; details: string } {
  const doses = pedDoses || {};
  const has = (k: string) => (peds || []).some(p => p.toLowerCase().includes(k.toLowerCase()));
  const aasDose = parseDose(doses['aas'] ?? doses['AAS'] ?? 0);
  let mult = 1.0;
  const parts: string[] = [];
  if (has('aas') || aasDose > 0) {
    const m = curveAAS(aasDose || 500);
    mult *= m;
    parts.push(`AAS ${aasDose||500}mg → ×${m.toFixed(2)}`);
  }
  if (courseIntensity === 'heavy') mult *= 1.03;
  else if (courseIntensity === 'mild') mult *= 0.97;
  mult = Math.min(1.35, Math.max(1.0, Math.round(mult * 100) / 100));
  return { mrvMult: mult, details: parts.join(', ') || 'natural' };
}
