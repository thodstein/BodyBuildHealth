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
  /** PRO-CORR K1: кью техники (показ в табе, едет в экспорт строкой). */
  cues?: string[];
  /** PRO-CORR K1: прогрессия нагрузки (строкой, без новой математики). */
  progression?: string;
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
  /** PRO-CORR K2: уровень атлета — advanced-снаряды новичку не предлагать. */
  level?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  /** PRO-CORR K2: только щадящие (боль — стоп-нагрузка, хаб ставит при cause pain). */
  gentleOnly?: boolean;
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
  /** PRO-CORR K1: причины, под которые упражнение подходит (матрица ранжира). */
  causes?: ArmliftCause[];
  /** PRO-CORR K1: минимальный уровень (зеркалит difficulty каталога). */
  minLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** PRO-CORR K1: фаза работы — техника/сила/стабильность. */
  phase?: 'technique' | 'strength' | 'stability';
  /** PRO-CORR K1: кью техники. */
  cues?: string[];
  /** PRO-CORR K1: прогрессия строкой. */
  progression?: string;
  /** PRO-CORR K2: запасное оборудование (фолбэк без grip_tool). */
  equipmentAlt?: string[];
  /** PRO-CORR K2: щадящее (можно при боли/усталости). */
  gentle?: boolean;
}

/** D8: пул чинит свои фазы; без явного — фазы пула по умолчанию. */
const withFixes = (pool: PoolEntry[], fixes: string[]): PoolEntry[] =>
  pool.map((p) => ({ ...p, fixes: p.fixes ?? fixes }));

