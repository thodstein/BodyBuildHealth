/**
 * combat-load-screen.engine.ts — P6 нагрузка/восстановление/дневник (живой контур).
 * REUSE combat-monitoring (ACWR) как канона зон; здесь — тонкий экран хаба:
 * ACWR-зона + спарринг-объём + e1RM-тренд-кандидаты + L/R-асимметрия ударов.
 * Пороги асимметрии 7/12 как у arm-bilateral: +15%/+25% добивка слабой.
 */

export type CombatAcwrZone = 'low' | 'ok' | 'caution' | 'danger';

export function combatAcwrZone(ratio: number | null | undefined): CombatAcwrZone | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio < 0.8) return 'low';
  if (ratio <= 1.3) return 'ok';
  if (ratio <= 1.5) return 'caution';
  return 'danger';
}

export const COMBAT_ACWR_TEXT: Record<CombatAcwrZone, string> = {
  low: 'Недогруз — можно добавлять',
  ok: 'Зелёная зона 0.8–1.3',
  caution: 'Осторожно: снизить спарринги',
  danger: 'Опасно: делод + только техника',
};

export interface CombatAsymmetryInput {
  left: number | null | undefined;
  right: number | null | undefined;
}

export interface CombatAsymmetryVerdict {
  asymPct: number | null;
  weakSide: 'left' | 'right' | null;
  verdict: 'ok' | 'watch' | 'fix';
  topUpPct: number;
  text: string;
}

export function combatAsymmetryVerdict(inp: CombatAsymmetryInput): CombatAsymmetryVerdict {
  const { left, right } = inp;
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right) || (left <= 0 && right <= 0)) {
    return { asymPct: null, weakSide: null, verdict: 'ok', topUpPct: 0, text: 'Нет парных замеров L/R' };
  }
  const max = Math.max(left, right);
  if (max <= 0) return { asymPct: null, weakSide: null, verdict: 'ok', topUpPct: 0, text: 'Нет парных замеров L/R' };
  const asymPct = (Math.abs(left - right) / max) * 100;
  const weakSide = left < right ? 'left' : right < left ? 'right' : null;
  if (asymPct >= 12) {
    return { asymPct, weakSide, verdict: 'fix', topUpPct: 25, text: `Асимметрия ${asymPct.toFixed(0)}% — слабее: ${weakSide === 'left' ? 'левая' : 'правая'}, добивка +25%` };
  }
  if (asymPct >= 7) {
    return { asymPct, weakSide, verdict: 'watch', topUpPct: 15, text: `Асимметрия ${asymPct.toFixed(0)}% — добивка слабой +15%` };
  }
  return { asymPct, weakSide: null, verdict: 'ok', topUpPct: 0, text: `Асимметрия ${asymPct.toFixed(0)}% — в норме` };
}

export interface CombatE1rmTrend {
  group: string;
  prevBest: number;
  recentBest: number;
}

/** Кандидаты в слабые по e1RM-тренду 28д: падение ≥5% — weak, рост ≤1% при ≥2 сессиях — plateau. */
export function combatWeakCandidates(
  trends: CombatE1rmTrend[],
): Array<{ group: string; kind: 'weak' | 'plateau'; text: string }> {
  const out: Array<{ group: string; kind: 'weak' | 'plateau'; text: string }> = [];
  for (const t of trends) {
    if (!t.prevBest || t.prevBest <= 0) continue;
    const delta = ((t.recentBest - t.prevBest) / t.prevBest) * 100;
    if (delta <= -5) out.push({ group: t.group, kind: 'weak', text: `${t.group}: падение e1RM ${delta.toFixed(0)}% — кандидат в слабые` });
    else if (delta <= 1) out.push({ group: t.group, kind: 'plateau', text: `${t.group}: плато ${delta.toFixed(0)}% — проверить технику` });
  }
  return out;
}
