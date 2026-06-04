import type { LabPoint } from '../core/types';
import { normalizedRatio, interpretScale } from '../core/labs-mapping';

export interface LabIndices {
  inflammation: number;
  metabolism: number;
  thyroid: number;
  lipids: number;
}

export interface LabIndicesInterpretation {
  inflammation: string;
  metabolism: string;
  thyroid: string;
  lipids: string;
}

function latestByCode(entries: LabPoint[], codes: string[]): LabPoint | null {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  const filtered = entries.filter((e) => set.has(e.code.toUpperCase()));
  if (!filtered.length) return null;
  return filtered.sort((a, b) => b.date.localeCompare(a.date))[0];
}

function ratioFrom(entries: LabPoint[], codes: string[]): number {
  const point = latestByCode(entries, codes);
  if (!point) return 0;
  return normalizedRatio(point.code, point.value, point.unit) ?? 0;
}

/** Composite indices (0..1), ported from MODULELABS labs.indices.js */
export function computeLabIndices(entries: LabPoint[]): LabIndices {
  const crp = ratioFrom(entries, ['CRP']);
  const ferritin = ratioFrom(entries, ['FERRITIN']);
  const glucose = ratioFrom(entries, ['GLU', 'GLUCOSE']);
  const hba1c = ratioFrom(entries, ['HbA1c', 'HBA1C']);
  const tsh = ratioFrom(entries, ['TSH']);
  const ft4 = ratioFrom(entries, ['FT4']);
  const ft3 = ratioFrom(entries, ['FT3']);
  const ldl = ratioFrom(entries, ['LDL']);
  const hdl = ratioFrom(entries, ['HDL']);
  const tg = ratioFrom(entries, ['TG']);

  return {
    inflammation: crp * 0.6 + ferritin * 0.4,
    metabolism: glucose * 0.5 + hba1c * 0.5,
    thyroid: tsh * 0.4 + ft4 * 0.3 + ft3 * 0.3,
    lipids: ldl * 0.5 + tg * 0.3 + (1 - hdl) * 0.2
  };
}

export function interpretLabIndices(indices: LabIndices): LabIndicesInterpretation {
  return {
    inflammation: interpretScale(indices.inflammation),
    metabolism: interpretScale(indices.metabolism),
    thyroid: interpretScale(indices.thyroid),
    lipids: interpretScale(indices.lipids)
  };
}
