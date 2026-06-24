import { selectBestCycle } from '../src/engines/lms/lms-selector.engine';
import { buildLMSPlan } from '../src/engines/lms/lms-builder.engine';
import { calcSessionTimeMinutes, type SRExercise } from '../src/engines/lms/lms-metrics.engine';
import { getCycleById } from '../src/data/lms-cycles/lms-cycle-index';
import { selectBestBBSplit } from '../src/engines/bb/bb-selector.engine';
import { buildBBPlan } from '../src/engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics } from '../src/engines/bb/bb-metrics.engine';

const P = (l:string,v:unknown)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0, fail=0;
const ok=(c:boolean,label:string)=>{ if(c){pass++;console.log('  ✅',label);}else{fail++;console.log('  ❌',label);} };

console.log('===== СРЦ (LMS) e2e =====');
const best = selectBestCycle({ goal:'strength', level:'II-KMS', bodyWeight:85, daysPerWeek:3, direction:'powerlifting', mode:'natural' });
ok(!!best && best.cycle.meta.id==='cycle-01','selector → cycle-01');
const tpl = getCycleById(best!.cycle.meta.id)!;
const built = buildLMSPlan({ template: tpl, pmMap:{ 'Присед':120, 'Жим лежа':100, 'Тяга':140 }, fallbackPm:60, mode:'natural' });
ok(built.weeks.length===12,'builder → 12 недель');
const d1 = built.weeks[0].days[0];
const ex0 = d1.exercises[0];
P('Нед1/Д1/Упр0', { name:ex0.name, group:ex0.group, coef:ex0.coef, pm:ex0.pm, wt:ex0.workSets[0]?.weight, pct:ex0.workSets[0]?.pct, reps:ex0.workSets[0]?.reps });
ok(ex0.workSets[0].weight>0 && ex0.pm>0 && ex0.coef>0,'веса + pm + coef заполнены');
// pre-computed day metrics
const dm = d1.metrics;
P('day1 metrics (builder)', { tonnage:Math.round(dm.tonnage), kpsh:dm.kpsh, relInt:+dm.relIntensity.toFixed(3), uoi:+dm.uoi.toFixed(3), intFB:+dm.intFB.toFixed(1) });
ok(dm.tonnage>0 && dm.kpsh>0 && dm.relIntensity>0.3 && dm.relIntensity<0.8 && dm.uoi>0 && dm.intFB>0,'метрики дня корректны (Инт.отн∈(0.3,0.8), УОИ>0, Инт.Ф+Б>0)');
ok(calcSessionTimeMinutes(dm)>0,'время сессии >0');
// cycle metrics
const cm = built.cycleMetrics;
P('cycle metrics (builder)', { tonnage:Math.round(cm.tonnage), kpsh:cm.kpsh, uoi:+cm.uoi.toFixed(3), relInt:+cm.relIntensity.toFixed(3), sessions:cm.sessions });
ok(cm.tonnage>dm.tonnage && cm.sessions>0,'цикл агрегирует сессии');
// progression: wk12 weight > wk1
const wk12 = built.weeks[11].days[0].exercises.find(e=>e.name==='Присед');
ok(!!wk12 && wk12.workSets[0].weight > ex0.workSets[0].weight,'прогрессия: нед12 вес > нед1');

console.log('\n===== BB e2e =====');
const bbBest = selectBestBBSplit({ level:'intermediate', goal:'mass', daysPerWeek:5 });
P('selectBestBBSplit', bbBest?.pattern.id);
ok(!!bbBest,'BB selector возвращает паттерн');
const bbPlan = buildBBPlan({ patternId: bbBest!.pattern.id, level:'intermediate', goal:'mass', weeks:4, weakPoints:['chest'], mode:'natural' });
ok(bbPlan.weeks.length===4,'bb-builder → 4 недель');
const bbD1 = bbPlan.weeks[0].sessions[0];
ok(bbD1.exercises.length>0,'BB упражнения сгенерированы');
const bbEx0 = bbD1.exercises[0];
P('BB упр0', { muscle:bbEx0.muscle, role:bbEx0.role, char:bbEx0.character, setsCount:bbEx0.sets, firstWt:bbEx0.workSets[0]?.weight, firstReps:bbEx0.workSets[0]?.reps, rir:bbEx0.rir });
ok(bbEx0.workSets.length>0 && bbEx0.workSets[0].weight>0,'BB сет с весом');
const bbm = calcBBPlanMetrics(bbPlan);
P('bbMetrics', { totalSets:bbm.totalSets, тяжPct:+bbm.тяжPct.toFixed(2), пампPct:+bbm.пампPct.toFixed(2), avgRir:+bbm.avgRir.toFixed(2), muscles:bbm.perMuscle.length });
ok(bbm.totalSets>0 && bbm.perMuscle.length>0,'BB метрики >0');
const chestStat = bbm.perMuscle.find(m=>m.muscle==='chest');
P('chest', chestStat ? { sets:chestStat.totalSets, status:chestStat.status, mrv:chestStat.mrv } : 'нет chest');
ok(!!chestStat && chestStat.totalSets>0,'weakpoint chest получает объём');
console.log('  explain:', explainBBMetrics(bbm).slice(0,160).replace(/\n/g,' '));

console.log(`\n===== ИТОГ: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
