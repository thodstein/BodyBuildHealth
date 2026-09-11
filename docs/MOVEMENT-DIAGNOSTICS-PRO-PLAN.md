# Диагностика движений PRO — план доработки

> Статус: ВЫПОЛНЕН ПОЛНОСТЬЮ кодом (P1–P8). Дата: 2026-09-11.
> Коммиты: P8 — e60e0d0de; P1–P7 — следующим коммитом (pathspec своих файлов).
> Основание: аудит подсистемы (движки + UI + мосты) + интернет-синтез 2024–2026.
> Связанный старый план: `docs/PL-MOVEMENT-DIAGNOSTICS-PLAN.md` (единый калькулятор, ручной ввод) — настоящий PRO-план его расширяет, не отменяет.

## §1. Аудит текущего состояния (факт по коду)

### 1.1 Покрытие лифтов / фаз / углов
- Канон типов — `src/engines/lms/weakpoint-pl.ts:28-38`: `Lift` = 12 (bench/squat/deadlift/ohp/row/pulldown/incline_press/sumo + biceps/triceps/calf/shrug); `WeakPoint` ~30; `WEAK_POINTS_BY_LIFT` + `DIAGNOSIS` (intensityPct 0.6–0.75, assistanceFromCatalog).
- Углы — `src/engines/pro/lift-diagnostics.engine.ts:24-73` (`STICKING_POINTS`): bench/squat/deadlift/sumo + ohp/row/pulldown/incline_press + biceps. **Нет углов для triceps/calf/shrug** — `diagnoseLift` возвращает `null`, коррекции пустые (тест `lift-diagnostics` покрывает только 7 лифтов).
- Канон фазы по повторам — `phaseForReps` (≤2 = max-moment, 3–5 = mid, ≥6 = null).
- ТА/стронг отдельно зрелые: `strength-sport-barpath` (Vorobyev type1/2/3, xLoop/yMax/vMax, Butterworth 12 Гц, Enode-поправка, SRD 4/6), `strength-sport-vbt` (LVP, FvR2, EWMA, per-lift история).

### 1.2 Метрики
- **Bar-path ПЛ**: 5 issues (`forward_drift/hips_shoot_up/good_morning/bar_loops/asymmetric`) + связка с weakPoint и ассистентами; `diagnoseMovement` — три ракурса по одному якорю.
- **Bar-path ББ**: только xLoop→ok/warn/crit + тип траектории строкой; вход — готовый разбор, парсинга видео нет. Порог SRD 4/6 скопирован, общей функции с SS-барпатом нет.
- **VBT ПЛ** (`pro/vbt.engine`): LVP 5 лифтов, `VL_THRESHOLDS 10/20/25/40`, MVT, `calibrateLVP`, `diagnoseVelocity` с фолбэк-маппингом (pulldown→row, incline→bench, sumo→deadlift и т.д.).
- **e1RM-тренд**: два окна 28+28 дней (drop 5% → weak, стагнация ≤1% при ≥2 сессиях → plateau); `StickingPointAnalysisCard` — срывы по дневнику (RPE≥8 или reps≤2, мода фазы).
- **Асимметрия**: только как универсальный `BarPathIssue asymmetric` без L/R-вводов, % и MRV-клампа слабой стороны (в отличие от BB/Arm-веток).
- **Агрегатор**: `unified-lift-diagnosis` — 5 слоёв + `technique_geometry`; `LiftMasterCard` — канон 8 слоёв, 9 лифтов.

### 1.3 Связь с планировщиком
- `injectPLWeakPoints` (heavy 3×8@pct + light 3×12@60%, MAX 2, **без MRV-капа** — «always add») vs `injectDiagnosticExercises` (протокол из раскладки цикла, per-day dedup, day-cap 10, **с MRV-бюджетом** + skip с note). Паритет покрыт `diagnostic-protocol-parity.test`.
- Ручной конструктор (`planner-bridge-handlers appendDiagnosticsToPL`): только `customWeeks`, диагностика — **фикс 3×10@60% RIR2** (расхождение с цикл-протоколом билдера).
- Живут два мастера: `PlDeadpointsBarPathCard` (deprecated-шапка, 1000+ строк) + `LiftMasterCard` + `DiagnosticsHub` — один движок, но UX-дубль и два пути `diagnosticExerciseMap`.

