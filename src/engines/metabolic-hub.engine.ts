/**
 * metabolic-hub.engine.ts — единый движок 5 калькуляторов с/без ААС
 * Вода / Шаги / КБЖУ / Жир / Кортизол — один снапшот, без дублей.
 * Формулы: EFSA/Mifflin-St Jeor + Katch-McArdle, ISSN/Helms, US Navy, Gabbett ACWR.
 * Pro-уровень: инвалидация дубль-PAL, cm→in, дозозависимый ААС, HPA-индекс.
 */
export interface WeightPoint { date: string; kg: number }
export interface MetabolicInput {
  weight: number; height: number; age: number; sex: 'male'|'female';
  bodyFat?: number; neck?: number; waist?: number; hip?: number;
  steps?: number; cardioMin?: number; trainingDays?: number; trainingHours?: number;
  activityLevel?: 'low'|'medium'|'high'; // бытовая NEAT
  goal?: 'cut'|'maintain'|'bulk';
  onAAS?: boolean; aasDose?: number; // мг/нед тест-экв (опционально, для дозозависимости)
  stress?: number; sleepHours?: number; sleepQuality?: number; // 1-5
  acwr?: number; // для кортизола
  // pro-расширения (опциональные, backward compat)
  climate?: 'temperate'|'hot'|'cold';
  sweatRate?: number; // мл/ч 400-800, если известен
  weightHistory?: WeightPoint[]; // для адаптивного TDEE по тренду
}

const clamp = (v:number, lo:number, hi:number)=> Math.max(lo, Math.min(hi, v));
const toIn = (cm:number)=> cm * 0.393701;
const log10 = (x:number)=> Math.log(x)/Math.log(10);

// ——— адаптивный тренд как в nutrition-v2-data.ts:113 ———
export function calcTrendFromHistory(history: WeightPoint[]): number {
  if(!history || history.length < 3) return 0;
  const recent = history.slice(-7);
  if(recent.length < 2) return 0;
  const first = recent[0].kg, last = recent[recent.length-1].kg;
  const days = (new Date(recent[recent.length-1].date).getTime() - new Date(recent[0].date).getTime()) / 86400000;
  if(days < 3) return 0;
  return (last - first) / (days / 7);
}
export function calcAdaptiveAdjustment(trendKgPerWeek:number, goal: 'cut'|'maintain'|'bulk'|undefined, baseTdee:number): { adjustment:number; expected:number; trend:number; suggest:string } {
  const isCut = goal==='cut';
  const isBulk = goal==='bulk';
  let expected = 0;
  if(isCut) expected = -0.5; // кг/нед целевая сушка
  else if(isBulk) expected = 0.25;
  let adjustment = 0;
  if((isCut || isBulk) && Math.abs(trendKgPerWeek - expected) > 0.05){
    const diff = trendKgPerWeek - expected;
    adjustment = Math.round(diff * 770); // 7700ккал/кг → 770/0.1кг
    adjustment = isCut ? clamp(adjustment, -500, 500) : clamp(adjustment, -300, 300);
  }
  let suggest = 'Тренд в норме';
  if(isCut && trendKgPerWeek > -0.1 && trendKgPerWeek > expected*0.5) suggest = 'Плато сушки — проверь дефицит или добавь 1000 шагов';
  else if(isBulk && trendKgPerWeek < 0.08) suggest = 'Набор стоит — +200ккал';
  else if(Math.abs(trendKgPerWeek - expected) < 0.12) suggest = 'Тренд совпадает с целью';
  void baseTdee;
  return { adjustment, expected, trend: trendKgPerWeek, suggest };
}

// ——— общий BMR ———
function bmrKatchMcArdle(lean:number){ return 370 + 21.6 * lean; }
function bmrMifflin(w:number,h:number,a:number,sex:'male'|'female'){
  return sex==='male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
}
function computeBMR(input: MetabolicInput){
  const bf = input.bodyFat;
  const hasBF = typeof bf==='number' && bf>3 && bf<70;
  if(hasBF){
    const lean = input.weight * (1 - bf!/100);
    const bmr = Math.max(800, bmrKatchMcArdle(lean));
    return { bmr, lean, method:'katch_mcardle' as const };
  }
  const bmr = Math.max(800, bmrMifflin(input.weight, input.height, input.age, input.sex));
  const leanDef = input.weight * (1 - (input.sex==='male'?0.15:0.22));
  return { bmr, lean: leanDef, method:'mifflin' as const };
}
function aasMult(input: MetabolicInput, maxBoost:number){
  if(!input.onAAS) return 1;
  const dose = clamp(input.aasDose ?? 500, 0, 3000);
  // 500мг → ~50% от максимума, 1500мг → ~90% — насыщение
  const frac = dose<=0 ? 0.6 : Math.min(1, 0.4 + 0.6 * (dose/800));
  // линейно до maxBoost
  return 1 + maxBoost * frac;
}

