# ПЛ-авто: сезон по микроциклам + циклы между соревнованиями + экран по шагам

Дата: Aug 21 2026. Обновлён: Sep 02 2026 — «любое изменение цикла только по согласию». Статус: ✅ ВЫПОЛНЕН (реализация завершена, 3 фазы + тесты, пуш eab1887c). Дополнено Sep 03: дубль слота + speed-fallback + сводка strict_skip.

Три запроса пользователя, решаемых аддитивно поверх существующей структуры:

1. **Авто-сбор цикла по микроциклам** в зависимости от параметров пользователя — новый РЕЖИМ
   в ПЛ-авто: и авто-подбор каждого периода, и ручной выбор каждого цикла из подходящих в базе.
2. **PL-auto taper: цикл между соревнованиями** — если цикл больше окна между стартами
   (например 8-нед цикл при 12 неделях между соревнованиями), цикл «ужимается» БЕЗ потери
   своей логики, taper/пик применяется, время между стартами не простаивает. Цикл на каждый
   пролёт можно и АВТО-подобрать, и ВРУЧНУЮ выбрать из подходящих в базе (как в задаче 1).
3. **Разгрузить экран ПЛ-авто** — пошаговая структура:
   `1. Настройки (+ПЕД +питание) → 2. Слабые точки и 10 калькуляторов → 3. План →
   4. Графики → 5. Справочная информация и отчёты`; вкладки «🏁 Соревнования» и
   «🗓 Годовой план» остаются отдельными как сейчас.

---

## 0. Контекст (что уже есть, на чём строим)

Инвентарь существующих механизмов, которые НЕ переделываем, а используем:

| Механизм | Файл | Роль для плана |
|---|---|---|
| Реестр СРЦ-циклов (базовые + блоки + embed + СРЦ2 + ББ) | `src/data/lms-cycles/lms-cycle-index.ts` | источник кандидатов |
| Скоринг/подбор цикла | `src/engines/lms/lms-selector.engine.ts` (`rankCycles`, `selectBestCycle`, `explainSelection`) | авто-выбор по периоду/уровню/направлению/весу/дням/режиму |
| Сборка плана из шаблона | `src/engines/lms/lms-builder.engine.ts` (`buildLMSPlan`, `originalCycleWeeks`, `appendPLTaperWeeks`) | построение недель, `weeksOverride` уже растягивает цикл |
| Сезонные пики | `src/engines/lms/lms-macro-taper.engine.ts` (`buildPLSeasonPeaks`, `applyMacroTaperToPLWeeks`) | пик-блок/тапер/mock/старт/пост под каждый старт |
| Канон кривой тапера | `src/engines/lms/lms-taper.engine.ts` (TaperCurvePoint, buildPLTaperCurve) | кривые classic/pl/pro/wf |
| Годовой планировщик | `src/engines/lms/macrocycle.engine.ts` + `MacrocyclePanel.tsx` | НЕ трогаем (отдельная вкладка) |
| Мастерская тапера | `src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx` | НЕ трогаем (вкладка «Соревнования») |
| 10 калькуляторов лимитирующих факторов | `src/engines/pro/limiter-calculator.engine.ts` + `LimiterCalculatorCard.tsx` | уже есть `LIMITER_CATEGORIES` ровно 10 — шаг 2 переиспользует |
| Калькулятор движения | `src/ui/screens/TrainingScreen_parts/PlDeadpointsBarPathCard.tsx` | шаг 2 переиспользует |
| Графики | `TrainingMetricsChart` (проп `lms`), `ProMetricsPanel` | шаг 4 переиспользует |
| Экспорт/печать | `src/ui/screens/SRCBBScreen_parts/pl-export.ts` | шаг 5 переиспользует |
| Экраны ПЛ | `src/ui/screens/SRCBBScreen.tsx` | единственный UI-файл, который правим мы |

Ключевые факты, на которых строится план:

