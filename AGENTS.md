## Session Summary (Jun 20)
### Done
- **PctScreen fix**: CLASS_LABELS filled with Russian (`СЕРМ`, `Ингибиторы ароматазы`, `Дофаминовые агонисты`, `Гонадотропины`); pct-planner.engine.ts updated to include `class` in PCTProtocolItem; removed `as any`
- **SubstancesScreen CLASS_LABELS**: all 16 class labels populated with Russian names (was 10 empty + fallback to English keys)
- **SmartAssistantScreen**: fixed 11 empty-string issues — glossary terms with definitions (11 entries), welcome message, error message, checkup results with recommendations, input placeholder, send button, quick questions (5 real questions), search placeholder, notifications button shows readiness data
- **Backup/duplicate cleanup**: removed 9 backup files (.bak, .bak2, .bak3, .backup, .backup2, backup_ui/), 3 duplicate data files (support-database-test.ts, support-database.with-450-interactions.ts, core/data/interactions.ts — fixed master-db.ts import), 2 misplaced MD files in engines/
- **Console.log cleanup**: main.tsx (-20 lines), service-worker.ts (-3), labs.engine.ts (-2), performance-optimizer.ts (-1), data-loader.ts (-1) — removed debug step-by-step logging, kept error/warn for diagnostics
- **mechanism-labels.ts**: FULL RESTORE (553 entries) from corrupted encoding to proper Russian text + integrated into codebase (replaced inline MECHANISM_LABELS_RU in weekly-plan.engine.ts with import from centralized file + added missing weekly-plan keys)
- **FertilityPCTScreen guides**: MAJOR EXPANSION (159KB, ~3000 lines) — all 3 guide tabs expanded from ~20% to ~80% coverage of user's HTML files:
  - **PCT guide** (+7 new cards): lab monitoring table, detailed nutraceutical table with doses, organ protection (hepatic/cardiac/renal), 3 clinical cases, FAQ (5 Qs), psychology of PCT, 11 PubMed references
  - **HRT guide** (+8 new cards): ADAM scale (10-question screening), lab minimum table (10 markers with targets), drug forms pharmacokinetics (6 forms), full interaction table (12 pairs), 5 additional clinical cases, monitoring schedule (4 periods), special situations (post-RP/CKD/>70yo), final checklist
  - **Fertility guide** (+11 new cards): AAS neurotoxicity (6 mechanisms), universal supplements table (16 rows with doses), hMG full chapter (mechanics/vs hCG/protocols/efficacy 66.8%/side effects/availability), female factor & ART (IUI/IVF/ICSI/PICSI), enclomiphene detail (4 studies, BSSM/AUA position), hidden obstacles table (8 substances), nootropics compatibility table (6 classes), FAQ (8 Qs), psychological traps (4 + CBT), appendices (WHO 2021 norms + pre-cycle checklist), 16 key PubMed references