// ——— Вода ———
export function calcWater(input: MetabolicInput) {
  const { lean } = computeBMR(input);
  const fatMass = Math.max(0, input.weight - lean);
  // База: 35мл/кг общей, но жир — 20мл/кг (меньше воды), lean — 40мл/кг
  // Для bf<18 — приближается к 35мл/кг; для ожирения — экономит ~15%
  const hasBF = typeof input.bodyFat==='number' && input.bodyFat>3;
  const base = hasBF ? Math.round(lean*40 + fatMass*20) : Math.round(input.weight * 35);
  const hours = input.trainingHours ?? (input.trainingDays ?? 3) * 1.1;
  const sweat = input.sweatRate ?? 600; // мл/ч средний
  const training = Math.round(hours * sweat * 0.85 + (input.cardioMin ?? 0) * 7); // 7мл/мин кардио ~420мл/ч
  const climateAdd = input.climate==='hot' ? 600 : input.climate==='cold' ? -150 : 0;
  const nat = Math.round(base + training + climateAdd);
  const boost = aasMult(input, 0.12) - 1; // 0..0.12 дозозависимо
  const aas = Math.round(nat * (1 + boost));
  const perHour = Math.round(nat / 16);
  const perHourAAS = Math.round(aas / 16);
  return {
    nat, aas,
    delta: aas - nat,
    perHour, perHourAAS,
    note: input.onAAS
      ? `ААС: +${Math.round(boost*100)}% (задержка Na/H2O, эритроцитоз). HCT>50 → +500мл, АД>140 → +300мл. Контроль Na 4-5г/сут, K 3.5-4.5г`
      : 'Натурал: EFSA 35мл/кг (lean 40/жир 20) + пот ~600мл/ч. Жара +600мл',
    breakdown: { base: Math.round(base), training: Math.round(training), climate: climateAdd, lean: Math.round(lean), fatMass: Math.round(fatMass) }
  };
}

// ——— Шаги ———
export function calcSteps(input: MetabolicInput) {
  const { bmr } = computeBMR(input);
  const palBaseMap = { low: 1.40, medium: 1.55, high: 1.75 } as const;
  const palBase = palBaseMap[input.activityLevel ?? 'medium'];
  // тренировочная надбавка к PAL раздельно (EAT), не дубль BMR*PAL+training
  const trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  const palEff = clamp(palBase + trainAdd + cardioAdd, 1.25, 2.25);
  const tdeeNat = Math.round(bmr * palEff);
  const mult = aasMult(input, 0.08);
  const tdeeAAS = Math.round(tdeeNat * mult);
  // цель — % от TDEE (профессионально)
  const cutDelta = Math.round(-Math.min(750, Math.max(400, tdeeNat * 0.18)));
  const bulkDelta = Math.round(Math.min(450, Math.max(250, tdeeNat * 0.10)));
  const goalDelta = input.goal === 'cut' ? cutDelta : input.goal === 'bulk' ? bulkDelta : 0;
  const targetNat = tdeeNat + goalDelta;
  const targetAAS = tdeeAAS + goalDelta;
  // 1 шаг: ~0.04ккал на 70кг, масса-зависимо + рост-зависимый шаг
  const kcalPerStep = 0.04 * (input.weight / 70) * (input.height ? (input.height/175) : 1);
  const kcalPerStepClamped = clamp(kcalPerStep, 0.025, 0.07);
  const sedentKcal = Math.round(bmr * 1.20);
  const stepsNat = Math.round(clamp((targetNat - sedentKcal) / kcalPerStepClamped, 3000, 22000));
  const stepsAAS = Math.round(clamp(stepsNat * (input.onAAS ? 0.92 : 1), 3000, 22000));
  // TEF 10% для waterfall (наглядно, внутри PAL)
  const tefNat = Math.round(tdeeNat * 0.10);
  const tefAAS = Math.round(tdeeAAS * 0.10);
  const neat = Math.round(bmr * (palBase - 1));
  const eat = Math.round(bmr * (trainAdd + cardioAdd));
  // адаптивный TDEE по weightHistory
  let adaptive: { trend:number; adjustment:number; tdee:number; suggest:string } | null = null;
  if(input.weightHistory && input.weightHistory.length >=3){
    const trend = calcTrendFromHistory(input.weightHistory);
    const { adjustment, suggest } = calcAdaptiveAdjustment(trend, input.goal, tdeeNat);
    adaptive = { trend: Math.round(trend*100)/100, adjustment, tdee: tdeeNat + adjustment, suggest };
  }
  return {
    tdeeNat, tdeeAAS,
    targetNat, targetAAS,
    stepsNat: Math.min(22000, stepsNat), stepsAAS: Math.min(22000, stepsAAS),
    delta: stepsAAS - stepsNat,
    pal: Math.round(palEff*100)/100,
    kcalPerStep: Math.round(kcalPerStepClamped*1000)/1000,
    sedentKcal,
    tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive,
    note: input.onAAS ? `ААС: TDEE +${Math.round((mult-1)*100)}% (NEAT↑) → шагов −8% для того же дефицита` : `Натурал: PAL ${palEff.toFixed(2)} (бытовая ${palBase}+train ${trainAdd.toFixed(2)}+cardio ${cardioAdd.toFixed(2)})`
  };
}

