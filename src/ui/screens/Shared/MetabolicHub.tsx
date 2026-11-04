/** MetabolicHub.tsx — единый хаб Метаболики PRO v5.
 *
 *  Структура (аудит 2026-11): режим → сводка → «чего не хватает» → мастер из
 *  4 шагов → сгруппированные калькуляторы → действия. Ввод больше не перемешан
 *  с результатами: все поля живут в мастере, все ответы — под селектором.
 *
 *  Вода · Шаги · КБЖУ · Жир · StressLoad · Кровь · EA · Алко · Белок · Поиск ·
 *  NEAT · AT · Thyroid/HOMA · Пот · MetS · Diet break — один снапшот, натурал/ААС.
 *  PRO: Adaptive v3 rolling-28д EMA + MET-60 + профессия + CAT2 + LEAM/EDE-Q +
 *  BHI + TG/HDL/LAP/VAI/FMI + DIAAS + AT-range + reverse-auto + IOM беременность.
 *  Evidence A/B/C/E бейджи + DLW band ±12% Westerterp.
 *  Канон — Питание, алиас — Тренировки/Интеллект.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, calcStressLoad, calcHematology, calcEnergyAvailability, calcAlcohol, calcMaintenanceFinder, calcAdaptiveThermogenesis, calcThyroidImpact, calcHomaIRWrap, IR_MARKERS_SHARED_INPUT_NOTE, calcLipid, calcFLIWrap, checkPSMFWrap, calcMenstrualWater, calcFiberSplit, calcLBMPreservation, calcTyG, calcMetSWrapper, calcFIB4, calcAPRI, calcQUICKI, calcWHtR, calcABSI, calcBAI, calcCaffeineCurve, buildDietBreakPlan, calcRefeedNeed, calcCarbLoading, calcSodiumLoading, calcBodyCompProjection, calcLeafScore, calcAdaptiveTDEEv3, calcLeamScore, calcRedsCAT2, calcSweatTestV2, calcBeverageRankV2, calcTGHDLWrap, calcLAPWrap, calcVAIWrap, calcFMIWrap, calcAlcoholChronic, calcProteinTimingPro, calcNEATPro, calcATRange, calcReverseDietAuto, calcGoalTimelineV2, calcDeadlineFeasibility, weeklyExerciseEnergy, buildOneAnswerPro, diffMetabolicSnapshots, parseWeeklyScheduleTextPro, buildMetHoursPro, pregnancyAdd, calcPALPro, AAS_EXPERIMENTAL_NOTE, type MetabolicInput } from '../../../engines/metabolic-hub.engine';
import { boerLeanBodyMass, bmrMethodLabel } from '../../../core/metabolic-constants';
import { ACTIVITY_CATALOG_60, PROFESSION_PAL } from '../../../core/activity-catalog';
import { getProfile, updateProfile } from '../../../core/profile-manager';
import { getNutritionV2Data } from '../../../core/nutrition-v2-data';
import { readDiaryV2, onDiaryChangeV2 } from '../NutritionScreen_parts/diary-storage-v2';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { PopupSelect, PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';
import { ModernHero } from '../NutritionScreen_parts/nutrition-modern-kit';
import { printPlanHtml, shareOrCopyText, downloadCoachFile } from '../NutritionScreen_parts/IndividualPlan/planner-day-print';
import { MH_CARD, MhSection, MhGrid, MhNum, MhToggle, MhTile, MhBar, MhEmaChart } from './metabolic-hub.parts';

const CARD: React.CSSProperties = MH_CARD;

type Mode = 'water'|'steps'|'kbju'|'fat'|'cortisol'|'hematology'|'ea'|'alcohol'|'protein'|'maintenance'|'neat'|'at'|'thyroid'|'sweat'|'mets'|'break';
const MODE_DEFS: Array<{m:Mode; label:string; icon:string; desc:string; accent:string; hint:string; evidence:string}> = [
  {m:'water', label:'Вода', icon:'💧', desc:'Суточная норма', accent:'#38bdf8', hint:'IOM 35/33/30 + Baker Na/Cl/K/Mg', evidence:'A (EFSA/IOM) + B (Baker)'},
  {m:'steps', label:'Шаги', icon:'👟', desc:'Сколько шагов до цели', accent:'#22c55e', hint:'FAO PAL 1.40-1.95 + MET → TDEE DLW ±12%', evidence:'B (FAO/Levine) + C (DLW)'},
  {m:'kbju', label:'КБЖУ', icon:'🍽', desc:'Калории и макро', accent:'#f59e0b', hint:'Helms/ISSN + TEF инфо + лютеин + thyroid', evidence:'A (Helms/ISSN) B (Westerterp)'},
  {m:'fat', label:'Жир', icon:'🧬', desc:'% жира, FFMI', accent:'#a78bfa', hint:'Navy/JP/Durnin/BIA + FFMI 26.2 Helms', evidence:'B (Hodgdon/JP)'},
  {m:'cortisol', label:'Stress', icon:'🧠', desc:'Stress Load', accent:'#f43f5e', hint:'Screening SLI 0-100 (не кортизол)', evidence:'E (эвристика) ⚠️'},
  {m:'hematology', label:'Кровь', icon:'🩸', desc:'Гематокрит', accent:'#ef4444', hint:'ESC 48/51/54 + донация', evidence:'B (ESC/ASA)'},
  {m:'ea', label:'EA', icon:'🔋', desc:'Energy Avail.', accent:'#06b6d4', hint:'IOC RED-S: (EI-EEE)/FFM net', evidence:'A (Loucks/Mountjoy)'},
  {m:'alcohol', label:'Алко', icon:'🍺', desc:'Этанол', accent:'#f97316', hint:'Suter 15% TEF + блок жира', evidence:'C (Suter)'},
  {m:'protein', label:'Белок', icon:'🥚', desc:'Лейцин и приёмы', accent:'#84cc16', hint:'Morton 0.40г/кг + pre-sleep 35г', evidence:'A (Morton/Res)'},
  {m:'maintenance', label:'Поиск нормы', icon:'🎯', desc:'TDEE по факту', accent:'#eab308', hint:'Hall density + AT Trexler → TDEE', evidence:'A (Hall) B (Trexler)'},
  {m:'neat', label:'NEAT', icon:'🪑', desc:'Бытовая активность', accent:'#14b8a6', hint:'Levine 2002: стоя/fidget/ходьба', evidence:'B (Levine)'},
  {m:'at', label:'AT', icon:'🔥', desc:'Адаптация', accent:'#f97316', hint:'Trexler AT + MATADOR reverse', evidence:'B (Trexler/Byrne)'},
  {m:'thyroid', label:'Щитовидка', icon:'🦋', desc:'Thyroid/HOMA', accent:'#8b5cf6', hint:'Kim FT4 + HOMA-IR Wallace', evidence:'B (Kim/Wallace)'},
  {m:'sweat', label:'Пот', icon:'💦', desc:'Пот-тест', accent:'#06b6d4', hint:'Baker sweat rate + электролиты + бутылки', evidence:'B (Baker/ACSM)'},
  {m:'mets', label:'MetS', icon:'🧪', desc:'Метабол. синдром', accent:'#f43f5e', hint:'TyG + MetS ATP3 + FIB-4 + QUICKI', evidence:'B (Bedogni)'},
  {m:'break', label:'Diet break', icon:'🔄', desc:'Refeed / MATADOR', accent:'#8b5cf6', hint:'MATADOR + refeed', evidence:'B (Byrne/Trexler)'},
];

/** Группы калькуляторов — чтобы 16 режимов не были одной стеной пилюль. */
const MODE_GROUPS: Array<{ id: string; title: string; icon: string; accent: string; modes: Mode[] }> = [
  { id: 'energy', title: 'Энергия', icon: '⚡', accent: '#22c55e', modes: ['maintenance', 'steps', 'neat', 'at', 'break'] },
  { id: 'body', title: 'Тело и вода', icon: '💧', accent: '#38bdf8', modes: ['water', 'fat', 'sweat', 'hematology'] },
  { id: 'food', title: 'Питание', icon: '🍽', accent: '#f59e0b', modes: ['kbju', 'protein', 'alcohol'] },
  { id: 'health', title: 'Здоровье', icon: '🩺', accent: '#f43f5e', modes: ['ea', 'cortisol', 'thyroid', 'mets'] },
];
const GROUP_OF: Record<Mode, string> = MODE_GROUPS.reduce((acc, g) => {
  for (const m of g.modes) acc[m] = g.id;
  return acc;
}, {} as Record<Mode, string>);
const GOAL_LABEL: Record<'cut' | 'maintain' | 'bulk' | 'health', string> = {
  cut: 'Сушка', maintain: 'Поддержание', bulk: 'Масса', health: 'Здоровье',
};
/**
 * Человеческие подписи для diff сценариев.
 * Аудит 2026-11: список покрывал 29 из ~90 ключей снапшота, поэтому сравнение
 * показывало сырые camelCase (`glucoseMgDl`, `useMeasuredSweat`, `hct`).
 * Guard: `metabolic-hub-structure.test.tsx` проверяет, что подпись есть у КАЖДОГО
 * ключа снапшота.
 */
const SNAP_LABEL: Record<string, string> = {
  weight: 'вес', height: 'рост', age: 'возраст', sex: 'пол', bodyFat: '% жира',
  neck: 'шея', waist: 'талия', hip: 'бёдра', steps: 'шаги', cardioMin: 'кардио мин/нед',
  trainingDays: 'трен/нед', activityLevel: 'бытовая активность', profession: 'профессия',
  goal: 'цель', stress: 'стресс 1–10', sleepHours: 'сон, ч', sleepQuality: 'качество сна',
  onAAS: 'ААС', aasDose: 'доза ААС', climate: 'климат', humidity: 'влажность, %',
  standingHours: 'стоя, ч/сут', fidgetLevel: 'непоседливость', sweatRate: 'пот, мл/ч',
  sweatSodium: 'Na пота, мг/л', alcoholG: 'алкоголь, г/нед', alcoholDays: 'дней с алкоголем',
  caffeineMg: 'кофеин, мг', tsh: 'ТТГ', ft4: 'св. Т4', glucoseMgDl: 'глюкоза, мг/дл',
  insulinMuMl: 'инсулин, мкЕд/мл', skinfoldSum3: 'сумма 3 складок', skinfoldSum4: 'сумма 4 складок',
  biaResistance: 'BIA, Ом', deficitKcal: 'дефицит, ккал', weeksInDeficit: 'нед в дефиците',
  weightLostKg: 'потеряно кг', creatineUse: 'креатин', weeklyVolumeTons: 'тоннаж, т/нед',
  targetWeight: 'цель вес', weeksToGoal: 'срок, нед', menstrualPhase: 'фаза цикла',
  sfaG: 'насыщ. жиры, г', tgMgDl2: 'ТГ, мг/дл', ggt: 'ГГТ', hct: 'гематокрит, %',
  hgb: 'гемоглобин, г/л', ferritin: 'ферритин, нг/мл', gfr: 'СКФ, мл/мин',
  waterL: 'вода, л/сут', sodiumG: 'натрий, г', potassiumG: 'калий, г',
  metHoursPerWeek: 'MET-ч/нед', leafScore: 'LEAF (0–3)', leafAnswers: 'ответы LEAF',
  leamAnswers: 'ответы LEAM', measuredRMR: 'измеренный RMR, ккал', boneFlag: 'стресс-перелом',
  menstrualFlag: 'нарушение цикла', preKg: 'вес до, кг', postKg: 'вес после, кг',
  fluidL: 'выпито, л', sweatHours: 'длит. теста, ч', hdlMgDl: 'ЛПВП, мг/дл',
  systolic: 'САД', diastolic: 'ДАД', ast: 'АСТ', alt: 'АЛТ', plt: 'тромбоциты, тыс',
  caffeineHoursSince: 'кофеин, ч назад', trimester: 'триместр', lactating: 'лактация',
  ethnicity: 'этничность', postBariatric: 'бариатрия', untreatedHypo: 'нелеч. гипотиреоз',
  acclimated: 'акклиматизация', proteinSource: 'источник белка', proteinMeals: 'приёмов белка',
  edeScore: 'EDE-Q', lowT: 'низкий тестостерон', lowBMD: 'низкая МПК', t3Low: 'низкий Т3',
  sweatIntensity: 'интенсивность пота', sweatEnv: 'среда для пота', compareIds: 'выбранные сценарии',
  fiberG: 'клетчатка, г', omega3G: 'омега-3, г', scheduleText: 'расписание тренировок',
  carbLoadDays: 'дней углеводной загрузки', carbGPerKg: 'угли, г/кг',
  sodiumLoadDays: 'дней Na-загрузки', sodiumGPerDay: 'Na, г/сут',
  projectionYears: 'горизонт, лет', projectionMode: 'режим прогноза',
  useMeasuredSweat: 'пот-тест',
  manualLabs: 'лабы введены руками',
};

/** Значения-перечисления → по-русски (иначе diff печатал `cut → bulk`). */
const SNAP_ENUM: Record<string, Record<string, string>> = {
  sex: { male: 'муж', female: 'жен' },
  goal: GOAL_LABEL,
  activityLevel: { low: 'низкая', medium: 'средняя', high: 'высокая' },
  profession: { auto: 'по бытовой', sedentary: 'сидячая 1.40', standing: 'на ногах 1.55', physical: 'физическая' },
  climate: { temperate: 'умеренный', hot: 'жара', cold: 'холод' },
  sweatIntensity: { easy: 'лёгкая', moderate: 'средняя', hard: 'тяжёлая' },
  sweatEnv: { cool: 'прохладно', temperate: 'умеренно', hot: 'жара', hot_humid: 'жара + влажно' },
  menstrualPhase: { none: 'нет', follicular: 'фолликулярная', luteal: 'лютеиновая' },
  lactating: { none: 'нет', exclusive: 'исключительная', mixed: 'смешанная' },
  ethnicity: { european: 'европейская', african: 'африканская', east_asian: 'восточноазиатская' },
  proteinSource: { mixed: 'смешанный', whey: 'whey', milk: 'молочный', egg: 'яйцо', beef: 'говядина', plant: 'растительный' },
  projectionMode: { hold_bf: 'BF const', hold_weight: 'вес const', hold_ffmi: 'FFMI const' },
};

/** Булевы поля diff: «вкл/выкл» мало что говорит, даём смысл по ключу. */
const SNAP_BOOL: Record<string, [string, string]> = {
  useMeasuredSweat: ['взвешивание', 'оценка'],
  onAAS: ['да', 'нет'],
  creatineUse: ['да', 'нет'],
  acclimated: ['да', 'нет'],
  postBariatric: ['да', 'нет'],
  untreatedHypo: ['да', 'нет'],
  boneFlag: ['есть', 'нет'],
  menstrualFlag: ['есть', 'нет'],
  lowT: ['низкий', 'норма'],
  lowBMD: ['низкая', 'норма'],
  t3Low: ['низкий', 'норма'],
};

/** Все лабы, которые хаб умеет подтягивать/помечать как ручные (ключи valuesRef и apply). */
const LAB_KEYS = ['hct', 'hgb', 'ferritin', 'gfr', 'hdlMgDl', 'ast', 'alt', 'plt', 'tgMgDl2', 'glucoseMgDl', 'insulinMuMl', 'tsh', 'ft4'] as const;

/** Значение поля снапшота для показа в diff. */
function snapValue(key: string, v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') {
    const pair = SNAP_BOOL[key] ?? ['вкл', 'выкл'];
    return v ? pair[0] : pair[1];
  }
  if (typeof v === 'string') {
    const map = SNAP_ENUM[key];
    if (map && map[v]) return map[v];
  }
  return String(v);
}

const SNAP_KEY = 'he_metabolic_snapshot_v6';
const SNAP_LEGACY_KEYS = [
  'he_metabolic_snapshot_v5',
  'he_metabolic_snapshot_v4',
  'he_metabolic_snapshot_v3',
  'he_metabolic_snapshot_v1',
];
const SCENARIOS_KEY = 'he_metabolic_scenarios_v1';
const HCT_HIST_KEY = 'he_hct_history_v1';
const DONATION_LOG_KEY = 'he_donation_log_v1';
const SWEAT_PROFILES_KEY = 'he_sweat_profiles_v1';

type HctPoint = { date: string; hct: number; est?: boolean };

/**
 * Локальная дата `YYYY-MM-DD`.
 * `new Date().toISOString().slice(0,10)` — это UTC: в Москве (UTC+3) любое действие до 03:00
 * записывалось «вчерашним» числом, вплоть до замеров HCT и донаций.
 */
function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 4 шага мастера ввода: одно место для полей, результаты — под селектором. */
const STEP_DEFS: Array<{ n: 1 | 2 | 3 | 4; title: string; icon: string; hint: string }> = [
  { n: 1, title: 'Тело', icon: '🧍', hint: 'вес · рост · % жира · замеры' },
  { n: 2, title: 'Активность', icon: '🏃', hint: 'шаги · тренировки · пот · сон' },
  { n: 3, title: 'Лабы', icon: '🩸', hint: 'HCT · глюкоза · липиды · АД' },
  { n: 4, title: 'Цель', icon: '🎯', hint: 'дефицит · RED-S · refeed' },
];

