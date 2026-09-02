/**
 * strength-sport-lvp-calibration.engine.ts — индивидуальная калибровка LVP (Peak Velocity)
 * PLOS 2026 Wood: population LVP — гайд, индивидуальная обязательна (between-athlete variability)
 * Метод: ramp 50/65/75/85-90% × vmax → линейная регрессия velocity = a + b*pct
 * Хранение: he_lv_profile_ss_v1 { [lift]: LVPProfile }
 * Интеграция: VBT engine проверяет individual перед population
 */

export interface LVPPoint {
  pct: number; // 0.5-1.0
  velocity: number; // м/с peak
  loadKg?: number;
  hAcc?: number;
}

export interface LVPProfile {
  lift: string;
  points: LVPPoint[];
  slope: number; // b
  intercept: number; // a
  r2: number; // 0-1
  count: number;
  createdAt: string;
  valid: boolean; // r2 >=0.85 && count>=3
}

export interface LVPLinearResult {
  slope: number;
  intercept: number;
  r2: number;
  rmse: number;
}

const STORAGE_KEY = 'he_lv_profile_ss_v1';

function linearRegression(points: LVPPoint[]): LVPLinearResult | null {
  if (!points || points.length < 3) return null;
  const n = points.length;
  const xs = points.map(p => p.pct);
  const ys = points.map(p => p.velocity);
  const meanX = xs.reduce((a,b)=>a+b,0)/n;
  const meanY = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0; let den = 0;
  let ssTot = 0; let ssRes = 0;
  for (let i=0;i<n;i++) {
    const dx = xs[i]-meanX;
    const dy = ys[i]-meanY;
    num += dx*dy;
    den += dx*dx;
    ssTot += dy*dy;
  }
  if (den === 0) return null;
  const slope = num/den;
  const intercept = meanY - slope*meanX;
  for (let i=0;i<n;i++) {
    const pred = intercept + slope*xs[i];
    const res = ys[i] - pred;
    ssRes += res*res;
  }
  const r2 = ssTot > 0 ? 1 - ssRes/ssTot : 0;
  const rmse = Math.sqrt(ssRes/n);
  return { slope: Math.round(slope*1000)/1000, intercept: Math.round(intercept*1000)/1000, r2: Math.round(r2*1000)/1000, rmse: Math.round(rmse*1000)/1000 };
}

export function calibrateLVP(lift: string, points: LVPPoint[]): LVPProfile | null {
  if (!lift || !Array.isArray(points) || points.length < 3) return null;
  const clean = points.filter(p => Number.isFinite(p.pct) && Number.isFinite(p.velocity) && p.pct >= 0.3 && p.pct <= 1.1 && p.velocity > 0.2 && p.velocity < 4).map(p=> ({ pct: Math.round(p.pct*100)/100, velocity: Math.round(p.velocity*100)/100, loadKg: p.loadKg, hAcc: p.hAcc }));
  if (clean.length < 3) return null;
  // проверяем что pct-покрытие >=0.25 (например 50→90 разница 0.40)
  const pctSpread = Math.max(...clean.map(p=>p.pct)) - Math.min(...clean.map(p=>p.pct));
  if (pctSpread < 0.2) return null;
  const lr = linearRegression(clean);
  if (!lr) return null;
  // slope должен быть отрицателен (скорость падает с весом)
  if (lr.slope >= 0) return null;
  const r2 = lr.r2;
  const valid = r2 >= 0.85 && clean.length >= 3 && Math.abs(lr.slope) > 0.5; // минимальный наклон
  return {
    lift: String(lift).toLowerCase(),
    points: clean,
    slope: lr.slope,
    intercept: lr.intercept,
    r2,
    count: clean.length,
    createdAt: new Date().toISOString(),
    valid,
  };
}

export function velocityForLVP(profile: LVPProfile, pct: number): number | null {
  if (!profile || !Number.isFinite(pct)) return null;
  const p = Math.max(0.3, Math.min(1, pct));
  const v = profile.intercept + profile.slope * p;
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v*100)/100;
}

export function pctForVelocityLVP(profile: LVPProfile, velocity: number): number | null {
  if (!profile || !Number.isFinite(velocity) || profile.slope === 0) return null;
  const pct = (velocity - profile.intercept) / profile.slope;
  if (!Number.isFinite(pct)) return null;
  const clamped = Math.max(0.3, Math.min(1.05, pct));
  return Math.round(clamped*100)/100;
}

export function estimate1RMLVP(profile: LVPProfile, weight: number, velocity: number): number | null {
  if (!profile || weight <= 0 || velocity <= 0) return null;
  const pct = pctForVelocityLVP(profile, velocity);
  if (pct == null || pct <= 0) return null;
  const e1 = weight / pct;
  if (!Number.isFinite(e1) || e1 <= 0) return null;
  return Math.round(e1*10)/10;
}

export function loadLVPProfiles(): Record<string, LVPProfile> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return obj as Record<string, LVPProfile>;
  } catch { return {}; }
}

export function saveLVPProfile(profile: LVPProfile): void {
  try {
    const all = loadLVPProfiles();
    all[profile.lift] = profile;
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function saveLVPProfiles(profiles: Record<string, LVPProfile>): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch {}
}

export function loadLVPProfile(lift: string): LVPProfile | null {
  if (!lift) return null;
  const all = loadLVPProfiles();
  const key = String(lift).toLowerCase();
  // точный матч + маппинг
  if (all[key]) return all[key];
  // fallback: snatch variants → snatch
  if (key.includes('snatch') && all['snatch']) return all['snatch'];
  if ((key.includes('clean') || key.includes('jerk')) && all['clean']) return all['clean'];
  if (key.includes('squat') && all['squat']) return all['squat'];
  if (key.includes('dead') && all['deadlift']) return all['deadlift'];
  return null;
}

export function removeLVPProfile(lift: string): void {
  try {
    const all = loadLVPProfiles();
    const key = String(lift).toLowerCase();
    if (all[key]) { delete all[key]; if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
  } catch {}
}

export function clearLVPProfiles(): void { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY); } catch {} }

export function validateLVPPoints(points: LVPPoint[]): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!points || points.length < 3) errors.push('Нужно ≥3 точек (50/65/75/90%)');
  if (points) {
    const spread = points.length >=2 ? Math.max(...points.map(p=>p.pct)) - Math.min(...points.map(p=>p.pct)) : 0;
    if (spread < 0.2) warnings.push('Покрытие pct <20% — добавьте лёгкий 50% и тяжёлый 90%');
    for (const p of points) {
      if (!Number.isFinite(p.pct) || p.pct <0.3 || p.pct>1.1) errors.push(`pct ${p.pct} вне 0.3-1.1`);
      if (!Number.isFinite(p.velocity) || p.velocity<0.2 || p.velocity>4) errors.push(`velocity ${p.velocity} вне 0.2-4`);
    }
    if (points.length>=3) {
      const lr = linearRegression(points.filter(p=> Number.isFinite(p.pct)&&Number.isFinite(p.velocity)) as LVPPoint[]);
      if (lr && lr.r2 <0.85) warnings.push(`r² ${lr.r2} <0.85 — проверьте технику/измерения`);
      if (lr && lr.slope >=0) errors.push('Наклон ≥0 — скорость должна падать с весом');
    }
  }
  return { ok: errors.length===0, errors, warnings };
}

export const LVP_STORAGE_KEY = STORAGE_KEY;
