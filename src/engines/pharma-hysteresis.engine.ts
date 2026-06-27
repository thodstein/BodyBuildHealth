// ============================================================
// pharma-hysteresis.engine.ts — Pharmacodynamic Hysteresis Model
// dMarker/dt = (E(t−τ) − Marker) / τ
// E(t) — drug effect at time t (Hill function)
// τ — time constant of biological response
// τ_delay — transport/absorption delay
// ============================================================

export interface HysteresisInput {
  /** Drug dose per administration (mg) */
  doseMg: number;
  /** Dosing interval (hours) */
  dosingIntervalHours: number;
  /** Drug half-life (hours) */
  halfLifeHours: number;
  /** EC50 — concentration for 50% effect */
  ec50: number;
  /** Hill coefficient */
  nHill: number;
  /** Time constant of biological response (hours) */
  tauResponse: number;
  /** Transport/absorption delay (hours) */
  tauDelay: number;
  /** Volume of distribution */
  volumeOfDistribution: number;
  /** Bioavailability (0-1) */
  bioavailability: number;
  /** Absorption rate constant (1/hours) */
  ka: number;
  /** Elimination rate constant (1/hours) */
  ke?: number;
  /** Simulation duration (hours) */
  totalHours: number;
  /** Time step for Euler integration (hours) — smaller = more accurate */
  dtHours?: number;
}

export interface HysteresisPoint {
  timeHours: number;
  concentration: number;
  effectTarget: number;   // E(t) — immediate drug effect
  effectDelayed: number;  // E(t−τ_delay) — delayed effect
  marker: number;         // Biological marker (solution of ODE)
}

export interface HysteresisResult {
  points: HysteresisPoint[];
  peakConcentration: number;
  peakConcentrationTime: number;
  peakEffect: number;
  peakEffectTime: number;
  peakMarker: number;
  peakMarkerTime: number;
  timeToSteadyState: number;
  steadyStateMarker: number;
  auc: number;
}

export function simulateHysteresis(input: HysteresisInput): HysteresisResult {
  const {
    doseMg, dosingIntervalHours, halfLifeHours, ec50, nHill,
    tauResponse, tauDelay, volumeOfDistribution, bioavailability,
    ka, totalHours,
  } = input;

  const ke = input.ke || Math.LN2 / halfLifeHours;
  const dt = input.dtHours || Math.min(0.5, halfLifeHours / 10);
  const steps = Math.ceil(totalHours / dt);

  const points: HysteresisPoint[] = [];

  // Initial conditions
  let concentration = 0;
  let marker = 0;
  const concentrationHistory: number[] = []; // for delay buffer

  // For delayed effect: store concentration history
  const delaySteps = Math.ceil(tauDelay / dt);
  const delayBuffer = new Array(delaySteps).fill(0);
  let delayIdx = 0;

  let peakConc = 0, peakConcTime = 0;
  let peakEff = 0, peakEffTime = 0;
  let peakMarker = 0, peakMarkerTime = 0;
  let auc = 0;
  let steadyReached = false;
  let timeToSteady = totalHours;
  let steadyMarker = 0;

  for (let step = 0; step < steps; step++) {
    const t = step * dt;

    // === PK: One-compartment model with absorption ===
    // dC/dt = ka * D/Vd * F * δ(t mod dosingInterval) − ke * C
    const isDosing = (t % dosingIntervalHours) < dt;
    const doseInput = isDosing ? (ka * doseMg / volumeOfDistribution * bioavailability) : 0;

    // Euler integration for concentration
    const dC = doseInput - ke * concentration;
    concentration = Math.max(0, concentration + dC * dt);

    // Update delay buffer
    delayBuffer[delayIdx] = concentration;
    delayIdx = (delayIdx + 1) % delaySteps;

    // === PD: Hill function for drug effect ===
    const cn = Math.pow(Math.max(0.001, concentration), nHill);
    const ec50n = Math.pow(ec50, nHill);
    const effectTarget = cn / (ec50n + cn); // E(t) — immediate effect

    // Delayed effect: concentration at time (t − τ_delay)
    const concDelayed = delayBuffer[(delayIdx + delaySteps - 1) % delaySteps] || 0;
    const cnD = Math.pow(Math.max(0.001, concDelayed), nHill);
    const effectDelayed = cnD / (ec50n + cnD); // E(t−τ)

    // === Hysteresis ODE: dMarker/dt = (E(t−τ) − Marker) / τ ===
    const dMarker = (effectDelayed - marker) / Math.max(0.1, tauResponse);
    marker = Math.max(0, Math.min(1, marker + dMarker * dt));

    // Track peaks
    if (concentration > peakConc) { peakConc = concentration; peakConcTime = t; }
    if (effectDelayed > peakEff) { peakEff = effectDelayed; peakEffTime = t; }
    if (marker > peakMarker) { peakMarker = marker; peakMarkerTime = t; }

    auc += marker * dt;

    // Detect steady state: marker change < 0.1% over 100 time steps
    if (t > 100 * dt) {
      const prev = points[points.length - 100]?.marker || 0;
      if (!steadyReached && Math.abs(marker - prev) < 0.001) {
        steadyReached = true;
        timeToSteady = t;
        steadyMarker = marker;
      }
    }

    points.push({
      timeHours: Math.round(t * 100) / 100,
      concentration: Math.round(concentration * 1000) / 1000,
      effectTarget: Math.round(effectTarget * 1000) / 1000,
      effectDelayed: Math.round(effectDelayed * 1000) / 1000,
      marker: Math.round(marker * 1000) / 1000,
    });
  }

  return {
    points,
    peakConcentration: Math.round(peakConc * 100) / 100,
    peakConcentrationTime: Math.round(peakConcTime * 100) / 100,
    peakEffect: Math.round(peakEff * 100) / 100,
    peakEffectTime: Math.round(peakEffTime * 100) / 100,
    peakMarker: Math.round(peakMarker * 100) / 100,
    peakMarkerTime: Math.round(peakMarkerTime * 100) / 100,
    timeToSteadyState: Math.round(timeToSteady * 10) / 10,
    steadyStateMarker: Math.round(steadyMarker * 1000) / 1000,
    auc: Math.round(auc * 100) / 100,
  };
}

