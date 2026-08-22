# BB-AUTO — ПЛАН КАЧЕСТВЕННОЙ ГЕНЕРАЦИИ (все пути, все циклы)

> Консолидированный план из диалога (20-21.08.2026). Покрывает выбор упражнений, объём,
> нагрузку (сеты/reps/RIR/темп/дропы), восстановление/данные пользователя, локализацию,
> соревновательный блок, все сплиты/циклы. Финальный этап — полный анализ + тесты + план доработок.

---

## 1. Целевые недельные объёмы (спина — эталон)

**Правило:** `сеты/нед = упражнения/сессию × сеты/упр × сессии`. Пропорция мышц от спины.

| мышца | коэфф. | натурал, новичок | натурал, макс | курс, макс |
|---|---|---|---|---|
| спина | ×1.00 | 12–15 | 30–32 | **56–64** |
| грудь | ×0.85 | 10–13 | 26–27 | 48–54 |
| квадры | ×0.85 | 10–13 | 26–27 | 48–54 |
| бицепс бедра | ×0.68 | 8–10 | 20–22 | 38–44 |
| сред.дельта | ×0.5 | 6–8 | 15–16 | 28–32 |
| зад.дельта | ×0.35 | 4–5 | 11 | 20–22 |
| бицепс | ×0.55 | 7–8 | 17–18 | 31–35 |
| трицепс | ×0.55 | 7–8 | 17–18 | 31–35 |
| ягодицы* | ×0.55 | 7–8 | 17–18 | 31–35 |
| трапеция | вторичная | 5 | 8 | 10 (не ×2) |
| икры/пресс/предплечья/шея | вне бюджета | мин | мин | мин |

*ягодицы — только женский.

---

## 2. Полная сетка параметров (все дискретные значения)

**Формула:**
```
perMuscleTarget = натуральная_база(level) × стаж-бэнд × курс-стек × courseIntensity
                  × goal × volumeGoal × recovery × nutrition × eccentric
вторичные = фикс. бэнды; игнор-мышцы = вне бюджета
```

**Уровень** (beginner/intermediate/advanced/enhanced): спина 12–15 / 16–20 / 20–26 / 28–36.

**Стаж** (0–50, step 0.5): 0–1 → 12–15, 2–3 → 16–20, 4–5 → 20–25, 6–10 → 26–32, 10+ → 30–35.

**Курс** (AAS / +инсулин / +ГР / +IGF1 / +MGF): натурал 30–32, AAS 40–48, AAS+ГР 48–55, полный стек **56–64**.

**Интенсивность курса** (courseIntensity): mild ×1.0, moderate ×1.05, heavy ×1.1.

**Цель** (goal): mass ×1.05, maintenance ×1.0, recomp ×0.9, cut ×0.75, strength_mass ×1.05.

**Объём-цель** (volumeGoal): mev ~0.6×, mav ×1.0, mrv ~1.3×.

**Фокус** (strength/hypertrophy/endurance): объём ×1.0 (RIR/reps/темп разные).

**Восстановление** (сон/HRV/стресс): good ×1.0, moderate ×0.95, poor ×0.85.

**Питание** (calorieSurplus): >300 ×1.1, >100 ×1.05, 0 ×1.0, <-200 ×0.8.

**Эксцентрик** (eccentricMult): 1.0 ×1.0, 1.1–1.2 ×1.05–1.10 (только primary).

Проверка: новичок-натурал 12–15 → макс всё 56–64 (×4).

---

## 3. ПЛ-авто: объём — выбор пользователя (высоко/низко объёмный)

- **Высокообъёмный** (вариант по умолчанию) — полная таблица выше.
- **Низкообъёмный** — консервативная версия (ближе к натуральному MAV, без ×2 на курс в максимуме).
- Переключатель в UI; к каждому варианту — **пояснение** (что меняется и почему).
- **Разминочные подходы** добавляются, если требуются по структуре, но **НЕ идут в кап тренинга** — это разминка. Тренинг считается в рабочем диапазоне RIR.

---

## 4. Восстановление + данные → недельный бюджет

```
профиль/курс/лаб/дневник → recoveryScore → computeBBWeeklyBudget
→ sessionLimitsFor(split) → per-muscle allocation → buildSession/loading → авторегуляция
```

- **`recoveryScore`** (0–100): сон+качество, HRV/vsБаза, стресс, bodyFat, leanMass, возраст, готовность. Неизвестные сигналы — нейтрально.
- **`computeBBWeeklyBudget`**: база режима × recovery × nutrition × ПЕД-rec × lab × демо. Заменяет хардкод 24/40/60.
- **ПЕД = режим** (натурал/средний/тяжёлый), ×2 на главные мышцы + бюджет, **НЕ** умножает landmarks (без «×2.2×2.0»).
- **Кнопки распределения недельного капа/восстановления:** «Авто» (стандарт) и «По дневнику» (из истории дневника).

---

## 5. По-цикловые капы (каждый цикл — свои)

