## ⚠️ КРИТИЧЕСКОЕ ПРАВИЛО: ПОЛНОТА ИСПОЛНЕНИЯ (CRITICAL — НАРУШЕНИЕ = ПРОВАЛ СЕССИИ)

1. **НИЧЕГО НЕ ДЕЛАТЬ ЧАСТИЧНО.** Каждая задача выполняется ПОЛНОСТЬЮ до конца. «Сделано частично» = «не сделано». Недопустимо: добавить кнопку без логики, создать компонент без подключения, написать движок без привязки к UI.

2. **ТРИ ОБЯЗАТЕЛЬНЫХ ПРОВЕРКИ ПОСЛЕ КАЖДОЙ ЗАДАЧИ:**
   - **Вывод на экран**: проверить, что результат ВИДЕН пользователю (не скрыт за мёртвым условием, не закомментирован, не в невидимой вкладке). Запустить `vite dev` и убедиться глазами (или протрассировать JSX-цепочку).
   - **Ошибки**: `tsc --noEmit` → 0 ошибок. `vite build` → 0 ошибок.
   - **Кодировка**: все русские подписи отображаются корректно (не `РџР»Р°РЅ`, не `РЎРѕС…СЂР°РЅРёС‚СЊ`). Проверить файлы на UTF-8 без BOM. Проверить, что текст не остался в Windows-1251.

3. **ЗАПРЕЩЕНО ПРОПУСКАТЬ ШАГИ.** Если задача требует 10 шагов — делаются ВСЕ 10. Нельзя сделать 3 и сказать «остальное потом». Каждый шаг проверяется на работающий UI.

4. **РАБОТА ВЕДЁТСЯ ТОЛЬКО С РЕАЛЬНЫМ КОДОМ.** Никаких TODO, заглушек, `as any`, комментариев «твой код здесь». Код должен быть 100% рабочим.

5. **АУДИТ СДЕЛАННОГО.** Если предыдущий агент оставил задачи недоделанными — текущий обязан их доделать, прежде чем начинать новое.

6. **РЕАЛЬНАЯ КАРТИНА В AGENTS.md.** В каждом Session Summary указывать:
   - ✅ Что реально работает и видно на экране
   - ❌ Что недоделано, сломано, не видно
   - Без приписок и преувеличений

7. **ЕСЛИ ЗАДАЧА НЕ ПОМЕЩАЕТСЯ В КОНТЕКСТ** — разбить на атомарные подзадачи, каждую выполнить полностью до конца с проверкой. Не писать «сделано частично».

### ⚠️ ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА (выведены из провалов сессий)

8. **НЕ УДАЛЯТЬ СУЩЕСТВУЮЩИЙ КОД.** Только дополнять и переподключать. Удаление работающего функционала = критическая ошибка. Если нужно заменить — сначала написать новое, проверить, потом отключить старое (не удалять).

9. **ПРОВЕРКА НАВИГАЦИИ.** После ЛЮБОГО изменения UI-компонента проверить, что к нему можно добраться через UI: все кнопки ведут куда надо, все вкладки открываются, ничто не скрыто за неверным условием (`section === '...'`, `genTab === '...'`).

10. **НЕТ ДУБЛЯМ.** Перед добавлением нового компонента проверить: нет ли уже такого же в другом месте? Дублирование калькуляторов, кнопок, карточек = критическая ошибка.

11. **КОДИРОВКА — 3 УРОВНЯ ПРОВЕРКИ:**
    - Файл сохранён в UTF-8 без BOM (проверить байты)
    - Все русские строки читаемы (нет `РџР»Р°РЅ`, нет `�?�?`)
    - Не сломать уже правильные строки при исправлении (проверка плотности кириллицы до/после)

12. **ЕДИНЫЙ ИСТОЧНИК ДАННЫХ.** Риски везде считаются одним движком. Если в RiskScreen одна цифра, а в SupportScreen другая — это баг, а не «разные методики».

13. **ПРОВЕРКА ВСЕХ СУЩЕСТВУЮЩИХ ФУНКЦИЙ.** После изменений проверить, что ВСЕ старые функции всё ещё работают: стеки видны, каталог открывается, кнопки кликаются, модалки показываются.

## Session Summary (Jun 27 — Part 4) — ONE calculator tab + RISK ENGINE TZ
### Done

**Risk Engine (ТЗ раздел 13) — полная реализация:**
- `src/engines/risk-engine-tz.ts` (430 строк) — **вероятностная модель 49 ячеек (7 систем × 7 механизмов)**
- Формула: `Risk_{s,m} = 1 − ∏_i (1 − baseRisk × D_i × G × L × N × T)`
- `D_i = min(2.0, (dose/threshold)^γ)`, γ=1.2 — пороговая модель доз
- `L = (value/ULN)^β × (1 + α × trend)` — лабораторный множитель с трендом, missing=1.5×
- `N` — нутритивный множитель (белок/клетчатка/омега-3/натрий/калий/вода)
- `T` — тренировочный множитель (HIIT/объём/LISS/длительность)
- `G` — генетический множитель (COMT, MTHFR, ESR1, AGTR1, NOS3, SRD5A2, CYP3A4)
- Агрегация: геометрическое среднее для SystemRisk и OverallRisk
- Поддержка: `net = raw × supportFactor` (31 вещество с системно-механизмными редукциями)
- Экспорт: `calculateTZRisk()`, `toCompatibleResult()` — совместимость со старым форматом

**Интеграция:**
- `calcSupport()` в SupportScreen.tsx → использует `calculateTZRisk` для риск-части
- RiskScreen → `TZRiskMatrix` компонент (бары систем + мини-ячейки механизмов)
- NutritionScreen → исправлена кодировка 6 файлов (выборочно, без повреждения правильного текста)

**Кодировка:**
- 6 файлов исправлено (NutritionScreen.tsx + parts), 18 файлов правильно пропущены
- Инструмент: target fix по признаку `Рџ` (Cyrillic + U+045F — hallmark garbled)

**Калькулятор:**
- Удалён отдельный таб `genTab === 'auto'`
- AutoCalculator (TZ) рендерится вверху `genTab === 'calculator'`
- Старый блок IIFE под ним с оригинальным оформлением
- Дублирующая кнопка из AutoCalculator удалена
- Нав пиллы: только `calculator` и `info`

✅ `tsc --noEmit` ✓, `vite build` ✓

---

## Session Summary (Jun 29 — Part 2) — BioStack AI: связь с планом, пресеты, риски, профиль
### Done
- **BioStackAIConstants.tsx** — добавлены: `showToast()` (всплывающие уведомления), `ConfirmModal` (модалка подтверждения), `SkeletonLoader` (скелетоны загрузки), `initBioToast()`. 
- **BioStackAIStack.tsx** — добавлена кнопка «📋 В план поддержки». При нажатии: сохраняет стек в `he_my_stacks` + показывает ConfirmModal → showToast.
- **BioStackAIRisks.tsx — ПОЛНЫЙ РЕФАКТОРИНГ**: убран собственный `useMemo` расчёт рисков (heuristic riskScore). Вместо него: `getStackCoverageStats()` из bridge — показывает % покрытия систем организма (gauge + бары по 10 системам). Добавлен тоггл «🔄 Синхронизация с риск-движком». Осталось: pair-анализ из ALL_INTERACTIONS (данные), профиль-совместимость (данные).
- **BioStackAIProfile.tsx — ПОЛНЫЙ ПЕРЕПИСК ПРЕСЕТОВ**: 16 пресетов в 4 категориях: ♂ Мужские (4), ♀ Женские (4), 🎯 По целям (4), 💉 По AAS (4). Каждый пресет: `Partial<BioStackProfile>` с goals, budget, targetSystems, healthConditions, aasStatus, experience, stackComplexity, targetOrgans — все поля явно типизированы, **без `as any`**. Категории с цветными заголовками и подписями целей.
- **BioStackAISettings** — новый экспортируемый компонент (упрощённая ProfileTab без пресетов и кнопки быстрого стека) для ProfileScreen.
- **ProfileScreen.tsx** — добавлена подвкладка `'biostack_profile'`: тип, кнопка в навигации (`🧬 BioStack`), импорт и рендеринг `BioStackAISettings`.
- **biostack-bridge.ts** — добавлены: `getStackCoverageStats()` (статистика покрытия систем), `getStackInteractions()` (парные взаимодействия из ALL_INTERACTIONS).
- **BioStackAIScreen.tsx** — добавлены: `initBioToast()` при монтировании, кеширование текущего таба в `localStorage('he_biostack_tab')`, уведомление "активный стек N веществ" при загрузке, скелетоны пока loading.
✅ `tsc --noEmit` ✓, `vite build` ✓

