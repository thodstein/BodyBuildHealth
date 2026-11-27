---
name: Strength Sports
description: Профессиональная архитектура планов и анализа для бодибилдинга, пауэрлифтинга, армрестлинга, стронгмена и силовых видов спорта
---

# Strength sports planning

Используй этот навык для тренировочных планов, прогрессии, диагностики, соревнований и UI силовых видов спорта.
«Профессиональный уровень» здесь означает проверяемые инварианты, воспроизводимость, тесты и честные ограничения, а
не обещание спортивного результата.

## Разделение доменов

- **Бодибилдинг:** `src/engines/bb`, SFR/объём, fatigue/recovery, hypertrophy, contest prep.
- **Пауэрлифтинг/силовые:** `src/engines/strength-sport`, `src/lib/training`, 1RM/RPE/RIR, попытки, peaking.
- **Армрестлинг:** `src/engines/arm` и strength-sport arm/grip/angle/pose модули; отдельно кисть, пронация,
  супинация, локоть и асимметрия.
- **Стронгмен/strongman:** carry, yoke, stones, axle, log, event scoring и competition attempts.
- **Общие данные:** дневник, даты, week index, readiness/HRV, injury flags, equipment и substitutions.

## Инварианты движка

- План детерминирован: без `Math.random()`/`Date.now()` в build path.
- RIR/RPE не выдумывается из отсутствующего поля; явный ноль отличается от missing.
- Даты считаются локальным ISO-каноном проекта, не `new Date('YYYY-MM-DD')` с неявным UTC.
- `e1RM`, тоннаж, volume и adherence считают только валидные work sets; warm-up/activator не смешиваются.
- Вес, доступные диски, bodyweight и equipment ограничения должны сохраняться после progression/replan.
- Deload, injury/rehab и competition taper не клонируются как обычная неделя.

## Планирование и исследование

1. Сначала определить вид спорта, уровень, календарь старта, оборудование, ограничения и цель.
2. Разделить фактические данные дневника, плановые значения и гипотезы; не считать отсутствие данных нулевым прогрессом.
3. Любую физиологическую/медицинскую константу брать из `research`/PubMed/официального источника до изменения кода.
4. Не переносить диапазоны бодибилдинга на пауэрлифтинг, армрестлинг или стронгмен без явного обоснования.
5. Для травмы не выдавать лечебное назначение: использовать safety gate и направление к специалисту.

## Файлы и тесты

- BB: `src/engines/bb/__tests__`, `npm run test:bb`.
- Strength sports: `src/engines/strength-sport` и соответствующие `src/ui/screens/strength-sport` tests.
- Arm: `src/engines/arm`, `src/ui/screens/strength-sport`, точечный Vitest по изменённым файлам.
- Для UI/APK: `npm run test:ui`, `npm run verify:apk-design`.
- Всегда: `npm run type-check`; тесты должны покрывать edge cases (missing RIR, week boundary, deload, equipment,
  pain/red flag, bodyweight и повторный replan).
