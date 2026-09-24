# Arm-планировщик PRO-6 — аудит и реализация

> Статус: **IMPLEMENTED / VERIFIED**. P0/P1 safety, profile/annual/snapshot и provenance-контуры реализованы; целевые arm/UI-тесты, `tsc --noEmit` и APK-проверка зелёные.
> Дата среза: 24 сентября 2026.
> Чужие OCR/Android/Risk/BB изменения в worktree не относятся к PRO-6 и не должны попадать в будущий pathspec.

## 1. Цель и границы

Цель PRO-6 — не добавить новые упражнения или новые числовые методы, а сделать уже заявленные PRO-5 возможности действительно безопасными и наблюдаемыми в production-пути:

1. ограничения профиля и диагностики доходят до выбора упражнений;
2. пустой или несовместимый пул не превращается в упражнение другой мышцы;
3. safety-блокировки не выдают зелёную валидацию и не разрешают экспорт без явного решения;
4. сохранённый, отредактированный и экспортируемый план являются одним снимком;
5. annual ARM-блок не теряет arm-специфичные данные и не маскируется под BB;
6. метрики table time, RPE/RIR и provenance не выдают за измерение то, чем они не являются.

В рамках реализации не выполнялись:

- новые медицинские диагнозы, назначения препаратов или процедуры;
- новые нормативы, проценты WR или точные тренировочные дозы без первичного источника;
- переписывание всего `arm-builder.engine.ts`;
- изменения общей модели annual-training сверх отдельного typed ARM-контракта;
- продление чужих WIP в OCR, Android, Risk, BB и nutrition.


## 2. Метод и базовая проверка

### 2.1. Проверенный контур

```text
UnifiedSettings / diagnostics / bridge
        -> ArmAutoConstructor
        -> rankArmSplits
        -> buildArmPlan
        -> finalizeArmPlan
        -> validateArmPlan
        -> persistArmPlan
        -> applyArmEdits (viewPlan)
        -> print / ICS / variants
```

Отдельно проверен годовой контур:

```text
ArmMacrocycle / AnnualBlockConfig
        -> buildArmBlock
        -> ArmAnnualBuildResult
        -> AnnualBlockBuildResult
        -> ручной режим / годовой план
```

### 2.2. Baseline и финальная проверка PRO-6

До начала PRO-6 документ зафиксировал зелёный baseline PRO-5. После реализации проверено:

- arm engine: **99 test files / 1157 tests passed**;
- ARM UI: **37 test files / 242 tests passed**;
- `npx tsc --noEmit` с `NODE_OPTIONS=--max-old-space-size=12288`: без ошибок;
- `npm run verify:apk-design`: OK;
- `git diff --check`: OK;
- чужие OCR/Android/Risk/BB/nutrition изменения и probe-файлы исключены из PRO-6 pathspec.

### 2.3. Канонический профиль

`UserProfile.settings` — единственный канонический источник:

- `settings.personal` — вес, возраст, пол, композиция;
- `settings.training` — equipment, mobility restrictions, workMax и тренировочные параметры;
- `settings.health` — mobility и health restrictions;
- `settings.lifestyle` — сон, HRV, стресс.

Flat-поля `profile.personal`, `profile.training`, `profile.health` допустимы только как временный fallback и не должны быть единственным чтением.

## 3. Сводка находок