const SUPPORT_MAX: PoolEntry[] = [
  { exId: 'rolling_thunder', protocol: 'Тяжёлые тройки DOH + холд 10с на последнем подходе', dose: '5×3', freq: '2×/нед', source: 'SBS DOH holds', sets: 5, reps: [3, 3], holdSeconds: 10, restSec: 180, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + лёгкие сжимания 1×10–12 до жжения, не в отказ', causes: ['max_strength', 'technique'], minLevel: 'advanced', phase: 'strength', cues: ['Центр ручки', 'Параллель', '1с локаут'], progression: '+2.5–5%/нед к топ-синглу', equipmentAlt: ['barbell', 'dumbbell', 'bodyweight'] },
  { exId: 'apollon_axle', protocol: 'Все разминки двойным пронированным, лямки только на максе', dose: 'до 85% 1ПМ', freq: 'каждая тяга', source: 'AUSA Beginners', sets: 4, reps: [3, 5], restSec: 180, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + 1×10–12 лёгким гриппером', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['DOH', 'Без лямок', 'Не класть на бедро'], progression: '+2.5%/нед', equipmentAlt: ['barbell', 'dumbbell'] },
  { exId: 'fat_bar_deadlift', protocol: '50мм гриф DOH, без лямок/разнохвата', dose: '4×5', freq: '1–2×/нед', source: 'NSCA thick bar', sets: 4, reps: [5, 5], restSec: 150, dayTag: 'SupportGrip', warmup: 'Разминка: DOH без лямок на лёгком, кисть нейтрально', causes: ['max_strength', 'volume'], minLevel: 'intermediate', phase: 'strength', cues: ['DOH 50мм', 'Без разнохвата'], progression: '+2.5%/нед' },
  { exId: 'inch_dumbbell', protocol: '78кг одной рукой, контроль 1с вверху', dose: '3×1', freq: '1×/нед', source: 'Inch-классика', sets: 3, reps: [1, 1], holdSeconds: 3, restSec: 180, dayTag: 'GripHeavy', warmup: 'Разминка: сжимания + раскрытия 2×10', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['Одна рука', 'Контроль 1с вверху'], progression: 'Синглы к топу, шаг +1–2кг' },
  { exId: 'wrist_wrench_60', protocol: 'Вращающаяся 60мм как RT, лёгкий вес на технику', dose: '3×5', freq: '1×/нед', source: 'RT-перенос', sets: 3, reps: [5, 5], restSec: 120, dayTag: 'SupportGrip', fixes: ['mid', 'hold_short'], warmup: 'Разминка: круги + лёгкий гриппер 1×10', causes: ['technique', 'endurance'], minLevel: 'intermediate', phase: 'technique', cues: ['Лёгкий вес', 'Техника вращения'], progression: 'Сначала чисто, потом вес', equipmentAlt: ['dumbbell'] },
  { exId: 'raptor_3', protocol: 'Толстый 3″ DOH, тяжёлые тройки без лямок', dose: '4×3', freq: '1×/нед', source: 'ArmliftingUSA Raptor', sets: 4, reps: [3, 3], restSec: 180, dayTag: 'SupportGrip', fixes: ['off_floor', 'mid'], warmup: 'Разминка: круги + Fat Gripz 1×12', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['DOH толстый', 'Без лямок'], progression: '+2.5%/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'grandfather_clock', protocol: 'Вертикальная труба DOH, тяга без вращения', dose: '4×3', freq: '1×/нед', source: 'ArmliftingUSA Clock', sets: 4, reps: [3, 3], restSec: 180, dayTag: 'SupportGrip', fixes: ['mid', 'lockout'], warmup: 'Разминка: круги + лёгкие сжимания 1×12', causes: ['max_strength', 'endurance'], minLevel: 'advanced', phase: 'strength', cues: ['Вертикаль', 'Без вращения'], progression: '+2.5%/нед', equipmentAlt: ['barbell', 'dumbbell'] },
  { exId: 'flask_1h', protocol: 'Одной рукой вращающаяся, синглы к топу', dose: '5×1', freq: '1×/нед', source: 'ArmliftingUSA Flask', sets: 5, reps: [1, 1], restSec: 180, dayTag: 'GripHeavy', fixes: ['off_floor', 'mid'], warmup: 'Разминка: сжимания + раскрытия 2×10', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['Одна рука', 'Вращающаяся'], progression: 'Синглы, шаг +1кг' },
  { exId: 'napalm_handle_60', protocol: '60мм rolling, техника + холды 10с', dose: '3×5 + холд', freq: '1–2×/нед', source: 'Napalm-практика', sets: 3, reps: [5, 5], holdSeconds: 10, restSec: 150, dayTag: 'SupportGrip', fixes: ['mid', 'hold_short'], warmup: 'Разминка: круги + лёгкий гриппер 1×10', causes: ['technique', 'endurance'], minLevel: 'intermediate', phase: 'technique', cues: ['60мм', 'Техника прежде веса'], progression: 'Сначала чисто 3×5, потом вес', equipmentAlt: ['dumbbell'] },
];

const PINCH: PoolEntry[] = [
  { exId: 'plate_pinch_hold', protocol: '2 плиты гладкими наружу, удержание до отказа формы', dose: '3×20–30с', freq: '2–3×/нед', source: 'NSCA plate pinch', sets: 3, reps: [1, 1], holdSeconds: 25, restSec: 120, dayTag: 'PinchGrip', fixes: ['hold_short', 'hold_long', 'off_floor'], warmup: 'Разминка: пальцы — круги + лёгкий экстензор 1×15', causes: ['endurance', 'volume'], minLevel: 'intermediate', phase: 'stability', cues: ['Гладкими наружу', 'До отказа формы'], progression: '+5–10с холда/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'hub_pinch', protocol: '5 подушечек на базе, без «дверной ручки»', dose: '3×5', freq: '2×/нед', source: 'IronMind Hub', sets: 3, reps: [5, 5], holdSeconds: 3, restSec: 120, dayTag: 'PinchGrip', fixes: ['off_floor', 'hold_short'], warmup: 'Разминка: круги запястий + 1×10 лёгким щипком', causes: ['max_strength', 'technique'], minLevel: 'intermediate', phase: 'technique', cues: ['5 подушечек', 'Без ручки-дверцы'], progression: '+1–2.5кг/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'pinch_block_80', protocol: 'Деревянный блок 80мм двумя руками, тяга', dose: '5×3', freq: '2×/нед', source: 'Pinch-практика', sets: 5, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: мел + 1×10–12 лёгким блоком', causes: ['max_strength'], minLevel: 'intermediate', phase: 'strength', cues: ['Мел', 'Тяга без рывка'], progression: '+2.5%/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'saxon_bar', protocol: 'Прямоугольник 3″ щипком двумя руками', dose: '4×3', freq: '1–2×/нед', source: 'Saxon-практика', sets: 4, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: пальцы тщательно прогреть — 1×10–12 лёгким щипком', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['Прямоугольник 3″', 'Щипок двумя руками'], progression: '+2.5%/нед' },
  { exId: 'country_crush_2', protocol: '2″ блок щипком двумя руками', dose: '3×3', freq: '1×/нед', source: 'AUSA Crush', sets: 3, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', warmup: 'Разминка: круги + лёгкий щипок 1×10', causes: ['endurance', 'max_strength'], minLevel: 'intermediate', phase: 'stability', cues: ['2″ блок', 'DOH двумя руками'], progression: '+1–2.5кг/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'anvil_hub', protocol: 'Наковальня щипком, hub-вариант', dose: '3×5', freq: '1×/нед', source: 'Anvil-практика', sets: 3, reps: [5, 5], holdSeconds: 3, restSec: 120, dayTag: 'PinchGrip', warmup: 'Разминка: круги запястий + 1×10 лёгкой наковальней', causes: ['technique'], minLevel: 'intermediate', phase: 'technique', cues: ['Щипок', 'Hub-вариант'], progression: '+1кг/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'euro_pinch_2h', protocol: 'Две руки щипок евро-пластин, тяжёлые тройки', dose: '4×3', freq: '2×/нед', source: 'Euro Pinch-практика', sets: 4, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', fixes: ['off_floor', 'hold_short'], warmup: 'Разминка: мел + 1×10–12 лёгким щипком', causes: ['max_strength'], minLevel: 'intermediate', phase: 'strength', cues: ['Две руки', 'Евро-пластины'], progression: '+2.5%/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'blockbuster_pinch', protocol: 'Блок 2 3/8″ щипком, техника + холд 5с', dose: '3×5', freq: '2×/нед', source: 'GripSport Blockbuster', sets: 3, reps: [5, 5], holdSeconds: 5, restSec: 120, dayTag: 'PinchGrip', fixes: ['hold_short', 'hold_long'], warmup: 'Разминка: круги + 1×10 лёгким щипком', causes: ['technique', 'endurance'], minLevel: 'intermediate', phase: 'technique', cues: ['Блок 2 3/8″', 'Холд 5с'], progression: 'Сначала чисто, потом вес', equipmentAlt: ['dumbbell'] },
  { exId: 'country_crush_3', protocol: '3″ блок широким щипком, тяжёлые тройки', dose: '4×3', freq: '1×/нед', source: 'ArmliftingUSA Monster', sets: 4, reps: [3, 3], restSec: 150, dayTag: 'PinchGrip', fixes: ['off_floor', 'hold_short'], warmup: 'Разминка: тщательный прогрев пальцев 1×10–12', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['3″ блок', 'Широкий щипок'], progression: '+1–2.5кг/нед' },
  { exId: 'little_big_horn', protocol: 'Конус 76→50мм щипком, удержание', dose: '3×холд 10с', freq: '1–2×/нед', source: 'Horn-практика', sets: 3, reps: [1, 1], holdSeconds: 10, restSec: 120, dayTag: 'PinchGrip', fixes: ['hold_short', 'hold_long'], warmup: 'Разминка: круги + лёгкий щипок 1×10', causes: ['technique', 'endurance'], minLevel: 'advanced', phase: 'technique', cues: ['Конус', 'Удержание без сползания'], progression: '+5с холда/нед' },
  { exId: 'finger_containment_band', protocol: 'Резина вокруг пальцев — не распахивать, держать свод', dose: '3×15', freq: '2–3×/нед', source: 'Containment-практика', sets: 3, reps: [12, 15], restSec: 60, dayTag: 'PinchGrip', fixes: ['hold_short', 'mid'], warmup: 'Без разминки — активация', causes: ['technique', 'mobility'], minLevel: 'beginner', phase: 'technique', cues: ['Не распахивать пальцы', 'Держать свод'], progression: 'Туже резина → дольше', equipmentAlt: ['band'], gentle: true },
];

const CRUSH: PoolEntry[] = [
  { exId: 'coc_trainer', protocol: 'Warm: 10–12 лёгко, без отказа', dose: '1×12', freq: '2–3×/нед', source: 'CoC FAQ warm', sets: 1, reps: [10, 12], restSec: 60, dayTag: 'CrushGrip', causes: ['technique', 'volume'], minLevel: 'beginner', phase: 'technique', cues: ['Легко', 'Без отказа', 'Полная амплитуда'], progression: '10–12 чисто → следующий гриппер', gentle: true },
  { exId: 'coc_no1', protocol: 'Work: 5–7 до отказа, 1–3 сета', dose: '3×5–7', freq: '2–3×/нед', source: 'CoC FAQ work', sets: 3, reps: [5, 7], restSec: 90, dayTag: 'CrushGrip', causes: ['max_strength'], minLevel: 'intermediate', phase: 'strength', cues: ['5–7 до отказа', 'Пауза между сетами полная'], progression: '10–12 повторов → следующий уровень' },
  { exId: 'coc_gripper', protocol: 'Work + challenge: частички/негативы после отказа', dose: '3×5 + негативы', freq: '2×/нед', source: 'CoC FAQ challenge', sets: 3, reps: [5, 5], restSec: 120, dayTag: 'CrushGrip', fixes: ['close_fail', 'hold_short'], causes: ['max_strength'], minLevel: 'intermediate', phase: 'strength', cues: ['Работа до отказа', 'Негативы после'], progression: 'Частички → негативы → холд 3–5с' },
  { exId: 'silver_bullet_hold', protocol: 'Удержание патрона в закрытом гриппере на время', dose: '3×макс', freq: '2×/нед', source: 'IronMind Silver', sets: 3, reps: [1, 1], holdSeconds: 20, restSec: 120, dayTag: 'CrushGrip', fixes: ['hold_short', 'hold_long'], causes: ['endurance'], minLevel: 'intermediate', phase: 'stability', cues: ['Вертикаль', 'Патрон не ронять'], progression: '+5с/нед' },
  { exId: 'coc_no1_5', protocol: 'Work: 5–7 до отказа — мостик к №2', dose: '3×5–7', freq: '2–3×/нед', source: 'CoC-канон work (1.5)', sets: 3, reps: [5, 7], restSec: 120, dayTag: 'CrushGrip', fixes: ['close_fail'], warmup: 'Разминка: гриппером легче 1×10–12', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['Мостик к №2', 'До отказа'], progression: '10–12 → пробовать №2' },
  { exId: 'coc_no2', protocol: 'Work: 3–5 до отказа — соревновательный уровень', dose: '3×3–5', freq: '2×/нед', source: 'CoC-канон work (№2)', sets: 3, reps: [3, 5], restSec: 150, dayTag: 'CrushGrip', fixes: ['close_fail'], warmup: 'Разминка: лесенка 2–3 гриппера вверх', causes: ['max_strength'], minLevel: 'advanced', phase: 'strength', cues: ['Низкие повторы', 'Высокое усилие'], progression: 'Тройки → пятёрки → №2.5' },
];

const ENDURANCE: PoolEntry[] = [
  { exId: 'farmer_walk_fat', protocol: '50–80% веса тела в руку, отказ хвата на 40–45с', dose: '3×20–40м', freq: '2×/нед', source: 'NSCA carries', sets: 3, reps: [20, 40], restSec: 120, dayTag: 'SupportGrip', fixes: ['hold_long', 'mid'], warmup: 'Разминка: круги + лёгкие сжимания 2×15@30–40%', causes: ['endurance', 'volume'], minLevel: 'intermediate', phase: 'stability', cues: ['Отказ 40–45с', 'Корпус прямо'], progression: '+5м или +2.5кг/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'towel_pullup', protocol: 'Полотенце через перекладину, DOH, без лямок', dose: '3×8', freq: '1–2×/нед', source: 'NSCA towel', sets: 3, reps: [6, 8], restSec: 120, dayTag: 'SupportGrip', fixes: ['mid', 'hold_long'], warmup: 'Разминка: вис лёгкий + круги 1 мин', causes: ['endurance', 'volume'], minLevel: 'intermediate', phase: 'stability', cues: ['DOH', 'Без лямок'], progression: '+1–2 повтора/нед', equipmentAlt: ['bodyweight'] },
  { exId: 'fat_gripz_curl', protocol: 'Любые сгибания с накладками 50мм', dose: '3×10', freq: '1–2×/нед', source: 'AUSA Fat Gripz', sets: 3, reps: [8, 12], restSec: 90, dayTag: 'SupportGrip', fixes: ['mid', 'hold_short'], warmup: 'Разминка: лёгкие сжимания 1×15', causes: ['volume', 'technique'], minLevel: 'beginner', phase: 'technique', cues: ['Накладки 50мм', 'Строго'], progression: '+1–2 повтора/нед', equipmentAlt: ['dumbbell'] },
  { exId: 'indian_clubs', protocol: 'Лёгкие булавы 5 lbs, high-rep на кровоток', dose: '2×20', freq: '2–3×/нед', source: 'Indian clubs balance', sets: 2, reps: [15, 20], restSec: 60, dayTag: 'SupportGrip', fixes: ['hold_long'], warmup: 'Без разминки — восстановление', causes: ['mobility', 'fatigue'], minLevel: 'beginner', phase: 'stability', cues: ['Легко', 'Кровоток, не отказ'], progression: 'Дольше без усталости', equipmentAlt: ['dumbbell'], gentle: true },
];

const WRIST_EXT: PoolEntry[] = [
  { exId: 'wrist_ext_bb', protocol: 'Ладони вниз, разгибание к себе на жжение', dose: '3×15–25', freq: '3–4×/нед', source: 'Баланс flex/ext', sets: 3, reps: [15, 25], restSec: 60, dayTag: 'SupportGrip', warmup: 'Разминка: круги запястий + лёгкий экстензор 1×15', causes: ['mobility', 'fatigue'], minLevel: 'beginner', phase: 'stability', cues: ['Ладони вниз', 'На жжение, не в отказ'], progression: '+2–3 повтора/нед', equipmentAlt: ['dumbbell', 'band'], gentle: true },
  { exId: 'wrist_roller', protocol: 'Вверх-вниз без провала запястья в сгиб (на время 60с — тоже зачёт)', dose: '3 подъёма', freq: '2×/нед', source: 'Gripnatic roller', sets: 3, reps: [1, 3], restSec: 90, dayTag: 'SupportGrip', warmup: 'Разминка: круги + лёгкий валик', causes: ['mobility'], minLevel: 'beginner', phase: 'stability', cues: ['Без провала в сгиб'], progression: 'Тяжелее валик или дольше', equipmentAlt: ['cable'], gentle: true },
  { exId: 'reverse_ez_curl', protocol: 'Пронированный хват, строго — двойной эффект на экстензоры', dose: '3×12', freq: '2×/нед', source: 'NSCA ext balance', sets: 3, reps: [10, 12], restSec: 90, dayTag: 'SupportGrip', warmup: 'Разминка: круги + лёгкий прямой гриф', causes: ['max_strength'], minLevel: 'intermediate', phase: 'strength', cues: ['Пронация', 'Строго без читинга'], progression: '+1–2.5кг/нед', equipmentAlt: ['dumbbell', 'cable'] },
  { exId: 'lever_top', protocol: 'Удержание рычага горизонтально 10–15с (контроль, incl. девиации)', dose: '3×холд', freq: '2×/нед', source: 'Sledge levering', sets: 3, reps: [1, 1], holdSeconds: 12, restSec: 90, dayTag: 'SupportGrip', fixes: ['mid', 'lockout'], warmup: 'Разминка: круги запястий 2 мин', causes: ['max_strength', 'technique'], minLevel: 'intermediate', phase: 'strength', cues: ['Горизонталь', 'Контроль девиаций'], progression: '+2–3с холда/нед' },
  { exId: 'finger_containment_band', protocol: 'Резина вокруг пальцев — держать свод, не распахивать', dose: '3×15', freq: '3×/нед', source: 'Containment-практика', sets: 3, reps: [12, 15], restSec: 60, dayTag: 'SupportGrip', fixes: ['mid'], warmup: 'Без разминки — активация', causes: ['mobility', 'fatigue', 'technique'], minLevel: 'beginner', phase: 'technique', cues: ['Держать свод', 'Не распахивать'], progression: 'Туже резина', equipmentAlt: ['band'], gentle: true },
  { exId: 'sledge_choke', protocol: 'Кувалда хватом у конца, удержание горизонтально', dose: '3×15с', freq: '2×/нед', source: 'GripTopz choke', sets: 3, reps: [1, 1], holdSeconds: 15, restSec: 90, dayTag: 'SupportGrip', fixes: ['lockout', 'mid'], warmup: 'Разминка: круги 1 мин', causes: ['technique'], minLevel: 'intermediate', phase: 'stability', cues: ['Хват у конца', 'Горизонталь'], progression: 'Дальше хват или дольше', equipmentAlt: ['dumbbell'] },
  { exId: 'ulnar_dev', protocol: 'Гантель вдоль тела, кисть к мизинцу — стабильность запястья', dose: '3×12', freq: '2×/нед', source: 'Ulnar-стабильность', sets: 3, reps: [10, 12], restSec: 60, dayTag: 'SupportGrip', fixes: ['lockout'], warmup: 'Разминка: круги запястий', causes: ['mobility'], minLevel: 'beginner', phase: 'stability', cues: ['К мизинцу', 'Строго'], progression: '+1кг/нед', equipmentAlt: ['dumbbell'], gentle: true },
  { exId: 'radial_dev', protocol: 'Кисть к большому пальцу — стабильность запястья', dose: '3×12', freq: '2×/нед', source: 'Radial-стабильность', sets: 3, reps: [10, 12], restSec: 60, dayTag: 'SupportGrip', fixes: ['lockout'], warmup: 'Разминка: круги запястий', causes: ['mobility'], minLevel: 'beginner', phase: 'stability', cues: ['К большому', 'Строго'], progression: '+1кг/нед', equipmentAlt: ['dumbbell'], gentle: true },
  { exId: 'wrist_curl_db', protocol: 'Одной рукой с гантелью — унилатеральная база сгибателей', dose: '3×12', freq: '2×/нед', source: 'Односторонний cup', sets: 3, reps: [10, 12], restSec: 60, dayTag: 'SupportGrip', fixes: ['mid'], warmup: 'Разминка: круги + лёгкий вес 1×15', causes: ['volume'], minLevel: 'beginner', phase: 'stability', cues: ['Одной рукой', 'Слабая первой'], progression: '+1кг/нед', equipmentAlt: ['dumbbell'] },
];

/**
 * PRO-CORR K1: уникальные id пула (для lock-теста ширины библиотеки).
 * Лесенка CoC строится динамически — её id не входят (work/goal из каталога).
 */
export function armliftCorrectionPoolIds(): string[] {
  const ids = new Set<string>();
  for (const pool of Object.values(BASE_POOL)) {
    for (const p of pool) ids.add(p.exId);
  }
  return [...ids];
}

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

/** PRO-CORR K3: добрать запись пула по id (расширение малых пулов без смены дефолтного топ-3). */
function poolById(pool: PoolEntry[], exId: string): PoolEntry {
  const found = pool.find((p) => p.exId === exId);
  if (!found) throw new Error(`armlift-correction: pool miss ${exId}`);
  return found;
}

const BASE_POOL: Record<ArmliftWeakLink, PoolEntry[]> = {
  thumb: withFixes(PINCH, ['off_floor', 'hold_short', 'hold_long']),
  fingers: withFixes(SUPPORT_MAX, ['off_floor', 'mid', 'lockout', 'close_fail']),
  wrist_ext: withFixes(WRIST_EXT, ['mid', 'lockout', 'hold_short']),
  support_endurance: withFixes(ENDURANCE, ['hold_long', 'hold_short', 'mid']),
  crush: withFixes(CRUSH, ['close_fail', 'hold_short', 'hold_long']),
  // PRO-CORR K3: technique/asymmetry добиты до 6 записей дешёвым стартом (дефолтный топ-3 цел —
  // новички идут первыми тремя базовыми, advanced-первые вытесняются гейтом уровня).
  technique: [...SUPPORT_MAX.slice(0, 1), ...PINCH.slice(0, 1), ...ENDURANCE.slice(0, 1),
    poolById(ENDURANCE, 'fat_gripz_curl'), poolById(SUPPORT_MAX, 'napalm_handle_60'), poolById(PINCH, 'finger_containment_band')],
  asymmetry: [...PINCH.slice(0, 1), ...SUPPORT_MAX.slice(0, 1), ...WRIST_EXT.slice(0, 1),
    poolById(WRIST_EXT, 'wrist_curl_db'), poolById(PINCH, 'finger_containment_band'), poolById(ENDURANCE, 'indian_clubs')],
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

/** PRO-CORR K2: ранг уровня (зеркалит difficulty каталога). */
const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, elite: 3 };

function entryMinLevel(p: PoolEntry, cat: any): 'beginner' | 'intermediate' | 'advanced' {
  if (p.minLevel) return p.minLevel;
  const d = String(cat?.difficulty || 'beginner').toLowerCase();
  if (d === 'advanced' || d === 'elite' || d === 'enhanced') return 'advanced';
  if (d === 'intermediate') return 'intermediate';
  return 'beginner';
}

function altEquipmentOk(p: PoolEntry, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0 || !p.equipmentAlt || !p.equipmentAlt.length) return false;
  return p.equipmentAlt.some((alt) =>
    allowed.some((a) => {
      const al = String(a).toLowerCase();
      const t = String(alt).toLowerCase();
      return t.includes(al) || al.includes(t);
    }),
  );
}

const CAUSE_RU: Record<string, string> = {
  technique: 'техника',
  max_strength: 'сила',
  endurance: 'выносливость',
  volume: 'объём',
  mobility: 'мобильность',
  fatigue: 'щадящая',
};

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
    ...((p.cues && p.cues.length) ? { cues: [...p.cues] } : {}),
    ...(p.progression ? { progression: p.progression } : {}),
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
    causes: ['max_strength'], phase: 'strength',
    cues: ['5–7 до отказа', 'Полная пауза между сетами'], progression: '10–12 повторов → следующий уровень',
  }];
  if (goalId) {
    pool.push({
      exId: goalId, protocol: 'Целевой: негативы/частички/холд 3–5с (не закрывается — только так)', dose: '3×негатив',
      freq: '2×/нед', source: 'CoC-канон challenge (Kinney)', sets: 3, reps: [3, 3], restSec: 150,
      dayTag: 'CrushGrip', fixes: ['close_fail'],
      warmup: 'Только после рабочих сетов, свежим — не в конце убитой сессии',
      causes: ['max_strength'], phase: 'strength',
      cues: ['Только свежим', 'После рабочих сетов'], progression: 'Частички → негативы → холд 3–5с',
    });
  } else {
    pool.push({
      exId: workId, protocol: 'Overcrush-холд в закрытом 6–10с (дожим)', dose: '4×холд',
      freq: '1×/нед', source: 'CoC overcrush', sets: 4, reps: [1, 1], holdSeconds: 8, restSec: 120,
      dayTag: 'CrushGrip', fixes: ['close_fail', 'hold_short'],
      warmup: 'Разминка: гриппером легче 1×10–12',
      causes: ['max_strength'], minLevel: 'advanced', phase: 'strength',
      cues: ['Дожим 6–10с', 'Раз в неделю'], progression: 'Дольше холд → следующий гриппер',
    });
  }
  pool.push({
    exId: 'silver_bullet_hold', protocol: 'Патрон в закрытом на время (финиш crush)', dose: '3×макс',
    freq: '2×/нед', source: 'IronMind Silver', sets: 3, reps: [1, 1], holdSeconds: 20, restSec: 120,
    dayTag: 'CrushGrip', fixes: ['hold_short', 'hold_long'],
    causes: ['endurance'], phase: 'stability',
    cues: ['Вертикаль', 'Патрон не ронять'], progression: '+5с/нед',
  });
  return pool;
}

export function rankArmliftCorrections(
  weakLink: ArmliftWeakLink,
  implement?: string,
  ctx: ArmliftRankCtx = {},
  limit = 3,
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
      causes: ['mobility', 'fatigue'], minLevel: 'beginner', phase: 'stability',
      cues: ['Ладони вниз', 'На жжение, не в отказ'], progression: '+2–3 повтора/нед',
      equipmentAlt: ['dumbbell', 'band'], gentle: true,
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
  // PRO-CORR K2: при боли — только щадящие (стоп-нагрузка, не чиним через нагрузку).
  // Если в пуле звена щадящих нет — откат на rehab-пул conditioning (экстензия/валик/50% щипок).
  if (ctx.gentleOnly) {
    const gentle = pool.filter((p) => p.gentle);
    pool = gentle.length ? gentle : [...BASE_POOL.conditioning];
  }
  // PRO-CORR K2: гейт уровня — advanced-снаряды из топа новичка исключаются.
  // Допуск в одну ступень: intermediate доступен новичку в лёгком весе (AUSA: Fat Gripz/толстый гриф —
  // дешёвый старт), advanced — нет. Фолбэк: если подходящих < 3 — пул цел (топ-3 всегда полон).
  if (ctx.level != null && LEVEL_RANK[ctx.level] != null) {
    const fit = pool.filter((p) => {
      const cat = getArmExerciseById(p.exId) as any;
      return (LEVEL_RANK[entryMinLevel(p, cat)] ?? 0) <= (LEVEL_RANK[ctx.level!] ?? 0) + 1;
    });
    if (fit.length >= 3) pool = fit;
  }
  const inPlan = new Set((ctx.inPlanIds || []).map((s) => String(s).toLowerCase()));
  const scored = pool.map((p, idx) => {
    let score = 100 - idx * 4;
    const reasons: string[] = [];
    const cat = getArmExerciseById(p.exId) as any;
    if (!cat) { score -= 50; reasons.push('нет в каталоге'); }
    if (!equipmentOk(cat?.equipment, ctx.equipment)) {
      if (altEquipmentOk(p, ctx.equipment)) { score -= 5; reasons.push('замена оборудованием'); }
      else { score -= 40; reasons.push('нет оборудования'); }
    }
    if (inPlan.has(p.exId.toLowerCase())) { score -= 12; reasons.push('уже в плане'); }
    // PRO-CORR K2: матрица причина × упражнение (каждая запись знает свои causes).
    if (ctx.cause && p.causes && p.causes.includes(ctx.cause)) {
      score += 10; reasons.push(`под причину: ${CAUSE_RU[ctx.cause] || ctx.cause}`);
    }
    // PRO-CORR K2: гейт уровня — advanced-снаряды новичку не предлагать.
    if (ctx.level) {
      const need = entryMinLevel(p, cat);
      if ((LEVEL_RANK[need] ?? 0) > (LEVEL_RANK[ctx.level] ?? 0)) {
        score -= 30; reasons.push('сложно для уровня');
      }
    }
    // PRO-CORR K2: усталость/мобильность — щадящие вверх, тяжёлые вниз.
    if (ctx.cause === 'fatigue' || ctx.cause === 'mobility') {
      if (p.gentle) { score += 8; reasons.push('щадящая при восстановлении'); }
      else if (p.sets >= 5 || entryMinLevel(p, cat) === 'advanced') { score -= 8; reasons.push('тяжело при усталости'); }
    }
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
  const n = Math.max(1, Math.min(6, Math.round(limit) || 3));
  return scored.slice(0, n).map((s) => toCorrection(s.p, s.reason, s.score));
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
  /** PRO-CORR K4: деталь волны — кью + прогрессия + ротация (в мост не едет, только показ). */
  detail?: string;
}

/** PRO-CORR K4: подсказка волны под снаряд (ротация щипка / CoC-лесенка / support-тройки). */
function specWaveHint(implement: string): string {
  const impl = String(implement || '');
  if (impl === 'coc_gripper' || impl === 'silver_bullet') return 'CoC: разминка→рабочие→целевой (негативы/холд 3–5с)';
  if (['saxon_bar', 'hub', 'pinch_block', 'anvil', 'country_crush', 'grandfather_clock'].includes(impl)) {
    return 'Щипок: широкий→узкий по мере отказа (Saxon→Hub)';
  }
  return 'Тяжёлые тройки + холд 10с на последнем';
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
  const waveHint = specWaveHint(impl);
  const topCues = top.flatMap((c) => c.cues || []).slice(0, 3);
  const topProg = top.map((c) => c.progression).find(Boolean) || '';
  return Array.from({ length: n }, (_, k) => {
    const targetSets: Record<string, number> = {};
    const dayMap: Record<string, string> = {};
    for (const c of top) {
      targetSets[c.exId] = Math.max(1, Math.round(c.sets * mult[k]));
      dayMap[c.exId] = c.dayTag;
    }
    const last = k === n - 1;
    const firstFatigue = opts.fatigueFirst && k === 0;
    const detailBits = [waveHint];
    if (topCues.length) detailBits.push(`Кью: ${topCues.join(' · ')}`);
    if (topProg) detailBits.push(`Прогрессия: ${topProg}`);
    return {
      week: k + 1,
      focus: firstFatigue ? 'Делод 50% (сброс усталости)' : k === 0 ? `База: ${top[0]?.title || '—'}` : last ? 'Делод хвату + тест' : `${top[0]?.title || '—'} · ${notes[k]}`,
      target: impl, volume: `${sess[k]} · ${notes[k]}`,
      targetSets, dayMap,
      detail: detailBits.join(' · '),
    };
  });
}
