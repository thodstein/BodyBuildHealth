/**
 * metabolic-constants.ts — единые константы и хелперы метаболики
 * Централизует BMR/PAL для всех движков питания, чтобы разойтись не могли.
 * Источники: Mifflin 1990, Katch-McArdle 1991, Cunningham 1991, Owen 1986,
 * Ten Haaf 2014, EFSA 2010, Helms 2014, Hall 2011, Westerterp 2004.
 */

// ── clamp ──
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ── BMR — формулы ──
export function bmrKatchMcArdle(leanKg: number): number {
  return 370 + 21.6 * leanKg;
}
export function bmrCunningham(leanKg: number): number {
  // Cunningham 1991: 500 + 22*LBM — точнее для атлетов LBM>60кг (ошибка <4% vs 8% Mifflin)
  return 500 + 22 * leanKg;
}
export function bmrOwen(weightKg: number, sex: 'male' | 'female'): number {
  // Owen 1986: re-derived, хорошо для избыточного веса
  return sex === 'male' ? 879 + 10.2 * weightKg : 795 + 7.18 * weightKg;
}
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  return sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}
export function bmrTenHaaf(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  // Ten Haaf 2014: спорт-популяция 18-35л
  const hM = heightCm / 100;
  return sex === 'male'
    ? 11.1 * weightKg + 8.4 * heightCm - 5.6 * age + 103 * hM - 366
    : 11.1 * weightKg + 8.4 * heightCm - 5.6 * age + 103 * hM - 476;
}
export type BMRMethod = 'katch_mcardle' | 'cunningham' | 'owen' | 'ten_haaf' | 'mifflin';
export interface BMRResult {
  bmr: number;
  lean: number;
  method: BMRMethod;
  allMethods?: Record<BMRMethod, number>;
}
export function computeBMR(input: { weight: number; height: number; age: number; sex: 'male' | 'female'; bodyFat?: number }): BMRResult {
  const bf = input.bodyFat;
  const hasBF = typeof bf === 'number' && bf > 3 && bf < 70;
  let lean = input.weight * (1 - (input.sex === 'male' ? 0.15 : 0.22));
  let bmr = 0;
  let method: BMRMethod = 'mifflin';
  let allMethods: Record<BMRMethod, number> | undefined;
  if (hasBF) {
    lean = input.weight * (1 - bf! / 100);
    // Выбор по LBM и возрасту
    if (lean >= 60 && (input.age ?? 30) < 45) {
      bmr = bmrCunningham(lean);
      method = 'cunningham';
    } else if (lean >= 55) {
      bmr = bmrKatchMcArdle(lean);
      method = 'katch_mcardle';
    } else {
      bmr = bmrKatchMcArdle(lean);
      method = 'katch_mcardle';
    }
    // guard: FFMI >27 — LBM невозможен, кламп
    const hM = (input.height || 175) / 100;
    const ffmi = lean / (hM * hM) + 6.1 * (1.80 - hM);
    if (ffmi > 28) {
      const maxLean = (28 - 6.1 * (1.80 - hM)) * hM * hM;
      lean = Math.min(lean, maxLean);
      bmr = Math.min(bmr, bmrCunningham(lean));
    }
  } else {
    // без bf — выбираем между Mifflin/Owen/TenHaaf по контексту
    const mif = bmrMifflin(input.weight, input.height, input.age, input.sex);
    const ow = bmrOwen(input.weight, input.sex);
    const th = bmrTenHaaf(input.weight, input.height, input.age, input.sex);
    // атлет 18-35 -> TenHaaf ближе, ожирение -> Owen, иначе Mifflin
    const bmi = input.weight / (((input.height || 175) / 100) ** 2);
    if (bmi >= 30) { bmr = ow; method = 'owen'; }
    else if ((input.age ?? 30) <= 35 && bmi < 27) { bmr = th; method = 'ten_haaf'; }
    else { bmr = mif; method = 'mifflin'; }
    allMethods = { katch_mcardle: 0, cunningham: 0, owen: ow, ten_haaf: th, mifflin: mif };
  }
  bmr = Math.max(800, Math.round(bmr));
  // возрастная саркопения >50л: -1.5%/дек после 50 (Westerterp)
  if ((input.age ?? 30) > 50) {
    const dec = Math.floor(((input.age ?? 30) - 50) / 10) + 1;
    bmr = Math.round(bmr * (1 - dec * 0.015));
  }
  return { bmr, lean: Math.round(lean * 10) / 10, method, allMethods };
}

