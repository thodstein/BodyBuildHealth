/**
 * metabolic-constants.ts — единые константы и хелперы метаболики
 * Централизует BMR/PAL для всех движков питания, чтобы разойтись не могли.
 * Источники: Mifflin 1990, Katch-McArdle 1991, Cunningham 1991, Owen 1986,
 * Ten Haaf 2014, Harris-Benedict Revised (Roza-Shizgal) 1984, Henry Oxford 2005,
 * Livingston-Kohlstadt 2005, EFSA 2010, Helms 2014/2023, Hall 2011, Westerterp 2004,
 * Pontzer 2021, Baker 2017, Levine 2002, Trexler 2014.
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
export function bmrHarrisRevised(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  // Harris-Benedict Revised by Roza & Shizgal 1984 — классика для сравнения
  return sex === 'male'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}
export function bmrHenry(weightKg: number, age: number, sex: 'male' | 'female'): number {
  // Henry 2005 Oxford (FAO/WHO замена Schofield) — вес-доминантная, точнее для 30-60л, r=0.85 vs DLW
  if (sex === 'male') {
    if (age < 30) return 14.4 * weightKg + 313 + 113; // упрощено; точная — в bmrHenryFull
    if (age < 60) return 11.4 * weightKg + 541;
    return 11.1 * weightKg + 667;
  } else {
    if (age < 30) return 13.5 * weightKg + 497;
    if (age < 60) return 10.1 * weightKg + 569;
    return 9.08 * weightKg + 658;
  }
}
export function bmrHenryFull(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  // Henry Oxford 2005 weight+height (точнее, r=0.87) — для кросс-чека
  // Источник: Henry CJ, Br J Nutr 2005, уравнения 18-30/30-60/>60 по полу
  const hM = heightCm / 100;
  if (sex === 'male') {
    if (age < 30) return 14.2 * weightKg + 593 * hM + 95; // 18-30 M
    if (age < 60) return 11.4 * weightKg + 541; // 30-60 M (height незнач.)
    return 11.1 * weightKg + 667;
  } else {
    if (age < 30) return 13.4 * weightKg + 692 * hM - 85;
    if (age < 60) return 8.18 * weightKg + 502 * hM + 335;
    return 9.08 * weightKg + 658;
  }
}
export function bmrLivingston(weightKg: number, age: number, sex: 'male' | 'female'): number {
  // Livingston & Kohlstadt 2005 — BMI-зависимая, Frankfield 2015 лучшая при BMI>35
  // BMR = 293 * W^0.4330 - 5.92*age + sex поправка (Mifflin sex diff пропорциональна)
  const base = 293 * Math.pow(weightKg, 0.4330) - 5.92 * age;
  return sex === 'male' ? base + 615 : base + 447;
}
export type BMRMethod = 'katch_mcardle' | 'cunningham' | 'owen' | 'ten_haaf' | 'mifflin' | 'harris_revised' | 'henry' | 'livingston';
export interface BMRResult {
  bmr: number;
  lean: number;
  method: BMRMethod;
  allMethods?: Record<BMRMethod, number>;
}
export function computeBMR(input: { weight: number; height: number; age: number; sex: 'male' | 'female'; bodyFat?: number }): BMRResult {
  const bf = input.bodyFat;
  const hasBF = typeof bf === 'number' && bf > 3 && bf < 70;
  let lean: number;
  let bmr = 0;
  let method: BMRMethod = 'mifflin';
  let allMethods: Record<BMRMethod, number> | undefined;
  if (hasBF) {
    lean = input.weight * (1 - bf! / 100);
    // Выбор по LBM (Cunningham точнее при LBM>60кг, ошибка <4% vs 8% Mifflin — Cunningham 1991)
    // Возрастной гейт убран: точность Cunningham зависит от LBM, не от возраста
    if (lean >= 60) {
      bmr = bmrCunningham(lean);
      method = 'cunningham';
    } else {
      bmr = bmrKatchMcArdle(lean);
      method = 'katch_mcardle';
    }
    // guard: FFMI >26.2 Helms 2023 — LBM невозможен, кламп (Kouri 25 устарел)
    const hM = (input.height || 175) / 100;
    const ffmi = lean / (hM * hM) + 6.1 * (1.80 - hM);
    if (ffmi > 26.2) {
      const maxLean = (26.2 - 6.1 * (1.80 - hM)) * hM * hM;
      lean = Math.min(lean, maxLean);
      bmr = Math.min(bmr, bmrCunningham(lean));
    }
  } else {
    // без bf — оцениваем BF через Deurenberg 1991 (лучше чем фикс 15/22% — ошибка NHANES до 13%)
    // Deurenberg: BF% = 1.2*BMI +0.23*age -10.8*sex -5.4
    const bmiForLean = input.weight / (((input.height || 175) / 100) ** 2);
    const deurenBF = clamp(1.2 * bmiForLean + 0.23 * (input.age ?? 30) - 10.8 * (input.sex === 'male' ? 1 : 0) - 5.4, 5, 60);
    lean = input.weight * (1 - deurenBF / 100);
    // без bf — выбираем между Mifflin/Owen/TenHaaf/Harris/Henry/Livingston по контексту
    const mif = bmrMifflin(input.weight, input.height, input.age, input.sex);
    const ow = bmrOwen(input.weight, input.sex);
    const th = bmrTenHaaf(input.weight, input.height, input.age, input.sex);
    const hb = bmrHarrisRevised(input.weight, input.height, input.age, input.sex);
    const hen = bmrHenry(input.weight, input.age, input.sex);
    const henF = bmrHenryFull(input.weight, input.height, input.age, input.sex);
    const liv = bmrLivingston(input.weight, input.age, input.sex);
    // атлет 18-35 -> TenHaaf ближе, ожирение -> Owen, тяжелое ожирение BMI>=35 -> Livingston (Frankfield 2015), иначе Mifflin
    const bmi = bmiForLean;
    if (bmi >= 35) { bmr = liv; method = 'livingston'; }
    else if (bmi >= 30) { bmr = ow; method = 'owen'; }
    else if ((input.age ?? 30) <= 35 && bmi < 27) { bmr = th; method = 'ten_haaf'; }
    else { bmr = mif; method = 'mifflin'; }
    // allMethods теперь содержит ВСЕ методы для кросс-чека (нет 0 — реальный расчет)
    const katchLean = lean; // Deurenberg-оценка LBM
    allMethods = {
      katch_mcardle: Math.round(bmrKatchMcArdle(katchLean)),
      cunningham: Math.round(bmrCunningham(katchLean)),
      owen: Math.round(ow),
      ten_haaf: Math.round(th),
      mifflin: Math.round(mif),
      harris_revised: Math.round(hb),
      henry: Math.round(hen),
      // @ts-ignore — full henry as 9th key for кросс-чека (backward compat)
      henry_full: Math.round(henF),
      livingston: Math.round(liv),
    } as any;
  }
  bmr = Math.max(800, Math.round(bmr));
  // возрастная саркопения: Pontzer 2021 — RMR стабилен 20-60л, далее −1.5%/дек непрерывно (не ступенями)
  // Westerterp непрерывная модель: −0.15%/год после 50л = −1.5%/10л
  if ((input.age ?? 30) > 50) {
    const yearsOver = (input.age ?? 30) - 50;
    bmr = Math.round(bmr * (1 - yearsOver * 0.0015));
  }
  return { bmr, lean: Math.round(lean * 10) / 10, method, allMethods };
}

// ── TEF персональный (Westerterp 2004) ──
// ВАЖНО: FAO/WHO PAL уже включает TEF ~10% — отдельный TEF в хабе информативный, не суммируется повторно к TDEE (см. MetabolicHub waterfall note)
export function calcTEF(proteinG: number, carbsG: number, fatG: number, alcoholG = 0): number {
  // P 20-35% (берём 25%, растительный белок ~20% из-за клетчатки), C 5-10% (7%), F 0-3% (3%), alcohol 10-22% (берём 15% Suter 1992, средний)
  return Math.round(proteinG * 4 * 0.25 + carbsG * 4 * 0.07 + fatG * 9 * 0.03 + alcoholG * 7.1 * 0.15);
}
export function calcTEFFromKcal(kcal: number, proteinG: number, carbsG: number, fatG: number): number {
  const tef = calcTEF(proteinG, carbsG, fatG);
  // fallback 10% если макросы не заданы
  if (proteinG + carbsG + fatG < 10) return Math.round(kcal * 0.10);
  return clamp(tef, Math.round(kcal * 0.06), Math.round(kcal * 0.15));
}

// ── PAL ──
// Простая модель для хаба (low/medium/high/very_high + тренировочные дни/кардио)
// PAL по FAO/WHO 2001: sedentary 1.40-1.69, active 1.70-1.99, vigorous 2.00-2.40 (DLW)
// Калибровка 2026: trainAdd 0.040/сессию по MET (1ч силовой 6 MET≈360ккал≈0.18 PAL для 2000 BMR, не 0.022)
export const PAL_BASE_MAP = { low: 1.40, medium: 1.55, high: 1.75, very_high: 1.95 } as const;
export type PalLevel = 'low' | 'medium' | 'high' | 'very_high';

/** MET-калиброванный train/cardio вклад (для хаба) */
export function palTrainingAdd(trainingDays?: number): number {
  // 0.040 /д ≈ 80ккал/д на 2000 BMR ≈ ½ч силовой — MET-калибровано
  return clamp((trainingDays ?? 3) * 0.040, 0, 0.24);
}
export function palCardioAdd(cardioMin?: number): number {
  return clamp((cardioMin ?? 0) / 60 * 0.030, 0, 0.15);
}
export function computePalSimple(opts: {
  activityLevel?: PalLevel;
  trainingDays?: number;
  cardioMin?: number;
}): number {
  const palBase = PAL_BASE_MAP[opts.activityLevel ?? 'medium'];
  const trainAdd = palTrainingAdd(opts.trainingDays);
  const cardioAdd = palCardioAdd(opts.cardioMin);
  return clamp(palBase + trainAdd + cardioAdd, 1.25, 2.40);
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
    if(ffmi>26.2) warns.push(`FFMI ${ffmi.toFixed(1)} >26.2 — Helms 2023 лимит natty, BMR кламп`);
    if(ffmi<14) warns.push(`FFMI ${ffmi.toFixed(1)} <14 — дефицит LBM`);
  }
  const bmi=input.weight/(hM*hM);
  if(bmi>40) warns.push(`BMI ${bmi.toFixed(1)} — ожирение III, формулы с погрешностью`);
  if(bmi<16) warns.push(`BMI ${bmi.toFixed(1)} — дефицит массы`);
  return warns;
}