- **DashboardScreen**: FULL REWRITE — from 3-button stub to aggregated overview with profile card (name, goal, PAL, TDEE), risk card (score bar + system count), training/course stats grid, today's KBJU with targets vs actual, 12-button navigation grid
- **DashboardScreen REMOVED + navigation simplified**: удалена вкладка `home` из PRIMARY_NAV, default tab изменён на `training`, удалён импорт DashboardScreen, handleNavigate маппинги починены
- **DashboardScreen RESTORED**: возвращена вкладка `home` в PRIMARY_NAV, default tab изменён на `home`, DashboardScreen импорт и switch-case восстановлены, back button починен
- **FertilityPCTScreen**: 3 stray `</>` фрагмента удалены (ошибки TS1005/TS1003/TS1109)
- **Nutrition diary crash**: починен импорт BarcodeScanner (`../../components/BarcodeScanner` → правильный путь)
- **Glass эффект удалён**: убраны backdropFilter/WebkitBackdropFilter из 46 мест: DashboardScreen, SupportScreen, NutritionScreen, ProfileScreen, TrainingScreen, MarketplaceScreen, FertilityPCTScreen, NutritionReference, NutritionDiary, IndividualPlan, LabsScreen. Все карты переведены на `rgba(24,24,27,0.15)` с `border: 1px solid rgba(255,255,255,0.04)`
- **Back button SupportScreen**: добавлен `peptides` в обработку goBack (пустая страница при первом нажатии)
- **hCG дозировки исправлены**: везде установлено 500 МЕ 2р/нед, схема 3/1 (3 нед приема, 1 нед отдых). Изменены: support-levels.ts, support-catalog.ts, SupportScreen.tsx, FertilityPCTScreen.tsx, risk-engine-v7-matrix.ts, recommendations.ts, system-mechanisms.ts, injury-cycle-blood.engine.ts, pct-planner.engine.ts, periodization-meet-pct.engine.ts
- **Risk engine fix**: protectionFraction capped at 0.7 (max 70% reduction), diminishing factor 0.65 applied. Предотвращает ложное 96-100% снижение риска
- **Risk display sync**: калькулятор использует calcResult.riskBeforeSupport вместо linked.risk.overallRaw (95%→30% bug fixed)
- **Report support plan**: добавлена колонка "Цель" с отображением категорий поддержки
- `tsc --noEmit` ✓, `vite build` ✓

## Session Summary (Jun 23)
### Done
- **support-database.ts**: 20+ SUPPORT_CATALOG_DATA entries re-added (DIOSMIN, BERGAMOT, SERRAPEPTASE, PAPAIN, BROMELAIN, PHARMA_TADALAFIL, LUMBROKINASE, HORSE_CHESTNUT, INOSINE, NARINGIN, PHARMA_CABERGOLINE, NATTOKINASE, HESPERIDIN, CITRUS_BIOFLAVONOIDS, BROMANTANE, FASORACETAM, AGMATINE, TMG, SAME, VITAMIN_B1, COLOSTRUM, PYCNOGENOL). Full descriptions, mechanisms, organs, forms, synergies, conflicts, monitoring, contraindications, sideEffects.
- **support-database.ts**: 19 ALL_SUBSTANCES entries added for the same ids.
- **support-database.ts**: name-mapping entries (`const L`) added for all new substances.
- **support-database.ts**: PHARMA_ANASTROZOLE + PHARMA_LETROZOLE added to ALL_SUBSTANCES array.
- **support-database.ts**: PHARMA_ANASTROZOLE/PHARMA_LETROZOLE/IMMUNE_LACTOFERRIN enriched in SUPPORT_CATALOG_DATA with synergies, conflicts, monitoring, contraindications.
- **support-database.ts**: BROMELAIN, FOLATE, LECITHIN, PHOSPHATIDYLSERINE, PHOSPHATIDYLCHOLINE, ARTICHOKE, VITAMIN_E, BERBERINE, L_THEANINE, GLYCINE, ASTRAGALUS added to SUPPORT_CATALOG_DATA (were incorrectly placed in CATALOG_ENRICHMENT → moved to correct location).
- **SupportScreen.tsx** — TYPE_GROUPS/LABELS/name/organ mapping fixes from previous session verified intact.
- `tsc --noEmit` ✓, `vite build` ✓

### Critical Fixes
- Fixed: orphan catalog entries were inserted into CATALOG_ENRICHMENT instead of SUPPORT_CATALOG_DATA by script (wrong insertion point detection). Moved all 11 entries to correct location.
- Fixed: `const L` (name-mapping object) was intact — earlier Node.js search was misleading (found `ALL_SUBSTANCES` inside a comment, not the actual const).
- ALL_SUBSTANCES array is intact (original entries preserved, new entries appended).

### Blocked
- None

