/**
 * metabolic-hub.engine.ts — единый движок 5 калькуляторов с/без ААС
 * Вода / Шаги / КБЖУ / Жир / Кортизол — один снапшот, без дублей.
 * Формулы: EFSA/Mifflin-St Jeor + Katch-McArdle, ISSN/Helms, US Navy, Gabbett ACWR.
 * Pro-уровень: инвалидация дубль-PAL, cm→in, дозозависимый ААС, HPA-индекс.
 */
import {
  computeBMR as computeBMRBase,
  computePalSimple,
  clamp,
  toIn,
  log10,
  calcTrendFromHistory as calcTrendBase,
  calcAdaptiveAdjustment as calcAdaptiveBase,
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
  onAAS?: boolean; aasDose?: number; // мг/нед тест-экв (опционально, для дозозависимости)
  stress?: number; sleepHours?: number; sleepQuality?: number; // 1-5
  acwr?: number; // для кортизола
  // pro-расширения (опциональные, backward compat)
  climate?: 'temperate'|'hot'|'cold';
  sweatRate?: number; // мл/ч 400-800, если известен
  weightHistory?: WeightPoint[]; // для адаптивного TDEE по тренду
  // hematology labs (Fаза 1)
  hct?: number; // гематокрит %
  hgb?: number; // гемоглобин г/л
  ferritin?: number; // нг/мл
  gfr?: number; // мл/мин
  waterL?: number; // факт воды л/сут (для вязкости)
  ironIntakeMg?: number; // мг/сут
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
  const palEff = computePalSimple({ activityLevel: input.activityLevel, trainingDays: input.trainingDays, cardioMin: input.cardioMin });
  const palBase = ({ low: 1.40, medium: 1.55, high: 1.75 } as const)[input.activityLevel ?? 'medium'];
  const trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
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
  const palEff = computePalSimple({ activityLevel: input.activityLevel, trainingDays: input.trainingDays, cardioMin: input.cardioMin });
  const palBase = ({ low: 1.40, medium: 1.55, high: 1.75 } as const)[input.activityLevel ?? 'medium'];
  const trainAdd = clamp((input.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((input.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
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
  // Белок ISSN/Helms: натурал 1.8-2.2 maintain/bulk, 2.3-3.1 cut по сухости; health 1.8 (EAT-Lancet)
  const bf = input.bodyFat ?? (input.sex==='male'?15:22);
  let protNat: number;
  if(input.goal==='cut'){
    protNat = bf < 12 ? 2.6 : bf < 18 ? 2.4 : 2.2;
  } else if(input.goal==='bulk'){
    protNat = 1.9;
  } else if(input.goal==='health'){
    protNat = 1.8;
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
