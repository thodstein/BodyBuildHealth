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
  /** Готовая строка overlay («Повторы: 3 · vmax 0.52→0.44 …»). */
  overlayText?: string;
  /** Готовая строка сравнения сессий («vmax ниже прошлой сессии: …»). */
  sessionText?: string;
  /** Без префикса: «в норме — Геометрия съёмки в допуске» (префикс добавляет рендер). */
  captureQuality?: string;
  /** Короткая строка ракурса («⚠ ход 37.5% — либо техника, либо камера не под 90°»). */
  angleText?: string;
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

function paintBase(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, padBottom: number = PAD.bottom) {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, w, h);
  // target-zone — центральная треть рабочей области
  const innerW = w - 2 * PAD.x;
  const zx = PAD.x + innerW / 3;
  ctx.fillStyle = 'rgba(0,230,138,0.07)';
  ctx.fillRect(zx, PAD.top, innerW / 3, h - PAD.top - padBottom);
  ctx.strokeStyle = '#00e68a';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(zx, PAD.top, innerW / 3, h - PAD.top - padBottom);
  ctx.setLineDash([]);
  ctx.fillStyle = '#00e68a';
  ctx.font = '600 14px sans-serif';
  ctx.fillText('target-zone', zx + 6, PAD.top - 10);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(`Траектория штанги — ${title}`, PAD.x, 40);
}

/** Строка подписи под графиком: текст + цвет (раскладка чистая, тестируется без canvas). */
export interface TrajectoryPngLine { text: string; color: string }

/**
 * Подписи под графиком PNG — тот же набор, что в SVG-выгрузке. Раньше PNG нёс
 * только xLoop/vmax, и картинка, пересланная отдельно от отчёта, шла без оговорок
 * о качестве съёмки и ракурсе, хотя её читают как самостоятельный вывод.
 */
export function trajectoryPngLines(inp: TrajectoryRenderInput): TrajectoryPngLine[] {
  const out: TrajectoryPngLine[] = [];
  if (inp.overlayText?.trim()) out.push({ text: inp.overlayText, color: '#e5e7eb' });
  if (inp.sessionText?.trim()) out.push({ text: inp.sessionText, color: '#cbd5e1' });
  if (inp.captureQuality?.trim()) out.push({ text: `качество: ${inp.captureQuality}`, color: '#d1d5db' });
  if (inp.angleText?.trim()) out.push({ text: inp.angleText, color: '#fbbf24' });
  return out;
}

/**
 * Раскладка PNG: под каждую подпись картинка растёт на 20 px, а нижний отступ
 * увеличивается на столько же — значит график не сжимается и подписи не лезут на него.
 */
export function trajectoryPngLayout(
  inp: TrajectoryRenderInput,
  base?: { w?: number; h?: number },
): { w: number; h: number; padBottom: number; lines: TrajectoryPngLine[] } {
  const lines = trajectoryPngLines(inp);
  const extra = lines.length * 20;
  return { w: base?.w ?? 960, h: (base?.h ?? 640) + extra, padBottom: PAD.bottom + extra, lines };
}

/** Обрезать строку по ширине канвы: лучше «…», чем текст, уехавший за край. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!(maxW > 0) || ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

/**
 * PNG «кадр с оверлеем»: траектория (heatmap по скорости), target-zone, overlay
 * первого/последнего повтора, справка прошлой сессии и подписи метрик.
 * Возвращает data:URL или null, если canvas недоступен/нет точек.
 */
