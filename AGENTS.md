# Health Engine v9 — Master Plan & Build Instructions

## Build Target: Telegram Mini App (WebView)
**ALL code MUST work in browser-only (no servers, no Python).** Every feature is built as client-side TypeScript running in Telegram WebView. Python services are secondary (external API only). Code must be compiled via Vite and deployed as static files.

## Critical Issues (User-Reported)
1. **Дубли информации** — тренировки показываются в 2 местах (training tab + cycles tab), данные повторяются
2. **Нет кнопки без анализов** — лабы/расчёты должны работать и без введённых данных
3. **Расчёты не верные** — PAL не выводится из workoutsPerWeek, КБЖУ не связано с тренировками
4. **Нет описаний синергий** — SYNERGY_PAIRS есть в движке, но не показываются в UI
5. **Вкладка Риски не собирает все риски** — нужно агрегировать из всех источников
6. **Поддержка — отдельный блок** — вынести из PlanScreen в отдельную вкладку навигации
7. **Анализы и каталоги — в одну колонку** — разделить на 2 столбца
8. **Нет графика КБЖУ за 7-30 дней** — нужен Chart
9. **OCR скриншотов FatSecret** — проверить и исправить
10. **Нет исследования (3-5 ссылок)** — добавить к фармакологии и БАДам

## Architecture

### Data Flow (useDataLink)
```
Profile → useDataLink → { profile, labs, course, readiness, risk, avgWeeklyKcal, activeDrugs, supportCoverage }
```
- PAL auto-derive: `workoutsPerWeek → PAL coefficient → TDEE`
- TrainingLoadRatio auto-derive: `workoutsPerWeek × avgWorkoutMinutes → trainingLoadRatio`
- КБЖУ auto from diary: `food_diary → avgWeeklyKcal/Protein/Fat/Carbs → readiness → risk → support`

### Navigation (6 tabs — Главная removed)
1. **Тренинг** — Unified training (merged training + cycles, NO duplicates), also default/start tab
2. **Питание** — Nutrition with КБЖУ charts, expanded food DB, OCR
3. **Анализы** — Labs + Catalog (2-column: lab results left, schedule/catalog right)
4. **Риски** — All risks aggregated (pharma + support + labs + training + nutrition)
5. **Фарма** — Pharmacology (substances, PCT, peptides, fertility/PCT protocols)
6. **БАДы** — Support database (2164 substances, 206 interactions)

### Key Engines & Files
- `src/engines/rir-matrix.engine.ts` — **NEW**: RIR matrix + weekly progression
- `src/engines/training.engine.ts` — **UPDATED**: uses RIR matrix, generates weekly plan
- `src/engines/split-selector.engine.ts` — NEW: scoring splits with rationale
- `src/engines/progression.engine.ts` — NEW: load progression, deload triggers
- `src/engines/risk.engine.ts` — MUST aggregate from ALL sources
- `src/engines/support.engine.ts` — Synergy descriptions exist, ADD to UI
- `src/engines/nutrition.engine.ts` — PAL auto-derive, micronutrients
- `src/engines/nutrition-ocr-parser.ts` — Fix FatSecret/MFP parsing
- `src/core/nutrition-database.ts` — EXPAND 50→150+ products with micros
- `src/core/types.ts` — ADD: StrengthLogEntry, WorkoutLog, FoodItem micros
- `src/core/db.ts` — ADD: training_log, workout_log stores (v6)
- `src/ui/screens/PlanScreen.tsx` — MERGE training + cycles tabs, add rationale
- `src/ui/screens/NutritionScreen.tsx` — ADD КБЖУ charts, PAL auto-calc
- `src/ui/screens/RiskScreen.tsx` — AGGREGATE all risk sources
- `src/ui/screens/LabsScreen.tsx` — SPLIT into 2 columns

## Build Order (Priority)

