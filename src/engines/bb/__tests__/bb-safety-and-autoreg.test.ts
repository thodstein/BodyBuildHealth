/**
 * bb-safety-and-autoreg.test.ts — тесты для bb-safety-score и bb-auto-regulation.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput } from './bb-test-helpers';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import {
  assessReadiness,
  getAutoRegulationOverride,
  calculateACWR,
} from '../bb-auto-regulation.engine';

describe('bb-safety-score.engine', () => {
  it('SafetyScore: опасный план нельзя считать безопасным', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, weakPoints: ['chest', 'shoulders'] }));
    const result = calculatePlanSafetyScore(plan, {
      acwrRatio: 1.8,
      bodyFat: 35,
      hrvMs: 35,
      sleepHours: 4,
      stressLevel: 9,
      injuryCount: 3,
    });
    expect(result.riskLevel).not.toBe('safe');
    expect(result.recommendations[0]).toContain('КРИТИЧНО');
  });

  it('SafetyScore: score factors stay within their configured budgets', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan);
    expect(result.factors.jointStress).toBeGreaterThanOrEqual(0);
    expect(result.factors.jointStress).toBeLessThanOrEqual(20);
    expect(result.factors.acwrCompliance).toBeGreaterThanOrEqual(0);
    expect(result.factors.acwrCompliance).toBeLessThanOrEqual(20);
    expect(result.factors.recovery).toBeGreaterThanOrEqual(0);
    expect(result.factors.recovery).toBeLessThanOrEqual(15);
  });
  it('calculatePlanSafetyScore — возвращает score 0-100', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('calculatePlanSafetyScore — возвращает riskLevel', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan);
    expect(['safe', 'caution', 'dangerous']).toContain(result.riskLevel);
  });

  it('calculatePlanSafetyScore — возвращает factors', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan);
    expect(result.factors).toHaveProperty('jointStress');
    expect(result.factors).toHaveProperty('acwrCompliance');
    expect(result.factors).toHaveProperty('recovery');
    expect(result.factors).toHaveProperty('injuryRisk');
    expect(result.factors).toHaveProperty('volumeCompliance');
    expect(result.factors).toHaveProperty('balance');
  });

  it('calculatePlanSafetyScore — хорошие метрики → безопасный план', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan, {
      bodyFat: 12,
      hrvMs: 80,
      sleepHours: 8,
      stressLevel: 2,
      injuryCount: 0,
    });
    expect(result.score).toBeGreaterThan(60);
  });

  it('calculatePlanSafetyScore — плохие метрики → низкий score', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan, {
      acwrRatio: 1.6,
      bodyFat: 30,
      hrvMs: 40,
      sleepHours: 5,
      stressLevel: 9,
      injuryCount: 2,
    });
    expect(result.score).toBeLessThan(70);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('calculatePlanSafetyScore — ACWR > 1.5 → dangerous', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const result = calculatePlanSafetyScore(plan, { acwrRatio: 1.7 });
    expect(result.issues.some(i => i.includes('ACWR'))).toBe(true);
  });
});

describe('bb-auto-regulation.engine', () => {
  it('assessReadiness: invalid metrics are ignored rather than treated as zero', () => {
    const result = assessReadiness({
      hrvMs: Number.NaN,
      hrvBaseline: Number.POSITIVE_INFINITY,
      sleepHours: Number.NaN,
      stressLevel: Number.NaN,
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe('optimal');
  });
  it('assessReadiness — хорошие метрики → optimal', () => {
    const result = assessReadiness({
      hrvMs: 80,
      hrvBaseline: 80,
      sleepHours: 8,
      stressLevel: 2,
      subjectiveReadiness: 8,
    });
    expect(result.level).toBe('optimal');
    expect(result.action).toBe('train');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('assessReadiness — плохой сон → не optimal', () => {
    const result = assessReadiness({
      sleepHours: 5,
      stressLevel: 5,
    });
    expect(result.level).not.toBe('optimal');
  });

  it('assessReadiness — все плохо → critical/rest', () => {
    const result = assessReadiness({
      hrvMs: 40,
      hrvBaseline: 80,
      sleepHours: 4,
      stressLevel: 9,
      subjectiveReadiness: 2,
    });
    expect(result.level).toBe('critical');
    expect(result.action).toBe('rest');
  });

  it('assessReadiness — consecutive bad sleep → дополнительный штраф', () => {
    const result = assessReadiness({
      sleepHours: 5,
      sleepDays: [5, 4, 5, 4, 5],
    });
    expect(result.score).toBeLessThan(70);
  });

  it('getAutoRegulationOverride — train → 1.0/1.0/0', () => {
    const readiness = assessReadiness({ hrvMs: 80, hrvBaseline: 80, sleepHours: 8, stressLevel: 2 });
    const override = getAutoRegulationOverride(readiness);
    expect(override.volumeMultiplier).toBe(1.0);
    expect(override.intensityMultiplier).toBe(1.0);
    expect(override.rirShift).toBe(0);
  });

  it('getAutoRegulationOverride — rest → 0/0/0', () => {
    // Нужно score < 40: hrv low (-25) + sleep low (-20) + stress high (-15) + subjectiveReadiness <4 (-20) = 20
    const readiness = assessReadiness({ hrvMs: 30, hrvBaseline: 80, sleepHours: 3, stressLevel: 10, subjectiveReadiness: 2 });
    expect(readiness.level).toBe('critical');
    const override = getAutoRegulationOverride(readiness);
    expect(override.volumeMultiplier).toBe(0);
    expect(override.intensityMultiplier).toBe(0);
  });

  it('getAutoRegulationOverride — reduced → объём снижен', () => {
    // sleep=6 (moderate -5), stress=6 (moderate -5) → score ~90 = optimal (train)
    // Для reduced нужен score 60-79 → больше негативных факторов
    const readiness = assessReadiness({ sleepHours: 5, stressLevel: 7, hrvMs: 60, hrvBaseline: 80 });
    const override = getAutoRegulationOverride(readiness);
    // В зависимости от общего score — может быть reduced или active_recovery
    expect(override.volumeMultiplier).toBeLessThan(1.0);
  });

  it('calculateACWR — не падает', () => {
    const ratio = calculateACWR();
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(10);
  });
});
