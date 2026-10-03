# Планировщик единоборств — PRO-3: полный аудит, баги и план возможностей

**Дата:** 3 октября 2026
**Метод:** самостоятельный аудит текущего HEAD (без опоры на прежние планы). Прочитаны все 41 движок `src/engines/combat/*` (~250 КБ) и 21 UI-файл `src/ui/screens/combat/*` (~240 КБ); проверены потребители экспортов grep'ом; прогнаны тесты; критические находки лично перепроверены чтением кода (не по отчётам субагентов).
**Baseline (измерено):** `src/engines/combat` — **37 файлов / 697 тестов — 0 падений**; `src/ui/screens/combat` — **11 файлов / 151 тест — 0 падений**.
**Внешние источники (сеть):** поисковый провайдер отдавал 403; использованы DuckDuckGo HTML + PubMed. Дополнительно сверены источники, уже зашитые в коде (PMID в `combat-science.ts`, `combat-measurements.engine.ts`), и свежие практические обзоры: Fight By Design «Fight Camp Periodization» (2025), MMA Fight Bible «Fight Camp Structure» (2026).

---

## 0. Карта системы (для контекста)

### 0.1 Конвейер сборки
`buildCombatPlan(input)` — `combat-builder.engine.ts:328-963`:
1. Клэмпы (weeks 2–12, days 2–4), дефолты discipline/goal.
2. Выбор сплита (явный `patternId` → `getCombatPattern`, иначе `recommendCombatPattern`; форс-даунгрейд при высокой внезальной).
3. Контекстные множители (recovery/nutrition/outside/ACWR/travel) → `weeklyBudget`.
4. Модель периодизации (atr_10/camp_8/linear/conjugate), `taperCfg` (только при `fightDate`), `wcProtocol` (авто только goal=weight_cut).
5. Цикл по неделям: фаза → делод/тапер → сессии по слотам сплита → пул по тегу → фильтры → выбор 5 → сеты/вес/RIR → авто-добавки core и шеи → агрегаты недели.
6. Оверлеи DUP/интенсив-техник → enforcement недельного бюджета → warnings/errors → `CombatPlan`.

Финализация: `finalizeCombatPlan` — `combat-finalize.engine.ts:96-294` (кап упражнения, бюджет сессии, MRV-тримы групп, prehab, балансы, пересчёт агрегатов).
UI: 7 шагов визарда (`CombatConstructor.tsx`), состояние в `useCombatWizard.ts` (~50 useState).

### 0.2 Движки (роль → файл)
| Роль | Файлы |
|---|---|
| Сборка/финализация | `combat-builder`, `combat-finalize`, `combat-core`, `combat-neck` |
| Периодизация/тапер | `combat-periodization`, `combat-taper`, `combat-mesocycle`, `combat-progression` |
| Отбор/объём | `combat-selection`, `combat-volume`, `combat-limits`, `combat-budget-constants`, `combat-groups`, `combat-split-patterns`, `combat-specialization` |
| Нагрузка/техники | `combat-dup`, `combat-intensity`, `combat-loading`, `combat-workmax` |
| Наука/безопасность | `combat-science`, `combat-safety`, `combat-measurements`, `combat-weight-cut`, `combat-weight-class`, `combat-conditioning`, `combat-sparring`, `combat-monitoring`, `combat-vbt`, `combat-diary`, `combat-ped-adaptation`, `combat-female-travel` |
| Интеграции/экспорт | `combat-integration`, `combat-annual`, `combat-storage`, `combat-variants`, `combat-print`, `combat-xlsx`, `combat-graphs`, `combat-cycle-library` |

---

## 1. БАГИ

### P0 — критично (безопасность / потеря данных / сломанная функция)