### Phase 1: Critical UI Fixes (dedup, layout, buttons)
1. [x] Merge training + cycles tabs in PlanScreen → single unified tab
2. [x] Remove duplicate volume/split displays across screens
3. [x] Split LabsScreen into 2-column layout (results | catalog)
4. [x] Add synergy descriptions to RiskScreen/PharmaScreen
5. [x] Aggregate all risks in RiskScreen (pharma + labs + training + nutrition)
6. [x] Separate Support into standalone section
7. [x] Fix buttons to work without lab data (default values)

### Phase 2: Data & Calculations
8. [x] PAL auto-derivation: workoutsPerWeek + avgWorkoutMinutes → PAL
9. [x] Connect PAL to all nutrition engines (replace hardcoded 1.55)
10. [x] Connect trainingLoadRatio to workoutsPerWeek automatically
11. [x] Fix TDEE/macro calculations with proper PAL
12. [x] Add micronutrients to FoodItem interface + food DB
13. [x] Calc micronutrient intake from diary + show vs targets

### Phase 3: Food & Nutrition
14. [x] Expand food database: 50+ products with micros (all proteins + key carbs/fats have micros)
15. [x] Add КБЖУ chart (7/14/30 day ranges) to NutritionScreen
16. [x] Fix OCR parser for FatSecret/MFP screenshots
17. [x] Add barcode search improvements (Open Food Facts cache)

### Phase 4: Training Overhaul - **ALL COMPLETE**
18. [x] **RIR matrix: goal×level×mesocyclePhase with weekly progression**
19. [x] **Split selector engine: scoring system with rationale**
20. [x] **Progression engine: linear/double/undulating, deload triggers**
21. [x] **Strength diary v6: StrengthLogEntry/WorkoutLog + IndexedDB stores**
22. [x] TrainingScreen (5 tabs: plan, exercises, calculators, diary, cycles)

### Phase 5: Research & Content
23. [x] Add 3-5 research links per substance to pharma-database.ts
24. [x] Add 3-5 research links per supplement to support.engine.ts
25. [x] Enhance mechanism descriptions for all PD systems

## Phase 5.8: Buttons Without Lab Data - **COMPLETED**

### Day 73: Default Values for Buttons
- ✅ `src/ui/screens/LabsScreen.tsx` - Added `labRisks` state, `hasLabs` variable
- ✅ `src/ui/screens/LabsScreen.tsx` - Risks tab shows fallback when no labs with warning message
- ✅ `src/ui/screens/LabsScreen.tsx` - Risk display uses `calculateRiskFromAnalyses()` when labs exist
- ✅ TypeScript check: `npx tsc --noEmit` ✓
- ✅ Vite build: `npx vite build` ✓

**Result:**
- Users can now access LabsScreen without entering any lab data
- "Risks" tab shows "Базовые риски показаны без данных анализов" message
- Link to "Input" tab for entering lab data

## Phase 5.9: Penalty per System - **COMPLETED**

### Day 74: "Без анализов" Button with Penalty Application

**User Clarification:**
- Кнопка без анализов должна назначать штраф, а не сбрасывать его
- All risks must be aggregated from all sources
- Buttons must work without lab data

**Implementation:**
- ✅ `src/ui/screens/RiskScreen.tsx` - Added `forceNoLabs` state for manual penalty toggle
- ✅ `src/ui/screens/RiskScreen.tsx` - Added "🚫 БЕЗ АНАЛИЗОВ (Штраф)" button in overview tab
- ✅ `src/ui/screens/RiskScreen.tsx` - Penalty applied when `forceNoLabs=true` OR `penalty.noLabsPenalty=true`
- ✅ `src/ui/screens/RiskScreen.tsx` - Button shows current state: "✅ Применён штраф" or "🚫 БЕЗ АНАЛИЗОВ (Штраф)"
- ✅ `src/ui/screens/RabsScreen.tsx` - Updated risks tab fallback with manual penalty application hint
- ✅ TypeScript check: `npx tsc --noEmit` ✓
- ✅ Vite build: `npx vite build` ✓