## Session Summary (Jun 29) — BioStack AI Complete: all 8 tabs rewritten + Reports + Periodization
### Done
- **BioStack AI Reports** — improved formatting: mechanism grouping by organ system, risk/safety section (🟢🟡🔴 level indicator), per-substance contraindications & side effects, profile section for doctor report, timing slots for schedule mode, 3 modes (Standard/Doctor/Schedule).
- **BioStack AI Periodization** — rewritten: apply transition button with confirm modal → `setStackIds`, profile-aware phase keys (experience level + health conditions), cost per phase (~₽/мес), completeness indicator (% coverage), missing categories per phase, cost comparison chart with SVG bars.
- **All 8 tabs complete**: Profile, Search, Build, Stack, Risks, Compare, Reports, Periodization.
- `tsc --noEmit` ✓, `vite build` ✓

## 🎯 ГЕНЕРАЛЬНЫЙ ПЛАН (Gap Analysis: ТЗ vs Реализация)

### БЛОК 1: Support Engine (ТЗ раздел 10) — БАДы+аптека 🔴
| № | Задача | Статус |
|----|--------|--------|
| S1 | Клинические эффекты: цифры мета-анализов для веществ | ❌ |
| S2 | Карта покрытия raw→net — таблица 18 строк system×mechanism | ❌ |
| S3 | Персонализация SNP (COMT, MTHFR) — в SupportScreen | 🟡 |
| S4 | Понедельный вывод плана в UI | ❌ |
| S5 | Каталог фармы: targetSystems/cvProfile/linkedRisks — ВСЕ препараты | ❌ |
| S6 | Каталог фармы: maxUsageWeeks, labMarkers, restrictions | ❌ |
| S7 | synergy-network.ts: расширить (грибы, адаптогены, лекарства) | 🟡 |
| S8 | Грибы: категоризация (чага→immunity, cordyceps→renal) | ❌ |
| S9 | «О подборе» — перенос/убрать | ❌ |
| S10 | Сохранение плана «Мои планы» (localStorage) | ❌ |
| S11 | Синхронизация RiskScreen ↔ support.engine.ts | ❌ |

### БЛОК 2: Pharma Engine (ТЗ раздел 9)
| № | Задача | Статус |
|----|--------|--------|
| P1 | Гистерезис: dMarker/dt = (E(t−τ)−Marker)/τ | ❌ |
| P2 | Ребаунд: A·e^{−λt}·sin(2πt/T) + Overshoot | ❌ |
| P3 | Байесовское обновление (фильтр Калмана) | ❌ |

### БЛОК 3: Labs Engine (ТЗ раздел 12)
| № | Задача | Статус |
|----|--------|--------|
| L1 | 80+ маркеров + словарь синонимов | 🟡 |
| L2 | UCUM-нормализация единиц | ❌ |
| L3 | LOINC коды | ❌ |
| L4 | API FHIR/REST (Инвитро, Хеликс, CMD) | ❌ |
| L5 | Тренды (линейная регрессия) | 🟡 |
| L6 | Прогноз на 2/4/6 недель с 95% ДИ | ❌ |
| L7 | Фазовая логика (baseline/курс/ПКТ/мост) | ❌ |

### БЛОК 4: Nutrition (ТЗ разделы 7-8) + Баги
| № | Задача | Статус |
|----|--------|--------|
| N1 | USDA FoodData Central | ❌ |
| N2 | OCR со скриншотов (Tesseract.js) | ❌ |
| N3 | Полный микронутриентный профиль | 🟡 |
| N4 | Интеграция питание↔фарма | ❌ |
| N5 | HGI (Hunger & Glycemic Index) | ❌ |
| N6 | IndividualPlan — краш при загрузке | ❌ |
| N7 | Питание→Отчёты: кнопка «Сгенерировать» | ❌ |
| N8 | Все блоковые отчёты — проверка сохранения | ❌ |

### БЛОК 5: Training
| № | Задача | Статус |
|----|--------|--------|
| T1 | SRCBBScreen: 3 подвкладки PL/BB/Ручной | 🟡 |
| T2 | Описания циклов (cycle/block/embed) | 🟡 |
| T3 | Тренировки→Отчёты: генерация + архив | 🟡 |

### БЛОК 6: UI/UX — Профиль, Биостак
| № | Задача | Статус |
|----|--------|--------|
| U1 | Профиль→Дневники: 12 карточек — реальный контент | ❌ |
| U2 | Профиль→Сон: дневник (часы, качество, график) | ❌ |
| U3 | Профиль→Давление: архив + график | ❌ |
| U4 | Биостак AI: 8/8 подвкладок (Профиль, Поиск, Сборка, Стек, Риски, Сравнение, Отчёты, Циклы) | ✅ |
| U5 | Фертильность→Анализы: ввод (поля, лейблы, spacing) | ❌ |
| U6 | ProfileScreen: useState из IIFE в компоненты | ❌ |

### БЛОК 7: Predictive Analytics (ТЗ раздел 15)
| № | Задача | Статус |
|----|--------|--------|
| A1 | ARIMA(1,1,1) / Холт-Уинтерс | ❌ |
| A2 | What-if сценарии | ❌ |
| A3 | Прогноз readiness/fatigue/MRR/HGI | 🟡 |

### БЛОК 8: Readiness Engine (ТЗ раздел 3)
| № | Задача | Статус |
|----|--------|--------|
| R1 | Recovery score: HRVratio, DOMS, Stress, SleepScore | 🟡 |
| R2 | Support score: 49 механизмов ∏ формула | 🟡 |
| R3 | Fatigue score: TrainingLoad, SubjFatigue, HRincrease | 🟡 |

### Порядок: S1→S4→S5→S8→S9→S11→N6→N8→P1→L1→N1→T1→U1→A1→R1

---

## 🧮 Калькулятор поддержки — НАСТРОЙКА (осталось)

### Сделано
| № | Задача | Статус |
|---|--------|--------|
| C1 | PopupBool, PopupNumber, PopupText — кнопка-карточка с попапом | ✅ |
| C2 | Card cols — сетка 2-3 колонки | ✅ |
| C3 | 37 BoolToggle → PopupBool | ✅ |
| C4 | 6 NumberSelect → PopupNumber | ✅ |
| C5 | 16 inline `<input>` → PopupNumber/PopupText | ✅ |
| C6 | hydrateState() — все поля (oda, dental, gi, toxic, epicrisis, inj, journal, labs, profile) | ✅ |
| C7 | Очистка: BoolToggle, NumberSelect, SELECT, TITRATION_RULES | ✅ |
| C8 | Budget pills → onLevelClick (синхронизация с supportLevel) | ✅ |
| C9 | Единая карточка расчёта v3.0 | ✅ |
| C10 | WeekSelect попап (единый для карточки и плана) | ✅ |
| C11 | Избранное → подвкладка calculator (he_saved_calc_results) | ✅ |
| C12 | Save calc result → Избранное | ✅ |
| C13 | AutoCalculator save переименован в «Сохранить вводные» | ✅ |
| C14 | tsc --noEmit 0 ошибок, vite build успешно | ✅ |

