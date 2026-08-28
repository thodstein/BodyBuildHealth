import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { validateBBPlan } from '../bb-validator.engine';
import { sessionLimitsFor } from '../bb-volume.engine';

const WM = { chest:100, back:120, shoulders:60, biceps:50, triceps:60, quads:140, hamstrings:100, glutes:140, calves:80, abs:60, traps:80, forearms:40 };

describe('BB full 25 splits property', () => {
  it('all 25 splits generate valid plans for intermediate mass', () => {
    for (const pat of SPLIT_PATTERNS) {
      const plan = buildBBPlan({ patternId: pat.id, level:'intermediate', goal:'mass', weeks:4, workMax: WM });
      const v = validateBBPlan(plan);
      const errs = v.issues.filter(i=>i.level==='error');
      expect(errs, `${pat.id} errors: ${errs.map(e=>e.message).join('; ')}`).toHaveLength(0);
      const lim = sessionLimitsFor({ level:'intermediate', patternId: pat.id });
      for (const w of plan.weeks) for (const s of w.sessions) {
        const working = s.exercises.filter((e:any)=>!e.warmupActivator && !e.optional);
        expect(working.length, `${pat.id} week${w.week} ${s.sessionTag}`).toBeLessThanOrEqual(lim.maxExercises);
      }
    }
  }, 60000);

  it('bfr and blastCruise produce valid plans', () => {
    const p1 = buildBBPlan({ patternId:'upper_lower_4', level:'intermediate', goal:'mass', weeks:4, workMax: WM, bfrMode:true });
    expect(validateBBPlan(p1).issues.filter(i=>i.level==='error')).toHaveLength(0);
    const p2 = buildBBPlan({ patternId:'ppl_6', level:'advanced', goal:'mass', weeks:8, workMax: WM, blastCruiseEnabled:true, blastWeeks:4, cruiseWeeks:2 });
    expect(validateBBPlan(p2).issues.filter(i=>i.level==='error')).toHaveLength(0);
  }, 30000);
});