- **`SRCycleMeta.period`** = `'strength' | 'endurance' | 'peak' | 'mass' | 'mixed'`. Периода
  «скорость/координация» НЕТ. Нигде нет exhaustive-switch по `SRPeriod` (grep подтвердил) —
  но и вводить новый период в 42 файла цикла не будем (инвазивно). Вместо этого — **отдельный
  аддитивный индекс скорости** (см. Фазу 1).
- **`buildLMSPlan.weeksOverride`** уже умеет растягивать цикл на произвольное число недель
  (PM-прогрессия). «Ужимать» он НЕ умеет — это и есть новая движковая функция `fitCycleToWeeks`.
- **`buildPLSeasonPeaks(baseWeeks, meets, opts)`** продлевает базовые недели до последнего
  старта и под каждый старт ставит пик-блок (окно → ramp → mock → глубокий тапер → старт → пост).
  Это готовый верхний слой для задачи 2.
- Текущий PL-экран (subView `plan`) перегружен: настройки + режим атлета + рекомендованный цикл
  + каталог + ПМ + ПЕД + питание + тапер-статус + PLPlanView в одном длинном списке — жалоба №3.

---

## 1. Не трогаем / правила работы

- **Чужие файлы (WIP, незакоммичено):** `api/ocr-image.ts`, `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx`.
- **Файлы других агентов в этой задаче:** `MacrocyclePanel.tsx`, `PLCompetitionTab.tsx`,
  `PeakingPanel.tsx`, `RecoveryPanel.tsx`, `AutoregPanel.tsx`, `AnnualTraining*`, `cardio.*`,
  `exercise-catalog.ts`, движки ББ (`bb-*`), `AGENTS.md`.
- **Правило файла:** не смешивать bash-скрипты и edit на одном файле; после любого скрипта
  перечитывать файл перед edit.
- **Правило git:** коммитить ТОЛЬКО свои файлы через `git commit -- <paths>`. Чужие застейдженные
  изменения не подметать. ОТКАТЫВАТЬ чужое ЗАПРЕЩЕНО.
- **Аддитивность:** новые движки — новые файлы или чистые добавления экспортов; сигнатуры
  существующих экспортов не меняем (допустимы только опциональные новые поля/параметры).
- **Числа целочисленные и валидированные** (Number.isFinite, клампы) — как в истории проекта.

---

## 2. Фаза 1 — Движок сезона по микроциклам (авто + ручной подбор)

Новый файл: **`src/engines/lms/lms-season.engine.ts`** (чистые функции, без UI/localStorage).
Плюс аддитивный индекс скорости: **`src/data/lms-cycles/lms-speed-index.ts`** (NEW).

### 2.1 Периоды-слоты (микроциклы)

```ts
export type PLSeasonPeriod = 'endurance' | 'strength' | 'speed' | 'peak';

export interface PLSeasonSlot {
  period: PLSeasonPeriod;
  label: string;            // «Выносливость», «Сила», «Скорость/координация», «Выход на пик»
  weeksMin: number;
  weeksMax: number;
  defaultWeeks: number;     // автозаполнение сезона
}
```

Канонические слоты пользователя:
- Выносливость — 6–20 нед (default 12)
- Сила — 6–12 нед (default 8)
- Скорость движений, координация — 6–10 нед (default 6)
- Выход на пик перед соревнованиями — 8–10 нед (default 8)

`buildDefaultSeasonSlots(): PLSeasonSlot[]` — эти 4 слота. Пользователь может: включать/выключать
слот, менять недели (кламп в [weeksMin, weeksMax]), переставлять порядок (как `moveMacroBlock`),
добавлять повтор слота (например сила → скорость → сила).

### 2.2 Индекс скорости/координации (без правки 42 циклов)

`lms-speed-index.ts`:

```ts
export type SpeedOrientation = 'explosive' | 'coordination' | 'technique' | 'tempo' | 'speed_strength';
export const SPEED_CYCLE_IDS: Record<string, SpeedOrientation[]>;
export function speedOrientationOf(cycle: SRCycleTemplate): SpeedOrientation[]; // [] если не найден
```

