/**
 * lms-taper-curve.test.ts — каноническая кривая тапера (lms-taper.engine).
 * Единый источник цифр для всех поверхностей ПЛ-авто: applyPLTaper,
 * appendPLTaperWeeks, макроцикл, калькуляторы и карточки.
 */
import { describe, expect, it } from 'vitest';
import {
  buildPLTaperCurve, taperWeeksByFatigue, weightGoalVolumeMult, summarizeTaperCurve,
  TAPER_MODE_LABELS, TAPER_WEIGHT_GOAL_LABELS,
} from '../lms-taper.engine';
import { MEET_STRATEGY_PCT } from '../competition-attempts';
import { peakWeekAttempts } from '../../pro/taper.engine';

describe('buildPLTaperCurve: classic (Bosquet, разгрузка)', () => {
  it('2 недели: объём ×0.65 → ×0.45, RIR +1 → +2, интенсивность сохранена', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic' });
    expect(curve).toHaveLength(2);
    expect(curve[0].volumePct).toBeCloseTo(0.65, 2);
    expect(curve[0].rirShift).toBe(1);
    expect(curve[0].intensityMode).toBe('preserve');
    expect(curve[1].volumePct).toBeCloseTo(0.45, 2);
    expect(curve[1].rirShift).toBe(2);
    expect(curve[1].label).toBe('Финальная');
  });

  it('1 неделя: соревновательная ×0.45 RIR +2', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 1, mode: 'classic' });
    expect(curve).toHaveLength(1);
    expect(curve[0].label).toBe('Соревновательная');
    expect(curve[0].volumePct).toBeCloseTo(0.45, 2);
    expect(curve[0].rirShift).toBe(2);
  });

  it('4 недели: плавное снижение 0.9 → 0.45', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 4, mode: 'classic' });
    expect(curve).toHaveLength(4);
    // 0.9 - progress*0.45 (r2): 0.79 / 0.67 / 0.56 / 0.45 — монотонное убывание
    expect(curve[0].volumePct).toBeGreaterThan(curve[1].volumePct);
    expect(curve[1].volumePct).toBeGreaterThan(curve[2].volumePct);
    expect(curve[2].volumePct).toBeGreaterThan(curve[3].volumePct);
    expect(curve[0].volumePct).toBeCloseTo(0.79, 2);
    expect(curve[3].volumePct).toBeCloseTo(0.45, 2);
    expect(curve[3].rirShift).toBe(2);
    expect(curve[0].rirShift).toBe(1);
  });
});

describe('buildPLTaperCurve: pl (ПЛ-пик-протокол Библиотеки)', () => {
  it('3 недели: объём 85/75/60%, инт. 90/95/100%, RIR 1/0/0, синглы на интенсивной', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 3, mode: 'pl' });
    expect(curve).toHaveLength(3);
    expect(curve[0].volumePct).toBeCloseTo(0.85, 2);
    expect(curve[0].intensityPct).toBeCloseTo(0.90, 2);
    expect(curve[0].rirTarget).toBe(1);
    expect(curve[1].volumePct).toBeCloseTo(0.75, 2);
    expect(curve[1].intensityPct).toBeCloseTo(0.95, 2);
    expect(curve[1].singles).toBe(true);
    expect(curve[2].volumePct).toBeCloseTo(0.60, 2);
    expect(curve[2].intensityPct).toBeCloseTo(1.0, 2);
    expect(curve[2].rirTarget).toBe(0);
    expect(curve[2].singles).toBeFalsy();
    expect(curve[2].label).toBe('Соревновательная');
  });

  it('taperWeeks=1: только соревновательная неделя протокола (100%, RIR 0)', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 1, mode: 'pl' });
    expect(curve).toHaveLength(1);
    expect(curve[0].intensityPct).toBe(1.0);
    expect(curve[0].rirTarget).toBe(0);
  });

  it('taperWeeks=2: интенсивная + соревновательная (последние недели протокола, без синглов)', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'pl' });
    expect(curve).toHaveLength(2);
    expect(curve[0].intensityPct).toBeCloseTo(0.95, 2);
    expect(curve[0].singles).toBeFalsy();
    expect(curve[1].intensityPct).toBe(1.0);
    expect(curve[1].singles).toBeFalsy();
  });
});

