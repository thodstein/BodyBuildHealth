# Кардио-конструктор PRO-2 — полный анализ и план доработки (Sep 12 2026)

Статус: ✅ ВЫПОЛНЕН (P1–P7 кодом, см. §6). Без пуша.
Правило проекта: только Edit/Write + vitest/tsc, чужие WIP не трогать, коммит строго pathspec своих файлов.

---

## 1. Полный анализ текущего состояния (факты по коду)

### 1.1. Масштаб (замерено 12.09.2026)

| Слой | Факт |
|---|---|
| Движки | `src/engines/lms/cardio*` — **25 файлов**: god-file `cardio.engine.ts` **~208 КБ / ~3587 строк** + 24 сателлита (physiology 17К, diary 28К, field-tests 16К, safety 8.7К, taper-pro 7.6К, pmc 8.8К, tid 6.4К, durability 6.7К, validate 7.9К, interference 9.5К, templates 9К, personal-zones, meso-progression, interval-presets 4.2К, peak-block, records, year-forecast, storage, export, ble, cycle-selector, bridge ×2, date-utils) |
| Библиотека | `src/data/cardio-cycles/` — **26 шаблонов** (Higdon half×2/marathon, FIRST-finish, BarryP, Daniels-24, MAF-12, Pete-full-12, PeteBeginner-24, SSB-LV-6, swim-base-4, tri-sprint-8, bridge-10K + базовые/целевые) |
| UI | `Cardio*.tsx` — **25 файлов**: мастер `CardioConstructor.tsx` **1352 строки, 7 шагов** (params/athlete/load/comps/preview/manage/diary, группы ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА) + Params/Comps/Preview/Manage/Diary/DiaryPanel/AutoTune/SessionTimer/WeekEditor/Progress/VolumeChart/LinkCard/Analytics/HIIT/Catalog/Calendar/FieldTestLog/Records/PlanExtras/Import/CardioUI + `CardioDiarySlot` в TrainingDiaryHub + профильный `CardioDiary` |
| Интеграции | bridge `kind:'cardio'`, `CardioLinkCard` в ПЛ/ББ/ручном, `buildAnnualCardioCycles`, heatmap/слой «Итог года», `.ics`/`.tcx`/`.zwo`/печать/сводка, IDB `cardio_sessions` v7 + cloud-kv синк, BLE HR (0x180D), FIT/TCX/GPX/CSV/JSON импорт |
| Доки | `CARDIO-CYCLE-INTEGRATION-PLAN` (этапы A–F + §15 библиотека — всё [x]), `CARDIO-PRO-SPEC` v2.0, `CARDIO-PRO-LEVEL-PLAN` (эпики A–G — всё ✅), `CARDIO-FULL-ANALYSIS-AND-PLAN`, `CARDIO-GOOD-LEVEL-PLAN`, `CARDIO-CONSTRUCTOR-GUIDE`, `CARDIO-ANALYSIS-ROUND-3` |

### 1.2. Что уже сильно (трогать запрещено без необходимости)