| ID | Приоритет | Находка | Основной риск |
|---|---|---|---|
| AR6-01 | P0 | `pickExerciseForMuscle` при пустом целевом пуле возвращает первый произвольный каталог-упражнение | чужеродная мышца/паттерн, обход equipment и exclusion |
| AR6-02 | P0 | `ArmBuilderInput.injuries` и `mobilityRestrictions` не применяются в `buildArmPlan` | план может содержать исключённую/болезненную зону |
| AR6-03 | P0, кандидат | `blocked` отделён от `valid`, а export CTA не имеет найденного hard-stop; UI показывает зелёный `valid` даже при `blocked` | safety-блок можно выгрузить как валидный план |
| AR6-04 | P1 | UI не передаёт equipment/injuries/mobility в ranking и builder | диагностический фильтр и профиль не влияют на итоговый план |
| AR6-05 | P1 | `ArmAutoConstructor` смешивает canonical и flat profile paths; recovery/workMax теряются | неверные веса, RIR, объём и адаптация |
| AR6-06 | P1 | finalizer добавляет synthetic exercises с `weight: 0` без load mode и provenance | неоднозначный bodyweight/tool/external load, потеря traceability |
| AR6-07 | P1 | `builtPlan` сохраняется и валидируется до применения `armEdits`; экспорт использует `viewPlan` | persisted, UI и export могут описывать разные планы |
| AR6-08 | P1 | `AnnualBlockBuildResult` не имеет `armPlan`; ARM-результат кладётся в `bbPlan` через `as any` | небезопасный annual round-trip и неверные consumer assumptions |
| AR6-09 | P1 | `armPlanToUserWeeks` теряет table/character/angle/hold/technique/validation metadata | annual/manual representation не эквивалентна исходному ArmPlan |
| AR6-10 | P1 | `tableTimeBudget` считает долю сессий, а не минуты; `totalWeeks` игнорируется; rationale вычисляет первую неделю и имеет неоднозначный `|| 0 * 100` | неверная отображаемая table-time метрика |
| AR6-11 | P1 | `TAG_MUSCLES_ARM.CrushGrip` содержит `forearms`, которого нет в `ArmMuscle` | неизвестная мышца проходит через frequency/validator paths |
| AR6-12 | P1 | mobility/ortho bridge пишет raw localStorage и может удалять прежние restrictions | stale/разрывы между хабом и конструктором |
| AR6-13 | P1 | неизвестные PED id и часть optional catches сохраняют fallback/тихое подавление ошибок | planner может выглядеть полным при неприменённой ветке |
| AR6-14 | P2 | `useDataLink` вызывается через IIFE с пустым catch; нет надёжной live-profile подписки | stale UI после изменения профиля, React hook/lint риск |
| AR6-15 | P2 | unit-тесты покрывают ranking/guards изолированно, но не полный profile-to-export контракт | регрессии проходят до пользовательского результата |

### 3.1. Статус после реализации

- **AR6-01/02/04** закрыты: builder/finalizer применяют equipment, injury и mobility до выбора; пустой совместимый пул даёт `no_candidate` без чужой замены.
- **AR6-03** закрыт на UI и engine level: `blocked` не показывается зелёным, print/ICS/сводка и операции с вариантами отключены; `buildArmPrintHtml`/`buildArmIcs` бросают typed `ArmPlanExportBlockedError`; safety-состояние не меняет legacy `valid`.
- **AR6-05** закрыт через `armProfileSnapshot`; canonical `UserProfile.settings` является основным источником, flat-поля — fallback.
- **AR6-06/07** закрыты: synthetic/diagnostic/manual упражнения имеют `loadMode` и provenance; snapshot обновляется после edits и повторной валидации.
- **AR6-08/09** закрыты: annual ARM-результат содержит отдельный `armPlan`, а arm metadata переносится в `UserWeek`/`UserSession`/`UserBlock`.
- **AR6-10** закрыт: session share, minutes share и volume share разделены; rationale агрегирует весь план; short-cycle policy использует `totalWeeks`.
- **AR6-11/12** закрыты: canonical muscle token и merge-only profile mobility persistence.
- **AR6-13** закрыт для неизвестных PED и видимых optional degradation; неизвестный PED не получает MRV boost.
- **AR6-14/15** закрыты в profile/snapshot/annual regression matrix; live profile обновление идёт через `useDataLink`/`onProfileChange`.

## 4. Детальный аудит

### AR6-01 — небезопасный fallback упражнения (P0)

`src/engines/arm/arm-builder.engine.ts:90-161`

`pickExerciseForMuscle` сначала строит фильтр по exact muscle mapping, equipment, `excluded` и `usedIds`. Если `pool.length === 0`, функция делает:

```ts
const fb = ARM_EXERCISES.filter(e => !excluded.includes(e.id) && !usedIds.has(e.id)).slice(0, 5);
return fb[0] || ARM_EXERCISES[0] || null;
```

Этот fallback не проверяет:

- целевую мышцу;
- `substitutionGroup`/`movementPattern`;
- equipment;
- технику;
- injury/mobility restrictions.

**Риск:** пустой или слишком узкий пул тихо превращается в первое доступное упражнение каталога, потенциально другой мышцы. Это именно «показано ≠ применено» на границе builder.

**План исправления:**

