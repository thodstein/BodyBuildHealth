# ТА-диагностика: коррекция движений — анализ, синтез, план, выполнение

## 1. Аудит что есть (по коду, Sep 15 2026)

`WLDiagnosticsHub.tsx` (~1926 строк, 7 табов) → конвейер уже зрелый (V3 + V4 + IPST + spec opt-in + откат):

| Слой | Файл | Выход |
|---|---|---|
| 16 фаз (рывок 5 / взятие 3 / толчок 3 / база 5) | `strength-sport-weakpoint.ts` | `WL_WEAKPOINT_LABELS/ANGLE/CORRECTION` (3 id-строки на фазу) |
| Числовая биомеханика | `strength-sport-biomechanics.engine.ts` | `TA_BIOMECH`: углы/мышцы/reason/corrections-строки/loadCues/intensityPct/refs |
| Причина (Everett-лимитер) | `ta-weak-cause.engine.ts` | volume/technique/mobility/fatigue/strength + confidence + текст |
| Топ-3 ранжир | `ta-correction-rank.engine.ts` | топ-3 из CORRECTION-id + скоринг оборудование/мобильность/причина + протокол 3×5@intensityPct |
| Симуляция Δ | `ta-simulator.engine.ts` | Δ сетов/тоннаж/покрытие (read-only) |
| Спец-блок 4–8 нед | `ta-spec-block.engine.ts` | волна 3,3,4,4,4,4,3,3 + dayMap + rationale |
| Инъекция + откат | `ta-injection.engine.ts` | вставка ⭐/топ-1 во все недели + `he_strength_sport_plan_prev_v1` |
| Измерения | VBT/FvR2/LVP/MVT/IMTP+IFP+IPST/OHS L/R/Kinovea/PCI | причины питаются живыми данными |

**Дефицит (честно): коррекция была россыпью, а не системой.**
1. 3 id-строки на фазу без техники: атлет видел «рывковая тяга», но не видел зачем/от какой ошибки/дозу/кью/прогрессию.
2. `corrections`-строки в TA_BIOMECH — свободный текст, не связанный с ранжиром/инъекцией (два источника правды).
3. Нет словаря ошибок движения (прыжок вперёд, ранняя тяга, дуга, медленный turnover, завал dip, короткие ножницы) → видео/углы/bar-path не маппятся в «что делать».
4. Нет коррекционной сессии (что делать за 20–30 мин сегодня) и волны блока с именами упражнений (spec-блок даёт только сеты фаз).
5. Хаб: коррекции размазаны по 4 фазным табам (топ-3 под каждой фазой) — единого места «мой план коррекции» нет.

## 2. Интернет-синтез (Sep 2026, добор к V3/V4)

- **Everett, Catalyst Athletics (2025, «Fix the Lift by Finding the Limiter» + «Jumping Forward»):**
  лимитеры strength/technique/mobility — сначала категория, потом точечный инструмент;
  segment/halting/slow-pull/lift-off — стартовая позиция и сдвиг назад после срыва;
  high-pull/muscle/tall — близость грифа + контроль после финиша;
  balances/drop/heaving — приём и агрессивность фиксации. Принцип вшит в движок
  (причина → подбор; ошибка → инструмент).
- **Queensland Weightlifting (QWA, матрица faults→causes→corrections):**
  взятие — ягодицы раньше грифа / бар вперёд / назад / далеко от голеней / вперёд
  от бедра / слабый финал / незафиксированный приём / касание коленей;
  толчок — подсед на носках / глубокий медленный dip / драйв вперёд / мелкий сплит /
  бар назад / неудержание на прямых / разъезд по помосту. Все строки покрыты
  записями библиотеки (dip/balance/behind-neck/tall/push-press/recovery).
- **PoinT GO 2026 (IMU 800 Гц, 5-фазная прогрессия рывка):** пороги ошибок —
  ранняя тяга >1.2 м/с, горизонталь >±10 см, уход >0.45 с, асимметрия гиро ≥5°;
  аксессуары строго по лимитеру (оверхед-стабильность / hip-hinge / взрыв /
  скорость ухода / приём). Пороги уже в хабе (PCI/SRD); аксессуарная таблица —
  в библиотеке (фаза technique/strength/stability).
- **Torokhtiy 2025 (snatch vs clean):** 8 ошибок рывка + 7 взятия; ключевое —
  не смешивать snatch/clean-технику в одной сессии (разные hip-contact/bar-path/
  timing). Учтено: коррекционная сессия группируется по движению, вис/блоки
  не смешиваются в одном шаге.
- **Big Bend 2024 (lockout):** вертикальный drive ногами (dip snatch, no-feet),
  локти вверх + «брить грудь», тело вокруг грифа; толчок — «ноги, потом панч»
  (tall jerk), behind-neck jerk как перегруз, double-pause jerk как праймер.
  Все пять — записи библиотеки с кью дословно.
