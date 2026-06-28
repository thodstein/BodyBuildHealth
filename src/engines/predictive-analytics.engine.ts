// ============================================================
// predictive-analytics.engine.ts — Time Series Forecasting
// ARIMA(1,1,1) + Holt-Winters + What-if scenarios
// ============================================================

export interface TimePoint {
  time: number;    // week number or timestamp
  value: number;   // actual measurement
}

export interface ForecastPoint {
  time: number;
  value: number;
  ci95_low: number;
  ci95_high: number;
}

export interface ARIMAParams {
  p: number;  // autoregressive order
  d: number;  // differencing order
  q: number;  // moving average order
}

export interface ARIMAResult {
  params: { ar: number; ma: number; intercept: number };
  fitted: number[];
  residuals: number[];
  forecast: ForecastPoint[];
  aic: number;
  mse: number;
}

export interface HoltWintersResult {
  level: number[];
  trend: number[];
  seasonal: number[];
  fitted: number[];
  forecast: ForecastPoint[];
  alpha: number;
  beta: number;
  gamma: number;
  mse: number;
}

// ─── ARIMA(1,1,1) ───

/**
 * ARIMA(1,1,1) model: y'_t = c + φ·y'_{t-1} + ε_t + θ·ε_{t-1}
 * where y'_t = y_t - y_{t-1} (first difference)
 * 
 * Estimation via least squares with residual recursion.
 */
export function fitARIMA111(data: TimePoint[], forecastHorizon: number = 12): ARIMAResult {
  const values = data.map(d => d.value);
  const n = values.length;
  if (n < 4) throw new Error('Need at least 4 data points for ARIMA(1,1,1)');

  // Step 1: First difference
  const diff: number[] = [];
  for (let i = 1; i < n; i++) diff.push(values[i] - values[i - 1]);

  // Step 2: Estimate AR(1) parameter φ via OLS on diff
  const dn = diff.length;
  let sumYY = 0, sumYX = 0, sumXX = 0;
  for (let i = 1; i < dn; i++) {
    sumYY += diff[i] * diff[i];
    sumYX += diff[i] * diff[i - 1];
    sumXX += diff[i - 1] * diff[i - 1];
  }
  const phi = sumXX > 0.001 ? Math.max(-0.99, Math.min(0.99, sumYX / sumXX)) : 0;

  // Step 3: Estimate constant (intercept) as mean of diff
  const intercept = diff.reduce((s, v) => s + v, 0) / dn * (1 - phi);

  // Step 4: Compute residuals and estimate MA(1) θ
  const residuals: number[] = [0];
  for (let i = 1; i < dn; i++) {
    residuals.push(diff[i] - intercept - phi * diff[i - 1]);
  }
  // Simple MA(1) estimate: θ = corr(residuals_lag1, residuals)
  let sumRR = 0, sumRR1 = 0;
  for (let i = 1; i < dn; i++) {
    sumRR += residuals[i] * residuals[i];
    sumRR1 += (residuals[i - 1] || 0) * residuals[i];
  }
  const theta = sumRR > 0.001 ? Math.max(-0.99, Math.min(0.99, sumRR1 / sumRR)) : 0;

  // Step 5: Fitted values
  const fitted: number[] = [values[0]];
  for (let i = 1; i < n; i++) {
    const predDiff = intercept + phi * (diff[i - 1] || 0) + theta * (residuals[i - 1] || 0);
    fitted.push(fitted[i - 1] + predDiff);
  }

  // Step 6: Forecast
  const lastValue = values[n - 1];
  const lastDiff = diff[dn - 1] || 0;
  const lastResidual = residuals[dn - 1] || 0;
  const se = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, dn - 2));

  let forecastVal = lastValue;
  let prevDiff = lastDiff;
  let prevResidual = lastResidual;
  const forecast: ForecastPoint[] = [];

  for (let h = 1; h <= forecastHorizon; h++) {
    const predDiff = intercept + phi * prevDiff + theta * prevResidual;
    forecastVal += predDiff;
    const ci = 1.96 * se * Math.sqrt(h);
    forecast.push({
      time: data[n - 1].time + h,
      value: Math.round(forecastVal * 100) / 100,
      ci95_low: Math.round((forecastVal - ci) * 100) / 100,
      ci95_high: Math.round((forecastVal + ci) * 100) / 100,
    });
    prevDiff = predDiff;
    prevResidual = 0; // future residuals are zero
  }

  // AIC approximation
  const mse = residuals.reduce((s, r) => s + r * r, 0) / dn;
  const aic = dn * Math.log(Math.max(0.0001, mse)) + 2 * 3; // 3 params

  return {
    params: { ar: Math.round(phi * 1000) / 1000, ma: Math.round(theta * 1000) / 1000, intercept: Math.round(intercept * 1000) / 1000 },
    fitted,
    residuals,
    forecast,
    aic: Math.round(aic * 100) / 100,
    mse: Math.round(mse * 10000) / 10000,
  };
}

