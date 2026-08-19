# Женский контекст для BB-auto и PL-auto

Статус: **реализовано (ядро); оставшиеся пункты — отдельные будущие раунды (ниже)**

Дата: 2026-08-18

## 1. Решение

Не создавать второй независимый «женский движок». Базовая силовая модель для мужчин и женщин в основном общая: прогрессия, RIR, объём, частота, авторегуляция и работа от собственного ПМ.

Добавить отдельную явную кнопку/переключатель:

```ts
athleteMode: 'standard' | 'female_context'
```

Режим действует только при следующей сборке. Уже созданный план не пересчитывается автоматически.

При выключенном режиме существующие результаты должны оставаться побайтно совместимыми, кроме заранее исправленных явных ошибок передачи параметров.

## 2. Научная позиция

Женщинам не требуется универсально:

- уменьшать или увеличивать весь MRV;
- менять всем RIR;
- автоматически менять программу по фазе цикла;
- принудительно назначать ягодичный фокус;
- снижать все рабочие веса;
- использовать отдельную периодизацию.

Женский контекст действительно нужен для:

- абсолютных и относительных нормативов силы;
- федерации, дивизиона и весовой категории;
- категорий BB-соревнований;
- энергетической доступности и риска RED-S;
- дефицита железа и костного здоровья при наличии факторов риска;
- беременности, послеродового периода, менопаузы и медицинских ограничений;
- индивидуальной реакции на симптомы цикла, сон, HRV, RPE и дневник.

Фаза менструального цикла не должна автоматически менять план: доказательства показывают небольшие средние эффекты и большую индивидуальную вариативность. Использовать индивидуальный фидбэк, а не календарную эвристику.

## 3. Полный контекст спортсмена

Добавить JSON-safe контекст, совместимый со старыми входами:

```ts
interface AthleteContext {
  sex: 'male' | 'female';
  athleteMode: 'standard' | 'female_context';
  trainingYears?: number;
  pedExperience?: {
    totalYears?: number;
    coursesCount?: number;
    monthsSinceLastCourse?: number;
    enhancedNow?: boolean;
  };
  reproductiveContext?:
    | 'unknown'
    | 'cycle'
    | 'contraception'
    | 'pregnancy'
    | 'postpartum'
    | 'perimenopause'
    | 'menopause';
  competitionFederation?: string;
  competitionDivision?: string;
}
```

`sex` и `athleteMode` не должны заменять существующие поля `level`, `trainingYears`, `peds`, `pedDoses`, `courseIntensity` и recovery-параметры.

## 4. Неприкосновенный полный набор параметров

Женский режим обязан учитывать тот же полный конвейер, что и стандартный режим:

```text
базовый объём
-> уровень и тренировочный стаж
-> PED, дозировки и PED-стаж
-> цель и training focus
-> питание: профицит/дефицит и белок
-> сон, HRV, стресс, усталость и readiness
-> лабораторный MRV-множитель
-> ACWR и авторегуляция
-> травмы, исключения и мобильность
-> оборудование и доступные дни
-> слабые группы и специализация
-> предыдущий план и прогрессия
-> женские safety-проверки
-> финальные капы, session caps и валидатор
```

Нельзя обходить или заменять:

- MEV/MAV/MRV;
- effective MRV и weekly caps;
- per-exercise cap;
- session exercise cap;
- PED MRV multiplier;
- recovery multiplier;
- nutrition multiplier;
- lab multiplier;
- ACWR multiplier;
- injury/graded injury ограничения;
- финализатор и валидатор.

Женский фактор не должен автоматически складываться с уже существующим glute-фактором или specialization-фактором. Все множители должны иметь единый отчёт и источник.

## 5. BB-auto

### 5.1. Что сохраняется

Сохраняются все текущие ветки:

- generic split;
- BB-cycle;
- library/program;
- adapt и faithful;
- специализация и многоблочная специализация;
- PED и дозозависимая адаптация;
- техники, DUP, суперсеты и схемы объёма;
- травмы, mobility, axial load;
- contest prep, taper и peak week;
- annual-training и ручные мосты.

### 5.2. Поведение `female_context`

Включить:

- женские BB-категории и проверку категории;
- профиль соревнования и консервативные safety-подсказки;
- выбор цели телосложения отдельно от пола: баланс, glutes/lower, upper, категория шоу;
- корректный подбор сплита под фактическое число дней;
- `female_glute_5` только при совместимых условиях: выбран glute/lower-фокус и доступно 5 дней;
- альтернативу `glute_focus_4` для 4 дней;
- safety-предупреждения по RED-S, железу, костям и тазовому дну при наличии признаков;
- персональную авторегуляцию по дневнику, симптомам, RPE, сну и readiness.