## Session Summary (Jun 20 — Part 2)
### Critical Bugs Fixed
- **Строки поиска**: 6 файлов (TrainingScreen, SubstancesScreen, NutritionScreen×2, NutritionDiary) — добавлена null-safety `(e.name||'').toLowerCase()` — ошибка TypeError при пустых данных
- **ХГЧ в калькуляторе**: report generator использовал `SUPPORT_LEVELS[supportLevel]?.subs` вместо `effectiveLevel?.subs` — теперь учитывает фазовые корректировки (course/bridge/pct/fertility)
- **Glass-эффект**: проверены все 46 мест, удалён везде кроме SVG blur в V7RiskDisplay (декоративный)

### New Features
- **Лаборатория → Отчёты**: новая вкладка с генерацией полного отчёта (таблица маркеров с нормами/отклонениями/датами), архивирование в localStorage (20 последних), кнопка очистки
- **Риски → Инфо переписан**: секция "Фармакологическая поддержка" удалена, добавлен "Детальный расчёт рисков: пошаговая методология" (10 шагов)
- **Риски → Отчёты**: новая вкладка с генерацией отчёта по всем системам риска + архив
- **Фарма/Курс → Отчёты**: новая подвкладка с полным отчётом по препаратам, дозам и фазам + архив
- **Тренировки → Отчёты**: новая подвкладка с отчётом по упражнениям, плану, объёму + архив
- **Профиль → Отчёты**: подвкладки "Текущие" / "Архив". В текущих — тренерский, врачебный, общий отчёты + сводка питания/поддержки. В архиве — агрегированные отчёты из Лаборатории, Рисков, Курса и Тренировок
- **Профиль → Замеры**: новая вкладка "Замеры" с формой ввода 6 антропометрических параметров и историей
- **Фертильность**: удалены дублирующие подвкладки (semen, hormones, structure), все анализы объединены в подвкладку "Анализы" с подсекциями: Гормоны+Данные, Спермограмма, DFI/Структура, Периоды сдачи, Инструментальные
- `tsc --noEmit` ✓, `vite build` ✓

## Build Commands
```bash
cd D:\BodyBuildHealth
$env:NODE_OPTIONS='--max-old-space-size=2048'; npx tsc --noEmit
$env:NODE_OPTIONS='--max-old-space-size=2048'; npx vite build
```

## 🎯 ПЛАН НА СЛЕДУЮЩУЮ СЕССИЮ (приоритеты)

### Критические баги (проверить и исправить):
1. **Питание → Планирование → краш** — IndividualPlan падает при загрузке. Возможная причина: circular dependency в nutrition-v2-data.ts или calcNutritionV2. Принудительно обернуть всё в try-catch.
2. **Профиль → Дневники** — проверить ВСЕ 12 карточек: Травмы (пустая?), Замеры (починено?), Риски (ведёт в reports), Сон (не дневник), Давление (нет архива/графика). Каждая карточка должна вести на таб с РЕАЛЬНЫМ контентом.
3. **Питание → Отчёты** — кнопка "Сгенерировать" не сохраняет отчёт в `he_nutrition_report_current`. Проверить цепочку: генерация → setFullReport → setReportEditText → localStorage.
4. **ВСЕ** блоковые отчёты (Labs, Risks, Pharma, Training) — проверить что сохраняются в `he_X_reports_current`, а не сразу в archive. Отчёты должны открываться на редактирование.

### Функциональность (доработка):
5. **Калькулятор поддержки** — ХГЧ должен назначаться автоматически при наличии ААС в курсе (сейчас только через `boostEnabled`). Добавить логику: если курс содержит ААС → добавить hCG в план независимо от уровня.
6. **Калькулятор поддержки → "О подборе"** — сейчас размещён внизу вкладки калькулятора. Перенести в отдельную подвкладку или убрать.
7. **Калькулятор поддержки → План** — план не сохраняется в "Мои планы". Добавить кнопку "Сохранить план" в localStorage.
8. **Риски и поддержка** — не синхронизированы. Риски из support.engine.ts должны передаваться в riskScreen и наоборот.