// ── Hall dynamic weight change — Pro (Hall 2011 Lancet) ──
// Энергетическая плотность потери зависит от доли жира p: density = p*9400+(1-p)*1800
// p via Forbes: p = 1/(1+ (10.4/FFM)*... ) упрощённо через BF%: жирные теряют больше жира (высокая плотность)
export function energyDensityPerKg(bodyFatPct?: number, _weightKg?: number): number {
  const bf = clamp(bodyFatPct ?? 18, 3, 60);
  // Forbes p ≈ 0.3 при BF15% lean, 0.7 при BF35% — линейная аппрокс между
  const p = clamp(0.2 + (bf - 8) * 0.015, 0.15, 0.85); // 15%→0.30, 35%→0.60
  const density = p * 9400 + (1 - p) * 1800; // 9400 fat, 1800 FFM (вода+белок)
  return Math.round(clamp(density, 3500, 9000));
}
export function hallAdaptationFactor(days: number): number {
  // Hall: адаптация экспонента ~15% за 6 мес, непрерывная exp(-t/200)
  // t=21д → 0.90, 60д→0.74, 180д→0.41? Слишком агрессивно — используем 1-exp модель для веса, не для плотности
  // Для delta используем упрощённо: adapt = 0.92 при 21д плавно к 0.85 при 60д и далее медленно
  if (days <= 0) return 1;
  return clamp(1 - 0.15 * (1 - Math.exp(-days / 90)), 0.82, 1);
}
export function hallWeightChangeDelta(kcalDiffPerDay:number, days:number, weightKg:number, bodyFatPct?: number): number {
  // Hall 2011: плотность зависит от состава + адаптация непрерывна exp, не ступенями
  if (days <= 0 || kcalDiffPerDay === 0) return 0;
  const density = energyDensityPerKg(bodyFatPct, weightKg);
  const adapt = hallAdaptationFactor(days);
  // weight>90 не дает +5% искусственно — эффект уже в density/bf
  return (kcalDiffPerDay * days / density) * adapt;
}