// ─── Rebound Model: A·e^(−λt)·sin(2πt/T) + Overshoot ───

export interface ReboundInput {
  /** Amplitude of rebound oscillation */
  amplitude: number;
  /** Decay rate (1/hours) */
  lambda: number;
  /** Oscillation period (hours) */
  periodHours: number;
  /** Overshoot factor (how much above steady state) */
  overshoot: number;
  /** Simulation start time (hours) — when drug is removed */
  startTime: number;
  /** Total simulation hours */
  totalHours: number;
  /** Time step */
  dtHours?: number;
}

export function simulateRebound(input: ReboundInput): HysteresisPoint[] {
  const { amplitude, lambda, periodHours, overshoot, startTime, totalHours } = input;
  const dt = input.dtHours || 1;
  const points: HysteresisPoint[] = [];

  for (let t = 0; t <= totalHours; t += dt) {
    let value = 0;
    if (t >= startTime) {
      const elapsed = t - startTime;
      const expDecay = Math.exp(-lambda * elapsed);
      const oscillation = Math.sin(2 * Math.PI * elapsed / Math.max(0.1, periodHours));
      value = overshoot + amplitude * expDecay * oscillation;
    }

    points.push({
      timeHours: Math.round(t * 100) / 100,
      concentration: 0,
      effectTarget: 0,
      effectDelayed: 0,
      marker: Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000,
    });
  }

  return points;
}

// ─── Bayesian Kalman Filter for Biomarker Tracking ───

export interface KalmanState {
  /** Current estimate of the marker value */
  estimate: number;
  /** Estimate uncertainty (variance) */
  variance: number;
  /** Process noise (how much the true value changes per step) */
  processNoise: number;
  /** Measurement noise (how noisy the lab measurement is) */
  measurementNoise: number;
}

export function kalmanUpdate(
  state: KalmanState,
  measurement: number,
  prediction: number,
): KalmanState {
  // Prediction step (already given as `prediction`)
  const predictedEstimate = prediction;
  const predictedVariance = state.variance + state.processNoise;

  // Update step with measurement
  const kalmanGain = predictedVariance / (predictedVariance + state.measurementNoise);
  const newEstimate = predictedEstimate + kalmanGain * (measurement - predictedEstimate);
  const newVariance = (1 - kalmanGain) * predictedVariance;

  return {
    estimate: Math.round(newEstimate * 1000) / 1000,
    variance: Math.round(newVariance * 10000) / 10000,
    processNoise: state.processNoise,
    measurementNoise: state.measurementNoise,
  };
}

export function createKalmanState(
  initialEstimate: number,
  initialVariance: number,
  processNoise: number,
  measurementNoise: number,
): KalmanState {
  return { estimate: initialEstimate, variance: initialVariance, processNoise, measurementNoise };
}

// ─── Combined Pharma Predictor ───

