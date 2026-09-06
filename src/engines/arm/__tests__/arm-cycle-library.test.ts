import { describe, it, expect } from 'vitest';
import { ARM_CYCLE_LIBRARY, getArmCycle, cyclePhaseMap, fitCycleToWeeks } from '../arm-cycle-library.engine';
import { rankArmCycles, selectBestArmCycle, explainArmCycle } from '../arm-cycle-selector.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { buildArmTaperCurve } from '../arm-taper.engine';

describe('arm-cycle-library', () => {
  it('19 шаблонов, уникальные id', () => {
    expect(ARM_CYCLE_LIBRARY.length).toBe(19);
    expect(new Set(ARM_CYCLE_LIBRARY.map((c) => c.id)).size).toBe(19);
  });
  it('все шаблоны валидны: недели/фазы/тейпер', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      expect(c.weeks).toBeGreaterThan(0);
      expect(Object.keys(c.phases).length).toBe(c.weeks);
      expect(c.daysPerWeek).toBeGreaterThan(0);
      expect(c.correctionPctDefault).toBeGreaterThanOrEqual(0);
    }
  });
  it('getArmCycle: известные id', () => {
    expect(getArmCycle('strengthlog_8')?.weeks).toBe(8);
    expect(getArmCycle('coc_12')?.weeks).toBe(12);
    expect(getArmCycle('nope')).toBeUndefined();
  });
  it('cyclePhaseMap exact: 1-в-1', () => {
    const m = cyclePhaseMap('strengthlog_8', 8);
    expect(m && Object.keys(m).length).toBe(8);
    expect(m![1]).toBe('accumulation');
    expect(m![8]).toBe('peaking');
  });
  it('cyclePhaseMap shrink/extend: длина = окну, источник не мутирован', () => {
    const before = JSON.stringify(getArmCycle('tableready_12')?.phases);
    const m = cyclePhaseMap('tableready_12', 8);
    expect(m && Object.keys(m).length).toBe(8);
    expect(JSON.stringify(getArmCycle('tableready_12')?.phases)).toBe(before);
  });
  it('fit: exact / extend / shrink / skip', () => {
    expect(fitCycleToWeeks('strengthlog_8', 8).fit).toBe('exact');
    expect(fitCycleToWeeks('strengthlog_8', 8).needsConsent).toBe(false);
    const ex = fitCycleToWeeks('strengthlog_8', 12);
    expect(ex.fit).toBe('proposed_extend');
    expect(ex.needsConsent).toBe(true);
    const sh = fitCycleToWeeks('strengthlog_8', 6);
    expect(sh.fit).toBe('proposed_shrink');
    expect(sh.needsConsent).toBe(true);
    expect(fitCycleToWeeks('nope', 8).fit).toBe('strict_skip');
  });
  it('selector: armwrestling intermediate 8н → strengthlog_8 первый', () => {
    const r = rankArmCycles({ discipline: 'armwrestling', level: 'intermediate', weeks: 8, daysPerWeek: 4 });
    expect(r[0].cycle.id).toBe('strengthlog_8');
  });
  it('selector: armlifting crush → CoC в топ-3', () => {
    const r = rankArmCycles({ discipline: 'armlifting', level: 'advanced', weeks: 12, gripFocus: 'crush' });
    expect(r.slice(0, 3).map((x) => x.cycle.id).some((id) => id.startsWith('coc_'))).toBe(true);
  });
  it('selectBest + explain не падают', () => {
    const b = selectBestArmCycle({ discipline: 'hybrid', level: 'beginner', weeks: 12 });
    expect(b.id).toBeTruthy();
    expect(explainArmCycle(b.id)).toMatch(b.name);
    expect(explainArmCycle('nope')).toMatch('не найден');
  });
  it('builder без cycleId: фазовая карта generic (обратная совместимость)', () => {
    const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8 });
    expect(p.weeks.length).toBe(8);
    expect(p.rationale.some((l: string) => /Цикл/.test(l))).toBe(false);
  });
  it('builder с cycleId exact: карта цикла + строка в rationale', () => {
    const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8, cycleId: 'strengthlog_8' } as any);
    expect(p.weeks.length).toBe(8);
    expect(p.weeks[7].phase).toBe('peaking');
    expect(p.rationale.some((l: string) => /StrengthLog/.test(l))).toBe(true);
  });
  it('builder с cycleId без согласия при shrink: generic + honest-note', () => {
    const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 6, cycleId: 'strengthlog_8' } as any);
    expect(p.weeks.length).toBe(6);
    expect(p.rationale.some((l: string) => /без согласия/.test(l))).toBe(true);
  });
  it('builder с cycleId + consent: карта цикла применена', () => {
    const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 6, cycleId: 'strengthlog_8', cycleConsent: true } as any);
    expect(p.weeks.length).toBe(6);
    expect(p.rationale.some((l: string) => /по согласию/.test(l))).toBe(true);
  });
  it('taper-пресеты: tableready/coc/toproll кривые', () => {
    const t = buildArmTaperCurve({ taperWeeks: 2, mode: 'tableready_deload' });
    expect(t.every((p) => p.volumePct === 0.6)).toBe(true);
    const c = buildArmTaperCurve({ taperWeeks: 2, mode: 'coc_deload' });
    expect(c.every((p) => p.volumePct === 0.6 && p.rirShift === 2)).toBe(true);
    const tp = buildArmTaperCurve({ taperWeeks: 2, mode: 'toproll_taper' });
    expect(tp[0].volumePct).toBe(0.9);
    expect(tp[1].volumePct).toBe(0.7);
    expect(buildArmTaperCurve({ taperWeeks: 2, mode: 'none' }).length).toBe(0);
  });
  it('parity: все циклы строят валидные планы (инвариант sets=workSets)', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      if (c.id === 'dobrorezov_44') continue; // 44 нед — тяжело, проверяется отдельно лёгким окном
      const p: any = buildArmPlan({ discipline: c.discipline === 'any' ? 'hybrid' : c.discipline, patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: Math.min(c.weeks, 8), cycleId: c.id, cycleConsent: true } as any);
      for (const wk of p.weeks) for (const s of wk.sessions) for (const e of s.exercises) {
        expect(e.sets).toBe(e.workSets.length);
      }
    }
  });
});