Не включать автоматически:

- универсальный MRV×0.95;
- универсальный glute×1.15 или glute×1.2 поверх уже существующего множителя;
- автоматический цикл-фазовый RIR;
- автоматический five-day split;
- автоматическое уменьшение рабочих весов.

### 5.3. Технические точки

- `BBBuilderInput`: принять `athleteMode`/`AthleteContext` через optional-поля.
- `BBPlan`: сохранить `sex`, `athleteMode` и итоговую policy-сводку.
- `bb-plans-store.ts`: сохранить режим и контекст в `params`.
- `BbAutoConstructor.tsx`: добавить кнопку, профильный дефолт только как рекомендацию, не как скрытое переключение.
- `bb-selector.engine.ts`: передавать реальный `focusGroup`; сейчас в UI он местами передаётся как `undefined`/`''`.
- `bb-demographics.ts`: либо подключить через единую policy-функцию, либо не использовать; не оставлять параллельную мёртвую женскую модель.
- `bb-finalize.engine.ts`: применять женские ограничения до финальных caps, затем повторно валидировать.
- `bb-contest-prep.engine.ts`: использовать существующую женскую safety-модель, не дублировать её в builder.
- annual/designer/macrocycle adapters: явно передавать context.

## 6. PL-auto

### 6.1. Что сохраняется без изменений

Для обычной тренировки сохраняются общие принципы:

- проценты от индивидуального ПМ;
- RIR и фазы;
- PM progression;
- ACWR;
- auto/diary autoregulation;
- recovery multiplier;
- PED и дозы;
- taper curve;
- attempts и warm-up.

Пол не должен сам по себе менять проценты, RIR, число сетов или длительность цикла.

### 6.2. Что добавить в `female_context`

- женские таблицы весовых категорий, зависящие от федерации;
- женский division в UI соревнований;
- женские коэффициенты DOTS/IPF GL и нормативы;
- корректный профильный sex default вместо локального male default;
- проверку допустимости категории и федерации;
- предупреждения по агрессивной сгонке и низкой энергетической доступности;
- отдельные safety-поля для беременности/postpartum/менопаузы, без автоматической медицинской диагностики.

### 6.3. Технические точки

- `LMSBuildInput`: добавить optional `sex`, `athleteMode`, `athleteContext`.
- `SRCBBScreen.getRecoveryMetrics/buildSrc/buildSrcMacrocycle`: передать context.
- `lms-selector.engine.ts`: учитывать пол только там, где есть доказуемые division/federation данные.
- `gym-competition.engine.ts`: заменить `IPF_WEIGHT_CLASSES_MEN` на federation + sex таблицы.
- `periodization-meet-pct.engine.ts`: принимать sex и использовать канонический DOTS/IPF GL, не отдельную мужскую формулу.
- `PeakingPanel.tsx`, `PLCompetitionTab.tsx`, `ProMetricsPanel.tsx`: гидрировать sex из UnifiedSettings и дать ручное уточнение.
- `lms-taper.engine.ts`: не менять кривую только из-за пола; менять только по fatigue, weight goal, federation protocol и фактическому состоянию.
- `macrocycle-to-bb.ts`, annual-training и designer adapters: прокинуть context без потери полей.

## 7. PED и стаж

PED-логика остаётся общей и дозозависимой:

- список веществ;
- `pedDoses`;
- `courseIntensity`;
- level/enhanced;
- тренировочный стаж;
- стаж курса;
- число курсов;
- время после курса;
- recovery и лабораторные данные.

`pedExperience` используется для объяснения и safety, но не должен автоматически повышать объём без фактического recovery и валидного MRV-бюджета.

Для женщин в `female_context` добавить отдельные предупреждения по рискам вирилизации и медицинскому контролю, но не назначать препараты и не строить медицинские протоколы.

## 8. Питание и RED-S

В режиме снижения веса показывать не только процент жира, но и risk-check:

- достаточность энергии относительно FFM и тренировочной нагрузки;
- динамика веса за 7 дней;
- сон, настроение, RPE и выполнение;
- история цикла/его нарушений, если пользователь явно ввёл данные;
- травмы костей/стресс-повреждения;
- железо/ферритин при наличии анализов.

При риске не уменьшать план молча. Показывать предупреждение, снижать агрессивность только после явного подтверждения пользователя или по существующему safety-правилу.

