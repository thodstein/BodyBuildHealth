/**
 * metabolic-hub.engine.ts — единый движок 5 калькуляторов с/без ААС
 * Вода / Шаги / КБЖУ / Жир / Кортизол — один снапшот, без дублей.
 * Формулы: EFSA/Mifflin-Katch, Helms, US Navy, Schoenfeld, Issurin.
 */
export interface MetabolicInput {
  weight: number; height: number; age: number; sex: 'male'|'female';
  bodyFat?: number; neck?: number; waist?: number; hip?: number;
  steps?: number; cardioMin?: number; trainingDays?: number; trainingHours?: number;
  activityLevel?: 'low'|'medium'|'high'; // бытовая
  goal?: 'cut'|'maintain'|'bulk';
  onAAS?: boolean; aasDose?: number; // мг/нед тест-экв
  stress?: number; sleepHours?: number; sleepQuality?: number; // 1-5
  acwr?: number; // для кортизола
}

// ——— Вода ———
export function calcWater(input: MetabolicInput) {
  const base = input.weight * 35; // мл
  const training = (input.trainingHours ?? 0) * 500 + (input.cardioMin ?? 0) * 8;
  const climate = 0; // запас для жары
  const nat = Math.round(base + training + climate);
  // ААС: задержка Na, эритроцитоз, АД → +12% + 300мг Na контроль
  const aas = Math.round(nat * 1.12 + (input.onAAS ? 300 : 0));
  const perHour = Math.round((input.onAAS ? aas : nat) / 16);
  return {
    nat, aas,
    delta: aas - nat,
    perHour, perHourAAS: Math.round(aas/16),
    note: input.onAAS ? 'ААС: +12% + Na-контроль, HCT>50 — +500мл, АД>140 — +300мл' : 'Натурал: EFSA 35мл/кг + тренировка',
    breakdown: { base: Math.round(base), training: Math.round(training) }
  };
}

// ——— Шаги ———
export function calcSteps(input: MetabolicInput) {
  // BMR Katch-McArdle
  const lean = input.weight * (1 - (input.bodyFat ?? 15)/100);
  const bmr = 370 + 21.6 * lean;
  const palMap = { low: 1.375, medium: 1.55, high: 1.725 } as const;
  const pal = palMap[input.activityLevel ?? 'medium'];
  const tdeeNat = bmr * pal + (input.cardioMin ?? 0) * 8 + (input.trainingDays ?? 3) * 150;
  const tdeeAAS = tdeeNat * (input.onAAS ? 1.08 : 1);
  const goalDelta = input.goal === 'cut' ? -500 : input.goal === 'bulk' ? 300 : 0;
  const targetNat = tdeeNat + goalDelta;
  const targetAAS = tdeeAAS + goalDelta;
  // 1 шаг ≈ 0.04 ккал (70кг), корректируется весом
  const kcalPerStep = 0.04 * (input.weight / 70);
  const stepsNat = Math.round(Math.max(3000, (targetNat - (bmr*1.2)) / kcalPerStep));
  const stepsAAS = Math.round(stepsNat * (input.onAAS ? 0.92 : 1));
  return {
    tdeeNat: Math.round(tdeeNat), tdeeAAS: Math.round(tdeeAAS),
    targetNat: Math.round(targetNat), targetAAS: Math.round(targetAAS),
    stepsNat: Math.min(20000, stepsNat), stepsAAS: Math.min(20000, stepsAAS),
    delta: stepsAAS - stepsNat,
    note: input.onAAS ? 'ААС: TDEE +8% → шагов −8% для того же дефицита' : 'Натурал: PAL по бытовой + кардио + силовые'
  };
}

// ——— КБЖУ ———
export function calcKBJU(input: MetabolicInput) {
  const lean = input.weight * (1 - (input.bodyFat ?? 15)/100);
  const bmr = 370 + 21.6 * lean;
  const palMap = { low: 1.375, medium: 1.55, high: 1.725 } as const;
  const pal = palMap[input.activityLevel ?? 'medium'];
  let tdeeNat = bmr * pal + (input.cardioMin ?? 0) * 8 + (input.trainingDays ?? 3) * 150;
  let tdeeAAS = tdeeNat * (input.onAAS ? 1.10 : 1);
  const goalDelta = input.goal === 'cut' ? -500 : input.goal === 'bulk' ? 300 : 0;
  tdeeNat += goalDelta; tdeeAAS += goalDelta;
  // Белок
  const protNat = input.goal === 'cut' ? 2.2 : 1.8;
  const protAAS = 2.8;
  const pNat = Math.round(input.weight * protNat);
  const pAAS = Math.round(input.weight * protAAS);
  // Жиры
  const fNat = Math.round(Math.max(50, input.weight * 0.8));
  const fAAS = Math.round(Math.max(60, input.weight * 1.0));
  // Углеводы — остаток
  const kcalProtNat = pNat * 4, kcalFatNat = fNat * 9;
  const cNat = Math.max(80, Math.round((tdeeNat - kcalProtNat - kcalFatNat)/4));
  const kcalProtAAS = pAAS * 4, kcalFatAAS = fAAS * 9;
  const cAAS = Math.max(100, Math.round((tdeeAAS - kcalProtAAS - kcalFatAAS)/4));
  return {
    nat: { kcal: Math.round(tdeeNat), p: pNat, f: fNat, c: cNat, protPerKg: protNat },
    aas: { kcal: Math.round(tdeeAAS), p: pAAS, f: fAAS, c: cAAS, protPerKg: protAAS },
    delta: { kcal: Math.round(tdeeAAS - tdeeNat), p: pAAS - pNat, c: cAAS - cNat },
    carbTiming: '50% вокруг тренировки, 30% утро, 20% вечер',
    note: input.onAAS ? 'ААС: белок 2.8, +10% ккал, жиры 1.0г/кг' : 'Натурал: белок 1.8-2.2, жиры 0.8'
  };
}

