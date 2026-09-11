/**
 * strength-sport-pose-autotrack.engine.ts — АВТО-РАЗМЕТКА ПОЗ ПО ВИДЕО (SM PRO P9).
 *
 * MediaPipe PoseLandmarker (tasks-vision) грузится с CDN — в АПК интернет всегда
 * есть, поэтому сетевой путь основной; без сети вызывающий честно падает на ручные тапы.
 * Чистые функции маппинга 33 точек BlazePose → именованные точки гониометра
 * тестируются без модели; загрузка/детект — тонкая обёртка с кэшем и таймаутами.
 *
 * Индексы BlazePose: плечи 11/12, локти 13/14, таз 23/24, колени 25/26,
 * голеностоп 27/28, носок 31/32. Сторона — по лучшей видимости.
 */

import { estimateAnglesFromLandmarks, type Landmark } from './strength-sport-pose.engine';

export const POSE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
export const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface RawPoint { x: number; y: number; visibility?: number }
export type PoseSide = 'left' | 'right';

const SIDE_IDX: Record<PoseSide, { shoulder: number; elbow: number; hip: number; knee: number; ankle: number; foot: number }> = {
  left: { shoulder: 11, elbow: 13, hip: 23, knee: 25, ankle: 27, foot: 31 },
  right: { shoulder: 12, elbow: 14, hip: 24, knee: 26, ankle: 28, foot: 32 },
};

export interface MappedPose {
  side: PoseSide;
  meanVisibility: number;
  points: Record<'shoulder' | 'elbow' | 'hip' | 'knee' | 'ankle' | 'foot', Landmark>;
}

/** Чистый маппинг: массив из 33 точек → именованные точки лучшей стороны. */
export function mapBlazePoseToPoints(landmarks: Array<RawPoint | null | undefined> | null | undefined): MappedPose | null {
  if (!Array.isArray(landmarks) || landmarks.length < 33) return null;
  const vis = (i: number): number => {
    const p = landmarks[i];
    return p && Number.isFinite(p.visibility) ? (p.visibility as number) : p ? 1 : 0;
  };
  const mean = (side: PoseSide): number => {
    const s = SIDE_IDX[side];
    return (vis(s.shoulder) + vis(s.elbow) + vis(s.hip) + vis(s.knee) + vis(s.ankle) + vis(s.foot)) / 6;
  };
  const mL = mean('left');
  const mR = mean('right');
  const side: PoseSide = mR > mL ? 'right' : 'left';
  const s = SIDE_IDX[side];
  const get = (i: number): Landmark | null => {
    const p = landmarks[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: p.x, y: p.y, visibility: vis(i) };
  };
  const pts = {
    shoulder: get(s.shoulder), elbow: get(s.elbow), hip: get(s.hip),
    knee: get(s.knee), ankle: get(s.ankle), foot: get(s.foot),
  };
  if (!pts.shoulder || !pts.elbow || !pts.hip || !pts.knee || !pts.ankle || !pts.foot) return null;
  return { side, meanVisibility: Math.round(Math.max(mL, mR) * 100) / 100, points: pts as MappedPose['points'] };
}

/** Углы (таз/колено/голеностоп/плечо) из сырых 33 точек — для строк таблицы. */
export function anglesFromBlazePose(
  landmarks: Array<RawPoint | null | undefined> | null | undefined,
  t: number,
): { hip: number; knee: number; ankle: number; shoulder: number; side: PoseSide } | null {
  const mapped = mapBlazePoseToPoints(landmarks);
  if (!mapped) return null;
  try {
    const a = estimateAnglesFromLandmarks({ landmarks: mapped.points as unknown as Record<string, Landmark>, t });
    return { hip: a.hip, knee: a.knee, ankle: a.ankle, shoulder: a.shoulder, side: mapped.side };
  } catch {
    return null;
  }
}

// ── Загрузка модели (кэш, только браузер; в node/vitest — null) ──

type LandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Array<Array<RawPoint>> };
  close?: () => void;
};

let cachedLandmarker: LandmarkerLike | null = null;
let loadPromise: Promise<LandmarkerLike | null> | null = null;

export function resetPoseAutotrackCache(): void {
  cachedLandmarker = null;
  loadPromise = null;
}

async function importTasksVision(): Promise<any | null> {
  try {
    // @ts-ignore — CDN-модуль вне бандла (АПК всегда онлайн)
    const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    return mod ?? null;
  } catch {
    return null;
  }
}

/** Загрузить PoseLandmarker (lite) или null — вызывающий показывает ручной путь. */
export function loadPoseLandmarker(): Promise<LandmarkerLike | null> {
  if (cachedLandmarker) return Promise.resolve(cachedLandmarker);
  if (loadPromise) return loadPromise;
  loadPromise = (async (): Promise<LandmarkerLike | null> => {
    try {
      if (typeof document === 'undefined') return null;
      const vision = await importTasksVision();
      if (!vision?.FilesetResolver || !vision?.PoseLandmarker) return null;
      const fileset = await vision.FilesetResolver.forVisionTasks(POSE_WASM_URL);
      const lm = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      cachedLandmarker = lm as LandmarkerLike;
      return cachedLandmarker;
    } catch {
      return null;
    }
  })();
  return loadPromise;
}

export interface AutotrackFrame {
  t: number;
  hip: number;
  knee: number;
  ankle: number;
  shoulder: number;
  side: PoseSide;
}

export interface AutotrackResult {
  rows: AutotrackFrame[];
  sampled: number;
  failed: number;
  modelOk: boolean;
}

function seekVideo(video: HTMLVideoElement, t: number, timeoutMs = 4000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const timer = setTimeout(() => { try { video.removeEventListener('seeked', finish); } catch {} finish(); }, timeoutMs);
    const onSeeked = () => { clearTimeout(timer); finish(); };
    try {
      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = t;
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

/**
 * Прогнать видео покадрово: семплы равномерно по длительности (кап 12),
 * детект каждого кадра, углы — строками. Возвращает частичный результат честно.
 */
export async function autotrackVideo(
  video: HTMLVideoElement,
  opts?: { maxFrames?: number; onProgress?: (done: number, total: number) => void },
): Promise<AutotrackResult> {
  const empty: AutotrackResult = { rows: [], sampled: 0, failed: 0, modelOk: false };
  try {
    const lm = await loadPoseLandmarker();
    if (!lm) return empty;
    empty.modelOk = true;
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (dur <= 0) return empty;
    const maxFrames = Math.max(2, Math.min(12, opts?.maxFrames ?? 10));
    const times: number[] = [];
    for (let i = 0; i < maxFrames; i++) times.push(Math.round(((dur * (i + 0.5)) / maxFrames) * 100) / 100);
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      try {
        await seekVideo(video, Math.min(t, Math.max(0, dur - 0.05)));
        const res = lm.detectForVideo(video, Math.round(t * 1000));
        const raw = res?.landmarks?.[0];
        const a = anglesFromBlazePose(raw as Array<RawPoint>, t);
        if (a) empty.rows.push({ t, hip: a.hip, knee: a.knee, ankle: a.ankle, shoulder: a.shoulder, side: a.side });
        else empty.failed++;
      } catch {
        empty.failed++;
      }
      empty.sampled++;
      try { opts?.onProgress?.(empty.sampled, times.length); } catch {}
    }
    return empty;
  } catch {
    return empty;
  }
}