1. возвращать `null` вместо произвольного fallback;
2. записывать typed `degraded`/`blocked` причину;
3. не добавлять чужое упражнение через finalizer как замену;
4. различать `no_candidate` и `candidate_blocked_by_profile`.

**Минимальные тесты:**

- пустой exact pool при `excluded`/equipment не добавляет упражнение;
- target muscle отсутствует в каталоге → plan blocked/degraded, а не чужой id;
- `usedIds` не превращают fallback в повтор;
- equipment `[]` и `['barbell']` не дают одинаковый невалидный fallback.

### AR6-02 — injury/mobility input не доходит до builder (P0)

`src/engines/arm/arm-types.ts:68-86` объявляет `injuries` и `mobilityRestrictions`, а `src/engines/arm/arm-builder.engine.ts:270-281` извлекает только `equipment`, `favoriteExercises`, `excludedExercises`, `weakPoints` и `focusGroup`.

`armInjuryVolumeFactor` существует в `src/engines/arm/arm-injury-guard.engine.ts:25-31`, но поиск по `src` находит только декларацию. `ArmSelectorInput` содержит injury/mobility (`src/engines/arm/arm-selector.engine.ts:11-24`), но ranking в конструкторе их не получает (`src/ui/screens/TrainingScreen_parts/ArmAutoConstructor.tsx:922-935`).

**Риск:** профиль может содержать `exclude: true` или mobility restriction, но builder всё равно выберет ту же мышцу; safety-функции получают план, который уже не соответствует ограничениям.

**План исправления:**

- нормализовать `ArmInjury` и mobility restrictions в одном input adapter;
- применять restrictions до выбора упражнения, а не после `validateArmPlan`;
- `exclude` должен давать `blocked`, `volumePct` — ограничение объёма, mobility — фильтр движения/ROM;
- сохранять исходную причину в `inputSnapshot` и rationale.

**Минимальные тесты:**

- `side_pressure exclude=true` не попадает ни в одну сессию;
- `wrist` mobility не оставляет pronation/cup/rising без явного safe alternative;
- `volumePct` реально уменьшает direct sets, а не только добавляет warning;
- annual ARM использует те же restrictions, что и direct builder.

### AR6-03 — safety blocked не связан с valid/export (P0-кандидат)

`src/engines/arm/arm-validator.engine.ts:122-144` оставляет `valid = errors.length === 0 && mrvOverflow.length === 0`, а tendon/UCL/shoulder/axis условия идут в `warnings`/`blocked`.

В `src/ui/screens/TrainingScreen_parts/ArmAutoConstructor.tsx:1908-1949` одновременно показываются `blocked`, а затем при `builtPlan.validation.valid` выводится баннер «Валидация пройдена». На шаге экспорта `:2028-2059` нет найденного условия, запрещающего экспорт при `blocked`.

**Риск:** пользователь может получить визуально успешный, но safety-blocked план и выгрузить его без явного override.

**План исправления:**

- сохранить `valid` как legacy-флаг, но добавить `status: 'ok' | 'warning' | 'blocked'`;
- баннер «валидация пройдена» показывать только при `status === 'ok'`;
- export/ICS/variant gate проверять `status`;
- override должен быть отдельным явным действием с причиной и audit note, а не silently enabled;
- `blocked` и `errors` должны доходить до annual/manual export.

**Минимальные тесты:**

- axis score high даёт `blocked` и отсутствие зелёного баннера;
- blocked plan не экспортируется;
- warning-only plan экспортируется;
- explicit override появляется в rationale/audit trail.

### AR6-04 — ranking/build input boundary (P1)

`ArmSelectorInput` уже содержит `equipment`, `injuries`, `mobilityRestrictions`, но `ArmAutoConstructor.tsx:933` передаёт только level/goal/technique/discipline/days/grip/weak/specialization. `buildArmPlan` на `:965-1065` также не получает equipment/injuries/mobility из профиля.

`ArmDiagnosticsHub.tsx:707-712, 819-820` умеет читать canonical equipment и объединять health/training mobility restrictions. Это хороший канон, который нужно переиспользовать, а не дублировать в конструкторе.

**План исправления:** создать один typed `ArmProfileContext`/`resolveArmInputFromProfile`, использовать его в ranking, builder, annual и diagnostics. Не собирать input из нескольких независимых fallback-выражений.

