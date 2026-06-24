# План: расширение тренировочных движков до профессионального уровня

> Цель: перевести тренировочные движки из «богатых, но фрагментированных» в **когерентную
> профессиональную систему** уровня коммерческих AI-тренеров (JuggernautAI / Trenova / Sheelite /
> EliteFTS-стиль). Browser-only (TS + Vite), интеграция в единый планировщик ПЛ/ББ (SRCBBScreen).
>
> Принципы: **REUSE+UNIFY** (собрать разбросанные проф-фичи в канонические модули, дедуп),
> **FILL GAPS** (VBT load-velocity, sRPE-нагрузка, fitness-fatigue, O'Conner — отсутствуют),
> **WIRE** (авторегуляция/мониторинг нагрузки → планировщик), **VERIFY** (tsx + runtime-рендер
> на каждом модуле). Новые модули — в `src/engines/pro/` (изолированный путь, нулевой конфликт).

## Инвентарь (текущее состояние)
- **Есть, но разбросано:** e1RM-формулы (Epley/Brzycki/Lander/Lombardi/Mayhew/Wathen) — в 6 файлах;
  ACWR/monotony/strain — в 13 файлах; VBT-упоминания — 7 файлов (без load-velocity profile);
  Wilks/DOTS/GLI — в gym-competition/performance-analytics; cluster, sticking points, bar path,
  HRV, taper, federation norms — есть.
- **Отсутствует:** load-velocity profile (%1RM↔скорость), bar-speed-таргеты, sRPE (session RPE×длительность→нагрузка),
  fitness-fatigue (Banister/TRAQ), O'Conner, консенсус-e1RM, scientific taper-кривые,
  региональная гипертрофия по длине мышцы, diagnostics→corrections.

## Приоритеты и порядок (P1…P12)

### P1 — Канонический e1RM (`src/engines/pro/estimate1rm.engine.ts`) — UNIFY+EXTEND  ✅ ГОТОВО (16/16 tsx PASS, tsc+vite ✓)
- Собрать все формулы (Epley, Brzycki, Lander, Lombardi, Mayhew, **O'Conner**, Wathen) + реп-диапазонный выбор
  + **консенсус** (медиана/среднее по применимым формулам) + **load-velocity e1RM** (через P2).
- Заменить разбросанные `estimate1RM` на единый фасад (бэкворд-совместимо — re-export).
- Верификация: тест-кейсы 100×1→100, 100×5→~116, 100×10→~133, 140×3→~152; консенсус в ±2% от таблиц BA/Renaissance.

### P2 — Velocity-Based Training (`src/engines/pro/vbt.engine.ts`) — NEW  ✅ ГОТОВО (25/25 tsx PASS, tsc+vite ✓)
- **Load-velocity profile** по движениям (присед/жим/тяга): %1RM ↔ средняя скорость (м/с) (табл. Jovanovic/Gonzalez-Badillo).
- **Velocity targets** по intent: сила (>90% → <0.3 м/с), мощность (50-70% → 0.75-1.0), гипертрофия.
- **Velocity-loss thresholds** (20/25/40%) → авторегулируемое окончание сетов; bar-speed → оценка %1RM в реальном времени.
- API: `velocityForPct(lift, pct)`, `pctForVelocity(lift, v)`, `velocityLossZone(sets)`, `targetVelocity(intent)`.
- Верификация: присед 90%→~0.30 м/с, 60%→~0.75 м/с; pctForVelocity обратим.

### P3 — Мониторинг тренировочной нагрузки (`src/engines/pro/training-load.engine.ts`) — NEW+UNIFY  ✅ ГОТОВО (12/12 tsx PASS, tsc+vite ✓)
- **sRPE**: session RPE (1-10) × длительность (мин) → нагрузка (AU). Дневная/недельная нагрузка.
- **ACWR**: острая (7д) / хроническая (28д) EWMA → коэффициент (опасная зона >1.5).
- **Monotony / Strain** (среднее/СТD недельной нагрузки × суммарная).
- **Fitness-Fatigue (Banister/TRAQ)**: performance = k1·Fitness(t) − k2·Fatigue(t), decay τ1≈42д, τ2≈7д.
- Унифицировать разбросанный ACWR (13 файлов → 1 канонический + re-export).
- Верификация: синтетический 8-недель лог → ACWR, monotony, fitness-fatigue кривые правдоподобны.

### P4 — Проф-авторегуляция (`src/engines/pro/autoregulation-pro.engine.ts`) — REUSE+EXTEND  ✅ ГОТОВО (19/19 tsx PASS, tsc+vite ✓)
- Склейка: readiness + ACWR + velocity-loss + RPE→load → **суточная корректировка плана**
  (% топ-сета, объём-множитель, RIR-сдвиг, триггер deload). Правила:
  ACWR>1.5 → объём×0.8; readiness<50 → RIR+1; velocityLoss>40% → стоп-сеты.
- Wire в планировщик (U7-стиль оверлей, движок не ломаем).
- Верификация: кейсы (высокая готовность + ACWR<1.3 → буст; низкая → делод).

### P5 — Библиотека прогрессий (`src/engines/pro/progression-pro.engine.ts`) — REUSE+EXTEND  ✅ ГОТОВО (24/24 tsx PASS, tsc+vite ✓)
- 5/3/1 (BBB / Joker / FSL), DUP (daily undulating), конъюгейт (max-effort / dynamic-effort / repetition),
  double progression, super-squats, Hepburn A/B — как данные + генератор недель.
- Wire в выбор методологии (U1/U7): выбранная прогрессия → генерация недель.
- Верификация: 5/3/1 4-нед цикл: 65/70/75 / 70/75/80 / 75/80/85 / 40/55/60 (deload-нед).

### P6 — Относительная сила (`src/engines/pro/relative-strength.engine.ts`) — UNIFY  ✅ ГОТОВО (20/20 tsx PASS, tsc+vite ✓)
- Wilks, DOTS, IPF GLI, allometric — единый модуль (+re-export из gym-competition).
- Нормы по возрасту/весу/федерации → категория (новичок…МСМК).
- Верификация: 600 кг тотал, 90 кг, м → Wilks ~380; DOTS ~470; сравнимо с онлайн-калькуляторами.

### P7 — Кривые прогрессии мезоцикла (`src/engines/pro/mesocycle-progression.engine.ts`) — EXTEND  ✅ ГОТОВО (20/20 tsx PASS, tsc+vite ✓)
- Неделя N+1 из N: кривые объёма/интенсивности/RIR по фазе (base/build/peak), fatigue-driven volume drop,
  taper-кривая (объём ↓40-60%, интенсивность удержать). Расширение lms-progression / bb-builder.
- Верификация: 12-нед мезо → монотонный RIR base→peak; peak-нед объём < base.

### P8 — Прескрипция упражнений по биомеханике (`src/engines/pro/exercise-prescription.engine.ts`) — REUSE+EXTEND  ✅ ГОТОВО (18/18 tsx PASS, tsc+vite ✓)
- Региональная гипертрофия (lengthened partials, stretch-mediated, длина мышцы/кривая натяжения),
  force-vector, joint constraints, weak-point → ассистентные (расширение weakpoint-pl).
- Верификация: weak point «дожим жима» → жим в раме/с досок/цепи.

### P9 — Scientific taper/peak (`src/engines/pro/taper.engine.ts`) — REUSE+EXTEND  ✅ ГОТОВО (24/24 tsx PASS, tsc+vite ✓)
- Taper: снижение объёма 40-60% за 1-3 нед, удержание интенсивности, нейромышечный прайминг,
  peak-week протокол. Расширение peaking-engine.
- Верификация: 2-нед taper → объём 60%→40%, RPE удержание 8-9.

### P10 — Диагностика движений и мёртвые точки (`src/engines/pro/lift-diagnostics.engine.ts`) — REUSE+EXTEND
- Sticking points (углы суставов) присед/жим/тяга, bar path analysis, weakness → corrective exercises.
- Верификация: «провал в 2/3 жима» → трицепс/дожим-ассистенты.

### P11 — VBT-ввод в дневнике + bar-speed
- Дневник: ввод bar speed (ручной/устройство) → VBT-авторегуляция (P2/P4). Расширение strength-diary + SessionPlayer.

### P12 — Интеграция и UI
- Аналитика-вью: графики training-load/ACWR/fitness-fatigue/relative-strength.
- Авторег-панель: суточная корректировка плана (P4) + velocity-таргеты (P2).
- Wire fitness-fatigue → readiness → auto-deload.

## Правила выполнения
- После каждого модуля: `tsc --noEmit` ✓ + `vite build` ✓ + tsx-тест-кейсы (как в verify-*).
- REUSE: не дублировать — разбросанные фичи унифицируются в `pro/*` с re-export из старых мест (бэкворд-совместимо).
- Изоляция: новые файлы в `src/engines/pro/` — нулевой конфликт с параллельным агентом (питание/БАД).
- Mobile-first, browser-only, тёмная тема, акцент #00e68a — UI-интеграция по образцу SRCBBScreen.

## Рекомендуемый порядок
P1 (e1RM-канон) → P3 (training-load/sRPE/fitness-fatigue) → P2 (VBT) → P4 (авторегуляция-склейка) →
P6 (relative-strength) → P5 (прогрессии) → P7 (мезо-кривые) → P9 (taper) → P8 (прескрипция) →
P10 (диагностика) → P11 (VBT-дневник) → P12 (UI/интеграция).
