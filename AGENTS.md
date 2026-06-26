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

## Session Summary (Jun 25 — Part 2)
### Done
- **A3 — SYNERGY_NETWORK**: +52 новых записей (грибы/адаптогены/лекарственные/аминокислоты/иммунитет/метилирование). Полный граф пар.
- **A2 — 25 стеков B-формат**: +10 новых (hair_skin_nails, detox_heavy_metals, sleep_recovery, libido_erectile, thyroid_support, nootropic_energy, anti_catabolic, blood_flow_NO, insulin_sensitivity, pancreas_liver). Итого 25 стеков с полным B-форматом.
- **C4 — Каталог**: SUPPORT_CATALOG_DATA + CATALOG_ENRICHMENT — все core-записи полностью укомплектованы.
- **B1 — Спецприём попап**: модалка (читмил/рефид/фастинг), localStorage, список + удаление.
- **B2 — Скользящие графики KBJU**: 4 инлайн-бара target vs actual с цветовой индикацией.
- **B3 — Предпочтения попап**: 5 чекбоксов (молочка/глютен/веган/обработка/сахар), chips, localStorage.
- **B4 — Профицит в адаптации**: слайдер +5..+25%, badge с дельтой ккал.
- **B5 — Диетические паузы GlassCard**: кнопки 1/2 нед, таймер, отмена, localStorage.
- **B6 — Создать рецепт попап**: модалка (название/ингредиенты/приготовление/КБЖУ), localStorage, список.
- **B7 — Exclusive-фильтр каталога**: кнопка ⭐, фильтр по `tier === 'max'`.
- **C1 — Единый accent TrainingScreen**: 9 мест `#3b82f6`/`#a855f7`/`#8b5cf6` → `#00e68a`.
- **C3 — Описания СРЦ**: 30 файлов циклов (18 cycle, 6 block, 6 embed) — русские описания 2-3 предложения.
- `tsc --noEmit` ✓, `vite build` ✓

### Осталось
- **A6** — SupportScreen редиректы: упростить goBack/goHome (дублирование `setSection('home')` и др., −5 строк)
- **A7** — Переименование support-stacks.ts

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

## 10. Правила создания стеков (обязательно)

### 10.1. Формат стека — РАСШИРЕННАЯ КАРТОЧКА (B-формат)
Каждый стек — это клинически обоснованная комбинация веществ с единой целью.  
Запрещено генерировать стеки алгоритмически. Каждый стек пишется вручную.

Стек ОБЯЗАТЕЛЬНО содержит следующие поля (полная карточка):

```typescript
export interface SupportStack {
  id: string;                       // snake_case, уникальный
  name: string;                     // Русское название (50-80 символов)
  problem: string;                  // Какая проблема решается (30-60 символов)
  system: string;                   // Какая система организма (10-30 символов)
  description: string;              // 100-200 символов, русский, клинически точный
  synergyPrinciple: string;         // Почему эти вещества работают вместе (50-100 символов)

  substances: Array<{
    id: string;                     // Ключ из SUPPORT_CATALOG_DATA
    dose: string;                   // Разовая дозировка (например "500 мг")
    timing: 'morning' | 'afternoon' | 'evening' | 'night' | 'fasting';
    mechanism: string;              // Механизм действия ИМЕННО В ЭТОМ СТЕКЕ (30-50 символов)
  }>;

  synergyScore: number;             // 0-100, субъективная оценка силы стека
  timingSummary: string;            // Сводка: что и когда принимать (50-150 символов)
  monitoring: string;               // Лабораторный контроль: маркеры + периодичность
  specialInstructions: string;      // Особые указания: еда, вода, интервалы
  contraindications: string;        // Противопоказания: когда НЕЛЬЗЯ
  warnings: string;                 // Возможные проблемы: с чем осторожно

  // ── РАСШИРЕННЫЕ ПОЛЯ (B-формат) ──
  anatomicalMapping: {
    organSystems: string[];          // Системы органов (например ['Гепатобилиарная', 'Метаболизм'])
    targetOrgans: string[];          // Конкретные органы-мишени (например ['Печень', 'Желчевыводящие пути'])
    organMechanisms: string;         // Физиологический процесс органа
    drugMechanisms: string[];        // Механизм КАЖДОГО вещества в стеке (1 строка на вещество)
    mechanismCodes: string[];        // Коды механизмов (например ['GLUTATHIONE_SYNTHESIS', 'NRF2_ACTIVATION'])
    finalEffect: string;             // Конечный клинический результат
  };
  structuredInteractions: {
    synergies: Array<{
      with: string;                  // id вещества или комбинации (например 'nac+tudca')
      effect: string;                // Кратко об эффекте
      mechanism: string;             // Механизм синергии
      strength: string;              // 'HIGH' | 'MEDIUM' | 'LOW'
    }>;
    conflicts: Array<{
      with: string;                  // С чем конфликт
      effect: string;                // Что происходит
      mechanism: string;             // Механизм конфликта
      strength: string;              // 'HIGH' | 'MEDIUM' | 'LOW'
    }>;
    specialInstructions: string;     // Доп. указания по приёму
    cautions: string;                // Осторожности
  };
  structuredLabControl: {
    markers: Array<{
      marker: string;                // Название маркера (например 'АЛТ')
      when: string;                  // Периодичность (например 'Каждые 4 нед')
      targetRange: string;           // Целевой диапазон (например '<40 Ед/л')
    }>;
  };
}
```

