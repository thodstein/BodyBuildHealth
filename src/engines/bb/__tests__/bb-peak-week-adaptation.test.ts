/**
 * bb-peak-week-adaptation.test.ts — P1-1: динамическая коррекция пик-недели по чек-инам.
 */
import { describe, it, expect } from 'vitest';
import { adaptPeakWeekByCheckin, peakWeekAdherence, type PeakDayEntry } from '../bb-peak-pro.engine';
import type { PeakWeekDayPlan } from '../bb-contest-prep.engine';

function makePlan(): PeakWeekDayPlan[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    phase: (i < 3 ? 'deplete_1' : i < 6 ? 'load_1' : 'show') as PeakWeekDayPlan['phase'],
    phaseLabel: `Day ${i + 1}`,
    kcal: 2000,
    proteinG: 180,
    carbsG: 300,
    fatG: 60,
    fiberMaxG: 12,
    waterLiters: 3,
    sodiumMg: 2800,
    potassiumMg: 3500,
    training: { type: 'rest', minutes: 0, details: [] },
    cardioSteps: 0,
    posingMinutes: 0,
    sleepHours: 8,
    supplementNotes: [],
    mealNotes: [],
  }));
}

describe('adaptPeakWeekByCheckin', () => {
  it('без данных → нулевые дельты', () => {
    const r = adaptPeakWeekByCheckin([], makePlan());
    expect(r.waterDeltaL).toBe(0);
    expect(r.sodiumDeltaMg).toBe(0);
    expect(r.carbsDeltaG).toBe(0);
    expect(r.urgency).toBe('none');
  });

  it('визуал flat 2 дня → +0.3л воды', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', visual: 'flat', at: new Date().toISOString() },
      { date: '2026-11-02', visual: 'flat', at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.waterDeltaL).toBeGreaterThanOrEqual(0.3);
    expect(r.urgency).toBe('medium');
    expect(r.reasons.some(r => r.includes('плоско'))).toBe(true);
  });

  it('визуал spill 2 дня → −0.3л воды, −500мг Na', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', visual: 'spill', at: new Date().toISOString() },
      { date: '2026-11-02', visual: 'spill', at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.waterDeltaL).toBeLessThanOrEqual(-0.3);
    expect(r.sodiumDeltaMg).toBeLessThanOrEqual(-500);
  });

  it('просадка веса → +0.2л воды, +30г углеводов', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', weightKg: 80, at: new Date().toISOString() },
      { date: '2026-11-02', weightKg: 79, at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.waterDeltaL).toBeGreaterThanOrEqual(0.2);
    expect(r.carbsDeltaG).toBeGreaterThanOrEqual(30);
  });

  it('набор веса → −0.2л воды', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', weightKg: 80, at: new Date().toISOString() },
      { date: '2026-11-02', weightKg: 81, at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.waterDeltaL).toBeLessThanOrEqual(-0.2);
  });

  it('низкий адгеренс воды → +0.2л', () => {
    const plan = makePlan();
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', waterLiters: 1.5, at: new Date().toISOString() },
      { date: '2026-11-02', waterLiters: 1.8, at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, plan);
    expect(r.waterDeltaL).toBeGreaterThanOrEqual(0.2);
  });

  it('комбо: flat + просадка веса → urgency high', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', visual: 'flat', weightKg: 80, at: new Date().toISOString() },
      { date: '2026-11-02', visual: 'flat', weightKg: 79, at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.urgency).toBe('high');
  });

  it('стабильный тренд → нулевые дельты', () => {
    const entries: PeakDayEntry[] = [
      { date: '2026-11-01', visual: 'ontrack', weightKg: 80, at: new Date().toISOString() },
      { date: '2026-11-02', visual: 'ontrack', weightKg: 80.1, at: new Date().toISOString() },
    ];
    const r = adaptPeakWeekByCheckin(entries, makePlan());
    expect(r.waterDeltaL).toBe(0);
    expect(r.sodiumDeltaMg).toBe(0);
    expect(r.carbsDeltaG).toBe(0);
  });
});