Заполняем ТОЛЬКО циклами, где в `meta.description`/`howItWorks`/`tags` реально видна скоростная/
координационная/техническая направленность (например СРЦ2 с «скоростн», «техник», «координац»,
«взрывн», «развитие скорости», циклы-«волны» с работой на скорость). По умолчанию — пусто; слот
`speed` без кандидатов получает честный warning «нет циклов скорости в базе» и предложение
использовать `strength`-циклы с акцентом на скорость (метка в плане).

### 2.3 Подгонка цикла под окно недель — `fitCycleToWeeks` + принцип «любое изменение — только по согласию»

> **Итоговая договорённость с пользователем:** любое изменение раскладки цикла (растяжение/ужатие) — ТОЛЬКО по явному согласию. Без согласия цикл идёт 1:1.

```ts
export interface FitResult {
  cycle: SRCycleTemplate;
  weeks: number;                    // фактическая длина после подгонки
  mode: 'exact' | 'proposed_extend' | 'proposed_shrink' | 'strict_skip';
  correctionPctEff?: number;        // пересчитанный темп прогрессии (для proposed_shrink)
  needsConsent: boolean;            // true → требуется согласие пользователя
  notes: string[];
}
export interface FitOptions {
  minCycleFloor?: number;           // default 4
  // strict удалён — теперь всегда strict. Любая подгонка требует consent.
}
export function fitCycleToWeeks(cycle: SRCycleTemplate, targetWeeks: number, opts?: FitOptions): FitResult;
export function applyFitConsent(result: FitResult, consent: boolean): FitResult; // consent=false → strict_skip
```

**Источник никогда не перезаписывается:** `LMS_CYCLES` и файлы `src/data/lms-cycles/*.ts` — immutable канон. Любая подгонка возвращает **производную копию** `derived` и помечается `needsConsent=true`.

- **`targetWeeks === originalCycleWeeks(cycle)` → `exact`, `needsConsent=false`** — сборка 1:1, без диалога.
- **`targetWeeks !== original`** → `proposed_extend` / `proposed_shrink`, `needsConsent=true`:
  - **extend:** `weeksOverride=targetWeeks` (механика `buildLMSPlan`) — но НЕ применяется до согласия.
  - **shrink:** как раньше (выборка недель или `correctionPctEff = correctionPct * original / target`, кап 2×), но тоже только предложение.
  - UI показывает модалку согласия: `⚠️ Цикл «X» 12 нед не влезает в окно 7 нед. Предложение: сжать до 7 нед (фазы сохранены, темп 0.5%→0.85%). [✓ Согласен, применить] [✕ Оставить как есть 12 нед] [🔄 Выбрать другой цикл]`.
  - Без `Согласен` → `applyFitConsent(..., false)` возвращает `{ weeks:0, mode:'strict_skip', needsConsent:false, notes:['⛔ Без согласия — раскладка не изменена'] }`, сегмент блокирует сборку и подсвечивается `⛔ Требует согласия`.
- Минимальная граница `weeksMin=4` — окно <4 сразу `strict_skip` без предложения shrink.
- Одиночный цикл (`buildSrc` `faithful:true`) не проходит через `fit` — всегда `exact`.

### 2.4 Кандидаты под слот — `candidateCyclesForSlot`

```ts
export function candidateCyclesForSlot(slot: PLSeasonSlot, input: LMSSelectorInput): LMSRankedCycle[];
```

- endurance → `rankCycles({ ...input, goal: 'endurance' })`
- strength → `rankCycles({ ...input, goal: 'strength' })`
- peak → `rankCycles({ ...input, goal: 'peak' })`
- speed → фильтр по `SPEED_CYCLE_IDS` + совместимость по уровню/направлению/дням (мини-скоринг,
  переиспользуя поля `meta`), сортировка по score.
- Дополнительный фильтр по влезаемости недель: циклы с `originalCycleWeeks > slot.weeksMax`
  уходят вниз списка (кроме peak-слотов: 12-нед циклы можно сжать до 8–10 — показываем с пометкой
  «можно сжать» через `fitCycleToWeeks`).
- Возврат `LMSRankedCycle[]` → UI показывает «подходящие в базе» для ручного выбора.