export async function renderTrajectoryPng(inp: TrajectoryRenderInput, size?: { w: number; h: number }): Promise<string | null> {
  const layout = trajectoryPngLayout(inp, size);
  const { w, h } = layout;
  const padBottom = layout.padBottom;
  if (!canUseCanvas()) return null;
  const hasAny = (inp.points?.length ?? 0) + (inp.firstRep?.length ?? 0) + (inp.lastRep?.length ?? 0) + (inp.prevRep?.length ?? 0);
  if (!hasAny) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintBase(ctx, w, h, inp.liftRu, padBottom);

  const overlay = !!(inp.firstRep?.length && inp.lastRep?.length);
  const all = [...(inp.points ?? []), ...(inp.firstRep ?? []), ...(inp.lastRep ?? []), ...(inp.prevRep ?? [])];

  // общая нормализация: считаем один раз по объединённому набору,
  // иначе overlay «съезжает» относительно одиночной серии
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x: number) => PAD.x + ((x - minX) / Math.max(0.001, maxX - minX)) * (w - 2 * PAD.x);
  const sy = (y: number) => h - padBottom - ((y - minY) / Math.max(0.001, maxY - minY)) * (h - PAD.top - padBottom);

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

  // подписи: метрики, затем те же строки, что в SVG, затем оговорка «оценка»
  const footer: string[] = [];
  if (inp.xLoopCm != null) footer.push(`xLoop ${inp.xLoopCm.toFixed(1)} см`);
  if (inp.vmax != null) footer.push(`vmax ${inp.vmax.toFixed(2)} м/с`);
  const maxTextW = w - 2 * PAD.x;
  let textY = h - padBottom + 18;
  ctx.fillStyle = '#d1d5db';
  ctx.font = '600 17px sans-serif';
  ctx.fillText(fitText(ctx, footer.join(' · ') || '—', maxTextW), PAD.x, textY);
  ctx.font = '500 13px sans-serif';
  for (const line of layout.lines) {
    textY += 20;
    ctx.fillStyle = line.color;
    ctx.fillText(fitText(ctx, line.text, maxTextW), PAD.x, textY);
  }
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 12px sans-serif';
  ctx.fillText('скорость из видео — оценка (не LPT)', PAD.x, h - 10);
  if (!overlay && inp.points?.length) {
    ctx.font = '600 14px sans-serif';
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
  /** Размер кадра видео, px: нужен, чтобы проверить «сколько точек трека попало в кадр» без кадра. */
  frameW?: number;
  frameH?: number;
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
  if (!(c.pxPerCm > 0.05 && c.pxPerCm < 200)) return false;
  // Размер кадра необязателен, но если записан — только правдоподобный.
  if (c.frameW != null || c.frameH != null) {
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 20000;
    if (!ok(c.frameW) || !ok(c.frameH)) return false;
  }
  return true;
}

/**
 * Доля точек трека в кадре для сохранённой калибровки (0…1) или null, если
 * размер кадра неизвестен. Нужна, чтобы видеть сходимость после перезагрузки.
 */
export function calibrationFrameFitOf(
  c: VideoCalibration | null | undefined,
  points: ReadonlyArray<{ x: number; y: number }>,
): number | null {
  if (!c || !isCalibrationSane(c) || !Array.isArray(points) || !points.length) return null;
  if (!(c.frameW! > 0) || !(c.frameH! > 0)) return null;
  const mapped = mapTrackToVideo(points, c);
  if (!mapped.length) return null;
  return calibrationFrameFit(mapped, c.frameW!, c.frameH!);
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
  /** Размер кадра видео, px: нужен, чтобы проверить «сколько точек трека попало в кадр» без кадра. */
  frameW?: number;
  frameH?: number;
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
  // Размер кадра необязателен, но если записан — только правдоподобный.
  if (c.frameW != null || c.frameH != null) {
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 20000;
    if (!ok(c.frameW) || !ok(c.frameH)) return false;
  }
  return true;
}

/**
 * Доля точек трека в кадре для сохранённой перспективы (0…1) или null, если
 * размер кадра неизвестен. Без кадра проверить попадание больше нечем.
 */
export function perspectiveFrameFit(
  c: PerspectiveCalibration | null | undefined,
  points: ReadonlyArray<{ x: number; y: number }>,
): number | null {
  if (!c || !isPerspectiveSane(c) || !Array.isArray(points) || !points.length) return null;
  if (!(c.frameW! > 0) || !(c.frameH! > 0)) return null;
  const mapped = mapTrackToVideoPerspective(points, c);
  if (!mapped.length) return null;
  return calibrationFrameFit(mapped, c.frameW!, c.frameH!);
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

/**
 * Обратное к вертикальной связи перспективы: высота трека (см) по пикселю кадра.
 * Нужна, чтобы взять локальный масштаб именно на той высоте, где лежит эталон:
 * `Y = (vA·y + vB)/(vC·y + 1)` → `y = (vB − Y)/(Y·vC − vA)`.
 * null — если связь в этой точке вырождена (знаменатель ~0).
 */
export function perspectiveTrackYForVideoY(c: PerspectiveCalibration, videoY: number): number | null {
  if (!c || !isPerspectiveSane(c) || !Number.isFinite(videoY)) return null;
  const den = videoY * c.vC - c.vA;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-9) return null;
  const y = (c.vB - videoY) / den;
  return Number.isFinite(y) ? y : null;
}

