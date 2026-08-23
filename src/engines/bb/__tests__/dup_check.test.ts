import { buildBBPlan } from '../bb-builder.engine';
describe('dup_check', () => {
  it('no duplicate leg_ext/pullover/fly in same session', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6',
      level: 'intermediate',
      goal: 'mass',
      weeks: 1,
    });
    for (let si=0; si<plan.weeks[0].sessions.length; si++) {
      const sess = plan.weeks[0].sessions[si];
      const chestNames = sess.exercises.filter(e=>e.muscle==='chest' && !(e as any).warmupActivator).map(e=>e.name.toLowerCase());
      const quadsNames = sess.exercises.filter(e=>e.muscle==='quads' && !(e as any).warmupActivator).map(e=>e.name.toLowerCase());
      const backNames = sess.exercises.filter(e=>e.muscle==='back' && !(e as any).warmupActivator).map(e=>e.name.toLowerCase());
      const pull = backNames.filter(n=> /пуловер|pullover|прям.*рук/.test(n)).length;
      const lege = quadsNames.filter(n=> /разгибан.*ног|leg.?ext/.test(n)).length;
      const cross = chestNames.filter(n=> /кроссовер|сведен.*кросс|crossover/.test(n)).length;
      const flyCount = chestNames.filter(n=> /развод|fly|сведен|пек.?дек|кроссовер/i.test(n)).length;
      if (pull>1 || lege>1 || cross>1 || flyCount>1) {
        console.log(`FAIL sess ${si} ${sess.sessionTag}:`, sess.exercises.map(e=>`${e.muscle}:${e.name}`));
        console.log(` pull=${pull} leg=${lege} cross=${cross} fly=${flyCount}`);
      }
      // allow at most 1 per isolation pattern per session (per muscle)
      expect(pull).toBeLessThanOrEqual(1);
      expect(lege).toBeLessThanOrEqual(1);
      expect(cross).toBeLessThanOrEqual(1);
      expect(flyCount).toBeLessThanOrEqual(1);
    }
  });
});
