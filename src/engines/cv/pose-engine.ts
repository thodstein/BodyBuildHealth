/**
 * pose-engine.ts — обёртка над MediaPipe Tasks Vision PoseLandmarker.
 *
 * Работает в Telegram Mini App WebView (HTTPS). WASM грузится с CDN.
 * Фолбэк — мок, если WASM не загрузился (офлайн / CSP).
 */
import type { Lift } from '../lms/weakpoint-pl';

export interface PoseMetrics {
  elbowAvgDeg: number | null; // средний угол локтя (bench)
  gripRatio: number | null;   // отношение хвата к ширине плеч
  barVelocity: number | null; // м/с оценка по запястьям
  bridge: boolean | null;
}

let landmarkerPromise: Promise<any> | null = null;

async function getLandmarker(): Promise<any | null> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    try {
      const vision: any = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const lm = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return lm;
    } catch (e) {
      console.warn('[pose-engine] wasm load failed, fallback to mock', e);
      return null;
    }
  })();
  return landmarkerPromise;
}

function angle(a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return Math.round((Math.acos(cos) * 180 / Math.PI) * 10) / 10;
}
function dist(a: {x:number;y:number}, b: {x:number;y:number}): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** RGB → HSV (h 0-360, s 0-1, v 0-1). Быстро для детекта тёмных блинов. */
function rgbToHsv(r: number, g: number, b: number): { h:number; s:number; v:number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

/**
 * Уточнённая Y грифа по тёмной горизонтали между запястьями (блины).
 * Сканит полосу ±10px вокруг avgWristY на ширине между wrists, ищет
 * самый тёмный ряд (V минимален, S низкая — чёрные блины или тень штанги).
 * Возвращает null если не нашлось — фолбэк на avgWristY.
 */
function refinedBarY(imageData: ImageData, lWr: {x:number;y:number}, rWr: {x:number;y:number}, w: number, h: number): number | null {
  const avgY = (lWr.y + rWr.y) / 2;
  const ax = Math.round(Math.min(lWr.x, rWr.x) * w);
  const bx = Math.round(Math.max(lWr.x, rWr.x) * w);
  const y0 = Math.max(2, Math.round(avgY * h) - 10);
  const y1 = Math.min(h-3, Math.round(avgY * h) + 10);
  if (bx - ax < 12) return null;
  let bestY = -1, bestScore = Infinity;
  for (let y = y0; y <= y1; y++) {
    let sumV = 0, cnt = 0;
    for (let x = ax + 4; x < bx - 4; x += 2) {
      const idx = (y * w + x) * 4;
      const { s, v } = rgbToHsv(imageData.data[idx], imageData.data[idx+1], imageData.data[idx+2]);
      // тёмный металл/тень: V 0.05-0.45, S <0.5 — самый тёмный
      if (v > 0.04 && v < 0.55) { sumV += v + s*0.5; cnt++; }
    }
    if (cnt < 3) continue;
    const avgV = sumV / cnt;
    if (avgV < bestScore) { bestScore = avgV; bestY = y; }
  }
  if (bestY < 0 || bestScore > 0.55) return null;
  return bestY / h;
}

/**
 * Анализ видео-элемента: семплирует кадры (5 fps, до 40 кадров) и считает метрики.
 * Возвращает PoseMetrics или null если поза не найдена.
 */
export async function analyzeVideoElement(video: HTMLVideoElement, lift: Lift): Promise<PoseMetrics | null> {
  const lm = await getLandmarker();
  if (!lm) return null;
  const duration = video.duration;
  if (!duration || !isFinite(duration) || duration <= 0) return null;
  const sampleCount = Math.min(40, Math.max(8, Math.floor(duration * 5)));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const w = 320, h = 240;
  canvas.width = w; canvas.height = h;

  const elbowAngles: number[] = [];
  const gripRatios: number[] = [];
  const wristYs: number[] = [];
  let bridgeVotes = 0, bridgeTotal = 0;

  // Для скорости нужен timestamps
  const timestamps: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (duration * i) / sampleCount;
    try {
      video.currentTime = t;
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((res) => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); res(); };
        video.addEventListener('seeked', onSeek);
        setTimeout(res, 400);
      });
      ctx.drawImage(video, 0, 0, w, h);
      // PoseLandmarker ожидает ImageData или canvas
      const result = lm.detectForVideo(canvas, performance.now());
      const lmks = result?.landmarks?.[0];
      if (!lmks || lmks.length < 33) continue;
      // индексы MediaPipe Pose: 11/12 плечи, 13/14 локти, 15/16 запястья, 23/24 таз, 27/28 колени
      const lSh = lmks[11], rSh = lmks[12], lEl = lmks[13], rEl = lmks[14], lWr = lmks[15], rWr = lmks[16];
      const lHip = lmks[23], rHip = lmks[24];
      if (!lSh || !rSh || !lEl || !rEl || !lWr || !rWr) continue;
      // видимость >0.3
      const vis = (p: any) => (p.visibility ?? 1) > 0.3;
      if (![lSh,rSh,lEl,rEl,lWr,rWr].every(vis)) continue;
      const leftAng = angle(lSh, lEl, lWr);
      const rightAng = angle(rSh, rEl, rWr);
      const avg = (leftAng + rightAng)/2;
      if (avg > 10 && avg < 180) elbowAngles.push(avg);
      const shoulderWidth = dist(lSh, rSh);
      const gripWidth = dist(lWr, rWr);
      if (shoulderWidth > 0.01) gripRatios.push(gripWidth / shoulderWidth);
      // bar — уточняем по тёмной полосе блинов (HSV), фолбэк на запястья
      const rawY = (lWr.y + rWr.y) / 2;
      let barY: number = rawY;
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const refined = refinedBarY(img, lWr, rWr, w, h);
        if (refined != null && Math.abs(refined - rawY) < 0.08) {
          // бленд 70% блины /30% запястья — устойчивее чем чистые запястья
          barY = refined * 0.7 + rawY * 0.3;
        }
      } catch { /* ignore — оставляем rawY */ }
      wristYs.push(barY);
      timestamps.push(t);
      if (lHip && rHip) {
        // мост: таз выше плеч? y меньше = выше
        const shoulderY = (lSh.y + rSh.y)/2;
        const hipY = (lHip.y + rHip.y)/2;
        bridgeTotal++;
        if (hipY < shoulderY + 0.05) bridgeVotes++;
      }
    } catch {
      continue;
    }
  }
  if (elbowAngles.length < 3) return null;
  const elbowAvgDeg = Math.round(elbowAngles.reduce((a,b)=>a+b,0)/elbowAngles.length);
  const gripRatio = gripRatios.length ? Math.round((gripRatios.reduce((a,b)=>a+b,0)/gripRatios.length)*100)/100 : null;
  let barVelocity: number | null = null;
  if (wristYs.length >= 4) {
    // оценка скорости: max delta Y / delta t (нормализованные координаты → м/с грубая)
    let maxV = 0;
    for (let i=1;i<wristYs.length;i++){
      const dy = Math.abs(wristYs[i]-wristYs[i-1]);
      const dt = (timestamps[i]-timestamps[i-1]) || 0.2;
      const v = dy / dt; // 0..1 per sec
      if (v > maxV) maxV = v;
    }
    // перевести в м/с условно: 1.0 == ~1.2 м/с (калибровка для 640px)
    barVelocity = Math.round(maxV * 1.2 * 100)/100;
    if (barVelocity < 0.1) barVelocity = null;
  }
  const bridge = bridgeTotal>0 ? (bridgeVotes/bridgeTotal > 0.6) : null;

  // фильтр по лифту: для приседа локти не важны
  if (lift === 'squat' || lift === 'deadlift' || lift === 'sumo') {
    return { elbowAvgDeg: null, gripRatio: null, barVelocity, bridge };
  }
  return { elbowAvgDeg, gripRatio, barVelocity, bridge };
}

