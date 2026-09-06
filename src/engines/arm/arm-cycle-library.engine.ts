/**
 * arm-cycle-library.engine.ts — библиотека именных циклов армрестлинг/армлифтинг.
 *
 * Источники: StrengthLog 8-week (RPE 7-8 → 8-9, 4д/нед + стол 1×),
 * GripStrength 12-week Table-Ready (2× → 3×, W12 −40%), Grinder periodization
 * (prep/strength/power/peaking/recovery), Donatif advanced 6-8н (4-5 сессий),
 * Toproll 6-week (adaptation/breakdown/power, тейпер −10/−30), СРЦ №4 верховик
 * II-КМС (12 микроциклов, %корректировки 0.5), Кузница/Антонов (6н 3× + 8н 4×),
 * Доброрезов 12-мес (12+12+8+12), IronMind CoC (warm/work/challenge),
 * GripStrength CoC 8/12, Grinder hybrid 12, Brzenk 1+1, Larratt table+bloodflow.
 * R9: KTA singles (Kinney/Horne, 6д/нед, объём синглов 40→80, пик через день),
 * Schoolboy PULL/PUSH (Beziazykov 2025, пирамиды 8-6-4-2-1, стол Вс),
 * Ivakin ARM/HAND 4× (эталон топролла: руки Пн/Чт, кисть Вт/Пт, стол 1×),
 * GodsOfGrip RT-6 (% от max, повторы+холды), Horne basic 12 (3×/нед
 * pinch/curl/wrist), Levan pyramid-4 (%1RM x20@50→x3@90, стол 1×/мес),
 * Donatif advanced 8 (4–5 сессий max/dynamic/endurance, делоад 4–6н).
 *
 * Чистый модуль без импортов. Дефолтный путь билдера (без cycleId) не меняется.
 */

export type ArmCycleId =
  | 'strengthlog_8'
  | 'tableready_12'
  | 'toproll_6'
  | 'src_toproll_12'
  | 'kuznica_6_8'
  | 'dobrorezov_44'
  | 'grinder_hybrid_12'
  | 'coc_8'
  | 'coc_12'
  | 'for_7'
  | 'brzenk_1_1'
  | 'larratt_table_bloodflow'
  | 'kta_singles'
  | 'schoolboy_push_pull'
  | 'ivakin_arm_hand'
  | 'gog_rt_6'
  | 'horne_basic_12'
  | 'levan_pyramid_4'
  | 'donatif_adv_8';

export type ArmCycleFit = 'exact' | 'proposed_extend' | 'proposed_shrink' | 'strict_skip';

export interface ArmCycleTemplate {
  id: ArmCycleId;
  name: string;
  discipline: 'armwrestling' | 'armlifting' | 'hybrid' | 'any';
  weeks: number;
  daysPerWeek: number;
  level: Array<'beginner' | 'intermediate' | 'advanced' | 'enhanced'>;
  phases: Record<number, 'accumulation' | 'intensification' | 'deload' | 'peaking'>;
  tablePerWeek: number; // столовых сессий/нед (0 для чистого хвата)
  rpe: string; // 'RPE 7-8' и т.п.
  deloadRule: string;
  taperPreset: 'classic' | 'tableready_deload' | 'coc_deload' | 'toproll_taper' | 'none';
  correctionPctDefault: number; // %/нед прогрессии весов (СРЦ — 0.5)
  note: string;
}

function phasesLinear(
  weeks: number,
  fn: (w: number) => 'accumulation' | 'intensification' | 'deload' | 'peaking',
): Record<number, 'accumulation' | 'intensification' | 'deload' | 'peaking'> {
  const out: Record<number, 'accumulation' | 'intensification' | 'deload' | 'peaking'> = {};
  for (let w = 1; w <= weeks; w++) out[w] = fn(w);
  return out;
}

