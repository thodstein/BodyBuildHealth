/**
 * recipe-to-diary.test.tsx — рецепт как запись дневника.
 *
 * Проверяем то, ради чего всё делалось: в дневник попадает не «блюдо одной
 * строкой с итогом», а название рецепта + общее КБЖУ + КБЖУ каждого продукта,
 * и это переживает сохранение/чтение storage и раскрывается в карточке приёма.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  buildRecipeDiaryEntry,
  componentsFromIngredientLines,
  customRecipeToRecipe,
  parseIngredientLine,
  recipeMicros,
  scaleDiaryRecipeMeta,
} from '../diary/recipe-to-diary';
import { RECIPE_DB } from '../../../../data/recipe-db';
import { readDiaryV2, writeDiaryV2 } from '../diary-storage-v2';
import { MealCard } from '../diary/MealCard';
import { RecipePickerPanel } from '../diary/RecipePickerPanel';

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

describe('parseIngredientLine', () => {
  it('отделяет название от граммов', () => {
    expect(parseIngredientLine('Куриная грудка 200 г')).toEqual({ name: 'Куриная грудка', grams: 200 });
  });

  it('понимает столовые ложки', () => {
    const parsed = parseIngredientLine('Оливковое масло 1 ст. л.');
    expect(parsed.name).toBe('Оливковое масло');
    expect(parsed.grams).toBe(15);
  });

  it('не принимает жирность «5%» за порцию', () => {
    const parsed = parseIngredientLine('Творог 5%');
    expect(parsed.grams).toBe(100);
    expect(parsed.name).toContain('Творог');
  });

  it('без количества оставляет продукт целиком', () => {
    expect(parseIngredientLine('Соль')).toEqual({ name: 'Соль', grams: 100 });
  });
});

describe('componentsFromIngredientLines', () => {
  it('строит продукты с КБЖУ для пользовательского рецепта', () => {
    const components = componentsFromIngredientLines([
      'Куриная грудка 200 г',
      'Гречка 150 г',
      'Оливковое масло 1 ст. л.',
    ]);
    expect(components).toHaveLength(3);
    const chicken = components[0];
    expect(chicken.qty).toBe(200);
    expect(chicken.kcal).toBeGreaterThan(0);
    expect(chicken.p).toBeGreaterThan(0);
    expect(components[2].qty).toBe(15);
    // Итог по составу — сумма продуктов, а не независимое число.
    expect(sum(components.map(c => c.kcal))).toBeGreaterThan(300);
  });

  it('не теряет ингредиент, которого нет в каталоге', () => {
    const components = componentsFromIngredientLines(['Фрямба 30 г']);
    expect(components).toHaveLength(1);
    expect(components[0].name).toBe('Фрямба');
    expect(components[0].qty).toBe(30);
    expect(components[0].kcal).toBe(0);
  });
});

describe('buildRecipeDiaryEntry', () => {
  it('рецепт из базы раскладывается на продукты', () => {
    const recipe = RECIPE_DB[0];
    const entry = buildRecipeDiaryEntry(recipe);
    expect(entry.name).toBe(recipe.name);
    expect(entry.recipe).toBeDefined();
    const components = entry.recipe!.components;
    expect(components.length).toBeGreaterThan(0);
    const weight = components.reduce((s, c) => s + c.qty, 0);
    expect(entry.recipe!.totalWeight).toBe(weight);
    expect(Number(entry.qty)).toBe(weight);
    // КБЖУ записи — на 100 г, поэтому итог = per100 × вес / 100.
    const totalKcal = sum(components.map(c => c.kcal));
    expect(Number(entry.kcal)).toBeCloseTo(totalKcal / weight * 100, 1);
  });

  it('множитель порции масштабирует и продукты, и итог', () => {
    const recipe = RECIPE_DB[0];
    const one = buildRecipeDiaryEntry(recipe);
    const two = buildRecipeDiaryEntry(recipe, { servings: 2 });
    expect(two.recipe!.totalWeight).toBeCloseTo(one.recipe!.totalWeight * 2, -1);
    expect(two.recipe!.servings).toBe(2);
    expect(two.recipe!.components.length).toBe(one.recipe!.components.length);
  });

  it('пользовательский рецепт из «Моих рецептов» тоже даёт состав', () => {
    const custom = customRecipeToRecipe({
      id: 'u1',
      name: 'Мой омлет',
      ingredients: ['2 яйца', 'Молоко 50 мл'],
      kcal: 300, protein: 20, fat: 15, carbs: 5,
      instructions: 'Смешать и пожарить',
    });
    const entry = buildRecipeDiaryEntry(custom, { servings: 1, custom: true });
    expect(entry.name).toBe('Мой омлет');
    expect(entry.recipe!.custom).toBe(true);
    expect(entry.recipe!.components.length).toBe(2);
    expect(entry.kcal).toBeGreaterThan(0);
  });
});

describe('scaleDiaryRecipeMeta', () => {
  it('пересчитывает продукты при смене веса записи', () => {
    const entry = buildRecipeDiaryEntry(RECIPE_DB[0]);
    const scaled = scaleDiaryRecipeMeta(entry.recipe, 2);
    expect(scaled!.totalWeight).toBeCloseTo(entry.recipe!.totalWeight * 2, -1);
    expect(scaled!.components.reduce((s, c) => s + c.qty, 0)).toBeCloseTo(scaled!.totalWeight, -1);
  });

  it('не трогает запись без состава', () => {
    expect(scaleDiaryRecipeMeta(undefined, 2)).toBeUndefined();
  });
});

describe('RecipePickerPanel', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('находит рецепт из «Моих рецептов» и добавляет его с выбранной порцией', () => {
    localStorage.setItem('he_recipes', JSON.stringify([{
      id: 'r1',
      name: 'Мой боул',
      ingredients: ['Курица 200 г', 'Рис 150 г'],
      instructions: 'Смешать',
      kcal: 620, protein: 45, fat: 12, carbs: 70,
    }]));
    const onAdd = vi.fn();

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" initialQuery="боул" onAdd={onAdd} />,
    );

    expect(screen.getByText('Мой боул')).toBeInTheDocument();
    const myCard = document.querySelectorAll('.nd-recipe-card')[0] as HTMLElement;
    fireEvent.click(within(myCard).getByRole('button', { name: 'Порция 2' }));
    fireEvent.click(within(myCard).getByRole('button', { name: 'Добавить рецепт Мой боул в дневник' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: 'Мой боул' });
    expect(onAdd.mock.calls[0][1]).toBe(2);
    expect(onAdd.mock.calls[0][2]).toBe(true);
  });

  it('показывает рецепты встроенной базы', () => {
    const onAdd = vi.fn();
    const recipe = RECIPE_DB[0];

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" initialQuery={recipe.name} onAdd={onAdd} />,
    );

    fireEvent.click(screen.getByRole('button', { name: `Добавить рецепт ${recipe.name} в дневник` }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][2]).toBe(false);
  });
});

describe('дневник: рецепт переживает сохранение и раскрывается в карточке', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('сохраняет состав рецепта в nutrition_diary_v2', () => {
    const entry = buildRecipeDiaryEntry(RECIPE_DB[0]);
    const weight = Number(entry.qty);
    writeDiaryV2({
      '2026-11-20': {
        meals: {
          Обед: [{
            name: entry.name,
            qty: weight,
            kcal: Math.round(Number(entry.kcal) * weight / 100),
            p: entry.p, f: entry.f, c: entry.c,
            recipe: entry.recipe,
          }],
        },
      },
    });

    const stored = readDiaryV2()['2026-11-20'].meals['Обед'][0];
    expect(stored.name).toBe(RECIPE_DB[0].name);
    expect(stored.recipe?.components.length).toBeGreaterThan(0);
    expect(stored.recipe?.components[0].name).toBeTruthy();
  });

  it('показывает «Состав» и КБЖУ каждого продукта по клику', () => {
    const item = {
      name: 'Борщ',
      qty: 400,
      kcal: 240, p: 12, f: 8, c: 28,
      recipe: {
        name: 'Борщ',
        servings: 1,
        totalWeight: 400,
        components: [
          { name: 'Свёкла', qty: 100, kcal: 43, p: 1.6, f: 0.2, c: 9.6 },
          { name: 'Говядина', qty: 150, kcal: 280, p: 39, f: 13, c: 0 },
        ],
      },
    };

    render(
      <MealCard
        mealName="Обед"
        items={[item]}
        onEditItem={() => {}}
        onDeleteItem={() => {}}
        onCopyMeal={() => {}}
        onSavePreset={() => {}}
      />,
    );

    expect(screen.getByText('🍲 рецепт')).toBeInTheDocument();
    expect(screen.queryByText('Свёкла')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Состав рецепта Борщ/i }));

    expect(screen.getByText('Свёкла')).toBeInTheDocument();
    expect(screen.getByText('Говядина')).toBeInTheDocument();
    expect(screen.getByText('100 г')).toBeInTheDocument();
    expect(screen.getByText(/43 ккал/)).toBeInTheDocument();
  });
});

describe('recipeMicros: блюдо не выпадает из отчёта по витаминам', () => {
  it('считает микронутриенты по продуктам состава', () => {
    const micros = recipeMicros([
      { name: 'Куриная грудка', qty: 200, kcal: 220, p: 42, f: 4, c: 0 },
      { name: 'Гречка', qty: 150, kcal: 500, p: 19, f: 5, c: 90 },
    ]);
    expect(micros).toBeDefined();
    // Ключи — как у дневника (`calcium_mg`, `iron_mg`, …), а не `Ca`/`Fe`.
    const keys = Object.keys(micros || {});
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some(key => key.endsWith('_mg') || key.endsWith('_mcg'))).toBe(true);
    expect(Object.values(micros || {}).every(value => Number(value) > 0)).toBe(true);
  });

  it('пропорционален граммовке продукта', () => {
    const small = recipeMicros([{ name: 'Куриная грудка', qty: 100, kcal: 110, p: 21, f: 2, c: 0 }])!;
    const big = recipeMicros([{ name: 'Куриная грудка', qty: 200, kcal: 220, p: 42, f: 4, c: 0 }])!;
    const key = Object.keys(small)[0];
    expect(big[key]).toBeCloseTo(small[key] * 2, 1);
  });

  it('без сопоставленных продуктов возвращает undefined', () => {
    expect(recipeMicros([{ name: 'Фрямба', qty: 30, kcal: 0, p: 0, f: 0, c: 0 }])).toBeUndefined();
  });
});