- **Недельный бюджет** — общий (системное восстановление).
- **По-сессионные капы** — производные от сплита (`sessionLimitsFor(input, split)`).

| Категория сплита | групп/сессию | maxExercises | maxWorkingSets/сессию |
|---|---|---|---|
| FullBody | все (~7) | 12–14 | ~30 |
| Upper/Lower / Torso/Limbs | 4–6 | 10–12 | ~35 |
| PPL / PushPull / ChestBack / ShouldersArms | 2–3 | 8–10 | до ~44 (тяж-день) |
| Bro / solo-дни | 1–2 | 6–8 | высокие |
| Rolling | 3–5 | 8–10 | ~35 |

---

## 6. День-структура и логика 2×/нед (адаптация под каждый сплит)

- **PPL 2×/нед**: пуш/пул — тяж/памп; **ноги всегда тяжёлые** (день1: квадры тяж + бёдра памп; день2: наоборот).
- **Логика 2 тренировок на мышцу** (тяж + памп), адаптируется под **каждый сплит** (FullBody/Upper-Lower/bro/rolling и т.д.): главная мышца дня — тяж, вторая — памп.
- **Готовые программы (режим)** — идут «как есть» (faithful).
- **Режим переделки программы** — адаптируется под эту логику.
- **Соревновательный режим** — сохраняет логику + добавляет свои фичи.
- Разминка — 1 рамп-подход, вне нагрузки.

---

## 7. Логика подбора упражнений (все функции мышцы)

Выбор обязан:
1. **Покрывать все функции/паттерны мышцы** (`derivePattern`/`trueMuscleOf`).
2. **Варьировать углы и хваты** для полноты развития (`ANGLE_CLASSES`, `verticalPullProfile`: wide/neutral/underhand).
3. **Соблюдать баланс базы и изоляции**.
4. **Учитывать индивидуальные особенности и приоритеты** (травмы, оборудование, мобильность, bodyweight, фавориты, исключённые, осевая).
5. **Распределять объём без перегрузки одних паттернов в ущерб другим**.
6. **Включать дроп-сеты, FST-7 и другие выбранные пользователем фичи**.
7. **Недельно варьировать упражнения** (не каждую неделю, но для прорисовки/сепарации).

### Стимул-микс на сессию (стрес / растяжка / забивка)

| Стимул | Что | Типы | Снаряд/повт |
|---|---|---|---|
| **⚡ Стрес** | тяжёлые compound | жим/тяга/присед | штанга/машина, 4–6 |
| **🧲 Растяжка** | lengthened-позиция | incline curl, RDL, straight-arm, sissy, deep squat | 8–12 |
| **🔥 Забивка** | метаболический памп + техника | cable fly, pushdown, leg curl, face-pull | кабель, 15–20 + drop |

**Стимул-микс по мышцам:** спина 5–6 (3 стрес + 1–2 растяжка + 1–2 забивка), грудь 4 (2+1+1), квадры 3–4 (2+1+1), бёдра 3 (1–2+1+1), бицепс 2–3 (1+1+1), трицепс 2–3 (1+1+1), сред.дельта 2 (1+0+1).

**Порядок:** стрес (compound-первым) → растяжка → забивка. Бейджи `⚡/🧲/🔥`. Инвариант: ≥1 каждого стимула в сессии главной мышцы.

### Слабая группа vs специализация (ВАЖНО — разные вещи)

- **Специализация** — **забирает кап** у других мышц себе (перераспределение volume bucket).
- **Слабые группы** — **смещают баланс паттернов БЕЗ расходования капа другой мышцы**:
  - акцент смещается на **20%** в пользу слабой части тренируемой мышцы;
  - **+1 упражнение (3–4 сета)** на этот вид в день, **без учёта капа**;
  - выбор пользователя в UI для учёта в генерации.

---

## 8. Вариативность упражнений (выбор пользователя)

| Режим | Поведение |
|---|---|
| **Запрет** | строго одни и те же упражнения |
| **Строгий** | смена раз в 4 недели |
| **Разнообразие** | при 2 тренировках/мышцу/нед — меняется упражнение, сохраняя нагрузку и паттерн (тяга в тренажёре → тяга штанги в Смите; то же для бицепса/трицепса) |

---

## 9. Пояснения к упражнениям (обязательно, не «так можно/так можно»)

Чётко указывать:
- **ширина хвата**;
- **движение локтя** (вдоль тела / в стороны);
- **какая мышца работает** (широчайшая / центр-ромбовидные / задняя дельта и т.д.);
- **куда локоть / куда тянуть**;
- **паузы** (обязательно, помечаются);
- **контроль амплитуды / медленное отпускание**;
- **комментарии к темпу**.

Маппинг: `backSubgroup` + `verticalPullProfile` + `targetLabel` (хват + направление + цель), подаётся в `comment`/`executionProfile`/экспорт.

---

## 10. Дроп-сеты и другие фичи (помечаются и расписаны)