### 10.2. Требования к описаниям

**description** — общее описание стека:
- Начинается с проблемы: «Для ...»
- Указывает систему/орган-мишень
- Описывает ожидаемый клинический результат
- Пример: «Для профилактики тромбообразования на курсе ААС. Нормализует гемореологию, снижает вязкость крови, растворяет фибрин за счёт комбинации трёх протеолитических ферментов с разными механизмами действия.»

**synergyPrinciple** — принцип синергии:
- Объясняет, ПОЧЕМУ эти вещества вместе работают лучше, чем по отдельности
- Указывает разные механизмы или cascade effect
- Пример: «Серрапептаза расщепляет α2-макроглобулин и фибрин в плазме, наттокиназа активирует плазминоген напрямую, бромелайн подавляет PAI-1. Три разных пути фибринолиза — полный охват каскада.»

**substances[].mechanism** — механизм вещества В КОНТЕКСТЕ ЭТОГО СТЕКА:
- Не копировать общее описание из SUPPORT_CATALOG_DATA
- Показать, что именно это вещество даёт этому стеку
- Пример: «Прямой фибринолитик (активирует плазминоген → плазмин), снижает фактор фон Виллебранда» — а не «снижает холестерин»

**anatomicalMapping.drugMechanisms** — по 1 строке на КАЖДОЕ вещество:
- Формат: «id вещества — краткий механизм в контексте стека»
- Пример: «NAC — донатор SH-групп, восстанавливает глутатион, конъюгирует с токсичными метаболитами (фаза II)»

**structureInteractions.synergies** — минимум 3 пары на стек:
- `with` указывает на комбинацию (через `+`) или id другого вещества
- Заполнять ТОЛЬКО значимые взаимодействия в контексте стека

**structuredLabControl.markers** — минимум 5 маркеров:
- Только релевантные для данного стека
- targetRange указывать с единицами измерения

### 10.3. Категорический запрет
- Запрещено использовать `generateStacks()` или любую другую форму автогенерации стеков.
- Запрещено копировать описания из SUPPORT_CATALOG_DATA без привязки к контексту стека.
- Запрещено оставлять поля пустыми.
- Запрещено добавлять вещества, которых нет в SUPPORT_CATALOG_DATA.
- Запрещено пропускать `anatomicalMapping`, `structuredInteractions` или `structuredLabControl`.

### 10.4. Принцип формирования стеков

Стек строится вокруг **синергетического ядра** — 2-3 вещества, которые имеют доказанное клиническое взаимодействие. Дополнительные вещества расширяют охват, но не размывают цель.

Примеры синергетических ядер:
| Ядро | Принцип |
|------|---------|
| Серрапептаза + Наттокиназа | Фибринолиз через 2 разных механизма |
| Небиволол + Телмисартан | β1-блокада + ARB + NO-модуляция |
| ТМГ + 5-МТГФ | Метилирование: донор + активная форма |
| NAC + Глицин | Синтез глутатиона: лимитирующие субстраты |
| Куркумин + Пиперин | Биодоступность куркумина +2000% |
| D3 + K2 + Mg | Кальциевый треугольник |
| CoQ10 + PQQ + L-Карнитин | Митохондриальный биогенез |
| Zn + Mg + D3 + Бор | Эндогенный тестостерон: 4 точки |

