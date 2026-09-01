/**
 * bb-taper-adaptive.test.ts — Фаза 3.12/3.13/3.15/3.18.
 *  - 12: recommendBBTaperConfig (усталость/ACWR/sRPE → weeksOut + volumeMult) + sRPEAdjustment
 *  - 13: coordinateLastHeavyDay + addPeakPriming (последний тяжёлый день + прайминг 50-70%)
 *  - 15: buildPreTaperCascade (плавная рампа воды/натрия в пик-неделю)
 *  - 18: planTwoShowSequence (overreach-неделя перед тапером)
 */
import { describe, it, expect } from 'vitest';
import {
  recommendBBTaperConfig, sRPEAdjustment, buildPreTaperCascade,
  coordinateLastHeavyDay, addPeakPriming, planTwoShowSequence,
} from '../bb-contest-prep.engine';
import { buildBBPlan } from '../bb-builder.engine';

function cfg(over: any = {}): any {
  return {
    sex: 'male', category: 'mens_physique', weightKg: 80, bodyFatPct: 7,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 2,
    showDate: '2026-09-01', weeksOut: 2, trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate', waterStrategy: 'moderate', sodiumStrategy: 'cut_2d',
    ...over,
  };
}

describe('Фаза 3.12: адаптивный тапер', () => {
  it('высокая усталость → taper ≥3 нед', () => {
    const r = recommendBBTaperConfig({ fatigue: 85 });
    expect(r.weeksOut).toBeGreaterThanOrEqual(3);
  });
  it('ACWR danger → taper ≥3 нед + объём −15%', () => {
    const r = recommendBBTaperConfig({ acwrRatio: 1.7 });
    expect(r.weeksOut).toBeGreaterThanOrEqual(3);
    expect(r.volumeMult).toBeLessThan(1);
  });
  it('ACWR недогруз → taper ≤2 нед', () => {
    const r = recommendBBTaperConfig({ acwrRatio: 0.7 });
    expect(r.weeksOut).toBeLessThanOrEqual(2);
  });
  it('sRPE-перегрузка (высокая монотонность+strain) → taper 3 нед', () => {
    const sessions = Array.from({ length: 7 }, () => ({ sRPE: 8 }));
    const r = recommendBBTaperConfig({ recentSessions: sessions as any });
    expect(r.weeksOut).toBeGreaterThanOrEqual(3);
  });
  it('sRPEAdjustment: strain = mean×n', () => {
    const s = sRPEAdjustment([{ sRPE: 6 }, { sRPE: 7 }, { sRPE: 5 }] as any);
    expect(s.strain).toBe(18);
    expect(s.monotony).toBeGreaterThan(0);
  });
});

describe('Фаза 3.13: последний тяжёлый день + прайминг', () => {
  it('coordinateLastHeavyDay находит последнюю тяжёлую сессию', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const c = coordinateLastHeavyDay(plan);
    expect(c).not.toBeNull();
    expect(c!.character).toBe('тяж');
  });
  it('addPeakPriming добавляет прайминг-сеты в пик-неделю', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    // Помечаем неделю с реальными primary-сессиями как пик (последняя неделя может быть deload).
    const wi = plan.weeks.findIndex(w => (w.sessions || []).some(s => s.exercises.some((e: any) => (e as any).role === 'primary' && !(e as any).warmupActivator)));
    expect(wi).toBeGreaterThanOrEqual(0);
    (plan as any).weeks[wi].peakWeek = true;
    const { plan: out, added } = addPeakPriming(plan, { chest: 100, back: 100, quads: 120 });
    expect(added).toBeGreaterThanOrEqual(0);
    // Прайминг-сеты есть в последних сессиях пик-недели
    const primed = out.weeks[wi].sessions.some(s => s.exercises.some((e: any) => e.priming));
    expect(primed).toBe(true);
  });
});

describe('Фаза 3.15: pre-taper каскад', () => {
  it('tapered: плавная рампа к целям дня 1', () => {
    const cascade = buildPreTaperCascade(cfg({ waterStrategy: 'tapered' }));
    expect(cascade.length).toBe(7);
    // монотонность воды (не скачок)
    const waters = cascade.map(d => d.waterLiters);
    for (let i = 1; i < waters.length; i++) {
      expect(waters[i]).toBeGreaterThanOrEqual(waters[i - 1] - 0.01);
    }
  });
  it('stable: без агрессивной рампы — база удерживается', () => {
    const cascade = buildPreTaperCascade(cfg({ waterStrategy: 'stable' }));
    expect(cascade.length).toBe(7);
    expect(cascade[0].waterLiters).toBeGreaterThanOrEqual(2);
  });
});

describe('Фаза 3.18: двух-шоу секвенирование + overreach', () => {
  it('overreach-недели перед тапером получают +объём', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 8 } as any);
    const { applied, notes } = planTwoShowSequence(plan, [{ weekNumber: 8 }, { weekNumber: 5 }], { overreachPct: 0.12 });
    expect(applied).toBeGreaterThan(0);
    expect(notes.some(n => n.includes('Overreach'))).toBe(true);
  });
  it('без шоу — no-op', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const { applied, notes } = planTwoShowSequence(plan, []);
    expect(applied).toBe(0);
    expect(notes).toEqual([]);
  });
});