// ─── Holt-Winters Triple Exponential Smoothing ───

/**
 * Holt-Winters additive model for seasonal data.
 * Level:    L_t = α(Y_t − S_{t−m}) + (1−α)(L_{t−1} + T_{t−1})
 * Trend:    T_t = β(L_t − L_{t−1}) + (1−β)T_{t−1}
 * Seasonal: S_t = γ(Y_t − L_t) + (1−γ)S_{t−m}
 */
export function fitHoltWinters(
  data: TimePoint[],
  period: number = 4,      // seasonality period (e.g., 4 for quarterly, 12 for monthly)
  forecastHorizon: number = 12,
): HoltWintersResult {
  const values = data.map(d => d.value);
  const n = values.length;
  if (n < period * 2) throw new Error('Need at least 2 periods of data');

  // Initial level, trend, seasonal
  const initLevel = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const initTrend = (values.slice(period, period * 2).reduce((s, v) => s + v, 0) - 
                     values.slice(0, period).reduce((s, v) => s + v, 0)) / (period * period);

  const seasonal: number[] = [];
  for (let i = 0; i < period; i++) {
    seasonal.push(values[i] - initLevel);
  }

  // Grid search for optimal alpha, beta, gamma
  const candidates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  let bestMSE = Infinity;
  let bestAlpha = 0.5, bestBeta = 0.3, bestGamma = 0.2;
  let bestLevel: number[] = [], bestTrend: number[] = [], bestSeasonal: number[] = [], bestFitted: number[] = [];

  for (const alpha of candidates) {
    for (const beta of candidates) {
      for (const gamma of candidates.slice(0, 3)) { // gamma usually small
        const level: number[] = [initLevel];
        const trend: number[] = [initTrend];
        const s = [...seasonal];
        const fitted: number[] = [];

        for (let t = 0; t < n; t++) {
          const seasIdx = t % period;
          fitted.push(level[t] + trend[t] + s[seasIdx]);

          if (t < n - 1) {
            const newLevel = alpha * (values[t] - s[seasIdx]) + (1 - alpha) * (level[t] + trend[t]);
            const newTrend = beta * (newLevel - level[t]) + (1 - beta) * trend[t];
            level.push(newLevel);
            trend.push(newTrend);
            s[seasIdx] = gamma * (values[t] - newLevel) + (1 - gamma) * s[seasIdx];
          }
        }

        const mse = fitted.reduce((s, f, i) => s + Math.pow(f - values[i], 2), 0) / n;
        if (mse < bestMSE) {
          bestMSE = mse;
          bestAlpha = alpha; bestBeta = beta; bestGamma = gamma;
          bestLevel = [...level]; bestTrend = [...trend]; bestSeasonal = [...s]; bestFitted = [...fitted];
        }
      }
    }
  }

  // Forecast
  const forecast: ForecastPoint[] = [];
  const lastLevel = bestLevel[bestLevel.length - 1];
  const lastTrend = bestTrend[bestTrend.length - 1];
  const residuals = bestFitted.map((f, i) => values[i] - f);
  const se = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 3));

  for (let h = 1; h <= forecastHorizon; h++) {
    const seasIdx = (n + h - 1) % period;
    const val = lastLevel + h * lastTrend + bestSeasonal[seasIdx];
    const ci = 1.96 * se * Math.sqrt(h);
    forecast.push({
      time: data[n - 1].time + h,
      value: Math.round(val * 100) / 100,
      ci95_low: Math.round((val - ci) * 100) / 100,
      ci95_high: Math.round((val + ci) * 100) / 100,
    });
  }

  return {
    level: bestLevel, trend: bestTrend, seasonal: bestSeasonal,
    fitted: bestFitted, forecast,
    alpha: bestAlpha, beta: bestBeta, gamma: bestGamma,
    mse: Math.round(bestMSE * 10000) / 10000,
  };
}

