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
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { methodologySpecFor } from './bb-methodology-spec';

/* ───────────────────────── Приоритет мышц ───────────────────────── — каноника MUSCLE_ORDER (дедуп P2-1) */
const MUSCLE_ORDER: Record<string, number> = {
  quads: 0, back: 1, chest: 2, hamstrings: 3, glutes: 4,
  legs: 4, shoulders: 5, delt_front: 5, delt_mid: 5, delt_rear: 5,
  traps: 6, trapezius: 6, triceps: 7, biceps: 8, arms: 9,
  calves: 10, forearms: 11, abs: 12, core: 12, lower_back: 12,
};
/** @deprecated alias — используйте MUSCLE_ORDER напрямую */
const MUSCLE_PRIORITY: Record<string, number> = MUSCLE_ORDER;
function musclePriority(muscle: string): number {
  return MUSCLE_ORDER[muscle] ?? 12;
}

/* ───────────────────────── Классификаторы по имени ───────────────────────── */

/** Базовое (compound) упражнение по имени или роли. */
// O-3: без голого `подъём` — «Подъём на грудь» (clean) и «Подъём ног в висе» это
// не изоляция. Подъёмы-изоляции узнаются по своей сути (на носки / бицепс /
// перед собой / на скамье Скотта / через стороны), а не по слову «подъём».
const ISOLATION_RE = /мах|raise|fly|разв(од|ед)|сгибан|разгибан|curl|extension|kickback|crunch|пресс|скручив|француз|шраг|кроссовер|из-за головы|в стороны|сторон|перед собой|на носки|на носок|на нос|бицепс|трицепс|молотк|сведен|отведение|приведение|скотт|концентрирован|тибиалис|scaption|cable.*lateral/i;
/** True for isolation movements by name (french press, curl, lateral/front raise, shrug, pushdown,
 *  fly, calf raise, crunch, etc.) — used to keep heavy/primary isolations out of the compound tier. */
export function isIsolationByName(name: string): boolean {
  return ISOLATION_RE.test((name || '').toLowerCase());
}

export function isCompoundEx(ex: BBExercise): boolean {
  const n = (ex.name || '').toLowerCase();
  // O-3: структурные данные каталога СТАРШЕ догадок по имени. Раньше regex
  // проверялся первым, и `подъём` в нём переводил в «изоляцию» многосуставные
  // движения («Подъём на грудь» = clean, «Подъём ног в висе», «Турецкий подъём»,
  // «Махи гирей» = swing). Regex остаётся fallback'ом — для имён вне каталога.
  const catalog = EXERCISE_CATALOG.find(item => item.name === ex.name || item.id === ex.exerciseName);
  if (catalog) return catalog.type === 'compound';
  if (ISOLATION_RE.test(n)) return false; // isolation never treated as compound, even if role=primary
  if (ex.role === 'primary') return true;
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
  const rawW = ex.workSets?.[0]?.weight ?? 0;
  const w = Number.isFinite(rawW) ? rawW : 0;
  const rawRir = ex.rir ?? 2;
  const rir = Number.isFinite(rawRir) ? rawRir : 2;
  return -w + rir * 10; // больше вес → меньше ранг (раньше); меньше RIR → раньше
}

/* ───────────────────────── Главная функция порядка ───────────────────────── */

export type SessionMethodology = 'compound_first' | 'pre_exhaust' | 'post_exhaust' | 'mountain_dog' | 'fst7' | 'hyperemia';

