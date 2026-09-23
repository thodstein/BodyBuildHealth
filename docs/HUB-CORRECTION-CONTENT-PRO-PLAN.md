# HUB-CORRECTION-CONTENT-PRO-PLAN — углубление контента коррекции 5 хабов

> Статус: **ВЫПОЛНЕНО (round-9 + round-10, Sep 22 2026)**. План выполнен по всем хабам,
> включая добавленный по ходу 5-й хаб (ББ-диагностика, движки коррекции). Итоги — §7.
> Цель была: «ещё глубже» — больше упражнений в пулах и новые движки коррекции для
> армрестлинга, армлифтинга, ТА, стронга и ББ. Математику объёма/капов не трогали.

## 0. Статус выполнения (round-9/10, коммиты pathspec, не пушилось)

| Хаб | Было → Стало | Локи | Коммит |
|---|---|---|---|
| Армрестлинг | 12 точек `exercises[]` 4–5 → **≥6** (contain_fingers 8); `POOL_TOPUP` 8 → **все 12** и каждая точка реально добавляет ≥1 уникальный id (пул 7–10) | пул ≥6; топ-ап не дубль; все id из каталога | `9833c2b0`, `9c6a3489` |
| Армлифтинг | **42 → 58** записи; закрыт пробел снаряда **Excalibur** (был в каталоге без практики); фазы 10/20/14 → 14/21/19; **причина × фаза ≥2** (было 6 ячеек по 1) | ≥50 записей, ≥10 на фазу, Excalibur покрыт, причина×фаза ≥2, причины — только канонические | `f1769bce`, `4f26ed10` |
| ТА | **74 → 82** записи; **43 синтетических id добавлены в каталог** (`exercise-catalog-ta-supplement.ts` 14 → 57); ядро фаз **3 → 6** кандидатов; причины `volume`/`fatigue` объявлены (были 0) | все id библиотеки — реальные записи каталога; ≥6 кандидатов на фазу; причина×фаза ≥2 | `644f45c9`, `a6e5d820`, `c9a16fcb` |
| Стронг | **56 → 88** записи; тонкие ячейки «причина × фаза» добиты (объявленная причина ≥2); **причина × вид** (technique/strength/stability) ≥2; +32 своих реальных exId | ≥80; каждый exId — каталог (source-guard); причина×фаза ≥2; причина×вид ≥2 | `3c8f2416`, `c9a16fcb` |
| **ББ (hub 5)** | **52 → 87** записи; зоны/сигналы/драйверы доведены до **≥4** (было ≥3); закрыты `recovery` (strength 0) и `volume` (stability 0); NEW движок **сессии/блока коррекции** (волна 3-3-4-4-4-4-3-3) + карточка в хабе + HTML/CSV-экспорт + превью моста | зона/сигнал/драйвер ≥4; причина×фаза ≥2; блок не выгружается пустым | `c3edbb09`, `181a4049`, `e69321d8`, `bdf014b7` |
| ICS/годовой паритет | Арм: мёртвый `buildArmIcs` подключён в хаб (`data-arm="export-ics"`); Армлифтинг: NEW `armlift-ics` (календарь спец-блока) + NEW `armlift-annual-bridge` (годовой overlay, ключ `he_armlift_annual_sync_v1`, кнопка `data-arm="lift-annual"`) | ICS-экранирование/VEVENT/DATE; overlay ≤52 нед; битый стор → null | `5b559567`, `d43f3b5d` |
| Пороги round-10 (вторая ступень) | ТА «причина × фаза» **≥3** (83 записи), стронг «причина × вид» **≥3** (92), армлифтинг «причина × фаза» **≥3** (66), ББ зона/сигнал/драйвер **≥4** (87); армлифтинг: аудит плана по 5 звеньям, чипы покрытия снарядов N/7, `equipmentAlt` 66/66; арм: `weakPointsForPhase` = канон ∪ fixesPhase | соответствующие пороги в локах | `4e3bff7d`, `47d42239`, `55a48f7d`, `bdf014b7`, `e9787e2f`, `1c5ab92b`, `59b2da5c`, `60bc2390` |
| Армрестлинг (топ-ап) | топ-ап снова даёт выбор: 7 из 12 точек дублировали базу → +1 уникальный id на каждую (пул 7–10) | топ-ап реально добавляет ≥1 уникальный id | `9c6a3489` |

