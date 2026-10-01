# BB-AUTO: профессиональный планировщик и профессиональные циклы

Дата: Oct 01 2026 (HEAD базы: `995dcd58b`). Область: `src/data/lms-cycles`, `src/engines/bb`.
Правила: только Edit/Write; чужие WIP не трогать; математика планов (капы/MRV/фазы) не
пересматривается — контент-волна; после каждой волны прогоны vitest + `tsc --noEmit`.

## §1. Аудит контента на старте

| Показатель | Факт |
|---|---|
| Реестр `LMS_CYCLES` | **127** циклов (84 PL/арм/ТА + 38 BB + прочее) |
| BB-циклы (`direction: 'bodybuilding'`) | **38** |
| Мужские ББ | 23: base 01–12 + beginner-ul/cut-ul/pec/back/maint/dumbbell + arms/shoulders/legs/strength/hotel |
| Женские ББ | 15: glute×4, posterior, bikini×3, bodyfitness, wellness, delt, upper, maint, cut, beginner |
| Движки | 96 файлов; `bb-builder` (388КБ), `bb-finalize` (378КБ), `cycle-to-plan` (181КБ) — зрелые |
| Схемы/методики движка | `volumeScheme`: gvt/gironda/fst7; `methodology`: DC/mountain_dog/hyperemia/pre_exhaust… |

**Вывод.** Движок и объёмная модель — профессиональные. Слабое звено — **именные
классические системы бодибилдинга отсутствуют как циклы**: Bro-split, классический PPL 6×,
Full Body 3× для среднего уровня, GVT, Gironda 8×8, FST-7, Mountain Dog, Yates Blood & Guts.
Каталог знает «сплиты» (25 паттернов) и методики, но **готовых мезоциклов этих систем нет** —
пользователь не может выбрать «GVT» или «Yates» из библиотеки.

## §2. Цель волны

Дать планировщику **библиотеку именных профессиональных систем** — 10 новых циклов
(8 мужских + 2 женских), каждый: корректная форма `SRCycleTemplate`, канонические имена
каталога, период RIR-лестница, делоды, фазовые заметки, честные `howItWorks/conditions`.

Инварианты (жёсткие, проверяются тестами):
- `direction: 'bodybuilding'`, `tags: ['lms','bodybuilding', …]`;
- все имена резолвятся `findCatalogExerciseByLabel` (иначе ломается `pl-p2-data-hygiene` allowlist);
- `pct ≤ 1.1` (гард проходок), ≥2 сетов/упражнение, ≤10 упражнений/сессия;
- `deloadWeeks` присутствуют, RIR-лестница `start > end`;
- каждая major-мышца (chest/back/quads/hamstrings/glutes/shoulders/biceps/triceps) получает
  частоту ≥1 (иначе `low_training_frequency`/`target_volume_deficit` — error);
- пол меняет план (female glute/ham ×1.2) и цель меняет план (`goalMult`) — инвариант
  `bb-cycle-audit-library`.

## §3. Новые циклы (план)

| id | Система | Нед | ×/нед | Уровень | Особенность |
|---|---|---|---|---|---|
| `cycle-bb-m-bro-5` | Bro-split (1 группа/день) | 8 | 5 | KMS-MS | классика: Грудь/Спина/Ноги/Плечи/Руки |
| `cycle-bb-m-ppl-6` | PPL классический | 8 | 6 | KMS-MS | Push/Pull/Legs ×2, разные углы |
| `cycle-bb-m-fb-3` | Full Body 3×/нед | 8 | 3 | II-KMS | тяж/средн/лёгк (heavy/light/medium) |
| `cycle-bb-m-gvt-8` | Немецкий объёмный (GVT) | 8 | 4 | KMS-MS | 2 упражнения/мышцу × 5 сетов = 10 сетов |
| `cycle-bb-m-gironda-8` | Gironda 8×8 | 8 | 4 | KMS-MS | высокая плотность, 8 повторений |
| `cycle-bb-m-fst7-8` | FST-7 | 8 | 5 | KMS-MS | 7-сетовые финишеры на изоляции |
| `cycle-bb-m-meadows-8` | Mountain Dog | 8 | 4 | KMS-MSMK | стретч-позиции, разнообразие углов |
| `cycle-bb-m-yates-8` | Yates Blood & Guts | 8 | 4 | KMS-MS | отказные подходы, 4 дня |
| `cycle-bb-m-dc-6` | DC Training (Trudel) | 6 | 3 | KMS-MS | A/B/C-ротация, rest-pause, стретч |
| `cycle-bb-m-hit-6` | Heavy Duty HIT (Mentzer) | 6 | 3 | KMS-MS | минимальный объём, отказные подходы |
| `cycle-bb-f-fb-3` | Женский Full Body | 8 | 3 | II-KMS | низ/верх/полное, ягодичный акцент |
| `cycle-bb-f-ppl-5` | Женский PPL 5× | 8 | 5 | KMS-MS | ягодичный акцент + верх-баланс |

Итого: **+12 циклов** (10 мужских + 2 женских), реестр 127 → **139**, BB-циклов 38 → 50.

## §4. Re-baseline

- `cycle-wave2-matrix.test.ts`: `LMS_CYCLES.length` 127 → **139** (комментарий «было→стало»).
- `manual-library-arm-ss.test.tsx`: advanced-уровень 65 → **75** (комментарий «было→стало»).
- Больше ничего: BB-циклов 38 → 50; сэмплы `i%5`/`i%9` аудита сдвигаются — новые циклы
  держат инвариант «пол/цель меняют план» (проверено прогоном).
- `pl-p2-data-hygiene`: имена новых циклов резолвятся, `pct ≤ 1.1` (проверено — 18/18).

## §5. Верификация (факт)

| Проверка | Результат |
|---|---|
| `src/engines/bb` (263 файла) | **2926 passed / 20 skipped / 0 failed** |
| Тяжёлый аудит `BB_CYCLE_AUDIT_FULL=1` (4 уровня × 50 циклов × 2 пола × 2 цели) | **20/20** (по файлам) |
| `bb-cycle-matrix` (convert-путь, 50 циклов × 2 пола × 2 цели) | 5/5 |
| `bb-cycle-audit-library` (структура/MRV/валидатор/делод/faithful) | 4/4 |
| `cycle-wave2-matrix`, `lms-cycle-matrix`, `pl-p2-data-hygiene`, `bb-female-cycles` | зелёные |
| UI `TrainingScreen_parts/__tests__/bb-*` + каталог/библиотека | **321 passed** (1 предсуществующий unhandled-таймер `bb-diagnostics-pro5`) |
| `tsc --noEmit` (12GB heap) | **EXIT=0** |

## §6. Журнал

| Волна | Статус |
|---|---|
| Аудит контента (§1) | ✅ |
| 12 именных циклов | ✅ |
| Реестр + re-baseline | ✅ |
| Прогоны + tsc | ✅ |
| Найденные и исправленные дефекты контента | PPL-6: triceps-индирект overflow на beginner (4 жимовых упражнения + head-coverage) → трицепс приведён к канону, 2 жима убрано; glutes/hams overflow на PPL-6 → ноги перестроены (квадры+сгибания, без 2-го жима). Все 12 циклов чисты на 4 уровнях × 2 полах × 2 целях в обоих путях. |

