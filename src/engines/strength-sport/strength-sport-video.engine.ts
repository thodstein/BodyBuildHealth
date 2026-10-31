/**
 * strength-sport-video.engine.ts — VIDEO / WEARABLES ABSTRACTION для ТА
 *
 * Полевая методика Ang 2023: loadsol insoles + Kinovea (free) → GRF + бар траектория → power
 * Chavda 2024 Enode: вертикаль валидна (r²=0.99), горизонталь bias → correction
 * PAAH 2024: IMU Wearnotch 100Hz Madgwick, 5 сегментов, r=0.99 vs optical
 *
 * Абстракция: BarTracker, ForceProvider, PoseProvider — легко мокать и менять драйвер.
 * Хранение: локально как JSON, импорт CSV Kinovea.
 */

export interface BarPoint { x: number; y: number; t: number; } // x горизонтальная (см от вертикали), y высота (см)

export interface BarTrackingResult {
  points: BarPoint[];
  fps: number;
  yMax: number;
  xLoop: number;
  vmax: number;
  hAcc: number; // высота на vmax (для FvR2 hAcc)
  duration: number;
  /** V4-PROv4: знаковое латеральное смещение (среднее x − старт x, см): + вправо, − влево. Питает персист асимметрии. */
  xBias: number;
  /** V5-П2: длительность turnover, мс (vmax→vmin); null — падения после пика нет. */
  turnoverMs: number | null;
  /** V5-V8: качество съёмки замера (Shah 2026). Старые записи без поля — 'unknown'. */
  quality?: 'ok' | 'rough' | 'unknown';
}

export interface TrackingProvider {
  name: string;
  trackVideo(file: File | string): Promise<BarTrackingResult>;
  trackFromCSV(csvText: string): BarTrackingResult | null; // Kinovea CSV
}