Ключевая находка round-9: в ТА **43 из 74 id библиотеки были синтетическими** (нет записи
в каталоге) — `catalogLookup` их не находил, из-за чего фильтры оборудования/мобильности
молча обходились. Закрыто по правилу §3.0 (достройка каталога, а не выбрасывание).

Проверено после каждого шага: `tsc --noEmit` 0 по всему проекту; круги движков
(`arm` 1123, `strength-sport` 1003) и UI-хабов — зелёные (кроме известного чужого
unhandled `revokeObjectURL` в `lab-exercise-ui`).

## 1. Аудит (факт по коду, Sep 2026)

| Хаб | Контент-движок | Объём | Ранжир | Дозы | Инъекция | Тесты-локи |
|---|---|---|---|---|---|---|
| **Армрестлинг** | `engines/arm/arm-weakpoint-corrections.ts` (база 12 точек, `exercises[]` по 4–5 id) + `arm-correction-pro2.engine.ts` `POOL_TOPUP` (8 точек по 1–2 id) + `CORRECTION_ROLE`/`ANTAGONIST_FOR`/`TABLE_DRILLS` | 12 точек; каталог arm — **73 id** | `arm-correction-rank.engine.ts` | `arm-correction-dose.engine.ts` + `doseForCauseV2` | `arm-diagnostics-injection.engine.ts` (`rankedIds` ⭐) | `arm-corrective-pro2` 27, `arm-corrective-ui` 5, `arm-hub-correction` |
| **Армлифтинг** | `engines/arm/armlift-correction.engine.ts` (пул ~50 записей: `id/exId/causes/level/phase/cues/progression/equipmentAlt/gentle`) + `armlift-session-rules.engine.ts` | ~50; каталог arm — 73 id | `rankArmliftCorrections` | там же (`protocol`) + `rirForCause` | `armlift-injection.engine.ts` | `armlift-correction-pro` 24, `armlifting-correction-pro-ui` 2 |
| **ТА** | `engines/strength-sport/strength-sport-ta-corrective.engine.ts` (`TA_CORRECTIVES`, конструктор `P(...)`) | **68** записей; 22 тега ошибок; каталог main 590 + `exercise-catalog-ta-supplement.ts` 14 | `ta-correction-rank.engine.ts` | `protocolForPreferred`, `adjustProtocolForCause` | `ta-injection.engine.ts` | `ta-corrective` 24, `ta-corrective-ui` 14, `ta-injection` 15 |
| **Стронг** | `engines/strength-sport/strength-sport-sm-corrective.engine.ts` (`SM_CORRECTIVES`, конструктор `C(...)`) | **56** записей; 18 тегов ошибок; каталог main 590 | `sm-correction-rank.engine.ts` | `buildSMSpecProtocols`, `protocolForSMPreferred` | `sm-injection.engine.ts` | `sm-corrective` ~21, `strongman-diagnostics-corrective` 14, `strongman-diagnostics-inject` 3 |

> Таблица выше — **снимок ДО работ** (аудит Sep 2026). Актуальные числа — в §0.
> ББ-диагностика (hub 5, добавлена по ходу): `engines/bb/bb-corrective.engine.ts`
> (`BB_CORRECTIVES`, 52 записи; зоны/сигналы/драйверы; `rankCorrectives` запас 6).

## 2. Что значит «глубже» (цели)

- **Больше упражнений в пулах**: каждая фаза/точка коррекции получает ≥6 кандидатов
  (сейчас ТА ~4.3/фаза, стронг ~3.5/фаза, арм 4–5/точку базы + топ-апы).
- **Новые движки коррекции** (чистые, без UI/storage), которых нет:
  - порядок коррекции по фазам уже есть (ТА `correctionOrderFor`, а у SM/arm нет единого);
  - дерево сложности regression/progression (есть строки, нет машинной связи);
  - equipment-альтернативы по каждой записи (у SM частично `equipmentAlt`, у ТА нет);
  - session-map: 1 упражнение на фазу/точку, роль-порядок, кап (у ТА/SM есть session/block, у arm — только предпросмотр);
  - контр-движения/профилактика пары (у arm `ANTAGONIST_FOR`, у ТА/SM нет).
- **Покрытие**: у каждой фазы/точки ≥2 упражнения на каждую причину (`volume/technique/mobility/fatigue/strength/grip`) и ≥1 на каждый тег ошибки.

