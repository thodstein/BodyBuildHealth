/**
 * Канонический расчёт объёма ББ-плана.
 *
 * Direct sets отражают прямой target упражнения, effective sets добавляют
 * консервативную долю вторичной работы от compound-движений. Это не замена
 * локальной MRV-модели, а единый слой агрегации для генератора и метрик.
 */
import { trueMuscleOf } from '../movement-pattern';
import { MUSCLE_LABEL_RU } from '../volume-landmarks.engine';

export type BBVolumeKind = 'direct' | 'effective';

/**
 * Волна-2.6 (аудит 2026-09): ЕДИНЫЙ допуск MRV для всех точек конвейера —
 * валидатор (overflow), cap-adjust финализатора, MRV-трим, per-muscle сессионные
 * потолки. Раньше cap-adjust резал по локальному ×1.05, строже валидатора ×1.15:
 * план «зелёный», но урезанный. Канон живёт здесь (bb-volume), validator
 * ре-экспортирует для обратной совместимости.
 */
export const BB_MRV_TOLERANCE = 1.15;

const ALIASES: Record<string, string> = {
  delts: 'shoulders',
  arms: 'arms',
  legs: 'legs',
  core: 'abs',
};

export function normalizeBBMuscle(muscle: string | null | undefined): string {
  const value = String(muscle || '').toLowerCase().trim();
  return ALIASES[value] || value;
}

/**
 * Мышцы, которые НЕ входят в общий недельный бюджет восстановления и MRV-кап.
 * Они программируются своим минимумом, но не конкурируют за системную нагрузку.
 * (икры/пресс/предплечья/шея).
 */
export const IGNORE_BUDGET_MUSCLES: ReadonlySet<string> = new Set(['calves', 'abs', 'forearms', 'neck']);

/**
 * Вторичные мышцы — фиксированные бэнды, НЕ масштабируются ×2 на курсе.
 * По модели пользователя это именно ТРАПЕЦИЯ (5 сетов/сессию). Дельты/руки —
 * полноценные мышцы, они масштабируются режимом.
 */
export const SECONDARY_FIXED_MUSCLES: ReadonlySet<string> = new Set(['traps']);

/**
 * Единый множитель режима (ПЕД/курс).
 * - натурал: ×1.0
 * - на курсе: ×2.0 на ГЛАВНЫЕ мышцы + недельный бюджет (одно применение, без стэкинга)
 * Вторичные мышцы (SECONDARY_FIXED_MUSCLES) и игнор-мышцы НЕ умножаются.
 */
export function computeRegimeMrvMult(input: {
  onCourse?: boolean;
  peds?: string[];
  courseIntensity?: string;
}): number {
  const onCourse = input.onCourse || (Array.isArray(input.peds) && input.peds.length > 0);
  if (!onCourse) return 1.0;
  // Базовый ×2. Тяжёлая интенсивность курса — чуть выше (×2.05-2.1).
  const intensity = input.courseIntensity === 'heavy' ? 1.06 : input.courseIntensity === 'mild' ? 0.98 : 1.0;
  return Math.min(2.15, Math.max(1.9, 2.0 * intensity));
}

export function regimeMrvMultFor(muscle: string, regimeMult: number): number {
  const m = normalizeBBMuscle(muscle);
  if (IGNORE_BUDGET_MUSCLES.has(m)) return 1.0;
  if (SECONDARY_FIXED_MUSCLES.has(m)) return 1.0;
  return regimeMult;
}

/**
 * Фаза 2.11: ЕДИНЫЙ конвейер MRV-множителя режима.
 *
 * Устраняет риск двойного масштабирования: раньше per-muscle caps использовали
 * ПЛОСКИЙ ×2.0 (computeRegimeMrvMult), а landmarks/валидация — дозо-зависимые
 * кривые adaptForPEDs (combinedMrvMultiplier, ×1.3–2.0). Два механизма расходились
 * (лёгкий курс: caps ×2.0, landmarks ×1.3 → ложные MRV-overflow).
 *
 * Теперь PED-кривые (doseAwareMrv = adaptForPEDs().combinedMrvMultiplier) — ВХОД в
 * единый множитель: если передан doseAwareMrv (на курсе), режим-множитель отслеживает
 * кривую, а не плоское ×2.0. Без doseAwareMrv — прежнее плоское поведение.
 */
export function computeMrvMult(input: {
  onCourse?: boolean;
  peds?: string[];
  courseIntensity?: string;
  /** Дозо-зависимый MRV-множитель от adaptForPEDs (combinedMrvMultiplier). */
  doseAwareMrv?: number;
}): number {
  const onCourse = input.onCourse || (Array.isArray(input.peds) && input.peds.length > 0);
  if (!onCourse) return 1.0;
  const dose = Number(input.doseAwareMrv);
  if (Number.isFinite(dose) && dose > 1) {
    // Дозо-зависимая кривая adaptForPEDs: TRT 125 мг → ~1.1, лёгкий 250 → ~1.18,
    // средний 500 → ~1.30, мега-стек → до 2.15.
    // Аудит 2026-09: нижний флор 1.9 убивал дозо-зависимость (TRT получал ×1.9) —
    // флор снят, кривая непрерывна. Без doseAwareMrv — прежнее плоское ×2.0.
    return Math.min(2.15, dose);
  }
  return computeRegimeMrvMult(input);
}

