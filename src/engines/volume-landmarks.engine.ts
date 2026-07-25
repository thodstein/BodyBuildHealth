/**
 * volume-landmarks.engine.ts — ЕДИНЫЙ источник объёмных ориентиров (MEV/MAV/MRV).
 *
 * AUD-FIX-2 (Этап AUD): устраняет рассинхрон 4 источников:
 *  - training.engine.LEVEL_VOLUMES          (per-level, не per-muscle) — оставлен как fallback per-level
 *  - training-methodology.VOLUME_REFERENCES (per-muscle×level, RU-имена) — совместим по значениям
 *  - performance-analytics.VOLUME_LANDMARKS_DB (per-muscle×level, EN-имена) — был каноническим
 *  - ultimate-calculators.mrvPerGroup/mevPerGroup (per-muscle, ключ 'novice', неверные значения) — теперь делегирует сюда
 *
 * Этот файл — единственный владелец канонических per-muscle значений.
 * Уровни: beginner | intermediate | advanced | enhanced (enhanced = ААС/PED, ~+15% к advanced).
 * Мышцы (EN-ключи): chest, back, quads, hamstrings, shoulders, delt_front, delt_mid, delt_rear,
 *                   biceps, triceps, calves, glutes, abs, traps, forearms.
 *
 * Дельта разделена на 3 пучка (Israetel, Meadows): передняя дельта получает нагрузку от жимов,
 * средняя — самая упорная (высокий MRV), задняя — часто neglected (средний MRV).
 * Traps и forearms добавлены как отдельные группы (были объединены с shoulders/arms).
 * Calves: MRV повышен (икры требуют больше объёма для роста).
 *
 * ССЫЛКИ: Israetel M. et al., "Hypertrophy Training Guide" (MEV/MAV/MRV per muscle).
 *         Meadows J., "Calf Training Blueprint" (calves MRV↑).
 *         Davis M., "Side Delts: the 18-Set Rule" (delt_mid MAV/MRV).
 */

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface MuscleVolumeLandmarks {
  mev: number; // Minimum Effective Volume (sets/week)
  mav: number; // Maximum Adaptive Volume
  mrv: number; // Maximum Recoverable Volume
}

export type VolumeStatus = 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv';

