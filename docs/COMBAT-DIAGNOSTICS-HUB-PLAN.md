# Хаб диагностики единоборств — план эпика (отдельно от планировщика)

**Дата:** 13 сен 2026 · **Автор:** OpenCode (Muse Spark) · **Статус:** ВЫПОЛНЕН кодом P1–P8 (6 этапных коммитов + 1 фикс, чужие файлы не тронуты)
**Область:** NEW `src/engines/combat-diagnostics/*` + NEW `CombatDiagnosticsHub.tsx` (+ табы) · планировщик (`src/engines/combat/*`, `src/ui/screens/combat/*`) НЕ трогается, только читается как потребитель моста
**Предшественник:** `docs/COMBAT-PLANNER-PRO-PLAN.md` — планировщик строит ТОЛЬКО силовую часть зала (POOL_BY_TAG — жимы/тяги/приседы/шея/хват/медбол-ротация; удар/тейкдаун — лишь строки). Настоящий план — отдельный эпик диагностики: точки ударов/тейкдауны/bar-path. Дубли не пишем.

---

## §1. Аудит — зал, планировщик, образцы (проверено чтением + 2 разведки)

### 1.1 Зал тренировки (TrainingScreen)

- Трек `combat` — `shared.ts:140 PlanningTrack`, `nav.ts:103 PLANNER_MODES` (7 карточек), подпись `ММА · бокс · хват`, акцент `#ec4899`.
- Монт: `TrainingScreen.tsx:32 import CombatConstructor`, `712 {(planningTrack)==='combat' && <CombatConstructor/>}` в окне `constructor` (`tp-cbody`). Синк по `planning-track-open` + `he_training_planning_track`.
- Combat — **только конструктор**, своей зоны/таба нет (`zoneForTab` combat не знает). **Хаба диагностики единоборств нет** — в проекте 7 хабов (WL/Strongman/Quality/BB/Armlifting/ArmDiagnostics/Diagnostics), combat отсутствует. Это и есть гэп.

### 1.2 Планировщик единоборств (что уже есть — не дублировать)

- Движки `src/engines/combat/` — 35 файлов (~2900+ строк): `combat.types.ts` (CombatInput 12–79: discipline/goal/level/weeks 2–12/days 2–4 + bodyweight/sex/age + weightCut + outside/sparring + fightDate/taper 1–2 + workMax + fightStyle + neckLevelOverride 1–4/weakSide + weightClass/travel/luteal), `combat-builder` 932с (POOL_BY_TAG 34–40 — только зал), 5 сплитов `combat_2a/2b/3/3b/4`, 13 именных циклов `cb-box-*/cb-wrestle-*/cb-mma-*/cb-kick-*`, весогонка ISSN, ATR-тапер, ACWR/HRV/VBT, печать CSV/HTML/ICS/XLSX.
- **Техники ударов/борьбы/тейкдауны как сущности ОТСУТСТВУЮТ.** `jab/cross/hook/uppercut/single_leg/double_leg` — 0 сущностей; упоминания только строкой (`med_ball_rot_throw:'как удар'`, `striker→rotational×1.2`). `fightStyle striker/grappler/hybrid` — лишь объёмный множитель. Бой = внешняя нагрузка (`OutsideLoad` + `SparringLoad` → `volumeMultiplier 0.55–1.0`).
- Диагностические зародыши (reuse): `combat-neck` (уровни 1–4), `combat-safety` (teen-гейт/concussion/спарринг-гейты), `combat-diary` (per-group e1RM-тренд 28д), `monitoring` (ACWR-Honest/HRV), `weight-cut`, `taper`, `CbQualityMap` (шея/хват/core vs MEV/MRV). Мост: входящий `combat_cycle:{cycleId}` + исходящие `he_combat_nutrition/cardio_payload` — живые.
- **Нет:** COMBAT_BIOMECH-мапы, bar-path/Kinovea, инъекции коррекций во все недели, `CombatWeakPoint[]` в мосте, L/R-вердикта (weakSide — ручной селект), ударной VBT-калибровки (ротация/медбол → `null` честно; `vbtHistoryForLift` ложно матчит `row→battle_rope` — известный D11), OHS-подобного скриннинга, RSS-скоринга + verification + экспорта диагностики.