Беременность и ранний postpartum: не применять обычный contest prep/жёсткую сушку/агрессивный taper; требовать медицинского review и отдельный адаптационный путь.

## 9. Persistence и совместимость

Добавить versioned JSON-поля в:

- `he_bb_plans.params`;
- `he_pl_session`;
- annual block config;
- user program meta/design context;
- bridge payloads.

Миграция:

- отсутствующий `athleteMode` -> `standard`;
- отсутствующий `sex` -> профильный sex, если доступен, иначе `male` только для legacy-совместимости;
- старый план не пересобирать автоматически;
- при ручной пересборке показывать, что изменился context.

## 10. UI

Карточка в обоих конструкторах:

```text
Режим спортсмена
[ Стандартный ] [ ♀ Женский контекст ]
```

Под переключателем:

> Основная модель тренинга общая. Женский контекст добавляет категории, нормативы, safety-проверки и индивидуальные рекомендации. Он не означает автоматическое уменьшение или увеличение объёма.

На плане показывать:

- `♀ Женский контекст`;
- политику объёма и применённые факторы;
- PED/stаж/recovery/MRV summary;
- предупреждения, которые реально повлияли на план;
- предупреждения, которые только требуют внимания.

## 11. Тестовая стратегия

### Regression

- стандартный мужской input выдаёт прежний результат;
- отсутствие новых полей не ломает старые JSON;
- старые BB/PL планы загружаются;
- faithful не изменяет исходные данные;
- annual/designer/macrocycle bridge не теряют context.

### BB

- female balanced не получает glute specialization автоматически;
- female glute focus выбирает подходящий сплит только при достаточном числе дней;
- 4 дня не выбирают `female_glute_5` без подтверждения;
- female factors не складываются дважды;
- итоговый объём не превышает MRV;
- per-exercise и session caps сохраняются;
- PED, PED doses, course intensity, training years, recovery, nutrition и labs влияют как раньше;
- contest category соответствует sex.

### PL

- female training использует тот же процентный/RIR pipeline;
- female category и federation tables корректны;
- IPF GL/DOTS совпадают с каноническими функциями;
- male и female weight classes не смешиваются;
- attempts/taper не меняются только из-за пола;
- RED-S safety warning появляется только при соответствующих данных.

### UI/E2E

- кнопка меняет только следующую сборку;
- уже созданный план не меняется;
- режим сохраняется после перезагрузки;
- профильный sex корректно предлагается, но ручной выбор имеет приоритет;
- все пути BB/PL/annual/manual покрыты.

## 12. Порядок реализации после отдельного разрешения

1. Ввести типы context и versioned persistence.
2. Добавить UI-кнопки без изменения генерации.
3. Протянуть context через BB/PL основные пути.
4. Исправить BB selector/focusGroup и убрать риск двойных множителей.
5. Реализовать PL federation + sex competition tables.
6. Подключить женские safety-checks и RED-S signals.
7. Протянуть annual/designer/macrocycle bridges.
8. Добавить regression/property/E2E тесты.
9. Провести сравнение стандартного и женского режима на матрице профилей.
10. Только после этого включать режим в production UI по умолчанию для явно выбранного пользователя.

## 13. Критерии готовности

Работа считается готовой, если:

- старые планы загружаются и не пересобираются сами;
- standard path не меняет текущую модель;
- female_context не обходит ни один cap/validator;
- PED, дозировки, курс, стаж, recovery, nutrition, ACWR, lab и injuries сохраняются;
- BB-женская логика не сводится к принудительному glute-фокусу;
- PL-женская логика корректно учитывает федерацию и дивизион;
- menstrual-cycle adjustments не являются автоматическими без персонального фидбэка;
- pregnancy/postpartum safety не маскируется обычным режимом;
- все новые параметры сохраняются и видны в rationale/export;
- regression и integration tests зелёные.

## 14. Что реализовано (Aug 18 2026, uncommitted)

Ядро плана выполнено и проверено: tsc 0 по проекту; BB+LMS движки 1958/1958; целевые тесты контекста 16/16; UI-smoke BB/PL 14/14.

