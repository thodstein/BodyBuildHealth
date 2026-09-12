# Планировщик единоборств PRO — план доработки

**Дата:** 12 сен 2026 · **Автор:** OpenCode (Muse Spark) · **Область:** `src/engines/combat/*` (34 файла) + `src/ui/screens/combat/*` (4 файла)
**Предшественник:** `docs/COMBAT_STRENGTH_AUDIT_PRO_PLAN.md` (28 авг 2026, общий combat+strength-sport, фазы P0–P3) — настоящий план сужает фокус **только до единоборств** и доводит его до исполнимых эпиков P1–P7. Strength-sport/ТА идёт отдельным планом и здесь не трогается.
**Исходный уровень:** изолированный конструктор (34 движка, 13 именных циклов, 5 сплитов, ISSN-весогонка, ATR, тапер к дате боя, ACWR/VBT/HRV, печать CSV/HTML/ICS/XLSX; движковые тесты ~19 файлов + 2 UI-теста, `tsc 0` на момент аудита).

---

## §1. Аудит — карта и дефекты D1–D12

### 1.1 Карта файлов (проверено чтением + разведкой)

**Движки `src/engines/combat/` (34 файла, ~2900+ строк):**

| Файл | Назначение | Ключевые точки |
|---|---|---|
| `combat.types.ts` (138 строк) | Канон типов | `CombatDiscipline/Goal/Level/Phase/FightStyle`, `CombatInput` 12–67, `CombatPlan` 115–130 |
| `combat-builder.engine.ts` (729 строк, самый большой) | Генератор плана | `POOL_BY_TAG` 30–36, `CB_EX_META` 41–109 (~70 id), `buildCombatPlan` 312, валидация-пустышка 703–704, `validateCombatPlan` 743–745 |
| `combat-finalize.engine.ts` | Проверки + авто-трим + отчёт | `finalizeCombatPlan` 12, `trimToMRV` 51–67, multiplanar-neck 91–96, prehab-auto `face_pull` 99–110, `buildCombatReport` 173 |
| `combat-weight-cut.engine.ts` (269 строк) | Весогонка ISSN — сильная сторона | `WeightCutProtocol` 12–27, `getWeighInTypeForDiscipline` 29, `buildWeightCutProtocol` 37, `weightCutVolumeMultiplier` 79, `weightCutFiberForWeek` 90, `weightCutNutritionForWeek` ~143, `validateWeightCutProtocol` 226, `weightCutSafetyBanner` 248, `confirmedManipulation`-гейт 49–53 |
| `combat-taper.engine.ts` (69 строк) | Тапер к дате боя | `fightWeekIndex` 20, `isTaperByFightDate` 43, `taperVolumeMultiplier` 0.65/0.45/0.55 (50), `buildTaperRationale` 64 |
| `combat-sparring.engine.ts` (80+86) | Спарринги → OutsideLoad | `SparringLoad` 10–16, `sparringWeeklyLoad` 18, `sparringToOutsideLoad` 27, `validateSparringLoad` 69, `normalizeSparringLoad` 78 |
| `combat-monitoring.engine.ts` (134+145) | ACWR / HRV / VBT-зоны | `combatACWR` 9, `combatACWRFromLoads` 19, `vbtVelocityForPct` 36, `vbtRecommendation` 40, `hrvGrade` 49, `loadHrvHistory` 65, `combatHrvReport` 118, `hrvEwma` 127 |
| `combat-vbt.engine.ts` (119+133) | VBT-обёртка над `pro/vbt` | `mapCombatLift` 19, `velocityForCombat` 30, `estimate1RMFromVelocityCombat` 35, `diagnoseVelocityLossCombat` 41, `loadVbtHistoryCB` 67, `vbtEwma` 101, `vbtHistoryForLift` 110 |
| `combat-diary.engine.ts` (145+154) | Per-group e1RM-тренд 28д | `DiaryTrendCB` 7, `groupForExercise` 18, `buildDiaryTrendCB` 30, `gripIsometricVolume` 81, `loadDiaryLogsCB` 91 |
| `combat-integration.engine.ts` (79+85) | Мосты питание/кардио | `combatDiaryStatsFromSessions` 15, `combatToNutritionPayload` 23, `combatToCardioPayload` 56, `combatNutritionEventPayload` 81 |
| `combat-periodization.engine.ts` (161+170) | ATR 5/3/2 + linear + conjugate | `atrBounds` 36, `isDeloadWeekATR` 56, `isTaperWeek` 71, `phaseForCombatWeekATR` 83, `conjugateMethodForSession` 127, `rirForCombatPhase` 147, `repsForCombatPhase` 157 |
| `combat-conditioning.engine.ts` (189+197) | Кондиция (3 системы) | `modalityForWeek` 35, `conditioningSessionsForWeek` 45 (outside≥5 → Zone2 30′ в 51–56) |
| `combat-neck.engine.ts` (121+132) | Шея 2.0 | `NECK_EXERCISES` 28, `NECK_IDS` 44, `NECK_LEVELS` 46, `neckWeeklyPlan`, `neckVolumeCheck` |
| `combat-core.engine.ts` (70+75) | Core 4+1 | `CoreFunction` 6, `CORE_LEVELS` 18, `coreWeeklyPlan` 57–60 (дефолты `0` — подозрительно) |
| `combat-selection.ts` (186+196) | Отбор: углы/тиры/strict | `CB_ANGLE_CLASSES` 6, `CB_STRICT_GROUPS` 42, `cbStrictGroupFor` 52, `CB_TIER` 57, `filterByTierCB` 69, `filterByInjuryCB`, `gentleFactorForCB`, `repsCapForCB` |
| `combat-split-patterns.ts` (140+144) | Сплиты 2–4×/нед | `COMBAT_PATTERNS` 16 (`combat_2a/2b/3/3b/4`), `recommendCombatPattern`, `validateCombatPatterns` 136 |
| `combat-cycle-library.ts` (126+130) | 13 именных циклов | `COMBAT_CYCLE_LIBRARY` 25 (`cb-box-*/cb-wrestle-*/cb-mma-*/cb-kick-*/cb-general-*`), `getCombatCycle` 113 |
| `combat-annual.ts` (198+206) | Год ATR + соревнования | `AnnualCB/Block/Competition` 7–10, `he_combat_annual_v1` 11, `buildAnnualFromCB` 17 (legacy), `buildAnnualATR` 31, `buildAnnualPrintHtml/Ics`, `addCompetitionToAnnual` |
| `combat-storage.ts` (88+95) | Персист `he_combat_*` | `save/load/loadCombatPlans` 9/60/69, `migrateCombatPlan` 20, кап 20 (16), `migrateAllCombatStorage` 79–86 (вызовов в UI нет) |
| `combat-mesocycle.ts` (65+69) | Кросс-мезо +2.5/+1 | `applyCombatMesocycle` 13, `combatMesocycleSummary` 61 |
| `combat-print.engine.ts` (77) / `combat-xlsx.engine.ts` (135) | Печать HTML/CSV/ICS / XLSX | `buildCombatPrintHtml/Csv/Ics`, `buildCombatXlsxHtml/Buffer` (Gantt + весогонка-блоки в обоих — дубль) |
| `combat-volume.ts` (57+60) | MEV/MAV/MRV | `COMBAT_LANDMARKS` 9, `getCombat` 52, `checkStatus` 55 |
| `combat-limits.ts` (27) | Лимиты сессии | `sessionLimitsForCombat` 4 (18/6 → 30/10), `validateSyncCombat` 14 |
| `combat-mobility.ts` (40+41) | Мобильность + осевая | `RESTRICTED` 4, `filterByMobilityCB` 21, `AXIAL_IDS_CB` 26 (есть чужие `yoke/stone/log_press` — в combat-пуле не срабатывают) |
| `combat-ped-adaptation.ts` (100+107) | PED кап 1.35 | `adaptForPEDsCombat` 37, `curveAAS/GH/Insulin` 17/25/31 |
| `combat-workmax.ts` (208+214) | Веса | `DEFAULTS` 11, `weightForCombatExerciseResolved` (точный → групповой → эвристика) |
| `combat-day-types.ts` (27) / `combat-progression.ts` (20) | Legacy | маппинг `sessionTag`; старая linear-прогрессия — дубль ATR при дефолте `atr_10` |
| `combat-loading.ts` (38) | Темп/отдых | `tempoForCB`, `restForCB` |
| `combat-dup.ts` (44) / `combat-intensity.ts` (36) / `combat-specialization.ts` (28) | DUP / техники / акценты | `applyCombatDUP`, `applyCombatIntensity`, `accentForDiscipline/accentForFightStyle` (грубо ×1.2) |

