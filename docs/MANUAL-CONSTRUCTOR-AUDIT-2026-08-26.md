# Ручной планировщик — полный аудит удобства и конструктивности (26 Aug 2026)

> Цель: сделать ручной конструктор реально удобным и конструктивным инструментом — по функционалу и по визуалу. Использовать библиотеку (29 FullProgram + 20 Women/Custom + 66 LMS), интеллектуальные движки (exercise-selector, volume-landmarks, quality, BB-auto, periodization, substitution, lab-adjust) и другие инструменты проекта. 

## 1. Текущая архитектура

```
ProgramManagerPanel (MSTEP: choose → editor → final)
  ├─ choose: ManualHeader + Stepper + onboarding + Единый конструктор banner
  │   ├─ 🆕 ББ / 🏆 ПЛ / ⚡ Hybrid (createBlank → editor)
  │   ├─ 🪄 Визард 5 шагов (тип → цель → формат → каркас → превью, auto-fill)
  │   ├─ 🚀 6 быстрых шаблонов (QuickTemplatesGrid, 1 клик → buildBBUserProgramFromProfile)
  │   ├─ 🔍 Библиотека (29+20) + 📥 LMS 66 (ManualLibraryGallery, 2 таба, фильтры, ⭐, сравнение 2)
  │   └─ 📋 Список сохранённых (loadUserPrograms, поиск/фильтр/сортировка, clone/compare/export/import)
  └─ editor: ProgramEditor (ESTEP: profile → params → weeks)
        ├─ header: «К списку» + meta-chip + dirty-dot + 💾 Сохранить + topbar actions (⋯, 📋/✏️, ↩/↪, 🖨, 📅, нед→вып)
        ├─ ManualStepper (3 пилюли) + progress + шаг-info
        ├─ profile: TrainingProfileCard (ПМ/workMax, оборудование, травмы, слабые, стаж, PED, etc) — глобальный профиль, не программо-специфичный
        ├─ params: meta (title/goal/level/дни/нед) + notes + AutoPeriodizationPanel + CycleTemplatesPanel + lab hint
        ├─ weeks:
        │   ├─ design-link card (linkDesignToProgram)
        │   ├─ «Пустая программа» CTA
        │   ├─ PlanSummaryTable (опцонально)
        │   ├─ 🗓 Неделя-расписание (7-дневная сетка, dayOfWeek picker, ★ recommend)
        │   ├─ BBEditor: недели-карточки (phase, RIR live, deload, count, 📊 Объём, ⧉, 💬, ▲/▼, drag, ✕) + VolumeMiniBar + MesoHeatmap + SessionList
        │   │   └─ SessionList: день-карточка (name/day/focus, ▲/▼, 💬, ⧉, ✕) + BlockList
        │   │       └─ BlockList: упражнение-карточка (☰ drag, type, ExerciseLabPicker, muscle, sets, warmup, tempo-rec, note, ⊕ superset, ⧉, 🔄 subst, 📋/✕, SetEditor)
        │   │           └─ SetEditor: reps × RIR @ weight %→kg, rest, technique chips, +/del, wtMode kg/%
        │   ├─ PLEditor: customWeeks/дни/упражнения (pct/reps/sets/rir) + LMS-цикл overlay
        │   ├─ HybridPlanPanel
        │   ├─ live качество (computePlanQualityFor → ScoreBadge + perMuscle chips + «Быстрый фикс» + выравнивание дней)
        │   ├─ BulkApplyCard (техники на диапазон недель)
        │   ├─ 🧠 MethodHint 6 правил без калькулятора
        │   ├─ 3 PRO-аккордеона внутри weeks (📊 Анализ / 🔄 Обратная связь / 🔧 Инструменты) — каждый с 2-4 панелями:
        │   │   ├─ Анализ: BbContextPanel, MesoHeatmap, lab-correction, PlanDiagnostics/InteractiveVolume/ProgressionCoach/Tonnage + RirWaveChart/ProgramTimeline/QualityScore
        │   │   ├─ Обратная связь: LoadGuard/RealMRV/RIRCalibration/CheckinGuard/StrengthDiary + ReadinessForecast/WhatIf (скрыт за «Дополнительно»)
        │   │   └─ Инструменты: PlannerToolsPanel+PlDeadpointsBarPath, PlateAuto/ExerciseInfo/StickingPoint/Biomechanics (скрыт), SplitConsultant/Substitution/ProgramRevisions + история правок
        │   └─ final: валидация, metrics (bbMetrics), чек-лист, 💾 Сохранить, 📋, 📤 JSON, 📅 ICS
```

