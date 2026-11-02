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
  /**
   * Средняя скорость **концентрической фазы** (низ → верх), м/с: вертикальное
   * смещение / время. Это другая величина, чем vmax: MVT и LVP считаются по
   * средней, а пик всегда выше неё. Поле необязательное, потому что старые
   * сохранённые серии его не содержат — и выдумывать его задним числом нельзя.
   */
  vMean?: number;
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
    // Средняя скорость концентрической фазы: амплитуда (см) / время (с) → м/с.
    // Это измеренные точки, без модели: поворот камеры вокруг вертикали вертикаль
    // не искажает, поэтому величина так же устойчива к ракурсу, как vmax.
    const vMean = Math.round((amplitude / 100) / (durationMs / 1000) * 100) / 100;
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
      ...(vMean > 0 ? { vMean } : {}),
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
 * Расхождение «ракурс в параметрах» ↔ «ракурс по замеру».
 *
 * Бейдж качества съёмки и вердикт ракурса отвечают на разные вопросы, но оба
 * говорят про одно: можно ли сравнивать xLoop. Если параметры и замер спорят,
 * экран показывает две противоположные фразы, и пользователь верит зелёной.
 * Обе стороны расхождения опасны:
 * - в параметрах «спереди», а замер 8° — бракуется метрика, которая на самом
 *   деле сравнима (человек зря переснимает);
 * - в параметрах «сбоку», а замер 61° — метрика считается сравнимой, хотя она
 *   занижена (человек сравнивает разные ракурсы как разную технику).
 */
export interface SideConflict {
  kind: 'meta-front-measured-side' | 'meta-side-measured-front';
  /** Ракурс из параметров съёмки. */
  metaSide: 'front' | 'left' | 'right';
  /** Измеренный угол к плоскости движения. */
  azimuthDeg: number;
  text: string;
}

/**
 * Спор параметров и замера; null — спорить не о чем (нет данных или они согласны).
 * Порог тот же, что у вердикта: за ним камера уже не в плоскости движения.
 */
export function sideConflictCheck(
  metaSide: VideoSide | '' | null | undefined,
  azimuthDeg: number | null | undefined,
): SideConflict | null {
  if (!metaSide) return null;
  if (azimuthDeg == null || !Number.isFinite(azimuthDeg) || azimuthDeg < 0 || azimuthDeg > 90) return null;
  const deg = Math.round(azimuthDeg);
  if (metaSide === 'front' && deg <= FRONT_AZIMUTH_DEG) {
    return {
      kind: 'meta-front-measured-side',
      metaSide: 'front',
      azimuthDeg: deg,
      text: `Замер противоречит параметрам: по эталону камера в плоскости движения (${deg}°), а в параметрах указан вид спереди. `
        + 'Качество съёмки из-за этого бракует xLoop, который замер считает сравнимым. '
        + 'Укажите сторону съёмки — параметры, вердикт и отчёт станут об одном и том же.',
    };
  }
  if ((metaSide === 'left' || metaSide === 'right') && deg > FRONT_AZIMUTH_DEG) {
    return {
      kind: 'meta-side-measured-front',
      metaSide,
      azimuthDeg: deg,
      text: `Замер противоречит параметрам: по эталону камера почти спереди (${deg}°), а в параметрах указан вид сбоку. `
        + 'Качество съёмки из-за этого считает xLoop пригодным, хотя замер говорит, что он несравним со съёмкой в плоскости движения. '
        + 'Поставьте «спереди» — отчёт перестанет обещать сравнимость, которой нет.',
    };
  }
  return null;
}

/**
 * Сторона, **измеренная по порядку концов эталона**, спорит с параметрами съёмки.
 *
 * Зачем отдельно от `sideConflictCheck`: тот сверяет параметры с углом. Угол можно не
 * получить (нет длины эталона, одна привязка), а сторону — получить: она читается по
 * порядку концов вдоль оси «голова ↔ ноги». Без этой сверки экран показывает «вид
 * спереди» и одновременно замер стороны, а направление ухода честно отказывается —
 * хотя кадр доказывает, что съёмка боковая. Одна кнопка чинит параметры, и замер
 * начинает работать.
 */
