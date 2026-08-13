# PL Movement Diagnostics Calculator — единый блок «Мёртвые точки → Слабые точки → Движение штанги»

> Статус: ПЛАН (согласован с пользователем). Код НЕ начат.
> Дата: 2026-08-13

## Цель

Заменить разрозненные диагностики движения единым калькулятором:
- **Мёртвые точки** (sticking points, углы суставов — lift-diagnostics.engine)
- **Слабые точки** (weakpoint-pl: фазы срыва → ассистенты + %ПМ)
- **Движение штанги** (bar-path отклонения → причины → коррекции)

Пользователь сам вводит данные (движение → фаза → отклонения) и получает
**по каждому параметру упражнения из раскладки цикла + анализ, какое упражнение оптимально для проработки**.
Никакого авто-детекта из дневника — только ручной ввод (решение пользователя).

## Решения пользователя (зафиксированы)

1. Анализ оптимальности — только в новом блоке (НЕ подключать к выбору слабых групп в ПЛ-авто).
2. Добавление в ПЛ-авто: одно на выбор ИЛИ все сразу; показывать и ⭐ рекомендуемые, и существующие.
3. SVG-схема траектории — ОБЯЗАТЕЛЬНА (идеальная линия vs отклонение + зоны bottom/mid/lockout).
4. Протокол упражнений — из раскладки цикла (как у слабых групп: set-блоки аксессуара дня/недели, RIR из RIR_MATRIX, MRV-бюджет уровень×PED×ACWR), НЕ жёсткий 3×10@60%.
5. Калькулятор живёт в ⚡ Интеллект тренировки (DiagnosticsHub), отображается встроенным на панели ПЛ-авто и в ручном конструкторе.
6. Страж-панель BiomechanicsPanel (ProGuardPanels) — заменить на новый блок (везде сразу).
7. В PlannerToolsPanel (вкладка «🔧 Инструменты» ПЛ-авто) — убрать карточки `deadpoints-barpath` и `weak`; карточку `intelligence-diagnostics` (полный Hub) ОСТАВИТЬ.
8. Срывы (StickingPointAnalysisCard, анализ дневника RPE≥8) — ОСТАВИТЬ отдельным режимом в DiagnosticsHub, НЕ включать в калькулятор.

## Архитектура

### 1. Движок — `src/engines/pro/lift-diagnostics.engine.ts` (+тесты)
- Расширить `BarPathIssue`: `{ lifts: Lift[], relatedWeakPoint: WeakPoint | null, assistance: string[] }`
  - `lifts` — для каких движений применим (hips_shoot_up→squat; bar_loops→bench/squat; forward_drift→deadlift/squat; asymmetric→все; good_morning→squat)
  - `relatedWeakPoint` — связь с фазой (hips_shoot_up↔squat.bottom; forward_drift↔deadlift.start; bar_loops↔bench.mid)
  - `assistance` — перенести `BAR_PATH_EXERCISES` из UI (PlDeadpointsBarPathCard.tsx:16)
- `barPathAnalysis(lift, issues)` — фильтровать issues по движению
- Новый `diagnoseMovement(lift, phase)` → `{ weakPoint, sticking, barPath }` — три ракурса по одному якорю

### 2. Анализ оптимальности — `src/engines/lms/lms-builder.engine.ts`
(переиспользовать `PL_WEAK_GROUP_ALLOWED_PATTERNS` / `getPLWeakGroupExerciseCandidates`)
- `rankPLAssistanceForIssue(lift, phase, issue, template)` → упражнения для weakMuscles фазы:
  - исключить основные лифты цикла (primary-паттерны), занятые паттерны/substitution groups
  - ранжировать: паттерн в PL-пуле мышцы → совпадение с раскладкой цикла → PL-использование (LMS_EXERCISES.uses) → оборудование → fatigueCost
  - каждому: `rationale` («нагружает квадрицепсы (bottom), паттерн совпадает с циклом, не дублирует присед») + `optimal: true` для топ-1
