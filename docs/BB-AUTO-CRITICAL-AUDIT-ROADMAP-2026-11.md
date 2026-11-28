# Критический аудит ББ-Авто и план реализации (Фазы 1–5 · 2026-11-28)

Полный план доработки ББ-Авто по итогам сквозного анализа кода и эмпирического стресс-теста (~45 сценариев через `buildBBPlan` и `convertCycleToBBPlan`) после коммитов `e30e212b6` (Волны 1–7) и `099aec1e4` (Этапы A–C).

## 1. Ключевые утверждённые решения
1. Последовательная реализация **всех 5 фаз (`Фаза 1 → Фаза 5`)**.
2. На Шаге 1 режим `'basic'` становится дефолтом для новых пользователей / `beginner` с переключением в `'pro'` в 1 клик.
3. Реалистичные изоляционные веса (`0.20–0.35×` от `workMax`) с осознанной перекалибровкой затронутых снапшотов.
4. Посторонние WIP-файлы (`arm`, `support-plan`, `labs`, `calculator`, `docs/AGENTS-MEMORY.md`, `package.json`, `.opencode/*`, `tsconfig.tests.json`) не затрагиваются; коммит/пуш — только по отдельной команде пользователя.

---

## 2. Сводка выявленных дефектов

### 2.1. Травмы, боль, реабилитация и мобильность
- **T-1 (P0):** Травма «Поясница» в `InjurySelectCard` мапится на `'core'` → удаляет пресс и оставляет тягу штанги в наклоне, RDL и гакк-присед.
- **T-2 (P0):** Дата окончания травмы (`to`) не работает по неделям: `excludedMuscles` считается по `today` и обнуляет `muscleSessionCount`/`volumeTargets` на весь план (`0,0,0,0,0,0`).
- **T-3 (P1):** `BbExSwapModal` игнорирует травмы, оборудование, осевую нагрузку, уровень, мобильность и `isBBJunk`; без `Portal` и переключения «вся мышца».
- **T-4 (P1):** `MOBILITY_PATTERNS`: `wrist` ошибочно банит `EZ-гриф`, пропуская жим штанги/фронтал; `lower_back`, `hip`, `shoulder` имеют пробелы и проверяют только `ex.name`.
- **T-5 (P1):** `bb-injury-prevention.engine.ts` не исключает `warmupActivator`, ставит `STRESS_THRESHOLDS.high = 40` (ложная тревога на каждой тренировке), не округляет float в `issues` и ложно предупреждает о жиме лёжа + жиме сидя.
- **T-6 (P1):** Нет пресетов тяжести травм и разделения «сустав/синдром» vs «мышца» в `InjurySelectCard`, нет `rehabWeekStart` в UI, `bannedPatterns` не передаётся в `programToBBPlanAsync`.

### 2.2. Специализация
- **S-1 (P0):** `tradeoffMode: 'none'` не даёт буста цели относительно базового плана (`SPEC(chest) <= BASE(chest)`).
- **S-2 (P0):** `replanBBMesoFromFact` не сдвигает `specializationSchedule` относительно `currentWeek` и завышает `workMax.quads` от жима ногами без учёта RIR.
- **S-3 (P1):** Превью блоков специализации в UI рассинхронизировано с нормализатором `buildSpecializationSchedule`; нет мягкого предупреждения для `beginner`.

