/**
 * annual-junction-deload.test.ts — B7 (MACROCYCLE-ROADMAP): авто-делод на стыках
 * PL-блоков годового плана. Когда подряд идут два тренировочных PL-блока
 * (endurance/strength) и у предыдущего нет собственной разгрузки — последняя неделя
 * предыдущего блока становится делодом (объём ×0.5, RIR +2, метка).
 */
import { describe, it, expect } from 'vitest';
import { annualPlanFromMacro, buildAnnualPlan, applyPLJunctionDeloads } from '../block-builders.engine';
import type { Macrocycle, MacroBlock, BBMacrocycle } from '../../lms/macrocycle.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

const CYCLE_ID = LMS_CYCLES[0]?.meta.id ?? 'cycle_unknown';
const DEFAULT_OPTS = { daysPerWeek: 4, level: 'intermediate' as const };

function makePLMacro(blocks: MacroBlock[], totalWeeks = blocks.reduce((s, b) => s + b.weeks, 0)): Macrocycle {
  return { blocks, totalWeeks, rationale: [] };
}

/** Сумма рабочих сетов недели. */
function weekSets(week: { sessions: { blocks: { sets: unknown[] }[] }[] }): number {
  return week.sessions.reduce((s, sess) => s + sess.blocks.reduce((b, blk) => b + blk.sets.length, 0), 0);
}

const totalSetsOf = (plan: ReturnType<typeof annualPlanFromMacro>, idx: number): number[] =>
  (plan.blocks[idx].result?.weeks ?? []).map(weekSets);

describe('applyPLJunctionDeloads — авто-делод на стыках PL-блоков', () => {
  it('стык endurance→strength: последняя неделя endurance — делод, метка, warning, объём ниже соседней недели', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'Сила' },
      { phase: 'transition', weeks: 2, weekOffset: 13, kind: 'SRC', cycleId: CYCLE_ID, description: 'Переход' },
    ]);
    const out = buildAnnualPlan(annualPlanFromMacro(macro), macro, DEFAULT_OPTS);
    const plan = out.plan;
    const block0 = plan.blocks[0];
    const weeks = block0.result!.weeks;
    const last = weeks[weeks.length - 1];
    expect(block0.ref.kind).toBe('PL');
    expect(last.deload).toBe(true);
    expect(last.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-junction-deload]')))).toBe(true);
    expect((block0.result!.warnings ?? []).some(w => /Авто-делод на стыке/.test(w))).toBe(true);
    // Объём последней недели снижен относительно предпоследней (разгрузка).
    expect(weekSets(last)).toBeLessThan(weekSets(weeks[weeks.length - 2]));
  });

  it('стык strength→transition НЕ даёт делод (transition — уже разгрузка)', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'Сила' },
      { phase: 'transition', weeks: 2, weekOffset: 13, kind: 'SRC', cycleId: CYCLE_ID, description: 'Переход' },
    ]);
    const plan = buildAnnualPlan(annualPlanFromMacro(macro), macro, DEFAULT_OPTS).plan;
    const strength = plan.blocks[1];
    const last = strength.result!.weeks[strength.result!.weeks.length - 1];
    expect(last.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-junction-deload]')))).toBe(false);
    expect(last.deload).toBe(false);
  });

  it('предыдущий блок с taper.enabled НЕ получает делод на стыке (есть своя разгрузка)', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'Сила' },
    ]);
    const plan = annualPlanFromMacro(macro);
    plan.blocks[0].config.taper = { enabled: true, weeks: 2 };
    const built = buildAnnualPlan(plan, macro, DEFAULT_OPTS).plan;
    const last = built.blocks[0].result!.weeks[built.blocks[0].result!.weeks.length - 1];
    expect(last.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-junction-deload]')))).toBe(false);
  });

  it('BB-блоки и стык PL→BB НЕ получают делод (только PL→PL)', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'BB', description: 'Силовой BB' },
    ]);
    const plan = buildAnnualPlan(annualPlanFromMacro(macro), macro, DEFAULT_OPTS).plan;
    const b0 = plan.blocks[0];
    const last0 = b0.result!.weeks[b0.result!.weeks.length - 1];
    expect(last0.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-junction-deload]')))).toBe(false);
    expect(plan.blocks[1].ref.kind).toBe('BB');
  });

  it('идемпотентность: повторный прогон не удваивает делод', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'Сила' },
    ]);
    const first = buildAnnualPlan(annualPlanFromMacro(macro), macro, DEFAULT_OPTS).plan;
    const setsA = totalSetsOf(first, 0);
    const second = buildAnnualPlan(first, macro, { ...DEFAULT_OPTS, rebuild: 'all' }).plan;
    const setsB = totalSetsOf(second, 0);
    expect(setsA).toEqual(setsB);
    // Метка — только на последней неделе (одна неделя с меткой).
    const markWeeks = second.blocks[0].result!.weeks
      .filter(w => w.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-junction-deload]')))).length;
    expect(markWeeks).toBe(1);
  });

  it('applyPLJunctionDeloads напрямую: без соседнего тренировочного PL-блока — no-op', () => {
    const macro = makePLMacro([
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'transition', weeks: 2, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'Переход' },
    ]);
    const plan = buildAnnualPlan(annualPlanFromMacro(macro), macro, DEFAULT_OPTS).plan;
    const before = totalSetsOf(plan, 0);
    const applied = applyPLJunctionDeloads(plan);
    expect(totalSetsOf(applied, 0)).toEqual(before);
  });

  it('BB-год (hypertrophy→strength) не затрагивается B7', () => {
    const bbMacro: BBMacrocycle = {
      blocks: [
        { phase: 'hypertrophy', weeks: 6, weekOffset: 1, description: 'Гипертрофия', trainingFocus: 'hypertrophy' },
        { phase: 'strength', weeks: 6, weekOffset: 7, description: 'Сила', trainingFocus: 'strength' },
      ],
      totalWeeks: 12,
      trainingFocus: 'hypertrophy',
      rationale: [],
    };
    const plan = buildAnnualPlan(annualPlanFromMacro(bbMacro), bbMacro, DEFAULT_OPTS).plan;
    const anyMark = plan.blocks.some(b => (b.result?.weeks ?? []).some(w =>
      w.sessions.some(s => s.blocks.some(bl => bl.note?.includes('[annual-junction-deload]')))));
    expect(anyMark).toBe(false);
  });
});