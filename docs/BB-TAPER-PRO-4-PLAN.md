# ББ-тапер PRO-4 — доведение до «реально про уровня»

> **Статус: ВЫПОЛНЕН** (план + полная реализация одним заходом). База: HEAD `da673b680`,
> финал — коммиты `61e9779d`…`588b61b4` (таблица §7). Без пуша (очередь чужих WIP).
> Предшественники: PRO (Э0–Э9), PRO-2 (P1–P7 + доводки), PRO-3 (Э1–Э12 + добойка), PRO-3.1
> (оживления addPrepWeeks/addPeakPriming/loadContestPrepConfig, удаление мёртвых обёрток).
> Цель PRO-4 — превратить тапер из «планировщика» в **ежедневный инструмент ведения
> пик-недели**: монитор решений, часовое расписание, экстренные протоколы, серия шоу,
> женский контур, коуч-рекомендации, постемеры. Движки/строки существующих контуров —
> байт-в-байт, если новые данные не заполнены.

---

## §1. Аудит по коду

### Что уже есть (сильная база, не переделываем)
- Единый `BBContestPrepPlan` (v2): подготовка → финальная → taper → пик-неделя → post-show,
  safety-гейты (high-water lock, contraindications), frozenWeeks, adjustments history.
- `buildPeakWeek` (7 дней: ккал/БЖУ/вода/Na/K/клетчатка/тренировка/позы), `buildShowTimeline`
  (шоу-день по часам), trial peak week (10 записей), `liveAdjustForPeakDay`, `recarbDaysForPlan`
  (живые цели рациона), refeed/diet-breaks, `prepWeightAdvice`, post-show 12-нед кривая,
  `prepTrainingCompliance`, экспорт HTML/ICS/JSON/CSV, `buildPrepIcs`, печать prep-сводки.
- Хранение: `goals.bbContestPrepPlan` + `bbPeakConfig` + событие `he-bb-contest-prep-updated`;
  логи: недельные чек-ины, пост-шоу лог, чек-лист шоу, test-peak, позинг (Prep-цикл).

### Разрывы (D1–D10)

| # | Разрыв | Доказательство (file:line) |
|---|--------|---------------------------|
| **D1** | **Overlay-путь не ставит `contestPhase`**: `applyTrainingTaperToBBPlan` пишет `phase='peaking'`/`taper`/`prepProtocol`, но НЕ `wk.contestPhase`. SRCBB/Macrocycle/PeakingPanel-пути дают планы, где: UI-таблица тапера пуста (фильтр по `contestPhase`), plan-quality не видит taper, `isMonotonicTaper` тривиален, finalize-гарды держатся только на `prepProtocol` | engine `1743–1747`; потребители: `bb-contest-prep-sections.tsx:429`, `plan-quality.engine.ts:668`, `engine:3204`, `bb-finalize.engine.ts:3156/3175` |
| **D2** | **Нет ежедневного монитора пик-недели** (D-6…D-0): вес/вода/Na/углеводы факт vs план, визуал (flat/full/spill), самочувствие, тренд. Есть только одна точка `peakWeek.visualAdjust` и недельные чек-ины | `BBContestPrepPlan.peakWeek.visualAdjust` (2285); чек-ины — `he_prep_week_checkins_v1` (недельные) |
| **D3** | **Нет часового расписания дня пик-недели**: `buildShowTimeline` — только шоу-день; D-6…D-1 существуют как макро-дни без тайминга приёмов/воды/поз | `buildShowTimeline` (1240); `buildPeakWeek` (979) — без часов |
| **D4** | **Нет экстренной карточки шоу-дня**: только строки-предупреждения, нет actionable-протокола (гипогликемия/гипонатриемия/судороги/обморок/спутанность) и хранения контактов | `engine:1188`, `bb-prep-process.engine.ts:140` |
| **D5** | **Мульти-шоу не подключён**: `planTwoShowSequence` (overreach-неделя) и `coordinateLastHeavyDay` — 0 продуктовых потребителей; `ContestEventEntry[]` редактируется, но серия из двух шоу не планируется/не показывается | `engine:1403`, `engine:1333` (test-only) |
| **D6** | **Женский пик-контур статичен**: `isLutealPhase` лишь поднимает полы; `prepNutritionSignals` — только в печати; цикл-лог `he_cycle_log` (планировщик) в подготовку не заведён — нет трактовки «вес в дни задержки ≠ жир», нет предупреждений «шоу в лютеиновой/в дни менструации» | `isLutealPhase` (442), `prepNutritionSignals` (3592, печать), `planner-cycle-calendar.ts:18` |
| **D7** | **Коуч-контур односторонний**: `recommendBBShowConfig` (авто-патч безопасных дефолтов) — 0 UI; `peakWeekLastHardRest` — маркер без читателя | `bb-show-coach.engine.ts:162`; `engine:1615` |
| **D8** | **Пост-шоу кривая без фидбэка**: `postShowRecoveryDiet`/`activePostShowCurve` — формула; нет сравнения факт-веса с кривой (статус on_track/faster/slower + совет) | `engine:3519/3540` |
| **D9** | **Лабы без дат**: `PREP_LAB_PANEL` — статичный чек-лист; нет «дата последних анализов» → статуса просрочки к фазе шоу | `bb-prep-process.engine.ts:123` |
| **D10** | **Мёртвый код**: `peakTrainingProfile`/`PeakTrainingProfile`/`POSING_PROFILES` (bb-prep-cycle), `isKnownPrepCategory` (bb-prep-splits), `PREP_POST_SHOW` (bb-prep-process) — 0 ссылок в src (вкл. тесты) | audit-скан |

