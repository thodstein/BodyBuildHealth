/**
 * structured-analytics-rpe-honesty.test.ts — RPE 0 значит «оценку не вводили».
 *
 * После честного RIR подход из виджета без оценки хранится как `rpe: 0`
 * (`rirMissing`). Движок не должен читать этот ноль ни как «работал в запасе»
 * (поправка +30 % к 1RM), ни как измеренную интенсивность 0.
 */
import { describe, expect, it } from 'vitest';
import { computeStructuredAnalytics, type SessionData } from '../structured-analytics.engine';

const set = (weight: number, reps: number, rpe: number) => ({ weight, reps, rpe, rir: Math.max(0, 10 - rpe) });

const session = (sets: SessionData['exercises'][number]['sets']): SessionData => ({
  id: 's1',
  date: '2026-11-24',
  durationMin: 60,
  focus: 'BB',
  exercises: [{ name: 'Bench Press', sets }],
});

const bench = (sessions: SessionData[]) =>
  computeStructuredAnalytics(sessions).patterns.find((p) => p.pattern === 'bench');

const benchWithPrev = (sessions: SessionData[], prev: SessionData[]) =>
  computeStructuredAnalytics(sessions, prev).patterns.find((p) => p.pattern === 'bench');

describe('structured analytics: RPE 0 — «нет данных», а не «до отказа»', () => {
  it('1RM без оценки — чистый Epley, без поправки +30 %', () => {
    // 100 кг × 5 без RPE: Epley = 116.7, прежняя поправка (10 − 0)·3 % давала 152.
    expect(bench([session([set(100, 5, 0)])])?.estimated1RM).toBe(117);
  });

  it('1RM с введённым RPE сохраняет поправку на запас', () => {
    // 116.7 · (1 + (10 − 8)·3 %) = 123.7 → 124.
    expect(bench([session([set(100, 5, 8)])])?.estimated1RM).toBe(124);
  });

  it('лучший 1RM не берётся из незаполненного высокоповторного подхода', () => {
    // 100×20 без RPE даёт Epley 167 и перебил бы измеренный 100×5 RPE 8 (124).
    const out = bench([session([set(100, 5, 8), set(100, 20, 0)])]);
    expect(out?.estimated1RM).toBe(124);
  });

  it('тренд 1RM не смешивает измеренный метод с чистым Epley', () => {
    const prev = { ...session([set(100, 5, 8)]), id: 'prev', date: '2026-11-24' };
    const cur = { ...session([set(100, 5, 8)]), id: 'cur', date: '2026-11-25' };
    const unmeasured = { ...session([set(100, 20, 0)]), id: 'unm', date: '2026-11-26' };
    const out = computeStructuredAnalytics([cur, unmeasured], [prev]).patterns.find((p) => p.pattern === 'bench');
    // Незаполненный 20-повторный подход не становится «лучшим 1RM» периода…
    expect(out?.estimated1RM).toBe(124);
    // …тренд при этом сравним (оба периода измерены), но 1RM совпал: 0 % — это
    // настоящий ноль, а не «методы разные».
    expect(out?.rmComparable).toBe(true);
    expect(out?.estimated1RMTrend).toBe(0);
  });

  it('тренд не сравнивает измеренный период с неизмеренным (в обе стороны)', () => {
    const measured = session([set(100, 5, 8)]); // 124
    const unmeasured = session([set(100, 5, 0)]); // 117, чистый Epley
    const forward = benchWithPrev(
      [{ ...measured, id: 'c1', date: '2026-11-25' }],
      [{ ...unmeasured, id: 'p1', date: '2026-11-18' }],
    );
    expect(forward?.estimated1RM).toBe(124);
    expect(forward?.estimated1RMTrend).toBe(0);
    expect(forward?.rmComparable).toBe(false);

    // Обратная сторона: сейчас без оценки, раньше с RPE — тоже не сравнение.
    const backward = benchWithPrev(
      [{ ...unmeasured, id: 'c2', date: '2026-11-25' }],
      [{ ...measured, id: 'p2', date: '2026-11-18' }],
    );
    expect(backward?.estimated1RMTrend).toBe(0);
    expect(backward?.rmComparable).toBe(false);
  });

  it('тренд считается, когда метод одинаков у обоих периодов', () => {
    const now = session([set(110, 5, 0)]);
    const before = session([set(100, 5, 0)]);
    const out = benchWithPrev([{ ...now, id: 'c', date: '2026-11-25' }], [{ ...before, id: 'p', date: '2026-11-18' }]);
    // Epley 100×5 → 110×5: +10 % (тренд считается по исходным значениям, не по округлённым).
    expect(out?.estimated1RMTrend).toBe(10);
    expect(out?.rmComparable).toBe(true);
  });

  it('уровни без измерений не объявляют «оптимально»', () => {
    const out = computeStructuredAnalytics([{ ...session([set(100, 5, 0)]), durationMin: 0 }]);
    const rpe = out.levels.find((l) => l.level === 3);
    const density = out.levels.find((l) => l.level === 4);
    const duration = out.levels.find((l) => l.level === 18);
    expect(rpe?.metrics.avgRPE).toBe(0);
    expect(rpe?.status).toBe('warning');
    expect(rpe?.insight).toContain('RPE не измерялся');
    expect(density?.status).toBe('warning');
    expect(density?.insight).toContain('Длительность не записана');
    expect(duration?.status).toBe('warning');
    expect(duration?.insight).toContain('Длительность не записана');
  });

  it('прогноз 1RM не печатает «0 кг» для убранного упражнения', () => {
    const prevSquat: SessionData = {
      id: 'p',
      date: '2026-11-18',
      durationMin: 60,
      focus: 'BB',
      exercises: [{ name: 'Squat', sets: [set(100, 5, 8)] }],
    };
    const out = computeStructuredAnalytics([session([set(100, 5, 8)])], [prevSquat]);
    expect(out.predictions.nextWeek1RM['squat']).toBeUndefined();
    const level21 = out.levels.find((l) => l.level === 21);
    expect(level21?.insight).not.toContain('squat');
    // Bench есть только в текущем периоде: сравнивать не с чем, и «+0 %» — не прогноз,
    // а эхо текущего 1RM, поэтому прогноза по нему тоже нет.
    expect(out.predictions.nextWeek1RM['bench']).toBeUndefined();
    expect(level21?.insight).not.toContain('bench');
    expect(out.patterns.find((p) => p.pattern === 'bench')?.rmComparable).toBe(false);
  });

  it('паттерн без текущего периода не даёт ложный регресс −100 %', () => {
    const prevSquat: SessionData = {
      id: 'p',
      date: '2026-11-18',
      durationMin: 60,
      focus: 'BB',
      // В прошлом периоде RPE тоже не вводили: без требования «данные с обеих
      // сторон» такой паттерн дал бы ложный −100 % (0 против 117).
      exercises: [{ name: 'Squat', sets: [set(100, 5, 0)] }],
    };
    const out = computeStructuredAnalytics([session([set(100, 5, 8)])], [prevSquat]);
    const squat = out.patterns.find((p) => p.pattern === 'squat');
    expect(squat?.estimated1RMTrend).toBe(0);
    expect(squat?.rmComparable).toBe(false);
    expect(out.levels.find((l) => l.name === 'Прогрессия: squat')?.insight).toContain('Нет сравнимых данных');
  });

  it('интенсивность считается только по измеренным сетам', () => {
    const out = computeStructuredAnalytics([session([set(100, 5, 0), set(100, 5, 8)])]);
    // Средняя по всем сетам дала бы 4: подход без оценки не должен тянуть вниз.
    expect(out.patterns.find((p) => p.pattern === 'bench')?.currentIntensity).toBe(8);
    expect(out.levels.find((l) => l.level === 3)?.metrics.avgRPE).toBe(8);
  });

  it('уровень 5 без подходов не объявляет распределение «оптимальным»', () => {
    const out = computeStructuredAnalytics([session([])]);
    const level5 = out.levels.find((l) => l.level === 5);
    expect(level5?.status).toBe('warning');
    expect(level5?.insight).toContain('Подходов нет');
  });

  it('история одним списком делится на прошлый и текущий период', () => {
    const squat = (id: string, date: string, weight: number): SessionData => ({
      id,
      date,
      durationMin: 60,
      focus: 'BB',
      exercises: [{ name: 'Squat', sets: [set(weight, 5, 8)] }],
    });
    // Без явного prev: карточка передаёт всю историю одним списком, порядок произвольный.
    const out = computeStructuredAnalytics([
      squat('s3', '2026-11-25', 110),
      squat('s1', '2026-11-11', 100),
      squat('s4', '2026-11-27', 110),
      squat('s2', '2026-11-18', 100),
    ]);
    const p = out.patterns.find((x) => x.pattern === 'squat')!;
    expect(p.previousVolume).toBeGreaterThan(0);
    expect(p.currentVolume).toBeGreaterThan(p.previousVolume);
    expect(p.rmComparable).toBe(true);
    expect(out.predictions.nextWeek1RM['squat']).toBeGreaterThan(0);
    const level1 = out.levels.find((l) => l.level === 1);
    expect(level1?.metrics.previous).toBe(2);
    expect(level1?.metrics.sessions).toBe(2);
  });

  it('прогноз без сравнимого периода не строится', () => {
    const out = computeStructuredAnalytics([session([set(100, 5, 8)])]);
    expect(out.predictions.nextWeek1RM).toEqual({});
    const level21 = out.levels.find((l) => l.level === 21);
    expect(level21?.insight).toContain('Нет сравнимых периодов');
  });

  it('уровень 17: частота в неделю считается по длине периода, а не по числу записей', () => {
    const mk = (id: string, date: string): SessionData => ({
      id,
      date,
      durationMin: 60,
      focus: 'BB',
      exercises: [{ name: 'Squat', sets: [set(100, 5, 8)] }],
    });
    // Шесть тренировок за 17 дней (с 02.11 по 18.11) — это ~2.5/нед, а не «6/нед».
    // Прошлый период задан явно, чтобы длина окна считалась по всем шести записям,
    // а не по половине после авто-сплита.
    const out = computeStructuredAnalytics(
      [
        mk('a', '2026-11-02'),
        mk('b', '2026-11-04'),
        mk('c', '2026-11-09'),
        mk('d', '2026-11-11'),
        mk('e', '2026-11-16'),
        mk('f', '2026-11-18'),
      ],
      [mk('p0', '2026-10-26')],
    );
    const level17 = out.levels.find((l) => l.level === 17);
    expect(level17?.metrics.sessionsPerWeek).toBeCloseTo(2.5, 1);
    expect(level17?.metrics.sessionsPerWeek).not.toBe(6);
  });

  it('сессия вовсе без оценок даёт 0, а не выдуманное значение', () => {
    const out = computeStructuredAnalytics([session([set(100, 5, 0), set(100, 8, 0)])]);
    expect(out.levels.find((l) => l.level === 3)?.metrics.avgRPE).toBe(0);
  });
});
