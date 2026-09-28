# ПЛ-АВТО: Полный аудит и план доведения до топ-уровня

**Дата:** 2026-09-27
**Объём:** ~361 файл (движки 89, UI 26, данные 109, тесты 137)
**Текущий статус:** Зрелая система. VBT, авторегуляция, DUP, тапер, делод — уже реализованы как движки, но **не интегрированы в генерацию плана** и не доступны пользователю в полном объёме.

---

## §1. Аудит текущего состояния

### 1.1. Что уже хорошо (не трогаем)

| Компонент | Состояние |
|-----------|-----------|
| Иммутабельность циклов | `deepFreezeCycleTemplates()` + `cloneCycleTemplate()` — источник правды защищён |
| Согласие на изменения | `sourceChangeConsent` + `strict_skip` — пользователь контролирует длину цикла |
| Мост между планировщиками | 17 kinds (`pm`, `weakpoints`, `deload`, `peak`, `cycle`, `macrocycle` и др.) |
| Персистентность | `he_pl_session` + `he_pl_runtime` + `he_pl_macro` — полное состояние переживает перезагрузку |
| Облачная синхронизация | `cloud-kv.ts` — кросс-устройство через Supabase |
| Экспорт | PDF/печать, Excel (.xlsx), Telegram share |
| Каталог упражнений | 562 записи с биомеханикой, 3-слойное разрешение имён |
| VBT-движок | `vbt.engine.ts` — LVP, velocity loss, intent zones, калибровка, MVT |
| Авторегуляция | `autoregulation-pro.engine.ts` — velocity loss, ACWR, readiness, HRV, RPE |
| DUP | `progression-pro.engine.ts` — id: "dup", 4-недельные циклы |
| Тапер | `lms-taper.engine.ts` — 3 режима (classic/pl/pro) |
| Делод | `lms-deload.engine.ts` — объём ×0.5, RIR +3 |
| Слабые точки | `weakpoint-pl.ts` — 24 точки, 7 движений |
| Сезонный планировщик | `PLSeasonBuilder` — 4 слота, согласия, авто/ручной выбор |
| Макроцикл | `MacrocyclePanel` — 5 фаз, соревнования с приоритетами |
| Тестовое покрытие | 137 тестовых файлов |

### 1.2. Архитектурные проблемы

| # | Проблема | Серьёзность | Файлы |
|---|----------|-------------|-------|
| A1 | **God-файл `lms-builder.engine.ts` (2466 строк)** — смешаны: генерация недель, прогрессия PM, RIR, инъекция слабых точек, PED-адаптация, ACWR, тапер, делод, метрики. Нет разделения на слои. | P1 | `lms-builder.engine.ts` |
| A2 | **Дублирование логики RIR** — `bbRir()` в bb-builder и `rir-matrix.engine` в LMS — два источника RIR, которые могут расходиться. | P1 | `bb-builder.engine.ts`, `rir-matrix.engine.ts` |
| A3 | **Авторегуляция не подключена к `buildLMSPlan`** — `autoregulation-pro.engine.ts` и `vbt.engine.ts` существуют, но `buildLMSPlan` их не вызывает. Пользователь не может включить авторегуляцию при генерации плана. | **P0** | `lms-builder.engine.ts`, `autoregulation-pro.engine.ts` |
| A4 | **DUP не доступен в UI** — `progression-pro.engine.ts` имеет DUP, но `SRCBBScreen` не позволяет выбрать его как режим периодизации. | **P0** | `SRCBBScreen.tsx`, `progression-pro.engine.ts` |
| A5 | **Слабые точки PL и BB — разные системы** — `weakpoint-pl.ts` (24 точки, 7 движений) и `bb-weakpoint.ts` (группы мышц) не связаны. Пользователь видит два разных интерфейса. | P2 | `weakpoint-pl.ts`, `bb-weakpoint.ts` |
| A6 | **Сезонный планировщик и макроцикл — параллельные контуры** — `PLSeasonBuilder` (4 слота) и `MacrocyclePanel` (5 фаз) — пользователь не понимает, что выбрать. | P2 | `MacrocyclePanel.tsx`, `PLSeasonBuilder.tsx` |
| A7 | **VBT не интегрирован в план** — `vbt.engine.ts` работает как отдельный инструмент, но не влияет на генерацию плана. | **P0** | `vbt.engine.ts`, `lms-builder.engine.ts` |

