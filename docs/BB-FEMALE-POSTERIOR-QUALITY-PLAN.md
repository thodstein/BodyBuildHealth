# BB-auto: полный аудит итоговых программ + женская задняя цепь (план)

Дата: Sep 09 2026. Статус: аудит завершён, правки НЕ начаты (ждём согласия).
Метод: полный прогон bb-тестов + дампы 10 реальных планов (male/female × сплиты × цели × уровни) + построчная трассировка аллокации + сверка с первоисточниками (Kassiano 2024 IJSC, Plotkin 2023 MRI, NSCA Hodge 2024, Schoenfeld 2016).

Базовое состояние: **bb 2400/2401** (1 падение — предсуществующее `bb-macrocycle` v7, чужой WIP), все дамплы `valid=true, errors=[]` — то есть **валидатор пропускает все проблемы ниже**.

---

## A. Критические находки — `female_glute_5` (главный женский сплит)

Дамп: `buildBBPlan({patternId:'female_glute_5', sex:'female', focusGroup:'glutes', level:'intermediate', goal:'mass', weeks:12})`.

### A1. НИ ОДНОГО barbell hip thrust за 12 недель (P0)
Тяж-день глут = `Ягодичный мост на полу 3s + B-stance мост 2s + Раскладушка 2s + Пожарный гидрант 2s`. Heavy hip thrust отсутствует во всех 12 неделях (в ppl-контроле — 8 вхождений).
Корни (доказано трассировкой):
- `exercise-catalog.ts:697-713` — name-дедуп **last-wins убивает compound**: канонический `hip_thrust` («Ягодичный мост со штангой», compound, :52) вытеснен изоляцией `glute_bridge_barbell` (:220); `hip_thrust_single` тоже съеден. Комментарий в коде обещает «оставить первую» — реализация оставляет последнюю.
- `bb-builder.engine.ts:637-657` — `PREFERRED_BB_EXERCISES` содержит **ноль глут-id** → ни одно глут-упражнение не получает BB-приоритет.
- `bb-exercise-selection.engine.ts:68-74` — `ANGLE_CLASSES.glutes` класс 0 `/ягодичн.*мост|hip.?thrust/` собирает ВСЕ мосты в один класс; берётся 1 упр/класс (offset 0 каждый week, `bb-builder:2224`) → побеждает `b_stance_hip_thrust` (strengthRank 1), floor-варианты математически не могут войти как рабочие.
- «Ягодичный мост на полу 3s» в начале каждой сессии — это **finalize warmup-активатор** (`bb-finalize:1922-1970`, первый матч каталога, unshift, RIR 4, исключён из объёма), а не выбор. Он же не проходит через pattern-cap (вставляется ПОСЛЕ него).
- `stretchPhase:true` у hip thrust (каталог) **никем не потребляется** — lengthened-логика отбора её не читает.

### A2. Реабилитационные упражнения как primary на тяж-дне (P0)
`clamshell` (`exercise-catalog.ts:326`, band, difficulty beginner, comment «Реабилитация») и `fire_hydrant` (:592) попадают в primary через **fallback-fill без tier/quality-гейта** (`bb-builder:2262-2272` — только usedIds/class-чек). Одновременно:
- MRV-проходы снимают «Отведение бедра» по **имени** (`isIsolationName`, `bb-finalize:3705` regex `/отведен/`), а clamshell/hydrant по имени не матчатся и выживают → отведение (глутус медиус, паттерн abduction по NSCA Hodge) = 1-2 сета за 12 недель, rehab-дрели — по 4 сета/сессию.
- Clamshell получает вес из общего глут-веса (45.5→23.7 кг) — per-exercise weight mod для глут отсутствует (`bb-builder:2589` — только shoulders).

