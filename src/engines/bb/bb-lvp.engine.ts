/**
 * bb-lvp.engine.ts — PRO-3 R1: LVP-лайт для ББ (индивидуальный профиль нагрузка–скорость).
 *
 * Популяционный LVP — гайд (PLOS 2026 Wood: межатлетная вариабельность требует
 * индивидуальной калибровки, как в TA `strength-sport-lvp-calibration`).
 * Здесь — лёгкая версия: 3+ точки (вес × скорость лучшего повтора) → линейная
 * регрессия v = a + b·w → e1RM при MVT данного движения.
 *
 * MVT берём из канона `pro/vbt.engine` (Gonzalez-Badillo) — своих чисел не выдумываем.
 * Чистый движок, план не мутирует.
 */

import { MVT, type VBTLift } from '../pro/vbt.engine';

export interface BbLvpPoint {
  weightKg: number;
  velocity: number; // м/с лучшего повтора
}

export interface BbLvpProfile {
  lift: string;
  vbtLift: VBTLift;
  points: BbLvpPoint[];
  slope: number; // (м/с)/кг, отрицательный
  intercept: number; // м/с при 0 кг
  r2: number; // 0–1
  count: number;
  valid: boolean; // точек ≥3, разброс веса ≥10 кг, наклон<0, r²≥0.85
  mvt: number; // скорость 1ПМ из канона
  e1rm: number | null; // вес при v=MVT
  text: string;
}

/** Маппинг имён в VBT-профиль (тот же, что `diagnoseVelocity` в pro/vbt). */
export function bbLvpLiftFor(name: string): VBTLift | null {
  const l = String(name || '').toLowerCase().trim();
  if ((['squat', 'bench', 'deadlift', 'ohp', 'row'] as string[]).includes(l)) return l as VBTLift;
  if (l === 'pulldown' || l === 'biceps' || l === 'shrug') return 'row';
  if (l === 'incline_press' || l === 'triceps') return 'bench';
  if (l === 'sumo') return 'deadlift';
  if (l === 'calf') return 'squat';
  return null;
}

/** Разбор текстовых строк «вес скорость» (пробел/×/;/, — для поля хаба). */
export function parseBbLvpText(text: string): BbLvpPoint[] {
  const out: BbLvpPoint[] = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.trim().replace(',', '.').split(/[\s×x;\/]+/).filter(Boolean);
    if (m.length < 2) continue;
    const w = parseFloat(m[0]);
    const v = parseFloat(m[1]);
    if (Number.isFinite(w) && Number.isFinite(v) && w > 0 && v > 0.2 && v < 4) {
      out.push({ weightKg: Math.round(w * 10) / 10, velocity: Math.round(v * 100) / 100 });
    }
  }
  return out.slice(0, 8);
}

function linReg(pts: BbLvpPoint[]): { slope: number; intercept: number; r2: number } | null {
  const n = pts.length;
  if (n < 3) return null;
  const xs = pts.map((p) => p.weightKg);
  const ys = pts.map((p) => p.velocity);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  let tot = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
    tot += (ys[i] - my) * (ys[i] - my);
  }
  if (den <= 0 || tot <= 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  let res = 0;
  for (let i = 0; i < n; i++) {
    const d = ys[i] - (intercept + slope * xs[i]);
    res += d * d;
  }
  return { slope, intercept, r2: Math.max(0, 1 - res / tot) };
}

export function calibrateBbLvp(lift: string, points: BbLvpPoint[]): BbLvpProfile | null {
  const vbtLift = bbLvpLiftFor(lift);
  if (!vbtLift) return null;
  const clean = (Array.isArray(points) ? points : [])
    .filter((p) => Number.isFinite(p?.weightKg) && Number.isFinite(p?.velocity) && p.weightKg > 0 && p.velocity > 0.2 && p.velocity < 4)
    .map((p) => ({ weightKg: Math.round(p.weightKg * 10) / 10, velocity: Math.round(p.velocity * 100) / 100 }));
  if (clean.length < 3) return null;
  const spread = Math.max(...clean.map((p) => p.weightKg)) - Math.min(...clean.map((p) => p.weightKg));
  if (spread < 10) return null; // точки скучены — наклон неинформативен
  const lr = linReg(clean);
  if (!lr) return null;
  if (lr.slope >= -0.0005) return null; // скорость не падает с весом — мусор
  const valid = lr.r2 >= 0.85;
  const mvt = MVT[vbtLift] ?? 0.2;
  // e1RM — только при валидном профиле (иначе честно null, без выдумок)
  const e1rm = valid ? Math.round(((mvt - lr.intercept) / lr.slope) * 2) / 2 : null;
  const okE1rm = e1rm != null && e1rm > 0 && e1rm < 500;
  return {
    lift: String(lift).toLowerCase(),
    vbtLift,
    points: clean,
    slope: Math.round(lr.slope * 100000) / 100000,
    intercept: Math.round(lr.intercept * 100) / 100,
    r2: Math.round(lr.r2 * 1000) / 1000,
    count: clean.length,
    valid,
    mvt,
    e1rm: okE1rm ? (e1rm as number) : null,
    text: !valid
      ? `LVP ${lift}: r² ${lr.r2.toFixed(2)} — мало/шумно, нужно 3+ точки с разбросом (популяционный профиль)`
      : `LVP ${lift}: r² ${lr.r2.toFixed(2)}, e1RM ≈ ${okE1rm ? e1rm : '—'} кг (при MVT ${mvt} м/с)`,
  };
}

/** S2: персист индивидуального профиля (подъём → профиль, кап 5 движений). */
const LVP_STORE_KEY = 'he_bb_lvp_profile';

export type BbLvpStore = Record<string, BbLvpProfile>;

function isLvpProfileShape(v: any): v is BbLvpProfile {
  return !!v && typeof v === 'object'
    && typeof v.lift === 'string' && Array.isArray(v.points) && v.points.length >= 3
    && Number.isFinite(v.slope) && Number.isFinite(v.intercept)
    && Number.isFinite(v.r2) && v.valid === true;
}

export function loadBbLvpProfiles(): BbLvpStore {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LVP_STORE_KEY) : null;
    if (!raw) return {};
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return {};
    const out: BbLvpStore = {};
    for (const [k, v] of Object.entries(j)) {
      if (isLvpProfileShape(v)) out[String(k).toLowerCase()] = v;
    }
    return out;
  } catch { return {}; }
}

/** Сохранить только валидный профиль (r²≥0.85, e1RM честный); мусор не пишем. */
export function saveBbLvpProfile(profile: BbLvpProfile | null | undefined): BbLvpStore {
  const store = loadBbLvpProfiles();
  if (!profile || !isLvpProfileShape(profile)) return store;
  const next: BbLvpStore = { ...store, [profile.lift.toLowerCase()]: profile };
  // кап 5 движений — свежие вытесняют старые по createdAt? порядка нет — режем лишнее
  const keys = Object.keys(next);
  if (keys.length > 5) delete next[keys[0]];
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LVP_STORE_KEY, JSON.stringify(next));
  } catch { /* quota — молча, профиль останется на сессию */ }
  return next;
}
