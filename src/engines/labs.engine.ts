import { LabPoint } from '../core/types';
import { resolveLabMarker } from '../core/labs-mapping';
import { UCUM_MAP } from '../core/constants';
import { db } from '../core/db';
export { UCUM_MAP };

export interface LabForecast {
  current: number;
  w4: number;
  w8: number;
  w12: number;
  alert?: string;
}

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
export function normalizeLab(code: string, value: number, unit: string): { norm: number; unit: string; ref?: { uln: number; lln: number } } {
  const ucum = UCUM_MAP[code];
  if (!ucum) {
    return { norm: value, unit };
  }
  // Convert to UCUM unit
  const norm = value * ucum.coeff;
  return {
    norm,
    unit: ucum.prefUnit,
    ref: { uln: ucum.uln, lln: ucum.lln }
  };
}

/**
 * Check if a lab value is abnormal based on UCUM normalized values and reference ranges.
 * @param code Lab code
 * @param value The value to check
 * @param unit The unit of the value
 * @param phase Optional phase (e.g., 'cycle', 'therapy') for adjusted ranges
 * @returns True if abnormal
 */
export function isAbnormal(code: string, value: number, unit: string, phase?: string): boolean {
   const ucum = UCUM_MAP[code];
   if (!ucum) {
       // If we don't have UCUM mapping, we can't properly check normal ranges
       return false;
   }

   // Convert to UCUM unit
   const normValue = value * ucum.coeff;

   // Get reference ranges (these could be phase-specific in a full implementation)
   const { uln, lln } = ucum;

   // Check if value is outside reference ranges
   return normValue < lln || normValue > uln;
}

/**
 * Predict future lab values based on trend.
 * @param points Array of lab points
 * @param code Lab code to predict for
 * @returns Forecast object or null if insufficient data
 */
export function predictLab(points: LabPoint[], code: string): LabForecast | null {
  if (points.length < 2) {
    return null;
  }
  // Sort points by date
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  // Simple linear regression for demonstration
  const n = sorted.length;
  const sumX = sorted.reduce((acc, pt, idx) => acc + idx, 0);
  const sumY = sorted.reduce((acc, pt) => acc + pt.value, 0);
  const sumXY = sorted.reduce((acc, pt, idx) => acc + pt.value * idx, 0);
  const sumXX = sorted.reduce((acc, _, idx) => acc + idx * idx, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  // Current value is the last point
  const current = sorted[sorted.length - 1].value;
  // Forecast for 4, 8, 12 weeks ahead (assuming points are weekly)
  const w4 = current + slope * 4;
  const w8 = current + slope * 8;
  const w12 = current + slope * 12;
  let alert: string | undefined;
  // Check if forecast goes beyond normal ranges? We'll skip for now.
  return { current, w4, w8, w12, alert };
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
export async function getLabTrend(patientId: string, code: string, weeksAhead: number = 12): Promise<{ current: number; forecast: number; slope: number; alert?: string } | null> {
  const points = await getLabHistory(patientId, code);
  if (points.length < 2) {
    return null;
  }
  const forecastObj = predictLab(points, code);
  if (!forecastObj) {
    return null;
  }
  // We'll use the w12 as the forecast for weeksAhead
  const slope = (forecastObj.w12 - forecastObj.current) / 12; // per week
  const forecast = forecastObj.current + slope * weeksAhead;
  return {
    current: forecastObj.current,
    forecast,
    slope,
    alert: forecastObj.alert
  };
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
   // In a real implementation, this would send to an HL7 listener/via MLLP
   console.log('Sending HL7 v2 message:', message);
   return Promise.resolve(`HL7MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
}

/**
 * Receive/process HL7 v2 message (mock implementation for interface compliance)
 * @param messageId Message ID to receive
 * @returns Promise resolving with parsed HL7 message
 */
export function receiveHL7v2Message(messageId: string): Promise<string> {
   // In a real implementation, this would retrieve from a message queue or database
   console.log('Receiving HL7 v2 message with ID:', messageId);
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
