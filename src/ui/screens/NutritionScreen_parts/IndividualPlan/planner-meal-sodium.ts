/**
 * planner-meal-sodium.ts — соль/натрий ПО ПРИЁМАМ.
 *
 * Раньше натрий жил только в дневной микро-сводке (planner-micro-coverage), а в
 * приёмах его не было вообще: пользователь не видел, что «обед = 1.9 г соли».
 * Просьба владельца: «в каждом приёме показывать количество соли».
 *
 * Источник значения — ЕДИНЫЙ читатель микро (`planner-micro-reader.getMicroFromFood`,
 * v2-контейнеры + IU-нормализация). Порядок чтения:
 *   1) `item.na` (посчитан движком в makeItem на момент сборки);
 *   2) ФОЛБЭК — пересчёт из FOOD_DB по id (старые сохранённые планы без `na`,
 *      ручные правки порций, коктейли).
 *
 * Соль и натрий — РАЗНЫЕ числа: 1 г NaCl = 400 мг Na, то есть Na(mg) × 2.5 / 1000 = г соли.
 * В UI показываем оба (крупно — соль, в подсказке — мг натрия), это просил владелец.
 */
import { findFoodById } from '../../../../core/nutrition-database';
import { getMicroFromFood } from './planner-micro-reader';

/** IOM DRI: 2300 мг Na/сут (верхняя граница для взрослых). */
export const SODIUM_RDA_MG = 2300;

export interface SodiumItemLike {
  id?: string;
  amount?: number;
  na?: number;
}
export interface SodiumMealLike {
  items?: SodiumItemLike[];
  totalsNa?: number;
  na?: number;
}

/** Натрий позиции в мг. */
export function itemSodiumMg(item: SodiumItemLike | null | undefined): number {
  if (!item) return 0;
  if (typeof item.na === 'number' && Number.isFinite(item.na)) return Math.max(0, item.na);
  const food = item.id ? findFoodById(item.id) : null;
  if (!food) return 0;
  const per100 = getMicroFromFood(food as any, 'Na');
  if (!(per100 > 0)) return 0;
  return (per100 * (Number(item.amount) || 0)) / 100;
}

/**
 * Натрий позиции ПОСЛЕ смены граммовки (ручная правка/ужатие порции).
 * Приоритет — FOOD_DB × новая граммовка; если продукта в базе нет (коктейли,
 * составные блюда) — пропорционально прежнему `na`. Иначе соль в приёме остаётся
 * от старой порции: «порцию уменьшил вдвое, а соли столько же».
 */
export function naAfterResize(item: SodiumItemLike | null | undefined, nextAmount: number): number {
  if (!item) return 0;
  const amt = Math.max(0, Number(nextAmount) || 0);
  const food = item.id ? findFoodById(item.id) : null;
  const per100 = food ? Number(getMicroFromFood(food as any, 'Na')) || 0 : 0;
  if (per100 > 0) return Math.round((per100 * amt) / 100);
  const prevAmount = Number(item.amount) || 0;
  const prevNa = Number(item.na);
  if (Number.isFinite(prevNa) && prevNa > 0 && prevAmount > 0) return Math.round((prevNa * amt) / prevAmount);
  return 0;
}

/** Натрий приёма в мг (по позициям, с фолбэком на totals). */ export function mealSodiumMg(
  meal: SodiumMealLike | null | undefined,
): number {
  if (!meal) return 0;
  const items = Array.isArray(meal.items) ? meal.items : [];
  if (items.length === 0) return Math.max(0, Number(meal.totalsNa) || 0);
  const sum = items.reduce((s, it) => s + itemSodiumMg(it), 0);
  return Math.round(sum);
}

/** Натрий дня в мг. */
export function daySodiumMg(plan: any): number {
  const meals: SodiumMealLike[] = Array.isArray(plan?.meals)
    ? plan.meals
    : Array.isArray(plan?.days?.[0]?.meals)
      ? plan.days[0].meals
      : [];
  return Math.round(meals.reduce((s, m) => s + mealSodiumMg(m), 0));
}

/** мг натрия → г соли (NaCl = Na × 2.5). */
export function sodiumToSaltG(naMg: number): number {
  return Math.round((Math.max(0, naMg) * 2.5) / 10) / 100;
}

/** Цель по натрию: пик-неделя/преп-оверрайд важнее базовой RDA. */
export function sodiumTargetMg(override?: number | null): number {
  const v = Number(override);
  return Number.isFinite(v) && v > 0 ? v : SODIUM_RDA_MG;
}

/** Цвет-код доли дня: до 35% зелёный, до 50% жёлтый, выше — красный. */
export function sodiumTone(pct: number): { color: string; bg: string } {
  if (pct > 50) return { color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
  if (pct > 35) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' };
  return { color: '#86efac', bg: 'rgba(34,197,94,0.10)' };
}

/** Человекочитаемая подпись: «1.8 г соли · Na 720 мг». */
export function sodiumLabel(naMg: number): string {
  if (!(naMg > 0)) return '';
  const salt = sodiumToSaltG(naMg);
  return `${salt.toFixed(2)} г соли · Na ${Math.round(naMg)} мг`;
}
