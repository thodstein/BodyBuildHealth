/**
 * food-vision-engine.test.ts — замки клиентского маппера AI → дневник.
 *
 * Главный инвариант: в `ParsedMeal.items` КБЖУ живёт НА 100 г, а порция — в
 * `qtyGrams` (дневник сам умножает на qty/100). Если это сломать, дневник
 * завысит калории в qty/100 раз — тест ловит именно это.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapFoodPayloadToMeals,
  mapLabPayload,
  mapLabelPayloadToMeals,
  mapLabelPayloadToNutritionLabel,
  recognizeFoodOrLabel,
  recognizeFoodPhoto,
  resetFoodVisionCache,
} from '../food-vision.engine';
import { findFood } from '../nutrition-ocr-parser';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  resetFoodVisionCache();
});

describe('mapFoodPayloadToMeals', () => {
  it('известный продукт: КБЖУ берётся из FOOD_DB на 100 г, порция — в qtyGrams', () => {
    const chicken = findFood('Курица');
    expect(chicken).toBeTruthy();
    const { meals, warnings } = mapFoodPayloadToMeals({
      dish: 'курица',
      items: [{ name: 'Курица', grams: 180, confidence: 0.9, state: 'cooked' }],
    });
    expect(warnings).toEqual([]);
    const item = meals[0].items[0];
    expect(item.qtyGrams).toBe(180);
    expect(item.qty).toBe('180 г');
    expect(item.kcal).toBe(chicken!.kcal);
    expect(item.p).toBe(chicken!.protein);
    expect(item.foodId).toBe(chicken!.id);
    expect(item.confidence).toBe(0.9);
    // Микронутриенты очереди — уже на порцию (как fillMissingMicros в парсере).
    expect(item.micros).toBeTruthy();
  });

  it('неизвестный продукт с оценкой ИИ: КБЖУ из estimate, низкая уверенность и предупреждение', () => {
    const { meals, warnings } = mapFoodPayloadToMeals({
      dish: 'протеиновый батончик',
      items: [
        {
          name: 'Криптонит',
          grams: 60,
          confidence: 0.8,
          estimate: { kcalPer100g: 400, proteinPer100g: 30, fatPer100g: 12, carbsPer100g: 40 },
        },
      ],
    });
    expect(warnings.some((warning) => warning.includes('оценены ИИ'))).toBe(true);
    const item = meals[0].items[0];
    // estimate — на 100 г, значит в очередь идёт как есть (не умножаем на 0.6!).
    expect(item.kcal).toBe(400);
    expect(item.p).toBe(30);
    expect(item.qtyGrams).toBe(60);
    expect(item.confidence).toBeLessThanOrEqual(0.3);
  });

  it('неизвестный продукт без оценки: позиция пропускается, а не выдумывается', () => {
    const { meals, warnings } = mapFoodPayloadToMeals({
      dish: 'загадка',
      items: [{ name: 'Криптонит', grams: 100, confidence: 0.9 }],
    });
    expect(meals).toEqual([]);
    expect(warnings.some((warning) => warning.includes('пропущена'))).toBe(true);
  });

  it('граммы ограничены реальными границами очереди', () => {
    const { meals } = mapFoodPayloadToMeals({
      dish: 'курица',
      items: [{ name: 'Курица', grams: 12_000, confidence: 0.9 }],
    });
    expect(meals[0].items[0].qtyGrams).toBe(5000);
  });

  it('расхождение «ИИ видит сырое — в базе готовое» даёт предупреждение, но числа базы не меняет', () => {
    const chicken = findFood('Курица');
    expect(chicken?.foodState).toBe('cooked');
    const { meals, warnings } = mapFoodPayloadToMeals({
      dish: 'курица',
      items: [{ name: 'Курица', grams: 200, confidence: 0.9, state: 'raw' }],
    });
    expect(warnings.some((warning) => warning.includes('сырой'))).toBe(true);
    expect(meals[0].items[0].kcal).toBe(chicken!.kcal);
    expect(meals[0].items[0].confidence).toBeLessThanOrEqual(0.5);
  });

  it('неясности модели (needsUserInput / низкая общая уверенность) доходят до пользователя', () => {
    const { warnings } = mapFoodPayloadToMeals({
      dish: 'салат',
      items: [{ name: 'Курица', grams: 150, confidence: 0.8 }],
      needsUserInput: ['масло?'],
      overallConfidence: 0.45,
    });
    expect(warnings.some((warning) => warning.includes('Уточните: масло?'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('Низкая уверенность'))).toBe(true);
  });
});

describe('mapLabelPayloadToMeals', () => {
  it('этикетка — одна позиция на 100 г с микронутриентами', () => {
    const { meals, warnings } = mapLabelPayloadToMeals({
      productName: 'Творог 5%',
      brand: 'Простоквашино',
      per100g: { kcalPer100g: 121, proteinPer100g: 16, fatPer100g: 5, carbsPer100g: 3, sodiumMg: 40, fiber: 1.5 },
      confidence: 0.9,
    });
    const item = meals[0].items[0];
    expect(item.name).toBe('Творог 5% (Простоквашино)');
    expect(item.qtyGrams).toBe(100);
    expect(item.kcal).toBe(121);
    expect(item.micros).toMatchObject({ sodium_mg: 40, fiber_g: 1.5 });
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('mapLabelPayloadToNutritionLabel', () => {
  it('этикетка ИИ → контракт парсера этикетки: 100 г, микросы, предупреждение', () => {
    const parsed = mapLabelPayloadToNutritionLabel(
      {
        productName: 'Творог 5%',
        brand: 'Простоквашино',
        per100g: { kcalPer100g: 121, proteinPer100g: 16, fatPer100g: 5, carbsPer100g: 3, fiber: 1.5, sodiumMg: 40 },
        confidence: 0.9,
      },
      'Пищевая ценность на 100 г',
    );
    expect(parsed).toMatchObject({
      name: 'Творог 5%',
      brand: 'Простоквашино',
      kcal: 121,
      protein: 16,
      fat: 5,
      carbs: 3,
      fiber: 1.5,
      basis: '100g',
      confidence: 0.9,
      rawText: 'Пищевая ценность на 100 г',
    });
    expect(parsed.micros).toMatchObject({ sodium_mg: 40, fiber_g: 1.5 });
    expect(parsed.warnings[0]).toContain('сверьте');
  });
});

describe('mapLabPayload', () => {
  it('бланк не попадает в дневник, низкая уверенность — в предупреждения', () => {
    const result = mapLabPayload({
      values: [
        { code: 'HGB', name: 'Гемоглобин', value: 152, unit: 'г/л', confidence: 0.95 },
        { code: 'ALT', name: 'АЛТ', value: 31, unit: 'Ед/л', confidence: 0.3 },
      ],
      warnings: ['Часть строк не читается'],
    });
    expect(result.meals).toEqual([]);
    expect(result.lab).toHaveLength(2);
    expect(result.warnings.some((warning) => warning.includes('низкой уверенностью'))).toBe(true);
    expect(result.warnings).toContain('Часть строк не читается');
  });
});

describe('recognizeFoodPhoto: purpose=lab', () => {
  it('отправляет purpose=lab и OCR-подсказку, возвращает lab без дневника', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        ok: true,
        purpose: 'lab',
        payload: {
          values: [{ code: 'HGB', name: 'Гемоглобин', value: 152, unit: 'г/л', confidence: 0.95 }],
          labName: 'Инвитро',
        },
      }),
    );
    const result = await recognizeFoodPhoto(new File([], 'lab.jpg', { type: 'image/jpeg' }), {
      purpose: 'lab',
      hint: 'ИНВИТРО\nГемоглобин 152 г/л',
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'AAAA',
      fetchImpl: fetchImpl as any,
      noCache: true,
    });

    expect(result.ok).toBe(true);
    expect(result.lab).toHaveLength(1);
    expect(result.meals).toEqual([]);
    const body = JSON.parse((fetchImpl.mock.calls[0] as any)[1].body);
    expect(body.purpose).toBe('lab');
    expect(body.hint).toBe('ИНВИТРО\nГемоглобин 152 г/л');
  });
});

describe('recognizeFoodPhoto', () => {
  const payload = {
    ok: true,
    purpose: 'food',
    payload: {
      dish: 'курица с рисом',
      items: [
        { name: 'Курица', grams: 200, confidence: 0.9 },
        { name: 'Рис', grams: 150, confidence: 0.8 },
      ],
    },
    provider: 'gemini',
    model: 'gemini-flash-latest',
  };

  it('успешный ответ: позиции смаплены, повторный вызов берётся из кэша', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(payload));
    const first = await recognizeFoodPhoto(new File([], 'plate.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'AAAA',
      fetchImpl: fetchImpl as any,
    });
    expect(first.ok).toBe(true);
    expect(first.meals[0].items).toHaveLength(2);
    expect(first.provider).toBe('gemini');

    const second = await recognizeFoodPhoto(new File([], 'plate.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'AAAA',
      fetchImpl: fetchImpl as any,
    });
    expect(second.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, any];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ imageBase64: 'AAAA', purpose: 'food', locale: 'ru' });
  });

  it('noCache отключает кэш', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(payload));
    const options = { endpoint: 'https://example.test/api/food-vision', imageBase64: 'BBBB', noCache: true };
    await recognizeFoodPhoto(new File([], 'p.jpg', { type: 'image/jpeg' }), {
      ...options,
      fetchImpl: fetchImpl as any,
    });
    await recognizeFoodPhoto(new File([], 'p.jpg', { type: 'image/jpeg' }), {
      ...options,
      fetchImpl: fetchImpl as any,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('без готового base64 сжимает и кодирует файл сам (мост File → base64)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(payload));
    const file = new File([new Uint8Array([65, 66, 67])], 'plate.jpg', { type: 'image/jpeg' });
    const result = await recognizeFoodPhoto(file, {
      endpoint: 'https://example.test/api/food-vision',
      fetchImpl: fetchImpl as any,
    });
    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, any];
    const body = JSON.parse(init.body);
    expect(body.mimeType).toBe('image/jpeg');
    expect(body.imageBase64).toBe('QUJD');
  });

  it('ошибка эндпоинта не бросает, а возвращает ok:false с текстом', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, code: 'provider_error', error: 'Провайдер ответил 429' }, 502),
    );
    const result = await recognizeFoodPhoto(new File([], 'p.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'CCCC',
      fetchImpl: fetchImpl as any,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('429');
  });

  it('сетевой сбой/abort не бросает', async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const result = await recognizeFoodPhoto(new File([], 'p.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'DDDD',
      fetchImpl: fetchImpl as any,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('50');
  });

  it('не-JSON от эндпоинта не роняет дневник', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>gateway</html>', { status: 502 }));
    const result = await recognizeFoodPhoto(new File([], 'p.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'EEEE',
      fetchImpl: fetchImpl as any,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('HTTP 502');
  });
});

describe('recognizeFoodOrLabel', () => {
  const labelPayload = {
    ok: true,
    purpose: 'label',
    payload: {
      productName: 'Творог 5%',
      per100g: { kcalPer100g: 121, proteinPer100g: 16, fatPer100g: 5, carbsPer100g: 3 },
      confidence: 0.9,
    },
    provider: 'gemini',
    model: 'gemini-flash-latest',
  };

  it('OCR прочитал текст → первым идёт режим этикетки, подсказка уходит в тело', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(labelPayload));
    const result = await recognizeFoodOrLabel(new File([], 'label.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'LABEL',
      ocrText: 'Пищевая ценность на 100 г Белки 16 Жиры 5',
      fetchImpl: fetchImpl as any,
    });

    expect(result.mode).toBe('label');
    expect(result.meals[0].items[0].qtyGrams).toBe(100);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, any];
    const body = JSON.parse(init.body);
    expect(body.purpose).toBe('label');
    expect(body.hint).toContain('Пищевая ценность');
  });

  it('без текста первым идёт «блюдо»; при содержательном отказе пробуем этикетку', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ ok: false, code: 'empty_payload', error: 'На фото не найдено ни одного продукта' }, 422),
      )
      .mockResolvedValueOnce(jsonResponse(labelPayload));
    const result = await recognizeFoodOrLabel(new File([], 'unknown.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'UNKNOWN',
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchImpl.mock.calls[0] as any)[1].body).purpose).toBe('food');
    expect(JSON.parse((fetchImpl.mock.calls[1] as any)[1].body).purpose).toBe('label');
    expect(result.mode).toBe('label');
  });

  it('сетевой сбой не дублирует запрос вторым режимом', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await recognizeFoodOrLabel(new File([], 'x.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'NET',
      fetchImpl: fetchImpl as any,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.mode).toBeUndefined();
  });

  it('«провайдер не настроен» не тратит второй режим', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, code: 'no_provider', error: 'AI-провайдер не настроен: добавьте GEMINI_API_KEY' }, 503),
    );
    const result = await recognizeFoodOrLabel(new File([], 'x.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'NOPROVIDER',
      fetchImpl: fetchImpl as any,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });
});

describe('защита чисел от модели', () => {
  it('confidence=0 остаётся нулём, а не превращается в 0.6', () => {
    const { meals } = mapFoodPayloadToMeals({
      dish: 'курица',
      items: [{ name: 'Курица', grams: 200, confidence: 0 }],
    });
    expect(meals[0].items[0].confidence).toBe(0);
  });

  it('маленькая порция (5 г) не раздувается до минимума 10 г', () => {
    const { meals } = mapFoodPayloadToMeals({
      dish: 'масло',
      items: [{ name: 'Курица', grams: 5, confidence: 0.8 }],
    });
    expect(meals[0].items[0].qtyGrams).toBe(5);
  });
});

describe('выбор режима и бюджет', () => {
  it('длинная вывеска без маркеров КБЖУ не гонит фото в режим этикетки', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(labelPayload));
    await recognizeFoodOrLabel(new File([], 'sign.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'SIGNTEXT',
      ocrText: 'Ресторан Открыт Ежедневно С Одиннадцати До Двадцати Трёх Часов',
      fetchImpl: fetchImpl as any,
    });
    expect(JSON.parse((fetchImpl.mock.calls[0] as any)[1].body).purpose).toBe('food');
  });

  it('отказ провайдера (503) не тратит второй режим', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, code: 'provider_error', error: 'Провайдер ответил 503: high demand' }, 503),
    );
    const result = await recognizeFoodOrLabel(new File([], 'busy.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'BUSY',
      fetchImpl: fetchImpl as any,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('provider_error');
  });

  it('общий дедлайн: второй режим не стартует, если бюджет выбран', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, code: 'empty_payload', error: 'На фото не найдено ни одного продукта' }, 422),
    );
    const result = await recognizeFoodOrLabel(new File([], 'slow.jpg', { type: 'image/jpeg' }), {
      endpoint: 'https://example.test/api/food-vision',
      imageBase64: 'DEADLINE',
      deadlineMs: 1,
      fetchImpl: fetchImpl as any,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });
});
