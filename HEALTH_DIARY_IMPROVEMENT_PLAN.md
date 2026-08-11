# Дневник здоровья — анализ и план улучшений

## Дата: 11 августа 2026

Комплексный критический аудит фичи «Дневник здоровья»: движок `health-diary.engine.ts`, UI `HealthDiary.tsx`, модалка `health-diary-modal.tsx`, аналитика `pain-insights.engine.ts` / `symptom-diary.engine.ts` / `health-score-v2.engine.ts`, хелперы `diary-helpers.ts`.

**Найдено: 3 P0 + 6 P1 + 7 P2. Ключевая фича-запрос пользователя — «план улучшений здоровья» — в приложении отсутствовала (этап 2 плана).**

---

## Статус выполнения (11 августа 2026) — ВСЕ ЭТАПЫ РЕАЛИЗОВАНЫ ✅

- **Этап 1 (баги P0/P1)**: выполнены все 9 исправлений — `pain-insights.engine.ts` (сортировка + локальные даты), `health-diary.engine.ts` (сортировка трендов зон, миграция `he_symptom_diary` + однократный мердж), `diary-helpers.ts` (label-маппинг «Боль»/«Нейро»/«Акне»/«Гемат», detectAnomalies через extractValue), `SleepDiary.tsx` (nested `pain.totalScore`), `HealthDiary.tsx` (удалён мёртвый код, undo при добавлении, цвет бейджа от реального скора).
- **Этап 2 (план улучшений)**: новый движок `src/engines/health-improvement-plan.engine.ts` (анализ профиля → рекомендации critical/high/medium/low → сводка → TXT-экспорт → storage) + UI-секция «🧭 План улучшений» в HealthDiary (чекбоксы выполнения, экспорт).
- **Этап 3 (индекс здоровья)**: `computeRealHealthScore()` в HealthDiary — реальные данные: pharma-риск (risk-calculator), labs (lab-diary), сон (he_sleep_diary), HRV/стресс (профиль v2), вес-тренд, тренировки (workout-logger); `scoreRecovery` теперь учитывает субъективную энергию.
- **Этап 4 (UX)**: черновик редактирования в sessionStorage, симметричная карта тела, детальный CSV/PDF (зоны + симптомы), корреляция на согласованных датах.
- **Этап 5 (тесты и верификация)**: `health-diary-audit.test.ts` (15 тестов) + `health-improvement-plan.test.ts` (34 теста). `tsc --noEmit` — 0 ошибок, полный vitest — 3380/3381 (единственный фейл — предсуществующий, из-за чужих незакоммиченных bb-правок, не связан с этой работой), `vite build` — OK.

---

## 1. Текущее состояние (что есть)

- Единый дневник `he_health_diary` (UnifiedHealthEntry): боль (7 зон VAS 0-10), симптомы (имя/severity/duration), нейро (10 чекбоксов), акне (4 зоны 0-3), гемато (8 чекбоксов), заметки. Одна запись на дату, cap 365.
- Миграция из 5 legacy-ключей (`he_pain_diary`, `he_symptoms_diary`, `he_neuro_diary`, `he_acne_diary`, `he_hemato_diary`).
- UI: окно HealthDiary (статистика, карта зон боли SVG, графики, корреляции, инсайты, таблица с пагинацией, CSV/PDF/SVG/PNG экспорт, undo) + быстрая модалка AddHealthModal (5 табов, черновик в sessionStorage, stale-чип, баннер замены записи).
- Движок статов: `getUnifiedPainStats/SymptomsStats/NeuroStats/AcneStats/HematoStats`, `getUnifiedTodayStatus`, `getTodayPainStatus`.
- Аналитика: `analyzePainEntries` (инсайты: severity/тренды/триггеры/время суток/облегчение/связь с упражнением), корреляции (cross + lag 1).
- Тесты: `health-diary.test.ts` (21 тест движка), `diary-modals-audit.test.tsx` (35 тестов модалок). **Нет тестов** на pain-insights, symptom-diary, HealthDiary UI, health-score-v2.

---

## 2. Найденные баги

### P0 — Критические (данные/аналитика считаются неправильно)

