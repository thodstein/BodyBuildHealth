import { LabPoint, LabForecast, LabPhase } from '../core/types';

const UCUM_MAP: Record<string, { prefUnit: string; coeff: number; uln: number; name: string }> = {
  'ALT': { prefUnit:'U/L', coeff:1, uln:40, name:'АЛТ' },
  'AST': { prefUnit:'U/L', coeff:1, uln:40, name:'АСТ' },
  'HCT': { prefUnit:'%', coeff:1, uln:52, name:'Гематокрит' },
  'TT':  { prefUnit:'ng/dL', coeff:1, uln:1000, name:'Тестостерон' },
  'E2':  { prefUnit:'pg/mL', coeff:1, uln:40, name:'Эстрадиол' },
  'LDL': { prefUnit:'mg/dL', coeff:1, uln:115, name:'ЛПНП' },
  'HDL': { prefUnit:'mg/dL', coeff:1, uln:35, name:'ЛПВП (нижняя граница)' } // инверсия логики в коде
};

export function normalizeLab(code: string, value: number, unit: string): { norm: number; unit: string } {
  const m = UCUM_MAP[code.toUpperCase()];
  if (!m) return { norm: value, unit };
  return { norm: parseFloat((value * m.coeff).toFixed(2)), unit: m.prefUnit };
}

export function predictLab(points: LabPoint[], code: string): LabForecast | null {
  const sorted = points.filter(p => p.code.toUpperCase() === code.toUpperCase()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return null;

  const vals = sorted.map(p => normalizeLab(p.code, p.value, p.unit).norm);
  const n = vals.length; const x = Array.from({length:n}, (_,i)=>i);
  const mx = x.reduce((a,b)=>a+b)/n; const my = vals.reduce((a,b)=>a+b)/n;
  const sxy = x.reduce((a,v,i)=>a+(v-mx)*(vals[i]-my), 0);
  const sxx = x.reduce((a,v)=>a+(v-mx)**2, 0);
  const slope = sxx!==0 ? sxy/sxx : 0; const intercept = my - slope*mx;

  const base = vals[n-1];
  const ref = UCUM_MAP[code.toUpperCase()]?.uln || 100;
  const isUpperLimit = code.toUpperCase() !== 'HDL';

  const calc = (weeks: number) => {
    const val = slope*(n+weeks) + intercept;
    const delta = Math.abs(val - ref) < ref*0.1 ? 1.5 : 3;
    return parseFloat(val.toFixed(1));
  };

  const w4 = calc(4); const w8 = calc(8); const w12 = calc(12);
  let alert = '';
  if (isUpperLimit && (w4>ref*1.1 || w8>ref*1.2)) alert = `⚠️ Прогноз превышения ULN (${ref}) через 4–8 нед.`;
  if (!isUpperLimit && (w4<ref*0.9 || w8<ref*0.7)) alert = `⚠️ Прогноз падения ниже LLN (${ref}) через 4–8 нед.`;

  return { current: base, w4, w8, w12, alert: alert || undefined };
}

export function getPhaseHistory(points: LabPoint[]): Record<LabPhase, LabPoint[]> {
  const phases: Record<LabPhase, LabPoint[]> = { baseline:[], on_cycle:[], bridge:[], pct:[], post_pct:[] };
  points.forEach(p => { if(phases[p.phase]) phases[p.phase].push(p); });
  return phases;
}