export interface OrderOpts {
  sessionTag?: string;
  /** Основная мышца дня (первая в TAG_MUSCLES[tag]); если тег неизвестен — вычисляется. */
  primaryMuscle?: string;
  /** Методика порядка. compound_first — базовые раньше изоляции (по умолчанию).
   *  pre_exhaust — изоляция основной мышцы ПЕРВОЙ (предварительное утомление), затем compound.
   *  post_exhaust — compound, затем изоляция (то же что compound_first, явно).
   *  mountain_dog (Meadows): лёгкая активация (изоляция RIR≥3) → тяжёлый compound →
   *  памп → loaded stretch последним. Активация — НЕ предутомление (не в отказ).
   *  fst7 (Rambod): как compound_first, но ВСЕ памп-изоляции основной мышцы —
   *  финишеры в самом конце (7-сетовый финиш).
   *  hyperemia (Sarcev): у аксессуаров памп идёт раньше тяжестей (кровь первее
   *  веса), финишеры и стретч — в конце. */
  methodology?: SessionMethodology;
  /** Дополнительный приоритет мышц, которые должны получить первый качественный стимул. */
  priorityMuscles?: string[];
  /**
   * O-1 (итерация B): слабая/фокус-мышца, у которой в сессии есть compound.
   * Её compound получает уровень приоритета между «мышцей дня» и остальными:
   * идёт раньше изоляций и аксессуаров других мышц, но не отменяет мышцу дня.
   * Изоляция слабой мышцы без compound порядок НЕ меняет (изоляция не должна
   * опережать тяжёлый compound другой мышцы).
   */
  leadMuscles?: string[];
  /**
   * O-2 (итерация D): чередование мышц для FullBody/Torso — «круг» вместо
   * группировки (chest→back→legs→chest→back→legs). Внутри круга тяжёлые базы
   * идут первым round'ом, изоляции — вторым.
   */
  interleave?: boolean;
  /** O-4: учитывать аксиальную стоимость как тай-брейк внутри одной мышцы/tier. */
  axialAware?: boolean;
  /**
   * Цель мезоцикла: масса/сушка/рекомп/поддержание/сила-масса.
   * Влияет только на порядок, не на объём:
   *  - strength_mass: ПЛ-спецификации (пауза/доски/цепи) ведут compounds;
   *  - cut/recomp: тяжёлые осевые движения раньше лёгкой изоляции (свежий ЦНС).
   */
  goal?: 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
}