describe('buildPLTaperCurve: pro (усталость-зависимая)', () => {
  it('объём ~0.65/0.45/0.40, инт. ~92%, RIR 2→1', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 3, mode: 'pro', fatigue: 80 });
    expect(curve).toHaveLength(3);
    expect(curve[0].volumePct).toBeCloseTo(0.65, 2);
    expect(curve[2].volumePct).toBeCloseTo(0.40, 2);
    expect(curve[0].intensityMode).toBe('set_pct');
    expect(curve[2].intensityPct).toBeCloseTo(0.92, 2);
    expect(curve[0].rirShift).toBe(2);
    expect(curve[2].rirShift).toBe(1);
  });
});

describe('buildPLTaperCurve: весовая цель', () => {
  it('lose — объём ×0.9 (дефицит → MRV ниже)', () => {
    const lose = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic', weightGoal: 'lose' });
    const keep = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic', weightGoal: 'maintain' });
    expect(lose[0].volumePct).toBeCloseTo(0.65 * 0.9, 2);
    expect(lose[1].volumePct).toBeCloseTo(0.45 * 0.9, 2);
    expect(keep[0].volumePct).toBeCloseTo(0.65, 2);
  });

  it('gain/maintain/auto — полный объём; weightGoalVolumeMult', () => {
    expect(weightGoalVolumeMult('gain')).toBe(1);
    expect(weightGoalVolumeMult('maintain')).toBe(1);
    expect(weightGoalVolumeMult('auto')).toBe(1);
    expect(weightGoalVolumeMult('lose')).toBeCloseTo(0.9, 2);
    expect(weightGoalVolumeMult(undefined)).toBe(1);
  });
});

describe('taperWeeksByFatigue (дедуп с pro/taper.engine)', () => {
  it('усталость → длительность тапера', () => {
    expect(taperWeeksByFatigue(30)).toBe(1);
    expect(taperWeeksByFatigue(50)).toBe(2);
    expect(taperWeeksByFatigue(75)).toBe(3);
    expect(taperWeeksByFatigue(undefined)).toBeNull();
  });
});

describe('дедуп стратегий прикидов (канон — competition-attempts.MEET_STRATEGY_PCT)', () => {
  it('peakWeekAttempts (pro/taper.engine) использует те же проценты, что meetAttemptsFor', () => {
    const pro = peakWeekAttempts({ squat: 200, bench: 140, deadlift: 240 }, 'balanced');
    expect(pro.squat.opener / 200).toBeCloseTo(MEET_STRATEGY_PCT.balanced.opener, 2);
    expect(pro.squat.second / 200).toBeCloseTo(MEET_STRATEGY_PCT.balanced.second, 2);
    expect(pro.squat.third / 200).toBeCloseTo(MEET_STRATEGY_PCT.balanced.third, 2);
    const agg = peakWeekAttempts({ squat: 200, bench: 140, deadlift: 240 }, 'aggressive');
    expect(agg.deadlift.third / 240).toBeCloseTo(MEET_STRATEGY_PCT.aggressive.third, 2);
  });
});

describe('утилиты', () => {
  it('TAPER_MODE_LABELS и TAPER_WEIGHT_GOAL_LABELS покрывают все ключи', () => {
    expect(Object.keys(TAPER_MODE_LABELS)).toEqual(['classic', 'pl', 'pro', 'wf']);
    expect(Object.keys(TAPER_WEIGHT_GOAL_LABELS)).toEqual(['lose', 'gain', 'maintain', 'auto']);
  });

  it('summarizeTaperCurve — человекочитаемая сводка', () => {
    const s = summarizeTaperCurve(buildPLTaperCurve({ taperWeeks: 2, mode: 'classic' }));
    expect(s).toContain('объём ×0.65');
    expect(s).toContain('RIR +2');
  });
});