## 3.0 Пополнение каталога (ВАЖНО — если топ-упражнения нет в каталоге)

Правило пользователя: **если упражнение нужное (топ) и его нет в каталоге — его надо ДОБАВИТЬ
в каталог, а не выбрасывать/заменять**. Поэтому в каждом хабе шаг 0 — пополнить каталог:

- Добавить запись в соответствующий каталог (`src/core/exercise-catalog.ts` — main для ТА/стронга,
  `src/core/exercise-catalog-arm.ts` — арм/армлифтинг) с ПОЛНОЙ корректной записью: `id`, `name`,
  `group`/мышца, `movementPattern`, `equipment`, `difficulty`/тир, `compound|isolation`, теги.
- Если упражнение может попасть в ББ/план-пулы — обязательна lab-bio запись (`exercise-biomechanics-db`)
  + маппинг инструкций (`exercise-id-mapping`) — иначе падает guard `bb-instructions-source`
  («все план-упражнения с lab-bio») и `bb-catalog-consistency`.
- Проверить `trueMuscleOf`/`ANGLE_CLASSES` (movement-pattern), чтобы упражнение корректно
  классифицировалось (иначе ломаются пулы/гарантии).
- Lock-тесты: новый id существует, классификация верна, ни один существующий пул/тест не сломан
  (каталог влияет на ББ-авто, поэтому прогонять и `bb`-круги).
- «Синтетикой» считается НЕ добавление упражнения, а фиктивный id без записи в каталоге.

## 3. План по хабам (P1 → P2)

### 3.1 Армрестлинг
- P1: `ARM_CORRECTIONS[wp].exercises` — довести до ≥6 реальных id на каждую из 12 точек (id из `core/exercise-catalog-arm.ts`, 73). `POOL_TOPUP` — на **все 12** точек (сейчас только 8).
- P1: `CORRECTION_ROLE` — разметить роль (heavy/static/pulse/iso/table/pump) **для каждого нового id** (иначе `roleLabel='-'`).
- P2: `ANTAGONIST_FOR`/`TABLE_DRILLS` — дополнить, если появятся новые паттерны.
- Non-regression: дефолтный топ-3 (`arm-corrective-pro2` lock) не должен сдвигаться; если сдвиг неизбежен — осознанный re-baseline с «было→стало».

### 3.2 Армлифтинг
- P1: `armlift-correction.engine.ts` — +N записей (реальные `exId` из arm-каталога), закрыть «≥2 на каждую причину × фазу × implement (RT/Axle/Pinch/Hub/CoC/Excalibur/Silver)`.
- P1: `equipmentAlt` и `gentle` на каждую новую запись; `cues`/`progression` обязательны.
- Non-regression: `armlift-correction-pro` (24) — дефолтные топ-3 целы.

### 3.3 ТА
- P1: `TA_CORRECTIVES` 68 → ≥96 (≥6 на каждую из 16 фаз). Новые теги — только из `TACorrectiveErrorTag` (22) или осознанное расширение словаря + `TA_ERROR_TAG_RU`.
- P1: каждой новой записи — `cues`, `progression`, `regression`, `source` (Catalyst/QWA/PoinT GO/Torokhoriy/Big Bend/Burgener).
- P2: `CORRECTIVE_HOW_NOT` (19) и `TA_WARMUP_PRIMERS` (12) — добить на новые фазы.
- Non-regression: `ta-corrective` 24 — топ-3 × 16 фаз × 6 причин lock-матрица цела.

### 3.4 Стронг
- P1: `SM_CORRECTIVES` 56 → ≥80 (≥5 на каждую из 16 фаз). Новые теги — из `SMErrorTag` (18) или расширение словаря + `SM_ERROR_TAG_RU`.
- P1: `SM_TAG_PHASES` (тег → фазы) — покрыть новые записи; `SM_CORR_EXID_BY_ID` — реальные id.
- P2: `SM_CORRECTIVE_PHASES` дериватив цел; `equipmentAlt` на новые.
- Non-regression: `strongman-diagnostics-corrective` (14) — топ-3 и дозы целы.

## 4. Правила (жёсткие)

1. **Id — из каталога ИЛИ добавить в каталог.** Если нужного (топ) упражнения нет — **добавить его в каталог** корректной полной записью (§3.0), а НЕ выбрасывать и НЕ заменять. «Синтетика» — это фиктивный id без записи в каталоге; добавление реального упражнения синтетикой не считается. Lock-тест: каждый id коррекции существует в каталоге; каждый новый id имеет полную запись (+lab-bio/id-mapping, если план-eligible).
2. **Доза в коридорах** (sets 1–6, reps 1–10/холды, pct 20–110, rir 0–4, rest 60–300) — lock-тест по всем записям.
3. **Покрытие** — lock-тесты: ≥2 на причину/фазу (там, где движок имеет причины), ≥1 на тег.
4. **Non-regression ранжира** — дефолтные топ-3 не двигаются; если двигаются — только осознанный re-baseline с комментарием «было→стало».
5. **Только Edit/Write** (никаких PowerShell-перезаписей — портит кодировку); перечитывать перед edit.
6. **Коммит строго pathspec** своих файлов, без пуша; чужие WIP не трогать.
7. **Проверка**: `tsc --noEmit` 0; круги `src/engines/arm` + `src/engines/strength-sport`; UI `TrainingScreen_parts`; `vite build`.

## 5. Готовый промт новой сессии

```
Расширь контент коррекции по плану docs/HUB-CORRECTION-CONTENT-PRO-PLAN.md — по каждому хабу.
ГЛАВНОЕ: если нужного (топ) упражнения НЕТ в каталоге — ДОБАВЬ его в каталог полной корректной
записью (id/name/group/movementPattern/equipment/тир + lab-bio + exercise-id-mapping, §3.0),
а НЕ выбрасывай и НЕ заменяй. Это не «синтетика» — синтетика = фиктивный id без записи в каталоге.