**P0-1: `analyzePainEntries` анализирует СТАРЕЙШИЕ 90 записей вместо последних**
`pain-insights.engine.ts:47` — `entries.slice(-MAX_ENTRIES)` на данных, отсортированных по убыванию даты (движок хранит desc). `slice(-90)` берёт хвост = самые старые записи. Последствия:
- `lastEntryDate` (строка 60) = дата СТАРЕЙШЕЙ записи → инсайт «Дневник не ведётся N дн. назад» врёт (может быть 300+ дней при ежедневном ведении).
- Инсайты severity/трендов строятся по старым данным.
- Аналогичный баг в `computeZoneBreakdown` (`diary-helpers.ts:23-25`): `last = values.at(-1)` = старейшее значение, `trend` сравнивает старейшее со вторым с конца.

**P0-2: `getUnifiedPainStats` — тренд и «last» по зонам считаются с конца**
`health-diary.engine.ts:365-367` — `vals` наполняется в порядке убывания даты, `last = vals[vals.length-1]` = старейшее значение, `prev` = второе старейшее. Тренд зоны (`up/down/same`) и значение «последняя» неверны.

**P0-3: Индекс здоровья в шапке — захардкожен**
`HealthDiary.tsx:635-645` — `computeHealthScore({ pharmaRisk: 50, weeksSinceLab: 4, nutritionAdherence: 70, ... })` — все значения константы, к реальным данным не подключены. Последствия:
- Badge 💚 показывает `diaryScore` (из реальных данных), но его ЦВЕТ (строки 683-685) считается от `healthScore.breakdown.recovery.score`, который при захардкоженных значениях = 35 и **никогда > 60** → бейдж вечно янтарный, даже при отличном дневнике.
- Число и цвет могут противоречить друг другу.

### P1 — Важные

**P1-4: UTC-дата вместо локальной в pain-insights**
`pain-insights.engine.ts:110, 264` — `new Date().toISOString().slice(0, 10)` — UTC. При TZ западнее UTC+0 (или после полуночи для UTC+3) «сегодня» не совпадает с локальной датой записей → `getTodayPainStatus` не находит сегодняшнюю запись, инсайт stale-diary может считаться неверно. Везде в проекте используется локальный `todayIso()` (`diary-helpers.ts:72`).

**P1-5: Аномалии и экстремумы по боли всегда пустые — несоответствие label**
`HealthDiary.tsx:585-586` — `detectAnomalies('pain', fields)` и `computeExtremes('pain', fields)`. `extractValue` для pain ищет поле с label `'Суммарно'` (`diary-helpers.ts:153-158`), а `entryFields` (`HealthDiary.tsx:89-107`) создаёт label `'Боль'`. → parseFloat('') = NaN → ни одной аномалии/экстремума, секция «Инсайты и аномалии» молчит даже при критичной боли. То же для `neuro`/`hemato` (label `'Нейро'`/`'Гемат'` vs искомые `'Симптомов'`).

**P1-6: Корреляция сна с болью всегда пустая**
`SleepDiary.tsx:577` — `readPoints('he_health_diary', 'totalScore')` читает корневое поле `entry.totalScore`, но в UnifiedHealthEntry боль лежит вложенно: `entry.pain.totalScore` (root `totalScore` отсутствует) → `Number(undefined) = NaN` → точка отфильтрована → корреляция «Сон ↔ Боль» никогда не отображается. (BPDiary.tsx:241 — правильно, с `e.pain?.totalScore ?? e.totalScore`.)

**P1-7: Два параллельных дневника симптомов — расхождение данных**
В «Инсайтах» `symptomSummary = getSymptomDiarySummary(30)` читает legacy `he_symptom_diary` (`symptom-diary.engine.ts`), а статистика `symptomStats = getUnifiedSymptomsStats(rows)` — unified `he_health_diary`. Пользователь заполняет unified-модалку, но инсайты по симптомам показывают другой (возможно пустой) дневник. Данные раздвоены, `he_symptom_diary` не мигрируется в unified.

**P1-8: Мёртвая переменная `symptomEngine`**
`HealthDiary.tsx:574` — `getSymptomDiaryStats()` вычисляется, но не используется нигде в рендере.

**P1-9: Undo неоднороден**
`HealthDiary.tsx:530-533` — добавление через модалку (`saveNew`) идёт с `remember=false` → undo не создаётся; правка — создаёт. Пользователь не может отменить случайное добавление (в ProfileDiariesTab undo-очередь для этого есть, а в самом HealthDiary — нет).

### P2 — Качество

