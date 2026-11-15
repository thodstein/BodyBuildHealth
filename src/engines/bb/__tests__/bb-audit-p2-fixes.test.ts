/**
 * bb-audit-p2-fixes.test.ts — регрессы на P2-находки аудитов 2026-11.
 *
 * Покрыто:
 * - P2-6: `buildBBQualityReport` / `calculatePlanSafetyScore` / `analyzePlanStress`
 *   не падают TypeError'ом на плане без `weeks` (импорт/частичный снапшот);
 * - P2-5: пустой `weeklyVolume` больше не печатает «-Infinity» в сообщении
 *   `target_volume_deficit`.
 * - P2-1: головки дельт (`delt_*`) делят общий лимит упражнений «плечи».
 * - P2-2: добивка дельт в финализаторе расходует место и по УПРАЖНЕНИЯМ, а не
 *   только по сетам (иначе `session_exercise_cap`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBQualityReport } from '../bb-quality-report.engine';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import { analyzePlanStress } from '../bb-injury-prevention.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { capExercisesPerMuscle } from '../bb-session-order.engine';

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

describe('P2-1: головки дельт делят общий лимит «плечи»', () => {
  const ex = (muscle: string, name: string, weight: number) => ({
    muscle, name, exerciseName: name, role: 'accessory' as const, character: 'памп' as const,
    sets: 3, repsRange: [12, 15] as [number, number], rir: 2,
    workSets: [{ reps: 12, rir: 2, weight }],
  } as any);

  it('шесть упражнений на дельты (2 головки × 2 + 2 «плечи») срезаются до общего капа', () => {
    const list = [
      ex('shoulders', 'Жим гантелей сидя', 20),
      ex('shoulders', 'Разводка в тренажёре', 15),
      ex('delt_mid', 'Махи гантелей в стороны', 10),
      ex('delt_mid', 'Махи в кроссовере', 8),
      ex('delt_rear', 'Обратные разведения', 6),
      ex('delt_rear', 'Face pull', 5),
    ];
    const kept = capExercisesPerMuscle(list);
    const deltFamily = kept.filter((e: any) => /^delt_|^shoulders$/.test(String(e.muscle)));
    expect(deltFamily.length).toBeLessThanOrEqual(4);
  });

  it('свой лимит на головку сохранён (не больше 2 на delt_mid)', () => {
    const list = [
      ex('delt_mid', 'Махи 1', 10), ex('delt_mid', 'Махи 2', 9), ex('delt_mid', 'Махи 3', 8),
    ];
    const kept = capExercisesPerMuscle(list);
    expect(kept.filter((e: any) => e.muscle === 'delt_mid')).toHaveLength(2);
  });
});

describe('P2-2: добивка дельт не выходит за лимит упражнений в сессии', () => {
  it('второе упражнение (задняя дельта) проверяет и расходует roomEx', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
    // Ищем ровно тот блок: после push идут убывания roomSets/roomEx, а второе
    // добавление требует roomEx >= 1.
    expect(src).toMatch(/roomSets -= sideSets;\s*\n\s*roomEx -= 1;/);
    expect(src).toMatch(/roomEx >= 1 && roomSets >= 2/);
  });
});
