# BB-авто: один режим объёма для пептидов (MGF/IGF-1) — план 2026-11

**Статус:** выполнено 2026-11-19 (проход 17) · **Скоуп:** `src/engines/bb/*`, `src/engines/manual-constructor/*`, `src/engines/lms/macrocycle-to-bb.ts`, `src/ui/screens/TrainingScreen_parts/*`.

## 1. Зачем

Аудит P3-2 свёл «на курсе» к одному дозо-зависимому правилу (`bb-ped-profile`),
но остался слой, где режим решается иначе — в сборке плана. Замеры на реальном
коде (`ppl_6`, advanced, 5 лет стажа):

| случай | MRV-кривая `adaptForPEDs` | бюджет: `computeBBWeeklyBudget` c `onCourse:true` | бюджет без флага | капы сессии |
|---|---|---|---|---|
| натурал | ×1.00 | 112 | 112 | 40/15 |
| IGF1 80 мкг | **×1.24** (восст. ×1.17) | **224** | 112 | **52/15** |
| MGF 200 мкг | **×1.13** (восст. ×1.09) | **224** | 112 | **52/15** |
| AAS 125 мг (TRT) | ×1.13 | 224 | 224 | 52/15 |
| AAS 500 мг | ×1.35 | 224 | 224 | 52/15 |
| AAS 1250 мг | ×1.54 | 224 | 224 | 52/15 |

Что это значит в коде:

1. **`buildBBPlan` не имеет входа «режим».** Поля `onCourse` в `BBBuilderInput`
   нет (есть только в выходном `buildContext`), поэтому фазу «off» при
   непустом PED-профиле передать нельзя. Билдер сам решает режим
   (`bb-builder.engine.ts:3664`): любой `activePEDs` **или** любая
   положительная доза → «на курсе».
2. **MGF/IGF-1 получают курс-тир.** Карточка PED предлагает ровно
   `AAS | insulin | MGF | IGF1 | GH`, поэтому IGF1-соло — реальный сценарий.
   Итог замера сборки: IGF1-план = 52 сета/15 упр. в сессии и 225 сетов в
   неделе 1 против 210 у натурала — при том что дозо-кривая всего ×1.24.
3. **Два пути расходятся.** В цикловом/программном пути
   (`cycle-to-plan.ts:3017`, `:3038`) режим выводится из `peds.length > 0`, и
   тот же IGF1 даёт 112/40 — то есть сборка и цикл описывают разных атлетов.
4. **Пятое правило в оценке качества** (`bb-quality-weekly.engine.ts:522`):
   `onCourseOf({ peds }) || !!pedAdaptation` — `pedAdaptation` существует при
   любом PED, поэтому IGF1-план судится как курсовой.
5. **Бюджет не читает дозу:** TRT 125 мг и стек 1250 мг дают одинаковые 224.
   Это осознанный канон владельца («на курсе ~220»), в этом проходе не меняем.

Пункт прежнего отчёта «`pedProfileOf` не знает MGF/IGF1 → нужно продуктовое
решение» снимается: знание есть (`adaptForPEDs`), не хватает передачи режима.

## 2. Решение: три состояния вместо булева флага

В `bb-ped-profile.ts` появляется `volumeRegimeOf(input)`:

- `course` — AAS / GH / инсулин (по имени класса или любой положительной дозе);
- `peptides` — только MGF / IGF-1 (по имени или дозе);
- `natural` — иначе (креатин, витамины, пустой список).

Явный `onCourse` сильнее и переопределяет определение:
`true → course`, `false → natural` (это и есть фаза «off»).

`onCourseOf` остаётся (совместимость) и означает ровно `course`.

### Что делает каждый режим

| | бюджет | MRV (`computeMrvMult`) | капы сессии |
|---|---|---|---|
| natural | 112 | ×1.00 | по уровню (40/15 advanced) |
| peptides | 112 × пептидная кривая (≈129–138) | кривая `adaptForPEDs` (×1.13–1.24, потолок 1.4) | по уровню (40/15), НЕ курсовые |
| course | 224 (канон, без дозы) | дозо-кривая `doseAwareMrv` | «про на курсе» (52–60/15–16) |

