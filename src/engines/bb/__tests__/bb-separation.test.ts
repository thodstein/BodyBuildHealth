import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 120, back: 130, shoulders: 70, biceps: 60, triceps: 65, quads: 150, hamstrings: 110, glutes: 150, calves: 90, abs: 70, traps: 90, forearms: 45 };

const dayEx = (plan: any, tag: string) => plan.weeks.flatMap((w:any)=>w.sessions).filter((s:any)=>(s.sessionTag||'').toLowerCase().includes(tag.toLowerCase())).flatMap((s:any)=>s.exercises.map((e:any)=>e.name.toLowerCase()));

describe('BB прорисовка/сепарация вторичных мышц по дням', () => {
  it('средняя дельта в груди (махи) присутствует', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const push = dayEx(plan, 'push');
    expect(push.some(n => n.includes('махи') || n.includes('отведение') || n.includes('lateral') || n.includes('средн'))).toBe(true);
  });

  it('задняя дельта в спине присутствует', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const pull = dayEx(plan, 'pull');
    expect(pull.some(n => n.includes('задн') || n.includes('к лицу') || n.includes('face') || n.includes('обратн'))).toBe(true);
  });

  it('RDL на растяжение (бицепс бедра) в ножном дне присутствует', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const legs = dayEx(plan, 'legs');
    expect(legs.some(n => n.includes('румын') || n.includes('rdl') || n.includes('мёртв'))).toBe(true);
  });
});
