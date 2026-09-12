# Стронг-планировщик PRO — аудит + план доработки (Sep 12 2026)

> Статус: ПЛАН (код не тронут). Покрывает только планировщик (конструктор + визард + билдер + выдача).
> Хаб диагностики закрыт отдельно: `docs/STRONGMAN-DIAGNOSTICS-HUB-PRO.md` (P1–P9 выполнены).
> Старые планы: `docs/STRONG_TA_PRO_PLAN.md` (PRO v2.2 закрыт), `docs/STRONGMAN_TA_AUDIT_NEXT_PLAN.md` (аудит + P0–P3 бэклог).

---

## 1. Аудит планировщика (факт по коду, Sep 12 2026)

### 1.1 Структура

- **Конструктор** `src/ui/screens/strength-sport/StrengthSportConstructor.tsx` (~1011 строк): `React.FC` без пропсов, весь стейт из хука. Сборка `:160-310`: `collectSsVelocityHistory` → `StrengthSportInput` → hash-гард `he_ss_prog_hash_v1` + `applyMesocycleProgression(prev)` → `buildSSCyclePlan` (если `cycleId`) иначе `buildStrengthSportPlan` → `finalizeStrengthSportPlan` → `injectSMWeakPoints/injectTAWeakPoints` → `critical ×0.85/RIR+1`, `sway/ortho/taBridge` только в `rationale` (механики у билдера нет — честно, без выдуманной математики).
- **Визард** `src/ui/screens/strength-sport/useStrengthSportWizard.ts` (~290 строк): 7 шагов `params|athlete|outside|split|plan|quality|export`, группы ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА. ~40 `useState`: режим/цель/уровень/недели/дни/workMax(8 дефолтов)/оборудование/травмы/outside/пол/вес/возраст/дата старта/cycleId+mode+consent/annual-селект/ACWR/HRV/velocityLoss/vbtPerLift/lvp/taper/contest+strategy/medley/weakPoints/diagLevel/hubVelocity/swayCm/orthoNote/taBridge/vbtMap/plan/annual/diaryLoad. Мост `apply(payload)` принимает `ss_cycle` и `weakpoints` (`parseSmBridgePayload`); VBT хаба идёт отдельным `hubVelocity`-стейтом (в `vbtMap` нельзя — ключи `week-day-ex-set` vs `liftId`).
- **Движки** `src/engines/strength-sport/` — 108 файлов `strength-sport*`. Ядро планировщика:
  - `builder.engine.ts` (~1067с) — генератор: периодизация/RIR/drift, пул/тиры/травмы/мобильность, PED/recovery/ACWR, VBT, весогонка, contest-taper, cond_day. Делегирует в pool/loading/progression/taper/conditioning.
  - `finalize.engine.ts` (~504с) — капы/баланс/deload/outside-конфликты + `calcSinclair/calcRobi/getIWFCategory/getMastersFactor`, `validateSync`, `validateContestPassports`.
  - `volume.ts` — MEV/MAV/MRV: WL в подъёмах/нед, стронг в сетах/метрах.
  - `progression.ts` — `PMw=PM0×(1+k)^(w-1)`, кап 1.25/1.5 + `LIFT_K_FACTOR` (snatch 0.45 … squat 1.0, carries 0.5–0.6).
  - `taper.engine.ts` — Winwood step-taper −45.5%, `TAPER_CESSATION_DAYS` 47 ивентов (йок/камень 7д … сани 3д).
  - `conditioning.ts` — 3 системы `alactic/lactic/aerobic→mixed`, `outsideHigh→[]`.
  - `attempts.engine.ts` (ТА 6 попыток 90/95/100–93/98/102 + Sinclair/Robi) + `strongman-attempts.engine.ts` (SM 85/92/98→90/97/102, medley 12/28с+5с, points 10–1).
  - `contest.types.ts` — `StrongmanContest/SMContestEvent` (9 форматов + `weightClass<80/<90/<105/105+/open`) + пресеты.
  - `storage.ts` — `he_strength_sport_plan_v1/plans_v1` + миграция v1→v3 + `syncStrengthSportToCloud()` (псевдо-синк).
  - `export.ts` — CSV/HTML-печать + `distanceM/timeCapS`, `PHASE_COLOR_SS/PHASE_RU_SS`.