- NEW `src/engines/athlete-context.engine.ts` — нормализация контекста, policy hints (без скрытых множителей: `volumeMultiplier` всегда 1), summary для rationale.
- BB-engine: `BBBuilderInput.athleteMode/athleteContext`, `BBPlan.athleteMode/athleteContext`, прозрачная rationale-строка и safety-подсказки при женском контексте; legacy-вызовы без контекста не получают новых полей.
- cycle-to-plan: те же поля в `CycleToPlanInput`/`ProgramToBBPlanOpts`, контекст сохраняется в планах обоих путей.
- PL-engine: `LMSBuildInput.athleteMode/athleteContext`, `LMSBuildOutput` хранит контекст; pipeline (проценты/RIR/объём/недели) не меняется — подтверждено тестом на равенство недель.
- UI: тумблеры «Стандартный / ♀ Женский контекст» в BbAutoConstructor (шаг 1) и SRCBBScreen (PL-вкладка), бейдж на плане BB и в PL, подсказка про женский пол из профиля (без авто-включения).
- Persistence: `he_bb_plans.params.athleteMode` + миграция legacy → standard; `he_pl_session.plAthleteMode`; `AnnualBlockConfig/AnnualBuildOptions.athleteMode`; `DesignerToUserWeeksOptions` и `MacrocycleToBBOptions` (sex + athleteMode) прокинуты в autodraftBBPlan.
- Соревнования PL: `IPF_WEIGHT_CLASSES_WOMEN`/`GENERAL_WEIGHT_CLASSES_WOMEN` + `selectWeightClassForSex` (аддитивно, `selectWeightClass` поведение не изменено).
- Тесты: `athlete-context.test.ts` (5), `bb-athlete-context.test.ts` (4: объём/состав не меняются, legacy без полей, PED+контекст валиден), `pl-athlete-context.test.ts` (3: недели идентичны), `bb-plans-migration.test.ts` +1 (athleteMode legacy/female).

### Раунд 2 (Aug 18 2026, pushed c393ccbdc → следующий коммит)

- **Соревновательный UI sex-aware**: PeakingPanel — локальные весовые категории разбиты на мужские/женские (IPF/FPR/WPC), пол берётся из профиля; TaperPlannerTab — `selectWeightClass` → `selectWeightClassForSex(sex, bw, fed)` и BB-ветка больше не хардкодит `male/mens_physique/80кг` (пол, вес и категория из профиля через `normalizeContestCategory`).
- **Мета и экспорт**: `ProgramMeta.athleteMode` + `createFromBuild` пишет контекст из плана (`params.athleteMode ?? plan.athleteMode ?? 'standard'`); BB PDF (🖨) добавляет «· ♀ Женский контекст» в заголовок; BB CSV (📥) добавляет колонку «Контекст».
- **RED-S**: `redsRiskSignals(context, {weightTrendPctPerWeek, bodyFatPct, sleepHours, cycleIrregular, calorieDeficitActive})` в athlete-context.engine — только предупреждения, без авто-изменений; UI-подсказка в карточке режима BB («темп ≤ 0.5%/нед»).
- Тесты: `athlete-context.test.ts` +5 (RED-S), `female-weight-classes.test.ts` 6. Проверено: tsc 0; целевые 32/32; user-program + pl-export + taper 21/21; bb-auto-smoke 5/5.

### Раунд 3 (Aug 18-19 2026, uncommitted)

- **Синхронизация пола с профилем**: ProMetricsPanel и RelativeStrengthCalcTab инициализируют локальный пол из `getProfile()` (ручной выбор остаётся).
- **RED-S в contest prep**: `validateBBContestPrepConfig` — для female при `bodyFatPct < 14` добавляется RED-S warning (нарушения цикла/костное здоровье, темп ≤ 0.5%/нед). Без изменения расчётов.
- **Медицинский advisory**: `athleteContextAdvisory(context)` → `{ level: 'ok' | 'review', reasons }` для pregnancy/postpartum (ACOG 2020) — не меняет план.
- **Печать PL**: `buildPLPrintHtml` принимает опциональный `opts.athleteMode` → «· ♀ Женский контекст» в заголовке (вызывающие PLPlanView не тронуты — файл в чужой зоне).
- Тесты: `athlete-context.test.ts` +3 (advisory) = 13; NEW `bb-contest-prep-female-reds.test.ts` 3. Проверено: tsc 0; contest-prep 187/187; целевые 16/16.
- ВНИМАНИЕ (параллельная работа): чужой агент локально затёр правки раунда 2 в `program-store.ts`/`PeakingPanel.tsx`/`TaperPlannerTab.tsx` (worktree = без них). На origin/main мои коммиты раунда 2 целы (проверено `git grep origin/main`). Эти 3 файла — активная зона других агентов, не перезаписываю.

### Раунд 4 (Aug 19 2026, uncommitted)

