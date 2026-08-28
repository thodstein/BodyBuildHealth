/**
 * pl-points.engine.ts — очковые формулы пауэрлифтинга (мужчины, legacy).
 * @deprecated Канон — src/engines/pro/relative-strength.engine.ts (sex-aware Wilks/DOTS/IPF GL).
 * Этот файл оставлен для совместимости: мужские коэффициенты только. Для женщин используйте relative-strength.
 * Glossbrenner — только мужские (женские не опубликованы, см. P0-3).
 * IPF GL: 0-120 шкала (100+ = элита). DOTS/Wilks/Glossbrenner: 300-500 шкала.
 */

export type PointsFormula = 'ipf_gl' | 'dots' | 'wilks' | 'glossbrenner';
export type GlDiscipline = 'total' | 'bench';
export type GlDivision = 'raw' | 'eq';

const clampBw = (w: number) => Math.max(30, Math.min(250, w));

const IPF_GL: Record<string, { a: number; b: number; c: number }> = {
  total_raw: { a: 1199.72839, b: 1025.18162, c: 0.00921 },
  total_eq: { a: 310.33096, b: 134.16221, c: 0.00845 },
  bench_raw: { a: 381.22073, b: 291.05597, c: 0.01258 },
  bench_eq: { a: 243.34484, b: 143.25553, c: 0.01015 },
};

const DOTS = { a: -0.000001093, b: 0.000739875, c: -0.18456183, d: 21.64416174, e: -233.1118124 };
const WILKS = { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 0.00000701863, f: -0.00000001291 };
const GLOSS = { a: -407.721245, b: 25.751613, c: -0.10651815, d: 0.0003058866, e: -0.000000624443, f: 0.000000000492 };

export function calcIPFGL(bodyWeight: number, total: number, discipline: GlDiscipline = 'total', division: GlDivision = 'raw'): number {
  const w = clampBw(bodyWeight);
  if (total <= 0) return 0;
  const k = IPF_GL[`${discipline}_${division}`];
  if (!k) return 0;
  const denom = k.a - k.b * Math.exp(-k.c * w);
  if (denom <= 0) return 0;
  return Math.round((total * 100 / denom) * 100) / 100;
}

export function calcDOTS(bodyWeight: number, total: number): number {
  const w = clampBw(bodyWeight);
  if (total <= 0) return 0;
  const denom = DOTS.a * w ** 4 + DOTS.b * w ** 3 + DOTS.c * w ** 2 + DOTS.d * w + DOTS.e;
  if (denom <= 0) return 0;
  return Math.round((total * 500 / denom) * 100) / 100;
}

export function calcWilks(bodyWeight: number, total: number): number {
  const w = clampBw(bodyWeight);
  if (total <= 0) return 0;
  const denom = WILKS.a + WILKS.b * w + WILKS.c * w ** 2 + WILKS.d * w ** 3 + WILKS.e * w ** 4 + WILKS.f * w ** 5;
  if (denom <= 0) return 0;
  return Math.round((total * 500 / denom) * 100) / 100;
}

export function calcGlossbrenner(bodyWeight: number, total: number): number {
  const w = clampBw(bodyWeight);
  if (total <= 0) return 0;
  const denom = GLOSS.a + GLOSS.b * w + GLOSS.c * w ** 2 + GLOSS.d * w ** 3 + GLOSS.e * w ** 4 + GLOSS.f * w ** 5;
  if (denom <= 0) return 0;
  return Math.round((total * 500 / denom) * 100) / 100;
}

export interface PointsResult {
  formula: PointsFormula;
  label: string;
  points: number;
  scale: string;
}

export function calcAllPoints(bodyWeight: number, total: number, glDiscipline: GlDiscipline = 'total', glDivision: GlDivision = 'raw'): PointsResult[] {
  return [
    { formula: 'ipf_gl', label: 'IPF GL', points: calcIPFGL(bodyWeight, total, glDiscipline, glDivision), scale: '0-120' },
    { formula: 'dots', label: 'DOTS', points: calcDOTS(bodyWeight, total), scale: '300-500' },
    { formula: 'wilks', label: 'Wilks', points: calcWilks(bodyWeight, total), scale: '300-500' },
    { formula: 'glossbrenner', label: 'Glossbrenner', points: calcGlossbrenner(bodyWeight, total), scale: '300-500' },
  ];
}