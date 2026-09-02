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

// Kinovea CSV parser (упрощенный): ожидается заголовок time,x,y или t,x,y; x,y в см
export function parseKinoveaCSV(csv: string): BarPoint[] | null {
  if (!csv || typeof csv !== 'string') return null;
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) return null;
  const header = lines[0].toLowerCase();
  const hasT = header.includes('time') || header.includes('t,') || header.includes('t;');
  const pts: BarPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/[,;]\s*/);
    if (parts.length < 3 && !hasT) continue;
    let t = 0, x = 0, y = 0;
    if (parts.length >= 3) {
      t = parseFloat(parts[0]); x = parseFloat(parts[1]); y = parseFloat(parts[2]);
      if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      // если t в кадрах, переводим в сек
      if (t > 100) t = t / 30; // эвристика 30fps
    } else if (parts.length === 2) {
      x = parseFloat(parts[0]); y = parseFloat(parts[1]); t = i * 0.033;
    }
    pts.push({ x, y, t });
  }
  return pts.length >= 2 ? pts : null;
}

export function analyzeBarTracking(points: BarPoint[]): BarTrackingResult | null {
  if (!points || points.length < 2) return null;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const yMax = Math.max(...ys);
  const xLoop = Math.max(...xs) - Math.min(...xs);
  // vmax: дифференцирование y по t, 12Hz Butterworth упрощенно — скользящее среднее 3
  let vmax = 0;
  let hAcc = yMax;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt <= 0) continue;
    const v = (points[i].y - points[i - 1].y) / dt / 100; // см/с → м/с
    // скользящее по 3 уже есть в сырых, берем макс положительной
    if (v > vmax) {
      vmax = v;
      hAcc = points[i].y / 100; // м
    }
  }
  vmax = Math.round(vmax * 100) / 100;
  const duration = points[points.length - 1].t - points[0].t;
  hAcc = Math.round(hAcc * 100) / 100;
  if (hAcc <= 0.2) hAcc = 0.8; // fallback среднее Sandau
  return { points, fps: 30, yMax: Math.round(yMax), xLoop: Math.round(xLoop * 10) / 10, vmax, hAcc, duration: Math.round(duration * 100) / 100 };
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