### 2.5 Авто-сбор сезона — `planSeason` (авто/ручной) и `assembleSeasonPlan`

```ts
export interface PLSeasonInput {
  slots: PLSeasonSlot[];               // слоты (уже применённые пользователем)
  selector: LMSSelectorInput;          // уровень/направление/вес/дни/режим
  mode: 'auto' | 'manual';             // режим выбора (жалоба №1)
  selections?: Record<number, string>; // manual: id цикла на слот по индексу
  consents?: Record<number, boolean>;  // согласие на изменение каждого слота (slotIdx → true/false)
  taper?: MacroTaperOpts;              // тапер-настройки (пробрасываются наверх)
  meets?: PLSeasonMeet[];              // соревнования (для пиков и окон, Фаза 2)
}

export interface PLSeasonSegment {
  slot: PLSeasonSlot;
  cycleId: string;
  cycleTitle: string;
  weeks: number;
  fit: FitResult;                      // как ужат/растянут цикл
  candidates?: LMSRankedCycle[];       // для manual-режима (подбор в UI)
  rationale: string[];
}

export interface PLSeasonPlan {
  segments: PLSeasonSegment[];
  totalWeeks: number;
  notes: string[];
  cycleIds: string[];                  // последовательность id (для сохранения в сессию)
}

export function planSeason(input: PLSeasonInput): PLSeasonPlan;
```

- `mode:'auto'` → для каждого слота `candidateCyclesForSlot(...)[0]`, затем
  `fitCycleToWeeks(candidate, slotWeeks)`. Если `needsConsent=true` — в UI показывается диалог согласия, без согласия слот = `strict_skip`.
- `mode:'manual'` → `selections` задаёт id; выбранный цикл проверяется через
  `candidateCyclesForSlot` (валидность выбора) + `fitCycleToWeeks(...)` с тем же диалогом.
- `assembleSeasonPlan(plan, opts: { pmMap, fallbackPm, mode, courseIntensity, peds, pedDoses,
  nutrition, autoReg, pmAutoReg, athleteMode, athleteContext, recovery }): LMSBuildOutput` —
  последовательный проход: для каждого сегмента `buildLMSPlan({ template, weeksOverride: seg.weeks,
  ...общие параметры })`, склейка недель с перенумерацией (паттерн `buildSrcMacrocycle` в
  SRCBBScreen.tsx), `macroPhase: seg.slot.period` на неделях сегмента. Опционально
  `buildPLSeasonPeaks(...)` поверх (Фаза 2), если переданы `meets`.
- При отказе от согласия (`consents[i]!==true` и `needsConsent`) сегмент не собирается — в `notes` предупреждение, в UI карточке слота красный бейдж `⛔ Требует согласия` + кнопки `[Согласен] [Выбрать другой]`.
- Сохранение выбора в сессию: ключи `he_pl_session.season = { slots, mode, selections, consents, cycleIds }`
  (обратно-совместимо: отсутствие consents → все `false`, сборка блокируется до явного согласия).

---

## 3. Фаза 2 — Цикл между соревнованиями: ужатие + taper/пик в ограниченном окне

Новый файл: **`src/engines/lms/lms-comp-gap.engine.ts`** (аддитивный, чистые функции).

### 3.1 Проблема

Между соревнованиями (например нед 8 и нед 20) доступно `gap = 20 − 8 = 12` недель. Из них
на старт приходится сама соревновательная неделя + пост (опц.) + глубокий тапер (например 2).
Чистое тренировочное окно = `gap − (taperWeeks + meetWeek + postMeet)`. Если выбранный цикл
длиннее окна (8-нед цикл при 12-нед окне с 3-нед тапером → окно 12−3−1−1=7 → цикл 8 нед не
влезает), сейчас сборка молча переполняет окно или теряет тапер.

### 3.2 Решение

