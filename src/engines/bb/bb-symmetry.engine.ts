/**
 * bb-symmetry.engine.ts — Симметрия ББ (Reeves/Sandow/Adonis + L/R + push/pull).
 * Чистый движок, без UI. RSS-скор отдельно в bb-scoring.
 */
import type { BBBalanceReport } from './bb-balance.engine';

export interface BBSymmetryInput {
  // окружности см
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  neck?: number | null;
  bicepL?: number | null; bicepR?: number | null;
  thighL?: number | null; thighR?: number | null;
  calfL?: number | null; calfR?: number | null;
  forearmL?: number | null; forearmR?: number | null;
  shoulderWidth?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
}

export interface BBSymmetryResult {
  ratios: Record<string, number>;
  issues: string[];
  score: number; // 0-100 (чем выше, тем симметричнее)
}

function asymPct(l: number | null | undefined, r: number | null | undefined): number | null {
  if (!Number.isFinite(l as number) || !Number.isFinite(r as number) || !l || !r) return null;
  const a = Number(l), b = Number(r);
  return Math.round(Math.abs(a - b) / Math.max(a, b) * 1000) / 10;
}

function idealFor(key: string, h: number): number {
  const base: Record<string, number> = { chest: 114, waist: 76, shoulderWidth: 50, bicep: 40, calf: 38, neck: 40, thigh: 60 };
  const b = base[key] ?? 0;
  if (!b) return 0;
  if (!Number.isFinite(h) || h <= 0) return b;
  return Math.round(b * (h / 175) * 10) / 10;
}

