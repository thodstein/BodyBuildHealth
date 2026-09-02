/**
 * strength-sport-pose.engine.ts — Pose live stub (MediaPipe BlazePose parity)
 *
 * Вычисляет углы hip/knee/ankle/shoulder по 2D точкам (x,y) — без зависимости от ML.
 * Реальный драйвер MediaPipe может подменить estimateAnglesFromLandmarks.
 * Parity с PAAH 2024: нормализация по t-кадрам, Madgwick-подобная фильтрация не требуется для 2D.
 */

export interface Landmark { x: number; y: number; visibility?: number; }
export interface PoseFrame { landmarks: Record<string, Landmark>; t: number; }
export interface JointAnglesPose { hip: number; knee: number; ankle: number; shoulder: number; elbow: number; trunk: number; t: number; }

function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y) || 1;
  const magCB = Math.hypot(cb.x, cb.y) || 1;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

export function estimateAnglesFromLandmarks(frame: PoseFrame): JointAnglesPose {
  const lm = frame.landmarks;
  // Ожидаем ключи: hip, knee, ankle, shoulder, elbow, wrist, trunk
  // Fallback на 0 если нет точки
  const hipAngle = lm.hip && lm.knee && lm.shoulder ? angle(lm.shoulder, lm.hip, lm.knee) : 0;
  const kneeAngle = lm.hip && lm.knee && lm.ankle ? angle(lm.hip, lm.knee, lm.ankle) : 0;
  const ankleAngle = lm.knee && lm.ankle && lm['foot'] ? angle(lm.knee, lm.ankle, lm['foot']) : 0;
  const shoulderAngle = lm.elbow && lm.shoulder && lm.hip ? angle(lm.elbow, lm.shoulder, lm.hip) : 0;
  const elbowAngle = lm.shoulder && lm.elbow && lm['wrist'] ? angle(lm.shoulder, lm.elbow, lm['wrist']) : 0;
  const trunkAngle = hipAngle; // прокси
  return { hip: hipAngle, knee: kneeAngle, ankle: ankleAngle, shoulder: shoulderAngle, elbow: elbowAngle, trunk: trunkAngle, t: frame.t };
}

export function livePoseStatus(angles: JointAnglesPose): { ok: boolean; faults: string[] } {
  const faults: string[] = [];
  if (angles.knee > 0 && angles.knee < 70) faults.push('колено <70° — глубокий сед');
  if (angles.ankle > 0 && angles.ankle < 35) faults.push('голеностоп <35° — риск отрыва пяток');
  if (angles.shoulder > 0 && angles.shoulder < 150) faults.push('плечо <150° — оверхед нестабилен');
  return { ok: faults.length === 0, faults };
}

// Stub для MediaPipe — возвращает моки, чтобы UI не падал без модели
export function createMockPoseStream(): PoseFrame[] {
  return [
    { t: 0, landmarks: { hip: { x: 0, y: 0 }, knee: { x: 0, y: -1 }, ankle: { x: 0, y: -2 }, shoulder: { x: 0, y: 1 }, elbow: { x: 0.5, y: 1 }, foot: { x: 0, y: -2.2 }, wrist: { x: 0.5, y: 1.5 } } },
    { t: 0.1, landmarks: { hip: { x: 0, y: 0 }, knee: { x: 0.1, y: -0.9 }, ankle: { x: 0, y: -1.9 }, shoulder: { x: 0, y: 1 }, elbow: { x: 0.5, y: 1 }, foot: { x: 0, y: -2.2 }, wrist: { x: 0.5, y: 1.5 } } },
  ];
}