/** Каноническая база MEV/MAV/MRV по мышцам и уровням (sets/week). */
export const VOLUME_LANDMARKS_DB: Record<TrainingLevel, Record<string, MuscleVolumeLandmarks>> = {
  beginner: {
    chest:      { mev: 6,  mav: 10, mrv: 15 },
    back:       { mev: 8,  mav: 12, mrv: 18 },
    quads:      { mev: 6,  mav: 10, mrv: 15 },
    hamstrings: { mev: 4,  mav: 8,  mrv: 12 },
    shoulders:  { mev: 4,  mav: 8,  mrv: 12 },
    delt_front: { mev: 0,  mav: 4,  mrv: 8  }, // MEV=0: передняя дельта получает достаточно объёма от жимовых (bench/OHP)
    delt_mid:   { mev: 2,  mav: 6,  mrv: 10 },
    delt_rear:  { mev: 2,  mav: 6,  mrv: 10 },
    biceps:     { mev: 2,  mav: 6,  mrv: 10 },
    triceps:    { mev: 2,  mav: 6,  mrv: 10 },
    calves:     { mev: 4,  mav: 8,  mrv: 14 },
    glutes:     { mev: 4,  mav: 8,  mrv: 12 },
    abs:        { mev: 4,  mav: 8,  mrv: 12 },
    traps:      { mev: 3,  mav: 6,  mrv: 11 },
    forearms:   { mev: 2,  mav: 4,  mrv: 8  },
  },
  intermediate: {
    chest:      { mev: 8,  mav: 14, mrv: 20 },
    back:       { mev: 10, mav: 16, mrv: 24 },
    quads:      { mev: 8,  mav: 14, mrv: 20 },
    hamstrings: { mev: 6,  mav: 10, mrv: 16 },
    shoulders:  { mev: 6,  mav: 10, mrv: 16 },
    delt_front: { mev: 0,  mav: 6,  mrv: 10 },
    delt_mid:   { mev: 4,  mav: 8,  mrv: 14 },
    delt_rear:  { mev: 4,  mav: 8,  mrv: 12 },
    biceps:     { mev: 4,  mav: 8,  mrv: 14 },
    triceps:    { mev: 4,  mav: 8,  mrv: 14 },
    calves:     { mev: 6,  mav: 10, mrv: 18 },
    glutes:     { mev: 6,  mav: 10, mrv: 16 },
    abs:        { mev: 4,  mav: 10, mrv: 14 },
    traps:      { mev: 5,  mav: 8,  mrv: 14 },
    forearms:   { mev: 4,  mav: 6,  mrv: 10 },
  },
  advanced: {
    chest:      { mev: 10, mav: 16, mrv: 24 },
    back:       { mev: 12, mav: 18, mrv: 28 },
    quads:      { mev: 10, mav: 16, mrv: 24 },
    hamstrings: { mev: 8,  mav: 12, mrv: 18 },
    shoulders:  { mev: 8,  mav: 12, mrv: 20 },
    delt_front: { mev: 0,  mav: 6,  mrv: 10 },
    delt_mid:   { mev: 4,  mav: 10, mrv: 18 },
    delt_rear:  { mev: 4,  mav: 8,  mrv: 14 },
    biceps:     { mev: 6,  mav: 12, mrv: 18 },
    triceps:    { mev: 6,  mav: 12, mrv: 18 },
    calves:     { mev: 8,  mav: 16, mrv: 22 },
    glutes:     { mev: 8,  mav: 12, mrv: 20 },
    abs:        { mev: 6,  mav: 12, mrv: 16 },
    traps:      { mev: 4,  mav: 8,  mrv: 14 },
    forearms:   { mev: 4,  mav: 8,  mrv: 14 },
  },
  // enhanced: ААС/PED — толерантность к объёму ~+15% к advanced (Israetel + эмпирика).
  enhanced: {
    chest:      { mev: 12, mav: 18, mrv: 28 },
    back:       { mev: 14, mav: 20, mrv: 32 },
    quads:      { mev: 12, mav: 18, mrv: 28 },
    hamstrings: { mev: 10, mav: 14, mrv: 22 },
    shoulders:  { mev: 10, mav: 14, mrv: 24 },
    delt_front: { mev: 0,  mav: 8,  mrv: 12 },
    delt_mid:   { mev: 6,  mav: 12, mrv: 22 },
    delt_rear:  { mev: 6,  mav: 10, mrv: 18 },
    biceps:     { mev: 8,  mav: 14, mrv: 22 },
    triceps:    { mev: 8,  mav: 14, mrv: 22 },
    calves:     { mev: 10, mav: 18, mrv: 26 },
    glutes:     { mev: 10, mav: 14, mrv: 24 },
    abs:        { mev: 8,  mav: 14, mrv: 20 },
    traps:      { mev: 6,  mav: 10, mrv: 18 },
    forearms:   { mev: 6,  mav: 10, mrv: 18 },
  },
};

/** Нормализация уровня: проект использует 'beginner'; исторически где-то 'novice'. */
export function normLevel(level: string): TrainingLevel {
  const l = (level || '').toLowerCase();
  if (l === 'beginner' || l === 'novice' || l === 'новичок' || l === 'untrained') return 'beginner';
  if (l === 'intermediate' || l === 'средний') return 'intermediate';
  if (l === 'advanced' || l === 'продвинутый' || l === 'elite' || l === 'world_class') return 'advanced';
  if (l === 'enhanced' || l === 'элита' || l === 'мсмк' || l === 'ped') return 'enhanced';
  return 'intermediate';
}

