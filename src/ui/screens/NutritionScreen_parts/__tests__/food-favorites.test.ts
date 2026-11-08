import { describe, it, expect, beforeEach } from 'vitest';
import { FOOD_DB } from '../../../../core/nutrition-database';
import {
  addFavorite, isFavorite, readFavIds, readFavMeta,
  removeFavorite, resolveFavorites, toggleFavorite,
} from '../diary/food-favorites';

const dbFood = FOOD_DB[0] as any;

describe('food-favorites', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('старый формат (только id) читается через FOOD_DB', () => {
    localStorage.setItem('he_food_favs', JSON.stringify([dbFood.id]));
    const favs = resolveFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].name).toBe(dbFood.name);
  });

  it('продукт сети не теряется: лежит снимком рядом с id', () => {
    addFavorite({
      id: 'retail:vkusvill:42',
      name: 'Творог ВкусВилл 5%',
      kcal: 121, protein: 16, fat: 5, carbs: 3,
      category: 'dairy',
    });
    expect(readFavIds()).toEqual(['retail:vkusvill:42']);
    expect(readFavMeta()['retail:vkusvill:42'].name).toBe('Творог ВкусВилл 5%');
    const favs = resolveFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0]).toMatchObject({ id: 'retail:vkusvill:42', kcal: 121, protein: 16 });
  });

  it('избранное сохраняется по порядку и без дублей', () => {
    addFavorite({ id: 'a', name: 'A', kcal: 1, protein: 0, fat: 0, carbs: 0 });
    addFavorite({ id: 'b', name: 'B', kcal: 2, protein: 0, fat: 0, carbs: 0 });
    addFavorite({ id: 'a', name: 'A', kcal: 1, protein: 0, fat: 0, carbs: 0 });
    expect(readFavIds()).toEqual(['a', 'b']);
    expect(resolveFavorites().map(f => f.id)).toEqual(['a', 'b']);
  });

  it('звезда переключается и снимает продукт', () => {
    const food = { id: 'x', name: 'X', kcal: 10, protein: 1, fat: 1, carbs: 1 };
    expect(toggleFavorite(food)).toBe(true);
    expect(isFavorite('x')).toBe(true);
    expect(toggleFavorite(food)).toBe(false);
    expect(isFavorite('x')).toBe(false);
    expect(resolveFavorites()).toEqual([]);
  });

  it('removeFavorite снимает и палитру, и снимок', () => {
    addFavorite({ id: 'y', name: 'Y', kcal: 5, protein: 0, fat: 0, carbs: 0 });
    removeFavorite('y');
    expect(readFavIds()).toEqual([]);
    expect(readFavMeta()['y']).toBeUndefined();
    expect(resolveFavorites()).toEqual([]);
  });

  it('битые данные в хранилище не роняют список', () => {
    localStorage.setItem('he_food_favs', '{oops');
    localStorage.setItem('he_food_favs_meta', '[]');
    expect(resolveFavorites()).toEqual([]);
  });
});
