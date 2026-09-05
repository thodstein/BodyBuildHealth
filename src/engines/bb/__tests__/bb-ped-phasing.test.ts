import { describe, expect, it } from 'vitest';
import {
  resolvePedPhase,
  describePedPhase,
  insulinSafetyCheck,
  carbsForInsulinDose,
} from '../bb-ped-phasing.engine';

describe('bb-ped-phasing: resolvePedPhase', () => {
  it('только MGF → proliferation', () => {
    expect(resolvePedPhase({ peds: ['MGF'], pedDoses: { MGF: 200 } })).toBe('proliferation');
  });

  it('только IGF1 → differentiation', () => {
    expect(resolvePedPhase({ peds: ['IGF1'], pedDoses: { IGF1: 50 } })).toBe('differentiation');
  });

  it('без MGF/IGF1 → none', () => {
    expect(resolvePedPhase({ peds: ['AAS'], pedDoses: { AAS: 500 } })).toBe('none');
    expect(resolvePedPhase({ peds: [] })).toBe('none');
  });

  it('нулевая доза = отсутствие (MGF 0 + IGF1 50 → differentiation)', () => {
    expect(resolvePedPhase({ peds: ['MGF', 'IGF1'], pedDoses: { MGF: 0, IGF1: 50 } })).toBe('differentiation');
  });

  it('оба + короткий план → чередование по чётности', () => {
    const base = { peds: ['MGF', 'IGF1'] as ('MGF' | 'IGF1')[], pedDoses: { MGF: 200, IGF1: 50 }, totalWeeks: 4 };
    expect(resolvePedPhase({ ...base, weekIdx: 1 })).toBe('proliferation');
    expect(resolvePedPhase({ ...base, weekIdx: 2 })).toBe('differentiation');
    expect(resolvePedPhase({ ...base, weekIdx: 3 })).toBe('proliferation');
  });

  it('оба + длинный план ≥8 нед → блоки (первая половина MGF)', () => {
    const base = { peds: ['MGF', 'IGF1'] as ('MGF' | 'IGF1')[], pedDoses: { MGF: 200, IGF1: 50 }, totalWeeks: 12 };
    expect(resolvePedPhase({ ...base, weekIdx: 1 })).toBe('proliferation');
    expect(resolvePedPhase({ ...base, weekIdx: 6 })).toBe('proliferation');
    expect(resolvePedPhase({ ...base, weekIdx: 7 })).toBe('differentiation');
    expect(resolvePedPhase({ ...base, weekIdx: 12 })).toBe('differentiation');
  });

  it('describePedPhase непуст для активных фаз', () => {
    expect(describePedPhase('proliferation')).toContain('MGF');
    expect(describePedPhase('differentiation')).toContain('IGF1');
    expect(describePedPhase('none')).toBe('');
  });
});

describe('bb-ped-phasing: insulin safety', () => {
  it('carbsForInsulinDose: 10 г / 1 IU', () => {
    expect(carbsForInsulinDose(10)).toBe(100);
    expect(carbsForInsulinDose(5)).toBe(50);
    expect(carbsForInsulinDose(0)).toBe(0);
  });

  it('неактивен без дозы', () => {
    const s = insulinSafetyCheck(['insulin'], { insulin: 0 });
    expect(s.active).toBe(false);
    expect(s.warnings).toHaveLength(0);
  });

  it('активен: carbs + гипо-warning', () => {
    const s = insulinSafetyCheck(['insulin', 'GH'], { insulin: 10, GH: 4 });
    expect(s.active).toBe(true);
    expect(s.requiredCarbsG).toBe(100);
    expect(s.warnings.some(w => w.includes('глюкометр'))).toBe(true);
    expect(s.soloWithoutAasGh).toBe(false);
  });

  it('соло-инсулин → warning про жир', () => {
    const s = insulinSafetyCheck(['insulin'], { insulin: 8 });
    expect(s.soloWithoutAasGh).toBe(true);
    expect(s.warnings.some(w => w.includes('соло'))).toBe(true);
  });

  it('доза ≥20 → high-dose warning', () => {
    const s = insulinSafetyCheck(['insulin', 'AAS'], { insulin: 24, AAS: 500 });
    expect(s.warnings.some(w => w.includes('Высокая доза'))).toBe(true);
  });
});
