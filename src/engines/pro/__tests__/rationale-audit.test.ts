import { describe, expect, it } from 'vitest';
import { analyzePhaseAssistance, analyzeBarPathAssistance, analyzeStickingCorrections } from '../lift-assistance.engine';
import { barPathIssuesForLift } from '../lift-diagnostics.engine';

const WEAK: Record<string, string[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
};

describe('lift-assistance: пулы разделены (слабые мышцы / точки / мёртвые / bar-path)', () => {
  it('слабые точки: только ассистенты фазы (source=weak), оптимальный первый', () => {
    for (const [l, wps] of Object.entries(WEAK)) {
      for (const wp of wps) {
        const r = analyzePhaseAssistance(l as any, wp as any);
        expect(r.items.length, `${l}/${wp}: пусто`).toBeGreaterThan(0);
        expect(r.items.every(i => i.source === 'weak'), `${l}/${wp}`).toBe(true);
        expect(r.items.some(i => i.optimal), `${l}/${wp}: нет optimal`).toBe(true);
        expect(r.items[0].rationale).toContain('Слабая точка');
      }
    }
  });

  it('мёртвые точки: коррекции углов (source=sticking) только для 3 классических', () => {
    for (const wp of WEAK.bench) {
      const r = analyzeStickingCorrections('bench', wp as any);
      expect(r.items.length, `bench/${wp}`).toBeGreaterThanOrEqual(2);
      expect(r.items.every(i => i.source === 'sticking')).toBe(true);
      expect(r.items.some(i => i.optimal)).toBe(true);
      expect(r.items[0].rationale).toContain('Коррекция мёртвой точки');
    }
    for (const wp of WEAK.squat) {
      expect(analyzeStickingCorrections('squat', wp as any).items.length).toBeGreaterThanOrEqual(2);
    }
    for (const wp of WEAK.deadlift) {
      expect(analyzeStickingCorrections('deadlift', wp as any).items.length).toBeGreaterThanOrEqual(2);
    }
    // Для движений без угловой диагностики — мёртвых точек нет
    for (const l of ['ohp', 'row', 'pulldown', 'incline_press']) {
      for (const wp of WEAK[l]) {
        expect(analyzeStickingCorrections(l as any, wp as any).items, `${l}/${wp}`).toEqual([]);
      }
    }
  });

  it('ПЛ-коррекции из текстов калькулятора теперь в каталоге и выбираются (дожимы, рамы, паузы)', () => {
    const lockout = analyzeStickingCorrections('bench', 'lockout');
    const names = lockout.items.map(i => i.exercise.name.toLowerCase());
    expect(names.some(n => n.includes('дожим') || n.includes('плинт'))).toBe(true);
    expect(names.some(n => n.includes('раме'))).toBe(true);
    const offChest = analyzeStickingCorrections('bench', 'off_chest');
    expect(offChest.items.map(i => i.exercise.name.toLowerCase()).some(n => n.includes('пауз'))).toBe(true);
  });

  it('bar-path: только пул отклонений (source=bar), у каждого отклонения есть выбор', () => {
    for (const l of Object.keys(WEAK)) {
      const issues = barPathIssuesForLift(l as any);
      expect(issues.length, `${l}: нет отклонений`).toBeGreaterThan(0);
      for (const issue of issues) {
        const r = analyzeBarPathAssistance(l as any, issue);
        expect(r.items.length, `${l}/${issue}: пусто`).toBeGreaterThanOrEqual(1);
        expect(r.items.every(i => i.source === 'bar')).toBe(true);
        expect(r.items.some(i => i.optimal)).toBe(true);
        expect(r.items[0].rationale).toContain('Коррекция отклонения');
      }
    }
  });

  it('bar-path per-lift: для жима — жимовые коррекции, для приседа — приседовые (не смешиваются)', () => {
    const bench = analyzeBarPathAssistance('bench', 'forward_drift');
    const benchNames = bench.items.map(i => i.exercise.name.toLowerCase());
    expect(benchNames.some(n => /жим|пауз|остановк/.test(n))).toBe(true);
    expect(benchNames.some(n => /румынск|наклон|гипер/.test(n))).toBe(false);

    const squat = analyzeBarPathAssistance('squat', 'forward_drift');
    const squatNames = squat.items.map(i => i.exercise.name.toLowerCase());
    expect(squatNames.some(n => /румынск|наклон|гипер/.test(n))).toBe(true);

    const ohp = analyzeBarPathAssistance('ohp', 'bar_loops');
    const ohpNames = ohp.items.map(i => i.exercise.name.toLowerCase());
    expect(ohpNames.some(n => /жим|армейск/.test(n))).toBe(true);

    const row = analyzeBarPathAssistance('row', 'bar_loops');
    const rowNames = row.items.map(i => i.exercise.name.toLowerCase());
    expect(rowNames.some(n => /тяга|тяг/.test(n))).toBe(true);

    const pulldown = analyzeBarPathAssistance('pulldown', 'asymmetric');
    const pulldownNames = pulldown.items.map(i => i.exercise.name.toLowerCase());
    expect(pulldownNames.some(n => /тяга верхнего|подтягив/.test(n))).toBe(true);
  });

  it('слабые точки: фазы одного движения дают РАЗНЫЕ наборы упражнений', () => {
    const liftSets: Array<[string, string[]]> = [
      ['squat', ['bottom', 'mid', 'lockout']],
      ['deadlift', ['start', 'mid', 'lockout']],
      ['ohp', ['ohp_start', 'ohp_mid', 'ohp_lockout']],
      ['row', ['row_start', 'row_mid', 'row_squeeze']],
      ['pulldown', ['pd_top', 'pd_mid', 'pd_squeeze']],
      ['incline_press', ['inc_off', 'inc_mid', 'inc_lockout']],
    ];
    for (const [lift, phases] of liftSets) {
      const sets = phases.map(wp => analyzePhaseAssistance(lift as any, wp as any).items.map(i => i.exercise.name).join('|'));
      expect(new Set(sets).size, `${lift}: фазы дают одинаковые наборы`).toBe(phases.length);
    }
  });

  it('пулы не смешиваются по источнику: weak-список не содержит sticking/bar и наоборот', () => {
    const phase = analyzePhaseAssistance('bench', 'mid');
    expect(phase.items.some(i => i.source !== 'weak')).toBe(false);
    const sticking = analyzeStickingCorrections('bench', 'mid');
    expect(sticking.items.some(i => i.source !== 'sticking')).toBe(false);
    const bar = analyzeBarPathAssistance('bench', 'bar_loops');
    expect(bar.items.some(i => i.source !== 'bar')).toBe(false);
  });
});
