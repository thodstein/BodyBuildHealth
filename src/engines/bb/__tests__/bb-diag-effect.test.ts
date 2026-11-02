/**
 * bb-diag-effect.test.ts — BB-G-04: эффект коррекции через 4–6 недель.
 *
 * Локи: без вставки — «сравнивать не с чем»; до 4 нед — «не срок» с датой
 * перепроверки (а не «эффекта нет»); в окне 4–6 нед — сравнение сетов/нед по
 * зоне; после 6 нед — пометка, что эффект уже не одной вставки; повторная
 * вставка в тот же день не дублируется.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DIAG_INJECTIONS_KEY, DIAG_INJECTIONS_MAX,
  readDiagInjections, logDiagInjection, buildCorrectionEffect,
} from '../bb-diag-effect.engine';

const sess = (date: string, muscle: string, sets: number) => ({
  date,
  exercises: [{ muscleGroup: muscle, sets: Array.from({ length: sets }, () => ({})) }],
});

describe('BB-G-04 журнал вставок', () => {
  beforeEach(() => { localStorage.clear(); });

  it('повторная вставка того же дня и тех же зон не дублируется', () => {
    logDiagInjection({ date: '2026-10-01', zones: ['chest', 'quads'] });
    logDiagInjection({ date: '2026-10-01', zones: ['quads', 'chest'] });
    const list = readDiagInjections();
    expect(list).toHaveLength(1);
    expect(list[0].zones.sort()).toEqual(['chest', 'quads']);
  });

  it('журнал ограничен, свежие записи остаются', () => {
    for (let i = 0; i < DIAG_INJECTIONS_MAX + 5; i++) {
      logDiagInjection({ date: `2026-${String(Math.min(12, i + 1)).padStart(2, '0')}-01`, zones: [`z${i}`] });
    }
    const list = readDiagInjections();
    expect(list.length).toBeLessThanOrEqual(DIAG_INJECTIONS_MAX);
    expect(list[list.length - 1].zones).toEqual([`z${DIAG_INJECTIONS_MAX + 4}`]);
  });

  it('битые записи журнала отбрасываются', () => {
    localStorage.setItem(DIAG_INJECTIONS_KEY, JSON.stringify([{ date: '2026-10-01', zones: ['chest'] }, { date: 'bad' }, null, 'x']));
    expect(readDiagInjections()).toHaveLength(1);
  });
});

describe('BB-G-04 эффект коррекции', () => {
  it('без вставки — «сравнивать не с чем», без нулей', () => {
    const v = buildCorrectionEffect({ injections: [], sessions: [], today: '2026-11-03' });
    expect(v.status).toBe('no_injection');
    expect(v.weeks).toBeNull();
    expect(v.rows).toEqual([]);
    expect(v.text).toMatch(/не с чем/);
  });

  it('до 4 недель — «не срок» + дата перепроверки, verdict=pending', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-25', zones: ['chest'] }],
      sessions: [sess('2026-10-20', 'chest', 8), sess('2026-10-30', 'chest', 12)],
      today: '2026-11-03',
    });
    expect(v.status).toBe('too_early');
    expect(v.weeks).toBeGreaterThan(0);
    expect(v.checkDate).toBe('2026-11-22');
    expect(v.text).toMatch(/нед из 4/);
    expect(v.rows[0].verdict).toBe('pending');
  });

  it('в окне 4–6 нед объём по зоне сравнивается как сеты/нед до и после', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-01', zones: ['chest'] }],
      sessions: [
        // до: 4 недели по 8 сетов в неделю = 8 сет/нед
        sess('2026-09-05', 'chest', 8), sess('2026-09-12', 'chest', 8),
        sess('2026-09-19', 'chest', 8), sess('2026-09-26', 'chest', 8),
        // после: 4 недели по 12 сетов
        sess('2026-10-03', 'chest', 12), sess('2026-10-10', 'chest', 12),
        sess('2026-10-17', 'chest', 12), sess('2026-10-24', 'chest', 12),
      ],
      // ровно 28 дней после вставки — 4 полных недели, без дробной нормировки
      today: '2026-10-29',
    });
    expect(v.status).toBe('window');
    expect(v.weeks).toBeGreaterThanOrEqual(4);
    const row = v.rows[0];
    expect(row.setsBeforeWeekly).toBeCloseTo(8, 1);
    expect(row.setsAfterWeekly).toBeCloseTo(12, 1);
    expect(row.deltaPct).toBe(50);
    expect(row.verdict).toBe('improved');
    expect(v.text).toMatch(/1 улучшилось/);
  });

  it('падение объёма — verdict=worse (коррекция не прижилась)', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-01', zones: ['chest'] }],
      sessions: [
        sess('2026-09-05', 'chest', 12), sess('2026-09-12', 'chest', 12),
        sess('2026-09-19', 'chest', 12), sess('2026-09-26', 'chest', 12),
        sess('2026-10-03', 'chest', 6), sess('2026-10-10', 'chest', 6),
        sess('2026-10-17', 'chest', 6), sess('2026-10-24', 'chest', 6),
      ],
      today: '2026-10-31',
    });
    expect(v.rows[0].verdict).toBe('worse');
    expect(v.text).toMatch(/хуже/);
  });

  it('изменение меньше порога — flat, а не «работает»', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-01', zones: ['chest'] }],
      sessions: [
        sess('2026-09-05', 'chest', 10), sess('2026-09-12', 'chest', 10),
        sess('2026-09-19', 'chest', 10), sess('2026-09-26', 'chest', 10),
        sess('2026-10-03', 'chest', 10), sess('2026-10-10', 'chest', 10),
        sess('2026-10-17', 'chest', 10), sess('2026-10-24', 'chest', 10),
      ],
      today: '2026-10-31',
    });
    expect(v.rows[0].verdict).toBe('flat');
    expect(v.text).toMatch(/без изменений/);
  });

  it('гранулярная зона матчится по родительской группе дневника', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-01', zones: ['chest_upper'] }],
      sessions: [sess('2026-09-10', 'chest', 8), sess('2026-10-10', 'chest', 12), sess('2026-10-20', 'chest', 12)],
      today: '2026-10-31',
    });
    expect(v.rows[0].zone).toBe('chest_upper');
    expect(v.rows[0].setsBeforeWeekly).not.toBeNull();
    expect(v.rows[0].setsAfterWeekly).not.toBeNull();
  });

  it('после 6 недель — пометка, что это уже не эффект одной вставки', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-08-01', zones: ['quads'] }],
      sessions: [sess('2026-08-10', 'quads', 10), sess('2026-10-01', 'quads', 14)],
      today: '2026-11-03',
    });
    expect(v.status).toBe('late');
    expect(v.text).toMatch(/не эффект одной вставки/);
  });

  it('нет дневника в окне — честный «нет данных», а не «0%»', () => {
    const v = buildCorrectionEffect({
      injections: [{ date: '2026-10-01', zones: ['back'] }],
      sessions: [],
      today: '2026-10-31',
    });
    expect(v.rows[0].setsBeforeWeekly).toBeNull();
    expect(v.rows[0].deltaPct).toBeNull();
    expect(v.status).toBe('window');
    expect(v.text).toMatch(/данных для вывода нет/);
  });

  it('берётся ПОСЛЕДНЯЯ вставка (старые не смешиваются)', () => {
    const v = buildCorrectionEffect({
      injections: [
        { date: '2026-08-01', zones: ['chest'] },
        { date: '2026-10-01', zones: ['quads'] },
      ],
      sessions: [sess('2026-09-10', 'quads', 8)],
      today: '2026-10-31',
    });
    expect(v.injectionDate).toBe('2026-10-01');
    expect(v.zones).toEqual(['quads']);
  });
});