**UI `src/ui/screens/combat/` (4 файла, ~2060 строк):**

| Файл | Назначение |
|---|---|
| `CombatConstructor.tsx` (~1168+1216 строк, god-file UI) | 7 шагов params→athlete→outside→split→plan→quality→export (`STEP_LABEL_RU` 40–48, `STEP_GROUPS` 49–53), ~50 стейтов через `useCombatWizard`, сборка `buildCombatPlan+finalizeCombatPlan`, весогонка, спарринг, питание/кардио-мосты, VBT, дневник, HRV. Инлайн-карта весов `bench_bar/row_bar/...` (390). Возраст `min 14` (661), female RED-S баннер (852) |
| `CombatPlanView.tsx` (409+434) | Рендер плана. `CbQualityMap` 52 (пересчёт шея/хват/core), `CbMesoCard` 87, `CbDiaryCard` 103, `CombatPlanView` 122. Питание-копипаста в буфер + `he_combat_meal_preview` 186–193. ICS-скачивание 427 |
| `CombatUI.tsx` (490+528) | UI-кит (фиолет `#a855f7`/`#ec4899`). Токены `CARD/CARD_ACCENT/CARD_HERO` 36+, `TEXT_3=#fff` 26, `CombatPopupSelect/CombatPopupNumber`, `CbSwitch`, словари `EQUIP_RU/MOBILITY_RU/LEVEL_RU/PHASE_RU/ZONE_RU` |
| `useCombatWizard.ts` (127+132) | Стейт визарда. Дефолты `mma/power/intermediate/6нед/3дн` 20–24, `outside` 38, спарринг 1/2/1 (40–42), `sex male/age 28` 52–53, `workMax` групповой 65, ручной ACWR-подсчёт из `he_srpe_sessions` 81–99, `combatHrvReport/loadVbtHistoryCB` 100–108 |

**Тесты:** `src/engines/combat/__tests__/` ~19 файлов (builder/matrix/pro/phase6/p2-polish/guarantees/issn-pro-max/integration-diary/integration-apply/cycle-library/balance-limits/dup-intensity/export-ru/extra-coverage/final-polish/polish-final/swap-meta/v2-polar/mesocycle-guard) + `src/ui/screens/combat/__tests__/` 2 файла (switch-sheet, quality-cards).

**Интеграция:** `planner-bridge.ts:30` — `PlannerApplyKind` = 21 вид, **`combat` отсутствует** (есть `arm_cycle/ss_cycle/cardio`, нет `combat_cycle`); `planner-bridge-handlers.ts:736–762` — без `combat`. Исходящие — только нетипизированные: `CombatConstructor.tsx:317–319` пишет `he_combat_nutrition_payload` + `he_combat_cardio_payload` + `dispatchEvent(he-combat-updated)`; `CombatPlanView.tsx:186` — `he_combat_meal_preview` + clipboard. Потребитель кардио-части живёт в `CardioConstructor.tsx:346–384,1263–1269` (кнопка «Применить Zone2»). Хаба диагностики единоборств нет (7 хабов в проекте — WL/Strongman/Quality/BB/Armlifting/ArmDiagnostics/Diagnostics; combat отсутствует). Монтирование: `TrainingScreen.tsx:32,712`, трек `combat` в `nav.ts:102,109`, `shared.ts:140–145`.

### 1.2 Дефекты D1–D12 (каждый подтверждён чтением)

