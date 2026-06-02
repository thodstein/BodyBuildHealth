# Health Engine v9 — Master Plan & Build Instructions

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

### Navigation (7 tabs)
1. **Главная** — Dashboard (aggregated overview)
2. **Фарма** — Pharmacology + Support (combined, 2 columns: catalog left, detail right)
3. **Тренировки** — Unified training (merged training + cycles, NO duplicates)
4. **Питание** — Nutrition with КБЖУ charts, expanded food DB, OCR
5. **Анализы** — Labs + Catalog (2-column: lab results left, schedule/catalog right)
6. **Риски** — All risks aggregated (pharma + support + labs + training + nutrition)
7. **Профиль** — Settings, measurements, support stack separate

### Key Engines & Files
- `src/engines/training.engine.ts` — RIR matrix, volume, splits → REWRITE RIR
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
1. [ ] Merge training + cycles tabs in PlanScreen → single unified tab
2. [ ] Remove duplicate volume/split displays across screens
3. [ ] Split LabsScreen into 2-column layout (results | catalog)
4. [ ] Add synergy descriptions to RiskScreen/PharmaScreen
5. [ ] Aggregate all risks in RiskScreen (pharma + labs + training + nutrition)
6. [ ] Separate Support into standalone section
7. [ ] Fix buttons to work without lab data (default values)

### Phase 2: Data & Calculations
8. [ ] PAL auto-derivation: workoutsPerWeek + avgWorkoutMinutes → PAL
9. [ ] Connect PAL to all nutrition engines (replace hardcoded 1.55)
10. [ ] Connect trainingLoadRatio to workoutsPerWeek automatically
11. [ ] Fix TDEE/macro calculations with proper PAL
12. [ ] Add micronutrients to FoodItem interface + food DB
13. [ ] Calc micronutrient intake from diary + show vs targets

### Phase 3: Food & Nutrition
14. [ ] Expand food database: 50→150+ products with micros
15. [ ] Add КБЖУ chart (7/14/30 day ranges) to NutritionScreen
16. [ ] Fix OCR parser for FatSecret/MFP screenshots
17. [ ] Add barcode search improvements (Open Food Facts cache)

### Phase 4: Training Overhaul
18. [ ] RIR matrix: goal×level×mesocyclePhase with weekly progression
19. [ ] Split selector engine: scoring system with rationale
20. [ ] Progression engine: linear/double/undulating, deload triggers
21. [ ] Strength diary: StrengthLogEntry/WorkoutLog types + IndexedDB stores
22. [ ] PlanScreen: rationale blocks, exercise commentary, volume justification

### Phase 5: Research & Content
23. [ ] Add 3-5 research links per substance to pharma-database.ts
24. [ ] Add 3-5 research links per supplement to support.engine.ts
25. [ ] Enhance mechanism descriptions for all PD systems

## Build Commands
```bash
cd D:\V9
npx tsc --noEmit
npx vite build
```

## Key Decisions
- PAL formula: `1.2 + (workoutsPerWeek × 0.075) + (avgWorkoutMinutes > 60 ? 0.1 : 0)` clamped [1.2, 1.9]
- Training load ratio: `(workoutsPerWeek × avgWorkoutMinutes) / 420` clamped [0.2, 1.5]
- All UI text in Russian
- Dark theme, green accent #00e68a
- All data via IndexedDB + useDataLink
- Deploy: Vercel at body-build-health.vercel.app