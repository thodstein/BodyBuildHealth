import { LEVEL_VOLUMES, TRAINING_GOAL_CONFIGS, calcExercisePrescription } from '../src/engines/training.engine';
import { RIR_MATRIX, calculateRIR, calculateWeeklyProgression, generateWeeklyPlan } from '../src/engines/rir-matrix.engine';
import { estimate1RM, calcSuggestedWeight, getDeloadRecommendation } from '../src/engines/progression.engine';
import { mrvPerGroup, mevPerGroup, mavPerGroup, getVolumeLandmarks } from '../src/engines/volume-landmarks.engine';

const P = (label: string, v: unknown) => console.log(`${label}: ${JSON.stringify(v)}`);

console.log('===== AUD3 TEST CASES =====');

// 1. LEVEL_VOLUMES.intermediate
P('LEVEL_VOLUMES.intermediate', LEVEL_VOLUMES.intermediate);
console.log('  expect mev10/mav16/mrv20:', LEVEL_VOLUMES.intermediate.mev===10 && LEVEL_VOLUMES.intermediate.mav===16 && LEVEL_VOLUMES.intermediate.mrv===20 ? 'OK' : 'MISMATCH');

// 2. volume-landmarks consistency vs LEVEL_VOLUMES
console.log('\n--- volume-landmarks vs LEVEL_VOLUMES (chest, intermediate) ---');
const vl = getVolumeLandmarks('intermediate','chest');
P('volume-landmarks chest/intermediate', vl);
console.log('  LEVEL_VOLUMES.intermediate', LEVEL_VOLUMES.intermediate);
console.log('  mrvPerGroup chest', mrvPerGroup('intermediate')?.chest);
console.log('  mevPerGroup chest', mevPerGroup('intermediate')?.chest);
console.log('  mavPerGroup chest', mavPerGroup('intermediate')?.chest);

// 3. calcExercisePrescription strength/advanced/compound
const compoundEx = { id:'squat', name:'Присед', type:'compound', group:'legs', muscle:'quads' } as any;
const presc = calcExercisePrescription(compoundEx,'strength','advanced',false,false,1,1,12);
P('calcExercisePrescription strength/adv/compound wk1/12', presc);
console.log('  expect sets~4, reps 3-6, rir 2-3');

// 4. calcExercisePrescription deload
const prescDeload = calcExercisePrescription(compoundEx,'strength','advanced',false,true,1,4,12);
P('calcExercisePrescription deload isDeload=true wk4/12', prescDeload);
console.log('  expect sets*0.6, rir4');

// 5. calcExercisePrescription week4 NOT deload param (phase=deload via %4)
const prescWk4 = calcExercisePrescription(compoundEx,'strength','advanced',false,false,1,4,12);
P('calcExercisePrescription wk4/12 isDeload=false (phase should be deload via %4)', prescWk4);
console.log('  BUG CHECK: phase=deload but isDeload=false -> sets NOT reduced, rir NOT 4?');

// 6. rir-matrix calculateRIR
P('calculateRIR hypertrophy/intermediate/build', calculateRIR('hypertrophy','intermediate','build',1,false,false,80,30));
console.log('  expect RIR 1-2');

// 7. weekly progression
const input = { level:'intermediate', goal:'hypertrophy', daysPerWeek:4, splitType:'auto', recovery:80, fatigue:30, nutrition:80, weakPoints:[], periodizationType:'linear', cycleType:'pl_peaking' } as any;
const prog = generateWeeklyPlan(input, 6);
console.log('\n--- weekly progression (hypertrophy/intermediate, 6 wk) ---');
prog.forEach(w => console.log(`  wk${w.weekNumber}: phase=${w.phase} volume=${w.volumeTotal} rir=${w.rir} type=${w.progressionType}`));
console.log('  expect monotonic RIR decrease base->build->peak');

// 8. estimate1RM blend
console.log('\n--- estimate1RM blend ---');
P('100x8 (expect Epley 126.7)', estimate1RM(100,8));
P('100x12 (expect Brzycki 144)', estimate1RM(100,12));
P('100x3 (expect Epley 110)', estimate1RM(100,3));
P('100x15 (expect clamp)', estimate1RM(100,15));

// 9. calcSuggestedWeight
console.log('\n--- calcSuggestedWeight ---');
P('calcSuggestedWeight', (()=>{ try { return calcSuggestedWeight([{date:'2026-06-01',exercise:'squat',weight:100,reps:8,sets:4} as any]); } catch(e){ return 'ERR '+(e as Error).message; } })());

// 10. getDeloadRecommendation - chronological sort check
console.log('\n--- getDeloadRecommendation (plateau, unsorted dates) ---');
const logs = [
  {date:'2026-06-20',exercise:'squat',weight:100,reps:8,sets:4,estimated1RM:126} as any,
  {date:'2026-06-01',exercise:'squat',weight:100,reps:8,sets:4,estimated1RM:126} as any,
  {date:'2026-06-10',exercise:'squat',weight:100,reps:8,sets:4,estimated1RM:126} as any,
];
P('getDeloadRecommendation', (()=>{ try { return getDeloadRecommendation(logs); } catch(e){ return 'ERR '+(e as Error).message; } })());
console.log('===== END =====');