- **D1. Валидации-гейта нет — `errors` всегда пуст.** `combat-builder.engine.ts:703–704` (`const errors=[]`, ни одного `push`), `743–745` (`validateCombatPlan` возвращает `plan.validation`), `combat-finalize.engine.ts:12–16` (только копирует). Перегруз `weeklyLoad>1500 + 4× зал` (705), весогонка `>3 кг без weight_cut` (708), отсутствие шеи (712–713), превышение бюджета (719) — только `warnings`. Инвалидный план программно неотличим от валидного.
- **D2. Входящего `planner-bridge` нет.** Нет `combat_cycle` kind + приёма `weakpoints/diagnostics/ortho` (в отличие от arm/strength). Вход — только ручной выбор в сплите; диагностика/орто/лаборатория в план не попадают. Исходящее — нетипизированные `localStorage he_combat_*` + clipboard.
- **D3. Хаба диагностики единоборств нет.** Нет точек «слабые фазы удара/тейкдауна», bar-path, асимметрии, concussion-анамнеза первым классом — только шея-блок и строки про шею (`combat-neck`, `finalize:87`, `builder:184`).
- **D4. Teen-гейта нет при `min 14`.** `CombatConstructor.tsx:661` разрешает 14 лет, дефолт 28. Ни запрета весогонки `<16/18`, ни бана `hard spar / борцовский мост / depth_jump / sled` подросткам, ни перевода шеи в `isometric only`. В движках `teen` — 0 совпадений.
- **D5. Женские нормы — только веса и RED-S floor.** `combat-builder.engine.ts:268–274` (шея ×0.70, хват ×0.80, carry ×0.90, жимы ×0.88), `weight-cut:196–206,233–234` (жиры 0.8, floor 1400, сгонка >5% warning), баннер (852). Нет весовых категорий Ж, нет лютеиновой фазы в периодизации/ACWR, нет `iron/calcium` нот.
- **D6. Весовых категорий нет.** `AnnualCBCompetition.weightClass?:string` (`combat-annual.ts:9`) — свободный текст, в печати/ICS только `esc()`. Нет таблиц бокс/MMA/борьба М/Ж, нет `weightClassFor/boundary`-арифметики — весогонка считает кг в вакууме.
- **D7. Travel-режима нет.** Поиск `travel/jetlag/перелёт` в `src/engines/combat` — 0. Нет hotel/bodyweight-фолбэка, нет сдвига тапера при перелёте, нет связки `same_day_2h` + travel. Equipment-fallback ×0.85–0.90 (`builder:275–300`) покрывает зал, но не дорогу.
- **D8. Тапер хрупкий к датам.** `combat-taper.engine.ts:20–41` — любая невалидная `fightDate/startDate` (включая `2025-02-30`) молча возвращает `totalWeeks`, т.е. тапер прячется в конец без ошибки. `taperWeeks` клампится `1–2` (46,54) без warning. Три источника «тейпера» (`weight-cut:72–77` + `periodization:71` + `isTaperByFightDate`) могут рассинхронизироваться.
- **D9. Спарринг-безопасность неполная.** `validateSparringLoad` (`combat-sparring.engine.ts:69–76`) ловит только `>7 сессий / hard>3 / hard2+wrest3`. Нет бана `hard spar` в `fight_week/deload/taper`, нет гейта по `neck level / травме / ACWR dangerous / HRV dangerous`, нет concussion-протокола. `hardDays` по умолчанию `[1,4]/[2]` (38–39) могут лечь на тяж-ноги.
- **D10. ACWR считается из разнородных единиц.** `useCombatWizard.ts:83–99` суммирует `s.load || s.sRPE || s.rpe || 0` и `he_srpe_sessions || he_training_log`, делит на 7/28 без `toDailyLoads`. `combatACWRFromLoads` (`monitoring:19–26`) при `<28д` масштабирует среднее, искажая зону. В `buildCombatPlan` (`builder:343,353–357`) ACWR — лишь входной множитель 0.60/0.85/1.1, в UI чаще `null`.
- **D11. VBT — грубая обёртка с дефолтом `squat`.** `mapCombatLift` (`combat-vbt.engine.ts:19–28`): вся ротация/плио → `bench`, неизвестное → `squat`. Ударная баллистика калибруется кривой жима/приседа `pro/vbt`, combat-MVT нет. `vbtHistoryForLift` (110–113) матчит `includes` в обе стороны — `row` ловит `battle_rope`, `press` ловит всё. Порог по умолчанию 20 без привязки к `intent`.
- **D12. Персист хрупкий: кап 20, quota/sharing нет.** `combat-storage.ts:9–18` — `JSON.stringify` всего плана + списка 20 без try-quota, без IndexedDB, без облачного `cloud-kv`-ключа. `migrateCombatPlan` (20–58) правит фазы/дефолты, но битый `weeksData` пропускает; `removeCombatPlan` (88–95) чистит только один id.

**Дубли/гигиена (честно, в план не все входят):** `CB_EX_META` vs инлайн-карта весов в конструкторе (390); `vbtRecommendation` (monitoring:40) vs `vbtRecommendationCombat` (vbt:57); `hrvEwma` vs `vbtEwma`; ручной ACWR в визарде vs `combatACWRFromLoads`; тройной пересчёт шея/хват/ротация (finalize:43–46 vs PlanView:62–64 vs xlsx:34–36); `POOL_BY_TAG` vs `CB_ANGLE_CLASSES` vs `CB_STRICT_GROUPS`; `print` vs `xlsx` (Gantt + весогонка в обоих); `phaseForCombatWeek` (legacy) vs `phaseForCombatWeekATR`; `buildAnnualFromCB` (legacy-склейка) vs `buildAnnualATR`. P1–P7 закрывают только то, что влияет на корректность/безопасность; полный разрез god-file UI и дедуп печати — осознанно вне скоупа (риск сломать соседей ради косметики).

---

## §2. Интернет-синтез 2024–2026

Источники — веб-поиск Sep 2026 (ISSN position stand, BJSM/BMC/JAT, Boxing Science, UFC PI-обзоры, PoinT GO/369MMAFIT-практика). Выжимка только того, что меняет план.

### 2.1 Периодизация: ATR 5/3/2 + кэмп-структура MMA