### 10.5. Пример стека (эталон — B-формат)

```typescript
{
  id: 'hepatoprotection_stack',
  name: 'Гепатопротекция: глутатион + ER-стресс + мембраны',
  problem: 'Защита печени от токсического повреждения на курсе ААС и пероральных 17-алкилированных стероидов',
  system: 'Гепатобилиарная',
  description: 'Для защиты гепатоцитов от окислительного стресса, холестаза и фиброза. NAC даёт субстрат для синтеза глутатиона, TUDCA снижает ER-стресс и улучшает желчеотток, силимарин стабилизирует мембраны, АЛЬК регенерирует антиоксидантную сеть.',
  synergyPrinciple: 'Четыре независимых механизма гепатопротекции: субстрат для глутатиона (NAC), снижение ER-стресса и апоптоза (TUDCA), стабилизация мембран гепатоцитов (силимарин), регенерация антиоксидантной сети (АЛЬК). Полный охват путей токсического поражения печени.',
  substances: [
    { id: 'nac', dose: '1200 мг', timing: 'morning', mechanism: 'Предшественник глутатиона (GSH), повышает внутриклеточный пул GSH, связывает активные метаболиты токсинов через конъюгацию с глутатионом' },
    { id: 'tudca', dose: '500 мг', timing: 'evening', mechanism: 'Снижает ER-стресс через ингибицию CHOP/GADD153, улучшает митохондриальный мембранный потенциал, стимулирует BSEP-зависимый желчеотток' },
    { id: 'milk_thistle', dose: '280 мг', timing: 'morning', mechanism: 'Силимарин стабилизирует мембраны гепатоцитов, ингибирует перекисное окисление липидов, стимулирует РНК-полимеразу I для синтеза белка' },
    { id: 'alpha_lipoic', dose: '300 мг', timing: 'morning', mechanism: 'Активатор Nrf2/ARE, усиливает фазу II детоксикации (GST, NQO1), регенерирует окисленные формы витаминов C и E, хелатирует переходные металлы' },
  ],
  synergyScore: 95,
  timingSummary: 'Утро (с едой): NAC 600 мг + силимарин 280 мг + АЛЬК 300 мг. Вечер (за 2 ч до сна): NAC 600 мг + TUDCA 500 мг.',
  monitoring: 'АЛТ, АСТ, ГГТ, ЩФ, билирубин общий/прямой — каждые 4 нед. УЗИ печени — 1 раз в 3 мес.',
  specialInstructions: 'NAC и TUDCA натощак или за 1 ч до еды. Интервал NAC и антибиотики — 2 ч. АЛЬК не сочетать с цисплатином.',
  contraindications: 'ЖКБ с камнями >5 мм (TUDCA может растворять → закупорка протоков). Язва желудка в обострении.',
  warnings: '⚠ TUDCA может послабить стул первые 2 нед — старт 250 мг и титровать. ⚠ NAC >2400 мг/сут → риск головной боли и тошноты.',
  anatomicalMapping: {
    organSystems: ['Гепатобилиарная', 'Метаболизм', 'Кровь'],
    targetOrgans: ['Печень', 'Желчевыводящие пути'],
    organMechanisms: 'Детоксикация ксенобиотиков, синтез белков плазмы, метаболизм липидов, продукция и экскреция желчи',
    drugMechanisms: [
      'NAC — донатор SH-групп, восстанавливает глутатион, конъюгирует с токсичными метаболитами (фаза II)',
      'TUDCA — гидрофильная желчная кислота, снижает ER-стресс через ↓ CHOP, ↑ BSEP-экспрессию',
      'Силимарин — стабилизация мембран гепатоцитов, ↓ перекисного окисления, ↑ РНК-полимеразу I',
      'АЛЬК — активация Nrf2/ARE, ↑ ферменты фазы II, хелатация переходных металлов',
    ],
    mechanismCodes: ['GLUTATHIONE_SYNTHESIS', 'ER_STRESS_REDUCTION', 'MEMBRANE_STABILIZATION', 'NRF2_ACTIVATION', 'BILE_FLOW_STIMULATION'],
    finalEffect: 'Снижение цитолиза (АЛТ/АСТ ↓), улучшение желчеоттока, предотвращение фиброза и стеатоза гепатоцитов',
  },
  structuredInteractions: {
    synergies: [
      { with: 'nac+tudca', effect: 'Двойная защита: глутатион + анти-ER-стресс', mechanism: 'NAC ↑ GSH, TUDCA ↓ CHOP — разные механизмы, аддитивный эффект', strength: 'HIGH' },
      { with: 'tudca+milk_thistle', effect: 'Желчеотток + мембраны', mechanism: 'TUDCA ↑ BSEP, силимарин защищает мембраны — полный охват холестаза', strength: 'HIGH' },
      { with: 'nac+alpha_lipoic', effect: 'Глутатион + Nrf2', mechanism: 'NAC — субстрат GSH, АЛЬК — активатор Nrf2, ↑ ферментов фазы II', strength: 'HIGH' },
    ],
    conflicts: [
      { with: 'цитостатики', effect: 'АЛЬК может снижать эффективность цисплатина', mechanism: 'Хелатация Pt-соединений АЛЬК', strength: 'MEDIUM' },
    ],
    specialInstructions: 'NAC и TUDCA разделить приём — утро/вечер. АЛЬК с едой для ↓ раздражения ЖКТ.',
    cautions: 'TUDCA не применять при полной обструкции желчевыводящих путей. NAC с антибиотиками с интервалом ≥2 ч.',
  },
  structuredLabControl: {
    markers: [
      { marker: 'АЛТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
      { marker: 'АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
      { marker: 'ГГТ', when: 'Каждые 4 нед', targetRange: '<55 Ед/л' },
      { marker: 'Щелочная фосфатаза', when: 'Каждые 4 нед', targetRange: '<150 Ед/л' },
      { marker: 'Билирубин общий', when: 'Каждые 4 нед', targetRange: '<21 мкмоль/л' },
      { marker: 'Билирубин прямой', when: 'При ↑ общего', targetRange: '<5 мкмоль/л' },
    ],
  },
}
```

