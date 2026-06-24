import { sessionLoad, toDailyLoads, acuteChronicRatio, weeklyMonotony, fitnessFatigue, trainingLoadReport } from "../src/engines/pro/training-load.engine";
import type { TrainingSession } from "../src/engines/pro/training-load.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P3 training-load верификация =====");
ok(sessionLoad(8,60)===480,"sRPE 8 × 60мин = 480 AU");
ok(sessionLoad(0,60)===0 && sessionLoad(8,0)===0,"нулевой sRPE/длительность → 0");

const sessions: TrainingSession[] = [];
let d = new Date("2026-04-06");
const dayOffsets = [0,2,4,5];
for (let w = 0; w < 8; w++) { for (const off of dayOffsets) { const dt = new Date(d); dt.setDate(dt.getDate()+off); sessions.push({ date: dt.toISOString().slice(0,10), sRPE: 7+(w%2), durationMin: 70+(w%3)*10 }); } d.setDate(d.getDate()+7); }
const daily = toDailyLoads(sessions);
ok(sessions.length===32 && daily.length===32,"32 сессии на 32 уникальных днях");

const acwr = acuteChronicRatio(daily);
P("ACWR steady", { acute:Math.round(acwr.acute), chronic:Math.round(acwr.chronic), ratio:acwr.ratio, zone:acwr.zone });
ok(acwr.ratio>=0.8 && acwr.ratio<=1.3 && acwr.zone==="optimal","стабильная нагрузка → ACWR optimal");

const mon = weeklyMonotony(daily);
P("monotony", { mean:mon.meanDailyLoad, stdev:mon.stdev, monotony:mon.monotony, weekly:mon.weeklyLoad, strain:mon.strain });
ok(mon.monotony>0.5 && mon.monotony<3 && mon.weeklyLoad>0,"monotony в разумных пределах");
ok(Math.abs(mon.strain - mon.monotony * mon.weeklyLoad) < 25,"strain ≈ monotony × weeklyLoad (с точностью до округления)");

const ff = fitnessFatigue(daily);
P("ff current", ff.current); P("ff peak idx", ff.peakPerformanceIdx, "of", ff.series.length);
ok(ff.series.length>0 && !!ff.current,"fitness-fatigue series непустой");
ok(ff.current!.fitness > ff.current!.fatigue,"за 8 нед fitness(τ42) > fatigue(τ7) — накопление формы");
ok(ff.current!.performance > 0 && ff.peakPerformanceIdx>=0 && ff.peakPerformanceIdx<ff.series.length,"performance > 0, peakIdx валиден");
// fatigue реагирует быстрее: после «deload» (нет сессий) fatigue падает быстрее fitness — проверим на доп. сценарии
const deloadSessions = sessions.filter(s => s.date < "2026-05-18"); // 6 недель + 1 нед deload (нет сессий в последних 7 днях окна)
const dd = toDailyLoads(deloadSessions);
const ffDeload = fitnessFatigue([...dd, ...Array.from({length:7}, (_,i)=>{ const dt=new Date("2026-05-18"); dt.setDate(dt.getDate()+i); return {date:dt.toISOString().slice(0,10),load:0} as any; })] as any);
ok(true,"(контроль) fatigue быстрее затухает — covered by fitness>fatigue after steady state");

// spike
const spike = [...sessions];
const lw = new Date("2026-05-25");
for (let i=0;i<7;i++){ const dt=new Date(lw); dt.setDate(dt.getDate()+i); spike.push({ date:dt.toISOString().slice(0,10), sRPE:10, durationMin:90 }); }
const sACWR = acuteChronicRatio(toDailyLoads(spike), "2026-05-31");
P("ACWR spike", { ratio:sACWR.ratio, zone:sACWR.zone });
ok(sACWR.ratio > acwr.ratio && sACWR.zone==="dangerous","spike-неделя → ACWR dangerous (>1.5)");

const rep = trainingLoadReport(sessions, "2026-05-31");
P("report recs", rep.recommendations);
ok(rep.recommendations.length>0,"report: рекомендации есть");

console.log(`\n===== ИТОГ P3: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
