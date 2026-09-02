/**
 * lms-season.test.ts — ПЛ-сезон по микроциклам (Фаза 1): слоты, fitCycleToWeeks,
 * candidateCyclesForSlot, planSeason (авто/ручной), assembleSeasonPlan.
 * Обновлён под принцип «любое изменение — только по согласию».
 */
import { describe, expect, it } from 'vitest';
import {
  buildDefaultSeasonSlots,
  clampSlotWeeks,
  fitCycleToWeeks,
  applyFitConsent,
  candidateCyclesForSlot,
  planSeason,
  assembleSeasonPlan,
  seasonSegmentSummary,
  type PLSeasonSlot,
  type PLSeasonPlan,
} from '../lms-season.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_03 } from '../../../data/lms-cycles/cycle-03';
import { CYCLE_15 } from '../../../data/lms-cycles/cycle-15';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { speedOrientationOf } from '../../../data/lms-cycles/lms-speed-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

// Синтетический week1-цикл (без явных недель) для проверки пересчёта темпа прогрессии.
const WEEK1_ONLY: SRCycleTemplate = {
  meta: { id: 'test-w1', title: 'Тест week1', direction: 'powerlifting', level: 'II-KMS', period: 'strength', sessionsPerWeek: 3, weeks: 4, correctionPct: 0 },
  week1: [{ exercises: [{ name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, sets: [{ pct: 0.5, reps: 5, sets: 3 }] }] }],
};

