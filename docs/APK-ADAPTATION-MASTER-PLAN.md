# APK-ADAPTATION-MASTER-PLAN.md — полный план доработки приложения под Android APK

**Дата:** 27 сентября 2026
**Статус:** план составлен по результатам полного исследования; кода в этом документе нет
**HEAD на момент исследования:** `1f1dfc24b` → к финальной сверке `1f5dfc24b` (параллельные коммиты в риск/метаболизм)

> Ссылки `file:line` даны по HEAD исследования. Перед правкой **перепроверять** строки: дерево двигалось параллельными агентами. Приоритет — за самим дефектом, не за номером строки.

---

## 0. Как читать этот документ

### 0.1 Метод исследования

Исследование выполнено **10 параллельными агентами** по зонам + собственная верификация ключевых утверждений + baseline-прогоны.

| # | Зона агента | Объём |
|---|---|---|
| A1 | Training (TrainingScreen_parts + combat + strength-sport) | 436 файлов |
| A2 | Nutrition (NutritionScreen_parts + PopupXxx) | 217 файлов |
| A3 | Profile + Support + Articles + Shop + SupplementClinic | ~180 файлов |
| A4 | Calculator + Risk + Labs + Pharma + Plan + Shared | 66 файлов |
| A5 | Нативный слой: native-bridge, android/, CI, workflows, widgets, updater | 62 ресурса |
| A6 | CSS / design system / a11y / mobile fit (7 CSS-файлов) | 776 КБ |
| A7 | engines + data + core | ~2000 файлов |
| A8 | Глобальное здоровье: тесты, типы, бандл, App.tsx, core-security, гигиена | 1282 тест-файла |
| A9 | combat + strength-sport (повторная, глубокая) | 40 файлов |
| A10 | Остальные хабы: Dashboard, Articles, Shop, Intelligence, Quality, ExerciseLab, периодзация, shared kit, engines/pro | — |

