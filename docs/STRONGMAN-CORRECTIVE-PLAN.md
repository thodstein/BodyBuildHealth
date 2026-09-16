# Стронг-диагностика: коррекция движений + нижняя навигация — ПЛАН (Sep 16 2026)

Статус: **ВЫПОЛНЕНО кодом** (коммит `f31e1aa3`, без пуша — в очереди чужие WIP).
Файлы: NEW `strength-sport-sm-corrective.engine.ts` + NEW `strength-sport-sm-corrective.test.ts` +
MOD `StrongmanDiagnosticsHub.tsx` + NEW `strongman-diagnostics-corrective.test.tsx`.

---

## §1. Аудит: что было (чтение кода, без выдумок)

Хаб `StrongmanDiagnosticsHub.tsx` (1664 строки, 6 табов: Жим / Переноски / Загрузки / Хват/Кор /
Мобильность / Видео). Движки SM-зоны (~60 файлов) — зрелые: биомеханика 16 фаз, weak-cause
6 причин, scoring RSS, VBT carry 15% / press 10%, OHS 6 + heel-retest, Kinovea sway 3/5 см,
tri-modal хват, L/R асимметрия 7/12%, паспорт контеста, симулятор, попытки 85/92/98, LVP-рампа,
пофазный тайминг камня/отрезки, бицепс-гейт ≥70, hold-медли, формат-aware попытки, авто-углы,
ICS/год/экспорт, ortho-гейт.

Навигация: плавающая sticky-лента табов сверху (`position: sticky, top: 0`, горизонтальный
скролл) + sticky-полоса снизу (скор + «→ Применить в Стронг»). Жалоба: верхняя лента
плавает и съедает место — решение: **единая навигация закреплена внизу** (нижний док).

Коррекция — россыпь (разрывы G1–G8):

| # | Разрыв | Корень (file:line) |
|---|--------|--------------------|
| G1 | Коррекция = 3 id-строки на фазу без техники | `sm-biomechanics` `corrections: [...]` (16 фаз × 3 строки) |
| G2 | Топ-3 только по ПЕРВОЙ фазе | `StrongmanDiagnosticsHub.tsx:632` `smRankTop` использует `smWeakPoints[0]` |
| G3 | Нет доз по причине | `rankCorrectionsForSM` дозу по cause считает, но показывает только 1 фазу в «Итоге» строкой |
| G4 | Нет сессии коррекции | нет аналога `correctiveSessionFor` (TA) |
| G5 | Нет волны с именами | `sm-spec-block` — объёмный блок, не коррекционный (без имён недель) |
| G6 | Нет таба «Коррекция» | 6 табов, коррекция размазана по 4 табам + 1 строка итога |
| G7 | Нет связки «замер → тег → упражнение» | sway/VBT/асимметрия/OHS живут отдельно, в коррекцию не ведут |
| G8 | Нет экспорта коррекции | `sm-export` коррекции не несёт (только ранжир строкой в UI) |

Что НЕ трогали (осознанно): ранжир `sm-correction-rank` (рабочий, cause-aware), инъекция
`sm-injection`, спец-блок объёма, экспорт, конструктор (только аддитивные поля в payload).

---

## §2. Интернет-синтез 2024–2026 (что взято в библиотеку)

- **Лог (Heezza 2024, JMStrength 2025, BarBend/Felix-Reece 2025, LiftProof 2026):**
  SSB jerk-dip to pin 3×3 (вертикальный дип), viper press (связка без перепостановки),
  pin press со лба (локаут), floor / close-grip / JM press (трицепс), incline + Swiss-bar
  (угол rack), Z-press (стабильность), paused log, front squat (ноги под clean/drive),
  band pull-aparts + clean EMOM (тайминг), yoke holds 30–45с (rack-стабильность),
  «голова назад до локаута» (чинит ~80% механики), «brace до дипа».
- **Переноски (EliteFTS, Legg systematic, IUSCA 2026 FC vs ZC, Holmstrup):**
  короткий шаг 40–60 см + каденс (скорость на 60% отдельно от максимума),
  suitcase carry 2–3×20м (QL, анти-lateral flex — McGill), zercher carry
  (передняя нагрузка грузит multifidus — уникальный стимул стабильности).
