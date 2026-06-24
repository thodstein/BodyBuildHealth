import { calcSuggestedWeight, getDeloadRecommendation, selectProgressionRule, estimate1RM } from '../src/engines/progression.engine';

const rule = selectProgressionRule('intermediate');
const logs = [
  { date:'2026-06-01', exerciseId:'squat', isCompound:true, sets:[{weight:100,reps:8}], estimated1RM:126 } as any,
  { date:'2026-06-08', exerciseId:'squat', isCompound:true, sets:[{weight:100,reps:8}], estimated1RM:126 } as any,
  { date:'2026-06-15', exerciseId:'squat', isCompound:true, sets:[{weight:100,reps:8}], estimated1RM:126 } as any,
  { date:'2026-06-22', exerciseId:'squat', isCompound:true, sets:[{weight:100,reps:8}], estimated1RM:126 } as any,
];
console.log('--- calcSuggestedWeight (4 identical logs, plateau) ---');
console.log(JSON.stringify(calcSuggestedWeight('squat', logs, 5, rule, 'hypertrophy', true), null, 0));
console.log('--- getDeloadRecommendation (4 plateau logs, recovery 80, weeksSinceDeload 5, RPE 8) ---');
console.log(JSON.stringify(getDeloadRecommendation(logs, 8, 5, 80)));
console.log('--- getDeloadRecommendation (recovery 35) ---');
console.log(JSON.stringify(getDeloadRecommendation([], 8, 2, 35)));
console.log('--- estimate1RM edge: reps 1, reps 20 (clamp to 15) ---');
console.log('1rm reps1:', estimate1RM(100,1), ' reps20:', estimate1RM(100,20), ' reps16:', estimate1RM(100,16));