- **Тесты**: `__tests__/` — 57 файлов движков + 8 UI. Ядро: builder/matrix/e2e/property/loading-tempo/balance-limits/annual/storage/print/dup-intensity/vbt-history; ТА-серия (~20); стронг-серия (pro/v2/diagnostics-pro, sm-pro2/pro3/pro-v3, ss-cycles, weight-cut, 384/p0/p3/p4/phase6/next/pose-autotrack); UI: wizard/sm-bridge-intake/ta-spec-apply/apk-pack/wizard-ortho.

### 1.2 Дефекты планировщика (ранжированы, хаб не трогаем)

| # | Дефект | Где | Тяжесть |
|---|--------|-----|---------|
| D1 | Нет weight-class UX: `weightClass?` в типе есть, `getIWFCategory()` в финализаторе есть, но конструктор шлёт только `sex/bodyweight/age`, селектора категории/границы и `weightCutKg→класс` в `input` нет | `Constructor:176`, `contest.types:26`, `finalize:37` | P1 |
| D2 | Нет RPE-cap топ-сингла: `(ws as any).rpe` пишется, `velocityLoss>20→×0.90` есть, но потолка `RPE≥9.5→срез` нет; `critical→×0.85` — ручной гейт конструктора, не движка | `builder:285,572`, `Constructor:251` | P1 |
| D3 | Deload-auto без управления: `autoDeloadWeeks (4,7,11)` + `taperWeeks` только при `goal==='peaking'`; в визарде нет тоггла/превью | `builder:615-622,740,971`, `wizard` | P1 |
| D4 | Conditioning-day неявный: `cond_day` пушится из `conditioningForWeek()`; в визарде нет флага — только косвенный `outsideHigh→[]` | `builder:945-963`, `conditioning:31` | P1 |
| D5 | Cloud-синк фиктивный: `syncStrengthSportToCloud()` перезаписывает то же значение; ключи разрознены (`plan_v1/plans_v1/annual_v1`, `prog_hash/cycle/mode/annual_cycles`, `vbt_ss_v1`, `ss_ortho_mobility`) | `storage:107-116`, `sm-storage` | P2 |
| D6 | Реестр мёртвый: `registry.ts` реэкспортит, билдер импортирует напрямую; `as any`-долг ~40 мест | `builder:6-33,66-1019` | P2 |
| D7 | 5 годовых контуров: `annual` (FromSS/WithTaper/MultiPeak) + `annual-bridge` + `sm-annual-bridge` + `ta-annual-bridge` + `ss-annual`; конструктор дёргает 3 | `annual:22,30,138` и др. | P2 |
| D8 | 4 экспорта расходятся: generic `export.ts` vs `sm-export` vs `wl-export` vs `sm/ta-ics`; `as any` доступы `taper/contest/distanceM` | `export:50,68,76,85` | P2 |
| D9 | Мост теряет механику: `swayCm` и весь `taBridge` (заявки/Sinclair/спец/FvR) идут только в `rationale`, входов у билдера нет (честно, без выдуманной математики) | `Constructor:256-280` | P2 (честный) |
| D10 | VBT split-brain: `vbtMap` (ключи `week-day-ex-set`) + `vbtPerLift` + `hubVelocity`, мерж `collectSsVelocityHistory`; `vbtMap` не чистится — stale-замеры переживают rebuild | `wizard:68,84,202`, `Constructor:168-170` | P1 |
| D11 | Прогресс-хэш неполный: 17 полей без `acwr/velocityLoss/hubVelocity/contest/diagLevel` — смена ACWR/VBT/ивентов не даёт новый мезоцикл | `Constructor:201` | P1 |
| D12 | Дубли типов/таблиц: локальный `type Step` vs `StrengthSportStep`; `PHASE_RU` vs `PHASE_RU_SS`; `SINCLAIR_2024` захардкожен в финализаторе | `Constructor:39`, `StrengthUI:324`, `export:35`, `finalize:13-17` | P2 |

---

## 2. Интернет-синтез 2024–2026 (проверено поиском Sep 12 2026)

