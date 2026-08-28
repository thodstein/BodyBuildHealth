# Аудит планировщиков Единоборства + Стронгмен/ТА — план доработки до PRO и визуальный редизайн

**Дата:** 28 авг 2026 · **Автор:** OpenCode (Muse Spark) · **Область:** `src/engines/combat/*` (25 файлов) + `src/engines/strength-sport/*` (20 файлов) + `src/ui/screens/{combat,strength-sport}/*` + `src/engines/outside-load.engine.ts`
**Исходный уровень:** изолированные конструкторы PRO-BASE (295 + 258 тестов, `tsc 0`, `vite build OK`). **Цель:** честный профессиональный уровень — как у BB-авто (1772 теста) и ПЛ-LMS (650+ тестов) с методологической валидностью, связью с дневником/питанием/годовым и визуалом уровня CardioUI/ManualUI.

---

## 1. Текущее состояние — что уже есть

### 1.1 Архитектура

* **Полная изоляция** — `combat/*` и `strength-sport/*` не импортируют `bb/*`/`lms/*`/`annual-training`, свои хранилища `he_combat_*` / `he_strength_*`, связка в планировщик только через `nav.ts:86` `PLANNER_MODES` и `TrainingScreen.tsx:625-630`. Вне-зальная нагрузка — единый `outside-load.engine.ts` (декларация → `weeklyLoad` → `volumeMultiplier` 0.55-1.0 + `isDayConflictWithOutside`).
* **Strength-sport** — 3 режима `weightlifting|strongman|hybrid`, 5 целей, 4 уровня, 9 сплитов `wl_3/4/5/6 + sm_2/3/4 + hyb_3/4` (7д ротация), объём WL в подъёмах (STONE 2006/Takano) + STRONG в метрах, прогрессия `pmForWeek` per-lift `kFactor` 0.45 (рывок) — 1.0 (присед) с капом 1.25/1.35/1.5, `phaseForWeek` Torokhtiy 3/3/3/1 + `phaseForDate` к старту, отбор `SS_ANGLE_CLASSES` 6 тегов + 8 STRICT-групп, нагрузка `tempo X-0-X-0 / PCT 75/85/92 / Prilepin optimalReps / rest 80-480с`, бюджет `60/85/110/135 × ped×lab×nut×acwr×outside×vbt` (финалек 24/38/55 sets, 10/13/16 ex, cap5/6), финалка с DOTS/Wilks/IPF GL + Sinclair 0.7519/175.5 + IWF/Masters, DUP `heavy_light/wave`, интенсивность `cluster`, мезоцикл +2.5кг, годовой `he_strength_annual_v1`.
* **Combat** — 5 дисциплин `boxing/mma/wrestling/kickboxing/general`, 5 целей + `weight_cut`, 4 уровня, 5 сплитов `combat_2a/2b/3/3b/4` (зал 2-4×, ATR-autoselect), объём neck 4-16 / grip 4-22 / rotational 4-18 / legs-push-pull 6-24, отбор 5 тегов ×4-6 классов + 7 STRICT-групп, нагрузка 24 темп-оверрайда, периодизация **ATR 50/30/20 (Issurin) + linear + conjugate** (max/dynamic/repetition) с deload 3/1 или 2/1 (camp) и taper 1-2нед, весогонка **ISSN 2025** `Water load_cut 8л→2л / Na 5→1.5г / Carb 5→1→8г/рефид 150%`, кондиция 3 системы `alactic 8×10с/50с / lactic 5×3мин / aerobic Zone2 40′`, workMax точный 64 упражнения, мониторинг ACWR 0.8/1.3/1.5 + VBT + HRV (mean±SD), Core Boxing Science 4 функции, PED cap по дисциплине 1.32-1.45, лимиты 22/30 cap5, финалка neck/grip/rot/coreAnti vs MEV/MRV + push/pull horiz/vert + unilateral + prehab auto `face_pull 3×15`, билдер `POOL_BY_TAG` 64 упр. + бюджет 112×mult + тапер к дате боя + весогонка + DUP+intensity, годовой ATR 50/30/20 + transition 2нед.

### 1.2 Сильные стороны

