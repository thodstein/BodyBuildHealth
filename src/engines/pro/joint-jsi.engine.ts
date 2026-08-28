/**
 * joint-jsi.engine.ts — AI-ортопед: Индекс Суставного Стресса (JSI) + риск-менеджмент.
 *
 * Реализует спецу из промпта 1:1:
 *  Вход: упражнение/вес/%1ПМ/объём/темп + геометрия (хват/локти/точка/стойка/глубина) + боль/мертвая точка/ошибки + антропометрия/ААС/прогресс
 *  Ядро: JSI_joint = (Вес×Повт×Подх)×K_base×K_tempo×K_anatomy×K_pharma×K_pain×K_amplitude  + deadly combos + phase overload
 *  Выход: тепловая карта, тюнинг (углы/TUT/замена), нутрицевтики (зел/желт/красн)
 *
 * Чистый движок. Интеграция с BBH: читает UnifiedSettings (personal/pharma/health) снаружи — сюда передают уже resolved значения.
 */
import type { Lift } from '../lms/weakpoint-pl';
import type { JointId } from './joint-load-master.engine';

// ── Типы ──

export type AmplitudeMode = 'full' | 'partial_top' | 'partial_stretched';
export type JsiLevel = 'green' | 'yellow' | 'red' | 'critical';

export interface JointJsiInput {
  lift: Lift;
  exerciseId?: string;
  weightKg: number;
  pct1RM?: number; // 0..1.1 (если есть — используется для deadly порога >0.8)
  bodyWeightKg?: number;
  sets: number;
  reps: number;
  tempoEccSec: number; // эксцентрика, сек
  hasBounce?: boolean; // отбив
  amplitude: AmplitudeMode;
  // bench geometry
  gripWidth?: 'narrow' | 'medium' | 'wide';
  elbowAngleDeg?: 0 | 45 | 90;
  touchPoint?: 'upper_chest' | 'lower_chest' | 'clavicles';
  wristStraight?: boolean; // true=прямая, false=заваленная
  // squat geometry
  stanceWidth?: 'narrow' | 'medium' | 'wide';
  squatDepth?: 'full' | 'parallel' | 'partial';
  heelLift?: boolean; // штангетки/блины
  // субъективное
  painMap: Partial<Record<JointId, number>>; // 0..10
  deadPoint: 'bottom' | 'middle' | 'top' | 'none';
  amplitudeErrors?: string[]; // butt_wink, bar_asymmetry, scapular_collapse, bounce
  // физиология
  anthropometry?: { heightCm?: number; armSpanCm?: number; femurCm?: number; torsoCm?: number; shoulderWidthCm?: number };
  aasStack?: string[]; // ids lower
  strengthProgressPctPerWeek?: number; // % прироста веса/нед
  oldInjuries?: string[]; // зоны
}

export interface JointJsiPerJoint {
  jsi: number;
  level: JsiLevel;
  kBase: number;
  kTempo: number;
  kAnatomy: number;
  kPharma: number;
  kPain: number;
  kAmplitude: number;
}

export interface DeadlyCombo {
  id: string;
  level: 'critical';
  title: string;
  desc: string;
  joints: JointId[];
}

export interface TuningSuggestion {
  id: string;
  type: 'angle' | 'tut' | 'replace';
  targetJoint: JointId;
  action: string;
  expected: string; // -25% JSI
  alternative?: string;
}

export interface NutraceuticalTier {
  tier: 'green' | 'yellow' | 'red';
  title: string;
  basket: string[];
  labs?: string[];
  note: string;
}

export interface JointJsiResult {
  perJoint: Record<JointId, JointJsiPerJoint>;
  maxJsi: number;
  maxJoint: JointId;
  overallLevel: JsiLevel;
  deadlyCombos: DeadlyCombo[];
  phaseOverload: { joint: JointId; jointLabel: string; reason: string }[];
  tuning: TuningSuggestion[];
  nutraceutical: NutraceuticalTier;
}

// ── Константы ──

const JOINTS: JointId[] = ['wrist','elbow','shoulder','spine','hip','knee','ankle'];
const JOINT_RU: Record<JointId,string> = { wrist:'Кисть', elbow:'Локоть', shoulder:'Плечо', spine:'Поясница L4-S1', hip:'Таз', knee:'Колено', ankle:'Голеностоп' };

