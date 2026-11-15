/**
 * bb-audit-p2-fixes.test.ts — регрессы на P2-находки аудитов 2026-11.
 *
 * Покрыто:
 * - P2-6: `buildBBQualityReport` / `calculatePlanSafetyScore` / `analyzePlanStress`
 *   не падают TypeError'ом на плане без `weeks` (импорт/частичный снапшот);
 * - P2-5: пустой `weeklyVolume` больше не печатает «-Infinity» в сообщении
 *   `target_volume_deficit`.
 */
import { describe, it, expect } from 'vitest';
import { buildBBQualityReport } from '../bb-quality-report.engine';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import { analyzePlanStress } from '../bb-injury-prevention.engine';
import { validateBBPlan } from '../bb-validator.engine';

describe('P2-6: отчёт качества переживает план без weeks', () => {
  it('buildBBQualityReport({}) не бросает и даёт числовой скор', () => {
    expect(() => buildBBQualityReport({} as any, {})).not.toThrow();
    const report = buildBBQualityReport({} as any, {});
    expect(Number.isFinite(report.score)).toBe(true);
    expect(['ok', 'caution', 'danger']).toContain(report.riskLevel);
  });

  it('неделя без sessions не роняет отчёт', () => {
    const plan: any = { weeks: [{ week: 1 }], validation: { valid: true, issues: [] } };
    expect(() => buildBBQualityReport(plan, {})).not.toThrow();
    expect(Number.isFinite(buildBBQualityReport(plan, {}).score)).toBe(true);
  });

  it('сессия без exercises не роняет safety-скор и анализ стресса', () => {
    const plan: any = { weeks: [{ week: 1, sessions: [{ day: 1 }] }] };
    expect(() => calculatePlanSafetyScore(plan)).not.toThrow();
    expect(() => analyzePlanStress(plan)).not.toThrow();
    expect(Number.isFinite(calculatePlanSafetyScore(plan).score)).toBe(true);
  });
});

describe('P2-5: пустой weeklyVolume не даёт «-Infinity» в тексте валидатора', () => {
  it('сообщение target_volume_deficit остаётся читаемым', () => {
    const plan: any = {
      weeks: [{ week: 1, sessions: [{ day: 1, exercises: [{ muscle: 'forearms', name: 'Сгибание запястий', sets: 3, rir: 2 }] }] }],
      volumeTargets: {
        forearms: { muscle: 'forearms', frequency: 2, mev: 6, mav: 10, mrv: 14, targetSets: 6, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
      },
      weeklyVolume: {},
    };
    const result = validateBBPlan(plan, { level: 'intermediate' });
    const deficit = result.issues.filter(i => i.code === 'target_volume_deficit');
    expect(deficit.length).toBeGreaterThan(0);
    for (const issue of deficit) {
      expect(issue.message).not.toMatch(/Infinity|NaN/);
    }
  });
});