| # | Баг | Где | Последствие | Фикс |
|---|-----|-----|-------------|------|
| P0-1 | `neck_harness_ext` принудительно вставляется в `full_conditioning` ПОСЛЕ всех фильтров (`chosen.unshift`) | `combat-builder.engine.ts:467-469` | Подросток 14–15 (id в `TEEN_BANNED_EXERCISES`), травма шеи «exclude» и исключённое пользователем упражнение обходятся — динамика шеи возвращается | Вставлять через тот же фильтр-пайплайн (`filterPool`) или скипать при teen/injury/excluded |
| P0-2 | Авто-добавка шеи (missing plane) обходит травмы/исключения/мобильность (есть только teen-фолбэк) | `combat-builder.engine.ts:649-696` | При травме шеи `filterByInjuryCB` вырезает всю шею (`combat-selection.ts:144`), затем авто-добавка возвращает `neck_isometric_front/…` | Единая проверка: `excludedExercises`, `isExcludeInjuryCB` (neck), `mobilityRestrictions`, teen |
| P0-3 | Авто-добавка core обходит травмы/исключения | `combat-builder.engine.ts:599-640` (+ fallback `['landmine_rotation','deadbug']` в `combat-selection.ts:244`) | Травма спины (deadbug/ab_wheel в exclude-списке `combat-selection.ts:148`) возвращается в план | Тот же единый фильтр |
| P0-4 | Fallback-пулы возвращают исключённые/запрещённые id | `combat-builder.engine.ts:235` (`COMBAT_FALLBACK`), `:241-244` (`globalSafe`), `:251-252`, `:259-261`; `combat-selection.ts:89` | Исключил `pullup` → fallback вернул `pullup`; tier-фолбэк возвращает удалённые кабельные | Сверять fallback с `excludedExercises` + teen-списком |
| P0-5 | «✦ В программу» — молчаливый no-op с ложным тостом | `CombatConstructor.tsx:487-502`; приёмник `program-store.ts` (`isUserProgramShape` требует direction ∈ bb/pl/hybrid/arm + integer daysPerWeek/weeks) | Программа не сохраняется, пользователь видит «Экспортировано» | Добавить `combat` в `ProgramDirection` + body-тип, либо маппить в `bb`-тело; тост — только по факту записи |
| P0-6 | Храповик мезоцикла: каждый пересбор бампает веса заново | `CombatConstructor.tsx:374` (`prev = loadCombatPlans()[0]`) + `combat-mesocycle.ts:31-56` | 10 пересборов → +25 кг к каждому compound; нет фильтра дисциплины; плодятся записи (id зависит от workMax) | Гейт «новый мезоцикл» (тумблер/выбор prev), фильтр по discipline, хэш-идемпотентность (прецедент `he_ss_prog_hash_v1`) |
| P0-7 | PED-адаптация мертва: в `peds` летят объекты `PharmaSubstanceEntry[]` вместо `string[]`; `ph.currentSubstancesDoses` не существует | `CombatConstructor.tsx:321-323`; `combat-ped-adaptation.ts:37-51`; `core/types.ts` (`currentSubstances: PharmaSubstanceEntry[]`, доза в `doseMg`) | У пользователя на курсе PED-надбавка объёма не применяется никогда (всегда natural ×1.0), и это не видно | Маппинг `currentSubstances → { [id]: doseMg }`; убрать мёртвое чтение |
| P0-8 | Синхронный дневник читает легаси-ключи; живой — `he_workout_log_v2` | `combat-diary.engine.ts:93`; то же в `combat-vbt.engine.ts:102` | Тренд/индекс e1RM для мезоцикла пустые → прогрессия молча отключена | Первый непустой из `['he_workout_log_v2', …]` (прецедент `hub-diary.engine.ts`) |
| P0-9 | camp + taper → ПУСТОЙ кондиционный план | `combat-conditioning.engine.ts:39` (`camp: ['alactic','lactic']` → `['alactic']`) + `:175` (`filter(modality==='aerobic')`) | У главной цели «кэмп» в тапере исчезает вся кондиция (аэробное поддержание) | Тейпер-фильтр не должен обнулять; оставлять хотя бы поддержание (как для 5+ сессий, `:56-58`) |
| P0-10 | Мульти-цикл года: сумма недель блоков ≠ `totalWeeks` | `combat-annual.ts:55-93` (коррекция `:87-91` правит только последний transition, `Math.max(1, 2-2)=1`) | 52 нед × 2 цикла → 53; 12 нед × 2 → 13; 12 × 4 → 19. Gantt/`annualCBPhaseForWeek` врут | Нормализовать блоки до `tw` (резать/растянуть последний) + тест «сумма = totalWeeks» |
| P0-11 | ICS падает на невалидной дате; битый стор года без валидации | `combat-annual.ts:118-124` (невалидный comp остаётся в списке), `:264-267` (`new Date('мусор').toISOString()` → RangeError); `loadAnnualCB:13` без shape-check; вызов `CombatConstructor.tsx:533-539` без try/catch | Экспорт календаря крашится, ошибка не видна | Валидировать дату при добавлении/загрузке; try/catch + честный тост |
| P0-12 | XLSX-фолбэк пишет битый файл как .xlsx | `combat-xlsx.engine.ts:109-139` (catch → PK-заголовок + 5000 байт мусора; HTML-фолбэк недостижим) | Пользователь получает неоткрываемый файл; тест проверяет только PK+размер | В catch отдавать HTML-фолбэк или честную ошибку |
| P0-13 | Детект холда по кириллической «с»: `reps.includes('с')` | `combat-builder.engine.ts:619` (core), `:676` (шея) | «Мёртвый жук 8-10/сторону» → `workSets.reps = 1`; «Шея боковая 12/стор» → 1; в типах нет `holdSeconds` | Детект по `/\d+\s*с($|\/| )/` + поле `holdSeconds`; либо числовые reps из таблицы |
| P0-14 | Дефолт 50 кг для изометрий шеи | `combat-workmax.ts:205` (`?? 50`), `combat-builder.engine.ts:275` (`bodyweightIds` без `neck_isometric_*`, `neck_band_rotation_isometric`, `neck_eccentric_flexion`, `neck_harness_rotation`) | «Изометрия затылка 50 кг» (35 кг у женщин) — в плане и печати | Добавить в `bodyweightIds` (вес 0) или в `DEFAULTS` |

### P1 — важное (корректность/честность)

