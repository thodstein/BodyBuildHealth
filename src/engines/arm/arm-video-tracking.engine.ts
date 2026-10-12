/**
 * arm-video-tracking.engine.ts — живое видео → трек кисти (offline, без CDN/поз-моделей).
 *
 * Контур: UI снимает кадры с `<video>` в маленький canvas и считает centroid движения
 * (frame-diff) → `FrameObservation[]` → этот движок строит трек в САНТИМЕТРАХ
 * (через калибровку «известная ширина») и сегментирует на циклы тяги.
 * Метрики cycles совпадают по формуле с `armPathMetrics` (единый канон SRD),
 * поэтому ведутся те же пороги реального изменения.
 *
 * Почему без MediaPipe: CDN-модель не грузится в офлайн-АПК (прецедент 2026-09-27 —
 * hands/BlazePose удалены как заглушки). Frame-diff на статичной камере у стола
 * рабочий и честный: кисть — самый быстрый объект в кадре.
 *
 * Чистый модуль: без UI/canvas/network.
 */
import type { TrackPoint } from './arm-video-analysis.engine';
import { armPathMetrics, type BarPathMetrics } from './arm-video-analysis.engine';

/** Наблюдение одного кадра: момент + centroid движения (px) + площадь движения (px²). */
export interface FrameObservation {
  tMs: number;
  cx: number;
  cy: number;
  area: number;
}

export interface TrackCalibration {
  /** Пикселей на сантиметр. 0/отрицательное = нет калибровки → честный отказ. */
  pixelsPerCm: number;
  /** Начало отсчёта (px). По умолчанию — centroid первого кадра. */
  originXpx?: number;
  originYpx?: number;
  /** Image-Y растёт вниз: -1 переворачивает ось (верх = +). */
  flipY?: boolean;
}

export interface VideoTrackQuality {
  ok: boolean;
  /** Причина отказа (честное «нет данных» вместо молчаливого мусора). */
  reason: string | null;
}

export interface VideoTrackCycle {
  index: number;
  startT: number;
  endT: number;
  xLoop: number;
  yMax: number;
  vMax: number;
}

export interface VideoTrackResult {
  points: TrackPoint[];
  cycles: VideoTrackCycle[];
  quality: VideoTrackQuality;
  notes: string[];
}

const MIN_FRAMES = 8;
const MAX_CYCLES = 20;

/** Калибровка: известный размер в кадре (см) → px/см. */
export function calibratePixelsPerCm(knownCm: number, pixelSpan: number): number {
  const cm = Number(knownCm);
  const px = Number(pixelSpan);
  if (!Number.isFinite(cm) || !Number.isFinite(px) || cm <= 0 || px <= 0) return 0;
  return Math.round((px / cm) * 1000) / 1000;
}

function smooth(values: TrackPoint[]): TrackPoint[] {
  if (values.length < 3) return values;
  const out: TrackPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    const a = values[Math.max(0, i - 1)];
    const b = values[i];
    const c = values[Math.min(values.length - 1, i + 1)];
    out.push({ t: b.t, x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 });
  }
  return out;
}

/**
 * Строит трек в см из наблюдений кадров. Всегда возвращает `quality` с причиной,
 * если данных недостаточно — точки могут быть частичными, но `ok=false`.
 */