* Изоляция защищает ББ/ПЛ от регрессий, outside-load — единая методика интерференции.
* Объёмные ориентиры привязаны к источникам (Stone/Takano/Israetel для ТА, Helms/Bosquet для тапера, Issurin для ATR, ISSN 2025 для весогонки).
* Prilepin-таблица для WL, rest по ивентам (йок 8мин/лог 5мин) — по Rest Timer Science.
* Финалки уже режут капы, проверяют sync, outside-конфликты, joint-JSI (йок >2.5×BW), prehab-добавки.
* Экспорт CSV/HTML/ICS/telegram-дайджест, миграция `combat-storage v1→v2`, годовой Gantt-примитив.

### 1.3 Цифры

* `npx vitest run src/engines/combat` — 295/295, `strength-sport` — 258/258 (≈221 matrix + p0/p3/tempo/builder/balance), `tsc 0` по этим файлам. Полный прогон проекта 7850+ тестов — падения только чужие (дневники/planner/annual-training WIP).
* UI: оба конструктора ~570-612 строк INLINE-стилей, 4-шаговый wizard `params/outside/split/plan`, heatmap по 3-4 метрикам, per-set редактор, годовой, печать.

---

## 2. Аудит — что не дотягивает до PRO

### 2.1 Стронгмен / ТА — 10 пробелов

| # | Пробел | Строки | Почему критично |
|---|--------|--------|-----------------|
| S-1 | **Попытки старта отсутствуют** — ПЛ имеет `competition-attempts`, ТА — нет выбора 6 попыток (3 рывок + 3 толчок) по workMax с тактикой | `strength-sport-builder` | Соревновательный ТА без плана попыток — не PRO |
| S-2 | **WeakPoints — бутафория** — `weakPoints` прокинуты в input но не используются (в отличие от BB/combat) | `strength-sport-builder:88` fallback 없음 | Специализация — ядро PRO |
| S-3 | **IWF категории устарели** — `55/61/67…109` (2018-24), с 2025 IWF новые 60/65/71/79/88/94/110/110+ и 48/53/58/63/69/77/86/86+ | `strength-sport-finalize:23` | Неверный Sinclair/категория = неверный тотал |
| S-4 | **Нет весогонки** — у combat есть `weight-cut.engine` ISSN, у стронга/ТА — ноль, хотя вес.кат. критична | — | Дыра для легковесов |
| S-5 | **Outside frequencyPenalty не применяется** — вычисляется но в билдере не режет частоту (только volumeMultiplier) | `outside-load:88` vs `builder:395` | При 5× поле + 6× зал — перетрен |
| S-6 | **Мобильность/травмы — упрощены** — `filterByMobility` один файл, нет axialLoad/graded-капа как в BB `bb-mobility/bb-finalize:gradedMuscles` | `strength-sport-mobility` | Присед с ankle-травмой всё равно в плане |
| S-7 | **VBT/ACWR — только скаляры** — `velocityLossPct:number` и `acwr:{ratio,zone}` из пропсов, нет `vbt.engine` истории скоростей | `strength-sport.types:70` | Нет авто-стоп сета по 20% loss |
| S-8 | **Equipment-корреляция отсутствует** — йок ↔ farmer ↔ тяга, но нет связи log vs axle (разный %ПМ) и замены с потерей интенсивности | `STRONG_FALLBACK` | Йок без йока → farmer, но вес не пересчитан |
| S-9 | **Дневник — примитив** — `diaryTrend[4 лифта]` по 28д e1RM, без per-exercise `buildLastResultIndex` как в `bb/lms-progression-feedback` | `StrengthSportConstructor:137-167` | Прогрессия слепая к реальным сетам |
| S-10| **Годовой не связан с `annual-training`** — `he_strength_annual_v1` изолирован, нет `composeAnnualProgram` hybrid как у BB | `strength-sport-annual` | Годовой не попадает в печать года |

### 2.2 Единоборства — 10 пробелов

