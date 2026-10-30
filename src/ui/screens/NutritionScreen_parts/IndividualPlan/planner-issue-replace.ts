/**
 * planner-issue-replace.ts — выбор позиции для замены по проблеме дня (B5, аудит 2026-10).
 *
 * Вынесено из `IndividualPlanResults` (было объявлено внутри компонента, поэтому
 * недостижимо для тестов).
 *
 * Почему это нужно: кнопка «🔀 Заменить на» искала ПРЕДЛОЖЕННЫЙ продукт внутри приёма,
 * а предложения строятся по принципу «этого продукта в приёме ещё нет» — значит
 * `indexOf` всегда давал −1, и `replaceFoodItem(..., -1, ...)` не срабатывал никогда.
 * Теперь мы осмысленно выбираем, ЧТО заменить, исходя из типа проблемы.
 */
import { FOOD_DB } from "../../../../core/nutrition-database";

/**
 * Индекс «жертвы» для замены или −1, если менять нечего.
 *
 *   low_protein / low_diaas — позицию с наименьшим вкладом белка;
 *   low_leucine            — позицию с наименьшим лейцином;
 *   low_fiber              — углеводную позицию с наименьшей клетчаткой;
 *   high_fat               — позицию с наибольшим жиром;
 *   high_carb              — позицию с наибольшими углеводами.
 *
 * Жидкости (роль 'liquid') не рассматриваются: их замена не меняет КБЖУ приёма.
 */
export function pickReplaceIdxForIssue(items: any[], issueType: string): number {
  if (!Array.isArray(items) || items.length === 0) return -1;
  const leucineOf = (it: any): number => {
    const f: any = FOOD_DB.find(x => x.id === it.id || x.name === it.name);
    if (!f) return it.leucine_mg || 0;
    const per100 = (f as any).amino_acid_profile_100g?.leucine_mg ?? (f as any).micros?.Leucine ?? (f.protein ? Math.round(f.protein * 75) : 0);
    return per100 * ((it.amount || 100) / 100);
  };
  const idxOfMin = (fn: (it: any) => number): number => {
    let best = -1, bestVal = Infinity;
    items.forEach((it: any, i: number) => {
      if (!it || (it as any).role === 'liquid') return;
      const v = fn(it);
      if (Number.isFinite(v) && v < bestVal) { bestVal = v; best = i; }
    });
    return best;
  };
  const idxOfMax = (fn: (it: any) => number): number => {
    let best = -1, bestVal = -Infinity;
    items.forEach((it: any, i: number) => {
      if (!it || (it as any).role === 'liquid') return;
      const v = fn(it);
      if (Number.isFinite(v) && v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  };
  switch (issueType) {
    case 'low_protein':
      return idxOfMin((it) => (it.p || 0));
    case 'low_diaas':
      // меняем худший по белку источник животного/полноценного белка
      return idxOfMin((it) => (it.p || 0));
    case 'low_leucine':
      return idxOfMin((it) => leucineOf(it));
    case 'low_fiber': {
      const carbIdx = items.findIndex((it: any) => it && (it.role === 'carb_slow' || it.role === 'carb_fast'));
      if (carbIdx >= 0) {
        const onlyCarb = idxOfMin((it) => {
          const f: any = FOOD_DB.find(x => x.id === it.id || x.name === it.name);
          return (it.role === 'carb_slow' || it.role === 'carb_fast') ? (f?.fiber ?? it.fiber ?? 0) : Infinity;
        });
        return onlyCarb >= 0 ? onlyCarb : carbIdx;
      }
      return idxOfMin((it) => (it.fiber || 0));
    }
    case 'high_fat':
      return idxOfMax((it) => (it.f || 0));
    case 'high_carb':
      return idxOfMax((it) => (it.c || 0));
    default:
      return -1;
  }
}