### 2.3. Веса, пластины, темпы, прогрессия и делоды
- **W-1 (P0):** Изоляция получает вес базы (`Разводка гантелей лёжа = 71.4 кг` при жиме `71.4 кг`); fuzzy-матч W2..N склеивает изоляцию с базой.
- **W-2 (P0):** `bb-plates.engine.ts` навязывает 20-кг гриф гантелям/блокам/тренажёрам при весе ≥ 20 кг.
- **W-3 (P1):** `DELOAD_PROTOCOLS`: `neural` ставит `2×4` на изоляции; `mini` режет до 50%; `full_rest` даёт 1-сетовики.
- **W-4 (P1):** Двойной прогон `loadStrategy`: `double_progression` всегда идёт в `bb-builder`, а затем поверх него накладывается выбранная стратегия в `bb-autocoach`.
- **W-5 (P1):** Перевёрнутые строки темпа в `target-muscle-db.ts` утекают в `tempoSpec`; `3-2-1-0` вместо `3-0-1-2` на пиковом сокращении; `4-1-1-0` на делоде; `eccentricMult` обещает темп, но меняет только вес.
- **W-6 (P1):** Инверсии параметров: `female_luteal > female_foll`, `vol_mrv < vol_mav`, `vbt` режет RIR на все 6 недель вместо 1-й.

### 2.4. Паритет Шагов 1–7 и `Programs / Cycles`
- В `programToBBPlanAsync` не передаются `pedPhase`, `estradiolPgMl`, `bannedPatterns`, `vbt`, `previousPlans`, `cooldownHistory`, `pedPhaseOverride` (не внутри сборки); `replanBBMesoFromFact` возвращает `null` для планов программ.
- Шаг 1: `intensityTech = 'none'` подписан «Авто по фазе», устаревшие описания «Объёмный»/GVT/Gironda, `limitText` без `onCourse`/`pedDoses`/`trainingVolumeMode`, `paramsDepth` стартует в `'pro'`.
- Шаг 2: `applyProPreset` не проверяет уровень/AAS, нет ручного селектора фазы курса.
- Шаг 3: нет превью дней недели сплита и кастомного конструктора.
- Шаг 4: `phaseForWeek` вместо `wk.phase`, устаревшая тепловая карта, `A1` вместо `C1` в гигант-сетах, ключ `collapsedExercises` без `wk.week`, нет времени/TUT дня.
- Шаг 5: не синхронизирует `he_bb_plan_saved` / `he_pl_runtime`, сырой max `weightKg` без e1RM.
- Шаг 6: поля VBT стоят после сборки; `suggestSupersetPairs` без 1-клик применения.
- Шаг 7: противоречивый баннер `!valid`, `phaseForWeek` в табах недель, нет редактирования отдыха/темпа/тиражирования на все недели.

---

## 3. План по фазам

- [x] **Фаза 1** — Травмы (суставы/синдромы, per-week `to` + реинтеграция, `mobility`, `injury-prevention`, `BbExSwapModal`), реалистичные изоляционные веса + `bb-plates`, честная специализация + `bb-replan`.
- [x] **Фаза 2** — Темпы/TUT и 5 профилей темпа, делоды (`neural`/`mini`/`full_rest`), 4 новые `LoadStrategy` (`top_set_backoff`, `dynamic_double`, `rep_goal`, `step_loading`), фикс инверсий `female_luteal`/`vol_mrv`/`vbt`, паритет `Programs/Cycles` и баги Шагов 1–7.
- [x] **Фаза 3** — Методики `hit_heavy_duty`, `smh_lengthened`, `myo_rep_match`, фазы `resensitization` и `metabolite`, бюджет времени `maxSessionMinutes` + 1-клик суперсеты.
- [x] **Фаза 4** — Профили залов (`Зал/Дом/Командировка` + командировка на 1 неделю), конструктор кастомного сплита Шага 3, мастер «Травма/пропуск в середине мезоцикла» (вкл. `Programs/Cycles`).
- [x] **Фаза 5** — Автообучение личных MEV/MRV по истории `he_workout_log_v2`, расширенный редактор Шага 4/7 (`restSeconds`, пресеты темпа, «На все недели»), ручной селектор фазы курса на Шаге 2, светлая тема и APK-шрифты `>= 10px`.
- [x] **Финальная верификация** — `tsc --noEmit`, `verify:apk-design`, полные прогоны `Vitest` (`bb-*` engine + UI) и `vite build`.