// Kinovea CSV parser — PRO: поддерживает Frame/Time(s)/X/Y, ; vs ,, mm/cm, TopLeft инверсия, 30/60fps
export function parseKinoveaCSV(csv: string): BarPoint[] | null {
  if (!csv || typeof csv !== 'string') return null;
  const lines = csv.trim().split(/\r?\n/).map(s=> s.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  // авто-детект разделителя: ; преобладает → ; иначе ,
  const semi = (lines[0].match(/;/g)||[]).length;
  const comm = (lines[0].match(/,/g)||[]).length;
  const delim = semi > comm ? ';' : ',';
  const header = lines[0].toLowerCase();
  // индексы колонок
  const cols = header.split(delim).map(s=> s.trim().toLowerCase());
  let idxFrame = cols.findIndex(c=> c.includes('frame'));
  let idxTime = cols.findIndex(c=> c.includes('time') || c==='t' || c.includes(' t '));
  let idxX = cols.findIndex(c=> c === 'x' || c.includes(' x ') || c.startsWith('x ') || c.endsWith(' x') || c.includes('x ('));
  let idxY = cols.findIndex(c=> c === 'y' || c.includes(' y ') || c.startsWith('y ') || c.endsWith(' y') || c.includes('y ('));
  // fallback если заголовок не распознан: предполагаем time,x,y или x,y
  const hasHeader = cols.some(c=> c.includes('time')||c.includes('frame')||c==='x'||c==='y'||c.includes('x (')||c.includes('y ('));
  if (!hasHeader || (idxX<0 && idxY<0)) {
    idxTime = 0; idxX = 1; idxY = 2;
    // если только 2 колонки — нет time
    if (lines[1].split(delim).length===2) { idxTime = -1; idxX = 0; idxY = 1; }
  } else {
    if (idxX<0) idxX = 1;
    if (idxY<0) idxY = 2;
    if (idxTime<0 && idxFrame<0 && cols.length===2) { idxTime = -1; }
  }
  const pts: BarPoint[] = [];
  // fps эвристика: если есть frame → fps 30 или 60 (попробуем 30, можно 60 по dt)
  // для детекта fps посчитаем dt из time если есть
  let fps = 30;
  // вторая фаза: парсим точки; также собираем raw для инверсии Y и mm детекта
  const raw: Array<{ t:number; x:number; y:number }> = [];
  for (let i = (hasHeader?1:0); i < lines.length; i++) {
    const parts = lines[i].split(delim).map(s=> s.trim());
    if (parts.length < 2) continue;
    // пропуск строк с заголовком внутри
    if (parts[0].toLowerCase().includes('frame') || parts[0].toLowerCase().includes('time')) continue;
    let t: number, x: number, y: number;
    if (idxTime >=0 && parts.length > Math.max(idxTime, idxX, idxY)) {
      t = parseFloat(parts[idxTime]); x = parseFloat(parts[idxX]); y = parseFloat(parts[idxY]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!Number.isFinite(t)) t = idxFrame>=0 && Number.isFinite(parseFloat(parts[idxFrame])) ? parseFloat(parts[idxFrame])/30 : i*0.033;
      // если t кажется кадром (>100), делим на fps
      if (t > 100 && idxTime===idxFrame) t = t/30;
    } else if (parts.length===2) {
      x = parseFloat(parts[0]); y = parseFloat(parts[1]); t = i*0.033;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    } else {
      // generic 3-колонки без header
      t = parseFloat(parts[0]); x = parseFloat(parts[1]); y = parseFloat(parts[2]);
      if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (t > 100) t = t/30;
    }
    raw.push({ t, x, y });
  }
  if (raw.length < 2) return null;
  // mm vs cm: если медианный |x| >50 → мм, делим на 10
  const xsAbs = raw.map(r=> Math.abs(r.x)).filter(v=> Number.isFinite(v));
  const medianAbs = xsAbs.sort((a,b)=>a-b)[Math.floor(xsAbs.length/2)] || 0;
  const isMm = medianAbs > 50 || Math.max(...raw.map(r=> Math.abs(r.y))) > 200;
  if (isMm) raw.forEach(r=> { r.x/=10; r.y/=10; });
  // Top-left инверсия: Kinovea Y вниз; инвертируем чтобы высота вверх. Детект: если Y уменьшается к концу (бар падает) — уже ок? Проще: инвертируем если maxY в начале меньше чем в конце? Kinovea Y растёт вниз, поэтому yMin=top, yMax=bottom. Нам нужно y=height, поэтому y' = -y или maxY - y.
  // Применяем y' = -y (сохраняет xLoop), но для yMax корректируем: yHeight = -y + const. Проще: yHeight = -y
  // Сначала найдём диапазон y
  const rawYs = raw.map(r=> r.y);
  const yMin = Math.min(...rawYs), yMaxR = Math.max(...rawYs);
  // если y увеличивается со временем в первой половине (бар идёт вверх, но Kinovea y вниз) → инверсия уже? Проверим: первая точка y ~ high (t0), середина y ~ low (высокий полёт)?? У Kinovea Y вниз: внизу экрана y большой, вверху маленький. Бар внизу → y большой, вверху → y маленький — Y уменьшается при подъёме. У нас ожидается наоборот. Поэтому инвертируем: y' = (yMaxR - y) или -y.
  // Используем y' = yMaxR - y + yMin  → чтобы min → 0
  const needsInvert = (()=> {
    // эвристика: если y в середине меньше чем в начале (подъём) — Kinovea mode, надо инвертировать
    const mid = raw[Math.floor(raw.length/2)]?.y ?? rawYs[0];
    return mid < rawYs[0] && rawYs[0] - mid > 5; // >5см разница
  })();
  for (const r of raw) {
    let yHeight = r.y;
    if (needsInvert) yHeight = (yMaxR - r.y);
    pts.push({ x: r.x, y: yHeight, t: r.t });
  }
  // Сортируем по t и нормализуем t к 0
  pts.sort((a,b)=> a.t - b.t);
  const t0 = pts[0].t;
  pts.forEach(p=> p.t -= t0);
  // Уточняем fps по dt медиане
  const dts = pts.slice(1).map((p,i)=> p.t - pts[i].t).filter(dt=> dt>0 && dt<0.2);
  if (dts.length) {
    const medDt = dts.sort((a,b)=>a-b)[Math.floor(dts.length/2)];
    if (medDt>0.015 && medDt<0.04) fps = Math.round(1/medDt);
    else if (medDt>0.05) fps = 30;
  }
  return pts.length >= 2 ? pts : null;
}

// 12Hz Butterworth low-pass (1st order, fs ~30-60) — single pole, щадящий чтобы не резать yMax >15% (PLOS 80см→68см было)
function butterworth12Hz(points: BarPoint[], fps = 30): BarPoint[] {
  if (!points || points.length < 3) return points;
  const fc = 12; const dt = 1/fps;
  const RC = 1/(2*Math.PI*fc);
  const alpha = dt/(RC+dt); // ~0.71 при 30fps
  const out: BarPoint[] = [];
  let prevX = points[0].x, prevY = points[0].y;
  for (let i=0;i<points.length;i++) {
    const rawX = points[i].x, rawY = points[i].y;
    const fX = prevX + alpha*(rawX - prevX);
    const fY = prevY + alpha*(rawY - prevY);
    out.push({ x: fX, y: fY, t: points[i].t });
    prevX = fX; prevY = fY;
  }
  return out;
}

export function analyzeBarTracking(points: BarPoint[], meta?: VideoCaptureMeta): BarTrackingResult | null {
  if (!points || points.length < 2) return null;
  const fps = (()=> {
    const dts = points.slice(1).map((p,i)=> p.t - points[i].t).filter(dt=>dt>0&&dt<0.2);
    if (!dts.length) return 30;
    const med = dts.sort((a,b)=>a-b)[Math.floor(dts.length/2)];
    return med>0? Math.round(1/med):30;
  })();
  const filtered = butterworth12Hz(points, fps);
  const xs = filtered.map(p => p.x);
  const ys = filtered.map(p => p.y);
  const yMax = Math.max(...points.map(p=> p.y));
  const xLoop = Math.max(...xs) - Math.min(...xs);
  let vmax = 0;
  let hAcc = yMax;
  // vmax: дифференцирование y по t, butterworth уже сгладил, затем MA3
  const vels: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const dt = filtered[i].t - filtered[i - 1].t;
    if (dt <= 0) continue;
    const v = (filtered[i].y - filtered[i - 1].y) / dt / 100; // см/с → м/с
    vels.push(v);
  }
  // MA3
  const smooth: number[] = [];
  for (let i=0;i<vels.length;i++) {
    const w = [vels[i-1], vels[i], vels[i+1]].filter(v=> Number.isFinite(v)) as number[];
    smooth.push(w.reduce((a,b)=>a+b,0)/w.length);
  }
  for (let i=0;i<smooth.length;i++) {
    const v = smooth[i];
    if (v > vmax) { vmax = v; hAcc = filtered[i+1].y / 100; }
  }
  // индекс пика — до округления (сглаженный ряд может не достать до round(vmax))
  let iMax = -1;
  for (let i = 0; i < smooth.length; i++) {
    if (iMax < 0 || smooth[i] > smooth[iMax]) iMax = i;
  }
  if (vmax <= 0) iMax = -1;
  vmax = Math.round(vmax * 100) / 100;
  // V5-П2: длительность turnover — время от пика скорости до макс. скорости
  // падения (vmin после vmax). Нет падения после пика → null (не гадаем).
  let turnoverMs: number | null = null;
  try {
    if (iMax >= 0) {
      let vmin = Infinity;
      let iMin = -1;
      for (let i = iMax + 1; i < smooth.length; i++) {
        if (smooth[i] < vmin) { vmin = smooth[i]; iMin = i; }
      }
      if (iMin > iMax && vmin < 0) {
        const dt = filtered[iMin + 1].t - filtered[iMax + 1].t;
        if (Number.isFinite(dt) && dt > 0 && dt < 3) turnoverMs = Math.round(dt * 1000);
      }
    }
  } catch { turnoverMs = null; }
  const duration = filtered[filtered.length - 1].t - filtered[0].t;
  hAcc = Math.round(hAcc * 100) / 100;
  if (hAcc <= 0.2) hAcc = 0.8;
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const xBias = Math.round((xMean - xs[0]) * 10) / 10;
  // Качество съёмки: заполняем объявленное поле, если хаб передал параметры захвата.
  const quality: BarTrackingResult['quality'] = meta ? videoQualityForCapture(meta).flag : 'unknown';
  return { points: filtered, fps, yMax: Math.round(yMax), xLoop: Math.round(xLoop * 10) / 10, vmax, hAcc, duration: Math.round(duration * 100) / 100, xBias, turnoverMs, quality };
}

