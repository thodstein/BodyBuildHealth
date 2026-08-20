# BB-CONTEST-PREP-PLAN.md — Полный план: Contest Prep в ББ-авто

Статус: план утверждён пользователем (Aug 18 2026). Реализация — после этого документа.

## 0. Решения и скоуп

Утверждено пользователем:

1. **Вариант 1**: цель `contest_prep` в generic-сплит + семейство prep-циклов (8/12/16 нед) + отдельные taper-блоки (2/3/4 нед) с chaining после любого плана.
2. **Единый оркестратор**: шаг «🏁 Contest prep» переиспользует фазы prep-плана; оверлей — только для обычных планов; guard от двойного taper.
3. **Питание до меню**: `prepToMealPlanInput → generateMealPlan`, сохранённый `NutritionPrepPlan`, календарь по датам.
4. Дополнительно прорабатываются: **фармакология prep**, **модель объёма по фазам**, **полный процесс** (от даты шоу до post-show).

Целевое поведение: prep-циклы доступны в обоих режимах ББ-авто; taper-блоки цепляются к любому плану; шаг Contest prep — единая точка сборки тренировки + фармы + питания; исходные планы не мутируются; всё идемпотентно и версионируется.

---

## 1. Текущее состояние (факты из кода)

### Тренировки
- `planMode: 'generic_split' | 'bb_cycle'` (`BbAutoConstructor.tsx:357, 1931-1942`). Generic: 5 целей `BBGoal` (`mass|cut|recomp|maintenance|strength_mass`, `bb-builder.engine.ts:65`) — **цели contest_prep нет**.
- ПРОФ-циклы: `bbCyclesList` (`BbAutoConstructor.tsx:1140`) — direction `bodybuilding`; конвертация `convertCycleToBBPlan` (week1 × `meta.phases`).
- Единственный prep-цикл `cycle-bb-12` «Pre-Contest Peak 4x/нед» (`src/data/lms-cycles/cycle-bb-12.ts`): 4 нед, только KMS-MSMK, конфликт `deloadWeeks:[4]` с фазой «Пик», пик = 15–25 повт RIR 0 + дроп-сеты (противоречит современному пикингу), вода/натрий упомянуты без safety-гейтов, posing нет. Недоступен в generic.
- Оверлей `applyContestPrepToBBPlan` (`bb-contest-prep.engine.ts:1162`): подготовка (RIR 1–3, без отказа) → финальная ×0.9 → taper (0.85→0.6, интенсивность сохраняется, RIR 2–4) → пик-неделя; идемпотентен (`prepProtocol`/`contestPhase`/`_baseSets`), не мутирует вход, guard от авто-taper финализатора (`bb-autocoach.engine.ts:837`).

### Питание
- `nutritionTargetsForPrepDate()` — цели на любую дату (prep/taper/peak/post-show); `prepToMealPlanInput()` — адаптер в `MealPlanInput` (**не подключён** к `generateMealPlan`); цели применяются в `IndividualPlanContext` (`_applyPrepTargets`, строки ~1690-1758), вкладка «🏁 Тапер ББ» (`PeakWeekTab.tsx`) — конфиг пик-недели.
- Пробелы: нет сохранённого меню prep, нет `nutritionPlanId`, нет календаря меню по фазам, `phase` целей подготовки возвращает null (только note), нет регенерации без потери ручных замен, нет план-факта питания.

### Фармакология (переиспользуем)
- `bb-ped-adaptation.engine.ts` — дозозависимые MRV/восстановление (AAS/insulin/MGF/IGF1/GH), риски, cap 2.0.
- `course-sync.ts` — `ghIU/insulinIU/igfMcg/clenMcg/t3Mcg` из курса; `UnifiedSettings.pharma` — те же поля.
- `pharma-db/glp1-aux.ts` — кленбутерол (β2, липолиз, **гипокалиемия**), тиреоидные (T3/T4).
- `system-mechanisms.ts` — `cardio_7` аритмогенность (ААС+диуретики+клен+Т3), `renal_3` (дегидратация+диуретики), `ghigf_2` (**ГР → задержка воды**), тиреоидные механизмы.
- `ped-risk-matrix.ts`, калькулятор поддержки (7 систем, мониторинг, электролиты), `drug-interactions.ts` (clen+небиволол и др.), `pct-planner.engine.ts` (ПКТ).
- `bb-contest-prep.engine.ts` — `enhanced` (карбс-толерантность), запрет диуретиков, `confirmedManipulation`-гейты, `professionalReviewConditions()`.

