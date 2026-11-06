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
import { buildBBPlan, WEAK_TO_MUSCLE } from '../bb-builder.engine';
import { finalizeBBPlan, prioritizeBackSessions } from '../bb-finalize.engine';
import { refreshBBPlanSnapshots } from '../bb-plan-snapshot.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { FREQUENCY_DRIFT_PREFIX, FREQUENCY_LINE_PREFIX } from '../bb-frequency';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { aggregateBBVolume } from '../bb-volume.engine';
import { analyzeBBBalance } from '../bb-balance.engine';
import { estimateBBSessionCost } from '../bb-fatigue.engine';
import { buildBBPlanReport } from '../bb-report.engine';
import { buildBBExpandedSummary } from '../bb-summary.engine';
import { analyzeBBRotation } from '../bb-rotation.engine';
import { backQualityIssues, armQualityIssues } from '../bb-back-quality.engine';
import { analyzePlanStress } from '../bb-injury-prevention.engine';

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

/**
 * Тот же инвариант на ПУТИ РЕДАКТИРОВАНИЯ (UI: `revalidateEditedPlan`).
 *
 * Там последовательность другая: `finalizeBBPlan` (снимает снимки у себя) →
 * `prioritizeBackSessions` (добавляет сеты спине) → финальная рампа (режет
 * сеты). То есть после снимков план снова меняется — и «Итого: N рабочих
 * сетов/нед» показывает цифры прежней версии. Замер до правки: на 12 планах
 * expandedSummary расходился в 9 (1-7 сетов). Правка — единая точка
 * `refreshBBPlanSnapshots`, которую обязан звать любой, кто меняет план.
 */