export interface SideFrameConflict {
  kind: 'meta-front-measured-side' | 'meta-side-other-side';
  /** Сторона из параметров съёмки ('front' — «вид спереди»). */
  metaSide: VideoSide;
  /** Сторона, измеренная по кадру. */
  measuredSide: 'left' | 'right';
  text: string;
}

export function sideFrameConflict(
  measured: 'left' | 'right' | null | undefined,
  metaSide: VideoSide | '' | null | undefined,
): SideFrameConflict | null {
  if (!measured || !metaSide) return null;
  const ru = (s: VideoSide) => (s === 'left' ? 'слева' : s === 'right' ? 'справа' : 'спереди');
  if (metaSide === 'front') {
    return {
      kind: 'meta-front-measured-side',
      metaSide,
      measuredSide: measured,
      text: `В параметрах «вид спереди», а по кадру камера сбоку (${ru(measured)}): `
        + 'порядок концов эталона вдоль оси «голова ↔ ноги» другого ответа не даёт. '
        + '«Спереди» бракует качество съёмки и обещает, что направление ухода прочитать нельзя, — а кадр его читает. '
        + 'Поставьте сторону по кадру, чтобы параметры, вердикт и отчёт говорили об одном и том же.',
    };
  }
  if (metaSide !== measured) {
    return {
      kind: 'meta-side-other-side',
      metaSide,
      measuredSide: measured,
      text: `В параметрах камера ${ru(metaSide)}, а по порядку концов эталона — ${ru(measured)}. `
        + 'Это разные утверждения, и слова о направлении ухода опираются на параметры. '
        + 'Поставьте сторону по кадру (или поправьте параметры), чтобы отчёт и замер говорили одно.',
    };
  }
  return null;
}

/**
 * Направление ухода штанги словами: «к голове» / «вперёд».
 *
 * Зачем: в отчёте стояла голая цифра `xLoop +0.5 см`, а знак `x` — это «вправо в
 * кадре», что само по себе не значит ничего. Тренеру нужно «куда»: к голове или к
 * ногам (жим), вперёд или назад (стоя). Сама по себе длина эталона сторону не даёт
 * (укорочение — это только |φ|), но **порядок концов** поперечного эталона даёт:
 * см. `referenceSideCheck`. Здесь только перевод знака `x` в слова, поэтому вход —
 * готовая сторона камеры (из кадра или из параметров).
 *
 * Геометрия перевода «кадр → тело» — считается, а не подразумевается. Лежащий на
 * скамье головой на север, камера на его **левом** (западном) боку, смотрит на восток:
 * собственное «право» камеры указывает на юг, то есть **к ногам**. Значит при камере
 * слева изображение `+x` — это «к ногам»/«назад», а при камере справа — «к голове»/
 * «вперёд». Зеркальная запись (селфи-камера) переворачивает кадр: `mirrored` меняет
 * ответ на обратный, и об этом сказано в тексте, а не подразумевается.
 *
 * Нет стороны съёмки — нет и слова: `unknown` с причиной, а не выдуманное «вперёд».
 */
export type BarDriftDir =
  | 'toward-head'
  | 'toward-feet'
  | 'forward'
  | 'backward'
  | 'level'
  | 'unknown';

export interface BarDriftDirection {
  dir: BarDriftDir;
  /** Готовая подпись («Уход к голове (камера слева)»). */
  text: string;
  /** Порог «ухода нет», см: меньше него — это шум трекинга, а не направление. */
  thresholdCm: number;
}

/** Меньше 0.3 см по горизонтали — шум трекинга, называть направление нечестно. */
const DRIFT_LEVEL_CM = 0.3;

export interface BarDriftOptions {
  /** Порог «ухода нет», см. */
  thresholdCm?: number;
  /** Кадр зеркальный (селфи): лево/право в кадре меняются местами. */
  mirrored?: boolean;
  /** Откуда взята сторона камеры: из кадра (замер) или из параметров. Меняет формулировку. */
  sideSource?: 'frame' | 'meta';
}

