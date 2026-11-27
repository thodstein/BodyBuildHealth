# AI-распознавание еды, этикеток и анализов (food-vision)

Состояние: 2026-11-27. Слой добавлен как **fallback** к существующему OCR — текущий
путь распознавания не изменён. Работают три режима: `food` (тарелка), `label`
(фото упаковки/таблицы КБЖУ) и `lab` (бланк анализов, контракт готов, UI — отдельная
задача).

## 1. Зачем

OCR (`api/ocr-image.ts` / офлайн `tesseract.js`) читает **символы**. Скриншот
MyFitnessPal/FatSecret он разбирает хорошо, а фото тарелки без текста — никак:
`meals` пустой, дневник получает «не удалось распознать». Для такого фото нужен
слой, который **видит** продукты и порции. Это и есть food-vision.

Ключевое правило: **AI узнаёт что на фото, КБЖУ считает локальная база.**

| Что | Кто отвечает | Почему |
|---|---|---|
| Продукт, ингредиенты, граммы, уверенность | Модель (vision) | сильная сторона модели |
| КБЖУ на 100 г, микронутриенты | `FOOD_DB` через `findFood` | проверяемо, не галлюцинирует, стабильно между версиями модели |
| КБЖУ продукта, которого нет в базе | `estimate` модели | единственный fallback, помечается низкой уверенностью и предупреждением |

## 2. Поток данных

```
Файл (фото)
  └─ processUploadedFile()                     ← без изменений
       ├─ meals.length > 0  → дневник как раньше (AI не вызывается)
       └─ meals.length === 0 && labs.length === 0 && это изображение
            └─ recognizeFoodOrLabel(file, { ocrText })
                 ├─ OCR прочитал текст  → первым пробуем purpose: 'label'
                 └─ текста нет          → первым пробуем purpose: 'food'
                 └─ POST /api/food-vision  (в теле — OCR-текст как подсказка)
                      └─ api/food-vision.ts → api/_vision-core.ts → провайдер AI
                 └─ второй режим — только при содержательном отказе первого
                 └─ mapVisionPayload() → ParsedMeal[] (КБЖУ на 100 г + qtyGrams)

Фото упаковки из панели «КБЖУ с упаковки»
  └─ processUploadedFile() → parseNutritionLabel()
       └─ парсер не нашёл таблицу → recognizeFoodPhoto({ purpose: 'label', hint: OCR-текст, highRes: true })
            └─ mapLabelPayloadToNutritionLabel() → тот же черновик панели → своя база продуктов
```

Правила, которые нельзя менять без пересмотра тестов:

1. AI вызывается **только если OCR вернул 0 позиций** в дневнике (или не разобрал
   таблицу в панели упаковки). Скриншоты с позициями и бланки остаются на OCR/парсерах.
2. PDF и `.txt`/`.csv` в AI не уходят (`isImageFile` в `useDiaryQueue`).
3. `ParsedMeal.items` — КБЖУ **на 100 г**, порция — в `qtyGrams`. Дневник при
   сохранении сам умножает на `qty/100`. Ошибка здесь завышает калории в
   `qty/100` раз.
4. Никакой ключ AI не попадает в клиентский бандл: `VITE_*` для секретов не
   используется.
5. `needsUserInput` и `overallConfidence < 0.6` показываются предупреждениями:
   «масло?» и «размер порции?» меняют калории сильнее, чем средняя уверенность.

## 3. Файлы

| Файл | Роль |
|---|---|
| `src/engines/food-vision.types.ts` | контракт запрос/ответ/пейлоад (общий для сервера и клиента) |
| `api/_vision-core.ts` | провайдеры, промпты, извлечение и валидация JSON |
| `api/food-vision.ts` | Vercel-функция: `POST` — распознать, `GET` — статус |
| `src/engines/food-vision.engine.ts` | клиент: картинка → base64 → эндпоинт → `ParsedMeal[]`; авто-выбор `food`/`label` |
| `src/ui/.../diary/hooks/useDiaryQueue.ts` | точка включения fallback (тарелка/упаковка в дневнике) |
| `src/ui/.../diary/hooks/useLabelScan.ts` | точка включения fallback в панели «КБЖУ с упаковки» |
| `src/core/__tests__/food-vision-api.test.ts` | замки серверного ядра (43 теста) |
| `src/engines/__tests__/food-vision-engine.test.ts` | замки маппера и авто-режима (24 теста) |
| `src/ui/.../__tests__/nutrition-diary-vision-fallback.test.tsx` | замки UI-интеграции дневника (5 тестов) |
| `src/ui/.../diary/hooks/__tests__/use-label-scan.test.tsx` | замки панели упаковки (6 тестов) |