Осознанно вне раунда: консолидация ~7 рендеров пик-недели (риск UI-регрессий при живых
параллельных правках), двусторонний коуч-редактор (вне scope приложения), CV-анализ фото.

---

## §2. Интернет-синтез 2024–2026

- **Homer 2024** (Sports Med Open 10:8, PMC10787737): доказательная база CHO-манипуляций
  слабая; Escalante-рекомендация — практиковать загрузку ДО пик-недели (trial) либо держать
  воду/натрий **стабильно**; ICW/ECW-сдвиги нестабильны, а рестрикция воды/натрия может
  ухудшить внешний вид.
- **Escalante 2021** (PMC8201693): карб-бюджет 8–12 г/кг TOTAL за 36–48 ч (не «в день»);
  триал-прогоны — обязательный элемент; документированные риск-кейсы обвалов воды/натрия.
- **PMC11251432 (2024, n=160)**: практика — back loading 45%, water restriction/loading ~40%,
  sodium load/restrict 26%/16%; ассоциаций с характеристиками спортсмена почти нет → «делай
  как тестировал».
- **PMC9321665 (кейс-серия)**: понедельные данные D-7…D-0 (ккал 30–50/кг, вода до ~140 мл/кг
  на загрузке); вода/натрий в большей части недели **стабильны**.
- **Практика 2025–2026** (MyProtein/BellyProof-обзоры): гликоген связывает 2.7–3 г воды/г;
  «прощающий» коридор загрузки 8–10 г/кг за 36–48 ч; вода **не до нуля**, мониторить цвет
  мочи; натрий снижать ≤30% за 48 ч (не обвал); утро шоу — maintenance-углеводы, не загрузка.
- **Женщины**: Carmichael 2021 — общая вода тела ↑ от фолликулярной к лютеиновой; White 2011 —
  пик субъективной задержки — **первый день менструации**, не мид-лютеал; Sci Rep 2026 —
  сила-полуприсед: пик late-follicular/овуляция, минимум late-luteal; PMC12413752 (2025) —
  57% женщин-бодибилдеров в подготовке имеют олиго-/аменорею → цикл надо **логировать** и
  учитывать в трактовке веса.
- **Post-contest** (scoping review PMC9364707): пошаговое восстановление ~+1% массы/нед;
  refeed-стратегии не отменяют метаболические эффекты дефицита — фидбэк по факту обязателен.

**Выводы в движок**: (а) пик-неделя — ежедневные решения по тренду (не по одной точке);
(б) вода/Na не до нуля, floor-ы сохраняются; (в) trial + мониторинг — обязательные слои;
(г) женский вес в лютеал/менструацию трактуется по 7-дневному среднему (вода ≠ жир).

---

## §3. Эпики PRO-4

Новый про-слой: **`src/engines/bb/bb-peak-pro.engine.ts`** (чистый, storage-agnostic ядро +
CRUD-хелперы по прецеденту `bb-prep-weekly-log`). UI: **`src/ui/components/contest-prep/PeakWeekProCard.tsx`**.