```ts
export interface GapSegment {
  meetId: string;          // старт, К КОТОРОМУ ведёт сегмент
  cycleId: string;
  availableWeeks: number;  // gap − (taper+meet+post) после учёта прошлого старта
  cycleWeeks: number;      // исходная длина цикла
  fitWeeks: number | null; // ужатая/растянутая длина (null = окно мало)
  taperWeeks: number;
  candidates: LMSRankedCycle[];   // подходящие в базе для ЭТОГО окна (ручной выбор)
  notes: string[];
}

export function planBetweenCompetitions(
  meets: PLSeasonMeet[],                       // { id, name, weeksToStart } по возрастанию
  opts: {
    selector: LMSSelectorInput;                // уровень/направление/вес/дни/режим
    mode: 'auto' | 'manual';                   // режим выбора цикла на каждый пролёт
    selections?: Record<number, string>;       // manual: id цикла на индекс пролёта
    consents?: Record<number, boolean>;        // согласие на изменение каждого пролёта
    taper?: MacroTaperOpts;
    minCycleFloor?: number;
  },
): { segments: GapSegment[]; totalPlanWeeks: number; notes: string[] }
```

- Считает окно каждого пролёта: `start = prevStart + 1 + postW` … `nextStart − 1 − taperW − meetW`
  (используя `postMeet`/`meetWeek` из taper-опций, как в `buildPLSeasonPeaks`).
- **Выбор цикла на пролёт (как задача 1):**
  - **авто** — `candidateCyclesForSlot({ период по фазе между стартами (strength/endurance по
    умолчанию), недели = availableWeeks }, selector)[0]` → лучший подходящий цикл;
  - **ручной** — `candidates` = `candidateCyclesForSlot(...)` (подходящие в базе для ЭТОГО окна,
    desc: период · уровень · недели · «можно сжать»), пользователь выбирает id из `selections`;
    невалидный id → warning + fallback на авто.
  - `candidates` заполняется в ОБОИХ режимах (авто тоже показывает, что выбрано и почему).
- `fitBase = fitCycleToWeeks(cycle, availableWeeks)` → `needsConsent`:
  - `exact` → `fitWeeks=availableWeeks`, без диалога;
  - `proposed_*` + `consents[i]===true` → `fitWeeks=fitBase.weeks` (применено по согласию);
  - `proposed_*` + без согласия → `fitWeeks=null`, `mode='strict_skip'` — раскладка не тронута, в сегменте warning `⛔ Требует согласия на изменение`, время не простаивает только за счёт пик-блока;
  - окно < 4 → `fitWeeks=null` + предупреждение «окно между стартами слишком мало (N нед) — полный
    цикл пропущен, только поддерживающий объём» (без попытки shrink, согласия не спрашиваем).
- Верхний слой: собранные недели сезона прогоняем через **`buildPLSeasonPeaks`** — под каждый старт
  автоматически встаёт пик-блок (вход в пик/ramp → mock → глубокий тапер → старт → пост). Итог:
  у каждого соревнования есть и сжатый под окно цикл, и корректный taper/пик, и ни одной «пустой»
  недели между стартами.
- Обёртка для UI: `buildSeasonWithCompWindow(meets, opts, selections)` возвращает и сегменты
  (для отображения, с `candidates` для ручного выбора), и готовые недели (для PLPlanView /
  SessionPlayer / сессии).

### 3.3 Интеграция без ломки

- `appendPLTaperWeeks` / `buildPLSeasonPeaks` НЕ меняем — используем как есть.
- Новая функция вызывается из UI (Фаза 3, карточка сезона) и из `assembleSeasonPlan`, когда
  переданы `meets`.
- Конфликт со старым поведением: старый «тапер-хвост» (`appendPLTaperWeeks`) продолжает работать
  для одиночного цикла; сезонный путь использует `buildPLSeasonPeaks`. Оба пути остаются.

---

## 4. Фаза 3 — Экран ПЛ-авто по шагам (SRCBBScreen.tsx)

### 4.1 Новая навигация PL (только PL-таб, BB не трогаем)

Текущее: `plan · diagnostics · competition · macro · tools`.
Новое (7 пилюль, `subViewList.pl`):