### База данных (расширение):
9. **catalog-enrichment.ts** — добавить `maxUsageWeeks`, `labMarkers`, `restrictions` для ВСЕХ core-препаратов (сейчас только NAC и telmisartan).
10. **synergy-network.ts** — расширить: добавить пары для грибов (чага, кордицепс, рейши), адаптогенов, лекарственных препаратов.
11. **Грибы** — проверить категоризацию: чага → immunity, cordyceps → renal/immunity, lions_mane → neuro. Добавить category-тег `mushroom`.

### UI/UX (улучшение):
12. **Фертильность → карточки анализов** — переделать ручной ввод: большие поля, чёткие лейблы, better spacing. Сейчас выглядят сжато.
13. **Профиль → Дневник сна** — сделать настоящий дневник: ввод часов сна, качества, сохранение в localStorage, график за неделю.
14. **Профиль → Давление** — добавить архив записей и график динамики за неделю/месяц.
15. **Profile → Reports** — кнопка "Сгенерировать свой отчёт" с попапом: выбор блоков для включения.

### Технический долг:
16. **ProfileScreen** — проверить ВСЕ useState в conditional IIFE: `tab === 'bp_diary'`, `tab === 'diaries'`, `tab === 'progress'`. Каждый такой блок рискует крашем. Выносить в отдельные компоненты.
17. **IndividualPlan** — все новые импорты (calcNutritionV2, contraindications, nutrition-v2-data) обернуть в try-catch при вызове, не при импорте.
18. **Зависимости** — проверить нет ли циклических зависимостей между nutrition-v2-data.ts, contraindications.ts, bp-hr-data.ts.

## Key Decisions
- PAL formula: `1.2 + (workoutsPerWeek × 0.075) + (avgWorkoutMinutes > 60 ? 0.1 : 0)` clamped [1.2, 1.9]
- Training load ratio: `(workoutsPerWeek × avgWorkoutMinutes) / 420` clamped [0.2, 1.5]
- All UI text in Russian
- Dark theme, green accent #00e68a
- All data via IndexedDB + useDataLink
- Deploy: Vercel at body-build-health.vercel.app
- Description generation — template-based (not AI): type + categories → Russian text (30-100 chars)
- Synergy entries format: `||` delimiter to avoid comma/quotes issues
- TS error fix: wrap array in `([] as Type[])` assertion pattern

## Agent Rules (ОБЯЗАТЕЛЬНО)

### Роль
Ты Senior Fullstack-разработчик. Твоя задача — писать работающий production-код для данного проекта (Health Engine — Telegram Mini App, TypeScript + Vite, browser-only).

Нижеследующие правила являются **приоритетными и обязательными** для всех агентов.

---

# Максимальный стандарт разработки Telegram Mini App (React + TS)

## 1. Специфика платформы (Telegram Mini App & Mobile First)
* **Мобильная адаптация:** Весь UI/UX строго Mobile-First. Запрещено использовать фиксированную ширину в пикселях (`px`) для контейнеров. Использовать относительные единицы (`vw`, `vh`, `%`, `rem`) и Flexbox/Grid. Сетка должна быть протестирована под экраны смартфонов (320px–480px).
* **Контроль высоты (Viewport):** Всегда использовать `window.Telegram.WebApp.expand()` для развертывания на весь экран. Обязательно подписываться на событие `window.Telegram.WebApp.onEvent('viewportChanged', callback)` для динамического перерасчета высоты элементов (особенно при открытии экранной клавиатуры).
* **Безопасный рендеринг:** Не рендерить основной интерфейс приложения до тех пор, пока не отработает метод `window.Telegram.WebApp.ready()`. До этого момента показывать аккуратный мобильный Loader/Spinner.
* **Интеграция с Telegram API:** Все компоненты должны бесшовно взаимодействовать с API мессенджера. Настраивать цвета через `WebApp.themeParams` (динамическая темная/светлая тема Telegram). Обязательно использовать встроенные элементы управления: `MainButton`, `BackButton`, `HapticFeedback`.
* **Запрет десктопных паттернов:** Никаких тяжелых hover-эффектов (на мобильных их нет), мелких кликабельных элементов (минимальный размер тач-зоны — 44x44px), или горизонтального скролла всей страницы.