| # | Пробел | Строки | Почему критично |
|---|--------|--------|-----------------|
| C-1 | **Спарринг-интенсивность неразличена** — `outsideLoad` единый `avgSRPE 7.5`, нет `sparring hard 9 / technical 5 / wrestling 8` | `outside-load:139` + `combat-builder:221` | Hard-спарринг = ЦНС-удар, нужен отдельный `sparringLoad` |
| C-2 | **Кондиция отрезана от весов** — `conditioningSessionsForWeek` строится отдельно, не режет `weeklyBudget` и не проверяет интерференцию внутри недели | `combat-builder:388-392` | 2× зала + 2× alactic + внезал 4× = перебор |
| C-3 | **Core — финальный чек, а не план** — `coreWeeklyPlan` существует но не вшивается в `POOL_BY_TAG`; финалка только варнинги `coreAnti <4` | `combat-core:57` vs `combat-builder:324` | 4 функции Boxing Science должны быть обязательны |
| C-4 | **HRV-история хрупка** — `loadHrvHistory` ищет `he_hrv_log`/`he_hrv_history` (несуществующие ключи) → fallback один `morningHRV`; нет EWMA | `combat-monitoring:65-86` | PRO-мониторинг требует тренда 7/28д как у cardio `cardio-diary.engine` |
| C-5 | **Градация травм отсутствует** — `filterByInjuryCB` только `exclude` (вырезает), но `gentleFactorCB 0.6-0.7` дублирует логику вне отбора → инконсистентность | `combat-selection:98` vs `combat-builder:186` | Щадящий режим должен быть как в BB `gradedInjuries` с `repsCap` |
| C-6 | **Весогонка не связана с питанием** — `weightCutNutritionForWeek` считает ккал `P×4+C×4+F×9` но не вызывает `generateMealPlan` (как `bb-contest-prep → meal-plan-generator`) | `combat-weight-cut:59` | Боец не получает меню на fight week |
| C-7 | **Мобильность — 7 ключей, но нет axialLoad** — `lower_back→rdl` не запрещён при грыже | `combat-mobility` | Риск |
| C-8 | **Дисциплинарный акцент груб** — `accentForDiscipline` только `neck/grip/rotational/legs/push` ×1.2, нет стиля (ударник vs борец vs клинчер) | `combat-specialization` | ММА ударник ≠ борец |
| C-9 | **Годовой ATR — без тапера к боям** — `buildAnnualATR 50/30/20` не расставляет taper-блоки перед `competitions[]`, `addCompetitionToAnnual` только красит `fightDate` | `combat-annual:59` | Годовой не планирует пики к датам |
| C-10| **Нет связи с дневником силы** — `combatACWR` считается из `he_srpe_sessions.length` но `combat-mesocycle` не читает per-exercise e1RM | `CombatConstructor:70-84` vs `combat-mesocycle` | Прогрессия слепая к плато хвата/шеи |

### 2.3 Общие (оба + outside-load)

| # | Пробел |
|---|--------|
| G-1 | **Дубли recoveryMult** — 5 строк копипасты в обоих билдерах (`bodyFat/leanMass/hrvMs/sleep/stress → 0.6-1.5`). Нет единого `recovery-budget.engine.ts` как у BB `bb-volume:computeBBNutritionMultiplier`. |
| G-2 | **Женская физиология игнорируется** — `sex` есть, но нет `female ×0.71 Wilks темп`, RED-S пола 1400 ккал, жиры ≥0.8г/кг как в `bb-contest-prep`. |
| G-3 | **Интеграция с питанием/кардио отсутствует** — `combatToNutritionPayload` / `combatToCardioPayload` существуют но не вызываются из UI (карманный `handler 'cardio'` не подключен). |
| G-4 | **Печать годового/плана — примитивна** — combat HTML без стилей/лого, strength HTML таблица без heatmap; нет единого `PrintLayout` как `annual-training-print`. |
| G-5 | **Визуал — inline-стили, нет дизайн-системы** — 600 строк `style={{}}`, нет `SectionCard/StatTile/ChipToggle/GroupHeading` как у `CardioUI.tsx` / `ManualUI.tsx`, нет темной темы, нет a11y `role="progressbar"` / `aria-pressed`. |

---

## 3. План доработки до PRO — по фазам (как у BB/cardio: P0 закрывает дыры, P1 делает PRO, P2 — Pro-Max)

### Фаза P0 — must-fix (2-3 дня, блокер PRO)

**P0-1 СТАРТ-попытки ТА.** Новый `strength-sport-attempts.engine.ts` (порт `lms/competition-attempts.ts`): `snatchAttempts(workMax.snatch, bw, sex) → [91%,96%,100-102%]`, `cleanJerkAttempts` аналогично, Sinclair-прогноз, `buildAttemptRationale`. Используется в `StrengthSportConstructor` шаг `plan` → карточка «🏁 Попытки старта (6)». Тест: `strength-sport-attempts.test.ts` 6 сценариев (три успеха/три провала/E1RM-перекос).

**P0-2 WeakPoints оживить.** В `strength-sport-builder:buildExerciseSets` добавить `weakMultForExercise(id,input.weakPoints)` как в BB `isWeak` → `sets ×1.15` при слабом лифте (squat/clean/snatch/overhead/carry/stone), с капом MRV из `strength-sport-volume`. Спец-частота: если `focus==='squat'` — вторая сессия в неделю получает присед-вариацию. Тест: `weakPoints=['squat']` → squat сетов +2 vs `[]`.

