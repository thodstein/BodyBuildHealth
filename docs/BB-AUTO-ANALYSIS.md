# BB-AUTO — Финальный анализ и план доработок (раздел 18)

Итог полной реализации плана `docs/BB-AUTO-QUALITY-PLAN.md`. Анализ того, что реально
применяется при генерации, и план дальнейших доработок.

## 1. Что реально применяется при генерации (проверено тестами)

**Объём/режим/восстановление:**
- `computeRegimeMrvMult` — натурал ×1.0 / курс ×2.0 на главные мышцы (одно применение).
- `regimeMrvMultFor` — трапеция/игнор-мышцы не ×2.
- `computeBBRecoveryScore` → `computeBBWeeklyBudget` (недельный кап восстановления).
- `sessionLimitsFor` — централизованные по-сессионные капы (24/40/60, 10/14/18) во всех путях.
- Убран стэкинг `backProfile/legProfile/torsoProfile` (×2.2/1.8/1.6) + PED из целевого объёма.

**День-структура:**
- Ноги всегда тяжёлые (`FORCE_HEAVY_GROUPS` += quads/hamstrings/glutes).
- День-гард малых мышц (шраги/предплечья не в Push/Chest); stale-комментарии пересобираются.
- `setCap` спины 10→5 сетов/упр; prep-кривая монотонно нисходит к таперу.

**Фичи:**
- `optional`-флаг («при наличии сил») + слабые группы +1 упр без капа (post-finalize, skip focus).
- Кнопки: осевая / меньше многосуставных / силовые лифты (все пути) / вариативность / интенсивность.
- Схемы объёма (GVT/FST-7/8×8), суперсеты, DUP, дропы — применяются и помечаются.
- Локализация (`SESSION_TAG_RU`, `muscleLabel`, `targetLabelFor`).
- Расширенная сводка + адаптированный отчёт.

## 2. Все пути/циклы

Применяется ко ВСЕМУ ББ-авто (generic, cycle→plan, program→plan, prep, contest, годовой план),
кроме faithful (готовые программы «как есть»). Лимиты и кнопки работают на всех путях.

## 3. План доработок / улучшений

**Качество (приоритет):**
1. **Глубина prep**: дроп-техники/суперсеты назначать ПОСЛЕ prep-оверлеев (сейчас назначаются до
   и могут остаться stale на урезанных подходах); failure-протоколы убирать только в пик-неделю.
2. **`selectDiverseExercises` / `computeLoading`**: канонические reference-слои (документировано);
   при следующем крупном рефакторе `buildSession` — перевести на них (снятие inline-дубля).
3. **Каталог**: добавить недостающие конкретные упражнения (тяга широким хватом, вариации наклонного
   жима), чтобы «общий стиль» не заменял специфичные движения.
4. **На каждую мышцу — подмышца + паттерн + пояснения** (`docs/BB-AUTO-QUALITY-PLAN.md:21.2`): расширить `bb-summary.subGroups` на все мышцы (сейчас только back), каноническая таксономия `SUBGROUP_MAP` (chest: upper/mid/lower/stretch, back: width/thickness/upper_back/rear_delts/traps/erectors, shoulders: front/mid/rear, quads: rectus/vastus, hamstrings: hip/knee, glutes: max/med, biceps: long/short/brachialis, triceps: long/lateral_medial, calves: gastro/soleus), единый агрегатор `muscleSubgroupExplanation` из `exercise-biomechanics-db + TARGET_MUSCLE_DB + EXERCISE_CATALOG.targetMuscle` («Чем хорошо: … Как работает: … Ключ: хват/угол/пауза»), рендер в сводке/тултипе/PDF (подмышцы/паттерны/пояснения на каждую мышцу, 100% покрытие directSets, инвариант-тесты).
5. **Консолидация отчётов качества — убрать дубли и расхождения** (`docs/BB-AUTO-QUALITY-PLAN.md:21.3`): 6 дублей (`expandedSummary`/`balanceReport`/`fatigueReport`/`rotationReport`/`validation`/`safetyScore`/`report`) → один `BBQualityReport` с контрактом: `weeklyVolume` — единственный подсчёт direct/effective, `mrvByMuscle` — единственный кап (толеранс `×1.15` в константе `BB_MRV_TOLERANCE`), `balance` — только геометрия паттернов (не объём), `safetyScore` принимает `balance/validation` без пересчёта `analyzeBBBalance`, порядок в `bb-finalize: weeklyVolume → expandedSummary → balance → validation → safetyScore → report`, UI — 2 карточки вместо 6, golden-тесты на консистентность.

**UI-полировка:**
6. Полный рендер целевых капов (MEV/MAV/MRV ×режим) в карточке muscle volume уже сделан; показать
   и недельный бюджет восстановления.
7. Бейджи фич (FST-7/GVT/дроп/optional/паттерн) в PDF/CSV-экспорте — дополнить колонками `Подмышца | Паттерн | Пояснение`.

**Архитектура:**
8. Разбить `bb-builder.engine.ts` (3600+ строк): selection/loading/volume уже извлечены в слои;
   следующий шаг — вынести budget-fitting из buildSession.

## 4. Итог

Вся движковая логика ББ-авто по плану реализована, стабильна (bb-область 1360 зелёных,
полный прогон 6844/6845 — 1 падение в чужом `bb-macrocycle.test.ts` v7), tsc 0 по своим файлам.
Все коммиты запушены. Чужие WIP не тронуты.
