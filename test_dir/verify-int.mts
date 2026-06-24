// Smoke-test INT REUSE-движков: workout-logger (T3) + gym-competition plates (T4).
import { startSession, addExerciseToSession, logSet, finishSession, loadSessions } from '../src/engines/workout-logger.engine';
// localStorage mock for Node
const _store: Record<string,string> = {};
(globalThis as any).localStorage = { getItem:(k:string)=>_store[k]??null, setItem:(k:string,v:string)=>{_store[k]=v;}, removeItem:(k:string)=>{delete _store[k];} } as any;

import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence } from '../src/engines/gym-competition.engine';

let pass=0, fail=0;
const ok=(n:string,c:boolean,x='')=>{ if(c){pass++;console.log(`PASS ${n} ${x}`);}else{fail++;console.log(`FAIL ${n} ${x}`);} };

// T4 plates
const p = calculatePlates(100, 20);
ok('plates actualWeight==100', Math.abs(p.actualWeight-100)<0.5, `actual=${p.actualWeight} dev=${p.deviation.toFixed(2)}`);
ok('platesPerSide non-empty', p.platesPerSide.length>0, p.platesPerSide.map(x=>`${x.plate}x${x.count}`).join('+'));
const warm = warmupPlateSequence(140);
ok('warmup 5 sets', warm.length===5, `sets=${warm.length}`);
ok('warmup last = 85% of 140 (~120)', Math.abs(warm[4].weight-120)<=2, `last=${warm[4].weight}`);
console.log('  order:', getPlateLoadingOrder(100,20).slice(0,3).join(' | '));

// T3 session logger (localStorage mock)
let s = startSession('СРЦ тест', 1);
s = addExerciseToSession(s, { id:'Присед', name:'Присед', pattern:'ЖМ', muscleGroup:'legs' });
s = logSet(s, 0, { setNumber:1, weightKg:81.6, reps:6, rpe:0, rir:0, notes:'' });
s = logSet(s, 0, { setNumber:2, weightKg:81.6, reps:6, rpe:0, rir:0, notes:'' });
ok('session has 2 sets logged', s.exercises[0].sets.length===2, `sets=${s.exercises[0].sets.length}`);
const fin = finishSession(s, 'тест');
ok('finished has endTime', !!fin.endTime, fin.endTime);
console.log('  sessions stored:', loadSessions().length);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if(fail>0) process.exit(1);

// INT4 autoregulation
import { autoregulate } from '../src/engines/autoregulation-engine';
const ar = autoregulate({ priScore:0.7, fatigueScore:0.3, recoveryScore:0.7, jointFatigue:{spine:0.2,knee:0.2,shoulder:0.2}, cumulativeLoad:{overload:false,monotony:1.1,strain:0.3}, riskLevel:'low', techniqueScore:0.8, velocityTrend:1, goal:'strength', plannedIntensity:80, plannedSets:5, plannedReps:5, plannedFrequency:4, exerciseJointStress:{squat:0.7,bench:0.4,deadlift:0.8} });
ok('autoreg summary non-empty', !!ar.summary && ar.summary.length>0, `cancel=${ar.sessionCancelled} down=${ar.sessionDowngraded}`);
ok('autoreg intensity decision', !!ar.intensity.adjustment, `${ar.intensity.adjustment} ${ar.intensity.targetIntensity}%1RM RIR${ar.intensity.targetRIR}`);
const arLow = autoregulate({ priScore:0.1, fatigueScore:0.85, recoveryScore:0.2, jointFatigue:{spine:0.9,knee:0.5,shoulder:0.2}, cumulativeLoad:{overload:true,monotony:1.5,strain:0.85}, riskLevel:'high', techniqueScore:0.5, velocityTrend:-3, goal:'strength', plannedIntensity:85, plannedSets:5, plannedReps:5, plannedFrequency:4, exerciseJointStress:{squat:0.7,bench:0.4,deadlift:0.8} });
ok('autoreg cancels/downgrades on low readiness', arLow.sessionCancelled || arLow.sessionDowngraded, `cancel=${arLow.sessionCancelled} down=${arLow.sessionDowngraded}`);