### Э1. D1 — контур фаз в overlay-пути (P0)
- `applyTrainingTaperToBBPlan`: taper-недели получают `wk.contestPhase='taper'` (вкл. делод-скип),
  пик-неделя — `'peak_week'`; legacy-пик (`peakWeek===true` без маркера) нормализуется до
  единого формата (паритет с `applyPeakWeekOverlayToBBPlan`).
- Критерий: план SRCBB-пути → таблица тапера (`sections:429`) непуста; `plan-quality` видит
  taper; `isMonotonicTaper` считает реальные недели; идемпотентность сохранена.

### Э2. D2 — ежедневный монитор пик-недели (P1)
- `PeakDayEntry` (план-ид, дата, вес, вода л, Na мг, углеводы г, визуал flat/ontrack/full/spill,
  самочувствие 1–5, заметка, at) + CRUD: `loadPeakWeekLog/savePeakWeekEntry/removePeakWeekEntry`
  (ключ `he_prep_peak_days_v1`, кап 14/план, санитизация, битый стор → `{}`).
- `peakDayForDate(plan, date)` → `{ dayIndex, phaseKey, label 'D-N', isShow }`.
- `peakWeekAdherence(plan, entries)` — по дням: план-цель vs факт (вода/Na/углеводы), флаги
  (`under_water` <70%, `over_sodium` >150%, `under_carbs`) + итоговая адгеренс %.
- `peakWeekWeightTrace(entries)` — дельты по дням, итог, ожидание гликоген-воды на load
  (+0.5–1.5%), флаг просадки >1.5%/день в загрузке (недолив/недоед).
- `peakWeekTrendAdvice(entries, plan)` — серии визуалов (2+ flat → добавить углеводы/воду;
  spill → урезать остаток загрузки/Na; mix → по 7-дневному среднему) + честные «нет данных».
- `PEAK_MONITOR_DISCLAIMER` (решения по тренду, вода — не жир, stable-дефолт).
- UI: карточка «📓 Монитор пик-недели» (ввод сегодня: вес/вода/Na/углеводы + чипы визуала +
  самочувствие; история 7 строк с точками визуала и % адгеренс) — монтируется в шаг contest
  (TrialSafety) и в «🏁 Тапер» (PeakWeekTab).
- Печать: `buildContestPrepPrintHtml(plan, extras?)` += строка монитора (без extras —
  байт-в-байт).

### Э3. D3 — часовое расписание дня пик-недели (P1)
- `buildPeakDayTimeline(day: PeakWeekDayPlan, opts?)` — детерминированные часы: подъём 7:00,
  6 приёмов каждые ~2.5 ч (первый 7:30), вода распределена по дню (последний приём воды —
  не позже 21:00), Na с приёмами, тренировка/позы из дня, сон; на день шоу — отсылка к
  `buildShowTimeline`. Плюс предупреждения (вода <2 л в load-день и т.п. — честные строки).
- UI: collapsible «⏱ День по часам (D-N)» внутри карточки монитора.

### Э4. D4 — экстренная карточка шоу-дня (P0-safety)
- `SHOW_DAY_EMERGENCY` — 6 сценариев (гипогликемия; гипонатриемия: головная боль/тошнота/
  спутанность; судороги; обморок/предобморок; отёк/одышка; боль в груди/аритмия) → «что
  делать / что НЕ делать / когда к врачу». Все — harm-reduction, без доз препаратов.
- Персист контакта: `loadEmergencyContact/saveEmergencyContact` (`he_prep_emergency_v1`:
  имя+телефон, санитизация, пустое → null).
- UI: `ShowDayEmergencyCard` (сворачиваемая, красная кромка) + контакт-инпут + печать
  (extras `emergency`).

### Э5. D5 — серия шоу (multi-show) + last-heavy (P1)
- `showSequencePlan(shows: {id,name,date?,priority}[], opts?)` — чистая: сортировка по дате,
  окна taper (2/3 нед из cfg) и пик-неделя на каждое шоу, overreach-неделя перед основным
  тапером, предупреждения (два A-шоу; окно <4 нед между шоу; второе шоу — только
  conservative/trial-проверенные моды).
- UI в редакторе соревнований (`BbContestPrepParams`): блок «Серия шоу» — превью окон + кнопка
  «⚡ Overreach к основному шоу» (применяет `planTwoShowSequence` к собранному плану, честный
  flash), + «Применить пик-неделю ко 2-му шоу (нед N)» через существующий overlay.