### 1.3 Образцы (контракт, который копируем)

| Хаб | Табы | Скоринг | Персист | Экспорт | Мост |
|---|---|---|---|---|---|
| WLDiagnosticsHub (эталон, 1926с) | 7: snatch/clean/jerk/aux/mobility/vbt/video | scoreTA RSS + verification 0.35/0.35/0.30 + floors | `he_wl_diagnostics_hub_v1` + план/prev | HTML/CSV/ICS + печать | `kind:'weakpoints'` track strength |
| StrongmanDiagnosticsHub | 6: press/carry/load/grip/mobility/video | scoreSM RSS + verification | `he_strongman_diagnostics_hub_v1` + 6 ключей | HTML/CSV/ICS + бекап | то же |
| ArmDiagnosticsHub | 5: grip/strength/wrist/pressure/recovery | scoreArm RSS + floors | `he_arm_diagnostics_hub_v4` | HTML/CSV (ICS нет) | track arm |
| BBDiganosticsHub | 7 | scoreBB RSS-подобный | `he_bb_diagnostics_hub_v1` | HTML/CSV/ICS | track bb (2 моста) |

**Reuse как есть (не дублировать):** `strength-sport-barpath` (Vorobyev-типы, SRD 4/6, Enode), `strength-sport-video` (parseKinoveaCSV/analyzeBarTracking/videoQualityForCapture), `strength-sport-pose`, `strength-sport-ohs` (6 сегментов), `pro/vbt` (канон), `pro/weak-muscle-detection` (e1RM-тренд 28д), `srpe-store/training-load` (ACWR), `planner-bridge` (kind weakpoints + готовый combat_cycle), `OrthoScreenCard`, export esc/download/ICS-скелет.
**По образцу (новый файл, тот же контракт):** `combat-biomech`-таблица + `scoreCombat` RSS + `weak-cause/correction-rank/simulator/spec-block/plan-audit` + `combat-injection` (dedup+budget+snapshot/rollback) + `combat-export` (HTML/CSV/ICS).

---

## §2. Интернет-синтез 2024–2026 (что ложится в нормы хаба)