- **Issurin ATR** (обзор Sports Medicine 2015; PoinT GO 2026): блоки Accumulation → Transmutation → Realization; остаточные эффекты: сила 30–40д, аэробная 25–35д, анаэробная мощность 18–24д, скорость/техника 2–7д. Порядок — от долгоживущих к короткоживущим. Длины: A 3–6, T 3–4, R 2–3 нед; полный макроцикл 8–13 нед, 2–4 цикла в год. Для единоборств типовой цикл **10 нед (5+3+2)**: A — база/гипертрофия/техника, T — макс. сила + анаэроб + спарринги, R — менеджмент веса + симуляция + мощность малым объёмом. Переход по адаптации, а не по календарю: **MCV на 65% 1RM +5% к старту блока** → в Transmutation; MCV на 75% = пик прошлого T → в Realization (VBT-критерий).
- **MMA-кэмп** (Davidenko et al. 2024, 18 нед / 2 блока × 3 мезоцикла): off-season 4×/нед (2 аэроб + 2 скорость-сила), кэмп 3×/нед через день; плио в начале сессии + штанга + спринты с недовосстановлением; итог EG vs CG: выносливость +18%, макс. сила +12%, активность ТТД +19.9%, эффективность ударки +43%, борьбы +19.1%.
- **UFC PI / Ruddock-модель** (годовая MMA-программа): preparatory — linear (intro → accumulation → peaking → deload), competitive — undulating; прирост объёма силы/мощности **2–5%/нед**; HIIT — главный метаболический метод кэмпа, сессии разделять **36 ч**; late camp — митохондрии/капилляризация + композиция под вес; **тапер 8–14 дней**, частота та же, объём −60…−85% (James et al.).
- **Вывод для плана:** ATR 5/3/2 уже в движке — оставить; добавить (а) VBT-критерий перехода блоков (P6), (б) правило 2–5%/нед и HIIT-разнос 36 ч в валидатор (P1), (в) тапер-дефолт 8–14 дней с сохранением частоты (P1/P7 вместо жёстких 1–2 нед без формулы).

### 2.2 Тапер: Bosquet + бокс-практика

- **Bosquet et al. 2007 (meta, 27 исследований):** средний выигрыш **+2.2±0.6%** (в пересказе PoinT GO — до 3%); объём **−41…−60%**, интенсивность сохранить/повысить, экспоненциальный fast-decay > step; оптимум **14–21 день** (дольше кэмп → дольше тапер). Снижение объёма <20–30% — недостаточно; >60–70% — детрейн.
- **Boxing Science (тапер бокса):** сила и кондиция тейперятся **раздельно** (разные скорости восстановления); сила → быстрые взрывные + punch-specific (медболы, landmine punch throws), 60–75% 1RM с макс. намерением; кондиция-тапер дольше, старт за 3 нед, короткие HIIT (10с спринты, Tabata 20/10, 30/15) без смены типа интервалов (не прыгать с 2–8-мин на 25+ км/ч — травма); мобильность верха (грудной отдел/плечо) в приоритете.
- **Fight-week практика (Lau 2025; 369MMAFIT 2026):** дни 14–10 — S&C 50% объёма, последний тяжёлый спарринг; дни 9–5 — S&C 30% или только нейро-активация (3–5 взрывных сетов), спарринг только technical 50%, дриллинг полным объёмом; дни 4–1 — без S&C, тень 2–3 раунда 50% + пады легко, сон 9 ч, знакомая высокоуглеводная еда. Мониторинг: мощность/CMJ/e1RM топ-сета/готовность еженедельно.
- **Вывод для плана:** текущий `0.65/0.45/0.55` — внутри канона, но без формулы длительности и без раздельных кривых сила/кондиция; чинить в P1 (экспоненциальный тапер + длительность от объёма кэмпа + отдельные мультипликаторы S&C/conditioning/sparring) и P7 (fight-week шаблон 14–10/9–5/4–1).

### 2.3 Весогонка: ISSN position stand 2025 (16 пунктов, Ricci et al., JISSN)

Канон, против которого сверяется движок (совпадения и пробелы — честно):

1. Категории/взвешивание/частота стартов определяют стратегию. 2. Бой >4 мин — аэробка >70%, алактат+гликолиз — всплески. 3. Вне кэмпа держать **+12…15%** к лимиту. 4. Креатин/бета-аланин/HMB/кофеин — поддержка фаз. 5. Кэмп — стратегический дефицит (Mifflin St Jeor / Cunningham или калориметрия). 6. Полы макронутриентов: **угли 3.0–4.0 / белок 1.2–2.0 / жиры 0.5–1.0 г/кг/сут** — ниже нельзя. 7. Допустимые потери: **6.7% за 72 ч / 5.7% за 48 ч / 4.4% за 24 ч**. 8. Na-рестрикция + water loading → полиурия/острая потеря. 9. Fight week: деплиция гликогена (упражнения + У-рестрикция) **1–2%**, клетчатка **<10 г/сут × 4 дня** — ещё 1–2%. 10. Острая дегидратация (сауна/горячая ванна/обёртывания) **2–4% за 24 ч** под наблюдением. 11–15. Пост-взвешивание: **ORS 1–1.5 л/ч + Na 50–90 ммоль/дл** первым делом; быстрые угли **≤60 г/ч** следом; клетчатку ограничить; угли **8–12 г/кг** (глубокая деплиция) или 4–7 г/кг (умеренная); цель — **+≥10% массы** к бою. 16. Долгосрочные эффекты частых сгонок неизвестны.
- Дополнительно (GSSI/Reale): старт AWL — из эугидратированного состояния; окно восстановления решает величину: **>12 ч → до 8%**, **≤6 ч (утро боя) → ≤5% (лучше ≤3% дегидратацией)**; регидратация 125–150% дефицита; ORS 50–90 ммоль Na (спортнапитки <30 — слабы, добавить солёную еду); вода 7.5→0.5 л (Frontiers 2025: −10.6% за 7 дней, +11.2% за 30 ч, 67.7% побед — но только под наблюдением, детям <18 и почечникам запрещено).
- **Сверка с движком:** water `load_cut 8→2л` / Na `5→3→1.5г` / carb `4→1→8 г/кг` / fiber `<10г` / ORS 65 / рефид 125–150% / `weighInType day_before vs same_day` / `confirmedManipulation`-гейт >5 кг — **всё уже по канону**. Пробелы: нет весовых категорий (кг в вакууме), нет полов 3–4/1.2–2/0.5–1 как гейта, нет правила «same-day → ≤5% и stable-манипуляции», нет ORS-протокола по часам и углей 8–12 vs 4–7 по глубине деплиции, нет требования +12…15% вне кэмпа. → P4.

### 2.4 Шея/сотрясения: Collins + BJSM Delphi 2025