/**
 * Единая оценка восстановления (0–100) из данных пользователя.
 * Неизвестные сигналы — нейтрально (не штрафуют).
 */
export function computeBBRecoveryScore(input: {
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  hrvBaseline?: number;
  sleepHours?: number;
  sleepQuality?: number;
  stressLevel?: number;
  subjectiveReadiness?: number;
  age?: number;
}): number {
  let score = 100;
  if (Number.isFinite(input.hrvMs)) {
    if (Number.isFinite(input.hrvBaseline) && (input.hrvBaseline as number) > 0) {
      const ratio = (input.hrvMs as number) / (input.hrvBaseline as number);
      if (ratio <= 0.8) score -= 20;
      else if (ratio <= 0.9) score -= 10;
    } else if ((input.hrvMs as number) > 70) score += 5;
    else if ((input.hrvMs as number) < 50) score -= 12;
  }
  if (Number.isFinite(input.sleepHours)) {
    const s = input.sleepHours as number;
    if (s >= 7) score += 5;
    else if (s >= 6) score -= 5;
    else score -= 15;
  }
  if (Number.isFinite(input.sleepQuality)) score += (input.sleepQuality as number >= 7 ? 3 : input.sleepQuality as number < 4 ? -5 : 0);
  if (Number.isFinite(input.stressLevel)) {
    const st = input.stressLevel as number;
    if (st >= 7) score -= 15;
    else if (st >= 4) score -= 5;
  }
  if (Number.isFinite(input.subjectiveReadiness)) {
    const r = input.subjectiveReadiness as number;
    if (r < 4) score -= 20;
    else if (r < 6) score -= 10;
  }
  if (Number.isFinite(input.bodyFat) && (input.bodyFat as number) > 25) score -= 8;
  if (Number.isFinite(input.leanMass) && (input.leanMass as number) < 60) score -= 8;
  if (Number.isFinite(input.age) && (input.age as number) >= 45) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Множитель восстановления из скора (0.6 – 1.3). */
export function recoveryScoreToMult(score: number): number {
  if (score >= 90) return 1.1;
  if (score >= 80) return 1.0;
  if (score >= 65) return 0.95;
  if (score >= 50) return 0.85;
  return 0.7;
}

/**
 * НЕДЕЛЬНЫЙ БЮДЖЕТ ВОССТАНОВЛЕНИЯ (общий кап, первичный).
 * база по режиму (натурал ~110 / курс ~220) × recovery × nutrition × lab.
 * Применяется ко ВСЕМ путям ББ-авто (кроме faithful-программы).
 */
export function computeBBWeeklyBudget(input: {
  onCourse?: boolean;
  peds?: string[];
  courseIntensity?: string;
  recoveryScore?: number;
  calorieSurplus?: number;
  proteinPerKg?: number;
  labMrvMultiplier?: number;
}): number {
  const regime = computeRegimeMrvMult(input);
  // База: натурал ~112, на курсе ~220 (× ~2). Вторичные/игнор-мышцы вне этого бюджета.
  const base = Math.round(112 * Math.max(1.0, regime));
  const rec = recoveryScoreToMult(input.recoveryScore ?? 80);
  const nutrition = computeBBNutritionMultiplier({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const lab = input.labMrvMultiplier ?? 1;
  return Math.round(base * rec * nutrition * lab);
}

/**
 * По-цикловые капы: НЕДЕЛЬНЫЙ бюджет общий, ПО-СЕССИОННЫЕ капы — производные от
 * сплита. Централизует 13 дублированных тернарников (24/40/60 сетов, 10/14/18
 * упражнений) в один источник. Значения по-сессионных капов сохранены (инварианты:
 * натурал ≤24/≤10, enhanced 60/18), чтобы не ломать существующие планы; недельный
 * бюджет — новое поле (общее восстановление).
 */
export function sessionLimitsFor(
  input: {
    onCourse?: boolean;
    peds?: string[];
    courseIntensity?: string;
    recoveryScore?: number;
    calorieSurplus?: number;
    proteinPerKg?: number;
    labMrvMultiplier?: number;
    level?: string;
    trainingYears?: number;
    trainingVolumeMode?: 'standard' | 'high';
  },
  split?: { id?: string; sessionGroups?: number },
): { weeklyWorkingSets: number; maxWorkingSets: number; maxExercises: number } {
  const weeklyWorkingSets = computeBBWeeklyBudget(input);
  const level = input.level || 'intermediate';
  const years = Number.isFinite(input.trainingYears) ? (input.trainingYears as number) : 0;
  const onCourse = input.onCourse || (Array.isArray(input.peds) && input.peds.length > 0);
  // Сохранённые по-сессионные капы (исходный тернарник 24/40/60 и 10/14/18) + high-объём +15-20%
  let maxWorkingSets: number; let maxExercises: number;
  if (level === 'enhanced' && years >= 3 || (onCourse && years >= 3)) {
    // Реализм сессии (аудит 2026-09): 65/20 и 60/18 давали Upper-дни по 18-20
    // упражнений («18 упражнений нереально даже для топ-уровня»). Потолок
    // пересобран под практику про-тренировок: 40-45 сетов / 15-16 упражнений —
    // при этом недельный объём держится частотой сплита (sessionMuscleRealismCap).
    maxWorkingSets = years >= 6 ? 44 : 40;
    maxExercises = years >= 6 ? 16 : 15;
  }
  else if (level === 'enhanced' || (onCourse && years >= 1)) { maxWorkingSets = 34; maxExercises = 13; }
  else { maxWorkingSets = 24; maxExercises = 10; }
  // PPL: сессия качает 4–5 групп (Pull: спина/задняя/трапы/бицепс/предплечья) —
  // в 24/10 не влезает даже на минимумах пользовательских требований
  // (bb-ppl-invariant: rear 5–8 + shrug 5 + biceps 8–10 + back + forearms).
  // Плюс пики intensification и низкочастотный ppl_3 (вся неделя спины в одной
  // сессии):observed max 35 сетов — кап 36/11 для натуралов (enhanced и так
  // выше); валидатор и лимитер читают этот же источник — рассинхрона нет.
  // patternId часто передают в input (тесты/валидатор вызывают без split) —
  // поддерживаем оба варианта, иначе PPL-ветка молча не срабатывает.
  const splitId = split?.id || (input as any).patternId || (input as any).splitId || '';
  const isPPL = /ppl/i.test(splitId);
  if (isPPL && maxWorkingSets < 36 && maxExercises < 11) {
    maxWorkingSets = 36;
    maxExercises = 11;
  }
  // FullBody: сессия качает 8-10 групп (против 4-5 у PPL) — в 10 упражнений
  // не влезает даже по одному движению на мышцу + руки (bb-focus-phase:
  // biceps 1×/нед — arm-guarantee добавлял, лимитер отрезал). Кап 12 для
  // натуралов (сеты держит maxWorkingSets + fitBBSessionToBudget + cap-adjust,
  // присутствие мышц сохраняется); валидатор и лимитер читают этот же источник.
  // Сеты 24→28: 12 мышц × пол 2 = 24 — минимум присутствия; двенадцатая мышца
  // или один 3-сетовик (25) иначе невозможны без синглов (count-benchmark).
  // PPL-прецедент: 24/10 → 36/11 по той же причине (плотные сессии).
  const isFB = /fullbody/i.test(splitId);
  if (isFB && maxExercises < 12) {
    maxExercises = 12;
  }
  if (isFB && maxWorkingSets < 28) {
    maxWorkingSets = 28;
  }
  if (input.trainingVolumeMode === 'high') {
    const isMaxExp = input.level === 'enhanced' && (input.trainingYears ?? 0) >= 6;
    maxWorkingSets = Math.round(maxWorkingSets * (isMaxExp ? 1.3 : 1.2));
    // Абсолютный кап реализма: даже объёмный режим не выходит за 18 упражнений
    // и 50 сетов (практический потолок тренажёрного дня ~2 часа).
    maxExercises = Math.min(18, maxExercises + (isMaxExp ? 3 : 2));
    maxWorkingSets = Math.min(50, maxWorkingSets);
  }
  return { weeklyWorkingSets, maxWorkingSets, maxExercises };
}

/** Shared recovery soft-cap used by every BB source. */
export function computeBBRecoveryMultiplier(input: {
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
}): number {
  let value = 1;
  if (input.bodyFat != null) value *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1;
  if (input.leanMass != null) value *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1 : 0.9;
  if (input.hrvMs != null) value *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1 : 0.85;
  if (input.sleepHours != null) value *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1 : 0.85;
  if (input.stressLevel != null) value *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1 : 0.85;
  return Math.max(0.6, Math.min(1.5, value));
}

/** Единый cap сетов на упражнение — про-правило, единственный источник (Фаза 2.5).
 *  Без флага onCourse — legacy (5; enhanced 3+ на главных — 8).
 *  BIG-ветка при явном onCourse===true: стаж 6+ — 10/8, 3+ — 8/6, 1+ — 6/5
 *  (главные/остальные). Сигнатура обратно совместима. */
export function perExerciseCap(level?: string, muscle?: string, trainingYears?: number, onCourse?: boolean): number {
  const m = (muscle || '').toLowerCase();
  const years = Number.isFinite(trainingYears) ? (trainingYears as number) : 0;
  // BIG-ветка только при явном onCourse===true (PED). Без флага — legacy,
  // чтобы не ломать существующие тесты (enhanced biceps 6 → 5).
  if (onCourse === true) {
    const isMain = ['back', 'chest', 'quads', 'hamstrings', 'legs', 'glutes', 'shoulders'].includes(m);
    if (years >= 6) return isMain ? 10 : 8;
    if (years >= 3) return isMain ? 8 : 6;
    if (years >= 1) return isMain ? 6 : 5;
    return isMain ? 6 : 5;
  }
  if (level === 'enhanced' && years >= 3 && ['back', 'chest', 'quads', 'hamstrings', 'legs'].includes(m)) return 8;
  return 5;
}

/** Единый cap сетов на мышцу за сессию — BIG с учётом level/стаж/PED.
 *  Заменяет хардкод min(5) в computeMuscleSets/buildSession, который убивал
 *  high-volume минимумы enhanced (спина 22, грудь 18, ноги 20 → все 5).
 *  Значения — потолок одной сессии, недельный объём = cap × частота + MRV-кап. */
export function perSessionMuscleCap(input: {
  level?: string;
  trainingYears?: number;
  onCourse?: boolean;
  muscle?: string;
}): number {
  const level = (input.level || 'intermediate').toLowerCase();
  const years = Number.isFinite(input.trainingYears) ? (input.trainingYears as number) : 0;
  const course = !!input.onCourse || level === 'enhanced';
  const m = (input.muscle || '').toLowerCase();
  const isBackLegs = ['back', 'quads', 'hamstrings', 'glutes', 'legs'].includes(m);
  const isChest = ['chest', 'shoulders'].includes(m);
  const isArm = ['biceps', 'triceps', 'delt_front', 'delt_mid', 'delt_rear', 'forearms'].includes(m);
  if (course && years >= 6) {
    if (isBackLegs) return 22;
    if (isChest) return 18;
    if (isArm) return 12;
    return 16;
  }
  if (course && years >= 3) {
    if (isBackLegs) return 16;
    if (isChest) return 14;
    if (isArm) return 10;
    return 12;
  }
  if (course && years >= 1) {
    if (isBackLegs) return 12;
    if (isChest) return 10;
    if (isArm) return 8;
    return 10;
  }
  // Натуральные капы — умеренные (BIG только курсу/стажу выше).
  // intermediate держим около старого поведения (кап 5 → 6-8 точечно),
  // иначе натуральные недельные объёмы улетают за MRV (chest 22 при MRV 20).
  if (level === 'advanced') {
    if (isBackLegs) return 10;
    if (isChest) return 8;
    if (isArm) return 6;
    return 8;
  }
  if (level === 'intermediate') {
    if (isBackLegs) return 8;
    if (isChest) return 7;
    if (isArm) return 5;
    return 6;
  }
  return 6;
}

/** Shared nutrition soft-cap used by every BB source (Helms 2022). */
export function computeBBNutritionMultiplier(input: {
  calorieSurplus?: number;
  proteinPerKg?: number;
}): number {
  let value = 1;
  if (input.calorieSurplus != null) value *= input.calorieSurplus > 300 ? 1.1 : input.calorieSurplus > 100 ? 1.05 : input.calorieSurplus < -200 ? 0.8 : 1.0;
  if (input.proteinPerKg != null) value *= input.proteinPerKg >= 2.0 ? 1.1 : input.proteinPerKg >= 1.6 ? 1.05 : input.proteinPerKg < 1.0 ? 0.85 : 1.0;
  return Math.max(0.6, Math.min(1.5, value));
}

export interface BBVolumeContribution {
  muscle: string;
  directSets: number;
  effectiveSets: number;
  fatigueWeightedSets: number;
  coefficient: number;
  source: 'direct' | 'indirect';
}

export interface BBVolumeTarget {
  muscle: string;
  frequency: number;
  mev: number;
  mav: number;
  mrv: number;
  targetSets: number;
  minSetsPerSession: number;
  maxSetsPerSession: number;
  rationale: string[];
}

/**
 * Строит целевой direct-volume до выбора упражнений.
 * rotationSets передаётся уже в единицах текущей ротации.
 */
export function buildBBVolumeTarget(input: {
  muscle: string;
  frequency: number;
  landmarks: { mev: number; mav: number; mrv: number };
  rotationSets?: number;
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  weakPoint?: boolean;
  focus?: boolean;
  phaseMultiplier?: number;
  recoveryMultiplier?: number;
}): BBVolumeTarget {
  const muscle = normalizeBBMuscle(input.muscle);
  const frequency = Math.max(1, input.frequency || 1);
  const goal = input.volumeGoal || 'mav';
  const base = goal === 'mev' ? input.landmarks.mev : goal === 'mrv' ? input.landmarks.mrv : input.landmarks.mav;
  const emphasis = (input.weakPoint ? 1.2 : 1) * (input.focus ? 1.3 : 1);
  const recovery = Math.max(0.6, Math.min(1.1, input.recoveryMultiplier ?? 1));
  const phase = Math.max(0.4, Math.min(1.1, input.phaseMultiplier ?? 1));
  const targetSets = Math.max(
    input.landmarks.mev,
    Math.min(input.landmarks.mrv * recovery, Math.round((input.rotationSets ?? base) * emphasis * phase)),
  );
  const maxSetsPerSession = Math.max(2, Math.min(8, Math.ceil(input.landmarks.mrv / frequency)));
  const minSetsPerSession = Math.max(2, Math.min(maxSetsPerSession, Math.ceil(input.landmarks.mev / frequency)));
  const rationale: string[] = [`${goal.toUpperCase()} target: ${targetSets} direct sets`];
  if (input.weakPoint) rationale.push('weak-point multiplier ×1.2');
  if (input.focus) rationale.push('focus multiplier ×1.3');
  if (recovery < 1) rationale.push(`recovery cap ×${recovery.toFixed(2)}`);
  if (phase < 1) rationale.push(`phase volume ×${phase.toFixed(2)}`);
  return { muscle, frequency, ...input.landmarks, targetSets, minSetsPerSession, maxSetsPerSession, rationale };
}

export interface BBExerciseVolumeLike {
  name?: string;
  muscle?: string;
  sets?: number;
  workSets?: Array<unknown>;
  role?: 'primary' | 'accessory';
  type?: string;
  exerciseType?: string;
  rir?: number;
  character?: string;
}

function setCount(exercise: BBExerciseVolumeLike): number {
  return Math.max(0, Number(exercise.workSets?.length || exercise.sets || 0));
}

function hasAny(name: string, patterns: RegExp): boolean {
  return patterns.test(name);
}

/** Вторичные мышцы и консервативные коэффициенты для compound-работы. */
export function indirectMuscleContributions(exercise: BBExerciseVolumeLike): Array<{ muscle: string; coefficient: number }> {
  const name = String(exercise.name || '').toLowerCase();
  const type = String(exercise.type || exercise.exerciseType || '').toLowerCase();
  const isIsolation = type === 'isolation' || /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|crunch|скручив/i.test(name);
  if (isIsolation) return [];

  // Жимы рук/груди (НЕ «жим ногами» — это квадрицепс-движение и даёт
  // indirect на glutes/hamstrings, а не на triceps/shoulders!).
  // Дифференциация P1-4: узкий хват сильнее грузит трицепс, вертикальный жим — плечи.
  if (hasAny(name, /жим|bench|press|dip|отжим.*брус/i) && !/ног|leg.?press|жим.*ног/i.test(name)) {
    const isNarrow = /узк|close.?grip|narrow|алмаз.*отжим/i.test(name);
    const isVertical = /стоя|сидя.*армей|overhead|ohp|военный|military|армейск/i.test(name) && !/лёж|лежа|bench|гориз/i.test(name);
    const isDip = /брус|dip|отжим.*брус/i.test(name);
    if (isNarrow) {
      return [
        { muscle: 'triceps', coefficient: 0.60 },
        { muscle: 'shoulders', coefficient: 0.15 },
      ];
    }
    if (isVertical) {
      return [
        { muscle: 'triceps', coefficient: 0.30 },
        { muscle: 'shoulders', coefficient: 0.35 },
      ];
    }
    if (isDip) {
      return [
        { muscle: 'triceps', coefficient: 0.50 },
        { muscle: 'shoulders', coefficient: 0.25 },
      ];
    }
    return [
      // 0.45: трицепс получает ~45% косвенной работы от жимов (EMG-оценки);
      // 0.5 завышал effective — fullbody-сплиты 5x/нед уходили в MRV-overflow.
      // НЕ снижать ради PPL: коэффициенты запинены тестами bb-volume/fatigue.
      { muscle: 'triceps', coefficient: 0.45 },
      { muscle: 'shoulders', coefficient: 0.20 },
    ];
  }
  if (hasAny(name, /подтяг|pull.?up|pulldown|пуллдаун|тяга.*верх/i)) {
    return [
      { muscle: 'biceps', coefficient: 0.4 },
      { muscle: 'shoulders', coefficient: 0.2 },
    ];
  }
  if (hasAny(name, /row|тяга.*наклон|тяга.*гриф|тяга.*гантел|горизонтальн.*тяга/i)) {
    return [
      { muscle: 'biceps', coefficient: 0.4 },
      { muscle: 'shoulders', coefficient: 0.2 },
    ];
  }
  if (hasAny(name, /присед|squat|leg.?press|жим.*ног|выпад|lunge/i)) {
    return [
      { muscle: 'glutes', coefficient: 0.4 },
      { muscle: 'hamstrings', coefficient: 0.25 },
    ];
  }
  if (hasAny(name, /румын|rdl|гудморнинг|good.?morning|гиперэкстенз/i)) {
    return [
      { muscle: 'glutes', coefficient: 0.4 },
      { muscle: 'back', coefficient: 0.25 },
    ];
  }
  return [];
}

export function exerciseVolumeContributions(exercise: BBExerciseVolumeLike): BBVolumeContribution[] {
  // Разминочное упражнение не входит в объём/бюджет.
  if ((exercise as any).warmupActivator) return [];
  const sets = setCount(exercise);
  if (!sets) return [];
  let direct = normalizeBBMuscle(exercise.muscle || trueMuscleOf(exercise as any));
  if (!direct) return [];
  // PPL fix: shoulders volume per head, not summed as shoulders
  if (direct === 'shoulders') {
    const nm = String((exercise as any).name || '').toLowerCase();
    if (/задн|rear|обратн|лиц.*тяга|face.*pull/i.test(nm)) direct = 'delt_rear';
    else if (/жим|press|армей|overhead|военный/i.test(nm) && !/мах|lateral|отведен/i.test(nm)) direct = 'delt_front';
    else if (/мах|lateral|отведен|raise|подъем/i.test(nm)) direct = 'delt_mid';
    // else keep as shoulders (unlikely)
  }
  const rir = Math.max(0, Math.min(5, Number(exercise.rir ?? 2)));
  const fatigueWeight = 1 + Math.max(0, 2 - rir) * 0.2;
  const result: BBVolumeContribution[] = [{
    muscle: direct,
    directSets: sets,
    effectiveSets: sets,
    fatigueWeightedSets: sets * fatigueWeight,
    coefficient: 1,
    source: 'direct',
  }];
  for (const secondary of indirectMuscleContributions(exercise)) {
    const muscle = normalizeBBMuscle(secondary.muscle);
    if (!muscle || muscle === direct) continue;
    result.push({
      muscle,
      directSets: 0,
      effectiveSets: sets * secondary.coefficient,
      fatigueWeightedSets: sets * secondary.coefficient * fatigueWeight,
      coefficient: secondary.coefficient,
      source: 'indirect',
    });
  }
  return result;
}

export function aggregateBBVolume(
  sessions: Array<{ exercises: BBExerciseVolumeLike[] }>,
): Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> {
  const totals: Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      for (const contribution of exerciseVolumeContributions(exercise)) {
        const target = totals[contribution.muscle] || (totals[contribution.muscle] = { directSets: 0, effectiveSets: 0, fatigueWeightedSets: 0 });
        target.directSets += contribution.directSets;
        target.effectiveSets += contribution.effectiveSets;
        target.fatigueWeightedSets += contribution.fatigueWeightedSets;
      }
    }
  }
  return totals;
}

/* ── Волна-2.5: каноническая fractional-модель (Pelland 2024/26, Remmert 2025) ──
 * Планировочная метрика PUOS: direct = 1.0 fractional сета, indirect = 0.5
 * (независимо от EMG-коэффициента). EMG-коэффициенты (0.2–0.6) остаются
 * каноном для пер-мышечных MRV-кап-проверок (безопасность), а fractional —
 * для бюджета/PUOS-предупреждения (diminishing returns ≈11 fractional/сессию). */
export const INDIRECT_FRACTION = 0.5;

export interface CanonicalFractionalSets {
  direct: number;
  indirect: number;
  effective: number;
}

/** Fractional-объём ОДНОГО упражнения: direct 1.0 / indirect 0.5. */
export function canonicalEffectiveSets(exercise: BBExerciseVolumeLike): CanonicalFractionalSets {
  const sets = setCount(exercise);
  if (!sets || (exercise as any).warmupActivator) return { direct: 0, indirect: 0, effective: 0 };
  const indirectPairs = indirectMuscleContributions(exercise).length;
  const indirect = indirectPairs * sets * INDIRECT_FRACTION;
  return { direct: sets, indirect, effective: sets + indirect };
}

/** Per-muscle fractional-наборы сессий: muscle → fractional-сеты (direct+0.5×indirect). */
export function aggregateFractionalVolume(
  sessions: Array<{ exercises: BBExerciseVolumeLike[] }>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      if ((exercise as any).warmupActivator) continue;
      const sets = setCount(exercise);
      if (!sets) continue;
      let direct = normalizeBBMuscle(exercise.muscle || trueMuscleOf(exercise as any));
      if (!direct) continue;
      if (direct === 'shoulders') {
        const nm = String((exercise as any).name || '').toLowerCase();
        if (/задн|rear|обратн|лиц.*тяга|face.*pull/i.test(nm)) direct = 'delt_rear';
        else if (/жим|press|армей|overhead|военный/i.test(nm) && !/мах|lateral|отведен/i.test(nm)) direct = 'delt_front';
        else if (/мах|lateral|отведен|raise|подъем/i.test(nm)) direct = 'delt_mid';
      }
      totals[direct] = (totals[direct] || 0) + sets;
      for (const secondary of indirectMuscleContributions(exercise)) {
        const muscle = normalizeBBMuscle(secondary.muscle);
        if (!muscle || muscle === direct) continue;
        totals[muscle] = (totals[muscle] || 0) + sets * INDIRECT_FRACTION;
      }
    }
  }
  return totals;
}