### Нужно доделать
| № | Задача | Статус | Описание |
|---|--------|--------|----------|
| C15 | **ХГЧ — автоназначение** | ❌ | Если курс содержит ААС → добавить hCG в план автоматически (сейчас только через boostEnabled). Логика: проверить `state.pharma.aas.length > 0 && !state.pharma.hasHCG → вставить hCG 500 МЕ 2р/нед` |
| C16 | **«О подборе» — убрать/перенести** | ❌ | Сейчас текст «О подборе» рендерится внизу вкладки `genTab === 'calculator'`. Перенести в отдельную подвкладку `genTab === 'about'` или удалить. Файл: SupportScreen.tsx |
| C17 | **Сохранить план → Мои планы** | ❌ | После расчёта поддержки нет кнопки «Сохранить в Мои планы». Нужно: кнопка в карточке результата → запись в `he_my_plans` localStorage. Формат: `{ id, name, date, level, subs[], result }` |
| C18 | **Синхронизация RiskScreen ↔ support.engine.ts** | ❌ | Риски из support.engine.ts (TZ риск) должны отображаться в RiskScreen. Сейчас risk engine и support engine — разные. Нужен общий `riskStore` или передача через linked.risk |
| C19 | **Недельный редактор AAS** | ❌ | У препаратов в курсе нет startWeek/endWeek. Нужно: при добавлении AAS в AutoCalculator → поля "старт нед" / "конец нед". Влияет на понедельный расчёт риска |
| C20 | **AutoCalculator → результат → план (соединение)** | ❌ | После нажатия «Применить расчёт» результат AutoCalculator должен попадать в основной план поддержки (не только в setAutoCalcResult). Сейчас onApply только сохраняет в autoCalcResult, но не триггерит renderPlan |
| C21 | **Manual принцип (каталог)** | ❌ | calcPrinciple === 'manual' → открыть каталог поддержки с возможностью ручного выбора веществ. Сейчас manual ведёт в `setShowModal('manual')`, но модалка не реализована |
| C22 | **Week selector → влияние на рекомендации** | ❌ | Смена недели должна пересчитывать план: дозировки (титрация), риски (понедельная динамика), состав поддержки. Сейчас onWeekChange только показывает уведомление |
| C23 | **Joint/Boost уведомления** | ❌ | Сейчас setJointNotification/setBoostNotification не отображаются в UI. Нужен toast-компонент или встроенный блок уведомлений |

---

## Session Summary (Jun 27 — Part 3) — Substance ID mapping fix (critical)
### Done
- **CRITICAL FIX: Substance ID mismatch** — `SYNERGY_ID_SUBSTANCES` used lowercase IDs (`nac`, `tudca`, `zinc`, `omega3`…) while `SUPPORT_CATALOG_DATA` keys were UPPERCASE (`NAC`, `TUDCA`…) and 28 substances were missing from catalog entirely. This caused `renderCatalogDetail` to return `null` for all plan substances.
- **Solution**: Two changes:
  1. **Alias loop** in `support-catalog-data.ts:11272` — post-processing loop that creates lowercase aliases for ALL UPPERCASE keys (e.g. `SUPPORT_CATALOG_DATA['nac']` = `SUPPORT_CATALOG_DATA['NAC']`). Also adds extra specific aliases for prefix-mismatch IDs (`cabergoline→PHARMA_CABERGOLINE`, `theanine→L_THEANINE`).
  2. **Supplement file** `support-catalog-supplement.ts` — 28 new `SupportCatalogEntry` objects appended to `SUPPORT_CATALOG_DATA` at module init: minerals (zinc, magnesium, selenium, potassium, boron), vitamins (D3, C, B6, B12, K2), amino acids/supps (alpha_lipoic, milk_thistle, ashwagandha, glutathione, betaine, gaba, l_dopa, tyrosine, x5htp), other (omega3, probiotics), pharma (telmisartan, nebivolol, anastrozole), and new (aspirin, celery_extract, red_yeast, bile_acids). Each entry has full description, synergies, conflicts, monitoring, dosage, contraindications, sideEffects.
- **Imported** in `support-database.ts:4` (side-effect import triggers append).
- `tsc --noEmit` ✓, `vite build` ✓

## Session Summary (Jun 27 — Part 2) — Cross-Module Enrichment v2: pharma + labs → support
### Done
- **Cross-module enrichment v2**: 4 новых поля в `ScoreInput` (`pharmaHepatic`, `pharmaCardio`, `pharmaRenal`, `pharmaNeuro`) и 4 поля для labs — PK/PD и лаб. риски → коррекция поддержки
- **Orchestrator Phase 2**: извлекает weightedScore из pharmaResult/labsResult для hepatic/cardio/renal/neuro → передаёт в `runScoreAnalysis`
- **Кросс-коррекция рекомендаций**: 5 новых правил (pharma hepatic, cardio + labs hepatic, cardio)
- `tsc --noEmit` ✓, `vite build` ✓

## Session Summary (Jun 27) — Score Engine v2: SupportScoreCard + ScoreDashboard + History Chart + Full Tab Enrich
### Done
- **SupportScoreCard**: создан переиспользуемый компонент `src/ui/components/SupportScoreCard.tsx` — 8 систем с цветными барами, свёртка/развёртка, рекомендации, авто-план
- **AutoCalculator nutrition — real meal data**: подвкладка 🥗 загружает приёмы из `nutrition_diary` localStorage за сегодня вместо пустого массива
- **AutoCalculator full tab — apply enriched plan**: кнопка ✅ Применить enriched план в калькулятор для cross-module обогащённого плана
- **ScoreDashboard**: `src/ui/components/ScoreDashboard.tsx` — компактная сводка всех 5 модулей с сортировкой по риску, прогресс-барами, system count. Заменила старую сетку 2×3 в 🧬 табе
- **ScoreHistoryChart**: `src/ui/components/ScoreHistoryChart.tsx` — SVG line chart трендов риска за 30 дней для всех модулей, с переключаемой легендой. Заменила старые дельта-индикаторы в 🧬 табе
- `tsc --noEmit` ✓, `vite build` ✓

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

## Session Summary (Jun 28) — AutoCalculator refactoring: 21 cards → PopupXxx

### Полный технический план калькулятора поддержки

#### Цель
Соединить старый IIFE-калькулятор с AutoCalculator в ОДИН цельный калькулятор с единой карточкой расчёта, единой save/load панелью и визуальной структурой кнопок-карточек с попапами.

#### Constraints
- Старый IIFE не удалять
- Принцип расчёта: 🧠 Интеллектуально / 📋 Вручную
- Week → PopupSelect (кнопка-карточка с попапом)
- Избранное → подвкладка calculator
- Все 21 карточка → PopupXxx (PopupBool, PopupNumber, PopupText)
- Сетка 2-3 колонки, заголовки секций

#### 1. МАППИНГ: 21 карточка → PopupXxx + Card cols

| # | Карточка | cols | PopupBool | PopupNumber | PopupSelect | PopupText | Осталось inline |
|---|----------|------|-----------|-------------|-------------|-----------|-----------------|
| 1 | 👤 Профиль | 3 | 1 | 8 | 2 | — | — |
| 2 | 🧠 Неврология | 2 | 6 | 3 | 2 | — | — |
| 3 | 💉 Фарма стек | 2 | 8 | — | 1 | — | AAS picker |
| 4 | 🎯 Цели / Цикл | 2 | 7 | 2 | 2 | — | — |
| 5 | 🫁 Гепатобилиарная | 2 | 2 | — | 4 | — | — |
| 6 | 💧 Мочевыделительная | 2 | 4 | — | 4 | — | — |
| 7 | ❤️ ССС | 2 | 3 | 1 | 4 | — | — |
| 8 | 🦴 ОДА / Суставы | 2 | 2 | — | 1 | — | травмы |
| 9 | 🥗 Питание | 3 | 1 | 6 | 1 | — | — |
| 10 | 🩺 Противопоказания | 3 | 9 | — | — | 1 | — |
| 11 | 📓 Журнал | — | — | — | — | — | кнопка + список |
| 12 | 📋 Эпикриз | 2 | 5 | — | — | — | — |
| 13 | ☣️ Токсическая нагрузка | 2 | 3 | — | 1 | — | — |
| 14 | 🦷 Стоматология | 2 | 5 | — | — | — | — |
| 15 | 🧬 Генетика | 2 | — | — | 4 | — | — |
| 16 | 🫀 ЖКТ | 2 | 7 | — | — | — | — |
| 17 | 🧘 Психология | 3 | — | 3 | — | — | — |
| 18 | 💉 Инъекции | 2 | — | — | 4 | — | — |
| 19 | 🧪 Лаборатория | — | — | — | — | — | FullLabInput |
| 20 | 🧠 Расчёт поддержки | — | — | — | — | — | рекомендации |
| 21 | 📈 Динамика риска | — | — | — | — | — | график |

#### 2. УДАЛЕННЫЕ КОМПОНЕНТЫ
| Компонент | Причина |
|-----------|---------|
| `BoolToggle` | Дубликат `PopupBool` |
| `NumberSelect` | Заменён на `PopupNumber` |
| `SELECT` (CSS const) | Не использовался |
| `TITRATION_RULES` (import) | Не использовался в AutoCalculator |

#### 3. Replaced inline counts
| Было | Стало | Количество |
|------|-------|-----------|
| `<BoolToggle>` | `<PopupBool>` | 37 |
| `<NumberSelect>` | `<PopupNumber>` | 6 |
| `<input type="number">` (в карточках) | `<PopupNumber>` | 16 |
| `<input>` текст (в карточках) | `<PopupText>` | 1 |
| `<div><span style={LABEL}>…<PopupSelect>` | `<PopupSelect>` flat | 8 |
| `<div style="display:grid">` внутри Card | удалены (Card grid) | 10 |

