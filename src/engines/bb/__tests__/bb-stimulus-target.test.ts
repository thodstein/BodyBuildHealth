/**
 * bb-stimulus-target.test.ts — «стимул в цель» (пилот руки+дельты).
 * Головки / сетап / линия / читинг / RIR / синергисты / скор + интеграция в диагноз и ранжир.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveStimulus,
  headsHitOf,
  alternativesForHead,
  setupGuideFor,
  diagnoseStimulusTarget,
  headsForMuscle,
  HEAD_FUNCTIONS,
} from '../bb-stimulus-target.engine';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';
import { rankCorrectionsForWeak } from '../bb-correction-rank.engine';
import { getProfExecutionProfile } from '../bb-execution-prof.engine';

describe('resolve + головки', () => {
  it('блок по id резолвится', () => {
    const r = resolveStimulus({ id: 'tricep_pushdown_rope' });
    expect(r?.key).toBe('pushdown');
  });
  it('блок по русскому имени резолвится', () => {
    const r = resolveStimulus({ name: 'Разгибание на блоке с канатом' });
    expect(r?.key).toBe('pushdown');
  });
  it('блок бьёт в латеральную, мимо длинной', () => {
    expect(headsHitOf({ id: 'tricep_pushdown_rope' })).toContain('triceps_lateral');
    expect(headsHitOf({ id: 'tricep_pushdown_rope' })).not.toContain('triceps_long');
  });
  it('overhead бьёт в длинную', () => {
    expect(headsHitOf({ id: 'overhead_tricep_ext' })).toContain('triceps_long');
  });
  it('наклонное сгибание бьёт в длинную бицепса', () => {
    expect(headsHitOf({ id: 'incline_db_curl' })).toContain('biceps_long');
  });
  it('молот бьёт в брахиалис, мимо длинной', () => {
    const h = headsHitOf({ id: 'hammer_curl' });
    expect(h).toContain('brachialis');
    expect(h).not.toContain('biceps_long');
  });
  it('махи бьют в среднюю дельту', () => {
    expect(headsHitOf({ id: 'lateral_raise' })).toContain('delt_mid');
  });
  it('непилот (жим лёжа) — neutral', () => {
    expect(resolveStimulus({ id: 'bench_bar', name: 'Жим штанги лёжа' })).toBe(null);
  });
  it('headsForMuscle покрывает руки/плечи', () => {
    expect(headsForMuscle('triceps')).toContain('triceps_long');
    expect(headsForMuscle('biceps')).toContain('brachialis');
    expect(headsForMuscle('shoulders')).toContain('delt_mid');
  });
  it('HEAD_FUNCTIONS: у длинной трицепса — условие overhead', () => {
    expect(HEAD_FUNCTIONS.triceps_long.stretchCondition).toMatch(/над головой|за головой/);
  });
});

describe('wrongHead — мимо слабой головки', () => {
  it('блок при weakHead=triceps_long → wrongHead + альтернативы', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { weakHead: 'triceps_long' });
    expect(d.flags).toContain('wrongHead');
    expect(d.issues.join(' ')).toMatch(/Французский|из-за головы/);
    expect(d.score as number).toBeLessThan(100);
  });
  it('overhead при weakHead=triceps_long → тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'overhead_tricep_ext' }, { weakHead: 'triceps_long' });
    expect(d.flags).not.toContain('wrongHead');
    expect(d.score).toBe(100);
  });
  it('молот при weakHead=biceps_long → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'hammer_curl' }, { weakHead: 'biceps_long' });
    expect(d.flags).toContain('wrongHead');
  });
  it('махи при weakHead=delt_rear → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'lateral_raise' }, { weakHead: 'delt_rear' });
    expect(d.flags).toContain('wrongHead');
  });
});

describe('сетап / линия / читинг / ROM / RIR', () => {
  it('локти вперёд на блоке → synergistTakeover в дельту', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { setupIssues: ['локти ушли вперёд'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.flags).toContain('setupRisk');
    expect(d.issues.join(' ')).toMatch(/дельта/);
  });
  it('блок без паузы → resistanceLineGap', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { tempoHasPause: false });
    expect(d.flags).toContain('resistanceLineGap');
  });
  it('блок с паузой → линии тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { tempoHasPause: true });
    expect(d.flags).not.toContain('resistanceLineGap');
  });
  it('укороченная амплитуда → romShort с нормой', () => {
    const d = diagnoseStimulusTarget({ id: 'incline_db_curl' }, { rangeFull: false });
    expect(d.flags).toContain('romShort');
    expect(d.issues.join(' ')).toMatch(/Полный вис|амплитуд/i);
  });
  it('читинг → stabilityGap и просадка stability', () => {
    const d = diagnoseStimulusTarget({ id: 'lateral_raise' }, { cheating: true });
    expect(d.flags).toContain('stabilityGap');
    expect(d.breakdown?.stability).toBeLessThan(80);
  });
  it('недожим изоляции RIR 4 → rirMismatch', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { rirActual: 4 });
    expect(d.flags).toContain('rirMismatch');
    expect(d.issues.join(' ')).toMatch(/Недожим/);
  });
  it('пережим базы RIR 0 → rirMismatch', () => {
    const d = diagnoseStimulusTarget({ id: 'ohp' }, { rirActual: 0 });
    expect(d.flags).toContain('rirMismatch');
    expect(d.issues.join(' ')).toMatch(/Пережим/);
  });
  it('норма RIR 2 на блоке → тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { rirActual: 2 });
    expect(d.flags).not.toContain('rirMismatch');
  });
  it('без тапов — только выводимое из плана (тихо)', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, {});
    expect(d.flags).toEqual([]);
    expect(d.score).toBe(100);
  });
});

describe('скор и breakdown', () => {
  it('breakdown 6 компонент 0-100', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { cheating: true, rirActual: 5 });
    expect(Object.keys(d.breakdown || {}).sort()).toEqual(['effort', 'line', 'profile', 'rom', 'setup', 'stability'].sort());
    for (const v of Object.values(d.breakdown || {})) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it('читинг+недожим роняют скор (100-12-8=80)', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { cheating: true, rirActual: 5 });
    expect(d.score).toBe(80);
    expect(d.breakdown?.stability).toBeLessThan(80);
    expect(d.breakdown?.effort).toBeLessThan(80);
  });
  it('alternativesForHead(long) ведёт в overhead', () => {
    expect(alternativesForHead('triceps_long').join(' ')).toMatch(/Французский|Overhead|из-за головы/);
  });
  it('setupGuideFor: чеклист + утечки', () => {
    const g = setupGuideFor('triceps');
    expect(g.checklist.length).toBeGreaterThan(0);
    expect(g.leaks.length).toBeGreaterThan(0);
  });
});

describe('интеграция в diagnoseExercise', () => {
  it('блок + weakHead long → wrongHead в флагах диагноза', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 2 } as any,
      { muscle: 'triceps', weakHead: 'triceps_long' } as any,
    );
    expect(d.flags).toContain('wrongHead');
    expect(d.stimulus?.score).toBeLessThan(100);
  });
  it('блок RIR 4 → rirMismatch в диагнозе', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 4 } as any,
      { muscle: 'triceps' } as any,
    );
    expect(d.flags).toContain('rirMismatch');
  });
  it('непилот без изменений (bench, silent neutral)', () => {
    const d = diagnoseExercise(
      { id: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', rir: 2, tempo: '3-1-1-0', pauseSeconds: 1 } as any,
      { muscle: 'chest' } as any,
    );
    expect(d.stimulus?.score).toBe(null);
    expect(d.flags).not.toContain('wrongHead');
  });
  it('скор диагноза в 0-100', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 5 } as any,
      { muscle: 'triceps', weakHead: 'triceps_long', cheating: true, rangeFull: false } as any,
    );
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThan(100);
  });
});

describe('интеграция в ранжир', () => {
  it('weakHead=triceps_long топит overhead первым', () => {
    const r = rankCorrectionsForWeak('triceps', null, { weakHead: 'triceps_long' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('triceps_long');
    expect(r[0].reason).toMatch(/головку/);
  });
  it('без weakHead порядок прежний (SFR-первый)', () => {
    const r = rankCorrectionsForWeak('triceps', null, {});
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('PROF сетап/утечки', () => {
  it('трицепс PROF: чеклист + утечка', () => {
    const p = getProfExecutionProfile('triceps');
    expect(p?.setupChecklist?.length).toBeGreaterThan(0);
    expect(p?.leakTo).toMatch(/дельта/);
  });
  it('средняя дельта PROF: утечка в трапецию', () => {
    expect(getProfExecutionProfile('delt_mid')?.leakTo).toMatch(/трапеция/);
  });
});
