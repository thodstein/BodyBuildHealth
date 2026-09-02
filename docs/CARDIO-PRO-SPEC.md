# Кардио PRO — спецификация (Daniels / Banister / Seiler / Coggan)

Версия: 2.0 (professional upgrade e08d2625/dd6b7303/ac5a8398 — fact CTL, Tanaka, polarized, interference, taper 2.0, ZWO, year CTL)

## 1. Физиология

* **VDOT Daniels** `runningVdot` — точная формула `VO2 = -4.6+0.182258v+0.000104v²`, `VDOT=VO2/denom(t)`, обратный расчёт темпов 70/81/88/97.5/105% VDOT, монотонность темпов гарантирована.
* **TRIMP Banister** `banisterTrimp` — `duration·HRr·k·e^(b·HRr)`, k=0.64/0.86, b=1.92/1.67, HRr=(HRavg-HRrest)/(HRmax-HRrest). Fallback — фактор zone2×2/miss×3/hiit×5.
* **MET kкал** `kcalForCardio` — KCAL_PER_MIN 7/10/14/5 × вес/80 × METоборудования (running 1.0, swim 0.72, cycle 0.90, row 0.72, ellip 0.60, walk 0.46, Compendium 2024) × пол 0.94 жен.
* **Зоны HR** — Karvonen с резервом, LTHR Friel 82/88/94/100%, пол 220/226-age, **Tanaka 208-0.7×age / Gulati 206-0.88×age**, `maxHrClassic/Tanaka/Gulati`, `estimateLTHRFrom30Min` (Friel 30-мин all-out, последн 20′), `estimateZonesFromFieldTests`.
* **Ватт-зоны** `cyclingPowerZones(ftp)` Coggan 1-7 (Z2 56-75% FTP), `cardioHrDrift>5%` warning.

## 2. Нагрузка

* **CTL/ATL/TSB** `cardioCtlSeries` — EWMA 42/7, `TSB=CTL-ATL`, +5..+15 пик, <-10 перегруз. **Факт CTL** `cardioFactCtlSeries(log, {restHr,maxHr,sex,ref,days})` daily EWMA 42/7 из дневника (Banister где есть HR, иначе фактор), `dailyTrimpMap`, `cardioHrDrift`.
* **Monotony/Strain** `cardioMonotonyStrain` — mean/std, strain=monotony·sum.
* **EWMA ACWR** `cardioAcwrEwma` — acute 7 / chronic 28, EWMA alpha 2/(N+1), зоны 0.8/1.3/1.5.
* **80/20 polarized** — в `cardioQualityReport` >25% HIIT+MISS warn, >20% info (Seiler). **Периодизация** `CardioPeriodizationModel: linear|polarized|pyramidal|pyramidal_polarized` (Seiler 2026) — `profileForGoal(goal,model)` меняет base/build.
* **10% rule** — `bumpCardioZone2VolumeGuarded` кап недельного объёма 1.10 + monotony>2 гард.
* **Taper 2.0** `BB_CARDIO_TAPER_CURVE {0.6,0.7,0.85,0.9}` vs `EXPONENTIAL {0.5,0.65,0.82,0.88}`, `bbCardioTaperMult(dist,model)`, `cardioTaperRecommendation({acwr,wellness,sleep})` — F-OR → 3нед exponential + гигиена сна (Bosquet 2024).
* **IDB** `cardio_sessions` store v7, `migrateCardioLogToIdb/loadAsync`, `cloud-kv IDB_STORES` синк.

## 3. Структурированные интервалы + Interference

* `CardioStructuredBlock {workSec,restSec,reps,target, targetHr}` + `buildStructuredIntervals` (HIIT 60/90×4+, MISS 600/180) + `interferenceScore` (0 avoid,1 caution,3+ ok, Wilson 2012).
* `cardio-interference.engine.ts` — `cardioInterferenceScoreDetailed({modality,frequency,duration,legDays,timing,sex,hiitRatio}) → 0-10 low/mid/high` (mod running 1.0/cycling 0.3, Wilson 31%/Schumann/Huiberts пол), `interferenceForCycle`, `moveCardioSessionInWeek` (drag-and-drop).
* `buildCardioTcx` — Lap на каждый work/rest блок если `structured` есть. `buildCardioZwo` — Zwift `<IntervalsT>` для HIIT, `<SteadyState>` для Z2.
* `cardio-export.engine.ts` — ре-экспорт слой (ICS/TCX/ZWO/Print) из god-file.

## 4. Дневник PRO

* `wellnessReadiness` (sleep/stress/soreness/mood → 1-10), `importCardioEntries` транзакция дедуп, `cardioLogStatsCutoff` future игнор, `computeCardioAdvice` база — рабочие недели.

## 5. Интеграции + UI

* `CardioManageStep` yearPlan из `annualCardioMap` + `cardioCtlSeries` года (CTL/ATL/TSB), экспорт `.zwo` (Zwift) рядом с `.tcx`, `annual-training-cardio` taper по блокам.
* `CardioAnalyticsDashboard` — TRIMP Banister + 80/20 + **interference tile** + **факт CTL/ATL/TSB** + **HR drift** (>5%).
* `CardioVolumeChart` — **факт CTL overlay** (daily `cardioFactCtlSeries` → weekly), `CardioPreviewStep` — **interference метрика + баннер**, `CardioParamsStep` — **periodization + taperModel + maxHrFormula + sleep-hygiene banner**, `CardioAutoTunePanel` — **LTHR 30-мин helper + FTP watt-zones**.

## 6. Live

* `cardio-ble.engine.ts` — Web Bluetooth HR Service 0x180D, Polar H10 etc.

## Тесты

* `cardio-pro-upgrade.test.ts` 21 — VDOT/TRIMP/CTL/Monotony/EWMA/structured/guarded bump/80-20/wellness
* `cardio-pro-epics.test.ts` 23 — fact CTL/dailyTrimp, Tanaka/cyclingPower, polarized/pyramidal, interference, taper exponential/pre-fatigue, ZWO, move/drag

На 2026-09-02 `cardio-cycle 185 + diary 42 + pro-upgrade 21 + pro-epics 23 + constructor 29 + pro-panels 58 + import 14 + bridge 9 + annual 13 = 563` core, `vitest cardio 563/563`, общий проект ~7880. tsc 0, build OK.