| Пилюля | subView | Содержимое |
|---|---|---|
| `1 ⚙️ Настройки` | `settings` | Уровень/цель/направление/дни/вес/ПМ · режим атлета · 💉 ПЕД + 🥗 питание · **карточка «🧩 Сезон по микроциклам»** (режим: одиночный цикл / сезон; авто/ручной подбор; тапер-настройки) |
| `2 🎯 Слабые точки + 🧮` | `diagnostics` | Перенос текущего дашборда: `LimiterCalculatorCard` (10 калькуляторов) + `PlDeadpointsBarPathCard` + чипы слабых точек СРЦ (слабые группы/слабые точки/карты дней) |
| `3 📋 План` | `plan` | Рекомендованный цикл (кратко) + каталог (при режиме «одиночный») + PLPlanView + тапер-статус + кнопка сборки. Настройки-тяжёлое уезжает в шаг 1 |
| `4 📊 Графики` | `charts` | `TrainingMetricsChart lms={lmsChart}` + `ProMetricsPanel` + тренды e1RM/экстренд (компактно, PL-данные) |
| `5 📚 Справка и отчёты` | `reference` | `pl-export` (🖨 PDF / 📥 CSV) + справочник цикла (howItWorks/conditions) + `TaperCoachCard` + `PlannerToolsPanel mode="pl"` |
| `🏁 Соревнования` | `competition` | `PLCompetitionTab` — БЕЗ изменений |
| `🗓 Годовой план` | `macro` | `MacrocyclePanel` — БЕЗ изменений |

Пилюли 1–5 — пошаговый флоу (стрелка «Далее: 2 Слабые точки… →» в футере шага, паттерн ручного
конструктора), 6–7 — отдельные вкладки как сейчас.

### 4.2 Новая карточка сезона — `PLSeasonBuilder`

NEW: **`src/ui/screens/SRCBBScreen_parts/PLSeasonBuilder.tsx`**.

- Принцип «любое изменение — по согласию»: чекбокс «Строго» удалён. Вместо него на каждом слоте/пролёте где `needsConsent=true` появляется диалог согласия `[✓ Согласен, применить предложенное 12→7] [✕ Оставить исходник] [🔄 Выбрать другой цикл]`. Согласие хранится в `he_pl_session.season.consents` (slotIdx/gapIdx → bool).
- Режим-переключатель: **«🎯 Одиночный цикл» / «🧩 Сезон по микроциклам»** (состояние
  `seasonMode`, сохраняется в `he_pl_session`). Одиночный — всегда `exact`, без `fit` и без диалогов.
- В сезонном режиме: список слотов (`buildDefaultSeasonSlots`, редактируемые недели + порядок +
  вкл/выкл), переключатель **авто / ручной**:
  - авто: под каждым слотом «🏆 Рекомендован: {cycleTitle}» + rationale + «✅ Применить в сезон»;
  - ручной: под каждым слотом `PopupSelect` из `candidateCyclesForSlot` (подходящие в базе,
    desc: период · уровень · недели · «предлагается сжать 12→8» при неделях > слота) + «ℹ️ Почему подходит» + диалог согласия при выборе невлезающего.
- Диалог согласия действует и на пролёты между стартами (проброс `consents` в `planBetweenCompetitions`).
- Карточка **«🏁 Циклы между соревнованиями»** (в сезонном режиме, при `meetList.length ≥ 2`):
  для каждого пролёта (нед N1→N2, N2→N3, …) строка с окном «доступно N нед (минус тапер/старт/пост)»
  и тем же переключателем **авто/ручной**:
  - авто: «🏆 Рекомендован: {cycleTitle}» для окна (лучший из `candidateCyclesForSlot` по фазе окна);
  - ручной: `PopupSelect` из `candidates` ЭТОГО окна (подходящие в базе) + бейдж «⬇ предлагается сжать 12→8» (только после согласия становится «⬇ сжат»), «⬆ предлагается растянуть»; пустой список → подсказка «нет подходящих — выберите любой
    цикл из каталога» (прямой `PopupSelect` по `plCycles` как fallback).
  - выбор и согласия сохраняются в `he_pl_session.season.compGaps = { mode, selections, consents }` (roundtrip).