### AR6-05 — profile shape и recovery/workMax (P1)

В `ArmAutoConstructor.tsx`:

- корректный canonical fallback для веса/возраста есть в `:565-566` и `:950-952`;
- `workMax` в `:575-587` читает только `linked.profile.personal`, не `settings.personal` и не `training.workMaxByExercise`;
- recovery в `:950-958` использует `p.personal`/`p.lifestyle`, поэтому canonical settings-only profile теряет bodyFat, leanMass, HRV, сон и стресс;
- `weightForMuscle` в `arm-builder.engine.ts:257-267` при отсутствии мышечного максимума использует `default || 30`.

**Риск:** UI может показать «профиль заполнен», а план получит нейтральные recovery и искусственный вес.

**План исправления:**

- канонический profile adapter;
- приоритет `training.workMaxByExercise` → explicit muscle workMax → body-weight-derived value;
- отсутствие рабочего максимума отображать как `weight unavailable`, а не подменять 30 кг;
- сохранять `inputSnapshot` с источником каждого recovery/weight поля.

### AR6-06 — synthetic load semantics (P1)

`arm-finalize.engine.ts:11-65, 87-102, 278-325` добавляет упражнения с `weight: 0` и частично без equipment/load metadata. `weight: 0` для bodyweight, изометрии, резины и внешнего упражнения — разные вещи.

**Риск:** export (`arm-export.engine.ts:40-42`) скрывает нулевой вес, поэтому пользователь не видит, что это загрузка; annual conversion (`arm-annual.ts:34-51`) также теряет load mode.

**План исправления:** добавить typed load semantics (`bodyweight`, `tool`, `band`, `isometric`, `external`), provenance и source; synthetic fallback не должен быть неявным способом обхода selection.

### AR6-07 — base/edited/persisted/export divergence (P1)

`ArmAutoConstructor.tsx:1109-1114` валидирует и сохраняет `plan` до ручных edits. `viewPlan` создаётся на `:1175`, а экспорт на `:2049-2054` использует именно его. В quality UI уже сказано, что гейты относятся к базовому плану (`:1959`).

**Риск:** сохранённый план, UI-тепловая карта и печать могут иметь разные упражнения/сеты/веса; повторная загрузка теряет ручные изменения.

**План исправления:** выбрать один commit-model:

- либо `editedPlan` становится новым снимком, повторно finalizes/validates/persists;
- либо export явно маркируется `draft overlay` и не используется как persisted plan;
- вариант, ICS, print и annual должны ссылаться на один `planSnapshotId`.

### AR6-08/AR6-09 — annual ARM contract и round-trip (P1)

`ArmAnnualBuildResult` в `src/engines/arm/arm-annual.ts:15-25` имеет `armPlan`, но общий `AnnualBlockBuildResult` в `src/engines/annual-training/annual-training.types.ts:121-135` имеет только `bbPlan`. `block-builders.engine.ts:826-841` кладёт `armRes.armPlan` в `bbPlan` с `as any`.

`armPlanToUserWeeks` (`arm-annual.ts:34-51`) переносит только week/phase/deload/session и минимальные set fields. Теряются `isTable`, session character, working angles, holds, technique, rationale, validation и arm-specific snapshot.

**План исправления:**

- сделать annual result discriminated union по `kind` либо добавить явный `armPlan`;
- сохранить arm metadata sidecar/metadata в `UserWeek`/program;
- typed conversion без `any` и round-trip test;
- annual export/hand-off проверяет `armPlan`, а не читает поле как BB.

### AR6-10 — table time semantics (P1)

`src/engines/arm/arm-table.engine.ts:9-30` считает `tableSessions / totalSessions`; это доля сессий, не доля времени. `tableWeekKind(week, totalWeeks)` не использует `totalWeeks`. В builder `tableRatio` попадает в rationale (`:547, 797, 885`), но выражение `planWeeks[0]?.tableRatio || 0 * 100` смешивает приоритеты и выводит первую неделю вместо фактического результата всего плана.

**План исправления:** выбрать и назвать метрику явно:

- `tableSessionShare` — доля сессий;
- `tableMinutesShare` — доля времени, если длительности доступны;
- `tableVolumeShare` — отдельная объёмная метрика, не смешивать с time.

