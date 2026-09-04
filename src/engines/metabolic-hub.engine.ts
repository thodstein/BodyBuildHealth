/**
 * metabolic-hub.engine.ts — единый движок метаболики (Pro, 14 калькуляторов)
 * Вода / Шаги / КБЖУ / Жир / HPA(StressLoad) / Кровь / EA / Алкоголь / ProteinTiming / Maintenance / AT / ReverseDiet / NEAT / Thyroid / HOMA-IR
 * Формулы: EFSA/IOM, Mifflin+Cunningham/Katch/Owen/TenHaaf/Harris/Henry/Livingston, ISSN/Helms/Morton, US Navy/Hodgdon + JP3/7 + Durnin-Womersley + BIA Kyle,
 * Gabbett ACWR, Hall 2011 (density p*9400), IOC RED-S Mountjoy 2018, Westerterp TEF, Baker 2017 sweat, Levine NEAT 2002, Trexler AT 2014, MATADOR Byrne 2017.
 * ВАЖНО: все AAS-мультипликаторы помечены experimental — не peer-reviewed, вывод через FFM предпочтителен.
 */
import {
  computeBMR as computeBMRBase,
  computePalSimple,
  palTrainingAdd,
  palCardioAdd,
  clamp,
  toIn,
  log10,
  calcTEF,
  calcTrendFromHistory as calcTrendBase,
  calcAdaptiveAdjustment as calcAdaptiveBase,
  calcTrendWithConfidence,
  hallWeightChangeDelta,
  energyDensityPerKg,
  hallAdaptationFactor,
  calcSweatElectrolytes,
  calcSweatRate,
  buildHydrationPlan,
  calcCaffeineCurve,
  estimateAdaptiveThermogenesis,
  reverseDietPlan,
  calcHomaIR,
  calcJPBodyFat,
  calcDurninBodyFat,
  calcBIAKyle,
  fiberSplit,
  lbmPreservationScore,
  estimateLipidImpact,
  calcFLI,
  checkPSMF,
  menstrualWaterRetention,
  calcWHtR,
  calcABSI,
  calcBAI,
  calcTyG,
  calcMetS_ATP3,
  calcFIB4,
  calcAPRI,
  calcQUICKI,
  calcTG_HDL,
  calcLAP,
  calcVAI,
  calcFMI,
  boerLeanBodyMass,
  adjustedBodyWeight,
  pregnancyTDEEAdd,
  MET_CATALOG,
  palFromMetHours,
  computePalFromMet,
  type WeightPoint as WeightPointBase,
} from '../core/metabolic-constants';
import {
  ACTIVITY_CATALOG_60,
  PROFESSION_PAL,
  computePalFromActivity,
  parseWeeklyScheduleTextV2,
  estimateSweatRatePopulation,
  rankBeveragesV2,
  DIAAS_TABLE,
  type ProfessionKind,
} from '../core/activity-catalog';
import { clinicalFloorsForLabs } from './risk-engine-tz-spec';

export type WeightPoint = WeightPointBase;
// Доменные типы — декомпозиция монстра MetabolicInput (backward compat: MetabolicInput = пересечение всех)
export type WaterInput = Pick<MetabolicInput,'weight'|'height'|'age'|'sex'|'bodyFat'|'climate'|'humidity'|'sweatRate'|'sweatSodiumMgPerL'|'trainingHours'|'trainingDays'|'cardioMin'|'standingHours'|'creatineUse'>;
export type StepsInput = Pick<MetabolicInput,'weight'|'height'|'age'|'sex'|'bodyFat'|'steps'|'activityLevel'|'trainingDays'|'cardioMin'|'standingHours'|'fidgetLevel'|'weeklyVolumeTons'|'metHoursPerWeek'>;
export type KBJUInput = Pick<MetabolicInput,'weight'|'height'|'age'|'sex'|'bodyFat'|'activityLevel'|'trainingDays'|'cardioMin'|'standingHours'|'fidgetLevel'|'weeklyVolumeTons'|'metHoursPerWeek'|'goal'|'onAAS'|'aasDose'|'menstrualPhase'|'tsh'|'ft4'>;
export interface MetabolicInput {
  weight: number; height: number; age: number; sex: 'male'|'female';
  bodyFat?: number; neck?: number; waist?: number; hip?: number;
  steps?: number; cardioMin?: number; trainingDays?: number; trainingHours?: number;
  activityLevel?: 'low'|'medium'|'high'|'very_high'; // бытовая NEAT — very_high для 2×/д
  goal?: 'cut'|'maintain'|'bulk'|'health';
  onAAS?: boolean; aasDose?: number; // мг/нед тест-экв
  stress?: number; sleepHours?: number; sleepQuality?: number; // 1-5
  acwr?: number; // для HPA/StressLoad
  // pro-расширения (опциональные, backward compat)
  climate?: 'temperate'|'hot'|'cold';
  sweatRate?: number; // мл/ч 400-800 (Baker 2017)
  sweatSodiumMgPerL?: number; // Na в поте 600-1200 мг/л
  humidity?: number; // % 0-100 для климата
  standingHours?: number; // ч стоя в сутки 0-12
  fidgetLevel?: 1|2|3; // 1 низкий 2 средний 3 высокий — Levine NEAT
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
  tsh?: number; ft4?: number; // щитовидка: TSH + FT4 для BMR-коррекции (Kim 2014)
  creatineUse?: boolean;
  // hematology labs
  hct?: number; hgb?: number; ferritin?: number; gfr?: number;
  waterL?: number; ironIntakeMg?: number;
  // тренинг-объем
  weeklyVolumeTons?: number; // тонн/нед для EAT точнее
  // новые skinfold/BIA поля (опционально)
  skinfoldSum3?: number; // сумма 3 складок мм JP
  skinfoldSum4?: number; // сумма 4 складок мм Durnin
  biaResistanceOhm?: number; // сопротивление Ом для Kyle BIA
  glucoseMgDl?: number; insulinMuMl?: number; // для HOMA-IR
  deficitKcal?: number; weeksInDeficit?: number; // для AT
  // P0-2 MET
  metHoursPerWeek?: number; // честные MET-часы/нед (Ainsworth) — альтернатива palTrainingAdd
  // P0-3 RED-S screening
  measuredRMR?: number; // измеренный RMR для ratio
  leafScore?: number; // 0-16 LEAF-Q-lite
  boneFlag?: boolean; // стресс-перелом в анамнезе
  menstrualFlag?: boolean; // аменорея
  // P1-3 metabolic health extra
  hdlMgDl?: number; systolic?: number; diastolic?: number;
  ast?: number; alt?: number; plt?: number; // для FIB-4/APRI
  // P2 caffeine timing
  caffeineHoursSince?: number; // ч с последнего кофе
  // PRO v4 — профессия/беременность/этника/бариатрия/акклиматизация/хроника (опционально, backward compat)
  profession?: ProfessionKind; // честная база PAL вместо dropdown
  trimester?: 1 | 2 | 3; // беременность (IOM 2025)
  lactating?: 'exclusive' | 'mixed' | null;
  ethnicity?: 'european' | 'african' | 'east_asian';
  postBariatric?: boolean; // Knuth 2021 −12%
  untreatedHypothyroid?: boolean; // Endocrine 2024 −12%
  acclimated?: boolean; // Periard 10-14д: пот +15%, Na −40%
  alcoholDaysPerWeek?: number; // хроника 0-7 для FLI/EA-связки
  proteinSource?: keyof typeof DIAAS_TABLE | string; // DIAAS-источник белка
}

export const calcTrendFromHistory = calcTrendBase;
export function calcAdaptiveAdjustment(trendKgPerWeek:number, goal: 'cut'|'maintain'|'bulk'|'health'|undefined, baseTdee:number): { adjustment:number; expected:number; trend:number; suggest:string } {
  return calcAdaptiveBase(trendKgPerWeek, goal as any, baseTdee);
}

function computeBMR(input: MetabolicInput){
  return computeBMRBase(input as any);
}
/**
 * AAS-мультипликатор — EXPERIMENTAL, не peer-reviewed!
 * Bhasin 1996: 600мг T → +2кг воды (~3% body water), не +12% TDEE. RMR растет через +FFM (Cunningham), не ×1.08.
 * Помечен для UI дисклеймера. Предпочтительно считать TDEE через реальный FFM (Katch/Cunningham с true LBM).
 */
export const AAS_EXPERIMENTAL_NOTE = '⚠️ AAS-модель экспериментальна — не peer-reviewed. TDEE на курсе точнее через +FFM (Cunningham), не ×%.';
function aasMult(input: MetabolicInput, maxBoost:number){
  if(!input.onAAS) return 1;
  const dose = clamp(input.aasDose ?? 500, 0, 3000);
  // 500мг → ~50% от максимума, 1500мг → ~90% — насыщение (выдумано, для UI диапазона)
  const frac = dose<=0 ? 0.6 : Math.min(1, 0.4 + 0.6 * (dose/800));
  return 1 + maxBoost * frac;
}
// ——— PAL дедуп — единая точка PRO (профессия + MET + шаги) ———
export function getEffectivePal(input: MetabolicInput): { palEff:number; palBase:number; trainAdd:number; cardioAdd:number } {
  // PRO: профессия — честная база (FAO sedentary 1.40 / standing 1.55 / physical 1.75)
  const profBase = (input as any).profession ? PROFESSION_PAL[(input as any).profession as ProfessionKind] : undefined;
  const palKey = ((input.activityLevel as string) ?? 'medium') as 'low'|'medium'|'high'|'very_high';
  const palBase = profBase ?? (({ low: 1.40, medium: 1.55, high: 1.75, very_high: 1.95 } as const)[palKey] ?? 1.55);
  let trainAdd: number;
  if (typeof input.metHoursPerWeek === 'number' && input.metHoursPerWeek>0) {
    trainAdd = palFromMetHours(input.metHoursPerWeek);
  } else if (input.weeklyVolumeTons && input.weeklyVolumeTons>2) {
    trainAdd = clamp(input.weeklyVolumeTons * 0.018, 0.02, 0.24);
  } else {
    trainAdd = palTrainingAdd(input.trainingDays);
  }
  const cardioAdd = palCardioAdd(input.cardioMin);
  // PRO: шаги добавляют честно (7500 +0.02 / 10000 +0.04 / 15000 +0.06), fidget ±
  const stepsAdd = (input.steps ?? 0) >= 15000 ? 0.06 : (input.steps ?? 0) >= 10000 ? 0.04 : (input.steps ?? 0) >= 7500 ? 0.02 : 0;
  const fidgetAdd = (input as any).fidgetLevel === 3 ? 0.02 : (input as any).fidgetLevel === 1 ? -0.015 : 0;
  let palEff = clamp(palBase + trainAdd + cardioAdd + stepsAdd + fidgetAdd, 1.25, 2.40);
  if (input.standingHours && input.standingHours>4) palEff = clamp(palEff + (input.standingHours - 4)*0.008, 1.25, 2.40);
  return { palEff, palBase, trainAdd, cardioAdd };
}
/** PRO-обёртка: computePalFromActivity как единый источник (дедуп computePalSimple/computePalFull) */
export function calcPALPro(input: MetabolicInput): number {
  return computePalFromActivity({
    profession: (input as any).profession,
    basePal: (input as any).profession ? undefined : ({ low: 1.40, medium: 1.55, high: 1.75, very_high: 1.95 } as const)[((input.activityLevel as string) ?? 'medium') as 'low'|'medium'|'high'|'very_high'] ?? 1.55,
    metHoursPerWeek: input.metHoursPerWeek,
    standingHours: input.standingHours,
    fidgetLevel: input.fidgetLevel,
    dailySteps: input.steps,
  });
}

