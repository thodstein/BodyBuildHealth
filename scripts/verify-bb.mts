import { planWeakPoints } from '../src/engines/bb/bb-weakpoint';
import { techniquesFor, INTENSITY_TECHNIQUES } from '../src/engines/bb/bb-intensity-techniques';
import { tempoFor, tutForSet, REST_BY_CHARACTER, TEMPO_BY_CHARACTER } from '../src/engines/bb/bb-tempo-rest';
import { splitForDays, femaleAdjust, mastersAdjust } from '../src/engines/bb/bb-demographics';
import { adaptForPEDs, explainPEDAdaptation } from '../src/engines/bb/bb-ped-adaptation.engine';
import { generateDeload, getAllTechniques, getCues } from '../src/engines/genetic-deload-technique.engine';
import { detectOvertraining } from '../src/engines/overtraining-scheduler.engine';
import { calculatePlates } from '../src/engines/gym-competition.engine';
import { generatePLPeaking } from '../src/engines/peaking-engine';
import { getVolumeLandmarks } from '../src/engines/volume-landmarks.engine';

let pass=0, fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?'  ✅':'  ❌',l);};

console.log('===== BB9-19 functional =====');
// BB9: weakpoint adds +10% to THAT muscle's MAV (not cross-muscle)
const wp = planWeakPoints(['chest'], ['chest','back','legs'], 'intermediate');
const chestMAV = getVolumeLandmarks('intermediate','chest')!.mav;
ok(wp.volumeMap.chest.source==='MAV+10%' && wp.volumeMap.chest.sets === Math.round(chestMAV*1.1) && wp.volumeMap.back.source==='MAV', 'BB9 weakpoint: chest MAV+10% (vs its own MAV), back MAV');
const sp = planWeakPoints(['chest'], ['chest','back','legs'], 'advanced', true);
ok(sp.specialization && sp.emphasisMuscles.includes('chest') && sp.volumeMap.back.source==='MEV', 'BB9 specialization: emphasis MAV+10%, rest MEV');

// BB11: techniques per character; BFR is a памп technique
const techТяж = techniquesFor('тяж','advanced');
const techПамп = techniquesFor('памп','advanced');
ok(techТяж.length>0 && techПамп.length>0, 'BB11 techniques for тяж + памп');
ok(!!INTENSITY_TECHNIQUES.find(t=>t.technique==='bfr') && !!INTENSITY_TECHNIQUES.find(t=>t.technique==='lengthened_partials') && !!INTENSITY_TECHNIQUES.find(t=>t.technique==='myo_rep'), 'BB11 DB has BFR + lengthened + myo');

// BB12: tempo + rest
ok(TEMPO_BY_CHARACTER.тяж.notation==='2-1-1-0' && TEMPO_BY_CHARACTER.тяж.tutPerRep===4, 'BB12 tempo тяж 2-1-1-0');
ok(tutForSet(8,'тяж')===32, 'BB12 TUT = 4×8=32');
ok(REST_BY_CHARACTER.тяж===180 && REST_BY_CHARACTER.памп===60 && REST_BY_CHARACTER.тяж>REST_BY_CHARACTER.памп, 'BB12 rest тяж180 > памп60');

// BB17: demographics
ok(splitForDays(6)==='ppl_6' && splitForDays(4)==='upper_lower_4', 'BB17 splitForDays');
ok(femaleAdjust().emphasisMuscles.includes('glutes'), 'BB17 femaleAdjust glute emphasis');
ok(mastersAdjust(55).mrvMultiplier<1, 'BB17 mastersAdjust MRV↓');

// BB15: PED
const ped = adaptForPEDs(['AAS','insulin','GH'], {chest:20,legs:24});
console.log('PED explain:', explainPEDAdaptation(ped).slice(0,120));
ok(ped.combinedMrvMultiplier>1 && ped.adjustedMrv.chest>20 && ped.periWorkoutCarbs==='high', 'BB15 PED combinedMrvMultiplier>1, adjustedMrv, carbs high');

console.log('\n===== T1/T4/T6/PL2 REUSE =====');
ok(typeof calculatePlates==='function', 'T4 calculatePlates');
ok(typeof generatePLPeaking==='function', 'T1 generatePLPeaking');
ok(typeof generateDeload==='function', 'T6 generateDeload');
ok(typeof detectOvertraining==='function', 'T6 detectOvertraining');
const cues = getAllTechniques();
ok(cues.length>0 && getCues(cues[0].name).length>0, 'PL2 technique-cues (getAllTechniques/getCues)');
console.log('PL2 cues:', cues.length, '| sample:', cues[0].name);

console.log(`\n===== ИТОГ: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);

