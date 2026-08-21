import { describe, expect, it } from 'vitest';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const allNames = (plan: any): string[] => {
  const out: string[] = [];
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) out.push((e.name || '').toLowerCase());
  return out;
};

describe('BB кнопки на cycle-пути', () => {
  it('allowStrengthLifts=false исключает становую/жим стоя при адаптации цикла', () => {
    const plan = convertCycleToBBPlan({ cycle: CYCLE_01, workMax: WM, level: 'intermediate', trainingYears: 3, mode: 'adapt', allowStrengthLifts: false } as any);
    const names = allNames(plan);
    expect(names.some(n => n.includes('становая') || n.includes('армейск') || n.includes('жим стоя'))).toBe(false);
  });

  it('cycle-путь строится без кнопок без ошибок', () => {
    const plan = convertCycleToBBPlan({ cycle: CYCLE_01, workMax: WM, level: 'intermediate', trainingYears: 3, mode: 'adapt' } as any);
    expect(plan.weeks.length).toBeGreaterThan(0);
  });
});