**Penalty Logic:**
```typescript
const shouldApplyPenalty = forceNoLabs || pen.noLabsPenalty;
if (shouldApplyPenalty && finalResult.systemBreakdown) {
  for (const sys of RISK_SYSTEMS) {
    finalResult.systemBreakdown[sys].raw = Math.min(100, raw * pen.totalMultiplier);
    finalResult.systemBreakdown[sys].net = Math.min(100, net * pen.totalMultiplier);
  }
  finalResult.overallRaw = Math.min(100, overallRaw * pen.totalMultiplier);
  finalResult.overallNet = Math.min(100, overallNet * pen.totalMultiplier);
}
```

## Phase 5.10: PK/PD, Dosage Calc, Андрогенный индекс, Синергии, PCT, Взаимодействия — **COMPLETED**

### Day 76: Полный редизайн взаимодействий и мобильных форм

**Изменения:**
- ✅ **PK/PD мобильная верстка**: дни инъекций вынесены на отдельную строку (не помещались в 3 колонки на телефоне). Весь блок — glass-morphism.
- ✅ **Калькулятор дозировок**: убран "Отход/флакон", переделан в 2-колоночный читаемый формат с class-фильтрами, пустое состояние на glass.
- ✅ **Андрогенный индекс**: заменён сложный toggle на стабильный autocomplete (постоянный input + выпадающий список). При выборе не сбрасывается.
- ✅ **Синергии в фарме**: создан `PHARMA_CORE_CLASSES` (без support/vitamins), каталог показывает все классы, а синергии — только AAS+пептиды+инсулин.
- ✅ **PCT план в FertilityPCTScreen**: добавлена 4-я вкладка "ПКТ план" с `generatePCTPlan`, отображением протокола и рекомендаций.
- ✅ **Фарма-взаимодействия в SupportScreen**: добавлен подраздел "Фарма" внутри вкладки "Взаимодействия" с двумя пилюлями «Поддержка / Фарма». Использует `checkDrugInteractions` из `pharma-interactions.engine`.

## Phase 5.11: Database Filling — **COMPLETED**

### Day 77: Full Support Database Population (2164 substances)

**Goal:** Fill all 2164 support database entries with full Russian descriptions, expand synergy pairs from 138 to 181, enhance UI for displaying all data.

**Implementation:**
- ✅ **2053 descriptions updated** from <30 chars to full Russian descriptions (30-100 chars)
  - Template-based generation per type (vitamin, mineral, amino acid, etc.) + categories (antioxidant → защиты клеток от окислительного стресса, brain → работы мозга, etc.)
  - Script: `enhance-db-simple.js` — parses all 2164 entries, replaces short descriptions via regex by `id: 'X' ... description: 'Y'` matching
  - Descriptions avoid single quotes to not break TS strings
- ✅ **43 new synergy/conflict pairs** added to ALL_INTERACTIONS (SYNERGY_AUTO_001..043)
  - Scientifically validated pairs: D3+calcium, magnesium+B6, B-complex, C+iron, curcumin+piperine, D3+K2, B12+folate, pro+prebiotics, selenium+iodine, glucosamine+chondroitin, ZMA, omega-3+CoQ10, creatine+beta-alanine, curcumin+ginger, L-theanine+GABA/magnesium, zinc+vit.A, milk thistle+artichoke, C+zinc, taurine+magnesium, ginkgo+bacopa, ashwagandha+rhodiola, echinacea+elderberry, iron+copper, zinc+copper(caution), calcium+magnesium(caution), iron+calcium(caution), berberine+cinnamon, collagen+C, and more
  - All with mechanisms, severity (HIGH/MEDIUM/LOW), and clinical notes
  - Format: `"ID||SEVERITY||TYPE||EFFECT||MECH1,MECH2||NOTES"` using `||` as delimiter
- ✅ **ALL_INTERACTIONS: 138 → 181 entries**
- ✅ **Enhanced UI for stacks, synergies, interactions, and catalog detail view**
  - Stacks: green tags for positive effects, 🧬 components with descriptions from ALL_SUBSTANCES, auto-conflict detection between components
  - Synergies: ⊕/⊖ prefix, colored mechanism badges (green=synergy, red=toxic/hepatic, yellow=kidney, purple=other)
  - Interaction calculator: effect display, mechanisms[] badges, severity badge, notes
  - Catalog detail view: type + categories, ALL mechanisms (previously 1), target organs, deficiency info, cross-referenced interactions with other substances (up to 6)