### 1.4 Зафиксированные дефекты (в план, не в код)
1. Пустые углы triceps/calf/shrug при наличии в Lift/WEAK_POINTS/LIFT_PHASES.
2. Дубль сумо (sumo_start/lockout и в deadlift, и в sumo; `sumo_mid` только в sumo).
3. Расхождение фаз: `phaseForReps` даёт `*_start`, а `VELOCITY_STICKING_PHASE` — `*_mid` для тех же мышц.
4. Грубый VBT-фолбэк всего ПЛ сверх 5 LVP по соседнему профилю.
5. Устаревший комментарий «без углов ohp/row/pulldown/incline» (углы уже есть).
6. `unifiedLiftDiagnosis template` — void-параметр без эффекта.
7. ББ bar-path изолирован (дубль SRD без общей функции).
8. Мост ручного конструктора — фиксированный протокол вместо цикл-протокола.

## §2. Интернет-синтез 2024–2026

- **Sticking point — биомеханика (Kompf 2022 / Larsen 2021 / Sports 2024 обзор):** у жима — преднатяг груди/плеч и «отбив» дают ложный старт; у приседа — колени вперёд + наклон корпуса смещают момент на тазобедренный; у тяги — отрыв спиной вместо ног. Вывод для нас: фаза срыва должна маппиться не только на угол, но и на **паттерн ошибки** (уже есть 5 bar-path issues — покрыть связку issue↔фаза таблицей, сейчас частичная).
- **VBT velocity-loss пороги (Pareja-Blanco 2017–2024, Weakley 2021, JSCR 2024–2025):** 10% — скорость/мощность, 20% — сила, 25–30% — гипертрофия, 40% — отказная зона. Наши `VL_THRESHOLDS 10/20/25/40` — **в точку**, менять не надо; не хватает только **привязки порога к цели** (сила vs масса) в рекомендации.
- **MVT / LVP (García-Ramos 2023, Banyard 2024, JSCR 2024):** MVT жим ~0.15–0.20 м/с, присед ~0.25–0.30, тяга ~0.20–0.25; двухточечный профиль достаточен для e1RM ±5%. Наш MVT-блок в каноне; пробел — **нет MVT для triceps/calf/shrug и нет проверки «профиль stale»** (профиль старше 6 недель врёт).
- **Асимметрия (Bishop 2021–2024, Parkinson 2021, JOSPT Open 2025/2026):** порог 10–15% для силы, >15% — высокий риск; формула обязана быть без референс-лимба (max-min)/max. У нас асимметрии как метрики **нет вообще** — самый крупный пробел.
- **IPF Technical Rules 2025–2026 / USAPL 2025:** глубина приседа (hip ниже knee), пауза жима, «вниз — нет» в тяге/жиме. У нас **нет чек-листа «зачёт/незачёт»** — диагностика говорит «слабо», но не говорит «снимут».
- **Видео-анализ (Kinovea валидация 2018–2025, OpenBarbell сравнение, MobilePoser 2024):** Kinovea валиден для углов/дистанций (±5–9% при 90°, 5 м), но **занижает скорость/ROM штанги** против LPT (ручная оцифровка + ROM по всей траектории, а не хорде). Вывод: наш Kinovea-CSV импорт честен для углов, но скорости из видео надо помечать «оценка, не LPT» + требовать 90°/штатив/240fps.
- **Травматизм (Tung 2024, Aasa):** 1.0–4.4 травм/1000 ч; топ-зоны — поясница/плечо/локоть. Диагностика обязана иметь **red-flag гейт** (острая боль/отёк/онемение → стоп), сейчас его нет в ПЛ-ветке (в BB/Arm есть).

## §3. План — 7 эпиков

### P1. Углы triceps/calf/shrug + чистка сумо (движок, без UI)
- Добавить `STICKING_POINTS` для трёх мышц (углы локтя/голени/трапеции по прецеденту biceps), `diagnoseLift` перестаёт возвращать null.
- Сумо: оставить `sumo_mid` только в `sumo`, в `deadlift` — ссылку (без дубля диагноза); `mainNameMap` билдера унифицировать (`Жим лёжа` единый).
- Синхронизировать `phaseForReps` ↔ `VELOCITY_STICKING_PHASE` (один канон `*_start` для этих мышц).
- Тесты: `lift-diagnostics` 7→10 лифтов.