Движки: `suggestExercisesForGroup` (exercise-selector), `getVolumeLandmarks`, `computePlanQualityFor`, `autodraftBBPlan`/`buildBBUserProgramFromProfile`, `findSubstitutions`, `calcBBPlanMetrics`, `labTrainingAdjust`, `selectBestBBSplit`, `tempoFor`, `distributePhases`, `suggestFeeders` и др. — все подключены, но разбросаны по карточкам.

---

## 2. Проблемы — UX (функциональная удобность)

### P0 — критично для конструктивности

1. **Двойная навигация (MSTEP + ESTEP).** Пользователь видит «1 Выбор / 2 Редактор / 3 Итог» (глобально) и внутри редактора «👤 Профиль → 🎛 Параметры → 🗓 Недели» (3 пилюли) + ещё прогресс-бар. Это 2 уровня с одинаковым визуалом (пилюли), но разным смыслом. На мобильном оба ряда занимают 80px высоты, путают.
2. **Профиль как шаг 1 редактора.** TrainingProfileCard — глобальный профиль (ПМ, оборудование, стаж, PED, травмы, workMaxByExercise) — показывается как «шаг 1 из 3» внутри каждой программы. Пользователь ожидает «параметры программы», а получает «данные атлета» (60 полей). При этом профиль уже есть в «Профиль → Тренировки». Дубль, перегрузка шага, отвлекает от ядра «недели → упражнения».
3. **Слишком много точек входа на choose.** 3 кнопки «🆕 ББ/ПЛ/Hybrid» + «🪄 Визард» + 6 «🚀 Быстрый старт» + 2 «🔍 Библиотека/LMS» + список сохранённых + онбординг + «Единый конструктор» баннер = 12 CTAs на одном экране. Новичок теряется; профи не видит «открыть мою последнюю» без скролла.
4. **Авто-сборка спрятана.** `⚡ Авто-черновик` — вторичная кнопка в ⋯ меню или в «Пустая программа» (только если пусто). При этом это самый конструктивный путь (1 клик → качественный скелет из профиля + MEV/MRV + сплит). Должна быть primary на params/weeks, а не tertiary.
5. **Нет единого воркфлоу «скелет → наполнение → проверка».** Сейчас: профиль (отдельно) → params (title/goal/level/дни/нед + фазы) → weeks (структура + live качество + аккордеоны) → final (валидация + чек-лист). Фазы, дни, упражнения, объёмы, RIR, темп, суперсеты — всё в weeks одновременно. Нужна декомпозиция: «каркас недели» отдельно от «детали упражнения».

### P1 — важно для ежедневной работы

6. **Перегрузка карточки недели.** Заголовок недели содержит: drag-ручку ☰, ▼/▶, цвет-полоску фазы, «Неделя N», «+X%», «N дн·M упр·K подх», PhasePicker, RIR-badge, deload-чек, EditorPopupNumber «Тренировок», «📊 Объём», «⧉ Копировать», 💬, ▲/▼, ✕ — 13 контролов в одну строку (на мобильном ломается в 3 ряда). Кнопки «📊 Объём»/«⧉»/💬 визуально равны primary.
7. **Перегрузка карточки дня.** SessionList header: цвет-точка дня, «ТРЕНИРОВОЧНЫЙ ДЕНЬ N», «ДЕНЬ-имя · N упр.», ▲/▼, 💬, ⧉, ✕ + inputs name/day/focus + VolumeMiniBar (до 4 полосок) + BlockList. 10 контролов + 3 инпута в шапке.
8. **Перегрузка карточки упражнения.** BlockList row: ☰ + ▲/▼ + ↗ + type picker + ExerciseLabPicker (модал) + muscle picker + «▼ Детали» (мобильный) + SetEditor (2 строки) + warmup preview + tempo-rec + note + ⊕/⧉/🔄/📋/✕ + subst panel. 14 контролов на одно упражнение. SetEditor: «1 [8×][2][@][40][90s][🔥tech] ✕» — 7 полей на сет, нет группировки.
9. **Недисциплинированные подсказки.** MethodHint 6 правил («Объём MEV/MRV», «Суперсеты», «DUP», «Делод ACWR», «Специализация», «Темп TUT») — статичный грид вне контекста. Пользователь видит «DUP 3 тренировки/нед: тяж/сред/лёг» рядом с формой редактирования упражнения, но не может применить 1 кликом.
10. **PRO-аккордеоны внутри weeks — 12 панелей в 3 группах.** 📊 Анализ (7 панелей), 🔄 Обратная связь (7), 🔧 Инструменты (6) = 20 панелей, часть скрыта за «▼ Дополнительно». Пользователь не понимает, где искать «замену упражнения» (SubstitutionPanel в Инструментах) vs «быструю замену» (🔄 внутри упражнения) vs «биомеханику» (скрыта).
11. **Слабый empty-state.** Пустая неделя → «+ Быстро по группе» грид 15 карточек мышц. Пустой день → то же + шаблонные 3 дня (Грудь/Спина/Ноги). Но после добавления первого упражнения — грид остаётся над списком (дубль). Нет прогрессивного раскрытия.
12. **Расписание недели — неочевидный picker.** Сетка 7 дней (Пн-Вс) кликабельна, но на мобильном каждая ячейка 52px, ★ «рекомендованный» мелко, попап «Назначить на день» — 2 уровня (move vs assign) путают.