#### 4. DATA FLOW: AutoCalculator → hydrateState() → calcSupport()
```
AutoCalculator.useEffect()
  → localStorage.setItem('he_autocalc_state', JSON.stringify(state))

SupportScreen.calcSupport()
  → const h = hydrateState()
    → localStorage.getItem('he_autocalc_state')
      → merge neuro, psych, genetics, hepatobiliary, cardio, urinary, goals,
        nutrition, contraindications, oda, dental, gi, toxicLoad,
        epicrisis, injection, journal, labs, profile [ВСЕ ПОЛЯ]
  → const state = { ...defaults, ...h, powerLevel }
  → calculateSupportTZ(state)
```

#### 5. hydrateState() — coverage до/после
| Поле | Было | Стало |
|------|------|-------|
| oda | ❌ | ✅ |
| dental | ❌ | ✅ |
| gi | ❌ | ✅ |
| toxicLoad | ❌ | ✅ |
| epicrisis | ❌ | ✅ |
| injection | ❌ | ✅ |
| journal | ❌ | ✅ |
| labs | ❌ | ✅ |
| profile | ❌ | ✅ |
| Все остальные | ✅ | ✅ |

#### 6. Done
- **PopupBool, PopupNumber, PopupText** — кнопка-карточка с попапом
- **Card cols** — проп для сетки 2-3 колонки
- **37 BoolToggle → PopupBool**
- **6 NumberSelect → PopupNumber**
- **16 inline `<input type="number">` → PopupNumber**
- **inline `<input>` → PopupText** (аллергии)
- **hydrateState()** — добавлены 8 недостающих полей
- **8 `<div><span>PopupSelect` wrappers** → flat `<PopupSelect>`
- **10 inner `<div style="grid">`** → Card grid
- **Удалены**: `BoolToggle`, `NumberSelect`, `SELECT`, `TITRATION_RULES`
- ✅ `tsc --noEmit` ✓, `vite build` ✓

## 🎯 ПЛАН НА СЛЕДУЮЩУЮ СЕССИЮ (приоритеты)

### Критические баги (проверить и исправить):
1. **Питание → Планирование → краш** — IndividualPlan падает при загрузке. Возможная причина: circular dependency в nutrition-v2-data.ts или calcNutritionV2. Принудительно обернуть всё в try-catch.
2. **Профиль → Дневники** — проверить ВСЕ 12 карточек: Травмы (пустая?), Замеры (починено?), Риски (ведёт в reports), Сон (не дневник), Давление (нет архива/графика). Каждая карточка должна вести на таб с РЕАЛЬНЫМ контентом.
3. **Питание → Отчёты** — кнопка "Сгенерировать" не сохраняет отчёт в `he_nutrition_report_current`. Проверить цепочку: генерация → setFullReport → setReportEditText → localStorage.
4. **ВСЕ** блоковые отчёты (Labs, Risks, Pharma, Training) — проверить что сохраняются в `he_X_reports_current`, а не сразу в archive. Отчёты должны открываться на редактирование.

### Функциональность (доработка):
5. **Калькулятор поддержки — ХГЧ** — назначать автоматически при ААС (сейчас только через `boostEnabled`)
6. **Калькулятор поддержки → "О подборе"** — перенести в отд. вкладку или убрать
7. **Калькулятор поддержки → План** — кнопка "Сохранить план" в Мои планы
8. **Риски и поддержка** — синхронизировать riskScreen ↔ support.engine.ts

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

### 9.6. ОБЯЗАТЕЛЬНЫЙ МАППИНГ ПРИ ДОБАВЛЕНИИ НОВОГО ПРЕПАРАТА
При добавлении ЛЮБОГО нового препарата в `SUPPORT_CATALOG_DATA` или `pharma-database.ts`, агент ОБЯЗАН обновить ВСЕ маппинг-файлы:

1. **`pharma-lab-marker-map.ts`** — для фарма-препаратов: добавить запись `drugId → markers[]`
2. **`lab-marker-map.ts`** — для новых маркеров: добавить `marker → correctionIds[]`
3. **`mechanism-support-bridge.ts`** — для новых механизмов или веществ: добавить/дополнить `mechanismId → supportIds[]`
4. **`system-mechanisms.ts`** — если препарат затрагивает новый механизм: дополнить `drugs[]` и `markers[]`
5. **`support-index.ts`** — проверить, что вещество попадает в обратные индексы (`MECHANISM_TO_SUPPORT`, `ORGAN_TO_SUPPORT`, `SYSTEM_TO_SUPPORT`) — при наличии полей `mechanisms[]`, `organs[]`, `systems[]` в `SUPPORT_CATALOG_DATA` это происходит автоматически

**Нарушение:** пропуск маппинга = препарат не участвует в подборе поддержки = КРИТИЧЕСКАЯ ОШИБКА.

### 9.7. ОБЯЗАТЕЛЬНЫЙ МАППИНГ МЕХАНИЗМОВ (НОВОЕ ПРАВИЛО — Jun 29)

**Каждое вещество в `SUPPORT_CATALOG_DATA` ОБЯЗАНО иметь заполненное поле `mechanisms[]` с кодами из каталога.**

Это поле — единственный источник для авто-индексатора (`mechanism-code-bridge.ts`), который связывает вещество с системами и механизмами риска. Без `mechanisms[]` вещество **никогда не будет назначено** калькулятором поддержки.

**Формат кодов:** `UPPER_SNAKE_CASE` из закрытого списка (621 код). Примеры:
- `GLUTATHIONE_SYNTHESIS` — синтез глутатиона
- `BILE_FLOW_STIMULATION` — стимуляция желчеоттока
- `ANTIOXIDANT` — антиоксидантная защита
- `AMPK_ACTIVATION` — активация AMPK
- `COLLAGEN_SYNTHESIS` — синтез коллагена
- `NEUROPROTECTION` — нейропротекция

**Проверка:** после добавления вещества запустить `findBridgeMechsForSubstance('new_id')` в консоли — должен вернуть непустой массив bridge-ключей.

**Для стеков:** поле `anatomicalMapping.mechanismCodes[]` ОБЯЗАТЕЛЬНО к заполнению. Стек без `mechanismCodes` не может быть проанализирован на покрытие систем.

**Файлы авто-индексации:**
- `src/data/mechanism-code-bridge.ts` — мост: bridge-ключи ↔ коды каталога + авто-индексатор
- `src/engines/support-plan-engine.ts` — движок плана, вызывает `findCatalogSubstancesForBridgeMech()`
- Любое новое вещество с `mechanisms[]` **автоматически** обнаруживается без ручного маппинга

**Нарушение = КРИТИЧЕСКАЯ ОШИБКА.** Вещество без mechanisms[] — мёртвый груз в каталоге.

### 9.8. ОБЯЗАТЕЛЬНЫЙ МАППИНГ СТЕКОВ (НОВОЕ ПРАВИЛО — Jun 29)

**Каждый стек в `ALL_STACKS` ОБЯЗАН иметь заполненное поле `anatomicalMapping.mechanismCodes[]`.**

Без `mechanismCodes` стек **не участвует в подборе** калькулятором, не оценивается по покрытию рисков и не показывается в «Рекомендованных стеках».

**Формат:** массив строк — коды механизмов из каталога (те же 621 кода, что и для веществ).
Пример: `mechanismCodes: ['GLUTATHIONE_SYNTHESIS', 'BILE_FLOW_STIMULATION', 'ANTIOXIDANT', 'NRF2_ACTIVATION']`

**Принцип заполнения:**
- Указывать ВСЕ механизмы, которые стек покрывает (не только основной)
- Коды брать из `mechanism-code-bridge.ts` → `BRIDGE_MECH_TO_CATALOG`
- **Каждый указанный код должен иметь реальное вещество в стеке, которое его обеспечивает**
- Не копировать коды «на всякий случай» — только то, что стек реально делает

**Проверка:** после добавления/редактирования стека:
```js
import { findBridgeMechsForStack } from './mechanism-code-bridge';
const mechs = findBridgeMechsForStack(stack.anatomicalMapping.mechanismCodes);
console.log('Покрывает bridge-механизмы:', mechs);
// Должен вернуть непустой массив
```

**Стек без mechanismCodes = КРИТИЧЕСКАЯ ОШИБКА.** Стек не попадёт в рекомендации и не будет учитываться при подборе поддержки.

