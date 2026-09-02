/**
 * strength-sport-hrv.engine.ts — HRV EWMA для ТА/стронга (parity combat-hrv)
 * Хранение: he_hrv_log (как в combat), EWMA α=0.30, опасная зона < mean-1SD (Plews 2022)
 */

export interface HRVSample { date: string; hrvMs: number; rhr?: number; }

const KEY = 'he_hrv_log';

export function loadHRV(): HRVSample[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveHRV(samples: HRVSample[]): void { try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(samples.slice(-90))); } catch {} }

export function hrvMean(samples: number[]): number | null {
  if (!samples.length) return null;
  return Math.round(samples.reduce((a,b)=>a+b,0)/samples.length *10)/10;
}
export function hrvSD(samples: number[]): number | null {
  if (samples.length < 2) return null;
  const m = hrvMean(samples)!;
  const v = samples.reduce((a,b)=> a + (b-m)*(b-m),0)/samples.length;
  return Math.round(Math.sqrt(v)*10)/10;
}

export function hrvEwma(values: number[], alpha = 0.30): number | null {
  if (!values.length) return null;
  let ema = values[0];
  for (let i=1;i<values.length;i++) ema = alpha*values[i] + (1-alpha)*ema;
  return Math.round(ema*10)/10;
}

export interface HRVReport { mean: number; sd: number; ewma: number | null; last: number; zone: 'optimal'|'caution'|'dangerous'; readinessMult: number; }

export function hrvReport(samplesOrValues: HRVSample[] | number[]): HRVReport | null {
  const vals = Array.isArray(samplesOrValues) && samplesOrValues.length && typeof (samplesOrValues[0] as any) === 'number' ? samplesOrValues as number[] : (samplesOrValues as HRVSample[]).map(s=> s.hrvMs).filter(v=> Number.isFinite(v) && v>0);
  if (vals.length < 7) return null;
  const mean = hrvMean(vals)!;
  const sd = hrvSD(vals) ?? 5;
  const ewma = hrvEwma(vals);
  const last = vals[vals.length-1];
  let zone: HRVReport['zone'] = 'optimal';
  if (last < mean - sd) zone = 'dangerous';
  else if (last < mean - 0.5*sd) zone = 'caution';
  const readinessMult = zone === 'dangerous' ? 0.85 : zone === 'caution' ? 0.94 : 1;
  return { mean, sd, ewma, last, zone, readinessMult };
}

export function hrvFromHistory(history: Array<{ date?: string; hrv?: number; hrvMs?: number }>): number[] {
  return history.map(h=> (h as any).hrvMs ?? (h as any).hrv).filter(v=> Number.isFinite(v)) as number[];
}
