import { describe, it, expect } from 'vitest';
import { buildArmTaperCurve, applyArmTaperToWeeks } from '../arm-taper.engine';

describe('arm-taper', () => {
  it('2 недели: 0.65/0.45', () => {
    const c = buildArmTaperCurve({ taperWeeks: 2 });
    expect(c.length).toBe(2);
    expect(c[0].volumePct).toBe(0.65);
    expect(c[1].volumePct).toBe(0.45);
  });
  it('3 недели', () => {
    const c = buildArmTaperCurve({ taperWeeks: 3 });
    expect(c.length).toBe(3);
    expect(c[2].volumePct).toBe(0.45);
  });
  it('sideMult уменьшается к пику', () => {
    const c = buildArmTaperCurve({ taperWeeks: 2 });
    expect(c[1].sideMult).toBeLessThan(c[0].sideMult);
  });
  it('apply: объём режется', () => {
    const weeks: any[] = [
      { week: 1, sessions: [{ exercises: [{ muscle:'wrist_flexors', sets:4, rir:2, workSets:[{rir:2},{rir:2},{rir:2},{rir:2}] }] }] },
      { week: 2, sessions: [{ exercises: [{ muscle:'wrist_flexors', sets:4, rir:2, workSets:[{rir:2},{rir:2},{rir:2},{rir:2}] }] }] },
    ];
    const curve = buildArmTaperCurve({ taperWeeks:2 });
    applyArmTaperToWeeks(weeks, curve);
    expect(weeks[1].sessions[0].exercises[0].sets).toBeLessThan(4);
    expect(weeks[1].sessions[0].exercises[0].rir).toBeGreaterThan(2);
    expect(weeks[1].note).toMatch(/\[arm-taper:/);
  });
  it('идемпотентность', () => {
    const weeks: any[] = [{ week:1, sessions:[{ exercises:[{ muscle:'side_pressure', sets:4, rir:2, workSets:[{rir:2},{rir:2},{rir:2},{rir:2}] }] }] }];
    const c = buildArmTaperCurve({taperWeeks:1});
    applyArmTaperToWeeks(weeks, c);
    const after1 = weeks[0].sessions[0].exercises[0].sets;
    applyArmTaperToWeeks(weeks, c);
    expect(weeks[0].sessions[0].exercises[0].sets).toBe(after1);
  });
  it('side_pressure режется сильнее', () => {
    const weeks: any[] = [{ week:1, sessions:[{ exercises:[
      { muscle:'wrist_flexors', sets:4, rir:2, workSets:[{rir:2},{rir:2},{rir:2},{rir:2}] },
      { muscle:'side_pressure', sets:4, rir:2, workSets:[{rir:2},{rir:2},{rir:2},{rir:2}] },
    ] }] }];
    const c = buildArmTaperCurve({taperWeeks:1});
    applyArmTaperToWeeks(weeks, c);
    const wf = weeks[0].sessions[0].exercises.find((e:any)=>e.muscle==='wrist_flexors').sets;
    const sp = weeks[0].sessions[0].exercises.find((e:any)=>e.muscle==='side_pressure').sets;
    expect(sp).toBeLessThan(wf);
  });
});