export const MetabolicHub: React.FC = () => {
  const [mode, setMode] = useState<Mode>('water');
  const [onAAS, setOnAAS] = useState(false);
  const [aasDose, setAasDose] = useState(500);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [weight, setWeight] = useState(83);
  const [height, setHeight] = useState(180);
  const [age, setAge] = useState(30);
  const [bodyFat, setBodyFat] = useState<number|undefined>(undefined);
  const [neck, setNeck] = useState(39);
  const [waist, setWaist] = useState(84);
  const [hip, setHip] = useState(96);
  const [steps, setSteps] = useState(7000);
  const [cardioMin, setCardioMin] = useState(90);
  const [trainingDays, setTrainingDays] = useState(4);
  const [activityLevel, setActivityLevel] = useState<'low'|'medium'|'high'>('medium');
  const [goal, setGoal] = useState<'cut'|'maintain'|'bulk'|'health'>('maintain');
  const [stress, setStress] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [climate, setClimate] = useState<'temperate'|'hot'|'cold'>('temperate');
  const [humidity, setHumidity] = useState<number|undefined>(55);
  const [standingHours, setStandingHours] = useState(2);
  const [fidgetLevel, setFidgetLevel] = useState<1|2|3>(2);
  const [sweatRate, setSweatRate] = useState(600);
  const [sweatSodium, setSweatSodium] = useState(900);
  const [alcoholG, setAlcoholG] = useState(0);
  const [caffeineMg, setCaffeineMg] = useState(150);
  const [fiberG, setFiberG] = useState<number|undefined>(undefined);
  const [omega3G, setOmega3G] = useState<number|undefined>(undefined);
  const [sfaG, setSfaG] = useState<number|undefined>(undefined);
  const [tgMgDl2, setTgMgDl2] = useState<number|undefined>(undefined);
  const [ggt, setGgt] = useState<number|undefined>(undefined);
  const [targetWeight, setTargetWeight] = useState<number|undefined>(undefined);
  const [weeksToGoal, setWeeksToGoal] = useState<number|undefined>(undefined);
  const [menstrualPhase, setMenstrualPhase] = useState<'follicular'|'luteal'|'none'>('none');
  const [tsh, setTsh] = useState<number|undefined>(undefined);
  const [ft4, setFt4] = useState<number|undefined>(undefined);
  const [glucoseMgDl, setGlucoseMgDl] = useState<number|undefined>(undefined);
  const [insulinMuMl, setInsulinMuMl] = useState<number|undefined>(undefined);
  const [skinfoldSum3, setSkinfoldSum3] = useState<number|undefined>(undefined);
  const [skinfoldSum4, setSkinfoldSum4] = useState<number|undefined>(undefined);
  const [biaResistance, setBiaResistance] = useState<number|undefined>(undefined);
  // isPlantHeavy удалён (дедуп v4-3): источник белка задаётся DIAAS-селектом proteinSource
  const [deficitKcal, setDeficitKcal] = useState<number|undefined>(undefined);
  const [weeksInDeficit, setWeeksInDeficit] = useState<number|undefined>(undefined);
  const [weightLostKg, setWeightLostKg] = useState<number|undefined>(undefined);
  const [creatineUse, setCreatineUse] = useState(false);
  const [weeklyVolumeTons, setWeeklyVolumeTons] = useState<number|undefined>(undefined);
  const [hct, setHct] = useState<number|undefined>(undefined);
  const [hgb, setHgb] = useState<number|undefined>(undefined);
  const [ferritin, setFerritin] = useState<number|undefined>(undefined);
  const [gfr, setGfr] = useState<number|undefined>(undefined);
  const [waterL, setWaterL] = useState(2.5);
  const [sodiumG, setSodiumG] = useState(3.5);
  const [potassiumG, setPotassiumG] = useState(3.0);
  // P0-2 MET
  const [metHoursPerWeek, setMetHoursPerWeek] = useState<number|undefined>(undefined);
  // P0-3 RED-S
  const [leafScore, setLeafScore] = useState<number|undefined>(undefined);
  const [measuredRMR, setMeasuredRMR] = useState<number|undefined>(undefined);
  const [boneFlag, setBoneFlag] = useState(false);
  const [menstrualFlag, setMenstrualFlag] = useState(false);
  // P1-1 sweat lab
  // Аудит 2026-11: дефолты были 83 → 82.2 кг + 0.5 л, и карточка показывала «измеренный
  // 1.30 л/ч», хотя пользователь ничего не измерял. Теперь измерения пустые (потери 0 →
  // движок даёт оценку ACSM), а «измеренный» появляется только после реального ввода.
  const [preKg, setPreKg] = useState(83);
  const [postKg, setPostKg] = useState(83);
  const [fluidL, setFluidL] = useState(0);
  const [sweatHours, setSweatHours] = useState(1);
  // P1-3 metabolic health extra
  const [hdlMgDl, setHdlMgDl] = useState<number|undefined>(undefined);
  const [systolic, setSystolic] = useState<number|undefined>(undefined);
  const [diastolic, setDiastolic] = useState<number|undefined>(undefined);
  const [ast, setAst] = useState<number|undefined>(undefined);
  const [alt, setAlt] = useState<number|undefined>(undefined);
  const [plt, setPlt] = useState<number|undefined>(undefined);
  const [caffeineHoursSince, setCaffeineHoursSince] = useState(2);
  const [wizardStep, setWizardStep] = useState<1|2|3|4>(1);
  const [group, setGroup] = useState<string>('energy');
  const [scheduleText, setScheduleText] = useState('пн: силовая 1ч, вт: бег 0.5ч, чт: силовая 1ч');
  const [carbLoadDays, setCarbLoadDays] = useState(2);
  const [carbGPerKg, setCarbGPerKg] = useState(10);
  const [sodiumLoadDays, setSodiumLoadDays] = useState(2);
  const [sodiumGPerDay, setSodiumGPerDay] = useState(5);
  const [projectionYears, setProjectionYears] = useState(3);
  const [projectionMode, setProjectionMode] = useState<'hold_bf'|'hold_weight'|'hold_ffmi'>('hold_bf');
  const [leafAnswers, setLeafAnswers] = useState<boolean[]>(Array(8).fill(false));
  const [sweatProfiles, setSweatProfiles] = useState<Record<string,{ rate:number; sodium:number }>>({});
  const [hctHistory, setHctHistory] = useState<HctPoint[]>([]);
  const [donationLog, setDonationLog] = useState<HctPoint[]>([]);
  const [weightHistory, setWeightHistory] = useState<{date:string;kg:number}[]>([]);
  const [diaryAvgKcal, setDiaryAvgKcal] = useState<number|undefined>(undefined);
  const [diaryDays, setDiaryDays] = useState(0);
  const [intakeSeries, setIntakeSeries] = useState<Array<{date:string;kcal:number}>>([]);
  const [proteinMeals, setProteinMeals] = useState<3|4|5|6>(4);
  // PRO v4 — профессия/беременность/этника/бариатрия/акклиматизация/хроника/DIAAS/CAT2/пот-оценка
  const [profession, setProfession] = useState<'sedentary'|'standing'|'physical'|'auto'>('sedentary');
  const [trimester, setTrimester] = useState<1|2|3|0>(0);
  const [lactating, setLactating] = useState<'none'|'exclusive'|'mixed'>('none');
  const [ethnicity, setEthnicity] = useState<'european'|'african'|'east_asian'>('european');
  const [postBariatric, setPostBariatric] = useState(false);
  const [acclimated, setAcclimated] = useState(false);
  const [alcoholDays, setAlcoholDays] = useState(0);
  const [proteinSource, setProteinSource] = useState('mixed');
  const [leamAnswers, setLeamAnswers] = useState<boolean[]>(Array(6).fill(false));
  const [edeScore, setEdeScore] = useState<number|undefined>(undefined);
  const [lowT, setLowT] = useState(false);
  const [lowBMD, setLowBMD] = useState(false);
  const [t3Low, setT3Low] = useState(false);
  const [untreatedHypo, setUntreatedHypo] = useState(false);
  const [sweatIntensity, setSweatIntensity] = useState<'easy'|'moderate'|'hard'>('moderate');
  const [sweatEnv, setSweatEnv] = useState<'cool'|'temperate'|'hot'|'hot_humid'>('temperate');
  const [useMeasuredSweat, setUseMeasuredSweat] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string|null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((m:string)=>{
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=> setToast(null), 2600);
  }, []);
  useEffect(()=> ()=>{ if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const wizardRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  /** Текущие значения лабораторных полей — читаем из ref, чтобы refreshLabs не держал устаревшие замыкания. */
  const valuesRef = useRef<Record<string, number | undefined>>({});
  /** Поля, которые пользователь ввёл руками: их 8-секундный авто-refresh из профиля не перезаписывает. */
  const manualLabsRef = useRef<Record<string, boolean>>({});
  /** Пользователь уже трогал вес «до/после» в пот-тесте — тогда не подставляем текущий вес. */
  const sweatTouchedRef = useRef(false);

  // ACWR live — слушаем srpe-store + polling
  const [acwr, setAcwr] = useState(1);
  const refreshAcwr = useCallback(()=>{
    try{ const s=loadSRPESessions(); const r = s.length>=2 ? acuteChronicRatio(toDailyLoads(s as any)).ratio : 1; setAcwr(r); }catch{ setAcwr(1); }
  }, []);
  useEffect(()=>{
    refreshAcwr();
    const id = setInterval(refreshAcwr, 8000);
    const onStorage = (e: StorageEvent)=>{ if(e.key && e.key.includes('srpe')) refreshAcwr(); };
    const onFocus = ()=> refreshAcwr();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [refreshAcwr]);

  // weightHistory для адаптивного TDEE — live из nutrition-v2-data
  const refreshWeightHistory = useCallback(()=>{
    try{ const wh = getNutritionV2Data().weightHistory || []; setWeightHistory(wh.slice(-30)); }catch{ setWeightHistory([]); }
  }, []);
  useEffect(()=>{
    refreshWeightHistory();
    const id = setInterval(refreshWeightHistory, 8000);
    const onStorage = (e: StorageEvent)=>{ if(e.key && e.key.includes('he_nutrition_v2')) refreshWeightHistory(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshWeightHistory);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refreshWeightHistory); };
  }, [refreshWeightHistory]);

  // diary avg kcal 7д + intake-серия 28д — live из diary-storage-v2 (для Adaptive v3 и графика)
  const refreshDiaryAvg = useCallback(()=>{
    try{
      const data = readDiaryV2();
      const allDates = Object.keys(data).sort();
      const series: Array<{date:string;kcal:number}> = [];
      for(const d of allDates.slice(-28)){
        const day=data[d];
        if(!day?.meals) continue;
        let dayKcal=0;
        for(const items of Object.values(day.meals) as any[]) for(const it of items as any[]) dayKcal+= Number(it.kcal)||0;
        if(dayKcal>300 && dayKcal<12000) series.push({ date: d, kcal: Math.round(dayKcal) });
      }
      setIntakeSeries(series);
      const dates = allDates.slice(-7);
      if(dates.length===0){ setDiaryAvgKcal(undefined); setDiaryDays(0); return; }
      let sum=0, cnt=0;
      for(const d of dates){
        const day=data[d];
        if(!day?.meals) continue;
        let dayKcal=0;
        for(const items of Object.values(day.meals) as any[]) for(const it of items as any[]) dayKcal+= Number(it.kcal)||0;
        if(dayKcal>300){ sum+=dayKcal; cnt++; }
      }
      if(cnt>0){ setDiaryAvgKcal(Math.round(sum/cnt)); setDiaryDays(cnt); } else { setDiaryAvgKcal(undefined); setDiaryDays(0); }
    }catch{ setDiaryAvgKcal(undefined); setDiaryDays(0); setIntakeSeries([]); }
  }, []);
  useEffect(()=>{
    refreshDiaryAvg();
    const off = onDiaryChangeV2(()=> refreshDiaryAvg());
    const id=setInterval(refreshDiaryAvg, 10000);
    const onStorage=(e:StorageEvent)=>{ if(e.key && e.key.includes('nutrition_diary')) refreshDiaryAvg(); };
    const onFocus=()=> refreshDiaryAvg();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return ()=>{ off(); clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [refreshDiaryAvg]);

  // HCT history + donation log
  const loadHctHistory = useCallback(()=>{
    try{
      const raw = localStorage.getItem(HCT_HIST_KEY);
      if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)) setHctHistory(arr.slice(-30)); }
      const rawD = localStorage.getItem(DONATION_LOG_KEY);
      if(rawD){ const arr=JSON.parse(rawD); if(Array.isArray(arr)) setDonationLog(arr.slice(-20)); }
    }catch{}
  }, []);
  useEffect(()=>{ loadHctHistory(); const onStorage=(e:StorageEvent)=>{ if(e.key && (e.key.includes('he_hct')||e.key.includes('he_donation'))) loadHctHistory(); }; window.addEventListener('storage', onStorage); window.addEventListener('focus', loadHctHistory); return ()=>{ window.removeEventListener('storage', onStorage); window.removeEventListener('focus', loadHctHistory); }; }, [loadHctHistory]);
  const pushHct = useCallback((points: HctPoint[])=>{
    try{
      const raw = localStorage.getItem(HCT_HIST_KEY);
      const arr: HctPoint[] = raw ? JSON.parse(raw) : [];
      const next = [...arr, ...points].slice(-30);
      localStorage.setItem(HCT_HIST_KEY, JSON.stringify(next));
      setHctHistory(next);
      return next;
    }catch{ return null; }
  },[setHctHistory]);
  const recordHct = useCallback(()=>{
    if(hct==null || hct<30 || hct>70) { showToast('HCT не задан'); return; }
    const entry: HctPoint = { date: localISODate(), hct };
    pushHct([entry]);
    showToast(`HCT ${hct}% записан на ${entry.date}`);
  }, [hct, showToast, pushHct]);
  const recordDonation = useCallback(()=>{
    if(hct==null) { showToast('Сначала укажи HCT'); return; }
    const today = localISODate();
    const entry: HctPoint = { date: today, hct };
    try{
      const raw = localStorage.getItem(DONATION_LOG_KEY);
      const arr: HctPoint[] = raw ? JSON.parse(raw) : [];
      const next = [...arr, entry].slice(-20);
      localStorage.setItem(DONATION_LOG_KEY, JSON.stringify(next));
      setDonationLog(next);
      // Флеботомия 450 мл (ASA): HCT падает ~4 пп, восстанавливается 3-4 нед.
      // Пишем прогноз отдельной точкой с est:true — это не измерение.
      const d = new Date(); d.setDate(d.getDate() + 7);
      const est: HctPoint = { date: localISODate(d), hct: Math.max(30, Math.round((hct-4)*10)/10), est: true };
      pushHct([entry, est]);
      showToast(`Донация ${today} записана · HCT ${hct}% → прогноз ~${est.hct}% через 7д`);
    }catch{ showToast('Донация записана'); }
  }, [hct, showToast, pushHct]);
  useEffect(()=>{ try{ const raw=localStorage.getItem('he_sweat_profiles_v1'); if(raw){ const p=JSON.parse(raw); if(p && typeof p==='object') setSweatProfiles(p); } }catch{} },[]);

  // labs live refresh — только те поля, которые пользователь не правил руками.
  // Было: зависимости [hct,hgb,ferritin,gfr], а HDL/AST/ALT/PLT/ТГ/глюкоза читались
  // из устаревшего замыкания — каждые 8 секунд интервал откатывал ручной ввод.
  // Ключи должны совпадать с ключами apply(...) ниже — иначе защита «не затираем»
  // не видит уже показанное значение (hdl/tg/glucose/insulin названы коротко).
  useEffect(()=>{
    valuesRef.current = { hct, hgb, ferritin, gfr, hdl: hdlMgDl, ast, alt, plt, tg: tgMgDl2, glucose: glucoseMgDl, insulin: insulinMuMl, tsh, ft4 };
  }, [hct, hgb, ferritin, gfr, hdlMgDl, ast, alt, plt, tgMgDl2, glucoseMgDl, insulinMuMl, tsh, ft4]);
  const refreshLabs = useCallback(()=>{
    try{
      const p:any = getProfile()?.settings || {};
      const labs = p.labs?.summary || {};
      const pick = (...keys: string[]): number | undefined => {
        for(const k of keys){
          const v = labs[k]?.value;
          if(v != null && Number.isFinite(Number(v))) return Number(v);
        }
        return undefined;
      };
      const cur = valuesRef.current;
      const apply = (key: string, setter:(v:number)=>void, val?: number)=>{
        if(val == null) return;
        if(manualLabsRef.current[key]) return; // ручной ввод важнее профиля
        if(cur[key] == null) setter(val);      // не затираем уже показанное
      };
      apply('hct', setHct, pick('HCT','Hct','hematocrit','Гематокрит'));
      apply('hgb', setHgb, pick('HGB','Hgb','hemoglobin','Гемоглобин'));
      apply('ferritin', setFerritin, pick('FERRITIN','Ferritin','ферритин'));
      apply('gfr', setGfr, pick('eGFR','GFR','gfr'));
      apply('hdl', setHdlMgDl, pick('HDL','hdl','HDLc','ЛПВП'));
      apply('ast', setAst, pick('AST','ast','АСТ'));
      apply('alt', setAlt, pick('ALT','alt','АЛТ'));
      apply('plt', setPlt, pick('PLT','plt','platelets','Тромбоциты'));
      apply('tg', setTgMgDl2, pick('TG','triglycerides','ТГ'));
      apply('glucose', setGlucoseMgDl, pick('GLUCOSE','glucose','Глюкоза'));
      apply('insulin', setInsulinMuMl, pick('INSULIN','insulin','Инсулин'));
      apply('tsh', setTsh, pick('TSH','tsh'));
      apply('ft4', setFt4, pick('FT4','ft4','Т4 свободный'));
    }catch{}
  }, []);
  useEffect(()=>{
    refreshLabs();
    const id=setInterval(refreshLabs, 8000);
    const onStorage=(e:StorageEvent)=>{ if(e.key && (e.key.includes('he_profile')||e.key.includes('he_labs')||e.key.includes('profile'))) refreshLabs(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshLabs);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refreshLabs); };
  }, [refreshLabs]);
  /** Пользователь ввёл лабораторное значение руками — помечаем и больше не перезаписываем. */
  const markManualLab = useCallback((key: string, setter:(v:number|undefined)=>void)=>{
    return (v: number|undefined)=>{ manualLabsRef.current[key] = true; setter(v); };
  }, []);
  /** «Сброс лаб» — снимаем пометки, поля снова подтягиваются из профиля. */
  const resetLabs = useCallback(()=>{
    manualLabsRef.current = {};
    setHct(undefined); setHgb(undefined); setFerritin(undefined); setGfr(undefined);
    setHdlMgDl(undefined); setAst(undefined); setAlt(undefined); setPlt(undefined);
    setTgMgDl2(undefined); setGlucoseMgDl(undefined); setInsulinMuMl(undefined);
    setTsh(undefined); setFt4(undefined);
    showToast('Лабы сброшены — подтянутся из Профиля → Лабы');
  }, [showToast]);

  /**
   * Применить снапшот: одно место правды и для автосохранения (v6), и для загрузки сценария.
   * Аудит 2026-11: сценарий хранил 22 поля из ~90 и восстанавливал столько же, поэтому
   * лабы/сон/стресс/пот/климат/клетчатка в сценарии терялись, а diff их не показывал.
   */
  const applySnapshot = useCallback((s: any, opts?: { markLabs?: boolean })=>{
    if(!s || typeof s !== 'object') return;
    if(typeof s.weight==='number') setWeight(s.weight);
    if(typeof s.height==='number') setHeight(s.height);
    if(typeof s.age==='number') setAge(s.age);
    if(s.sex) setSex(s.sex);
    if(typeof s.bodyFat==='number') setBodyFat(s.bodyFat);
    if(typeof s.neck==='number') setNeck(s.neck);
    if(typeof s.waist==='number') setWaist(s.waist);
    if(typeof s.hip==='number') setHip(s.hip);
    if(typeof s.steps==='number') setSteps(s.steps);
    if(typeof s.cardioMin==='number') setCardioMin(s.cardioMin);
    if(typeof s.trainingDays==='number') setTrainingDays(s.trainingDays);
    if(s.activityLevel) setActivityLevel(s.activityLevel);
    if(s.goal) setGoal(s.goal);
    if(typeof s.stress==='number') setStress(s.stress);
    if(typeof s.sleepHours==='number') setSleepHours(s.sleepHours);
    if(typeof s.sleepQuality==='number') setSleepQuality(s.sleepQuality);
    if(typeof s.onAAS==='boolean') setOnAAS(s.onAAS);
    if(typeof s.aasDose==='number') setAasDose(s.aasDose);
    if(s.climate) setClimate(s.climate);
    if(typeof s.humidity==='number') setHumidity(s.humidity);
    if(typeof s.standingHours==='number') setStandingHours(s.standingHours);
    if(typeof s.fidgetLevel==='number') setFidgetLevel(s.fidgetLevel as any);
    if(typeof s.sweatRate==='number') setSweatRate(s.sweatRate);
    if(typeof s.sweatSodium==='number') setSweatSodium(s.sweatSodium);
    if(typeof s.alcoholG==='number') setAlcoholG(s.alcoholG);
    if(typeof s.caffeineMg==='number') setCaffeineMg(s.caffeineMg);
    if(typeof s.tsh==='number') setTsh(s.tsh);
    if(typeof s.ft4==='number') setFt4(s.ft4);
    if(typeof s.glucoseMgDl==='number') setGlucoseMgDl(s.glucoseMgDl);
    if(typeof s.insulinMuMl==='number') setInsulinMuMl(s.insulinMuMl);
    if(typeof s.skinfoldSum3==='number') setSkinfoldSum3(s.skinfoldSum3);
    if(typeof s.skinfoldSum4==='number') setSkinfoldSum4(s.skinfoldSum4);
    if(typeof s.biaResistance==='number') setBiaResistance(s.biaResistance);
    if(typeof s.t3Low==='boolean') setT3Low(s.t3Low);
    if(typeof s.untreatedHypo==='boolean') setUntreatedHypo(s.untreatedHypo);
    if(Array.isArray(s.leafAnswers) && s.leafAnswers.length===8) { setLeafAnswers(s.leafAnswers.map(Boolean)); setLeafScore(s.leafAnswers.filter(Boolean).length*2); }
    if(Array.isArray(s.leamAnswers) && s.leamAnswers.length===6) setLeamAnswers(s.leamAnswers.map(Boolean));
    if(Array.isArray(s.compareIds)) setCompareIds(s.compareIds.filter((x:any)=> typeof x==='string').slice(-2));
    if(typeof s.deficitKcal==='number') setDeficitKcal(s.deficitKcal);
    if(typeof s.weeksInDeficit==='number') setWeeksInDeficit(s.weeksInDeficit);
    if(typeof s.weightLostKg==='number') setWeightLostKg(s.weightLostKg);
    if(typeof s.creatineUse==='boolean') setCreatineUse(s.creatineUse);
    if(typeof s.weeklyVolumeTons==='number') setWeeklyVolumeTons(s.weeklyVolumeTons);
    if(typeof s.targetWeight==='number') setTargetWeight(s.targetWeight);
    if(typeof s.weeksToGoal==='number') setWeeksToGoal(s.weeksToGoal);
    if(s.menstrualPhase) setMenstrualPhase(s.menstrualPhase);
    if(typeof s.sfaG==='number') setSfaG(s.sfaG);
    if(typeof s.tgMgDl2==='number') setTgMgDl2(s.tgMgDl2);
    if(typeof s.ggt==='number') setGgt(s.ggt);
    if(typeof s.hct==='number') setHct(s.hct);
    if(typeof s.hgb==='number') setHgb(s.hgb);
    if(typeof s.ferritin==='number') setFerritin(s.ferritin);
    if(typeof s.gfr==='number') setGfr(s.gfr);
    if(typeof s.waterL==='number') setWaterL(s.waterL);
    if(typeof s.sodiumG==='number') setSodiumG(s.sodiumG);
    if(typeof s.potassiumG==='number') setPotassiumG(s.potassiumG);
    if(typeof s.metHoursPerWeek==='number') setMetHoursPerWeek(s.metHoursPerWeek);
    if(typeof s.leafScore==='number') setLeafScore(s.leafScore);
    if(typeof s.measuredRMR==='number') setMeasuredRMR(s.measuredRMR);
    if(typeof s.boneFlag==='boolean') setBoneFlag(s.boneFlag);
    if(typeof s.menstrualFlag==='boolean') setMenstrualFlag(s.menstrualFlag);
    if(typeof s.preKg==='number') setPreKg(s.preKg);
    if(typeof s.postKg==='number') setPostKg(s.postKg);
    if(typeof s.fluidL==='number') setFluidL(s.fluidL);
    if(typeof s.sweatHours==='number') setSweatHours(s.sweatHours);
    if(typeof s.hdlMgDl==='number') setHdlMgDl(s.hdlMgDl);
    if(typeof s.systolic==='number') setSystolic(s.systolic);
    if(typeof s.diastolic==='number') setDiastolic(s.diastolic);
    if(typeof s.ast==='number') setAst(s.ast);
    if(typeof s.alt==='number') setAlt(s.alt);
    if(typeof s.plt==='number') setPlt(s.plt);
    if(typeof s.caffeineHoursSince==='number') setCaffeineHoursSince(s.caffeineHoursSince);
    if(s.profession) setProfession(s.profession);
    if(typeof s.trimester==='number') setTrimester(s.trimester as any);
    if(s.lactating) setLactating(s.lactating);
    if(s.ethnicity) setEthnicity(s.ethnicity);
    if(typeof s.postBariatric==='boolean') setPostBariatric(s.postBariatric);
    if(typeof s.acclimated==='boolean') setAcclimated(s.acclimated);
    if(typeof s.alcoholDays==='number') setAlcoholDays(s.alcoholDays);
    if(typeof s.proteinSource==='string') setProteinSource(s.proteinSource);
    if(s.proteinMeals===3 || s.proteinMeals===4 || s.proteinMeals===5 || s.proteinMeals===6) setProteinMeals(s.proteinMeals);
    if(typeof s.edeScore==='number') setEdeScore(s.edeScore);
    if(typeof s.lowT==='boolean') setLowT(s.lowT);
    if(typeof s.lowBMD==='boolean') setLowBMD(s.lowBMD);
    if(s.sweatIntensity) setSweatIntensity(s.sweatIntensity);
    if(s.sweatEnv) setSweatEnv(s.sweatEnv);
    if(typeof s.useMeasuredSweat==='boolean') setUseMeasuredSweat(s.useMeasuredSweat);
    if(typeof s.fiberG==='number') setFiberG(s.fiberG);
    if(typeof s.omega3G==='number') setOmega3G(s.omega3G);
    if(typeof s.scheduleText==='string') setScheduleText(s.scheduleText);
    if(typeof s.carbLoadDays==='number') setCarbLoadDays(s.carbLoadDays);
    if(typeof s.carbGPerKg==='number') setCarbGPerKg(s.carbGPerKg);
    if(typeof s.sodiumLoadDays==='number') setSodiumLoadDays(s.sodiumLoadDays);
    if(typeof s.sodiumGPerDay==='number') setSodiumGPerDay(s.sodiumGPerDay);
    if(typeof s.projectionYears==='number') setProjectionYears(s.projectionYears);
    if(s.projectionMode) setProjectionMode(s.projectionMode);
    if(opts?.markLabs) for(const k of LAB_KEYS) if(typeof s[k]==='number') manualLabsRef.current[k] = true;
    // пометки «введено руками» сохраняются вместе со снапшотом — иначе таймер лаб
    // (раз в 8 с) возвращал значение из профиля и затирал ручной ввод
    if(Array.isArray(s.manualLabs)) for(const k of s.manualLabs) if(typeof k==='string') manualLabsRef.current[k] = true;
    // в снапшоте есть вес «до/после» — не перетираем его текущим весом из эффекта ниже
    if(typeof s.preKg==='number') sweatTouchedRef.current = true;
  },[]);

  // init: актуальный снапшот v6 → legacy v5/v4/v3/v1 → профиль
  useEffect(()=>{
    let loaded=false;
    try{
      let raw: string | null = null;
      for(const k of [SNAP_KEY, ...SNAP_LEGACY_KEYS]){
        raw = localStorage.getItem(k);
        if(raw) break;
      }
      if(raw){
        const s=JSON.parse(raw);
        applySnapshot(s);
        loaded=true;
      }
    }catch{}
    if(loaded) return;
    try{
      const p:any = getProfile()?.settings || {};
      const pers = p.personal || {};
      const life = p.lifestyle || {};
      const train = p.training || {};
      const labs = p.labs?.summary || {};
      const pharma = p.pharma || {};
      if(pers.weight) setWeight(Number(pers.weight));
      if(pers.height) setHeight(Number(pers.height));
      if(pers.age) setAge(Number(pers.age));
      if(pers.sex) setSex(pers.sex==='female'?'female':'male');
      if(pers.bodyFat) setBodyFat(Number(pers.bodyFat));
      if(pers.neckCm) setNeck(Number(pers.neckCm));
      if(pers.waistCm) setWaist(Number(pers.waistCm));
      if(pers.hipCm) setHip(Number(pers.hipCm));
      if(life.dailySteps) setSteps(Number(life.dailySteps));
      if(life.activityLevel) {
        const al = Number(life.activityLevel);
        setActivityLevel(al>=7?'high': al>=4?'medium':'low');
      }
      if(train.daysPerWeek) setTrainingDays(Number(train.daysPerWeek));
      if(typeof life.sleepHours==='number') setSleepHours(Number(life.sleepHours));
      if(typeof life.stressLevel==='number') setStress(Math.round(Number(life.stressLevel)));
      const sleepQMap:Record<string,number>={good:4, fair:3, poor:2};
      if(life.sleepQuality && sleepQMap[life.sleepQuality]) setSleepQuality(sleepQMap[life.sleepQuality]);
      if(typeof life.caffeineMg==='number') setCaffeineMg(Number(life.caffeineMg));
      if(typeof life.alcoholG==='number') setAlcoholG(Number(life.alcoholG));
      if(pers.menstrualPhase) setMenstrualPhase(pers.menstrualPhase);
      const hctLab = labs['HCT'] || labs['Hct'] || labs['hematocrit'] || labs['Гематокрит'];
      if(hctLab?.value) setHct(Number(hctLab.value));
      const hgbLab = labs['HGB'] || labs['Hgb'] || labs['hemoglobin'];
      if(hgbLab?.value) setHgb(Number(hgbLab.value));
      const ferrLab = labs['FERRITIN'] || labs['Ferritin'] || labs['ферритин'];
      if(ferrLab?.value) setFerritin(Number(ferrLab.value));
      const gfrLab = labs['eGFR'] || labs['GFR'] || labs['gfr'];
      if(gfrLab?.value) setGfr(Number(gfrLab.value));
      const tshLab = labs['TSH'] || labs['tsh'];
      if(tshLab?.value) setTsh(Number(tshLab.value));
      if(typeof life.dailyWaterLiters==='number') setWaterL(Number(life.dailyWaterLiters));
      if(typeof p.nutrition?.sodiumG==='number') setSodiumG(Number(p.nutrition.sodiumG));
      if(typeof p.nutrition?.potassiumG==='number') setPotassiumG(Number(p.nutrition.potassiumG));
      if(typeof p.goals?.targetWeight==='number') setTargetWeight(Number(p.goals.targetWeight));
      if(Array.isArray(pharma.currentSubstances) && pharma.currentSubstances.length>0){
        setOnAAS(true);
        const sumDose = pharma.currentSubstances.reduce((s:any,sub:any)=> s + (Number(sub.doseMg)||Number(sub.doseValue)||0),0);
        if(sumDose>0) setAasDose(Math.min(3000, Math.round(sumDose)));
      }
    }catch{}
  },[]);
  const snapshot = useMemo(()=>({weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,profession,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate,humidity,standingHours,fidgetLevel,sweatRate,sweatSodium,alcoholG,alcoholDays,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,deficitKcal,weeksInDeficit,weightLostKg,creatineUse,weeklyVolumeTons,targetWeight,weeksToGoal,menstrualPhase,sfaG,tgMgDl2,ggt,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,metHoursPerWeek,leafScore,leafAnswers,leamAnswers,measuredRMR,boneFlag,menstrualFlag,preKg,postKg,fluidL,sweatHours,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince,trimester,lactating,ethnicity,postBariatric,untreatedHypo,acclimated,proteinSource,proteinMeals,edeScore,lowT,lowBMD,t3Low,sweatIntensity,sweatEnv,compareIds,fiberG,omega3G,scheduleText,carbLoadDays,carbGPerKg,sodiumLoadDays,sodiumGPerDay,projectionYears,projectionMode,useMeasuredSweat,manualLabs: Object.keys(manualLabsRef.current)}), [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,profession,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate,humidity,standingHours,fidgetLevel,sweatRate,sweatSodium,alcoholG,alcoholDays,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,deficitKcal,weeksInDeficit,weightLostKg,creatineUse,weeklyVolumeTons,targetWeight,weeksToGoal,menstrualPhase,sfaG,tgMgDl2,ggt,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,metHoursPerWeek,leafScore,leafAnswers,leamAnswers,measuredRMR,boneFlag,menstrualFlag,preKg,postKg,fluidL,sweatHours,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince,trimester,lactating,ethnicity,postBariatric,untreatedHypo,acclimated,proteinSource,proteinMeals,edeScore,lowT,lowBMD,t3Low,sweatIntensity,sweatEnv,compareIds,fiberG,omega3G,scheduleText,carbLoadDays,carbGPerKg,sodiumLoadDays,sodiumGPerDay,projectionYears,projectionMode,useMeasuredSweat]);
  useEffect(()=>{
    try{ localStorage.setItem(SNAP_KEY, JSON.stringify(snapshot)); }catch{}
  }, [snapshot]);

  // Пот-тест считается ДО общего input: измеренный пот обязан попадать в воду, а не жить
  // только в карточке «Пот-тест» (было: тест показал 1.30 л/ч, а вода считалась по 600).
  // Пот-тест: пока вес «до/после» не вводили руками, держим их равными текущему весу.
  // Иначе при весе 95 кг в полях висело бы 83 из дефолта и замер считался бы по чужой массе.
  useEffect(()=>{
    if(sweatTouchedRef.current) return;
    setPreKg(weight); setPostKg(weight);
  }, [weight]);
  const sweatV2 = useMemo(()=> calcSweatTestV2(useMeasuredSweat ? { preKg, postKg, fluidL, hours: sweatHours, sodiumMgPerL: sweatSodium, weightKg: weight, acclimated } : { hours: sweatHours, sodiumMgPerL: sweatSodium, weightKg: weight, intensity: sweatIntensity, environment: sweatEnv, acclimated }), [useMeasuredSweat, preKg, postKg, fluidL, sweatHours, sweatSodium, weight, acclimated, sweatIntensity, sweatEnv]);
  /** Измеренный пот (мл/ч) или null, если режим «Оценка»/данных нет. */
  const measuredSweatMlPerH = useMeasuredSweat && sweatV2?.measured ? Math.round(sweatV2.rateLPerH * 1000) : null;
  const effectiveSweatMlPerH = measuredSweatMlPerH ?? sweatRate;
  /** Periard: акклиматизация снижает [Na] пота на ~40% — считаем одинаково в воде и в пот-тесте. */
  const effectiveSweatNaMgPerL = Math.round(sweatSodium * (acclimated ? 0.6 : 1));
  /** Единая точка EEE (тоннаж ИЛИ сессии+кардио) — в EA уходит суточная доля. */
  const weeklyEee = useMemo(()=> weeklyExerciseEnergy({ weeklyVolumeTons, trainingDays, cardioMin }), [weeklyVolumeTons, trainingDays, cardioMin]);

  const input: MetabolicInput = useMemo(()=> ({ weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,trainingHours: trainingDays*1.15, activityLevel: activityLevel as any, profession, goal, onAAS, aasDose, stress, sleepHours, sleepQuality, acwr, climate, humidity, standingHours, fidgetLevel, sweatRate: effectiveSweatMlPerH, sweatSodiumMgPerL: effectiveSweatNaMgPerL, weightHistory: weightHistory.length>=3 ? weightHistory : undefined, hct, hgb, ferritin, gfr, waterL, ironIntakeMg: undefined, alcoholG, alcoholDaysPerWeek: alcoholDays, caffeineMg, tsh, ft4, creatineUse, weeklyVolumeTons, menstrualPhase, targetWeight, fiberG, omega3G, skinfoldSum3, skinfoldSum4, biaResistanceOhm: biaResistance, glucoseMgDl, insulinMuMl, deficitKcal, weeksInDeficit, metHoursPerWeek, measuredRMR, leafScore, boneFlag, menstrualFlag, hdlMgDl, systolic, diastolic, ast, alt, plt, caffeineHoursSince, trimester: trimester || undefined, lactating: lactating === 'none' ? undefined : lactating, ethnicity, postBariatric, untreatedHypothyroid: untreatedHypo || undefined, acclimated, proteinSource } as any), [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,profession,goal,onAAS,aasDose,stress,sleepHours,sleepQuality,acwr,climate,humidity,standingHours,fidgetLevel,effectiveSweatMlPerH,effectiveSweatNaMgPerL,weightHistory,hct,hgb,ferritin,gfr,waterL,alcoholG,alcoholDays,caffeineMg,tsh,ft4,glucoseMgDl,insulinMuMl,skinfoldSum3,skinfoldSum4,biaResistance,deficitKcal,weeksInDeficit,creatineUse,weeklyVolumeTons,menstrualPhase,targetWeight,fiberG,omega3G,metHoursPerWeek,measuredRMR,leafScore,boneFlag,menstrualFlag,hdlMgDl,systolic,diastolic,ast,alt,plt,caffeineHoursSince,trimester,lactating,ethnicity,postBariatric,untreatedHypo,acclimated,proteinSource]);

  const water = useMemo(()=> calcWater(input), [input]);
