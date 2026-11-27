---
name: Nutrition OCR
description: Разработка и отладка распознавания еды, этикеток, штрихкодов и сохранения КБЖУ в web/APK
---

# Nutrition OCR and food recognition

Используй этот навык для фото/текста пищевых этикеток, распознавания продуктов, штрихкодов, КБЖУ и записи еды.

## Реальный pipeline

1. `src/core/ocr-engine.ts` получает файл и выбирает web/API или offline Tesseract.
2. `recognizeImageTextOffline` распознаёт **текст**, а не изображение блюда.
3. `src/engines/nutrition-ocr-parser.ts` разбирает строки, ищет продукт в `FOOD_DB`/USDA и нормализует количество.
4. `src/engines/nutrition-label-parser.ts` разбирает этикетки с базисом `100 g`, порция или неизвестный базис.
5. `src/core/nutrition-database.ts` хранит макросы на 100 г; `servingSize` — только описание порции.
6. Сохранение проходит через существующий diary/IndexedDB flow, а не через прямую запись из UI.

## Обязательные ограничения

- Фото тарелки без текста не даёт надёжного продукта: не выдавай vision-классификацию, если в коде нет отдельного vision-слоя.
- В APK нельзя рассчитывать на `./api/*`; offline Tesseract — обязательный fallback.
- Не добавляй английский OCR-проход поверх русского КБЖУ-текста: это создаёт дубли строк и двойные продукты.
- Не смешивай состояния `raw/cooked/dry/powder/liquid/as_is`; макросы должны иметь явное состояние.
- Не исправляй mojibake вручную в датасетах: используй `scripts/fix-nutrition-encoding.mjs`.

## Изменение parser/data

1. Найди существующий parser/alias/fixture прежде чем писать новую ветку.
2. Зафиксируй входной OCR-текст и ожидаемый `meal`/макросы тестом.
3. Для новой еды добавь запись в `FOOD_DB` с макросами на 100 г и `foodState`.
4. Для новой этикетки проверь `100 g`, порцию, десятичные запятые, единицы и отсутствие обязательных полей.
5. Для штрихкода проверь offline-каталог и сетевой fallback отдельно.

## Проверки

- Parser: `npx vitest run src/engines/__tests__/nutrition-ocr-parser.test.ts src/engines/__tests__/nutrition-label-parser.test.ts`.
- Полный import/OCR: `npx vitest run src/core/__tests__/ocr-full-cycle.test.ts src/core/__tests__/offline-plate-ocr.test.ts`.
- UI сохранения: целевой тест из `src/ui/screens/NutritionScreen_parts/__tests__`.
- Всегда после TypeScript: `npm run type-check`; для APK UI: `npm run verify:apk-design`.

## Definition of done

Есть тест на сырой вход, нормализованный продукт, количество и отказ/неуверенность. Ошибка распознавания не превращается
в выдуманный продукт или медицинское утверждение.
