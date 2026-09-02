import { describe, it, expect } from 'vitest';
import { cyclePhaseForDay, cycleVolumeFactor, cyclePhaseLabel } from '../bb-cycle.engine';

describe('bb-cycle', () => {
  it('cyclePhaseForDay по дню цикла (28)', () => {
    expect(cyclePhaseForDay(1)).toBe('menstrual');
    expect(cyclePhaseForDay(7)).toBe('follicular');
    expect(cyclePhaseForDay(14)).toBe('ovulatory');
    expect(cyclePhaseForDay(21)).toBe('luteal');
    expect(cyclePhaseForDay(28)).toBe('luteal');
  });

  it('cycleVolumeFactor: ×0.95 в лютеиновую для женщины, ×1.0 иначе', () => {
    expect(cycleVolumeFactor(21, 28, 'female')).toBe(0.95);
    expect(cycleVolumeFactor(7, 28, 'female')).toBe(1.0);
    expect(cycleVolumeFactor(21, 28, 'male')).toBe(1.0);
    expect(cycleVolumeFactor(undefined, 28, 'female')).toBe(1.0);
  });

  it('cyclePhaseLabel', () => {
    expect(cyclePhaseLabel('luteal')).toBe('Лютеиновая');
  });
});
