/**
 * planner-derived-sync.ts — G2 (HIGH-VOLUME план, разд. 7): единый реактивный синк
 * производных карточек (закупки / готовка / рекомендации).
 *
 * Проблема: рецептурные пути синкают закупки вручную в 8 местах, а ручные правки
 * (addFood/replaceFood/updateAmount/remove/move/time/duplicate) обновляют только
 * meals/totals через _applyDayPlanMealUpdate/updateMultiDayPlan. mealPrepPlan — только
 * по кнопке, recommendations — по кнопке + эффект на injections.length. Карточки stale.
 *
 * Решение: один useEffect-конвергер с debounce (~400 мс) на видимых планах.
 * Явные setShoppingList-вызовы остаются как немедленный путь (то же чистое значение —
 * buildShoppingFromPlans детерминирован, гонки нет: эффект сходится к тому же результату).
 */
import { useEffect, useRef } from 'react';
import { buildShoppingFromPlans } from './planner-recipe-mode';

export interface DerivedSyncPlans {
  planDays: number;
  dayPlan: any;
  threeDayPlan: any;
  weekPlan: any;
  selectedDayIndex: number;
  weekEditDay: number | null;
  mealPrepDays: 1 | 3 | 7;
  generated: boolean;
}

/** Видимые планы — та же логика выбора, что в F-ветках replaceMealWithRecipe. */
export function selectVisiblePlans(p: Pick<DerivedSyncPlans, 'planDays' | 'dayPlan' | 'threeDayPlan' | 'weekPlan' | 'selectedDayIndex'>): any[] {
  if (p.planDays >= 7 && (p.weekPlan as any)?.days?.length) return (p.weekPlan as any).days;
  if (p.planDays >= 3 && (p.threeDayPlan as any)?.days?.length) {
    return (p.threeDayPlan as any).days.map((d: any, i: number) =>
      i === p.selectedDayIndex && p.dayPlan ? p.dayPlan : d,
    );
  }
  if (p.dayPlan) return [p.dayPlan];
  return [];
}

function plansSignature(plans: any[]): string {
  try {
    return plans.map(dp =>
      (dp?.meals || []).map((m: any) =>
        `${m.label}:${(m.items || []).map((it: any) => `${it.id}x${it.amount}`).join(',')}`,
      ).join('|'),
    ).join('~');
  } catch {
    return '';
  }
}

export interface DerivedSyncActions {
  setShoppingList: (v: any) => void;
  refreshRecipeCookingCardIfActive: (dayP: any, threeP: any, weekP: any) => void;
  recipeCookingActive: () => boolean;
  setMealPrepPlan: (v: any) => void;
  getMealPrepPlan: () => any;
  generateRecommendations: () => void;
}

const DERIVED_SYNC_DEBOUNCE_MS = 400;

/**
 * Конвергер производных карточек. Вызывать один раз в провайдере.
 * Ничего не делает до первой генерации (generated=false).
 */
export function usePlannerDerivedSync(plans: DerivedSyncPlans, actions: DerivedSyncActions): void {
  const timer = useRef<any>(null);
  const lastSig = useRef<string>('');
  const lastPrepDays = useRef<number>(plans.mealPrepDays);
  const acts = useRef(actions);
  acts.current = actions;

  const visible = selectVisiblePlans(plans);
  const sig = plans.generated ? plansSignature(visible) : '';

  useEffect(() => {
    if (!plans.generated || sig === '' || sig === lastSig.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        if (sig !== lastSig.current) {
          lastSig.current = sig;
          const a = acts.current;
          const vplans = selectVisiblePlans(plans);
          if (vplans.length > 0) a.setShoppingList(buildShoppingFromPlans(vplans));
          if (a.recipeCookingActive()) {
            a.refreshRecipeCookingCardIfActive(plans.dayPlan, plans.threeDayPlan, plans.weekPlan);
          } else {
            // Generic-готовка устарела молча — помечаем, не стираем (кнопка пересоберёт).
            const prev = a.getMealPrepPlan();
            if (prev && !(prev as any)._stale) {
              a.setMealPrepPlan({ ...(prev as any), _stale: true });
            }
          }
          // mealPrepDays влияет только на готовку — смена горизонта инвалидирует её тоже.
          if (lastPrepDays.current !== plans.mealPrepDays) {
            lastPrepDays.current = plans.mealPrepDays;
            const prev = a.getMealPrepPlan();
            if (prev && !(prev as any)._stale) a.setMealPrepPlan({ ...(prev as any), _stale: true });
          }
          a.generateRecommendations();
        }
      } catch {}
    }, DERIVED_SYNC_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, plans.generated, plans.mealPrepDays]);
}
