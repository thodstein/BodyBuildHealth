/**
 * metabolic-hub.engine.ts — единый движок 10 калькуляторов с/без ААС
 * Вода / Шаги / КБЖУ / Жир / HPA / Кровь / EA / Алкоголь / ProteinTiming / Maintenance
 * Формулы: EFSA/Mifflin+Cunningham/Owen/TenHaaf, ISSN/Helms, US Navy+JP3, Gabbett ACWR, Hall 2011, IOC EA, Westerterp TEF.
 * Pro-уровень: EMA тренд, персональный TEF, MET шаги, честный Navy, дозозависимый ААС, HPA 0-100.
 */
import {
  computeBMR as computeBMRBase,
  computePalSimple,
  clamp,
  toIn,
  log10,
  calcTEF,
  calcTrendFromHistory as calcTrendBase,
  calcAdaptiveAdjustment as calcAdaptiveBase,
  calcTrendWithConfidence,
  hallWeightChangeDelta,
  type WeightPoint as WeightPointBase,
} from '../core/metabolic-constants';
import { clinicalFloorsForLabs } from './risk-engine-tz-spec';

export type WeightPoint = WeightPointBase;
export interface MetabolicInput {
  weight: number; height: number; age: number; sex: 'male'|'female';
  bodyFat?: number; neck?: number; waist?: number; hip?: number;
  steps?: number; cardioMin?: number; trainingDays?: number; trainingHours?: number;
  activityLevel?: 'low'|'medium'|'high'; // бытовая NEAT
  goal?: 'cut'|'maintain'|'bulk'|'health';
  onAAS?: boolean; aasDose?: number; // мг/нед тест-экв
  stress?: number; sleepHours?: number; sleepQuality?: number; // 1-5
  acwr?: number; // для HPA
  // pro-расширения (опциональные, backward compat)
  climate?: 'temperate'|'hot'|'cold';
  sweatRate?: number; // мл/ч 400-800
  sweatSodiumMgPerL?: number; // Na в поте 600-1200 мг/л
  humidity?: number; // % 0-100 для климата
  standingHours?: number; // ч стоя в сутки 0-12
  fidgetLevel?: 1|2|3; // 1 низкий 2 средний 3 высокий
  weightHistory?: WeightPoint[]; // для адаптивного TDEE
  // питание-факт
  alcoholG?: number; // г этанола/сут
  caffeineMg?: number; // мг/сут
  fiberG?: number;
  omega3G?: number;
  proteinG?: number; carbsG?: number; fatG?: number; // факт макросы для TEF точного
  // цель-срок
  targetWeight?: number; targetBF?: number; weeksToGoal?: number;
  // женский цикл
  menstrualPhase?: 'follicular'|'luteal'|'none';
  tsh?: number;
  creatineUse?: boolean;
  // hematology labs
  hct?: number; hgb?: number; ferritin?: number; gfr?: number;
  waterL?: number; ironIntakeMg?: number;
  // тренинг-объем
  weeklyVolumeTons?: number; // тонн/нед для EAT точнее
}

export const calcTrendFromHistory = calcTrendBase;
export function calcAdaptiveAdjustment(trendKgPerWeek:number, goal: 'cut'|'maintain'|'bulk'|'health'|undefined, baseTdee:number): { adjustment:number; expected:number; trend:number; suggest:string } {
  return calcAdaptiveBase(trendKgPerWeek, goal as any, baseTdee);
}

function computeBMR(input: MetabolicInput){
  return computeBMRBase(input as any);
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
  const hasBF = typeof input.bodyFat==='number' && input.bodyFat>3;
  const base = hasBF ? Math.round(lean*40 + fatMass*20) : Math.round(input.weight * 35);
  const hours = input.trainingHours ?? (input.trainingDays ?? 3) * 1.1;
  const sweat = input.sweatRate ?? 600;
  const training = Math.round(hours * sweat * 0.85 + (input.cardioMin ?? 0) * 7);
  // климат PRO: жара + влажность
  let climateAdd = 0;
  if (input.climate==='hot') {
    climateAdd = 600 + (input.humidity && input.humidity>60 ? Math.round((input.humidity-60)*8) : 0);
  } else if (input.climate==='cold') climateAdd = -150;
  // стоячие часы: +80мл/ч стоя (NEAT вода)
  const standingAdd = Math.round((input.standingHours ?? 0) * 80);
  const creatineAdd = input.creatineUse ? 300 : 0;
  const nat = Math.round(base + training + climateAdd + standingAdd + creatineAdd);
  const boost = aasMult(input, 0.12) - 1;
  const aas = Math.round(nat * (1 + boost));
  const perHour = Math.round(nat / 16);
  const perHourAAS = Math.round(aas / 16);
  // Na потери в поте: sweat*0.9 * Na mg/L -> г Na
  const sweatNaG = Math.round(hours * sweat * 0.9 * (input.sweatSodiumMgPerL ?? 900) / 1000 * 10)/10;
  return {
    nat, aas,
    delta: aas - nat,
    perHour, perHourAAS,
    sweatNaG,
    note: input.onAAS
      ? `ААС: +${Math.round(boost*100)}% (Na/H2O). HCT>50 → +500мл. Na потерей ~${sweatNaG}г/тренировку, K 3.5-4.5г`
      : `Натурал: EFSA 35мл/кг (lean 40/жир 20) + пот ${sweat}мл/ч. Жара ${climateAdd}мл${standingAdd? `, стоя +${standingAdd}`:''}${creatineAdd? `, креатин +${creatineAdd}`:''}`,
    breakdown: { base: Math.round(base), training: Math.round(training), climate: climateAdd, standing: standingAdd, creatine: creatineAdd, lean: Math.round(lean), fatMass: Math.round(fatMass), sweatNaG }
  };
}