### 0.2 Baseline (прогнано лично, 27.09.2026)

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` | **0 ошибок** (EXIT=0) |
| `npm run verify:apk-design` | **OK** |
| `npx vitest run` (выборка apk/native) | **35/35 passed** |
| `git status` | чужие WIP-файлы (не трогать; на 27.09 — 9, список плавает) |

**Вывод:** проект компилируется и проходит собственный гейт. Все находки ниже — это то, что гейт **не проверяет**.

### 0.3 Легенда достоверности

- **ПОДТВЕРЖДЕНО** — лично прочитано/замерено в этом сеансе (указано `✓ верифицировано`).
- **ПОДТВЕРЖДЕНО агентом** — прочитано агентом, указана ссылка `file:line`.
- **ТРЕБУЕТ ПРОВЕРКИ** — структурно доказуемо, но нужен прогон/визуал.

---

## 1. Сводка: 10 системных дефектов, из-за которых всё остальное

Прежде чем чинить 200+ точечных находок, нужно понять **10 корневых причин**. Каждый блок ниже чинит один корень, а не симптом.

| # | Корень | Где живёт | Следствие | Блок |
|---|---|---|---|---|
| R1 | **`backdrop-filter` создаёт containing block для `position: fixed`** | `CombatUI.tsx:45-46` (`CARD.backdropFilter`), `StrengthUI.tsx:45-46` | Все 46 «яблочных» шитов в 2 конструкторах позиционируются от карточки, а не от экрана | **B3** |
| R2 | **Нет центральной 44px-защиты; последнее правило её actively снижает** | `styles.css:2128`(40px) → `:2504`(36px) → `:3204`(38px) | Любой `<button>` без класса на телефоне ≤480px = **38×38** | **B5** |
| R3 | **APK-слой — нашлёпка, а не дизайн-система** | 95% UI = инлайн-стили; APK-правила латают точечно | 12 788 строк CSS × 5 580 `!important` × 204 дубля селекторов; зоны без покрытия | **B8** |
| R4 | **`a.download` / `window.open().print()` / `createObjectURL` в WebView не работают** — но ~60 мест их используют | см. §B2 | Экспорт/печать **молча ничего не делает** или **вращает «успех»** | **B2** |
| R5 | **Нативные контролы не запрещены на уровне сборки** — есть киты, но нет гейта | `PopupXxx.tsx`, `AdSheetSelect`, `AdSwitch` есть; 14 `<select>`, 8 checkbox, 3 date остались | Смешанный UI: часть красивая, часть — системный серый диалог | **B1** |
| R6 | **Один `backButton`-подписчик без стека модалок** | `App.tsx:250-271` (единственный вызов `setupNativeBackButton`) | «Назад» в 27 диалогах либо выкидывает на главную, либо сворачивает приложение | **B4** |
| R7 | **Токены дизайн-системы объявлены и почти не используются** | `styles-native.css:3484-3502`; 266 литеральных `scale()`, 394 литеральных `font-size`, 171 `outline` | Невозможно применить правило централизованно | **B8** |
| R8 | **Полный `localStorage`-дамп на каждое нажатие клавиши** | `BBDiagnosticsHub.tsx:401`, `WLDiagnosticsHub.tsx:299`, `ArmDiagnosticsHub.tsx:315`, `StrongmanDiagnosticsHub.tsx:474` | Тормоза на телефоне + весь блоб улетает в облако | **B10** |
| R9 | **Все 10 экранов импортируются статически** | `App.tsx:2-13` | **25 МБ** initial JS (entry 9,8 МБ + 14 preload); APK грузит всё, даже если открыли только «Лабораторию» | **B10** |
| R10 | **Гейт проверяет 3 файла из 7 и 1 класс из всех** | `check-apk-markers.mjs:50,72,175` | `verify:apk-design` зелёный при 100+ нарушениях | **B0** |

---

## 2. Приоритеты

| Приоритет | Значение | Блоки |
|---|---|---|
| **P0** | Пользователь не может выполнить действие / данные теряются / безопасность | B0, B1, B2, B3, B4, B11, B12 |
| **P1** | Работает, но неудобно/медленно/неочевидно | B5, B6, B7, B8, B9, B10, B13, B17, B18 |
| **P2** | Гигиена, дубли, документация, тестовое покрытие | B14, B15, B16, B19, B20 |

---

# БЛОК B0 — Сначала починить гейт, иначе всё остальное не проверить

**Приоритет P0 · Оценка 1–2 дня**

Пока гейт зелёный при сотнях нарушений, любая правка не защищена от регрессии.

## B0.1 Расширить `verify:apk-design`

`scripts/check-apk-markers.mjs` сейчас:
- проверяет скоуп `html.app-native` только в 3 из 7 нативных файлов (`:50`) — support/arm/strongman не проверяются;
- ищет hex-литералы только в `styles-native.css` и только 2 литерала (`:72`) — 125 других hex + `pro:54` проходят;
- фиксирует 44px только для `.cb-chip` (`:175`).

**Добавить проверки:**

| # | Проверка | Файл/паттерн |
|---|---|---|
| 1 | Все 7 `styles-native*.css` под `html.app-native` | `:50` расширить на список из 7 |
| 2 | **0 hex-литералов** в любом `html.app-native` блоке (все 7 файлов) | `:72` — полный список допустимых var() |
| 3 | **0 `font-size: < 9px`** во всех `styles-native*.css` (правило дома AGENTS.md) | regex |
| 4 | **0 `min-height: < 44px`** на интерактивных селекторах (button/role=button/.chip/.tab-btn/input[type=range]) | белый список исключений с обоснованием |
| 5 | **0 `input[type=checkbox]` / `<select>`** в APK-достижимых TSX (список файлов) | новый скан |
| 6 | **0 `input[type=range]` с `min-height: < 44px`** | `:10737`, `strongman:393` |
| 7 | Каждая `data-*` хук-семейство из прод-TSX имеет ≥1 правило в нативном CSS | список семейств |
| 8 | Каждая фикстура-зона (`.train-*`, `.nut-*`, `.risk-*`, …) имеет правило с `padding-bottom: var(--tabbar-clear)` либо `env(safe-area-inset-bottom)` | regex по корням |
| 9 | **0 символов U+FFFD** в `src/` и `scripts/` — сейчас 9 файлов (см. B20 п.9); ловится тривиальным байт-сканом | новый скан |

## B0.2 Добавить гейты в CI

`.github/workflows/ci.yml` и `android-apk.yml` **не вызывают ни `verify:apk-design`, ни `verify:apk-ci`** (✓ верифицировано агентом A5, `:16-48` / `:18-88`).

**Добавить в оба workflow перед build:**
```yaml
- run: npm run verify:apk-design
- run: npm run verify:apk-ci
```

**Починить латентный баг CI** — `ci.yml:36-42`:
```bash
[ "${SIZE%%M}" -gt 15 ]
```
Это целочисленное сравнение на выводе `du -sh`. Любой нецелый результат (`9.5M`, `1.2G`) → bash `integer expression expected` → non-zero → при `bash -e` **падает весь job**. Заменить на `numfmt`/`awk` или на `stat -c%s`.

**Добавить в `ci.yml` запуск тестов** — сейчас там нет ни одного юнит-теста (только type-check + build). Как минимум: `npx vitest run src/ui/__tests__ src/core/__tests__`.

## B0.3 Версионирование — блокер публикации

`android/app/build.gradle:10-11` (✓ верифицировано):
```gradle
versionCode 2
versionName "3.0.0"
```
**Ни один workflow не поднимает `versionCode`.** Play/RuStore отклонят второй релиз с тем же `versionCode`.

Каскад: апдейтер сравнивает тег с `App.getInfo().version` (всегда `3.0.0`) → **одно и то же обновление предлагается бесконечно**, а установленная сборка никогда не «новее».

**Фикс:** в `android-apk.yml` перед сборкой — `versionCode = base + 1000*run_number` (или `+1` от последнего тега), `versionName` из тега.

## B0.4 Убрать мёртвые права в манифесте

`android/app/src/main/AndroidManifest.xml` (агент A5):
- `:129` `USE_BIOMETRIC` — биометрия реализована через **WebAuthn platform authenticator** (`native-bridge.ts:710-719`), которая не использует разрешение приложения. Мёртвое + Play классифицирует как sensitive (нужна декларация).
- `:126-127` `SCHEDULE_EXACT_ALARM` — комментарий утверждает «объявлено плагином», но строка **есть**; при этом отдых-таймер — чистый JS + `SharedPreferences` (`WidgetStore.java:100-117`), `AlarmManager` не используется. Разрешение не выдаётся с Android 13 для некалендарных приложений.
- `REQUEST_INSTALL_PACKAGES` (`:130-133`) — оставить, но оформить декларацию в Play (нужна для самообновления).

## B0.5 Починить backup-правила (противоречие с комментарием)

`allowBackup="true"` (`AndroidManifest.xml:5`) + `backup_rules.xml:2-9` / `data_extraction_rules.xml:5-16` **исключают `app_webview/`** — это ровно там, где Capacitor хранит `localStorage`, т.е. **все** данные приложения. Комментарий в манифесте утверждает обратное.

**Итог:** нет ни облачного бэкапа, ни переноса профиля при смене устройства — молча против заявленного.

**Фикс:** исключить только реально чувствительное (`he_crypto_key`, фото), остальное разрешить.

---

# БЛОК B1 — Нативные примитивы ввода (фундамент)

**Приоритет P0 · 4–7 дней**

Пока в APK остаются системные `<select>`/`<input type=checkbox>`/`<input type=date>`, все последующие блоки (тач, типографика, safe-area) будут латать симптомы.

## B1.1 Инвентаризация (сводная)

| Тип | Кол-во в APK-достижимом UI | Где (примеры) | Замена существует? |
|---|---|---|---|
| `<select>` | **~30** | `ArmAutoConstructor.tsx:2026`, `ManualLibraryGallery.tsx:342`, `StrengthSportConstructor.tsx:1065`, `CombatConstructor.tsx:914` (нативных нет — все через попапы), `DeloadSchedulerTab.tsx:184`, `BulkApplyCard.tsx:193,205`, `arm-annotations-panel.tsx:73`, `NutritionCustomFood.tsx:148`, `RecipesTabModern.tsx:231`, `InjectionDiary.tsx` (**12**), `SupportBioavailability.tsx:387,393` (`fontSize:8`!), `PKPDSimulationTab`/`InteractionCheckerTab.tsx:246`, `CalcPEDCard.tsx:219`, `PharmaCourseScreen.tsx` (3), `PlanTraining.tsx:90-121` (3), `PlanScreen.tsx` (2), `SupportInteractionsView.tsx:185,191` | **Да** — `AdSheetSelect`, `PopupSelect`, `CombatPopupSelect`, `StrengthPopupSelect`, `EditorPopupSelect` |
| `<input type="checkbox">` | **~14** | `StrengthSportConstructor.tsx:872,875,932,1029,1058`, `ArmAutoConstructor.tsx:1916` (AdSwitch **уже импортирован в этом же файле!**), `ProgramEditorComponents.tsx:1377,2110,2384`, `CalcPhaseLabCards.tsx:112`, `DiagnosticsTab.tsx:198`, `ProfileSettingsTab`, дневники (5) | **Частично** — `AdSwitch`, `BbRowSwitch`, `CbSwitch` есть. **В `strength-sport/` switch-компонента НЕТ — надо построить** |
| `<input type="date">` | **~11** | `StrengthSportConstructor.tsx:844`, `CombatConstructor.tsx:907,914`, `combat-annual-card.tsx:168`, `IndividualPlanSettings.tsx:2618`, `PeakWeekTab.tsx:125`, `NutritionScreen.tsx:1085`, `LabsScreen.tsx:2384`, `PharmaCourseScreen.tsx`, `Calc.lab.tsx:48` | **НЕТ** — в `PopupXxx.tsx` только `PopupBool/PopupNumber/PopupSelect/PopupText`. **Надо построить `PopupDate`** |
| `<input type="time">` | **4** | `IndividualPlanSettings.tsx:876` (`fontSize:10`), `:1074,1075`, `MealListRender.tsx:54` | **НЕТ** — надо `PopupTime` |
| `<input type="range">` | **~55** | `PlanScreen.tsx` ×14, `PlanReadiness.tsx` ×6, combat ×13, strength ×9, V7RiskDisplay ×4, `PopupXxx.tsx:107` | Попап-число есть, сам слайдер — нормировать |

## B1.2 Построить недостающие примитивы

**`src/ui/components/PopupXxx.tsx` — добавить:**
1. `PopupDate` — нижний лист с календарём (месяц/сетка/«Сегодня»/«Очистить»), 48px ячейки, `role="dialog"`, `aria-modal`, Esc/закрытие по фону, **обязательно** через `createPortal(document.body)`.
2. `PopupTime` — часы/минуты (крупный текст, 44px +/- ), Snap к 5/15 мин.
3. `PopupDateRange` — если найдутся двухточечные выборы (в `LabsScreen`/`PharmaCourseScreen`).

**`src/ui/screens/strength-sport/StrengthUI.tsx` — добавить `StrengthSwitch`:**
по образцу `CombatUI.tsx:396 CbSwitch` (роль `switch`, трек 52×32, `aria-checked`, `data-on`, haptic через `native-bridge`).

**Единый контракт для всех попапов (зафиксировать в ките):**
- рендер **только** через `createPortal(document.body)` — см. B3, почему это обязательно;
- `role="dialog"` + `aria-modal="true"` + `aria-label`;
- закрытие: Esc, тап по фону, кнопка «Готово», **и аппаратная «Назад»** — см. B4;
- `paddingBottom: max(24px, env(safe-area-inset-bottom), var(--tabbar-lift, 0px))`;
- опции ≥48px, haptic при выборе;
- **в `html.app-native` — 16px на вводах, 44px на интерактивных.**

## B1.3 Перевести оставшиеся места

Порядок: сначала те, где замена **уже импортирована в этом же файле** (нулевые риски, максимальный эффект):
`ArmAutoConstructor.tsx:1916` → `AdSwitch`; `ArmAutoConstructor.tsx:2026` → `AdSheetSelect`; `StrengthSportConstructor.tsx:1065` → `StrengthPopupSelect`; `ManualLibraryGallery.tsx:342` → `EditorPopupSelect`; `BulkApplyCard.tsx:193,205` → `EditorPopupSelect`; `ProgramEditorComponents.tsx:1377,2110,2384` → `BbRowSwitch`; `CombatConstructor.tsx:914` → `CombatPopupSelect`.

Затем зоны по убыванию объёма: InjectionDiary (12), PlanScreen/PlanTraining (5), Support (6), Labs (3), Nutrition (2), Nutrition date/time (7), combat/strength date (4).

## B1.4 Запретить возврат регрессии

- Новый source-guard тест: **0** `<select` / `type="checkbox"` / `type="date"` / `type="time"` в списке APK-достижимых файлов (список ведётся в тесте).
- Проверка, что `AdCheck` (`arm-design-system.tsx:211-226`) **удалён** — он экспортируется, содержит нативный checkbox и **не имеет ни одной ссылки** (агент A1; гард-тест `arm-switch-sheet` проверяет конструктор, а не кит — поэтому это и проскочило).

---

# БЛОК B2 — Экспорт / печать / «поделиться»: слой доставки в APK

**Приоритет P0 · 3–5 дней · ~60 мест**

**Корень (R4).** Проект сам задокументировал в `src/core/apk-share.ts:4-15`, что `<a download>` и `window.open().print()` в WebView **не работают**. Несмотря на это ~60 мест используют именно их.

## B2.1 Каталог мест (сводный)

| Зона | Места | Тип поломки |
|---|---|---|
| Training | `QualityActions.tsx:92-114` (**вся экспорт-поверхность хаба: 4 кнопки**) · `BbAutoConstructor.tsx:871,890,904-907,920-923,946-949,962-965` + блок `2924-3109` (~185 строк) · `ArmAutoConstructor.tsx:2292-2300,2394-2397` · `UnifiedIntelligenceHub.tsx:1670-1671,1679,1690` · `PeriodizationDesignerTab` · `CardioConstructor` | молчание |
| Nutrition | `NutritionDiary.tsx:396-404` (JSON), `:412-420` (CSV), `:110` (печать) · `StorageErrorBanner.tsx:36-46` | молчание |
| Profile/Support | **`SupportDiaryView.tsx:18-38`** — фолбэк на `createObjectURL`, вызывающий код **игнорирует результат**, функция **возвращает `true` безусловно** ⇒ «экспорт успешен», а файл не доставлен | **ложный успех = тихая потеря данных** |
| | `SupportDiaryView.tsx:1634-1636` — `window.open` + `if(!w) return;` без тоста | молчание |
| | `ProfileDiariesTab.tsx:790-793` — `void saveTextFileApk(...)` + **безусловный тост успеха** | **ложный успех** |
| | `ProfileDiariesTab.tsx:796-806` — «PDF» = HTML, без проверки результата | ложный успех + неверный формат |
| | `ComplaintsTab.tsx:229-262` · `MarketplaceScreen.tsx:336` (буфер + `alert`) · `SupportTimingPlanner.tsx:232` (буфер без проверки) | молчание/ложь |
| Calculators | `PKPDSimulationTab.tsx:481` — единственный в зоне, кто игнорирует `apk-share` | молчание |
| Combat/Strength | `CombatPlanView.tsx:440,448` · `CombatConstructor.tsx:530-531,537-538,1342,1350` · `StrengthSportPlanView.tsx:338,344-346` · `StrengthSportConstructor.tsx:1202,1203` · `combat-print.engine.ts:82-83` · `combat-xlsx.engine.ts:121-138` · `strength-sport-export.ts:141-142,160-161,218-219` · `sm-export.engine.ts:111-123` — **11 путей**, и UI пишет «готово» (`doMsg`) | **ложный успех** |
| Движки | То же в `combat-print`, `combat-xlsx`, `strength-sport-export`, `sm-export` — т.е. **ломается на уровне движка**, лечить надо там | — |

**Хорошая новость (не регрессировать):** планировщик питания сделан правильно — `planner-day-print.ts:213-234` ветвится по `isCapacitorNative()` → `shareText` / `saveTextFile`. Статьи — `ArticlesScreen.tsx:721-759` через `saveBlobApk`. Арм-хабы — `printHtmlApk`. **Образец для копирования есть.**

## B2.2 Фиксы

1. **Все экспортные пути — только через `src/core/apk-share.ts`.** Для движков добавить в `apk-share` хелперы, работающие с `Blob`/`ArrayBuffer` (XLSX/ICS), чтобы движкам не пришлось знать про платформу.
2. **`SupportDiaryView.shareOrDownload` — убрать безусловный `return true`.** Возвращать реальный результат; вызывающий код обязан показать тост об успехе/неудаче.
3. **Убрать `void` перед вызовами, возвращающими результат** (`ProfileDiariesTab:790`, `SupportDiaryView:1412,1423`).
4. **Clipboard-only пути (9 в combat/strength)** — добавить нативный Share, иначе на Android нет системного «поделиться» вообще: `CombatPlanView:214,330,439`, `CombatConstructor:501`, `combat-annual-card:501`, `StrengthSportPlanView:230,337,339`, `StrengthSportConstructor:666,1201,1203`.
5. **`ProfileDiariesTab:796-806`** — переименовать кнопку «PDF» в «HTML/печать» либо реализовать реальный PDF.
6. **`document.execCommand('copy')`** (`Calc.mapper.tsx:4222,4231`) → `navigator.clipboard` + фолбэк на `shareText`.

## B2.3 Добавить обратную связь

**Правило:** ни одна кнопка экспорта/печати/поделиться не завершается без пользовательского подтверждения результата. Ошибка — тост с причиной, не тишина.

---

# БЛОК B3 — Шиты: `backdrop-filter` ломает `position: fixed`

**Приоритет P0 · 1–2 дня**

**Проверено лично (✓ верифицировано):**

- `src/ui/screens/combat/CombatUI.tsx:22` — `export const VIBRANCY = 'blur(20px) saturate(180%)'`
- `CombatUI.tsx:36-50` — `CARD` содержит **`backdropFilter: VIBRANCY` (`:45`)** и `position: 'relative'` (`:47`)
- `CombatUI.tsx:199` — `SectionCard` рендерит `<div style={accent ? CARD_ACCENT : CARD}>` ⇒ **карточка всегда содержит `backdrop-filter`**
- `CombatUI.tsx:438-441` — `POP_OVERLAY` = **`position: 'fixed', inset: 0`** + `backdropFilter: 'blur(20px)'`
- `CombatConstructor.tsx:655-692` — `CombatPopupSelect` (`:657`) находится **внутри** `<SectionCard>` (`:655` … `:692`)

**По спецификации CSS Filters (Chrome ≥74 / Android WebView) `backdrop-filter: blur(20px)` на предке создаёт containing block для потомков `position: fixed`.** Значит `POP_OVERLAY` позиционируется от `SectionCard`, а не от вьюпорта. Следствия: `alignItems: 'flex-end'` и `maxHeight: 78vh` перестают значить «низ экрана»; шит скроллится вместе с контентом; `paddingBottom: max(16px, env(...))` (`:445`) отсчитывается от неверной коробки.

Затронуто **46 контролов выбора**: 30 в combat (`CombatConstructor`), 16 в strength (`StrengthSportConstructor:785→…`, `825`, `839`, `862`, `880`, `899`, `970`, `1036`).
`createPortal` в обеих зонах **не используется нигде**.

Дополнительно усугубляет: `styles-native-strongman.css:45-52` добавляет `backdrop-filter: blur(20px) !important` к `[data-ss='hero']`, расширяя зону поражения.

**Вторая половина того же бага (B4):** даже если шит отрисуется правильно, аппаратная «Назад» его не закроет.

## B3.1 Фикс

**Обязательное правило (закрепить в ките + source-guard тест):** любой оверлей/шит/попап рендерится **только** через `createPortal(document.body)` и **никогда** не наследует `backdrop-filter` предка.

```tsx
// CombatUI.tsx / StrengthUI.tsx
import { createPortal } from 'react-dom';
const overlay = open ? createPortal(
  <div style={POP_OVERLAY} onClick={onClose}>…</div>,
  document.body
) : null;
```

**Дополнительно:** `CombatUI.tsx:36-50` `CARD` — убрать `backdropFilter` (карточка со стеклом ради размытия фона — декоративная роскошь, а не необходимость; `blur` на скроллящемся контейнере также дорог). Если визуал нужен — перенести в `::before`-слой с `z-index: -1`, чтобы он не создавал containing block для потомков.

**Проверка:** тест, что `CombatPopupSelect`/`CombatPopupNumber`/`StrengthPopupSelect` при `open=true` рендерят overlay в `document.body`, а не внутри ближайшего `position: relative` предка.

---

# БЛОК B4 — Диалоги и аппаратная кнопка «Назад»

**Приоритет P0 · 3–4 дня**

## B4.1 `alert` / `prompt` / `confirm` в APK-достижимом UI

| Место | Вызов | Почему критично |
|---|---|---|
| **`SymptomSolverTab.tsx:716-727`** | 2× `prompt()` | **Основное конверсионное действие таба — no-op на Android WebView.** `window.prompt` не поддерживается/авто-скрывается |
| `ProfileSettingsTab.tsx` | 7× `alert` + 4× `confirm` (`:82,88,90,109,110,116,121,125,127,219`) | Включая **двойной confirm на необратимый сброс профиля** и очистку всех дневников |
| `InjectionDiary.tsx:237,701,704,1562,1710` | 5× `confirm` | Включая **предупреждение по технике инъекции (масляная в водной зоне)** — в АПК его не видно |
| `ProfileDiariesTab.tsx:903` | `confirm` | **Многострочный выбор «слить или заменить» — на АПК пользователь не может сделать выбор вообще** |
| `DiaryToolsView.tsx:347,356,358,414,432,433,435` | 7× `alert` | Ошибки валидации/импорта должны быть инлайн-полями |
| `DeloadSchedulerTab.tsx:130` | `window.prompt` | Блокирует JS-поток, системный диалог без темы |
| `CalcPEDCard.tsx:193,203`, `CalcProfileCard.tsx:77,81` | `alert` | — |
| `PharmaCourseScreen.tsx:362,891,906` | `prompt`/`confirm` | — |
| `CardioConstructor.tsx:766`, `UnifiedIntelligenceHub.tsx:715,732`, `PerformanceScreen.tsx:70,73`, `FertilityPCTScreen.tsx:247`, `MarketplaceScreen.tsx:336`, `ProtocolExport.ts:175` | alert/confirm | — |
| Дневники: `HealthDiary:995,1420`, `SleepDiary:601,829`, `WeightDiary:445,1005`, `BPDiary:479,671`, `CardioDiary:348` | confirm | — |

**Правильный паттерн уже есть и используется в 21 месте:** `await confirm({...})` из `ConfirmDialog.tsx` + `flash()`/`toast`.

**Два системных дефекта в самом механизме:**

1. **`ConfirmDialog.tsx:106` — фолбэк на `window.confirm`.** Один непокрытый провайдером подэкран тихо деградирует всю зону к системным диалогам.
2. **Провайдер покрывает не всё.** `ProgramManagerPanel.tsx:1415-1419` оборачивает **только** поддерево программ. `PeriodizationHub` смонтирован отдельно, поэтому `PeriodizationDesignerTab.tsx:1424,1442` идут мимо диалоговой системы целиком.

**Фикс:** поднять `ConfirmDialogProvider` на уровень `App.tsx` (рядом с корневым `InfoErrorBoundary`); заменить фолбэк на тост/инлайн-ошибку; перевести все перечисленные места.

## B4.2 Аппаратная «Назад» — стек модалок

**Проверено:** `setupNativeBackButton` (`native-bridge.ts:644-671`) вызывается **ровно в одном месте** — `App.tsx:250-271`:

```ts
void setupNativeBackButton(() => {
  if (tabRef.current !== 'home') { setTab('home'); return true; }
  return false;
})
```

Стека модалок нет. При этом `AndroidManifest.xml:12` включает `enableOnBackInvokedCallback="true"` (predictive back), т.е. WebView **получает** событие.

**Затронуто 27 поверхностей `role="dialog"`:** `CombatUI.tsx:465,511`, `BarcodeScanner.tsx:402`, `ProfileScreen_v2/ui.tsx:922`, `PeriWorkoutCard.tsx:152`, `NutritionDiary.tsx:357,479,499`, `InjectionDiary.tsx:278`, `diary-modals.tsx:861`, `HealthDiary.tsx:386`, `arm-design-system.tsx:301`, `BBDiagnosticsHub.tsx:306`, `BbAutoConstructor.tsx:4128,4145`, `bb-step-ex-swap.tsx:41`, `CardioUI.tsx:371`, `NutritionScreen.tsx:1641`, `StrengthUI.tsx:388,435`, `MacrocyclePanel.tsx:1340,3155`, `PeriodizationPopups.tsx:16`, `StrongmanDiagnosticsHub.tsx:350,412`, `TrainingModal.tsx:36`, `VideoCaptureCard.tsx:327`.

**Симптом:** «Назад» при открытом шите/модалке → **переход на главную, потеря незаписанного состояния визарда** (агент A9: прямо для combat/strength — теряется шаг визарда и несохранённые правки плана). В `NativeFab` (`:49-50`) закрытие только по Esc → **на Android кроме тапа вне нет способа закрыть speed-dial**.

**Фикс — один раз, централизованно:**

1. Ввести **стек оверлеев**: модуль-реестр (`pushOverlay(id)`, `popOverlay()`, `topOverlay()`), в который **каждый** портал из B3/B4.1/B1.2 регистрируется при монтировании и разрегистрируется при размонтировании.
2. `App.tsx` — обработчик «Назад» в порядке приоритета:
   1. если есть верхний оверлей → закрыть его, `return true`;
   2. иначе если открыт полноэкранный сабтаб/просмотр плана → назад в список, `return true`;
   3. иначе текущее поведение (на главной — свернуть).

**Не делать:** отдельный back-листенер в каждой модалке — это 27 точек, которые разъедутся. Один стек + один обработчик.

---

# БЛОК B5 — Тач-таргеты ≥44px: центральная защита

**Приоритет P1 · 2–3 дня**

## B5.1 Корень (R2) — проверить последним правилом

**Проверено лично (✓ верифицировано), `src/styles.css`:**

| Строка | Правило | Медиа |
|---|---|---|
| `:2128` | `button { min-height: 40px }` | `@media` @2114 |
| `:2504` | `button { min-height:36px; min-width:36px }` | `@media` @2447 |
| **`:3204`** | **`button { min-height:38px; min-width:38px }`** | `@media` @3196 ← **выигрывает** |
| `:2218` | `.tab-btn` 36px (coarse-pointer) | `@media` @2114 |
| `:2220` | `.chip` 34px (coarse-pointer) | `@media` @2114 |
| `:3941` | `.plan-root button { min-height: 44px }` | — (спасает план питания) |

**Итог: любой `<button>` без класса на телефоне ≤480px = 38×38.** И более того — coarse-pointer блок **сам урезает** `.chip` до 34px и `.tab-btn` до 36px.

**Фикс:**
- `styles.css:3204` → `min-height: 44px; min-width: 44px`; либо удалить три конкурирующих правила и оставить **одно** в `@media (hover:none) and (pointer:coarse)`.
- `:2218/:2220` → 44px.
- Добавить в `html.app-native`: `button, [role=button], .btn, .chip, .tab-btn { min-height:44px }` с белым списком исключений (см. B0.1 п.4).

## B5.2 Инвентарь <44px по зонам (сводная)

| Зона | Количество строк | Худшие |
|---|---|---|
| Training | 306 | `ProgramEditorComponents.tsx` **58** (мин. 18px), `ProgramEditorView.tsx` 30, `PeriodizationDesignerTab.tsx` 17, `ExecutionZone.tsx` 13, `PlDeadpointsBarPathCard.tsx` 12, `StrengthSportConstructor.tsx` 10, `bb-step-params.tsx:649` **28px**, `bb-step-prep-cycle.tsx:182` 24, `bb-contest-prep-sections.tsx:920,926,1315` 24×24, `JointJsiCalculatorCard.tsx` 28, `diary-cards.tsx:96,103` 18–20 |
| Nutrition | ~15 | `MealListRender.tsx:398-406` **7 чипов 40×40 внутри `nowrap`-скролла**, `:477,480` 28, `:534-537` 8px/6px текст, `IndividualPlanSettings.tsx:230` 32, `:1914` 36×20, `IndividualPlanResults.tsx:1270,1325` 28–36, `ProductUsefulnessPlanner.tsx:1423,1431` ~20 |
| Profile/Support | ~20 | `InjectionDiary.tsx:949` 30×30, `ui.tsx:147,162` 30, `SupportShared.tsx` база `btn` 36 / `btnGhost` 40 (44px-override покрывает только 6 секций — `styles-native-support.css:1140-1161`), `SymptomSolverTab.tsx:39` 40 + инлайн 8–9px → 16–24px, `body-measurements-modal.tsx:376-387` 40×40, `MarketplaceScreen.tsx:157` 26×26 и ещё 8 |
| Calculators/Risks | 31 | `V7RiskDisplay.tsx:220` **6×6px кликабельные точки без role/tabIndex/aria**, `WeeklyRiskChart.tsx:157` 10×10, `PharmaCourseScreen.tsx:106` **24px**, `InteractionCheckerTab.tsx:250` 30×30, `DosageCalculatorTab.tsx:269` 28, `CatalogTab` 26–28 |
| Combat/Strength | ~15 | `CombatUI.tsx:322,333` степпер 30×30, `:145` `CHIP` 34, `:286` `SectionNav` ~28, `combat-annual-card.tsx:156` 32 |
| **Общие киты** | — | **`training-ui.tsx:71-79` `STEP_PILL` без `minHeight` ≈30px (7 оболочек!)** · `:82-87` `IN` 13px/40px · `planner-ui.tsx:77` 6×8px/10px ≈26px (хуже базовой) · `CardioUI.tsx:86-88` 40/36 · `ManualUI.tsx:75-77` 32/28/36 · `training-ui.tsx:25` `tapMinHeight: 38` — **мёртвая конфигурация**, которую можно случайно внедрить |

## B5.3 Две находки, где **APK-CSS сам создаёт** нарушение

- `styles-native.css:10933-10937` — `html.app-native .combat-planview .cb-plan-move { width:40px !important; height:40px !important }`. В исходнике `CombatPlanView` кнопка 44px — **APK-слой уменьшает её до 40px**.
- `styles-native.css:10737-10748` + `styles-native-strongman.css:393-401` — `input[type=range] { min-height: 28px !important }`, thumb 26–28px. Комментарий в исходнике прямо гласит **«палец 28px»** — то есть под-таргет заложен намеренно. 55 слайдеров.

**Фикс:** оба → 44px (или 48px для слайдера, как уже сделано для combat-вводов `styles-native.css:10727-10731`).

---

# БЛОК B6 — Типографика вводов: пол 16px + ползунок

**Приоритет P1 · 2–3 дня**

## B6.1 Инвентарь

**~520 полей <16px** суммарно по зонам (Training ~280, Nutrition 32, Profile/Support ~20, Calculators 10, combat/strength 9, Risk 10).

**Худшие — общие константы** (масштабируются на всех потребителей):

| Константа | Размер | Файл |
|---|---|---|
| `inputStyle` | **13** | `IndividualPlan/ui.tsx:53` (весь таб Настроек планировщика) |
| `modernInputStyle` | 13 | `nutrition-modern-kit.tsx:26` |
| `inputStyle` | 13 | `RecipesTabModern.tsx:6`, `NutritionScreen.tsx:84` |
| `inputStyle` | **12** | `NutritionCustomFood.tsx:18` (~25 полей на строках 120-184) |
| `PopupText` textarea | 12 | `PopupXxx.tsx:165` |
| `inpS()` | **9** | `CustomProducts.tsx:66` |
| `BPDiary.tsx` | — | корректный `@media (pointer:coarse)` → 16px (образец) |
| `styles-native-strongman.css:350,237` | **15 (!)** | APK-слой **сам** ставит 15px — зум остаётся активным |
| `styles-native.css:5355-5357` | — | хардкод 28px на все range-поля зоны Рисков |

**Правильные (не регрессировать):** `PopupXxx.fieldInput` 16px/44px; `ProfileScreen_v2/ui.tsx:324-335` `inputBase` 16px/44px; `CardioUI` `INPUT`; `StrengthUI.tsx:315` `SELECT`; `styles-native.css:10727-10731` combat-вводы 48px/16px.

## B6.2 Ползунок

`PopupXxx.tsx:107` — **`height: 4`**. **Все `PopupNumber` в приложении** имеют 4px-таргет (числовое поле рядом — 16px, ок). Аналогично: `IndividualPlanSettings.tsx:1927`.

**Фикс:** ползунок в отдельную строку ≥44px с `-webkit-appearance: none`, крупный thumb 28px, само значение — `PopupNumber`-инпут 16px.

## B6.3 Правило

`html.app-native input, html.app-native textarea, html.app-native select { font-size: 16px !important }` — **одно** правило вместо 520 точечных правок, с белым списком исключений (например, поиск в узком стебле таблицы, если 16px ломает сетку — но таких мест единицы).

---

# БЛОК B7 — Safe-area / нижняя навигация / фиксированные оверлеи

**Приоритет P1 · 2–3 дня**

## B7.1 Что уже правильно (НЕ ТРОГАТЬ)

- `--tabbar-clear` / `--tabbar-lift` корректно используются: `SessionPlayer.tsx:2206`, `ExecutionZone.tsx:939`, `NutritionScreen.tsx:1727`, `LabsScreen.tsx` (лаборатория — эталон: `paddingTop: calc(10px + max(env(safe-area-inset-top),24px))`).
- **`Главная (Home) — корректно.** Проверено лично: `.native-home` (`:378-388`) действительно без `padding-bottom`, **но** скроллящий потомок `.native-home-landing` (`:430-441`) несёт `padding: 0 16px calc(var(--nav-height) + max(env(safe-area-inset-bottom,0px), 28px) + 20px)` ⇒ ≥124px. **Два независимых аудита ошиблись — это ложное срабатывание, закрыто.**
- `BBDiagnosticsHub.tsx:306`, `StrongmanDiagnosticsHub.tsx:350,412` — инлайн `env(safe-area-inset-bottom)`.
- `ProgramEditorView.tsx:1973` спасён `styles.css:3825-3826` (`!important`).
- `styles.css:3813-3815` — корректный пол 28px для WebView.
- `styles-native.css:4939-4945` — **образец**: 3 классаных тоста подняты через `calc(var(--nav-height) + max(env,28px) + 12px)` c `!important`, что позволяет CSS победить инлайн-стиль.