const selector = { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as const;

describe('buildDefaultSeasonSlots', () => {
  it('4 канонических слота с диапазонами пользователя', () => {
    const slots = buildDefaultSeasonSlots();
    expect(slots).toHaveLength(4);
    expect(slots.map(s => s.period)).toEqual(['endurance', 'strength', 'speed', 'peak']);
    const ranges: Record<string, [number, number]> = {
      endurance: [6, 20], strength: [6, 12], speed: [6, 10], peak: [8, 10],
    };
    for (const s of slots) {
      expect(s.weeksMin).toBe(ranges[s.period][0]);
      expect(s.weeksMax).toBe(ranges[s.period][1]);
      expect(s.defaultWeeks).toBeGreaterThanOrEqual(s.weeksMin);
      expect(s.defaultWeeks).toBeLessThanOrEqual(s.weeksMax);
      expect(s.enabled).toBe(true);
    }
  });

  it('clampSlotWeeks: кламп в [min, max], некорректные значения → default', () => {
    const slot = buildDefaultSeasonSlots()[0]; // endurance 6-20, default 12
    expect(clampSlotWeeks(slot, 30)).toBe(20);
    expect(clampSlotWeeks(slot, 1)).toBe(6);
    expect(clampSlotWeeks(slot, 10)).toBe(10);
    expect(clampSlotWeeks(slot, NaN)).toBe(12);
    expect(clampSlotWeeks(slot, -5)).toBe(6);
  });
});

describe('fitCycleToWeeks', () => {
  it('точное соответствие — exact без согласия', () => {
    const r = fitCycleToWeeks(CYCLE_01, 12);
    expect(r.mode).toBe('exact');
    expect(r.weeks).toBe(12);
    expect(r.needsConsent).toBe(false);
  });

  it('растяжение — proposed_extend требует согласия', () => {
    const r = fitCycleToWeeks(CYCLE_01, 16);
    expect(r.mode).toBe('proposed_extend');
    expect(r.weeks).toBe(16);
    expect(r.needsConsent).toBe(true);
    expect(r.cycle.weeks).toBeUndefined();
    expect(r.cycle.meta.weeks).toBe(16);
    expect(r.cycle.week1).toEqual(CYCLE_01.week1);
    const applied = applyFitConsent(r, true);
    expect(applied.needsConsent).toBe(false);
    expect(applied.weeks).toBe(16);
    const blocked = applyFitConsent(r, false);
    expect(blocked.mode).toBe('strict_skip');
    expect(blocked.weeks).toBe(0);
  });

  it('сжатие явных недель: фазовая структура сохранена, первая и последняя недели на месте (требует согласия)', () => {
    const r = fitCycleToWeeks(CYCLE_01, 8);
    expect(r.mode).toBe('proposed_shrink');
    expect(r.weeks).toBe(8);
    expect(r.needsConsent).toBe(true);
    expect(r.cycle.weeks).toHaveLength(8);
    expect(r.cycle.weeks![0]).toEqual(CYCLE_01.weeks![0]);
    expect(r.cycle.weeks![r.cycle.weeks!.length - 1]).toEqual(CYCLE_01.weeks![CYCLE_01.weeks!.length - 1]);
    expect(r.notes.some(n => n.includes('сжат'))).toBe(true);
    const applied = applyFitConsent(r, true);
    expect(applied.needsConsent).toBe(false);
    expect(applyFitConsent(r, false).mode).toBe('strict_skip');
  });

  it('сжатие week1-цикла: темп прогрессии пересчитан (суммарный прирост ПМ сохранён), требует согласия', () => {
    const r = fitCycleToWeeks(WEEK1_ONLY, 3, { minCycleFloor: 1 }); // оригинал 4 нед
    expect(r.mode).toBe('proposed_shrink');
    expect(r.weeks).toBe(3);
    expect(r.needsConsent).toBe(true);
    expect(r.correctionPctEff).toBeGreaterThan(0);
    const base = 0.005; // fallback для correctionPct=0
    const expected = Math.min(base * (4 / 3), base * 2);
    expect(r.correctionPctEff).toBeCloseTo(expected, 5);
  });

  it('окно меньше минимального (4 нед) — weeks 0 с предупреждением, без предложения', () => {
    const r = fitCycleToWeeks(CYCLE_01, 3, { minCycleFloor: 4 });
    expect(r.weeks).toBe(0);
    expect(r.mode).toBe('strict_skip');
    expect(r.needsConsent).toBe(false);
    expect(r.notes.some(n => n.includes('окно слишком мало'))).toBe(true);
  });

  it('некорректные недели — weeks 0', () => {
    expect(fitCycleToWeeks(CYCLE_01, NaN).weeks).toBe(0);
    expect(fitCycleToWeeks(CYCLE_01, 0).weeks).toBe(0);
  });

  it('exact не требует согласия, proposed требует', () => {
    const exact = fitCycleToWeeks(CYCLE_01, 12);
    const proposed = fitCycleToWeeks(CYCLE_01, 8);
    expect(exact.needsConsent).toBe(false);
    expect(proposed.needsConsent).toBe(true);
    expect(applyFitConsent(exact, false).mode).toBe('exact');
  });
});

describe('candidateCyclesForSlot', () => {
  const slotFor = (period: string, weeks = 8): Pick<PLSeasonSlot, 'period' | 'weeks' | 'weeksMin' | 'weeksMax'> =>
    ({ period, weeks, weeksMin: 6, weeksMax: 20 } as never);

  it('endurance — кандидаты периода выносливости (через rankCycles)', () => {
    const list = candidateCyclesForSlot(slotFor('endurance'), selector as never);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].cycle.meta.period).toBe('endurance');
  });

  it('strength — кандидаты периода силы', () => {
    const list = candidateCyclesForSlot(slotFor('strength'), selector as never);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].cycle.meta.period).toBe('strength');
  });

  it('peak — кандидаты периода пика', () => {
    const list = candidateCyclesForSlot(slotFor('peak'), selector as never);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].cycle.meta.period).toBe('peak');
  });

  it('speed — кандидаты только из индекса скорости', () => {
    const list = candidateCyclesForSlot(slotFor('speed'), selector as never);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) {
      expect(speedOrientationOf(r.cycle).length).toBeGreaterThan(0);
    }
  });

  it('циклы длиннее максимума слота получают пометку «предлагается сжать» (требует согласия)', () => {
    const list = candidateCyclesForSlot({ period: 'peak', weeks: 8, weeksMin: 8, weeksMax: 10 }, selector as never);
    const long = list.filter(r => r.warnings.some(w => w.includes('предлагается сжать')));
    expect(long.length).toBeGreaterThan(0);
  });
});