export function barDriftDirection(
  xBiasCm: number | null | undefined,
  side: VideoSide | '' | null | undefined,
  lift: 'bench' | 'squat' | 'deadlift' | string,
  opts: BarDriftOptions = {},
): BarDriftDirection {
  const threshold = opts.thresholdCm != null && opts.thresholdCm > 0 ? opts.thresholdCm : DRIFT_LEVEL_CM;
  const mirrored = opts.mirrored === true;
  if (xBiasCm == null || !Number.isFinite(xBiasCm)) {
    return { dir: 'unknown', text: 'Смещения нет в данных — направление ухода не назвать.', thresholdCm: threshold };
  }
  if (Math.abs(xBiasCm) < threshold) {
    return {
      dir: 'level',
      text: `Ухода в сторону нет (|${fmtDrift(xBiasCm)}| < ${fmtDrift(threshold)} см) — штанга идёт по вертикали.`,
      thresholdCm: threshold,
    };
  }
  if (!side) {
    return {
      dir: 'unknown',
      text: 'Сторона съёмки не указана — направление ухода не назвать. Её можно измерить по кадру: '
        + 'отметьте поперечный эталон и укажите, какой конец у головы (см. эталон в кадре).',
      thresholdCm: threshold,
    };
  }
  if (side === 'front') {
    return {
      dir: 'unknown',
      text: 'Вид спереди: в кадре не видно, где голова, а где ноги (или где перед, а где зад), '
        + 'поэтому «влево/вправо» по кадру не переводится в «к голове/вперёд». Снимите сбоку — направление станет однозначным. '
        + 'Если кадр на самом деле снят сбоку, сторону можно прочитать по эталону — но тогда «вид спереди» в параметрах ошибка.',
      thresholdCm: threshold,
    };
  }
  // Камера справа → изображение +x это «к голове/вперёд» (см. геометрию выше).
  const rightSide = side === 'right';
  const posInBody = mirrored ? xBiasCm < 0 : xBiasCm > 0;
  const forward = posInBody === rightSide;
  const isBench = lift === 'bench';
  const dir: BarDriftDir = isBench ? (forward ? 'toward-head' : 'toward-feet') : (forward ? 'forward' : 'backward');
  const word = isBench ? (forward ? 'к голове' : 'к ногам') : (forward ? 'вперёд' : 'назад');
  const sideRu = side === 'left' ? 'слева' : 'справа';
  const from = opts.sideSource === 'frame' ? 'сторона измерена по кадру' : 'сторона из параметров съёмки';
  return {
    dir,
    text: `Уход ${word} (${fmtDrift(Math.abs(xBiasCm))} см; камера ${sideRu} — ${from}).`
      + (mirrored ? ' Кадр зеркальный: направление пересчитано на реальное.' : ''),
    thresholdCm: threshold,
  };
}