## B7.2 Реальные дефекты

| Место | Значение | Проблема |
|---|---|---|
| **`planner-ui.tsx:32`** (✓ верифицировано) | `padding: maxWidth ? '0 10px 90px' : undefined` | На нативе нужно ~128px (`76 + 28 + 24`). **Нижний ряд 4 оболочек (BB/PL/Combat/Strength) постоянно под пилюлей навигации.** `!important`-правило `styles.css:3808` бьёт только `.nutrition-tabs-body` |
| `IndividualPlan/index.tsx:50` | `position:fixed; bottom:84`, **без className** | -32px; нативный CSS не достаёт. Тост-планировщика скрыт |
| `IndividualPlanSettings.tsx:444` | `position:fixed; bottom:76`, **без className** | -40px; то же |
| `MyTrainingTab.tsx:384` | `.lib-toast` фиксированный `bottom:84` | -28px |
| `PeriodizationDesignerTab.tsx:652` | FAB `position:fixed; bottom:16` | Под пилюлей |
| `MetabolicHub.tsx:753` | `position:fixed; bottom:18` | Под пилюлей (18–54px против 10–86px) |
| `CatalogTab.tsx:407` | sticky footer `bottom:0` | Под пилюлей |
| `KvUpdateBanner.tsx:33-38` | `bottom:74; zIndex:1000`, без className | Без safe-area, без темы, в той же полосе что тосты |
| `planner-ui.tsx:65` | `position:sticky; top:0; zIndex:30` | `TrainingScreen` уже рендерит липкий `.training-subnav` — пилюли уезжают под него |
| `V7RiskDisplay.tsx:878`, `LabDiaryTab.tsx:131`, `RiskInfo.tsx:416` | хардкод `paddingBottom: 80` | На 6px короче пилюли (86px) |
| `RiskScreen.tsx:967,1012` | `.risk-topnav` без `safe-area-inset-top`, внутри `position:fixed` hero | `env()`-mitigation не применяется к fixed — в отличие от Labs |
| `CombatUI.tsx:445`, `StrengthUI.tsx:367` | `paddingBottom: max(16px, env(...))` | Не используют `--tabbar-*`; + см. B3 (считается от неверной коробки) |
| 5 поверхностей под доком | `ProfileHero.tsx:96` (64), `WeightDiary.tsx:1019` (72), `ArticlesScreen.tsx:897` (72), `styles-native-support.css:1354-1358` (24), `MarketplaceScreen` (84) | Ниже 76px |