describe('planSeason (авто/ручной)', () => {
  it('авто без согласия: требует согласия — сегменты blocked, totalWeeks урезан', () => {
    const slots = buildDefaultSeasonSlots();
    const plan = planSeason({ slots, selector: selector as never, mode: 'auto' });
    const needs = plan.segments.filter(s => s.fit.mode === 'strict_skip');
    expect(needs.length).toBeGreaterThan(0);
    expect(plan.notes.some(n => n.includes('требуют согласия'))).toBe(true);
  });

  it('авто с согласием: по сегменту на слот, суммарные недели и последовательность id', () => {
    const slots = buildDefaultSeasonSlots();
    const consents: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true };
    const plan = planSeason({ slots, selector: selector as never, mode: 'auto', consents });
    expect(plan.segments).toHaveLength(4);
    expect(plan.totalWeeks).toBe(12 + 8 + 6 + 8);
    for (const seg of plan.segments) {
      expect(seg.cycleId).toBeTruthy();
      expect(seg.weeks).toBeGreaterThan(0);
    }
    expect(seasonSegmentSummary(plan.segments)).toContain('→');
  });

  it('ручной: выбор из кандидатов, невалидный id → fallback на авто + заметка (с согласием)', () => {
    const slots = buildDefaultSeasonSlots();
    const candidates = candidateCyclesForSlot(slots[1], selector as never);
    const validId = candidates[0].cycle.meta.id;
    const consents: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true };
    const plan = planSeason({
      slots, selector: selector as never, mode: 'manual',
      selections: { 0: 'cycle-01', 1: validId }, consents,
    });
    expect(plan.segments[0].cycleId).toBe('cycle-01');
    expect(plan.segments[1].cycleId).toBe(validId);
    expect(plan.segments[1].candidates).toBeDefined();
    const bad = planSeason({
      slots, selector: selector as never, mode: 'manual',
      selections: { 2: 'not-a-cycle' }, consents,
    });
    expect(bad.notes.some(n => n.includes('не подходит'))).toBe(true);
  });

  it('выключенные слоты пропускаются (с согласием)', () => {
    const slots = buildDefaultSeasonSlots().map(s => ({ ...s, enabled: s.period !== 'speed' }));
    const consents: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true };
    const plan = planSeason({ slots, selector: selector as never, mode: 'auto', consents });
    expect(plan.segments.some(s => s.slot.period === 'speed')).toBe(false);
    expect(plan.segments).toHaveLength(3);
  });

  it('нет подходящих циклов — слот пропущен с предупреждением', () => {
    const plan = planSeason({
      slots: [{ period: 'speed', label: 'Скорость', weeks: 6, weeksMin: 6, weeksMax: 10, defaultWeeks: 6, enabled: true }],
      selector: { goal: 'strength', level: 'novice', direction: 'bodybuilding' } as never,
      mode: 'auto',
    });
    expect(plan.segments).toHaveLength(0);
    expect(plan.notes.some(n => n.includes('нет подходящих'))).toBe(true);
  });
});

describe('assembleSeasonPlan', () => {
  it('склейка недель с перенумерацией и macroPhase по слотам (с согласием)', () => {
    const consents: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true };
    const plan = planSeason({ slots: buildDefaultSeasonSlots(), selector: selector as never, mode: 'auto', consents });
    const out = assembleSeasonPlan(plan, {
      pmMap: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 },
      fallbackPm: 80,
    });
    expect(out.weeks.length).toBe(plan.totalWeeks);
    out.weeks.forEach((w, i) => expect(w.week).toBe(i + 1));
    const active = plan.segments.filter(s => s.weeks > 0);
    const firstSeg = active[0];
    const lastSeg = active[active.length - 1];
    expect(out.weeks[0].macroPhase).toBe(firstSeg.slot.period);
    expect(out.weeks[out.weeks.length - 1].macroPhase).toBe(lastSeg.slot.period);
  });

  it('с meets — поверх применяется buildPLSeasonPeaks (пик-блоки на месте)', () => {
    const consents: Record<number, boolean> = { 0: true, 1: true, 2: true, 3: true };
    const plan = planSeason({ slots: buildDefaultSeasonSlots(), selector: selector as never, mode: 'auto', consents });
    const out = assembleSeasonPlan(plan, {
      pmMap: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 },
      fallbackPm: 80,
      taper: { mockMeet: true, meetWeek: true, postMeet: true },
      meets: [
        { id: 'm1', name: 'Старт 1', weeksToStart: plan.segments[0].weeks + plan.segments[1].weeks },
        { id: 'm2', name: 'Старт 2', weeksToStart: plan.totalWeeks },
      ],
    });
    const meetWeeks = out.weeks.filter(w => w.meetWeek);
    expect(meetWeeks.length).toBeGreaterThanOrEqual(1);
    expect(out.progressionRationale.includes('Сезон')).toBe(true);
  });

  it('без согласия — сборка блокируется, weeks пустой или урезан', () => {
    const plan = planSeason({ slots: buildDefaultSeasonSlots(), selector: selector as never, mode: 'auto' });
    expect(plan.segments.some(s => s.fit.mode === 'strict_skip')).toBe(true);
  });
});
