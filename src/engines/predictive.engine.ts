import { PREDICTIVE_DEFAULTS } from '../core/constants';

export interface ForecastResult { values: number[]; ci95: [number, number][]; warnings: string[]; confidence: 'early' | 'stable'; /** F1: данных нет — график не должен выглядеть уверенным. */
  hasData: boolean; }

function holtLinear(data: number[], alpha?: number, beta?: number, steps?: number): ForecastResult {
  const a = alpha ?? PREDICTIVE_DEFAULTS.alpha;
  const b = beta ?? PREDICTIVE_DEFAULTS.beta;
  const s = steps ?? PREDICTIVE_DEFAULTS.steps;
  const clean = data.filter(v => Number.isFinite(v)); // F5: NaN из стора не должен попадать в координаты
  const confidence = clean.length >= 7 ? 'stable' : 'early';

  // F1: <2 точек — не «уверенный график нулевой готовности», а честный пустой результат с предупреждением.
  if (clean.length < 2) return {
    values: [], ci95: [], hasData: false, confidence,
    warnings: ['⚠️ Нет истории готовности (нужно ≥2 замера) — прогноз не построен. Любое число здесь было бы выдумкой.'],
  };

  let level = clean[0], trend = clean[1] - clean[0];
  const out: number[] = [], ci: [number, number][] = [], residuals: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const prev = level + trend;
    residuals.push(Math.abs(clean[i] - prev));
    level = a * clean[i] + (1 - a) * (level + trend);
    trend = b * (clean[i] - prev) + (1 - b) * trend;
  }
  const std = Math.sqrt(residuals.reduce((sum, v) => sum + v * v, 0) / residuals.length) * PREDICTIVE_DEFAULTS.ci_z_score;
  for (let i = 0; i < s; i++) {
    // кламп 0–100: шкала готовности ограничена, тренд за границы не уходит; ДИ расширяется с горизонтом (√h)
    const val = Math.max(0, Math.min(100, level + (i + 1) * trend));
    const half = std * Math.sqrt(i + 1);
    out.push(parseFloat(val.toFixed(1)));
    ci.push([parseFloat(Math.max(0, val - half).toFixed(1)), parseFloat(Math.min(100, val + half).toFixed(1))]);
  }
  // F2: предупреждения привязаны к тому же горизонту, о котором пишут, и означают то, что означают.
  // «⚠️ Fatigue превысит 70» при готовности >70 было бессмыслиц (усталости в этой модели нет вообще).
  const warnings: string[] = [];
  const d5 = out[Math.min(4, out.length - 1)];
  if (d5 < 40) warnings.push(`⚠️ Готовность упадёт примерно до ${d5} через ~5 дней (ориентир по тренду, не прогноз травмы).`);
  else if (trend < -2 && d5 < 55) warnings.push(`⚠️ Устойчивый спад готовности (${trend.toFixed(1)}/день) — облегчите нагрузку или запланируйте делод.`);
  if (confidence === 'early') warnings.push('⚠️ Ранний прогноз (<7 точек истории) — ориентир, не план.');
  return { values: out, ci95: ci, warnings, confidence, hasData: true };
}

export function generateReadinessForecast(history: number[]): ForecastResult {
  return holtLinear(history);
}

export interface LabForecast { current: number; w4: number; w8: number; w12: number; ci95w4: [number,number]; ci95w12: [number,number]; alert?: string; }

export function predictLabTrend(points: number[], saturationWeeks?: number): LabForecast {
  if(points.length < 2) return { current: points[points.length-1]||0, w4:0, w8:0, w12:0, ci95w4:[0,0], ci95w12:[0,0] };
  const satWeeks = saturationWeeks ?? PREDICTIVE_DEFAULTS.lab_saturation_weeks;
  const base = points[points.length-1];
  const trend = (base - points[0]) / (points.length-1);
  const sat = Math.min(1, base / satWeeks);
  const proj = (w: number) => base + trend * w * (1 - sat * w / 12);
  const std = Math.max(0.5, Math.abs(trend) * 2);
  
  const w4 = proj(4), w12 = proj(12);
  const alert = w12 > 54 ? '🔴 Гематокрит выйдет за 54%. Подготовьте донацию или снизьте дозу.' : undefined;
  
  return {
    current: parseFloat(base.toFixed(1)),
    w4: parseFloat(w4.toFixed(1)), w8: parseFloat(proj(8).toFixed(1)), w12: parseFloat(w12.toFixed(1)),
    ci95w4: [parseFloat((w4-std).toFixed(1)), parseFloat((w4+std).toFixed(1))],
    ci95w12: [parseFloat((w12-std).toFixed(1)), parseFloat((w12+std).toFixed(1))],
    alert
  };
}

export interface WhatIfResult { riskDelta: number; readinessDelta: number; note: string; }
/** F3: база сценария — ФАКТ (recoveryOut), а не константа 22; шаг сценария масштабируется величиной
 *  изменения (+1 ккал и +500 ккал больше не дают одинаковый эффект), коэффициенты — ориентир направления. */
export function runWhatIf(baseRisk: number, baseReadiness: number, params: { drugChange?: Record<string,number>; calorieChange?:number; sleepChange?:number }): WhatIfResult {
  const base = Number.isFinite(baseRisk) ? baseRisk : 0;
  const baseRead = Number.isFinite(baseReadiness) ? baseReadiness : 0;
  let risk = base, read = baseRead, note = '';
  for(const [drug, mult] of Object.entries(params.drugChange||{})) {
    if (!Number.isFinite(mult)) continue;
    risk += (mult-1)*12; note += `${drug} → ${mult===1?'без изм.':mult===0?'отмена':'×'+mult} | `;
  }
  const kcal = Number(params.calorieChange);
  if (Number.isFinite(kcal) && kcal !== 0) {
    // ±250 ккал → ±1, ±1000 ккал → ±4 (плато), кламп ±4
    read += Math.max(-4, Math.min(4, kcal / 250));
    note += `${kcal > 0 ? '+' : ''}${Math.round(kcal)} ккал → ${(kcal / 250 >= 4 || kcal / 250 <= -4) ? (kcal > 0 ? '+4' : '−4') : (kcal > 0 ? '+' : '−') + Math.abs(Math.round(kcal / 250))} ед. готовности | `;
  }
  const sleep = Number(params.sleepChange);
  if (Number.isFinite(sleep) && sleep !== 0) {
    const eff = Math.max(-15, Math.min(15, sleep * 5));
    read += eff;
    note += `${sleep > 0 ? '+' : ''}${sleep} ч сна → ${eff > 0 ? '+' : '−'}${Math.abs(Math.round(eff))} | `;
  }
  const suffix = 'Ориентиры направления (не физиология): ±250 ккал ≈ ±1 ед. готовности с плато на ±4, +1 ч сна ≈ +5.';
  return { riskDelta: Math.round(risk - base), readinessDelta: Math.round(read - baseRead), note: (note || 'Без изменений') + ' ' + suffix };
}
