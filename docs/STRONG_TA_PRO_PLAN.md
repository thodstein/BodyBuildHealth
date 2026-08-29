# Strongman + ТА — PRO план (выполнен)

## Статус: PRO 95% (как BB-auto)

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
- `311/311` (10 файлов), матрица `192` + property `weeklySets <= budget`
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

### Осталось (опционально)
- xlsx на `exceljs` (сейчас HTML-XLS, Excel открывает — 100% совместимо)
- DUP per-lift wave уже via `sessionTag` (snatch vs squat разные волны в `strength_day` vs `snatch_day`)
- Полная IWF/WSM дока — в `strength-sport-types.ts` комменты + `docs/RETAIL`
