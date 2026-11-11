/**
 * plan-dose-units.test.ts — гард «единица плана = натуральная единица».
 *
 * Аудит 2026-11: `PlanSubstance.doseMg` и `PlanResult.dosages[id].mg` читаются
 * UI/шерингом через `formatDefaultDose` (мкг/МЕ). Но фолбэк на дозу каталога
 * клал туда МИЛЛИГРАММЫ — биотин «5 мг» подписывался как «5 мкг» (1000× ниже),
 * а сравнение с фактическим приёмом (`support-genetics-diet`) считало
 * 100 мкг принятыми при 5000 мкг в плане.
 */
import { describe, it, expect } from 'vitest';
import { buildSubstances } from '../substances';
import { buildSchedule } from '../substances';
import type { CalculatorResult } from '../types';

const tzStub = {} as CalculatorResult;

describe('buildSubstances: доза в натуральной единице (не мг каталога)', () => {
  it('биотин: 5 мг каталога → 5000 мкг (не «5 мкг»)', () => {
    const [s] = buildSubstances(['biotin'], tzStub);
    expect(s.doseMg).toBe(5000);
    expect(s.doseDisplay).toBe('5000 мкг');
  });

  it('йод: 0.15 мг каталога → 150 мкг', () => {
    const [s] = buildSubstances(['iodine'], tzStub);
    expect(s.doseMg).toBe(150);
    expect(s.doseDisplay).toBe('150 мкг');
  });

  it('BPC-157: 0.25 мг каталога → 250 мкг', () => {
    const [s] = buildSubstances(['bpc157'], tzStub);
    expect(s.doseMg).toBe(250);
    expect(s.doseDisplay).toBe('250 мкг');
  });

  it('мг-вещества не меняются (витамин B3 500 мг)', () => {
    const [s] = buildSubstances(['vitamin_b3'], tzStub);
    expect(s.doseMg).toBe(500);
    expect(s.doseDisplay).toBe('500 мг');
  });

  it('крупные мг показываются в граммах (бетаин 3000 мг → 3 г)', () => {
    const [s] = buildSubstances(['betaine'], tzStub);
    expect(s.doseMg).toBe(3000);
    expect(s.doseDisplay).toBe('3 г');
  });

  it('DEFAULT_DOSAGES приоритетнее каталога (D3 5000 МЕ)', () => {
    const [s] = buildSubstances(['vitamin_d3'], tzStub);
    expect(s.doseMg).toBe(5000);
    expect(s.doseDisplay).toBe('5000 МЕ');
  });

  it('schedule подписывает те же единицы, что и карточка', () => {
    const schedule = buildSchedule(['biotin', 'iodine']);
    const all = schedule.flatMap(b => b.substances);
    expect(all.find(x => x.id === 'biotin')?.dose).toBe('5000 мкг');
    expect(all.find(x => x.id === 'iodine')?.dose).toBe('150 мкг');
  });
});