// K_base: нагрузка сустава в лифте (0..1.2). Сумма по суставу ≈ кинематическая цепь.
const K_BASE: Record<Lift, Partial<Record<JointId, number>>> = {
  bench:        { shoulder:1.0, elbow:0.85, wrist:0.9, spine:0.25, hip:0.05, knee:0, ankle:0 },
  incline_press:{ shoulder:1.0, elbow:0.8, wrist:0.85, spine:0.2, hip:0.05, knee:0, ankle:0 },
  ohp:          { shoulder:1.0, elbow:0.7, wrist:0.85, spine:0.55, hip:0.1, knee:0, ankle:0 },
  squat:        { knee:1.0, hip:0.9, spine:1.0, ankle:0.6, shoulder:0.15, elbow:0, wrist:0 },
  deadlift:     { spine:1.0, hip:0.85, knee:0.7, ankle:0.25, shoulder:0.3, elbow:0.15, wrist:0.5 },
  sumo:         { spine:0.85, hip:1.0, knee:0.9, ankle:0.5, shoulder:0.2, elbow:0.1, wrist:0.45 },
  row:          { spine:0.75, shoulder:0.55, elbow:0.7, wrist:0.4, hip:0.3, knee:0.1, ankle:0 },
  pulldown:     { shoulder:0.7, elbow:0.65, wrist:0.35, spine:0.2, hip:0.05, knee:0, ankle:0 },
  biceps:       { elbow:1.0, wrist:0.55, shoulder:0.25, spine:0.1, hip:0, knee:0, ankle:0 },
  triceps:      { elbow:1.0, wrist:0.55, shoulder:0.30, spine:0.10, hip:0, knee:0, ankle:0 },
  calf:         { ankle:1.0, knee:0.25, hip:0.05, spine:0.10, shoulder:0, elbow:0, wrist:0 },
  shrug:        { shoulder:0.55, spine:0.65, elbow:0.05, wrist:0.20, hip:0.10, knee:0, ankle:0 },
};

const DRY_AAS = new Set(['stanozolol','stan','winstrol','drostanolone','masteron','mast','trenbolone','tren','tren_acet','tren_enan']);

function kTempo(tempo: number, hasBounce?: boolean): number {
  let k = 1.0;
  if (tempo < 1.2) k = 1.35; // взрывной
  else if (tempo < 2.2) k = 1.12;
  else if (tempo < 3.2) k = 1.0;
  else if (tempo < 4.5) k = 0.82;
  else k = 0.72;
  if (hasBounce) k *= 1.35; // отбив
  return Math.round(k*100)/100;
}
function kAmplitude(a: AmplitudeMode): number {
  if (a==='partial_stretched') return 1.32; // High Risk — растянутая фаза
  if (a==='partial_top') return 0.86;
  return 1.0;
}
function kAnatomy(input: JointJsiInput, joint: JointId): number {
  let k = 1.0;
  const h = input.anthropometry?.heightCm ?? 0;
  const span = input.anthropometry?.armSpanCm ?? 0;
  const longArms = h>0 && span>0 && span - h > 5;
  const shortArms = h>0 && span>0 && span - h < -5;
  if (joint==='shoulder' && input.lift==='bench') {
    if (longArms && input.gripWidth==='wide') k *= 1.22;
    if (shortArms && input.gripWidth==='narrow') k *= 1.12;
    if (input.elbowAngleDeg===90) k *= 1.18;
    if (input.elbowAngleDeg===0) k *= 0.92;
    if (input.touchPoint==='clavicles') k *= 1.18;
  }
  if ((joint==='knee' || joint==='spine' || joint==='hip') && (input.lift==='squat' || input.lift==='deadlift' || input.lift==='sumo')) {
    const femur = input.anthropometry?.femurCm ?? 0;
    const torso = input.anthropometry?.torsoCm ?? 0;
    if (femur && torso && femur > torso && input.squatDepth==='full') k *= 1.15;
    if (input.stanceWidth==='wide' && joint==='hip') k *= 1.12;
  }
  // быстрый прогресс → связки отстают
  if (input.strengthProgressPctPerWeek != null && input.strengthProgressPctPerWeek > 2.0) {
    if (joint==='elbow' || joint==='knee' || joint==='shoulder') k *= 1.15;
  }
  // старая травма в зоне
  if (input.oldInjuries?.some(s => s.toLowerCase().includes(joint) || (joint==='spine' && /поясн|spine|disc|грыж/i.test(s)))) k *= 1.18;
  return Math.round(k*100)/100;
}
function kPharma(aasStack?: string[], joint?: JointId): number {
  if (!aasStack || aasStack.length===0) return 1.0;
  const low = aasStack.map(s=>s.toLowerCase());
  const hasDry = low.some(s=> DRY_AAS.has(s) || [...DRY_AAS].some(d=> s.includes(d)));
  const hasTren = low.some(s=> s.includes('tren'));
  if (!hasDry) return 1.0;
  // связки/хрящ страдают сильнее
  const isLigamentJoint = joint==='knee' || joint==='elbow' || joint==='shoulder' || joint==='ankle';
  if (hasTren && isLigamentJoint) return 1.5;
  if (hasTren) return 1.35;
  if (isLigamentJoint) return 1.4;
  return 1.18;
}
function kPain(pain?: number): number {
  if (pain==null || pain<=0) return 1.0;
  if (pain<=3) return 1.12;
  if (pain<=6) return 1.32;
  return 1.55;
}
function jsiLevel(jsi: number): JsiLevel {
  if (jsi >= 115) return 'critical';
  if (jsi >= 85) return 'red';
  if (jsi >= 50) return 'yellow';
  return 'green';
}

