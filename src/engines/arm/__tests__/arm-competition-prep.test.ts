import { describe, it, expect } from 'vitest';
import {
  planWeightCut,
  weeksUntilStart,
  prepPhaseForWeeksOut,
  legsAnchorBlock,
} from '../arm-competition-prep.engine';

describe('arm-competition-prep (эпик H)', () => {
  it('сгонка в плане', () => {
    const p = planWeightCut({ startKg: 86, targetKg: 85, weeksOut: 4, sex: 'male' });
    expect(p.status).toBe('on_track');
    expect(p.lossKg).toBe(1);
    expect(p.weeklyLossKg).toBe(0.25);
  });
  it('слишком быстро — предупреждение', () => {
    const p = planWeightCut({ startKg: 90, targetKg: 85, weeksOut: 2, sex: 'male' });
    expect(p.status).toBe('too_fast');
  });
  it('женский темп мягче', () => {
    const p = planWeightCut({ startKg: 70, targetKg: 65, weeksOut: 20, sex: 'female' });
    expect(p.targetRatePctPerWeek).toBe(0.4);
  });
  it('нет сгонки — no_data', () => {
    expect(planWeightCut({ startKg: 84, targetKg: 85, weeksOut: 4 }).status).toBe('no_data');
  });
  it('недели до старта и фазы', () => {
    expect(weeksUntilStart('2026-09-03', '2026-09-10')).toBe(1);
    expect(prepPhaseForWeeksOut(1)).toBe('peak');
    expect(prepPhaseForWeeksOut(3)).toBe('taper');
    expect(prepPhaseForWeeksOut(6)).toBe('strength');
    expect(prepPhaseForWeeksOut(12)).toBe('base');
  });
  it('ноги-якорь: 3 упражнения', () => {
    const b = legsAnchorBlock('intermediate');
    expect(b.length).toBe(3);
    expect(b[0].sets).toBe(4);
    expect(legsAnchorBlock('beginner')[0].sets).toBe(3);
  });
});