В UI/печати писать только ту метрику, которая реально посчитана; `totalWeeks` должен участвовать в short-cycle policy.

### AR6-11 — неканонический `forearms` (P1)

`src/engines/arm/arm-day-types.ts:46` содержит `forearms`, но `ArmMuscle` в `arm-types.ts:28-47` такого значения не имеет. `muscleFreq` в selector может создавать неизвестный ключ, а validator — искать landmarks для несуществующей мышцы.

**План исправления:** заменить на каноническую группу/явный adapter и добавить source-lock «каждый TAG_MUSCLES_ARM token ∈ ArmMuscle».

### AR6-12 — raw profile persistence и destructive merge (P1)

`arm-mobility.engine.ts:50-63` пишет `he_profile_v2` напрямую и dispatch-ит только `profile-updated`. `ArmAutoConstructor.tsx:718-789` аналогично работает с `he_arm_ortho_*` и может удалять wrist/forearm/elbow restrictions при отсутствии флагов в payload.

**План исправления:** использовать profile manager/updateSection; raw localStorage оставить только как compatibility adapter с merge-only semantics; тест на сохранение всех restrictions при пустом/старом bridge payload.

### AR6-13 — degraded branches и PED fallback (P1)

В `arm-builder.engine.ts:283-419` есть typed `degraded` для ряда веток, но часть catches остаётся пустой (`:540, 719, 791, 823, 839, 869, 880, 901, 928, 946`). Для неизвестных PED id всё ещё используется dose-based fallback (`:364-400`), хотя PRO-5 обозначил его как долг.

**План исправления:** разделить optional и safety-critical branches; для неизвестного PED — `no boost + degraded`; для safety gate — `blocked`, а не optional warning. Каждый catch должен иметь машинный код и видимую rationale.

### AR6-14/AR6-15 — live profile и тестовый разрыв (P2)

`useDataLink` в `ArmAutoConstructor.tsx:485` скрыт внутри IIFE с пустым catch. `ArmDiagnosticsHub` уже работает с canonical settings, но live refresh в конструкторе не подтверждён. Тесты `arm-selector.test.ts:32`, `arm-diagnostics-p0.test.ts:97,102` и legacy-shape тесты проверяют отдельные функции, но не полный путь profile → build → validate → persist → export.

**План исправления:** подписаться на profile/storage изменения через существующий data-link API; добавить end-to-end matrix и live-update тест без ручного `localStorage.setItem` в production path.

## 5. Web-матрица источников и уровней доказательности

Обозначения:

- **E1 — нормативный/первичный источник**: официальный rulebook, стандарт или прямое исследование с ясным дизайном;
- **E2 — практический первичный источник**: авторская программа/инструкция, полезна как гипотеза, но не RCT;
- **E3 — peer-reviewed косвенный источник**: другое сопоставимое упражнение/спорт или общая тренировочная физиология;
- **U — неподтверждённое утверждение**: нет достаточного прямого источника, нельзя использовать как жёсткий порог.