// ——— КБЖУ ———
export function calcKBJU(input: MetabolicInput) {
  const { bmr, lean, method } = computeBMR(input);
  const palBaseMap = { low: 1.40, medium: 1.55, high: 1.75 } as const;
  const palBase = palBaseMap[input.activityLevel ?? 'medium'];
  const trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  const palEff = clamp(palBase + trainAdd + cardioAdd, 1.25, 2.25);
  let tdeeNat = Math.round(bmr * palEff);
  const mult = aasMult(input, 0.10);
  let tdeeAAS = Math.round(tdeeNat * mult);
  const cutDelta = Math.round(-Math.min(750, Math.max(400, tdeeNat * 0.18)));
  const bulkDelta = Math.round(Math.min(450, Math.max(250, tdeeNat * 0.10)));
  const goalDelta = input.goal === 'cut' ? cutDelta : input.goal === 'bulk' ? bulkDelta : 0;
  tdeeNat += goalDelta; tdeeAAS += goalDelta;
  const tefNat = Math.round(tdeeNat * 0.10);
  const tefAAS = Math.round(tdeeAAS * 0.10);
  const neat = Math.round(bmr * (palBase - 1));
  const eat = Math.round(bmr * (trainAdd + cardioAdd));
  // Белок ISSN/Helms: натурал 1.8-2.2 maintain/bulk, 2.3-3.1 cut по сухости
  const bf = input.bodyFat ?? (input.sex==='male'?15:22);
  let protNat: number;
  if(input.goal==='cut'){
    protNat = bf < 12 ? 2.6 : bf < 18 ? 2.4 : 2.2;
  } else if(input.goal==='bulk'){
    protNat = 1.9;
  } else {
    protNat = 2.0;
  }
  // ААС: +0.4-0.8 г/кг дозозависимо, 2.8 — средняя для 500мг
  const aasProtAdd = input.onAAS ? 0.4 + clamp((input.aasDose ?? 500)/1000, 0, 0.8) : 0;
  const protAAS = +(protNat + aasProtAdd).toFixed(1);
  const pNat = Math.round(input.weight * protNat);
  const pAAS = Math.round(input.weight * protAAS);
  // Жиры: минимум гормональный
  const fMinNat = input.goal==='cut' ? 0.8 : 0.9;
  const fNat = Math.round(Math.max(50, input.weight * fMinNat));
  const fAAS = Math.round(Math.max(55, input.weight * 1.0));
  // Углеводы — остаток с полом и потолком 5-8 г/кг (planner-targets)
  const kcalProtNat = pNat * 4, kcalFatNat = fNat * 9;
  let cNat = Math.max(80, Math.round((tdeeNat - kcalProtNat - kcalFatNat)/4));
  const kcalProtAAS = pAAS * 4, kcalFatAAS = fAAS * 9;
  let cAAS = Math.max(100, Math.round((tdeeAAS - kcalProtAAS - kcalFatAAS)/4));
  // диетологический потолок 5г/кг (до 8 при инсулине — здесь нет инсулина, 5)
  const carbCeil = Math.round(input.weight * 5);
  const carbFloor = 90;
  cNat = clamp(cNat, carbFloor, carbCeil);
  cAAS = clamp(cAAS, 110, Math.round(input.weight * 6));
  // пересчёт ккал после клампа углеводов
  const kcalNatFinal = pNat*4 + fNat*9 + cNat*4;
  const kcalAASFinal = pAAS*4 + fAAS*9 + cAAS*4;
  let adaptive: { trend:number; adjustment:number; tdee:number; suggest:string } | null = null;
  if(input.weightHistory && input.weightHistory.length >=3){
    const trend = calcTrendFromHistory(input.weightHistory);
    const { adjustment, suggest } = calcAdaptiveAdjustment(trend, input.goal, tdeeNat);
    adaptive = { trend: Math.round(trend*100)/100, adjustment, tdee: tdeeNat + adjustment, suggest };
  }
  return {
    nat: { kcal: kcalNatFinal, p: pNat, f: fNat, c: cNat, protPerKg: protNat, tdee: tdeeNat, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    aas: { kcal: kcalAASFinal, p: pAAS, f: fAAS, c: cAAS, protPerKg: protAAS, tdee: tdeeAAS, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    delta: { kcal: Math.round(kcalAASFinal - kcalNatFinal), p: pAAS - pNat, c: cAAS - cNat },
    carbTiming: input.trainingDays && input.trainingDays>=4 ? 'Тренировочный: 55% вокруг тренировки, 25% утро, 20% вечер · Отдых: 35/35/30' : '50% вокруг тренировки, 30% утро, 20% вечер',
    fiber: { nat: input.sex==='male'? 32: 25, aas: input.sex==='male'? 34: 26 },
    tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive,
    note: input.onAAS ? `ААС: белок ${protAAS}г/кг (+${aasProtAdd.toFixed(1)}), TDEE +${Math.round((mult-1)*100)}%, жиры 1.0г/кг` : `Натурал: белок ${protNat}г/кг (Helms/ISSN), жиры ${fMinNat}г/кг, PAL ${palEff.toFixed(2)}`
  };
}

// ——— Жир ———
export function calcBodyFat(input: MetabolicInput) {
  // US Navy — вход в дюймах, исправлено cm→in
  let navy: number | null = null;
  const hIn = input.height ? toIn(input.height) : null;
  const waistIn = input.waist ? toIn(input.waist) : null;
  const neckIn = input.neck ? toIn(input.neck) : null;
  const hipIn = input.hip ? toIn(input.hip) : null;
  if (hIn && waistIn && neckIn) {
    if (input.sex === 'male' && waistIn > neckIn) {
      navy = 86.01*log10(waistIn - neckIn) - 70.041*log10(hIn) + 36.76;
    } else if (input.sex === 'female' && hipIn && waistIn && neckIn) {
      const sum = waistIn + hipIn - neckIn;
      if(sum>0) navy = 163.205*log10(sum) - 97.684*log10(hIn) - 78.387;
    }
    if(navy!=null && !isFinite(navy)) navy=null;
    if(navy!=null) navy = clamp(navy, 3, 65);
  }
  // ББ/ПЛ коррекция талии от осевой нагрузки — умеренная, прозрачная
  const squatVol = (input.trainingDays ?? 3) * 7;
  const axialAddCm = squatVol > 22 ? 1.4 : squatVol > 14 ? 0.7 : 0;
  const waistAdjCm = (input.waist ?? 0) + axialAddCm;
  let navyAdj: number | null = null;
  if (navy != null && axialAddCm>0 && waistIn && neckIn && hIn) {
    const waistAdjIn = toIn(waistAdjCm);
    if (input.sex === 'male' && waistAdjIn > neckIn) navyAdj = 86.01*log10(waistAdjIn - neckIn) - 70.041*log10(hIn) + 36.76;
    else if (input.sex === 'female' && hipIn) {
      const sum = waistAdjIn + hipIn - neckIn;
      if(sum>0) navyAdj = 163.205*log10(sum) - 97.684*log10(hIn) - 78.387;
    }
    if(navyAdj!=null) navyAdj = clamp(navyAdj, 3, 65);
  }
  const currRaw = input.bodyFat ?? navy ?? (input.sex==='female'?22:15);
  const curr = clamp(Math.round(currRaw*10)/10, 3, 65);
  const ffm = input.weight * (1 - curr/100);
  const hM = (input.height||180)/100;
  const ffmi = ffm / (hM*hM);
  // FFMI нормализованный к росту 1.80 (Kouri 1995)
  const ffmiNorm = ffmi + 6.1 * (1.80 - hM);
  const aasAdd = input.onAAS ? clamp(0.8 + (input.aasDose ?? 500)/1200, 0.8, 2.2) : 0;
  const ffmiAdj = ffmi + aasAdd;
  const ffmiNormAdj = ffmiNorm + aasAdd;
  const natLimit = 25;
  return {
    navy: navy != null ? Math.round(navy*10)/10 : null,
    navyAdj: navyAdj != null ? Math.round(navyAdj*10)/10 : null,
    waistAdj: axialAddCm>0 ? Math.round(waistAdjCm*10)/10 : null,
    axialAdd: axialAddCm,
    current: curr,
    ffm: Math.round(ffm*10)/10,
    ffmi: Math.round(ffmi*10)/10,
    ffmiNorm: Math.round(ffmiNorm*10)/10,
    ffmiAdj: Math.round(ffmiAdj*10)/10,
    ffmiNormAdj: Math.round(ffmiNormAdj*10)/10,
    natLimit,
    isOverNatLimit: ffmiNorm > natLimit,
    isOverNatLimitAAS: ffmiNormAdj > natLimit,
    note: axialAddCm>0 ? `Осевая +${axialAddCm}см к талии (присед/тяга ~${squatVol} сет/нед)` : 'Без осевой коррекции',
    aasNote: input.onAAS ? `ААС: FFMI +${aasAdd.toFixed(1)} (вода/гликоген). Натуральный лимит FFMI_norm ~25` : `Натурал: лимит FFMI_norm ~25, у вас ${ffmiNorm.toFixed(1)}`,
    accuracy: 'Navy ±3.5% (гидратация/осанка/еда). Для трека — мерьте в одних условиях'
  };
}

// ——— Кортизол — HPA индекс риска (не фейк нмоль/л) ———
export function calcCortisol(input: MetabolicInput) {
  const stress = clamp(input.stress ?? 5, 1, 10);
  const sleep = clamp(input.sleepHours ?? 7, 3, 11);
  const sleepQ = clamp(input.sleepQuality ?? 3, 1, 5);
  const acwr = clamp(input.acwr ?? 1, 0, 3);
  // индекс 0-100: 50 = норма, >70 = высокий
  let score = 50;
  score += (stress - 5) * 4.5; // 1→-18, 10→+22.5
  score += (7 - sleep) * 5.5; // 4ч → +16.5
  score += (3 - sleepQ) * 4; // 1 → +8
  score += Math.max(0, acwr - 1.15) * 28; // ACWR 1.5→+9.8, 2.0→+23.8
  if(acwr < 0.75) score += (0.75 - acwr)*10; // детрен
  score = clamp(Math.round(score), 8, 96);
  // супрессия ААС дозозависимо: −10..−18%
  const aasScore = clamp(Math.round(score * (input.onAAS ? 0.86 : 1)), 5, 96);
  const zone = (v:number)=> v<38 ? 'low' : v<=62 ? 'norm' : v<=78 ? 'high' : 'very_high';
  const zoneNat = zone(score);
  const zoneAAS = zone(aasScore);
  const zoneLabel: Record<string,string> = { low:'Низкий (риск детрена/гипо)', norm:'Норма', high:'Повышен', very_high:'Высокий — делод/сон' };
  // what-if: возврат индекса
  const whatIf = (dSleep:number, dStress:number, dAcwr:number)=>{
    let v = score + dStress*4.5 + dSleep*(-5.5) + dAcwr*28;
    return clamp(Math.round(v), 5, 96);
  };
  // совместимость: старые поля nat/aas как индекс
  return {
    nat: score, aas: aasScore, delta: aasScore - score,
    natIdx: score, aasIdx: aasScore,
    zoneNat, zoneAAS,
    zoneLabelNat: zoneLabel[zoneNat], zoneLabelAAS: zoneLabel[zoneAAS],
    diurnal: input.onAAS
      ? 'ААС: супрессия HPA, утренний пик сглажен. Риск отката 2-4 нед после курса'
      : 'Физиология: пик 06:00-08:00, минимум 22:00-02:00. Свет/кофеин сдвигают',
    whatIf,
    acwrZone: acwr<0.8?'undertrained': acwr<=1.3?'optimal': acwr<=1.5?'caution':'dangerous',
    note: input.onAAS ? 'ААС: HPA −14% (дозозависимо). После отмены — мониторинг усталости/сна 2-4нед' : 'Индекс из стресс/сон/качество/ACWR. Не лаба — скрининг перегруза',
    scaleNote: 'Шкала 0-100: <38 низкий, 38-62 норма, 63-78 повышен, >78 высокий'
  };
}
