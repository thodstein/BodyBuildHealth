/**
 * user-recipes.test.tsx — «Мои рецепты» и ⭐ избранное в одном месте.
 *
 * Раньше рецепт, созданный в Кухне, не находился в планировщике, и наоборот:
 * два разных ключа localStorage. Здесь проверяем, что оба списка читаются
 * вместе, создание пишет в оба хранилища, удаление убирает отовсюду, а
 * избранное — общий ключ с планировщиком (he_recipe_fav).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  createUserRecipe,
  deleteUserRecipe,
  readFavoriteRecipeNames,
  readUserRecipes,
  toggleRecipeFavorite,
} from '../diary/user-recipes';
import { RecipePickerPanel } from '../diary/RecipePickerPanel';
import { RecipesTabModern } from '../RecipesTabModern';
import { RECIPE_DB } from '../../../../data/recipe-db';

const store = () => JSON.parse(localStorage.getItem('he_recipes') || '[]');
const plannerStore = () => JSON.parse(localStorage.getItem('he_user_recipes') || '[]');

describe('user-recipes: единое хранилище', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('читает рецепты из обеих баз без дублей', () => {
    localStorage.setItem('he_recipes', JSON.stringify([
      { id: 'k1', name: 'Кухня-боул', ingredients: ['Рис 100 г'], kcal: 300, protein: 10, fat: 5, carbs: 40 },
    ]));
    localStorage.setItem('he_user_recipes', JSON.stringify([
      { id: 'p1', name: 'План-котлеты', ingredients: ['Курица 200 г'], kcal: 400, protein: 40, fat: 10, carbs: 5, meal: 'dinner' },
      // Дубль по названию (создан в другой базе) — не должен задвоиться.
      { id: 'p2', name: 'кухня-боул ', ingredients: [], kcal: 300, protein: 10, fat: 5, carbs: 40 },
    ]));

    const recipes = readUserRecipes();
    expect(recipes.map(r => r.name).sort()).toEqual(['Кухня-боул', 'План-котлеты']);
  });

  it('создание пишет рецепт в Кухню и в планировщик', () => {
    const created = createUserRecipe({
      name: 'Овсяноблин',
      ingredients: 'Яйца 2 шт\nОвсянка 30 г',
      instructions: 'Смешать и обжарить',
      kcal: 350, protein: 22, fat: 12, carbs: 30,
      meal: 'breakfast',
      tags: 'быстро, высокий белок',
      description: 'Быстрый завтрак без сахара',
    });

    expect(created.name).toBe('Овсяноблин');
    expect(created.description).toBe('Быстрый завтрак без сахара');
    expect(store()[0].description).toBe('Быстрый завтрак без сахара');
    expect(created.ingredients).toEqual(['Яйца 2 шт', 'Овсянка 30 г']);
    expect(created.tags).toEqual(['быстро', 'высокий белок']);
    expect(store().map((r: any) => r.name)).toContain('Овсяноблин');
    expect(plannerStore().map((r: any) => r.name)).toContain('Овсяноблин');
    // Планировщик ждёт prepTime, а не prepTimeMin.
    expect(plannerStore()[0].prepTime).toBe(10);
    expect(readUserRecipes().some(r => r.name === 'Овсяноблин')).toBe(true);
  });

  it('повторное создание с тем же названием не плодит дубли', () => {
    createUserRecipe({ name: 'Боул', kcal: 400, protein: 30, fat: 10, carbs: 40 });
    createUserRecipe({ name: 'боул', kcal: 450, protein: 35, fat: 12, carbs: 42 });

    expect(store()).toHaveLength(1);
    expect(plannerStore()).toHaveLength(1);
    expect(readUserRecipes()).toHaveLength(1);
    expect(readUserRecipes()[0].kcal).toBe(450);
  });

  it('удаление убирает рецепт из обеих баз', () => {
    createUserRecipe({ name: 'Удаляемый', kcal: 300 });
    const removed = deleteUserRecipe({ name: 'Удаляемый' });

    expect(removed).toEqual([]);
    expect(store()).toEqual([]);
    expect(plannerStore()).toEqual([]);
  });

  it('избранное — общий ключ с планировщиком', () => {
    expect(toggleRecipeFavorite('Борщ')).toBe(true);
    expect(readFavoriteRecipeNames()).toEqual(['Борщ']);
    expect(JSON.parse(localStorage.getItem('he_recipe_fav') || '[]')).toEqual(['Борщ']);
    // Повторный тап снимает звезду, регистр/пробелы не создают второй записи.
    expect(toggleRecipeFavorite(' борщ ')).toBe(false);
    expect(readFavoriteRecipeNames()).toEqual([]);
  });
});

describe('RecipePickerPanel: избранное и создание на месте', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('показывает ⭐ избранное и добавление из него', () => {
    const recipe = RECIPE_DB[0];
    localStorage.setItem('he_recipe_fav', JSON.stringify([recipe.name]));
    const onAdd = vi.fn();

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" initialQuery="" onAdd={onAdd} />,
    );

    expect(screen.getByText('⭐ Избранное')).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: `Добавить рецепт ${recipe.name} в дневник` });
    fireEvent.click(cards[0]);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: recipe.name });
    expect(onAdd.mock.calls[0][2]).toBe(false);
  });

  it('«＋ Рецепт» сохраняет рецепт в обе базы и сразу добавляет в приём', () => {
    const onAdd = vi.fn();

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Завтрак" initialQuery="Сырники" onAdd={onAdd} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Создать свой рецепт' }));
    const dialog = screen.getByRole('dialog', { name: 'Создать рецепт' });

    fireEvent.change(within(dialog).getByLabelText('Название рецепта'), { target: { value: 'Сырники фитнес' } });
    fireEvent.change(within(dialog).getByLabelText('Ингредиенты рецепта'), { target: { value: 'Творог 200 г\nЯйца 1 шт' } });
    fireEvent.change(within(dialog).getByLabelText('Описание рецепта'), { target: { value: 'Полезный завтрак после тренировки' } });
    fireEvent.change(within(dialog).getByLabelText('Ккал'), { target: { value: '320' } });
    fireEvent.change(within(dialog).getByLabelText('Белки'), { target: { value: '28' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить рецепт' }));

    expect(store().map((r: any) => r.name)).toContain('Сырники фитнес');
    expect(plannerStore().map((r: any) => r.name)).toContain('Сырники фитнес');
    expect(store()[0].description).toBe('Полезный завтрак после тренировки');
    // Приём подставлен из дневника: «Завтрак» → breakfast.
    expect(store()[0].meal).toBe('breakfast');

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: 'Сырники фитнес' });
    expect(onAdd.mock.calls[0][1]).toBe(1);
    expect(onAdd.mock.calls[0][2]).toBe(true);
  });

  it('рецепт находится поиском по описанию и показывает его в карточке', () => {
    createUserRecipe({
      name: 'Боул с лососем',
      ingredients: 'Лосось 120 г\nРис 80 г',
      kcal: 520,
      description: 'Быстрый обед после тренировки',
    });

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" initialQuery="после тренировки" onAdd={() => {}} />,
    );

    expect(screen.getByText('Боул с лососем')).toBeInTheDocument();
    expect(screen.getAllByText('Быстрый обед после тренировки').length).toBeGreaterThan(0);
  });

  it('не сохраняет рецепт без названия или калорийности', () => {
    const onAdd = vi.fn();

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" onAdd={onAdd} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Создать свой рецепт' }));
    const dialog = screen.getByRole('dialog', { name: 'Создать рецепт' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить рецепт' }));

    expect(within(dialog).getByRole('alert').textContent).toMatch(/название/i);
    expect(store()).toEqual([]);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('звёздочка на карточке отправляет рецепт в избранное', () => {
    const recipe = RECIPE_DB[0];

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" initialQuery={recipe.name} onAdd={() => {}} />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: `В избранное: ${recipe.name}` })[0]);

    expect(readFavoriteRecipeNames()).toEqual([recipe.name]);
    expect(screen.getByText('⭐ Избранное')).toBeInTheDocument();
  });
});

describe('Кухня: звёздочка, фильтр избранного и создание рецепта', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('⭐ на карточке пишет в общий ключ избранного', () => {
    render(<RecipesTabModern />);

    const stars = screen.getAllByRole('button', { name: /^В избранное: / });
    const firstLabel = stars[0].getAttribute('aria-label') || '';
    const name = firstLabel.replace('В избранное: ', '');

    fireEvent.click(stars[0]);

    expect(readFavoriteRecipeNames()).toContain(name);
    // Звезда сразу перевернулась — рецепт в избранном.
    expect(screen.getAllByRole('button', { name: `Убрать из избранного: ${name}` }).length).toBeGreaterThan(0);
  });

  it('фильтр «⭐ Избранное» оставляет только отмеченные рецепты', () => {
    render(<RecipesTabModern />);

    const stars = screen.getAllByRole('button', { name: /^В избранное: / });
    const name = (stars[0].getAttribute('aria-label') || '').replace('В избранное: ', '');
    fireEvent.click(stars[0]);

    const sameName = RECIPE_DB.filter(r => r.name === name).length;
    fireEvent.click(screen.getByRole('button', { name: /⭐ Избранное/ }));

    expect(screen.getByText(`${sameName} рецептов`)).toBeInTheDocument();
  });

  it('«＋ Рецепт» создаёт рецепт в общей базе (виден и планировщику)', () => {
    render(<RecipesTabModern />);

    fireEvent.click(screen.getByRole('button', { name: '＋ Рецепт' }));
    const dialog = screen.getByRole('dialog', { name: 'Создать рецепт' });
    fireEvent.change(within(dialog).getByLabelText('Название рецепта'), { target: { value: 'Куриный боул' } });
    fireEvent.change(within(dialog).getByLabelText('Ингредиенты рецепта'), { target: { value: 'Курица 200 г\nРис 100 г' } });
    fireEvent.change(within(dialog).getByLabelText('Ккал'), { target: { value: '650' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить рецепт' }));

    expect(store().map((r: any) => r.name)).toContain('Куриный боул');
    expect(plannerStore().map((r: any) => r.name)).toContain('Куриный боул');
    // Появился в «Моих рецептах» с кнопкой добавления в дневник.
    expect(screen.getByText('Куриный боул')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить рецепт Куриный боул в дневник' })).toBeInTheDocument();
  });

  it('свой рецепт удаляется только вторым тапом по ✕', () => {
    createUserRecipe({ name: 'Суп на ужин', ingredients: 'Курица 200 г', kcal: 320 });
    render(<RecipesTabModern />);

    // Список «Мои рецепты» по умолчанию свёрнут.
    fireEvent.click(screen.getByText('Мои рецепты'));

    fireEvent.click(screen.getByRole('button', { name: 'Удалить рецепт Суп на ужин' }));
    // Первый тап — только вопрос: рецепт на месте в обеих базах.
    expect(store().map((r: any) => r.name)).toContain('Суп на ужин');
    expect(plannerStore().map((r: any) => r.name)).toContain('Суп на ужин');

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление рецепта Суп на ужин' }));
    expect(store()).toEqual([]);
    expect(plannerStore()).toEqual([]);
  });
});

describe('RecipePickerPanel: без дублей между секциями', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('избранный свой рецепт показывается один раз — в ⭐ Избранное', () => {
    createUserRecipe({ name: 'Мой боул', ingredients: 'Курица 200 г\nРис 100 г', kcal: 650 });
    toggleRecipeFavorite('Мой боул');

    render(
      <RecipePickerPanel open onClose={() => {}} mealType="Обед" onAdd={() => {}} />,
    );

    expect(screen.getByText('⭐ Избранное')).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: 'Добавить рецепт Мой боул в дневник' });
    expect(cards).toHaveLength(1);
  });
});
