# Хаб «Калькуляторы» вкладки Фарма — аудит + интернет-синтез + PRO-план

Дата: 12.09.2026. Статус: P1–P7 ВЫПОЛНЕНЫ кодом полностью (без заглушек).

Проверено: NEW `pharma-calc-hub-pro` 16/16 + соседи `pharma-fixes-verification` 34/34 + `pharma-catalog-audit` 62/62 + `rest-hooks-native` 68/68 (canvas/DB-шум предсуществующий); `tsc` 0 по своим файлам (6 ошибок — чужой Support-WIP, не тронут); `verify:apk-design` OK.

## Добивки (без пуша)

- **D1–D5 (`cee8bd74`)**: per-drug канон-бейджи `t½ · conf/5` + Bateman-пик первого препарата; мост «→ В курс» (CourseEntry-JSON в clipboard + `he_pharma_course_pending`, прямая запись в IndexedDB-курс осознанно не сделана — чужая зона `data-link`); пептид-сетка `weeklySchedule` + GHRH-синергия; селектор протокола Nolva/Clom+Nolva/Scally-lite + честные недели из `course_log`; история `he_pharma_calc_v1` топ-5. Тесты 19/19; `tsc` 0 по всему проекту.
- **E-раунд (`207f464e`)**: `downloadCsv`/`clearCalcHistory` + CSV во всех 5 табах + «Вся история CSV» + счётчик маркеров в матрице + NEW `pharma-calc-hub` UI-guard 7/7. Проверено 133/133; `tsc` 0; apk-verify OK.
- **F-раунд (`2bdff781`)**: Bateman-оверлей на графике (нормировано к Cmax, дефолт выкл; пойман свой scope-баг `batemanPathD` своим же UI-тестом); `PairResult.source` + CSV-колонка; экспорт истории. Тесты hub 8/8 + pro 20/20; `tsc` 0; apk-verify OK.
- **G-раунд (этот коммит)**: BioAge-бейдж «эвристика» + список маркеров честного возраста; честная единица дозы из БД (`МЕ/день`, `мкг/день`, `мг/день` вместо всегда `мг/нед`) + bridge несёт реальный `doseUnit`.
- **H-раунд**: живой мост в курс (`db.put course_log` + `notifyDataChange`, прецедент `CatalogTab`); частоты пептидов + кнопка; удаление истории по одной (поймана коллизия id в одну мс); log-шкала графика.
- **I-раунд (этот коммит)**: канон-оверрайд t½ в `advanced-diagnostics` (опциональный 5-й параметр, legacy и Python-зеркало untouched) + тоггл в диагностике (дефолт ВКЛ) + канон в подписях эфиров; фильтр истории по табам; аудит `InteractionCheckerTab` (только чтение — чужой файл, найдены 2 реальных дефекта, см. ниже).

## J-раунд: 2 дефекта InteractionCheckerTab закрыты кодом (разрешение владельца, pathspec)

- `masteron/masteron_enan → drostanolone_prop/drostanolone_enan` (id сверены с `pharma-db/`); `raloxifene` оставлен — вещества нет в каталоге genuinely.
- Дозы: `courseDoseById` (факт из `course_log` через `weeklyDose` + мг-конверсия, паритет `MapperTab`; IU как есть) приоритетнее ручного поля; ручное — фолбэк. Все 4 точки (`alerts`/`courseRecs`/`classInstructions`/`unifiedView`) + guard-тест (id живы/мёртвы + «из курса» в UI).

## J-раунд (этот коммит): честные источники + оралки

