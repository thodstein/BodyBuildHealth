/**
 * annual-training-cardio.test.ts — 6.1: кардио-слой годового плана (engine-only).
 * cardioGoalForAnnualPhase, annualCardioSpecs, buildAnnualCardioCycles, annualCardioText.
 */
import { describe, it, expect } from 'vitest';
import {
  cardioGoalForAnnualPhase,
  annualCardioSpecs,
  buildAnnualCardioCycles,
  annualCardioText,
} from '../annual-training-cardio.engine';
import { annualPlanFromMacro } from '../block-builders.engine';
import type { BBMacrocycle } from '../../lms/macrocycle.engine';

function makeBBMacro(): BBMacrocycle {
  return {
    blocks: [
      { phase: 'hypertrophy', weeks: 8, weekOffset: 1, description: 'Гипертрофия', trainingFocus: 'hypertrophy' },
      { phase: 'strength', weeks: 4, weekOffset: 9, description: 'Сила', trainingFocus: 'strength' },
      { phase: 'contest_prep', weeks: 6, weekOffset: 13, description: 'Prep', trainingFocus: 'endurance' },
      { phase: 'transition', weeks: 2, weekOffset: 19, description: 'Переход', trainingFocus: 'hypertrophy' },
    ],
    totalWeeks: 20,
    trainingFocus: 'hypertrophy',
    rationale: [],
  };
}

describe('cardioGoalForAnnualPhase — цель кардио по фазе блока', () => {
  it('маппинг фаз макро → цели кардио', () => {
    expect(cardioGoalForAnnualPhase('contest_prep')).toBe('bb_prep');
    expect(cardioGoalForAnnualPhase('prep')).toBe('bb_prep');
    expect(cardioGoalForAnnualPhase('peak')).toBe('pl_prep');
    expect(cardioGoalForAnnualPhase('competition')).toBe('recovery');
    expect(cardioGoalForAnnualPhase('transition')).toBe('recovery');
    expect(cardioGoalForAnnualPhase('taper')).toBe('bb_taper');
    expect(cardioGoalForAnnualPhase('hypertrophy')).toBe('maintenance');
    expect(cardioGoalForAnnualPhase('strength')).toBe('maintenance');
    expect(cardioGoalForAnnualPhase('endurance')).toBe('maintenance');
    expect(cardioGoalForAnnualPhase('')).toBe('maintenance');
    expect(cardioGoalForAnnualPhase('contest_prep', 'PL')).toBe('bb_prep');
  });
});

describe('annualCardioSpecs — раскладка по блокам года', () => {
  it('4 блока BB-макро: цели/недели/taper-окна', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const specs = annualCardioSpecs(plan);
    expect(specs).toHaveLength(4);
    expect(specs.map(s => s.phase)).toEqual(['hypertrophy', 'strength', 'contest_prep', 'transition']);
    expect(specs.map(s => s.kind)).toEqual(['BB', 'BB', 'BB', 'BB']);
    const prep = specs.find(s => s.phase === 'contest_prep')!;
    expect(prep.startWeek).toBe(13);
    expect(prep.weeks).toBe(6);
    expect(prep.goal).toBe('bb_prep');
    // без явного конфига: taper по умолчанию 3 нед, соревнование на последней неделе блока
    expect(prep.taperWeeks).toBe(3);
    expect(prep.competitionWeek).toBe(6);
    expect(prep.peakWeek).toBe(false);
    const hyper = specs.find(s => s.phase === 'hypertrophy')!;
    expect(hyper.goal).toBe('maintenance');
    expect(hyper.taperWeeks).toBe(0);
    expect(hyper.competitionWeek).toBeNull();
  });

  it('конфиг блока управляет taper/пиком', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[2].config.taper = { enabled: true, weeks: 2 };
    plan.blocks[2].config.peakWeek = true;
    const prep = annualCardioSpecs(plan).find(s => s.phase === 'contest_prep')!;
    expect(prep.taperWeeks).toBe(2);
    expect(prep.peakWeek).toBe(true);
    expect(prep.competitionWeek).toBe(6);
  });

  it('клампы taper-недель 1..4', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[2].config.taper = { enabled: true, weeks: 9 };
    expect(annualCardioSpecs(plan).find(s => s.phase === 'contest_prep')!.taperWeeks).toBe(4);
    plan.blocks[2].config.taper = { enabled: true, weeks: 0 };
    expect(annualCardioSpecs(plan).find(s => s.phase === 'contest_prep')!.taperWeeks).toBe(1);
    plan.blocks[2].config.taper = { enabled: false, weeks: 3 };
    // явно выключенный taper не включается даже для bb_prep? нет — bb_prep по умолчанию
    expect(annualCardioSpecs(plan).find(s => s.phase === 'contest_prep')!.taperWeeks).toBeGreaterThan(0);
  });

  it('блоки со статусом error исключаются', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[1].status = 'error';
    const specs = annualCardioSpecs(plan);
    expect(specs).toHaveLength(3);
    expect(specs.some(s => s.phase === 'strength')).toBe(false);
  });

  it('null/пустой план → []', () => {
    expect(annualCardioSpecs(null)).toEqual([]);
    expect(annualCardioSpecs(undefined)).toEqual([]);
  });
});

