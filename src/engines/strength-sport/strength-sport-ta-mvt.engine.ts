/**
 * strength-sport-ta-mvt.engine.ts — ИНДИВИДУАЛЬНЫЙ MVT (V4, продолжение PRO-v3)
 *
 * García-Ramos 2023c: индивидуальная связь %1RM–скорость — лёгкий замер 40–50%,
 * тяжёлый ~90% + промежуточные; MVT (minimal velocity threshold) берут из
 * СОБСТВЕННОЙ регрессии атлета, а не из популяционных средних.
 * PMC 2025 (snatch 1RM prediction): actual MVT vs general MVT — actual точнее,
 * но с пропорциональным bias; general MVT в хабе НЕ используем как базу
 * (честно: без индивидуального LVP оценки 1RM по скорости нет).
 * Вход — готовый LVPProfile из strength-sport-lvp-calibration.engine
 * (линейная регрессия velocity = a + b*pct по ramp 50/65/80/90).
 * Чистый движок, без UI/storage.
 */

import type { LVPProfile } from './strength-sport-lvp-calibration.engine';

export interface IndividualMVT {
  mvt: number; // м/с, скорость на 100% по индивидуальной регрессии
  r2: number;
  valid: boolean;
  reason: string;
  /** Есть ли точка ≥85% — иначе экстраполяция слишком далекая. */
  hasHeavyPoint: boolean;
  maxMeasuredPct: number | null;
}

/** MVT нужен тяжёлый замер: минимум одна точка ≥85% (García-Ramos ~90%). */
export const MVT_HEAVY_PCT_MIN = 0.85;
/** Порог качества регрессии — как в calibrateLVP. */
export const MVT_R2_MIN = 0.85;

/** Индивидуальный MVT из LVP-профиля. Нет профиля → valid:false с причиной. */
export function individualMVT(profile: LVPProfile | null | undefined): IndividualMVT | null {
  if (!profile || !Number.isFinite(profile.slope) || !Number.isFinite(profile.intercept)) return null;
  const pts = Array.isArray(profile.points) ? profile.points : [];
  const maxPct = pts.length ? Math.max(...pts.map(p => p.pct)) : null;
  const hasHeavyPoint = maxPct != null && maxPct >= MVT_HEAVY_PCT_MIN;
  const mvt = Math.round((profile.intercept + profile.slope * 1.0) * 100) / 100;
  if (!(mvt > 0) || !Number.isFinite(mvt)) {
    return { mvt: NaN, r2: profile.r2 ?? 0, valid: false, reason: 'Регрессия не даёт скорость на 100% — перекалибруй ramp.', hasHeavyPoint, maxMeasuredPct: maxPct };
  }
  if (!hasHeavyPoint) {
    return { mvt, r2: profile.r2 ?? 0, valid: false, reason: `Нет точки ≥85% (макс ${(maxPct as number) * 100}%) — добавь тяжёлый замер 85–90% (García-Ramos 2023c).`, hasHeavyPoint, maxMeasuredPct: maxPct };
  }
  if ((profile.r2 ?? 0) < MVT_R2_MIN) {
    return { mvt, r2: profile.r2 ?? 0, valid: false, reason: `r² ${profile.r2} <${MVT_R2_MIN} — разброс велик, MVT ненадёжен.`, hasHeavyPoint, maxMeasuredPct: maxPct };
  }
  return { mvt, r2: profile.r2 ?? 0, valid: true, reason: `Индивидуальный MVT ${mvt} м/с (r² ${profile.r2}) — точнее популяционного.`, hasHeavyPoint, maxMeasuredPct: maxPct };
}

export interface MVT1RMEstimate {
  e1rmKg: number;
  /** Уверенность: high (точка рядом с замером) / med (экстраполяция) */
  confidence: 'high' | 'med';
  note: string;
}

/**
 * Оценка 1RM по текущей скорости через индивидуальный профиль:
 * pct скорости → 1RM. Уверенность high, если скорость внутри диапазона замеров.
 */
export function predict1RMFromProfile(profile: LVPProfile | null | undefined, weightKg: number, velocityMs: number): MVT1RMEstimate | null {
  if (!profile || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(velocityMs) || velocityMs <= 0) return null;
  if (!Number.isFinite(profile.slope) || profile.slope === 0 || !Number.isFinite(profile.intercept)) return null;
  const m = individualMVT(profile);
  if (!m || !m.valid) return null;
  const pct = (velocityMs - profile.intercept) / profile.slope;
  if (!Number.isFinite(pct) || pct <= 0.2 || pct > 1.15) return null;
  const e1rmKg = Math.round((weightKg / pct) * 10) / 10;
  if (!Number.isFinite(e1rmKg) || e1rmKg <= 0) return null;
  const pts = Array.isArray(profile.points) ? profile.points : [];
  const vs = pts.map(p => p.velocity);
  const inRange = vs.length ? velocityMs >= Math.min(...vs) * 0.95 && velocityMs <= Math.max(...vs) * 1.05 : false;
  return {
    e1rmKg,
    confidence: inRange ? 'high' : 'med',
    note: inRange
      ? `1RM≈${e1rmKg}кг по индивидуальной кривой (MVT ${m.mvt} м/с, r² ${m.r2})`
      : `1RM≈${e1rmKg}кг (экстраполяция за замеры — ± шире, MVT ${m.mvt} м/с)`,
  };
}