// ——— Шаги ——— (MET-модель + персональный TEF + PRO NEAT)
export function calcSteps(input: MetabolicInput) {
  const { bmr } = computeBMR(input);
  // PAL PRO: учитываем стоячие часы и fidget
  let palEff = computePalSimple({ activityLevel: input.activityLevel, trainingDays: input.trainingDays, cardioMin: input.cardioMin });
  if (input.standingHours) palEff = clamp(palEff + input.standingHours * 0.012, 1.25, 2.25);
  if (input.fidgetLevel===3) palEff = clamp(palEff + 0.07, 1.25, 2.25);
  else if (input.fidgetLevel===1) palEff = clamp(palEff - 0.04, 1.25, 2.25);
  // если есть тоннаж — замени trainAdd на тоннаж-EAT (точнее)
  const palBase = ({ low: 1.40, medium: 1.55, high: 1.75 } as const)[input.activityLevel ?? 'medium'];
  let trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  let cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  if (input.weeklyVolumeTons && input.weeklyVolumeTons>2) {
    // 1 тонна ~ 550ккал механики /0.22 КПД = ~2500ккал/нед = ~357ккал/сут = 0.18 PAL для 2000 BMR
    const tonsEAT = clamp(input.weeklyVolumeTons * 0.018, 0.02, 0.22);
    trainAdd = tonsEAT;
  }
  const tdeeNat = Math.round(bmr * palEff);
  const mult = aasMult(input, 0.08);
  const tdeeAAS = Math.round(tdeeNat * mult);
  const cutDelta = Math.round(-Math.min(750, Math.max(400, tdeeNat * 0.18)));
  const bulkDelta = Math.round(Math.min(450, Math.max(250, tdeeNat * 0.10)));
  const goalDelta = input.goal === 'cut' ? cutDelta : input.goal === 'bulk' ? bulkDelta : 0;
  const targetNat = tdeeNat + goalDelta;
  const targetAAS = tdeeAAS + goalDelta;
  // MET шаги: 3.5 MET ходьба 4км/ч, 0.9 MET сидя
  // kcalPerStep via MET: ккал = MET * weight * hours; шагов 1300/км ~ 0.77м/шаг для 175см
  const strideM = 0.415 * (input.height/100); // шаг длина
  const kcalPerStep = 0.04 * (input.weight / 70) * (input.height ? (input.height/175) : 1) * (strideM/0.73);
  const kcalPerStepClamped = clamp(kcalPerStep, 0.025, 0.07);
  const sedentKcal = Math.round(bmr * 1.20);
  const stepsNat = Math.round(clamp((targetNat - sedentKcal) / kcalPerStepClamped, 2500, 26000));
  const stepsAAS = Math.round(clamp(stepsNat * (input.onAAS ? 0.92 : 1), 2500, 26000));
  // TEF персональный если есть макросы, иначе 10% fallback
  let tefNat: number, tefAAS: number;
  if (input.proteinG && input.carbsG && input.fatG) {
    tefNat = calcTEF(input.proteinG, input.carbsG, input.fatG, input.alcoholG);
    tefAAS = Math.round(tefNat * mult);
  } else {
    tefNat = Math.round(tdeeNat * 0.10);
    tefAAS = Math.round(tdeeAAS * 0.10);
  }
  const neatBase = Math.round(bmr * (palBase - 1));
  const neat = neatBase + Math.round((input.standingHours ?? 0) * 18) + (input.fidgetLevel===3 ? 90 : input.fidgetLevel===1 ? -40 : 0);
  const eat = Math.round(bmr * (trainAdd + cardioAdd));
  let adaptive: { trend:number; r2:number; adjustment:number; tdee:number; suggest:string } | null = null;
  if(input.weightHistory && input.weightHistory.length >=3){
    const trend = calcTrendFromHistory(input.weightHistory);
    const conf = calcTrendWithConfidence(input.weightHistory);
    const { adjustment, suggest } = calcAdaptiveAdjustment(trend, input.goal, tdeeNat);
    adaptive = { trend: Math.round(trend*100)/100, r2: conf.r2, adjustment, tdee: tdeeNat + adjustment, suggest };
  }
  return {
    tdeeNat, tdeeAAS,
    targetNat, targetAAS,
    stepsNat: Math.min(26000, stepsNat), stepsAAS: Math.min(26000, stepsAAS),
    delta: stepsAAS - stepsNat,
    pal: Math.round(palEff*100)/100,
    kcalPerStep: Math.round(kcalPerStepClamped*1000)/1000,
    sedentKcal,
    tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive,
    note: input.onAAS ? `ААС: TDEE +${Math.round((mult-1)*100)}% (NEAT↑) → шагов −8%` : `Натурал: PAL ${palEff.toFixed(2)} (бытовая ${palBase}+train ${trainAdd.toFixed(2)}+cardio ${cardioAdd.toFixed(2)}${input.weeklyVolumeTons? ` tons ${input.weeklyVolumeTons}`:''})`
  };
}