- Физиология: VDOT Daniels (точная формула + монотонность), TRIMP Banister (половые k/b), Karvonen + LTHR Friel + Tanaka/Gulati + talk-test, Coggan ватт-зоны 1–7, MET-ккал с полом/оборудованием (Compendium 2024).
- Нагрузка: CTL/ATL/TSB план + **факт CTL из дневника** (daily EWMA 42/7, Banister где есть HR), Monotony/Strain, **EWMA ACWR** (acute 7/chronic 28), ramp-rate, HR-drift >5% warning, drift-коррекция TSS (Papini-lite).
- TID: polarized/pyramidal/pyramidal_polarized + **Polarization Index** (Treff, порог 2) + phased-таргеты general→specific→precomp→comp + 80/20-гарды в валидаторе и качестве.
- Durability: aerobic decoupling <5/5–10/>10 + efficiency + trend (≥2 замеров ≥60') + responder-классификация (Barsumyan-lite) + FIT-decoupling/secondHalfDrop.
- Taper: BB-кривая vs exponential, `recommendTaperDecay` (≤14д fast τ=4), `individualizedTaperPlan` (overload +20% → 21д; F-OR/ACWR≥1.5/сон<6 → 21д −60% + гигиена сна), `performanceGainEstimate`.
- Поле: FTP (×0.95 Allen&Coggan), CP (Monod&Scherrer 3+12 мин), talk-test потолок Z2, иерархия зон LTHR > FTP > CP > VDOT > talk > age.
- Interference: v2 (Wilson/бег 1.0 vs вело 0.3, Huiberts пол ×0.85, Petré same-session, Robineau ≥6ч) + тайминг-пенальти + drag-and-drop `moveCardioSessionInWeek`.
- Валидация: `validateCardioCycle` (10%-прогрессия, делод-каденс, HIIT-доля 20%/новичкам 10%, застой без делода, taper, strict-режим, race-недели, advisory-кап для авторских шаблонов).
- Дневник: he_cardio_sessions (кап 500), adherence/план-факт, пропуски `completed:false`, undo-транзакции, wellness-readiness, future-игнор, вес-совет, темп/ккал/км.

### 1.3. Слабые места и пробелы (честно, с файл:строка-корнями)

| # | Проблема | Где | Критичность |
|---|---|---|---|
| 1 | **God-file `cardio.engine.ts` ~3587 строк** — типы + сборка + taper + адаптация + экспорт + печать в одном файле. Любая правка рискует задеть соседей; новичку не войти. Реэкспорт PRO-движков уже есть (строки 38–75), но ядро не распилено | `cardio.engine.ts:1–120` (шапка-фасад) | P1 (техдолг) |
| 2 | **Zone 2 подаётся как «база для всех» без volume-оговорки.** При <150–180 мин/нед HIIT даёт больше мито-сигнала/CRF, чем чистый Z2 (см. §2.2). Конструктор новичка на 3×30 мин собирает почти чистый Z2 — недодаёт пик VO2max | `buildCardioCycle` профили base/build | P1 (честность) |
| 3 | **Интервальная библиотека — только 3 пресета** (Norwegian 4×4, Billat 30-30, Tabata). NMA-2025 (Yang, 51 исследование, 1261 атлет) даёт оптимумы: HIIT 140с/165с (WRR 0.85) 3×/нед 3–6 нед; SIT ≤30с/<97с восстановление; RST 3×/нед 2 нед; Hov 2022: 4×4 > SIT по VO2max (+6.5% vs +3.3%/n.s.). RST/SIT-протоколов в конструкторе нет | `cardio-interval-presets.engine.ts` (83 строки, 3 id) | P1 |
| 4 | **Нет медицинского скрининга.** Жалоба «боль в груди/обморок/семейный ВСС/известная кардиопатология» нигде не гейтится; 40+/подросткам — без гейтов (у орто-движка teen-гейты уже есть — прецедент). Бег-новичку 40+ с гипертонией конструктор соберёт HIIT | нет (валидатор — только объём/HIIT/taper) | P0 (безопасность) |
| 5 | **Фьюлинг длинных — только строкой.** `hydrationAdvice` (>90': Na 500–700мг/л + 30–60г углей/ч) — текст в дашборде; в сессии/печать/ICS углеводы/натрий не прописываются, дозировка не считается от веса/длит | `cardio-safety.engine.ts:43–48` | P2 |
| 6 | **Жара/высота — только поправка HR.** Акклиматизации 10–14 дней (постепенный набор объёма/интенсивности в жаре) и live-high-train-low оговорок нет; высотный порог 1000м +1/300м есть, протокола нет | `cardio-safety.engine.ts:21–40` | P2 |
| 7 | **Нет предиктора результата.** VDOT есть, а «твой VDOT 45 → 10К ~44:30 / марафон ~3:20» (Riegel/Daniels) не показывается; атлет не видит, зачем цикл. Рекорды-тренд (SVG) есть, прогноза нет | `cardio-records.engine.ts`, `CardioRecordsSection` | P2 |
| 8 | **Durability-тренировка не назначается.** Decoupling считается (дашборд/FIT), а «длинная для дюрабилити: вело 2–4ч / бег 1–2ч» (`durabilityDurationTarget`) в план не вшивается как explicit-сессия с целью «decoupling <5%» | `cardio-durability.engine.ts` | P2 |
| 9 | **Женская специфика — только множитель interference ×0.85.** Цикл/лютеиновая задержка воды, RED-S пол (как в BB-prep 1400 ккал), беременность — отсутствуют. Для бега это честный пробел, не выдумка | `cardioInterferenceV2` | P3 (не выдумывать без данных — только гейты) |
| 10 | **7-шаговый мастер тяжёлый на телефоне.** 1352 строки, шаги params/athlete/load/comps/preview/manage/diary; АПК-покрытие шагов не аудитировано (44px/press/focus/ reduced-motion по прецеденту §89–§113 питания/дневников) | `CardioConstructor.tsx` | P2 (UX) |

---

## 2. Интернет-синтез 2024–2026 (что ложится в план, что — нет)

### 2.1. TID: POL vs PYR — паритет с небольшим краем POL на коротких блоках

- Rivera-Köfler 2025 (JSCR, scoping review 620→15): POL и PYR — оба лучшие по VO2max; все модели улучшают результат; POL/PYR лучше у элиты, **у любителей разницы между моделями нет**.
- Sports Medicine 2024 (мета-анализ POL vs остальные): **POL лучше только по VO2peak, и только на блоках <12 нед**; на ≥12 нед POL ≈ остальные; эффект сильнее у highly trained/national.
- Filipas 2021 (16 нед, PYR→POL +3% VO2max) + Sci Rep 2025 (ML-персонализация, POL +12.7% VO2max vs PYR +10.4%, но PYR +9.3 км/ч лактатного порога vs +6.7): **переключение PYR→POL в финале блока — лучший ход**.
- Вывод для плана: **не ломать TID-математику** (PI/таргеты уже канон). Добавить фазовый свитч PYR(base)→POL(specific/precomp) как опцию + честная подпись «любителю модель не решает — решает объём» (Rivera). Это P5-опция, не новый движок.

### 2.2. Zone 2: хайп vs данные (Storoschuk/Gibala/Gurd, Sports Med Jul 2025)

- Narrative review: **нет доказательств, что Zone 2 — оптимальная интенсивность для митохондрий/окисления жиров у широкой публики**; при равном объёме HIE даёт больше мито-сигнала/CRF/кардиометаболики; Zone 2 может падать ниже moderate-диапазона гайдлайнов (150 мин/нед 3–5.9 MET).
- Клиники (Vail Health 2026, Cleveland Clinic Oct 2025): Z2 = 60–70% HRmax, лактат <2, разговорный тест; доза **3–5×/нед 45–90 мин** (новички 5×30 = 150 мин/нед); Z2 строит базу (мито/капилляры/жирокисление), **но без силы + HIIT — неполноценно** (AHA-микс).
- Вывод для плана: **volume-зависимая честность** — при неделе <150 мин показывать «база Z2 + 1 HIIT обязателен для VO2max», при ≥180 мин — классика 80/20. Это P2 (текст + гард в валидаторе, не новая физиология).

### 2.3. Interference: бег бьёт, вело щадит; развод ≥3ч (umbrella 2025–2026)

- Wilson 2012 (21 исследование, 422 ES): **бег −гипертрофия/−сила, вело — нет**; частота/длительность r=−0.26…−0.75; эффект — в ногах, не в верхе.
- PMC 2022 (волокна): interference в волокнах I типа **только от бега** (SMD −0.81), от вело — нет.
- Schumann 2022 update: **макс. сила и гипертрофия НЕ страдают от CT как такового**; страдает взрывная сила, особенно same-session (≤20 мин между).
- Umbrella 2025–2026 (17 мета, 144 исследования, 1492 чел): CT ≈ RT по силе/мощности/гипертрофии + лучше по VO2; **порядок RT→ET трендово лучше** для силы/гипертрофии.
- Вывод для плана: математика v2 уже верна (бег 1.0/вело 0.3, пол, same-session). Остаток — **UI-гард «сила первой + ≥6ч/разные дни»** в раскладке недели + явный warning при same-session беге в день ног. Это P4-малое, не новый движок.

### 2.4. Интервалы: оптимум 2025 (Yang NMA 51/1261 + Hov 2022)

- Yang 2025: RST (g=1.04) > HIIT (1.01) > SIT (0.69) > CT (0.29), различия RST/HIIT/SIT n.s.; оптимум **HIIT бег 140с работа/165с отдых (WRR 0.85) 3×/нед 3–6 нед**; SIT ≤30с спринт/<97с отдых; RST 3×/нед 2 нед достаточно; инвертированная U-кривая по длительности/ WRR.
- Hov 2022 (48 тренированных, 8 нед): **4×4 мин @~95% MAS (+6.5% VO2max, +8.1% ударный объём) > SIT 8×20с (+3.3%) > SIT 10×30с (n.s.)**; 3000м: +5.9%/+4.1%/+2.2%.
- Oliveira-Nunes 2021 (19 исследований): HIIT ≈ SIT по VO2max — выбор по удобству.
- Вывод для плана: расширить пресеты 3→6 (добавить RST 10×10с/60с, SIT 8×20с/10с пассивно, HIIT-opt 140с/165с) с дозировками Hov/Yang. Это P3.

### 2.5. Taper: Bosquet-канон стоит (2007 + PLOS 2023 confirm)

- Bosquet 2007 (27 исследований): **2 нед, объём −41…−60% экспоненциально (fast decay), интенсивность/частота без изменений** (effect 0.59–0.72).
- PLOS 2023: тот же коридор 41–60%, ≤21 дня, progressive/step; пик эффекта 8–14 дней (SMD −1.47).
- Smyth&Lawlor 2021 (158 000 любителей): строгий экспоненциальный taper = −5 мин к марафону vs недисциплина.
- Вывод для плана: `taper-pro` уже канон (exp/step, τ=4/8, −50%/−60%). Не трогать математику; остаток — **гоночная неделя-чеклист** (сон/питание/ geen nieuwe prikkels 48–72ч) как UI-блок. Это P6-малое.

### 2.6. Durability/decoupling: пороги и онсет (Smyth 82 303 + Hunter 2025 + Frontiers 2025–2026)

- Smyth 2022 (82 303 марафонца): средний decoupling **1.16 (~16%), онсет ~25.2±9.9 км**; low-decouple группа — онсет 33.4 км, high — 19.1 км; durable бегут ближе к CS и быстрее.
- Hunter 2025: VO2max −6–7% после 90 мин бега (после 60 мин — нет); decoupling 35–40 км vs 5–10 км; причины — падение темпа + дрейф HR.
- EJAP 2025: **HR- и дыхательный decoupling коррелируют с дюрабилити VT1** — практичный маркер.
- BMC 2026 (вело): падение каденса −1 rpm → +0.58% decoupling; средний drift 2.09%/decouple 2.00% на 60-мин тесте.
- TrainingPeaks-канон: **<5% strong / 5–10% moderate / >10% weak** (уже в движке).
- Вывод для плана: пороги верны. Остаток — **explicit durability-сессия** (длинная с целью decouple<5%) + предиктор по Riegel. Это P6.

### 2.7. Что осознанно НЕ делаем (нет данных / не зона кардио)

- HRmax-формулы не меняем (Tanaka/Gulati/Classic уже три).
- Новый TID-движок не пишем (POL/PYR/PI уже канон §2.1).
- BED/питание-суточные ккал не трогаем (чужая зона IndividualPlan).
- Медикаменты/диуретики/кардио-диагнозы не ставим — только red-flag гейт к врачу.
- Женский цикл/беременность — только честные гейты (RED-S/врач), без выдуманных коэффициентов.
- On-device видеоанализ походки — вне скоупа (Kinovea-CSV уже есть).

---

## 3. План PRO-2: эпики P1–P7

### P1. Распил god-file (техдолг, поведение 1-в-1)

- Разрезать `cardio.engine.ts` на: `cardio-types.engine.ts` (типы/константы) + `cardio-cycle-build.engine.ts` (build/adapt/taper-адаптеры) + `cardio-cycle-io.engine.ts` (ICS/TCX/ZWO/print/summary/compare) + фасад `cardio.engine.ts` (только re-export + bridge-совместимость).
- Критерий: `grep`-импорты потребителей не меняются (реэкспорт), все cardio-тесты зелёные без правок ассертов, `tsc` 0.
- Тесты: lock-тест «фасад экспортирует все 89+ ключей» (мутация: удаление реэкспорта падает).

### P2. Честный Zone 2 (volume-зависимость)

- Движок: `zone2HonestyNote(weekMinutes, hiitCount)` — <150 мин + 0 HIIT → warn «добавь 1 HIIT (Storoschuk 2025)»; ≥180 мин — классика 80/20 без варнинга; текст с talk-test оговоркой (формулы подходят ~20%).
- Валидатор: `z2_without_hiit_low_volume` (warn, не error; advisory для авторских шаблонов).
- UI: бейдж в Preview + строка в rationale; калибровки не меняются.
- Тесты: 3 (low-volume без HIIT → warn; low-volume с HIIT → тихо; high-volume без HIIT → тихо).

### P3. Интервалы 3→6 (Yang-2025 + Hov-2022 дозы)

- NEW пресеты: `rst-10x10` (10×10с max / 60с легко, 3×/нед 2 нед), `sit-8x20` (8×20с @150% MAS / 10с пауза, 3×/нед), `hiit-opt-140` (140с @95% MAS / 165с легко, WRR 0.85, 3×/нед 3–6 нед, бег).
- Каждый: дозировка/частота/калибровка (HRmax или 6-мин тест или MAS), `equipment` (RST/SIT — бег/вело; HIIT-opt — бег), предупреждение «не в день ног / не same-session с силой».
- UI: `CardioHiitSection` показывает 6 с бейджами «VO2max-выбор (Hov)» у 4×4 и «opt-2025» у 140с.
- Тесты: 6 (состав/structured-поля/дозы/калибровка-без-HRmax/equipment/same-session warning).

### P4. Мед-скрининг + возрастные гейты (безопасность, P0)

- NEW `cardio-red-flags.engine.ts`: `CARDIO_RED_FLAGS` (боль/давление в груди, обморок/предобморок, известный кардиодиагноз, семейный ВСС <50, гипертония без контроля) + `screenCardioRedFlags(answers)` → `blockHiit: boolean + doctorNote`.
- Движок сборки: при `blockHiit` — HIIT/MISS запрещены (только Z2/recovery ≤ talk-потолка), в rationale — «к врачу», в UI — красный баннер (не диагноз).
- Возраст: 40+ без опыта + любой флаг → `blockHiit`; 14–15 (teen, прецедент орто) → только Z2/recovery + «без отказов».
- Тесты: 5 (каждый флаг блочит; комбинация; teen; 40+ без флага — не блочит; rationale содержит «к врачу»).

### P5. Фазовый свитч PYR→POL (опция, Silva/Filipas)

- `CardioCycleInput.tidSwitch?: { atWeek: number; to: 'polarized' }` — вторая половина блока строится полярной (HIIT-доля вверх, Z2 вниз, объём тот же); без флага — байт-в-байт.
- UI: тоггл в Params «🔀 PYR→POL во 2-й половине (Filipas +3%)» + подпись «любителю решает объём, не модель (Rivera-2025)».
- Тесты: 3 (без флага — байт-в-байт; с флагом — 2-я половина без MISS + rationale; объём ±20% — честно: HIIT 15 мин vs MISS 20 мин, минуты плывут, бюджет тот же).

### P6. Прогноз + durability-сессия + гоночный чек-лист

- NEW `cardio-race-predictor.engine.ts`: `predictRaceTimes(vdot)` (Riegel: T2=T1×(D2/D1)^1.06 — 5К/10К/полумарафон/марафон из VDOT-темпов) + `predictorNote` («прогноз ±, не обещание»).
- Durability: `planDurabilitySession(equipment)` — длинная (вело 2–4ч / бег 60–120 мин) Z2 с целью «decoupling <5% (Smyth/Hunter)»; вшивается 1×/нед в specific-фазу при неделе ≥150 мин, иначе — только совет.
- Чек-лист: `RACE_WEEK_CHECKLIST` (сон 8ч, без нового 48–72ч, привычное питание/гидратация, shakeout 15–20 мин) — UI-блок в CompsStep + строка в ICS.
- Тесты: 5 (Riegel-монотонность 5К<10К<half<marathon; VDOT-парсер честности; durability только при ≥150 мин; чек-лист 5 пунктов; ICS содержит shakeout).

### P7. Фьюлинг + акклиматизация (протокол, не строка)

- `fuelingForSession(durationMin, weightKg, tempC)`: <60' — вода по жажде; 60–90' — 500–750 мл/ч; >90' — 500–750 мл/ч + Na 500–700 мг/л + угли 30–60 г/ч (доза в граммах = rate×часы, кап по весу); запись в `session.purpose` + печать + ICS.
- `heatAcclimationPlan(tempC, weeks)`: жара ≥28°C → 10–14 дней постепенного набора (дни 1–4: только Z2 ≤60 мин; 5–10: +10%/день; HIIT только после дня 10) + строка в rationale.
- Высота: >1000м — existing HR-add + нота «первые 3–5 дней только Z2/recovery».
- Тесты: 5 (капы фьюлинга; Na только >90'; акклиматизация 14-дневная лесенка; высота-нота; ICS содержит «Na/угли»).

---

## 6. Выполнение (Sep 12 2026, закоммичено pathspec `eacfa0614`, без пуша)

Все 7 эпиков закрыты кодом. Только Edit/Write + vitest/tsc; чужие WIP (pharma/support/Articles/Risk в `git status`) не тронуты.

- **P4 мед-скрининг** ✅: NEW `cardio-red-flags.engine.ts` (5 флагов + teen 14–15 + `screenCardioRedFlags`/`needsMedicalBlock`; 40+ без флага честно не блочит) + `CardioCycleInput.redFlags` → мед-блок режет HIIT (через recoveryLow) и MISS (пост-фильтр) + rationale «до врача» + `validateCardioCycle({medicalBlock})` → error + UI-блок «🩺 Кардио-скрининг» в шаге Атлет (44px-кнопки, `data-cardio="red-flag"`, персист в wizard) + валидатор читает мед-блок из `cycle.config`.
- **P3 интервалы 3→6** ✅: +`rst-10x10` (10×10/60, 3×/нед 2 нед) + `sit-8x20` (8×20/10) + `hiit-opt-140` (140/165, WRR 0.85, HR-зоны при HRmax) с дозами Hov/Yang; UI `CardioHiitSection` рендерит из массива + хинт с бейджами; соседний тест «пресетов ровно 3» обновлён на 6 (своя зона).
- **P2 честный Z2** ✅: NEW `cardio-zone2-honesty.engine.ts` (`zone2HonestyNote`: <150 мин без HIIT → warn-строка; ≥180/с HIIT — тихо) + валидатор `z2_without_hiit_low_volume` (warn, скип для faithful-шаблонов — C25K не трогаем).
- **P5 свитч PYR→POL** ✅: `CardioCycleInput.tidSwitchWeek` (недели ≥ свитча строятся polarized-профилем, объём тот же) + rationale Filipas/Rivera + тоггл в шаге Нагрузка (`data-cardio="tid-switch"`, свитч = середина цикла) + персист/editConfig.
- **P6 прогноз+durability+чек-лист** ✅: NEW `cardio-race-predictor.engine.ts` (Riegel ^1.06, монотонность; `RACE_WEEK_CHECKLIST` 5 пунктов) + `durabilitySession`-флаг (длинная Z2 вело 3ч/бег 100 мин только в недели ≥150 мин, иначе совет) + ICS taper-описания с чек-листом + `CardioRacePredictor` (автономный, свой ввод) и чек-лист в `CardioCompsStep`.
- **P7 фьюлинг+акклиматизация** ✅: NEW `cardio-fueling.engine.ts` (`fuelingForSession`: <60′ нули; 60–90′ вода; >90′ вода+Na 600 мг/ч+угли 45 г/ч с капом 60; `heatAcclimationPlan` 12 дней при ≥28°C; `altitudeNote` >1000м) + дописка фьюлинга в purpose сессий ≥60 мин (печать/ICS подхватывают) + rationale акклиматизации/высоты.
- **P1 распил** ✅: NEW `cardio-cycle-types.engine.ts` (18 чистых типов 1-в-1) + фасад `cardio.engine.ts` (import + re-export, потребители не меняются) + lock-тест фасада.
- **Проверено**: NEW `cardio-pro2` 31/31 + движки-соседи 443/443 (9 файлов) + импорт/annual/macro 46/46 + UI 182/182 (12 файлов); `cardio-diary-slot` 1 падение — чужой date-флейк (C25K сессии только Пн/Ср/Пт, сегодня Сб — доказано расписанием шаблона, моих файлов там нет); `tsc --noEmit` **0 по всему проекту** (12GB heap); `verify:apk-design` OK. НЕ КОММИТИЛ/НЕ ПУШИЛ.
- Отклонение от плана: P1 выполнен как вынос типов (а не полный распил build/io — полный разрез при живых параллельных правках того же файла рисковал сломать соседей; типы — zero-runtime, самый безопасный срез с lock-тестом).
- Добивка: date-флейк `cardio-diary-slot` починен в том же коммите (фейковые часы на понедельник — C25K тренируется Пн/Ср/Пт).
- Добивка-2 «кроме P1» (коммит pathspec, без пуша): №2 — паритет свитча честно ±20% (HIIT 15 мин vs MISS 20 мин); №3 — кнопка «⚡ +HIIT в неделю 1» в карточке валидации при варнинге (`onAddHiit` → SIT 8×20 с undo-версией); №4 — предиктор подтягивает лучший рекорд из журнала (`run10k→run5k→runHalf`, пусто — честная подсказка); №5 — NEW `cardio-pro2-ui` 7/7 (чек-лист/предиктор/рекорды/6 пресетов/кнопка); №6 — подпись «до 16 лет».
- Добивка-3 «2–6 полностью» (коммит pathspec, без пуша): №2 — hero-preview 1-в-1 (3 флага в `CardioParamsModel`+hook+вызов; legacy-компонент не тронут); №3 — prep-путь режет HIIT/MISS при `redFlags`; №4 — `paramsDirty` сравнивает 3 флага; №5 — UI 7→10 (сквозняки тоглов → сборка); №6 — P2-строка в rationale (скип мед-блок/шаблон). Проверено: движки 524/524 (14 файлов) + UI 190/190 + `tsc` 0 + apk-verify OK.
- Добивка-4 «2–6, второй круг» (коммит pathspec, без пуша): №2 — `improveCardioCycle` больше не возвращает HIIT поверх мед-блока (гейт по `config.redFlags` + rationale-строка); №3 — `resetParams` гасит 3 тоггла; №4 — шаблоны честно предупреждают (генераторные идут через мед-блок сборки, явные — rationale-warn + флеш, без резки авторского плана); №5 — валидатор вызывает единый `zone2HonestyNote` (дубль порогов убит); №6 — rationale скипает гоночные недели как валидатор. Проверено: движки 524/524 + UI 190/190 + `tsc` 0 + apk-verify OK.

## 4. Порядок внедрения + критерии приёмки

1. P4 (безопасность) → P1 (распил) → P3 (интервалы) → P2 (честность Z2) → P5 (свитч) → P6 (прогноз) → P7 (фьюлинг).
2. Каждый эпик: движок-тесты сначала (красные без фичи), затем UI-ханк, затем соседи.
3. Глобальные ворота: свои тесты 100% зелёные, соседи cardio+catalog+annual без регрессий, `tsc --noEmit` 0 по своим файлам (чужие WIP — доказать `git diff`, не трогать), `verify:apk-design` для UI-ханков.
4. Коммиты: строго pathspec своих файлов, без пуша (очередь чужих WIP — см. `git status` в шапке аудита).

## 5. Источники (ядро, полный список — в §2)

- Rivera-Köfler 2025 JSCR (POL vs PYR scoping, 620→15) · Sports Med 2024 (POL-мета, <12 нед край) · Filipas 2021 (PYR→POL +3%) · Sci Rep 2025 (ML POL+12.7% vs PYR-порог).
- Storoschuk/Gibala/Gurd Sports Med Jul 2025 (Zone 2 narrative) · Vail Health 2026 / Cleveland Clinic Oct 2025 (доза 150–300 мин).
- Wilson 2012 (modality) · PMC 2022 (волокна I) · Schumann 2022 update · Umbrella 2025–2026 (17 мета/144/1492).
- Yang 2025 NMA (51/1261, HIIT 140/165 WRR 0.85) · Hov 2022 (4×4 +6.5% vs SIT) · Oliveira-Nunes 2021 (HIIT≈SIT).
- Bosquet 2007 (taper 41–60% 2 нед) · PLOS 2023 (confirm 8–14д пик) · Smyth&Lawlor 2021 (158k, −5 мин).
- Smyth 2022 (82 303, decouple 1.16/онсет 25.2 км) · Hunter 2025 (VO2 −6–7% после 90 мин) · EJAP 2025 (HR/F_R decouple ↔ VT1) · BMC 2026 (каденс −1 rpm → +0.58% decouple).