### Объём (модель BB-движка)
- MEV/MAV/MRV × (уровень/стаж/PED/цель/лаб/восстановление), effective-объём (indirect), session-капы (10 упр., 40/14 сетов), специализация (1–2 мышцы, ×1.1–1.2), donor-tradeoff, MEV-repair, cap-adjust, enforceSessionExerciseLimit, guard `isPrepControlled` в финализаторе (не раздувает taper/пик).

---

## 2. Целевая архитектура

### Единый bundle результата

```ts
BBContestPrepBundle {
  id: string;
  prepPlan: BBContestPrepPlan;
  sourceTrainingPlan: {
    kind: 'current' | 'saved_variant' | 'user_program' | 'prep_cycle' | 'annual_block';
    id?: string;
    fingerprint: string;      // stableHash исходника
    name: string;
  };
  trainingOverlay: BBPlanWithPrep;      // результат наложения (копия)
  pharmaProfile: PrepPharmaProfile;     // см. §3
  nutritionPlan?: NutritionPrepPlan;    // см. §6
  targetsByDate: Record<string, PeakNutritionTargets>;
  warnings: string[];
  safety: {...};
  createdAt: string; updatedAt: string; algorithmVersion: number;
}
```

Инварианты:
- исходник не мутируется; наложение только на копию;
- повторная сборка всегда от базы (не от урезанного результата);
- `sourceFingerprint` → stale-детекция при изменении исходника;
- тренировка + фарма + питание связаны одним `prepPlanId`;
- rollback возвращает исходный план.

Хранилища: `he_bb_contest_prep_bundles` (версии, кап 6), `he_bb_contest_prep_active_bundle`, `he_bb_prep_nutrition_plans`. Legacy (`bbPeakConfig`, `bbContestPrepPlan`) — migration-fallback, не удаляются.

### Пользовательские сценарии

**A. Шаг в ББ-авто:** построить план (generic/цикл) → шаг «🏁 Contest prep» → параметры (дата/категория/фазы/фарма/питание) → превью diff → «Собрать тренировку + питание» → bundle.
**B. Наложение на сохранённый план:** селектор источника (текущий/вариант `he_bb_plans`/user-program/годовой блок) → предпросмотр → применить/сохранить как новую версию/откатить.
**C. Prep-цикл как источник:** выбрать prep-цикл или цель `contest_prep` — шаг переиспользует фазы цикла (без повторного оверлея), настраивает дату/категорию/питание.

---

## 3. Фармакология prep (полный блок)

### 3.1 Новый движок `src/engines/bb/bb-prep-pharma.engine.ts` (чистый)

Принцип: **протокол и безопасность, без назначения дозировок** (диуретики не назначаются; дозировки — зона врача/существующего курса). Источники данных только read-only.

**`PrepPharmaProfile`** — классификация активного курса (`course-sync` + `UnifiedSettings.pharma`):
```ts
{
  aas: { aromatizing: boolean; dht: boolean; nor19: boolean; orals: string[]; totalMgPerWeek: number };
  gh: { active: boolean; iuPerDay: number };
  igf1: { active: boolean };
  insulin: { active: boolean; shortActing: boolean };
  clen: { active: boolean; mcgPerDay: number };
  t3t4: { active: boolean };
  glp1: { active: boolean };
  aiSerm: { active: boolean; ai: boolean };
  diuretics: { active: boolean };   // флаг запрета
  enhanced: boolean;                 // = aas активен
  risks: string[];                   // из ped-risk-matrix / системных механизмов
  monitoring: string[];              // лабораторный минимум
}
```

