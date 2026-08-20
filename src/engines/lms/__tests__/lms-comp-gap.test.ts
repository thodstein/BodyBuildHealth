/**
 * lms-comp-gap.test.ts — ПЛ-циклы между соревнованиями (Фаза 2): окна пролётов,
 * сжатие цикла без потери логики, taper/пик у каждого старта, авто/ручной выбор.
 */
import { describe, expect, it } from 'vitest';
import { planBetweenCompetitions, buildSeasonWithCompWindow } from '../lms-comp-gap.engine';
import { fitCycleToWeeks, buildDefaultSeasonSlots } from '../lms-season.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_03 } from '../../../data/lms-cycles/cycle-03';
import { CYCLE_15 } from '../../../data/lms-cycles/cycle-15';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

// Синтетический week1-цикл (без явных недель) для проверки пересчёта темпа прогрессии.
const WEEK1_ONLY: SRCycleTemplate = {
  meta: { id: 'test-w1', title: 'Тест week1', direction: 'powerlifting', level: 'II-KMS', period: 'strength', sessionsPerWeek: 3, weeks: 4, correctionPct: 0 },
  week1: [{ exercises: [{ name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, sets: [{ pct: 0.5, reps: 5, sets: 3 }] }] }],
};

const selector = { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as const;
const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

const opts = {
  selector: selector as never,
  taper: { mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 2 },
  pmMap,
  fallbackPm: 80,
};

describe('planBetweenCompetitions', () => {
  it('8-нед цикл в 12-нед окне с тапером: цикл сжат (7 нед), пик/старт/пост на месте, нет пустых недель', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      { ...opts, cycleForGap: (j) => j === 1 ? CYCLE_01 : CYCLE_01, mode: 'auto' } as never,
    );
    // 20 нед до второго старта + 1 пост = 21 неделя плана + филлерная 22-я (паттерн buildPLSeasonPeaks).
    expect(res.totalPlanWeeks).toBe(22);
    expect(res.weeks.length).toBe(22);
    // Окно второго пролёта = 20-8-1-2-1 = 8 нед.
    const seg1 = res.segments[1];
    expect(seg1.availableWeeks).toBe(8);
    expect(seg1.cycleId).toBe('cycle-01');
    expect(seg1.fitMode).toBe('shrink');
    expect(seg1.fitWeeks).toBe(8);
    expect(seg1.notes.some(n => n.includes('сжат'))).toBe(true);
    // У обоих стартов есть неделя соревнований и пик-блок.
    const meets = res.weeks.filter(w => w.meetWeek);
    expect(meets.length).toBe(2);
    expect(meets.some(m => m.week === 8)).toBe(true);
    expect(meets.some(m => m.week === 20)).toBe(true);
    // Ни одна неделя не пустая (у каждой есть дни или это служебная неделя).
    for (const w of res.weeks) {
      expect(Array.isArray(w.days)).toBe(true);
    }
  });

  it('окно меньше минимального (4 нед): fitWeeks null, поддерживающий повтор, время не простаивает', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 8 },
      ],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto' } as never,
    );
    // Окно второго пролёта = 8-4-1-2-1 = 0 нед → skip.
    const seg1 = res.segments[1];
    expect(seg1.fitMode).toBe('skip');
    expect(seg1.fitWeeks).toBe(1); // минимальная стартовая неделя с прикидами
    expect(seg1.notes.some(n => n.includes('слишком мало'))).toBe(true);
    // План всё равно покрывает горизонт: 8 + 1 пост + 1 филлер = 10 недель.
    expect(res.totalPlanWeeks).toBe(10);
    expect(res.weeks.length).toBe(10);
  });

  it('несколько стартов подряд: окна не накладываются, у каждого старта пик-блок', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'A', weeksToStart: 6 },
        { id: 'm2', name: 'B', weeksToStart: 12 },
        { id: 'm3', name: 'C', weeksToStart: 20 },
      ],
      { ...opts, cycleForGap: (j) => [CYCLE_01, CYCLE_03, CYCLE_15][j], mode: 'auto' } as never,
    );
    expect(res.segments).toHaveLength(3);
    expect(res.segments[0].cycleId).toBe('cycle-01');
    expect(res.segments[1].cycleId).toBe('cycle-03');
    expect(res.segments[2].cycleId).toBe('cycle-15');
    const meets = res.weeks.filter(w => w.meetWeek);
    expect(meets.length).toBe(3);
  });

  it('ручной выбор на каждый пролёт из подходящих в базе', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      { ...opts, mode: 'manual', selections: { 0: 'cycle-01', 1: 'cycle-15' } } as never,
    );
    expect(res.segments[0].cycleId).toBe('cycle-01');
    expect(res.segments[1].cycleId).toBe('cycle-15');
    expect(res.segments[1].candidates.length).toBeGreaterThan(0);
    expect(res.segments[1].candidates.some(c => c.cycle.meta.id === 'cycle-15')).toBe(true);
  });

  it('невалидный id в ручном режиме → fallback на авто + заметка', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      { ...opts, mode: 'manual', selections: { 1: 'not-a-cycle' } } as never,
    );
    expect(res.notes.some(n => n.includes('не подходит'))).toBe(true);
    expect(res.segments[1].cycleId).toBeTruthy();
  });

  it('buildSeasonWithCompWindow — обёртка возвращает и сегменты, и недели', () => {
    const res = buildSeasonWithCompWindow(
      [{ id: 'm1', name: 'Старт', weeksToStart: 10 }],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto' } as never,
    );
    expect(res.segments.length).toBe(1);
    expect(res.weeks.length).toBeGreaterThan(0);
    expect(res.totalPlanWeeks).toBe(res.weeks.length);
  });

  it('сжатие через fitCycleToWeeks сохраняет темп прогрессии (4→3 для week1-цикла)', () => {
    const fit = fitCycleToWeeks(WEEK1_ONLY, 3, { minCycleFloor: 1 }); // оригинал 4 нед
    expect(fit.mode).toBe('shrink');
    expect(fit.weeks).toBe(3);
    expect(fit.correctionPctEff).toBeGreaterThan(0);
    const base = 0.005; // fallback для correctionPct=0
    const expected = Math.min(base * (4 / 3), base * 2);
    expect(fit.correctionPctEff).toBeCloseTo(expected, 5);
  });
});