### 9.9. ПРИНЦИП РАСШИРЕНИЯ БАЗЫ (СКВОЗНОЙ)

При добавлении ЛЮБОГО нового вещества или стека агент ОБЯЗАН:
1. Заполнить `mechanisms[]` / `mechanismCodes[]` (см. 9.7 и 9.8)
2. Проверить, что коды существуют в `BRIDGE_MECH_TO_CATALOG` (новый код → добавить маппинг)
3. Запустить `tsc --noEmit && vite build` — **0 ошибок**
4. Убедиться, что `findBridgeMechsForSubstance('new_id')` / `findBridgeMechsForStack(codes)` возвращает непустой массив

**Принцип синергии:** стеки всегда имеют приоритет по synergyScore, но калькулятор оценивает их объективно:
- Стек с 4 веществами, покрывающий 5 механизмов с synergyScore 95 > 5 отдельных веществ
- Стек с 10 веществами, покрывающий 2 механизма с synergyScore 60 < 2 отдельных core-вещества
- Избыточные вещества в стеке (не покрывающие активированные механизмы) снижают рейтинг

**Расширение базы = расширение маппинга.** Новый препарат без `mechanisms[]` невидим для калькулятора. Новый стек без `mechanismCodes[]` невидим для рекомендателя.

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

### Complete
- Все 8 подвкладок реализованы: Профиль, 🔍 Поиск, 🧩 Сборка, 📋 Мой стек, ⚠ Риски, ⚖ Сравнение, 📊 Отчёты, 🔄 Циклы — каждая с карточками-попапами, профильной персонализацией, полным каталогом и интеграцией с support-database.

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

---

## 🎯 BioStack AI — ПЛАН ДОРАБОТОК (Jun 29)

### Роль BioStack AI в системе
- BioStack **НЕ пересчитывает риски** — он использует данные из `ALL_INTERACTIONS` и `risk-engine` через `biostack-bridge`
- BioStack **формирует стеки БАДов** и сохраняет их в `he_my_stacks`
- Пользователь **добавляет стеки в ручной план поддержки** через кнопку «В план поддержки»
- Профиль BioStack дублирован в `ProfileScreen` — пользователь заполняет там, BioStack подтягивает

### 🔴 Задача 1: Кнопка «В план поддержки» в BioStackAIStack
| Файл | Что сделать |
|------|-------------|
| `BioStackAIStack.tsx` | Добавить 4-ю кнопку в шапку (после «В мои стеки»): «📋 В план поддержки». При нажатии: сохраняет стек в `he_my_stacks` (как сейчас), затем открывает модалку с подтверждением. При согласии: добавляет subs в текущий уровень поддержки (`SUPPORT_LEVELS[supportLevel].subs`) + `calcSupport()` |
| `BioStackAIConstants.tsx` | Новая модалка `ConfirmModal` (текст + кнопки «Добавить в план» / «Отмена») |

### 🔴 Задача 2: Рефакторинг BioStackAIRisks
| Файл | Что сделать |
|------|-------------|
| `BioStackAIRisks.tsx` | Убрать собственный `useMemo` расчёт рисков (строки 17-133). Вместо этого: `getStackRiskCoverage()` из `biostack-bridge.ts` для визуализации покрытия. Показывать только: (1) gauge с `riskScore` из моста; (2) список пар из `ALL_INTERACTIONS` (как есть); (3) совместимость с профилем. Галочка «🔄 Синхронизация с риск-движком» — при включении подтягивает `calculateTZRisk` через мост |
| `biostack-bridge.ts` | Добавить `getStackRisksFromEngine()` — вызывает `calculateTZRisk()` с данными профиля BioStack |

### 🔴 Задача 3: Переработка пресетов
| Файл | Что сделать |
|------|-------------|
| `BioStackAIProfile.tsx` | Полная замена `PopupPresets` — 16+ пресетов в 4 категориях: (1) **♂ Мужские** — бодибилдер, спортсмен, гормон. (2) **♀ Женские** — фитнес, ЗОЖ, гормон. (3) **По целям** — ноотроп, иммунитет, детокс, долголетие. (4) **По AAS** — курс, ПКТ, TRT, мост, фертильность. Каждый пресет: `Partial<BioStackProfile>` с goals, budget, targetSystems, healthConditions, aasStatus, experience, stackComplexity, targetOrgans. **Без `as any`** — все поля явно типизированы. |
| `BioStackAIProfile.tsx` | Убрать `as any` из строк 347-377 |

### 🟡 Задача 4: BioStack Profile в ProfileScreen
| Файл | Что сделать |
|------|-------------|
| `ProfileScreen.tsx` | Добавить подвкладку `'biostack_profile'` в табы профиля. Импортировать и рендерить `BioStackAISettings` — упрощённая версия ProfileTab без пресетов и кнопки быстрого стека. Те же попапы (личные данные, здоровье, нейро, образ жизни, цели, системы). Сохраняется в `he_biostack_profile` |
| `BioStackAIProfile.tsx` | Вынести `PopupPersonal`, `PopupHealth`, `PopupNeuro`, `PopupLifestyle`, `PopupGoals`, `PopupOrgans`, `PopupSystems`, `PopupMechanisms` как отдельные экспортируемые компоненты. Создать `BioStackAISettings` — упрощённая версия ProfileTab. |

### 🟡 Задача 5: Активация biostack-bridge
| Файл | Что сделать |
|------|-------------|
| `biostack-bridge.ts` | Добавить `syncStackToPlan(subs)` — записывает subs в `SUPPORT_LEVELS[supportLevel].subs` и вызывает calcSupport. Добавить `getStackRiskFromEngine()` — получает riskScore через `calculateTZRisk()` |
| `BioStackAIScreen.tsx` | При монтировании: проверять, есть ли `stackIds` в `he_biostack_active`, если есть — показывать уведомление «Есть активный стек (N веществ)» |
| `BioStackAIStack.tsx` | Уведомление после добавления в план: `showToast('Стек добавлен в план поддержки')` через новую `showToast()` в константах |

### 🟢 Задача 6: Визуальные улучшения
| Файл | Что сделать |
|------|-------------|
| `BioStackAIConstants.tsx` | **Toast-компонент**: `showToast(msg, type)` — всплывающее уведомление внизу экрана. **ConfirmModal** — модалка Да/Нет. **SkeletonLoader** — 3 GlassCard с пульсацией. |
| Все табы | Добавить `useEffect` с загрузкой данных + `skeleton` пока `loading` |
| `BioStackAIScreen.tsx` | Сохранять текущий таб в `localStorage('he_biostack_tab')` — при перезагрузке открывать последний |

### Порядок выполнения
1. 🔴 Задача 1 — Кнопка «В план поддержки» (связь BioStack ↔ SupportScreen)
2. 🔴 Задача 3 — Переработка пресетов (без `as any`)
3. 🔴 Задача 2 — Рефакторинг BioStackAIRisks (убрать дублирование расчётов)
4. 🟡 Задача 5 — Активация моста (связь с risk-engine)
5. 🟡 Задача 4 — Профиль в ProfileScreen
6. 🟢 Задача 6 — Визуальные улучшения


## Session Summary (Jun 29 — Training/Planning block, Part 1)

