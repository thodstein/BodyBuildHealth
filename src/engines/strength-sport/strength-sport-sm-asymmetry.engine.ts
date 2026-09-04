/**
 * strength-sport-sm-asymmetry.engine.ts — АСИММЕТРИЯ ХВАТА СТРОНГМЕНА (SM PRO)
 *
 * Фермер-hold L/R (сек или кг): % разницы, слабая сторона, пороги 7/12%
 * (Bezkorovainyi — parity с хабом и TA split-jerk), история + тренд.
 * Отдельно: axle DOH L/R можно маппить в те же поля.
 * Чистый движок, без UI (storage-ключи — в хабе).
 * Источники: Heazlewood biceps-tear (асимметрия = предиктор), SBS grip (r=0.40).
 */

export interface SMGripAsymmetryInput {
  leftKg?: number | null; // hold кг или сек — единообразно
  rightKg?: number | null;
  leftSec?: number | null;
  rightSec?: number | null;
}

export interface SMGripAsymmetryResult {
  diffPct: number;
  weaker: 'left' | 'right' | null;
  isAsym: boolean; // ≥7%
  isCrit: boolean; // ≥12%
  metric: 'kg' | 'sec';
  text: string;
}

export function diagnoseSMGripAsymmetry(input: SMGripAsymmetryInput): SMGripAsymmetryResult | null {
  let l: number | null | undefined = input.leftKg;
  let r: number | null | undefined = input.rightKg;
  let metric: 'kg' | 'sec' = 'kg';
  if ((l == null || r == null || !Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) && input.leftSec != null && input.rightSec != null) {
    l = input.leftSec;
    r = input.rightSec;
    metric = 'sec';
  }
  if (l == null || r == null || !Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return null;
  const diffPct = Math.round((Math.abs(l - r) / Math.max(l, r)) * 1000) / 10;
  const isCrit = diffPct >= 12;
  const isAsym = diffPct >= 7;
  const weaker = isAsym ? ((l < r ? 'left' : 'right') as 'left' | 'right') : null;
  const unit = metric === 'kg' ? 'кг' : 'с';
  const text = !isAsym
    ? `Хват симметричен (${diffPct}%, ${l}${unit} vs ${r}${unit}) — норма`
    : `Слабее ${weaker === 'left' ? 'левая' : 'правая'} (${diffPct}%, ${l}${unit} vs ${r}${unit}): унилатеральный hold + pinch слабой 2×15, фермер без лямок`;
  return { diffPct, weaker, isAsym, isCrit, metric, text };
}

export interface SMGripSnapshot {
  date: string; // yyyy-mm-dd
  left: number;
  right: number;
  diffPct: number;
  metric: 'kg' | 'sec';
}

/** Добавить/заменить снимок дня (кап 20, по дате). */
export function appendSMGripSnapshot(hist: SMGripSnapshot[], entry: SMGripSnapshot): SMGripSnapshot[] {
  const clean = (Array.isArray(hist) ? hist : []).filter((s) => s && typeof s.date === 'string');
  const next = [...clean.filter((s) => s.date !== entry.date), entry]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-20);
  return next;
}

/** Тренд разницы: последний vs первый (п.п.). Отрицательный = выравнивается. */
export function smGripTrend(hist: SMGripSnapshot[]): { deltaPp: number; n: number } | null {
  const clean = (Array.isArray(hist) ? hist : []).filter((s) => s && Number.isFinite(s.diffPct));
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const deltaPp = Math.round((sorted[sorted.length - 1].diffPct - sorted[0].diffPct) * 10) / 10;
  return { deltaPp, n: sorted.length };
}