- Каждая техника (dropset/rest_pause/myo_rep/21s/FST-7/GVT/8×8/superset/DUP) — **помечается** бейджем.
- **При нажатии на значок** — полное пояснение: какая фича, как делать, **сколько скинуть вес**, с чем и как.
- `autoAssignIntensityTechniques` (дропы на последний сет памп-аксессуаров), `markAntagonistSupersets`, `applyVolumeScheme`, `applyDUPOverlay`, deload-протоколы.

### Бейджи (полный список визуальных меток)

Все метки видны в плане/PDF и подписаны. Единый слой `bb-badges.ts` (по образцу `backSubgroupLabel`/`armHeadLabel`).

| Бейдж | Где | Что |
|---|---|---|
| ⚡ **Стрес** | compound-упражнение | механическое натяжение (тяж) |
| 🧲 **Растяжка** | lengthened-позиция | мышца в растянутой позиции |
| 🔥 **Забивка** | памп-аксессуар | метаболический стресс |
| 💥 **Дроп-сет** | последний сет памп-изоляции | + сколько скинуть вес (напр. −20%) |
| ⏸ **Rest-pause** | изоляция | мини-серии через 15с |
| 🔁 **Myo-reps** | разгибания | активация + мини-серии |
| ✳ **21s (7-7-7)** | сгибания на бицепс | 7+7+7 при специализации бицепса |
| 📦 **FST-7 / GVT / 8×8** | памп-изоляции | 7×12/30с, 10×10/75с, 8×8/60с |
| 🔗 **Суперсет с «X»** | пара-антагонист | грудь↔спина, бицепс↔трицепс, квадры↔бёдра |
| 🌊 **DUP** | неделя | волновое чередование |
| ⚡ **При наличии сил** | зад.дельта +4, бицепс +3 | optional-сеты, не в минимуме, срезаются первыми |
| 📐 **Ширина/Толщина/Задняя/Трапеции** | спина | `backSubgroup` |
| 🦴 **Головка** | бицепс/трицепс | `armHeadLabel` |
| 🧠 **Функц. паттерн** | упражнение | вертикальная/горизонтальная тяга и т.д. |
| 🔧 **Замена (осевая/мало-многосуставная)** | заменённое | причина замены |
| 🏁 **Подготовка/Тапер/Пик** | prep-недели | фаза |
| ⚠ **Риск** | упражнение | суставы/поясница/импинджмент |

---

## 11. Кнопки замены упражнений

- **«Исключить осевую нагрузку»** — заменяет все осевые упражнения по типу.
- **«Меньше многосуставных»** — замена:
  - присед → гакк-присед / жим ногами;
  - тяга штанги → тяга штанги в Смите;
  - тяга гантелей → тяга гантелей лёжа на лавке;
  - и т.д. (детальный анализ + добавление нужных упражнений в каталог).
- **Становая тяга, жим стоя и т.п.** — включаются **только в силовом цикле и только по кнопке пользователя**.

---

## 12. Методики и варианты тренинга

- Добавить больше методик/вариантов к выбору (анализ действующих + что добавить).
- **Интенсивность** — от неё зависят отдых/время отдыха/восстановление.
- **Лаборатория упражнений / BB-инструменты**: темп, отдых, техника по уровню спортсмена — привязать в BB-авто (сейчас частично есть `bb-tempo-rest`, `bb-exercise-instructions`, `PHASE_CONFIGS`).

---

## 13. Локализация + отчёт + сводка

- **Все группы мышц на русском** (`MUSCLE_LABEL_RU`), дни — `SESSION_TAG_RU`.
- **Отчёт адаптировать** под все изменения/выборы пользователя.
- **Расширенная недельная сводка сетов** по каждой мышце, например для спины:
  - 2 тренировки/нед;
  - тренировка 1: 30 рабочих сетов, 12 разминочных;
  - тренировка 2: данные;
  - паттерн такой-то — столько, широчайшая — столько, косвенная нагрузка — столько.

---

## 14. Соревновательный блок (prep/contest)

- База = `buildBBPlan` (та же логика).
- **Единый дефицит**: свести `nutritionMult(-200)` и `prepDeficitMult(0.93)`.
- **Дроп-техники/суперсеты назначать ПОСЛЕ prep-оверлеев**; failure-протоколы (RIR0/негативы) убирать только в пик-неделю, dropset/rest-pause/21s держать в финальной подготовке.
- Prep-недели не раздувать (guard распространить на новые проходы).
- Соревновательный режим сохраняет логику 2×/нед + добавляет свои фичи.

---

## 15. Все пути/циклы + лимиты

- **Применяется ко ВСЕМУ ББ-авто** (generic, cycle→plan, prep-цикл, contest-prep, годовой план, соревновательный режим).
- **ЕДИНСТВЕННОЕ исключение:** генерация из готовой программы в режиме **полноты программы (faithful)** — сохраняет оригинал **как есть** (состав/порядок/объём исходной программы не переделываются).
- **Всё остальное**, включая адаптацию программы (adapt), циклы, prep и соревнования, — идёт **по этим принципам**.
- Общая логика (buildSession/buildBBPlan/finalizeBBPlan) автоматически применится ко всем путям, кроме faithful.
- **Унификация лимитов**: `sessionLimitsFor(input, split)` вместо 13 хардкод-тернарников (bb-builder:3164/3201/3241, bb-finalize:1354/1970/2000/2052/2394, bb-validator:40–43, cycle-to-plan:1209/1244/2044/2063, bb-tradeoff:27/122/131/138).

