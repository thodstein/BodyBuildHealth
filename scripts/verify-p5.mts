import { PROGRESSION_SCHEMES, generateProgression, getScheme, listSchemes } from "../src/engines/pro/progression-pro.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P5 прогрессии верификация =====");
ok(listSchemes().length===6,"6 схем доступно");
ok(listSchemes().some(s=>s.id==="531" && s.weeks===4),"5/3/1: 4 недели");

// 5/3/1 с e1RM 100 → TM 90
const p531 = generateProgression("531", 100);
P("531 W1 day1", p531![0].days[0]);
ok(p531![0].trainingMax===90,"5/3/1 TM = 90% × 100 = 90");
ok(p531![0].days[0].sets[0].weight===58.5,"5/3/1 W1: 65% × 90 = 58.5 кг");
ok(p531![0].days[0].sets[2].weight===67.5,"5/3/1 W1: 75% × 90 = 67.5 кг");
ok(p531![2].days[0].sets[2].weight===81,"5/3/1 W3 top: 90% × 90 = 81 кг, reps 1");
ok(p531![3].days[0].sets[2].weight===54,"5/3/1 W4 deload: 60% × 90 = 54 кг");
ok(p531![0].days[0].sets.map(s=>s.reps).join(",")==="5,5,5","5/3/1 W1 reps 5/5/5");
ok(p531![2].days[0].sets.map(s=>s.reps).join(",")==="5,3,1","5/3/1 W3 reps 5/3/1");
// progression W1→W3 weight grows
ok(p531![2].days[0].sets[0].weight > p531![0].days[0].sets[0].weight,"5/3/1 W3 > W1 weight");

// DUP
const dup = generateProgression("dup", 100);
P("dup W1", dup![0].days.map(d=>d.label+":"+d.sets[0].weight+"x"+d.sets[0].reps));
ok(dup!.length===4,"DUP 4 недели");
ok(dup![0].days[0].sets[0].weight===82 && dup![0].days[0].sets[0].reps===5,"DUP W1 heavy 82×5");
ok(dup![0].days[1].sets[0].reps===8 && dup![0].days[2].sets[0].reps===12,"DUP W1 medium 8 / light 12");
ok(dup![3].days[0].sets[0].weight > dup![0].days[0].sets[0].weight,"DUP W4 heavy > W1 (+2.5%/нед)");

// conjugate
const conj = generateProgression("conjugate", 100);
ok(conj![0].days[0].sets[3].weight===95 && conj![0].days[0].sets[3].reps===3,"conjugate ME top 95%×3");
ok(conj![0].days[1].sets[0].sets===10 && conj![0].days[1].sets[0].reps===2,"conjugate DE 10×2 @ 55%");

// double progression
const dp = generateProgression("double_progression", 100);
P("dp weeks", dp!.map(w=>w.week+":"+w.days[0].sets[0].weight+"x"+w.days[0].sets[0].reps+"x"+w.days[0].sets[0].sets));
ok(dp![0].days[0].sets[0].reps===6 && dp![3].days[0].sets[0].reps===8,"double prog: W1 6reps → W4 8reps");
ok(dp![3].days[0].sets[0].weight > dp![0].days[0].sets[0].weight,"double prog: weight grows");

// hepburn
const hep = generateProgression("hepburn", 100);
ok(hep![0].days[0].sets[0].sets===8 && hep![0].days[0].sets[0].reps===2,"hepburn W1: 8×2 @ 80%");

// super-squats
const ss = generateProgression("super_squats", 100);
ok(ss!.length===6,"super-squats 6 недель");
ok(ss![0].days[0].sets[0].reps===20 && ss![0].days[0].sets[0].weight===50,"super-squats W1: 1×20 @ 50%");
ok(ss![5].days[0].sets[0].weight > ss![0].days[0].sets[0].weight,"super-squats W6 > W1 (+2.5%/нед)");

// edge
ok(generateProgression("531", 0)===null,"e1RM 0 → null");
ok(getScheme("nonexistent" as any)===undefined,"unknown scheme → undefined");

console.log(`\n===== ИТОГ P5: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