export function orderSessionExercises(exercises: BBExercise[], opts: OrderOpts = {}): BBExercise[] {
  if (exercises.length <= 1) return exercises.slice();
  // Разминочные упражнения (warmupActivator) — всегда первые в дне, вне очереди основной сортировки.
  // Чтобы методика compound_first/pre_exhaust и мышечная приоритизация не сдвигали разминку,
  // отделяем её до вычисления primaryMuscle и сортировки.
  const warmups = (exercises as any[]).filter((ex: any) => !!ex.warmupActivator);
  const rest = (exercises as any[]).filter((ex: any) => !ex.warmupActivator);
  if (warmups.length && rest.length === 0) return warmups.slice() as BBExercise[];
  const forOrder: BBExercise[] = warmups.length ? (rest as BBExercise[]) : exercises;
  if (forOrder.length <= 1) return warmups.length ? ([...warmups, ...forOrder] as BBExercise[]) : forOrder.slice();
  const tagMuscles = TAG_MUSCLES[opts.sessionTag || ''] || [];
  // Основная мышца дня: явная опция → первая из тега → иначе мышца первого primary+тяж.
  // BUG-B11: для FullBody НЕ берём tagMuscles[0] (всегда 'chest' → день ног начинается с груди).
  // Вместо этого ищем первый primary+тяж exercise — он отражает реальную primary-мышцу дня.
  const isFullBody = (opts.sessionTag || '') === 'FullBody';
  let primaryMuscle: string;
  if (opts.primaryMuscle) {
    primaryMuscle = opts.primaryMuscle;
  } else if (isFullBody) {
    // FB: primary = первый primary+тяж exercise из списка (отражает fbSchedule из buildBBPlan).
    // Если primary-слотов нет (fullbody_3/2/4/5 — дни собраны из аксессуаров),
    // ведём день от первого КОМПАУНДА, а не от первой изоляции: иначе
    // FullBody начинался с разгибания ног/подъёма на носки, а тяга/жим
    // оставались в середине сессии.
    const firstPrimary = forOrder.find(e => e.role === 'primary' && (e as any).character === 'тяж');
    const firstCompound = forOrder.find(e => isCompoundEx(e) && (e as any).character === 'тяж')
      || forOrder.find(e => isCompoundEx(e));
    primaryMuscle = firstPrimary?.muscle || firstCompound?.muscle || forOrder.find(e => e.role === 'primary')?.muscle || '';
  } else {
    // ★ Arms day: triceps первым (compound-first — больше мышечная масса, жим узким хватом),
    // не biceps (tagMuscles[0]='biceps').
    const tag = opts.sessionTag || '';
    if (tag === 'Arms') primaryMuscle = 'triceps';
    else if (tag === 'Glutes' || tag === 'GlutesHams') {
      // Специализированный glute-день: ягодицы — ведущая мышца по определению
      // тега, даже если хамстринги/квадрицепсы набрали больше тяжёлых сетов.
      // Раньше heavy-tie-break ставил hamstrings первым, и ягодицы уезжали
      // в конец сессии (female_glute_3/female_glute_5/female_lower_upper_4).
      const hasGlutes = forOrder.some(e => collapseMuscle(e.muscle || '') === 'glutes');
      if (hasGlutes) primaryMuscle = 'glutes';
      else {
        let heavy: string | null = null;
        let bestScore = -1;
        for (const cand of ['quads', 'hamstrings']) {
          const score = forOrder.filter(e => e.muscle === cand && (e as any).character === 'тяж').reduce((s, e) => s + (e.sets || 0), 0);
          if (score > bestScore) { bestScore = score; heavy = cand; }
        }
        primaryMuscle = heavy || tagMuscles[0] || 'glutes';
      }
    }
    else if (tag === 'Legs' || tag === 'Lower' || tag === 'LowerPower' || tag === 'LowerHyp') {
      // Ноги: тяжёлая мышца дня должна идти первой.
      // Раньше quads всегда был primary (присед перед RDL), но в день
      // бицепса бедра памп-квадрицепс стоял ПЕРЕД тяжёлым бицепсом бедра.
      // Определяем тяжёлую мышцу по факту упражнений (характер 'тяж').
      let heavy: string | null = null;
      let bestScore = -1;
      for (const cand of ['quads', 'hamstrings', 'glutes']) {
        // Только КОМПАУНДЫ: тяжёлая изоляция (кикбэк/мост-изоляция) не должна
        // объявлять свою мышцу «мышцей дня» и уводить день в изоляцию вперёд базы.
        const score = forOrder.filter(e => e.muscle === cand && (e as any).character === 'тяж' && isCompoundEx(e)).reduce((s, e) => s + (e.sets || 0), 0);
        if (score > bestScore) { bestScore = score; heavy = cand; }
      }
      if (heavy && bestScore > 0) primaryMuscle = heavy;
      else {
        const hasHamHeavy = forOrder.some(e => e.muscle === 'hamstrings' && (e as any).character === 'тяж');
        const hasQuadHeavy = forOrder.some(e => e.muscle === 'quads' && (e as any).character === 'тяж');
        if (hasHamHeavy && !hasQuadHeavy) primaryMuscle = 'hamstrings';
        else primaryMuscle = tagMuscles[0] || 'quads';
      }
    }
    else primaryMuscle = tagMuscles[0] || '';
  }
  if (!primaryMuscle) {
    const firstHeavy = forOrder.find(e => e.role === 'primary' && (e as any).character === 'тяж');
    primaryMuscle = firstHeavy?.muscle || forOrder.find(e => e.role === 'primary')?.muscle || forOrder[0]?.muscle || '';
  }
  const tagMuscleSet = new Set(tagMuscles.map(m => collapseMuscle(m)));

  const methodology = opts.methodology || 'compound_first';
  const goal = opts.goal;
  const priorityMuscles = new Set((opts.priorityMuscles || []).map(collapseMuscle));
  // O-1: lead-мышца учитывается только если у неё в сессии есть compound
  // (иначе изоляция слабой мышцы обошла бы тяжёлый compound другой мышцы).
  const leadCandidates = new Set((opts.leadMuscles || []).map(collapseMuscle));
  const leadMuscles = new Set(
    [...leadCandidates].filter(m => forOrder.some(e => collapseMuscle(e.muscle || '') === m && isCompoundEx(e))),
  );
  // O-2: номер упражнения этой мышцы в сессии (для «кругового» чередования).
  const occSeen: Record<string, number> = {};
  const occIndex = forOrder.map(e => {
    const m = collapseMuscle(e.muscle || '');
    const idx = occSeen[m] || 0;
    occSeen[m] = idx + 1;
    return idx;
  });
  const ctx: RankCtx = {
    primaryMuscle,
    tagMuscleSet,
    methodology,
    priorityMuscles,
    leadMuscles,
    interleave: !!opts.interleave,
    axialAware: !!opts.axialAware,
    goal,
  };
  const indexed = forOrder.map((ex, idx) => ({ ex, idx, key: rankKey(ex, ctx, occIndex[idx]) }));
  // Лексикографическое сравнение кортежа.
  indexed.sort((a, b) => {
    const ka = a.key, kb = b.key;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return a.idx - b.idx; // стабильность при полном равенстве
  });
  const sortedRest = indexed.map(x => x.ex);
  // Правило №1 модуля: compound раньше изоляции. Кортеж группирует мышцы и в
  // FB/Legs может поставить изоляцию «мышцы дня» (или первую изоляцию списка)
  // перед базой другой мышцы. Один финальный перенос ведущего компаунда
  // выправляет первый слот, не перетасовывая остальную сессию.
  // Методики, где изоляция-праймер намеренно первая, не трогаем.
  const isolationFirstMethod = methodology === 'pre_exhaust' || methodology === 'mountain_dog'
    || methodology === 'fst7' || methodology === 'hyperemia';
  if (!isolationFirstMethod) {
    const gluteDay = /Glutes/i.test(opts.sessionTag || '');
    const leadIdx = sortedRest.findIndex(e => isMajorLeadCompound(e)
      && (!gluteDay || collapseMuscle(e.muscle || '') === 'glutes'));
    if (leadIdx > 0) sortedRest.unshift(sortedRest.splice(leadIdx, 1)[0]);
  }
  return warmups.length ? ([...warmups, ...sortedRest] as BBExercise[]) : sortedRest;
}