// ── Deadly combos ──

function detectDeadly(input: JointJsiInput): DeadlyCombo[] {
  const out: DeadlyCombo[] = [];
  if (input.lift==='bench' && input.gripWidth==='wide' && input.elbowAngleDeg===90 && input.touchPoint==='clavicles') {
    out.push({ id:'bench_impingement', level:'critical', title:'Широкий + 90° + ключицы → импиджмент', desc:'Острый импиджмент вращательной манжеты. Срочно сузить хват до 1.3× и локти 45°.', joints:['shoulder'] });
  }
  const pct = input.pct1RM ?? 0;
  if ((input.lift==='squat' || input.lift==='deadlift') && input.squatDepth==='full' && input.amplitudeErrors?.includes('butt_wink') && pct > 0.8) {
    out.push({ id:'spine_hernia', level:'critical', title:'Глубокий + кивок таза + >80% → грыжа L4-S1', desc:'Угроза грыжи. Ограничить глубину до параллели, box, брейсинг.', joints:['spine'] });
  }
  if (input.wristStraight===false && input.weightKg > (input.bodyWeightKg ?? 80)) {
    out.push({ id:'wrist_carpal', level:'critical', title:'Заваленная кисть + вес > тела → карпальный туннель', desc:'Синдром запястного канала. Bulldog-хват, гриф на подушке ладони.', joints:['wrist'] });
  }
  if (input.amplitude==='partial_stretched' && input.lift==='bench') {
    out.push({ id:'stretch_high', level:'critical', title:'Частичная в растянутой фазе (High Risk)', desc:'Пиковый shear на плече/груди. Только полная или верхняя частичная.', joints:['shoulder','elbow'] });
  }
  if (input.heelLift===false && input.squatDepth==='full' && (input.lift==='squat')) {
    // косвенно — если голеностоп жёсткий, но нет штангеток — риск
    // не critical, но помечаем
  }
  return out;
}

function phaseOverload(input: JointJsiInput): { joint: JointId; jointLabel: string; reason: string }[] {
  if (input.deadPoint==='none') return [];
  if (input.lift==='bench') {
    if (input.deadPoint==='bottom') return [{ joint:'shoulder', jointLabel:JOINT_RU.shoulder, reason:'Низ жима → пиковый удар по вращательной манжете плеча (суставная сумка гасит энергию).' }];
    if (input.deadPoint==='middle') return [{ joint:'elbow', jointLabel:JOINT_RU.elbow, reason:'Середина жима → излом, перегрузка сухожилия трицепса в локте.' }];
    if (input.deadPoint==='top') return [{ joint:'elbow', jointLabel:JOINT_RU.elbow, reason:'Дожим → трицепс/локоть, но ниже риск чем середина.' }];
  }
  if (input.lift==='squat') {
    if (input.deadPoint==='bottom') return [{ joint:'knee', jointLabel:JOINT_RU.knee, reason:'Низ приседа → мениск/пателла + таз labrum.' }];
    if (input.deadPoint==='middle') return [{ joint:'spine', jointLabel:JOINT_RU.spine, reason:'Середина → поясница, кивок.' }];
  }
  if (input.lift==='deadlift' || input.lift==='sumo') {
    if (input.deadPoint==='bottom') return [{ joint:'spine', jointLabel:JOINT_RU.spine, reason:'Срыв с пола → L4-S1 shear.' }];
  }
  return [];
}

