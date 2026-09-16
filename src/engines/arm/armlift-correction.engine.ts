/**
 * armlift-correction.engine.ts — топ-3 коррекции + спец-блок (PRO-5, real).
 * Только армлифтинг-домен. Коррекции — РЕАЛЬНЫЕ упражнения exercise-catalog-arm
 * (имена резолвятся через getArmExerciseById, дозы — сеты/повторы/холды/отдых).
 * Армрестлинг (ARM_CORRECTIONS по 12 точкам стола) не используется — хабы раздельные.
 * Протоколы — из источников (CoC FAQ, NSCA, SBS 2024), без новой математики.
 * Чистые функции.
 */
import type { ArmliftWeakLink } from './armlift-diagnosis.engine';
import type { ArmliftCause } from './armlift-cause.engine';
import { getArmExerciseById } from '../../core/exercise-catalog-arm';

export interface ArmliftCorrection {
  id: string;
  /** id упражнения в exercise-catalog-arm (пусто — только для rest-паузы при боли). */
  exId: string;
  title: string;
  protocol: string;
  dose: string;
  freq: string;
  source: string;
  sets: number;
  reps: [number, number];
  holdSeconds?: number;
  restSec: number;
  /** Сессия плана: SupportGrip | PinchGrip | CrushGrip | GripHeavy. */
  dayTag: string;
  /** Фазы срыва, которые чинит (id точек). */
  fixesPhase: string[];
  /** D15: разминка перед работой. */
  warmup?: string;
}

export interface ArmliftRankCtx {
  equipment?: string[];
  cause?: ArmliftCause;
  asymPct?: number | null;
  inPlanIds?: string[];
  failurePoint?: string;
  /** D10 E3: дисбаланс сгибатели/разгибатели — экстензоры первыми. */
  extImbalance?: boolean;
  /** D11 E2: уровень CoC — лесенка рабочий/целевой. */
  cocLevel?: number | null;
  /** PRO-6 M4: холд-кривая «макс vs 70%» — поднимает упражнения под провал кривой. */
  holdCurve?: 'peak_gap' | 'endurance_gap' | 'both_low' | 'solid' | null;
}

interface PoolEntry {
  exId: string;
  protocol: string;
  dose: string;
  freq: string;
  source: string;
  sets: number;
  reps: [number, number];
  holdSeconds?: number;
  restSec: number;
  dayTag: string;
  /** D8: фазы срыва, которые чинит. */
  fixes?: string[];
  /** D15: разминка перед работой (CoC-канон). */
  warmup?: string;
}

/** D8: пул чинит свои фазы; без явного — фазы пула по умолчанию. */
const withFixes = (pool: PoolEntry[], fixes: string[]): PoolEntry[] =>
  pool.map((p) => ({ ...p, fixes: p.fixes ?? fixes }));

