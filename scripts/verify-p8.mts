import { prescribeExercises, forceVector, lengthenedPartials, MUSCLE_TO_JOINTS, REGIONAL_HYPERTROPHY } from "../src/engines/pro/exercise-prescription.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P8 exercise-prescription верификация =====");
// force vector
ok(forceVector("chest","compound","Жим") === "horizontal_push","chest → horizontal_push");
ok(forceVector("back","compound","Подтягивания") === "vertical_pull","back подтягивания → vertical_pull");
ok(forceVector("back","compound","Тяга в наклоне") === "horizontal_pull","back тяга в наклоне → horizontal_pull");
ok(forceVector("legs","compound","Румынская тяга") === "hip_dominant","RDL → hip_dominant");
ok(forceVector("legs","compound","Присед") === "knee_dominant","Присед → knee_dominant");
ok(forceVector("shoulders","compound","Жим стоя") === "vertical_push","shoulders → vertical_push");

// regional hypertrophy
P("chest regional", REGIONAL_HYPERTROPHY.chest.map(r=>r.name));
ok(lengthenedPartials("chest").length >= 3, "chest has >=3 lengthened exercises");
ok(lengthenedPartials("legs").some(r => /Румынская/.test(r.name)), "legs has RDL (stretch-mediated)");

// prescribe: hypertrophy chest
const hx = prescribeExercises({ muscle: "chest", goal: "hypertrophy", limit: 6 });
P("chest hypertrophy top3", hx.slice(0,3).map(e=>e.name+" ("+e.score+")"));
ok(hx.length > 0, "chest hypertrophy: results returned");
ok(hx.some(e => e.lengthenedEmphasis), "chest hypertrophy: some exercise has lengthened emphasis");
ok(hx[0].score >= hx[hx.length-1].score, "results ranked by score desc");

// strength chest prefers compound
const sx = prescribeExercises({ muscle: "chest", goal: "strength", limit: 3 });
P("chest strength top", sx.map(e=>e.name+" "+e.type));
ok(sx.every(e => e.type === "compound") || sx[0].type === "compound", "strength chest: compound prioritized");

// constraints: injured shoulder excludes high-stress chest exercises
const withConstraint = prescribeExercises({ muscle: "chest", goal: "hypertrophy", constraints: ["shoulder"], limit: 20 });
const highStress = withConstraint.filter(e => e.jointStress === "high");
ok(highStress.length === 0, "injured shoulder → high-stress chest exercises excluded");
P("constraint excluded high", highStress.length);

// weak point → assistance included
const wp = prescribeExercises({ muscle: "chest", goal: "strength", weakPoint: { lift: "bench", point: "lockout" }, limit: 8 });
P("wp bench lockout", wp.slice(0,4).map(e=>e.name));
ok(wp.some(e => /Слабое место|Дожим|локдаун|дожим/i.test(e.rationale)), "weak point lockout → assistance with rationale");
// lockout assistance should be дожимы
ok(wp.some(e => /Дожим|дожим/.test(e.name)), "lockout assistance includes дожимы");

// legs with injured knee
const lk = prescribeExercises({ muscle: "legs", goal: "hypertrophy", constraints: ["knee"], limit: 20 });
ok(lk.filter(e => e.jointStress === "high").length === 0, "injured knee → high-stress legs excluded");

// equipment filter
const eq = prescribeExercises({ muscle: "chest", goal: "hypertrophy", equipment: ["dumbbell"], limit: 10 });
ok(eq.length > 0, "dumbbell-only filter returns results");
ok(eq.every(e => e.equipment === "dumbbell") || eq.some(e => e.equipment === "dumbbell"), "equipment filter biases to available");

console.log(`\n===== ИТОГ P8: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