**`prepPharmaProtocolForPhase(profile, phase)`** — таблица «сохранить / снизить / убрать / запрет»:

| Фаза | AAS инъекц. | Оралы | ГР | Клен/Т3 | Инсулин | AI/SERM | Диуретики |
|---|---|---|---|---|---|---|---|
| Подготовка | сохранить (анти-катаболизм в дефиците) | по лабам печени | сохранить, при отёках — убрать | по лабам (K⁺, ЧСС) | опытные + карбс-контроль | по E2 | ⛔ |
| Финальная подготовка | сохранить, контроль E2 | **стоп за 2–3 нед** (печень) | **стоп за 1–2 нед** (вода, ghigf_2) | стабильно, без изменений | снизить/стоп (гипо-риск) | E2 20–40 пг/мл | ⛔ |
| Тапер | без резких изменений (не ронять гормоны) | убрано | убрано | клен стоп D-4…D-3 (тремор), Т3 стабильно | стоп | по E2 | ⛔ |
| Пик-неделя | база без изменений | убрано | убрано | Т3 стабильно, клен убран | ⛔ (без еды — категорически) | по E2 | ⛔ **жёсткий запрет** |
| Шоу-день | ничего нового | — | — | — | ⛔ backstage без углеводов | — | ⛔ |
| Post-show | ПКТ (`pct-planner.engine`), электролиты/гидратация | — | можно возобновить | стоп | по схеме | по ПКТ | по врачу |

Дополнительные правила движка:
- **GH-задержка воды** (`ghigf_2`): при активном ГР + водных модах → warning «отменить ГР за 1–2 нед или использовать stable-воду»; влияет на `peakWeek.waterMode` (форс stable при неконтролируемой задержке).
- **Клен/Т3**: предупреждения `cardio_7` (аритмогенность), `thyroid_5` (ятрогенный тиреотоксикоз); обязательный мониторинг K⁺/ЧСС/АД; клен стоп D-4…D-3.
- **Оралы**: стоп за 2–3 нед (печень ALT/AST); риск-баннер при активных оралах в последние 4 недели.
- **Инсулин**: запрет в пик-неделе по умолчанию; «опытный + карбс-окно» — только с явным подтверждением; гипогликемия — блок-флаг в чек-инах.
- **Диуретики**: флаг → `blockedProtocol` на уровне prep-плана (продление существующего гейта); мониторинг K⁺/креатинин/ЭКГ.
- **Парные риски**: `clen + nebivolol` (β-антагонизм) и др. из `drug-interactions.ts`; вывод в warnings.
- **Electrolytes**: в пик-неделе ежедневный чек-лист K⁺/Mg/гидратация; при клене — калий 3–4 г/день (рекомендация, не рецепт).
- **ПКТ-мост**: post-show ссылается на `pct-planner.engine` (taper-недели препаратов, ПКТ-протокол, связь с калькулятором поддержки).

### 3.2 Интеграция
- `buildBBContestPrepPlan`: `enhanced` → полный `PrepPharmaProfile` (не только boolean); `safety.warnings` получает фарма-warnings; `requiresReview` при кардио/тиреоидных рисках.
- Шаг Contest prep: блок «💉 Фармакология prep» — таблица по фазам, риски, мониторинг, авто-подтягивание из профиля (кнопка «📋 Из профиля», паттерн как в калькуляторе поддержки).
- `BBContestPrepBundle.pharmaProfile`; печать/JSON тренера включают фарма-раздел.
- Событие `he-bb-contest-prep-updated` дополняется `pharmaProfile`.

