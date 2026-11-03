/**
 * Итерация M: все снимки плана описывают ИТОГОВЫЙ план.
 *
 * `finalizeBBPlan` снимает weeklyVolume / validation / balanceReport /
 * fatigueReport / report в конце своего прохода (bb-finalize:5972-5985), но
 * билдер после финализатора ещё меняет план: rehab-возврат, дневниковая
 * коррекция, VBT, RIR-волна, вторая разгрузка, схемы интенсивности, BFR,
 * blast/cruise, рампа, сверка комментариев схемы.
 *
 * Замер до правки (192 плана): weeklyVolume расходился в 191/192
 * (back W1: 12.5 эффективных сетов против фактических 11.5), а в 20 планах
 * `validation` хранил ошибки, которых в итоговом плане уже нет — UI показывал
 * «план невалиден» там, где всё исправлено.
 */
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { aggregateBBVolume } from '../bb-volume.engine';
import { analyzeBBBalance } from '../bb-balance.engine';
import { estimateBBSessionCost } from '../bb-fatigue.engine';
import { buildBBPlanReport } from '../bb-report.engine';
import { buildBBExpandedSummary } from '../bb-summary.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

function matrix() {
  const splits = SPLIT_PATTERNS.filter((s) => ['fullbody_3', 'upper_lower_4', 'ppl_6'].includes(s.id));
  const variants: Array<{ tag: string; extra: any }> = [
    { tag: 'base', extra: {} },
    { tag: 'weak-chest', extra: { weakPoints: ['chest_upper'] } },
    { tag: 'dumbbell', extra: { equipment: ['dumbbell', 'bodyweight'] } },
  ];
  const plans: Array<{ where: string; plan: any }> = [];
  for (const split of splits) {
    for (const level of ['beginner', 'advanced'] as const) {
      for (const goal of ['mass', 'cut'] as const) {
        for (const v of variants) {
          const plan: any = buildBBPlan({ patternId: split.id, level, goal, weeks: 2, workMax: WM, ...v.extra });
          plans.push({ where: `${split.id}/${level}/${goal}/${v.tag}`, plan });
        }
      }
    }
  }
  return plans;
}

describe('bb: снимки плана = факт итогового плана', () => {
  const cases = matrix();

  it('weeklyVolume совпадает с пересчётом по сессиям', () => {
    for (const { where, plan } of cases) {
      expect(plan.weeklyVolume, `${where}: нет weeklyVolume`).toBeDefined();
      for (const week of plan.weeks) {
        const fresh = aggregateBBVolume(week.sessions) as any;
        const stored = plan.weeklyVolume[week.week];
        expect(stored, `${where}: нет снапшота недели ${week.week}`).toBeDefined();
        for (const m of new Set([...Object.keys(fresh), ...Object.keys(stored)])) {
          const a = Math.round((stored[m]?.effectiveSets || 0) * 100) / 100;
          const b = Math.round((fresh[m]?.effectiveSets || 0) * 100) / 100;
          expect(a, `${where}: неделя ${week.week}, ${m} (effectiveSets)`).toBe(b);
        }
      }
    }
  }, 600000);

  it('fatigueReport совпадает с пересчётом по сессиям', () => {
    for (const { where, plan } of cases) {
      const fresh = plan.weeks.map((w: any) => ({ week: w.week, sessions: w.sessions.map((s: any) => estimateBBSessionCost(s)) }));
      expect(plan.fatigueReport, `${where}: нет fatigueReport`).toBeDefined();
      expect(JSON.parse(JSON.stringify(plan.fatigueReport)), `${where}: fatigueReport`).toEqual(JSON.parse(JSON.stringify(fresh)));
    }
  });

  it('balanceReport совпадает с пересчётом', () => {
    for (const { where, plan } of cases) {
      const fresh = analyzeBBBalance(plan, { specTargets: plan.priorityMuscles });
      expect(JSON.parse(JSON.stringify(plan.balanceReport)), `${where}: balanceReport`).toEqual(JSON.parse(JSON.stringify(fresh)));
    }
  });

  it('report совпадает с пересчётом и с validation/expandedSummary', () => {
    for (const { where, plan } of cases) {
      const fresh = buildBBPlanReport(plan);
      expect(JSON.parse(JSON.stringify(plan.report)), `${where}: report`).toEqual(JSON.parse(JSON.stringify(fresh)));
      // внутренняя согласованность: цифры отчёта = цифры плана
      const issues = plan.validation?.issues || [];
      expect(plan.report.validationErrors, `${where}: validationErrors`).toBe(issues.filter((i: any) => i.level === 'error').length);
      expect(plan.report.validationWarnings, `${where}: validationWarnings`).toBe(issues.filter((i: any) => i.level === 'warning').length);
      expect(plan.report.expandedSummary, `${where}: expandedSummary в отчёте`).toBe(plan.expandedSummary);
      expect(plan.expandedSummary.totalWorkingSets, `${where}: expandedSummary`).toBe(buildBBExpandedSummary(plan).totalWorkingSets);
    }
  });

  it('доставленный план не несёт фантомных ошибок валидации', () => {
    for (const { where, plan } of cases) {
      const errs = (plan.validation?.issues || []).filter((i: any) => i.level === 'error');
      expect(errs.map((e: any) => e.code), `${where}: ошибки валидации в готовом плане`).toEqual([]);
    }
  });
});
