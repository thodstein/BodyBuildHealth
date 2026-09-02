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

/** PRO: попытка детекции через MediaPipe Hands/BlazePose — если загружен, возвращает угол, иначе null фолбэк. */
export function detectWristAngleFromVideo(videoFrame: unknown): ArmMotionFrame | null {
  try {
    // Если в глобальном есть MediaPipe (подключён как в DiagnosticsHub), пробуем
    const mp = (globalThis as any).MediaPipeHands || (globalThis as any).BlazePose;
    if (!mp || !videoFrame) return null;
    // Заглушка: реальная интеграция требует canvas+model, оставляем фолбэк с попыткой парса
    // Если videoFrame — уже распарсенный объект с elbowDeg/wristDeg — вернём его
    if (typeof videoFrame === 'object' && videoFrame !== null && 'elbowDeg' in (videoFrame as any)) {
      const f = videoFrame as any;
      return { elbowDeg: Number(f.elbowDeg), forearmDeg: Number(f.forearmDeg), wristDeg: Number(f.wristDeg), direction: f.direction };
    }
    return null;
  } catch { return null; }
}

export function hasVideoSupport(): boolean {
  return typeof (globalThis as any).MediaPipeHands !== 'undefined' || typeof (globalThis as any).BlazePose !== 'undefined';
}

/** Проверка РУ в рабочем диапазоне (90° ±10, wrist flex 0–30, pron 20–60 для toproll). */
export function validateArmAngles(a: ArmAngles): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (a.elbowDeg !== 90 && a.elbowDeg !== 110 && a.elbowDeg !== 120) warnings.push(`Угол локтя ${a.elbowDeg}° вне 90/110/120`);
  if (a.wristDeg < -10 || a.wristDeg > 40) warnings.push(`Wrist ${a.wristDeg}° вне -10…40`);
  if (a.direction === 'to_little' && a.pronDeg < 10) warnings.push('Для направления к мизинцу нужен pron ≥10°');
  if (a.direction === 'to_thumb' && a.supDeg > 30) warnings.push('To_thumb с sup >30° — риск (press: neutral предпочтительно)');
  if (a.elbowDeg === 120 && a.wristDeg > 20) warnings.push('120° + wrist >20° — перерастяжение, ограничить РА (Kuznetsov IV)');
  return { valid: warnings.length === 0, warnings };
}

/** Рекомендация по РУ для техники. */
export function recommendAnglesForTechnique(technique: string): Partial<ArmAngles> {
  if (technique === 'hook') return { elbowDeg: 90, direction: 'to_middle', forearmDeg: 60 };
  if (technique === 'toproll') return { elbowDeg: 110, direction: 'to_little', forearmDeg: 140 };
  if (technique === 'press') return { elbowDeg: 120, direction: 'to_thumb', forearmDeg: 90 };
  return { elbowDeg: 110, direction: 'to_middle', forearmDeg: 90 };
}
