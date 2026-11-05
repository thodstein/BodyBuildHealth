/**
 * Интервальная приверженность: факт по подходам, а не только минуты.
 *
 * Аудит 2026-11, ч.3: журнал научился хранить план/факт подходов
 * (`intervalsPlanned` / `intervalsDone`), но нигде это не агрегировалось —
 * «40 минут» с половиной брошенных отрезков выглядели как полноценная работа.
 * Здесь закреплено: как считаем, что не считаем и как это влияет на совет.
 */
import { describe, it, expect } from 'vitest';
import { buildCardioCycle } from '../cardio.engine';
import { cardioIntervalAdherence, computeCardioAdvice, type CardioLogEntry } from '../cardio-diary.engine';

const REF = '2026-01-05T00:00:00.000Z';

function entry(patch: Partial<CardioLogEntry>): CardioLogEntry {
  return { id: 'e' + Math.random(), date: '2026-01-05', type: 'hiit', durationMin: 40, completed: true, ...patch };
}

describe('cardioIntervalAdherence', () => {
  it('пустой журнал → нули, а не NaN', () => {
    const a = cardioIntervalAdherence([], 14, REF);
    expect(a).toEqual({ sessions: 0, planned: 0, done: 0, pct: 0, shortSessions: 0 });
  });

  it('Σ план / Σ факт по всем интервальным сессиям окна', () => {
    const log = [
      entry({ date: '2026-01-04', intervalsPlanned: 8, intervalsDone: 8 }),
      entry({ date: '2026-01-05', intervalsPlanned: 8, intervalsDone: 6 }),
    ];
    const a = cardioIntervalAdherence(log, 14, REF);
    expect(a.sessions).toBe(2);
    expect(a.planned).toBe(16);
    expect(a.done).toBe(14);
    expect(a.pct).toBe(88);
    expect(a.shortSessions).toBe(1);
  });

  it('сессии без интервалов и незавершённые не попадают в знаменатель', () => {
    const log = [
      entry({ date: '2026-01-05', intervalsPlanned: 6, intervalsDone: 6, type: 'hiit' }),
      entry({ date: '2026-01-05', durationMin: 60, type: 'zone2' }), // обычная Z2
      entry({ date: '2026-01-05', intervalsPlanned: 10, intervalsDone: 0, completed: false }), // брошена
    ];
    const a = cardioIntervalAdherence(log, 14, REF);
    expect(a.sessions).toBe(1);
    expect(a.pct).toBe(100);
  });

  it('факт клампится по записи: 9 из 8 не компенсирует недобор в другой сессии', () => {
    const log = [
      entry({ date: '2026-01-04', intervalsPlanned: 8, intervalsDone: 9 }),
      entry({ date: '2026-01-05', intervalsPlanned: 8, intervalsDone: 4 }),
    ];
    const a = cardioIntervalAdherence(log, 14, REF);
    expect(a.planned).toBe(16);
    expect(a.done).toBe(12); // 8 (кламп) + 4, а не 9 + 4
  });

  it('окно соблюдается: запись 20 дней назад не влияет', () => {
    const log = [
      entry({ date: '2025-12-16', intervalsPlanned: 10, intervalsDone: 0 }),
      entry({ date: '2026-01-05', intervalsPlanned: 4, intervalsDone: 4 }),
    ];
    const a = cardioIntervalAdherence(log, 14, REF);
    expect(a.sessions).toBe(1);
    expect(a.pct).toBe(100);
  });

  it('отрицательный/дробный факт не ломает счёт', () => {
    const log = [
      entry({ date: '2026-01-05', intervalsPlanned: 5, intervalsDone: -2 }),
      entry({ date: '2026-01-05', intervalsPlanned: 5, intervalsDone: 5 }),
    ];
    const a = cardioIntervalAdherence(log, 14, REF);
    expect(a.done).toBe(5);
    expect(a.pct).toBe(50);
    expect(a.shortSessions).toBe(1);
  });
});

describe('computeCardioAdvice: интервалы влияют на объём', () => {
  const cycle = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });

  it('систематический недобор подходов → reduce с числами', () => {
    // Объём в норме (3×40 мин против плана), RPE нормальный — сработать должна
    // именно интервальная ветка, а не минуты/RPE.
    const log = [
      entry({ date: '2026-01-03', durationMin: 40, rpe: 6, intervalsPlanned: 8, intervalsDone: 4 }),
      entry({ date: '2026-01-05', durationMin: 40, rpe: 6, intervalsPlanned: 8, intervalsDone: 4 }),
      entry({ date: '2026-01-06', durationMin: 40, rpe: 6 }),
    ];
    const a = computeCardioAdvice(cycle, log, { referenceIso: REF });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('Интервалы');
    expect(a.reason).toContain('8 из 16');
    expect(a.reason).toContain('50%');
  });

  it('одна «провальная» сессия — ещё не паттерн', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 40, rpe: 6, intervalsPlanned: 8, intervalsDone: 2 }),
      entry({ date: '2026-01-06', durationMin: 40, rpe: 6 }),
      entry({ date: '2026-01-07', durationMin: 40, rpe: 6 }),
    ];
    const a = computeCardioAdvice(cycle, log, { referenceIso: REF });
    expect(a.action).toBe('keep');
  });

  it('подходы добраны → совет не меняется', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 40, rpe: 6, intervalsPlanned: 8, intervalsDone: 8 }),
      entry({ date: '2026-01-06', durationMin: 40, rpe: 6, intervalsPlanned: 6, intervalsDone: 6 }),
      entry({ date: '2026-01-07', durationMin: 40, rpe: 6 }),
    ];
    const a = computeCardioAdvice(cycle, log, { referenceIso: REF });
    expect(a.action).toBe('keep');
  });

  it('RPE-перегруз важнее интервалов (сначала восстановление)', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 90, rpe: 9, intervalsPlanned: 8, intervalsDone: 2 }),
    ];
    const a = computeCardioAdvice(cycle, log, { referenceIso: REF });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('RPE');
  });
});