- Матрица: BPC+TB-500 переведён из `synergy` в честное «Аддитивно, не синергия: только доклиника, human RCT нет» (`safe` + Grade C-источник) — по свежему синтезу (PeptideStacks Grade C, Cureus 2025, peptides.fyi, dosagepeptide: факториальных исследований нет); GHRH+GHRP остался `synergy` с источником JCEM 2006 + Teichman 2006 + Raun 1998 и оговоркой про точную пару (peptidesdefined); трен — Piatkowski 2024 (n=282) + Zelleroth; 19-nor — PMC4462037; GLP-1/двойной GHRH — подписаны как механистический консенсус, не исследования.
- Оралки: `ORAL_CANON` (9 соединений, OptiPin) + `oralHalfLifeFor` → `halfLifeOf` в ПКТ (oxan старт 1д — в каноне 1–3) + per-name оверрайд в 5-engine и DiagnosticsTab (метан 0.22 vs анадрол 0.33 различаются).

## Аудит InteractionCheckerTab (I2, только чтение — файл чужой, не тронут)

1. `synergyToPharmaId` маппит в несуществующие id: `drostanolone_propionate → masteron`, `drostanolone_enanthate → masteron_enan`, `raloxifene` — таких id в `PHARMA_DB` нет (реальные: `drostanolone_prop`/`drostanolone_enan`, ралоксифена нет вовсе). Гард `pharmaIds.has` молча дропает эти синергии — мастерон без синергий в UI. Фикс 2-строчный — за владельцем таба.
2. Доза захардкожена 300 мг/нед для всех (`alerts`/`courseRecs`/`classInstructions`/`unifiedView`): оралам/пептидам/SERM в IU/мкг сила алертов считается от неверной базы. Фикс — тянуть дозу/единицу из курса или из `dosageRange` — за владельцем таба.

## 1. Что есть сейчас (5 калькуляторов, `PharmaScreen_parts/index.tsx:232-241`)

| # | Таб | Файл | Движки | Что делает |
|---|-----|------|--------|------------|
| 1 | PK/PD | `PKPDSimulationTab.tsx` | `pk-pd.engine` (1-компартмент steadyStatePeak/Trough) + `pkpd-superposition.engine` (3-компартмент RK4, dt из `PKPD_DEFAULTS`) | Мульти-вещество: дозы + дни инъекций → Cmax/Cmin/стационар + SVG-график (сумма + пунктир per-drug + эффект) |
| 2 | Дозировки | `DosageCalculatorTab.tsx` (+ `AndrogenicIndexCalculator` внутри) | `dosage.engine:calculateDose` | Объём мл / деления / доз-на-флакон + андрогенный индекс `Σ(доза/порог × андрогенность)` |
| 3 | Пептиды | `PharmaPeptideCalc.tsx` | `peptide-calculator.engine` (dilution/bio/PK/risks/synergy/protocol, 602 строки, `PEPTIDE_DB`) | Разведение + шприц U100/U40 + биодоступность по пути + PK-таблица + риски + синергии/конфликты + генератор протокола по цели |
| 4 | Маппер | `MapperTab.tsx` | `drug-mapper.engine` (граф препарат→патологии, кумулятивный Σ) + lazy `clinical-analyzer` | Стек (из курса/вручную) → активные патологии с Σ-баром + требуемые биомаркеры (зелёный = есть в анализах) + клин. патологии |
| 5 | Диагностика | `DiagnosticsTab.tsx` | `advanced-diagnostics.engine` (5 модулей, 440 строк, зеркало `mdss-api/advanced_diagnostics.py`) | PK-качели (Δ>40%) + конфликты + виталы (HRV/RHR/АД) + BioAge + ПКТ-таймер/HPTA-вероятность |

Плюс рядом (не в хабе, но связаны): `CatalogTab` (каталог), `InteractionCheckerTab`, `PKPDSimulationTab`-поиск, `PharmaCourseScreen`, `PharmaReportsTab`.

## 2. Аудит: сильные стороны и честные гэпы

**Сильно:** всё офлайн в браузере; связка с курсом (`useDataLink`) везде; superposition с байесом; пептидный движок полный (разведение/био/PK/риски/синергии); маппер с кумулятивным Σ (не суммой); 5-engine диагностика — уникальная фича (ни у кого нет PK+BioAge+ПКТ в одном).