- **Репродуктивный контекст в BB-конструкторе**: `REPRODUCTIVE_CONTEXT_OPTIONS` (7 чипов, русские лейблы) в athlete-context.engine; в карточке режима BB — чипы «Естественный цикл/КОК/Беременность/Послеродовой/Перименопауза/Менопауза» (видимы при `female_context`, не меняют план), включены в `athleteContext.reproductiveContext`; при pregnancy/postpartum — красный блок medical review через `athleteContextAdvisory`.
- Тесты: `athlete-context.test.ts` +1 (опции) = 14; NEW `bb-auto-reproductive-context.test.tsx` 2 (SSR карточки режима + отсутствие undefined/NaN). Проверено: tsc 0; целевые 21/21.

### Раунд 5 (Aug 19 2026, uncommitted)

- **PL-конструктор: репродуктивный контекст + medical advisory**: SRCBBScreen — чипы `REPRODUCTIVE_CONTEXT_OPTIONS` в PL-тумблере (при `female_context`), значение в `plAthleteContext.reproductiveContext` + сохраняется в `he_pl_session.plReproductiveContext`; при pregnancy/postpartum — красный review-блок `athleteContextAdvisory`.
- **RED-S с реальными данными в contest-шаге BB**: блок `redsRiskSignals` в шаге «🏁 Contest prep» при `female_context` + собранном `prepPlan` — темп из `prepPlan.preparation.targetRatePctPerWeek`, % жира из профиля.
- Проверено: целевые тесты 38/38 (в т.ч. bb-auto-smoke 5/5, bb-auto-reproductive 2/2, athlete-context 14). tsc по моим файлам чист (ошибки только в чужом MacrocyclePanel WIP).

### Раунд 6 (Aug 19 2026, uncommitted)

- **Печать PL**: PLPlanView передаёт `athleteMode: builtSrc.athleteMode` в `buildPLPrintHtml` — «· ♀ Женский контекст» появляется в PDF-шапке, когда план собран в женском контексте.
- **RED-S/железо в питании (prep)**: `prepNutritionSignals(plan)` в bb-contest-prep.engine — для female: темп > 0.5%/нед → RED-S, плюс железо/кальций/цикл примечания; блок «♀ Питание и RED-S» добавлен в печать prep (`buildContestPrepPrintHtml`).
- Тесты: `bb-contest-prep-female-reds.test.ts` +3 (prepNutritionSignals) = 6. Проверено: tsc 0; contest-prep + pl-export 205/205.
- Пуш НЕ выполнялся (по указанию пользователя).

### Раунд 7 (Aug 19 2026) — пояснения репродуктивного контекста

- `REPRODUCTIVE_CONTEXT_OPTIONS` += `hint` (на что влияет выбор: cycle/КОК — без авто-периодизации, pregnancy/postpartum — medical review, менопауза — кости/белок/восстановление) + `reproductiveContextHint(id)`; в `athletePolicyHints` добавлены контекст-специфичные notes.
- UI (BbAutoConstructor + SRCBBScreen): title-подсказка на чипах и блок с пояснением выбранного контекста под чипами.
- Тесты: `athlete-context.test.ts` обновлён (hint у всех опций + reproductiveContextHint). Проверено: tsc 0; целевые 22/22.

### Осталось на будущие раунды

- Нет активных пунктов (оба закрытых пункта выполнены; IndividualPlan-питание — при необходимости отдельным этапом вне этой задачи).

## 15. Источники
- Refalo et al., 2025, sex differences in hypertrophy: https://doi.org/10.7717/peerj.19042
- Roberts et al., 2020, sex differences in resistance training: https://pubmed.ncbi.nlm.nih.gov/32218059/
- McNulty et al., 2020, menstrual cycle and exercise performance: https://pmc.ncbi.nlm.nih.gov/articles/PMC7497427/
- D'Souza et al., 2023, menstrual hormones and exercise physiology: https://pmc.ncbi.nlm.nih.gov/articles/PMC10979803/
- Sims et al., 2023, ISSN female athlete nutrition position stand: https://pmc.ncbi.nlm.nih.gov/articles/PMC10210857/
- IOC REDs consensus, 2023: https://bjsm.bmj.com/content/57/17/1073
- ACOG exercise during pregnancy/postpartum: https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period
- IPF technical rules: https://www.powerlifting.sport/rules/codes/info/technical-rules
- IPF GL Formula: https://www.powerlifting.sport/rules/codes/info/ipf-formula
