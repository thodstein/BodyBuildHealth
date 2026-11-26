/**
 * structured-analytics-data-gaps.test.ts — «нет данных» не выдаётся ни за «оптимально»,
 * ни за проблему.
 *
 *  - ACWR без хронической базы (меньше 3 тренировок) не считается: прежняя формула
 *    делила на `chronicWeeks = 0`, и уровень 13 печатал «ACWR в безопасной зоне»;
 *  - уровни без данных помечаются `dataMissing`, не штрафуют общий балл и не
 *    печатаются как предупреждения;
 *  - реальное предупреждение (скачок объёма) по-прежнему снижает оценку;
 *  - push/pull без тяги — перекос в push, а не «в pull», и не выдуманный ноль.
 */
import { describe, expect, it } from 'vitest';
import { computeStructuredAnalytics, type SessionData } from '../structured-analytics.engine';

const set = (weight: number, reps: number, rpe: number) => ({ weight, reps, rpe, rir: Math.max(0, 10 - rpe) });

const mk = (id: string, date: string, name: string, weight: number, rpe = 8, durationMin = 60): SessionData => ({
  id,
  date,
  durationMin,
  focus: 'BB',
  exercises: [{ name, sets: [set(weight, 5, rpe)] }],
});

describe('structured analytics: ACWR без хронической базы', () => {
  it('меньше 3 тренировок — метрика не считается, а не «безопасная зона»', () => {
    const out = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100)]);
    const acwr = out.levels.find((l) => l.level === 13)!;
    expect(acwr.dataMissing).toBe(true);
    expect(acwr.metrics.acwr).toBe('—');
    expect(acwr.insight).toContain('не считается');
    // Прежняя формула при chronicWeeks = 0 давала chronicLoad = Infinity.
    expect(Number.isFinite(out.fatigue.chronicLoad)).toBe(true);
    expect(out.fatigue.chronicLoad).toBe(0);
  });

  it('три тренировки дают посчитанный ACWR', () => {
    const out = computeStructuredAnalytics([
      mk('s1', '2026-11-18', 'Squat', 100),
      mk('s2', '2026-11-20', 'Squat', 100),
      mk('s3', '2026-11-24', 'Squat', 100),
    ]);
    const acwr = out.levels.find((l) => l.level === 13)!;
    expect(acwr.dataMissing).toBeUndefined();
    expect(Number(acwr.metrics.acwr)).toBeGreaterThan(0);
  });
});

describe('structured analytics: оценка не штрафует отсутствие данных', () => {
  it('уровни без данных не снижают балл, реальное предупреждение — снижает', () => {
    // Одна тренировка без длительности: большинство уровней без данных.
    const single = computeStructuredAnalytics([{ ...mk('s1', '2026-11-24', 'Squat', 100), durationMin: 0 }]);
    expect(single.overallScore).toBe(100);
    expect(single.evaluatedLevels).toBeGreaterThan(0);
    expect(single.dataGapLevels).toBeGreaterThan(5);
    expect(single.evaluatedLevels + single.dataGapLevels).toBe(single.levels.length);

    // Скачок объёма +50 % — реальное предупреждение уровня 2, оно обязано стоить 5 баллов.
    const jump = computeStructuredAnalytics(
      [mk('cur', '2026-11-24', 'Squat', 150)],
      [mk('prev', '2026-11-18', 'Squat', 100)],
    );
    const level2 = jump.levels.find((l) => l.level === 2)!;
    expect(level2.dataMissing).toBeUndefined();
    expect(level2.status).toBe('warning');
    expect(jump.overallScore).toBe(95);
  });

  it('без прошлого периода уровни 1, 2, 14, 17 честно помечены «нет данных»', () => {
    const out = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100)]);
    for (const level of [1, 2, 14, 17]) {
      const found = out.levels.find((l) => l.level === level)!;
      expect(found.dataMissing, `уровень ${level}`).toBe(true);
      expect(found.status, `уровень ${level}`).toBe('warning');
    }
    expect(out.levels.find((l) => l.level === 1)!.insight).toContain('Нет прошлого периода');
    expect(out.levels.find((l) => l.level === 17)!.insight).toContain('Одна тренировка');
  });

  it('push/pull без тяги — перекос в push, без обеих категорий — нет данных', () => {
    const bench = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Bench Press', 100)]);
    const pushOnly = bench.levels.find((l) => l.level === 12)!;
    expect(pushOnly.dataMissing).toBeUndefined();
    expect(pushOnly.status).toBe('warning');
    expect(pushOnly.insight).toContain('перекос в push');

    const squat = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100)]);
    const none = squat.levels.find((l) => l.level === 12)!;
    expect(none.dataMissing).toBe(true);
    expect(none.metrics.ratio).toBe('—');
    expect(none.insight).toContain('Нет данных push/pull');
  });

  it('непосчитанные показатели профиля — null, а не 0/1', () => {
    const out = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100)]);
    expect(out.fatigue.acwr).toBeNull();
    expect(out.fatigue.monotony).toBeNull();
    expect(out.fatigue.strain).toBeNull();
    expect(out.fatigue.recoveryDebt).toBeNull();
    expect(out.predictions.overtrainingRisk).toBe(0);
    expect(out.predictions.plateauRisk).toBeNull();

    const level19 = out.levels.find((l) => l.level === 19)!;
    expect(level19.metrics.acwr).toBe('—');
    expect(level19.metrics.monotony).toBe('—');
    expect(level19.metrics.avgRPE).toBe(8);
    expect(level19.insight).toContain('проверено 2 из 4 маркеров');

    const level22 = out.levels.find((l) => l.level === 22)!;
    expect(level22.metrics.plateau).toBe('—');
    expect(level22.metrics.overtraining).toBe(0);
    expect(level22.insight).toContain('риск плато не оценивается');
  });

  it('нулевой объём — плотность и тренд объёма не считаются, а не «оптимально»', () => {
    const zeroVolume = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 0)]);
    expect(zeroVolume.levels.find((l) => l.level === 2)!.dataMissing).toBe(true);
    expect(zeroVolume.levels.find((l) => l.level === 2)!.insight).toContain('Объём нулевой');
    const density = zeroVolume.levels.find((l) => l.level === 4)!;
    expect(density.dataMissing).toBe(true);
    expect(density.metrics.kgPerMin).toBe('—');
    expect(density.insight).toContain('плотность не считается');
  });

  it('прогноз 1RM без сравнимых периодов — «нет данных», а не штраф', () => {
    const out = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100)]);
    const level21 = out.levels.find((l) => l.level === 21)!;
    expect(level21.dataMissing).toBe(true);
    expect(level21.insight).toContain('Нет сравнимых периодов');
  });
});

