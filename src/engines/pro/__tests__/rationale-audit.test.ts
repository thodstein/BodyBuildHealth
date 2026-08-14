import { describe, expect, it } from 'vitest';
import { analyzePhaseAssistance, analyzeBarPathAssistance, analyzeStickingCorrections } from '../lift-assistance.engine';
import { barPathIssuesForLift } from '../lift-diagnostics.engine';

describe('lift-assistance: rationale и источник упражнений', () => {
  it('махи в стороны для слабой точки жима лёжа описывают дельты, а не грудные', () => {
    const r = analyzePhaseAssistance('bench', 'off_chest');
    const swings = r.items.find(i => i.exercise.name.includes('Махи гантелями'));
    expect(swings).toBeTruthy();
    expect(swings!.rationale).toContain('дельты (плечи)');
    expect(swings!.rationale).not.toContain('Нагружает Большая грудная');
    // Источник — мёртвая точка (PL-пул по слабым мышцам фазы)
    expect(swings!.source).toBe('sticking');
  });

  it('ассистенты слабой точки (weakpoint-pl) помечаются source=weak', () => {
    const r = analyzePhaseAssistance('bench', 'off_chest');
    const wp = r.items.find(i => i.rationale.includes('специфичный ассистент слабой точки'));
    expect(wp).toBeTruthy();
    expect(wp!.source).toBe('weak');
    expect(wp!.rationale).toContain('грудные');
  });

  it('для ohp фазы дают упражнения с русскими названиями групп (дельты/руки)', () => {
    const r = analyzePhaseAssistance('ohp', 'ohp_mid');
    expect(r.items.length).toBeGreaterThan(0);
    for (const i of r.items) {
      expect(i.rationale).not.toMatch(/Нагружает (shoulders|arms|chest)/);
    }
    const s = r.items.find(i => i.targetGroup === 'shoulders');
    expect(s).toBeTruthy();
    expect(s!.rationale).toContain('дельты (плечи)');
  });

  it('bar-path упражнения помечаются source=bar', () => {
    const r = analyzeBarPathAssistance('squat', 'forward_drift');
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every(i => i.source === 'bar')).toBe(true);
    expect(r.items[0].rationale).toContain('отклонени');
    // Полный набор: кандидаты групп + ассистенты пула (не менее 4 упражнений)
    expect(r.items.length).toBeGreaterThanOrEqual(4);
  });

  it('мёртвые точки дают выбираемые упражнения-коррекции', () => {
    const r = analyzeStickingCorrections('squat', 'bottom');
    expect(r.items.length).toBeGreaterThanOrEqual(2);
    expect(r.items.every(i => i.source === 'sticking')).toBe(true);
    expect(r.items.some(i => i.optimal)).toBe(true);
    expect(r.items[0].rationale).toContain('коррекция мёртвой точки');
  });

  it('ВСЕ 7 движений × фазы: коррекции мёртвых точек — полный выбор (не текст)', () => {
    const LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'] as const;
    const WEAK: Record<string, string[]> = {
      bench: ['off_chest', 'mid', 'lockout', 'start'],
      squat: ['bottom', 'mid', 'lockout'],
      deadlift: ['start', 'mid', 'lockout'],
      ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
      row: ['row_start', 'row_mid', 'row_squeeze'],
      pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
      incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
    };
    for (const l of LIFTS) {
      for (const wp of WEAK[l]) {
        const r = analyzeStickingCorrections(l, wp as any);
        expect(r.items.length, `${l}/${wp}: коррекции пусты`).toBeGreaterThanOrEqual(2);
        expect(r.items.every(i => i.source === 'sticking'), `${l}/${wp}: неверный source`).toBe(true);
        expect(r.items.some(i => i.optimal), `${l}/${wp}: нет оптимального`).toBe(true);
      }
    }
  });

  it('ВСЕ 7 движений: bar-path на каждое отклонение — полный выбор (≥4)', () => {
    const LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'] as const;
    for (const l of LIFTS) {
      const issues = barPathIssuesForLift(l);
      expect(issues.length, `${l}: нет bar-path отклонений`).toBeGreaterThan(0);
      for (const issue of issues) {
        const r = analyzeBarPathAssistance(l, issue);
        expect(r.items.length, `${l}/${issue}: бар-пат пуст`).toBeGreaterThanOrEqual(4);
        expect(r.items.every(i => i.source === 'bar')).toBe(true);
        expect(r.items.some(i => i.optimal)).toBe(true);
      }
    }
  });

  it('все 7 движений × все фазы: у каждого упражнения есть валидный source', () => {
    const LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'] as const;
    const WEAK: Record<string, string[]> = {
      bench: ['off_chest', 'mid', 'lockout', 'start'],
      squat: ['bottom', 'mid', 'lockout'],
      deadlift: ['start', 'mid', 'lockout'],
      ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
      row: ['row_start', 'row_mid', 'row_squeeze'],
      pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
      incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
    };
    for (const l of LIFTS) {
      for (const wp of WEAK[l]) {
        const r = analyzePhaseAssistance(l, wp as any);
        expect(r.items.length, `${l}/${wp} пусто`).toBeGreaterThan(0);
        for (const i of r.items) {
          expect(['weak', 'sticking', 'bar']).toContain(i.source);
          expect(i.rationale.length).toBeGreaterThan(20);
        }
      }
    }
  });
});