### A3. Квадрицепс фактически не тренируется (P0)
`volumeTargets.quads = 8` (таргет!), факт **0 сетов в неделях 2-12** (только week 1 = 7 сетов).
- `TAG_MUSCLES.Glutes/GlutesHams` без quads (`bb-day-types.ts:62-63` — by design «без quads»), в сплите нет ни одного quads-слота.
- Leg-гарантии финализатора гейтятся на `/Legs|Lower|LowerPower|LowerHyp/` (`bb-finalize:694, 1323`) — теги Glutes не проходят, `ensureLegHeavyBlock`/`ensureGlutesBlock` (которые вставили бы настоящий hip thrust) не срабатывают.
- Единственные quads-сеты — случайный MEV-feeder через **неверный derivePattern**: `hack_squat_ham` («Гакк-присед на бицепс бедра») ре-деривится по имени как squat/quads (`movement-pattern.ts:52-56` — `/присед/` побеждает `/бедр|ham/`).
- `volumeTargets` пересобирается из **факта пика-недели** (`bb-finalize:3591-3603`) → мусорный таргет «quads:8» зеркалит одноразовый фидер.

### A4. Нулевая прогрессия веса (P0)
`Ягодичный мост на полу: w1 12×20кг RIR4 → w12 12×20кг RIR4` — вес не меняется 12 недель (это warmup-формула `0.25×workMax`, константа). Рабочие глут-упражнения: вес пересчитывается еженедельно от **статичного workMax** (`bb-builder:1907-1913`), RIR-дрифт только СНИЖАЕТ вес к финалу (B-stance/clamshell 45.5→23.7 кг — регрессия). `prescribeLoad` (double progression) живёт только на дневник-фидбек/previousPlan (`:4282`) — без дневника прогрессии нет вообще.

### A5. Нет ротации 12 недель (P1)
Все глут-упражнения forced `role:'primary'` (`isGlutePriority`, `bb-builder:1794`) → ротационная память (accessory-only, `:3416-3424`, «primary stable») мимо; class-offset фиксирован → идентичное меню каждую сессию всех 12 недель.

### A6. Верх-дисбаланс: грудь 16 vs спина 8 (P1)
Обе Upper-сессии push-доминантны (2 push-стека). Для женского physique (bikini/wellness) спина ≥ груди обязательна; validator молчит (back 8 ≥ 70% MEV=10 → 80%).

### A7. Тесты лгут о частоте (P1)
`bb-pro-quality-phase-d.test.ts:82-94` — тест назван «glutes ≥3 сессий/нед», ассерт `≥2`. Реальный план даёт ровно 2 (MRV-проход стирает глут-блок памп-дня, rank-last) — 3×/нед (Schoenfeld 2016) тихо деградировал.

---

## B. Планетарные баги движка (затрагивают не только женские планы)

- **B1 (P0). Weak-путь теряет фазовую разметку.** `compensateCrossDayWeakPoints` (bb-builder:4730) пересобирает недели как `{week, sessions}` — `phase`/`deload` теряются. Все планы с `weakPoints` (male и female) идут БЕЗ фаз (дамп: weeks 1-12 без `phase`), т.е. без volume/RIR-периодизации. Фикс — `{ ...w, week: w.week, sessions }`.
- **B2 (P1). Weak glutes+hams ppl: глуты пик 22 сета** при MRV 16×1.2(weak)×0.95(female)≈18.2 — подозрение на overflow; эффективные объёмы надо дампнуть по `weeklyVolume.effectiveSets`.
- **B3 (P1). Атрибуция**: «Приведение бедра в тренажёре/на блоке» помечается `hamstrings` (week 5 дампа) — это аддукторы, не бицепс бедра.
- **B4 (P1). Beginner female fullbody_3: грудь 18 сетов/нед** > beginner MRV 15 (female ×0.95 → 14.25) — `effective_mrv_overflow` не сработал (порог ×1.15 = 16.4 < 18).
- **B5 (P2). Валидатор не ловит `target_volume_deficit` при факте 0** (quads target 8 → факт 0) и `low_training_frequency` при 0×/нед.
- **B6 (P2). `stretchPhase` каталога мёртв** — lengthened-приоритет (сильнейший фактор гипертрофии 2022-2026) не участвует в отборе.