---

## 16. Убрать стэкинг / дед-код

- Удалить `backVolumeProfile/legVolumeProfile/torsoVolumeProfile` (×2.2/1.8/1.6) и PED `combinedMrvMultiplier` из целевого объёма.
- `setCap` back 10 → 4–5; `exMin` 3 → 3–4.
- Пробой-флоры `remainingBudget = pl.sets×10/120` (1938–1955) снять.
- Игнор-мышцы (икры/пресс/предплечья/шея) исключить из MRV/fatigue; разминку из всех агрегаций.
- Дед-код: `selectDiverseExercises` подключить/удалить; `computeLoading` заменить inline-копию.

---

## 17. Регрессия / тесты

Инварианты: спина 12–15 → 56–64, грудь/ноги пропорционально, `direct ≤ MRV`, 0 single-set, 0 >5 сетов/упр, игнор вне бюджета, `optional` не в минимуме, 0 повторов ≤4 нед, ≥1 каждого стимула (стрес/растяжка/забивка), всё на русском, `targetLabel` у каждой тяги, капы по-цикловые, слабая группа +20%/+1 упр без капа.

---

## 17a. Технические предложения автора (из диалога)

Проверено по коду; все закладываются в реализацию:

1. **`recoveryScore` (0–100)** — единая функция вместо разрозненных множителей; неизвестные сигналы нейтральны. Заменяет inline-копию `buildBBPlan:2287–2295` и `computeBBRecoveryMultiplier`.
2. **`computeBBWeeklyBudget`** — недельный кап из восстановления (база 110/160/220 × recovery × nutrition × ПЕД-rec × lab × демо). Заменяет хардкод `24/40/60`.
3. **`sessionLimitsFor(input, split)`** — по-цикловые капы (13 мест: bb-builder:3164/3201/3241, bb-finalize:1354/1970/2000/2052/2394, bb-validator:40–43, cycle-to-plan:1209/1244/2044/2063, bb-tradeoff:27/122/131/138).
4. **Убрать стэкинг**: `backVolumeProfile/legVolumeProfile/torsoVolumeProfile` (×2.2/1.8/1.6) и PED `combinedMrvMultiplier` из целевого объёма.
5. **`setCap` back 10 → 4–5**, `exMin` 3 → 3–4; снять пробой-флоры `remainingBudget = pl.sets×10/120` (1938–1955).
6. **`optional`**-флаг «при наличии сил»: не в MEV-минимуме, не в целевом, срезается первым.
7. **Игнор-мышцы** (икры/пресс/предплечья/шея) исключить из MRV-капа и fatigue-бюджета; разминку из всех агрегаций.
8. **Дед-код**: `selectDiverseExercises` подключить/удалить; inline-копию loading в `buildSession` заменить на `computeLoading`.
9. **ПЕД = режим** (натурал/средний/тяжёлый), ×2 на главные мышцы + бюджет, не умножает landmarks.
10. **Дроп-техники/суперсеты назначать ПОСЛЕ prep-оверлеев**; failure убрать только в пик-неделю.
11. **Prep-единый дефицит**: свести `nutritionMult(-200)` и `prepDeficitMult(0.93)`.

---

## 18. Финальный этап — полный анализ + тестирование + план доработок

По завершении реализации:
1. Полный анализ всех методик/выборов — **реально применяются** при генерации.
2. Полное тестирование всей работы (bb-матрица, все пути, prep/contest, все сплиты).
3. Составить план доработок/улучшений по результатам.

---

## 19. Подтверждение полноты

Все пункты плана (1–18, включая все пункты Alex из сообщения и все технические предложения
из диалога) — **обязательны к реализации**. В конце каждого этапа — тесты; в конце всей работы —
полный анализ + тестирование + план доработок. Файл является единственным источником требований
для реализации BB-авто.

## 20. Статус реализации (21.08.2026)

**Готово и проверено (тесты зелёные, tsc 0):**
- ✅ Объёмная модель «натурал × режим» (`bb-volume.engine.ts`): `computeRegimeMrvMult` (×2),
  `regimeMrvMultFor`, `computeBBRecoveryScore`, `computeBBWeeklyBudget`, `sessionLimitsFor`.
- ✅ Убран стэкинг (backProfile/legProfile/torsoProfile ×2.2/1.8/1.6 + PED из целевого объёма);
  onCourse выводится и из `pedDoses`.
