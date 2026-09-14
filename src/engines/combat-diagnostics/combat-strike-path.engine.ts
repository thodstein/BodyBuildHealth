/**
 * combat-strike-path.engine.ts — P3 bar-path ударов (REUSE, не свой велосипед).
 * Тонкая обёртка над каноном strength-sport: parseKinoveaCSV + classifyTrajectoryType.
 * Кулак/голень вместо штанги: единицы те же (см, с), пороги SRD те же (4/6 см).
 * Без CSV — честное «нет данных», мусор — честная ошибка.
 */
import {
  classifyTrajectoryType,
  type TrajectoryClassification,
} from '../strength-sport/strength-sport-barpath.engine';
import {
  parseKinoveaCSV,
  type BarPoint,
} from '../strength-sport/strength-sport-video.engine';

export type CombatStrikePathVerdict = 'straight' | 'loop' | 'no_data' | 'bad_data';

export interface CombatStrikePathResult {
  verdict: CombatStrikePathVerdict;
  xLoopCm: number | null;
  yMaxCm: number | null;
  vMaxMs: number | null;
  classification: TrajectoryClassification | null;
  text: string;
  corrections: string[];
}

/** SRD-пороги канона (см): <4 — прямо, 4–6 — пог watch, >6 — петля. */
const SRD_OK = 4;
const SRD_BAD = 6;

export function analyzeCombatStrikePath(csvText: string): CombatStrikePathResult {
  if (!csvText || !csvText.trim()) {
    return { verdict: 'no_data', xLoopCm: null, yMaxCm: null, vMaxMs: null, classification: null, text: 'Нет трекинга — вставьте Kinovea-CSV (снимайте строго сбоку)', corrections: ['Снимите удар строго сбоку, 60+ fps, вставьте CSV из Kinovea'] };
  }
  let pts: BarPoint[] | null = null;
  try {
    pts = parseKinoveaCSV(csvText);
  } catch {
    pts = null;
  }
  if (!pts || pts.length < 3) {
    return { verdict: 'bad_data', xLoopCm: null, yMaxCm: null, vMaxMs: null, classification: null, text: 'CSV не распознан — проверьте формат Kinovea (t,x,y)', corrections: ['Экспортируйте trajectory из Kinovea как CSV с колонками времени и координат'] };
  }
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const ts = pts.map(p => p.t);
  const xLoop = Math.max(...xs) - Math.min(...xs);
  const yMax = Math.max(...ys);
  let vMax = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = ts[i] - ts[i - 1] || 0.033;
    const dx = (xs[i] - xs[i - 1]) / 100;
    const dy = (ys[i] - ys[i - 1]) / 100;
    const v = dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0;
    if (v > vMax) vMax = v;
  }
  const classification = classifyTrajectoryType(xs, ys, ts);
  if (xLoop < SRD_OK) {
    return { verdict: 'straight', xLoopCm: xLoop, yMaxCm: yMax, vMaxMs: vMax, classification, text: `Петля ${xLoop.toFixed(1)} см — прямой удар, в норме (<${SRD_OK})`, corrections: [] };
  }
  if (xLoop > SRD_BAD) {
    return { verdict: 'loop', xLoopCm: xLoop, yMaxCm: yMax, vMaxMs: vMax, classification, text: `Петля ${xLoop.toFixed(1)} см — замах виден (>${SRD_BAD})`, corrections: ['Короче траектория: бей по прямой, локоть не отводить', 'Бой с тенью перед зеркалом 3×2 мин на прямую линию'] };
  }
  return { verdict: 'straight', xLoopCm: xLoop, yMaxCm: yMax, vMaxMs: vMax, classification, text: `Петля ${xLoop.toFixed(1)} см — погранично, наблюдайте`, corrections: ['Переснимите сбоку точнее; разовый замер ±2 см'] };
}
