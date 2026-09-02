import { describe, it, expect } from 'vitest';
import { sfrOf, resistanceProfileOf, isUnilateralExercise, exerciseQualityNote, unilateralRatioOf, sfrSelectionBonus } from '../bb-sfr-db';

describe('bb-sfr-db', () => {
  it('sfrOf по id и имени', () => {
    expect(sfrOf({ id: 'fly_cable' })).toBe(5);
    expect(sfrOf({ id: 'bench_bar' })).toBe(3);
    expect(sfrOf({ id: 'неизвестное' })).toBeNull();
    expect(sfrOf({ name: 'Разводка гантелей лёжа' })).not.toBeNull();
  });

  it('resistanceProfileOf — lengthened/short/mid', () => {
    expect(resistanceProfileOf({ id: 'rdl' })).toBe('lengthened');
    expect(resistanceProfileOf({ id: 'leg_ext' })).toBe('short');
    expect(resistanceProfileOf({ id: 'row_bar' })).toBe('mid');
    expect(resistanceProfileOf({ name: 'Румынская тяга' })).toBe('lengthened');
  });

  it('isUnilateralExercise', () => {
    expect(isUnilateralExercise({ id: 'bulgarian_split_squat' })).toBe(true);
    expect(isUnilateralExercise({ id: 'squat' })).toBe(false);
    expect(isUnilateralExercise({ name: 'Тяга гантели в наклоне одной рукой' })).toBe(true);
  });

  it('exerciseQualityNote возвращает RU-заметку', () => {
    const n = exerciseQualityNote({ id: 'rdl', muscle: 'hamstrings' }) || '';
    expect(n).toContain('SFR');
    expect(n).toContain('растянутая');
    expect(exerciseQualityNote({ id: 'unknown_ex' })).toBeNull();
  });

  it('unilateralRatioOf считает долю унилатеральных сетов', () => {
    const plan = { weeks: [
      { sessions: [{ exercises: [
        { id: 'squat', sets: 4 },
        { id: 'bulgarian_split_squat', workSets: [{}, {}] },
      ] }] },
    ] };
    // total 6, unilateral 2 → 1/3
    expect(unilateralRatioOf(plan as any)).toBeCloseTo(2 / 6);
    expect(unilateralRatioOf({ weeks: [] } as any)).toBe(0);
  });

  it('sfrSelectionBonus: высокий SFR + lengthened в intensification', () => {
    expect(sfrSelectionBonus({ id: 'fly_cable' })).toBeGreaterThanOrEqual(4);
    expect(sfrSelectionBonus({ id: 'bench_bar' })).toBe(0);
    // lengthened в intensification даёт +3 сверху SFR
    const rdl = sfrSelectionBonus({ id: 'rdl' }, 'intensification');
    expect(rdl).toBeGreaterThanOrEqual(3);
    expect(sfrSelectionBonus({ id: 'rdl' }, 'accumulation')).toBeLessThan(rdl);
  });
});
