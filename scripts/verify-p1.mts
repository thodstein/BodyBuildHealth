import { estimate1RM, estimate1RMConsensus, estimate1RMFormula, estimate1RMFromVelocity, velocityForPct } from "../src/engines/pro/estimate1rm.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P1 e1RM верификация =====");
ok(estimate1RM(100,1)===100,"100x1 → 100");
P("100x3",estimate1RM(100,3)); P("100x5",estimate1RM(100,5)); P("100x8",estimate1RM(100,8)); P("100x10",estimate1RM(100,10)); P("100x12",estimate1RM(100,12));
ok(Math.abs(estimate1RM(100,5)-116)<3,"100x5 ~116");
ok(Math.abs(estimate1RM(100,8)-125)<3,"100x8 ~125 (consensus)");
ok(Math.abs(estimate1RM(100,12)-138)<5,"100x12 ~138 (consensus)");

const c8=estimate1RMConsensus(100,8);
P("consensus 100x8",{v:c8.value,n:c8.n,min:c8.min,max:c8.max,spread:c8.spread,f:c8.formulas.map(x=>x.formula+":"+x.value)});
ok(c8.n===7 && c8.min<=c8.value && c8.value<=c8.max && c8.spread<10,"consensus 100x8: 7 formulas, median in range");

const c12=estimate1RMConsensus(100,12);
P("consensus 100x12",{v:c12.value,n:c12.n,min:c12.min,max:c12.max,f:c12.formulas.map(x=>x.formula+":"+x.value)});
ok(c12.n===4 && c12.value>130 && c12.value<145,"consensus 100x12: 4 formulas (Epley/Lander/OConner excluded >10), 130-145");

ok(estimate1RM(100,20)===estimate1RM(100,15),"reps>15 clamps to 15");

ok(Math.abs(estimate1RMFormula(100,8,"epley")-126.67)<0.1,"Epley 100x8 ≈ 126.7");
ok(Math.abs(estimate1RMFormula(100,8,"oconner")-120)<0.1,"OConner 100x8 = 120 (conservative, correct)");
ok(Math.abs(estimate1RMFormula(100,8,"brzycki")-124.14)<0.1,"Brzycki 100x8 ≈ 124.1");
ok(Math.abs(estimate1RMFormula(100,8,"lombardi")-123.1)<0.1,"Lombardi 100x8 ≈ 123.1");

const v90=velocityForPct("squat",0.90); ok(Math.abs(v90-0.47)<0.02,"squat 90% → 0.47 m/s");
const v60=velocityForPct("squat",0.60); ok(Math.abs(v60-0.87)<0.02,"squat 60% → 0.87 m/s");
const ev=estimate1RMFromVelocity("bench",0.33,90); P("bench v0.33 w90",{ev}); ok(Math.abs(ev.pct1RM-0.90)<0.02 && Math.abs(ev.e1RM-100)<1,"bench v=0.33 @90kg → 90% → e1RM=100");
const ev2=estimate1RMFromVelocity("squat",0.30,120); P("squat v0.30 w120",{ev2}); ok(Math.abs(ev2.pct1RM-1.00)<0.02 && Math.abs(ev2.e1RM-120)<1,"squat v=0.30 @120kg → 100% → e1RM=120");
const rt=velocityForPct("deadlift",0.70); const back=estimate1RMFromVelocity("deadlift",rt,100).pct1RM;
P("roundtrip deadlift 70%",{v:rt,back}); ok(Math.abs(back-0.70)<0.03,"velocityForPct ↔ pctForVelocity roundtrip");

console.log(`\n===== ИТОГ P1: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
