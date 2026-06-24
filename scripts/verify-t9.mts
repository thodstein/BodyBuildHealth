import { getExerciseDemo, listExercisesByGroup, muscleToRegion } from '../src/engines/lms/exercise-demo';
const demo = getExerciseDemo('bench_bar');
console.log('bench_bar demo:', demo ? {
  name: demo.name, type: demo.type, equipment: demo.equipment,
  targetMuscle: demo.targetMuscle, primary: demo.synergy.primary,
  techniqueLen: demo.technique.length, cues: demo.cues.length, errors: demo.commonErrors.length,
  progression: demo.progression.length, subs: demo.substitutes.length,
} : null);
const list = listExercisesByGroup('chest');
console.log('chest exercises:', list.length, '| first:', list[0]?.name);
console.log('muscleToRegion pectoralis:', muscleToRegion('pectoralis'), '| latissimus:', muscleToRegion('latissimus'), '| quadriceps:', muscleToRegion('quadriceps'));
const pass = demo && demo.technique.length>0 && demo.cues.length>=0 && list.length>0 && muscleToRegion('pectoralis')==='chest';
console.log(pass ? '✅ T9 PASS' : '❌ T9 FAIL');
if(!pass) process.exit(1);