/**
 * Кортеж приоритета (лексикографический):
 *  [0] isPrimaryFlag:  0 = мышца дня (primaryMuscle) — ВСЕГДА первая
 *  [1] muscleGroup:     упражнения ОДНОЙ мышцы строго вместе (MUSCLE_ORDER)
 *  [2] priorityFlag:    weak/focus мышца внутри своей группы — раньше изоляций
 *  [3] tier:            0 = основное тяжёлое, 1 = compound, 2 = изоляция, 3 = финишь
 *  [4] subOrder:         для compound — pressPosition; для изоляции — stretchRank; ПЛ-специфика +50
 *  [5] load:             тяжелее / меньше RIR — раньше
 */

/** Loaded stretch / extreme stretch — всегда последний (Meadows фаза 4, DC). */
function isStretchHolder(name: string): boolean {
  return /растяж|stretch|вис(?!.*тяга)|extreme.*stretch|hold.*(30|60)|пауза.*внизу/i.test((name || '').toLowerCase());
}

/**
 * O-4: аксиальная (системная) стоимость движения, 0-2.
 * Используется как тай-брейк внутри одной мышцы/tier: более осевое — раньше,
 * чтобы тяжёлая осевая работа не выполнялась на уставшем коре. Глобально
 * порядок мышц НЕ переписывается (группировка мышц остаётся, см. rankKey).
 */
export function axialCostOf(name: string): number {
  const n = (name || '').toLowerCase();
  if (/становая|deadlift|сумо.*тяга|good.?morning|наклон.*штанга.*тяга|швунг|power.?clean|толчок/i.test(n)) return 2;
  if (/присед|squat|выпад|lunge|жим.*стоя|overhead.?press|армейск|тяга.*наклон|bent.?over|т-образн|t-bar|hip.?thrust|румынск|rdl/i.test(n)) return 1;
  return 0;
}

interface RankCtx {
  primaryMuscle: string;
  tagMuscleSet: Set<string>;
  methodology: SessionMethodology;
  priorityMuscles: Set<string>;
  leadMuscles: Set<string>;
  interleave: boolean;
  axialAware: boolean;
  goal?: 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
}

