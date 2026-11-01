/**
 * trajectory-overlay.engine.ts — растровый экспорт траектории штанги (P8/R4).
 *
 * Зачем: SVG удобен для печати, но в мессенджерах/отчётах нужен обычный PNG,
 * а для «видео с оверлеем» — короткая анимация. Здесь только canvas + MediaRecorder,
 * без сетевых запросов и без внешних зависимостей.
 *
 * Честность: это НЕ перекодирование видео подхода. Кадр/анимация строятся по
 * точкам трекинга (Kinovea/CSV): видно траекторию, heatmap скорости, target-zone
 * и справку прошлой сессии. Если canvas/MediaRecorder недоступны — функции
 * возвращают null, вызывающая сторона показывает честное сообщение.
 *
 * recordVideoWithOverlay — исключение: там наоборот, берётся исходный видеофайл,
 * а траектория рисуется панелью поверх кадров (см. комментарий функции).
 */

// Единый источник heatmapping — движок трекинга штанги (см. barSpeedHeat).
import { barSpeedHeat, BAR_HEAT_COLORS, pointIndexAtTime } from '../strength-sport/strength-sport-video.engine';

export interface OverlayPoint { x: number; y: number; t?: number }

export interface TrajectoryRenderInput {
  liftRu: string;
  /** Точки серии (x — горизонталь см, y — высота см, t — время с). */
  points?: ReadonlyArray<OverlayPoint> | null;
  /** Overlay: первый и последний повтор. */
  firstRep?: ReadonlyArray<OverlayPoint> | null;
  lastRep?: ReadonlyArray<OverlayPoint> | null;
  /** Прошлая сессия (первый повтор) — серая справка. */
  prevRep?: ReadonlyArray<OverlayPoint> | null;
  xLoopCm?: number | null;
  vmax?: number | null;
}

const PAD = { x: 70, top: 70, bottom: 110 };

/** Чистое проецирование точек в пиксели канвы (тестируется без DOM). */
export function mapTrajectoryPoints(
  points: ReadonlyArray<{ x: number; y: number }>,
  w: number,
  h: number,
  pad: { x: number; top: number; bottom: number } = PAD,
): Array<[number, number]> {
  if (!points.length) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const innerW = Math.max(1, w - 2 * pad.x);
  const innerH = Math.max(1, h - pad.top - pad.bottom);
  return points.map((p) => [
    pad.x + ((p.x - minX) / Math.max(0.001, maxX - minX)) * innerW,
    h - pad.bottom - ((p.y - minY) / Math.max(0.001, maxY - minY)) * innerH,
  ]);
}

/** Прореживание для анимации: не больше N кадров-точек. */
export function subsamplePoints<T>(points: ReadonlyArray<T>, maxPoints: number): T[] {
  const n = Math.min(points.length, Math.max(2, Math.floor(maxPoints)));
  if (points.length <= n) return [...points];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.round((i * (points.length - 1)) / (n - 1))]);
  return out;
}

/** data:URL → Blob (без fetch: работает и в офлайне). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(5, comma);
  if (!meta.includes('base64')) return null;
  try {
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = meta.split(';')[0] || 'application/octet-stream';
    return new Blob([bytes], { type: mime });
  } catch { return null; }
}

function canUseCanvas(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext && !!c.getContext('2d');
  } catch { return false; }
}

/** Поддерживается ли запись webm (MediaRecorder + canvas.captureStream). */
export function canRecordTrajectory(): boolean {
  if (typeof window === 'undefined') return false;
  const MR = (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  if (typeof MR !== 'function') return false;
  if (!canUseCanvas()) return false;
  try {
    const c = document.createElement('canvas');
    const anyCanvas = c as unknown as { captureStream?: () => unknown };
    return typeof anyCanvas.captureStream === 'function';
  } catch { return false; }
}

function paintBase(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, w, h);
  // target-zone — центральная треть рабочей области
  const innerW = w - 2 * PAD.x;
  const zx = PAD.x + innerW / 3;
  ctx.fillStyle = 'rgba(0,230,138,0.07)';
  ctx.fillRect(zx, PAD.top, innerW / 3, h - PAD.top - PAD.bottom);
  ctx.strokeStyle = '#00e68a';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(zx, PAD.top, innerW / 3, h - PAD.top - PAD.bottom);
  ctx.setLineDash([]);
  ctx.fillStyle = '#00e68a';
  ctx.font = '600 14px sans-serif';
  ctx.fillText('target-zone', zx + 6, PAD.top - 10);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(`Траектория штанги — ${title}`, PAD.x, 40);
}