## 4. Настройка провайдера

Провайдер определяется по имени переменной окружения — точное имя секрета в
Vercel заранее неизвестно, а смена провайдера не должна требовать правки кода.
Порядок проверки:

| Провайдер | Переменные | Модель по умолчанию |
|---|---|---|
| Gemini | `GEMINI_API_KEY` или `GOOGLE_API_KEY` | `gemini-3.5-flash` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| OpenRouter | `OPENROUTER_API_KEY` | `google/gemini-2.0-flash-exp:free` |
| Groq | `GROQ_API_KEY` | `meta-llama/llama-4-scout-17b-16e-instruct` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` или автоматический `VERCEL_OIDC_TOKEN` на деплое | `google/gemini-2.5-flash` |
| Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | `@cf/meta/llama-3.2-11b-vision-instruct` |
| Любой OpenAI-совместимый | `AI_API_KEY` + `AI_BASE_URL` (+ `AI_MODEL`) | `gpt-4o-mini` |

Переопределения:

- `VISION_MODEL` — модель для любого провайдера (приоритет выше `AI_MODEL`);
- `AI_MODEL` — модель, если `VISION_MODEL` пуст;
- `VISION_PROVIDER` — поднять нужного провайдера в начало очереди
  (`gemini`, `openai`, `openrouter`, `groq`, `gateway`, `cloudflare`, `custom`).

Про Gemini: дефолт `gemini-3.5-flash`; если модель ответила 404 (снята для
новых ключей) или 503 (всплеск спроса), ядро пробует `gemini-3.5-flash-lite`,
а не роняет кадр. Основной модели отдаётся не больше 30 с из общего бюджета:
если она «задумалась» (в час пик Gemini отвечает 40–80 с на одну этикетку),
остаток уходит быстрой lite-модели вместо таймаута. Проверено на живом ключе
2026-11: `gemini-2.5-flash` → 404 «no longer available to new users»,
`gemini-flash-latest` (резолвится в `gemini-3.8-flash`) в час пик отдавал 503
либо 80 с, `gemini-3.5-flash` читает этикетку за 4–7 с (при деградации
провайдера — до 40 с).

Ключ задаётся в Vercel → Project → Settings → Environment Variables
(`GEMINI_API_KEY`, окружения production + preview + development) и действует
только после нового деплоя: значения env попадают в функцию в момент сборки.

```bash
curl -s https://body-build-health.vercel.app/api/food-vision
# {"ok":true,"configured":true,"provider":"gemini","model":"gemini-3.5-flash","purposes":["food","label","lab"]}
```

## 5. API

```
POST /api/food-vision
{
  "imageBase64": "<base64 или data:image/jpeg;base64,...>",
  "mimeType": "image/jpeg",        // необязательно
  "purpose": "food",               // food | label | lab
  "locale": "ru",                  // необязательно
  "hint": "Белки 16 Жиры 5 ..."    // необязательно: текст, который уже прочитал OCR
}
```

Успех:

```json
{
  "ok": true,
  "purpose": "food",
  "provider": "gemini",
  "model": "gemini-3.5-flash",
  "payload": {
    "dish": "курица с рисом",
    "items": [
      { "name": "Курица", "nameEn": "chicken breast", "grams": 180, "confidence": 0.9, "state": "cooked" }
    ],
    "needsUserInput": ["масло?"],
    "overallConfidence": 0.8
  }
}
```

Ошибка:

```json
{ "ok": false, "code": "no_provider", "error": "AI-провайдер не настроен: ..." }
```

Коды: `no_provider`, `no_image`, `image_too_large`, `timeout`, `provider_error`,
`invalid_json`, `empty_payload`, `invalid_payload`, `bad_request`,
`method_not_allowed`, `server_error`.

Ограничения: тело запроса ≤ 4.5 МБ (лимит Vercel Functions), поэтому картинка
≤ 3.3 МБ после декодирования — клиент сам сжимает кадр проходами
2048→1600→1280 px, пока base64 не влезет. Бюджет всего вызова 45 с: одна
попытка ≤ 45 с, повтор после 429/5xx — только если осталось ≥ 20 с (клиент ждёт
ответ 50 с, `maxDuration` функции 60 с). Память функции 1024 МБ (`vercel.json`).

## 6. APK

В WebView относительный `/api/...` резолвится в `https://localhost` и падает.
Поэтому в APK используется абсолютный адрес из `resolveFoodVisionEndpoint()`:

1. `VITE_FOOD_VISION_URL` при сборке (GitHub Actions: секрет
   `VITE_FOOD_VISION_URL`; если не задан — workflow подставляет продовый URL);