### P2. Асимметрия L/R как метрика (движок + UI + мост)
- NEW `pl-asymmetry.engine`: ввод L/R (вес×повторы или e1RM) → `% = (max-min)/max`, вердикт 10%/15% (Bishop/Parkinson), слабая сторона.
- UI: чипы L/R в `LiftMasterCard` + строка «Слабее: левая → унилатеральная добивка».
- Мост: слабая сторона получает +1 унилатеральный слот в `injectDiagnosticExercises` в пределах MRV (прецедент arm-bilateral +15%/+25%).
- Тесты: движок 5–6 + UI 1–2.

### P3. VBT: цель-aware пороги + stale-профиль + честная пометка видео
- `vbtRecommendation`: порог по цели (сила 20 / скорость 10 / масса 25–30), сейчас плоский.
- `calibrateLVP`: флаг `stale` при профиле старше 6 недель + напоминание «перекалибровать».
- Kinovea-импорт: скорости помечать «оценка (видео, не LPT)», в UI — требование 90°/штатив.
- MVT для P1-мышц (дефолт из литературы с пометкой «ориентир»).
- Тесты: 3–4.

### P4. Зачёт/незачёт IPF + red-flag гейт (безопасность)
- NEW `pl-competition-rules.engine`: чек-лист по лифту (глубина/пауза/локаут/стопы) → «снимут / под вопросом / чисто» (только IPF/USAPL факты, без выдуманных норм).
- NEW `pl-red-flags`: острая боль/отёк/онемение/щелчок с болью → стоп-блок вставки диагностики + «к врачу, не диагноз».
- UI: карточки в `LiftMasterCard` + мост (стоп честно блокирует `appendDiagnosticsToPL`).
- Тесты: 4–5.

### P5. Дедуп мастеров + паритет мостов
- `PlDeadpointsBarPathCard` → тонкая обёртка над `LiftMasterCard` (или удалить после сверки потребителей); один путь `diagnosticExerciseMap`.
- `appendDiagnosticsToPL`: заменить фикс 3×10@60% на цикл-протокол (`diagnosticProtocolFromCycle`, паритет с билдером).
- `injectPLWeakPoints`: добавить MRV-бюджет (паритет с `injectDiagnosticExercises`) или задокументировать «always add» как осознанное.
- Удалить void-`template`, обновить устаревший комментарий.
- Тесты: parity +1–2, существующие без правок.

### P6. Общий bar-path движок (BB + PL + SS)
- Вынести SRD 4/6 + классификацию в `bar-path-core.engine` (чистая функция xLoop/yMax → ok/warn/crit + тип); BB/PL/SS тонко делегируют.
- Тесты: 3 (по одному на ветку, инвариант порогов).

### P7. Экспорт + тренд (паритет с Arm/BB)
- HTML/CSV экспорт диагностики движений (фаза/угол/issue/VBT/асимметрия/зачёт) с XSS-эскейпом.
- e1RM-тренд уже есть — добавить sparkline-строку и «Δ было/стало» после применения коррекций (сценарии, прецедент arm-hub).
- Тесты: 2–3.

## §3.1. P8. АПК-адаптация кнопок импорта/выдачи + видео в АПК (полное выполнение, без заглушек)

### Аудит факта (2026-09-11)
- В `LiftMasterCard` / `PlDeadpointsBarPathCard` / `DiagnosticsHub` **нет ни одной кнопки импорта/экспорта**: только `applyToPlanner`. Kinovea-CSV есть только в WL/BB/Strongman-хабах, в ПЛ-диагностике движений — нет.
- `VideoCaptureCard`: `getUserMedia` (камера по клику) + `<input type=file accept=video/* capture=environment>` + «Демо-разбор» (мок) + pose-engine через CDN WASM (`@mediapipe/tasks-vision`, модель `pose_landmarker_lite` с Google Storage) + воркер. В АПК это ломается тремя способами: (а) `getUserMedia` без HTTPS/пермишена падает; (б) CDN WASM офлайн недоступен; (в) кнопки 7px/10px, ниже тач-нормы 44px.
- Слой выдачи уже есть и работает: `src/core/apk-share.ts` (`copyOrShareText` / `saveTextFileApk` / `saveCsvApk` / `printHtmlApk` через Capacitor Filesystem+Share, на web — классика) + `src/core/native-bridge.ts` (`shareText`, `saveTextFile`, `pickPhoto`). Видео через `Camera` нельзя (только фото) — для видео канон АПК = системный видеопикер через `<input capture=environment>` (в WebView открывает камеру/галерею нативно).
- Чекер `verify:apk-design`: селекторы только `html.app-native`, без hex-литералов, секции на месте.