## B7.3 Фикс

1. **Все фиксированные/липкие нижние элементы получают `className`** и единый якорь: `bottom: calc(var(--tabbar-lift, 0px) + 8px)` (или `padding-bottom: var(--tabbar-clear)` для скролл-контейнеров). Убрать магические 84/90/76/80/18/16.
2. `planner-ui.tsx:32` → `var(--tabbar-clear, 110px)`.
3. `RiskScreen.tsx` — добавить `paddingTop: max(env(safe-area-inset-top),24px)` к `.risk-topnav` (как в Labs).
4. Проверить z-index: CSS-максимум **1200** (`styles-native.css:3863` FAB) и ~1190 (offline) против тоста **200** (`styles.css:1245`) — **в одной нижней полосе**. Инлайновые `z-index` в TSX доходят до 10000. Ввести шкалу и привести к ней.

---

# БЛОК B8 — Покрытие APK-CSS и токены дизайн-системы

**Приоритет P1 · 5–8 дней (самый большой по объёму)**

## B8.1 Проблема (R3, R7)

| Метрика | Значение |
|---|---|
| Объём нативных CSS | **776 КБ** в 7 файлах (`styles-native.css` — 460 КБ / 12 788 строк) |
| `!important` | **5 580** (native 3 989 · support 524 · base 439 · arm 363 · strongman 239) |
| Дубли селекторов верхнего уровня | **204** (456 определений / 2 836 селекторов); `html.app-native` встречается 12× |
| Хрупкие `[style*=…]` селекторы | **514** — React сериализует kebab-case, они работают случайно |
| Токены объявлены | `styles-native.css:3484-3502` |
| **Использование токенов** | `--press` **1 раз** при 266 литеральных `scale()`; `var(--type-*)` **11** при 394 литеральных `font-size`; `cubic-bezier` 1 токен при 72 литеральных; `--focus-ring` 1 при 171 литеральном `outline` |
| Пространство токенов по файлам | base 76 · native 69 · support 3 · arm 12 · strongman 14 · **labs 0** · **pro 0** |
| Мёртвое правило | `styles-native.css:5818-5830,5841` — атрибутный селектор по `gridTemplateColumns`, а React выдаёт `grid-template-columns` ⇒ **фикс узкой сетки фармы никогда не применялся** |
| Нарушения правила «без серого» | **22** приглушлённых текста в `styles-native.css`, включая текст навигации `:111` `rgba(226,236,255,.55)` |

## B8.2 Пробелы покрытия (проверено пересчётом)

| Хук | Использований в TSX | Правил в нативном CSS | Статус |
|---|---|---|---|
| `data-sm` (хаб Стронгмена) | **142** | **0** | зона покрыта классом `.train-strongdiag`, но не хуком |
| `data-intel` | 28 | 5 | частично (только `-card`/`-grid`; 8 значений без стилей) |
| `data-cb` | 63 | 5 | частично |
| `data-q` | 18 | 7 | частично (3 из 18) |
| `data-mix` | 2 | **0** | нет |
| `data-bb` | 298 | 13 | **покрыт (эталон)** |
| 106 `data-*` без правил | | | требуют поэлементной сверки (часть — метаданные/тест-хуки) |

**Важная поправка к аудиту:** `styles-native-strongman.css` использует селекторы в одинарных кавычках `[data-ss='…']` — наивный скан их **не видит** и даёт ложное «покрытия нет». Перед любыми правками — пересчёт с учётом кавычек.

## B8.3 Фикс — по шагам

1. **Починить мёртвое правило** `styles-native.css:5818-5841` → kebab-case.
2. **Расширить токены** в labs/pro (сейчас 0) — иначе темы/отступы там нечем централизовать.
3. **Исправить 22 приглушённых текста** в `styles-native.css` на `#fff` (правило AGENTS.md №1).
4. **Ввести шкалу z-index** (см. B7.3).
5. **Покрытие по зонам:** `data-sm` (142), `data-intel` (8 значений), `data-cb` (недостающие), `data-q`, `data-mix`, а также зоны без покрытия: `.sup-solver`, `.sup-risktimeline`, `.sup-phaselabel`, `.sup-itemrow` (0 правил в `styles-native-support.css` при том, что соседние секции подняты до 44px в `:1140-1161`); `.pf-pve-close/step/clear` (нет ни в native, ни в base).
6. **Долгосрочно:** мигрировать инлайн-стили в токены/кит по мере работы над зоной (не отдельным «переписыванием» — иначе churn без пользы).

---

# БЛОК B9 — Тематизация: светлая / AMOLED / Material You

**Приоритет P1 · 2–3 дня**

## B9.1 Подтверждённые дефекты

1. **Material You убивает переопределение акцента в светлой теме.** `appearance.ts:168-172` пишет `--accent`/`--accent-2` **инлайном в `<html>`** (только при акценте `system`, `:214-219`; именованные акценты вызывают `clearSystemVars()` на `:225`). Инлайн-стиль бьёт таблицу стилей ⇒ `styles-native.css:3733-3734` **мёртвое**. `setApkTheme` (`:82`) это не перезапускает, поэтому дефект переживает смену темы.
2. **Контраст акцента на светлом фоне.** Замерено на `#eef2f6`: `#c9f73a` **1.11:1**, `#00e68a` 1.47, `#38bdf8` 1.90, `#fbbf24` 1.48, `#a78bfa` 2.42, `--accent-2:#006b45` 2.99 — **все ниже порога 3:1** для UI-компонентов. (`--accent-contrast` при этом считается корректно через `contrastForHex:143-154`, т.е. текст-на-акценте в порядке — проблема именно акцент-на-светлом.)
3. **Светлая/AMOLED-тема не покрыта в 5 зонах:** support/arm/strongman/labs/pro — **0** правил `[data-apk-theme]`. Плюс **61 хардкод тёмного фона** (native 42, support 11, arm 4, strongman 3, pro 1) ⇒ эти поверхности не следуют за светлой темой.
4. `labs` имеет только `@media 480px`, `pro` — ни одного брейкпоинта ширины.

**Фикс:** вынести акцент в CSS-переменную с `@media (prefers-color-scheme: light)`-переопределением, а инлайн-приоритет оставить только для **абсолютного** значения акцента при явном выборе пользователя; для `system` — полагаться на `color-mix`/`light-dark`/`@media`. Добавить тему-покрытие в 5 зон.

---

# БЛОК B10 — Производительность на телефоне

**Приоритет P1 · 4–6 дней**

## B10.1 Бандл (R9)

- **`dist/index.html` = 25 092 КБ** initial JS: entry 9 813 КБ + **14 modulepreload** (`support-ui` 3 544, `nutrition-plan` 3 128, `support-db` 2 331, `training-data` 1 424, `recipe-db` 1 319, `nutrition-ui` 1 196 + 8).
- `dist/` = **139,5 МБ** (Tesseract 48 МБ, assets 30 МБ, organs 15,5 МБ).
- **Корень:** `App.tsx:2-13` статически импортирует все 10 экранов. Нет `React.lazy`.
- `index.html:12` — скрипт Telegram Web App грузится **на всех платформах**, включая APK WebView и десктоп-PWA.
- `index.html:14` — preload `/hero-main.webp` **абсолютным** путём при `base: './'` (ломается не на root).
- **410 КБ нативного CSS** попадают в PWA-install и в web/TG-артефакт, хотя никогда не грузятся там (loaders под `isNativeApp()`). Мёртвые байты.
- `src/data/usda-foods.ts` — **5,28 МБ**. **Поправка к аудиту:** файл **не мёртвый** — `useDiarySearch.ts:18-20` и `NutritionScreen.tsx:307` динамически его импортируют (`slice(0,5000)` / `slice(0,2000)`). Это ленивый чанк, не dead code, но 5,28 МБ источника — кандидат на разбиение/сжатие (например, отдавать subset по умолчанию).
- Workbox SW-артефакты генерируются и **упаковываются в APK**, хотя `main.tsx:161-181` на старте APK **отключает и выгружает** service worker. Мёртвые байты.

**Фикс:** `React.lazy` для 9 второстепенных экранов; гейт на размер initial-бандла в CI; `index.html` — скрипт TG только в TG-ветке, относительный preload; вычистить SW-артефакты из APK-сборки; решить судьбу `usda-foods` (чанкование).

## B10.2 Полный localStorage на каждое нажатие (R8)

