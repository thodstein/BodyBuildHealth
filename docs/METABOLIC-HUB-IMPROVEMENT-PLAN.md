# План развития хаба «Метаболика» — аудит + интернет-бенчмарк + доработки

> Статус: ВЫПОЛНЕН в PRO v4 (Sep 04 2026, коммиты 357c0cd2 + f661cf77). Канон — `src/engines/metabolic-hub.engine.ts:1`, `src/core/metabolic-constants.ts:1`, NEW `src/core/activity-catalog.ts:1`, UI `src/ui/screens/Shared/MetabolicHub.tsx:1`.
> Источники — профиль `he_profile_v2` + дневник `he_nutrition_v2` + дневник веса + labs `labs.summary`.

---

## 1) Что есть сейчас — краткий аудит (14 в 1)

| Модуль | Формула / источник | Статус |
|---|---|---|
| **BMR 7 формул** | Mifflin 1990, Cunningham 1991, Katch 1970, Owen 1986, TenHaaf 2014, Harris 1984, Henry Oxford 2005, Livingston 2005 + `computeBMR` с выбором по BF/BMI + FFMI-cap 26.2 Helms 2023 + Pontzer continuous −0.15%/год после 50 | **A — отлично** |
| **TDEE/PAL** | FAO/WHO PAL 1.40–1.95 + trainAdd 0.040/сессию MET, cardioAdd 0.030, `very_high` для 2×/д, DLW band ±12% Westerterp | Хорошо, но PAL — dropdown |
| **TEF** | Westerterp 25%/7%/3% + Suter Alc 15%, информативен (не суммируется к TDEE — верно, т.к. PAL уже ~10%) | Хорошо — waterfall показан |
| **Вода + пот** | EFSA/IOM 35/33/30 мл/кг + lean×40/fat×20 справка, Baker 2017 Na900 Cl×1.5 K180 Mg12 + климат Sawka + стоячие часы + креатин загрузка | Хорошо, но без sweat-test |
| **Жир / FFMI** | Navy Hodgdon (дюймы) + JP3/7 Siri + Durnin-Womersley + BIA Kyle 400–900 Ом + Deurenberg fallback + Army cross-check | **A** |
| **StressLoad (SLI)** | Эвристика 50+(stress-5)×4.5+(7-sleep)×5.5… invented 0-100 | **E — честно помечено**, но веса спорны |
| **Кровь HCT** | ESC 2023 зоны 48/51/54/60 + вода + железо + донация k0.30/0.45, viscosity, GFR/ферритин | **B — сильно** |
| **EA / RED-S** | Loucks/IOC/Mountjoy 2018: EA=(EI-EEE)/FFM, net EEE×0.85, cut F<30 M<25, opt ≥45/40 | Хорошо (sex-spec есть) |
| **Алко** | Atwater 7.1 + Suter 22/45/73% иллюстрация + exact g×1.2% линейно | C — честно |
| **Белок timing** | Morton 0.40г/кг×4, ceiling 0.55, leuc 0.11/0.07 DIAAS, pre-sleep 35г Res 2012 | A |
| **Maintenance finder** | Hall density p×9400+(1-p)×1800 Forbes p via BF + exp adapt 90д + R² + AT Trexler | **A — pro** |
| **Goal timeline** | Hall + adapt 1/0.85, density | Хорошо |
| **NEAT** | Levine 1999: +40/ч стоя, fidget +90/−40, ходьба 0.04×W/70 | B |
| **AT / Reverse** | Trexler 2014 + MATADOR Byrne 2017 +100/7д | B |
| **Thyroid / HOMA** | Kim +2.2%/pmol FT4, Wallace + Mensink LDL, Bedogni FLI, Blackburn PSMF, Benton лютеин | B |

**Сильные стороны (оставить):** мульти-BMR, Hall density (а не фикс 7700), Baker панель, sex-спец EA, FFMI 26.2, DLW band, evidence бейджи A/B/C/E, AAS experimental дисклеймер.

