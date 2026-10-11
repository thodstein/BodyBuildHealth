# Арм-планировщик (армрестлинг/армлифтинг): PRO-аудит «довести до профессионального инструмента» (Oct 11 2026)

> Задача: «проведи полный анализ арм планировщика и исследования интернет, чего не хватает
> или что работает не правильно? исправь все баги, проверь абсолютно все. по итогу составь
> план-отчёт. цель — довести планировщик до уровня профессионального инструмента.
> старые планы не бери, исследования проводи сам».
>
> Формат: только Edit/Write + vitest/tsc + verify:apk-design. Чужие WIP (bb-movement,
> PL-competition, nutrition/meal-plan) не тронуты. Зондов в проде нет. Коммита/пуша нет.

---

## 1. Что исследовалось

| Зона | Файлов | Метод |
|---|---|---|
| Ядро планировщика | `arm-builder.engine.ts` (1374), `arm-finalize` (474), `arm-validator` (173), `arm-types` (444), `arm-volume`, `arm-volume-landmarks`, `arm-periodization`, `arm-specialization`, `arm-plan-feedback`, `arm-competition-prep`, `arm-taper`, `arm-injury-guard`, `arm-pro5-core/safety/singles/ux`, `arm-grip-rpe`, `arm-cycle-library`, `arm-selector`, `arm-report`, `arm-metrics`, `arm-sets-integrity`, `arm-export`, `arm-annual` | сплошное чтение + сверка потребителей |
| UI | `ArmAutoConstructor.tsx` (3031) | сверка множества state с полями входа `buildArmPlan` + персист + экспорт |
| Армлифтинг | 35 движков `armlift-*` + `arm-platform`, `arm-norms-table`, `arm-waf`, `arm-medley`, `arm-contest-sim`, `arm-lr-split`, `arm-rfd`, `arm-matchup`, `arm-table-iq`, `arm-table`, `arm-duration` + 2 хаба (1283/1361 стр.) | сплошное чтение + верификация констант по первоисточникам |
| Тест-база | 110 файлов движков + 176 UI-файлов | прогон «было» → прогон «стало» |

---

## 2. Собственное интернет-исследование (2024–2026, не из документов проекта)

**Мировые рекорды хвата (сверены с первоисточниками IronMind):**
- Rolling Thunder (V3, 60.3 мм): муж **130.5 кг — Alexey Tyukalov, 2013**; жен **77.2 кг — Ludmilla Gaiduchenko, 22.09.2012** (Wikipedia/IronMind совпадают).
- Apollon's Axle: **Carl Myerscough, 16.12.2022, 237.5 кг** (IronMind news 21.12.2022 + rules-and-world-records); жен 137.9 кг — Гайдученко 03.03.2019.
- **Диаметр Apollon's Axle = 2″ = 51 мм** между внутренними грифами (IronMind rules: «two-inch diameter bar between the inside collars»). В проекте стояло **58 мм** — неверно.
- Hub: 44.80 (Tolonen 2019) / 28.51 (Kulagina 2021) — было верно.

**Ротаторы плеча у армрестлеров (Pascoa et al., PMC12904635, 2026, n=17, Biodex):**
ER peak torque 58.9 Нм vs IR 102.7 Нм → **ER/IR ≈ 0.57 при норме 0.64–0.66** (норматив цитируется в той же работе для силы и мощности). Армрестлинг перекосен во внутреннюю ротацию; дисбаланс ротаторов — часть механики перелома плеча. Поддержка нашего гарда `shoulder_stab` + наружной ротации.

**Механика перелома плеча (Int Arch Orthop Surg / PMC3560640):**
перелом возникает при rotaционном моменте: внутренняя ротация спортсмена (subscapularis/pectoralis/latisimus/teres) против внешней силы соперника; **чистая ротация без осевой нагрузки → спиральный перелом; ротация + осевая → «бабочка»**. Вывод: максимумы в положении «проигрываешь» опаснее всего — наш lifting-gate (axis-score) и запрет 100 % в проигрыше совпадают с наукой.