### 1.3. Пробелы в интеграции (по интернет-исследованию 2025–2026)

| # | Проблема | Что есть | Чего не хватает | Приоритет |
|---|----------|----------|----------------|-----------|
| I1 | **Авторегуляция не влияет на план** | `autoregulation-pro.engine.ts` с velocity loss, ACWR, readiness | Вызов из `buildLMSPlan` → корректировка объёма/RIR на следующей неделе | **P0** |
| I2 | **VBT не подгружает вес** | `vbt.engine.ts` с LVP, velocity loss, intent zones | Автоматическая подгрузка веса по скорости разминочного подхода | **P0** |
| I3 | **DUP не выбираем** | `progression-pro.engine.ts` с DUP | Выбор DUP в UI → генерация плана с чередованием зон | **P0** |
| I4 | **Тапер не адаптируется** | `lms-taper.engine.ts` с 3 режимами | Тапер на основе тренда скорости: если скорость растёт → сократить, падает → продлить | P1 |
| I5 | **Делод не автоматический** | `lms-deload.engine.ts` с фиксированными параметрами | Авторегулируемый делод: ACWR > 1.3 → делод, скорость упала > 10% → делод | P1 |
| I6 | **Пик-неделя не автоматическая** | `lms-peak-block.engine.ts`, `PeakingPanel` | Автоматическая пик-неделя: снижение объёма 40–50%, поддержание интенсивности | P1 |
| I7 | **Слабые точки не инъецируются автоматически** | `weakpoint-pl.ts` с 24 точками | Автоматическая инъекция: диагностика → выбор упражнений → вставка в план | P1 |
| I8 | **Детренированность не учитывается** | Нет | Учёт пауз: 14 дней без тренировки → снижение PM на 5–10% (Yilmaz 2026, JSCR) | P2 |
| I9 | **Метаданные циклов неполные** | 136 циклов с базовыми метаданными | Нет полей `evidenceLevel`, `bestFor`, `timeCommitment`, `equipmentNeeded`, `periodization` | P1 |
| I10 | **Нет фильтра по оборудованию** | Циклы не знают, какое оборудование нужно | Пользователь с домашним залом получает план со штангой | P1 |

---

## §2. План доработок

### Фаза 1: Интеграция авторегуляции и VBT в генерацию плана (P0)

**Цель:** Подключить существующие движки авторегуляции и VBT к `buildLMSPlan`.

#### 1.1. Интеграция авторегуляции

**MOD `lms-builder.engine.ts`:** Добавить вызов `autoregulation-pro.engine.ts`:
```typescript
// После генерации недель, перед тапером
if (input.autoregMode && input.autoregMode !== 'off') {
  const autoreg = computeAutoregulation({
    velocityLoss: input.velocityLoss,
    acwr: input.acwr,
    readiness: input.readiness,
    hrv: input.hrv,
    sleep: input.sleep,
    fatigue: input.fatigue,
    lastRpe: input.lastRpe,
    goal: input.goal,
  });
  weeks = applyAutoregToWeeks(weeks, autoreg);
}
```

**MOD `SRCBBScreen.tsx`:** Добавить переключатель авторегуляции в настройки:
- `off` — без авторегуляции
- `rpe` — по RPE
- `vbt` — по скорости
- `hybrid` — комбинация

#### 1.2. Интеграция VBT