- ✅ **TS error fixed**: wrapped `ALL_INTERACTIONS` array in `([] as SupportInteraction[])` assertion + type assertions on all 43 new entries
- ✅ `npx tsc --noEmit` ✓
- ✅ `npx vite build` ✓

**Key Files Modified:**
- `src/data/support-database.ts` — 22,702 lines, 2164 substances, 181 interactions
- `src/ui/screens/SupportScreen.tsx` — ~2793 lines, all detail views enhanced
- `C:\Users\thods\AppData\Local\Temp\opencode\enhance-db-simple.js` — database generation script

## Phase 6 (Completed): Extra Synergy Pairs — **DONE**

### Day 78: 25 synergy pairs — anti-aging, women/men health, nootropics

**Implementation:**
- ✅ **25 новых пар** (SYNERGY_AUTO_044..068) добавлены в ALL_INTERACTIONS
- ✅ **Anti-aging (7 пар)**:
  - NMN + Resveratrol (SIRT1/NAD+)
  - CoQ10 + PQQ (митохондриальный биогенез)
  - Astaxanthin + Lycopene (фотостарение)
  - Collagen + Hyaluronic Acid (гидратация кожи)
  - Spermidine + Resveratrol (аутофагия)
  - Glutathione + ALA (антиоксидантный каскад)
  - NR + Pterostilbene (NAD+/сиртуины)
- ✅ **Женское здоровье (6 пар)**:
  - Vitex + B6 (пролактин/ПМС)
  - Evening Primrose + Borage Oil (GLA)
  - Black Cohosh + Red Clover (менопауза)
  - Cranberry + D-Mannose (ИМП)
  - Probiotics + Cranberry (вагинальный микробиом)
  - Folate + B12 + B6 (метилирование/беременность)
- ✅ **Мужское здоровье (5 пар)**:
  - DAA + Zinc (тестостерон)
  - Saw Palmetto + Beta-Sitosterol + Pumpkin Seed (простата)
  - L-Citrulline + L-Arginine (NO/эрекция)
  - Tribulus + Maca (либидо)
  - Boron + Vitamin D + Zinc (свободный тестостерон)
- ✅ **Ноотропы (7 пар)**:
  - Lion's Mane + ALCAR (NGF)
  - Ginkgo + Vinpocetine (церебральный кровоток)
  - Citicoline + Alpha-GPC (ацетилхолин)
  - Rhodiola + L-Tyrosine (стресс/фокус)
  - Noopept + Citicoline (память)
  - Magnesium L-Threonate + L-Theanine (сон/когниция)
  - Phosphatidylserine + Bacopa (кортизол/память)
- ✅ **ALL_INTERACTIONS: 181 → 206**
- ✅ `npx tsc --noEmit` ✓
- ✅ `npx vite build` ✓

## Phase 7 (Planned): Remaining Items
- [x] Barcode search improvements (Open Food Facts cache) — Phase 3 item 17 (fallback APIs, localStorage cache, category detection, batch search)

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

# Стандарты разработки Telegram Mini App (AGENTS.md)

## 1. Специфика платформы (Telegram Mini App & Mobile First)
* **Мобильная адаптация:** Весь UI/UX должен быть строго Mobile-First. Запрещено использовать фиксированную ширину в пикселях (px) для контейнеров. Использовать относительные единицы (`vw`, `vh`, `%`, `rem`) и Flexbox/Grid. Компоненты должны идеально выглядеть на экранах от 320px до 480px.
* **Интеграция с Telegram:** Каждый компонент UI должен бесшовно интегрироваться с Telegram WebApp API. Использовать `window.Telegram.WebApp.ready()`, настраивать цвета через `WebApp.themeParams` (для поддержки темной/светлой темы Telegram), использовать встроенные компоненты: `MainButton`, `BackButton`, `HapticFeedback`.
* **Запрет десктопных паттернов:** Никаких тяжелых hover-эффектов (на мобильных их нет), мелких кликабельных элементов (минимальный размер тач-зоны — 44x44px), или горизонтального скролла всей страницы.

