import { PredictiveInput, PredictiveResult } from '../core/types';

function holtWinters(data: number[], alpha=0.3, beta=0.1, steps=7): { values: number[]; ci95: [number, number][] } {
  if (data.length < 3) return { values: Array(steps).fill(data[0] || 0), ci95: Array(steps).fill([0,0] as [number,number]) };
  let level = data[0]; let trend = data.length > 1 ? data[1] - data[0] : 0;
  const out: number[] = []; const ci: [number,number][] = [];
  const residuals: number[] = [];
  for(let i=1; i<data.length; i++) {
    const prev = level + trend;
    residuals.push(Math.abs(data[i] - prev));
    level = alpha * data[i] + (1-alpha)*(level+trend);
    trend = beta*(data[i]-prev) + (1-beta)*trend;
  }
  const std = Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/residuals.length) * 1.96; // 95% CI
  for(let i=0; i<steps; i++) {
    const val = level + (i+1)*trend;
    out.push(parseFloat(val.toFixed(1)));
    ci.push([parseFloat((val-std).toFixed(1)), parseFloat((val+std).toFixed(1))]);
  }
  return { values: out, ci95: ci };
}

export function generateForecast(input: PredictiveInput): PredictiveResult {
  const warnings: string[] = [];
  const forecasts: Record<string, {values: number[]; ci95: [number, number]}> = {};

  for (const [key, hist] of Object.entries(input.history)) {
    const res = holtWinters(hist, 0.35, 0.15, 7);
    forecasts[key] = { values: res.values, ci95: res.ci95[6] };
    
    const lastVal = input.current[key] || hist[hist.length-1];
    if (key.includes('readiness') && res.values[2] < 40) warnings.push(`⚠️ Readiness упадёт ниже 40 через ~5 дней. Рекомендуется день отдыха.`);
    if (key.includes('fatigue') && res.values[2] > 70) warnings.push(`⚠️ Fatigue превысит 70. Запланируйте делод.`);
    if (key.includes('hct') && res.values[2] > 54) warnings.push(`🔴 Гематокрит выйдет за 54%. Подготовьте донацию или снизьте дозу.`);
  }

  return { forecasts, warnings };
}

export interface WhatIfParams {
  drugChange?: Record<string, number>; // multipliers: 1.0 = same, 0.5 = -50%, 0 = cancel
  calorieChange?: number; // +/- kkal
  sleepChange?: number; // +/- hours
}

export function runWhatIf(baseRisk: number, baseReadiness: number, params: WhatIfParams): { riskDelta: number; readinessDelta: number; note: string } {
  let risk = baseRisk; let read = baseReadiness;
  let note = '';

  // Drug load impact on risk
  for (const [drug, mult] of Object.entries(params.drugChange || {})) {
    risk += (mult - 1) * 12; // упрощённая модель нагрузки из ТЗ §13.2
    note += `${drug} → ${mult===1?'без изм.':mult===0?'отмена':'×'+mult} | `;
  }

  // Calorie/Sleep impact on readiness
  if (params.calorieChange) read += params.calorieChange > 0 ? 3 : -4;
  if (params.sleepChange) read += params.sleepChange * 5;

  risk = Math.max(0, Math.min(100, risk));
  read = Math.max(0, Math.min(100, read));

  return {
    riskDelta: Math.round(risk - baseRisk),
    readinessDelta: Math.round(read - baseReadiness),
    note: note || 'Без изменений'
  };
}