1) Армрестлинг (src/engines/arm/arm-weakpoint-corrections.ts + arm-correction-pro2.engine.ts):
   доведи exercises[] до ≥6 id на каждую из 12 точек (id из src/core/exercise-catalog-arm.ts; чего нет —
   добавь в каталог arm по §3.0), POOL_TOPUP на все 12 точек, разметь CORRECTION_ROLE для каждого
   нового id. Дефолтный топ-3 не сдвигать (или осознанный re-baseline «было→стало»).

2) Армлифтинг (src/engines/arm/armlift-correction.engine.ts): +≥16 записей (exId из arm-каталога; чего нет —
   добавь в каталог arm по §3.0), ≥2 на каждую причину×фазу×implement (RT/Axle/Pinch/Hub/CoC/Excalibur/Silver);
   каждой — cues/progression/equipmentAlt/gentle; дефолтные топ-3 (armlift-correction-pro) не сдвигать.

3) ТА (src/engines/strength-sport/strength-sport-ta-corrective.engine.ts): TA_CORRECTIVES 68 → ≥96
   (≥6 на каждую из 16 фаз); теги — из TACorrectiveErrorTag (или расширяй словарь + TA_ERROR_TAG_RU);
   cues/progression/regression/source обязательны; матрица-лок «топ-3 × фаза × причина» цела.

4) Стронг (src/engines/strength-sport/strength-sport-sm-corrective.engine.ts): SM_CORRECTIVES 56 → ≥80
   (≥5 на каждую из 16 фаз); новые теги — из SMErrorTag (или расширение + SM_ERROR_TAG_RU);
   SM_TAG_PHASES/SM_CORR_EXID_BY_ID обновить; strongman-diagnostics-corrective цел.

Правила: id — из каталога ИЛИ добавь упражнение в каталог полной записью (а не выбрасывай/заменяй);
lock-тесты на существование id/классификацию/покрытие/дозы; ранжир — non-regression (иначе re-baseline
«было→стало»); только Edit/Write; коммит pathspec без пуша.
Проверь: tsc 0; круги engines/arm + engines/strength-sport + bb (каталог влияет на ББ-авто); UI
TrainingScreen_parts; vite build.
```

## 6. Границы (не делать)
- Не менять математику объёма/капов/MRV (только контент коррекции).
- Не ломать калиброванные тесты без осознанного re-baseline.
- Не добавлять фиктивные id без записи в каталоге (а вот добавлять недостающее РЕАЛЬНОЕ упражнение в каталог — нужно, §3.0).
- Не трогать UI-структуру хабов (она уже приведена к единому каркасу round-2…8).
