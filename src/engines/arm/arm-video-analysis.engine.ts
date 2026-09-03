/**
 * arm-video-analysis.engine.ts — видео-разбор за столом (эпик I PRO-плана).
 *
 * Зеркало TA-хаба parseKinoveaCSV: CSV трекинга (t,x,y) → метрики
 * (xLoop/yMax/vMax) → тип траектории → мёртвая точка → коррекция.
 * Упрощённо под арм: ось X — боковое смещение кисти, Y — высота.
 */

export interface TrackPoint {
  t: number;
  x: number;
  y: number;
}

export interface BarPathMetrics {
  xLoop: number; // размах X (см/пикс — относительные единицы CSV)
  yMax: number; // макс. высота
  vMax: number; // макс. скорость (ед/с)
  points: number;
}

/** Парсинг Kinovea-CSV: заголовок t,x,y (разделитель , или ;), мусор пропускаем. */
export function parseArmTrackCsv(csv: string): TrackPoint[] {
  const out: TrackPoint[] = [];
  const lines = String(csv || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /[a-zA-Z]/.test(line)) continue; // заголовок
    const parts = line.split(/[;,]/).map((s) => s.trim());
    if (parts.length < 3) continue;
    const t = Number(parts[0].replace(',', '.'));
    const x = Number(parts[1].replace(',', '.'));
    const y = Number(parts[2].replace(',', '.'));
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ t, x, y });
  }
  return out;
}

export function armPathMetrics(points: TrackPoint[]): BarPathMetrics | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xLoop = Math.max(...xs) - Math.min(...xs);
  const yMax = Math.max(...ys);
  let vMax = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt <= 0) continue;
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const v = Math.sqrt(dx * dx + dy * dy) / dt;
    if (v > vMax) vMax = v;
  }
  return { xLoop: Math.round(xLoop * 100) / 100, yMax: Math.round(yMax * 100) / 100, vMax: Math.round(vMax * 100) / 100, points: points.length };
}

export type ArmTrajectoryType = 'inside_hook' | 'outside_toproll' | 'straight_press';

/** Тип траектории: дрейф X наружу = toproll, внутрь = hook, прямо = press. */
export function classifyArmTrajectory(points: TrackPoint[]): ArmTrajectoryType | null {
  if (points.length < 3) return null;
  const dx = points[points.length - 1].x - points[0].x;
  const span = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  if (span < 1e-9) return 'straight_press';
  if (dx > span * 0.3) return 'outside_toproll';
  if (dx < -span * 0.3) return 'inside_hook';
  return 'straight_press';
}

/** SRD-порог повтора: изменение xLoop >4 — реальное (как TA SRD 4/6см). */
export function isArmRealChange(before: BarPathMetrics, after: BarPathMetrics, srd = 4): boolean {
  return Math.abs(after.xLoop - before.xLoop) > srd;
}
