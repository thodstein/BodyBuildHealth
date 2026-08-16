# ANNUAL-TRAINING-INTEGRATION.md — план интеграции годового плана (отдельный этап)

Годовой план по конструкторам (`src/engines/annual-training/` + карточка
«🧩 Сборка года по конструкторам» в MacrocyclePanel) готов и покрыт тестами.
Два направления интеграции сознательно отложены — они затрагивают файлы других
агентов (`BbAutoConstructor.tsx`, `IndividualPlanContext.tsx`). Этот документ —
обзор точек интеграции и план реализации отдельным этапом.

## Текущее состояние (что уже умеет годовой план)

- `AnnualTrainingPlan` в `he_annual_training_plan_v1`; блоки со статусами
  unbuilt/built/stale/error, тип конструктора PL/BB/MANUAL.
- Сборка блока своим конструктором, taper внутри блока, пик-неделя ББ.
- Ручной roundtrip через мост `annual_block` (ProgramManagerPanel.commit).
- Событие `he-annual-training-plan-updated` при каждом сохранении плана
  (detail: `{ planId, status, totalWeeks, blockKey? }`).
- Событие `he-bb-plan-saved` (деталь `{ plan, date }`) — при передаче
  ББ-блока в ББ-авто из карточки сборки.

## 1. Интеграция с ББ-авто (BbAutoConstructor.tsx) — отдельный этап

### Точки интеграции (найдено в коде)

| Точка | Строки | Что есть |
|---|---|---|
| Приём внешнего плана | 887-914 | `onExternalPlan` читает `he_bb_plan_saved` по событию `he-bb-plan-saved`, ставит шаг 'plan', гидратит план |
| Шаг Contest prep | 96, 1555-1560 | `step === 'contest'`, `renderContestPrep()`; сборка через `buildBBContestPrepPlan` + `applyContestPrepToBBPlan` |
| Контекст шага annual | 4183-4212 | `step === 'annual'` встраивает MacrocyclePanel с `storageKey="he_bb_macro"` |
| Пик-неделя оверлей | 615-623, 3467 | `applyPeakWeekToCurrentPlan` / кнопка «🎭 Peak week» |

### Что предлагается реализовать (этап 6)

1. **Передача конфига ББ-блока в ББ-авто.** При «🚀 В ББ-авто» из карточки
   сборки помимо `he_bb_plan_saved` класть `he_bb_plan_saved_ctx`:
   ```json
   { "blockKey": "...", "phase": "contest_prep", "weeks": 12,
     "peakWeek": true, "peakConfig": { ... }, "taper": { "enabled": true } }
   ```
2. **BbAutoConstructor** (после гидрации плана на шаге 'plan'):
   - если в контексте `peakWeek` — автоматически открыть шаг 'contest' с
     префиллом `peakConfig` (дата шоу из блока уже внутри);
   - если `phase === 'contest_prep'` — подсветить шаг '🏁 Contest prep' бейджем
     «из годового блока».
3. **Проверка непротиворечивости**: при перестроении плана (revalidate после
   правок) контекст не трогается; `prepProtocol`-недели защищены финализатором.
4. **Обратная связь**: при успешной сборке contest prep из блока — событие
   `he-annual-training-plan-updated` с `blockKey`, чтобы панель отметила блок
   (если пользователь менял план в ББ-авто, блок помечается 'stale' только
   явным действием — авто-пересборки нет).

### Критерии приёмки (этап 6)

- ББ-блок с пиком → «🚀 В ББ-авто» → шаг «План» с планом блока → авто-открыт
  шаг «Contest prep» с датой шоу из соревнования блока.
- Повторная финализация в «Коррекции» не «раздувает» taper/пик (guard
  `isPrepControlled` уже в финализаторе).
- Чужие шаги ББ-авто не меняются (params/ped/split/quality/adjust остаются).

## 2. Интеграция с планировщиком питания (IndividualPlanContext.tsx) — отдельный этап

### Точки интеграции (найдено в коде)

| Точка | Строки | Что есть |
|---|---|---|
| Гидрация prep-плана | 416-427 | слушает `he-bb-contest-prep-updated`, перечитывает `planFromStored` |
| Цели на дату | 1679-1681 | `nutritionTargetsForPrepDate(date, bbPrepPlan, base)` при `prepPhaseForDate(...) !== null` |
| Импорт движка | 33 | уже импортирует `nutritionTargetsForPrepDate`, `planFromStored`, `configFromPlan` |
| Календарь недель | — | есть `macroWeekForDate` (панель), для питания нужен активный блок года на дату |

### Что предлагается реализовать (этап 7)

1. **Хелпер в годовом движке** (уже есть частично): `activeBlockForWeek(plan, week)`
   + `macroWeekForDate(isoDate)` — неделя года для произвольной даты.
   Добавить экспорт `annualPlanPhaseForDate(plan, isoDate) → { week, phase, kind, status } | null`
   (чистая функция в `block-builders.engine`; неделя = `macroWeekForDate`-подобная
   логика, блок = `activeBlockForWeek`).
2. **IndividualPlanContext**: слушать `he-annual-training-plan-updated`
   (паттерн уже есть для contest-prep): перечитывать `loadAnnualTrainingPlan()`.
3. **Логика целей**: если на дату активен BB-блок фазы `contest_prep` с
   `peakConfig` — текущие `nutritionTargetsForPrepDate` уже покрывают prep/taper/пик
   (источник `goals.bbContestPrepPlan`/`bbPeakConfig`). Годовой план лишь
   синхронизирует даты: при `annualPlanPhaseForDate` с фазой `contest_prep`
   и отсутствии prep-плана — показать подсказку «постройте contest prep в
   ББ-авто (шаг «🏁 Contest prep»)» вместо молчаливых базовых целей.
4. **Некритично**: для фаз `hypertrophy/strength/transition` — заметка в карточке
   питания «неделя N года · фаза X», без изменения целей.

### Критерии приёмки (этап 7)

- Событие `he-annual-training-plan-updated` перечитывает годовой план в
  IndividualPlanContext (живая синхронизация без перемонтажа).
- На дате в пик-неделе BB-блока питание показывает цели пик-недели
  (существующий путь `nutritionTargetsForPrepDate`), если prep-план собран.
- Без prep-плана — информативная подсказка, не сломанные цели.

## 3. Пункты, реализованные в этой задаче (вне этапов 6-7)

- ПЛ-блок → ПЛ-авто («✓ В ПЛ-авто» через `onApplyCycle`).
- Снапшоты сборки года (сохранить/сравнить/восстановить).
- Копирование настроек блока из другого блока (kind+конфиг).
- Авто-рекомендация конструктора по фазе (чип «💡 Рекомендуем»).
- Строка дневника в карточке сборки (сессии 7/28д, ACWR, «📍 по дневнику»).

## Порядок выполнения этапов 6-7

1. Этап 6: правки только в `BbAutoConstructor.tsx` (шаги 'plan'/'contest') +
   контекст-ключ из карточки сборки (MacrocyclePanel, мой файл).
2. Этап 7: хелпер `annualPlanPhaseForDate` в годовом движке (мой файл) +
   слушатель и подсказка в `IndividualPlanContext.tsx`.
3. Тесты: панель (передача контекста), BbAutoConstructor smoke (гидрация
   из контекста), IndividualPlan (фаза года в подсказке).
4. Прогон tsc + vitest по затронутым областям; AGENTS.md — отдельная секция.