/**
 * Эталон в кадре — отрезок известной длины, лежащий ПОПЕРЁК движения штанги
 * (гриф между насечками, ширина стойки или скамьи).
 *
 * Физика простая и проверяемая: камера в плоскости движения видит такой отрезок
 * в истинную длину, а повёрнутая на угол φ — укороченным примерно в cos φ раз.
 * Значит `cos φ = наблюдаемая длина / (реальная длина × масштаб)`, и угол
 * считается, а не угадывается.
 *
 * Почему не диск: блин круглый, его видимая ширина почти не зависит от азимута —
 * по нему угол не измерить (для масштаба он годится).
 */
export interface ReferenceSpan {
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** Реальная длина отрезка, см. */
  lengthCm: number;
  /**
   * Ось эталона — от неё зависит сама формула, и перепутать их нельзя:
   * - `across` («поперёк движения», в плоскости движения, горизонтально: длина
   *   скамьи, глубина стойки, метки на полу) виден полностью при камере в
   *   плоскости и сжимается как **cos φ**;
   * - `along` («вдоль штанги»: гриф между насечками, ширина стойки) при камере в
   *   плоскости направлен в объектив и почти не виден — он растёт как **sin φ**.
   * По умолчанию `across`.
   */
  axis?: ReferenceAxis;
}

/** Ось эталона: как он лежит относительно плоскости движения. */
export type ReferenceAxis = 'across' | 'along';

export interface ReferenceAngleResult {
  /** Наблюдаемая длина отрезка в кадре, см (по масштабу кадра). */
  observedCm: number;
  /** Ожидаемая длина при камере в плоскости движения, см. */
  expectedCm: number;
  /** observed / expected: при `across` это cos φ, при `along` — sin φ. */
  ratio: number;
  /** Ось, по которой считался угол (входит в формулу, а не в подпись). */
  axis: ReferenceAxis;
  /** Отклонение камеры от плоскости движения, град; null — измерить нельзя. */
  azimuthDeg: number | null;
  /** cos φ — насколько сжата горизонталь кадра; 1 — камера в плоскости. null — не измерено. */
  cosPhi: number | null;
  /** Относительная точность cos φ, % (± из точности тапа); null — не оценить. */
  cosPhiRelErrPct: number | null;
  flag: 'ok' | 'unknown';
  /** Пикселей на сантиметр, по которым считалось (для отчёта). */
  pxPerCm: number;
  /** Наблюдаемая длина отрезка в пикселях кадра: задаёт точность замера (±тап/длина). */
  spanPx: number;
  reason: string;
}

/** Отрезок короче 24 px: ошибка тапа в 1 px даёт уже >4° — мерить нечего. */
const REF_MIN_PX = 24;
/** Отрезок не может быть длиннее 5 м — это опечатка в длине, а не эталон. */
const REF_MAX_CM = 500;

/**
 * Угол камеры по эталону в кадре; null — входные данные бессмысленны.
 *
 * `pxPerCm` берётся из калибровки кадра или перспективы: без масштаба кадра
 * «длина в кадре» — просто пиксели, и угол из них не следует. Поэтому без
 * масштаба результат честно `unknown`, а не «0°».
 *
 * Главное про геометрию (частая ошибка): формулы разные для двух осей.
 * Отрезок в плоскости движения поперёк луча зрения виден полностью при камере
 * в плоскости и сжимается как cos φ. Отрезок вдоль штанги при камере в
 * плоскости направлен в объектив, виден почти в ноль и растёт как sin φ. Если
 * взять «гриф между насечками» и посчитать по cos, на 30° от плоскости выйдет
 * 60° — то есть опасная ерунда в сторону «камера сбоку, всё сравнимо».
 */