Пептидная кривая не дублируется: в `bb-ped-adaptation.engine.ts` выносится
`peptideMrvMultOf(peds, doses, courseIntensity)` — тот же расчёт убывающей
отдачи (×0.85 на препарат) и интенсивности, что в `adaptForPEDs`, только по
MGF/IGF-1.

### Куда прокидывается режим

- `computeMrvMult` / `computeRegimeMrvMult` / `computeBBWeeklyBudget` /
  `sessionLimitsFor` / `weeklyCapFor` получают необязательный
  `volumeRegime?: VolumeRegime` (приоритет выше пересчёта по списку) и
  `surface`-поля `peds`/`pedDoses` уже есть.
- `BBBuilderInput` получает `peds?: string[]` и `onCourse?: boolean`; режим
  считается ОДИН раз и уходит в бюджет, капы, финализатор и `buildContext`.
- `BBFinalizeOptions` получает `volumeRegime?: VolumeRegime`; он
  восстанавливается из `buildContext` (revalidate после ручных правок) и
  входит в отпечаток опций.
- Программный/цикловой путь (`cycle-to-plan.ts`) считает тот же режим вместо
  `peds.length > 0`; `sessionLimitsFor` там получает `pedDoses`.
- `bb-quality-weekly` судит лимиты по `plan.onCourse`/`pedAdaptation`, а не по
  факту существования `pedAdaptation`.
- UI (`BbAutoConstructor`) больше не передаёт самодельный
  `onCourse: effectivePeds.length > 0` в лимиты/валидацию; peds и дозы уходят
  в движок, а режим — из общего правила.

## 3. Приёмка (сторожа)

1. `volumeRegimeOf`: IGF1/MGF → `peptides`; AAS/GH/инсулин → `course`;
   креатин → `natural`; `onCourse:false` при любом стеке → `natural`.
2. `computeRegimeMrvMult`: IGF1 80 мкг = 1.2398 (не 2.0); MGF 200 мкг = 1.1284;
   AAS 500 мг = 2.0; `{peds:['AAS']}` = 2.0 (прежний сторож).
3. `computeBBWeeklyBudget`: натурал 112, IGF1 80 мкг = 139 (не 224),
   MGF 200 мкг = 126, AAS 125/500/1250 мг = 224.
4. `sessionLimitsFor`: IGF1 advanced/5 лет → `{139, 40, 15}`;
   AAS → `{224, 52, 15}`.
5. `computeMrvMult({ onCourse:false, doseAwareMrv: 2.0 })` = 1.0 (явная фаза off
   гасит кривую) — прежний сторож сохраняется.
6. `buildBBPlan`: IGF1-план несёт `buildContext.volumeRegime = 'peptides'`,
   капы 40/15 и неделю не выше натурала +10 %; тот же план с `onCourse:false`
   и AAS-дозой — натуральный (та же неделя, что у натурала).
7. «На красное»: вернуть любое из пяти правил (булево `hasAnyPed`, плоские 2.0
   для пептидов, `peds.length > 0` в цикле, `!!pedAdaptation` в качестве,
   игнор явного `onCourse`) → тест падает. Замерено: (а) пептиды → `course`
   в правиле — 4 падения; (б) игнор явного `onCourse` — 7 падений;
   (в) `bb-quality-weekly` снова судит по `!!pedAdaptation` — 2 падения;
   (г) дозы сильнее списка препаратов (`pedClassesOf(input)`) — 2 падения
   (UI-пейлоад «IGF1 + AAS 500 по умолчанию» снова становится курсом).

## 4. Что осознанно НЕ меняется

- **Бюджет курса плоский 224** независимо от дозы (TRT = мега-стек) — канон
  владельца «на курсе ~220». Дозо-кривая живёт в MRV/landmarks, не в бюджете.
- **Правило сплита** (`highVolumeDemandOf`) не трогаем: пептиды не дают
  «высокого объёма» для выбора сплита.
- **`computeBudgetBB` в diagnostics-injection** (`snap.courseIntensity != null`
  → курс) — отдельная находка, вне этого прохода.
- **P2-8, `bodyweightCapability`, `single_work_set`** — вне скоупа.

## 5. Что сделано (факт прохода 17)

Код и сторожа — коммит `4c70c6600`; этот документ — отдельный коммит docs.