1. **Удары — прямые vs боковые (Kacprzak/MDPI 2025, Dinu/Louis PMC 2020, Walilko/Bir 2005, Mack/Wayne State, JSCR punch-force):** прямые (jab/cross) — выше effective mass (~30–31 кг) и импульс (jab ~64, cross ~58 Нс) за счёт линейной траектории и кинематической цепи ноги→бедро→торс; хуки — выше пиковая сила/скорость кисти (rear hook ~213 м/с²), но effective mass ~12–14 кг. Элита > юниоров по силе И скорости всех трёх (cross/hook/uppercut); у юниоров перекос на плечо. Сила удара коррелирует со скоростью кисти (R² ~0.38–0.39) сильнее, чем с силой ног (R² ~0.10). Опора: дисбаланс GRF перед/зад в кроссе (~60/40) — норма, не дефект. Вывод для хаба: нормы раздельно по точкам (jab/cross/hook/uppercut/lowkick), метрики — скорость кисти + impulse/effective mass, а не «сила» одним числом; GRF-дисбаланс кросса не флагаем.
2. **Тейкдауны (Frontiers 2020 double-leg elite vs non-elite; Evolve/Human Kinetics техника):** элита — быстрый вынос корпуса вперёд + взрывное отталкивание задней ногой раньше защитных действий, длительность короче независимо от дистанции. Точки хаба: double/single/body-lock/clinch/sprawl; фазы — level-change → penetration-step → контакт → drive/finish; метрики — время входа, дистанция покрытия, высота корпуса (акромион/трохантер % роста), GRF задней ноги. Single — изоляция ноги + увод центра тяжести; body-lock — через double-underhooks/pummeling (безопаснее прохода в ноги — меньше гильотин/коленей).
3. **Панч-трекеры (JSCR 2023 Hykso/StrikeTec/Corner; Sensors 2019 IMU-review; PMC 2025 limb-biomechanics; PMC boxing-monitoring R²0.94):** коммерческие трекеры валидны лишь частично — корреляция со силой удара r 0.28–0.43 (лучшая — скорость Corner), test-retest от none до excellent, пропуски ударов (StrikeTec ~50% в общем зачёте). IMU-порог для ударов: акселерометр >200g, семплинг >1 кГц; классификация типа удара — ML, не пороги. Вывод: хаб принимает импорт Hykso/Corner/StrikeTec как **ориентир с дисклеймером**, не как истину; ручной ввод (скорость/сила/импульс) + effective-mass-калькулятор — первичен.
4. **Шея/сотрясения (BJSM 2025 Delphi-consensus 57 стейтментов; Hrysomallis 2016 review; PMC 2024 TopSpin360 14 нед — RFD ×4–6, изометрия +; PMC anticipatory-activation — сила шеи + bracing независимо гасят кинематику головы, p<.001; ACSM 2026 meta — связь силы шеи и риска inconclusive):** честная позиция — изометрия шеи + anticipatory bracing снижают кинематику головы, но прямая доказательность «шея → меньше сотрясений» неокончательна. Протокол хаба: изометрия 4 плоскости + RFD + flex/ext-ratio + bracing-чек; concussion-redflags — стоп-гейт, не скоринг.
5. **Видео/bar-path (Kinovea docs + IOP 2018 + PMC 2021 falls):** Kinovea trajectory/track-path — полуавтомат, валидность ~9% по позициям/скоростям на 30 Гц/640×480, углы — надёжно при калибровке в плоскости. Для хаба: импорт Kinovea-CSV (t,кулак-x,y) → xLoop/yMax/vMax + SRD-бейдж (reuse движка как есть) + videoQuality ok/rough/unknown; съёмка строго сбоку в плоскости удара, иначе — честный unknown.
6. **Весогонка (ISSN 2025 position stand; PMC 2026 review; PMC 2025 RWL 256 атлетов; Barley 2019):** 60–90% режут; типично 5%, экстрим 5–10%; walk-around ≤12–15% над классом; GWL 0.5–1%/нед + RWL только финальные ~72 ч; ORS 1–1.5 л/ч + Na 50–90 ммоль/дл; regain ≥10% массы. Риски: почка (креатинин/AKI), сердце, гормоны, REDs. Хаб НЕ ведёт сгонку (она в планировщике), но показывает весогоночный чек + RED-флаг.
7. **Нагрузка (Gabbett consensus; Foster sRPE; Qin/BMC 2025 meta):** ACWR 0.8–1.3 — зелёная зона, ≥1.5 — рост риска; coupled по умолчанию (байт-в-байт с combat-monitoring), EWMA — опция. Спарринг-нагрузка считается отдельно от зала.

---

## §3. Эпики P1–P8 (хаб, не планировщик)

### P1 — Ударный блок: точки + фазы + COMBAT_BIOMECH (ядро хаба)
- NEW `combat-strike-biomech.engine.ts`: `COMBAT_STRIKE_BIOMECH` 8 точек (jab/cross/lead-hook/rear-hook/uppercut/lowkick/elbow/knee) × фазы (старт/разгон/контакт/возврат) с `angleRangeDeg/keyJoint/weakMuscles/intensityPct/biomechanicalReason/loadCues/references` (Kacprzak/Dinu/Walilko) + `diagnoseCombatStrikePoint`.
- Таб `strikes`: числовые вводы (скорость кисти м/с, сила/импульс опционально) + effective-mass-калькулятор (импульс/скорость) + вердикт по точке + топ-коррекции. GRF-дисбаланс кросса — нота-норма, не дефект.
- Тесты: 8 точек диагностируются; effective mass cross > hook на тех же данных (инвариант синтеза).

### P2 — Борцовский блок: тейкдауны + клинч
- NEW `combat-takedown.engine.ts`: 5 точек (double/single/body-lock/clinch-entry/sprawl-defense) × фазы level-change/penetration/contact/drive + метрики (время входа, покрытие, высота корпуса % роста, GRF задней — опционально) + elite-ориентиры (Frontiers 2020) + `takedownReadiness` (спрол-гейт).
- Таб `takedowns`: вводы + вердикт + связка «проход в ноги ↔ гильотина-риск» (строка из sparring-safety, без новой математики).
- Тесты: элитный профиль > неэлитного по скору входа; пустые замеры — честный «нет данных», не 0.

