import { diagnoseLift, barPathAnalysis, stickingPhases, STICKING_POINTS } from "../src/engines/pro/lift-diagnostics.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P10 lift-diagnostics верификация =====");
// sticking phases per lift
P("bench phases", stickingPhases("bench"));
P("squat phases", stickingPhases("squat"));
P("deadlift phases", stickingPhases("deadlift"));
ok(stickingPhases("bench").length>=3, "bench has >=3 sticking phases");
ok(stickingPhases("deadlift").includes("start") && stickingPhases("deadlift").includes("lockout"), "deadlift has start & lockout");

// diagnose bench lockout
const dl = diagnoseLift("bench", "lockout");
P("bench lockout", { muscles:dl?.weakMuscles, reason:dl?.biomechanicalReason.slice(0,50), corrections:dl?.corrections, intensity:dl?.assistanceIntensityPct });
ok(!!dl && dl.weakMuscles.includes("Трицепс"), "bench lockout → weak triceps");
ok(dl!.angleRangeDeg[0]===90 && dl!.angleRangeDeg[1]===180, "bench lockout angle 90-180°");
ok(dl!.corrections.some(c=>/дожим|плинт|рам/.test(c)), "lockout corrections include дожимы");
ok(dl!.assistance.length>0 && dl!.assistanceIntensityPct>0, "assistance from weakpoint-pl + intensity");

// bench off_chest
const oc = diagnoseLift("bench", "off_chest");
ok(oc!.weakMuscles.some(m=>/груд|дельт/.test(m)), "off_chest → chest/front delt");
ok(oc!.angleRangeDeg[1]===30, "off_chest angle 0-30°");
ok(oc!.corrections.some(c=>/пауз/.test(c)), "off_chest: pause corrections");

// squat bottom
const sb = diagnoseLift("squat", "bottom");
P("squat bottom", { muscles:sb?.weakMuscles, reason:sb?.biomechanicalReason.slice(0,50) });
ok(sb!.weakMuscles.some(m=>/квадр|ягод/.test(m.toLowerCase())) || sb!.weakMuscles.some(m=>/Квадрицепс|Ягодиц/.test(m)), "squat bottom → quads/glutes");
ok(sb!.corrections.some(c=>/груди|пауз|болгар/.test(c)), "squat bottom corrections (front squat/pause/bulgarian)");

// deadlift start
const dst = diagnoseLift("deadlift", "start");
P("deadlift start", { muscles:dst?.weakMuscles, corrections:dst?.corrections });
ok(Array.isArray(dst!.weakMuscles) && dst!.weakMuscles.includes("Квадрицепсы"), "deadlift start weakMuscles is array with Квадрицепсы");
ok(dst!.corrections.some(c=>/ямы|дефицит/.test(c)), "deadlift start: deficit pull");

// deadlift lockout
const dlk = diagnoseLift("deadlift", "lockout");
ok(dlk!.weakMuscles.some(m=>/Ягодиц|Трапец|Разгибат/.test(m)), "deadlift lockout → glutes/traps/extensors");

// unknown combo
ok(diagnoseLift("bench", "bottom" as any)===null, "invalid combo → null");

// bar path analysis
const bp = barPathAnalysis("squat", ["forward_drift", "hips_shoot_up"]);
P("barpath", bp.diagnoses.map(d=>d.issue+": "+d.cause.slice(0,30)));
ok(bp.diagnoses.length===2, "bar path: 2 issues diagnosed");
ok(bp.diagnoses[0].issue==="forward_drift" && /вперёд|спин|ягод/.test(bp.diagnoses[0].cause), "forward_drift cause");
ok(bp.diagnoses[1].issue==="hips_shoot_up" && /квадриц|таз/.test(bp.diagnoses[1].cause), "hips_shoot_up cause");
ok(bp.diagnoses.every(d=>d.correction.length>10), "each issue has correction");

// good morning squat
const gm = barPathAnalysis("squat", ["good_morning"]);
ok(/Good-morning|квадриц|ягод/.test(gm.diagnoses[0].cause), "good_morning squat diagnosed");

console.log(`\n===== ИТОГ P10: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