| Источник | Уровень | Что можно взять | Чего нельзя выводить |
|---|---:|---|---|
| [WAF Rules 2025](https://www.waf-armwrestling.com/wp-content/uploads/2025/05/2025-WAF-Rules.pdf) | E1 для competition rules | правила, возраст/вес, фолы и протокол соревнований | нельзя автоматически превращать правила в универсальную тренировочную дозу |
| [WAF table rules](https://www.waf-armwrestling.com/armwrestling-rules/armwrestling-table) | E1 для equipment | размеры/параметры стола как требования площадки | не подтверждает объём table training |
| [StrengthLog arm-wrestling program](https://www.strengthlog.com/arm-wrestling-strength-training) | E2 | 8 недель, RPE 7–8 → 8–9, 48 ч между high-intensity sessions, table time | нельзя выдавать за универсальную физиологическую норму |
| [RPE vs %1RM periodized study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330) | E3 | RPE/RIR как индивидуализированная альтернатива фиксированному %1RM | не armwrestling-специфический протокол |
| [Arm-wrestling injury review/case evidence](https://pmc.ncbi.nlm.nih.gov/articles/PMC10315927) | E1–E3: E1 для механизма, E3 для лечения/нагрузки | tendon/shoulder/elbow/wrist/humerus риски, необходимость осторожной нагрузки | нельзя из case series выводить точные сеты/частоты |
| [Upper-extremity injury prevention review](https://bjsm.bmj.com/content/bjsports/early/2025/11/04/bjsports-2025-109907.full.pdf) | E3 | ROM, scapular control, strength, load, equipment и conditioning как modifiable factors | не armwrestling/armlifting-specific протокол |
| [Armlifting USA](https://armliftingusa.com/) и [upcoming contests](https://armliftingusa.com/upcoming-contests) | E1 для текущих событий/дисциплины | implement/event vocabulary, 2026 Worlds/Super Series presence | не источник процентов WR или универсального training load |
| [Armlifting USA 2026 equipment/package](https://gripstrength.com/products/super-series-packages-armlifting-usa) | E2/E1–vendor | фактический список Raptor/Country Crush/Fat Gripz/Hub и package context | vendor package ≠ governing rulebook |
| [IronMind Apollon rules](https://ironmind.com/certification/apollons-axle/rules-and-world-records) | E1–vendor для implement | implement-specific rules and records context | не переносить на другие implement без проверки |
| [GRIP-6 combined training](https://pmc.ncbi.nlm.nih.gov/articles/PMC12641669) | E3 | общий grip-strength training signal | не armlifting-specific periodization |
| [Neuromuscular training meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC5694483) | E3 | общий neuromuscular control подход | не задаёт arm-specific dose |

Итог web-аудита: для соревновательных правил и implement-фактов есть первичные источники; для конкретных объёмов, RPE-коридоров, table-time долей и injury-prevention prescription прямого высококачественного arm-specific РКИ в собранном материале не найдено. Поэтому PRO-6 разделяет `official fact`, `practitioner hypothesis`, `indirect evidence` и `unverified`; отсутствие прямого исследования не объявляется доказанным фактом.

## 6. Матрица «источник → код»

| Требование | Текущее место | Состояние PRO-6 | Решение |
|---|---|---|---|
| WAF rules/version | contest-sim/platform-rules | частично есть, нет provenance/version gate | хранить ruleset id/version и не выдавать unknown как verified |
| Table equipment | каталог/`ArmImplement` | implement list уже расширен частично | source-tagged catalog и отдельные platform rules |
| RPE/RIR phase map | `arm-pro5-safety`, `rpeParity` | есть, но input не всегда доходит из UI/annual | единый source field + snapshot |
| Injury prevention | humerus/UCL/shoulder/tendon guards | в основном warnings/blocked | разделить warning, blocked и explicit override |
| Table-time requirement | `arm-table.engine` | session count назван time | исправить семантику и UI-текст |
| Profile equipment/restrictions | `ArmDiagnosticsHub` → builder | обрыв между хабом и planner | единый profile adapter |
| Annual ARM | `arm-annual` → annual block | `armPlan` теряется/маскируется | typed union + round-trip |

## 7. План реализации

### Этап P0 — safety boundary

1. Ввести typed input adapter для профиля, injuries и mobility.
2. Убрать arbitrary fallback из `pickExerciseForMuscle`; пустой pool → `no_candidate`.
3. Применять restrictions до выбора упражнений, включая annual path.
4. Сделать `blocked` самостоятельным terminal state и закрыть export/variant/ICS по умолчанию.
5. Убрать ложный зелёный баннер при `blocked`.

**Приёмка:** mutation-тесты на excluded muscle, mobility restriction, empty pool, blocked export и explicit override; ни один тест не должен проходить «по счастливому fallback».

### Этап P1 — data-flow и контракты

1. Перевести `ArmAutoConstructor` на canonical `settings` adapter и typed input.
2. Ввести единый snapshot `planSnapshotId`; сохранять и экспортировать один post-edit plan.
3. Сделать synthetic load typed и provenance-based.
4. Ввести `armPlan` в annual result contract и сохранять arm metadata при conversion.
5. Разделить `tableSessionShare`, `tableMinutesShare` и target policy.
6. Убрать `forearms` из non-canonical tag map.
7. Перевести profile/mobility writes на profile manager и live subscriptions.
8. Сделать optional catch degradation типизированной и видимой; unknown PED без boost.

**Приёмка:** direct/annual/profile matrix round-trip, persisted/export equality, annual metadata equality, table metric unit tests, canonical tag source-lock.

### Этап P2 — provenance, UX и тестовая матрица

1. Показывать provenance/source рядом с упражнением и метрикой.
2. Добавить UI distinction: `ok`, `warnings`, `blocked`, `no candidate`.
3. Добавить source-lock на неизвестные muscles/equipment и unverified WAF claims.
4. Добавить end-to-end тесты с canonical settings-only profile, live update, edit → persist → export.
5. Обновить документацию после реализации; до этого PRO-6 остаётся планом.

## 8. Тест-план

### Unit

- `arm-builder-safety`: empty pool, excluded muscle, mobility, no arbitrary fallback;
- `arm-profile-adapter`: settings-only, flat fallback, workMaxByExercise, recovery fields;
- `arm-finalizer-provenance`: synthetic load mode, no ambiguous zero;
- `arm-table-budget`: session share vs minutes share, short cycles, rationale;
- `arm-day-types-consistency`: каждый token tag ∈ `ArmMuscle`;
- `arm-annual-roundtrip`: ARM metadata и тип результата без `as any`.

### Integration

- canonical profile → rank → build → finalize → validate;
- injury/mobility → no candidate / reduced volume / blocked;
- edit → validate → persist → print/ICS/variant;
- annual ARM block → result → manual/year export;
- direct `localStorage` write → live profile event → constructor refresh.

### UI

- `blocked` не показывает «валидация пройдена»;
- export CTA disabled/blocked при safety state;
- no-candidate state объясняет причину и не предлагает чужое упражнение;
- settings-only profile отображает реальные equipment/restrictions;
- after profile update форма/следующая сборка видят новые данные.

### Regression

- PRO-5 arm 40/40;
- полный arm engine/UI circle;
- `tsc --noEmit` на изолированном чистом worktree;
- `verify:apk-design`, если меняется UI;
- `git diff --check` и pathspec review перед будущим коммитом.

## 9. Критерии готовности PRO-6

PRO-6 считается закрытым только если:

- любое `blocked` явно видно и блокирует небезопасный экспорт;
- injury/mobility/equipment из `settings` реально влияют на builder и ranking;
- пустой пул никогда не подменяется упражнением другой мышцы;
- persisted plan, edited view и export имеют один snapshot contract;
- annual ARM не теряет `armPlan` и arm-specific metadata;
- table-time UI не называет session share временем;
- `forearms` и другие non-canonical tokens не проходят unnoticed;
- каждый safety-critical catch имеет typed degraded/blocked reason;
- профильные изменения обновляют конструктор без ручного refresh/reload;
- новые интеграционные тесты ловят мутации каждого P0/P1 gating;
- web-источники имеют provenance/evidence level, а unverified claims не становятся hard-coded нормами.

## 10. Зафиксированные решения и границы

1. `AnnualBlockBuildResult` сохраняет отдельный optional `armPlan` рядом с `bbPlan`; `ArmAnnualBuildResult` остаётся узким typed return-типом внутреннего ARM-модуля.
2. Legacy `tableTimeRatio`/`tableTimePct` означают долю объёма. Session share и minutes share публикуются отдельными полями; нулевая длительность не превращается в нулевую длительность всего плана.
3. `ArmInjury` использует единую policy: `exclude`/`volumePct: 0` исключают мышцу, `volumePct` уменьшает сеты, `repsCap` ограничивает повторы, `weightPct` уменьшает вес после подбора упражнения.
4. Safety override не добавлен: `blocked` нельзя экспортировать как валидный план; видимость обеспечивается отдельными `status` и `blocked`.
5. WAF ruleset version не получил новую unverifiable константу: текущие правила остаются versioned данными, а новые требования требуют первичного источника.
6. Provenance хранится на каждом упражнении (`loadMode`, `provenance`, `provenanceSource`) и не дублируется в отдельном скрытом индексе.

Engine-level export hard-stop закрыт: `armPlanExportBlockReasons`/`isArmPlanExportBlocked`/`assertArmPlanExportable` образуют typed контракт, а `buildArmPrintHtml` и `buildArmIcs` отказываются экспортировать blocked-план. Warning-invalid и legacy-планы без `blocked` сохраняют обратную совместимость.

## 11. Статус следующего шага

PRO-6 implementation завершена и проверена, включая typed engine-level export guard. Следующий шаг — отдельный review/патчинг чужих WIP; новые требования не должны расширять safety scope без согласования.