// ——— Вода ——— (EFSA 2010 + IOM 2004 + Baker 2017)
// IOM: 35мл/кг 18-30л, 33мл/кг женщины, 30мл/кг >60л — более точно чем lean*40/fat*20 (экспериментальная модель)
// Baker 2017: Na/Cl/K/Mg полный панель
export function calcWater(input: MetabolicInput) {
  const { lean } = computeBMR(input);
  const fatMass = Math.max(0, input.weight - lean);
  const hasBF = typeof input.bodyFat==='number' && input.bodyFat>3;
  // IOM возраст/пол-корректированная база, lean*40/fat*20 — экспериментальная альтернатива (покажем оба)
  const iomPerKg = input.sex==='female' ? (input.age && input.age>60 ? 30 : 33) : (input.age && input.age>60 ? 30 : 35);
  const baseIOM = Math.round(input.weight * iomPerKg);
  const baseLeanModel = hasBF ? Math.round(lean*40 + fatMass*20) : baseIOM;
  // По умолчанию — IOM (доказательно), lean-модель — справка (Pro)
  const base = baseIOM;
  const hours = input.trainingHours ?? (input.trainingDays ?? 3) * 1.1;
  const sweat = input.sweatRate ?? 600;
  const training = Math.round(hours * sweat * 0.85 + (input.cardioMin ?? 0) * 7);
  // климат: Sawka WBGT нелинейно — упрощено +600 жара +8*(hum-60), холод −150
  let climateAdd = 0;
  if (input.climate==='hot') {
    climateAdd = 600 + (input.humidity && input.humidity>60 ? Math.round((input.humidity-60)*8) : 0);
  } else if (input.climate==='cold') climateAdd = -150;
  // стоячие часы: +80мл/ч (NEAT вода, скромная оценка)
  const standingAdd = Math.round((input.standingHours ?? 0) * 80);
  // креатин: Powers 2003 — задержка 0.5-1л только 1ю неделю, не постоянно. Даем только если явно указано loading
  const creatineAdd = input.creatineUse ? 300 : 0;
  const creatineNote = input.creatineUse ? ' (1я нед загрузки)' : '';
  const nat = Math.round(base + training + climateAdd + standingAdd + creatineAdd);
  const boost = aasMult(input, 0.12) - 1; // experimental
  const aas = Math.round(nat * (1 + boost));
  const perHour = Math.round(nat / 16);
  const perHourAAS = Math.round(aas / 16);
  // Электролиты по Baker 2017: Na 900мг/л средн., Cl 1.5×Na, K 180мг/л, Mg 12мг/л
  const totalSweatMl = hours * sweat;
  const electrolytes = calcSweatElectrolytes(totalSweatMl, input.sweatSodiumMgPerL ?? 900);
  const sweatNaG = Math.round(electrolytes.sodiumMg / 100) / 10;
  const sweatClG = Math.round(electrolytes.chlorideMg / 100) / 10;
  const sweatKG = Math.round(electrolytes.potassiumMg / 1000 * 10) / 10;
  const sweatMgMg = electrolytes.magnesiumMg;
  return {
    nat, aas,
    delta: aas - nat,
    perHour, perHourAAS,
    sweatNaG, sweatClG, sweatKG, sweatMgMg,
    electrolytes, // полный панель Baker
    baseIOM, baseLeanModel, iomPerKg,
    note: input.onAAS
      ? `ААС EXP: +${Math.round(boost*100)}% (Na/H2O) ${AAS_EXPERIMENTAL_NOTE}. Na ~${sweatNaG}г/тр, K ${sweatKG}г`
      : `IOM ${iomPerKg}мл/кг → ${baseIOM}мл + пот ${sweat}мл/ч. Lean-модель ${baseLeanModel}мл (эксп.). Жара ${climateAdd}мл${standingAdd? `, стоя +${standingAdd}`:''}${creatineAdd? `, креатин +${creatineAdd}${creatineNote}`:''}`,
    breakdown: { base: Math.round(base), training: Math.round(training), climate: climateAdd, standing: standingAdd, creatine: creatineAdd, lean: Math.round(lean), fatMass: Math.round(fatMass), sweatNaG, sweatClG, sweatKG, sweatMgMg, baseIOM, baseLeanModel }
  };
}

// ——— Шаги ——— (MET-модель + персональный TEF + PRO NEAT — Levine 2002)
export function calcSteps(input: MetabolicInput) {
  const { bmr } = computeBMR(input);
  const { palEff, palBase, trainAdd, cardioAdd } = getEffectivePal(input);
  const pregAdd = pregnancyAdd(input);
  const tdeeNat = Math.round(bmr * palEff) + pregAdd;
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
  // DLW validation band ±12% (Westerterp DLW 1999)
  const dlwBand = { low: Math.round(tdeeNat * 0.88), high: Math.round(tdeeNat * 1.12) };
  return {
    tdeeNat, tdeeAAS,
    targetNat, targetAAS,
    stepsNat: Math.min(26000, stepsNat), stepsAAS: Math.min(26000, stepsAAS),
    delta: stepsAAS - stepsNat,
    pal: Math.round(palEff*100)/100,
    kcalPerStep: Math.round(kcalPerStepClamped*1000)/1000,
    sedentKcal,
    tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive, dlwBand,
    note: input.onAAS ? `ААС EXP +${Math.round((mult-1)*100)}% ${AAS_EXPERIMENTAL_NOTE} → шагов −8%` : `Натурал: PAL ${palEff.toFixed(2)} (бытовая ${palBase}+train ${trainAdd.toFixed(2)}+cardio ${cardioAdd.toFixed(2)}${input.weeklyVolumeTons? ` tons ${input.weeklyVolumeTons}`:''}· DLW ±12% ${dlwBand.low}-${dlwBand.high}) · NEAT Levine 2002`
  };
}