- **Burgener/CrossFit 2025:** ~80% ошибок — стопы (tall clean/snatch, drop snatch,
  snatch balance, push jerk). Покрыто техникой-фазой библиотеки (novice-доступно).

## 3. План (эпики C1–C3, малые, поверх — ядро не трогаем)

- **C1 Библиотека коррекции (движок).** NEW `ta-corrective.engine.ts`:
  запись = targets(фазы) + errors(теги) + causes(лимитеры) + level + phase
  (technique/strength/stability) + protocol + cues + progression/regression + source;
  функции `correctivesForWeakPoint` (ранг под причину+уровень),
  `correctivesByError` (видео→упражнение), `correctiveSessionFor` (сессия 20–30 мин),
  `correctiveBlockFor` (волна 4–8 нед с именами). DoD: все 16 фаз ≥3, id уникальны.
- **C2 Таб «Коррекция» (хаб).** 8-й таб: фаза → причина → карточки упражнений
  (доза + 2 кью + прогрессия/регрессия + источник + Δ) + ⭐ (в preferredCorr →
  инъекция первой) + сессия + волна + кнопка 💉 (существующий handleInjectToPlan).
  DoD: UI-тесты (таб/пики/⭐→сессия).
- **C3 Связка «замер → тег → упражнение → экспорт» (без дублей).**
  Движок: `TA_ERROR_TAG_RU` (22 RU-подписи) + `tagsForBarMetrics` (пороги SRD:
  ≤4 молчит, 4–6 bar_forward, >6 +bar_crash; jerk — drive_forward) + `correctiveById`
  + `correctiveExportLines` (имя + доза + кью + источник). Хаб: хинт
  `data-wl="corrective-video"` в Видео при warn/critical (теги → топ упражнений +
  «→ Открыть Коррекцию»); экспорт `corrections[]` обогащён cue/source +
  новый `correctiveDetail[]`. Ранжир/инъекция не тронуты (контент-слой).
  Lock-тест: все id библиотеки инжектабельны (`estimateCorrBasePm > 0`).
  Осознанно не делаем: переписывание ранжира на библиотеку, SFR для ТА, CV-трекинг.

## 4. Выполнение (Sep 15 2026, закрыто кодом)

- **C1:** NEW `strength-sport-ta-corrective.engine.ts` (~450 строк, 43 записи):
  рывок отрыв/середина (deficit/pause/segment/slow-pull/liftoff/pull/high-pull/blocks),
  уход/сед/оверхед (high-hang/tall/muscle/power/drop/balance/overhead/sots/hold/nofeet/dip),
  взятие (deficit/pause/blocks/high-hang/tall/muscle/pull/front), толчок
  (dip/double-pause/pause/balance/behind-neck/tall/push-press/push-jerk/recovery),
  база (pause/tempo/deficit-pull/pause-pull/rdl/pin/ohp); все 16 фаз ≥3 (lock-тест),
  дозы под причину (volume 4×5 / strength 4×4+5% / mobility-fatigue −5%).
  Тесты NEW `ta-corrective.test.ts` 11/11 (покрытие/уникальность/дозы/ранг/уровень/
  теги/сессия/блок/неизвестное-молчит).
- **C2:** хаб `WLDiagnosticsHub.tsx` (+~70 строк): импорт, `WLTab += 'correction'`,
  `TAB_DEFS += 🛠️ Коррекция`, рендер-блок `data-wl="corrective"` (фаза→причина→
  `data-wl="corrective-pick"` ×5 с дозой/кью/прогрессией/Δ + ⭐ + сессия + волна +
  `data-wl="inject"`). NEW `ta-corrective-ui.test.tsx` 3/3 (таб/пики+дозы/⭐→сессия).
- **C3 (продолжение, тот же день):** движок += `TA_ERROR_TAG_RU` (22) +
  `correctiveById` + `tagsForBarMetrics` (SRD-пороги 4/6, jerk-ветка) +
  `correctiveExportLines`; хаб — хинт `data-wl="corrective-video"` в Видео
  (warn/critical → теги → топ упражнений + переход в Коррекцию) + экспорт
  `corrections[]` с cue/source + `correctiveDetail[]`. Тесты: `ta-corrective`
  11→**16/16** (инжектабельность всех 43 id, RU-покрытие тегов, пороги,
  exportLines) + UI 3→**5/5** (хинт при петле 8, молчание при ≤4).
- **Проверено (C3):** движки 104/104 (corrective 16 + rank 6 + simulator 4 + weak-cause 10 +
  v4 35 + pro 27 …) + UI corrective **5/5** + v4-ui 5/5 +
  wl-hub 39/39 (итого 173/173 в 12 файлах); `tsc` **0 по своим** (1 ошибка — чужой
  `BbAutoConstructor.tsx:3304 string|null`, активный чужой рефактор 4.3, не тронут);
  `verify:apk-design` OK. НЕ ПУШИЛ (очередь чужих WIP).