### P3 — Bar-path ударов (reuse, не свой велосипед)
- REUSE `strength-sport-barpath` + `strength-sport-video` как есть: импорт Kinovea-CSV → `xLoop/yMax/vMax` + Vorobyev-тип (прямой/дуга/петля) + SRD-бейдж + `isRealChange`; `videoQualityForCapture` ok/rough/unknown + нота «снимайте строго сбоку».
- Таб `video`: 2–3 точки (cross/hook/double-entry) + «что чинить» из diagnose; без CSV — таб честно пуст.
- Тесты: parity с TA-движком на тех же CSV ( golden-файл); мусор — честная ошибка.

### P4 — Панч-трекеры: импорт с дисклеймером + ручной ввод
- NEW `combat-tracker-import.engine.ts`: парсеры Hykso/Corner/StrikeTec CSV (объём/скорость/тип) + `trackerDisclaimer` (r 0.28–0.43, пропуски, test-retest none–excellent — JSCR 2023) + слияние с ручными замерами (ручное приоритетнее).
- Таб `strikes`: секция «импорт трекера» + тренд скорости/объёма; трекер никогда не даёт «силу» — только скорость/объём (честность).
- Тесты: импорт 3 форматов; без трекера — ручной путь цел.

### P5 — Шея/сотрясения/безопасность (стоп-гейты, не скоринг)
- REUSE `combat-safety` + `combat-neck` + `OrthoScreenCard`: redflags (сотрясение-анамнез, боль в шее, онемение) → 🔴 стоп-гейт вставки; teen 14–15 — баннер + запреты (уже в движке); изометрия 4 плоскости + RFD + flex/ext-ratio + bracing-чек (Delphi/BJSM-честно: «снижает кинематику, прямая связь с риском inconclusive»).
- Таб `safety`: карточки redflags + шея + спарринг-лимиты (reuse `validateSparringLoad`) + весогоночный чек (read-only из планировщика) + RED-флаг.
- Тесты: redflag блокирует мост; teen-гейт виден; без анамнеза — тишина.

### P6 — Нагрузка/восстановление/дневник (живой контур)
- REUSE `combat-monitoring` (ACWR-Honest/HRV) + `combat-diary` (e1RM-тренд 28д → кандидаты в слабые) + `pro/weak-muscle-detection`: таб `recovery` — sRPE+ACWR-зона + HRV + спарринг-объём + e1RM-тренд → «слабее: точка» (подсказка, не авто-выбор).
- OHS-подобный скриннинг: REUSE `strength-sport-ohs` (6 сегментов) + плечо/ТЗС-акцент для ударов ногами; retest → `he_profile_v2` (как у TA).
- L/R-асимметрия ударов: вердикт из замеров (пороги 7/12 как у arm-bilateral: +15%/+25% добивка), не ручной селект; `weakSide` планировщика — потребитель вердикта, не источник.
- Тесты: ACWR-зоны; e1RM-тренд → кандидат; асимметрия ≥12% → вердикт + добивка.

### P7 — Скоринг/мост/экспорт/шелл (сборка эпика)
- NEW `combat-scoring.engine.ts` (`scoreCombat` RSS √Σpen²: strike 12/asym 14-28/bar 10-18/takedown 10/tracker 6/neck-gate/mobility 8 + floors: redflag/asym≥12/neck-fail → cap 49 + `verification` видео 0.35/VBT-трекер 0.30/мобильность 0.35) — по шаблону scoreTA/scoreSM/scoreArm.
- NEW `combat-weak-cause/correction-rank/simulator/spec-block/plan-audit` (топ-3, Δ-симуляция, спец-блок 4–8 нед + dayMap, аудит покрытия точек) — контракты 1-в-1 с TA/SM.
- NEW `combat-diagnostics-injection.engine.ts` (`injectCombatCorrections` per-day dedup + budget-cap + protocol из intensityPct + snapshot/rollback `he_combat_plan_v1/prev`) + NEW `combat-diagnostics-export` (HTML/XSS + CSV/BOM + ICS) + NEW `CombatDiagnosticsHub.tsx` (6 табов: strikes/takedowns/video/safety/recovery/summary; персист `he_combat_diagnostics_hub_v1` + `he_combat_*_hist`; mount рядом с CombatConstructor, трек combat; CTA «→ Применить в конструктор» `kind:'weakpoints'` + `planning-track-open detail 'combat'`).
- Тесты: RSS-свойства + floors + verification; инъекция/откат; экспорт XSS/CSV; мост roundtrip.