export const ARM_CYCLE_LIBRARY: ArmCycleTemplate[] = [
  {
    id: 'strengthlog_8', name: 'StrengthLog 8-week (стол + база)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 4, level: ['intermediate', 'advanced'],
    phases: phasesLinear(8, (w) => (w <= 4 ? 'accumulation' : w === 8 ? 'peaking' : 'intensification')),
    tablePerWeek: 1, rpe: 'Ф1 RPE 7–8, Ф2 RPE 8–9', deloadRule: 'Объём −1 сет на базе в Ф2, специфика не режется',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Ф1 (1–4) база умеренно, Ф2 (5–8) +5–10% на базе при закрытых повторах. Стол 1×/нед 20–30 мин не в отказ.',
  },
  {
    id: 'tableready_12', name: 'Table-Ready 12-week (сухожилия → стол)', discipline: 'armwrestling',
    weeks: 12, daysPerWeek: 3, level: ['beginner', 'intermediate'],
    phases: phasesLinear(12, (w) => (w <= 4 ? 'accumulation' : w <= 8 ? 'intensification' : w <= 11 ? 'peaking' : 'deload')),
    tablePerWeek: 1, rpe: 'Ф1 RPE 6–7, Ф2 RPE 7–8, Ф3 RPE 9 (+isometrics)', deloadRule: 'W12: объём −40%, интенсивность держать, без максимума',
    taperPreset: 'tableready_deload', correctionPctDefault: 0.5,
    note: 'Ф1 2×/нед tendon conditioning + лёгкий стол; Ф2 3×/нед нагрузка паттернов; Ф3 table-power (взрыв + pin-hold 10–15с).',
  },
  {
    id: 'toproll_6', name: 'Toproll 6-week (adapt/breakdown/power)', discipline: 'armwrestling',
    weeks: 6, daysPerWeek: 3, level: ['intermediate', 'advanced'],
    phases: phasesLinear(6, (w) => (w <= 2 ? 'accumulation' : w <= 4 ? 'intensification' : 'peaking')),
    tablePerWeek: 1, rpe: 'По заданию: failure значит failure, RIR значит RIR', deloadRule: 'К 7-й нед (старт): день 1 −10%, день 2 −30%',
    taperPreset: 'toproll_taper', correctionPctDefault: 0.5,
    note: 'Верховик: пронация + rising + back pressure. Стол 1×/нед жёстко, после зала (уставшим — как в бою).',
  },
  {
    id: 'src_toproll_12', name: 'СРЦ №4 верховик (12 микроциклов, силовой)', discipline: 'armwrestling',
    weeks: 12, daysPerWeek: 4, level: ['intermediate', 'advanced'],
    phases: phasesLinear(12, (w) => (w % 4 === 0 ? 'deload' : w <= 6 ? 'accumulation' : 'intensification')),
    tablePerWeek: 1, rpe: 'Силовой: разминка/заминка ≤6 повт, волна нагрузки', deloadRule: 'Каждая 4-я — делоад; микровеса',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Пн Вт Чт Сб. Вариативность + волнообразное циклирование. Точность ПМ 1–3 кг. Требует блок + ременная/толстая/угловая ручки.',
  },
  {
    id: 'kuznica_6_8', name: 'Кузница/Антонов (6 база + 8 предсоревн)', discipline: 'armwrestling',
    weeks: 14, daysPerWeek: 4, level: ['intermediate', 'advanced'],
    phases: phasesLinear(14, (w) => (w <= 6 ? 'accumulation' : w <= 12 ? 'intensification' : w <= 13 ? 'peaking' : 'deload')),
    tablePerWeek: 2, rpe: 'База RPE 7, предсоревн RPE 8–9', deloadRule: 'W14 лёгкая; для 1р–КМС→МС без слабых мест',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'База 6н 3×/нед → предсоревн+соревн 8н 4×/нед. МСМК — только индивидуально.',
  },
  {
    id: 'dobrorezov_44', name: 'Доброрезов 12-мес (12+12+8+12)', discipline: 'armwrestling',
    weeks: 44, daysPerWeek: 3, level: ['beginner', 'intermediate'],
    phases: phasesLinear(44, (w) => (w <= 12 ? 'accumulation' : w <= 24 ? 'accumulation' : w <= 32 ? 'intensification' : w <= 43 ? 'peaking' : 'deload')),
    tablePerWeek: 1, rpe: 'Подгот RPE 6–7 → база 7–8 → сила 8–9 → специализация по технике', deloadRule: 'Делоад каждая 4-я внутри блоков',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Годичный каркас нач→сред: подгот 12 + база 12 + сила 8 + специализация 12. Для годового плана.',
  },
  {
    id: 'grinder_hybrid_12', name: 'Grinder Hybrid 12 (full-body + хват)', discipline: 'hybrid',
    weeks: 12, daysPerWeek: 3, level: ['intermediate', 'advanced'],
    phases: phasesLinear(12, (w) => (w <= 4 ? 'accumulation' : w <= 8 ? 'intensification' : w <= 11 ? 'peaking' : 'deload')),
    tablePerWeek: 0, rpe: 'W1–4 объём, W5–8 топ-сеты 3–5, W9–12 дубли/синглы', deloadRule: 'W12 тест-неделя опционально: RT max, Hub hold, Farmer hold',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Pull+хват / Ноги+хват / Push+хват + 1–2 grip-mini. Плюс дефицит/блоки/темп в силе.',
  },
  {
    id: 'coc_8', name: 'CoC 8-week (Trainer–#1 → #1.5/#2)', discipline: 'armlifting',
    weeks: 8, daysPerWeek: 2, level: ['beginner', 'intermediate'],
    phases: phasesLinear(8, (w) => (w <= 3 ? 'accumulation' : w === 4 ? 'deload' : w <= 7 ? 'intensification' : 'deload')),
    tablePerWeek: 0, rpe: 'Work RPE 7–8, challenge — негативы/партиалы', deloadRule: 'W4 и W8: −40% объёма, без max и негативов',
    taperPreset: 'coc_deload', correctionPctDefault: 0.5,
    note: 'База объёма + пик интенсивности. Extensor bands каждую сессию. Pinch/thick-bar — обязательная подсобка, не аксессуар.',
  },
  {
    id: 'coc_12', name: 'CoC 12-week (#1.5/#2 → #2.5/#3)', discipline: 'armlifting',
    weeks: 12, daysPerWeek: 2, level: ['advanced', 'enhanced'],
    phases: phasesLinear(12, (w) => (w <= 4 ? 'accumulation' : w <= 8 ? 'intensification' : w <= 11 ? 'peaking' : 'deload')),
    tablePerWeek: 0, rpe: 'W9–11 speed closes + sticking-isos 5–8с RPE 9–10', deloadRule: 'W4/W8/W12 делоады −40%; тест после 48–72ч отдыха',
    taperPreset: 'coc_deload', correctionPctDefault: 0.5,
    note: 'Сертификационный трек. Heavy/Volume дни при 3×/нед. Чалк — магнезия, не жидкий (IronMind rules).',
  },
  {
    id: 'for_7', name: 'FOR 7-day (overreach + rebound)', discipline: 'any',
    weeks: 3, daysPerWeek: 6, level: ['advanced', 'enhanced'],
    phases: { 1: 'intensification', 2: 'deload', 3: 'accumulation' },
    tablePerWeek: 0, rpe: 'Н1 overreach RPE 8–9 11 сессий AM/PM, Н2 rebound −60%', deloadRule: 'Н2 1–2 хвата/нед; ретест на 10–14 день',
    taperPreset: 'none', correctionPctDefault: 0,
    note: 'Только advanced/enhanced с чистыми CNS/tendon-гейтами. Специализация — один домен, остальное maintenance.',
  },
  {
    id: 'brzenk_1_1', name: 'Brzenk 1+1 (стол + лёгкий зал)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 2, level: ['intermediate', 'advanced', 'enhanced'],
    phases: phasesLinear(8, (w) => (w === 7 ? 'deload' : w === 8 ? 'peaking' : 'accumulation')),
    tablePerWeek: 1, rpe: 'Стол ~1ч все углы не в отказ; зал 1×10–12 легко', deloadRule: 'Последний жёсткий стол за 2 нед, лёгкий зал до −1 нед',
    taperPreset: 'classic', correctionPctDefault: 0,
    note: 'Минимализм элиты: сила — на столе, зал — ровный. Генетика/техника > объёма. Не для новичков без базы.',
  },
  {
    id: 'larratt_table_bloodflow', name: 'Larratt (стол 2× + bloodflow)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 2, level: ['advanced', 'enhanced'],
    phases: phasesLinear(8, (w) => (w === 8 ? 'peaking' : 'accumulation')),
    tablePerWeek: 2, rpe: 'Стол макс 2×; вне стола bloodflow ~100 повт × ~9 кг', deloadRule: 'Без PR в цикле; 17–18 heavy singles (high/low pron + cup) только свежими',
    taperPreset: 'classic', correctionPctDefault: 0,
    note: 'Rising/pronation/back pressure/cupping + thumb. Pumpkin-рука при однополом зачёте. Never fail — техника чистая.',
  },
  {
    id: 'kta_singles', name: 'KTA singles (Kinney/Horne, 6д/нед)', discipline: 'armlifting',
    weeks: 8, daysPerWeek: 6, level: ['advanced', 'enhanced'],
    phases: phasesLinear(8, (w) => (w <= 2 ? 'accumulation' : w <= 6 ? 'intensification' : w === 7 ? 'peaking' : 'deload')),
    tablePerWeek: 0, rpe: 'Синглы RPE 8–10; объём 40–50 → 70–80 синглов/нед', deloadRule: 'W7–8 пик через день; negatives/overcrush/strap holds + dynamic thumb каждую сессию',
    taperPreset: 'coc_deload', correctionPctDefault: 0,
    note: 'Классика сертификации CoC: negatives + overcrush + strap holds 5–7с. 6 дней подряд — только с чистыми сухожилиями, иначе тендинопатия.',
  },
  {
    id: 'schoolboy_push_pull', name: 'Schoolboy PULL/PUSH (Beziazykov 2025)', discipline: 'armwrestling',
    weeks: 6, daysPerWeek: 5, level: ['intermediate', 'advanced'],
    phases: phasesLinear(6, (w) => (w <= 3 ? 'accumulation' : w <= 5 ? 'intensification' : 'deload')),
    tablePerWeek: 1, rpe: 'PULL/ PUSH, жимы пирамидой 8-6-4-2-1 (макс в конце)', deloadRule: 'W6 лёгкая; Ср — общая сила/восстановление, Вс — стол/спарринг',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Пн PULL / Вт PUSH / Ср ОФП / Чт PULL / Пт PUSH / Вс стол. Side press wrist-wrench 3×10–15, жим/армейский пирамидой.',
  },
  {
    id: 'ivakin_arm_hand', name: 'Ivakin ARM/HAND 4× (эталон топролла)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 4, level: ['intermediate', 'advanced'],
    phases: phasesLinear(8, (w) => (w <= 4 ? 'accumulation' : w <= 7 ? 'intensification' : 'peaking')),
    tablePerWeek: 1, rpe: 'Руки 4–8 повт (Скотт 6–7×6–8), кисть 6–8 повт (5–6 сетов)', deloadRule: 'Пн/Чт руки, Вт/Пт кисть; стол 1×/нед отдельно',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Taras Ivakin (золотой стандарт топролла по Larratt): руки и кисть в разные дни. Трицепс 4×6–8 обязателен (антагонист локтя).',
  },
  {
    id: 'gog_rt_6', name: 'GodsOfGrip RT-6 (% от max)', discipline: 'armlifting',
    weeks: 6, daysPerWeek: 2, level: ['intermediate', 'advanced'],
    phases: phasesLinear(6, (w) => (w <= 3 ? 'accumulation' : w <= 5 ? 'intensification' : 'deload')),
    tablePerWeek: 0, rpe: 'Проценты от текущего max: повторы + холды на время', deloadRule: 'W6 тест-макс; таблица считает веса от введённого max (spreadsheet-методика)',
    taperPreset: 'classic', correctionPctDefault: 0,
    note: 'Платный spreadsheet-метод: вводишь max — получаешь веса (разминка + работа). Холды легче повторов — вес для повторов снижать.',
  },
  {
    id: 'horne_basic_12', name: 'Horne basic 12 (3×/нед pinch/curl/wrist)', discipline: 'armlifting',
    weeks: 12, daysPerWeek: 3, level: ['beginner', 'intermediate'],
    phases: phasesLinear(12, (w) => (w % 4 === 0 ? 'deload' : w <= 7 ? 'accumulation' : 'intensification')),
    tablePerWeek: 0, rpe: 'База RPE 6–7: pinch 3×20с, curls 3×15, wrist 3×15', deloadRule: 'Делоад каждая 4-я; перчатки на щипок (кожа!), вес + по самочувствию — марафон, не спринт',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'David Horne (многократный чемпион мира по хвату): 4 упражнения после обычной тренировки или отдельно. Снаряжение — минимум.',
  },
  {
    id: 'levan_pyramid_4', name: 'Levan pyramid 4× (%1RM, 3ч)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 4, level: ['advanced', 'enhanced'],
    phases: phasesLinear(8, (w) => (w <= 4 ? 'accumulation' : w <= 7 ? 'intensification' : 'peaking')),
    tablePerWeek: 0, rpe: 'Пирамида %1RM: x20@50 → x10@65 → x7@80 → x3@90; отдых 5–10 мин', deloadRule: 'Стол 1×/мес; полная + частичная амплитуда; грудь/спина для общей силы',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Saginashvili: база не меняется с 2010-х — бицепс+кисть+пронация тяжёлыми пирамидами. Объём элитный: масштабировать вниз, становая бьёт по запястьям.',
  },
  {
    id: 'donatif_adv_8', name: 'Donatif advanced 8 (max/dynamic/endurance)', discipline: 'armwrestling',
    weeks: 8, daysPerWeek: 5, level: ['advanced', 'enhanced'],
    phases: phasesLinear(8, (w) => (w === 4 ? 'deload' : w <= 3 ? 'accumulation' : w <= 7 ? 'intensification' : 'peaking')),
    tablePerWeek: 1, rpe: 'День макс-силы + день динамики + день спецвыносливости (RPE/%1RM)', deloadRule: 'Делоад каждая 4–6н: объём вниз, связки/эксцентрика лёгкая + мобильность',
    taperPreset: 'classic', correctionPctDefault: 0.5,
    note: 'Сессии с точной целью (пронация / back pressure / hook-статика), углы как на старте. Медиальный локоть — лимитер частоты.',
  },
];

