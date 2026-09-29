/**
 * planner-composition-quality.ts — E7 (PRO-план §3): «качество композиции дня».
 *
 * Чистый advisory-скор (НЕ режет КБЖУ, не меняет генерацию): штрафует off-slot
 * еду, приправочную добивку, повторы внутри дня, фрагментированные приёмы,
 * «2 фрукта в одном приёме», отсутствие овоща в основном приёме. Плюсы — за
 * разнообразие (семейства/белки/овощи). Показывается в карточке разбора дня.
 *
 * Потребители: IndividualPlanResults (бейдж/строки), planner-day-print (отчёт).
 */

import { afAllows, type AffinitySlot } from './planner-meal-affinity';
import { stapleFamilyOf, isSauceCondimentFood, isHerbSpiceId } from './food-availability';

export type CompositionIssueKind =
  | 'off-slot' | 'filler-condiment' | 'repeat' | 'fragment' | 'two-fruits' | 'no-veg';

export interface CompositionIssue {
  kind: CompositionIssueKind;
  label: string;
  /** Вес штрафа в баллах. */
  weight: number;
  /** Ближайшее действие для пользователя. */
  hint: string;
}

export interface CompositionScore {
  /** 0..100: 100 − сумма штрафов (с потолком). */
  score: number;
  issues: CompositionIssue[];
  /** Положительные наблюдения (разнообразие и т.п.). */
  positives: string[];
  /** Короткая метка для UI. */
  grade: 'A' | 'B' | 'C' | 'D';
}

export interface CompositionMealLike {
  label?: string;
  type?: string;
  totals?: { kcal?: number; p?: number };
  items?: Array<{ id: string; role?: string; amount?: number; p?: number; c?: number }>;
}
export interface CompositionPlanLike {
  meals?: CompositionMealLike[];
}

const MAIN_TYPES = new Set(['breakfast', 'lunch', 'dinner']);
const SLOT_OF: Record<string, AffinitySlot> = {
  breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner',
  snack: 'snack', snack2: 'snack', snack3: 'snack', snack4: 'snack',
  preworkout: 'preworkout', postworkout: 'postworkout', intra: 'intra', presleep: 'presleep',
};

function isVegRole(role?: string, id?: string): boolean {
  if (role === 'veg') return true;
  return /(^|_)(veg|broccoli|cabbage|cauliflower|spinach|kale|zucchini|cucumber|tomato|pepper|asparagus|celery|leek|greens|endive)(_|$)/i.test(String(id || ''));
}

/**
 * Композиционный скор дня. Без побочных эффектов; пустой план → нейтральный A.
 */
export function scoreDayComposition(plan: CompositionPlanLike | null | undefined): CompositionScore {
  const meals = Array.isArray(plan?.meals) ? plan!.meals! : [];
  const issues: CompositionIssue[] = [];
  const positives: string[] = [];
  if (meals.length === 0) return { score: 100, issues, positives, grade: 'A' };

  const carbIdUses = new Map<string, number>();
  const carbFamUses = new Map<string, number>();
  const proteinKinds = new Set<string>();
  const carbFams = new Set<string>();

  for (const m of meals) {
    const type = String(m.type || '');
    const slot = SLOT_OF[type];
    const items = Array.isArray(m.items) ? m.items : [];
    const isMain = MAIN_TYPES.has(type);
    let hasVeg = false;
    let fruitCount = 0;
    const mealFamilies = new Set<string>();
    for (const it of items) {
      const id = String(it.id || '');
      const role = String(it.role || '');
      // off-slot
      if (slot && !afAllows(id, slot)) {
        issues.push({ kind: 'off-slot', label: `${m.label || type}: ${id}`, weight: 12, hint: 'убрать/заменить — не для этого приёма' });
      }
      // приправочная добивка
      const amt = it.amount || 0;
      if ((isSauceCondimentFood({ id }) || isHerbSpiceId(id)) && amt > 15) {
        issues.push({ kind: 'filler-condiment', label: `${m.label || type}: ${id} ${Math.round(amt)} г`, weight: 8, hint: 'соус/специя — только вкус (≤15 г)' });
      }
      if (isVegRole(role, id)) hasVeg = true;
      if (role === 'fruit') fruitCount++;
      if (role === 'carb_slow' || role === 'carb_fast') {
        carbIdUses.set(id, (carbIdUses.get(id) || 0) + 1);
        const fam = stapleFamilyOf(id);
        if (fam) { carbFams.add(fam); mealFamilies.add(fam); carbFamUses.set(fam, (carbFamUses.get(fam) || 0) + 1); }
      }
      if (role === 'protein' || role === 'fast_protein') proteinKinds.add(id);
    }
    if (fruitCount >= 2) {
      issues.push({ kind: 'two-fruits', label: `${m.label || type}: ${fruitCount} фрукта`, weight: 5, hint: 'оставить 1 фрукт в приёме' });
    }
    if (isMain && mealFamilies.size >= 2) {
      issues.push({ kind: 'repeat', label: `${m.label || type}: ${mealFamilies.size} крахмала`, weight: 6, hint: 'в тарелке — 1 крахмал' });
    }
    if (isMain && (m.totals?.kcal || 0) > 0 && (m.totals?.kcal || 0) < 180) {
      issues.push({ kind: 'fragment', label: `${m.label || type}: ${Math.round(m.totals?.kcal || 0)} ккал`, weight: 7, hint: 'укрупнить приём (норма ≥180 ккал)' });
    }
    if (isMain && !hasVeg && items.length > 0) {
      issues.push({ kind: 'no-veg', label: `${m.label || type}: без овоща`, weight: 3, hint: 'добавить овощ к тарелке' });
    }
  }

  // Повтор крахмала/семейства между приёмами дня (тот же id ≥2 → мягкий штраф).
  for (const [id, n] of carbIdUses) {
    if (n >= 2) issues.push({ kind: 'repeat', label: `повтор: ${id} ×${n}`, weight: 4, hint: 'разные гарниры в приёмах' });
  }

  // Плюсы
  if (carbFams.size >= 3) positives.push(`Разные гарниры: ${carbFams.size} семейства`);
  if (proteinKinds.size >= 3) positives.push(`Разные белки: ${proteinKinds.size} источника`);

  const penalty = issues.reduce((s, i) => s + i.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade: CompositionScore['grade'] = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  return { score, issues, positives, grade };
}