// ── Overlay повторов (P1 #11): нарезка одной траектории на повторы ──────────

/** Один повтор, вырезанный из траектории по вертикальным экстремумам. */
export interface BarRepSegment {
  /** 1-based номер повтора в серии. */
  index: number;
  /** Точки этого повтора (сглаженные, как в основном анализе). */
  points: BarPoint[];
  startT: number;
  endT: number;
  /** Амплитуда вертикали внутри повтора (max y − min y), см. */
  amplitude: number;
  yMax: number;
  yMin: number;
  xLoop: number;
  vmax: number;
  xBias: number;
  durationMs: number;
  /** Номер подхода внутри тренировки (1-based). Не задан → считается первый подход. */
  setIndex?: number;
}

/**
 * Режет траекторию штанги на повторы: повтор = путь от нижней точки к верхней.
 * Kinovea обычно отдаёт одну серию, поэтому «первый vs последний повтор» без
 * нарезки посчитать нельзя. Возвращает [] если движения слишком мало или
 * повтор один — тогда overlay честно недоступен.
 */
export function segmentBarReps(
  points: BarPoint[],
  opts?: { minProminenceCm?: number; minRepMs?: number },
): BarRepSegment[] {
  if (!Array.isArray(points) || points.length < 8) return [];
  const fps = (() => {
    const dts = points.slice(1).map((p, i) => p.t - points[i].t).filter(dt => dt > 0 && dt < 0.2);
    if (!dts.length) return 30;
    const med = dts.sort((a, b) => a - b)[Math.floor(dts.length / 2)];
    return med > 0 ? Math.round(1 / med) : 30;
  })();
  const filtered = butterworth12Hz(points, fps);
  const ys = filtered.map(p => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo;
  if (!(span > 2)) return [];
  const prom = opts?.minProminenceCm ?? Math.max(2, Math.min(span * 0.25, 8));
  const minRepMs = opts?.minRepMs ?? 250;

  // Кандидаты в экстремумы: локальные min/max в окне ±0.35 с с перепадом ≥ prom.
  // Привязка к окну, а не к общему диапазону: иначе «уставший» повтор с меньшей
  // амплитудой (напр. 30 см в серии 40/40/30) не считался бы повтором вовсе.
  const w = Math.max(2, Math.round(fps * 0.35));
  const bottomsRaw: number[] = [];
  const topsRaw: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    const a = Math.max(0, i - w);
    const b = Math.min(ys.length - 1, i + w);
    let maxV = -Infinity;
    let minV = Infinity;
    for (let j = a; j <= b; j++) {
      if (ys[j] > maxV) maxV = ys[j];
      if (ys[j] < minV) minV = ys[j];
    }
    if (maxV - minV < prom) continue;
    if (ys[i] >= maxV - 1e-9) topsRaw.push(i);
    if (ys[i] <= minV + 1e-9) bottomsRaw.push(i);
  }
  // Плато/дребезг у края: склеиваем близкие кандидаты, оставляя самый крайний.
  const collapse = (idx: number[], pick: 'min' | 'max'): number[] => {
    const out: number[] = [];
    for (const i of idx) {
      const last = out[out.length - 1];
      if (last != null && i - last <= Math.max(3, Math.round(fps * 0.3))) {
        if ((pick === 'min' && ys[i] < ys[last]) || (pick === 'max' && ys[i] > ys[last])) out[out.length - 1] = i;
      } else out.push(i);
    }
    return out;
  };
  const bottoms = collapse(bottomsRaw, 'min');
  const tops = collapse(topsRaw, 'max');

  // Повтор = ближайший верх после низа. Верх без предшествующего низа не повтор.
  const pairs: Array<[number, number]> = [];
  let pendingBottom: number | null = null;
  const events = [
    ...bottoms.map(i => ({ i, kind: 'b' as const })),
    ...tops.map(i => ({ i, kind: 't' as const })),
  ].sort((a, b) => a.i - b.i);
  for (const ev of events) {
    if (ev.kind === 'b') { pendingBottom = ev.i; continue; }
    if (pendingBottom == null) continue;
    pairs.push([pendingBottom, ev.i]);
    pendingBottom = null;
  }

  const reps: BarRepSegment[] = [];
  for (const [a, b] of pairs) {
    const amplitude = Math.round((ys[b] - ys[a]) * 10) / 10;
    if (amplitude < prom) continue;
    const durationMs = Math.round((points[b].t - points[a].t) * 1000);
    if (!(durationMs >= minRepMs)) continue;
    const slice = points.slice(a, b + 1);
    const m = analyzeBarTracking(slice);
    if (!m) continue;
    reps.push({
      index: reps.length + 1,
      points: m.points,
      startT: Math.round(points[a].t * 100) / 100,
      endT: Math.round(points[b].t * 100) / 100,
      amplitude,
      yMax: Math.round(Math.max(...ys.slice(a, b + 1))),
      yMin: Math.round(Math.min(...ys.slice(a, b + 1))),
      xLoop: m.xLoop,
      vmax: m.vmax,
      xBias: m.xBias,
      durationMs,
    });
  }
  return reps;
}