/**
 * PNG «кадр с оверлеем»: траектория (heatmap по скорости), target-zone, overlay
 * первого/последнего повтора, справка прошлой сессии и подписи метрик.
 * Возвращает data:URL или null, если canvas недоступен/нет точек.
 */
export async function renderTrajectoryPng(inp: TrajectoryRenderInput, size?: { w: number; h: number }): Promise<string | null> {
  const w = size?.w ?? 960;
  const h = size?.h ?? 640;
  if (!canUseCanvas()) return null;
  const hasAny = (inp.points?.length ?? 0) + (inp.firstRep?.length ?? 0) + (inp.lastRep?.length ?? 0) + (inp.prevRep?.length ?? 0);
  if (!hasAny) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintBase(ctx, w, h, inp.liftRu);

  const overlay = !!(inp.firstRep?.length && inp.lastRep?.length);
  const all = [...(inp.points ?? []), ...(inp.firstRep ?? []), ...(inp.lastRep ?? []), ...(inp.prevRep ?? [])];

  // общая нормализация: считаем один раз по объединённому набору,
  // иначе overlay «съезжает» относительно одиночной серии
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x: number) => PAD.x + ((x - minX) / Math.max(0.001, maxX - minX)) * (w - 2 * PAD.x);
  const sy = (y: number) => h - PAD.bottom - ((y - minY) / Math.max(0.001, maxY - minY)) * (h - PAD.top - PAD.bottom);

  const stroke = (pts: ReadonlyArray<OverlayPoint>, color: string, width: number, dash: number[] = []) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = sx(p.x), y = sy(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  if (inp.prevRep?.length) stroke(inp.prevRep, '#94a3b8', 2, [4, 6]);

  if (overlay) {
    stroke(inp.firstRep!, '#38bdf8', 3);
    stroke(inp.lastRep!, '#f59e0b', 3, [10, 7]);
  } else if (inp.points?.length) {
    // Единый источник heatmapping — barSpeedHeat (тот же расчёт, что в SVG/хабе).
    const heat = barSpeedHeat(inp.points.map((p) => ({ x: p.x, y: p.y, t: p.t ?? NaN })));
    if (heat.length) {
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const seg of heat) {
        ctx.strokeStyle = BAR_HEAT_COLORS[seg.level];
        ctx.beginPath();
        ctx.moveTo(sx(seg.x1), sy(seg.y1));
        ctx.lineTo(sx(seg.x2), sy(seg.y2));
        ctx.stroke();
      }
    } else {
      stroke(inp.points, '#38bdf8', 3);
    }
  }

  // подписи
  const footer: string[] = [];
  if (inp.xLoopCm != null) footer.push(`xLoop ${inp.xLoopCm.toFixed(1)} см`);
  if (inp.vmax != null) footer.push(`vmax ${inp.vmax.toFixed(2)} м/с`);
  ctx.fillStyle = '#d1d5db';
  ctx.font = '600 17px sans-serif';
  ctx.fillText(footer.join(' · ') || '—', PAD.x, h - PAD.bottom + 34);
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 14px sans-serif';
  ctx.fillText('скорость из видео — оценка (не LPT)', PAD.x, h - 24);
  if (!overlay && inp.points?.length) {
    ctx.fillStyle = BAR_HEAT_COLORS.fast; ctx.fillText('быстро', w - 190, PAD.top + 12);
    ctx.fillStyle = BAR_HEAT_COLORS.mid; ctx.fillText('средне', w - 190, PAD.top + 32);
    ctx.fillStyle = BAR_HEAT_COLORS.slow; ctx.fillText('медленно (срыв)', w - 190, PAD.top + 52);
  }

  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/**
 * Короткая анимация траектории (webm): точка идёт по пути, рисуется «хвост»,
 * heatmap сохраняется. Это видео-оверлей траектории, а не запись подхода —
 * поэтому подпись «оценка» остаётся.
 */