**Тренировочная методология (2024–2026):**
- StrengthLog 8-week arm-wrestling (2025): 2 фазы по 4 нед, акцент forearm/wrist/pron-sup + elbow flexors + стабилизаторы; программы «table-ready» с волной.
- GripStrength 12-week Table-Ready: **фаза 1 — техника/сухожилия без нагрузки, 4 недели, только потом загрузка** (эхо нашего `tendonMultGlobal 0.7–0.85` и tendon-conditioning в финализаторе); «tendonitis за 11 дней при эго-тяге» — предупреждение для новичка.
- ArmProgress (2026): beginner — 2 сессии/нед, тендонные лимиты, никаких 100 % до готовности; «обучение игнорировать предупреждения» — ровно наш P2 (ложные тревоги в отчёте).
- NSCA rotator cuff priming circuit ( prone fly / pull-apart / plate pull to ER ) — готовые упражнения для `shoulder_stab`.
- TripleF (2026): 8-недельный цикл 2×4 нед (foundation → strength), brachialis как ключевой сгибатель при нейтральном/пронированном хвате (эхо нашего хаммер-приоритета и `brachialis`-мышцы).
- Periodization для grappling (ebrary/NSCA): соревновательный сезон = микроциклы «3 нед роста + 1 делода», пик 3–4 нед — наш каденс 4 (masters 3) совпадает.

**Вывод по методике:** методология планировщика (фазы, MRV/MEV/MAV, tendon-caps, table 3/2/1, L/R, WAF-классы) совпадает с наукой — дефекты были в **проводке, константах, единицах и честности**, а не в модели.

---

## 3. Найденные дефекты (все подтверждены чтением кода)

### P0 — ломает функцию/даёт неверный план

| # | Дефект | Где | Последствие |
|---|---|---|---|
| 1 | **`role: 'primary'` хардкодом** — вычисленная роль (accessory при специализации) выбрасывалась | `arm-builder.engine.ts:988` | политика «резаем/удаляем accessory первыми» в билдере и финализаторе была мертва; при переполнении сессии слепой `splice` мог выкинуть единственное упражнение целевой мышцы |
| 2 | **`sex` не доезжал никуда** — UI читал `linked.profile.personal.sex` (undefined всегда) + поля не было во входе билдера | `ArmAutoConstructor.tsx` 6 мест + вход `buildArmPlan` | женщине строился мужской WAF-класс, мужские %WR платформы, мужской темп сгонки — «показано одно, в план уходит другое» |
| 3 | **ACWR по порядку записей, а не по датам** — `dateIso` не читался | `arm-pro5-core.engine.ts:62-82` | запись, исправленная задним числом (импорт sRPE), попадала в «острую неделю» → ложный `danger` → объем ×0.65 и разгрузка 1-й недели без причины |
| 4 | **Годовая сборка теряла травмы/оборудование/цель** | `ArmAutoConstructor.tsx:2976,2998` + `arm-annual.ts:144` | год собирался без ограничений профиля (исключённый grip_support получал хватовые блоки), цель «Масса предплечья» молча становилась `strength`; мобильность не доезжала вовсе |

### P1 — неверные данные/частично не работает

| # | Дефект | Где |
|---|---|---|
| 5 | Пороги предупреждений отчёта — **суммой всего плана** против недельных гардов (8 tendon-сетов/нед на 12 нед = «Tendon load 96 — много», side 2/нед = humerus) | `arm-report.engine.ts:32-33` |
| 6 | Финализатор резал сессии хардкодом 6/8 — отменял исключение `sessionLimitsForArm` (TableTech 7, armlifting 5/6) | `arm-finalize.engine.ts:182` |
| 7 | **Два знаменателя акселя**: force-capture 133 (Saxon-ориентир) vs платформа 237.5 (WR) → одно и то же «120 кг» = 90 и 50 «world class» | `arm-force-capture.engine.ts:35` |
| 8 | «🗓 В годовой план» (армлифтинг) писала ключ, **который никто не читает** — фича no-op с тостом «✓ ушли в недели года» | `armlift-annual-bridge` + хаб |
| 9 | `ARM_PHASE_PRESETS.note` — английский текст уходил в предупреждения годового плана | `arm-pro5-ux.engine.ts:100` |
| 10 | Смешанные цели отчёта «медицинский/учётный» — camelCase в UI-строках (нарушение правила «нет латиницы») | `ArmliftingDiagnosticsHub.tsx` (5 мест) |