// ── Sweat electrolytes — Baker 2017 ──
export interface SweatElectrolytes {
  sodiumMg: number; // Na
  chlorideMg: number; // Cl ≈ Na*1.5
  potassiumMg: number; // K 150-300мг/л
  magnesiumMg: number; // Mg 5-20мг/л
}
export function calcSweatElectrolytes(volumeMl: number, sodiumMgPerL: number): SweatElectrolytes {
  const L = volumeMl / 1000;
  const sodiumMg = Math.round(L * sodiumMgPerL);
  const chlorideMg = Math.round(sodiumMg * 1.5); // Baker Table 3: Cl 40mmol vs Na 40mmol массово ×1.5
  const potassiumMg = Math.round(L * 180); // среднее 180мг/л (4.6 mmol)
  const magnesiumMg = Math.round(L * 12); // 0.5 mmol ≈12мг/л
  return { sodiumMg, chlorideMg, potassiumMg, magnesiumMg };
}

// ── Adaptive thermogenesis — Trexler 2014 / Rosenbaum 2010 ──
// AT = RMR_измер - RMR_предсказ; дефицит 500ккал >3нед → −10-15% сверх потери FFM
export function estimateAdaptiveThermogenesis(params: { deficitKcal?: number; weeksInDeficit?: number; weightLostKg?: number; ffmLostKg?: number }): number {
  const deficit = params.deficitKcal ?? 0;
  const weeks = params.weeksInDeficit ?? 0;
  const atFromDeficit = deficit > 300 && weeks >= 2 ? clamp(weeks * 8, 0, 120) : 0; // ~8ккал/нед дефицита, кап 120
  const atFromLoss = params.weightLostKg ? Math.round(params.weightLostKg * 15) : 0; // ~15ккал/кг потери сверх FFM
  return Math.round(Math.min(250, atFromDeficit + atFromLoss * 0.5));
}
export function reverseDietPlan(currentKcal: number, targetKcal: number, stepKcal?: number, stepDays?: number): Array<{ week: number; kcal: number; note: string }> {
  // MATADOR Byrne 2017: ступенчатый +100ккал/7-14д до восстановления TDEE
  const step = stepKcal ?? 100;
  const days = stepDays ?? 7;
  const plan: Array<{ week: number; kcal: number; note: string }> = [];
  let kcal = currentKcal;
  let w = 1;
  while (kcal < targetKcal && w <= 12) {
    kcal = Math.min(targetKcal, kcal + step);
    plan.push({ week: w, kcal, note: `+${step}ккал /${days}д` });
    w++;
  }
  if (plan.length === 0) plan.push({ week: 1, kcal: targetKcal, note: 'Цель достигнута' });
  return plan;
}