export function referenceAngleCheck(
  span: ReferenceSpan | null | undefined,
  opts?: { pxPerCm?: number | null; tapPx?: number },
): ReferenceAngleResult | null {
  if (!span || !span.a || !span.b) return null;
  const { a, b, lengthCm } = span;
  if (![a.x, a.y, b.x, b.y].every((n) => Number.isFinite(n))) return null;
  if (!(lengthCm > 0) || lengthCm > REF_MAX_CM) return null;
  const axis: ReferenceAxis = span.axis === 'along' ? 'along' : 'across';
  const pxPerCm = opts?.pxPerCm;
  const tapPx = opts?.tapPx ?? REF_TAP_PX;
  const dPx = Math.hypot(b.x - a.x, b.y - a.y);
  const base: Omit<ReferenceAngleResult, 'reason' | 'flag' | 'azimuthDeg' | 'cosPhi' | 'cosPhiRelErrPct'> = {
    observedCm: 0,
    expectedCm: lengthCm,
    ratio: 0,
    axis,
    pxPerCm: Number.isFinite(pxPerCm) ? (pxPerCm as number) : 0,
    spanPx: Number.isFinite(dPx) ? Math.round(dPx * 10) / 10 : 0,
  };
  const unknown = (reason: string): ReferenceAngleResult => ({
    ...base,
    flag: 'unknown',
    azimuthDeg: null,
    cosPhi: null,
    cosPhiRelErrPct: null,
    reason,
  });
  if (!Number.isFinite(pxPerCm) || !((pxPerCm as number) > 0.05 && (pxPerCm as number) < 200)) {
    return unknown('Без масштаба кадра угол не измерить: сначала калибровка кадра (два тапа по отрезку) или перспектива по четырём точкам.');
  }
  if (!(dPx >= REF_MIN_PX)) {
    return unknown(`Эталон в кадре всего ${Math.round(dPx)} px: ошибка тапа в 1 px съедает больше 4° — ткните точнее или возьмите отрезок длиннее.`);
  }
  const observedCm = dPx / (pxPerCm as number);
  const ratio = observedCm / lengthCm;
  base.observedCm = Math.round(observedCm * 10) / 10;
  base.ratio = Math.round(ratio * 1000) / 1000;
  if (ratio > 1.12) {
    return unknown(`Эталон виден на ${Math.round((ratio - 1) * 100)}% длиннее, чем должен: он ближе к камере, чем калибровочная плоскость, `
      + 'или указана не та длина. '
      + (axis === 'across'
        ? 'Поставьте эталон в плоскости движения штанги (длина скамьи, глубина стойки, метки на полу) либо уточните калибровку — угол не выдаю.'
        : 'Для эталона вдоль штанги это значит, что концы ткнуты не по грифу (или длина не та). Уточните — угол не выдаю.'));
  }
  // cos φ и угол считаются по-разному для двух осей — это и есть суть замера.
  const cosPhi = axis === 'across'
    ? Math.min(1, Math.max(0, ratio))
    : Math.sqrt(Math.max(0, 1 - Math.min(1, ratio * ratio)));
  const deg = Math.round((Math.acos(Math.min(1, Math.max(0, cosPhi))) * 180) / Math.PI);
  // Точность cos φ: через тап по эталону. Для `along` ошибка усиливается у фронта.
  const sigmaRatio = (Math.SQRT2 * tapPx) / dPx; // относительная ошибка observed/expected
  const relErr = axis === 'across'
    ? sigmaRatio
    : (ratio * sigmaRatio) / Math.max(1e-6, 1 - ratio * ratio);
  const cosPhiRelErrPct = Math.round(relErr * 1000) / 10;
  const lost = Math.round((1 - cosPhi) * 100);
  const verdict = deg <= 15
    ? `Камера в плоскости движения (отклонение ${deg}°): горизонталь кадра несёт путь штанги, xLoop сравним между сессиями.`
    : deg <= 40
      ? `Камера отклонена от плоскости движения на ${deg}°: горизонталь укорочена примерно на ${lost}%, xLoop и боковые метрики занижены. `
        + 'Сравнимо внутри одной сессии, но не с боковой съёмкой.'
      : `Камера почти спереди (отклонение ${deg}°): горизонталь кадра — не путь штанги, xLoop и скорости по пути несравнимы с боковым видом.`;
  const how = axis === 'across'
    ? 'Эталон поперёк движения: видимая длина = реальная × cos φ.'
    : 'Эталон вдоль штанги: видимая длина = реальная × sin φ (сбоку такой отрезок почти не виден, поэтому он годится как контроль, а не как основной).';
  return {
    ...base,
    flag: 'ok',
    azimuthDeg: deg,
    cosPhi: Math.round(cosPhi * 10000) / 10000,
    cosPhiRelErrPct,
    reason: `${verdict} ${how} Направление «слева/справа» по одному кадру не определяется — эталон даёт только угол к плоскости.`,
  };
}