/** Сводка overlay «первый vs последний повтор». null — повторов меньше двух. */
export interface BarRepOverlay {
  reps: number;
  first: BarRepSegment;
  last: BarRepSegment;
  /** Изменение vmax первого→последнего повтора, %: отрицательное = потеря скорости. */
  velocityLossPct: number;
  xLoopDeltaCm: number;
  amplitudeDeltaCm: number;
  verdict: 'ok' | 'warn' | 'crit';
  text: string;
}

export function barRepOverlay(reps: BarRepSegment[]): BarRepOverlay | null {
  if (!Array.isArray(reps) || reps.length < 2) return null;
  const first = reps[0];
  const last = reps[reps.length - 1];
  const v0 = first.vmax;
  const v1 = last.vmax;
  const velocityLossPct = v0 > 0 ? Math.round(((v1 - v0) / v0) * 100) : 0;
  const verdict: BarRepOverlay['verdict'] =
    v0 > 0 && velocityLossPct <= -25 ? 'crit' : v0 > 0 && velocityLossPct <= -15 ? 'warn' : 'ok';
  const xLoopDeltaCm = Math.round((last.xLoop - first.xLoop) * 10) / 10;
  const amplitudeDeltaCm = Math.round((last.amplitude - first.amplitude) * 10) / 10;
  const verdictText =
    verdict === 'crit' ? 'критическая потеря скорости' : verdict === 'warn' ? 'заметная потеря скорости' : 'скорость держится';
  const sign = (n: number) => (n > 0 ? '+' : '');
  return {
    reps: reps.length,
    first,
    last,
    velocityLossPct,
    xLoopDeltaCm,
    amplitudeDeltaCm,
    verdict,
    text:
      `Повторы: ${reps.length} · vmax ${v0.toFixed(2)}→${v1.toFixed(2)} м/с (${sign(velocityLossPct)}${velocityLossPct}%)` +
      ` · xLoop ${first.xLoop}→${last.xLoop} см (${sign(xLoopDeltaCm)}${xLoopDeltaCm})` +
      ` · амплитуда ${first.amplitude}→${last.amplitude} см (${sign(amplitudeDeltaCm)}${amplitudeDeltaCm})` +
      ` → ${verdictText}`,
  };
}

