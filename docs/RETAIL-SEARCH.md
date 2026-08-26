# Живой поиск продуктов из супермаркетов РФ (retail-search)

Поиск по каталогам сетей (ВкусВилл / Пятёрочка / Магнит) с КБЖУ прямо в дневнике питания
и каталоге — как в FatSecret: пользователь вводит название → результаты с КБЖУ на 100 г.

## Как это работает

```
Дневник/каталог → локальная FOOD_DB (мгновенно)
                → Edge Function retail-search на Supabase (1–3 сек)
                    ├─ 🥗 ВкусВилл: официальный открытый MCP-API (mcp.vkusvill.ru)
                    │   search → детали топ-N товаров (КБЖУ в свойствах)
                    ├─ 🔴 Пятёрочка: каталог 5ka.ru (КБЖУ в выдаче)
                    └─ ⭕ Магнит: каталог magnit.ru (экспериментально)
                → нормализация {название, сеть, бренд, ккал/Б/Ж/У на 100 г}
                → клиентский кэш localStorage `he_retail_search_cache_v1` (24 ч)
```

- Браузер напрямую в сети не ходит (CORS) — только через прокси-функцию.
- Если функция не развёрнута/упала — приложение работает как раньше
  (локальная база + OpenFoodFacts), секция «🏪 Супермаркеты РФ» просто не появляется.
- Штрихкоды и OCR работают независимо от этого механизма.

## Установка (один раз)

### Вариант A — Dashboard (без CLI)

1. Открой https://supabase.com/dashboard → твой проект.
2. Левое меню → **Edge Functions** → **Create a new function** → **Deploy from editor**.
3. Имя функции: `retail-search` (точно так, иначе клиент её не найдёт).
4. Вставь содержимое `supabase/functions/retail-search/index.ts` → **Deploy**.

### Вариант B — CLI

```bash
supabase functions deploy retail-search --project-ref <PROJECT_REF>
```

(файл уже лежит в репо: `supabase/functions/retail-search/index.ts`; нужен
`supabase login` и `--use-api` при запросе линковки.)

## Проверка

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/retail-search" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"query":"творог","limit":5}'
```

Ожидаемый ответ: `{"items":[{"id":"...","source":"vkusvill","name":"Творог ...",
"kcal":71,"protein":12,"fat":0.2,"carbs":4.7}, ...],"sources":["vkusvill",...]}`

В приложении: дневник питания → «+ Добавить» → набрать «творог вкусвилл» или
«хумус» → под локальными результатами появится зелёная секция «🏪 Супермаркеты РФ».

## Ограничения и roadmap

| Сеть | Статус | Проверено (Aug 2026) |
|---|---|---|
| ВкусВилл | ✅ **работает**: поиск по имени + штрихкод | официальный MCP-API; КБЖУ прямо в выдаче (`properties` → «…в 100 г»); `vkusvill_product_barcode` принимает ровно 13 цифр EAN |
| Пятёрочка | ❌ | анти-бот: HTTP 403 на любые датацентровые IP |
| Магнит | ❌ | публичного API не существует |
| Ашан | ❌ | WAF «Access Blocked» даже с полными браузерными заголовками (`/v1/catalog/products`) |
| Перекрёсток | ❌ | нужна живая браузерная сессия: капча + cookie + Auth-заголовок (см. perekrestok_api: Playwright/Camoufox) |
| Лента | ❌ | api/v1 отдаёт 401 без авторизации |
| Азбука Вкуса | ❌ | services-api.av.ru/search и av.ru/rest/v1 отдают SPA HTML |
| Чижик | ❌ | сайт за stealth-анти-ботом (chizhik_api использует camoufox) |
| О'КЕЙ / Утконос / Метро | ❌ | соединение блокировано / 401 / каталог за логином |

Вывод: ВкусВилл — единственная крупная сеть РФ с открытым программным доступом.
Остальные сети закрываются штрихкод-сканером (OFF → retail-barcode → общая база
`food_barcode_catalog`). Платные обёртки (parse.bot ~1 кредит/вызов) могут дать
Перекрёсток/Ленту/Метро — подключение возможно через тот же edge-прокси при желании.

## Штрихкоды (Aug 26)

Цепочка сканера: OFF (ru/world/us) → общая база Supabase `food_barcode_catalog` →
**retail-search {barcode}** (ВкусВилл MCP) → ручной ввод. Клиент:
`searchRetailProductByBarcode()` в `retail-search.engine.ts` (кэш `bc:<ean>` в общем
кэше 24 ч); подключено в `BarcodeScanner.tsx` после OFF.

Функция уже развёрнута: `npx supabase functions deploy retail-search --project-ref <REF>`
с `SUPABASE_ACCESS_TOKEN`. Ответ содержит `debug[]` (диагностика источников).

- Кэш клиента: 24 ч, до 40 последних запросов. Очистить: `clearRetailCache()`
  из `retail-search.engine.ts` или удалить ключ `he_retail_search_cache_v1`.
- Функция не пишет в БД Supabase (миграций не требует).
- Лимиты внешних API неизвестны; функция делает ≤1 поиск + ≤N деталей за запрос,
  клиентский кэш снижает повторные вызовы почти до нуля.

## Файлы

- `src/engines/retail-search.engine.ts` — клиент: вызов функции, санитайзинг,
  кэш, конвертер `retailToFoodItem`, бейджи сетей `RETAIL_CHAINS`.
- `supabase/functions/retail-search/index.ts` — Deno-функция (без зависимостей):
  адаптеры ВкусВилл (MCP JSON-RPC), Пятёрочка, Магнит; CORS; таймауты 8–9 с;
  невалидные КБЖУ отбрасываются (`clampMacros`), источники объединяются round-robin.
- Тесты: `src/engines/__tests__/retail-search.test.ts`.
