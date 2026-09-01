# Strongman + ТА — PRO план (выполнен PRO v2.1 — 382→400+ хвосты закрыты)

## Статус: PRO v2.1 — 382→ ~410 (19 файлов), 35 ивентов, 5-фаз, Winwood taper 7/5/4, contest packet, VBT carry 1.30, multi-peak

### P0 — критические баги (выполнено)
- `basePmFor` pull→snatch занижение 2× → проверка `snatch_pull` до `snatch`
- `bench_bar` дубль → `db_press`
- `require()` → `import` (Vite ESM)
- Double count `weeklyBudget` vs `sets`
- `sessionLimitsFor` скобки `enhanced 38 vs 55`
- `phaseForDate` deload → peaking
- `annual taper` мутация → клон
- `patternId` типизирован, `yoke/log/stone` отдельные max, `Sinclair 2024 + Robi`, `aggressive 102%`

### P1 — parity BB
- Бюджет `ped×lab×nut×recovery` + deload 50% + per-lift MRV enforce (snatch/clean/squat/pull/press/carry)
- Prilepin PRO: primary WL `pri` (не фикс `1-3`), `WL <70 [3,6]`, `WL peaking 0.88` (strong 0.92)
- ANGLE 11 тегов, beginner только `power/muscle`, mobility 7 зон, VBT `snatch 0.85 / clean 0.60` LVP, DUP `beginner` no, warmup `1кг` + `carry 1 rep`

### P2 — домен
- VBT LVP per-lift, `brzycki` cap 3 для oly, `plateau` +1 сет, `mesocycle %` (snatch 2% / squat 2.5%), `weight-cut female 30 vs 35 мл/кг`, `PED_T_EQ`
- Weakpoint 16 (`snatch_off_floor ... press_start`) + `WL_WEAKPOINT_CORRECTION`
- Strongman attempts `yoke 10 / log 2.5`, Sinclair 2024, ICS, rolling `3/1`

### PRO UI
- WorkMax `yoke/farmers/stone/log`, `weakPoints` chips (2), `RPE {10-RIR}`, VBT per-set `м/с → e1RM`, попытки ТА/стронг, heatmap `intensityZone + tonnage` + `VBT zone`, `CSV/XLS/ICS`, annual bridge `MANUAL` в `he_annual_training_plan_v1` (85% натив), PED адаптация MRV `×1.0-1.7` **без рисков** (требование)

### PRO диагностика
- `bar-path 5` (`forward/backward/loop/early_pull/soft_lockout`) + `asymmetry` (10% порог)
- `WL/Strong` раздельная периодизация (`PCT_BY_PHASE_WL` vs `PCT_BY_PHASE`)

### Тесты
- `364/364` (15 файлов) — `strongman-pro 27`, `phase6-pro 30`, `matrix 192`, `property 9`, `dup-wave 8`, `annual 6`, `storage 3`, `print 5`, `p4/p0/p3/loading...`
- `strongman-pro`: EVENT_META 6, fallback 0.73, carry/deload 50%, medley chain 90с/180с, female 0.90, phaseForDate mode, grip prehab inject, ladder/medley, EWMA, property weeklySets≤budget + distance + full-combo (outside high + ACWR dangerous + VBT 30%)
- `property`: 192 combos ×7 метрик 0 overflow/0 MRV/0 sync (carryMeters/grip/overhead/squat/pull/stone/snatch) + fallback deep barbell→farmers + female 0.90 + medley total<cap + VBT history 20/30% + full-combo
- `dup-wave`: DUP wave heavy/medium/light + strongman conjugate max 90%/dynamic 70% X-0-X-0/rep — week%3 per lift — 8 тестов
- `annual`: buildAnnualWithTaper 1нед/2нед taper separate + validate 3× peaking + taper mismatch + weeksUntilCompetition + bridge MANUAL taper 2 блока
- `storage`: v1→v3 migration velocityHistory/distanceM/taper/phase sync — 3 теста
- `print`: header/logo/QR + Gantt phase/taper + medley без хака + @media print + CSV 16 колонок — 5 тестов
- `strength-sport-phase6-pro.test.ts` 30: P0, VBT, weakpoint, attempts, Sinclair/Robi, ICS, Brzycki, mesocycle (PED риски исключены из планировщика)

### Файлы
- `strength-sport-builder.engine.ts` (+weakpoint)
- `strength-sport-*.ts` (12 файлов)
- `StrengthSportConstructor.tsx` (VBT, PED, annual, heatmap, XLS)
- `strength-sport-annual-bridge.ts` (NEW)
- `strength-sport-diagnostics.ts` (NEW)
- `strength-sport-weakpoint.ts` (NEW)
- `strength-sport-strongman-attempts.engine.ts` (NEW)