/** Псевдонимы мышц (RU/варианты → канонический EN-ключ). */
const MUSCLE_ALIASES: Record<string, string> = {
  грудь: 'chest', 'грудные': 'chest', chest: 'chest', pecs: 'chest',
  спина: 'back', 'широчайшие': 'back', 'широчайшие / спина': 'back', back: 'back', lats: 'back',
  квадрицепсы: 'quads', квадр: 'quads', quads: 'quads', quadriceps: 'quads', 'квадрицепс': 'quads',
  'бицепс бедра': 'hamstrings', hamstrings: 'hamstrings', hams: 'hamstrings', 'задняя поверхность бедра': 'hamstrings',
  плечи: 'shoulders', shoulders: 'shoulders', delt: 'shoulders', дельты: 'shoulders',
  'передняя дельта': 'delt_front', delt_front: 'delt_front', 'delt front': 'delt_front', 'front delt': 'delt_front',
  'средняя дельта': 'delt_mid', delt_mid: 'delt_mid', 'delt mid': 'delt_mid', 'side delt': 'delt_mid', 'lateral delt': 'delt_mid',
  'задняя дельта': 'delt_rear', delt_rear: 'delt_rear', 'delt rear': 'delt_rear', 'rear delt': 'delt_rear',
  бицепс: 'biceps', biceps: 'biceps', 'бицепсы': 'biceps',
  трицепс: 'triceps', triceps: 'triceps', 'трицепсы': 'triceps',
  икры: 'calves', calves: 'calves', голени: 'calves',
  ягодицы: 'glutes', glutes: 'glutes', ягоды: 'glutes',
  пресс: 'abs', abs: 'abs', кор: 'abs', core: 'abs',
  трапеции: 'traps', traps: 'traps', трап: 'traps', 'трапециевидные': 'traps',
  предплечья: 'forearms', forearms: 'forearms', 'forearm': 'forearms', 'предплечье': 'forearms',
};

export function normMuscle(muscle: string): string {
  const m = (muscle || '').toLowerCase().trim();
  return MUSCLE_ALIASES[m] || m;
}

/** MEV/MAV/MRV для конкретной мышцы и уровня. */
export function getVolumeLandmarks(level: string, muscle: string): MuscleVolumeLandmarks | null {
  const lvl = normLevel(level);
  const musc = normMuscle(muscle);
  // Composite groups: суммируем значения подгрупп
  if (musc === 'arms') {
    const bi = VOLUME_LANDMARKS_DB[lvl]?.biceps;
    const tr = VOLUME_LANDMARKS_DB[lvl]?.triceps;
    if (bi && tr) return { mev: bi.mev + tr.mev, mav: bi.mav + tr.mav, mrv: bi.mrv + tr.mrv };
  }
  if (musc === 'legs') {
    const qu = VOLUME_LANDMARKS_DB[lvl]?.quads;
    const ha = VOLUME_LANDMARKS_DB[lvl]?.hamstrings;
    if (qu && ha) return { mev: qu.mev + ha.mev, mav: qu.mav + ha.mav, mrv: qu.mrv + ha.mrv };
  }
  const data = VOLUME_LANDMARKS_DB[lvl]?.[musc];
  return data ? { ...data } : null;
}

/** Все мышцы для уровня. */
export function getAllVolumeLandmarks(level: string): Record<string, MuscleVolumeLandmarks> {
  const lvl = normLevel(level);
  const data = VOLUME_LANDMARKS_DB[lvl] || VOLUME_LANDMARKS_DB.intermediate;
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { ...v }]));
}

/** MRV по мышцам для уровня (совместимо со старым API ultimate-calculators). */
export function mrvPerGroup(level: string): Record<string, { min: number; max: number }> {
  const all = getAllVolumeLandmarks(level);
  const out: Record<string, { min: number; max: number }> = {};
  for (const [k, v] of Object.entries(all)) out[k] = { min: v.mav, max: v.mrv };
  return out;
}

/** MEV по мышцам для уровня. */
export function mevPerGroup(level: string): Record<string, number> {
  const all = getAllVolumeLandmarks(level);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(all)) out[k] = v.mev;
  return out;
}

/** MAV по мышцам для уровня. */
export function mavPerGroup(level: string): Record<string, number> {
  const all = getAllVolumeLandmarks(level);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(all)) out[k] = v.mav;
  return out;
}