/** Порядок мышц в сессии: см. MUSCLE_ORDER вверху файла (каноника). */
function rankKey(ex: BBExercise, ctx: RankCtx, occIndex = 0): number[] {
  const { primaryMuscle, methodology, priorityMuscles, leadMuscles, interleave, axialAware, goal } = ctx;
  const exMuscle = collapseMuscle(ex.muscle || '');
  const isPrimaryMuscle = exMuscle === collapseMuscle(primaryMuscle);
  const compound = isCompoundEx(ex);
  const isPrimaryHeavy = ex.role === 'primary' && ex.character === 'тяж' && compound;
  const plSpec = isPLSpec(ex.name || '');
  const isFinisher = ex.role === 'accessory' && !compound && (ex.character === 'памп' || (ex.workSets?.[0]?.reps ?? 0) >= 12);

  // In pre-exhaust, a primary-muscle pump isolation is still the pre-fatigue
  // movement, not a finisher that belongs at the end.
  const isPrimaryIsolation = isPrimaryMuscle && !compound;
  // Силовой мезоцикл: ПЛ-специфика (пауза/доски/цепи/дефицит) — это главное
  // движение дня, а не «в конец compounds»: tier 0 и ранний subOrder.
  const strengthSpec = goal === 'strength_mass' && plSpec && compound;
  const exRir = Number.isFinite(ex.rir as number) ? (ex.rir as number) : 2;
  let tier: number;
  if (methodology === 'pre_exhaust' && isPrimaryIsolation) tier = -1;
  // P2-9 (audit 2026-08): post_exhaust — изоляция primary мышцы идёт СРАЗУ после compound
  // (tier=1, приоритетнее других изоляций). Раньше post_exhaust = compound_first без различий.
  else if (methodology === 'post_exhaust' && isPrimaryIsolation) tier = 1;
  // mountain_dog (Meadows): лёгкая активация (изоляция primary, RIR≥3 — НЕ в отказ)
  // первой, loaded stretch — последним. Остальное как compound_first.
  else if (methodology === 'mountain_dog' && isStretchHolder(ex.name || '')) tier = 4;
  else if (methodology === 'mountain_dog' && isPrimaryIsolation && exRir >= 3) tier = -0.5;
  // fst7 (Rambod): лёгкий памп-праймер основной мышцы (RIR≥3, не в отказ)
  // — front-loading the sevens (продвинутый вариант), loaded stretch — последним.
  // Основной 7-сетовый финишер и так последний через isFinisher (tier 3).
  else if (methodology === 'fst7' && isStretchHolder(ex.name || '')) tier = 4;
  else if (methodology === 'fst7' && isPrimaryIsolation && exRir >= 3 && ex.character !== 'тяж') tier = -0.5;
  else if (isFinisher) tier = 3;
  else if (isPrimaryHeavy || strengthSpec) tier = 0;
  else if (compound) tier = 1;
  else tier = 2;

  // Приоритет-уровень: мышца дня и lead-мышца (со своим compound) образуют
  // один «первый» блок; остальные — после. O-1: lead НЕ отменяет мышцу дня, но
  // её база встаёт ВНУТРИ блока мышцы дня по tier — то есть раньше изоляций
  // (tier 2) и финишёров (tier 3) этой же мышцы. Это и есть обещание
  // «отстающая мышца — раньше», не ломающее группировку дня.
  const leadApplies = !isPrimaryMuscle && leadMuscles.has(exMuscle) && compound;
  const priorityLevel = (isPrimaryMuscle || leadApplies) ? 0 : 1;
  const priorityFlag = priorityMuscles.has(exMuscle) ? 0 : 1;
  // muscleGroup: внутри primary/не-primary — группировка по мышце.
  // ВАЖНО: muscleGroup идёт ДО priorityFlag — все упражнения одной мышцы
  // должны идти ПОДРЯД. Если priorityFlag раньше, weak-упражнение другой
  // мышцы вклинивается между группами (ноги-спина-ноги), ломая сессию.
  const primaryGroup = MUSCLE_ORDER[collapseMuscle(primaryMuscle)] ?? 12;
  const muscleGroup = (isPrimaryMuscle || leadApplies) ? primaryGroup : (MUSCLE_ORDER[exMuscle] ?? 12);

  // Характер нагрузки: тяж (0) всегда перед памп (1) и лёг (2) даже внутри одного tier (GVT vs тяжёлые махи).
  // hyperemia (Sarcev): у аксессуаров наоборот — кровь первее веса, памп раньше тяжестей.
  const charRank = methodology === 'hyperemia' && !compound
    ? (ex.character === 'памп' ? 0 : ex.character === 'лёг' ? 1 : 2)
    : (ex.character === 'тяж' ? 0 : ex.character === 'памп' ? 1 : 2);
  let subOrder: number;
  if (tier === 2) subOrder = stretchRank(ex.name || '');
  else if (compound) subOrder = isPress(ex.name || '') ? pressPositionRank(ex.name || '', primaryMuscle) : 0;
  else subOrder = 0;
  if (plSpec) subOrder += strengthSpec ? -20 : 50;

  const load = loadRank(ex);
  // O-4: тай-брейк по аксиальной стоимости. Срабатывает только для ПАРЫ
  // максимально осевых движений (становая/good morning, cost 2) — остальное
  // остаётся байт-в-байт: доказательная база у этого правила тонкая, и
  // перетасовка «присед ↔ жим ногами» меняла бы распределение бюджета сетов.
  // На сушке/рекомпе усталость переносится хуже: тяжёлое осевое движение
  // должно идти на свежую ЦНС, даже если cost 1 vs 0.
  const axialBase = axialAware ? axialCostOf(ex.name || '') : 0;
  const axial = axialAware
    ? -(goal === 'cut' || goal === 'recomp' ? axialBase : Math.max(0, axialBase - 1))
    : 0;
  if (interleave) {
    // O-2 (FullBody): «круги» — первый круг = тяжёлые базы всех мышц,
    // второй = изоляции/аксессуары; внутри круга чередование по числу
    // выполненных упражнений этой мышцы (chest→back→legs→chest→…).
    const bucket = (isPrimaryMuscle || (compound && ex.character === 'тяж')) ? 0 : 1;
    return [bucket, occIndex, muscleGroup, priorityFlag, tier, charRank, subOrder, axial, load];
  }
  return [priorityLevel, muscleGroup, priorityFlag, tier, charRank, subOrder, axial, load];
}

