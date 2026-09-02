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

export interface ArmLandmarks {
  shoulder: { x: number; y: number };
  elbow: { x: number; y: number };
  wrist: { x: number; y: number };
  hand?: { x: number; y: number };
  thumb?: { x: number; y: number };
  little?: { x: number; y: number };
}

/** Геометрия: угол между тремя точками A-B-C (B — вершина) в градусах 0..180 */
export function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.sqrt(abx * abx + aby * aby);
  const magCB = Math.sqrt(cbx * cbx + cby * cby);
  if (magAB === 0 || magCB === 0) return 90;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

export function estimateAnglesFromLandmarks(lm: ArmLandmarks): ArmMotionFrame {
  const elbowDeg = angleBetween(lm.shoulder, lm.elbow, lm.wrist);
  // forearmDeg — ориентация предплечья относительно горизонтали (0=sup, 90=neutral, 180=pron)
  let forearmDeg = 90;
  if (lm.hand && lm.elbow && lm.wrist) {
    const dx = lm.hand.x - lm.wrist.x;
    const dy = lm.hand.y - lm.wrist.y;
    // грубая оценка pron через вектор кисти: dx>0 при pron
    forearmDeg = 90 + Math.round(dx * 180);
    forearmDeg = Math.max(0, Math.min(180, forearmDeg));
  }
  // wristDeg — угол кисти (отклонение от прямой линии elbow-wrist-hand)
  let wristDeg = 10;
  if (lm.hand) {
    const w = angleBetween(lm.elbow, lm.wrist, lm.hand);
    wristDeg = Math.round(180 - w); // флекс положительный
    wristDeg = Math.max(-30, Math.min(60, wristDeg));
  }
  // direction по thumb/little
  let direction: ArmWorkingDirection = 'to_middle';
  if (lm.thumb && lm.little) {
    const tx = lm.thumb.x - lm.wrist.x;
    const lx = lm.little.x - lm.wrist.x;
    if (tx > lx + 0.02) direction = 'to_thumb';
    else if (lx > tx + 0.02) direction = 'to_little';
  }
  return { elbowDeg, forearmDeg, wristDeg, direction };
}

/** PRO: попытка детекции через MediaPipe Hands/BlazePose — если загружен, возвращает угол, иначе null фолбэк. */
export function detectWristAngleFromVideo(videoFrame: unknown): ArmMotionFrame | null {
  try {
    // Если в глобальном есть MediaPipe (подключён как в DiagnosticsHub), пробуем
    const mp = (globalThis as any).MediaPipeHands || (globalThis as any).BlazePose || (globalThis as any).Hands;
    // Если videoFrame — landmarks объект — считаем геометрию
    if (typeof videoFrame === 'object' && videoFrame !== null) {
      const f = videoFrame as any;
      if ('shoulder' in f && 'elbow' in f && 'wrist' in f) {
        return estimateAnglesFromLandmarks(f as ArmLandmarks);
      }
      if ('elbowDeg' in f) {
        return { elbowDeg: Number(f.elbowDeg), forearmDeg: Number(f.forearmDeg), wristDeg: Number(f.wristDeg), direction: f.direction };
      }
      // MediaPipe result format: { landmarks: [...] } — пробуем первый
      if (Array.isArray(f.landmarks) && f.landmarks.length >= 3) {
        // ожидаем [shoulder, elbow, wrist, hand]
        const [s, e, w, h] = f.landmarks;
        if (s && e && w) return estimateAnglesFromLandmarks({ shoulder: s, elbow: e, wrist: w, hand: h });
      }
    }
    if (!mp || !videoFrame) return null;
    return null;
  } catch { return null; }
}

export function hasVideoSupport(): boolean {
  return typeof (globalThis as any).MediaPipeHands !== 'undefined' || typeof (globalThis as any).BlazePose !== 'undefined' || typeof (globalThis as any).Hands !== 'undefined';
}
export async function ensureHandsModel(): Promise<boolean> {
  if (hasVideoSupport()) return true;
  try {
    const src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js';
    if (typeof document === 'undefined') return false;
    const existing = document.querySelector(`script[src="${src}"]`) as any;
    if (existing) return hasVideoSupport();
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('hands load failed'));
      document.head.appendChild(s);
    });
    // дать время инициализации
    await new Promise(r => setTimeout(r, 500));
    return hasVideoSupport();
  } catch { return false; }
}
export function isAnglesVerified(angles: ArmAngles | null): boolean {
  if (!angles) return false;
  const v = validateArmAngles(angles);
  return v.valid;
}

/** Проверка РУ в рабочем диапазоне (90° ±10, wrist flex 0–30, pron 20–60 для toproll). */
export function validateArmAngles(a: ArmAngles): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (a.elbowDeg !== 90 && a.elbowDeg !== 110 && a.elbowDeg !== 120) warnings.push(`Угол локтя ${a.elbowDeg}° вне 90/110/120`);
  if (a.wristDeg < -10 || a.wristDeg > 40) warnings.push(`Wrist ${a.wristDeg}° вне -10…40`);
  if (a.forearmDeg < 0 || a.forearmDeg > 180) warnings.push(`Предплечье ${a.forearmDeg}° вне 0..180`);
  if (a.pronDeg < 0 || a.pronDeg > 90 || a.supDeg < 0 || a.supDeg > 90) warnings.push(`Pron/Sup вне 0..90`);
  if (a.direction === 'to_little' && a.pronDeg < 10) warnings.push('Для направления к мизинцу нужен pron ≥10°');
  if (a.direction === 'to_thumb' && a.supDeg > 30) warnings.push('To_thumb с sup >30° — риск (press: neutral предпочтительно)');
  if (a.elbowDeg === 120 && a.wristDeg > 20) warnings.push('120° + wrist >20° — перерастяжение, ограничить РА (Kuznetsov IV)');
  if (a.elbowDeg === 90 && a.forearmDeg > 160) warnings.push('90° + pron 70° — перегруз UCL, снизить pron');
  return { valid: warnings.length === 0, warnings };
}

/** Рекомендация по РУ для техники. */
export function recommendAnglesForTechnique(technique: string): Partial<ArmAngles> {
  if (technique === 'hook') return { elbowDeg: 90, direction: 'to_middle', forearmDeg: 60 };
  if (technique === 'toproll') return { elbowDeg: 110, direction: 'to_little', forearmDeg: 140 };
  if (technique === 'press') return { elbowDeg: 120, direction: 'to_thumb', forearmDeg: 90 };
  return { elbowDeg: 110, direction: 'to_middle', forearmDeg: 90 };
}