export async function recordTrajectoryWebm(inp: TrajectoryRenderInput, opts?: { w?: number; h?: number; frames?: number; fps?: number }): Promise<Blob | null> {
  if (!canRecordTrajectory()) return null;
  const pts = inp.points?.length ? inp.points : (inp.firstRep ?? []);
  if (pts.length < 2) return null;
  const w = opts?.w ?? 720;
  const h = opts?.h ?? 480;
  const frames = Math.max(2, opts?.frames ?? 48);
  const fps = Math.max(10, opts?.fps ?? 24);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const stream = (canvas as unknown as { captureStream: (fps?: number) => MediaStream }).captureStream(fps);
  const MR = (window as unknown as { MediaRecorder: new (s: MediaStream, o?: { mimeType?: string }) => MediaRecorder }).MediaRecorder;
  let rec: MediaRecorder;
  try { rec = new MR(stream, { mimeType: 'video/webm' }); }
  catch { try { rec = new MR(stream); } catch { return null; } }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const done = new Promise<Blob | null>((resolve) => {
    rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null);
  });

  const all = [...pts, ...(inp.prevRep ?? [])];
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const sx = (x: number) => PAD.x + ((x - minX) / Math.max(0.001, maxX - minX)) * (w - 2 * PAD.x);
  const sy = (y: number) => h - PAD.bottom - ((y - minY) / Math.max(0.001, maxY - minY)) * (h - PAD.top - PAD.bottom);
  const seq = subsamplePoints(pts, frames);

  rec.start();
  for (let i = 0; i < seq.length; i++) {
    paintBase(ctx, w, h, inp.liftRu);
    if (inp.prevRep?.length) {
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath();
      inp.prevRep.forEach((p, k) => (k === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
      ctx.stroke(); ctx.setLineDash([]);
    }
    // «хвост» — уже пройденная часть пути
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
    ctx.beginPath();
    seq.slice(0, i + 1).forEach((p, k) => (k === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
    ctx.stroke();
    // бегунок
    const head = seq[i];
    ctx.fillStyle = '#00e68a';
    ctx.beginPath();
    ctx.arc(sx(head.x), sy(head.y), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d1d5db';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(inp.vmax != null ? `vmax ${inp.vmax.toFixed(2)} м/с` : '—', PAD.x, h - PAD.bottom + 30);
    await wait(Math.round(1000 / fps));
  }
  rec.stop();
  try { stream.getTracks().forEach((t) => t.stop()); } catch {}
  return done;
}

/** Область отрисовки оверлея поверх видео: панель справа + нижняя подпись. */
function overlayPanelRect(w: number, h: number) {
  const panelW = Math.round(w * 0.38);
  const panelH = Math.round(h * 0.46);
  return { x: w - panelW - 12, y: 12, w: panelW, h: panelH };
}

/**
 * Калибровка «см трека → пиксель видео».
 *
 * Без неё траектория может рисоваться только панелью: неизвестно, где штанга
 * в кадре. Пользователь один раз указывает точку штанги в кадре (anchor),
 * соответствующую точке трека, и известное расстояние между двумя точками кадра
 * (например, диаметр блина) — этого достаточно для масштаба и сдвига.
 */
export interface VideoCalibration {
  /** Точка в кадре (пиксели видео), соответствующая точке трека ниже. */
  videoX: number;
  videoY: number;
  /** Координаты трека (см), привязанные к этой точке. */
  trackX: number;
  trackY: number;
  /** Пикселей видео на 1 см трека. */
  pxPerCm: number;
  /** Съёмка с противоположной стороны / зеркало: инвертировать горизонталь. */
  mirrorX?: boolean;
}

/** Набор тапов для калибровки: якорь (штанга) + два конца известного отрезка. */
export interface CalibrationTaps {
  anchor: { videoX: number; videoY: number; trackX: number; trackY: number };
  refA: { videoX: number; videoY: number };
  refB: { videoX: number; videoY: number };
  /** Реальная длина отрезка refA→refB, см. */
  refCm: number;
  mirrorX?: boolean;
}

/** Правдоподобность калибровки: 0.05…200 px/см (отсекает опечатки и битые данные). */
export function isCalibrationSane(c: VideoCalibration | null | undefined): boolean {
  if (!c) return false;
  const nums = [c.videoX, c.videoY, c.trackX, c.trackY, c.pxPerCm];
  if (!nums.every((n) => Number.isFinite(n))) return false;
  return c.pxPerCm > 0.05 && c.pxPerCm < 200;
}

/** Пиксели видео для точек трека (y трека растёт вверх, в кадре — вниз). */
export function mapTrackToVideo(
  points: ReadonlyArray<{ x: number; y: number }>,
  calib: VideoCalibration,
): Array<[number, number]> {
  if (!Array.isArray(points) || !points.length) return [];
  if (!isCalibrationSane(calib)) return [];
  const k = calib.pxPerCm;
  const mx = calib.mirrorX ? -1 : 1;
  return points.map((p) => [
    calib.videoX + (p.x - calib.trackX) * k * mx,
    calib.videoY - (p.y - calib.trackY) * k,
  ]);
}

/**
 * Доля точек трека, попавших в кадр после калибровки: если она мала, якорь или
 * масштаб неверны, и линия на видео уйдёт за край.
 */
export function calibrationFrameFit(
  mapped: ReadonlyArray<[number, number]>,
  w: number,
  h: number,
): number {
  if (!mapped.length || !(w > 0) || !(h > 0)) return 0;
  let inside = 0;
  for (const [x, y] of mapped) if (x >= 0 && x <= w && y >= 0 && y <= h) inside++;
  return inside / mapped.length;
}

/** Масштаб из двух тапов известной длины; null — если тап не дал масштаба. */export function calibrationFromTaps(t: CalibrationTaps): VideoCalibration | null {
  if (!t || !t.anchor || !t.refA || !t.refB) return null;
  const distPx = Math.hypot(t.refB.videoX - t.refA.videoX, t.refB.videoY - t.refA.videoY);
  if (!(t.refCm > 0) || !(distPx > 0)) return null;
  const calib: VideoCalibration = {
    videoX: t.anchor.videoX,
    videoY: t.anchor.videoY,
    trackX: t.anchor.trackX,
    trackY: t.anchor.trackY,
    pxPerCm: distPx / t.refCm,
    ...(t.mirrorX ? { mirrorX: true } : {}),
  };
  return isCalibrationSane(calib) ? calib : null;
}

/**
 * Калибровка с перспективой: камера стоит не строго напротив плоскости движения,
 * поэтому один масштаб px/см не подходит — снизу и сверху кадра он разный.
 *
 * Физика: pinhole-камера с наклоном даёт по вертикали дробно-линейную (проективную)
 * связь `Y = (vA*y + vB) / (vC*y + 1)`, а масштаб меняется как её производная.
 * Три привязки «штанга в кадре на момент времени трека» задают ровно три неизвестных,
 * а горизонталь масштабируется локально (изотропно) — без выдуманных коэффициентов.
 *
 * Важно: 4-точечная гомография по точкам штанги НЕ решается — эти точки почти
 * коллинеарны (движение вертикальное). Поэтому модель именно осевая, 1D-проективная.
 */
export interface PerspectiveCalibration {
  /** Привязки, по которым считалась перспектива: время трека → точка трека (см) ↔ пиксель кадра. */
  anchors: Array<{ timeSec: number; trackX: number; trackY: number; videoX: number; videoY: number }>;
  /** Вертикальная связь: Y = (vA*y + vB) / (vC*y + 1). */
  vA: number;
  vB: number;
  vC: number;
  /** Максимальная невязка привязок по вертикали, px — честная оценка попадания. */
  fitPx: number;
  /** Съёмка с противоположной стороны / зеркало: инвертировать горизонталь. */
  mirrorX?: boolean;
}

/** Одна привязка перспективы: время трека и пиксель штанги в кадре на этот момент. */
export interface PerspectiveAnchor { timeSec: number; videoX: number; videoY: number }

/** Локальный масштаб «пикселей на 1 см» на высоте трека y (производная проектива). */
export function perspectiveLocalScale(c: PerspectiveCalibration, yTrack: number): number {
  if (!c || !Number.isFinite(yTrack)) return 0;
  const den = c.vC * yTrack + 1;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-6) return 0;
  const k = Math.abs(c.vA - c.vC * c.vB);
  return k / (den * den);
}

/** Правдоподобность перспективной калибровки: 4+ привязки, конечные числа, живой масштаб. */
export function isPerspectiveSane(c: PerspectiveCalibration | null | undefined): boolean {
  if (!c || !Array.isArray(c.anchors) || c.anchors.length < 4) return false;
  if (![c.vA, c.vB, c.vC, c.fitPx].every((n) => Number.isFinite(n)) || c.fitPx < 0) return false;
  for (const a of c.anchors) {
    if (![a.timeSec, a.trackX, a.trackY, a.videoX, a.videoY].every((n) => Number.isFinite(n))) return false;
    const s = perspectiveLocalScale(c, a.trackY);
    if (!(s > 0.05 && s < 200)) return false;
  }
  return true;
}

/** Разброс масштаба по высоте привязок, %: 0 — перспективы нет, 15 — верх в 1.15 раза мельче. */
export function perspectiveSkewPct(c: PerspectiveCalibration): number | null {
  if (!isPerspectiveSane(c)) return null;
  const ys = c.anchors.map((a) => a.trackY);
  const lo = perspectiveLocalScale(c, Math.min(...ys));
  const hi = perspectiveLocalScale(c, Math.max(...ys));
  if (!(lo > 0) || !(hi > 0)) return null;
  return Math.round(Math.abs(1 - hi / lo) * 100);
}

/** Решение 3×3 методом Крамера (без зависимостей). */
function solve3(m: number[][], v: number[]): [number, number, number] | null {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
    - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
    + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  const norm = Math.max(1, ...m.flat().map((x) => Math.abs(x)));
  if (!Number.isFinite(d) || Math.abs(d) < 1e-9 * norm ** 3) return null;
  const rep = (col: number) => m.map((row, i) => row.map((x, j) => (j === col ? v[i] : x)));
  const out: [number, number, number] = [det(rep(0)) / d, det(rep(1)) / d, det(rep(2)) / d];
  return out.every((n) => Number.isFinite(n)) ? out : null;
}

/** Подгонка проектива по привязкам (нормальные уравнения в нормированных координатах). */
function fitProjective(rows: ReadonlyArray<{ trackY: number; videoY: number }>): [number, number, number] | null {
  if (rows.length < 3) return null;
  // Нормировка: без неё матрица плохо обусловлена (y*Y ~ 1e4 при y ~ 50),
  // и точное решение отбрасывалось как «вырожденное».
  const sy = Math.max(...rows.map((r) => Math.abs(r.trackY)));
  const sY = Math.max(...rows.map((r) => Math.abs(r.videoY)));
  if (!(sy > 1e-6) || !(sY > 1e-6)) return null;
  const ATA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ATb = [0, 0, 0];
  for (const r of rows) {
    const u = r.trackY / sy;
    const W = r.videoY / sY;
    const row = [u, 1, -u * W];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) ATA[i][j] += row[i] * row[j];
      ATb[i] += row[i] * W;
    }
  }
  const sol = solve3(ATA, ATb);
  if (!sol) return null;
  const [aN, bN, cN] = sol;
  // Обратный переход к исходным единицам: Y = (sY/sy·a·y + sY·b) / ((c/sy)·y + 1).
  return [(sY / sy) * aN, sY * bN, cN / sy];
}

/** Значение проектива в исходных пикселях (null при полюсе). */
function projectiveY(v: readonly [number, number, number], y: number): number | null {
  const [vA, vB, vC] = v;
  const den = vC * y + 1;
  if (!(Math.abs(den) > 1e-3)) return null;
  const out = (vA * y + vB) / den;
  return Number.isFinite(out) ? out : null;
}

/**
 * Перспектива по 4+ привязкам: для каждой берётся точка трека на это время и пиксель
 * кадра, куда ткнул пользователь.
 *
 * Минимум именно 4, а не 3: три точки дают точное решение (3 неизвестных, 3 уравнения),
 * поэтому ошибку в тапе невозможно обнаружить. Четвёртая точка делает проверку возможной,
 * причём двойной: остаток подгонки + leave-one-out (точка предсказывается по остальным).
 * Возвращает null, если привязки вырождены (одинаковые высоты, слишком близко) или не сходятся.
 */
export function perspectiveFromAnchors(
  anchors: ReadonlyArray<PerspectiveAnchor>,
  points: ReadonlyArray<OverlayPoint>,
  opts?: { mirrorX?: boolean },
): PerspectiveCalibration | null {
  if (!Array.isArray(anchors) || anchors.length < 4) return null;
  if (!Array.isArray(points) || points.length < 2) return null;
  const clean = anchors.filter((a) => a && [a.timeSec, a.videoX, a.videoY].every((n) => Number.isFinite(n)));
  if (clean.length < 4) return null;

  const times = points.map((p, i) => ({ t: p.t ?? i / 30 }));
  const rows: Array<{ timeSec: number; trackX: number; trackY: number; videoX: number; videoY: number }> = [];
  for (const a of clean) {
    const idx = pointIndexAtTime(times, a.timeSec);
    const p = idx >= 0 ? points[idx] : null;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    rows.push({ timeSec: a.timeSec, trackX: p.x, trackY: p.y, videoX: a.videoX, videoY: a.videoY });
  }

  // Высоты должны реально различаться, иначе проектив не определить.
  const ys = rows.map((r) => r.trackY).sort((a, b) => a - b);
  // Привязки обязаны покрывать ход штанги: экстраполяция перспективы с 5 см на 50 см — выдумка.
  const trackYs = points.map((p) => p.y).filter((y) => Number.isFinite(y));
  const trackRange = trackYs.length ? Math.max(...trackYs) - Math.min(...trackYs) : 0;
  const needSpan = Math.max(10, trackRange * 0.5);
  if (!(ys[ys.length - 1] - ys[0] >= needSpan)) return null;
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 0.5) return null;

  const fit = fitProjective(rows);
  if (!fit) return null;
  const [vA, vB, vC] = fit;

  const calib: PerspectiveCalibration = {
    anchors: rows,
    vA, vB, vC,
    fitPx: 0,
    ...(opts?.mirrorX ? { mirrorX: true } : {}),
  };
  for (const r of rows) {
    const pred = projectiveY(fit, r.trackY);
    if (pred == null) return null;
    calib.fitPx = Math.max(calib.fitPx, Math.abs(pred - r.videoY));
  }
  calib.fitPx = Math.round(calib.fitPx * 10) / 10;
  if (!isPerspectiveSane(calib)) return null;

  // Невязка в сантиметрах хода: тап дальше 3 см от модели — ошибка в кадре, а не «перспектива».
  const scales = rows.map((r) => perspectiveLocalScale(calib, r.trackY)).sort((a, b) => a - b);
  const scaleMed = scales[Math.floor(scales.length / 2)] || 0;
  if (!(scaleMed > 0)) return null;
  const tolerancePx = Math.max(2, scaleMed * 3);
  if (calib.fitPx > tolerancePx) return null;

  // Leave-one-out: проектив с 4 точками легко «изгибается» под один промах, поэтому каждая
  // точка предсказывается по остальным. Промах в тапе виден здесь при любом его положении.
  for (let i = 0; i < rows.length; i++) {
    const rest = rows.filter((_, j) => j !== i);
    const holdout = fitProjective(rest);
    if (!holdout) return null;
    const pred = projectiveY(holdout, rows[i].trackY);
    if (pred == null || Math.abs(pred - rows[i].videoY) > tolerancePx) return null;
  }
  return calib;
}