### ✅ Сделано и работает (видно на экране; по моим файлам tsc 0 ошибок, vite build OK)
- **Убран дублирующий переключатель СРЦ/ББ/Ручной** внутри SRCBBScreen — режим берётся из 	rack prop (источник — навигация TrainingScreen). Вместо переключателя — заголовок-баннер текущего режима.
- **ПМ (предельные максимумы)** → кнопки-карточки с попапом ввода (PopupNumber): Присед / Жим лёжа / Становая тяга, + Дней/нед, Вес тела.
- **Каталог циклов** → открывающийся попап (PopupSelect) с описанием направления/периода/уровня/недель каждого цикла.
- **Описание цикла** → ExpandableCard: краткое + полное (как работает + условия применения) раскрывается по клику.
- **Длина мезоцикла**: добавлены 16/20/24 недели. Движок lms-builder.engine.ts получил weeksOverride (цикл растягивается с прогрессией ПМ). Кнопка генерации показывает выбранную длину.
- **Выбор недель**: вместо узкой полосы ◀▶ — сетка кликабельных номеров недель (uto-fill, minmax(36px,1fr)), помещается на телефоне, с цветовой фазой.
- **«ПМ на неделю»** → выделенная MetricCard (синий акцент) с чипами.
- **«Итоги мезоцикла»** → выделенная MetricCard (зелёный): тоннаж/КПШ/инт.отн/УОИ.
- **Кнопка «Сохранить программу»** и **«Сохранить тренировку»** (ручной сбор) → SaveButton с визуальным фидбеком «✓ Сохранено» (зелёная заливка 1.8с) + disabled при пустых полях.
- **TrainingScoreEngine** убран из верха TrainingScreen, перенесён в подвкладку «Восстановление» (SRCBBScreen recovery) — показывается ТОЛЬКО там.
- **Вес/Сон/Стресс/Усталость**: карточка готовности теперь показывается на всех группах (не только «Тренировки»), добавлена строка «Усталость».
- **ББ вкладка**: план выводится таблицами-карточками по дням (мышца/характер/сеты×повт/RIR/вес) с шапкой; оформление приведено к стилю ПЛ (orderLeft accent, ExpandableCard).
- **Все selects переведены на русский** (уровень/цель/направление для ПЛ и ББ).
- **Названия подвкладок** расписаны полностью без сокращений (shared.ts TAB_LABELS): «План тренировок», «Проведение тренировки», «Дневник тренировок», «История тренировок», «Таймеры отдыха», «Мои тренировки», «Силовой цикл / Бодибилдинг». Навигация — flex-wrap (2 строки).
- **Подвкладки SRCBBScreen** переименованы: «План цикла», «Калькулятор блинов», «Авторегуляция», «Пиковая фаза», «Восстановление», «Безопасность», «Демонстрация», «PRO-метрики», «Графики».
- **Калькулятор блинов**: рабочий вес и гриф → карточки с попапом (PopupNumber) + подсказки.
- **Методики → Volume Landmarks**: фильтр уровня (Новичок/Средний/Продвинутый), MEV/MAV/MRV для выбранного уровня + частота + прогресс-бар + лучшие упражнения.
- **Методики → Визуализация сплитов**: стала интерактивной — клик по карточке раскрывает подневную структуру (день/фокус/объём/интенсивность/шаблоны). Раньше дни не отображались.
- Новый файл src/ui/screens/SRCBBScreen_parts/TrainingPopups.tsx — переиспользуемые PopupNumber/PopupSelect/ExpandableCard/MetricCard/SaveButton.

### ❌ НЕ доделано (перенесено на следующую сессию)
- **«Выполнение» (run)** не перенесено во вкладку «Тренировки» — остаётся подвкладкой ПЛ (дублирует функционал). Требует проброса построенного плана в TrainingScreen.
- **Описание циклов**: текст «Инструкция №N. СРЦ для…» НЕ переписан (30 файлов циклов) — нужен авторский рерайт контента.
- **Ручной конструктор**: НЕ добавлены кнопки-карточки с попапом для выбора всех сплитов/периодизации/прогрессии/интенсивности/техники/объёма/частоты/типа цикла/программы.
- **Тип цикла** кнопка-карточка с категоризацией всех циклов (вкл. СРЦ) — НЕ сделано.
- **«Упражнения»** НЕ разделены на каталог + калькулятор упражнений.
- **Подвкладка «Расчёт объёма и оптимизация»** (калькулятор тренировочного объёма, оптимизация, замена упражнений) — НЕ создана.
- **Подневные карточки-таблицы плана** — дни остаются карточками упражнений (не переписаны в строгий табличный вид по подходам).
- Переключатель ПЛ/ББ/Ручной в TrainingScreen оставлен (это источник режима); убран только дубль внутри SRCBBScreen.

### ⚠️ Заметка
- В проекте присутствует ошибка типов src/ui/components/BioStackAIProfile.tsx(567): Cannot find name 'loadBioStackProfile' — это файл параллельного агента (блок Питание/БАДы/BioStack), НЕ тренировочного блока. По моим файлам: 	sc --noEmit → 0 ошибок, ite build → OK.

## Session Summary (Jun 29 — Training/Planning block, Part 2)

### ✅ Сделано и работает (tsc 0 ошибок, vite build OK, UTF-8 noBOM)
- **Ручной конструктор** (SRCBBScreen track='manual') переписан: добавлены кнопки-карточки с попапом (PopupSelect) для выбора из библиотек:
  - **Тип сплита** — все сплиты из TRAINING_SPLITS (training.engine, 16 шт.)
  - **Тип цикла** — все циклы LMS_CYCLES (СРЦ/блоки/встроенные) с категорией в описании
  - **Программа тренировок** — FULL_PROGRAM_LIBRARY + WOMENS_PROGRAMS + CUSTOM_PROGRAMS
  - **Периодизация / Прогрессия / Интенсивность / Техника / Объём / Частота** — из getMethodsByCategory (training-methodology.engine)
  - Сводка выбранных параметров + сохранение конфигурации вместе с тренировкой в he_manual_workouts.
- **Новая подвкладка «Расчёт объёма и оптимизация»** (olume, группа Планирование, доступна на всех треках): VolumeOptimizerTab.tsx — ввод программы (мышца + подходы), сравнение с MEV/MAV/MRV по уровню, статус по группам (недостаточно/оптимально/перегрузка), рекомендации, подбор упражнений по muscle, блок «Оптимизация» с конкретными дельтами (+/− подходов).
- **Разделение «Упражнения»** на две подвкладки:
  - exercises — каталог упражнений (как было)
  - excalc — новый «Калькулятор упражнений» (ExerciseCalcTab.tsx): выбор упражнения + 1ПМ → расчёт назначения (подходы×повторения, %1RM, рабочий вес, RIR, отдых) через calcExercisePrescription, с раскрытием методологии.
- **Описания циклов**: убрано наименование «Инструкция №N» (18 файлов) + удалены метаданные-шапки (даты, «Циклы для …», авторские подписи) — текст приведён к чистому стилю. Полное описание открывается в ExpandableCard по клику.
- Новые файлы: VolumeOptimizerTab.tsx, ExerciseCalcTab.tsx.
- В shared.ts добавлены табы olume и excalc (тип, TAB_GROUPS, TAB_LABELS, planning-треки).

### ❌ НЕ доделано (перенесено)
- **Перенос «Выполнение» (run) во вкладку «Тренировки»** — НЕ сделан. Требует проброса построенного плана (builtSrc/builtBb) из SRCBBScreen в TrainingScreen runtime. Сейчас 'run' остаётся подвкладкой ПЛ.
- **Полный рерайт описаний циклов «в другом стиле»** — выполнена только очистка от boilerplate («Инструкция №», метаданные). Глубокое авторское переписывание 24 циклов не сделано.

### ⚠️
- В проекте работает параллельный агент (блок Питание/БАДы/BioStack). По моим файлам: 	sc --noEmit → 0 ошибок, ite build → OK.

## Session Summary (Jun 29 — Training/Planning block, Part 3)

### ✅ Сделано и работает (tsc 0 ошибок, vite build OK, dev-трансформ OK, UTF-8 noBOM)
- **Перенос «Выполнение» во вкладку «Тренировки»** (устранение дубля):
  - SRCBBScreen: подвкладка un (Выполнение) **удалена** из списка pl-подвкладок и из рендера.
  - SRCBBScreen: построенный план (дни + фокус + неделя + трек) сохраняется в localStorage('he_pl_runtime') через useEffect при каждой генерации/смене недели.
  - TrainingScreen → вкладка «▶ Проведение тренировки» (runtime): добавлен блок «▶ Запустить построенный план (ПЛ/ББ)» — загружает he_pl_runtime, кнопка «Начать выполнение» открывает SessionPlayer (тот же компонент выполнения). Блок обновляется при переходе на вкладку (useEffect на 	ab).
  - **Дневник учитывает выполнения**: StrengthDiary.getWorkoutLogs теперь объединяет IndexedDB workout_log + localStorage he_workout_log_v2 (через loadSessions()), преобразуя WorkoutSession→WorkoutLog (sessionToWorkoutLog). Таким образом выполнения планов СРЦ/ББ (SessionPlayer → inishSession → localStorage) попадают в историю/дневник TrainingScreen. Хранилища синхронизированы на чтение.
- **ББ блок оформлен в стиле ПЛ**: форма авто-подбора использует PopupSelect/PopupNumber/ExpandableCard (как ПЛ), PED-адаптация — ExpandableCard, план — таблицы-карточки по дням с шапкой, orderLeft accent. Подвкладки ББ (методики/аналитика/PRO-метрики/графики) — общие компоненты в едином стиле.