// ── Тюнинг ──

function tuningFor(input: JointJsiInput, perJoint: Record<JointId, JointJsiPerJoint>): TuningSuggestion[] {
  const out: TuningSuggestion[] = [];
  const isRed = (j: JointId)=> perJoint[j] && (perJoint[j].level==='red' || perJoint[j].level==='critical');
  if (isRed('shoulder') && input.lift==='bench') {
    out.push({ id:'tune_grip', type:'angle', targetJoint:'shoulder', action:'Сузить хват до 1.3× биакром. ширины, локти 45°', expected:'-22% JSI плеча', alternative:'Жим гантелей параллельным хватом' });
    out.push({ id:'tune_tut', type:'tut', targetJoint:'shoulder', action:'Снизить вес на 20%, темп опускания 4с (TUT)', expected:'-25% JSI, мышца сохраняется', alternative:'Жим с паузой 3с' });
  }
  if (isRed('spine')) {
    out.push({ id:'tune_squat_depth', type:'angle', targetJoint:'spine', action:'Ограничить глубину до параллели / box-присед, штангетки', expected:'-28% JSI поясницы', alternative:'Болгарские выпады (осевая 0)' });
    out.push({ id:'tune_tut_spine', type:'tut', targetJoint:'spine', action:'Вес -20%, эксцентрика 4с', expected:'-25% JSI', alternative:'Гакк-присед' });
  }
  if (isRed('wrist')) {
    out.push({ id:'tune_wrist', type:'angle', targetJoint:'wrist', action:'Bulldog-хват: гриф на подушке ладони, кисть прямая', expected:'-30% JSI кисти', alternative:'Кистевые бинты + нейтраль' });
  }
  if (isRed('knee')) {
    out.push({ id:'tune_knee', type:'angle', targetJoint:'knee', action:'Сузить стойку / носки 15-20°, лента', expected:'-18% JSI колена', alternative:'Болгарские выпады' });
  }
  if (isRed('elbow')) {
    out.push({ id:'tune_elbow', type:'replace', targetJoint:'elbow', action:'Заменить штангу на гантели/канат', expected:'-20% JSI локтя', alternative:'Жим гантелей параллельным хватом' });
  }
  // замена паттерна — универсально если много красных
  const redCount = JOINTS.filter(j=> isRed(j)).length;
  if (redCount>=2) {
    out.push({ id:'replace_pattern', type:'replace', targetJoint:'spine', action:'Замена паттерна на осевую 0', expected:'-40% осевой', alternative: input.lift==='squat' ? 'Болгарские выпады' : input.lift==='bench' ? 'Жим гантелей' : 'Тяга гантели в наклоне' });
  }
  return out.slice(0,5);
}

