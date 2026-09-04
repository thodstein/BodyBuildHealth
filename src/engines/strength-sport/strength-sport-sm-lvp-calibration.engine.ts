/**
 * strength-sport-sm-lvp-calibration.engine.ts — LVP-КАЛИБРОВКА ДЛЯ СТРОНГМЕНА (SM PRO)
 *
 * Обёртка над общей strength-sport-lvp-calibration (линейная регрессия velocity = a + b*pct):
 * SM-лифты ходьбы/загрузки имеют свои скорости (м/с), ramp 50/65/75/90% обязателен,
 * покрытие pct ≥20%, r² ≥0.85 (valid), иначе warn.
 * SM_LVP_LIFTS: yoke_walk / farmers_walk / stone_load / log_press.
 * Источники: Wood PLOS 2026 (индивидуальная калибровка обязательна, population ±0.15),
 * Hindle yoke 1.69 м/с / stone triple extension, PoinT GO MHV 1.4-1.9.
 *
 * Чистый движок + storage-хелперы (try/catch, ключ he_lv_sm_v1 отдельно от TA).
 */

import {
  calibrateLVP,
  loadLVPProfiles,
  saveLVPProfile as saveBaseProfile,
  type LVPPoint,
  type LVPProfile,
} from './strength-sport-lvp-calibration.engine';

export const SM_LVP_LIFTS = ['yoke_walk', 'farmers_walk', 'stone_load', 'log_press'] as const;
export type SMLvpLift = (typeof SM_LVP_LIFTS)[number];

export const SM_LVP_STORAGE_KEY = 'he_lv_sm_v1';

/** Канонический SM-лифт для произвольного id (йок/фермер/камень/лог, RU+EN). */
export function smLvpLiftFor(id: string): SMLvpLift | null {
  const low = String(id || '').toLowerCase();
  if (low.includes('yoke') || low.includes('йок')) return 'yoke_walk';
  if (low.includes('farmer') || low.includes('фермер') || low.includes('frame_carry') || low.includes('husafell') || low.includes('conan') || low.includes('shield') || low.includes('хус') || low.includes('рама')) return 'farmers_walk';
  if (low.includes('stone') || low.includes('камен') || low.includes('sandbag') || low.includes('мешок') || low.includes('keg') || low.includes('tire') || low.includes('бочка') || low.includes('шина')) return 'stone_load';
  if (low.includes('log') || low.includes('лог') || low.includes('axle') || low.includes('аксель') || low.includes('viking') || low.includes('circus') || low.includes('press') || low.includes('ohp') || low.includes('жим')) return 'log_press';
  return null;
}

/** Ramp-точки из 4 полей хаба (50/65/75/90%) → LVPPoint[]. loadKg опционален. */
export function smLvpPointsFromRamp(v50: number, v65: number, v75: number, v90: number): LVPPoint[] | null {
  const vals: Array<[number, number]> = [
    [0.5, v50],
    [0.65, v65],
    [0.75, v75],
    [0.9, v90],
  ];
  const pts: LVPPoint[] = [];
  for (const [pct, v] of vals) {
    if (!Number.isFinite(v) || v <= 0.15 || v > 4) continue;
    pts.push({ pct, velocity: Math.round(v * 100) / 100 });
  }
  return pts.length >= 3 ? pts : null;
}

/** Калибровка SM-лифта (делегирует общей, метка lift — каноническая). */
export function calibrateSMLVP(lift: string, points: LVPPoint[]): LVPProfile | null {
  const canon = smLvpLiftFor(lift) || String(lift).toLowerCase();
  return calibrateLVP(canon, points);
}

/** Загрузка SM-профилей (сначала he_lv_sm_v1, fallback — общий he_lv_profile_ss_v1). */
export function loadSMLVPProfiles(): Record<string, LVPProfile> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SM_LVP_STORAGE_KEY) : null;
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, LVPProfile>;
    }
  } catch { /* noop */ }
  try {
    return loadLVPProfiles();
  } catch {
    return {};
  }
}

export function loadSMLVPProfile(lift: string): LVPProfile | null {
  if (!lift) return null;
  const all = loadSMLVPProfiles();
  const key = String(lift).toLowerCase();
  if (all[key]) return all[key];
  const canon = smLvpLiftFor(key);
  if (canon && all[canon]) return all[canon];
  return null;
}

export function saveSMLVPProfile(profile: LVPProfile): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(SM_LVP_STORAGE_KEY);
    const all: Record<string, LVPProfile> = raw ? (JSON.parse(raw) as Record<string, LVPProfile>) : {};
    all[profile.lift] = profile;
    localStorage.setItem(SM_LVP_STORAGE_KEY, JSON.stringify(all));
  } catch { /* noop */ }
  // Дублируем в общий стор для VBT-движка (он читает общий ключ приоритетно)
  try {
    saveBaseProfile(profile);
  } catch { /* noop */ }
}

/** Валидация ramp: ≥3 точек + покрытие ≥20% + наклон <0 + r² warn. */
export function validateSMLVP(lift: string, points: LVPPoint[]): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!smLvpLiftFor(lift) && !(SM_LVP_LIFTS as readonly string[]).includes(String(lift).toLowerCase())) {
    warnings.push(`Лифт ${lift} не из SM-четвёрки — калибровка всё равно посчитается как population-fallback.`);
  }
  if (!points || points.length < 3) errors.push('Нужно ≥3 точек (50/65/75/90%)');
  if (points && points.length >= 2) {
    const spread = Math.max(...points.map((p) => p.pct)) - Math.min(...points.map((p) => p.pct));
    if (spread < 0.2) warnings.push('Покрытие pct <20% — добавьте лёгкие 50% и тяжёлые 90%');
  }
  const prof = points && points.length >= 3 ? calibrateSMLVP(lift, points) : null;
  if (points && points.length >= 3 && !prof) errors.push('Регрессия не сошлась — скорость должна падать с весом');
  if (prof && !prof.valid) warnings.push(`r² ${prof.r2} <0.85 — проверьте технику/измерения (Wood: индивидуальная вариативность)`);
  return { ok: errors.length === 0, errors, warnings };
}
