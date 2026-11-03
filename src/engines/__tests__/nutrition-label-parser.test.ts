import { describe, expect, it } from 'vitest';
import { extractLabelProductName, labelToCustomFood, parseNutritionLabel } from '../nutrition-label-parser';

describe('nutrition-label-parser (фото упаковки)', () => {
  it('читает вертикальную таблицу «на 100 г»', () => {
    const parsed = parseNutritionLabel([
      'Молоко питьевое ультрапастеризованное 3,2%',
      'Пищевая ценность в 100 г продукта:',
      'белки 2,9 г',
      'жиры 3,2 г',
      'углеводы 4,7 г',
      'энергетическая ценность 60 ккал',
    ].join('\n'));
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({ name: 'Молоко питьевое ультрапастеризованное 3,2%', kcal: 60, protein: 2.9, fat: 3.2, carbs: 4.7, basis: '100g' });
    expect(parsed!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('читает одну строку с тире и запятыми', () => {
    const parsed = parseNutritionLabel([
      'Творог 5%',
      'Пищевая ценность на 100 г: белки — 16 г, жиры — 5 г, углеводы — 3 г',
      'Энергетическая ценность: 121 ккал',
    ].join('\n'));
    expect(parsed).toMatchObject({ name: 'Творог 5%', kcal: 121, protein: 16, fat: 5, carbs: 3 });
  });

  it('переводит кДж в ккал, когда ккал на этикетке нет', () => {
    const parsed = parseNutritionLabel([
      'Овсяные хлопья',
      'Энергетическая ценность 1500 кДж',
      'Белки 12 г Жиры 6 г Углеводы 60 г',
    ].join('\n'));
    expect(parsed).not.toBeNull();
    expect(parsed!.kcal).toBe(359);
    expect(parsed).toMatchObject({ protein: 12, fat: 6, carbs: 60 });
  });

  it('собирает таблицу, где подпись и значение на разных строках', () => {
    const parsed = parseNutritionLabel([
      'Сыр Моцарелла',
      'Пищевая ценность на 100 г',
      'Белки, г',
      '18,0',
      'Жиры, г',
      '24,0',
      'Углеводы, г',
      '2,0',
      'Энергетическая ценность, ккал',
      '280',
    ].join('\n'));
    expect(parsed).toMatchObject({ name: 'Сыр Моцарелла', kcal: 280, protein: 18, fat: 24, carbs: 2 });
  });

  it('пересчитывает значения с порции на 100 г', () => {
    const parsed = parseNutritionLabel([
      'Батончик протеиновый',
      'Пищевая ценность в 1 порции (40 г):',
      'белки 4 г, жиры 5 г, углеводы 20 г',
      'энергетическая ценность 140 ккал',
    ].join('\n'));
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({ kcal: 350, protein: 10, fat: 12.5, carbs: 50, basis: 'serving' });
    expect(parsed!.warnings.join(' ')).not.toMatch(/масса не распознана/i);
  });

  it('читает английскую этикетку', () => {
    const parsed = parseNutritionLabel([
      'Greek Yogurt 2%',
      'Nutrition Facts',
      'Per 100 g',
      'Protein 10 g',
      'Fat 2 g',
      'Carbohydrates 3.6 g',
      'Energy 75 kcal',
    ].join('\n'));
    expect(parsed).toMatchObject({ name: 'Greek Yogurt 2%', kcal: 75, protein: 10, fat: 2, carbs: 3.6 });
  });

  it('не считает состав или пустой текст этикеткой КБЖУ', () => {
    expect(parseNutritionLabel('Состав: молоко, сахар, соль')).toBeNull();
    expect(parseNutritionLabel('')).toBeNull();
  });

  it('не путает бренд с названием продукта', () => {
    const name = extractLabelProductName([
      'Простоквашино',
      'Молоко 3,2%',
      'Пищевая ценность на 100 г',
    ].join('\n'));
    expect(name).toMatchObject({ name: 'Простоквашино Молоко 3,2%', brand: 'Простоквашино' });
  });

  it('создаёт запись своей еды на 100 г', () => {
    const parsed = parseNutritionLabel('Йогурт\nПищевая ценность на 100 г: белки 3, жиры 2, углеводы 5\n60 ккал')!;
    const entry = labelToCustomFood(parsed, { barcode: '4600000000000' });
    expect(entry).toMatchObject({ name: 'Йогурт', kcal: 60, protein: 3, fat: 2, carbs: 5, servingSize: '100 г', source: 'label_photo', barcode: '4600000000000' });
    expect(entry.id).toMatch(/^custom_label_/);
  });
});