### P2 — качество жизни

13. **Live качество дублируется.** BBEditor показывает ScoreBadge+chips+progress над неделями; ProgramEditorView дублирует QualityScorePanel + QualityChecklistCard + «Быстрый фикс» внутри weeks; final дублирует ещё раз validation + checklist. 3 места, разные цифры (peak vs avg).
14. **Автосохранение не видно.** `isDirty` точка · / ✓ + `autosaveMs 30s` interval, но нет «последнее сохранение 12:34» и нет «↩ Отменить» в шапке (есть только Ctrl+Z).
15. **Сравнение программ спрятано.** ⚖ в строке программы (нужно выбрать 2, затем внизу появляется панель). Нет «дублировать неделю» в сравнении.
16. **ICS/JSON/PDF в 3 местах.** Topbar: 🖨+📅; ⋯ меню: ещё + «Фазы», «Методики», «Годовой план»; final: 📤 JSON + 📅 ICS + 🖨 + 📋. Нет единого «Экспорт».

---

## 3. Проблемы — визуал

17. **Стеклянный шум.** Все CARD — `blur 18px + glass-border + shadow + 16px radius + 14px padding + 8px gap`. При 10 неделях × 4 дня × 4 упр = 160 карточек с одинаковым стеклом — нет иерархии. Глаз не отличает неделю от дня от упражнения.
18. **Цветовой шум.** Акценты: #00e68a (ББ), #a78bfa (ПЛ), #3b82f6 (Hybrid), #22c55e (накoп), #f59e0b (интенсив), #ef4444 (deload), #f59e0b (lab), #06b6d4 (superset) — 8 цветов одновременно в одной неделе.
19. **Типографика.** HINT `50×80` px в карточках, SMALL 12px/1.45, заголовки 13-15px/800 — всё одного веса. Нет шкалы (title 15/900 → section 12/800 → body 11/500 → caption 10/400).
20. **Кнопки.** BTN (44px, градиент) vs BTN_GHOST (контур) vs CHIP vs CARD_BTN (56px, column) vs ICON_CARD_BTN (44×44) vs editor-chip — 6 стилей кнопок на одном экране. «Добавить неделю» — CARD_ACTION (48px), «Добавить день» — editor-action-card, «Добавить упражнение» — тоже CARD_ACTION, но разные цвета.
21. **Mobile.** Week card на 380px: header ломается, PhasePicker переносится, «📊 Объём» уезжает, SetEditor `input 38px` обрезается, «▼ Детали» скрывает сеты (нужен тап). Доска 320px требует горизонтальный скролл без индикатора.
22. **Иконки.** Эмодзи + текст + цвет одновременно (💪 Грудь, 🏋️ Спина) — на тёмном glass эмодзи теряется, текст мелкий.

---

## 4. Интеграция с библиотекой и интеллектом — как сейчас