- ✅ Ноги всегда тяжёлые (`FORCE_HEAVY_GROUPS` += quads/hamstrings/glutes).
- ✅ Флаг `optional` на `BBExercise`.
- ✅ Локализация (`bb-labels.ts`): `SESSION_TAG_RU`, `muscleLabel`, `targetLabelFor`,
  `exerciseTargetNote` (хват + куда тянуть + цель) — применены в рендерах дня/мышц/комментариев.
- ✅ Слабые группы: +1 упражнение (3-4 сета) `optional` без капа (post-finalize, skip focus).
- ✅ Кнопки (engine): `fewerCompound` (машина/Смит/поддержанные выше), `allowStrengthLifts`
  (становая/жим стоя только при true).
- ✅ Расширенная недельная сводка (`bb-summary.engine.ts`: сессии/рабочие/разминочные/паттерны/
  direct/косвенная) + рендер в плане.
- ✅ Вариативность (`rotationMode`: forbid/strict/variety) — постоянная selWeek в forbid,
  отключение freshness/ротации, primary-стабильность.
- ✅ Лимиты централизованы: builder + validator + finalize + cycle-to-plan (4 места) на `sessionLimitsFor`.
- ✅ Prep-нарратив честно отражает применённый nutrition-дефицит.
- ✅ Валидатор централизован на `sessionLimitsFor`.
- ✅ UI: кнопки «🚫 Исключить осевую», «🏗️ Меньше многосуставных», «🏋️ Становая/жим стоя
  (только силовой цикл)» и селектор «🔄 Вариативность» подключены в `BbAutoConstructor`.
- ✅ Отчёт адаптирован (`bb-report.engine.ts`): `optionalExercises`, `weakPoints`,
  `expandedSummary` + полный текстовый отчёт `buildBBPlanReportText` (сводка/нагрузка).
- ✅ Кнопки работают на ВСЕХ путях (generic + cycle/program): `allowStrengthLifts`/`fewerCompound`
  применены и в cycle-to-plan (замена становой/жима стоя; смещение к машинам/Смит/поддержанным).
- ✅ Интенсивность тренинга (`intensityLevel` light/moderate/high) — модулирует отдых
  (плотность/восстановление) во всех путях + UI-селектор.
- ✅ Лаборатория-привязка по уровню: `buildExerciseInstructions` адаптирует темп/технику/
  прогрессию под уровень спортсмена (новичок — медленнее/безопаснее, продвинутый — стандарт);
  передаётся из buildSession во все упражнения плана.
- ✅ День-гард малых мышц: шраги/предплечья не в Push/Chest; stale-комментарии пересобираются.
- ✅ Карточка muscle volume показывает режим-масштабированные капы (×2 на курсе), а не натуральные.
- ✅ Прорисовка/сепарация вторичных мышц подтверждена регрессией (средняя дельта в груди,
  задняя дельта в спине, RDL на растяжение в ногах).
- Тесты: bb-область 1360 зелёные; полный прогон 6844/6845 (единственное падение —
  пред-существующее `bb-macrocycle.test.ts` v7, чужой WIP).

---

## 21. Дополнение 2026-08-22: детализация на каждую мышцу (подмышца + паттерн + пояснения) + консолидация отчётов качества

> Запрос: «в плане на каждую мышцу дополнительно подмышца, паттерн и объяснения чем оно хорошо и как работает. отчёты качества дублей много и они не соответствуют» — фиксируется как обязательный этап 21.

### 21.1 Проблема (аудит 2026-08-22)

**Детализация по мышцам — неполная:**
- `bb-summary.engine.ts:65-74` строит `subGroups` только для `muscle === 'back'` (ширина/толщина/верх спины/задняя дельта). Остальные мышцы — только `byPattern` / `byExercise`, без подгрупп. Пользователь видит «Грудь — 12 сетов, паттерн horizontal_push 8, isolation_chest 4», но НЕ видит разбивку «верх (ключица, incline_push, 4 сета) / середина (horizontal_push, 6) / низ (decline/dip_push, 2) + растянутая позиция (fly, 2)».
- `bb-report.engine.ts:115-126` рендерит `subGroups` только для спины; для других мышц — плоский список.
- `bb-exercise-instructions.engine.ts` / `exercise-biomechanics-db` дают богатые `executionProfile` (паттерн, cues, stretch/peak/MMC, темп, progression, ошибки) — но они попадают только в `comment`/`executionProfile` отдельного упражнения, не агрегируются на уровень мышцы/подмышцы в сводке/отчёте.
- `TARGET_MUSCLE_DB` / `EXERCISE_CATALOG.targetMuscle` содержат точные русскоязычные мишени («Большая грудная (верх)», «Широчайшие, ромбовидные»), но не сводятся в подмышечную таксономию плана.
- Итог: нельзя проверить «все ли функции мышцы закрыты», нельзя объяснить выбор.