**Гэпы (проверено чтением кода):**

1. **PK: две модели без сшивки.** Таб считает `steadyStatePeak` (1-компартмент) для шапки Cmax/Cmin И `calculateMultiSubstancePKPD` (3-компартмент RK4) для графика — числа могут расходиться. Нет Bateman `C(t)=dose·ka/(ka−ke)·(e^−ke·t − e^−ka·t)` + Tmax, как у SteroidPlotter/InjectBuddy/OptiPin.
2. **Half-life таблица устарела и бестирная.** `ESTER_HALF_LIFE_DAYS`: enan 4.5 / cyp 5.0 / decanoate 7.5. Опубликованные PK (OptiPin, 66 соединений): enan 7.2 / cyp 6.9 / deca 10.2 дн; undecanoate 21.0 у нас vs 34 (castor) / 20 (MCT) в источниках. Нет тиров уверенности 1–5 (StacksnStats), `FALLBACK_PK` молча подменяет отсутствующие данные.
3. **Нет стандарта «плоской кривой».** InjectBuddy держит цель peak:trough ≤1.5 + подсказку частоты; у нас только флаг качелей Δ>40% в диагностике, в PK-табе рекомендаций частоты нет. Нет блоков washout 5×t½ / steady-state 4.3×t½ / окон детекции.
4. **Дозировки — только арифметика объёма.** Нет сверки с `dosageRange` из PHARMA_DB, нет подбора шприца под объём (30/50/100), нет U-40 гарда (×2.5 ошибка), нет ротации зон/dead-space.
5. **Андрогенный индекс — линейная сумма.** `Σ(доза/порог × AR)` переоценивает стеки из 3+ (та же ошибка, что сумма вместо RSS в рисках). Наука уже ушла: Stack_BYR v1.2 (Zenodo 19684131): `SFY = FY1·1.0 + FY2·0.4 + FY3·0.2 + FYk·0.1 (k≥4), cap 5.0` + `K_d 1.00–1.50` (трен K_N=1.40) + `SBB = Σ(w·ΣBB·K_d)`, итог `Stack_BYR = SBB/SFY` 0.96–2.68 на 10 стеках. QSAR AAR (19-nor, SciDirect) — тоже не индекс суммы.
6. **Пептиды — паритет с интернетом по базе, но нет 3 фич:** реверс-режима (доза+объём → вода, как glp1.app), рекомендации шприца по размеру дров (Jordan 2021: ошибка растёт на малой доле объёма; Gnanalingham 1998), стабильности (`fridgeLifeDays/rtLifeHours` в типе есть — в UI не показываются). Нет недельной сетки стека + пульсатильности (GHRH+GHRP синергия vs два GHRH — avoid).
7. **Маппер — только вред, нет пользы/матрицы.** StacksnStats Interaction Checker: 4 уровня (Synergy/Safe/Monitor/Caution) + pairwise-матрица + источник на каждую пару. Пептидный чекер: Clear/Caution/Warning/Avoid. У нас: список патологий + Σ, без synergies, без матрицы пар, `unknownDrugs` — тупик («проверь написание»).
8. **Диагностика: ПКТ упрощён.** Старт = по самому долгому эфиру, без поправки накопления steady-state (StacksnStats PCT Timing: 6 протоколов incl. Scally PoWeR + поправка длительности цикла), без SERM-доз. `detectEster` по сабстрингу (`sust→4.5` — игнор 4 эфиров Sustanon; oral-гейт по именам). BioAge — эвристика (АД/HRV/токс-штрафы), не phenotypic-age маркеры. Нет связки washout → дата анализов крови.
9. **Мосты односторонние.** Курс → калькуляторы есть везде; обратно (результат → курс/отчёт/напоминание) нет. Нет экспорта/печати/ICS ни в одном из 5 табов.