/**
 * Волна-2.4: ЕДИНЫЙ resolver недельного MRV-капа мышцы — все слагаемые явно.
 * Сводит две ветки билдера (основная по muscleSessionCount и PRO-ключи) в один
 * источник; порядок округлений сохранён 1-в-1 (критерий «0 регрессий матрицы»).
 * armBoost: 'main' — руки/ягодицы/плечи (стаж выводится из уровня, PPL ×1.6),
 * 'pro' — PRO-ключи (буст только biceps/triceps и только при явном стаже).
 */
export function resolveMrvCap(input: {
  baseMrv: number;
  /** Режимный множитель мышцы (regimeMrvMultFor). */
  regimeMult: number;
  labMrvMultiplier?: number;
  recoveryMult: number;
  nutritionMult: number;
  /** Ноги: max(1, частота/2) — распределённый объём переносится лучше. */
  legFreqMult?: number;
  /** Дополнительный recovery-оверрайд плана. */
  recoveryOverride?: number;
  highVolume?: boolean;
  level?: string;
  trainingYears?: number;
  isPPL?: boolean;
  armBoost?: 'none' | 'main' | 'pro';
  specFactor?: number;
  blast?: boolean;
}): number {
  const lab = input.labMrvMultiplier ?? 1;
  const legF = input.legFreqMult ?? 1;
  const recOv = input.recoveryOverride ?? 1;
  let cap = Math.round(input.baseMrv * input.regimeMult * lab * input.recoveryMult * input.nutritionMult * legF * recOv);
  if (input.highVolume) {
    const isMax = input.level === 'enhanced' && (input.trainingYears ?? 0) >= 6;
    cap = Math.round(cap * (isMax ? 1.25 : 1.15));
  }
  if (input.armBoost === 'main') {
    const effYears = input.trainingYears ?? (input.level === 'beginner' ? 1 : input.level === 'intermediate' ? 3 : input.level === 'advanced' ? 5 : 6);
    if (effYears >= 3) cap = Math.round(cap * (effYears >= 8 ? 1.8 : effYears >= 6 ? 1.6 : input.isPPL ? 1.6 : 1.3));
  } else if (input.armBoost === 'pro') {
    const years = input.trainingYears;
    if (years !== undefined && years >= 3) cap = Math.round(cap * (years >= 8 ? 1.8 : years >= 6 ? 1.6 : 1.3));
  }
  if (input.specFactor && input.specFactor !== 1) cap = Math.round(cap * input.specFactor);
  if (input.blast) cap = Math.round(cap * 1.15);
  return cap;
}