function collapseMuscle(m: string): string {
  if (m === 'delt_front' || m === 'delt_mid' || m === 'delt_rear') return 'shoulders';
  if (m === 'lower_back') return 'core';
  return m;
}

/** Компаунд крупной мышцы, который может вести сессию. abs/икры/предплечья —
 *  не ведущие: их «компаунд» (скручивание/подъём ног) не должен вставать перед
 *  жимом/тягой. */
function isMajorLeadCompound(ex: BBExercise): boolean {
  if (!isCompoundEx(ex)) return false;
  const m = collapseMuscle(ex.muscle || '');
  return m === 'chest' || m === 'back' || m === 'quads' || m === 'hamstrings'
    || m === 'glutes' || m === 'shoulders' || m === 'legs';
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

// === BB-cycle tidy pass (used by programToBBPlan / convertCycleToBBPlan) ===
// Library/cycle plans previously kept a crude order (role-only sort or none), which produced
// illogical sequences (triceps before chest, 4 shrugs in one day). This gives them the same
// coaching-grade sequencing as generic_split buildBBPlan: compound -> isolation, day's
// primary muscle first, horizontal press before vertical, isolation from lengthened position.
export const SESSION_TIDY_RATIONALE = "Exercise order rebuilt (compound -> isolation, day primary muscle first, redundant per-muscle exercises capped).";

const MUSCLE_EX_CAP: Record<string, number> = {
  traps: 2, calves: 2, forearms: 2, abs: 3, core: 3,
  biceps: 3, triceps: 3, arms: 3,
  delt_rear: 2, delt_front: 2, delt_mid: 2,
  shoulders: 4, chest: 4, back: 4, quads: 4, hamstrings: 4, glutes: 4, legs: 4,
};

// Keep at most N exercises per muscle in a session (anti-spam: 4 shrugs -> 2).
// Ranks by primary role then heavier load; preserves original input order in output.
// backCap: опытный enhanced (6+ лет) с про-объёмом спины получает до 6 паттернов —
// cap 4 срезал бы vertical/lat-работу после allocation (паттерны, не сеты).
export function capExercisesPerMuscle(exercises: BBExercise[], backCap = 4): BBExercise[] {
  // Разминка (warmupActivator) не участвует в капе и никогда не удаляется капом.
  const warmups = (exercises as any[]).filter((e: any) => !!e.warmupActivator);
  const rest = (exercises as any[]).filter((e: any) => !e.warmupActivator) as BBExercise[];
  if (!rest.length) return exercises.slice();
  const ranked = rest.map((ex, i) => ({ ex, i }));
  ranked.sort((a, b) => {
    const ra = (a.ex.role === "primary" ? 0 : 1) - (b.ex.role === "primary" ? 0 : 1);
    if (ra !== 0) return ra;
    const wa = a.ex.workSets?.[0]?.weight ?? 0;
    const wb = b.ex.workSets?.[0]?.weight ?? 0;
    if (wb !== wa) return wb - wa;
    return a.i - b.i;
  });
  const counts: Record<string, number> = {};
  const keep = new Set<BBExercise>();
  for (const { ex } of ranked) {
    const m = ex.muscle || "";
    const cap = m === 'back' ? backCap : (MUSCLE_EX_CAP[m] ?? 4);
    if ((counts[m] || 0) >= cap) continue;
    counts[m] = (counts[m] || 0) + 1;
    keep.add(ex);
  }
  const keptRest = rest.filter((e) => keep.has(e as any));
  return warmups.length ? ([...warmups, ...keptRest] as BBExercise[]) : keptRest;
}

// Cap redundancy then apply coaching-grade ordering for a session.
// sessionTag preferred — lets orderSessionExercises derive primaryMuscle from TAG_MUSCLES
// (chest for ChestBack, back for Pull, etc.). Falls back to explicit primaryMuscle.
// P0-1 (audit 2026-08): добавлен параметр methodology — ранее хардкодился "compound_first",
// что сбрасывало выбор пользователя (pre_exhaust/post_exhaust) в finalizeBBPlan для
// cycle/program путей. По умолчанию остаётся compound_first (обратная совместимость).
export function tidySessionExercises(
  exercises: BBExercise[],
  primaryMuscle?: string,
  sessionTag?: string,
  priorityMuscles?: string[],
  methodology?: SessionMethodology,
  backCap?: number,
  goal?: OrderOpts['goal'],
): BBExercise[] {
  const capped = capExercisesPerMuscle(exercises, backCap);
  return orderSessionExercises(capped, { primaryMuscle, sessionTag, methodology: methodology || "compound_first", priorityMuscles, goal });
}

/* ─────────────── O-5: объяснение порядка (карточка сессии в плане) ─────────────── */

/** Русские короткие имена мышц — общий словарь для текстов плана/печати. */
export const MUSCLE_RU_SHORT: Record<string, string> = {
  chest: 'грудь', back: 'спина', shoulders: 'плечи', quads: 'квадрицепс',
  hamstrings: 'бицепс бедра', glutes: 'ягодицы', legs: 'ноги', calves: 'икры',
  biceps: 'бицепс', triceps: 'трицепс', forearms: 'предплечья', traps: 'трапеция',
  abs: 'пресс', core: 'кор', lower_back: 'поясница', arms: 'руки',
};

/**
 * Человеческое объяснение того, что видит пользователь в списке упражнений.
 * Чистая функция: те же данные, что у `orderSessionExercises`, без побочных
 * эффектов — вызывается в UI на уже отсортированном массиве.
 */
export function explainSessionOrder(exercises: BBExercise[], opts: OrderOpts = {}): string[] {
  if (!exercises?.length) return [];
  const notes: string[] = [];
  const warm = exercises.filter(e => (e as any).warmupActivator).length;
  if (warm) notes.push(`🔥 Разминочный активатор первым (${warm}) — вне зачётного объёма.`);
  const spec = methodologySpecFor(opts.methodology);
  notes.push(`📐 ${spec.labelRu}: ${spec.orderNote}`);
  if (spec.protocolLine) notes.push(`📋 Протокол: ${spec.protocolLine}`);
  const lead = [...new Set((opts.leadMuscles || []).map(collapseMuscle))];
  const leadWithCompound = lead.filter(m => exercises.some(e => collapseMuscle(e.muscle || '') === m && isCompoundEx(e)));
  if (leadWithCompound.length) {
    const names = leadWithCompound.map(m => MUSCLE_RU_SHORT[m] || m).join(', ');
    notes.push(`🎯 Приоритет: ${names} — база этой мышцы идёт раньше изоляций других мышц (упражнение, выполненное первым, растёт в силе быстрее: Nunes 2020).`);
  }
  if (opts.interleave) {
    notes.push('🔁 Круги (full-body / верх тела): упражнения чередуются по мышцам — локальная усталость не копится, каждая мышца получает свежий подход.');
  }
  const heavyAxial = exercises.filter(e => axialCostOf(e.name || '') >= 2).length;
  if (heavyAxial >= 2) {
    notes.push('⚠ В дне два тяжёлых осевых движения: второе — с запасом 2-3 повтора, не в отказ (валидатор предупредит об аксиальной усталости).');
  }
  if (exercises.some(e => isStretchHolder(e.name || ''))) {
    notes.push('🧘 Loaded stretch — последним: растяжение под нагрузкой после объёма, а не вместо него.');
  }
  return notes;
}

/* ─────────── «Практический бодибилдинг»: слот-объяснение и блоки суперсетов ─────────── */

/**
 * §6.3 (решение практики): «круги» (interleave) нужны в многомышечных днях —
 * full-body и верх тела (`Torso`: грудь/спина/дельты/руки). В сплит-днях
 * (Push/Pull/Legs) мышцы уже сгруппированы, и перестановка только мешает
 * прогресс-контролю.
 *
 * Условие включения: в дне ≥3 разных мышц и хотя бы одна мышца стоит 2+ раза.
 * Если каждая мышца в дне одна, «круг» вырождается в обычную группировку.
 */
export function shouldInterleave(sessionTag: string | undefined, exercises: Array<{ muscle?: string }>): boolean {
  const tag = String(sessionTag || '');
  if (tag !== 'FullBody' && tag !== 'Torso') return false;
  const counts: Record<string, number> = {};
  for (const e of exercises || []) {
    const m = collapseMuscle(e?.muscle || '');
    if (m) counts[m] = (counts[m] || 0) + 1;
  }
  const values = Object.values(counts);
  return Object.keys(counts).length >= 3 && values.some(c => c >= 2);
}

/**
 * §8 (практический бодибилдинг): суперсет — это ОДИН блок, а не «бейдж рядом с
 * разнесёнными упражнениями». Финализатор помечает пары `supersetGroup/slot`, но
 * финальный порядок по мышцам может развести антагонистов (грудь ↔ спина).
 * Плеер обязан выполнять A1 → B1 подряд, поэтому перед выдачей в плеер список
 * собирается по группам: группа встаёт на месте своего первого участника,
 * порядок остальных упражнений сохраняется.
 */
export function arrangeSupersetBlocks<T extends { supersetGroup?: number | null; supersetSlot?: number | null }>(list: T[]): T[] {
  if (!Array.isArray(list) || list.length < 2) return list;
  if (!list.some(x => x && x.supersetGroup != null)) return list;
  const out: T[] = [];
  const emitted = new Set<number>();
  for (const item of list) {
    const g = item && item.supersetGroup != null ? Number(item.supersetGroup) : null;
    if (g == null) { out.push(item); continue; }
    if (emitted.has(g)) continue;
    emitted.add(g);
    const group = list
      .filter(x => x && Number(x.supersetGroup) === g)
      .sort((a, b) => Number(a?.supersetSlot ?? 0) - Number(b?.supersetSlot ?? 0));
    out.push(...group);
  }
  return out;
}

export interface OrderSlotExplanation {
  /** 0-based позиция в уже отсортированном списке. */
  index: number;
  name: string;
  muscle: string;
  /** Почему упражнение стоит ИМЕННО здесь (не общее правило дня). */
  reason: string;
}

/**
 * §8: объяснение «почему это упражнение на этом месте», а не списка правил.
 * Чистая функция: принимает уже отсортированный массив и его опции порядка.
 */
export function explainSessionOrderPerExercise(exercises: BBExercise[], opts: OrderOpts = {}): OrderSlotExplanation[] {
  if (!exercises?.length) return [];
  const methodology = opts.methodology || 'compound_first';
  const primary = collapseMuscle(opts.primaryMuscle || '');
  const lead = new Set((opts.leadMuscles || []).map(collapseMuscle));
  const out: OrderSlotExplanation[] = [];
  exercises.forEach((ex, index) => {
    const rawName = String(ex.exerciseName || ex.name || '');
    const muscle = collapseMuscle(ex.muscle || '');
    const ru = MUSCLE_RU_SHORT[muscle] || ex.muscle || 'мышца';
    const compound = isCompoundEx(ex);
    const isPrimary = !!primary && muscle === primary;
    const isHeavy = ex.role === 'primary' && (ex as any).character === 'тяж' && compound;
    const isSuperset = (ex as any).supersetGroup != null;
    let reason: string;
    if ((ex as any).warmupActivator) {
      reason = 'разминочный активатор — первым, вне зачётного объёма';
    } else if (methodology === 'pre_exhaust' && isPrimary && !compound) {
      reason = 'предутомление: изоляция до базы — ощущение мышцы и техника, а не «больше роста» (Gentil 2014)';
    } else if (methodology === 'post_exhaust' && isPrimary && !compound) {
      reason = 'добивка сразу после базы: тот же бюджет времени, больше работы в целевой мышце';
    } else if (isStretchHolder(rawName)) {
      reason = 'loaded stretch — последним: растяжение под нагрузкой после объёма';
    } else if (methodology === 'fst7' && ex.role === 'accessory' && !compound) {
      reason = 'FST-7-финишер: серия коротких подходов в конце — памп и объём одной мышцей, без осевой усталости';
    } else if (isHeavy) {
      reason = isPrimary
        ? `тяжёлая база дня (${ru}) — силовое движение на свежих мышцах: первое упражнение растёт в силе быстрее (Nunes 2020)`
        : lead.has(muscle)
          ? `база приоритетной мышцы (${ru}) — слабую мышцу ставим туда, где ещё есть сила`
          : `тяжёлая база (${ru}) — после мышцы дня, но до изоляций`;
    } else if (compound) {
      reason = lead.has(muscle)
        ? `базовое приоритетной мышцы (${ru}) — раньше изоляций остальных мышц`
        : `базовое (${ru}) — раньше изоляций: больше мышц в работе, меньше локальной усталости`;
    } else {
      reason = `изоляция (${ru}) — после базовых: добирает объём без осевой усталости`;
    }
    if (isSuperset) reason += ' · в суперсете A1→B1, без отдыха между подходами';
    out.push({ index, name: rawName, muscle, reason });
  });
  return out;
}
