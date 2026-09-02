/**
 * arm-benchmarks.engine.ts — бенчмарки GripStrength 12-нед + WAF весовые, авто-уровень.
 * Источник: GripStrength benchmarks (wrist curl, pron hold, cup hold, CoC) + IronMind WR.
 */
export type BenchLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive' | 'elite';
export interface BenchmarkDef {
  id: string;
  name: string;
  unit: string;
  thresholds: Record<BenchLevel, number>; // порог входа на уровень (inclusive lower)
  higherIsBetter: boolean;
}

export const ARM_BENCHMARKS: BenchmarkDef[] = [
  { id: 'wrist_curl_1rm_lb', name: 'Wrist curl 1RM (loading pin)', unit: 'lb', thresholds: { beginner: 0, intermediate: 25, advanced: 45, competitive: 70, elite: 95 }, higherIsBetter: true },
  { id: 'pron_hold_sec', name: 'Pronation hold (moderate band)', unit: 'с', thresholds: { beginner: 0, intermediate: 10, advanced: 25, competitive: 45, elite: 65 }, higherIsBetter: true },
  { id: 'cup_hold_sec', name: 'Cupping hold 50% 1RM', unit: 'с', thresholds: { beginner: 0, intermediate: 15, advanced: 30, competitive: 50, elite: 70 }, higherIsBetter: true },
  { id: 'coc_level', name: 'CoC gripper', unit: 'lvl', thresholds: { beginner: 0, intermediate: 1, advanced: 1.5, competitive: 2, elite: 2.5 }, higherIsBetter: true }, // 0 Trainer 100lb, 1 No1 140, 1.5 No1.5 167.5, 2 No2 195, 2.5 No2.5 237
  { id: 'rt_kg', name: 'Rolling Thunder', unit: 'кг', thresholds: { beginner: 0, intermediate: 45, advanced: 75, competitive: 100, elite: 120 }, higherIsBetter: true },
  { id: 'side_kg_rel', name: 'Side pressure /bw', unit: '%bw', thresholds: { beginner: 0, intermediate: 35, advanced: 50, competitive: 60, elite: 70 }, higherIsBetter: true },
];

export function benchLevelFor(value: number, def: BenchmarkDef): BenchLevel {
  const t = def.thresholds;
  if (value >= t.elite) return 'elite';
  if (value >= t.competitive) return 'competitive';
  if (value >= t.advanced) return 'advanced';
  if (value >= t.intermediate) return 'intermediate';
  return 'beginner';
}

export function levelScore(lvl: BenchLevel): number {
  const map: Record<BenchLevel, number> = { beginner: 0, intermediate: 1, advanced: 2, competitive: 3, elite: 4 };
  return map[lvl];
}
export function scoreToLevel(score: number): BenchLevel {
  if (score >= 3.5) return 'elite';
  if (score >= 2.5) return 'competitive';
  if (score >= 1.5) return 'advanced';
  if (score >= 0.5) return 'intermediate';
  return 'beginner';
}

export interface BenchInput {
  wristCurlLb?: number;
  pronHoldSec?: number;
  cupHoldSec?: number;
  cocLevel?: number; // 0,1,1.5,2...
  rtKg?: number;
  sideKg?: number;
  bwKg?: number;
}

export function resolveArmLevelByTests(input: BenchInput): { level: BenchLevel; avgScore: number; details: Array<{ id: string; value: number; level: BenchLevel }> } {
  const details: Array<{ id: string; value: number; level: BenchLevel }> = [];
  const scores: number[] = [];
  const push = (id: string, val: number | undefined, defId: string) => {
    if (val == null || !Number.isFinite(val)) return;
    const def = ARM_BENCHMARKS.find(d => d.id === defId)!;
    // для side_kg_rel — нормируем
    let v = val;
    if (defId === 'side_kg_rel' && input.bwKg && input.bwKg > 30) v = (val / input.bwKg) * 100;
    const lvl = benchLevelFor(v, def);
    details.push({ id: defId, value: Math.round(v * 10) / 10, level: lvl });
    scores.push(levelScore(lvl));
  };
  push('wrist_curl_1rm_lb', input.wristCurlLb, 'wrist_curl_1rm_lb');
  push('pron_hold_sec', input.pronHoldSec, 'pron_hold_sec');
  push('cup_hold_sec', input.cupHoldSec, 'cup_hold_sec');
  push('coc_level', input.cocLevel, 'coc_level');
  push('rt_kg', input.rtKg, 'rt_kg');
  push('side_kg_rel', input.sideKg, 'side_kg_rel');
  if (!scores.length) return { level: 'beginner', avgScore: 0, details };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { level: scoreToLevel(avg), avgScore: Math.round(avg * 100) / 100, details };
}

export function wafWeightClassFor(bwKg: number): string {
  const classes = [55, 60, 65, 70, 75, 80, 85, 90, 100, 110];
  for (const c of classes) if (bwKg <= c) return `${c}`;
  return '110+';
}

export function benchAdviceForLevel(level: BenchLevel): string {
  if (level === 'beginner') return 'Новичок — Phase1 15-20 RPE5-6, 3с негатив, 48ч отдых, без 100% спарринга 3 мес';
  if (level === 'intermediate') return 'Средний — Phase2 8-12 RPE7-8, 2 стол/нед, humerus RIR≥2';
  if (level === 'advanced') return 'Продвинутый — Phase3 5-6 RPE9 + speed pron, специализация 3-6н';
  if (level === 'competitive') return 'Соревн. — пиковая Phase3, тейпер A 3н 0.85/0.65/0.45, side×0.5/0.3';
  return 'Элита — индивидуализация F100/F500, периодизация Off-season→Peaking, EMG (опц)';
}