- Кнопка «🧩 Собрать сезон» активна только когда все `needsConsent` слоты/пролёты имеют решение (согласие дано или выбран другой цикл). При отказе без альтернативы — сегмент помечается `⛔ Требует решения` и сборка блокируется. Сводка сезона: «нед 1–12 выносливость → нед 13–20 сила →
  нед 21–26 скорость → нед 27–34 пик» + сводка пролётов «между стартами: 12→8 (сжат по согласию)» или «⛔ без согласия — пропущен»,
  бейджи «⬇ сжат по согласию 12→8» / «⛔ без согласия».
- Перенос текущих элементов шага `plan` в `settings` (без изменения логики): сетка параметров,
  режим атлета, ПЕД (PedInputPanel + PedAdaptationCard), питание, ПМ-вводы.
- `stepPlanHeader()` — футер-навигация «← Назад: N · Далее: M →» для шагов 1–5.

<!--NEXT2-->

---

## 5. Фаза 4 — Тесты

Новые файлы в `src/engines/lms/__tests__/` и `src/ui/screens/SRCBBScreen_parts/__tests__/`:

- **`lms-season.test.ts`** (движок сезона):
  - слоты: дефолтные 4 периода, клампы недель, порядок, повтор слота, пустой список;
  - `fitCycleToWeeks`: `exact` без диалога; `proposed_extend/shrink` с `needsConsent=true` + `applyFitConsent(true/false)` → `strict_skip` без изменения; окно < 4 → `strict_skip` без предложения;
  - `fitCycleToWeeks` consent: без согласия — сборка блокируется, с согласием — `derived` применяется;
  - `candidateCyclesForSlot`: endurance/strength/peak через rankCycles, speed через speed-индекс
    (пусто → пустой список), фильтр влезаемости, peak-слоты показывают «можно сжать»;
  - `planSeason`: авто (лучший кандидат на каждый слот), manual (selections, невалидный id →
    warning + fallback на авто), суммарные totalWeeks/cycleIds;
  - `assembleSeasonPlan`: склейка недель с перенумерацией, macroPhase по слотам, параметры ПЕД/
    питания/авторегуляции пробрасываются, meets → buildPLSeasonPeaks поверх.
- **`lms-speed-index.test.ts`**: членство в индексе, `speedOrientationOf` для найденного/не
  найденного/битого цикла, отсутствие дублей id.
- **`lms-comp-gap.test.ts`** (движок окна между стартами):
  - окно точное (цикл влезает), окно меньше цикла → `proposed_shrink` с `needsConsent=true` (12-нед → 7 нед, темп пересчитан, последняя сохранена) → без `consent` = `strict_skip`;
  - `consents[i]=true` → применено, `false/undefined` → `strict_skip`;
  - окно < 4 → fitWeeks=null + поддерживающий повтор, время не простаивает (все недели заполнены);
  - несколько стартов подряд (A→B→C) — каждое окно своё, пик-блоки не накладываются;
  - **выбор на пролёт: авто (лучший из candidateCyclesForSlot по окну), ручной (selections по
    индексу пролёта, невалидный id → warning + fallback на авто), candidates заполнены в обоих
    режимах**;
  - сезон с пиками: `buildPLSeasonPeaks` применён, у каждого старта taper/meet/post на месте;
  - деградация: план одиночного цикла без season не изменился.
- **`pl-season-builder.test.tsx`** (UI карточки сезона, SSR/рендер):
  - диалог согласия: слот с `needsConsent` показывает `[Согласен] [Оставить исходник] [Другой цикл]`, сохраняет `consents` в сессию, без согласия — бейдж `⛔ Требует согласия`,
  - переключатель одиночный/сезон, слоты отображаются с неделями,
  - авто-режим показывает «🏆 Рекомендован» на каждый слот,
  - ручной режим показывает PopupSelect из подходящих + бейдж «⬇ предлагается сжать 12→8» → после согласия «⬇ сжат по согласию»,
  - **карточка «🏁 Циклы между соревнованиями»: строка пролёта с окном, авто/ручной выбор цикла
    на пролёт, fallback на каталог при пустом списке подходящих, сводка «между стартами: 12→8
    (сжат)»**,
  - «🧩 Собрать сезон» → setBuiltSrc + переход на шаг «3 План»,
  - сохранение `seasonMode`/слотов/`compGaps` в сессию (roundtrip), отсутствие season →
    одиночный режим.