const stepsCalc = useMemo(()=> calcSteps(input), [input]);
const kbju = useMemo(()=> calcKBJU(input), [input]);
  const fat = useMemo(()=> calcBodyFat(input), [input]);
  const cortisol = useMemo(()=> calcStressLoad(input), [input]);
  // Единый дефицит для AT/AT-range: если пользователь не ввёл — берём реальную разницу
  // TDEE (calcSteps, без цели) − итоговые ккал КБЖУ. Раньше AT считался от введённого
  // «дефицита», а при пустом поле — ни от чего, и полоса адаптации не совпадала с целью.
  const effectiveDeficit = useMemo(
    ()=> (deficitKcal ?? Math.max(0, stepsCalc.tdeeNat - kbju.nat.kcal)),
    [deficitKcal, stepsCalc, kbju],
  );
  // NEAT — единая точка PRO: neatPro (профессия), v1 calcNEAT удалён из UI
  const at = useMemo(()=> calcAdaptiveThermogenesis({ weight, height, age, sex, bodyFat, deficitKcal: effectiveDeficit, weeksInDeficit, weightLostKg }), [weight,height,age,sex,bodyFat,effectiveDeficit,weeksInDeficit,weightLostKg]);
  // reverse — единая точка PRO: reverseAuto (шаг по trend), v1 calcReverseDiet удалён из UI (движок оставлен для совместимости)
  const thyroid = useMemo(()=> calcThyroidImpact(ft4, tsh), [ft4,tsh]);
  const homa = useMemo(()=> calcHomaIRWrap(glucoseMgDl, insulinMuMl), [glucoseMgDl, insulinMuMl]);
  const lipid = useMemo(()=> calcLipid(sfaG, fiberG, undefined), [sfaG, fiberG]);
  const fli = useMemo(()=> {
    const bmi = weight / (((height||180)/100)**2);
    return calcFLIWrap({ bmi, waistCm: waist||84, tgMgDl: tgMgDl2, ggt });
  }, [weight, height, waist, tgMgDl2, ggt]);
  const fiberSplit = useMemo(()=> calcFiberSplit(kbju.fiber.nat), [kbju]);
  const hematology = useMemo(()=>{
    let proteinPerKg: number|undefined; let fiberGV: number|undefined; let omega3GV: number|undefined;
    try{
      const p:any=getProfile()?.settings||{};
      proteinPerKg = p.nutrition?.proteinPerKg;
      fiberGV = fiberG ?? p.nutrition?.fiberG;
      omega3GV = omega3G ?? p.nutrition?.omega3G;
    }catch{}
    if(proteinPerKg==null) proteinPerKg = kbju?.nat?.protPerKg;
    if(fiberGV==null) fiberGV = kbju?.fiber?.nat;
    return calcHematology({ weight, hct, hgb, ferritin, gfr, waterL, sodiumG, potassiumG, proteinPerKg, fiberG: fiberGV, omega3G: omega3GV, ironIntakeMg: undefined, onAAS, aasDose, sex });
  }, [weight,hct,hgb,ferritin,gfr,waterL,sodiumG,potassiumG,onAAS,aasDose,sex, kbju, fiberG, omega3G]);
  // Аудит 2026-11: журнал донаций был только «мёртвой» историей — совет «флеботомия» печатался
  // и через 3 дня после сдачи. Интервал между сдачами цельной крови ≥8 недель (ASA 2023,
  // донорские правила), поэтому свежая дата блокирует повтор и называется дата «не раньше».
  const donationGuard = useMemo(()=>{
    if(!hematology.donation.needed) return null;
    const dates = donationLog.map(d=>d?.date).filter((d): d is string=> typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if(!dates.length) return null;
    const lastDate = dates[dates.length-1];
    const lastT = Date.parse(`${lastDate}T00:00:00`);
    if(!isFinite(lastT)) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((today.getTime()-lastT)/86400000);
    if(days < 0) return null; // дата из будущего — не считаем
    const MIN_DAYS = 56;
    // local-дата: toISOString() в зонах восточнее UTC даёт вчерашний день
    const ready = new Date(lastT); ready.setDate(ready.getDate() + MIN_DAYS);
    const readyOn = localISODate(ready);
    return { lastDate, days, minDays: MIN_DAYS, readyOn, blocked: days < MIN_DAYS };
  }, [hematology, donationLog]);
  // Аудит 2026-11: точка «прогноз через 7 дней» (est:true после донации) рисовалась как измерение
  // и попадала в Δ за период. Считаем Δ/шаг только по лабораторным точкам, прогноз подписываем.
  const hctStats = useMemo(()=>{
    const measured = hctHistory.filter(p=>!p.est);
    const round1 = (n: number) => Math.round(n*10)/10;
    return {
      measured: measured.length,
      forecast: hctHistory.length - measured.length,
      delta: measured.length >= 2 ? round1(measured[measured.length-1].hct - measured[0].hct) : null,
      lastStep: measured.length >= 3 ? round1(measured[measured.length-1].hct - measured[measured.length-2].hct) : null,
    };
  }, [hctHistory]);
  const ea = useMemo(()=>{
    const intake = diaryAvgKcal ?? kbju.nat.kcal;
    // EEE — энергия упражнений В СУТКИ (движок сам делает ×0.85 net, Loucks).
    // Недельный объём (тоннаж ИЛИ сессии+кардио) считается одной функцией и делится на 7.
    const eeeDaily = Math.max(0, Math.round(weeklyEee.kcalPerWeek / 7));
    return calcEnergyAvailability({ weight, bodyFat, height: height||180, heightCm: height, lean: kbju.nat.lean, intakeKcal: intake, eeeKcal: eeeDaily, trainingDays, sex } as any);
  }, [weight,bodyFat,height,kbju,trainingDays,weeklyVolumeTons,cardioMin, diaryAvgKcal, sex, weeklyEee]);
  const eeeDailyKcal = useMemo(()=> Math.max(0, Math.round(weeklyEee.kcalPerWeek / 7)), [weeklyEee]);
  const lbmPres = useMemo(()=> calcLBMPreservation({ proteinGPerKg: kbju.nat.protPerKg, deficitKcal: effectiveDeficit, trainingDays, ea: ea?.ea }), [kbju, trainingDays, ea, effectiveDeficit]);
  const psmf = useMemo(()=> checkPSMFWrap(ea.ea), [ea.ea]);
  const menstrual = useMemo(()=> calcMenstrualWater(menstrualPhase), [menstrualPhase]);
  const alcohol = useMemo(()=> calcAlcohol(alcoholG, weight), [alcoholG, weight]);
  // белок — единая точка PRO: proteinPro (DIAAS + 60+), v1 calcProteinTiming удалён из UI
  const maintenance = useMemo(()=>{
    // Аудит 2026-11: раньше при пустом дневнике сюда подставлялась цель КБЖУ (`kbju.nat.kcal`)
    // и finder печатал «intake 2450» как измеренный факт. Вес знает, сколько съедено, только из
    // дневника — без него карточка должна просить данные, а не считать TDEE по собственному плану.
    return calcMaintenanceFinder(weightHistory, diaryAvgKcal, bodyFat);
  }, [weightHistory, diaryAvgKcal, bodyFat]);
  // цель — единая точка PRO: goalV2 (Helms caps + diet-break), v1 calcGoalTimeline удалён из UI
  const leafCalc = useMemo(()=> calcLeafScore(leafAnswers), [leafAnswers]);
  // адаптив — единая точка PRO: adaptiveV3 (EMA-28д), v1 calcAdaptiveTDEE удалён из UI
  // пот — единая точка PRO: sweatV2 (измеренный/оценка + BHI v2), v1 calcSweatTest удалён из UI
  // RED-S — единая точка PRO: cat2 (traffic-light), v1 calcRedsScreening удалён из UI
  const whtr = useMemo(()=> calcWHtR(waist, height), [waist, height]);
  const absi = useMemo(()=> calcABSI(waist, height, weight), [waist, height, weight]);
  const bai = useMemo(()=> hip ? calcBAI(hip, height) : null, [hip, height]);
  const tyg = useMemo(()=> calcTyG(tgMgDl2, glucoseMgDl), [tgMgDl2, glucoseMgDl]);
  const mets = useMemo(()=> calcMetSWrapper({ waistCm: waist, tgMgDl: tgMgDl2, hdlMgDl, systolic, diastolic, glucoseMgDl, sex }), [waist, tgMgDl2, hdlMgDl, systolic, diastolic, glucoseMgDl, sex]);
  const fib4 = useMemo(()=> calcFIB4(age, ast, alt, plt), [age, ast, alt, plt]);
  const apri = useMemo(()=> calcAPRI(ast, plt), [ast, plt]);
  const quicki = useMemo(()=> calcQUICKI(glucoseMgDl, insulinMuMl), [glucoseMgDl, insulinMuMl]);
  const caffeineCurve = useMemo(()=> calcCaffeineCurve(caffeineMg, caffeineHoursSince, weight), [caffeineMg, caffeineHoursSince, weight]);
  const refeedNeed = useMemo(()=> calcRefeedNeed(weeksInDeficit ?? 0, bodyFat, ea?.ea ?? null), [weeksInDeficit, bodyFat, ea]);
  const carbLoad = useMemo(()=> calcCarbLoading(weight, carbLoadDays, carbGPerKg), [weight, carbLoadDays, carbGPerKg]);
  const sodiumLoad = useMemo(()=> calcSodiumLoading(weight, sodiumLoadDays, sodiumGPerDay), [weight, sodiumLoadDays, sodiumGPerDay]);
  const bodyCompProj = useMemo(()=> calcBodyCompProjection({ weight, height, bodyFat: bodyFat ?? fat.current, years: projectionYears, mode: projectionMode }), [weight,height,bodyFat,fat,projectionYears,projectionMode]);
  const parsedSchedule = useMemo(()=> parseWeeklyScheduleTextPro(scheduleText), [scheduleText]);
  const scheduleMetHours = useMemo(()=> parsedSchedule ? buildMetHoursPro(parsedSchedule) : 0, [parsedSchedule]);
  // напитки — единая точка PRO: beverageV2 (BHI Maughan), v1 удалён
  // PRO v4 memos
  const adaptiveV3 = useMemo(()=>{
    if(!weightHistory || weightHistory.length<7 || !diaryAvgKcal) return null;
    // intakeHistory 28д — date-join внутри движка; гейт плотности по длине серии (окно v3), не по 7д
    return calcAdaptiveTDEEv3({ weightHistory, avgIntakeKcal: diaryAvgKcal, bodyFatPct: bodyFat, goal, logDays: intakeSeries.length, intakeHistory: intakeSeries.length>=5 ? intakeSeries : undefined });
  }, [weightHistory, diaryAvgKcal, bodyFat, goal, intakeSeries]);
  const leamCalc = useMemo(()=> calcLeamScore(leamAnswers), [leamAnswers]);
  const cat2 = useMemo(()=>{
    const rmrRatio = measuredRMR && kbju.nat.bmr ? measuredRMR/kbju.nat.bmr : undefined;
    const ls = leafCalc ? leafCalc.score : leafScore;
    return calcRedsCAT2({ ea: ea?.ea ?? null, sex, leafScore: ls, leamScore: leamCalc.score, edeScore, rmrRatio, boneFlag, menstrualFlag, lowTestosterone: lowT, lowBMD: lowBMD, ferritinLow: (ferritin ?? 999) < 30, t3Low });
  }, [ea, sex, leafScore, leafCalc, leamCalc, edeScore, measuredRMR, kbju, boneFlag, menstrualFlag, lowT, lowBMD, ferritin, t3Low]);
  const beverageV2 = useMemo(()=> sweatV2 ? calcBeverageRankV2(sweatV2.totalLossMl, sweatV2.elect.sodiumMg, sweatHours) : [], [sweatV2, sweatHours]);
  const tgHdl = useMemo(()=> calcTGHDLWrap(tgMgDl2, hdlMgDl), [tgMgDl2, hdlMgDl]);
  const bmiNow = useMemo(()=> weight / (((height||180)/100)**2), [weight, height]);
  const lapV = useMemo(()=> calcLAPWrap(waist, tgMgDl2, sex), [waist, tgMgDl2, sex]);
  const vaiV = useMemo(()=> calcVAIWrap({ waistCm: waist, bmi: bmiNow, tgMgDl: tgMgDl2, hdlMgDl, sex }), [waist, bmiNow, tgMgDl2, hdlMgDl, sex]);
  const fmiV = useMemo(()=> calcFMIWrap(weight, bodyFat ?? fat.current, height), [weight, bodyFat, fat, height]);
  const boerLBM = useMemo(()=> boerLeanBodyMass(weight, height, sex), [weight, height, sex]);
  const alcoholChronic = useMemo(()=> calcAlcoholChronic(alcoholG, alcoholDays), [alcoholG, alcoholDays]);
  const proteinPro = useMemo(()=> calcProteinTimingPro(onAAS ? kbju.aas.p : kbju.nat.p, weight, proteinMeals, proteinSource, age), [kbju, weight, onAAS, proteinMeals, proteinSource, age]);
  const neatPro = useMemo(()=> calcNEATPro({ weight, profession: profession === 'auto' ? undefined : profession, standingHours, fidgetLevel, steps, height }), [weight, profession, standingHours, fidgetLevel, steps, height]);
  const atRange = useMemo(()=> calcATRange({ tdee: stepsCalc.tdeeNat, deficitKcal: effectiveDeficit, weeksInDeficit, weightLostKg }), [stepsCalc, effectiveDeficit, weeksInDeficit, weightLostKg]);
  const reverseAuto = useMemo(()=>{
    const curKcal = diaryAvgKcal ?? kbju.nat.kcal;
    const targetKcal = stepsCalc.tdeeNat || curKcal + 400;
    const trend = adaptiveV3?.trend ?? 0;
    return calcReverseDietAuto(curKcal, targetKcal, trend);
  }, [diaryAvgKcal, kbju, adaptiveV3, stepsCalc]);
  const goalV2 = useMemo(()=> targetWeight ? calcGoalTimelineV2({ weight, targetWeight, tdee: stepsCalc.tdeeNat, bodyFat, withDietBreaks: true }) : null, [weight, targetWeight, stepsCalc, bodyFat]);
  const dietBreakPlan = useMemo(()=> {
    if(!targetWeight || !goalV2) return null;
    const weeksTotal = Math.max(4, goalV2.days/7);
    return buildDietBreakPlan(Math.ceil(weeksTotal), Math.ceil(weeksTotal*0.75));
  }, [targetWeight, goalV2]);
  const pregAdd = useMemo(()=> pregnancyAdd({ weight, height, age, sex, trimester: trimester || undefined, lactating: lactating === 'none' ? null : lactating } as any), [weight, height, age, sex, trimester, lactating]);
  const palPro = useMemo(()=> calcPALPro({ weight, height, age, sex, activityLevel: activityLevel as any, profession, metHoursPerWeek, standingHours, fidgetLevel, steps } as any), [weight, height, age, sex, activityLevel, profession, metHoursPerWeek, standingHours, fidgetLevel, steps]);
  const oneAnswer = useMemo(()=>{
    // Аудит 2026-11: `calcSteps.tdeeNat` УЖЕ содержит беременность/лактацию (pregAdd),
    // поэтому в `buildOneAnswerPro` уходит база БЕЗ неё — иначе +340/+452 считались
    // дважды (плитка TDEE и её cut/bulk-цели были завышены на 340–452 ккал).
    const baseTdee = stepsCalc.tdeeNat - pregAdd;
    // Аудит 2026-11: adaptive-v3 с 2 днями дневника и 7 взвешиваниями — это «ориентир», а не
    // TDEE (движок сам помечает adherence.sufficient=false). Такой оценкой нельзя подменять
    // главное число и все цели: она остаётся в блоке AT как ориентир, а плитка считает по формуле.
    const adaptiveTrusted = adaptiveV3 && adaptiveV3.adherence?.sufficient ? adaptiveV3 : null;
    const pro = buildOneAnswerPro({ formulaTDEE: baseTdee, adaptiveV3: adaptiveTrusted, waterMl: onAAS ? water.aas : water.nat, ea: ea?.ea ?? null, pregnancyAddKcal: pregAdd });
    return { ...pro, eaZone: ea?.zone, metsScore: mets.score, tdeeFromAdaptive: !!adaptiveTrusted };
  }, [adaptiveV3, stepsCalc, water, onAAS, ea, mets, pregAdd]);
  // модель графика v3: сырой вес (тот же фильтр, что в движке) + EMA + intake по датам
  const emaChartModel = useMemo(()=>{
    if(!adaptiveV3 || adaptiveV3.emaSeries.length<2) return null;
    const raw = weightHistory.filter(p=> typeof p.kg==='number' && isFinite(p.kg) && p.kg>20 && p.kg<400).slice(-28).map(p=>p.kg).slice(-adaptiveV3.emaSeries.length);
    if(raw.length<2) return null;
    const byDate: Record<string,number> = {};
    for(const p of intakeSeries) byDate[p.date]=p.kcal;
    return { ema: adaptiveV3.emaSeries, raw, byDate, tdee: adaptiveV3.tdee };
  }, [adaptiveV3, weightHistory, intakeSeries]);

  // Срок до цели: поле «Целевых недель» раньше ни на что не влияло.
  const deadline = useMemo(()=> {
    if (!targetWeight || !weeksToGoal) return null;
    return calcDeadlineFeasibility({
      weight, targetWeight, weeks: weeksToGoal,
      tdee: stepsCalc.tdeeNat, plannedKcal: onAAS ? kbju.aas.kcal : kbju.nat.kcal, bodyFat,
    });
  }, [targetWeight, weeksToGoal, weight, stepsCalc, onAAS, kbju, bodyFat]);

  // сценарии
  const [scenarios, setScenarios] = useState<Array<{id:string; name:string; snapshot:any}>>(()=>{
    try{ const raw=localStorage.getItem(SCENARIOS_KEY); return raw? JSON.parse(raw):[] }catch{ return [] }
  });
  const saveScenario = useCallback(()=>{
    const name = `Сценарий ${scenarios.length+1} · ${new Date().toLocaleDateString('ru-RU')} · ${weight}кг ${GOAL_LABEL[goal]}`;
    // Полный снапшот, а не 22 поля: иначе сценарий терял лабы, сон/стресс, пот, климат,
    // клетчатку/омега-3 — и сравнение сценариев физически не могло их показать.
    const next=[...scenarios, {id: Date.now().toString(), name, snapshot}].slice(-6);
    setScenarios(next); try{ localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next)); }catch{}; showToast(`Сценарий "${name}" сохранён`);
  }, [scenarios, snapshot, weight, goal, showToast]);
  const loadScenario = useCallback((id:string)=>{
    const sc=scenarios.find(s=>s.id===id); if(!sc) return;
    // Та же логика, что и для автосохранения v6: одно место правды, ничего не забыто.
    applySnapshot(sc.snapshot, { markLabs: true });
    showToast(`Сценарий "${sc.name}" загружен`);
  }, [scenarios, applySnapshot, showToast]);
  const scenarioDiff = useMemo(()=>{
    if(compareIds.length !== 2) return null;
    const a = scenarios.find(s=> s.id===compareIds[0])?.snapshot;
    const b = scenarios.find(s=> s.id===compareIds[1])?.snapshot;
    if(!a || !b) return null;
    return diffMetabolicSnapshots(a, b);
  }, [compareIds, scenarios]);
  const deleteScenario = useCallback((id:string)=>{
    const next=scenarios.filter(s=>s.id!==id); setScenarios(next); try{ localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next)); }catch{}
  }, [scenarios]);

  /** Перейти к калькулятору: режим + его группа + прокрутка к результатам. */
  const go = useCallback((m: Mode, step?: 1|2|3|4)=>{
    setMode(m);
    setGroup(GROUP_OF[m]);
    if(step) setWizardStep(step);
    requestAnimationFrame(()=> { resultsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }); });
  }, []);
  /** Перейти к шагу мастера (с подсветкой). */
  const goStep = useCallback((n: 1|2|3|4)=>{
    setWizardStep(n);
    requestAnimationFrame(()=> { wizardRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }); });
  }, []);
  /** Полный сброс ввода: снапшот + опциональные поля. Профиль и история не трогаются. */
  const resetAll = useCallback(()=>{
    try{ localStorage.removeItem(SNAP_KEY); }catch{}
    manualLabsRef.current = {};
    sweatTouchedRef.current = false;
    // Лабы и замеры
    setBodyFat(undefined);
    setHct(undefined); setHgb(undefined); setFerritin(undefined); setGfr(undefined);
    setHdlMgDl(undefined); setAst(undefined); setAlt(undefined); setPlt(undefined);
    setTgMgDl2(undefined); setGlucoseMgDl(undefined); setInsulinMuMl(undefined);
    setTsh(undefined); setFt4(undefined); setSfaG(undefined); setGgt(undefined);
    setFiberG(undefined); setOmega3G(undefined);
    setSkinfoldSum3(undefined); setSkinfoldSum4(undefined); setBiaResistance(undefined);
    setSystolic(undefined); setDiastolic(undefined);
    // Цель, дефицит, объём
    setDeficitKcal(undefined); setWeeksInDeficit(undefined); setWeightLostKg(undefined);
    setTargetWeight(undefined); setWeeksToGoal(undefined); setMetHoursPerWeek(undefined);
    setMeasuredRMR(undefined); setEdeScore(undefined); setWeeklyVolumeTons(undefined);
    // Анкеты и флаги
    setLeafAnswers(Array(8).fill(false)); setLeafScore(undefined);
    setLeamAnswers(Array(6).fill(false));
    setBoneFlag(false); setMenstrualFlag(false); setLowT(false); setLowBMD(false); setT3Low(false);
    setPostBariatric(false); setAcclimated(false); setUntreatedHypo(false); setCreatineUse(false);
    // Аудит 2026-11: «Сброс» обещал «поля снова пустые», но оставлял климат, пот, сон/стресс,
    // тест пота, расписание, загрузки, горизонт прогноза, профессию и ААС — значения
    // продолжали влиять на расчёт после сброса.
    setStress(5); setSleepHours(7); setSleepQuality(3);
    setClimate('temperate'); setHumidity(55); setStandingHours(2); setFidgetLevel(2);
    setSweatRate(600); setSweatSodium(900); setSweatIntensity('moderate'); setSweatEnv('temperate');
    setUseMeasuredSweat(true); setPreKg(weight); setPostKg(weight); setFluidL(0); setSweatHours(1);
    setAlcoholG(0); setAlcoholDays(0); setCaffeineMg(150); setCaffeineHoursSince(2);
    setWaterL(2.5); setSodiumG(3.5); setPotassiumG(3.0);
    setScheduleText('пн: силовая 1ч, вт: бег 0.5ч, чт: силовая 1ч');
    setCarbLoadDays(2); setCarbGPerKg(10); setSodiumLoadDays(2); setSodiumGPerDay(5);
    setProjectionYears(3); setProjectionMode('hold_bf'); setProteinMeals(4);
    setProfession('sedentary'); setTrimester(0); setLactating('none'); setEthnicity('european');
    setMenstrualPhase('none'); setProteinSource('mixed');
    setGoal('maintain'); setActivityLevel('medium'); setOnAAS(false); setAasDose(500);
    setCompareIds([]);
    setWizardStep(1);
    showToast('Ввод сброшен: лабы, замеры, пот, климат, сон, цель — пусто. Вес/рост/активность из профиля не тронуты');
  }, [showToast, weight]);

  const active = MODE_DEFS.find(d=> d.m===mode)!;
  const waistErr = waist && neck && waist <= neck ? 'Талия ≤ шеи — Navy невалиден' : null;
  const hipWarn = sex==='female' && (!hip || hip<80) ? 'Для женщин нужен обхват бёдер' : null;

  /** «Чего не хватает» — честный список того, без чего часть калькуляторов слепая. */
  const missing = useMemo(()=>{
    const out: Array<{ id:string; label:string; step:1|2|3|4; mode:Mode }> = [];
    if(bodyFat == null && fat.measured == null && fat.navy == null) out.push({ id:'bf', label:'% жира или замеры Navy (шея/талия)', step:1, mode:'fat' });
    if(targetWeight == null) out.push({ id:'target', label:'целевой вес — без него нет срока цели', step:4, mode:'maintenance' });
    if(metHoursPerWeek == null && !scheduleMetHours) out.push({ id:'met', label:'MET-часы/нед — честный PAL вместо догадки', step:2, mode:'steps' });
    if(weightHistory.length < 7) out.push({ id:'weights', label:`взвешивания: ${weightHistory.length}/7 для adaptive TDEE`, step:1, mode:'maintenance' });
    if(diaryDays < 7) out.push({ id:'diary', label:`дневник питания: ${diaryDays}/7 дней`, step:3, mode:'ea' });
    if(hct == null) out.push({ id:'hct', label:'гематокрит (ОАК) — шкала крови слепая', step:3, mode:'hematology' });
    if(ft4 == null && tsh == null) out.push({ id:'thyroid', label:'FT4 или TSH — поправка BMR', step:3, mode:'thyroid' });
    if(glucoseMgDl == null || insulinMuMl == null) out.push({ id:'homa', label:'глюкоза + инсулин — HOMA-IR', step:3, mode:'thyroid' });
    if(tgMgDl2 == null || hdlMgDl == null) out.push({ id:'lipids', label:'ТГ + HDL — TG/HDL, LAP, VAI', step:3, mode:'mets' });
    if(skinfoldSum3 == null && biaResistance == null) out.push({ id:'skinfold', label:'калипер (JP3) или BIA — точнее Navy', step:1, mode:'fat' });
    if(!sweatV2 || !sweatV2.measured) out.push({ id:'sweat', label:'пот-тест: вес до/после — иначе только оценка ±30%', step:2, mode:'sweat' });
    return out;
  }, [bodyFat, fat, targetWeight, metHoursPerWeek, scheduleMetHours, weightHistory, diaryDays, hct, ft4, tsh, glucoseMgDl, insulinMuMl, tgMgDl2, hdlMgDl, skinfoldSum3, biaResistance, sweatV2]);

  const applyKBJU = ()=>{
    try{
      const tgt = onAAS ? kbju.aas : kbju.nat;
      // A1-fix (2026-10-18): удалены write-only ключи he_planner_kbju_suggestion /
      // he_metabolic_last_kbju и мёртвое событие he-kbju-suggestion — никто их не
      // читал (аудит §2 A1, HUBS-PRO-MASTER-PLAN.md:128,152). Реальный мост — запись
      // в профиль (ниже): IndividualPlanContext читает manualTargets + kbjuMode.
      // Мост в планировщик: пишем в профиль `nutrition.manualTargets` + `kbjuMode='manual'` —
      // единственный канал, который Планировщик читает на живую (IndividualPlanContext).
      let profileWritten = false;
      try{
        const cur = getProfile();
        const next = { ...(cur?.settings || {}) } as any;
        const nut = { ...(next.nutrition || {}) } as any;
        nut.manualTargets = { kcal: tgt.kcal, protein: tgt.p, fat: tgt.f, carbs: tgt.c };
        // Ручные цели записаны → включаем ручной режим КБЖУ, иначе планировщик
        // игнорирует manualTargets (читает их только при kbjuMode='manual').
        nut.kbjuMode = 'manual';
        next.nutrition = nut;
        updateProfile({ settings: next } as any);
        profileWritten = true;
      }catch(e){ console.warn('[metabolic] не записал manualTargets в профиль', e); }
      const txt = `КБЖУ ${tgt.kcal}ккал Б${tgt.p} Ж${tgt.f} У${tgt.c} → ${profileWritten
        ? 'записано в профиль (Планировщик подхватит в режиме «КБЖУ — Ручной»)'
        : 'скопировано. Вставь в Планировщике (КБЖУ → Ручной)'}.`;
      if(navigator.clipboard) navigator.clipboard.writeText(`${tgt.kcal} ${tgt.p} ${tgt.f} ${tgt.c}`).catch(()=>{});
      showToast(txt);
    }catch{
      showToast('⚠ Не удалось сохранить КБЖУ — скопируй вручную');
    }
  };

  return (
    <div className="nut-metabolic" style={{ padding:'10px 8px 18px', color:'#fff', maxWidth:780, margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', left:'50%', bottom:18, transform:'translateX(-50%)', zIndex:60, maxWidth:520, padding:'10px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 8px 24px rgba(0,0,0,0.35)', fontSize:11, fontWeight:600, color:'#fff', textAlign:'center' }}>{toast}</div>}
      <ModernHero icon="⚖️" title="Метаболика Pro" subtitle="PRO v4 · Adaptive v3 rolling-28д EMA · MET-60 · CAT2 traffic-light · Пот estimated/BHI · TG/HDL/LAP/VAI · DIAAS · NEAT-профессия · AT-range · DLW ±12%" />
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(96,165,250,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(96,165,250,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#60a5fa,#00e68a)', color:'#000', fontWeight:900, fontSize:16 }}>⚖️</div>
          <div style={{ flex:1 }}>
            {/* 26 сен 2026 (E0.9): число берётся из `MODE_DEFS.length`, а не из
                литерала — раньше подпись завышала число режимов на единицу, и
                расхождение могло вернуться в любом следующем режиме. Рядом в
                подзаголовке имя модели веса приводило к устаревшей версии v2,
                тогда как в коде реализована только v3 (см. `calcAdaptiveTDEEv3`). */}
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Метаболика Pro — {MODE_DEFS.length} калькуляторов</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>IOM + Baker · FAO PAL MET-часы · 7 BMR · Navy/JP/BIA · FFMI 26.2 · SLI · Hall adaptive v3 · Levine · Trexler MATADOR · RED-S CAT2 · Пот-тест · TyG/FIB-4 · ACWR {acwr.toFixed(2)} · HCT {hematology.hct ?? '—'}% · WHtR {whtr? whtr.toFixed(2):'—'}</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${onAAS ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)'}`, color: onAAS ? '#f87171' : '#22c55e', fontWeight:800, whiteSpace:'nowrap' }}>{onAAS ? `💉 ${aasDose}мг/нед EXP` : '🌿 Натурал'}</span>
        </div>
        <div style={{ fontSize:9, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.5 }}>
          <b style={{ color:'#fff' }}>Evidence:</b> <span style={{ color:'#22c55e' }}>A</span> Helms/ISSN/Morton/Loucks/Hall · <span style={{ color:'#38bdf8' }}>B</span> Westerterp/FAO/Hodgdon/JP/Baker/Levine/Trexler · <span style={{ color:'#f59e0b' }}>C</span> Suter · <span style={{ color:'#f43f5e' }}>E</span> SLI/AAS (эвристика) ⚠️ · DLW ±12% (Westerterp) · <span style={{ color:'#f87171' }}>{AAS_EXPERIMENTAL_NOTE}</span>
        </div>
        {onAAS && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', fontSize:9, color:'#f87171', lineHeight:1.4 }}>⚠️ AAS-модель экспериментальна (Bhasin 600мг → +2кг воды ~3%, не +12%). TDEE точнее через FFM: введи BF% → Cunningham/Katch, не ×%. Белок +0.2-0.5 EXP (Helms — AAS антикатаболик).</div>}
      </div>
      {/* Сводка — 6 плиток, каждая ведёт в свой калькулятор */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:6, marginBottom:6 }}>
        <MhTile label="TDEE · DLW ±12%" accent="#22c55e"
          value={<>{oneAnswer.tdee} <span style={{ fontSize:10 }}>ккал</span></>}
          sub={<>{oneAnswer.low}–{oneAnswer.high} · {oneAnswer.tdeeFromAdaptive && adaptiveV3 ? `адаптив R²${adaptiveV3.r2} ${adaptiveV3.confidence}` : adaptiveV3 ? `формула (адаптив ${adaptiveV3.adherence.logDays}/${adaptiveV3.adherence.weighIns} — мало)` : 'по формуле'} · cut {oneAnswer.targets.cut}</>}
          active={mode==='maintenance'} onClick={()=> go('maintenance')} />
        <MhTile label="Вода" accent="#38bdf8"
          value={<>{onAAS ? water.aas : water.nat} <span style={{ fontSize:10 }}>мл</span></>}
          sub={<>{(onAAS ? water.perHourAAS : water.perHour)}мл/ч · IOM {water.iomPerKg}мл/кг{water.delta>0 ? ` · ААС +${water.delta}` : ''}</>}
          active={mode==='water'} onClick={()=> go('water')} />
        <MhTile label="КБЖУ" accent="#f59e0b"
          value={<>{onAAS ? kbju.aas.kcal : kbju.nat.kcal} <span style={{ fontSize:10 }}>ккал</span></>}
          sub={<>Б{onAAS ? kbju.aas.p : kbju.nat.p} · Ж{onAAS ? kbju.aas.f : kbju.nat.f} · У{onAAS ? kbju.aas.c : kbju.nat.c}{kbju.thyroidMult!==1 ? ` · щит ×${kbju.thyroidMult.toFixed(2)}` : ''}{(onAAS ? kbju.macroGap.aas : kbju.macroGap.nat).gapKcal > 60 ? ` · ⚖️ цель −${(onAAS ? kbju.macroGap.aas : kbju.macroGap.nat).gapKcal}` : ''}</>}
          active={mode==='kbju'} onClick={()=> go('kbju')} />
        <MhTile label="EA · RED-S" accent={ea.color}
          value={<>{ea.ea ?? '—'} <span style={{ fontSize:10 }}>ккал/кгFFM</span></>}
          sub={<>{ea.zoneLabel} · EEE {ea.eee}ккал/сут net</>}
          active={mode==='ea'} onClick={()=> go('ea')} />
        <MhTile label="Кровь · HCT" accent={hematology.color}
          value={<>{hematology.hct != null ? `${hematology.hct}%` : '—'} <span style={{ fontSize:10 }}>{hematology.zoneLabel}</span></>}
          sub={hematology.hct == null ? 'введи HCT из ОАК' : `${hematology.waterTargetMl}мл · ${hematology.ironRecLabel.split(' —')[0]}`}
          active={mode==='hematology'} onClick={()=> go('hematology')} />
        <MhTile label="Жир · FFMI" accent="#a78bfa"
          value={<>{fat.current}% <span style={{ fontSize:10 }}>FFMI {onAAS ? fat.ffmiNormAdj : fat.ffmiNorm}</span></>}
          sub={<>{bodyFat == null ? 'оценка по замерам/Deurenberg · ' : ''}лимит 26.2 {(onAAS ? fat.isOverNatLimitAAS : fat.isOverNatLimit) ? '⚠' : '✓'}</>}
          active={mode==='fat'} onClick={()=> go('fat')} />
      </div>
      <div style={{ ...CARD, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
        {adaptiveV3
          ? <div style={{ fontSize:9, color: adaptiveV3.confidence==='high'?'#22c55e': adaptiveV3.confidence==='medium'?'#f59e0b':'#f87171' }}>Adaptive v3 (28д EMA): {adaptiveV3.tdee}ккал [{adaptiveV3.low}–{adaptiveV3.high}] · {oneAnswer.tdeeFromAdaptive ? 'в TDEE' : 'ориентир, в TDEE — формула'} · {adaptiveV3.adherence.note} · PALpro {palPro.toFixed(2)}</div>
          : <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>TDEE по формуле — adaptive v3 включится после 7 взвешиваний и дневника (сейчас {weightHistory.length}/{diaryDays}).</div>}
        {adaptiveV3?.plateau && <div style={{ fontSize:9, color:'#fbbf24' }}>⏸ Плато: тренд {adaptiveV3.trend}кг/нед · AT {adaptiveV3.atKcal}ккал — проверь дефицит и шаги</div>}
        {cat2.light !== 'green' && <div style={{ fontSize:9, color: cat2.color }}>CAT2 {cat2.light.toUpperCase()}: {cat2.note}</div>}
        {alcoholChronic.risk !== 'low' && <div style={{ fontSize:9, color: alcoholChronic.risk==='high'?'#ef4444':'#f59e0b' }}>{alcoholChronic.note}</div>}
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>TG/HDL {tgHdl ?? '—'}{tgHdl && tgHdl>=3.5?' ⚠ IR':''} · LAP {lapV ?? '—'} · VAI {vaiV ?? '—'} · FMI {fmiV ?? '—'} · NEAT {neatPro.total} · AT {atRange.low}–{atRange.high} · DIAAS {proteinPro.diaas}{pregAdd ? ` · 🤰 +${pregAdd}ккал` : ''}</div>
      </div>

      {/* Чего не хватает — честный список слепых зон с быстрым переходом */}
      <MhSection icon="🧩" accent={missing.length===0 ? '#22c55e' : '#f59e0b'} title="Чего не хватает"
        hint={missing.length===0 ? 'Все ключевые входы заполнены — расчёты полные' : `${missing.length} входов не задано — эти калькуляторы работают вслепую`}>
        {missing.length === 0 ? (
          <div style={{ fontSize:10, color:'#22c55e' }}>✓ Замеры, лабы и цель на месте. Дальше — только обновлять по мере новых данных.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {missing.map(m=> (
              <button key={m.id} type="button" onClick={()=> go(m.mode, m.step)} className="mh-missing"
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', minHeight:44, padding:'7px 10px', borderRadius:10, cursor:'pointer', textAlign:'left', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(245,158,11,0.18)', color:'#fff' }}>
                <span style={{ fontSize:11, color:'#fbbf24' }}>•</span>
                <span style={{ flex:1, fontSize:10, lineHeight:1.3 }}>{m.label}</span>
                <span style={{ fontSize:8, color:'#fbbf24', whiteSpace:'nowrap' }}>Шаг {m.step} →</span>
              </button>
            ))}
          </div>
        )}
      </MhSection>
      {/* Мастер: 4 шага — всё, что нужно ввести, в одном месте */}
      <div ref={wizardRef} id="mh-wizard" style={{ ...CARD, padding:10, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:6 }}>
          {STEP_DEFS.map(s=> (
            <button key={s.n} onClick={()=> goStep(s.n)} aria-current={wizardStep===s.n} aria-label={`Шаг ${s.n}: ${s.title}`} className="mh-seg"
              style={{ minHeight:52, borderRadius:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'6px 4px',
                border: wizardStep===s.n ? '1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)',
                background: wizardStep===s.n ? 'rgba(96,165,250,0.14)':'rgba(255,255,255,0.02)',
                color: wizardStep===s.n ? '#60a5fa':'#fff' }}>
              <span style={{ fontSize:13 }}>{s.icon}</span>
              <span style={{ fontSize:9, fontWeight:800 }}>{s.n}. {s.title}</span>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={()=> goStep((wizardStep>1 ? wizardStep-1 : 1) as 1|2|3|4)} disabled={wizardStep===1} className="mh-act"
            style={{ minHeight:44, padding:'8px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color: wizardStep===1 ? 'rgba(255,255,255,0.35)' : '#fff', fontSize:10, fontWeight:700, cursor: wizardStep===1 ? 'default':'pointer' }}>← Назад</button>
          <div style={{ flex:1, fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1.3 }}>
            Шаг {wizardStep} из {STEP_DEFS.length} · {STEP_DEFS[wizardStep-1].hint}
          </div>
          <button onClick={()=> goStep((wizardStep<4 ? wizardStep+1 : 4) as 1|2|3|4)} disabled={wizardStep===4} className="mh-act"
            style={{ minHeight:44, padding:'8px 12px', borderRadius:10, border:'1px solid rgba(96,165,250,0.22)', background:'rgba(96,165,250,0.12)', color: wizardStep===4 ? 'rgba(255,255,255,0.35)' : '#60a5fa', fontSize:10, fontWeight:800, cursor: wizardStep===4 ? 'default':'pointer' }}>Далее →</button>
        </div>
      </div>

      {/* Натурал / ААС — один переключатель на весь хаб */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=> setOnAAS(false)} aria-pressed={!onAAS} className="mh-seg" style={{ flex:1, minHeight:48, borderRadius:12, cursor:'pointer', fontSize:12, fontWeight:800, border: !onAAS ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !onAAS ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.02)', color: !onAAS ? '#22c55e' : '#fff' }}>🌿 Без ААС</button>
          <button onClick={()=> setOnAAS(true)} aria-pressed={onAAS} className="mh-seg" style={{ flex:1, minHeight:48, borderRadius:12, cursor:'pointer', fontSize:12, fontWeight:800, border: onAAS ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)', color: onAAS ? '#f87171' : '#fff' }}>💉 С ААС</button>
        </div>
        {onAAS && (
          <div style={{ marginTop:8 }}>
            <MhGrid>
              <PopupNumber label="Доза ААС, мг/нед" value={aasDose} min={0} max={3000} step={25} onChange={setAasDose} />
              <div style={{ display:'flex', alignItems:'center', fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.14)', borderRadius:10, padding:'8px 10px' }}>Вода, белок, FFMI и TDEE считаются в двух колонках — сравнивай справа.</div>
            </MhGrid>
          </div>
        )}
      </div>

      {/* ── Шаг 1. Тело ─────────────────────────────────────────────── */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10, display: wizardStep===1 ? 'block' : 'none' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'#60a5fa', marginBottom:8 }}>🧍 1. Тело — кто мы считаем</div>
        <MhGrid>
          <PopupNumber label="Вес, кг" value={weight} min={30} max={200} onChange={setWeight} />
          <PopupNumber label="Рост, см" value={height} min={140} max={220} onChange={setHeight} />
          <PopupNumber label="Возраст" value={age} min={14} max={80} onChange={setAge} />
          <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'♂ Мужчина'},{id:'female',label:'♀ Женщина'}]} onChange={v=> setSex(v as any)} />
          <MhNum label="Жир, % (если измерен)" value={bodyFat} min={3} max={55} suffix=" %" optional
            hint="Если пусто — % жира оценивается по замерам (Navy/JP/BIA) или Deurenberg, и это будет подписано как оценка."
            onChange={setBodyFat} />
          <PopupSelect label="Белок DIAAS" value={proteinSource} options={[{id:'mixed',label:'Смешанный 0.95'},{id:'whey',label:'Whey 1.09'},{id:'milk',label:'Молоко 1.14'},{id:'egg',label:'Яйцо 1.13'},{id:'beef',label:'Говядина 1.10'},{id:'chicken',label:'Курица 1.08'},{id:'fish',label:'Рыба 1.05'},{id:'casein',label:'Казеин 1.12'},{id:'soy',label:'Соя 0.90'},{id:'pea',label:'Горох 0.58'},{id:'rice',label:'Рис 0.59'},{id:'blend_plant',label:'Бленд 0.75'}]} onChange={setProteinSource} />
          <MhNum label="Цель вес, кг" value={targetWeight} min={35} max={200} suffix=" кг" optional
            hint="Нужен для срока цели, diet-break и проекции. Без него эти блоки честно пустые."
            onChange={setTargetWeight} />
          <div style={{ display:'flex', alignItems:'center', gap:6, gridColumn:'1 / -1' }}>
            <MhToggle checked={creatineUse} onChange={setCreatineUse} icon="💊" title="Креатин 5 г/сут" desc="сила · масса · вода в мышцах (1-я нед)" accent="#84cc16" />
          </div>
        </MhGrid>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:8, lineHeight:1.4 }}>
          BMR: {bmrMethodLabel(kbju.nat.method)} · {kbju.nat.bmr}ккал · PAL {kbju.nat.pal.toFixed(2)} (pro {palPro.toFixed(2)}) · TDEE {stepsCalc.tdeeNat} · TEF {kbju.tefNat}ккал · DIAAS {proteinPro.diaas} · лейцин {proteinPro.leucinePerMeal}г/приём
          {kbju.bmrSpread && <span> · по другим формулам {kbju.bmrSpread.min}–{kbju.bmrSpread.max} ({kbju.bmrSpread.spreadPct}%) — часть формул к вам неприменима, это не точность расчёта</span>}
        </div>
        {sex==='female' && (
          <div style={{ marginTop:8 }}>
            <MhGrid>
              <PopupSelect label="Фаза цикла" value={menstrualPhase} options={[{id:'none',label:'—'},{id:'follicular',label:'Фолликулярная'},{id:'luteal',label:'Лютеиновая +250ккал +1кг воды'}]} onChange={v=> setMenstrualPhase(v as any)} />
              <div style={{ display:'flex', alignItems:'center', fontSize:8, color:'rgba(255,255,255,0.5)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px' }}>{kbju.lutealAdd ? `+${kbju.lutealAdd}ккал и +1.2кг воды (Benton 2021)` : '— фолликулярная фаза'}</div>
            </MhGrid>
          </div>
        )}

        {/* Пресеты — быстрый старт по типовым профилям */}
        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.55)', textTransform:'uppercase' }}>⚡ Пресеты</span>
            {[
              { label:'Офис 70кг', act:()=>{ setWeight(70); setHeight(175); setAge(30); setActivityLevel('low' as any); setTrainingDays(3); setCardioMin(60); } },
              { label:'Атлет 90кг', act:()=>{ setWeight(90); setHeight(185); setAge(28); setActivityLevel('medium' as any); setTrainingDays(5); setCardioMin(120); setBodyFat(12); } },
              { label:'Тяж 110кг', act:()=>{ setWeight(110); setHeight(190); setAge(32); setActivityLevel('high' as any); setTrainingDays(6); setCardioMin(150); setBodyFat(18); } },
              { label:'Бикини 55кг', act:()=>{ setWeight(55); setHeight(165); setAge(26); setSex('female' as any); setActivityLevel('medium' as any); setTrainingDays(4); setBodyFat(18); } },
            ].map(p=> <button key={p.label} onClick={p.act} className="mh-preset" style={{ padding:'6px 10px', minHeight:44, borderRadius:20, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>{p.label}</button>)}
          </div>
        </div>
      </div>

      {/* ── Шаг 2. Активность ───────────────────────────────────────── */}
      <div style={{ display: wizardStep===2 ? 'block' : 'none' }}>
      <MhSection icon="🏃" accent="#22c55e" title="2. Активность" hint="NEAT + EAT: шаги, тренировки и профессия двигают PAL и TDEE. Пот и климат — воду.">
        <MhGrid>
          <PopupSelect label="Бытовая" value={activityLevel} options={[{id:'low',label:'Низкая (офис)'},{id:'medium',label:'Средняя'},{id:'high',label:'Высокая (на ногах)'}]} onChange={v=> setActivityLevel(v as any)} />
          <PopupSelect label="Профессия (FAO PAL)" value={profession} options={[{id:'auto',label:'Не указана → по бытовой'},{id:'sedentary',label:'Офис 1.40'},{id:'standing',label:'На ногах 1.55'},{id:'physical',label:'Физическая 1.75'}]} onChange={v=> setProfession(v as any)} />
          <PopupNumber label="Тренировок/нед" value={trainingDays} min={0} max={7} onChange={setTrainingDays} />
          <PopupNumber label="Кардио мин/нед" value={cardioMin} min={0} max={600} onChange={setCardioMin} />
          <PopupNumber label="Шаги/сут факт" value={steps} min={0} max={32000} onChange={setSteps} />
          <PopupNumber label="Стоя, ч/сут" value={standingHours} min={0} max={12} step={0.5} onChange={setStandingHours} />
          <PopupSelect label="Fidget" value={String(fidgetLevel)} options={[{id:'1',label:'Низкий'},{id:'2',label:'Средний'},{id:'3',label:'Высокий (+90ккал)'}]} onChange={v=> setFidgetLevel(Number(v) as any)} />
          <MhNum label="Тоннаж, т/нед" value={weeklyVolumeTons} min={0} max={80} suffix=" т" optional
            hint="Нужен только для объёма силовой: используется в заметках, на TDEE не влияет."
            onChange={setWeeklyVolumeTons} />
          <MhNum label="MET-часы/нед" value={metHoursPerWeek} min={0} max={120} suffix=" MET·ч" optional
            hint="Честный PAL по Ainsworth: 3 силовые × 6 MET × 1ч = 18 MET·ч/нед → +0.12 PAL. Пусто = оценка по шагам/тренировкам."
            onChange={setMetHoursPerWeek} />
          <MhNum label="Пот, мл/ч" value={sweatRate} min={200} max={2000} suffix=" мл/ч"
            hint="Baker 2017: 400–800 мл/ч в среднем, до 2000 в жару. Идёт в воду, когда пот-тест стоит в режиме «Оценка» — измеренный пот подставляется сам."
            onChange={v=> setSweatRate(v ?? 600)} />
          <MhNum label="Na пота, мг/л" value={sweatSodium} min={200} max={2000} suffix=" мг/л"
            hint="Индивидуально 200–1800 мг/л; 900 = среднее. Точное значение — полоской пота."
            onChange={v=> setSweatSodium(v ?? 900)} />
          <PopupSelect label="Климат" value={climate} options={[{id:'temperate',label:'Умеренный'},{id:'hot',label:'Жара +0.6л'},{id:'cold',label:'Холод −0.15л'}]} onChange={v=> setClimate(v as any)} />
          <MhNum label="Влажность, %" value={humidity} min={0} max={100} suffix=" %" optional
            hint="Учитывается только в жаре: каждая точка выше 60% добавляет ~8 мл/сут испарением."
            onChange={setHumidity} />
        </MhGrid>
        <div style={{ fontSize:8, color:'#06b6d4', marginTop:6, lineHeight:1.4 }}>
          💧 В воду идёт {effectiveSweatMlPerH} мл/ч
          {measuredSweatMlPerH != null
            ? ` — измерено пот-тестом (${sweatV2?.rateLPerH.toFixed(2)} л/ч); ручное ${sweatRate} вернётся в режиме «Оценка»`
            : ' — ручное значение (измеренный пот подставится после взвешивания до/после)'}
          {' · '}Na {effectiveSweatNaMgPerL} мг/л{acclimated ? ' (акклиматизация −40%, Periard)' : ''}
        </div>
        <div style={{ marginTop:6 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', marginBottom:4 }}>Расписание (plain-English):</div>
          <textarea value={scheduleText} onChange={e=> setScheduleText(e.target.value)} placeholder="пн: силовая 1ч, вт: бег 0.5ч, чт: силовая 1ч, сб: ходьба 1ч" style={{ width:'100%', minHeight:48, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:9, padding:'8px 10px', resize:'vertical' }} />
          {parsedSchedule && <div style={{ fontSize:8, color:'#22c55e', marginTop:4 }}>Распознано: {parsedSchedule.map(s=>`${s.key} ${s.hours}ч`).join(', ')} → {scheduleMetHours} MET-ч/нед → PAL +{(scheduleMetHours*0.0067).toFixed(2)} <button onClick={()=> setMetHoursPerWeek(scheduleMetHours)} className="mh-mini" style={{ marginLeft:6, padding:'8px 10px', minHeight:44, borderRadius:8, border:'1px solid rgba(34,197,94,0.18)', background:'rgba(34,197,94,0.10)', color:'#22c55e', fontSize:10, fontWeight:700, cursor:'pointer' }}>→ Применить</button></div>}
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>
          {metHoursPerWeek ? `MET ${metHoursPerWeek}ч/нед → честный PAL ${stepsCalc.pal.toFixed(2)} (Ainsworth) · PALpro ${palPro.toFixed(2)} (${profession === 'auto' ? `база из бытовой «${activityLevel}»` : `профессия ${profession} ${PROFESSION_PAL[profession]}`})` : 'Подсказка: 3× силовая 6 MET ×1ч =18 MET-ч/нед → +0.12 PAL. Парсер v2 понимает км и 2×, EN+RU, 60 активностей.'}
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:4 }}>
          База PAL: {profession === 'auto' ? `бытовая «${activityLevel}»` : `профессия ${PROFESSION_PAL[profession]}`} — профессия и «бытовая» описывают один и тот же день, поэтому считается только одна: профессия перекрывает «бытовую». Выбери «Не указана», чтобы работать по бытовой.
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал · {stepsCalc.kcalPerStep}ккал/шаг · NEAT {stepsCalc.neat} (pro {neatPro.total}) · EAT {stepsCalc.eat} · ACWR {acwr.toFixed(2)}{pregAdd ? ` · 🤰 +${pregAdd}` : ''}</div>
        {adaptiveV3 && <div style={{ fontSize:8, color: adaptiveV3.confidence==='high'?'#22c55e':'#f59e0b', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.14)', borderRadius:8, padding:'6px 8px', marginTop:4 }}>Adaptive v3 EMA-28д: {adaptiveV3.tdee} [{adaptiveV3.low}–{adaptiveV3.high}] R²{adaptiveV3.r2} {adaptiveV3.confidence} · {adaptiveV3.adherence.note} · reverse-auto шаг {reverseAuto[0]?.kcal ?? '—'}</div>}
        {!adaptiveV3 && weightHistory.length>=1 && weightHistory.length<7 && <div style={{ marginTop:4, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>Адаптивный TDEE v3: нужно ≥7 взвешиваний + логи питания (сейчас {weightHistory.length}/{diaryDays}) — данные из he_nutrition_v2.</div>}
      </MhSection>
      </div>

      {/* ── Шаг 1. Замеры и состав тела ─────────────────────────────── */}
      <div style={{ display: wizardStep===1 ? 'block' : 'none' }}>
      <MhSection icon="📏" accent="#a78bfa" title="Замеры и состав тела" hint="Navy по умолчанию; калипер и BIA уточняют. Пустое поле — честно «не задано», движок берёт оценку и это подписывает.">
        <MhGrid>
          <PopupNumber label="Шея, см" value={neck} min={28} max={60} onChange={setNeck} />
          <PopupNumber label="Талия, см" value={waist} min={55} max={150} onChange={setWaist} />
          {sex==='female' && <PopupNumber label="Бёдра, см (Ж)" value={hip} min={75} max={145} onChange={setHip} />}
          {sex==='male' && <div style={{ display:'flex', alignItems:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.55)' }}>Бёдра — только для ♀ формулы</div>}
          <MhNum label="JP3 сумма, мм" value={skinfoldSum3} min={8} max={150} suffix=" мм" optional
            hint="Jackson-Pollock 3: грудь+живот+бедро (М) / трицепс+надвздошный+бедро (Ж). Точность ±3% (Siri)."
            onChange={setSkinfoldSum3} />
          <MhNum label="Durnin 4, мм" value={skinfoldSum4} min={10} max={200} suffix=" мм" optional
            hint="Durnin-Womersley 1974: бицепс+трицепс+лопатка+подвздошный. Точность ±4%."
            onChange={setSkinfoldSum4} />
          <MhNum label="BIA, Ом" value={biaResistance} min={350} max={900} suffix=" Ом" optional
            hint="Kyle 2004: валидно 400–900 Ом, вне диапазона значение не используется."
            onChange={setBiaResistance} />
          <MhNum label="SFA, г/сут" value={sfaG} min={5} max={80} suffix=" г" optional
            hint="Насыщенные жиры для Mensink 2003: +10 г SFA ≈ +12 мг/дл LDL."
            onChange={setSfaG} />
          <MhNum label="Клетчатка, г/сут" value={fiberG} min={5} max={80} suffix=" г" optional
            hint="Mensink: +10 г клетчатки ≈ −5 мг/дл LDL. Пусто — берётся цель из КБЖУ."
            onChange={setFiberG} />
          <MhNum label="Омега-3, г/сут" value={omega3G} min={0} max={10} step={0.5} suffix=" г" optional
            hint="EPA+DHA; для профиля «Здоровье» цель ≥2 г."
            onChange={setOmega3G} />
          <MhNum label="ТГ, мг/дл" value={tgMgDl2} min={40} max={400} suffix=" мг/дл" optional
            hint="Триглицериды: TG/HDL, LAP, VAI и TyG."
            onChange={markManualLab('tg', setTgMgDl2)} />
          <MhNum label="GGT, Ед/л" value={ggt} min={8} max={150} suffix=" Ед/л" optional
            hint="FLI Bedogni: BMI + талия + ТГ + GGT."
            onChange={setGgt} />
          <MhToggle checked={untreatedHypo} onChange={setUntreatedHypo} icon="🦋" title="Нелечёный гипотиреоз" desc="BMR −12% (Kim 2014)" accent="#f59e0b" span />
        </MhGrid>
        {(waistErr || hipWarn) && <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fbbf24' }}>{waistErr || hipWarn}</div>}
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>{fat.accuracy} · {fat.note}</div>
        {fat.deurenbergWarn && <div style={{ marginTop:6, fontSize:8, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.12)', borderRadius:8, padding:'6px 8px' }}>{fat.deurenbergWarn}</div>}
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>
          Сравнение методов: Navy {fat.navy ?? '—'}% · JP {fat.jp ?? '—'}% · Durnin {fat.durnin ?? '—'}% · BIA {fat.bia ?? '—'}% · BAI {bai ?? '—'}% · WHtR {whtr?.toFixed(2) ?? '—'} · Boer LBM ~{boerLBM}кг (только вес/рост/пол) · Deur {fat.deurenberg}% {fat.deurenbergWarn? '⚠':''} — Δ {(fat.jp != null && fat.navy != null ? Math.abs(fat.jp - fat.navy).toFixed(1) : '—')}пп между Navy/JP.
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>JP3 ±3% Siri · Durnin ±4% · BIA Kyle 400-900 Ом · Mensink 10г SFA +12 LDL / 10г клетчатки −5 · FLI Bedogni &lt;30 исключает стеатоз, &gt;60 подтверждает.</div>
        <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.12)' }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a78bfa', marginBottom:6 }}>📈 Проекция тела на {projectionYears}г · {projectionMode==='hold_bf'?'hold BF': projectionMode==='hold_weight'?'hold Вес':'hold FFMI'}</div>
          <div style={{ display:'flex', gap:4, marginBottom:6 }}>
            <PopupSelect label="Лет" value={String(projectionYears)} options={[{id:'1',label:'1г'},{id:'2',label:'2г'},{id:'3',label:'3г'},{id:'5',label:'5г'}]} onChange={v=> setProjectionYears(Number(v) as any)} />
            <PopupSelect label="Режим" value={projectionMode} options={[{id:'hold_bf',label:'BF const'},{id:'hold_weight',label:'Вес const'},{id:'hold_ffmi',label:'FFMI const'}]} onChange={v=> setProjectionMode(v as any)} />
          </div>
          <div style={{ display:'flex', gap:3, alignItems:'end', height:44 }}>
            {bodyCompProj.map((p,i)=>(
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:'100%', height: Math.max(6, Math.min(40, (p.ffmi-16)*6)), borderRadius:3, background: p.ffmi>25?'#ef4444': p.ffmi>22?'#f59e0b':'#a78bfa', border:'1px solid rgba(255,255,255,0.08)' }} title={`Год ${p.year}: ${p.weight}кг BF ${p.bodyFat}% FFMI ${p.ffmi}`} />
                <span style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{p.year}г</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:4 }}><span>{bodyCompProj[0]?.weight}кг → {bodyCompProj[bodyCompProj.length-1]?.weight}кг</span><span>FFMI {bodyCompProj[0]?.ffmi} → {bodyCompProj[bodyCompProj.length-1]?.ffmi}</span></div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:4 }}>Модель: +0.4 FFMI/г 2 года, затем +0.15 (Morton) до 26.2 cap · sensitivity ±3% BF → ±0.6 FFMI · ±10% TEE envelope.</div>
        </div>
      </MhSection>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10, display: wizardStep===2 ? 'block' : 'none' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>💦 Пот-тест PRO — ② Активность</div>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button onClick={()=> setUseMeasuredSweat(true)} style={{ flex:1, minHeight:44, borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:800, border: useMeasuredSweat?'1px solid #06b6d4':'1px solid rgba(255,255,255,0.08)', background: useMeasuredSweat?'rgba(6,182,214,0.12)':'rgba(255,255,255,0.02)', color: useMeasuredSweat?'#06b6d4':'#fff' }}>⚖️ Взвешивание (точно)</button>
          <button onClick={()=> setUseMeasuredSweat(false)} style={{ flex:1, minHeight:44, borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:800, border: !useMeasuredSweat?'1px solid #06b6d4':'1px solid rgba(255,255,255,0.08)', background: !useMeasuredSweat?'rgba(6,182,214,0.12)':'rgba(255,255,255,0.02)', color: !useMeasuredSweat?'#06b6d4':'#fff' }}>📊 Оценка (ACSM ±30%)</button>
        </div>
        {useMeasuredSweat ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Вес до, кг" value={preKg} min={40} max={150} step={0.1} onChange={(v)=>{ sweatTouchedRef.current = true; setPreKg(v); }} />
          <PopupNumber label="Вес после, кг" value={postKg} min={40} max={150} step={0.1} onChange={(v)=>{ sweatTouchedRef.current = true; setPostKg(v); }} />
          <PopupNumber label="Выпито, л" value={fluidL} min={0} max={5} step={0.1} onChange={setFluidL} />
          <PopupNumber label="Длительность, ч" value={sweatHours} min={0.3} max={6} step={0.25} onChange={setSweatHours} />
        </div>
        ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupSelect label="Интенсивность" value={sweatIntensity} options={[{id:'easy',label:'Легко 0.7 л/ч'},{id:'moderate',label:'Средне 1.0'},{id:'hard',label:'Тяжело 1.4'}]} onChange={v=> setSweatIntensity(v as any)} />
          <PopupSelect label="Среда" value={sweatEnv} options={[{id:'cool',label:'Прохладно ×0.75'},{id:'temperate',label:'Умеренно ×1'},{id:'hot',label:'Жара ×1.5'},{id:'hot_humid',label:'Жара+влажн ×1.9'}]} onChange={v=> setSweatEnv(v as any)} />
          <PopupNumber label="Длительность, ч" value={sweatHours} min={0.3} max={6} step={0.25} onChange={setSweatHours} />
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px' }}>Оценка ±30% — для точности взвесься до/после</div>
        </div>
        )}
        {sweatV2 ? (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(6,182,214,0.08)', border:'1px solid rgba(6,182,214,0.18)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
            <b style={{color:'#06b6d4'}}>Пот {sweatV2.rateLPerH.toFixed(2)}л/ч{sweatV2.measured ? '' : ' (оценка)'} · потеря {sweatV2.totalLossMl}мл за {sweatHours}ч · Na {Math.round(sweatV2.elect.sodiumMg)}мг Cl {sweatV2.elect.chlorideMg} · {sweatV2.plan.note}</b>
            {sweatV2.plan.hyponatremiaRisk && <span style={{ display:'block', color:'#ef4444', marginTop:4 }}>⚠ Гипонатриемия риск (Hew-Butler) — не пей &gt;1л/ч plain water на 4ч+ без Na</span>}
            <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:4 }}>Pre {sweatV2.plan.preMl}мл + During {sweatV2.plan.duringMlPerH}мл/ч + Post {sweatV2.plan.postMl}мл · бутылок 0.5л: {sweatV2.plan.bottles05} · {sweatV2.rangeNote}</span>
            <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)' }}>BHI-рейтинг: {beverageV2.slice(0,3).map(b=>`${b.name} ×${b.score}`).join(' · ')}</div>
            {sweatV2 && <div style={{ marginTop:6, fontSize:8, color:'#06b6d4', background:'rgba(6,182,214,0.06)', border:'1px solid rgba(6,182,214,0.12)', borderRadius:8, padding:'6px 8px' }}>PRO v2 {sweatV2.measured ? 'измеренный' : 'оценка ACSM'}: {sweatV2.rateLPerH.toFixed(2)} л/ч · {sweatV2.rangeNote} · BHI-топ: {beverageV2.slice(0,3).map(b=>`${b.name} BHI${b.bhi}`).join(' · ')}</div>}
          </div>
        ) : <div style={{ marginTop:8, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>Формула: (до − после + выпито)/часы. 1кг =1л пота. Тестируй в условиях гонки. Пока измерения нет, в воду идёт {effectiveSweatMlPerH} мл/ч (ручное значение из шага ②).</div>}
        {/* Профили пота — вне карточки результата: без замера их тоже надо видеть/применять.
            Аудит 2026-11: профиль только сохранялся и никуда не применялся («cool 1.10 л/ч»
            в списке не влиял ни на воду, ни на электролиты). */}
        <div style={{ marginTop:8, display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>Профили (нажми — применить):</span>
          {(['cool','warm','hot'] as const).map(k=>(
            <button key={k} type="button" disabled={!sweatProfiles[k]} aria-label={`Применить профиль пота ${k}${sweatProfiles[k] ? `: ${sweatProfiles[k].rate.toFixed(2)} л/ч, Na ${Math.round(sweatProfiles[k].sodium)}` : ' — не сохранён'}`} onClick={()=>{
              const prof = sweatProfiles[k]; if(!prof) return;
              setSweatRate(Math.round(prof.rate*1000));
              setSweatSodium(Math.round(prof.sodium));
              setUseMeasuredSweat(false);
              showToast(`Профиль ${k} применён: ${prof.rate.toFixed(2)} л/ч, Na ${Math.round(prof.sodium)} → режим «Оценка»`);
            }} style={{ padding:'6px 10px', minHeight:44, borderRadius:8, border:'1px solid rgba(6,182,214,0.18)', background: sweatProfiles[k] ? 'rgba(6,182,214,0.14)':'rgba(255,255,255,0.03)', color: sweatProfiles[k] ? '#06b6d4':'rgba(255,255,255,0.35)', fontSize:9, cursor: sweatProfiles[k] ? 'pointer':'not-allowed' }}>{k} {sweatProfiles[k] ? `${sweatProfiles[k].rate.toFixed(2)}л/ч` : '—'}</button>
          ))}
        </div>
        <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>Сохранить текущий как:</span>
          {(['cool','warm','hot'] as const).map(k=>(
            <button key={k} type="button" disabled={!sweatV2} aria-label={`Сохранить текущий пот как профиль ${k}`} onClick={()=>{
              if(!sweatV2) return;
              const prof={ rate: sweatV2.rateLPerH, sodium: sweatSodium };
              const next={...sweatProfiles, [k]: prof};
              setSweatProfiles(next);
              try{ localStorage.setItem('he_sweat_profiles_v1', JSON.stringify(next)); }catch{}
              showToast(`Профиль ${k} сохранён: ${prof.rate.toFixed(2)}л/ч Na ${prof.sodium}`);
            }} style={{ padding:'6px 10px', minHeight:44, borderRadius:8, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.03)', color: sweatV2 ? '#fff':'rgba(255,255,255,0.35)', fontSize:9, cursor: sweatV2 ? 'pointer':'not-allowed' }}>💾 {k}</button>
          ))}
        </div>
        <div style={{ marginTop:8 }}>
          <MhToggle checked={acclimated} onChange={setAcclimated} icon="🌡" title="Акклиматизация 10–14 дней" desc="объём +10–20%, Na −40% (Periard)" accent="#06b6d4" />
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>Акклиматизация 10-14д: объём +10-20%, Na −40% (Periard) — тогл выше. 3 профиля — cool/warm/hot. Оценка ACSM ±30% по интенсивности/среде/весу.</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10, display: wizardStep===3 ? 'block' : 'none' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>🧪 Метаболический синдром · ATP III — ③ Лабы</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <MhNum label="HDL, мг/дл" value={hdlMgDl} min={20} max={120} suffix=" мг/дл" optional hint="ATP III: <40 (М) / <50 (Ж) — критерий MetS." onChange={markManualLab('hdl', setHdlMgDl)} />
          <MhNum label="Сис. АД" value={systolic} min={80} max={200} suffix=" мм" optional hint="ATP III: ≥130/85 — критерий MetS." onChange={setSystolic} />
          <MhNum label="Диас. АД" value={diastolic} min={50} max={130} suffix=" мм" optional hint="ATP III: ≥85 — критерий MetS." onChange={setDiastolic} />
          <MhNum label="AST, Ед/л" value={ast} min={10} max={200} suffix=" Ед/л" optional hint="FIB-4 и APRI (вместе с ALT и тромбоцитами)." onChange={markManualLab('ast', setAst)} />
          <MhNum label="ALT, Ед/л" value={alt} min={10} max={300} suffix=" Ед/л" optional hint="FIB-4 и APRI." onChange={markManualLab('alt', setAlt)} />
          <MhNum label="Тромбоциты, 10⁹/л" value={plt} min={100} max={500} suffix=" 10⁹/л" optional hint="FIB-4: числитель — возраст × AST / (тромбоциты × √ALT)." onChange={markManualLab('plt', setPlt)} />
        </div>
        <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div style={{ padding:8, borderRadius:8, background: mets.hasMetS ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.08)', border:`1px solid ${mets.hasMetS ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, fontSize:9, color: mets.hasMetS ? '#f87171':'#22c55e', textAlign:'center' }}>{mets.note} · {mets.criteria.join(', ') || 'критериев 0'}</div>
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', textAlign:'center' }}>WHtR {whtr? whtr.toFixed(3):'—'} {whtr && whtr>=0.5?'⚠ &gt;0.5':''} · ABSI {absi? absi.toFixed(3):'—'} · BAI {bai ?? '—'} · TyG {tyg ?? '—'} {tyg && tyg>=8.8?'⚠':''} · FIB-4 {fib4 ?? '—'} {fib4 && fib4>1.3?'⚠':''} · QUICKI {quicki ?? '—'}</div>
        </div>
        <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>TG/HDL<br/><b style={{color: tgHdl && tgHdl>=3.5?'#ef4444':'#22c55e'}}>{tgHdl ?? '—'}</b>{tgHdl && tgHdl>=3.5?' ⚠ IR':''}</div>
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>LAP<br/><b style={{color:'#fff'}}>{lapV ?? '—'}</b></div>
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>VAI / FMI<br/><b style={{color: vaiV && vaiV>2?'#f59e0b':'#fff'}}>{vaiV ?? '—'}</b> / {fmiV ?? '—'}</div>
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:6 }}>WHtR ≥0.5 риск, ABSI &gt;0.083 риск, TyG ≥8.8 IR, TG/HDL ≥3.5 IR (McLaughlin), LAP Kahn, VAI Amato &gt;2 риск, FMI Kelly, FIB-4 &lt;1.30 низкий &gt;2.67 высокий, QUICKI &lt;0.33 IR. ATP III ≥3/5 = MetS.</div>
      </div>

      {/* ── Шаг 3. Щитовидка и HOMA-IR ───────────────────────────────── */}
      <div style={{ display: wizardStep===3 ? 'block' : 'none' }}>
      <MhSection icon="🦋" accent="#8b5cf6" title="Щитовидка и HOMA-IR" hint="FT4 (Kim 2014: +1 пмоль ≈ +2.2% BMR), глюкоза и инсулин для HOMA-IR (Wallace 2004). Без них поправок нет.">
        <MhGrid>
          <MhNum label="FT4, пмоль/л" value={ft4} min={5} max={30} step={0.5} suffix=" пмоль/л" optional
            hint="Свободный T4, норма 12–22 пмоль/л. Поправка BMR линейная и мала."
            onChange={markManualLab('ft4', setFt4)} />
          <MhNum label="TSH, мкМЕ/мл" value={tsh} min={0.1} max={10} step={0.1} suffix=" мкМЕ/мл" optional
            hint="TSH >4.5 — повод к эндокринологу; сам по себе BMR не пересчитывает."
            onChange={markManualLab('tsh', setTsh)} />
          <MhNum label="Глюкоза натощак" value={glucoseMgDl} min={60} max={180} suffix=" мг/дл" optional
            hint="Общий вход для HOMA-IR, TyG и QUICKI — они не независимы."
            onChange={markManualLab('glucose', setGlucoseMgDl)} />
          <MhNum label="Инсулин" value={insulinMuMl} min={2} max={40} step={0.5} suffix=" мкЕд/мл" optional
            hint="HOMA-IR = глюкоза(ммоль) × инсулин / 22.5."
            onChange={markManualLab('insulin', setInsulinMuMl)} />
        </MhGrid>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', marginTop:6 }}>Thyroid: {thyroid.note} · HOMA {homa.homa ?? '—'} {homa.zone!=='unknown' && `— ${homa.note}`} · глюкоза — общий вход HOMA-IR, TyG и QUICKI (см. MetS ниже)</div>
      </MhSection>
      </div>

      {/* ── Шаг 2. Восстановление ───────────────────────────────────── */}
      <div style={{ display: wizardStep===2 ? 'block' : 'none' }}>
      <MhSection icon="🛌" accent="#f43f5e" title="Восстановление" hint="Сон, стресс, кофеин и алкоголь: вход для Stress Load (эвристика E, не кортизол) и кривой кофеина.">
        <MhGrid>
          <PopupNumber label="Стресс 1-10" value={stress} min={1} max={10} onChange={setStress} />
          <PopupNumber label="Сон, ч" value={sleepHours} min={3} max={11} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1-5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
          <PopupNumber label="Кофеин, мг/сут" value={caffeineMg} min={0} max={800} onChange={setCaffeineMg} />
          <PopupNumber label="Алкоголь, г/сут" value={alcoholG} min={0} max={120} onChange={setAlcoholG} />
          <PopupNumber label="Дней/нед с алко" value={alcoholDays} min={0} max={7} onChange={setAlcoholDays} />
          <PopupNumber label="Ч/после кофе, ч" value={caffeineHoursSince} min={0} max={24} step={0.5} onChange={setCaffeineHoursSince} />
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.3 }}>ACWR live</div>
            <div style={{ fontSize:14, fontWeight:900, color: cortisol.acwrZone==='dangerous'?'#ef4444':cortisol.acwrZone==='caution'?'#f59e0b':'#22c55e' }}>{acwr.toFixed(2)} · {cortisol.acwrZone}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>из sRPE · {cortisol.caffeineAdj? `коф +${cortisol.caffeineAdj}`:''} {cortisol.alcoholAdj? `алк +${cortisol.alcoholAdj}`:''}</div>
          </div>
        </MhGrid>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', marginTop:6 }}>{alcohol.kcal>0? `${alcohol.kcal}ккал алко · блок жира ${alcohol.fatOxidationBlockedPct}%`:'Без алкоголя'} · хроника: {alcoholChronic.unitsPerWeek} units/нед {alcoholChronic.risk !== 'low' ? `· ${alcoholChronic.note}` : ''} · {caffeineCurve.note} · сон cut-off {caffeineCurve.sleepCutoffH}ч</div>
      </MhSection>
      </div>
      <div style={{ ...CARD, border:'1px solid rgba(6,182,214,0.12)', padding:10, background:'rgba(6,182,214,0.04)', display: wizardStep===3 ? 'block' : 'none' }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'#06b6d4', marginBottom:8 }}>🔋 RED-S CAT2 PRO — ③ Лабы</div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginBottom:6 }}>Step1 — LEAF-Q (Ж) + LEAM-Q (М) + EDE-Q · Step2 — severity primary×2/secondary · Step3 — return-to-play (IOC CAT2 2023, скрининг — не диагноз)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {['Травмы (частые)','Болезни (частые)','ЖКТ вздутие','ЖКТ газы','Менстр. нарушения','Усталость','Настроение','Сон'].map((q,i)=>(
              <MhToggle key={i} compact checked={leafAnswers[i]} accent="#06b6d4" title={q}
                onChange={v=> { const next=[...leafAnswers]; next[i]=v; setLeafAnswers(next); setLeafScore(next.filter(Boolean).length*2); }} />
            ))}
            <div style={{ gridColumn:'1 / -1', fontSize:8, color: leafCalc.risk==='high'?'#ef4444': leafCalc.risk==='moderate'?'#f59e0b':'#22c55e', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px', textAlign:'center' }}>LEAF {leafCalc.score}/16 — {leafCalc.note} (чекбоксы ×2 балла)</div>
          </div>
          <MhNum label="RMR измер., ккал" value={measuredRMR} min={800} max={3500} suffix=" ккал" optional
            hint="Непрямая калориметрия. RMR ratio <0.90 (измеренный / предсказанный) — primary-флаг RED-S."
            onChange={setMeasuredRMR} />
          <MhNum label="EDE-Q, 0–6" value={edeScore} min={0} max={6} step={0.5} optional
            hint="Скрининг РПП: ≥4 — primary, 2–4 — secondary. Это не диагноз."
            onChange={setEdeScore} />
          <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            <div style={{ fontSize:8, fontWeight:800, color:'rgba(255,255,255,0.55)', gridColumn:'1 / -1' }}>LEAM-Q lite (М, Lundy 2022):</div>
            {['Либидо ↓','Утр. эрекция нет','Усталость','Переломы','Вес ↓','Настроение ↓'].map((q,i)=>(
              <MhToggle key={i} compact checked={leamAnswers[i]} accent="#f97316" title={q}
                onChange={v=> { const next=[...leamAnswers]; next[i]=v; setLeamAnswers(next); }} />
            ))}
            <div style={{ gridColumn:'1 / -1', fontSize:8, color: leamCalc.risk==='high'?'#ef4444': leamCalc.risk==='moderate'?'#f59e0b':'#22c55e', textAlign:'center' }}>LEAM {leamCalc.score}/12 — {leamCalc.note}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <MhToggle checked={boneFlag} onChange={setBoneFlag} icon="🦴" title="Стресс-перелом" accent="#ef4444" />
            <MhToggle checked={menstrualFlag} onChange={setMenstrualFlag} icon="🌸" title="Аменорея" accent="#f472b6" />
            <MhToggle checked={lowT} onChange={setLowT} icon="📉" title="Тесто низкое (М)" accent="#f59e0b" />
            <MhToggle checked={lowBMD} onChange={setLowBMD} icon="🦷" title="BMD T<−1" accent="#a78bfa" />
            <MhToggle checked={t3Low} onChange={setT3Low} icon="🦋" title="T3 низкий" desc="secondary" accent="#38bdf8" />
          </div>
        </div>
        <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)' }}>EA {ea?.ea ?? '—'} · RMR ratio {measuredRMR && kbju.nat.bmr ? (measuredRMR/kbju.nat.bmr).toFixed(2):'—'} (&lt;0.90 = primary-флаг) · скрининг, не диагноз.</div>
        <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background: `${cat2.color}14`, border:`1px solid ${cat2.color}33`, fontSize:9, color: cat2.color, lineHeight:1.4 }}>
          <b>CAT2 {cat2.light.toUpperCase()} PRO — primary {cat2.primary} / secondary {cat2.secondary} · {cat2.flags.join(', ') || 'флагов нет'}</b> · {cat2.note}
          <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:4 }}>{cat2.returnToPlay} · LEAM {leamCalc.score}/12 {leamCalc.note} · EDE-Q {edeScore ?? '—'} (≥4 primary, 2–4 secondary)</span>
        </div>
        {refeedNeed.needed && <div style={{ marginTop:6, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.18)', fontSize:9, color:'#fbbf24' }}>Refeed нужен: +{refeedNeed.carbBoostPct}% углей 1×/нед — лептин/T3 (Trexler). {refeedNeed.note}</div>}
        {dietBreakPlan && <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>MATADOR: {dietBreakPlan.slice(0,8).map(p=> p.phase==='deficit'?'−':'○').join('')} {dietBreakPlan.length}нед · break каждые 6нед ×2нед maintenance</div>}
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(239,68,68,0.12)', padding:10, background:'rgba(239,68,68,0.04)', display: wizardStep===3 ? 'block' : 'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontSize:14 }}>🩸</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'#f87171' }}>Гематокрит — ③ Лабы</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1.35 }}>HCT — главный маркер на ААС. &gt;52% → донация. Подтянется из Профиля → Лабы.</div>
          </div>
          <span style={{ fontSize:8, padding:'3px 7px', borderRadius:20, background: hematology.zone==='unknown' ? 'rgba(255,255,255,0.06)' : `${hematology.color}18`, border:`1px solid ${hematology.color}33`, color: hematology.zone==='unknown' ? 'rgba(255,255,255,0.55)' : hematology.color, fontWeight:800 }}>{hematology.zone==='unknown' ? 'нет HCT' : hematology.zoneLabel}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <MhNum label="HCT, %" value={hct} min={36} max={62} suffix=" %" optional
            hint="Гематокрит из ОАК. Без него шкала крови, вода под HCT и рекомендации по железу слепые."
            onChange={markManualLab('hct', setHct)} />
          <MhNum label="HGB, г/л" value={hgb} min={110} max={200} suffix=" г/л" optional
            hint="Если пусто — оценивается как HCT × 3.4 и подписывается как оценка."
            onChange={markManualLab('hgb', setHgb)} />
          <MhNum label="Ферритин, нг/мл" value={ferritin} min={5} max={800} suffix=" нг/мл" optional
            hint="<30 — дефицит запасов железа; на ААС железо не назначают при HCT>51."
            onChange={markManualLab('ferritin', setFerritin)} />
          <MhNum label="GFR, мл/мин" value={gfr} min={15} max={130} suffix=" мл/мин" optional
            hint="<60 — вода и белок считаются консервативнее."
            onChange={markManualLab('gfr', setGfr)} />
          <PopupNumber label="Вода факт, л/сут" value={waterL} min={1} max={6} step={0.1} onChange={setWaterL} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <PopupNumber label="Na, г/сут" value={sodiumG} min={1} max={8} step={0.1} onChange={setSodiumG} />
            <div style={{ display:'flex', gap:4 }}>
              <span style={{ flex:1, fontSize:8, color: hematology.viscosityFlag ? '#ef4444' : 'rgba(255,255,255,0.45)', background: hematology.viscosityFlag ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)', border:`1px solid ${hematology.viscosityFlag?'rgba(239,68,68,0.18)':'rgba(255,255,255,0.06)'}`, borderRadius:8, padding:'5px 6px', textAlign:'center' }}>{hematology.viscosityFlag ? '⚠ вязкость' : 'вязкость OK'}</span>
              <span style={{ flex:1, fontSize:8, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'5px 6px', textAlign:'center' }}>K {potassiumG}г</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={resetLabs} className="mh-act" style={{ padding:'10px 12px', minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.65)', fontSize:10, fontWeight:600, cursor:'pointer' }}>⟲ Сброс лаб</button>
          <button onClick={recordHct} className="mh-act" style={{ padding:'10px 12px', minHeight:44, borderRadius:10, border:'1px solid rgba(56,165,250,0.18)', background:'rgba(56,165,250,0.10)', color:'#38bdf8', fontSize:10, fontWeight:700, cursor:'pointer' }}>📌 Записать HCT</button>
          <button onClick={recordDonation} className="mh-act" style={{ padding:'10px 12px', minHeight:44, borderRadius:10, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.10)', color:'#ef4444', fontSize:10, fontWeight:700, cursor:'pointer' }}>🩸 Донация сегодня</button>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)', alignSelf:'center' }}>ESC &gt;52% (м)/48% (ж), флеботомия &gt;54%.</span>
        </div>
        {hctHistory.length>0 && (
          <div style={{ marginTop:6, display:'flex', gap:4, alignItems:'end', flexWrap:'wrap' }}>
            {hctHistory.slice(-12).map((p,i)=>(
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:22, height: Math.max(6, Math.min(42, (p.hct-36)*1.6)), borderRadius:4, opacity: p.est ? 0.45 : 1, background: p.hct>54 ? '#ef4444' : p.hct>51 ? '#f59e0b' : p.hct>=48 ? '#eab308' : '#22c55e', border: p.est ? '1px dashed rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.08)', boxSizing:'border-box' }} title={`${p.date} ${p.hct}%${p.est ? ' — прогноз, не измерение' : ''}`} />
                <span style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{p.est ? '~' : ''}{p.date.slice(5)}</span>
              </div>
            ))}
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginLeft:4 }}>
              {hctStats.measured} измерений{hctStats.forecast>0 ? ` + ${hctStats.forecast} прогноз` : ''}
              {hctStats.delta!=null ? ` · Δ ${hctStats.delta>0?'+':''}${hctStats.delta}%` : ''}
            </span>
            {donationLog.length>0 && <span style={{ fontSize:8, color:'#ef4444', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.12)', borderRadius:6, padding:'2px 6px' }}>🩸 донаций {donationLog.length} · посл. {donationLog[donationLog.length-1].date}</span>}
          </div>
        )}
        {hct==null && <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 Введи HCT из ОАК — инструмент покажет воду, железо, донацию и вязкость. Без HCT шкала слепая.</div>}
      </div>

      {/* ── Шаг 4. Цель и особые состояния ─────────────────────────── */}
      <div style={{ display: wizardStep===4 ? 'block' : 'none' }}>
      <MhSection icon="🎯" accent="#eab308" title="4. Цель и особые состояния" hint="Цель задаёт дефицит и срок. AT, RED-S и вода реагируют на недели в дефиците и беременность.">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:6, marginBottom:8 }}>
          {(['cut','maintain','bulk','health'] as const).map(g=> (
            <button key={g} type="button" onClick={()=> setGoal(g)} aria-pressed={goal===g} className="mh-goal"
              style={{ minHeight:48, borderRadius:12, cursor:'pointer', fontSize:11, fontWeight:800, padding:'6px 4px',
                border: goal===g ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                background: goal===g ? 'rgba(234,179,8,0.14)' : 'rgba(255,255,255,0.02)',
                color: goal===g ? '#eab308' : '#fff' }}>{GOAL_LABEL[g]}</button>
          ))}
        </div>
        <MhGrid>
          <MhNum label="Дефицит, ккал/сут" value={deficitKcal} min={0} max={1200} step={50} suffix=" ккал" optional
            hint="Нужен для адаптивного термогенеза (Trexler): >3 недель дефицита → RMR ниже прогноза."
            onChange={setDeficitKcal} />
          <MhNum label="Недель в дефиците" value={weeksInDeficit} min={0} max={24} suffix=" нед" optional
            hint="Дольше 3 недель — AT начинает учитываться, reverse-auto растягивается."
            onChange={setWeeksInDeficit} />
          <MhNum label="Потеряно, кг" value={weightLostKg} min={0} max={30} step={0.5} suffix=" кг" optional
            hint="Для оценки AT: сколько веса уже ушло на текущем дефиците."
            onChange={setWeightLostKg} />
          <MhNum label="Целевых недель" value={weeksToGoal} min={2} max={104} suffix=" нед" optional
            hint="Свой срок вместо расчётного: покажем, какой дефицит для него нужен."
            onChange={setWeeksToGoal} />
          <PopupSelect label="Этничность (FFMI/жир)" value={ethnicity} options={[{id:'european',label:'Европейская'},{id:'african',label:'Африканская'},{id:'east_asian',label:'Восточноазиатская'}]} onChange={v=> setEthnicity(v as any)} />
          <MhToggle checked={postBariatric} onChange={setPostBariatric} icon="🩺" title="После бариатрии" desc="белок и усвоение — консервативнее" accent="#f59e0b" />
        </MhGrid>
        {deadline && (
          <div style={{
            marginTop:6, padding:'8px 10px', borderRadius:10, fontSize:9, lineHeight:1.45,
            background: deadline.verdict==='on-track'||deadline.verdict==='met' ? 'rgba(34,197,94,0.08)' : deadline.verdict==='too-fast' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${deadline.verdict==='on-track'||deadline.verdict==='met' ? 'rgba(34,197,94,0.18)' : deadline.verdict==='too-fast' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`,
            color: deadline.verdict==='on-track'||deadline.verdict==='met' ? '#22c55e' : deadline.verdict==='too-fast' ? '#f59e0b' : '#f87171',
          }}>
            🗓 {deadline.verdict==='met' ? 'цель достигнута' : deadline.verdict==='on-track' ? 'срок выполним' : deadline.verdict==='too-fast' ? 'план быстрее срока' : deadline.verdict==='too-slow' ? 'в срок не успеть' : 'цель и план в разные стороны'} · {deadline.note}
          </div>
        )}
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:6, lineHeight:1.4 }}>
          {at.note} · RMR pred {at.rmrPred} · Телосложение: {fat.current}% жира, FFMI {onAAS ? fat.ffmiNormAdj : fat.ffmiNorm} {goalV2 ? `· цель ${goalV2.days}д (${goalV2.weeks}нед) при ${goalV2.kcalDiff>0?'+':''}${goalV2.kcalDiff}ккал/сут` : '· целевой вес не задан'}
        </div>
        {sex==='female' && (
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize:9, fontWeight:800, color:'#f472b6', marginBottom:6 }}>🤰 Беременность и лактация (IOM 2005)</div>
            <MhGrid>
              <PopupSelect label="Триместр" value={String(trimester)} options={[{id:'0',label:'нет'},{id:'1',label:'1-й (+0ккал)'},{id:'2',label:'2-й (+340)'},{id:'3',label:'3-й (+452)'}]} onChange={v=> setTrimester(Number(v) as any)} />
              <PopupSelect label="Лактация" value={lactating} options={[{id:'none',label:'нет'},{id:'exclusive',label:'исключительная (+500)'},{id:'mixed',label:'смешанная (+400)'}]} onChange={v=> setLactating(v as any)} />
            </MhGrid>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:4 }}>{pregAdd ? `Надбавка к калориям +${pregAdd}ккал/сут (IOM 2005) — уже учтена в КБЖУ; вода беременной/кормящей корректируется на вкладке «Вода».` : 'Без беременности/лактации надбавок нет.'}</div>
          </div>
        )}
        <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
          <button type="button" onClick={resetAll} className="mh-act" style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(239,68,68,0.22)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:10, fontWeight:800, cursor:'pointer' }}>⟲ Сбросить весь ввод</button>
          <button type="button" onClick={()=> goStep(1)} className="mh-act" style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(96,165,250,0.22)', background:'rgba(96,165,250,0.10)', color:'#60a5fa', fontSize:10, fontWeight:800, cursor:'pointer' }}>← Вернуться к телу</button>
        </div>
      </MhSection>
      </div>

      {/* Дополнительные метрики — без дублей верхней сводки, каждая ведёт в свой калькулятор */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:6, marginBottom:10 }}>
        <MhTile label="Шаги" accent="#22c55e"
          value={<>{onAAS ? stepsCalc.stepsAAS : stepsCalc.stepsNat} <span style={{ fontSize:10 }}>шагов</span></>}
          sub={<>PAL {stepsCalc.pal} · DLW {stepsCalc.dlwBand.low}–{stepsCalc.dlwBand.high}</>}
          active={mode==='steps'} onClick={()=> go('steps')} />
        <MhTile label="Stress Load ⚠️ E" accent="#f43f5e"
          value={<>{onAAS ? cortisol.aas : cortisol.nat} <span style={{ fontSize:10 }}>/100 · {onAAS ? cortisol.zoneLabelAAS : cortisol.zoneLabelNat}</span></>}
          sub={<>эвристика, не кортизол · ACWR {acwr.toFixed(2)}</>}
          active={mode==='cortisol'} onClick={()=> go('cortisol')} />
        <MhTile label="Алко · TEF" accent="#f97316"
          value={<>{alcohol.kcal} <span style={{ fontSize:10 }}>ккал</span></>}
          sub={alcohol.kcal>0 ? <>блок жира {alcohol.fatOxidationBlockedPct}% · {alcohol.stepsEq} шагов</> : 'алкоголь не задан'}
          active={mode==='alcohol'} onClick={()=> go('alcohol')} />
        <MhTile label="Белок · DIAAS" accent="#84cc16"
          value={<>{proteinPro.perMeal} <span style={{ fontSize:10 }}>г/приём · {proteinPro.leucinePerMeal}г leuc</span></>}
          sub={<>{proteinPro.leucinePerMeal>=2.2 ? '✓ порог MPS' : '⚠ ниже порога MPS'} · DIAAS {proteinPro.diaas}</>}
          active={mode==='protein'} onClick={()=> go('protein')} />
        <MhTile label="Цель · Hall" accent="#eab308"
          value={<>{goalV2 ? `${goalV2.days} д` : '—'} <span style={{ fontSize:10 }}>{targetWeight ? `→ ${targetWeight}кг` : ''}</span></>}
          sub={<>{goalV2 ? goalV2.rateNote : 'задай целевой вес в шаге 1'}</>}
          active={mode==='maintenance'} onClick={()=> go('maintenance')} />
        <MhTile label="MetS · ATP III" accent="#f43f5e"
          value={<>{mets.score} <span style={{ fontSize:10 }}>/5</span></>}
          sub={<>{mets.hasMetS ? 'критерии MetS' : 'критериев для MetS нет'} · TyG {tyg ?? '—'}</>}
          active={mode==='mets'} onClick={()=> go('mets')} />
      </div>

      {diaryAvgKcal != null && (
        <div style={{ ...CARD, padding:'10px 12px', background: Math.abs(diaryAvgKcal - stepsCalc.tdeeNat) < 150 ? 'rgba(34,197,94,0.08)' : diaryAvgKcal < stepsCalc.tdeeNat ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.06)', border:`1px solid ${Math.abs(diaryAvgKcal - stepsCalc.tdeeNat) < 150 ? 'rgba(34,197,94,0.18)' : diaryAvgKcal < stepsCalc.tdeeNat ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.12)'}`, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>📓</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>Дневник 7д: {diaryAvgKcal}ккал/сут · {diaryDays}д · факт vs TDEE {stepsCalc.tdeeNat} → {diaryAvgKcal - stepsCalc.tdeeNat > 0 ? '+' : ''}{diaryAvgKcal - stepsCalc.tdeeNat}ккал/сут</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>{diaryAvgKcal < stepsCalc.tdeeNat -150 ? 'Дефицит — тренд должен −0.3…−0.6кг/нед' : diaryAvgKcal > stepsCalc.tdeeNat +150 ? 'Профицит — набор +0.2кг/нед, проверь EA' : 'Баланс — вес стабилен'} · EA {ea.ea ?? '—'} · TDEE finder R2 {maintenance?.r2 ?? '—'}</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:700 }}>{ea.zoneLabel}</span>
        </div>
      )}
      {diaryAvgKcal == null && (
        <div style={{ ...CARD, padding:'8px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.55)', textAlign:'center' }}>📓 Нет данных дневника 7д — веди дневник питания, появится факт vs TDEE + EA live</div>
      )}

      {/* Сценарии — сохранить конфигурацию и сравнить две */}
      <MhSection icon="🗂" accent="#8b5cf6" title="Сценарии" hint="Сохрани текущий набор входов и отметь два сценария для сравнения — разница подписывается человеческими полями.">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button type="button" onClick={saveScenario} className="mh-act" style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(139,92,246,0.22)', background:'rgba(139,92,246,0.10)', color:'#a78bfa', fontSize:10, fontWeight:800, cursor:'pointer' }}>💾 Сохранить сценарий</button>
          {compareIds.length>0 && <button type="button" onClick={()=> setCompareIds([])} className="mh-act" style={{ minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)', fontSize:10, fontWeight:700, cursor:'pointer' }}>Снять выбор</button>}
        </div>
        {scenarios.length === 0 ? (
          <div style={{ marginTop:8, fontSize:9, color:'rgba(255,255,255,0.5)' }}>Сценариев пока нет. Сохрани «сейчас» и поменяй вес/цель/дефицит — получишь сравнение двух конфигураций.</div>
        ) : (
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
            {scenarios.map(s=> {
              const sel = compareIds.includes(s.id);
              return (
                <div key={s.id} style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <button type="button" className="mh-compare" style={{ width:44, height:44, minHeight:44, flexShrink:0, padding:0, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    aria-pressed={sel} aria-label={`Сравнить: ${s.name}`}
                    onClick={()=> setCompareIds(prev=> prev.includes(s.id) ? prev.filter(x=> x!==s.id) : [...prev, s.id].slice(-2))}>
                    <span style={{ width:30, height:30, borderRadius:'50%', display:'block', border: sel ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.25)', background: sel ? 'rgba(167,139,250,0.35)' : 'transparent' }} />
                  </button>
                  <button type="button" className="mh-mini" style={{ flex:1, minHeight:44, textAlign:'left', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontSize:9, fontWeight:700, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                    onClick={()=> loadScenario(s.id)}>↺ {s.name}</button>
                  <button type="button" className="mh-mini" style={{ minHeight:44, minWidth:44, padding:'8px 10px', borderRadius:10, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:10, fontWeight:700, cursor:'pointer' }}
                    aria-label={`Удалить сценарий: ${s.name}`} onClick={()=> deleteScenario(s.id)}>🗑</button>
                </div>
              );
            })}
            {scenarioDiff && scenarioDiff.length > 0 && (
              <div style={{ marginTop:4, padding:'8px 10px', borderRadius:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.16)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'#a78bfa', marginBottom:4 }}>Δ между сценариями ({scenarioDiff.length} полей)</div>
                {scenarioDiff.map(d=> (
                  <div key={d.key} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:9, color:'#fff', lineHeight:1.5 }}>
                    <span style={{ color:'rgba(255,255,255,0.62)' }}>{SNAP_LABEL[d.key] ?? d.key}</span>
                    <span>{snapValue(d.key, d.a)} → <b>{snapValue(d.key, d.b)}</b>{d.delta != null ? ` (${d.delta>0?'+':''}${d.delta})` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {compareIds.length === 1 && <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Отметь второй сценарий — покажу разницу по полям.</div>}
          </div>
        )}
      </MhSection>

      {/* Селектор калькуляторов: группы + sticky, чтобы не уезжал при скролле */}
      <div ref={resultsRef} id="mh-results" style={{ position: 'sticky', top:0, zIndex:6, margin:'0 -8px 10px', padding:'8px', background:'rgba(10,10,12,0.92)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:6, marginBottom:6 }}>
          {MODE_GROUPS.map(g=> (
            <button key={g.id} type="button" onClick={()=> setGroup(g.id)} aria-pressed={group===g.id} className="mh-group"
              style={{ minHeight:44, borderRadius:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'5px 2px',
                border: group===g.id ? `1px solid ${g.accent}` : '1px solid rgba(255,255,255,0.08)',
                background: group===g.id ? `${g.accent}1c` : 'rgba(255,255,255,0.02)',
                color: group===g.id ? g.accent : '#fff', fontSize:9, fontWeight:800 }}>
              <span style={{ fontSize:12 }}>{g.icon}</span>{g.title}
            </button>
          ))}
        </div>
        {MODE_GROUPS.map(g=> (
          <div key={g.id} style={{ display: group===g.id ? 'flex' : 'none', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
            {MODE_DEFS.filter(d=> GROUP_OF[d.m]===g.id).map(({m,label,icon,desc,accent,evidence})=> (
              <button key={m} type="button" onClick={()=> setMode(m)} title={`${desc} · ${evidence}`} aria-pressed={mode===m} className="mh-mode" style={{
                flex:'0 0 auto', display:'flex', alignItems:'center', gap:4, padding:'7px 10px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:800, whiteSpace:'nowrap', minHeight:44,
                border: mode===m ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
                background: mode===m ? `${accent}18` : 'rgba(255,255,255,0.04)',
                color: mode===m ? accent : '#fff', transition:'all 0.16s',
              }}><span>{icon}</span> {label}<span style={{ fontSize:7, opacity:0.7 }}>{evidence.split(' ')[0]}</span></button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${active.accent}18`, border:`1px solid ${active.accent}33`, fontSize:14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color:active.accent }}>{active.label} · {active.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{active.hint}</div>
          </div>
        </div>
        <div id="mh-mode-body" style={{ padding:12 }}>
          {mode==='water' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(56,165,250,0.08)', border:'1px solid rgba(56,165,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'#38bdf8' }}>{water.nat} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHour}мл/ч · база {water.breakdown.base}+пот {water.breakdown.training}{water.breakdown.climate? ` ${water.breakdown.climate>0?'+':''}${water.breakdown.climate}`:''}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{water.aas} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHourAAS}мл/ч · Δ +{water.delta} ({Math.round((water.aas/water.nat-1)*100)}%)</div>
                </div>
              </div>
              <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
                <MhBar v={water.breakdown.base} max={water.nat} color="#38bdf8" label={`база ${water.breakdown.base}`} />
                <MhBar v={water.breakdown.training} max={water.nat} color="#f59e0b" label={`пот ${water.breakdown.training}`} />
                {water.breakdown.climate!==0 && <MhBar v={Math.abs(water.breakdown.climate)} max={water.nat} color="#22c55e" label={`${water.breakdown.climate>0?'+':''}${water.breakdown.climate} климат`} />}
                {(water.breakdown.pregnancy ?? 0)>0 && <MhBar v={water.breakdown.pregnancy} max={water.nat} color="#f9a8d4" label={`+${water.breakdown.pregnancy} 🤰 IOM`} />}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px', lineHeight:1.45 }}>{water.note} · LBM {water.breakdown.lean}кг / жир {water.breakdown.fatMass}кг</div>
              {hematology.hct!=null && hematology.waterAdjMl>0 && <div style={{ marginTop:6, fontSize:9, color:'#38bdf8', background:'rgba(56,165,250,0.08)', border:'1px solid rgba(56,165,250,0.18)', borderRadius:8, padding:'7px 10px' }}>🩸 HCT {hematology.hct}% → вода с гематокритом {hematology.waterTargetMl}мл ({hematology.mlPerKg}мл/кг) +{hematology.waterAdjMl} к базе — см. вкладку Кровь</div>}
            </div>
          )}
          {mode==='steps' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#22c55e' }}>{stepsCalc.stepsNat.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{stepsCalc.stepsAAS.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeAAS} → {stepsCalc.targetAAS}ккал · Δ {stepsCalc.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>PAL <b style={{color:'#22c55e'}}>{stepsCalc.pal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>сидяч <b>{stepsCalc.sedentKcal}ккал</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>{stepsCalc.kcalPerStep}ккал/шаг</div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>Waterfall TDEE · BMR + NEAT + EAT + TEF 10%</div>
                <div style={{ display:'flex', gap:6, alignItems:'end' }}>
                  <MhBar v={stepsCalc.bmr} max={stepsCalc.tdeeNat} color="#60a5fa" label={`BMR ${stepsCalc.bmr}`} />
                  <MhBar v={stepsCalc.neat} max={stepsCalc.tdeeNat} color="#22c55e" label={`NEAT ${stepsCalc.neat}`} />
                  <MhBar v={stepsCalc.eat} max={stepsCalc.tdeeNat} color="#f59e0b" label={`EAT ${stepsCalc.eat}`} />
                  <MhBar v={stepsCalc.tefNat} max={stepsCalc.tdeeNat} color="#a78bfa" label={`TEF ${stepsCalc.tefNat}`} />
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:4, lineHeight:1.3 }}>TDEE {stepsCalc.tdeeNat} ≈ BMR {stepsCalc.bmr} + NEAT {stepsCalc.neat} + EAT {stepsCalc.eat} = {stepsCalc.bmr + stepsCalc.neat + stepsCalc.eat} (Δ{stepsCalc.bmr + stepsCalc.neat + stepsCalc.eat - stepsCalc.tdeeNat} — округление NEAT) · EAT = train+cardio · TEF {stepsCalc.tefNat} ~10% уже внутри PAL и в сумму не входит</div>
              </div>
              {adaptiveV3 ? (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color:'#22c55e' }}>Адаптив v3 EMA-28д:</b> {adaptiveV3.tdee} [{adaptiveV3.low}–{adaptiveV3.high}] R²{adaptiveV3.r2} {adaptiveV3.confidence} · {adaptiveV3.adherence.note}
                </div>
              ) : weightHistory.length>=1 && weightHistory.length<7 ? (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>Адаптив v3: нужно ≥7 взвешиваний + логи (сейчас {weightHistory.length}/{diaryDays}) — данные из he_nutrition_v2.</div>
              ) : null}
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{stepsCalc.note}</div>
            </div>
          )}
          {mode==='kbju' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {kbju.nat.protPerKg}г/кг · PAL {kbju.nat.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#f59e0b' }}>{kbju.nat.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.nat.p} Ж{kbju.nat.f} У{kbju.nat.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}% · Ж {Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}% · У {Math.round(kbju.nat.c*4/kbju.nat.kcal*100)}%</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС — {kbju.aas.protPerKg}г/кг · PAL {kbju.aas.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{kbju.aas.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.aas.p} Ж{kbju.aas.f} У{kbju.aas.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}% · Ж {Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}% · У {Math.round(kbju.aas.c*4/kbju.aas.kcal*100)}%</div>
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ ккал <b style={{color: kbju.delta.kcal>0?'#f87171':'#22c55e'}}>{kbju.delta.kcal>0?'+':''}{kbju.delta.kcal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ белок <b style={{color:'#f87171'}}>+{kbju.delta.p}г</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>клетчатка {onAAS? kbju.fiber.aas:kbju.fiber.nat}г</div>
              </div>
              {(onAAS ? kbju.macroGap.aas : kbju.macroGap.nat).note && (
                <div style={{ marginTop:6, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:9, color:'#fbbf24', lineHeight:1.4 }}>
                  ⚖️ {(onAAS ? kbju.macroGap.aas : kbju.macroGap.nat).note}
                </div>
              )}
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>Waterfall TDEE · BMR + NEAT + EAT (TEF внутри PAL)</div>
                <div style={{ display:'flex', gap:6, alignItems:'end' }}>
                  <MhBar v={kbju.bmr} max={stepsCalc.tdeeNat} color="#60a5fa" label={`BMR ${kbju.bmr}`} />
                  <MhBar v={kbju.neat} max={stepsCalc.tdeeNat} color="#22c55e" label={`NEAT ${kbju.neat}`} />
                  <MhBar v={kbju.eat} max={stepsCalc.tdeeNat} color="#f59e0b" label={`EAT ${kbju.eat}`} />
                  <MhBar v={kbju.tefNat} max={stepsCalc.tdeeNat} color="#a78bfa" label={`TEF ${kbju.tefNat}`} />
                  {caffeineCurve.tefBoostKcal>0 && <MhBar v={caffeineCurve.tefBoostKcal} max={stepsCalc.tdeeNat} color="#f43f5e" label={`Caf ${caffeineCurve.tefBoostKcal}`} />}
                </div>
                {/* Шкала — расход БЕЗ цели: kbju.nat.tdee уже содержит дельту цели,
                    и сумма BMR+NEAT+EAT не могла её дать (сушка выглядела «недобором»). */}
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:4 }}>TDEE {stepsCalc.tdeeNat} = BMR {kbju.bmr} + NEAT {kbju.neat} + EAT {kbju.eat} · план на цель {kbju.nat.kcal} ккал ({kbju.nat.kcal < stepsCalc.tdeeNat ? '−' : '+'}{Math.abs(stepsCalc.tdeeNat - kbju.nat.kcal)})</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:3 }}>FAO 2004: BEE=BMR×1.10 (TEF), TEE=BEE×PAL. У нас TDEE=BMR×PAL — PAL FAO уже включает TEF; TEF {kbju.tefNat}ккал показан отдельно и в сумму выше не входит, BEE≈{kbju.bmr + kbju.tefNat}ккал</div>
              </div>
              {adaptiveV3 ? (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color:'#22c55e' }}>Адаптив v3 EMA-28д:</b> {adaptiveV3.tdee} [{adaptiveV3.low}–{adaptiveV3.high}] R²{adaptiveV3.r2} {adaptiveV3.confidence} · {adaptiveV3.note}
                </div>
              ) : weightHistory.length>=1 && weightHistory.length<7 ? (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>Адаптив v3: нужно ≥7 взвешиваний + логи (сейчас {weightHistory.length}/{diaryDays}).</div>
              ) : null}
              <div style={{ marginTop:6, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{kbju.note} · {kbju.carbTiming}</div>
              {goal==='health' && (
                <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                  <b style={{ color:'#f87171' }}>🎯 Здоровье-профиль:</b> белок 1.8г/кг · клетчатка ≥30г (муж 34г) · PRAL −5..+5 · omega-3 ≥2г · вода {hematology.waterTargetMl}мл ({hematology.mlPerKg}мл/кг) · Na 2.3-3.5г · железо {hematology.ironRecLabel.split(' —')[0]} · {hematology.pralNote}
                  <span style={{ display:'block', fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Цель «Здоровье» — maintenance с акцентом на сосуды/вязкость/почки. При HCT&gt;51 — ZERO железо, 42мл/кг воды.</span>
                </div>
              )}
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                 <button onClick={applyKBJU} className="mh-act" style={{ flex:1, padding:'12px 10px', minHeight:48, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', fontWeight:800, fontSize:12 }}>🍽 Применить к плану питания</button>
                <button onClick={()=> { const s = onAAS? kbju.aas:kbju.nat; const t=`КБЖУ ${s.kcal} Б${s.p} Ж${s.f} У${s.c} (P${s.protPerKg})`; void shareOrCopyText('КБЖУ из Метаболики', t).then(ok => showToast(ok ? 'Скопировано: '+t : t)); }} className="mh-act" style={{ padding:'12px', minHeight:48, minWidth:48, borderRadius:12, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>⎘ Копировать</button>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.35 }}>«Применить» пишет цели в <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:5, color:'#fff' }}>Профиль → Питание → Ручные цели</code> — Планировщик читает их на живую и включает режим «КБЖУ — Ручной» (иначе manualTargets игнорируются планировщиком). В ручном режиме значения переносятся как есть — Планировщик их не пересчитывает и не урезает. Кнопка «⎘ Копировать» дублирует значения в буфер обмена. Санитарный потолок У здесь — 7 г/кг (8 при высоком объёме, +1 г/кг на ААС); если он упёрся, а ккал не добираются, в блоке КБЖУ будет честная пометка о недоборе.</div>
            </div>
          )}
          {mode==='fat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Текущий</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#a78bfa' }}>{fat.current}%</div>
                  <div style={{ fontSize:9, color:'#fff' }}>Navy {fat.navy ?? '—'}{fat.navyAdj? ` → ${fat.navyAdj}`:''} · FFM {fat.ffm}кг</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: fat.isOverNatLimit ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: fat.isOverNatLimit ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: fat.isOverNatLimit ? '#f87171' : '#fff' }}>FFMI_norm {onAAS? fat.ffmiNormAdj:fat.ffmiNorm} { (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit) ? '⚠' : '✓'}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)? '#f87171':'#fff' }}>{onAAS? fat.ffmiNormAdj:fat.ffmiNorm}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{fat.aasNote}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:8, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', position:'relative' }}>
                <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, ( (onAAS? fat.ffmiNormAdj:fat.ffmiNorm)/28*100)))}%`, top:0, bottom:0, width:2, background:'#fff', opacity:0.9 }} />
                <div style={{ width:`${Math.min(100, 25/28*100)}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#a78bfa)', opacity:0.55 }} />
                <div style={{ position:'absolute', left:`${25/28*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.35)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>18</span><span>25 лимит нат</span><span>28</span></div>
              {fat.waistAdj && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fff' }}>Талия с осевой: {fat.waistAdj}см (коррекция +{fat.axialAdd}см) · {fat.note}</div>}
              <div style={{ marginTop:6, display:'flex', gap:6, fontSize:9 }}>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFMI {fat.ffmi} → norm {fat.ffmiNorm}</span>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFM {fat.ffm}кг</span>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>{fat.accuracy}</div>
            </div>
          )}
          {mode==='cortisol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.15)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {cortisol.zoneLabelNat}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneNat==='high'||cortisol.zoneNat==='very_high'?'#ef4444': cortisol.zoneNat==='low'?'#60a5fa':'#22c55e' }}>{cortisol.nat} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{cortisol.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.03)', border: onAAS?'1px solid rgba(239,68,68,0.18)':'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS?'#f87171':'#fff' }}>С ААС — {cortisol.zoneLabelAAS}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneAAS==='high'||cortisol.zoneAAS==='very_high'?'#ef4444': cortisol.zoneAAS==='low'?'#60a5fa':'#22c55e' }}>{cortisol.aas} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>Δ {cortisol.delta>0?'+':''}{cortisol.delta} · {cortisol.acwrZone}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', display:'flex' }}>
                <div style={{ width:'38%', background:'rgba(96,165,250,0.45)' }} />
                <div style={{ width:'24%', background:'rgba(34,197,94,0.55)' }} />
                <div style={{ width:'16%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(239,68,68,0.55)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>0 low</span><span>38</span><span>62 norm</span><span>78 high</span><span>100</span></div>
              <div style={{ marginTop:6, position:'relative', height:6, borderRadius:20, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${onAAS? cortisol.aas: cortisol.nat}%`, background:'linear-gradient(90deg,#60a5fa,#22c55e 45%,#f59e0b 78%,#ef4444)', borderRadius:20, transition:'width 0.35s' }} />
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.4 }}>{cortisol.diurnal}</div>
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff' }}>
                Что-если: попробуй +1ч сна → {cortisol.whatIf(1,0,0)}, −2 стресса → {cortisol.whatIf(0,-2,0)}, ACWR 1.5→1.0 → {cortisol.whatIf(0,0,-0.5)}. Двигай слайдеры вверху — индекс live.
              </div>
            </div>
          )}
          {mode==='hematology' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background: hematology.zone==='unknown' ? 'rgba(255,255,255,0.03)' : `${hematology.color}14`, border:`1px solid ${hematology.zone==='unknown' ? 'rgba(255,255,255,0.06)' : hematology.color+'33'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: hematology.zone==='unknown' ? 'rgba(255,255,255,0.55)' : hematology.color }}>HCT {hematology.hct ?? '—'}% — {hematology.zoneLabel}</div>
                  <div style={{ fontSize:22, fontWeight:900, color: hematology.zone==='unknown' ? '#fff' : hematology.color }}>{hematology.hct ?? '—'}<span style={{ fontSize:11, color:'#fff' }}>%</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{hematology.hgbEstimated ? `HGB ~${hematology.hgbEstimated} г/л` : 'введи HCT/HGB'} · {hematology.viscosityFlag ? '⚠ гипервязкость' : 'вязкость OK'} · GFR {gfr ?? '—'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#f87171' }}>Вода с HCT</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#38bdf8' }}>{hematology.waterTargetMl}<span style={{ fontSize:10, color:'#fff' }}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{hematology.mlPerKg}мл/кг · {hematology.waterAdjMl>0 ? `+${hematology.waterAdjMl} к базе` : 'база 35мл/кг'} · факт {waterL}л</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', position:'relative', display:'flex' }}>
                <div style={{ width:'40%', background:'rgba(34,197,94,0.45)' }} />
                <div style={{ width:'15%', background:'rgba(234,179,8,0.55)' }} />
                <div style={{ width:'15%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(239,68,68,0.55)' }} />
                {hematology.hct!=null && <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, (hematology.hct-36)/(62-36)*100))}%`, top:0, bottom:0, width:2, background:'#fff', boxShadow:'0 0 6px rgba(255,255,255,0.8)' }} />}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>36</span><span>48 норма</span><span>51</span><span>54 стоп</span><span>62</span></div>
              {hctHistory.length>=2 && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.3, marginBottom:6 }}>
                    История HCT · {hctStats.measured} измерений{hctStats.forecast>0 ? ` + ${hctStats.forecast} прогноз` : ''}
                    {hctStats.delta!=null ? ` · Δ ${hctStats.delta>0?'+':''}${hctStats.delta}%` : ''}
                    {hctStats.lastStep!=null ? ` · посл. шаг ${hctStats.lastStep>0?'+':''}${hctStats.lastStep}%` : ''}
                  </div>
                  <div style={{ display:'flex', gap:3, alignItems:'end', height:36 }}>
                    {hctHistory.slice(-14).map((p,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                        <div style={{ width:'100%', height: Math.max(4, Math.min(32, (p.hct-36)*1.25)), borderRadius:3, opacity: p.est ? 0.45 : 1, border: p.est ? '1px dashed rgba(255,255,255,0.55)' : 'none', boxSizing:'border-box', background: p.hct>54 ? '#ef4444' : p.hct>51 ? '#f59e0b' : p.hct>=48 ? '#eab308' : '#22c55e' }} title={`${p.date} ${p.hct}%${p.est ? ' — прогноз, не измерение' : ''}`} />
                        <span style={{ fontSize:6, color:'rgba(255,255,255,0.35)' }}>{p.est ? '~' : ''}{p.date.slice(5).replace('-','/')}</span>
                      </div>
                    ))}
                  </div>
                  {donationLog.length>0 && <div style={{ marginTop:6, fontSize:8, color:'#ef4444' }}>🩸 Донации: {donationLog.map(d=> `${d.date} (${d.hct}%)`).join(' · ')}</div>}
                </div>
              )}
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>{hematology.ironRecLabel}</div>
                <div style={{ padding:8, borderRadius:8, background: hematology.donation.needed ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border:`1px solid ${hematology.donation.needed ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, textAlign:'center', fontSize:10, color: hematology.donation.needed ? '#f87171' : '#22c55e' }}>{hematology.donation.text}{hematology.donation.needed ? ` k=${hematology.donation.k}` : ''}</div>
              </div>
              {donationGuard && (
                <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, fontSize:10, lineHeight:1.4, background: donationGuard.blocked ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.06)', border:`1px solid ${donationGuard.blocked ? 'rgba(239,68,68,0.20)' : 'rgba(34,197,94,0.14)'}`, color: donationGuard.blocked ? '#f87171' : '#22c55e' }}>
                  🩸 Последняя донация {donationGuard.lastDate} — прошло {donationGuard.days} дн.{' '}
                  {donationGuard.blocked
                    ? <>Повторная флеботомия <b>не раньше {donationGuard.readyOn}</b> (интервал {donationGuard.minDays} дн ≈ 8 нед). Сейчас — только гидратация и контроль HCT.</>
                    : <>Интервал {donationGuard.minDays} дн выдержан — повторная сдача допустима с {donationGuard.readyOn} (решение — с гематологом).</>}
                </div>
              )}
              <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background: hematology.ferritinFlag ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color: hematology.ferritinFlag ? '#fbbf24' : '#fff' }}>ферритин {ferritin ?? '—'} {hematology.ferritinFlag ? '⚠ &lt;30' : 'OK'}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background: hematology.gfrFlag ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color: hematology.gfrFlag ? '#f87171' : '#fff' }}>GFR {gfr ?? '—'} {hematology.gfrFlag ? '⚠ &lt;60' : ''}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>PRAL {hematology.pralNote}</span>
                <span style={{ fontSize:9, padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>питание × гематология ×{hematology.nutritionMult}</span>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)', fontSize:10, color:'#fff', lineHeight:1.4 }}>
                <b style={{ color: hematology.color }}>Рекомендации:</b><br/>
                {hematology.recommendations.map((r,i)=>(<span key={i}>• {r}<br/></span>))}
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={()=> { const txt=`HCT ${hematology.hct}% — ${hematology.zoneLabel}. Вода ${hematology.waterTargetMl}мл (${hematology.mlPerKg}мл/кг), ${hematology.ironRecLabel}, ${hematology.donation.text}${donationGuard?.blocked ? ` — повторная сдача не раньше ${donationGuard.readyOn} (прошло ${donationGuard.days} из ${donationGuard.minDays} дн)` : ''}`; void shareOrCopyText('HCT-сводка', txt).then(ok => showToast(ok ? 'Скопировано: '+txt : txt)); }} className="mh-act" style={{ flex:1, padding:'10px', minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>⎘ Копировать сводку</button>
                <button onClick={()=> {
                  const payload={ hct: hematology.hct, waterTargetMl: hematology.waterTargetMl, ironRec: hematology.ironRec, donation: hematology.donation, donationReadyOn: donationGuard?.blocked ? donationGuard.readyOn : null, ts: Date.now(), source:'metabolic-hub-hematology' };
                  try{ localStorage.setItem('he_hematology_advice', JSON.stringify(payload)); window.dispatchEvent(new CustomEvent('he-hematology-advice', {detail: payload})); showToast(`Сохранено he_hematology_advice: HCT ${hematology.hct}% → ${hematology.zoneLabel}`); }catch{ showToast('Сохранено'); }
                }} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:800, fontSize:10, cursor:'pointer' }}>💾 В планировщик (he_hematology_advice)</button>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={()=>{
                  try{
                    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Гематология — ${hematology.hct ?? '—'}%</title><style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px}th{background:#f5f5f5;text-align:left}.badge{padding:2px 6px;border-radius:6px;color:#fff;font-weight:700;font-size:11px}</style></head><body><h1>🩸 Гематокрит — сводка PRO</h1><p>Дата: ${new Date().toLocaleString('ru-RU')} · Вес ${weight}кг · Пол ${sex} · ААС ${onAAS? aasDose+'мг': 'нет'}</p><table><tr><th>Показатель</th><th>Значение</th></tr><tr><td>HCT</td><td><span class="badge" style="background:${hematology.color}">${hematology.hct ?? '—'}% — ${hematology.zoneLabel}</span></td></tr><tr><td>HGB (оценка)</td><td>${hematology.hgbEstimated ?? '—'} г/л</td></tr><tr><td>Вода цель</td><td>${hematology.waterTargetMl} мл (${hematology.mlPerKg} мл/кг) ${hematology.waterAdjMl? `+${hematology.waterAdjMl} к базе`:''} · факт ${waterL}л</td></tr><tr><td>Железо</td><td>${hematology.ironRecLabel}</td></tr><tr><td>Донация</td><td>${hematology.donation.text} k=${hematology.donation.k}</td></tr><tr><td>Вязкость</td><td>${hematology.viscosityFlag? '⚠ гипервязкость':'OK'} · GFR ${gfr ?? '—'} ${hematology.gfrFlag? '⚠ &lt;60':''} · ферритин ${ferritin ?? '—'} ${hematology.ferritinFlag? '⚠ &lt;30':''}</td></tr><tr><td>Питание×гематология</td><td>×${hematology.nutritionMult} · PRAL ${hematology.pralNote}</td></tr></table><h3>Рекомендации</h3><ul>${hematology.recommendations.map(r=>`<li>${r}</li>`).join('')}</ul><p style="font-size:10px;color:#666">Источники: ESC 2023 эритроцитоз &gt;52% (м)/48% (ж), ASA флеботомия &gt;54%, lab-tier-recommendations, PROCEDURE_DB k0.30/0.45. Дисклеймер: не назначение — к гематологу + JAK2 при HCT&gt;52%.</p><script>window.print()</`+`script></body></html>`;
                    void printPlanHtml('Гематокрит — сводка PRO', html);
                  }catch{ showToast('Печать: открой HCT вкладку'); }
                }} className="mh-act" style={{ flex:1, padding:'10px', minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>🖨 Печать / PDF</button>
                <button onClick={()=>{
                  try{
                    const data={ date: localISODate(), weight, sex, onAAS, aasDose, hct: hematology.hct, hgb: hematology.hgbEstimated, gfr, ferritin, waterTargetMl: hematology.waterTargetMl, ironRec: hematology.ironRec, donation: hematology.donation, zone: hematology.zone, recommendations: hematology.recommendations, nutritionMult: hematology.nutritionMult };
                    void downloadCoachFile(JSON.stringify(data,null,2), `hematology-${data.date}.json`).then(ok => showToast(ok ? 'JSON экспортирован' : 'Экспорт'));
                  }catch{ showToast('Экспорт'); }
                }} className="mh-act" style={{ padding:'10px', minHeight:44, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>⬇ JSON</button>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.35 }}>Зоны: &lt;48 норма · 48-51 внимание · 51-54 донация · &gt;54 стоп ААС · &gt;60 критично. Источник: ESC 2023, ASA флеботомия, lab-tier-recommendations. Дисклеймер: не назначение — к гематологу + JAK2 при HCT&gt;52%.</div>
            </div>
          )}
          {mode==='ea' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:`${ea.color}14`, border:`1px solid ${ea.color}33`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: ea.zone==='unknown'?'rgba(255,255,255,0.55)':ea.color }}>EA {ea.ea ?? '—'} ккал/кг FFM · {ea.zoneLabel}</div>
                  <div style={{ fontSize:26, fontWeight:900, color: ea.ea!=null ? ea.color : '#fff' }}>{ea.ea ?? '—'}<span style={{ fontSize:10, color:'#fff' }}> ккал/кгFFM</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>FFM {ea.ffm}кг · EEE {ea.eee}ккал · пороги 30/45 (IOC RED-S)</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color: ea.color }}>{ea.zone==='low'?'🔴 LEA — риск RED-S': ea.zone==='reduced'?'🟡 Граница': ea.zone==='optimal'?'🟢 Оптимально':'—'}</b><br/>{ea.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>Формула: (EI − EEE)/FFM. EI из дневника/КБЖУ {Math.round(kbju.nat.kcal)}ккал, EEE = {weeklyEee.note} → {eeeDailyKcal}ккал/сут × 0.85 net (Loucks). Женщинам &lt;30 — аменорея/кость, &lt;45 — внимание.</span>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', display:'flex' }}>
                <div style={{ width:'40%', background:'rgba(239,68,68,0.55)' }} />
                <div style={{ width:'20%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(34,197,94,0.55)' }} />
                {ea.ea!=null && <div style={{ position:'absolute', left:0, right:0, height:10, pointerEvents:'none' }}><div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, (ea.ea/60)*100))}%`, top:0, bottom:0, width:2, background:'#fff' }} /></div>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>0 LEA</span><span>30</span><span>45 opt</span><span>60</span></div>
              {goal==='health' && ea.zone==='low' && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', fontSize:10, color:'#f87171' }}>⚠ Цель Здоровье + LEA &lt;30 — підвись ккал +300 или снизь EEE (убери 1 трен/кардио). Проверь ферритин/витамин D.</div>}
              {ea.ea!=null && ea.ea < 20 && <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', fontSize:9, color:'#f87171' }}>🚨 PSMF: EA &lt;20 (Blackburn) → FFM loss неизбежен даже с 2.8г/кг белка. EA {ea.ea} — срочно +300ккал. {ea.ea <15 && 'EA <15 — критично!'}</div>}
            </div>
          )}
          {mode==='alcohol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: alcohol.kcal>0?'rgba(249,115,22,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${alcohol.kcal>0?'rgba(249,115,22,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: alcohol.kcal>0?'#f97316':'rgba(255,255,255,0.55)' }}>{alcoholG}г этанола</div>
                  <div style={{ fontSize:26, fontWeight:900, color: alcohol.kcal>0?'#f97316':'#fff' }}>{alcohol.kcal}<span style={{ fontSize:10 }}> ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>7.1ккал/г · TEF {alcohol.tef}ккал · блок жира {alcohol.fatOxidationBlockedPct}%</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {alcohol.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>~{alcohol.stepsEq} шагов компенсируют. Алкоголь подавляет MPS и сон. Введи дозу в HPA-блоке.</span>
                  <div style={{ marginTop:8, display:'flex', gap:6 }}>
                    <PopupNumber label="Алкоголь, г" value={alcoholG} min={0} max={200} onChange={setAlcoholG} />
                  </div>
                </div>
              </div>
              {alcohol.kcal>0 && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.18)', fontSize:10, color:'#fff' }}>Учет в КБЖУ: {alcohol.kcal}ккал уже включены в TDEE TEF, но жир блок {alcohol.fatOxidationBlockedPct}% ~3ч — не планируй тренировку сразу после.</div>}
            </div>
          )}
          {mode==='protein' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:'rgba(132,204,22,0.08)', border:'1px solid rgba(132,204,22,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#84cc16' }}>{proteinMeals} приема · {proteinPro.perMeal}г/приём · DIAAS {proteinPro.diaas}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:'#84cc16' }}>{proteinPro.leucinePerMeal}<span style={{ fontSize:10 }}>г leuc</span></div>
                  <div style={{ fontSize:9, color: proteinPro.leucinePerMeal>=2.2?'#22c55e':'#f59e0b' }}>{proteinPro.leucinePerMeal>=2.2?'✓ MPS порог 2.5г достигнут':'⚠ <2.5г — добавь прием'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#84cc16' }}>Morton 2018 · Schoenfeld/Aragon · Res 2012 · DIAAS FAO:</b> {proteinPro.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>Всего {onAAS? kbju.aas.p:kbju.nat.p}г → {proteinMeals}×{proteinPro.perMeal}г ({proteinPro.perMealGPerKg}г/кг {proteinPro.perMealGPerKg>proteinPro.ceiling?`⚠>${proteinPro.ceiling}`: ''} · pre-sleep {proteinPro.preSleepG}г казеин +0.22кг LBM · Креатин {creatineUse?'да (1я нед +300мл)':'нет'}.</span>
                  <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                    {([3,4,5,6] as const).map(n=>(
                      <button key={n} onClick={()=> setProteinMeals(n)} style={{ padding:'6px 10px', borderRadius:8, border: proteinMeals===n?'1px solid #84cc16':'1px solid rgba(255,255,255,0.08)', background: proteinMeals===n?'rgba(132,204,22,0.12)':'rgba(255,255,255,0.03)', color:proteinMeals===n?'#84cc16':'#fff', fontSize:9, fontWeight:700, cursor:'pointer' }}>{n}×{Math.round((onAAS? kbju.aas.p:kbju.nat.p)/n)}г</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Train day: {kbju.periodization.trainDay.kcal}ккал Б{kbju.periodization.trainDay.p} Ж{kbju.periodization.trainDay.f} У{kbju.periodization.trainDay.c}</div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Rest day: {kbju.periodization.restDay.kcal}ккал Б{kbju.periodization.restDay.p} Ж{kbju.periodization.restDay.f} У{kbju.periodization.restDay.c}</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 {kbju.carbTiming} · Клетчатка {kbju.fiber.nat}г (soluble {fiberSplit.soluble} + insoluble {fiberSplit.insoluble} IoM) · TEF {kbju.tefNat}ккал перс. (P25% C7% F3%) · LBM save {lbmPres.pct}% {lbmPres.note}</div>
            </div>
          )}
          {mode==='maintenance' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: maintenance?.confidence==='high'?'rgba(34,197,94,0.08)': maintenance?.confidence==='medium'?'rgba(234,179,8,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${maintenance?.confidence==='high'?'rgba(34,197,94,0.18)': maintenance?.confidence==='medium'?'rgba(234,179,8,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>TDEE finder 14д · R2 {maintenance?.r2 ?? '—'} · {maintenance?.confidence ?? 'нет данных'}</div>
                  <div style={{ fontSize:22, fontWeight:900, color: maintenance?.tdee ? '#eab308' : '#fff' }}>{maintenance?.tdee || '—'}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{maintenance?.note ?? (diaryAvgKcal ? 'Нужно ≥7 взвешиваний' : 'Нужен дневник питания: без факта ккал TDEE из веса не выводится')}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#eab308' }}>Цель Hall 2011 density + AT + Helms caps:</b> {goalV2?.note ?? 'Введи цель вес в антропометрии'}<br/>
                  {goalV2 && <span>Дней ~{goalV2.days} ({goalV2.weeks}нед) при {goalV2.kcalDiff>0?'+':''}{goalV2.kcalDiff}ккал/сут · {goalV2.model} · AT −{maintenance?.atKcal ?? 0}ккал.</span>}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>История {weightHistory.length} точек · {weightHistory.length>=7? 'достаточно':'нужно ≥7'} · плотность {maintenance?.density ?? '—'}ккал/кг · DLW ±12% {stepsCalc.dlwBand.low}-{stepsCalc.dlwBand.high}</span>
                  <div style={{ marginTop:6, display:'flex', gap:6 }}>
                    <PopupNumber label="Цель вес" value={targetWeight ?? weight} min={35} max={200} onChange={setTargetWeight} />
                  </div>
                </div>
              </div>
              {!diaryAvgKcal && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(234,179,8,0.06)', border:'1px solid rgba(234,179,8,0.16)', fontSize:10, color:'#eab308', lineHeight:1.45 }}>
                  📓 Finder = вес + <b>факт</b> еды. Дневник пуст (0 дней), поэтому число не считается: цель из плана
                  — это не «сколько вы ели», и подставлять её значило бы выдать план за измерение.
                  Заполни ≥7 дней в «Дневнике питания» — и TDEE посчитается от реального тренда веса.
                </div>
              )}
              {emaChartModel ? (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:6 }}>📈 Динамика 28д · вес + EMA + ккал vs TDEE</div>
                  <MhEmaChart ema={emaChartModel.ema} raw={emaChartModel.raw} intakeByDate={emaChartModel.byDate} tdee={emaChartModel.tdee} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:4 }}><span>● факт · — EMA</span><span>бары — ккал (зелёные ±10% TDEE)</span></div>
                </div>
              ) : weightHistory.length>=3 && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:6 }}>Вес 14д · {weightHistory.length} точек</div>
                  <div style={{ display:'flex', gap:3, alignItems:'end', height:38 }}>
                    {weightHistory.slice(-14).map((p,i)=>{
                      const min=Math.min(...weightHistory.slice(-14).map(x=>x.kg)), max=Math.max(...weightHistory.slice(-14).map(x=>x.kg)), range=Math.max(1, max-min);
                      const h = 6 + ((p.kg - min)/range)*30;
                      return <div key={i} style={{ flex:1, height: h, borderRadius:3, background: i===weightHistory.slice(-14).length-1?'#eab308':'rgba(234,179,8,0.45)', border:'1px solid rgba(255,255,255,0.06)' }} title={`${p.date} ${p.kg}кг`} />
                    })}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:4 }}><span>{weightHistory[0]?.date.slice(5)}</span><span>{weightHistory[weightHistory.length-1]?.date.slice(5)}</span></div>
                </div>
              )}
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>
                💡 Hall density p*9400+(1-p)*1800 (Forbes p via BF) — 7700 фикс ошибка 45% у сухих. AT Trexler −10-15% при {'>'}3нед дефиците. DLW Westerterp ±12%.
              </div>
            </div>
          )}
          {mode==='neat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background:'rgba(20,184,166,0.08)', border:'1px solid rgba(20,184,166,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#14b8a6' }}>NEATpro сегодня · Levine 2002 + {profession === 'auto' ? `база «бытовая ${activityLevel}»` : `профессия ${profession} ${PROFESSION_PAL[profession]}`}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#14b8a6' }}>{neatPro.total}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>база {neatPro.profession} +{neatPro.standing} стоя +{neatPro.fidget>=0?'+':''}{neatPro.fidget} fidget +{neatPro.walking} ходьба</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {neatPro.note}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>NEAT объясняет плато сушки: +2ч стоя = +80ккал, +2000 шагов +80ккал. PAL 1.40-1.95 включает.</span>
                  <div style={{ marginTop:8, display:'flex', gap:6 }}>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>стоя<br/><b style={{ color:'#14b8a6' }}>{neatPro.standing}</b></div>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>fidget<br/><b style={{ color:'#14b8a6' }}>{neatPro.fidget}</b></div>
                    <div style={{ flex:1, padding:6, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>ходьба<br/><b style={{ color:'#14b8a6' }}>{neatPro.walking}</b></div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(20,184,166,0.06)', border:'1px solid rgba(20,184,166,0.12)', fontSize:9, color:'#fff' }}>Levine NEAT 350-700ккал диапазон — главный скрытый фактор TDEE. Добавь 1ч стоя + 3000 шагов = +160ккал без кардио.</div>
            </div>
          )}
          {mode==='at' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: at.tier==='severe'?'rgba(239,68,68,0.08)': at.tier==='moderate'?'rgba(245,158,11,0.08)': at.tier==='mild'?'rgba(234,179,8,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${at.tier==='severe'?'rgba(239,68,68,0.18)': at.tier==='moderate'?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: at.tier==='none'?'rgba(255,255,255,0.55)': at.tier==='severe'?'#ef4444':'#f59e0b' }}>AT {at.tier} · Trexler 2014</div>
                  <div style={{ fontSize:22, fontWeight:900, color: at.tier==='severe'?'#ef4444': at.tier==='moderate'?'#f59e0b': at.tier==='mild'?'#eab308':'#fff' }}>−{at.atKcal}<span style={{ fontSize:10 }}>ккал</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>RMR pred {at.rmrPred} → meas ~{at.rmrMeasEst} · {at.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  <b style={{ color:'#f97316' }}>Reverse-auto — MATADOR Byrne 2017</b><br/>старт {diaryAvgKcal ?? kbju.nat.kcal}ккал ({diaryAvgKcal ? 'дневник' : 'цель плана'}) · шаг по trend ({adaptiveV3 ? `тренд ${adaptiveV3.trend}кг/нед` : 'нет trend'}) до {reverseAuto[reverseAuto.length-1]?.kcal ?? stepsCalc.tdeeNat}ккал<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>После дефицита TDEE подавлен 10-15% 4-8нед. Резкий +500 = откат жира.</span>
                  <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
                    {reverseAuto.slice(0,6).map(s=>(
                      <span key={s.week} style={{ padding:'4px 8px', borderRadius:8, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.18)', fontSize:9, color:'#f97316' }}>нед {s.week}: {s.kcal}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'rgba(255,255,255,0.55)' }}>AT = RMR_измер − RMR_предск. Дефицит 500ккал {'>'}3нед → −80-120ккал (Trexler). Byrne MATADOR: интервальность сохраняет RMR лучше continuous.</div>
            </div>
          )}
          {mode==='thyroid' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: thyroid.mult!==1?'rgba(139,92,246,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${thyroid.mult!==1?'rgba(139,92,246,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#8b5cf6' }}>Thyroid · Kim 2014 · FT4 12-22</div>
                  <div style={{ fontSize:22, fontWeight:900, color: thyroid.mult===1?'#fff': thyroid.mult<1?'#f59e0b':'#22c55e' }}>×{thyroid.mult.toFixed(2)}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{thyroid.note} · BMR {kbju.bmr} ({bmrMethodLabel(kbju.nat.method)})</div>
                </div>
                <div style={{ padding:14, borderRadius:12, background: homa.zone==='ir'?'rgba(239,68,68,0.08)': homa.zone==='attention'?'rgba(245,158,11,0.08)': homa.zone==='optimal'?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${homa.zone==='ir'?'rgba(239,68,68,0.18)': homa.zone==='attention'?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: homa.zone==='ir'?'#ef4444': homa.zone==='attention'?'#f59e0b':'#22c55e' }}>HOMA-IR · Wallace 2004</div>
                  <div style={{ fontSize:22, fontWeight:900, color: homa.zone==='ir'?'#ef4444': homa.zone==='attention'?'#f59e0b': homa.zone==='optimal'?'#22c55e':'#fff' }}>{homa.homa ?? '—'}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{homa.note}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                <div style={{ padding:12, borderRadius:12, background: lipid && lipid.ldlDelta>10?'rgba(239,68,68,0.08)': lipid?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.03)', border:`1px solid ${lipid && lipid.ldlDelta>10?'rgba(239,68,68,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: lipid && lipid.ldlDelta>10?'#ef4444':'#22c55e' }}>Lipid · Mensink 2003</div>
                  <div style={{ fontSize:14, fontWeight:900, color: lipid && lipid.ldlDelta>10?'#ef4444':'#fff' }}>{lipid? `${lipid.ldlDelta>0?'+':''}${lipid.ldlDelta} LDL` : '—'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{lipid?.note ?? 'Введи SFA и fiber в Pro-измерениях'}</div>
                </div>
                <div style={{ padding:12, borderRadius:12, background: (fli!=null && fli>=60)?'rgba(239,68,68,0.08)': (fli!=null && fli>=30)?'rgba(245,158,11,0.08)': fli!=null?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.03)', border:`1px solid ${(fli!=null && fli>=60)?'rgba(239,68,68,0.18)': (fli!=null && fli>=30)?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: (fli!=null && fli>=60)?'#ef4444': (fli!=null && fli>=30)?'#f59e0b':'#22c55e' }}>FLI · Bedogni 2006 · {fli!=null ? `${fli}%` : '—'}</div>
                  <div style={{ fontSize:14, fontWeight:900, color: fli==null?'#fff': fli>=60?'#ef4444': fli>=30?'#f59e0b':'#22c55e' }}>{fli==null?'—': fli<30?'Нет стеатоза': fli>=60?'Стеатоз': 'Серая зона'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{fli==null?'Введи waist/TG/GGT': fli<30?'Исключает NAFLD (&lt;30)': fli>=60?'Подтверждает ≥60':'30-60 серая зона'}</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:8, padding:'4px 8px', borderRadius:8, background: psmf.risk?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', border:'1px solid rgba(255,255,255,0.06)', color: psmf.risk?'#ef4444':'#22c55e' }}>{psmf.note}</span>
                <span style={{ fontSize:8, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Menstrual: {menstrual.note} {menstrualPhase==='luteal' && `+${menstrual.kg}кг воды`}</span>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
                Thyroid Kim 1 pmol FT4 ≈ +2.2% BMR. HOMA-IR &lt;1.4 оптимально · Mensink 10г SFA +12 LDL / 10г fiber −5 · FLI Bedogni &lt;30 нет стеатоза &gt;60 стеатоз · PSMF Blackburn EA&lt;15 · Mens+ FLI требуют лабы.
              </div>
            </div>
          )}
          {mode==='sweat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: sweatV2 ? 'rgba(6,182,214,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${sweatV2?'rgba(6,182,214,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#06b6d4' }}>Пот-тест V2 — rate{sweatV2 && !sweatV2.measured ? ' (оценка)' : ''}</div>
                  <div style={{ fontSize:22, fontWeight:900, color: sweatV2?'#06b6d4':'#fff' }}>{sweatV2? `${sweatV2.rateLPerH.toFixed(2)} л/ч`:'—'}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{sweatV2? `${sweatV2.totalLossMl}мл за ${sweatHours}ч · Na ${sweatV2.elect.sodiumMg}мг`:'(до-после+выпито)/часы'}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
                  {sweatV2 ? sweatV2.plan.note : 'Введи вес до/после + выпито. 1кг =1л пота. Тестируй в условиях гонки.'}<br/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>{sweatV2?.rangeNote ?? 'Baker avg Na 900мг/л (200-1800 индивид.)'} · BHI-топ: {beverageV2.slice(0,2).map(b=> b.name).join(', ')}</span>
                  {sweatV2?.plan.hyponatremiaRisk && <span style={{ display:'block', color:'#ef4444', marginTop:4 }}>⚠ Гипонатриемия — добавь Na 500-700мг/л</span>}
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Pre<br/><b style={{color:'#06b6d4'}}>{sweatV2?.plan.preMl ?? '—'}мл</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>During<br/><b style={{color:'#06b6d4'}}>{sweatV2?.plan.duringMlPerH ?? '—'}мл/ч</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Post<br/><b style={{color:'#06b6d4'}}>{sweatV2?.plan.postMl ?? '—'}мл</b> · {sweatV2?.plan.bottles05 ?? '—'}×0.5л</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>💡 Baker 2017 — главный источник потерь Na. Введи свой Na 900мг/л (измерь полоской). Влажность и жара уже учтены в воде выше.</div>
            </div>
          )}
          {mode==='mets' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: mets.hasMetS?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${mets.hasMetS?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: mets.hasMetS?'#ef4444':'#22c55e' }}>MetS ATP III · {mets.score}/5</div>
                  <div style={{ fontSize:18, fontWeight:900, color: mets.hasMetS?'#ef4444':'#22c55e' }}>{mets.hasMetS?'MetS':'Нет MetS'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{mets.criteria.join(', ')||'критериев 0'} · {mets.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', lineHeight:1.35 }}>
                  WHtR {whtr? whtr.toFixed(3):'—'} {whtr && whtr>=0.5? '⚠ ≥0.5':''} · ABSI {absi? absi.toFixed(3):'—'} · BAI {bai ?? '—'}<br/>TyG {tyg ?? '—'} {tyg && tyg>=8.8? '⚠ IR':''} · FIB-4 {fib4 ?? '—'} {fib4 && fib4>=1.3? (fib4>2.67?'⚠ высок':'⚠'):''} · QUICKI {quicki ?? '—'} {quicki && quicki<0.33?'⚠':''}<br/><span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>ATP III ≥3/5 = MetS. TyG =ln(TG×Gluc/2) ≥8.8 IR. FIB-4 &lt;1.30 низкий &gt;2.67 высокий.</span><br/><span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{IR_MARKERS_SHARED_INPUT_NOTE}.</span>
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>TyG<br/><b style={{color: tyg && tyg>=8.8?'#ef4444':'#22c55e'}}>{tyg ?? '—'}</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>FIB-4<br/><b style={{color: fib4 && fib4>2?'#ef4444': fib4 && fib4>1.3?'#f59e0b':'#22c55e'}}>{fib4 ?? '—'}</b> · APRI {apri ?? '—'}</div>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>Введи waist/TG/HDL/АД/глюкозу — автоматический MetS. Для FIB-4 нужны AST/ALT/тромбоциты (из лаб). Связан с FLI выше.</div>
            </div>
          )}
          {mode==='break' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:14, borderRadius:12, background: refeedNeed.needed?'rgba(245,158,11,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${refeedNeed.needed?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                  <div style={{ fontSize:10, color: refeedNeed.needed?'#f59e0b':'rgba(255,255,255,0.55)' }}>Refeed — лептин/T3</div>
                  <div style={{ fontSize:16, fontWeight:900, color: refeedNeed.needed?'#f59e0b':'#fff' }}>{refeedNeed.needed? `+${refeedNeed.carbBoostPct}% углей`:'Не нужен'}</div>
                  <div style={{ fontSize:8, color:'#fff' }}>{refeedNeed.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#fff', lineHeight:1.4 }}>
                  MATADOR (Byrne 2017): 2нед дефицит / 2нед maintenance чередование сохраняет RMR лучше continuous.<br/><span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>Diet break каждые 6нед ×2нед maintenance. Твоя цель {targetWeight? `${targetWeight}кг`:'—'} → {dietBreakPlan? `${dietBreakPlan.length}нед`:'—'}.</span>
                  {dietBreakPlan && <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>{dietBreakPlan.slice(0,12).map((p,i)=><span key={i} style={{ padding:'3px 6px', borderRadius:6, background: p.phase==='deficit'?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.10)', border:`1px solid ${p.phase==='deficit'?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.18)'}`, fontSize:8, color: p.phase==='deficit'?'#f87171':'#22c55e' }}>{p.week}:{p.phase==='deficit'?'−':'○'}</span>)}</div>}
                </div>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Недель в дефиците<br/><b style={{color:'#8b5cf6'}}>{weeksInDeficit ?? '—'}</b></div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9, color:'#fff' }}>Caffeine curve<br/><b style={{color:'#8b5cf6'}}>{caffeineCurve.remainingMg}мг</b> · HL 5ч · cut-off {caffeineCurve.sleepCutoffH}ч</div>
              </div>
              <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:4 }}>Carb-load (Breno 10-12г/кг)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                    <PopupNumber label="Дней" value={carbLoadDays} min={1} max={3} onChange={setCarbLoadDays} />
                    <PopupNumber label="г/кг" value={carbGPerKg} min={6} max={12} step={0.5} onChange={setCarbGPerKg} />
                  </div>
                  <div style={{ fontSize:8, color:'#22c55e', marginTop:4 }}>{carbLoad.dailyG}г/сут · всего {carbLoad.totalCarbG}г — {carbLoad.note.split('—')[1] ?? ''}</div>
                </div>
                <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:4 }}>Sodium-load</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                    <PopupNumber label="Дней" value={sodiumLoadDays} min={1} max={3} onChange={setSodiumLoadDays} />
                    <PopupNumber label="Na г/сут" value={sodiumGPerDay} min={3} max={7} step={0.5} onChange={setSodiumGPerDay} />
                  </div>
                  <div style={{ fontSize:8, color:'#f59e0b', marginTop:4 }}>{sodiumLoad.dailyG}г/сут · всего {sodiumLoad.totalSodiumG}г — {sodiumLoad.note.split('—')[1] ?? ''}</div>
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:4, alignItems:'center', height: 18 }}>
                {[0,2,4,6,8,10,12,16,20,24].map(h=>{
                  const c=Math.round(caffeineMg*Math.pow(0.5, h/5));
                  const hh= Math.max(4, Math.min(24, (c/ Math.max(1,caffeineMg))*24));
                  return <div key={h} style={{ flex:1, height: hh, borderRadius:3, background: h<=caffeineHoursSince ? '#8b5cf6' : 'rgba(139,92,246,0.25)', border:'1px solid rgba(255,255,255,0.06)' }} title={`${h}ч: ${c}мг`} />;
                })}
              </div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', display:'flex', justifyContent:'space-between' }}><span>0ч</span><span>{caffeineHoursSince}ч сейчас</span><span>24ч</span></div>
              <div style={{ marginTop:6, fontSize:8, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'6px 8px' }}>{caffeineCurve.note} · Dulloo +3% TEF. Резкий +500 после дефицита = откат жира — reverse +100/7д.</div>
            </div>
          )}
        </div>
      </div>

      {/* Действия — выгрузить сводку одним нажатием или начать заново */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
        <button type="button" className="mh-act" onClick={()=>{
          const txt = `Метаболика Pro — ${MODE_DEFS.length} калькуляторов\nTDEE ${oneAnswer.tdee} ккал [${oneAnswer.low}–${oneAnswer.high}]\nВода ${onAAS ? water.aas : water.nat} мл\nКБЖУ ${onAAS ? kbju.aas.kcal : kbju.nat.kcal} ккал (Б${onAAS ? kbju.aas.p : kbju.nat.p} Ж${onAAS ? kbju.aas.f : kbju.nat.f} У${onAAS ? kbju.aas.c : kbju.nat.c})\nEA ${ea.ea ?? '—'} ккал/кгFFM · ${ea.zoneLabel}\nHCT ${hematology.hct ?? '—'}% · жир ${fat.current}% · FFMI ${onAAS ? fat.ffmiNormAdj : fat.ffmiNorm}`;
          void shareOrCopyText('Метаболика Pro — сводка', txt).then(ok => showToast(ok ? 'Сводка скопирована' : txt));
        }} style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:10, fontWeight:800, cursor:'pointer' }}>⎘ Копировать сводку</button>
        <button type="button" className="mh-act" onClick={()=>{
          try{
            const rows: Array<[string,string]> = [
              ['TDEE', `${oneAnswer.tdee} ккал [${oneAnswer.low}–${oneAnswer.high}]`],
              ['Вода', `${onAAS ? water.aas : water.nat} мл`],
              ['КБЖУ', `${onAAS ? kbju.aas.kcal : kbju.nat.kcal} ккал · Б${onAAS ? kbju.aas.p : kbju.nat.p} Ж${onAAS ? kbju.aas.f : kbju.nat.f} У${onAAS ? kbju.aas.c : kbju.nat.c}`],
              ['EA', `${ea.ea ?? '—'} ккал/кгFFM · ${ea.zoneLabel}`],
              ['HCT', `${hematology.hct ?? '—'}% · ${hematology.zoneLabel}`],
              ['Состав', `${fat.current}% жира · FFMI ${onAAS ? fat.ffmiNormAdj : fat.ffmiNorm}`],
              ['Stress Load', `${onAAS ? cortisol.aas : cortisol.nat}/100 · ${onAAS ? cortisol.zoneLabelAAS : cortisol.zoneLabelNat}`],
              ['MetS', `${mets.score}/5 · ${mets.hasMetS ? 'MetS' : 'норма'}`],
            ];
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>Метаболика Pro</title><style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px}th{background:#f5f5f5;text-align:left}</style></head><body><h1>⚖️ Метаболика Pro — сводка</h1><p>Дата: ${new Date().toLocaleString('ru-RU')} · вес ${weight}кг · ${sex==='male'?'муж':'жен'} · ${onAAS ? `ААС ${aasDose}мг/нед (EXP)` : 'натурал'}</p><table><tr><th>Показатель</th><th>Значение</th></tr>${rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><p style="font-size:10px;color:#666">Формульные оценки TDEE имеют разброс и не заменяют измерение. Stress Load — эвристика. Не назначение.</p></body></html>`;
            void printPlanHtml('Метаболика Pro — сводка', html);
          }catch{ showToast('Печать недоступна в этом окне'); }
        }} style={{ flex:1, minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(96,165,250,0.22)', background:'rgba(96,165,250,0.10)', color:'#60a5fa', fontSize:10, fontWeight:800, cursor:'pointer' }}>🖨 PDF сводки</button>
        <button type="button" className="mh-act" onClick={resetAll} style={{ minHeight:44, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(239,68,68,0.22)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:10, fontWeight:800, cursor:'pointer' }}>⟲ Сброс</button>
      </div>

      <details style={{ ...CARD, marginTop:10, padding:'10px 12px' }}>
        <summary style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.78)', cursor:'pointer', minHeight:44, display:'flex', alignItems:'center' }}>📚 Источники и дисклеймер</summary>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.5, marginTop:6 }}>
          Источники: Mifflin-St Jeor 1990 · Cunningham 1991 · Katch-McArdle · Owen 1986 · Ten Haaf 2014 · Harris-Benedict R 1984 · Henry Oxford 2005 · Livingston 2005 Frankfield · EFSA 2010 · IOM 2004 · Baker 2017 sweat · ISSN Helms 2014 · Morton 2018 · Schoenfeld/Aragon 2018 · Res 2012 pre-sleep · Navy Hodgdon 1984 · Jackson-Pollock 1978 · Durnin-Womersley 1974 · Kyle BIA 2004 · Kouri FFMI 1995 · Helms 2023 FFMI 26.2 · Gabbett ACWR 2016 · Hall 2011 density · Trexler 2014 AT · Byrne MATADOR 2017 · Levine NEAT 2002 · Kim thyroid 2014 · Loucks/Mountjoy EA 2014/2018 · Suter 1992 alcohol · ESC 2023 · ASA флеботомия · Westerterp TEF/DLW 2004/1999 · Pontzer 2021.<br/>Stress Load — эвристика E (не кортизол). AAS — experimental ⚠️ (Bhasin/Heber). EA &lt;30/25 — к врачу + DEXA. Не назначение.
        </div>
      </details>

    </div>
  );
};
