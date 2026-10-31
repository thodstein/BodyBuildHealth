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
 */

// Единый источник heatmapping — движок трекинга штанги (см. barSpeedHeat).
import { barSpeedHeat, BAR_HEAT_COLORS } from '../strength-sport/strength-sport-video.engine';

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
