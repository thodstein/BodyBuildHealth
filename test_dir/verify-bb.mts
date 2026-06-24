import { rankBBSplits, selectBestBBSplit } from '../src/engines/bb/bb-selector.engine';
import { buildBBPlan } from '../src/engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../src/engines/bb/bb-metrics.engine';
import { adaptForPEDs, PED_EFFECTS, explainPEDAdaptation } from '../src/engines/bb/bb-ped-adaptation.engine';
import { mrvPerGroup } from '../src/engines/volume-landmarks.engine';

let pass=0, fail=0;
function ok(name:string, cond:boolean, extra=''){ if(cond){pass++; console.log(`PASS  ${name} ${extra}`);} else {fail++; console.log(`FAIL  ${name} ${extra}`);} }

const ranked = rankBBSplits({ level:'intermediate', goal:'mass', daysPerWeek:4, mode:'natural' });
ok('rankBBSplits non-empty', ranked.length>0, `n=${ranked.length}`);
const best = selectBestBBSplit({ level:'intermediate', goal:'mass', daysPerWeek:4, mode:'natural' });
ok('best split chosen', !!best, best?`${best.pattern.id} score=${best.score}`:'null');
console.log('  best:', best?.pattern.id, 'score', best?.score);

const plan = buildBBPlan({
  patternId: best!.pattern.id, level:'intermediate', goal:'mass', weeks:6,
  workMax: { chest:100, back:110, quads:140, hamstrings:120, shoulders:60, biceps:40, triceps:50, calves:120, glutes:160, abs:60 },
  mode:'natural',
});
ok('plan has weeks', plan.weeks.length===6, `weeks=${plan.weeks.length}`);
const w1 = plan.weeks[0];
ok('week1 has sessions', w1.sessions.length>0, `sessions=${w1.sessions.length}`);
const s1 = w1.sessions[0];
ok('session has exercises', s1.exercises.length>0, `ex=${s1.exercises.length}`);
const ex0 = s1.exercises[0];
ok('exercise has workSets', ex0.workSets.length>0, `workSets=${ex0.workSets.length}`);
ok('set has weight>0', ex0.workSets[0].weight>0, `w=${ex0.workSets[0].weight} reps=${ex0.workSets[0].reps} rir=${ex0.workSets[0].rir}`);
console.log('  sample:', ex0.muscle, ex0.role, ex0.character, '->', JSON.stringify(ex0.workSets[0]));

const m = calcBBPlanMetrics(plan);
ok('metrics totalSets>0', m.totalSets>0, `sets=${m.totalSets}`);
ok('metrics perMuscle non-empty', Object.keys(m.perMuscle).length>0, `muscles=${Object.keys(m.perMuscle).length}`);
console.log('  metrics:', explainBBMetrics(m).split('\n').slice(0,4).join(' | '));

const base = mrvPerGroup('advanced');
const adapted = adaptForPEDs(['AAS','GH'], base);
console.log('  ped:', explainPEDAdaptation(adapted).split('\n').slice(0,3).join(' | '));
ok('PED_EFFECTS has AAS', !!PED_EFFECTS.AAS, `mrvMult=${PED_EFFECTS.AAS.mrvMultiplier}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if(fail>0) process.exit(1);
