/**
 * planner-allergen-safety.test.ts — P0-фиксы безопасности аллергенов/вегетарианства.
 *
 * 1) getFoodAllergenTags объединяет FOOD_ALLERGEN_DIET и FoodItem.allergens (раньше
 *    явные теги литерала игнорировались, если авто-запись существовала).
 * 2) pollock / red_caviar / tilapia исключаются при аллергии на рыбу (эвристика id
 *    их не распознавала).
 * 3) red_caviar (category:'fat', isVegetarian:false) НЕ вегетарианский.
 * 4) Глютен-свободные grain/carb (millet/corn_flakes/cream_of_rice) не ложно-глютеновые.
 * 5) foodPassesCtxAllergens — fail-closed (проверяется косвенно через движок тегами).
 */
import { describe, it, expect } from 'vitest';
import { getFoodAllergenTags, resolveAllergenFoodIds, selectedAllergenTags } from '../planner-restrictions';
import { FOOD_ALLERGEN_DIET, FOOD_DB } from '../../../../../core/nutrition-database';

describe('P0: объединение источников аллерген-тегов', () => {
  it('getFoodAllergenTags включает тег литерала даже при наличии авто-записи', () => {
    // pollock: literal allergens:['fish'], id не содержит 'fish' → раньше терялся
    expect(getFoodAllergenTags('pollock', FOOD_DB)).toContain('fish');
    expect(getFoodAllergenTags('red_caviar', FOOD_DB)).toContain('fish');
  });

  it('resolveAllergenFoodIds исключает pollock/red_caviar/tilapia при аллергии «рыба»', () => {
    const ex = resolveAllergenFoodIds(FOOD_DB, ['рыба']);
    expect(ex.has('pollock')).toBe(true);
    expect(ex.has('red_caviar')).toBe(true);
    expect(ex.has('tilapia')).toBe(true);
  });

  it('морские продукты без слова fish в id получают тег fish (tilapia/sea_bass/halibut)', () => {
    expect(getFoodAllergenTags('tilapia', FOOD_DB)).toContain('fish');
    expect(getFoodAllergenTags('sea_bass', FOOD_DB)).toContain('fish');
    expect(getFoodAllergenTags('halibut', FOOD_DB)).toContain('fish');
  });
});

describe('P0: вегетарианство и глютен по литералу БД', () => {
  it('red_caviar не вегетарианский (был вегетарианским из-за category fat)', () => {
    expect(FOOD_ALLERGEN_DIET['red_caviar'].isVegetarian).toBe(false);
    expect(FOOD_ALLERGEN_DIET['red_caviar'].isVegan).toBe(false);
  });

  it('глютен-свободные grain/carb не помечены глютеновыми', () => {
    for (const id of ['millet', 'corn_flakes', 'cream_of_rice', 'rice_semolina']) {
      const t = getFoodAllergenTags(id, FOOD_DB);
      expect(t).not.toContain('gluten');
      expect(FOOD_ALLERGEN_DIET[id]?.isGlutenFree).toBe(true);
    }
  });

  it('пшеничные продукты по-прежнему глютеновые', () => {
    expect(getFoodAllergenTags('whole_grain_bread', FOOD_DB)).toContain('gluten');
    expect(getFoodAllergenTags('bulgur', FOOD_DB)).toContain('gluten');
  });
});

describe('P0: тег-гейт движка согласован с резолвером', () => {
  it('selectedAllergenTags(«рыба») содержит fish', () => {
    expect(selectedAllergenTags(['рыба'], []).has('fish')).toBe(true);
  });
});