### 10.6. Контроль качества стеков
- Каждый стек проверяется на клиническую непротиворечивость.
- Все id веществ проверяются на наличие в SUPPORT_CATALOG_DATA.
- Все interaction-пары проверяются на наличие в ALL_INTERACTIONS или SYNERGY_NETWORK (при отсутствии — добавить).
- После каждого изменения запускать `tsc --noEmit && vite build`.
- Запрещено создавать стек с неполными расширенными полями (anatomicalMapping, structuredInteractions, structuredLabControl — обязательны).

### 10.7. ОБЯЗАТЕЛЬНОЕ ПРАВИЛО ЗАПОЛНЕНИЯ СТЕКА (для всех агентов)
При добавлении или редактировании ЛЮБОГО стека в `support-stacks-bformat.ts` агент ОБЯЗАН соблюдать **полный макет** (B-формат) без пропусков:

1. **Все 23+ поля** из `SupportStack` интерфейса должны быть заполнены. Ни одно поле не может быть пустым или пропущено.
2. **`description`** — только УСИЛЕНИЕ существующего. Запрещено сокращать или упрощать. Если стек уже имеет описание — агент может ДОБАВИТЬ детали, но НЕ УДАЛЯЕТ.
3. **`substances[].mechanism`** — для КАЖДОГО вещества описать его роль ИМЕННО В ЭТОМ СТЕКЕ (30-50 символов). Не копировать общее описание из SUPPORT_CATALOG_DATA.
4. **`anatomicalMapping`** — ВСЕ 6 полей заполнить (organSystems, targetOrgans, organMechanisms, drugMechanisms, mechanismCodes, finalEffect).
5. **`structuredInteractions`** — минимум 3 синергии (`synergies[]`) и 1 конфликт (`conflicts[]`). ВСЕ поля внутри каждой записи (with, effect, mechanism, strength) обязательны.
6. **`structuredLabControl`** — минимум 5 маркеров (`markers[]`). Каждый маркер: marker, when, targetRange — ВСЕ поля обязательны.
7. **Запрещено** использовать `as any`, оставлять `undefined`, использовать плейсхолдеры.
8. После заполнения — `tsc --noEmit && vite build`.

Нарушение любого из пунктов 10.7 считается **критической ошибкой**. Стек с неполными полями не принимается.