export function interpretMetrics(m: PoseMetrics | null, lift: Lift): { label:string; suggestion:string } | null {
  if (!m) return null;
  if (lift === 'bench') {
    if (m.elbowAvgDeg != null) {
      if (m.elbowAvgDeg < 40) return { label: `Локти ${m.elbowAvgDeg}° — tucked`, suggestion: 'Умеренно разведите до 45-60° (balance) — предплечья вертикальны.' };
      if (m.elbowAvgDeg > 65) return { label: `Локти ${m.elbowAvgDeg}° — flared`, suggestion: 'Прижмите к 45-60° — бережёт плечо, включает трицепс.' };
    }
    if (m.gripRatio != null) {
      if (m.gripRatio < 1.3) return { label: `Хват ${m.gripRatio}× — узкий`, suggestion: 'Для груди — шире к 1.4-1.5× (до 81см).' };
      if (m.gripRatio > 1.7) return { label: `Хват ${m.gripRatio}× — широкий`, suggestion: 'Для трицепса/плеча — уже к 1.3-1.4×.' };
    }
  }
  return null;
}

// ── Воркер-обёртка: не морозит UI в Telegram WebView ──

function canUseWorker(): boolean {
  try { return typeof Worker !== 'undefined'; } catch { return false; }
}

/**
 * Тот же анализ, но через WebWorker (не блокирует главный поток).
 * Фолбэк на analyzeVideoElement если воркер недоступен / упал.
 */