### 3.3 Мониторинг (лабораторный таймлайн)
Из существующих карт (`lab-marker-map`, `pharma-lab-marker-map`, `lab-tier-recommendations`):
- baseline (до старта prep): ОАК, HCT, ALT/AST, липиды, E2, глюкоза, ТТГ/Т3, K⁺, креатинин;
- середина prep: ALT/AST, E2, K⁺, АД/ЧСС (при клене — еженедельно);
- 2 недели до шоу: E2, K⁺, глюкоза, HCT;
- пик-неделя: K⁺/Mg ежедневно (чек-лист), АД/ЧСС;
- post-show: ТТГ, E2, липиды, K⁺ (после водных модов — обязательно).

---

## 4. Модель объёма по фазам (тренировки)

### 4.1 База объёма (учитывается ДО фаз prep) + правила

**База (уже в движке, работает всегда):**
- **Стаж/уровень**: `bbLevel` (beginner/intermediate/advanced) + `bbTrainingYears` → пороги MEV/MAV/MRV и session-капы (`getVolumeLandmarks`; natural 24/10 сетов и т.д.).
- **PED**: `adaptForPEDs` **дозозависимо** — AAS 250 мг → MRV ×1.18, 500 → ×1.35, 1000 → ×1.52, стек (AAS+insulin+GH+IGF1+MGF) → до cap ×2.0; `courseIntensity` (mild/moderate/heavy).
- **Восстановление**: bodyFat/leanMass/HRV/сон/стресс → `computeBBRecoveryMultiplier` ×0.6–1.15.
- **Лабы и питание**: `labMrvMultiplier` (0.7–1.3); `computeBBNutritionMultiplier` (профицит калорий/белок).
- **Специализация**: цели ×1.1–1.2, donor-tradeoff, MEV-repair.

**Правила prep-фаз поверх базы:**
- Все капы активны: MRV per-muscle (effective-объём), session-капы (10 упр., 40/14 сетов), per-exercise 2–5 сетов, нет single-set, enforceSessionExerciseLimit.
- В **подготовке/финальной** множители базы (стаж/PED/восстановление) работают как обычно — атлет на курсе может держать больше объёма в дефиците.
- В **тапере/пике** PED-множители намеренно НЕ раздувают объём: taper-кривая (0.85→0.60) одинакова для всех (Bosquet 2005), PED не отменяет необходимость восстановления к сцене (расширить guard `isPrepControlled` на `contestPhase`).
- Стаж влияет и на сам prep: `experienceLevel` → стратегия пик-недели (новичок/первый пик → conservative, продвинутый с prepCount>0 → moderate), `enhanced` → карб-толерантность/риски, `prepCount` → предупреждения.
- Авторегуляция: ACWR (caution → ×0.85/RIR+1; dangerous → делод), HRV/сон/стресс — множитель восстановления; diary-feedback (e1RM) корректирует **вес**, не объём.

### 4.2 Объём по фазам

| Фаза | Объём | RIR | Интенсивность (вес) | Техники | Особое |
|---|---|---|---|---|---|
| Подготовка | ×0.85–1.0 (выбор: сохранение/поддерживающий, Helms 2022) | 1–3 | сохраняется | отказные убраны | direct ≥ MEV у всех мышц, частота сохраняется, без новых упражнений |
| Финальная (2 нед) | ×0.9 | 2–3 | сохраняется | отказные убраны | спец-мышца щадится (×1.25 к множителю, ≤1.0); deload не трогается |
| Тапер (2–4 нед) | 0.85 → 0.70 → 0.60 (Bosquet 2005) | 2–4 | 0.95 → 0.85 | запрещены | ноги разгружаются раньше (×0.9 в первую taper-неделю), спец щадится, без новых упражнений/эксцентриков |
| Пик-неделя | pump: 2–3 лёгких сессии | 2–3 (не 0!) | лёгкие веса | без отказа | изоляции 15–25 повт, без тяжёлых компаундов последние 3–4 дня, posing 20–60 мин/день |

Порядок разгрузки мышц (чем раньше, тем важнее восстановление к сцене): ноги/спина → грудь → руки/плечи (последние — памп для наполненности).

