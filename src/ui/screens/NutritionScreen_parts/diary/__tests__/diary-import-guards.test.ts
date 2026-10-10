import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAllergenId,
  readProgramRestrictions,
  checkImportItem,
  summarizeImportChecks,
} from '../diary-import-guards';

function seedProfile(settings: Record<string, unknown>) {
  localStorage.setItem('he_profile_v2', JSON.stringify({ settings }));
}

/** Ограничения читаем через реальный путь (getProfile), не мокам ради. */
const restrictions = () => readProgramRestrictions();

describe('diary-import-guards: normalizeAllergenId', () => {
  it('приводит русские и латинские теги к одному ключу', () => {
    expect(normalizeAllergenId('Рыба')).toBe(normalizeAllergenId('fish'));
    expect(normalizeAllergenId('Молочные')).toBe(normalizeAllergenId('dairy'));
    expect(normalizeAllergenId('Орехи')).toBe(normalizeAllergenId('nuts'));
  });

  it('убирает пробелы/регистр и не падает на мусоре', () => {
    expect(normalizeAllergenId('  ГЛЮТЕН  ')).toBe('глютен');
    expect(normalizeAllergenId(undefined as any)).toBe('');
  });
});

describe('diary-import-guards: readProgramRestrictions', () => {
  beforeEach(() => localStorage.clear());

  it('пустой профиль → ограничения не активны', () => {
    const r = restrictions();
    expect(r.allergens).toEqual([]);
    expect(r.excludedFoodIds).toEqual([]);
    expect(r.excludedCategories).toEqual([]);
    expect(r.active).toBe(false);
  });

  it('читает «действующие значения» из настроек рациона', () => {
    seedProfile({
      nutrition: {
        foodAllergies: ['рыба', 'lactose'],
        excludedFoods: ['milk_whole', 'salmon_steak'],
        excludedCategories: ['fast_food'],
        foodIntolerances: { lactose: true, gluten: false },
      },
    });
    const r = restrictions();
    expect(r.active).toBe(true);
    expect(r.allergens.length).toBeGreaterThan(0);
    expect(r.excludedFoodIds).toContain('milk_whole');
    expect(r.excludedCategories).toContain('fast_food');
  });

  it('битый профиль не роняет чтение', () => {
    localStorage.setItem('he_profile_v2', '{not json');
    const r = restrictions();
    expect(r.active).toBe(false);
  });
});

describe('diary-import-guards: checkImportItem', () => {
  beforeEach(() => localStorage.clear());

  it('предупреждает об аллергене продукта по тегу FOOD_DB', () => {
    seedProfile({ nutrition: { foodAllergies: ['fish'] } });
    const v = checkImportItem({ name: 'Лосось на гриле', foodId: 'salmon_steak' }, restrictions());
    expect(v.status).toBe('caution');
    expect(v.reasons.join(' ')).toMatch(/рыб/i);
  });

  it('предупреждает о явно исключённом продукте', () => {
    seedProfile({ nutrition: { excludedFoods: ['milk_whole'] } });
    expect(checkImportItem({ name: 'Молоко', foodId: 'milk_whole' }, restrictions()).status).toBe('caution');
  });

  it('предупреждает об исключённой категории', () => {
    seedProfile({ nutrition: { excludedCategories: ['fast_food'] } });
    const v = checkImportItem({ name: 'Чипсы', category: 'fast_food' }, restrictions());
    expect(v.status).toBe('caution');
    expect(v.reasons.join(' ')).toMatch(/категор/i);
  });

  it('чистый продукт → предупреждения нет', () => {
    seedProfile({ nutrition: { foodAllergies: ['fish'], excludedFoods: ['candy'] } });
    expect(checkImportItem({ name: 'Куриная грудка', foodId: 'chicken_breast' }, restrictions()).status).toBe('ok');
  });

  it('OCR-название в неканонической форме всё ещё ловится', () => {
    // 'молоко' — не канонический ключ ('молочные'), но именно так аллерген
    // лежит в профилях пользователей. Без маппинга по основе он выпадал из сверки.
    seedProfile({ nutrition: { foodAllergies: ['молоко'] } });
    expect(checkImportItem({ name: 'Молока пастеризованного' }, restrictions()).status).toBe('caution');
  });

  it('вариант аллергена из профиля приводится к канону', () => {
    expect(normalizeAllergenId('молоко')).toBe('молочные');
    expect(normalizeAllergenId('орех')).toBe('орехи');
    expect(normalizeAllergenId('молочный шоколад')).toBe('молочные');
    expect(normalizeAllergenId('молочка')).toBe('молочные');
  });

  it('неизвестный аллерген не приводит себя к чужому канону', () => {
    expect(normalizeAllergenId('никанонический аллерген')).toBe('никанонический аллерген');
  });

  it('без ограничений программы гейт молчит (байт-в-байт для обычного пользователя)', () => {
    expect(checkImportItem({ name: 'Лосось', foodId: 'salmon_steak' }, restrictions()).status).toBe('ok');
  });
});

describe('diary-import-guards: summarizeImportChecks', () => {
  beforeEach(() => localStorage.clear());

  it('пустой список → предупреждения нет', () => {
    expect(summarizeImportChecks([], restrictions()).cautions).toHaveLength(0);
    expect(summarizeImportChecks(undefined as any, restrictions()).text).toBe('');
  });

  it('считает только проблемные и называет продукты', () => {
    seedProfile({ nutrition: { foodAllergies: ['fish'] } });
    const s = summarizeImportChecks([
      { name: 'Лосось', foodId: 'salmon_steak' },
      { name: 'Куриная грудка', foodId: 'chicken_breast' },
      { name: 'Тунец', foodId: 'tuna_steak' },
    ], restrictions());
    expect(s.cautions).toHaveLength(2);
    expect(s.text).toContain('Лосось');
    expect(s.text).toContain('Тунец');
  });

  it('текст предупреждения объясняет, что запись сохранена как факт', () => {
    seedProfile({ nutrition: { foodAllergies: ['fish'] } });
    const s = summarizeImportChecks([{ name: 'Лосось', foodId: 'salmon_steak' }], restrictions());
    expect(s.text).toMatch(/Записано как факт/);
  });

  it('длинный список не раздувает сообщение: лимит имён + остаток', () => {
    seedProfile({ nutrition: { foodAllergies: ['fish'] } });
    const s = summarizeImportChecks([
      { name: 'Лосось', foodId: 'salmon_steak' },
      { name: 'Тунец', foodId: 'tuna_steak' },
      { name: 'Сельдь', foodId: 'herring' },
      { name: 'Скумбрия', foodId: 'mackerel' },
    ], restrictions());
    expect(s.cautions).toHaveLength(4);
    expect(s.text).toContain('и ещё 1');
  });
});