describe('bb: снимки после правок (revalidate-путь)', () => {
  const CANON = (m: string) => WEAK_TO_MUSCLE[m] || m;
  /** Те же опции, что передаёт UI в `revalidateEditedPlan`. */
  const uiValidationOptions = (plan: any) => ({
    level: 'advanced',
    trainingYears: 3,
    excludedMuscles: [],
    checkOrder: true,
    specializationTargets: plan.priorityMuscles,
    maxWorkingSets: plan.maxWorkingSets,
    maxExercises: plan.maxExercises,
  });

  function editLikeUi(basePlan: any): any {
    const edited: any = structuredClone(basePlan);
    const first = edited.weeks[0].sessions[0].exercises[0];
    first.sets = Math.max(2, (first.sets || 3) - 1);
    const out: any = finalizeBBPlan(edited, {
      reorder: false,
      phaseSafety: true,
      level: 'advanced',
      volumeGoal: 'mass',
      priorityMuscles: edited.priorityMuscles,
      trainingYears: 3,
      mrvMultiplier: edited.mrvMultiplier,
      ensureMinimumVolume: true,
      controlledRotation: false,
      maxWorkingSets: edited.maxWorkingSets,
      maxExercises: edited.maxExercises,
    } as any);
    prioritizeBackSessions(out, { level: 'advanced' as any, trainingYears: 3, onCourse: false, maxWorkingSets: edited.maxWorkingSets } as any);
    refreshBBPlanSnapshots(out, {
      validationOptions: uiValidationOptions(out),
      specTargets: out.priorityMuscles,
      canonicalMuscle: CANON,
      refreshFrequency: true,
      refreshValidationRationale: true,
    });
    return out;
  }

  const splits = SPLIT_PATTERNS.filter((s) => ['fullbody_3', 'upper_lower_4', 'rolling_4_1'].includes(s.id));
  const plans = splits.flatMap((split) => (['intermediate', 'advanced'] as const).map((level) => ({
    where: `${split.id}/${level}`,
    plan: editLikeUi(buildBBPlan({ patternId: split.id, level, goal: 'mass', weeks: 2, workMax: WM })),
  })));

  it('после правки все снимки описывают отредактированный план', () => {
    for (const { where, plan } of plans) {
      for (const week of plan.weeks) {
        const fresh = aggregateBBVolume(week.sessions) as any;
        for (const m of new Set([...Object.keys(fresh), ...Object.keys(plan.weeklyVolume[week.week] || {})])) {
          const a = Math.round((plan.weeklyVolume[week.week]?.[m]?.effectiveSets || 0) * 100) / 100;
          const b = Math.round((fresh[m]?.effectiveSets || 0) * 100) / 100;
          expect(a, `${where}: weeklyVolume недели ${week.week}, ${m}`).toBe(b);
        }
      }
      expect(plan.expandedSummary.totalWorkingSets, `${where}: expandedSummary`).toBe(buildBBExpandedSummary(plan).totalWorkingSets);
      const freshFatigue = plan.weeks.map((w: any) => ({ week: w.week, sessions: w.sessions.map((s: any) => estimateBBSessionCost(s)) }));
      expect(JSON.parse(JSON.stringify(plan.fatigueReport)), `${where}: fatigueReport`).toEqual(JSON.parse(JSON.stringify(freshFatigue)));
      expect(JSON.parse(JSON.stringify(plan.report)), `${where}: report`).toEqual(JSON.parse(JSON.stringify(buildBBPlanReport(plan))));
      expect(plan.report.expandedSummary, `${where}: отчёт копирует expandedSummary`).toBe(plan.expandedSummary);
      const freshRotation = analyzeBBRotation(plan);
      expect(plan.rotationReport, `${where}: rotationReport`).toEqual(freshRotation);
      expect(plan.report.rotationWarnings, `${where}: счётчик ротации в отчёте`).toBe(freshRotation.issues.length);
      const freshRotationLines = new Set(freshRotation.issues.map((i: any) => `⚠ Ротация: ${i.message}`));
      const staleRotation = (plan.rationale || [])
        .filter((line: string) => String(line).startsWith('⚠ Ротация:'))
        .filter((line: string) => !freshRotationLines.has(String(line)));
      expect(staleRotation, `${where}: rationale описывает снятую ротацию`).toEqual([]);

      // Паттерны спины/рук и их качество — факт финального состава, а не
      // середина финализатора (замер до правки: спина 14/17, руки 9/17,
      // «Качество рук» держало до 14 снятых предупреждений).
      const patternSummaryOf = (muscles: string[]) => {
        const acc: Record<string, number> = {};
        for (const week of plan.weeks) for (const s of week.sessions) for (const e of s.exercises) {
          if (!muscles.includes(e.muscle)) continue;
          const p = e.movementPattern || 'other';
          acc[p] = (acc[p] || 0) + e.sets;
        }
        return Object.entries(acc).map(([k, v]) => `${k}=${v}`).join(', ') || 'нет прямой работы';
      };
      const rationale = (plan.rationale || []).map(String);
      expect(
        rationale.find((line: string) => line.startsWith('🧩 Спина по паттернам:')),
        `${where}: строка спины`,
      ).toBe(`🧩 Спина по паттернам: ${patternSummaryOf(['back'])}`);
      expect(
        rationale.find((line: string) => line.startsWith('💪 Руки по паттернам:')),
        `${where}: строка рук`,
      ).toBe(`💪 Руки по паттернам: ${patternSummaryOf(['biceps', 'triceps', 'forearms'])}`);
      expect(
        rationale.filter((line: string) => line.startsWith('⚠ Качество спины:')),
        `${where}: качество спины`,
      ).toEqual(backQualityIssues(plan.weeks).map((i: string) => `⚠ Качество спины: ${i}`));
      expect(
        rationale.filter((line: string) => line.startsWith('⚠ Качество рук:')),
        `${where}: качество рук`,
      ).toEqual(armQualityIssues(plan.weeks).map((i: string) => `⚠ Качество рук: ${i}`));

      // Суставной стресс и строки «🚫 Валидация» — тоже обещания пользователю
      // (замер до правки: суставы расходились в 23/23 планов, а цикл-путь
      // держал 3 фантомные ошибки, которых в плане уже нет).
      const jointIssues = analyzePlanStress(plan).issues;
      expect(
        rationale.filter((line: string) => line.startsWith('🦿 Суставы:')),
        `${where}: строка суставов`,
      ).toEqual(jointIssues.length ? [`🦿 Суставы: ${jointIssues.join(' ')}`] : []);
      const freshErrors = ((plan.validation?.issues || []) as any[])
        .filter((issue: any) => issue.level === 'error')
        .slice(0, 20)
        .map((issue: any) => `🚫 Валидация: ${issue.message}`);
      expect(
        rationale.filter((line: string) => line.startsWith('🚫 Валидация:')),
        `${where}: строки ошибок валидации`,
      ).toEqual(freshErrors);
      const freshValidation = validateBBPlan(plan, uiValidationOptions(plan) as any);
      const countErrors = (issues: any[]) => issues.filter((i: any) => i.level === 'error').length;
      expect(
        countErrors(plan.validation?.issues || []),
        `${where}: ошибки валидации`,
      ).toBe(countErrors(freshValidation.issues));
    }
  }, 900000);

  it('пересчёт идемпотентен (повторный вызов не сдвигает цифры)', () => {
    for (const { where, plan } of plans) {
      const before = JSON.stringify([plan.weeklyVolume, plan.expandedSummary, plan.fatigueReport, plan.balanceReport, plan.report]);
      refreshBBPlanSnapshots(plan, {
        validationOptions: { level: 'advanced', trainingYears: 3, excludedMuscles: [], checkOrder: true },
        specTargets: plan.priorityMuscles,
        canonicalMuscle: CANON,
        refreshFrequency: true,
        refreshValidationRationale: true,
      });
      const after = JSON.stringify([plan.weeklyVolume, plan.expandedSummary, plan.fatigueReport, plan.balanceReport, plan.report]);
      expect(after, `${where}: второй пересчёт изменил снимки`).toBe(before);
      // и строки-обещания не размножились
      const freqLines = (plan.rationale || []).filter((r: string) => String(r).startsWith(FREQUENCY_LINE_PREFIX));
      expect(freqLines.length, `${where}: строка частоты`).toBe(1);
      const driftNotes = (plan.rationale || []).filter((r: string) => String(r).startsWith(FREQUENCY_DRIFT_PREFIX));
      expect(driftNotes.length, `${where}: заметка о расхождении частоты`).toBeLessThanOrEqual(1);
    }
  });

  it('удаление работы на мышцу снимает прежнее обещание частоты', () => {
    const plan: any = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 2, workMax: WM });
    const before = (plan.rationale || []).find((r: string) => String(r).startsWith(FREQUENCY_LINE_PREFIX));
    expect(before, 'строка частоты должна быть в плане').toBeDefined();
    // Пользователь убрал все упражнения на бицепс — обещание «2×/нед» больше не факт.
    for (const week of plan.weeks) {
      for (const session of week.sessions) {
        session.exercises = session.exercises.filter((e: any) => CANON(e.muscle || '') !== 'biceps');
      }
    }
    refreshBBPlanSnapshots(plan, {
      validationOptions: { level: 'intermediate', trainingYears: 3, excludedMuscles: [], checkOrder: true },
      specTargets: plan.priorityMuscles,
      canonicalMuscle: CANON,
      refreshFrequency: true,
      refreshValidationRationale: true,
    });
    const after = String((plan.rationale || []).find((r: string) => String(r).startsWith(FREQUENCY_LINE_PREFIX)) || '');
    expect(after).not.toBe(before);
    expect(after).toMatch(/biceps=0×/);
    expect((plan.rationale || []).some((r: string) => String(r).startsWith(FREQUENCY_DRIFT_PREFIX))).toBe(true);
  }, 300000);
});
