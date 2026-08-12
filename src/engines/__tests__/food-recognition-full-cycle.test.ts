import { describe, it, expect } from 'vitest';
import {
  parseNutritionText,
  parseFatSecretText,
  parseNutritionScreenshot,
  findFood,
  fillMissingMicros,
  quantityToGrams,
  parseMicroLine,
  parseVerticalNutritionTable,
} from '../nutrition-ocr-parser';
import { aggregateDiaryMicros } from '../../ui/screens/NutritionScreen_parts/diary-storage';
import type { DiaryMealItem, DiaryDay, DiaryData } from '../../ui/screens/NutritionScreen_parts/diary-storage';

/**
 * Replicates `convertOCRItems` from NutritionDiary.tsx.
 * Stores values PER 100g (not per-portion) — the actual UI code does the
 * qty scaling inside saveItemsToDiary, not here.
 */
function convertOCRItems(meals: ReturnType<typeof parseNutritionText>): DiaryItem[] {
  return meals.flatMap(m => m.items.map(item => {
    const qtyMatch = item.qty?.match(/[\d]+(?:[.,]\d+)?/);
    const parsedQty = qtyMatch ? Number.parseFloat(qtyMatch[0].replace(',', '.')) : 100;
    const qty = Math.max(10, Math.round(item.qtyGrams ?? parsedQty));
    return {
      name: item.name || m.mealType || 'Блюдо',
      kcal: Math.round(item.kcal) || 0,
      p: Math.round((item.p || 0) * 10) / 10,
      f: Math.round((item.f || 0) * 10) / 10,
      c: Math.round((item.c || 0) * 10) / 10,
      qty,
      category: item.category,
      foodId: item.foodId,
      micros: item.micros,
      confidence: item.confidence,
    };
  }));
}

/**
 * Replicates `saveItemsToDiary` — saves DiaryItem[] to a DiaryData structure.
 * Scales per-100g values by qty/100 to get total portion values.
 */
function saveItemsToDiary(
  diaryData: DiaryData,
  date: string,
  mealType: string,
  items: DiaryItem[],
): DiaryData {
  const data = { ...diaryData };
  if (!data[date]) data[date] = { meals: {} };
  if (!data[date].meals[mealType]) data[date].meals[mealType] = [];
  items.forEach(item => {
    const rawQty = item.qty != null ? Number(item.qty) : 100;
    const q = Number.isFinite(rawQty) ? rawQty : 100;
    if (q <= 0) return;
    data[date].meals[mealType].push({
      name: item.name,
      qty: q,
      kcal: Math.round((item.kcal || 0) * q / 100),
      p: Math.round(((item.p || 0) * q / 100) * 10) / 10,
      f: Math.round(((item.f || 0) * q / 100) * 10) / 10,
      c: Math.round(((item.c || 0) * q / 100) * 10) / 10,
      category: item.category,
      foodId: item.foodId,
      micros: item.micros,
    });
  });
  return data;
}

/**
 * Compute macro totals for a day (kcal, p, f, c)
 */
function dayMacroTotals(data: DiaryData, date: string) {
  const day = data[date];
  if (!day?.meals) return { kcal: 0, p: 0, f: 0, c: 0 };
  const totals = { kcal: 0, p: 0, f: 0, c: 0 };
  Object.values(day.meals).forEach(items => items.forEach(item => {
    totals.kcal += item.kcal || 0;
    totals.p += item.p || 0;
    totals.f += item.f || 0;
    totals.c += item.c || 0;
  }));
  return {
    kcal: Math.round(totals.kcal),
    p: Math.round(totals.p * 10) / 10,
    f: Math.round(totals.f * 10) / 10,
    c: Math.round(totals.c * 10) / 10,
  };
}

/** Full-cycle helper: text → parse → convert → enrich micros → save */
function fullCycle(text: string, date: string, mealType: string, diaryData: DiaryData = {}) {
  const meals = parseNutritionText(text);
  const items = convertOCRItems(meals).map(item => ({
    ...item,
    micros: fillMissingMicros(item.name, Number(item.qty) || 100, item.micros),
  }));
  return saveItemsToDiary(diaryData, date, mealType, items);
}

