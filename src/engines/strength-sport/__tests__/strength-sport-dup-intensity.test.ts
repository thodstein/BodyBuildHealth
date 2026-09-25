import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { buildSSCyclePlan } from '../strength-sport-ss-cycle-to-plan.engine';
import { applyDUP } from '../strength-sport-dup';
import { applyIntensity } from '../strength-sport-intensity';
import { lengthenedBonus } from '../strength-sport-bonus';
import { warmupRampFor } from '../strength-sport-warmup';

describe('strength DUP/intensity/bonus/warmup', () => {
  it('DUP heavy_light flips RIR', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{snatch:70} });
    const before = plan.weeksData[0].sessions[0].exercises[0].rir;
    applyDUP(plan, 'heavy_light');
    const afterHeavy = plan.weeksData[0].sessions[0].exercises[0].rir;
    const afterLight = plan.weeksData[0].sessions[1].exercises[0].rir;
    expect(afterHeavy).not.toBe(afterLight);
    expect(typeof before).toBe('number');
  });
  it('cluster adds comment', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{snatch:70, cleanJerk:90, backSquat:120} });
    applyIntensity(plan, 'cluster');
    const hasCluster = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.comment?.includes('Cluster'))));
    expect(hasCluster).toBe(true);
  });
  it('lengthenedBonus', () => {
    expect(lengthenedBonus('rdl')).toBe(10);
    expect(lengthenedBonus('bench_bar')).toBe(0);
  });
  it('warmup ramp', () => {
    const w = warmupRampFor(100);
    expect(w.length).toBeGreaterThanOrEqual(3);
    expect(w[0].weight).toBeLessThan(100);
  });
  it('dup via builder input', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{}, dupMode:'heavy_light' });
    expect(p.weeksData.length).toBe(2);
  });
  it('DUP wave: week%3 per lift — heavy/medium/light', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{snatch:80, backSquat:120} });
    // apply wave manually on isolated plan to test per-session wave logic
    const wave = JSON.parse(JSON.stringify(plan)) as typeof plan;
    applyDUP(wave, 'wave');
    const s0 = wave.weeksData[0].sessions[0].exercises[0];
    const s1 = wave.weeksData[0].sessions[1]?.exercises[0];
    const s2 = wave.weeksData[0].sessions[2]?.exercises[0];
    expect(s0).toBeDefined();
    if (s1 && s2) {
      // heavy (idx0): pct up, reps down, rir down; light (idx2): pct down, reps up, rir up
      const pct0 = s0.workSets[0]?.pct || 0;
      const pct2 = s2.workSets[0]?.pct || 0;
      expect(pct0).toBeGreaterThanOrEqual(pct2);
      expect(s0.rir).toBeLessThanOrEqual(s2.rir);
      expect(s0.workSets[0].reps).toBeLessThanOrEqual(s2.workSets[0].reps);
    }
  });
  /** Синтетический стронгмен-план: три event_day подряд (idx 0/1/2 → wave 0/1/2). */
  const smEventPlan = () => ({
    mode: 'strongman', level: 'intermediate', rationale: [],
    weeksData: [{
      week: 1, deload: false,
      sessions: [0, 1, 2].map(i => ({
        sessionTag: 'event_day',
        exercises: [
          { id: 'yoke_walk', rir: 2, sets: 3, workSets: [{ weight: 100, reps: 2, rir: 2, pct: 70 }] },
          { id: 'atlas_stone', rir: 2, sets: 3, workSets: [{ weight: 80, reps: 3, rir: 2, pct: 70 }] },
        ].map(e => ({ ...e, _i: i })),
      })),
    }],
  }) as any;

  it('strongman event_day: wave по idx%3 — max(0)/dynamic(1)/rep(2) — детерминированно', () => {
    const p = smEventPlan();
    applyDUP(p, 'heavy_light');
    const [s0, s1, s2] = p.weeksData[0].sessions;
    const carry = (s: any, id: string) => s.exercises.find((e: any) => e.id === id);
    // wave 0 (idx 0): carry → RIR−1, pct+5, вес ×1.05 (rounded 2.5)
    const c0 = carry(s0, 'yoke_walk');
    expect(c0.rir).toBe(1);
    expect(c0.workSets[0].pct).toBe(75);
    expect(c0.workSets[0].weight).toBe(105);
    // wave 1 (idx 1): stone → динамический темп X-0-X-0; RIR пишется в СЕТ (упражнение не меняется)
    const st1 = carry(s1, 'atlas_stone');
    expect(st1.workSets[0].tempo).toBe('X-0-X-0');
    expect(st1.workSets[0].rir).toBe(3);
    expect(st1.rir).toBe(2);
    // wave 2 (idx 2): ВСё → RIR+1, reps+1, pct−5, вес ×0.95
    const c2 = carry(s2, 'yoke_walk');
    expect(c2.rir).toBe(3);
    expect(c2.workSets[0].reps).toBe(3);
    expect(c2.workSets[0].pct).toBe(65);
    expect(c2.workSets[0].weight).toBe(95);
  });

  it('strongman event_day: НЕ dynamic/max без нужной волны (каждая ветка точечна)', () => {
    const p = smEventPlan();
    applyDUP(p, 'heavy_light');
    const [s0, s1, s2] = p.weeksData[0].sessions;
    const get = (s: any, id: string) => s.exercises.find((e: any) => e.id === id);
    // wave 0 — только carry: камень не должен получить pct+5
    expect(get(s0, 'atlas_stone').workSets[0].pct).toBe(70);
    // wave 1 — только stone: carry не должен получить X-0-X-0
    expect(get(s1, 'yoke_walk').workSets[0].tempo).toBeUndefined();
    // wave 2 — общий rep-режим: stone тоже +1 повтор
    expect(get(s2, 'atlas_stone').workSets[0].reps).toBe(4);
  });

  it('РЕГРЕСС-ЛОК: сработала ИМЕННО event_day-конъюгат, а не generic heavy/light', () => {
    // Сигнатура веток на одном и том же event_day (idx=2, heavy_light):
    //   conjugate wave 2 → вес ×0.95, reps +1, pct −5, RIR +1
    //   generic heavy_light idx%2===0 → вес ×1.03, reps −1, pct +3
    // Вес — самый однозначный признак: 0.95 против 1.03. Мутационно падает
    // при возврате бага (mode не передан → generic-ветка).
    const IN = { mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 3, daysPerWeek: 3, workMax: { yokeWalk: 200, farmersWalk: 140, atlasStone: 100 } } as any;
    const base: any = buildStrengthSportPlan(IN);
    const dup: any = buildStrengthSportPlan({ ...IN, dupMode: 'heavy_light' });
    const firstEventEx = (p: any) => {
      const wk = p.weeksData.find((w: any) => w.sessions.some((s: any) => s.sessionTag === 'event_day'));
      const s = wk!.sessions.find((x: any) => x.sessionTag === 'event_day');
      return s!.exercises[0];
    };
    const b = firstEventEx(base), d = firstEventEx(dup);
    expect(d.workSets[0].weight / b.workSets[0].weight).toBeCloseTo(0.95, 1);
    expect(d.workSets[0].weight).toBeLessThan(b.workSets[0].weight);
  });

  it('РЕГРЕСС-ЛОК: dupMode в билдере реально меняет event_day (rep-wave)', () => {
    const IN = { mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 3, daysPerWeek: 3, workMax: { yokeWalk: 200, farmersWalk: 140, atlasStone: 100 } } as any;
    const base: any = buildStrengthSportPlan(IN);
    const dup: any = buildStrengthSportPlan({ ...IN, dupMode: 'heavy_light' });
    const firstEventEx = (p: any) => {
      const wk = p.weeksData.find((w: any) => w.sessions.some((s: any) => s.sessionTag === 'event_day'));
      const s = wk!.sessions.find((x: any) => x.sessionTag === 'event_day');
      return s!.exercises[0];
    };
    const b = firstEventEx(base), d = firstEventEx(dup);
    // event_day на idx=2 → wave 2 (rep): RIR+1, reps+1, pct−5
    expect(d.rir).toBe(b.rir + 1);
    expect(d.workSets[0].reps).toBe(b.workSets[0].reps + 1);
    expect(d.workSets[0].pct).toBe(b.workSets[0].pct - 5);
  });

  it('cycle-путь тоже передаёт mode (buildSSCyclePlan + adapt + dupMode)', () => {
    const cyc: any = buildSSCyclePlan('ss-sm-531-4', { mode: 'strongman', goal: 'strength', level: 'advanced', weeks: 4, daysPerWeek: 4, dupMode: 'heavy_light', workMax: { yokeWalk: 200, farmersWalk: 140 } } as any, { cycleMode: 'adapt' });
    const noDup: any = buildSSCyclePlan('ss-sm-531-4', { mode: 'strongman', goal: 'strength', level: 'advanced', weeks: 4, daysPerWeek: 4, workMax: { yokeWalk: 200, farmersWalk: 140 } } as any, { cycleMode: 'adapt' });
    expect(cyc.rationale.join(' ')).toMatch(/DUP heavy_light применён/);
    expect(JSON.stringify(cyc.weeksData)).not.toBe(JSON.stringify(noDup.weeksData));
  });
});