## 2. Работа с изображениями (Запрет на обрезку фото)
* **Отображение изображений без обрезки:** Категорически запрещено использовать `object-fit: cover` для адаптивных картинок, если требуется сохранить фото целиком. Для предотвращения обрезки краев изображений на любых мобильных экранах Агент ОБЯЗАН использовать `object-fit: contain` или `background-size: contain`. Размеры контейнера должны гибко подстраиваться под пропорции картинки через `max-width: 100%` и `height: auto`. Фото должно быть видно полностью от края до края.

## 3. Локальное тестирование (Mocking)
* **Защита от падения в браузере:** Агент ОБЯЗАН внедрять проверку на среду выполнения. Если приложение запущено вне Telegram (например, локально в Chrome/Firefox через `localhost`), объект `window.Telegram.WebApp` должен подменять свои методы на безопасные Mock-заглушки (демо-данные пользователя, фейковые параметры темы), чтобы приложение не падало с критической ошибкой, а позволяло вести разработку на ПК.

## 4. Архитектура, Типизация и Гигиена (Борьба с мусором и сиротами)
* **Разбиение файлов (Модульность):** Запрещено писать компоненты или хуки объемом более 150 строк кода. Большие файлы Агент ОБЯЗАН дробить на мелкие изолированные подкомпоненты для удобства работы в рамках лимита контекста.
* **Целостность графа зависимостей (Запрет на файлы-сироты):** Категорически запрещено создавать новые компоненты, хуки (`.ts`/`.tsx`) или стили (`.css`), не подключая их к общей цепочке импортов. Если создается новый файл, Агент ОБЯЗАН в этом же ответе модифицировать родительский компонент (например, `App.tsx`, файл роутера или индексный файл папки компонентов), чтобы импортировать и отрендерить новинку. Код, который просто лежит на диске и не вызывается, считается критической ошибкой.
* **Строгая типизация TypeScript:** Запрещено использовать тип `any`. Все пропсы компонентов, состояния хуков и ответы от Telegram API должны быть четко описаны через `interface` или `type`. Обязательно объявлять глобальные типы для `window.Telegram`, чтобы сборщик проекта не выдавал ошибки компиляции.
* **Запрет на дублирование и мусор:** Перед созданием файла Агент проверяет существующие папки. Запрещено плодить временные файлы вроде `TestComponent.tsx`, `App_backup.tsx`, `styles_v2.css`. При изменении логики старые неиспользуемые импорты и мертвый код должны немедленно удаляться из файлов.

## 5. Правила генерации кода
* **Прямой ответ:** Ответ начинается СРАЗУ с блоков кода (Markdown code blocks). Запрещены приветствия, вводные слова, извинения и текстовые планы перед кодом.
* **Полнота реализации:** Только 100% готовый к запуску продакшн-код. Категорически запрещено использовать комментарии-заглушки вида `// твой код здесь`, `// TODO` или оставлять функции пустыми.
* **Структура файлов:** Перед каждым блоком кода должен быть заголовок формата `### src/путь/Имя_файла.tsx`.
* **ЧИСТЫЙ СИНТАКСИС:** Используй только существующие и актуальные методы/API. Не выдумывай функции. Если не уверен — используй базовые стандартные конструкции языка.
* **НЕ ДУБЛИРУЙ КОД:** Один функционал — один экземпляр. Никаких копий калькуляторов, генераторов, UI-блоков. Если нужен reuse — выноси в общий компонент/функцию.
* **ПРОВЕРЯЙ:** После каждого изменения обязательно запускай `tsc --noEmit` и `vite build`. Исправляй все ошибки до того как считать задачу завершённой.
* **НЕ УДАЛЯЙ РАБОЧИЙ ФУНКЦИОНАЛ:** Не заменяй рабочий inline-контент на «редиректы» или заглушки. Каждая вкладка должна содержать реальный работающий контент.
* **РУССКИЕ ПОДПИСИ:** Все UI-лейблы на русском. Никаких английских fallback-названий.