// ——— Жир ———
export function calcBodyFat(input: MetabolicInput) {
  // US Navy
  const log10 = (x:number)=> Math.log(x)/Math.log(10);
  let navy: number | null = null;
  if (input.waist && input.neck && input.height) {
    if (input.sex === 'male' && input.waist > input.neck) {
      navy = 86.01*log10(input.waist - input.neck) - 70.041*log10(input.height) + 36.76;
    } else if (input.sex === 'female' && input.hip && input.waist && input.neck) {
      navy = 163.205*log10(input.waist + (input.hip||0) - input.neck) - 97.684*log10(input.height) - 78.387;
    }
  }
  // ББ/ПЛ коррекция талии от осевой нагрузки
  const squatVol = (input.trainingDays ?? 3) * 8; // условные сеты приседа/тяги в неделю
  const waistCorr = input.bodyFat != null ? 0 : 0; // placeholder
  const axialAdd = squatVol > 20 ? 1.5 : squatVol > 12 ? 0.7 : 0;
  const waistAdj = (input.waist ?? 0) + axialAdd;
  let navyAdj: number | null = null;
  if (navy != null && axialAdd>0 && input.waist && input.neck) {
    if (input.sex === 'male') navyAdj = 86.01*log10(waistAdj - input.neck) - 70.041*log10(input.height) + 36.76;
    else if (input.hip) navyAdj = 163.205*log10(waistAdj + input.hip - input.neck) - 97.684*log10(input.height) - 78.387;
  }
  const curr = input.bodyFat ?? navy ?? 15;
  const ffm = input.weight * (1 - curr/100);
  const ffmi = ffm / Math.pow((input.height||180)/100,2);
  const ffmiAdj = ffmi + (input.onAAS ? 1.2 : 0);
  return {
    navy: navy != null ? Math.round(navy*10)/10 : null,
    navyAdj: navyAdj != null ? Math.round(navyAdj*10)/10 : null,
    waistAdj: axialAdd>0 ? Math.round(waistAdj*10)/10 : null,
    axialAdd,
    current: Math.round(curr*10)/10,
    ffm: Math.round(ffm*10)/10,
    ffmi: Math.round(ffmi*10)/10,
    ffmiAdj: Math.round(ffmiAdj*10)/10,
    note: axialAdd>0 ? `Осевая коррекция +${axialAdd}см к талии (присед/тяга ${squatVol} сет/нед)` : 'Без осевой коррекции',
    aasNote: input.onAAS ? 'ААС: FFMI +1.2 (реально выше из-за задержки воды/гликогена)' : 'Натурал: FFMI без поправки'
  };
}

// ——— Кортизол ———
export function calcCortisol(input: MetabolicInput) {
  const stress = input.stress ?? 5; // 1-10
  const sleep = input.sleepHours ?? 7;
  const sleepQ = input.sleepQuality ?? 3; // 1-5
  const acwr = input.acwr ?? 1;
  const base = 8 + stress*0.8 + (7 - sleep)*0.9 + (5 - sleepQ)*0.6 + Math.max(0, acwr-1)*4;
  const nat = Math.min(25, Math.max(3, base));
  const aas = Math.max(3, nat * (input.onAAS ? 0.85 : 1));
  const zone = (v:number)=> v<7 ? 'low' : v<=15 ? 'norm' : 'high';
  const diurnal = input.onAAS
    ? 'Утро 300-350 нм/л → вечер 60-80 (сглажена, HPA приглушена)'
    : 'Утро 350-450 → вечер 40-60 (физиологично)';
  return {
    nat: Math.round(nat*10)/10, aas: Math.round(aas*10)/10, delta: Math.round((aas-nat)*10)/10,
    zoneNat: zone(nat), zoneAAS: zone(aas),
    diurnal,
    whatIf: (dSleep:number, dStress:number, dVol:number)=> {
      const v = nat + dStress*0.8 + dSleep*(-0.9) + dVol*0.3;
      return Math.round(Math.max(3, Math.min(25, v))*10)/10;
    },
    note: input.onAAS ? 'ААС: кортизол −15% (супрессия HPA), но риск отката при отмене' : 'Натурал: кортизол по стрессу/сну/ACWR'
  };
}
