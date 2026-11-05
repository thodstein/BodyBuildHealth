import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { FullProgram } from '../../complete-program-library.engine';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import { aggregateBBVolume } from '../bb-volume.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { estimateBBSessionCost } from '../bb-fatigue.engine';
import { buildBBExpandedSummary } from '../bb-summary.engine';
import { analyzeBBRotation } from '../bb-rotation.engine';
import { reconcileSchemeComments } from '../bb-scheme-comment-reconcile';

/**
 * Аудит Y: цикл- и программа-пути меняют план ПОСЛЕ `finalizeBBPlan`
 * (недельный MRV-трим, срез восстановления), поэтому снимки факта
 * (`weeklyVolume`, `validation`, `fatigueReport`, `expandedSummary`, `report`)
 * должны пересобираться последними — через `refreshBBPlanSnapshots`.
 *
 * Замер до правки (adapt, 6 циклов + перегруженная программа):
 *  - `weeklyVolume`: до 68/179 ячеек расходились с фактическими сетами;
 *  - `validation`: 90 issue в плане против 51 фактического (cycle-08);
 *  - `fatigueReport`: до 30/72 сессий;
 *  - `expandedSummary` и строки «⚠ Валидация» в rationale — расходились
 *    на всех 7 сборках.
 *  - `rotationReport` (и счётчик «Ротация» в отчёте) считался до поздних
 *    замен/удалений: расходился на 17/17 собранных планов.
 */

const workMax = {
  chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140,
  hamstrings: 100, glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40,
};

function expectSnapshotsMatchFacts(plan: any, label: string) {
  expect(plan.weeks.length, label).toBeGreaterThan(0);

  for (const week of plan.weeks) {
    const actual = aggregateBBVolume(week.sessions);
    const stored = plan.weeklyVolume?.[week.week] || {};
    const muscles = new Set([...Object.keys(actual), ...Object.keys(stored)]);
    for (const m of muscles) {
      const a: any = (actual as any)[m] || { directSets: 0, effectiveSets: 0 };
      const s: any = (stored as any)[m] || { directSets: 0, effectiveSets: 0 };
      expect(
        `${s.directSets}/${s.effectiveSets}`,
        `${label} W${week.week} ${m}: weeklyVolume`,
      ).toBe(`${a.directSets}/${a.effectiveSets}`);
    }

    const storedWeek = (plan.fatigueReport || []).find((x: any) => x.week === week.week);
    expect(storedWeek, `${label} W${week.week}: fatigueReport`).toBeTruthy();
    week.sessions.forEach((session: any, i: number) => {
      expect(storedWeek.sessions[i], `${label} W${week.week} S${i + 1}: fatigue`).toEqual(
        estimateBBSessionCost(session),
      );
    });
  }

  const fresh = validateBBPlan(plan, {
    level: 'intermediate',
    maxWorkingSets: plan.maxWorkingSets,
    maxExercises: plan.maxExercises,
    checkOrder: true,
    methodology: plan.methodology,
  } as any);
  const norm = (issues: any[]) => issues
    .map(i => `${i.code}:${i.week}:${i.session}:${i.message}`)
    .sort();
  expect(norm(plan.validation?.issues || []), `${label}: validation`).toEqual(norm(fresh.issues));

  expect(plan.expandedSummary, `${label}: expandedSummary`).toEqual(buildBBExpandedSummary(plan));

  const freshRotation = analyzeBBRotation(plan);
  expect(plan.rotationReport, `${label}: rotationReport`).toEqual(freshRotation);
  expect(plan.report.rotationWarnings, `${label}: счётчик ротации в отчёте`).toBe(freshRotation.issues.length);
  const freshRotationLines = new Set(freshRotation.issues.map((i: any) => `⚠ Ротация: ${i.message}`));
  const staleRotation = ((plan.rationale || []) as string[])
    .filter(line => String(line).startsWith('⚠ Ротация:') && !freshRotationLines.has(line));
  expect(staleRotation, `${label}: rationale описывает снятую ротацию`).toEqual([]);

  const warningSet = new Set(
    ((plan.validation?.issues || []) as any[])
      .filter(i => i.level === 'warning')
      .map(i => `⚠ Валидация: ${i.message}`),
  );
  const stale = ((plan.rationale || []) as string[])
    .filter(line => String(line).startsWith('⚠ Валидация:') && !warningSet.has(line));
  expect(stale, `${label}: rationale описывает снятые предупреждения`).toEqual([]);
}

