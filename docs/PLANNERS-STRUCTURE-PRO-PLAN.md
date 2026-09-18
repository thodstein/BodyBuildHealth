# PLANNERS-STRUCTURE-PRO — единый плотный каркас планировщиков (BB-эталон)

Дата: 2026-09-18. По команде «панели скрыть/открыть занимают много места и образуют пустоту —
переделай структуру, сделай дизайн планировщиков как в ББ-авто, без кучи пробелов, чётко по
структуре и вкладкам — работай по всем планировщикам».

## 1. Аудит (факты чтением кода)

**Эталон — ББ-авто (`BbAutoConstructor` 4070 строк + `bb-auto-constructor-shared`):**
- Шаги: `params|ped|split|plan|weights|quality|adjust|contest|annual|tools` — пилюли `STEP_PILL`,
  группы, «Далее/Назад», план-гейты. Контент шагов вынесен: `bb-step-*.tsx`,
  `bb-quality-*.tsx`, `bb-contest-prep-sections.tsx`.
- Карточки: `BbCard` (открытая, `marginBottom:10`, `padding:10px 12px`, верхняя кромка 2px,
  шапка иконка 26px + заголовок 12.5px/800) + `BbFoldCard` (вторичное, `defaultOpen:false`,
  закрытое **возвращает null-контент**, шапка 28px). Переключатели `BbRowSwitch` (44px) /
  `BbToggleChip`. Один визуальный язык, один слой отступов, пустот нет.

**Арм (`ArmAutoConstructor` 2300 строк, главная жалоба):**
- Шаги 8 уже как в ББ (`params|athlete|grip|split|plan|quality|export|year` + группы
  ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА) — структура шагов НЕ проблема.
- Проблема — панели: каждый шаг = `AdCard(padding 10-12)` ⊃ N×`AdSec(marginTop:6, padding 8-10)`,
  плюс `arm-design.css` добавляет **второй слой**: `.ad-card{padding:16px;margin:0 0 12px}`,
  `.ad-sec{padding:13px;margin-top:12px}`, `.ad-sec-t{margin:0 0 10px}`. Итого тройной стек
  отступов: карточка + секция + CSS. Отсюда «много места».
- Скрытые панели: `AdSec collapsible` при `open=false` рендерит
  `<div style={{display:'none'}}>{children}</div>` — дети монтируются, место под кнопку
  `padding:8px 0` остаётся, плюс `AdCta sticky bottom:8` держит пустую липкую полосу.
  Отсюда «скрыть/открыть образует пустоту».
- Вторичные секции открыты по умолчанию (`defaultOpen ?? true`) — экран «простыня».

**Остальные (та же болезнь, слабее):**
- Стронг (`StrengthSportConstructor` 1225): `SectionCard` + `GroupHeading`, `CARD gap 14 /
  padding 18`, hero с glow-пятнами. Плотность уже правилась, но базовый CARD рыхлый.
- Единоборства (`CombatConstructor` 1432): `SectionCard` + `cb-pane gap 14 / padding 14`,
  hero `padding 20/14`, план-аккордеоны с полной шапкой 64px.
- Кардио (`CardioConstructor` 1487 + 5 step-файлов): шаги разнесены по файлам (хорошо),
  но корень `gap 16`, панели `gap 12`, превью-герои с описательными простынями.
- ПЛ (`SRCBBScreen`): `mainTab/pl/bb/manual` + `subViewList`, корень `padding 12px 0`,
  секции без единого кита.
- Ручной: `ProgramManagerPanel/ProgramEditorView` — свой кит, вне скоупа логики.

## 2. Решение — единый каркас (BB-эталон для всех)

Метрики (единые): шаг-корень `flex column gap:8`; карточка `marginBottom:8 / padding:10px 12px /
radius:14`; шапка `иконка 26 + заголовок 12.5/800`; вторичное — Fold `defaultOpen:false`,
закрытое = `null` (не `display:none`); переключатели 44px; чипы wrap gap 6; без внешних
CSS-дублей (инлайн — единственный источник отступов).

- **P1 — NEW `planner-ui.tsx`:** `PlannerRoot / PlannerHead / PlannerSteps / PlannerCard /
  PlannerFold / PlannerNav` + `PLANNER_GAP=8`. Тонкие обёртки над `training-ui`
  (`CARD/BTN/STEP_PILL`), классы/DOM-хуки каждого планировщика сохраняются пропсами
  (`className`, `data-*`), строки/aria 1-в-1. Плюс `planner-density.css`-добивка: нейтрализация
  рыхлых `.ad-card/.ad-sec` слоёв только внутри `.train-arm` (append-only, без hex).