| # | Баг | Где | Суть |
|---|-----|-----|------|
| P1-1 | Спарринг-гейт привязан к «есть делод в плане» | `combat-builder.engine.ts:885-894` + `combat-safety.engine.ts:154` | Любой план ≥5–8 нед имеет делод → hard spar запрещён ошибкой на весь план; `isFightWeek:false` хардкод, `isTaperWeek` не используется. Поведение закреплено тестом (`combat-safety.test.ts:150-152`) — нужен осознанный re-baseline |
| P1-2 | weight_cut на 2 недели: только taper+deload | `combat-periodization.engine.ts:91-96`; `clampWeeks` min 2 (`builder:47`) | Рабочих фаз нет; UI позволяет 2 нед |
| P1-3 | «Na 1г/кг» в заметке fight week | `combat-weight-cut.engine.ts:183` | Опасная единица (верно 1 г/л — там же `:221`); текст уходит в rationale/план |
| P1-4 | Prehab `face_pull` без оборудования/травм, вес 15 кг хардкод | `combat-finalize.engine.ts:206-225` | Зал без кабеля получает кабель; травма плеча/исключение игнорируются |
| P1-5 | Двойной счёт шеи и `battle_rope` в группах | `combat-groups.ts:33-39` (маркер `rotation` ловит `neck_*rotation*`; `rope` ловит `battle_rope`) | `trimToMRV('rotational'/'grip')` режет шею/ротацию; `weekGroupSets` завышены |
| P1-6 | Билдер выпускает до 6 сетов при капе 4/5 | `builder:488,494-504,525` vs `combat-limits.ts:11` | Все потребители `buildCombatPlan` без финализатора получают нарушение; финализатор режет с warning |
| P1-7 | Ложный warning «N сетов > лимита» после set-флора | `combat-finalize.engine.ts:121-124` | `removed=0`, `totalSets` не обновлён — предупреждение врёт |
| P1-8 | `validateCombatPlan` не пересчитывает, а ДОБАВляет старые ошибки; после правок не вызывается | `builder:1013-1039` (комментарий противоречит коду); UI `CombatConstructor.tsx:415-485` | `plan.validation.ok` остаётся false после исправлений; гейт экспорта по устаревшим данным |
| P1-9 | Правки в «восстановленном» варианте уходят в live-план | `CombatPlanView.tsx:143-148,373-385`; `cb-variants.tsx:20,44` | Рендер из `restored`, мутации — в `plan`; «Сохранить вариант» сохраняет не то, что видно |
| P1-10 | Своп упражнения не пересчитывает вес/reps/RIR/темп/комментарий | `CombatConstructor.tsx:461-485` | После замены остаётся вес и комментарий прежнего упражнения |
| P1-11 | Агрегаты недели (totalSets/totalTonnage) не пересчитываются после правок | `CombatConstructor.tsx:415-485`; эталон `combat-finalize.engine.ts:91-94,257` | Сводка/печать врут после правок веса/повторов |
| P1-12 | Мастер-тумблер «Учитывать нагрузку вне зала» не управляет спаррингом | `CombatConstructor.tsx:328,341,602` | Тумблер выключен, кнопки скрыты, а план учитывает спарринг; сводка показывает «спарринг N×» |
| P1-13 | Метрики вне зала в UI не совпадают с планом в спарринг-режиме | `useCombatWizard.ts:93`; бейджи `CombatConstructor.tsx:631,1057-1059`; `CombatPlanView.tsx:246` | Показывается `outside`, план строится от `sparringLoad` |
| P1-14 | ACWR/дневниковая нагрузка на неверной шкале | `useCombatWizard.ts:100,105` | Суммируется `s.load \|\| s.sRPE \|\| s.rpe`; канон — AU = sRPE × durationMin (`pro/srpe-store.ts`) |
| P1-15 | UTC-даты (нарушение канона `core/local-date`) | `useCombatWizard.ts:56` (startDate); `cb-camp-measurements.tsx:80,98,103`; `combat-annual-card.tsx:45` | Вечером в UTC+ ключи дня уезжают на вчера |
| P1-16 | Жиры: три формулы в одном конвейере | `combat-weight-cut.engine.ts:196-199` (мин 40/30) vs `:266-268` (мин 30 обоим) vs `combat-integration.engine.ts:37,52` (без пола) | Нарушение Atwater-консистентности, разные цифры в плане/мосте |
| P1-17 | ORS: три коридора | `combat-weight-cut.engine.ts:105` (кламп 50-90), `:241` (валидация 30-100, текст «50-90»), `:214` (без клампа) | 120 пройдёт валидацию и уйдёт в питание |
| P1-18 | Журнал спарринга фабрикует длительности и не сходится с планом | `combat-measurements.engine.ts:32` (90/60/75/40 мин) vs `:257-260` (rounds×roundMinutes); UI пишет `roundMinutes=5` всегда (`cb-camp-measurements.tsx:104`) | Журнал 5×5=25 мин → в план уедут «90 минут hard»; две разные сводки одной недели |
| P1-19 | Фантомные поля `waterCutL`/`sodiumCutG` | `cb-camp-intel.tsx:59` | Всегда «вода 0.0 л · натрий 0 г» |
| P1-20 | Rationale обещает «объём ×0.85», снижение не применяется | `builder:397` vs `:509` (`legacyWc` только при goal=weight_cut); финализатор честно предупреждает | В одном плане оба противоречивых текста |
| P1-21 | Флаг taper без среза при далёком бое | `builder:431,509-516` | ATR `realization` → `taper=true`, комментарий «объём ↓ 35-55%», `taperVolumeMultiplier` вне окна = 1 |
| P1-22 | `taperWeeks` игнорируется без даты боя | `CombatConstructor.tsx:336` | Активный контрол без эффекта |
| P1-23 | `combatPlanId` не учитывает `workMaxByExercise`; мёртвое чтение `weightClassRuleset` | `builder:981-1011` | Разные планы получают один id → `saveCombatPlan` затирает запись |
| P1-24 | Legacy-id коллапс: все планы без id → `'cb_legacy_migrated'` | `combat-storage.ts:56` | Разные планы сливаются в один |
| P1-25 | Открытые весовые категории не поддержаны | `combat-weight-class.engine.ts:137,152` (`Number.isFinite(Infinity)` отбрасывает; ветка `open` недостижима); `CombatConstructor.tsx:963` | Баннер лимита исчезает для `+92 кг`/ultra |
| P1-26 | Тепловой скрининг: `fightWeek:false` хардкод; `HEAT_EVIDENCE` не выводится | `cb-camp-measurements.tsx:178-182`; `combat-measurements.engine.ts:1095` | Ветка «Неделя боя» мертва |
| P1-27 | RTP не гейтит план: не завершён → hard spar/интенсивность не блокируются | `combat-measurements.engine.ts` (`rtpSummary` только экран) | Самый чувствительный к безопасности блок не влияет на сборку |
| P1-28 | Весовая траектория не корректирует сгон | `cb-camp-measurements.tsx:75-81` (`weighTrajectory/cutDeviation` только показ) | Нет аналога BB `prepWeightAdvice` («одна переменная за раз») |
| P1-29 | `courseIntensity` никогда не задаётся UI; `trainingYears` не читается; favorites/excluded не доезжают | `combat.types.ts:22,53`; `CombatConstructor.tsx` | PED-интенсивность/стаж/предпочтения — мёртвые входы |
| P1-30 | VBT-контур: UI убран (решение 2026-09-27), половина движка мертва | `CombatConstructor.tsx:329-331`; `combat-vbt.engine.ts:84,114,153-158` | `loadVbtHistoryCB`/`saveVbtHistoryCB`/`diagnoseVelocityLossEwma` — 0 потребителей; авторегуляция по скорости для новых планов потеряна |
| P1-31 | Шея: мультипланарность только warning'ом; `neckVolumeCheck`/Collins-подсказки не выводятся | `combat-finalize.engine.ts:198-204`; `combat-neck.engine.ts:107-123` | Авто-добавка даёт 1 плоскость за неделю |
| P1-32 | Тейпер советует сауну подросткам | `combat-taper.engine.ts:58`; `builder:405` | Противоречит teen-гейту (`combat-safety.engine.ts:52-63`) |
| P1-33 | NaN `labMrvMultiplier`/`recovery` отключает enforcement молча | `builder:367-374` (клампы NaN не лечат) | Все сравнения с бюджетом = false |