export function getArmCycle(id: string): ArmCycleTemplate | undefined {
  return ARM_CYCLE_LIBRARY.find((c) => c.id === id);
}

export function listArmCycles(discipline?: string): ArmCycleTemplate[] {
  if (!discipline || discipline === 'any') return ARM_CYCLE_LIBRARY.slice();
  return ARM_CYCLE_LIBRARY.filter((c) => c.discipline === discipline || c.discipline === 'any' || c.discipline === 'hybrid');
}

/** Фазовая карта цикла, обрезанная/растянутая под фактические недели (без мутации источника). */
export function cyclePhaseMap(cycleId: string, totalWeeks: number): Record<number, string> | null {
  const c = getArmCycle(cycleId);
  if (!c || totalWeeks <= 0) return null;
  if (totalWeeks === c.weeks) return { ...c.phases };
  const out: Record<number, string> = {};
  for (let w = 1; w <= totalWeeks; w++) {
    const src = Math.min(c.weeks, Math.max(1, Math.round((w * c.weeks) / totalWeeks)));
    out[w] = c.phases[src] || 'accumulation';
  }
  return out;
}

export interface ArmCycleFitResult {
  fit: ArmCycleFit;
  needsConsent: boolean;
  fittedWeeks: number;
  note: string;
}

/**
 * Подгонка цикла под окно (зеркало lms-season fit): exact при совпадении,
 * proposed_extend/shrink — по согласию, strict_skip — без согласия дальше нельзя.
 */
export function fitCycleToWeeks(cycleId: string, weeks: number): ArmCycleFitResult {
  const c = getArmCycle(cycleId);
  const w = Math.max(0, Math.round(weeks || 0));
  if (!c || w <= 0) return { fit: 'strict_skip', needsConsent: false, fittedWeeks: 0, note: 'Цикл не найден — пропуск (strict_skip).' };
  if (w === c.weeks) return { fit: 'exact', needsConsent: false, fittedWeeks: w, note: `Цикл ${c.name}: exact ${w} нед.` };
  if (w > c.weeks)
    return { fit: 'proposed_extend', needsConsent: true, fittedWeeks: c.weeks, note: `Окно ${w} > цикла ${c.weeks}: требуется согласие на растяжение фаз (exact — первые ${c.weeks} нед).` };
  return { fit: 'proposed_shrink', needsConsent: true, fittedWeeks: c.weeks, note: `Окно ${w} < цикла ${c.weeks}: требуется согласие на сжатие (exact — весь цикл ${c.weeks} нед, окно будет переписано).` };
}
