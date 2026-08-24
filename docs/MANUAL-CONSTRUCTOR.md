# Ручной конструктор — архитектура и план доработки (выполнено 100%)

## Цель
Легко собрать любую программу в ручном режиме: красивая оболочка + интеллигентные движки + библиотека 29+66 → 3 клика для новичка, 5 минут для профи.

## Архитектура (UI-слой)

```
ProgramManagerPanel (Выбор → Редактор → Итог)
  ├─ ManualUI (единый слой как CardioUI)
  │   ├─ ManualHeader (акцент-карточка + Step N из 3 + progressbar)
  │   ├─ ManualStepper (3 пилюли, градиент активного)
  │   ├─ SectionCard / Badge / ProgressBar / InfoBanner / VolumeMiniBar / ScoreBadge
  │   └─ CARD / CARD_ACCENT / BTN / CHIP токены
  ├─ ManualLibraryGallery (29 FullProgram + 66 LMS)
  │   ├─ фильтры: поиск / уровень / цель / дни / избранное (he_program_fav/he_cycle_fav)
  │   ├─ ⭐ Рекомендовано (loadTrainingProfile → score по уровню/дням/цели)
  │   ├─ превью недели-1, сравнение 2, 1-клик «Взять за основу»
  │   └─ cloneFromLibrary / cloneFromCycle
  ├─ ManualProgramWizard (5 шагов: Тип → Цель → Формат → Каркас → Превью)
  │   └─ шаг 5 live: buildBBUserProgramFromProfile + computePlanQualityFor → Score + чипсы
  └─ ProgramEditor (внутри Редактора)
      ├─ BBEditor (недели → сессии → блоки)
      │   ├─ boardMode 🗂 Доска / 📋 Список (he_bb_board_mode, 320px)
      │   ├─ live качество ScoreBadge + ProgressBar + чипсы perMuscle (computePlanQualityFor)
      │   ├─ VolumeMiniBar compact per сессия (MEV/MRV)
      │   ├─ SessionList: ▲/▼ дней (moveSession) + ↗ меж-дневное (moveBlockToSession)
      │   └─ BlockList: ▲/▼ внутри дня + ↗ в другой день + 🔍 поиск + грид-карточки
      ├─ PLEditor / HybridPlanPanel
      └─ Pro-панели (4 группы): Баланс / Периодизация / Обратная связь / Инструменты
          └─ ▼ Дополнительно: прогноз/what-if, биомеханика

Итог: ManualHeader + ScoreBadge + Validation + чек-лист + 📤 JSON / 📅 ICS (ManualExport.ts)
```

## Интеллигентные движки (внедрены)

| Движок | Файл | Где внедрён |
|--------|------|-------------|
| `suggestExercisesForGroup` | `exercise-selector.engine.ts` | `BlockList` пикер (12 кандидатов, фильтр по оборудованию/слабым/травмам/избранному) + `🔍` поиск |
| `selectBestBBSplit` | `bb-selector.engine.ts` | `ManualLibraryGallery` рекомендованные 3 + `autodraftBBPlan` в визарде |
| `getVolumeLandmarks` | `volume-landmarks.engine.ts` | `VolumeMiniBar` per сессия, `MesoHeatmap` inline, `ScoreBadge` |
| `computePlanQualityFor` | `manual-quality.engine.ts` | Live в `BBEditor` + Итог `ScoreBadge` + визард превью |
| `buildBBUserProgramFromProfile` | `auto-fill-draft.ts` | Визард шаг 5, `⚡ Собрать качественно` |
| `findSubstitutions` | `exercise-substitution.engine.ts` | `BlockList` замена `↻` (не показана, но доступна) |
| `calcBBPlanMetrics` | `bb-metrics.engine.ts` | Итог `тяж/памп/RIR` |
| `labTrainingAdjust` | `lab-training-adjust.ts` | `RealMRVPanel` (MRV×) |

Библиотека: `complete-program-library:4` + `programs-data:20` + `LMS 66` = 90 шаблонов, все через `UserProgram` (`program-store.ts`).

## Красивый внешний вид (ManualUI)

Токены `training-ui.tsx` + `ManualUI.tsx` (фрост-гласс, `blur 18px`, `ACCENT #00e68a`). Все карточки `CARD/CARD_ACCENT`, кнопки `BTN/BTN_GHOST/CHIP_ACTIVE`, чипсы `Badge`, прогресс `ProgressBar` — единый стиль как в `CardioConstructor`.

*Шапка* — `ManualHeader` акцент-карточка (`Шаг N из 3 — метка`, чипы сводки, прогресс-бар `role=progressbar`).
*Степпер* — `ManualStepper` пилюли с `role=radio`, `aria-pressed`, градиент активного.
*Доска* — `boardMode` горизонтальный скролл, `320px` колонки, `a11y` `aria-pressed`.
*Кнопки* — `minHeight 44` (телефон), `▲/▼` `28×22` + `↗` `32px`, `disabled` 0.35.

## Телефон (без перетаскивания)

* Недели: `▲/▼` (`swapWeek`) вместо `Ниже`/`drag`.
* Упражнения: `▲/▼` (`moveBlock`) + `☰` drag только десктоп, `↗` в другой день (`moveBlockToSession` + picker).
* Дни: `▲/▼` (`moveSession`).
* Пикер: `🔍` + грид-карточки `180px` вместо списка кнопок.

## Экспорт

`ManualExport.ts` — `buildProgramIcs(program, startDate?)` (VEVENT на сессию, `X-WR-CALNAME`, `escapeIcs`, `09:00Z`, `UID`) + `downloadIcs`. Кнопка `📅 ICS` в Итоге и топбаре редактора рядом с `🖨 PDF`.

## Тесты

`manual-constructor` + `ProgramEditorComponents` интерактивные — `vitest run manual-constructor` 86→~95, `tsc --skipLibCheck` 0 по своим файлам.

## Файлы (только свои)

```
src/ui/screens/TrainingScreen_parts/ManualUI.tsx (NEW)
src/ui/screens/TrainingScreen_parts/ManualLibraryGallery.tsx (NEW)
src/ui/screens/TrainingScreen_parts/ManualExport.ts (NEW)
src/ui/screens/TrainingScreen_parts/ManualProgramWizard.tsx (5 шагов)
src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx (Header/Stepper/Gallery/ICS/ScoreBadge)
src/ui/screens/TrainingScreen_parts/ProgramEditorView.tsx (Stepper/ICS/аккордеоны)
src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx (доска/VolumeMiniBar/пикер/▲/▼/↗/live качество)
docs/MANUAL-CONSTRUCTOR.md (NEW)
```

Чужие `Combat/StrengthSport/IndividualPlan/Cardio` не тронуты, `git commit -- <pathspec>` соблюдён.