- **MyStrengthBook Strongman Platform (2026):** `%1RM lifts + medleys + event day`, `RPE/RiR cap` на топ-сингл («cap the top set by feel instead of a percentage you guessed eight weeks ago»), `weight class management` (вес против капа класса с фото-чекинами), `event tracking` (камни/йок/фермер — время/дистанция/репы-на-высоту, не вес×репы), `taper backwards from meet day` (объём-вниз, opener-синглы, репетиции к дате), `weekly check-ins` (усталость event-дня, хват, поясница, сон, аппетит). **Вывод:** наши D1/D2 — ровно гэп рынка; их чекины — образец для P4.
- **Torokhtiy Strongman 10w (2024–2026, Osipchyk/Новиков):** 4 фазы Accumulation 3 / Transmutation 3 / Realization 3 / Tapering 1 (65% нед.10) + Maxout; 3 сесс/нед; RPE + %1RM; прогрев → main → accessory → cooldown. **Вывод:** паритет с нашей 5-фазой (GPP25/Str25/Integ20/Peak15/Taper15); их «65% taper» мягче нашего Winwood 0.45 — нужен пресет выбора.
- **LiftVault strongman (2026):** wave/block/linear, RPE-да у топов (Big Loz 12w block, JV Askem 8w undulating, 16w wave). **Вывод:** DUP у нас только heavy_light/wave — добавить block-переключатель (P5).
- **Winwood taper + 2026 syst.review (Sports Medicine, 2026-08-18):** стронг: объём −41…−50%, step-taper 7–10 дней, cessation 3.9±1.8д (М 4.5 / Ж 3.9); тяга послед. 6–8д, присед 5–6.5д, жим 3–5д; пик объёма за 4–6 нед, пик интенсивности за 2–3 нед. **Вывод:** наш Winwood 0.45/0.50 + per-event cessation верен; не хватает: taper-пресета «мягкий 65%» (Torokhtiy) + полового cessation (М/Ж) + `opener-синглы` в последнюю неделю.
- **Травмы (Winwood 2014 n=213/454; Keogh 2017):** 82% травмированы; поясница 24%, плечо 21%, бицепс 11%, колено 11%; камень — самый травмоопасный. **Вывод:** biceps-гейт уже есть в хабе; в планировщике нужен per-set cue + `mixed→hook/лямки` чек (P3).
- **Distal biceps (PMC 2025 Ritsch n=183; IJSPT 2022/2025 case; PMC 8237209 YouTube-механизм):** 100% разрывов — супинированная рука при mixed-хвате, локоть в разгибании; пронация обеих рук предотвращает; Incidence у силовиков ×3; локоть 7–35% всех травм силовиков. **Вывод:** механизм железный → P3 (чек хвата становой + cue камня).
- **Log press (BarBend 2024; FitnessVolt; strongman.training):** dip 2–3″, torso вертикально, `ноги первые, руки вторые` (60–70% импульса ногами), шраг + голова-сквозь на локауте; новичкам — push press, не jerk; viking — без двойного сгибания колен (no-rep). **Вывод:** dip-канон 5–8см уже в движке; не хватает cue-строки в плане + viking-гейта (P3).
- **Биомеханика (Hindle systematic review 2019, Bond):** фермер/йок — компрессия/скручивание позвоночника выше unilateral; хват — лимитер фермера; камень/лог/шина ≈ фазы clean/squat/deadlift. McGill: йок — макс. нагрузка на позвоночник. **Вывод:** осевой бюджет уже разделён в хабе (P5 PRO-диагностики); в планировщик — только перенос цифры в `rationale` (готово) + QL-протокол (есть auto-inject).
- **Rogerson et al. 2024 (deload, SHURA):** делод ≠ тапер; делод — плановый сброс внутри цикла, тапер — острый пик к старту. **Вывод:** D3 — развести в UI явно (тоггл «делоды 4/7/11» vs «тапер к дате»).

---

## 3. PRO-план планировщика (эпики P1–P7, без ломки строк/тестов)

Общее правило: движки/строки/aria 1-в-1, только Edit/Write + vitest/tsc; чужие WIP не трогать; коммиты pathspec своих.