**Отчёты качества — дубли и расхождения:**
- Сейчас существует 6 независимых источников «качества», считающих одно и то же по-разному:
  1. `expandedSummary` (`bb-summary.engine.ts`) — `workingSets/warmup/direct/indirect/byPattern/byExercise/subGroups`.
  2. `balanceReport` (`bb-balance.engine.ts`) — `press/pull/raise, compound/isolation, lengthened/mid/shortened, patterns, byMuscle.coverage, issues`.
  3. `fatigueReport` (`bb-fatigue.engine.ts`) — `systemic/axial/joint/local/timeSeconds` per session/week.
  4. `rotationReport` (`bb-rotation.engine.ts`) — `primaryByMuscle / accessoryPatternsByMuscle / issues`.
  5. `validation` (`bb-validator.engine.ts`) — `empty/sets_mismatch/single_set/muscle_attribution/effective_mrv_overflow/target_volume_deficit/session_muscle_leak/deload/taper`.
  6. `safetyScore` (`bb-safety-score.engine.ts`) — 0-100, агрегирует jointStress + acwr + recovery + injury + volumeCompliance + frequency + **balance** (пересчитывает `analyzeBBBalance` заново, дублируя `balanceReport.issues`).
  7. `report` (`bb-report.engine.ts:28-57`, `buildBBPlanReportText`) — агрегирует `weeklyVolume/fatigue/rotation/balance/validation/expandedSummary` в один `BBPlanReport`, но часть полей считается повторно (peakVolume из `weeklyVolume`, а не из `expandedSummary` → расхождения peakDirect/expandedSummary.totalWorkingSets, см. `bb-balance.test` vs `bb-summary.test`).
- Расхождения: `weeklyVolume` (direct/effective из `bb-volume.aggregateBBVolume`) vs `expandedSummary.byMuscle.directSets` (считает `exerciseVolumeContributions` + fallback `ex.sets`) — дают разные `directSets` при наличии `warmupActivator`/`indirect`. `balanceReport` считает `lengthened/mid/shortened` по `name + catalog.stretchPhase/peakContraction`, а `expandedSummary` не считает позиции вообще. `validation.effective_mrv_overflow` использует `mrvByMuscle ?? landmarks`, а `safetyScore.volumeCompliance` — только `mrvByMuscle/landmarks` с другим допуском (×1.1 vs ×1.15) → один и тот же план даёт warning в одном отчёте и «safe» в другом.
- UI (`BbAutoConstructor.tsx:3078-3721`) рендерит 4 отдельных карточки: сводка + ротация + fatigue + баланс + SafetyScore + report — пользователь видит 3-4 разных «качества» без единой точки правды. PDF/CSV (`BbAutoConstructor:3390-3450`, `bb-report:64-149`) экспортируют `report + balance + fatigue`, но не `expandedSummary.byPattern`.

### 21.2 Цель — на каждую мышцу: подмышца + паттерн + пояснение «чем хорошо и как работает»

**Требование:** в плане и в UI на каждую каноническую мышцу (`chest/back/shoulders/quads/hamstrings/glutes/calves/biceps/triceps/forearms/traps/abs`) дополнительно показать:
- **подмышцы** (анатомически обоснованные доли) — см. таблицу ниже;
- **паттерны** по каждой подмышце — канонические `movementPattern` из каталога + fallback `derivePattern`;
- **пояснение «чем хорошо и как работает»** — 1-2 предложения на подмышцу/паттерн из единого источника (не «так можно / так можно»): механика, угол/хват, где растяжение/пик, почему этот выбор закрывает функцию.

**Каноническая таксономия подмышц (источник: TARGET_MUSCLE_DB + EXERCISE_CATALOG.targetMuscle + WEAK_TO_MUSCLE):**
- `chest`: `chest_upper` (ключичная, incline_push, 30°, stretchPhase) / `chest_mid` (стернальная центр, horizontal_push) / `chest_lower` (нижняя, decline_push/dip_push) / `chest_stretch` (изоляция, isolation_chest, fly/crossover в растянутой).
- `back`: `back_width` (широчайшая, vertical_pull, wide/neutral) / `back_thickness` (ромб/середина, horizontal_pull, row) / `upper_back` (трапеции верх/середина, shrug/row) / `rear_delts` (задняя дельта, isolation_shoulders/face_pull) / `traps` (трапеции, отдельно, фикс.бэнд) / `erectors` (разгибатели, hinge). — уже есть в `bb-summary.subGroups`, расширяется на все планы.
- `shoulders`: `delt_front` (передняя, vertical_push) / `delt_mid` (средняя, lateral raise/abduction) / `delt_rear` (задняя, rear_delt_fly/face_pull — уже `armSubgroup/backSubgroup`).
- `quads`: `quads_rectus` (прямая, leg_ext/sissy, stretch) / `quads_vastus` (латеральная/медиальная, squat/leg_press/hack).
- `hamstrings`: `hamstrings_hip` (тазобедренный шарнир, hinge: RDL/good_morning, lengthened) / `hamstrings_knee` (сгибание колена, knee_flexion: leg_curl, shortened).
- `glutes`: `glutes_max` (большая, hip_extension: hip_thrust/glute_bridge) / `glutes_med` (средняя, abduction: kickback/cable_abduction).
- `biceps`: `biceps_long` (длинная, incline_db_curl, lengthened+stretch) / `biceps_short` (короткая, preacher/spider, peak) / `brachialis` (плечевая, hammer_curl, neutral).
- `triceps`: `triceps_long` (длинная, overhead: tricep_push/overhead_ext, lengthened) / `triceps_lateral_medial` (латеральная+медиальная, pushdown/rope, peak).
- `calves`: `calves_gastro` (икроножная, standing calf_raise, straight knee) / `calves_soleus` (камбаловидная, seated calf_raise, bent knee).
- `traps/forearms/abs`: без деления (одна подгруппа = мышца), но с паттерном и пояснением; входят как secondary/ignore-бюджет, но показываются.

