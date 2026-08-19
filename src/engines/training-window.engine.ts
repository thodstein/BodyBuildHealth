/**
 * training-window.engine.ts — скоринг окон тренировки pre/intra/post (доп. 4).
 *
 * Оценивает, насколько фактические приёмы покрывают тренировочные окна по FFM/весу:
 * - pre: белок ≥ 20 г + углеводы ≥ 0.5 г/кг веса;
 * - intra: углеводы ≥ 30 г (поддержание глюкозы на длинной сессии);
 * - post: белок ≥ 0.4 г/кг FFM + углеводы ≥ 0.5 г/кг веса.
 * Приём матчится к окну по timing (pre_workout/intra_workout/post_workout).
 */
import { FOOD_DB } from '../core/nutrition-database';

export type WindowKind = 'pre' | 'intra' | 'post';

export interface WindowInput {
  timing?: string;
  products: { foodId: string; weightGrams: number }[];
}

export interface WindowCoverage {
  window: WindowKind;
  proteinG: number;
  carbsG: number;
  covered: boolean;
  detail: string;
}

export interface TrainingWindowResult {
  bodyWeightKg: number;
  ffmKg: number;
  windows: WindowCoverage[];
  overall: 'good' | 'partial' | 'missed';
  rationale: string[];
}

const mealKey = (t?: string): WindowKind | null => {
  const s = (t || '').toLowerCase();
  if (s.includes('pre') || s.includes('предтрен')) return 'pre';
  if (s.includes('intra') || s.includes('во время')) return 'intra';
  if (s.includes('post') || s.includes('послетрен')) return 'post';
  return null;
};

export function assessTrainingWindows(meals: WindowInput[], opts: { bodyWeightKg?: number; ffmKg?: number } = {}): TrainingWindowResult {
  const bw = Math.max(40, opts.bodyWeightKg || 80);
  const ffm = Math.max(20, opts.ffmKg || bw * 0.85);

  const totals: Record<WindowKind, { p: number; c: number }> = { pre: { p: 0, c: 0 }, intra: { p: 0, c: 0 }, post: { p: 0, c: 0 } };
  const seen: Record<WindowKind, boolean> = { pre: false, intra: false, post: false };
  for (const m of (meals || [])) {
    const kind = mealKey(m.timing);
    if (!kind) continue;
    seen[kind] = true;
    let p = 0, c = 0;
    for (const prod of (m.products || [])) {
      if (!(prod.weightGrams > 0)) continue;
      const f = FOOD_DB.find(x => x.id === prod.foodId);
      if (!f) continue;
      const w = prod.weightGrams / 100;
      p += (f.protein || 0) * w;
      c += (f.carbs || 0) * w;
    }
    totals[kind].p += p;
    totals[kind].c += c;
  }

  const preTargetC = Math.round(bw * 0.5);
  const postTargetP = Math.round(ffm * 0.4);
  const postTargetC = Math.round(bw * 0.5);

  const mk = (window: WindowKind, p: number, c: number, covered: boolean, detail: string): WindowCoverage =>
    ({ window, proteinG: Math.round(p * 10) / 10, carbsG: Math.round(c * 10) / 10, covered, detail });

  const windows: WindowCoverage[] = [
    mk('pre', totals.pre.p, totals.pre.c, seen.pre && totals.pre.p >= 20 && totals.pre.c >= preTargetC, seen.pre ? `белок ${Math.round(totals.pre.p)}г / угл. ${Math.round(totals.pre.c)}г (нужно ≥20г / ${preTargetC}г)` : 'приём pre отсутствует'),
    mk('intra', totals.intra.p, totals.intra.c, seen.intra && totals.intra.c >= 30, seen.intra ? `угл. ${Math.round(totals.intra.c)}г (нужно ≥30г)` : 'приём intra отсутствует'),
    mk('post', totals.post.p, totals.post.c, seen.post && totals.post.p >= postTargetP && totals.post.c >= postTargetC, seen.post ? `белок ${Math.round(totals.post.p)}г / угл. ${Math.round(totals.post.c)}г (нужно ≥${postTargetP}г / ${postTargetC}г)` : 'приём post отсутствует'),
  ];

  const coveredCount = windows.filter(w => w.covered).length;
  const overall: TrainingWindowResult['overall'] = coveredCount === 3 ? 'good' : coveredCount >= 2 ? 'partial' : 'missed';
  const rationale = [
    `Окна: pre (белок ≥20г + угл. ≥${preTargetC}г), intra (угл. ≥30г), post (белок ≥${postTargetP}г + угл. ≥${postTargetC}г).`,
    `Покрыто ${coveredCount}/3 окон.`,
    overall === 'good' ? 'Все тренировочные окна закрыты — питание вокруг тренировки выстроено.' : overall === 'partial' ? 'Часть окон не закрыта — добавьте белок/углеводы в пропущенные приёмы.' : 'Ключевые окна не закрыты — планируйте pre/intra/post приёмы вокруг тренировки.',
  ];

  return { bodyWeightKg: bw, ffmKg: ffm, windows, overall, rationale };
}
