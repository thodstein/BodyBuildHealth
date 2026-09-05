# AGENTS.md - BioStackAIScreen + BB-builder

## ББ-авто: финал-5 закрыт — bb 2012/2012, ноль падений (Sep 06 2026, e08031a4 pathspec 4 файла, НЕ запушено)

Остаток run5 (5 падений) разобран дампами до первопричин, все починены без NEW-логики. Полный bb **2012/2012 (175 файлов)**, tsc 0 по своим (чужие nutrition `dayCarbUses`-ошибки не тронуты), manual-constructor 49/49.

- **PPL-бицепс 6→8 (cap-adjust reserve)**: резка шла smallest-first по всей неделе → 6+10; топ-ап не чинил (все accessories ровно на минимумах — донора нет; sibling-путь недостижим из-за `break`). Фикс: резка рук (biceps-Pull/triceps-Push, intermediate+, только PPL) сначала из сессий ВЫШЕ минимума 8 (8+8), остаток — старым путём (overflow-инварианты целы); остальные мышцы/пути — байт-в-байт.
- **Fullbody-частота (лимитер 10→12 + сеты 24→28)**: arm-guarantee добавлял руки (доказано DBG-логом, потом удалён), а финализатор отрезал: лимитер по капам + cap-adjust-removal. Капы FullBody подняты по PPL-прецеденту (36/11): 12 мышц × пол 2 = 24 — минимум присутствия, 25-й сет иначе невозможен без синглов. Валидатор частоту считает по `volumeTargets` (перестраиваются в finalize из факта!) — средний 1.75 → 2.
- **GVT-пятёрки vs руки (guarantee-skip + GVT-last)**: тройной стек (GVT-10 + guarantee + норма + indirect) вылетал за кап — cap-adjust сбривал пятёрки (taper w2/w3 добивал, w1 — единственная untapered). Фикс: (1) arm-guarantee скипается при активной volumeScheme (схема сама даёт рукам объём; PPL-минимумы держат топ-апы); (2) cap-adjust режет GVT-маркированных последними (без схем порядок sets-asc как раньше). Выжившая: спина 5 (w2); ovf-инвариант держится (порог ×1.15 = допуск GVT-гарда).
- **Пойманные ловушки**: removal-protection рук откачена (unmet-need каскадил в compound-синглы beginner-PPL: тяга 2→1); FB-скоуп той же защиты не понадобился (частота держится лимитером); armSets 3→2 для FB не хватило (маржа была глубже); `__DBG*`-логи и `_tmp_*` удалены (проверено grep).
- **Zero-baseline обновлены** (процедура из шапки файла: осознанная правка → ручной re-baseline): направления совпадают с требованиями (руки/икры/трапы ровно на PPL-минимумах ×2 сессии); generic-natural/cycle/library. Движок не тронут.
- **Остаток: ноль.** НЕ ПУШИТЬ (main уехал чужими коммитами).

Поверх PED-фазировки: полный прогон показал 52 падения (19 файлов) — чужие/доказанные (натуральные планы, PPL-минимумы, снапшоты-базлайны). Починено всё своё + блоки специализации. NEW-логики ноль — только гейты и симметрия проходов. Полный bb **2011/2016 (3 файла / 5 тестов остались — все предсуществующие run5: ppl-invariant бицепс 6>=8, focus-phase fullbody low_training_frequency, zero-state-snapshots ×3 stale-baseline; гейты для них provably-false)**, tsc 0 (6GB).

- **Remainder run1-5**: `donkey_calf_raise_v2` mapping, PPL-кап 36/11 (`bb-volume`), peak/taper time-bomb (`futureShowDate`), prep-cycle 6→7, TAG-гигиена, `rotationMode` в finalize, back-vertical ≤1, frequency-guard, `proteinPerKg` typo, `resolveExerciseCatalogEntry`, трицепс-тест 10-12→8-10.
- **Spec-разделение (3 failing → 0)**: supporting (MEV 8) догонял баланс/цель (14) из-за PPL-минимумов + floor 2 + финишеров. Фикс тройной, только при ЯВНОМ `specializationSchedule` (legacy/auto — байт-в-байт): (1) finisher-skip не-целям активных недель без tradeoff; (2) weekly-trim не-целей до scaled-rotation (пол 2, workSets режутся); (3) MEV-repair в finalize целится в `lm.mev`, а не план-таргет — флаг `specExplicitSchedule` в `BBFinalizeOptions` (цикл-путь его не передаёт → старый режим). Плюс убран мой же дубль-ключ `specialization: undefined` (last-wins, поведение то же).
- **Поймано своими тестами**: repair использовал `plan.volumeTargets` (12), а не MEV (8) → сессии <6/нед отрастали до 5 сетов (16 вместо 8); trim обязан уступать tradeoff-неделям (трансфер считается от построенного плана — иначе спина 23 вместо 25, ноги 7 вместо 8). Доказано дампами недель ( exercises + rationale).
- **Проверено**: spec-unified 29/29 + tradeoff 30/30 + guards/prep-cycle(48)/spec-methods/advanced-guards зелёные; чужие `.tmp-dbg3.txt`/`TA-PRO-PLAN.md`/untracked-планы не тронуты, НЕ ПУШИТЬ (main уехал чужими коммитами).
- **Остаток (next)**: ppl-бицепс треугольник минимумы↔капы (cap-adjust reserve + late top-up донор), focus fullbody-частота, zero-state baseline-обновление.

## APK-оформление: TOP-уровень волнами 1–14 (Sep 05 2026, 14 коммитов pathspec: 18a5741d→1016b629)

Доводка APK-слоя (Capacitor) до уровня флагманов (Strava/NTC/Strong): токены/kit/темы/навигация/hero/виджеты/уведомления/иконки/нативный хром. TG Mini App — строго 1-в-1 (все CSS под `html.app-native`, правки shared-TSX аддитивные за `isNativeApp()`-гейтом; guard-тест падает иначе). Hero-картинки не тронуты — только подача поверх.

- **В1 TOP-pack**: токены (type-scale/spacing/press/FAB/badge), навбар-компакт + `data-tab/aria` + бейдж-доты, FAB «＋»→дневник, темы dark/AMOLED/light (`he_apk_theme_v1`), Splash API/edge-to-edge, виджеты в токенах, App Shortcuts, 3 канала уведомлений. Тесты `apk-top-pack` 4/4 (CSS-изоляция всего слоя + hero-intact).
- **В2 остатки**: HeroImg (`picture`+WebP 6–15%, `display:contents` — селекторы/тесты целы) в 10 точках, `sync-hero-webp.mjs`, переключатель темы+5 акцентов в Профиле §4.4, живые бейджи (interactions), CSS-сплит native-чанков из TG-бандла (билд подтверждает).
- **В3**: инлайн-TSX на `var(--accent)` (NativeEmpty SVG через style, AppLock), Material You `DynamicColorPlugin.java` (system_accent* через getIdentifier, <12 → unavailable) + «🤖 Системный» с кэшем и luminance-контрастом.
- **В4–13**: тест §4.4, `cap sync` валиден (assets в gitignore — регенерит CI), var-изация всего слоя под dynamic-color (§59: lime/mint/sky/violet/amber), QS Tile воды +250, predictive back, first-run CTA Главной, FAB speed-dial (вода в очередь + тост), статус-bar/theme-color за темой, boot anti-flash (с чисткой override — поймано до бага), бейдж профиля (<50%), pull-to-refresh Главной (ref-зеркало stale-closure), wake lock сессии, backup-правила, per-app локали, TalkBack виджетов, офлайн-пилюля, monochrome-иконка + `ic_stat_icon_default` (бага пушей), TalkBack-виджеты.
- **В14**: `npm run verify:apk-design` (маркеры без vitest) + полная UI-регрессия 20 файлов/175 тестов.
- **Проверено**: `apk-top-pack` 22/22 + смежные, `tsc` 0 по своим (проект целиком чист — чужие WIP починены владельцами), `vite build` OK (native-CSS/dynamic-color отдельными чанками). Доки: `docs/NATIVE-APP.md` §12.
- **Процесс/урок**: только edit-инструмент, перечитывание перед edit, коммиты строго pathspec своих файлов; чужие arm/bb/TA-WIP не тронуты. **Пойман молчаливый откат HeroImg в worktree (параллельный паттерн) — переприменён + guard-тесты; урок: сверять маркеры перед коммитом, не только статус.**

## ББ-авто: PED-фазировка MGF/IGF1 + MountainDog/FST-7/Hyperemia + insulin-safety + кап-5 (Sep 05 2026, 03100162 pathspec, НЕ запушено — в main ~20 чужих APK/ARM-коммитов)

Выполнение интернет-плана (Goldspink/Hill 2003 MGF→IGF1 фазы, Matheny 2010, PeptIQ/PepAtlas чередование, Sarcev Hyperemia, Rambod FST-7, Meadows 4 фазы, Dante DC, PMC5723243, Piatkowski 2024). NEW `bb-ped-phasing.engine` (resolvePedPhase: MGF-only→proliferation, IGF1-only→differentiation, оба+≥8нед→блоки/иначе чётность + insulinSafetyCheck 10г/1IU/старт 3-5/соло-warning) + MOD rep-schemes (IGF1-памп→pump_15_20, MGF-путь байт-в-байт)/ped-methodology (pedPhase/pedPhaseByWeek/insulinSafety, both-гейт пометок по неделям, peri-WO одна на сессию)/session-order (mountain_dog/fst7/hyperemia + isStretchHolder)/builder (parseMethDose строк, totalWeeks)/finalize (финальный кламп ≤5 — чинит GVT-утечку arm-guarantee 7-8)/validator/cycle-to-plan/plans-store (SessionMethodology-тип)/BbAutoConstructor (3 опции порядка + фаза/safety-превью). NEW тесты phasing 12 + methodologies 7. **Починены 2 упавших в своём пути: ped-adaptation "1,5г"→1500мг (stale-expectation после g→мг), pro-methods GVT кап-5; затронутые 153/153 + UI 26/26 + tsc exit 0.** Полный bb 1960/2012 — 52 падения все чужие/доказанные (натуральные планы, ovf при over5=0, объёмы ВВЕРХ, exercise-count, catalog donkey_calf_raise_v2, снапшоты; мой дифф строго volume-non-increasing + дефолт-пути no-op; оба исходных падения воспроизведены ДО моих правок). Коммит строго pathspec 13 файлов; чужие WIP (arm/android/APK/docs) не тронуты, чекаутов/откатов нет, powershell только для git/vitest (файлы — только edit). НЕ ПУШИТЬ — в локальном main ~20 незапушенных APK/ARM-коммитов (уедут вместе).

## Арм-планировщик: TOP-уровень — 8 эпиков T1–T8 + встройка (Sep 05 2026, волны 1–14, 44 коммита pathspec, ЗАПУШЕНО 7524033d)

Анализ планировщика армрестлинг/армлифтинг (57 файлов, 73 упр. каталога) + интернет-синтез 2025–2026 (StrengthLog 8-week, Mithril cup/pron/rising, Ezreal side-system, GoldenGrip spiral-humerus, Grokipedia EMG, GripStrength CoC-периодизация, GodsOfGrip RT, WAF Rules 2025, Larratt longevity-50). NEW 13 движков `arm-{matchup,rfd,grip-rpe,implement-ladder,contest-sim,longevity,rehab,tendon-fuel,warmup,cns-guard,lr-split,table-iq,calendar}` + MOD builder (матчап-объём ×1.25 с MRV-клампом, RFD-метка intensification, L/R-строка)/types(TOP-поля)/pro-integration(11 линий)/index(баррель) + UI (TOP-карточка конструктора: матчап/лестница/RFD/sim/календарь/Grip-RPE; хаб: матчап + Table-IQ журнал + return-to-pull + bridge). **Волна-4: `arm-sim-apply` (sim в последнюю неделю, инвариант sets=workSets) + CNS-автоподсчёт дневника 2×RPE8 (rationale+summary) + `superSeriesYear` (WAF/EvW/SuperSeries) + Grip-RPE селекты. Волна-5: RFD-протокол 5×3 в плане (не метка) + Grip-RPE-объём/peak-RIR + Table-IQ в объём (фолы→side×0.8, срывы→rise×1.15) + sim пережил finalize (тест) + печать комментариев/заметок. **Волна-6: унилатеральная добивка слабой руки (zero-volume, объём 1-в-1) + кросс-мезо лестницы через inputSnapshot + TOP-passthrough/`buildArmYearBlocks` в годовых блоках. Волна-7: мост схваток хаб→план (handleBuild читает he_arm_table_iq), stages в countdown, `arm-table-inject` (containment при срывах≥40%, фолы — процедурой без лифта, гарды dup/cap/MRV/tendon) + CNS-поля в UI. **Волна-8: L/R реальные бонус-сеты пост-проходом (+1/+2 слабой, кламп MRV+cap, deload/taper/peak скип; пойман слепой мид-билд гард — матрица показала переполнение wrist_flexors) + ICS-комментарии. 673/673 arm (58 файлов), tsc 0 по своим; полный vitest 10326/10361 — все 35 падений чужие (bb/* + MesocycleProgressionCard). **Волна-9: sim абсолютные 50% базы (убит двойной тейпер с пиком/годом; маркер [arm-taper:sim]) + починка предсуществующего рассинхрона sets/workSets в 6 балансных добивках финализатора (поймано своим инвариант-тестом) + Grip-RPE исполнение (overcrush/negatives) в плане. 676/676. **Волна-10: Table-IQ тренд (даты + ▲/▼/►) + CNS-индикатор в хабе из sRPE + TOP-секции экспорта диагностики (матчап/Table-IQ/rehab, HTML+CSV+XSS). 685/685 arm (59 файлов), tsc 0 по своим.** Волна-11: кросс-мезо чекбокс в конструкторе (прошлый план → +2.5% и лестница) + заметки недель/сессий и TOP-бейджи в шаге плана; полный vitest 10368/10393 — все 25 падений чужие (13 файлов bb/* + MesocycleProgressionCard). 690/690 arm (59 файлов: волна-12 Grip-RPE авто-волна + спарринг-гейт новичкам). **Волна-13: автоподстановка веса/возраста из профиля + полный мост хаб→конструктор (профиль L/R/вес/RT + динамика→RFD) + masters-делоады каждые 3н (50+) + отдельные grip-протоколы overcrush/negatives (замена, объём цел). 698/698 arm (61 файл), tsc 0 по своим. Аудит веток: armwrestling/armlifting/hybrid — все 32/32 (уровни×цели×4/12нед) valid+invariant; каталог 73 (grip 29, table-chain 24).** Волна-14 (финал): fallback веса/возраста из профиля в момент сборки (стор может подгрузиться после mount) + граница masters 40/49 vs 50+ задокументирована в коде; свежий полный vitest 10385/10408 — все 23 падения чужие (11 файлов bb/* + MesocycleProgressionCard). 697/697 arm (60 файлов: временный zz-debug удалён, счёт честный), tsc 0 по своим.** Чужие файлы не тронуты, чекаутов нет, коммиты строго pathspec. Волны 1–4 запушены c435c1f8a вместе с чужими APK (по решению пользователя); волна-5 пока локально.

## Стронг-хаб: диагностика PRO — паритет ТА/ББ (Sep 05 2026, 6f9b679a + cd53c983 + 9104dd32 + d96f5dab + 6022e4ab + финал carry-path/female/live/full-run)

Доводка `StrongmanDiagnosticsHub` до PRO-уровня (бенчмарки: ТА-хаб 1382с/20 движков, ББ-хаб 1482с/7 табов, ПЛ-9 лифтов; источники: Hindle yoke/stone 2021, Winwood log/injuries 2014-15, Renals 2018, Legg 2019, McGill 2009, SBS grip 2024, Jamieson). NEW 21 движок `strength-sport-sm-*` (weak-cause/rank/simulator/spec-block/plan-audit/progress/anthro/asymmetry/hold/attempts-bridge/ics/annual-bridge/lvp-calibration/grip-calibration/safety/pose-check/conditioning/storage/**carry-path**) + MOD biomechanics(logDip)/diary(LVP-e1RM)/injection(snapshot+rollback)/export(PRO-секции)/**pose-check(female-нормы Hindle sex×interval)** + хаб (физика йока/момент камня, симулятор контеста, попытки 85/92/98, LVP-ramp, hold-тесты, anthro, прогресс, ICS/Год, OHS-история, бэкап, pose-углы + **2D-тип траектории из Kinovea + live-check MediaPipe + пол**, кондиция → payload конструктора). **SM-область 622/622 (44 файла) + TrainingScreen_parts/rest-hooks 686/688 + полный vitest 10153/10215: все 62 падения чужие (22×bb-рефактор BB-агента, MesocycleProgressionCard PL, ta-plan-audit — чужой незакоммиченный WIP 3 строки; пересечений с моими файлами ноль, доказано git-diff), tsc 0 по своим файлам.** Осознанные остатки: scoring-unify отклонён (`scoreBase` мёртв, у TA/SM разные семантики/verification), registry/conditioning-day в shared-builder — зона владельцев.

## Метаболик-хаб: PRO v4 — Adaptive v3 + MET-60 + CAT2 + Sweat V2 + DIAAS + AT-range (Sep 04 2026, 357c0cd2 + f661cf77 + 5363463b TS2741-fix + v4-3 дедуп + v4-4 график/приёмы)

Полная PRO-доработка хаба калькуляторов метаболики в питании по бенчмарку 2026 (MacroFactor rolling-28д, IOC REDs CAT2 2023, ACSM/Periard, Maughan BHI, Calorique DLW). Файлы: NEW `src/core/activity-catalog.ts`, `src/core/metabolic-constants.ts`, `src/engines/metabolic-hub.engine.ts`, `src/ui/screens/Shared/MetabolicHub.tsx`, `__tests__/metabolic-hub.test.ts`, `docs/METABOLIC-HUB-PRO.md`. **121/121 тестов хаба + nutrition-v2-audit 4/4 + rest-hooks-native 60/60 + потребители 138/138, tsc 0 по своим файлам** (NODE_OPTIONS=6GB; чужой `meal-plan-engine.ts` починен владельцем).

- **Adaptive v3** (`calcAdaptiveTDEEv3`): rolling-28д + EMA 0.25 против воды, best R² из 7/14/21/28, гейт плотности MacroFactor (≥10 логов + ≥10 взвешиваний, иначе high→medium), DLW-range ±12%, targets mildCut−250/cut−500/bulk+300, EMA-серия.
- **MET-60 + PALpro**: 60 активностей Ainsworth, профессии 1.40/1.55/1.75, `computePalFromActivity` — единая точка (дедуп трёх PAL-функций); парсер v2 RU+EN, км (бег/10, вело/22), `2×`.
- **BMR-гарды**: Boer-LBM, adjusted-weight при BMI≥35, беременность IOM (+340/+452/лактация +500 — к TDEE), бариатрия −12%, гипо −12%, этнос −5%.
- **CAT2**: LEAM-Q (М) + EDE-Q + severity primary×2/secondary (green/yellow/orange/red) + return-to-play; скрининг, не диагноз.
- **Sweat V2**: измеренный + оценка ACSM ±30% + акклиматизация (Na −40%) + BHI Maughan; **MetS-добивка**: TG/HDL, LAP, VAI, FMI, алко-хроника WHO 14 units.
- **Белок DIAAS** (12 источников FAO, ceiling 0.60 после 60л); **NEATpro** (профессия) + **AT диапазоном 5–15%** + персист Biggest Loser + reverse-auto по trend; **Goal V2** (Helms caps + diet-break); One-answer PRO + ⇄ diff сценариев.
- **v4-3 дедуп**: UI показывает одно поколение (v1-панели удалены, движок v1 оставлен для совместимости — включая таб NEAT→neatPro); PAL-паритет ±0.01; DIAAS ×1.0–1.3 в целях белка; вода +300/+700 (беременность/лактация); гипо-чекбокс и T3 в CAT2; персист опросников. ВНИМАНИЕ: правки движка/тестов v4-4 попали в HEAD через чужой коммит d96f5dab1 (`git add -A`) — код цел, файл мной повторно не коммитится.
- **v4-4 график/приёмы**: SVG-график «Динамика 28д» (вес+EMA+intake-бары+TDEE) в табе Поиск, intake-серия 28д wired в движок (date-join+фильтр мусора); кнопки 3/4/5/6 приёмов белка рабочие (`proteinMeals`+персист).
- **Процесс**: только edit-инструмент, перечитывание перед каждым edit, коммиты строго pathspec своих 6 файлов; чужие `meal-plan-engine/TA-PRO-PLAN` не тронуты, откатов/чекаутов нет.

## Планировщик питания: распределение КБЖУ по приёмам + большие КБЖУ + рецепты в порциях (Sep 3 2026, 2558cfe0)

Полная настройка готовой выдачи рациона: правильное бодибилдерское распределение КБЖУ по приёмам, разумные порции, работа на больших значениях (110 кг / 800 г углей / 5100+ ккал) в ОБОИХ режимах генерации. Файлы: `meal-plan-engine.ts`, `planner-recipe-mode.ts`, `day-target-corrector.ts`, `MealListRender.tsx` (+тесты). **641/641 тестов планировщика (54 файла), tsc 0**.

- **Стража пери-бюджетов** (самый последний проход buildDayPlan, после корректора): prew ≤60 г углей / postw ≤75 / intra ≤60 — раньше десяток коррекций (баланс ×1.5, fixM, preciseAdjust, посадка, клампы) перетасовывали физиологические окна («предтрен 118 г лапши при капе 60»). Срезанный остаток добирается основными приёмами (капы порций уважаются, жир-комната ×1.08).
- **Гейты коррекций**: fixM/preciseAdjust/жир- и kcal-догоны/межприёмный баланс масштабируют ТОЛЬКО гибкие приёмы (основные+перекусы) — peri-окна и pre-sleep имеют фиксированные бюджеты; пос-добив — только в полноценные приёмы (шейк ≠ тарелка).
- **Pre-sleep чистый**: «Рожь (цельное зерно)» больше не «мелатониновый фрукт» (grain_rye_berries ловился подстрокой 'berries' — strict-гейт категории veg_fruit); Mg-семечки 10 г и ягоды 50 г — точные граммы БЕЗ снап-вверх (ореховая сетка [25,50…] поднимала 10→25 г = 12 г жира на ночь).
- **Дисциплина целей приёмов**: перекусы — белковый слот (посадка не наливает «батат 120 г в полдник с целью 14 г углей»); макро-капы дня после корректора (fiber ≤ 14 г/1000 ккал — раньше добив углей уводил клетчатку до 120 г; жир ≤ goal×1.12 — «жирные носители» типа рисовых отрубей (20.9 г жира/100) в триме; У ≤ goal×1.10).
- **Белок день = цель**: двунаправленная компенсация (недобор мерджем в крупнейший белок ≤300 г, перебор резкой до 60/50 г — пол 80 г блокировал сходимость «все белки ровно по 80»); цель — input.goalProteinG (НЕ normalizeMacroTargets, который «разгоняет» макросы под ккал-цель: У 500→674 давал перебор +20%).
- **Честные ноты**: «перегрузка приёма» только при реальном недоборе углей (был warning при переборе +39 г).
- **Порошковая сетка** [20,25,30,40,50,60,75,90] — скуп 20-25 г вместо раздутых 30 (перекусный шейк).
- **Рецепты В ПОРЦИЯХ (×0.5/×1/×1.5/×2/×2.5/×3)** — исходный рецепт = 1 порция: непрерывный масштаб (×1.37) квантуется в человеческий ряд, граммовки = авторская пропорция × порции, `portionScale` в recipeAppliedData, UI-бейдж «🍳 ×1.5 порции», rationale «Рецепт — ×1.5 порции». scaleRecipeToTarget (ручной пикер) — тот же ряд.
- **Пустых приёмов нет**: fallback «лучший по дистанции» ставится ДО carb-гейта (порционный ряд выводил rawCarbs из ±коридора → d4-d6 недели вообще без рецептов); «оживление пустых перекусов» после рецептурного ребаланса (белок + фрукт + крупяной топ-ап в комнате ккал).
- **Рецептурный корректор** не добивает peri-окна (мёд 69 г в предтрен — баг) и pre-sleep (булгур на ночь — баг): карб-топ-ап идёт в основные, fallback-флекс исключает presleep/prew/postw.
- **Большие КБЖУ 110 кг / 800 г У**: продукты Б233/Ж114/У787 = 5107 ккал (цель 220/110/800), рецепты Б225/Ж111/У798 = 5086 (dev 2%); перекусы несут угли (крупяной топ-ап в комнате), обед крупой вместо «тортилья 374 г»-перекоса.
- **Процесс**: только edit-инструмент (кодировка), region перечитан перед каждым edit, commit pathspec (чужие strength-sport/pro/lms/docs-файлы не тронуты); диагностика dump-тестами через `__tests__/_tmp_*.test.ts` с удалением до коммита.

## Планировщик питания: дедуп настроек IndividualPlanSettings — 13 пунктов аудита (Sep 3 2026, pushed b6db69239)

Чистка избыточных/дублирующих настроек по таблице аудита (пол, цель, исключения, variety, веган, morning/evening, завтрак, carbCap, manual-скрытия, Contest Prep, v2-фарма, specificity, электролиты). Один файл: `IndividualPlanSettings.tsx` (+268/−195); **637/637 тестов планировщика зелёные (54 файла), tsc 0**.

- **P1/P2/P12 — уже были сведены**: «Основные данные»-карточки нет (Пол — только в «Пользователь» + minimal), карточка «Цель» одна (вторая давно называется «КБЖУ»), specificity удалена (d792e2fb).
- **P3 — одна карточка «🚫 Исключения»**: аллергены + исключённые продукты (чипы+модалка) + dietPrefs + 🧪 непереносимости + 🚫 нелюбимые категории. «Подбор продуктов» → «🏭 Вкусовой профиль и адаптация» (остались компенсация по дневнику + вкусовые слайдеры); «Предпочтения и исключения» → «🍎 Предпочтения» (любимые + завтрак + заметки).
- **P4 — variety свёден**: `variety/setVariety` убраны из Settings-destructure; в «Разнообразие» добавлен второй легитимный регулятор 🔒 strictness (soft/strict) рядом с level.
- **P5 — веган один источник**: чип «Вегетарианское» убран из dietPrefs; `applyPlanType()` синхронизирует dietPrefs↔planType (+ legacy-эффект дозаполняет флаг при сохранённом planType='vegetarian'); пресеты «Мясной/Рыбный/Веган» через applyPlanType.
- **P6 — morningTrainLoad ↔ eveningLowCarb**: взаимоисключение — включение одного АВТО-выключает другое + flash-тост (локальный inline-тост `toastMsg` рендерится, window.showToast дублирует).
- **P7 — завтрак один пресет**: «🍳 Завтрак — пресет» (9 опций: Авто / 4 «свободных» основы / 4 шаблона) атомарно выставляет breakfastStyle+breakfastTemplate+addMilkToBreakfast (`BREAKFAST_PRESETS`-карта; движок не тронут — читает все три поля).
- **P8 — carbCap ↔ периодизация**: подсказка в «⚡ Периодизация» при carbCapClipped (потолок г/кг режет волну режима).
- **P9 — manual-КБЖУ**: «Уровень бюджета» и «Белок · пресет» скрыты при kbjuMode='manual' (+ пояснение в manual-блоке).
- **P10 — Contest Prep собран**: «Тапер ББ» → «🏁 Contest Prep · тапер ББ» (+видимость при sex=female); bbCategory (обе секции) и lifeStage (female) переехали из «Пользователь»; peakWeek* давно производные bbPrepConfig.
- **P11 — один ввод курса**: фарм-флаги V2 (8 чипов) перенесены из «🧬 v2 Скоринг» в «Фаза и препараты» (инъекции курса выше учитываются автоматически); в v2 — указатель.
- **P13 — «💧 Электролиты» удалена** (читалка v2Labs; дневные натрий/калий/магний приходят из Профиля).
- **Процесс (урок учтён)**: только edit-инструмент для контента (никаких PowerShell-перезаписей — кодировка), перечитывание региона перед каждым edit, commit строго pathspec (чужие staged strength-sport/pro/lms-файлы и незакоммиченные SRCBBScreen/PLToolsCard не тронуты); push через origin (мой коммит ушёл в составе чужого push — b6db69239 в origin/main).

## Планировщик питания: «профессиональный диетолог» — 9 эпиков + финальные хвосты (Aug 31 2026)

Полное выполнение плана `docs/NUTRITION-PROFESSIONAL-PLAN.md` (заменил 3 старых плана; удалены: NUTRITION-PLANNER-QUALITY-PLAN, NUTRITION-V2-ROADMAP, NUTRITION-PLANNER-OVERHAUL-PLAN).
Коммиты: c35b339d+376492b6 (эп.1), 51004960 (2), 1ef718d5 (3), 1f795220 (4), b34941f4 (5), cfe9c3da (6), 77f9855c (7), 6032f54e (8), cf285d46 (9), 9a8cbf0b (хвосты) + финальный (хвосты-2).
Область IndividualPlan: **641+ тестов зелёные** (49+ файлов), tsc 0 по проекту; полный прогон: 90 падений — пред-существующие (доказано worktree-прогоном на базе 35d5b6a63: наборы файлов/тестов идентичны).

- **Эп.1**: 4 механизма периодизации (cyclingMode/dietPauseMode/periodizationEnabled/carbPeriodization) → один `carbPeriodization` (8 режимов) + NEW `planner-carb-periodization.ts` (`applyCarbPeriodizationMods`/`carbPeriodizationLabel`/`isHeavyDayForOffset`). legacy-поля удалены из state/ctx/генерации/UI.
- **Эп.2**: цель vs фаза — PHASES = 4 фарма-фазы (дубли-цели удалены), PHASE_MULT (kcalMod/pAdd) удалён (направление ккал задаёт goal), ААС-белок не дублируется, конфликт mass+ПКТ → warning в breakdown; autoGoal из профиля, не из фазы.
- **Эп.3**: nutrLevel (ложный множитель) удалён полностью; budget 3 уровня (enhanced→max миграция); planType-стили РЕАЛЬНЫЕ: keto (У ≤6% ккал/≤60 г, жиры остаток, кап 3 г/кг, честный fallback + кнопка переключения на highcarb), highcarb (жиры 0.8 г/кг, угли до потолка), mediterranean — вкусовой пул (рыба/оливки/овощи в preferIds).
- **Эп.4**: V2 в генерации — отчёт «Качество» на bb_quality_score (avgScore=bbsAvg), NEW `planner-micro-pools.ts` (микро-контур: дефициты дня N → prefer-источники N+1; DIAAS-контур междневной + **внутридневной ремонт** `repairDiaasWeakLinks` — комплиментарный белок в приёме с растительным протеином); единый dayScore в отчёте.
- **Эп.5**: скользящая компенсация — `computeRollingCompensation(target, daysBack, refDateISO)`; день N компенсирует факт N−1 (per-offset в buildOneDay по _prepDate).
- **Эп.6**: heavyTrainDay ожил (+25% У/+5% ккал, персист в he_planner_prefs) + ручные цели приёма 🎯 (NEW `planner-meal-targets.ts`: масштаб 0.7-1.4, белок-флор 0.8, **инвариант дня ±5%** через dayTargets-откат).
- **Эп.7**: NEW `planner-cycle-calendar.ts` (лог начал he_cycle_log → средняя длина → авто-фаза, ручной оверрайд), EA-карточка с «+250 ккал» в Settings.
- **Эп.8**: useRecipesInPlan удалён (подсказки рецептов всегда), histamineSensitive ↔ intolerances.lowHistamine синк (сеттер + инит), legacy peak-week UI удалён, specificity убран из генерации.
- **Эп.9**: месяц — перегенерация отдельной недели 🔄 + «Неделя vs план» (ккал ±5% и Б/Ж/У против целей); тренд качества 7/30 (addDayScore при генерации, бейдж ▲/▼/►, подсказка «N из 7 дн»); печать дня со скором дня + микро-покрытием.
- **Хвосты-2**: hungerLevel удалён из генерации ПОЛНОСТЬЮ (множители/prefer/hungerNote/state); детерминизм — seeded-соль (счётчик he_planner_gen_salt вместо Math.random()); рендер дневных заметок (refeed/волна/тяжёлый день/календарь цикла) в Results; CycleType удалён; legacy-ветки phase==='cutting' (рекомендации/микро) вычищены; budget 'enhanced' из движка/отчёта; `_dbg.test.ts` удалён; карточка «⚡ Периодизация и адаптация» с подзаголовками; подпись «Фаза (V2-скоринг)».
- **NEW тесты**: planner-carb-periodization (17), planner-goal-phase (12), planner-quality-levels (10), planner-micro-pools (18), planner-cycle-calendar (16), planner-meal-targets (9), planner-integration-guarantees (7) + обновлённые.
- **ВНИМАНИЕ**: полный vitest ~8363 тестов — 90 падений пред-существующие/чужие (bb-агент, дневниковый агент, .tmp/combat) — доказано worktree на базе 35d5b6a63 (идентичные наборы). Чужие файлы не тронуты.

## Планировщик питания: остатки-средние + хвост-1 (god-component) (Sep 1 2026, pushed)

Закрытие «осознанных остатков» плана NUTRITION-PROFESSIONAL-PLAN.md (долги, не баги) +
начало декомпозиции god-компонента. Коммиты: dae9bca9, 50fe2769, 544e1faa, 7d5decf3, 6a92d456.
Область IndividualPlan: **631/631** (52 файла), tsc 0 по проекту (NODE_OPTIONS=6GB).

- **Гигиена (низкий приоритет)**: AGENTS.md помечены старые удалённые планы (NUTRITION-PLANNER-QUALITY-PLAN/V2-ROADMAP/OVERHAUL-PLAN) как «🔥 ПЛАН УДАЛЁН»; docs-статус пополнен хвостами-2 и остатками. v7-миграция (`migratePlannerStorage`) чистит мёртвые legacy-поля `he_planner_prefs` (cyclingMode/dietPauseMode/periodizationEnabled/nutrLevel/useRecipesInPlan/hungerLevel/carbCapGPerKg). NEW `clearDayScores()` в day-score-trend + кнопка «🗑 Сброс истории» в бейдже тренда качества. Двусторонняя подпись V2-фаза vs фарма-фаза в Settings (обе карточки ссылаются друг на друга — UI не путает два «фазовых» механизма).
- **Хвост-4 «Неделя vs план»**: NEW `expectedWeekKcal(effectiveKcal, mode, weekIndex, isTrainDays, heavyTrainDay, dayLabels)` в planner-carb-periodization — план недели месяца теперь считает ВОЛНУ 2+1 (каждая 3-я неделя ×0.9) и дневные моды (refeed/carb_cycle/butch/two_one/five_two) + тяжёлый день (+5%), вместо `effectiveKcal × 7`. UI показывает заметку волны/режима. Тесты +7 (в т.ч. волна 6-й недели, heavy-день ровно +5%).
- **Хвост-3 planTypeMod**: декоративные pMult/fMult/cMult из PLAN_TYPES **удалены** (types.ts). NEW `planTypeFloorMods(planType)` в planner-day-targets — ЕДИНЫЙ источник floor/MPS-модификаторов; движок получает `planType` и сам выводит ptm (поле `planTypeMod` из MealPlanInput и поиск по PLAN_TYPES в Context удалены). Реальный макро-профиль дня по-прежнему задаёт `buildDayTargets(dietStyle)` — одна семантика, ноль дублей.
- **Хвост-2 _pickCtx**: 9 разрозненных module-level `let` в meal-plan-engine (_tasteProfile/_deprioritizedIds/_categoryPref/_qualityMode/_currentBudget/_currentWeightKg/_currentExcludedIds/_currentCarbGPerKg) консолидированы в единый типизированный `_pickCtx` объект — одна точка мутации в buildDayPlan и очистки в finally.
- **Хвост-1 (god-component IndividualPlanContext ~3500 строк)**: вынесены два изолированных кластера в под-хуки — `planner-report-state.ts` (7 useState отчётов + 6 генераторов + 2 авто-эффекта) и `planner-special-meal-state.ts` (спец-приёмы/спец-планы/рекомендации + 6 генераторов + авто-эффект). API (`usePlanCtx()`/PlanCtx) и единый merged-value **без изменений** — потребители (`ctx as any`) не тронуты. Остальные ~140 состояний сильно связаны с generatePlan/useMemo и НЕ вынесены (осознанный остаток — полный сплит на под-контексты остаётся рискованным).
- **NEW тесты**: planner-carb-periodization +7 (expectedWeekKcal), planner-storage +2 (v7-миграция legacy-полей), day-score-trend +1 (clearDayScores).
- **ВНИМАНИЕ**: параллельный агент оставил untracked `docs/BB-AUTO-PROFESSIONAL-LEVEL-PLAN.md` — НЕ коммитился (чужой). Коммиты строго pathspec.

## Планировщик питания: эпики A–G по плану NUTRITION-PLANNER-QUALITY-PLAN (Aug 30 2026) — 🔥 ПЛАН УДАЛЁН

> ⚠️ План `docs/NUTRITION-PLANNER-QUALITY-PLAN.md` (и `NUTRITION-V2-ROADMAP.md`, `NUTRITION-PLANNER-OVERHAUL-PLAN.md`) **удалён** — заменён единым `docs/NUTRITION-PROFESSIONAL-PLAN.md` (см. секцию «профессиональный диетолог» выше). Эта секция — историческая запись выполненной работы; её содержание уже перекрыто эпиками 1–9 нового плана. Не использовать как источник актуальных требований.

Полное выполнение плана «качественный рацион для бодибилдинга» (docs/NUTRITION-PLANNER-QUALITY-PLAN.md).
Коммиты: 3f8526d8 (A), dcfede32a (B), 8a9f08267 + b748bb88b + 97e6f8512 (C), f22fab3cc (D), 035a6417f (E+F), 74a0d4222 (G), b550160f5 (nutrition-db plant milks). Область IndividualPlan: **527/527 тестов зелёные**, tsc 0 по моим файлам.

- **A. Единая целевая арифметика**: NEW `planner-day-targets.ts` — `buildDayTargets()`: наука (TDEE→surplus→фаза→фарма→weight-adapt→female gate) задаёт КАЛОРАЖ, пресет белка — оверрайд, углеводы — остаток до цели (диетпотолок), kcal=Atwater. Заменил «декоративный» disconnect `effectiveP/F/C` в Context (806-842). Breakdown-строки видны в Settings (🧮). Инвариант-тесты 14 (surplus влияет, weight-adapt, AAS-белок, инсулин-кап жира 0.5 г/кг сильнее пола, детерминизм).
- **B. Ремонт ядра (meal-plan-engine 4.6k)**: снят `@ts-nocheck` (0 ошибок); фикс мутации кэша пулов (carbGiPref в ключ кэша, pool→копия); единые лимиты — `QUOTA_LIMITS` + катчеллы `nutCatchupCap/oilCatchupCap/eggCatchupCap`, квоты ×weightScale (0.75-1.6, 120+ кг не упирается в орехи/масла); `recalcMealTotals/recalcDayTotals/mealTotalsOf` вместо 30+ копий reduce (stale-fiber класс закрыт); удалены мёртвые prew/postwProteinFor, meal-planning-system/nutrition-meal-plan/meal-tier-generator (CustomFood → NEW `meal-custom-food.ts`), 14 пустых шард p12-p25; autoCorrectPlan через `correctDayToTargets` (честный перебор+недобор, Atwater, 3/7-дневные планы, синк закупок); postw target.c — фактический; Infinity-хак `carbCapGPerKg===0` убран. NEW `planner-id-safety.test.ts` (25): все хардкод-пулы id существуют в FOOD_DB — почищены BREAKFAST_*/VEG_COLOR_GROUPS/CONCENTRATE (экзотика-фрукты-цитрус убраны).
- **C. Рецептурный режим**: C1 — дневные квоты действуют на assembleRecipeDay (двухпроходный гейт: чистые кандидаты с ±15%, при провале — второй проход с legacy ±25%; грамм-трим орехов/масел/яиц после корректора); C2 — peri-слоты достижимы (Предтрен/Пост-трен/Перед сном, только трен-день, peri-рецепты не крадутся обычными слотами); C3 — аллергены/вег гейт для 100% БД через декомпозицию легаси (`legacyDecompIds`), починены 3 битых вег-тега («Кари панир»/«Pro-Хумус»); C4 — шарды p36-p38 (74 рецепта: 20 масс-завтраков 650-950, 18 снеков 300-500, 8 суша-обедов ≤440/белок≥40, 16 low-carb ≤22 г У, 12 веган — все kcal=формула, ids проверены генератором); C5 — ккал-гейт приёмки ±25%→±15% (±20% снеки) + субротация TOPUP/side-пулов по seed дня; C7 — enrichment не перезаписывает авторские ingredientIds; C8 — meal-prep показывает реальные граммовки партии (portions×days). **nutrition-database**: растительные молока (миндальное/овсяное/соевое/кокосовое) больше не классифицируются «dairy»/не-веган в авто-деривации FOOD_ALLERGEN_DIET.
- **D. Разнообразие**: стейплы/основные белки прошлого дня жёстко исключаются в НЕ-strict режиме (полный hard-window остаётся strict-эксклюзивом); месячный `varietyLedgerRef` — recent-продукты/рецепты/2-дневное окно живут МЕЖДУ неделями месяца (стык недель не повторяет стейплы). NEW `planner-variety-guarantees.test.ts` (4): 7-дневная серия — гарниры ≤5/7 (oats — завтрак-стейпл, исключён), белок ≤5/7, смежные дни ≤3 общих стейпл-id, рецепты не повторяются.
- **E/F**: E1 — bbScore-бонус в scoreRecipeForMeal (8+→+4, <5→−3); E4 — EA единый источник (planner-female-cycle делегирует в planner-ea, пороги 30/45 выровнены); F1 — второй гарнир из ДРУГОГО семейства на высокоуглеводных днях (≥6 г/кг), снимает «перегрузку приёма» на bulk; E2 (продукты) уже был в pickWeighted (bb_quality_score^1.5).
- **G**: брифинг дня — факт по белку (factProteinVsPlanPct/remainingProteinG); удалена мёртвая настройка coconutOilBoost.
- **Осознанные остатки** (документированы в плане): H (перетегирование «высокого белка» у 78% БД, дедуп-клоны, кухни) — низкий приоритет; E3 (единый health-score: planner-reports tier-скоринг vs v2) — косметика; G1/G2/G5/G6 (цели по дням недели, цели на приём, месячный план-редактор, женский цикл по календарю) — UI-раунды.
- **ВНИМАНИЕ (worktree)**: параллельный агент периодически делает `git checkout .`, стирая НЕзакоммиченные правки обоих. Каждая завершённая правка коммитится СРАЗУ (pathspec). Чужие файлы (bb-*, warmup, SessionPlayer, BbAutoConstructor с незакрытым JSX) не тронуты; tsc по проекту показывает только их ошибки.

## Кардио: B1/B2 физиология + date-utils, FIT-магия, UI-полировка (Aug 29 2026, pushed ee44ddb40 + 61784979 + ddf4d1372)

Продолжение полного аудита кардио-планировщика (god-file 3.4k). Эпики B/C/D/E/F — доведение до «отлично».

- **B1 (архитектура)**: `cardio.engine.ts` 3.4k → выделен `cardio-physiology.engine.ts` (HeartZone/cardioHeartZones/lthrZones/runningVdot/banisterTrimp/CARDIO_TRIMP_FACTOR/sessionTrimpEstimate/weeklyTrimp/cardioCtlSeries/cardioMonotonyStrain/cardioAcwrEwma) — чистые физиологические хелперы. `cardio.engine.ts` теперь `import + re-export` (обратная совместимость 100% — 18 потребителей `from '../cardio.engine'` не менялись, `HeartZone` импортирован для `cardioSessionProtocol`). Дублирующие определения `HeartZone…weeklyTrimp + CTL` удалены из god-file.
- **B2 (даты)**: NEW `cardio-date-utils.engine.ts` — единые `toLocalIso/parseLocalIso/addDaysIso/todayLocalIso/weekStartIso/dayOfWeekIso` (исправляет UTC-баг `toISOString`). `cardio.engine.ts` (`addDaysIso/todayLocalIso`) и `annual-training-cardio.engine.ts` теперь импортируют из него (дубль удалён, `re-export` для внешнего API).
- **FIT/импорт (E2)**: `cardio-import.engine.ts` — `detectCardioFormat` теперь `isFitBuffer()` по байтам 8-12 `".FIT"` (`Uint8Array` для `ArrayBuffer`, строка для текста) вместо `head.includes('.FIT')`; `parseCardioImport` не считает любой `ArrayBuffer` FIT'ом (только `.fit` или magic), буфер TCX/GPX декодируется `TextDecoder`.
- **UI-полировка (D/E)**: `CardioPreviewStep` — `ROW_H` динамический (hidden measure `getBoundingClientRect` вместо хардкода 118); `CardioAnalyticsDashboard` — `monotony/strain` (Foster) из 7-дневного лога + бейдж `warn >2/6000`; `CardioConstructor` — `fromProfile/saveToProfile` с `bodyFatPct` (FFM-расход).
- **Проверено**: `tsc 0` по своим файлам, `vitest cardio 517/517` (18 файлов), чужие `BbAutoConstructor.tsx`/`planner-recipe-mode.ts` восстановлены из `HEAD` (WIP не тронут). Коммиты строго `pathspec`.
- **Отложено (осознанно)**: `cardio-export` (ICS/TCX/print) остался в god-file — следующий шаг; полный `IndexedDB` для `he_cardio_sessions` (cap 500 → IDB) — stub `cardio-storage.engine.ts` с `safeSet`/quota-защитой, миграция требует `cloud-kv` синка как `labs_log`.

## Планировщик питания: раунд 2 «абсолютное выполнение» — все остатки закрыты (Aug 29 2026, pushed c074f1c88 + 6607415c + 447a29c6)

Поверх эпиков A–F (9b9cb960 + 862a3404). Закрыто ВСЁ из хвост-аудита, кроме двух
осознанных остатков (см. ниже).

- **A6 (санитария)**: удалены мёртвые `pickRotation`/`preSleepP`/`tSnack2`; `_currentBudget`
  сбрасывается в `finally`; инъекционные мини-приёмы (инсулин/ГР/ИГФ) регистрируются в
  `markUsed`+quota (дубль whey с пост-треном устранён); лейблы snack2/3/4 → «Перекус 2/3/4»
  (preferred-key fallback на «Перекус» сохранён); заметка «Полдник 15:30» → фактическое время;
  `meal-plan-generator.engine.ts` помечен `@deprecated` (живой импорт — только тип в
  bb-contest-prep; удаление после отвязки).
- **B5**: `recentStapleFamilies` (семейства гарниров предыдущих дней) — Context собирает из
  dayPlan/threeDayPlan, движок деприоритизирует рис-в-каждый-день при ≥2 свежих альтернатив.
- **C3**: лёгкая сессия <60 мин → пост-трен НЕ строится, бюджет (белок+угли) сливается в ужин
  (note «слит с ужином»); ≥60 мин — отдельный шейк (тесты на оба пути).
- **C5**: `mpsSummary.meals[]` (label/proteinG/leucineG/triggersMps) + fiberG/fiberTargetG;
  notes-подсказка «⚠ {приём}: N г белка — ниже MPS-порога, дополните творогом/сывороткой».
- **D1**: `parseIngredient` безразмерные ингредиенты → дефолт по роли (масло 10 г, соус 20,
  цитрус 30, специи 3, зелень 30, мёд 15, чеснок 10) — легаси-рецепты без ids больше не
  получают «оливковое масло 100 г».
- **D4**: порошковый лимит в рецептурном пути — `assembleRecipeDay` не ставит порошковые
  рецепты (ingredientIds ∩ POWDER_PROTEIN_IDS) в 3-й+ приём дня (тест F3).
- **D5**: `Recipe.baseWeightKg?` (derived из тегов: масса→110, сушка→80) ×
  `RecipeMatchOptions.athleteWeightKg` — ±10 кг +8, ±20 кг 0, дальше −6 к скорингу;
  Context передаёт `weight` в assembleRecipeDay.
- **D3**: NEW `recipe-db-p33.ts` — 25 масс-обедов/ужинов/завтраков 780–950 ккал
  (BB-Масса: плов, лазанья protein, чифан с лососем, овсянка-гейнер…);
  NEW `recipe-db-p34.ts` — 10 суша-ужинов ≤440 ккал / белок ≥40 (треска+цветная,
  креветочный вок, фаршированные кальмары…). Итого партия p32–p34: +65 рецептов.
- **E2-хвост**: MealListRender inline «📋 дубль» → `ctx.duplicateMeal` (синк недели).
- **E4**: месяц — повторная генерация недели 0 удалена (отображение из monthPlan[0]);
  useEffect-синк weekPlan → monthPlan[selectedWeek] при weekEditDay-правках в режиме месяца.
- **E5**: Results «↩ Отменить» → единый `ctx.undoLast` (восстановление + recommendations).
- **E6**: `specialMealOverride` в движок — календарь спец-приёмов с `replaceMeal` и конфиг
  спецприёма (custom-макросы) РЕАЛЬНО перестраивают целевой приём: cheat ×1.6У/×2Ж/0.8Б,
  refeed ×1.8У/×0.5Ж, fast ×0.3, custom — явные Б/Ж/У (до usedP/residualP — честный остаток).
- **E7**: `prompt()` → модалки (сохранение плана в Context, импорт в Results с валидацией
  формы meals[]/items[]); UTC→локальная дата в «📒 в дневник» и `addPlanToDiary`;
  чекбоксы закупок сбрасываются при новом плане (planKey-ref); Settings «Заполнить из
  профиля» → единый `ctx.autofillFromProfile` (старый читал несуществующие поля — no-op);
  `archve`→`archive`; placeholder-вызов в `moveFoodItem` удалён; мёртвый
  `IndividualPlanHealth.tsx` (216 строк) удалён.
- **F3**: NEW `planner-recipe-gates.test.ts` — капы ролей (масла ≤15, цитрус ≤60, соусы ≤30,
  специи ≤10) на всей RECIPE_DB; oats>150 г запрещён (ремап на oats_dry); декомпозиция в
  коридоре 0.6–1.6 шапки; порошковый лимит рецептурного дня ≤2.
- **F4**: NEW `planner-ui-guarantees.test.tsx` — `window.showToast` определён и доставляет
  в PlannerToastHost; инварианты времени приёмов.
- **Проверено**: IndividualPlan **464/464** (39 файлов), tsc **0 по проекту**; коммиты
  строго pathspec; чужой WIP (cardio-агент: cardio-import/cardio.engine/cardio-storage)
  не тронут.
- **Осознанные остатки**: (1) автокоррекция/скоринг полезности — dayPlan-only (multi-day
  требует рефактора `autoCorrectPlan`/`handleCalcUsefulness` на активный день вида);
  (2) `meal-plan-generator.engine.ts` физически не удалён (живой type-import в
  bb-contest-prep) — помечен deprecated.


## Планировщик питания: полный аудит и «профессиональный уровень» — эпики A/B/C/D/E/F (Aug 29 2026, pushed 9b9cb960 + 862a3404)

Полный разбор планировщика питания (движок 3.7k строк, 858 рецептов, 11 UI-файлов) по плану,
утверждённому пользователем: реалистичность тарелки, диетология бодибилдинга (ISSN 2017,
Schoenfeld & Aragon 2018, Morton 2018, Moore 2015, Reynolds 2022), рабочие кнопки, рецепты.
Старт-аудит дампом реальной генерации: геодак/трубач/орех кукуи в рационе, D3 «35 г», креатин
HCL 21 г, изолят в 4 приёмах, овсянка 5×/день, треска 57 г, клетчатка 90 г/день; UI: мёртвый
`window.showToast` (7+ уведомлений в никуда), правки недели терялись при weekEditDay.

- **A (данные)**: NEW `food-availability.ts` — реестр доступности (~70 exotic/specialty id,
  травы-приправы, `isPureSupplementId` по категории, POWDER_PROTEIN_IDS, семейства стейплов);
  гейты в `buildFoodPools` (basePoolRaw), преслип-пулах (mg/melatonin), посадке, extraDense;
  **дедуп FOOD_DB** (1418→1347, last-wins — поздние шарды по per100/USDA); креатин →
  моногидрат 5 г фикс (`_fixedGrams`, заморожен во всех коррекциях/снапах), D3 — только заметка.
- **B (реалистичная тарелка)**: дневные квоты `DailyQuota` — порошок ≤2 regular (postw exempt,
  слот резервируется), семейство гарнира ≤3 (овсянка ≤2), орехи/семена ≤2 приёмов ≤60 г,
  масла ≤2 приёмов ≤25 г, фрукты ≤4, яйца ≤230 г; минимальная порция цельного белка 90 г
  основной / 70 г перекус (полы резки fixM/P4b/P-2.3 согласованы 80-110/60; кап белка ровно
  300 г — «лосось 374 г» из ratio×1.25 убит); MPS-добивка до цели приёма (не до 25 г
  абсолютных) + fallback творог при исчерпании порошка; клетчаточный кап 14 г/1000 ккал
  (25-70) с приоритетом резки овощи→фрукты→семена (гарниры ≥90% — иначе посадка углей
  ломалась: «4200 ккал → 2665» регресс); day-level катчеллы овсянки/орехов/масел после
  посадки; жиры-догон не трогает ужин (утренняя загрузка) и пост-трен.
- **C (диетология)**: белок по роли — mains 0.45 г/кг LBM (25-55), перекусы 0.30 (15-40),
  перенормировка к дневной цели; **pre-sleep фикс-бюджет 28 г** вне fit-цикла (ISSN: 30-40 г
  казеина; выбор медленного белка по плотности — казеин/творог, не «йогурт 140 г = 14 г»);
  пери LBM-скейлинг включён (prew 0.25, postw 0.4 г/кг LBM — мёртвый «отложенный» фикс
  Роунда-2); carb cycling трен/отдых уже в Context (dayCarbMod) — подтверждён тестом.
- **D (рецепты)**: `sanitizeRecipePortions` в recipe-db.ts — капы по ролям (масла ≤15 г,
  цитрус ≤60, соусы ≤30, специи ≤10; ~20 enrichment-записей с `olive_oil: 100 г` = «треска
  1115 ккал» вылечены) + ремап `oats ≤150 г` → `oats_dry` (сухая мера vs варёная 71/367);
  NEW партия **p32: 30 рецептов** preworkout (10) / postworkout (10) / presleep (10) — первые
  рецепты под пери-слоты и ночь, грамовки по ISSN-таргетам, kcal=формула ≤3%.
- **E (UI)**: **глобальный toast** (`window.showToast` + PlannerToastHost в index.tsx —
  оживили 7+ уведомлений «Рецепт применён»/«Файл тренеру скачан»); `updateMealTime`/
  `duplicateMeal` в Context через weekEditDay-синк; QuickControls (replace/weight/add/supp)
  синхронно правят weekPlan; «✕ Удалить» → `removeMealRebalanced` (паритет со списком);
  чип дней недели = **просмотр** существующего дня (неделя/3дн) вместо регенерации,
  уничтожавшей правки.
- **F (гаранты)**: NEW `planner-realism-guarantees.test.ts` (18: экзотика/травы/добавки-еда
  =0 на 18 сценариях, порошок ≤3, овсянка ≤2, орехи ≤75, белок ≥80 г, Atwater) +
  `planner-dietology-guarantees.test.ts` (8: MPS-коридор 0.22-0.62 г/кг LBM, pre-sleep ≥25,
  пери-окно 0.45-0.95 г/кг, postw fat ≤6, carb cycling, лейцин, fiber).
- **Проверено**: IndividualPlan **455/455** (38 файлов), tsc **0 ошибок по проекту**
  (NODE_OPTIONS=6GB). Полный прогон 8067/8155: 88 падений — **все на базе c16e03617 до моих
  коммитов** (проверено git-worktree на 9b9cb960^ и 862a3404: bb-pro-methods-levels 20 падений
  уже там — чужие коммиты BB-taper/BbAuto/metabolic-hub 7504e99f8/0be9f5f1a/369890506 +
  пред-существующие дневники/mindset/program-editor/FrequentFoodsPanel/.tmp).
- **Трейд-оффы задокументированы** (осознанные, с обоснованием в тестах): день ±6.5% белка
  (полы порций), экстрим 120 кг/600 г углей −14%, worst-cell matrix 41.6%, ужин fat ≤14
  (внедрённый жир белка).

## ББ-авто: полный аудит и починка — 80 падений → 1 чужое (Aug 27 2026, uncommitted)

Полный аудит ББ-авто (все пути: generic/cycle adapt/faithful/program, все сплиты × уровни ×
цели × методики). Старт: `npx vitest run bb` = **1692/80** (30 файлов). Итог: **1772/1773** —
единственное падение `bb-macrocycle.test.ts` (v7-сериализация — чужой WIP, задокументирован).
Полный прогон проекта 7811/7851 — 40 падений пред-существующие/чужие (проверено stash-тестом
на HEAD: дневники/planner/mindset-tab/annual-training/FrequentFoodsPanel/program-editor).
tsc: 0 по моим файлам (7 ошибок — чужой WIP IndividualPlanContext recipe-mode).

### P0-баги движка (реальные регрессии, все починены)
- **1.1 PPL-финишеры после лимитов** (bb-finalize): `ensurePPLMidDeltFinisher/RearDeltFinisher`
  добавляли по 3 сета ПОСЛЕ `enforceSessionExerciseLimit`/finMaxSets → 11 упр/26 сетов,
  `session_exercise_cap` error, `validation.valid=false` (ломало tradeoff-матрицу, generation,
  deterministic-properties, safety cycle-путь, exercise-count-benchmark). Фикс: финишеры
  перенесены ДО финальных лимитов + повторный `enforceSessionExerciseLimit` после них;
  `enforceSessionExerciseLimit` удаляет optional-упражнения ПЕРВЫМИ.
- **1.2 Травмы exclude игнорировались leg-аллокацией**: `allocateExperiencedLegSession` не
  проверял excludedMuscles/gradedMuscles/donors → «legs exclude» возвращал присед/жим ногами.
  Фикс: `muscleBlocked()` guard на heavy/pump/glutes-блоки.
- **1.3 Травмы graded: repsCap не соблюдался** в leg-работе (15 reps при cap 10). Фикс:
  `gradedInjuries` проброшены в BBFinalizeOptions (builder + cycle-to-plan оба пути),
  кламп repsRange/workSets по repsCap.
- **1.4 Мобильность игнорировалась leg-аллокацией**: `findCatalog` в ensureLegHeavy/Pump/
  Glutes не фильтровал `isMobilityRestricted` → cycle-путь с ankle получал присед. Фикс:
  фильтр во всех findCatalog + `avoidAxialLoad && isAxialLoadExercise` (гакк-присед на бицепс
  бедра больше не осевой в safety-тестах).
- **1.5 Fill-проход без bodyweight-исключения**: «Скручивания на полу: оборудование не входит»
  (27/28 safety). Фикс: паритет с 6988a4ffb в fill + валидатор пропускает bodyweight.
- **1.6 Muscle-leaks**: (а) tradeoff-перенос клал целевую мышцу в ЛЮБОЙ день (back в Legs/Push,
  chest в Pull) — фикс: `TAG_MUSCLES`-гейт в `addToRecipient`; (б) `derivePattern` классифицировал
  заднедельтовые махи/разведения как isolation_chest — фикс: плечевые махи (наклон/rear/лицо ИЛИ
  мышца shoulders/delt_*) → isolation_shoulders.
- **1.7 Проф-методики не для новичков** (по требованию): суперсеты/GVT/гигант-сеты/pre-exhaust
  (finalize `proMethodsAllowed`), DUP (bb-dup), интенсив-техники (bb-autocoach) — гейт
  `level !== 'beginner'`. Новичку — блочная периодизация; убраны MRV-overflow от метаболических
  схем поверх базового объёма.
- **1.8 Прочие**: back-аллокация перенесена ПОСЛЕ fit-бюджета + финальный tidy получил backCap 6
  (back 16 → 22-24, тест ≥18 зелёный); deload-недели не получают leg/arm/chest/back-аллокации
  (glutes 16.2 > cap 12 в deload); weak-optional не блокируется optional другой мышцы (PPL-финишер
  плеч); 21s навешивается на weak-optional бицепса; same_muscle/giant-сеты работают при
  primary-изоляциях (спец-планы); «Темп:» в primary-комментариях; enrich добавляет
  «Порядок:/Техника:/Прогрессия:»; cap-adjust покрывает delt_front/mid/rear (per-head overflow);
  cycle/program-пути пробрасывают peds/courseIntensity в sessionLimitsFor (PED-объём не ниже
  noPED — тест AAS 1000).

### Тесты
- Обновлены под намеренные изменения (RU-rationale, PPL per-head, bodyweight, beginner-гейт):
  bb-position-rationale/faitful-exact/rationale-export/all-paths («позиция в сессии:»),
  bb-mev-feeder («Авто-добивка до MEV»), bb-labels (abs-пояснение), bb-volume (per-head),
  bb-frequency-optimizer (RU-текст), bb-balance-coverage (RU-лейбл), bb-selection-layer
  (bodyweight), bb-zero-state-snapshots (4 снапшота пересчитаны), bb-pro-methods-levels
  (beginner: методики НЕ применяются, инварианты чисты), bb-pro-methods (GVT 4-5 сетов после
  cap-adjust), bb-strength-mass (×1.03 vs ×1.05), bb-weak-optional (optional слабой мышцы),
  audit_full_matrix (isolation_shoulders ×2 by design).
- Проверено: bb-область 1772/1773; полный прогон 7811/7851 (40 чужих/пред-существующих);
  tsc 0 по своим файлам. Чужие файлы не тронуты.

## Планировщик питания: recipe-mode раунд 3 — гарантии ±3%, ⭐, печать, p29 (Aug 26 2026, uncommitted)

Продолжение recipe-mode (после 04e360049 + 33674f738).

- **A1 `assembleRecipeDay()`** (planner-recipe-mode.ts): сборка рецептурного дня вынесена
  из generatePlan в чистую функцию {meals,pool,targets,excludedIds,cookProfile,budget,
  isVegetarian,preferredRecipeNames,usedNamesAcrossDays,goal} → {meals,notes,
  withinTolerance,deviationPct,appliedCount}. Контекст — тонкий вызов.
- **Ключевые фиксы движка** (всё найдено property-тестами): (1) targetKcal пустого приёма =
  формула 4Б+4Ж... из макро-цели, а не дефолт 300 (ломало выбор); (2) финальное
  ранжирование кандидатов по ДЕКОМПОЗИЦИИ (decomposedFacts, WeakMap-кэш) — легаси-рецепты
  без ingredientIds раздували жиры до ×3.4 после scaleToRecipeKcal, авторские макросы врали;
  (3) замены 🔁 под dev-гейтом (монотонность, иначе осцилляции swap↔cut сжигали maxIter и
  ухудшали день); (4) недобор «осмыслен» от ~120 ккал-эквивалента (микро-хвост +7 г углей
  блокировал резку перебора); (5) резка = жадный спуск по SHRINK_LADDER со строгим
  улучшением maxDev (аналитические «комнаты» блокировались нулевой комнатой связующего
  макроса); (6) финальная посадка порции рецепта: равномерный scale items в кумулятивном
  коридоре ±10% (пропорции не тронуты, компенсация дрейфа декомпозиции легаси до ~13%);
  (7) скоринг: непрерывный штраф за дистанцию макросов (≤8 п.) + тай-брейк ранга
  score−min(score,dist·100/4) в pickRecipe(s)ForMeal — бонусно-«накрученные» 100-балльники
  больше не бьют точные по КБЖУ рецепты.
- **A2 property-тесты** (`planner-recipe-day-property.test.ts`, 4): 50 seeded-сценариев —
  авторские порции целы (±14% дрейф легаси задокументирован), уникальность в день,
  afterDev ≤ beforeDev, честность флага (>3% → предупреждение); разнообразие между днями;
  строгие ≤3% на конвейере pool=[рецепт]; самосогласованность ≤12%.
- **A3 бейдж** (MealListRender, шапка дня): «⚖️ формула ±X%» = kbjuFormulaDeviationPct
  дня (зелёный ≤3%) — визуализация требования консистентности.
- **A4** открытая карточка «👨‍🍳» пересобирается при смене варианта
  (refreshRecipeCookingCardIfActive + recipeCookingActiveRef).
- **B5 ⭐ избранное**: he_recipe_fav, favoriteRecipes/toggle/isFavorite в PlanCtx, звёзды на
  вариантах и чипах, preferredRecipeNames в скоринге (параметр существовал, но не
  передавался никем).
- **B6 печать**: buildRecipePlanPrintHtml в planner-day-print (XSS-esc, ингредиенты/шаги,
  «остальные приёмы» списком), кнопка «🖨 Меню с рецептами» в Results при наличии
  recipeApplied; тест XSS+контент (planner-recipe-print.test.ts, 3).
- **B7** refreshRecipeSuggestions копит suggestionSeenNames — «🔄» не возвращает показанное.
- **C шард p29** (+30, всего партия 152): банки/meal-prep, пост-тренировочные, бюджетные
  (печень, чечевица, перловка); fix-kcal.mjs знает p29; порог теста ≥148.
- Область 385/395 — те же 10 пред-существующих падений (5 файлов); tsc 0 по своим файлам;
  чужие bb-* правки в worktree не тронуты.
- **Доводка (продолжение r3)**: replaceMealWithRecipe (пикер «🍳») теперь ПОЛНОЕ применение —
  авторские порции + recipeApplied/recipeAppliedData (рецепт защищён) + ребаланс дня ±3% +
  синк закупок/карточки готовки, оба пути (day и three/week через _resolvePlanDay), тост
  «Рецепт применён»; e2e «применение из пикера» (клик по кнопке формата «БN/ЖN/УN» →
  пикер закрыт + recipeApplied в he_day_plan). **Пресеты** RECIPE_PRESETS/recipeMatchesPreset
  в модуле: 🏋️ Масса (тег массы/загрузки ИЛИ carbs ≥ 45 г — большое У), 🔥 Сушка,
  🥩 Белок 40+, ⚡ Быстро (≤15 мин), 🌾 Low-carb, 🥦 ПП; чипы над вариантами И подсказками
  (фильтр отображения, активируется при ≥2 активных пресетов), юнит 3 + e2e клика «Масса».
- **Корень расхождений КБЖУ найден**: 785/1395 (56%) FOOD_DB имеют kcal ≠ 4Б+9Ж+4У
  (дрейф до десятков % — табличные значения с клетчаточными факторами). **Фикс на уровне
  конвейера**: kcal item'ов ВСЕГДА из формулы макросов — makeItem (meal-plan-engine),
  makeMealItem + scaleToRecipeKcal (recipe-engine), scaleItem (planner-recipe-mode),
  все creation-точки контекста (addFoodToMeal/replaceFoodItem/mk-хелперы/special-meals/
  mps-whey/topup) и MealQuickControls (замена/OCR-add); scaleItem после масштабирования
  тоже формула. Итог: бейдж «⚖️ формула ±X%» дня ≤3% гарантирован тестом
  (planner-recipe-day-property, «buildDayPlan ≤3% на трёх профилях»).
- **Ккал-посадка дня** (buildDayPlan, перед return): нормализация вскрыла перебор цели
  (+14.5% на базовом профиле) — жадный кламп: самые калорийные НЕ-белковые порции −12%
  за шаг до входа дня в ±4% цели (guard 50, белок не режется). Результат: base 3000 →
  3115 (+3.8%), формула 2.7%; область планировщика **394/401 — 7 падений вместо 10
  базовых** (кламп починил convergence preSleep, planner kcal ±8%, D-23 микро-буст),
  новых регрессий нет; tsc 0 по своим файлам.
- **Рецепты в simple/minimal/classic**: классический путь получил тот же рецептурный
  слой — чипы-подсказки при «🍲 Рецепты в рационе» И полноценный режим «по рецептам»
  (assembleRecipeDay поверх classic-дней, ребаланс ±3%, proNotes, разнообразие между
  днями, недели через ref-хелпер + синк weekDays для закупок). Пикер/«Выбрать» в этих
  режимах работают через общий replaceMealWithRecipe. Починен unhandled jsdom-краш
  classic-генерации (scrollIntoView guard). Область 395/402 — те же 7 базовых; e2e
  «⚡ Быстрый режим: чипы + пикер → recipeApplied» зелёный (кнопка classic — «⚡ Рассчитать
  и создать рацион», не общая «✨»).
- **Раунд «помощник спортсмена»**: (1) 🧭 **брифинг дня** (NEW planner-briefing.ts,
  buildDayBriefing, 8 юнитов) — что готовить (recipeApplied-уникальные), ближайший приём
  по времени суток, ккал/белок vs цель, углеводное окно (≤90 мин после trainStart),
  **факт из дневника** (factVsPlanPct/remainingKcal — % от плана, остаток до цели),
  карточка над списком приёмов в Results; (2) **умный пикер** (MealComposer): рецепты
  сортируются по КБЖУ-дистанции до цели приёма (recipeMacroDistance), а не в порядке БД;
  ⭐-тоггл рядом с каждой строкой + жёлтая рамка у избранных; (3) **пресет-фильтр UX**:
  авто-сброс при новом плане (planKey ref), кнопка ✕ и счётчик «N/M» видимых рецептов.
  **Продолжение**: (4) 📤 **экспорт тренеру** (planner-day-print.ts: buildCoachExportHtml +
  downloadCoachExport — приёмы/рецепты/закупки/заметки одним HTML, XSS-esc, кнопка
  «Файл тренеру» в Results) + тесты; (5) ♻️ **авто-пересборка при пропуске приёма**
  (removeMealRebalanced в PlanCtx — день пересобирается через rebalanceDayAfterRecipes,
  синк закупок/готовки, тост, undo; MealListRender ✕ теперь через него).

## Планировщик питания: двухрежимная генерация «по продуктам / по рецептам» (Aug 26 2026, pushed 04e360049 + продолжение)

Две крупные карточки-кнопки в настройках генерации; режим «по рецептам» собирает основные
приёмы из готовых блюд, день сходится в КБЖУ ±3%, закупки/готовка следуют за рецептами.

- **A. UI** (`IndividualPlanSettings`): карточки «🥩 По продуктам» / «🍳 По рецептам» (aria-pressed,
  подсветка активной), `generationMode: 'products'|'recipes'` персист `he_planner_gen_mode`,
  текст генерации и пояснение меняются («Генерация будет ТОЛЬКО по рецептам…»).
- **B. Движок** (`IndividualPlan/planner-recipe-mode.ts`, NEW ~470 строк): `pickRecipeOptions`
  (топ-3 через `pickRecipesForMeal`, исключение показанных имён), `flattenRecipeOption`/
  `rebuildRecipeFromFlat` (JSON-safe хранение варианта прямо в meal — планы персистятся),
  `buildRecipeMealItems` (авторские порции через decomposeRecipe: ingredientIds+portions →
  FOOD_DB; null если разбор пуст), `rebalanceDayAfterRecipes` — недобор закрывается топ-апом
  в гибкий слот (перекус; белковые/углеводные/жировые пулы FOOD_DB), перебор режется по
  НЕ-рецептурным приёмам с «комнатой» по каждому макросу (`loFrac = max(1−room/im)` — окно
  [lo, hi=85%], ступени лестницы SHRINK_LADDER); при переборе ккал+недоборе белка худший
  низкобелковый продукт перекуса заменяется на белковый (🔁). Гарантия ±3% при согласуемых
  целях, иначе best-effort + `withinTolerance:false`. Разнообразие: `_usedRecipeNames`
  между днями генерации. В generatePlan (pro-V2) после подсказок: автовыбор лучшего
  кандидата на основные приёмы (Завтрак/Обед/Ужин; перекусы остаются продуктами),
  ребаланс, заметки в proNotes, итоги дня из фактических meals. Хендлеры контекста:
  `pickRecipeOption(dayIdx,mealIdx,name)` (пересборка+ребаланс+синк в weekEditDay/3дн/нед,
  закупки из ВСЕХ видимых дней), `moreRecipeOptions` (пул минус показанные, накопление
  recipeOptionNames), `refreshRecipeSuggestions` (чипы заново).
- **C. КБЖУ ≤3%**: `kbjuFormulaDeviationPct`; легаси-БД нормализуется на сборке
  (`recipe-db.ts normalizeRecipeKcal`: kcal = round5(4Б+9Ж+4У) при отклонении >3%) — тест
  гарантирует всю БД ≤3%; новые партии написаны сразу по формуле (+ скрипт
  `scripts/fix-kcal.mjs` пересчитывает kcal в шардах, regex с /g!).
- **D. Круглые суммы** (`meal-plan-engine.ts`): liquids сетка [100,150,200,250,300,400,500,
  750,1000] в `gramsForMacro` И `snapPortionG`; <100 мл жидкостей не раздувается до первой
  ступени (шаг 10); яйца `egg_whole` кратны целому (~55 г, min 1).
- **E. Готовка**: `buildRecipeCookingPlan(applied, days)` — шаги = инструкции выбранных
  рецептов (+подготовка ингредиентов, упаковка при days>1), формат совместим с рендером
  mealPrepPlan; `generateMealPrep` использует её, если в плане есть recipeApplied.
- **F. Закупки**: `buildShoppingFromPlans(allDayPlans)` — единая агрегация (batch-cook
  подсказки внутри); вызывается в generatePlan (замена инлайн-кода) и после каждой замены
  рецептом (`syncShoppingListFromPlans`). Фикс продолжения: pickRecipeOption для дня считал
  список только из отредактированного дня → теперь все видимые дни (week/threeDay/day).
- **G. Контент**: NEW шарды `recipe-db-p26.ts` (50) + `-p27.ts` (38) + `-p28.ts` (34) = **122
  русских BB-рецепта** (белковые завтраки, обеды/ужины из курицы/индейки/говядины/печени/
  рыбы/морепродуктов, 30+ перекусов); у всех ingredientIds проверены по FOOD_DB, portions
  обязательны. Чипы-подсказки: фильтр по тегам (быстро/высокий белок/low-carb/масса/сушка/пп)
  + кнопка «🔄»; блок вариантов рецептов с ✅-выбором и «🔄 Другие варианты».
- **Тесты NEW**: `planner-recipe-mode.test.ts` (21), `recipe-kbju-consistency.test.ts` (6),
  `planner-generation-mode.test.tsx` (3), `planner-recipe-mode-e2e.test.tsx` (2 — реальный
  рендер IndividualPlan: варианты отрисованы, клик «Выбрать» перестраивает рацион). Область
  планировщика 376+/386 — падения только пред-существующие 5 файлов (в их базе было 12).
- Проверено: tsc 0 по своим файлам; чужие untracked (`scripts/full_assign_check.mjs`,
  `bb/__tests__/full_assign_check.test.ts`) не тронуты; коммит строго pathspec.

## Питание: живой поиск продуктов супермаркетов РФ — ВкусВилл/Пятёрочка/Магнит с КБЖУ (Aug 26 2026, uncommitted)

«Как FatSecret»: в дневнике питания и каталоге любой продукт из сетей ищется по имени,
КБЖУ на 100 г приходит из каталогов магазинов в момент поиска (не краудсорсинг — база это
сами каталоги; FatSecret отпал: free-тариф только US).

- **`src/engines/retail-search.engine.ts`** (NEW): `searchRetailProducts(query, limit)` → POST на
  Edge Function `retail-search` (apikey+Bearer anon), `RetailProduct {id, source: vkusvill|pyaterochka|magnit,
  name, brand?, kcal/protein/fat/carbs на 100 г, weight?}`; `sanitizeRetailItems` (валидация сети/имени/
  kcal>0, дедуп сеть+имя, round1); кэш localStorage `he_retail_search_cache_v1` (TTL 24 ч, кап 40 запросов,
  негативные ответы тоже кэшируются); без конфига Supabase / HTTP-ошибка / таймаут → `{available:false}`
  тихо (секция не показывается, OFF-путь работает как раньше); `RETAIL_CHAINS` (лейбл/эмодзи/цвет),
  `guessRetailCategory` (снэки чипсы/снеки приоритетно fast_food до dairy «вкус сыра»),
  `retailToFoodItem` → FoodItemLike (`id retail:<source>:<id>`, servingSize строго «100 г» для дневной
  математики, описание «Сеть • Бренд • вес»).
- **`supabase/functions/retail-search/index.ts`** (NEW, Deno без зависимостей): CORS + POST {query,limit≤20};
  адаптеры через `Promise.allSettled`, merge round-robin по источникам, дедуп:
  - **ВкусВилл** — официальный анонимный MCP-API `mcp.vkusvill.ru/mcp` (fallback mcp001): JSON-RPC
    initialize (session из заголовка Mcp-Session-Id) → notifications/initialized → tools/call
    `vkusvill_products_search` {q,page,sort:popular} → детали топ-N через `vkusvill_product_details`
    (аргументы product_id→id fallback); ответ JSON или SSE (парс последних data:{...} строк);
    КБЖУ regex'ами из текста свойств (калорийность/белки/жиры с lookahead (?!ность)/углеводы,
    «около N», kcal = Б×4+Ж×9+У×4 при отсутствии);
  - **Пятёрочка** — `5ka.ru/api/v2/products/search/` (+v4 fallback): КБЖУ сразу в выдаче
    (nutritional_value.calories/proteins/fats/carbohydrates), UA/Referer заголовки;
  - **Магнит** — экспериментально, 2 кандидата URL, молча [] при неудаче.
  `clampMacros` отбрасывает мусор (kcal 0–950, макросы ≤100); таймауты 8–9 c. Деплой вручную
  пользователем (Dashboard → Edge Functions → вставить index.ts, имя строго `retail-search`) —
  инструкция + curl-проверка в `docs/RETAIL-SEARCH.md`; миграций SQL НЕ требует.
- **UI дневника** (`AddFoodPanel.tsx`): параллельный эффект (q≥3, debounce уже есть) → секция
  «🏪 Супермаркеты РФ» между локальными результатами и OFF-блоком: чип сети в цвете сети,
  название + серый бренд, КБЖУ-строка, кнопки «＋» (в очередь) и «⚡ 100г» (direct add) через
  `retailToFoodItem`; спиннер «Ищем в каталогах сетей…»; empty-state учитывает retail-состояния.
- **UI каталога** (`NutritionScreen.tsx` CatalogTab): тот же триггер что OFF (filtered<6), карточки-
  гриды как у catInternet с зелёным стилем, бейдж сети, «⭐ В избранное» (id retail:*), пустое
  состояние обновлено.
- Тесты NEW `retail-search.test.ts` **13/13** (vi.stubEnv+resetModules+dynamic import для env-зависимого
  модуля: нормализация ё/пробелы, категории ×9, маппинг food-item, sanitize дедуп/мусор, no-env
  available:false без fetch, короткий запрос, успех+кэш (1 fetch на 2 вызова), TTL-истечение, 500 не
  кэшируется, network-fail, мусор в ответе, clearRetailCache).
- Проверено: tsc 0 по моим файлам (1 чужая ошибка ProgramManagerPanel setManualMode — WIP другого);
  NutritionScreen_parts **406/423** — 17 падений пред-существующие/чужие (planner-convergence/
  dietology/d28/preferred/planner числовая сходимость движка, FrequentFoodsPanel — мои файлы ни один
  тест-файл не импортирует). **Диск C: был переполнен (ENOSPC валит сюиты)** — очищен Temp старше 2д
  (+1.1 ГБ), тестовые TMP перенесены на D:\BodyBuildHealth\.tmp (в .gitignore).
- **Деплой выполнен и E2E работает** (CLI `supabase functions deploy` с SUPABASE_ACCESS_TOKEN пользователя,
  токен отозвать). Отладка: (1) sort должен быть `popularity` (не popular — enum MCP); выдача в
  `data.items[]` с КБЖУ прямо в `properties[]` («Пищевая…ценность в 100 г»: «белки 6.4 г, …; 549.3 ккал»)
  → детали почти не нужны (fallback при <3 распарсенных, аргумент деталей = `id`); (2) корень пустых
  ответов — сдвиг аргументов в mcpPost (строка метода попадала в body, объект параметров в diag);
  (3) PowerShell-тесты ломали JSON (`\"`) — только --data-binary @file. `&nbsp;` в названиях чистится.
  Ответ функции несёт `debug[]`. **Пятёрочка: HTTP 403 анти-бот на датацентровые IP — недоступна с Supabase;
  Магнит: публичный API не найден** — оба адаптера остаются best-effort, основной поток даёт ВкусВилл.
  supabase/config.toml создан (project_id), .env.local почищен от BOM (ломал CLI).
  MCP ВкусВилла также имеет `vkusvill_product_barcode {barcode}` — задел на штрихкоды сетей.
- **Аудит остальных сетей РФ (Aug 26, все закрыты)**: Ашан `/v1/catalog/products` → WAF «Access
  Blocked» даже с полными браузерными заголовками; Перекрёсток → капча+cookie+Auth (perekrestok_api
  требует Playwright/Camoufox); Лента api/v1 → 401; Азбука Вкуса services-api.av.ru/search и
  av.ru/rest/v1 → SPA HTML; Чижик → stealth-анти-бот; О'КЕЙ/Утконос/Метро → блокировка/401/логин.
  ВкусВилл остаётся единственным открытым источником. **Штрихкод-режим внедрён**: edge {barcode}
  → vkusvillProductByBarcode (строго EAN-13, `^\\d{13}$`); клиент `searchRetailProductByBarcode()`
  (кэш `bc:<ean>` 24ч) подключён в BarcodeScanner после OFF: OFF → Supabase shared → retail-barcode →
  ручной ввод. Тесты движка **15/15** (+2 barcode).

## Кардио: пакеты A–D — валидация журнала, undo, работа дня, советы по рабочим неделям (Aug 20 2026, pushed 3ccc5af0)

Поверх дней ног: комплексная доводка кардио-конструктора и дневника по плану A–D.

- **A1**: гейт прошлых недель в `autoTuneCardioCycle` — прошлые недели не переписываются
  авто-подстройкой (после `weekStats.push` возврат как есть).
- **A2 (варианты)**: `selectVariant(v)` — живое применение варианта: `setVariant(v)` +
  пересборка `buildCardioCycle({...base, ...vOpts, config: applied})` + `saveCardioCycle` +
  `setActiveCardioCycle` + `setCycle` + `reload()` + flash «⇄ Вариант „X“ применён — цикл пересобран».
  `WizardState` += variant/comps; wizard-save и init учитывают их; `editConfig` → `variantFromConfig`.
- **A3 (валидация журнала)**: `validateCardioLogFields` (RPE 1–10, ЧСС 20–260, км 0–200, минуты 1–600;
  **пустые строки трактуются как null** — фикс: `Number('') === 0` давал ложный warning и блокировал
  сохранение) + `clampCardioLogNumber`; warnings (`role="alert"`) во всех 3 формах
  (CardioDiaryPanel/CardioSessionTimer/профильный CardioDiary); NEW `replaceCardioLog(entries)` —
  полная замена журнала для undo.
- **B1**: `goNext` на preview без цикла — сразу `build()` + переход на следующий шаг.
- **B2**: `normalizeCardioPhaseSplit(input, totalWeeks)` в движке (клампы + усечение суммы до totalWeeks)
  + в CardioParamsStep предупреждение о сумме фаз (красное «> доступных недель» / жёлтое «распределено меньше»).
- **B3 (undo версий)**: `restoreCardioCycleVersion` больше НЕ удаляет снапшот (неразрушающий undo);
  `clearCardioCycleHistory(c.id)` при удалении цикла (`removeCycle` в CardioConstructor);
  `saveCardioCycleVersion(before, 'До пересчёта под ACWR')` перед ACWR-пересчётом (CardioLinkCard.applyRecalc).
- **C1 (синхронизация факта)**: `CardioDiaryStep` держит `log`/`srpe` в state и передаёт в дочерние
  виджеты — `CardioDayCard` (пропы `log`/`srpe`), `CardioProgressCard` (`log`), `CardioVolumeChart` (`log`),
  `CardioDiaryPanel` (`log`/`onLogChanged`). Факт-виджеты больше не читают localStorage только при mount —
  обновляются после сохранения в таймере. Управляемый режим панели журнала.
- **C2 (панель журнала)**: `CardioDiaryPanel` — undo-кнопка «↩ Отменить» (восстанавливает снимок через
  `replaceCardioLog`), пустое состояние («📭 Записей пока нет…»), бейдж «⏭ пропущена» для `completed:false`,
  кнопка «✕ Сбросить» формы; CardioSessionTimer — id-суффикс `c-<ts>-<rand>` и дедуп пропуска
  (сегодня уже пропущен тот же тип → flash без второй записи).
- **C3 (советы)**: `computeCardioAdvice` базируется на **рабочих неделях**
  (base/build/maintenance/contest_prep), исключая taper/peak/transition (занижали бы план).
- **D**: `window.confirm` перед удалением цикла; a11y карточек вариантов CardioPreviewStep
  (`role=button`+`tabIndex`+`aria-pressed`+Enter/Space); опечатка «низкоуударным»→«низкоударным».
- Тесты: +8 (C3 совет по рабочим неделям; CardioDiaryPanel undo×2/пустое состояние/бейдж пропуска/
  сброс формы/управляемый режим; CardioDiaryStep передача log). Обновлён тест undo-версий
  (restore не удаляет снапшот). Кардио-область **461/461** (14 файлов), tsc 0 по своим файлам
  (чужие WIP: daily-quality-score, IndividualPlanResults, WeightDiary/BodyRecompVelocity/
  WaistHeightRatio, ProgramEditorView).

## Кардио: дни ног в печатной сводке и текстовом экспорте (Aug 20 2026, pushed ebe8b4bf)

Поверх дней ног в дневнике: `config.legDays` виден в экспортах цикла.

- **`buildCardioSummaryText`**: строка «🦵 Дни тяжёлых ног: Пн, Чт — интенсивное кардио на них
  не ставится (recovery — можно)» после «Старты: …» (только при непустых legDays).
- **`buildCardioPrintHtml`**: строка-предупреждение в шапке (янтарный текст #8a6d1a) +
  🦵-префикс и лёгкая янтарная заливка (#fff7e0) ячеек дней ног в таблице «Недели по дням».
- Тесты: +4 (текстовая сводка с днями ног/без, печать с днями ног/без). Кардио-область
  **453/453** (14 файлов), tsc 0 по своим файлам.

## Кардио-конструктор: дни ног в исполнении — карточка дня (Aug 20 2026, pushed 898e7bb3)

Поверх дней ног в раскладке недели: учёт перенесён и в фазу выполнения (дневник).

- **Движок** (`cardio.engine.ts`): `cardioLegDayForDate(cycle, dateIso)` → `{ dayOfWeek, isLegDay } |
  null` — день недели (Пн=0) даты и является ли он днём тяжёлых ног по `config.legDays`;
  null без цикла/при некорректной дате.
- **UI `CardioDayCard`**: 🦵-баннер в день ног (`role="status"`) — красный «лучше перенести
  его или заменить на recovery» при плановой сессии сегодня zone2/miss/hiit, янтарный
  «сегодня recovery — можно» при recovery-плане, «интенсивное кардио сегодня не
  планируется» без плана; `CardioDiaryStep` рендерит карточку с `cycle` — доработок не потребовал.
- Тесты: движок +5 (null без цикла, маппинг даты→Пн=0, isLegDay true/false, без legDays → false,
  некорректная дата → null), CardioDayCard +2 (детерминированные: dow сегодня из `(getDay()+6)%7`,
  `legDays:[dow]` + zone2 → предупреждение; recovery → «можно» без предупреждения). Кардио-область
  **449/449** (14 файлов), tsc 0 по своим файлам (чужие WIP-ошибки: body-measurements-modal,
  WaistHeightRatio, daily-quality-score, ProgramEditorView).

## Кардио-конструктор: дни ног в раскладке недели (Aug 20 2026, pushed 9b94d9aa)

Поверх ориентира/оформления: день тяжёлых ног (`config.legDays`) виден в раскладке недели.

- **Движок** (`cardio-diary.engine.ts` → `cardio.engine.ts`): `CardioLegDayConflict` +
  `cardioWeekLegConflicts(cycle, weekNo)` — сессии недели (Пн=0) на днях ног
  (zone2/miss/hiit — конфликт, recovery — нет); `[]` без legDays/вне диапазона.
- **UI предпросмотра** (`CardioPreviewStep`): в «Неделя по дням» — 🦵-маркер и янтарная
  рамка дней ног, сессии на дне ног красные, подсказка «🦵 Дни тяжёлых ног: …»,
  `role="alert"` «⚠ … перенесите их на шаге „Конструктор недели"» при конфликтах.
- **UI редактора недели** (`CardioWeekEditor`): 🦵-маркеры в сетке, alert о сессиях на
  дне ног, селект дня с суффиксом «(ноги)», бейдж «⚠ ноги» в строке сессии, футер
  «🦵 Дни тяжёлых ног: … — интенсивное кардио на них не ставится (recovery — можно)».
- Тесты: движок +6 (нет legDays/авто-обход/явный день/неделя вне диапазона/recovery
  не конфликт/несколько дней), WeekEditor +3 (SSR-маркеры+футер, alert конфликта,
  суффикс+бейдж в редакторе), конструктор +1 (чипы «Ноги: Пн/Чт» → 🦵 в предпросмотре +
  `config.legDays` сохранён). Кардио-область **442/442** (14 файлов), tsc 0 по своим
  файлам (4 чужие ошибки: daily-quality-score, ProgramEditorView/program-editor-logic).
  Чужие WIP не тронуты.

## Кардио-конструктор: оформление (шапка с прогрессом, сводка цикла, степпер) + ориентир дистанции (Aug 20 2026, pushed 02e080a2)

Поверх undo/темпа: доработка «на глаз» конструктора + подсказка дистанции при вводе км.

- **Движок** (`cardio-diary.engine.ts`): `cardioExpectedDistanceHint(type, durationMin)` → «~N км при
  N км/ч (тип)» или null — типичные скорости (zone2 9, miss 10, hiit 8, recovery 5 км/ч).
- **UI таймера** (`CardioSessionTimer`): после «⏹ Завершить» под полем км — строка
  «💡 Ориентир: ~…» (темп покажется в журнале после сохранения).
- **Оформление `CardioConstructor`**: шапка стала акцентной карточкой — заголовок + «Шаг N из 5 —
  {метка}», чипы сводки активного цикла (`cardioCycleSummary`: мин/нед, ккал/нед, N нед) рядом с
  чипами статусов (авто-режим/до старта/сегодня/prep-план/пик-неделя), прогресс-бар мастера
  (role=progressbar, градиент, плавный width); степпер — активный шаг с градиентом и свечением,
  завершённые с ✅; футер навигации — карточка с «Далее: {следующий шаг} →».
- Тесты: движок +5 (формат/округление/null/miss), таймер +1 (ориентир после завершения),
  конструктор +1 (Шаг N из 5, progressbar, мин/ккал/N нед после сборки). Кардио-область
  **432/432** (14 файлов), tsc 0 по своим файлам (4 чужие ошибки: daily-quality-score,
  ProgramEditorView/program-editor-logic). Чужие WIP не тронуты.

## Кардио-дневник: темп мин/км из дистанции (Aug 20 2026, pushed f50ad9a0)

Поверх ккал/км: журнал показывает темп каждой сессии и средний темп сводок.

- **Движок** (`cardio-diary.engine.ts`): `cardioPaceMinPerKm(distanceKm, minutes)` → «м:сс/км» или null
  (нет дистанции/времени/нули), `cardioAvgPaceMinPerKm(entries)` — средний темп, взвешенный по
  дистанции (сумма км / сумма минут); `cardioLogStats` += `avgPace: string | null`.
- **UI**: строки журнала панели конструктора (`CardioDiaryPanel`) и профильного дневника
  (`CardioDiary`) — «5 км · 6:00/км»; сводки 7д/28д и печатная сводка — «· 6:00/км»; `CardioDayCard`
  — темп по факту дня; CSV/PDF профильного дневника — колонка «Темп».
- Тесты: движок +7 (формат/округление/null/средний взвешенный/stats.avgPace), UI +2 (темп в строке
  и 7д-сводке, без км — нет темпа). Кардио-область **400/400** (387 + annual-training-cardio 13),
  tsc 0 по своим файлам. Чужие WIP не тронуты (`program-editor-logic.ts` остаётся изменённым).

## Кардио-дневник: undo в профильном дневнике (Aug 20 2026, pushed c36874dd)

- Профильный `CardioDiary`: кнопка «↩ Отменить запись» в шапке (DiaryHeader `undoActive`/`onUndo`)
  откатывает последнее изменение — добавление, обновление и удаление записи (снимок лога до
  операции, восстановление прямым `localStorage.setItem('he_cardio_sessions', …)` + reload).
- Тесты: +2 (undo после записи возвращает 1 запись; undo после удаления возвращает запись).
  Кардио-паттерн `npx vitest run cardio` — **425/425** (14 файлов), tsc 0 по своим файлам.

## Кардио-дневник: ккал, дистанция (км), факт-сводки, редактирование, экспорт (Aug 20 2026, pushed)

Серия раундов по кардио-дневнику (движок `src/engines/lms/cardio-diary.engine.ts` + UI).

- **Ккал-оценка и дистанция (км)** (`372da001`): `estimateCardioEntryKcal(type, minutes, weight?)`
  (zone2 7 ккал/мин при 80 кг, пересчёт на реальный вес; hiit/miss/recovery — коэффициенты),
  `CardioLogEntry.distanceKm?` + `speedKmh?`; `cardioLogStats`/`cardioWeekFact`/`cardioDayFact`
  считают `km` и `kcal`; ввод км в `CardioDiaryPanel` (конструктор), `CardioSessionTimer`,
  профильном `CardioDiary` и `CardioDayCard`; «план vs факт» в дневнике показывает ккал/км.
- **Факт-сводки**: `CardioVolumeChart` — строка под графиком «факт N ккал · M км» (`c527b833`);
  `CardioProgressCard` переведён с `cardioWeekAdherence` на `cardioWeekFact`, в строке
  «выполнение прошлых недель» — ккал/км (`cff04486`).
- **Редактирование записей** (`04ff990e`): в обоих журналах (конструктор + Профиль) кнопка ✎
  заполняет форму, «Обновить» сохраняет с той же id (`saveCardioLogEntry` заменяет по id);
  удаление редактируемой записи сбрасывает режим.
- **Экспорт профильного журнала** (`4e086e8e`): меню «••• Ещё» — «📥 CSV-файл» (дата/тип/минуты/
  км/ккал/ЧСС/RPE/завершено, формул-защита `=+-@` → префикс `'`), «🖨 Печать / PDF» (HTML-сводка
  7/28д + таблица, XSS-экранирование), «🗑 Очистить дневник» (с подтверждением).
- Тесты: cardio-diary (движок) + cardio-pro-panels + профильный cardio-diary — кардио-область
  **359/359**, tsc 0 по своим файлам. Чужие WIP не тронуты.

## Облачная синхронизация через Telegram (Aug 18 2026, uncommitted)

Привязка данных к аккаунту Telegram: localStorage (ключи `he_*`, включая фото) синхронизируется
с Supabase (таблица `user_kv`), чтобы на телефоне и компьютере (Telegram Mini App) были одни и
те же данные. Логинов/паролей нет — Telegram сам идентифицирует пользователя.

- **`src/core/cloud-kv.ts`** (NEW): sync-токен `tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)>`
  в заголовке `x-user-token`, RLS отдаёт пользователю только его строки; pull при входе
  (LWW по mtime ключа, окно 500 мс) + фоновый pull каждые 30 с + при возврате в приложение
  (visibilitychange/focus) + уведомление о новых данных БЕЗ авто-перезагрузки: движок
  ставит `state.pendingUpdate` → `KvUpdateBanner.tsx` (глобальный, в App.tsx) показывает
  «🔄 Новые данные с другого устройства» с кнопкой «Обновить» (`reloadKvView`) и ✕
  (`clearKvPendingUpdate`), авто-скрытие через 20 с (`KV_BANNER_AUTO_HIDE_MS`) — экран
  больше не перезагружается постоянно; в шапке кнопка `KvSyncButton.tsx` «🔄»
  (`syncKvNow` = flush + pull, тост результата); свежие данные
  всегда при входе (initKvSync делает pull до рендера); push через перехват
  `localStorage.setItem/removeItem` (debounce 2.5 с) +
  keepalive-флаш на pagehide/beforeunload (бюджет 48КБ) + реконнект по `online`; чанки по
  100k символов (без разрыва суррогатных пар), реальный `chunk_count` только в чанке 0 —
  неполная запись пропускается и «залечивается» локальным push; reconcile: локальные ключи
  без mtime (никогда не синкались) выгружаются при ините; мета mtime в `he_sync_meta_v1`.
  **LWW по СЕРВЕРНОМУ времени**: `skewMs` калибруется из HTTP Date-заголовка (pull на raw
  fetch), все mtime штампуются серверными часами — иначе телефон со «спешащими» часами
  всегда побеждал ПК и его записи не доходили (баг: с ПК → на телефон не передавалось).
  **IndexedDB-синк (labs_log, course_log, workout_log, training_log)**: анализы/курс/
  дневник силы хранятся в IndexedDB, а не localStorage — синк расширен на них: ключи
  `idb:<store>:<id>`, LWW по сигнатуре записи (`stableStringify` с сортировкой ключей,
  meta `he_sync_meta_idb_v1`); pull применяет удалённую версию, если локально запись не
  менялась с последней синхронизации, локальная правка побеждает и выгружается; локальное
  удаление помечается tombstone (`deleted`) и НЕ воскрешается pull'ом, выгрузка удаления
  делает pushIdb; pushIdb вызывается в конце pull() (каждые 30с/при входе/focus).
  **Защита от «отскока» данных**: (1) перехват setItem не считает правкой запись ТЕХ ЖЕ
  данных (иначе пустой авто-save на одном устройстве затирал правку другого «свежим»
  временем); (2) правка, сделанная ПОКА шёл сетевой pull (`dirtyDuringPull`), всегда
  побеждает снимок облака; (3) в остальных случаях — LWW по серверному времени (окно
  500 мс = 'none', никто не побеждает).
  Исключения: `he_session_v2`, `he_crypto_key`, `he_last_active`, `he_sync_*`, `he_draft_*`,
  `he_nav_*`, `he_admin_*`.
- **`auth-module.ts`**: `initKvSync(user.id)` после входа в TG-пути (до onLogin — pull
  применяется до рендера). Вне Telegram (PWA/браузер) синк выключен by design.
- **`supabase/migrations/20260818_user_kv.sql`** (NEW): таблица + RLS по
  `current_setting('request.headers')::jsonb->>'x-user-token'` + grants anon/authenticated.
- **Тесты**: `cloud-kv.test.ts` 41/41 (чанки/суррогатные пары, исключения, LWW-конфликты,
  токен, pull/push/remove, залечивание неполной записи, рестарт без повторного push,
  keepalive-бюджет, фоновый pull → pendingUpdate без авто-reload + reloadKvView/
  clearKvPendingUpdate, skew-тесты: часы телефона спешат на 1ч —
  запись ПК побеждает; IndexedDB: телефон→ПК, ПК→телефон, локальная правка побеждает,
  удаление в обе стороны, tombstone без воскрешения, стабильная сигнатура при порядке
  полей; «отскок»: пустая перезапись не пушится, правка во время pull не затирается)
  + `kv-update-banner.test.tsx` 4/4 (вкл. авто-скрытие) + `kv-sync-button.test.tsx`
  2/2. `src/test/setup.ts` — mock localStorage
  дополнен стандартными `length`/`key()` (ранее отсутствовали — ломало перечисление ключей).
- **ВАЖНО**: Supabase-проект из `.env` был удалён (NXDOMAIN), пользователь восстановил —
  проверил: DNS резолвится, ключ работает, таблиц нет кроме `labs`; SQL-миграцию применяет
  пользователь (SQL Editor). Документация: `docs/TELEGRAM-CLOUD-SYNC.md`.
- Проверено: tsc 0; cloud-kv 24/24; src/core/__tests__ 317/317.

## MC-5 завершён: редизайн годового планировщика + «✏️ Редактировать микроцикл» (Aug 18 2026, uncommitted)

Финал редизайна MacrocyclePanel: новый порядок секций, кнопки «✏️ Редактировать микроцикл» с
сохранением правки в годовой план через баннер, все native-селекты «Сборки года» на PopupSelect.
Движки макроцикла/годового плана НЕ менялись; убран чужой WIP MC-5 (мёртвые state/баннер,
`setSubView('bb-auto')` — такого subView нет). **tsc 0 по проекту**.

- **MacrocyclePanel.tsx — порядок секций**: today-card → блоки недель → активный блок → «⚙️ Фазы»
  (SectionCard с PopupNumber и «Пересчитать» = `applyEdit`, бывш. «Действия») → «Сборка года» →
  «📖 Обоснование» + «❤️ Кардио» (недельные точки, empty-state без цикла) + «📸 Сценарии» (новые
  секции, вставлены перед «Итог года») → «📊 Итог года» (ACWR-блок на месте) → «📈 Вертикально» →
  «🎯 Действия» в самом низу (весь блок кнопок перенесён verbatim).
- **«✏️ Редактировать микроцикл»**: в today-card (ПЛ с cycleId → `block.cycleId`, ББ → `''`) и в
  активном блоке (ПЛ/ББ). Проп `onEditMicrocycle?: (cycleId, weeks, phase, isBB, blockIdx?)`;
  `blockIdx` — индекс блока (ПЛ-блоки без cycleId всё равно открывают конструктор).
- **SRCBBScreen.tsx**: обработчик пишет `he_macro_edit_ctx` `{isBB, cycleId, weeks, phase, blockIdx}`
  и открывает конструктор: ББ → `setBbWeeks(clamp 4-24)` + plan; ПЛ → `setSelectedCycleId` +
  `setCycleWeeks` + plan (без авто-сборки). В subView 'plan' обоих табов — **зелёный баннер**
  «✏️ Правка блока годового плана: N нед · фаза «…» · цикл «…»» с «💾 Сохранить в годовой план»
  (`saveMacroEdit`: target = blocks[blockIdx] с fallback по phase, delta недель применяется к
  СУММЕ недель фазы через `rebalanceMacrocycle`/`rebalanceBbMacrocycle`, запись `he_pl_macro`/
  `he_bb_macro`, dispatch he-pl/he-bb-macrocycle-updated + he-annual-training-plan-updated,
  возврат в subView 'macro', флеш «✅ Правка сохранена в годовой план») и «✕ Отменить».
- **«Сборка года»**: все native-селекты → PopupSelect («СРЦ-цикл блока» с «— авто-цикл по фазе —»,
  «Сплит блока» с «— авто-сплит —», «Цель блока», «Шаблон ручного блока», «⧉ Копировать из
  блока…»); taper-чекбокс → кнопка-тумблер «📉 Taper внутри блока (2 нед)» (#f59e0b active);
  🎭 Пик-неделя осталась checkbox.
- **SRCBBScreen — карточка «🏁 Тапер/пик в макроцикле (ПЛ)»**: 2×2 grid (`1fr 1fr`): Раскладка
  тапера / Весовая цель тапера (PopupSelect) / 🤖 Подобрать / 🎯 Mock meet; ниже на всю ширину
  🔄 Пост-старт восстановление + подсказка. Шапка «🗓 Годовое планирование» со «🆕 Строить с нуля»
  / «← К параметрам» УДАЛЕНА (карточка режима в plan-вью не тронута).
- **Тесты**: macrocycle-panel-cycle-slots 37/37 (исправлены 2 флейка-assert'а A5: `getByText(/⚡
  ACWR/)` и `/Дневник: …/` → `getAllByText(...).length > 0` — вложенные текстовые узлы Итога года
  давали несколько матчей; пред-существующее, документировано в раунде «Дневники профиля»);
  macrocycle-panel-annual-build 20/20 («📉 Taper внутри блока (2 нед)» на месте);
  macrocycle-cardio-layer + macrocycle-panel-actions + macrocycle-ui-prefs зелёные; SRCBBScreen_parts
  **111/111 (13 файлов)**; движковые macrocycle-наборы 89/89; bb-auto-smoke 5/5, bb-auto-annual-ctx 5/5.
- ВАЖНО: полный прогон до моего раунда — 6179/6182 (3 падения — чужой WIP MC-5, теперь убран);
  отложенными из плана остаются интеграционные карточки в PL/BB-авто и heatmap макроцикла.

## Кардио: сборка из ББ prep-плана + блок годового плана + UI (Aug 18 2026, pushed 0b61d030b)

Этап 6 кардио-интеграции: кардио-цикл строится ИЗ единого ББ prep-плана (`goals.bbContestPrepPlan`),
кардио участвует в годовом плане наравне с ПЛ/ББ, UI конструктора получает вход из prep.

- **`cardio.engine.ts`** (аддитивно): `cardioPrepCheckIn` — чек-ин веса против prep-плана (темп,
  дефицит, targetWeight, рекомендация, null без prep/цикла); `cardioWeightAdvice` — совет по весу
  (только cut/recomp/bb_prep, плато |weekly|<0.25 → increase + «Zone 2»); `buildCardioCycleFromPrep`
  — сборка цикла из prep: фазы base/build/contest_prep/taper/peak, totalWeeks = prep+taper+1,
  taper по профилю prep, пик-неделя только recovery, `startDate = opts.startDate ?? p.startDate`;
  `CardioPrepBuildOptions` (790). API качества: `cardioQualityReport` → `{score, findings}`,
  finding `{level: 'ok'|'warn'|'info', text}`.
- **NEW `annual-training-cardio.engine.ts`**: `buildAnnualCardioCycles` — циклы по BB-блокам годового
  плана (кардио-профиль по фазе блока, taper перед соревнованием, id `annual-cardio-${blockKey}`,
  priority 'B', заглушки-предупреждения, ссылки в годовом движке); `cardioPhaseForBlock`.
- **CardioConstructor.tsx**: при `goals.bbContestPrepPlan` в шапке — кнопка «⚙️ Из prep-плана (N нед)»
  (aria-label «Собрать кардио из prep-плана») → сборка через `buildCardioCycleFromPrep` +
  синхронизация визарда (goal bb_prep, taper, пик, вес из prep) + активный цикл + flash; чип
  «🎭 Пик-неделя: нед N (dd.mm–dd.mm)» от `cycle.startDate`.
- Тесты: `cardio-prep-engine.test.ts` NEW 47, `cardio-prep-taper-goals.test.ts` 23 (мой файл,
  исправлены 3 теста под API: лог плато + `level`/`findings`), `annual-training-cardio.test.ts`
  NEW 11, `cardio-constructor.test.tsx` 24 (сид профиля `he_profile_v2` + 2 теста prep).
  Область 311/311, полный прогон 6179/6182 (3 падения — чужой WIP MC-5 в MacrocyclePanel,
  пред-существующее). tsc-фильтр cardio|annual — чисто.
- Из плана `CARDIO-CYCLE-INTEGRATION-PLAN.md` остаются отложенными: интеграционные карточки в
  PL/BB-авто и heatmap макроцикла (чужие WIP: SRCBBScreen.tsx, BbAutoConstructor.tsx,
  MacrocyclePanel.tsx).

## Ручной конструктор: дизайн периодизации ↔ программа, заметки, быстрый ввод (Aug 18 2026, uncommitted)

Связь макроцикла-дизайна с программой + заметки недели/сессии + быстрый ввод упражнений.
Механики движков ББ/ПЛ не менялись.

- **`designer-to-program.ts`**: `designFingerprint` (FNV-1a от `v1:{totalWeeks}:{сортированные блоки}`,
  порядок блоков не влияет), `linkDesignToProgram`/`unlinkDesignFromProgram` (meta.designRef
  {id,name,hash}), `isProgramDesignStale` (hash ≠ актуальному), `reapplyDesignToProgram`
  (переразметка фаз bb.weeks / pl.customWeeks / hybrid.bbWeeks, упражнения сохраняются,
  hash обновляется), `rephaseWeeks` — обобщённый (применение фаз дизайна к неделям).
- **`user-program.types.ts`**: `UserSession.note?`, `UserWeek.note?`, `ProgramMeta.designRef?`.
- **ProgramEditorView (шаг «Недели»)**: карточка «🎨 Дизайн периодизации» — привязка из списка
  сохранённых дизайнов (`he_macrocycle_designs`), бейдж «⚠ дизайн изменён» при stale, «↻
  Переразметить фазы», «✕ Отвязать», вариант «дизайн удалён». Печать (🖨 PDF): заметки недели
  (после заголовка недели) и сессии (после таблицы дня) в bb и hybrid ветках (PL — нет поля note).
- **ProgramEditorComponents**: 💬-кнопка в шапке недели (BBEditor) и в шапке сессии (SessionList)
  → textarea заметки (сохранение через updateWeek/updateSession); BlockList — пустое состояние
  заменено на чипы групп мышц (GROUP_RU) → `suggestExercisesForGroup` (6 упр., профиль:
  уровень/оборудование/слабые/травмы/axial/избранное/исключённые) → «+» добавляет блок
  {compound→primary / accessory, sets: [{reps:10, rir:2}]}.
- **ProgramManagerPanel**: «🆕 Создать новую» для ББ строит СКЕЛЕТ недель из SPLIT_PATTERNS
  (`buildBBSkeleton`, без авто-сборки — autoFillBBDraft заменяет bb целиком), pl/hybrid — как
  раньше (авто-сборка); список программ — относительное время «🕒 N мин назад» (`timeAgo`);
  текстовый экспорт включает «> Заметка недели/Заметка:» (bb + hybrid).
- **PeriodizationDesignerTab**: строка «🔗 К программе:» (select из `loadUserPrograms` +
  «🔗 Привязать») → `linkDesignToProgram` + `saveUserProgram`.
- **planner-bridge-handlers `designHandler`**: оба пути (переразметка существующих bb-недель и
  новая программа из дизайна) теперь тоже проставляют `meta.designRef` через
  `linkDesignToProgram` (раньше привязка была только из карточек редактора/дизайнера);
  +2 теста в `planner-bridge-handlers.test.ts` (переразметка + designRef, новая программа + hash) — 25/25.
- **ВНИМАНИЕ (worktree)**: чужой коммит fb3a4cc88 (липкая нижняя панель «Далее/← Назад» +
  тесты) перестроил ProgramEditorView ПОСЛЕ моей базы — восстановил HEAD-версию и перенёс свои
  правки (карточка дизайна/печать/aria-label) поверх; другие мои файлы базы не конфликтовали.
- Тесты: NEW `designer-program-link.test.ts` (17: fingerprint-детерминизм/независимость от порядка/
  чувствительность к правкам, link/unlink, stale, reapply для bb/pl/hybrid); `manual-constructor-steps`
  +1 (P0-1: seed дизайна в `he_macrocycle_designs` → «2 Редактор»→«Недели» → 🔗 Привязать →
  имя дизайна + «↻ Переразметить фазы» → ✕ Отвязать).
- Проверено: tsc 0 по моим файлам (остальные ошибки — чужой WIP: bb-finalize duplicate import,
  SRCBBScreen setEdited*, MacrocyclePanel onEditMicrocycle); TrainingScreen_parts 418/418;
  periodization+manual-constructor 86/86; manual-constructor-steps 9/9.

## BB-авто: многоблочная специализация + донорское перераспределение (Aug 18 2026, uncommitted)

Задача: «цикл 12 недель — одна специализация 1-5, вторая 6-10» + «толщина спины за счёт
рук на 5 недель». **Объёмная модель (MEV/MAV/MRV, уровень/стаж/PED/цель/капы) НЕ менялась**
— донорский режим это слой перераспределения поверх рассчитанного плана.

- **`bb-specialization.engine.ts`**: `VolumeTradeoffPolicy` (mode none/reduce_direct_to_floor/
  remove_direct_when_indirect_covers_floor + donorMuscles + preserveIndirect), `SpecializationBlock`
  += id/tradeoff; длина блока 3-6 нед, дефолт 5 (было 6-10); `tradeoffForWeek(schedule, week)`;
  `specializationScheduleText` включает доноров.
- **NEW `bb-specialization-registry.ts`**: реестр всех зон WEAK_GROUPS (key → canonical, label,
  granular, patterns, donorRecommendations) — единый источник паттернов/доноров.
- **NEW `bb-tradeoff.engine.ts`**: `applyTradeoffToPlan` — per-week: прямые изоляции донора
  снимаются до effective floor = MEV (косвенная нагрузка сохраняется), освобождённые сеты
  переносятся в паттерн-совпадающие упражнения цели в пределах adapted MRV, cap 5, session
  caps, equipment; отчёт снято/перенесено/не использовано в rationale.
- **bb-builder/cycle-to-plan**: tradeoff применяется после всех проходов, до finalize, во всех
  трёх путях (generic/cycle adapt/program adapt); faithful не трогается.
- **bb-finalize**: `tradeoffDonorsForWeek` — additive-проходы (arm allocation, arm heads, small
  muscle, MEV feeders, fill, MEV-repair) НЕ возвращают объём донору в неделях tradeoff.
- **UI (BbAutoConstructor)**: многоблочный редактор — список блоков (недели 3-6, цели 1-2,
  режим доноров, доноры 1-2), «+ Добавить блок», удаление, итоговая строка «нед 1-5 [A] →
  нед 6-10 [B] → нед 11-12 баланс»; миграция старых specBlocks/focusGroup/weakPoints.
- Тесты: NEW `bb-tradeoff.test.ts` (8: нормализация политики, per-week доноры, remove/reduce
  режимы, effective ≥ MEV, восстановление после блока, baseline без tradeoff неизменен,
  многоблочное 12 нед 1-5/6-10/11-12); `bb-specialization-unified` обновлён под блок 5 нед.
- Проверено: tsc 0 по моим файлам; целевые 65/65; bb+TrainingScreen_parts 1665/1667 (2 падения
  — чужой manual-constructor WIP); полный прогон 6146/6154 — падения только чужие
  (bb-macrocycle v7, stretch-session, cardio-prep, macrocycle-panel, manual-constructor,
  pl-competition).

## BB-авто: травмы — щадящий режим, честный exclude, мобильность (Aug 18 2026, pushed 7efe9c96)

Жалобы: «щадящий режим в выборе травм не выбирается — мышца нажимается один раз и
исключается»; «проработать группы мышц травм»; «не забудь мобильность». **Объёмная модель
(MEV/MAV/MRV, уровень/стаж/PED/цель/капы/валидаторы) НЕ менялась** — BB 1240/1240,
TrainingScreen_parts 417/417, tsc 0.

- **UI `InjurySelectCard.tsx`**: чипы «⛔ Исключить» / «⚡ Щадящая» в шапке модалки стали
  кликабельными — задают режим для НОВЫХ травм (`mode` state); `addInjury`/`addCustom`
  добавляют с `exclude: true` или `gradedDefaults()` (exclude:false, 0.6/0.6/15); тумблер
  в списке переключает режим существующей травмы (градация сбрасывается/ставится).
- **`manual-plan-builder.ts`**: `expandInjuryMuscle` — зонные ключи раскрываются в
  PRO-мышцы движка: legs→[quads,hamstrings,glutes,calves], arms→[biceps,triceps,forearms],
  core→[abs,lower_back]; применяется в `getExcludedMuscles`/`getGradedInjuries`. Раньше
  травма «Колено» (legs) НЕ матчилась ни с одной мышцей — план вообще не менялся.
- **`exercise-substitution.engine.ts`**: NEW `findGentleSubstitutions` — щадящая замена
  ТОЛЬКО той же мышцы (изоляция low jointStress → low stress + другое оборудование →
  исходное со снижением 0.6/0.6). Старый `findSubstitutions` (для exclude) уводил на
  ДРУГИЕ группы — градированная мышца не прорабатывалась. bb-builder использует gentle
  для graded + пробрасывает `repsCap` из травмы (раньше слайдер повторов не влиял).
- **Финализатор уважает травмы**: `gradedMuscles` в BBFinalizeOptions (buildBBPlan и
  cycle-to-plan пробрасывают); auto-MEV-feeder (builder) / addAdaptiveMEVFeeders /
  fill-проход / ensureSmallMuscleQuality / addWarmupActivator не добавляют упражнения
  для excluded (раньше «legs exclude» возвращало ноги: fill добавлял присед с весом
  15.8 кг от абс-шаблона) и не раздувают graded до MEV (щадящий объём намеренно снижен).
- **Мобильность**: NEW `bb-mobility.engine.ts` — единый источник `MOBILITY_PATTERNS`/
  `isMobilityRestricted` (фикс паттернов: lower_back «станов.*классик» — ловил «классич»
  вместо «классика»; wrist — «бицепс.*штанг» не матчил «Подъём штанги на бицепс», добавлен
  «штанг.*бицепс» и «ez.?гриф»); bb-builder реэкспортирует для cycle-to-plan. Финализатор
  фильтрует добавляемые/заменяемые упражнения (fill/feeders/малые группы/warmup/rotation/
  repair/arm-heads/weak-pattern). UI: чипы мобильности сохраняются в профиль
  (`TrainingProfile.mobilityRestrictions` ↔ UnifiedSettings training) и восстанавливаются.
- Тесты: NEW `bb-injury-gentle.test.ts` (15), `bb-mobility.test.ts` (12),
  `injury-select-card.test.tsx` (6). Полный bb-прогон 1240/1240; падение
  macrocycle-panel-cycle-slots A5 — пред-существующее (чужой WIP).
- ВАЖНО: bb-builder/bb-finalize/cycle-to-plan/BbAutoConstructor правки попали в HEAD через
  чужой коммит c18c03bda (`git add -A`); в этом коммите — только мои 8 файлов.

## BB-авто: гранулярные зоны специализации + проверка выбора (Aug 18 2026, uncommitted)

Жалоба: «выбор средняя+задняя дельта даёт то же значение, что и просто плечи» — зоны
канонизировались в одну мышцу (delt_mid+delt_rear → shoulders = 1 цель), подбор упражнений
терял гранулярные зоны. **Объёмная модель (MEV/MAV/MRV, уровень/стаж/PED/цель) НЕ менялась**
— ключевое правило; изменён только учёт ЗОН в специализации.

- **`bb-specialization.engine.ts`**: `resolveSpecialization` сохраняет гранулярные цели
  (`dedupeExactMuscles` — только точный дедуп, без канонизации); `targetHeadsFor` — сколько
  целей попадает в каноническую мышцу; `specializationVolumeFactor`: 1 зона ×1.1, 2 зоны
  одной мышцы ×1.2 (кап ×1.3) — выборы РАЗЛИЧАЮТСЯ; emphasis/MRV/isWeak — матчинг через
  каноническую мышцу (`listHasMuscle`). Блоки расписания — точный дедуп целей.
- **bb-builder**: `baseRotationFor` — MAV × (1.0 + 0.1×зон); не-цели — MEV как раньше.
  Подбор упражнений получает гранулярные зоны (weakZones) → махи/обратные разведения при
  выборе головок. WEAK_PATTERN_REQ гарантирует паттерны зон.
- **bb-finalize**: `applySpecializationPass` — targetMuscles/focusMuscle через collapse
  (гранулярные зоны работают в RIR-добивке/спец-частоте).
- **cycle-to-plan**: program-добивка матчит упражнения по канонической мышце (delt_mid →
  каталог shoulders).
- **UI (BbAutoConstructor)**: чипы специализации — запрет конфликта регионов
  (`isRegionConflict`: shoulders+delt_mid нельзя, delt_mid+delt_rear можно); подсказка с
  расчётным объёмом целей (`specVolumeSummary`: «Средняя дельта ≈10 сетов/нед (2 зоны)»).
- Тесты: `bb-specialization-unified.test.ts` **27** (+4: гранулярный top-2, 1 зона vs 2 зоны
  ×1.1/×1.2 и грудь 0.7/1.1, план 2 зон > 1 зоны при стабильных не-целях, блоки с точным
  дедупом).
- Проверено: tsc 0; целевые **55/55**; bb+TrainingScreen_parts 1643/1644 (1 падение — чужой
  cardio-constructor WIP); полный прогон ~6022/6026 — падения только чужие/пред-существующие
  (course-sync, profile-diaries-e2e, bb-macrocycle v7, stretch-session,
  macrocycle-panel-cycle-slots, manual-constructor-steps, cardio-constructor).

## BB-авто: планировщик блоков специализации (Aug 17 2026, uncommitted)

Поверх единой модели акцентов (специализация 1-2 мышц): **для планов > 10 недель
пользователь выбирает, что будет после блока** — возврат к балансу / продолжение тех же
мышц / другие мышцы (методика: блок 6-10 нед, затем ребаланс или смена приоритета;
Rapid Strength, T-Nation, Alpha Progression: 3 цикла фокуса + 1 без).

- **NEW в `bb-specialization.engine.ts`**: `SpecializationBlock` (weekStart/weekEnd/targets,
  [] = баланс), `SpecializationSchedule`, `buildSpecializationSchedule(focus, weak, spec,
  totalWeeks, explicit?)` — явные блоки клампятся/сортируются, пропуски и хвост заполняются
  баланс-блоками; legacy-путь без explicit = один блок 10 нед + баланс; без специализации —
  расписание неактивно (weak-эмфазис сохраняется). `specResForWeekSchedule(schedule, week)`
  — per-week цели; НЕактивное расписание отдаёт legacy weak-список (weak-планы без спец
  не сломаны). `specializationScheduleText` для rationale («нед 1-8 [chest] → нед 9-12 баланс»).
- **bb-builder**: `BBBuilderInput.specializationSchedule?`; целевой объём считается ОДНОЙ
  картой на уникальный набор целей (`rotationMapByKey`: первичная + блок-2 + баланс);
  недельный цикл берёт карту по `specResForWeekSchedule(schedule, w)`; buildSession получает
  week-aware weak/focus (в баланс-неделях weak-эмфазис снят, focus сохраняется); MRV-капы и
  volumeTargets — по первичному блоку; cross-day feeders — union целей всех блоков;
  rationale — расписание блоков. Фокус-мышца в спец-блоке = MAV (без стэкинга 1.1×1.3).
- **bb-finalize**: `BBFinalizeOptions.specializationSchedule?`; `applySpecializationPass`
  week-aware (RIR 0-1/спец-частота/икры только в неделях активного блока; неактивное
  расписание → legacy priorityMuscles на весь план).
- **cycle-to-plan**: `specializationSchedule?` в обоих входах; `specResForWeekSchedule`
  в недельных циклах (specFactor/RIR/добивка per-week); priorityMuscles = union блоков;
  rationale — расписание.
- **UI (BbAutoConstructor)**: «📅 Планирование блоков» в блоке отстающих мышц (виден при
  целях + bbWeeks > 10): длина блока 1 (6-10 нед, степпер), выбор «↩ Баланс / 🔁 Продолжить
  те же / 🎯 Другие мышцы» (+ чипы 1-2 для блока 2), строка итога «нед 1-10 [chest] → …».
  `buildSpecBlocks` прокидывается во все 3 пути сборки; сохранение/восстановление вариантов
  (`params.specBlocks` + миграция старых). Кап specTargets 1-2 при загрузке.
- Тесты: `bb-specialization-unified.test.ts` **25** (+10: расписание legacy/явные блоки/
  заполнение пропусков/клампы/no-op/specResForWeek/text; generic 12 нед блок1→блок2
  (объём переключается по неделям), same-продолжение, баланс после блока, cycle-путь).
- Проверено: tsc 0; bb+TrainingScreen_parts **1612/1612** (144 файла); полный прогон
  **5960/5964** — 4 падения пред-существующие/чужие (bb-macrocycle v7, sleep-facts,
  stretch-session, macrocycle-panel-cycle-slots).

## Ручной конструктор: внутренние шаги редактора + липкая шапка (Aug 17 2026, pushed 9e6563ff6 + 4ab04abc1)

Пошаговая структура внутри шага «2 Редактор» (поверх флоу Выбор → Редактор → Итог):
- **Липкая шапка** редактора («⋯ Ещё» / «💾 Сохранить» / «Далее») — `position: sticky; top: 0; z-index: 40`
  (inline + `.manual-constructor--editor .editor-topbar` в styles.css; скролл-контейнер `.screen.training-screen`
  с overflow auto — sticky работает). Класс `.manual-constructor__sticky-header` НЕ используется (background
  `var(--bg) !important` перекрыл бы inline-стекло).
- **Внутренние шаги** (`EditorStep` + `STANDARD_EDITOR_STEPS`/`PRO_EDITOR_STEPS` + пилюли `STEP_PILL`
  с `aria-current`, эксклюзивный рендеринг по `estep === ...`):
  - standard: `🎛 Параметры → 🗓 Недели`;
  - pro: `👤 Профиль → 🎛 Параметры → 🗓 Недели → 📊 Анализ → 🔄 Обратная связь → 🔧 Инструменты`;
  - кнопка «Далее: {следующий шаг} →» (`EDITOR_STEP_BTN_LABELS` без эмодзи), на последнем шаге — «Далее: Итог →» → родительский `onNext` (mstep 'final').
- **Распределение контента**: CTA авто-черновика + meta (название/цель/уровень/дни/недели) + заметки +
  `AutoPeriodizationPanel`(pro) → Параметры; расписание недели + `PlanSummaryTable`(showTableView) +
  `BBEditor`/`PLEditor`/`HybridPlanPanel` + `BulkApplyCard`(pro) + `PlanStatsPanel` → Недели;
  `TrainingProfileCard` + `BBConstraintsPanel` → Профиль (pro); `BbContextPanel`/`MesoHeatmap`/лаб-коррекция/
  dashboard (`RirWaveChart`+`ProgramTimeline`+`QualityScorePanel`) + анализ-панели → Анализ (pro);
  `StrengthDiaryPanel` → Обратная связь (pro); PL-блок (`PlannerToolsPanel`+`PlDeadpointsBarPathCard`) +
  техника/инструменты-секции + «📜 История правок» → Инструменты (pro). Dashboard из standard-режима убран (был план).
- Удалены: мёртвый `estep?: 'meta' | 'weeks'` из `ProgramEditorProps` (ни один вызывающий не передавал),
  `showProTools`-тоггл «▼ Открыть PRO-анализ» (заменён пилюлями) и его CSS-правила
  `.manual-constructor__pro-tools-toggle` (десктоп + мобильный media query).
- **Скролл наверх при смене шага**: `scrollEditorTop` (`.screen.training-screen` → scrollTo top 0, fallback
  scrollIntoView; try/catch + guard на отсутствие scroll API в jsdom).
- Тесты `manual-constructor-steps.test.tsx` — 5 (обновлены standard-флоу «Далее: Недели →» → «Далее: Итог →»;
  новый pro-тест: 6 пилюль + «Далее» по всем шагам до «Итог»).
- Проверено: tsc 0; TrainingScreen_parts/__tests__ **393/393** (37 файлов); manual-constructor-steps 5/5;
  pl-plan-view 3/3, manual-constructor.engine 7/7. `vite build` блокируется чужим WIP
  (`PLPlanView.tsx:973` unterminated string literal — файл другого агента, не трогается).
- Файлы других агентов не тронуты; запушены только свои: `ProgramEditorView.tsx`, `styles.css`,
  `manual-constructor-steps.test.tsx`.

## BB-авто: единая модель акцентов — специализация 1-2 отстающих мышц (Aug 17 2026, uncommitted)

Жалоба: «три одинаковых блока (фокус-группа / слабые группы / режим специализации) — пользователь
не понимает, зачем три раза выбирать одно и то же». Исследование методики (Rapid Strength,
Metal Strength, T-Nation, Alpha Progression): специализация = **1-2 отстающие мышцы** (14-24
сета/нед, 2-4 сессии, первыми в тренировке), остальные — поддерживающий объём (MEV), блок
6-10 нед. Три механизма сведены к одному.

- **NEW `bb-specialization.engine.ts`** — единый резолвер `resolveSpecialization(focusGroup,
  weakPoints, specialization)` + факторы `specializationVolumeFactor` (focus ×1.3 > spec-цель
  ×1.1 > weak ×1.2 > 1; не-цели при специализации ×0.7), `specializationEmphasisFactor`
  (generic per-session: только emphasis, перераспределение уже в целевом объёме),
  `specializationMrvFactor` (кап: focus ×1.3 / weak ×1.2), `isSpecializationWeak/Focus`,
  `canonicalizeMuscles`.
- **Стэкинг убит**: focus+weak больше не дают 1.2×1.3=1.56 (фокус выигрывает); MRV-кап
  тоже без стэкинга. **Top-2 специализации — канонические** (раньше ['shoulders','chest'] →
  ['shoulders','delt_front'] — один регион занимал 2 слота; `expandWeakForSpecialization`
  удалён). **Specialization без слабых групп — no-op** (раньше generic переводил ВСЕ мышцы
  в special-режим, cycle резал все до ×0.7). **Фокус-мышца при специализации не режется**
  (раньше cycle давал 0.7×1.3=0.91). Generic «остальные» при специализации: MEV×1.5 → **MEV**
  (методика: поддерживающий объём; финализатор MEV-guard страхует от недобора).
- **Уровень/стаж/PED/recovery/nutrition/lab/goal-множители НЕ тронуты** — применяются
  ПОВЕРХ факторов резолвера (bb-builder:2291-2330, 2352-2361; cycle-to-plan setMult).
- **UI (BbAutoConstructor)**: один блок «🎯 Отстающие мышцы (специализация, 1-2)» — чипы
  как в старом фокусе, максимум 2 выбора (остальные disabled); в шаге 1 (generic) и в
  «Доп. настройке программы» (cycle/library). Селектор «Фокус-группа», блок «Слабые группы»
  и чекбокс «Режим специализации» удалены. `specializationMode = specTargets.length > 0`
  (авто), `weakPoints = specTargets` (зеркало), `focusGroup: ''` во все пути. Бейджи плана:
  «🔥 Отстающая» (⭐ Специализация убран). Миграция вариантов: `focusGroup` → targets[0],
  `specialization+weakPoints` → targets.
- Тесты: NEW `bb-specialization-unified.test.ts` (15: резолвер, канонический top-2, no-op
  без слабых, фокус не режется, generic/cycle инварианты, enhanced back ≥18 не сломан);
  обновлён `bb-back-quality.integration.test.ts` (3: без focusGroup).
- Проверено: tsc 0; bb-область **1201/1201** (107 файлов); TrainingScreen_parts **401/401**;
  полный прогон **5950/5954** — 4 падения пред-существующие/чужие (bb-macrocycle v7,
  sleep-facts, stretch-session, macrocycle-panel-cycle-slots — задокументированы ранее).

## Механизм-модель рисков: RSS-агрегация + якорные floors + верификация + эритроцитоз (Aug 17 2026, pushed d777f453f)

Жалоба: «общий риск по системе = сумма процентов механизмов — 7%×3 даёт 21%, это неверно».
Медицинское решение главного врача: **субаддитивная агрегация (евклидова норма) + якорные
лабораторные пороги + честная семантика «индекс риска»**. Движок `risk-engine-tz-spec.ts`
(калькулятор поддержки + вкладка «Риски» — единый вход, цифры идентичны).

- **RSS вместо суммы/union**: проценты механизмов — баллы тяжести (mechRaw/maxRaw), НЕ
  вероятности, и механизмы коррелированы одним препаратом → вероятностная арифметика
  (union = 1−Π(1−pᵢ)) неприменима. `rssPct` (√(Σpᵢ²)) — длина вектора повреждения:
  7+7+7 → 12.1 (не 21), 60 → 60 (доминанта сохраняется), 50+50 → 70.7, 30+30+30 → 52.
  **Общий индекс = среднее по системам** (как было изначально; max по органам отклонён —
  «тупо наибольший» искажает). Timeline — среднее. `maxRaw`/формулы механизмов/поддержка
  Π(1−k) не тронуты.
- **Парные синергии** (`applyMechanismSynergies`, литературные, s=0.2-0.25): cv2×cv4
  (атеротромбоз), cv3×cv1 (гипертензивное сердце), hem1×cv4 (гипервязкость), liv1×liv2,
  ren1×ren3 (KDIGO), cns1×cns2. Вместо произвольного глобального k=0.3.
- **Якорные floors** (`clinicalFloorsForLabs`) — лабораторные пороги из руководств поднимают
  риск системы НЕЗАВИСИМО от таргетов препарата (раньше eGFR 25 на препарате без ренального
  таргета давал 0): HCT≥54→гемато≥50, LDL≥4.9→кардио≥50, eGFR<30→ренальный≥75 / <60→≥50,
  UACR>300→≥50, ALT/AST>200→печень≥50, K<3.0→кардио≥50, LH+FSH<0.5→репродуктивный≥50,
  PRL>50→ЦНС≥50, GLU<2.8→ЦНС≥50, HOMA>5→гемато≥25. Floor поднимает и категорию.
- **Учёт без анализов**: floors не срабатывают (доказать «не ниже» без данных нельзя), но
  гарантированные эффекты ААС (baseDefaults: супрессия HPTA, дислипидемия, эритроцитоз) и
  штраф U_i остаются; **per-system верификация** (`organ.verification` — доля механизмов с
  релевантными маркерами, `overallVerification`) + UI-бейджи «⚠ не верифицировано — оценка
  по фармакологии, сдайте анализы» (TzRiskCard, RiskSpecMethod, CalcSystemPanel).
- **Эритроцитоз (hem1) — «не так страшно» честными методами**:
  - фибринолитическое трио (натто+серра+бромелайн) теперь дополнительно ×0.90 на hem1
    (гипервязкость — последствие эритроцитоза; паритет tz-bridge-boosters), сверх базы курса
    (гидратация+кардио+электролиты ×0.90) и индивидуальных k (omega3 0.15, aspirin 0.20 и др.);
  - **процедуры как k-записи**: NEW `PROCEDURE_DB` — эритроцитаферез (hem1 k=0.45) и
    флеботомия (k=0.30, «450 мл → ↓HCT 3-5%»); процедуры из `rec.procedures` (HCT≥52,
    doctorOnly) прокидываются в tz-вход во всех 3 путях (support-plan/engine.ts,
    Calc.mapper tzFinalRisk + doctor report, вкладка Риски через he_support_risk.procedures);
    **процедура пробивает якорь на afterPercent** (меняет состояние: «до процедуры high,
    после — ниже»), raw остаётся на якоре;
  - **дозозависимый hem1**: при дозе ≤200 мг/нед (TRT) гарантированный минимум m_i=1 вместо 2
    (Endocrine Society: клинически значимая полицитемия — при супрафизиологических дозах);
  - числа сценария (тест 500, без анализов): гемато 34.5% → база 28.8% → +фибринолитики 26.1%
    → полный стек 23.2% (hem1 31→20%); TRT 200 → гемато 11.7%;
  - фикс отображения m_i: кап 3 (показывал m=4 — за шкалой 0-3).
- **Вкладка «Риски» = калькулятор**: живое обновление поддержки (storage+focus), процедуры
  из `he_support_risk.procedures`, резолв legacy-id через `resolvePedAlias`, подсказка
  «Поддержка не выбрана» при пустом списке (иначе «с поддержкой» = «без» вводит в заблуждение).
  Проверено E2E: тест 1000+трен 500, HCT55/LDL5/eGFR45/ALT250 — калькулятор 62→35, вкладка
  59→34 (остаточные 3 пункта — nutrition/training из профиля в fallback; snapshot идентичен).
- **Семантика**: UI называет результат «индекс риска», не «вероятность»; floors показываются
  как «⚓ HCT ≥ 54% — эритроцитоз (порог флеботомии)»; под-риски в CalcSystemPanel считаются
  RSS (не суммой чипов). Бейджи верификации/floors во ВСЕХ точках отображения:
  TzRiskCard, RiskSpecMethod, CalcSystemPanel, LabsTzRiskTab, инлайн-секция LabsScreen,
  текстовый экспорт Calc.mapper («[не верифицировано]», «⚓ …»).
- Тесты: NEW `tz-spec-union-floors.test.ts` (34: rss-свойства, синергии, floors, сценарные
  кейсы — трен+HCT55→гемато high, оксандролон+ALT250→печень high, eGFR25 без таргета→ренальный
  very_high, без анализов→floors нет+верификация 0; hem1: трио/процедуры пробивают якорь/TRT
  доза/полный стек/процедуры не трогают другие системы; фармакология: тестостероны/нандролоны/
  тренболоны/оралы/SARMs/MGF дают риск, восстановительные пептиды — 0 by design);
  обновлён `tz-spec-risk-invariants.test.ts`
  (система ≤ суммы механизмов, ≥ максимума — вместо «сумма сходится»).
- Проверено: tsc 0 по моим файлам; затронутые области 363/363 (tz-spec-union-floors 34,
  invariants 6, support-calc-ped-e2e 13, support-calc-e2e 12, ped-catalog-audit 106,
  support-calc-audit 42, pharmacology-mandatory 16, tz-bridge-boosters-tiered 35,
  support-new-substances 38, support-profile-autopull 15, ped-risk-matrix 37, calc-UI 9,
  hydrate-crash 2); полный прогон 5926/5930 — 4 падения чужие/пред-существующие
  (bb-macrocycle v7, sleep-facts, stretch-session, macrocycle-panel-cycle-slots —
  чужой WIP, задокументированы ранее).

## Кардио-конструктор: структуризация вкладок + единый UI-слой (Aug 17 2026, pushed c7f0ab8aa)

Структуризация всех вкладок кардио-конструктора: чёткая навигация по секциям, групповые
заголовки, единый стиль. **Только UI — движок не менялся.**

- **NEW `CardioUI.tsx`** — единый UI-слой: стили (CARD/CARD_ACCENT/ROW/LABEL/HINT/BTN/BTN_PRIMARY/
  BTN_DANGER/BTN_SMALL/INPUT/CHIP/CHIP_ACTIVE/PHASE_COLOR) + компоненты (SectionCard, StatTile,
  Stepper, ChipToggle, NoteList, InfoBanner, SectionNav, GroupHeading). На него переведены все
  14 кардио-компонентов.
- **Параметры**: якорная навигация (⚡ Старт / 🎯 Цель / 👤 Параметры / 🦵 Дни ног / 📊 Факторы /
  🧩 Фазы / 👁 Итог) + GroupHeading с описаниями + акцентная карточка «Итог» (метрики + баннеры).
- **Старты**: GroupHeading + SectionCard + InfoBanner + ChipToggle.
- **Предпросмотр**: общий PHASE_COLOR, единый стиль (якорная навигация по 7 секциям была).
- **Управление**: навигация (🔗 Интеграции / 📤 Экспорт / 🛠 Неделя / 📚 Библиотека / 📸 Сценарии).
- **Дневник**: группы «📅 Сегодня / ⚡ Сессия / 📊 Контроль цикла / 🔄 Автоматизация и зоны / 📓 Журнал».
- Конструктор недели, LinkCard, DayCard, ProgressCard, AutoTunePanel, DiaryPanel, Timer, UserCard,
  VolumeChart — единые стили (кнопки/карточки/чипы/инпуты из CardioUI).
- Проверено: 71/71 тестов (constructor 14, user-flow 17, pro-panels 30, link-card 10), tsc 0.

## Отображение фишек ББ-плана: дроп-сеты/суперсеты/FST-7/GVT/DUP в UI (Aug 16 2026, pushed)

Жалоба: «ББ-авто не видно дроп-сетов, FST и других фишек — нужна пометка ДРОП СЕТ/СПЛИТ, подходы расписать конкретно». Анализ: фишки **генерируются движком** (autoAssignIntensityTechniques/applyIntensityTechniqueToExercise/markAntagonistSupersets/applyVolumeScheme/DUP), но **не выживают/не видны**: (1) расширенные мини-сеты техник обрезаются `syncBBPlanSetShape` (инвариант `sets === workSets.length`, валидатор `sets_mismatch`); (2) план-шаг показывает плоскую сводку `sets×reps`; (3) метки спрятаны в свёрнутом `<details>`; (4) «💡 Техника» читала EXERCISE_CATALOG, а не применённую.

**Решение**: дроп-мини-сеты — ТОЛЬКО отображение (render-only, как buildWarmup), учёт/капы MRV НЕ трогаем. Всё — UI-слой, движок без изменений.

- NEW `src/ui/screens/TrainingScreen_parts/bb-technique-display.ts` — чистые хелперы (UI-only, не меняют workSets/e.sets): `lastSetTechnique`/`techniqueLabel` (обе системы имён: drop_set/dropset и т.д.); `techniqueChainParts(ex, editedWeight?)` — цепочки: дроп `reps×w → 6×w×0.8 → 4×w×0.64`, rest-pause (мини-сеты через 15с), myo-reps (активация + 4×4×5с), 21s (7+7+7), негативы (темп 4-2-1-0), pause_rep, механический дроп, rest_pause_cluster; `volumeSchemeLabel` (FST-7/GVT 10×10/8×8 Gironda из comment), `supersetLabel`, `exerciseFeatureBadges(ex, dupMode)`, `workSetsBreakdown`/`planSetsBreakdown` (по-сетовая разбивка с учётом inline-правки).
- MOD `BbAutoConstructor.tsx`: план-шаг — бейджи фишек на карточке упражнения (💥 техника · 🔗 Суперсет с «X» · 📦 FST-7/GVT/8×8 · 🌊 DUP) + блок «📋 Подходы» с по-сетовой разбивкой и дроп-цепочкой (пересчитывается от `exerciseEdits`); «💡 Техника выполнения» — применённая (каталог fallback); «Редактор упражнений» (Коррекция) — те же бейджи + разбивка; PDF — метки + цепочка в «Вес/Reps»; CSV — колонка «Техника/Схема»; проброс `technique: ws.technique` в `targetSets` (обе конвертации).
- MOD `SessionPlayer.tsx`: `PlayerSet += technique?` (UI-тип); бейдж 💥 в «Детали дня» и на ряду упражнения + подсказка цепочки на последнем сете (title).
- NEW `bb-technique-display.test.tsx` — 18 тестов: цепочки всех техник (веса ×0.8/×0.64 с округлением 0.1), детект схем/суперсета/DUP, inline-правка веса, SSR SessionPlayer (бейдж виден / без техники нет).

Проверено: tsc 0; bb-technique-display 18/18; bb-auto-smoke 5/5; mindset-tab 82/82; diary-hub-tabs 12/12; SRCBBScreen 79/80; движок BB 1185/1186; полный прогон 5833/5869 — падения пред-существующие/чужие (bb-training-recommendations vitest-каталог; macrocycle-panel-cycle-slots; cardio-constructor/user-flow — `totalWeeks` в чужом CardioParamsStep WIP; bb-macrocycle v7; course-sync/profile флейки). Учёт/капы MRV байт-в-байт прежние (движок/валидатор не тронуты).

## Кардио-конструктор: полное выполнение плана до «хорошего уровня» (Aug 16 2026, uncommitted)

Полный цикл доработки по `docs/CARDIO-GOOD-LEVEL-PLAN.md` (анализ + 6 этапов). **282 теста в области зелёные, tsc 0 по моим файлам** (в проекте 6 чужих ошибок: bb-technique-display/BbAutoConstructor — параллельный агент). Файлы других агентов не тронуты (TrainingDiaryHub, IndividualPlanContext, SRCBBScreen, MacrocyclePanel, annual-training — чужой WIP).

### Этап 1 — P1-баги (данные не врут)
- `CardioLinkCard` «Сегодня» теперь передаёт `c.startDate` (раньше неделя съезжала для старых циклов).
- `CardioDiaryPanel` adherence к ТЕКУЩЕЙ неделе через `cardioWeekForDate` (раньше всегда последняя неделя цикла).
- **`recalcSessionKcal`** — единая точка пересчёта ккал: `adaptCardioToStrength`/`autoTuneCardioCycle`/`applyPL/BBCardioTaper`/`bumpCardioZone2Volume` при изменении durationMin теперь пересчитывают kcalPerSession (минуты и ккал не расходятся); `cycleBodyWeight` — вес цикла из config (bump больше не хардкодит 80).
- **`assignSessionDays` + referenceIso** — стартовый день раскладки от `startDate` цикла (было от дня сборки).

### Этап 2 — ядро исполнения
- **План vs факт**: `cardioWeekFact`/`cardioCycleCompliance` (движок) + `CardioVolumeChart` — факт-бары из журнала, «план vs факт: N% · сессий», выполнение прошедших недель (будущее не штрафуется); график подключён в `CardioDiaryStep` с живым журналом.
- **Reschedule**: `rescheduleCardioSession(cycle, dateIso)` — перенос плановой сессии на ближайший свободный день недели (no-op без сессии/свободного дня); кнопка «↗» в `CardioSessionTimer`; `CardioDiaryStep` держит локальную копию цикла + undo-версию.
- **CardioDayCard** (NEW) — кардио-слой дня: план на сегодня, факт из журнала, **нагрузка дня (сила + кардио)** через `cardioDayLoad` (кардио мин×RPE/10 + sRPE×мин силы); рендерится в DiaryStep и доступен из конструктора.
- **`CardioLinkCard`**: «⏭ Следующая сессия» + «▶ Старт» (открывает дневник) + «🔥 Нагрузка дня».

### Этап 3 — питание
- **`cardioToNutritionPayload(cycle, log, today?)`** — расход ккал/нед + факт за сегодня (чистая функция).
- **Handler `'cardio'` в planner-bridge-handlers** (kind был объявлен, но мёртв): пишет `he_cardio_kcal_note` ({cycleId, avgKcalPerWeek, …}) + копирует текст в буфер + toast; кнопка «🍽 В питание» в `CardioManageStep` (экспорт-блок).

### Этап 4 — наука тренировки
- **MISS (Z3) в build-фазах** cut/recomp/health: чередование с HIIT по чётности недели (alt-записи в RampProfile); делод убирает и HIIT, и MISS; mass/maintenance без изменений.
- **`cardioHrCompliance(cycle, log, {days})`** — факт-ЧСС vs целевые зоны плана (в/над/под зоной, % попадания, среднее отклонение, совет); блок «🎯 Пульс по факту» в `CardioAutoTunePanel`.
- **Недельная авто-прогрессия** в `autoTuneCardioCycle`: 2 последние прошедшие недели «лёгкие» (pct≥1, RPE<6) → будущим рабочим +10%; 2 «тяжёлые» (RPE≥8 или <50%) → −10%; прошлое не меняется. **База окон недель — `cycle.startDate`** (была referenceIso — UI передавал startDate, из-за чего «текущая неделя» была всегда 1); UI больше не передаёт referenceIso (по умолчанию — сегодня).

### Этап 5 — персонализация и интеграции
- **Авто-факторы профиля** в конструкторе: сон/стресс/HRV/PED/суставы включаются по умолчанию при обнаружении в профиле (сохранённый выбор мастера приоритетнее).
- **Авто-legDays**: `legDaysFromBBPlan(plan)` — дни недели 1 с мышцами ног из сохранённого ББ-плана; LinkCard «Пересчитать под ACWR» передаёт их в `adaptCardioToStrength` (flash «дней ног: N»); бейдж «🦵 Дней ног в ББ-плане: N» в шапке конструктора.
- **Старт-контроль**: строка «🏁 Старт через N нед (taper снижает объём — HIIT уже убран; вес…)» в `CardioDiaryStep` (ближайший taper/peak + последний вес из журнала).
- Подпись «🗓 Привязан к годовому плану» в печатной сводке цикла (annual-training блоки не трогал — чужой WIP).

### Этап 6 — pro
- **`lthrZones(lthr)`** (Friel 2017) + поле «LTHR (тест 30′)» в AutoTunePanel (зоны по LTHR приоритетнее Karvonen).
- **`runningVdot(testKm, testMin)`** (Daniels 2013) — VDOT + 5 целевых темпов мин/км; блок «🏃 VDOT» в AutoTunePanel.
- **`buildCardioTcx(cycle, reference?)`** — экспорт .tcx (Garmin TC) по дням; кнопка «📤 .tcx» в ManageStep.

### Тесты (+37: 245 → 282)
- `cardio-cycle.test.ts` 145 (было 122): ккал-консистентность (7), reschedule (4), assignSessionDays startDate (3), MISS (3), недельная прогрессия (2), payload (2), legDays (2), tcx/LTHR/vdot (4), обновлены autoTune-тесты (startDate-база) и «сушка» (MISS).
- `cardio-diary.test.ts` 23 (было 15): план vs факт (3), день/нагрузка (3), hr-compliance (2).
- `cardio-pro-panels.test.tsx` 30 (было 19): план vs факт график (3), reschedule кнопка (1), DiaryPanel неделя (2), DayCard (3), старт-контроль (2).
- `cardio-link-card.test.tsx` 10 (было 7): startDate «Сегодня», следующая сессия + «▶ Старт», факт/нагрузка.
- `planner-bridge-handlers.test.ts` 23 (было 17): cardio handler (3).
- Проверено: 282/282 в cardio-области, tsc 0 по моим файлам. Чужой параллельный WIP (bb-technique-display, BbAutoConstructor, annual-training, MacrocyclePanel, ExerciseLab) не тронут.

## Диагностика движения: раунд 4 — MRV-кап починён, асимметрия, VBT-ввод, e1RM-тренд (Aug 16 2026, uncommitted)

Поверх раунда 3 (74195a58b). **Ни один пункт не перестраивает исходный цикл** — все изменения аддитивные/отображение:

- **MRV-кап починен для legs/arms/core** (был no-op): `groupOfExercise` возвращает `trueMuscleOf` (quads/biceps/abs), а слабые группы/диагностика сравнивают с ключами legs/arms/core → weeklySets всегда 0 → кап не срабатывал. Добавлен `plGroupOfMuscle` (muscle → PL-группа) в `weakSetsThisWeek` и `weeklyGroupSets`. **Бюджет составных групп = СУММА MRV мышц** (`MRV_BUDGET_MUSCLES`: legs=quads+hams+glutes+calves, arms=biceps+triceps+forearms, core=abs; единый `groupMrvBudgetFor`) — для legs отдельный quads-MRV (20) душил бы сразу (PL-цикл сам ног-тяжёлый ~30 сетов); суммарный бюджет (70) даёт кап при реальном переборе. Chest/back/shoulders — без изменений.
- **Асимметрия сторон**: при отклонении `asymmetric` — чипы «Левая/Правая» (state `asymSide`, персистентность `he_pl_diagnostic_card_v1`), строка в диагнозе «Слабее: N сторона → унилатеральная работа».
- **VBT: ручной ввод скоростей** (по уточнению — поля ввода, не парсинг дневника): блок «3.5 · ⚡ VBT» в карточке — лучший/последний повтор (м/с) + вес (кг); `diagnoseVelocity` (NEW в vbt.engine): потеря скорости → зона (`velocityLossZone`) → при превышении порога (20%) вероятная фаза срыва (максимальный момент) + e1RM по скорости (`estimate1RMFromVelocity`, pulldown→row, incline_press→bench) + **корректирующие упражнения фазы** (анализ + «➕ Добавить коррекции VBT в план»). План/цикл не меняется.
- **e1RM-тренд в `StickingPointAnalysisCard`**: `priorMax` (лучший e1RM за 28–56 дней) → строка «e1RM-тренд (28 дн): ▼/▲/→ X% (priorMax кг)» с цветом (≤−5% красный, ≤+1% жёлтый, рост зелёный).

### Тесты (раунд 4: +11)
- `vbt.test.ts` (+6): diagnoseVelocity (потеря→фаза, без фазы, e1RM по весу, без веса, pulldown/incline маппинг, некорректные скорости).
- `pl-deadpoints-barpath-card.test.tsx` (+3): асимметрия чипы+строка, VBT ввод→потеря/фаза/коррекции, некорректные скорости → подсказка — **25/25**.
- `sticking-point-analysis-card.test.tsx` (+2): e1RM-тренд ▼ −6%, ▲ +11% — **9/9**.
- Затронутые области **883/885** — 2 падения чужие: `cardio-cycle.test.ts` (cardio.engine — чужой WIP, падает изолированно) и `macrocycle-panel-cycle-slots` A5 «По дневнику» (сломан чужими коммитами 874e39cfd/443c30bd0…, в round-3 проходил).
- `tsc` чист по моим файлам; осталось 3 ошибки в чужом `bb-show-coach.engine.ts` (NEW чужой файл, не трогаю) + 4 в `diary-cards.tsx`.

---

## Диагностика движения: раунд 3 — полный StickingPointAnalysisCard + MRV/notes инъекции (Aug 16 2026, uncommitted)

Поверх раунда 2 (5f921b43b):

- **`StickingPointAnalysisCard` — полный инструмент по дневнику** (переписан):
  - канонический `phaseForReps` (была своя эвристика reps≤3→bottom, противоречила карточке) — расхождение из раунда A–E закрыто;
  - **все 7 движений** (было 3: bench/squat/deadlift) — вкладки жим стоя/тяга/пулдаун/наклонная;
  - **sumo-детекция**: имя упражнения с «сумо» → фазы `sumo_start`/`sumo_lockout` + блок «🤸 Сумо-тяга: N тяжёлых подходов»;
  - `epley1RM` вместо `weight*(1+reps/30)`; удалена мёртвая ветка `!!s.failed` (поля нет в WorkoutLog);
  - расширены `PHASE_LABELS` (сумо/ohp/row/pd/inc) и `mapM` (+приводящие→legs);
  - reps ≥ 6 → фаза не определяется (тяжёлый подход учитывается, фазы нет).
- **Sumo-подсказка в `PlDeadpointsBarPathCard.diaryHint`**: тяжёлые подходы сумо считаются отдельно (`sumoHard`/`sumoPhase`), блок «🤸 Сумо: N тяжёлых подходов — вероятная фаза …».
- **`injectDiagnosticExercises` — полный набор правил** (паритет со слабыми группами):
  - per-day dedup (повтор ассистента в РАЗНЫХ днях — тяжёлый+памп — намеренная фича, НЕ week-dedup);
  - day cap ≤ 10;
  - **MRV-бюджет группы** (`getVolumeLandmarks` × PED/recovery × ACWR × авторег) — при переборе skip с note;
  - **notes в `progressionRationale`**: `🔥 Диагностика: … → день N (3×6 @45% RIR 2) · группа … ≤ MRV …` и `⚠ … не добавлен — объём … > MRV …` (канал `weakNotes`).
- `tsc` чист по моим файлам; **4 ошибки в чужом `diary-cards.tsx`** (дубль `loadCheckins`/`loadMobilityCheckins` — закоммиченный WIP дневникового агента, не трогаю).

### Тесты (раунд 3: +8)
- NEW `sticking-point-analysis-card.test.tsx` (7): пустое состояние, присед/жим каноническая фаза, reps≥6 без фазы, 7 движений, сумо, «Слабые мышцы → планировщик» (groups legs).
- `pl-deadpoints-barpath-card.test.tsx` (+1): сумо-подсказка — **22/22**.
- `pl-auto-key-tests-coverage.test.ts` (+2): 4.26 per-day dedup, 4.27 MRV-бюджет с note — **27/27**.
- Затронутые области **838/838** (pro + lms + карточки + bridge + SRCBBScreen_parts).

---

## Диагностика движения: раунд 2 — A3/sumo/лимит/parity/e1RM-детекция (Aug 16 2026, uncommitted)

Поверх раунда A–E (d080442b):

- **A3 — углы для всех 7 движений**: `STICKING_POINTS` в lift-diagnostics пополнен ohp/row/pulldown/incline_press (углы локтя/плеча/лопатки, слабые мышцы, коррекции из weakpoint-pl). `diagnoseLift` больше не возвращает null для 4 движений; `analyzeStickingCorrections` даёт непустые коррекции везде; fallback-текст карточки обновлён.
- **Sumo-тяга**: `WeakPoint` += `sumo_start` (0-20°, срыв: ягодицы/приводящие) и `sumo_lockout` (70-180°, замыкание бёдер) — weakpoint-pl (DIAGNOSIS + WEAK_POINTS_BY_LIFT.deadlift = 5 фаз), STICKING_POINTS, лейблы в карточке (PHASE_RU/LIFT_PHASES) и SRCBBScreen (PL_WEAKPOINT_LABELS — 2 строки).
- **Лимит сессии**: `injectDiagnosticExercises` — day cap 10 упражнений (паритет со слабыми группами, тест 4.25).
- **Parity протокола**: `diagnosticGroupForExercise` приведён к ТОЧНОМУ резолву карточки (PL-группы каталога → LMS_EXERCISES, БЕЗ общего каталога) и паттерн spec резолвится pool-exact — `diagnosticProtocolFromCycle` экспортирован; NEW `diagnostic-protocol-parity.test.ts` (3 теста) гарантирует «показанный протокол = вписанный» для всех фаз/отклонений.
- **NEW `weak-muscle-detection.engine.ts`**: `detectWeakMusclesByE1rm(sessions)` — per-group тренд e1RM (Epley) за два 28-дневных окна: −5% → `weak`, рост ≤1% при ≥2 сессиях → `plateau`; `groupOfExerciseName` (алиасы, arms перед chest — «французский жим» не уходит в грудь). UI карточки: блок «📊 Дневник: e1RM-тренд» с кнопкой «➕ в слабые мышцы» (подсказка, не авто-выбор).

### Тесты (раунд 2)
- NEW `weak-muscle-detection.test.ts` (11), NEW `diagnostic-protocol-parity.test.ts` (3).
- Обновлены: `lift-diagnostics.test.ts` (16: 7 движений + сумо), `weakpoint-pl.test.ts` (12: deadlift 5 фаз), `rationale-audit.test.ts` (все 7 движений со sticking-коррекциями), `pl-diagnostics-full-audit.test.ts` (то же), `pl-deadpoints-barpath-card.test.tsx` (жим стоя с углами), `pl-auto-key-tests-coverage.test.ts` (25: +4.25 day cap).
- Проверено: tsc 0; затронутые области **816/816**; полный прогон **5712/5715** — 3 падения пред-существующие/не мои (bb-macrocycle v7 чужого агента, bb-training-recommendations каталог-рантайм, cardio-user-flow clipboard-флейк параллельного прогона — изолированно 17/17).

---

## Диагностика движения: полный раунд A–E (Aug 16 2026, uncommitted)

Полный анализ «слабые мышцы → слабые точки → мёртвые точки → движение штанги» + доработки по плану A–E. Слои: `weakpoint-pl.ts` (24 диагноза 7 движений) → `lift-diagnostics.engine.ts` (углы/биомеханика для bench/squat/deadlift + bar-path 5 отклонений) → `lift-assistance.engine.ts` (пулы muscle/weak/sticking/bar, топ-1 ⭐, `protocolFromCycle`) → инъекция в план (`injectPLWeakPoints`/`injectDiagnosticExercises` в lms-builder) → UI (`PlDeadpointsBarPathCard` — единый калькулятор; `StickingPointAnalysisCard` — по дневнику).

### Исправлено (этот раунд)
- **A1**: удалён мёртвый `sticking_mid` из типа `WeakPoint` (weakpoint-pl) + лейблы в `PlDeadpointsBarPathCard` и `SRCBBScreen.tsx` (PL_WEAKPOINT_LABELS — 1 строка, файл был чист от WIP).
- **A2**: удалён мёртвый дубль `STICKING_POINTS` (англ., 10 записей) + `getStickingPoint/getStickingPointFixes/getAllStickingPoints` из `block-designer.engine.ts` — импортов в проекте не было (файл вообще нигде не импортируется).
- **B**: канонический `phaseForReps(reps, lift)` в `lift-diagnostics.engine` (reps ≤2 → фаза макс. момента, 3–5 → mid/`*_mid`, ≥6 → null «неопределено») — ЕДИНЫЙ для карточек. `PlDeadpointsBarPathCard.diaryHint` переведён на него (раньше маппил reps≤3 → lockout, что противоречило StickingPointAnalysisCard: reps≤3 → bottom). **`StickingPointAnalysisCard.tsx` НЕ трогался** (зона дневникового агента) — расхождение с его старой эвристикой задокументировано здесь; владелец может перейти на `phaseForReps`.
- **C**: `injectDiagnosticExercises` получил `template` и считает протокол из раскладки цикла ТЕМ ЖЕ алгоритмом, что `protocolFromCycle` в карточке (`diagnosticGroupForExercise` + `diagnosticProtocolFromCycle`, fallback 3×10@60% RIR2) — **показанный в UI протокол = вписанный в план** (было фикс 3×10@60% RIR3). Группа упражнения резолвится в PL-группу (было всегда 'accessory').
- **D**: `weakpointsHandler` (planner-bridge-handlers) теперь принимает `plWeakPoints` и `diagnosticExerciseMap/diagnosticDayMap` — упражнения попадают в неделю 1 **custom-ПЛ** программы (тяжёлый 3×8 по pct диагноза + памп 3×12@60% RIR3; диагностические — 3×10@60% RIR2, дни из dayMap). Программы из каталога циклов (без customWeeks) НЕ конвертируются — toast «пропущены». `planner-bridge.ts` — doc-комментарий kind.
- **E**: персистентность карточки — ключ `he_pl_diagnostic_card_v1` (lift/phase/issues/planWeakPoints/weakMuscleGroups/weakMuscleSubs/selected/days), валидация формы при загрузке, битые данные → дефолт.

### Тесты (этот раунд: +11 новых, 2 обновлены)
- `lift-diagnostics.test.ts` (+5): каноническая эвристика (макс. момент/середина/null/некорректные reps/неизвестное движение) — **15/15**.
- `pl-deadpoints-barpath-card.test.tsx` (+3): diaryHint по канонической эвристике (reps≥6 без подсказки), персистентность remount, битый storage — **21/21** (afterEach чистит `he_pl_diagnostic_card_v1`).
- `planner-bridge-handlers.test.ts` (+3): диагностика → custom-ПЛ неделя 1 (+ дни), программа из каталога → пропуск с предупреждением, без диагностики — прежнее поведение — **20/20**.
- `pl-auto-key-tests-coverage.test.ts` (+1): 4.24 протокол из раскладки цикла — **24/24**.

### Проверено
- `tsc --noEmit` — **0 ошибок по проекту**.
- Полный прогон vitest: **5697/5699** — падают только 2 не связанных с этой работой: `bb-macrocycle.test.ts` (чужой v7-формат сериализации) и `bb-training-recommendations.test.ts` (`weeklySetsByMuscle` по каталогу — падает изолированно, файлы движка/каталога не трогались; вероятно, vitest-рантайм EXERCISE_CATALOG — известная проблема с 16 упражнениями).
- Затронутые области: lms+pro+карточка+bridge **702/702**; SRCBBScreen_parts 73/73; annual-training 37/37.
- `vite build` не запускался (чужие WIP в worktree: ExerciseLab*/LoadManagementHub/TrainingSafetyHub/cardio.engine).

---

## Годовой план по конструкторам (Aug 16 2026, uncommitted)

Целевая модель: **годовой план отвечает за КАЛЕНДАРЬ и КОМПОЗИЦИЮ, а не за генерацию тренировок** — каждый блок года собирается СВОИМ конструктором (ПЛ-блоки — СРЦ-циклами, ББ-блоки — ББ-авто, ручные — в редакторе), taper/peak накладываются внутри блока.

### Движок `src/engines/annual-training/` (NEW, 4 файла)
- **`annual-training.types.ts`**: `AnnualTrainingPlan` (id/version/totalWeeks/direction pl|bb|hybrid|mixed/macroRef/blocks/status draft|partial|built|stale), `AnnualBlockState` (ref + config + status unbuilt|built|stale|error + result + builtAt + error), `AnnualBlockRef` (blockKey/blockIndex/kind PL|BB|MANUAL/phase/startWeek/weeks/competitionId/cycleId), `AnnualBlockConfig` (cycleId/daysPerWeek/splitPattern/goal/level/trainingFocus/weakPoints/equipment/focusGroup/specialization/taper{enabled,weeks}/peakWeek/peakConfig/templateFromBlockKey), `AnnualBlockBuildResult` (weeks UserWeek[]/program/bbPlan/warnings/taperApplied/peakApplied/configHash), `AnnualBuildOptions` (+`sync?: boolean` — false: собирать блоки «как есть» без синхронизации).
- **`block-builders.engine.ts`**: `stableHash` (FNV-1a), `macroBlockKey(block, idx)` (layout-поля + cycleId — изменение → новый ключ → stale), `annualPlanFromMacro(macro)` (kind: SRC→PL, BB→BB; BBMacrocycle→все BB), `syncAnnualPlan(plan, macro)` (**изменение layout/конфига НЕ перезаписывает результат — помечает 'stale'**; match по key, fallback по index), `buildAnnualBlock` (dispatch: PL→`cycleTemplateToFullProgram`→UserWeek+program.pl; BB→`autodraftBBPlan` (кап 16 нед → зацикливание), пик-неделя через `applyPeakWeekOverlayToBBPlan` на last week блока; MANUAL→скелет фаз `makeEmptySessionsForWeek` + копия структуры из `templateFromBlockKey`), `buildAnnualPlan` (sync → сборка только unbuilt/stale/error, `rebuild:'all'` — все; ошибки изолированы), `applyBlockPhaseToWeeks` (BB_PHASE_MOD/PL_PHASE_MOD: объём×mult, RIR в диапазон, transition→deload; **фаза применяется ОДИН раз на уровне недель** — без двойного применения), `applyBlockTaperToWeeks` (финальная ×0.45/RIR+2, предпоследние ×0.65/RIR+1; идемпотентно по метке `[annual-taper:N]`), `composeAnnualProgram` (только BB→bb-программа; PL+BB→hybrid c plRef+bbWeeks; только PL→первый PL-блок со сводкой; meta.notes = сводка + «не собран»-предупреждения), `mergeBlockWeeks` (перенумерация 1..totalWeeks).
- **`annual-training-storage.ts`**: ключ `he_annual_training_plan_v1`; `save/load/removeAnnualTrainingPlan` (валидация формы `isAnnualTrainingPlanShape`), `migrateAnnualPlanFromMacroStorage` (he_bb_macro приоритетнее he_pl_macro; существующий годовой план приоритетнее макро).
- `macrocycle.engine.ts` НЕ изменялся (сериализация v7/v8 — зона другого агента); связь блоков — производный `blockKey`.

### UI (MacrocyclePanel.tsx)
- Карточка **«🧩 Сборка года по конструкторам»** (после действий года, перед «Итог года»): кнопки «📦 Собрать весь год» / «⚙️ Собрать блок» (по `selectedBlockIdx`) / «📥 В ручной режим» (composeAnnualProgram → `applyToPlanner kind 'program'`); список блоков с иконками ✅/⚠/❌, kind (ПЛ/ББ/✍), «изменился: пересоберите» для stale; клик по строке выбирает блок на таймлайне.
- **⚙️ Настройки блока** (по клику в списке): чипы конструктора (ПЛ СРЦ/ББ-авто/✍ ручной → `setAnnualBlockKind`, блок → stale, результат сохраняется); ПЛ — селектор СРЦ-цикла; ББ — сплит/цель/«🎭 Пик-неделя»; ручной — шаблон из собранных блоков; общий — «📉 Taper внутри блока (2 нед)»; «✍ В редактор» — мост `annual_block`.
- **Пик-неделя по умолчанию**: `withDefaultPeakConfigs` — BB-блоку с `peakWeek` без явного конфига подставляется `defaultPrepConfigForBlock` (профиль вес/пол/категория + `goals.bbPeakConfig`, дата шоу из соревнования блока) перед сборкой.
- **Ручной roundtrip**: мост `annual_block` (planner-bridge) — «✍ В редактор» загружает программу блока и ставит `he_annual_block_pending`; `completeAnnualBlockImport` в `ProgramManagerPanel.commit` возвращает сохранённую программу в блок (`importProgramIntoAnnualBlock` → статус 'built', configHash синхронизирован — блок не stale и не пересобирается).
- **🚀 В ББ-авто** (для собранного BB-блока): `he_bb_plan_saved` + событие `he-bb-plan-saved` — BbAutoConstructor подхватывает план на шаге «План» (слушатель уже существовал, правок BbAutoConstructor не потребовалось).
- **Живая синхронизация**: панель слушает `he-annual-training-plan-updated` (dispatch в saveAnnualTrainingPlan и completeAnnualBlockImport) — возврат блока из ручного конструктора виден без перемонтажа.
- **Валидация разметки**: `validateAnnualPlan(plan)` (gaps/overlaps/totalMismatch/outOfRange + warnings) — красная строка «⚠ Разметка года: пропуск нед X–Y…» в карточке сборки.
- **📍 Текущая неделя**: `activeBlockForWeek(plan, week)` — строка активного блока в карточке сборки (неделя/фаза/kind/статус), клик выбирает блок в списке.
- **🖨 Сводка года (PDF)**: `buildAnnualPrintHtml(plan)` (annual-training-print.ts) — HTML-сводка (таблица блоков: недели/фаза/конструктор/цикл/сплит/taper/пик/статус, превью недели 1 для собранных блоков, предупреждения валидации), XSS-экранирование; кнопка «🖨 Сводка (PDF)» в карточке сборки (window.open → print).
- **✓ В ПЛ-авто**: собранный PL-блок передаёт СРЦ-цикл через `onApplyCycle(cycleId, weeks)` (SRCBBScreen строит план).
- **📸 Снапшоты сборки года**: `saveAnnualScenario/loadAnnualScenarios/removeAnnualScenario/restoreAnnualScenario` (кап 6, `he_annual_scenarios`) + `compareAnnualScenarios` (дифф по блокам: kind/статус/конфиг/результат, сводка); в карточке сборки — «📸 Снапшот», «⇄ Сравнить», «📥», «✕».
- **⧉ Копирование блока**: `cloneBlockConfigFrom(plan, targetKey, sourceKey)` — kind+конфиг (цикл/сплит/taper/пик/шаблон) из другого блока; селектор в панели настроек; целевой собранный блок → stale, результат сохраняется.
- **💡 Рекомендация конструктора**: `recommendKindForPhase(phase, source)` (BB-макро → BB; PL-макро: BB-фазы hypertrophy/contest_prep → BB, остальные → PL) — чип «💡 Рекомендуем» в панели настроек при несоответствии.
- **📈 Дневник в карточке**: сессии 7/28д + ACWR из `diaryMacroStats`, кнопка «📍 по дневнику: нед N» (маркер текущей недели → неделя последней сессии).
- Авто-синхронизация (useEffect на macro/bbMacro): правка макро сразу подсвечивает stale-блоки, результат не теряется.
- `runAnnualBuild('all'|'block'|'export'|'editor')` — статус-флеши «📦 Годовой план: собрано +N · готовых пропущено M · ошибок K».
- **План интеграции (отдельный этап)**: `docs/ANNUAL-TRAINING-INTEGRATION.md` — точки интеграции и критерии приёмки для BbAutoConstructor (этап 6: контекст `he_bb_plan_saved_ctx` + авто-открытие шага «🏁 Contest prep») и IndividualPlanContext (этап 7: `annualPlanPhaseForDate` + слушатель `he-annual-training-plan-updated` + подсказка prep). Файлы других агентов не трогаются до отдельного этапа.

### Интеграция с ББ-авто и питанием — этапы 6-7 выполнены (Aug 16, uncommitted)
- **Этап 6 — ББ-авто** (`BbAutoConstructor.tsx` + карточка сборки):
  - «🚀 В ББ-авто» пишет `he_bb_plan_saved_ctx` (blockKey/phase/weeks/peakWeek/peakConfig/taper) рядом с `he_bb_plan_saved`;
  - BbAutoConstructor: чистый маппер `annualBlockCtxToPrepPatch(ctx)` (категория/специализация/дата шоу/taper-недели/недели подготовки/моды вода-натрий-карбс с обратным маппингом и клампом 1-4/1-52, безопасный fallback категории mens_physique) + `consumeAnnualBlockCtx` (ключ удаляется после чтения) + `applyAnnualBlockCtx` в ОБОИХ путях приёма плана (авто-загрузка при монтировании и живой слушатель `he-bb-plan-saved`): при `peakWeek` — предзаполнение шага «🏁 Contest prep» и `setStep('contest')` с флешем.
  - ВНИМАНИЕ: чужой коммит ae6ed9751 (21:35) подмел мои незакоммиченные правки BbAutoConstructor через `git add -A` — код цел и в HEAD, файл мной не коммитится повторно.
- **Этап 7 — питание** (`IndividualPlanContext.tsx` + движок):
  - движок: `annualWeekForDate(isoDate, reference?)` (неделя 1 = reference/сегодня) + `annualPlanPhaseForDate(plan, isoDate, reference?)` → `{ week, block } | null`;
  - IndividualPlanContext: состояние `annualPlan` + слушатель `he-annual-training-plan-updated` (живое перечитывание, паттерн как у contest-prep);
  - подсказка в целях дня: если на дату активен BB-блок фазы `contest_prep`, а prep-план/bbPeakConfig не собраны → `peakWeekNote` = «🏁 Годовой план: эта неделя — contest prep, но prep-план не собран…» (идёт в существующий канал заметок дня).

### Тесты (106 новых)
- `annual-training-engine.test.ts` (43): хэши/ключи, план из PL/BB макро, sync (layout без изменений / изменён→stale с сохранением результата / конфиг изменён→stale), сборка PL (цикл→недели+program.pl), PL без цикла (скелет+warning), taper-идемпотентность, BB-блок 8 нед/20 нед (зацикливание), пик-неделя contest_prep (peakApplied, фаза peaking), MANUAL скелет+шаблон, сборка года (только missing / rebuild all / частичная при ошибке), правки блоков (setAnnualBlockConfig/kind→stale с сохранением результата, updateAnnualBlockWeeks→built без stale, importProgramIntoAnnualBlock), композиция (bb/hybrid/pl/notes/null), валидация разметки (целостная/gap/overlap/totalMismatch), activeBlockForWeek, recommendKindForPhase, cloneBlockConfigFrom (kind+конфиг, unbuilt остаётся unbuilt), **annualWeekForDate, annualPlanPhaseForDate**, E2E 52 недели (сборка смешанного года → hybrid 52 нед без разрывов).
- `annual-training-storage.test.ts` (17): roundtrip, битый JSON/форма, remove, миграция (BB-приоритет, стабильный id, существующий план не перезаписывается), снапшоты (save/load, кап 6, remove, restore-глубокая копия, compare идентичных, compare смены конструктора).
- `annual-training-print.test.ts` (6): содержимое (недели/фазы/конструкторы/статусы), настройки (цикл/сплит/taper/пик), превью сессий, XSS (description/error), предупреждения валидации, сводка статусов.
- `bb-auto-annual-ctx.test.ts` (5): маппер контекста (без peakWeek → null, полное предзаполнение, агрессивные моды с подтверждением, fallback категории, клампы 1-4/1-52).
- `macrocycle-panel-annual-build.test.tsx` (18): карточка после сборки макро, «Собрать весь год» (все built, PL-блоки с sourceCycleId), «Собрать блок» (только выбранный), экспорт без блоков (предупреждение), экспорт после сборки (мост he_planner_apply, kind program), stale после смены недели соревнования, десериализация макро с cycleId, панель настроек блока, смена конструктора→stale (результат не потерян), «✍ В редактор» (без сборки→предупреждение / после сборки→мост annual_block с blockKey), BB-блок с «🎭 Пик-неделя» (peakApplied + конфиг из профиля), «🚀 В ББ-авто» (he_bb_plan_saved + **he_bb_plan_saved_ctx с blockKey/phase/peakWeek**), живое обновление по событию he-annual-training-plan-updated, «📍 Текущая неделя» (строка + клик выбирает блок), «✓ В ПЛ-авто» (onApplyCycle с cycleId/weeks), «📸 Снапшот» (сохранение + ⇄ Сравнить), «💡 Рекомендуем» (чип при несоответствии).
- `planner-bridge-handlers.test.ts` (17): annual_block с программой (onChange + pending), без программы (предупреждение), completeAnnualBlockImport (программа → блок, pending очищен), без pending → false.
- Проверено: tsc 0 по моим файлам; annual-training 66/66 (43+17+6), bb-auto-annual-ctx 5/5, panel-annual-build 18/18, planner-bridge-handlers 17/17, **IndividualPlan 193/193**, bb-auto-smoke 5/5; полный прогон ранее 5682/5684 — падения только в чужом WIP.

---

## Contest Prep — полноценный адаптивный цикл (Aug 16 2026, uncommitted)

Терминология разделена: **подготовка** (недели/месяцы дефицита) → **taper** (1-4 нед: объём ↓, интенсивность сохраняется) → **peak week** (7 дней, привязана к дате шоу) → **show day** → **post-show**. Canonical engine — `bb-contest-prep.engine.ts` (расширен, все новые функции экспортированы).

### Этапы 1-2 — аудит + единая модель `BBContestPrepPlan`
- **Legacy**: `bb-peak-week.engine.ts` помечен `@deprecated` (экстремальные протоколы вода 0.25л/натрий 0.5г запрещены для новых UI-точек); `peaking-engine.generateBBPeaking` и `training-integration.peakForBBShow` — `@deprecated` (TaperPlannerTab BB-ветка переведена на canonical `buildBBContestPrep`).
- **Модель**: `BBContestPrepPlan` (версионированная: `version`/`algorithmVersion`/`status`/`createdAt`/`updatedAt`/`source`) с раздельными блоками `preparation` (weeks/finalWeeks/targetRatePctPerWeek 0.25-0.75/currentCalories/steps/cardio), `taper` (volumeProfile/intensityProfile/rirProfile), `peakWeek` (strategy/waterMode/sodiumMode/carbMode), `phases` (6 фаз с неделями и датами), `safety` (contraindications/warnings/requiresReview/blockedProtocol), `frozenWeeks` (завершённые недели не пересчитываются без подтверждения).
- `buildBBContestPrepPlan(cfg, opts)` / `computePrepPhaseRanges` / `replanBBContestPrep` / `shiftBBContestPrepShowDate` (возвращает `{plan, changedFrozen, warnings}`) / `addPrepWeeks` (только подготовка) / `prepPhaseForWeek` / `prepPhaseForDate` / `serialize/deserializeBBContestPrepPlan` / `planFromStored` (новый план → legacy bbPeakConfig → legacy поля профиля) / `configFromPlan`.
- Хранение: `goals.bbContestPrepPlan` (новый ключ в `UnifiedSettings.goals`), `bbPeakConfig` остаётся для совместимости.

### Этап 4 — taper по современной модели (Bosquet 2005 + Helms 2022)
- **Каноническая BB-кривая** (вместо Библиотеки с RIR 0→0 и интенсивностью 0.80-0.85): объём 0.90 → 0.85 → 0.70 → 0.60, интенсивность 0.95 → 0.85 (сохраняется), **RIR 2-4** (никакого авто-RIR 0/отказа), без новых упражнений, без тяжёлых эксцентриков.
- **Per-muscle**: 🦵 ноги (quads/hams/glutes/calves) разгружаются раньше (×0.9 в первую taper-неделю), ⭐ специализация щадится (×1.25 к множителю, ≤1.0); anti-двойной deload сохранён.
- `applyContestPrepToBBPlan(plan, cfg, opts)` — единое применение, СТРОИТ тренировочный цикл: 1) если план короче prepWeeks+taper+пик — **достраивает недели подготовки в начало** (пик привязан к концу/дате шоу, недели перенумерованы); 2) тапер (+пик в окне `weeksOut=taper+1`) с разметкой `wk.contestPhase` (preparation/final_preparation/taper/peak_week); 3) **финальная подготовка: объём ×0.9, RIR 2–3, интенсивность сохраняется, спец-щажение, deload не трогается**; идемпотентен per-week и по длине. `extendBBPlanPreparation(plan, addWeeks)` — вставка недель ТОЛЬКО в подготовку (пик/тапер не тронуты), перенумерация week.
- **UI**: при достройке цикла BbAutoConstructor синхронизирует `bbWeeks` и флешит «тренировочный цикл расширен до N нед».

### Этап 5 — питание по дням (план vs факт)
- `nutritionTargetsForPrepDate(dateIso, plan, base)` — цели на ЛЮБУЮ дату: пик-неделя — абсолютные (buildPeakWeek); подготовка — дефицит по `currentCalories` (финальная ×0.97), белок 2.2-2.5 г/кг (профиль категории), **жиры ≥ 0.6/0.8 г/кг (мин 30 г — не обнуляются)**, вода/натрий стабильны.
- `prepToMealPlanInput(targets, opts)` — адаптер в `MealPlanInput` → `generateMealPlan` (meal-plan-generator.engine). План отделён от факта: сгенерированное меню не пишется в дневник.

### Этап 6 — безопасность
- По умолчанию **stable** вода и натрий; `confirmedManipulation: true` — единственный путь к умеренной модуляции; `classic` water/cut_* недоступны без подтверждения.
- `professionalReviewConditions()` — расширенный список (почки/сердце/гипертония/диабет/беременность/РПП/судороги/электролиты) → `requiresReview`; при противопоказаниях + запрошенной модуляции → `blockedProtocol` (стабильные моды + warning). Диуретики и фарма не назначаются.

### Этап 7 — Test Peak Week
- `saveTestPeakWeekResult` / `scoreTestPeakWeek` (carbTolerance/digestion/fullness/waterRetention/pump/sleep + weightDelta → tested_ok/conservative/adjust) / `latestTestPeakWeek` / `resolvePeakStrategy` — тестовый прогон НЕ меняет основной план, результат (`testPeakWeekId`) влияет на стратегию пик-недели. Storage `he_bb_test_peak_weeks` (кап 10).

### Этап 8 — UI: опциональный шаг «🏁 Contest Prep» в BB Auto
- Новый шаг `contest` (после «Коррекция», перед «Годовой план») в `BbAutoConstructor.tsx`: дата шоу (input date), категория/специализация, недели подготовки и taper (степперы), моды вода/натрий/карбс (чипы, stable по умолчанию), чекбокс подтверждения модуляции, противопоказания из профиля (chronicConditions + ручные).
- «🏁 Собрать contest prep и применить» → `buildBBContestPrepPlan` + `applyContestPrepToBBPlan` + сохранение в профиль (goals.bbContestPrepPlan + bbPeakConfig + peakShowDay); «Пропустить» — план остаётся обычным.
- Просмотр: текущая фаза «📍 Сейчас», календарь фаз с датами, кривая taper (объём/вес/RIR), предупреждения safety, «🍽 Питание на сегодня» через `nutritionTargetsForPrepDate`, «➕/➖ Неделя подготовки» через `extendBBPlanPreparation`, перенос даты через `shiftBBContestPrepShowDate`. Кнопка «🏁 Contest prep» также в шаге «Коррекция».

### Этап 8.1 — визуал + синхронизация (Aug 16, итерация 2)
- **🗺 Гент-диаграмма фаз по неделям** в шаге contest (ячейки по цветам фаз, маркер «📍 сейчас: неделя N» с белой обводкой, легенда).
- **🎬 Таймлайн Show Day** через `buildShowTimeline(configFromPlan(prepPlan))` (подъём → грим → backstage → памп → выход).
- **🧪 Test Peak Week UI**: степперы 1-5 (carbTolerance/digestion/fullness/waterRetention/pump/sleep) + Δ веса → `saveTestPeakWeekResult` → вердикт и `resolvePeakStrategy`.
- **Авто-восстановление**: при монтировании BbAutoConstructor читает `planFromStored(goals.bbContestPrepPlan, bbPeakConfig, goals, personal)` и восстанавливает шаг contest (дата/недели/моды/категория/тест).
- **Событие `he-bb-contest-prep-updated`** (detail: prepPlanId/trainingPlanId/nutritionPlanId/showDate) при сборке; `IndividualPlanContext` слушает его и живьём перечитывает план (NutritionScreen ↔ TrainingScreen).
- **NutritionScreen**: `IndividualPlanContext` гидрация через `planFromStored` (приоритет новому плану), цели дня через `nutritionTargetsForPrepDate` для подготовки/тапера/пик-недели (`_applyPrepTargets`), legacy `computePeakWeekNutritionTargets` остаётся fallback.

### Этап 3.2-3.3 — ступенчатая адаптация по весу (Aug 16, итерация 3)
- **`prepWeightAdvice(log, plan, opts?)`** (экспортирован, чистый): анализ СРЕДНИХ за 7-дневные окна (avg7d vs avgPrev7d, delta14d), фактический темп %/нед vs цель 0.25-0.75% (границы 0.55×/1.3×), статус `no_data/on_track/too_fast/too_slow/taper`, прогресс к `goals.targetWeight`, рекомендация «ОДНА переменная за раз» + ступени `adjustCalories` (±150-175) / `adjustCardioMin` (±20, взаимно исключающие). В taper/пик коррекции запрещены.
- **UI**: карточка «⚖️ Адаптация по весу» в шаге contest — последний вес/Δ7/Δ14/темп/бейдж статуса/прогресс-бар к цели/рекомендация + кнопки «Применить калории ±» / «Кардио ±» → обновляют `prepPlan.preparation.currentCalories/cardioMinutesPerWeek` + сохранение в профиль.

### Этап 3.4 — Post-show (Aug 16, итерация 4)
- **`buildPostShowPlan(plan, opts?)`** (экспортирован): восстановление после шоу — поддержание ≈ дефицит +300 ккал (не профицит сразу), белок 2 г/кг, стабильные вода/натрий (никаких манипуляций), лёгкие full-body 2-3×/нед + возврат объёма +10-15%/нед, контроль веса (+1-2 кг в первую неделю = гликоген/вода — норма).
- **UI**: блок «🔄 Post-show» в шаге contest + прогресс-бар «неделя N из M» подготовки.
- **TaperPlannerTab**: BB-применение исправлено — `volumeMult 0.6, rirTarget 2` («вода и натрий стабильны») вместо `0.4 / RIR 0` («water cut»).
- Совместимость с PL-пиком другого агента (`lms-taper.engine.ts`): раздельные движки; для BB `bb-contest-prep.engine` не зависит от `peaking-protocols` (своя `BB_TAPER_CURVE`); общий файл `training-integration.engine.ts` — разные строки, конфликтов нет.

### Этап 4.1 — taper поверх существующего плана: force-обновление (Aug 16, итерация 7)
- **`applyTrainingTaperToBBPlan` += `opts.force`**: без force — идемпотентный пропуск уже размеченных недель; с force — **ОБНОВЛЕНИЕ** наложенного taper/пик-недели актуальными настройками (изменение недель/воды/карбс пересобирает план, а не игнорируется). `applyContestPrepToBBPlan` и все UI-пути (сборка/перенос даты/расширение) передают `force: true`.
- **UI**: блок «📉 Недели taper (тренировочный цикл в плане)» в шаге contest — таблица недель taper/пик из builtPlan (неделя/фаза/сетов/RIR/нагрузка); бейджи фаз недель («🏁 Подготовка»/«📉 Тапер»/«🎭 Пик-неделя») в шаге «План».
- **⏳ Планировщик питания**: `generatePlan` стал async с `opts.async` — генерация 3/7 дней разбита yield (20мс между днями), UI не фризит; кнопки «3 дня/Неделя/Перегенерировать» используют async-путь, показывают «⏳» через `planBusy`; синхронный путь сохранён для тестов/месяца (месяц и так async). Кэш `buildPeakWeek` в движке (per-конфиг) — убран повторный пересчёт пик-недели на каждый день плана.

### Аудит логики тренировок BB-авто (Aug 16, итерация 8) — ошибки интеграции prep
Изучено: bb-builder (bbRir/sessionShareFor/normalizeWeekMrv), bb-autocoach (applyPostPhaseProcessing/applyTaperToFinalWeeks), bb-finalize (finalizeBBPlan pipeline). Действующая логика генерации НЕ изменена — исправлены только ошибки на стыке с prep:
- **Двойной авто-taper**: `applyTaperToFinalWeeks` режет последние 2-3 недели ЛЮБОГО плана ≥4 нед (объём 0.75/0.5, RIR+1/+2) — при повторной финализации (revalidate после правок в «Коррекции») prep-план резался повторно. Фикс: guard — план с `contestPhase/peakWeek/prepProtocol` авто-taper'ом не трогается.
- **Пропуск prep-taper как deload**: авто-taper'нутые недели (`taper:true` без `prepProtocol`, объём <60%) трактовались как deload и НЕ получали канонический taper. Фикс: наш taper накладывается ПОВЕРХ таких недель («обновлять существующий план»).
- **«Раздувание» taper/пик финализацией**: leg-target (enhanced 10-12 сетов), MEV-feeders, back/arm-аллокации и fillSets добавляли объём в taper/пик-недели при revalidate. Фикс: `isPrepControlled(week)` guard в finalizeBBPlan — объём-добавляющие проходы пропущены для prep-недель (feeders/ротация — целиком для prep-планов).
- **Накопление кривой при force**: повторный пересбор (смена даты/недель) умножал taper/финальную подготовку поверх уже порезанного (×0.85×0.85, ×0.9×0.9). Фикс: недели с нашим prepProtocol при force НЕ пересобираются (границы фаз пересобираются — новые недели окна получают taper, старые сохраняют корректную кривую); авто-taper'нутые недели финализатора (taper:true без prepProtocol) не трогаются (это готовый taper по Bosquet); финальная подготовка идемпотентна (пропуск по prepProtocol 'Финальная подготовка').
- **Taрer НЕ переделывает весь цикл** (жалоба: «переделывает весь цикл, объём всего цикла»): убрана АВТО-достройка плана в начало (`prependPreparationWeeks` больше не вызывается) — taper накладывается ПОВЕРХ существующего плана как есть: подготовка = все недели до финальной/тапера БЕЗ изменений (объём 100%), меняются только финальная (×0.9), taper и пик. Короткий план → warning «подготовка усечена» + явное расширение через «➕ Неделя подготовки» (`extendBBPlanPreparation`). Подтверждено E2E-тестом на реальном `buildBBPlan` (12 нед): недели 0..6 побайтово идентичны, меняются только 7..11.

### Режим подготовки (Aug 16, итерация 9) — тренировочная логика недель подготовки
- **`applyContestPrepToBBPlan` += проход режима подготовки** (недели `preparation`): RIR 1–3 (никакого авто-отказа RIR 0 из интенсификации mass-плана), отказные интенсив-техники (dropset/rest_pause/myo_rep/negative) убираются, веса (интенсивность) сохраняются, deload не трогается; объём по выбору `prepVolumeMult`: 1.0 = как в плане (сохранение) / 0.85 = поддерживающий при дефиците (Helms 2022); идемпотентно (метка `Подготовка: RIR 1–3...`), force пересчитывает от сохранённой базы `_baseSets` (без накопления).
- Модель: `BBContestPrepPlan.preparation.volumeMult?` (сохраняется в профиль, авто-восстановление в UI).
- **UI**: чип «🏋️ Режим подготовки» в шаге contest (Сохранение RIR 1–3 / Поддерживающий ×0.85) + пояснение; передаётся во все пересборы (сборка/дата/расширение).
- +3 теста (RIR 1–3+техники убраны, ×0.85 без накопления, deload не тронут) — contest-prep **161/161** (94+67) + смежные BB 147/147.

### Связь с PED / стажем / режимом (Aug 16, итерация 10)
- **experienceLevel** больше не захардкожен: маппится из `bbTrainingYears`/`bbLevel` (≥5 лет или advanced → advanced; <2 или beginner → beginner); влияет на стратегию пик-недели (новичок/первый пик → conservative, продвинутый с prepCount>0 → moderate), предупреждения validate («первый пик — минимум манипуляций»).
- **PED**: `enhanced = peds.length > 0` (было) + подсказки в чипе режима подготовки: на курсе рекомендуем ×1.0 (восстановление выше), natural при дефиците — ×0.85, новичок — ×1.0/RIR 2–3; строка сводки «💉 курс / 🌱 natural · стаж N г · режим объём N%».
- +1 тест (стратегия по опыту) — contest-prep **162/162** (94+68) + смежные BB 147/147.

### Женская подготовка — грамотность питания (Aug 16, итерация 11)
- **Калорийный пол по полу**: female 1400 ккал (RED-S / энергетическая доступность <30 ккал/кг FFM), male 1200; жиры female ≥ 0.8 г/кг (мин 40 г), male ≥ 0.6 г/кг (мин 30 г).
- **Женские примечания** в целях подготовки и пик-неделе: железо (красное мясо/печень/шпинат — дефицит типичен для женской сушки), кальций 1000–1200 мг (защита костей при низком % жира), цикл (лютеиновая фаза — задержка воды +0.5–1 кг — не паниковать, анализ по среднему за 7 дней), вода в день шоу ≥ 0.5 л, натрий ≥ 800 мг (гипонатриемия).
- **Женский дефолтный темп** подготовки: 0.4%/нед (vs 0.5 муж) — меньше жировой ткани, риск RED-S; `prepWeightAdvice` too_fast для female учитывает фазу цикла.
- Категории: профили проверены (легкие bikini/wellness — меньшая карб-загрузка 2-3.5 г/кг, light:true, целевой % жира 9-12; тяжёлые mens_bb/bb_212 — 4-5%, загрузка 4-8 г/кг).
- +4 теста женской подготовки (пол/калории/примечания, пик-неделя натрий/вода/карбс, мужской пол без женских нот, цикл в адаптации) — contest-prep **166/166** (94+72), IndividualPlan 193/193, tsc 0, build OK.

### План доработок — выполнено полностью (Aug 16, итерация 12)
- **P1-4 (ручные правки)**: `assembleContestPrep` применяет `exerciseEdits` (applyEditsToPlan) ПЕРЕД пересборкой prep — правки пользователя не теряются при повторном taper.
- **P1-2 (diff)**: блок «🔎 Сравнение до/после» — snapshot плана до применения (`prepBasePlan`), таблица недель: сеты/RIR до/после с цветами фаз (зелёный подготовка / фиолетовый финальная / оранжевый taper / розовый пик), счётчик изменённых недель.
- **P1-3 (предупреждение)**: перед кнопкой сборки — блок «Что изменится в плане» (только финальная/taper/пик; подготовка не переделывается; короткий план не расширяется).
- **P2-1 (история)**: `recordPrepAdjustment` + `PrepAdjustment` (date/reason/caloriesDelta/cardioDelta/weightStatus/source, кап 20) — `handleApplyWeightAdjustment` пишет историю; таблица «📝 История корректировок» в шаге contest; печать включает историю.
- **P2-2 (чек-лист)**: «📋 Контроль готовности» — 6 чек-пунктов дня (вес/сон/выполнение/шаги/пищеварение/форма), localStorage `he_prep_checkin`.
- **P2-4 (матрица тестов)**: 9 категорий × питание (ккал=Б×4+У×4+Ж×9, пол-флоры, натрий/вода) + 3 уровня × стратегия пик-недели.
- **P3-1/2 (экспорт)**: `buildPrepIcs` (фазы + show day, ICS-экранирование) — кнопка «📅 Фазы (.ics)»; `buildPrepCoachJson` (снапшот для тренера) — кнопка «📥 JSON тренеру».
- **P1-1 (E2E)**: тест полного пути buildBBPlan → prep → revalidate: подготовка побайтово идентична, taper-зона цела (наша кривая или авто-taper Bosquet), пик не раздут; E2E ×0.85 без накопления.
- **Фикс интеграции**: финализатор (`finalizeBBPlan`) при prep-разметке (peakWeek/contestPhase/prepProtocol) делает только sync формы и возвращает план — повторная финализация после ручных правок НЕ перестраивает состав/объём prep-недель (раньше меняла упражнения/аллокации). Обычные планы не затронуты (85/85 смежных).
- **P3-4 (план vs факт тренировок)**: `prepTrainingCompliance(plan, bbWeeks, sessions)` — выполнение недель prep по дневнику: факт-сеты (totalSets в диапазоне дат недели) против плана, статусы upcoming/done/partial/missed, overallPct по прошедшим неделям, рекомендация. Каждая неделя фазы — свой 7-дневный диапазон дат. UI: карточка «📈 Выполнение подготовки» в шаге contest (неделя/фаза/план/факт/%/статус + рекомендация).
- Итог: contest-prep **183/183** (94+89), tsc 0, build OK.

### Проверено (актуально)
- tsc 0 по моим файлам; `vite build` временно недоступен — чужой незакоммиченный WIP ПЛ-агента ломает `SRCBScreen.tsx` (синтаксис на строке 1381, PLCompetitionTab) — файл другого агента не трогается.

### Этап 8.2 — BBContestPrepCard на едином плане (Aug 16, итерация 5)
- **`BBContestPrepCard`** (годовой планировщик): гидрация через `planFromStored` (новый план приоритетен), строка «N нед подготовки · taper M нед · пик-неделя 7 дн» + «📍 фаза (нед N из M)», мини-гент недель всего цикла (не только пик-неделя), compact-режим сохранён; legacy-ветка (bbPeakConfig) остаётся fallback.
- +1 тест карточки (с единым планом в профиле) — **4/4**.

### Этап 8.3 — печать сводки (Aug 16, итерация 6)
- **`buildContestPrepPrintHtml(plan)`** (экспортирован, чистый): полная HTML-сводка (фазы/тапер-кривая/пик-неделя по дням/таймлайн Show Day/post-show/адаптация по весу/предупреждения), XSS-экранирование пользовательских строк (контраиндикации, notes, warnings).
- **UI**: кнопка «🖨 Сводка prep (PDF)» в шаге contest → `window.open → document.write → print`; fallback-флеш при блокировке всплывающих окон.
- +2 теста печати (содержание, XSS) — contest-prep **146/146** (94 + 52 новых).

### Этап 9 — тесты
- NEW `bb-contest-prep-plan.test.ts` — **58 тестов**: модель/версии (5), фазы 8/12/16/20 нед (2), сериализация (2), динамические недели и перенос даты (7), taper-кривая и разметка (11, включая построение цикла: достройка короткого плана, финальная подготовка ×0.9/RIR≥2, подготовка 100%, идемпотентность длины, привязка пика), питание (6), безопасность (4), test peak week (4), обратная совместимость (4), show-day таймлайн (1), **адаптация по весу (7)**, **post-show (3)**, печать (2).
- MOD `bb-contest-prep.test.ts` — 3 теста переведены на каноническую кривую (объём [0.85,0.7,0.6], интенсивность 0.95, RIR≥2). Итого **152/152** по обоим файлам; IndividualPlan 193/193; taper-planner-tab 6/6; смежные peak-week/audit 253/253.

### Проверено
- `tsc --noEmit` — 0 ошибок (по моим файлам); полный прогон **5158/5162** — падают только 4 теста в чужих WIP (pl-taper-append ×2, profile-routine-merge ×2, не связаны с моей работой).
- `vite build` OK; contest-prep 144/144; IndividualPlan 193/193; taper-planner 6/6.
- Файлы других агентов не тронуты (health-diary/дневники/HR, lms-taper/competition-attempts, MACROCYCLE-ROADMAP.md — чужой WIP).

---

## Годовой планировщик — финальные раунды (Aug 14-15 2026, pushed cf2f12523; следующий раунд uncommitted)

### Раунд A — «цикл не выбирается»: карточки+попапы (Aug 14, pushed cf2f12523)
- **«+ Цикл» и схлопывание слотов** (`MacrocyclePanel.tsx`): неявная строка «Авто» глотала первый пустой слот (1 клик = 0 эффекта) → неявный слот становится явным (`['']`); `filter(Boolean)` в onChange выкидывал пустые слоты → после выбора цикла строки схлопывались → пустые слоты сохраняются, `cycleId = первый непустой`.
- **SRCBB: ББ-вкладка строила ПЛ-макроцикл** — `macroGoal` по `mainTab` (`'bb' → bodybuilding`); иначе «Применить» не находило цикл в блоке.
- **Silent-отказы**: `buildSrc` показывал «⚠ Цикл не найден» вместо тихого return; `onApplyCycle` (ПЛ) обёрнут в try/catch с методнотой; BbAutoConstructor flash вместо тихого return при ПЛ-макроцикле в he_bb_macro.
- **UI-редизайн менеджера соревнований**: неделя — карточка-попап (PopupNumber), приоритет A/B/C — сегментные чипы с цветами (radiogroup), циклы на пик — карточки-попапы (PopupSelect с desc `уровень · дн/нед · нед · период`, ⚠ при несовпадении уровня), текущая неделя — степпер −/+/⟲, правка длительности фаз — карточки-попапы.

### Раунд B — сборка цикла ББ + избранное (Aug 15, uncommitted)
- **«⚙️ Собрать этот цикл (сплит + фазы)»** в карточке ББ-блока: попап-сборщик — сплит (SPLIT_PATTERNS, рекомендуемый первым через rankBBSplits), недели фаз ББ-макроцикла (гипертрофия/сила/contest_prep/переход, 0 = фаза не входит, минимум 4 нед), «Собрать и расписать» → `autodraftBBPlan` + `applyMacrocycleToBBPlan` (объём/RIR по фазам, Helms 2022).
- **Отправка собранного цикла**: «📥 В ручной режим» — `createFromBuild` → planner-bridge kind `program` (programHandler принимает готовую UserProgram: `payload.data.program`); «🚀 В ББ-авто» — `he_bb_plan_saved` + событие `he-bb-plan-saved`, BbAutoConstructor слушает и живьём грузит план (шаг «План»).
- **ПЛ**: подсказка в карточке блока «ПЛ-цикл строится через ПЛ-авто; тапер — вкладка „Пик/Соревнования"» — генератор циклов для ПЛ не используется.
- **🏁 Тапер для ББ — заглушка** («в разработке», реализуется позже) в карточке блока и в попапе сборки.
- **⭐ Избранное**: CycleCatalog — ⭐ на карточках, секция «⭐ Избранные циклы», чип-фильтр (`he_cycle_fav`); библиотека программ в ProgramEditorView — ⭐ + чип-фильтр (`he_program_fav`).

### Раунд C — до максимума: статистика, экспорт, дата→неделя (Aug 15, uncommitted)
- **«📊 Итог года»**: карточка с фазами (недели, % года, прогресс-бары по цветам фаз, циклы блоков) + мини-список соревнований.
- **«📋 Сводка»** — `buildMacroSummary(src)` (экспортирован): текстовое расписание (фазы с долями, циклы, соревнования) в буфер (clipboard + execCommand fallback), флеш «✅ Сводка скопирована».
- **Дата соревнования → авто-неделя**: `input type=date` в карточке (есть `CompetitionEvent.date`), неделя через `estimateCompetitionWeek`; ручная смена недели очищает дату.
- **⧉ Дублирование соревнования** (копия +8 нед, приоритет A→B, «(копия)»), **доля фазы** в карточке блока («N% года»), **⟲ сброс текущей недели**, **сортировка циклов в попапе: совпадающий уровень первым**.

### Раунд D — печать, активная фаза (Aug 15, uncommitted)
- **«🖨 Печать макроцикла»**: `buildMacroPrintHtml(src)` (экспортирован) — HTML-страница с полной сводкой, HTML-экранирование пользовательских названий (XSS-safe); `window.open → document.write → print`.
- **«📍 сейчас» в Итоге года**: активный блок по `currentWeekIdx` — подсветка строки + метка в заголовке карточки.

### Раунд E — подстройка под соревнования + «весь год в программу» (Aug 15, uncommitted)
- **Engine-хелперы** (`macrocycle.engine.ts`, все экспортированы + 11 тестов): `macroWeekStartDate/EndDate` (неделя 1 = сегодня/reference), `weeksUntilWeek` (обратный отсчёт), `formatMacroDate` (dd.mm.yy), `projectPmGrowthMultiplier` (прогрессия ПМ по `meta.correctionPct`, кап 2%/нед), `taperWeeksForBlock` (2 финальные недели блока: ×0.65/RIR+1 → ×0.45/RIR+2, Bosquet 2005, паритет applyPLTaper/taperCurve).
- **UI панели**: в карточке соревнования «⏳ до старта: N нед» (+ «эта неделя — старт!»/«старт прошёл») и дата недели («📅 дата» или «~ dd.mm.yy»); в карточке блока диапазон дат «🗓 dd.mm–dd.mm»; в ПЛ-блоке с циклом карточка «🏁 Тапер к старту» (недели/объём/RIR) + «📈 Прогрессия цикла X%/нед → к старту ПМ ×Y».
- **«📦 Весь год в программу» (ББ)**: `autodraftBBPlan(≤16 нед)` → цикл недель до totalWeeks → `applyMacrocycleToBBPlan(bbMacro)`; «📦 Год → ручной режим» (planner-bridge kind `program` c UserProgram) и «📦 Год → ББ-авто» (`he_bb_plan_saved` + событие) + yearNote-статус.
- **Документация**: `docs/MACROCYCLE-ROADMAP.md` — план развития (A: подстройка под соревнования, B: построение тренинга, C: UI/UX, D: ББ-специфика) со статусами.

### Раунд F — тапер ББ: заглушка → пик-неделя (Aug 15, uncommitted)
- **`bb-peak-week.engine.applyPeakWeekToPlan`** += `weekNumber?` (1-индекс; по умолчанию последняя неделя; кламп к краям) — пик-неделю можно применить к конкретной неделе (последняя неделя contest_prep, а не только финал плана). +2 теста.
- **UI панели**: заглушка «Тапер для ББ — в разработке» заменена на реальную карточку **«🎭 Пик-неделя (тапер ББ) — 7 дней к сцене»** в prep-блоке: разворачиваемый протокол по дням (💧 вода / 🧂 натрий / 🍚 карбы / 🏋️ тренировка / 🎭 позы, фазы load→depletion→reload→peak→show), rationale + предупреждения (ориентир 80 кг).
- **Сборщик цикла ББ**: чекбокс «🎭 Применить пик-неделю (тапер ББ) к последней неделе contest prep» (вкл. по умолчанию для prep-блоков) → `applyPeakWeekToPlan(plan, buildPeakWeekProtocol(80), lastPrepWeek)`; метка «· 🎭 пик-неделя» в сводке собранного цикла.

### Раунд G — календарь .ics + heatmap фаз (Aug 15, uncommitted)
- **«📅 Календарь (.ics)»**: `buildMacroIcs(src, reference?)` (экспортирован) — события фаз (диапазоны дат от «сегодня») и соревнований (дата или воскресенье недели), ICS-экранирование названий (`\,`/`\;`/`\n`); скачивание через Blob + a.click. Кнопка рядом с «🖨 Печать».
- **🗺 Heatmap фаз по неделям** в «Итог года»: ячейка на каждую неделю (цвет фазы, активная неделя — белая обводка, tooltip «Нед N: фаза»).
- **Таймлайн**: в блоках дата начала «Nн · с dd.mm.yy» (неделя 1 = сегодня).

### Раунд H — профиль в пик-неделе + линейка дат (Aug 15, uncommitted)
- **D15 (вес/категория из профиля)**: `profilePeakDefaults()` (экспортирован) — вес/пол/категория шоу через `getProfile()` (`personal.weight/sex`, `goals.bbCategory`, маппинг `PEAK_CATEGORY_MAP` «Men's Physique»→mens_physique и т.п., дефолты 80/муж/mens_physique); карточка пик-недели и сборщик строят протокол на реальных данных («Протокол на 70 кг · bikini»); в сборщике селектор «🎭 Категория шоу» (7 категорий, из профиля по умолчанию).
- **C13**: вторая линейка дат под таймлайном («· dd.mm.yy» на 5 тиках, неделя 1 = сегодня).

### Раунд I — дневник двигает план: ACWR + «По дневнику» (Aug 15-16, uncommitted)
- **`diaryMacroStats()`** (экспортирован) — сессии sRPE (`he_srpe_sessions`) за 7/28 дней, `ACWR` через `acuteChronicRatio(toDailyLoads(...))` (training-load.engine), последняя неделя макро по последней сессии; `macroWeekForDate` (неделя 1 = сегодня, корректно для прошедших дат — floor только по модулю разницы), `ACWR_ZONE_LABEL` (недогруз/норма/осторожно/опасно).
- **UI панели**: кнопка «📈 По дневнику (нед N)» у маркера текущей недели — переводит маркер на неделю последней сессии; в «Итог года» строка «📈 Дневник: N сессий (7д) · M (28д) · последняя …» + «⚡ ACWR {ratio} — {зона}» с подсказками («перед пиком снизьте объём» / «обязателен делод»); без сессий — подсказка про sRPE.

### Раунд J — «Сегодня»-карточка + сценарии года (Aug 16, uncommitted)
- **C11 «🔔 Что тренировать сегодня»**: карточка в шапке таймлайна — текущая неделя с датой, активная фаза (и цикл), ближайший старт («до старта „Шоу": N нед»), быстрые действия («⚙️ Собрать этот блок» / «✓ Применить цикл»).
- **C12 «📸 Сценарии года»**: снапшоты макро (`he_macro_scenarios`, кап 6) — `saveMacroScenario/loadMacroScenarios/removeMacroScenario` (экспортированы); «⇄ Сравнить» — `compareMacroScenarios` (недели фаз A→B с диффом +N/−N, цветная индикация) и `scenarioSummary`.

### Раунд K — C10: перемещение блоков (Aug 16, uncommitted)
- **`moveMacroBlock(src, fromIdx, toIdx)`** (экспортирован, macrocycle.engine): сдвиг блока в массиве с пересчётом weekOffset по порядку (PL и BB), totalWeeks и связи соревнований сохраняются; невалидные индексы → null. +3 теста.
- **UI панели**: в карточке выбранного блока стрелки «◀»/«▶» («Переместить блок влево/вправо») — сдвиг по таймлайну с авто-пересчётом недель и дат.
- **Интеграция другого агента**: пик-неделя панели переведена на единый `bb-contest-prep.engine` (fb3733d6d) — `applyPeakWeekOverlayToBBPlan` с weekNumber, категория через `normalizeContestCategory`, дата шоу из соревнования; мои тесты [Peak week: …] совместимы.

### Раунд L — чек-ин prep (D15): динамика веса к цели (Aug 16, uncommitted)
- **`prepCheckInStats(log, prepStartIso?, target?, reference?)`** (экспортирован, чистая функция): последний вес из дневника (`getWeightLog`), изменения за 7/14 дней, число замеров с начала prep-блока, прогресс к целевому весу (`goals.targetWeight`): `(start − last)/(start − target) × 100`.
- **UI панели**: в prep-блоке карточка «⚖️ Чек-ин prep» — вес/дата, дельты 7/14д, цель, прогресс-бар; без данных — подсказка записывать вес в «📓 Дневники → Вес».
- +3 теста (helper 2, UI 1).

### Итог
- Панель 34 теста + движок-хелперы 14 + пик-неделя 20 + избранное каталога 3 + bridge 2 — **365/365 в затронутых областях**, tsc 0 по файлам, BB-авто принимает планы живьём.

## BB-auto Rebuild — Раунды 2-4 + финал (Aug 13-15 2026, pushed 28fc33c6 → 9241657c → b2a0b86d)

### Раунд 2 — специализация, ноги 2x/нед, cap 5, баланс спины, качество малых групп (Aug 13)
- `WEAK_PATTERN_REQ` (finalize): слабая подгруппа → обязательный функциональный паттерн (chest_upper→incline, back_width→vertical, quads→squat/leg press); `ensureWeakPatternCoverage`.
- Ноги 2x/нед: день A — тяж quads + памп hams; день B — тяж hams + памп quads; 2-й паттерн quads = жим ногами (не второй присед); hams — leg curl/RDL без дубля движения.
- Глобальный cap 5 сетов/упражнение + per-exercise минимум 2; недельный MRV-кап по trueMuscleOf; `lengthenedBonus` (растянутая позиция, Schoenfeld 2021) в выборе упражнений.
- `ensureSmallMuscleQuality`: икры stretch (стоя) + сидя (камбаловидная), шраги до 5 с задержкой, пресс до 5; при лимите упражнений — замена accessory другой мышцы.
- Связки мышц: mid-delt+грудь (Push), rear-delt+спина (Pull), бицепс+спина, трицепс+грудь; `diversifyExperiencedChestSession` (mid-delt гарант).

### Раунд 3 — MEV-guard по сессиям, 0 overflow, feeder-интеграция (Aug 14)
- MEV-guard по СЕССИЯМ: `sessionsForMuscle` считает сессии с мышцей — guard back 7 вместо 2; бюджет-фит не резал ниже MEV.
- Повторный MRV-кап ПОСЛЕ fill (builder-кап был до finalize); фит не удаляет последний стимул мышцы с повышенным MEV-флором.
- Indirect смягчён по EMG: triceps 0.45, glutes 0.45, shoulders 0.2, biceps 0.4 — убраны пограничные overflow (fullbody 5x/нед и др.).
- **Итог Раунда 3: 0 MRV-overflow / 125 комбинаций (5 профилей × 25 сплитов), 875/875 BB-тестов.**

### Раунд 4 — deep-дефициты, traps/glutes, баланс спины, головки рук (Aug 14)
- **MEV-repair в finalize**: мышцы с direct < MEV получают подъём сетов изоляций/тяг (per-session back-стандарт 18/22 для enhanced 3+) в пределах cap 5, кап-запаса (≤MRV) и лимита сессии; compound-жимы/приседы исключены (indirect выталкивает за кап); мышцы на 80%+ капа не поднимаются.
- natural traps/glutes: шраги до MEV (5-6), glutes-блок (hip thrust/отведение) в Legs/FullBody — natural-сплиты больше не теряют ягодицы.
- Баланс ширины/толщины спины (Раунд 4.1): per-session width ≥ 0.6×thickness — подъём существующей вертикальной тяги (до 5, макс 1 vertical/сессию); при лимите — обмен сетов с горизонтальной тяги (с защитой back-стандарта 18/22 и 0.6-симметрии) и мелких изоляций; FullBody без back получает vertical pull (оборудование, bodyweightCapability, лимит упражнений — замена мелочи). **Итог: 0 несбалансированных недель спины (было 18).**
- **Cap-adjust post-hoc**: triceps/shoulders/biceps с большим indirect (жимы 0.45/0.2, тяги 0.4) урезаются по фактическому effective против адаптированного MRV (изоляции первыми) — закрыт overflow, невидимый МЕV-гаранту (fullbody_2 enh-1-3: жим узким 5 + 8.1 indirect = 15.1 > кап 13×1.15).
- Классификатор: «Скручивания в верхнем блоке» (пресс) не ловится vertical_pull; bb-safety-score: warmupActivator не входит в рабочий объём; mid-delt гарант считает жимы сидя (махи не дублируются в Pull с армейским жимом).

### Раунд 4 финал — головки рук: планирование объёма (Aug 15, 9241657c)
- `ensureArmHeadCoverage` (finalize) помимо покрытия планирует объём по головкам: длинная головка (lengthened/overhead) ≥ 3 сетов при бюджете ≥ 5 (перераспределение между упражнениями, лимиты не меняются); brachialis (hammer) / pushdown (lateral+medial) при бюджете ≥ 5 — замена дубля паттерна или не-must упражнения (brachialis приоритетнее стандартного curl, pushdown — close-grip); перегруженная mustHead (≥5) разгружается до 3 в пользу altHead (новый слот, сумма та же); Back-дни bro-сплита обрабатываются.
- +5 тестов (bb-arm-quality: головки в Pull/Arms/Back-днях, cap 5, сумма не меняется, малый бюджет без слотов).

### Проф-методики из Библиотеки в выбор ББ-авто (Aug 15, 741e874a)
- **🌊 DUP** (bb-dup.engine): селектор в параметрах (тяж/лёг, сила/гипертрофия, полный DUP 3 дня) — `applyDUPOverlay` поверх плана во всех ветках (generic/цикл/программа): характер дней, reps, RIR, метка `[DUP: …]`.
- **🔗 Суперсеты-антагонисты**: пары грудь↔спина, бицепс↔трицепс, квадры↔хамсы — `supersetWith` + комментарий «Суперсет с …», до 3 пар/сессию, deload не трогается; generic — через finalize (`markAntagonistSupersets`), cycle/program — пост-проход.
- **📦 Схемы объёма памп-дней** (`applyVolumeScheme`): GVT 10×10 (10 сетов на мышцу 5+5 по изоляциям, отдых 75с), FST-7 (7 сетов, 40с), 8×8 Gironda (60с) — суммарный target по памп-изоляциям сессии, **cap 5 сетов/упражнение сохраняется**.
- **🔥 Негативы (3-4с)**: новая интенсив-техника `negative` (тип + мета + применение: темп 4-2-1-0 на всех подходах, техника на последнем, комментарий); зеркальный тип `user-program.types` синхронизирован.
- Селекторы в обеих ветках (Generic-сплит и ПРОФ-цикл); опции `supersetMode`/`volumeScheme` прокинуты через `BBBuilderInput` → `finalizeBBPlan`.
- +14 тестов (`bb-pro-methods.test.ts`): пары/лимиты/схемы/негативы/стандарт-неизменность + SSR-проверка селекторов.

### Специализации из Библиотеки-методик (Aug 15, 37a1c2b4 + 5e356e26)
- **RIR-профиль спец**: изоляции целевой мышцы (weakPoints/focusGroup) добиваются до RIR 0-1 с пометкой «Спец-добивка» (по названию — работает и для primary-изоляций).
- **21s (7-7-7)**: интенсив-техника бицепса (7 нижних + 7 верхних + 7 полных, reps 21, темп 2-1-1-0); авто-назначение на сгибания при специализации бицепса.
- **Икры-спец** (focusGroup=calves): темп 2-2-1-0 (пауза 2с внизу + 2с вверху), сеты ≥4 с MRV-гейтом.
- **Спец-частота ≥2×/нед**: целевая мышца получает изоляции во вторую подходящую сессию (теги Push/Upper/Legs/FullBody/Arms), с лимитами и оборудованием; fallback-маппинг trueMuscleOf (отведение бедра/икры).
- **Cap-adjust расширен на ВСЕ мышцы** (было: triceps/shoulders/biceps): резка до 2 + удаление лишних изоляций (мин. 1 упражнение/неделю, только изоляции по расширенному паттерну); выполняется ПОСЛЕ проф-методик и спец-прохода (порядок: спец → GVT/суперсеты → cap-adjust → weeklyVolume → validate); weeklyVolume пересчитывается после.
- Матрица 630 планов (5 профилей × 9 сплитов × 7 спец × DUP/combo): **0 overflow, 0 single-set, 0 >5 сетов**; + 600 планов (спец-матрица) и 125-комб. сводка: 0 overflow, 0 unbalanced.
- +8 тестов (`bb-specialization-methods.test.ts`): RIR/21s/икры/частота; BB 1064/1064, проект 4959 (1 флейк чужого training-plan-save).

### Полный аудит BB-авто (Aug 15-16, 5e356e26 → 77ce22de → 9d5f0a4c)
- **indirect-фикс (критический)**: «Жим ногами» перехватывался жим-блоком indirectMuscleContributions (triceps 0.45/shoulders 0.2 вместо glutes 0.4/hams 0.25) — искажал effective по всему движку (ложные overflow и кап-резы); теперь /жим/ исключает /ног|leg.?press|жим.*ног/.
- **Валидатор**: sessionLimitsFor синхронизирован с builder (enhanced 1-2г = 40/14) — ложные session_exercise_cap ушли.
- **Ранние warnings**: buildBBPlan не клеит effective_mrv_overflow в rationale (кап-аджуст в finalize режет по факту; финальная валидация корректна).
- **Кап-аджуст**: пограничные overflow при indirect ≥ 0.9×cap (удаление последней изоляции, direct 0 — стимул даёт indirect).
- **Матрица 625 базовых** (5 уровней × 5 целей × 25 сплитов, weeks=8): 0 overflow, 0 single-set, 0 >5, 0 ошибок валидатора, 0 недетерминизма, 0 расхождений weeklyVolume.
- **Пути**: cycle/program adapt+faithful — валидны; 9 экстремумов (weeks=52, PED mega, дефицит/профицит, жир 40%, machine-only, травмы, eccentric, weak+focus+DUP) — 0 проблем.
- Итог: BB 1072/1072, проект **4992/4992**, build OK.

### Критический стресс-аудит (Aug 16, 9d5f0a4c)
- **Лимит упражнений сессии enforced пост-фактум**: 5+ слабых групп давали
  перебор в buildSession (11-12 при лимите 10); новый проход
  `enforceSessionExerciseLimit`: изоляции-дубли → изоляции (кроме мелких
  мышц) → accessory; compound не трогается.
- **Компаунд-резка при экстремальных капах** (лаб 0.7 / дефицит / жир 35 /
  bodyweight-only): indirect от compound физически не влезает — итеративно
  режем compound до 1 с пересчётом effective (single-set = warning,
  обоснован при капе 0.6-0.8).
- **Стресс-матрицы**: 3125 базовых (5 уровней × 5 целей × 25 сплитов ×
  недели 1-52): 0 throws, 0 NaN, 0 overflow (рабочие недели), 0 ошибок
  валидатора, 0 недетерминизма, 0 расхождений weeklyVolume;
  564 экстремума параметров (PED-строки/капы, пустой/частичный workMax,
  все травмы, мобильность, bodyweight 0/10, лаб 0.7, калории ±, eccentric,
  5 слабых+focus, техники/стратегии/делоды, machine/bodyweight-only,
  previousPlan, autoReg, ACWR-danger): 0 throws, 0 NaN, 0 overflow,
  0 valErr; 630 комбо, 600 спец, 125 сводка, cycle/program адапт/faithful,
  9 экстремумов путей — всё чисто.
- Итог: BB **1086/1086**, проект **5021/5021**, build OK.

### UI (Aug 15, b2a0b86d)
- Бейджи в карточках упражнений BB-auto (шаг plan, редактор ExpandableCard, PDF, SessionPlayer notes): 🔥 Разминка (warmupActivator), 📐 подгруппа спины (backSubgroup), 🦴 головка руки (movementPattern). `backSubgroupLabel`/`armHeadLabel` экспортированы + тест.

### Итоговое состояние BB-auto
- **921/921 BB-тестов (98 файлов), весь проект 4540/4541 (1 флейк чужого ocr-engine — отдельно 20/20), tsc 0 (кроме чужого WIP PainZone3D/mindset-protocol), vite build OK.**
- 125 комбинаций (5 профилей × 25 сплитов): **0 overflow, 0 несбалансированных недель спины, 0 >5 сетов/упражнение, 0 single-set**; 67/125 с дефицитами — все честные (лимит natural 24/10: MEV-сумма 62 > 48, осознанное правило).
- План docs/BB-AUTO-REBUILD-AND-TUNING-PLAN.md — все этапы выполнены; остаётся только тюнинг по результатам реальных тренировок (Этап 10).

---

## PED-каталог аудит: единая система id + риски по 7 системам (Aug 14 2026, pushed 49b49fdf + 2574665f + 9871006d)

### Единая система id — `src/data/ped-alias-map.ts` (resolvePedAlias)
- 4 системы именования (pharma-db канон / POTENCY_FACTORS / PED_LIST калькулятора / lab-marker-map) сводятся к канону pharma-db: `tren_ace/trenbolone_acetate/tren_a→tren_acet`, `nandrolone_decanoate→deca`, `oxymetholone/oximetholone→anadrol`, `masteron→drostanolone_*`, `trestolone→trest_enan`, `somatropin→hgh`, `insulin_rapid→ins_short`, `igf1lr3→igf1_lr3`, `stanozolol→stan`, `methandienone→methand`, `turinabol→trena` и др.
- Подключён во ВСЕ слои: classifyPed, POTENCY lookup (computeIntensityFactor), findRule (ped-risk-matrix), drug-mapper.engine, getPharmaLabMarkers, detectActivePedClasses, CalcPEDCard (id канонизируются при добавлении), mapper-ctx и buildTzInput (legacy id из старых сохранений резолвятся в DRUG_DB).

### Категории и правила (0 'other' для PED)
- classifyPed: `dhb→aas_dht_inject`, `ins_*→insulin`, `trest→aas_nandrolone`, `s23→sarm`, `superdrol→aas_oral_other`, `trena→aas_oral_tbol`, `methand→aas_oral_dbol`, `stan→aas_oral_winny`, `oxan→aas_oral_anavar`, GH-пептиды→gh, GLP-1→**новый класс glp1** (semaglutide/tirzepatide).
- POTENCY_FACTORS: все канонические ключи (tren_acet 3.0 — было 1.0!, tren_hex 4.0, bold_undec 0.7, prim_enan 0.5, drostanolone 0.9, oxan 0.8, stan 2.0, trena 1.5, methand 3.5, superdrol 4.0, s23 1.0, igf1_des 3.5, ins_* 0.85-1.0, GH-пептиды 0.4, GLP-1 0.5, DHB 0.8).
- ped-risk-matrix: правила для trena/prim_enan/methyltest/инсулинов/GLP-1/yk11; lab-marker-map: фикс опечатки `oximetholone→oxymetholone` + канонические ключи; drug-mapper: `trena→turinabol`, `superdrol→superdrol`, GLP-1→glp1 (+3 записи в DRUG_DATABASE); ped-class-matrix: +3 класса (sarm/dht_inject/glp1).

### Дигидроболденон (DHB)
- Категория → **`dht_inject`** (5α-восстановленный болденон, DHT-подобный). `derivePEDFlags.hasBold` сохранён для DHB (фибринолитики продолжают назначаться).
- Новые эфиры: **`dhb_acetate`** (~48ч), **`dhb_propionate`** (~108ч) — pharma-db (PK), DRUG_DB (мехи+halfLife), POTENCY 0.8, PED_LIST, lab-markers, drug-mapper.
- ped-risk DHB: hemato high + cardio moderate + hepatic moderate.
- Класс `dht_inject` добавлен в PHARMA_CLASSES (каталог) и фильтр AutoCalculator (DHB попадает в курс).

### PED-риски по 7 системам (тренболон/нандролон дают «реальные риски»)
- `PedSubstanceRisk`/`PedRiskAssessment` += **hepatic/cardio/renal/reproductive** (в дополнение к neuro/joints/hemato), все 25 правил с дозовыми тирами:
  - Трен 500: neuro high + cardio high + hepatic moderate + renal moderate + rep high; пороги 200/500/800 (AGENTS)
  - Нанд 400: cardio moderate + rep high + hemato high + joints protective; пороги 300/500
  - Оралы: hepatic high; DHB: hemato high + cardio moderate
- UI: PED-баннер калькулятора показывает 🫁/❤️/🫘/🧬 измерения с причинами; баннер показывается при ЛЮБОМ gross-тире (был баг: только neuro).
- ВАЖНО: новые риски систем — ТОЛЬКО отображение; бустер-тиры/покрытие/residual остаются для neuro/joints/hemato (по решению). «Вредная» поддержка (отрицательные k) НЕ вводится.

### Остальные модели риска — поддержка учитывается
- V7 `SUPPORT_REDUCTIONS`: алиасы canonId (nac→NAC, tudca→TUDCA, vitamin_d3→vitaminD, zinc/curcumin/selenium/taurine/anastrozole/cabergoline) + расширена основными назначениями плана (agmatine/hesperidin/dandelion/astragalus/фибринолитики/бергамот/бетаин/кордицепс/цитруллин/пикногенол/чеснок).
- `computeResidualRisk`: recommended = бустеры по тиру ∪ поддержка из правил (perSubstance.support).
- rebound-modeling: `ReboundInput.supportSubs` — каберголин/P5P→PRL, AI→E2, hCG→LH/FSH быстрее; UI карточки «Прогноз ребаунда» передаёт subs плана.
- SUPPLEMENTS_DB: k-записи для lamotrigine/p5p/vitex/tadalafil/niacin (бустеры без мех-записей).

### Тесты
- `ped-catalog-audit.test.ts` (102): алиасы, категории всех препаратов, potency, 7-системные риски, residual, lab-маркеры, V7, rebound, мех-модель.
- `support-calc-ped-e2e.test.ts` (13): сквозной конвейер калькулятора (трен/DHB/нанд/метан/SARM/GLP-1 → категории-риски-протокол-план).
- `calc-ped-banner.test.tsx` (3): UI-баннер.
- Полный прогон: **4434/4435** (падает только чужой bb-back-quality из-за незакоммиченного рефактора другого агента).

---

## Current project state (Aug 12 2026)

### Build status
- `tsc --noEmit` - 0 errors (entire project clean)
- `vite build` - OK
- `vitest` - **3918 passing** (238 test files)

---

## Support Calculator Full Verification + Commit (Aug 12 2026, pushed b5344a43d)

Полная верификация всей работы по калькулятору поддержки (вчера-сегодня): всё присутствует, работает, **закоммичено и запушено** (b5344a43d, 20 файлов, +1132/−335). Больше не потеряется.

### Что проверено (всё OK)
- `tsc --noEmit` 0 ошибок, `vite build` OK, **vitest 3918/3918** (238 файлов)
- Тесты калькулятора поддержки: **240/240** (9 файлов: pharmacology-mandatory 7, tz-spec-risk-invariants 3, ped-risk-matrix, support-calc-audit 42, tz-bridge-boosters-tiered, support-new-substances, support-profile-autopull, hydrate-crash, interactions-calculator) + 106 PED-тестов BB
- Все части на месте: ped-risk-matrix, boosters LV1-LV3 (+getHematoBoosterSubstanceIds), 15 веществ в БД/дозировках/каталоге (+lamotrigine в каталоге), UnifiedSettings-поля (17 шт.), hydrateState читает he_profile_v2 nested, кнопки «Из профиля» (Calc.mapper:1338/2487), 32 протокола поддержки

### Что в коммите b5344a43d
- `engine.ts` — resolvePlan единый источник правды (legacy fallback), каберголин только lab-gated (PRL>25), база курса hydration/cardio_aerobic/electrolyte_balance (не таблетки), cardio/hemato контуры высокой PED-нагрузки, бюджет AUTO_PLAN_LIMIT (28/40/48/56), protocolWarnings, timeline peak patch
- `tz-mapper-engine.ts` — procedures (эритроцитаферез/флеботомия/гематолог/ТГВ-оценка), assayWarnings, nebivolol, agmatine-профиль нандролона, нейро-трио тренболона (Mg-L-треонат/PS/B12), расширенный monitoring plan
- `Calc.mapper.tsx` — GENERIC_ENHANCEMENT_CONFIG 7 систем + SPECIALIZED_DOMAINS 28 доменов, finalRec merge с лимитом уровня/contra/конфликтами, парные синергии, planItemKind, категоризированные отчёты плана/врача, имена базы
- `CalcSafetyLayer.tsx` — секции: фарм-ограничения, конфликты плана, мед-эскалация, интерпретация анализов
- `substances.ts` FOUNDATION_ITEMS + NON_PILL_SUPPORT_IDS; `display.ts` pill burden без базы; `shared-constants.ts` canonId lowercases + blacklist 6 рецептурных; `risk-engine-tz-spec.ts` phaseDoseMultiplier; `tz-bridge-mechanism.ts` TOTAL_LIMIT 28/40/48
- NEW: `mapper-ctx.ts` (единый buildMapperCtx), `pharmacology-mandatory.test.ts` (7), `tz-spec-risk-invariants.test.ts` (3)
- Фиксы: matchMedia mock в `src/test/setup.ts` (чинил реальное падение diary-hub-tabs-smoke), русские имена базы в Calc UI (FALLBACK_NAMES), ocr-engine.ts providerResults refLow/refHigh тип (tsc)

### ВАЖНО — «Symptom Solver Critical Audit» (Aug 12) — НЕ СУЩЕСТВОВАЛ
Форензика git (`git log -S` по всем веткам/стэшам/dangling-объектам, `git log --all -- src/ui/screens/SymptomSolver/`):
- `src/ui/screens/SymptomSolver/` **никогда не существовал** в репозитории
- функций `updateStatsTotals/topCulprit/countActiveSymptoms/perBodySystemStats/NON_LINEAR_SCALES/analyzeAndScoreSymptoms` и `толудин/толуидин` **нет ни в одном коммите истории**
- `symptom-solver-audit.test.ts` не существует
- Предыдущая секция AGENTS.md с этим аудитом была ошибочной (описывала несуществующую работу) — удалена
- Текущий Symptom Solver — это справочно-поисковый движок (`symptom-solver.engine.ts` 79 строк: SYMPTOM_DB, findSymptomById, searchSymptoms; UI: `SupportScreen_parts/SymptomSolverTab.tsx` + `ComplaintsTab.tsx`), работает и покрыт тестами (symptom-diary-audit и др.)

### Не трогаем (WIP других агентов в worktree)
`bb-builder.engine.ts`, `DiaryRecordingForm.tsx`, `TrainingDiaryHub.tsx`, `NutritionDiary.tsx`, `nutrition-ocr-parser.ts`, `diary-cards.tsx`, `food-recognition-audit.test.ts`, `AGENTS.md` (до правки)

---

## ПЛАН — Калькулятор поддержки (ВЫПОЛНЕН, Aug 12 2026, pushed ab8849d9)

Всё под риск-ориентированную (механизм) модель. **Все 435 мех-веществ имеют мех-записи и каталог-описания** (0 пропущено). Механизмы в шкале 0-100% (rawPercent/afterPercent, сумма = системе) — «148 баллов» устранено. НОВЫЕ МЕХАНИЗМЫ/ОРГАНЫ НЕ ДОБАВЛЯЕМ — только 6 органов и 28 мех-кодов.

### P0 — ВЫПОЛНЕНО
- **P0-1:** единый строитель TzSpecInput (`buildTzInputCore` + `normalizeFlatLabs`) — калькулятор и вкладка «Риски» (ТЗ-спец) дают ИДЕНТИЧНЫЕ цифры до механизма; snapshot `he_calc_tz_input` — fast-path.
- **P0-2 (C3):** локальный hematoScore удалён — цвета/статус попапа «Кровь» от системного риска.
- **P0-4 (B2):** под-риски гемато-блока UI-only (эритроцитоз/метаболизм/электролиты из hem1-5) в попапе «Кровь» и отчётах.
- **P0-5:** нижние карточки структурированы: План → Образ жизни → Синергии+Взаимодействия (единый стиль, все пары синим) → Мониторинг (до курса→экстренно, ОАМ/почки/СОЭ/ИФР, маркеры прогресса, находки, панели, поддержка-мониторинг) → Преаналитика/приём/разнесение (одна карточка) → Предупреждения курса (+guardrails+эскалация) → Фарм-матрица → Питание → Мед.эскалация → Инъекции → Бустеры → Контроль дозировок → Противопоказания → ПКТ (самый низ) → Применить → CalcActions → Дисклеймер (наверху).

### P1 — ВЫПОЛНЕНО
- **P1-1:** CalcSystemPanel во всех попапах (риск+под-риски+мониторинг+противопоказания); preview риска X%→Y%.
- **P1-2:** бейджи «👨⚕️ под контролем врача» в списках попапов и отчётах.
- **P1-3:** дедуп пар (checkInteractions vs conflicts через excludePairs).
- **P1-4:** фарм-матрица 10 классов PED (`ped-class-matrix.ts`) + карточка по активным классам.
- **P1-5:** ASSAY_INTERFERENCE_DB (14) + PREANALYTIC_EFFECTS_DB (6) + SEPARATION_TIMING_DB + ADMINISTRATION_RULES_DB (~40) + SUBSTANCE_MONITORING_DB (22) — единая карточка «Преаналитика, приём и разнесение».

### P2 — ВЫПОЛНЕНО
- Экспорт (план/врачу): риски поддержки, системные риски+механизмы, фарм-матрица, мониторинг.
- Переносы текста во всех попапах и диалогах (overflowWrap/wordBreak).

### Новое в финале
- Полное покрытие каталога: `support-catalog-extras.ts` (28 ручных + автогенератор для всех 435 мех-веществ: имена/описания по механизмам/категория/органы/мониторинг).
- Дисклеймер наверх калькулятора; «О подборе» актуализирован.
- Анализы: ОАМ, почечный блок, ОАК с СОЭ, ИФР-1, системные панели в baseline; мониторинг по препаратам поддержки и курса; «Маркеры прогресса» (TT/FT, E2, SHBG, IGF-1, кортизол, ТТГ, PRL, ферритин, D3, B12, цинк) — причины отсутствия прогресса.
- Структура без дублей: база только в «Образ жизни», пары только в «Разнесении», находки/панели только в мониторинге.

---

## Injection Diary Audit Round (Aug 11 2026, committed 4fabcf41e)

Полный аудит дневника инъекций: 6 багов + 5 доработок. Без интеграции с калькулятором поддержки (работа другого агента не тронута).

### Багфиксы
1. **P1: `infectionZones.add(a.date)` вместо зоны** — `injection-diary.engine.ts` — рекомендация показывала «Признаки инфицирования в 2026-08-05». `InjectionAnomaly` += `zone: string` (проставляется во всех категориях: pip/swelling/pain/infection/rotation/frequency), рекомендации используют `a.zone`.
2. **P1: дедуп быстрой модалки по дате целиком терял 2-й укол за день** — новый `findByDateAndSubstance` (diary-modals.tsx), баннер и `ProfileDiariesTab.onSave` матчатся по (дата + препарат, регистронезависимо). Тест «другой препарат за ту же дату НЕ даёт баннер».
3. **P2: дублированная ротация в модалке** — `getSuggestedZoneSide()` в движке (зона+сторона, приоритет отдохнувшим использованным, неиспользованные — в конец, tie-break по безопасности зоны); модалка теперь использует движок (не предлагает бицепс/икры новичку).
4. **P2: нет валидации «объём/техника vs зона»** — `getZoneCompatibilityIssues(zone, technique, volumeMl)` (водные-only зоны + масляный в/м, превышение maxVolumeMl, «очень высокий риск»). Баннеры в модалке и полном редакторе.
5. **P2: undo `restore()` перегенерировал id** — `replaceInjectionDiary(entries)` сохраняет id как есть.
6. **P3: `substanceAdvice` привязан к последней записи** — селектор препарата в карточке «Техника инъекций».

### Доработки
- **🌡 Fever (температура)**: новое поле `fever?` в `InjectionEntry` (миграция legacy → false), чипы в обеих формах, колонка CSV/печать/флаги журнала, аномалии: fever+покраснение/уплотнение → danger infection, fever alone → warn.
- **📅 Расписание инъекций** — NEW `src/engines/injection-schedule.engine.ts` (`he_injection_schedule`): CRUD (add/update/remove/save), дни недели Пн=0…Вс=6, `computeScheduleAdherence` (planned/actual/pct за N недель), `getDueToday`, `getNextScheduledDate`, `getMissedInjections` (пропущенные за 7 дней), `getScheduleSummary`. UI в InjectionDiary: баннер «Сегодня по плану» + «✍ Записать» (префилл редактора), «⏭ Пропущено», список с чипами дней и прогресс-баром соблюдения, редактор пункта.
- **💊 Суммарные дозы** — `getDoseSummary(entries, days)` (по препарату+единице: total/count/avg, окно 7/30) + карточка в статистике.
- **➕ Пакетный ввод** — «💾 Сохранить и ещё» в модалке (footer кастомный, сохраняет и продолжает) и «➕ Сохранить и ещё» в полном редакторе (сбрасывает только боль/реакции).

### Tests
- NEW `src/engines/__tests__/injection-diary-improvements.test.ts` — **23 теста**: anomaly zone (4), fever (4), рекомендации-инфекция по зонам (1), getSuggestedZoneSide (5), getZoneCompatibilityIssues (4), getDoseSummary (2), replaceInjectionDiary (3).
- NEW `src/engines/__tests__/injection-schedule.test.ts` — **26 тестов**: дни недели (5), CRUD (5), getDueToday (2), getNextScheduledDate (3), adherence (6), missed (3), summary (2).
- MOD `diary-modals-audit.test.tsx` — тест баннера инъекции переведён на ввод препарата + новый тест «другой препарат — без баннера».
- Verification: tsc — мои файлы чисты (2 ошибки в worktree — параллельная работа другого агента: `health-improvement-plan.engine.ts` ctx, `HealthDiary.tsx` visibleDateSet), vitest ProfileScreen_v2 + 4 инъекционных файла **455/455**, `vite build` OK.

### Files
- MOD: `src/engines/injection-diary.engine.ts` (anomaly zone, fever, getSuggestedZoneSide, getZoneCompatibilityIssues, getDoseSummary, replaceInjectionDiary)
- NEW: `src/engines/injection-schedule.engine.ts`
- MOD: `src/ui/screens/ProfileScreen_v2/diary-modals.tsx` (findByDateAndSubstance)
- MOD: `src/ui/screens/ProfileScreen_v2/injection-diary-modal.tsx` (движок-ротация, баннеры совместимости, fever, дедуп, «Сохранить и ещё»)
- MOD: `src/ui/screens/ProfileScreen_v2/ProfileDiariesTab.tsx` (дедуп по дате+препарату)
- MOD: `src/ui/screens/ProfileScreen_v2/diaries/InjectionDiary/InjectionDiary.tsx` (fever, restore ids, advice-селектор, дозы, расписание, save-more)
- NEW: 2 test files (49 тестов)

---

## Diary Modals Round 3 — Reset-guard, stale-чипы, умные дефолты (Aug 10 2026, committed 4fabcf41e)

Третья ротация дневниковых модалок Профиля v2 (поверх коммита 95e5593d6, незакоммичено — 11 файлов + 25 новых тестов).

### 1. Reset-политика черновиков (`diary-modals.tsx` + все 5 модалок)
- `useDiaryDraft` теперь возвращает `reset(next?)` вместо `clear`; `skipPersist` guard:
  после сохранения storage удаляется, а первый persist-эффект (свежий дефолт `initial()`) **пропускается** — мусорная перезапись «следующий залив дефолт» устранена.
- Все 5 save() переведены с `clearDraft()+setDraft(initial())` на `resetDraft()`.

### 2. Stale-чип «🕒 N дн. назад» в шапке DiaryModalShell
- Новые экспорты: `daysSince(lastDate)` (0=сегодня, null=нет записей), `daysAgoLabel`, `staleColorFor` (≥14дн — красный, ≥7 — оранжевый, ≥3 — янтарный), `stale?: {days} | null` prop.
- Подключён во всех 5 модалках (сон, АД, вес, инъекция, здоровье).

### 3. Умные дефолты из последней записи
- **АД**: пофикшен баг приоритета `last?.pulse ?? last?.hr ? x : '70'` (тернарник поверх `??`) — вынесено в `lastPulse` с проверкой `> 0`.
- **Сон**: `awakenings` теперь наследуется из последней записи.
- **Инъекция**: авто-ротация стороны (последняя left → предлагается right и наоборот) + зона из последней записи; добавлен спарклайн боли за 7 дней.

### 4. Undo-очередь вынесена в diary-modals (тестируемость)
- `pushUndoAction(q, label, undo)` (кап 5, TTL 5с), `topUndo`, `dismissTopUndo`, `UNDO_TTL_MS`, `nextRoutineStep('sleep'|'bp'|'weight') → следующий шаг утреннего рутинга`.
- `ProfileDiariesTab` использует их для undo ×5 и цепочки «сон → давление → вес».

### 5. UI polish (diary-modals.tsx)
- Градиентная подложка модалки + blur 14px, анимация `dm-pop`, focus-кольцо инпутов (rgba(0,230,138,0.5)), hover-классы (dm-close-btn/dm-ghost-btn/dm-primary-btn), icon-box с градиентом.
- Sparkline: area-заливка градиентом + точка на последнем значении (useId для градиента).
- Секции/карточки/чипы/степперы: скругления 12-14px, тени, min-height 46.

### 6. body-measurements: `alert()` → `showToast` + try/catch compressImage.

### Tests
- NEW `src/ui/screens/ProfileScreen_v2/__tests__/diary-modals-audit.test.tsx` — **25 тестов**: daysSince (6: сегодня/вчера/дней/будущее/invalid/пусто), daysAgoLabel (4), staleColorFor (4), pushUndoAction (2), topUndo/dismiss (2), nextRoutineStep (3), useDiaryDraft (2), DiaryModalShell stale-чип (2).
- Verification: `tsc --noEmit` 0 ошибок, целевой тест-файл 25/25, `vite build` OK.

### Not ours in worktree (другой агент, uncommitted)
- `TrainingScreen.tsx` / `nav.ts` / `DiaryAnalyticsZone.tsx` / `TrainingDiaryHub.tsx` — переименование tab id (insights→analytics, strength→history, +progress/reports), удалён внутренний MODES-селектор в TrainingDiaryHub.

---

## Diary Modals Round 4 — Предупреждение о замене записи за дату (Aug 10 2026, committed 4fabcf41e)

Поверх Round 3 (a536cf2d). Все 5 onSave уже дедуплицируют по дате (`filter(x => x.date !== e.date)`), но пользователь не знал, что старая запись молча заменится.

### Что сделано
- **`findByDate(entries, date)`** — новый экспорт в diary-modals.tsx: запись за конкретную дату.
- **Баннер «Запись за {date} уже есть: … — при сохранении будет заменена»** (FormBanner warning) в 4 модалках:
  - **Сон**: summary `{hours} ч · качество {label}` (тип SleepRec расширен полем `quality`)
  - **Вес**: summary `{weight} кг`
  - **Инъекция**: summary `{substance} {dose}`
  - **Здоровье**: без summary
- Баннер зависит от `draft.date` (пересчитывается при смене даты) и от `open`.
- **Undo-лейблы стали точными**: ProfileDiariesTab определяет `replaced = prev.some(x => x.date === e.date)` и показывает «Запись {X} обновлена» вместо «добавлена» (сон, вес, инъекция, здоровье). Утренний рутинг сохраняет свой лейбл.

### Tests
- `diary-modals-audit.test.tsx` — теперь **35 тестов** (+10): findByDate (4: найдено/нет/пусто/без дат), баннер сна (2), баннер веса (2), баннер инъекции (1), баннер здоровья (1). Проверка внутри `role="status"` (в модалке текст встречается и в других местах — подсказки/чипы).
- Verification: `tsc --noEmit` 0 ошибок, ProfileScreen_v2 178/178, `vite build` OK.

---

## BB-auto Full Critical Audit (Aug 10 2026)

Полный критический анализ всех параметров ББ-авто: методика порядка (compound_first/pre_exhaust/post_exhaust), специализация по слабым точкам, методика финиша (taper/peak week), профицит калорий, эксцентрик, cross-mesocycle continuity, feeders. Найдено и исправлено **10 багов** (5 P0 + 3 P1 + 2 P2).

### P0 — Критические (5)

1. **P0-1: Методика порядка сломана для cycle/program путей** — `tidySessionExercises` хардкодил `compound_first`, игнорируя выбор пользователя (pre_exhaust/post_exhaust). `finalizeBBPlan` не пробрасывал `methodology`. Выбор методики в UI не имел эффекта для циклов/программ. Fixed: добавлен параметр `methodology` в `tidySessionExercises`, `finalizeBBPlan` пробрасывает `options.methodology`.
2. **P0-2: Специализация не работала для гранулярных слабых групп** — `expandWeakForSpecialization` разворачивал только `shoulders→delt_*`, но `chest_upper`, `back_width`, `back_thickness`, `chest_lower` оставались неразвёрнутыми. `landmarksForRotation('chest_upper')` возвращал null → объём 0. `collapseKey` не коллапсировал гранулярные в канонические. Fixed: разворот через `WEAK_TO_MUSCLE`, `collapseKey` теперь коллапсирует гранулярные.
3. **P0-3: cycle-to-plan `weakPoints.includes(muscle)` без маппинга** — для `weakPoints=['chest_upper']` и `muscle='chest'` возвращал false → бонус объёма не применялся. Fixed: экспортирован `isWeak` из `bb-builder`, заменяет `weakPoints.includes` в обоих функциях (`convertCycleToBBPlan`, `programToBBPlan`).
4. **P0-4: `eccentricMult` не применялся в cycle-to-plan** — UI передавал параметр, но движок игнорировал. eccentric overload (Schoenfeld 2021) не работал для циклов/программ. Fixed: `applyEccentricOverloadToPlan` применяет `eccentricMult` к primary (с пропуском deload).
5. **P0-5: `suggestFeeders` — несоответствие ключей гранулярных групп** — UI использует `chest_upper`, а в `suggestFeeders` был case `upper_chest` (не matches!). Также отсутствовали `chest_lower`, `back_width`, `back_thickness`. Feeders не добавлялись для гранулярных групп. Fixed: добавлены case для всех гранулярных ключей.

### P1 — Важные (3)

6. **P1-5: bb-selector `freq[гранулярная] = 0`** — `freq['chest_upper']` всегда 0 (нет такой мышцы в TAG_MUSCLES) → бонус слабых групп не срабатывал. Fixed: маппинг через `WEAK_TO_MUSCLE`.
7. **P1-6: bb-weakpoint.ts `planWeakPoints` не маппил гранулярные** — `weakPoints.includes(m)` для гранулярных возвращал false → UI-отображение специализации показывало неверные данные. Fixed: `muscleIsWeak` с маппингом, `expandToCanonical` для emphasisList.
8. **P1-7: `previousPlan` не передавался в cycle/program пути** — cross-mesocycle continuity работал только для generic split. Fixed: `previousPlan` добавлен в `CycleToPlanInput` и `ProgramToBBPlanOpts`, `applyWeightProgression` применяется в adapt режиме.

### P2 — Качество (2)

9. **P2-8: Peak week хардкодил `mens_physique`** — нет выбора категории. Fixed: state `peakWeekCategory` + селектор (Men's Physique / Classic / 212 / Open / Bikini / Figure / Wellness) с перегенерацией протокола.
10. **P2-9: `post_exhaust` = `compound_first`** — не было различия. Fixed: в `rankKey` для `post_exhaust` изоляция primary мышцы получает `tier=1` (сразу после compound, приоритетнее других изоляций).

### Files modified (9)
- `src/engines/bb/bb-session-order.engine.ts` — P0-1 (tidySessionExercises + methodology), P2-9 (post_exhaust tier)
- `src/engines/bb/bb-finalize.engine.ts` — P0-1 (проброс methodology в tidySessionExercises)
- `src/engines/bb/bb-builder.engine.ts` — P0-2 (expandWeakForSpecialization + collapseKey гранулярные), экспорт `isWeak`/`WEAK_TO_MUSCLE`
- `src/engines/bb/cycle-to-plan.ts` — P0-3 (isWeak), P0-4 (applyEccentricOverloadToPlan), P1-7 (previousPlan в обоих функциях)
- `src/engines/bb/bb-selector.engine.ts` — P1-5 (freq маппинг через WEAK_TO_MUSCLE)
- `src/engines/bb/bb-weakpoint.ts` — P1-6 (muscleIsWeak + expandToCanonical)
- `src/engines/bb/bb-autocoach.engine.ts` — P0-5 (suggestFeeders гранулярные: chest_upper/chest_lower/back_width/back_thickness)
- `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — P1-7 (previousPlan в cycle/program ветки), P2-8 (peakWeekCategory state + селектор)
- NEW: `src/engines/bb/__tests__/bb-audit-2026-08-extended.test.ts` — **42 теста** (P0-1: 5, P0-2: 5, P0-3: 5, P0-4: 2, P0-5: 4, P1-5: 3, P1-6: 6, P1-7: 2, P2-8: 1, P2-9: 3, E2E cycle-to-plan: 6)

### Verification
- `tsc --noEmit` — 0 ошибок
- `vitest run` — **2644/2644 passing** (211 test files), +42 новых теста
- `vite build` — OK

---

## Profile Diaries: Undo + Morning Routine + Health Draft (Aug 10 2026)

Доработка вкладки «📓 Дневники» Профиля v2: отмена последнего добавления, утренний лог-рутинг, черновик записи здоровья.

### 1. Undo для быстрых модалок (`ProfileDiariesTab.tsx`)
- Каждый из 5 onSave (сон, давление, вес, инъекция, здоровье) теперь вызывает `pushUndo(label, undo)` — восстановление предыдущего состояния:
  - **Сон**: `saveDiary(SLEEP_DIARY_KEY, prev)` + `setSleepEntries(prev)`
  - **Давление**: `commitBpEntries(prev)` (prev = `getBpEntries()` до добавления)
  - **Вес**: `saveWeightLog(prev)` + `setWeights(prev)`
  - **Инъекция**: `saveDiary(INJECTION_DIARY_KEY, prev)`
  - **Здоровье**: полный откат всех 6 ключей (unified + pain + neuro + acne + hemato + symptoms) с prev-массивами
- Snackbar «↩ Отменить» (уже существовал, 5с) теперь реально работает для добавлений из карточек дневников.

### 2. Утренний лог-рутинг («🌅 Утренний лог: сон → давление → вес»)
- Кнопка в виджете «Сегодня заполнено» (кольцо прогресса): запускает цепочку из 3 модалок.
- `routine: 'sleep' | 'bp' | 'weight' | null` — после сохранения сна открывается давление, затем вес; после веса — завершение.
- Прогресс-полоса (1/3 → 2/3 → 3/3) + кнопка ✕ отмены; закрытие модалки вручную отменяет рутинг.
- Финальный шаг (вес) получает особый undo-лейбл «🌅 Утренний лог завершён · вес записан».

### 3. Черновик записи здоровья (`health-diary-modal.tsx`)
- **Draft persistence**: всё содержимое формы (дата, заметка, pain/symptoms/neuro/acne/hemato) сохраняется в `sessionStorage` (`he_draft_health`) при каждом изменении и восстанавливается при повторном открытии — переживает закрытие модалки и переключение вкладок.
- `savedRef` guard: после успешного сохранения черновик очищается и не перезаписывается сброшенным состоянием.
- **FormBanner (info)**: «Заполните хотя бы один раздел — кнопка "Сохранить" активируется», когда `hasAnyData = false`.

### 4. Модалки разнесены по файлам (4 новых файла)
Архитектура quick-add модалок: `diary-modals.tsx` = только shared-компоненты (DiaryModalShell, SectionCard, ScalePicker, StepperInput, ChipGroup, TextField, FormBanner, Sparkline, LiveBadge, DateInput, Modal, TodayChip, RepeatLastChip, readDiaryEntries, lastEntryOf, useDiaryDraft, bpCategory больше не тут) + реэкспорты. Каждая модалка — отдельный файл:
- `sleep-diary-modal.tsx` — AddSleepModal (умный дефолт часов/режима из последней записи, спарклайн 7 дней, валидация, coherence-warning)
- `bp-diary-modal.tsx` — AddBPModal + `bpCategory` (классификация АД, спарклайн, валидация криза ≥180)
- `body-measurements-modal.tsx` — AddBodyMeasurementsModal (дельта веса vs прошлое, подсказки «было N», фото со сжатием, «Повторить прошлые замеры»)
- `injection-diary-modal.tsx` — AddInjectionModal (ассистент ротации зон, память дозы по препарату, чипы препаратов, шкалы боли/PIP/отёка, реакции)
- `diary-modals.tsx` — реэкспорты: `AddSleepModal`, `AddBPModal`+`bpCategory`, `AddBodyMeasurementsModal`, `AddInjectionModal`, `AddHealthModal` (из `health-diary-modal.tsx`)
- Все модалки: черновики в sessionStorage (`he_draft_sleep/bp/weight/injection/health`), «Повторить последнюю», TodayChip, autofocus, блокировка скролла.

### Files modified
- `src/ui/screens/ProfileScreen_v2/ProfileDiariesTab.tsx` — undo ×5, routine state + widget-кнопка + прогресс, onClose-отмена рутинга
- `src/ui/screens/ProfileScreen_v2/health-diary-modal.tsx` — draft restore/persist (sessionStorage), savedRef, FormBanner
- `src/ui/screens/ProfileScreen_v2/diary-modals.tsx` — обрезан до shared + реэкспорты, TodayChip/RepeatLastChip стали export
- NEW: `src/ui/screens/ProfileScreen_v2/sleep-diary-modal.tsx`, `bp-diary-modal.tsx`, `body-measurements-modal.tsx`, `injection-diary-modal.tsx`

### Verification
- `tsc --noEmit` — 0 ошибок
- `vitest run` — 2644/2644 passing (211 test files; изредка флейки-таймауты profile-e2e/course-sync на полном параллельном прогоне, по отдельности проходят)
- `vite build` — OK

---

---

## Support Calculator PED-Risk Audit (Aug 6 2026)

Полная переработка калькулятора поддержки: PED-risk-based triggering нейро/суставы, tiered LV1-LV3 бустеры по статье «Нейротоксичность ААС» + Суставы.txt, автоподтягивание из профиля v2, 15 новых веществ в БД и каталоге. 3 этапа, 199 новых тестов.

### ЭТАП 1 — PED-risk matrix + tiered boosters

**NEW `src/engines/ped-risk-matrix.ts`** — полная матрица рисков:
- 20+ AAS с дозовыми порогами (трен 200/500/800, стан 20/30 мг/день, нандролон 300/500, тест 250/750, superdrol, trestolone, mibolerone, methyltrienolone, и т.д.)
- 7 SARMs (RAD-140=moderate neuro, S-23=moderate, ostarine=protective joints, LGD, andarine, sr9009, cardarine)
- 7 пептидов/GH (GH 3/6/10 IU дозозависимый, IGF-1, MGF, GHRP, GHRH, MK-677)
- Компенсация: нандролон + станозолол → high→moderate (COLLAGEN_SYNTHESIS)
- Эскалации: 2+ moderate neuro → high; 2+ 19-нор → high; 3+ PED → +1 уровень
- ID-маппинг: substring-паттерны для trestolone/superdrol/proviron (classifyPed=other fallback)
- `assessPedRisk(pedDoses, level)` → `{ neuroBoosterTier, jointsBoosterTier, triggeredBy }`

**`src/engines/tz-bridge-boosters.ts`** — LV1-LV3 tier selection:
- NEURO_BOOST: LV1 (16 веществ: agmatine★, NAC★, таурин★ + Mg/ashwagandha/theanine/glycine/gaba/rhodiola/ALCAR/B6/apigenin/magnolia/Mg-L-threonate/tryptophan/alpha-lipoic) → LV2 (8: прегненолон, инозитол, цитиколин, lions_mane, PS, бакопа, астаксантин, **grandaxine**) → LV3 (6: fasoracetam, bromantane, noopept, **dihexa**, **tropoflavin**, **phenylpiracetam** + 3 alternate groups: NMDA [memantine/lamotrigine/amantadine], противотревожная [fluvoxamine/naltrexone], α2 [guanfacine/tizanidine])
- JOINTS_BOOST: LV1 (9: коллаген, глюкозамин, хондроитин, босвеллия, MSM, куркумин, гиалурон, вит.C, омега-3) → LV2 (10: UC-II, кремний, марганец, D3, K2, Ca, бор, **havinson_a4**, **ligamentide**, **voltaren_gel**) → LV3 (3: **BPC-157+TB-500+GHK-Cu** — протокол из Суставы.txt)
- `BoosterTriggerCtx` += `symptomNeuro`, `symptomJoints`, `forceNeuro`, `forceJoints`, `pedNeuroTier`, `pedJointsTier`, `pedRiskReasons`
- `shouldActivateNeuro/Joints` — приоритет: PED-risk > force > symptom > state-estimate
- `applyBoosters` выбирает tier = `max(pedTier, symptomTier, stateTier, forceTier)`, берёт `LV1..LV{tier}`
- LV3 нейро — селективные пары (memantine ИЛИ lamotrigine ИЛИ amantadine — не стекать NMDA-антагонисты)
- Helper: `getNeuroBoosterSubstanceIds(tier)`, `getJointsBoosterSubstanceIds(tier)` для UI авто-выбора

**`src/engines/tz-mapper-engine.ts`** — интеграция:
- Priority=2 для tier≥2 бустеров (выживают TOTAL_LIMIT trim)
- Post-trim safety net на `max`: обязательная нейрозащита (Mg+ashwagandha+theanine) + суставы (collagen+glucosamine+msm), даже если trim срезил всё
- PED-risk reasons в summary для UI
- `pedRisk: PedRiskAssessment` в `SupportRecommendation` и `MapperCtx`

**`src/ui/screens/Calculator/Calc.mapper.tsx`** — UI:
- `assessPedRisk(pedDoses, level)` в `buildMapperCtx`
- PED-risk баннер: «⚡ Авто-защита по стеку PED» с Neuro/Joints LV/tier/причинами
- Кнопки «Суставы»/«Нейро» — **AUTO LV{tier}** badge когда PED триггерит бустер
- Попапы «Суставы»/«Нейро» — **⚡ PED AUTO** preset: авто-выбор веществ по tier
- Попапы — PED-risk в score и контекст-баннере

### ЭТАП 2 — Профиль и автоподтягивание

**`src/core/types.ts`** — новые поля UnifiedSettings:
- `health.gabaBalance`, `health.coordinationIssues`, `health.sleepQuality`, `health.jointPainSeverity`
- `pharma.hasCaber/hasGH/hasIGF/hasInsulin/hasSERM/hasSARMs/hasMGF/hasGLP1/ghIU/insulinIU/igfMcg/clenMcg/t3Mcg`

**`src/engines/support-plan/engine.ts:hydrateState()`** — полностью переписан:
- Nested чтение из `he_profile_v2` (personal/lifestyle/health/pharma/symptoms/labs)
- Нормализация `aggressionScore` 1-5 → 0-10 (×2)
- Конвертация `jointPain` boolean → enum / `jointPainSeverity` → enum
- Adapter `symptoms.recent` → `string[]` активных симптомов
- Adapter `labs.summary` → flatPanel для калькулятора
- Маппинг pharma: `currentSubstances` → `aas`, `hcgEnabled` → `hasHCG`, дозы PED напрямую

**`src/ui/screens/Calculator/Calc.mapper.tsx`** — кнопки автоподтягивания:
- «📋 Из профиля» рядом с pill-кнопками симптомов (загрузка из `symptoms.recent`)
- «📋 Из профиля (neuro/oda/pharma)» — глобальная синхронизация neuro/oda/pharma/healthConditions из профиля

### ЭТАП 3 — Вещества в БД и каталоге

**15 новых веществ** (источник: ТЗ «Нейротоксичность ААС» + «Суставы.txt»):

Нейро (9): grandaxine (тофизопам), dihexa, phenylpiracetam, tropoflavin (7,8-DHF), fluvoxamine, amantadine, naltrexone (LDN), guanfacine, tizanidine
Суставы (6): havinson_a4, havinson_a19, ligamentide, neovitin, voltaren_gel, artra

Добавлены в:
- `src/data/support-db/supplements.ts` — мехи ТЗ (cns1-4, cv1, hem2)
- `src/data/support-dosing.ts` — дозировки, warnings, evidenceLevel, protocolRefs
- `src/data/support-catalog-data.ts` — **полные каталог-записи** (id, name, nameRu, tier, category, forms, organs, systems, mechanisms, description, synergies, conflicts, monitoring, contraindications, sideEffects, dosage, bestForCourse, specialInstructions, targetOrgan, organMechanism, mechanismOfAction, clinicalEffect, bestForm, analog)
- lamotrigine — новая полная каталог-запись (memantine/fasoracetam/noopept/bromantane уже были в каталоге)

### Тесты (199 новых)

- `src/engines/__tests__/ped-risk-matrix.test.ts` — **37 тестов**: AAS дозозависимость (13), SARMs (4), пептиды (6), компенсации (2), эскалации (3), tier mapping (5), ID-маппинг edge cases (4)
- `src/engines/__tests__/tz-bridge-boosters-tiered.test.ts` — **35 тестов**: shouldActivate (10), tier selection NEURO (7), tier selection JOINTS (3), дедупликация (1), max tier (2), оба бустера (1), структура бустеров (6), LV3 alternates (5)
- `src/engines/__tests__/support-profile-autopull.test.ts` — **15 тестов**: nested чтение, нормализация шкал, adapter symptoms/labs, phase маппинг
- `src/engines/__tests__/support-new-substances.test.ts` — **38 тестов**: SUPPLEMENTS_DB (15), SUPPORT_DOSING (15), SUPPORT_CATALOG_DATA полные записи (8)

### Files modified (9)
- NEW: `src/engines/ped-risk-matrix.ts` (330 строк)
- MOD: `src/engines/tz-bridge-boosters.ts` — LV1-LV3, tier selection, helper functions
- MOD: `src/engines/tz-mapper-engine.ts` — priority fix, post-trim safety net, pedRisk field
- MOD: `src/ui/screens/Calculator/Calc.mapper.tsx` — boosterCtx wiring, PED-risk баннеры, AUTO badges, PED-AUTO presets, кнопки «Из профиля»
- MOD: `src/engines/support-plan/engine.ts` — hydrateState nested чтение
- MOD: `src/core/types.ts` — новые поля UnifiedSettings
- MOD: `src/data/support-db/supplements.ts` — +15 веществ
- MOD: `src/data/support-dosing.ts` — +15 дозировок
- MOD: `src/data/support-catalog-data.ts` — +16 полных каталог-записей (15 новых + lamotrigine)
- NEW: 4 test files (125 тестов)

### Ключевые сценарии

| Сценарий | Результат |
|----------|-----------|
| Тренболон 500мг на «База» | 🧠 NEURO LV3 авто (memantine+fasoracetam+bromantane+noopept+dihexa+tropoflavin+fluvoxamine+guanfacine) |
| Станозолол 50мг/день на «База» | 🦴 JOINTS LV3 авто (BPC-157+TB-500+GHK-Cu) |
| Стан + Нандролон | JOINTS moderate (частичная компенсация COLLAGEN_SYNTHESIS) |
| Тестостерон 250мг | Без forced бустеров (только по симптом-кнопке/«Усиление»/max) |
| «Максимум» без PED | Принудительная нейро+суставы база (post-trim safety net) |
| Нажатие «Бессонница» (pill) | NEURO LV2 (agmatine+NAC+таурин+прегненолон+...) |
| Кнопка «📋 Из профиля» | Загрузка neuro/oda/pharma/symptoms из UnifiedSettings |
| Попап «Суставы» + PED tier | ⚡ PED AUTO preset — авто-выбор веществ по tier |
| Попап «Нейро» + PED tier | ⚡ PED AUTO preset — авто-выбор веществ по tier |
| Фаза фертильности | Forced бустеры пропускаются (areBoostersAllowed=false) |

---

## BB-auto Training Generation Critical Audit (Aug 6 2026)

Полный критический анализ генерации тренировок ББ-авто: построение сессий, периодизация, прогрессия весов, MRV-кап, feedback loop. 20 исправлений (2 P0 + 4 P1 + 9 P2 + 4 доп) + 29 новых тестов. 4 false positive удалены после проверки.

### P0 — Critical fixes (2)
1. **A1: LegsBiceps TAG_PRIMARY missing biceps** — `bb-builder.engine.ts:1004`. `TAG_MUSCLES.LegsBiceps` включает `biceps`, но `TAG_PRIMARY_MUSCLES.LegsBiceps` — нет. Biceps всегда accessory на своём «дедицинном» дне. Сплит `pro_8_day` (единственный с LegsBiceps) был бесполезен для рук. Fixed: добавлен `'biceps'` в Set + `LegsBiceps` в `DUAL_PRIMARY_TAGS` (maxPrimaries=2 для quads+biceps).
2. **A5: Dead code** — `bb-builder.engine.ts:1114-1119`. `pedExerciseBoost`, `primaryBase`, `accessoryBase`, `accessoryBoost` — объявлены, но никогда не используются (exerciseCount использует inline ternaries). Fixed: удалены 4 строки + 3 комментария.

### P1 — Important fixes (4)
3. **B1: Peaking RIR flat 0** — `bb-builder.engine.ts:591`. `peaking` subtracted 1 from base → strength base=1-1=0 → RIR=0 for ALL 3 peaking weeks. 3 недели на failure нарушает supercompensation (Zatsiorsky 2006). Fixed: убран `-1` для peaking; drift естественным образом доводит RIR с 1 до 0 (strength W1=1, W3=0; hypertrophy W1=2, W3=1).
4. **B4: Reps midpoint = repCap** — `bb-builder.engine.ts:1080`. `reps = round((shiftedMin + shiftedMax) / 2)` = 13 для accumulation [10,15]. Но `prescribeLoad` repCap=12. 13 > 12 → W2 сразу +5% вес и reps=8 (нет окна для rep progression). Fixed: `shiftedMin` для non-deload (W1=10, W2=11, W3=12, W4=8+weight jump — корректный double progression).
5. **B5: prevEx exact name match** — `bb-builder.engine.ts:2342-2344`. `find(pe => pe.name === curEx.name)` fails при ротации/замене упражнений → вес не прогрессирует. Fixed: fuzzy fallback — нормализованный token overlap ≥2 OR substring для имён с 2+ tokens.
6. **B6: topSetOf by weight not e1RM** — `bb-progression-feedback.engine.ts:80-84`. 80кг×5 (e1RM=93) проигрывал 82кг×1 (e1RM=85). Fixed: выбор по `epley1RM(weight, reps)`.

### P2 — Quality fixes (9 из 10, 1 отменено)
7. **C1: Deload cascade** — `bb-builder.engine.ts:2338`. `weeks[wi-2]` может тоже быть deload → заниженная база. Fixed: цикл назад до первой non-deload недели.
8. **C2: Peak week floor=1** — `bb-peak-week.engine.ts:205,207`. `Math.max(1,...)` и `slice(0,1)` — 1 сет недостаточен. Fixed: floor=2, slice(0,2) (parity с taper fix A7).
9. **C3: Chinese chars** — `bb-builder.engine.ts:409`. `可控` (Chinese "controllable") в EXECUTION_NOTES. Fixed: `контролируемое`.
10. **C4: alert() → toast** — `BbAutoConstructor.tsx` (15 instances). Fixed: `flash()` helper (setBridgeMsg + 4s timeout).
11. **C5: BB_JUNK_PATTERNS отжиман** — `bb-builder.engine.ts:447`. `отжиман` ловит weighted push-ups (валидное упражнение). Fixed: `отжимания.*(?:от пол|от скам|на колен|от колен)` — только bodyweight variants.
12. **C6: Deload floor=2** — `bb-builder.engine.ts:682`. 4 accessory × floor=2 = 8 sets minimum на deload (intended ~4-6). Fixed: `isDeload` parameter, floor=1 для deload, floor=2 для рабочих недель.
13. **C7: defaultWorkMax silent fallback** — `bb-builder.engine.ts:879`. Unknown keys silently return 80. Fixed: `console.warn` + добавлены `biceps:45, triceps:50` в DEFAULT_WORKMAX.
14. **C8: upright_row tier** — `bb-exercise-tier.engine.ts:60`. High impingement risk (Reinold 2009) но был в exception list. Fixed: убран из исключений → tier 3 (exotic, только intermediate+ с allowExotic).
15. **C9: orderSessionExercises 3 passes — ОТМЕНЕНО**. После проверки: 3 вызова не избыточны (truncation, post-finisher, post-dedup — каждый служит разной цели).
16. **C10: TAG_PRIMARY_MUSCLES reconstructed per call** — `bb-builder.engine.ts:980-1007`. Fixed: вынесено в `getTagPrimaryMuscles(dayInRotation)` на уровень модуля.

### Phase D — Additional fixes (4)
17. **D1: buildLastResultIndex recency not e1RM** — `bb-progression-feedback.engine.ts:92-115`. Берёт последнюю сессию, не лучшую по e1RM. Heavy-day 100кг×5 (e1RM=112) + pump-day 60кг×15 (e1RM=84) → брался pump. Fixed: parity с PL-auto (P1-10) — выбор записи с наивысшим e1RM среди сессий ≤90 дней.
18. **D2: suggestFeeders missing PRO-KEYS** — `bb-autocoach.engine.ts:340-371`. `delt_front/delt_mid/delt_rear/glutes/quads/hamstrings/forearms/traps` не имели feeders. Fixed: добавлены 8 case-блоков с exercises.
19. **D3: summarizeAutoRegulation float RIR** — `bb-progression-feedback.engine.ts:310`. Regex `RIR(\d+)` не парсит `RIR2.5` (от bbRir drift). Fixed: `RIR([\d.]+)` + `parseFloat`.
20. **D4: e1rmTrend dead field** — `bb-frequency-optimizer.engine.ts:67`. `e1rmTrend` declared but never assigned. Fixed: `computePerMuscleE1RMTrend()` — recent (7д) vs old (4нед ±7д) best e1RM per muscle. Trend ≥+10% → повысить частоту, ≤-5% → снизить.

### Phase E — Minor quality fixes (2)
21. **E1: restProgression absolute week** — `bb-builder.engine.ts:1685`. Использовал absolute `week` вместо `phaseWeek` → на W9 12-нед плана restProgression=120с > baseRest=120 → clamped to floor=60 на всей фазе intensification. Fixed: `phaseWeek` (как RIR drift) — прогрессия рестартует с каждой фазой. Паритет с `bb-loading-layer.engine.ts`.
22. **E3: prescribeLoad repCap hardcoded** — `bb-autocoach.engine.ts:58`. `repCap = phase === 'intensification' ? 8 : 12` для ВСЕХ упражнений. Изоляция/cable/accessory теперь получают 12/15 (accumulation/intensification) — малые мышцы прогрессируют повторы дольше до weight jump. Compound: 8/12 (без изменений).

### False positives removed (4)
- ~~MRV cap overflow (L731-758)~~ — математически опровергнуто (после `minTotal > cap` path, `minTotal <= cap` гарантирует `numExercises * 2 <= cap`).
- ~~Re-cap MRV after compensateCrossDayWeakPoints~~ — feeders добавляют 2 сета только когда `weekSets < MEV`, MEV << MRV.
- ~~Re-cap MRV after addAdaptiveMEVFeeders~~ — MEV feeders поднимают объём ВВЕРХ до MEV, не выше MRV.
- ~~Weight progression for isolation~~ — double progression стандартна для всех типов; `linear` strategy уже различает (isolation +1.0 кг/нед, compound +2.5).

### Files modified (8)
- `src/engines/bb/bb-builder.engine.ts` — 12 fixes (A1, A5, B1, B4, B5, C1, C3, C5, C6, C7, C10, E1)
- `src/engines/bb/bb-autocoach.engine.ts` — 2 fixes (D2, E3)
- `src/engines/bb/bb-progression-feedback.engine.ts` — 2 fixes (B6, D1) + D3
- `src/engines/bb/bb-peak-week.engine.ts` — 1 fix (C2)
- `src/engines/bb/bb-exercise-tier.engine.ts` — 1 fix (C8)
- `src/engines/bb/bb-frequency-optimizer.engine.ts` — 1 fix (D4)
- `src/engines/bb/bb-loading-layer.engine.ts` — 1 fix (E1 parity)
- `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — 1 fix (C4, 15 alert→flash)
- `src/engines/bb/__tests__/bb-audit-2026-08.test.ts` — NEW (34 tests)

### Tests
- `src/engines/bb/__tests__/bb-audit-2026-08.test.ts` — **34 tests**: A1 LegsBiceps biceps primary, A5 dead code removal, B1 peaking RIR drift (3 tests), B4 reps shiftedMin, B5 fuzzy match, B6 epley1RM e1RM comparison (2 tests), C1 deload cascade, C2 peak week floor=2, C6 deload floor=1, C7 defaultWorkMax (5 tests), D2 suggestFeeders PRO-KEYS (8 tests), D3 float RIR (2 tests), D4 e1rmTrend (2 tests), E1 restProgression phaseWeek, E3 repCap isolation/compound (4 tests).
- Full suite: **1752/1752 passing** (168 test files), 0 TS errors, vite build OK.

---

## Profile System v2 — Sync between blocks (Aug 5 2026)

Полный цикл синхронизации Профиля v2 ↔ блоки приложения. Локальные поля остаются в useState, кнопки явной синхронизации.

### Кнопки синхронизации (Aug 5 2026)

Каждый блок, использующий персональные данные, имеет пару кнопок:
- `📋 Из профиля` — загружает значения из `UnifiedSettings` в локальный useState (однократно)
- `💾 Сохранить в профиль` — пишет локальные значения обратно через `useProfile().update(...)` (явно)

### Блоки с кнопками

| Файл | Поля | Кнопка автозаполнения | Кнопка сохранения |
|------|------|----------------------|-------------------|
| `Calculator/CalcProfileCard.tsx` | age, weight, height, sex, sleepHours, stressLevel | ✅ Из профиля | ✅ Сохранить в профиль |
| `SRCBBScreen_parts/PeakingPanel.tsx` | squat, bench, deadlift, bw | ✅ Из профиля | ✅ Сохранить ПМ в профиль (+ legacy `he_training_profile` для backward-compat) |
| `SRCBBScreen_parts/RecoveryPanel.tsx` | sleepHours, sleepQuality, rmssd, restingHR, fatigue, trainDays, injuries | ✅ Из профиля | ✅ Сохранить в профиль |
| `SRCBBScreen_parts/AutoregPanel.tsx` | readiness, fatigue, recovery, goal, intensity, sets, reps, freq | ✅ Из профиля | ✅ Сохранить в профиль |
| `PerformanceScreen.tsx` | macroWeight, macroH, macroAge, macroBf, macroGoal, meetSquat/Bench/Deadlift | ✅ Из профиля | ✅ Сохранить в профиль |
| `NutritionScreen_parts/IndividualPlan/IndividualPlanSettings.tsx` | weight, height, age, sex, bodyFat, dailySteps, sleepHours, stressLevel, allergens, excludedFoods, ... | ✅ Автозаполнение | ✅ Сохранить в профиль |

### Event-bus (`core/profile-events.ts`)

Подписки через `onProfileSectionChange(section, handler)` и `onAnyProfileChange(handler)`. `notifyAll()` в `profile-manager` автоматически вызывает `broadcastProfileChange(changedSections)`. Используется для кросс-модульного оповещения (e.g. `useDataLink`, калькуляторы).

### Глобальный Ctrl+Z

`ProfileScreen_v2` поддерживает глобальный `Ctrl+Z` (Cmd+Z на Mac) для `undoLastSnapshot()` — кроме случая, когда фокус в input/textarea/select (стандартный текстовый undo).

### Files modified (Aug 5 round 2)
- `src/ui/screens/ProfileScreen_v2/hooks/useSectionState.ts` — пофикшен race condition (isDirtyRef для защиты от перезаписи локального ввода)
- `src/ui/screens/ProfileScreen_v2/ProfileScreen_v2.tsx` — добавлены Ctrl+Z и кнопка `↩ Отменить` в header вкладки
- `src/core/profile-manager.ts` — статический импорт `broadcastProfileChange`, `notifyAll(changedSections?)` API
- `src/core/profile-events.ts` — упрощён (без lazy require), корректная логика
- `src/core/__tests__/profile-sync.test.ts` — **15 тестов**: event-bus подписки, sync между секциями, versioning, snapshot/undo

---

## Profile System v2 (Aug 5 2026)

Полная переработка Профиля пользователя: единый источник истины, плоский UX, auto-save, 4 вкладки.

### Архитектура

**Единый источник истины:** `he_profile_v2` (UnifiedSettings, 10 разделов: personal, training, pharma, health, nutrition, lifestyle, system, goals, labs, symptoms).

**Хуки:**
- `getProfile()` / `updateProfile(ctx)` — базовый API
- `useProfileRefresh()` — перезагрузка всего профиля
- `useProfileSection<K>(section)` — granular подписка на секцию, setter патчит
- `useProfileField<K, F>(section, field)` — granular подписка на одно поле
- `useProfileAutoSave(section, value, {delay})` — debounce 500мс + snapshot
- `updateSection(section, patch)` — точечное обновление с инкрементом sectionVersions

**Snapshots/undo:** `pushSnapshot()` / `undoLastSnapshot()` / `getSnapshots()` — 10 последних версий в `he_profile_snapshots_v1`. Event-bus: `profileEvents.on('field-changed', handler)`.

### Миграция дублей (в `unified-profile.ts:migrateToUnified`)

Однократно при первом `getSettings()` мигрирует и удаляет:
- `he_training_profile` → `personal.weight` + `training.*` + `lifestyle.*` + `pharma.*`
- `he_autocalc_state` → `health.*` (neuro, cardio, gi, psych, oda, epicrisis, toxicLoad, dental, contraindications)
- `he_biostack_profile` → `personal.*` + `pharma.phase` + `health.chronicConditions`
- `he_contraindications` → deprecated, оставлен для backward-compat
- `he_food_allergens` / `he_health_issues` / `he_preferred_foods` / `he_excluded_foods` / `he_diet_preferences` → `nutrition.foodAllergies` / `health.chronicConditions` / `nutrition.preferredFoods/excludedFoods/tasteProfile`
- `he_manual_kcal/p/f/c` / `he_manual_g_per_kg` / `he_kbju_mode` → `nutrition.manualTargets/manualGPerKg/kbjuMode`
- `he_evening_low_carb` / `he_surplus_pct` / `he_variety_strictness` / `he_specificity` → `nutrition.*`
- `he_intolerances` / `he_taste_profile` / `he_excluded_categories` / `he_preferred_by_meal` / `he_nutrition_notes` / `he_locked_foods` → `nutrition.*`
- `he_planner_histamine` → `nutrition.histamineSensitive`
- `he_bb_category` / `he_peak_week` / `he_peak_show_day` / `he_life_stage` → `goals.*`

### UI (ProfileScreen_v2)

**Hero:** имя + краткая сводка (♂ 30 лет · 82.5кг/14% · Набор) + 4 крупные карточки вкладок + % заполненности + статус авто-сохранения + ↩ Отменить.

**4 вкладки:**
1. 👤 **Пользователь** — 6 accordion-секций: Основное / Здоровье / Питание / Образ жизни / Курс/Фарма / Цели
2. 🏋️ **Тренировки** — 3 секции: Профиль / Личные рекорды (ПМ + workMax) / Слабые стороны и оборудование
3. 📓 **Дневники** — встроенные (Сон/Замеры/АД/Вес) + быстрый доступ к дневникам из других блоков + отчёты
4. ⚙️ **Настройки** — системные (единицы, уведомления, приватность) + Экспорт/Импорт + Сброс

**Auto-save:** debounce 500мс на каждое изменение. Нет кнопки "Сохранить". Кнопка `↩ Отменить` для undo последнего изменения.

**Mobile-first:** 1 колонка на мобильном, touch targets ≥44px, ARIA labels, keyboard navigation.

### Поля в других блоках (локально + кнопка)

Поля в `PeakingPanel`, `RecoveryPanel`, `AutoregPanel`, `PerformanceScreen`, `IndividualPlanContext` (Планировщик), `CalcProfileCard` (Калькулятор поддержки) остаются **локальными** в `useState`. Добавлены кнопки:
- `📋 Автозаполнение из профиля` — загружает значения из `useProfile()` в локальный state
- `💾 Сохранить в профиль` — пишет локальные значения обратно через `useProfile().update(...)`

### Files
- NEW: `src/core/profile-events.ts` — event-bus для granular уведомлений
- NEW: `src/ui/screens/ProfileScreen_v2/` — новый профиль (12 файлов)
- MOD: `src/core/types.ts` — расширен `UnifiedSettings.nutrition/goals`, убраны дубли из `system`
- MOD: `src/core/profile-manager.ts` — `useProfileSection`, `useProfileField`, `useProfileAutoSave`, `updateSection`, `pushSnapshot`, `undoLastSnapshot`, `getSectionVersion`
- MOD: `src/core/contraindications.ts` — deprecation wrapper (сохранён для backward-compat)
- MOD: `src/engines/unified-profile.ts` — миграция 30+ legacy ключей в UnifiedSettings
- MOD: `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — убран `useEffect → updateProfile` (P0-fix), добавлены `autofillFromProfile` / `saveToProfile`
- MOD: `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanSettings.tsx` — добавлена кнопка "🔄 Синхронизация с Профилем"
- MOD: `src/App.tsx` — замена `ProfileScreen` на `ProfileScreen_v2`, добавлены маппинги навигации для дневников и отчётов
- DEL: `src/ui/screens/ProfileScreen.tsx` (старый, заменён на ProfileScreen_v2)
- DEL: `src/ui/screens/ProfileScreen_parts/ProfileBioSection.tsx` и 15 других старых секций
- DEL: `src/ui/settings-module.ts` (legacy)
- DEL: `src/ui/screens/ProfileScreen_parts/FriendsSection.tsx` (не использовался)

### Tests
- `src/core/__tests__/profile-migration.test.ts` — 12 тестов: миграция he_training_profile, he_autocalc_state, planner keys, удаление старых ключей, идемпотентность, corrupted data
- `src/core/__tests__/profile-manager-hooks.test.ts` — 10 тестов: `updateSection`, `getSectionVersion`, snapshots/undo (cap=10), `onProfileChange`, FLAT_TO_NESTED proxy

**Итого: 22 новых теста. Полный suite: 1459/1459 passing.**

---

## BB-auto Pro Features (Aug 4 2026)

5 профессиональных функций для BB-auto: cross-mesocycle continuity, peak week protocol, muscle heatmap, frequency optimization, print/export.

### P1: Cross-mesocycle continuity
- **`bb-mesocycle-progression.engine.ts`** — новый движок: `extractMesocycleProgression` (peak weights, volume, exercises из предыдущего плана), `applyWeightProgression` (+2.5/5кг по level), `applyVolumeProgression` (+1-2 сета), `wasInPreviousMeso` (exercise rotation avoidance).
- `BBBuilderInput.previousPlan?: BBPlan` — передача предыдущего плана.
- `bb-builder.engine.ts` — `extractMesocycleProgression` → `applyWeightProgression` (workMax), `applyVolumeProgression` (rotationMuscleVolume), previousExercises → rotationNames (soft avoidance). Rationale: "🔗 Cross-mesocycle: веса +N кг, объём +N групп, ротация N упр."
- `BbAutoConstructor.tsx` — checkbox "🔗 Cross-mesocycle: прогрессия из последнего плана", auto-load savedPlans[0].plan.
- **24 tests** in `bb-mesocycle-progression.test.ts`.

### P2: Peak week protocol
- **`bb-peak-week.engine.ts`** — новый движок: `buildPeakWeekProtocol` (7-дневный протокол: water load→cut, sodium load→cut, carb depletion→reload, training light pump→rest, posing 20-60 мин). `applyPeakWeekToPlan` — замена последней недели на peak week.
- `BbAutoConstructor.tsx` — кнопка "🎭 Peak week" + таблица протокола (7 дней × вода/натрий/carbs/трен/позы).
- **18 tests** in `bb-peak-week.test.ts`.

### P3: Inline Muscle Volume Heatmap
- `BbAutoConstructor.tsx` — inline heatmap на шаге "plan": per-muscle карточки с цветовой шкалой (зелёный=MEV-MAV, жёлтый=Above MAV, красный=Over MRV, синий=Below MEV), progress bar, MEV/MAV/MRV labels.

### P4: Per-muscle frequency optimization
- **`bb-frequency-optimizer.engine.ts`** — новый движок: `optimizeMuscleFrequency` — per-muscle ACWR (danger→↓, undertrained→↑), muscle size (small→≥2×, large→≤2×), e1RM trend. Возвращает recommendations + rationale.
- **7 tests** in `bb-frequency-optimizer.test.ts`.

### P5: Print/Export
- `BbAutoConstructor.tsx` — кнопка "🖨 PDF" → `handlePrintPlan()` — открывает new window с HTML-таблицей (недели × дни × упражнения × сеты/вес/RIR/коммент), `window.print()`.

### Files
- NEW: `src/engines/bb/bb-mesocycle-progression.engine.ts` (110 строк)
- NEW: `src/engines/bb/bb-peak-week.engine.ts` (180 строк)
- NEW: `src/engines/bb/bb-frequency-optimizer.engine.ts` (110 строк)
- NEW: `src/engines/bb/__tests__/bb-mesocycle-progression.test.ts` (24 tests)
- NEW: `src/engines/bb/__tests__/bb-peak-week.test.ts` (18 tests)
- NEW: `src/engines/bb/__tests__/bb-frequency-optimizer.test.ts` (7 tests)
- MOD: `src/engines/bb/bb-builder.engine.ts` — previousPlan field, mesocycle progression integration
- MOD: `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — cross-mesocycle toggle, peak week button+table, muscle heatmap, print button

### Full suite: 1348 BB-auto tests passing, 0 TS errors in BB-auto files.

---

## BB-auto Phase E — Comprehensive PED + Exercise + Goals Audit (Aug 4 2026)

Full critical analysis of BB-auto PED-dosing engine (`bb-ped-adaptation.engine.ts`), exercise selection, and all 5 BBGoal directions (mass/cut/recomp/maintenance/strength_mass). 3 P0 + 4 P1 + 4 P2 issues found and fixed. 7 new test files, +163 new tests.

### P0 — Critical fixes
1. **`BbAutoConstructor.buildBb()` did not pass `sex`** — `BbAutoConstructor.tsx:480-661`: `buildBBPlan`/`convertCycleToBBPlan`/`programToBBPlan` calls were missing `sex:` field. `bb-builder.engine.ts:2140` always received `input.sex === undefined`. Female users selecting `focusGroup: 'glutes'` or just female never got gluteBoost ×1.2 through the UI path (only through `autodraftBBPlan` in manual planner). Fixed: added `sex: linked.profile?.settings?.personal?.sex` to all 3 branches. Also added `sex?` field to `CycleToPlanInput` and `ProgramToBBPlanOpts` interfaces.
2. **PED dose parser desync — `aasDose` warning ≥1500 didn't fire for strings** — `bb-ped-adaptation.engine.ts:199` vs `:250`: line 199 used regex parser (`"500mg"` → 500), line 250 used `Number()` (`"500mg"` → NaN → 0). Risk warning "⚠ High dose ≥1500 mg/week" silently failed for string doses. Fixed: unified `parseDose()` helper used in both places.
3. **0 tests for `BBGoal='cut'/'recomp'/'maintenance'/'strength_mass'`** — Critical branches `bb-builder.engine.ts:1988-1989` (cut ×0.75, mass/strength_mass ×1.05) and `:2049` (strength_mass phase distribution) had ZERO test coverage. Fixed: 32 new tests in `bb-goal-coverage.test.ts` covering all 5 goals × 3 levels.

### P1 — Important fixes
4. **Cap 1.85 → 2.0 for full PED stack** — `bb-ped-adaptation.engine.ts:244-245`: 3+ PED with cap doses always hit 1.85 cap, erasing difference between AAS-only (1.30) and full stack (AAS 3000+insulin 40+GH 15+IGF1 100+MGF 400). Fixed: cap raised to 2.0 — mega-stack justifies +8% additional MRV.
5. **`strength_mass` didn't get peaking phase** — `bb-builder.engine.ts:2049` passed `'mass'` to `distributePhases` for `strength_mass`, and `phase-periodization.ts:118` `hasPeak` only checked `'strength' | 'powerlifting'`. UI promised "linear strength progression" but plan had no peaking. Fixed: `hasPeak` now includes `'strength_mass'`; peaking checked BEFORE deload in phase loop (peaking weeks shouldn't be overridden by regular deload).
6. **MGF/IGF1 didn't generate risks** — `bb-ped-adaptation.engine.ts:249-257`: `insulin`, `GH`, `AAS` had risk warnings, but `IGF1` (hypoglycemia, arthralgia) and `MGF` (unpredictable local hypertrophy) had none. Fixed: added risk blocks for both.
7. **`labMrvMultiplier < 1.0` and recovery metrics had 0 bb-tests** — `bb-builder.engine.ts:1957-1965` (recoveryMult from bodyFat/leanMass/hrvMs/sleepHours/stressLevel) and `:2009,2022` (labMrvMultiplier composition) were untested. Fixed: 16 new tests in `bb-lab-recovery-coverage.test.ts`.

### P2 — Quality fixes
8. **Russian comma "500,5" parsed as 5005** — `bb-ped-adaptation.engine.ts:199`: regex `/[^0-9.]/g` removed comma before parsing, turning "500,5" into "5005" (+1000 mg error). Fixed: `.replace(',', '.')` before regex.
9. **`PED_META.tEq` for T-equivalent risk threshold** — `bb-ped-adaptation.engine.ts`: new `PED_META` constant with `tEq` field (testosterone-equivalent factor). AAS tEq=1.0 (baseline), non-AAS tEq=0. Trenbolone (tEq=2.5) 500 mg = 750 T-equiv → closer to 1500 threshold. Risk warning now uses `aasTEquiv = aasDose × PED_META.AAS.tEq`.
10. **`lengthenedBonus` not trainingFocus-specific** — `bb-builder.engine.ts:399-406`: +10 bonus for lengthened-position exercises (RDL, incline curl, sissy squat) was identical for strength/hypertrophy/endurance. Fixed: multiplier varies by `trainingFocus` (strength ×0.5, hypertrophy ×1.0, endurance ×1.5).
11. **`courseIntensity` applied even when all PED doses=0** — `bb-ped-adaptation.engine.ts:237`: `activePEDs.length > 0` was true even if all PED had dose=0 (explicitly disabled). Fixed: condition changed to `mrvMult > 1` — if PEDs contribute no MRV boost, intensity shouldn't apply either.

### New test files (8 files, +172 tests)
- `src/engines/bb/__tests__/bb-ped-adaptation.test.ts` — **75 tests**: dose interpolation (AAS/insulin/GH/MGF/IGF1 all thresholds), multi-PED composition + diminishing 0.85, GH+insulin synergy, CourseIntensity (mild/moderate/heavy), string dose parsing ("500mg", "1,5г", "1e3"), risks auto-generation (AAS≥1500, insulin, GH, IGF1, MGF, T-eq), backward compat (undefined, negative, null), adjustedMrv per-muscle, PED_META + explainPEDAdaptation.
- `src/engines/bb/__tests__/bb-goal-coverage.test.ts` — **32 tests**: volume target corrections (cut ×0.75, mass/strength_mass ×1.05), phase distribution per goal, plan generation matrix 5 goals × 3 levels, relative volume ordering, selector splitHints per goal.
- `src/engines/bb/__tests__/bb-strength-mass.test.ts` — **6 tests**: peaking-phase activation (12/16 weeks), volume parity with mass, PED composition.
- `src/engines/bb/__tests__/bb-lab-recovery-coverage.test.ts` — **16 tests**: labMrvMultiplier (0.7/1.0/undefined + PED composition), recovery metrics (bodyFat/leanMass/hrvMs/sleepHours/stressLevel + cap 0.6), nutrition metrics (calorieSurplus/proteinPerKg).
- `src/engines/bb/__tests__/bb-female-default.test.ts` — **9 tests**: female without focusGroup (gluteBoost ×1.2), female vs male glute volume, female + enhanced + PED, lengthenedBonus × trainingFocus (strength/hypertrophy/endurance), UI integration sex forwarding.
- `src/engines/bb/__tests__/bb-ped-combo.test.ts` — **12 tests**: mass + PED (baseline/heavy/full stack cap 2.0), cut + PED (dangerous scenario), strength_mass + PED (peaking + boost), recomp + PED, female + glutes + PED, enhanced exerciseCount, adaptForPEDs direct.
- `src/engines/bb/__tests__/bb-exercise-tier-ped.test.ts` — **13 tests**: bbExerciseTier classification (canonical/acceptable/exotic/inappropriate), level-based filtering (beginner/intermediate no exotic), enhanced + PED exerciseCount.

### Files modified
- `src/engines/bb/bb-ped-adaptation.engine.ts` — PED_META with tEq, parseDose helper, cap 1.85→2.0, IGF1/MGF risks, T-equiv threshold, courseIntensity mrvMult>1 guard
- `src/engines/bb/bb-builder.engine.ts` — strength_mass → distributePhases(goal) direct, lengthenedBonus × trainingFocus
- `src/engines/bb/cycle-to-plan.ts` — `sex?` field added to `CycleToPlanInput` and `ProgramToBBPlanOpts`; female glute boost ×1.2 in both `convertCycleToBBPlan` and `programToBBPlan`; `calorieSurplus?`/`proteinPerKg?` fields added; `nutritionMult` applied to `mrvMult` in both paths (parity with `bb-builder.engine.ts`)
- `src/engines/bb/bb-volume.engine.ts` — new `computeBBNutritionMultiplier()` helper (calorieSurplus/proteinPerKg → MRV soft-cap, parity with bb-builder inline logic)
- `src/ui/screens/TrainingScreen_parts/phase-periodization.ts` — hasPeak += 'strength_mass', peaking checked before deload
- `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — `sex:` field added to all 3 buildBb() branches; `proteinPerKg:` from `linked.profile.settings.nutrition` added to all 3 branches

### Additional test files (Phase E extension)
- `src/engines/bb/__tests__/bb-cycle-program-ped.test.ts` — **15 tests**: convertCycleToBBPlan PED integration (adapt/faithful/full stack), programToBBPlan PED integration (adapt/faithful), female glute boost ×1.2 in both paths, nutrition metrics (calorieSurplus/proteinPerKg) in both paths, eccentricMult in bb-builder path.

### Full suite: 1334 tests passing (139 test files), 0 TS errors, vite build OK.

---

## Manual Program Constructor Audit Fixes (Aug 4 2026)

Full critical analysis of the manual program constructor (ручной конструктор) and annual planning (годовое планирование) across 6 directions: macrocycle engine, periodization designer, MacrocyclePanel UI, ProgramEditorView, ProgramManagerPanel, and planner-bridge-handlers. 6 P0 + 13 P1 + 8 P2 issues found and fixed. 16 new tests added.

### P0 — Critical fixes
1. **`BLOCK_TEMPLATES` missing `gpp`/`transition`** — `periodization-designer.engine.ts`: palette had GPP/Transition blocks (colors, icons, labels) but no templates. `addBlockToDesign()` returned `undefined` → silently nothing happened. Preset "52-нед годовой план" generated ~35 weeks instead of 52. Fixed: added `gpp` (3 weeks, high/low) and `transition` (2 weeks, very_low/low) to `BLOCK_TEMPLATES`.
2. **`getDesignStats` overlapWeeks inflated** — `periodization-designer.engine.ts`: `overlaps.length` counted (block, week) entries, not unique weeks. 3 blocks on weeks 3-5 → `overlapWeeks = 6-9` instead of 3. Fixed: `overlapWeeks: new Set(overlaps.map(o => o.week)).size`. Added `DesignStats` interface.
3. **`createFromPhases` dropped blocks instead of truncating** — `periodization-designer.engine.ts`: `if (end > totalWeeks) break;` dropped the entire block and all subsequent blocks. Preset "Классический 12-нед (сила)" created 4 blocks (10 weeks) instead of 8 (12 weeks). Fixed: `endWeek = Math.min(cursor + tmpl.weeks - 1, totalWeeks)`. Added tail-fill transition for unfilled weeks.
4. **XSS in PDF print** — `ProgramEditorView.tsx`: `b.exerciseName`, `d.name`, `ex.name`, `s.name`, `s.focus`, `program.pl.notes`, `program.pl.sourceCycleId` inserted into HTML without escaping. A program named `<script>alert(1)</script>` would execute in the print window. Fixed: `escapeHtml()` helper applied to all user-provided strings in PDF output.
5. **`editWeeks` NaN propagation** — `MacrocyclePanel.tsx`: `+e.target.value` without guards. Non-numeric input → NaN → `Math.max(1, NaN) = NaN` → corrupts all phase durations. Fixed: `Number.isFinite(value) && value >= 1` guard with clamping to `totalWeeks`.
6. **`buildMacrocycle` competition minimum 2 weeks → 1** — `macrocycle.engine.ts`: `Math.max(2, ...)` for competition phase. Multi-mode path correctly used `compWeeks = 1`. Fixed: `Math.max(1, ...)` for competition.

### P1 — Important fixes
7. **`estimateCompetitionWeek` past date → week 1** — `macrocycle.engine.ts`: `daysDiff < 0` → `Math.floor(neg/7) + 1 ≤ 0` → clamped to 1. Old competition placed at start. Fixed: past dates return `Math.round(totalWeeks * 0.85)`.
8. **`rebalanceBbMacrocycle` overwrites competition week** — `macrocycle.engine.ts`: `week: block.weekOffset + block.weeks - 1` overwrote original week. Fixed: `Math.max(block.weekOffset, Math.min(competition.week, block.weekOffset + block.weeks - 1))`.
9. **Duplicate priority A competitions allowed** — `MacrocyclePanel.tsx`: no uniqueness check. Two A-priorities → engine used first silently. Fixed: `mainCount > 1` validation. Also `buildMacrocycleMulti` throws on duplicate A.
10. **`startCreate` vs `autoFillDraftDispatch` divergence** — `ProgramManagerPanel.tsx`: `startCreate('bb')` did NOT pass `trainingFocus`, `bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`. Wizard path did. Fixed: unified — `startCreate` now creates blank + sets `pendingAutoFill=true`, `ProgramEditor` auto-fills via `autoFillDraftDispatch` with full recovery metrics.
11. **Undo history not working from ProgramEditorView** — `ProgramManagerPanel.tsx`: undo snapshots only saved via `onEditChange`. `ProgramEditorView` used `onChange` directly → all editor changes bypassed undo. Fixed: extracted `useProgramUndo` hook, connected in both `ProgramManagerPanel` and `ProgramEditorView`.
12. **Bridge macrocycle handler without recovery metrics** — `planner-bridge-handlers.ts`: `macrocycleToBBProgram` call missing `trainingFocus`, `bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`, `labMrvMultiplier`. Fixed: `BridgeCtx.recovery` field added, `ProgramEditorView` passes recovery metrics.
13. **`sendToExecution` used `alert()` instead of `showToast()`** — `ProgramEditorView.tsx`: 5 `alert()` calls. Fixed: replaced with `showToast(msg, 'warning')`.
14. **`PLSetEditor` parseInt("0") → 70%** — `ProgramEditorComponents.tsx`: `parseInt(e.target.value) || 70` — typing 0 gave 70% (impossible to set 0%). Fixed: `Number.isFinite` guard with clamping 0.3-1.1.
15. **`makeEmptySessionsForWeek` non-sequential dowPattern** — `designer-to-program.ts`: `[0, 1, 3, 4, 2, 5, 6]` — 5th day = Wednesday instead of Friday. Fixed: `[0, 1, 2, 3, 4, 5, 6]`.
16. **Days-per-week cascade removes wrong session** — `ProgramEditorView.tsx`: `sessions.pop()` removed last session. For PPL 3→2 days, "Legs" (most important) was removed. Fixed: prefer removing empty/deload sessions first via `findIndex`.
17. **`sourceCycleId === null` instead of `== null`** — `ProgramEditorView.tsx`: `sourceCycleId` typed as `string | null | undefined`. `=== null` missed `undefined`. Fixed: `== null`.
18. **`priHandler` volume multiplier changed weight not sets** — `planner-bridge-handlers.ts`: `weight: st.weight ? Math.round(st.weight * mult)` changed LOAD, not VOLUME. Fixed: adjusts set count via `Math.round(sourceSets.length * mult)`, preserves weight, shifts RIR.
19. **`deloadHandler` only changed RIR+weight, not sets** — `planner-bridge-handlers.ts`: `rir: 4, weight: st.weight * 0.6` but no set reduction. Fixed: `Math.ceil(sourceSets.length * 0.6)` sets, each with RIR 4 and weight ×0.6.
20. **`volumeHandler` added 1 block per set, capped at 5** — `planner-bridge-handlers.ts`: `Math.min(cnt, 5)` blocks each with 1 set. Fixed: 1 block with `count` sets, clamped 0-10.

### P2 — Quality fixes
21. **`loadDesigns` no validation** — `periodization-designer.engine.ts`: `JSON.parse` returned any shape. Fixed: validates `id`, `name`, `totalWeeks`, `blocks` array, `phaseKey` in `PHASE_COLORS`, integer `startWeek`/`endWeek`.
22. **`moveBlockInDesign` no NaN guard** — `periodization-designer.engine.ts`: `newStart` could be NaN. Fixed: `Number.isFinite(newStart) ? Math.round(newStart) : block.startWeek`.
23. **`resizeBlockInDesign` no NaN guard** — `periodization-designer.engine.ts`: `newEndWeek` could be NaN. Fixed: `Number.isFinite(newEndWeek) ? Math.round(newEndWeek) : block.endWeek`.
24. **`isBodyweightExercise` skipped in `cloneWeekWithFreshIds`** — `macrocycle-to-bb.ts`: `weightFactor` applied to all numeric weights including bodyweight. Fixed: `!isBodyweightExercise(block.exerciseName)` guard.
25. **`isBBMacrocycle` duck-typing** — `macrocycle-to-bb.ts`: `'trainingFocus' in macro` alone was fragile. Fixed: `isBBMacrocycle` type guard checks both `trainingFocus` field AND absence of `kind` in blocks.
26. **All `minHeight: 30/32/34/36/38/40` → 44** — across all 5 files. CSS `@media (hover: none) and (pointer: coarse)` enforces `min-height: 44px !important` on touch devices.
27. **All `parseInt() || default` → `Number.isFinite` guard** — across all numeric inputs: wizardDays, wizardWeeks, execWeek, reps, rir, restSec, dropReps, miniReps, miniRestSec, pauseSec, pctOf1RM, weight.
28. **Empty states with icons** — ProgramManagerPanel: 📋 + title + description. PeriodizationDesignerTab: 🎨 + title + description.

### UI/UX improvements
- **TrainingModal.tsx** — shared dialog shell with `role="dialog"`, `aria-modal`, focus trap, Escape key, backdrop click. All 5 modal windows (BB library, PL cycles, wizard, methods, macrocycle) unified.
- **Touch DnD in PeriodizationDesignerTab** — long-press 350ms on palette chips activates drag mode, `onTouchMove` cancels if >10px scroll, `onTouchEnd` on drop zones places block. Vibration feedback.
- **Week ruler alignment** — MacrocyclePanel: `Math.ceil` instead of `Math.round` for integer tick labels aligned to block boundaries.
- **CSS for mobile** — `@media (max-width: 480px)`: full-screen modals, grid collapse, 16px input font (iOS anti-zoom). `@media (hover: none)`: 44px tap targets.
- **ARIA labels** — all inputs, selects, buttons, drag handles, delete buttons, phase blocks, competition markers have `aria-label`.
- **`role="alert"` + `aria-live`** — validation banners in ProgramEditorView and PeriodizationDesignerTab.
- **`role="radiogroup"`** — ManualModeToggle in ProgramManagerPanel.
- **Keyboard navigation** — palette chips in PeriodizationDesignerTab: Tab → select, Enter/Space → toggle drag, Arrow Up/Down → move block.
- **Phase visual tokens** — `phase-visual-tokens.ts` created as canonical source for PL/BB/Designer phase colors, icons, labels + competition priority visuals.
- **`useProgramUndo` hook** — extracted from ProgramManagerPanel inline code. Undo/Redo via Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y. localStorage history (cap=50). Connected in both ProgramManagerPanel and ProgramEditorView.

### Files modified
- `src/engines/periodization-designer.engine.ts` — P0-1/2/3, P2-21/22/23, DesignStats interface, loadDesigns validation
- `src/engines/lms/macrocycle.engine.ts` — P0-6, P1-7/8/9
- `src/engines/periodization/designer-to-program.ts` — P1-15
- `src/engines/lms/macrocycle-to-bb.ts` — P2-24/25
- `src/ui/screens/TrainingScreen_parts/ProgramEditorView.tsx` — P0-4, P1-10/11/12/13/16/17, escapeHtml, TrainingModal, useProgramUndo, aria
- `src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx` — P1-10/11, TrainingModal, empty state, aria, unused imports removed
- `src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx` — P1-14, P2-26/27, aria, tap-target 44px, keyboard nav
- `src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx` — touch DnD, aria, empty state, tap-target 44px
- `src/ui/screens/TrainingScreen_parts/planner-bridge-handlers.ts` — P1-12, P1-18/19/20, recovery metrics
- `src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx` — P0-5, P1-9, week ruler, shared tokens, aria, tap-target 44px
- `src/styles.css` — mobile CSS, modal CSS, tap-target enforcement

### New files
- `src/ui/screens/TrainingScreen_parts/TrainingModal.tsx` — shared modal component
- `src/ui/screens/TrainingScreen_parts/hooks/useProgramUndo.ts` — undo/redo hook
- `src/ui/screens/TrainingScreen_parts/phase-visual-tokens.ts` — shared phase visual tokens
- `src/ui/screens/TrainingScreen_parts/__tests__/useProgramUndo.test.ts` — 10 tests

### Tests
- `src/engines/__tests__/periodization-designer-overlap.test.ts` — +3 tests (unique overlap weeks, GPP/transition presets)
- `src/engines/lms/__tests__/macrocycle-multi.test.ts` — +1 test (duplicate A priority rejection)
- `src/ui/screens/TrainingScreen_parts/__tests__/planner-bridge-handlers.test.ts` — +2 tests (pri volume multiplier, deload volume+intensity)
- `src/ui/screens/TrainingScreen_parts/__tests__/useProgramUndo.test.ts` — 10 tests (pushSnapshot, skip identical, cap 50, clear future, undo/redo round-trip, corrupted storage)
- `src/engines/periodization/__tests__/designer-to-program.test.ts` — updated for sequential dowPattern
- Full suite: **1155 tests passing** (131 test files), 0 TS errors, vite build OK.

---

## PL-auto Critical Audit Fixes (Aug 3 2026)

Full critical analysis of the ПЛ-авто (PowerLifting auto-planner) system across 4 directions: core engine (6 files), supporting engines (7 files), test coverage (13 test files), and UI integration (SRCBBScreen.tsx). 5 P0 + 11 P1 + 6 P2 issues found and fixed. 25 new tests added.

### P0 — Critical fixes (recovery multiplier + focus lift)

1. **`buildSrc()` bodyFat wrong path** — `SRCBBScreen.tsx:265` read `(linked.profile).bodyFatPct` (non-existent root field) → always `undefined`. Body composition recovery multiplier (Helms 2022) never fired for PL-auto. Fixed: canonical path `linked.profile.settings.personal.bodyFat` (matching `BbAutoConstructor.tsx:518`).

2. **`buildSrc()` leanMass not passed** — `LMSBuildInput.leanMass` used by engine for MRV adjustment (`leanMass >= 90 → ×1.15`, `< 60 → ×0.9`) but UI never forwarded it. Fixed: computed `leanMass = weight × (1 - bodyFat/100)` inline, matching BB-auto.

3. **`buildSrc()` stressLevel wrong source/scale** — read `linked.readiness.stress` which doesn't exist in `ReadinessScores` (the readiness engine doesn't populate it). Even if present, the 0-100 scale would always trigger the worst-case `×0.85` multiplier (engine expects 1-10). Fixed: canonical path `linked.profile.settings.lifestyle.stressLevel` (1-10).

4. **`buildSrc()` hrvMs + sleepHours wrong paths** — `hrvMs` read from `linked.profile.settings.hrvMs` (wrong; should be `.lifestyle.morningHRV`). `sleepHours` derived from composite `sleepScore/10` (lossy: 8h perfect sleep → 10.0h overestimate; 6h → 9.0h). Fixed: canonical `.lifestyle.morningHRV` and `.lifestyle.sleepHours`.

5. **`buildSrcMacrocycle()` passed ZERO recovery metrics** — the macrocycle path (year-round plans) called `buildLMSPlan` for each block without `bodyFat/leanMass/hrvMs/sleepHours/stressLevel`. All 5 recovery multipliers always ×1.0. Fixed: all 5 now forwarded with same canonical paths as `buildSrc()`.

6. **`matchesFocusLift` deadlift regex caught squat** — `lms-builder.engine.ts:139` regex `из ям` matched "приседания из ямы" (a squat variant). With `focusLift='deadlift'`, squat exercises received +20% volume as deadlift variants. Fixed: `из ям` alone no longer matches; requires deadlift context (`станов|тяга`) alongside.

### P1 — Important fixes

7. **PM unbounded growth** — `lms-progression.engine.ts:51` `pm0 × (1+k)^(week-1)` had no cap. A 52-week `on_course` heavy cycle (k=0.025) projected PM ×3.56 (200kg squat → 712kg). Fixed: `pmCap()` clamps to ×1.25 (natural), ×1.35 (mild on_course), ×1.5 (heavy on_course). Descending progression (PCT) uncapped. `lms-builder.engine.ts:576` now delegates to `pmForWeek()` to inherit the cap.

8. **`detectLift` classified OHP as bench** — `lms-to-pl.ts:34` `/жим/i` matched "Жим стоя", "Жим гантелей сидя", "Жим ногами" → weights calculated from bench 1RM. Fixed: explicit exclusion of overhead/leg-press/arnold/push-press variants. Row variants ("Тяга верхнего блока", "Тяга штанги в наклоне") also excluded from deadlift.

9. **Fuzzy match false positives AND false negatives** — `lms-progression-feedback.engine.ts:133-134` required BOTH token overlap AND substring includes. "жим лёжа" vs "жим штанги лёжа" (same exercise): overlap OK but `.includes()` failed → no match (false negative). "жим" vs "жим гантелей стоя" (different exercises): overlap 1/1 + includes → matched (false positive). Fixed: new logic requires 2+ meaningful tokens overlap OR (1+ overlap + substring for names with 2+ tokens only). Tokens ≤2 chars filtered out.

10. **`expandCycleWeeks` silently dropped `weeks[0]`** — `lms-to-pl.ts:23-24` loop started at `i=1`, assuming `weeks[0] === week1`. Data inconsistency was lost without warning. Fixed: `weeks[0]` now used as authoritative week 1 when `weeks` array is present.

11. **`topSetOf` selected by weight not e1RM** — `lms-progression-feedback.engine.ts:60-64` picked highest `weightKg`, but 80kg×5 (e1RM=88.3) is better than 82kg×1 (e1RM=82). Fixed: selection by `epley1RM(weight, reps)`.

12. **`rebalanceMacrocycle` stale competition week** — `macrocycle.engine.ts:565-568` when a competition's block was removed during clamping, the competition retained its OLD week value (stale reference). Fixed: orphaned competitions now get `week: 0` and are filtered out.

13. **`diary-autoreg` zero e1RM → weight increase** — `diary-autoreg.engine.ts:160` when `fact.e1RM=0` (bodyweight-only or zero-data), `rpeFromLoad(0,...)` returned 5 (fallback). This created `delta=-3` → system INCREASED planned weight (opposite of correct). Fixed: explicit guard for `e1RM <= 0 || weight <= 0` → fallback source, no weight change.

14. **`buildSrc()` button no error handler** — `SRCBBScreen.tsx:1031` `onClick={() => buildSrc()}` had no try/catch. If `buildLMSPlan` threw (invalid template, PM=0), error propagated uncaught with no user feedback. Fixed: try/catch with `setMethodNote(error message)`.

15. **`buildLastResultIndex` ignored heavy/pump day context** — `lms-progression-feedback.engine.ts:68-90` kept only the MOST RECENT session's data per exercise name. If "Тяга штанги в наклоне" was done 80kg (heavy, Mon) and 60kg (pump, Tue), only Tue's 60kg data survived → plan's heavy-day exercise referenced pump-day e1RM. Fixed: now tracks entry with HIGHEST e1RM across recent sessions (within 90 days), preserving heavy-day performance.

16. **ACWR zone `'danger'` vs `'dangerous'` type mismatch** — `cycle-to-plan.ts:43` and `bb-progression-feedback.engine.ts:478` returned `zone: 'danger'`, but canonical `ACWRZone` type uses `'dangerous'`. If results were passed to `autoRegulate()` or `buildLMSPlan`, the dangerous-zone check (`=== 'dangerous'`) would silently fail. Fixed: all 3 producers now use `'dangerous'`; consumer in `bb-builder.engine.ts:2678` updated.

### P2 — Quality fixes

17. **`weakpoint-pl.ts` ohp_mid rationale copy-pasted** — line 64 was identical to bench.mid ("Скоростной жим + средний хват..."). Fixed: overhead-specific rationale.

18. **`weakpoint-pl.ts` pd_squeeze too narrow** — only 2 vertical pulls (Подтягивания, Тяга верхнего блока). Fixed: added horizontal pull (Тяга гантели в наклоне) for scapular retraction.

19. **`diary-autoreg` plateau absolute threshold** — 2.5kg for ALL exercises. Squat 180kg: 2.5kg = 1.4% (noise). Lateral raise 8kg: 2.5kg = 31% (huge progress ignored). Fixed: percentage-based `max(1, maxE1RM × 0.02)`.

20. **`cycle-to-plan.ts` muscleGroupFromExName default `'chest'`** — unknown exercises defaulted to chest → chest MRV applied. Fixed: neutral `'core'` default.

21. **`cycle-to-plan.ts` `validateReplacement` dead code** — defined but never called. Removed.

### Files modified
- `src/ui/screens/SRCBBScreen.tsx` — P0-1/2/3/4/5/9 (buildSrc + buildSrcMacrocycle recovery wiring, try/catch)
- `src/engines/lms/lms-builder.engine.ts` — P0-5 (deadlift regex), P1-1 (pmForWeek delegation)
- `src/engines/lms/lms-progression.engine.ts` — P1-1 (pmCap function)
- `src/engines/lms/lms-to-pl.ts` — P1-2 (detectLift OHP exclusion), P1-4 (expandCycleWeeks weeks[0])
- `src/engines/lms/lms-progression-feedback.engine.ts` — P1-3 (fuzzy match), P1-5 (topSetOf e1RM), P1-10 (buildLastResultIndex best e1RM)
- `src/engines/lms/macrocycle.engine.ts` — P1-6 (orphaned competition removal)
- `src/engines/pro/diary-autoreg.engine.ts` — P1-7 (zero e1RM guard), P2-4 (plateau %threshold)
- `src/engines/bb/cycle-to-plan.ts` — P1-11 (zone 'dangerous'), P2-5 (default 'core'), P2-6 (dead code removal)
- `src/engines/bb/bb-progression-feedback.engine.ts` — P1-11 (zone 'dangerous')
- `src/engines/bb/bb-builder.engine.ts` — P1-11 (consumer zone 'dangerous')
- `src/engines/lms/weakpoint-pl.ts` — P2-2 (ohp_mid rationale), P2-3 (pd_squeeze assistance)

### Tests
- `src/engines/lms/__tests__/pl-auto-audit-fixes.test.ts` — **25 new tests**: P1-1 PM cap (6), P1-2 detectLift (7), P1-3 fuzzy match (2), P1-4 expandCycleWeeks (2), P1-5 topSetOf e1RM (1), P1-6 rebalance orphaned competitions (2), P1-7 diary-autoreg zero e1RM (2), P1-11 ACWR zone 'dangerous' (1), P2-4 plateau %threshold (2).
- Full suite: **1140 tests passing** (130 test files), 0 TS errors, vite build OK.

---

### BB-auto max plan status
- Generic, BB-cycle and FullProgram paths use the shared finalizer for volume, fatigue budget, phase/taper safety, validation, report and export snapshots.
- `adapt` paths use diary feedback/double progression; `faithful` preserves source selection/order while retaining safety and derived metadata.
- Saved BB variants and UserProgram imports migrate legacy records and retain phase, volume, fatigue, report, validation and safety metadata.
- Pro-quality upgrades (Phase A/B/C/D below): RIR drift, weight progression, glute focus, per-exercise tempo, intensity techniques, lengthened bias, warmup ramp, female glute split, volume budget redistribution, 2-layer engine.
- Remaining risks are limited to non-blocking UI smoke coverage and deeper future integration of target-volume planning with feeder selection.

---

## BB-auto Pro-Quality Audit Fixes (Aug 3 2026)

Full critical analysis of BB-auto bodybuilding plan generation across 6 directions (mass/cut/recomp/strength_mass/female-glute/enhanced). 52 bugs found and fixed across 3 phases (A: critical, B: pro-content, C: architectural). 52 new tests added.

### PHASE A — Critical user-facing failures (10 fixes)

#### A1-A2: RIR drift differentiation + per-week drift
- **Problem**: `FOCUS_RIR_TABLE` had `driftPer2Weeks=-1` for ALL focuses (strength=hypertrophy=endurance), but `bbRir` drift formula wasn't producing visible RIR changes week-over-week within a phase.
- **Fix**: `bb-goal-types.ts:28-32` — endurance `driftPer2Weeks=0` (metabolic focus, no neural peaking); strength/hypertrophy keep `-1`. `bb-builder.engine.ts:498-512` — `bbRir` drift formula confirmed working: `drift = floor(phaseWeek/2)`, RIR drops every 2 weeks within same phase.

#### A3: autodraftBBPlan — missing field forwarding
- **Problem**: `autodraftBBPlan` (manual-draft.engine.ts:146-170) did NOT forward `focusGroup`, `intensityTechnique`, `autoDeload`, `specialization`, `sex`, `planStartWeek`, `loadStrategy`, `deloadType` to `BBBuilderInput`. User-selected options were silently dropped.
- **Fix**: `manual-draft.engine.ts:22-72` — `AutoDraftOptions` extended with all missing fields; `autodraftBBPlan` now forwards all of them to `BBBuilderInput`.

#### A4: Glute focus — 0 sets/week for female (structural block)
- **Problem**: `focusGroup='glutes'` + `sex='female'` + `FullBody` split → glutes got 0 sets/week. `TAG_PRIMARY_MUSCLES.FullBody` didn't include glutes, and `dedupeMuscles` only listed muscles from `TAG_MUSCLES[sessionTag]`, which for FullBody = ['chest','back','quads','hamstrings','shoulders','arms'] (no glutes).
- **Fix**: `bb-builder.engine.ts:843-848` — `isGlutePriority` extended to trigger when `focusGroup='glutes'` (not just female). `bb-builder.engine.ts:904-907` — `fbAllowsPrimary` bypasses FullBody primary distribution when `muscle === focusGroup`. `bb-builder.engine.ts:919-926` — focus muscle gets primary slot even when `maxPrimaries` reached. `bb-builder.engine.ts:490-501` — `dedupeMuscles` accepts `focusGroup` param and injects it into muscle list if missing.

#### A5: prescribeLoad loop — weight/reps not progressing
- **Problem**: `prescribeLoad` loop (bb-builder.engine.ts:2167-2196) only applied `nextWeight` to workSets, ignoring `nextReps` and `nextRIR`. For `double_progression` when `currentReps < repCap`, `nextWeight = currentWeight` (no change!) → weight stayed flat for weeks.
- **Fix**: `bb-builder.engine.ts:2184-2210` — now applies `nextWeight` + `nextReps` to workSets. RIR is NOT overridden (managed by `bbRir` phase-based periodization, not by prescribeLoad). Also: skip progression when previous week was deload (avoids post-deload weight jump from low base).

#### A6: applyTaperToFinalWeeks — RIR+2, tempo swap, no single-set
- **Problem**: Taper only cut volume (sets), didn't change RIR or tempo. `Math.max(1, ...)` floor allowed 1-set exercises. `totalWeeks` parameter was declared but never used.
- **Fix**: `bb-autocoach.engine.ts:744-820` — taper now applies RIR shift (+0, +1, +2 across 3 weeks), tempo swap (3-1-1-0 → 4-1-2-0 → 4-2-2-0), and floor=2 (no 1-set exercises). `totalWeeks` used for taper window selection.

#### A7: normalizeWeekMrv — floor=2 after MRV cap
- **Problem**: `Math.max(1, Math.floor(v))` in MRV cap could reduce exercises to 1 set, overriding the per-exercise floor of 2.
- **Fix**: `bb-builder.engine.ts:609-625` — floor changed to `Math.max(2, ...)`. If cap too small for all exercises with ≥2 sets, last exercises get cut to 2 (not 1).

#### A8: EXECUTION_NOTES — dual-key lookup (EN id + RU name)
- **Problem**: `EXECUTION_NOTES` had 29 English-key entries (`bench_press`, `squat`), but `buildExComment` looked up by `name` which was typically Russian ("Жим штанги лёжа"). Lookup always returned `undefined` → 0 execution notes in output.
- **Fix**: `bb-builder.engine.ts:328-410` — added 20+ RU-name fallback entries. `buildExComment:676-680` — dual-key lookup: first by `exerciseId`, then by `name`, then by `name.toLowerCase()`.

#### A9-A10: ANGLE_CLASSES expansion (biceps + quads)
- **Problem**: `ANGLE_CLASSES.biceps` had 4 classes (barbell/dumbbell/hammer/cable) — no incline curl (lengthened), no preacher curl (shortened). `ANGLE_CLASSES.quads` had 3 classes — no sissy squat (lengthened), no belt squat, no step-up.
- **Fix**: `bb-builder.engine.ts:1342-1360` (biceps) — 6 classes: `barbell_curl`, `incline_lengthened`, `hammer_brachialis`, `preacher_shortened`, `cable_constant`, `dumbbell_curl`. `bb-builder.engine.ts:1314-1327` (quads) — 5 classes: `compound_squat`, `lunge_bulgarian`, `sissy_lengthened`, `extension`, `belt_stepup`.

### PHASE B — Pro-level content (6 fixes)

#### B1: phaseRepShift — rep range moves within phase
- **Problem**: Reps were constant within a phase (W1=W3=W5 = same reps). No progression signal.
- **Fix**: `bb-builder.engine.ts:951-960` — `repShift = floor(phaseWeek/2)` reduces reps by 1 every 2 weeks within accumulation/intensification. Deload: no shift (recovery).

#### B2: Per-exercise tempo override table
- **Problem**: All exercises in same phase had identical tempo (`3-1-1-0` for accumulation). Pro coaches vary tempo by exercise (deadlift `2-0-1-0`, RDL `3-1-1-0`, cable fly `3-2-1-0`).
- **Fix**: `bb-tempo-rest.ts:48-70` — `EXERCISE_TEMPO_OVERRIDES` table (30+ entries). `exerciseTempoOverride(name)` function. `tempoFor()` accepts `exerciseName` param — per-exercise override has priority over phase default.

#### B3: autoAssignIntensityTechniques in finalizeBBPlan
- **Problem**: 0% of plans had intensity techniques (dropset/rest_pause/myo_rep). `bb-intensity-techniques.ts` defined them but `autodraftBBPlan` never set `intensityTechnique`.
- **Fix**: `bb-finalize.engine.ts:419-475` — `autoAssignIntensityTechniques(plan, level)` function. Heuristic assignment: cable fly → dropset, leg extension → myo_rep, curl → rest_pause, triceps pushdown → dropset, lateral raise → rest_pause, leg curl → dropset. Only for ≥intermediate, only accessory/памп, only non-deload weeks, max 2-3 per session.

#### B4: lengthenedBonus in exercise selection
- **Problem**: `STRETCH_DB` was removed as dead code. No "lengthened bias" in exercise SELECTION (only in ordering via `stretchRank`).
- **Fix**: `bb-builder.engine.ts:360-369` — `lengthenedBonus(name)` returns +10 for RDL/incline curl/sissy squat/overhead tricep/pullover/deficit. Applied in exercise selection sort: `saTotal = _score + lengthenedBonus`.

#### B5: Warmup ramp (bar×15 → 50%×10 → 70%×5 → 80%×3)
- **Problem**: Warmup had 2-4 sets with fixed reps 6-8, percentages 30-85%. Not a pro-style graded pyramid.
- **Fix**: `bb-builder.engine.ts:688-712` — `buildWarmup` now produces: bar×15 → 50%×10 → 70%×5 → 80%×3 (if >60кг) → 90%×1 (if >100кг). Graded reps (15→10→5→3→1).

#### B6: selectBestBBSplit — graduated penalty
- **Problem**: `daysPerWeek` scoring was binary (+25 if fits, -20 if not). No gradient for small vs large mismatch.
- **Fix**: `bb-selector.engine.ts:57-71` — graduated: ≤0.5 over → +25, ≤1.5 over → +10, ≤2.5 over → -5, >2.5 over → -15.

### PHASE C — Architectural refactors (2 improvements)

#### C1: Extract bb-exercise-selection.engine.ts
- **Problem**: `buildSession` was 1700+ lines with 40+ parameters. `ANGLE_CLASSES` and selection logic were embedded, untestable independently.
- **Fix**: New file `bb-exercise-selection.engine.ts` (170 lines) — exports `ANGLE_CLASSES`, `lengthenedBonus`, `selectDiverseExercises`. Independently testable. `buildSession` still uses its internal copy (backward-compat), but the extracted version is the canonical source for future refactoring.

#### C2: Stateful periodization with sRPE feedback (already integrated)
- **Problem**: Audit identified that `applyFeedbackToBuild` was not wired into `buildBBPlan`.
- **Finding**: Already integrated! `bb-builder.engine.ts:2623-2637` calls `applyFeedbackToBuild`, `autoUpdateWeakPoints`, `autoReplaceOnPlateau`, and `computePerMuscleACWR` when workout sessions exist in the diary. Stateful periodization is functional — diary sRPE feedback adjusts next week's weights/reps/RIR.

### Files modified
- `src/engines/bb/bb-goal-types.ts` — FOCUS_RIR_TABLE endurance drift=0
- `src/engines/bb/bb-builder.engine.ts` — bbRir drift, dedupeMuscles focusGroup, glute focus bypass, prescribeLoad weight+reps, normalizeWeekMrv floor=2, EXECUTION_NOTES dual-key, ANGLE_CLASSES expansion (biceps+quads), phaseRepShift, per-exercise tempo, lengthenedBonus, warmup ramp
- `src/engines/bb/bb-autocoach.engine.ts` — applyTaperToFinalWeeks RIR+2, tempo swap, floor=2, totalWeeks usage
- `src/engines/bb/bb-tempo-rest.ts` — EXERCISE_TEMPO_OVERRIDES, exerciseTempoOverride, tempoFor exerciseName param
- `src/engines/bb/bb-finalize.engine.ts` — autoAssignIntensityTechniques
- `src/engines/bb/bb-selector.engine.ts` — graduated penalty for daysPerWeek
- `src/engines/bb/bb-exercise-selection.engine.ts` — NEW: extracted ANGLE_CLASSES + lengthenedBonus + selectDiverseExercises
- `src/engines/manual-constructor/manual-draft.engine.ts` — AutoDraftOptions extended, autodraftBBPlan forwards all fields

### Tests
- `src/engines/bb/__tests__/bb-pro-quality-phase-a.test.ts` — **20 tests**: A1 FOCUS_RIR_TABLE, A2 bbRir drift, A3 autodraftBBPlan forwarding, A4 glute focus, A5 weight progression, A6 taper RIR+tempo, A7 floor=2, A8 EXECUTION_NOTES, A9-A10 ANGLE_CLASSES.
- `src/engines/bb/__tests__/bb-pro-quality-phase-b.test.ts` — **20 tests**: B1 phaseRepShift, B2 per-exercise tempo, B3 intensity techniques, B4 lengthenedBonus, B5 warmup ramp, B6 graduated split penalty.
- `src/engines/bb/__tests__/bb-pro-quality-phase-c.test.ts` — **12 tests**: C1 ANGLE_CLASSES extraction, C2 applyFeedbackToBuild integration.
- Full suite: **1093 tests passing** (128 test files), 0 TS errors, vite build OK.

---

## BB-auto Pro-Quality Phase D — Additional Refactors (Aug 3 2026)

4 additional refactors completed: female glute split, per-day volume budget, 2-layer engine, split patterns cleanup. 19 new tests added.

### D1: Female glute path — dedicated `female_glute_5` split
- **Problem**: Female trainees with `focusGroup='glutes'` had no dedicated split pattern. `glute_focus_4` existed but only 4×/нед; female glute hypertrophy benefits from 3×/нед frequency (Schoenfeld 2016).
- **Fix**: New `female_glute_5` split in `bb-split-patterns.ts` — 5×/нед: 3 glute sessions (2 тяж Glutes + 1 тяж GlutesHams + 1 памп Glutes) + 2 upper sessions. `bb-demographics.ts:femaleAdjust` now recommends `female_glute_5`. `bb-selector.engine.ts` gives +25 bonus to `female_glute_5` when `sex='female'` + `focusGroup='glutes'`. `BBSelectorInput` extended with `sex` and `focusGroup` fields. `autodraftBBPlan` forwards both to `selectBestBBSplit`.

### D2: Per-day volume budget with redistribution
- **Problem**: When MRV cap was too small for all exercises with ≥2 sets, `normalizeWeekMrv` would silently reduce exercises to 1 set (violating the floor of 2). No explicit rationale was given for why an exercise was cut.
- **Fix**: `bb-builder.engine.ts:normalizeWeekMrv` now removes entire exercises (accessory first, primary last) when `minTotal > cap`, rather than cutting to 1 set. Removed exercises get explicit comment: "⚠ Исключено: MRV=N сетов/нед для muscle достигнут." This produces clean plans with 0 single-set exercises.

### D3: 2-layer engine — selection + loading separation
- **Problem**: `buildSession` (1700+ lines, 40+ parameters) mixed exercise selection (which exercises) and loading (sets/reps/RIR/tempo/rest/weight). Untestable independently.
- **Fix**: New file `bb-loading-layer.engine.ts` (160 lines) — exports `computeLoading(input: LoadingInput): LoadingOutput`. Takes muscle/exercise/role/phase/week/workMax and returns sets/reps/RIR/weight/tempo/rest/workSets/warmupSets. Independently testable. `bb-builder.engine.ts` exports `bbRir` and `weightForRepMax` (were private). Selection layer already extracted in C1 (`bb-exercise-selection.engine.ts`).

### D4: SPLIT_PATTERNS cleanup
- **Problem**: `upper_lower_3` split had `sessionsPerRotation: 3` but actually had 4 training days in its schedule — data inconsistency that could cause selector scoring errors.
- **Fix**: `bb-split-patterns.ts:238` — `sessionsPerRotation` corrected to 4, name updated to "Верх/Низ 4×/нед (2 тяж + 2 памп)". All 25 split patterns validated: unique IDs, schedule.length === rotationDays, sessionsPerRotation === training days count, non-empty name/description.

### Files modified (Phase D)
- `src/engines/bb/bb-split-patterns.ts` — new `female_glute_5` pattern, `upper_lower_3` data fix
- `src/engines/bb/bb-demographics.ts` — `femaleAdjust.splitByDays` → `female_glute_5`
- `src/engines/bb/bb-selector.engine.ts` — `BBSelectorInput` +sex +focusGroup, +25 bonus for `female_glute_5`
- `src/engines/manual-constructor/manual-draft.engine.ts` — forwards sex + focusGroup to selector
- `src/engines/bb/bb-builder.engine.ts` — `normalizeWeekMrv` redistribution with explicit rationale, export `bbRir` + `weightForRepMax`
- `src/engines/bb/bb-loading-layer.engine.ts` — NEW: loading layer (`computeLoading`)

### Tests (Phase D)
- `src/engines/bb/__tests__/bb-pro-quality-phase-d.test.ts` — **19 tests**: D1 female_glute_5 (5 tests), D2 volume budget (2 tests), D3 computeLoading (6 tests), D4 SPLIT_PATTERNS validation (6 tests).
- Full suite: **1115 tests passing** (129 test files), 0 TS errors, vite build OK.

### Git
- `origin/main` - tracked
- uncommitted changes: 7 files (audit fixes re-applied after other agent's commit overwrote them)
- last commit: 8a163f027 (other agent) / 44be2c068 (partial audit fixes committed)

---

## Nutrition Planner Button Audit Fixes (Aug 3 2026)

Full critical analysis of all buttons and functions in the nutrition planner. 43 bugs found (7 P0, 18 P1, 18 P2). All P0 + P1 + key P2 fixes applied.

### P0 — Critical fixes (crashes / broken functionality)
1. **BUTCH bjuHigh/bjuLow crash** — `generateBUTCH()` in `planner-special-meals.ts` didn't return `bjuHigh`/`bjuLow`, but UI accessed `butchPlan.bjuHigh.kcal` → TypeError on every "БУЧ" button click. Fixed: added `bjuHigh`/`bjuLow` computed from highCarb/protein/fatHigh/lowCarb/fatLow.
2. **replaceMealWithRecipe hardcoded 100g** — `IndividualPlanContext.tsx:626` set `amount: 100` for ALL recipe ingredients regardless of actual proportions. Fixed: grams computed from per-item kcal = recipe.kcal/N, scaled to food.kcal density. Also added bounds check on `mealIdx`.
3. **allergenReport `new Set(null)` crash** — `planner-reports.ts:32` passed `allergens` directly to `new Set()` without null-guard. Fixed: `new Set(Array.isArray(allergens) ? allergens : [])`.
4. **riskReport `weight=0` → Infinity** — `planner-reports.ts:111` divided protein by weight without guard. Fixed: `const w = weight && weight > 0 ? weight : 80`.
5. **mealsCount undefined → 3-meal plan** — `meal-plan-engine.ts:1031` had no validation on `input.mealsCount`. `undefined <= N` is always false → all workout roles removed. Fixed: `if (!input.mealsCount || isNaN(input.mealsCount) || input.mealsCount < 3) input.mealsCount = 5`.
6. **mealsCount < 3 protein overload** — `meal-plan-engine.ts:1184` dumped entire `residualP` into lunch, producing 60-80g protein meals (violates MPS ceiling ~40g). Fixed: split residualP 50/50 between breakfast and lunch.

### P1 — Important fixes (incorrect data / state loss)
7. **cheatMealPlan.bjuBreakdown undefined** — `generateCheatMeal` didn't return `bjuBreakdown`, UI rendered empty. Fixed: added `bjuBreakdown` computed from bju percentages.
8. **carbloadPlan.bju.p = daily protein** — `generateCarbload` set `bju.p = effectiveP` (~160g) instead of protocol protein (~1.2g/kg = 96g). Fixed: `proteinG = Math.round(deps.weight * 1.2)`.
9. **lazyDayPlan/cravingPlan missing timing** — `IndividualPlanResults.tsx:272` pushed `{ products }` without `timing` field, inconsistent with cheatMeal/carbload. Fixed: added `timing: 'regular'`.
10. **undo snapshot incomplete** — `saveUndo()` in `IndividualPlanContext.tsx:497` only saved dayPlan/threeDayPlan/weekPlan, not shoppingList/waterCalc/recommendations. Fixed: added all three to snapshot.
11. **undoLast stale closure** — `MealQuickControls.tsx:308` read `undoStack` from closure instead of functional updater. Double-click lost second undo. Fixed: `setUndoStack(prev => ...)` pattern.
12. **saveCurrentPlan quota failure silent** — `IndividualPlanContext.tsx:1963` only `console.warn` on quota exceeded. Fixed: now calls `setErrorMsg` to show user-visible error.
13. **autoCorrectPlan no undo** — `IndividualPlanContext.tsx:1965` didn't call `saveUndo()` before modifying. Fixed: added `saveUndo()` at function start.
14. **autoCorrectPlan uniform ratio** — applied single kcal-ratio to P/F/C. Failed on mixed imbalances. Fixed: per-macro ratios (ratioP/ratioF/ratioC) based on item's dominant macro.
15. **removeFoodItem/replaceFoodItem stale closure** — `updateMultiDayPlan` used `plan === threeDayPlan` reference comparison which failed on stale closures. Fixed: determine plan type by `days.length` (3=threeDay, 7=week).
16. **runMonthPlan race condition** — 50ms setTimeout yield didn't guarantee React commit. Fixed: increased to 100ms + `skipUndo: true` option in generatePlan.
17. **runMonthPlan undo corruption** — 5×saveUndo filled undoStack (cap=5), destroying user's history. Fixed: single `saveUndo()` before loop + `{ skipUndo: true }` per iteration.
18. **generatePlan days=1 builds d2/d3** — `IndividualPlanContext.tsx:1857` built all 3 days even for days=1, wasting CPU and polluting usedFoodIds. Fixed: conditional `days >= 3 ? buildDay(...) : null`.
19. **buildRecommendations daysCount=0 → NaN** — `planner-recommendations.ts:103` divided by `planDaysForAnalysis.length` which could be 0. Fixed: `Math.max(1, planDaysForAnalysis.length)`.
20. **carbloadPlan.foods.map no Array guard** — `IndividualPlanResults.tsx:1650` called `.map()` without Array.isArray. Fixed: `(Array.isArray(carbloadPlan.foods) ? carbloadPlan.foods : []).map(...)`.
21. **dayPlan.meals.flatMap no null guard** — `IndividualPlanResults.tsx:1411` accessed `dayPlan.meals.flatMap` without checking meals=null. Fixed: `(Array.isArray(dayPlan.meals) ? dayPlan.meals : []).flatMap(...)`.

### P2 — Quality fixes
22. **PopupNumber parseInt truncates fractional** — `PopupXxx.tsx:55` used `parseInt(edit)` for slider position, truncating 14.5 → 14. Fixed: `parseFloat(edit)`.
23. **PopupNumber no min/max clamp on OK** — could type 99999 for height (max=250). Fixed: `if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v)`.
24. **PopupNumber stale edit state** — didn't sync with external prop changes when popup closed. Fixed: `useEffect(() => { if (!open) setEdit(String(value)); }, [value, open])`.
25. **Time parsing no try/catch** — `meal-plan-engine.ts:1039,1045` produced "NaN:NaN" on malformed input. Fixed: try/catch with fallback defaults.
26. **Doc/code mismatch 150 vs 60 min** — comment said ">=150 min gap" but code used 60. Fixed: comment updated to ">=60 min".
27. **nutrMult dead code** — `IndividualPlanContext.tsx:1166` computed but never used. Removed.
28. **budget=null → "undefined" in UI** — `planner-reports.ts:86` didn't guard budget. Fixed: `const b = budget || 'medium'`.
29. **Pre/post-workout rationale hardcoded** — showed constant 40g/60g instead of actual carbG. Fixed: use `carbG` parameter in rationale text.
30. **Post-build carb cap division by zero** — `meal-plan-engine.ts:759` divided by `it.amount` which could be 0. Fixed: `if (it.amount > 0)` guard.
31. **Intermediate totals missing fiber/leucine** — fat/protein/iterative correction blocks didn't update `totals.fiber`/`totals.leucine_mg`. Fixed: added reduce calls for both fields.
32. **OrganLoad hardcoded sat/trans** — `OrganLoadCalculator.tsx:165` used `sat=fat*0.3`, `trans=1g` regardless of diet. Fixed: budget-aware heuristics.
33. **"Общий отчёт" no dayPlan check** — `IndividualPlanResults.tsx:1335` batch-generated reports without checking dayPlan exists. Fixed: `if (!dayPlan) { setErrorMsg(...); return; }`.
34. **planner-mealprep null m.items** — `planner-mealprep.ts:29` called `m.items.map()` without guard. Fixed: Array.isArray checks on meals and items.

### Files modified
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-special-meals.ts` — BUTCH bjuHigh/bjuLow, cheatMeal bjuBreakdown, carbload protein
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — replaceMealWithRecipe, saveUndo completeness, autoCorrectPlan, updateMultiDayPlan, generatePlan skipUndo, dead code removal
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-reports.ts` — allergen null-guard, weight guard, budget guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-recommendations.ts` — daysCount guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanResults.tsx` — undoLast functional updater, lazyDay timing, carbload Array guard, dayPlan.meals guard, "Общий отчёт" check, runMonthPlan yield+skipUndo
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/MealQuickControls.tsx` — undoLast functional updater
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine.ts` — mealsCount validation, protein distribution, time parsing try/catch, carb cap guard, intermediate totals, rationale fix
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-mealprep.ts` — null m.items guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/OrganLoadCalculator.tsx` — budget-aware sat/trans heuristics
- `src/ui/components/PopupXxx.tsx` — parseFloat, min/max clamp, useEffect sync

### Tests
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/__tests__/button-audit-fixes.test.ts` — **21 new tests**: P0-1 BUTCH bjuHigh/bjuLow (3 tests), P0-2 cheatMeal bjuBreakdown (1 test), P0-3 carbload protein (3 tests), P0-4 allergen null-guard (3 tests), P0-5 riskReport weight guard (3 tests), P0-6 mealsCount validation (4 tests), P1-7 budget null guard (3 tests), P1-8 buildRecommendations daysCount (1 test).
- Full suite: **999 tests passing** (124 test files), 0 TS errors, vite build OK.

---

## Audit fixes (Jul 31 2026) — re-applied after overwrite

After a full audit of ПЛ-авто, ББ-авто, and ручной планировщик, the following fixes were applied:

### P0 — Critical bugs
1. **`require()` in ESM/browser** — `designer-to-program.ts` and `macrocycle-to-bb.ts` used `require()` (not available in Vite/browser). try/catch silently returned null → "Применить с упражнениями" and MacrocyclePanel "apply as BB" produced **empty programs**. Fixed: replaced with static imports.
2. **`trainingFocus` mertворождённый** — `BBBuilderInput.trainingFocus` existed, `bbRir()` used it, but **NO UI path** forwarded it. Fixed: added `trainingFocus` + recovery metrics (`bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`, `labMrvMultiplier`) to `AutoDraftOptions`, `CycleToPlanInput`, `DesignerToUserWeeksOptions`, `MacrocycleToBBOptions`, `ProgramMeta`. Wired in `SRCBBScreen.buildBb`, `ProgramManagerPanel.autoFillDraft`, MacrocyclePanel modal. Added UI selector in BB-auto.

### P1 — Important fixes
3. **`tempoFor(phase?)`** — 4 call sites in `bb-builder.engine.ts` called `tempoFor('памп')` without passing `phase`, ignoring ACSM 2023 eccentric modulation. Fixed: all 4 now pass phase (3 from week loop scope, 1 via `phaseByWeek` Map parameter added to `compensateCrossDayWeakPoints`).
4. **`applyPLTaper` guard** — always cut volume on final 2 weeks, even if already low-volume (< 60% of previous). Could produce 1 set with RIR 6 (overtraining). Fixed: added `weekVolume()` check — skip taper if week already deloaded.
5. **Deload volume cut in `macrocycle-to-bb`** — `adjustSessionRir` for deload only increased RIR +3 without cutting sets (incomplete deload per Helms/NSCA). Fixed: now cuts sets to 60% (Math.ceil(sets.length * 0.6)).
6. **Silent failure in MacrocyclePanel modal** — if `deserializeMacro` returned null (corrupted/missing storage), code silently did nothing. Fixed: added toast warnings for missing/damaged macrocycle.

### P2 — Quality
7. **`norm()` dedup** — 4 separate `function norm()` definitions across codebase with different behavior (lms-builder had no null-guard/trim, diary-autoreg had both). Fixed: created `src/engines/norm.ts` shared helper (null-guard + trim + ё→е), replaced lms-builder and diary-autoreg local copies.
8. **`pedMrvMult` misleading param name** — `injectPLWeakPoints` parameter named `pedMrvMult` but actually received `combinedMrvMult` (pedMrvMult × recoveryMult). Fixed: renamed to `mrvMult`.
9. **`PlannerApply.data` typing** — was `any`. Added typed payload interfaces (`SplitPayload`, `PmPayload`, etc.) for future narrowing. `data` kept as `any` for backward-compat with ~20 consumer call sites.
10. **`undertrained` ACWR comment** — `volMod=1.1, rirShift=0` had no explanation. Added: "Растренированность: стимул +10% объёма без RIR-shift".

### Tests
- `src/engines/bb/__tests__/training-focus-and-taper.test.ts` — 19 tests: trainingFocus RIR (strength vs endurance), tempoFor phase param, taper guard, ACWR+taper intersection, deload volume cut, recovery metrics.
- Cleaned up 4 `_tmp_*.test.ts` temp files from other agent (broken imports, no assertions).

---

## Планировщик питания: error fix (in progress Jul 30 2026)

User reported: "не генерируется рацион - выбивает ошибку при нажатии" with `TypeError: cannot read properties of undefined (reading length)`.

Root cause (most likely): stale localStorage from previous app versions. When the planner's `useState` initializers called `JSON.parse(localStorage.getItem(...))` and the saved value was a string/number instead of an array (or any malformed shape), the state became a non-array, and downstream code that called `.filter/.map/.length` on it crashed.

Fixes applied (Jul 30 + Jul 30 continued):
- `planner-storage.ts`: new `readJSONSafe(key, fallback, validate)` helper + `migratePlannerStorage()` that auto-cleans 16 known planner keys whose JSON shape is expected to be an object/array; **also drops `null` values** (typeof null === 'object was passing through); **expanded migration to 27 keys** covering plan settings, UI prefs, and pharma data
- `IndividualPlanContext.tsx`:
  - runs `migratePlannerStorage()` once on mount (idempotent via `he_planner_schema_version` key, v4)
  - hardens 11 useState initializers (savedPlans, monthPlan, preferredFoods, excludedFoods, dietPrefs, allergens, healthIssues, lockedFoodIds, excludedCategories, takenSupplements, userRecipes) to validate Array.isArray and filter by `typeof === 'string'`
  - wraps "Сгенерировать план питания" click handler in try/catch so any future error shows in `errorMsg` UI
- `planner-preferences.ts:328`: `(f.id || '').toLowerCase()` defensive guard for missing f.id
- `meal-plan-engine.ts` already had `finally` cleanup of `_pickCtx` lock
- Refactored `addMacroTopUp` (was dead-code classic path) into clean helper function
- Added 3 new migration tests: corrupted scalar keys, null value dropping, preserved arrays/objects

Tests: 63/63 in NutritionScreen_parts/IndividualPlan/__tests__/ pass (added planner-storage.test.ts with 6 new tests).

---


### Годовое планирование (macrocycle.engine.ts)
- `buildMacrocycle(input)` — 5 фаз: endurance→strength→peak→competition→transition
- `macrocycleToActiveCycle(macro, week)` — активный cycleId на неделе N
- `rebalanceMacrocycle(macro, edits)` — ручная правка длительности фаз
- `serializeMacro`/`deserializeMacro` — localStorage
- `estimateCompetitionWeek(isoDate, total)` — неделя соревнований из даты
- `MacrocyclePanel.tsx` — UI: таймлайн, выбор недели соревнований, клик→применить цикл
- Вкладка `🗓 Годовой план` в ПЛ-авто (SRCBBScreen)

### Авторегуляция весов — 3 режима (AutoRegMode: 'off'|'auto'|'diary')
- **ВЫКЛ** — плановые веса без корректировки
- **АВТО** — readiness+HRV+ACWR+sleep+fatigue → topSetPctMultiplier/volumeMultiplier/rirShift (autoRegulate)
- **ДНЕВНИК** — per-exercise корректировка из последней сессии дневника (diary-autoreg.engine.ts):
  - fact RPE vs target RPE (10-plannedRir) → вес через loadForRPE(e1RM, targetRPE, reps)
  - factRPE ≥ 9.5 → -1 подход; delta > 2 → RIR +1
  - plateau: 3+ сессии без роста e1RM → plateauWarning + RIR +1
  - fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - нет данных → fallback на плановые веса
- Сегментированный переключатель в ПЛ и ББ секциях SRCBBScreen
- Применяется в: srcDays (SessionPlayer ПЛ), bbDaysArr (SessionPlayer ББ), BB-таблица SessionPlayer

### P0-багфиксы (done Jul 30 2026)
- BUG-1: `injectPLWeakPoints` — двойной `.filter` заменён на один fuzzy match (lms-builder.engine.ts:271)
- BUG-2: MRV soft-cap для light-day — пустой `if (ref) {}` заменён на реальную проверку (lms-builder.engine.ts:343)
- BUG-3: `cycleTemplateToFullProgram` — explicit weeks реализованы дословно вместо игнорирования (cycle-to-plan.ts:227)

### P1: buildLMSPlan интеграции (done Jul 30 2026)
- `LMSBuildInput` расширен: `acwr`, `autoReg`, `peds`, `pedDoses`
- ACWR-авто-делод: zone=caution → объём×0.85, RIR+1; zone=dangerous → объём×0.65, RIR+2, deload
- Авторегуляция: `topSetPctMultiplier` → к весам, `volumeMultiplier` → к объёму, `rirShift` → к RIR
- PED-адаптация: хардкод `pedMrvMult` заменён на `adaptForPEDs` (dose-aware) при передаче `peds`
- UI: `buildSrc()` передаёт `acwrData`, `autoRegResult` (при mode='auto'), `peds`, `pedDoses`
- Тесты: 6 новых в lms-planner.test.ts (ACWR caution/dangerous, autoReg weight/RIR, PEDs, комбо)

### P1: PL Taper (done Jul 30 2026)
- `applyPLTaper(weeks, totalWeeks)` — авто-taper к финальным 2 неделям (peaking phase)
- Финальная неделя N-1: объём ×0.65, RIR +1; неделя N: объём ×0.45, RIR +2
- Интенсивность (вес) сохранена (Bosquet 2005)
- Не применяется при: faithful (explicit weeks), ACWR deload, план < 4 нед
- Тесты: 5 новых (taper объём/RIR/rationale/ACWR-делод/faithful)

### P2: Тесты покрытия (done Jul 30 2026)
- `weakpoint-pl.test.ts` — 11 тестов (7 лифтов × слабые точки, fallback, WEAK_POINTS_BY_LIFT)
- `lms-selector.test.ts` — 10 тестов (rankCycles сортировка, direction/level/days score, selectBestCycle, explainSelection)
- `inject-pl-weakpoints.test.ts` — 6 тестов (инъекция ассистентов, day cap ≤8, weight >0, все недели)
- Удалён мёртвый `macrocycle-sources.ts` (не импортировался нигде)

### P3: Паритет с ББ (done Jul 30 2026)
- **Recovery multiplier**: `LMSBuildInput` расширен (`bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`)
  - Helms 2022, Plews 2022, Watson 2022: композиция тела + HRV + сон + стресс → MRV soft-cap
  - `combinedMrvMult = pedMrvMult × recoveryMult` — применяется к injectPLWeakPoints и weakGroup добивкам
  - UI: `buildSrc()` передаёт метрики из `linked.profile`/`linked.readiness`
  - Тесты: 3 новых (хорошие/плохие метрики, отсутствие меток)
- **sRPE feedback loop**: `lms-progression-feedback.engine.ts` — `computePLPlanFeedback(plan, sessions)`
  - Для каждого упражнения последней недели: последняя запись дневника → e1RM, fact RIR vs planned RIR
  - `prescribeLoad` (double_progression) с plannedRir → success-aware коррекция (RIR≥+2 → +reps, RIR≤-2 → -5% weight)
  - `summarizePLFeedback` — withFact/noData/plateau/avgRirDelta
  - Fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - Тесты: 7 новых (source fact/plan, fuzzy match, rirDelta, summary)
- **Double progression**: реализован через feedback loop (`prescribeLoad` strategy='double_progression')

---

## BB-builder: Priority 1 - RIR by training focus (DONE Jul 30 2026)

Goal: add `BBTrainingFocus` type (`'strength' | 'hypertrophy' | 'endurance'`) to control RIR/reps/tempo based on evidence 2022+.

Done:
- `bb-goal-types.ts` - created with `FOCUS_RIR_TABLE`, `FOCUS_REPS_TABLE`, `PHASE_TEMPO`, `LEVEL_REP_MOD`
- `bb-tempo-rest.ts` - `tempoFor()` accepts optional `phase` param (ACSM 2023: eccentric 2-4s)
- `bb-builder.engine.ts`:
  - Added `trainingFocus` + `bodyFat` + `leanMass` + `hrvMs` + `sleepHours` + `stressLevel` + `eccentricMult` + `calorieSurplus` + `proteinPerKg` to `BBBuilderInput`
  - `bbRir()` takes `focus` param - uses `FOCUS_RIR_TABLE` (Roberts 2022, Schoenfeld 2021)
  - `buildSession()` accepts `trainingFocus` and forwards to `bbRir`
  - Recovery multiplier from `bodyFat/leanMass/hrvMs/sleepHours/stressLevel` → MRV adjustment
  - Protein/calorie multiplier from `proteinPerKg/calorieSurplus` → MRV adjustment

---

## BB-builder: Critical audit fixes (DONE Jul 30 2026)

Full critical analysis of BB-auto engine. Fixed PL exercises appearing on wrong muscle groups + code quality.

### ФАЗА 1: Каталог + PL→BB group fixes (P0)
- `exercise-catalog.ts`: `bench_closegrip` group `chest`→`triceps`, `face_pull` group `back`→`shoulders`, `deadlift_romanian` group `back`→`legs`
- `lms-builder.engine.ts`: `injectPLWeakPoints` + `groupOfExercise` use `trueMuscleOf` instead of catalog `.group` (bench_closegrip→triceps MRV, face_pull→shoulders MRV); `liftToEnGroup`: deadlift `back`→`hamstrings`
- `cycle-to-plan.ts` `muscleGroupFromExName`: priority checks for close-grip→triceps, overhead triceps→triceps; added English names (deadlift→legs, squat→quads, row→back, pull-up→back); `deadlift`→`legs` (was default `chest`)
- `cycle-to-plan.ts` `replacePLForBB`: close-grip `Грудь`→`Трицепс`; BB posterior chain (RDL/гудморнинг/hyperextension) excluded from replacement (they're already BB exercises, not PL)
- `cycle-to-plan.ts` `isLegs`: expanded to include `legs`/`glutes`/`calves` groups (was only `quads`/`hamstrings` — Румынская тяга with group=legs leaked into ChestBack days)

### ФАЗА 2: Dead code removal (P1)
- Deleted `charReps()` (bb-builder:470-475) — not called, replaced by `PHASE_CONFIGS[phase].repRange`
- Deleted `phaseBaseRir()` (bb-builder:480-486) — not called, replaced by `bbRir()`
- Removed unused imports `FOCUS_REPS_TABLE`, `LEVEL_REP_MOD` from bb-builder
- NOTE: `rirDrift` and `bb-intensity-techniques.ts` were NOT deleted (used by BbAutoConstructor/BbToolsCard UI)

### ФАЗА 3: Logic fixes (P1)
- `restProgression` (bb-builder:1465): deload → +30s rest (recovery), other phases → -15s/week (density). Was always -15s which made deload harder.
- `applyTaperToFinalWeeks` (bb-autocoach:737): skip weeks already at deload volume (<60% prev). Prevents double reduction (taper × deload = 22.5% volume = overtraining).
- `weightModFor` (bb-builder:1315): наклон 0.85→0.95 (Biel 2017: 30° incline = -5-10%, not -15%), машина 0.75→0.85, кабель 0.70→0.80 (Schoenfeld 2021)

### ФАЗА 4: Evidence-based (P2)
- `sessionShareFor` 3×/нед primary factor 1.5→1.2 (Schoenfeld 2016: high frequency = less per session, not more). Was inverted: 3×/нед gave MORE volume per session than 2×/нед.

### Tests
- 25 new tests in `bb-audit-fixes.test.ts`: catalog groups, trueMuscleOf, injectPLWeakPoints, muscleGroupFromExName edge cases, restProgression deload, taper deload-skip, sessionShareFor frequency, weightModFor
- All 454 tests pass (29 test files), 0 TS errors

---

## Ручной планировщик: доработка (done Jul 30 2026)

Связал три разрозненные системы фаз через мост + интегрировал годовое планирование + баг-фиксы.

### Баг-фикс: require() в ESM (Jul 30 2026)
- **BUG**: `ProgramManagerPanel` использовал `require('../../../engines/lms/macrocycle.engine')` для `deserializeMacro` — не работает в ESM/browser (vite), `macro` всегда null → годовое планирование не работало в ручном режиме.
- **Fix**: заменён на статический импорт `import { deserializeMacro } from '...';`.

### Баг-фикс: заглушки «Методики» (Jul 30 2026)
- **BUG**: inline-блок в `ProgramManagerPanel` (строки 1622-1686) — упрощённая заглушка с фильтром, без полных карточек.
- **Fix**: заменён на готовый `MethodologyEncyclopedia` компонент (ExpandableCard, категории, caveats, bestFor, ConjugateDesigner для Westside). Удалены неиспользуемые state `methCat`/`methSearch` и импорт `getTrainingMethods`.

### Годовое планирование: несколько соревнований (done Jul 30 2026)
- `macrocycle.engine.ts`:
  - `CompetitionEvent` тип: `{ id, name, week, date?, priority: 'A'|'B'|'C', notes? }`
  - `Macrocycle.competitions?: CompetitionEvent[]` — список соревнований
  - `MacroBlock.competitionId?: string` — связь блока с соревнованием
  - `buildMacrocycleMulti(events, input)` — авто-размещение peak/competition блоков под каждое соревнование
    - A (главное) → 4 нед peak + 1 нед competition
    - B (контрольное) → 2 нед peak + 1 нед competition
    - C (тренировочное) → встроено в подготовку, без отдельного блока
    - Между соревнованиями — strength/endurance (подготовка)
    - После главного (A) — transition 2-4 нед
  - `buildMacrocycle` с `input.competitions` → авто-вызов `buildMacrocycleMulti`
  - `serializeMacro`/`deserializeMacro` — сохранение/восстановление competitions (обратно-совместимо)
- `MacrocyclePanel.tsx`:
  - Менеджер соревнований: добавить/удалить/редактировать (название, неделя, приоритет)
  - Маркеры 🏁 на таймлайне для каждого соревнования (с приоритетом A/B/C)
  - Обзор соревнований под таймлайном
  - Одиночный режим (compWeek) сохранён для обратно-совместимости
- Тесты: 11 (macrocycle-multi.test.ts) — A/B/C приоритеты, сериализация, сортировка, обратно-совместимость

### Phase bridge (`src/engines/periodization/phase-bridge.ts`)
- `DESIGNER_TO_PHASE`: PhaseKey (10) → Phase (4) — коллапс 6 неканонических ключей
- `MACRO_TO_PHASE`: MacroPhase (5) → Phase (4)
- `designerPhaseToUserPhase()`, `macroPhaseToUserPhase()` — функции-мапперы
- `PHASE_TO_DESIGNER`, `PHASE_TO_MACRO` — обратные маппинги
- `isDeloadLikePhaseKey()`, `isDeloadLikeMacroPhase()` — deload-проверки
- Тесты: 12 (phase-bridge.test.ts)

### Designer → UserProgram (`src/engines/periodization/designer-to-program.ts`)
- `designerToUserWeeks(design, opts)` — конвертация MacrocycleDesign → UserWeek[]
  - По умолчанию: `sessions: []` (рендер из microcycleTemplate)
  - При `opts.fillExercises: true` — autodraftBBPlan на totalWeeks → weeks с упражнениями
  - Незакрытые недели → accumulation
- `applyDesignPhasesToWeeks(weeks, design)` — переразметка phase/deload в существующих неделях (сохраняет упражнения)
- `makeEmptySessionsForWeek(days)` — скелет пустых сессий
- Тесты: 11 (designer-to-program.test.ts)

### Macrocycle → BB program (`src/engines/lms/macrocycle-to-bb.ts`)
- `macrocycleToBBProgram(macro, opts)` — макроцикл ПЛ-авто → UserProgram (ББ)
  - autodraftBBPlan ОДИН раз на totalWeeks → createFromBuild → UserProgram
  - Переразметка weeks[i].phase через macrocycleToActiveCycle + macroPhaseToUserPhase
  - Для deload/peaking фаз — корректировка RIR (deload: +3, peaking: 0-1 для compounds)
  - Fallback: скелет с пустыми sessions при ошибке сборки
- Тесты: 6 (macrocycle-to-bb.test.ts)

### Bridge расширение (`planner-bridge.ts`)
- `PlannerApplyKind` += `'design'` | `'macrocycle'`
- PeriodizationDesignerTab: НОВАЯ кнопка «📥 Применить к новой программе» (kind='design')
  + кнопка «🏋️ Применить с упражнениями» (fillExercises=true)
  + sport селектор (powerlifting/bodybuilding/general/weightlifting/crossfit)
- ProgramManagerPanel.applyBridgePayload: новые case 'design' (к новой/текущей программе) и 'macrocycle' (ББ-программа)

### MacrocyclePanel в ручном планировщике
- `MacrocyclePanel.tsx`: снят `disabled` с level/goal селекторов (редактируемые через onLevelChange/onGoalChange)
- Storage migration v1→v2: если `kind` falsy → default 'SRC'
- Маркер текущей недели на таймлайне (вертикальная линия + input)
- ProgramManagerPanel:
  - `editorLibOpen` += `'macro'`
  - Кнопка «🗓 Годовой план» в secondary toolbar (isPro, все направления)
  - Модал с MacrocyclePanel: onApplyCycle для PL (loadCycleIntoEditor), BB (macrocycleToBBProgram), Hybrid (bbWeeks)
  - `mapGoalToMacro()` — маппинг goal UserProgram → goal MacrocyclePanel

### Баг-фиксы (Jul 30 2026)
- **BUG-6.1**: `addWeakToWeek` (`ProgramEditorComponents.tsx:103`) — добавлял слабые группы только в week 0. Исправлено: добавляет во все недели (кроме deload), с уникальными id блоков для каждой недели.
- **BUG-6.2**: `PLSetEditor.calcW` (`ProgramEditorComponents.tsx:714`) — для accessory использовал `workMax['squat']` (абсурдные веса для трицепса). Исправлено: для accessory возвращает `null` (вес вводится вручную).
- **BUG-6.3**: `sendToExecution` (`ProgramManagerPanel.tsx:1204`) — regex `/жим/i`, `/тяг/i` для определения лифта. Заменён на `detectLift(name, group)` из `lms-to-pl.ts`.
- Тесты: 5 (program-editor-bugs.test.ts) + 3 (macrocycle.migration.test.ts)

### Связь с ПЛ-авто (что НЕ ломаем)
- MacrocyclePanel в SRCBBScreen — продолжает работать как вкладка
- buildLMSPlan, lms-builder.engine.ts, lms-to-pl.ts, weakpoint-pl.ts, diary-autoreg.engine.ts — не тронуты
- macrocycle.engine.ts — не тронут (только импортируем deserializeMacro для hybrid-ветки)

---

## Support Protocol Audit Fixes (Aug 3 2026)

Full critical analysis of 36 support protocols from AAS-user harm-reduction perspective. All P0/P1/P2 fixes completed.

### P0 — Critical fixes
1. **Zinc Immune Phase 3** — 75-100 → 50 мг/сут (cross-module limit with NAC)
2. **NAC cross-module limit** — added `CrossModuleLimitBanner` UI component (≤4000 мг/сут)
3. **E2 target** — 20-40 пг/мл prominently added across all phases in `supportProtocolE2.tsx`
4. **Cabergoline warnings** — impulse control warning added in `supportProtocolProlactin.tsx` (Phases 2/3/4)
5. **GH Phase 3 insulin** — endocrinologist-only banner in `supportProtocolGH.tsx`
6. **Nebivolol max** — 5→20 мг in `support-dosing.ts`
7. **Potassium max** — 600→2000 мг in `support-dosing.ts`
8. **Eplerenone max** — 100→50 мг in `supportProtocolElectrolytes.tsx`
9. **PostCycle monitoring** — Free T + SHBG added in `supportProtocolPostCycle.tsx`

### P1 — Important fixes
10. **`support-dosing.ts` interface** — added `phaseDosing` field for phase-dependent dosing
11. **`getProtocolDose()`** — now respects `protocolPhase` parameter
12. **TUDCA** — split into qd 250-500 мг (base) / bid 500-1000 мг (Phase 3) / contraindicated (Phase 4)
13. **Berberine** — max 2000→1500 мг/день, frequency `bid_before_meals`
14. **Metformin** — max 2550 мг (FDA limit)
15. **DIM** — base 100-600 мг qd; PhaseDosing for E2_Phase2/3: 200-600 мг bid
16. **Calcium D-Glucarate** — base 500-2000 мг qd (was 1000-2000 bid)
17. **Niacin evidence** — B→C (AIM-HIGH/HPS2-THRIVE no CV benefit)
18. **Atorvastatin/Rosuvastatin timing** — `evening`→`any` (long half-life)
19. **Melatonin** — 0.3-3→1-5 мг (Phase 3 option 10 mg in warnings)
20. **DRUG_THRESHOLDS_V7** — verified all 17 support keys already mapped (telmi, nebivolol, ezetimibe, caberg, etc.)

### P2 — Quality fixes
21. **Cilantro warning** — strengthened in `supportProtocolDetox.tsx`: "КРИТИЧЕСКИ: НЕТ доказательной базы. Может ПЕРЕРАСПРЕДЕЛЯТЬ Hg в ЦНС. При ртутной интоксикации — КАТЕГОРИЧЕСКИ ПРОТИВОПОКАЗАНО"
22. **BPC-157/TB-500 safety** — added reconstitution/sterility warnings in `supportProtocolJoints.tsx`: bacteriostatic water only, sterile needles/syringes, sepsis/abscess risk

### Files modified
- `src/data/support-dosing.ts` — phaseDosing, dose limits, evidence levels
- `src/ui/screens/SupportScreen_parts/supportProtocolsShared.tsx` — `CrossModuleLimitBanner`
- `src/ui/screens/SupportScreen_parts/supportProtocolImmune.tsx` — Zinc dose, NAC banner
- `src/ui/screens/SupportScreen_parts/supportProtocolE2.tsx` — E2 target 20-40 пг/мл
- `src/ui/screens/SupportScreen_parts/supportProtocolProlactin.tsx` — Cabergoline warning
- `src/ui/screens/SupportScreen_parts/supportProtocolGH.tsx` — Insulin banner
- `src/ui/screens/SupportScreen_parts/supportProtocolPostCycle.tsx` — Free T + SHBG
- `src/ui/screens/SupportScreen_parts/supportProtocolElectrolytes.tsx` — Eplerenone max
- `src/ui/screens/SupportScreen_parts/supportProtocolDetox.tsx` — Cilantro warning
- `src/ui/screens/SupportScreen_parts/supportProtocolJoints.tsx` — BPC-157/TB-500 safety
- `src/engines/risk-engine-v7-matrix.ts` — verified 17 support keys present

### Tests
- Vitest: **857 tests passing** (all support protocol changes verified)

---

## Nutrition Planner + Product Usefulness Audit Fixes (Aug 3 2026)

Full critical analysis of the Nutrition Planner (IndividualPlan) and the Product Usefulness engine (V1 + V2). All P0/P1/P2 fixes completed and verified.

### P0 — Critical bugs
1. **`weeklyAvgLoss` double-division** — `planner-targets.ts:103` computed weekly average weight loss as `actualLoss / (n-1) * 7 / (n-1)`, dividing by `(n-1)` TWICE. This understated the real loss rate by a factor of `(n-1)`, causing the weight-adaptation kcal correction to fire too late or not at all during genuine weight loss. Fixed: `weeklyAvgLoss = (actualLoss / intervals) * 7` (single division on `intervals = max(1, n-1)`).
2. **Leucine estimate 42 → 75 mg/g protein** — `product-usefulness-v2.engine.ts:675` used `f.protein * 42` as the fallback leucine estimate when `amino_acid_profile_100g.leucine_mg` was missing. Real leucine content of common proteins is 65-85 mg/g (whey ~81, egg ~85, casein ~77, chicken ~77, rice ~81, soy ~80, tofu ~65). The 42 constant understated leucine by ~45%, producing false "mTOR not triggered" warnings for high-protein meals. Fixed: `f.protein * 75` (median of animal+plant sources, conservative lower bound).
3. **`cortisolRisk` summed ALL meals** — `product-usefulness-v2.engine.ts:691` computed `sumF(f => f.carbs * (f.gi > 60 ? 1 : 0))` across ALL meals in `analyzeDailyDiet`, then compared against the post-workout threshold `weightKg * 0.5`. Since `sumF` iterates the entire day's products, the condition evaluated the day's total fast-carb load against a per-meal threshold — producing false negatives whenever any non-post-workout meal contained carbs. Fixed: now evaluates ONLY `postMeal.products` via a targeted reduce that sums `(f.carbs * weightGrams/100)` for foods with `gi > 60`.

### P1 — Important fixes
4. **DIAAS contribution 1.5 → 3.0** — `product-usefulness-v2.engine.ts:606` scored `DIAAS ≥ 1.0` as `+1.5` and `DIAAS < 0.75` as `-2.0`. A single phase/pharma modifier often applied `-4 to -5`, easily overriding the DIAAS signal. DIAAS is the FAO/WHO gold standard for protein quality and should meaningfully boost the overall score. Fixed: `+3.0` for complete protein, `-2.5` for incomplete, `0` for intermediate.
5. **PRAL warning threshold 10 → 100 mEq** — `product-usefulness-v2.engine.ts:714` triggered `'Закисление'` when `pralTotal > 10`. PRAL (Remer & Manz) for a high-protein bodybuilding diet typically sums to 150-400 mEq/day across 5 meals (protein foods carry +5..+15 mEq/100g). A 10 mEq threshold flagged virtually every high-protein plan as "закисление", making the warning noise. Fixed: threshold raised to 100 mEq (lower bound where alkalizing countermeasures are genuinely advisable).
6. **`useEffect` injection dependency** — `IndividualPlanContext.tsx:672` depended on `injections.length`, which missed dose/type changes on an existing injection (same length, different drug). Auto-recalc of protein/kcal on AAS/insulin course edits did not fire when a user changed the drug type or dose without adding/removing an entry. Fixed: dependency changed to `injectionsSignature = injections.map(i => `${i.type}:${i.dose}`).join('|')` so any type or dose change triggers recalculation.

### P2 — Quality fixes
7. **`DIGEST` missing categories** — `product-usefulness-v2.engine.ts:572-576` only covered `protein/dairy/egg/fish/grain/legume/nut/vegetable/fruit/other`. Categories `veg_fruit`, `carb`, `fat`, `supplement`, `fast_food` fell through to the `0.85` default, which overstated DIAAS for raw veg (real 0.5-0.7) and understated it for refined fats (real 0.95+). Fixed: added `veg_fruit: 0.78`, `carb: 0.88`, `fat: 0.95`, `supplement: 0.95`, `fast_food: 0.85` sourced from FAO/WHO 2013 digestibility tables.
8. **`calcMealQuality` side effect** — `nutrition-quality.engine.ts:102-108` called `saveNutritionV2Data(...)` inside a pure scoring function, writing to `localStorage` on every invocation. This made the function non-idempotent (test runs mutated shared state) and violated function purity. Fixed: removed the `saveNutritionV2Data` side effect; callers that want to persist the quality score should do so explicitly.

### Files modified
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-targets.ts` — weeklyAvgLoss single-division fix
- `src/engines/product-usefulness-v2.engine.ts` — leucine 75, cortisolRisk post-workout-only, DIAAS 3.0, PRAL 100, DIGEST categories
- `src/engines/nutrition-quality.engine.ts` — removed saveNutritionV2Data side effect
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — injectionsSignature useEffect dependency

### Tests
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/__tests__/planner-audit-fixes.test.ts` — **31 new tests**: P0-1 weeklyAvgLoss (4 tests), P0-2 leucine (2 tests), P0-3 cortisolRisk (4 tests), P1-4 DIAAS (3 tests), P1-5 PRAL (3 tests), P2-7 DIGEST (3 tests), P2-8 calcMealQuality purity (3 tests), P0-16 Urea/Cr GFR check (3 tests), P0-13 bb_quality_score recalc (2 tests), P1-7 Array.isArray migration (2 tests), P1-6 role removal order (2 tests).
- Full suite: **952 tests passing** (120 test files), 0 TS errors, vite build OK.

### Round 2 — additional audit fixes (Aug 3 2026)

After re-reviewing the original analysis, 6 additional bugs were identified and fixed:

9. **Urea/Creatinine protein penalty without GFR check** — `product-usefulness-v2.engine.ts:284` penalized ALL protein foods by -3.5 when urea > 8.5 or creatinine > 115, regardless of GFR. Elevated creatinine is normal in bodybuilding (high-protein diet, creatine supplementation, GFR > 60), but the penalty fired unconditionally. Fixed: protein penalty now requires `L.gfr < 60` (real renal impairment); the alkalinizing bonus (pral < -3) remains unconditional.
10. **`bb_quality_score` frozen at load time** — `product-usefulness-v2.engine.ts:417` used `product.bb_quality_score ?? calcBBQualityScore(product)`, which kept a potentially stale pre-computed value. If metabolic_flags or other inputs changed after FOOD_DB load, the score would not update. Fixed: always recalculate via `calcBBQualityScore(product)`, falling back to stored value only if calc returns 0.
11. **`profileTargets` duplicate TDEE calculation** — `IndividualPlanContext.tsx:361-373` computed a second TDEE via legacy `calcNutrition` (ignoring phase/course/weight-adapt), diverging from `calcTargets` which uses `computePlannerTargets`. The "profile" KBJU mode showed different numbers than "auto" mode for the same profile. Fixed: `profileTargets` now uses `computePlannerTargets` with neutral settings (maintenance phase, no injections, no adaptations). Removed unused `calcNutrition` and `calcNutritionV2` imports.
12. **Migration missing `Array.isArray` check** — `planner-storage.ts:85` only checked `typeof parsed !== 'object'`, which let plain objects `{}` pass through for keys that should be arrays. A stored `{foo: 'bar'}` for `he_excluded_foods` (expected array) would crash downstream `.filter/.map` calls. Fixed: added `arrayKeys` set and `!Array.isArray(parsed)` check for keys that must be arrays.
13. **`mealsCount` role removal order** — `meal-plan-engine.ts:1127` removed roles in order `['intra','snack','preSleep','prew']`, dropping intra first. For a 7-meal training day (8 roles: core3 + prew + postw + preSleep + intra + snack2), intra was lost while snack2 (less important) stayed. Fixed: order changed to `['snack2','intra','snack','preSleep','prew']` so snack2 is dropped first, preserving intra for long sessions.
14. **`isMeatId` hardcoded 200+ keywords** — `meal-plan-engine.ts:176` relied on a 200+ string keyword array to identify meat/fish foods, which is fragile and can't adapt to new products. Fixed: `isMeatId` now checks `FOOD_ALLERGEN_DIET` first (canonical source with `isVegetarian` flag), falling back to the keyword heuristic only for unlabeled foods.

### Files modified (round 2)
- `src/engines/product-usefulness-v2.engine.ts` — Urea/Cr GFR check (P0-16), bb_quality_score always recalc (P0-13)
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — profileTargets via computePlannerTargets (P1-23), removed unused imports
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-storage.ts` — Array.isArray check for array keys (P1-7)
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine.ts` — role removal order snack2→intra (P1-6), isMeatId via FOOD_ALLERGEN_DIET (P2-10)

### Identified but deferred (non-blocking)
- God-Component `IndividualPlanContext.tsx` (2084 lines, 120+ useState) — split into sub-contexts (future refactor).
- Classic `buildDay` path (~500 lines in context) duplicates V2 engine — remove after confirming V2 stability.
- Module-level mutable state `_pickCtx` in `meal-plan-engine.ts` — pass via parameters (future refactor for concurrent safety).
- No dedicated tests for `product-usefulness.engine.ts` (V1) — V2 is covered now.

---

## Manual Program Constructor Audit Fixes (Aug 3 2026)

Critical analysis of the manual program constructor (ручной планировщик) in the training block. All real bugs fixed; analysis items that turned out to be intended behavior were cancelled.

### P0 — Critical fixes
1. **Periodization Designer overlap detection** — `addBlockToDesign` and `moveBlockInDesign` now mark overlapping blocks in `notes` via new `checkBlockOverlap()` helper. `getDesignStats()` returns `overlapWeeks` count and `gapRanges` array. UI shows red warning banner when overlaps or gaps exist.
   - `periodization-designer.engine.ts`: added `checkBlockOverlap()`, overlap marking in `addBlockToDesign`/`moveBlockInDesign`, gap/overlap detection in `getDesignStats()`.
   - `PeriodizationDesignerTab.tsx`: warning banner after phase distribution overview.

### P1 — Important fixes
2. **`handleResize` slider overflow** — slider `max` was hardcoded to 12, allowing `endWeek` to exceed `totalWeeks`. Fixed: `max={Math.min(12, current!.totalWeeks - editBlock.startWeek + 1)}`. Engine `resizeBlockInDesign` already clamped, but UI now prevents the invalid state.
3. **`sendToExecution` PL accessory fallback** — `wmVal` returned `wm.squat` for accessory exercises (null lift from `detectLift`), producing absurd weights (e.g., 98 kg for triceps work at 70% of squat 1RM). Fixed: returns `0` for accessory (consistent with `PLSetEditor.calcW` which returns `null` for accessory). Users enter accessory weights manually.

### P2 — Quality fixes
4. **PDF title XSS** — `program.meta.title` was not HTML-escaped in `printProgram()`, unlike `notes`. A program named `<script>alert(1)</script>` would execute on print. Fixed: added `const safeTitle = (program.meta.title || '').replace(/</g, '&lt;')` used in both `<title>` and `<h1>`.
5. **Touch DnD scroll interference** — long-press timer (350ms) was not cancelled when user scrolled vertically/horizontally >10px, causing accidental drag activation during scroll. Fixed: `onTouchMove` now tracks `touchStartPosRef` and cancels `longPressTimer` if movement exceeds 10px threshold before arming.

### Cancelled (analysis was incorrect)
- **P1-4 floating point progression** — the `Math.round(weight * progression / 2.5) * 2.5` formula is intentional rounding to nearest 2.5 kg (plate step), not a bug. The "0.6 kg error" in the analysis is the expected rounding behavior.
- **P1-1 `data: any` in planner-bridge** — deliberate trade-off documented in code comment. 30+ call sites pass fields not in the typed interfaces (e.g., `techniques` in `VolumePayload`, `SRCycleTemplate` in `ProgramPayload`). Changing to discriminated union would require updating 30+ files — refactor, not bugfix.

### Refactoring (structural improvements)
6. **P0-1 Extract ProgramEditor** — ProgramEditor (1443 lines, inline in ProgramManagerPanel.tsx) extracted to `ProgramEditorView.tsx` as a separate, independently-testable component. ProgramManagerPanel reduced from 2454 to 1011 lines.
7. **P0-3 Dispatch table for applyBridgePayload** — 155-line if/else chain (14 kinds) replaced with dispatch table in `planner-bridge-handlers.ts`. Each `PlannerApplyKind` has its own handler function; adding a new kind requires no modification of existing handlers.
8. **P0-4 Per-direction autoFillDraft** — 143-line `autoFillDraft` (3 direction branches: BB/PL/Hybrid) extracted to `auto-fill-draft.ts` with 3 standalone functions: `autoFillBBDraft`, `autoFillPLDraft`, `autoFillHybridDraft`. Each is independently testable.

### Files modified
- `src/engines/periodization-designer.engine.ts` — `checkBlockOverlap()`, overlap marking, gap/overlap stats
- `src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx` — slider max fix, warning banner
- `src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx` — PDF XSS fix, PL accessory fallback fix
- `src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx` — touch DnD scroll cancellation

### Tests
- `src/engines/__tests__/periodization-designer-overlap.test.ts` — 10 new tests: overlap detection (add/move), gap reporting, gap consolidation, resize clamping.
- Full suite: **962 tests passing** (121 test files), 0 TS errors, vite build OK.

---

## Architecture

### BB engine files
| File | Role |
|------|------|
| `bb-builder.engine.ts` | Main BB plan generator |
| `bb-split-patterns.ts` | 16 split definitions |
| `bb-day-types.ts` | Day character, TAG_MUSCLES, ROTATION_PAIRS |
| `bb-tempo-rest.ts` | Tempo/rest specs |
| `bb-autocoach.engine.ts` | Post-phase processing, feeders, deload protocols |
| `bb-metrics.engine.ts` | Plan metrics (heavy%, pump%, MRV checks) |
| `bb-goal-types.ts` | BBTrainingFocus + evidence RIR/reps tables |
| `bb-ped-adaptation.engine.ts` | PED MRV boost |
| `bb-session-order.engine.ts` | Exercise ordering by layer |
| `bb-weakpoint.ts` | Weak-point diagnostics |
| `bb-progression-feedback.engine.ts` | sRPE feedback loop |
| `cycle-to-plan.ts` | Cycle template → BB plan converter |

### ПЛ-авто engine files
| File | Role |
|------|------|
| `lms/macrocycle.engine.ts` | Годовое планирование (5 фаз, СРЦ-циклы) |
| `lms/lms-selector.engine.ts` | Скоринг-подбор СРЦ-цикла |
| `lms/lms-builder.engine.ts` | Генерация плана из шаблона недели 1 + PM-прогрессия |
| `lms/lms-progression.engine.ts` | PM_нед = PM0×(1+k)^нед |
| `lms/weakpoint-pl.ts` | Диагностика слабых точек СРЦ-движений |
| `pro/autoregulation-pro.engine.ts` | Проф-авторегуляция (readiness+HRV+ACWR) |
| `pro/diary-autoreg.engine.ts` | Per-exercise авторегуляция из дневника |
| `lms/lms-progression-feedback.engine.ts` | sRPE feedback loop (дневник → план) |

### SPLIT_PATTERNS (16)
- 3 fullbody variants (2×/3×/4× per week)
- 3 upper/lower variants (3×/4× per week + PHUL)
- PPL 6×, Arnold 6×, Bro 5×, PRO 8-day
- 3 rolling patterns (3/1/3/1, 4/1, ТПТ-О-ТТП)
- Push/Pull 4×, Torso/Limb 4×, Glute Focus 4×

---

## Support Calculator Audit Fixes (Aug 3 2026)

Full critical analysis of the support calculator (`калькулятор поддержки`) — dosing engine, protocol generation, and UI state management. 7 bugs fixed (1 P0, 3 P1, 3 P2), 42 new tests added.

### P0 — Critical fixes
1. **Vitamin D3 toxic dose (20× UL)** — `engine-helpers.ts:650` passed `2000` (interpreted as mcg) to `normalizeDoseByWeight`, then `doseStr` multiplied by 40 (mcg→IU) → 80,000 IU at 70kg. UL = 4,000 IU (100 mcg). Fixed: base dose changed to `50` mcg (= 2,000 IU at reference weight). Additionally added a universal UL-cap loop in `applyTitration` that clamps all substances to their `NUTRIENT_UL` values after weight normalization — protects magnesium, NAC, zinc, selenium, vitamin C, ALA at extreme body weights (200kg+).

### P1 — Important fixes
2. **`classifyPed` missing `'eq'` ID** — `ped-potency-table.ts:152` used `k.includes('eq'+'_')` which produced `'eq_'`, but the common boldenone abbreviation `'eq'` doesn't contain `'eq_'`. The ID `'eq'` fell through to `'other'` → `derivePEDFlags().hasBold = false` → boldenone protocol (cabergoline, hesperidin, serrapeptase) never activated. Fixed: `k === 'eq' || k.startsWith('eq_')`.
3. **Dead `'anastro'`/`'caberg'` checks in `applyTitration`** — `engine-helpers.ts:636,641` checked `s === 'anastro'` and `s === 'caberg'` — no substance in the system has these IDs. Replaced with `substances.includes('anastrozole')` / `substances.includes('cabergoline')` for clarity.
4. **10 missing substance defaults in `generateSchedule`** — `computeProtocol` in `tz-mapper-engine.ts` adds tadalafil, agmatine, pycnogenol, astaxanthin, hesperidin, dandelion, serrapeptase, garlic, metformin, chromium — but `doseStr` defs didn't have entries → displayed "по инструкции" instead of actual doses. Fixed: added all 10 to `defs`, `SUB_NAMES`, morning/afternoon/evening groups, and `chromium` to the mcg-unit list.

### P2 — Quality fixes
5. **Dual `CalcView` type definitions** — `SupportScreen.tsx:61` defined a local `CalcView` without `'mixcalc'`, while `SupportShared.tsx:13` exported it with `'mixcalc'`. Child components calling `setCalcView('mixcalc')` worked only due to `any` typing in the state bag. Fixed: added `'mixcalc'` to the local type.
6. **Dead code removal (~40 lines)** — Removed orphan state variables `stackCalcSize`, `stackCalcOrgans`, `stackCalcMech`, `stackCalcMode`, `generatedStack`, `generatedStacks` and the `availableMechs` useMemo from `SupportScreen.tsx` — none were read by any child component. Removed `useCalculatorState` hook (never imported/called by any component) and deleted `Calc.state.ts`. Removed unused `ORGAN_MECHANISMS` import. Cleaned barrel export in `Calculator/index.ts`.
7. **`getMinDose`/`getMaxDose` unused `unit` parameter** — `support-dosing.ts:663,668` accepted a `unit` parameter but never used it. Fixed: removed the dead parameter.

### Files modified
- `src/engines/support-plan/engine-helpers.ts` — D3 dose fix, UL-cap loop, dead check removal, new substance defaults/names/groups
- `src/data/ped-potency-table.ts` — `eq` classification fix
- `src/data/support-dosing.ts` — `getMinDose`/`getMaxDose` signature cleanup
- `src/ui/screens/SupportScreen.tsx` — CalcView type, dead code removal, unused import cleanup
- `src/ui/screens/Calculator/index.ts` — barrel export cleanup
- `src/ui/screens/Calculator/Calc.state.ts` — deleted (dead code)

### Tests
- `src/engines/__tests__/support-calc-audit.test.ts` — **42 new tests**: P0-1 vitamin D3 UL (4 tests), P0-1b UL cap for all substances (6 tests), normalizeDoseByWeight (3 tests), P1 classifyPed boldenone (6 tests), P1 applyTitration anastrozole/cabergoline guardrail-aware (4 tests), P1 generateSchedule new substances (13 tests), P2 getMinDose/getMaxDose (5 tests), P2 CalcView type (1 test).
- Full suite: **1041 tests passing** (125 test files), 0 TS errors, vite build OK.

---

## Profile System v2 — Final Critical Audit (Aug 5 2026)

Финальный критический аудит после основного раунда рефакторинга.

### Критические баги найдены и исправлены

1. **IndividualPlanContext — useState читал мёртвые ключи** после миграции.
   he_surplus_pct, he_bb_category, he_peak_week, he_life_stage, he_diet_preferences, he_evening_low_carb, he_kbju_mode, he_manual_g_per_kg, he_specificity, he_variety_strictness, he_intolerances, he_taste_profile, he_excluded_categories, he_preferred_by_meal, he_manual_kcal/p/f/c, he_excluded_foods, he_preferred_foods, he_locked_foods — все удаляются при миграции, но useState(() => localStorage.getItem(...)) читал 
ull → default. Реальные значения лежат в UnifiedSettings. **Пользователь вводил 15% surplus, после миграции видел 10%.**

   **Фикс:** 17 useState теперь читают через Proxy из profile.settings (UnifiedSettings) с fallback на legacy localStorage если профиль пустой.

2. **IndividualPlanContext — 17 useEffect писали в мёртвые ключи** на каждом изменении.
   После миграции эти useEffect записывали данные в удалённые ключи → данные терялись при следующей миграции/сессии.

   **Фикс:** заменены на updateSection('nutrition' | 'goals', { ... }) (UnifiedSettings).

3. **useProfileSection создавал новый объект snapshot** на каждом рендере.
   useSyncExternalStore сравнивает через Object.is → лишние ререндеры всех consumers.

   **Фикс:** кэширование snapshot через useRef с инвалидацией по sectionVersions.

4. **updateProfile/updateSection не обрабатывали QuotaExceededError**.
   При переполнении localStorage (~5-10MB) silent failure → пользователь терял данные.

   **Фикс:** обработка QuotaExceededError → автоматическая очистка snapshots и повторная попытка.

5. **undoLastSnapshot инкрементировал ВСЕ sectionVersions** → ререндер всех consumers, даже если изменение касалось только одной секции.

   **Фикс:** сравнение prev/next по JSON.stringify и инкремент только реально изменённых.

6. **IndividualPlanContext.toggleAllergen/toggleHealthIssue** писали в he_food_allergens и saveContraindications — оба мёртвые после миграции. Аллергены пользователя терялись!

   **Фикс:** updateSection('nutrition', { foodAllergies }) + legacy fallback.

7. **mёртвый код в useDataLink** — db.put('profile', ...) записывал в IndexedDB, но никто не читал. Удалён.

8. **mёртвый импорт TrainingProfileCard** в TrainingScreen.tsx (не использовался). Удалён.

9. **Hero не показывал CTA "Заполните профиль"** при completeness < 50%. Добавлено с цветовой индикацией.

10. **ProfileUserTab** — 6 секций в одной вкладке создавали длинный скролл. Добавлен sticky quick-jump + id на каждую секцию + scrollMarginTop для scrollIntoView.

11. **AccordionSection.defaultOpen = true** для всех 6 секций → страница перегружена. Изменено на alse (кроме первой UserPersonalSection).

### Производительность

- useProfileSection использует кэш для snapshot → устранены лишние ререндеры.
- useSyncExternalStore теперь возвращает стабильную ссылку между обновлениями.

### UX улучшения

- **Hero CTA** при completeness < 50% / 50-80% / ≥ 80%
- **Sticky quick-jump** в ProfileUserTab для быстрой навигации по 6 секциям
- **Smooth scroll** через scrollIntoView({ behavior: 'smooth' })
- **scrollMarginTop: 70px** — секции не скрываются под sticky quick-jump

### Финальные результаты

- 	sc --noEmit: 0 ошибок
- itest run: **1518/1518** passing (было 1478, **+40 тестов**)
- ite build: OK
- Файлов изменено/создано в финальном аудите: **6**
  - src/core/profile-manager.ts (useProfileSection кэш, QuotaExceededError)
  - src/core/profile-events.ts (getProfileVersion fix)
  - src/core/data-link.ts (удалён мёртвый db.put)
  - src/ui/screens/ProfileScreen_v2/ProfileHero.tsx (CTA при низкой completeness)
  - src/ui/screens/ProfileScreen_v2/ProfileUserTab.tsx (sticky quick-jump)
  - src/ui/screens/ProfileScreen_v2/sections/*.tsx (id секций, defaultOpen только для первой)
  - src/ui/screens/ProfileScreen_v2/ui.tsx (id + scrollMarginTop в AccordionSection)
  - src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx (17 useState + 17 useEffect мигрированы на UnifiedSettings)
  - src/ui/screens/TrainingScreen_parts/training-profile.ts (saveTrainingProfile через updateProfile)
  - src/ui/screens/TrainingScreen.tsx (удалён мёртвый импорт)
  - src/ui/screens/SRCBBScreen_parts/PeakingPanel.tsx (защита от default-80 перезаписи)

---

## Дневники профиля — полный аудит (Aug 15 2026, pushed)

### Найденные и исправленные баги
- **P0-кластер WeightDiary — рассинхрон порядка записей**: `getWeightLog()` возвращает ASC, `commit()` пересортировывал в DESC → при каждом открытии «Текущий вес», Δ30/90, BMI, фото «До/После», TrendSpark и график считались от СТАРЫХ записей, а «💾 В профиль» перезаписывал `personal.weight` устаревшим весом. Фикс: загрузка сортируется DESC (`WeightDiary.tsx`), миграция legacy вызывается ДО чтения, `commit` нормализует записи (NaN не попадают в state), `WeightChart` сортирует точки по дате (защита от любого порядка).
- **P1 HealthDiary — смена даты при редактировании**: `saveEdit` обновлял запись по СТАРОЙ дате → дубликаты дат/потеря записи. Фикс: перенос записи с удалением старой даты, инвариант «одна запись на дату» сохранён; пустая дата → сегодня явно.
- **P1 health-diary.engine — порядок и кап**: `saveUnifiedHealthEntries` принимал ASC от quick-add путей → `healthEntries[0]` показывал СТАРУЮ запись; кап `slice(-365)` выбрасывал НОВЫЕ записи при DESC-входе. Фикс: единый DESC в `save`/`get`, кап оставляет новейшие 365.
- **P1 ProfileDiariesTab — «Сбросить всё» не очищал здоровье и вес**: unified-дневник (`he_health_diary`) и лог веса (`he_weight_log`) не входили ни в сброс, ни в undo. Фикс: добавлены оба + восстановление.
- **P2 BPDiary — поиск искажал статистику**: `recentRows`/`points`/`anomalies` строились из `visible` (с query-фильтром) → любые цифры в поиске пересчитывали карточки и график. Фикс: статистика только от диапазона; загрузка через `sortEntriesByTimestamp` (алерты читают реально последнюю запись).
- **P2 UTC-баг группировки недель**: `start.toISOString().slice(0,10)` давал ключ воскресенья для понедельничных записей в UTC+3…+12. Фикс: `toLocalIso` (экспортирован из diary-helpers) в `buildWeeklyHistogram`, `groupEntriesByPeriod`, `WeeklyHistogramImproved`.
- **P2 HealthDiary мелочи**: `planCtx` пересчитывается при изменении записей (был stale на mount); `saveHealthPlan` вынесен из апдейтера `setPlan`; `entryFields` защищён от отсутствия `symptoms`.
- **P2 ProfileDiariesTab**: «Сон» в сводке «Сегодня» брался как последний элемент (порядок плавал) → сортировка по дате; health в quick-add/импорте сортируется DESC.
- **P3 weight CSV**: `csvEscape` — защита от формульной инъекции Excel (префикс `'` для `= + - @`).

### Тесты
- NEW `src/engines/__tests__/diary-bugs-audit-2026-08.test.ts` — 12 тестов (порядок DESC, кап 365 новейших, локальные недели, csvEscape).
- NEW `src/ui/screens/ProfileScreen_v2/__tests__/profile-diaries-tab-reset.test.tsx` — 2 теста (сброс + undo включают здоровье и вес).
- Итог: tsc 0; **5067/5067** (300 файлов, +46 к базовой); `vite build` OK.
- Файлы других агентов не тронуты (`docs/MACROCYCLE-ROADMAP.md`, `docs/CARDIO-CYCLE-INTEGRATION-PLAN.md` — чужой WIP, не коммитились).

### План доработок (следующий раунд)
1. **Сон**: персистентный черновик инлайн-формы SleepDiary (как в quick-add), CSV-формул-защита.
2. **АД**: черновик инлайн-модалки BPDiary в sessionStorage; множественные замеры за день — «день = серия» (сейчас просто список).
3. **Вес**: «Сбросить фото» отдельной кнопкой (photos раздувают localStorage); импорт фото; объединение архивных записей с основным логом для графиков.
4. **Инъекции**: расписание — пропущенные дни подсвечиваются в зонах; рекомендация объёма по зоне в редакторе (сейчас только warning).
5. **Здоровье**: quick-add «+ Добавить» должен МЕРЖИТЬСЯ с существующей записью дня (сейчас заменяет — теряются данные с 3D-карты); общая сводка по 5 подразделам в карточке дневника.
6. **Профиль в целом**: единый `diary-storage.ts` (все ключи/нормализация в одном месте вместо 3 копий loadDiary); утренний рутинг — добавить здоровье; экспорт в PDF по всем дневникам одним файлом; наблюдение за quota (фото) с автоочисткой старых фото.

---

## Дневники профиля — доработки по плану (Aug 16 2026, pushed)

Выполнен план из предыдущего раунда + расширенный рутинг (утро/вечер). **ЧСС ведётся ВНУТРИ записей АД (поле «Пульс»)** — отдельный ЧСС-дневник изначально был сделан и по требованию ПЕРЕРАБОТАН: файлы удалены, функционал перенесён в АД.

### Новое
- **💓 ЧСС в АД**: `getPulseDaypartAverages(entries, days)` / `getPulseTrend(entries)` в `bp-hr-data.ts` (утро/вечер средние за 7/30д, тренд утреннего пульса, тахи/бради-подсказки) + секция «💓 ЧСС (утро/вечер, поле „Пульс")» в статистике BPDiary; сводка «Сегодня» показывает «ЧСС утро/вечер» из записей АД (timeOfDay). Отдельные `hr-diary.engine.ts` / `AddPulseModal` / `PulseDiary` / ключ `he_hr_diary` — УДАЛЕНЫ.
- **🔄 Рутинг v2**: `ROUTINE_STEPS` morning = [сон, АД (с ЧСС), вес, здоровье] (4 шага), evening = [АД (с ЧСС)] (1 шаг); `routineNextStep`/`migrateLegacyRoutine` (legacy sessionStorage 'sleep'|'bp'|'weight' → morning); две кнопки запуска («🌅 Утренний лог: сон → АД (с ЧСС) → вес → здоровье», «🌆 Вечерний лог: АД (с ЧСС)»); баннер с прогрессом N/total, «✍ Заполнить», «⏭ Пропустить», ✕; сохранение шага автоматически открывает следующий; undo-лейблы «🌅/🌆 Утренний/Вечерний лог · …»; AddBPModal — проп `presetTimeOfDay` (вечерний рутинг пишет АД с timeOfDay=evening). **Фикс двойного advance**: переход шага ТОЛЬКО в onSave (onClose больше не продвигает).
- **🩺 МЕРЖ quick-add здоровья**: `mergeHealthEntry(existing, incoming)` в health-diary.engine (zones объединяются с пересчётом totalScore, симптомы дедуплицируются по имени, neuro/acne/hemato перезаписываются только если заполнены, notes конкатенация) — боль с 3D-карты больше не затирается добавлением нейро. Сводка по 5 подразделам в карточке «Здоровье» (🦴/🩺/🧠/🔴/🩸).
- **🗄 Единый слой хранилища** `diary-storage.ts`: `readDiaryEntries`/`saveDiaryEntries` (кап N новейших по дате, устойчив к ASC/DESC входу, quota-fallback 90), `readJSONSafe`, `capEntriesByDate`, `diaryStorageBytes`. Подключён в ProfileDiariesTab и diary-modals (реэкспорт readDiaryEntries — обратная совместимость).
- **💤 SleepDiary**: персистентный черновик инлайн-формы (`he_draft_sleep_inline` через useDiaryDraft; при редактировании существующей записи черновик сбрасывается); CSV-формул-защита (префикс `'`).
- **❤️ BPDiary**: черновик инлайн-модалки (`he_draft_bp_inline`); таблица «день = серия» — замеры одного дня группируются (rowSpan + бейдж «N замера»).
- **⚖️ WeightDiary**: «🖼 Сбросить фото» и «📥 Фото из архива» в меню; архивные записи включены в графики/тренды при «Всё время»; commit обновляет архив; `profile-store.saveWeightLog` — автоочистка фото из старых записей при >4MB (новейшие 30 сохраняют фото).
- **💉 InjectionDiary**: карта зон подсвечивает зоны с пропущенными по расписанию инъекциями (⏭, dashed-рамка, легенда); InjectionEditor показывает макс. объём/иглу/угол зоны с предупреждением при превышении.
- **🖨 PDF всех дневников**: кнопка «🖨 Экспорт всех дневников (PDF)» — window.open + таблицы (сон/АД с ЧСС/вес/инъекции/здоровье) → print; HTML-экранирование.

### Тесты
- NEW `diary-storage.test.ts` — 7 (чтение/fallback, кап новейших ASC/DESC, capEntriesByDate, размер).
- NEW `profile-routine-merge.test.tsx` — 12 (шаги утро/вечер с ЧСС в АД, миграция legacy, mergeHealthEntry 4 кейса, вечерний рутинг e2e: АД с timeOfDay=evening и hr>0, утренний рутинг 4 шага до конца).
- MOD `bp-hr-data.test.ts` — +4 (ЧСС утро/вечер средние, игнор пульса 0, тренд down, <2 записей → null); MOD `profile-diaries-tab-reset.test.tsx` (без he_hr_diary).
- Итог: мои файлы tsc 0; полный прогон **5196/5197** (1 чужой WIP-фейл `bb-macrocycle.test.ts` — формат сериализации v7 меняет другой агент, не связан с моей работой; `profile-diaries-e2e` флейк параллельного прогона — изолированно 6/6); `vite build` OK.
- Чужой незакоммиченный WIP не тронут (lms-cardio/taper/competition, BbAutoConstructor, TrainingScreen, IndividualPlanContext и др.).

---

## Профиль — рабочие максимумы по упражнениям (Aug 16 2026, pushed)

### Что сделано
- **`src/engines/workmax-exercises.ts`** — категории (группы мышц = ключи BB_WM_KEYS: chest/back/quads/hamstrings/glutes/shoulders/biceps/triceps/calves/abs), в каждой **5-7 конкретных упражнений** (по 62 упражнениям всего) из каталога: `WORKMAX_CATEGORIES`, `exerciseToMuscle(id)` (упражнение → мышца), `exerciseNameOf(id)` (каноническое имя из EXERCISE_CATALOG, fallback на встроенные), `exerciseWorkMaxToMuscle(byExercise, prev)` (вес мышцы = МАКСИМУМ среди её упражнений; незаполненные группы сохраняют prev), `countFilledWorkMaxExercises`, `validateWorkMaxCategories`.
- **TrainingPMSection (профиль → Тренировки → 2.2 Личные рекорды)**: вместо «рабочий максимум по группе» — раскрывающиеся категории «нажал на группу → выбрал упражнение → ввёл вес»; счётчик N/M в категории, «🗑 Очистить группу» (удаляет упражнения + производный workMax мышцы). Хранение: `training.workMaxByExercise` (новое поле в UnifiedSettings.training), `training.workMax` по мышцам пересчитывается автоматически — **движки (ББ-авто и др.) продолжают работать без правок** (читают `training.workMax` как раньше).
- Тесты: `workmax-exercises.test.ts` — 10 (категории 5-7/уникальность/имена, exerciseToMuscle, конвертация: максимум/prev/NaN, счётчик); `profile-workmax-exercises.test.tsx` — 4 (рендер категории, ввод веса → workMaxByExercise+workMax.chest, максимум среди упражнений, очистка группы).

### Примечание (важно для будущих раундов)
- **vitest-рантайм отдаёт `EXERCISE_CATALOG` без 16 упражнений** (hip_thrust, ohp, db_press, ohp_seated, lateral_raise, upright_row, plank, hanging_leg, knee_raise, overhead_squat, bench_bands, leg_press_single, hip_thrust_single, kickback_cable, leg_ext_v2, reverse_curl_cable; 544 из 562). В production-бандле (`vite build`) ВСЕ 562 на месте; в node/esbuild-CLI тоже. Причина не найдена (кэши .vite/.vite-temp очищены, mtime обновлён, дублей/синтаксиса нет). **Решение**: `workmax-exercises` НЕ зависит от каталога (имена встроены, маппинг статичен), `catalogName` — только fallback для отображения имён.
- Файлы других агентов не тронуты; `exercise-catalog.ts` не изменялся.

---

## ББ-авто: вынос слоёв buildSession + серый→белый + честный source инструкций (Aug 24 2026)

Финал контрольного списка ББ-авто одним махом: рефактор 3.1 (selection-слои), глобальный серый-текст SRCBBScreen_parts, честные источники инструкций, проверка единого quality.score, локализация паттернов/оборудования.

### 3.1 — вынос selection/volume/loading слоёв из buildSession
- **`buildExercisePool(muscle, role, opts)`** — РЕАЛЬНАЯ реализация вместо заглушки (была `return []`): истинно-мышечный фильтр (trueMuscleOf + roleMuscles) + контекст сессии (push/pull/legs) + fallback-пул + BB-фильтр (overhead/pistol squat) + `_score` (BB-приоритет/наклон/гакк/Смит/односторонние/армейский) + generic-блэклист. **buildSession использует её** (паритет побайтовый).
- **`selectExercisesForMuscle(pool, muscle, count, opts)`** — реальная обёртка над selectExercisesSmart (+ фиксация выбранных id/имён в сессионные списки). Была мёртвая простая версия, никем не используемая. **buildSession использует её**.
- **`computeLoading` (bb-loading-layer.engine)** — parity-фикс: deload reps = midpoint диапазона (как buildSession inline), было shiftedMax.
- Удалён мёртвый `pushDay`/`TAG_LABELS_RU` (не использовались).
- **Тесты**: NEW `bb-selection-layer.test.ts` — **21 тест**: пул (истинная мышца/оборудование/exclude/армейский без allowStrengthLifts/rear-delt только Pull/подтягивания по bodyweightCapability/generic-блэклист/weak снимает фильтр/скор-порядок/fewerCompound/мобильность), выбор (count+мутации/дедуп сессии/favorite), computeMuscleSets (enhanced-минимумы к капу 5/advanced спина/делод/indirect overlap), computeLoading (deload midpoint/**parity с реальным buildBBPlan**: reps/rir/tempo/rest совпадают). Паритет подтверждён: полный прогон bb — **61 падение = ровно HEAD-база** (все пред-существующие, vitest-каталог), мои изменения 0 регрессий.

### Серый → белый текст в SRCBBScreen_parts
- **14 файлов**: AutoregPanel, BBContestPrepCard, MindsetSessionPanels, MobilitySessionPanel, PeakingPanel, PLCompetitionTab, PLPlanView, PLSeasonBuilder, ProMetricsPanel, RecoveryPanel, TaperCoachCard, TrainingPopups, ExerciseSafetyPanel, MacrocyclePanel + SessionPlayer + pl-export.ts — все текстовые `rgba(255,255,255,0.4–0.85)` → `#fff` (консистентно с TrainingScreen_parts, раунд 94f78a578).
- Защищены РАМКИ: MacrocyclePanel:1690 (`border 0.55` в backtick-шаблоне) и 2929 (`border 0.6` в `? '...'`) не тронуты; var()-фоллбеки `--text-dim/--text-light` → `#fff`; canvas `strokeStyle 0.9` (TrainingMetricsChart) не трогался.
- Проверено: SRCBBScreen_parts тесты **140/140** (15 файлов).

### Инструкции — честный source (lab/catalog/generic)
- **Баг**: `getExerciseBio` имеет generic-fallback → `source` был 'exercise-lab' для ВСЕХ 562 (UI врал «лаборатория»).
- **Фикс**: NEW `hasExerciseBioEntry(id)` в exercise-biomechanics-db; `findBio` возвращает `hasLabBio`; `buildExerciseInstructions` даёт 'exercise-lab' ТОЛЬКО при реальной записи/маппинге/целевой мышце, иначе 'catalog' (техника каталога) / 'generic'.
- **Покрытие**: NEW ~230 записей в `exercise-id-mapping.ts` (bio → реальные записи БД): глобально 143→**385/562**; **упражнения реальных ББ-планов 228/228 — 100% exercise-lab** (было 84/228).
- **Тесты**: NEW `bb-instructions-source.test.ts` — 4 (все план-упражнения lab / экзотика kb_tgu → честно 'catalog' / неизвестное → 'generic' / классика → lab).

### Качество — единый score (проверено, уже unified)
- Шаг 5 использует единый `quality.score = clamp(validatePlanQuality.score + analyzeProQuality.scoreDelta)` (мемо FIX-6, BbAutoConstructor:1141), гейдж 3799 на нём; PRO-оверлей — только детализация, не дублирует счёт.

### Английский → русский
- NEW `MOVEMENT_PATTERN_RU` (23 ключа — все значения EXERCISE_CATALOG) + `movementPatternLabel()` в bb-labels.ts; `exerciseComment` показывал сырой `horizontal_push` → RU («🧬 Горизонтальный жим»).
- Своп-модал ББ-плана: `{ex.type} · {ex.equipment}` (сырые 'compound · barbell') → «База/Изо · Штанга/…» через EQUIP_RU; PlanOutput карточка: оборудование → EQUIP_RU.
- TAG_LABELS_RU (дублировал bb-labels, без Glutes/GlutesHams/LegsBiceps) удалён → `sessionTagLabel`.
- Адаптация к закоммиченному чужому полу-ренейму Week→Неделя (не откат!): WeekStrip деструктуризация под `phaseForНеделя/activeНеделя`; PLCompetitionTab record-поля `meetНеделя` (тип CompetitionPlanRecord).
- **Тесты**: bb-labels +3 (движения/покрытие 23/Glutes).

### Проверено
- tsc: **мои файлы 0 ошибок** (оставшиеся ошибки — чужой закоммиченный WIP: Week→Неделя в SRCBBScreen/TrainingScreen/Cardio*/CalcQualityTab — не трогал).
- Затронутые тесты: bb-selection-layer 21/21, bb-instructions-source 4/4, инструкции 14/14, loading-layer D3 6/6, bb-labels 12/12, SRCBBScreen_parts 140/140, bb-auto-smoke 5/5, bb-auto-annual-ctx 5/5.
- Полный bb-прогон: 1411 passed / 61 failed = ровно HEAD-база (пред-существующие, vitest-рантайм каталога).

---

## ББ-авто: жёсткие группы замены (Aug 24 2026, uncommitted)

Требование пользователя: «упражнения, которые меняются ТОЛЬКО между собой в программах — могут стоять в один день все или ротироваться, но обязаны быть». Реализовано для 4 мышц.

### Группы (STRICT_EXERCISE_GROUPS, bb-exercise-selection.engine.ts)
- **Грудь**: `chest_fly` (разводка гантелей/пек-дек/бабочка/сведения — жимы исключены `not: /жим|press|bench/`) + `chest_incline` (жим 30° гантелями/Смит/штанга/тренажёр).
- **Спина**: `back_pulldown` (верхний блок: широкий прямой/V-параллельный/обратный/MAG) + `back_seal` (тяга двух гантелей лёжа на скамье: seal row/с упором грудью) + `back_tbar` (Т-тяга).
- **Бицепс бедра**: `ham_curl` (сгибания лёжа/сидя/стоя/нордик) + `ham_hack` (гакк на бицепс/«колодец» — **в каталоге отсутствует**, группа сработает при появлении) + `ham_rdl` (румынская тяга/мёртвая на прямых).
- **Квадрицепс**: `quad_squat` (присед со штангой/гакк/фронт/Смит/жим ногами) + `quad_ext` (разгибания ног сидя).

### Механика
- **`ensureStrictGroupCoverage`** — pass в buildSession (после multi-angle, перед plans.push): каждая группа, доступная в пуле, обязана быть в exDatas primary-мышцы. Политика, сохранившая ВСЕ инварианты (61 падение = HEAD-база):
  - только ЗАМЕНА, без добавления слотов (weeklySets инвариантны);
  - кандидат — ТОЛЬКО в том же угловом классе (ANGLE_CLASSES), что и заменяемое упражнение — width/thickness и indirect-перекрытия финализатора не сдвигаются;
  - замена не трогает единственного представителя другой обязательной группы и никогда не трогает lead (позиция 0);
  - детерминированный выбор (лучший `_score`) — primary-упражнения стабильны между неделями (включая deload);
  - специализация: покрытие только для целевых мышц недели (не-цели держат MEV);
  - cross-meso continuity (`previousPlan`/mesoProgression) — pass отключён (веса прогрессируют по имени).
- **Своп-модал ББ-плана**: замена предлагает ТОЛЬКО членов жёсткой группы упражнения (`strictGroupMembersOf`), fallback — группа каталога; подсказка «💡 Меняется только внутри своей группы…».
- **Фикс**: `bb-finalize` join комментариев (`Оборудование ротации`/`Safety repair`) — убрана двойная точка (`.replace(/\.\s*$/,'')` перед join).
- **Тесты**: NEW `bb-strict-groups.test.ts` — **14** (состав групп, strictGroupMembersOf: своп только внутри группы, ensureStrictGroupCoverage: same-class замена/lead/onlyRep/недоступные группы, buildBBPlan upper/lower 8 нед: грудь разводка+30° всегда, спина верхний блок + seal/Т-тяга, квадры присед/гакк+разгибания, бицепс бедра сгибания+румынская).
- Проверено: 8 ключевых файлов 134/134 (rotation-mode, specialization-unified/methods, goal-coverage, split-balance, audit-extended, selection-quality, strict-groups), полный bb-прогон 1428/61 = HEAD-база, tsc 0 по своим файлам.
- **Добавлены в EXERCISE_CATALOG (2 упражнения, группа ham_hack заработала)**:
  - `hack_squat_ham` «Гакк-присед на бицепс бедра (стопы высоко)» — machine, hinge, задняя цепь;
  - `well_squat` «Приседания в колодце» — barbell, hinge, глубокая амплитуда/«колодец»;
  - `trueMuscleOf` (movement-pattern): hinge-ветка += `|гакк.*бицепс|hack.*hamstring|колодец` → оба в hamstrings; ANGLE_CLASSES.hamstrings.rdl_bridge += те же маркеры; id-маппинг → bio 'romanian_deadlift' (exercise-lab); ham_hack ids += оба, re сужен до `гакк.*бицепс|hack.*(ham|бицепс)|колодец` (квадрицепсные гакки не захватываются).
  - Итог: bb-strict-groups 15/15, 10 ключевых файлов 147/147, полный bb-прогон 1431 passed / 59 failed = **все падения из baseline-18 (0 новых, 2 пред-существующих даже починились)**, tsc 0 по своим файлам.



## ТА-диагностика — хаб движения PRO (Sep 02 2026, pushed 76054adb)

Полный аудит и доработка ТА-хаба до профессионального уровня по литературе (internet-источники) и parity с PL 9-лифтов. Коммит 76054adb — 9 файлов, 1465++.

- **A1 числовая биомеханика (strength-sport-biomechanics.engine.ts 180с):** NEW TA_BIOMECH 16 WLWeakPoint → angleRangeDeg [0,20]/[60,90] + keyJoint + weakMuscles + biomechanicalReason/loadCues/intensityPct/references (Gourgoulis 2000/2002, Garhammer 1985, Ang 2023). Функции diagnoseTAWeakPoint/isValidAngleForWeakPoint.
- **A2 bar path PRO (strength-sport-barpath.engine.ts 160с):** Vorobyev 3 типа (Type1×2, Type2 backward, Type3×3 Hiskia), метрики xLoop/yMax/vMax, classifyTrajectoryType + computeBarPathMetrics (12Hz Butterworth), diagnoseBarPathFromMetrics SRD 4/6см (Frontiers 2023), correctEnodeHorizontal Intercept+Slope (Chavda 2024 r²0.99), isRealChange.
- **A3 VBT PLOS 2026 + Sandau FvR2 (strength-sport-vbt.engine.ts +70с):** TA_PEAK_VELOCITY_ZONES снач absolute 1.30-1.75 м/с (все >80% >1.3 — Wood 2026 7 derivatives Perch peak), TA_VTHRES_NORMS снач 1.70-2.00, computeFvR2 (80%/110% vmax + hAcc + vThres → v0/F0/Pmax/snatchTh ±1.5кг), thresholdForTALift 10% power/15% тяга/20% сила, vbtRecommendationSS с ТА-порогами.
- **A4 RSS-скоринг (strength-sport-scoring.engine.ts 120с):** scoreTA RSS √Σpen² (weak12/asym14-28/bar10-18/vbt10-20/mob8/imtp15) как arm-diagnostics 146, floors (asym12/loop/VBT20/ISPP<85% → ≤49), verification 0.35 video+0.35 VBT+0.30 mobility.
- **B/C мобильность и видео:** strength-sport-ohs.engine.ts OHS 6 сегментов (FMS/NASM Cook, Rabin sens1.0, PoinT GO knee-to-wall ≥12 cutoff9) + heel-raise 2.5см retest; strength-sport-video.engine.ts parseKinoveaCSV/analyzeBarTracking + ForceProvider/PoseProvider абстракции (Ang loadsol + Kinovea free); strength-sport-diary-integration.engine.ts detectTAWeakFromDiary e1RM 28д.
- **D UX (WLDiagnosticsHub.tsx 268→520с):** 6 табов снач/взятие/толчок/VBT-video/мобильность, числовые углы + биомеханика, bar path метрики + SRD бейдж + Vorobyev тип, VBT пиковые зоны + FvR2 6 полей, OHS 6 чеков + knee-to-wall + heel retest, IMTP/ISPP ≥85% (Essex 81% дисп), Kinovea CSV импорт, RSS gauge + verification, limiter подсказки, applyToPlanner с biomech/fvr/ohs. Сохраняет совместимость: 4 таба теста, deficit_snatch коррекции.
- **Тесты:** NEW 	a-diagnostics-pro.test.ts 23/23 (биомеханика 16, barpath 6, VBT/FvR2, RSS floors, OHS, Kinovea) + strength-sport 412/412 + wl-diagnostics-hub 4/4. Чужая pl-deadpoints 3/26 — предсуществующий дубль заголовка, не тронут.
- **Проверено:** tsc 0 по своим (worktree-времени 5.14с), vitest strength-sport 412, commit строго pathspec, push 76054adb.

### ТА PRO — доведение (ababa434e + e3c3d5f7)
- **Injection** TA: strength-sport-ta-injection.engine.ts 3×5 @intensityPct, per-day dedup, Budget cap, dayMap, technique_day — parity PL, проводка StrengthSportConstructor:234 после inalize, uildStrengthSportPlan weakPoints ×1.15 уже был
- **OHS→профиль:** WLDiagnosticsHub: applyMobilityToProfile пишет he_profile_v2.health+training.mobilityRestrictions → ilterByMobility фильтрация пула
- **VBT builder:** strength-sport-builder:247 isTA 10% / pull 15% / carry 15% (PLOS), hist 10/15//20/25/30
- **Pose/Export:** strength-sport-pose.engine.ts BlazePose stub + strength-sport-wl-export + WLDiagnosticsHub handleExport 🖨 HTML + critical гейтинг score≤49
- **Bar path:** Enode table ENODE_CORRECTION_TABLE + extractBfPCAPatterns Pattern1-3 (Kipp 0.42/-0.38)
- **Diary phase:** candidateTAWeakPointsFromDiary phaseForReps в header
- **Тесты:** 	a-injection 6/6 property 32 combos, strength-sport 421/421

## ПЛ-авто: сезон по микроциклам + циклы между соревнованиями + экран по шагам (Sep 03 2026, ✅ ВЫПОЛНЕН)

Полное выполнение плана `docs/PL-AUTO-MICROCYCLES-PLAN.md` (Sep 02 «любое изменение только по согласию» + Sep 03 дубль/fallback/сводка). Коммиты: cc99f146 (сезон), 8c4111b6 (comp-gap), eab1887c (PLSeasonBuilder+SRCBBScreen), финал (дубль/fallback/сводка+док).

- **Движок сезона** `src/engines/lms/lms-season.engine.ts:63` — `FitResult {exact|proposed_extend|proposed_shrink|strict_skip, needsConsent}` + `fitCycleToWeeks` (explicit недели `sampleIndices` первая+последняя, week1 `correctionPctEff` кап 2×) + `applyFitConsent` → `strict_skip` без согласия; `candidateCyclesForSlot` (endurance/strength/peak через `rankCycles`, speed через `SPEED_CYCLE_IDS` + **fallback** на `strength` при пустом индексе); `planSeason {consents}` + `assembleSeasonPlan` + `seasonSegmentSummary` (теперь показывает `strict_skip` как `⛔ без согласия — пропущен`) + `createSeasonSlot(period)` для дубля. `src/data/lms-cycles/lms-speed-index.ts` 12 id.
- **Движок пролётов** `src/engines/lms/lms-comp-gap.engine.ts:23` — окно `gap-taper-post` + `needsConsent` + `fittedCycle` + `buildPLSeasonPeaks` поверх, `skip` при окне<1, `strict_skip` при отказе.
- **UI** `src/ui/screens/SRCBBScreen_parts/PLSeasonBuilder.tsx:592` — карточка `🧩 Сезон по микроциклам` в `SRCBBScreen:settings` (переключатель `single|season` + 4 слота с `weeks/enabled/order` + **кнопка `＋ Добавить период` (дубль сила→скорость→сила, `removeSlot`)** + `auto|manual` + диалог согласия `[✓ Согласен 12→7][✕ Оставить 1:1][🔄 Другой]` + `hasBlockedSegments` блокирует сборку + сводка `нед 1-12 → …` + `he_pl_session.season` persist). `SRCBBScreen` — печать/сводка поддерживают `proposed_*` как `по согласию`.
- **Тесты:** `lms-season 26/26` (дубль/пустой/speed-fallback/summary strict_skip), `lms-comp-gap 8/8` (с согласием/без), `lms-speed-index 5/5`, `pl-season-builder 11/11` (с согласием), `lms 888/888`, `SRCBBScreen_parts` зелёные, `tsc 0` (6GB).
- **Источник immutable:** `LMS_CYCLES` не мутируется, `fit` всегда `derived` копия, одиночный цикл `faithful:true` всегда `exact`.

## Армрестлинг: PRO-уровень — эпики A–J полностью (Sep 03 2026)

Выполнение PRO-плана (аудит 36 движков + 72 упражнения + интернет-источники: WAF 2025 Rules, ImproveYourGrip, Donatif, StrengthLog, GrinderGym, GripStrength 12-нед, GoldenGrip, Praxis топ-3, PMC/BMC переломы humerus, ArmliftingUSA/IronMind). NEW 11 движков + 11 тестов; встройка в билдер аддитивно (ядро-инварианты целы).

- **A arm-waf:** полные WAF-категории 2025 (Senior M11/F8, Master/GM/SGM/SSGM, SubJunior/Junior/Youth23, Para PID/PIU/PIDH/PIUH/VI/HI/CP) + `wafAgeGroupFor/wafClassFor/wafCutTargetFor/buildWafStartCard` (руки L/R = отдельные зачёты). Тесты 7/7.
- **B arm-bilateral:** асимметрия L/R, добивка слабой +15% (7-12%) / +25% (≥12%, норма элиты Bezkorovainyi), сильная — maintenance, кап MRV. Тесты 5/5.
- **C arm-supermatch:** best-of-5/6 (раунды 10-15с/отдых 60-90с по уровню), TUT-прогрессия к пику, делоад −40%. Тесты 4/4.
- **D arm-start-strap:** 4 дрилла (reaction_go/referee_grip/strap_start/foul_freeze) + ремень-сессия 10 удержаний + `startReadiness` (реакция ≤350мс, 0 фальстартов). Тесты 3/3.
- **E arm-sparring:** гейт 100% (запрет в deload/пик/tendon>18/повтор на неделе) + партнёр ±5 кг + `pickSparringPartner`. Тесты 4/4.
- **F arm-load-quant:** `armEpley1RM` с гардом 1-12 (имя не конфликтует с `arm-progression.epley1RM`), `smallMuscleE1RM` 3-8, `holdE1RM`, `workMaxFromBenchmarks` (бенчи вместо default-30), `ensureRadialFingers` (Praxis топ-3). TableTech += radial_deviators+thumb; кап сессии TableTech → 7 (`sessionLimitsForArm {sessionTag}`). Тесты 6/6.
- **G arm-diary-autoreg:** sRPE/боль/VBT → volumeMult/RIR+/замены (side→изометрия, pron heavy→pulses при боли ≥4); билдер применяет через `effCh` на уровне мышцы + `volumeMult`/`rirShift`. Тесты 5/5.
- **H arm-competition-prep:** весогонка (темп M0.5/F0.4 %/нед, too_fast/too_slow), `weeksUntilStart/prepPhaseForWeeksOut` (base/strength/taper/peak), `legsAnchorBlock` (присед+тяга+фермер — StrengthLog якорь). Тесты 6/6.
- **I arm-video-analysis:** Kinovea-CSV (`,`/`;`) → xLoop/yMax/vMax → hook/toproll/press + SRD 4. Тесты 4/4.
- **J arm-platform:** WR-таблица (RT 130.5/77.2), попытки 90/96/102%, скоринг %WR, ротация support/pinch/crush. Тесты 5/5.
- **Встройка:** `arm-pro-integration.applyArmPro` (единая точка, всё try/catch) → билдер: mergedWorkMax (бенчи, явный приоритетнее), `effCh`, rationale/safetyWarnings; валидатор: radial/containment-warning + taper-side-warning (только warnings); UI: PRO-карта в params (WAF-превью, L/R, бенчи, дневник, спарринг, supermatch/ремень toggles).
- **Проверено:** arm-область **308/308** (35 файлов, было 238/239 — 1 падение dedup уже починено в дереве), UI arm 9/9, tsc 0 по своим файлам (1 пред-существующая ошибка в чужом `ArmDiagnosticsHub.tsx:943 scoreColor` — не тронута). Коммит строго pathspec (29 файлов: 11 движков + 11 тестов + 7 правок), чужие bb/cardio/nutrition/TA-файлы не тронуты; параллельные коммиты линейки (29fba3fdb, 4c280039a) не откатывались.

---

## Арм-диагностика PRO: хаб до уровня ББ + Мастер 9 лифтов, P0/P1/P2/P3 + D-доточка (Sep 05 2026, 702771af + c2804c07)

Анализ `ArmDiagnosticsHub` (5 табов, 12 точек ARM_BIOMECH, RSS-скоринг) vs эталоны (ББ-хаб 7 табов + причины/топ-3/симуляция/спец-блок/инъекция-во-все-недели/откат/HTML+CSV; PL-мастер: фазы по углам + e1RM-тренд 28д + VBT loss→фаза + персистентность). Интернет-синтез: Mithril cup/pron/rising, StrengthLog цепь + стол ≥50%, GoldenGrip humerus-spiral 90%, Ezreal side-система, Grokipedia EMG, Bezkorovainyi ARM1 F/t/F100/F500 (7.16%/12.47%), IronMind WR, GripStrength 12-нед, WAF 2025. План: `docs/ARM-DIAGNOSTICS-PRO-PLAN.md`.

- **P0 (ядро parity):** NEW `arm-plan-audit` (покрытие 12 точек/table/static/дубли + worstArmPoint), `arm-weak-cause` (volume/technique/mobility/fatigue/strength), `arm-correction-rank` (топ-3: оборудование/мобильность/причина/асимметрия), `arm-simulator` (Δ), `arm-spec-block` (4–8 нед + dayMap + волна 3/2/1), `arm-diary-weak-detection` (e1RM-тренд 28д weak/plateau + подсказка точек); MOD `arm-diagnostics-injection` (все недели + targetSets + `he_arm_plan_saved_prev`); хаб: P0-карточка (аудит → причины → топ-3 → Δ → спец-блок → 💉/↩). Тесты p0 35/35.
- **P1 (сироты):** видео xLoop/yMax/vMax + тип + SRD-бейдж + Kinovea CSV в хабе; VBT `weakPoint`-пороги (`thresholdsFor`, legacy 20/30 intact); NEW `arm-mobility` (5 ROM-чеков + retest → профиль); авторегуляция из sRPE + UCL/shoulder/tendon гварды; bilateral-план + `he_arm_asymmetry_hist`. Тесты p1 22/22.
- **P2:** помост %WR + попытки 90/96/102; NEW `arm-diagnostics-export` (HTML+XSS-esc/CSV+BOM/печать); снапшоты `he_arm_measure_history`; валидация weakPoints; гейтинг side (score≤49 ИЛИ humerus-гейт плана → только ремень/изометрия); parity-матрица 144 (12×3×4). Тесты p2 12/12 + parity 147/147.
- **D-доточка:** боли/сон в E2/E11, per-muscle ACWR (NEW-блок в `arm-acwr.engine`, оригинал `buildArmAcwr` восстановлен дословно после accidental-overwrite +96/−0), профиль в ранжир + ref-ratio/бенч, gate от плана, персистентность P1 (`he_arm_diagnostics_hub_p1`), журнал попыток `he_arm_platform_log`. Тесты d 10/10.
- **Проверено:** arm-область **576/576** (42 файла) + rest-hooks 60/60 + tsc 0 по проекту; полный vitest 10122/10188 — 66 падений все чужие (bb ×~20 файлов от BB-агента в HEAD, TA progress, MesocycleProgressionCard; связи с моим кодом нет — падающие импортируют только phase-periodization/plans-store/programs-data). Коммиты строго pathspec (20 + 6 файлов, только свои); чужой WIP не тронут; `arm-acwr.engine.ts` — урок: перед write проверять `git log -- <файл>` (файл был трекнутый).
- **R1 (d4e55003):** bridge-payload обогащён (NEW `arm-bridge-payload.engine` + 5 тестов: причины/топ с дедупом/spec по неделям/мобильность/ACWR/bilateral/попытки, старые ключи байт-в-байт), bilateral из landmarks уровня (вместо 10/18), мини-график RT (`data-bar`), `attKg` в персистентность. Проверено: arm **582/582** (43 файла), tsc 0 по своим (2 ошибки чужого BBDiagnosticsHub WIP — не тронуты).
- **Финал (7a6c5da3):** кнопка «🖨 Печать» сводки (E14, window.open+print с фолбэком) + запись раунда сюда. Перепроверка на свежем HEAD: arm+hub+rest-hooks **644/644**, tsc по своим 0 (в проекте 6 ошибок чужого WL-хаба WIP).