- **Collins et al. 2014 (n=6704):** каждый фунт (+0.45 кг) силы шеи −5% шансов сотрясения (OR 0.95). База, на которой стоит `combat-neck`.
- **BJSM Delphi 2025 (Fownes-Walpole et al., 21 статья + 18 экспертов, 57 стейтментов):** шея — всем в спортах с head acceleration events; периодизация, изометрия всех направлений + квази-изометрия, RFD и trunk-neck-coupling; побочек не reported.
- **Клинические пороги (подростки регби):** экстензия **<32.1 кг или <3.71 N/кг** → риск ×3–5; **flex/ext >0.74** → риск ×3 (взрослые профи: cutoff ~41 кг).
- **JOSPT meta 2023:** связь силы шеи и сотрясений — малая, незначимая (r=0.08–0.14), гетерогенность I²>90% — честная оговорка: шея ≠ гарантия, а модифицируемый фактор.
- **Вывод для плана:** движок шеи уже 2.0 — не переписывать; добавить (а) flex/ext-баланс и cutoff-гейты в валидатор (P1), (б) concussion-анамнез + return-протокол как первый класс (P3), (в) честную формулировку «модифицируемый фактор, не гарантия» (P3).

### 2.5 Нагрузка: ACWR RA vs EWMA + таэквондо-оговорка

- **BMC meta 2025 + Fedotova 2025 + Frontiers 2020:** sweet spot **0.8–1.3**; EWMA (λ=2/(N+1)) чувствительнее RA на высоких значениях; при низкой нагрузке оба эквивалентны (RA проще); coupled vs uncoupled — uncoupled чище; окно 7/28 стандарт, 7/21 — чувствительнее к бесконтактным.
- **Lee et al. 2025, J Athl Train (тхэквондо, 110 атлетов, 841 травма, 3 года):** максимум травм — в **умеренной зоне 0.8–1.3** (41% RA / 50% EWMA), а не в высокой. Оговорка: связь нагрузка↔травма видоспецифична; «sweet spot» командных игр ≠ единоборства в лоб.
- **Каратэ ECSS 2024:** sRPE × время — рабочая единица; ACWR связан с S&C/технической/недельной нагрузкой (регрессия).
- **Вывод для плана:** P6 — EWMA-uncoupled как осознанный дефолт (с RA-фолбэком при <28д истории и честной пометкой «зона 0.8–1.3 — ориентир, не гарантия; в ударных видах травмы сидят и в sweet spot»).

---

## §3. Эпики P1–P7 (каждый — с критериями приёмки)

### P1. Честная валидация + тапер по канону (ядро, без него всё остальное — косметика)

**Проблема:** D1 + D8. `errors` всегда пуст; тапер 1–2 нед без формулы длительности, три источника рассинхронизированы.
**Делаем:**
- `validateCombatPlan`/`finalizeCombatPlan`: вводятся блокирующие `errors` (а не только warnings): (а) fight-week объём >65% пика при `fightDate` в плане; (б) весогонка >5% массы тела без `weight_cut`-режима; (в) `same_day_2h` + сгонка >5% (любая); (г) шея <MEV при `hardSpar>0`; (д) `weeklyLoad>1500 + 4× зал` без снижения дней; (е) HIIT-сессии <36 ч друг от друга в кэмпе. Остальное — warnings как сейчас. UI: красный стоп-блок с перечнем (как `needsMedicalBlock` в кардио), сборка не «зелёная» при errors.
- Тапер: единый источник — `combat-taper` (источники `weight-cut`/`periodization` делегируют ему, дубли не плодятся). Экспоненциальный fast-decay: длительность от объёма кэмпа (2×/день → 14 дней; 4–5×/нед → 7–10 дней); кривые раздельные: S&C 0.50→0.30→нейро-активация, conditioning −40…−60% (тип интервалов не менять), sparring hard→0 к дням 9–5 (только technical 50%), дриллинг полным объёмом; интенсивность сохранить/повысить, частота та же. Невалидные даты → `error`, а не молчаливый `totalWeeks` (D8 чинится гейтом, поведение честное).
- VBT-критерий перехода ATR: MCV-тест на 65%/75% 1RM (см. P6) как опциональный `proposed_extend/shrink` блока.
**Тесты:** `combat-pro-validation`: errors на каждый из 6 гейтов; тапер-матрица (объём fight-week ≤65%, интенсивность не ниже, частота та же, раздельные кривые S&C/cond/sparring); даты-мусор → error.
**Критерий:** ни один из 6 гейтов не проходится молча; taper-объём в каноне Bosquet/Boxing Science.

### P2. Мост `combat_cycle` + типизированные исходящие (интеграция)

**Проблема:** D2. Входа нет, исходящие — нетипизированные `localStorage` + clipboard.
**Делаем:**
- `planner-bridge.ts`: kind `combat_cycle` + payloads (cycleId/patternId/weeks/discipline/goal/fightDate/weightCutKg — по образцу `arm_cycle/ss_cycle`); `planner-bridge-handlers.ts`: `combatHandler` (приём цикла из каталога/библиотеки: валидация по `COMBAT_CYCLE_LIBRARY`, иначе честная ошибка «не найден»).
- Приёмник в `CombatConstructor`: ставит `cycleId` (+режим/недели/дни из шаблона) при монтировании и живьём (событие), как `ArmAutoConstructor`/`StrengthSportConstructor`.
- Приём диагностики/орто: `WeakpointsPayload`-расширение combat-полями (шея-уровень, flex/ext, асимметрия сторон, concussion-анамнез, mobility/axial) — только add-поля, сборка дефолтов 1-в-1; приёмник пишет в стейт + флеш (паттерн `sm-bridge-intake`).
- Исходящие типизировать: `combatToNutritionPayload/combatToCardioPayload` — через общий `nutrition-open-tab`-мост (как кардио `he_cardio_kcal_note`), а не копипаста в буфер; `he_combat_meal_preview` оставить, но строить из того же payload (один источник).
**Тесты:** `combat-bridge`: payload/трек/событие/баннер + оба приёмника (mount + live) + falsy-id + диагностика-маппинг.
**Критерий:** цикл из каталога собирается в конструкторе; диагностика доходит до плана; питание/кардио получают типизированный payload.

### P3. Безопасность: teen-гейт + concussion-протокол + спарринг-гейты

