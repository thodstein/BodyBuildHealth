/**
 * bb-session-order.engine.ts — технически грамотный порядок упражнений внутри ББ-сессии.
 *
 * Профессиональные правила (как ставит упражнения тренер-специалист):
 *  1. Сначала базовые (compound) — механическое натяжение на свежие мышцы.
 *  2. Среди compounds — основная мышца дня (primaryMuscle) первой.
 *     → Жим лёжа (грудь) ПЕРЕД жимом стоя (плечи) в грудной/верхний день.
 *     → Жим стоя (OHP) первым только в день плеч.
 *  3. Изоляция — после всех compounds: сначала основная мышца, затем вторичные.
 *  4. Внутри изоляции одной мышцы — угол/растяжка: растянутая позиция первой
 *     (наклон, RDL, overhead triceps) → средняя → укороченная (crossover, concentration).
 *  5. Финиши (pump/metabolic, высокоповторные, памп-характер) — в конце.
 *  6. ПЛ-конкуренсные спецификации (пауза/доски/резина/цепи) — в конец compounds
 *     (не смешивать силовую специфику с гипертрофией).
 *
 * Применяется как финальный проход к массиву BBExercise сессии (после отбора,
 * до обрезки по exCap — чтобы обрезка оставила правильные приоритетные).
 */
import { TAG_MUSCLES } from './bb-day-types';
import type { BBExercise } from './bb-builder.engine';

/* ───────────────────────── Приоритет мышц ───────────────────────── */
// Большие/compound-доминантные мышцы раньше в пределах одного тира.
const MUSCLE_PRIORITY: Record<string, number> = {
  quads: 0, back: 1, chest: 2, hamstrings: 3, glutes: 4,
  legs: 4, shoulders: 5, delt_front: 5, delt_mid: 5, delt_rear: 5,
  trapezius: 6, traps: 6, biceps: 7, triceps: 7, arms: 7,
  calves: 8, forearms: 9, abs: 10, core: 10, lower_back: 10,
};
function musclePriority(muscle: string): number {
  return MUSCLE_PRIORITY[muscle] ?? 12;
}

/* ───────────────────────── Классификаторы по имени ───────────────────────── */

/** Базовое (compound) упражнение по имени или роли. */
export function isCompoundEx(ex: BBExercise): boolean {
  if (ex.role === 'primary') return true;
  const n = (ex.name || '').toLowerCase();
  return (
    /жим|присед|становая|тяга|выпад|пулловер|pull-?up|подтяг|отжимание|dip|bench|press|squat|deadlift|row|lunge|hip.?thrust|rdl|good.?morning/i.test(n)
  ) && !/мах|raise|fly|развод|сгибан|разгибан|curl|extension|kickback|crunch|пресс|скручив/i.test(n);
}

/** Жимовое движение (press) — нужно для порядка «горизонтальный жим перед вертикальным в грудной день». */
function isPress(name: string): boolean {
  const n = (name || '').toLowerCase();
  return /жим|press|bench|армер|overhead|ohp/i.test(n) && !/мах|raise|fly|развод|curl|extension/i.test(n);
}

/** ПЛ-конкуренсная спецификация: паузы/доски/резина/цепи — силовая специфика, не гипертрофия. */
function isPLSpec(name: string): boolean {
  const n = (name || '').toLowerCase();
  return /пауз|с паузой|pause|board|доска|цепи|chains|резин|bands|pin and|block|deficit|широкий хват|close.?grip.?bench|узким хват/i.test(n);
}

/* ───────────────────────── Растяжка/угол для изоляций ───────────────────────── */
// 0 = растянутая/длинная позиция (ставить первой), 2 = укороченная (последней).
function stretchRank(name: string): number {
  const n = (name || '').toLowerCase();
  // Наклон / растянутая позиция — максимальная длина мышцы
  if (/наклон|incline|rdl|румынская|good.?morning|overhead.?tricep|француз|french|сгибан.*сидя|seated.*curl|stretch|lengthened/i.test(n)) return 0;
  // Укороченная / концентрированная / кроссовер
  if (/crossover|кроссовер|concentration|концентрирован|kickback|shortened|пиков|peak/i.test(n)) return 2;
  // Среднее / плоское
  return 1;
}

/* ───────────────────────── Нагрузка (вес/RIR) ───────────────────────── */
// Тяжелее (больше вес / меньше RIR) — раньше среди однотипных compounds.
function loadRank(ex: BBExercise): number {
  const w = ex.workSets?.[0]?.weight ?? 0;
  const rir = ex.rir ?? 2;
  return -w + rir * 10; // больше вес → меньше ранг (раньше); меньше RIR → раньше
}

/* ───────────────────────── Главная функция порядка ───────────────────────── */

export type SessionMethodology = 'compound_first' | 'pre_exhaust' | 'post_exhaust';

export interface OrderOpts {
  sessionTag?: string;
  /** Основная мышца дня (первая в TAG_MUSCLES[tag]); если тег неизвестен — вычисляется. */
  primaryMuscle?: string;
  /** Методика порядка. compound_first — базовые раньше изоляции (по умолчанию).
   *  pre_exhaust — изоляция основной мышцы ПЕРВОЙ (предварительное утомление), затем compound.
   *  post_exhaust — compound, затем изоляция (то же что compound_first, явно). */
  methodology?: SessionMethodology;
}