2. иначе — константа `DEFAULT_NATIVE_VISION_URL` в
   `src/engines/food-vision.engine.ts`
   (`https://body-build-health.vercel.app/api/food-vision`).

CORS эндпоинта открыт (`*`), потому что Capacitor грузит приложение с origin
`https://localhost`. Если продовый деплой недоступен, запрос возвращает ошибку
и приложение остаётся на офлайн-OCR — экран не ломается.

## 7. Что видит пользователь

- при распознавании: подсказка «🍽 Текст на фото не найден — AI определяет
  блюдо и порции…» или «🏷 Текст есть, таблица не разобрана — AI читает
  упаковку…»;
- позиции попадают в очередь дневника как обычные: вес правится, состав
  редактируется;
- режим этикетки даёт одну позицию **на 100 г** и подсказку «укажите съеденную
  граммовку» — дневник умножит на фактический вес;
- панель «КБЖУ с упаковки»: если OCR не разобрал таблицу, значения читает AI,
  черновик заполняется теми же полями (название, ккал, БЖУ, клетчатка, Na) и
  сохраняется в свою базу с предупреждением «сверьте цифры с этикеткой»;
- если продукт оценён ИИ (нет в базе) — предупреждение в подсказке и низкая
  уверенность в очередь;
- если ИИ увидел сырое, а в базе готовое (или наоборот) — предупреждение
  «проверьте граммовку», числа базы не подменяются;
- `needsUserInput` («масло?», «размер порции?») и общая уверенность < 0.6
  показываются предупреждениями.

## 8. Анализы (заложено, не подключено в UI)

`purpose: 'lab'` уже обслуживается тем же эндпоинтом: возвращает
`values: [{ code, name, value, unit, refLow?, refHigh?, confidence }]`, `date`,
`labName`, `warnings`. Клиент отдаёт их в `FoodVisionClientResult.lab` (в
дневник питания они не попадают). Запись в лабораторный раздел — отдельная
задача; второй инфраструктуры (ключ, провайдер, эндпоинт) для неё не нужно.

## 9. Проверки

```bash
npx tsc --noEmit -p tsconfig.api.json
npx vitest run src/core/__tests__/food-vision-api.test.ts \
  src/engines/__tests__/food-vision-engine.test.ts \
  src/ui/screens/NutritionScreen_parts/__tests__/nutrition-diary-vision-fallback.test.tsx \
  src/ui/screens/NutritionScreen_parts/diary/hooks/__tests__/use-label-scan.test.tsx
npm run type-check
npm run verify:apk-design
```

## 10. Риски и ограничения

- **Эндпоинт публичный** (как и `api/ocr-image.ts`): любой, кто знает URL,
  может тратить квоту AI. Для личного приложения это приемлемо; при росте
  нагрузки нужен rate-limit/WAF или подпись запроса.
- **Квота бесплатного тарифа** ограничена: повторная загрузка того же фото
  берётся из кэша (8 последних), но новые фото каждый раз стоят запрос.
- **Оценка ИИ ≠ факт**: позиции без совпадения в `FOOD_DB` помечаются низкой
  уверенностью — это сигнал проверить, а не готовое число.
- **Этикетка сверяет энергию с БЖУ только на «кДж-паттерне»**: если ккал
  ровно в ~4,2 раза (диапазон 3,2–5,2) больше `P×4 + F×9 + C×4`, сервер считает,
  что модель принесла кДж, ставит ккал по макросам и понижает `confidence` до
  0.5. Обычное расхождение (полиолы/эритрит, алкоголь, клетчатка) **не**
  пересчитывается: иначе 40 ккал батончика на эритрите превратились бы в 360.
- **Cloudflare Workers AI** вызывается через OpenAI-совместимый
  `/ai/v1/chat/completions`; legacy `/ai/run/{model}` ждёт другую схему и
  отвечает 400.
- **Второй режим — только при содержательном отказе** (`invalid_payload`,
  `empty_payload`, `invalid_json`). Сеть, таймаут, `no_provider`, лимиты и 5xx
  вторым промптом не лечатся: это лишние 50 с и лишняя квота. Решение идёт по
  коду ошибки, а не по тексту. Общий дедлайн на оба режима — 50 с (клиентский
  таймаут), кадры готовятся раздельно: этикетка 2048 px, тарелка 1600 px.
- **Режим этикетки выбирается по маркерам**, а не по длине текста: нужны
  «ккал/калории/пищевая ценность/белки/жиры/углеводы» (или `kcal/protein`).
  Вывеска ресторана в кадре больше не тратит первый запрос на таблицу.
- **Версия модели** может измениться у провайдера (`gemini-flash-latest` —
  плавающий alias). Для воспроизводимости закрепите точную модель в
  `VISION_MODEL`.