### P2 — гигиена и мелочи

- **Мёртвые экспорты (~25):** `ensureMandatory` (заглушка, комментарий врёт), `conjugateMethodForSession`, `phaseForCombatWeekNew`, `combatDiaryStatsFromSessions`, `combatNutritionEventPayload`, `buildCombatShareHash`, `weekGroupExercises`, `COMBAT_VOLUME_GROUPS`, `checkStatus`/`normLevel`, `variantChangedRows`, `SET_EQ_COND_MIN`, `TAPER_SC_*`, `buildAnnualATRCycles`, `validateCombatCycles`, `validateCombatPatterns`, `femaleCutTempoDefault` (импортирован, не вызван), `HOTEL_POOL`, `CB_ANGLE_CLASSES`, `CB_TIER`, `getGradedInjuriesCB`, `injuryLocationText`, `ensureStrictCombatCoverage`, `getCombatWorkMax`; в UI — `removeCombatPlan`, `he_combat_meal_preview` (write-only), `he_last_combat_program` (write-only).
- **Мёртвые ветки/импорты:** `builder:8,9,26,29,33,36` (импорты без вызовов), `:439-442` (пустой if), `:480-483` (недостижимый fallback), `:310-314` (sled-ветка — no-op для row/med_ball/kb_swing), `:315-316` (обещанный trace не существует).
- **Типы/комментарии:** `combat.types.ts:118` (`endurance` в комментарии фазы, нет `conjugate`); `CombatExercise.reps: string` vs `CombatSet.reps: number` — нет `holdSeconds`; `hrvGrade/diaryTrendCB/diaryLastResultIndex` читаются через `as any`; `injuries?: any[]`.
- **i18n:** `CB_RU_MODEL` не знает `camp_8`/`linear` (`builder:132`, print-копия) → в печать уходят сырые id.
- **Разминка:** 1 сет 50% (нет лестницы); `buildWorkSets` — N идентичных сетов, параметр `isHeavy` мёртв (перезатирается `:587`).
- **UI-мелочи:** селект теста E8 показывает «Выбрать…» (`cb-camp-measurements.tsx:336-341`); `cb-camp-intel.tsx:167` useMemo без `fightMinutes`; текст «% бюджета» вместо сет-эквивалентов (`cb-camp-intel.tsx:91-92`); `outsideSessions` в интелидже всегда 0 (`CombatConstructor.tsx:1279`); `battle_rope→grip` в diary; `combat-print.engine.ts:48` QR через внешний `api.qrserver.com` (офлайн/утечка хэша); `daysToFirstFight` берёт самую раннюю (прошлую) дату; кнопка удаления боя 32px.
- **Хардкоды:** `face_pull` 15 кг; филлер сетов `{reps:5,rir:2}`; шея `>14` vs MRV enhanced 16; натрий 5000 мг в integration (против ~2800 в BB-prep); `38` ккал/сет.

---

## 2. ВОЗМОЖНОСТИ PRO — эпики

> Формат: цель → что есть сейчас → что сделать → научная база → файлы → критерий приёмки.

### Э1. Замкнуть контуры «данные → план» (главный прирост)

| # | Что | Сейчас | Сделать |
|---|-----|--------|---------|
| 1.1 | **Спарринг-журнал → план** | `loadSparring` живёт только в экране замеров; план берёт ручные счётчики | При монтировании/сборке подставлять фактические hard/tech/wrest за 7/14 дней; показывать «журнал vs ввод»; гейты (P1-1) считать по неделям |
| 1.2 | **Весовая траектория → авто-коррекция сгонки** | `weighTrajectory/cutDeviation` — только показ | Движок `cutWeightAdvice` (аналог BB `prepWeightAdvice`): avg7d vs prev7d, темп %/нед против цели, одна переменная (±150 ккал / ±20 мин), запрет в taper/fight week, запись в историю |
| 1.3 | **RTP-гейт** | `rtpSummary` — только экран | Не завершён RTP → hard spar 0 (error), интенсивность ≤RIR 3, объём −20%; ступени RTP как календарь недель |
| 1.4 | **Дневник → per-exercise авторегуляция** | `applyCombatMesocycle` только «hold» при −5% | e1RM↓5% → RIR+1/вес −5%; plateau → замена упражнения (пул strict-группы); рост → double progression |
| 1.5 | **Замеры хвата/шеи → добивка** | `gripSummary` — только показ | Асимметрия >10% → +1–2 сета слабой стороне; шея <cutoff → приоритет экстензии в плане |
| 1.6 | **VBT — вернуть или честно списать** | UI убран, движок полумёртв | Вариант A: читать скорость из живого дневника (`velocity` в `workout-logger`) и замыкать EWMA; вариант B: пометить `@deprecated` и удалить мёртвое (P1-30) |

### Э2. Прогрессия внутри цикла (сейчас её нет)

