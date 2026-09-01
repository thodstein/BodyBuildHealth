/**
 * arm-motion-capture.engine.ts — оценка углов РУ/РА/РН (как DiagnosticsHub → LiftMasterCard).
 * Без видео — фолбэк на ручной ввод. С видео — заглушка под BlazePose (как в DiagnosticsHub).
 * PRO: углы elbow 90/110/120, forearm pron/sup, wrist flex,方向 to_little/middle/thumb.
 */
export type ArmWorkingDirection = 'to_little' | 'to_middle' | 'to_thumb';

export interface ArmAngles {
  elbowDeg: 90 | 110 | 120;
  forearmDeg: number; // pron 0..180 (0=supinated, 90=neutral, 180=pronated)
  wristDeg: number; // flex -30..+60
  direction: ArmWorkingDirection;
  pronDeg: number; // 0..90
  supDeg: number; // 0..90
}

export interface ArmMotionFrame {
  elbowDeg?: number;
  forearmDeg?: number;
  wristDeg?: number;
  direction?: ArmWorkingDirection;
}

/** Ручная оценка РУ по трём ползункам (как в ArmDiagnosticsHub). */
export function estimateArmAngles(input: {
  elbowDeg: number;
  forearmDeg: number;
  wristDeg: number;
  direction: ArmWorkingDirection;
}): ArmAngles {
  const elbow = [90, 110, 120].reduce((a, b) => Math.abs(b - input.elbowDeg) < Math.abs(a - input.elbowDeg) ? b : a, 90) as ArmAngles['elbowDeg'];
  const forearm = Math.max(0, Math.min(180, Math.round(input.forearmDeg)));
  const wrist = Math.max(-30, Math.min(60, Math.round(input.wristDeg)));
  const pronDeg = forearm > 90 ? Math.min(90, forearm - 90) : 0;
  const supDeg = forearm < 90 ? Math.min(90, 90 - forearm) : 0;
  return { elbowDeg: elbow, forearmDeg: forearm, wristDeg: wrist, direction: input.direction, pronDeg, supDeg };
}

/** Заглушка для видео (BlazePose): в PRO — сюда придёт кадр, пока возвращает null (фолбэк). */
export function detectWristAngleFromVideo(_videoFrame: unknown): ArmMotionFrame | null {
  // PRO-TODO: интеграция BlazePose (как DiagnosticsHub → LiftMasterCard video)
  // Сейчас — null, UI покажет ручной ввод.
  return null;
}

/** Проверка РУ в рабочем диапазоне (90° ±10, wrist flex 0–30, pron 20–60 для toproll). */
export function validateArmAngles(a: ArmAngles): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (a.elbowDeg !== 90 && a.elbowDeg !== 110 && a.elbowDeg !== 120) warnings.push(`Угол локтя ${a.elbowDeg}° вне 90/110/120`);
  if (a.wristDeg < -10 || a.wristDeg > 40) warnings.push(`Wrist ${a.wristDeg}° вне -10…40`);
  if (a.direction === 'to_little' && a.pronDeg < 10) warnings.push('Для направления к мизинцу нужен pron ≥10°');
  return { valid: warnings.length === 0, warnings };
}

/** Рекомендация по РУ для техники. */
export function recommendAnglesForTechnique(technique: string): Partial<ArmAngles> {
  if (technique === 'hook') return { elbowDeg: 90, direction: 'to_middle', forearmDeg: 60 };
  if (technique === 'toproll') return { elbowDeg: 110, direction: 'to_little', forearmDeg: 140 };
  if (technique === 'press') return { elbowDeg: 120, direction: 'to_thumb', forearmDeg: 90 };
  return { elbowDeg: 110, direction: 'to_middle', forearmDeg: 90 };
}