**P0-3 IWF категории 2025.** Обновить `strength-sport-finalize:getIWFCategory` → `M 60/65/71/79/88/94/110/110+`, `F 48/53/58/63/69/77/86/86+` (IWF 2025 bulletin), добавить `getIPFGLCategory` актуальные. Тест: 81кг М → `81` vs `89` раньше — фикс.

**P0-4 Весогонка для ТА/стронга (лайт).** Портировать `combat-weight-cut.engine` → `strength-sport-weight-cut.engine.ts` (упрощённо): `WeightCutProtocol` без carb deplete (для ТА угли не режем так жёстко, только вода/Na), интеграция как у combat. UI — вкладка весогонки при `goal==='peaking'` + вес.кат.

**P0-5 FrequencyPenalty применить.** В `strength-sport-builder` при `outsideFrequencyPenalty(outsideLoad)===1` и `days >=4` → форсить `days=3` + warning + `recommendStrengthSportPattern` с `days-1`. Как у combat `recommendCombatPattern: days>=4&&outside>=4→3`.

**P0-6 Спарринг-слой для combat.** Новый `combat-sparring.engine.ts`: `SparringLoad { hardSpar, techSpar, wrestling } → sparringLoad = hard×90×8 + tech×60×5 + wrest×75×7`, конвертация в `outsideLoad.highIntensityDays` (hard spar = high). UI — 3 слайдера вместо одного SRPE. Миграция `outsideLoad` → `SparringLoad` с fallback.

**P0-7 Град-травмы + axialLoad.** Порт `bb-mobility.engine: isMobilityRestricted + isAxialLoadExercise` → оба движка. `filterPool` проверяет `isMobilityRestricted(id,mobilityRestrictions)` и `avoidAxialLoad && isAxialLoadExercise(id)` (как BB 1.4 фикс). Щадящий — `gradedInjuries` проброс в builder + `gentleFactor` + `repsCap` (как BB 1.3).

### Фаза P1 — PRO-ядро (3-4 дня, делает PRO неотличимым от BB)

**P1-1 Единый recovery-budget.** Новый `src/engines/recovery-budget.engine.ts` (экстракт из BB `computeRecMult/computeNutMult`): `computeRecoveryMultiplier({bodyFat,leanMass,hrvMs,sleepHours,stressLevel})`, `computeNutritionMultiplier({calorieSurplus,proteinPerKg,female})` с RED-S полом female 1400 / male 1200 и `fat≥0.8/0.6`. Оба билдера импортируют, удаляется копипаста. Тест: female 48кг/14% → fat floor 38г.

**P1-2 VBT-движок.** Новый `strength-sport-vbt.engine.ts` + `combat-vbt.engine.ts` (порт `vbt.engine.ts`): `estimate1RMFromVelocity(weight, velocity, exId)` — таблицы `snatch 1.6м/с@60%`, `backSquat 0.3м/с@90%`; `diagnoseVelocityLoss(history) → zone 20%/30%`. Builder переводит `velocityLossPct` в `zone → volume ×0.90 / RIR+1 / stop`. UI — поле «Скорость послед. сета м/с» → бейдж `loss>20%`.

**P1-3 Дневник per-exercise.** Порт `bb-progression-feedback:buildLastResultIndex + epley1RM` → оба: `strengthSportLastResultIndex(sessions)` / `combatLastResultIndex` — лучший e1RM за 28д per lift (snatch/clean/squat/neck/grip). `diaryTrend` строится оттуда, мезоцикл читает его (а не грубый `he_workout_log`). Интеграция: `CombatConstructor:build` читает `loadHrvHistory + lastResultIndex`, как BB `applyFeedbackToBuild`.

**P1-4 Core & кондиция встроены.** `combat-builder` — `coreWeeklyPlan(level,week,phase)` обязателен: в каждый `full_power/lower_power` добавляется 1 anti-ex + 1 rot_power если `coreAnti <4` (сейчас только варнинг). Кондиция режет бюджет: `weeklyBudget -= conditioningMinutes ×0.08` (≈1 сет на 12мин zone2) + интерференция `high → volume×0.92` уже учтена.