### P2 — качество/константы/гигиена

| # | Дефект | Где |
|---|---|---|
| 11 | Диаметр Apollon **58 мм** вместо 51 мм (2″) — 4 места (каталог, диаметр снаряда, лестница, правила 2026) | `exercise-catalog-arm.ts:43`, `arm-grip:21`, `arm-implement-ladder:28`, `arm-pro5-platform-rules:30` |
| 12 | Apollon WR приписан «Майерско» — это **Carl Myerscough** (IronMind 16.12.2022) | `arm-platform.engine.ts:26` |
| 13 | Подпись RT всегда «Тюкалов 130.5» — для женского WR (77.2, Гайдученко 2012) это ложь | `armlifting-diagnostics.engine.ts:234` |
| 14 | Бонусы `gripFocus` pinch/crush в селекторе были **недостижимы** (в id сплитов нет 'pinch'/'crush'); штраф sidePress шёл по несуществующему тегу | `arm-selector.engine.ts:105-110,148` |
| 15 | Кап `grip_pinch` enhanced 5 — **мёртвая ветвь** (grip_pinch уходил в return 4 раньше) | `arm-volume.engine.ts:129` |
| 16 | UTC-даты «сегодня» в 4 движках (в проекте канон `core/local-date`) | `armlift-history:56`, `armlift-cause:96`, `arm-force-capture:64`, `arm-plan-feedback:269` |
| 17 | CoC уровня 0 (Trainer) считался закрытым тестом → полнота диагностики +40 % | `armlift-completeness.engine.ts:31` |
| 18 | Невалидные id точек срыва в `fixes` (`'support'`, `'start'` — не из канона off_floor/mid/lockout/hold_*/close_fail) | `armlift-correction.engine.ts:114,141` |
| 19 | Критик тендона `>22` **недостижим из UI** (хаб клэмпит ввод в 22) | `arm-diagnostics-hub.engine.ts:121` |
| 20 | WAF: <14 лет получал валидную зачётную карточку; ветка «Перевес/план H» была недостижима (wafClassFor всегда возвращает подходящий класс) | `arm-waf.engine.ts:47,165` |
| 21 | L/R-сплит: `strongSets = pct >= 12 ? base : base` (тавтология) и `withinMrv` всегда true (слабая уже клампнута) | `arm-lr-split.engine.ts:50,57` |
| 22 | Тавтология/мёртвый код: `volumePct: first ? 0.6 : 0.6`, пустой цикл в `planArmPeaks`, `dobrorezov_44` (две одинаковые ветви фаз) | `arm-taper:33`, `arm-periodization:238-243`, `arm-cycle-library:133` |
| 23 | Дата старта в прошлом → авто-пик на 1-й неделе плана (`weeksUntilStart` клампит вниз) | `arm-builder.engine.ts:649` |
| 24 | «План vs факт»/аудит точек считались по `builtPlan`, экспорт — по `viewPlan` (правки врали в цифрах) | `ArmAutoConstructor.tsx:1160-1176` |
| 25 | Загрузка варианта не восстанавливала сплит/хват/PED/флаги цикла → пересборка уходит от сохранённого | `ArmAutoConstructor.tsx:1214-1251` |
| 26 | Стартовый вес «плоской пирамиды» брался из поля «Результат (кг/с)» лестницы | `ArmAutoConstructor.tsx:1353` |
| 27 | `focusGroup` — state без UI-писателя (фокус-мышцу выбрать было нельзя) | `ArmAutoConstructor.tsx:617` |
| 28 | Инвертированный блок специализации (8→3) молча выбрасывался движком | `ArmAutoConstructor.tsx:1676` |
| 29 | Write-only ключи облака: `he_arm_ortho_guards/flags`, `he_arm_last_bench_level` (cloud-kv жёг квоту никому не нужными данными) | `ArmAutoConstructor.tsx:918,940,1061` |
| 30 | `checkinWeek` игнорировал `planStartDate` (compliance учитывает) → чек-ин подписывался не той неделей | `ArmAutoConstructor.tsx:1197` |
| 31 | CSV армлифтинга без защиты от формульной инъекции | `armlifting-diagnostics.engine.ts:450` |
| 32 | Подпись hint обещала lab/nutrition-множители, которых вход не передавал | `ArmAutoConstructor.tsx:1738` |
| 33 | Medley: одно поле «Холд 70 %» при двух релевантных тестах | `ArmliftingDiagnosticsHub.tsx:1083` |
| 34 | Pinch-пул: причина mobility = 1 запись (топ-3 вырождался) | `armlift-correction.engine.ts:129` |