## 3. Интернет-синтез (что взять за канон)

- **PK-модель:** Bateman с Tmax (SteroidPlotter 2025: T½ начинается после Tmax; InjectBuddy: `C(t)` + ka из Tmax бисекцией; OptiPin: общий Bateman + персональные модели тестостерона). Брать: Bateman как канон графика, 1-компартмент оставить для Cmax/Cmin-шапки с пометкой «оценка».
- **Числа:** OptiPin-таблица 66 соединений (t½ + time-to-steady 4.3×t½ + cleared 5×t½ + evidence Strong/Moderate/Limited/Estimated). Брать: обновить `ESTER_HALF_LIFE_DAYS` + ввести `confidence` на каждое вещество; enan 7.2 / cyp 6.9 / deca 10.2 как Strong.
- **Стабильность:** InjectBuddy peak:trough ≤1.5 + suggested frequency; SubQ vs IM (SubQ площе). Брать: ratio-бейдж + «коли для ≤1.5» во все PK-выдачи.
- **Washout/ПКТ:** StacksnStats Washout (5×t½ до <3% + поправка steady-state + log-график до 4 соединений) + PCT Timing (последняя инъекция + длительность + 6 протоколов; sweet spot 3–4×t½, 90–97% клиренса; postcycletherapy.com формула `last + 3.5×t½`: prop 3–5д / enan 14–18д / cyp 18–21д / deca 21–30д / оралы 1–3д). Брать: поправку накопления + 3 протокола минимум (Nolva-стандарт / Clomid+Nolva / Scally-lite) + дата старта календарём.
- **Пептиды:** dosagepeptide/healius/precision/peptidescouter/peptidedosages/getpeptidepilot/nugenialogics — одна формула (`conc = mg·1000/мл; vol = dose/conc; units = vol·100`), U-100 100u=1мл, шприцы 30/50/100 с шагом меток (0.5/1/2u), правило «<5u — добавь воды», «>100u — сплит». glp1.app — реверс (доза+объём → вода). Брать всё как есть — это готовые инварианты для тестов.
- **Взаимодействия:** StacksnStats (Synergy/Safe/Monitor/Caution + матрица + источник) + пептидный pairwise (Clear/Caution/Warning/Avoid + симметрия A+B=B+A, худший сигнал — общий). Dundee 2023 (HLM: метандиенон ×3 замедление CH-PIATA, нандролон/тест ×2; кокаин/MDMA/кветиапин — без эффекта) — честный пример CYP-конкуренции для механизма. Брать: 4-уровневую шкалу + матрицу пар.
- **Стеки:** AEBM Stack Extension v1.2 (SFY с затуханием + K_d + cap 5.0 + Stack_BYR + `gamma_stack ≈ Stack_BYR·0.03/мес` к FOA). Брать: SFY-веса + K_d тренболона как первый усилитель; полный перенос — после калибровки, не в этом плане.
- **Дисклеймеры:** все источники — «relative levels, not lab readings; confirm with bloodwork + clinician». Брать формулировку в каждую выдачу.

## 4. PRO-план (эпики P1–P7, только свои файлы хаба + движков)

