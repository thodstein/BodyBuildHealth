/**
 * planner-plan-write.ts — чистые операции записи в план (B3, B8 аудита 2026-10).
 *
 * Вынесены из `IndividualPlanContext`, чтобы их можно было покрыть регрессионными
 * тестами: внутри провайдера они были недостижимы для unit-тестов, а именно здесь
 * жили две порчи данных:
 *
 *  • B3 — `addPlanToDiary` добавлял позиции без стабильного тега, поэтому повторное
 *    нажатие «в дневник» удваивало записи (и перегенерация дня тоже).
 *  • B8 — правки приёма из 3-дневного/недельного вида писались только в `dayPlan`
 *    (копию видимого дня) и терялись при возврате к полному плану.
 */

export type PlanKey = 'week' | 'three';

/**
 * B8: нужно ли зеркалить правку в `dayPlan`.
 *
 * `dayPlan` — это КОПИЯ дня, открытого на редактирование. Правку нужно зеркалить
 * только тогда, когда редактируется именно этот день; иначе правка «уедет» в
 * чужой день, который пользователь даже не открывал.
 */
export function shouldMirrorToDayPlan(
  planKey: PlanKey,
  day: number,
  weekEditDay: number | null,
  threeEditDay: number | null,
): boolean {
  return planKey === 'week'
    ? weekEditDay !== null && weekEditDay === day
    : threeEditDay !== null && threeEditDay === day;
}

/** Сумма итогов по дням плана (неделя/3 дня) — как раньше в контексте, без округления. */
export function sumPlanDaysTotals(days: any[]): { kcal: number; p: number; f: number; c: number } {
  return {
    kcal: days.reduce((s: number, d: any) => s + (d?.totals?.kcal || 0), 0),
    p: days.reduce((s: number, d: any) => s + (d?.totals?.p || 0), 0),
    f: days.reduce((s: number, d: any) => s + (d?.totals?.f || 0), 0),
    c: days.reduce((s: number, d: any) => s + (d?.totals?.c || 0), 0),
  };
}

/**
 * B8: записать обновлённый список приёмов в КОНКРЕТНЫЙ день конкретного плана.
 *
 * Возвращает новую структуру плана (исходная не мутируется) или `null`, если такого
 * дня нет — вызывающий код в этом случае ничего не пишет, а не создаёт «пустой» день.
 * Итоги дня и итоги плана пересчитываются здесь же, чтобы не было расхождений
 * между карточкой дня и шапкой недели.
 */
export function writeMealsToPlanDay<P extends { days: any[]; totals?: any }>(
  plan: P | null | undefined,
  day: number,
  applyToMeals: (meals: any[]) => any[],
): P | null {
  if (!plan || !Array.isArray(plan.days) || !plan.days[day]) return null;
  const days = [...plan.days];
  // Глубокая копия ровно одного дня: соседние дни остаются теми же объектами.
  const d = JSON.parse(JSON.stringify(days[day]));
  if (!d || !Array.isArray(d.meals)) return null;
  d.meals = applyToMeals(d.meals);
  d.totals = sumMealsTotals(d.meals);
  days[day] = d;
  return { ...plan, days, totals: sumPlanDaysTotals(days) };
}

/** Итоги одного дня (внутренняя копия `sumDayTotals`, без внешних зависимостей). */
export function sumMealsTotals(meals: any[]): { kcal: number; p: number; f: number; c: number; fiber: number; leucine_mg: number } {
  const acc = (meals || []).reduce((s: any, m: any) => {
    const t = m?.totals || {};
    s.kcal += t.kcal || 0; s.p += t.p || 0; s.f += t.f || 0; s.c += t.c || 0;
    s.fiber += t.fiber || 0; s.leucine_mg += t.leucine_mg || 0;
    return s;
  }, { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: acc.kcal, p: r1(acc.p), f: r1(acc.f), c: r1(acc.c),
    fiber: r1(acc.fiber), leucine_mg: Math.round(acc.leucine_mg),
  };
}

/**
 * B3: идемпотентно перенести день плана в дневник.
 *
 * Каждая позиция получает стабильный тег `plan:дата:приём:продукт:граммы`.
 * Повторный вызов (или перегенерация того же дня с тем же составом) не создаёт
 * дублей — позиция попадает в `skipped`. Именно этого не хватало: раньше сравнение
 * шло по «имени+граммам», и любая перегенерация плодила копии.
 */
export function mergePlanDayIntoDiary(
  diary: Record<string, any>,
  dayPlan: any,
  dateStr: string,
): { added: number; skipped: number } {
  if (!dayPlan?.meals || !Array.isArray(dayPlan.meals) || dayPlan.meals.length === 0) {
    return { added: 0, skipped: 0 };
  }
  if (!diary[dateStr]) diary[dateStr] = { meals: {} };
  if (!diary[dateStr].meals) diary[dateStr].meals = {};
  let added = 0;
  let skipped = 0;
  for (const m of dayPlan.meals) {
    const label = m?.label || 'Приём пищи';
    if (!diary[dateStr].meals[label]) diary[dateStr].meals[label] = [];
    const bucket = diary[dateStr].meals[label] as any[];
    for (const it of (Array.isArray(m?.items) ? m.items : [])) {
      const grams = it.amount || 100;
      const foodKey = it.id || it.foodId || it.name;
      const planTag = `plan:${dateStr}:${label}:${foodKey}:${grams}`;
      if (bucket.some((e: any) => e && e.planTag === planTag)) { skipped++; continue; }
      bucket.push({
        name: it.name, qty: `${grams} г`, kcal: Math.round(it.kcal || 0),
        p: Math.round((it.p || 0) * 10) / 10, f: Math.round((it.f || 0) * 10) / 10, c: Math.round((it.c || 0) * 10) / 10,
        category: it.category, foodId: it.id || it.foodId, micros: it.micros,
        planTag,
      });
      added++;
    }
  }
  return { added, skipped };
}