| Возможность | Текущее использование | Оценка |
|---|---|---|
| 29 FullProgram + 20 Women/Custom | ManualLibraryGallery (2 таба, 90 карточек) — 1-клик клон | Хорошо, но нет «похожие» и «для вашей цели» внутри редактора |
| 66 LMS | тот же gallery, tab ПЛ — 1-клик cloneFromCycle | Хорошо |
| exercise-selector (suggestExercisesForGroup, selectExercisesSmart) | BlockList пикер (12 канд., 6 показать, фильтр по оборудованию/weak/травмам/избранному) + «Заполнить пустые» | Сильно, но скрыто за «+ Быстро по группе» — нет «избранное ★» и «последние 3» |
| volume-landmarks (MEV/MAV/MRV) | VolumeMiniBar per сессия, MesoHeatmap, VolumeBudgetCard, live chips | Много, но дублирует + нет «перегруз подсвечен в списке упражнений» |
| manual-quality (computePlanQualityFor) | BBEditor live score + weeks QualityScore/Checklist + final score | 3 дубля, путает |
| BB-auto (autodraftBBPlan, buildBBUserProgramFromProfile) | Визард превью + «⚡ Авто-черновик» + «Заполнить пустые» + QuickTemplates 6 | Разбросано по 4 местам |
| substitution (findSubstitutions) | BlockList 🔄 4 замены (reason/confidence) | Хорошо, но нет «щадящая замена» (graded injury) в пикере |
| BB-metrics (calcBBPlanMetrics) | Итог тяж/памп/RIR + Validation | Ок |
| labTrainingAdjust | Pro Анализ → lab-correction card + suggestFeeders | Спрятано в аккордеоне, не видно без открытия |
| bb-selector (selectBestBBSplit) | Gallery «Рекомендовано» 3 + QuickTemplates ★ | Ок |
| periodization (distributePhases, PHASE_CONFIGS, tempoFor) | params AutoPeriodizationPanel + per-упр tempo-rec + BulkApply «Фазы» | Разбросано |
| warmup-ramp, bb-tempo-rest | per-упр warmup preview + tempo-rec | Хорошо |

Вывод: движки есть и качественные, но раскиданы по 20 карточкам без единого сценария «профиль → цель → скелет → упражнения → проверка → экспорт».

---

## 5. План улучшения — конструктивный поток

### Принцип: «5 минут до первого качественного плана, 20 минут до идеального»

**Сценарий новичка (3 клика):** Выбор → 🚀 «Масса 3д/нед» (из профиля: 80кг / 14% / intermediate / 4д) → Итог → 💾. Авто: сплит upper_lower_4, MEV→MAV, RIR 2, делод каждую 4н.

**Сценарий профи (5 шагов, всё под рукой):**
1. **Каркас** — недели (8) + дни (Пн/Ср/Пт/Сб) — сплит из BB-selector, расписание сеткой, drag-доска опционально.
2. **Наполнение** — по дню: фокус (грудь) → пикер предлагает 6 из exercise-selector (с учётом зала/травм/избранного) → 1 клик добавляет с muscleAwareSets + workMax → warmup+tempo автоматом.
3. **Детали** — SetEditor: reps/RIR/weight/rest/tech в одной строке, групповое редактирование (выделить 3 упр → «RIR 2 → 1»).
4. **Проверка** — live score + MesoHeatmap + «Быстрый фикс» (недобор/перегруз) — без перехода в аккордеон.
5. **Экспорт** — единый «Экспорт» (PDF/ICS/JSON/буфер) + «🚚 К выполнению».

**Визуальный принцип:** неделя > день > упражнение — 3 уровня иерархии, каждый со своим фоном, отступом и тенью. Неделя — толстая карточка (16px, левая полоса фазы), день — тонкая (12px, цвет дня), упражнение — строка (8px, без стекла, только border). Один акцент на уровень — не 8 цветов сразу.

### Этапы

#### Этап 0 — аудит (этот документ) — done.

#### Этап 1 — P0 навигация и шапка (без ломки тестов) ✅

- Сохранить MSTEP 3 пилюли и ESTEP 3 пилюли (тесты требуют «1 Выбор /2 Редактор/3 Итог» + «👤/🎛/🗓» + «шаг N из 3» + «Далее: Параметры/Недели/Итог» + клавиатура ←/→) — не менять API, только визуал.
- Шапка редактора: сжать topbar (одна строка: ←К списку + meta-chip + dirty + 💾), topbar actions — в один ряд с divider, «⋯» → горизонтальная лента (не grid).
- Choose: сгруппировать CTAs (первичные 3 «🆕», вторичные «🚀», третичные «🔍») — убрать баннер «Единый конструктор», онбординг свернуть после первого «Понятно».
- Авто-черновик: поднять в params как primary («⚡ Собрать из профиля — 1 клик»), в weeks оставить только «Заполнить пустые» если есть пустые.

#### Этап 2 — карточки недель/дней (визуальная иерархия) ✅

- Неделя: единый header-ряд (☰ drag слева, «Неделя N» + фаза-точка + «+X%» справа, 2 строки на мобильном вместо 13 контролов в одну). PhasePicker → компактный pill, RIR/deload/count — одна строка meta под header. Кнопки «📊/⧉/💬/▲/▼/✕» — в footer недели (не в header), с divider.
- День: header — цвет-полоска слева (dayColor), «День N · Пн — Грудь» + «N упр» + VolumeMiniBar(s) в одну строку (compact) под header, не в header. Controls (💬/⧉/✕/▲/▼) — справа, 32px.
- Board vs List: board — оставить, но добавить индикатор скролла и «📋 Список / 🗂 Доска» pill (текущий toggle уже есть, улучшить contrast).
- MesoHeatmap: вынести из аккордеона наверх weeks (когда ≥2 недель), свернут по умолчанию, 1 клик «🗺 Тепловая карта».