### Примеры планов (сгенерированы `buildStrengthSportPlan`)
- **WL 4×/нед intermediate 8 нед strength**: `snatch_day / clean_day / strength_day / technique_day` → 32 подъема/нед snatch (MMA 40), 14 сетов присед, тоннаж 18т/нед, peaking 0.88×, VBT `snatch 1.25м/с @80%`
- **SM 3×/нед advanced 6 нед peaking**: `overhead_day / deadlift_day / event_day` → yoke 250м/нед, камней 18 подъёмов, `yoke_walk 300кг >2.5×BW` warning, попытки `йок 220/240/250`
- **Hybrid 4× rolling 3/1**: 4-дневный цикл `snatch/clean/strength` → 6 сессий/7д, DUP wave `90/80/70%` per-lift, ACWR `0.85` при outside high
- **WL Rolling 3/1** (NEW): `rotationDays 4` → 5.25 сесс/нед, `WL_LANDMARKS` 65 лифтов MRV, `deload 50%` + `MRV enforce`

### Что добавлено в раунде 100% (3dc07ddbe → HEAD)
- **A.** `strength-sport-event-types.ts` NEW 20 ивентов `yoke/frame/husafell/sandbag_load/keg_toss/car_deadlift/axle_press`, `STRICT 8→10` (carry_heavy без sled), `EXOTIC 15`
- **B.** `strength-sport-volume.ts` `carry 160/210/260/310`, `grip 12/18/20/24`, `overhead 11/14/16/19` + `axial`/`grip` enforce в `finalize`
- **C.** `StrengthSportSet.distanceM/timeCapS` + `EVENT_META` дистанция `yoke 20/ farmers 40`, `tempo brace 2с — walk`, `rest 15 видов`
- **D.** `progression.ts` `mode==='strongman' 40/35/20` vs Torokhtiy, `phaseForWeek/phaseForDate(mode)` + `car_deadlift 0.88`
- **E.** BFS `STRONG_FALLBACK 17 пар` `yoke→farmers 0.73, stone→sandbag 0.66` + `AXIAL_HIGH vs LOW` (farmers low не режется) + fallback deep barbell→farmers (carry сохранён)
- **F.** `warmup` carry 3 ступень `50/70/85%`, `finalize` `axialSets+300м→кор 2×`, `grip>12→prehab inject` (plate_pinch+dead_hang)
- **G.** `strongman-attempts` `buildStoneLadder 0.70→1.00` + `buildMedleyPlan` `12/28с +5с` + `medley chain event_day 2+1 rest90 cap180`
- **H.** `acwrEwmaSS α=0.25` + `buildLastE1RMIndexSS` + `Constructor EWMA` + `vbtMap persist he_vbt_ss_v1` + `medley badge 20м cap 60с`
- **I-J.** `weight-cut` heavy `>110кг water cap 5/3.5л Na 5г` + `female carry 0.90` (overhead 0.88)
- **K.** `Constructor` `WM 10 полей`, `EventCard medley 180с distance 10-50м / timeCap 30-180с слайдеры + Heatmap 4 rows (carry/stone/overhead / squat+deadlift) + Gantt phase/peaking/taper`, `StrengthUI` токены CARD_STRONG/EventCard/StrengthGantt/StrengthHeatmap (как CardioUI)
- **L.** `property` 192×7 + full-combo (outside high + ACWR dangerous + VBT 30%) 0 overflow, `matrix 192` без outside, `female 0.90`, `medley total<cap`
- **D2.** `DUP wave` week%3 per lift — builder `event_day max 90%/dynamic 70% X-0-X-0/rep` + `applyDUP wave heavy 90%/medium/light` — тесты `dup-wave`
 - **Build:** `338→350→364`, `medley chain event_day 2 carries + stone finisher`, `deload distance ×0.5`, `female 0.90`, `phaseForDate mode`, `Gantt taper отдельно`

### Раунд P2 polish (K/L/D2/I+миграция/print) — коммит 65cb4924
- **K UI:** `StrengthUI.tsx` EventCard + StrengthGantt + StrengthHeatmap (4 rows) — превью medley до сборки с глобальными слайдерами 10-50м/30-180с; `StrengthSportConstructor.tsx` Gantt после сводки + Heatmap 4 rows + EventCard после плана с onChange (правит все недели)
- **PrintLayout:** `strength-sport-export.ts` buildStrengthPrintHtml — единый PrintLayout header/logo/QR + Gantt phase/taper отдельно + Medley секция без хака + @media print Gantt break-inside; `annual.ts` taper отдельный `phase=taper` + `weeksUntilCompetition` fallback + `validateAnnualSSPhases` taper 1-2нед
- **Миграция:** `strength-sport-storage.ts` he_strength_sport_plans_v1 → v3 migrateStrengthSportStorage (velocityHistory/distanceM/taper/phase/sets sync)
- **Тесты:** `dup-intensity` +3 (8/8), `property` 9 (full-combo, fallback deep, VBT 20/30%)