## Session Summary (Jun 25) — BioStack AI + B-format стеки
### Done
- **BioStack AI Periodization**: AI-подсказки фазовых переходов (селекторы От→К, AI-анализ с keep/add/remove), матрица покрытия всех веществ по фазам (table). 
- **BioStack AI Reports**: метрики совместимости (compatScore 0-100), synergy density, tier distribution, bar progress bar в UI, добавлено в текстовые отчёты (standard + doctor).
- **AGENTS.md — секция 10 полностью переписана**: интерфейс `SupportStack` расширен до B-формата (anatomicalMapping, structuredInteractions, structuredLabControl — все обязательны), эталон стека заменён на гепатопротекцию с полным B-форматом, добавлены правила для `drugMechanisms`, `synergies` (мин 3 пары), `markers` (мин 5), запрет на пропуск расширенных полей.
- **support-synergy-stacks.ts — 15 стеков в B-формате**: 5 переписаны (hepatoprotection, cardioprotection, nephroprotection, neuroprotection, adaptogenic) + 10 новых (fibrinolytic, articular, immune, hormonal/pct, mitochondrial, nootropic, anti-stress, bone, gi_microbiome, antioxidant_network). Каждый стек: id, name, problem, system, description, synergyPrinciple, substances (per-substance mechanism), synergyScore, timingSummary, monitoring, specialInstructions, contraindications, warnings, anatomicalMapping (organSystems, targetOrgans, organMechanisms, drugMechanisms, mechanismCodes, finalEffect), structuredInteractions (synergies ≥3, conflicts, specialInstructions, cautions), structuredLabControl (markers ≥5).
- **SupportStack interface**: обновлён — обязательные поля `anatomicalMapping`, `structuredInteractions`, `structuredLabControl` (теперь требуются для всех стеков).
- `tsc --noEmit` ✓, `vite build` ✓ (1262 строки, <1500 limit)

## Session Summary (Jun 25) — BioStack AI (начало)
### Done
- **BioStack AI план**: 7 подвкладок в SupportScreen (Поиск, Сборка, Мой стек, Риски, Сравнение, Отчёты, AI).
- **BioStackAIEngine.ts**: расширенный FinderProfile (39 параметров) + BioStackProfile с новыми полями (когнитив, чувствительность, давление, ЖКТ, хронотип, питание, кофеин, алкоголь, антидепрессанты, сложность стека).
- **BioStackAIScreen.tsx**: 7-табовый компонент в стиле IndividualPlan (GlassCard, PillBtn, inputStyle). Профиль — 6 групп с автозаполнением из `getProfile()`.
- **Интеграция в SupportScreen**: `InfoView` расширен (`'biostack'`), кнопка в навигации, `renderView` для BioStack AI.

### Next Steps
- Подвкладка 🔍 Поиск — расширить поиск по системам (SYSTEM_LABELS_CATALOG) + симптомы
- Подвкладка 🧩 Сборка стека — auto stack generator с полным алгоритмом
- Подвкладка 📋 Мой стек — active stack viewer
- Подвкладка ⚠ Риски — три уровня взаимодействий
- Подвкладка ⚖ Сравнение — метрики безопасности/эффективности/стоимости
- Подвкладка 📊 Отчёты — генерация + архив в localStorage
- Подвкладка 🔍 Поиск — ПОЛНОСТЬЮ РЕАЛИЗОВАНА: текстовый поиск + фильтры по целям (22), органам (24), системам (11), механизмам (15 top), симптомам (10) + rich карточки с раскрытием, скорингом, категориями, противопоказаниями; кнопка + Стек; персонализация через BioStackProfile→FinderProfile bridge
- Подвкладка 🧠 AI — 5 кнопок-действий на правилах

## Session Summary (Jun 26) — Plan restructured
### Done
- **C2** — PL/BB переключатель в SRCBBScreen.tsx: проверен, dropdown работает, баг закрыт
- **A1** — `generateStacks()` удалён из codebase (grep 0 matches)
- **Plan restructured**: устаревшие ID удалены, добавлены 13 новых задач по питанию (N1-N4), базам (S5-S8), бадам UI (S9-S10/S12), тренировкам (P13)
- `tsc --noEmit` ✅, `vite build` ✅