- `coordinateLastHeavyDay` → строка «🏋️ Последняя тяжёлая: нед N, сессия M · X сетов» в таблице
  taper-недель (Preview) и в печати-prep (строка, без смены вида без данных).

### Э6. D6 — женский пик-контур (P1)
- `femalePeakGuidance(plan, opts?: { cycleDay?, showDate? })` — заметки:
  лютеал (+0.5–1 кг воды — норма; решения по 7-дн среднему), дни менструации 1–2 (энергия/сон —
  запас времени на шоу-день), трекинг цикла (`he_cycle_log`), BIA/калипер-оговорка, ферритин
  из `prepNutritionSignals`, запрет на «догон» водой при задержке.
- UI: `FemalePeakCard` (только female) рядом с RED-S-блоком; показывает текущую фазу цикла из
  `he_cycle_log` (средняя длина), предупреждение если шоу попадает в лютеал/менструацию.
- Печать: строка female в extras.

### Э7. D7 — коуч-контур (P1)
- `coachVerdictForPlan(plan, ctx)` обёртка не нужна — используем существующие
  `scoreBBShowPrep`/`recommendBBShowConfig`; UI-карточка «🧭 Коуч-проверка» в TrialSafety:
  score/лейбл/топ-3 заметки + чип-патч `recommendBBShowConfig` и кнопка «Применить» (патч
  через `saveContestPrepEverywhere`).
- `peakWeekLastHardRest`: бейдж «🛌 Без тяжёлого (последняя тяжёлая D-N)» в неделе тапера
  (Preview) если маркер есть.

### Э8. D8 — пост-шоу фидбэк (P2)
- `postShowRecoveryProgress(plan, weightLog)` — факт vs `activePostShowCurve` (recovery/reverse):
  недельный индекс по дате после шоу, целевой коридор, статус on_track/faster/slower,
  совет (faster → удержать; slower → проверить adherence/сон; missing → записывать вес).
- UI: строка статуса в post-show блоке (Post) рядом с кривой.

### Э9. D9 — лабы-чекпоинт (P2)
- `prepLabCheckpoint(showDate, lastLabDateIso?)` — фазовые дедлайны от даты шоу (база ≤ −10 нед,
  середина ~ −6…−4, финал ~ −3…−1, пост-шоу +2–4 нед) → строки со статусами
  ok/soon/overdue/no_data; при `lastLabDate` свежее дедлайна — «сдано d.mm».
- UI: в карточке «🩺 Мед-процесс» — инпут «Дата последних анализов» (персист
  `he_prep_labs_v1` по planId) + строки статусов.

### Э10. D10 — гигиена мёртвого кода (P2)
- Удалить (0 ссылок, проверено grep): `peakTrainingProfile`/`PeakTrainingProfile`/
  `POSING_PROFILES` (bb-prep-cycle.engine.ts), `isKnownPrepCategory` (bb-prep-splits.ts),
  `PREP_POST_SHOW` (bb-prep-process.engine.ts). Тестированные engine-API (coordinateLastHeavyDay,
  planTwoShowSequence и др.) — НЕ удалять (оживляем в Э5/Э7).

---

## §4. Тесты

| Файл | Содержание |
|------|-----------|
| `bb-taper-pro4-e1.test.ts` | D1: taper/peak недели несут contestPhase; идемпотентность; legacy-нормализация; overlay без пика (weekNumber); `isMonotonicTaper` на path |
| `bb-peak-pro.test.ts` | Э2–Э6, Э8, Э9: монитор (CRUD/санитизация/адгеренс/вес-трейс/советы/дисклеймер), таймлайн (часы/вода/детерминизм/show), emergency (6 сценариев/контакт/XSS), sequence (окна/предупреждения/сортировка), female (лютеал/менструация/no data), post-show progress (статусы), labs (статусы/даты/no_data) |
| `peak-week-pro-ui.test.tsx` | UI: монитор карточка (запись сегодня → история), таймлайн раскрытие, emergency + контакт persist, коуч-карточка, series-блок, female (только female), labs-инпут persist, `data-bb`-хуки, печать-extras (XSS) |
| `bb-taper-pro4-hygiene.test.ts` | Э10: удалённые экспорты отсутствуют; живые API (planTwoShowSequence/coordinateLastHeavyDay) на месте |