#### Этап 3 — карточки упражнений и подходов (упрощение, grouping) ✅

- Упражнение: 2-рядная карточка — ряд1: ☰ (12px) + ExerciseLabPicker (flex:1) + muscle pill (90px) + type icon (compound/accessory) — без двух кнопок ▲/▼ в ряд1 (оставить только drag + ▲/▼ в menu «⋯» упражнения). Ряд2: SetEditor в одну строку per сет, техника как chips под сетами (не в каждом сете).
- SetEditor: одна строка per сет («1 · [reps]× [RIR] @ [kg] · [rest]s [+tech] ✕»), weightMode kg/% — переключатель pill над сетами (не per сет). Техники — мульти-выбор chips (dropset/rest_pause/myo_rep) под списком сетов, применяются к последнему сету.
- Warmup/tempo-rec: свернуть в «💡 Подсказка» строку с «применить» (уже есть, оставить, но убрать дубль темпа per-упр если он уже в сете).
- Superset: оставить ⊕, но показывать только если соседний блок той же мышцы-антагониста (не всегда).
- Быстрое добавление: грид мышц → пикер 6 — оставить, но убрать дубль (над списком и внутри empty). Оставить только empty-грид когда 0 упражнений, и «+ Быстро» лента когда >0 (текущий дубль — убрать верхний).

#### Этап 4 — конструктивный воркфлоу (профиль → цель → скелет → наполнение → анализ → итог) ✅

- Профиль: оставить как шаг 1, но свернуть в «сводку профиля» (чипы: ПМ 120/100/140, оборудование 5, слабые 2) + «✏️ Редактировать профиль →» (открывает TrainingProfileCard в модале, не inline). Так шаг 1 не пугает 60 полями, но данные видны.
- Params: группировать «Цель и уровень — как влияет на цикл» + «Формат (дни/нед)» + «Авто-периодизация» + «Шаблоны циклов» — каждый в SectionCard с заголовком, а не стопкой.
- Weeks: ядро — «Каркас недели» (расписание) → «Дни и упражнения» (SessionList) → «Проверка» (live качество + быстрый фикс). Остальное — в «Анализ» аккордеон (по запросу).
- Итог: чек-лист 5 пунктов (название, наполнение, объём, делод, дни) уже есть — оставить, добавить «что дальше: 🚚 К выполнению / 📅 ICS / 🖨 PDF».

#### Этап 5 — интеллектуальные подсказки в контексте (без перегрузки) ✅

- MEV/MRV: показывать VolumeMiniBar только когда cur ≥ MAV или cur < MEV (не всегда), и подсвечивать упражнение красным left-border если его мышца в перегрузе.
- Substitutions: показывать 🔄 только если findSubstitutions даёт ≥2 варианта, и добавить «щадящая» бейдж если есть graded injury.
- Lab/Feeders: вынести lab-correction из аккордеона в weeks header когда labMrvMultiplier <1 (жёлтая лента «🧪 MRV ×0.85 — снижен объём, рекомендуем делод»).
- DUP/суперсеты/специализация: показывать MethodHint только когда пользователь выбрал соответствующий фокус (напр. «Специализация» только если weakPoints ≥1).

#### Этап 6 — полировка и тесты

- tsc 0, manual-constructor-steps 9/9, program-editor-* 20+, bb-* 61 база, TrainingScreen 140/140.
- Визуальная регрессия: hero, planning, choose, editor (profile/params/weeks/итог), board/list, мобильный 380px.

---

## 6. Что НЕ трогаем (чужие зоны)

- `src/ui/screens/TrainingScreen_parts/Cardio*`, `StrengthSport/*`, `Combat/*`, `IndividualPlan/*`, `TrainingScreen.tsx` hero/planning — не трогаем.
- `src/engines/bb/*` (кроме уже используемых helpers) — не меняем логику, только используем.
- `src/core/*`, `src/data/*` — не трогаем.

Файлы этого аудита: `docs/MANUAL-CONSTRUCTOR-AUDIT-2026-08-26.md` (NEW) + правки только в `ProgramManagerPanel.tsx`, `ProgramEditorView.tsx`, `ProgramEditorComponents.tsx`, `ManualUI.tsx`, `training-ui.tsx` — через `git commit -- <pathspec>`.

