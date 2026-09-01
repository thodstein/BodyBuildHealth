import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
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
  it('strongman conjugate weekly wave week%3: max/dynamic/rep', () => {
    // event_day conjugate: week 1 max, week 2 dynamic (X-0-X-0), week 3 rep
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:3, daysPerWeek:3, workMax:{ yokeWalk:200, farmersWalk:140 } } as any);
    const w1 = p.weeksData[0].sessions.find(s=> s.sessionTag==='event_day');
    const w2 = p.weeksData[1].sessions.find(s=> s.sessionTag==='event_day');
    const w3 = p.weeksData[2].sessions.find(s=> s.sessionTag==='event_day');
    // w2 (week%3==2 → dynamic) should have X-0-X-0 tempo on at least one carry/stone
    if (w2) {
      const hasDynamic = w2.exercises.some(e=> e.workSets.some((ws:any)=> ws.tempo==='X-0-X-0'));
      expect(hasDynamic).toBe(true);
      const pcts = w2.exercises.map(e=> e.workSets[0]?.pct||0);
      // dynamic pct lower than max week
      if (w1) {
        const pctMax = Math.max(...w1.exercises.map(e=> e.workSets[0]?.pct||0));
        const pctDyn = Math.min(...pcts);
        expect(pctDyn).toBeLessThanOrEqual(pctMax);
      }
    }
    if (w3) {
      // rep week: reps should be higher / pct lower than max
      const reps3 = w3.exercises[0]?.workSets[0]?.reps || 0;
      const reps1 = w1?.exercises[0]?.workSets[0]?.reps || 0;
      expect(reps3).toBeGreaterThanOrEqual(reps1);
    }
    if (w1) {
      const rir1 = w1.exercises[0]?.rir ?? 2;
      const rir2 = w2?.exercises[0]?.rir ?? 2;
      // max: RIR-1 vs dynamic RIR+1
      expect(rir1).toBeLessThanOrEqual(rir2);
    }
  });
  it('strongman carry wave pct zones max 90 / dynamic 70 / rep volume', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'advanced', weeks:6, daysPerWeek:3, workMax:{ yokeWalk:240 } } as any);
    const eventWeeks = p.weeksData.filter(w=> w.sessions.some(s=> s.sessionTag==='event_day'));
    expect(eventWeeks.length).toBeGreaterThanOrEqual(3);
    // ensure three consecutive waves have distinct pct levels
    const pcts = eventWeeks.slice(0,3).map(w=> {
      const ev = w.sessions.find(s=> s.sessionTag==='event_day')!;
      return Math.max(...ev.exercises.map(e=> e.workSets[0]?.pct||0));
    });
    // max (~90%+) > dynamic (~70% region with -15%) roughly
    expect(pcts[0]).toBeGreaterThan(pcts[1]);
    expect(pcts[2]).toBeGreaterThanOrEqual(pcts[1]);
  });
});