---

## C. Женская задняя цепь: наука vs выдача

| Элемент доказательной базы | Наша выдача | Вердикт |
|---|---|---|
| **Kassiano 2024** (33 женщины, УЗИ, 10 нед): leg press + SLDL + **barbell hip thrust** = +9.3% vs +6.0%; оба первых — «пик силы на длинной длине» | нет leg press, нет hip thrust, floor bridge 20кг | ❌ главный стек отсутствует |
| **Plotkin 2023** (MRI): присед/траст хамсы не растят; seated curl — топ | RDL 9-14/нед + seated/lying curls + nordic + hack_squat_ham | ✅ лучшая часть плана |
| **NSCA Hodge 2024**: 4 паттерна — thrust / squat / hinge / **abduction** | thrust деградировал в floor bridge, squat = 0, abduction ≈ 0 | ❌ 2 из 4 паттернов выпали |
| **Schoenfeld 2016**: 2×+/нед частота | заявлено 3×, фактически 2× (A7) | ⚠️ формально есть, фактически — половина |
| Объём 10-20 сетов/нед/мышцу | глуты 21-24 пика (spec ×1.3), хамсы 12-17 | ✅ диапазон ок (кроме B2-подозрения) |
| Лёгка/лутеальная модуляция объёма ×0.95, femaleAdjust MRV ×0.95 | реализовано (`bb-cycle.engine`, `bb-demographics`) | ✅ |

**Хамсы — сильная сторона**: композиция (seated curl — по Plotkin топ; RDL — длинная длина; nordic; обратное скандинавское; гакк-на-бицепс) соответствует науке. Проблема сосредоточена в глут-паттернах и quads.

---

## D. Циклы / интернет-источники (BB-направление)

- Каталог циклов: 105 LMS (ПЛ/ББ-фитнес) + **12 `cycle-bb-*`** (PHUL, Сушка/Рельеф и т.д.) + arm 19 + SS 15. **Женских циклов — НЕТ** (`female cycles: NONE`). Женщина-пользователь получает либо сплит-генерацию (с багами A1-A7), либо мужские шаблоны.
- Методики/движки (PED-фазировка, packing, spec-блоки, tradeoff, контест-prep) — из AGENTS-истории они покрыты тестами и в дамплах не деградировали; не трогаем.

---

## E. План работ (по приоритету, каждый пункт с тестом-мутацией)