## 6. Правила технического аудита и честных отчетов
После вывода блоков кода Агент обязан поставить горизонтальную черту (`---`) и вывести сухой отчет по пунктам:
### 🟢 РЕАЛЬНО СДЕЛАННЫЙ ФУНКЦИОНАЛ
* (Список компонентов, TS-интерфейсов и интеграций с Telegram API, код которых написан полностью и присутствует в ответе).
### 🔗 ПРОВЕРКА ПОДКЛЮЧЕНИЯ И ИМПОРТОВ К APP.TSX
* (Пошаговое подтверждение связей. Формат: «Новый компонент `X.tsx` успешно импортирован в файл `Y.tsx` (или `App.tsx`) на строке N и вызван внутри JSX». Если компонент временно не подключен, прямо написать: «КРИТИЧЕСКИЙ СТАТУС: Файл Х изолирован, граф зависимостей нарушен»).
### 🟡 ОГРАНИЧЕНИЯ И ЗАГЛУШКИ
* (Четко зафиксировать, какие файлы, методы, стили или мобильные адаптации были пропущены/сокращены из-за лимита контекста. Если код полон, написать: «Отсутствуют»).
### 🗑️ УДАЛЕННЫЙ МУСОР И ИЗМЕНЕНИЯ СТРУКТУРЫ
* (Список удаленных неиспользуемых файлов, удаленных строк «мертвого» кода, а также отчет о разбиении крупных файлов: что из какого файла было вынесено для удобства).
### 🔴 ЧТО ДЕЛАТЬ СЛЕДУЮЩИМ ШАГОМ
* (Технический список конкретных модулей или функций, которые необходимо дописать или подключить в следующем сообщении, чтобы приложение гарантированно заработало на телефоне).

## 6a. Лимит размера файлов
**ВСЕ файлы должны быть не более 1500 строк.** Любой файл, превышающий этот лимит, должен быть разбит на более мелкие логические модули без потери информации и функциональности. Каждый вынесенный модуль обязан быть импортирован в родительский файл и сохранён в той же папке с суффиксом, отражающим его содержимое (например, `SupportModals.tsx`, `SupportData.tsx`).

## 7. Профессиональная объективность
* Агент обязан приоритизировать техническую точность, мобильную адаптивность и правдивость над вежливостью. Скрытие недоработок кода, сиротские (неподключенные) файлы или создание избыточных модулей считается критической ошибкой.

## 8. Интеграция новых препаратов/веществ (Обязательная полнота)
При добавлении любого нового препарата или вещества в базу данных (support-database.ts, pharma-database.ts и т.д.) Агент ОБЯЗАН обеспечить **полное заполнение всей информации**:

1. **Полная карточка препарата** — все поля SUPPORT_CATALOG_DATA: id, name, typeEn, ru, description, mechanisms, targetOrgans, dosageForms, timingDosage, duration, contraindications, sideEffects, monitoring, tier, categories, source, researchLinks, activeSubstance, halfLife, bioavailability, metabolism, excretion, synonyms.
2. **Описание** — развёрнутое русскоязычное описание (50-300 символов), механизм действия, показания.
3. **Взаимодействия** — заполнить `synergies` (с указанием типа, эффекта, механизма) и `conflicts` в карточке каталога.
4. **Синергии и антисинергии** — добавить записи в ALL_INTERACTIONS (`support-substances.ts`) для всех известных клинически значимых пар (не менее 2-3 на вещество).
5. **Конфликты и особые указания** — внести противопоказания (contraindications), особые указания (specialInstructions), мониторинг (monitoring).
6. **Анализы/лабораторный контроль** — указать labMarkers, какие маркеры отслеживать, с какой периодичностью.
7. **Маппинги** — добавить вещество во все необходимые структуры:
   - ALL_SUBSTANCES (`support-substances.ts`)
   - L mapping (`name-mapping` в `support-synergy-stacks.ts`)
   - CATALOG_ENRICHMENT (`support-enrichment.ts`) — если нужны дополнительные поля обогащения
   - При необходимости — в `pharma-database.ts`, `drug-mapper.engine.ts`, `interaction-engine.ts`.