**Источник пояснений (единый, без дублей):**
- `exercise-biomechanics-db` + `target-muscle-db` → `buildExerciseInstructions` (`pattern RU`, `cues`, `stretch/peak/MMC`, `tempo/rest`, `mistakes`, `progression`, `level`-адаптация).
- `EXERCISE_CATALOG` → `targetMuscle`, `technique`, `comments`, `movementPattern`, `stretchPhase/peakContraction`.
- Новый агрегатор `muscleSubgroupExplanation(muscle, subId, patterns, exercises)`: берёт `targetMuscle` + `bio` топ-упражнения подгруппы, формирует строку «Чем хорошо: … Как работает: … Ключ: …» (хват/угол/пауза/амплитуда). Используется в сводке, тултипе упражнения и PDF.

**Реализация (engine):**
- Расширить `BBExpandedSummary.BBMuscleSummary` (`bb-summary.engine.ts:16-27`): `subGroups` — для ВСЕХ мышц (не только back), `patternsRu` и `explanations: Record<subId, { pattern: string; sets: number; why: string; how: string }>`; завести `SUBGROUP_MAP: Record<canonical, SubgroupDef[]>` (подмышцы + ожидаемые `movementPattern` + `isCompound`).
- При построении `buildBBExpandedSummary`: `sub = resolveSubgroup(ex.muscle, ex.movementPattern, ex.backSubgroup/armSubgroup, ex.targetMuscle)` → `byMuscle[canonical].subGroups[subId].byPattern/byExercise/sets` + `explanations[subId] = buildSubgroupExplanation(...)` (кэшируется на первое упражнение подгруппы).
- `bb-report.engine.ts:115-126` рендерит `subGroups` для каждой мышцы (сейчас только back) + строки пояснений; `buildBBPlanReportText` добавляет блок «Подмышцы/паттерны/пояснения» на каждую мышцу.
- `bb-labels.ts`: расширить `targetLabelFor`/`exerciseTargetNote` — пробрасывать `subGroupId` и `explanation` в `comment`/`executionProfile` (совместимо с существующим `backSubgroupLabel`/`armHeadLabel`).

**UI (BbAutoConstructor.tsx):**
- Карточка «📋 Недельная сводка» (`3078`): под каждой мышцей — сворачиваемый блок подмышц: `subId RU — N сетов · паттерн RU — упражнения — пояснение` (иконка ⓘ с тултипом «Чем хорошо / Как работает»). Сохраняет `bySession (рабочие/разминочные)`, добавляет `bySubgroup`.
- Детальная карточка упражнения (`BBExercise.executionProfile`): чип подмышцы (`📐 верх груди / широчайшая / длинная головка`) + паттерн (`🧠 incline_push`) + explanation в title/expand.
- PDF/CSV (`3390-3450`): колонки `Подмышца | Паттерн | Упражнения | Сеты | Пояснение`.
- Сохранение `BBPlan.expandedSummary` — единый источник для сводки/отчёта/экспорта (не пересчитывать в рендере).

**Инварианты:**
- Каждая мышца с `workingSets > 0` имеет ≥1 подгруппу с ≥1 паттерном; `subGroups` покрывают 100% `directSets` мышцы.
- Паттерны подгруппы — подмножество `movementPattern` каталога (валидация: неизвестный паттерн → warning, не silent).
- Пояснения — из `exercise-lab/catalog` (source `'exercise-lab'|'catalog'`), generic-фолбэк только если нет `bio/target` — помечается «generic» и не считается покрытием.

### 21.3 Консолидация отчётов качества — один источник правды, без дублей и расхождений

**Цель:** один `BBQualityReport` (или расширение `BBPlanReport` с жёстким контрактом), который заменяет 6 дублей и гарантирует консистентность `weeklyVolume ↔ expandedSummary ↔ balance ↔ validation ↔ safetyScore`.