/** Fractional-порог diminishing returns на мышцу за сессию (Remmert 2025: PUOS ≈ 11). */
export const PUOS_SESSION_FRACTIONAL = 11;

/**
 * РЕАЛИЗМ СЕССИИ (аудит 2026-09): сколько прямых сетов мышцы физически
 * продуктивно в одной тренировке.
 *
 * Источники: Henselmans 2022 «maximum productive training volume per session»
 * (9–13 сетов на группу), Remmert 2025 (PUOS ≈ 11 fractional — сверх этого
 * отдача падает), Schoenfeld 2016 (1×/нед >12-16 — уже избыток),
 * практика про-тренировок (Upper/Pull-день: 4–6 сетов на мышцу).
 *
 * Классы мышц: big — спина/ноги/грудь (могут больше), mid — плечи/трапы/икры/
 * пресс, small — руки/предплечья.
 *
 * ВАЖНО: это ПОТОЛОК ПРЯМЫХ сетов за сессию, не недельный. Недельный — MRV.
 * Смысл: большая цель (enhanced MAV×режим) распределяется по частоте сплита,
 * а не сваливается в одну сессию (жалоба: Upper-день 18-20 упражнений).
 */
export const SESSION_MUSCLE_REALISM: Record<'beginner' | 'intermediate' | 'advanced' | 'course_1' | 'course_3' | 'course_6', { big: number; mid: number; small: number }> = {
  beginner:     { big: 8, mid: 7, small: 7 },
  intermediate: { big: 12, mid: 9, small: 8 },
  advanced:     { big: 13, mid: 9, small: 8 },
  course_1:     { big: 14, mid: 10, small: 9 },
  course_3:     { big: 15, mid: 11, small: 9 },
  course_6:     { big: 16, mid: 12, small: 10 },
};

