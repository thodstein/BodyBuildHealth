/**
 * planner-meal-targets.ts — Эпик 6 (NUTRITION-PROFESSIONAL-PLAN):
 * ручные цели на приём (G2). Пользователь задаёт Б/Ж/У слота («🎯» в шапке
 * приёма) → пост-проход масштабирует items приёма до цели (пропорции состава
 * сохраняются, белок не режется глубже 0.8×). Чистая функция, тестируемая.
 */

export interface MealTargetOverride {
  label: string;
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
}

export interface MealLike { label: string; items: any[]; totals: any; }

const SCALE_MIN = 0.7;
const SCALE_MAX = 1.4;
const PROTEIN_FLOOR_RATIO = 0.8;

function recalc(items: any[]): any {
  return items.reduce((acc, it) => ({
    kcal: acc.kcal + (it.kcal || 0),
    p: acc.p + (it.p || 0),
    f: acc.f + (it.f || 0),
    c: acc.c + (it.c || 0),
    fiber: acc.fiber + (it.fiber || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
}

/**
 * Применяет оверрайды целей к приёмам. Для каждого макро берётся максимальный
 * масштаб из заданных (не стекаем: один scale на приём), кламп 0.7-1.4,
 * белок-флор 0.8×. Возвращает новые meals + notes.
 */
export function applyMealTargetOverrides(
  meals: MealLike[],
  overrides: MealTargetOverride[],
): { meals: MealLike[]; notes: string[] } {
  const notes: string[] = [];
  if (!Array.isArray(meals) || !Array.isArray(overrides) || overrides.length === 0) return { meals, notes };
  const next = meals.map(m => {
    const ov = overrides.find(o => o.label === m.label);
    if (!ov || !Array.isArray(m.items) || m.items.length === 0) return m;
    const t = m.totals || recalc(m.items);
    const scales: number[] = [];
    if (typeof ov.p === 'number' && ov.p > 0 && t.p > 0) scales.push(ov.p / t.p);
    if (typeof ov.f === 'number' && ov.f > 0 && t.f > 0) scales.push(ov.f / t.f);
    if (typeof ov.c === 'number' && ov.c > 0 && t.c > 0) scales.push(ov.c / t.c);
    if (typeof ov.kcal === 'number' && ov.kcal > 0 && t.kcal > 0) scales.push(ov.kcal / t.kcal);
    if (scales.length === 0) return m;
    const raw = Math.max(...scales);
    let scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
    // Белок приёма не режем глубже 0.8× (MPS-защита) — режем только угли/жиры при необходимости
    const pAfter = t.p * scale;
    if (pAfter < t.p * PROTEIN_FLOOR_RATIO && ov.p && t.p > 0) {
      scale = Math.max(scale, PROTEIN_FLOOR_RATIO);
    }
    const items = m.items.map(it => ({
      ...it,
      amount: Math.max(1, Math.round((it.amount || 0) * scale)),
      kcal: Math.round((it.kcal || 0) * scale),
      p: Math.round((it.p || 0) * scale),
      f: Math.round((it.f || 0) * scale),
      c: Math.round((it.c || 0) * scale),
      fiber: Math.round((it.fiber || 0) * scale),
      leucine_mg: Math.round((it.leucine_mg || 0) * scale),
    }));
    const totals = recalc(items);
    notes.push(`🎯 Приём «${m.label}»: масштаб ×${scale.toFixed(2)} к цели Б${ov.p ?? '—'}/Ж${ov.f ?? '—'}/У${ov.c ?? '—'}`);
    return { ...m, items, totals };
  });
  return { meals: next, notes };
}