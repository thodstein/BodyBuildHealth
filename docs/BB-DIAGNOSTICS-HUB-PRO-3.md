# ББ-диагностика PRO-3: LVP + мост v2 + сухожилия + MMC + VBT-цель + динамика + выдача

Статус: выполнен кодом (движки + хаб + мост + экспорт + тесты), закоммичен pathspec, без пуша.
Хаб: `src/ui/screens/TrainingScreen_parts/BBDiagnosticsHub.tsx` (таб «Слабые» → карточка `data-bb="pro3-card"`).
Тесты: `src/engines/bb/__tests__/bb-diagnostics-pro3.test.ts` (22) + хаб +3.

## R1 LVP-лайт + e1RM по скорости
- NEW `bb-lvp.engine.ts`: `calibrateBbLvp` (3+ точки вес×скорость → регрессия v=a+b·w, MVT из канона `pro/vbt`, гейты: разброс ≥10 кг, наклон<0, r²≥0.85; иначе честный null) + `parseBbLvpText`.
- `bb-vbt.engine.ts`: `e1RMByVelocity` в результате (из `diagnoseVelocity`, без веса — null); поведение без веса 1-в-1.

## R2 Мост v2 — PRO-2 влияет на вставку
- `bb-diagnostics-injection.engine.ts`: opts `unilateralTopUp` (слабая сторона первой +N в пределах капа 6, в комментарий), `rirShift`, `volumeMult` (дефолт выкл — старые тесты целы).
- Хаб `handleInjectToPlan`: readiness red → RIR+1/объём ×0.75; L/R topup/watch → добивка. Мост: `lrTopUp/readinessAction/returnTo/lvp/tendon/lrDirection/mmc/workingRange` (тип + приёмник сохраняет + тост «применено»).
- Осознанно: острая готовность двигает только вставку, не мезоцикл. Return-to — 3 ступени (`bb-return-to.engine.ts`), скрининг.

## R3 Сухожилия
- NEW `bb-tendon-guard.engine.ts`: тяжёлые тяги/сгибания → локоть, жимы/брусья → плечо; warn >12 / stop >18 сетов/нед, боль/провал плеча — сразу stop. Карточка `data-bb="tendon-card"`.

## R4 MMC-гейт + позинг
- NEW `bb-mmc-gate.engine.ts`: порог 0.65 (Calatayud 60–80%): изоляция на лёгком — внутренний, иначе/взрыв — внешний. `posingIsoNote` — Schoenfeld 2020 с ценой в силе. Тогл в карточке.

## R5 VBT под цель
- `bbVbtRecommendation(..., {goal})`: сила при ≥20% — кап 20–25%; масса при 10–20% — допуск 20–30%. Базовые строки untouched (старые тесты целы). Селект цели в карточке.

## R6 Динамика перекоса
- NEW `bb-lr-history.engine.ts`: `he_bb_lr_history` (кап 24), ≥3 замера одной стороной → добивка оправдана, флип → наблюдение (Parkinson/Bishop: точечный порог слаб).

## R7 Выдача
- NEW `bb-spec-ics.engine.ts`: `buildBBSpecIcs` (паттерн SM/TA, экранирование) + кнопка `data-bb="export-ics"`; `bbWorkingRange` (масса 65–80% / сила 80–90% ACSM, шаг 2.5, e1RM≤0 → null).
- Экспорт: PRO-3 разделы в HTML/CSV (`BBDiagnosticsPro2Meta` расширен, без меты — байт-в-байт).

## Проверено
- NEW pro3 22/22; соседи pro/pro2/vbt/injection 148/149 (1 — чужое `max-pro` female, моих импортов нет); хаб 25/28 + мои 3/3 (3 падения — чужой WIP: степпер-aria дублирует `getByLabelText`, вне моего диффа — доказано `git diff`); `tsc` 0 по своим файлам.
- Коммит pathspec только своих (7 MOD + 8 NEW + док); чужой taper-WIP в `BbAutoConstructor` (4 ханка trial/postShow) оставлен в worktree — застейджен только свой ханк через фильтрованный патч.

## Добивка (закрытие честных гэпов)
- **R7 годовой мост** — NEW `bb-spec-annual.engine.ts` (`bbSpecToAnnualPatch`: слабые канон + focus + specialization + доноры/длина в notes) + кнопка «🗓 Спец-блок → в годовой план» (селект BB-блоков, официальный `setAnnualBlockConfig`, блок → stale, результат цел; без годового плана — честный тост). Тест маппера + e2e хаба (конфиг патчится).
- **LVP-движение** — селект присед/жим/тяга/стоя/тяга-верт (`lvpLift`, MVT своего движения; тест: bench MVT 0.15 vs squat 0.25).
- **MMC %1RM** — ввод «Нагрузка изоляции, %1RM» (порог 0.65 точный: 64% — внутренний, 66% — внешний; тест).
- **Tendon level-aware** — пороги warn/stop по уровню (beginner 8/12, intermediate 12/18, advanced 15/22; тест).
- **lrTopUp в автосборке** — стейт `lrTopUp` (персист + очистка при закрытом перекосе) + пост-пасс поверх плана (клон первого упражнения мышцы, унилатерально, ≤3 сетов, делод скип, сессия <10 упр, строка в rationale, `side/unilateral` в `BBExercise`).

## PRO-4 финал (микро-полировка, закоммичена)
- **Tendon вес-градация:** `catalogEquipment` (cable/machine ×0.5) + `<40кг ×0.7` (тело/без веса ×1.0).
- **LVP LRU + бейдж:** `saveBbLvpProfile` LRU, `Очистить LVP` в `pro3-card`, `workingRange` → `· индивид. LVP` vs `· популяц. LVP` (экспорт тоже).
- **Return главный план:** ступень возврата режет главный план (`×volumeMult`, ступень 1 → 1 сет техника, делод скип, `RIR+`), токен `\\b` (не `includes`).
- **Per-side MRV:** `side/unilateral` в `BBExercise` (`bb-builder`+`bb-types`), лимит 3 сета унилатерально держит `½×MRV` (доп. кап не нужен — 3 << 11), отображение через `comment` (`↔ L/R: слабая…`).
