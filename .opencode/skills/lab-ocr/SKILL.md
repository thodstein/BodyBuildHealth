---
name: Laboratory OCR
description: Распознавание лабораторных бланков, провайдеров, биомаркеров, единиц UCUM и безопасное сохранение результатов
---

# Laboratory OCR and lab parsing

Используй этот навык для фото/PDF/текста анализов, новых лабораторий, маркеров, единиц и порогов.

## Реальный pipeline

`src/core/ocr-engine.ts` → `lab-auto-parser.ts`/`pdf-parser.engine.ts`/`biomarker-regex-engine.ts` →
`labs-mapping.ts` (`mapToUcumCode`, `normalizeLabMeasurement`) → `lab-bound.ts` → `lab-norms.engine.ts` → IndexedDB.

Провайдер определяется до извлечения полей. Для PDF сначала используется текстовый parser, а сканированный PDF уходит
в OCR fallback. APK должен работать через offline Tesseract.

## Безопасность данных

- Канонический код хранится через `mapToUcumCode`; не создавай вторую таблицу имён.
- Единица нормализуется до записи; raw unit можно сохранить только как provenance, не как canonical value.
- Референсный диапазон бланка не является универсальной медицинской нормой. Не подменяй `LAB_TIERS` числами из OCR.
- Не изобретай порог, клиническую интерпретацию или единицу при низкой уверенности. Возвращай warning/unknown.
- Границы/нормы меняются только через `lab-norms.engine.ts` и соответствующий источник/тест.
- Не смешивай `HbA1c` в `%` и `mmol/mol`, гормоны mass/molar units, activity units и fraction без явной конвертации.

## Добавление провайдера или маркера

1. Проверь существующие `PROVIDER_HEADERS`, aliases, `biomarker-regex-engine` и `labs-mapping`.
2. Добавь минимальную regex/header ветку рядом с существующей таблицей, не ad-hoc parser в экране.
3. Проверь запятые/точки, OCR-ошибки `O/0`, `I/1`, русские/латинские названия, знак `<`/`>` и ref range.
4. Добавь fixture с исходным текстом и тестом конечного canonical code, value, unit, bounds и warning.
5. Проверь повторный импорт, неизвестный маркер и несовместимую единицу.

## Проверки

- `npx vitest run src/core/__tests__/ocr-full-cycle.test.ts src/core/__tests__/lab-provider-e2e.test.ts src/core/__tests__/lab-unit-normalization.test.ts`.
- Для APK/OCR: `npx vitest run src/core/__tests__/lab-apk-offline.test.ts src/core/__tests__/lab-apk-pdf.test.ts`.
- Затем `npm run type-check`; для UI дополнительно `npm run test:ui` и `npm run verify:apk-design`.

## Медицинский контур

Парсер извлекает и нормализует измерение, но не ставит диагноз. Интерпретация должна ссылаться на `repo_lab` и внешнюю
доказательную базу; красные флаги ведут к существующему medical escalation flow.