**Главные долги / риски:**
- `MetabolicInput` — 40+ полей в одном типе → любой вызов тащит всё. `calcWater/calcSteps/calcKBJU` дублируют `computePalSimple + standing/fidget/tons` (3 копии).
- `MetabolicHub.tsx:367` — `input` пересоздаётся из 20 state → все 8 `useMemo` пересчитываются при любом чихе. Плюс `weeklyVolumeTons` не попадает в `useMemo` deps воды? — проверили, попадает.
- `weightHistory` читается из `getNutritionV2Data().weightHistory` **и** из `readDiaryV2` — два источника, рассинхрон возможен. `he_hct_history`/`he_donation_log` — отдельные ключи без TTL.
- `onAAS`/`aasDose` — 4× `aasMult` с разными maxBoost (0.12/0.08/0.10/FFMI) — консистентно, но UI показывает 4 разных % → путает. AAS модель помечена EXP, но тонна переключений «натурал/ААС» дублирует карточки — шум.
- 13 табов `MODE_DEFS` sticky-bar — когнитивная перегрузка, нет мастера «с чего начать». Пресеты не пишут климаты/стоячие/пот. Сценарии — 6 штук без сравнения.
- Нет **ведущего** сценария: пользователь хочет один ответ «сколько есть/пить/шагать», а получает 14 цифр.

---

## 2) Бенчмарк интернета — что делают лучшие в 2025-2026

