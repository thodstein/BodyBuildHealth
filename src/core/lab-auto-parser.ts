import { resolveLabMarker, normalizedRatio } from './labs-mapping';
import { UCUM_MAP } from './constants';

export interface ParsedLabResult {
  marker: string;
  value: number;
  unit: string;
  refRange?: string;
  confidence: number;
  raw: string;
  provider?: 'gemotest' | 'helix' | 'invitro' | 'kdl' | 'unknown';
  isAbnormal?: boolean;
  deviation?: 'low' | 'high' | 'normal';
  labName?: string;
}

// Normal ranges by lab provider (common variations)
const LAB_REFERENCE_RANGES: Record<string, Partial<Record<string, { low: number; high: number }>>> = {
  gemotest: {},
  helix: {},
  invitro: {},
  kdl: {}
};

const LINE_PATTERNS = [
   // Pattern 1: Marker: Value Unit (most common)
   /([A-Za-z0-9().\/-]{2,40})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.-]{1,20})/i,
   // Pattern 2: Value Unit Marker
   /([\d,.]+)\s*([A-Za-z%\/0-9.-]{1,20})\s+([A-Za-z0-9().\/-]{2,40})/i,
   // Pattern 3: Marker Value Unit (no separator)
   /([A-Za-z0-9().\/-]{2,40})\s+([\d,.]+)\s*([A-Za-z%\/0-9.-]{1,20})/i,
   // Pattern 4: With reference ranges: Marker Value Unit (Low-High)
   /([A-Za-z0-9().\/-]{2,40})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.-]{1,20})\s*[\(\[\{]\s*([\d,.]+)\s*[-–]\s*([\d,.]+)\s*[\)\]\}]/i,
   // Pattern 5: Marker Value Unit Low-High
   /([A-Za-z0-9().\/-]{2,40})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.-]{1,20})\s*([\d,.]+)\s*[-–]\s*([\d,.]+)/i
];

function detectProvider(text: string): ParsedLabResult['provider'] {
  const lower = text.toLowerCase();
  if (lower.includes('gemotest')) return 'gemotest';
  if (lower.includes('invitro')) return 'invitro';
  if (lower.includes('helix')) return 'helix';
  if (lower.includes('kdl')) return 'kdl';
  return 'unknown';
}

export function parseLabText(text: string): ParsedLabResult[] {
  const results: ParsedLabResult[] = [];
  const provider = detectProvider(text);
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);

   for (const line of lines) {
     for (const pat of LINE_PATTERNS) {
       const match = line.match(pat);
       if (!match) continue;

        let markerRaw: string = '';
        let valStr: string = '';
        let unit: string = '';
       let refLow: string | undefined;
       let refHigh: string | undefined;

       // Handle different pattern matches
       if (pat === LINE_PATTERNS[0]) {
         // Pattern 1: Marker: Value Unit
         markerRaw = match[1];
         valStr = match[2];
         unit = match[3];
       } else if (pat === LINE_PATTERNS[1]) {
         // Pattern 2: Value Unit Marker
         valStr = match[1];
         unit = match[2];
         markerRaw = match[3];
       } else if (pat === LINE_PATTERNS[2]) {
         // Pattern 3: Marker Value Unit
         markerRaw = match[1];
         valStr = match[2];
         unit = match[3];
       } else if (pat === LINE_PATTERNS[3]) {
         // Pattern 4: Marker: Value Unit (Low-High)
         markerRaw = match[1];
         valStr = match[2];
         unit = match[3];
         refLow = match[4];
         refHigh = match[5];
       } else if (pat === LINE_PATTERNS[4]) {
         // Pattern 5: Marker Value Unit Low-High
         markerRaw = match[1];
         valStr = match[2];
         unit = match[3];
         refLow = match[4];
         refHigh = match[5];
       }

       const value = parseFloat(valStr.replace(',', '.'));
       const marker = resolveLabMarker(markerRaw);
       if (!marker || Number.isNaN(value) || value <= 0) continue;

       let refRange: string | undefined;
       let isAbnormal: boolean | undefined;
       let deviation: 'low' | 'high' | 'normal' | undefined;
       
       if (refLow !== undefined && refHigh !== undefined) {
         refRange = `${refLow}-${refHigh}`;
         isAbnormal = value < parseFloat(refLow) || value > parseFloat(refHigh);
         if (isAbnormal) {
           deviation = value < parseFloat(refLow) ? 'low' : 'high';
         }
       } else {
         // Check against UCUM_MAP norms if available
         const ucum = UCUM_MAP[marker];
         if (ucum) {
           const ratio = normalizedRatio(marker, value, unit);
           isAbnormal = ratio !== null && (ratio < 0.2 || ratio > 0.8);
           if (isAbnormal && ratio !== null) {
             deviation = ratio < 0.2 ? 'low' : 'high';
           }
         }
       }

       results.push({
         marker,
         value,
         unit: unit.trim(),
         refRange,
         confidence: 0.85,
         raw: line,
         provider,
         isAbnormal,
         deviation
       });
       break;
     }
   }

  return results;
}

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsText(file);
  });
}