describe('structured analytics: вырожденные периоды и входы', () => {
  it('две тренировки одного дня не делятся на «прошлый» и «текущий» период', () => {
    const out = computeStructuredAnalytics([
      mk('am', '2026-11-24', 'Squat', 100),
      mk('pm', '2026-11-24', 'Squat', 110),
    ]);
    // Деление внутри дня давало «прогресс +10 % за день» и прогноз 1RM из утренней сессии.
    expect(out.levels.find((l) => l.level === 1)!.dataMissing).toBe(true);
    expect(out.levels.find((l) => l.level === 1)!.metrics.ratio).toBe('—');
    expect(out.levels.find((l) => l.level === 21)!.dataMissing).toBe(true);
    expect(out.predictions.nextWeek1RM).toEqual({});
    expect(out.patterns.every((p) => p.rmComparable === false)).toBe(true);
  });

  it('граница периодов сдвигается к ближайшей смене даты, а не режет день', () => {
    const out = computeStructuredAnalytics([
      mk('a', '2026-11-18', 'Squat', 100),
      mk('b', '2026-11-20', 'Squat', 100),
      mk('c', '2026-11-20', 'Squat', 105),
      mk('d', '2026-11-24', 'Squat', 110),
    ]);
    const level1 = out.levels.find((l) => l.level === 1)!;
    expect(level1.dataMissing).toBeUndefined();
    // Ближайшая граница дат — перед 24-м: три сессии 18–20 против одной 24-го.
    expect(level1.metrics.previous).toBe(3);
    expect(level1.metrics.sessions).toBe(1);
  });

  it('тренд RPE без прошлых измерений — «—», а не «стабильно 0.0»', () => {
    const out = computeStructuredAnalytics(
      [mk('cur', '2026-11-24', 'Squat', 100, 9)],
      [{ ...mk('prev', '2026-11-18', 'Squat', 100), exercises: [{ name: 'Squat', sets: [set(100, 5, 0)] }] }],
    );
    const level3 = out.levels.find((l) => l.level === 3)!;
    expect(level3.metrics.avgRPE).toBe(9);
    expect(level3.metrics.trend).toBe('—');
    // Сама интенсивность измерена — уровень оценён, промолчал только тренд.
    expect(level3.dataMissing).toBeUndefined();
  });

  it('история без RPE не выдаёт «баланс ЦНС/периферия в норме» и маркеры за измеренные', () => {
    const out = computeStructuredAnalytics([mk('s1', '2026-11-24', 'Squat', 100, 0)]);
    const level15 = out.levels.find((l) => l.level === 15)!;
    expect(level15.dataMissing).toBe(true);
    expect(level15.metrics.cnsSets).toBe('—');
    expect(level15.insight).toContain('RPE не измерялся');

    const level19 = out.levels.find((l) => l.level === 19)!;
    expect(level19.dataMissing).toBe(true);
    expect(level19.metrics.signals).toBe('—');
    expect(level19.insight).toContain('Нет измеренных маркеров');
    expect(out.predictions.overtrainingRisk).toBeNull();
  });

  it('пустая история — null в непосчитанных полях, а не нули «измеренных»', () => {
    const out = computeStructuredAnalytics([]);
    expect(out.levels).toEqual([]);
    expect(out.fatigue.acwr).toBeNull();
    expect(out.fatigue.monotony).toBeNull();
    expect(out.fatigue.strain).toBeNull();
    expect(out.fatigue.recoveryDebt).toBeNull();
    expect(out.predictions.overtrainingRisk).toBeNull();
    expect(out.predictions.plateauRisk).toBeNull();
  });

  it('упражнение без подходов не даёт -Infinity в 1RM и не ломает прогноз', () => {
    const out = computeStructuredAnalytics([
      { ...mk('s1', '2026-11-24', 'Squat', 100), exercises: [{ name: 'Squat', sets: [] }] },
      { ...mk('s2', '2026-11-26', 'Squat', 100), exercises: [{ name: 'Squat', sets: [] }] },
    ]);
    expect(out.patterns).toEqual([]);
    expect(JSON.stringify(out)).not.toContain('Infinity');
  });
});