### 4.3 Фаза `contest_prep` в generic-сплите
- `BBGoal += 'contest_prep'` (`bb-builder.engine.ts:65`, `bb-types.ts:15`, `bb-selector.engine.ts:10`).
- `distributeContestPrepPhases(weeks, {taperWeeks})` в `phase-periodization.ts`: подготовка (accumulation RIR 2–3, без failure) → финальная ×0.9 → taper → peak week; разметка `wk.contestPhase`; доступно при `bbWeeks ≥ 10`.
- `finalizeBBPlan`: `isPrepControlled` — пропуск volume-проходов (feeders/MEV/fill/ротация) для недель с `contestPhase`; auto-taper финализатора не накладывается.
- UI: селектор цели «🏁 Подготовка к соревнованиям» + подсказки (сушка, белок 2.2–2.5 г/кг, кардио).

### 4.4 Валидатор prep-плана (`validatePrepTrainingPlan`)
Блокирующие ошибки: пересечение фаз; taper-неделя с объёмом выше предыдущей; failure-техники в taper/пике; пик-неделя с RIR 0; план короче prep-окна (warning + явное расширение); отсутствие deload перед тапером (warning); двойной taper (две системы разметки). Жёлтые: объём ниже MEV у спец-мышцы; кардио HIIT в пик-неделе.

---

## 5. Питание по фазам

### 5.1 Подготовка
- Калории: TDEE-основа (профиль/дневник веса), дефицит `0.25–0.75% массы/нед` (женский дефолт 0.4); ступени ±150–175 ккал, **одна переменная за раз** (калории ИЛИ кардио ±20 мин).
- Белок 2.2–2.5 г/кг (по категории), жиры ≥ 0.6/0.8 г/кг (мин 30/40 г — не обнуляются), клетчатка 25–40 г, вода/натрий стабильны.
- Женские floors: 1400 ккал (RED-S), железо/кальций/цикл — существующие ноты.
- Адаптация: `prepWeightAdvice` (уже есть) — средние за 7 дней, статусы on_track/too_fast/too_slow; история корректировок (`adjustments`, автор auto/user/coach); в taper/пике авто-коррекции запрещены.

### 5.2 Тапер
- Калории: **не снижаются** (усталость падает, катаболизм не нужен) — режим `maintain`/мягкий переход к поддержанию; белок сохраняется; вода/натрий стабильны; карбс корректируются только по весу/наполненности/пищеварению.

### 5.3 Пик-неделя
- Дневной протокол D-6…D-0 (существующий `buildPeakWeek`): калории/БЖУ/вода/Na/K по дням; карб-загрузка по категории (heavy 4–8 г/кг, light 2–4 г/кг); деплеция только по тестам; вода/натрий stable по умолчанию; K не снижается всю неделю; низковолокнистые карбс; никаких новых продуктов.
- Safety: подтверждение модуляции (`confirmedManipulation`), противопоказания → `blockedProtocol`, диуретики запрещены, вода ≥ 0.5 л даже в день шоу, натрий ≥ 800 мг.

### 5.4 Show day и post-show
- Show day: малые порции знакомой еды, карбс малыми дозами, backstage pump, вода глотками.
- Post-show: поддержание ≈ дефицит+300 ккал (не профицит сразу), белок 2 г/кг, возврат объёма +10–15%/нед, контроль веса (+1–2 кг = гликоген/вода — норма).

### 5.5 Меню (новое)
- `src/engines/bb/bb-prep-nutrition.engine.ts`: `buildPrepNutritionPlan(prepPlan, opts)` → `NutritionPrepPlan {prepPlanId, dateRange, days[], targetsByDate, menus[], generatedAt, algorithmVersion}`.
- Цепочка: `nutritionTargetsForPrepDate → prepToMealPlanInput → generateMealPlan` (async для 3/7 дней, yield 20 мс); пост-проверка: БЖУ ≈ ккал, аллергены, клетчатка, вода/Na/K.
- Генерация: сегодня / 3 дня / 7 дней / вся пик-неделя; regeneration без потери ручных замен (дифф items, lockedIds).
- Хранение: `he_bb_prep_nutrition_plans` (версии, кап 6); `prepPlan.nutritionPlanId`; календарь в Nutrition (текущая фаза, цели+меню сегодня, 7-дневный вид, план vs факт веса/меню).
- `_phase` в `nutritionTargetsForPrepDate` сделать явной для подготовки/тапера (не null) — сейчас только note.