| # | Что | Сейчас | Сделать |
|---|-----|--------|---------|
| 2.1 | Недельная прогрессия весов | Вес = статическая функция `workMax` (`builder:272-319`), прогрессия только кросс-мезо | Double progression: репы в диапазоне → при достижении верха +2.5% (compound) / +1 кг (изоляция), сброс повторов; `prescribeLoad`-прецедент из BB |
| 2.2 | По-сетовая структура | N идентичных сетов + 1 разминка 50% | Топ-сет + бэкоффы (90% топ-сета ×2), разминочная лестница 40/60/75/85%; поле `holdSeconds` |
| 2.3 | Делод | Нет ветки reps/RIR (фолбэк [5,8]) | Свой профиль делода (reps −30%, RIR+2, темп контролируемый) |
| 2.4 | Conjugate по-настоящему | `conjugateMethodForSession` мёртв; модель меняет только фазу | ME/DE/RE ротация по сессиям (`week % 3`), wave %; тест на чередование |
| 2.5 | Contrast-техника | Только комментарий (`combat-intensity.ts:27-31`) | Реальные плио-вставки в пары (присед→прыжок, жим→медбол), RIR/объём по фазам |
| 2.6 | Капы из единого источника | Билдер до 6 сетов, срез в финализаторе | Билдер уважает `perExerciseCap` (P1-6) |

### Э3. Безопасность и медицина

| # | Что | Сейчас | Сделать |
|---|-----|--------|---------|
| 3.1 | Единый safety-пайплайн для авто-добавок | 4 обхода фильтров (P0-1…4) | Одна функция `admitExercise(id, ctx)` для ВСЕХ путей (пул, fallback, core, шея, prehab) + мутационные тесты |
| 3.2 | Шея 4 плоскости на сборке | 1 плоскость за неделю + warning | Добивать missing плоскости в ту же сессию (кап сессии уважать), выводить `neckVolumeCheck` и Collins-подсказки |
| 3.3 | Teen: сауна и единый контекст | Тейпер советует сауну всем (P1-32) | Фильтр rationale по teen-гейту; teen-контекст во все тексты |
| 3.4 | Concussion: return-to-train в плане | Только errors/checklist-текст | Календарь возврата (покой→аэробка→тех→спарринг) неделями в плане; лимиты hard spar по стадиям на всём горизонте |
| 3.5 | Весогонка: пост-взвешивание и единые числа | `weightCutPostWeighInPlan` — тест-онли; ORS/Na разъезжаются | Вывести стадии 0-60мин/1-2ч/3-6ч/6-24ч на экран/печать; единый ORS-коридор; женский RED-S в гейты |
| 3.6 | Оборудование: честный маппинг | Только cable/sled эвристики; band привязан к cable | Полный словарь (band/bodyweight/kettlebell/grip_tool), prehab под оборудование (P1-4), fallback не возвращает исключённое |

### Э4. Данные, UI, экспорт

| # | Что | Сейчас | Сделать |
|---|-----|--------|---------|
| 4.1 | Менеджер планов | Нет загрузки/удаления/сравнения в UI | Загрузка плана в конструктор, `removeCombatPlan`, история с датами, сравнение A/B |
| 4.2 | Варианты | Правки restored утекают в live (P1-9) | Правки применяются к показанному; «Сохранить» сохраняет показанное |
| 4.3 | Ре-валидация после правок | Не вызывается (P1-8) | `validateCombatPlan` чистая (без накопления старых ошибок) + вызов после каждого edit |
| 4.4 | Экспорт в программу | No-op (P0-5) | `combat` в `ProgramDirection` (+ тело) или маппинг в `bb`; нативный share/copy (прецедент `shareOrCopyText`) |
| 4.5 | PED-поверхность | Объекты вместо id, нет интенсивности | Маппинг `{id: doseMg}`, селект courseIntensity, строка «PED-надбавка ×N» в плане |
| 4.6 | Даты | UTC-нарушения (P1-15) | `localIsoDate` везде; D-day = ближайший будущий бой |
| 4.7 | Своп и агрегаты | Без пересчёта (P1-10/11) | Пересчёт веса/повторов/темпа/комментария от workMax; пересчёт totalSets/Tonnage (или ре-финализация) |
| 4.8 | Новый мезоцикл | Храповик (P0-6) | Тумблер «прогрессировать от предыдущего», выбор prev, фильтр дисциплины, хэш-идемпотентность |

### Э5. Наука и контент

| # | Что | Сейчас | Сделать |
|---|-----|--------|---------|
| 5.1 | Библиотека циклов | 13 шаблонов, нет enhanced/weight_cut для бокса/кика/борьбы, нет hotel/female/teen | Расширить до ~25: enhanced, weight_cut×4 дисциплины, camp для борьбы/общей, hotel/bodyweight, female-контур, teen; валидация покрытия «дисциплина×цель×уровень×дни» с честным списком дыр |
| 5.2 | Годовой план | Блоки — только календарь; `startDate` мёртв; mini-taper не реализован; сумма недель врёт (P0-10) | Сборка плана по блокам, якорь startDate, per-block экспорт, mini-taper ×0.65–0.75, нормализация недель |
| 5.3 | Кондиция | Фазовая, без недельной волны; camp+taper пусто (P0-9) | Недельная периодизация модальностей, размещение по дням с разносом ≥36 ч от hard spar, VO2 3–5 мин / fight-sim 3×5 раундов / повторные спринты 15–30 с, делод-логика |
| 5.4 | Профиль поединка | `fightMinutes` негде ввести → строка всегда «не задана» | Ввод длительности (3×3 / 5×5), энергопрофиль в план, темп-ориентиры раунда |
| 5.5 | Мониторинг | ACWR на RPE-баллах (P1-14); VBT-пороги разъезжаются с каноном | AU = sRPE×мин; HRV-база lnRMSSD из движка в хаб; VBT-пороги к `pro/vbt` |
| 5.6 | Замеры | Нет журналов RMR/мощности (weightCycleVerdict недостижим); heat fightWeek false | Журналы RMR/мощности, HEAT_EVIDENCE, fightWeek-проводка, удаление записей в UI |
| 5.7 | Женский контур | Лютеиновая — только warning | Мягкая модуляция объёма/RIR по фазе цикла; LEA из sRPE (сейчас всегда `no_data`) |