**Контракт:**
- `weeklyVolume` (`bb-volume.aggregateBBVolume`) — **единственный** подсчёт `direct/effective/fatigueWeighted` по неделям. `expandedSummary.byMuscle.directSets` и `balanceReport.byMuscle.*` не пересчитывают объём, а агрегируют из `weeklyVolume` (или из `expandedSummary`, который сам построен из `weeklyVolume`). Запрет на второй независимый подсчёт сетов в `bb-balance`/`bb-safety-score`.
- `mrvByMuscle` + `volumeLandmarks` — единственный кап; `validation` и `safetyScore.volumeCompliance` используют одну функцию `checkMrvOverflow(muscle, effectiveSets, mrvByMuscle/landmarks, tolerance)` с единым допуском `×1.15` (см. `bb-validator:192`). Дублирующий `×1.1` в `safetyScore` удаляется.
- `balance` — только геометрия паттернов (press/pull/raise, lengthened/mid/shortened, coverage byMuscle), не дублирует объём; `issues` баланса — только про дисбаланс паттернов, объёмные issues — из `validation`.
- `rotation`/`fatigue` остаются отдельными тех-репортами, но их `issues` не дублируются в `safetyScore.issues` — `safetyScore` агрегирует `validation.issues + balance.issues` без пересчёта `analyzeBBBalance`.
- `BBPlanReport` расширяется полями `quality: { expandedSummary, balance, fatigue, rotation, validation, safetyScore }` или вводится `BBQualityReport`; `buildBBPlanReport(plan)` — единственная точка сборки отчёта (все UI/экспорт/валидация читают `plan.report.quality`, не вызывают `analyzeBBBalance`/`calculatePlanSafetyScore` повторно).

**Рефактор по файлам:**
- `bb-summary.engine.ts`: сделать `buildBBExpandedSummary(plan, weeklyVolume?)` — принимать готовый `weeklyVolume`; убрать второй подсчёт `directSets` через `exerciseVolumeContributions` в отчёте качества (оставить для `buildSession`, но не для сводки).
- `bb-balance.engine.ts:33-82`: принимать `weeklyVolume`/`expandedSummary` на вход, считать только `patterns/positions/issues` по `derivePattern` + `catalog.type/movementPattern`, не суммировать `sets` заново; удалить `report.press/pull` дубли объёма (или считать как `sum(weeklyVolume[upper])`).
- `bb-validator.engine.ts`: вынести `mrvOverflowTolerance = 1.15` в константу `BB_MRV_TOLERANCE`, использовать и в `bb-safety-score.engine.ts`.
- `bb-safety-score.engine.ts:45-202`: не вызывать `analyzeBBBalance(plan)` внутри — принимать `balanceReport`; не вызывать `analyzePlanStress` дважды — принимать `stressAnalysis`; `factors.volumeCompliance` считать вызовом `validation.effective_mrv_overflow` (не своей копией); убрать `acwr||1.0` маскировку (уже исправлено на `hasAcwr`).
- `bb-finalize.engine.ts:2485/2634/2771`: порядок — `weeklyVolume → expandedSummary → balance → validation → safetyScore → report` (каждый следующий принимает предыдущий, не пересчитывает).
- `BbAutoConstructor.tsx:1123/3078/3134/3159/3239/3718`: заменить 6 карточек на 2: «📋 Сводка по мышцам (подмышцы/паттерны/пояснения)» + «🛡 Качество плана (единый репорт: баланс/усталость/ротация/валидация/safetyScore)» с секциями; убрать повторный `analyzeBBBalance` в UI.

**Валидация / тесты:**
- Инвариант-тест: `expandedSummary.totalWorkingSets === sum(weeklyVolume.directSets)` и `sum(balance.press+pull+raise)` не используется как объём — баланс только про ratio/coverage; `validation.effective_mrv_overflow` и `safetyScore.factors.volumeCompliance` дают одинаковый `violations` на одном плане (снапшот 5 профилей × 25 сплитов × 2 режима).
- Golden-тест отчётов: `buildBBPlanReport(plan).peakDirectSets === expandedSummary.totalWorkingSets` (peak-неделя) и `report.balance.pullPressRatio` не расходится с `balanceReport.pullPressRatio` (один объект).
- Regression: `bb-report.test.ts:9`, `bb-balance.test.ts:7`, `bb-warning-report.test.ts:6/12` — обновить снапшоты после консолидации (ожидается снижение issues-дублей: было 3-4 повтора «нет растянутой позиции», станет 1).

**Документация:**
- Обновить `docs/BB-AUTO-GENERATION-MAX-PLAN.md` Этап 9-11: «Metrics и UI» — единый `BBQualityReport`; отметить `weeklyVolume` как источник.
- AGENTS.md — добавить статус этапа 21 в список (не дублировать в вехе 20).

### 21.4 Связь с существующим планом

- П.9 «Пояснения к упражнениям» расширяется подмышцами/паттернами/пояснениями (этот раздел — детализация п.9).
- П.13 «Локализация + отчёт + сводка» — сводка становится источником для отчёта (контракт выше).
- П.16 «Убрать стэкинг / дед-код» — `SUBGROUP_MAP` не вводит новый стэкинг, только распределение уже рассчитанного `targetSets` по подмышцам.
- Веха 20 (статус) остаётся «готово по 1-19», новый этап 21 — следующий, с отдельными тестами и приёмкой.