const program = (): FullProgram => {
  const day = (n: number, focus: string, exercises: string[]) => ({
    day: n, name: focus, focus, warmup: '',
    exercises: exercises.map(name => ({ name, sets: 5, reps: '8', rir: 2 })),
  });
  return {
    id: 'snapshot-facts-program', name: 'Snapshot facts program', author: 'test',
    type: 'bodybuilding', goal: 'bodybuilding', direction: 'bodybuilding',
    level: 'intermediate', durationWeeks: 3, daysPerWeek: 4, sessionTimeMin: '60',
    description: '', targetAudience: '', equipmentNeeded: [],
    weeks: [1, 2, 3].map(w => ({
      week: w, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false,
      days: [
        day(1, 'chest', ['Жим штанги лёжа', 'Жим гантелей лёжа', 'Сведение рук в кроссовере', 'Отжимания на брусьях']),
        day(2, 'back', ['Тяга штанги в наклоне', 'Тяга верхнего блока', 'Тяга гантели одной рукой', 'Пуловер']),
        day(3, 'legs', ['Присед со штангой', 'Румынская тяга', 'Разгибание ног', 'Сгибание ног']),
        day(4, 'shoulders', ['Жим штанги стоя', 'Махи гантелями в стороны', 'Разведения в наклоне', 'Шраги']),
      ],
    })),
    progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
  } as any;
};

const bbCycles = LMS_CYCLES
  .filter(c => String(c.meta.direction) === 'bodybuilding')
  .slice(0, 5);

describe('цикл/программа: снимки факта после пост-финальных срезов', () => {
  for (const cycle of bbCycles) {
    it(`цикл ${cycle.meta.id}: снимки = факт`, () => {
      const plan = convertCycleToBBPlan({
        cycle, workMax, level: 'intermediate', mode: 'adapt', sex: 'male', goal: 'mass',
      } as any);
      // Не вакуумный тест: MRV-трим цикла оставляет кап на плане.
      expect(plan.mrvByMuscle, cycle.meta.id).toBeTruthy();
      expectSnapshotsMatchFacts(plan, cycle.meta.id);
    });
  }

  it('программа с перегрузом по груди: снимки = факт', () => {
    const plan = programToBBPlan(program(), {
      workMax, level: 'intermediate', mode: 'adapt',
    } as any);
    expect(plan.weeks.length).toBeGreaterThan(0);
    expectSnapshotsMatchFacts(plan, 'program');
  });
});

describe('цикл: обещание схемы объёма = фактическим сетам', () => {
  // Замер до правки: цикл-путь не сверял комментарий после expandPlanToTargets
  // и MRV-трима — до 56 упражнений обещали «GVT 10×10» при 4 сетах в плане
  // (gironda до 52, fst7 до 8); generic и программа-путь давали 0.
  for (const scheme of ['gvt', 'gironda'] as const) {
    it(`${scheme}: комментарий схемы приведён к факту`, () => {
      let marked = 0;
      for (const cycle of bbCycles.slice(0, 3)) {
        const plan: any = convertCycleToBBPlan({
          cycle, workMax, level: 'intermediate', trainingYears: 3,
          mode: 'adapt', sex: 'male', goal: 'mass', volumeScheme: scheme,
        } as any);
        const marker = scheme === 'gvt' ? /GVT/ : /Gironda/;
        marked += plan.weeks
          .flatMap((w: any) => w.sessions)
          .flatMap((s: any) => s.exercises)
          .filter((e: any) => marker.test(String(e.comment || ''))).length;
        // Сверка идемпотентна: 0 правок = обещание уже равно факту.
        expect(reconcileSchemeComments(structuredClone(plan)).fixed, `${cycle.meta.id}/${scheme}`).toBe(0);
      }
      expect(marked, `${scheme}: схема должна назначаться`).toBeGreaterThan(0);
    });
  }
});
