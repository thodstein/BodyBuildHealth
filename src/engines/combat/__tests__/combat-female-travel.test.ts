import { describe, it, expect } from 'vitest';
import { buildCombatPlan, validateCombatPlan } from '../combat-builder.engine';
import {
  femaleCutTempoDefault,
  femaleCombatNotes,
  HOTEL_POOL,
  travelPoolFilter,
  travelVolumeMult,
  travelTaperNote,
} from '../combat-female-travel.engine';

/**
 * combat-female-travel (P5): женские нормы + RED-S + travel-режим.
 * Без travel/женских входов — поведение 1-в-1 (дефолт муж/дома, как раньше).
 */
describe('combat female/travel engine', () => {
  it('темп сгонки: Ж 0.4, М 0.5', () => {
    expect(femaleCutTempoDefault('female')).toBe(0.4);
    expect(femaleCutTempoDefault('male')).toBe(0.5);
    expect(femaleCutTempoDefault(null)).toBe(0.5);
  });

  it('femaleCombatNotes: мужчинам — пусто; женщинам — железо/кальций/RED-S; лютеиновая/сгонка — доп. строки', () => {
    expect(femaleCombatNotes({ sex: 'male' })).toEqual([]);
    const base = femaleCombatNotes({ sex: 'female' });
    expect(base.some(n => n.includes('Железо'))).toBe(true);
    expect(base.some(n => n.includes('1400'))).toBe(true);
    expect(base.some(n => n.includes('Лютеиновая'))).toBe(false);
    const lut = femaleCombatNotes({ sex: 'female', lutealPhase: true });
    expect(lut.some(n => n.includes('+0.5–1 кг'))).toBe(true);
    const cut = femaleCombatNotes({ sex: 'female', weightCutKg: 4 });
    expect(cut.some(n => n.includes('0.4%/нед'))).toBe(true);
  });

  it('hotel-пул: только свой вес; чужое режется; пусто → deadbug/side_plank', () => {
    expect(HOTEL_POOL).toContain('deadbug');
    expect(HOTEL_POOL).not.toContain('bench_bar');
    const filtered = travelPoolFilter(['bench_bar', 'deadbug', 'squat', 'side_plank'], 'hotel');
    expect(filtered).toEqual(['deadbug', 'side_plank']);
    expect(travelPoolFilter(['bench_bar'], 'hotel')).toEqual(['deadbug', 'side_plank']);
    expect(travelPoolFilter(['bench_bar', 'squat'], 'off')).toEqual(['bench_bar', 'squat']);
    expect(travelVolumeMult('hotel')).toBe(0.9);
    expect(travelVolumeMult('off')).toBe(1);
    expect(travelTaperNote('hotel', true)).toContain('2–3 дня');
    expect(travelTaperNote('hotel', false)).toContain('×0.9');
    expect(travelTaperNote('off', true)).toBeNull();
  });
});

describe('combat P5 builder wiring', () => {
  it('отель: штанги нет в плане, объём ≤0.9× домашнего, warning есть', () => {
    const home = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    const hotel = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, travelMode: 'hotel' } as any);
    const hotelIds = hotel.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id)));
    expect(hotelIds).not.toContain('bench_bar');
    expect(hotelIds).not.toContain('squat');
    const homeSets = home.weeksData[0].totalSets || 0;
    const hotelSets = hotel.weeksData[0].totalSets || 0;
    expect(hotelSets).toBeLessThanOrEqual(Math.ceil(homeSets * 0.9));
    expect(validateCombatPlan(hotel).warnings.some(w => w.includes('Отель'))).toBe(true);
    expect(hotel.rationale.some((r: string) => r.includes('×0.9'))).toBe(true);
  });

  it('отель + same-day — error; отель + day-before — тихо', () => {
    const bad = buildCombatPlan({
      discipline: 'wrestling', goal: 'weight_cut', level: 'intermediate', weeks: 4, daysPerWeek: 3,
      travelMode: 'hotel', weightCutKg: 2,
      weightCutProtocol: { targetLossKg: 2, weeksOut: 6, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable', weighInType: 'same_day_2h' } as any,
    } as any);
    expect(validateCombatPlan(bad).errors.some(e => e.includes('не совмещать'))).toBe(true);
    const ok = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 4, daysPerWeek: 3,
      travelMode: 'hotel', weightCutKg: 2,
      weightCutProtocol: { targetLossKg: 2, weeksOut: 6, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable', weighInType: 'day_before_24h' } as any,
    } as any);
    expect(validateCombatPlan(ok).errors.some(e => e.includes('не совмещать'))).toBe(false);
  });

  it('лютеиновая: warning + ноты в rationale; без флага — тихо', () => {
    const lut = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, sex: 'female', lutealPhase: true } as any);
    expect(validateCombatPlan(lut).warnings.some(w => w.includes('Лютеиновая'))).toBe(true);
    expect(lut.rationale.some((r: string) => r.includes('Лютеиновая') || r.includes('лютеиновая'))).toBe(true);
    const plain = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, sex: 'male' } as any);
    expect(plain.rationale.some((r: string) => r.includes('Железо'))).toBe(false);
  });

  it('женские ноты в rationale при female', () => {
    const plan = buildCombatPlan({ discipline: 'boxing', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, sex: 'female' } as any);
    expect(plan.rationale.some((r: string) => r.includes('Железо'))).toBe(true);
    expect(plan.rationale.some((r: string) => r.includes('1400'))).toBe(true);
  });
});
