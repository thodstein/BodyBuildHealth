// AUD-верификация тренировочных движков (запуск tsx). Этап AUD.
import { mrvPerGroup, getVolumeLandmarks, normLevel, normMuscle } from '../src/engines/volume-landmarks.engine';
import { estimate1RM } from '../src/engines/progression.engine';
import { buildLMSPlan } from '../src/engines/lms/lms-builder.engine';
import { selectBestCycle, explainSelection } from '../src/engines/lms/lms-selector.engine';
import { CYCLE_01 } from '../src/data/lms-cycles/cycle-01';

let pass = 0, fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`PASS  ${name} -> ${JSON.stringify(got)}`); }
  else { fail++; console.log(`FAIL  ${name}\n  got : ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
}
function approx(name: string, got: number, want: number, tol = 0.15) {
  const ok = Math.abs(got - want) <= tol;
  if (ok) { pass++; console.log(`PASS  ${name} -> ${got} (want ${want})`); }
  else { fail++; console.log(`FAIL  ${name}\n  got : ${got}\n  want: ${want} (tol ${tol})`); }
}

// --- FIX-2: volume-landmarks canonical ---
check("mrvPerGroup('beginner').chest", mrvPerGroup('beginner').chest, { min: 10, max: 15 });
check("getVolumeLandmarks('beginner','chest')", getVolumeLandmarks('beginner', 'chest'), { mev: 6, mav: 10, mrv: 15 });
check("normLevel('novice')", normLevel('novice'), 'beginner');
check("normMuscle('грудь')", normMuscle('грудь'), 'chest');

// --- FIX-5: estimate1RM rep-range blend (Epley <=10, Brzycki >10) ---
approx("estimate1RM(100,8) Epley", estimate1RM(100, 8), 126.7, 0.2);
approx("estimate1RM(100,12) Brzycki", estimate1RM(100, 12), 144.0, 0.2); // 100*36/(37-12)=144 (doc неверно говорил 138.5)
approx("estimate1RM(100,1)", estimate1RM(100, 1), 100);

// --- LMS-FIX-A: mnosz не входит в вес грифа (только в тоннаж) ---
const out = buildLMSPlan({
  template: CYCLE_01,
  pmMap: { 'Присед': 120, 'Жим лежа': 100, 'Становая тяга': 140 },
  fallbackPm: 60,
  mode: 'natural',
});
const w1 = out.weeks[0];
const w1Squat = w1.days[0].exercises.find(e => e.name === 'Присед')!;
const w1Press = w1.days[0].exercises.find(e => e.name === 'Пресс в тренажере (скручивания)')!;
approx("week1 Присед bar weight (120*0.68)", w1Squat.workSets[0].weight, 81.6, 0.2);
// Пресс: PM 60 (fallback), pct 0.45, mnosz 2 -> bar = 60*0.45 = 27 (НЕ 54)
approx("week1 Пресс bar weight (60*0.45, mnosz не в весе)", w1Press.workSets[0].weight, 27.0, 0.2);
// Инт.отн сессии <= макс % (было 0.6798 с удвоением -> 110% для ассистентных; теперь <=0.68)
approx("week1 day1 Инт.отн (<=0.68, без удвоения mnosz)", w1.days[0].metrics.relIntensity, 0.5497, 0.02);
approx("week1 day1 Тоннаж (7592.4, mnosz 1x)", w1.days[0].metrics.tonnage, 7592.4, 0.5);
// week12 PM = 120*(1.005)^11 ≈ 126.78 -> bar = *0.68 ≈ 86.2
const w12 = out.weeks[11];
const w12Squat = w12.days[0].exercises.find(e => e.name === 'Присед')!;
approx("week12 Присед bar weight", w12Squat.workSets[0].weight, 86.2, 1.0);
console.log(`  cycle metrics: tonnage=${out.cycleMetrics.tonnage.toFixed(1)} kpsh=${out.cycleMetrics.kpsh} uoi=${out.cycleMetrics.uoi.toFixed(3)} relInt=${out.cycleMetrics.relIntensity.toFixed(3)}`);

// --- lms-selector (B4) ---
const sel = selectBestCycle({
  goal: 'strength', direction: 'powerlifting', level: 'II-KMS',
  bodyWeight: 85, daysPerWeek: 3, mode: 'natural',
});
check("selectBestCycle id", sel?.cycle.meta.id, 'cycle-01');
if (sel) console.log(`  selection: ${sel.cycle.meta.id} score ${sel.score}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
