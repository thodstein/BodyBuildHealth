/**
 * strength-sport-sm-grip-calibration.engine.ts — TRI-MODAL КАЛИБРОВКА ХВАТА (SM PRO P1)
 *
 * Хаб хранил бинарные пороги support<30с / pinch<20с / crush<30с.
 * PRO: калибровка по имплементу — pinch ширина блока 2″/3″/4″, crush CoC 1/1.5/2,
 * support fatGripz 50мм; профиль he_grip_profile_v1 → персональные пороги gripFails.
 * Источники: SBS 2024 (support/pinch/crush r=0.40), PoinT GO 2026 (farmer 70-100% BW),
 * GoldenGrip 4 типа (crush/pinch/support/extension), AthleteProfile 30-45%.
 *
 * Чистый движок + storage-хелперы (try/catch).
 */

export const SM_GRIP_PROFILE_KEY = 'he_grip_profile_v1';

export type SMPinchWidth = '2in' | '3in' | '4in';
export type SMCoCLevel = 'coc1' | 'coc1_5' | 'coc2';

export interface SMGripProfile {
  pinchWidth: SMPinchWidth;
  cocLevel: SMCoCLevel;
  fatGripMm: number; // 38 | 50 | 60
  supportSec: number; // персональный порог support, с
  pinchSec: number; // персональный порог pinch, с
  crushSec: number; // персональный порог crush/axle-hold, с
  updatedAt: string;
}

/** Дефолтные пороги хаба (до калибровки): 30/20/30. */
export const SM_GRIP_DEFAULTS = { supportSec: 30, pinchSec: 20, crushSec: 30 };

/** Пороги по ширине pinch-блока: шире блок — держать тяжелее, норма ниже. */
export function pinchNormForWidth(w: SMPinchWidth): number {
  if (w === '2in') return 30;
  if (w === '4in') return 15;
  return 20; // 3in — стандарт хаба
}

/** Пороги crush по CoC: выше уровень — норма выше. */
export function crushNormForCoc(c: SMCoCLevel): number {
  if (c === 'coc1') return 20;
  if (c === 'coc2') return 40;
  return 30; // coc1.5 — стандарт
}

/** Построить профиль из выборов хаба. */
export function buildSMGripProfile(input: { pinchWidth?: SMPinchWidth; cocLevel?: SMCoCLevel; fatGripMm?: number }): SMGripProfile {
  const pinchWidth = input.pinchWidth || '3in';
  const cocLevel = input.cocLevel || 'coc1_5';
  const fatGripMm = input.fatGripMm === 50 || input.fatGripMm === 60 || input.fatGripMm === 38 ? input.fatGripMm : 50;
  // FatGrip 50мм+ усложняет support: порог −5с; 38мм — стандарт
  const supportSec = fatGripMm >= 50 ? 25 : SM_GRIP_DEFAULTS.supportSec;
  return {
    pinchWidth,
    cocLevel,
    fatGripMm,
    supportSec,
    pinchSec: pinchNormForWidth(pinchWidth),
    crushSec: crushNormForCoc(cocLevel),
    updatedAt: new Date().toISOString(),
  };
}

/** Посчитать fails 0-3 по персональным порогам (вместо фикса 30/20/30). */
export function smGripFailsCalibrated(
  holds: { supportSec?: number | null; pinchSec?: number | null; crushSec?: number | null },
  profile?: SMGripProfile | null,
): number {
  const p = profile || { supportSec: SM_GRIP_DEFAULTS.supportSec, pinchSec: SM_GRIP_DEFAULTS.pinchSec, crushSec: SM_GRIP_DEFAULTS.crushSec };
  let fails = 0;
  if (holds.supportSec != null && Number.isFinite(holds.supportSec) && (holds.supportSec as number) < p.supportSec) fails++;
  if (holds.pinchSec != null && Number.isFinite(holds.pinchSec) && (holds.pinchSec as number) < p.pinchSec) fails++;
  if (holds.crushSec != null && Number.isFinite(holds.crushSec) && (holds.crushSec as number) < p.crushSec) fails++;
  return Math.min(3, fails);
}

export function loadSMGripProfile(): SMGripProfile | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SM_GRIP_PROFILE_KEY) : null;
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.supportSec !== 'number') return null;
    return obj as SMGripProfile;
  } catch {
    return null;
  }
}

export function saveSMGripProfile(p: SMGripProfile): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SM_GRIP_PROFILE_KEY, JSON.stringify(p));
  } catch { /* noop */ }
}