// Force provider abstraction (loadsol insoles, force plate)
export interface ForceSample { t: number; leftN: number; rightN: number; totalN: number; }export interface ForceProvider {
  name: string;
  getSamples(): ForceSample[];
  getPeakForce(): number;
  getMeanForce(): number;
}

// Pose provider abstraction (BlazePose / MediaPipe / Wearnotch IMU)
export interface JointAngles { hip?: number; knee?: number; ankle?: number; shoulder?: number; elbow?: number; trunk?: number; ts: number; }
export interface PoseProvider {
  name: string;
  getAngles(): JointAngles[];
  getOHSScore(): number | null;
}

// Carry sway diagnosis for strongman (lateral displacement из видео сбоку)
export interface CarrySwayResult {
  swayCm: number;
  severity: 'ok' | 'warn' | 'critical';
  isReal: boolean;
  text: string;
}
export function diagnoseCarrySway(swayCm: number): CarrySwayResult {
  if (swayCm > 5) return { swayCm, severity: 'critical', isReal: true, text: `Sway ${swayCm}см >5см — критично` };
  if (swayCm > 3) return { swayCm, severity: 'warn', isReal: true, text: `Sway ${swayCm}см >3см — внимание` };
  return { swayCm, severity: 'ok', isReal: false, text: `Sway ${swayCm}см — норма` };
}
export function carrySwayFromPoints(points: BarPoint[]): number {
  if (!points || points.length < 2) return 0;
  const xs = points.map(p => p.x);
  return Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
}

// Simple local storage for tracking results (для трендов)
const LS_KEY_BAR = 'he_ta_bar_tracking_v1';