### 5.1 Правило и кривая

- `bb-ped-profile.ts`: `VolumeRegime`, `PedClassProfile`, `pedClassesOf`
  (AAS — имена/дозы, GH, инсулин, MGF, IGF/IGF1), `volumeRegimeOf`;
  `onCourseOf` делегирует в него и означает ровно `'course'`. Список выбранных
  препаратов сильнее доз: форма UI держит дозы всех препаратов (AAS 500 по
  умолчанию), и доза невыбранного препарата не делает атлета курсовым; дозы
  решают, только если списка нет (цикловой путь с одними дозами).
- `bb-ped-adaptation.engine.ts`: `peptideMrvMultOf(peds, doses, intensity)` —
  тот же расчёт убывающей отдачи (×0.85 на препарат) и `COURSE_INTENSITY_MULT`,
  что в `adaptForPEDs`, но только по MGF/IGF-1; потолок `PEPTIDE_MRV_CEILING = 1.4`.
- `bb-volume.engine.ts`: `volumeRegime` читают `computeRegimeMrvMult`,
  `computeMrvMult` (natural 1.0 / peptides ≤1.4 / course `doseAwareMrv` ≤2.15),
  `computeBBWeeklyBudget` (база из режима), `sessionLimitsFor` (курс-капы
  только при `regime === 'course'`), `weeklyCapFor` (пептиды — своя кривая).

### 5.2 Проводка режима

- `bb-builder.engine.ts`: вход `peds`/`onCourse`, режим считается один раз,
  уходит в `regimeMult`, бюджет, капы, `buildSession` (позиционный аргумент +
  `BuildSessionParams.volumeRegime`, гейты `effectiveRegime`), финализатор,
  `buildContext` и `inputSnapshot`. Явный `onCourse:false` гасит PED-механизмы
  (minSetsArms/armBoost), чтобы «off» был настоящим натуралом.
- `bb-finalize.engine.ts`: `BBFinalizeOptions.volumeRegime`, merge из
  `buildContext` (revalidate), отпечаток опций, `weeklyCapFor`/MRV-гарды.
- `cycle-to-plan.ts`: оба пути (convert + program) считают один режим вместо
  `peds.length > 0`; финализатор получает `volumeRegime` и явный `onCourse`
  (раньше `buildContext.onCourse` в цикловом пути терялся).
- `bb-quality-weekly.engine.ts`: лимиты сессии — из `buildContext.volumeRegime`
  и `plan.onCourse`, а не из факта `pedAdaptation`.
- `bb-replan.engine.ts`, `macrocycle-to-bb.ts`, `manual-draft.engine.ts`,
  `manual-volume.engine.ts`, `manual-quality.engine.ts`, `bb-selector.engine.ts`:
  прокинуты `peds`/`pedDoses`/`onCourse` в бюджет, капы и оценку.
- `bb-prep-cycle.engine.ts`: prep-цикл `enhanced` передаёт `onCourse: true`
  (это курс по определению) — иначе пептидные ключи в дозах уводили режим.
- UI: `BbAutoConstructor` считает режим один раз (`volumeRegime` из
  `effectivePeds`; профильный `onCourse` — только когда препаратов нет в
  списке) и отдаёт его в сборку, `prioritizeBackSessions`, снимки, лимиты,
  экспорт и сохранение профиля (`onCourse` = «режим = курс», а не «список
  непуст»). `training-profile.ts` получил `explicitOnCourseFor`: список
  препаратов сильнее профильного `true` (унаследованный авто-пересчёт не
  возвращает IGF1 в курс), дефолтный `false` не изображает фазу off — её
  выражает пустой список. `bb-step-params` показывает лимиты по списку
  препаратов. `CalcQualityTab`, `editor-panels/diagnostics.tsx`,
  `ProgramEditorView`, `ProgramEditorPanels`, `ProgramEditorPanels2`,
  `QualityChecklistCard` передают `peds`/`pedDoses` в `computePlanQualityFor`
  с тем же правилом; `SRCBBScreen` больше не пишет в профиль
  `onCourse = peds.length > 0`.
- `manual-quality.engine.ts`: MRV мышц для пептидов считается их кривой
  (`peptideMrvMultOf`), курс-множитель ×1.2 — только для `course`.

