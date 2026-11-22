/**
 * diary-item-qty.ts — правка порции записи дневника.
 *
 * Одно место для пересчёта: диалог порции в дневнике и правка строки списка на
 * виджете обязаны давать одинаковые числа. Раньше формула жила только в
 * `useDiaryDayOps.saveEdit`, и виджет не умел править запись вовсе.
 *
 * КБЖУ, микроэлементы и состав рецепта пересчитываются от сохранённой порции
 * пропорционально: в записи лежат значения за порцию, а не за 100 г, поэтому
 * `per100(current) * nextQty / 100` даёт те же числа, что и редактор дневника.
 */
import type { DiaryItem } from '../types';
import { scaleDiaryRecipeMeta } from './recipe-to-diary';

/** Сколько граммов в записи: `qty` бывает числом и строкой «150 г». */
export function diaryItemQty(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 100;
  }
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

/**
 * Запись с новой порцией. Остальные поля (продукт, штрихкод, приём) сохраняются:
 * правка порции не превращает продукт в другое блюдо.
 */
export function withDiaryItemQty(current: DiaryItem | Record<string, any>, nextQty: number): any {
  const item = current as Record<string, any>;
  const savedQty = diaryItemQty(item?.qty);
  const qty = Number.isFinite(nextQty) && nextQty > 0 ? nextQty : savedQty;
  const per100 = (value: number) => Number(value || 0) / savedQty * 100;
  const portion = (value: number, decimals = 1) => {
    const factor = 10 ** decimals;
    return Math.round(per100(value) * qty / 100 * factor) / factor;
  };
  const recipeMeta = scaleDiaryRecipeMeta(item?.recipe, savedQty > 0 ? qty / savedQty : 1);
  return {
    ...item,
    qty,
    kcal: Math.round(portion(item.kcal, 0)),
    p: portion(item.p),
    f: portion(item.f),
    c: portion(item.c),
    micros: item.micros
      ? Object.fromEntries(
          Object.entries(item.micros).map(([key, value]) => [key, portion(Number(value), 2)]),
        )
      : item.micros,
    ...(recipeMeta ? { recipe: recipeMeta } : {}),
  };
}
