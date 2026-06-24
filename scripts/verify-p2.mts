import { velocityForPct, pctForVelocity, targetVelocity, targetPct, loadForPct, estimate1RMFromVelocity, velocityLoss, thresholdForIntent, velocityLossZone, INTENT_ZONES } from "../src/engines/pro/vbt.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P2 VBT верификация =====");
// LVP interp
ok(Math.abs(velocityForPct("squat",0.90)-0.47)<0.01,"squat 90% → 0.47 м/с");
ok(Math.abs(velocityForPct("squat",0.60)-0.87)<0.01,"squat 60% → 0.87 м/с");
ok(Math.abs(velocityForPct("bench",0.90)-0.33)<0.01,"bench 90% → 0.33 м/с");
ok(Math.abs(velocityForPct("deadlift",0.50)-0.92)<0.01,"deadlift 50% → 0.92 м/с");
ok(Math.abs(velocityForPct("ohp",1.00)-0.18)<0.01,"ohp 100% → 0.18 м/с");
// inverse roundtrip
const rt = pctForVelocity("squat", velocityForPct("squat", 0.78));
P("roundtrip squat 0.78", rt); ok(Math.abs(rt-0.78)<0.02,"velocityForPct↔pctForVelocity roundtrip");
const rt2 = pctForVelocity("bench", velocityForPct("bench", 0.45));
ok(Math.abs(rt2-0.45)<0.02,"bench roundtrip 0.45");

// intent zones
P("strength intent", { pct:targetPct("strength"), v:targetVelocity("strength") });
ok(targetPct("strength")===0.90 && Math.abs(targetVelocity("strength").ideal-0.40)<0.01,"strength → 90% @ 0.40 м/с");
ok(targetPct("speed")===0.40 && targetVelocity("speed").ideal>1.2,"speed → 40% @ >1.2 м/с");
ok(targetPct("hypertrophy")===0.72,"hypertrophy → 72%");

// load for pct
ok(loadForPct(120, 0.90)===108,"e1RM 120 × 90% = 108 кг");
ok(loadForPct(100, 0.50)===50,"e1RM 100 × 50% = 50 кг");

// e1RM from velocity
const ev = estimate1RMFromVelocity("bench", 0.33, 90);
P("bench v0.33 w90", ev); ok(Math.abs(ev.pct1RM-0.90)<0.02 && Math.abs(ev.e1RM-100)<1,"bench v0.33 @90 → 90% → e1RM=100");
const ev2 = estimate1RMFromVelocity("squat", 0.30, 120);
ok(Math.abs(ev2.pct1RM-1.00)<0.02 && Math.abs(ev2.e1RM-120)<1,"squat v0.30 @120 → 100% → e1RM=120");

// velocity loss
const vl1 = velocityLoss([0.75, 0.73, 0.70, 0.66], 20);
P("VL 4 reps", vl1);
ok(vl1!.bestVelocity===0.75 && vl1!.lastVelocity===0.66,"best/last velocity");
ok(Math.abs(vl1!.lossPct - 12) < 0.5,"loss ≈ 12% ((0.75-0.66)/0.75=12%)");
ok(!vl1!.exceeded && vl1!.remainingReps! > 0,"not exceeded, remainingReps > 0");
// exceeded case
const vl2 = velocityLoss([0.80, 0.70, 0.60, 0.50], 20);
P("VL exceeded", vl2);
ok(vl2!.exceeded && vl2!.lossPct >= 20,"exceeded (loss 37.5% ≥ 20%)");
ok(vl2!.remainingReps === null,"remainingReps null when exceeded");
// threshold by intent
ok(thresholdForIntent("strength")===20,"strength threshold 20");
ok(thresholdForIntent("speed")===10,"speed threshold 10");
ok(thresholdForIntent("hypertrophy")===25,"hypertrophy threshold 25");
// zones
ok(velocityLossZone(8).includes("стабильна"),"zone <10: стабильна");
ok(velocityLossZone(45).includes("превышение"),"zone ≥40: превышение");

// интеграция: squat strength day — e1RM 150, target 90%
const e1rm = 150;
const pct = targetPct("strength");
const load = loadForPct(e1rm, pct);
const tgtV = targetVelocity("strength").ideal;
P("squat strength day", { e1rm, pct, load, tgtV });
ok(load===135 && Math.abs(tgtV-0.40)<0.01,"squat 1RM 150 → 90% = 135 кг @ 0.40 м/с target");

console.log(`\n===== ИТОГ P2: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