**Проблема:** D4 + D9 (+ шея-оговорка из §2.4).
**Делаем:**
- Teen (14–15 при разрешённом `min 14`): весогонка с манипуляциями запрещена (только `stable`, любой `load_cut/moderate_cut/deplete` → error); `hard spar` запрещён (только technical); борцовский мост/динамика шеи → только изометрия; `depth_jump/sled` — banned; дефолт-возраст и персист как сейчас. Формулировка «до 16 лет» честная (как в кардио P4).
- Concussion: анамнез (сотрясения за 12 мес: 0/1/2+) первым классом в Athlete-шаге; при ≥1 — обязательный `neck level ≥2` + `flex/ext ≤0.74` + тех-спарринг лимит; при ≥2 за год — мед-блок (сборка блочится с rationale «до врача», red-flags движок по образцу `cardio-red-flags`: 5 флагов + teen). Return-протокол: ступенчатый (покой → лёгкая аэробка → тех-работа без контакта → спарринг) с чек-листом.
- Спарринг-гейты: бан `hard spar` в `fight_week/deload/taper`; гейт по `ACWR dangerous / HRV dangerous / neck <MEV / травме`; `hardDays` не на тяж-ноги (авто-разнос с warning); neck-cutoff: экстензия <3.71 N/кг (или <32 кг абс.) → warning + тех-спарринг лимит. Честная подпись: «шея — модифицируемый фактор, не гарантия» (JOSPT-оговорка).
**Тесты:** `combat-safety`: teen-матрица (весогонка/hard/мост/плио — все блочатся); concussion-гейты (1 → лимиты, 2 → мед-блок); спарринг в fight-week/deload → error; cutoff-гейт.
**Критерий:** подросток не может собрать взрослый бойцовский план; сотрясение-анамнез меняет план, а не лежит строкой.

### P4. Весовые категории + честная весогонка по ISSN-16

**Проблема:** D6 (+ пробелы §2.3). Кг в вакууме, без категорий и полов.
**Делаем:**
- NEW `combat-weight-class.engine` (чистый, zero-runtime-риск): таблицы М/Ж — бокс (Olympic/Pro), MMA (UFC), борьба (UWW), дзюдо/самбо опционально вторым слоем; `weightClassFor/weightToClassBoundary/weightClassLine` (арифметика до границы, как `armlift-weight-class`). Категория — селект в Athlete-шаге (опционально, дефолт = текущее поведение без категории).
- Весогонка по ISSN-16: полы `У 3–4 / Б 1.2–2 / Ж 0.5–1 г/кг` как гейт (ниже → error); правило same-day (`same_day_2h` → сгонка ≤5%, все манипуляции `stable`, heat Sessions off — уже частично есть, довести до гейта); вне кэмпа — требование +12…15% к лимиту (warning, не блок); ORS-протокол по часам (1–1.5 л/ч, Na 50–90) + угли 8–12 vs 4–7 г/кг по глубине деплиции + цель +≥10% к бою — в печать и в план-шаг; `confirmedManipulation`-гейт расширить на Na/heat при >5% (уже на воду/угли — добавить натрий/сауну).
- Питание: `weightCutNutritionForWeek` → адаптер в `MealPlanInput` (как `bb-contest-prep → meal-plan-generator`), а не изолированный расчёт ккал (закрывает C-6 из предшественника).
**Тесты:** `combat-weight-pro`: границы категорий М/Ж (граница ±100 г — верх/низ), same-day ≤5% гейт, полы макронутриентов, ORS/рефид-ветки 8–12 vs 4–7, `confirmedManipulation` без подтверждения → stable.
**Критерий:** сгонка считается от лимита категории, а не от абстракции; ISSN-полы и same-day правило — блокирующие.

### P5. Женские нормы + RED-S + travel-режим

**Проблема:** D5 + D7.
**Делаем:**
- Женское: весовые категории Ж (P4) + лютеиновая пометка в периодизации (задержка воды +0.5–1 кг — не паниковать, анализ по среднему 7д, как в BB-prep); `iron/calcium`-ноты в питание (дефицит железа на сушке, кальций 1000–1200 мг); жиры ≥0.8 г/кг, floor 1400 ккал — уже есть, довести до гейта (ниже → error); темп сгонки Ж медленнее (0.4%/нед дефолт в длительной фазе).
- Travel: NEW `travelMode` (off/hotel): hotel → bodyweight-фолбэк пула (по образцу hotel-цикла ББ), объём ×0.85–0.90 с честным warning, тапер сдвигается на дни перелёта (бой + перелёт → +2–3 дня к таперу с rationale), same-day + travel → error-подсказка «не совмещать». Джетлаг-нота (сон/свет/тренировка по прилёту) строкой в rationale, без выдуманной математики.
**Тесты:** `combat-female-travel`: female-полы/ноты/лютеиновая; hotel-фолбэк (зал-упражнения заменены, объём ≤0.9); перелёт+same-day → error.
**Критерий:** женский и дорожный планы отличаются от мужского/домашнего не только весами.

### P6. Честный мониторинг: EWMA-ACWR + combat-VBT + HRV-тренд + дневник

**Проблема:** D10 + D11 (+ C-4/C-10 из предшественника).
**Делаем:**
- ACWR: `combatACWRFromLoads` → EWMA-uncoupled дефолт (λ=2/(N+1), хроническая без острой недели), RA-фолбэк при <28д истории; единая единица — sRPE×мин (дневник примат, `he_training_log` — только фолбэк с пометкой); `lowBase`-пол (хроника <100 AU/день → зона не выше caution); честная подпись «0.8–1.3 — ориентир; в ударных видах травмы сидят и в sweet spot (тхэквондо-2025)». Визардный ручной подсчёт удалить (дубль), оставить канон.
- VBT: `mapCombatLift` — честный маппинг (ротация/плио/удары — отдельная `ballistic`-ветка с собственным MVT, а не `bench`; неизвестное → `null` + «нет калибровки», а не молчаливый `squat`); `vbtHistoryForLift` — точный матч по id (убрать двусторонний `includes`: `row` ≠ `battle_rope`); пороги по `intent` (сила/скорость/выносливость); MCV-критерий перехода ATR (65% +5% / 75% = пик) как опциональный сигнал в периодизацию.
- HRV: `loadHrvHistory` — толерантный парсинг (оба ключа + профиль `morningHRV`), тренд 7/28д + EWMA вместо mean±SD; фолбэк «одно значение → оптимально с пометкой» оставить честным.
- Дневник: `buildDiaryTrendCB` — лучший e1RM за 28д per-group уже есть; добавить per-exercise `lastResultIndex` (порт `bb-progression-feedback`) для шеи/хвата/тяги — мезоцикл читает его, а не грубый лог.
**Тесты:** `combat-monitoring-honest`: EWMA vs RA на синтетике (высокий скачок — EWMA чувствительнее); единицы (смешанные load/sRPE/rpe → одна шкала); VBT-мутации (`battle_rope` ≠ `row`, неизвестное → null); HRV-битые ключи → фолбэк с пометкой; MCV-критерий.
**Критерий:** мониторинг не врёт на короткой истории и не калибрует удары кривой приседа.