---

## 6. Циклы и taper-блоки (данные)

### 6.1 Семейство prep-циклов (`src/data/lms-cycles/`)
| Файл | id | Описание | Недели | Уровни | Категория |
|---|---|---|---|---|---|
| `cycle-bb-13.ts` | `contest-prep-12-heavy` | полный prep, PPL, heavy-категории | 12 | KMS-MS | mens_bb/classic |
| `cycle-bb-14.ts` | `contest-prep-12-light` | полный prep, Upper/Lower, light-категории | 12 | II-KMS | mens_physique/bikini/wellness |
| `cycle-bb-15.ts` | `contest-prep-8` | короткий prep | 8 | novice/II-KMS | любые |
| `cycle-bb-16.ts` | `contest-prep-16` | длинный prep, 2 meso-блока | 16 | KMS-MS | любые |
| `cycle-bb-17.ts` | `taper-bb-2` | taper-блок (chaining) | 2 | любые | — |
| `cycle-bb-18.ts` | `taper-bb-3` | taper-блок | 3 | любые | — |
| `cycle-bb-19.ts` | `taper-bb-4` | taper-блок | 4 | любые | — |

- Meta: `direction: 'contest_prep' | 'peaking_bb'` (типы уже есть в `lms-types.ts:9`), `targetFocus: 'contest'`, новые поля `targetCategory?: 'heavy'|'light'`, `taperIncluded?: boolean`.
- `SRPhaseBlock` расширяется (обратно-совместимо): `phase?: SRSourcePhase | 'taper' | 'peak_week'`, `contestPhase?: 'preparation'|'final_preparation'|'taper'|'peak_week'`, `posingMinutesPerWeek?: number`.
- Фазы prep-циклов: База (RIR 3→2) → Сушка/Retain (2→1) → Финальная (×0.9) → Тапер (0.85→0.6, RIR 2–4) → Пик (памп, RIR 2–3, без отказа); posing с финальной фазы.
- **Апгрейд `cycle-bb-12`**: убрать конфликт `deloadWeeks:[4]`, пик перевести на памп RIR 1–2 без дроп-сетов до отказа, добавить posing и `contestPhase`-разметку.

### 6.2 Конвертация (`cycle-to-plan.ts`)
- direction `contest_prep`/`peaking_bb`: разметка `wk.contestPhase` из `meta.phases`, RIR-политика подготовки, снятие failure-техник, posing в комментарий недели; `weeks?` (faithful) — дословно с разметкой.
- `appendBBTaperBlock(plan, blockId, {weekNumber?})` — chaining taper-блока в конец плана (guard идемпотентности, метка `prepProtocol`, без мутаций).
- UI: в режиме ПРОФ-цикл — «+ 🔗 Присоединить taper-блок» (список `taper-bb-*`); в generic — цель contest_prep + та же опция.

---

## 7. Единый оркестратор (шаг «🏁 Contest prep»)

