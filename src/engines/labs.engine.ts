import { LabPoint } from '../core/types';
import { resolveLabMarker } from '../core/labs-mapping';
import { UCUM_MAP, ucumInfo } from '../core/constants';
import { boundProvesSide } from '../core/lab-bound';
export { UCUM_MAP };

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

/**
 * Normalize a lab value to UCUM units.
 * @param code Lab code (e.g., 'TT', 'E2')
 * @param value The value to normalize
 * @param unit The unit of the value
 * @returns Normalized value and unit, plus reference ranges if available
 */
export function normalizeLab(code: string, value: number, unit: string, phase?: LabPhase): { norm: number; unit: string; ref?: { uln: number; lln: number } } {
  // Проход 174: каталог ищется одним правилом (`ucumInfo`): смешанный регистр
  // ключа (`HbA1c`) больше не теряет ни норму, ни единицу.
  const ucum = ucumInfo(code);
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
  const ucum = ucumInfo(code);
  if (!ucum) return false;
  const normValue = value * ucum.coeff;
  const phaseRef = phase ? PHASE_ADJUSTED_RANGES[code]?.[phase] : undefined;
  const { uln, lln } = phaseRef || ucum;
  return normValue < lln || normValue > uln;
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
   // Проход 142: граница бланка не теряется в выгрузке.
   //  - «>1000» — не измерение: в NM знак не выразить, поэтому при границе тип
   //    значения ST, а знак стоит перед числом. Иначе получатель видит 1000 и
   //    не знает, что это «не меньше 1000»;
   //  - единица едет в своём поле OBX-6 (раньше приклеивалась к значению через
   //    «^», а OBX-6 оставался пустым);
   //  - флаг отклонения (OBX-8) — только доказанная сторона: «>5» при верхней
   //    границе 400 — не «H» и не «N», флаг остаётся пустым. «N» по обрезанному
   //    числу был бы выдумкой («isAbnormal: false» значит «не доказано», а не
   //    «в норме»).
   const bound = point.bound === '<' || point.bound === '>' ? point.bound : undefined;
   const value = `${bound ?? ''}${point.value}`;
   const valueType = bound ? 'ST' : 'NM';
   const reference = point.refLow === undefined && point.refHigh === undefined
     ? ''
     : `${point.refLow ?? ''}-${point.refHigh ?? ''}`;
   const side = boundProvesSide(bound, point.value, point.refLow, point.refHigh);
   const flag = side === 'high' ? 'H'
     : side === 'low' ? 'L'
     : bound ? ''
     : point.isAbnormal === true ? 'A'
     : point.isAbnormal === false ? 'N'
     : '';
   return `OBX|1|${valueType}|${point.code}^${point.name}||${value}|${point.unit || ''}|${reference}|${flag}|||F|||${obsId}`;
}