- **Камень (Cerberus 2024, Harris 2018, Forge, JTS):** high-hips старт (как становая),
  руки-крюки + tacky (профилактика дистального разрыва бицепса — Heazlewood 2025),
  lap 2с на коленях + перехват, triple extension (бедра → носки → руки),
  front squat (anterior-нагрузка = поза камня), sandbag pendlay rows 4×10 (низа отрыва),
  stone extension (дотяг на грудь + взрыв).
- **Хват (AthleteProfile tri-modal, SBS grip 2024, IronMind, GripStrength CoC):**
  support / pinch / crush тестировать раздельно; plate pinch, axle hold, hammer curl,
  CoC-лесенка; асимметрия ≥12% = стоп-сигнал.
- **Кор/кондиция (McGill, Hindle, AthleteProfile lactate >14, Conjugate):**
  brace 360° + Pallof + dead bug; медли 30–60с — alactic 8×10с/50с → lactic 5×60с/90с;
  переходы репетировать без веса; sled/prowler спринты 25м.

---

## §3. План P1–P7 (все выполнены)

- **P1. Библиотека коррекции (движок).** NEW `strength-sport-sm-corrective.engine.ts`:
  **48 записей = 16 фаз × 3 вида** (technique / strength / stability). Каждая:
  target + errors[] + causes[] + level + protocol (sets/reps/pct/rir/tempo/rest/distanceM) +
  cues[] + progression + regression + source. Дозы в коридорах (sets 1–6, pct 50–90,
  rir 0–4, отдых 60–300). ✅
- **P2. Ранг под причину.** `correctivesForSMWeakPoint(phase, {cause, level, equipment,
  mobilityRestrictions})`: kind-матч под причину (volume→strength, technique→technique,
  mobility/fatigue→stability, strength/grip→strength) + уровень-близость; доза:
  volume 4×5 / strength 4×4+5% (кап 90) / mobility-fatigue −5% (флор 50). ✅
- **P3. Сессия + волна.** `correctiveSessionForSM` (техника→сила→стабильность, ≤6) +
  `correctiveBlockForSM` (8 нед, сеты 3-3-4-4-4-4-3-3, имена Втягивание…Старт). ✅
- **P4. Замер → тег → упражнение.** `smTagsForMetrics` (sway 3/5 McGill, VBT carry 15 /
  press 10, асимметрия 7/12 Bezkorovainyi, OHS ≥2) + `smCorrectiveExportLines`
  (фаза → топ-1 + cue + source) + `smCorrectiveBasePct` (инжектабельность для lock-тестов). ✅
- **P5. Таб «Коррекция» (7-й).** Фаза → причина → топ с дозой/кью/прогрессией/регрессом/
  ошибками/источником + сессия + волна + 💉 (аддитивный payload `smCorrections /
  correctiveSession / correctiveBlock`; ранжир/инъекция/экспорт не тронуты). ✅
- **P6. Нижний док навигации.** Верхняя плавающая лента удалена (дубли роняли соседние
  `getByText`-тесты — чинено переносом, а не правкой чужих тестов); навигация — единый
  `data-sm="bottom-nav"` (7 табов 44px + скор + применить, sticky bottom + safe-area +
  `var(--tabbar-clear)`). ✅
- **P7. Lock-тесты.** NEW `strength-sport-sm-corrective.test.ts` 9/9 (16×3=48, гигиена,
  инжектабельность 48/48, дозы, сессия, волна, теги, exportLines) + NEW
  `strongman-diagnostics-corrective.test.tsx` 4/4 (док/табы/пусто/карточки/мост
  `smCorrections`). ✅

## §4. Проверено

NEW 9/9 + UI 4/4 + соседи hub 9/9 + hub-pro3 6/6 + SM-движки pro2/pro3/diagnostics
93/93; `tsc --noEmit` **0 по всему проекту**; `verify:apk-design` OK.
По ходу поймано своим: опечатка `'sm_conditioning'` (tsc), дубль «Коррекция» в тесте
(клик через `data-sm`), задвоение подписей табов (лечится P6).