export function orderSessionExercises(exercises: BBExercise[], opts: OrderOpts = {}): BBExercise[] {
  if (exercises.length <= 1) return exercises.slice();
  const tagMuscles = TAG_MUSCLES[opts.sessionTag || ''] || [];
  // Основная мышца дня: явная опция → первая из тега → иначе мышца первого primary+тяж.
  let primaryMuscle = opts.primaryMuscle || tagMuscles[0];
  if (!primaryMuscle) {
    const firstHeavy = exercises.find(e => e.role === 'primary' && e.character === 'тяж');
    primaryMuscle = firstHeavy?.muscle || exercises.find(e => e.role === 'primary')?.muscle || exercises[0]?.muscle || '';
  }
  const tagMuscleSet = new Set(tagMuscles.map(m => collapseMuscle(m)));

  const methodology = opts.methodology || 'compound_first';
  const indexed = exercises.map((ex, idx) => ({ ex, idx, key: rankKey(ex, primaryMuscle, tagMuscleSet, methodology) }));
  // Лексикографическое сравнение кортежа.
  indexed.sort((a, b) => {
    const ka = a.key, kb = b.key;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return a.idx - b.idx; // стабильность при полном равенстве
  });
  return indexed.map(x => x.ex);
}

/**
 * Кортеж приоритета (лексикографический):
 *  [0] tier:            0 = основное тяжёлое (primary+тяж), 1 = compound, 2 = изоляция, 3 = финишь
 *  [1] primaryMuscleFlag: 0 = мышца дня (primaryMuscle), 1 = прочие
 *  [2] musclePriority:   большие мышцы раньше (chest/back/legs > shoulders > arms)
 *  [3] subOrder:         для compound — pressPosition (гориз. жим раньше верт. в грудной день);
 *                        для изоляции — stretchRank (растянутая позиция первой);
 *                        для ПЛ-специфики — +50 (в конец своего тира)
 *  [4] load:             тяжелее / меньше RIR — раньше (тонкая подстройка)
 */
function rankKey(ex: BBExercise, primaryMuscle: string, tagMuscleSet: Set<string>, methodology: SessionMethodology = 'compound_first'): number[] {
  const exMuscle = collapseMuscle(ex.muscle || '');
  const isPrimaryMuscle = exMuscle === collapseMuscle(primaryMuscle);
  const isPrimaryHeavy = ex.role === 'primary' && ex.character === 'тяж';
  const compound = isCompoundEx(ex);
  const plSpec = isPLSpec(ex.name || '');
  const isFinisher = ex.role === 'accessory' && (ex.character === 'памп' || (ex.workSets?.[0]?.reps ?? 0) >= 12);

  // pre_exhaust: изоляция основной мышцы — ПЕРВОЙ (предварительное утомление), затем compound.
  const isPrimaryIsolation = isPrimaryMuscle && !compound && !isFinisher;
  let tier: number;
  if (isFinisher) tier = 3;
  else if (methodology === 'pre_exhaust' && isPrimaryIsolation) tier = -1; // изоляция основной мышцы первой
  else if (isPrimaryHeavy) tier = 0;
  else if (compound) tier = 1;
  else tier = 2;

  const primaryMuscleFlag = isPrimaryMuscle ? 0 : 1;
  const muscP = musclePriority(exMuscle);
  // subOrder: для изоляций — растяжка; для compounds — позиция жима; ПЛ-специфика → +50.
  let subOrder: number;
  if (tier === 2) subOrder = stretchRank(ex.name || '');
  else if (compound) subOrder = isPress(ex.name || '') ? pressPositionRank(ex.name || '', primaryMuscle) : 0;
  else subOrder = 0;
  if (plSpec) subOrder += 50;
  const load = loadRank(ex);
  return [tier, primaryMuscleFlag, muscP, subOrder, load];
}

function collapseMuscle(m: string): string {
  if (m === 'delt_front' || m === 'delt_mid' || m === 'delt_rear') return 'shoulders';
  if (m === 'lower_back') return 'core';
  return m;
}

/** Порядок жимов: горизонтальный жим (грудь) раньше вертикального (плечи) в день с акцентом на грудь. */
function pressPositionRank(name: string, primaryMuscle: string): number {
  const n = (name || '').toLowerCase();
  const isVertical = /стоя|сидя|армей|overhead|ohp|shoulder.?press|военный/i.test(n) && !/лёжа|лежа|bench/i.test(n);
  const isHorizontal = /лёжа|лежа|bench|гориз/i.test(n);
  // В грудной день: горизонтальный жим (0) раньше вертикального (10).
  if (collapseMuscle(primaryMuscle) === 'chest') {
    if (isHorizontal) return 0;
    if (isVertical) return 10;
  }
  // В день плеч: вертикальный жим (OHP) — это основное, приоритет 0.
  if (collapseMuscle(primaryMuscle) === 'shoulders') {
    if (isVertical) return 0;
    if (isHorizontal) return 10;
  }
  return isHorizontal ? 0 : (isVertical ? 5 : 2);
}