// ─── What-if Scenario Engine ───

export interface ScenarioInput {
  baseline: TimePoint[];
  modifierName: string;
  modifierEffect: number; // 1.0 = no change, >1 = increase, <1 = decrease
  startWeek: number;
  durationWeeks: number;
}

export interface ScenarioResult {
  baseline: TimePoint[];
  scenario: TimePoint[];
  impact: number;        // percentage change at end of scenario
  peakImpact: number;
  peakWeek: number;
}

export function simulateScenario(input: ScenarioInput, forecastWeeks: number = 12): ScenarioResult {
  const modified: TimePoint[] = JSON.parse(JSON.stringify(input.baseline));

  let peakImpact = 0;
  let peakWeek = 0;

  for (let i = 0; i < modified.length; i++) {
    const week = modified[i].time;
    if (week >= input.startWeek) {
      const elapsed = Math.min(week - input.startWeek, input.durationWeeks);
      const progress = elapsed / Math.max(1, input.durationWeeks);
      const effect = 1 + (input.modifierEffect - 1) * progress;
      modified[i].value = input.baseline[i].value * effect;

      const impact = Math.abs(effect - 1) * 100;
      if (impact > peakImpact) { peakImpact = impact; peakWeek = week; }
    }
  }

  // Extend forecast
  const lastBase = input.baseline[input.baseline.length - 1];
  const lastMod = modified[modified.length - 1];
  for (let w = 1; w <= forecastWeeks; w++) {
    modified.push({ time: lastBase.time + w, value: lastMod.value * (1 + (input.modifierEffect - 1) * 0.5) });
  }

  const finalImpact = Math.abs(modified[modified.length - 1].value - 
    (input.baseline[input.baseline.length - 1]?.value || 0)) / 
    Math.max(0.01, input.baseline[input.baseline.length - 1]?.value || 1) * 100;

  return {
    baseline: input.baseline,
    scenario: modified,
    impact: Math.round(finalImpact * 10) / 10,
    peakImpact: Math.round(peakImpact * 10) / 10,
    peakWeek,
  };
}

// ─── Combined Predictor for Labs/Readiness ───

export interface PredictorInput {
  history: TimePoint[];
  method: 'arima' | 'holtwinters' | 'auto';
  seasonality?: number;
  horizon?: number;
}

export function predict(input: PredictorInput): ForecastPoint[] {
  const { history, method, seasonality, horizon } = input;
  const h = horizon || 12;

  if (history.length < 4) {
    // Linear extrapolation fallback
    const n = history.length;
    const last = history[n - 1];
    const slope = n >= 2 ? (history[n - 1].value - history[0].value) / n : 0;
    return Array.from({ length: h }, (_, i) => ({
      time: last.time + i + 1,
      value: Math.round((last.value + slope * (i + 1)) * 100) / 100,
      ci95_low: 0, ci95_high: 0,
    }));
  }

  const season = seasonality || 4;

  if (method === 'arima') {
    return fitARIMA111(history, h).forecast;
  }
  if (method === 'holtwinters') {
    return fitHoltWinters(history, season, h).forecast;
  }
  // Auto: use Holt-Winters if enough data for seasonality, otherwise ARIMA
  if (history.length >= season * 2) {
    return fitHoltWinters(history, season, h).forecast;
  }
  return fitARIMA111(history, h).forecast;
}