- **Протокол из раскладки цикла** в `injectDiagnosticExercises`: заменить жёсткие `3×10 @60% RIR 3` на set-блоки аксессуара дня/недели (`weekLayout`), RIR из `RIR_MATRIX`, MRV-бюджет — по аналогии со слабыми группами

### 3. UI — переписать `PlDeadpointsBarPathCard.tsx` (единый блок)
```
🎯 Мёртвые точки → Слабые точки → Движение штанги
 [селектор движения: 7]
 ├─ 1. Слабые точки    — чипы фаз (ручной выбор) → описание, ассистенты, «💾 фокус-группа в профиль»
 ├─ 2. Мёртвые точки   — та же фаза: угол сустава, слабые мышцы, причина, коррекции, cue
 ├─ 3. Движение штанги — 5 чипов отклонений (для присед/жим/тяга) + SVG-схема траектории
 └─ Результат по каждому параметру:
      [⭐ Тяга гантели в наклоне  3×8 @65% RIR 2 — почему оптимально]
      [Тяга горизонтального блока 3×10 @55% RIR 3 — обоснование]
      [другие доступные...]
      кнопки: «➕ это» · «➕ все рекомендуемые» · «➕ все»
      [🛠 Добавить выбранные в ПЛ-авто] [💾 В профиль]
```
- Синхронизация фазой: подсветка связанных issues (БЕЗ авто-выбора)
- SVG: для приседа — S-образная идеальная линия; forward_drift — уход вперёд; hips_shoot_up — излом внизу; good_morning — наклон в нижней трети; bar_loops — петля; asymmetric — боковое смещение; разметка зон фаз

### 4. Размещение
| Место | Действие |
|---|---|
| ⚡ Интеллект → Диагностика (`DiagnosticsHub`) | ДОМ: калькулятор главным режимом; удалить режимы `weakpoints`/`deadpoints`/`biomechanics` (внутр. DiagnosticsBiomechanicsCard); оставить `sticking`, `rir`, `mesocorr` |
| Панель ПЛ-авто (`SRCBBScreen.tsx:~1152`) | встроенный блок ОСТАЁТСЯ (dayCount из цикла) |
| Ручной конструктор (`ProgramEditorView.tsx:~659`) | встроенный блок ОСТАЁТСЯ |
| Страж-панель (`ProGuardPanels.tsx` BiomechanicsPanel ~719) | ЗАМЕНИТЬ на новый блок |
| `PlannerToolsPanel` (Инструменты ПЛ-авто) | убрать карточки `deadpoints-barpath` (строка 43) + `weak` (59); `intelligence-diagnostics` (44) ОСТАВИТЬ |

### 5. Удалить / оставить
- Удалить: `DiagnosticsBiomechanicsCard` (дубль в DiagnosticsHub), `PlWeakpointsCard` (функции в блоке), `ProPlToolsTab` (мёртвый), `BiomechanicsPanel` (замена). `PlDeadpointsBarPathCard` переписывается в новый блок.
- Оставить: `StickingPointAnalysisCard` (срывы, отдельно), `DiagnosticsHub` (дом).

### 6. Тесты
- движок: `diagnoseMovement` bundle; barPath lift-фильтр + relatedWeakPoint + assistance; `rankPLAssistanceForIssue` (исключение основных лифтов, топ-1 optimal, rationale, протокол из недели цикла, MRV-бюджет)
- UI: renderToStaticMarkup smoke блока
- существующие 236+ LMS/PL-тестов не сломаны

## Порядок реализации
1. Движки (lift-diagnostics + rankPLAssistanceForIssue + протокол из цикла) + тесты
2. UI единого блока (SVG, секции, кнопки добавления)
3. Размещение: DiagnosticsHub (дом) + SRCBBScreen + ProgramEditorView + замена BiomechanicsPanel + чистка PlannerToolsPanel
4. Удаление старых компонентов
5. tsc + vitest + vite build