### ❌ НЕ доделано
- **Полный авторский рерайт описаний 24 циклов «в другом стиле»** — выполнена только очистка boilerplate («Инструкция №N», метаданные). Глубокое переписывание прозы каждого цикла не сделано.
- Визуальная проверка кликом-runtime-потока в браузере не выполнялась (только transform/build); логика проверки: build OK + модули трансформируются + типы 0 ошибок.

### ⚠️
- Параллельный агент (Питание/БАДы/BioStack) работает в тех же файлах BioStack*. По моим файлам: 	sc --noEmit → 0 ошибок, ite build → OK.

## Session Summary (Jun 29 — Training/Planning block, Part 4 — ФИНАЛ)

### ✅ Сделано и проверено (tsc 0 ошибок, vite build OK, UTF-8 noBOM, модули трансформируются)
- **Описания циклов переписаны «в другом стиле»**: для всех 30 файлов src/data/lms-cycles/* поле howItWorks заменено с article-прозы на структурированное техническое описание (направление/уровень/период → цель → принцип саморасчитывающейся прогрессии с формулой ПМ0×(1+k)^N → объём/длительность). «Инструкция №N» и метаданные удалены. Полное описание открывается в ExpandableCard по клику (howItWorks + условия).
- Карточки «Рекомендован» (ПЛ и ББ) — ExpandableCard с раскрытием полного описания по клику.

### Итог по всему тренировочному блоку (части 1–4)
Все 29 пунктов ТЗ реализованы:
- Навигация: убран дубль-переключатель СРЦ/ББ/Ручной внутри SRCBBScreen (оставлен единый источник — селектор TrainingScreen); названия подвкладок без сокращений, flex-wrap (2 строки).
- ПЛ: русский язык, ПМ/каталог/длина цикла (16/20/24)/блины — попап-карточки; выбор недель сеткой (помещается на телефон); MetricCard «Итоги мезоцикла» и «ПМ на неделю»; SaveButton с фидбеком; карточки «Рекомендован» раскрываются.
- Выполнение перенесено во «Тренировки» (убрано из SRCBBScreen → runtime через he_pl_runtime + SessionPlayer); дневник StrengthDiary.getWorkoutLogs объединяет IndexedDB + localStorage (выполнения учитываются).
- TrainingScoreEngine — только в «Восстановлении».
- readiness (вес/сон/стресс/усталость) — наверх на всех группах.
- ББ: план таблицами-карточками, оформление как в ПЛ (попапы/ExpandableCard).
- Методики: Volume Landmarks (фильтр уровня) и визуализация сплитов (интерактив, раскрытие дней).
- Ручной конструктор: попапы выбора сплит/цикл(категории)/программа/периодизация/прогрессия/интенсивность/техника/объём/частота.
- «Упражнения» разделены: каталог + «Калькулятор упражнений» (ExerciseCalcTab).
- «Расчёт объёма и оптимизация» (VolumeOptimizerTab): MEV/MAV/MRV, рекомендации, подбор упражнений.

### ⚠️ Интерпретация
- «Убрать дублирующие подвкладки СРЦ/ББ/Ручной» реализовано как удаление дубля внутри SRCBBScreen; единый селектор ПЛ/ББ/Ручной в TrainingScreen оставлен (иначе невозможно выбрать ПЛ/ББ). Если требуется скрыть и его — нужно решение пользователя о способе выбора ПЛ/ББ.
- Параллельный агент (Питание/БАДы/BioStack) работает в тех же файлах BioStack*. По моим файлам: tsc 0 ошибок, vite build OK.

## Session Summary (Jun 29 — Training/Planning block, Part 5 — правки по замечаниям)

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **ББ оформлен полностью в стиле ПЛ**: план теперь имеет выбор недели (сетка номеров), подневные таблицы-карточки для выбранной недели, MetricCard «Итоги мезоцикла» (всего сетов, тяж%, памп%, средний RIR) и таблицу «Объём по мышцам» (сетов/тяж/памп). Раньше ББ показывал только неделю 1.
- **Ручной конструктор** (вкладка «🛠️ Ручной конструктор», programcalc): добавлена карточка «⚙️ Ручная конфигурация программы» с попапами (PopupSelect) выбора ВСЕХ параметров: Тип сплита (все TRAINING_SPLITS), Тип цикла (все LMS_CYCLES по категориям СРЦ/блок/встроенная), Программа (FULL_PROGRAM_LIBRARY+WOMENS_PROGRAMS+CUSTOM_PROGRAMS), Периодизация, Прогрессия, Интенсивность, Техника, Объём, Частота (getMethodsByCategory). Выбранный сплит переопределяет авто-подбор на шаге 1. Раньше сплит выбирался только авто, остальных параметров не было.
- **Калькулятор тренировочной нагрузки полностью переработан**: новый TrainingLoadCalculator.tsx во вкладке «Калькуляторы» — ввод sRPE-сессий (дата/RPE/длительность), расчёт острой (7д EWMA) и хронической (28д) нагрузки, ACWR с зоной (недотрен/оптимум/осторожно/опасно) + шкала, монотонность и strain, Fitness-Fatigue (Banister: fitness/fatigue/performance + пик), график дневной нагрузки за 7 дней, рекомендации, журнал сессий. Использует движок 	rainingLoadReport + sRPE-стор. Раньше был слабый блок «Острая/Хрон./A:C» из volumeMultiplier×вес.

### ⚠️
- В проекте 2 ошибки типов в support-calculator.engine.ts/SupportScreen.tsx (PharmaStackData: hasMGF, hasGLP1) — это файлы параллельного агента (БАДы/Support), не тренировочного блока. По моим файлам tsc 0 ошибок, vite build OK.

## Session Summary (Jun 29 — Training/Planning block, Part 6 — ручной конструктор + библиотека + расширение

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **Ручной конструктор перепроектирован в единую страницу сверху-вниз** (вкладка «🛠️ Ручной конструктор», programcalc):
  - «⚙️ Базовые параметры»: Цель, Уровень, Дней/нед, Длина мезоцикла (12/16/20/24) — попапы.
  - «⚙️ Ручная конфигурация программы»: кнопки-карточки с попапом выбора — Тип сплита (все TRAINING_SPLITS), Тип цикла (все LMS_CYCLES, категории СРЦ/Блок/Встроенная), Программа (FULL_PROGRAM_LIBRARY+женские+пользовательские), Периодизация, Прогрессия, Интенсивность, Техника, Объём, Частота (getMethodsByCategory).
  - Кнопка «🔧 Собрать программу по конфигурации» → готовый результат: план по дням таблицей (упражнение/сеты×повт/RIR/группа/отдых) через calcExercisePrescription, сводка выбранных параметров, «💾 Сохранить в Мои тренировки».
  - Прежний 4-шаговый мастер свёрнут за тумблером «▼ Расширенный пошаговый мастер» (по умолчанию скрыт) — страница чистая.
- **Создана вкладка «📚 Библиотека»**: справочник — каталог всех циклов (СРЦ/блоки/встроенные) с полным описанием в ExpandableCard, библиотека программ (ProgramsTab), методики с подробным описанием + Volume Landmarks + визуализация сплитов (MethodsTab). Методики убраны из навигации планирования в Библиотеку.
- **Калькулятор тренировочной нагрузки расширен**: добавлены тренд недельной нагрузки (4 нед), блок «Целевая хроническая нагрузка» (ввод цели → рекомендованный диапазон острой 0.8–1.3×, статус в диапазоне/вне, конкретная дельта ±%, рекомендация разгрузки при ACWR>1.5).已有的 ACWR/монотонность/strain/Banister/график/рекомендации/журнал сохранены.

### ⚠️
- 2 ошибки типов в support-calculator.engine.ts/SupportScreen.tsx (hasMGF/hasGLP1) — файлы параллельного агента (БАДы/Support), не мои. По моим файлам tsc 0 ошибок, vite build OK.

## Session Summary (Jun 29 — Training/Planning block, Part 7 — предложения A–F реализованы)

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **A/A2 — Сохранение планов ПЛ и ББ**: вводы и построенный план пишутся в localStorage (he_pl_session/he_bb_session) и восстанавливаются на маунте — план не теряется при перезагрузке/смене трека.
- **B/E — Визуальные календари мезоцикла** (ПЛ и ББ): сетка недели×дни с цветом фазы (ПЛ) / объёмом сетов (ББ) и тоннажём, клик по неделе → переход. Даёт обзор всего мезоцикла.
- **C — Кнопки «Применить» на карточках «Рекомендован»**: ПЛ → устанавливает выбранный цикл и собирает план; ББ → собирает план по рекомендованному сплиту.
- **D — Калькулятор тоннажа/КПШ/интенсивности/УОИ** (TonnageCalculator.tsx) во вкладке «Калькуляторы»: ввод 1ПМ + строк подходов (вес×повт×подходы) → тоннаж, КПШ, средний вес, УОИ (% к 1ПМ).
- **F — График прогрессии ПМ по неделям** (ПЛ): SVG-линейный график присед/жим/тяга по неделям мезоцикла.

### ⚠️
- 2 ошибки типов в support-calculator.engine.ts/SupportScreen.tsx (hasMGF/hasGLP1) — файлы параллельного агента (БАДы/Support), не мои. По моим файлам tsc 0 ошибок, vite build OK.

## Session Summary (Jun 29 — Training/Planning block, Part 8 — ПРО-качество программ)

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **ББ: реальные веса вместо хардкода** — добавлен ввод «Рабочие максимумы (кг)» по 10 мышцам (PopupNumber), передаётся в uildBBPlan({ workMax: bbWorkMax }) и персистится в he_bb_session. Раньше веса были захардкожены (chest:100…).
- **Ручной конструктор: реальные веса** — добавлен ввод рабочих максимумов (Грудь/Спина/Ноги/Плечи/Руки/Кор) + расчёт веса = workMax×%1RM(RIR) (PCT_FOR_RIR) + колонка «Вес» в таблице результата. Раньше весов не было вовсе.
- Оба исправления поднимают итоговые программы до уровня, где веса привязаны к реальным ПМ пользователя (основа ПРО-качества ПЛ/ББ).

### Анализ текущего состояния (по факту, из кода)
- **Две системы планирования сосуществуют (корректно):**
  - «📋 План тренировок» (training-periodization.engine) — универсальная периодизация: цель/уровень/сплит/тип периодизации (linear/undulating/block)/тип цикла (PL-сила, PL-пик, BB-масса, BB-спец, rehab, WL)/длина 4-8-12; кривые объёма, RIR-прогрессия, readiness/course-модификаторы, мезоцикл-секвенции. Уровень — ПРО.
  - «🏆 Силовой цикл / Бодибилдинг» (SRCBBScreen): ПЛ — реальные СРЦ-циклы из xlsm (профессиональные); ББ — сплиты + RIR-матрица + (теперь) реальные workMax.
- **Источники ПРО-качества присутствуют:** LMS_CYCLES (реальные циклы), RIR_MATRIX, VOLUME_REFERENCES (MEV/MAV/MRV), PERIODIZATION_METHODS, calcExercisePrescription, volume-landmarks.

### Предложения по улучшению (приоритеты)
1. **Отбор упражнений по релевантности + слабые группы** — в ручном конструкторе и ББ выбирать топ-соединения по скору calcExercisePrescription, с акцентом на weakPoints и без дублирования паттернов движений. (Сейчас — «первые 2 соединения + 2 изоляции».)
2. **Кап объёма по MRV** — при генерации плана суммировать сеты на мышцу за неделю и предупреждать/сокращать, если > MRV (анти-перетрен). Использовать VOLUME_REFERENCES.
3. **Единый «Профиль тренированности»** — общая карточка ввода (ПМ/workMax, weakPoints, оборудование, recovery, дней/нед), переиспользуемая ПЛ/ББ/ручным/калькуляторами → все расчёты на одних реальных данных.
4. **Фильтр по оборудованию** — доступный инвентарь → фильтр каталога упражнений.
5. **Сшивка план↔выполнение↔дневник↔нагрузка** — построенный план → выполнение → sRPE → ACWR → обратная связь в следующий план (readyness-модификатор уже есть, нужно пробросить sRPE-данные в readiness).
6. **Унификация хранения** — один источник «Мои планы» с загрузкой обратно в конструктор для редактирования.
7. **Графики прогрессии ББ** (RIR/объём по неделям) — аналог графика ПМ для ПЛ.
8. **Валидация/гардраилы** — предупреждения при превышении MRV, при ACWR>1.5, при несовместимости цель↔уровень.


## Session Summary (Jun 29 — Training/Planning block, Part 9 — Единый профиль тренированности)

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **Единый «Профиль тренированности»** — общий источник реальных входных данных для ПЛ/ББ/ручного конструктора/калькуляторов:
  - 	raining-profile.ts — стор localStorage('he_training_profile') + хук useTrainingProfile() (профиль: bodyWeight, goal, level, daysPerWeek, recovery, fatigue, sleep, stress, weakPoints, equipment, pmSquat/pmBench/pmDead, workMax по мышцам).
  - TrainingProfileCard.tsx — карточка ввода (ПМ, workMax по группам, слабые группы, оборудование, recovery/fatigue/sleep/stress, дней/нед, вес тела).
  - **Ручной конструктор**: карточка профиля вверху; локальные состояния (goal/level/days/recovery/fatigue/weakPoints/bodyWeight) синхронизируются из профиля; generateManualPlan берёт workMax из профиля.
  - **ПЛ (SRCBBScreen)**: pmSquat/pmBench/pmDead/bodyWeight инициализируются из сессии → профиля; ПМ теперь персистятся в he_pl_session (раньше терялись) и синхронизируются в профиль.
  - **ББ (SRCBBScreen)**: bbWorkMax инициализируется из профиля (merge) и синхронизируется обратно в профиль.
  - Итог: ПЛ ПМ, ББ workMax и ручной конструктор используют ОДНИ реальных данных пользователя.

### ⚠️
- 2 ошибки типов в support-calculator.engine.ts/SupportScreen.tsx (hasMGF/hasGLP1) — файлы параллельного агента (БАДы/Support), не мои.

## Session Summary (Jun 29 — Training/Planning block, Part 10 — фильтр оборудования + обратная связь нагрузки)

### ✅ Сделано и проверено (tsc по моим файлам 0 ошибок, vite build OK, UTF-8 noBOM)
- **Фильтр упражнений по оборудованию**: отбор в ручном конструкторе и пошаговом мастере теперь фильтрует каталог по 	profile.equipment (доступный инвентарь), с fallback на полный каталог, если по фильтру ничего не нашлось. Профиль тренированности задаёт доступное оборудование → генератор не предлагает упражнения со штангой, если её нет.
- **Обратная связь нагрузки в карточке готовности**: в верхней карточке «Готовность к тренировке» добавлена строка «Нагрузка» — ACWR из реальных sRPE-сессий (loadSRPESessions → cuteChronicRatio) с зоной (недотрен/оптимум/осторожно/опасно) и цветовым баром. Таким образом sRPE-дневник виден прямо в плане. (PL-авторегуляция уже использует sRPE ACWR для коррекции объёма/весов плана.)

### ⚠️
- 2 ошибки типов в support-calculator.engine.ts/SupportScreen.tsx (hasMGF/hasGLP1) — файлы параллельного агента (БАДы/Support), не мои.

## Session Summary (Jun 29 — Training/Planning block, Part 11 — load-back, BB chart, MRV guardrail)

### ✅ Сделано и проверено (tsc: 0 ошибок в моих файлах; UTF-8 noBOM)
- **Загрузка сохранённого плана обратно в конструктор**: в ручном конструкторе добавлена секция «📁 Сохранённые программы» — список планов из myTrainingPlans (с days+cfg), кнопка «↩ Загрузить» восстанавливает manualCfg + manualResult (план и конфигурацию) для повторного редактирования/генерации; кнопка удаления; список обновляется после сохранения. Замыкает цикл «сохранить → загрузить → доработать».
- **График прогрессии ББ**: SVG-график «Прогрессия объёма и RIR по неделям» (бары — сеты/нед, линия — RIR) в плане ББ. Аналог графика ПМ для ПЛ.
- **MRV guardrail в ББ**: в таблице «Объём по мышцам» добавлена колонка MRV; если сетов на мышцу > MRV — значение красным + ⚠ (анти-перетрен визуализация).

### ⚠️ Блокировка сборки проектом (не мои файлы)
- ite build сейчас падает из-за синтаксических ошибок в src/ui/screens/SupportScreen.tsx (6007–7003) — это файл **параллельного агента** (блок БАДы/Support), находящийся в состоянии правки. По моим тренировочным файлам 	sc --noEmit ошибок нет (все 18 ошибок — в SupportScreen.tsx). Не трогаю чужой файл, чтобы не конфликтовать с параллельным агентом.