Прогоны: taper-семья (bb-contest-prep*, bb-taper-*, bb-peak-week-strategy, bb-prep-*,
bb-show-coach, training-focus-and-taper) + UI-семья (peak-week-tab-smoke, bb-contest-prep-card,
peaking-panel-bb-coach, bb-auto-*, bb-quality*) + `tsc --noEmit` по всему проекту.

## §5. Осознанно НЕ делаем
- Диуретики/фарма-протоколы и дозы — harm-reduction (остаётся запретом).
- Обвал воды/натрия до нуля — floor-ы и stable-дефолт сохраняются.
- Авто-снижение калорий без решения пользователя (политика PRO-3).
- CV-анализ шоу-фото; облачный коуч-редактор; консолидация 7 рендеров пик-недели (риск).

## §6. Порядок
Э1 → Э2/Э3 → Э4 → Э5 → Э6 → Э7 → Э8 → Э9 → Э10. Коммиты строго pathspec своих файлов;
AGENTS-запись — в конце. Без пуша (очередь чужих WIP).

## §7. Выполнение (коммиты и факты)

| Коммит | Что |
|---|---|
| `61e9779d` | план (этот документ) |
| `b272ca34` | **Э1** D1-фикс: `applyTrainingTaperToBBPlan` ставит `contestPhase` (taper/peak_week) + legacy-нормализация; **бонус-фикс идемпотентности**: пик-конверсия хранит базу в `peakWeekBase` (force-пересборка больше не даёт ×0.6/×0.8 повторно). Тесты +7 |
| `8e81fce3` | **Э2–Э6/Э8/Э9 движок**: NEW `bb-peak-pro.engine` — монитор (CRUD `he_prep_peak_days_v1`/кап 14, адгеренс с флагами, вес-трейс, тренд-советы), `buildPeakDayTimeline`, `SHOW_DAY_EMERGENCY` (6 сценариев) + контакт (`he_prep_emergency_v1`), `showSequencePlan`, `femalePeakGuidance` + `cyclePhaseForDay`, `prepLabCheckpoint` (`he_prep_labs_v1`), `postShowRecoveryProgress`. Тесты +27 |
| `56a37b03` | **Э2–Э7 UI**: NEW `PeakWeekProCard` (монитор+таймлайн+женский цикл, emergency, лабы, серия с overreach-кнопкой, коуч-проверка с патч-кнопкой) → встроено в «🏁 Тапер» и шаг contest; `coordinateLastHeavyDay`-строка + `🛌 без тяжёлого` маркер (`peakWeekLastHardRest`); post-show прогресс-строка. Тесты +10; `tsc` 0 |
| `e07d21ed` | **Э10** гигиена: удалены `peakTrainingProfile`/`PeakTrainingProfile` (bb-prep-cycle) и `isKnownPrepCategory` (bb-prep-splits). Тесты +3 |
| `588b61b4` | **Э2/Э4 печать**: `buildContestPrepPrintHtml(plan, extras{monitor,emergency})` + проброс из шага contest. Тесты +1 |

**Проверки**: taper-семья 343/343 (13 файлов) + UI-семья 62/62 (8 файлов) + prep-семья 67/67 +
consumer-семья 57/57 + `tsc --noEmit` **0 по всему проекту** (трижды: после Э1, после UI, после гигиены/печати).

**Итоговая честность (отклонения и уточнения)**:
- Аудит D10 уточнён по коду: `PREP_POST_SHOW` и `POSING_PROFILES` **используются внутри** своих
  модулей (buildPrepProcess / posingProfileFor) — оставлены (тест гигиены это фиксирует).
- Э7: кнопка «Применить патч» живёт в «🏁 Тапере» (патч в черновик конфига); в шаге contest —
  отображение + чипы патча (применение через блок настроек протокола) — осознанно, чтобы не
  раздваивать путь записи конфига.
- Э5: overreach-кнопка в шаге contest (есть `builtPlan`); в «🏁 Тапере» — превью окон серии.
- Фото-чек-ины не делали (нет CV-конвейера; визуал-метки flat/ontrack/full/spill + вес — честный
  ручной слой). Вторая полная пик-неделя в коротком окне — только предупреждения, не авто-сборка.
- Консолидация ~7 рендеров пик-недели и двусторонний коуч-редактор — вне раунда (как в §5).