// ── TEF персональный (Westerterp 2004) ──
export function calcTEF(proteinG: number, carbsG: number, fatG: number, alcoholG = 0): number {
  // P 20-35% (берем 25%), C 5-10% (7%), F 0-3% (3%), alcohol 15-20% (18%)
  return Math.round(proteinG * 4 * 0.25 + carbsG * 4 * 0.07 + fatG * 9 * 0.03 + alcoholG * 7.1 * 0.18);
}
export function calcTEFFromKcal(kcal: number, proteinG: number, carbsG: number, fatG: number): number {
  const tef = calcTEF(proteinG, carbsG, fatG);
  // fallback 10% если макросы не заданы
  if (proteinG + carbsG + fatG < 10) return Math.round(kcal * 0.10);
  return clamp(tef, Math.round(kcal * 0.06), Math.round(kcal * 0.15));
}

// ── PAL ──
// Простая модель для хаба (low/medium/high + тренировочные дни/кардио)
export const PAL_BASE_MAP = { low: 1.40, medium: 1.55, high: 1.75 } as const;
export type PalLevel = 'low' | 'medium' | 'high';

export function computePalSimple(opts: {
  activityLevel?: PalLevel;
  trainingDays?: number;
  cardioMin?: number;
}): number {
  const palBase = PAL_BASE_MAP[opts.activityLevel ?? 'medium'];
  const trainAdd = clamp((opts.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((opts.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  return clamp(palBase + trainAdd + cardioAdd, 1.25, 2.25);
}

// Полная модель для планировщика (учитывает шаги/быт/NЕАТ/интенсивность)
export function computePalFull(opts: {
  workoutsPerWeek?: number;
  avgWorkoutMinutes?: number;
  dailySteps?: number;
  householdActivity?: string;
  trainType?: string;
  trainIntensity?: string;
  basePal?: number;
}): number {
  const wpw = opts.workoutsPerWeek ?? 0;
  const awm = opts.avgWorkoutMinutes ?? 0;
  let pal = opts.basePal ?? (1.2 + wpw * 0.075);
  if (opts.basePal === undefined) {
    if (awm > 60) pal += 0.1;
    if (awm > 90) pal += 0.05;
    if (wpw >= 6) pal += 0.05;
  }
  const steps = opts.dailySteps ?? 0;
  if (steps >= 15000) pal += 0.15;
  else if (steps >= 10000) pal += 0.1;
  else if (steps >= 7500) pal += 0.05;
  const ha = String(opts.householdActivity || '').toLowerCase();
  if (ha === 'active') pal += 0.15;
  else if (ha === 'moderate') pal += 0.1;
  else if (ha === 'light') pal += 0.05;
  const tt = String(opts.trainType || '').toLowerCase();
  if (tt === 'hiit') pal += 0.1;
  else if (tt === 'cardio') pal += 0.05;
  else if (tt === 'mixed') pal += 0.03;
  const ti = String(opts.trainIntensity || '').toLowerCase();
  if (ti === 'high') pal += 0.1;
  else if (ti === 'medium') pal += 0.05;
  return Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
}

// ── cm → inch ──
export const toIn = (cm: number): number => cm * 0.393701;
export const log10 = (x: number): number => Math.log(x) / Math.log(10);

// ── Адаптивный тренд — PRO: EMA 14д + линейная регрессия ──
export interface WeightPoint {
  date: string;
  kg: number;
}
export function calcTrendFromHistory(history: WeightPoint[]): number {
  if (!history || history.length < 3) return 0;
  // PRO: берем до 14 точек, взвешенная регрессия (EMA вес к последним)
  const pts = history.slice(-14).filter(p => typeof p.kg === 'number' && isFinite(p.kg) && p.kg > 20 && p.kg < 400);
  if (pts.length < 3) return 0;
  const times = pts.map(p => new Date(p.date).getTime() / 86400000);
  const t0 = times[0];
  const xs = times.map(t => t - t0);
  const ys = pts.map(p => p.kg);
  // фильтр выбросов: |Δ|>2кг от медианы за 3д — игнор
  const median = ys.slice().sort((a,b)=>a-b)[Math.floor(ys.length/2)];
  const filtered = xs.map((x,i)=> ({x,y:ys[i]})).filter(pt=> Math.abs(pt.y - median) < 3);
  if (filtered.length < 3) return 0;
  const n = filtered.length;
  // взвешенная линрег: вес экспонента к последним (EMA alpha 0.25)
  let wSum = 0, wx=0, wy=0;
  const weights = filtered.map((_,i)=> Math.pow(1.18, i)); // последние тяжелее
  for(let i=0;i<n;i++){ wSum+=weights[i]; wx+=filtered[i].x*weights[i]; wy+=filtered[i].y*weights[i]; }
  const xBar = wx/wSum, yBar = wy/wSum;
  let num=0, den=0;
  for(let i=0;i<n;i++){ const w=weights[i]; num+=w*(filtered[i].x-xBar)*(filtered[i].y-yBar); den+=w*(filtered[i].x-xBar)*(filtered[i].x-xBar); }
  if (den < 0.5) return 0;
  const slopePerDay = num/den;
  const daysSpan = filtered[filtered.length-1].x - filtered[0].x;
  if (daysSpan < 3) return 0;
  // R2 доверие: если <0.35 — шум, возвращаем с пониж весом
  let ssTot=0, ssRes=0;
  for(let i=0;i<n;i++){ ssTot+= weights[i]*(filtered[i].y - yBar)*(filtered[i].y - yBar); const pred = yBar + slopePerDay*(filtered[i].x - xBar); ssRes+= weights[i]*(filtered[i].y - pred)*(filtered[i].y - pred); }
  const r2 = ssTot>0 ? 1 - ssRes/ssTot : 0;
  let trend = slopePerDay * 7;
  if (r2 < 0.35 && Math.abs(trend) < 0.4) trend *= (0.4 + r2); // шум — глушим
  return Math.round(trend*100)/100;
}
export function calcTrendWithConfidence(history: WeightPoint[]): { trend: number; r2: number; n: number; days: number } {
  if (!history || history.length < 3) return { trend:0, r2:0, n:0, days:0 };
  const pts = history.slice(-14).filter(p=> typeof p.kg==='number'&&isFinite(p.kg));
  if (pts.length<3) return { trend:0, r2:0, n:pts.length, days:0 };
  const times = pts.map(p=> new Date(p.date).getTime()/86400000);
  const xs = times.map(t=> t-times[0]); const ys=pts.map(p=>p.kg);
  const n=xs.length; const xBar=xs.reduce((a,b)=>a+b,0)/n; const yBar=ys.reduce((a,b)=>a+b,0)/n;
  let num=0,den=0; for(let i=0;i<n;i++){ num+=(xs[i]-xBar)*(ys[i]-yBar); den+=(xs[i]-xBar)*(xs[i]-xBar); }
  const slope = den>0? num/den:0;
  let ssTot=0, ssRes=0; for(let i=0;i<n;i++){ ssTot+=(ys[i]-yBar)**2; const pred=yBar+slope*(xs[i]-xBar); ssRes+=(ys[i]-pred)**2; }
  const r2 = ssTot>0? 1-ssRes/ssTot:0;
  return { trend: Math.round(slope*7*100)/100, r2: Math.round(r2*100)/100, n, days: Math.round(xs[xs.length-1]-xs[0]) };
}

export function calcAdaptiveAdjustment(
  trendKgPerWeek: number,
  goal: 'cut' | 'maintain' | 'bulk' | 'health' | undefined,
  _baseTdee: number,
): { adjustment: number; expected: number; trend: number; suggest: string } {
  const isCut = goal === 'cut';
  const isBulk = goal === 'bulk';
  const isHealth = goal === 'health';
  let expected = 0;
  if (isCut) expected = -0.5;
  else if (isBulk) expected = 0.25;
  else if (isHealth) expected = 0;
  let adjustment = 0;
  if ((isCut || isBulk) && Math.abs(trendKgPerWeek - expected) > 0.05) {
    const diff = trendKgPerWeek - expected;
    // Hall dynamic: 7700 частично адаптивен — 770 для малых дифф, 600 для больших
    const coeff = Math.abs(diff) > 0.4 ? 650 : 770;
    adjustment = Math.round(diff * coeff);
    adjustment = isCut ? clamp(adjustment, -500, 500) : clamp(adjustment, -300, 300);
  }
  if (isHealth && Math.abs(trendKgPerWeek) > 0.35) {
    adjustment = Math.round(trendKgPerWeek * 770 * 0.5);
    adjustment = clamp(adjustment, -250, 250);
  }
  let suggest = 'Тренд в норме';
  if (isHealth) {
    if (Math.abs(trendKgPerWeek) < 0.12) suggest = 'Вес стабилен — здоровье';
    else if (trendKgPerWeek > 0.3) suggest = 'Набор >0.3кг/нед — проверь профицит';
    else if (trendKgPerWeek < -0.3) suggest = 'Снижение >0.3кг/нед — проверь дефицит';
  } else if (isCut && trendKgPerWeek > -0.1 && trendKgPerWeek > expected * 0.5) suggest = 'Плато сушки — проверь дефицит или добавь 1000 шагов';
  else if (isBulk && trendKgPerWeek < 0.08) suggest = 'Набор стоит — +200ккал';
  else if (Math.abs(trendKgPerWeek - expected) < 0.12) suggest = 'Тренд совпадает с целью';
  void _baseTdee;
  return { adjustment, expected, trend: trendKgPerWeek, suggest };
}

// ── Guardы антропометрии ──
export function validateAnthropometry(input: { weight:number; height:number; lean?:number }): string[] {
  const warns:string[]=[];
  const hM=(input.height||175)/100;
  if(input.lean && hM>0){
    const ffmi=input.lean/(hM*hM)+6.1*(1.80-hM);
    if(ffmi>28) warns.push(`FFMI ${ffmi.toFixed(1)} >28 — LBM невозможен без ААС, BMR кламп`);
    if(ffmi<14) warns.push(`FFMI ${ffmi.toFixed(1)} <14 — дефицит LBM`);
  }
  const bmi=input.weight/(hM*hM);
  if(bmi>40) warns.push(`BMI ${bmi.toFixed(1)} — ожирение III, формулы с погрешностью`);
  if(bmi<16) warns.push(`BMI ${bmi.toFixed(1)} — дефицит массы`);
  return warns;
}

// ── Hall dynamic weight change (упрощенный) ──
export function hallWeightChangeDelta(kcalDiffPerDay:number, days:number, weightKg:number): number {
  // Hall 2011: при дефиците часть энергии из LBM, адаптация ~15% за 12нед
  // Упрощено: 7700 ккал/кг с адаптацией 0.85 при длительном
  const adapt = days>60 ? 0.85 : days>21 ? 0.92 : 1;
  return (kcalDiffPerDay * days / 7700) * adapt * (weightKg>90?1.05:1);
}