### P7. Годовой ATR с таперами к боям + выдача + персист

**Проблема:** C-9 из предшественника + D12 (год без пиков, персист хрупкий).
**Делаем:**
- Год: `buildAnnualATR` расставляет realization-таперы 2 нед перед каждой датой из `competitions[]` (аналог `taperWeeksForBlock`); `addCompetitionToAnnual` — не «покрасить дату», а вставить блок (сдвиг недель, сумма 52, stale-пометки); мини-тапер 5–7 дней (−25…−35%) для второстепенных стартов, полный 8–14 дней для главных (P1-формула переиспользуется).
- Выдача: единый fight-week шаблон 14–10/9–5/4–1 (P1-тексты) в PlanView + печать (HTML с XSS-escape, веса/ORS/рефид из P4, чек-лист боя); ICS — события фаз + бой + взвешивание; CSV — BOM/антиформула (прецеденты есть).
- Персист: `combat-storage` — try-quota с фолбэком (чистка старых сверх капа 20 + честный тост «хранилище переполнено»), битый `weeksData` → валидация формы с отбраковкой (а не пропуск); `removeCombatPlan` чистит связанные ключи (payload/preview/annual-привязку).
**Тесты:** `combat-annual-taper`: 52нед ATR 26/16/10 → сумма 52, таперы на месте перед 2 боями, мини vs полный; печать/ICS-снапшоты (XSS, BOM); персист-квоты (переполнение → фолбэк, битый стор → отбраковка).
**Критерий:** год планирует пики к датам, а не красит календарь; выдача содержит бой целиком (фазы/вес/ORS/чек-лист).

---

## §4. Очередь, критерии, источники, не-делаем

### Очередь (зависимости честно)

1. **P1 → P3 → P4** (гейты валидации нужны до мед-блока и весогонки; категории нужны весогонке).
2. **P6** параллельно с P1 (мониторинг не блокирует гейты, но VBT-критерий ATR опционален до P6).
3. **P2** после P1 (мост несёт уже честные errors, а не вечнозелёные).
4. **P5** после P4 (женские категории + travel поверх весогонки).
5. **P7** последним (год и выдача потребляют всё: таперы, категории, ORS, чек-листы).

### Глобальные критерии приёмки

- `mma/boxing/wrestling × power/camp/weight_cut × 2–4д` — шея ≥MEV всегда при спаррингах, `coreAnti ≥4`, fight-week объём ≤65% пика, кондиция+зал ≤ бюджета, hard-дни разнесены с тяж-ногами ≥36 ч.
- Ни один из 6 гейтов P1 не проходится молча (каждый со своим триггером в тестах).
- Весогонка: same-day ≤5%, полы ISSN — блокирующие; ORS/рефид-ветки по глубине деплиции.
- Год 52 нед: сумма сходится, таперы перед боями, ICS валиден.
- `tsc --noEmit` 0 по своим файлам; чужие WIP не тронуты; коммиты строго pathspec своих файлов, без пуша (по правилам проекта).

### Источники (что легло в план)

- Issurin ATR / остаточные эффекты / блок-длины — Sports Medicine 2015 (Issurin), PoinT GO ATR-guide 2026 (5+3+2 для единоборств, MCV-критерии переходов, 2–4 цикла/год).
- MMA-кэмп 18 нед / off 4× + camp 3× / +18% выносливость / +12% сила — Davidenko et al. 2024 (JPES).
- Годовая MMA-модель: linear preparatory → undulating competitive, +2–5%/нед, HIIT-разнос 36 ч, тапер 8–14 дней −60…−85% — UFC PI / Ruddock-модель (годовой гайд MMA-S&C).
- Тапер: Bosquet et al. 2007 meta (27 исслед., +2.2±0.6%, −41…−60%, fast-exp > step, 14–21 день); раздельные кривые сила/кондиция + punch-specific + мобильность верха — Boxing Science; fight-week 14–10/9–5/4–1 — Lau 2025, 369MMAFIT 2026.
- Весогонка ISSN-16 — Ricci et al. 2025 (JISSN, position stand: +12…15% вне кэмпа, полы У3–4/Б1.2–2/Ж0.5–1, 6.7%/72ч–5.7%/48ч–4.4%/24ч, fiber <10г×4д, сауна 2–4%/24ч, ORS 1–1.5л/ч 50–90 ммоль, угли ≤60г/ч → 8–12 vs 4–7 г/кг, +≥10% к бою); вода 7.5→0.5л / −10.6% за 7д — Frontiers 2025; окно восстановления (>12ч → 8%, ≤6ч → ≤5%/≤3%) — GSSI/Reale.
- Шея: Collins et al. 2014 (n=6704, −5% за фунт); BJSM Delphi 2025 (21 статья + 18 экспертов, 57 стейтментов); cutoff экстензии 32.1 кг / 3.71 N/кг, flex/ext >0.74 ×3 — подростки регби 2024; JOSPT meta 2023 (r=0.08–0.14, нзнч., I²>90% — честная оговорка).
- ACWR: BMC meta 2025 + Fedotova 2025 (EWMA чувствительнее на высоких, uncoupled чище, sweet spot 0.8–1.3 с широким CI); тхэквондо-оговорка — Lee et al. 2025 JAT (110 атлетов, 841 травма: пик в умеренной зоне); sRPE-единица — ECSS 2024 каратэ.

### Осознанно не делаем (честные границы)

