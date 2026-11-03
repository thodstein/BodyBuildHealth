/**
 * Итерация L: `expandedSummary` (из него печатается «Итого: N рабочих сетов/нед»
 * и сеты по мышцам) должен описывать ИТОГОВЫЙ план, а не версию до финализации.
 *
 * До правки сводка собиралась в билдере до MRV-трима/сессионных капов/топ-апов.
 * Замер на матрице 512 планов: 508 расхождений, максимум 82 сета
 * (`fullbody_3`/новичок/слабая грудь: в отчёте «70», по факту 93).
 */
import { buildBBPlan } from '../bb-builder.engine';
import { buildBBExpandedSummary } from '../bb-summary.engine';
import { buildBBPlanReportText } from '../bb-report.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('bb-expanded-summary = факт плана', () => {
  it('сводка совпадает с пересчётом по итоговому плану (матрица)', () => {
    const splits = SPLIT_PATTERNS.filter((s) => ['fullbody_3', 'upper_lower_4', 'ppl_6'].includes(s.id));
    const variants: Array<{ tag: string; extra: any }> = [
      { tag: 'base', extra: {} },
      { tag: 'weak-chest', extra: { weakPoints: ['chest_upper'] } },
      { tag: 'rehab', extra: { rehabMuscles: ['shoulders'] } },
      { tag: 'dumbbell', extra: { equipment: ['dumbbell', 'bodyweight'] } },
    ];
    let checked = 0;
    for (const split of splits) {
      for (const level of ['beginner', 'advanced'] as const) {
        for (const goal of ['mass', 'cut'] as const) {
          for (const v of variants) {
            const plan: any = buildBBPlan({ patternId: split.id, level, goal, weeks: 2, workMax: WM, ...v.extra });
            const fresh = buildBBExpandedSummary(plan);
            const where = `${split.id}/${level}/${goal}/${v.tag}`;
            expect(plan.expandedSummary, `${where}: сводки нет`).toBeDefined();
            expect(plan.expandedSummary.totalWorkingSets, `${where}: итог сетов`).toBe(fresh.totalWorkingSets);
            for (const [m, row] of Object.entries(fresh.byMuscle)) {
              expect(plan.expandedSummary.byMuscle?.[m]?.workingSets, `${where}: ${m}`).toBe(row.workingSets);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(splits.length * 2 * 2 * variants.length);
  }, 600000);

  it('в печатном отчёте «Итого … рабочих сетов/нед» = фактическая сумма', () => {
    for (const v of [{}, { weakPoints: ['chest_upper'] }]) {
      const plan: any = buildBBPlan({ patternId: 'fullbody_3', level: 'beginner', goal: 'mass', weeks: 1, workMax: WM, ...v });
      const text = buildBBPlanReportText(plan);
      const m = text.match(/Итого:\s*(\d+)\s*рабочих сетов\/нед/);
      expect(m, 'в отчёте нет строки итога').toBeTruthy();
      // Рабочие сеты: активаторы/разминочные в сводке учитываются отдельно
      // (warmupSets), поэтому из суммы факта их исключаем.
      const actual = (plan.weeks || []).flatMap((w: any) => w.sessions || [])
        .flatMap((s: any) => s.exercises || [])
        .filter((ex: any) => !ex.warmupActivator)
        .reduce((sum: number, ex: any) => sum + (ex.sets || 0), 0);
      expect(Number(m![1])).toBe(actual);
    }
  });

  it('сводка не «залипает» при повторной сборке (идемпотентность пересчёта)', () => {
    const plan: any = buildBBPlan({ patternId: 'ppl_6', level: 'advanced', goal: 'mass', weeks: 2, workMax: WM });
    const first = plan.expandedSummary.totalWorkingSets;
    plan.expandedSummary = buildBBExpandedSummary(plan);
    expect(plan.expandedSummary.totalWorkingSets).toBe(first);
  });
});