export async function analyzeVideoWithWorker(video: HTMLVideoElement, lift: Lift, onProgress?: (p:number)=>void): Promise<PoseMetrics | null> {
  if (!canUseWorker()) return analyzeVideoElement(video, lift);
  let worker: Worker | null = null;
  try {
    // Vite worker import
    worker = new Worker(new URL('./pose-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return analyzeVideoElement(video, lift);
  }
  const duration = video.duration;
  if (!duration || !isFinite(duration) || duration <= 0) { worker.terminate(); return null; }

  const sampleCount = Math.min(40, Math.max(8, Math.floor(duration * 5)));
  const w = 320, h = 240;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) { worker.terminate(); return analyzeVideoElement(video, lift); }
  canvas.width = w; canvas.height = h;

  const frames: { imageData: ImageData; ts: number }[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (duration * i) / sampleCount;
    try {
      video.currentTime = t;
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((res) => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); res(); };
        video.addEventListener('seeked', onSeek);
        setTimeout(res, 350);
      });
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      frames.push({ imageData, ts: t });
      onProgress?.(Math.round((i / sampleCount) * 40));
    } catch { continue; }
  }

  // init worker
  const ready = await new Promise<boolean>((res) => {
    const to = setTimeout(()=>res(false), 4000);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ready') { clearTimeout(to); worker!.removeEventListener('message', onMsg); res(true); }
      if (e.data?.type === 'error') { clearTimeout(to); worker!.removeEventListener('message', onMsg); res(false); }
    };
    worker!.addEventListener('message', onMsg);
    worker!.postMessage({ type:'init' });
  });
  if (!ready) { worker.terminate(); return analyzeVideoElement(video, lift); }

  const elbowAngles: number[] = [];
  const gripRatios: number[] = [];
  const wristYs: number[] = [];
  const timestamps: number[] = [];
  let bridgeVotes = 0, bridgeTotal = 0;

  for (let idx=0; idx<frames.length; idx++) {
    const { imageData, ts } = frames[idx];
    // eslint-disable-next-line no-await-in-loop
    const lmks: any = await new Promise((res)=>{
      const id = idx;
      const handler = (e: MessageEvent)=>{
        if (e.data?.type==='result' && e.data.id===id){
          worker!.removeEventListener('message', handler);
          res(e.data.landmarks);
        }
      };
      worker!.addEventListener('message', handler);
      worker!.postMessage({ type:'detect', id, imageData, timestamp: performance.now() });
      setTimeout(()=>{ worker!.removeEventListener('message', handler); res(null); }, 1200);
    });
    onProgress?.(40 + Math.round((idx / frames.length) * 60));
    if (!lmks || lmks.length < 33) continue;
    const lSh = lmks[11], rSh = lmks[12], lEl = lmks[13], rEl = lmks[14], lWr = lmks[15], rWr = lmks[16];
    const lHip = lmks[23], rHip = lmks[24];
    if (!lSh || !rSh || !lEl || !rEl || !lWr || !rWr) continue;
    const vis = (p: any) => (p.visibility ?? 1) > 0.3;
    if (![lSh,rSh,lEl,rEl,lWr,rWr].every(vis)) continue;
    const leftAng = angle(lSh, lEl, lWr);
    const rightAng = angle(rSh, rEl, rWr);
    const avg = (leftAng + rightAng)/2;
    if (avg > 10 && avg < 180) elbowAngles.push(avg);
    const shoulderWidth = dist(lSh, rSh);
    const gripWidth = dist(lWr, rWr);
    if (shoulderWidth > 0.01) gripRatios.push(gripWidth / shoulderWidth);
    const rawY = (lWr.y + rWr.y) / 2;
    let barY: number = rawY;
    const refined = refinedBarY(imageData, lWr, rWr, w, h);
    if (refined != null && Math.abs(refined - rawY) < 0.08) barY = refined * 0.7 + rawY * 0.3;
    wristYs.push(barY);
    timestamps.push(ts);
    if (lHip && rHip) {
      bridgeTotal++;
      if ((lHip.y + rHip.y)/2 < (lSh.y + rSh.y)/2 + 0.05) bridgeVotes++;
    }
  }
  worker.terminate();
  if (elbowAngles.length < 3) return null;
  const elbowAvgDeg = Math.round(elbowAngles.reduce((a,b)=>a+b,0)/elbowAngles.length);
  const gripRatio = gripRatios.length ? Math.round((gripRatios.reduce((a,b)=>a+b,0)/gripRatios.length)*100)/100 : null;
  let barVelocity: number | null = null;
  if (wristYs.length >= 4) {
    let maxV = 0;
    for (let i=1;i<wristYs.length;i++){
      const dy = Math.abs(wristYs[i]-wristYs[i-1]);
      const dt = (timestamps[i]-timestamps[i-1]) || 0.2;
      const v = dy / dt;
      if (v > maxV) maxV = v;
    }
    barVelocity = Math.round(maxV * 1.2 * 100)/100;
    if (barVelocity < 0.1) barVelocity = null;
  }
  const bridge = bridgeTotal>0 ? (bridgeVotes/bridgeTotal > 0.6) : null;
  if (lift === 'squat' || lift === 'deadlift' || lift === 'sumo') return { elbowAvgDeg: null, gripRatio: null, barVelocity, bridge };
  return { elbowAvgDeg, gripRatio, barVelocity, bridge };
}