export function scoreBBSymmetry(
  meas: BBSymmetryInput,
  balance?: BBBalanceReport | null,
  factVolume?: Record<string, { effectiveSets?: number; directSets?: number }> | null,
): BBSymmetryResult {
  const ratios: Record<string, number> = {};
  const issues: string[] = [];
  let penalty = 0;

  // L/R
  const pairs: Array<[string, number | null | undefined, number | null | undefined]> = [
    ['bicep', meas.bicepL, meas.bicepR],
    ['thigh', meas.thighL, meas.thighR],
    ['calf', meas.calfL, meas.calfR],
    ['forearm', meas.forearmL, meas.forearmR],
  ];
  for (const [name, l, r] of pairs) {
    const p = asymPct(l, r);
    if (p != null) {
      ratios[`${name}_asym`] = p;
      if (p >= 12) { issues.push(`${name} L/R асимметрия ${p}% ≥12% (critical)`); penalty += 18; }
      else if (p >= 7) { issues.push(`${name} L/R асимметрия ${p}% ≥7% (warn)`); penalty += 10; }
    }
  }

  // V-taper / Adonis / Reeves
  if (Number.isFinite(meas.shoulderWidth as number) && Number.isFinite(meas.waist as number) && (meas.waist as number) > 0) {
    const vt = Number(meas.shoulderWidth) / Number(meas.waist);
    ratios['shoulder/waist'] = Math.round(vt * 100) / 100;
    const target = 1.618;
    const diff = Math.abs(vt - target) / target;
    if (diff > 0.15) { issues.push(`V-taper плечи/талия ${vt.toFixed(2)} (цель ${target})`); penalty += 8; }
  }
  if (Number.isFinite(meas.chest as number) && Number.isFinite(meas.waist as number) && (meas.waist as number) > 0) {
    const cr = Number(meas.chest) / Number(meas.waist);
    ratios['chest/waist'] = Math.round(cr * 100) / 100;
    if (cr < 1.45) { issues.push(`Грудь/талия ${cr.toFixed(2)} <1.45 (узкая грудь)`); penalty += 8; }
  }
  if (Number.isFinite(meas.bicepL as number) || Number.isFinite(meas.bicepR as number)) {
    const b = Number(meas.bicepL ?? meas.bicepR);
    const neck = Number(meas.neck);
    if (Number.isFinite(b) && Number.isFinite(neck) && neck > 0) {
      const r = b / neck;
      ratios['bicep/neck'] = Math.round(r * 100) / 100;
      if (Math.abs(r - 1) > 0.12) { issues.push(`Бицепс/шея ${r.toFixed(2)} (цель 1.0 Reeves)`); penalty += 6; }
    }
    const calf = Number(meas.calfL ?? meas.calfR);
    if (Number.isFinite(b) && Number.isFinite(calf) && calf > 0) {
      const r = b / calf;
      ratios['bicep/calf'] = Math.round(r * 100) / 100;
      if (Math.abs(r - 1) > 0.12) { issues.push(`Бицепс/икры ${r.toFixed(2)} (цель 1.0 Reeves)`); penalty += 6; }
    }
  }

  // Идеалы Reeves по росту (дельта)
  const h = Number(meas.heightCm);
  if (Number.isFinite(h) && h > 0) {
    for (const k of ['chest', 'waist', 'bicep', 'thigh'] as const) {
      const mVal = (meas as any)[k] ?? (meas as any)[`${k}L`] ?? (meas as any)[`${k}R`];
      const n = Number(mVal);
      if (!Number.isFinite(n) || n <= 0) continue;
      const ideal = idealFor(k === 'bicep' ? 'bicep' : k, h);
      if (!ideal) continue;
      const delta = Math.round(((n - ideal) / ideal) * 1000) / 10;
      ratios[`${k}_vs_ideal_pct`] = delta;
      if (delta <= -12) { issues.push(`${k} ${n}см vs идеал Reeves ${ideal}см (${delta}%)`); penalty += 8; }
    }
  }

  // Баланс из плана (если есть)
  if (balance) {
    if (balance.pullPressRatio) {
      ratios['pull/press'] = balance.pullPressRatio;
      if (balance.pullPressRatio < 0.75) { issues.push(`Тяги/жимы ${balance.pullPressRatio} <0.75`); penalty += 10; }
      if (balance.pullPressRatio > 1.4) { issues.push(`Тяги/жимы ${balance.pullPressRatio} >1.4`); penalty += 6; }
    }
    // per-muscle balance issues уже в balance.issues — не дублируем, только penalty
    const cnt = balance.issues.length;
    if (cnt >= 3) penalty += 8;
    else if (cnt >= 1) penalty += 4;
  }

  // FACT volume: push/pull, quad/ham
  if (factVolume) {
    const get = (m: string) => factVolume[m]?.effectiveSets ?? factVolume[m]?.directSets ?? 0;
    const push = get('chest') + get('triceps') + get('delt_front') + get('delt_mid');
    const pull = get('back') + get('biceps') + get('delt_rear') + get('hamstrings');
    if (push > 0 && pull > 0) {
      const r = push / pull;
      ratios['push/pull'] = Math.round(r * 100) / 100;
      if (r > 1.3 || r < 0.77) { issues.push(`Push/pull fact ${ratios['push/pull']}`); penalty += 8; }
    }
    const quad = get('quads'), ham = get('hamstrings');
    if (quad > 0 && ham > 0) {
      const r = quad / ham;
      ratios['quad/ham'] = Math.round(r * 100) / 100;
      if (r > 1.5 || r < 0.66) { issues.push(`Квадр/биц.бедра fact ${r.toFixed(2)}`); penalty += 8; }
    }
  }

  // FFMI (Fat-Free Mass Index) — health, не красота; просто рацио
  if (Number.isFinite(meas.weightKg as number) && Number.isFinite(h as number) && Number.isFinite(meas.bodyFatPct as number)) {
    const w = Number(meas.weightKg), bf = Number(meas.bodyFatPct) / 100;
    const lbm = w * (1 - bf);
    const hm = h / 100;
    const ffmi = hm > 0 ? lbm / (hm * hm) : 0;
    if (ffmi > 0) ratios['ffmi'] = Math.round(ffmi * 10) / 10;
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - Math.min(60, penalty))));
  return { ratios, issues, score };
}

