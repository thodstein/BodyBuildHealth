# Аудит проекта — Jun 23 2026

## ✅ Выполнено (Phase 1–7 + все подфазы)

**Phase 1 (Critical UI Fixes):** Все 7 — слияние тренировок, удаление дубликатов, 2-колонки в LabsScreen, синергии в UI, агрегация рисков, отдельная поддержка, кнопки без анализов

**Phase 2 (Data & Calculations):** Все 6 — PAL, TDEE, макросы, микронутриенты, trainingLoadRatio

**Phase 3 (Food & Nutrition):** Все 4 — БД 150+ продуктов, КБЖУ графики, OCR, Open Food Facts

**Phase 4 (Training Overhaul):** Все 5 — RIR matrix, split selector, progression, diary v6, TrainingScreen

**Phase 5 (Research):** Все 3 — ссылки в фарме, БАДах, описания механизмов

**Phase 5.8–5.10:** без анализов, штрафы, PK/PD, андрогенный индекс, синергии, PCT, взаимодействия

**Phase 5.11 + 6:** 2164 вещества, 206 интеракций, 40 веществ заполнены, грибы/anti-aging/ноотропные пары

**ProfileScreen diary:** Все 12 карточек, сон (форма+график), давление (форма+график+архив), замеры (форма+фото+история), отчёты (4 типа + архив) — **работают**

**Reports:** Все 4 блока сохраняют в archive + current — цепочка работает

**Support plan:** Сохраняется, «О подборе» — отдельная подвкладка

## ✅ Исправлено в этой сессии (23 Jun)

### Баги
- ✅ `IndividualPlan.tsx:1764` — `generateNutritionReport()` обёрнут в try-catch
- ✅ `ProfileScreen.tsx:2034` — добавлен `he_nutrition_report_archive` в агрегацию архивов
- ✅ Стандартизированы ключи localStorage: `he_labs_report_current` → `he_lab_report_current`; `he_risks_report_current` → `he_risk_report_current`; `he_course_reports` → `he_pharma_reports`

### Функциональность
- ✅ `SupportScreen.tsx:1446` — починено авто-назначение ХГЧ при ААС (исправлены имена классов: `stanozolol`/`oxandrolone`/`methandienone` → `oral_17aa`, добавлен `sarm`)
- ✅ `data-link.ts:191-236` — перестроен порядок: сначала `calculateSupport()`, результат передаётся в `calculateRisks()` как `supportCoverage`

### UI/UX
- ✅ `FertilityPCTScreen.tsx` — карточки анализов переведены на одноколоночный макет (`flexDirection: column` вместо `grid 1fr 1fr`), увеличены отступы

## 🗑️ Орфаны — 11 осталось на рассмотрение

### Удалено
- ✅ PctScreen.tsx — полный дубль FertilityPCTScreen
- ✅ FullIntegrationScreen.tsx — дев-тест стенд
- ✅ IntegrationsScreen.tsx — все моки, ни одного реального API
- ✅ ReportsScreen.tsx — дубль инлайн-генераторов отчётов

### Подключено во вкладку «Разбор»
- ✅ CalculatorsScreen (509 строк) — 14 калькуляторов
- ✅ SubstancesScreen (152 строк) — справочник фармы с PK/PD
- ✅ PeptidesScreen (160 строк) — калькулятор пептидов
- ✅ SmartAssistantScreen (303 строк) — чат-ассистент
- ✅ RoleManagementScreen (396 строк) — управление ролями

### Оставлено на пересмотр
- **RecoveryScreen** (408 строк) — 7 эксклюзивных движков по восстановлению
- **TrainingToolkitScreen** (273 строк) — 10 эксклюзивных движков по тренировкам
- **PerformanceScreen** (151 строк) — 3 эксклюзивных движка (маркеры, стеки, периодзация)
- **PredictiveAnalyticsScreen** (426 строк) — what-if сценарии, Holt-модель
- **GamificationScreen** (154 строк) — trust score, ачивки, XP
- **PlanScreen** (1215 строк) — генератор плана тренировок (частичный дубль TrainingScreen)

### 12 файлов `_parts/` не импортированы
- PlanScreen_parts/* (5), ProfileScreen_parts/FriendsSection, RiskScreen_parts/RiskMatrix, LabsScreen_parts/LabsCatalog + LabsOverview, NutritionScreen_parts/NutritionCustomFood + NutritionMealGen + NutritionOverview

### 23 orphan engine, 18 chain-dead engines, 6 data, 14 core, 13 UI, 4 workers

## 📏 Разбитие файлов до 1000 строк

### >1000 строк (требуют разбития)

| Файл | Строк | План разбития (на какие части) |
|------|-------|--------------------------------|
| SupportScreen.tsx | 7 773 | По табам: каталог, взаимодействия, стеки, расчёт, план, избранное, ПКТ/фертильность → 6-8 файлов |
| IndividualPlan.tsx | 3 844 | На 3-4 части: план питания, рецепты, отчёт, настройки |
| PharmaScreen.tsx | 2 807 | На 4-5 частей: каталог, калькулятор, PK/PD, курс, отчёты |
| ProfileScreen.tsx | 2 330 | Вынести BP diary, Sleep diary, Measurements, Reports в отдельные файлы |
| FertilityPCTScreen.tsx | 1 987 | На 3 части: ПКТ-гид, HRT-гид, Фертильность-гид + анализы |
| RiskScreen.tsx | 1 554 | Уже хороший split (6/7 parts), но оставшееся ~700 строк в main вынести |
| LabsScreen.tsx | 1 485 | 3/5 parts подключены; вынести оставшееся и подключить LabsCatalog |
| NutritionScreen.tsx | 1 162 | 4/7 parts; вынести carts/logging |
| support.engine.ts | 2 113 | Разделить на core + interactions + recommendations |

### 150-1000 строк (не критично, вторая очередь)
- RiskScreen_parts: V7RiskDisplay (833), Risk3DModel (396), RiskOverview (268), RiskInfo (243), RiskDetails (216)
- NutritionScreen_parts: NutritionDiary (572), NutritionReference (345), NutritionOverview (313), NutritionMealGen (306), NutritionCharts (256)
- LabsScreen_parts: LabsInvestigations (263), LabsResults (168), LabsCatalog (157)
- ProfileScreen_parts: FriendsSection (228)
- PlanScreen_parts: PlanTraining (221)
- + 84 engines (все >150 строк)