**MOD `lms-builder.engine.ts`:** Добавить вызов `vbt.engine.ts`:
```typescript
// После расчёта весов
if (input.vbtEnabled && input.warmupVelocity) {
  const vbtResult = estimate1RMFromVelocity(input.lift, input.warmupVelocity, input.warmupWeight);
  // Корректировка рабочего веса на основе оценки 1RM
  weeks = adjustWeeksByVBT(weeks, vbtResult);
}
```

**MOD `SessionPlayer.tsx`:** Добавить ввод скорости разминочного подхода → рекомендация рабочего веса.

#### 1.3. Тесты

- `lms-autoreg-integration.test.ts` — 10 тестов (интеграция в buildLMSPlan, режимы, граничные случаи)
- `lms-vbt-integration.test.ts` — 8 тестов (подгрузка веса, корректировка плана)

---

### Фаза 2: DUP как режим периодизации (P0)

**Цель:** Сделать DUP доступным в UI и интегрировать в генерацию плана.

#### 2.1. DUP в UI

**MOD `SRCBBScreen.tsx`:** Добавить выбор режима периодизации:
- `linear` — линейная прогрессия (текущая)
- `dup` — DUP с чередованием зон
- `block` — блочная периодизация

#### 2.2. DUP в генерации плана

**MOD `lms-builder.engine.ts`:** При `periodization === 'dup'`:
- Генерировать недели с чередованием зон (гипертрофия → сила → пик)
- Прогрессия PM внутри каждой зоны
- Делод каждые 4–6 недель

#### 2.3. Тесты

- `lms-dup-integration.test.ts` — 8 тестов (генерация DUP-плана, чередование зон, прогрессия)

---

### Фаза 3: Умный тапер и делод (P1)

#### 3.1. Тапер по скорости

**MOD `lms-taper.engine.ts`:** Добавить режим `'velocity'`:
- Вход: тренд скорости на 80% 1RM за последние 3 недели
- Если скорость растёт > 2% → суперкомпенсация идёт, тапер можно сократить на 1 неделю
- Если скорость падает > 2% → нужен более длинный тапер

#### 3.2. Авторегулируемый делод

**MOD `lms-deload.engine.ts`:** Добавить режим `'auto'`:
- Если ACWR > 1.3 → делод на 1 неделю с объёмом ×0.5
- Если скорость упала > 10% → делод на 1 неделю
- Если оба условия → делод на 2 недели

#### 3.3. Тесты

- `lms-taper-velocity.test.ts` — 6 тестов
- `lms-deload-auto.test.ts` — 6 тестов

---

### Фаза 4: Метаданные циклов и улучшенный селектор (P1)

#### 4.1. Расширение метаданных

**MOD `lms-types.ts`:** Добавить в `SRCycleMeta`:
```typescript
interface SRCycleMeta {
  // ... существующие поля
  evidenceLevel?: 'A' | 'B' | 'C';
  bestFor?: string[];
  timeCommitment?: 'low' | 'medium' | 'high';
  equipmentNeeded?: string[];
  periodization?: 'linear' | 'dup' | 'block' | 'conjugate';
  tags?: string[];
}
```

#### 4.2. Улучшенный селектор

**MOD `lms-selector.engine.ts`:** Добавить фильтры по:
- `evidenceLevel` — только с доказательной базой
- `equipmentNeeded` — по доступному оборудованию
- `timeCommitment` — по времени
- `tags` — по целям

#### 4.3. Тесты

- `lms-selector-filters.test.ts` — 8 тестов

---

### Фаза 5: Интеграция слабых точек (P1)

#### 5.1. Автоматическая инъекция

**NEW `lms-weakpoint-inject.engine.ts`:**
```typescript
interface WeakpointInjectInput {
  weakPoints: { lift: Lift; point: WeakPoint; severity: number }[];
  exerciseCatalog: Record<string, ExerciseEntry>;
  equipment: string[];
  maxPerDay: number;
}

interface WeakpointInjectOutput {
  exerciseMap: Record<string, string[]>;
  rationale: string;
}
```

#### 5.2. Тесты