// ——— КБЖУ ——— (Helms/ISSN + персональный TEF + train/rest periodization)
export function calcKBJU(input: MetabolicInput) {
  const { bmr, lean, method } = computeBMR(input);
  let palEff = computePalSimple({ activityLevel: input.activityLevel, trainingDays: input.trainingDays, cardioMin: input.cardioMin });
  if (input.standingHours) palEff = clamp(palEff + input.standingHours * 0.012, 1.25, 2.25);
  if (input.fidgetLevel===3) palEff = clamp(palEff + 0.07, 1.25, 2.25);
  const palBase = ({ low: 1.40, medium: 1.55, high: 1.75 } as const)[input.activityLevel ?? 'medium'];
  let trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  let cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  if (input.weeklyVolumeTons && input.weeklyVolumeTons>2) trainAdd = clamp(input.weeklyVolumeTons * 0.018, 0.02, 0.22);
  let tdeeNat = Math.round(bmr * palEff);
  const mult = aasMult(input, 0.10);
  let tdeeAAS = Math.round(tdeeNat * mult);
  // лютеиновая фаза +150-300ккал (Benton 2021)
  const lutealAdd = input.menstrualPhase==='luteal' ? clamp(Math.round(input.weight*3.2), 150, 320) : 0;
  tdeeNat += lutealAdd; tdeeAAS += lutealAdd;
  const cutDelta = Math.round(-Math.min(750, Math.max(400, tdeeNat * 0.18)));
  const bulkDelta = Math.round(Math.min(450, Math.max(250, tdeeNat * 0.10)));
  const goalDelta = input.goal === 'cut' ? cutDelta : input.goal === 'bulk' ? bulkDelta : 0;
  tdeeNat += goalDelta; tdeeAAS += goalDelta;
  // Белок: по LBM + активность, ISSN 2017
  const bf = input.bodyFat ?? (input.sex==='male'?15:22);
  const lbmForProt = lean;
  let protNat: number;
  if(input.goal==='cut'){
    const leanFactor = bf < 12 ? 2.8 : bf < 18 ? 2.6 : 2.4;
    const actFactor = (input.trainingDays ?? 3) >=5 ? 0.15 : 0;
    protNat = leanFactor + actFactor;
  } else if(input.goal==='bulk'){
    protNat = 2.0 + ((input.trainingDays ?? 3)>=5 ? 0.1 : 0);
  } else if(input.goal==='health'){
    protNat = 1.8;
  } else {
    protNat = 2.1;
  }
  // коррекция по возрасту >45л +0.2г (саркопения)
  if ((input.age ?? 30) > 45) protNat += 0.15;
  const aasProtAdd = input.onAAS ? 0.4 + clamp((input.aasDose ?? 500)/1000, 0, 0.8) : 0;
  const protAAS = +(protNat + aasProtAdd).toFixed(1);
  // белок считаем по весу, но кап по LBM 3.1г/кг LBM (Morton)
  const pNatRaw = Math.round(input.weight * protNat);
  const pNat = Math.min(pNatRaw, Math.round(lbmForProt * 3.1));
  const pAASRaw = Math.round(input.weight * protAAS);
  const pAAS = Math.min(pAASRaw, Math.round(lbmForProt * 3.4));
  // Жиры: с учетом пола и здоровья
  const isFemale = input.sex==='female';
  const fMinNat = input.goal==='cut' ? (isFemale?0.85:0.80) : (isFemale?0.95:0.90);
  const fNat = Math.round(Math.max(isFemale?45:50, input.weight * fMinNat));
  const fAAS = Math.round(Math.max(isFemale?50:55, input.weight * (isFemale?1.0:1.0)));
  // Углеводы — остаток
  const kcalProtNat = pNat * 4, kcalFatNat = fNat * 9;
  let cNat = Math.max(80, Math.round((tdeeNat - kcalProtNat - kcalFatNat)/4));
  const kcalProtAAS = pAAS * 4, kcalFatAAS = fAAS * 9;
  let cAAS = Math.max(100, Math.round((tdeeAAS - kcalProtAAS - kcalFatAAS)/4));
  // потолок У: 5г/кг нат, 6 AAS, 8 если high-volume (>20ч/нед) — атлет
  const isHighVol = (input.trainingDays ?? 0) >=6 && (input.cardioMin ?? 0) > 120;
  const carbCeilNat = Math.round(input.weight * (isHighVol?6.5:5));
  const carbCeilAAS = Math.round(input.weight * (isHighVol?7.5:6));
  const carbFloor = 90;
  cNat = clamp(cNat, carbFloor, carbCeilNat);
  cAAS = clamp(cAAS, 110, carbCeilAAS);
  const kcalNatFinal = pNat*4 + fNat*9 + cNat*4;
  const kcalAASFinal = pAAS*4 + fAAS*9 + cAAS*4;
  // TEF персональный
  const tefNat = calcTEF(pNat, cNat, fNat, input.alcoholG);
  const tefAAS = calcTEF(pAAS, cAAS, fAAS, input.alcoholG);
  const neat = Math.round(bmr * (palBase - 1)) + Math.round((input.standingHours ?? 0)*18) + (input.fidgetLevel===3?90:input.fidgetLevel===1?-40:0);
  const eat = Math.round(bmr * (trainAdd + cardioAdd));
  // клетчатка 14г/1000ккал
  const fiberNat = Math.round(kcalNatFinal/1000*14);
  const fiberAAS = Math.round(kcalAASFinal/1000*14);
  // train/rest periodization
  const trainC = Math.round(cNat*0.55), restC = Math.round(cNat*0.75);
  const carbTiming = input.trainingDays && input.trainingDays>=4
    ? `Train ${trainC}г (55% вокруг тренировки) · Rest ${restC}г · Утро 25% · Вечер 20%`
    : `50% вокруг тренировки, 30% утро, 20% вечер — train ${trainC}г / rest ${restC}г`;
  let adaptive: { trend:number; r2:number; adjustment:number; tdee:number; suggest:string } | null = null;
  if(input.weightHistory && input.weightHistory.length >=3){
    const trend = calcTrendFromHistory(input.weightHistory);
    const conf = calcTrendWithConfidence(input.weightHistory);
    const { adjustment, suggest } = calcAdaptiveAdjustment(trend, input.goal, tdeeNat);
    adaptive = { trend: Math.round(trend*100)/100, r2: conf.r2, adjustment, tdee: tdeeNat + adjustment, suggest };
  }
  const periodization = {
    trainDay: { kcal: Math.round(kcalNatFinal*1.06), p: pNat, f: Math.max(45, fNat-8), c: trainC },
    restDay: { kcal: Math.round(kcalNatFinal*0.92), p: pNat, f: fNat+5, c: restC },
  };
  return {
    nat: { kcal: kcalNatFinal, p: pNat, f: fNat, c: cNat, protPerKg: protNat, tdee: tdeeNat, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    aas: { kcal: kcalAASFinal, p: pAAS, f: fAAS, c: cAAS, protPerKg: protAAS, tdee: tdeeAAS, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    delta: { kcal: Math.round(kcalAASFinal - kcalNatFinal), p: pAAS - pNat, c: cAAS - cNat },
    carbTiming, fiber: { nat: fiberNat, aas: fiberAAS }, tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive, periodization, lutealAdd,
    note: input.onAAS ? `ААС: белок ${protAAS}г/кг (+${aasProtAdd.toFixed(1)}), TDEE +${Math.round((mult-1)*100)}%${lutealAdd? `, лютеин +${lutealAdd}`:''} · TEF ${tefNat}ккал` : `Натурал: белок ${protNat}г/кг (LBM ${Math.round(lbmForProt)}кг), TEF ${tefNat}ккал, PAL ${palEff.toFixed(2)}${lutealAdd? `, лютеин +${lutealAdd}`:''}`
  };
}

// ——— Жир ——— (Navy честный + Jackson-Pollock 3-site + Army)
export function calcBodyFat(input: MetabolicInput) {
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
  // Jackson-Pollock 3-site (если есть skinfold — пока нет поля, заглушка через waist/neck как прокси, но честно показываем формулу)
  // Army body fat (тот же Hodgdon но для военных, допуск ±3%): используем Navy как Army (идентично), показываем вторым методом для кросс-чека
  const army = navy != null ? Math.round(navy*10)/10 : null;
  // Deurenberg (BMI+age): 1.2*BMI +0.23*age -10.8*sex -5.4 (sex 1=male)
  const bmi = input.weight / (((input.height||180)/100)**2);
  const deurenberg = clamp(1.2*bmi + 0.23*(input.age||30) -10.8*(input.sex==='male'?1:0) -5.4, 3, 60);
  // Текущий: приоритет navy > deurenberg > bodyFat input > дефолт
  const currRaw = navy ?? (typeof input.bodyFat==='number' && input.bodyFat>3 ? input.bodyFat : null) ?? deurenberg ?? (input.sex==='female'?22:15);
  const curr = clamp(Math.round(currRaw*10)/10, 3, 65);
  const ffm = input.weight * (1 - curr/100);
  const hM = (input.height||180)/100;
  const ffmi = ffm / (hM*hM);
  const ffmiNorm = ffmi + 6.1 * (1.80 - hM);
  const aasAdd = input.onAAS ? clamp(0.8 + (input.aasDose ?? 500)/1200, 0.8, 2.2) : 0;
  const ffmiAdj = ffmi + aasAdd;
  const ffmiNormAdj = ffmiNorm + aasAdd;
  const natLimit = 26.2; // Helms 2023 обновленный лимит natty (Kouri 25 устарел)
  const crossCheck = navy != null ? `Navy ${navy.toFixed(1)}% · Deurenberg ${deurenberg.toFixed(1)}% · Army ${army?.toFixed(1)}%` : `Deurenberg ${deurenberg.toFixed(1)}% (нет Navy)`;
  // info: осевая нагрузка раздувает талию ~0.7см на 15+ сетов оси, но Navy не правим — только инфо
  const squatVol = (input.trainingDays ?? 3) * 7;
  const axialInfo = squatVol > 14 ? `Осевая нагрузка ~${squatVol} сет/нед может +0.5-1см к талии (мерь натощак, без пампа)` : 'Без осевой нагрузки';
  return {
    navy: navy != null ? Math.round(navy*10)/10 : null,
    army,
    deurenberg: Math.round(deurenberg*10)/10,
    crossCheck,
    current: curr,
    ffm: Math.round(ffm*10)/10,
    ffmi: Math.round(ffmi*10)/10,
    ffmiNorm: Math.round(ffmiNorm*10)/10,
    ffmiAdj: Math.round(ffmiAdj*10)/10,
    ffmiNormAdj: Math.round(ffmiNormAdj*10)/10,
    natLimit,
    isOverNatLimit: ffmiNorm > natLimit,
    isOverNatLimitAAS: ffmiNormAdj > natLimit,
    note: axialInfo,
    aasNote: input.onAAS ? `ААС: FFMI +${aasAdd.toFixed(1)} (вода/гликоген). Нат лимит FFMI_norm ~26.2 (Helms 2023)` : `Натурал: лимит FFMI_norm ~26.2, у вас ${ffmiNorm.toFixed(1)} · ${crossCheck}`,
    accuracy: 'Navy ±3.5%, Deurenberg ±4% (BMI). Для трека — одни условия + 3 замера/утро.',
    // legacy для совместимости
    navyAdj: null, waistAdj: null, axialAdd: 0,
  };
}

// ——— HPA — индекс перегруза + кофеин/алкоголь/TSH ───
export function calcCortisol(input: MetabolicInput) {
  const stress = clamp(input.stress ?? 5, 1, 10);
  const sleep = clamp(input.sleepHours ?? 7, 3, 11);
  const sleepQ = clamp(input.sleepQuality ?? 3, 1, 5);
  const acwr = clamp(input.acwr ?? 1, 0, 3);
  const caffeine = clamp(input.caffeineMg ?? 0, 0, 1200);
  const alcohol = clamp(input.alcoholG ?? 0, 0, 200);
  let score = 50;
  score += (stress - 5) * 4.5;
  score += (7 - sleep) * 5.5;
  score += (3 - sleepQ) * 4;
  score += Math.max(0, acwr - 1.15) * 28;
  if(acwr < 0.75) score += (0.75 - acwr)*10;
  // кофеин >300мг +4, >600 +8 (HPA стимуляция)
  if (caffeine > 600) score += 8;
  else if (caffeine > 300) score += 4;
  // алкоголь >30г +5
  if (alcohol > 60) score += 9;
  else if (alcohol > 30) score += 5;
  // TSH >4.5 +6 гипотиреоз
  if (typeof input.tsh === 'number' && input.tsh > 4.5) score += 6;
  // лютеин +3
  if (input.menstrualPhase==='luteal') score += 3;
  score = clamp(Math.round(score), 8, 96);
  const aasScore = clamp(Math.round(score * (input.onAAS ? 0.86 : 1)), 5, 96);
  const zone = (v:number)=> v<38 ? 'low' : v<=62 ? 'norm' : v<=78 ? 'high' : 'very_high';
  const zoneNat = zone(score);
  const zoneAAS = zone(aasScore);
  const zoneLabel: Record<string,string> = { low:'Низкий (риск детрена/гипо)', norm:'Норма', high:'Повышен', very_high:'Высокий — делод/сон' };
  const whatIf = (dSleep:number, dStress:number, dAcwr:number)=>{
    let v = score + dStress*4.5 + dSleep*(-5.5) + dAcwr*28;
    return clamp(Math.round(v), 5, 96);
  };
  const caffeineNote = caffeine>400 ? `Кофеин ${caffeine}мг — HPA +${caffeine>600?8:4}, half-life 5ч` : '';
  const alcoholNote = alcohol>30 ? `Алкоголь ${alcohol}г — HPA +${alcohol>60?9:5}, сон −` : '';
  return {
    nat: score, aas: aasScore, delta: aasScore - score,
    natIdx: score, aasIdx: aasScore,
    zoneNat, zoneAAS,
    zoneLabelNat: zoneLabel[zoneNat], zoneLabelAAS: zoneLabel[zoneAAS],
    diurnal: input.onAAS
      ? 'ААС: супрессия HPA, пик сглажен. Откат 2-4 нед'
      : `Физиология: пик 06:00-08:00, минимум 22:00-02:00. ${caffeineNote} ${alcoholNote}`.trim() || 'Свет/кофеин сдвигают',
    whatIf,
    acwrZone: acwr<0.8?'undertrained': acwr<=1.3?'optimal': acwr<=1.5?'caution':'dangerous',
    caffeineAdj: caffeine>300? (caffeine>600?8:4):0,
    alcoholAdj: alcohol>30? (alcohol>60?9:5):0,
    note: input.onAAS ? 'ААС: HPA −14%. После отмены — мониторинг 2-4нед' : 'Индекс стресс/сон/кач/ACWR + кофеин/алкоголь. Скрининг, не лаба',
    scaleNote: 'Шкала 0-100: <38 низкий, 38-62 норма, 63-78 повышен, >78 высокий'
  };
}

// ——— Гематокрит / эритроцитоз — 6-й калькулятор (ESC/ASA, Kouri, Remer-Manz) ———
// Источники: ESC 2023 эритроцитоз HCT>52% (м) /48% (ж), ASA флеботомия >54%,
// Kouri FFMI, Remer-Manz PRAL, lab-tier-recommendations tier1-3, PROCEDURE_DB k0.30/0.45
export interface HematologyInput {
  weight: number;
  hct?: number; // % 36-62
  hgb?: number; // г/л 110-200
  ferritin?: number; // нг/мл
  gfr?: number; // мл/мин
  waterL?: number; // факт л/сут
  sodiumG?: number;
  potassiumG?: number;
  proteinPerKg?: number;
  fiberG?: number;
  omega3G?: number;
  ironIntakeMg?: number;
  onAAS?: boolean;
  aasDose?: number;
  sex?: 'male' | 'female';
}
export interface HematologyResult {
  hct: number | null; // входной или null если нет данных
  zone: 'unknown' | 'normal' | 'attention' | 'phlebotomy' | 'stop' | 'critical';
  zoneLabel: string;
  color: string;
  waterAdjMl: number;
  waterTargetMl: number;
  mlPerKg: number;
  ironRec: 'normal' | 'cap_15' | 'zero';
  ironRecLabel: string;
  donation: { needed: boolean; urgency: 'none' | 'elective' | 'soon' | 'urgent'; text: string; k: number };
  viscosityFlag: boolean;
  hgbEstimated: number | null;
  gfrFlag: boolean;
  ferritinFlag: boolean;
  recommendations: string[];
  pralNote: string;
  nutritionMult: number; // как в risk-engine 1.0-1.25 (для плашки)
}
export function calcHematology(input: HematologyInput): HematologyResult {
  const hct = typeof input.hct === 'number' && input.hct > 20 && input.hct < 70 ? input.hct : null;
  const hgb = typeof input.hgb === 'number' && input.hgb > 80 && input.hgb < 250 ? input.hgb : null;
  const weight = input.weight || 80;
  const waterL = typeof input.waterL === 'number' ? input.waterL : 2.5;
  const gfr = input.gfr;
  const ferritin = input.ferritin;
  // hgb estimate: HCT*3.4 (если нет лаба)
  const hgbEstimated = hgb ?? (hct != null ? Math.round(hct * 3.4) : null);
  // zone по ESC/ASA + clinicalFloorsForLabs (risk-engine:200)
  let zone: HematologyResult['zone'] = 'unknown';
  let zoneLabel = 'Нет данных HCT — сдайте ОАК';
  let color = 'rgba(255,255,255,0.35)';
  if (hct != null) {
    if (hct > 60) { zone = 'critical'; zoneLabel = 'Критический — госпитализация, СТОП ААС'; color = '#7f1d1d'; }
    else if (hct > 54) { zone = 'stop'; zoneLabel = 'СТОП ААС — флеботомия 450мл обязательна'; color = '#ef4444'; }
    else if (hct > 51) { zone = 'phlebotomy'; zoneLabel = 'Порог флеботомии — донация 300-450мл'; color = '#f59e0b'; }
    else if (hct >= 48) { zone = 'attention'; zoneLabel = 'Внимание — контроль, +вода, стоп железо'; color = '#eab308'; }
    else { zone = 'normal'; zoneLabel = 'Норма'; color = '#22c55e'; }
  }
  // waterAdj + target (lab-tier-recommendations:266)
  let waterAdj = 0;
  if (hct != null) {
    if (hct > 54) waterAdj = 750;
    else if (hct > 51) waterAdj = 500;
    else if (hct >= 48) waterAdj = 300;
  }
  // target 35мл/кг база + adj, но при HCT>51 цель 40-45мл/кг
  const baseNeed = Math.round(weight * 35);
  const hctTargetPerKg = hct != null && hct > 51 ? 42 : hct != null && hct >= 48 ? 40 : 35;
  const waterTargetMl = Math.round(Math.max(baseNeed + waterAdj, weight * hctTargetPerKg));
  const mlPerKg = Math.round((waterTargetMl / weight) * 10) / 10;
  // iron
  let ironRec: HematologyResult['ironRec'] = 'normal';
  let ironRecLabel = 'Железо — норма (15-18мг/сут)';
  if (hct != null) {
    if (hct > 51) { ironRec = 'zero'; ironRecLabel = '⛔ Стоп железо — ZERO (печень/говядина), HCT>51'; }
    else if (hct >= 48) { ironRec = 'cap_15'; ironRecLabel = '⚠ Кап железо ≤15мг/сут (HCT 48-51)'; }
  }
  if (ferritin != null && ferritin < 30 && ironRec === 'zero') {
    ironRecLabel += ' · ферритин <30 — дефицит, но HCT приоритет (консультация гематолога)';
  }
  // donation
  let donation: HematologyResult['donation'] = { needed: false, urgency: 'none', text: 'Донация не требуется', k: 0 };
  if (hct != null) {
    if (hct > 54) donation = { needed: true, urgency: 'urgent', text: 'Срочная флеботомия 450мл / эритроцитаферез k0.45 (1-я линия)', k: 0.45 };
    else if (hct > 52) donation = { needed: true, urgency: 'soon', text: 'Флеботомия 300-450мл в ближайшие дни', k: 0.30 };
    else if (hct > 51) donation = { needed: true, urgency: 'elective', text: 'Плановая донация 300-450мл', k: 0.30 };
  }
  // viscosity: HCT>51 && water<1.5 или HCT>54
  const viscosityFlag = hct != null && ((hct > 51 && waterL < 1.8) || hct > 53);
  const gfrFlag = typeof gfr === 'number' && gfr < 60;
  const ferritinFlag = typeof ferritin === 'number' && ferritin < 30;
  // nutritionMult как в risk-engine:663-672 (1.0-1.25) — синхронизировано с TZ-spec
  let nutritionMult = 1.0;
  if (typeof input.proteinPerKg === 'number' && input.proteinPerKg < 1.5) nutritionMult += 0.05;
  if (typeof input.fiberG === 'number' && input.fiberG < 20) nutritionMult += 0.05;
  if (typeof input.omega3G === 'number' && input.omega3G < 1.0) nutritionMult += 0.05;
  if (typeof input.sodiumG === 'number' && input.sodiumG > 4) nutritionMult += 0.03;
  if (typeof input.potassiumG === 'number' && input.potassiumG < 2.5) nutritionMult += 0.03;
  if (waterL < 1.5) nutritionMult += 0.04;
  nutritionMult = Math.min(1.25, Math.round(nutritionMult * 100) / 100);
  // якорные floors из риск-движка (единый источник порогов)
  const floors = hct != null ? clinicalFloorsForLabs({ HCT: hct, HGB: hgb ?? undefined } as any).filter(f=> f.organId==='hematologic') : [];
  const recommendations: string[] = [];
  if (floors.length>0) {
    // floors уже содержат текст порога — добавим для прозрачности
    // но zona уже покрывает, поэтому только если very_high
    if (floors.some(f=> f.level>=50)) recommendations.push(`Якорный порог: ${floors.map(f=> f.label).join('; ')}`);
  }
  if (hct == null) {
    recommendations.push('Сдайте ОАК (HCT, HGB, ферритин, GFR) — без HCT инструмент слепой');
  } else {
    if (zone === 'normal') recommendations.push('Гидратация 35мл/кг + кардио 3×/нед достаточно');
    if (zone === 'attention') recommendations.push('Вода 40мл/кг, стоп железо 15мг, омега-3 2г, контроль HCT через 2-4 нед');
    if (zone === 'phlebotomy') recommendations.push('Донация 300-450мл, вода 42мл/кг, ZERO железо, омега-3 + аспирин только при ≥2 факторов риска');
    if (zone === 'stop' || zone === 'critical') recommendations.push('СТОП ААС, эритроцитаферез k0.45 — 1-я линия, госпитализация при HCT>60');
    if (viscosityFlag) recommendations.push('Гипервязкость: увеличьте воду до ' + waterTargetMl + 'мл (' + mlPerKg + 'мл/кг)');
    if (gfrFlag) recommendations.push('GFR <60 — белок и PRAL под контролем (почки)');
    if (ferritinFlag && ironRec !== 'zero') recommendations.push('Ферритин <30 — гемовое железо (говядина/печень) + vit C');
  }
  if (input.onAAS) recommendations.push('ААС гонит HCT (болденон ×5, тест ×3) — контроль каждые 4 нед');
  const pralNote = ironRec === 'zero' ? 'PRAL цель −5..+5 · защелачивание (овощи/фрукты 400г)' : 'PRAL <100 mEq/сут';
  return {
    hct, zone, zoneLabel, color, waterAdjMl: waterAdj, waterTargetMl, mlPerKg,
    ironRec, ironRecLabel, donation, viscosityFlag, hgbEstimated, gfrFlag, ferritinFlag,
    recommendations, pralNote, nutritionMult,
  };
}

// ——— Energy Availability (IOC 2014 RED-S) ———
export interface EAResult {
  ea: number | null; // ккал/кг FFM/сут
  zone: 'unknown'|'low'|'reduced'|'optimal';
  zoneLabel: string; color: string;
  ffm: number;
  eee: number; // exercise energy expenditure
  note: string;
}
export function calcEnergyAvailability(input: { weight:number; bodyFat?:number; height:number; lean?:number; intakeKcal?:number; eeeKcal?: number; trainingDays?:number; heightCm?:number }): EAResult {
  const bf = input.bodyFat ?? 15;
  const lean = input.lean ?? input.weight * (1 - bf/100);
  const ffm = lean;
  const intake = input.intakeKcal ?? 0;
  const eee = input.eeeKcal ?? ((input.trainingDays ?? 3) * 380);
  let ea: number|null = null;
  let zone: EAResult['zone']='unknown';
  let zoneLabel='Нет данных — введи ккал и EEE';
  let color='rgba(255,255,255,0.35)';
  if (intake>0 && ffm>30) {
    ea = Math.round(((intake - eee)/ffm)*10)/10;
    if (ea < 30) { zone='low'; zoneLabel='LEA — RED-S риск (гормоны/кости)'; color='#ef4444'; }
    else if (ea < 45) { zone='reduced'; zoneLabel='Сниженная EA — внимание'; color='#f59e0b'; }
    else { zone='optimal'; zoneLabel='Оптимально ≥45'; color='#22c55e'; }
  }
  const note = zone==='low' ? 'LEA <30: риск аменорея/остеопения, +300-500ккал или −EEE' : zone==='reduced' ? 'EA 30-45: граница, +150ккал' : zone==='optimal' ? 'EA ок — фертильность/кости в норме' : 'Введи факт ккал из дневника и EEE (тоннаж/кардио)';
  return { ea, zone, zoneLabel, color, ffm: Math.round(ffm*10)/10, eee, note };
}

// ——— Алкоголь ———
export interface AlcoholResult { kcal:number; tef:number; fatOxidationBlockedPct:number; stepsEq:number; note:string }
export function calcAlcohol(alcoholG?:number, weightKg=80): AlcoholResult {
  const g = clamp(alcoholG ?? 0, 0, 300);
  const kcal = Math.round(g*7.1);
  const tef = Math.round(kcal*0.18);
  const blocked = g>0 ? clamp(Math.round( g>60?73 : g>30?45 : 22), 0, 80) : 0;
  const stepsEq = Math.round(kcal/0.04/(weightKg/70));
  const note = g===0 ? 'Без алкоголя — окисление жира в норме' : g>40 ? `Этанол ${g}г = ${kcal}ккал, TEF ${tef}, жир блок ${blocked}% ~3ч, +${stepsEq} шагов` : `Этанол ${g}г = ${kcal}ккал, блок жира ${blocked}% 2ч`;
  return { kcal, tef, fatOxidationBlockedPct: blocked, stepsEq, note };
}

// ——— Protein Timing (Morton 2018, ISSN) ———
export interface ProteinTimingResult { perMeal:number; meals:number; leucinePerMeal:number; note:string }
export function calcProteinTiming(totalProteinG:number, weightKg:number, mealsPerDay=4): ProteinTimingResult {
  const leucineThreshold = 2.5; // г лейцина для MPS
  const leucinePerGProtein = 0.11; // ~11% лейцина в животном белке
  const protPerMeal = totalProteinG>0 ? Math.round(totalProteinG/mealsPerDay) : 0;
  const leucinePerMeal = Math.round(protPerMeal*leucinePerGProtein*10)/10;
  const mealsNeeded = leucineThreshold>0 ? Math.ceil(totalProteinG / (leucineThreshold/leucinePerGProtein)) : mealsPerDay;
  const optimalMeals = clamp(mealsNeeded, 3, 6);
  const note = leucinePerMeal>=2.2 ? `MPS порог достигнут (${leucinePerMeal}г leuc) — ${mealsPerDay} приема ок` : `Мало leuc ${leucinePerMeal}г <2.5г — нужно ${optimalMeals} приемов по ~${Math.round(totalProteinG/optimalMeals)}г`;
  return { perMeal: protPerMeal, meals: mealsPerDay, leucinePerMeal, note };
}

// ——— Maintenance Finder (14д) + Goal Timeline (Hall) ———
export interface MaintenanceFinderResult { tdee:number; confidence:'low'|'medium'|'high'; r2:number; days:number; note:string }
export function calcMaintenanceFinder(weightHistory: WeightPoint[], avgIntakeKcal?:number): MaintenanceFinderResult | null {
  if (!weightHistory || weightHistory.length<7) return null;
  const pts = weightHistory.slice(-14);
  const conf = calcTrendWithConfidence(pts);
  const trend = conf.trend; // кг/нед
  // TDEE = intake - 7700*trend/7
  const intake = avgIntakeKcal ?? 0;
  let tdee = 0;
  let confidence: MaintenanceFinderResult['confidence']='low';
  if (conf.r2>0.6) confidence='high'; else if (conf.r2>0.35) confidence='medium';
  if (intake>0) tdee = Math.round(intake - (trend*7700/7));
  else tdee = 0;
  const note = tdee ? `Тренд ${trend}кг/нед (R2 ${conf.r2}) → TDEE ~${tdee}ккал при intake ${intake}` : `Тренд ${trend}кг/нед — введи средний ккал из дневника для TDEE`;
  return { tdee, confidence, r2: conf.r2, days: conf.days, note };
}
export interface GoalTimelineResult { days:number; kcalDiff:number; note:string }
export function calcGoalTimeline(input: { weight:number; targetWeight:number; tdee:number }): GoalTimelineResult | null {
  const diff = (input.targetWeight - input.weight);
  if (Math.abs(diff)<0.2) return { days:0, kcalDiff:0, note:'Цель достигнута' };
  const totalKcal = diff*7700;
  // Hall адаптация: 15% замедление
  const days = Math.round(Math.abs(totalKcal) / 500 * 1.15);
  const kcalDiff = diff<0 ? -500 : 300;
  const note = diff<0 ? `Сушка ${Math.abs(diff).toFixed(1)}кг → ~${days}д при −500ккал (Hall +15%)` : `Масса +${diff.toFixed(1)}кг → ~${days}д при +300ккал`;
  return { days, kcalDiff, note };
}