function fmtDrift(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/**
 * Вердикт «ракурс по замеру»: что реально видно по самой траектории.
 *
 * Видно два измеримых сигнала:
 * - `skewPct` — насколько масштаб «сантиметров» плывёт по высоте кадра (только если
 *   перспектива откалибрована): камера наклонена или снимает сверху/снизу;
 * - `driftPct` — горизонтальный ход штанги в процентах от вертикального. Это может
 *   быть и техника лифтера, и камера не перпендикулярно движению — по одному треку
 *   их не различить, поэтому вердикт так и говорит.
 *
 * Чего НЕ видно: «спереди или сбоку». Для этого в кадре нужен эталон (линейка,
 * диск, стойка известной длины). Поэтому `azimuthKnown` всегда false, а ракурс
 * остаётся ручным полем метаданных — гадать подпись было бы ложью.
 */
export interface CameraAngleCheck {
  flag: 'ok' | 'tilt' | 'drift' | 'unknown';
  /** Разброс масштаба по высоте кадра, %; null — перспектива не калибрована. */
  skewPct: number | null;
  /** Горизонтальный ход штанги, % вертикального хода; null — ход по вертикали слишком мал. */
  driftPct: number | null;
  /**
   * По какому ракурсу читается горизонталь: `side` — поперёк кадра лежит направление
   * движения штанги; `front` — горизонталь идёт вбок по телу (там уход = техника);
   * `unknown` — ракурс не указан, и тогда цифру нельзя трактовать однозначно.
   */
  basis: 'side' | 'front' | 'unknown';
  /** Пояснение по цифрам + чего по одному треку узнать нельзя. */
  reason: string;
  /**
   * Угол отклонения камеры от плоскости движения, измеренный по эталону в кадре;
   * null — эталон не указан. Это единственный способ узнать «спереди/сбоку» по
   * замеру: по одной 2D-траектории ракурс не восстанавливается.
   */
  azimuthDeg: number | null;
  /** true — ракурс измерен по эталону; false — основан на метаданных или неизвестен. */
  azimuthKnown: boolean;
}

/** Угол, после которого горизонталь кадра перестаёт быть путём штанги (почти фронт). */
const FRONT_AZIMUTH_DEG = 60;

/**
 * Убрать одиночные глюки трекера: точка, которая резко расходится с ходом соседей.
 * Порог считается по самой серии (медиана локального излома), поэтому плавный
 * уход штанги не трогается — там соседи уходят вместе с точкой, — а одна
 * «улетевшая» точка не раздувает ход и не прячет его.
 */
function dropSpikes(values: number[], k = 4, floorCm = 0.5): number[] {
  const n = values.length;
  if (n < 8) return values;
  const devAt = (i: number): number => {
    if (i === 0) return Math.abs(values[0] - (2 * values[1] - values[2]));
    if (i === n - 1) return Math.abs(values[n - 1] - (2 * values[n - 2] - values[n - 3]));
    return Math.abs(values[i] - (values[i - 1] + values[i + 1]) / 2);
  };
  const inner: number[] = [];
  for (let i = 1; i < n - 1; i++) inner.push(devAt(i));
  inner.sort((a, b) => a - b);
  const medBreak = inner[Math.floor(inner.length / 2)] ?? 0;
  // Пол сантиметра: шум самого трекера на ровном пути не должен считаться выбросом.
  const limit = Math.max(medBreak * k, floorCm);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (devAt(i) <= limit) out.push(values[i]);
  }
  return out.length >= 8 ? out : values;
}

/** Размах без `Math.max(...arr)`: на длинной серии спред в аргументы роняет стек. */
function spanOf(values: number[]): number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi >= lo ? hi - lo : 0;
}

/**
 * Разбор ракурса по замеру; null — точек слишком мало, чтобы что-то утверждать.
 *
 * `azimuthDeg` (из эталона в кадре) важнее метаданных: он измерен, а не заявлен,
 * и сразу делает трактовку горизонтали однозначной. `side` из метаданных нужен
 * как резерв, когда эталона нет: сбоку это направление движения плюс возможный
 * наклон камеры, спереди — уход штанги вбок по телу. Без обоих цифра остаётся
 * цифрой, и вердикт так и говорит, вместо того чтобы выбрать трактовку за
 * пользователя.
 */