- Полный разрез god-file `CombatConstructor.tsx` (~2400 строк) — риск сломать соседей при живых параллельных правках; только точечные встройки P1–P7 (прецедент: кардио P1 в AGENTS — типы фасадом вместо build/io-разреза).
- Хаб диагностики единоборств с нуля (точки ударов/тейкдаунов, bar-path) — отдельный эпик за рамками «планировщик»; здесь только приёмник диагностики + concussion-анамнез.
- Дедуп печати `print vs xlsx` и `phaseForCombatWeek` legacy — гигиена без влияния на корректность; не трогаем, пока P1–P7 не зелёные.
- Своя VBT-железная калибровка ударов (нужен лаб-стенд с датчиком) — только честный `null` вместо ложного `squat` + MCV-критерий на штанговых лифтах.
- Женские гормональные фазы глубже лютеиновой пометки и bedtime из дневника — нет данных, не выдумываем.
- Пуш — только по команде; дефолт — коммит pathspec своих файлов, без пуша.

---

*Следующий шаг — выполнение P1 кодом (Edit/Write + vitest/tsc): гейты errors + единый тапер-движок + тесты `combat-pro-validation`.*

---

## §5. Выполнение P1–P7 кодом (статус: ВЫПОЛНЕНО, 8 коммитов pathspec, без пуша)

- **P1** (`4a8e645d`): 6 блокирующих errors (мусорные даты / перегруз 1500+4× / сгонка >5% без weight_cut / same-day >5% / шея<MEV при hard / HIIT≥4 / hard в fight-week при tw1 + fight-week >65% пика) + единый тапер (`taperSplitForWeek` раздельные кривые, `recommendTaperWeeks`, `validateTaperConfig`) + красный стоп-блок позже в P3. NEW `combat-pro-validation` 13/13. Поймано своим тестом ×2 (ошибка ассерта «шея» vs «шее»; HIIT-сценарий с 5 внезальными честно <4 — кондиция схлопывается).
- **P2** (`ad478e03`): kind `combat_cycle` + `CombatCyclePayload` + combat-поля в `WeakpointsPayload` + приёмник в конструкторе (mount + live, невалидный id — честная ошибка) + типизированные исходящие (`CombatNutritionPayload/CardioPayload`, потребители уже слушали). NEW `combat-bridge` 5/5.
- **P3** (`b55b9d9d`): NEW `combat-safety` (teen 14–15 banned-лист/изометрия-only/без hard и манипуляций; concussion 0/1/2+; cutoff 3.71 N/кг; flex/ext 0.74; `sparringSafetyErrors`; `screenCombatRedFlags`) + проводка в билдер (пул-фильтр + errors) + UI (анамнез/замеры/teen-баннеры + красный `cb-errors` блок — раньше показывались только warnings). NEW `combat-safety` 12/12.
- **P4** (`d2f4dac2`): NEW `combat-weight-class` (бокс-Olympic/MMA-UFC/борьба-UWW/кик-типовые М/Ж + `weightClassFor/boundary/line`) + гейты (недовод до лимита — error; +15% вне кэмпа — warning; ISSN-медпункты → errors, советы → warnings с дедупом P1) + селект категории в весогонке. NEW `combat-weight` 8/8. Поймано: темп >1.5 — совет, не мед-блок (тест уточнён, не движок).
- **P5** (`3f5b21c5`): NEW `combat-female-travel` (темп Ж 0.4, железо/кальций/RED-S/лютеиновая ноты, `HOTEL_POOL`, `travelPoolFilter`, ×0.9, тапер-нота) + проводка (пул/бюджет/rationale/гейт same-day×отель) + UI (отель-тумблер, лютеиновая). NEW 7/7. Пойман свой TDZ (`warnings` раньше объявления — перенесено) и дубль деструктуризации.
- **P6** (`b8143cd6` + `1c449165`): EWMA-uncoupled дефолт + RA-фолбэк с пометкой + lowBase-кап + честная оговорка sweet spot; VBT — баллистика/неизвестное → null (generic без id — legacy, соседский тест поймал верно); exact-match истории; пороги по цели; MCV-hint; HRV-single с пометкой; per-exercise индекс + покрытие в мезоцикле. NEW 17/17.
- **P7** (`f60b34be`): год — main 2нед / secondary 1нед таперы (дефолт main), сумма 52 на 2 боях; выдача — fight-week шаблон 14–10/9–5/4–1 + чек-лист + errors-секция + ICS бой/взвешивание; персист — quota-фолбэк + shape-отбраковка + чистка payload-связей. NEW 11/11. Поймано: shape-гейт vs legacy-фикстура без id — смягчён честно (id мигрируется, мусор без weeksData отбраковывается).
- **Проверено:** движки+UI **471/471 (27 файлов)** + switch-sheet 17/17 + bridge/catalog/library/handlers/cardio соседи + `tsc --noEmit` **0 по всему проекту** (12GB heap) + `verify:apk-design` OK. Чужие WIP не тронуты (arm PRO-5/strongman/support в worktree — в коммиты взяты только свои pathspec, сверено `git status`/`git diff`).
- **Отклонения от плана (честно):** полный разрез god-file `CombatConstructor` не делан (точечные встройки — риск соседям); хаб диагностики с нуля не строился (только приёмник + concussion-анамнез); дедуп печати/legacy-фаз не тронут (гигиена без влияния на корректность).
- **Финал-2** (`dabb7c79`): закрыты 2 честных остатка — hard-block сборки (план с errors показывается красным, но не сохраняется/не рассылается/год не трогается; NEW `combat-hard-block` 2/2 через живой UI) + таперы в авто-год (`autoAnnualWithFightTaper` из даты боя свежего плана; +4 теста).
- **Финал-3** (`e2f99fbf`): закрыты 4 остатка — гейт экспорта при errors (все 6 кнопок disabled в PlanView и на шаге экспорта, `isPlanBlocked`; тесты 5/5 в output-gates) + таблицы дзюдо (IJF)/самбо (FIAS-2026)/BJJ (IBJJF gi, сверены поиском) + селект свода правил для борьбы/общей + все бои истории в авто-год (дедуп по дате, сортировка старые→новые) + таб «🥋 Единоборства» в ManualLibraryGallery (13 циклов, фильтры/избранное `combat:`, мост `combat_cycle`/трек combat; чужой файл — только аддитивные ханки, соседи arm/ss/cardio зелёные). Проверено **547/547** + `tsc 0` + apk-markers OK.
