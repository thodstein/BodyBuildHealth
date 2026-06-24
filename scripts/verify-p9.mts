import { taperWeeksForFatigue, peakWeekAttempts, warmupSequence, taperPlan, LAST_HEAVY_DAYS } from "../src/engines/pro/taper.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P9 taper/peak верификация =====");
// taper weeks by fatigue
ok(taperWeeksForFatigue(20)===1,"low fatigue → 1 taper week");
ok(taperWeeksForFatigue(55)===2,"moderate fatigue → 2 weeks");
ok(taperWeeksForFatigue(80)===3,"high fatigue → 3 weeks");

// last heavy days: deadlift earliest
ok(LAST_HEAVY_DAYS.deadlift > LAST_HEAVY_DAYS.squat && LAST_HEAVY_DAYS.squat > LAST_HEAVY_DAYS.bench,"deadlift cutoff earliest > squat > bench");

// attempts
const rm = { squat: 150, bench: 100, deadlift: 180 };
const bal = peakWeekAttempts(rm, "balanced");
P("balanced squat", bal.squat);
ok(Math.abs(bal.squat.opener - 138) < 1, "balanced squat opener ~138 (0.92×150)");
ok(Math.abs(bal.squat.third - 153) < 1, "balanced squat third ~153 (1.02×150)");
ok(bal.bench.third > rm.bench && bal.deadlift.third > rm.deadlift, "attempts target PR for all lifts");
const cons = peakWeekAttempts(rm, "conservative");
ok(cons.squat.third === 150, "conservative third = current 1RM (no PR risk)");
ok(cons.squat.opener < bal.squat.opener, "conservative opener < balanced");
const agg = peakWeekAttempts(rm, "aggressive");
ok(agg.squat.third > bal.squat.third, "aggressive third > balanced");
ok(Math.abs(agg.squat.opener - 139.5) < 1, "aggressive squat opener ~139.5 (0.93×150)");

// warmup sequence
const ws = warmupSequence(138);
P("warmup for 138", ws);
ok(ws.length===5 && ws[0].percent===0.40 && ws[ws.length-1].percent===0.90, "warmup 5 steps 40→90%");
ok(ws[0].reps===5 && ws[ws.length-1].reps===1, "warmup reps 5→1");
ok(ws[ws.length-1].weight < 138, "last warmup < opener");

// full taper plan
const plan = taperPlan("2026-07-15", rm, 55, "balanced");
P("plan taperWeeks", plan.taperWeeks);
ok(plan.taperWeeks===2, "taperPlan 2 weeks for fatigue 55");
ok(plan.weeks.length===2, "2 week sessions");
ok(plan.taperCurve.length===2, "taperCurve 2 entries");
ok(plan.attempts.squat.opener > 0, "attempts present");
ok(plan.meetDayInstructions.length>=3, "meet-day instructions >=3");
// week1: heavy singles (intensity retention), week2 (last): priming lighter
const wk1 = plan.weeks[0].sessions;
const wk2 = plan.weeks[1].sessions;
P("wk1 sess1 squat%", wk1[0].exercises[0].percent);
P("wk2 sess1 squat%", wk2[0].exercises[0].percent);
ok(wk1[0].exercises[0].percent > wk2[0].exercises[0].percent, "week1 heavy % > week2 priming %");
ok(wk1[0].focus.includes("Удержание") || wk1[0].focus.includes("intens"), "week1 focus: intensity retention");
ok(wk2[0].focus.includes("Прайминг"), "last week focus: priming");
// deadlift only in DE session (earliest cutoff respected — no heavy deadlift in taper)
const heavyDead = plan.weeks.some(wk => wk.sessions.some(s => s.exercises.some(e => e.lift==="deadlift" && e.percent >= 0.85)));
ok(!heavyDead, "no heavy deadlift (>=85%) in taper — earliest cutoff respected");
// high fatigue → 3 weeks
const plan3 = taperPlan("2026-07-15", rm, 80, "balanced");
ok(plan3.taperWeeks===3 && plan3.weeks.length===3, "high fatigue → 3-week taper");

console.log(`\n===== ИТОГ P9: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
