/**
 * strength-sport-sm-carry-path.engine.ts — 2D-ТИПИЗАЦИЯ ПЕРЕНОСКИ (SM PRO)
 *
 * Вход — точки трекинга (Kinovea): x lateral (см), y высота (см), t (с).
 * Считает: xLoop (размах), дрейф (конец − начало), частоту качаний (пересечения
 * среднего в секунду ≈ stride rate), вертикальный боб (размах y).
 * Типы: stable / lateral_sway / sideways_drift (+ пометки bounce/choppy).
 * Пороги вердикта — только валидированные: sway SRD 3/5см (Frontiers 2023,
 * parity с diagnoseCarrySway — severity берём оттуда, не дублируем);
 * дрейф >2см и частота вне [0.8,3.0]Гц (Hindle stride rate 1.62±0.18) — warn;
 * боб — info без вердикта (в литературе cutoff нет, честно помечено как ориентир).
 * Флоров в скоринг НЕ даёт (нет якоря) — только техника.
 *
 * Чистый движок. Тип BarPoint — структурный (не импортируем video-движок,
 * чтобы не тянуть провайдеры; diagnoseCarrySway используется read-only).
 */

import { diagnoseCarrySway } from './strength-sport-video.engine';

export interface SMCarryPoint {
  x: number;
  y: number;
  t: number;
}

export type SMCarryPathType = 'stable' | 'lateral_sway' | 'sideways_drift';

export interface SMCarryPathMetrics {
  n: number;
  xLoop: number;
  drift: number; // см, +/− по оси x
  swayFreqHz: number | null;
  yBounce: number;
  durationS: number;
}

export interface SMCarryPathResult {
  type: SMCarryPathType;
  verdict: 'ok' | 'warn' | 'critical';
  metrics: SMCarryPathMetrics;
  lines: string[];
}

/** Метрики из точек (собственное сглаживание MA3, shared-видео не трогаем). */
export function carryPathMetrics(points: SMCarryPoint[] | null | undefined): SMCarryPathMetrics | null {
  if (!points || points.length < 3) return null;
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t));
  if (clean.length < 3) return null;
  const sorted = [...clean].sort((a, b) => a.t - b.t);
  // MA3 по x/y
  const sx = sorted.map((p, i) => {
    const a = sorted[Math.max(0, i - 1)].x;
    const b = p.x;
    const c = sorted[Math.min(sorted.length - 1, i + 1)].x;
    return (a + b + c) / 3;
  });
  const sy = sorted.map((p, i) => {
    const a = sorted[Math.max(0, i - 1)].y;
    const b = p.y;
    const c = sorted[Math.min(sorted.length - 1, i + 1)].y;
    return (a + b + c) / 3;
  });
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  const xLoop = r1(Math.max(...sx) - Math.min(...sx));
  const yBounce = r1(Math.max(...sy) - Math.min(...sy));
  const k = Math.max(1, Math.floor(sorted.length * 0.2));
  const head = sx.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const tail = sx.slice(-k).reduce((a, b) => a + b, 0) / k;
  const drift = r1(tail - head);
  // Частота: пересечения среднего
  const mean = sx.reduce((a, b) => a + b, 0) / sx.length;
  let cross = 0;
  for (let i = 1; i < sx.length; i++) {
    if ((sx[i - 1] - mean) * (sx[i] - mean) < 0) cross++;
  }
  const durationS = r1(sorted[sorted.length - 1].t - sorted[0].t);
  const swayFreqHz = durationS > 0.3 ? r1(cross / 2 / durationS) : null;
  return { n: sorted.length, xLoop, drift, swayFreqHz, yBounce, durationS };
}

export function classifyCarryPath(m: SMCarryPathMetrics | null): SMCarryPathResult | null {
  if (!m) return null;
  const lines: string[] = [];
  // Severity sway — из валидированного diagnoseCarrySway (SRD 3/5)
  const sway = diagnoseCarrySway(m.xLoop);
  const swayBad = sway.severity === 'warn' || sway.severity === 'critical';
  lines.push(sway.text);
  let type: SMCarryPathType = 'stable';
  if (sway.severity === 'critical' || sway.severity === 'warn') type = 'lateral_sway';
  const driftBad = Math.abs(m.drift) > 2;
  if (driftBad) {
    if (type === 'stable') type = 'sideways_drift';
    lines.push(`Снос вбок ${m.drift}см за проход (>2см): веди взглядом вперёд, шаг ближе к средней линии`);
  }
  const freqBad = m.swayFreqHz != null && (m.swayFreqHz < 0.8 || m.swayFreqHz > 3.0);
  if (freqBad) {
    lines.push(`Частота качаний ${m.swayFreqHz}Гц вне [0.8,3.0] (Hindle stride rate ~1.62Гц): рваный темп — держи каденс коротким шагом`);
  }
  // Боб — info, cutoff нет
  lines.push(`Вертикальный боб ${m.yBounce}см (ориентир, cutoff нет — гаси коротким шагом, Hindle)`);
  let verdict: SMCarryPathResult['verdict'] = 'ok';
  if (sway.severity === 'critical') verdict = 'critical';
  else if (swayBad || driftBad || freqBad) verdict = 'warn';
  return { type, verdict, metrics: m, lines };
}

/** Точки → метрики → тип (одна точка входа для хаба). */
export function diagnoseCarryPathFromPoints(points: SMCarryPoint[] | null | undefined): SMCarryPathResult | null {
  return classifyCarryPath(carryPathMetrics(points));
}