export interface PharmaPredictorInput {
  /** List of drugs in the course */
  drugs: Array<{
    substanceId: string;
    doseMg: number;
    dosingIntervalHours: number;
    halfLifeHours: number;
    ec50: number;
    nHill: number;
    ka: number;
    ke?: number;
    volumeOfDistribution: number;
    bioavailability: number;
    startWeek: number;
    endWeek: number;
  }>;
  /** Target biomarker to track */
  biomarkerId: string;
  /** Hysteresis parameters for this biomarker */
  tauResponse: number;
  tauDelay: number;
  /** Initial biomarker value (0-1 normalized) */
  initialMarker: number;
  /** Historical lab measurements for Kalman filter */
  labHistory?: Array<{ week: number; value: number }>;
  /** Total simulation weeks */
  totalWeeks: number;
}

export interface PharmaPredictorResult {
  weeklyMarkers: Array<{ week: number; marker: number; kalmanEstimate?: number }>;
  peakMarker: number;
  peakWeek: number;
  timeToSteady: number;
  reboundWeeks: Array<{ week: number; marker: number }>;
}

export function predictPharmaBiomarker(input: PharmaPredictorInput): PharmaPredictorResult {
  const totalHours = input.totalWeeks * 7 * 24;
  const dt = 1; // 1 hour step

  // Simulate combined drug effect
  let combinedMarker = input.initialMarker;
  const hourlyMarkers: number[] = [];

  for (let h = 0; h < totalHours; h += dt) {
    let totalEffect = 0;

    for (const drug of input.drugs) {
      const week = h / (7 * 24);
      if (week < drug.startWeek || week > drug.endWeek) continue;

      // Steady-state drug effect
      const ke = drug.ke || Math.LN2 / drug.halfLifeHours;
      const avgConcentration = (drug.doseMg / drug.volumeOfDistribution * drug.bioavailability) /
        (ke * drug.dosingIntervalHours);

      const cn = Math.pow(Math.max(0.001, avgConcentration), drug.nHill);
      const eff = cn / (Math.pow(drug.ec50, drug.nHill) + cn);

      totalEffect = 1 - (1 - totalEffect) * (1 - eff); // Combined independent effects
    }

    // Hysteresis
    const dM = (totalEffect - combinedMarker) / Math.max(0.1, input.tauResponse);
    combinedMarker = Math.max(0, Math.min(1, combinedMarker + dM * dt));
    hourlyMarkers.push(combinedMarker);
  }

  // Aggregate by week
  const weeklyMarkers: PharmaPredictorResult['weeklyMarkers'] = [];
  let peakMarker = 0, peakWeek = 0;

  for (let w = 0; w < input.totalWeeks; w++) {
    const startIdx = Math.floor(w * 7 * 24 / dt);
    const endIdx = Math.floor((w + 1) * 7 * 24 / dt);
    const slice = hourlyMarkers.slice(startIdx, endIdx);
    const avgMarker = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;

    weeklyMarkers.push({
      week: w,
      marker: Math.round(avgMarker * 1000) / 1000,
    });

    if (avgMarker > peakMarker) { peakMarker = avgMarker; peakWeek = w; }
  }

  // Kalman update from lab history
  let kalman = createKalmanState(input.initialMarker, 0.1, 0.01, 0.05);
  for (const lab of (input.labHistory || [])) {
    const idx = lab.week;
    if (idx < weeklyMarkers.length) {
      kalman = kalmanUpdate(kalman, lab.value, weeklyMarkers[idx].marker);
      weeklyMarkers[idx].kalmanEstimate = kalman.estimate;
    }
  }

  // Time to steady state
  let timeToSteady = input.totalWeeks;
  for (let w = 1; w < input.totalWeeks; w++) {
    if (Math.abs(weeklyMarkers[w].marker - weeklyMarkers[w - 1].marker) < 0.005) {
      timeToSteady = w;
      break;
    }
  }

  // Rebound: after last drug end, simulate washout
  const lastDrugEnd = Math.max(...input.drugs.map(d => d.endWeek));
  const reboundWeeks: PharmaPredictorResult['reboundWeeks'] = [];
  if (lastDrugEnd < input.totalWeeks) {
    const lambda = 0.3; // default decay
    const rebound = simulateRebound({
      amplitude: peakMarker * 0.3,
      lambda,
      periodHours: 24 * 7, // 1 week oscillation
      overshoot: 0,
      startTime: 0,
      totalHours: (input.totalWeeks - lastDrugEnd) * 7 * 24,
    });

    for (const pt of rebound) {
      const week = lastDrugEnd + pt.timeHours / (7 * 24);
      reboundWeeks.push({ week: Math.round(week * 10) / 10, marker: pt.marker });
    }
  }

  return {
    weeklyMarkers,
    peakMarker: Math.round(peakMarker * 1000) / 1000,
    peakWeek,
    timeToSteady,
    reboundWeeks,
  };
}
