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

// CDN MediaPipe — parity с arm-motion-capture ensureHandsModel
// Пытаемся загрузить Tasks Vision WASM (0.10+), fallback legacy pose@0.5
export function hasPoseSupport(): boolean {
  return typeof (globalThis as any).Pose !== 'undefined' || typeof (globalThis as any).BlazePose !== 'undefined' || typeof (globalThis as any).pose !== 'undefined' || typeof (globalThis as any).TasksVision !== 'undefined' || typeof (globalThis as any).vision !== 'undefined';
}
export function hasTasksVisionSupport(): boolean {
  return typeof (globalThis as any).TasksVision !== 'undefined' || typeof (globalThis as any).vision !== 'undefined' || typeof (globalThis as any).PoseLandmarker !== 'undefined';
}
export async function ensureTasksVision(): Promise<boolean> {
  if (hasTasksVisionSupport()) return true;
  if (typeof document === 'undefined') return false;
  try {
    const src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
    // пробуем dynamic import для mjs
    try {
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ src);
      if (mod) (globalThis as any).TasksVision = mod;
      return hasTasksVisionSupport();
    } catch {}
    // fallback script tag для wasm loader
    const wasmSrc = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js';
    if (!document.querySelector(`script[src="${wasmSrc}"]`)) {
      await new Promise<void>((resolve, reject)=> {
        const s=document.createElement('script'); s.src=wasmSrc; s.async=true; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('wasm load failed')); document.head.appendChild(s);
      });
    }
    return hasTasksVisionSupport();
  } catch { return false; }
}
export async function ensurePoseModel(): Promise<boolean> {
  if (hasPoseSupport()) return true;
  // пробуем Tasks Vision первым
  try { if (await ensureTasksVision()) return true; } catch {}
  try {
    const src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js';
    if (typeof document === 'undefined') return false;
    const existing = document.querySelector(`script[src="${src}"]`) as any;
    if (existing) return hasPoseSupport();
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('pose load failed'));
      document.head.appendChild(s);
    });
    await new Promise(r => setTimeout(r, 500));
    return hasPoseSupport();
  } catch { return false; }
}

// (V9: удалены мёртвые hasVideoSupport/detectPoseFromVideo/isPoseVerified —
// ни вызывающих, ни тестов; live-адаптер пишется заново вместе с видео-контуром.)

// Stub для MediaPipe — возвращает моки, чтобы UI не падал без модели
export function createMockPoseStream(): PoseFrame[] {
  return [
    { t: 0, landmarks: { hip: { x: 0, y: 0 }, knee: { x: 0, y: -1 }, ankle: { x: 0, y: -2 }, shoulder: { x: 0, y: 1 }, elbow: { x: 0.5, y: 1 }, foot: { x: 0, y: -2.2 }, wrist: { x: 0.5, y: 1.5 } } },
    { t: 0.1, landmarks: { hip: { x: 0, y: 0 }, knee: { x: 0.1, y: -0.9 }, ankle: { x: 0, y: -1.9 }, shoulder: { x: 0, y: 1 }, elbow: { x: 0.5, y: 1 }, foot: { x: 0, y: -2.2 }, wrist: { x: 0.5, y: 1.5 } } },
  ];
}

// (V9: isPoseVerified удалён вместе с группой выше.)

// E8: углы суставов из CSV (экспорт трекера поз / ручной замер по кадрам).
// Формат: t,hip,knee,ankle,shoulder[,elbow] (; или ,). Без заголовка — t,hip,knee,ankle,shoulder.
export interface PoseAnglesSample { t: number; hip?: number; knee?: number; ankle?: number; shoulder?: number; elbow?: number; }

export function parsePoseAnglesCsv(csv: string): PoseAnglesSample[] | null {
  if (!csv || typeof csv !== 'string') return null;
  const lines = csv.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const semi = (lines[0].match(/;/g) || []).length;
  const comm = (lines[0].match(/,/g) || []).length;
  const delim = semi > comm ? ';' : ',';
  const cols = lines[0].toLowerCase().split(delim).map(s => s.trim());
  const hasHeader = cols.some(c => ['t', 'time', 'frame', 'hip', 'knee', 'ankle', 'shoulder', 'elbow'].includes(c));
  const idx = (names: string[], fallback: number) => {
    if (!hasHeader) return fallback;
    const i = cols.findIndex(c => names.includes(c));
    return i >= 0 ? i : -1;
  };
  const iT = idx(['t', 'time', 'frame'], 0);
  const iHip = idx(['hip', 'таз'], 1);
  const iKnee = idx(['knee', 'колено'], 2);
  const iAnkle = idx(['ankle', 'голеностоп'], 3);
  const iSho = idx(['shoulder', 'плечо'], 4);
  const iElb = idx(['elbow', 'локоть'], 5);
  const num = (parts: string[], i: number): number | undefined => {
    if (i < 0 || i >= parts.length) return undefined;
    const v = parseFloat(parts[i]);
    return Number.isFinite(v) && v >= 0 && v <= 250 ? v : undefined;
  };
  const out: PoseAnglesSample[] = [];
  for (let li = hasHeader ? 1 : 0; li < lines.length; li++) {
    const parts = lines[li].split(delim).map(s => s.trim());
    if (parts.length < 4) continue;
    const tRaw = iT >= 0 && iT < parts.length ? parseFloat(parts[iT]) : li * 0.033;
    out.push({
      t: Number.isFinite(tRaw) ? tRaw : li * 0.033,
      hip: num(parts, iHip), knee: num(parts, iKnee), ankle: num(parts, iAnkle),
      shoulder: num(parts, iSho), elbow: num(parts, iElb),
    });
  }
  return out.length >= 2 ? out : null;
}

export interface PoseJointStat { min: number; max: number; avg: number; n: number; }
export interface PoseAnglesSummary {
  n: number;
  hip: PoseJointStat | null;
  knee: PoseJointStat | null;
  ankle: PoseJointStat | null;
  shoulder: PoseJointStat | null;
}

function stat(vals: Array<number | undefined>): PoseJointStat | null {
  const clean = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!clean.length) return null;
  const min = Math.min(...clean), max = Math.max(...clean);
  const avg = Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10;
  return { min, max, avg, n: clean.length };
}

export function summarizePoseAngles(samples: PoseAnglesSample[] | null | undefined): PoseAnglesSummary | null {
  if (!samples || samples.length < 2) return null;
  return {
    n: samples.length,
    hip: stat(samples.map(s => s.hip)),
    knee: stat(samples.map(s => s.knee)),
    ankle: stat(samples.map(s => s.ankle)),
    shoulder: stat(samples.map(s => s.shoulder)),
  };
}

/** Средние углы серии → вход autoValidateAnglesFromPose / autoOHSFromPose. */
export function avgAnglesOfSummary(sum: PoseAnglesSummary | null): { hip?: number; knee?: number; ankle?: number; shoulder?: number } {
  if (!sum) return {};
  const out: Record<string, number> = {};
  if (sum.hip) out.hip = sum.hip.avg;
  if (sum.knee) out.knee = sum.knee.avg;
  if (sum.ankle) out.ankle = sum.ankle.avg;
  if (sum.shoulder) out.shoulder = sum.shoulder.avg;
  return out;
}
