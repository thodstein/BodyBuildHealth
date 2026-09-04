/**
 * strength-sport-ta-asymmetry.engine.ts — АСИММЕТРИЯ SPLIT-JERK (E11 PRO-v2)
 *
 * Максимум толчка с левой/правой ногой впереди: % разницы, слабая сторона,
 * пороги 7/12% (Bezkorovainyi — parity с хабом), история замеров + тренд.
 * Чистый движок, без UI (storage-ключи — в хабе).
 */

export interface TASplitJerkInput {
  leftForwardKg?: number | null;
  rightForwardKg?: number | null;
}

export interface TASplitJerkResult {
  diffPct: number;
  weaker: 'left' | 'right' | null;
  isAsym: boolean; // ≥7%
  isCrit: boolean; // ≥12%
  text: string;
}

export function diagnoseSplitJerkAsymmetry(input: TASplitJerkInput): TASplitJerkResult | null {
  const l = input.leftForwardKg, r = input.rightForwardKg;
  if (l == null || r == null || !Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return null;
  const diffPct = Math.round((Math.abs(l - r) / Math.max(l, r)) * 1000) / 10;
  const isCrit = diffPct >= 12;
  const isAsym = diffPct >= 7;
  const weaker = isAsym ? (l < r ? 'left' as const : 'right' as const) : null;
  const text = !isAsym
    ? `Ноги в ножницах симметричны (${diffPct}%) — норма`
    : `Слабее ${weaker === 'left' ? 'левая впереди' : 'правая впереди'} (${diffPct}%): сплит-приседы + толчки со слабой ногой впереди 3×5`;
  return { diffPct, weaker, isAsym, isCrit, text };
}

export interface SplitJerkSnapshot {
  date: string; // yyyy-mm-dd
  leftKg: number;
  rightKg: number;
  diffPct: number;
}

/** Добавить/заменить снимок дня (кап 20, по дате). */
export function appendSplitJerkSnapshot(hist: SplitJerkSnapshot[], entry: SplitJerkSnapshot): SplitJerkSnapshot[] {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string');
  const next = [...clean.filter(s => s.date !== entry.date), entry]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-20);
  return next;
}

/** Тренд разницы: последний vs первый (п.п.). Отрицательный = выравнивается. */
export function splitJerkTrend(hist: SplitJerkSnapshot[]): { deltaPp: number; n: number } | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && Number.isFinite(s.diffPct));
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const deltaPp = Math.round((sorted[sorted.length - 1].diffPct - sorted[0].diffPct) * 10) / 10;
  return { deltaPp, n: sorted.length };
}