/** MRV для конкретной мышцы с учётом курса и лаб. коррекции. */
export function getPerMuscleMrvFromLevel(level: string, muscle: string, onCourse: boolean, courseIntensity: string, labMult: number): number {
  const lm = getVolumeLandmarks(level, muscle);
  let mrv = lm?.mrv || 12;
  if (onCourse) {
    const courseMult = courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'moderate' ? 1.2 : 1.15;
    mrv = Math.round(mrv * courseMult);
  }
  mrv = Math.round(mrv * (labMult || 1));
  return mrv;
}

/** Статус фактического объёма относительно ориентиров. */
export function checkVolumeStatus(currentSets: number, landmarks: MuscleVolumeLandmarks): VolumeStatus {
  if (currentSets < landmarks.mev) return 'below_mev';
  if (currentSets <= landmarks.mav) return 'optimal';
  if (currentSets <= landmarks.mrv) return 'approaching_mrv';
  return 'exceeding_mrv';
}

/**
 * Пересчёт недельных ориентиров под фактическую длину ротации (для rolling-микроциклов).
 * Если ротация != 7 дней, объём масштабируется пропорционально (sets за период = sets/нед * дни/7).
 */
export function landmarksForRotation(level: string, muscle: string, rotationDays: number): MuscleVolumeLandmarks | null {
  const base = getVolumeLandmarks(level, muscle);
  if (!base) return null;
  if (!rotationDays || rotationDays === 7) return { ...base };
  const f = rotationDays / 7;
  return {
    mev: Math.round(base.mev * f),
    mav: Math.round(base.mav * f),
    mrv: Math.round(base.mrv * f),
  };
}

/** RU-подписи мышц для отображения в UI. */
export const MUSCLE_LABEL_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра',
  shoulders: 'Плечи', delt_front: 'Передняя дельта', delt_mid: 'Средняя дельта', delt_rear: 'Задняя дельта',
  biceps: 'Бицепс', triceps: 'Трицепс', calves: 'Икры', glutes: 'Ягодицы',
  abs: 'Пресс / Кор', traps: 'Трапеции', forearms: 'Предплечья',
  arms: 'Руки (бицепс+трицепс)', legs: 'Ноги (квадрицепсы+бицепс бедра)',
};

/** Унифицированная строка volume-landmark для любого планировщика. */
export interface VolumeLandmarkRow {
  group: string;       // канонический EN-ключ
  label: string;       // RU-подпись
  muscle?: string;     // alias label (back-compat)
  sets: number;        // фактический недельный объём (пиковая неделя)
  mev: number; mav: number; mrv: number;
  status: VolumeStatus;
  peakWeek?: number;
}

const STATUS_ORDER: Record<VolumeStatus, number> = {
  exceeding_mrv: 0, approaching_mrv: 1, optimal: 2, below_mev: 3,
};

/**
 * Универсальный расчёт volume-landmarks для ЛЮБОГО плана (PL/BB/ручной).
 * @param weeklySets — объём (sets/week) по каноническим группам мышц.
 * @param level — уровень (beginner/intermediate/advanced/enhanced/...).
 * @param opts.labMult — множитель MRV (курс/лаб. коррекция), напр. 1.25.
 * @param opts.onlyGroups — ограничить перечень групп.
 * @param opts.peakWeek — номер пиковой недели для отображения.
 */
export function computeVolumeLandmarks(
  weeklySets: Record<string, number>,
  level: string,
  opts?: { labMult?: number; onlyGroups?: string[]; peakWeek?: number },
): VolumeLandmarkRow[] {
  const out: VolumeLandmarkRow[] = [];
  const groups = opts?.onlyGroups || Object.keys(weeklySets);
  for (const g of groups) {
    const sets = Math.round(weeklySets[g] || 0);
    if (!sets) continue;
    const musc = normMuscle(g);
    const lm = getVolumeLandmarks(level, musc);
    if (!lm) continue;
    let mrv = lm.mrv;
    if (opts?.labMult) mrv = Math.round(mrv * opts.labMult);
    const status = checkVolumeStatus(sets, { ...lm, mrv });
    const label = MUSCLE_LABEL_RU[musc] || musc;
    out.push({ group: musc, label, muscle: label, sets, mev: lm.mev, mav: lm.mav, mrv, status, peakWeek: opts?.peakWeek });
  }
  out.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.sets - a.sets));
  return out;
}