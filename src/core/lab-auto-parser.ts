import { resolveLabMarker, normalizedRatio } from './labs-mapping';
import { UCUM_MAP } from './constants';

export interface ParsedLabResult {
  marker: string;
  value: number;
  unit: string;
  refRange?: string;
  refLow?: number;
  refHigh?: number;
  confidence: number;
  raw: string;
  provider?: 'gemotest' | 'helix' | 'invitro' | 'kdl' | 'unknown';
  isAbnormal?: boolean;
  deviation?: 'low' | 'high' | 'normal';
  labName?: string;
}

const LAB_REFERENCE_RANGES: Record<string, Partial<Record<string, { low: number; high: number }>>> = {
  gemotest: {},
  helix: {},
  invitro: {},
  kdl: {}
};

const LINE_PATTERNS = [
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})/i,
   /([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s+([A-Za-zА-Яа-я0-9().\/ -]{2,60})/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60})\s+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s*[\(\[\{]\s*([\d,.]+)\s*[-–]\s*([\d,.]+)\s*[\)\]\}]/i,
   /([A-Za-zА-Яа-я0-9().\/ -]{2,60})[\s:]+([\d,.]+)\s*([A-Za-z%\/0-9.\-^]{1,20})\s*([\d,.]+)\s*[-–]\s*([\d,.]+)/i,
];

export function detectProvider(text: string): ParsedLabResult['provider'] {
  const lower = text.toLowerCase();
  if (lower.includes('gemotest')) return 'gemotest';
  if (lower.includes('инвитро') || lower.includes('invitro')) return 'invitro';
  if (lower.includes('helix') || lower.includes('хеликс')) return 'helix';
  if (lower.includes('kdl') || lower.includes('кдл')) return 'kdl';
  return 'unknown';
}

export function parseLabText(text: string): ParsedLabResult[] {
  const results: ParsedLabResult[] = [];
  const provider = detectProvider(text);
  const lines = text.replace(/\r\n/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .split('\n').map((l) => l.trim()).filter(Boolean);

  const seenMarkers = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;

    for (const pat of LINE_PATTERNS) {
      const match = line.match(pat);
      if (!match) continue;

      let markerRaw = '';
      let valStr = '';
      let unit = '';
      let refLow: string | undefined;
      let refHigh: string | undefined;

      if (pat === LINE_PATTERNS[0]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
      } else if (pat === LINE_PATTERNS[1]) {
        valStr = match[1];
        unit = match[2];
        markerRaw = match[3];
      } else if (pat === LINE_PATTERNS[2]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
      } else if (pat === LINE_PATTERNS[3]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
        refLow = match[4];
        refHigh = match[5];
      } else if (pat === LINE_PATTERNS[4]) {
        markerRaw = match[1];
        valStr = match[2];
        unit = match[3];
        refLow = match[4];
        refHigh = match[5];
      }

       const value = parseFloat(valStr.replace(',', '.'));
       const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
      if (!marker || Number.isNaN(value) || value <= 0) continue;
      if (seenMarkers.has(marker)) continue;
      seenMarkers.add(marker);

      let refRange: string | undefined;
      let refLowNum: number | undefined;
      let refHighNum: number | undefined;
      let isAbnormal: boolean | undefined;
      let deviation: 'low' | 'high' | 'normal' | undefined;

      if (refLow !== undefined && refHigh !== undefined) {
        refRange = `${refLow}-${refHigh}`;
        refLowNum = parseFloat(refLow);
        refHighNum = parseFloat(refHigh);
        isAbnormal = value < refLowNum || value > refHighNum;
        if (isAbnormal) {
          deviation = value < refLowNum ? 'low' : 'high';
        }
      } else {
        const ucum = UCUM_MAP[marker];
        if (ucum) {
          isAbnormal = value > ucum.uln || value < ucum.lln;
          if (isAbnormal) {
            deviation = value < ucum.lln ? 'low' : 'high';
          }
        }
      }

      results.push({
        marker,
        value,
        unit: unit.trim(),
        refRange,
        refLow: refLowNum,
        refHigh: refHighNum,
        confidence: 0.85,
        raw: line,
        provider,
        isAbnormal,
        deviation
      });
      matched = true;
      break;
    }

    if (!matched) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const combined = (line + ' ' + nextLine).trim();
      for (const pat of LINE_PATTERNS) {
        const m = combined.match(pat);
        if (!m) continue;
        let markerRaw = '';
        let valStr = '';
        let u = '';
        if (pat === LINE_PATTERNS[0] || pat === LINE_PATTERNS[2]) {
          markerRaw = m[1]; valStr = m[2]; u = m[3];
        } else { continue; }
         const value = parseFloat(valStr.replace(',', '.'));
         const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
        if (!marker || Number.isNaN(value) || value <= 0) continue;
        if (seenMarkers.has(marker)) continue;
        seenMarkers.add(marker);
        results.push({
          marker, value, unit: u.trim(),
          confidence: 0.6, raw: combined, provider,
        });
        break;
      }
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