### Э6. Гигиена и архитектура

| # | Что | Сделать |
|---|-----|---------|
| 6.1 | Чистый финализатор | Убрать чтение localStorage (`combatHrvReport` в `combat-finalize.engine.ts:277`) → HRV в input |
| 6.2 | Типы | `holdSeconds`, актуализировать комментарий фазы, внести runtime-поля (`hrvGrade/diaryTrendCB/diaryLastResultIndex`) в `CombatInput`, типизировать injuries |
| 6.3 | Единые пороги | Сгон 5/8% (`combat-science`) вместо литералов; VBT-пороги один источник; группы — без двойного счёта (P1-5) |
| 6.4 | Мёртвый код | Удалить/пометить ~25 экспортов и мёртвые ветки (список в §P2) |
| 6.5 | i18n | `CB_RU_MODEL` + camp_8/linear; единицы (сет-эквиваленты vs %, Na) |
| 6.6 | Тесты | Мутационные на каждый P0-обход; матрица года «сумма недель = totalWeeks»; property-тест «билдер ≤ perExerciseCap»; тест «журнал спарринга = план»; UI-тесты новых гейтов |

---

## 3. Осознанные границы (что НЕ делаем)

1. **Faithful-режим** (если появится) — дословность источника приоритетнее капов; сейчас режима нет — не вводим.
2. **Медицинские протоколы** (диуретики, в/в регидратация, фарма-дозы сгонки) — только гейты и «к врачу», без назначений.
3. **Популяционные нормы тестов** — в коде честно «тесты не предсказывают тайм-моушен»; не выдумываем нормы.
4. **Поглощение дублей strength-sport** (`weightClassFor`, `weightCut*`, `vbtEwma` и др. скопированы в SS) — расхождения зафиксированы, но слияние сломает потребителей SS; отдельное решение владельца.
5. **Полный рефактор god-файлов** (`CombatConstructor.tsx` 108 КБ, `combat-builder` 80 КБ) — только по мере правок эпиков.

---

## 4. Порядок выполнения (волны) и критерии приёмки

| Волна | Состав | Критерий |
|---|---|---|
| **В1 — P0-безопасность и данные** | P0-1…4 (safety-пайплайн Э3.1), P0-13, P0-14, P0-9, P0-10, P0-11, P0-12 | Мутационные тесты на каждый обход; матрица года; xlsx/ics не крашатся; билдер не даёт reps=1 у холдов |
| **В2 — P0-интеграции** | P0-5 (экспорт), P0-6 (храповик), P0-7 (PED), P0-8 (дневник) | E2E: экспорт появляется в библиотеке; 10 пересборов = 1 бамп; PED из профиля даёт ×>1; тренд виден |
| **В3 — P1-корректность** | P1-1…33 по приоритету (сначала 1-1, 1-3, 1-4, 1-5, 1-6, 1-8, 1-16, 1-17, 1-18, 1-27, 1-28) | Осознанные re-baseline закреплённых тестов с комментариями «было→стало» |
| **В4 — Э1+Э2 (PRO-ядро)** | 1.1–1.6, 2.1–2.6 | План прогрессирует по неделям; журнал влияет; RTP гейтит; VBT/VBT решён |
| **В5 — Э5 (наука/контент)** | 5.1–5.7 | Библиотека ≥25 с валидацией покрытия; год собирается; кондиция не пустеет; профиль поединка |
| **В6 — Э4+Э6 (UI/гигиена)** | 4.1–4.8, 6.1–6.6 | Менеджер планов; ре-валидация; мёртвый код удалён; типы чисты |

**Проверка каждой волны:** `npx vitest run src/engines/combat src/ui/screens/combat` (baseline 697+151), `tsc --noEmit`, `verify:apk-design`. Тесты, закрепляющие баги (`combat-safety.test.ts:150-152` и др.), переписываются только осознанно с комментарием «было→стало».

---

## 5. СТАТУС ВЫПОЛНЕНИЯ (3 окт 2026, продолжение wave8 — остаток §5 закрыт)

**Сделано и проверено** (`src/engines/combat` + `src/ui/screens/combat` — **942/942**, `tsc --noEmit` **0**, `verify:apk-design` OK, user-program/manual-круг 56/56):