- **P1 — Честный PK (канон Bateman + тиры + ratio).** NEW `pk-bateman` (`batemanC(ka,ke)`, ka из Tmax бисекцией — паритет InjectBuddy) рядом с существующими; график PK-таба — Bateman-кривая с маркерами инъекций + log-переключатель washout; шапка Cmax/Cmin остаётся 1-компартмент с пометкой «оценка». `ESTER_HALF_LIFE_DAYS` → сверка с OptiPin (enan 7.2/cyp 6.9/deca 10.2 Strong; sust — 4 эфира раздельно, не 4.5); NEW `pkConfidence` 1–5 в PHARMA_DB-записях с бейджем; `FALLBACK_PK` — с явным флагом «оценка, не измерено». Ratio-бейдж peak:trough + «частота для ≤1.5». Тесты: Bateman vs steadyState сходимость; ratio-инварианты; confidence-бейдж.
- **P2 — Дозировки с безопасностью.** Сверка дозы с `dosageRange` (warn при выходе); подбор шприца 30/50/100 по объёму (правило Jordan: минимальный вмещающий); U-40 гард (×2.5 предупреждение); гарды `<5u` («добавь воды») и `>100u` («сплит»); ротация зон + dead-space памятка (без новых доз — только harm-reduction). Тесты на каждый гард (мутационные).
- **P3 — Индекс стека вместо суммы.** Андрогенный блок: линейный Σ оставить как «сырой», рядом NEW `stackBurdenLite` (SFY-веса 1.0/0.4/0.2/0.1 cap 5.0 + K_N трена 1.40 + шкала-дескриптор) с честной подписью «эвристика по AEBM v1.2, требует калибровки». QSAR-нота про AAR (не путать с суммой). Тесты: 1 < 1+2 < 1+2+3 с затуханием; трен-доминанта.
- **P4 — Пептиды PRO.** Реверс-режим (целевая доза + желаемые units → вода, паритет glp1.app); рекомендация шприца (30 при <15u, 50 при <50u, иначе 100); стабильность (`fridgeLifeDays/rtLifeHours` в карточку + warn); недельная сетка стека (дни по частоте + пульсатильность GHRH+GHRP); таблица доз-справочник (BPC 5мг+2мл→250мкг=10u и т.д. — паритет precision-таблице). Тесты: формулы из §3 дословно + реверс roundtrip.
- **P5 — Маппер-матрица.** Pairwise-матрица всех пар стека (4 уровня Synergy/Safe/Monitor/Caution + механизм + «что сдать» + источник-заглушка «граф знаний v1»), худший сигнал — в шапку; synergy-блок (GHRH+GHRP и аналоги); `unknownDrugs` → саджест ближайших имён (расстояние Левенштейна, без новых зависимостей). Клиника untouched. Тесты: симметрия A+B, худший-сигнал, саджест.
- **P6 — Диагностика: честный ПКТ + сшивка с анализами.** `detectEster` → резолвер через PHARMA_DB/алиасы (sust — max из 4 эфиров, не 4.5); поправка накопления (длительность цикла → старт, паритет StacksnStats); 3 SERM-протокола с датой старта (календарь-строка, без назначения — «согласуй с врачом»); washout → «кровь сдать после даты X» (связка с Labs); BioAge — пометка «эвристика, не phenotypic age» + список маркеров для честного возраста. Тесты: enan 14–18 / cyp 18–21 / deca 21–30 окна; sust = max эфира; накопление удлиняет старт.
- **P7 — Мосты и выдача.** Кнопка «→ В курс» из PK/пептидов (доза+частота в `CourseEntry` через существующий bridge); «→ В отчёт» (PharmaReportsTab принимает payload); экспорт сводки калькулятора (HTML-печать + CSV с XSS-escape и `'`-защитой от формул — прецедент дневников); персист последних расчётов (`he_pharma_calc_v1`, кап 10) + история. Тесты: roundtrip курс→калькулятор→курс; экспорт без меты байт-в-байт.

**Не делаем (осознанно):** ng/dL-конверсия (нужны Vd/клиренс на каждое вещество — данных нет, честно relative units); назначение SERM-доз; CYP-количественная модель (только Dundee-нота); полный Stack_BYR с гаммой (только lite-эвристика); детекшн-окна для допинг-контроля (вне harm-reduction скоупа).

## 5. Приёмка

- Свои тесты P1–P7 зелёные + соседи (`rest-hooks-native` pharma-корни, `pharma-course/support`) без регрессий; `tsc --noEmit` 0 по своим; `verify:apk-design` OK.
- Коммиты pathspec только своих файлов; чужие WIP не трогать; НЕ ПУШИТЬ без команды.