// =============================================================================
describe('E2E: полный цикл распознавания еды', () => {

  // ================================================================
  // 1. Парсинг текста
  // ================================================================
  describe('1. Парсинг текста', () => {
    it('распознаёт курицу + гречку из скриншота', () => {
      const text = `Курица 200 г 330 ккал Б:40 Ж:10 У:0
Гречка 150 г 510 ккал Б:18 Ж:4 У:100`;
      const meals = parseNutritionScreenshot(text);
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('распознаёт еду из FatSecret-экспорта', () => {
      const text = `Завтрак
Яйца 2 шт 150 ккал Б:15 Ж:10 У:2
Овсянка 100 г 350 ккал Б:12 Ж:7 У:60
Обед
Куриная грудка 200 г 220 ккал Б:46 Ж:5 У:0`;
      const meals = parseFatSecretText(text);
      expect(meals.length).toBeGreaterThanOrEqual(2);
      const allItems = meals.flatMap(m => m.items);
      expect(allItems.length).toBeGreaterThanOrEqual(3);
    });

    it('parseNutritionText генерирует хотя бы один результат из валидного текста', () => {
      const meals = parseNutritionText('Курица 200 г 330 ккал Б:40 Ж:10 У:0');
      expect(meals.length).toBeGreaterThanOrEqual(1);
      expect(meals.flatMap(m => m.items).length).toBeGreaterThanOrEqual(1);
    });

    it('распознаёт еду только по названию и порции (без макросов)', () => {
      // Use FatSecret parser directly — it supports food-only matches
      const meals = parseFatSecretText('Куриная грудка 250 г\nГречка 180 г');
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(2);
      const chicken = items.find(i => i.foodId === 'chicken_breast');
      expect(chicken).toBeTruthy();
      expect(chicken!.kcal).toBeGreaterThan(0);
    });

    it('распознаёт mixed-формат: часть с макросами, часть без', () => {
      const text = `Обед
Курица 200 г 330 ккал Б:40 Ж:10 У:0
Огурец 150 г
Помидор 100 г`;
      const meals = parseFatSecretText(text);
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('корректно нормализует OCR-артефакты в названиях', () => {
      const meals = parseFatSecretText('Кyрицa 200 г 330 ккал Б:40 Ж:10 У:0');
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('возвращает пустой массив на пустой/бесполезный ввод', () => {
      expect(parseNutritionText('')).toEqual([]);
      expect(parseNutritionText('   \n\n  ')).toEqual([]);
      expect(parseNutritionText('непонятный текст без цифр')).toEqual([]);
    });

    it('распознаёт kcal-first формат (per 100g)', () => {
      const meals = parseFatSecretText('150 kcal Курица 200g');
      const item = meals.flatMap(m => m.items)[0];
      expect(item).toBeTruthy();
      // Per-100g kcal = 150/2 = 75
      expect(item.kcal).toBe(75);
    });

    it('распознаёт разделители ; | TAB', () => {
      const text = 'Курица;200 г;330;40;10;0';
      const meals = parseFatSecretText(text);
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].kcal).toBe(165);
      expect(items[0].p).toBe(20);
    });

    it('распознаёт unlabeled macro row (без Б/Ж/У подписей)', () => {
      const meals = parseFatSecretText('Завтрак\nChicken breast 200 g 330 kcal 40 10 0');
      const item = meals.flatMap(m => m.items)[0];
      expect(item).toMatchObject({ qtyGrams: 200, kcal: 165, p: 20, f: 5, c: 0 });
    });

    it('сохраняет разделение по приёмам пищи', () => {
      const text = `Завтрак
Яйца 100 г 150 ккал
Обед
Курица 200 г 330 ккал Б:40 Ж:10 У:0`;
      const meals = parseFatSecretText(text);
      expect(meals.length).toBe(2);
      expect(meals[0].mealType).toBe('Завтрак');
      expect(meals[1].mealType).toBe('Обед');
    });

    it('пропускает строки "Итого" внутри одного парсера', () => {
      const text = `Курица 200 г 330 ккал Б:40 Ж:10 У:0
Итого: 330 ккал
Всего за день: 500 ккал`;
      const meals = parseFatSecretText(text);
      const items = meals.flatMap(m => m.items);
      expect(items.length).toBe(1);
    });
  });

  // ================================================================
  // 2. Поиск продукта в БД
  // ================================================================
  describe('2. Поиск продукта в БД (findFood)', () => {
    it('находит куриную грудку', () => {
      const food = findFood('Куриная грудка');
      expect(food).toBeTruthy();
      expect(food!.id).toBe('chicken_breast');
    });

    it('находит говядину', () => {
      const food = findFood('Говядина');
      expect(food).toBeTruthy();
      expect(food!.id).toBe('beef_lean');
    });

    it('находит гречку', () => {
      const food = findFood('Гречневая каша');
      expect(food).toBeTruthy();
      expect(food!.id).toBe('buckwheat');
    });

    it('находит по OCR-искажённому названию', () => {
      const food = findFood('Кyрицa грудкa');
      expect(food).toBeTruthy();
      expect(food!.id).toBe('chicken_breast');
    });

    it('возвращает undefined для несуществующего продукта', () => {
      const food = findFood('квыртзп хщшгнекв');
      expect(food).toBeUndefined();
    });

    it('находит по частичному совпадению', () => {
      const food = findFood('рис пропаренный');
      expect(food).toBeTruthy();
      expect(food!.id).toBeDefined();
    });

    it('находит продукты с edit distance ≤ 1', () => {
      const food = findFood('Куриная грудкка');
      expect(food).toBeTruthy();
    });
  });

  // ================================================================
  // 3. Микронутриенты
  // ================================================================
  describe('3. Дополнение микронутриентов (fillMissingMicros)', () => {
    it('дополняет микронутриенты для найденного продукта', () => {
      const micros = fillMissingMicros('Куриная грудка', 200);
      expect(Object.keys(micros).length).toBeGreaterThan(0);
      const hasSomeMicros = Object.values(micros).some(v => v > 0);
      expect(hasSomeMicros).toBe(true);
    });

    it('не перезаписывает уже существующие микронутриенты', () => {
      const existing = { sodium_mg: 500, iron_mg: 10 };
      const micros = fillMissingMicros('Куриная грудка', 200, existing);
      expect(micros.sodium_mg).toBe(500);
      expect(micros.iron_mg).toBe(10);
    });

    it('возвращает пустой объект для неизвестного продукта', () => {
      const micros = fillMissingMicros('квыртзп хщшгнекв', 100);
      expect(Object.keys(micros).length).toBe(0);
    });

    it('масштабирует микронутриенты пропорционально порции', () => {
      const micros100 = fillMissingMicros('Куриная грудка', 100);
      const micros200 = fillMissingMicros('Куриная грудка', 200);
      for (const key of Object.keys(micros100)) {
        if (micros200[key] !== undefined) {
          expect(micros200[key]).toBeCloseTo(micros100[key] * 2, 0);
        }
      }
    });

    it('обрабатывает нулевую порцию', () => {
      const micros = fillMissingMicros('Куриная грудка', 0);
      expect(Object.keys(micros).length).toBe(0);
    });

    it('обрабатывает отрицательную порцию', () => {
      const micros = fillMissingMicros('Куриная грудка', -100);
      expect(Object.keys(micros).length).toBe(0);
    });
  });

  // ================================================================
  // 4. Конвертация порций
  // ================================================================
  describe('4. Конвертация порций (quantityToGrams)', () => {
    it('обычные граммы', () => {
      expect(quantityToGrams('200 г')).toBe(200);
      expect(quantityToGrams('150 мл')).toBe(150);
    });

    it('яйца в штуках', () => {
      const eggFood = findFood('Яйцо');
      expect(quantityToGrams('2 шт', eggFood)).toBe(100);
      expect(quantityToGrams('4 pcs', eggFood)).toBe(200);
    });

    it('столовые и чайные ложки', () => {
      expect(quantityToGrams('2 ст.л.')).toBe(30);
      expect(quantityToGrams('3 ч.л.')).toBe(15);
      expect(quantityToGrams('1 tbsp')).toBe(15);
      expect(quantityToGrams('2 tsp')).toBe(10);
    });

    it('банан в штуках', () => {
      const bananaFood = findFood('Банан');
      if (bananaFood) expect(quantityToGrams('1 шт', bananaFood)).toBe(120);
    });

    it('яблоко в штуках', () => {
      const appleFood = findFood('Яблоко');
      if (appleFood) expect(quantityToGrams('1 шт', appleFood)).toBe(180);
    });

    it('обычный продукт в штуках (fallback)', () => {
      const food = findFood('Куриная грудка');
      expect(quantityToGrams('1 шт', food)).toBe(100);
    });

    it('числовое значение без единиц', () => {
      expect(quantityToGrams('200')).toBe(200);
    });
  });

  // ================================================================
  // 5. Микронутриентные строки и таблицы
  // ================================================================
  describe('5. Парсинг микронутриентов', () => {
    it('parseMicroLine: несколько микронутриентов в строке', () => {
      const micros = parseMicroLine('Натрий: 200 мг Калий: 500 мг');
      expect(micros.sodium_mg).toBe(200);
      expect(micros.potassium_mg).toBe(500);
    });

    it('parseMicroLine: витамины', () => {
      const micros = parseMicroLine('Витамин C: 60 мг Витамин D: 5 мкг');
      expect(micros.vitamin_c_mg).toBe(60);
      expect(micros.vitamin_d_mcg).toBe(5);
    });

    it('parseMicroLine: zinc + iron', () => {
      const micros = parseMicroLine('Zinc: 15 mg Iron: 10 mg');
      expect(micros.zinc_mg).toBe(15);
      expect(micros.iron_mg).toBe(10);
    });

    it('parseMicroLine: пустая строка', () => {
      expect(Object.keys(parseMicroLine('')).length).toBe(0);
    });

    it('parseVerticalNutritionTable: классическая', () => {
      const table = parseVerticalNutritionTable(`Белки: 30 г
Жиры: 10 г
Углеводы: 50 г
Натрий: 200 мг`);
      expect(table.p).toBe(30);
      expect(table.f).toBe(10);
      expect(table.c).toBe(50);
      expect(table.sodium_mg).toBe(200);
    });

    it('parseVerticalNutritionTable: перевёрнутый формат', () => {
      const table = parseVerticalNutritionTable('30 г Белки\n10 г Жиры');
      expect(table.p).toBe(30);
      expect(table.f).toBe(10);
    });

    it('parseVerticalNutritionTable: мкг → мкг', () => {
      const table = parseVerticalNutritionTable('Витамин D: 500 мкг');
      expect(table.vitamin_d_mcg).toBe(500);
    });

    it('parseVerticalNutritionTable: г → мг', () => {
      const table = parseVerticalNutritionTable('Кальций: 0.2 г');
      expect(table.calcium_mg).toBe(200);
    });
  });

  // ================================================================
  // 6. Конвертация OCR → дневник
  // ================================================================
  describe('6. Конвертация OCR-результата в формат дневника', () => {
    it('конвертирует продукт с макросами (per-100g)', () => {
      const meals = parseNutritionText('Курица 200 г 330 ккал Б:40 Ж:10 У:0');
      const items = convertOCRItems(meals);
      expect(items.length).toBeGreaterThanOrEqual(1);
      const item = items[0];
      expect(item.name).toBeTruthy();
      expect(item.qty).toBe(200);
      // Per 100g: 165 kcal, 20p, 5f
      expect(item.kcal).toBeGreaterThan(0);
      expect(item.p).toBeGreaterThan(0);
    });

    it('конвертирует продукт без макросов (из БД)', () => {
      const meals = parseNutritionText('Куриная грудка 200 г');
      const items = convertOCRItems(meals);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].kcal).toBeGreaterThan(0);
      expect(items[0].foodId).toBeTruthy();
    });

    it('конвертирует несколько продуктов', () => {
      const text = `Курица 200 г 330 ккал Б:40 Ж:10 У:0
Гречка 180 г 612 ккал Б:22 Ж:5 У:120
Яйца 100 г 140 ккал Б:12 Ж:10 У:1`;
      const meals = parseNutritionText(text);
      const items = convertOCRItems(meals);
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('корректные per-100g значения', () => {
      const meals = parseNutritionText('Курица 200 г 330 ккал Б:40 Ж:10 У:0');
      const items = convertOCRItems(meals);
      // Per-100g: 165 kcal, 20p, 5f
      const hasExpected = items.some(i =>
        i.kcal >= 150 && i.kcal <= 180 && i.p >= 18 && i.p <= 22
      );
      expect(hasExpected).toBe(true);
    });

    it('передаёт foodId и category', () => {
      const meals = parseNutritionText('Куриная грудка 200 г 330 ккал Б:40 Ж:10 У:0');
      const items = convertOCRItems(meals);
      const chickenItem = items.find(i => i.foodId === 'chicken_breast');
      expect(chickenItem).toBeTruthy();
      expect(chickenItem!.category).toBeTruthy();
    });

    it('передаёт confidence', () => {
      const meals = parseNutritionText('Курица 200 г 330 ккал Б:40 Ж:10 У:0');
      const items = convertOCRItems(meals);
      const withConfidence = items.filter(i => typeof i.confidence === 'number');
      expect(withConfidence.length).toBeGreaterThan(0);
      expect(withConfidence[0].confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ================================================================
  // 7. Сохранение в дневник + подсчёт БЖУ
  // ================================================================
  describe('7. Сохранение в дневник + подсчёт БЖУ', () => {
    it('полный цикл: парсинг → конвертация → сохранение → подсчёт', () => {
      const text = `Курица 200 г 330 ккал Б:40 Ж:10 У:0
Гречка 150 г 510 ккал Б:18 Ж:4 У:100
Огурец 100 г 15 ккал Б:1 Ж:0 У:3`;

      const date = '2026-08-12';
      const mealType = 'Обед';
      const diaryData = fullCycle(text, date, mealType);

      // Structural check
      expect(diaryData[date]).toBeTruthy();
      expect(diaryData[date].meals[mealType]).toBeTruthy();

      // Macro totals (portions, not per-100g)
      const totals = dayMacroTotals(diaryData, date);
      expect(totals.kcal).toBeGreaterThan(700);
      expect(totals.p).toBeGreaterThan(40);
      expect(totals.c).toBeGreaterThan(60);
      expect(totals.f).toBeGreaterThan(3);
    });

    it('не сохраняет элементы с qty ≤ 0', () => {
      const date = '2026-08-12';
      let diaryData: DiaryData = {};
      diaryData = saveItemsToDiary(diaryData, date, 'Тест', [
        { name: 'test', kcal: 100, p: 10, f: 5, c: 5, qty: 0 },
      ]);
      expect(diaryData[date].meals['Тест'].length).toBe(0);
    });

    it('сохраняет несколько приёмов пищи за один день', () => {
      let diaryData: DiaryData = {};
      const date = '2026-08-12';

      diaryData = fullCycle('Овсянка 100 г 350 ккал Б:12 Ж:7 У:60', date, 'Завтрак', diaryData);
      diaryData = fullCycle('Курица 200 г 330 ккал Б:40 Ж:10 У:0', date, 'Обед', diaryData);

      expect(Object.keys(diaryData[date].meals).length).toBe(2);
      expect(diaryData[date].meals['Завтрак'].length).toBeGreaterThanOrEqual(1);
      expect(diaryData[date].meals['Обед'].length).toBeGreaterThanOrEqual(1);

      const totals = dayMacroTotals(diaryData, date);
      expect(totals.kcal).toBeGreaterThan(400); // 350 + 330 = 680
    });

    it('сохраняет разные даты', () => {
      let diaryData: DiaryData = {};
      diaryData = fullCycle('Курица 200 г 330 ккал Б:40 Ж:10 У:0', '2026-08-12', 'Обед', diaryData);
      diaryData = fullCycle('Курица 200 г 330 ккал Б:40 Ж:10 У:0', '2026-08-13', 'Обед', diaryData);

      expect(Object.keys(diaryData).length).toBe(2);
      expect(diaryData['2026-08-12'].meals['Обед']).toBeTruthy();
      expect(diaryData['2026-08-13'].meals['Обед']).toBeTruthy();
    });

    it('подсчитывает итоги за пустой день', () => {
      const totals = dayMacroTotals({}, '2026-08-12');
      expect(totals).toEqual({ kcal: 0, p: 0, f: 0, c: 0 });
    });
  });

  // ================================================================
  // 8. Агрегация микронутриентов
  // ================================================================
  describe('8. Агрегация микронутриентов (aggregateDiaryMicros)', () => {
    it('суммирует микронутриенты по приёмам пищи', () => {
      const day: DiaryDay = {
        meals: {
          'Завтрак': [
            { name: 'Яйца', kcal: 140, p: 12, f: 10, c: 1, micros: { iron_mg: 2, zinc_mg: 1.5 } },
          ],
          'Обед': [
            { name: 'Курица', kcal: 330, p: 40, f: 10, c: 0, micros: { iron_mg: 1.2, zinc_mg: 2.0 } },
          ],
        },
      };
      const totals = aggregateDiaryMicros(day);
      expect(totals.iron_mg).toBeCloseTo(3.2, 1);
      expect(totals.zinc_mg).toBeCloseTo(3.5, 1);
    });

    it('возвращает пустой объект для пустого дня', () => {
      expect(aggregateDiaryMicros(undefined)).toEqual({});
      expect(aggregateDiaryMicros({ meals: {} })).toEqual({});
    });

    it('обрабатывает строковые значения', () => {
      const day: DiaryDay = {
        meals: { 'Обед': [{ name: 'x', kcal: 100, p: 10, f: 5, c: 5, micros: { potassium_mg: '612.5' as any } }] },
      };
      expect(aggregateDiaryMicros(day).potassium_mg).toBe(612.5);
    });

    it('пропускает не-числовые значения', () => {
      const day: DiaryDay = {
        meals: { 'Обед': [{ name: 'x', kcal: 100, p: 10, f: 5, c: 5, micros: { sodium_mg: 'N/A' as any } }] },
      };
      expect(aggregateDiaryMicros(day).sodium_mg).toBeUndefined();
    });

    it('суммирует с null-микросами', () => {
      const day: DiaryDay = {
        meals: {
          'Обед': [
            { name: 'x', kcal: 100, p: 10, f: 5, c: 5 },
            { name: 'y', kcal: 100, p: 10, f: 5, c: 5, micros: { iron_mg: 5 } },
          ],
        },
      };
      expect(aggregateDiaryMicros(day).iron_mg).toBe(5);
    });
  });

  // ================================================================
  // 9. Полный цикл: текст → дневник → макросы + микронутриенты
  // ================================================================
  describe('9. Полный цикл: текст → дневник → макросы + микронутриенты', () => {
    it('один приём пищи с 3 продуктами', () => {
      const text = `Куриная грудка 200 г 330 ккал Б:40 Ж:10 У:0
Гречка 150 г 510 ккал Б:18 Ж:4 У:100
Оливковое масло 10 г 88 ккал Б:0 Ж:10 У:0`;

      const date = '2026-08-12';
      const diaryData = fullCycle(text, date, 'Обед');

      expect(diaryData[date].meals['Обед'].length).toBeGreaterThanOrEqual(3);

      const totals = dayMacroTotals(diaryData, date);
      // ≈ 165*2=330 + 340*1.5=510 + 880*0.1=88 = 928 kcal
      expect(totals.kcal).toBeGreaterThan(800);
      expect(totals.p).toBeGreaterThan(40);
      expect(totals.f).toBeGreaterThan(15);
      expect(totals.c).toBeGreaterThan(80);

      // Micros
      const microsTotals = aggregateDiaryMicros(diaryData[date]);
      expect(Object.keys(microsTotals).length).toBeGreaterThan(0);
      const hasMineral = Object.keys(microsTotals).some(k =>
        k.includes('iron') || k.includes('zinc') || k.includes('magnesium') || k.includes('potassium')
      );
      expect(hasMineral).toBe(true);
    });

    it('два приёма пищи с разными продуктами', () => {
      let diaryData: DiaryData = {};
      const date = '2026-08-12';

      diaryData = fullCycle('Овсянка 100 г 350 ккал Б:12 Ж:7 У:60', date, 'Завтрак', diaryData);
      diaryData = fullCycle('Куриная грудка 200 г 330 ккал Б:40 Ж:10 У:0', date, 'Обед', diaryData);
      diaryData = fullCycle('Творог 5% 200 г 240 ккал Б:34 Ж:10 У:6', date, 'Ужин', diaryData);

      expect(Object.keys(diaryData[date].meals).length).toBe(3);
      const totals = dayMacroTotals(diaryData, date);
      expect(totals.kcal).toBeGreaterThan(700);
      expect(totals.p).toBeGreaterThan(60);

      const microsTotals = aggregateDiaryMicros(diaryData[date]);
      expect(Object.keys(microsTotals).length).toBeGreaterThanOrEqual(3);
    });

    it('реалистичный сценарий: полноценный день питания через FatSecretText', () => {
      let diaryData: DiaryData = {};
      const date = '2026-08-12';

      const dayPlan: Array<{ mealType: string; text: string }> = [
        {
          mealType: 'Завтрак',
          text: `Яйца 4 шт 280 ккал Б:24 Ж:20 У:2
Овсянка 80 г 280 ккал Б:10 Ж:6 У:48
Банан 1 шт 105 ккал Б:1 Ж:0 У:27`,
        },
        {
          mealType: 'Обед',
          text: `Куриная грудка 200 г 330 ккал Б:40 Ж:10 У:0
Гречка 150 г 510 ккал Б:18 Ж:4 У:100
Оливковое масло 10 г 88 ккал Б:0 Ж:10 У:0`,
        },
        {
          mealType: 'Перекус',
          text: 'Творог 5% 150 г 180 ккал Б:26 Ж:8 У:4',
        },
        {
          mealType: 'Ужин',
          text: `Лосось 150 г 312 ккал Б:30 Ж:22 У:0
Рис белый 100 г 350 ккал Б:7 Ж:1 У:77`,
        },
        {
          mealType: 'Поздний перекус',
          text: 'Протеин 30 г 110 ккал Б:24 Ж:2 У:2',
        },
      ];

      for (const { mealType, text } of dayPlan) {
        const meals = parseFatSecretText(text);
        const items = convertOCRItems(meals).map(item => ({
          ...item,
          micros: fillMissingMicros(item.name, Number(item.qty) || 100, item.micros),
        }));
        diaryData = saveItemsToDiary(diaryData, date, mealType, items);
      }

      expect(Object.keys(diaryData[date].meals).length).toBe(5);
      const totalItems = Object.values(diaryData[date].meals).flat().length;
      expect(totalItems).toBeGreaterThanOrEqual(10);

      const totals = dayMacroTotals(diaryData, date);
      // Realistic bodybuilding day: ~2500-3500 kcal
      expect(totals.kcal).toBeGreaterThan(1500);
      expect(totals.p).toBeGreaterThan(100);
      expect(totals.f).toBeGreaterThan(30);
      expect(totals.c).toBeGreaterThan(100);

      const microsTotals = aggregateDiaryMicros(diaryData[date]);
      expect(Object.keys(microsTotals).length).toBeGreaterThanOrEqual(5);
      const minerals = ['iron_mg', 'zinc_mg', 'potassium_mg', 'magnesium_mg', 'phosphorus_mg', 'selenium_mcg'];
      const foundMinerals = minerals.filter(m => typeof microsTotals[m] === 'number' && microsTotals[m] > 0);
      expect(foundMinerals.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ================================================================
  // 10. Edge cases / стресс-тесты
  // ================================================================
  describe('10. Edge cases / стресс-тесты', () => {
    it('большой объём данных (15+ позиций)', () => {
      const foods = [
        'Курица 200 г 330 ккал Б:40 Ж:10 У:0',
        'Гречка 150 г 510 ккал Б:18 Ж:4 У:100',
        'Овсянка 100 г 350 ккал Б:12 Ж:7 У:60',
        'Яйца 100 г 140 ккал Б:12 Ж:10 У:1',
        'Рыба 150 г 312 ккал Б:30 Ж:22 У:0',
        'Рис 100 г 350 ккал Б:7 Ж:1 У:77',
        'Творог 200 г 240 ккал Б:34 Ж:10 У:6',
        'Банан 1 шт 105 ккал Б:1 Ж:0 У:27',
        'Орехи 30 г 180 ккал Б:6 Ж:16 У:5',
        'Авокадо 100 г 160 ккал Б:2 Ж:15 У:9',
        'Хлеб ржаной 50 г 120 ккал Б:4 Ж:1 У:24',
        'Масло оливковое 10 г 88 ккал Б:0 Ж:10 У:0',
        'Молоко 200 г 120 ккал Б:6 Ж:6 У:10',
        'Кефир 200 г 100 ккал Б:6 Ж:5 У:8',
        'Сыр 30 г 110 ккал Б:7 Ж:9 У:0',
      ];

      const text = foods.join('\n');
      const meals = parseFatSecretText(text);
      const items = convertOCRItems(meals);
      expect(items.length).toBeGreaterThanOrEqual(12);

      let diaryData: DiaryData = {};
      diaryData = saveItemsToDiary(diaryData, '2026-08-12', 'День', items);
      expect(diaryData['2026-08-12'].meals['День'].length).toBeGreaterThanOrEqual(12);

      const totals = dayMacroTotals(diaryData, '2026-08-12');
      expect(totals.kcal).toBeGreaterThan(1500);
      expect(totals.p).toBeGreaterThan(80);
    });

    it('одиночный продукт без цифр — игнорируется', () => {
      const items = convertOCRItems(parseNutritionText('Курица'));
      expect(items.length).toBe(0);
    });

    it('продукт с калориями но без Б/Ж/У', () => {
      const items = convertOCRItems(parseNutritionText('Курица 200 г 330 ккал'));
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].kcal).toBeGreaterThan(0);
    });

    it('mix русских и английских названий', () => {
      const text = `Chicken breast 200 g 330 kcal P:40 F:10 C:0
Овсянка 100 г 350 ккал Б:12 Ж:7 У:60`;
      const items = convertOCRItems(parseNutritionText(text));
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('продукт с запятой в весе', () => {
      const items = convertOCRItems(parseNutritionText('Курица 200,5 г 330 ккал Б:40 Ж:10 У:0'));
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('OCR коллапсирует разделённые цифры', () => {
      const meals = parseFatSecretText('Курица 200 г 3 3 0 ккал Б:4 0 Ж:1 0 У:0');
      const item = meals.flatMap(m => m.items)[0];
      expect(item.kcal).toBe(165);
      expect(item.p).toBeCloseTo(20, 0);
    });

    it('не ломается на полностью невалидном тексте', () => {
      expect(() => parseNutritionText('lorem ipsum dolor sit amet')).not.toThrow();
      expect(parseNutritionText('lorem ipsum dolor sit amet')).toBeInstanceOf(Array);
    });
  });
});