- **В1 (P0-1…4, 9–14)**: единый `admitCombatExercise` (пул/fallback/авто-core/авто-шея/prehab) — teen-бан, травмы, исключения, мобильность, оборудование; `holdSeconds` + детект по цифре; изометрии шеи вес 0; camp+taper кондиция; нормализация недель года (52×2=52, 12×4 кламп циклов); валидация дат года + shape стора + ICS guard; XLSX реальный ArrayBuffer (**найден и закрыт скрытый дефект: экспорт ВСЕГДА писал pad-муляж, тест проходил на нём**). NEW `combat-pro3-wave1` 16/16.
- **В2 (P0-5…8)**: `combatPlanToUserProgram` + `ProgramDirection 'combat'` + `CombatProgramBody` + shape/validate + редактор/иконки; хэш-гард мезоцикла (`combatMesocycleHash`/`shouldApplyCombatMesocycle`, фильтр дисциплины); PED-маппинг `{id: doseMg}`; живой ключ `he_workout_log_v2` + `flattenDiaryLogsCB` (weightKg→weight). NEW `combat-pro3-wave2` 12/12.
- **В3 (P1)**: гейт спарринга по неделям (делод снимает, не блокирует; тест пере-базлайнен «было→стало»); weight_cut 2 нед; «Na 1г/л»; prehab через admit + честный warning; группы без двойного счёта (шея≠ротация, battle_rope≠хват) + xlsx/отчёт на каноне; кап упражнения из `sessionLimitsForCombat`; ложный warning после set-флора; тапер-флаг только в окне боя; rationale ×0.85 только при weight_cut; NaN-гарды; id плана + `workMaxByExercise`/`weightClassRuleset`; уникальные legacy-id; открытая категория; спарринг-журнал: фактические длительности + поле «мин/раунд» + кнопка «⟡ Из журнала»; жиры/ORS едины; RTP-гейт (error hard spar + RIR≥3); совет по темпу сгона (`cutWeightAdvice`); UTC→`localIsoDate` (wizard/замеры/год); метрики вне зала в спарринг-режиме; мастер-тумблер управляет спаррингом; ACWR на AU (sRPE×мин); courseIntensity-селект + favorites/excluded из профиля; шея 4 плоскости на сборке; teen-сауна; VBT-экспорты `@deprecated`. NEW `combat-pro3-wave3` 13/13.
- **В4 (Э1/Э2)**: недельная double progression (+2%/2 нед, кап +6%, делод/тапер/весогонка нейтральны); делод собственные повторы; conjugate ME/DE/RE реально по сессиям (движок был мёртв) + rationale; дневниковая авторегуляция (просадка группы >5% → вес −5%, RIR+1). NEW `combat-pro3-wave4` 6/6.
- **В5 (частично, Э5.1/Э5.4)**: библиотека **13→25** (весогонка ×4, кэмпы борьбы/общей, enhanced×2, отель, женская база, teen, поддержание ×2) + покрытие-лок; `fightMinutes` → энергопрофиль боя в rationale/интелидже + поле ввода. NEW `combat-pro3-wave5` 5/5.
- **В6 (частично, Э4.1)**: менеджер сохранённых планов (загрузка/удаление); ре-валидация после правок (finalize-семантика в хэндлерах); своп пересчитывает вес/темп/отдых; агрегаты недели после правок; вариант restored выходит из просмотра при правке.
- **В7 (продолжение, вторым заходом)**: **Э2.2** разминочная лестница 40/60/75/85% (было 1 сет 50%) + топ-сет и бэкоффы 90% на тяж-базе ≥3 сетов (делод ровный); **Э5.3** `conditioningSuggestedDays` (0=Пн, разнос ≥36ч) в сессиях + строка размещения в rationale; **Э5.6** `HEAT_EVIDENCE` выведен в тепловой блок (был мёртвым экспортом); **Э6** `CB_RU_MODEL` camp_8/linear (rationale и печать), **чистый финализатор** (HRV только из снимка плана, localStorage больше не читается), селект теста E8 показывает текущий тест, удалены 8 проверенно мёртвых экспортов (`ensureMandatory`, `phaseForCombatWeekNew`, `weekGroupExercises`, `checkStatus`, `variantChangedRows`, `combatDiaryStatsFromSessions`, `combatNutritionEventPayload`, `buildCombatShareHash`). NEW `combat-pro3-wave6` 7/7.
- **Продолжение (третьим заходом)**: **Э5.5** журналы RMR/мощности (`loadRmr`/`addRmr`/`loadPower`/`addPower`/`rmrDeltaFromJournal`/`powerDeltaPctFromJournal`, капы/валидация) + UI-блок «Весовые качели» в замерах с `weightCycleVerdict` (RMR −253/мощность −27% → danger, источник PMID 40443978); **Э5.3-недельная волна**: нечётные недели накопления — power-акценты (полный отдых), чётные — capacity (Jamieson) + строка rationale; **Э6-P2**: внешний QR `api.qrserver.com` убран из печати плана/года (офлайн-АПК, хэш не утекает), `daysToFirstFight` = ближайший БУДУЩИЙ бой (прошлый больше не перекрывает отсчёт). NEW `combat-pro3-wave7` 9/9.
- **Продолжение (четвёртым заходом, wave8 — остаток §5 закрыт)**:
  - **Э5.2 — год собирается планами по блокам**: `buildAnnualPlans(annual, opts)` — `buildCombatPlan` + `finalizeCombatPlan` на каждый блок (цель из фазы `annualBlockGoal`: accumulation/gpp/transmutation→power, realization/taper→camp, transition→maintenance; `patternId`/`level`/`weightCutKg`/`daysPerWeek`/sex/cyclePhase из opts); `blockStartDate(annual, block, startDate)` — якорь «неделя 1 = startDate года» (невалидный якорь → null, без Date.now-догадок); taper-блок режет объём единым источником `combat-taper` (блок с датой боя — канонической кривой билдера, без даты — явными `TAPER_SC_PRE/FIGHT/FIGHT_SHORT` linear-сборкой без двойного среза); маркер `🔻 Mini-taper` в rationale; блок длиннее лимита мезоцикла (12 нед) собирается повторным циклом недель (перенумерация, маркер в rationale); ошибки блоков изолированы (`status:'error'` + `error`, остальные собираются); персист переживает shape-валидацию. Per-block строка «план блока: N нед · X сетов/нед · фаза» в `buildAnnualPrintHtml`; на `AnnualCard` — «📦 Собрать планы блоков» + на каждом собранном блоке «🖨 Печать блока» и «📂 В конструктор» (обработчики в `CombatConstructor`, проброс через `CombatPlanView`).
  - **Э5.7 — LEA из sRPE**: `estimateTrainingKcalFromDiary(srpeSessions, opts)` в `combat-measurements` — кардио-часть = реальные MET-оценки `estimateCardioEntryKcal` за окно (`he_cardio_sessions`, живьём через `loadCardioLog`); силовой вклад из sRPE **честно `null`** (подписанной формулы sRPE→ккал в проекте нет — множитель не выдуман), `partial:true` + строка «введите вручную»; авто идёт в `resolveScreenInputs` (ручной ввод приоритетнее), подпись источника «из дневника» и честная нота на карточке.
  - **Э5.7 — женская модуляция по фазе цикла**: NEW `combat-female-cycle` — фаза из `he_cycle_log` (паритет с `planner-cycle-calendar`, lock-тест на 40 днях: границы фаз/медиана длины идентичны), `cycleModulationFor`: лютеиновая — объём недели −7% и RIR+1, менструальная — −10% и RIR ≥3 (без отказа), фолликулярная/овуляция — норма; гейт `sex==='female' && cyclePhase` (без лога — байт-в-байт по weeksData/rationale/id); срез объёма недельный (на упражнении −7%/−10% округлялись до нуля при 2–3 сетах), делод/тапер не режутся повторно; конструктор читает фазу из лога при сборке.
  - NEW `combat-pro3-wave8` **18/18** + UI `combat-pro3-wave8-ui` **8/8**.

