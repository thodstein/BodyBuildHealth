# Кардио PRO — спецификация (Daniels / Banister / Seiler)

Версия: 1.0 (после PRO upgrade 2a6bd84fb)

## 1. Физиология

* **VDOT Daniels** `runningVdot` — точная формула `VO2 = -4.6+0.182258v+0.000104v²`, `VDOT=VO2/denom(t)`, обратный расчёт темпов 70/81/88/97.5/105% VDOT, монотонность темпов гарантирована.
* **TRIMP Banister** `banisterTrimp` — `duration·HRr·k·e^(b·HRr)`, k=0.64/0.86, b=1.92/1.67, HRr=(HRavg-HRrest)/(HRmax-HRrest). Fallback — фактор zone2×2/miss×3/hiit×5.
* **MET kкал** `kcalForCardio` — KCAL_PER_MIN 7/10/14/5 × вес/80 × METоборудования (running 1.0, swim 0.72, cycle 0.90, row 0.72, ellip 0.60, walk 0.46, Compendium 2024) × пол 0.94 жен.
* **Зоны HR** — Karvonen с резервом, LTHR Friel 82/88/94/100%, пол 220/226-age.

## 2. Нагрузка

* **CTL/ATL/TSB** `cardioCtlSeries` — EWMA 42/7, `TSB=CTL-ATL`, +5..+15 пик, <-10 перегруз.
* **Monotony/Strain** `cardioMonotonyStrain` — mean/std, strain=monotony·sum.
* **EWMA ACWR** `cardioAcwrEwma` — acute 7 / chronic 28, EWMA alpha 2/(N+1), зоны 0.8/1.3/1.5.
* **80/20 polarized** — в `cardioQualityReport` >25% HIIT+MISS warn, >20% info (Seiler).
* **10% rule** — `bumpCardioZone2VolumeGuarded` кап недельного объёма 1.10 + monotony>2 гард.

## 3. Структурированные интервалы

* `CardioStructuredBlock {workSec,restSec,reps,target, targetHr}` + `buildStructuredIntervals` (HIIT 60/90×4+, MISS 600/180) + `interferenceScore` (0 avoid,1 caution,3+ ok, Wilson 2012).
* `buildCardioTcx` — Lap на каждый work/rest блок если `structured` есть.

## 4. Дневник PRO

* `wellnessReadiness` (sleep/stress/soreness/mood → 1-10), `importCardioEntries` транзакция дедуп, `cardioLogStatsCutoff` future игнор, `computeCardioAdvice` база — рабочие недели.

## 5. Интеграции

* `CardioManageStep` yearPlan из `annualCardioMap` (а не slice), `annual-training-cardio` taper по блокам.
* `CardioAnalyticsDashboard` — TRIMP Banister + 80/20 tile, `CardioVolumeChart` — CTL метрика.

## 6. Live

* `cardio-ble.engine.ts` — Web Bluetooth HR Service 0x180D, Polar H10 etc.

## Тесты

* `cardio-pro-upgrade.test.ts` 21 — VDOT/TRIMP/CTL/Monotony/EWMA/structured/guarded bump/80-20/wellness

На 2026-08-28 `cardio-cycle 185 + diary 42 + pro-upgrade 21 + constructor 29 + pro-panels 58 = 335` core, общий проект ~7850.