export function cameraAngleCheck(
  points: BarPoint[],
  opts?: {
    skewPct?: number | null;
    side?: VideoSide | '' | null;
    azimuthDeg?: number | null;
    driftLimitPct?: number;
    skewLimitPct?: number;
  },
): CameraAngleCheck | null {
  if (!Array.isArray(points) || points.length < 8) return null;
  const rawX: number[] = [];
  const rawY: number[] = [];
  for (const p of points) {
    if (Number.isFinite(p?.x)) rawX.push(p.x);
    if (Number.isFinite(p?.y)) rawY.push(p.y);
  }
  if (rawX.length < 8 || rawY.length < 8) return null;
  const azRaw = opts?.azimuthDeg;
  const azimuthDeg = azRaw != null && Number.isFinite(azRaw) && azRaw >= 0 && azRaw <= 90
    ? Math.round(azRaw)
    : null;
  const azimuthKnown = azimuthDeg != null;
  // Измеренный ракурс перекрывает метаданные: он не «заявлен», а получен из кадра.
  const basis: CameraAngleCheck['basis'] = azimuthKnown
    ? (azimuthDeg! > FRONT_AZIMUTH_DEG ? 'front' : 'side')
    : opts?.side === 'front' ? 'front' : opts?.side === 'left' || opts?.side === 'right' ? 'side' : 'unknown';
  const skewLimit = opts?.skewLimitPct ?? 3;
  const driftLimit = opts?.driftLimitPct ?? 20;
  const skewRaw = opts?.skewPct;
  const skewPct = skewRaw != null && Number.isFinite(skewRaw) && skewRaw >= 0
    ? Math.round(skewRaw * 10) / 10
    : null;
  const caveat = azimuthKnown
    ? ` Ракурс измерен по эталону в кадре: камера отклонена от плоскости движения на ${azimuthDeg}°.`
      + ' Направление «слева/справа» по одному кадру не определяется.'
    : basis === 'unknown'
      ? ' Ракурс «спереди/сбоку» по одной траектории не определяется — укажите эталон в кадре (или ракурс в метаданных съёмки), иначе горизонталь не трактовать.'
      : ' Ракурс «спереди/сбоку» по одной траектории не определяется — он взят из метаданных съёмки, а не измерен.';
  const ySpan = spanOf(dropSpikes(rawY));
  if (!(ySpan > 2)) {
    return {
      flag: 'unknown', skewPct, driftPct: null, basis, azimuthDeg, azimuthKnown,
      reason: 'Ход штанги по вертикали меньше 2 см — ракурс по такому треку не проверить.' + caveat,
    };
  }
  const xSpan = spanOf(dropSpikes(rawX));
  const driftPct = Math.round((xSpan / ySpan) * 1000) / 10;
  if (skewPct != null && skewPct > skewLimit) {
    return {
      flag: 'tilt', skewPct, driftPct, basis, azimuthDeg, azimuthKnown,
      reason: `Масштаб по высоте кадра плывёт на ${skewPct}% (порог ${skewLimit}%): камера наклонена или снимает сверху/снизу, `
        + 'сантиметры вверху и внизу разные. Включите перспективу по 4 кадрам, иначе высоты и скорости по траектории искажены.' + caveat,
    };
  }
  if (driftPct > driftLimit) {
    const driftReason = basis === 'front'
      ? `Штанга уходит вбок на ${driftPct}% хода (порог ${driftLimit}%). При виде спереди это боковой уход штанги — `
        + 'сигнал техники, а не наклона камеры. Для xLoop и скоростей снимайте строго сбоку.'
      : azimuthKnown
        ? `Штанга уходит по горизонтали на ${driftPct}% вертикального хода (порог ${driftLimit}%). `
          + `Ракурс измерен: камера в плоскости движения (отклонение ${azimuthDeg}°), значит это не оптический обман камеры, `
          + 'а техника — штанга действительно гуляет вбок. Смотрите отведение/увод, а не ракурс.'
        : basis === 'side'
          ? `Штанга уходит по горизонтали на ${driftPct}% вертикального хода (порог ${driftLimit}%): `
            + 'это либо техника — штанга действительно гуляет, либо камера стоит не перпендикулярно движению. '
            + 'По одному треку их не различить — укажите эталон в кадре, чтобы измерить угол, или переснимите строго сбоку.'
          : `Штанга уходит по горизонтали на ${driftPct}% вертикального хода (порог ${driftLimit}%), но ракурс не измерен: `
            + 'непонятно, это вбок по телу (техника) или путь уходит вглубь кадра (камера не перпендикулярна движению). '
            + 'По одной траектории «спереди/сбоку» не определить — укажите эталон в кадре, и вердикт станет однозначным.';
    return {
      flag: 'drift', skewPct, driftPct, basis, azimuthDeg, azimuthKnown,
      reason: driftReason + (basis === 'unknown' && !azimuthKnown ? '' : caveat),
    };
  }
  return {
    flag: 'ok', skewPct, driftPct, basis, azimuthDeg, azimuthKnown,
    reason: (skewPct != null
      ? `Геометрия ровная: горизонтальный ход ${driftPct}%, разброс масштаба по высоте ${skewPct}% — метрики сравнимы между сессиями.`
      : `Горизонтальный ход ${driftPct}% в пределах нормы, но перспектива не калибрована: разброс масштаба по высоте не проверен.`) + caveat,
  };
}