// ── HOMA-IR proxy — Wallace 2004 ──
export function calcHomaIR(glucoseMgDl?: number, insulinMuMl?: number): number | null {
  if (typeof glucoseMgDl !== 'number' || typeof insulinMuMl !== 'number') return null;
  if (glucoseMgDl <= 20 || insulinMuMl <= 0.5) return null;
  const glucoseMmol = glucoseMgDl / 18.018;
  return Math.round((glucoseMmol * insulinMuMl / 22.5) * 100) / 100;
}

// ── Body fat — JP / Durnin-Womersley / BIA ──
export function calcJPBodyFat(sumMm: number, age: number, sex: 'male' | 'female'): number | null {
  if (sumMm <= 5 || sumMm > 200) return null;
  // Jackson-Pollock 3-site (1978/1980): chest+abdomen+thigh M, triceps+suprailiac+thigh F
  // density = 1.10938 -0.0008267*sum +0.0000016*sum² -0.0002574*age
  let density: number;
  if (sex === 'male') density = 1.10938 - 0.0008267 * sumMm + 0.0000016 * sumMm * sumMm - 0.0002574 * age;
  else density = 1.0994921 - 0.0009929 * sumMm + 0.0000023 * sumMm * sumMm - 0.0001392 * age;
  if (density <= 0.9 || density >= 1.12) return null;
  const bf = (495 / density) - 450; // Siri 1956
  return clamp(Math.round(bf * 10) / 10, 3, 60);
}
export function calcDurninBodyFat(sum4Mm: number, age: number, sex: 'male' | 'female'): number | null {
  if (sum4Mm <= 8 || sum4Mm > 300) return null;
  // Durnin & Womersley 1974: biceps+triceps+subscapular+suprailiac
  // log c = a - b*log10(sum)
  const logSum = Math.log10(sum4Mm);
  let density: number;
  if (sex === 'male') {
    if (age < 20) density = 1.1620 - 0.0630 * logSum;
    else if (age < 30) density = 1.1631 - 0.0632 * logSum;
    else if (age < 40) density = 1.1422 - 0.0544 * logSum;
    else if (age < 50) density = 1.1620 - 0.0700 * logSum;
    else density = 1.1715 - 0.0779 * logSum;
  } else {
    if (age < 20) density = 1.1549 - 0.0678 * logSum;
    else if (age < 30) density = 1.1599 - 0.0717 * logSum;
    else if (age < 40) density = 1.1423 - 0.0632 * logSum;
    else if (age < 50) density = 1.1333 - 0.0612 * logSum;
    else density = 1.1339 - 0.0645 * logSum;
  }
  if (density <= 0.9 || density >= 1.12) return null;
  const bf = (495 / density) - 450;
  return clamp(Math.round(bf * 10) / 10, 3, 60);
}
export function calcBIAKyle(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female', resistanceOhm?: number): number | null {
  // Kyle 2004 BIA FFM: FFM = -4.104 +0.518*Ht²/R +0.231*W +0.130*Xc +4.229*sex (sex 1=male)
  // Упрощено: если R нет — оценка via Deurenberg (fallback)
  if (typeof resistanceOhm === 'number' && resistanceOhm > 300 && resistanceOhm < 900) {
    const ht2r = (heightCm * heightCm) / resistanceOhm;
    const ffm = -4.104 + 0.518 * ht2r + 0.231 * weightKg + 4.229 * (sex === 'male' ? 1 : 0);
    if (ffm <= 20 || ffm >= weightKg) return null;
    const bf = (1 - ffm / weightKg) * 100;
    return clamp(Math.round(bf * 10) / 10, 3, 60);
  }
  return null;
}