## Session Summary (Jun 26 — Part 2) — P13 + N5-N8 + B10
### Done
- **P13 — SRCBBScreen: 3 подвкладки (PL/BB/Ручной)**: `mode` (src|bb) → `mainTab` (pl|bb|manual), PL-подвкладки (plan/plates/run/autoreg/peak/recovery/safety/demo), BB-подвкладки (plan/methods/analytics/prometrics/charts), новая вкладка "Ручной сбор" — форма с datalist из EXERCISE_CATALOG, сохранение/удаление в localStorage. Удалён дублирующийся `[view, setView]` и `autoRegResult`.
- **N5 — histamineSensitive тоггл**: добавлен в v2-профиль (IndividualPlanSettings)
- **N6 — DIAAS badge**: добавлен на карточки приёма в планировщике (renderMealList)
- **N7 — specific_compounds_100g**: формула инициализации улучшена, добавлено 6 переопределений (гречка, рис, курица, говядина, яйца, творог)
- **N8 — compareProductsV2 factors**: факторы влияния на полезность (уровень обработки, гликемия, атмогенный потенциал) выведены в UI сравнения
- **B10 — Фарма-карточка расширение**: подтверждено что targetSystems/cvProfile/linkedRisks/linkedSubstances уже реализованы в DrugDetailCard

### Осталось
- N1, N2, N3, N4 — Питание: генерация + кнопки + здоровье
- C4, B8, A3, S5, S6, S7, S8, S11 — Базы данных
- S9, S10, S12, B1-B7, C1, C3, A6, A7 — UI/UX + рефакторинг
- `tsc --noEmit` ✅, `vite build` ✅

## 11. PharmaSubstance — обязательные поля карточки фармакологии

При добавлении ЛЮБОГО нового вещества в `pharma-database.ts` (или редактировании существующего) **ОБЯЗАТЕЛЬНО** заполнить все поля ниже. Карточка выводится в `DrugDetailCard` (PharmaScreen.tsx) — пропуск любого поля приводит к пустому месту в UI и считается критической ошибкой.

### 11.1. Обязательный шаблон PharmaSubstance

