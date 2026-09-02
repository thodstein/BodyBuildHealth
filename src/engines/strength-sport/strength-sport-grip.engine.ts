/**
 * strength-sport-grip.engine.ts — tri-modal калибровка хвата (AthleteProfile 30-45% Diff)
 * Поддерживает pinch 2/3/4″, crush CoC 1/1.5/2, support fatGripz 50мм
 * Хранение: he_grip_profile_v1 { supportSec, pinchSecByWidth, crushLevel }
 */

export interface GripProfile {
  supportSec?: number; // вис / фермер hold
  pinchSecByWidth?: Record<string, number>; // "2":12, "3":15
  crushLevel?: string; // "coc1","coc1.5","coc2"
  updatedAt?: string;
}

const KEY = 'he_grip_profile_v1';

export function loadGripProfile(): GripProfile {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}
export function saveGripProfile(p: GripProfile): void { try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() })); } catch {} }

export function diagnoseGrip(p: GripProfile & { supportSecInput?: number; pinchSec?: number; axleHoldSec?: number }): { fails: number; level: 'ok'|'warn'|'critical'; note: string } {
  let fails = 0;
  const sup = p.supportSecInput ?? p.supportSec;
  if (typeof sup === 'number' && sup < 30) fails++;
  if (typeof p.pinchSec === 'number' && p.pinchSec < 20) fails++;
  if (typeof (p as any).axleHoldSec === 'number' && (p as any).axleHoldSec < 30) fails++;
  // tri-modal width check
  const widths = p.pinchSecByWidth || {};
  for (const w of Object.keys(widths)) {
    const v = widths[w];
    const thr = w==='2' ? 12 : w==='3' ? 15 : 18;
    if (Number.isFinite(v) && v < thr) fails++;
  }
  if (fails > 3) fails = 3;
  let level: 'ok'|'warn'|'critical' = fails===0 ? 'ok' : fails>=2 ? 'critical' : 'warn';
  let note = fails===0 ? 'Grip ✅ tri-modal ok' : fails>=2 ? `Grip ⛔ ${fails}/3 fail — prehab hammer 3×12 + pinch 2×15` : `Grip ⚠️ ${fails}/3 — fatGripz 50мм + вис`;
  return { fails, level, note };
}

export function gripThresholdForWidth(widthInch: string, base = 15): number {
  const map: Record<string, number> = { '2':12, '3':15, '4':18 };
  return map[widthInch] ?? base;
}