/**
 * Компактная строка ракурса для картинки (SVG/подпись): в отчёте есть полный
 * вердикт, а на кадре нужно коротко и с той же оговоркой — картинку пересылают
 * отдельно от отчёта, и цифра без предупреждения читается как приговор технике.
 */
export function cameraAngleShortLine(c: CameraAngleCheck | null): string | null {
  if (!c) return null;
  if (c.flag === 'unknown') return 'ракурс не проверен: ход по вертикали < 2 см';
  const parts: string[] = [];
  if (c.azimuthDeg != null) parts.push(`камера ${c.azimuthDeg}°`);
  if (c.driftPct != null) parts.push(`${c.basis === 'front' ? 'уход вбок' : 'ход'} ${c.driftPct}%`);
  if (c.skewPct != null) parts.push(`масштаб по высоте ${c.skewPct}%`);
  const what = parts.join(' · ') || 'нет данных';
  if (c.flag === 'ok') return `ракурс: ${what} — в норме`;
  if (c.flag === 'tilt') return `⚠ ${what} — косая камера, нужна перспектива`;
  // Спереди «камера не под 90° к движению» не бывает по определению: там уход вбок —
  // это техника, и подсказка про камеру вводила бы в заблуждение.
  if (c.basis === 'front') return `⚠ ${what} — боковой ход штанги (техника)`;
  // Ракурс измерен и он боковой: значит «либо техника, либо камера» уже не «либо».
  if (c.azimuthKnown) return `⚠ ${what} — штанга гуляет вбок: это техника, камера в плоскости`;
  return `⚠ ${what} — либо техника, либо камера не под 90°`;
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
  /**
   * cos φ съёмки этой сессии (1 — камера в плоскости движения), если ракурс
   * измерен по эталону. Без него ΔxLoop между сессиями может быть разницей
   * ракурсов, а не техники — и отличить одно от другого нечем.
   */
  cosPhi?: number;
  /** Измеренное отклонение камеры, град (для подписи в сравнении). */
  angleDeg?: number;
  /**
   * Средняя скорость концентрической фазы, м/с — то, с чем сравнивают MVT/LVP.
   * Без неё сравнение сессий идёт по пиковой, и это должно быть видно.
   */
  vMean?: number;
}

/** Ракурс, под которым снят повтор: переносится в снимок, чтобы пережить перезагрузку. */
export interface BarRepCamera {
  /** cos φ из замера эталона. */
  cosPhi?: number | null;
  /** Отклонение камеры от плоскости движения, град. */
  azimuthDeg?: number | null;
}

/** Прореживает повтор до maxPoints так, чтобы сохранить форму траектории (равномерно по индексу). */
export function snapshotBarRep(rep: BarRepSegment, maxPoints = 24, camera?: BarRepCamera | null): BarRepSnapshot {
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
  const cosRaw = camera?.cosPhi;
  const cosPhi = cosRaw != null && Number.isFinite(cosRaw) && cosRaw > 0 && cosRaw <= 1.12
    ? Math.round(cosRaw * 1000) / 1000
    : null;
  const azRaw = camera?.azimuthDeg;
  const angleDeg = azRaw != null && Number.isFinite(azRaw) && azRaw >= 0 && azRaw <= 90 ? Math.round(azRaw) : null;
  const vMeanRaw = (rep as { vMean?: unknown }).vMean;
  const vMean = typeof vMeanRaw === 'number' && Number.isFinite(vMeanRaw) && vMeanRaw > 0 && vMeanRaw < 20
    ? Math.round(vMeanRaw * 100) / 100
    : null;
  return {
    index: rep.index,
    vmax: Math.round(rep.vmax * 100) / 100,
    xLoop: Math.round(rep.xLoop * 10) / 10,
    amplitude: Math.round(rep.amplitude * 10) / 10,
    points,
    ...(rep.setIndex && rep.setIndex > 0 ? { setIndex: Math.round(rep.setIndex) } : {}),
    ...(cosPhi != null ? { cosPhi } : {}),
    ...(angleDeg != null ? { angleDeg } : {}),
    ...(vMean != null ? { vMean } : {}),
  };
}

