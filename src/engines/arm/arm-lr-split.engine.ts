/**
 * arm-lr-split.engine.ts — TOP T7a: L/R раздельные мезоциклы.
 *
 * Источники: Bezkorovainyi (асимметрия квалиф 7.16% / элита 12.47%),
 * Gripzilla bilateral balance, planBilateralVolume (своя — reuse идеей).
 *
 * Правила: <7% — симметрия; 7–12% — слабая +15% (добивка 1×/нед);
 * ≥12% — слабая +25% (приоритет 2×/нед), сильная maintenance;
 * всегда в пределах MRV (cap). Чистый модуль.
 */

export interface LrSplitInput {
  leftKg?: number;
  rightKg?: number;
  baseSets?: number; // базовых сетов/нед на сторону
  mrvSets?: number; // кап стороны
}

export interface LrSplit {
  asymmetryPct: number | null;
  weakArm: 'left' | 'right' | null;
  weakSets: number;
  strongSets: number;
  weakFreq: number; // сессий/нед слабой
  withinMrv: boolean;
  note: string;
}

export function lrAsymmetryPct(leftKg: number, rightKg: number): number | null {
  const l = Number(leftKg);
  const r = Number(rightKg);
  if (!Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return null;
  const mx = Math.max(l, r);
  return Math.round(((mx - Math.min(l, r)) / mx) * 100);
}

export function planLrSplit(input: LrSplitInput = {}): LrSplit {
  const base = Math.max(4, Math.round(Number(input.baseSets ?? 10) || 10));
  const mrv = Math.max(base, Math.round(Number(input.mrvSets ?? 16) || 16));
  const pct = lrAsymmetryPct(Number(input.leftKg ?? NaN), Number(input.rightKg ?? NaN));
  if (pct == null) {
    return { asymmetryPct: null, weakArm: null, weakSets: base, strongSets: base, weakFreq: 1, withinMrv: true, note: 'Нет L/R данных — симметричный план.' };
  }
  const weakArm = Number(input.leftKg) < Number(input.rightKg) ? 'left' : Number(input.rightKg) < Number(input.leftKg) ? 'right' : null;
  if (weakArm == null || pct < 7) {
    return { asymmetryPct: pct, weakArm, weakSets: base, strongSets: base, weakFreq: 1, withinMrv: true, note: `Асимметрия ${pct}% <7% — допуск, симметрия.` };
  }
  const bonus = pct >= 12 ? 1.25 : 1.15;
  const weakSets = Math.min(mrv, Math.round(base * bonus));
  const strongSets = pct >= 12 ? base : base; // сильная — maintenance (не режем, держим)
  return {
    asymmetryPct: pct,
    weakArm,
    weakSets,
    strongSets,
    weakFreq: pct >= 12 ? 2 : 1,
    withinMrv: weakSets <= mrv,
    note: pct >= 12
      ? `Асимметрия ${pct}% ≥12% CRITICAL: слабая (${weakArm}) +25% ${weakSets} сетов 2×/нед, сильная maintenance ${strongSets} (кап MRV ${mrv}).`
      : `Асимметрия ${pct}% ≥7%: слабая (${weakArm}) +15% ${weakSets} сетов 1×/нед добивка.`,
  };
}