---

## 4. Исправления (что сделано)

**P0:**
1. `role` теперь реально пишется в план (`arm-builder.engine.ts:988`) — политика accessory-first ожила в билдере, финализаторе и экспорте.
2. `sex` добавлен в `armProfileSnapshot` (адаптер читает `settings.personal.sex`), 6 мест UI переведены на снапшот, поле `sex` добавлено во вход `buildArmPlan` и в `cfg` годовых блоков (`buildArmBlock`/`setAnnualBlockConfig` уже умели его читать).
3. `acwrMultFor` считает окна **по датам**: сортировка, острая = 7 дней от последней даты, хроническая = 28; нормализация по числу дней с данными; legacy без дат — прежнее поведение (порядок массива), пороги 1.3/1.5 сохранены.
4. Годовые блоки: `...armBuilderProfilePatch` (equipment/injuries/mobility/favorites/excluded) + `goal` + `sex` + `daysPerWeek`; `buildArmBlock`Additionaly forwarding `mobilityRestrictions/favoriteExercises/excludedExercises` (их не было вовсе).

**P1:**
5. Отчёт: пороги tendon/side — **максимум по неделям** (22 / 9), как недельные гарды; ложные тревоги ушли.
6. `enforceSessionLimits` — единый `sessionLimitsForArm` + гард «не удалять единственное упражнение мышцы».
7. Один знаменатель акселя: `platformWrFor(implement, sex)` (Apollon = WR, Saxon = внутренний ориентир 133), хаб передаёт `axleImplement`; константа `AXLE_WORLD_CLASS` помечена `@deprecated` (237.5, IronMind).
8. Тост годового оверлея армлифтинга честный: «снапшот сохранён — перенесите вручную» (потребителя в чужая зона нет).
9. `ARM_PHASE_PRESETS.note` — русские.
10. Латинские вставки хаба → `ARMLIFT_CAUSE_RU` / `ARMLIFT_MOBILITY_FAIL_RU` / `ARMLIFT_ACWR_ZONE_RU` / `ARMLIFT_WEAK_LINK_SHORT_RU` / лейбл снаряда (единый источник `armlift-cause.engine.ts`).

**P2:**
11–13. Диаметр 51 мм (2″) в 4 местах; Apollon WR → **Carl Myerscough 16.12.2022**; RT-подпись по полу (`wrHolderNote`).
14–15. Селектор: матчинг gripFocus по мышцам тегов; штраф side по `TAG_MUSCLES_ARM`; `perExerciseCap('grip_pinch','enhanced') = 5` (ветка ожила).
16. UTC → `localIsoDate()` в 4 движках.
17. CoC > 0 в полноте диагностики.
18. `fixes` приведены к канону (`['mid']`, `['off_floor']`).
19. Критик тендона `>= 18` (достижим из UI, совпадает с недельным капом 22/18/12).
20. WAF: флаг «не зачётный возраст <14» (`eligibilityNote`); сгонка до категории ниже веса — в строке взвешивания (выше `fits`-мертвенная ветка).
21. L/R: `strongSets = base×0.9` при ≥12 % (maintenance), `withinMrv` = сумма рук ≤ MRV, нота честна про перебор.
22. Тавтологии/мёртвый код убраны (taper, periodization, комментарий в cycle-library).
23. Прошлая дата старта → честное «авто-пик не строится» (сырой расчёт недель, без клампа).
24. «План vs факт»/compliance/audit — по `viewPlan` (мемы перенесены под `viewPlan`, TDZ обойдён).
25. `restoreUiFromSnapshot` — сплит, хват, снаряд, weakPoints, focusGroup, specialization, PED, courseIntensity + 11 флагов цикла.
26. Отдельное поле «Стартовый вес пирамиды, кг» (`cycFlatW`).
27. Чипы «Фокус-мышца» (писатель `setFocusGroup`).
28. Инвертированный блок нормализуется в `updateSpecBlock`.
29. Орто-ключи обрели потребителя (mount-восстановление: гарды исполняются функционально, флаги — строкой в UI); `he_arm_last_bench_level` убран как дубль (уровень и так применён + в diagSnap).
30. `checkinWeek` — общий якорь week1 с compliance (плановая дата → дата сборки → сегодня).
31. CSV: префикс `'` для `= + - @`.
32. Hint про lab/nutrition оставлен — поля есть в `ArmBuilderInput` (UI может передать); фактически передаётся при наличии snapshot'а.
33. Medley: второе поле «Farmer-холд 70 %».
34. Pinch mobility +2 записи (`thumb_opposition_band` — **новая полноценная запись каталога**, т.к. топ-упражнения в нём не было; + ROM-щепок 50 %).