/**
 * Вход поправки горизонтали: достаточно результата замера эталона или его
 * сохранённой копии.
 *
 * Важно: сжимает горизонталь именно **cos φ**, а он равен `ratio` только для
 * эталона поперёк движения. Для эталона вдоль штанги `ratio` — это sin φ, и
 * брать его напрямую значило бы поправить наоборот. Поэтому главный вход —
 * `cosPhi`; `ratio` остаётся запасным для старых сохранённых замеров.
 */
export interface HorizontalFixInput {
  /** cos φ из замера (1 — камера в плоскости движения). Основной вход. */
  cosPhi?: number | null;
  /** observed / expected; запасной вход, если `cosPhi` нет (тогда ось — поперёк движения). */
  ratio?: number | null;
  /** Отклонение камеры от плоскости движения, град. */
  azimuthDeg: number | null;
  /** Наблюдаемая длина эталона в кадре, px: от неё зависит точность поправки. */
  spanPx?: number | null;
  /** Готовая относительная точность cos φ, % (у режима «вдоль штанги» она иная). */
  cosPhiRelErrPct?: number | null;
}

export interface ReferenceHCorrection {
  /** Значение с поправкой, см; null — поправлять нечем или нельзя. */
  correctedCm: number | null;
  /** Сколько прибавилось к измеренному, %. */
  pct: number | null;
  /** Точность поправки, % (± из точности тапа по эталону); null — не оценить. */
  errPct: number | null;
  flag: 'ok' | 'negligible' | 'refused' | 'unknown';
  reason: string;
}

/** Дальше 40° поправка > 30% и умножает ошибку тапа — честнее переснять, чем «исправлять». */
const REF_FIX_MAX_AZ = 40;
/** Одно нажатие по кадру ≈ ±1.5 px; два конца дают √2·1.5. */
const REF_TAP_PX = 1.5;

/**
 * Поправка горизонтальной метрики (xLoop, боковое смещение) на измеренный ракурс.
 *
 * Физика: при повороте камеры вокруг вертикали на φ горизонтальные расстояния в
 * кадре сжимаются в cos φ раз, вертикальные — нет. Значит истинная горизонталь
 * = измеренная / cos φ. Это ровно то же число, что «потеря горизонтали» в
 * вердикте, только в обратную сторону.
 *
 * Что важно про честность: поправка **не** делает плохую съёмку хорошей. Она
 * переносит измерение в плоскость движения с погрешностью из точности тапа и с
 * допущением, что эталон лежал ровно поперёк движения в плоскости штанги.
 * Поэтому: при поправке меньше точности тапа она не применяется (`negligible`),
 * за 40° не применяется вообще (`refused`), и везде это оценка, а не замена съёмке.
 */