**P2-10:** Мёртвый `points` (`HealthDiary.tsx:557-560`) — вычисляется, не используется.
**P2-11:** `confirm()` браузера для удаления/очистки (`HealthDiary.tsx:698, 1007`) — в проекте принят `showToast`.
**P2-12:** `EntryEditor` не сохраняет черновик в sessionStorage (в отличие от AddHealthModal) — потеря данных при случайном закрытии.
**P2-13:** PainBodyMap асимметрична (зоны только с одной стороны, `HealthDiary.tsx:163-171`).
**P2-14:** CSV/PDF экспорт содержит только суммы, без деталей (зоны боли, имена симптомов, списки нейро/гемато, триггеры).
**P2-15:** `scoreRecovery` в `health-score-v2.engine.ts:82-88` не использует параметр `subjectiveEnergy` (заявлен в интерфейсе, не участвует).
**P2-16:** Корреляция «боль ↔ симптомы» смешивает диапазоны: `allPoints` отфильтрован по range (`visibleDateSet`), а вторая серия — все строки (`HealthDiary.tsx:621-629`) → наборы дат не совпадают, выборка меньше возможной.

---

## 3. План улучшений

### Этап 1 — Починить аналитику (P0/P1, все 9 багов)

| # | Действие | Файлы |
|---|----------|-------|
| 1 | `analyzePainEntries`: сортировать по возрастанию даты ДО `slice(-90)` или брать `slice(0, MAX)`; `lastEntryDate` — из последней записи | `pain-insights.engine.ts` |
| 2 | `computeZoneBreakdown`/`getUnifiedPainStats`: сортировать зоны по возрастанию даты; `last` = самая свежая, `prev` = предыдущая | `diary-helpers.ts`, `health-diary.engine.ts` |
| 3 | Заменить UTC-дату на локальный `todayIso()` (импорт из diary-helpers) | `pain-insights.engine.ts` |
| 4 | Унифицировать label: в `entryFields` использовать `'Суммарно'` для pain/acne и `'Симптомов'` для neuro/hemato, либо расширить `extractValue` маппингом «Боль→Суммарно» | `HealthDiary.tsx` или `diary-helpers.ts` |
| 5 | SleepDiary: читать `e.pain?.totalScore ?? e.totalScore` (по аналогии с BPDiary) | `SleepDiary.tsx` |
| 6 | Миграция `he_symptom_diary` → unified (при существующей миграции); в инсайтах использовать unified-данные | `health-diary.engine.ts`, `HealthDiary.tsx` |
| 7 | Удалить `symptomEngine`, `points` | `HealthDiary.tsx` |
| 8 | Undo при добавлении (в `saveNew` передавать `remember=true`, сохраняя snapshot ДО изменения) | `HealthDiary.tsx` |
| 9 | Badge: цвет от реального `diaryScore` (пороги <40 красный, <70 янтарный, иначе зелёный) | `HealthDiary.tsx` |

**Тесты этапа 1** (файл `src/engines/__tests__/health-diary-audit.test.ts`, ~25 тестов):
- analyzePainEntries с desc-входом: lastEntryDate = свежайшая, slice берёт последние 90 (5 тестов)
- computeZoneBreakdown/getUnifiedPainStats: last/prev/trend на 3 записях (4 теста)
- getTodayPainStatus на границе локальной даты (2 теста)
- detectAnomalies/computeExtremes по боль-полю (4 теста)
- readPoints nested pain.totalScore (2 теста)
- миграция he_symptom_diary (4 теста)
- badge-цвет от diaryScore (2 теста)

### Этап 2 — «План улучшений здоровья» (ключевая фича)

**Новый движок `src/engines/health-improvement-plan.engine.ts`** (чистые функции, по образцу sleep-correlation / pain-insights):

1. `analyzeHealthProfile(entries)` → структура по доменам:
   - боль: средняя за 7/30 дней, худшая зона, тренд зон, триггеры top-3, время суток пика, связь с упражнением;
   - симптомы: top-5 по частоте × severity;
   - нейро/акне/гемато: счётчики, тренд за 2 недели;
   - регулярность: доля дней с записями за 14 дней, стагнация.
2. `generateHealthPlan(analysis)` → список рекомендаций с приоритетами:
   - `critical` (VAS ≥7 зона / гемато ≥2 / нейро ≥4): снизить нагрузку на зону, ОАК, консультация;
   - `high` (тренд ухудшения, частый триггер, стабильно высокая боль ≥35/70): модификация тренировки, протокол поддержки суставов, документирование триггеров;
   - `medium` (латентность дневника, единичные симптомы): регулярность ведения, гигиена;
   - `low` (положительные тренды): продолжать протокол.
   - Каждая рекомендация: `{ id, domain, priority, title, rationale (с цифрами), action, zoneIds?, linksToSupport? }`.
