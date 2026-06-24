import { computeSessionMetrics } from '../src/ui/screens/SRCBBScreen_parts/sessionMetrics';
import type { WorkoutSession } from '../src/engines/workout-logger.engine';
import type { PlayerExercise } from '../src/ui/screens/SRCBBScreen_parts/SessionPlayer';

// mock plan day (SRC: Присед 120 PM, coef 1.2, mnosz 1, group ПР)
const day = { exercises: [
  { name:'Присед', muscleGroup:'ПР', targetSets:[], pm:120, coef:1.2, mnosz:1, group:'ПР' },
  { name:'Жим лежа', muscleGroup:'ЖМ', targetSets:[], pm:100, coef:1.2, mnosz:1, group:'ЖМ' },
] as PlayerExercise[] };

// mock actual session: Присед 81.6×6×4, Жим 68×8×4
const session: WorkoutSession = {
  sessionId:'s1', date:'2026-06-24', startTime:'10:00', endTime:'11:30', weekNumber:1,
  focus:'test', completed:true,
  exercises: [
    { exerciseId:'Присед', exerciseName:'Присед', pattern:'ПР', muscleGroup:'ПР',
      sets: [ {setNumber:1,weightKg:81.6,reps:6,rpe:0,rir:2,notes:''}, {setNumber:2,weightKg:81.6,reps:6,rpe:0,rir:2,notes:''},
              {setNumber:3,weightKg:81.6,reps:6,rpe:0,rir:2,notes:''}, {setNumber:4,weightKg:81.6,reps:6,rpe:0,rir:2,notes:''} ] },
    { exerciseId:'Жим лежа', exerciseName:'Жим лежа', pattern:'ЖМ', muscleGroup:'ЖМ',
      sets: [ {setNumber:1,weightKg:68,reps:8,rpe:0,rir:2,notes:''}, {setNumber:2,weightKg:68,reps:8,rpe:0,rir:2,notes:''},
              {setNumber:3,weightKg:68,reps:8,rpe:0,rir:2,notes:''}, {setNumber:4,weightKg:68,reps:8,rpe:0,rir:2,notes:''} ] },
  ],
} as unknown as WorkoutSession;

const r = computeSessionMetrics(session, day);
console.log('D1 result:', JSON.stringify(r ? {
  tonnage: Math.round(r.metrics.tonnage),
  kpsh: r.metrics.kpsh,
  relInt: +r.metrics.relIntensity.toFixed(4),
  uoi: +r.metrics.uoi.toFixed(4),
  intFB: Math.round(r.metrics.intFB),
  avgWeight: Math.round(r.metrics.avgWeight),
  minutes: r.minutes,
  ex: r.exerciseCount,
} : null));
// ожидания: Присед 81.6×6×4 = тоннаж 1958.4×1.2(mnosz)=2350; Жим 68×8×4=2176×1.2=2611; total ~4961
// КПШ: 24+32=56; Инт.отн: ср.вес/(PM×mnosz)
const pass = r && r.metrics.tonnage>0 && r.metrics.kpsh===56 && r.metrics.relIntensity>0.5 && r.metrics.relIntensity<0.8 && r.exerciseCount===2;
console.log(pass ? '✅ D1 PASS' : '❌ D1 FAIL');
if(!pass) process.exit(1);