- **P1 весовая категория (D1):** селект `weightClass` в шаге athlete (дефолт из `bodyweight`: М <80/<90/<105/105+, Ж ×0.6; open без капа) + строка «до границы: −X кг» + `weightCutKg→класс` проброс в `input` (билдер уже считает `weightCutProtocolSS`, ему добавить вход, не математику). Весогонка — только арифметика + ISSN-нота (как армлифтинг PRO-4). Тест: граница 105/105.1 → разные классы.
- **P2 RPE-cap топ-сингла (D2, MyStrengthBook):** `rpeCap` (дефолт 9.5, селект 8.5/9/9.5/10) в шаге athlete/quality: топ-сет недели с `rpe≥cap` → вес −2.5% (шаг 2.5кг), пометка в плане. Не трогает submax. Тест: RPE 10 при cap 9.5 → −2.5%.
- **P3 безопасность хвата (травмы + PMC):** чек `grip` становой (верхний/лямки vs разнохват) в шаге athlete: `mixed + ≥85%` → warn «супинированная рука — 100% разрывов там (PMC 8237209) → hook/лямки»; cue «руки-канаты, локти прямые» в каждый сет камня (строка плана, не математика); viking-гейт «без двойного сгибания» в технику. Тест: mixed 90% → warn, лямки → тихо.
- **P4 чекины недели (MyStrengthBook check-ins):** карточка «📋 Чек-ин недели» в шаге quality: усталость event-дня/хват/поясница/сон/аппетит 1–5 → `recoverScore`; ≤2 → предложение делода (кнопка, не авто). Персист `he_ss_checkin_v1` (кап 12). Тест: 1/5 → предложение, 5/5 → тихо.
- **P5 периодизация на выбор (Torokhtiy/LiftVault + Rogerson):** селект `blockModel`: `strong5` (наш дефолт, байт-в-байт) / `toro4` (3/3/3/1 + taper 65%) / `wave` (DUP-wave уже есть — только вынести в селект). Развод делод-vs-тапер в UI: тоггл «делоды 4/7/11» (дефолт вкл при ≥8 нед) vs «тапер к дате» (только при `competitionDate`). Тест: toro4 нед.10 → ×0.65, strong5 → Winwood.
- **P6 гигиена входов (D10/D11/D12/D6):** `vbtMap` чистится при смене `mode/cycleId` (stale-фикс, 3 строки); `progHash` += `contestId/diagLevel` (контест-смена даёт новый мезоцикл; ACWR/VBT — осознанно вне хэша: это состояние, не параметры); `type Step` → реэкспорт `StrengthSportStep`; `PHASE_RU` → алиас `PHASE_RU_SS`; `SINCLAIR_2024` → импорт из справочника (если есть, иначе оставить + коммент). Тест: смена cycleId чистит vbtMap.
- **P7 половой cessation + opener (Winwood 2026):** `cessationDays` М/Ж (4.5/3.9) в тапер-движке (дефолт — среднее, байт-в-байт для старых планов); последняя неделя — `opener-синглы` 90% 1× (строка плана). Тест: Ж-cessation < М-cessation.

### Очередь (осознанно НЕ в плане)

- D5 (cloud-синк) — зона владельца cloud-модуля (`sm-storage` так и пишет); D7 (5 годовых контуров) — shared/чужая зона, трогаем только свой `annual.ts`; D8 (4 экспорта) — `wl/sm-export` чужие, правим только generic; D9 (sawy/taBridge в rationale) — честно без математики, входы не выдумываем; реестр-резка (D6-большая) — риск вне «мелких», только алиасы.

---

## 4. Критерии приёмки

- P1: класс U105 при 104.1кг + «−X до границы»; P2: топ-сингл RPE10 срезан −2.5%; P3: mixed 90% → warn; P4: чек-ин 1/5 → предложение делода; P5: toro4 нед.10 ×0.65 vs strong5 Winwood; P6: stale-VBT не переживает смену цикла; P7: Ж-cessation короче.
- Тесты: NEW `strength-sport-planner-pro` ~25 (каждый эпик со своим триггером); существующие 57+8 без правок ассертов; `tsc --noEmit` 0 по своим; `verify:apk-design` OK.

---

## 5. Источники

- MyStrengthBook Strongman Platform 2026 (RPE-cap, weight-class, event-tracking, taper-backwards, check-ins)
- Torokhtiy Strongman 10w (Osipchyk, 4 фазы 3/3/3/1 + taper 65% + maxout)
- LiftVault strongman 2026 (Big Loz 12w block, JV Askem 8w undulating, 16w wave)
- Winwood et al. strongman taper/injuries 2014 (n=213/454, −45.5%, cess 3.9д) + test-retest PMC5686420
- Sports Medicine syst.review 2026-08-18 (taper/peak WL-sports: −40…−45%, cess М/Ж, тяга 6–8д/присед 5–6.5д/жим 3–5д)
- PMC8237209 (100% DBBTR — супинированная рука mixed) + Ritsch 2025 (n=183, ×3 у силовиков) + IJSPT distal-biceps strongman case
- BarBend/FitnessVolt/strongman.training log press (dip 2–3″, ноги 60–70%, шраг)
- Hindle et al. 2019 systematic review (Bond) + McGill spine + Rogerson 2024 deload≠taper