3. `summarizeHealthPlan(plan)` → итог: N критичных, N высоких, вердикт.
4. Интеграция контекста (опциональные поля): сон (sleep diary avg), АД, вес-тренд, профиль v2 (`health.jointPainSeverity`, `pharma.currentSubstances`) — рекомендации с учётом курса.

**UI** (`HealthDiary.tsx`):
- Секция «🧭 План улучшений» между статусом и статистикой: карточки с цветовой маркировкой приоритета, чекбоксы выполнения, кнопки «💾 Сохранить план» (localStorage `he_health_plan`) и «📄 Экспорт плана» (TXT/печать).
- Хранилище плана + отметок выполнения: `saveHealthPlan/loadHealthPlan` (как diary-storage-v2).

**Тесты** (`health-improvement-plan.test.ts`, ~30 тестов):
- analyzeHealthProfile: домены, пустые данные, 1 запись, тренды (10 тестов)
- generateHealthPlan: каждый триггер (критическая зона, гемато, нейро, тренд, триггер, стагнация, нерегулярность) (12 тестов)
- приоритизация и дедупликация (4 теста)
- summarize + экспорт-текст (4 теста)

### Этап 3 — Индекс здоровья из реальных данных

- Убрать хардкод из `HealthDiary.tsx`: `pharmaRisk` — из risk-engine по профилю/курсу, `weeksSinceLab` — из lab-diary (IndexedDB labs_log), `sleepScore` — computeSleepScore из дневника сна, `hrvMs/stress` — из профиля v2 (`lifestyle.morningHRV`, `stressLevel`), `weightTrend` — из дневника веса, `trainingConsistency` — из workout-logger.
- `scoreRecovery`: включить `subjectiveEnergy` (маппинг 1-5 → 0-100).
- Тесты: health-score-v2 с реальными профилями (10 тестов).

### Этап 4 — UX/качество (P2)

- Черновик для `EntryEditor` (sessionStorage, по образцу AddHealthModal).
- `confirm()` → `showToast` + подтверждение в стиле приложения.
- Симметричная карта тела (зеркальные зоны: 2 эллипса/круга для elbows/wrists/knees/ankles).
- Экспорт деталей: CSV — колонки зон и симптомов; PDF — полные строки.
- Корреляция на согласованных датах (обе серии через `visibleDateSet`).

### Этап 5 — Верификация

- `tsc --noEmit` — 0 ошибок
- `vitest run` — все тесты (2644 + ~90 новых)
- `vite build` — OK

---

## 4. Итог

| | Было | Станет |
|---|------|--------|
| Тренды зон/последние значения | считаются со старейшей записи | корректные |
| Инсайт «дневник не ведётся» | врёт (старейшая дата) | реальная давность |
| Аномалии боли | всегда пусто | работают |
| Корреляция сон↔боль | всегда пусто | работает |
| Индекс здоровья | захардкожен + вечно янтарный | реальный + цвет по данным |
| План улучшений | **отсутствует** | генератор рекомендаций с приоритетами + сохранение + экспорт |
| Тесты | 21 (движок) | ~110 (движок + аналитика + план + UI-интеграция) |

---

## Повторный анализ (Раунд 2, 11 августа 2026) — после реализации этапов 1-5

Повторный аудит после коммита `62e2edb3e`. Основные баги закрыты; найдены **остаточные проблемы связности данных** и точки доработки.

### Остаточные проблемы

**P2-a: Инсайты по симптомам читают legacy `he_symptom_diary`** — `HealthDiary.tsx:676` (`getSymptomDiarySummary(30)`). Симптомы, введённые в unified-модалку, НЕ попадают в секцию «Инсайты и аномалии» — там только старые legacy-данные. Источник раздваивается: миграция сделана, а источник инсайтов — нет. → агрегировать из unified `rows` (логика уже есть в `analyzeHealthProfile`).

**P2-b: `extremes` — мёртвый код** — `HealthDiary.tsx:699` вычисляет мин/макс боли, в JSX не используется. → показать в карточке «Распределение» или удалить.

**P2-c: Stat-карточки и диаграммы игнорируют range-фильтр** — при выборе «7 дней» таблица фильтруется, а средние по боли/нейро/акне считаются за всё время.

**P2-d: `saveHealthPlan/loadHealthPlan` не подключены к UI** — план регенерируется при каждом открытии; id рекомендаций порядковые — при изменении набора done-чекбоксы «плывут»; нет даты генерации. → персистентный план + стабильные id (hash содержимого) + кнопка «Перегенерировать».