/** Мышцы-классы для реализм-капа сессии. */
export function sessionMuscleClass(muscle: string): 'big' | 'mid' | 'small' {
  const m = String(muscle || '').toLowerCase();
  if (['back', 'chest', 'quads', 'hamstrings', 'glutes', 'legs'].includes(m)) return 'big';
  if (['shoulders', 'delt_front', 'delt_mid', 'delt_rear', 'traps', 'calves', 'abs', 'lower_back', 'arms'].includes(m)) return 'mid';
  return 'small';
}

/**
 * Потолок ПРЯМЫХ сетов мышцы за одну сессию (реализм, аудит 2026-09).
 * Плотность: в сессии на 5+ групп каждая мышца получает меньше сетов
 * (та же недельная цель распределяется по большему числу групп дня).
 * Возвращает 0, если вход невалиден (кап не применяется).
 */
export function sessionMuscleRealismCap(input: {
  muscle: string;
  level?: string;
  trainingYears?: number;
  onCourse?: boolean;
  /** Сколько групп мышц в сессии (musclePlans.length) — плотность. */
  groupsInSession?: number;
}): number {
  const level = (input.level || 'intermediate').toLowerCase();
  const years = Number.isFinite(input.trainingYears) ? (input.trainingYears as number) : 0;
  const course = !!input.onCourse || level === 'enhanced';
  let tier: keyof typeof SESSION_MUSCLE_REALISM;
  if (course && years >= 6) tier = 'course_6';
  else if (course && years >= 3) tier = 'course_3';
  else if (course) tier = 'course_1';
  else if (level === 'advanced') tier = 'advanced';
  else if (level === 'beginner') tier = 'beginner';
  else tier = 'intermediate';
  const row = SESSION_MUSCLE_REALISM[tier];
  let cap = row[sessionMuscleClass(input.muscle)];
  const groups = Number(input.groupsInSession) || 0;
  // Плотность: ≥5 групп — −15%, ≥6 — −25%, ≥8 (фулбоди) — −35% — только для
  // крупных мышц (у них недельный объём распределяется по частоте сплита).
  // Средние/малые НЕ ужимаются: их объём не «съедает» бюджет сессии, а
  // PPL-минимумы (руки 8, икры 9) — контракт модели.
  if (sessionMuscleClass(input.muscle) === 'big') {
    const densityFactor = groups >= 8 ? 0.65 : groups >= 6 ? 0.75 : groups >= 5 ? 0.85 : 1;
    cap = Math.max(3, Math.round(cap * densityFactor));
  }
  return cap;
}

