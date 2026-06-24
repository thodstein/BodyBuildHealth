import { selectBestCycle } from '../src/engines/lms/lms-selector.engine';
import { buildLMSPlan } from '../src/engines/lms/lms-builder.engine';
import { getCycleById } from '../src/data/lms-cycles/lms-cycle-index';
import { selectBestBBSplit } from '../src/engines/bb/bb-selector.engine';
import { buildBBPlan } from '../src/engines/bb/bb-builder.engine';
import { calcBBPlanMetrics } from '../src/engines/bb/bb-metrics.engine';

// D2 verify: chart data shapes
const best = selectBestCycle({ goal:'strength', level:'II-KMS', bodyWeight:85, daysPerWeek:3, direction:'powerlifting', mode:'natural' })!;
const built = buildLMSPlan({ template: getCycleById(best.cycle.meta.id)!, pmMap:{'Присед':120,'Жим лежа':100,'Тяга':140}, fallbackPm:60, mode:'natural' });
const lmsChart = built.weeks.map(wk => {
  const t = wk.days.reduce((s,d)=>s+d.metrics.tonnage,0);
  const k = wk.days.reduce((s,d)=>s+d.metrics.kpsh,0);
  const uoi = k>0 ? wk.days.reduce((s,d)=>s+d.metrics.uoi*d.metrics.kpsh,0)/k : 0;
  const relInt = k>0 ? wk.days.reduce((s,d)=>s+d.metrics.relIntensity*d.metrics.kpsh,0)/k : 0;
  return { week:wk.week, tonnage:Math.round(t), kpsh:k, relInt:+relInt.toFixed(3), uoi:+uoi.toFixed(3) };
});
console.log('LMS chart wk1 & wk12:', JSON.stringify(lmsChart[0]), JSON.stringify(lmsChart[11]));
const ok1 = lmsChart[0].kpsh>0 && lmsChart[0].relInt>0.4 && lmsChart[0].relInt<0.8 && lmsChart[0].uoi>0;

const bbBest = selectBestBBSplit({ level:'intermediate', goal:'mass', daysPerWeek:5 })!;
const bbPlan = buildBBPlan({ patternId:bbBest.pattern.id, level:'intermediate', goal:'mass' as any, weeks:4, weakPoints:['chest'], mode:'natural' });
const bbChart = calcBBPlanMetrics(bbPlan).perMuscle.map(p=>({muscle:p.muscle,sets:p.totalSets,тяж:p.тяжSets,памп:p.пампSets,mrv:p.mrv}));
console.log('BB chart sample:', JSON.stringify(bbChart.slice(0,3)));
const chest = bbChart.find(m=>m.muscle==='chest');
const ok2 = bbChart.length>0 && chest && (chest.тяж+chest.памп)===chest.sets && chest.mrv>0;

console.log(ok1&&ok2 ? '✅ D2 PASS' : '❌ D2 FAIL');
if(!(ok1&&ok2)) process.exit(1);
