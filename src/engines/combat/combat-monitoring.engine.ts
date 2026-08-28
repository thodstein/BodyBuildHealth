/**
 * combat-monitoring.engine.ts — ACWR / HRV / VBT для единоборств.
 * Изолировано. Не трогает bb/strength.
 */

export type ACWRZone = 'optimal' | 'caution' | 'dangerous' | 'undertrained';
export interface ACWRReport { acute: number; chronic: number; ratio: number; zone: ACWRZone; recommendation: string; }

export function combatACWR(acuteLoad: number, chronicLoad: number): ACWRReport {
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : acuteLoad > 0 ? 2 : 1;
  let zone: ACWRZone = 'optimal';
  let rec = 'Нагрузка в оптимуме (0.8-1.3) — продолжайте.';
  if (ratio < 0.8) { zone = 'undertrained'; rec = 'Недогруз <0.8 — добавьте 10% объёма или 1 сессию.'; }
  else if (ratio > 1.5) { zone = 'dangerous'; rec = 'Перегруз >1.5 — делод 40% объёма, RIR+2, сон 8ч+.'; }
  else if (ratio > 1.3) { zone = 'caution'; rec = 'Погранично 1.3-1.5 — снизьте объём 15%, RIR+1.'; }
  return { acute: Math.round(acuteLoad), chronic: Math.round(chronicLoad), ratio: Math.round(ratio*100)/100, zone, recommendation: rec };
}

export function combatACWRFromLoads(dailyLoads: number[]): ACWRReport | null {
  if (!Array.isArray(dailyLoads) || dailyLoads.length < 7) return null;
  const acute = dailyLoads.slice(-7).reduce((a,b)=>a+b,0);
  const chronic = dailyLoads.slice(-28).reduce((a,b)=>a+b,0) /4; // 28д среднее ~ acute
  // если <28д — берём среднее имеющегося
  const chronicAvg = dailyLoads.length >= 28 ? chronic : dailyLoads.reduce((a,b)=>a+b,0) / Math.max(1, dailyLoads.length) *7;
  return combatACWR(acute, chronicAvg);
}

// VBT velocity zones (по %1RM) — Vitruve
const VBT_ZONES: Array<{ pct: [number, number]; velocity: [number, number]; quality: string }> = [
  { pct: [90, 100], velocity: [0.15, 0.35], quality: 'max_strength' },
  { pct: [80, 90], velocity: [0.35, 0.5], quality: 'strength' },
  { pct: [70, 80], velocity: [0.5, 0.75], quality: 'power' },
  { pct: [50, 70], velocity: [0.75, 1.0], quality: 'speed' },
  { pct: [0, 50], velocity: [1.0, 1.6], quality: 'speed_strength' },
];
export function vbtVelocityForPct(pct: number): { velocity: number; quality: string } | null {
  for (const z of VBT_ZONES) if (pct >= z.pct[0] && pct <= z.pct[1]) return { velocity: (z.velocity[0]+z.velocity[1])/2, quality: z.quality };
  return null;
}
export function vbtRecommendation(velocityLossPct: number): { action: string; rirAdd: number; volumeMult: number } {
  if (velocityLossPct > 30) return { action: 'Стоп сет: потеря >30% — техника ломается, завершить', rirAdd: 2, volumeMult: 0.6 };
  if (velocityLossPct > 25) return { action: 'Снизьте вес 5% и RIR+1, объём ×0.85', rirAdd: 1, volumeMult: 0.85 };
  if (velocityLossPct > 20) return { action: 'Контроль потери 20-25% — RIR+1', rirAdd: 1, volumeMult: 0.9 };
  if (velocityLossPct > 15) return { action: 'В пределах 15-20% — оптимально для силы', rirAdd: 0, volumeMult: 1 };
  return { action: 'Можно добавить 1 сет или +2.5кг', rirAdd: 0, volumeMult: 1.05 };
}

// HRV — простое правило: < mean-1SD → caution
export function hrvGrade(hrvMs: number, mean: number, sd: number): { grade: 'optimal'|'caution'|'dangerous'; note: string } {
  if (hrvMs < mean - sd) return { grade: 'dangerous', note: 'HRV < mean-1SD — недовосстановление, RIR+1, объём -15%' };
  if (hrvMs < mean - 0.5*sd) return { grade: 'caution', note: 'HRV снижен — мониторьте сон/стресс' };
  return { grade: 'optimal', note: 'HRV в норме' };
}

export function combatLoadStatus(acwr: ACWRReport | null, hrvGradeResult: string | null, velocityLoss?: number | null): string[] {
  const notes: string[] = [];
  if (acwr) notes.push(`ACWR ${acwr.ratio} (${acwr.zone}): ${acwr.recommendation}`);
  if (hrvGradeResult) notes.push(`HRV: ${hrvGradeResult}`);
  if (typeof velocityLoss === 'number') notes.push(`VBT потеря ${velocityLoss}%: ${vbtRecommendation(velocityLoss).action}`);
  return notes;
}