8. **Полная интеграция во все разделы приложения** — препарат должен быть виден и функционален в:
   - Каталоге (поиск, фильтрация по категории/типу)
   - Детальном просмотре (все поля, синергии, взаимодействия)
   - Калькуляторе поддержки (расчёт доз, проверка конфликтов)
   - Отчётах (генерация плана с новым веществом)
   - Рисках (если вещество влияет на риски — добавить в risk-engine)
   - Взаимодействиях (ALL_INTERACTIONS)
9. **Валидация** — после внесения изменений обязательно запустить `tsc --noEmit` и `vite build`. Все ошибки типизации и сборки исправить до завершения задачи.

**Нарушение этих правил считается критической ошибкой.** Недозаполненные карточки, отсутствие в ALL_INTERACTIONS или пропущенные маппинги недопустимы.

## 9. Аудит и структурирование каталога поддержки (СКВОЗНАЯ РАБОТА С БАЗОЙ)

### 9.1. Алгоритм обработки каталога
При аудите/наполнении каталога строго соблюдать:
1. Перебрать последовательно всю существующую базу `SUPPORT_CATALOG_DATA`.
2. Для каждого препарата создать/дополнить цифровую карточку, полностью заполнив все обязательные поля (см. Шаблон в п.9.2).
3. Провести сквозной кросс-маппинг всех препаратов между собой для выявления синергий, взаимодействий и рисков.
4. Сформировать структуру данных так, чтобы блоки «Взаимодействия», «Синергии» и «Осторожности» можно было мгновенно выводить в отдельную вкладку интерфейса.

### 9.2. Обязательный шаблон карточки препарата (расширенный)
Для каждого препарата в ответе агента структура должна содержать все поля ниже. Заполнять строго на русском языке, клинически корректно.

Шаблон включает все поля, существующие в `SUPPORT_CATALOG_DATA` (`SupportCatalogEntry`), плюс дополнительные описательные секции для вкладки интерфейса.

