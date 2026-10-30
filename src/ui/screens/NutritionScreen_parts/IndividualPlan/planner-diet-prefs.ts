/**
 * planner-diet-prefs.ts — B21 (аудит 2026-10).
 *
 * Находка: при сохранении в профиль писалось только `dietType = dietPrefs[0]`:
 * пользователь с `['vegetarian', 'halal']` терял второй пункт, а профиль читают
 * другие экраны. Теперь хранится полный набор в `dietTypes`, а `dietType`
 * остаётся первым элементом для обратной совместимости.
 */

export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';

const clean = (list: unknown): string[] =>
  (Array.isArray(list) ? list : [])
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    .map(d => d.trim());

/** Патч профиля из выбранных предпочтений. Пустой набор → пустой патч (не затираем профиль). */
export function dietPrefsToNutritionPatch(dietPrefs: unknown): { dietType?: DietType; dietTypes?: DietType[] } {
  const list = clean(dietPrefs) as DietType[];
  if (list.length === 0) return {};
  return { dietTypes: list, dietType: list[0] };
}

/** Обратное чтение: полный набор, иначе одиночный `dietType` (старые профили). */
export function dietPrefsFromNutrition(nutrition: any): DietType[] {
  const many = clean(nutrition?.dietTypes) as DietType[];
  if (many.length > 0) return many;
  const one = clean([nutrition?.dietType]) as DietType[];
  return one.length > 0 && one[0] !== 'omnivore' ? one : [];
}