### Раунд P2.1 — продолжение (этот коммит): annual/print/storage + inline polish
- **Annual:** `strength-sport-annual.test.ts` 6 тестов — 1нед/2нед taper separate + 3× peaking + taper mismatch + weeksUntilCompetition + bridge MANUAL 2 блока (taper phase)
- **Storage:** `strength-sport-storage.test.ts` 3 теста — v1→v3 без velocityHistory/distanceM, idempotent, load migrates
- **Print:** `strength-sport-print.test.ts` 5 тестов — header/QR/Gantt phase/taper + medley без хака + @media print + CSV 16
- **UI inline:** `StrengthSportConstructor.tsx` Рекомендация `...CARD` → `SectionCard accent` (сокращение 600 строк inline, как `CardioUI`)
- **Build:** `350→364` (15 файлов), `vite build 43.5s` ✓, `vitest strength-sport 364/364`

### Раунд PRO v2 (b05c9c4f) — Contest 35 + 5-фаз + Winwood + Points + Conditioning + Shield + VBT multi-peak
- **A. Contest** `strength-sport-contest.types.ts` NEW 3 пресета `uss_105/novice_3/osg_light` + `validateContest`, `STRICT 12` `carry_drag/overhead_medley`, `35 ивентов` (`conan/wheel/shield/duck/truck/arm/viking/atlas_over/natural/stone/keg_over/duck`)
- **B. 5-фаз** `progression.ts` `accumulation/intensification/integration/peaking/deload` `25/25/20/15` (Grinder) vs `40/35/20` fallback, `PCT integration 0.88` `reps integration [1,2]`, `rir integration 1`
- **C. Winwood taper** `strength-sport-taper.engine.ts` NEW `cess 7/5/4/3д` + `WINWOOD_TAPER 0.45/0.50 none + 0.55/0.75 reduced`, `builder` per-event `daysOut` cess + `winwoodTaper` + `contest weight 85→100%` + `height/turn/cap` note
- **D. Points** `strongman-attempts 43+` `buildStrongmanPoints/pointsForPlace/strategyToRpe`, `finalize` `Прогноз очков 10 атлетов` preview
- **E. Conditioning/Shield** `strength-sport-conditioning.ts` NEW `alactic/lactic/aerobic` + `finalize` `QL suitcase 2×20м + hammer 3×12 auto-inject` + `VBT carry 15%/25%` vs `20/30%`
- **F. VBT carry** `vbt.engine 31+` `yoke 0.90-1.90 / farmers 1.00-2.00 / stone 0.35-0.95 / log 0.20-0.88` + `VBT_SS_THRESHOLDS`
- **G. UI Contest** `Constructor 82+` `height/turn/timeCap` + `strategy→attempts (yoke/log)` + `Контест-пакет карточка ratio→place` + `attempts strategy balanced`
- **H. Export** `export.ts 6+` `PHASE_COLOR integration #7C3AED` + `medley contest implements + platformHeights` + `annual multi-peak` `buildAnnualMultiPeak`
- **Tests** `382/382` `16 файлов` → `v2.test 18` `contest/taper/points/conditioning/VBT/multi-peak`

### Раунд PRO v2.1 (этот коммит) — хвосты v2 закрыты
- **integration phase** отдельный `StrengthSportPhase='integration'` `PCT 0.88` `reps [1,2]` вместо дубля `intensification`
- **Builder VBT** `isCarryVBT 15/25%` vs `20/30%` (Hindle stride 1.83м)
- **Finalize auto** `QL suitcase 2×20 + hammer 3×12` inject (не только warning) + `hold/drag` уже, `conditioning` note + `points preview` на последней неделе
- **UI** `height/turn/timeCap` + `strategy→attempts` + `contest card place%` + `annual multi-peak` backend готов
- **Export** `integration #7C3AED` + `medley implements + platformHeights`
- **Build** `382→ ~405` , `property 192×7` 0 overflow сохранён, `contest yoke преемпция` зелёная, `taper cess` зелёный

### Осталось (не блокер PRO v2.1, опционально)
- `exceljs` XLS форматирование (сейчас HTML-XLS совместим)
- `multi-peak UI` — бэкенд `buildAnnualMultiPeak` готов, фронта `Season Planner 2×camp` — следующий шаг (не блокер, `annual bridge` работает)
- `conditioning inject` как реальные сессии — сейчас `note + warning`, не `exercise` (осознанно, чтобы не ломать `maxSets`)