// ——— КБЖУ ——— (Helms/ISSN + персональный TEF + train/rest periodization + thyroid)
// TEF информативный: PAL уже включает ~10% TEF (FAO) — не суммируем повторно к TDEE, показываем для breakdown
export function calcKBJU(input: MetabolicInput) {
  // Thyroid-коррекция BMR: Kim 2014 — каждая 1 pmol FT4 ↑BMR ~8%, TSH>4.5 уже в HPA, здесь — FT4
  let thyroidMult = 1;
  if (typeof input.ft4 === 'number' && input.ft4 > 0) {
    // FT4 норма 12-22 pmol, середина 17 → +0% ; <12 → −5..−12%, >22 → +6..+16%
    const ft4Delta = input.ft4 - 17;
    thyroidMult = clamp(1 + ft4Delta * 0.022, 0.88, 1.18); // 2.2% на 1 pmol (Kim  ≈8% на 1 SD)
  } else if (typeof input.tsh === 'number' && input.tsh > 4.5) {
    thyroidMult = 0.95; // гипотиреоз субклинический −5%
  }
  const bmrBase = computeBMR(input);
  const bmr = Math.round(bmrBase.bmr * thyroidMult);
  const lean = bmrBase.lean;
  const method = bmrBase.method + (thyroidMult !== 1 ? `+thyroid×${thyroidMult.toFixed(2)}` : '') as any;
  const { palEff, palBase, trainAdd, cardioAdd } = getEffectivePal(input);
  let tdeeNat = Math.round(bmr * palEff);
  const mult = aasMult(input, 0.10);
  let tdeeAAS = Math.round(tdeeNat * mult);
  // лютеиновая фаза +150-300ккал (Benton 2021)
  const lutealAdd = input.menstrualPhase==='luteal' ? clamp(Math.round(input.weight*3.2), 150, 320) : 0;
  tdeeNat += lutealAdd; tdeeAAS += lutealAdd;
  // беременность/лактация IOM 2025: +340 Q2 / +452 Q3 / +500 лактация
  const pregAddKB = pregnancyAdd(input);
  tdeeNat += pregAddKB; tdeeAAS += pregAddKB;
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
  // коррекция по возрасту >45л +0.15г (саркопения — Morton/ISSN)
  if ((input.age ?? 30) > 45) protNat += 0.15;
  // AAS: антикатаболик — Helms 2014/ISSN Позволяет *не* повышать белок, но на практике +0.3г/кг для безопасности MPS при дефиците
  // Ранее +0.4-1.2 было завышено (Bhasin: AAS улучшает N-баланс). Снижено до +0.2-0.5 и помечено EXP
  const aasProtAdd = input.onAAS ? 0.2 + clamp((input.aasDose ?? 500)/1500, 0, 0.3) : 0;
  const protAAS = +(protNat + aasProtAdd).toFixed(1);
  // белок считаем по весу, но кап по LBM 3.1г/кг LBM (Morton 2018 cap 3.1 lean-cut, ISSN)
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
  const thyroidNote = thyroidMult !== 1 ? ` · щитовидка ×${thyroidMult.toFixed(2)}${input.ft4 ? ` FT4 ${input.ft4}` : ` TSH ${input.tsh}`}` : '';
  return {
    nat: { kcal: kcalNatFinal, p: pNat, f: fNat, c: cNat, protPerKg: protNat, tdee: tdeeNat, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    aas: { kcal: kcalAASFinal, p: pAAS, f: fAAS, c: cAAS, protPerKg: protAAS, tdee: tdeeAAS, bmr, lean: Math.round(lean), method, pal: Math.round(palEff*100)/100 },
    delta: { kcal: Math.round(kcalAASFinal - kcalNatFinal), p: pAAS - pNat, c: cAAS - cNat },
    carbTiming, fiber: { nat: fiberNat, aas: fiberAAS }, tefNat, tefAAS, neat, eat, bmr: Math.round(bmr),
    adaptive, periodization, lutealAdd, thyroidMult,
    note: input.onAAS ? `ААС EXP +${Math.round((mult-1)*100)}% белок ${protAAS}г/кг (+${aasProtAdd.toFixed(1)} EXP)${AAS_EXPERIMENTAL_NOTE}${lutealAdd? `, лютеин +${lutealAdd}`:''}${thyroidNote} · TEF ${tefNat}ккал (инфо, в PAL уже)` : `Натурал: белок ${protNat}г/кг (LBM ${Math.round(lbmForProt)}кг), TEF ${tefNat}ккал (инфо), PAL ${palEff.toFixed(2)}${lutealAdd? `, лютеин +${lutealAdd}`:''}${thyroidNote}`
  };
}

// ——— Жир ——— (Navy Hodgdon + JP3/JP7 + Durnin-Womersley + BIA Kyle + Deurenberg fallback)
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
  // JP3 / Durnin / BIA — если есть skinfold/BIA данные, точнее Navy
  const jp = typeof input.skinfoldSum3 === 'number' ? calcJPBodyFat(input.skinfoldSum3, input.age ?? 30, input.sex) : null;
  const durnin = typeof input.skinfoldSum4 === 'number' ? calcDurninBodyFat(input.skinfoldSum4, input.age ?? 30, input.sex) : null;
  const bia = typeof input.biaResistanceOhm === 'number' ? calcBIAKyle(input.weight, input.height, input.age ?? 30, input.sex, input.biaResistanceOhm) : null;
  // Army body fat (Hodgdon, AR600-9, допуск ±3%): технически тот же Navy, но показываем как кросс-чек
  const army = navy != null ? Math.round(navy*10)/10 : null;
  // Deurenberg (BMI+age) — точен для населения, FAIL для атлетов BMI>27 завышает +8% (Deurenberg 1991)
  const bmi = input.weight / (((input.height||180)/100)**2);
  const deurenbergRaw = clamp(1.2*bmi + 0.23*(input.age||30) -10.8*(input.sex==='male'?1:0) -5.4, 3, 60);
  const deurenberg = Math.round(deurenbergRaw*10)/10;
  const deurenbergWarn = bmi > 27 ? '⚠️ Deurenberg завышает у атлетов BMI>27' : '';
  // Приоритет: JP/Durnin/BIA (если есть) > Navy > ручной bodyFat > Deurenberg > дефолт
  // JP ±3% best field при обученном калипере, Durnin ±4%, BIA ±3.5% Kyle
  const measured = jp ?? durnin ?? bia;
  const currRaw = measured ?? navy ?? (typeof input.bodyFat==='number' && input.bodyFat>3 ? input.bodyFat : null) ?? deurenbergRaw ?? (input.sex==='female'?22:15);
  const curr = clamp(Math.round(currRaw*10)/10, 3, 65);
  const ffm = input.weight * (1 - curr/100);
  const hM = (input.height||180)/100;
  const ffmi = ffm / (hM*hM);
  const ffmiNorm = ffmi + 6.1 * (1.80 - hM);
  const aasAdd = input.onAAS ? clamp(0.6 + (input.aasDose ?? 500)/1500, 0.6, 1.8) : 0; // снижено: 2.2→1.8, glycogen/water реально +0.3-1.0 FFMI
  const ffmiAdj = ffmi + aasAdd;
  const ffmiNormAdj = ffmiNorm + aasAdd;
  const natLimit = 26.2; // Helms 2023 обновленный лимит natty (Kouri 25 устарел)
  const crossCheckParts: string[] = [];
  if (jp != null) crossCheckParts.push(`JP3 ${jp.toFixed(1)}%`);
  if (durnin != null) crossCheckParts.push(`Durnin ${durnin.toFixed(1)}%`);
  if (bia != null) crossCheckParts.push(`BIA ${bia.toFixed(1)}%`);
  if (navy != null) crossCheckParts.push(`Navy ${navy.toFixed(1)}%`);
  crossCheckParts.push(`Deur ${deurenberg.toFixed(1)}%${deurenbergWarn?'*':''}`);
  if (army != null) crossCheckParts.push(`Army ${army.toFixed(1)}%`);
  const crossCheck = crossCheckParts.join(' · ');
  // info: осевая нагрузка раздувает талию ~0.7см на 15+ сетов оси, но Navy не правим — только инфо
  const squatVol = (input.trainingDays ?? 3) * 7;
  const axialInfo = squatVol > 14 ? `Осевая нагрузка ~${squatVol} сет/нед может +0.5-1см к талии (мерь натощак, без пампа)` : 'Без осевой нагрузки';
  return {
    navy: navy != null ? Math.round(navy*10)/10 : null,
    jp, durnin, bia,
    army,
    deurenberg,
    deurenbergWarn,
    crossCheck,
    current: curr,
    measured, // лучший измеренный (JP/Durnin/BIA) если есть
    ffm: Math.round(ffm*10)/10,
    ffmi: Math.round(ffmi*10)/10,
    ffmiNorm: Math.round(ffmiNorm*10)/10,
    ffmiAdj: Math.round(ffmiAdj*10)/10,
    ffmiNormAdj: Math.round(ffmiNormAdj*10)/10,
    natLimit,
    isOverNatLimit: ffmiNorm > natLimit,
    isOverNatLimitAAS: ffmiNormAdj > natLimit,
    note: axialInfo,
    aasNote: input.onAAS ? `ААС EXP +${aasAdd.toFixed(1)} (вода/гликоген) ${AAS_EXPERIMENTAL_NOTE} · Helms 26.2` : `Натурал: лимит 26.2, у вас ${ffmiNorm.toFixed(1)} · ${crossCheck}`,
    accuracy: 'JP7 ±3% (калипер) > Navy ±3.5% > Deurenberg ±4-8% (BMI>27 fail). BIA Kyle ±3.5% при R 400-900 Ом. Для трека — одни условия + 3 замера/утро.',
    // legacy для совместимости
    navyAdj: null, waistAdj: null, axialAdd: 0,
  };
}

