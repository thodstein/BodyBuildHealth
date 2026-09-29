/**
 * planner-meal-affinity.ts — E1 (PRO-план §3): матрица «продукт × слот».
 *
 * Задача — не давать движку ставить off-slot еду: овсянку в обед/ужин
 * (завтрак-стейпл), субпродукты в перекус, тяжёлые завтрак-злаки в основные
 * приёмы. Чистая функция без FOOD_DB: принимает id продукта и слот, возвращает
 * допустимость. Дефолт для неизвестного продукта — РАЗРЕШЕНО (обратная
 * совместимость: ничего не ломается, только добавляются запреты).
 *
 * Источники правил: NUTRITION-VARIETY-PLAN §4 (food–meal affinity, MIGP),
 * TUNING §2 (fractionation/timing) + клинические peri/pre-sleep правила.
 */

export type AffinitySlot =
  | 'breakfast' | 'lunch' | 'dinner' | 'snack'
  | 'preworkout' | 'postworkout' | 'intra' | 'presleep';

// Завтрак-стейплы (каши/хлопья/злаковые завтраки) — не место в обеде/ужине.
// Хлеб/рис/картофель/паста — обычные обедо-ужинные носители, их НЕ баним.
const BREAKFAST_STAPLE_RE = /(^|_)(oat|oats|oatmeal|oat_bran|porridge|corn_flakes|muesli|granola|pancake|pancakes|breakfast_cereal|cereal)(_|$)/i;

// Субпродукты — еда основных приёмов (обед/ужин), не перекуса.
const ORGAN_MEAT_RE = /(^|_)(liver|kidney|pate|tongue|heart_tripe|brain|sweetbread)(_|$)/i;

// Бобовые — полноценный приём (обед/ужин), не перекус.
const LEGUME_RE = /(^|_)(legume|lentil|lentils|chickpea|chickpeas|bean|beans|pea|peas)(_|$)/i;

/**
 * Допустим ли продукт в слоте. Default true (совместимость). Правила —
 * только явные запреты; игровые/id-семейства матчатся по токенам.
 */
export function afAllows(foodId: string | null | undefined, slot: AffinitySlot): boolean {
  const id = String(foodId || '').toLowerCase();
  if (!id) return true;
  switch (slot) {
    case 'lunch':
    case 'dinner':
      // Завтрак-стейпл (овсянка/хлопья) в обед/ужин — off-slot.
      if (BREAKFAST_STAPLE_RE.test(id)) return false;
      return true;
    case 'snack':
      // Субпродукты/бобовые в перекус — мусорная корзина.
      if (ORGAN_MEAT_RE.test(id)) return false;
      if (LEGUME_RE.test(id)) return false;
      return true;
    case 'preworkout':
      // Peri-окно: только лёгкие углеводы/быстрый белок (детально — в движке).
      if (ORGAN_MEAT_RE.test(id)) return false;
      return true;
    default:
      return true;
  }
}

/** Отфильтровать пул с fallback: если после фильтра пусто — вернуть исходный
 *  (не оставляем приём без носителя из-за слишком строгого правила). */
export function afFilterPool<T extends { id: string }>(pool: T[], slot: AffinitySlot): T[] {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  const filtered = pool.filter(f => afAllows(f.id, slot));
  return filtered.length > 0 ? filtered : pool;
}