- **Селектор источника**: текущий план · prep-цикл · вариант `he_bb_plans` · user-program (`program-store`) · годовой BB-блок. Показ имени/даты/fingerprint.
- **Режим работы**: если источник уже размечен (`contestPhase`/`prepProtocol` или цель/цикл `contest_prep`) — шаг НЕ накладывает оверлей, а редактирует фазы (дата/категория/моды/недели); иначе — оверлей `applyContestPrepToBBPlan`.
- **Guard двойного taper**: проверка `plan.contestPrep`, `meta.direction`, `bbGoal` → флаг «переиспользовать фазы».
- **Bundle**: snapshot «до», diff «после» (сеты/RIR по неделям с цветами фаз), `rollback`, «Сохранить как новую версию», stale-детекция по fingerprint, восстановление после перезагрузки (`he_bb_contest_prep_active_bundle`).
- **Сборка одним действием**: тренировка (цикл/оверлей) + фарма-профиль + цели питания (+опц. меню) → bundle → `he-bb-contest-prep-updated` (prepPlanId/trainingPlanId/nutritionPlanId/pharmaProfile).
- Печать/ICS/JSON тренера включают все три раздела.

---

## 8. Сам процесс (end-to-end)

1. **Setup**: дата шоу, категория, уровень/стаж, источник плана (или сборка цикла/generic-цели), авто-подтягивание фармы из профиля/курса.
2. **Сборка**: тренировочный план с фазами → фарма-протокол → цели питания (→ меню 3/7 дней) → bundle + safety-отчёт (requiresReview/blockedProtocol).
3. **Недельное исполнение**: чек-ин (вес 7-дн среднее, сон, adherence, выполнение тренировок — `prepTrainingCompliance`); ступенчатая адаптация (одна переменная); история корректировок; frozen-недели не пересчитываются без подтверждения.
4. **Test peak week** (за 3–4 недели): оценки (карб-толерантность/пищеварение/залив/памп/сон) + Δвеса → `resolvePeakStrategy` → стратегия пика.
5. **Тапер** (нед −3…−1): объём-кривая, веса сохраняются, RIR 2–4, питание stable, фарма-стопы по §3, позирование.
6. **Пик-неделя** (D-6…D-0): дневной протокол (тренировка/еда/вода/Na/позы/фарма), электролит-чек-лист, запрет диуретиков.
7. **Show day**: `buildShowTimeline` (подъём → еда малыми порциями → backstage памп → выход).
8. **Post-show**: reverse-питание, возврат объёма, ПКТ-мост (`pct-planner`), контроль веса, лабораторный контроль.
9. **Интеграции по ходу**: Nutrition tab (календарь), кардио (`buildCardioCycleFromPrep`), годовой план (BB-блок contest_prep), дневник веса, калькулятор поддержки (риски/поддержка курса), BB Recommendations.

---

## 9. Этапы реализации

1. **Этап 0. Контракт**: `BBContestPrepBundle`, fingerprint, хранилища, миграции; тесты инвариантов.
2. **Этап 1. Данные циклов**: `cycle-bb-13…19` + апгрейд `cycle-bb-12`, расширение `SRPhaseBlock`, регистрация в `lms-cycle-index`.
3. **Этап 2. Generic-цель `contest_prep`**: `BBGoal` (+3 файла типов), `distributeContestPrepPhases`, `finalizeBBPlan` guards, UI-селектор цели.
4. **Этап 3. Конвертация + chaining**: `convertCycleToBBPlan` (разметка/политика), `appendBBTaperBlock`, UI «+ taper-блок».
5. **Этап 4. Оркестратор**: селектор источника, режимы «переиспользовать/оверлей», bundle, diff/rollback/stale, сборка одним действием.
6. **Этап 5. Фармакология**: `bb-prep-pharma.engine.ts` (профиль, протокол по фазам, риски, мониторинг), UI-блок «💉 Фармакология prep», интеграция в bundle/печать.
7. **Этап 6. Питание до меню**: `bb-prep-nutrition.engine.ts`, генерация меню, календарь, regeneration, план vs факт, `nutritionPlanId`, событие.
8. **Этап 7. Интеграции и QA**: годовой план, кардио, дневники, печать/ICS/JSON, валидатор prep-плана, safety-отчёт.

---

## 10. Тесты