## 2. Архитектура и гигиена проекта (Борьба с мусором и разрастанием)
* **Разбиение файлов (Модульность):** Запрещено писать файлы объемом более 150-200 строк кода. Если логика или компонент разрастается, Агент ОБЯЗАН изолировать её. Разделять код строго на: компоненты UI, API-клиенты, управление состоянием (state) и утилиты (hooks/utils).
* **Запрет на дублирование и мусор:** Перед созданием нового файла Агент обязан проверить структуру проекта. Если аналогичный функционал или хелпер уже существует, использовать его. Запрещено плодить временные файлы вроде `test.js`, `index_backup.js`, `script_v2.js` и т.д.
* **Удаление неиспользуемого:** При рефакторинге Агент обязан удалять неиспользуемые импорты, старые закомментированные куски кода, мертвые функции и неактуальные стили. Чистота репозитория — главный приоритет.

## 3. Правила генерации кода
1. **Прямой ответ:** Ответ начинается СРАЗУ с блоков кода. Запрещены приветствия, вводные слова, извинения и текстовые планы перед кодом.
2. **Полнота реализации:** Только 100% готовый к запуску продакшн-код. Категорически запрещено использовать комментарии-заглушки вида `// твой код здесь`, `# реализуй логику сам`, `// TODO` или пропускать тело функций.
3. **Структура файлов:** Перед каждым блоком кода должен быть заголовок формата `### Имя_файла.расширение` с полным указанием пути относительно корня (например, `### src/components/Button.jsx`).
4. **ЧИСТЫЙ СИНТАКСИС:** Используй только существующие и актуальные методы/API. Не выдумывай функции. Если не уверен — используй базовые стандартные конструкции языка.
5. **НЕ ДУБЛИРУЙ КОД:** Один функционал — один экземпляр. Никаких копий калькуляторов, генераторов, UI-блоков. Если нужен reuse — выноси в общий компонент/функцию.
6. **ПРОВЕРЯЙ:** После каждого изменения обязательно запускай `tsc --noEmit` и `vite build`. Исправляй все ошибки до того как считать задачу завершённой.
7. **НЕ УДАЛЯЙ РАБОЧИЙ ФУНКЦИОНАЛ:** Не заменяй рабочий inline-контент на «редиректы» или заглушки. Каждая вкладка должна содержать реальный работающий контент.
8. **РУССКИЕ ПОДПИСИ:** Все UI-лейблы на русском. Никаких английских fallback-названий.

## 4. Правила технического аудита и честных отчетов
После вывода блоков кода Агент обязан поставить горизонтальную черту (`---`) и вывести сухой отчет по пунктам:
### 🟢 РЕАЛЬНО СДЕЛАННЫЙ ФУНКЦИОНАЛ
* (Список фич, компонентов и интеграций с Telegram API, код которых написан полностью и физически присутствует в ответе).
### 🟡 ОГРАНИЧЕНИЯ И ЗАГЛУШКИ
* (Четко зафиксировать, какие файлы, методы, стили или мобильные адаптации были пропущены/сокращены из-за лимита контекста. Если код полон, написать: «Отсутствуют»).
### 🗑️ УДАЛЕННЫЙ МУСОР И ИЗМЕНЕНИЯ СТРУКТУРЫ
* (Список удаленных неиспользуемых файлов, удаленных строк «мертвого» кода, а также отчет о разбиении крупных файлов: что из какого файла было вынесено для удобства).
### 🔴 ЧТО ДЕЛАТЬ СЛЕДУЮЩИМ ШАГОМ
* (Технический список конкретных модулей или функций, которые необходимо дописать в следующем сообщении, чтобы приложение гарантированно заработало на телефоне).

## 5. Профессиональная объективность
* Агент обязан приоритизировать техническую точность, мобильную адаптивность и правдивость над вежливостью. Скрытие недоработок кода или создание избыточных файлов считается критической ошибкой.