### 5.3 Замеры после правки

`ppl_6`, advanced, 5 лет стажа:

| случай | MRV | бюджет | капы сессии |
|---|---|---|---|
| натурал | ×1.00 | 112 | 40/15 |
| IGF1 80 мкг | ×1.2398 | **139** | **40/15** |
| MGF 200 мкг | ×1.1284 | **126** | **40/15** |
| AAS 125 мг (TRT) | ×1.13 | 224 | 52/15 |
| AAS 500 мг | ×1.35 | 224 | 52/15 |
| AAS 1250 мг | ×1.54 | 224 | 52/15 |

`buildBBPlan` с IGF1: `buildContext.volumeRegime = 'peptides'`, `onCourse=false`,
`maxWorkingSets=40`, неделя 1 — 199 сетов против 188 у натурала (201 с дозами
формы по умолчанию, AAS 500 — 214; было 225 при капах 52/15). Явный
`onCourse:false` с AAS 500 мг — та же неделя, что у натурала,
`volumeRegime='natural'`.

### 5.4 Сторожа

- `bb-audit-p3-ped-volume.test.ts` (19 тестов): три состояния правила, список
  сильнее дефолтных доз формы, классы препаратов, пептидная кривая,
  MRV/бюджет/капы, сборка плана, фаза off, снапшот `peds/onCourse`, оценка
  недели (`session_cap` не курсовая).
- `bb-cycle-program-ped.test.ts` (20 тестов, добавлены 2): цикловой и
  программный пути (IGF1 → капы 40/15, AAS → 52/15; `onCourse:false` →
  натурал).
- Прежние сторожа зелёные: `computeRegimeMrvMult({peds:['AAS']}) === 2.0`,
  `computeMrvMult({onCourse:false, doseAwareMrv:2}) === 1.0`, капы
  `bb-wave0-validation-contract`.
- Полный прогон `src/engines/bb/__tests__`: 322 файла (318 passed | 4 skipped),
  3694 теста (3674 passed | 20 skipped), exit 0; `tsc --noEmit` — exit 0.

### 5.5 Цикловой и библиотечный пути: дозы курса — это курс (пере-базовка снимков)

Причина: до прохода эти два маршрута брали режим из `peds.length > 0`, поэтому
пейлоад «только дозы AAS 500, без списка» строил enhanced-натурал (капы 40/15,
натуральные цели), хотя generic-путь для того же атлета уже был курсом. Одно
правило выравнивает маршруты: дозы AAS → `course` → капы 60/16 (enhanced 6+) и
MRV-кривая дозы. Это осознанная пере-базовка `bb-zero-state-snapshots`
(комментарии в тесте):

- **ПРОФ-cycle adapt (CYCLE_01 + AAS 500), W1:** грудь 14→24, спина 10→18,
  квадры 15→23, хамс 11→17, бицепс 11→14, трицепс 9→13, пресс 7→12,
  икры 8→13, трапы 6→12, предплечья 7→12; итого 180 прямых сетов < бюджета 224.
- **Library adapt, W1:** грудь 13→18, спина 9→22, квадры 20→28, хамс 12→15,
  пресс 7→15, икры 8→15, трапы 6→15, предплечья 7→12, бицепс 12→10,
  трицепс 8→5; итого 178 сетов < 224.
- Новых MRV-переливов нет; ошибки валидатора — те же `session_exercise_cap`
  (его собственный дефолт 10 упражнений на сессию, было и до прохода).

### 5.6 Побочная находка: «верхний блок» ≠ вертикальная тяга

`classifyBackExercise('Разгибания на трицепс в верхнем блоке')` возвращал
`vertical_pull` / `cable_vertical`: трицепсовый пушдаун считался тягой спины, и
ремонт паттернов («одна вертикальная тяга на сессию») видел в Pull-дне больше
вертикальных тяг, чем есть. Исправлено исключением `NOT_BACK_CABLE` (разгибания
на трицепс / сгибания на бицепс / pushdown) в `classifyBackExercise` и
`verticalPullProfile`; сторож — в `bb-back-quality.integration.test.ts` (16
тестов). «На красное»: убрать исключение → 2 падения (новый сторож + adaptive
PROF cycle).
