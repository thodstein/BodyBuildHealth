# BB-авто: полный аудит и план доработки (2026-11)

**Дата аудита:** 2026-11-27 · **Дата завершения:** 2026-11-28 · **Статус:** ✅ **ВЫПОЛНЕНО ПОЛНОСТЬЮ (Волны 1–7 + APK-сохранение планов + полная верификация, без коммита/пуша)**.
**Правило серии:** каждый пункт закрыт тестом-замком; посторонние WIP-файлы не тронуты; после финальной правки проверены `tsc --noEmit` (0 ошибок), `npm run build` (2174 модулей, 0 ошибок), `npm run verify:apk-design` (OK), UI ББ-Авто (`49/49` файлов, `426/426` тестов), целевые сьюты + замки Волн 1–7 (`13/13` файлов, `120/120` тестов), а в полном прогоне ядра ББ-Авто до финального 1-строчного фикса защиты схем в `bb-builder.engine.ts` прошли `315/316` активных файлов (`3583/3584` тестов, 4 файла `bb-cycle-audit-*` пропущены без `BB_CYCLE_AUDIT_FULL=1`), единственный упавший `bb-practical-coaching.test.ts` затем прошёл `16/16`.

---

## Статус по волнам

| Волна | Область | Статус | Ключевые замки / проверки |
|---|---|---|---|
| Волна 1 | P0 Безопасность, утечки PED, порча данных плана, Contest Prep, `inputSnapshot`, `returnAction`, EN `muscle` | ✅ Выполнено | `bb-wave1-p0-audit-fixes.test.ts` (7/7), `bb-wave1-p0-ui-fixes.test.ts` |
| Волна 2 | P0/P1 Экспорт/печать APK (`apk-share.ts`), `BbExSwapModal`, `.lib-sheet` APK, heatmap, joint-stress, критический UI | ✅ Выполнено | `bb-wave2-apk-ui-fixes.test.tsx` (6/6), `verify:apk-design` |
| Волна 3 | P0/P1 Ядро генерации (`finalizeBBPlan` `lateCap`, `bb-plates`, `DUP`, `repairSingleSet`, `recoveryMult`, пост-проходы, веса bodyweight/изоляций, воркер, честное редактирование) | ✅ Выполнено | `bb-wave3-core-audit-fixes.test.ts` (7/7) |
| Волна 4 | P0/P1 Замкнутый контур (Плеер `he_pl_runtime` v2 ↔ Дневник ↔ настоящий `replanBBMesoFromFact` ↔ Диагностика) | ✅ Выполнено | `bb-wave4-closed-loop-fixes.test.ts` (4/4), `bb-diagnostics-hub.test.tsx` (46/46) |
| Волна 5 | P0/P1 Фарма/Курс авто-синк (Blast/Cruise/PCT/Off), женский слой безопасности PED, Contest Prep/тапер/post-show (1..12 нед), Анализы (HCT/ферритин/глюкоза/Na-K), Питание (инсулин, расписание дней, ГР/17aa) | ✅ Выполнено | `bb-wave5-pharma-prep-labs-nutrition.test.ts` (6/6), `bb-contest-prep-plan.test.ts` (105/105), `bb-prep-cycle.test.ts` (51/51), `bb-ped-enhancements.test.ts` (35/35) |
| Волна 6 | P1/P2 Дизайн-система (CSS-токены `var(--...)`, Light Theme / Dynamic Color, секция `120. BB-AUTO CONSTRUCTOR PRO` в `styles-native.css`), Quick-Start 1-клик, Базовый/PRO progressive disclosure, топ-3 сравнение сплитов, порталы модалок, группировка шага 7 + diff/откат правок | ✅ Выполнено | `bb-wave6-design-ux.test.tsx` (4/4), `bb-auto-smoke.test.tsx`, `bb-plan-step-iterations.test.tsx`, `verify:apk-design` |
| Волна 7 + APK | P2/P3 Дашборд качества, План vs Факт e1RM, APK-сохранение планов (`Encoding.UTF8` в `Documents`, `Directory.Cache` для Share `FileProvider`, JSON-бэкап/импорт в `Directory.Data`, `MyTrainingTab` + `PlanExportCard`), уборка мёртвого кода | ✅ Выполнено | `bb-wave7-quality-exports-cleanup.test.ts` (12/12), `bb-visual.test.ts` (19/19), `bb-plan-fact.test.ts` (10/10) |

---

## Подтверждённые продуктовые решения

1. Порядок: строго `Волна 1 → Волна 7`.
2. Авто-синк `Активный курс → ББ-авто` (Волна 5): включён по умолчанию с бейджем «💉 Из активного курса» и переключателем ручного режима; новый модуль `src/engines/bb/bb-course-sync.ts`.
3. Неподтверждённые константы PED и инструкции по инъекциям пептидов в `rationale` (Волна 5): прямые инструкции убраны, добавлена harm-reduction оговорка и `assessFemalePedSafety`.
4. Отображение bodyweight-упражнений (Волна 1/3): `Свой вес` / `Свой вес + X кг` / `− X кг противовес` вместо `0 кг` / `80 кг`.

---

## Итоговый чек-лист проверки

- [x] `node --max-old-space-size=3072 ./node_modules/typescript/bin/tsc --noEmit` → **0 ошибок**.
- [x] `node --max-old-space-size=4608 ./node_modules/vite/bin/vite.js build` → **0 ошибок** (production-сборка собрана).
- [x] `npm run verify:apk-design` → **`OK: all APK design markers in place.`**
- [x] UI-сьют ББ-Авто (`src/ui/screens/TrainingScreen_parts/__tests__/bb-`) → **49/49 файлов, 426/426 тестов**.
- [x] Целевые сьюты ядра + замки Волн 1–7 (после финальной правки `bb-builder.engine.ts`) → **13/13 файлов, 120/120 тестов** (`bb-practical-coaching`, `bb-path-adequacy`, `bb-zero-state-snapshots`, `bb-plan-matrix-coverage`, `bb-exercise-count-benchmark`, `bb-female-male-minimums`, `bb-scheme-comment-consistency`, `bb-wave1..5`, `bb-wave7`); полный прогон ядра ББ-Авто до финального 1-строчного фикса — **315/316 активных файлов, 3583/3584 тестов** (4 `bb-cycle-audit-*` пропущены без `BB_CYCLE_AUDIT_FULL=1`).
- [x] `git status --short` → посторонние WIP-файлы не тронуты; коммит/пуш не выполнялись.
