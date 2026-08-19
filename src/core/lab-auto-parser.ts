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

export function parseLabReference(text: string): { low?: number; high?: number; text?: string } {
  const source = text.replace(/[‐‑‒–—]/g, '-').replace(/,/g, '.');
  const n = '(\\d+(?:\\.\\d+)?)';
  const lt = source.match(new RegExp(`(?:^|[\\s(\\[])(<|≤|<=)\\s*${n}`));
  if (lt) return { high: Number(lt[2]), text: `<${lt[2]}` };
  const gt = source.match(new RegExp(`(?:^|[\\s(\\[])(>|≥|>=)\\s*${n}`));
  if (gt) return { low: Number(gt[2]), text: `>${gt[2]}` };
  const fromTo = source.match(new RegExp(`(?:от|from)\\s*${n}\\s*(?:до|to)\\s*${n}`, 'i'));
  if (fromTo) return { low: Number(fromTo[1]), high: Number(fromTo[2]), text: `${fromTo[1]}-${fromTo[2]}` };
  const range = source.match(new RegExp(`(?:^|[\\s(\\[])(\\d+(?:\\.\\d+)?)\\s*(?:-|\\.\\.)\\s*(\\d+(?:\\.\\d+)?)(?=$|[\\s)\\],;:])`));
  if (range) return { low: Number(range[1]), high: Number(range[2]), text: `${range[1]}-${range[2]}` };
  return {};
}

function parseLabNumber(value: string): number {
  return parseFloat(value.trim().replace(/\s/g, '').replace(',', '.'));
}

function markerPart(raw: string): { name: string; value?: number; unit?: string } {
  const valueUnit = raw.match(/(\d+(?:[.,]\d+)?)\s*((?:мк\s*)?моль|ммоль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|МЕ|Е|ед|г|%)(?:\s*\/\s*(л|мл|дл))?/i);
  const name = raw
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .replace(/(?:мк\s*)?моль|ммоль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|МЕ|Е|ед|г|%/gi, ' ')
    .replace(/[\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    name,
    value: valueUnit ? parseLabNumber(valueUnit[1]) : undefined,
    unit: valueUnit ? `${valueUnit[2]}${valueUnit[3] ? `/${valueUnit[3]}` : ''}` : undefined,
  };
}

function parseStructuredLine(line: string, provider: ParsedLabResult['provider']): ParsedLabResult | null {
  const match = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([A-Za-zА-Яа-я%µμ0-9]+\s*\/\s*[A-Za-zА-Яа-я0-9]+|%)\s*(.*)$/);
  if (!match) return null;
  const marker = resolveLabMarker(match[1].replace(/[|¦]/g, ' '));
  if (!marker) return null;
  const value = parseLabNumber(match[2]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const ref = parseLabReference(match[4]);
  const ucum = UCUM_MAP[marker];
  const isAbnormal = ref.low !== undefined || ref.high !== undefined
    ? (ref.low !== undefined && value < ref.low) || (ref.high !== undefined && value > ref.high)
    : ucum ? value < ucum.lln || value > ucum.uln : undefined;
  return { marker, value, unit: match[3].replace(/\s/g, ''), refRange: ref.text, refLow: ref.low, refHigh: ref.high, confidence: ref.text ? 0.95 : 0.85, raw: line, provider, isAbnormal, deviation: isAbnormal ? (ref.low !== undefined && value < ref.low ? 'low' : 'high') : undefined };
}

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
    .replace(/(\d),(\d)/g, '$1.$2')
    .split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;

    const structured = parseStructuredLine(line, provider);
    if (structured) {
      results.push(structured);
      matched = true;
    }

    for (const pat of matched ? [] : LINE_PATTERNS) {
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

       const value = parseLabNumber(valStr);
        const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
        if (!marker || Number.isNaN(value) || value <= 0) continue;
      let refRange: string | undefined;
      let refLowNum: number | undefined;
      let refHighNum: number | undefined;
      let isAbnormal: boolean | undefined;
      let deviation: 'low' | 'high' | 'normal' | undefined;

       const explicitRef = parseLabReference(line);
       if (explicitRef.low !== undefined || explicitRef.high !== undefined) {
         refRange = explicitRef.text;
         refLowNum = explicitRef.low;
         refHighNum = explicitRef.high;
         isAbnormal = (refLowNum !== undefined && value < refLowNum)
           || (refHighNum !== undefined && value > refHighNum);
         if (isAbnormal) {
           deviation = refLowNum !== undefined && value < refLowNum ? 'low' : 'high';
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
         const value = parseLabNumber(valStr);
         const marker = resolveLabMarker(markerRaw.replace(/[|¦]/g, ' '));
        if (!marker || Number.isNaN(value) || value <= 0) continue;
        results.push({
          marker, value, unit: u.trim(),
          confidence: 0.6, raw: combined, provider,
        });
        break;
      }
    }
  }

  const bestByMarker = new Map<string, ParsedLabResult>();
  for (const result of results) {
    const current = bestByMarker.get(result.marker);
    if (!current) { bestByMarker.set(result.marker, result); continue; }
    const currentHasRef = current.refLow !== undefined || current.refHigh !== undefined;
    const nextHasRef = result.refLow !== undefined || result.refHigh !== undefined;
    if ((nextHasRef && !currentHasRef) || (nextHasRef === currentHasRef && result.confidence > current.confidence)) {
      bestByMarker.set(result.marker, result);
    }
  }
  return [...bestByMarker.values()];
}

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsText(file);
  });
}