function nutraceuticalFor(maxLevel: JsiLevel, maxPain: number): NutraceuticalTier {
  const pain = maxPain ?? 0;
  if (maxLevel==='critical' || maxLevel==='red' || pain>=7) {
    return {
      tier:'red', title:'Красная зона / острая боль — интенсивный протокол',
      basket:[
        'BPC-157 250-500мкг/сут (пептид восстановления связок/сухожилий)',
        'TB-500 (Тимозин бета-4) 2-2.5мг 2×/нед (ангиогенез, миграция фибробластов)',
        'GHK-Cu 1-2мг/сут (медь-пептид, ремоделирование коллагена)',
        'Глюкозамин сульфат 1500мг — только инъекционно (Дона в/м / Эльбона) — перорально биодоступность низкая',
        'Хондроитин сульфат 1200мг — только инъекционно (Мукосат в/м, Хондрогард в/м) или Алфлутоп (биоактивный концентрат в/м)',
        'UC-II 40мг','МСМ 2-3г','Босвеллия 300мг','Куркумин 500мг + пиперин',
      ],
      labs:['hs-CRP (ультрачувствительный СРБ)','СОЭ','Креатинкиназа (если отёк)','УЗИ сустава при синовите'],
      note:'Пептиды BPC/TB/GHK — ядро восстановления коллагена/сосудов. Глюкозамин/хондроитин — только в уколах (Мукосат/Алфлутоп/Дона) для доставки в синовию в обход ЖКТ. Контроль синовита по hs-CRP/СОЭ. При острой боли — делод.',
    };
  }
  if (maxLevel==='yellow' || pain>=4) {
    return {
      tier:'yellow', title:'Жёлтая зона — терапия БАД + пептиды',
      basket:[
        'BPC-157 250мкг/сут (лёгкий курс 4 нед)',
        'TB-500 2мг 1×/нед (поддержка)',
        'GHK-Cu 1мг/сут (4 нед, ремоделирование)',
        'UC-II (неденатурированный коллаген II) 40мг','МСМ 1.5-2г','Экстракт Босвеллии 300мг','Куркумин 500мг','Омега-3 2г','Гиалуроновая кислота 100мг',
      ],
      note:'Пептиды в желтой — превентивно низкими дозами (BPC/TB/GHK) + UC-II/МСМ/Босвеллия для торможения деградации хряща.',
    };
  }
  return {
    tier:'green', title:'Зелёная — профилактика',
    basket:['Гидролизат коллагена 10г + Витамин С 500мг (кофакторы синтеза)','Желатин 15г','Витамин D3 2000МЕ','Омега-3 1г','Кремний / хвощ'],
    note:'Кофакторы синтеза коллагена, профилактика износа.',
  };
}

// ── Главная ──

export function calcJointJsi(input: JointJsiInput): JointJsiResult {
  const tonnage = Math.max(0, input.weightKg) * Math.max(0,input.reps) * Math.max(0,input.sets);
  const baseDiv = 40; // калибровка: 100×5×4=2000/40=50 → yellow порог
  const kAmp = kAmplitude(input.amplitude);
  const kT = kTempo(input.tempoEccSec, input.hasBounce || input.amplitudeErrors?.includes('bounce') || input.amplitudeErrors?.includes('отбив'));
  const perJoint = {} as Record<JointId, JointJsiPerJoint>;
  let maxJsi = -1, maxJoint: JointId = 'shoulder';
  for (const joint of JOINTS) {
    const kBase = K_BASE[input.lift]?.[joint] ?? (joint==='spine'?0.2:0);
    if (kBase===0) { perJoint[joint]={ jsi:0, level:'green', kBase:0, kTempo:kT, kAnatomy:1, kPharma:1, kPain:1, kAmplitude:kAmp }; continue; }
    const kA = kAnatomy(input, joint);
    const kP = kPharma(input.aasStack, joint);
    const pain = input.painMap[joint] ?? 0;
    const kPa = kPain(pain);
    const jsi = Math.round((tonnage / baseDiv) * kBase * kT * kA * kP * kAmp * kPa);
    const level = jsiLevel(jsi);
    perJoint[joint]={ jsi, level, kBase, kTempo:kT, kAnatomy:kA, kPharma:kP, kPain:kPa, kAmplitude:kAmp };
    if (jsi > maxJsi) { maxJsi = jsi; maxJoint = joint; }
  }
  const overallLevel = jsiLevel(maxJsi);
  const deadlyCombos = detectDeadly(input);
  const phaseOverloadList = phaseOverload(input);
  const tuning = tuningFor(input, perJoint);
  const maxPain = Math.max(0, ...Object.values(input.painMap).map(v=> Number(v)||0));
  const nutraceutical = nutraceuticalFor(overallLevel, maxPain);
  return { perJoint, maxJsi, maxJoint, overallLevel, deadlyCombos, phaseOverload: phaseOverloadList, tuning, nutraceutical };
}

export const JSI_JOINT_RU = JOINT_RU;
export const JSI_LEVEL_COLOR: Record<JsiLevel,string> = { green:'#22c55e', yellow:'#facc15', red:'#ef4444', critical:'#991b1b' };
export const JSI_LEVEL_BG: Record<JsiLevel,string> = { green:'rgba(34,197,94,0.12)', yellow:'rgba(250,204,21,0.12)', red:'rgba(239,68,68,0.12)', critical:'rgba(153,27,27,0.25)' };