// ——— Stress Load Index (бывш. HPA/кортизол) — screening, НЕ лаба! ───
// ВАЖНО: кортизол слюны 0.5-25 nmol/L циркадно (Clow 2004), PSS r=0.2, сон −1ч ↑кортизол 10-15% (Wright 2015).
// Веса 4.5/5.5/28 — эвристика, не PubMed. Шкала 0-100 invented. Дисклеймер обязателен.
export function calcCortisol(input: MetabolicInput) { return calcStressLoad(input); }
export function calcStressLoad(input: MetabolicInput) {
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
  if (caffeine > 600) score += 8;
  else if (caffeine > 300) score += 4;
  if (alcohol > 60) score += 9;
  else if (alcohol > 30) score += 5;
  if (typeof input.tsh === 'number' && input.tsh > 4.5) score += 6;
  if (typeof input.ft4 === 'number' && input.ft4 < 12) score += 4; // гипо
  if (input.menstrualPhase==='luteal') score += 3;
  score = clamp(Math.round(score), 8, 96);
  const aasScore = clamp(Math.round(score * (input.onAAS ? 0.86 : 1)), 5, 96); // EXP −14% Heber 1985 10-30%
  const zone = (v:number)=> v<38 ? 'low' : v<=62 ? 'norm' : v<=78 ? 'high' : 'very_high';
  const zoneNat = zone(score);
  const zoneAAS = zone(aasScore);
  const zoneLabel: Record<string,string> = { low:'Низкий (риск детрена/гипо)', norm:'Норма', high:'Повышен', very_high:'Высокий — делод/сон' };
  const whatIf = (dSleep:number, dStress:number, dAcwr:number)=>{
    let v = score + dStress*4.5 + dSleep*(-5.5) + dAcwr*28;
    return clamp(Math.round(v), 5, 96);
  };
  const caffeineNote = caffeine>400 ? `Кофеин ${caffeine}мг — SLI +${caffeine>600?8:4}, half-life 5ч (Dulloo 1989 +3% TEF)` : '';
  const alcoholNote = alcohol>30 ? `Алкоголь ${alcohol}г — SLI +${alcohol>60?9:5}, сон −` : '';
  return {
    nat: score, aas: aasScore, delta: aasScore - score,
    natIdx: score, aasIdx: aasScore,
    // алиасы для совместимости
    natIndex: score, aasIndex: aasScore,
    zoneNat, zoneAAS,
    zoneLabelNat: zoneLabel[zoneNat], zoneLabelAAS: zoneLabel[zoneAAS],
    diurnal: input.onAAS
      ? `ААС EXP: супрессия HPA, пик сглажен. Откат 2-12 нед (Heber 1985) ${AAS_EXPERIMENTAL_NOTE}`
      : `Физиология: пик 06:00-08:00, минимум 22:00-02:00. ${caffeineNote} ${alcoholNote}`.trim() || 'Свет/кофеин сдвигают',
    whatIf,
    acwrZone: acwr<0.8?'undertrained': acwr<=1.3?'optimal': acwr<=1.5?'caution':'dangerous' as const,
    caffeineAdj: caffeine>300? (caffeine>600?8:4):0,
    alcoholAdj: alcohol>30? (alcohol>60?9:5):0,
    note: '⚠️ Stress Load Index — эвристика (не кортизол!). Веса invented. Для диагноза — PSS-10 + PSQI + слюна 4 точки (Clow 2004).',
    scaleNote: 'Шкала 0-100 invented: <38 низкий, 38-62 норма, 63-78 повышен, >78 высокий — эвристика'
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
export function calcEnergyAvailability(input: { weight:number; bodyFat?:number; height:number; lean?:number; intakeKcal?:number; eeeKcal?: number; trainingDays?:number; heightCm?:number; sex?: 'male'|'female' }): EAResult {
  const bf = input.bodyFat ?? 15;
  const lean = input.lean ?? input.weight * (1 - bf/100);
  const ffm = lean;
  const intake = input.intakeKcal ?? 0;
  // EEE Loucks: gross − RMR_во_время_упражнения (≈15% gross при 6 MET). 380→~320 net для ББ-сессии 60мин
  const eeeGross = input.eeeKcal ?? ((input.trainingDays ?? 3) * 380);
  const eee = input.eeeKcal != null ? Math.round(eeeGross * 0.85) : eeeGross; // net ≈85% gross
  let ea: number|null = null;
  let zone: EAResult['zone']='unknown';
  let zoneLabel='Нет данных — введи ккал и EEE';
  let color='rgba(255,255,255,0.35)';
  // Mountjoy 2018 update: Female LEA <30, Male LEA <25; optimal F≥45 M≥40
  const sex = (input as any).sex ?? 'male';
  const leaCut = sex === 'female' ? 30 : 25;
  const optCut = sex === 'female' ? 45 : 40;
  if (intake>0 && ffm>30) {
    ea = Math.round(((intake - eee)/ffm)*10)/10;
    if (ea < leaCut) { zone='low'; zoneLabel=`LEA <${leaCut} — RED-S риск (${sex==='female'?'гормоны/кости':'тесто/кости'})`; color='#ef4444'; }
    else if (ea < optCut) { zone='reduced'; zoneLabel=`Сниженная EA ${leaCut}-${optCut} — внимание`; color='#f59e0b'; }
    else { zone='optimal'; zoneLabel=`Оптимально ≥${optCut}`; color='#22c55e'; }
  }
  const note = zone==='low' ? `LEA <${leaCut}: риск ${sex==='female'?'аменорея/остеопения':'гипогонадизм'}, +300-500ккал или −EEE (Loucks/IOC)` : zone==='reduced' ? `EA ${leaCut}-${optCut}: граница, +150ккал (Mountjoy 2018)` : zone==='optimal' ? 'EA ок — фертильность/кости в норме (IOC 2014)' : 'Введи факт ккал из дневника и EEE (тоннаж/кардио) · net EEE = gross×0.85 (Loucks)';
  return { ea, zone, zoneLabel, color, ffm: Math.round(ffm*10)/10, eee, note };
}

// ——— Алкоголь ——— (Atwater 7.1, Suter 1992)
export interface AlcoholResult { kcal:number; tef:number; fatOxidationBlockedPct:number; stepsEq:number; note:string; suterNote: string }
export function calcAlcohol(alcoholG?:number, weightKg=80): AlcoholResult {
  const g = clamp(alcoholG ?? 0, 0, 300);
  const kcal = Math.round(g*7.1);
  // Suter 1992 TEF alcohol 15% среднее (10-22%), ранее 18% завышено
  const tef = Math.round(kcal*0.15);
  // Suter PM 1992: 24г → жирокисл ↓73% 3ч via acetate, доза-линеен ≈1.2%/г, не ступени — оставляем ступени как иллюстрацию с пометкой
  const blockedExact = clamp(Math.round(g * 1.2), 0, 80); // линейная аппрокс
  const blocked = g>0 ? clamp(Math.round( g>60?73 : g>30?45 : 22), 0, 80) : 0;
  const stepsEq = Math.round(kcal/0.04/(weightKg/70));
  const note = g===0 ? 'Без алкоголя — окисление жира в норме' : g>40 ? `Этанол ${g}г = ${kcal}ккал, TEF ${tef} (Suter 15%), жир блок illustration ${blocked}% (exact ~${blockedExact}%) ~3ч, +${stepsEq} шагов` : `Этанол ${g}г = ${kcal}ккал, блок жира illustration ${blocked}% (exact ~${blockedExact}%) 2ч`;
  return { kcal, tef, fatOxidationBlockedPct: blocked, fatOxidationExactPct: blockedExact, stepsEq, note, suterNote: 'Suter 1992 Fig2 — illustration, точный ~g×1.2%' } as any;
}

// ——— Protein Timing (Morton 2018, Schoenfeld/Aragon 2018, Res 2012) ———
// 0.40г/кг/прием ×4 (≈32г/80кг) + 2-3г leuc, ceiling 0.55г/кг waste, pre-sleep 30-40г казеин +0.22кг LBM, plant DIAAS 0.07 vs 0.11
export interface ProteinTimingResult { perMeal:number; meals:number; leucinePerMeal:number; perMealGPerKg:number; ceiling:number; preSleepG:number; note:string; plantNote:string }
export function calcProteinTiming(totalProteinG:number, weightKg:number, mealsPerDay=4, isPlantHeavy?: boolean): ProteinTimingResult {
  const leucineThreshold = 2.5; // г лейцина для MPS (Morton)
  const leucinePerGProtein = isPlantHeavy ? 0.07 : 0.11; // DIAAS-adjusted: plant 6-8% vs whey 11%
  const protPerMeal = totalProteinG>0 ? Math.round(totalProteinG/mealsPerDay) : 0;
  const perMealGPerKg = weightKg>0 ? Math.round(protPerMeal/weightKg*100)/100 : 0;
  const ceiling = 0.55; // Schoenfeld/Aragon waste >0.55г/кг/прием
  const leucinePerMeal = Math.round(protPerMeal*leucinePerGProtein*10)/10;
  const mealsNeeded = leucineThreshold>0 ? Math.ceil(totalProteinG / (leucineThreshold/leucinePerGProtein)) : mealsPerDay;
  const optimalMeals = clamp(mealsNeeded, 3, 6);
  const preSleepG = 35; // Res 2012 30-40г казеин
  const overCeiling = perMealGPerKg > ceiling;
  const plantNote = isPlantHeavy ? 'Растительный белок — DIAAS 0.64 (soy) vs 1.09 whey, leuc 0.07' : 'Животный/whey leuc 0.11';
  let note = '';
  if (leucinePerMeal>=2.2 && !overCeiling) note = `MPS ок (${leucinePerMeal}г leuc, ${perMealGPerKg}г/кг <0.55) — ${mealsPerDay} приема ок. Pre-sleep ${preSleepG}г казеин (Res 2012)`;
  else if (overCeiling) note = `Перебор ${perMealGPerKg}г/кг >0.55 waste — увеличь приемы до ${optimalMeals} по ~${Math.round(totalProteinG/optimalMeals)}г. ${plantNote}`;
  else note = `Мало leuc ${leucinePerMeal}г <2.5г — нужно ${optimalMeals} приемов по ~${Math.round(totalProteinG/optimalMeals)}г. ${plantNote}`;
  return { perMeal: protPerMeal, meals: mealsPerDay, leucinePerMeal, perMealGPerKg, ceiling, preSleepG, note, plantNote };
}

// ——— Maintenance Finder (14д) + Goal Timeline (Hall) ———
// Hall: плотность потери зависит от состава (p*9400+(1-p)*1800), не 7700 фикс — lean ошибка 45%
export interface MaintenanceFinderResult { tdee:number; confidence:'low'|'medium'|'high'; r2:number; days:number; note:string; density:number; atKcal:number }
export function calcMaintenanceFinder(weightHistory: WeightPoint[], avgIntakeKcal?:number, bodyFatPct?: number): MaintenanceFinderResult | null {
  if (!weightHistory || weightHistory.length<7) return null;
  const pts = weightHistory.slice(-14);
  const conf = calcTrendWithConfidence(pts);
  const trend = conf.trend; // кг/нед
  const density = energyDensityPerKg(bodyFatPct, undefined);
  const intake = avgIntakeKcal ?? 0;
  // Adaptive thermogenesis: Trexler 2014 — при дефиците часть TDEE подавлена сверх FFM
  const atKcal = trend < -0.2 ? estimateAdaptiveThermogenesis({ deficitKcal: Math.round(Math.abs(trend)*density/7), weeksInDeficit: Math.round(conf.days/7) }) : 0;
  let tdee = 0;
  let confidence: MaintenanceFinderResult['confidence']='low';
  if (conf.r2>0.6) confidence='high'; else if (conf.r2>0.35) confidence='medium';
  if (intake>0) tdee = Math.round(intake - (trend*density/7) - atKcal*0.3);
  else tdee = 0;
  const note = tdee ? `Тренд ${trend}кг/нед (R2 ${conf.r2}, плотность ${density} Hall) → TDEE ~${tdee}ккал (+AT ${atKcal}) intake ${intake}` : `Тренд ${trend}кг/нед — введи средний ккал из дневника для TDEE`;
  return { tdee, confidence, r2: conf.r2, days: conf.days, note, density, atKcal };
}
export interface GoalTimelineResult { days:number; kcalDiff:number; note:string; model: string }
export function calcGoalTimeline(input: { weight:number; targetWeight:number; tdee:number; bodyFat?: number }): GoalTimelineResult | null {
  const diff = (input.targetWeight - input.weight);
  if (Math.abs(diff)<0.2) return { days:0, kcalDiff:0, note:'Цель достигнута', model: 'done' };
  const density = energyDensityPerKg(input.bodyFat, input.weight);
  const totalKcal = diff*density;
  // Hall адаптация непрерывна exp(-t/90), не flat 15% — используем интегральную оценку ~15% за 90д плавно
  // days решается итеративно: days = |totalKcal| / |kcalDiff| * adaptFactor(days)
  // Упрощаем непрерывной: adapt≈1.15 при 60д → exp модель 1/(0.92) ≈1.08 реально, но оставим 1.15 как верх
  const adapt = hallAdaptationFactor(60); // 0.85→1/0.85=1.17 верх
  const dailyDef = diff<0 ? 500 : 300;
  const days = Math.round(Math.abs(totalKcal) / dailyDef * (1/ adapt));
  const kcalDiff = diff<0 ? -500 : 300;
  const note = diff<0 ? `Сушка ${Math.abs(diff).toFixed(1)}кг (пл ${density} Hall) → ~${days}д при −500ккал (AT ${adapt.toFixed(2)})` : `Масса +${diff.toFixed(1)}кг → ~${days}д при +300ккал`;
  return { days, kcalDiff, note, model: `Hall density ${density} + adapt ${adapt.toFixed(2)}` };
}

// ——— Adaptive Thermogenesis + Reverse Diet (Trexler 2014, Byrne MATADOR 2017) ———
export interface AdaptiveThermogenesisResult { atKcal:number; rmrPred:number; rmrMeasEst:number; tier:'none'|'mild'|'moderate'|'severe'; note:string }
export function calcAdaptiveThermogenesis(input: { weight:number; height:number; age:number; sex:'male'|'female'; bodyFat?: number; deficitKcal?: number; weeksInDeficit?: number; weightLostKg?: number }): AdaptiveThermogenesisResult {
  const rmrPred = computeBMRBase(input as any).bmr;
  const atKcal = estimateAdaptiveThermogenesis({ deficitKcal: input.deficitKcal, weeksInDeficit: input.weeksInDeficit, weightLostKg: input.weightLostKg });
  const rmrMeasEst = Math.max(800, rmrPred - atKcal);
  const tier = atKcal > 150 ? 'severe' : atKcal > 80 ? 'moderate' : atKcal > 30 ? 'mild' : 'none';
  const tierLabel = { none:'Нет', mild:'Лёгкая', moderate:'Умеренная', severe:'Выраженная' }[tier];
  const note = atKcal > 30 ? `${tierLabel} адаптация −${atKcal}ккал к RMR (Trexler). Reverse +100/7д (MATADOR).` : 'Адаптации нет — дефицит <2нед или <300ккал';
  return { atKcal, rmrPred, rmrMeasEst, tier, note };
}
export function calcReverseDiet(currentKcal:number, targetKcal:number): Array<{ week:number; kcal:number; note:string }> {
  return reverseDietPlan(currentKcal, targetKcal, 100, 7);
}

// ——— NEAT breakdown — Levine 2002 ———
export interface NEATResult { sitting:number; standing:number; fidget:number; walking:number; total:number; note:string }
export function calcNEAT(input: { weight:number; standingHours?:number; fidgetLevel?:1|2|3; steps?:number; height?:number }): NEATResult {
  // Levine 1999/2002: sitting 80ккал/ч, standing 120 (+40), fidget +90/−40, walking 250ккал/ч 4км/ч
  const standing = Math.round((input.standingHours ?? 0) * 40); // +40 vs sitting per Levine Table 1
  const fidget = input.fidgetLevel===3 ? 90 : input.fidgetLevel===1 ? -40 : 0;
  const walking = input.steps ? Math.round(input.steps * 0.04 * (input.weight/70)) : 0; // 0.04 из шагов
  const sittingBase = 120; // 80×1.5ч? условно 10ч сидя
  const total = Math.max(80, sittingBase + standing + fidget + walking);
  const note = `Levine 2002: NEAT ${total} = сидячая база ${sittingBase} + стоя +${standing} + fidget ${fidget>0?'+':''}${fidget} + ходьба ${walking} (шаги×0.04)`;
  return { sitting: sittingBase, standing, fidget, walking, total, note };
}

// ——— Thyroid — Kim 2014 ———
export function calcThyroidImpact(ft4?: number, tsh?: number): { mult:number; note:string } {
  if (typeof ft4 === 'number' && ft4 > 0) {
    const delta = ft4 - 17;
    const mult = clamp(1 + delta * 0.022, 0.88, 1.18);
    return { mult, note: `FT4 ${ft4} → BMR ×${mult.toFixed(2)} (Kim 2014 2.2%/pmol)` };
  }
  if (typeof tsh === 'number' && tsh > 4.5) return { mult: 0.95, note: `TSH ${tsh} (>4.5) → BMR ×0.95 субклин. гипо` };
  return { mult: 1, note: 'Щитовидка — норма (FT4 12-22, TSH 0.4-4.0)' };
}

// ——— HOMA-IR — Wallace 2004 ———
export function calcHomaIRWrap(glucoseMgDl?: number, insulinMuMl?: number): { homa:number|null; zone:'unknown'|'optimal'|'attention'|'ir'; note:string } {
  // экспортируем также Mensink/FLI/PSMF/menstrual для хаба
  return _calcHomaIRWrap(glucoseMgDl, insulinMuMl);
}
function _calcHomaIRWrap(glucoseMgDl?: number, insulinMuMl?: number): { homa:number|null; zone:'unknown'|'optimal'|'attention'|'ir'; note:string } {
  const homa = calcHomaIR(glucoseMgDl, insulinMuMl);
  if (homa == null) return { homa: null, zone: 'unknown', note: 'Введи глюкозу (мг/дл) + инсулин (мкЕд/мл) натощак' };
  let zone: 'optimal'|'attention'|'ir' = 'optimal';
  let note = '';
  if (homa < 1.4) { zone='optimal'; note='HOMA-IR <1.4 — оптимально (чувствительность)';
  } else if (homa < 2.5) { zone='attention'; note='HOMA-IR 1.4-2.5 — погранично, угли 3-4г/кг, HIIT';
  } else { zone='ir'; note='HOMA-IR ≥2.5 — инсулинорезистентность, угли ≤3г/кг, метформин к врачу'; }
  return { homa, zone, note };
}
export const calcLipid = estimateLipidImpact;
export const calcFLIWrap = calcFLI;
export const checkPSMFWrap = checkPSMF;
export const calcMenstrualWater = menstrualWaterRetention;
export const calcFiberSplit = fiberSplit;
export const calcLBMPreservation = lbmPreservationScore;
// Re-export new constants helpers for UI
export { MET_CATALOG, calcWHtR, calcABSI, calcBAI, calcTyG, calcFIB4, calcAPRI, calcQUICKI, calcSweatRate, buildHydrationPlan, calcCaffeineCurve };
export function calcMetSWrapper(p:{ waistCm:number; tgMgDl?:number; hdlMgDl?:number; systolic?:number; diastolic?:number; glucoseMgDl?:number; sex:'male'|'female' }){
  return calcMetS_ATP3(p as any);
}
export function calcWHtRWrapper(w:number,h:number){ return calcWHtR(w,h); }
export function calcABSIWrapper(w:number,h:number,weight:number){ return calcABSI(w,h,weight); }

// ——— Adaptive TDEE v2 (MacroFactor-стиль) — Hall density + trend R² ———
export interface AdaptiveTDEEResult { tdee:number; tdeeNoAT:number; trend:number; r2:number; days:number; n:number; density:number; atKcal:number; confidence:'low'|'medium'|'high'; plateau:boolean; targets:{ maintain:number; cut:number; bulk:number }; note:string; weeklySeries: Array<{days:number; trend:number; r2:number}> }
export function calcAdaptiveTDEE(params:{ weightHistory:WeightPoint[]; avgIntakeKcal:number; bodyFatPct?:number; goal?:'cut'|'maintain'|'bulk'|'health'; intakeHistory?: Array<{date:string;kcal:number}> }): AdaptiveTDEEResult | null {
  const wh=params.weightHistory; if(!wh||wh.length<7) return null;
  const density=energyDensityPerKg(params.bodyFatPct, undefined);
  const win = (n:number)=>{
    const pts=wh.slice(-n);
    if(pts.length<3) return null;
    const c=calcTrendWithConfidence(pts);
    return { ...c, pts };
  };
  const w7=win(7), w14=win(14), w21=wh.length>=21?win(21):null;
  // выбираем окно с лучшим R² где n>=7
  let best=w14;
  const candidates=[w7,w14,w21].filter(Boolean) as any[];
  // prefer R²>0.35 maximal days with R²>0.35 else 14
  const good=candidates.filter(c=>c.r2>0.35).sort((a,b)=>b.days-a.days);
  if(good.length) best=good[0];
  else if(w7 && w7.r2>0.5) best=w7;
  if(!best) best=w14!;
  // date-join: если есть intakeHistory, берём среднее за окно best.days, фильтруя по датам wh
  let intake=params.avgIntakeKcal;
  if(Array.isArray(params.intakeHistory) && params.intakeHistory.length>=5){
    const needDays=best.days || 7;
    let lastN=(params.intakeHistory as any[]).slice(-needDays);
    if(lastN[0] && typeof (lastN[0] as any).date==='string' && wh[0]?.date){
      const whStart=wh[0].date, whEnd=wh[wh.length-1].date;
      const filtered=lastN.filter((p:any)=> typeof p.date==='string' && p.date>=whStart && p.date<=whEnd);
      if(filtered.length>=3) lastN=filtered;
    }
    const filt=lastN.filter((p:any)=> typeof p.kcal==='number' && p.kcal>500 && p.kcal<8000);
    if(filt.length>=Math.min(5,needDays-1)) intake=Math.round(filt.reduce((s:number,p:any)=>s+p.kcal,0)/filt.length);
  }
  if(!intake) return null;
  const trend=best.trend; const r2=best.r2; const days=best.days; const n=best.n;
  const atKcal = trend < -0.15 ? estimateAdaptiveThermogenesis({ deficitKcal: Math.round(Math.abs(trend)*density/7), weeksInDeficit: Math.round(days/7) }) : 0;
  const tdeeNoAT = Math.round(intake - (trend*density/7));
  const tdee = Math.round(intake - (trend*density/7) - atKcal*0.3);
  let confidence: AdaptiveTDEEResult['confidence']='low';
  if(r2>0.6 && n>=10) confidence='high'; else if(r2>0.35) confidence='medium';
  const plateau = params.goal==='cut' && trend > -0.12;
  const targets={ maintain: tdee, cut: Math.round(tdee-500), bulk: Math.round(tdee+300) };
  const weeklySeries=candidates.map(c=>({days:c.days, trend:c.trend, r2:c.r2}));
  const note=plateau ? `Плато сушки: тренд ${trend}кг/нед при дефиците — адаптация ${atKcal}ккал (Trexler)` : `TDEE ~${tdee} (без AT ${tdeeNoAT}) тренд ${trend} R²${r2} плотность ${density} · цели: cut ${targets.cut}/ bulk ${targets.bulk}`;
  return { tdee, tdeeNoAT, trend, r2, days, n, density, atKcal, confidence, plateau, targets, note, weeklySeries };
}

// ——— MET-builder — честный PAL ———
export function calcMETPal(basePal:number, metHoursPerWeek?:number, standingHours?:number, fidgetLevel?:1|2|3){
  return computePalFromMet({ basePal, metHoursPerWeek, standingHours, fidgetLevel });
}
export function buildMetHours(schedule: Array<{ key:string; hours:number }>): number {
  let sum=0;
  for(const s of schedule){ const m=(MET_CATALOG as any)[s.key]?.met ?? 6; sum+=m*s.hours; }
  return Math.round(sum*10)/10;
}
export function parseWeeklyScheduleText(text:string): Array<{ key:string; hours:number }> | null {
  if(!text||typeof text!=='string') return null;
  const lower=text.toLowerCase();
  const out: Array<{key:string;hours:number}>=[];
  const add=(kw:string[], key:string)=>{
    for(const k of kw){ if(lower.includes(k)){
      // улучшено: 45мин → 0.75ч, 1.5ч, 30м, 2×
      let h=1;
      const mMin=lower.match(new RegExp(k+".*?([0-9]+[\\.,]?[0-9]*)\\s*(мин|м\\b)","i"));
      const mHour=lower.match(new RegExp(k+".*?([0-9]+[\\.,]?[0-9]*)\\s*(ч|час)","i"));
      const mMult=lower.match(new RegExp("([0-9]+)\\s*[×x]\\s*"+k,"i"));
      if(mMin){ h= Number(mMin[1].replace(',','.'))/60; }
      else if(mHour){ h= Number(mHour[1].replace(',','.')); }
      else if(mMult){ h= Number(mMult[1])*1; }
      else {
        const mAny=lower.match(new RegExp(k+".*?([0-9]+[\\.,]?[0-9]*)","i"));
        if(mAny) h=Number(mAny[1].replace(',','.'));
        if(h>10) h/=60; // 45 → 0.75ч если без единицы
      }
      out.push({key, hours: clamp(h,0.25,15)}); break;
    }}
  };
  add(['силов','кач','бб','жим','тяг'],'strength');
  add(['кроссфит','crossfit'],'crossfit');
  add(['hiit','табата'],'hiit');
  add(['бег','run'],'running_moderate');
  add(['вело','cycling','байк'],'cycling');
  add(['плав','swim'],'swimming');
  add(['ходьб','walk'],'walking');
  add(['йога','yoga'],'yoga');
  add(['пилates','пилат'],'pilates');
  return out.length?out:null;
}

// ——— RED-S CAT2-lite — screening ———
export interface RedsScreeningInput { ea:number|null; sex:'male'|'female'; leafScore?:number; rmrRatio?:number; boneFlag?:boolean; menstrualFlag?:boolean; hgb?:number }
export interface RedsScreeningResult { risk:'low'|'moderate'|'high'; color:string; score:number; flags:string[]; note:string }
export function calcRedsScreening(input:RedsScreeningInput): RedsScreeningResult {
  let score=0; const flags:string[]=[];
  if(input.ea!=null){
    const leaCut=input.sex==='female'?30:25; const optCut=input.sex==='female'?45:40;
    if(input.ea < leaCut){ score+=3; flags.push(`LEA <${leaCut}`);} else if(input.ea < optCut){ score+=1; flags.push(`EA ${leaCut}-${optCut}`);}
  }
  if(typeof input.leafScore==='number'){
    if(input.leafScore>=8){ score+=2; flags.push(`LEAF ${input.leafScore} ≥8`);} else if(input.leafScore>=4){ score+=1; flags.push(`LEAF ${input.leafScore} 4-7`);}
  }
  if(typeof input.rmrRatio==='number' && input.rmrRatio<0.90){ score+=2; flags.push(`RMR ratio ${input.rmrRatio.toFixed(2)} <0.90`);}
  if(input.boneFlag){ score+=2; flags.push('Стресс-перелом');}
  if(input.menstrualFlag){ score+=2; flags.push('Аменорея');}
  let risk:RedsScreeningResult['risk']='low'; let color='#22c55e';
  if(score>=4){ risk='high'; color='#ef4444';} else if(score>=2){ risk='moderate'; color='#f59e0b';}
  const note=risk==='high'? 'Высокий RED-S — к спортивному врачу (IOC CAT2)' : risk==='moderate'? 'Умеренный RED-S — +150-300ккал/ −EEE, контроль 2-4нед' : 'Низкий RED-S — мониторинг EA/LEEP';
  return { risk, color, score, flags, note };
}

// ——— Sweat Lab wrappers ———
export interface SweatTestInput { preKg:number; postKg:number; fluidL:number; hours:number; sodiumMgPerL?:number; weightKg?:number }
export function calcSweatTest(input:SweatTestInput){
  const rate=calcSweatRate(input.preKg,input.postKg,input.fluidL,input.hours);
  if(rate==null) return null;
  const sodium=input.sodiumMgPerL ?? 900;
  const elect=calcSweatElectrolytes(rate*1000*input.hours, sodium);
  const plan=buildHydrationPlan(rate, input.hours, sodium, input.weightKg ?? 80);
  return { rateLPerH: rate, totalLossMl: Math.round(rate*1000*input.hours), elect, plan };
}

// ——— Diet break / MATADOR ———
export function buildDietBreakPlan(totalWeeks:number, deficitWeeks:number, breakEvery?:number, breakDays?:number): Array<{ week:number; phase:'deficit'|'maintenance'; kcalDelta:number; note:string }> {
  const every=breakEvery ?? 6; const bDays=breakDays ?? 14;
  const breakWeeks=Math.round(bDays/7);
  const plan: Array<{week:number;phase:'deficit'|'maintenance';kcalDelta:number;note:string}>=[]; let w=1;
  while(w<=totalWeeks){
    for(let i=0;i<every && w<=totalWeeks;i++){ plan.push({ week:w, phase:'deficit', kcalDelta:-500, note:'Дефицит -500' }); w++; }
    for(let i=0;i<breakWeeks && w<=totalWeeks;i++){ plan.push({ week:w, phase:'maintenance', kcalDelta:0, note:'Diet break maintenance (Byrne MATADOR)' }); w++; }
    if(totalWeeks - deficitWeeks <=0) break;
  }
  return plan.slice(0,totalWeeks);
}
export function calcRefeedNeed(weeksInDeficit:number, bodyFat?:number, ea?:number|null): { needed:boolean; carbBoostPct:number; note:string } {
  const bf=bodyFat ?? 15;
  const longDeficit=weeksInDeficit>=6 && bf<15;
  const lowEA=ea!=null && ea < 30;
  const needed=longDeficit || lowEA;
  const boost=needed? 25:0;
  return { needed, carbBoostPct:boost, note: needed ? `Refeed 1×/нед +${boost}% углей (лептин/T3 Trexler)` : 'Refeed не нужен' };
}

// ——— Carb / Sodium loading (Breno Melo / peak week) ———
export function calcCarbLoading(weightKg:number, days:number, gPerKg?:number): { totalCarbG:number; dailyG:number; note:string } {
  const d = clamp(days,1,3);
  const gpk = gPerKg ?? (d===3 ? 10 : d===2 ? 8 : 6);
  const dailyG = Math.round(weightKg * clamp(gpk,5,12));
  const totalCarbG = dailyG * d;
  const note = `${d}д × ${gpk}г/кг → ${dailyG}г/сут, всего ${totalCarbG}г (Breno Melo 10-12г/кг 1-3д taper)`;
  return { totalCarbG, dailyG, note };
}
export function calcSodiumLoading(weightKg:number, days:number, sodiumGPerDay?:number): { totalSodiumG:number; dailyG:number; note:string } {
  const d = clamp(days,1,3);
  const dailyG = sodiumGPerDay ?? 5;
  const totalSodiumG = Math.round(dailyG * d *10)/10;
  return { totalSodiumG, dailyG, note: `Na ${dailyG}г/сут ×${d}д = ${totalSodiumG}г (проверь АД, не >6г/сут при гипертонии)` };
}
// ——— Body comp projection + sensitivity (theontho) ———
export function calcBodyCompProjection(input:{ weight:number; height:number; bodyFat:number; years:number; mode:'hold_bf'|'hold_weight'|'hold_ffmi' }): Array<{ year:number; weight:number; bodyFat:number; ffmi:number }> {
  const hM=input.height/100;
  const ffm0=input.weight*(1-input.bodyFat/100);
  const ffmi0=ffm0/(hM*hM)+6.1*(1.80-hM);
  const out: Array<{year:number; weight:number; bodyFat:number; ffmi:number}>=[];
  for(let y=0;y<=input.years;y++){
    if(input.mode==='hold_ffmi'){
      const ffmi=ffmi0;
      const ffm=(ffmi -6.1*(1.80-hM))*hM*hM;
      const bf=Math.max(5, Math.round((input.bodyFat - y*0.5)*10)/10);
      const weight=ffm/(1-bf/100);
      const wLow=Math.round(weight*0.95*10)/10, wHigh=Math.round(weight*1.05*10)/10;
      out.push({ year:y, weight:Math.round(weight*10)/10, bodyFat:bf, ffmi:Math.round(ffmi*10)/10, weightLow:wLow, weightHigh:wHigh, ffmiLow:Math.round((ffmi-0.6)*10)/10, ffmiHigh:Math.round((ffmi+0.6)*10)/10 } as any);
      continue;
    }
    const prog = y<=2 ? y*0.4 : 0.8 + (y-2)*0.15;
    const ffmi = Math.min(ffmi0+prog, 26.2);
    const ffm = (ffmi -6.1*(1.80-hM)) * hM*hM;
    let weight:number, bf:number;
    if(input.mode==='hold_bf'){ bf=input.bodyFat; weight=ffm/(1-bf/100); }
    else { weight=input.weight; bf=Math.max(5, (1-ffm/weight)*100); }
    const wLow=Math.round(weight*0.9*10)/10, wHigh=Math.round(weight*1.1*10)/10;
    out.push({ year:y, weight:Math.round(weight*10)/10, bodyFat:Math.round(bf*10)/10, ffmi:Math.round(ffmi*10)/10, weightLow:wLow, weightHigh:wHigh, ffmiLow:Math.round((ffmi-0.6)*10)/10, ffmiHigh:Math.round((ffmi+0.6)*10)/10 } as any);
  }
  return out as any;
}
export function calcBeverageRank(totalLossMl:number, sodiumLossMg:number): Array<{ name:string; score:number; note:string }> {
  // rank by hydration index Maughan 2016 + Na
  const lossL=totalLossMl/1000;
  const list=[
    { name:'Вода', score: 1.0, note:`${Math.round(lossL*1000)}мл, Na 0 — BHI 1.0 <60мин` },
    { name:'Изотоник 500мг/л', score: lossL>1? 1.3:1.1, note:`Na ${Math.round(sodiumLossMg)}мг, 500мг/л — BHI 1.1` },
    { name:'Изотоник 700мг/л', score: lossL>1.5? 1.5:1.2, note:'700мг/л — BHI 1.3 жарко`' },
    { name:'ORS 900мг/л', score: lossL>2? 1.6:1.0, note:'900мг/л — BHI 1.5 риск' },
    { name:'Молоко', score: 1.5, note:'BHI 1.5 — казеин + Na' },
    { name:'Кола', score: 0.9, note:'BHI 0.9 — кофеин диурез' },
  ];
  return list.sort((a,b)=>b.score-a.score);
}
export function calcLeafScore(answers: boolean[]): { score:number; risk:'low'|'moderate'|'high'; note:string } {
  const score=answers.filter(Boolean).length*2;
  const risk=score>=8?'high':score>=4?'moderate':'low';
  const note=risk==='high'?'LEAF ≥8 — высокий RED-S (Mountjoy)':risk==='moderate'?'LEAF 4-7 — умеренный':'LEAF <4 — низкий';
  return { score, risk, note };
}
// ——— TyG / FIB-4 wrappers already via calcTyG etc — exported above ———

// ═══════════ PRO v4 — Adaptive v3, CAT2, Sweat V2, MetS-добивка, DIAAS, NEAT/AT-range, One-answer ═══════════
// Источники: MacroFactor rolling-28д EMA, IOC REDs CAT2 2023, ACSM/Periard, Maughan BHI 2016,
// Kahn LAP 2005, Amato VAI 2010, FAO DIAAS 2013, Fothergill Biggest Loser 2016, IOM 2025.

/** Re-export PRO-каталога для UI без прямых импортов */
export { ACTIVITY_CATALOG_60, PROFESSION_PAL, DIAAS_TABLE, computePalFromActivity, parseWeeklyScheduleTextV2, estimateSweatRatePopulation, rankBeveragesV2 };
export type { ProfessionKind };

/** V2-парсер расписания (RU+EN, км, ×) — обёртка для UI */
export function parseWeeklyScheduleTextPro(text: string): Array<{ key: string; hours: number }> | null {
  return parseWeeklyScheduleTextV2(text) ?? parseWeeklyScheduleText(text);
}

/** Честные MET-часы по PRO-каталогу 60 */
export function buildMetHoursPro(schedule: Array<{ key: string; hours: number }>): number {
  let sum = 0;
  for (const s of schedule) {
    const m = (ACTIVITY_CATALOG_60 as any)[s.key]?.met ?? (MET_CATALOG as any)[s.key]?.met ?? 6;
    sum += m * s.hours;
  }
  return Math.round(sum * 10) / 10;
}

// ——— Adaptive TDEE v3: rolling-28д EMA + требование плотности логов + range + rate-caps ———
export interface AdaptiveTDEEv3Result {
  tdee: number; tdeeNoAT: number; low: number; high: number;
  trend: number; r2: number; days: number; n: number; density: number; atKcal: number;
  confidence: 'low' | 'medium' | 'high'; plateau: boolean;
  adherence: { logDays: number; weighIns: number; sufficient: boolean; note: string };
  targets: { maintain: number; mildCut: number; cut: number; bulk: number; leanBulk: number };
  emaSeries: Array<{ date: string; emaKg: number }>;
  note: string;
}
function emaOfWeights(pts: WeightPoint[], alpha = 0.25): Array<{ date: string; emaKg: number }> {
  const out: Array<{ date: string; emaKg: number }> = [];
  let ema = pts[0]?.kg ?? 0;
  for (let i = 0; i < pts.length; i++) {
    ema = i === 0 ? pts[i].kg : alpha * pts[i].kg + (1 - alpha) * ema;
    out.push({ date: pts[i].date, emaKg: Math.round(ema * 100) / 100 });
  }
  return out;
}
export function calcAdaptiveTDEEv3(params: {
  weightHistory: WeightPoint[]; avgIntakeKcal: number; bodyFatPct?: number;
  goal?: 'cut' | 'maintain' | 'bulk' | 'health';
  intakeHistory?: Array<{ date: string; kcal: number }>;
  logDays?: number; // дней с логом питания в окне (MacroFactor требует ≥5/нед)
}): AdaptiveTDEEv3Result | null {
  const wh = (params.weightHistory || []).filter((p) => typeof p?.kg === 'number' && isFinite(p.kg) && p.kg > 20 && p.kg < 400);
  if (!wh || wh.length < 7) return null;
  const density = energyDensityPerKg(params.bodyFatPct, undefined);
  // rolling-28д окно (MacroFactor): берём до 28 точек, EMA-сглаживание воды
  const pts = wh.slice(-28);
  const emaSeries = emaOfWeights(pts);
  const emaPts = emaSeries.map((e) => ({ date: e.date, kg: e.emaKg }));
  const win = (n: number): { trend: number; r2: number; n: number; days: number } | null => {
    const s = emaPts.slice(-n);
    if (s.length < 3) return null;
    return calcTrendWithConfidence(s as any);
  };
  const cands = [win(7), win(14), win(21), win(28)].filter(Boolean) as Array<{ trend: number; r2: number; n: number; days: number }>;
  if (!cands.length) return null;
  const good = cands.filter((c) => c.r2 > 0.35).sort((a, b) => b.days - a.days);
  const best = good.length ? good[0] : cands.sort((a, b) => b.r2 - a.r2)[0];
  let intake = params.avgIntakeKcal;
  if (Array.isArray(params.intakeHistory) && params.intakeHistory.length >= 5) {
    const needDays = best.days || 14;
    const lastN = (params.intakeHistory as any[]).slice(-needDays).filter((p: any) => typeof p.kcal === 'number' && p.kcal > 500 && p.kcal < 8000);
    if (lastN.length >= Math.min(5, needDays - 1)) intake = Math.round(lastN.reduce((s: number, p: any) => s + p.kcal, 0) / lastN.length);
  }
  if (!intake) return null;
  const atKcal = best.trend < -0.15 ? estimateAdaptiveThermogenesis({ deficitKcal: Math.round(Math.abs(best.trend) * density / 7), weeksInDeficit: Math.round(best.days / 7) }) : 0;
  const tdeeNoAT = Math.round(intake - (best.trend * density / 7));
  const tdee = Math.round(intake - (best.trend * density / 7) - atKcal * 0.3);
  const low = Math.round(tdee * 0.88); const high = Math.round(tdee * 1.12); // DLW Westerterp
  let confidence: AdaptiveTDEEv3Result['confidence'] = 'low';
  if (best.r2 > 0.6 && best.n >= 10) confidence = 'high'; else if (best.r2 > 0.35) confidence = 'medium';
  const logDays = params.logDays ?? params.intakeHistory?.length ?? 0;
  const weighIns = pts.length;
  const sufficient = logDays >= 10 && weighIns >= 10 && best.r2 > 0.35;
  if (!sufficient && confidence === 'high') confidence = 'medium'; // MacroFactor: без плотности логов high нельзя
  const plateau = params.goal === 'cut' && best.trend > -0.12;
  // Rate-caps Helms: cut 0.5–1%/нед уже в целях; цели диапазоном
  const targets = { maintain: tdee, mildCut: Math.round(tdee - 250), cut: Math.round(tdee - 500), bulk: Math.round(tdee + 300), leanBulk: Math.round(tdee + 250) };
  const adherence = {
    logDays, weighIns, sufficient,
    note: sufficient ? `Логов достаточно (${logDays}д питания, ${weighIns} взвешиваний)` : `Нужно ≥10 логов питания + ≥10 взвешиваний за 28д (сейчас ${logDays}/${weighIns}) — иначе формула, не адаптив`,
  };
  const note = plateau
    ? `Плато сушки v3: тренд ${best.trend}кг/нед (EMA ${pts.length} точек, R²${best.r2}) — AT ${atKcal}ккал · ${adherence.note}`
    : `Adaptive v3: TDEE ~${tdee} [${low}–${high} DLW] тренд ${best.trend} R²${best.r2} EMA ${pts.length} точек · cut ${targets.cut}/ bulk ${targets.bulk} · ${adherence.note}`;
  return { tdee, tdeeNoAT, low, high, trend: best.trend, r2: best.r2, days: best.days, n: best.n, density, atKcal, confidence, plateau, adherence, targets, emaSeries, note };
}

// ——— RED-S CAT2 PRO: Step1 LEAM-Q + EDE-Q, Step2 severity traffic-light, Step3 return-to-play ———
export function calcLeamScore(answers: boolean[]): { score: number; risk: 'low' | 'moderate' | 'high'; note: string } {
  const score = answers.filter(Boolean).length * 2; // 6 вопросов ×2 = 0–12 (Lundy LEAM-Q lite)
  const risk = score >= 8 ? 'high' : score >= 4 ? 'moderate' : 'low';
  return { score, risk, note: risk === 'high' ? 'LEAM ≥8 — высокий RED-S у мужчин (Lundy 2022)' : risk === 'moderate' ? 'LEAM 4–7 — умеренный' : 'LEAM <4 — низкий' };
}
export interface RedsCAT2Input {
  ea: number | null; sex: 'male' | 'female';
  leafScore?: number; leamScore?: number; edeScore?: number; // EDE-Q 0–6
  rmrRatio?: number; boneFlag?: boolean; menstrualFlag?: boolean;
  lowTestosterone?: boolean; lowBMD?: boolean; ferritinLow?: boolean; t3Low?: boolean;
}
export interface RedsCAT2Result {
  light: 'green' | 'yellow' | 'orange' | 'red'; color: string;
  primary: number; secondary: number; flags: string[]; note: string; returnToPlay: string;
}
export function calcRedsCAT2(input: RedsCAT2Input): RedsCAT2Result {
  let primary = 0; let secondary = 0; const flags: string[] = [];
  const leaCut = input.sex === 'female' ? 30 : 25;
  if (input.ea != null) {
    if (input.ea < leaCut) { primary += 1; flags.push(`LEA ${input.ea}<${leaCut} (primary)`); }
    else if (input.ea < (input.sex === 'female' ? 45 : 40)) { secondary += 1; flags.push('EA снижена (secondary)'); }
  }
  if (typeof input.leafScore === 'number' && input.leafScore >= 8) { primary += 1; flags.push(`LEAF ${input.leafScore}≥8 (primary)`); }
  else if (typeof input.leafScore === 'number' && input.leafScore >= 4) { secondary += 1; flags.push('LEAF 4–7 (secondary)'); }
  if (typeof input.leamScore === 'number' && input.leamScore >= 8) { primary += 1; flags.push(`LEAM ${input.leamScore}≥8 (primary)`); }
  else if (typeof input.leamScore === 'number' && input.leamScore >= 4) { secondary += 1; flags.push('LEAM 4–7 (secondary)'); }
  if (typeof input.edeScore === 'number' && input.edeScore >= 4) { primary += 1; flags.push(`EDE-Q ${input.edeScore}≥4 (primary)`); }
  else if (typeof input.edeScore === 'number' && input.edeScore >= 2) { secondary += 1; flags.push('EDE-Q 2–4 (secondary)'); }
  if (typeof input.rmrRatio === 'number' && input.rmrRatio < 0.90) { primary += 1; flags.push(`RMR ratio ${input.rmrRatio.toFixed(2)}<0.90 (primary)`); }
  if (input.menstrualFlag) { primary += 1; flags.push('Аменорея >3мес (primary)'); }
  if (input.boneFlag) { primary += 1; flags.push('Стресс-перелом (primary)'); }
  if (input.lowBMD) { primary += 1; flags.push('BMD T<−1 (primary)'); }
  if (input.lowTestosterone) { primary += 1; flags.push('Тесто низкое (primary M)'); }
  if (input.ferritinLow) { secondary += 1; flags.push('Ферритин <30 (secondary)'); }
  if (input.t3Low) { secondary += 1; flags.push('T3 низ (secondary)'); }
  const score = primary * 2 + secondary;
  let light: RedsCAT2Result['light'] = 'green';
  if (primary >= 2 || score >= 6) light = 'red';
  else if (primary >= 1 || score >= 3) light = 'orange';
  else if (score >= 1) light = 'yellow';
  const color = light === 'red' ? '#ef4444' : light === 'orange' ? '#f97316' : light === 'yellow' ? '#f59e0b' : '#22c55e';
  const note = light === 'red' ? `🔴 CAT2 red: primary ${primary}, secondary ${secondary} — стоп спорт, к врачу (IOC CAT2)` : light === 'orange' ? `🟠 CAT2 orange: primary ${primary} — +300–500ккал/−EEE, контроль 2–4нед, врач` : light === 'yellow' ? `🟡 CAT2 yellow: мониторинг EA/LEAF, повтор через 4нед` : '🟢 CAT2 green — мониторинг';
  const returnToPlay = light === 'red' ? 'Отстранение до заключения врача (CAT2 Step3)' : light === 'orange' ? 'Ограничение объёма −30%, еженедельный вес/LEAF' : light === 'yellow' ? 'Полный допуск + мониторинг' : 'Полный допуск';
  return { light, color, primary, secondary, flags, note, returnToPlay };
}

// ——— Sweat V2: популяция + акклиматизация + BHI ———
export function calcSweatTestV2(input: { preKg?: number; postKg?: number; fluidL?: number; hours: number; sodiumMgPerL?: number; weightKg?: number; intensity?: 'easy' | 'moderate' | 'hard'; environment?: 'cool' | 'temperate' | 'hot' | 'hot_humid'; acclimated?: boolean }): { rateLPerH: number; measured: boolean; totalLossMl: number; elect: { sodiumMg: number; chlorideMg: number; potassiumMg: number; magnesiumMg: number }; plan: ReturnType<typeof buildHydrationPlan>; rangeNote: string } | null {
  const sodium = input.sodiumMgPerL ?? 900;
  const accl = input.acclimated ? 0.6 : 1; // Periard: [Na] −40% при акклиматизации
  const sodiumAdj = Math.round(sodium * accl);
  if (typeof input.preKg === 'number' && typeof input.postKg === 'number' && typeof input.fluidL === 'number') {
    const r = calcSweatTest({ preKg: input.preKg, postKg: input.postKg, fluidL: input.fluidL, hours: input.hours, sodiumMgPerL: sodiumAdj, weightKg: input.weightKg ?? 80 });
    if (!r) return null;
    return { ...r, measured: true as const, elect: { ...r.elect }, rangeNote: `Измеренный (Baker): ${r.rateLPerH} л/ч · Na ${sodiumAdj}мг/л${input.acclimated ? ' (акклиматизация −40% Na)' : ''}` };
  }
  const est = estimateSweatRatePopulation({ intensity: input.intensity ?? 'moderate', environment: input.environment ?? 'temperate', weightKg: input.weightKg ?? 80, acclimated: input.acclimated });
  const elect = calcSweatElectrolytes(est.rateLPerH * 1000 * input.hours, sodiumAdj);
  const plan = buildHydrationPlan(est.rateLPerH, input.hours, sodiumAdj, input.weightKg ?? 80);
  return { rateLPerH: est.rateLPerH, measured: false, totalLossMl: Math.round(est.rateLPerH * 1000 * input.hours), elect, plan, rangeNote: `${est.note} · Na ${sodiumAdj}мг/л` };
}
export function calcBeverageRankV2(totalLossMl: number, sodiumLossMg: number, durationH = 1): Array<{ name: string; bhi: number; score: number; note: string }> {
  return rankBeveragesV2(totalLossMl / 1000, durationH, Math.round(sodiumLossMg / Math.max(0.2, totalLossMl / 1000))).map((b) => ({ name: b.name, bhi: b.bhi, score: b.score, note: b.note }));
}

// ——— MetS-добивка PRO ———
export const calcTGHDLWrap = calcTG_HDL;
export function calcLAPWrap(waistCm: number, tgMgDl?: number, sex: 'male' | 'female' = 'male'): number | null { return calcLAP(waistCm, tgMgDl, sex); }
export function calcVAIWrap(p: { waistCm: number; bmi: number; tgMgDl?: number; hdlMgDl?: number; sex: 'male' | 'female' }): number | null { return calcVAI(p as any); }
export function calcFMIWrap(weight: number, bodyFat: number, height: number): number | null {
  const fatMass = weight * (bodyFat / 100);
  return calcFMI(fatMass, height);
}
/** Алко-хроника: units/нед → FLI/EA/HOMA-связка (WHO порог 14 units/нед) */
export function calcAlcoholChronic(alcoholGPerDay?: number, daysPerWeek?: number): { unitsPerWeek: number; risk: 'low' | 'moderate' | 'high'; note: string } {
  const g = Math.max(0, alcoholGPerDay ?? 0); const d = Math.max(0, Math.min(7, daysPerWeek ?? (g > 0 ? 2 : 0)));
  const units = Math.round(((g * d) / 8) * 10) / 10; // UK unit 8г
  const risk = units >= 14 ? 'high' : units >= 7 ? 'moderate' : 'low';
  const note = risk === 'high' ? `Алко-хроника ${units} units/нед ≥14 WHO — FLI↑, MPS↓, сон↓, EA↓ (Suter + Bedogni)` : risk === 'moderate' ? `Алко ${units} units/нед — граница, ≤1б/нед без трени` : 'Алко-хроника низкая';
  return { unitsPerWeek: units, risk, note };
}

// ——— Белок DIAAS PRO + возраст 60+ ———
export function calcProteinTimingPro(totalProteinG: number, weightKg: number, mealsPerDay = 4, proteinSource: string = 'mixed', age = 30): { perMeal: number; perMealGPerKg: number; leucinePerMeal: number; leucThreshold: number; ceiling: number; preSleepG: number; diaas: number; note: string } {
  const src = (DIAAS_TABLE as any)[proteinSource] ?? (DIAAS_TABLE as any).mixed;
  const aged = age >= 60; // анаболическая резистентность: 0.60г/кг/приём (Moore 2015)
  const perMeal = totalProteinG > 0 ? Math.round(totalProteinG / mealsPerDay) : 0;
  const perMealGPerKg = weightKg > 0 ? Math.round((perMeal / weightKg) * 100) / 100 : 0;
  const leucinePerMeal = Math.round(perMeal * src.leucPerG * 10) / 10;
  const leucThreshold = 2.5;
  const ceiling = aged ? 0.60 : 0.55;
  const preSleepG = weightKg >= 90 ? 40 : 35;
  const over = perMealGPerKg > ceiling;
  const note = leucinePerMeal >= 2.2 && !over
    ? `MPS ок PRO (${leucinePerMeal}г leuc DIAAS ${src.diaas}, ${perMealGPerKg}г/кг ≤${ceiling}) — ${src.label}`
    : over ? `Перебор ${perMealGPerKg}г/кг >${ceiling} waste — ${mealsPerDay + 1} приёмов по ~${Math.round(totalProteinG / (mealsPerDay + 1))}г · ${src.label}` : `Мало leuc ${leucinePerMeal}г <2.5г — ${src.label}, бленд/сыворотка`;
  return { perMeal, perMealGPerKg, leucinePerMeal, leucThreshold, ceiling, preSleepG, diaas: src.diaas, note };
}

// ——— NEAT V2 (профессия) + AT-range + reverse-auto ———
export function calcNEATPro(input: { weight: number; profession?: ProfessionKind; standingHours?: number; fidgetLevel?: 1 | 2 | 3; steps?: number; height?: number }): { sitting: number; standing: number; fidget: number; walking: number; profession: number; total: number; note: string } {
  const prof = (input.profession && PROFESSION_PAL[input.profession] ? Math.round((PROFESSION_PAL[input.profession] - 1.40) * 1800) : 120);
  const standing = Math.round((input.standingHours ?? 0) * 40);
  const fidget = input.fidgetLevel === 3 ? 90 : input.fidgetLevel === 1 ? -40 : 0;
  const walking = input.steps ? Math.round(input.steps * 0.04 * (input.weight / 70)) : 0;
  const sitting = Math.max(80, prof);
  const total = Math.max(80, sitting + standing + fidget + walking);
  return { sitting, standing, fidget, walking, profession: prof, total, note: `NEAT PRO Levine+FAO: профессия ${prof} + стоя +${standing} + fidget ${fidget} + ходьба ${walking} = ${total}ккал` };
}
/** AT диапазоном 5–15% (MacroBalanceLab), не точкой + Biggest Loser персист */
export function calcATRange(input: { tdee: number; deficitKcal?: number; weeksInDeficit?: number; weightLostKg?: number }): { low: number; mid: number; high: number; persistent: number; note: string } {
  const base = estimateAdaptiveThermogenesis({ deficitKcal: input.deficitKcal, weeksInDeficit: input.weeksInDeficit, weightLostKg: input.weightLostKg });
  const low = Math.round(Math.max(0, input.tdee * 0.05));
  const high = Math.round(input.tdee * 0.15);
  const mid = Math.max(base, Math.round((low + high) / 2 * 0.4));
  const persistent = (input.weeksInDeficit ?? 0) >= 12 ? Math.round(mid * 0.6) : 0; // Fothergill: часть держится годами
  return { low, mid: Math.min(high, mid), high, persistent, note: `AT диапазон 5–15% TDEE: ${low}–${high}ккал, оценка ${Math.min(high, mid)}${persistent ? ` · персист ~${persistent} (Biggest Loser)` : ''} (Trexler/Fothergill)` };
}
/** Reverse-auto: шаг по trend (а не фикс +100) */
export function calcReverseDietAuto(currentKcal: number, targetKcal: number, trendKgPerWeek = 0): Array<{ week: number; kcal: number; note: string }> {
  const step = trendKgPerWeek < -0.3 ? 150 : trendKgPerWeek > 0.2 ? 60 : 100; // быстрый набор — медленнее
  return reverseDietPlan(currentKcal, targetKcal, step, 7);
}

// ——— Goal timeline V2: rate-caps Helms + diet-break вставка ———
export function calcGoalTimelineV2(input: { weight: number; targetWeight: number; tdee: number; bodyFat?: number; withDietBreaks?: boolean }): { days: number; kcalDiff: number; weeks: number; rateNote: string; note: string; model: string } | null {
  const base = calcGoalTimeline(input as any);
  if (!base) return null;
  const diff = input.targetWeight - input.weight;
  const pctPerWeek = Math.abs(diff) / input.weight / (base.days / 7) * 100;
  const capNote = diff < 0
    ? (pctPerWeek > 1 ? '⚠ >1%/нед — агрессивно, LBM-риск (Helms: 0.5–1%)' : 'Темп 0.5–1%/нед ок (Helms)')
    : (pctPerWeek > 0.5 ? '⚠ >0.5%/нед — жир-набор (Helms: 0.25–0.5%)' : 'Темп 0.25–0.5%/нед ок (Helms)');
  let days = base.days;
  let extra = '';
  if (input.withDietBreaks && base.days > 42) {
    const breaks = Math.floor(base.days / 56); // каждые 8нед ×2нед maintenance
    days += breaks * 14 * 0.35; // break замедляет на ~35% своего времени
    extra = ` · diet-break +${Math.round(breaks * 14 * 0.35)}д (${breaks}×2нед MATADOR)`;
  }
  return { days: Math.round(days), kcalDiff: base.kcalDiff, weeks: Math.round(days / 7), rateNote: capNote, note: `${base.note}${extra} · ${capNote}`, model: `${(base as any).model} + Helms caps` };
}

// ——— One-answer PRO + diff сценариев + беременность ———
export function pregnancyAdd(input: MetabolicInput): number {
  return pregnancyTDEEAdd({ trimester: (input as any).trimester, lactating: (input as any).lactating ?? null });
}
export interface OneAnswerPro { tdee: number; low: number; high: number; water: number; ea: number | null; tdeeSource: 'adaptive-v3' | 'formula'; targets: { maintain: number; mildCut: number; cut: number; bulk: number }; note: string }
export function buildOneAnswerPro(params: { formulaTDEE: number; adaptiveV3?: AdaptiveTDEEv3Result | null; waterMl: number; ea: number | null; pregnancyAddKcal?: number }): OneAnswerPro {
  const tdeeBase = params.adaptiveV3?.tdee ?? params.formulaTDEE;
  const tdee = tdeeBase + (params.pregnancyAddKcal ?? 0);
  const low = Math.round(tdee * 0.88); const high = Math.round(tdee * 1.12);
  const targets = { maintain: tdee, mildCut: Math.round(tdee - 250), cut: Math.round(tdee - 500), bulk: Math.round(tdee + 300) };
  return { tdee, low, high, water: params.waterMl, ea: params.ea, tdeeSource: params.adaptiveV3 ? 'adaptive-v3' : 'formula', targets, note: `TDEE ${tdee} [${low}–${high} DLW] via ${params.adaptiveV3 ? `adaptive-v3 R²${params.adaptiveV3.r2} ${params.adaptiveV3.confidence}` : 'формула'} · cut ${targets.cut} / bulk ${targets.bulk}` };
}
export function diffMetabolicSnapshots(a: Record<string, any>, b: Record<string, any>): Array<{ key: string; a: any; b: any; delta: number | null }> {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const out: Array<{ key: string; a: any; b: any; delta: number | null }> = [];
  for (const k of keys) {
    if (typeof a[k] === 'number' && typeof b[k] === 'number') {
      const d = Math.round((b[k] - a[k]) * 100) / 100;
      if (d !== 0) out.push({ key: k, a: a[k], b: b[k], delta: d });
    } else if (JSON.stringify(a[k]) !== JSON.stringify(b[k]) && (typeof a[k] === 'number' || typeof b[k] === 'number' || typeof a[k] === 'string' || typeof b[k] === 'string')) {
      out.push({ key: k, a: a[k], b: b[k], delta: null });
    }
  }
  return out.slice(0, 24);
}