---

## 6. Проверка

- `npx tsc --noEmit` — 0 ошибок по своим файлам (чужие WIP-ошибки не трогаем; задокументировать).
- Целевые прогоны: `npx vitest run lms-season lms-speed-index lms-comp-gap pl-season-builder`
  (+ смежные: `lms-selector`, `lms-macro-taper`, `limiter-calculator`, `SRCBBScreen_parts`,
  `pl-deadpoints-barpath-card`), затем полный `npx vitest run` для контроля регрессий.
- `vite build` — если блокируется чужим WIP (`PLPlanView.tsx:973` в прошлом — сейчас файл наш),
  фиксируем только СВОИ ошибки.
- Прогон на реальном сценарии: 8-нед цикл при 12 нед между соревнованиями → без согласия план блокируется `⛔ Требует согласия: сжать 8→7?`, с согласием — 7 нед цикла (сжатие по согласию) + 3 нед тапер + старт + пост, ни одной пустой недели, у каждого старта пик-блок;
  в ручном режиме — ручной выбор цикла на каждый пролёт из подходящих в базе.

---

## 7. Гит

Коммиты по фазам, ТОЛЬКО своими файлами (pathspec), чтобы не подмести чужие застейдженные:

1. `docs/PL-AUTO-MICROCYCLES-PLAN.md` — этот план (коммит плана отдельным commit'ом).
2. Фаза 1: `src/engines/lms/lms-season.engine.ts`,
   `src/data/lms-cycles/lms-speed-index.ts`, `src/engines/lms/__tests__/lms-season.test.ts`,
   `src/engines/lms/__tests__/lms-speed-index.test.ts`.
3. Фаза 2: `src/engines/lms/lms-comp-gap.engine.ts`,
   `src/engines/lms/__tests__/lms-comp-gap.test.ts`.
4. Фаза 3: `src/ui/screens/SRCBBScreen.tsx`,
   `src/ui/screens/SRCBBScreen_parts/PLSeasonBuilder.tsx`,
   `src/ui/screens/SRCBBScreen_parts/__tests__/pl-season-builder.test.tsx`.

Каждый шаг: `git status` → `git commit -- <свои пути>` → `git push`. Чужие незакоммиченные
правки (`api/ocr-image.ts`, `BbAutoConstructor.tsx`) не трогаем и не коммитим.

---

## 8. Нецели (scope guard)

- НЕ добавляем новые калькуляторы в движок лимитеров — 10 уже есть, шаг 2 их переиспользует.
- НЕ меняем `SRPeriod`, `MacrocyclePanel`, `PLCompetitionTab`, движки ББ, каталог упражнений.
- НЕ добавляем новый период в 42 файла цикла — только индекс скорости.
- НЕ переделываем `buildPLSeasonPeaks`/`appendPLTaperWeeks` — используем как есть.
- Сезон — отдельный РЕЖИМ; одиночный цикл и годовой планировщик работают как раньше.

---

## 9. Итог выполнения (Sep 03 2026)

**Статус: ✅ ВЫПОЛНЕН.** Все 3 фазы + тесты + UI + принцип «любое изменение только по согласию» реализованы и запушены (`cc99f146`, `8c4111b6`, `eab1887c`).

Дополнительно Sep 03: `createSeasonSlot(period)` + кнопка «＋ Добавить период» (дубль слота сила→скорость→сила), `candidateCyclesForSlot` speed-fallback на `strength` при пустом индексе, `seasonSegmentSummary` показывает `strict_skip` как `⛔ без согласия — пропущен`, тесты дубль/пустой/speed-fallback/summary.