export function referenceHorizontalCorrection(
  valueCm: number | null | undefined,
  ref: HorizontalFixInput | null | undefined,
  opts?: { tapPx?: number; maxAzimuthDeg?: number },
): ReferenceHCorrection {
  if (valueCm == null || !Number.isFinite(valueCm) || valueCm <= 0) {
    return {
      correctedCm: null, pct: null, errPct: null, flag: 'unknown',
      reason: 'Горизонтальной метрики нет — поправлять нечего.',
    };
  }
  const rawCos = ref == null
    ? null
    : (ref.cosPhi != null && Number.isFinite(ref.cosPhi) ? ref.cosPhi : (ref.ratio ?? null));
  if (ref == null || rawCos == null || !Number.isFinite(rawCos) || rawCos > 1.12) {
    return {
      correctedCm: null, pct: null, errPct: null, flag: 'unknown',
      reason: 'Ракурс не измерен — поправка не считается (метрика остаётся как есть).',
    };
  }
  const c = rawCos as number;
  const maxAz = opts?.maxAzimuthDeg ?? REF_FIX_MAX_AZ;
  const az = ref.azimuthDeg;
  if (!(c > 0)) {
    return {
      correctedCm: null, pct: null, errPct: null, flag: 'refused',
      reason: 'Камера почти под прямым углом к плоскости движения — горизонталь в кадре не наблюдается вовсе. '
        + 'Такой ракурс не исправляется: снимайте ближе к плоскости движения.',
    };
  }
  const spanPx = ref.spanPx;
  const tapPx = opts?.tapPx ?? REF_TAP_PX;
  const errPct = ref.cosPhiRelErrPct != null && Number.isFinite(ref.cosPhiRelErrPct)
    ? ref.cosPhiRelErrPct
    : spanPx != null && Number.isFinite(spanPx) && spanPx > 0
      ? Math.round((Math.SQRT2 * tapPx / spanPx) * 1000) / 10
      : null;
  const pct = Math.round((1 / c - 1) * 1000) / 10;
  if (az != null && Number.isFinite(az) && az > maxAz) {
    return {
      correctedCm: null, pct, errPct, flag: 'refused',
      reason: `Камера отклонена на ${Math.round(az)}° — поправка ${Math.round(pct)}% умножила бы и ошибку замера. `
        + 'Такой ракурс не исправляется: снимайте ближе к плоскости движения.',
    };
  }
  const round2 = (v: number) => Math.round(v * 100) / 100;
  if (errPct != null && Math.abs(pct) <= errPct) {
    return {
      correctedCm: round2(valueCm), pct, errPct, flag: 'negligible',
      reason: `Поправка ${pct}% не больше точности замера эталона ±${errPct}% — не применяю, значение оставлено как измерено.`,
    };
  }
  return {
    correctedCm: round2(valueCm / c),
    pct,
    errPct,
    flag: 'ok',
    reason: `Горизонталь умножена на 1/cos φ = ${round2(1 / c)} (поправка +${pct}%)`
      + (errPct != null ? `, точность ±${errPct}% — по точности тапа эталона.` : '; точность поправки не оценена (нет длины эталона в пикселях).')
      + ' Это оценка: она выравнивает сравнение между сессиями, но не заменяет съёмку в плоскости движения.',
  };
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

/** Параметры отрисовки линии поверх кадра (для тестов и предпросмотра). */
export interface FrameMappingDrawInput {
  w: number;
  h: number;
  /** Пиксели видео; множатся на `scale` при отрисовке. */
  mapped: ReadonlyArray<[number, number]>;
  /** Масштаб превью: кадр рисуется уменьшенным, координаты — те же. */
  scale?: number;
  /** Точки привязки (пиксели видео) — обводятся фиолетовым. */
  anchors?: ReadonlyArray<[number, number]>;
  /** Подпись внизу кадра («калибровка 8.2 px/см · в кадре 97%»). */
  caption?: string;
}

/**
 * Рисует линию трека поверх уже нарисованного кадра. Вынесено отдельно от canvas,
 * чтобы логику отрисовки можно было проверить без браузера.
 */
export function drawFrameWithMapping(ctx: CanvasRenderingContext2D, inp: FrameMappingDrawInput): void {
  const mapped = inp.mapped ?? [];
  if (!ctx || mapped.length < 2) return;
  const k = inp.scale && inp.scale > 0 ? inp.scale : 1;
  const w = Math.max(1, inp.w);
  const h = Math.max(1, inp.h);

  const at = (i: number): [number, number] => [mapped[i][0] * k, mapped[i][1] * k];
  const line = (color: string, width: number, from: number, to: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const [x, y] = at(i);
      if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0b0f14';
    ctx.stroke();
  };

  // Тёмный ореол: линия читается и на светлом блине, и на тёмном зале.
  line('rgba(11,15,20,0.65)', 6, 0, mapped.length - 1);
  // Одна линия цветом «быстро» — ровно как в recordVideoWithOverlay: предпросмотр
  // не должен обещать больше, чем будет в готовом файле.
  line(BAR_HEAT_COLORS.fast, 3, 0, mapped.length - 1);

  const [sx, sy] = at(0);
  const [ex, ey] = at(mapped.length - 1);
  dot(sx, sy, 4, '#e5e7eb');
  dot(ex, ey, 6, BAR_HEAT_COLORS.fast);
  for (const [ax, ay] of inp.anchors ?? []) {
    if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;
    dot(ax * k, ay * k, 7, '#a855f7');
  }

  const caption = inp.caption ?? '';
  if (caption) {
    ctx.font = '600 13px sans-serif';
    let tw = w;
    try {
      const m = ctx.measureText?.(caption);
      if (m && Number.isFinite(m.width)) tw = Math.min(w, m.width + 16);
    } catch { /* останется полная ширина */ }
    ctx.fillStyle = 'rgba(11,15,20,0.72)';
    ctx.fillRect(0, h - 24, tw, 24);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(caption, 8, h - 8);
  }
}

/** data:URL → <img>; null, если среда не декодировала картинку за отведённое время. */
function loadImage(dataUrl: string, timeoutMs = 5000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      resolve(null);
      return;
    }
    const img = document.createElement('img');
    let done = false;
    const finish = (v: HTMLImageElement | null) => { if (!done) { done = true; resolve(v); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    try { img.src = dataUrl; } catch { finish(null); }
  });
}