export function idealReevesMap(heightCm: number): Record<string, number> {
  return {
    chest: idealFor('chest', heightCm),
    waist: idealFor('waist', heightCm),
    shoulderWidth: idealFor('shoulderWidth', heightCm),
    bicep: idealFor('bicep', heightCm),
    thigh: idealFor('thigh', heightCm),
    calf: idealFor('calf', heightCm),
    neck: idealFor('neck', heightCm),
  };
}

/**
 * Идеалы McCallum по запястью (канон классики, MAX PRO).
 * chest=wrist×6.5, waist×4.5, thigh×3.0, neck/bicep×2.5, calf×2.0, forearm×1.8.
 */
export function idealMcCallumMap(wristCm: number): Record<string, number> {
  if (!Number.isFinite(wristCm) || wristCm <= 0) return {};
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  const chest = wristCm * 6.5;
  return {
    chest: r1(chest),
    waist: r1(wristCm * 4.5),
    hips: r1(chest * 0.85),
    thigh: r1(wristCm * 3.0),
    neck: r1(wristCm * 2.5),
    bicep: r1(wristCm * 2.5),
    calf: r1(wristCm * 2.0),
    forearm: r1(wristCm * 1.8),
  };
}

/** Триада симметрии Reeves: шея ≈ бицепс ≈ икры. Возвращает макс. отклонение %. */
export function symmetryTriadDeviation(meas: { neck?: number | null; bicep?: number | null; calf?: number | null }): number | null {
  const vals = [meas.neck, meas.bicep, meas.calf].map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length < 2) return null;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  if (mx <= 0) return null;
  return Math.round(((mx - mn) / mx) * 1000) / 10;
}

/** Female-ориентиры: талия/бёдра ~0.7, акцент glute/thigh (health+aesthetics, не жёсткий floor). */
export function femaleSymmetryNotes(meas: { waist?: number | null; hips?: number | null; thigh?: number | null }): string[] {
  const out: string[] = [];
  const w = Number(meas.waist);
  const h = Number(meas.hips);
  if (Number.isFinite(w) && Number.isFinite(h) && h > 0) {
    const r = w / h;
    if (r > 0.8) out.push(`Талия/бёдра ${r.toFixed(2)} > 0.80 — акцент glute + дефицит мягкий`);
    else if (r < 0.6) out.push(`Талия/бёдра ${r.toFixed(2)} < 0.60 — держим верх (спина/дельты) для баланса`);
  }
  return out;
}

/** Снимок замеров для трекинга («перепроверка через 4 нед»). Чистые функции — IO в хабе. */
export interface MeasureSnapshot {
  date: string; // ISO yyyy-mm-dd
  meas: Record<string, number>;
}

/** Добавить снимок (дедуп по дате — перезаписывает, кап N последних). */
export function appendMeasureSnapshot(
  history: MeasureSnapshot[],
  entry: MeasureSnapshot,
  cap = 12,
): MeasureSnapshot[] {
  const list = Array.isArray(history) ? history.filter((s) => s && typeof s.date === 'string' && s.meas) : [];
  const cleanMeas: Record<string, number> = {};
  for (const [k, v] of Object.entries(entry.meas || {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) cleanMeas[k] = Math.round(n * 10) / 10;
  }
  if (!Object.keys(cleanMeas).length) return list;
  const next = [...list.filter((s) => s.date !== entry.date), { date: entry.date, meas: cleanMeas }];
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return next.slice(-Math.max(1, cap));
}

export interface MeasureDelta {
  from: number;
  to: number;
  deltaPct: number;
}

/** Дельты замеров old → recent по общим ключам (для ленты «было/стало»). */
export function measureDeltas(
  oldSnap: MeasureSnapshot | null | undefined,
  recentMeas: Record<string, number>,
): Record<string, MeasureDelta> {
  const out: Record<string, MeasureDelta> = {};
  if (!oldSnap || !oldSnap.meas) return out;
  for (const [k, from] of Object.entries(oldSnap.meas)) {
    const to = Number((recentMeas as Record<string, number>)[k]);
    if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) continue;
    out[k] = { from, to, deltaPct: Math.round(((to - from) / from) * 1000) / 10 };
  }
  return out;
}