---

## 5. Проверено

- **Движки арм-зоны:** `src/engines/arm` — **110 файлов / 1338 тестов, 0 падений** (было 109/1289; +49 регрессий в NEW `arm-audit-2026-10.test.ts`).
- **UI:** `TrainingScreen_parts/__tests__` — **176 файлов / 1628 тестов, 0 падений**.
- **tsc `--noEmit`:** 0 ошибок по моим файлам (единственная ошибка проекта — чужой незакоммиченный `meal-plan-engine.ts`, зона питания).
- **`npm run verify:apk-design`:** OK.
- Мутационная проверка ключевых фиксов: ACWR (возврат порядка записей → падает `правка задним числом`), role (возврат хардкода → падает «accessory роль»), axle-знаменатель (133 → расхождение %WR), CoC ≥0 (возврат → падает полнота), порог 18 (возврат >22 → падает критик-тест).
- Re-baseline с комментариями «было→стало»: `arm-pro5` (ACWR-дневники последовательными датами), `arm-builder/integration/matrix` (кап сессии по канону), `arm-grip` (51 мм), `arm-planner-pro` (каталог 92), `arm-top-t7-lr-iq` (честный withinMrv), `arm-diagnostics-hub` (критик достижим), `armlifting-hub` (честный тост).

---

## 6. Границы (осознанно не делалось)

- **Ластик по WAF 70+**: сетка весовых для SSGrandmaster70 в нашем каноне сведена к Open — правила WAF для этой группы не перепроверялись по первоисточнику, выдумывать сетку нельзя (зафиксировано комментарием, как и `master40/grandmaster50`).
- **Микро-константы лестницы попыток**: `arm-platform.planAttempts` 90/96/102 % и `armlift-attempt-plan` 92/98/102 % — два разных контекста (домашняя лестница vs соревновательная), сведение = re-baseline 4 копий; оставлено как задокументированная граница.
- **Йсходник циклов**: фазовая карта `dobrorezov_44` («подготовка 12 + база 12» → обе accumulation) — данные источника, не мутировались.
- **Годовой потребитель оверлея армлифтинга** (`he_armlift_annual_sync_v1`) — общий годовой план — чужая зона (MacrocyclePanel); сделана честная подпись.
- **lab/nutrition-множители MRV** из UI не передаются при пустом профиле — движок их читает, UI шлет то, что есть.
- **Живой тест на устройстве** (АПК) недоступен — только юниты/моки/source-guard.

## 7. Что осталось (кандидаты следующего раунда)

1. Микро-гигиена: `dobrorezov_44` — развести фазы подготовки/базы (данные цикла).
2. `arm-report`: предупреждать при достижении пикового max > MRV×1.15 с разбивкой по прямой/косвенной.
3. `arm-duration`: O(n²) `isLastSet` при больших планах (производительность, не дефект).
4. Проверка `arm-motion-capture`/`arm-video-analysis` живым файлом видео (сейчас только CSV/ручной ввод).
5. ER:IR (внешняя/внутренняя ротация плеча) как входной замер хаба — наука (Pascoa 2026) прямо рекомендует; в модели только косвенно через `shoulder_stab`.