export function saveBarTracking(result: BarTrackingResult): void {
  try {
    const raw = localStorage.getItem(LS_KEY_BAR);
    const arr: BarTrackingResult[] = raw ? JSON.parse(raw) : [];
    arr.push({ ...result, points: result.points.slice(0, 20) }); // кап точек
    while (arr.length > 20) arr.shift();
    localStorage.setItem(LS_KEY_BAR, JSON.stringify(arr));
  } catch {}
}

export function loadBarTracking(): BarTrackingResult[] {
  try {
    const raw = localStorage.getItem(LS_KEY_BAR);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function clearBarTracking(): void {
  try { localStorage.removeItem(LS_KEY_BAR); } catch {}
}

/**
 * W4 PRO-v3: качество съёмки для xLoop (Shah et al. 2026, ISACE 2025 —
 * CV-трекинг требует коррекции перспективных искажений: высота/дистанция
 * камеры; вид строго сбоку, иначе горизонталь несравнима).
 */
export type VideoSide = 'left' | 'front' | 'right';
export type VideoDevice = 'kinovea' | 'enode' | 'phone';

export interface VideoCaptureMeta {
  heightM?: number | null; // высота камеры над помостом
  distM?: number | null; // дистанция до штанги
  side?: VideoSide | '' | null;
  device?: VideoDevice | '' | null;
}

export interface VideoQuality {
  flag: 'ok' | 'rough' | 'unknown';
  reason: string;
}

/** Флаг качества съёмки: без метаданных — unknown; фронт/кривая перспектива — rough. */
export function videoQualityForCapture(meta: VideoCaptureMeta): VideoQuality {
  const h = meta.heightM, d = meta.distM;
  const hasH = h != null && Number.isFinite(h) && h > 0;
  const hasD = d != null && Number.isFinite(d) && d > 0;
  if (!hasH && !hasD && !meta.side) return { flag: 'unknown', reason: 'Нет метаданных съёмки — xLoop сравнивай только внутри одной серии.' };
  if (meta.side === 'front') return { flag: 'rough', reason: 'Вид спереди: горизонталь xLoop несравнима — снимай строго сбоку (Shah 2026).' };
  if (hasH && (h as number) > 2.5) return { flag: 'rough', reason: `Камера высоко (${h}м): перспектива завышает xLoop — опускай до 1–1.5м.` };
  if (hasD && ((d as number) > 8 || (d as number) < 2)) return { flag: 'rough', reason: `Дистанция ${d}м вне 2–8м: перспективные искажения xLoop.` };
  return { flag: 'ok', reason: 'Геометрия съёмки в допуске — xLoop сравним.' };
}

/**
 * Heatmapping траектории по скорости (gap #11): каждый отрезок между соседними
 * точками красится по скорости (см/с), а не вся линия одним цветом.
 * Границы — по перцентилям самой серии, а не абсолютные м/с: разные лифты и
 * разные масштабы съёмки дают разный диапазон, поэтому «быстро» = верхняя треть.
 */
export interface BarHeatSegment {
  x1: number; y1: number; x2: number; y2: number;
  /** Скорость отрезка, см/с. */
  speed: number;
  level: 'slow' | 'mid' | 'fast';
}

export function barSpeedHeat(points: BarPoint[], opts?: { slowPct?: number; fastPct?: number }): BarHeatSegment[] {
  if (!Array.isArray(points) || points.length < 2) return [];
  const slowPct = opts?.slowPct ?? 0.33;
  const fastPct = opts?.fastPct ?? 0.66;
  const raw: Array<{ x1: number; y1: number; x2: number; y2: number; speed: number }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = b.t - a.t;
    // Без валидного времени скорость не выдумываем — отрезок пропускаем.
    if (!Number.isFinite(dt) || dt <= 0) continue;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const speed = dist / dt;
    if (!Number.isFinite(speed)) continue;
    raw.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, speed: Math.round(speed * 10) / 10 });
  }
  if (!raw.length) return [];
  const sorted = raw.map(r => r.speed).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  const lo = q(slowPct);
  const hi = q(fastPct);
  return raw.map(r => ({
    ...r,
    level: r.speed <= lo ? 'slow' : r.speed >= hi ? 'fast' : 'mid',
  }));
}

/** Цвета heatmap: медленно (срыв) — красный, середина — жёлтый, быстро — зелёный. */
export const BAR_HEAT_COLORS: Record<BarHeatSegment['level'], string> = {
  slow: '#f87171',
  mid: '#fbbf24',
  fast: '#00e68a',
};