> **Статус (Sep 10 2026):** P0 (пп. 1-8) выполнен полностью (коммиты `6f2d34b8` + `548c5ee9` + `dc7b90df`, bb 2117/2117). P1: п. 9 (валидатор-гейты: факт 0 → error для major-мышц, частота 0×/нед → error, с честными исключениями push/pull-сплитов без ножных дней и excludedMuscles; NEW `bb-validator-dead-muscle.test.ts` 5/5) и п. 10 (атрибуция аддукторов — закрыт ранее: derivePattern 'adduction' → trueMuscleOf null) — выполнены; п. 11 (female-матрица дампов) — pending; п. 12 — закрыт ранее (честное переписывание phase-D). P2: п. 13 (женские циклы-шаблоны) — pending; п. 14 (`stretchPhase` в lengthened-скоринг) — **ОТМЕНЁН с обоснованием**: каталог несёт 55 флагов (почти все канонические compound'ы) — полный +10 сдвигает selection-дрейф за калиброванные допуски (packing-инварианты), а тай-брейк по флагу переупорядочивает точные тайлы и пересчитывает zero-state объёмы (back 16→20 у natural). Name-regex в `lengthenedBonus` уже покрывает канонические lengthened-движения; флаг каталога остаётся данными для будущих потребителей (strict-groups уже матчит по id). Внедрение требует отдельной re-baseline кампании.

### P0 — выдача female_glute_5 (блокирует «грамотный инструмент»)
1. **Каталог**: дедуп keep-first для `hip_thrust`/`hip_thrust_single` (или исключить их из last-wins). Тест: `hip_thrust` присутствует, `type==='compound'`.
2. **Пул/скор**: `PREFERRED_BB_EXERCISES` += `hip_thrust`, `leg_press` (женский legs-контекст), `sldl`; fix fallback-fill (bb-builder:2262) — tier-гейт: на тяж-день primary запрещены `difficulty<=2`-band/bodyweight rehab-упражнения (clamshell/fire hydrant → только памп/warmup роль).
3. **Quads-гарантия**: расширить leg-гейт финализатора на теги `Glutes|GlutesHams` (leg press/разгибания ≥ MEV×0.7 для female-сплитов с Glutes-тегами); fix `derivePattern` (`гакк.*бицепс` раньше `/присед/`); перестать переписывать `volumeTargets` фактом пика (или подписывать «факт», не «target»).
4. **Тяж-день глут**: canonical stack = barbell hip thrust (тяж) + B-stance/leg press (второй angle) + machine abductor (abduction-паттерн 2-4 сета/нед, снять его из name-regex-чистки — использовать каталог `type` вместо `isIsolationName`).
5. **Прогрессия**: глут-primary в prescribeLoad-путь (double progression по workMax), warmup-активатор — гейт «не дублировать паттерн дня» + недельный ramp.
6. **Ротация**: `rotationMode='variety'` уважать для spec-primary (ротация классов/offset по неделям), lead-лифт стабилен.
7. **Upper-баланс FG5**: сессия 5 → Pull-доминанта (back ≥ chest weekly для female physique-профилей).
8. **B1-фикс фаз** (одна строка, bb-builder:4730) + тест «weak-план сохраняет phase/deload на всех неделях».

### P1 — валидатор + матрица
9. Валидатор: `target_volume_deficit` при факт 0 → error; `low_training_frequency` при 0×/нед; пересмотреть overflow-порог (beginner chest 18 — ловится?).
10. Атрибуция «Приведение бедра» → adductors (каталог + trueMuscleOf).
11. Female-матрица дампов: сплиты (female_glute_5/glute_focus_4/upper_lower_4/ppl_6) × уровни (beginner/intermediate/enhanced) × цели (mass/cut/recomp) × weak/focus — инварианты: hip-thrust presence, quads ≥ 0.7 MEV, hams ≥ MEV, back ≥ 0.8×chest (female), weight-прогрессия w1→wN, фазы везде.
12. Починить тест-ложь A7 (ассерт ≥3 или честный rename).

### P2 — контент
13. **Женские циклы-шаблоны** в каталог (по прецеденту SS/arm): `bb-f-glute-12` (специализация глут 12н), `bb-f-posterior-10` (задняя цепь: leg press+SLDL+thrust+abduction), `bb-f-bikini-prep-8`, `bb-f-beginner-6`, `bb-f-cut-8` — с понедельной раскладкой и мостовым применением в конструктор (как arm/ss-циклы).
14. `stretchPhase` каталога подключить в lengthened-скоринг отбора (прецедент уже есть в `lengthenedBonus`).

### Оценка
- P0 (пп. 1-8): ~6-8 правок в 6 файлах + 3 тест-файла. Риск: средний (касается selection-слоя — нужен полный bb-прогон после каждого шага; известная ловушка: полный minLevel-гейт уже душил отбор — двигаться точечно).
- P1: валидатор-пороги — аккуратно (26+ ассертов инвариантов живы).
- P2: контент циклов — механически по прецеденту.

### Не трогать
- Объёмную модель (MEV/MAV/MRV), капы, packing, PED-механику, контест-prep — целы и покрыты.
- Чужие WIP-зоны (nutrition diary UI, cycle-catalog мост, ManualLibraryGallery — в worktree чужие незакоммиченные правки).