### Что делаем (всё реально, мок только как честный офлайн-фолбэк)
1. **NEW `movement-diagnostics-export.engine`**: `buildMovementDiagnosticsHtml` / `buildMovementDiagnosticsCsv` / `movementDiagnosticsFilename` — чистые функции с XSS-эскейпом (вход: лифт/фаза/issues/VBT/видео-пометка/дата). Без доступа к сторам — только рендер.
2. **`VideoCaptureCard` (АПК-рабочее)**: детект `isNativeApp()`; в APK первичный путь — «🎥 Снять видео» (системный видеопикер, тот же input, но явная кнопка 48px + хинт «откроется камера/галерея»); `getUserMedia` остаётся фолбэком с честной ошибкой; WASM-провал → честная пометка «офлайн — оценка, не замер» (мок НЕ выдаётся за замер); кнопки 44px+, `data-vc` хуки, `aria-label`, белый текст; «📋 Копировать разбор» (`copyOrShareText`) + «💾 Отчёт» (`saveTextFileApk` JSON) — реальные, через apk-share.
3. **`LiftMasterCard` — блок «Импорт/выдача»**: Kinovea-CSV импорт (файл + вставка текста → `parseKinoveaCSV` + `analyzeBarTracking` → xLoop-бейдж SRD 4/6 + пометка «углы — да, скорость — оценка»); кнопки «🖨 HTML» / «📊 CSV» / «📤 Поделиться» через `printHtmlApk`/`saveCsvApk`/`copyOrShareText` с тостом исхода (`shareOutcomeLabel`); все 44px+, `data-lift` хуки.
4. **CSS**: append-секция в `styles-native.css` только под `html.app-native` (кнопки/инпуты/бейджи, press/focus/tabular, 380px, reduced-motion; без hex).
5. **Тесты**: NEW `movement-diagnostics-apk.test` (экспорт HTML/XSS/CSV/имя файла + Kinovea→xLoop инвариант) + UI-ассерты хуков; `video-capture-card` добит.

## §4. Выполнение (факт)

- P1: углы triceps/calf/shrug + сумо-дедуп общими константами + синк VELOCITY_STICKING_PHASE на *_start; тесты lift-diagnostics 18/18.
- P2: NEW pl-asymmetry.engine (% без референс-лимба, пороги 10/15) + L/R-вводы и вердикт в мастере + weakSide в injectDiagnosticExercises/appendDiagnosticsToPL (+1 унилатеральному в пределах MRV).
- P3: thresholdForGoal/mvtForPLLift (7 ориентиров с флагом)/diagnoseVelocityForGoal/lvrStale + цель-чипы и stale-бейдж в VBT-секции + vbtUpdatedAt-персист.
- P4: NEW pl-competition-rules (IPF/USAPL чек-листы) + NEW pl-red-flags (стоп-гейт вставки в мастере и в мосте, «к врачу»).
- P5: PlDeadpoints осознанно оставлен легаси-виджетом (25 тестов + 2 живых потребителя); паритет через diagnosticProtocolMap (карточки считают из раскладки, мост вставляет показанное с валидацией); always-add injectPLWeakPoints задокументирован (докстринг врал про MRV-cap — исправлен); void template удалён; stale-комменты обновлены.
- P6: NEW bar-path-core (канон SRD 4/6 инклюзивный); BB — делегат побайтово; SS — делегат петлёй (тексты доменные; грань 4.0 → warn, тестами не зажата); PL-экспорт и бейдж мастера — через ядро.
- P7: snapshotWeakE1rm/diffWeakE1rm + «Было → стало» в мастере (снапшот при применении); экспорт — из P8.
- P8: см. §3.1 (коммит e60e0d0de).

## §5. Осознанно НЕ делаем
- Он-девайс pose-estimation / авто-треккинг штанги по видео (точность телефона без LPT недостаточна — только честная «оценка»).
- Свои MVT-нормы для женщин/подростков (данных нет — только литературные дефолты с пометкой).
- Диагнозы травм по симптомам (только red-flag скрининг + «к врачу»).
- Переписывание ТА/стронг barpath/VBT (там зрело — только переиспользуем P6-ядро).
- Силовая периодизация из диагностики (диагностика правит аксессуары, не базовый цикл).
