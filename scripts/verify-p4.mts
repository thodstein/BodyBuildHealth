import { autoRegulate, pctForRPE, loadForRPE, rpeFromLoad, adjustedLoad } from "../src/engines/pro/autoregulation-pro.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P4 авторегуляция верификация =====");
// RPE→% model
ok(Math.abs(pctForRPE(10,1)-1.0)<0.01,"1 rep @RPE10 → 100%");
ok(Math.abs(pctForRPE(10,5)-0.857)<0.01,"5 reps @RPE10 → 85.7% (5 to failure)");
ok(Math.abs(pctForRPE(8,5)-0.811)<0.01,"5 reps @RPE8 → 81.1% (7-rep max load, RIR2)");
ok(Math.abs(pctForRPE(9,3)-0.882)<0.01,"3 reps @RPE9 → 88.2% (4-rep max load, RIR1)");
ok(Math.abs(pctForRPE(7,8)-0.732)<0.01,"8 reps @RPE7 → ~73% (11-rep max, RIR3)");
ok(loadForRPE(120,10,5)===102.8,"e1RM 120, 5@RPE10 → 102.8 кг");
ok(loadForRPE(120,8,5)===97.3,"e1RM 120, 5@RPE8 → 97.3 кг");
// inverse RPE
P("rpeFromLoad 120/85.7%×5", rpeFromLoad(120, 102.8, 5));
ok(Math.abs(rpeFromLoad(120, 102.8, 5)-10)<0.5,"load 102.8 @5reps e1RM120 → RPE~10");
ok(Math.abs(rpeFromLoad(120, 97.3, 5)-8)<0.5,"load 97.3 @5reps e1RM120 → RPE~8");

// autoRegulate cases
// 1) high readiness + optimal → push
const a1 = autoRegulate({ readiness: 85, acwr: { ratio: 1.0, zone: "optimal" }, plannedTopSetPct: 0.85, plannedRIR: 2 });
P("case1 (push)", a1);
ok(a1.topSetPctMultiplier === 1.02 && !a1.deload && a1.adjustedTopSetPct! > 0.85,"high readiness+optimal → топ×1.02, no deload");

// 2) low readiness → reduce
const a2 = autoRegulate({ readiness: 45, acwr: { ratio: 1.0, zone: "optimal" }, plannedTopSetPct: 0.85, plannedRIR: 2 });
P("case2 (low readiness)", a2);
ok(a2.rirShift === 1 && a2.topSetPctMultiplier === 0.96 && a2.adjustedTopSetPct! < 0.85,"readiness 45 → RIR+1, топ×0.96");

// 3) very low readiness
const a3 = autoRegulate({ readiness: 35, acwr: { ratio: 1.0, zone: "optimal" }, plannedRIR: 1 });
ok(a3.rirShift === 2 && a3.topSetPctMultiplier === 0.92,"readiness 35 → RIR+2, топ×0.92");

// 4) ACWR dangerous → deload
const a4 = autoRegulate({ readiness: 70, acwr: { ratio: 1.7, zone: "dangerous" }, plannedVolumeMult: 1 });
P("case4 (dangerous ACWR)", a4);
ok(a4.deload === true && a4.volumeMultiplier <= 0.7,"ACWR dangerous → deload, объём×0.7");

// 5) ACWR undertrained → volume up
const a5 = autoRegulate({ readiness: 70, acwr: { ratio: 0.6, zone: "undertrained" } });
ok(a5.volumeMultiplier === 1.1,"ACWR undertrained → объём×1.1");

// 6) velocity loss >40 → deload
const a6 = autoRegulate({ readiness: 70, acwr: { ratio: 1.1, zone: "optimal" }, lastVelocityLossPct: 45 });
P("case6 (VL 45%)", a6);
ok(a6.deload === true && a6.volumeMultiplier <= 0.6,"velocityLoss 45% → deload, объём×0.6");

// 7) combined bad state
const a7 = autoRegulate({ readiness: 40, acwr: { ratio: 1.4, zone: "caution" }, fatigue: 75, lastSessionRPE: 9.5, lastVelocityLossPct: 30, plannedTopSetPct: 0.85, plannedRIR: 2 });
P("case7 (combined bad)", a7);
ok(a7.volumeMultiplier < 0.7 && a7.rirShift >= 3 && a7.topSetPctMultiplier <= 0.97,"combined bad → big volume cut, RIR+≥3, топ≤0.97");
ok(a7.adjustedRIR! >= 5,"adjustedRIR clamps ≥5");

// adjustedLoad
ok(adjustedLoad(120, 0.85, a1) === adjustedLoad(120, 0.85, a1),"adjustedLoad deterministic");
ok(Math.abs(adjustedLoad(120, 0.85, {topSetPctMultiplier:1, volumeMultiplier:1, rirShift:0, deload:false, decisions:[]}) - 102) < 0.1,"adjustedLoad base 120×0.85=102");

console.log(`\n===== ИТОГ P4: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
