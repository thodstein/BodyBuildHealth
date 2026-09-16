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

- **C1:** NEW `strength-sport-ta-corrective.engine.ts` (~450 строк, 43 записи на старте, **47 после C4**):
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
- **C4 (продолжение, «продолжай» №2): паритет библиотеки с ранжиром.**
  TDD-lock-тест «топ-3 каждой фазы × каждой причины (16×6×3=288 проверок) — в
  библиотеке» упал ровно на `jerk_lockout/split_jerk` → добавлены 4 недостающие
  записи (`split_jerk`, `back_squat`, `hack_squat`, `deadlift`; все инжектабельны
  по токенам basePm). Библиотека 43→**47 записей** — теперь суперсет ранжира:
  экспорт cue/source работает для любого пика. Тесты `ta-corrective` 16→**17/17**.
- **Проверено (C3):** движки 104/104 (corrective 16 + rank 6 + simulator 4 + weak-cause 10 +
  v4 35 + pro 27 …) + UI corrective **5/5** + v4-ui 5/5 +
  wl-hub 39/39 (итого 173/173 в 12 файлах); `tsc` **0 по своим** (1 ошибка — чужой
  `BbAutoConstructor.tsx:3304 string|null`, активный чужой рефактор 4.3, не тронут);
  `verify:apk-design` OK. НЕ ПУШИЛ (очередь чужих WIP).
- **Проверено (C4):** `ta-corrective` **17/17** + итого **174/174 (12 файлов)**;
  `tsc --noEmit` **0 по всему проекту** (чужой рефактор починен владельцем);
  `verify:apk-design` OK. НЕ ПУШИЛ.
- **C5 (продолжение, «продолжай» №3): экспорт дожимает C3-поля + mobility-хинт.**
  Экспортный движок (`wl-export`, своя ТА-зона): `WLCorrectionRow += cue/source`,
  `snapshot += correctiveDetail[]`; HTML — колонки Кью/Источник + секция
  «Коррекция детально» (всё через esc); CSV — `|cue`-суффикс в corrections
  (парсеров формата нет — проверено grep) + строка `correctiveDetail`.
  Хаб: хинт `data-wl="corrective-mobility"` в Мобильности при mobility-причине
  (щадящие дозы −5% + «→ Открыть Коррекцию», симметрия с video-хинтом C3).
  Тесты: `ta-export` 7→**10/10** (колонки/секция/CSV/XSS-cue) + UI 5→**6/6**.
  Проверено: итого **185/185 (13 файлов)**; `tsc` **0 по своим** (1 ошибка —
  чужой `BbAutoConstructor.tsx:3338 BbQualitySafetySection`, активный чужой
  рефактор 4.3); `verify:apk-design` OK. НЕ ПУШИЛ.
- **C6 (продолжение, «продолжай» №4): аудит полноты.** Lock-тесты: каждый из 22
  тегов ошибок имеет ≥1 упражнение + гигиена (имена RU уникальны, дозы в
  коридорах sets 1–6 / reps 1–10 / pct 20–110 / rir 0–4 / отдых 60–300 с,
  у каждой записи ≥1 причина). Разрывов не найдено — библиотека полна.
  Попутно поправлены устаревшие счётчики 43→47 (C4). Осознанная граница:
  чисто-мобильные дрилы (растяжка голеностопа/грудного) не вносим — у них нет
  базы ПМ, инъекция посчитала бы их штангой; мобильность чинится дозой −5%
  и OHS-гейтом ранжира.
- **C7 (продолжение, «продолжай» №5): последнее измерение без связки.**
  Асимметрия ножниц (L/R замеры, пороги 7/12%) жила только цифрой — теперь хинт
  `data-wl="corrective-split"` (split_asym → jerk_balance/split_jerk + «→ Открыть
  Коррекцию», симметрия с video/mobility-хинтами). По пути поймано своим тестом:
  персист localStorage даёт два хинта сразу — клики в тестах переведены на
  кнопки внутри хинта (код не тронут). Тесты UI 6→**8/8**.
- **Проверено (C8):** `ta-corrective` 19→**20/20**,
  `ta-injection` 13→**15/15**, UI 8→**9/9** + итого **193/193 (13 файлов)**;
  `tsc` **0 по своим** (3 ошибки — чужой untracked `strength-sport-sm-corrective.engine.ts`
  стронг-зоны, не тронут); `verify:apk-design` OK. НЕ ПУШИЛ.
- **C9 (по команде «выполняй, агенты там не работают»): закрыты оба остатка.**
  (1) Хинт петли в табе Рывок (`data-wl="corrective-snatch"`, тот же паттерн
  что video-хинт C3 — замер у инпутов, без похода в Видео). (2) Мост
  `taCorrectiveDetail`: хаб шлёт детальные строки (cap 9) → intake парсит
  (trim/дедуп/кап/≤160) → wizard держит в `taBridge` → конструктор пишет
  строку в rationale + счётчик в бейдж (механика билдера не тронута).
  (3) Попутно закрыт третий вариант дефекта C8: `buildSpecProtocols`
  (spec-кнопка конструктора) тоже глушил library-⭐ — теперь доза из
  `protocolForPreferred` (явный ⭐ = явный выбор, без equipment-фильтра
  ранжира). Тесты: intake +2 (санитизация detail, доза library-pref),
  wizard +1, UI +1 (snatch-хинт), spec-apply (бейдж `коррекция 1`
  end-to-end; rationale-пуш тем же билдом — путь покрыт intake-тестом).
  Проверено: итого **223/223 (16 файлов)**; `tsc --noEmit` **0 по всему
  проекту**; `verify:apk-design` OK. НЕ ПУШИЛ.
- **C8 (продолжение, «продолжай» №6 — из аудита «что осталось»): ⭐ честно
  вставляет.** Найдено чтением инъекции: гейт `corrList.includes(pref)` молча
  подменял ~19 библиотечных id (tall/drop/balance/segment…) legacy-первым, а имя
  строки бралось из свободного текста биомеханики (чужое имя на чужом id).
  Фикс в своих файлах: инъекция принимает library-pref (цели библиотеки по фазе)
  + имя из `correctiveById().nameRu`; хаб берёт дозу вставки из
  `protocolForPreferred` (NEW, тестируемая) — доза карточки = доза вставки.
  Тесты: injection +2 (library-pref вставляется с именем / мусор — legacy
  fallback) + corrective +1 (доза tall/volume/null/чужой фазе) + UI E2E
  (seed плана → ⭐ → tall_snatch в плане; по пути чинились персист-ловушки
  тестов). Проверено ниже.