/** Потолок числа упражнений на мышцу в сессии: ≥2 сета на упражнение (Schoenfeld). */
export function sessionMuscleExerciseCap(setsForMuscle: number): number {
  return Math.max(1, Math.ceil((Number(setsForMuscle) || 0) / 2));
}

/**
 * Потолок упражнений мышцы по плотности сессии: в дне на 5+ групп каждая
 * мышца получает 2-4 упражнения, а не 6-8 (жалоба: Upper 18 упражнений).
 */
export function sessionDensityExerciseCap(groupsInSession: number): number {
  const g = Number(groupsInSession) || 0;
  if (g >= 8) return 2;
  if (g >= 6) return 3;
  if (g >= 5) return 4;
  if (g >= 4) return 5;
  return 8;
}

/**
 * Волна-2.7: сессионный потолок мышцы по ЕЁ challenge-MRV и частоте.
 * Формула `ceil(challengeMrv/частота × BB_MRV_TOLERANCE)` ограничивает только
 * «малые» мышцы — те, у кого честная доля ниже старого флора 12 (задняя дельта,
 * предплечья, трапы, икры). Для крупных мышц остаётся perSessionMuscleCap:
 * иначе MEV-фидеры финализатора возвращают срезанное и ломается инвариант
 * packing-v2 «объём ±2» (доказано дампом upper_lower_4/enhanced/back: 29→32).
 * Заменяет `mrvRot = max(12, …)` по самой большой мышце дня.
 */