/** Пиксели видео для точек трека с учётом перспективы (y трека вверх, в кадре — вниз). */
export function mapTrackToVideoPerspective(
  points: ReadonlyArray<{ x: number; y: number }>,
  calib: PerspectiveCalibration,
): Array<[number, number]> {
  if (!Array.isArray(points) || !points.length || !isPerspectiveSane(calib)) return [];
  const origin = calib.anchors[0];
  const mx = calib.mirrorX ? -1 : 1;
  const out: Array<[number, number]> = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return [];
    const den = calib.vC * p.y + 1;
    if (!(Math.abs(den) > 1e-3)) return [];
    const yv = (calib.vA * p.y + calib.vB) / den;
    const s = perspectiveLocalScale(calib, p.y);
    if (!Number.isFinite(yv) || !(s > 0)) return [];
    out.push([origin.videoX + (p.x - origin.trackX) * s * mx, yv]);
  }
  return out;
}

/** Контейнер записи: mp4, если WebView умеет (Chrome 126+), иначе webm. */
export function preferredVideoMime(): { mime: string; ext: 'mp4' | 'webm' } {
  try {
    const MR = (globalThis as unknown as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
    if (typeof MR?.isTypeSupported === 'function') {
      for (const mime of ['video/mp4;codecs=avc1.42E01E', 'video/mp4']) {
        try { if (MR.isTypeSupported(mime)) return { mime, ext: 'mp4' }; } catch { /* пробуем следующий */ }
      }
    }
  } catch { /* нет MediaRecorder — останется webm */ }
  return { mime: 'video/webm', ext: 'webm' };
}

/**
 * Кадр видео как data:URL — по нему пользователь тыкает в штангу для калибровки.
 * Возвращает null, если видео не декодировалось или canvas недоступен.
 */
export async function grabVideoFrame(
  file: Blob,
  opts?: { timeSec?: number; maxW?: number },
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!canUseCanvas() || !file || typeof document === 'undefined') return null;
  const URLRef = (globalThis as unknown as { URL?: typeof URL }).URL;
  if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
  const url = URLRef.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = () => { if (!settled) { settled = true; reject(new Error('video-decode')); } };
      video.onloadeddata = ok;
      video.onerror = fail;
      setTimeout(fail, 8000);
    });
    if (!(video.videoWidth > 0) || !(video.videoHeight > 0)) return null;
    const t = Math.max(0, opts?.timeSec ?? 0);
    if (t > 0) {
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        try { video.currentTime = Math.min(t, Math.max(0, (video.duration || t) - 0.01)); }
        catch { resolve(); }
        setTimeout(resolve, 3000);
      });
    }
    const maxW = opts?.maxW ?? 480;
    const k = Math.min(1, maxW / video.videoWidth);
    const w = Math.round(video.videoWidth * k);
    const h = Math.round(video.videoHeight * k);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    // Возвращаем натуральные размеры: тапы по превью пересчитываются в пиксели видео.
    return { dataUrl, width: video.videoWidth, height: video.videoHeight };
  } catch {
    return null;
  } finally {
    try { video.pause(); } catch {}
    try { URLRef.revokeObjectURL(url); } catch {}
  }
}