**P2-e: План не учитывает другие дневники** — сон (<6ч), АД (≥140/90), вес-тренд, курс (pharma) не влияют на рекомендации. → опциональный `ctx` в `analyzeHealthProfile` + 4-6 новых правил.

**P2-f: Индекс здоровья — остаточный хардкод** — `nutritionAdherence: 70` и `subjectiveEnergy: 3`; энергия выводима из профиля (`lifestyle.fatigueLevel`); отсутствие labs штрафует 15% веса даже у новичков без анализов → «нет данных» ≠ «критично». `getProfile()` вызывается дважды.

**P2-g: UX-мелочи** — `confirm()` без toast-подтверждения результата; нет компонентных (UI) тестов HealthDiary.

### Предложения по доработке (приоритет)

| # | Что | Эффект |
|---|-----|--------|
| 1 | SymptomSummary из unified rows (убрать legacy-источник из инсайтов) | Инсайты = фактические данные дневника |
| 2 | Range-фильтр для статов и диаграмм | Непротиворечивые числа |
| 3 | Стабильные id рекомендаций + персистентный план + «Перегенерировать» + дата | Чекбоксы не «плывут», план переживает перезагрузку |
| 4 | `ctx` (сон/АД/вес/pharma) в анализе + правила рекомендаций | Кросс-модульные рекомендации |
| 5 | labs «нет данных» → нейтральная оценка; `fatigueLevel` → subjectiveEnergy; кэш getProfile | Честный индекс здоровья |
| 6 | Действия плана → ссылки на протоколы поддержки (суставы/нейро) | Сквозная навигация |
| 7 | `extremes` в UI / удалить; toast после экспорта/очистки; брейкдаун индекса чипами | Полировка |
| 8 | Компонентные тесты HealthDiary + тесты ctx-правил | Покрытие UI |

### Verification Round 2
- `tsc --noEmit` — 0 ошибок
- `vitest` — 3380/3381 (единственный фейл bb-glute — предсуществующий, чужие незакоммиченные правки)
- `vite build` — OK
- Пуш: `62e2edb3e` (только свои файлы; `diary-helpers.ts` ушёл в чужой коммит `00524231f`)

---

## Раунд 2 — статус выполнения (11 августа 2026) ✅

Все 8 предложений реализованы:

| # | Что сделано | Файлы |
|---|-------------|-------|
| 1 | `getUnifiedSymptomSummary(entries, days)` — инсайты по симптомам теперь из unified-дневника (тренд: последняя vs средняя предыдущих 3), legacy `getSymptomDiarySummary` убран из UI | `health-diary.engine.ts`, `HealthDiary.tsx` |
| 2 | Range-фильтр для статов/диаграмм/инсайтов: `rangeFields`/`rangeRows`/`rangeDateSet` (поиск влияет только на таблицу) | `HealthDiary.tsx` |
| 3 | Стабильные id рекомендаций (djb2-hash от приоритета+заголовка), персистентный план (`saveHealthPlan/loadHealthPlan` подключены), дата генерации в шапке, кнопка «🔄 Перегенерировать» | `health-improvement-plan.engine.ts`, `HealthDiary.tsx` |
| 4 | `HealthPlanCtx` (сон/АД/курс/вес-тренд) + 5 новых правил: сон <6ч (medium), АД ≥160 (critical) / 140-159 (high), мониторинг на курсе (medium), набор >0.5 кг/нед (medium) | `health-improvement-plan.engine.ts`, `buildPlanCtx()` в `HealthDiary.tsx` |
| 5 | `scoreLabs`: «нет анализов» (≥52 нед) → нейтральные 50 вместо 10; `subjectiveEnergy` из `lifestyle.fatigueLevel`; `getProfile()` читается один раз | `health-score-v2.engine.ts`, `HealthDiary.tsx` |
| 6 | `extremes` отображаются в карточке «Распределение» (даты мин/макс); toast после экспорта/удаления/очистки/сохранения; брейкдаун индекса чипами (6 доменов); ключи фрагментов карты | `HealthDiary.tsx` |
| 7 | Фикс React key-варнинга в PainBodyMap | `HealthDiary.tsx` |
| 8 | Компонентные тесты HealthDiary (4) + тесты ctx-правил (8) + стабильных id (2) | `HealthDiary.test.tsx`, `health-improvement-plan.test.ts` |

**Тесты: +14 (4 UI + 10 движок), всего по фиче 84. Верификация: `tsc --noEmit` 0 ошибок, полный vitest 3445/3445 (232 файла, чужой bb-фейл исчез после правок другого агента), `vite build` OK.**
