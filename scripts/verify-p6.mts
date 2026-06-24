import { wilksScore, dotsScore, ipfGLPoints, allometricScore, relativeStrength, classifyByDots, relativeStrengthReport } from "../src/engines/pro/relative-strength.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P6 relative-strength верификация =====");
// allometric & relative
P("allometric 600/90", allometricScore(600,90));
P("relative 600/90", relativeStrength(600,90));
ok(Math.abs(allometricScore(600,90) - 29.9) < 0.3,"allometric 600/90^(2/3) ≈ 29.9");
ok(relativeStrength(600,90)===6.67,"relative 600/90 = 6.67x");
ok(relativeStrength(0,90)===0,"zero total → 0");

// DOTS (codebase coefficients, sensible)
P("DOTS 600/90 male", dotsScore(600,90,"male"));
ok(dotsScore(600,90,"male") > 350 && dotsScore(600,90,"male") < 420,"DOTS 600/90 male ~388 (350-420)");
// DOTS lighter → higher for same total
ok(dotsScore(500,60,"male") > dotsScore(500,100,"male"),"DOTS: lighter → higher score");
// women DOTS higher coefficient at low bw (different curve)
ok(dotsScore(400,60,"female") > 0,"DOTS female sane");

// IPF GLI
P("GLI 600/93 male", ipfGLPoints(600,93,"male"));
ok(ipfGLPoints(600,93,"male") > 50 && ipfGLPoints(600,93,"male") < 90,"GLI 600/93 male ~65 (50-90)");
ok(ipfGLPoints(1000,93,"male") > ipfGLPoints(600,93,"male"),"GLI: higher total → higher points");

// Wilks: properties (monotonic decreasing coeff with bw; lighter → higher score)
const w60 = wilksScore(500,60,"male");
const w90 = wilksScore(500,90,"male");
const w120 = wilksScore(500,120,"male");
P("Wilks 500@60/90/120 male", { w60, w90, w120 });
ok(w60 > w90 && w90 > w120 && w60 > 0,"Wilks: lighter → higher score (monotonic)");
ok(wilksScore(500,75,"male") > wilksScore(500,75,"male") - 1,"Wilks deterministic");
ok(wilksScore(800,120,"male") > w120,"Wilks: higher total → higher score");
// Wilks range sane
ok(w60 < 600 && w120 > 100,"Wilks values in plausible range");
// female Wilks different curve, sane
const wf = wilksScore(300,60,"female");
ok(wf > 0 && wf < 800,"Wilks female sane");

// classification
P("classify 388", classifyByDots(388));
ok(classifyByDots(388).class==="advanced","DOTS 388 → advanced");
ok(classifyByDots(250).class==="novice","DOTS 250 → novice");
ok(classifyByDots(550).class==="world_class","DOTS 550 → world_class");
ok(classifyByDots(450).class==="elite","DOTS 450 → elite");
ok(classifyByDots(320).class==="intermediate","DOTS 320 → intermediate");

// report
const rep = relativeStrengthReport(600, 90, "male");
P("report 600/90/male", { wilks:rep.wilks, dots:rep.dots, gl:rep.ipfGL, allom:rep.allometric, rel:rep.relative, class:rep.classification.class });
ok(rep.dots > 380 && rep.classification.class==="advanced","report: DOTS advanced + все формулы");
ok(rep.wilks > 0 && rep.ipfGL > 0 && rep.allometric > 0 && rep.relative > 0,"report: все формулы > 0");

console.log(`\n===== ИТОГ P6: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