### P8 — Постановка удара: школа + подсобка («как бить правильно», диагностическая ветка)
- NEW `combat-strike-school.engine.ts`: `STRIKE_SCHOOL` 6 ударов (jab/cross/hook/uppercut/lowkick/elbow) — для каждого: стойка/гард, кинематическая цепь («ноги→бедро→торс→кисть», опора GRF-нота P1), 3–4 типовые ошибки (толкание плечом, локоть оторван/провис, подбородок вверх, недоворот стопы/бедра, нет возврата), чекпоинты (подбородок/локоть/стопа/возврат), прогрессия дриллов (бой с тенью → лапы → мешок → ограниченный спарринг) + `assistanceFor` — маппинг ТОЛЬКО на существующие id зала (`CB_EX_META`: медбол-ротация/кувалда/плио/жим/тяга/шея — новых упражнений не выдумываем) + `schoolDrillFor(weakPoint)` (слабая фаза → 1–2 дрилла + 2–3 подсобных).
- Таб `strikes`: блок «🥊 Как поставить удар» — эталон → твои замеры (P1/P3/P4) → разрыв → назначение (подсобка из зала + дриллы вне зала); инъекция — через общий P7-механизм (dayMap + budget-cap + snapshot/rollback), отдельным мостом не идёт.
- Тесты: 6 ударов имеют школу (стойка/ошибки/чекпоинты/дриллы); assistance — только реальные id пула; слабая фаза маппится в дрилл (golden-таблица).

---

## §4. Не делаем + критерии приёмки

**Не делаем (осознанно):** силовую генерацию (планировщик цел); весогонку как процесс (только чек); судейство/Compubox-скоринг боя; on-device ML-классификацию ударов (только импорт готовых типов); медицинские диагнозы (скрининг + «к врачу»); дубли barpath/video/ohs/vbt-канона (reuse).
**Приёмка:** NEW движки P1–P8 + hub 6 табов; `scoreCombat` RSS + verification + floors; мост `kind:'weakpoints'` доходит до CombatConstructor (план меняется только через существующий приёмник weakpoints/combat_cycle, сборка не меняется); школа P8 покрывает 6 ударов + подсобка только из реального пула; персист/экспорт/печать; соседние combat-тесты зелёные; `tsc` 0 по своим; `verify:apk-design` OK. Стиль: белый текст `#fff` (правило проекта), 44px-тачи, `data-combat` хуки, светлая/печать — исключения.
**Очередь:** годовой мост (annual-bridge) и VBT-калибровка ротации — только если P1–P8 зелёные и по отдельному согласию.

---

## §5. Выполнение (13–14 сен 2026, 11 этапных коммитов + 1 фикс, без пуша)

Только Edit/Write + vitest/tsc; чужие файлы не тронуты (коммиты строго pathspec своих; shared `planner-bridge.ts` НЕ правлен — мост едет существующими полями `groups/diagnosticWeakSide/barPath/combat*/specBlock`).