```json
{
  "id": "Внутренний идентификатор (ключ в SUPPORT_CATALOG_DATA)",
  "Название": "МНН и коммерческие названия (Ru/En)",
  "Тир": "core | standard | advanced | specialty (классификация важности на курсе)",
  "Категории": ["Тире: antioxidant, hepatoprotector, cardioprotector, mineral, vitamin, amino, pharma, adaptogen, antiinflammatory, nootropic и др."],
  "Обязателен_на_курсе_ААС": true|false,
  "Формы_выпуска": [
    { "Название": "Форма 1", "Дозировка": "200 мг с едой", "Лучшая": true },
    { "Название": "Форма 2", "Дозировка": "10 мг", "Лучшая": false, "Примечание": "Менее биодоступен" }
  ],
  "Аналоги": ["id_альтернативы_1", "id_альтернативы_2"],
  "Полное_описание": "Развёрнутое фармакологическое описание: форма выпуска, назначение, показания, роль на курсе ААС (50-500 символов)",
  "Анатомо-функциональный_маппинг": {
    "Система_органов": ["ССС", "Эндокринная", "Печень", "Почки", "Нервная", "Иммунная", "ЖКТ", "Репродуктивная", "Опорно-двигательная", "Метаболизм", "Кровь"],
    "Целевой_орган": "Конкретный орган или ткань воздействия",
    "Механизмы_этого_органа": "Физиологический процесс органа, на который идёт влияние (регуляция тонуса, фильтрация, секреция, сокращение и т.д.)",
    "Механизм_действия_препарата": "Биохимический/молекулярный уровень (ингибирование фермента, активация рецепторов, модуляция каналов и т.д.)",
    "Механизмы_(коды)": ["Список кодов механизмов для маппинга: ELECTRON_TRANSPORT_CHAIN, ANTIOXIDANT, AMPK_ACTIVATION и др."],
    "Эффект_препарата": "Конечный клинический/терапевтический результат"
  },
  "Совместимость_и_комбинации": {
    "Синергии_структурированные": [
      { "с": "id_вещества", "эффект": "Описание эффекта", "механизм": "Краткий механизм", "сила": "LOW | MEDIUM | HIGH" }
    ],
    "Конфликты_структурированные": [
      { "с": "id_вещества_или_группы", "эффект": "Описание риска", "механизм": "Краткий механизм", "сила": "LOW | MEDIUM | HIGH" }
    ],
    "Синергии_текстом": "С какими веществами усиливает эффект и как именно (механизм, сила)",
    "Взаимодействия_текстом": "Как меняется фармакокинетика при комбинации с другими группами",
    "Особые_указания": "Правила приёма: еда, время суток, курсовой режим, возрастные ограничения, форма",
    "Осторожности_при_комбинациях": "Критические и нежелательные сочетания, противопоказания, риски побочных эффектов"
  },
  "Побочные_эффекты": ["Список возможных побочных эффектов"],
  "Противопоказания": ["Список абсолютных и относительных противопоказаний"],
  "Лабораторный_контроль": {
    "Контролируемые_анализы_структурированные": [
      { "что": "Название маркера", "когда": "Периодичность", "целевой_диапазон": "Референсные значения" }
    ],
    "Контролируемые_анализы": ["Список параметров крови/мочи для мониторинга"],
    "Периодичность_контроля": "Как часто сдавать анализы при приёме данного препарата",
    "Целевые_диапазоны": "Референсные значения для мониторинга"
  }
}
```

### 9.3. Логика для вкладки быстрого вывода (сводная матрица)
При запросе пользователя или при генерации вкладки интерфейса агент должен мгновенно выдавать:
- По препарату X → Список всех его синергистов с механизмами и силой связи.
- По препарату X → Предупреждения об опасных комбинациях.
- По органу Y → Все препараты, которые на него замапплены.

### 9.4. Пайплайн для новых позиций
При команде «Добавить новый препарат: [Название]»:
1. Собрать/извлечь по нему полную информацию (PubChem, DrugBank, PubMed, клин. руководства).
2. Полностью заполнить карточку по шаблону 9.2.
3. Обновить общий маппинг систем: проверить пересечения с существующими препаратами.
4. Пересчитать синергии/взаимодействия с уже существующими в `SUPPORT_CATALOG_DATA` + `ALL_INTERACTIONS`.
5. Добавить во все обязательные структуры:
   - `allIds`, `ALL_SUBSTANCES`, `SUPPORT_SUBSTANCE_MAP`, const L (name-mapping)
   - `SUPPORT_CATALOG_DATA`, `CATALOG_ENRICHMENT` (если нужно)
   - `ALL_INTERACTIONS` (не менее 2-3 пар на новое вещество)
   - При необходимости — `pharma-database.ts`, `drug-mapper.engine.ts`, `interaction-engine.ts`

### 9.5. Контроль качества
- Каждая карточка проверяется на клиническую непротиворечивость.
- Все ID препаратов проверяются на наличие во всех структурах маппинга (сквозной тест связности).
- После каждого изменения запускать `tsc --noEmit && vite build`.
- Недозаполненные или противоречивые карточки считаются критической ошибкой.