| Тренд | Кто / ссылка | Что берут |
|---|---|---|
| **Точность = BMR × честная активность** | FindTDEE 2026 — best TDEE compared [findtdee.com](https://findtdee.com/blog/best-tdee-calculator) | Averaging 4 BMR + activity из MET-часов, а не из «moderately active». Ошибка ±10%, без MET — ±300ккал. |
| **Adaptive TDEE — learn from you** | MacroFactor (Greg Nuckols) [macrofactor.com/macrofactor/](https://macrofactor.com/macrofactor/), MacroCodex [macrocodex.app](https://macrocodex.app/), Carbon Diet Coach [nutrola.app/.../cronometer-vs-macrofactor](https://nutrola.app/en/blog/cronometer-vs-macrofactor-vs-carbon-2026) | TDEE пересчитывается **еженедельно из твоих ккал + веса** (корреляция тренд vs intake). Калибровка 2-3 нед, недельные графики expenditure, auto-подстройка macros. Cronometer этого **не делает** — он про micros (84 нутриента, NCCDB/USDA) — [aifithub.io](https://aifithub.io/articles/macrofactor-vs-cronometer-2026/). |
| **Plain-English activity parsing + NEAT/plasma** | TheTDEE (huntscreens) [huntscreens.com](https://huntscreens.com/products/adaptive-tdee-calculator) | Парсит «пн: зал 70мин, вт: бег 40мин» напрямую в TDEE; отдельно NEAT + plasma donation поправка, honest range display, net MET. |
| **Energy availability как триаж** | OpiCalc EA [opicalc.com](https://www.opicalc.com/calculators/sportsmedicine/energy-availability-calculator), Calcipedia 2026 [calcipedia.org](https://www.calcipedia.org/calculators/energy-availability-calculator/), IOC REDs CAT2 2023 [olympics.com](https://stillmed.olympics.com/media/Documents/Athletes/Medical-Scientific/Consensus-Statements/REDs/IOC-REDs-CAT2.pdf), Roadman 2026 [roadmancycling.com](https://roadmancycling.com/blog/energy-availability-red-s-cyclists-guide) | Формула одна: EA=(EI-EEE)/FFM, но клиника — 3-шаговый CAT2 + LEAF-Q/EDE-Q/RST + RMR ratio. Threshold F<30 M<25/30 серый 30-45, optimal F≥45 M≥40. NEAT вне EEE — главный шум [PMC9637848](https://pmc.ncbi.nlm.nih.gov/articles/PMC9637848/). |
| **Отдельный sweep/электролит-калькулятор** | Sweatalyze [sweatalyze.com](https://sweatalyze.com/), RunDida Electrolyte 2026 [rundida.com/tools/electrolyte](https://rundida.com/tools/electrolyte/), HydrationCalc [hydrationcalc.net](https://hydrationcalc.net/), MiniWebTool Hydration 2026 [miniwebtool.com/hydration-calculator](https://miniwebtool.com/hydration-calculator/), Breno Melo [brenoamelo.com](https://www.brenoamelo.com/calculators/sweat-sodium) | Sweat rate = (pre kg − post kg + fluid L)/ч. Na 200-1800 мг/л (avg 950, Baker 2016), Cl×1.5, гипо-натриемия Hew-Butler 5-15% марафонцев. План pre/during/post, бутылки, анимация капель, bottle-count. |
| **NEAT как контроль адаптации** | BiteKit NEAT [bitekit.app/tools/neat-calculator](https://bitekit.app/tools/neat-calculator), BiteKit AT [bitekit.app/tools/adaptive-thermogenesis-calculator](https://bitekit.app/tools/adaptive-thermogenesis-calculator) | TDEE = BMR 60-70% + TEF 10% + EAT 5-15% + NEAT до 50% — самый вариабельный. При дефиците NEAT −200..400ккал, это 1-й гаситель дефицита. |
| **Metabolic adaptation — range, not point** | MacroBalanceLab [macrobalancelab.com/.../metabolic-adaptation-calculator](https://macrobalancelab.com/calculators/advanced-strategy/metabolic-adaptation-calculator) (Trexler 2014) | AT 5-15% TDEE, −50..500ккал, механизмы: NEAT+гормоны+КПД клетки+TEF. Показывают **диапазоном**, не точкой. |
| **Body comp pro** | FFMI Pro [ffmipro.com](https://ffmipro.com/ffmi-pro-calculator-advanced-analytics/), theontho FFMI [theontho.github.io/ffmi-calculator](https://theontho.github.io/ffmi-calculator/) | FFMI + FMI + WHtR + projection years, sensitivity bands ±BF ±TEE, hold constant (FFMI/weight/BF), Barbieri fast 382д, Alpert ceiling. |
| **TDEE breakdown** | FitLifeRegime Daily Energy 2026 [tools.fitliferegime.com/.../daily-energy-requirements-calculator](https://tools.fitliferegime.com/tools/workout-programming/daily-energy-requirements-calculator) | BMR + TEF + NEAT + EAT раздельно — наш waterfall уже это делает, но у них есть MET-table по 300 активностям. |

**Вывод бенчмарка:** рынок ушёл от «вбей рост/вес → получи 2400ккал» к **трем идеям**: (1) адаптивный TDEE из твоих данных (MacroFactor), (2) честная NEAT/activity через MET-парсер (TheTDEE/FindTDEE), (3) sweep-тест + электролиты + RED-S триаж. У нас (1) — на 40%, (2) — на 30%, (3) — на 50%. Остальное — догоняем.

---

## 3) Функциональные пробелы хаба (что просится)

### P0 — критично (без этого хаб проигрывает любому MacroFactor)

**P0-1 Adaptive TDEE v2 (MacroFactor-стиль)**
- Сейчас: `calcAdaptiveAdjustment(diff*770)` + `calcMaintenanceFinder(intake - trend*density/7)`. Нет корреляции intake↔trend, нет калибровки 2-3 нед, нет еженедельного auto-target.
- Надо: `calcAdaptiveTDEE({ weightHistory 14-21д, diaryAvgKcal 7/14д, intakeHistory? }) → { tdee, slope, r2, days, confidence, weeklyTargets: {cut -500, maintain tdee, bulk +300}, plateauFlag, suggest }` по методике MacroFactor/Helms: TDEE = intake − (Δweight × density / days) с Hall density + AT поправкой, скользящее окно 7/14/21д, EMA вес как в `calcTrendFromHistory`. Показать 3 линии: intake, weight EMA, inferred TDEE (как MacroCodex orange line).
- Источник: Nutrola/MacroFactor adaptive [macrofactor.com](https://macrofactor.com/macrofactor/) vs Cronometer [aifithub.io](https://aifithub.io/articles/macrofactor-vs-cronometer-2026/).

**P0-2 MET activity builder (замена PAL-dropdown)**
- Сейчас: `low/medium/high` + `trainingDays/cardioMin` → PAL. Ошибка ±300ккал у офисных vs «на ногах» — главная ошибка TDEE [findtdee.com](https://findtdee.com/blog/best-tdee-calculator).
- Надо: `parseWeeklyActivity(text)` — plain-English «пн: силовая 70мин, вт: бег 35мин, ср: ходьба 8к шагов» → MET-hours → PAL добавка (как TheTDEE). Таблица 20 активностей (силовая 6 MET, бег 10-12, ходьба 3.5-4.3, вело 7.5). Сохранить dropdown как fallback. Сетка NEAT: профессия (сидя/стоя/физич) + шаги реальные из `steps` vs `palTrainingAdd`. Честный range display как у TheTDEE.
- Формула: `PAL = PAL_base(профессия 1.40/1.55/1.75) + Σ(MET×hours)/ (24×1.0)`.

**P0-3 RED-S CAT2-lite (клиника)**
- Сейчас: только EA цифра + зона. Нет триажа.
- Надо: 8-вопросный LEAF-Q-lite + EDE-Q 3 вопроса + чеклист кости/менструация/либидо + RMR ratio (если ввели измеренный RMR → predicted/measured, <0.90 = LEA флаг по Mountjoy 2018). Вывод 3 уровня как в IOC CAT2 [olympics.com](https://stillmed.olympics.com/media/Documents/Athletes/Medical-Scientific/Consensus-Statements/REDs/IOC-REDs-CAT2.pdf): зелёный/жёлтый/красный + «к врачу». NEAT явно вычитать при EEE — пометка [PMC9637848](https://pmc.ncbi.nlm.nih.gov/articles/PMC9637848/).
- Нужен новый `calcRedsScreening({ea, sex, leafScore, rmrRatio, boneFlag})`.

**P0-4 Сводка «One answer»**
- Сейчас: 14 разрозненных карт. Пользователь не понимает «сколько есть».
- Надо: герой-баннер **«Твой TDEE сегодня: 2 840ккал (DLW 2 500-3 180) · Вода 3.1л + Na4.2г · Шаги 9 200 · EA 38 жёлт»** + кнопка «Применить к плану питания» (уже есть `he_planner_kbju_suggestion`, надо расширить до `he_metabolic_snapshot_v5` с TDEE range).

### P1 — важно (отрыв от конкурентов)

**P1-1 Sweat Lab + Electrolyte Planner**
- Сейчас: `sweatRate 600мл/ч` слайдер + `sweatSodium 900мг/л`. Нет измерения.
- Надо (как Sweatalyze/RunDida/MiniWebTool):
  - Вкладка «Пот-тест»: `sweatRate = (preKg - postKg + fluidL)/hours` (Baker 2017, hDrop review). Поля: вес до/после, выпито, длительность, температура/влажность, интенсивность. Сохранение профиля по 3 условиям (cool/warm/hot) — как советует Breno Melo. Na loss = rate × [Na] (low 500/мid 950/high 1400 мг/л) + Cl×1.5, K180, Mg12.
  - План pre/during/post: pre 5-7мл/кг за 4ч, during 0.4-0.8л/ч, post 150% потерь, бутылки N×0.5л, флаг гипонатриемии если >1л/ч plain water 4ч+ (Hew-Butler 2015). Акклиматизация 10-14д: объём +10-20%, [Na] −40% (Periard 2015).
  - Новый `calcSweatTest({preKg,postKg,fluidL,hours})` + `buildHydrationPlan({lossL, sodiumMgPerL, duration})`.

**P1-2 Body Comp Pro: проекция + чувствительность**
- Сейчас: Navy/JP/BIA + FFMI, но нет прогноза.
- Надо как theontho/theontho FFMI [theontho.github.io/ffmi-calculator](https://theontho.github.io/ffmi-calculator/) + FFMI Pro:
  - График «FFMI сегодня → через N лет» при 3 сценариях (hold BF 12%, hold weight, hold FFMI). Ползунок years 1-5.
  - Sensitivity bands: BF ±3% + TEE ×0.90-1.10 — what-if envelope (не CI). Источник: [theontho](https://theontho.github.io/ffmi-calculator/) methodology.
  - Сравнение Navy vs JP vs Deurenberg vs Durnin в одной таблице с Δ, а не только crossCheck строкой. Добавить WHtR (<0.5 норма), ABSI, BAI как extra.

**P1-3 Metabolic health suite (расширение Thyroid/HOMA)**
- Сейчас: HOMA-IR + FLI + lipid Mensink. Нет TyG, TG/HDL, MetS.
- Надо: `calcTyG = ln(TG×Glucose/2)` (cut 8.8 IR), `calcMetS_ATP3({waist, TG, HDL, BP, glucose})` 0-5 критериев, `calcFIB4 = age×AST / (PLT×√ALT)` + `APRI` (если есть AST/ALT/PLT — уже в labs, но не подключены), `QUICKI`, `Matsuda` если OGTT (опц). Вывод как «Метаболический синдром: 2/5 — пред». Источник: Wallace/HOMA + Bedogni FLI уже есть — доделать связку.

**P1-4 Reverse & Diet Break scheduler**
- Сейчас: AT + reverse +100/7д MATADOR. Нет периодизации.
- Надо: `buildDietBreakPlan({weeksTotal, deficitWeeks, breakEvery: 6-8, breakDays: 7-14})` — Byrne MATADOR 2нед дефицит / 2нед maintenance чередование. Календарь фаз (deficit/maintenance) с ожидаемым весом по Hall. Линк к adaptive TDEE — break поднимает лептин/T3.

**P1-5 КБЖУ-периодизация по дню**
- Сейчас: `periodization: trainDay/restDay` — только угли. Нет белка/жира цикла, нет refeed.
- Надо: `calcRefeed({leptinWeeks, bf}) → +20-30% carb 1×/нед при BF<15% >6нед дефицита (Trexler)`, `carb Cycling` toggle.

### P2 — желательно (полировка, удержание)

**P2-1 Кофеин-кривая + сон**
- Сейчас: кофеин только +4/8 к SLI. Нет half-life.
- Надо: `calcCaffeineCurve({mg, weight, hour, halfLife 5ч Dulloo}) → пик 30-60мин, −50% через 5ч, рекомендация cut-off за 8ч до сна (PSQI).` График как у MiniWebTool.

**P2-2 Алко-хроника vs остро**
- Сейчас: только острый блок 3ч. Нет хронического влияния на MPS/тесто/печенку (FLI уже есть, но не связан).
- Надо: связать `alcoholG × частота/нед` → FLI/FLIWrap, кортизол, EA. Порог 14 units/нед WHO.

**P2-3 Carb-loading & sodium-loading протоколы**
- По запросу: `calcCarbLoading({weight, days:1-3, gPerKg:10-12, taper})` + `sodiumLoading` — как у Breno Melo calc set [brenoamelo.com](https://www.brenoamelo.com/calculators/carb-loading). Для peak week / марафона.

**P2-4 UX-рефактор хаба**
- Сейчас: 13 кнопок + 6 групп ввода + sticky bar. Тяжело на мобиле.
- Надо: 3 шага мастера: **1. Тело** (вес/рост/пол/BF/замеры) → **2. Активность** (MET-builder + пот-тест) → **3. Цель** (cut/maintain/bulk/health + лабы). KPI-панель одна (4 карты: TDEE+DLW, Вода+Na, EA+RED-S, FFMI). Остальное — аккордеоны. Экспорт PDF с методологией (как BMR docs MetabolicHub техплан).

**P2-5 Интеграции**
- `he_health_v2` (сон/стресс/HRV из профиля) уже тянем, но `waterL/sodiumG/potassiumG` берём из `p.nutrition` которого нет — добавить маппинг. Подтянуть `labs.summary` TG/HDL/Glucose/AST/ALT/PLT для MetS/FIB-4 авто. Подключить Health Connect steps realtime (как Nutrola [nutrola.app](https://nutrola.app/en/blog/best-bmr-calculator-apps-2026)) — опционально.

---

## 4) Дорожная карта (3 фазы, ~8-10 нед)

### Фаза 1 — Ядро TDEE (P0, 4 нед)
- Нед 1: рефактор `MetabolicInput` → `WaterInput|StepsInput|KBJUInput` + дедуп PAL (`computePalFromActivity`), `useMetabolicProfile()` хук (один источник `he_profile_v2` + diary). Тесты — snapshots движка не ломать.
- Нед 2: **Adaptive TDEE v2** — `calcAdaptiveTDEE` (Hall density + EMA R² + weeklyTargets + plateau). UI: график intake vs weight EMA vs inferred TDEE (как MacroCodex). Критерий: R²>0.6 + 14д данных → high confidence, иначе medium/low.
- Нед 3: **MET-builder** — `activity-catalog.ts` 20 активностей, `parseWeeklySchedule`, замена PAL-dropdown (fallback оставить). Range display ±12% DLW + sensitivity ±BF.
- Нед 4: **RED-S CAT2-lite** + One-answer баннер + `he_metabolic_snapshot_v5` (TDEE range + PAL breakdown + EA). Обновить `docs/METABOLIC-HUB-PRO.md` + 12 тестов на адаптивный/RED-S.

### Фаза 2 — Гидратация и тело (P1, 3 нед)
- Нед 5: **Sweat Lab** — `calcSweatTest` + 3 профиля cool/warm/hot + Na/Mg/K панель + акклиматизация. Сохранение `he_sweat_profiles_v1`.
- Нед 6: **Electrolyte planner** pre/during/post + bottle-count + hyponatremia guard (Hew-Butler) + beverage ranking (водо-влажность Sawka нелинейно — уже есть, доделать).
- Нед 7: **Body Comp Pro** — projection graph + sensitivity bands + WHtR/ABSI/BAI + сравнительная таблица Navy/JP/Durnin/Deur. 8 тестов.

### Фаза 3 — Метаболическое здоровье и UX (P1-2 + P2, 3 нед)
- Нед 8: **MetS suite** — TyG, TG/HDL, ATP III, FIB-4/APRI (подтянуть AST/ALT/PLT из labs), QUICKI. Линк к FLI уже есть.
- Нед 9: **Diet break / refeed / carb-load** — MATADOR календарь + refeed 1×/нед, publish `calcRefeed/calcCarbLoading`.
- Нед 10: **UX мастер 3 шага + PDF экспорт + Health Connect заглушка**. Вынести AAS-switch в header (сейчас дублируется), сценарии — добавить «⇄ Сравнить» (diff как в annual-training). Финальные 10 тестов + tsc 0.

**Приоритет если резать:** Фаза 1 обязательна. Из Фазы 2 — Sweat Lab > Body Comp. Из Фазы 3 — MetS > UX.

---

## 5) Критерии приёмки (глобальные)

- `vitest metabolic-hub` — 68 → ≥90, новые тесты: adaptive TDEE (3), MET-builder (3), RED-S (2), sweat (2), sensitivity (1), MetS (2). tsc 0 по `metabolic-hub.*` + `metabolic-constants`.
- DLW band ±12% показывается на всех TDEE (Westerterp) — уже есть, сохранить.
- Adaptive TDEE: при 14д данных с R²>0.6 интеграционный тест `intake 2800 + trend -0.4кг/нед (density 7000) → TDEE 2800 - (-0.4*7000/7)=3200 ±AT` сходится ±40ккал.
- Sweat test: `(80.0 - 79.2 + 0.5)/1ч = 1.3л/ч` — тест зелёный.
- RED-S: EA 23/63 F→low, 26/63 M→reduced — уже покрыто, добавить RMR ratio тест.
- Все AAS-цифры с бейджем `EXP ⚠️` + дисклеймер Bhasin (не удалять).
- Нет регрессий: существующие снапшоты `he_metabolic_snapshot_v4` читаются (миграция в v5).

---

## 6) Что НЕ делать (осознанно)

- Не добавлять «чудо-формулы» с непроверенными коэффициентами (SLI веса — уже на грани, новые веса только с источником).
- Не дублировать функционал планировщика питания (PLANNER) — хаб даёт **цифру** (TDEE/FFMI/EA), планировщик — **рацион**. Связь только через `he_planner_kbju_suggestion`.
- Не ставить диагнозы: CAT2-lite — скрининг с «обратитесь к врачу», не диагноз RED-S. HOMA/FIB-4 — прокси, не замена лабам.
- Не хранить лабы в snapshot — только в `he_profile_v2` / `he_labs` (GDPR).
- Не переходить на «один BMR» — усреднение 4 формул (FindTDEE/Cronometer) проигрывает **выбору по контексту** (Cunningham для LBM≥60 vs Mifflin) — оставляем выбор + `allMethods` кросс-чек.

---

## 7) Источники (для ссылок в UI)

- Mifflin-St Jeor 1990; Cunningham 1991; Owen 1986; TenHaaf 2014; Harris-Benedict R 1984; Henry Oxford 2005; Livingston 2005 — `metabolic-constants.ts:13`.
- FAO/WHO PAL 2001 + Pontzer 2021 + Westerterp DLW ±12% — PAL/TDEE.
- Hall 2011 Lancet dynamic weight change (density p×9400) + Forbes p — `energyDensityPerKg`.
- Baker 2017 sweat [Na] 950мг/л (200-1800), Cl×1.5, K180, Mg12 — `calcSweatElectrolytes`.
- Hodgdon Navy (Army) + Jackson-Pollock Siri + Durnin-Womersley + Kyle BIA + Deurenberg + Kouri/Helms FFMI 26.2 — `calcBodyFat`.
- Helms/ISSN/Morton 2018 protein 2.6-2.8г/кг lean cut, Schoenfeld-Aragon ceiling 0.55, Res 2012 pre-sleep 35г.
- Loucks 2003 + IOC Mountjoy 2014/2023 + REDs CAT2 2023 — EA thresholds F<30 M<25 / opt 45/40 + net EEE×0.85.
- Suter 1992 alcohol TEF 15% + blok 22/45/73% (exact g×1.2%).
- Levine 2002 NEAT + Trexler 2014 AT + Byrne MATADOR 2017 reverse — NEAT/AT.
- Kim 2014 FT4 +2.2%/pmol — thyroid; Wallace 2004 HOMA-IR; Mensink 2003 LDL; Bedogni 2006 FLI; Benton 2021 luteal +1.2кг.
- MacroFactor adaptive TDEE [macrofactor.com](https://macrofactor.com/macrofactor/) vs Cronometer micros [aifithub.io](https://aifithub.io/articles/macrofactor-vs-cronometer-2026/) — adaptive benchmark.
- FindTDEE best TDEE 2026 [findtdee.com](https://findtdee.com/blog/best-tdee-calculator) — MET-hours vs dropdown.
- Sweatalyze/RunDida/MiniWebTool hydration [sweatalyze.com](https://sweatalyze.com/)[rundida.com](https://rundida.com/tools/electrolyte/)[miniwebtool.com](https://miniwebtool.com/hydration-calculator/) — sweat-test workflow.
- Hew-Butler 2015 EAH 5-15% marathon — hyponatremia guard; Periard 2015 heat acclimation — [rundida.com](https://rundida.com/tools/electrolyte/).
- theontho FFMI projection + sensitivity [theontho.github.io](https://theontho.github.io/ffmi-calculator/) — body comp bands.
- PMC9637848 NEAT в EA [pmc.ncbi.nlm.nih.gov](https://pmc.ncbi.nlm.nih.gov/articles/PMC9637848/) — почему NEAT шумит EA.

---

*Подготовил: аудит кода + веб-бенчмарк 2026-09-02. Следующий шаг — утвердить приоритет P0 и старт Фазы 1 (adaptive TDEE + MET-builder).*