**P1-5 Годовой ↔ annual-training.** `strength-sport-annual:buildAnnualWithTaper` теперь помечает `taperWeeks` и вызывает `composeAnnualProgram`-подобную склейку для печати; `combat-annual:buildAnnualATR` расставляет `realization` taper-блоки 2нед перед каждой `competitions[i].date` (аналог `taperWeeksForBlock` в `annual-training/block-builders: taper внутри блока`). Хук `onProfileSectionChange('goals')` → пересбор годового без ручной кнопки.

**P1-6 Интеграция питание/кардио.** Пробросить `combatToNutritionPayload` → `IndividualPlanContext` слушатель `he-combat-updated` (как BB `he-bb-contest-prep-updated`); аналогично `strength → he-strength-updated`. Кардио — `combatToCardioPayload(weeklyLoad)` → `buildCardioCycle` при `outsideSessions <3` (добавить zone2 1×).

### Фаза P2 — Pro-Max (2-3 дня, отрыв от любительского)

**P2-1 PED дисциплинарная тонкость.** `combat-ped-adaptation` уже cap 1.32-1.45 — добавить `weight_cut` cap 1.18 (дефицит съедает PED-выгоду) и `IGF+GH синергию` 0.90 (как в `tz-spec`). `strength-sport-ped` — cap 1.70 для heavy, 1.35 для weightCut.

**P2-2 Equipment-интеллект.** `strength-sport-selection:STRONG_FALLBACK` BFS уже есть — добавить пересчёт веса: `yoke 200кг → farmers 2×60кг (≈0.6)` с комментарием `"(замена йока: вес скорректирован ×0.6)"`. `combat: sled/pallof` аналогично.

**P2-3 Женская спецуха.** Порт `bb-demographics:femaleAdjust` → `combat-female.engine.ts` (`neck×0.7` защита, хват×0.8) + `strength-female` (`overhead×0.85`, `carry×0.9`). RED-S примечания как в BB `female ≥1400ккал`.

**P2-4 Стиль боя.** `combat-specialization` расширить: `fightStyle: striker|grappler|hybrid` — `striker → rotational +1 сет`, `grappler → neck/grip +1`, `hybrid → баланс`. UI — чип-селектор под дисциплиной.

**P2-5 Печать Pro.** Единый `PrintLayout` (порт `annual-training-print.html`): шапка с лого, таблица недель с цветами фаз, heatmap MEV/MRV, Gantt-полоска годового, QR-код `#combat-hash`. XSS-esc, стили для `window.print`.

### Фаза P3 — polish (1-2 дня)

* XLSX с форматированием (как у BB `buildBbXlsx`), telegram `buildCombatTelegramUrl`, share-hash base64-url-safe.
* HRV EWMA (как `cardio-diary: cardioHrvReport`) вместо mean±SD.
* Миграция `he_combat_plan_v1` → `v3` с `fightStyle/sparringLoad`.
* E2E-тест: `discipline=mma + hardSpar 3× + weightCut 4кг + fightDate 4нед → weeklyBudget < базового, conditioning 0, coreAnti ≥4`.

---

## 4. Визуальный план — две дисциплины, единый дизайн-язык

### 4.1 Принцип: изолированные конструкторы, но общий UI-слой

Сейчас оба конструктора — 600 строк INLINE-стилей без системы. По модели кардио ( `CardioUI.tsx` 250 строк + `ManualUI.tsx` 400 строк) — создаём:

* **`src/ui/screens/combat/CombatUI.tsx`** — токены + примитивы для единоборств (фиолетовая ветка `#a855f7` / `#7c3aed`, акцент `#ec4899` для fight)
* **`src/ui/screens/strength-sport/StrengthUI.tsx`** — для стронга/ТА (зелёно-янтарная ветка `#00e68a` / `#f59e0b` для strongman / `#3b82f6` для ТА)
* Оба наследуют базу `TrainingScreen_parts/shared.ts` + `hapticImpact`.

Токены:

```ts
// CombatUI / StrengthUI — shared tokens
export const CARD = 'rgba(255,255,255,0.04)'; // фон карточки
export const CARD_ACCENT = (accent: string) => `${accent}14`; // 14 hex = 8% opacity
export const ROW = { display: 'flex', gap: 6, alignItems: 'center' } as const;
export const LABEL = { color: '#fff', fontSize: 11, fontWeight: 700 } as const;
export const HINT = { color: '#fff', opacity: 0.55, fontSize: 9 } as const;
export const BTN = { padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: '#fff' } as const;
export const BTN_PRIMARY = (accent: string) => ({ ...BTN, background: accent, color: accent==='#00e68a'?'#000':'#fff', fontWeight: 800, border: `1px solid ${accent}` }) as const;
export const CHIP = { padding: '4px 8px', borderRadius: 20, fontSize: 10, border: '1px solid rgba(255,255,255,0.1)' } as const;
export const CHIP_ACTIVE = (accent: string) => ({ ...CHIP, background: `${accent}22`, border: `1px solid ${accent}66`, color: accent }) as const;
export const PHASE_COLOR: Record<string,string> = {
  accumulation:'#3b82f6', transmutation:'#a855f7', realization:'#ef4444', gpp:'#60a5fa', power:'#a855f7', taper:'#f59e0b', deload:'#f59e0b', conjugate:'#ec4899',
  snatch_day:'#00e68a', clean_day:'#3b82f6', strength_day:'#f59e0b', event_day:'#ef4444', oly_day:'#a78bfa',
};
```

Компоненты (как в CardioUI): `SectionCard({title, icon, accent, children})`, `StatTile({label,value,unit,color})`, `ChipToggle`, `GroupHeading`, `InfoBanner({tone, children})`, `NumberInput`, `ProgressBar({value,max,color})`, `HeatCell`, `GanttBar`.

### 4.2 Layout — 4 шага (единый для обоих, как сейчас)

1. **Params** — профиль + цель/уровень/недели/дни + периодизация + fight/пик + workMax + методика/DUP/интенсивность + весогонка + оборудование/мобильность/травмы + `Подтянуть из профиля`.
2. **Outside** — внезальная декларация (для combat — Sparring-слайдеры hard/tech/wrest + highDays чипсы Пн-Вс; для strength — sessions/duration/RPE). Live `weeklyLoad → volumeMultiplier` с цветным бейджем.
3. **Split** — карточки сплитов с `preview` недельной ротацией (моноширинный `тренировка·отд`), рекомендуемый подсвечен, клик — выбор + ATR/linear превью.
4. **Plan** — отчёт + heatmap (4 ряда) + недельные карточки (фаза/дни/упражнения с per-set редактором) + годовой Gantt + экспорт.

**Шапка конструктора** (как у Cardio `CardioConstructor: header` + `ManualUI: ManualHeader`):

* Заголовок + подзаголовок дисциплины (`🥊 ММА · ATR 5/3/2 · 3× зал / 5× татами` или `🏋️ ТА · Torokhtiy 3/3/3/1 · 3× зал`)
* Чипы сводки: `Недель · Сетов/нед · Тоннаж · Годовой` (как `cardioCycleSummary`)
* ACWR/VBT/HRV бейджи (цветные: optimal `#10b981` / caution `#eab308` / dangerous `#ef4444`)
* Прогресс-бар мастера `Step N/4 — {label}` + `Далее: {след. шаг} →` (как `CardioConstructor`).

### 4.3 Combat — визуальный образ

* **Палитра:** фон `#0a0a0a` + радиальные градиенты `rgba(168,85,247,0.08)` / `rgba(236,72,153,0.06)` (фиолетово-розовый, как сейчас в planning). Акцент дисциплины: `boxing #3b82f6 / mma #a855f7 / wrestling #ef4444 / kickboxing #f59e0b / general #6b7280`. Фаза: как PHASE_COLOR выше.
* **Иконография:** `🥊 Бокс / 🥋 ММА / 🤼 Борьба / 🦵 Кик / 🛡️ Общая`, цель `💥 Взрыв / 🔥 Вынослив. / 🛡️ Поддерж. / 🏁 Кэмп / ⚖️ Весогонка`.
* **Карточки недели:** левая полоса цвета фазы (4px), бейджи `тяж/памп/лёг` + `тапер/делод` + конфликт `⚠ внезальная`, heat-strip шея/хват/core (цвет по MEV/MRV: below `#f59e0b` / optimal `#a855f7` / high `#eab308` / over `#ef4444`).
* **Кондиция:** отдельный блок `🌊 Кондиция (alactic/lactic/aerobic)` с интервалами `8×10с/50с` и HR-зоной, скрывается при `outside≥5×`.
* **Весогонка:** янтарная карточка `⚖️ Весогонка ISSN 2025` с протоколом `вода/Na/угли/сауна` + рефид-предупреждение `125-150%` (красный).
* **Годовой ATR:** горизонтальный bar `Gantt` (как у combat уже есть, но улучшить): сегменты 5/3/2 + transition 2нед (янтарь), маркеры боёв `🏁`, шкала недель `Нед 1 — 52`, клик — выбор блока.