/**
 * Предпросмотр наложения на кадр: линия трека поверх реального кадра видео.
 *
 * Зачем: до этого калибровка и перспектива проверялись только числами (px/см,
 * невязка). Промах в тапе обнаруживался после записи всего видео. Здесь линия
 * рисуется на одном кадре — до сохранения калибровки.
 *
 * Возвращает data:URL (JPEG) или null, если canvas/кадр недоступны.
 */
export async function renderFrameWithMapping(
  frame: { dataUrl: string; width: number; height: number },
  mapped: ReadonlyArray<[number, number]>,
  opts?: Omit<FrameMappingDrawInput, 'w' | 'h' | 'mapped' | 'scale'> & { maxW?: number },
): Promise<string | null> {
  if (!canUseCanvas()) return null;
  if (!frame || typeof frame.dataUrl !== 'string' || !frame.dataUrl.startsWith('data:')) return null;
  if (!Array.isArray(mapped) || mapped.length < 2) return null;
  if (!mapped.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return null;

  const img = await loadImage(frame.dataUrl);
  if (!img) return null;
  const w0 = img.naturalWidth || img.width || frame.width;
  const h0 = img.naturalHeight || img.height || frame.height;
  if (!(w0 > 0) || !(h0 > 0)) return null;

  const k = Math.min(1, (opts?.maxW ?? 720) / w0);
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, w, h);
  } catch { return null; }

  drawFrameWithMapping(ctx, {
    w, h, mapped, scale: k,
    anchors: opts?.anchors,
    caption: opts?.caption ?? '',
  });
  try { return canvas.toDataURL('image/jpeg', 0.78); } catch { return null; }
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
 * Кадр видео: data:URL + **натуральные** размеры видео — в них измеряются тапы
 * пользователя (превью показывается масштабированным, тап пересчитывается).
 */
export interface GrabbedFrame {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Открытая сессия кадров: один `<video>` на файл и сколько угодно кадров из него.
 *
 * Зачем: `grabVideoFrame` на каждый кадр создаёт новый объект-URL и заново
 * декодирует видео. Для четырёх кадров перспективы это четыре декодирования
 * одного файла — на телефоне секунды ожидания и лишняя память.
 */
export interface VideoFrameSession {
  /**
   * Кадр на `timeSec`; без аргумента — на текущей позиции (мини-плеер).
   * `null` — если кадр не удалось взять (seek не состоялся, canvas недоступен).
   */
  grab(timeSec?: number, opts?: { maxW?: number }): Promise<GrabbedFrame | null>;
  close(): void;
}

/** Ждать событие, ошибку или таймаут: true — дождались события. */
function once(el: EventTarget, ev: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => finish(false), timeoutMs);
    function finish(ok: boolean) {
      if (timer == null) return;
      clearTimeout(timer);
      timer = null;
      el.removeEventListener(ev, onOk);
      el.removeEventListener('error', onErr);
      resolve(ok);
    }
    function onOk() { finish(true); }
    function onErr() { finish(false); }
    el.addEventListener(ev, onOk);
    el.addEventListener('error', onErr);
  });
}

/** Ширина превью кадра: дальше 480 px смысла нет — тапы по такому кадру и так точны. */
const FRAME_MAX_W = 480;

/** Текущий кадр видео → data:URL. Размеры возвращаются натуральные. */
function drawFrameFromVideo(video: HTMLVideoElement, maxW = FRAME_MAX_W): GrabbedFrame | null {
  const w0 = video.videoWidth;
  const h0 = video.videoHeight;
  if (!(w0 > 0) || !(h0 > 0)) return null;
  const k = Math.min(1, Math.max(1, maxW) / w0);
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try { ctx.drawImage(video, 0, 0, w, h); } catch { return null; }
  try {
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), width: w0, height: h0 };
  } catch { return null; }
}