**Итог прогонов**: `src/engines/combat` + `src/ui/screens/combat` — **942/942** (57 файлов; 783 движков + 159 UI; база 848 + 94 лока в 9 файлах `combat-pro3-wave1..8`), `tsc --noEmit` **0**, `verify:apk-design` OK, user-program/manual-круг 56/56.

**Осталось (честные границы)**:
- Э5.7 закрыт: LEA — кардио-часть реальная, силовая честно `null` до появления подписанной формулы sRPE→ккал; женская модуляция — только при наличии лога `he_cycle_log`.
- Э6: VBT-трио (`loadVbtHistoryCB`/`saveVbtHistoryCB`/`diagnoseVelocityLossEwma`) оставлено `@deprecated` по политике «API сохранён»; тест-локнутые экспорты (`validateCombatCycles`, `TAPER_SC_*`, `CB_ANGLE_CLASSES` и др.) не удалялись осознанно.
- P1-8: семантика `validateCombatPlan` задокументирована (сохранённые ошибки — из входных гейтов; свежесть через ре-сборку), «чистый fresh-режим» не вводился осознанно.
- P1-29: `trainingYears` не пробрасывается — поля нет в профиле (граница).
- P0-10/P0-11 покрыты тестами; `combatPlanId` изменился (добавлены `workMaxByExercise`/`weightClassRuleset` в стабильный хэш) — старые сохранённые планы не удаляются (лежат в списке), новые id уникальнее.

## 6. Промт новой сессии (остаток: Э5.2 год планами, LEA из sRPE, женская модуляция) — ✅ ВЫПОЛНЕНО wave8 (см. §5)

> «Выполни остаток плана `docs/COMBAT-PLANNER-PRO-3-PLAN.md` §5 — крупные эпики, вынесенные в новую сессию.
> Только Edit/Write + vitest/tsc; чужие файлы не трогать; коммит строго pathspec; без пуша.
>
> **1) Э5.2 — год собирается ПЛАНАМИ по блокам** (`combat-annual.ts` + `combat-annual-card.tsx`):
> - движок `buildAnnualPlans(annual, opts)`: для каждого блока строить `CombatPlan` (`buildCombatPlan` + `finalizeCombatPlan`):
>   `discipline` блока, `weeks = block.weeks`, цель из фазы (accumulation/gpp→power, transmutation→power, realization/taper→camp,
>   transition→maintenance), `patternId`/`level`/`weightCut` из opts; писать `block.plan` и `status:'built'`;
>   ошибки блока — изолированы (`status:'error'` + текст), сборка остальных продолжается.
> - **Якорь дат**: `blockStartDate(annual, block, startDate)` — неделя 1 = startDate; блоки получают `startDate`/`fightDate`
>   (для блока с соревнованием — дата боя → `fightDate` в план, тапер сам сработает).
> - **Mini-taper**: для блока `phase==='taper'` (1-2 нед) объём по `TAPER_SC_PRE/FIGHT` (единый источник `combat-taper`),
>   маркер в `block.plan.rationale`; для блока с `phase==='realization'` — не дублировать (план сам ставит realization).
> - **Per-block экспорт**: строка «план блока: N нед · сетов/нед · фаза» в `buildAnnualPrintHtml`; кнопка «🖨 Печать блока»
>   (`buildCombatPrintHtml(block.plan)`) и «📂 В конструктор» (загрузка `block.plan` в CombatConstructor) в `AnnualCard`.
> - тесты: `buildAnnualPlans` 52 нед → все блоки built, сумма недель планов = weeks блока, ошибка одного блока не рушит год,
>   mini-taper-блок режет объём, `blockStartDate` от якоря, печать содержит строки планов.
>
> **2) Э5.7 — LEA из sRPE**: `trainingKcal` для `leaScreen` авто-источником из дневника:
> `estimateTrainingKcalFromDiary(sessions, opts)` в `combat-measurements` — сумма `estimateCardioEntryKcal` (кардио-дневник,
> реальные оценки) + силовой вклад из sRPE **только с подписанным источником/формулой** (если формулы нет — честно `null`
> и строка «введите вручную»; не выдумывать множитель). Пробросить в `resolveScreenInputs` как auto при пустом ручном.
> Тест: сид кардио-дневника даёт kcal>0; без данных — null и честный текст.
>
> **3) Э5.7 — женская модуляция по фазе цикла**: фаза из `he_cycle_log` (паритет с BB `planner-female-cycle`):
> лютеиновая (последние ~5 дней) → объём −5–10%, RIR+1; менструальная → лёгкая неделя без отказа; фолликулярная → норма.
> Гейт: `sex==='female' && cycleLog`. Честная строка в rationale; математика — только при наличии данных лога.
> Тест: лог → модификатор применён; без лога — байт-в-байт.
>
> Проверка: `npx vitest run src/engines/combat src/ui/screens/combat`, `tsc --noEmit`, `verify:apk-design`; обновить §5 дока и AGENTS; показать diff-сводку.»