### 4.4 Strength-sport — визуальный образ

* **Палитра:** `WL #00e68a` (изумруд, как сейчас), `Strongman #f59e0b` (янтарь), `Hybrid #3b82f6` (синий). Градиенты `rgba(0,230,138,0.10)` / `rgba(245,158,11,0.08)`. Фаза: `accumulation #3b82f6 / intensification #f59e0b / peaking #ef4444 / deload #a1a1aa`.
* **Иконография:** `🏋️ ТА / 🪨 Стронг / 🔀 Гибрид`, цель `🏆 Сила / 💪 Масса / 🎯 Техника / 🏁 Пик / 🛡️ Поддерж.`, лифты `рывок/толчок/присед/лог/фермер/йок/камни` с эмодзи `⚡️/🏋️/🦵/🪵/🚜/🏗️/🪨`.
* **Карточки недели:** аналогично combat, но heatmap `рывок/толчок/присед/carry` (4 ряда, как сейчас), тоннаж `т`, лифты `★ соревн.` бейдж.
* **Тейпер:** синяя подводка `тапер ×0.55` + дата старта `🏁 Пик: 12.09`.
* **Sinclair/DOTS:** бейдж в отчёте `Вес 81кг кат. 81 · Тотал 190кг · Sinclair 228 · DOTS 312`.

### 4.5 Shared interactions (оба)

* **Sticky header** с `progress + чипсы + Step N/4` (как `CardioConstructor` / `BbAutoConstructor`).
* **Per-set редактор** — инпуты вес/повторы/RIR per set (как `StrengthSportConstructor: updateSet`), ↑↓ порядок, `Копировать неделю` → clipboard + toast.
* **Heatmap-легенда** — 4 уровня `ниже MEV / оптимум MEV-MAV / высоко MA V-MRV / перебор >MRV` с цветами + tooltip `cur/lm`.
* **Gantt годового** — `height 14px, borderRadius 6, сегменты % ширины`, tooltip `phase · weeks`.
* **Экспорт-панель** — `Копировать отчёт / 🖨 Печать HTML / 📊 CSV / 📅 ICS / ✈ Telegram / Экспорт в программу` (как сейчас, но кнопки в `SectionCard` с иконками, а не флекс-куча).
* **Валидация** — варнинги `⚠` янтарные, errors красные, `InfoBanner` для outside-конфликта, `Badge` для ACWR/VBT.

### 4.6 Печать / PDF / ICS

* **HTML-шаблон** — единый `PrintLayout`: шапка (лого + заголовок `🥊 ММА 6нед · ATR`), таблица недель (фаза/день/упражнение/сеты×повт/вес/RIR/темп/отдых), heatmap-сводка, Gantt годового, rationale + warnings. CSS `@media print` + `window.print()` (как `CardioPrintHtml` / `BbPrintHtml`).
* **CSV** — `;` для Excel RU, BOM `\uFEFF`, колонки как сейчас + `phase/character/methodology`.
* **ICS** — `VCALENDAR 2.0` с `VEVENT` per session (DTSTAMP/DTSTART/DTEND/SUMMARY/DESCRIPTION с XSS-esc), годовой отдельный.

### 4.7 Accessibility & mobile

* `role="progressbar"` для Gantt/heatmap, `aria-pressed` для ChipToggle, `aria-label` для ↑↓, `tabIndex` для карточек сплитов.
* `min-height 44px` для тач (как `ManualUI`), `grid 1fr` на `max-width:480px`, `font-size 16px` для iOS anti-zoom.
* Клавиатура: `Enter/Space` выбор сплита, `Arrow Up/Down` порядок упражнений (как `PeriodizationDesignerTab`).

---

## 5. Дорожная карта внедрения

