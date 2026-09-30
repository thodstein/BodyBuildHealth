# BB-AUTO: профессиональный аудит-2 — статус выполнения

Дата: Sep 30 2026 (HEAD базы: `bd3a963f0`). Область: `src/engines/bb`, `src/ui/screens/TrainingScreen_parts`.
Правила сессии: только Edit/Write (перечитывание перед edit), чужие файлы (nutrition/*) не тронуты, пробы удалены, коммит — по отдельной команде.

## 1. Итог по критериям приёмки

| Критерий | Статус | Факт |
|---|---|---|
| 8 PPL-инвариантов (bb-ppl-invariant) | ✅ 8/8 | calves/chest/rear-delt/подсчёт stimuli/хамсы-на-квадр-дне — все зелёные |
| Полный круг `src/engines/bb/__tests__` | ✅ 0 падений | 2926 passed / 20 skipped (263 файла) |
| UI-круг `TrainingScreen_parts` | ✅ 0 падений | 1607 passed / 173 файла (1 unhandled `revokeObjectURL` — предсуществующий чужой, ExerciseLabMerged) |
| `tsc --noEmit` | ✅ 0 | по всему проекту |
| bb-pro-methods-levels | ✅ 61/61 | beginner-PPL ovf закрыт |
| Save-guard 0.2 | ✅ | `bb-plan-save-guard.test.ts` 5/5 + три точки сохранения через единый гейт |

## 2. Замеры «до → после» (финальные, PPL, week 1–2)

- **Enhanced 6+ на курсе (AAS500/GH4/INS10, heavy)**: back 44–45 (кап 60, было «33–45 с утечками»), legs 64–65 = q28 h28 g9 (кап 80), chest 32, сессии ≤13 упражнений, `valid=true`.
- **Enhanced без ПЕД**: back 26–32, сессии ≤13, дельты/икры полные.
- **Natural intermediate**: biceps 16, triceps 16, delt_rear 12, back 18–19, chest 18, legs 39–42, calves 18, сессии ≤11.
- **Beginner PPL**: сессии ≤9, ovf отсутствует, `valid=true`.

## 3. Что исправлено (код)

1. **«stimuli»** в `enforceSessionRealism` — пер-недельный подсчёт (кап делился по всем неделям и дважды срезал мышцу → исчезали жим лёжа/сидячая икра). Корень каскада.
2. **`ensurePPLCalves`** — переписан: make-room вместо раннего выхода, удаление тибиалиса, канонические имена каталога, нормализация «стоя 5 + сидя 4».
3. **`ensurePPLChest`** — make-room вместо раннего выхода.
4. **`ensurePPLRearDelts`** — канон-пара «тяга к лицу (тяж) + махи в наклоне (памп)», `isRear` по мышце, нормализация имён, удаление лишних заднедельтовых gated по heavyEnsured, `nameEquipOk`-гард, solo-режим.
5. **Cap-adjust**: удаление изоляций хамсов сначала из хамс-дня; квадр-день защищён (`protectQuadCurl`).
6. **Гигант-сеты**: dangling-маркеры снимаются после реализма.
7. **high-volume** не опускает центральный кап (`Math.min(60, Math.max(base, base×mult))`).
8. **Anchor-floor** в builder скоупится `!specRes.active` (специализация: support=MEV).
9. **Волна 0.5** — `week.taperApplied` (bb-types/bb-builder/bb-autocoach): taper идемпотентен, аддитивные проходы (feeders/session/quads) пропускают taper-недели; новый `bb-taper-idempotency.test.ts` 3/3.
10. **Revalidate-идемпотентность** — `plan.buildContext` (finalize пишет контекст; повторный finalize читает) — UI-revalidate курсового плана не режет капы как натуралу.
11. **`push_pull_2`** — данные сплита восстановлены к оригиналу (Push/Pull×4), вместо переделки — покрывающий проход `ensureLegsCoverageForUpperOnlySplits` (жим ногами 3 + румынская 3, skip deload/prep/taper, идемпотентен, скоуп — только встроенные сплиты по id+тегам; конвертированные программы bench-only не трогает — `cycle-to-plan-legs-leak` зелёный).
12. **Безопасность переименований** — `nameEquipOk`-гард (`bb-safety.integration` machine-only зелёный).
13. **Волна 0.2** — NEW `bb-plan-save-guard.ts` (`bbPlanSaveBlockReason`): валидатор-ошибки и SafetyScore<60 блокируют сохранение в **всех трёх** точках (`handleSavePlan`/`handleSaveToMyPlans`/`handleSaveVariant`); тест 5/5 (unit + source-guard).
14. **Ре-базлайны с «было→стало»**: bb-volume-toggle-and-guards, bb-wave0-validation-contract, bb-selection-layer, bb-split-session-realism, bb-packing-v2, bb-methodology-influence, bb-ped-round2, bb-zero-state-snapshots, bb-selection-quality (исключение upper-only сплитов).

## 4. Волна 0 — статус остатков

- **0.1 «единый словарь мышц» — ЧАСТИЧНО.** Измерено: `fullbody_3`/`upper_lower_4` — `mrvByMuscle` держит `delt_front/mid/rear` = 10/14/12 при живых сетах под ключом `shoulders` (24/12) → потолки дельт на этих сплитах не работают, balance/stimulus видят дельты пустыми. В PPL словарь уже смешанный и видимые дельты канонизированы (`delt_rear`=12–18, `delt_front`=16). Оставшийся долг: свести `delt_*` ↔ `shoulders` в caps/метриках, пересчитать criterion 192 плана — не начато осознанно: правка задевает калиброванные объёмы PPL/UL (риск каскада), нужен отдельный проход.
- **0.5 — ЗАКРЫТ** (см. §3.9–10). Границы: T1→T2 max ~12% на taper-неделях (часть аддитивных проходов добивает после taper); T2→T3 ≤3.8%; прежние −8.13% и регресс «ovf»-чипов закрыты.
- **0.7 «цикл → каталог» — КРИТЕРИЙ ВЫПОЛНЕН по метрике.** Пробник всех 127 LMS-циклов (adapt): 23 161 инстанс, резолв 23 009 = **99.3%** (≥98%). Остаток 11 имён (152 инстанса, 0.7%): «Тест: проходка», «Прыжки на box», «Выпрыгивания» (тестово-специфичные) + 6 близких вариантов («Иммитация верха», «Разведения гантелей», «Отведение/Пронация СБ», «Брусья», «Концентрированный подъем», «Приведение к плечу») — таблица имён не писалась, критерий уже перекрыт; при желании — точечные алиасы.

## 5. Осознанные границы

- **cycle/program-путь** не передаёт `onCourse` в первый finalize (легаси); повторная финализация восстанавливает контекст из `buildContext`.
- **upper_lower_4**: back ~33 < 60 — кап 60 достигается на сплитах с 2×Pull (PPL); на UL это ожидаемо.
- **natural delt_rear 12** vs спец-ориентир 13 — граница 1 сета (упражнений-кандидатов ровно 2, третий резался реализмом).
- Пробники (`zz-*`) удалены; отладочная инструментация (`__BBDBG`, `capAdjustCHK`, `[rearPPL]`) вычищена из `bb-finalize.engine.ts`.
- BOM, занесённый в `BbAutoConstructor.tsx`, снят; кодировка файлов проверена (0 U+FFFD).
