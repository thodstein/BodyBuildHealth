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

/** V4 PRO-v4: честный MVT-2 (Swinton 2026; Thompson/Weakley). */

/** SDD средней скорости (шум): меньше = не прогресс, а вариативность. */
export const TA_VELOCITY_SDD = 0.06; // м/с

/** Значим ли сдвиг скорости (вне SDD). */
export function isVelocityShiftReal(beforeMs: number, afterMs: number, sdd = TA_VELOCITY_SDD): boolean | null {
  if (!Number.isFinite(beforeMs) || !Number.isFinite(afterMs)) return null;
  return Math.abs(afterMs - beforeMs) >= sdd;
}

/**
 * Shrinkage MVT к популяционному при малом числе точек (частичный пулинг,
 * Swinton 2026: индивидуальный MVT на 2–3 точках переобучается, TE 0.048).
 * V4-добой: вес с учётом r² — шумная регрессия (низкий r²) сильнее тянется
 * к популяционному: effN = n × r². Без r² (legacy) — как раньше.
 */
export function shrinkMVT(individualMvt: number, populationMvt: number, nPoints: number, r2?: number | null): { mvt: number; te: number; note: string } | null {
  if (!Number.isFinite(individualMvt) || !Number.isFinite(populationMvt) || !Number.isFinite(nPoints) || nPoints < 2) return null;
  const r = r2 != null && Number.isFinite(r2) ? Math.max(0.3, Math.min(1, r2)) : 1;
  const effN = nPoints * r;
  const w = effN / (effN + 2);
  const mvt = Math.round((w * individualMvt + (1 - w) * populationMvt) * 100) / 100;
  const te = effN >= 4 ? 0.02 : 0.03;
  return { mvt, te, note: effN >= 4 ? `MVT≈${mvt} м/с (±${te}, точек достаточно)` : `MVT≈${mvt} м/с (±${te}, мало точек — притянут к популяционному ${populationMvt})` };
}

/** Популяционный MVT ТА-тяги как якорь shrinkage (пик-скорость, ориентир). */
export const TA_POPULATION_MVT = 1.3; // м/с — нижняя граница PLOS-зон рывка

/** Разброс популяционного MVT (PoinT GO: индивид ±0.05–0.10 от среднего — берём 0.05, честно). */
export const TA_POPULATION_MVT_SD = 0.05; // м/с

export interface MVTPosterior {
  mvt: number; // posterior mean, м/с
  sd: number; // posterior SD (честный TE)
  seIndiv: number; // SE индивидуальной оценки из остатков
  n: number;
  note: string;
}

/**
 * V4-добой-2 (П4): настоящий эмпирический Байес вместо эвристики n/(n+2).
 * SE индивидуальной MVT-оценки — из остатков LVP-регрессии в точке pct=1.0:
 *   se = s·sqrt(1 + 1/n + (1−x̄)²/Sxx), s = sqrt(SSE/(n−2)).
 * Posterior = precision-взвесь likelihood N(m, se²) и приора N(popMvt, popSd²).
 * Мало точек / большой разброс → posterior автоматически тянется к популяции,
 * много чистых точек → к индивиду. Swinton 2026: именно так partial pooling
 * чинит переобучение индивидуального MVT (TE 0.048 → ~0.020).
 */
export function mvtPosterior(
  profile: LVPProfile | null | undefined,
  populationMvt: number = TA_POPULATION_MVT,
  populationSd: number = TA_POPULATION_MVT_SD,
): MVTPosterior | null {
  if (!profile || !Number.isFinite(profile.slope) || !Number.isFinite(profile.intercept)) return null;
  if (!Number.isFinite(populationMvt) || !Number.isFinite(populationSd) || populationSd <= 0) return null;
  const pts = (Array.isArray(profile.points) ? profile.points : []).filter(
    (p) => p && Number.isFinite(p.pct) && Number.isFinite(p.velocity),
  );
  const n = pts.length;
  if (n < 3) return null;
  const xs = pts.map((p) => p.pct);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  let sse = 0;
  let sxx = 0;
  for (const p of pts) {
    const r = p.velocity - (profile.intercept + profile.slope * p.pct);
    sse += r * r;
    sxx += (p.pct - meanX) * (p.pct - meanX);
  }
  if (!(sxx > 0) || n - 2 < 1) return null;
  const s = Math.sqrt(sse / (n - 2));
  // Предсказание в x=1.0 (MVT): se предсказания нового наблюдения
  const seIndiv = s * Math.sqrt(1 + 1 / n + ((1 - meanX) * (1 - meanX)) / sxx);
  if (!Number.isFinite(seIndiv) || seIndiv <= 0) return null;
  const m = profile.intercept + profile.slope * 1.0;
  if (!Number.isFinite(m) || m <= 0) return null;
  const wIndiv = 1 / (seIndiv * seIndiv);
  const wPop = 1 / (populationSd * populationSd);
  const post = (wIndiv * m + wPop * populationMvt) / (wIndiv + wPop);
  const sd = Math.sqrt(1 / (wIndiv + wPop));
  const mvt = Math.round(post * 100) / 100;
  const sdR = Math.round(sd * 1000) / 1000;
  const pulled = Math.abs(post - m) > 0.015;
  return {
    mvt,
    sd: sdR,
    seIndiv: Math.round(seIndiv * 1000) / 1000,
    n,
    note: pulled
      ? `MVT≈${mvt} ±${sdR} (posterior: индивид ${Math.round(m * 100) / 100} с SE ${Math.round(seIndiv * 1000) / 1000} притянут к ${populationMvt})`
      : `MVT≈${mvt} ±${sdR} (индивид надёжен, n=${n})`,
  };
}

/** Флаг метрики скорости: mean vs peak путать нельзя (обзоры 2024). */
export function velocityMetricFlag(metric: string | null | undefined): string | null {
  const m = String(metric || '').toLowerCase();
  if (!m) return null;
  if (m.includes('peak') || m.includes('пик')) return 'пик-скорость: для прогноза 1RM нужна средняя (mean) — пик завышает оценку';
  return null;
}

/** Напоминание о перетесте LVP/MVT (блок 4+ нед / ΔBW 3+ кг / layoff 3+ нед). */
export function mvtRetestNote(weeksSinceCalib: number | null | undefined, bwDeltaKg: number | null | undefined): string | null {
  const w = weeksSinceCalib != null && Number.isFinite(weeksSinceCalib) ? weeksSinceCalib : null;
  const d = bwDeltaKg != null && Number.isFinite(Math.abs(bwDeltaKg)) ? Math.abs(bwDeltaKg) : null;
  if ((w != null && w >= 4) || (d != null && d >= 3)) {
    return 'LVP/MVT устарел (блок 4+ нед или ΔBW 3+ кг) — перекалибруй ramp перед заявками';
  }
  return null;
}