/** Компактное представление повтора для персиста (точи → массив [x,y] с прореживанием). */
export interface BarRepSnapshot {
  index: number;
  vmax: number;
  xLoop: number;
  amplitude: number;
  /** Прореженные точки: [[x,y], …] (не больше maxPoints). */
  points: Array<[number, number]>;
  /** Номер подхода внутри тренировки (1-based), если размечен. */
  setIndex?: number;
}

/** Прореживает повтор до maxPoints так, чтобы сохранить форму траектории (равномерно по индексу). */
export function snapshotBarRep(rep: BarRepSegment, maxPoints = 24): BarRepSnapshot {
  const src = rep.points ?? [];
  const n = Math.max(0, Math.min(maxPoints, src.length));
  const points: Array<[number, number]> = [];
  if (n === 1) points.push([Math.round(src[0].x * 10) / 10, Math.round(src[0].y * 10) / 10]);
  else if (n > 1) {
    for (let i = 0; i < n; i++) {
      const p = src[Math.round((i * (src.length - 1)) / (n - 1))];
      points.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
    }
  }
  return {
    index: rep.index,
    vmax: Math.round(rep.vmax * 100) / 100,
    xLoop: Math.round(rep.xLoop * 10) / 10,
    amplitude: Math.round(rep.amplitude * 10) / 10,
    points,
    ...(rep.setIndex && rep.setIndex > 0 ? { setIndex: Math.round(rep.setIndex) } : {}),
  };
}

/** Сравнение «прошлая сессия vs текущая» по одноимённым повторам (обычно первый vs первый). */
export interface BarSessionCompare {
  /** vmax прошлой сессии (первый повтор), м/с. */
  prevVmax: number;
  /** vmax текущей сессии (первый повтор), м/с. */
  curVmax: number;
  /** Δvmax, %: отрицательное — скорость упала (усталость/форма). */
  deltaPct: number;
  deltaXLoopCm: number;
  deltaAmplitudeCm: number;
  verdict: 'better' | 'same' | 'worse';
  text: string;
}

export function compareBarSessions(prev: BarRepSnapshot | null | undefined, cur: BarRepSnapshot | null | undefined): BarSessionCompare | null {
  if (!prev || !cur) return null;
  if (!(prev.vmax > 0) || !(cur.vmax > 0)) return null;
  const deltaPct = Math.round(((cur.vmax - prev.vmax) / prev.vmax) * 100);
  const deltaXLoopCm = Math.round((cur.xLoop - prev.xLoop) * 10) / 10;
  const deltaAmplitudeCm = Math.round((cur.amplitude - prev.amplitude) * 10) / 10;
  const verdict: BarSessionCompare['verdict'] = deltaPct <= -5 ? 'worse' : deltaPct >= 5 ? 'better' : 'same';
  const head = verdict === 'worse' ? 'vmax ниже прошлой сессии' : verdict === 'better' ? 'vmax выше прошлой сессии' : 'vmax на уровне прошлой сессии';
  return {
    prevVmax: prev.vmax, curVmax: cur.vmax, deltaPct, deltaXLoopCm, deltaAmplitudeCm, verdict,
    text: `${head}: ${prev.vmax.toFixed(2)} → ${cur.vmax.toFixed(2)} м/с (${deltaPct > 0 ? '+' : ''}${deltaPct}%) · xLoop ${deltaXLoopCm > 0 ? '+' : ''}${deltaXLoopCm} см`,
  };
}

/** Сводка heatmap для отчёта: доля медленных отрезков и точка срыва.
 *  Раскраска без чисел не проверяема — эти цифры едут в CSV/HTML. */
export interface HeatSummary {
  segments: number;
  /** Доля отрезков, окрашенных как «медленно», %. */
  slowPct: number;
  /** Доля отрезков «быстро», %. */
  fastPct: number;
  /** Высота (см, в координатах трекинга) самого медленного отрезка — вероятная точка срыва. */
  stickingHeightCm: number | null;
  /** Скорость на этом отрезке, см/с. */
  stickingSpeedCmS: number | null;
}