```typescript
// Поля, которые БЫЛИ ВСЕГДА (уже обязательны):
id: string;           // уникальный snake_case
name: string;         // русское название
class: string;        // ключ из CLASS_LABELS
pk: PK;               // фармакокинетика (ka, k10, k12, k21, Vd, bioavailability, halfLifeHours)
pd: PD;               // фармакодинамика (AR_affinity, aromatization, five_alpha_reduction, progestogenic, hepatotoxicity, lipid_impact, hct_impact, neuro_toxicity)
ec50: number;
n_hill: number;
maxEffect: number;

// НОВЫЕ ОБЯЗАТЕЛЬНЫЕ ПОЛЯ:
targetSystems: string[];           // Какие системы организма затрагивает
                                   // Допустимые значения: 'cardio','hepatic','neuro','neuro_toxicity','endocrine','reproductive','hematologic','musculoskeletal','prostate','skin','ghigf','metabolic','ins_axis','immunity','renal','vessels','blood','thyroid'
                                   // Минимум 1, обычно 3-7 систем

targetMechanisms: string[];        // Коды механизмов действия
                                   // Допустимые значения: 'AR_AGONISM','mTOR_UP','PROTEIN_SYNTHESIS','ERYTHROPOIESIS','PR_AGONISM','GR_ANTAGONISM','DOPAMINE_MODULATION','COLLAGEN_SYNTHESIS',
                                   // 'CYP3A4_METABOLISM','GLYCOGEN_SYNTHESIS','AR_SELECTIVE_AGONISM','GHSR_AGONISM','GH_RELEASE','IGF1_UP','IGF1_AGONISM','MGF_AGONISM',
                                   // 'SATELLITE_CELL_ACTIVATION','INSULIN_AGONISM','GLUCOSE_UPTAKE','ER_ANTAGONISM','GNRH_UP','LH_UP','FSH_UP','AROMATASE_INHIBITION',
                                   // 'E2_SUPPRESSION','D2_AGONISM','PROLACTIN_SUPPRESSION','ARB_AGONISM','PPARG_UP','B1_BLOCKADE','NO_UP','GLUTATHIONE_UP','ANTIOXIDANT',
                                   // 'BILE_ACID_MOD','ANTIAPOPTOTIC','EPA_DHA_UP','ANTIINFLAMMATORY','NMDA_BLOCK','GABA_MOD','AMPK_UP','COX_INHIBITION',
                                   // 'PLATELET_AGGREGATION_INHIBITION','TISSUE_REPAIR','IMMUNE_MODULATION','NEUROPEPTIDE_MOD','LIPOLYSIS_ACTIVATION','HSL_STIMULATION',
                                   // 'SHBG_BINDING','5AR_INHIBITION','DHT_BLOCKADE','ANTIANDROGEN','VDR_AGONISM','CALCIUM_ABSORPTION','GLA_PROTEIN_ACTIVATION',
                                   // 'CALCIUM_REGULATION','ZINC_COFACTOR','SHBG_REGULATION','TESTOSTERONE_UP','SELENOPROTEIN_SYNTHESIS','THYROID_HORMONE_METABOLISM',
                                   // 'NEUROTRANSMITTER_SYNTHESIS','DOPAMINE_PRECURSOR','PROLACTIN_REGULATION','METHYLATION_CYCLE','MYELIN_SYNTHESIS','HOMOCYSTEINE_REGULATION',
                                   // 'DNA_SYNTHESIS','MITOCHONDRIAL_ENERGY','COENZYME_ELECTRON_TRANSPORT','INSULIN_SENSITIVITY','LIVER_REGENERATION','CYP450_MODULATION',
                                   // 'NFKB_INHIBITION','MEMBRANE_PHOSPHOLIPID','LIVER_LIPID_METABOLISM','CHOLINE_DONOR','CORTISOL_REGULATION','THYROID_STIMULATION',
                                   // 'FULVIC_ACID','ADAPTOGEN','GUT_FLORA_MODULATION','SHORT_CHAIN_FATTY_ACIDS','OSMOREGULATION','GLP1_AGONISM','GIP_AGONISM'
                                   // Минимум 1, обычно 2-4 механизма

linkedRisks: Array<{               // Связанные риски: на какие системы и как влияет
  system: string;                   // Ключ системы (те же, что в targetSystems)
  direction: 'up' | 'down' | 'both'; // up = риск растёт, down = риск снижается
  strength: number;                 // Сила влияния 0.0–1.0
}>;                                 // Минимум 1, обычно 2-4 риска

linkedSubstances: Array<{          // Связанные вещества (синергии/антагонизмы с другими препаратами)
  id: string;                       // id из PHARMA_DB
  type: 'synergy' | 'anti_synergy'; // synergy = усиливают друг друга, anti_synergy = конфликтуют
  mechanism: string;                // Краткое описание мех-ма (20-60 символов)
  strength: number;                 // Сила 0.0–1.0
}>;                                 // Минимум 1, желательно 2+

cvProfile: {                       // Сердечно-сосудистый профиль
  bloodPressure: 'up' | 'down' | 'neutral';
  heartRate: 'up' | 'down' | 'neutral';
  vascularTone: 'constrict' | 'dilate' | 'neutral';
  thrombosisRisk: 'low' | 'medium' | 'high';
  cnsLoad: 'low' | 'medium' | 'high';
};                                 // Обязательно ВСЕ 5 полей
```

### 11.2. Пример полностью заполненной карточки

```typescript
test_enan: {
  id:'test_enan', name:'Тестостерон энантат', class:'testosterone',
  esters:['enanthate'],
  pk:{ka:0.024,k10:0.05,k12:0.02,k21:0.015,Vd:35,bioavailability:1,halfLifeHours:336},
  pd:{AR_affinity:1,aromatization:1,five_alpha_reduction:0.5,progestogenic:0,hepatotoxicity:0,lipid_impact:-0.3,hct_impact:4,neuro_toxicity:0.1},
  ec50:400,n_hill:2.5,maxEffect:1,
  // ↓↓↓ ОБЯЗАТЕЛЬНЫЕ ПОЛЯ ↓↓↓
  targetSystems:['cardio','endocrine','reproductive','hematologic','musculoskeletal','prostate','skin'],
  targetMechanisms:['AR_AGONISM','mTOR_UP','PROTEIN_SYNTHESIS','ERYTHROPOIESIS'],
  linkedRisks:[
    {system:'cardio',direction:'up',strength:0.4},
    {system:'hematologic',direction:'up',strength:0.6},
    {system:'reproductive',direction:'down',strength:0.8},
    {system:'endocrine',direction:'down',strength:0.7}
  ],
  linkedSubstances:[
    {id:'anastro',type:'synergy',mechanism:'Контроль эстрадиола, снижение риска гинекомастии',strength:0.7},
    {id:'tamox',type:'synergy',mechanism:'Синергия для HPTA восстановления в PCT',strength:0.5}
  ],
  cvProfile:{bloodPressure:'up',heartRate:'neutral',vascularTone:'neutral',thrombosisRisk:'high',cnsLoad:'low'}
}
```