- `lms-weakpoint-inject.test.ts` — 6 тестов

---

### Фаза 6: Пик-неделя (P1)

#### 6.1. Протокол пик-недели

**NEW `lms-peak-week.engine.ts`:**
```typescript
interface PeakWeekInput {
  weeksToMeet: number;
  currentVolume: number;
  currentIntensity: number;
  velocityTrend: number;
}

interface PeakWeekOutput {
  weeks: PeakWeek[];
  volumeReduction: number;
  intensityMaintenance: number;
  lastTrainingDay: number;
}
```

#### 6.2. Тесты

- `lms-peak-week.test.ts` — 5 тестов

---

### Фаза 7: Детренированность (P2)

#### 7.1. Учёт пауз

**MOD `lms-progression.engine.ts`:** Добавить функцию:
```typescript
function computeDetrainingPM(pm: number, daysOff: number): number {
  if (daysOff < 7) return pm;
  if (daysOff < 14) return pm * 0.97;
  return pm * 0.92;
}
```

#### 7.2. Тесты

- `lms-detraining.test.ts` — 4 теста

---

## §3. Интернет-синтез: ключевые находки

### 3.1. DUP vs Linear (Rhea 2002, Colquhoun 2017, Zourdos 2015)
- DUP даёт на 1–3% больше силы, чем линейная периодизация (при равном объёме)
- Оптимальная структура: 3 дня/нед, каждый день — разная зона
- Зоны: гипертрофия 67–77%, сила 78–85%, пик 87–95%

### 3.2. VBT (PMC8762534, 2022 — мета-анализ)
- VLT ≤ 25% → максимальная сила
- VLT > 25% → максимальная гипертрофия
- VBT точнее RPE на 15–20% (Cowley 2025)
- Комбинация VBT + RPE — оптимальна (Paulsen 2025, PeerJ)

### 3.3. Тапер (Travis 2020, Pritchard 2016, Sports Med 2026)
- Оптимальная длительность: 1–2 недели
- Снижение объёма: 30–70% (оптимум 40–50%)
- Интенсивность: поддерживать ≥85% или снижать на 5–10%
- Последняя тренировка: 3–4 дня до старта
- Становая тяга — раньше всех (6–8 дней), жим — позже (3–5 дней)

### 3.4. Делод (PMC10948666)
- Каждые 4–6 недель, длительность 6.4±1.7 дней
- Снижение объёма, поддержание частоты
- Интенсивность снижается, RIR увеличивается
- 48% атлетов используют восстановительные методы

### 3.5. Детренированность (Yilmaz 2026, JSCR)
- 14 дней без тренировки: снижение CMJ RSI, IMTP RFD, спринта
- Мышечная масса не меняется значимо
- Тестостерон падает, кортизол растёт, T/C ratio снижается

---

## §4. Приоритеты и порядок выполнения

| Фаза | Содержание | Приоритет | Статус |
|------|------------|-----------|--------|
| 1 | Авторегуляция + VBT | **P0** | УДАЛЕНО (VBT-в-плане не имел UI-потребителя; авторегуляция подключена отдельно) |
| 2 | DUP-режим | **P0** | ✅ ЖИВОЕ (переключатель → `buildLMSPlan`) |
| 3 | Умный тапер + делод | P1 | УДАЛЕНО (velocity-тапер и auto-делод не выбирались в UI) |
| 4 | Метаданные циклов | P1 | УДАЛЕНО (фильтры `rankCycles` UI не передавал) |
| 5 | Интеграция слабых точек | P1 | ✅ ЖИВОЕ (тесты существующей инъекции) |
| 6 | Пик-неделя | P1 | УДАЛЕНО (дублировала существующий тапер) |
| 7 | Детренированность | P2 | УДАЛЕНО (нет потребителя) |
| 8 | Проводка `autoReg`/`periodization` во все ПЛ-пути | **P0** | ✅ ЖИВОЕ (`buildSrc`/`buildSrcMacrocycle`/`seasonBuildOpts`) |