/**
 * Видео подхода с наложенной траекторией.
 *
 * Два режима:
 * - с калибровкой (`calibration`) или перспективой (`perspective`) — траектория рисуется
 *   прямо по кадру, по грифу;
 * - без них — честная панель траектории в углу (позиция штанги в кадре неизвестна).
 *
 * Контейнер — mp4, если WebView его пишет, иначе webm; картинка видео
 * перекодируется, то есть это не оригинальный файл.
 *
 * Возвращает null, если MediaRecorder/captureStream/video недоступны или файл
 * не декодируется.
 */
export async function recordVideoWithOverlay(
  inp: TrajectoryRenderInput & { file: Blob; offsetSec?: number; calibration?: VideoCalibration | null; perspective?: PerspectiveCalibration | null },
  opts?: { w?: number; h?: number },
): Promise<Blob | null> {
  if (!canRecordTrajectory()) return null;
  if (!inp.file || typeof inp.file.size !== 'number') return null;
  const pts = inp.points?.length ? inp.points : (inp.firstRep ?? []);
  if (pts.length < 2) return null;
  if (typeof document === 'undefined') return null;
  const URLRef = (globalThis as unknown as { URL?: typeof URL }).URL;
  if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
  const container = preferredVideoMime();

  const url = URLRef.createObjectURL(inp.file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = () => { if (!settled) { settled = true; reject(new Error('video-decode')); } };
      video.onloadedmetadata = ok;
      video.onloadeddata = ok;
      video.onerror = fail;
      // jsdom/WebView без декодера может не прислать ни одного события
      setTimeout(fail, 8000);
    });
    if (!(video.videoWidth > 0) || !(video.videoHeight > 0)) return null;

    const maxW = opts?.w ?? 720;
    const scale = Math.min(1, maxW / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const stream = (canvas as unknown as { captureStream: (fps?: number) => MediaStream }).captureStream(30);
    const MR = (window as unknown as { MediaRecorder?: new (s: MediaStream, o?: { mimeType?: string }) => MediaRecorder }).MediaRecorder;
    if (typeof MR !== 'function') return null;
    let rec: MediaRecorder;
    try { rec = new MR(stream, { mimeType: container.mime }); }
    catch {
      try { rec = new MR(stream, { mimeType: container.ext === 'mp4' ? 'video/mp4' : 'video/webm' }); }
      catch { try { rec = new MR(stream); } catch { return null; } }
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    const done = new Promise<Blob | null>((resolve) => {
      rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: container.mime.split(';')[0] }) : null);
      rec.onerror = () => resolve(null);
    });

    // Перспектива точнее единого масштаба, поэтому у неё приоритет.
    const persp = isPerspectiveSane(inp.perspective) ? inp.perspective! : null;
    const calib = !persp && isCalibrationSane(inp.calibration) ? inp.calibration! : null;
    const mapped = persp
      ? mapTrackToVideoPerspective(pts, persp)
      : calib ? mapTrackToVideo(pts, calib) : null;
    // В кадре ли линия: иначе честно пишем, что калибровка не сходится.
    const fit = mapped && mapped.length ? calibrationFrameFit(mapped, video.videoWidth, video.videoHeight) : 0;
    const panel = overlayPanelRect(w, h);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const px = (x: number) => panel.x + 10 + ((x - minX) / Math.max(0.001, maxX - minX)) * (panel.w - 20);
    const py = (y: number) => panel.y + panel.h - 12 - ((y - minY) / Math.max(0.001, maxY - minY)) * (panel.h - 44);

    const times = pts.map((p, i) => ({ t: p.t ?? i / 30 }));

    const drawn = mapped && mapped.length ? mapped : null;

    const drawFrame = () => {
      ctx.clearRect(0, 0, w, h);
      try { ctx.drawImage(video, 0, 0, w, h); } catch { /* кадр ещё не готов */ }
      const idx = pointIndexAtTime(times, Math.max(0, video.currentTime - (inp.offsetSec ?? 0)));
      if (drawn) {
        // Калиброванный режим: линия по грифу, без панели.
        if (idx > 0) {
          ctx.beginPath();
          for (let i = 0; i <= idx; i++) {
            const bx = drawn[i][0] * scale, by = drawn[i][1] * scale;
            if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
          }
          ctx.strokeStyle = BAR_HEAT_COLORS.fast;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        if (idx >= 0 && drawn[idx]) {
          ctx.fillStyle = BAR_HEAT_COLORS.slow;
          ctx.beginPath();
          ctx.arc(drawn[idx][0] * scale, drawn[idx][1] * scale, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // панель траектории (без калибровки позиция штанги в кадре неизвестна)
        ctx.fillStyle = 'rgba(11,15,20,0.78)';
        ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
        ctx.strokeStyle = BAR_HEAT_COLORS.mid;
        ctx.lineWidth = 1;
        ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '600 13px sans-serif';
        ctx.fillText(inp.liftRu, panel.x + 10, panel.y + 20);
        if (idx > 0) {
          ctx.beginPath();
          for (let i = 0; i <= idx; i++) {
            const sx2 = px(pts[i].x), sy2 = py(pts[i].y);
            if (i === 0) ctx.moveTo(sx2, sy2); else ctx.lineTo(sx2, sy2);
          }
          ctx.strokeStyle = BAR_HEAT_COLORS.fast;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        if (idx >= 0) {
          const head = pts[idx];
          ctx.fillStyle = BAR_HEAT_COLORS.slow;
          ctx.beginPath();
          ctx.arc(px(head.x), py(head.y), 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#d1d5db';
      ctx.font = '600 13px sans-serif';
      const footer = [
        inp.xLoopCm != null ? `xLoop ${inp.xLoopCm.toFixed(1)} см` : '',
        inp.vmax != null ? `vmax ${inp.vmax.toFixed(2)} м/с` : '',
      ].filter(Boolean).join(' · ') || '—';
      ctx.fillText(footer, 12, h - 28);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '500 12px sans-serif';
      ctx.fillText(drawn
        ? (fit >= 0.6
          ? `${persp ? 'линия по перспективе (3 точки)' : 'линия по калибровке кадра'} · скорость — оценка (не LPT)`
          : `линия вне кадра (${Math.round(fit * 100)}% точек) — проверьте калибровку · скорость — оценка (не LPT)`)
        : 'скорость из видео — оценка (не LPT)', 12, h - 10);
    };

    rec.start();
    await video.play();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (video.ended || video.paused) { drawFrame(); resolve(); return; }
        drawFrame();
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(() => tick());
        } else {
          setTimeout(tick, 33);
        }
      };
      tick();
    });
    rec.stop();
    try { stream.getTracks().forEach((t) => t.stop()); } catch {}
    return await done;
  } catch {
    return null;
  } finally {
    try { video.pause(); } catch {}
    try { URLRef.revokeObjectURL(url); } catch {}
  }
}