### 11.3. Что отображается в DrugDetailCard

| Блок | Источник | Цвет чипсов |
|------|----------|-------------|
| Системы-мишени | `sub.targetSystems` | indigo `#818cf8` |
| СС-профиль | `sub.cvProfile` | динамический: опасный красный, защитный зелёный/синий |
| Связанные риски | `sub.linkedRisks` | зелёный `#4caf50` (снижение риска) / красный `#f44336` (повышение) |
| Связанные вещества | `sub.linkedSubstances` | зелёный `#00e68a` (⊕ синергия) / красный `#ff1744` (⊖ антагонизм) |

### 11.4. Контроль качества
- Каждый новый препарат проверяется на наличие ВСЕХ 4 блоков чипсов (targetSystems, cvProfile, linkedRisks, linkedSubstances)
- linkedSubstances — минимум 1 запись (если нет известных — указать id='none' с type='synergy' и mechanism='Нет данных')
- cvProfile — ВСЕ 5 полей обязательны, ни одно не может быть пропущено
- После добавления запустить `tsc --noEmit && vite build`

**Нарушение = критическая ошибка.** Препарат с пропущенными targetSystems, cvProfile, linkedRisks или linkedSubstances не принимается.

## 12. Структура каталога продуктов питания (AdvancedProductCard) — ОБЯЗАТЕЛЬНО

При добавлении любого продукта в каталог питания (`nutrition-db.ts`, `product-usefulness.ts` и т.д.) **каждый продукт ОБЯЗАН** строго соответствовать интерфейсу:

```typescript
interface AdvancedProductCard {
  id: string;                         // уникальный идентификатор
  name: string;                       // название на русском
  category: string;                   // "Крупы" | "Мясо" | "Рыба" | "Овощи" | "Зелень" | "Молочные продукты" | "Спортивное питание" | "Жиры" | "Фрукты" | "Субпродукты"
  macro_100g: {
    calories: number;                 // ккал
    proteins_total: number;           // общий белок, г
    proteins_animal: number;          // животный белок, г
    proteins_plant: number;           // растительный белок, г
    fats_total: number;               // общие жиры, г
    fats_saturated: number;           // насыщенные жиры, г
    omega_3_mg: number;               // Омега-3, мг
    omega_6_mg: number;               // Омега-6, мг
    cholesterol_mg: number;           // холестерин, мг
    carbs_total: number;              // общие углеводы, г
    carbs_fiber: number;              // клетчатка, г
    glycemic_index: number;           // гликемический индекс (0–100)
    insulin_index: number;            // инсулиновый индекс (0–150)
  };
  amino_acid_profile_100g: {
    leucine_mg: number;               // лейцин (триггер mTOR)
    isoleucine_mg: number;
    valine_mg: number;
    lysine_mg: number;
    methionine_mg: number;
    arginine_mg: number;              // донатор NO, пампинг
    glutamine_mg: number;             // поддержка ЖКТ
  };
  electrolytes_100g: {
    sodium_mg: number;                // натрий
    potassium_mg: number;             // калий
    magnesium_mg: number;             // магний
    pral_index: number;               // кислотная нагрузка
  };
  gastro_tags: {
    fodmap_group: 'HIGH' | 'LOW';     // риск брожения / вздутия
    enzyme_demand_score: number;      // нагрузка на ферменты поджелудочной (1–10)
    gastric_emptying_speed: 'FAST' | 'MEDIUM' | 'SLOW';
  };
  metabolic_flags: {
    atherogenic_potential: 'HIGH' | 'LOW';
    glycation_potential: 'HIGH' | 'LOW';
    ammonia_source_level: 'HIGH' | 'MEDIUM' | 'LOW';
    heavy_metal_risk: 'HIGH' | 'LOW';
    cns_impact: 'STIMULANT' | 'SEDATIVE' | 'NEUTRAL';
  };
}
```

**Запрещено:**
- Добавлять продукт с пропущенными полями
- Использовать `as any` для обхода типизации
- Копировать существующий продукт без проверки всех полей
- Оставлять `0` или `null` в обязательных числовых полях без реальных данных
