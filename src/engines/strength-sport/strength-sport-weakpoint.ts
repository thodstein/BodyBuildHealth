/**
 * strength-sport-weakpoint.ts — диагностика слабых фаз для ТА/стронга (порт lms/weakpoint-pl).
 * 7 фаз рывка, 5 фаз толчка, 3 фазы тяги/стронга. Изолировано.
 * Используется для специализации и коррекции объёма.
 */

export type WLWeakPoint =
  | 'snatch_off_floor' | 'snatch_mid' | 'snatch_pull_under' | 'snatch_catch' | 'snatch_overhead'
  | 'clean_off_floor' | 'clean_mid' | 'clean_catch'
  | 'jerk_dip' | 'jerk_drive' | 'jerk_lockout'
  | 'squat_bottom' | 'squat_mid' | 'pull_start' | 'pull_lockout' | 'press_start';

export const WL_WEAKPOINT_LABELS: Record<WLWeakPoint, string> = {
  snatch_off_floor: 'Рывок: отрыв (0-20°)',
  snatch_mid: 'Рывок: середина тяги (колено)',
  snatch_pull_under: 'Рывок: уход под штангу',
  snatch_catch: 'Рывок: фиксация в седе',
  snatch_overhead: 'Рывок: оверхед стабильность',
  clean_off_floor: 'Взятие: отрыв',
  clean_mid: 'Взятие: середина',
  clean_catch: 'Взятие: уход в сед',
  jerk_dip: 'Толчок: подсед',
  jerk_drive: 'Толчок: выталкивание',
  jerk_lockout: 'Толчок: фиксация',
  squat_bottom: 'Присед: внизу (глубина)',
  squat_mid: 'Присед: середина',
  pull_start: 'Тяга: старт',
  pull_lockout: 'Тяга: замок',
  press_start: 'Жим/лог: старт',
};

export const WL_WEAKPOINT_ANGLE: Record<WLWeakPoint, { joint: string; angle: string; muscles: string[] }> = {
  snatch_off_floor: { joint: 'таз', angle: '0-20°', muscles: ['quads', 'glutes'] },
  snatch_mid: { joint: 'колено', angle: '60-90°', muscles: ['hamstrings', 'back'] },
  snatch_pull_under: { joint: 'плечо', angle: 'взрыв', muscles: ['traps', 'shoulders'] },
  snatch_catch: { joint: 'колено', angle: 'сед', muscles: ['quads', 'core'] },
  snatch_overhead: { joint: 'плечо', angle: 'оверхед', muscles: ['shoulders', 'core'] },
  clean_off_floor: { joint: 'таз', angle: '0-20°', muscles: ['quads', 'glutes'] },
  clean_mid: { joint: 'колено', angle: '60-90°', muscles: ['back', 'hamstrings'] },
  clean_catch: { joint: 'колено', angle: 'фронт-сед', muscles: ['quads', 'core'] },
  jerk_dip: { joint: 'колено', angle: '8-12см', muscles: ['quads'] },
  jerk_drive: { joint: 'плечо', angle: 'взрыв', muscles: ['shoulders', 'triceps'] },
  jerk_lockout: { joint: 'локоть', angle: 'фиксация', muscles: ['triceps', 'shoulders'] },
  squat_bottom: { joint: 'колено', angle: 'низ', muscles: ['quads', 'glutes'] },
  squat_mid: { joint: 'бедро', angle: 'середина', muscles: ['glutes', 'adductors'] },
  pull_start: { joint: 'таз', angle: 'старт', muscles: ['quads', 'back'] },
  pull_lockout: { joint: 'таз', angle: 'замок', muscles: ['glutes', 'back'] },
  press_start: { joint: 'плечо', angle: 'старт', muscles: ['shoulders', 'triceps'] },
};

export const WL_WEAKPOINT_CORRECTION: Record<WLWeakPoint, string[]> = {
  snatch_off_floor: ['deficit_snatch', 'pause_snatch', 'snatch_pull'],
  snatch_mid: ['pause_snatch', 'snatch_pull', 'rdl'],
  snatch_pull_under: ['high_hang_snatch', 'muscle_snatch', 'snatch_balance'],
  snatch_catch: ['overhead_squat_v2', 'snatch_balance', 'pause_squat'],
  snatch_overhead: ['overhead_squat_v2', 'snatch_balance', 'jerk_recovery'],
  clean_off_floor: ['deficit_clean', 'pause_clean', 'clean_pull'],
  clean_mid: ['pause_clean', 'clean_pull', 'rdl'],
  clean_catch: ['front_squat', 'front_squat_clean_grip', 'pause_squat'],
  jerk_dip: ['jerk_dip', 'pause_jerk', 'front_squat'],
  jerk_drive: ['push_press', 'push_jerk', 'behind_neck_jerk'],
  jerk_lockout: ['split_jerk', 'jerk_recovery', 'pin_press'],
  squat_bottom: ['pause_squat', 'tempo_squat', 'front_squat'],
  squat_mid: ['pause_squat', 'back_squat', 'hack_squat'],
  pull_start: ['deficit_pull', 'pause_pull', 'deadlift'],
  pull_lockout: ['clean_pull', 'snatch_pull', 'rdl'],
  press_start: ['pin_press', 'push_press', 'ohp'],
};

export const WL_WEAKPOINT_BY_LIFT: Record<string, WLWeakPoint[]> = {
  snatch: ['snatch_off_floor', 'snatch_mid', 'snatch_pull_under', 'snatch_catch', 'snatch_overhead'],
  clean: ['clean_off_floor', 'clean_mid', 'clean_catch'],
  jerk: ['jerk_dip', 'jerk_drive', 'jerk_lockout'],
  squat: ['squat_bottom', 'squat_mid'],
  deadlift: ['pull_start', 'pull_lockout'],
  press: ['press_start', 'jerk_drive'],
  carry: ['pull_start', 'squat_bottom'],
  stone: ['pull_start', 'squat_bottom'],
};

export function getWeakPointsForLift(lift: string): WLWeakPoint[] {
  return WL_WEAKPOINT_BY_LIFT[lift] || [];
}

export function getCorrectionForWeakPoint(wp: WLWeakPoint): string[] {
  return WL_WEAKPOINT_CORRECTION[wp] || [];
}

export function allWLWeakPoints(): WLWeakPoint[] {
  return Object.keys(WL_WEAKPOINT_LABELS) as WLWeakPoint[];
}

// Branded validation — stringly-typed защита от опечаток (isValidWLWeakPoint)
export type Brand<K, T> = K & { __brand: T };
export type WLWeakPointBrand = Brand<string, 'WLWeakPoint'>;
export function isValidWLWeakPoint(v: string): v is WLWeakPoint {
  return (Object.keys(WL_WEAKPOINT_LABELS) as string[]).includes(v);
}
export function assertWLWeakPoint(v: string): WLWeakPoint {
  if (!isValidWLWeakPoint(v)) throw new Error(`Invalid WLWeakPoint: ${v}`);
  return v;
}
export function normalizeWLWeakPoints(input: string[]): WLWeakPoint[] {
  return input.map(s=> String(s).trim()).filter(isValidWLWeakPoint).slice(0,4) as WLWeakPoint[];
}

// I18n EN → RU маппинг для API/экспорта (EN id ↔ RU label)
export const WL_WEAKPOINT_I18N: Record<WLWeakPoint, { en: string; ru: string }> = Object.fromEntries(
  Object.entries(WL_WEAKPOINT_LABELS).map(([k, ru])=> [k, { en: k, ru }])
) as any;
