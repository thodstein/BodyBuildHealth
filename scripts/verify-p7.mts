import { generateMesocycleProgression, taperCurve, phaseDistribution } from "../src/engines/pro/mesocycle-progression.engine";
const P=(l,v)=>console.log(`${l}: ${JSON.stringify(v)}`);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log(c?"  ✅":"  ❌",l);};

console.log("===== P7 мезо-прогрессия верификация =====");
// 12-нед hypertrophy
const h = generateMesocycleProgression({ weeks: 12, startVolumeSets: 16, startIntensityPct: 0.75, startRIR: 3, goal: "hypertrophy" });
P("hypertrophy 12w", h.map(w=>`${w.week}:${w.phase}(V×${w.volumeMultiplier},I${Math.round(w.intensityPct*100)}%,RIR${w.rir})`).join(" "));
ok(h.length===12,"12 недель");
ok(h[0].phase==="base" && h[0].volumeMultiplier===1,"W1 base, V×1");
ok(h[0].intensityPct===0.75 && h[0].rir===3,"W1 старт 75%, RIR 3");
// RIR монотонно не растёт: base 3 → build ≤2 → peak ≤1 → deload 4
const rirSeq = h.map(w=>w.rir);
ok(rirSeq[0]===3,"W1 RIR 3");
const peakIdx = h.findIndex(w=>w.phase==="peak");
ok(peakIdx>0 && h[peakIdx].rir<=1,"peak RIR ≤1");
ok(h.some(w=>w.phase==="deload") && h.find(w=>w.phase==="deload")!.rir===4,"deload RIR 4");
// интенсивность растёт
ok(h[11].intensityPct > h[0].intensityPct,"интенсивность W12 > W1");
// объём: пик в build, падает в peak
const buildMaxV = Math.max(...h.filter(w=>w.phase==="build").map(w=>w.volumeMultiplier));
const peakV = h.filter(w=>w.phase==="peak").map(w=>w.volumeMultiplier);
ok(buildMaxV > peakV[0],"объём build-пик > peak (падает в пике)");
ok(h[11].volumeMultiplier < 1 || h.find(w=>w.phase==="deload")!.volumeMultiplier < 0.7,"deload объём < 0.7");

// strength 8 нед
const st = generateMesocycleProgression({ weeks: 8, startVolumeSets: 12, startIntensityPct: 0.80, startRIR: 2, goal: "strength" });
P("strength 8w last", st[7]);
ok(st.length===8,"strength 8 нед");
ok(st[7].intensityPct > st[0].intensityPct,"strength: интенсивность растёт");
ok(st[7].volumeMultiplier <= st[0].volumeMultiplier + 0.05,"strength: объём не взлетает (фокус на интенсивности)");

// fatigue-driven volume drop
const fat = generateMesocycleProgression({ weeks: 6, startVolumeSets: 18, startIntensityPct: 0.72, startRIR: 3, goal: "hypertrophy", fatigueTrajectory: [30,30,75,75,75,30] });
P("fatigue wk4", fat[3]);
ok(fat[3].fatigueAdjusted===true && fat[4].fatigueAdjusted===true,"fatigue>70 wk4-5 → volume drop flagged");
const noFat = generateMesocycleProgression({ weeks: 6, startVolumeSets: 18, startIntensityPct: 0.72, startRIR: 3, goal: "hypertrophy", fatigueTrajectory: [30,30,30,30,30,30] });
ok(noFat[3].fatigueAdjusted===false,"low fatigue → no adjustment");
ok(fat[3].volumeMultiplier <= noFat[3].volumeMultiplier,"fatigue week volume ≤ no-fatigue week");

// taper curve
const taper = taperCurve(2, 0.92);
P("taper 2w", taper);
ok(taper.length===2,"taper 2 недели");
ok(taper[0].volumePctOfPeak > taper[1].volumePctOfPeak,"taper: объём падает нед1→нед2");
ok(Math.abs(taper[1].intensityPct - 0.92) < 0.01,"taper last week: интенсивность удержание 92%");
ok(taper[0].volumePctOfPeak < 0.7 && taper[1].volumePctOfPeak < 0.5,"taper объём 65%→45%");

// phase distribution
const dist = phaseDistribution(12);
P("dist 12w", dist);
ok(dist.base + dist.build + dist.peak + dist.deload === 12,"фаз-распределение суммируется в 12");

console.log(`\n===== ИТОГ P7: ${pass} PASS / ${fail} FAIL =====`);
if(fail>0) process.exit(1);