// ── Fiber split + LBM preservation (Helms 2014) ──
export function fiberSplit(totalFiberG: number): { soluble:number; insoluble:number; note:string } {
  // IoM 2005: ~30% soluble, 70% insoluble у смешанной диеты; BB цель soluble ≥8г для холестерина
  const soluble = Math.round(totalFiberG * 0.32);
  const insoluble = Math.max(0, totalFiberG - soluble);
  return { soluble, insoluble, note: `Soluble ${soluble}г (овес/бобовые) + insoluble ${insoluble}г — soluble снижает LDL` };
}
export function lbmPreservationScore(input: { proteinGPerKg:number; deficitKcal:number; trainingDays:number; ea?: number | null }): { pct:number; note:string } {
  // Helms JISSN 2014: сушка 2.8г/кг lean + 0.7×carbFloor + 4×/нед сохраняет 85-90% LBM; <1.8г/кг → 60%
  const p = input.proteinGPerKg ?? 2.0;
  const deficit = input.deficitKcal ?? 0;
  const deficitFactor = deficit > 700 ? 0.75 : deficit > 400 ? 0.85 : 1;
  const trainingFactor = input.trainingDays >= 4 ? 1 : input.trainingDays >= 2 ? 0.9 : 0.75;
  const eaFactor = input.ea != null && input.ea < 25 ? 0.8 : 1;
  const proteinFactor = p >= 2.6 ? 1 : p >= 2.2 ? 0.92 : p >= 1.8 ? 0.78 : 0.60;
  const pct = Math.round(clamp(proteinFactor * deficitFactor * trainingFactor * eaFactor, 0.45, 0.95) * 100);
  const note = pct >= 85 ? 'Сохранение LBM высокое (Helms)' : pct >= 70 ? 'Среднее — повысь белок до 2.6г/кг lean' : 'Низкое — дефицит большой, белок низкий, EA<25';
  return { pct, note };
}