**Итог после чистки (Sep 27 2026):** живыми остались **Фаза 2 (DUP)** и **Фаза 8 (проводка авторегуляции/периодизации)** и **Фаза 5 (тесты)**. Излишки (VBT-в-плане, velocity-тапер, auto-делод, метаданные+фильтры, пик-неделя-движок, детренированность) удалены как не имеющие потребителя в продукте.

---

## §5. Критерии приёмки

1. **Авторегуляция работает:** `autoregulation-pro.engine.ts` вызывается из `buildLMSPlan`, влияет на объём/RIR
2. **VBT подгружает вес:** `vbt.engine.ts` используется для корректировки весов в плане
3. **DUP доступен:** пользователь выбирает DUP в UI, план генерируется с чередованием зон
4. **Тапер адаптируется:** тренд скорости влияет на длину тапера
5. **Делод автоматический:** ACWR > 1.3 → делод
6. **Слабые точки инъецируются:** диагностика → упражнения в плане
7. **Пик-неделя генерируется:** снижение объёма, поддержание интенсивности
8. **Детренированность учитывается:** 14 дней без тренировки → PM снижается
9. **Тесты:** все новые интеграции покрыты тестами, регрессии нет
10. **UI:** новые функции доступны через `SRCBBScreen`

---

## §6. Что НЕ делаем (осознанные границы)

1. **Не трогаем иммутабельность циклов** — `deepFreeze` + `clone` работает правильно
2. **Не меняем мост между планировщиками** — 17 kinds покрывают все сценарии
3. **Не переписываем `buildLMSPlan` с нуля** — добавляем слои поверх
4. **Не удаляем deprecated движки** — `lms-progression-feedback` оставляем для совместимости
5. **Не меняем таксономию уровней** — `intermediate` отсутствует в циклах, но это не критично
6. **Не добавляем новые циклы** — 136 достаточно, добавляем только интеграции

---

## §7. Готовый промпт для выполнения

```
Выполни план docs/PL-AUTO-TOP-TOOL-PLAN.md по фазам:

Фаза 1 (P0): Интеграция авторегуляции + VBT
- MOD lms-builder.engine.ts — вызов autoregulation-pro.engine.ts
- MOD SRCBBScreen.tsx — переключатель авторегуляции
- MOD lms-builder.engine.ts — вызов vbt.engine.ts
- MOD SessionPlayer.tsx — ввод скорости → рекомендация веса
- Тесты: lms-autoreg-integration.test.ts (10), lms-vbt-integration.test.ts (8)

Фаза 2 (P0): DUP в UI и генерации
- MOD SRCBBScreen.tsx — выбор режима периодизации
- MOD lms-builder.engine.ts — генерация DUP-плана
- Тесты: lms-dup-integration.test.ts (8)

Фаза 3 (P1): Умный тапер + делод
- MOD lms-taper.engine.ts — режим 'velocity'
- MOD lms-deload.engine.ts — режим 'auto'
- Тесты: lms-taper-velocity.test.ts (6), lms-deload-auto.test.ts (6)

Фаза 4 (P1): Метаданные циклов
- MOD lms-types.ts — новые поля в SRCycleMeta
- MOD lms-selector.engine.ts — фильтры
- Тесты: lms-selector-filters.test.ts (8)

Фаза 5 (P1): Интеграция слабых точек
- NEW lms-weakpoint-inject.engine.ts
- Тесты: lms-weakpoint-inject.test.ts (6)

Фаза 6 (P1): Пик-неделя
- NEW lms-peak-week.engine.ts
- Тесты: lms-peak-week.test.ts (5)

Фаза 7 (P2): Детренированность
- MOD lms-progression.engine.ts — computeDetrainingPM
- Тесты: lms-detraining.test.ts (4)

Только Edit/Write + vitest/tsc. Чужие WIP не трогать.
После каждой фазы — прогон тестов и коммит pathspec.
```