describe('buildAnnualCardioCycles — сборка циклов на блоки', () => {
  it('цикл prep: 6 нед, taper 3 + пик на последней неделе, startDate от старта блока', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[2].config.taper = { enabled: true, weeks: 3 };
    plan.blocks[2].config.peakWeek = true;
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01', bodyWeight: 80, daysAvailable: 7 });
    expect(out.warnings).toEqual([]);
    expect(Object.keys(out.cycles)).toHaveLength(4);
    const prepKey = out.specs.find(s => s.phase === 'contest_prep')!.blockKey;
    const prep = out.cycles[prepKey];
    expect(prep.goal).toBe('bb_prep');
    expect(prep.totalWeeks).toBe(6);
    expect(prep.startDate).toBe('2026-03-26'); // нед 13 → +12×7 дней
    expect(prep.weeks.find(w => w.week === 6)!.phase).toBe('peak');
    expect(prep.weeks.filter(w => w.phase === 'taper').map(w => w.week)).toEqual([3, 4, 5]);
    expect(prep.linkedCompetitionIds).toContain(`annual-cardio-${prepKey}`);
  });

  it('поддерживающий блок: maintenance без taper/соревнований', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01' });
    const hyperKey = out.specs.find(s => s.phase === 'hypertrophy')!.blockKey;
    const hyper = out.cycles[hyperKey];
    expect(hyper.goal).toBe('maintenance');
    expect(hyper.totalWeeks).toBe(8);
    expect(hyper.startDate).toBe('2026-01-01');
    expect(hyper.weeks.some(w => w.phase === 'taper' || w.phase === 'peak')).toBe(false);
    expect(hyper.linkedCompetitionIds).toEqual([]);
  });

  it('предупреждения: пустой план и stale-блоки', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[0].status = 'stale';
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01' });
    expect(out.warnings.some(w => /stale/.test(w))).toBe(true);
    const empty = buildAnnualCardioCycles({ ...plan, blocks: [] }, { referenceIso: '2026-01-01' });
    expect(empty.cycles).toEqual({});
    expect(empty.warnings.some(w => /нет блоков/.test(w))).toBe(true);
    expect(buildAnnualCardioCycles(null, { referenceIso: '2026-01-01' }).cycles).toEqual({});
  });

  it('id/имя цикла — годовые', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01' });
    const prepKey = out.specs.find(s => s.phase === 'contest_prep')!.blockKey;
    const prep = out.cycles[prepKey];
    expect(prep.id).toBe(`annual-cardio-${prepKey}`);
    expect(prep.name).toContain('Кардио');
    expect(prep.source).toBe('auto');
  });
});

describe('annualCardioText — сводка кардио-слоя', () => {
  it('строки: недели, цель, средние минуты, taper', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    plan.blocks[2].config.taper = { enabled: true, weeks: 3 };
    plan.blocks[2].config.peakWeek = true;
    const out = buildAnnualCardioCycles(plan, { referenceIso: '2026-01-01', bodyWeight: 80 });
    const lines = annualCardioText(out.specs, out.cycles);
    expect(lines).toHaveLength(4);
    expect(lines.some(l => /Нед 13-18 .*: bb_prep, \d+ мин\/нед, taper 3 нед \+ пик\./.test(l))).toBe(true);
    expect(lines.some(l => /Нед 1-8 .*: maintenance, \d+ мин\/нед\./.test(l))).toBe(true);
    expect(lines.some(l => /Нед 19-20 .*: recovery/.test(l))).toBe(true);
  });
});