- **Циклы**: валидность шаблонов (id/недели/фазы/RIR), конвертация, разметка `contestPhase`, отсутствие RIR 0 в пике, chaining идемпотентность, без двойного taper.
- **Generic-цель**: распределение фаз (10/12/16/20 нед × taper 2/3/4), guard финализатора, матрица целей 5→6, инварианты объёма (0 overflow, нет single-set).
- **Оркестратор**: prep-цикл + шаг = без повторного наложения; обычный план + шаг = оверлей; rollback; stale по fingerprint; bundle-roundtrip.
- **Фарма**: профиль из курса (все классы), протоколы по фазам, ГР-задержка → stable-вода, клен стоп D-4, оралы стоп, инсулин-запрет в пике, диуретики → blockedProtocol, парные риски, мониторинг-таймлайн.
- **Питание**: цели × даты всех фаз (фаза явная), меню 1/3/7, БЖУ≈ккал, floors (калории/жиры/вода/Na), regeneration с ручными заменами, план vs факт, женские RED-S.
- **E2E**: buildBBPlan → prep-цель/цикл → оркестратор → меню → изменение даты → stale → rollback → post-show.

---

## 11. Критерии готовности

- prep-циклы доступны в обоих режимах ББ-авто (generic-цель + ПРОФ-циклы);
- taper-блоки цепляются к любому плану;
- шаг Contest prep — единая точка (без двойного taper), исходник не мутируется;
- фарма-протокол по фазам с safety-гейтами и мониторингом (без назначения дозировок/диуретиков);
- объём по фазам по модели §4, PED-множители не раздувают taper/пик;
- питание доведено до сохранённого меню + календаря, связано `prepPlanId`;
- bundle версионируется, diff/rollback/stale работают;
- старые `bbPeakConfig`/`bbContestPrepPlan` работают через миграцию;
- `tsc 0`, целевые наборы зелёные, полный прогон без новых падений.

---

## 12. Риски и ограничения

- Два слоя разметки (`contestPhase` vs `prepProtocol`) — оркестратор обязан гарантировать один источник правды; guard покрывается тестами.
- Фарма — только протокол/риски (harm reduction), никаких назначений дозировок и диуретиков.
- Пик-неделя по умолчанию консервативна (stable вода/натрий); агрессивные моды — только тест + подтверждение.
- Объёмная модель BB (MEV/MAV/MRV/капы) не меняется — фазы prep задают множители поверх неё.

---

## 13. Интеграция с тапером в питании (важно)

Prep-цикл ПОДКЛЮЧЁН к «🏁 Тапер ББ» в планировщике питания (PeakWeekTab) и к дневным целям:

- **Сборка автоматически сохраняет** `goals.bbContestPrepPlan` (единый план) + `goals.bbPeakConfig` (legacy, для вкладки «🏁 Тапер ББ») через `savePrepToProfile`, и диспатчит событие `he-bb-contest-prep-updated` — планировщик питания (`IndividualPlanContext`) живьём перечитывает и применяет дневные цели (`nutritionTargetsForPrepDate`) на даты подготовки/тапера/пик-недели. **Дополнительный клик «Сохранить» не требуется.**
- Приоритет источника в `planFromStored`: единый `bbContestPrepPlan` > legacy `bbPeakConfig` > legacy поля профиля.
- В результате Prep-цикла блок «🍽 Питание на сегодня» показывает текущие цели (ккал/Б/У/Ж/вода/натрий) из того же плана.

## 14. Исключение минимальных мышц (fix)

- Минимальная нагрузка (доноры) реально исключается: `VolumeTradeoffPolicy.donorFloorMult` —
  `0` для режима «полное исключение» (прямая работа убрана), `0.25×MEV` для режима «снижение»
  (≈2-4 сета/нед на мышцу). Раньше донор держался на полном MEV-флоре (~10 сетов) — «исключение не работало».
- Warmup-активаторы минимальных мышц удаляются в `applyPrepVolumeCascade` — раньше в UI был
  дубль «разминка + рабочее» одного упражнения.
- Проверено тестом: у минимальной мышцы ≤3 сета/нед и нет рабочих дублей в prep-неделях.