| Фаза | Задачи | Файлы | Тесты | Срок |
|------|--------|-------|-------|------|
| **P0** | S-1…S-5, C-1,C-5-C-7 (п.3) | `*-attempts`, `*-weight-cut`, `recovery-budget`, `combat-sparring`, `*-mobility` + builder патчи | +18 (attempts 6, weak 3, IWF 2, sparring 4, mobility 3) | 2-3д |
| **P1** | P1-1…P1-6 | `recovery-budget`, `*-vbt`, `*-last-index`, `combat-core integrate`, `annual` | +22 (VBT 6, lastIndex 4, core 3, annual 4, nutrition/cardio 5) | 3-4д |
| **P2** | P2-1…P2-5 | PED cap, equipment weight, female, fightStyle, print | +10 (PED 3, equip 2, female 2, style 3) | 2-3д |
| **UI-1** | `CombatUI` + `StrengthUI` токены/примитивы + header/stepper | `CombatUI.tsx`, `StrengthUI.tsx` | 0 (SSR) | 1д |
| **UI-2** | Перевод обоих конструкторов на UI-слой (SectionCard/Heatmap/Gantt) | `CombatConstructor.tsx`, `StrengthSportConstructor.tsx` | 6 (SSR: шапка/progressbar/heatmap/выбор сплита/печать) | 2д |
| **UI-3** | Print/ICS polish + Annual Gantt интерактив | `*-print.engine`, `*-annual` + constructors | 4 (XSS, ICS, Gantt) | 1д |
| **P3** | XLSX, HRV EWMA, миграция v3, E2E | `*-export`, `combat-monitoring` | +6 | 1-2д |

Итого: движок 50 тестов + UI 10 тестов = **+60** (с 553 → **≈613**). `tsc 0`, `vite build OK`.

### Критерии приёмки (как у BB `0 overflow / 0 unbalanced`)

* **Стронг+ТА:** `wl_3/4/5/6 + sm_2/3/4 + hyb_3/4` × 4 уровня × 3 цели × outside 0/5× — 0 `>MRV`, 0 `sets≠workSets`, 0 `>cap6`, Sinclair/DOTS совпадает с IWF калькулятором ±1, попытки 91/96/100% весов.
* **Combat:** `mma/boxing/wrestling` × `power/camp/weight_cut` × 2-4д — шея ≥ MEV всегда, coreAnti ≥4, weightCut объём ×0.65 fight week, кондиция + зал ≤ бюджета, outside highDays без тяж ног накануне.
* **Годовой:** 52нед ATR 26/16/10 → sum 52, бои-таперы на месте, ICS валиден (validator.icalendar.org).

---

## 6. Файлы-маяки (куда смотреть)

* **Движки:** `src/engines/combat/combat-builder.engine.ts:218` / `combat-finalize:39` / `combat-periodization:51` / `combat-weight-cut:24` / `combat-conditioning:45` / `combat-monitoring:9` / `combat-core:57`
* **Стронг:** `strength-sport-builder:379` / `strength-sport-finalize:42` / `strength-sport-progression:66` / `strength-sport-volume:9` / `strength-sport-loading:19` / `strength-sport-annual:22`
* **UI:** `src/ui/screens/combat/CombatConstructor.tsx` / `src/ui/screens/strength-sport/StrengthSportConstructor.tsx` (сейчас 600 строк inline — цель 300 строк + UI-слой)
* **Интеграция:** `src/ui/screens/TrainingScreen_parts/nav.ts:82` `PLANNER_MODES` / `src/engines/outside-load.engine.ts:70` / `src/engines/annual-training/*` (образец для годового)
* **Образцы качества:** `src/ui/screens/TrainingScreen_parts/CardioUI.tsx` / `ManualUI.tsx` / `src/engines/bb/bb-finalize.engine.ts` / `src/engines/lms/competition-attempts.ts` / `src/engines/bb/bb-contest-prep.engine.ts`

---

## 7. Риски и ограничения

* **Изоляция ≠ дублирование навсегда** — recovery/VBT/PED/IPF уже дублируются. P1-1/P2-1 частично унифицируют через `recovery-budget.engine` — без ломки изоляции (импорт только утилиты, не ББ-логики).
* **Весогонка — медицинский риск.** `validateWeightCutProtocol >8кг / >1.5кг/нед` уже есть — добавить баннер `«Требуется врач»` и не применять `load_cut` без `confirmedManipulation` (как в BB `bb-contest-prep:confirmedManipulation`).
* **HRV-данные скудны** — у 90% пользователей нет истории `he_hrv_log`. Fallback `одно значение → оптимально` — честно, но не PRO. Решение: интеграция с `he_profile_v2.lifestyle.morningHRV` + `diary` (уже есть fallback, но EWMA даст стабильность).
* **Печать — без xlsx-зависимости.** Решение как сейчас: CSV + HTML + `window.print` → PDF, xlsx отдельно по запросу (как у BB `bb-xlsx`).

---

*План готов к исполнению. Следующий шаг — P0 ветка `feat/combat-strength-p0` (S-1 + C-1 + G-1 + CombatUI/StrengthUI токены).*