| Файл:строка | Что |
|---|---|
| `BBDiagnosticsHub.tsx:401` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(state))` в `useEffect([state])` |
| `WLDiagnosticsHub.tsx:299-301` | то же |
| `ArmDiagnosticsHub.tsx:315-317` | то же (+ `:320` для P1-среза) |
| `StrongmanDiagnosticsHub.tsx:474-476` | то же |
| `bb-step-params.tsx:666-669` | `localStorage.setItem('he_wearable_daily', ...)` **внутри `onChange`** — на каждый символ; ключ пишут ещё 3 модуля и он синхронизируется в облако |
| `ProgramEditorComponents.tsx:1833,1838,1847,1856,1860,1864` | 6 обработчиков с O(n²): `weeks.slice(0,wi).reduce(...)` внутри `map` по дням каждой недели |

**Каскад:** запись `localStorage` перехватывается `cloud-kv.ts:273-276` (monkey-patch) ⇒ помечает ключ грязным ⇒ **весь блоб улетает в Supabase**.

**Образец правильного решения в том же коде:** `DiaryRecordingForm.tsx:104-109` — debounce черновика.

**Фикс:** debounce 400–600 мс + запись только изменённого слайса; `bb-step-params` — перевести в React-state; префиксные суммы в `ProgramEditorComponents` — считать одним проходом.

## B10.3 Тяжёлые вычисления в пути рендера

- **Монте-Карло в движке риска:** `mdss-engine.ts:194-208,263-270` и `clinical-analyzer.engine.ts:94-107` — по 10 000 итераций `Math.random()` **на орган**, прямо в расчёте риска. Это и «самый сильный анализ» по справке, и самый дорогой кусок на среднем Android.
- `TZRisk3DModel.tsx:354` — `setPixelRatio(native ? 1 : min(dpr,1.5))` ⇒ **на APK 3D-модель рендерится в половинном разрешении**; `:339` отключает antialiasing; непрерывный `requestAnimationFrame`; модели органов грузятся последовательно (`:750-764`).
- `RiskScreen.tsx:967` / `LabsScreen.tsx:673` — полноэкранные `position:fixed` + `100dvh` + `overflow:hidden` оболочки.

**Фикс:** сделать Монте-Карло детерминированным (см. B12) и вынести в Web Worker/мемоизировать по ключу входа; DPR нативно `min(dpr,2)`; 3D — по требованию (кнопка «показать 3D»), не автозагрузка.

---

# БЛОК B11 — Безопасность

**Приоритет P0 · 3–5 дней**

| # | Дефект | Доказательство | Фикс |
|---|---|---|---|
| **B11.1** | **Токен облака выводим из публичного бандла.** `tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)>`; `VITE_CRYPTO_KEY` **инлайнится Vite в клиент** (любая `VITE_*` переменная публична по определению), плюс **захардкоженный фолбэк-литерал** в `cloud-kv.ts:383` | ✓ `cloud-kv.ts:8-21,381-384` | Вынести вывод токена в Edge Function, хранящую секрет. Клиент не должен владеть ключевым материалом. Убрать фолбэк-литерал |
| **B11.2** | **`link_codes.tg_token` читает любой anon-клиент.** RLS включён, но `SELECT`-политика **не ограничена предъявленным кодом** ⇒ `select * from link_codes where consumed_at is null` отдаёт живые токены без угадывания 6 цифр | `supabase/migrations/20260912_link_codes.sql:16-39` | Ограничить `SELECT` предъявленным кодом; лучше — вынести погашение в Edge Function |
| **B11.3** | **Admin-креденшелы в бандле.** `main.tsx:194-198` читает `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD` и вызывает `ensureAdmin` (автовыбор локального admin-профиля). `auth-manager.ts:26-30` — одиночный SHA-256, не password-KDF | ✓ `main.tsx:194-198` | Убрать из бандла; не автовыбирать admin; PBKDF2/bcrypt |
| **B11.4** | **Локальное шифрование молча деградирует до plaintext**, если ключа нет в кэше (`db-encryption.ts:37-38`); `void initEncryption(...)` — fire-and-forget (`main.tsx:205-213`), ранние записи могут попасть в открытый вид; покрытие частичное (только `cloud-backup`, `db-secure`, `realtime-sync`) | ✓ | Блокировать запись до инициализации ключа; расширить покрытие; **предупреждать** пользователя о состоянии |
| **B11.5** | Backup-правила исключают **все** данные (`app_webview/`) при `allowBackup="true"` | см. B0.5 | Разрешить бэкап, исключив чувствительное |
| **B11.6** | Биометрия хранит **только `credentialId`**, подпись не проверяет, `reason` выбрасывается (`void reason`, `:776`) ⇒ app-lock — проверка владения, не криптографическая аутентификация | ✓ `native-bridge.ts:726-781` | Либо принять как «владелец устройства» и честно назвать, либо проверять подпись |

**Отдельно отметить (хорошо, не ломать):** `db-encryption.ts:1-28` — PBKDF2-SHA-256 @100k + AES-GCM-256 с постоянной солью — корректный выбор. И **APK не требует Telegram** (`app-platform.ts:8-27`) — синхронизация не запирает пользователя.

**Прямое следствие для продукта:** `ProfileSettingsTab.tsx:232-238` обещает «Синхронизация … в Telegram **и АПК**», а в АПК синхронизации нет (`he_crypto_key` исключён из синка). **Либо реализовать, либо убрать обещание из UI.**

---

# БЛОК B12 — Корректность движков риска и расчётов

**Приоритет P0 · 4–6 дней**

## B12.1 Движок переписывает «источник истины» (самый опасный)

**✓ Верифицировано:** `src/engines/risk-engine-tz.ts:322-330`
```ts
let _supportReductionsLoaded = false;             // :324
if (_supportReductionsLoaded) return;              // :326
Object.assign(SUPPORT_COVERAGE_MAP, { /* … */ });  // :330
```
`src/data/support-coverage-map.ts` содержит **248** веществ — **83 из них молча заменяются**. Пример `TUDCA`:
- слой данных: `hepatic {1:.14, 2:.15, 3:.15, 4:.11, 5:.11, 6:.07, 7:.14}` + `cardio`, `neuro`, `neuro_toxicity`, `renal`
- перезапись движка (`:332`): `hepatic { 1:0.3, 2:0.2, 7:0.25 }` — **3 механизма вместо 7, других систем нет**

`computeSupportFactor` (`:467-498`) читает **мутированный** объект ⇒ **каждое отображаемое число риска с учётом поддержки считается по таблице движка, а не по «единому источнику»**, который сам комментарий на `:322` рекламирует.

**Фикс:** расширить `support-coverage-map.ts` (это и есть источник истины) и **удалить `Object.assign` из движка**. Лок-тест: для каждого из 83 перезаписанных id значение в движке === значение в данных.

Побочно: дубли ключей `NAC`/`nac` (`:331,344`), `TUDCA`/`tudca` (`:332,345`) — при лукапе `[id, id.toLowerCase(), id.replace(/_/g,'')]` (`:469`) половина пар мертва.

## B12.2 Недетерминированный «самый сильный» анализ

`mdss-engine.ts:194-208,263-270` и `clinical-analyzer.engine.ts:94-107` — 10 000 итераций `Math.random()` **внутри расчёта**. Одинаковый вход → разный балл авторитетности. Нужен детерминированный seed (hash входа) + тест «два вызова = один результат».

## B12.3 Подставные данные, поданные как результат модели

**✓ Верифицировано — `src/ui/screens/RiskScreen_parts/V7RiskDisplay.tsx:186-193`:**
```ts
const base   = organSummary[key]?.meanS ?? 0;
const noise  = (Math.sin(d * 0.1 + key.length) * 0.02);
const trend  = d / days * 0.1 * base;
organDaily[key].push(Math.min(1, Math.max(0, base + noise + trend)));
```
Весь «📈 Эволюция рисков (84 дня)» (`:390-395`) — **синус + линейный тренд**, а не выход симуляции. Гейт — лишь непустота `pkTimeSeries` (`:181`).

**Там же `:167-177`** — «анализ чувствительности» заменён на закрытую формулу `baseNet * (1 + Σ|Δ| × sign(net-50) × 0.3)`. Следствия: рейтинг обратно пропорционален базовому значению ⇒ бинарный флаг `hasHIIT` **всегда №1**, `volumeTonnes` всегда последний; при `net == 50` `Math.sign(0)=0` ⇒ **все эластичности обнуляются**. При этом UI (`:473-474`) утверждает: «Эластичность показывает, на сколько % изменяется риск при 1% изменении параметра».

**Фикс:** (а) убрать подставной график либо честно пометить «иллюстративная визуализация, не симуляция»; (б) прогонять настоящий `runV7Simulation`/`sensitivityAnalysis`; (в) убрать формулировку про «1% изменения», если реальной эластичности нет.

## B12.4 Прочие подтверждённые дефекты движков

| # | Дефект | Файл:строка |
|---|---|---|
| 1 | `calcTrendFromHistory` без проверки даты ⇒ одна битая строка даёт `xs: [NaN], trend: NaN` (оба `<`-гарда на NaN проходят молча) | `core/metabolic-constants.ts:419-449` |
| 2 | `rir-calibration` пишет до **5 000 точек (~1,1 МБ) без `try/catch`** ⇒ необработанный `QuotaExceededError` в потоке «после тренировки» | `engines/rir-calibration.engine.ts:48-53` |
| 3 | `rawScore` имеет **4 разные семантики единиц** (сумма весов → 0–100 → проценты) в 4 местах | `risk-engine-tz-spec.ts:820`; `support-plan/engine.ts:667`; `engine-helpers.ts:1113-1124`; `systems.ts:19` |
| 4 | Выводимый `m_i` **обратно выводится** из финального вклада вместо показа реального скорректированного | `risk-engine-tz-spec.ts:796` |
| 5 | **Выдуманные строки механизмов** для систем без данных ТЗ (endocrine, musculoskeletal) с линейными вкладами | `support-plan/engine-helpers.ts:1148-1151` |
| 6 | Реестр 18 систем, описано 14 — 4 отсутствуют молча (это уже отражено в UI-справке, но не в данных) | `risk-engine-v7-matrix.ts:14-18,830-845,1092-1101` |
| 7 | **Третья расходящаяся базовая таблица V7** (weekly vs matrix vs TZ) | `weekly-risk-dynamics.engine.ts:13-21`; `risk-engine-v7-matrix.ts:830-845`; `risk-engine-tz.ts:93-101` |
| 8 | `Math.random()` для FHIR/мок-идентификаторов ломает чистоту | `engines/labs.engine.ts:272-299` |

**Плюс (не ломать):** `RiskInfo.tsx` уже честен — «18 систем, из которых описаны 14» (`:194-196,:391`), RSS + арифметическое среднее описаны верно (`:145-146,:325-329`). NaN-гарды в `risk-engine-tz.ts:499,504-509,513-516` — настоящие и рабочие.

---

# БЛОК B13 — Целостность данных и хранилище

**Приоритет P1 · 3–4 дня**

| # | Дефект | Файл:строка | Риск |
|---|---|---|---|
| 1 | **Архив веса пишет base64-фото в localStorage**, противореча собственному докстрингу «без фото-раздувания» (`:163`) | `engines/profile-store.ts:136-142,184-191` | Медленная бомба квоты; ломает экспорты |
| 2 | Финальная запись `saveWeightLog` **вне try/catch** (`:160`); 6+ вызывающих не `await`/не `.catch` | `profile-store.ts:160`; `ProfileDiariesTab.tsx:889,1827,1836,1852,1861`; `DiaryToolsView.tsx:354` | Запись теряется без сигнала |
| 3 | `ProfileDiariesTab:1822-1827,1847-1852` **обходят** безопасный слой `saveDiaryEntries` | `diary-storage.ts:36-52` — образец правильного | Обход гейта квоты |
| 4 | `weight-photo-store` без квоты; `migrateWeightPhotosFromLocalStorage` **не удаляет** фото из `he_weight_log` (`:131-147`) ⇒ двойное хранение | `engines/weight-photo-store.ts` | Раздувание |
| 5 | `annual-training-storage` **глотает квоту и рапортует успех** | `:172,220` | Потеря годового плана |
| 6 | `lab-diary.engine.ts:52`, `nutrition-tracker.engine.ts:142` — при квоте теряется **самаяя свежая** запись без сигнала | — | Потеря данных |
| 7 | 6 писателей истории без капа и без гарда: `coaching-psychology:297` (500), `meal-custom-food:69,78`, `profile-settings:336,344` (сон+АД), `sm-lvp-calibration:98`, `ta-injection:101,110` | — | Заполнение стора |
| 8 | **3 неограниченных ключа в питании**: `he_saved_meals` (`ProductUsefulnessPlanner:1211-1213`, хранит полные массивы продуктов), `he_recipes` (`RecipesTabModern:115`), `he_quick_plan_items` (**2 писателя с разной семантикой `id`**: `RecipesTabModern:443` пишет `rec.name`, `NutritionScreen:657` — `food.id`) | — | Квота + логическая порча |
| 9 | **11 мест UTC-дата для календарных ключей** (сдвиг на сутки в UTC+3…+12), из них **потеря данных**: `PharmaCourseScreen.tsx:364` (коллизия двух записей за один локальный день), `MetabolicHub.tsx:333,346,1521` (ключи HCT/веса) | + `RiskVerificationList.tsx:78,84`; `LabDiaryTab.tsx:68`; `PharmaReportsTab.tsx:88`; `PharmaCourseScreen:176,195` | **Потеря записей** |
| 10 | 5 движков используют UTC как «сегодня» для пользователя | `core/types.ts:815`; `exercise-substitution.engine.ts:254`; `bb/cycle-to-plan.ts:1939`; `arm/arm-bilateral.engine.ts:119`; `arm/arm-platform.engine.ts:158` | Сдвиг на сутки |

**Канон даты:** `src/core/local-date.ts` (`localIsoDate`, `localIsoDateOffset`, `parseLocalIsoDate`, `shiftIsoDate`). **Не трогать** (это осознанные решения, зафиксированные в истории проекта): `cloud-backup.ts:17`, `export.ts:13` (только имя файла), `arm-acwr.engine.ts` (`T12:00:00` локальный разбор — задокументирован).

**Правильный образец для квоты:** `workout-logger.engine.ts:163-184` (каскадная обрезка 500→100→50 + предупреждение через `getStorageTrimWarning()`), `diary-storage.ts:36-52`, `profile-manager.ts:219-234`, `manual-storage.ts:44-97`, `combat-storage.ts:21-51`.

## B13.2 Мёртвые «переключатели» настроек

- **`settings.system.notificationsEnabled`** — пишется (`ProfileSettingsTab.tsx:175-177`), **ни одного потребителя** по всему репозиторию (встречается только в `types.ts:777,867`, миграции `profile-manager.ts:112`, `unified-profile.ts:127`, дефолте `auth-module.ts:22` и тестах). Тумблер «Уведомления» **ничего не делает**.
- **`settings.system.privacyLevel`** — то же (`:150-153`; `types.ts:778,868`).

Для контраста, работающие соседи: `mcRuns` → `useV7Risk.ts:76`; `forceNoLabsPenalty` → `labs-penalty.engine.ts:69,101`; `preferredUnits` → используется. **Именно поэтому два мёртвых выглядят неприлично.**

**Фикс:** либо реализовать (см. B17.3 — напоминания), либо убрать из UI.

---

# БЛОК B14 — Неработающие функции (полный инвентарь)

**Приоритет P1 · 3–5 дней**

| # | Функция | Статус | Доказательство | Действие |
|---|---|---|---|---|
| 1 | **Расписание инъекций + напоминания** | UI-только: расписание, % соблюдения, «Сегодня по плану», пропущенные дни — реализованы, но `scheduleWeeklyReminders` (`native-bridge.ts:122`) **вызывается только из `PharmaCourseScreen.tsx:78`**, вне этой зоны. `dueToday` считается только пока дневник открыт | `InjectionDiary.tsx:1419-1740` | **Подключить напоминания** — это фича, за которую ждут; сейчас пользователь настраивает расписание и не получает ничего |
| 2 | **«Анализ 84-дневной эволюции риска»** | Подставные данные (см. B12.3) | `V7RiskDisplay.tsx:186-193` | Убрать или честно подписать |
| 3 | **«Анализ чувствительности»** | Закрытая формула, рейтинг = артефакт базовых значений (см. B12.3) | `V7RiskDisplay.tsx:167-177` | То же |
| 4 | **Пустой бейдж на каждой строке чувствительности** | `elasticityLevel` возвращает `''` во всех трёх ветках, но рендерится в пилюле с отступами/рамкой | `V7RiskDisplay.tsx:480,492` | Убрать или заполнить |
| 5 | **310 строк `render3DModel` недостижимы** | Функция определена и **не вызвана**; вкладок `organs/matrix/timeseries/sensitivity/pk` нет `3d`; мёртвы `selectedOrgan3D`, `organShapes`, силуэт `bodyPaths`, CSS-хука `.risk-v7-3d` | `V7RiskDisplay.tsx:505-815`; `styles-native.css:5288` | Удалить или подключить вкладку |
| 6 | **`Risk3DModel.tsx` / `RiskMatrix.tsx` — сироты** | Нет прод-импорта; `Risk3DModel.tsx:474-475` обещает «клик по органу → детали», но **кода raycast в файле нет** | — | Удалить (живой аналог — `TZRisk3DModel.tsx`) |
| 7 | **Видео-анализ офлайн = подставные метрики** | `cv/pose-engine.ts:25,29` и `pose-worker.ts:25,29` грузят MediaPipe с CDN; при сбое UI показывает хардкод-метрики (`VideoCaptureCard.tsx:84-88`). Фолбэки подписаны (`:211-224`) — не обман, но **фича нефункциональна в офлайн-APK** | — | Либо бандлить модель, либо убрать фичу, либо честно «недоступно офлайн» |
| 8 | **Маркетплейс на моках** | `MOCK_MARKETPLACE_DB` | `MarketplaceScreen.tsx:71` | Пометить демо-режимом или подключить реальные данные |
| 9 | **Счётчик корзины устаревает** | `cartCount` — `useMemo` с deps `[tab]`; `addToCart` пишет `localStorage` напрямую и не вызывает `updateCarts`/`rerender` | `NutritionScreen.tsx:1449` vs `:103,418,492,656,1219` | **Бейдж не обновляется до переключения вкладки** |
| 10 | **План-конструктор: поля-пустышки** | `PlanTraining.tsx:90-121` — селекты/слайдеры с `onChange={() => {}}`; `:272` рядом инертные поля сет/повторов | — | Либо связать, либо убрать |
| 11 | **Печать дневников — PDF-модалка без проверки** | «PDF: все дневники» отдаёт HTML | `ProfileDiariesTab.tsx:796-806` | Переименовать/починить |
| 12 | **Печать в Support — полный no-op** | `if (!w) return;` без тоста | `SupportDiaryView.tsx:1634-1636` | Починить (B2) |
| 13 | **Тумблеры «Уведомления»/«Приватность»** | write-only (см. B13.2) | — | Реализовать или убрать |
| 14 | **Вкладка «Тренировки» в профиле недостижима** | `ProfileTrainingTab.tsx` **не импортируется и не монтируется нигде** | — | Подключить или удалить |
| 15 | **`ocrCameraRef` — мёртвая цепочка** | `ref` создан (`NutritionDiary.tsx:78`), проброшен (`:223`), принят (`AddFoodPanel.tsx:61,72`), отрендерен с `onChange={() => {}}` и `display:none` (`:520`) — и **никогда не вызывается `.click()`** | — | Удалить |
| 16 | **Мёртвый экспорт `printMealTimeline`** | Неограниченный `window.open` с **нулём** вызывающих | `planner-day-print.ts:376` | Удалить |
| 17 | **Мёртвый движок `strength-sport-pose-autotrack`** | Удалён в прошлом раунде | — | — |
| 18 | **FCM-push полностью мёртв** | `initNativePush` не вызывается в проде, `google-services.json` отсутствует, gradle-плагин условный, CI его не создаёт | `native-bridge.ts:160-184`; `build.gradle:70-77` | Либо довести, либо убрать зависимость |
| 19 | **`NativeOfflinePill` структурно всегда показывает 0** | Читает web-ключ `localStorage`, тогда как нативная очередь в `SharedPreferences` | `NativeOfflinePill.tsx:13-19` vs `WidgetStore.java:18-23` | Читать через `WidgetBridgePlugin` |
| 20 | **Дубль/неверная ярлыка launcher-shortcut** | `he_timer` имеет `target=training` — байт-идентично `he_training`, но подписан таймером. 2 из 3 ярлыков ведут на один экран | `shortcuts.xml:42` | Исправить |
| 21 | **Виджеты/ярлыки не покрывают все разделы** | `WidgetStore` знает только `training/nutrition/support/home`, а `DashboardNative` роутит 9 разделов ⇒ `labs/risks/pharma` недостижимы | `WidgetStore.java:32-35` | Расширить словарь |
| 22 | **Тайл воды может соврать** | `WidgetBridgePlugin.updateAll` глотает исключения; `WaterTileService` показывает успешный тост даже при сбое | `WidgetBridgePlugin.java:33-45`; `WaterTileService.java:36-50` | Проверять результат |
| 23 | **Права: ложный «тест успешен» / ложное «Отменено»** | `notifyLocal` глотает `requestPermissions()` и возвращает `true`; `pickPhoto` возвращает `null` и на отказ, и на отмену | `native-bridge.ts:66-99,301-347` | Различать `denied`/`cancelled` |
| 24 | **Тупик после постоянного отказа** | В `NativeFeaturesCard` нет кнопки «открыть настройки» (только текст в `<details>`) | `NativeFeaturesCard.tsx:106-155` | Добавить `openNativeAppSettings` |
| 25 | **Печать/экспорт с фолбэком «успех»** | см. B2 | — | — |
| 26 | **Инъекции в `V7RiskDisplay` — мёртвые импорты** | `runV7Simulation`, `V7RiskInput`, `getGlobalNoLabs`/`getNoLabsSystems`, `levelLabel` (все ветки `''`), `fmtDec`, `getOrgGrad` (возвращает константу, отбрасывает аргумент) | `V7RiskDisplay.tsx:5,8,143,145-148,514-518` | Удалить |

---

# БЛОК B15 — Мёртвый код и дубли

**Приоритет P2 · 2–3 дня**

| Находка | Объём | Доказательство |
|---|---|---|
| `usda-foods.ts` | **5,28 МБ** | **Поправка: не мёртвый** — `useDiarySearch.ts:18-20`, `NutritionScreen.tsx:307` (динамический импорт, `slice(0,5000/2000)`). Решение: чанковать/сжать, не удалять |
| `GENERAL_MECHANISMS` | дубликат `MECHANISM_INFO` побайтно, **и в нём клиническое утверждение, которого в живой таблице нет**: «Оксандролон > холестаз» (оксандролон — один из наименее гепатотоксичных 17α-алкилированных) | `core/risk-info.ts:31-39` vs `:43-51` |
| Недостижимые данные систем | `immunity`/`thyroid`/`prostate`/`skin` — движок V7 их не производит | `core/risk-info.ts:73-76` |
| 35 файлов отладочного мусора под уже действующими `.gitignore` (563 КБ; `tmp_scripts/` — 67%) | `.gigacode/`, `tmp_scripts/`, `_tools/`, `test_dir/`, `.kilo/`, `scratch/`, `.tmp-*.txt` | Правила есть (`.gitignore:32,40`), файлы **уже закоммичены** ⇒ нужен `git rm --cached` |
| **3 тест-файла с нулём `expect()`** | `zz-meta-alt-probe.test.ts` (8 `it`, 100% вакуумные), `_tmp-csv-debug.test.ts`, `zz-pro5-dbg.test.tsx` | — |
| **Тесты пишут отладку в корень репозитория** | `require('fs').writeFileSync('.tmp-c2dbg.txt')` в `planner-recipe-quality.test.ts:68`, `planner-variety-guarantees.test.ts:99` — выполняется на обычном `npm test` | — |
| **4 самопрекращающихся набора** | `bb-cycle-program-factors.test.ts:30`: `if (!prog) it.skip(...) else { /* 90+ ассертов */ }` — при исчезновении `531_bbb` набор **тихо схлопывается в пустой skip**. То же в `bb-cycle-program-ped.test.ts:205,265,334` | — |
| **6 «сиротских» компонентов, которых держат только smoke-тесты** | `ExerciseCalcTab.tsx:317`, `QualityJointHub.tsx:14`, `ExerciseGenerator.tsx`, `InsightsCard.tsx:17`, `MRVEstimatorTab.tsx:96`, `PeakingProtocolsTab.tsx:34`, `PeakingProtocolTab.tsx:26`, `VisualTab.tsx:31` — 6 из 8 держатся **только** на том, что `rest-hooks-native.test.tsx` проверяет наличие `data-*` хука. **Тесты зелёные, а код выполниться не может** | — |
| `AdCheck` | экспортируется, **0 ссылок**, содержит нативный `<input type="checkbox">`; гард-тест `arm-switch-sheet` проверяет конструктор, а не кит | `arm-design-system.tsx:211-226` |
| `QualityDiagnosticsHub` | мёртвый дубль: `TrainingScreen.tsx:37` монтирует `QualityHub`, оба оборачивают `CalcQualityTab` | — |
| `training-ui.tsx:25` `tapMinHeight: 38` | мёртвая конфигурация — её можно случайно внедрить на 38px | — |
| `engines/weight-photo-store.ts:43,45` | `console.log('[weight-photo-store] … isTestEnv:', …)` **в проде** | — |
| `risk-engine-tz.ts:331,344,332,345` | дубли `NAC`/`nac`, `TUDCA`/`tudca` — половина недостижима | — |
| **2 write-only ключа** | `he_weight_log_archive` (`profile-store.ts:18`, пишется в 2 местах, читателя нет), `he_cardio_kcal_note` (`manual-storage.ts:19`, пишет `planner-bridge-handlers.ts:812`) | — |
| `@ts-nocheck` **41** — все в `SupportScreen_parts/` | файлы **невидимы** для компилятора | — |
| `as any`-семейства **11 713** в 704 файлах | Топ: `bb-finalize.engine.ts` **985** (план финализации — тихая ошибка формы вместо краша), `meal-plan-engine.ts` 766, `IndividualPlanContext.tsx` 600, `bb-builder.engine.ts` 297 | — |

**Политика:** не делать массовое снятие `export` (churn без пользы) — удалять только то, что доказанно мертво; тест-онли экспорты помечать `@deprecated` с причиной.

---

# БЛОК B16 — Доступность (a11y)

**Приоритет P2 · 2–3 дня**

| # | Дефект | Доказательство |
|---|---|---|
| 1 | **Кликабельные точки 6×6px без `role`/`tabIndex`/`aria-label`** — недоступны ни пальцем, ни для AT | `V7RiskDisplay.tsx:218-224` |
| 2 | Точки недели 10×10px: `role="button" + tabIndex + Enter/Space` есть (a11y верно), но **хит-область не увеличена** | `WeeklyRiskChart.tsx:157`; `styles-native.css:5342` даёт только `:focus-visible` |
| 3 | 84 полосы в полосе 36px ⇒ ~2–3px на полосу — декоративно | `V7RiskDisplay.tsx:426-437` |
| 4 | `InfoErrorBoundary` **показывает пользователю сырой стек компонентов** и **не имеет кнопки «повторить»** | `SupportScreenData.tsx:1000-1004` |
| 5 | `NativeFab` закрывается только по `Esc` | `NativeFab.tsx:49-50` |
| 6 | Инструкции к 3D говорят «mouse»/колесо — в touch-only WebView бессмысленно | `TZRisk3DModel.tsx:1084-1085` |
| 7 | Контраст акцента на светлом фоне 1.11:1 | см. B9.1 п.2 |
| 8 | `outline:` литералом 171 раз при 1 токене; фокус в целом ОК (глобальный `*:focus-visible` `styles.css:859` + `input:focus` `:1164-1166`) | — |
| 9 | 1676 `toBeTruthy()`; 21 тест-файл ≥60% слабых ассертов (худшие: `ta-diagnostics-v4-ui` 100%, `taper-coach-card` 100%, `mix-diary-legacy` 100%) | — |

---

# БЛОК B17 — Функциональные улучшения, которые я вижу сразу (P1/P2)

**Пункт 4.2 просил: «если сразу видишь, что можно сделать качественнее — пиши сразу в план».** Ниже — то, что видно без дополнительного исследования.

## B17.1 Навигация

- **Экран без кнопки «назад» и без ориентации.** `Tab` = 10 участников, `PRIMARY_NAV` = 7 (`:74-82`). `marketplace`, `profile`, `articles` — только через `handleNavigate`. У `MarketplaceScreen` (`:411`) и `ArticlesScreen` (`:413`) **нет пропа `onNavigate`**, и grep по `Назад|onNavigate|←` даёт **0 совпадений**. Пользователь, попавший по диплинку, не имеет возврата; при этом ни одна кнопка нижней ленты не получает `.active`/`aria-current="page"` (`:465-466`).
  **Фикс:** `onNavigate` + кнопка «Назад» на обеих; `aria-current` для off-pill экранов.
- **Тап по активной вкладке пересоздаёт весь экран.** `App.tsx:292-293` (`setScreenKey(k => k+1)`) + `:402` (`key = screen-${tab}-${subTab}-${screenKey}`) ⇒ **несохранённый ввод, открытые модалки и идущая тренировка теряются**. Комментарий `:289-291` говорит, что это нужно для `initialSubTab`.
  **Фикс:** применять remount **только** при `subTab !== null` (реальный диплинк), иначе — no-op.
- `useCallback` зависит от `tab` (`App.tsx:300`) ⇒ быстрый двойной свайп может использовать устаревший `tab`. ⚠️ Низкий риск.

*(Позитив: карта `NAV_TARGETS` полна — все 45 записей проверены, все `subTab` обрабатываются. `SupportScreen.tsx:132` корректно даёт приоритет диплинку над сохранённой позицией.)*

## B17.2 Границы ошибок

`App.tsx:389-416` оборачивает в `InfoErrorBoundary` **только Labs** (`:408`). Остальные **9** экранов — без защиты; глобальный обработчик (`core/error-handler.ts`) отключает оверлей после `markBooted()`. **Любой throw = белый экран без восстановления.**
**Фикс:** обернуть все 10; добавить «Повторить» + «На главную» в границу.

## B17.3 Напоминания (сделать «Расписание инъекций» настоящим)

Не только подключить `scheduleWeeklyReminders` (B14 #1), но и:
- привязать к `notifyLocal`/`scheduleWeeklyReminders` в `InjectionDiary`;
- кнопка «напоминать по расписанию» с явным состоянием вкл/выкл;
- тумблер «Уведомления» в профиле (сейчас write-only, B13.2) **начинает управлять этим** — тогда он перестаёт быть ложью;
- обрабатывать `denied` честно (B14 #23) и давать путь в настройки (B14 #24).

## B17.4 Синхронизация в АПК — обещание ≠ reality

`ProfileSettingsTab.tsx:232-238` обещает синхронизацию «в Telegram **и АПК**», а в АПК её нет (`he_crypto_key` исключён из синка). **Либо реализовать, либо убрать обещание** — сейчас это ложь в UI.

## B17.5 Диагностика покрытия APK-хуков

106 `data-*` без правил — часть метаданные, часть реальные пробелы. **Нужен воспроизводимый скан** (с учётом одинарных кавычек!), чтобы превратить это из «подозреваемых» в список. Выдать как `docs/APK-HOOK-COVERAGE.md` и подключить в гейт (B0.1 п.7).

## B17.6 Дизайн-система: перестать «латать симптомы»

Главный разрыв качества: 95% UI — инлайн-стили, поэтому APK-слой может только «латать». **Предлагаю:** начиная с Block B1, вводить **обязательный шаблон новой/изменяемой поверхности**:
1. Разметка — семантические классы/хуки (никаких «магических» инлайнов для layout).
2. Стили — токены из `styles-native.css:3484-3502`.
3. Контролы — только из китов (`PopupXxx`, `AdSwitch`, `BbRowSwitch`, `CbSwitch`, `StrengthSwitch`).
4. Экспорт — только через `apk-share`.
5. Проверка — новый source-guard тест на файл.

Это медленнее, но только это даёт **системное** решение вместо 20 волн «по файлу».

## B17.7 Диагностика, кнопки и «показано = применяется»

Сквозная ревизия (по образцу уже сделанного для RiskInfo): найти все числа/подписи/«рекомендации», которые **не выводятся из своих же строк**:
- заголовки про «18 систем», «механизмы», «анализ»;
- «почему такой балл» без разбивки;
- кнопки «Применить», которые не применяют (см. B14 #10).

## B17.8 Мобильный UX — что стоит сделать сверх правок

- **Длинные действия одним тапом без подтверждения** (сброс профиля, очистка всех дневников, удаление плана) — на телефоне это стоимость ошибки. Унифицировать `ConfirmDialog` (B4.1) + для необратимых — требовать ввод слова/двойного подтверждения.
- **Длинные списки без снапшота/section-list** — профиль/дневники/циклы; на Android 400+ элементов заметно скроллятся тяжелее.
- **Пустые состояния** — единый компонент вместо разных «пустых» текстов (часть экранов пуста без объяснения, что делать).
- **Offline-индикатор** — есть `NativeOfflinePill`, но он структурно всегда 0 (B14 #19) ⇒ пользователь не видит, что данные не синхронизируются.

---

# БЛОК B18 — Адаптив 320–400px

**Приоритет P1 · 2 дня**

- `styles-native.css` имеет **83** блока `max-width:380px` — 360px там в целом ОК. **`styles-native-labs.css` — только 480px; `styles-native-pro.css` — ни одного.**
- **26** инлайновых фиксированных ширин ≥300px в TSX (600/520/500/480/460/420/380/340/324/300).
- Мёртвый кейс-фикс узкой сетки фармы (camelCase) — B8.1.
- **Сильный пример:** `CombatPlanView.tsx:372` (`64px 64px 64px 1fr auto`) корректно схлопнут в `1fr 1fr 1fr` на ≤380px (`styles-native.css:10978`), кнопки переносятся на всю ширину (`:10982-10991`).
- **Не сделан:** `StrengthSportPlanView.tsx:244` (`76px 76px 76px auto`) — ни правила, ни `≤380px`-блока (`styles-native-strongman.css:335-339` стилизует только радиус/границу/тень; единственный брейкпоинт файла — `:489`). **На 360px строка прокручивается по горизонтали.**
- Слайдер `PopupNumber` 4px (B6.2); таблица 7 дней × приёмы с 7px-заголовками и горизонтальным скроллом без класса (`IndividualPlanResults.tsx:1159-1165`); лента действий приёма из 7 чипов 40px в `nowrap`-скролле (`MealListRender.tsx:396`).
- CSS-базлинь противоречит JS: `vite.config.ts:83` целится в `es2019`/Chrome-63, а CSS использует `:has()` (5 мест), flexbox `gap` (84/242), `backdrop-filter` (76/267), `inset` (87/17), `content-visibility`, `aspect-ratio`. **JS понижен для старых телефонов, CSS — нет.**

---

# БЛОК B19 — Тесты и CI-качество

**Приоритет P2 · 3–4 дня**

- **1 282 тест-файла, 37 758 `expect()`.** Качество суммарно хорошее (96,6% содержательных ассертов) — проблема **точечная**.
- **Покрытие (статический прокси):** `engines/` 306 файлов / 160 упомянуты; `TrainingScreen_parts` 256/144; `core/` 62/26; `ui/components/` 21/**2**; `ui/screens/` (верхний уровень) 24/**1**; `data/lms-cycles/` 109/**0**; `data/cardio-cycles/` 26/**0**.
- **Провакантный гард:** `profile-deep-links.test.tsx:23,31,40` проверяет лишь **наличие** записи в `NAV_TARGETS`, но **не монтирует** принимающий экран ⇒ не способен обнаружить, что экран игнорирует значение. То же по смыслу: 6 «сиротских» компонентов из B15, которых держат только smoke-тесты.
- **Требование к новым тестам (в правила проекта):**
  1. тест на **поведение**, а не наличие `data-*`;
  2. тест, который **падает** при откате фичи (мутационная проверка обязательна — см. историю проекта);
  3. `data/lms-cycles/` и `data/cardio-cycles/` — хотя бы smoke на форму/валидатор;
  4. `ui/components/` (21 файл, 2 теста) и верхнеуровневые экраны (24/1) — приоритет покрытия B1/B2.

---

# БЛОК B20 — Документация и готовность к публикации

**Приоритет P2 · 1–2 дня**

| # | Задача |
|---|---|
| 1 | **`docs/NATIVE-APP.md` неполон и частично неверен:** нет ни слова про link-коды и про шифрование; §10.3 обещает синк в АПК (не работает). Переписать по факту (B11, B17.4) |
| 2 | **Play/RuStore-метаданные вне репозитория** — проверить: имя, описание, политика конфиденциальности (приложение синхронизирует по Telegram-ID в Supabase!), рейтинг, возрастная аудитория, обоснования `REQUEST_INSTALL_PACKAGES` и `USE_BIOMETRIC` |
| 3 | **Ротация утёкших кредов:** Supabase anon key, admin-password, Telegram bot token, `VITE_CRYPTO_KEY` — все считаются публичными (B11) |
| 4 | **Убрать `VITE_ADMIN_*` из бандла** (B11.3) |
| 5 | `android-apk.yml:1-5` — устаревший заголовок («подписанный release — отдельным шагом», хотя полноценный release-job есть на `:94-169`) |
| 6 | `android-apk.yml:208-218` — публикуются **и** debug, **и** release APK; отладочный APK с debug-подписью попадает в публичный релиз (выбор ассета корректен, риск публикации ненужного артефакта) |
| 7 | `dist-native/` — устаревший остаток, упомянут только в `check-apk-workflow.mjs`; его 4 CSS-файла **не содержат** arm/support/strongman/labs |
| 8 | Комментарий-ловушка: `AGENTS.md` предостерегает, что цитирование «испорченного» текста (U+FFFD) ломает source-гарды — при добавлении плана в AGENTS **не копировать** битые строки |
| 9 | **Правило-ловушка из п.8 уже нарушено в живом коде: 9 файлов содержат U+FFFD** (замер с финальной сверке) — `core/ocr-engine.ts`, `data/drug-drug-interactions.ts`, `SupportScreen_parts/UnifiedSynergyCalculator.tsx`, `TrainingScreen_parts/DiaryAnalyticsView.tsx`, `DiaryProgressView.tsx` + 4 теста. Часть — в APK-достижимом UI ⇒ риск показать мусор пользователю. **Вычистить, добавить гейт «0 U+FFFD в `src/`» (B0.1)** |

---

# 3. Порядок выполнения

## Волна 1 — «Фундамент» (P0, 1–2 недели)
Порядок жёсткий: каждый следующий блок опирается на предыдущий.

| # | Блок | Почему в этом порядке |
|---|---|---|
| 1 | **B0** (гейт + CI + версия) | Без гейта всё дальнейшее не защищено; без версии релиз не выйдет |
| 2 | **B3** (порталы) | Ломает 46 контролов; B1.2 требует порталов |
| 3 | **B4** (стек оверлеев + «Назад») | Поверх порталов — единственный общий слой |
| 4 | **B1** (примитивы `PopupDate`/`PopupTime`/`StrengthSwitch` + перевод мест) | Разблокирует B5/B6 |
| 5 | **B2** (экспорт/печать/поделиться) | Изолирован, высокая отдача (≈60 мест) |
| 6 | **B11** (безопасность) | Изолирован; B0-версионирование уже сделано |
| 7 | **B12** (движки риска) | Изолирован; влияет на доверие к цифрам |

**Результат волны:** все действия в АПК работают; «Назад» корректен; экспорт доходит; риск-цифры честны; релиз собирается.

## Волна 2 — «Тактильность и читаемость» (P1, 1–2 недели)
**B5** (44px) → **B6** (16px + слайдер) → **B7** (safe-area) → **B9** (темы) → **B8** (покрытие хуков) → **B18** (адаптив) → **B17.1–17.2** (навигация + границы) → **B17.3–17.4** (напоминания, синк-обещание) → **B10** (производительность)

Порядок внутри: B5 и B6 — **точечные** правки, их дёшево делать пачкой по зоне, и они дают немедленный ощутимый эффект. B8 — большой объём, делать после того как токены/правила стабилизированы (иначе перепишем).

## Волна 3 — «Целостность» (P1/P2, 1–2 недели)
**B13** (данные/квота/даты) → **B14** (неработающие функции) → **B15** (мёртвый код) → **B16** (a11y) → **B17.7** (честность цифр) → **B19** (тесты) → **B20** (доки/магазин)

---

# 4. Проверка качества по волнам

Обязательный минимум на каждой волне (иначе опыт проекта уже показал, что «зелёный» гейт проходил при сотнях нарушений):

```powershell
# 1. Типы
$env:NODE_OPTIONS="--max-old-space-size=8192"; npx tsc --noEmit        # ожидается EXIT=0

