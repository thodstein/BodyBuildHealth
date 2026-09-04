/**
 * arm-bilateral.engine.ts — двустороннее планирование L/R (эпик B PRO-плана).
 *
 * Элита тянет обеими руками (WAF: левая и правая — отдельные зачёты).
 * Норма элиты — асимметрия ~12% (Bezkorovainyi), управляем донорским
 * перераспределением: слабая +15-25%, сильная — maintenance, сумма ≤ MRV.
 */

export interface BilateralInput {
  leftKg?: number; // сила слабой/левой (RT, прон или cup — одна метрика)
  rightKg?: number;
  dominantArm?: 'left' | 'right';
  mrvSets?: number; // недельный MRV мышцы (кап суммы)
  baseSets?: number; // базовый недельный объём на руку
}

export interface BilateralPlan {
  asymmetryPct: number | null; // |L-R|/max*100
  weakArm: 'left' | 'right' | null;
  strongArm: 'left' | 'right' | null;
  weakSets: number;
  strongSets: number;
  totalSets: number;
  withinMrv: boolean;
  note: string;
}

export function bilateralAsymmetryPct(leftKg?: number, rightKg?: number): number | null {
  if (!Number.isFinite(Number(leftKg)) || !Number.isFinite(Number(rightKg))) return null;
  const l = Number(leftKg);
  const r = Number(rightKg);
  const mx = Math.max(l, r);
  if (mx <= 0) return null;
  return Math.round((Math.abs(l - r) / mx) * 1000) / 10;
}

/** Добивка слабой: 7-12% → +15%, ≥12% → +25% (кап MRV). Симметрия ≤7% — поровну. */
export function bilateralWeakBonus(asymmetryPct: number | null): number {
  if (asymmetryPct == null) return 0;
  if (asymmetryPct >= 12) return 0.25;
  if (asymmetryPct >= 7) return 0.15;
  return 0;
}

export function planBilateralVolume(input: BilateralInput): BilateralPlan {
  const base = Math.max(2, Math.round(input.baseSets ?? 10));
  const mrv = Math.max(base, Math.round(input.mrvSets ?? 18));
  const asym = bilateralAsymmetryPct(input.leftKg, input.rightKg);
  if (asym == null) {
    const half = Math.min(mrv, base * 2) / 2;
    return {
      asymmetryPct: null,
      weakArm: null,
      strongArm: null,
      weakSets: Math.round(half),
      strongSets: Math.round(half),
      totalSets: Math.round(half) * 2,
      withinMrv: Math.round(half) * 2 <= mrv * 2,
      note: 'Нет данных L/R — поровну. Введите силу обеих рук.',
    };
  }
  const l = Number(input.leftKg);
  const r = Number(input.rightKg);
  let weakArm: 'left' | 'right' = l <= r ? 'left' : 'right';
  let strongArm: 'left' | 'right' = weakArm === 'left' ? 'right' : 'left';
  if (input.dominantArm && asym < 1) {
    // при равенстве слабой считаем недоминантную (профилактика)
    weakArm = input.dominantArm === 'left' ? 'right' : 'left';
    strongArm = input.dominantArm;
  }
  const bonus = bilateralWeakBonus(asym);
  // Сильная — maintenance 0.85× базы, слабая — база + бонус; сумма под кап 2×MRV... нет:
  // кап — суммарный бюджет обеих рук не должен превышать 2×MRV одной? Нет — руки разные,
  // лимит системный: total ≤ 2*mrv, и каждая ≤ mrv.
  let weakSets = Math.round(base * (1 + bonus));
  let strongSets = Math.round(base * 0.85);
  weakSets = Math.min(mrv, Math.max(2, weakSets));
  strongSets = Math.min(mrv, Math.max(2, strongSets));
  const totalSets = weakSets + strongSets;
  const withinMrv = weakSets <= mrv && strongSets <= mrv;
  const note =
    asym >= 12
      ? `Асимметрия ${asym}% ≥12% — слабая (${weakArm}) +25%, сильная maintenance.`
      : asym >= 7
        ? `Асимметрия ${asym}% — слабая (${weakArm}) +15%.`
        : `Симметрия ${asym}% — норма, руки поровну с лёгким акцентом на недоминантную.`;
  return { asymmetryPct: asym, weakArm, strongArm, weakSets, strongSets, totalSets, withinMrv, note };
}

/** Проверка для валидатора: слабая обязана быть ≥ сильной. */
export function isBilateralBalanced(plan: BilateralPlan): boolean {
  if (plan.weakArm == null) return true;
  return plan.weakSets >= plan.strongSets && plan.withinMrv;
}

const BILATERAL_HIST_KEY = 'he_arm_asymmetry_hist';

export interface BilateralHistEntry {
  date: string;
  leftKg: number;
  rightKg: number;
  asymmetryPct: number;
}

/** История L/R-замеров (E12 P1): кап 52, устойчив к битому JSON. */
export function loadBilateralHist(): BilateralHistEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BILATERAL_HIST_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((e: any) => e && typeof e.date === 'string' && Number.isFinite(Number(e.asymmetryPct))).slice(-52);
  } catch { return []; }
}

export function saveBilateralEntry(leftKg: number, rightKg: number, dateIso?: string): BilateralHistEntry[] {
  const pct = bilateralAsymmetryPct(leftKg, rightKg);
  if (pct == null) return loadBilateralHist();
  const entry: BilateralHistEntry = {
    date: dateIso || new Date().toISOString().slice(0, 10),
    leftKg: Number(leftKg),
    rightKg: Number(rightKg),
    asymmetryPct: pct,
  };
  const next = [...loadBilateralHist(), entry].slice(-52);
  try { localStorage.setItem(BILATERAL_HIST_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

export function bilateralTrend(hist: BilateralHistEntry[]): { delta: number; improving: boolean; text: string } | null {
  if (!hist || hist.length < 2) return null;
  const first = hist[0].asymmetryPct;
  const last = hist[hist.length - 1].asymmetryPct;
  const delta = Math.round((last - first) * 10) / 10;
  const improving = last < first;
  return {
    delta,
    improving,
    text: improving ? `Асимметрия ↓ ${Math.abs(delta)}% за ${hist.length} зам. — выравнивается` : `Асимметрия ↑ ${Math.abs(delta)}% — усилить слабую сторону`,
  };
}