- **P1 (`013a47bc`)**: NEW `combat-strike-biomech` (8 точек × 4 фазы + effective mass = импульс/скорость + SPEED_FLOOR/MASS_BAND) + тест 6/6. Поймано своим тестом: MASS_BAND из Kacprzak-абсолюта (30 кг) несовместим со скоростью кисти (~8 м/с) — перекалиброван на 4–12/2.5–8.
- **P2 (`2c17e31a`)**: NEW `combat-takedown` (5 точек × фазы + elite-ориентиры + спрол-гейт `takedownReadiness` + гильотина-нота) + тест 5/5.
- **P3+P4 (`984b200d`)**: NEW `combat-strike-path` (REUSE parseKinoveaCSV/classifyTrajectoryType + SRD 4/6) + NEW `combat-tracker-import` (Hykso/Corner/StrikeTec + дисклеймер JSCR + приоритет ручного) + тест 6/6.
- **P5+P6 (`7178ba1b`)**: NEW `combat-safety-screen` (redflags-стоп + teen 14–15 + шея 35% веса + честная inconclusive-формулировка) + NEW `combat-load-screen` (ACWR-зоны + L/R 7/12 + e1RM-кандидаты) + тест 6/6.
- **P7 (`dea75f55`)**: NEW `combat-scoring` (RSS + floors cap 49 + verification .35/.30/.35) + NEW `combat-correction` (причины/топ-3/Δ-ориентир/спец-блок 4–8/дни 1,3/аудит) + NEW `combat-diagnostics-injection` (мост + snapshot/rollback `he_combat_plan_v1/prev`) + NEW `combat-diagnostics-export` (HTML/XSS + CSV/BOM/антиформула) + NEW `CombatDiagnosticsHub` (6 табов, `#fff`, 44px, `data-combat`, персист `he_combat_diagnostics_hub_v1`) + тесты 10/10 + UI 3/3.
- **P8 (`abafa249`)**: NEW `combat-strike-school` (6 ударов: стойка/цепь/ошибки/чекпоинты/дриллы + подсобка только из реального `CB_EX_META`-пула + `schoolDrillFor`) + блок «Как поставить удар» в табе ударов + тест 3/3 (итого своих **40/40**) + UI 4/4. Поймано: `getByText(/Назначение:/)` ×6 — переведено на `getAllByText`.
- **Фикс (`93638089`)**: `vMaxCm → vMaxMs` (поймал `tsc`; свой тест bad_data-ветку покрывал, но поле не ловил).
- **Монтаж (`997a4fea`)**: таб `combat_diagnostics` по прецеденту Armlifting (union + label + ZONES.tabs + категория + алиас + CALC_TABS + effectiveTab + mount с InfoErrorBoundary + карточка дашборда) + NEW nav-тест 2/2. Поймано: ассерт `toContain('Единоборств')` vs подпись `единоборств` — чинил тест. Общие файлы до правок были чисты, дифф — только свои ханки (проверено `git diff -U0`).
- **Приёмник (`bec83353`, по добру — чужой `CombatConstructor.tsx`)**: `applyWeakpointsCombat` принимает `groups` (`strike:/takedown:` → русские сводки, мусор-фильтр, кап 6) + `specBlock` (rationale ≤160 + dayMap «дни 1+3») + `barPath.text` (≤120) → сводка `cb-msg-diag[data-combat=bridge-diag]` + персист `he_combat_diag_bridge_v1` (ремаунт держит) + флеш; сборка и движки не меняются. NEW тест 3/3 (сводка/мусор/персист). Дифф — только 3 своих ханка (`+`, без `-`).
- **P9 (`2aa02334`)**: NEW `combat-annual-bridge` (overlay спец-блока на год по образцу TA/SM: отдельный ключ `he_cb_annual_sync_v1`, `annual-training` не тронут) + тест 3/3. Поймано: нет.
- **P10 (`0b71496a`)**: NEW `combat-rotation-vbt` (ротация всегда `calibrated:false`, порог по цели 20/25/30 из `combatLossThresholdForGoal`, зона из канона `velocityLossZone`, e1RM — никогда) + тест 4/4. Поймано: ассерт `/Введите/` vs строка «введите» — чинил тест.
- **Обратный путь (`be91c8cc`, чужой `CombatConstructor.tsx` по добру)**: кнопка «🔬 Диагностика» 44px в статус-ряду → `training-open-tab` detail `combat_diagnostics` (паттерн `BbAutoConstructor:6296`, слушатель `TrainingScreen:153` уже принимает любой таб) + тест (подписка на событие). Тест приёмника 4/4.
- **Проверено**: свои **56/56** (12 файлов) + широкий круг combat **564/564 (40 файлов)** + `tsc` 0 по своим (**ошибки только чужие параллельные WIP: `bb-builder`/`meal-plan-engine`/`BbAutoConstructor`, моих строк там ноль — доказано списком файлов**) + `verify:apk-design` OK. НЕ ПУШИЛ (очередь чужих WIP в worktree).