## §5. Осознанные границы (не делаем)

- Чисто-мобильные дрилы без силовой базы не вносим (доза −5% + OHS-гейт покрывают;
  прецедент TA-C6).
- `sm-correction-rank` не переписан (рабочий; библиотека — контент-слой поверх).
- Мост в конструктор — только аддитивные поля (сборку не меняем).

## §6. Добивка C2: экспорт + хинты замер→упражнение (тот же день)

- **Экспорт дожимает C1-поля** (`sm-export.engine`: `SMDiagnosticSnapshot +=
  corrections/correctiveDetail`, HTML — секция «Коррекция» + «Коррекция детально»,
  CSV — строки `corrections`/`correctiveDetail`; без полей — байт-совместимо) +
  `proSnapExtra` несёт оба поля в оба экспорта (HTML/CSV).
- **Хинт Видео** `data-sm="corr-video"`: sway/VBT/асимметрия/OHS warn/crit →
  `smTagsForMetrics` → топ-упражнение с дозой + «→ Открыть Коррекцию»
  (`setTab('correction')`).
- **Хинт Мобильность** `data-sm="corr-mobility"`: OHS fail ≥2 → щадящие дозы + переход.
- **Хинт Сплит** `data-sm="corr-split"`: асимметрия ≥7% → слабая сторона +1 сет
  (15–25%) + топ хвата + переход.
- Проверено: `sm-corrective` 9→**10/10** (экспорт-паритет) + UI 4→**7/7** + соседи
  hub 9/9 + hub-pro3 6/6 (итого **32/32**); `tsc` **0 по своим**
  (2 ошибки — чужой untracked `bb-quality-load-sections.tsx`, WIP 4.3, не тронут);
  `verify:apk-design` OK.

## §7. Добивка C3: ⭐ честно вставляет (паритет TA-C8/C9)

- **Найдено чтением инъекции 2 дефекта**: (1) `injectSMWeakPointsPreferred` был
  заглушкой — ⭐ помечался «выбери вручную», в план не вшивался; (2) legacy-извлечение
  вшивало фантомы (`'Yoke'`/`'tacky'`/`'Prowler'`/`'Suitcase'` — первое слово строки)
  вместо fallback-id. Фикс: `preferredCorr` + `protocols` в `SMInjectionOpts`
  (библиотечные id + доза карточки, имя из библиотеки; чужой id → legacy fallback);
  извлечение валидируется по KNOWN-сету fallback-id.
- **Мост как TA-C9**: хаб — ⭐ per-row в Коррекции (персист `he_sm_preferred_corr_v1`)
  + payload `smPreferredCorr/smWeakCauses/smCorrectiveDetail` (trim/дедуп/кап 9);
  приёмник — `buildSMSpecProtocols` (⭐ — доза карточки, чужой — топ-1 ранжира);
  wizard — `smPrefCorr/smWeakCauses/smCorrectiveDetail` в `taBridge`; конструктор —
  сборка вшивает ⭐ через `injectSMWeakPoints` + rationale «Коррекция СМ-хаба» +
  бейдж «📥 СМ-хаб · ⭐ N».
- **exId-честность**: NEW `SM_CORR_EXID` (16 фаз × 3 вида → реальные id каталога,
  сверены grep по `exercise-catalog.ts`; синтетические `sm_*` в план не вшиваются);
  `protocolForSMPreferred` (чужой id → null) + `libraryEntryForSM` + `exIdForSMCorrective`.
- Проверено: `sm-corrective` 10→**13/13** (матрица 16×6=96 + exId + preferred) +
  NEW `sm-injection-preferred` **6/6** (E2E seed→⭐→план, чужой→fallback, legacy-форма,
  обёртка не заглушка, дедуп/бюджет) + NEW `sm-corrective-bridge` **3/3** +
  NEW `sm-corrective-wizard` **1/1** + UI 7→**8/8** (⭐-тогл/персист/мост) +
  соседи (hub/pro3/intake/wizard/ta-spec-apply) + SM/TA-движки — итого
  **76/76 (10 файлов) + 108/108 (5 файлов)**; `tsc` **0 по своим**;
  `verify:apk-design` OK.
