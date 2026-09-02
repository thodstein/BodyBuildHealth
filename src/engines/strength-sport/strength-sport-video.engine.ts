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

export function analyzeBarTracking(points: BarPoint[]): BarTrackingResult | null {
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
  vmax = Math.round(vmax * 100) / 100;
  const duration = filtered[filtered.length - 1].t - filtered[0].t;
  hAcc = Math.round(hAcc * 100) / 100;
  if (hAcc <= 0.2) hAcc = 0.8;
  return { points: filtered, fps, yMax: Math.round(yMax), xLoop: Math.round(xLoop * 10) / 10, vmax, hAcc, duration: Math.round(duration * 100) / 100 };
}

// Force provider abstraction (loadsol insoles, force plate)
export interface ForceSample { t: number; leftN: number; rightN: number; totalN: number; }
export interface ForceProvider {
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
