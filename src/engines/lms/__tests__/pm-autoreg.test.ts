import { describe, it, expect } from 'vitest';
import type { WorkoutLog } from '../../core/types';
import { autoWeeklyPercent, pmDiaryMultiplier, type PMAutoRegMode } from '../pm-autoreg.engine';
import { buildLMSPlan, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const tpl = CYCLE_01;
const basePm = { 'Присед': 120, 'Жим лежа': 100, 'Становая тяга': 140 };

function build(mode: PMAutoRegMode, diaryMultiplier?: Record<string, number>): LMSBuildOutput {
  return buildLMSPlan({
    template: tpl, pmMap: { ...basePm }, fallbackPm: 80, mode: 'natural',
    weeksOverride: 8, progressionEnabled: true, faithful: true,
    pmAutoReg: mode === 'off' ? undefined : { mode, diaryMultiplier },
  });
}

function lastWeekPm(out: LMSBuildOutput, exName: string): number {
  const wk = out.weeks[out.weeks.length - 1];
  return wk.days[0].exercises.find(e => e.name === exName)?.pm ?? 0;
}

const makeLog = (name: string, weight: number, reps: number, e1?: number): WorkoutLog => ({
  date: '2026-08-01',
  exercises: [{ exerciseName: name, weight, reps, sets: [{ weight, reps }], ...(e1 != null ? { estimated1RM: e1 } : {}) }],
});

describe('autoWeeklyPercent — АВТО', () => {
  it('natural дефолт +0.5%', () => expect(autoWeeklyPercent({ mode: 'natural' })).toBe(0.005));
  it('levelK: beginner/intermediate/advanced', () => {
    expect(autoWeeklyPercent({ mode: 'natural', level: 'beginner' })).toBe(0.015);
    expect(autoWeeklyPercent({ mode: 'natural', level: 'intermediate' })).toBe(0.008);
    expect(autoWeeklyPercent({ mode: 'natural', level: 'advanced' })).toBe(0.005);
  });
  it('on_course курсовая кривая', () => {
    expect(autoWeeklyPercent({ mode: 'on_course', courseIntensity: 'mild' })).toBe(0.015);
    expect(autoWeeklyPercent({ mode: 'on_course', courseIntensity: 'moderate' })).toBe(0.02);
    expect(autoWeeklyPercent({ mode: 'on_course', courseIntensity: 'heavy' })).toBe(0.025);
  });
  it('pct нисходящая', () => expect(autoWeeklyPercent({ mode: 'pct' })).toBe(-0.005));
  it('явный weeklyPercent приоритетен', () => expect(autoWeeklyPercent({ mode: 'natural', weeklyPercent: 0.02 })).toBe(0.02));
});

describe('pmDiaryMultiplier — ДНЕВНИК', () => {
  it('нет данных → ×1, noData', () => {
    const r = pmDiaryMultiplier({ historyWorkouts: [], pm0Map: { 'Присед': 120 } });
    expect(r.multiplier['Присед']).toBe(1); expect(r.noData).toBe(1); expect(r.adjusted).toBe(0);
  });
  it('обгон e1RM > ПМ → ×1.05', () => {
    const r = pmDiaryMultiplier({ historyWorkouts: [makeLog('Присед', 125, 5, 145)], pm0Map: { 'Присед': 120 } });
    expect(r.multiplier['Присед']).toBe(1.05); expect(r.adjusted).toBe(1);
  });
  it('отставание e1RM < ПМ → ×0.95', () => {
    const r = pmDiaryMultiplier({ historyWorkouts: [makeLog('Присед', 100, 5, 115)], pm0Map: { 'Присед': 120 } });
    expect(r.multiplier['Присед']).toBe(0.95); expect(r.adjusted).toBe(1);
  });
  it('в норме ±3% → ×1', () => {
    const r = pmDiaryMultiplier({ historyWorkouts: [makeLog('Присед', 105, 5, 121)], pm0Map: { 'Присед': 120 } });
    expect(r.multiplier['Присед']).toBe(1);
  });
});

describe('buildLMSPlan — интеграция pmAutoReg', () => {
  it('off: ПМ растёт по фикс. % цикла', () => {
    const out = build('off');
    const pm1 = out.weeks[0].days[0].exercises.find(e => e.name === 'Присед')!.pm;
    expect(lastWeekPm(out, 'Присед')).toBeGreaterThan(pm1);
  });
  it('diary ×1.05 → ПМ выше off; ×0.95 → ниже', () => {
    const off = build('off');
    const up = build('diary', { 'Присед': 1.05, 'Жим лежа': 1, 'Становая тяга': 1 });
    const down = build('diary', { 'Присед': 0.95, 'Жим лежа': 1, 'Становая тяга': 1 });
    const pmOff = lastWeekPm(off, 'Присед');
    expect(lastWeekPm(up, 'Присед')).toBeCloseTo(pmOff * 1.05, 6);
    expect(lastWeekPm(down, 'Присед')).toBeCloseTo(pmOff * 0.95, 6);
  });
  it('diary без множителя → как off', () => {
    expect(lastWeekPm(build('diary', {}), 'Присед')).toBe(lastWeekPm(build('off'), 'Присед'));
  });
  it('rationale содержит отметку авторегуляции ПМ', () => {
    expect(build('auto').progressionRationale).toContain('Авторегуляция ПМ');
    expect(build('diary', { 'Присед': 1.05 }).progressionRationale).toContain('Авторегуляция ПМ');
  });
});