/**
 * bb-audit-p2-fixes.test.ts — регрессы на P2-находки аудитов 2026-11.
 *
 * Покрыто:
 * - P2-6: `buildBBQualityReport` / `calculatePlanSafetyScore` / `analyzePlanStress`
 *   не падают TypeError'ом на плане без `weeks` (импорт/частичный снапшот);
 * - P2-5: пустой `weeklyVolume` больше не печатает «-Infinity» в сообщении
 *   `target_volume_deficit`.
 * - P2-1 (финализация): головки дельт (`delt_*`) делят общий лимит упражнений «плечи».
 * - P2-2 (финализация): добивка дельт в финализаторе расходует место и по УПРАЖНЕНИЯМ,
 *   а не только по сетам (иначе `session_exercise_cap`).
 * - P2-1 (ядро): auto-MEV-feeder не добавляет упражнения в делод/тапер-недели.
 * - P2-2 (ядро): `schemeActive` считается по `effVolumeScheme` — понижение схемы
 *   объёма до 'standard' не выключает добивку мышц дня.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBQualityReport } from '../bb-quality-report.engine';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import { analyzePlanStress } from '../bb-injury-prevention.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { capExercisesPerMuscle } from '../bb-session-order.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput } from './bb-test-helpers';

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

describe('P2-1 (финализация): головки дельт делят общий лимит «плечи»', () => {
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

describe('P2-1 (ядро): auto-MEV-feeder не добивает разгрузочные недели', () => {
  const isDeload = (w: any) => String(w?.phase || '').toLowerCase() === 'deload' || !!w?.deload;
  const feedersOf = (weeks: any[]) => weeks
    .flatMap((w: any) => w.sessions || [])
    .flatMap((s: any) => s.exercises || [])
    .filter((e: any) => /auto-mev-feeder/i.test(String(e.comment || '')));

  it('в deload-неделе нет feeder-упражнений, в рабочих неделях — есть', () => {
    const plan = buildBBPlan(makeInput({ patternId: 'bro_5', weeks: 8 })) as any;
    const deload = plan.weeks.filter(isDeload);
    const working = plan.weeks.filter((w: any) => !isDeload(w));
    expect(deload.length).toBeGreaterThan(0);
    // Гейт не отключил проход целиком: в рабочих неделях фидер остаётся.
    expect(feedersOf(working).length).toBeGreaterThan(0);
    expect(feedersOf(deload)).toHaveLength(0);
  });
});

// P2-2 (ядро): `schemeActive` должен читать ЭФФЕКТИВНУЮ схему объёма. FST-7 при
// не-enhanced уровне понижается до 'standard' — значит и добивка мышц дня
// (гарантия рук по дню) должна работать, как в обычном плане.
describe('P2-2 (ядро): понижённая схема объёма не выключает добивку мышц дня', () => {
  const shape = (plan: any) => (plan.weeks || []).map((w: any) => (w.sessions || []).map((s: any) =>
    (s.exercises || []).map((e: any) => `${e.muscle}|${e.name}|${e.sets}`)));

  it('fst7 при intermediate понижается до standard и даёт тот же состав, что явный standard', () => {
    const downgraded = buildBBPlan(makeInput({ volumeScheme: 'fst7', weeks: 4 })) as any;
    const plain = buildBBPlan(makeInput({ volumeScheme: 'standard', weeks: 4 })) as any;
    // Понижение действительно произошло — иначе тест проверял бы не то.
    expect(downgraded.volumeScheme).toBe('standard');
    expect(shape(downgraded)).toEqual(shape(plain));
  });
});