const SUPPORT_MAX: PoolEntry[] = [
  { exId: 'rolling_thunder', protocol: 'Тяжёлые тройки DOH + холд 10с на последнем подходе', dose: '5×3', freq: '2×/нед', source: 'SBS DOH holds', sets: 5, reps: [3, 3], holdSeconds: 10, restSec: 180, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + лёгкие сжимания 1×10–12 до жжения, не в отказ' },
  { exId: 'apollon_axle', protocol: 'Все разминки двойным пронированным, лямки только на максе', dose: 'до 85% 1ПМ', freq: 'каждая тяга', source: 'AUSA Beginners', sets: 4, reps: [3, 5], restSec: 180, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + 1×10–12 лёгким гриппером' },
  { exId: 'fat_bar_deadlift', protocol: '50мм гриф DOH, без лямок/разнохвата', dose: '4×5', freq: '1–2×/нед', source: 'NSCA thick bar', sets: 4, reps: [5, 5], restSec: 150, dayTag: 'SupportGrip', warmup: 'Разминка: DOH без лямок на лёгком, кисть нейтрально' },
  { exId: 'inch_dumbbell', protocol: '78кг одной рукой, контроль 1с вверху', dose: '3×1', freq: '1×/нед', source: 'Inch-классика', sets: 3, reps: [1, 1], holdSeconds: 3, restSec: 180, dayTag: 'GripHeavy', warmup: 'Разминка: сжимания + раскрытия 2×10' },
  { exId: 'wrist_wrench_60', protocol: 'Вращающаяся 60мм как RT, лёгкий вес на технику', dose: '3×5', freq: '1×/нед', source: 'RT-перенос', sets: 3, reps: [5, 5], restSec: 120, dayTag: 'SupportGrip', fixes: ['mid', 'hold_short'], warmup: 'Разминка: круги + лёгкий гриппер 1×10' },
];

const PINCH: PoolEntry[] = [
  { exId: 'plate_pinch_hold', protocol: '2 плиты гладкими наружу, удержание до отказа формы', dose: '3×20–30с', freq: '2–3×/нед', source: 'NSCA plate pinch', sets: 3, reps: [1, 1], holdSeconds: 25, restSec: 120, dayTag: 'PinchGrip', fixes: ['hold_short', 'hold_long', 'off_floor'], warmup: 'Разминка: пальцы — круги + лёгкий экстензор 1×15' },
  { exId: 'hub_pinch', protocol: '5 подушечек на базе, без «дверной ручки»', dose: '3×5', freq: '2×/нед', source: 'IronMind Hub', sets: 3, reps: [5, 5], holdSeconds: 3, restSec: 120, dayTag: 'PinchGrip', fixes: ['off_floor', 'hold_short'], warmup: 'Разминка: круги запястий + 1×10 лёгким щипком' },
  { exId: 'pinch_block_80', protocol: 'Деревянный блок 80мм двумя руками, тяга', dose: '5×3', freq: '2×/нед', source: 'Pinch-практика', sets: 5, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: мел + 1×10–12 лёгким блоком' },
  { exId: 'saxon_bar', protocol: 'Прямоугольник 3″ щипком двумя руками', dose: '4×3', freq: '1–2×/нед', source: 'Saxon-практика', sets: 4, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: пальцы тщательно прогреть — 1×10–12 лёгким щипком' },
  { exId: 'country_crush_2', protocol: '2″ блок щипком двумя руками', dose: '3×3', freq: '1×/нед', source: 'AUSA Crush', sets: 3, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: круги + лёгкий щипок 1×10' },
  { exId: 'anvil_hub', protocol: 'Наковальня щипком, hub-вариант', dose: '3×5', freq: '1×/нед', source: 'Anvil-практика', sets: 3, reps: [5, 5], holdSeconds: 3, restSec: 120, dayTag: 'PinchGrip', warmup: 'Разминка: круги запястий + 1×10 лёгкой наковальней' },
];

const CRUSH: PoolEntry[] = [
  { exId: 'coc_trainer', protocol: 'Warm: 10–12 лёгко, без отказа', dose: '1×12', freq: '2–3×/нед', source: 'CoC FAQ warm', sets: 1, reps: [10, 12], restSec: 60, dayTag: 'CrushGrip' },
  { exId: 'coc_no1', protocol: 'Work: 5–7 до отказа, 1–3 сета', dose: '3×5–7', freq: '2–3×/нед', source: 'CoC FAQ work', sets: 3, reps: [5, 7], restSec: 90, dayTag: 'CrushGrip' },
  { exId: 'coc_gripper', protocol: 'Work + challenge: частички/негативы после отказа', dose: '3×5 + негативы', freq: '2×/нед', source: 'CoC FAQ challenge', sets: 3, reps: [5, 5], restSec: 120, dayTag: 'CrushGrip', fixes: ['close_fail', 'hold_short'] },
  { exId: 'silver_bullet_hold', protocol: 'Удержание патрона в закрытом гриппере на время', dose: '3×макс', freq: '2×/нед', source: 'IronMind Silver', sets: 3, reps: [1, 1], holdSeconds: 20, restSec: 120, dayTag: 'CrushGrip', fixes: ['hold_short', 'hold_long'] },
];

const ENDURANCE: PoolEntry[] = [
  { exId: 'farmer_walk_fat', protocol: '50–80% веса тела в руку, отказ хвата на 40–45с', dose: '3×20–40м', freq: '2×/нед', source: 'NSCA carries', sets: 3, reps: [20, 40], restSec: 120, dayTag: 'SupportGrip', fixes: ['hold_long', 'mid'], warmup: 'Разминка: круги + лёгкие сжимания 2×15@30–40%' },
  { exId: 'towel_pullup', protocol: 'Полотенце через перекладину, DOH, без лямок', dose: '3×8', freq: '1–2×/нед', source: 'NSCA towel', sets: 3, reps: [6, 8], restSec: 120, dayTag: 'SupportGrip', fixes: ['mid', 'hold_long'], warmup: 'Разминка: вис лёгкий + круги 1 мин' },
  { exId: 'fat_gripz_curl', protocol: 'Любые сгибания с накладками 50мм', dose: '3×10', freq: '1–2×/нед', source: 'AUSA Fat Gripz', sets: 3, reps: [8, 12], restSec: 90, dayTag: 'SupportGrip', fixes: ['mid', 'hold_short'], warmup: 'Разминка: лёгкие сжимания 1×15' },
];

const WRIST_EXT: PoolEntry[] = [
  { exId: 'wrist_ext_bb', protocol: 'Ладони вниз, разгибание к себе на жжение', dose: '3×15–25', freq: '3–4×/нед', source: 'Баланс flex/ext', sets: 3, reps: [15, 25], restSec: 60, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + лёгкий экстензор 1×15' },
  { exId: 'wrist_roller', protocol: 'Вверх-вниз без провала запястья в сгиб (на время 60с — тоже зачёт)', dose: '3 подъёма', freq: '2×/нед', source: 'Gripnatic roller', sets: 3, reps: [1, 3], restSec: 90, dayTag: 'SupportGrip', warmup: 'Разминка: круги + лёгкий валик' },
  { exId: 'reverse_ez_curl', protocol: 'Пронированный хват, строго — двойной эффект на экстензоры', dose: '3×12', freq: '2×/нед', source: 'NSCA ext balance', sets: 3, reps: [10, 12], restSec: 90, dayTag: 'SupportGrip', warmup: 'Разминка: круги + лёгкий прямой гриф' },
  { exId: 'lever_top', protocol: 'Удержание рычага горизонтально 10–15с (контроль, incl. девиации)', dose: '3×холд', freq: '2×/нед', source: 'Sledge levering', sets: 3, reps: [1, 1], holdSeconds: 12, restSec: 90, dayTag: 'SupportGrip', fixes: ['mid', 'lockout'], warmup: 'Разминка: круги запястий 2 мин' },
];

/** Снаряд → его же упражнение в каталоге (практика по правилам). */
export const IMPLEMENT_TO_EX: Record<string, string> = {
  rolling_thunder: 'rolling_thunder',
  apollon_axle: 'apollon_axle',
  saxon_bar: 'saxon_bar',
  hub: 'hub_pinch',
  pinch_block: 'pinch_block_80',
  coc_gripper: 'coc_gripper',
  silver_bullet: 'silver_bullet_hold',
  excalibur: 'excalibur_handle',
  raptor_175: 'raptor_3',
  country_crush: 'country_crush_2',
  grandfather_clock: 'grandfather_clock',
  anvil: 'anvil_hub',
  saxon_medley: 'saxon_bar',
  fat_gripz: 'fat_gripz_curl',
};

const BASE_POOL: Record<ArmliftWeakLink, PoolEntry[]> = {
  thumb: withFixes(PINCH, ['off_floor', 'hold_short', 'hold_long']),
  fingers: withFixes(SUPPORT_MAX, ['off_floor', 'mid', 'lockout', 'close_fail']),
  wrist_ext: withFixes(WRIST_EXT, ['mid', 'lockout', 'hold_short']),
  support_endurance: withFixes(ENDURANCE, ['hold_long', 'hold_short', 'mid']),
  crush: withFixes(CRUSH, ['close_fail', 'hold_short', 'hold_long']),
  technique: [...SUPPORT_MAX.slice(0, 1), ...PINCH.slice(0, 1), ...ENDURANCE.slice(0, 1)],
  asymmetry: [...PINCH.slice(0, 1), ...SUPPORT_MAX.slice(0, 1), ...WRIST_EXT.slice(0, 1)],
  conditioning: [
    { exId: 'wrist_ext_bb', protocol: 'Минимальная нагрузка, без провокации боли', dose: '2×15', freq: 'ежедневно', source: 'Rehab-практика', sets: 2, reps: [15, 15], restSec: 60, dayTag: 'SupportGrip' },
    { exId: 'wrist_roller', protocol: 'Пустой валик, только кровоток', dose: '2 подъёма', freq: 'ежедневно', source: 'Rehab-практика', sets: 2, reps: [1, 2], restSec: 60, dayTag: 'SupportGrip' },
    { exId: 'plate_pinch_hold', protocol: 'Техника щипка с 50% веса, без боли', dose: '2×15с', freq: 'по готовности', source: 'Return-to-play', sets: 2, reps: [1, 1], holdSeconds: 15, restSec: 90, dayTag: 'PinchGrip' },
  ],
};

function equipmentOk(exEquip: string | undefined, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!exEquip) return true;
  const low = exEquip.toLowerCase();
  return allowed.some((a) => {
    const al = String(a).toLowerCase();
    return low.includes(al) || al.includes(low);
  });
}

function toCorrection(p: PoolEntry, reason: string, score: number): ArmliftCorrection {
  const cat = getArmExerciseById(p.exId) as any;
  const name = cat?.name || p.exId;
  return {
    id: p.exId, exId: p.exId,
    title: `${name} ${p.dose}`,
    protocol: p.protocol, dose: p.dose, freq: p.freq, source: `${p.source}${reason ? ` (${reason})` : ''}`,
    sets: p.sets, reps: p.reps, holdSeconds: p.holdSeconds, restSec: p.restSec, dayTag: p.dayTag,
    fixesPhase: [...(p.fixes || [])],
    ...(p.warmup ? { warmup: p.warmup } : {}),
  };
}

/**
 * D11 E2: CoC-лестница по уровню (ступени IronMind; правило 10–12).
 * Рабочий гриппер (5–7 в отказ) + целевой (негативы/частички/холды 3–5с).
 * Возвращает PoolEntry для ранжира (имена — из каталога в toCorrection).
 */
export function cocLadderFor(level: number | null | undefined): { workId: string; goalId: string | null } {
  const lv = Number(level);
  if (!Number.isFinite(lv) || lv < 0) return { workId: 'coc_trainer', goalId: 'coc_no1' };
  if (lv < 1) return { workId: 'coc_trainer', goalId: 'coc_no1' };
  if (lv < 1.5) return { workId: 'coc_no1', goalId: 'coc_no1_5' };
  if (lv < 2) return { workId: 'coc_no1_5', goalId: 'coc_no2' };
  if (lv < 2.5) return { workId: 'coc_no2', goalId: null };
  return { workId: 'coc_no2', goalId: null };
}

function cocLadderPool(level: number | null | undefined): PoolEntry[] {
  const { workId, goalId } = cocLadderFor(level);
  const pool: PoolEntry[] = [{
    exId: workId, protocol: 'Рабочий: 5–7 в отказ, 1–3 сета (здесь прогресс)', dose: '3×5–7',
    freq: '2–3×/нед', source: 'CoC-канон work', sets: 3, reps: [5, 7], restSec: 120,
    dayTag: 'CrushGrip', fixes: ['close_fail'],
    warmup: 'Разминка: гриппером легче 1×10–12 до жжения, не в отказ',
  }];
  if (goalId) {
    pool.push({
      exId: goalId, protocol: 'Целевой: негативы/частички/холд 3–5с (не закрывается — только так)', dose: '3×негатив',
      freq: '2×/нед', source: 'CoC-канон challenge (Kinney)', sets: 3, reps: [3, 3], restSec: 150,
      dayTag: 'CrushGrip', fixes: ['close_fail'],
      warmup: 'Только после рабочих сетов, свежим — не в конце убитой сессии',
    });
  } else {
    pool.push({
      exId: workId, protocol: 'Overcrush-холд в закрытом 6–10с (дожим)', dose: '4×холд',
      freq: '1×/нед', source: 'CoC overcrush', sets: 4, reps: [1, 1], holdSeconds: 8, restSec: 120,
      dayTag: 'CrushGrip', fixes: ['close_fail', 'hold_short'],
      warmup: 'Разминка: гриппером легче 1×10–12',
    });
  }
  pool.push({
    exId: 'silver_bullet_hold', protocol: 'Патрон в закрытом на время (финиш crush)', dose: '3×макс',
    freq: '2×/нед', source: 'IronMind Silver', sets: 3, reps: [1, 1], holdSeconds: 20, restSec: 120,
    dayTag: 'CrushGrip', fixes: ['hold_short', 'hold_long'],
  });
  return pool;
}

export function rankArmliftCorrections(
  weakLink: ArmliftWeakLink,
  implement?: string,
  ctx: ArmliftRankCtx = {},
): ArmliftCorrection[] {
  // Crush-снаряды чинятся crush-пулом независимо от звена (эспандер ≠ штанга).
  const impl = String(implement || '');
  let pool: PoolEntry[];
  // D11 E2: уровень CoC включает лесенку рабочий→целевой вместо общего пула.
  if ((impl === 'coc_gripper' || impl === 'silver_bullet') && ctx.cocLevel != null && Number.isFinite(Number(ctx.cocLevel))) {
    pool = cocLadderPool(Number(ctx.cocLevel));
  } else if (impl === 'coc_gripper' || impl === 'silver_bullet') pool = CRUSH;
  else pool = [...(BASE_POOL[weakLink] || BASE_POOL.fingers)];
  // D10 E3: дисбаланс — экстензор втягивается в любой пул (CTD: extensors во всех программах).
  if (ctx.extImbalance && !pool.some((p) => p.exId === 'wrist_ext_bb')) {
    pool = [...pool, {
      exId: 'wrist_ext_bb', protocol: 'Ладони вниз на жжение + Expand 2×15', dose: '3×15–25',
      freq: '3–4×/нед', source: 'Баланс flex/ext', sets: 3, reps: [15, 25], restSec: 60,
      dayTag: 'SupportGrip', fixes: ['mid'],
    }];
  }
  // Практика своим снарядом — первой, если звено/причина про технику (специфичность).
  const implEx = IMPLEMENT_TO_EX[impl];
  if (implEx && (weakLink === 'technique' || ctx.cause === 'technique')) {
    const found = pool.find((p) => p.exId === implEx);
    if (found) pool = [found, ...pool.filter((p) => p.exId !== implEx)];
    else {
      const cat = getArmExerciseById(implEx) as any;
      if (cat) {
        pool = [{
          exId: implEx, protocol: 'Opener 85% ×3 чисто по правилам вместо макса', dose: '3×1',
          freq: '1×/нед', source: 'LMS тактика', sets: 3, reps: [1, 1], restSec: 150,
          dayTag: /pinch|crush/i.test(String(cat.substitutionGroup || '')) ? 'PinchGrip' : 'SupportGrip',
        }, ...pool];
      }
    }
  }
  const inPlan = new Set((ctx.inPlanIds || []).map((s) => String(s).toLowerCase()));
  const scored = pool.map((p, idx) => {
    let score = 100 - idx * 4;
    const reasons: string[] = [];
    const cat = getArmExerciseById(p.exId) as any;
    if (!cat) { score -= 50; reasons.push('нет в каталоге'); }
    if (!equipmentOk(cat?.equipment, ctx.equipment)) { score -= 40; reasons.push('нет оборудования'); }
    if (inPlan.has(p.exId.toLowerCase())) { score -= 12; reasons.push('уже в плане'); }
    if (ctx.cause === 'fatigue' && (p.holdSeconds != null || /roller|ext/i.test(p.exId))) { score += 8; reasons.push('щадящая при усталости'); }
    if (ctx.cause === 'max_strength' && (p.sets >= 4 && p.reps[1] <= 5)) { score += 6; reasons.push('силовая'); }
    if (ctx.cause === 'mobility' && p.reps[0] >= 10) { score += 6; reasons.push('мобильная high-rep'); }
    if (ctx.cause === 'endurance' && (p.holdSeconds != null || /farmer|towel/i.test(p.exId))) { score += 6; reasons.push('под выносливость'); }
    if (ctx.asymPct != null && ctx.asymPct >= 7 && (cat?.equipment === 'dumbbell' || p.exId === 'wrist_curl_db')) { score += 5; reasons.push('унилатеральная'); }
    // D8: чинит фазу срыва — приоритет
    if (ctx.failurePoint && (p.fixes || []).includes(ctx.failurePoint)) { score += 6; reasons.push('чинит срыв'); }
    // D10 E3: дисбаланс — экстензоры первыми (Expand-протокол словами, id из каталога)
    if (ctx.extImbalance && /wrist_ext_bb|wrist_roller|reverse_ez_curl/.test(p.exId)) {
      score += 10; reasons.push('баланс: экстензия + Expand 2×15');
    }
    // PRO-6 M4: кривая различает пик и базу — длинные холды vs короткие пиковые vs объём без холдов
    if (ctx.holdCurve === 'endurance_gap' && p.holdSeconds != null && p.holdSeconds >= 15) { score += 6; reasons.push('под кривую: длинные холды'); }
    if (ctx.holdCurve === 'peak_gap' && p.holdSeconds != null && p.holdSeconds <= 12 && p.sets >= 3) { score += 6; reasons.push('под кривую: пик'); }
    if (ctx.holdCurve === 'both_low' && p.holdSeconds == null && p.reps[0] >= 3) { score += 6; reasons.push('под кривую: база объёмом'); }
    return { p, score, reason: reasons.join(', ') };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => toCorrection(s.p, s.reason, s.score));
}

export interface ArmliftSpecWeek {
  week: number;
  focus: string;
  target: string;
  volume: string;
  /** Упражнение → сетов на неделе (едет в мост). */
  targetSets: Record<string, number>;
  /** Упражнение → сессия плана (едет в мост). */
  dayMap: Record<string, string>;
}

/** Спец-блок 4 нед (волна base→объём→интенс→делод) или 6 нед (base×3 + интенс + пик + делод). */
export function buildArmliftSpecBlock(
  weakLink: ArmliftWeakLink,
  implement: string,
  corrections?: ArmliftCorrection[],
  weeks: 4 | 6 = 4,
  opts: { fatigueFirst?: boolean } = {},
): ArmliftSpecWeek[] {
  const top = (corrections && corrections.length ? corrections : rankArmliftCorrections(weakLink, implement)).slice(0, 2);
  const impl = String(implement || 'rolling_thunder');
  const n = weeks === 6 ? 6 : 4;
  let mult = n === 6 ? [1, 1.05, 1, 0.9, 0.85, 0.5] : [1, 1, 0.85, 0.5];
  let sess = n === 6
    ? ['3 сессии', '3 сессии', '3 сессии', '2 сессии', '2 сессии', '2 лёгкие']
    : ['3 сессии', '3 сессии', '2 сессии', '2 лёгкие'];
  let notes = n === 6
    ? ['База 100%', 'Объём +5%', 'Объём 100%', 'Интенс: вес ↑', 'Пик: вес ↑↑, объём 85%', 'Делод 50% + тест точки срыва']
    : ['База 100%', 'Объём +5–10%', 'Интенс: вес ↑, объём 85%', 'Делод 50% + тест точки срыва'];
  if (opts.fatigueFirst && n === 4) { mult = [0.5, 1, 1, 0.85]; sess = ['2 лёгкие', '3 сессии', '3 сессии', '2 сессии']; notes = ['Делод 50% (сброс усталости)', 'База 100%', 'Объём +5–10%', 'Интенс: вес ↑, объём 85%']; }
  if (opts.fatigueFirst && n === 6) { mult = [0.5, 1, 1.05, 1, 0.9, 0.85]; sess = ['2 лёгкие', '3 сессии', '3 сессии', '3 сессии', '2 сессии', '2 сессии']; notes = ['Делод 50% (сброс усталости)', 'База 100%', 'Объём +5%', 'Объём 100%', 'Интенс: вес ↑', 'Пик: вес ↑↑, объём 85%']; }
  return Array.from({ length: n }, (_, k) => {
    const targetSets: Record<string, number> = {};
    const dayMap: Record<string, string> = {};
    for (const c of top) {
      targetSets[c.exId] = Math.max(1, Math.round(c.sets * mult[k]));
      dayMap[c.exId] = c.dayTag;
    }
    const last = k === n - 1;
    const firstFatigue = opts.fatigueFirst && k === 0;
    return {
      week: k + 1,
      focus: firstFatigue ? 'Делод 50% (сброс усталости)' : k === 0 ? `База: ${top[0]?.title || '—'}` : last ? 'Делод хвату + тест' : `${top[0]?.title || '—'} · ${notes[k]}`,
      target: impl, volume: `${sess[k]} · ${notes[k]}`,
      targetSets, dayMap,
    };
  });
}