/** Сессия на готовом элементе видео: seek по очереди, кадр с текущей позиции. */
function makeFrameSession(video: HTMLVideoElement, onClose: () => void): VideoFrameSession {
  let chain: Promise<unknown> = Promise.resolve();
  const grab = (timeSec?: number, opts?: { maxW?: number }): Promise<GrabbedFrame | null> => {
    const run = async (): Promise<GrabbedFrame | null> => {
      if (typeof timeSec === 'number' && Number.isFinite(timeSec) && timeSec >= 0) {
        const dur = video.duration;
        const t = Number.isFinite(dur) && dur > 0 ? Math.min(timeSec, Math.max(0, dur - 0.05)) : timeSec;
        if (Math.abs(video.currentTime - t) > 0.001) {
          // Один seek за раз: два параллельных дают кадр не с того момента.
          try { video.currentTime = t; } catch { return null; }
          if (!(await once(video, 'seeked', 6000))) return null;
        }
      }
      return drawFrameFromVideo(video, opts?.maxW);
    };
    const next = chain.then(run, run);
    chain = next.then(() => undefined, () => undefined);
    return next;
  };
  return { grab, close: onClose };
}

/**
 * Сессия кадров поверх существующего `<video>` (мини-плеер): один декодер на
 * сессию, элементы UI не трогаем — `close()` ничего не останавливает.
 */
export async function openVideoFramesFrom(
  video: HTMLVideoElement | null | undefined,
): Promise<VideoFrameSession | null> {
  if (!canUseCanvas() || !video) return null;
  if (video.readyState < 2) {
    if (!(await once(video, 'loadeddata', 8000))) return null;
  }
  if (!(video.videoWidth > 0) || !(video.videoHeight > 0)) return null;
  return makeFrameSession(video, () => { /* элемент принадлежит UI */ });
}

/** Сессия кадров по файлу: свой скрытый `<video>`, `close()` освобождает URL. */
export async function openVideoFrames(
  file: Blob,
  opts?: { maxW?: number },
): Promise<VideoFrameSession | null> {
  if (!canUseCanvas() || !file || typeof document === 'undefined') return null;
  const URLRef = (globalThis as unknown as { URL?: typeof URL }).URL;
  if (!URLRef || typeof URLRef.createObjectURL !== 'function') return null;
  let url: string;
  try { url = URLRef.createObjectURL(file); } catch { return null; }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  const inner = await openVideoFramesFrom(video);
  if (!inner) {
    try { URLRef.revokeObjectURL(url); } catch { /* уже освобождён */ }
    return null;
  }
  return {
    grab: (timeSec?: number, o?: { maxW?: number }) => inner.grab(timeSec, { maxW: o?.maxW ?? opts?.maxW }),
    close: () => {
      try { video.pause(); } catch { /* уже остановлено */ }
      try { video.removeAttribute('src'); video.load(); } catch { /* элемент вне DOM */ }
      try { URLRef.revokeObjectURL(url); } catch { /* уже освобождён */ }
    },
  };
}

/**
 * Кадр видео как data:URL — по нему пользователь тыкает в штангу для калибровки.
 * Разовая операция: открывает сессию и сразу закрывает. Если кадров нужно много —
 * держите сессию `openVideoFrames`, иначе файл декодируется заново на каждый кадр.
 * Возвращает null, если видео не декодировалось или canvas недоступен.
 */
export async function grabVideoFrame(
  file: Blob,
  opts?: { timeSec?: number; maxW?: number },
): Promise<GrabbedFrame | null> {
  const session = await openVideoFrames(file, { maxW: opts?.maxW });
  if (!session) return null;
  try {
    return await session.grab(opts?.timeSec ?? 0);
  } finally {
    session.close();
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
      // Строка ракурса: видео тоже пересылают отдельно от отчёта, и цифра без
      // оговорки читается как приговор технике.
      if (inp.angleText?.trim()) {
        ctx.fillStyle = inp.angleText.trim().startsWith('⚠') ? '#fbbf24' : '#9ca3af';
        ctx.font = '500 12px sans-serif';
        ctx.fillText(fitText(ctx, inp.angleText.trim(), w - 24), 12, h - 46);
      }
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
