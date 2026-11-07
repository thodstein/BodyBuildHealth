import { describe, expect, it } from 'vitest';
import { normalizeProduct } from '../openfoodfacts.engine';

describe('openfoodfacts: нормализация продукта', () => {
  it('считает ккал из energy-kj, когда energy-kcal нет', () => {
    const product = normalizeProduct({
      code: '4600000000000',
      product_name: 'Овсяные хлопья',
      nutriments: { 'energy-kj_100g': 1500, proteins_100g: 12, fat_100g: 6, carbohydrates_100g: 60 },
    })!;
    // Раньше такой продукт приходил в дневник с 0 ккал.
    expect(product.kcal).toBe(359);
  });

  it('берёт общий energy (кДж) как запасной вариант', () => {
    const product = normalizeProduct({
      code: '1',
      product_name: 'Продукт',
      nutriments: { energy_100g: 418.4 },
    })!;
    expect(product.kcal).toBe(100);
  });

  it('предпочитает energy-kcal, когда он есть', () => {
    const product = normalizeProduct({
      code: '2',
      product_name: 'Продукт',
      nutriments: { 'energy-kcal_100g': 250, 'energy-kj_100g': 1200 },
    })!;
    expect(product.kcal).toBe(250);
  });

  it('переводит микроэлементы OFF из граммов в мг/мкг приложения', () => {
    const product = normalizeProduct({
      code: '3',
      product_name: 'Продукт',
      nutriments: {
        'energy-kcal_100g': 100,
        sodium_100g: 0.5,
        calcium_100g: 0.12,
        iron_100g: 0.002,
        potassium_100g: 0.35,
        'vitamin-c_100g': 0.015,
        'vitamin-d_100g': 0.0000015,
        'vitamin-b12_100g': 0.0000024,
        'saturated-fat_100g': 1.2,
      },
    })!;
    // Приложение хранит Na/Ca/Fe/K/витамин C в мг, D/B12 — в мкг.
    expect(product.micros).toMatchObject({
      sodium: 500,
      calcium: 120,
      iron: 2,
      potassium: 350,
      vitaminC: 15,
      vitaminD: 1.5,
      vitaminB12: 2.4,
      saturatedFat: 1.2,
    });
  });

  it('не выдумывает микроэлементы, которых нет в OFF', () => {
    const product = normalizeProduct({ code: '4', product_name: 'Продукт', nutriments: { 'energy-kcal_100g': 10 } })!;
    expect(product.micros?.sodium).toBeUndefined();
    expect(product.micros?.vitaminD).toBeUndefined();
  });
});