/** Дальше 40° от плоскости движения поправка горизонтали недопустима (как и в хабе). */
const SESSION_FIX_MAX_COS = 0.766;

export interface SessionAngleMismatch {
  /** Угол прошлой сессии, град (null — не записан). */
  prevDeg: number | null;
  /** Угол текущей сессии, град (null — не записан). */
  curDeg: number | null;
  /** Расхождение по cos φ, %. */
  pct: number;
  /** ΔxLoop с поправкой на ракурс, см; null — поправка недопустима (дальше 40°). */
  correctedDeltaCm: number | null;
  text: string;
}

/**
 * Разные ракурсы двух сессий — это разная шкала горизонтали, а не разная техника.
 *
 * vmax от ракурса не зависит (вертикаль при повороте камеры вокруг вертикали не
 * искажается), поэтому скорость сравнивать можно и при разных углах. xLoop —
 * нельзя: при 8° и 25° он занижен на 0% и 9%, и ΔxLoop покажет «технику», которой
 * нет. `null` — либо ракурсы не записаны, либо они совпадают в пределах шума.
 */
export function sessionAngleMismatch(
  prev: BarRepSnapshot | null | undefined,
  cur: BarRepSnapshot | null | undefined,
  minRelPct = 6,
): SessionAngleMismatch | null {
  if (!prev || !cur) return null;
  const pc = prev.cosPhi;
  const cc = cur.cosPhi;
  if (pc == null || cc == null) return null;
  if (!Number.isFinite(pc) || !Number.isFinite(cc) || !(pc > 0) || !(cc > 0)) return null;
  if (!Number.isFinite(prev.xLoop) || !Number.isFinite(cur.xLoop)) return null;
  const rel = Math.abs(cc - pc) / pc;
  if (rel * 100 <= minRelPct) return null;
  const pct = Math.round(rel * 1000) / 10;
  const prevDeg = prev.angleDeg != null ? Math.round(prev.angleDeg) : null;
  const curDeg = cur.angleDeg != null ? Math.round(cur.angleDeg) : null;
  const minCos = Math.min(pc, cc);
  const correctedDeltaCm = minCos >= SESSION_FIX_MAX_COS
    ? Math.round((cur.xLoop / cc - prev.xLoop / pc) * 10) / 10
    : null;
  const head = `Сессии под разными углами (${prevDeg ?? '?'}° и ${curDeg ?? '?'}°, разница ${pct}% по горизонтальному масштабу): `
    + 'ΔxLoop здесь — разница ракурсов, а не техники. vmax сравнивать можно: поворот камеры вокруг вертикали его не искажает.';
  const tail = correctedDeltaCm != null
    ? ` С поправкой на ракурс ΔxLoop ≈ ${correctedDeltaCm > 0 ? '+' : ''}${correctedDeltaCm} см (оценка).`
    : ' Поправка недопустима: ракурс дальше 40° от плоскости движения — сравнивайте только vmax.';
  return { prevDeg, curDeg, pct, correctedDeltaCm, text: head + tail };
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
  /**
   * Средняя скорость концентрической фазы: прошлая и текущая, м/с (undefined —
   * не записана). Сравнение идёт по vmax, а средняя едет рядом, чтобы пик не
   * выдавался за величину, по которой считают MVT.
   */
  prevVMean?: number;
  curVMean?: number;
  /** Δ средней скорости, %: считается только когда обе сессии её знают. */
  deltaVMeanPct?: number;
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
  const pvm = typeof prev.vMean === 'number' && Number.isFinite(prev.vMean) && prev.vMean > 0 ? prev.vMean : null;
  const cvm = typeof cur.vMean === 'number' && Number.isFinite(cur.vMean) && cur.vMean > 0 ? cur.vMean : null;
  const deltaVMeanPct = pvm != null && cvm != null ? Math.round(((cvm - pvm) / pvm) * 100) : null;
  const meanTail = deltaVMeanPct != null
    ? ` · средняя (концентрическая) ${pvm!.toFixed(2)} → ${cvm!.toFixed(2)} м/с (${deltaVMeanPct > 0 ? '+' : ''}${deltaVMeanPct}%)`
    : '';
  return {
    prevVmax: prev.vmax, curVmax: cur.vmax, deltaPct, deltaXLoopCm, deltaAmplitudeCm, verdict,
    ...(pvm != null ? { prevVMean: pvm } : {}),
    ...(cvm != null ? { curVMean: cvm } : {}),
    ...(deltaVMeanPct != null ? { deltaVMeanPct } : {}),
    text: `${head}: ${prev.vmax.toFixed(2)} → ${cur.vmax.toFixed(2)} м/с (${deltaPct > 0 ? '+' : ''}${deltaPct}%) · xLoop ${deltaXLoopCm > 0 ? '+' : ''}${deltaXLoopCm} см${meanTail}`,
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
  /** Средняя по повторам vMean (концентрическая фаза), м/с — только если она измерена. */
  vMeanMean?: number;
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
    .map(([setIndex, list]) => {
      const means = list.map((r) => r.vMean).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      return {
        setIndex,
        reps: list.length,
        vmaxMean: Math.round(mean(list.map((r) => r.vmax)) * 100) / 100,
        vmaxMin: Math.round(Math.min(...list.map((r) => r.vmax)) * 100) / 100,
        xLoopMean: Math.round(mean(list.map((r) => r.xLoop)) * 10) / 10,
        ...(means.length ? { vMeanMean: Math.round(mean(means) * 100) / 100 } : {}),
      };
    });
}

/** Сводка по средней скорости концентрической фазы (то, с чем сравнивают MVT/LVP). */
export interface MeanVelocitySummary {
  /** Средняя по повторам vMean, м/с. */
  mean: number;
  /** Пиковая vmax по тем же повторам, м/с (0 — пик не записан). */
  peak: number;
  /** Сколько повторов дали vMean. */
  reps: number;
  /** Во сколько раз пик выше средней (0 — неизвестно). */
  peakToMean: number;
  text: string;
}

/**
 * Средняя скорость концентрической фазы словами и числами.
 *
 * Зачем отдельная сводка: у нас есть только vmax (пик), а MVT и нагрузочно-скоростной
 * профиль в литературе считаются по **средней** скорости концентрической фазы. Пик
 * всегда выше средней, поэтому подстановка одного вместо другого систематически
 * завышает результат — и молчать об этом нельзя. Считается только по замерам
 * (`vMean`), никакой модели: нет данных — `null`.
 */
export function meanVelocitySummary(
  reps: Array<{ vmax?: number; vMean?: number }> | null | undefined,
): MeanVelocitySummary | null {
  if (!Array.isArray(reps) || !reps.length) return null;
  const means = reps
    .map((r) => r.vMean)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 20);
  if (!means.length) return null;
  const mean = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100;
  const peaks = reps
    .map((r) => r.vmax)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const peak = peaks.length ? Math.round(Math.max(...peaks) * 100) / 100 : 0;
  const peakToMean = peak > 0 && mean > 0 ? Math.round((peak / mean) * 10) / 10 : 0;
  const text = `Средняя скорость концентрической фазы: ${mean} м/с (${means.length} повт.`
    + (peak > 0 ? `, пиковая ${peak} м/с — в ${peakToMean} раза выше` : '')
    + '). MVT и LVP считаются по средней скорости, а не по пиковой: не подставляйте одно вместо другого.';
  return { mean, peak, reps: means.length, peakToMean, text };
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
