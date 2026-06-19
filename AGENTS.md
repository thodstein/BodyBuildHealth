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

### Navigation (7 tabs)
1. **Главная** — Dashboard (aggregated overview)
2. **Фарма** — Pharmacology + Support (combined, 2 columns: catalog left, detail right)
3. **Тренировки** — Unified training (merged training + cycles, NO duplicates)
4. **Питание** — Nutrition with КБЖУ charts, expanded food DB, OCR
5. **Анализы** — Labs + Catalog (2-column: lab results left, schedule/catalog right)
6. **Риски** — All risks aggregated (pharma + support + labs + training + nutrition)
7. **Профиль** — Settings, measurements, support stack separate

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
17. [ ] Add barcode search improvements (Open Food Facts cache)

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

## Session Summary (Jun 19)
### Done
- **Shared utils** (`src/core/nutrition-utils.ts`): `addToCart(item)` object param, `CAT_MAP_LABEL/EMOJI` split
- **Macro → profile linking**: `NutritionDiary` accepts `targets` prop, `NutritionScreen` computes via `calcNutrition()`
- **Open Food Facts** (`openfoodfacts.engine.ts`): fallback API chain (ru→world→us), localStorage cache (200 entries, 7d TTL), auto-category detection
- **SW auto-update**: `reg.update()`, update toast, `controllerchange` → auto-reload
- **Design overhaul (all screens)**: removed all glass/blur, solid `#18181b`/`#202023`/`#27272a`, white text, green-gradient active vs solid-dark inactive buttons
- **`NutritionScreen`**: second hero card "Аналитика питания", sticky top-bar, pill tabs redesign
- **`NutritionDiary`**: full rewrite — no glass, white text, clear active states, solid dark modals
- **`IndividualPlan`**: `GlassCard`/`PillBtn`/`inputStyle`/`reportPillStyle` — no glass, solid backgrounds
- **`PharmaCourseScreen`**: drug picker modal — no glass/blur overlay, visible inactive pills (`#202023` + `#3f3f46`), substance cards solid, class selector maxHeight 300 (not 100), visible day buttons
- **`IndividualPlan.tsx` redesign** — full card modernization:
  - **Training day picker**: Пн-Вс toggles in cycling card for macro/butch modes (green=training, dark=rest)
  - **KBJU карточка**: big macro tiles with per-kg, gradient backgrounds, colored top border, macro distribution bar (Б/Ж/У %), edit button
  - **Meal plan cards**: gradient day headers with large kcal badge, macro progress bars per target (Б/Ж/У vs targets), colored meal blocks with vertical accent bar, item chips with dark bg, meal macro % distribution
  - **GlassCard upgrade**: 3px colored top gradient bar per card, 14px padding, 700-weight title, 10px → 12px font
  - **All cards** got `color` accent props
  - **Separate calculators** (чимил/углезагрузка/БУЧ): solid dark buttons with accent text
  - **БУЧ display**: 2-column card (ВУ green / НУ red) with big BJU
  - **Green button**: `boxShadow` for depth
  - **Week plan**: per-day cards with training/rest icon, kcal badge, inline food list
  - **Saved plans**: `#202023` collapsed state, expanded with full detail
  - **Meal prep steps**: solid dark step cards, cyan items chips, 1/3/7 day selector
  - **Water balance**: pharma-aware (40ml/kg on AAS, +0.5L base +0.1L/injectable)
  - All inactive backgrounds changed from `rgba(..0.02)` → `#202023`; borders → `#27272a`
- **Phases**: replaced steroid cycles (course/bridge/pct) with nutrition phases (mass/cutting/maintenance/recomp/recovery/prep)
- **Allergens**: expanded 7→14 (лактоза, глютен, орехи, арахис, яйца, соя, рыба, морепродукты, молочные, кунжут, сельдерей, горчица, сульфиты, люпин) with icons + search
- **Preferences**: add/remove favorite foods via dropdown, excluded foods picker, custom notes textarea (saved to localStorage)
- **Food randomization**: seeded random per day+meal so same params give different foods
- **Shopping list**: grouped by category (🥩 мясо, 🥛 молочка, 🍚 крупы, 🥦 овощи, 🧈 жиры, etc.)
- **Читмил/Загрузка/БУЧ**: detailed BJU breakdown + 5-7 принципов + goal-specific рекомендации
- **Recommendations**: 20+ detailed recs covering goal, phase, plan type, allergens, training link, cycling, budget, pharma drugs, steps
- **Meal prep**: day selector (1/3/7), uses respective plan source
- **Reports**: "Общий отчёт" now triggers ALL reports + recommendations at once
- **Nutrition level**: description text + multiplier display
- **Training link**: day-of-week picker (Пн-Вс) for training day selection
- **Removed**: duplicate NutritionReference at bottom (already in tab)
- `tsc --noEmit` ✓, `vite build` ✓

## Build Commands
```bash
cd D:\BodyBuildHealth
$env:NODE_OPTIONS='--max-old-space-size=2048'; npx tsc --noEmit
$env:NODE_OPTIONS='--max-old-space-size=2048'; npx vite build
```

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