export function buildTrackFromFrames(
  frames: readonly FrameObservation[] | null | undefined,
  cal: TrackCalibration | null | undefined,
): VideoTrackResult {
  const notes: string[] = [];
  const fail = (reason: string): VideoTrackResult => ({ points: [], cycles: [], quality: { ok: false, reason }, notes });
  if (!Array.isArray(frames) || frames.length < MIN_FRAMES) {
    return fail(`мало кадров (${Array.isArray(frames) ? frames.length : 0} < ${MIN_FRAMES}) — нужно видео длиной ≥1с и статичной камерой`);
  }
  const pxPerCm = Number(cal?.pixelsPerCm);
  if (!Number.isFinite(pxPerCm) || pxPerCm <= 0) {
    return fail('нет калибровки — отметьте в кадре известный размер (например ширину кисти ~9см)');
  }
  const valid = frames
    .filter((f) => f && Number.isFinite(f.tMs) && Number.isFinite(f.cx) && Number.isFinite(f.cy))
    .slice()
    .sort((a, b) => a.tMs - b.tMs);
  if (valid.length < MIN_FRAMES) return fail(`кадры без координат/времени — пригодны ${valid.length} из ${frames.length}`);
  const areas = valid.map((f) => (Number.isFinite(f.area) && f.area > 0 ? f.area : 0)).sort((a, b) => a - b);
  const medianArea = areas[Math.floor(areas.length / 2)] || 0;
  const maxArea = areas[areas.length - 1];
  if (medianArea > 0 && maxArea > medianArea * 4) notes.push('есть кадры-выбросы (шум/освещение) — трек сглажен, метрики ориентир');
  const ox = Number.isFinite(Number(cal?.originXpx)) ? Number(cal?.originXpx) : valid[0].cx;
  const oy = Number.isFinite(Number(cal?.originYpx)) ? Number(cal?.originYpx) : valid[0].cy;
  const flip = cal?.flipY ? -1 : 1;
  const raw: TrackPoint[] = valid.map((f) => ({
    t: Math.round((f.tMs - valid[0].tMs) / 100) / 10,
    x: Math.round(((f.cx - ox) / pxPerCm) * 100) / 100,
    y: Math.round((((f.cy - oy) / pxPerCm) * flip) * 100) / 100,
  }));
  const points = smooth(raw);
  if (points.length < MIN_FRAMES) return fail('после сглажения точек мало — видеопоток слишком короткий');

  const xs = points.map((p) => p.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const ys = points.map((p) => p.y);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  if (span < 1 && ySpan < 1) return fail('движения кисти не найдено (<1см размаха) — проверьте ракурс, фон и освещение');

  // Скорость и сегментация циклов по локальным максимумам.
  // Скорости квантуются до 3 знаков: на ровном drag разницу в 1e-16 (float-шум
  // сглаживания) нельзя принимать за «пик» — иначе один проход даёт «циклы».
  const speeds: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt <= 0) { speeds.push(0); continue; }
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    speeds.push(Math.round((Math.sqrt(dx * dx + dy * dy) / dt) * 1000) / 1000);
  }
  const sortedSpeeds = speeds.slice().sort((a, b) => b - a);
  const topSpeeds = sortedSpeeds.slice(0, Math.max(1, Math.floor(sortedSpeeds.length * 0.25)));
  const refSpeed = topSpeeds.reduce((s, v) => s + v, 0) / topSpeeds.length;
  const threshold = refSpeed * 0.35;
  const boundaries: number[] = [0];
  for (let i = 1; i < speeds.length - 1; i++) {
    // строгий локальный максимум скорости (ровный drag без ускорений — один проход,
    // а не «цикл на каждом кадре»): пик должен быть выше ОБОИХ соседей.
    if (speeds[i] >= threshold && speeds[i] > speeds[i - 1] && speeds[i] > speeds[i + 1] && i - boundaries[boundaries.length - 1] >= 3) {
      boundaries.push(i);
      if (boundaries.length > MAX_CYCLES) break;
    }
  }
  boundaries.push(points.length - 1);
  const cycles: VideoTrackCycle[] = [];
  for (let c = 1; c < boundaries.length; c++) {
    const slice = points.slice(boundaries[c - 1], boundaries[c] + 1);
    if (slice.length < 3) continue;
    const m: BarPathMetrics | null = armPathMetrics(slice);
    if (!m) continue;
    cycles.push({
      index: cycles.length + 1,
      startT: slice[0].t,
      endT: slice[slice.length - 1].t,
      xLoop: m.xLoop,
      yMax: m.yMax,
      vMax: m.vMax,
    });
  }
  if (cycles.length === 0) {
    notes.push('циклы не выделились — метрики посчитаны по всему треку (один проход)');
    const m = armPathMetrics(points);
    if (m) cycles.push({ index: 1, startT: points[0].t, endT: points[points.length - 1].t, xLoop: m.xLoop, yMax: m.yMax, vMax: m.vMax });
  }
  notes.push('единицы — сантиметры по калибровке кадра; нуль — позиция первого кадра');
  return { points, cycles, quality: { ok: true, reason: null }, notes };
}

/** Краткая сводка трека для UI (одна строка). */
export function videoTrackLine(r: VideoTrackResult | null): string {
  if (!r || !r.quality.ok) return r?.quality.reason || 'Трек не построен';
  const first = r.cycles[0];
  if (!first) return `Кадров ${r.points.length} · циклы не выделились`;
  const best = r.cycles.reduce((a, b) => (b.vMax > a.vMax ? b : a), first);
  return `Кадров ${r.points.length} · циклов ${r.cycles.length} · лучший vMax ${best.vMax} ед/с · xLoop ${first.xLoop}`;
}
