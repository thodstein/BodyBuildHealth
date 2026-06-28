import { LabPoint } from '../core/types';
import { resolveLabMarker } from '../core/labs-mapping';
import { UCUM_MAP } from '../core/constants';
import { db } from '../core/db';
export { UCUM_MAP };

export interface LabForecast {
  current: number;
  w2: number; w4: number; w6: number; w8: number; w12: number;
  w2_ci_low?: number; w2_ci_high?: number;
  w4_ci_low?: number; w4_ci_high?: number;
  w6_ci_low?: number; w6_ci_high?: number;
  w8_ci_low?: number; w8_ci_high?: number;
  w12_ci_low?: number; w12_ci_high?: number;
  slope: number;
  r2: number;
  alert?: string;
}

// ─── LOINC codes mapped to internal marker IDs ───
export const LOINC_MAP: Record<string, { code: string; name: string }> = {
  ALT: { code: '1742-6', name: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
  AST: { code: '1920-8', name: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
  HCT: { code: '4544-3', name: 'Hematocrit [Volume Fraction] of Blood' },
  HGB: { code: '718-7', name: 'Hemoglobin [Mass/volume] in Blood' },
  TT: { code: '2986-8', name: 'Testosterone [Mass/volume] in Serum or Plasma' },
  E2: { code: '35365-6', name: 'Estradiol [Mass/volume] in Serum or Plasma' },
  PRL: { code: '20568-2', name: 'Prolactin [Mass/volume] in Serum or Plasma' },
  TSH: { code: '3016-3', name: 'Thyrotropin [Units/volume] in Serum or Plasma' },
  FT3: { code: '3051-0', name: 'Triiodothyronine.free [Mass/volume] in Serum or Plasma' },
  FT4: { code: '3024-7', name: 'Thyroxine.free [Mass/volume] in Serum or Plasma' },
  GLU: { code: '2339-0', name: 'Glucose [Mass/volume] in Blood' },
  CREATININE: { code: '2160-0', name: 'Creatinine [Mass/volume] in Serum or Plasma' },
  LDL: { code: '2089-1', name: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma' },
  HDL: { code: '2085-9', name: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma' },
  TG: { code: '2571-8', name: 'Triglyceride [Mass/volume] in Serum or Plasma' },
  CRP: { code: '1988-5', name: 'C reactive protein [Mass/volume] in Serum or Plasma' },
  PSA: { code: '2857-1', name: 'Prostate specific Ag [Mass/volume] in Serum or Plasma' },
  LH: { code: '10501-5', name: 'Lutropin [Units/volume] in Serum or Plasma' },
  FSH: { code: '15067-2', name: 'Follitropin [Units/volume] in Serum or Plasma' },
  GGT: { code: '2324-2', name: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma' },
  INSULIN: { code: '20448-7', name: 'Insulin [Units/volume] in Serum or Plasma' },
  HbA1c: { code: '4548-4', name: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
  VITD: { code: '1989-3', name: '25-Hydroxyvitamin D3 [Mass/volume] in Serum' },
  FERRITIN: { code: '2276-4', name: 'Ferritin [Mass/volume] in Serum or Plasma' },
  D_DIMER: { code: '48065-7', name: 'Fibrin D-dimer [Mass/volume] in Platelet poor plasma' },
  TROPONIN: { code: '42757-5', name: 'Troponin I.cardiac [Mass/volume] in Blood' },
  CORTISOL: { code: '2143-6', name: 'Cortisol [Mass/volume] in Serum or Plasma' },
  SHBG: { code: '13967-5', name: 'Sex hormone binding globulin [Mass/volume] in Serum or Plasma' },
  DHT: { code: '1854-9', name: 'Dihydrotestosterone [Mass/volume] in Serum or Plasma' },
  IGF1: { code: '2484-4', name: 'Insulin-like growth factor-I [Mass/volume] in Serum or Plasma' },
  AMH: { code: '49012-2', name: 'Anti-Mullerian hormone [Mass/volume] in Serum or Plasma' },
};

// ─── Phase-adjusted reference ranges ───
export type LabPhase = 'baseline' | 'on_cycle' | 'pct' | 'bridge';

interface PhaseRange {
  uln: number; lln: number;
}

const PHASE_ADJUSTED_RANGES: Record<string, Record<LabPhase, PhaseRange>> = {
  TT: {
    baseline: { uln: 900, lln: 300 },
    on_cycle: { uln: 3500, lln: 500 },
    pct: { uln: 900, lln: 150 },
    bridge: { uln: 1200, lln: 300 },
  },
  E2: {
    baseline: { uln: 50, lln: 10 },
    on_cycle: { uln: 80, lln: 15 },
    pct: { uln: 50, lln: 5 },
    bridge: { uln: 60, lln: 10 },
  },
  HCT: {
    baseline: { uln: 50, lln: 38 },
    on_cycle: { uln: 54, lln: 40 },
    pct: { uln: 50, lln: 38 },
    bridge: { uln: 52, lln: 38 },
  },
  LH: {
    baseline: { uln: 10, lln: 1.5 },
    on_cycle: { uln: 3, lln: 0.1 },
    pct: { uln: 15, lln: 3 },
    bridge: { uln: 10, lln: 1.5 },
  },
  FSH: {
    baseline: { uln: 12, lln: 1.5 },
    on_cycle: { uln: 3, lln: 0.1 },
    pct: { uln: 15, lln: 3 },
    bridge: { uln: 12, lln: 1.5 },
  },
};

interface StoredLabPoint extends LabPoint {
  patientId: string;
}

/**
 * Normalize a lab value to UCUM units.
 * @param code Lab code (e.g., 'TT', 'E2')
 * @param value The value to normalize
 * @param unit The unit of the value
 * @returns Normalized value and unit, plus reference ranges if available
 */
export function normalizeLab(code: string, value: number, unit: string, phase?: LabPhase): { norm: number; unit: string; ref?: { uln: number; lln: number } } {
  const ucum = UCUM_MAP[code];
  if (!ucum) return { norm: value, unit };

  const norm = value * ucum.coeff;
  const phaseRef = phase ? PHASE_ADJUSTED_RANGES[code]?.[phase] : undefined;
  const ref = phaseRef || { uln: ucum.uln, lln: ucum.lln };

  return { norm, unit: ucum.prefUnit, ref };
}

/**
 * Check if a lab value is abnormal based on UCUM normalized values and reference ranges.
 * @param code Lab code
 * @param value The value to check
 * @param unit The unit of the value
 * @param phase Optional phase (e.g., 'cycle', 'therapy') for adjusted ranges
 * @returns True if abnormal
 */
export function isAbnormal(code: string, value: number, unit: string, phase?: LabPhase): boolean {
  const ucum = UCUM_MAP[code];
  if (!ucum) return false;
  const normValue = value * ucum.coeff;
  const phaseRef = phase ? PHASE_ADJUSTED_RANGES[code]?.[phase] : undefined;
  const { uln, lln } = phaseRef || ucum;
  return normValue < lln || normValue > uln;
}

/**
 * Predict future lab values with 95% confidence intervals.
 * Uses linear regression with standard error estimation.
 */
export function predictLab(points: LabPoint[], code: string, phase?: LabPhase): LabForecast | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  // Convert dates to week numbers relative to first point
  const dates = sorted.map(p => new Date(p.date).getTime());
  const t0 = dates[0];
  const weeks = dates.map(d => (d - t0) / (7 * 24 * 3600 * 1000));

  // Linear regression: y = a + b*x
  const sumX = weeks.reduce((a, v) => a + v, 0);
  const sumY = sorted.reduce((a, p) => a + p.value, 0);
  const sumXY = weeks.reduce((a, x, i) => a + x * sorted[i].value, 0);
  const sumXX = weeks.reduce((a, x) => a + x * x, 0);
  const sumYY = sorted.reduce((a, p) => a + p.value * p.value, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² goodness of fit
  const yMean = sumY / n;
  const ssRes = sorted.reduce((a, p, i) => a + Math.pow(p.value - (intercept + slope * weeks[i]), 2), 0);
  const ssTot = sumYY - n * yMean * yMean;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Standard error of prediction
  const se = Math.sqrt(ssRes / Math.max(1, n - 2));

  const current = sorted[n - 1].value;
  const lastWeek = weeks[n - 1];

  // Forecast weeks ahead with 95% CI (±1.96 × SE × sqrt(1 + 1/n + (x-meanX)²/Sxx))
  const meanX = sumX / n;
  const sxx = sumXX - n * meanX * meanX;

  const forecastAt = (w: number): { val: number; low: number; high: number } => {
    const x = lastWeek + w;
    const val = intercept + slope * x;
    const sePred = se * Math.sqrt(1 + 1 / n + Math.pow(x - meanX, 2) / Math.max(0.01, sxx));
    return { val, low: val - 1.96 * sePred, high: val + 1.96 * sePred };
  };

  const w2 = forecastAt(2);
  const w4 = forecastAt(4);
  const w6 = forecastAt(6);
  const w8 = forecastAt(8);
  const w12 = forecastAt(12);

  // Phase-adjusted ranges for alert
  let alert: string | undefined;
  const phaseRanges = phase ? PHASE_ADJUSTED_RANGES[code]?.[phase] : undefined;
  const ucum = UCUM_MAP[code];
  const ref = phaseRanges || ucum;
  if (ref && w6.val > ref.uln) alert = `⚠️ ${code}: прогноз превышает верхнюю границу (${ref.uln}) через 6 недель`;

  return {
    current, slope: Math.round(slope * 1000) / 1000, r2: Math.round(r2 * 1000) / 1000,
    w2: w2.val, w2_ci_low: w2.low, w2_ci_high: w2.high,
    w4: w4.val, w4_ci_low: w4.low, w4_ci_high: w4.high,
    w6: w6.val, w6_ci_low: w6.low, w6_ci_high: w6.high,
    w8: w8.val, w8_ci_low: w8.low, w8_ci_high: w8.high,
    w12: w12.val, w12_ci_low: w12.low, w12_ci_high: w12.high,
    alert,
  };
}

/**
 * Add a lab point for a patient.
 * @param patientId Patient ID
 * @param point Lab point to add
 */
export async function addLabPoint(patientId: string, point: LabPoint): Promise<void> {
  await db.put('labs_log', { ...point, patientId } as StoredLabPoint);
}

/**
 * Get lab history for a patient and lab code.
 * @param patientId Patient ID
 * @param code Lab code
 * @returns Array of lab points for the given code, sorted by date
 */
export async function getLabHistory(patientId: string, code: string): Promise<LabPoint[]> {
  const allPoints = await db.getAll<StoredLabPoint>('labs_log');
  const points = allPoints
    .filter(p => p.patientId === patientId && p.code === code)
    .sort((a, b) => a.date.localeCompare(b.date));
  return points.map(p => {
    const { patientId, ...labPoint } = p;
    return labPoint;
  });
}

/**
 * Get lab trend and forecast for a patient and lab code.
 * @param patientId Patient ID
 * @param code Lab code
 * @param weeksAhead Number of weeks to forecast (default 12)
 * @returns Trend object or null if insufficient data
 */
export async function getLabTrend(patientId: string, code: string, weeksAhead: number = 12): Promise<{ current: number; forecast: number; slope: number; r2: number; alert?: string } | null> {
  const points = await getLabHistory(patientId, code);
  if (points.length < 2) return null;
  const fc = predictLab(points, code);
  if (!fc) return null;
  const forecast = fc.current + fc.slope * weeksAhead;
  return { current: fc.current, forecast: Math.round(forecast * 100) / 100, slope: fc.slope, r2: fc.r2, alert: fc.alert };
}

/**
 * Mock HL7 message sending.
 * @param message HL7 message string
 * @returns Promise resolving with a mock message ID
 */
export function sendHL7Message(message: string): Promise<string> {
  return Promise.resolve(`MSG-${Date.now()}`);
}

/**
 * Mock HL7 message receiving.
 * @param messageId Message ID to receive
 * @returns Promise resolving with a mock HL7 message
 */
export function receiveHL7Message(messageId: string): Promise<string> {
  return Promise.resolve(`Mock HL7 response for ${messageId}`);
}

/**
 * Parse HL7 FHIR observation into a LabPoint.
 * @param obs FHIR observation object
 * @param patientId Patient ID
 * @returns LabPoint
 */
export function parseFHIRObservation(obs: any, patientId: string): LabPoint {
   // Handle FHIR Observation resource format
   const code = obs.code?.coding?.[0]?.code || obs.code?.text || 'UNKNOWN';
   const name = obs.code?.coding?.[0]?.display || obs.code?.text || 'UNKNOWN';
   const value = obs.valueQuantity?.value ?? 0;
   const unit = obs.valueQuantity?.unit ?? obs.valueQuantity?.code ?? '';
   const date = obs.effectiveDateTime ?? obs.issued ?? new Date().toISOString();
   const extractedDate = date.split('T')[0]; // Extract just the date part
   
   return {
     id: obs.id ?? Math.random().toString(36).substr(2, 9),
     patientId,
     code: resolveLabMarker(code) || code, // Try to resolve to standard UCUM code
     name,
     value,
     unit,
     date: extractedDate,
     phase: 'baseline' // In a full implementation, this would come from context
   };
}

/**
 * Send HL7 v2 message (mock implementation for interface compliance)
 * @param message HL7 v2 message string
 * @returns Promise resolving with a mock message ID
 */
export function sendHL7v2Message(message: string): Promise<string> {
   return Promise.resolve(`HL7MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
}

/**
 * Receive/process HL7 v2 message (mock implementation for interface compliance)
 * @param messageId Message ID to receive
 * @returns Promise resolving with parsed HL7 message
 */
export function receiveHL7v2Message(messageId: string): Promise<string> {
   return Promise.resolve(`MSH|^~\\&|SENDING_FACILITY|RECEIVING_FACILITY|${new Date().toISOString()}||ORU^R01|${messageId}|P|2.5.1\rPID|1||PATIENT123^^^Hospital^MR||DOE^JOHN||19800101|M\rOBR|1||${messageId}^LAB^L||20230101080000|||^^^|||F|||||||||`);
}

/**
 * Convert LabPoint to HL7 v2 format OBX segment
 * @param point Lab point to convert
 * @returns HL7 v2 OBX segment string
 */
export function toHL7v2OBX(point: LabPoint & { patientId?: string }): string {
   const obsId = point.id ?? Math.random().toString(36).substr(2, 9);
   return `OBX|1|NM|${point.code}^${point.name}||${point.value}${point.unit ? `^${point.unit}` : ''}||||||F|||${obsId}`;
}