// ── Lipid Mensink 2003 + FLI Bedogni 2006 + PSMF + Menstrual ──
export function estimateLipidImpact(sfaG?: number, fiberG?: number, baseLdl?: number): { ldlDelta:number; note:string } | null {
  if (typeof sfaG !== 'number' || typeof fiberG !== 'number') return null;
  // Mensink Am J Clin Nutr 2003: SFA 10г → LDL +12мг/дл, fiber 10г → −5мг/дл (упрощено 1.2 и 0.5)
  const ldlDelta = Math.round(sfaG * 1.2 - fiberG * 0.5);
  const base = typeof baseLdl === 'number' ? baseLdl : 120;
  const note = ldlDelta > 10 ? `SFA ${sfaG}г + fiber ${fiberG}г → LDL ${base+ldlDelta} (+${ldlDelta}) — снизь SFA <10% ккал` : `LDL ~${base+ldlDelta} (Δ ${ldlDelta>=0?'+':''}${ldlDelta})`;
  return { ldlDelta, note };
}
export function calcFLI(params: { bmi:number; waistCm:number; tgMgDl?:number; ggt?:number }): number | null {
  // Bedogni BMC Gastro 2006 FLI: logit = 0.953*ln(TG)+0.139*BMI+0.718*ln(GGT)+0.053*waist -15.745
  const { bmi, waistCm, tgMgDl, ggt } = params;
  if (!isFinite(bmi) || !isFinite(waistCm) || bmi<12 || waistCm<50) return null;
  const tg = tgMgDl ?? 120; // если нет — средний
  const ggtV = ggt ?? 25;
  if (tg <= 0 || ggtV <= 0) return null;
  const logit = 0.953 * Math.log(tg) + 0.139 * bmi + 0.718 * Math.log(ggtV) + 0.053 * waistCm - 15.745;
  const fli = (Math.exp(logit) / (1 + Math.exp(logit))) * 100;
  return clamp(Math.round(fli), 0, 100);
}
export function checkPSMF(ea?: number | null): { risk:boolean; note:string } {
  // Blackburn 1973: EA <15 → обязательная потеря FFM даже с белком 2.8г/кг
  if (ea == null) return { risk:false, note:'EA неизвестна — введи ккал/EEE' };
  if (ea < 15) return { risk:true, note:'PSMF риск: EA <15 → FFM loss неизбежен (Blackburn). +300ккал или снизь EEE' };
  if (ea < 20) return { risk:true, note:'EA 15-20 — граница PSMF, белок 2.8г/кг + силовые обязательны' };
  return { risk:false, note:'EA ≥20 — PSMF безопасен по FFM' };
}
export function menstrualWaterRetention(phase?: string): { kg:number; note:string } {
  // Benton 2021: лютеин +1-2кг воды, Na-чувствительность ↑, Fe потеря
  if (phase === 'luteal') return { kg: 1.2, note:'Лютеин: +1-2кг воды, +3.2ккал/кг BMR, Na осторожнее, Fe контроль' };
  return { kg: 0, note:'Фолликул: без задержки воды' };
}