// INT3 peaking
import { generatePLPeaking, generateBBPeaking } from '../src/engines/peaking-engine';
const pl = generatePLPeaking({ meetDate:'2026-07-20', current1RM:{squat:140,bench:100,deadlift:180}, fatigue:0.3, pri:0.7 });
ok('PL peaking plan weeks>0', pl.plan.length>0, `weeks=${pl.plan.length} taper=${pl.taperWeeks}`);
ok('PL meetDayInstructions', pl.meetDayInstructions.length>0, `instr=${pl.meetDayInstructions.length}`);
const bbp = generateBBPeaking({ showDate:'2026-07-01', conditioning:0.7, fullness:0.6, dryness:0.6, carbTolerance:0.7 });
ok('BB peaking weekPlan 7 days', bbp.weekPlan.length===7, `days=${bbp.weekPlan.length}`);

import { generateAttemptStrategy } from '../src/engines/gym-competition.engine';
const att = generateAttemptStrategy(140,100,180);
ok('attemptStrategy 3 lifts', att.length===3, `lifts=${att.map(a=>a.lift).join(',')}`);
console.log('  attempts:', att.map(a=>`${a.lift}:${a.opener.split(' ')[0]}`).join(' '));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if(fail>0) process.exit(1);

// INT5 recovery + mobility
import { analyzeRecovery, shouldTrain } from '../src/engines/recovery-optimization.engine';
import { getMobilityFlows, getAllCorrectives } from '../src/engines/federation-grip-mobility.engine';
const rec = analyzeRecovery({ sleep:{hours:7.5,quality:4,bedtime:'23:00',wakeTime:'07:00',latencyMin:10,awakenings:1}, hrv:{rmssd:55,sdnn:50,restingHR:58,readinessScore:70}, fatigueScore:0.3, trainingDaysThisWeek:4, currentWeek:4, periodizationPhase:'accumulation', recentPR:false, injuryHistory:[] });
ok('recovery index 0-100', rec.overallRecoveryIndex>=0 && rec.overallRecoveryIndex<=100, `idx=${rec.overallRecoveryIndex} label=${rec.readinessLabel}`);
ok('recovery recs present OR excellent', rec.recommendations.length > 0 || rec.overallRecoveryIndex > 70, `idx=${rec.overallRecoveryIndex} recs=${rec.recommendations.length}`);
const vt = shouldTrain(rec.overallRecoveryIndex, 0.3);
ok('shouldTrain returns verdict', typeof vt.train === 'boolean', `train=${vt.train} mod=${vt.intensityMod}`);
ok('mobilityFlows non-empty', getMobilityFlows().length>0, `flows=${getMobilityFlows().length}`);
ok('correctives non-empty', getAllCorrectives().length>0, `n=${getAllCorrectives().length}`);

// INT6 movement + biomechanics
import { classifyMovement, getMuscleSynergy, getJointStress, assessSafety } from '../src/engines/movement-engines';
import { quickSafetyCheck } from '../src/engines/biomechanics-risk-engine';
const cls = classifyMovement('back_squat');
ok('classify back_squat pattern=squat', cls.pattern === 'squat', `pattern=${cls.pattern}`);
const syn = getMuscleSynergy('bench_press');
ok('synergy primary non-empty', syn.primary.length>0, `primary=${syn.primary.join(',')}`);
const st = getJointStress('deadlift');
ok('jointStress has spine', !!st.spine, `spine=${st.spine.level}`);
const sf = assessSafety('back_squat', ['knee'], 0.8);
ok('assessSafety score 0-100', sf.score>=0 && sf.score<=100, `score=${sf.score} level=${sf.level}`);
const qs = quickSafetyCheck('back_squat', { knee:'high', hip:'low', spine:'low', shoulder:'low', elbow:'low', ankle:'low' });
ok('quickSafetyCheck returns safe bool', typeof qs.safe === 'boolean', `safe=${qs.safe} reason="${qs.reason}"`);

console.log(`\n=== FINAL: ${pass} passed, ${fail} failed ===`);
if(fail>0) process.exit(1);