# 2. Гейты (должны стать строже после B0.1)
npm run verify:apk-design
npm run verify:apk-ci

# 3. Тесты затронутой зоны
npx vitest run --pool=forks <папка зоны>

# 4. Сборка
npm run build
```

**Обязательная мутационная проверка для каждого нового guard-теста:** откат фичи должен **ронять** тест. В истории проекта уже зафиксировано, что «вакуумный» тест (проверяющий только наличие строки) проходил зелёным при сломанной логике.

---

# 5. Сводные метрики «до → после»

| Метрика | Сейчас | Цель |
|---|---|---|
| `tsc --noEmit` | 0 ошибок | 0 (держать) |
| `verify:apk-design` зелёный при нарушениях | да | нет (после B0.1) |
| Файлов нативного CSS под гейтом | 3 из 7 | 7 из 7 |
| Нативный `<select>`/checkbox/date/time в APK | ~30/14/11/4 | 0 |
| Строк TSX с тач-таргетом <44px | ~390 (сумма инвентаря B5.2) | 0 (кроме обоснованного белого списка) |
| Полей <16px | ~520 | 0 (или 1 исключение с обоснованием) |
| Мест экспорта в обход `apk-share` | ~60 | 0 |
| Ложных «успехов» при экспорте | 4+ зоны | 0 |
| Диалогов в обход системы | ~55 | 0 |
| Оверлеев без закрытия по «Назад» | 27 | 0 |
| Экранов без error boundary | 9 | 0 |
| Фиксов версии релиза | нет | автоматический |
| `initial` JS | 25 092 КБ | ≤5 МБ |
| Диалогов под `backdrop-filter` (fixed ломается) | 46+ | 0 |
| Веществ, где таблица поддержки перезаписана движком | 83 | 0 |
| Правил `!important` в нативном CSS | 5 580 | тренд вниз; не кампань-скип |
| Тест-файлов под `require('fs')`-отладкой | 2 | 0 |
| Файлов нулевых ассертов | 3 | 0 |
| Тумблеров write-only | 2 | 0 |
| Недостижимых строк UI-справки/фич | 5+ | 0 |

---

# 6. Что НЕ делать (границы)

1. **Не менять математику планировщиков** (MEV/MAV/MRV, фазы, капы, объёмы) ради «улучшения» — это отдельные задачи с lock-тестами.
2. **Не снимать массово `export`** из движков (churn). Политика: удалять только доказанно мёртвое; тест-онли — `@deprecated` с причиной.
3. **Не «оптимизировать» `backdrop-filter` глобально** — он нужен для визуала; чинить точечно (B3) и через порталы.
4. **Не ослаблять гейт**, добавляя исключения вместо исправления кода.
5. **Не трогать чужой WIP.** Список плавает — параллельные агенты коммитят и откатывают прямо во время работы (за сеанс он менялся трижды: `bb-types.ts` вошёл, `BbAutoConstructor.tsx` вышел). Поэтому **не полагаться на записанный список**: перед каждой правкой выполнять `git status --short`, оставлять чужие файлы как есть, коммитить — строго по pathspec своих файлов.
6. **Не запускать `git checkout .`** — в истории проекта это уже стирало незакоммиченные правки дважды.
7. **Правки контента — только Edit/Write-инструментом** (PowerShell-перезапись портит кодировку кириллицы; это зафиксировано в правилах проекта и стоило нескольких инцидентов).

---

# 7. Приложение A — Проверено-корректно (НЕ РЕГРЕССИРОВАТЬ)

Агенты нашли ряд мест, которые **выглядят** дефектами, но корректны. Их поломка — регресс.

| Что | Где | Комментарий |
|---|---|---|
| **Bottom-clearance Главной** | `styles-native.css:430-441` | `.native-home-landing` несёт `padding-bottom: calc(var(--nav-height) + max(env(bottom),28px) + 20px)`. **Два независимых аудита ошиблись** — закрыто проверкой (✓ верифицировано) |
| Планировщик питания: печать/экспорт | `planner-day-print.ts:213-234` | Правильно ветвится по `isCapacitorNative()`; 8 мест вызова безопасны |
| Статьи: PDF-экспорт | `ArticlesScreen.tsx:721-759` | `saveBlobApk` на нативе — эталон |
| Арм-хабы: печать | `ArmDiagnosticsHub.tsx:1052`, `ArmliftingDiagnosticsHub.tsx:718` | `printHtmlApk` — канон |
| Экспорт через native bridge в `LabsScreen`/`PharmaReportsTab`/`MetabolicHub` | `LabsScreen.tsx:38,1329,1482,1512`; `PharmaReportsTab.tsx:7,72`; `Shared/MetabolicHub.tsx:809-810,1515-1516` | Через `planner-day-print.ts` |
| Классные тосты подняты над пилюлей | `styles-native.css:4939-4945` | **Образец** `!important`-якоря против инлайн-стиля |
| `sessionTrimps`/`sessionShare` и прочее в combat | — | В combat-нативные гейты уже соблюдены |
| `DbDiary` зум-гард | `BPDiary.tsx` | Корректный `@media (pointer: coarse)` → 16px |
| `PopupXxx.fieldInput` 16px/44px, `ProfileScreen_v2/ui.tsx:324-335` `inputBase` | — | Правильные базовые значения |
| Combat: 13px-поля и сетка 360px | `styles-native.css:10727-10731`, `:10977-10991` | **Спасены APK-CSS** — скан только по исходнику дал бы ложное срабатывание |
| `combat-planview` APK-покрытие | `styles-native.css:10814-11021` | 43 селектора, включая `:active`, `:focus-visible`, реальный `≤380px` |
| `styles-native-strongman.css` реально грузится | `useStrengthSportWizard.ts:20,224`; `StrengthSportConstructor.tsx:748` | `.train-strong ss-apk`; использует **одинарные кавычки** `[data-ss='…']` — наивный скан их не видит |
| Киты: `BbRowSwitch`/`BbToggleChip` 44px, `CbSwitch`, `AdSwitch`, `CardioUI.INPUT`, `StrengthUI.SELECT` | — | Компоненты комплаентны; проблема — **неприменение** |
| `DiaryRecordingForm` — debounce персиста | `:104-109` | Образец для B10.2 |
| `workout-logger.engine` — каскадная обрезка квоты | `:163-184` | Образец для B13 |
| `diary-storage.saveDiaryEntries` | `:36-52` | Образец квотно-безопасной записи |
| `profile-manager` / `manual-storage` / `combat-storage` — обработка `QuotaExceededError` | `:219-234`; `:44-97`; `:21-51` | Чист, ретраит, `console.error`, **rethrow/false** |
| Даты: `local-date.ts` | `:21-35` | Локальные компоненты + локальный `setDate` — корректно |
| `db-encryption` (PBKDF2-SHA-256 @100k + AES-GCM-256) | `:1-28` | Верный выбор крипто; проблема только в тихой деградации |
| Глубокие ссылки | `App.tsx:95-160` | Все 45 записей работают |
| APK не требует Telegram | `app-platform.ts:8-27` | Синхронизация не запирает пользователя |
| `RiskInfo.tsx` — честная справка | `:194-196,:325-329,:391` | «18 систем, описано 14», RSS + среднее |
| NaN-гарды в риск-движке | `risk-engine-tz.ts:499,504-509,513-516` | Настоящие и рабочие |
| `risk-engine-tz-spec` RSS/полы/синергии | — | Математика корректна (зафиксировано предыдущими раундами) |
| `cloud-kv` anti-отскок (dirtyDuringPull, LWW) | — | Корректно |
| `smart_update`/`offline` APK-контур | `main.tsx:161-181` | APK осознанно без SW — правильно |

---

# 8. Приложение B — Поправки к утверждениям агентов (честность)

Агенты — сильный инструмент, но их выводы я перепроверял. Вот где я **не согласился**:

| Утверждение агента | Вердикт | Основание |
|---|---|---|
| «`usda-foods.ts` (5,4 МБ) полностью недостижим, `extraCatalog` никогда не передаётся — мёртвый вес» | **НЕВЕРНО** | `useDiarySearch.ts:18-20` и `NutritionScreen.tsx:307` динамически импортируют его. Проблема реальна (5,28 МБ чанк), но это **не dead code** |
| «`.native-home` без `padding-bottom` → низ Главной под пилюлей» | **НЕВЕРНО** (дважды) | `styles-native.css:430-441` — корректный отступ на скроллящем потомке |
| «`data-intel` — 0 правил в нативном CSS» | **УСТАРЕЛО** | 5 правил в `styles-native.css:14192-14205`; аудит-10 опроверг |
| «combat 64px×3 сетка переполняется на 360px» | **НЕВЕРНО** | `styles-native.css:10978` схлопывает в `1fr 1fr 1fr` |
| «combat 13px-поля — нарушение» | **НЕВЕРНО для APK** | `styles-native.css:10727-10731` поднимает до 48px/16px |
| «combat-нативные контролы — 78/80 не покрыты CSS» | **НЕВЕРНО как сформулировано** | Скан был по двойным кавычкам; `styles-native-strongman.css` использует одинарные. Перед правками нужен корректный пересчёт |
| «3 959 «молчащих» catch = системная потеря данных» | **ПЕРЕУСИЛЕНО** | Проверено: по паттерну «возврат значения / событие квоты / задокументированный фолбэк» сделано последовательно. Настоящая проблема — **наблюдаемость** |
| «671 экспорт без ссылок» | **ТРЕБУЕТ РУЧНОЙ ПРОВЕРКИ** | Частотный скан не видит строковые/динамические обращения; `he_combat_vbt_log` уже оказался ложным срабатыванием |

---

# 9. Приложение C — Открытые вопросы (нужен прогон, а не чтение)

| # | Вопрос | Как закрыть |
|---|---|---|
| 1 | Каков фактический вес на 360px у всех ≥300px фиксированных ширин | Рендер-скриншоты/измерения в devtools-эмуляции, а не чтение кода |
| 2 | Реальная частота кадров 3D-риск-модели на среднем Android | Профилирование на устройстве (в проекте нет Playwright/Cypress — только jsdom + маркерный чекер) |
| 3 | Подтверждается ли визуально дефект шитов (B3) | Отрендерить `CombatPopupSelect` открытым и проверить `getBoundingClientRect` оверлея относительно вьюпорта |
| 4 | Сколько из 106 непокрытых `data-*` — реальные визуальные пробелы | Поэлементный аудит (B17.5) |
| 5 | Сколько `as any` реально скрывают баги vs безобидны | Инкрементально, по топ-10 файлам; `bb-finalize.engine.ts` (985) — первым |
| 6 | Мёртв ли `AdCheck`/`tapMinHeight: 38` в каком-либо неотслеженном WIP | Проверка перед удалением (чужой WIP не трогать) |
| 7 | Есть ли ещё 3-тактные самопрекращающиеся наборы кроме 4 найденных | Скан `if (...) it.skip` по всем тестам |
| 8 | Что реально в `dist/` (может быть устаревшим) | Пересобрать и замерить после B10.1 |

---

# 10. Итог

**Приложение функционально богатое и в основном корректное по расчётам.** Базовая инфраструктура APK тоже на месте: нативный мост с честными фолбэками, 7 стилевых слоёв, самообновление, виджеты, биометрия, push-инфраструктура, `verify:apk-design`, 1 282 тест-файла, `tsc` = 0.

**Проблема не в том, что чего-то нет, а в том, что нет СИСТЕМЫ:**

1. Гейт проверяет 3 файла из 7 и 1 класс из всех — поэтому он зелёный при сотнях нарушений.
2. Дизайн-система объявлена, но не используется (1 использование токена против 266 литералов) — поэтому правила приходится латать точечно.
3. Нативные примитивы есть, но не навязаны — поэтому 30 `<select>` и 14 checkbox дожили до релиза.
4. `backdrop-filter` в карточке ломает `position: fixed` шита — поэтому 46 контролов выбора в 2 конструкторах позиционируются неверно.
5. Один `backButton`-подписчик без стека — поэтому «Назад» выкидывает из 27 диалогов.
6. Один токен безопасности выводится из публичного бандла — поэтому «аутентификация» обходится.

**Порядок работ определён: сначала починить гейт (иначе ничего не проверить), потом примитивы (потому что от них зависят 4 следующих блока), потом тактильность/читаемость, потом целостность данных и мёртвый код.**

План рассчитан на **5–7 недель** работы одного агента с постоянной верификацией на каждой волне.