export function sessionMrvRotCap(input: {
  perSessionMuscleCap: number;
  challengeMrv?: number;
  frequency?: number;
}): number {
  const cap = Math.max(1, Math.round(input.perSessionMuscleCap));
  const challenge = Number(input.challengeMrv) || 0;
  const freq = Math.max(1, Math.round(input.frequency || 1));
  if (challenge <= 0) return cap;
  const formula = Math.ceil((challenge / freq) * BB_MRV_TOLERANCE);
  return formula < 12 ? Math.min(cap, formula) : cap;
}

/**
 * Баланс мышц недели (грудь/спина, квадр/хам, push/pull, перед/зад дельта).
 *
 * Аудит 2026-09 (жалоба «выбрал слабую спину — а везде пишет увеличить жимы»):
 * функция принимает цели специализации/слабые группы. Если перекос создан
 * сознательным акцентом блока (спина растёт как цель), предупреждение не
 * выдаётся как проблема — вместо «добавьте жимов» идёт честная пометка
 * «дисбаланс ожидаем: цель специализации». Без opts поведение 1-в-1 прежнее.
 */
export function computeMuscleBalance(
  weekly: Record<string, { effectiveSets: number }>,
  opts?: { specTargets?: string[]; weakPoints?: string[] },
): { issues: string[]; ratios: Record<string, number> } {
  const get = (m: string) => weekly[m]?.effectiveSets || 0;
  const issues: string[] = [];
  const ratios: Record<string, number> = {};
  const targets = new Set<string>();
  for (const t of [...(opts?.specTargets || []), ...(opts?.weakPoints || [])]) {
    const key = normalizeBBMuscle(t);
    targets.add(key);
    // Гранулярные зоны (delt_mid, back_width) → канонические мышцы.
    if (key === 'delt_mid' || key === 'delt_rear' || key === 'delt_front') targets.add('shoulders');
    if (key === 'back_width' || key === 'back_thickness' || key === 'lats') targets.add('back');
    if (key === 'chest_upper' || key === 'chest_lower') targets.add('chest');
  }
  const isTarget = (...muscles: string[]) => muscles.some(m => targets.has(normalizeBBMuscle(m)));
  /** Перекос создан целью акцента: вместо «исправь» — пометка об ожидаемости. */
  const accentNote = (accentMuscle: string) => `«${MUSCLE_LABEL_RU[accentMuscle] || accentMuscle}» — цель акцента блока: дисбаланс ожидаем и не требует правки (остальные группы держат MEV).`;

  // chest/back
  const chest = get('chest');
  const back = get('back');
  if (chest > 0 && back > 0) {
    const r = chest / back;
    ratios['chest/back'] = Math.round(r * 100) / 100;
    if (r > 1.3) {
      if (isTarget('chest', 'chest_upper', 'chest_lower')) issues.push(accentNote('chest'));
      else issues.push(`Дисбаланс грудь/спина ${Math.round(r * 100) / 100} — грудь перегружена, добавьте тяг`);
    } else if (r < 0.7) {
      if (isTarget('back', 'back_width', 'back_thickness')) issues.push(accentNote('back'));
      else issues.push(`Дисбаланс грудь/спина ${Math.round(r * 100) / 100} — спина перегружена, добавьте жимов`);
    }
  }
  // quad/ham
  const quad = get('quads');
  const ham = get('hamstrings');
  if (quad > 0 && ham > 0) {
    const r = quad / ham;
    ratios['quad/ham'] = Math.round(r * 100) / 100;
    if (r > 1.5 || r < 0.66) {
      if (isTarget('quads', 'legs', 'hamstrings')) issues.push(accentNote(r > 1.5 ? 'quads' : 'hamstrings'));
      else issues.push(`Квадр/бицепс бедра ${Math.round(r * 100) / 100} — риск дисбаланса колена`);
    }
  }
  // push/pull per-week
  const push = chest + get('triceps') + get('shoulders') + get('delt_front') + get('delt_mid');
  const pull = back + get('biceps') + get('delt_rear') + ham + get('glutes');
  if (push > 0 && pull > 0) {
    const r = push / pull;
    ratios['push/pull'] = Math.round(r * 100) / 100;
    if (r > 1.3) {
      if (isTarget('chest', 'shoulders', 'delt_mid', 'delt_front')) issues.push(accentNote('chest'));
      else issues.push(`Push/pull ${Math.round(r * 100) / 100} — тяг мало`);
    } else if (r < 0.77) {
      if (isTarget('back', 'back_width', 'back_thickness', 'hamstrings', 'glutes')) issues.push(accentNote('back'));
      else issues.push(`Push/pull ${Math.round(r * 100) / 100} — жимов мало`);
    }
  }
  // front/rear delt
  const front = get('delt_front') + get('shoulders') * 0.3;
  const rear = get('delt_rear');
  if (front > 0 && rear > 0) {
    const r = front / rear;
    ratios['front/rear'] = Math.round(r * 100) / 100;
    if (r > 1.5) {
      if (isTarget('delt_front', 'shoulders', 'delt_mid')) issues.push(accentNote('shoulders'));
      else issues.push(`Передняя/задняя дельта ${Math.round(r * 100) / 100} — добавьте тяг на заднюю дельту`);
    }
  }
  return { issues, ratios };
}