- **P2 — Арм на каркасе:** `AdCard→PlannerCard`, `AdSec→PlannerFold/PlannerCard`,
  `AdCta→PlannerNav`; первичные секции открыты, вторичные — Fold closed; скрытое = null;
  корень `gap:8`; hero компакт; пустые баннеры — только при данных.
- **P3 — остальные на плотности:** Стронг/Комбат/Кардио/ПЛ — тот же `PlannerCard/Fold/Nav`
  для новых правок + точечное ужатие корней (`gap 14-16→8-10`, `padding 18→12-14`) без смены
  логики/строк/хуков. Полный ререз god-файлов не делаем (риск соседям).
- **P4 — тесты:** NEW `planner-structure` (кит: метрики/закрытое=null/хуки; арм: шаги 8,
  вторичное закрыто, нет `display:none`-тел, навигация ведёт вперёд).

## 3. Не делаем
- Логику сборки/движки/строки/aria/хуки не меняем (только подача).
- Shared-киты (`training-ui`, `StrengthUI`, `CombatUI`) не переписываем — только новый
  `planner-ui` поверх.
- Годовые/печатные/мостовые пути не трогаем.

## 4. Критерии приёмки
- Арм: 8 шагов ходят «Далее/Назад», вторичные панели закрыты по умолчанию, скрытое —
  collapsed-тело нулевой высоты без display:none, визуальных пустот нет.
- Остальные: корни ≤10 gap, карточки ≤12 padding, тесты соседей зелёные.
- `tsc --noEmit` 0 по своим, `verify:apk-design` OK.

## 5. Статус выполнения (Sep 18 2026)
- P1 ✅: NEW `planner-ui.tsx` (`PlannerRoot/Head/Steps/Card/Fold/Nav`, gap 8, закрытое = null).
- P2 ✅: арм перестроен — `AdRoot/AdHead/AdCard/AdSec` стали тонкими обёртками над kit
  (классы `.ad-*` + `data-arm` + строки/aria 1-в-1); `AdCta` без липкой пустоты;
  хват-фокус — Fold closed, слабые зоны — открыты; CSS-добивка гасит двойные
  `.ad-card/.ad-sec` отступы. По пути поймано своим прогоном: null-рендеринг скрытого
  ломал 11 соседних арм-тестов (текст искался в скрытых панелях) — скрытое переведено на
  collapsed-тело нулевой высоты (grid 0fr/opacity 0, контракт CSS), тесты целы без правок.
- P3 (стронг + единоборства) ✅ по команде «единоборства, стронгман тоже приведи»;
  запрет (ПЛ-авто, ручной, кардио) соблюдён — их файлы/тесты не тронуты:
  - Стронг: `StrengthUI` CARD 14/10→12/8, HERO 14/10→12/8, шапка секции 36/17→30/14,
    head-кнопка 52→44, ROW/COL gap 10→8; корень `padding 12/gap 10` → `0 10px 90px/gap 8`,
    все `ss-pane` gap 10→8. Коллапс и так был без пустот (grid 0fr) — контракт цел.
  - Единоборства: `CbSec` `display:none` → collapsed-тело нулевой высоты
    (grid 0fr/opacity 0 + `data-collapsed`, контракт как у арм/стронга; шапка 48→44);
    `CombatUI` CARD 16/12→12/8, HERO 18/14→12/8, ROW/COL 10→8, титул 15→14;
    корень `padding 14/gap 14` → `0 10px 90px/gap 8`, все `cb-pane` gap 12→8.
    Внутренние 2-колоночные гриды полей (gap 10) оставлены — это не stacked-пустоты.
- Проверено: NEW `planner-structure` 5/5 + wizard-nav 9/9 + top-ui 16/16 + cycle-picker 7/7
  + switch/quality/grip/pro5/year/variants/correction 43/43 + `tsc --noEmit` 0 по всему
  проекту + `verify:apk-design` OK. НЕ ПУШИЛ.
- P3-проверка: combat 30/30 (4 файла) + strength engines 997/997 (64 файла) + strength UI
  75/75 (12 файлов, вкл. wizard-structure 9/9) + arm planner-structure/wizard-nav 14/14 +
  `tsc --noEmit` 0 по всему проекту + `verify:apk-design` OK. НЕ ПУШИЛ.
