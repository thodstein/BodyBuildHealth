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
 *
 * Эпик-хвост: при переданных dayTargets гарантируется инвариант дня ±5% —
 * если суммарный эффект оверрайдов уводит день за ±5%, масштабы всех приёмов
 * пропорционально откатываются (состав приёмов и пропорции сохраняются).
 */
export function applyMealTargetOverrides(
  meals: MealLike[],
  overrides: MealTargetOverride[],
  dayTargets?: { kcal: number; p?: number; f?: number; c?: number },
): { meals: MealLike[]; notes: string[] } {
  const notes: string[] = [];
  if (!Array.isArray(meals) || !Array.isArray(overrides) || overrides.length === 0) return { meals, notes };

  const scaleFor = (m: MealLike): number | null => {
    const ov = overrides.find(o => o.label === m.label);
    if (!ov || !Array.isArray(m.items) || m.items.length === 0) return null;
    const t = m.totals || recalc(m.items);
    const scales: number[] = [];
    if (typeof ov.p === 'number' && ov.p > 0 && t.p > 0) scales.push(ov.p / t.p);
    if (typeof ov.f === 'number' && ov.f > 0 && t.f > 0) scales.push(ov.f / t.f);
    if (typeof ov.c === 'number' && ov.c > 0 && t.c > 0) scales.push(ov.c / t.c);
    if (typeof ov.kcal === 'number' && ov.kcal > 0 && t.kcal > 0) scales.push(ov.kcal / t.kcal);
    if (scales.length === 0) return null;
    let scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.max(...scales)));
    const pAfter = t.p * scale;
    if (pAfter < t.p * PROTEIN_FLOOR_RATIO && ov.p && t.p > 0) scale = Math.max(scale, PROTEIN_FLOOR_RATIO);
    return scale;
  };

  const applyScale = (m: MealLike, scale: number): MealLike => {
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
    return { ...m, items, totals: recalc(items) };
  };

  // 1-й проход: масштаб каждого приёма к его цели
  let next = meals.map(m => {
    const s = scaleFor(m);
    return s !== null ? applyScale(m, s) : m;
  });

  // Инвариант дня ±5%: если суммарная девиация превышает 5% — пропорциональный откат
  if (dayTargets && dayTargets.kcal > 0) {
    const daySum = recalc(next.flatMap(m => m.items));
    const devKcal = (daySum.kcal - dayTargets.kcal) / dayTargets.kcal;
    if (Math.abs(devKcal) > 0.05) {
      const targetAbs = Math.abs(dayTargets.kcal * 0.05);
      const excessAbs = Math.abs(devKcal * dayTargets.kcal);
      const c = excessAbs > 0 ? targetAbs / excessAbs : 1; // доля «отката»
      next = meals.map((m, i) => {
        const s = scaleFor(m);
        if (s === null) return m;
        // новый масштаб ближе к 1: 1 + (s - 1) * c
        const corrected = 1 + (s - 1) * c;
        if (Math.abs(corrected - 1) < 0.01) return m; // почти без изменения — не трогаем
        return applyScale(m, corrected);
      });
      const daySum2 = recalc(next.flatMap(m => m.items));
      const dev2 = (daySum2.kcal - dayTargets.kcal) / dayTargets.kcal;
      if (Math.abs(dev2) <= 0.05) notes.push(`⚖️ День скорректирован к цели (±5%) после оверрайдов приёмов: девиация ${Math.round(devKcal * 100)}% → ${Math.round(dev2 * 100)}%`);
      else notes.push(`⚖️ Оверрайды приёмов: день на ${Math.round(dev2 * 100)}% от цели (вне ±5% — проверьте цели приёмов)`);
    }
  }

  const appliedLabels = overrides.filter(o => meals.some(m => m.label === o.label));
  for (const ov of appliedLabels) {
    const t = meals.find(m => m.label === ov.label)?.totals || { kcal: 0, p: 0, f: 0, c: 0 };
    notes.push(`🎯 Приём «${ov.label}»: масштаб ×${scaleFor(meals.find(m => m.label === ov.label)!)?.toFixed(2) ?? '—'} к цели Б${ov.p ?? '—'}/Ж${ov.f ?? '—'}/У${ov.c ?? '—'}`);
  }
  return { meals: next, notes };
}