export function heatSummary(points: BarPoint[]): HeatSummary | null {
  const segs = barSpeedHeat(points);
  if (!segs.length) return null;
  const slow = segs.filter((s) => s.level === 'slow').length;
  const fast = segs.filter((s) => s.level === 'fast').length;
  let worst = segs[0];
  for (const s of segs) if (s.speed < worst.speed) worst = s;
  return {
    segments: segs.length,
    slowPct: Math.round((slow / segs.length) * 100),
    fastPct: Math.round((fast / segs.length) * 100),
    stickingHeightCm: Math.round(((worst.y1 + worst.y2) / 2) * 10) / 10,
    stickingSpeedCmS: Math.round(worst.speed * 10) / 10,
  };
}

/** Номер подхода повтора: без метки — первый подход. */
export function repSetIndex(rep: BarRepSegment): number {
  const n = Number(rep.setIndex);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

/** Статистика по подходам (для «подход vs подход», а не только повтор vs повтор). */
export interface BarSetStat {
  setIndex: number;
  reps: number;
  /** Средний vmax подхода, м/с. */
  vmaxMean: number;
  /** Минимальный vmax подхода (худший повтор), м/с. */
  vmaxMin: number;
  xLoopMean: number;
}

export function barSetStats(reps: BarRepSegment[]): BarSetStat[] {
  if (!Array.isArray(reps) || !reps.length) return [];
  const bySet = new Map<number, BarRepSegment[]>();
  for (const r of reps) {
    const key = repSetIndex(r);
    const list = bySet.get(key);
    if (list) list.push(r); else bySet.set(key, [r]);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...bySet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setIndex, list]) => ({
      setIndex,
      reps: list.length,
      vmaxMean: Math.round(mean(list.map((r) => r.vmax)) * 100) / 100,
      vmaxMin: Math.round(Math.min(...list.map((r) => r.vmax)) * 100) / 100,
      xLoopMean: Math.round(mean(list.map((r) => r.xLoop)) * 10) / 10,
    }));
}

/** Сравнение «первый подход vs последний подход» по одноимённым повторам. */
export interface BarSetOverlay {
  sets: number;
  firstSet: BarSetStat;
  lastSet: BarSetStat;
  /** Δ среднего vmax, %: минус — падение от подхода к подходу. */
  deltaPct: number;
  first: BarRepSegment;
  last: BarRepSegment;
  text: string;
}

export function barSetOverlay(reps: BarRepSegment[]): BarSetOverlay | null {
  const stats = barSetStats(reps);
  if (stats.length < 2) return null;
  const firstSet = stats[0];
  const lastSet = stats[stats.length - 1];
  const first = reps.find((r) => repSetIndex(r) === firstSet.setIndex);
  const last = reps.find((r) => repSetIndex(r) === lastSet.setIndex);
  if (!first || !last) return null;
  const deltaPct = firstSet.vmaxMean > 0
    ? Math.round(((lastSet.vmaxMean - firstSet.vmaxMean) / firstSet.vmaxMean) * 100)
    : 0;
  const head = deltaPct <= -5 ? 'скорость падает от подхода к подходу'
    : deltaPct >= 5 ? 'скорость растёт от подхода к подходу'
    : 'скорость между подходами держится';
  return {
    sets: stats.length,
    firstSet,
    lastSet,
    deltaPct,
    first,
    last,
    text: `Подходы ${stats.length}: vmax ${firstSet.vmaxMean.toFixed(2)}→${lastSet.vmaxMean.toFixed(2)} м/с `
      + `(${deltaPct > 0 ? '+' : ''}${deltaPct}%) · ${head}`,
  };
}

/** Масштаб CSV: Kinovea отдаёт сантиметры (k=1), «сырые» пиксели требуют «см на единицу». */
export function scaleBarPoints(points: BarPoint[], cmPerUnit: number): BarPoint[] {
  if (!Array.isArray(points) || !points.length) return [];
  const k = Number.isFinite(cmPerUnit) && cmPerUnit > 0 ? cmPerUnit : 1;
  if (k === 1) return points;
  return points.map((p) => ({
    t: p.t,
    x: Math.round(p.x * k * 100) / 100,
    y: Math.round(p.y * k * 100) / 100,
  }));
}

/** Индекс последней точки с t <= time (наложение оверлея на видео). -1 — пусто. */
export function pointIndexAtTime(points: ReadonlyArray<{ t: number }>, time: number): number {
  if (!Array.isArray(points) || !points.length) return -1;
  if (!Number.isFinite(time)) return points.length - 1;
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
