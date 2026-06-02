export interface ForecastResult {
  values: number[];
  ci95: [number, number][];
  warnings: string[];
}

function holtLinear(data: number[], alpha=0.4, beta=0.15, steps=7): ForecastResult {
  if(data.length < 2) return { values: Array(steps).fill(data[0]||0), ci95: Array(steps).fill([0,0] as [number,number]), warnings:[] };
  let level = data[0]; let trend = data[1]-data[0];
  const out: number[] = []; const ci: [number,number][] = [];
  const residuals: number[] = [];
  for(let i=1; i<data.length; i++) {
    const prev = level + trend;
    residuals.push(Math.abs(data[i]-prev));
    level = alpha*data[i] + (1-alpha)*(level+trend);
    trend = beta*(data[i]-prev) + (1-beta)*trend;
  }
  const std = Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/residuals.length) * 1.96;
  for(let i=0; i<steps; i++) {
    const val = level + (i+1)*trend;
    out.push(parseFloat(val.toFixed(1)));
    ci.push([parseFloat((val-std).toFixed(1)), parseFloat((val+std).toFixed(1))]);
  }
  const warnings: string[] = [];
  if(out[2] < 40) warnings.push('⚠️ Readiness упадёт <40 через ~5 дней. Рекомендуется день отдыха.');
  if(out[2] > 70) warnings.push('⚠️ Fatigue превысит 70. Запланируйте делод.');
  return { values: out, ci95: ci, warnings };
}

export function generateReadinessForecast(history: number[]): ForecastResult {
  return holtLinear(history, 0.45, 0.2, 7);
}

export interface LabForecast {
  current: number;
  w4: number; w8: number; w12: number;
  ci95w4: [number,number]; ci95w12: [number,number];
  alert?: string;
}

export function predictLabTrend(points: number[], baseRate=0.02, saturationWeeks=8): LabForecast {
  if(points.length < 2) return { current: points[points.length-1]||0, w4:0, w8:0, w12:0, ci95w4:[0,0], ci95w12:[0,0] };
  const base = points[points.length-1];
  const trend = (base - points[0]) / (points.length-1);
  const sat = Math.min(1, base / saturationWeeks);
  const proj = (w: number) => base + trend * w * (1 - sat * w / 12);
  const std = Math.max(0.5, Math.abs(trend) * 2);
  
  const w4 = proj(4); const w12 = proj(12);
  const alert = w12 > 54 ? '🔴 Гематокрит выйдет за 54%. Подготовьте донацию или снизьте дозу.' : undefined;
  
  return {
    current: parseFloat(base.toFixed(1)),
    w4: parseFloat(w4.toFixed(1)), w8: parseFloat(proj(8).toFixed(1)), w12: parseFloat(w12.toFixed(1)),
    ci95w4: [parseFloat((w4-std).toFixed(1)), parseFloat((w4+std).toFixed(1))],
    ci95w12: [parseFloat((w12-std).toFixed(1)), parseFloat((w12+std).toFixed(1))],
    alert
  };
}

export interface WhatIfResult {
  riskDelta: number; readinessDelta: number; note: string;
}

export function runWhatIf(baseRisk: number, baseReadiness: number, params: { drugChange?: Record<string,number>; calorieChange?:number; sleepChange?:number }): WhatIfResult {
  let risk = baseRisk; let read = baseReadiness;
  let note = '';
  for(const [drug, mult] of Object.entries(params.drugChange||{})) {
    risk += (mult-1)*12; note += `${drug} → ${mult===1?'без изм.':mult===0?'отмена':'×'+mult} | `;
  }
  if(params.calorieChange) read += params.calorieChange > 0 ? 3 : -4;
  if(params.sleepChange) read += params.sleepChange * 5;
  return { riskDelta: Math.round(risk-baseRisk), readinessDelta: Math.round(read-baseReadiness), note: note || 'Без изменений' };
}