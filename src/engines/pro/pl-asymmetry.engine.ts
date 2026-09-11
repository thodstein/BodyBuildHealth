/**
 * pl-asymmetry.engine.ts — P2: асимметрия сторон L/R для ПЛ-диагностики.
 *
 * Формула без референс-лимба (Bishop 2021 / Parkinson 2021):
 *   pct = (max − min) / max × 100
 * Пороги: <10% — норма, 10–15% — наблюдение (унилатеральная добивка),
 * >15% — выраженная (добивка + снизить билатеральный объём слабой стороны).
 * На вход — сопоставимые числа (e1RM или вес×повторы одной схемы); движок
 * не гадает схему, только считает. Чистые функции.
 */

export type AsymSide = 'left' | 'right';
export type AsymVerdict = 'ok' | 'watch' | 'high';

export interface AsymmetryDiagnosis {
  pct: number;
  weaker: AsymSide;
  verdict: AsymVerdict;
  text: string;
}

/** % асимметрии без референс-лимба. null при некорректном вводе. */
export function asymmetryPct(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  const mx = Math.max(a, b);
  if (mx <= 0) return null;
  return Math.round(((mx - Math.min(a, b)) / mx) * 1000) / 10;
}

/** Вердикт по % (Bishop/Parkinson): 10% наблюдение, 15% выраженная. */
export function asymmetryVerdict(pct: number): AsymVerdict {
  if (pct > 15) return 'high';
  if (pct >= 10) return 'watch';
  return 'ok';
}

/** Полный диагноз по паре L/R. null при некорректном вводе. */
export function diagnoseAsymmetry(left: number, right: number): AsymmetryDiagnosis | null {
  const pct = asymmetryPct(left, right);
  if (pct == null) return null;
  if (left === right) {
    return { pct: 0, weaker: 'left', verdict: 'ok', text: 'Симметрия 0% — стороны равны.' };
  }
  const weaker: AsymSide = left < right ? 'left' : 'right';
  const verdict = asymmetryVerdict(pct);
  const sideRu = weaker === 'left' ? 'левая' : 'правая';
  const text =
    verdict === 'ok'
      ? `Асимметрия ${pct}% — норма (<10%). Слабее: ${sideRu} — в пределах шума.`
      : verdict === 'watch'
        ? `Асимметрия ${pct}% — наблюдение (10–15%). Слабее: ${sideRu} → унилатеральная добивка +1 сет.`
        : `Асимметрия ${pct}% — выраженная (>15%). Слабее: ${sideRu} → добивка +1 сет, билатеральный объём не повышать.`;
  return { pct, weaker, verdict, text };
}

/** Унилатаральное ли упражнение (кандидат на +1 сет слабой стороне). */
export function isUnilateralExercise(name: string): boolean {
  return /гантел|одной рук|выпад|болгарск|одной ног|одна ног|single|unilateral|сплит/i.test(name ?? '');
}
