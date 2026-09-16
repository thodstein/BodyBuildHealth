/**
 * strength-sport-sm-suitcase.engine.ts — ЧЕМОДАН + АСИММЕТРИЯ КЕРРИ (SM movement P6)
 *
 * McGill 2009: односторонний керри (suitcase) — пиковый twist ~11° vs 7–8° билатераль;
 * чемодан тренирует QL/brace под таз. IUSCA 2026: нагрузка спереди укорачивает шаг.
 * Suitcase L/R время + разница — асимметрия керри отдельно от хвата (sm-asymmetry —
 * только фермера-hold кг). Пороги те же 7/12% (Bishop-линия хаба).
 *
 * Чистый движок, без UI/storage.
 */

export interface SMSuitcaseInput {
  leftS?: number | null; // время/дистанция левой (с или м — одна шкала)
  rightS?: number | null;
}

export interface SMSuitcaseResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  asymmetryPct: number | null;
  weakSide: 'left' | 'right' | null;
  text: string;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

export function diagnoseSuitcase(input: SMSuitcaseInput): SMSuitcaseResult | null {
  const l = num(input.leftS);
  const r = num(input.rightS);
  if (l == null || r == null) return null;
  const mx = Math.max(l, r);
  const asym = Math.round((Math.abs(l - r) / mx) * 1000) / 10;
  const weakSide = l === r ? null : l < r ? 'left' : ('right' as const);
  if (asym >= 12) {
    return {
      valid: true, verdict: 'critical', asymmetryPct: asym, weakSide,
      text: `Чемодан L/R асимметрия ${asym}% ≥12% — слабее ${weakSide === 'left' ? 'левая' : 'правая'}: односторонний топ-ап +1–2 сета (McGill QL)`,
    };
  }
  if (asym >= 7) {
    return {
      valid: true, verdict: 'warn', asymmetryPct: asym, weakSide,
      text: `Чемодан L/R ${asym}% ≥7% — слабее ${weakSide === 'left' ? 'левая' : 'правая'}: +1 сет слабой стороне`,
    };
  }
  return { valid: true, verdict: 'ok', asymmetryPct: asym, weakSide, text: `Чемодан L/R ${asym}% — симметрия в норме` };
}
