/**
 * prep-phase-nutrition.engine.test.ts — тесты prep-интеграции (доп. 7).
 *
 * - подготовка: белок 2.2, сниженные углеводы, без манипуляций;
 * - пик-неделя без подтверждения → предупреждение, вода/натрий стабильны;
 * - пик-неделя с подтверждением → модулируются;
 * - женская подготовка: жиры ≥ 0.8 г/кг.
 */
import { describe, it, expect } from 'vitest';
import { assessPrepPhaseNutrition } from '../prep-phase-nutrition.engine';

describe('assessPrepPhaseNutrition (доп. 7)', () => {
  it('подготовка: белок 2.2, сниженные углеводы, стабильные вода/натрий', () => {
    const r = assessPrepPhaseNutrition({ phase: 'preparation', weightKg: 80, sex: 'male' });
    expect(r.proteinGPerKg).toBe(2.2);
    expect(r.carbMode).toBe('lower');
    expect(r.sodium).toBe('stable');
    expect(r.warnings).toHaveLength(0);
  });

  it('пик-неделя без подтверждения → предупреждение, стабильные вода/натрий', () => {
    const r = assessPrepPhaseNutrition({ phase: 'peak_week', weightKg: 80, sex: 'male', manualManipulationConfirmed: false });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.sodium).toBe('stable');
    expect(r.water).toBe('stable');
  });

  it('пик-неделя с подтверждением → модулируются', () => {
    const r = assessPrepPhaseNutrition({ phase: 'peak_week', weightKg: 80, sex: 'male', manualManipulationConfirmed: true });
    expect(r.sodium).toBe('modulated');
    expect(r.water).toBe('modulated');
  });

  it('женская подготовка: жиры ≥ 0.8 г/кг', () => {
    const r = assessPrepPhaseNutrition({ phase: 'preparation', weightKg: 60, sex: 'female' });
    expect(r.fatFloorGPerKg).toBe(0.8);
  });
});
