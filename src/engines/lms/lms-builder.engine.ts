/**
 * lms-builder.engine.ts — генерация полного плана СРЦ из шаблона недели 1 + PM + прогрессии.
 * Этап A3/B. Связывает: lms-types (шаблон) + lms-progression (PM по неделям) + lms-metrics (веса/метрики).
 *
 * СРЦ = саморасчитывающийся: неделя 1 — раскладка (% от PM), недели 2..N = та же раскладка
 * с PM, растущим на correctionPct каждую неделю. Вес подхода = PM_нед × pct × mnosz.
 */

import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec, SRSetSpec } from '../../data/lms-cycles/lms-types';
import { pmProgression, pmForWeek, workWeight, progressionRationale, levelPmFloor, type ProgressionMode, type PMProgressionInput } from './lms-progression.engine';
import { calcSessionMetrics, type SRExercise, type SRSessionMetrics, type SRCycleMetrics } from './lms-metrics.engine';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { type Exercise } from '../../core/types';
import { selectExercisesSmart } from '../exercise-selector.engine';
import { mesocyclePhaseForWeek, RIR_MATRIX, MesoPhaseConfigs, type MesocyclePhase } from '../rir-matrix.engine';
import { diagnoseWeakPoint, type Lift, type WeakPoint } from './weakpoint-pl';
import { diagnoseLift } from '../pro/lift-diagnostics.engine';
import { LMS_EXERCISES } from '../../data/lms-cycles/lms-exercises';

import { computeVolumeLandmarks, getVolumeLandmarks, getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { adaptForPEDs, type PED } from '../bb/bb-ped-adaptation.engine';
import { derivePattern, trueMuscleOf } from '../movement-pattern';
import { norm } from '../norm';
import { resolveCatalogId } from '../../data/lms-cycles/exercise-alias-map';
import { summarizeSourceCycleWeeks } from './source-phase.engine';
import { meetAttemptsFor, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS, warmupToOpener, type MeetAttemptsInfo, type MeetStrategy } from './competition-attempts';
import { buildPLTaperCurve, summarizeTaperCurve, type PeakWeekLayout, type TaperCurvePoint, type TaperMode, type TaperWeightGoal } from './lms-taper.engine';

export interface LMSBuildInput {
  template: SRCycleTemplate;
  pmMap: Record<string, number>;
  fallbackPm?: number;
  mode?: ProgressionMode;
  weeklyPercent?: number;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  weeksOverride?: number;
  /** Включить прогрессию ПМ по неделям (как в оригинале циклов). */
  progressionEnabled?: boolean;
  /** ПРОФ-параметры */
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  focusLift?: 'squat' | 'bench' | 'deadlift';
  currentReadiness?: number; // 0-100
  equipment?: string[];
  weakPoints?: string[];
  /** Слабые точки СРЦ-движений (профи-диагностика): какой лифт + какой участок амплитуды. */
  plWeakPoints?: { lift: Lift; weakPoint: WeakPoint }[];
  /** Пользовательский выбор дней для слабых групп мышц: {muscleId: [1-based dayIdx,...]}.
   *  Если не задано — авто-распределение: малые группы → 2 дня (heavy+pump), крупные → 1 день. */
  weakGroupDayMap?: Record<string, number[]>;
  /** Пользовательский выбор дней для слабых точек СРЦ-движений.
   *  Ключ формата `${lift}|${weakPointId}` → [1-based dayIdx,...]. Если не задано — авто. */
  plWeakPointDayMap?: Record<string, number[]>;
  /** Выбранные пользователем упражнения для слабых групп: {muscleId: [name,...]}. */
  weakGroupExerciseMap?: Record<string, string[]>;
  /** Выбранные пользователем упражнения из диагностики слабых точек. */
  plWeakPointExerciseMap?: Record<string, string[]>;
  /** Выбранные ассистенты из биомеханической диагностики и bar-path. */
  diagnosticExerciseMap?: Record<string, string[]>;
  diagnosticDayMap?: Record<string, number[]>;
  /** Ортопедические паттерны, запрещённые только для добавляемых ассистентов. */
  orthopedicBlockedPatterns?: string[];
  /** ACWR-зона для авто-делода (если передана — применяется к объёму/RIR). */
  acwr?: { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'dangerous' };
  /** Авторегуляция: topSetPctMultiplier/volumeMultiplier/rirShift (если передана — применяется к весам). */
  autoReg?: { topSetPctMultiplier: number; volumeMultiplier: number; rirShift: number; deload: boolean };
  /** PED-адаптация (dose-aware): если передана — заменяет хардкод pedMrvMult. */
  peds?: PED[];
  pedDoses?: Record<string, number>;
  /** Recovery-метрики для recovery multiplier (Helms 2022, Plews 2022). */
  bodyFat?: number;       // % жира
  leanMass?: number;      // кг сухой массы
  hrvMs?: number;         // RMSSD в мс
  sleepHours?: number;    // часов сна/ночь
  stressLevel?: number;   // 1-10
  /** Питание (Helms 2022): профицит калорий и белок г/кг → MRV soft-cap
   *  (как в ББ-авто computeBBNutritionMultiplier). */
  nutrition?: { calorieSurplus?: number; proteinPerKg?: number };
  /** Exact source mode: preserve source sets, reps, order and frequency. */
  faithful?: boolean;
}


export interface LMSWorkSet {
  pct: number;
  reps: number;
  sets: number;
  weight: number; // расчётный вес (кг)
  rir: number;    // repetitions in reserve для подхода (фаза мезоцикла)
}

export interface LMSPlanExercise {
  name: string;
  group: string;
  coef: number;
  mnosz: number;
  load?: string;
  pm: number;
  rir: number;    // базовый RIR упражнения (по фазе)
  workSets: LMSWorkSet[];
}

export interface LMSPlanDay {
  exercises: LMSPlanExercise[];
  metrics: SRSessionMetrics;
}

export interface LMSPlanWeek {
  week: number;
  pmRow: Record<string, number>; // PM по упражнениям на эту неделю
  days: LMSPlanDay[];
  /** Фаза, выведенная из оригинальной недельной раскладки PL-цикла. */
  sourcePhase?: MesocyclePhase;
  sourcePhaseOrigin?: 'original' | 'inferred';
  /** Фаза годового макроцикла, если план собран из Macrocycle. */
  macroPhase?: string;
  /** Добавленная тапер-неделя (appendPLTaperWeeks/applyPLTaper) — не часть исходного цикла. */
  taperWeek?: boolean;
  /** Неделя имитации соревнований (mock meet) — прикиды как тренировочные синглы за 10-14 дней до старта. */
  mockMeet?: boolean;
  /** Неделя соревнований в конце тапера — прикиды (опенер/вторая/третья) как подходы дня старта. */
  meetWeek?: boolean;
  /** Восстановительная неделя ПОСЛЕ соревнований (post-meet): объём ×0.5, RIR +3. */
  postMeet?: boolean;
  /** Прикиды соревновательного дня (выход на пик до 105%) — вешается на финальную тапер-неделю. */
  meetAttempts?: MeetAttemptsInfo;
  /** Пометка недели тапера/прикидов (напр. «план федерации выше факта — прикиды от потолка»). */
  taperNote?: string;
}

export interface LMSBuildOutput {
  template: SRCycleTemplate;
  progressionRationale: string;
  weeks: LMSPlanWeek[];
  cycleMetrics: SRCycleMetrics;
  /** Валидация объёма по группам мышц против MEV/MAV/MRV (volume-landmarks). */
  plVolumeLandmarks?: PLVolumeLandmark[];
}

/**
 * Реальная длина исходного СРЦ-цикла.
 *
 * Для циклов с явной раскладкой weeks[] именно её длина является источником
 * истины. Нельзя подменять её произвольным UI-длительностью мезоцикла: тогда
 * календарь и карточка программы показывают не оригинальный цикл.
 */
export function originalCycleWeeks(template: SRCycleTemplate): number {
  return template.weeks && template.weeks.length > 0
    ? template.weeks.length
    : Math.max(1, Math.round(template.meta.weeks));
}

export interface PLVolumeLandmark {
  group: string;       // английская группа (chest/back/legs/...)
  muscle: string;      // русское имя мышцы (из VOLUME_REFERENCES)
  peakWeek: number;    // неделя с пиковым объёмом
  sets: number;        // сетов/нед в пиковую неделю
  mev: number; mav: number; mrv: number;
  status: 'under' | 'optimal' | 'high' | 'over';
}

/** Уровень → ключ VolumeReference (enhanced → advanced). */
function vrLevelKey(level: string): 'beginner' | 'intermediate' | 'advanced' {
  switch (level) {
    case 'novice': return 'beginner';
    case 'intermediate': case 'II-KMS': return 'intermediate';
    case 'KMS-MS': case 'II-MS': case 'KMS-MSMK': case 'MS-MSMK': case 'enhanced': return 'advanced';
    default: return 'intermediate';
  }
}

const RU_TO_EN: Record<string, string> = { 'Грудь': 'chest', 'Спина': 'back', 'Ноги': 'legs', 'Плечи': 'shoulders', 'Руки': 'arms', 'Кор': 'core' };
const SENT_TO_RU: Record<string, string> = { 'ПР': 'Ноги', 'ЖМ': 'Грудь', 'ТГ': 'Спина', 'ЖИМ': 'Грудь', 'ТЯГА': 'Спина', 'ОФП': 'Кор', 'СФП': 'Кор' };
const EN_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
/**
 * Проверяет, является ли упражнение вариантом приоритетного лифта.
 * Простого `includes('жим'/'тяга')` недостаточно: оно ошибочно включает
 * жим ногами, жим стоя и тяги для спины в фокус bench/deadlift.
 */
function matchesFocusLift(name: string, focusLift?: 'squat' | 'bench' | 'deadlift'): boolean {
  if (!focusLift) return false;
  const n = norm(name);
  switch (focusLift) {
    case 'squat':
      return /присед|сквот/.test(n);
    case 'bench':
      return /жим/.test(n) && !/ногами|стоя|армейск|над голов/.test(n);
    case 'deadlift':
      // P0-fix: "из ям" alone matched "приседания из ямы" (a squat variant).
      // Now requires deadlift context (станов/румын/плинт/тяга) AND optionally "из ям",
      // or the explicit "становая ... из ямы" compound. Bare "из ямы" no longer matches.
      return /станов|румын|прямых ног|плинт/.test(n) || (/из ям/.test(n) && /станов|тяга/.test(n));
  }
}

/** Нормализовать группу упражнения (рус/сентимент) → английский ключ для volume-landmarks. */
function exEnGroup(g: string | undefined): string | undefined {
  if (!g) return undefined;
  if ((EN_GROUPS as readonly string[]).includes(g)) return g;
  const ru = SENT_TO_RU[g] || g;
  return RU_TO_EN[ru];
}

/** Группа (английский ключ) основного лифта — для MRV soft-cap внедряемого аксессуара.
 *  deadlift → 'hamstrings' (задняя цепь), не 'back' (становая не растит широчайшие).
 *  Иначе MRV-кап accessory считался по back, а не по hamstrings. */
function liftToEnGroup(lift: Lift): string {
  const m: Record<string, string> = { bench: 'chest', squat: 'legs', deadlift: 'hamstrings', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest' };
  return m[lift] || 'back';
}

/** Извлечь уникальные имена упражнений из шаблона (все недели, если заданы явно). */
export function extractExercises(tpl: SRCycleTemplate): string[] {
  const set = new Set<string>();
  const source = tpl.weeks && tpl.weeks.length ? tpl.weeks.flat() : tpl.week1;
  for (const day of source) for (const ex of day.exercises) set.add(ex.name);
  return [...set];
}

function pmFor(exName: string, pmMap: Record<string, number>, fallback: number): number {
  if (pmMap[exName] != null && Number.isFinite(pmMap[exName]) && pmMap[exName] > 0) return pmMap[exName];
  // эвристика: жимовые/присед/тяга — попытка сопоставления по ключам (с нормализацией ё→е)
  const n = norm(exName);
  const keys = Object.keys(pmMap)
    .filter(k => Number.isFinite(pmMap[k]) && pmMap[k] > 0)
    .sort((a, b) => norm(b).length - norm(a).length);
  for (const k of keys) {
    const nk = norm(k);
    if (n.includes(nk) || nk.includes(n)) {
      return pmMap[k];
    }
  }
  return fallback;
}

/** Разрешить PM для инъецированного упражнения с тем же fuzzy-поведением, что и для шаблона. */
function pmForInjected(exName: string, mainName: string, pmRow: Record<string, number>, fallback: number): number {
  return pmRow[exName]
    ?? pmRow[mainName]
    ?? Object.entries(pmRow).find(([key]) => {
      const n = norm(key);
      const target = norm(exName);
      const main = norm(mainName);
      return n === target || n.includes(target) || target.includes(n)
        || n === main || n.includes(main) || main.includes(n);
    })?.[1]
    ?? fallback;
}

// Нормализация load (Тяжелая/Средняя/Легкая): в шаблонах поле load иногда содержало
// мусор (имя упражнения из-за бага парсера). Берём валидный тег дня, иначе 'Средняя'.
const VALID_LOAD = /^(Тяжелая|Средняя|Легкая)$/;
function dayLoadTag(exercises: { load?: string }[]): string {
  const valid = exercises.find(e => e.load && VALID_LOAD.test(e.load));
  return valid?.load || 'Средняя';
}
function cleanLoad(load: string | undefined, dayTag: string): string {
  return load && VALID_LOAD.test(load) ? load : dayTag;
}

/** Маппинг period цикла → ключ RIR_MATRIX. */
function rirGoalKey(period: string): keyof typeof RIR_MATRIX {
  switch (period) {
    case 'strength': case 'peak': return 'strength';
    case 'mass': return 'hypertrophy';
    case 'endurance': return 'maintenance';
    case 'mixed': return 'hypertrophy';
    default: return 'strength';
  }
}

/** Маппинг level цикла → ключ RIR_MATRIX. */
function rirLevelKey(level: string): keyof typeof RIR_MATRIX['strength'] {
  switch (level) {
    case 'novice': return 'beginner';
    case 'intermediate': case 'II-KMS': return 'intermediate';
    case 'KMS-MS': case 'II-MS': return 'advanced';
    case 'KMS-MSMK': case 'MS-MSMK': return 'enhanced';
    default: return 'intermediate';
  }
}

/** Найти упражнение в каталоге по метке коррекции (метка может быть более специфичной, чем имя в каталоге).
 *  P0-fix: сначала проверяем EXERCISE_ALIAS_MAP для точного маппинга шаблонных имён → catalog ID.
 *  P2: memoized — same label returns same result without repeated linear scans.
 */
const _catalogLabelCache = new Map<string, Exercise | null>();
function findCatalogExerciseByLabel(label: string): Exercise | null {
  const cached = _catalogLabelCache.get(label);
  if (cached !== undefined) return cached;
  const result = _findCatalogExerciseByLabelUncached(label);
  _catalogLabelCache.set(label, result);
  return result;
}
function _findCatalogExerciseByLabelUncached(label: string): Exercise | null {
  // P0-1: точный маппинг из alias map (шаблонные имена → catalog ID)
  const aliasId = resolveCatalogId(label);
  if (aliasId) {
    const byId = EXERCISE_CATALOG.find(e => e.id === aliasId);
    if (byId) return byId;
  }
  const n = norm(label);
  let ex = EXERCISE_CATALOG.find(e => norm(e.name) === n);
  if (ex) return ex;
  // P2-fix: bidirectional includes was too greedy — a 3-char label "жим" matched "жим ногами".
  // Now require the SHORTER string to be at least 4 chars for substring matching.
  ex = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    if (en.length <= 2 || n.length <= 2) return false;
    const shorter = en.length <= n.length ? en : n;
    const longer = en.length <= n.length ? n : en;
    return shorter.length >= 4 && longer.includes(shorter);
  });
  if (ex) return ex;
  // Fallback: извлечь ядро имени (до скобок, слэша, тире), убрать обёртки типа «(акцент ...)»
  const core = label.split(/[\(\/—–\:\;]/)[0]?.trim();
  if (core && core.length > 2 && core !== label) {
    const cn = norm(core);
    ex = EXERCISE_CATALOG.find(e => {
      const en = norm(e.name);
      if (en.length <= 2 || cn.length <= 2) return false;
      const shorter = en.length <= cn.length ? en : cn;
      const longer = en.length <= cn.length ? cn : en;
      return shorter.length >= 4 && longer.includes(shorter);
    });
  }
  return ex || null;
}

/** Группа (английский ключ) упражнения по каталогу + фолбэк на тег шаблона.
 *  P0-fix: trueMuscleOf как канон — catalog .group содержит ошибки (close-grip=chest,
 *  face_pull=back, deadlift=back). Без trueMuscleOf MRV-подсчёт уходит не туда. */
function groupOfExercise(name: string, fallback: string): string {
  // P0-1: сначала проверяем alias map для catalog lookup
  const aliasId = resolveCatalogId(name);
  if (aliasId) {
    const byId = EXERCISE_CATALOG.find(e => e.id === aliasId);
    if (byId) return trueMuscleOf(byId) ?? (byId.group as string) ?? fallback;
  }
  const ex = EXERCISE_CATALOG.find(e => norm(e.name) === norm(name));
  if (ex) return trueMuscleOf(ex) ?? (ex.group as string) ?? fallback;
  // fuzzy match
  const n = norm(name);
  const fx = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    return en.length > 2 && (en.includes(n) || n.includes(en));
  });
  if (fx) return trueMuscleOf(fx) ?? (fx.group as string) ?? fallback;
  return fallback;
}

/**
 * PL-specific assistance patterns for weak MUSCLE GROUPS.
 *
 * Competition lifts are deliberately absent here. A weak chest does not get
 * another flat bench, a weak back does not get another deadlift, and weak legs
 * do not get another squat. Those lifts are already workload in the PL cycle.
 */
export const PL_WEAK_GROUP_ALLOWED_PATTERNS: Record<string, readonly string[]> = {
  chest: ['incline_push', 'dip_push', 'decline_push', 'isolation_chest'],
  back: ['horizontal_pull', 'vertical_pull', 'isolation_back', 'isolation_shoulders'],
  legs: ['lunge', 'isolation_legs_quad', 'isolation_legs_ham', 'glute_squat', 'isolation_calves'],
  shoulders: ['isolation_shoulders'],
  arms: ['isolation_arms'],
  core: ['core', 'anti_rotation', 'rotation'],
};

const PL_WEAK_GROUP_PATTERN_PRIORITY: Record<string, readonly string[]> = {
  chest: ['incline_push', 'dip_push', 'decline_push', 'isolation_chest'],
  back: ['horizontal_pull', 'vertical_pull', 'isolation_back', 'isolation_shoulders'],
  legs: ['lunge', 'glute_squat', 'isolation_legs_quad', 'isolation_legs_ham', 'isolation_calves'],
  shoulders: ['isolation_shoulders'],
  arms: ['isolation_arms'],
  core: ['anti_rotation', 'core', 'rotation'],
};

const PL_WEAK_GROUP_TARGET_RE: Record<string, RegExp> = {
  chest: /груд|chest|pectoral|жим|развод|сведен|брусь/i,
  back: /спин|широч|ромбовид|трапец|lat|back|тяга|pull/i,
  legs: /квадриц|ягод|бедр|икронож|голен|quad|ham|glute|calf|выпад|lunge/i,
  shoulders: /дельт|плеч|трапец|shoulder|delt/i,
  arms: /бицепс|трицепс|рук|curl|tricep|brach|молот|француз/i,
  core: /кор|пресс|abs|анти.?рот|ротац|планк|скруч/i,
};

function isPLWeakGroupTarget(exercise: Exercise, group: string): boolean {
  const hay = `${exercise.name} ${exercise.targetMuscle || ''}`;
  if (group === 'shoulders' && /размин|мобил|ротац|дислокац|растяж/i.test(hay)) return false;
  if (group === 'arms' && (/кист|запяст|предплеч/i.test(hay) || /жим леж|bench|дожим|пауза/i.test(hay))) return false;
  if (group === 'core' && /мобил|растяж|размин/i.test(hay)) return false;
  return PL_WEAK_GROUP_TARGET_RE[group]?.test(hay) ?? true;
}

function catalogPattern(exercise: Exercise): string {
  return exercise.movementPattern || derivePattern(exercise);
}

function plCatalogUses(name: string): number {
  const normalized = norm(name);
  const row = LMS_EXERCISES.find(item => {
    const itemName = norm(item.name);
    return itemName === normalized || itemName.includes(normalized) || normalized.includes(itemName);
  });
  return row?.uses ?? 0;
}

function sourcePattern(spec: SRExerciseSpec): string {
  const catalog = findCatalogExerciseByLabel(spec.name);
  return catalog ? catalogPattern(catalog) : derivePattern({ name: spec.name, group: spec.group });
}

/**
 * Return only PL-appropriate assistance for a weak muscle group, ranked by the
 * selected cycle's own exercise families. This is shared by the builder and
 * the UI so the displayed choices cannot diverge from generated choices.
 */
export function getPLWeakGroupExerciseCandidates(template: SRCycleTemplate, group: string): Exercise[] {
  const allowed = new Set(PL_WEAK_GROUP_ALLOWED_PATTERNS[group] ?? []);
  if (allowed.size === 0) return [];

  const layouts = template.weeks && template.weeks.length > 0 ? template.weeks : [template.week1];
  const cycleNames = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises.map(spec => norm(spec.name)))));
  const cyclePatterns = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises.map(sourcePattern))));
  const cycleSubstitutionGroups = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises
    .map(spec => findCatalogExerciseByLabel(spec.name)?.substitutionGroup)
    .filter((group): group is string => Boolean(group)))));
  const cyclePrimaryPatterns = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises
    .filter(spec => spec.load === 'Тяжелая' || (spec.coef ?? 0) >= 1)
    .map(sourcePattern))));

  const base = getExercisesByGroup(group)
    .filter(exercise => allowed.has(catalogPattern(exercise)))
    .filter(exercise => isPLWeakGroupTarget(exercise, group));
  // Фильтр дублей (primary-паттерны цикла + substitution-группы) — ТОЛЬКО если
  // после него у паттерна остаются варианты; вырезанные целиком паттерны
  // возвращаются в конец (лучше предложить ассистентов, чем пустую подгруппу).
  const filtered = base.filter(exercise =>
    !cyclePrimaryPatterns.has(catalogPattern(exercise)) &&
    (!exercise.substitutionGroup || !cycleSubstitutionGroups.has(exercise.substitutionGroup)));
  const filteredPatterns = new Set(filtered.map(exercise => catalogPattern(exercise)));
  const fallbackExtra = base.filter(exercise => !filteredPatterns.has(catalogPattern(exercise)));
  const candidates = [...filtered, ...fallbackExtra];

  return candidates.sort((a, b) => {
      const aName = norm(a.name), bName = norm(b.name);
      const aInCycle = cycleNames.has(aName), bInCycle = cycleNames.has(bName);
      if (aInCycle !== bInCycle) return aInCycle ? -1 : 1;

      const aPatternInCycle = cyclePatterns.has(catalogPattern(a));
      const bPatternInCycle = cyclePatterns.has(catalogPattern(b));
      if (aPatternInCycle !== bPatternInCycle) return aPatternInCycle ? -1 : 1;

      const aUses = plCatalogUses(a.name), bUses = plCatalogUses(b.name);
      if (aUses !== bUses) return bUses - aUses;

      const priority = PL_WEAK_GROUP_PATTERN_PRIORITY[group] ?? [];
      const aPriority = priority.indexOf(catalogPattern(a));
      const bPriority = priority.indexOf(catalogPattern(b));
      if (aPriority !== bPriority) return (aPriority < 0 ? 99 : aPriority) - (bPriority < 0 ? 99 : bPriority);
      // Для груди/спины/ног сначала реальное силовое вспомогательное движение,
      // затем резина/предреабилитация. Для плеч/рук/кора разрешённый isolation
      // остаётся приоритетным по самой карте паттернов.
      const preferCompound = group === 'chest' || group === 'back' || group === 'legs';
      if (preferCompound) {
        const aCompound = a.type === 'compound' || a.movementType === 'compound';
        const bCompound = b.type === 'compound' || b.movementType === 'compound';
        if (aCompound !== bCompound) return aCompound ? -1 : 1;
      }
      const equipmentRank = (exercise: Exercise): number => {
        const equipment = String(exercise.equipment || '').toLowerCase();
        if (/band|резин|other/.test(equipment)) return 2;
        if (/bodyweight|suspension/.test(equipment)) return 1;
        return 0;
      };
      const aEquipment = equipmentRank(a), bEquipment = equipmentRank(b);
      if (aEquipment !== bEquipment) return aEquipment - bEquipment;
      return (a.fatigueCost || 0) - (b.fatigueCost || 0);
    });
}

function weeklyMuscleSets(days: LMSPlanDay[], group: string): number {
  return days.reduce((total, day) => total + day.exercises
    .filter(ex => groupOfExercise(ex.name, ex.group) === group)
    .reduce((dayTotal, ex) => dayTotal + ex.workSets.reduce((sets, workSet) => sets + workSet.sets, 0), 0), 0);
}

/** Fatigue budget per session, scaled by readiness (0-100%).
 *  Base 60 = typical intermediate session capacity (S-MRV heuristic:
 *  ~60 fatigue-cost units = 4-5 compound exercises at ~12 fatigue each).
 *  At readiness=100 → 60, at readiness=50 → 30, at readiness=0 → 0. */
function fatigueBudget(readiness?: number): number {
  return 60 * (Math.max(0, Math.min(100, readiness ?? 80)) / 100);
}

/**
 * Собрать список корректирующих упражнений для слабой точки.
 * Упражнения ВСЕГДА из diagnoseWeakPoint (проверенный каталог weakpoint-pl).
 * diagnoseLift используется только для intensityPct классических лифтов (bench/squat/deadlift).
 */
function collectPLCorrections(lift: Lift, weakPoint: WeakPoint): { name: string; pct: number }[] {
  const base = diagnoseWeakPoint(lift, weakPoint);
  if (!base.assistance.length) return [];
  const diag = diagnoseLift(lift, weakPoint);
  const pct = diag ? diag.assistanceIntensityPct : base.intensityPct;
  return base.assistance.map((a: string) => ({ name: a, pct }));
}

export interface PLWeakPointRecommendation {
  corrections: string[];
  rationale: string;
  group: string;
  pct: number;
}

/** Рекомендация для UI: упражнения из проверенного каталога weakpoint-pl, rationale из lift-diagnostics (где доступно). */
export function getPLWeakPointRecommendations(lift: Lift, weakPoint: WeakPoint): PLWeakPointRecommendation {
  const group = liftToEnGroup(lift);
  const base = diagnoseWeakPoint(lift, weakPoint);
  const diag = diagnoseLift(lift, weakPoint);
  const pct = diag ? diag.assistanceIntensityPct : base.intensityPct;
  const rationale = diag ? diag.biomechanicalReason : base.rationale;
  return { corrections: base.assistance, rationale, group, pct };
}

/**
 * Инъекция ассистентных упражнений по диагностике слабой точки СРЦ-движения.
 * Для каждого {lift, weakPoint} подбираем до MAX_CORRECTIONS упражнений из diagnoseWeakPoint
 * (проверенный каталог weakpoint-pl), которые ещё не присутствуют в дне,
 * и добавляем их (3 подхода на %ПМ) в день, содержащий основной лифт.
 * Не дублирует уже назначенные упражнения; соблюдает MRV soft-cap группы.
 */
function injectPLWeakPoints(
  days: LMSPlanDay[],
  weakPoints: { lift: Lift; weakPoint: WeakPoint }[],
  pmRow: Record<string, number>,
  rirBase: number,
  phaseVolMod: number,
  vrLevel: 'beginner' | 'intermediate' | 'advanced',
  mrvMult: number,
  plWeakPointDayMap?: Record<string, number[]>,
  plWeakPointExerciseMap?: Record<string, string[]>,
  orthopedicBlockedPatterns: string[] = [],
  fallbackPm: number = 80,
): void {
  const mainNameMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга', pulldown: 'Тяга', incline_press: 'Жим гантелей' };
  const MAX_CORRECTIONS = 2;
  for (const wp of weakPoints) {
    const mainName = mainNameMap[wp.lift] || 'Жим';
    // Найти дни с лифтом (rank по объёму: max-heavy + min-light)
    const dayRankByMain: { idx: number; mainSets: number }[] = [];
    for (let i = 0; i < days.length; i++) {
      const mainSets = days[i].exercises
        .filter(e => {
          const en = norm(e.name), mn = norm(mainName);
          return en === mn || en.includes(mn) || mn.includes(en);
        })
        .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
      if (mainSets > 0) dayRankByMain.push({ idx: i, mainSets });
    }
    // Авто-распределение: heavy = max объём лифта, light = min объём среди остальных
    let heavyDayIdx = -1, lightDayIdx = -1;
    if (dayRankByMain.length > 0) {
      const sortedDesc = [...dayRankByMain].sort((a, b) => b.mainSets - a.mainSets);
      heavyDayIdx = sortedDesc[0].idx;
      if (sortedDesc.length > 1) {
        const rest = sortedDesc.slice(1).sort((a, b) => a.mainSets - b.mainSets);
        lightDayIdx = rest[0].idx;
      }
    } else {
      heavyDayIdx = 0;
    }
    // Override через пользовательский выбор
    const mapKey = `${wp.lift}|${wp.weakPoint}`;
    const userDays = plWeakPointDayMap?.[mapKey];
    if (userDays && userDays.length > 0) {
      heavyDayIdx = (userDays[0] - 1);
      if (heavyDayIdx < 0 || heavyDayIdx >= days.length) heavyDayIdx = 0;
      if (userDays.length > 1) {
        lightDayIdx = (userDays[1] - 1);
        if (lightDayIdx < 0 || lightDayIdx >= days.length) lightDayIdx = -1;
      } else {
        // Пользователь выбрал только 1 день — 2-я коррекция идёт в тот же день
        // (heavy+pump в одной сессии, как drop-set пару)
        lightDayIdx = heavyDayIdx;
      }
    }

    const liftGroup = liftToEnGroup(wp.lift);
    const diagnosisCorrections = collectPLCorrections(wp.lift, wp.weakPoint);
    const selectedNames = plWeakPointExerciseMap?.[mapKey];
    const corrections = (selectedNames && selectedNames.length > 0
      ? diagnosisCorrections.filter(c => selectedNames.includes(c.name))
      : diagnosisCorrections
    );
    const selectedCorrections = (selectedNames && selectedNames.length > 0
      ? corrections
      : corrections.slice(0, MAX_CORRECTIONS)).filter(c => {
        const exercise = findCatalogExerciseByLabel(c.name);
        return !exercise?.movementPattern || !orthopedicBlockedPatterns.includes(exercise.movementPattern);
      });
    if (selectedCorrections.length === 0) continue;

    // 1-й кандидат — в heavy-day (3×8 @ RIR 2, "Тяжёлая" добивка)
    // 2-й кандидат — в light-day (3×12 @ RIR 3, памп-вариант)
    const heavyDay = days[heavyDayIdx];
    if (heavyDay) {
       const c = selectedCorrections[0];
       const ex = findCatalogExerciseByLabel(c.name);
       // Диагностика является источником названия. Не заменяем "Дожим с 3 см"
       // на похожий базовый "Жим штанги лёжа" из-за fuzzy-match каталога.
       const resolvedName = c.name;
      const existing = new Set(heavyDay.exercises.map(e => norm(e.name)));
       if (!existing.has(norm(resolvedName))) {
         const exGroup = ex ? (trueMuscleOf(ex) ?? (ex.group as string)) : liftGroup;
        const sets = Math.max(2, Math.round(3 * phaseVolMod));
        const pm = pmForInjected(resolvedName, mainName, pmRow, fallbackPm);
        // User explicitly selected these weak points — always add, no MRV cap.
        // P2: coef not in Exercise catalog — use heuristic by movementType (compound vs isolation).
        const injCoef = ex?.type === 'compound' ? 1.0 : ex?.type === 'isolation' ? 0.3 : 0.7;
        heavyDay.exercises.push({
          name: resolvedName, group: exGroup, coef: injCoef, mnosz: 1,
          load: 'Тяжелая', pm, rir: rirBase,
          workSets: [{ pct: c.pct, reps: 8, sets: Math.max(1, sets), weight: workWeight(pm, c.pct), rir: rirBase }],
        });
        existing.add(norm(resolvedName));
      }
    }

    // 2-й кандидат — в light-day (если есть второй candidate в heavyDayIdx)
    if (lightDayIdx >= 0 && selectedCorrections.length > 1) {
      const lightDay = days[lightDayIdx];
      if (lightDay) {
        const c = selectedCorrections[1];
         const ex = findCatalogExerciseByLabel(c.name);
         const resolvedName = c.name;
        const existing = new Set(lightDay.exercises.map(e => norm(e.name)));
        if (!existing.has(norm(resolvedName))) {
          const exGroup = ex ? (trueMuscleOf(ex) ?? (ex.group as string)) : liftGroup;
          const sets = Math.max(2, Math.round(3 * phaseVolMod));
          const pm = pmForInjected(resolvedName, mainName, pmRow, fallbackPm);
          // User explicitly selected these weak points — always add, no MRV cap.
          // Памп-протокол: 3×12 @ 60% 1PM, RIR 3
          const pumpPct = 0.60;
          // P2: coef by catalog type — compound ~1.0, isolation ~0.3, fallback 0.65
          const pumpCoef = ex?.type === 'compound' ? 0.8 : ex?.type === 'isolation' ? 0.3 : 0.65;
          lightDay.exercises.push({
            name: resolvedName, group: exGroup, coef: pumpCoef, mnosz: 1,
            load: 'Средняя', pm, rir: Math.max(3, rirBase + 1),
            workSets: [{ pct: pumpPct, reps: 12, sets: Math.max(1, sets), weight: workWeight(pm, pumpPct), rir: Math.max(3, rirBase + 1) }],
          });
          existing.add(norm(resolvedName));
        }
      }
    }

    // При явном выборе пользователь может назначить все упражнения диагностики,
    // а не только стандартную пару heavy/pump. Дни используются циклически.
    if (selectedNames && selectedNames.length > 0 && selectedCorrections.length > 2) {
      const targetDays = userDays && userDays.length > 0
        ? userDays.map(day => day - 1).filter(day => day >= 0 && day < days.length)
        : [heavyDayIdx];
      for (let correctionIndex = 2; correctionIndex < selectedCorrections.length; correctionIndex++) {
        const targetDay = days[targetDays[(correctionIndex - 2) % targetDays.length]];
        if (!targetDay) continue;
        const correction = selectedCorrections[correctionIndex];
        const existing = new Set(targetDay.exercises.map(e => norm(e.name)));
        if (existing.has(norm(correction.name))) continue;
        const catalogExercise = findCatalogExerciseByLabel(correction.name);
        const group = catalogExercise ? (trueMuscleOf(catalogExercise) ?? catalogExercise.group) : liftGroup;
        const pm = pmForInjected(correction.name, mainName, pmRow, fallbackPm);
        targetDay.exercises.push({
          name: correction.name,
          group,
          coef: catalogExercise?.type === 'compound' ? 0.8 : 0.3,
          mnosz: 1,
          load: 'Средняя',
          pm,
          rir: Math.max(3, rirBase + 1),
          workSets: [{ pct: correction.pct, reps: 10, sets: Math.max(2, Math.round(3 * phaseVolMod)), weight: workWeight(pm, correction.pct), rir: Math.max(3, rirBase + 1) }],
        });
      }
    }
  }
}

/** Группа ПЛ-пула, в которую входит упражнение (для подбора протокола аксессуара). */
function diagnosticGroupForExercise(name: string): string | null {
  const n = norm(name);
  for (const group of Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS)) {
    if (getExercisesByGroup(group).some(e => norm(e.name) === n)) return group;
  }
  const ex = findCatalogExerciseByLabel(name);
  if (ex) return (trueMuscleOf(ex) ?? (ex.group as string)) ?? null;
  return null;
}

/**
 * Протокол для впрыскиваемого диагностического упражнения — вычисляется из
 * раскладки цикла ТЕМ ЖЕ алгоритмом, что protocolFromCycle в карточке
 * диагностики (lift-assistance.engine): set-блоки аксессуара цикла на целевую
 * группу. Показанный в UI протокол и вписанный в план совпадают по построению.
 */
function diagnosticProtocolFromCycle(template: SRCycleTemplate | undefined, exerciseName: string): { pct: number; reps: number; sets: number; rir: number } {
  const fallback = { pct: 0.6, reps: 10, sets: 3, rir: 2 };
  if (!template) return fallback;
  const layouts = template.weeks && template.weeks.length > 0 ? template.weeks : [template.week1];
  const accSpecs: SRExerciseSpec[] = layouts.flatMap(days => days.flatMap(day =>
    day.exercises.filter(spec => spec.load !== 'Тяжелая' && spec.sets && spec.sets.length > 0)));
  if (accSpecs.length === 0) return fallback;
  const group = diagnosticGroupForExercise(exerciseName);
  const allowed = group ? (PL_WEAK_GROUP_ALLOWED_PATTERNS[group] ?? []) : [];
  const match = accSpecs.find(spec => allowed.includes(sourcePattern(spec)));
  const spec = match ?? accSpecs[0];
  const first = spec?.sets?.[0];
  if (!first) return fallback;
  return { pct: first.pct, reps: Math.max(2, first.reps), sets: Math.max(1, first.sets), rir: first.rir ?? 2 };
}

function injectDiagnosticExercises(
  days: LMSPlanDay[],
  exerciseMap: Record<string, string[]> | undefined,
  dayMap: Record<string, number[]> | undefined,
  pmRow: Record<string, number>,
  fallbackPm: number,
  template?: SRCycleTemplate,
): void {
  if (!exerciseMap) return;

  const mainNameMap: Record<string, string> = {
    bench: 'Жим лежа',
    squat: 'Присед',
    deadlift: 'Становая тяга',
    ohp: 'Жим стоя',
    row: 'Тяга',
    pulldown: 'Тяга',
    incline_press: 'Жим гантелей',
  };

  const autoDaysFor = (key: string): number[] => {
    const lift = key.split('|')[0];
    const mainName = mainNameMap[lift];
    if (!mainName) return [0];

    const ranked = days.map((day, index) => ({
      index,
      mainSets: day.exercises
        .filter(exercise => {
          const exerciseName = norm(exercise.name);
          const targetName = norm(mainName);
          return exerciseName === targetName || exerciseName.includes(targetName) || targetName.includes(exerciseName);
        })
        .reduce((total, exercise) => total + exercise.workSets.reduce((sets, workSet) => sets + workSet.sets, 0), 0),
    })).filter(day => day.mainSets > 0);

    if (ranked.length === 0) return [0];
    const heavy = [...ranked].sort((a, b) => b.mainSets - a.mainSets)[0].index;
    const light = [...ranked]
      .filter(day => day.index !== heavy)
      .sort((a, b) => a.mainSets - b.mainSets)[0]?.index;
    return light == null ? [heavy] : [heavy, light];
  };

  for (const [key, names] of Object.entries(exerciseMap)) {
    if (!names?.length) continue;
    const configuredDays = dayMap?.[key];
    const selectedDays = Array.isArray(configuredDays) && configuredDays.length > 0
      ? configuredDays.map(day => day - 1).filter(day => day >= 0 && day < days.length)
      : autoDaysFor(key);
    const targetDays = selectedDays.length > 0 ? selectedDays : autoDaysFor(key);

    // Один выбранный ассистент повторяется в выбранных днях; несколько
    // распределяются по дням, чтобы не перегружать одну сессию.
    const placements = targetDays.length > names.length
      ? targetDays.map((dayIndex, index) => ({ dayIndex, name: names[index % names.length] }))
      : names.map((name, index) => ({ dayIndex: targetDays[index % targetDays.length], name }));

    for (const { dayIndex, name } of placements) {
      const day = days[dayIndex];
      if (!day) continue;
      if (day.exercises.some(ex => norm(ex.name) === norm(name))) continue;
      const pm = pmRow[name] ?? fallbackPm;
      const protocol = diagnosticProtocolFromCycle(template, name);
      day.exercises.push({
        name,
        group: diagnosticGroupForExercise(name) ?? 'accessory',
        coef: 0.3,
        mnosz: 1,
        load: 'Средняя',
        pm,
        rir: protocol.rir,
        workSets: [{ pct: protocol.pct, reps: protocol.reps, sets: protocol.sets, weight: workWeight(pm, protocol.pct), rir: protocol.rir }],
      });
    }
  }
}

export function buildLMSPlan(input: LMSBuildInput): LMSBuildOutput {
  const { template, pmMap, fallbackPm = 80 } = input;
  if (fallbackPm <= 0) throw new Error('buildLMSPlan: fallbackPm must be > 0');

  // Валидация шаблона
  if (!template.meta.weeks || template.meta.weeks <= 0) throw new Error('buildLMSPlan: template.meta.weeks must be > 0');
  if (!template.week1 || !Array.isArray(template.week1) || template.week1.length === 0) throw new Error('buildLMSPlan: template.week1 must be a non-empty array of days');
  if (typeof template.meta.correctionPct !== 'number' || isNaN(template.meta.correctionPct)) throw new Error('buildLMSPlan: template.meta.correctionPct must be a number');
  for (const day of template.week1) {
    if (!day || !Array.isArray(day.exercises)) throw new Error('buildLMSPlan: week1 contains an invalid day');
    for (const ex of day.exercises) {
      if (!ex || typeof ex.name !== 'string' || !ex.name.trim()) throw new Error('buildLMSPlan: exercise name must be non-empty');
      if (!ex.sets || !Array.isArray(ex.sets)) throw new Error(`buildLMSPlan: exercise "${ex.name}" has missing or invalid sets`);
      for (const s of ex.sets) {
        if (typeof s.pct !== 'number' || s.pct <= 0 || s.pct > 1.3) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid pct (${s.pct}), expected 0..1.3`);
        if (typeof s.sets !== 'number' || s.sets <= 0) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid sets count (${s.sets})`);
        if (typeof s.reps !== 'number' || s.reps <= 0) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid reps (${s.reps})`);
      }
    }
  }
  if (template.weeks && !Array.isArray(template.weeks)) throw new Error('buildLMSPlan: template.weeks must be an array if provided');
  if (template.weeks) {
    for (let wi = 0; wi < template.weeks.length; wi++) {
      const w = template.weeks[wi];
      if (!Array.isArray(w) || w.length === 0) throw new Error(`buildLMSPlan: template.weeks[${wi}] must be a non-empty array of days`);
      for (const day of w) {
        if (!day || !Array.isArray(day.exercises)) throw new Error(`buildLMSPlan: template.weeks[${wi}] contains an invalid day`);
        for (const ex of day.exercises) {
          if (!ex || typeof ex.name !== 'string' || !ex.name.trim()) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise name must be non-empty`);
          if (!ex.sets || !Array.isArray(ex.sets)) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid sets`);
          for (const s of ex.sets) {
            if (typeof s.pct !== 'number' || !Number.isFinite(s.pct) || s.pct <= 0 || s.pct > 1.3) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid pct (${s.pct})`);
            if (typeof s.sets !== 'number' || !Number.isFinite(s.sets) || s.sets <= 0) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid sets count (${s.sets})`);
            if (typeof s.reps !== 'number' || !Number.isFinite(s.reps) || s.reps <= 0) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid reps (${s.reps})`);
          }
        }
      }
    }
  }

  const mode = input.mode ?? 'natural';
  const faithful = input.faithful === true;
  if (input.weeksOverride != null && (!Number.isFinite(input.weeksOverride) || input.weeksOverride < 1)) {
    throw new Error('buildLMSPlan: weeksOverride must be a finite number >= 1');
  }
  if (input.weeklyPercent != null && (!Number.isFinite(input.weeklyPercent) || input.weeklyPercent <= -1)) {
    throw new Error('buildLMSPlan: weeklyPercent must be finite and greater than -100%');
  }
  if (template.meta.correctionPct <= -1) throw new Error('buildLMSPlan: correctionPct must be greater than -100%');
  if (input.currentReadiness != null && !Number.isFinite(input.currentReadiness)) {
    throw new Error('buildLMSPlan: currentReadiness must be finite');
  }
  const exercises = extractExercises(template);

  // Faithful multi-week: если задана явная раскладка ВСЕХ недель — используем её
  // дословно, БЕЗ авто-прогрессии (pct каждой недели уже отражает реальную нагрузку).
  const hasExplicitWeeks = !!(template.weeks && template.weeks.length)
    && (faithful || template.meta.sourceWeeks !== true);
  const totalWeeks = hasExplicitWeeks
    ? template.weeks!.length
    : Math.max(1, Math.round(input.weeksOverride ?? template.meta.weeks));

  const pm0Map: Record<string, number> = {};
  for (const name of exercises) {
    const pm = pmFor(name, pmMap, fallbackPm);
    if (!Number.isFinite(pm) || pm <= 0) throw new Error(`buildLMSPlan: PM for exercise "${name}" must be > 0`);
    pm0Map[name] = pm;
  }

  // прогрессия PM для каждого упражнения
  const rationalePm0 = Object.values(pm0Map).reduce((sum, pm) => sum + pm, 0) / Math.max(1, Object.values(pm0Map).length);
  const progInput: PMProgressionInput = {
    pm0: rationalePm0, weeks: totalWeeks, mode,
    weeklyPercent: input.weeklyPercent, courseIntensity: input.courseIntensity,
  };
  const rationale = hasExplicitWeeks
    ? 'Программа задана дословно по источнику (явная раскладка всех недель, без авто-прогрессии PM).'
     : progressionRationale(progInput);
  const weakNotes: string[] = [];

  const goalKey = rirGoalKey(template.meta.period);
  const levelKey = rirLevelKey(template.meta.level);
  const vrLevel = vrLevelKey(template.meta.level);
  // Уровень спортсмена в темпе прогрессии ПМ (натурал/custom): k ≥ levelK (Rhea 2003).
  const levelPmNote = (!hasExplicitWeeks && (mode === 'natural' || mode === 'custom') && levelPmFloor(vrLevel) != null)
    ? ` 🎓 Уровень ${vrLevel}: темп ПМ ≥ +${(levelPmFloor(vrLevel)! * 100).toFixed(1)}%/нед.`
    : '';
  // PED-адаптация: dose-aware через adaptForPEDs (если переданы PEDs), иначе fallback на хардкод.
  let pedMrvMult = 1;
  let pedRecMult = 1;
  if (input.peds && input.peds.length > 0) {
    const allLandmarks = getAllVolumeLandmarks(vrLevel);
    const baseMrv = Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]));
    const pedAdapt = adaptForPEDs(input.peds, baseMrv, input.pedDoses, input.courseIntensity);
    pedMrvMult = pedAdapt.combinedMrvMultiplier || 1;
    pedRecMult = pedAdapt.combinedRecoveryMultiplier || 1;
  } else if (input.mode === 'on_course') {
    pedMrvMult = input.courseIntensity === 'heavy' ? 1.35 : input.courseIntensity === 'moderate' ? 1.25 : 1.15;
  }

  // Recovery multiplier из композиции тела + recovery-метрик (Helms 2022, Plews 2022, Watson 2022).
  // Модулирует MRV soft-cap (pedMrvMult × recoveryMult) — выше восстановление → больше объём.
  const recoveryMult = Math.max(0.6, Math.min(1.5, (() => {
    let r = 1.0;
    if (input.bodyFat != null) r *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1.0;
    if (input.leanMass != null) r *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1.0 : 0.9;
    if (input.hrvMs != null) r *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1.0 : 0.85;
    if (input.sleepHours != null) r *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1.0 : 0.85;
    if (input.stressLevel != null) r *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1.0 : 0.85;
    return r;
  })()));
  // Питание (Helms 2022): профицит калорий и белок → MRV soft-cap (паритет с ББ-авто).
  const nutritionMult = Math.max(0.6, Math.min(1.5, (() => {
    let n = 1;
    const cal = input.nutrition?.calorieSurplus;
    const pro = input.nutrition?.proteinPerKg;
    if (cal != null) n *= cal > 300 ? 1.1 : cal > 100 ? 1.05 : cal < -200 ? 0.8 : 1.0;
    if (pro != null) n *= pro >= 2.0 ? 1.1 : pro >= 1.6 ? 1.05 : pro < 1.0 ? 0.85 : 1.0;
    return n;
  })()));
  const nutritionNote = nutritionMult !== 1
    ? ` 🥗 Питание: MRV ${nutritionMult > 1 ? '+' : ''}${Math.round((nutritionMult - 1) * 100)}% (калории ${input.nutrition?.calorieSurplus ?? 0} ккал, белок ${input.nutrition?.proteinPerKg ?? 0} г/кг; Helms 2022).`
    : '';
  // Итоговый MRV-множитель: PED × recovery × питание (комбинированный soft-cap)
  const combinedMrvMult = pedMrvMult * recoveryMult * nutritionMult;

  // ACWR-авто-делод: если передана ACWR-зона — корректируем объём/RIR для всех недель.
  const acwrZone = input.acwr?.zone;
  let acwrVolMod = 1, acwrRirShift = 0, acwrDeload = false;
  if (acwrZone === 'dangerous') { acwrVolMod = 0.65; acwrRirShift = 2; acwrDeload = true; }
  else if (acwrZone === 'caution') { acwrVolMod = 0.85; acwrRirShift = 1; }
  else if (acwrZone === 'undertrained') { acwrVolMod = 1.1; } // Растренированность: стимул +10% объёма без RIR-shift (восстановление через объём, не интенсивность).

  // Авторегуляция: если передана — применяется к весам (topSetPctMultiplier) и объёму/RIR.
  const ar = input.autoReg;
  const arTopMult = ar?.topSetPctMultiplier ?? 1;
  // The deload flag is authoritative even when a caller did not precompute a
  // reduced volume multiplier. Do not double-cut an already smaller value.
  const arVolMult = Math.min(ar?.volumeMultiplier ?? 1, ar?.deload ? 0.6 : 1);
  const arRirShift = ar?.rirShift ?? 0;

  const weeks: LMSPlanWeek[] = [];
  const sourceLayouts = template.weeks && template.weeks.length > 0
    ? template.weeks
    : Array.from({ length: totalWeeks }, () => template.week1);
  const sourceSnapshots = summarizeSourceCycleWeeks(sourceLayouts, template.meta.period, template.meta.sourcePhases, template.meta.sourcePhaseSource ?? 'original');
  for (let w = 0; w < totalWeeks; w++) {
    const weekNumber = w + 1;
    const phase: MesocyclePhase = mesocyclePhaseForWeek(weekNumber, totalWeeks);
    const rirBase = RIR_MATRIX[goalKey]?.[levelKey]?.[phase] ?? MesoPhaseConfigs[phase].rirBase;
    // Для auto-прогрессирующих циклов применяем объёмную модуляцию фазы (реальный пик/разгрузка).
    // Для faithful (явная раскладка всех недель) уважаем источник — модуляции нет.
    const phaseVolMod = faithful || hasExplicitWeeks ? 1.0 : MesoPhaseConfigs[phase].volumeMod;

    const pmRow: Record<string, number> = {};
    for (const name of exercises) {
      if (input.progressionEnabled === false) {
        pmRow[name] = pm0Map[name];
      } else {
        // Уровень спортсмена влияет на темп прогрессии ПМ для натурала:
        // k = max(коррекция цикла, levelK) — новичок растёт быстрее (Rhea 2003).
        // На курсе — курсовая кривая, на ПКТ — нисходящая (levelK не применяется).
        const rawK = (input.weeklyPercent != null ? input.weeklyPercent
          : mode === 'on_course' ? (input.courseIntensity === 'mild' ? 0.015 : input.courseIntensity === 'heavy' ? 0.025 : 0.02)
          : mode === 'pct' ? -0.005 : template.meta.correctionPct);
        const levelK = (mode === 'natural' || mode === 'custom') ? levelPmFloor(vrLevel) : null;
        const k = (levelK != null && rawK < levelK) ? levelK : rawK;
        const progInput: PMProgressionInput = { pm0: pm0Map[name], weeks: totalWeeks, mode, weeklyPercent: k, courseIntensity: input.courseIntensity };
        const progressedPm = pmForWeek(progInput, weekNumber);
        pmRow[name] = progressedPm * (faithful ? 1 : arTopMult);
      }
    }
    const weekLayout: SRDaySpec[] = hasExplicitWeeks ? template.weeks![w] : template.week1;
    const days: LMSPlanDay[] = weekLayout.map((day: SRDaySpec) => {
      const dayTag = dayLoadTag(day.exercises as { load?: string }[]);

      // S-MRV: Бюджет утомления на сессию
      let dayFatigueBudget = fatigueBudget(input.currentReadiness);

      const planEx: LMSPlanExercise[] = day.exercises.map((spec: SRExerciseSpec) => {
        const pm = pmRow[spec.name];
        const isMain = spec.load === 'Тяжелая';
        const workSets: LMSWorkSet[] = spec.sets.map(s => {
          let sets = s.sets;

          // Коррекция объёма по VolumeGoal + фазе мезоцикла (только для аксессуаров)
          if (!faithful && !isMain) {
            const vMult = input.volumeGoal === 'mev' ? 0.8 : input.volumeGoal === 'mrv' ? 1.2 : 1.0;
            const focusMult = matchesFocusLift(spec.name, input.focusLift) ? 1.2 : 1.0;
            const weakEn = exEnGroup(spec.group);
            const weakMult = (input.weakPoints && weakEn && input.weakPoints.includes(weakEn)) ? 1.2 : 1.0;
            const pedMult = Math.min(1.5, pedMrvMult);
            const totalMult = Math.min(1.5, vMult * phaseVolMod * focusMult * weakMult * pedMult);
            sets = Math.round(sets * totalMult);
          }

          // S-MRV floor: аксессуары не ниже 2 подходов (только для non-faithful — preserve source sets)
          if (!faithful) sets = Math.max(isMain ? 1 : 2, sets);

          // ACWR-авто-делод: корректируем объём (все упражнения) и RIR
          sets = Math.round(sets * acwrVolMod);
          if (!faithful) sets = Math.max(isMain ? 1 : 2, sets);
          // Авторегуляция: объём (все) — применяется поверх ACWR
          sets = Math.round(sets * arVolMult);
          if (!faithful) sets = Math.max(isMain ? 1 : 2, sets);

          // Расчётный вес с авторегуляцией (topSetPctMultiplier)
          const baseWeight = workWeight(pm, s.pct);
          const adjWeight = Math.round(baseWeight * arTopMult * 10) / 10;

          // RIR с ACWR + авторегуляцией
          const baseRir = faithful ? (s.rir ?? 0) : rirBase;
          const adjRir = Math.max(0, baseRir + acwrRirShift + arRirShift);

          return {
            pct: s.pct, reps: s.reps, sets: Math.max(1, sets),
            weight: adjWeight,
            rir: adjRir,
          };
        });

        // Проверка S-MRV: срезаем аксессуары, чтобы влезть в бюджет утомления
        let totalWorkSets = workSets.reduce((sum, ws) => sum + ws.sets, 0);
        const aliasId = resolveCatalogId(spec.name);
        const fatigueCost = (aliasId
          ? EXERCISE_CATALOG.find(e => e.id === aliasId)
          : EXERCISE_CATALOG.find(e => e.name === spec.name))?.fatigueCost ?? 5;
        const exCost = fatigueCost * totalWorkSets;
        if (!faithful && dayFatigueBudget < exCost && !isMain) {
          const fit = Math.max(2, Math.floor(Math.max(0, dayFatigueBudget) / fatigueCost));
          workSets.forEach(ws => { ws.sets = Math.min(ws.sets, fit); });
          totalWorkSets = workSets.reduce((sum, ws) => sum + ws.sets, 0);
        }
        dayFatigueBudget -= fatigueCost * totalWorkSets;

      return { name: spec.name, group: spec.group, coef: spec.coef, mnosz: spec.mnosz, load: cleanLoad(spec.load, dayTag), pm, rir: rirBase, workSets };
       });
 
       const metricsEx: SRExercise[] = planEx.map(pe => ({
         name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
         sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
       }));
       return { exercises: planEx, metrics: calcSessionMetrics(metricsEx) };
     });
    // Слабые точки и слабые группы добавляются отдельным слоем. Faithful защищает source-сеты,
    // но не должен отключать выбранные пользователем ассистенты.
    if (input.plWeakPoints && input.plWeakPoints.length) {
      injectPLWeakPoints(days, input.plWeakPoints, pmRow, rirBase, phaseVolMod, vrLevel, combinedMrvMult, input.plWeakPointDayMap, input.plWeakPointExerciseMap, input.orthopedicBlockedPatterns ?? [], input.fallbackPm ?? 80);
    }
    injectDiagnosticExercises(days, input.diagnosticExerciseMap, input.diagnosticDayMap, pmRow, input.fallbackPm ?? 80, template);

    // Инъекция accessory-упражнений для слабых групп мышц — авто-распределение по 1-2 дням.
    // PL-логика:
    //  - число дней остаётся 1×/2× по размеру группы и weakGroupDayMap;
    //  - каждый добавленный ассистент получает set-блоки конкретного аксессуара
    //    выбранного дня/недели цикла, а не универсальную BB-схему;
    //  - основные паттерны цикла (жим/присед/становая и primary-варианты) исключены;
    //  - пользовательский override: weakGroupDayMap[muscle] = [dayIdx,...] — 1-based.
      if (input.weakPoints && input.weakPoints.length) {
       const SMALL_GROUPS_2X = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'delt_rear', 'delt_mid', 'arms']);
      const userDayMap = input.weakGroupDayMap;
      const allWeekNames = new Set(days.flatMap(d => d.exercises.map(e => norm(e.name))));
      const allWeekSubstitutionGroups = new Set(days.flatMap(d => d.exercises
        .map(e => findCatalogExerciseByLabel(e.name)?.substitutionGroup)
        .filter((group): group is string => Boolean(group))));
      const fallbackPm = input.fallbackPm ?? 80;

        for (const wg of input.weakPoints) {
          const selectedExercises = input.weakGroupExerciseMap?.[wg];
          // Оборудование профиля: если задано — разрешаем только доступные снаряды.
          const equipmentSet = (input.equipment && input.equipment.length > 0)
            ? new Set(input.equipment.map(eq => eq.toLowerCase()))
            : null;
          const candidates = getPLWeakGroupExerciseCandidates(template, wg)
            .filter(ex => !selectedExercises || selectedExercises.length === 0 || selectedExercises.includes(ex.name))
            .filter(ex => !input.orthopedicBlockedPatterns?.includes(ex.movementPattern || derivePattern(ex)))
            .filter((ex: Exercise) => !allWeekNames.has(norm(ex.name)))
            .filter((ex: Exercise) => !ex.substitutionGroup || !allWeekSubstitutionGroups.has(ex.substitutionGroup))
            .filter((ex: Exercise) => {
              if (!equipmentSet) return true;
              const eq = String(ex.equipment || '').toLowerCase();
              return eq === 'bodyweight' || equipmentSet.has(eq);
            });
          if (candidates.length === 0) continue;

          // Тренерский MRV-бюджет слабой группы: суммарные сеты группы за неделю
          // не должны превышать MRV мышцы, скорректированный PED/recovery и
          // ACWR/авторегуляцией. Пользовательский ручной выбор не ограничивается.
          const weakMrv = (() => {
            try {
              const mrvMuscle = wg === 'legs' ? 'quads' : wg === 'core' ? 'abs' : wg === 'arms' ? 'arms' : wg;
              // vrLevel — нормализованный уровень атлета (novice→beginner, II-KMS→intermediate,
              // KMS-MS/MS-MSMK→advanced): ориентиры MEV/MAV/MRV зависят от уровня спортсмена.
              const lm = getVolumeLandmarks(vrLevel, mrvMuscle);
              if (!lm) return null;
              const mult = Math.max(1, combinedMrvMult) * acwrVolMod * arVolMult;
              return Math.round(lm.mrv * mult);
            } catch { return null; }
          })();
          const weakSetsThisWeek = (): number => days.reduce((sum, d) => sum + d.exercises
            .filter(e => groupOfExercise(e.name, exEnGroup(e.group) || '') === wg)
            .reduce((s, e) => s + e.workSets.reduce((n, ws) => n + ws.sets, 0), 0), 0);
          const noMrvCap = Boolean(selectedExercises && selectedExercises.length > 0);

        // Определить число дней для добивки
        const isSmall = SMALL_GROUPS_2X.has(wg);
        let targetDayCount = isSmall ? 2 : 1;
        // Пользовательский override выбора дней
        let targetDays: number[] = [];
        if (userDayMap && userDayMap[wg]) {
          targetDays = userDayMap[wg].slice(0, days.length).filter(d => d >= 1 && d <= days.length);
          targetDayCount = targetDays.length;
        }
        if (targetDays.length === 0) {
          // Авто-распределение: найти дни с минимальным объёмом целевой мышцы (для spread)
          const dayStats: { idx: number; cnt: number; isLegsDay: boolean; isUpperDay: boolean }[] = [];
          for (let di = 0; di < days.length; di++) {
            const cnt = days[di].exercises
              .filter(e => groupOfExercise(e.name, exEnGroup(e.group) || '') === wg)
              .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
            const dayMuscleGroups = new Set(days[di].exercises.map(e => exEnGroup(e.group) || ''));
            const isLegsDay = dayMuscleGroups.has('quads') || dayMuscleGroups.has('hamstrings') || dayMuscleGroups.has('glutes');
            const isUpperDay = dayMuscleGroups.has('chest') || dayMuscleGroups.has('back') || dayMuscleGroups.has('shoulders');
            dayStats.push({ idx: di, cnt, isLegsDay, isUpperDay });
          }
          // Сортировать по возрастанию объёма мышцы (min volume = best для spread)
          // Затем для ног → предпочесть не-ноги день; для upper → предпочесть upper.
          // Используем единую сортировку с несколькими критериями, чтобы сохранить volume-order.
          const isWpLegs = ['quads', 'hamstrings', 'glutes', 'calves'].includes(wg);
          const isWpUpper = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'].includes(wg);
          dayStats.sort((a, b) => {
            // Primary: объём целевой мышцы (меньше = лучше для spread)
            if (a.cnt !== b.cnt) return a.cnt - b.cnt;
            // Secondary: предпочтение типа дня (для spread между днями с равным объёмом)
            if (isWpLegs) {
              // Ноги-weak → предпочесть не-ноги день (чтобы не перегружать ноги)
              if (a.isLegsDay !== b.isLegsDay) return a.isLegsDay ? 1 : -1;
            } else if (isWpUpper) {
              // Upper-weak → предпочесть upper день
              if (a.isUpperDay !== b.isUpperDay) return a.isUpperDay ? -1 : 1;
            }
            return 0;
          });
          // Взять top targetDayCount дней — обновляем после каждой группы чтобы spread
          targetDays = dayStats.slice(0, targetDayCount).map(s => s.idx + 1);
        }

        // ПРОТОКОЛ СЛАБОЙ ГРУППЫ — ИЗ РАСКЛАДКИ ЦИКЛА (не выдуманный):
        // берём ВСЕ set-блоки реального аксессуара этого дня недели цикла.
        // Так сохраняются волны %ПМ, повторов и подходов конкретной недели.
        // RIR берётся из самого set-блока, если источник его задаёт, иначе из RIR_MATRIX.
        const accSpecsOfDay = (dayIdx: number): SRExerciseSpec[] => {
          const day = weekLayout[dayIdx];
          if (!day) return [];
          return day.exercises.filter((s: SRExerciseSpec) => s.load !== 'Тяжелая' && s.sets && s.sets.length > 0);
        };
        const dayProtocol = (dayIdx: number, wg: string): { sets: SRSetSpec[]; load: string } => {
          const daySpecs = accSpecsOfDay(dayIdx);
          const weekSpecs = weekLayout.flatMap((d: SRDaySpec) => d.exercises)
            .filter((s: SRExerciseSpec) => s.load !== 'Тяжелая' && s.sets && s.sets.length > 0);
          // Сначала берём аксессуар на ту же мышечную группу, затем самый лёгкий
          // неосновной протокол недели. Если в выбранном дне нет такой группы,
          // ищем её аксессуар в другой тренировке этого же микроцикла, а не
          // подменяем его случайным жимом/основным движением.
          const sourceGroup = (s: SRExerciseSpec): string => groupOfExercise(s.name, exEnGroup(s.group) || '');
          const sameDay = daySpecs.filter(s => sourceGroup(s) === wg);
          const sameWeek = weekSpecs.filter(s => sourceGroup(s) === wg);
          const pool = sameDay.length > 0 ? sameDay : sameWeek.length > 0 ? sameWeek : daySpecs.length > 0 ? daySpecs : weekSpecs;
          const rankedPool = [...pool].sort((a, b) => {
            const aGroup = sourceGroup(a) === wg ? 0 : 1;
            const bGroup = sourceGroup(b) === wg ? 0 : 1;
            if (aGroup !== bGroup) return aGroup - bGroup;
            const aLight = a.load === 'Легкая' ? 0 : 1;
            const bLight = b.load === 'Легкая' ? 0 : 1;
            if (aLight !== bLight) return aLight - bLight;
            return (a.coef || 0) - (b.coef || 0);
          });
          const spec = rankedPool[0] as SRExerciseSpec | undefined;
          const sets = spec?.sets?.length ? spec.sets.map(s => ({ ...s })) : [{ pct: 0.6, reps: 8, sets: 3 }];
          return {
            sets,
            load: spec?.load === 'Легкая' ? 'Легкая' : 'Средняя',
          };
        };

        // Для каждого выбранного дня — добавить accessory упражнение с протоколом ЭТОГО дня цикла.
        for (let ti = 0; ti < targetDays.length; ti++) {
          const dayIdx = targetDays[ti] - 1;
          if (dayIdx < 0 || dayIdx >= days.length) continue;
          const targetDay = days[dayIdx];
          const proto = dayProtocol(dayIdx, wg);
          // Кандидаты уже отфильтрованы и отсортированы общим PL-пулом.
          const poolFiltered = candidates.filter(ex =>
            !allWeekNames.has(norm(ex.name)) &&
            (!ex.substitutionGroup || !allWeekSubstitutionGroups.has(ex.substitutionGroup)) &&
            !targetDay.exercises.some(e => norm(e.name) === norm(ex.name))
          );
          if (poolFiltered.length === 0) continue;
          const pick = poolFiltered[0] as Exercise;

          // RIR: источник цикла имеет приоритет; если RIR не задан — база фазы
          // с запасом для аксессуара (легкий протокол +2, средний +1).
          const wPm = pmFor(pick.name, pmRow, fallbackPm);
          const workSets = proto.sets.map(set => {
            const setRir = Number.isFinite(set.rir)
              ? Math.max(0, set.rir as number)
              : Math.max(0, rirBase + (proto.load === 'Легкая' ? 2 : 1));
            return {
              pct: set.pct,
              reps: Math.max(1, set.reps),
              sets: Math.max(1, set.sets),
              weight: workWeight(wPm, set.pct),
              rir: setRir,
            };
          });
          const rir = workSets[0]?.rir ?? Math.max(0, rirBase + 1);
          // User explicitly selected these weak groups — always add, no MRV cap.
          // Day cap: упражнений ≤ 10 (raised from 8 to allow user-selected additions)
          if (targetDay.exercises.length >= 10) continue;

          // Тренерский MRV-бюджет слабой группы: суммарные сеты группы за неделю
          // (уровень атлета × PED/recovery × ACWR/авторегуляция) не должны превышать
          // скорректированный MRV мышцы. Ручной выбор пользователя — вне бюджета.
          const addedSets = workSets.reduce((sum, ws) => sum + ws.sets, 0);
          if (!noMrvCap && weakMrv != null && weakSetsThisWeek() + addedSets > weakMrv) {
            weakNotes.push(`⚠ Слабая группа ${wg} (${vrLevel}): ${pick.name} не добавлен — объём ${weakSetsThisWeek() + addedSets} сетов > MRV ${weakMrv} (уровень ×${Math.max(1, combinedMrvMult).toFixed(2)} PED/восст ×${acwrVolMod} ACWR ×${arVolMult} авторег).`);
            continue;
          }

          // P2: coef by catalog type — compound ~0.7, isolation ~0.3, fallback 0.5
          const accCoef = pick?.type === 'compound' ? 0.7 : pick?.type === 'isolation' ? 0.3 : 0.5;
          targetDay.exercises.push({
            name: pick.name,
            group: wg,
            coef: accCoef,
            mnosz: 1,
            load: proto.load,
            pm: wPm,
            rir,
            workSets,
          });
          allWeekNames.add(norm(pick.name));
          if (pick.substitutionGroup) allWeekSubstitutionGroups.add(pick.substitutionGroup);
          weakNotes.push(`🔥 Слабая группа ${wg} (${vrLevel}) — PL-ассистент в день ${dayIdx + 1} (${proto.load}): ${pick.name} ${workSets.map(set => `${set.sets}×${set.reps} @${Math.round(set.pct * 100)}%`).join(' + ')} (${Math.round(workSets[0]?.weight || 0)}кг) RIR ${rir} · объём группы ${weakSetsThisWeek()} сетов ≤ MRV ${weakMrv ?? '—'}.`);
        }
      }
    }
    // Пересчёт метрик сессий (после возможной инъекции слабых точек)
    for (const d of days) {
      const metricsEx: SRExercise[] = d.exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      d.metrics = calcSessionMetrics(metricsEx);
    }

    weeks.push({
      week: weekNumber,
      pmRow,
      days,
      sourcePhase: sourceSnapshots[w % sourceSnapshots.length]?.phase,
      sourcePhaseOrigin: sourceSnapshots[w % sourceSnapshots.length]?.phaseOrigin,
    });
  }

  const allSessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetricsAggregate(allSessions, totalWeeks);

  const proRationale = [
    rationale,
    levelPmNote,
    nutritionNote,
    input.volumeGoal ? `Объём аксессуаров: ${input.volumeGoal === 'mev' ? 'минимальный (MEV)' : input.volumeGoal === 'mrv' ? 'максимальный (MRV)' : 'оптимальный (MAV)'}.` : '',
    input.focusLift ? `Приоритет: акцент на ${input.focusLift === 'squat' ? 'присед' : input.focusLift === 'bench' ? 'жим' : 'тягу'} (+20% объёма).` : '',
    input.weakPoints?.length ? `Слабые группы: ${input.weakPoints.join(', ')} (+20% объёма для упражнений на эти группы).` : '',
    `S-MRV: объём сессий автоматически ограничен бюджетом утомления (Ready: ${input.currentReadiness ?? 80}%).`,
    input.peds?.length ? `💉 PED-адаптация (dose-aware): MRV ×${pedMrvMult.toFixed(2)}, восст ×${pedRecMult.toFixed(2)}.` : '',
    (input.bodyFat != null || input.hrvMs != null || input.sleepHours != null) ? `🔄 Recovery multiplier: ×${recoveryMult.toFixed(2)} (bodyFat/HRV/sleep/stress). Итог MRV ×${combinedMrvMult.toFixed(2)}.` : '',
    input.acwr ? `📊 ACWR ${input.acwr.ratio.toFixed(1)} (${acwrZone}): объём×${acwrVolMod}, RIR+${acwrRirShift}${acwrDeload ? ', deload' : ''}.` : '',
    input.autoReg ? `🧠 Авторегуляция: топ-сет×${arTopMult}, объём×${arVolMult}, RIR+${arRirShift}${input.autoReg.deload ? ', deload' : ''}.` : '',
    ...weakNotes,
  ].filter(Boolean).join(' ');

  // P1: Авто-taper к финальным 2 неделям (peaking phase) — снижение объёма, интенсивность сохранена.
  // Применяется только для auto-прогрессирующих циклов (не faithful) и при отсутствии ACWR-deload.
  const taperedWeeks = (!faithful && !hasExplicitWeeks && totalWeeks >= 4 && !acwrDeload)
    ? applyPLTaper(weeks, totalWeeks)
    : weeks;

  const taperNote = taperedWeeks !== weeks ? ' 📉 Taper: финальные 2 нед — объём ×0.65/0.45, интенсивность сохранена (Bosquet 2005).' : '';

  return { template, progressionRationale: proRationale + taperNote, weeks: taperedWeeks, cycleMetrics, plVolumeLandmarks: getPLVolumeLandmarks(taperedWeeks, template.meta.level, combinedMrvMult) };
}

/**
 * Прикиды соревновательного дня из ПМ-строки финальной тапер-недели.
 * Основные движения ищутся по имени (присед / жим лёжа / становая) — как в UI.
 * Если соревновательных движений нет (армрестлинг и т.п.) — возвращает null.
 */
export function computeMeetAttemptsFromPmRow(pmRow: Record<string, number>, strategy: MeetStrategy = 'balanced'): MeetAttemptsInfo | null {
  const keys = Object.keys(pmRow).filter(k => Number.isFinite(pmRow[k]) && pmRow[k] > 0);
  const pick = (re: RegExp): string | undefined => keys.find(k => re.test(norm(k)));
  const liftKeys = [
    pick(/присед|сквот/),
    pick(/жим.*леж|леж.*жим/),
    pick(/станов/),
  ].filter((k): k is string => !!k);
  if (liftKeys.length === 0) return null;
  return {
    strategy,
    lifts: liftKeys.map(name => {
      const att = meetAttemptsFor(pmRow[name], strategy);
      return { name, ...att, warmup: warmupToOpener(att.opener) };
    }),
  };
}

/**
 * PL Taper: снижение объёма (сетов) к финальным 2 неделям цикла (peaking phase).
 * Интенсивность (вес) сохраняется — снижается только объём (Bosquet 2005, Bosquet et al.).
 * Неделя N-1: объём ×0.65; неделя N: объём ×0.45. RIR растёт на 1-2.
 */
function applyPLTaper(weeks: LMSPlanWeek[], totalWeeks: number): LMSPlanWeek[] {
  if (weeks.length < 4) return weeks;
  const lastIdx = weeks.length - 1;
  const prevIdx = lastIdx - 1;
  if (prevIdx < 0) return weeks;
  // Канон (lms-taper.engine): классика Bosquet — объём ×0.65/×0.45, RIR +1/+2.
  const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic' });

  const weekVolume = (wk: LMSPlanWeek): number => {
    let v = 0;
    for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
    return v;
  };
  const refVolume = (() => {
    for (let i = prevIdx - 1; i >= 0; i--) {
      const phase = mesocyclePhaseForWeek(weeks[i].week, totalWeeks);
      if (phase === 'deload') continue;
      const vol = weekVolume(weeks[i]);
      if (vol > 0) return vol;
    }
    return 0;
  })();

   return weeks.map((wk, idx) => {
     if (idx !== prevIdx && idx !== lastIdx) return wk;
      // Guard: если неделя уже low-volume (< 60% от предыдущей) — не применять taper.
      // PL-3 FIX: also skip deload weeks
       const phase = mesocyclePhaseForWeek(wk.week, totalWeeks);
       if (phase === 'deload') return wk;
      if (refVolume > 0 && weekVolume(wk) < refVolume * 0.6) return wk;
     const volumeMult = curve[idx === prevIdx ? 0 : 1].volumePct;
     const rirAdd = curve[idx === prevIdx ? 0 : 1].rirShift;
     const targetSets = Math.max(1, Math.round(refVolume * volumeMult));
     const currentSets = Math.max(1, weekVolume(wk));
     const setScale = targetSets / currentSets;
     const newDays = wk.days.map(d => ({
      ...d,
      exercises: d.exercises.map(e => ({
        ...e,
        workSets: e.workSets.map(ws => ({
          ...ws,
           sets: Math.max(1, Math.round(ws.sets * setScale)),
          rir: ws.rir + rirAdd,
        })),
      })),
    }));
    for (const d of newDays) {
      const metricsEx: SRExercise[] = d.exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      d.metrics = calcSessionMetrics(metricsEx);
    }
    const week: LMSPlanWeek = { ...wk, days: newDays, taperWeek: true };
    // Выход на пик: прикиды соревновательного дня (по умолчанию сбалансированная 92/96/102%).
    if (idx === lastIdx) {
      const attempts = computeMeetAttemptsFromPmRow(week.pmRow, 'balanced');
      if (attempts) week.meetAttempts = attempts;
    }
    return week;
  });
}


/**
 * Реальное применение тапера к ДЕЙСТВУЮЩЕМУ циклу: добавляет N тапер-недель
 * в конец готового плана (LMSBuildOutput). В отличие от applyPLTaper (который
 * только модифицирует последние 2 недели при сборке), эта функция именно
 * РАСШИРЯЕТ план: новая неделя N-1 → объём ×0.65 + RIR+1, неделя N → ×0.45 + RIR+2
 * (Bosquet 2005). Добавленные недели помечаются sourcePhase='peak' +
 * macroPhase='competition' для корректного отображения.
 *
 * PED-адаптация — ТА ЖЕ, что в buildLMSPlan (не выдумана заново):
 *  - mode='on_course' → прогрессия ПМ k = 1.5/2.0/2.5% в неделю по courseIntensity,
 *    mode='pct' → −0.5% (ПМ падает), natural → correctionPct шаблона;
 *  - ПМ продолжает расти/падать в taper-неделях: pmRow[name] × (1+k) за неделю;
 *  - веса пересчитываются workWeight(pm, pct) — как в buildLMSPlan:800;
 *  - adaptForPEDs (dose-aware) → pedMrvMult/pedRecMult для аннотации и
 *    объёмной адаптации (как buildLMSPlan:703-708).
 */
export function appendPLTaperWeeks(
  plan: LMSBuildOutput,
  taperWeeks: number,
  opts?: {
    peds?: PED[];
    pedDoses?: Record<string, number>;
    courseIntensity?: 'mild' | 'moderate' | 'heavy';
    mode?: ProgressionMode;
    weeklyPercent?: number;
    /** Выход на пик: прикиды соревновательного дня на финальной тапер-неделе
     *  (консервативная 90/95.5/100, сбалансированная 92/96/102, агрессивная 93/97/105%).
     *  Прикиды — план дня соревнований, а не тренировочная нагрузка. */
    peakExit?: { strategy?: MeetStrategy };
    /** Имитация соревнований (mock meet) за 10-14 дней до старта: неделя ПЕРЕД
     *  тапер-неделями, в которой основные движения выполняются как прикиды-синглы
     *  (опенер RIR2 → вторая RIR1 → третья RIR0), аксессуары — 50% объёма. */
    mockMeet?: { strategy?: MeetStrategy };
    /** Неделя соревнований В КОНЦЕ (после тапер-недель): прикиды как подходы дня
     *  старта (опенер/вторая/третья ×1), аксессуары — 50% объёма. */
    meetWeek?: { strategy?: MeetStrategy };
    /** Авторегуляция (режим «АВТО»): масштабирование весов/объёма/RIR
     *  применяется и к тапер-неделям, mock-неделе и неделе соревнований —
     *  выбранный режим (нет/дневник/авто) работает для ВСЕХ недель плана. */
    autoReg?: { topSetPctMultiplier: number; volumeMultiplier: number; rirShift: number };
    /** Питание (как в buildLMSPlan): профицит калорий и белок г/кг →
     *  MRV soft-cap в тапер-неделях (Helms 2022). */
    nutrition?: { calorieSurplus?: number; proteinPerKg?: number };
    /** Данные к соревнованиям: фактический ПМ после цикла (реально поднятый)
     *  и планируемый ПМ в федерации. Тапер строится под РАЗНИЦУ ПМ:
     *  тренировочные веса тапера — от фактического ПМ, прикиды/попытки — от
     *  планируемого (целевые веса соревнования). Ключи — имена упражнений. */
    meetData?: {
      actualPm?: Record<string, number>;
      plannedPm?: Record<string, number>;
    };
    /** Режим пика (канон lms-taper.engine): 'classic' — разгрузка Bosquet (интенсивность
     *  сохранена, RIR вверх); 'pl' — 3-нед ПЛ-пик-протокол Библиотеки (объём 85/75/60%,
     *  интенсивность 90/95/100%, RIR 1-2/0-1/0, синглы на интенсивной неделе);
     *  'pro' — усталость-зависимая кривая (объём ~0.65/0.45/0.40, инт. ~92%, прайминг). */
    peakMode?: TaperMode;
    /** Весовая цель тапера: 'lose' — сгонка (объём ×0.9, MRV ниже на дефиците, Helms 2022),
     *  'gain' — набор к категории, 'maintain'/'auto' — вес стабилен. */
    weightGoal?: TaperWeightGoal;
    /** Восстановительная неделя ПОСЛЕ недели соревнований (post-meet): лёгкий объём,
     *  высокий RIR — возврат к тренировкам без перегруза. */
    postMeet?: { volumeMult?: number };
    /** Раскладка финальной (пиковой) недели: 'attempts' — прикиды соревновательного
     *  дня на финальной тапер-неделе; 'light' — только разминка 50/70/90% без прикидов
     *  (контрольные старты; mock meet/неделя соревнований всегда с прикидами). */
    peakLayout?: PeakWeekLayout;
    /** Прайминг-синглы 60/70% в неделе соревнований (за 1-2 дня до старта):
     *  активация ЦНС без утомления. По умолчанию вкл. */
    priming?: boolean;
  },
): LMSBuildOutput {
  if (!plan || taperWeeks < 1 || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan;
  const last = plan.weeks[plan.weeks.length - 1];
  const nextWeekNum = last.week + 1;
  const lastPhase = mesocyclePhaseForWeek(last.week, plan.weeks.length);
  // База тапер-недель: последняя НЕ-deload неделя (иначе делод станет основой
  // тапера — разгрузка поверх разгрузки, объём некуда снижать).
  const baseWeek = (() => {
    if (lastPhase !== 'deload') return last;
    for (let i = plan.weeks.length - 2; i >= 0; i--) {
      const wk = plan.weeks[i];
      if (mesocyclePhaseForWeek(wk.week, plan.weeks.length) !== 'deload') return wk;
    }
    return last;
  })();
  // Канон: единая кривая тапера (lms-taper.engine) — режим × весовая цель.
  const taperCurvePoints = buildPLTaperCurve({ taperWeeks, mode: opts?.peakMode ?? 'classic', weightGoal: opts?.weightGoal });

  // ── PED-адаптация по аналогии с buildLMSPlan (строки 697-762) ──
  const activePeds = (opts?.peds ?? []).filter(ped => {
    const dose = opts?.pedDoses?.[ped];
    return dose != null && Number.isFinite(Number(dose)) && Number(dose) > 0;
  });
  // Режим прогрессии: явный mode, иначе on_course при активном курсе (как UI buildSrc).
  const mode: ProgressionMode = opts?.mode ?? (activePeds.length > 0 ? 'on_course' : 'natural');
  const rawK = (opts?.weeklyPercent != null ? opts.weeklyPercent
    : mode === 'on_course' ? (opts?.courseIntensity === 'mild' ? 0.015 : opts?.courseIntensity === 'heavy' ? 0.025 : 0.02)
    : mode === 'pct' ? -0.005
    : (plan.template?.meta?.correctionPct ?? 0.005));
  // Уровень спортсмена (как в buildLMSPlan): натурал/custom — k ≥ levelK.
  const taperLevel = vrLevelKey(plan.template?.meta?.level as string | undefined ?? 'intermediate');
  const levelK = (mode === 'natural' || mode === 'custom') ? levelPmFloor(taperLevel) : null;
  const k = (levelK != null && rawK < levelK) ? levelK : rawK;
  let pedMrvMult = 1;
  let pedRecMult = 1;
  if (activePeds.length > 0) {
    try {
      const level = plan.template?.meta?.level as string | undefined;
      const baseMrv = level
        ? Object.fromEntries(Object.entries(getAllVolumeLandmarks(level)).map(([kv, v]) => [kv, v.mrv]))
        : {};
      const adapt = adaptForPEDs(activePeds, baseMrv, opts?.pedDoses, opts?.courseIntensity ?? 'moderate');
      pedMrvMult = adapt.combinedMrvMultiplier || 1;
      pedRecMult = adapt.combinedRecoveryMultiplier || 1;
    } catch { /* leave 1.0 */ }
  }
  // На курсе объём аксессуаров в taper-неделях не режем ниже PED-адаптированного
  // уровня (как buildLMSPlan:784 применяет Math.min(1.5, pedMrvMult) к аксессуарам).
  // Питание (как в buildLMSPlan nutritionMult) участвует в том же soft-cap.
  const nutritionMult = Math.max(0.6, Math.min(1.5, (() => {
    let n = 1;
    const cal = opts?.nutrition?.calorieSurplus;
    const pro = opts?.nutrition?.proteinPerKg;
    if (cal != null) n *= cal > 300 ? 1.1 : cal > 100 ? 1.05 : cal < -200 ? 0.8 : 1.0;
    if (pro != null) n *= pro >= 2.0 ? 1.1 : pro >= 1.6 ? 1.05 : pro < 1.0 ? 0.85 : 1.0;
    return n;
  })()));
  const nutritionTaperNote = nutritionMult !== 1
    ? ` 🥗 Питание в taper-неделях: MRV ${nutritionMult > 1 ? '+' : ''}${Math.round((nutritionMult - 1) * 100)}% (калории ${opts?.nutrition?.calorieSurplus ?? 0} ккал, белок ${opts?.nutrition?.proteinPerKg ?? 0} г/кг; Helms 2022).`
    : '';
  const pedVolFloor = Math.min(1.5, pedMrvMult * nutritionMult);

  const refVolume = (() => {
    // Эталон объёма: последняя НЕ-deload неделя (иначе делод станет базой тапера).
    for (let i = plan.weeks.length - 1; i >= 0; i--) {
      const wk = plan.weeks[i];
      if (mesocyclePhaseForWeek(wk.week, plan.weeks.length) === 'deload') continue;
      let v = 0;
      for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
      if (v > 0) return v;
    }
    return 0;
  })();

  // ── Прикиды под РАЗНИЦУ ПМ (проф. правило): ──
  // 1) Если задан планируемый ПМ федерации — от него (цель), НО не выше
  //    фактического ПМ × 1.02 (реалистичный потолок: нельзя планировать попытки,
  //    которых физически нет — опенер обязан «садиться»).
  // 2) Если плана нет — от фактического ПМ после цикла.
  // 3) Если ничего не задано — от прогноза недели (pmRow).
  const resolveAttemptRow = (pmRow: Record<string, number>): { row: Record<string, number>; capped: string[] } => {
    const capped: string[] = [];
    const actual = opts?.meetData?.actualPm ?? {};
    const planned = opts?.meetData?.plannedPm ?? {};
    const hasActual = Object.values(actual).some(v => v > 0);
    const hasPlanned = Object.values(planned).some(v => v > 0);
    let row = { ...pmRow };
    if (hasPlanned) {
      for (const [name, plan] of Object.entries(planned)) {
        if (!(plan > 0)) continue;
        const fact = actual[name];
        if (hasActual && fact > 0 && plan > fact * 1.02) {
          // План выше факта — прикиды от реалистичного потолка (факт × 1.02),
          // иначе опенер будет заведомо неподъёмным.
          row[name] = Math.round(fact * 1.02 * 10) / 10;
          capped.push(name);
        } else {
          row[name] = plan;
        }
      }
    } else if (hasActual) {
      for (const [name, fact] of Object.entries(actual)) {
        if (fact > 0) row[name] = Math.round(fact * 10) / 10;
      }
    }
    return { row, capped };
  };

  const buildTaperWeek = (idx: number, pt: TaperCurvePoint): LMSPlanWeek => {
    // Прогрессия ПМ продолжается по курсу (как buildLMSPlan:757-762): +k за неделю,
    // НО если задан ФАКТИЧЕСКИЙ ПМ после цикла (реально поднятый) — тапер строится
    // от него (разница ПМ: факт вместо прогноза), прогрессия в тапере = 0.
    const pmGrowth = opts?.meetData?.actualPm ? 1 : Math.pow(1 + k, idx + 1);
    const pmRow: Record<string, number> = {};
    for (const [name, pm] of Object.entries(baseWeek.pmRow)) {
      const actual = opts?.meetData?.actualPm?.[name];
      pmRow[name] = actual != null && actual > 0
        ? Math.round(actual * 10) / 10
        : Math.round(pm * pmGrowth * 10) / 10;
    }
    const isFinal = idx === taperWeeks - 1;
    // Соревновательная неделя ПЛ-протокола (100% ПМ): основные движения — только разминка
    // 50/70/90% × 3/2/1 + прикиды (meetAttempts) отдельно: «разминка → открытие → 2-3 прохода».
    const protocolFinal = isFinal && pt.warmupOnly === true;
    const days = baseWeek.days.map(d => {
      const exercises = d.exercises.map(e => {
        // Подготовительные прикиды на тапер-неделях (кроме финальной):
        // пробный сингл ~80% от ПМ недели для основных движений — «прощупать»
        // траекторию перед соревнованием, не нагружая (разгрузка сохраняется).
        const isMain = e.load === 'main' || e.load === 'Тяжелая';
        // Подготовительные прикиды — только в разгрузочных режимах (классика/pro):
        // пробный сингл ~80% от ПМ недели «прощупать траекторию» перед соревнованием.
        // В ПЛ-протоколе (set_pct) интенсивность диктует сам протокол — prepSets не нужны.
        const prepSets = (!isFinal && isMain && pt.intensityMode === 'preserve')
          ? [{ sets: 1, reps: 1, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.8) * 10) / 10, rir: 2, pct: 0.8 }]
          : [];
        if (protocolFinal && isMain) {
          const warmup = [
            { sets: 1, reps: 3, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.5) * 10) / 10, rir: 3, pct: 0.5 },
            { sets: 1, reps: 2, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.7) * 10) / 10, rir: 2, pct: 0.7 },
            { sets: 1, reps: 1, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.9) * 10) / 10, rir: 1, pct: 0.9 },
          ];
          return { ...e, rir: pt.rirTarget ?? 0, workSets: warmup };
        }
        return {
          ...e,
          rir: pt.rirTarget != null ? pt.rirTarget : e.rir + pt.rirShift,
          workSets: [
            ...prepSets,
            ...e.workSets.map(ws => {
              const pm = pmRow[e.name] ?? e.pm;
              // Интенсивность: классика — сохранена (вес от прежнего pct);
              // pl/pro — по канону (абсолютный % ПМ, синглы на интенсивной неделе).
              const pct = isMain && pt.intensityMode === 'set_pct' && pt.intensityPct > 0 ? pt.intensityPct : ws.pct;
              const reps = isMain && pt.singles ? 1 : ws.reps;
              const weight = Math.round(workWeight(pm, pct) * 10) / 10;
              return {
                ...ws,
                sets: Math.max(1, Math.round(ws.sets * pt.volumePct * (isMain ? 1 : pedVolFloor))),
                reps,
                pct,
                weight,
                rir: pt.rirTarget != null ? pt.rirTarget : ws.rir + pt.rirShift,
              };
            }),
          ],
        };
      });
      const metricsEx: SRExercise[] = exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { ...d, exercises, metrics: calcSessionMetrics(metricsEx) };
    });
    const week: LMSPlanWeek = {
      week: nextWeekNum + offsetBefore + idx,
      pmRow,
      days,
      sourcePhase: 'peak' as MesocyclePhase,
      sourcePhaseOrigin: 'inferred' as const,
      macroPhase: 'competition' as const,
      taperWeek: true,
      ...(pt.label ? { taperNote: pt.label + (pt.focus ? `: ${pt.focus}` : '') } : {}),
    };
    // Выход на пик 105% (или выбранной стратегии): прикиды дня соревнований
    // от ПМ финальной тапер-недели (или планируемого ПМ федерации — если задан).
    // Тренировочная нагрузка остаётся разгрузочной (×0.45, RIR+2); прикиды — план соревнований.
    // peakLayout='light' — только разминка без прикидов (контрольный старт).
    if (idx === taperWeeks - 1 && opts?.peakLayout !== 'light') {
      const { row, capped } = resolveAttemptRow(week.pmRow);
      const attempts = computeMeetAttemptsFromPmRow(row, peakStrategy);
      if (attempts) {
        week.meetAttempts = attempts;
        if (capped.length > 0) week.taperNote = `План федерации выше факта для: ${capped.join(', ')} — прикиды от реалистичного потолка (факт ×1.02).`;
      }
    }
    return week;
  };

  // ── Неделя прикидов (mock meet ИЛИ соревнования): прикиды как подходы ──
  const buildAttemptsWeek = (idx: number, kind: 'mock' | 'meet'): LMSPlanWeek | null => {
    const strategy = kind === 'mock' ? mockStrategy : meetStrategy;
    // Прогрессия ПМ продолжается по курсу (как тапер-недели): +k за неделю.
    // Если задан ФАКТИЧЕСКИЙ ПМ после цикла — используем его (разница ПМ).
    const pmGrowth = opts?.meetData?.actualPm ? 1 : Math.pow(1 + k, idx + 1);
    const pmRow: Record<string, number> = {};
    for (const [name, pm] of Object.entries(baseWeek.pmRow)) {
      const actual = opts?.meetData?.actualPm?.[name];
      pmRow[name] = actual != null && actual > 0
        ? Math.round(actual * 10) / 10
        : Math.round(pm * pmGrowth * 10) / 10;
    }
    // Прикиды считаются от ПЛАНИРУЕМОГО ПМ в федерации (если задан) — целевые
    // веса соревнования; иначе от фактического ПМ; иначе от ПМ своей недели.
    const { row: attemptRow, capped } = resolveAttemptRow(pmRow);
    const attempts = computeMeetAttemptsFromPmRow(attemptRow, strategy);
    if (!attempts) return null;
    const liftByName = new Map(attempts.lifts.map(l => [norm(l.name), l]));
    // Соответствие упражнения → прикиды: точное совпадение имени, иначе fuzzy
    // по regex соревновательных движений (как computeMeetAttemptsFromPmRow) —
    // чтобы прикиды попадали в правильные упражнения ЛЮБОГО цикла
    // (например, «Приседания со штангой», «Жим штанги лёжа узким хватом»).
    const matchLift = (name: string) => {
      const exact = liftByName.get(norm(name));
      if (exact) return exact;
      const n = norm(name);
      if (/присед|сквот/.test(n)) return attempts.lifts.find(l => /присед|сквот/.test(norm(l.name)));
      if (/жим.*леж|леж.*жим/.test(n)) return attempts.lifts.find(l => /жим.*леж|леж.*жим/.test(norm(l.name)));
      if (/станов/.test(n)) return attempts.lifts.find(l => /станов/.test(norm(l.name)));
      return undefined;
    };
    const days = baseWeek.days.map(d => {
      const exercises = d.exercises.map(e => {
        const lift = matchLift(e.name);
        if (lift) {
          // Прикиды-синглы: опенер RIR2 → вторая RIR1 → третья RIR0 (как день соревнований).
          // pct — процент прикидки от ПМ недели (93/97/105% по стратегии).
          const mk = (weight: number, rir: number) => ({
            pct: Math.round((weight / Math.max(1, pmRow[e.name] ?? e.pm)) * 1000) / 1000,
            reps: 1,
            sets: 1,
            weight,
            rir,
          });
          // 🔥 Прайминг за 1-2 дня до старта (только в неделе соревнований):
          // синглы 60/70% — активация ЦНС без утомления.
          const priming = (kind === 'meet' && opts?.priming !== false)
            ? [
                { sets: 1, reps: 1, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.6) * 10) / 10, rir: 3, pct: 0.6 },
                { sets: 1, reps: 1, weight: Math.round(workWeight(pmRow[e.name] ?? e.pm, 0.7) * 10) / 10, rir: 3, pct: 0.7 },
              ]
            : [];
          return { ...e, rir: 1, workSets: [...priming, mk(lift.opener, 2), mk(lift.second, 1), mk(lift.third, 0)] };
        }
        return {
          ...e,
          rir: e.rir + 1,
          workSets: e.workSets.map(ws => ({ ...ws, sets: Math.max(1, Math.round(ws.sets * 0.5)) })),
        };
      });
      const metricsEx: SRExercise[] = exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { ...d, exercises, metrics: calcSessionMetrics(metricsEx) };
    });
    return {
      week: nextWeekNum + idx,
      pmRow,
      days,
      sourcePhase: 'peak' as MesocyclePhase,
      sourcePhaseOrigin: 'inferred' as const,
      macroPhase: 'competition' as const,
      [kind === 'mock' ? 'mockMeet' : 'meetWeek']: true,
      meetAttempts: attempts,
      taperNote: kind === 'meet' && opts?.priming !== false
        ? '🔥 прайминг за 1-2 дня до старта: синглы 60/70% на основных лифтах (активация ЦНС), затем прикиды.' + (capped.length > 0 ? ` План федерации выше факта для: ${capped.join(', ')} — прикиды от реалистичного потолка (факт ×1.02).` : '')
        : (capped.length > 0 ? `План федерации выше факта для: ${capped.join(', ')} — прикиды от реалистичного потолка (факт ×1.02).` : undefined),
    };
  };

  const mockMeetOn = !!opts?.mockMeet;
  const meetWeekOn = !!opts?.meetWeek;
  const mockStrategy = opts?.mockMeet?.strategy ?? opts?.peakExit?.strategy ?? 'balanced';
  const meetStrategy = opts?.meetWeek?.strategy ?? opts?.peakExit?.strategy ?? 'balanced';
  const peakStrategy = opts?.peakExit?.strategy ?? 'balanced';
  const offsetBefore = mockMeetOn ? 1 : 0;
  const extra: LMSPlanWeek[] = [];
  if (mockMeetOn) {
    const wk = buildAttemptsWeek(0, 'mock');
    if (wk) extra.push(wk);
  }
  // Раскладка пика — канон (lms-taper.engine): 'classic' — разгрузка Bosquet;
  // 'pl' — 3-нед протокол Библиотеки (при taperWeeks < 3 — последние N недель
  // протокола, финал всегда соревновательный 100% с прикидами);
  // 'pro' — усталость-зависимая кривая с праймингом.
  const taperMode: TaperMode = opts?.peakMode ?? 'classic';
  for (let i = 0; i < taperWeeks; i++) {
    extra.push(buildTaperWeek(i, taperCurvePoints[i]));
  }
  if (meetWeekOn) {
    const wk = buildAttemptsWeek(extra.length, 'meet');
    if (wk) extra.push(wk);
  }
  // Пост-соревновательная неделя (post-meet): лёгкий объём, высокий RIR —
  // возврат к тренировкам после прикидок без перегруза.
  if (opts?.postMeet) {
    const baseWk = extra[extra.length - 1] ?? baseWeek;
    const pmRow: Record<string, number> = { ...baseWk.pmRow };
    const volMult = Math.max(0.3, Math.min(1, opts.postMeet.volumeMult ?? 0.5));
    const days = baseWk.days.map(d => {
      const exercises = d.exercises.map(e => ({
        ...e,
        rir: e.rir + 3,
        workSets: e.workSets.map(ws => ({ ...ws, sets: Math.max(1, Math.round(ws.sets * volMult)), rir: ws.rir + 3 })),
      }));
      const metricsEx: SRExercise[] = exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { ...d, exercises, metrics: calcSessionMetrics(metricsEx) };
    });
    extra.push({
      week: nextWeekNum + extra.length,
      pmRow,
      days,
      sourcePhase: 'deload' as MesocyclePhase,
      sourcePhaseOrigin: 'inferred' as const,
      macroPhase: 'transition' as const,
      postMeet: true,
      taperNote: `Восстановление после соревнований: объём ×${volMult}, RIR +3 — полная разгрузка, возврат к базовому объёму со следующей недели.`,
    });
  }

  // ── Авторегуляция («АВТО»): масштабирование применяется ко ВСЕМ добавленным
  // неделям (тапер/mock/соревнования) — выбранный режим работает везде. ──
  const autoRegNote = opts?.autoReg
    ? ` 📡 Авторегуляция применена к таперу/прикидкам: вес ×${opts.autoReg.topSetPctMultiplier.toFixed(2)}, объём ×${opts.autoReg.volumeMultiplier.toFixed(2)}, RIR +${opts.autoReg.rirShift}.`
    : '';
  if (opts?.autoReg) {
    const ar = opts.autoReg;
    for (const wk of extra) {
      for (const d of wk.days) {
        for (const e of d.exercises) {
          e.workSets = e.workSets.map(ws => ({
            ...ws,
            weight: Math.round(ws.weight * ar.topSetPctMultiplier * 10) / 10,
            sets: Math.max(1, Math.round(ws.sets * ar.volumeMultiplier)),
            rir: Math.max(0, (ws.rir ?? 2) + ar.rirShift),
          }));
        }
      }
      if (wk.meetAttempts) {
        // Прикиды масштабируются авторегуляцией ЗДЕСЬ (единая точка в движке) —
        // веса прикидов соответствуют скорректированным тренировочным весам недели.
        wk.meetAttempts = {
          ...wk.meetAttempts,
          lifts: wk.meetAttempts.lifts.map(l => ({
            ...l,
            opener: Math.round(l.opener * ar.topSetPctMultiplier * 10) / 10,
            second: Math.round(l.second * ar.topSetPctMultiplier * 10) / 10,
            third: Math.round(l.third * ar.topSetPctMultiplier * 10) / 10,
            target: Math.round(l.target * ar.topSetPctMultiplier * 10) / 10,
          })),
        };
      }
    }
  }

  const weeks = [...plan.weeks, ...extra];
  const allSessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetricsAggregate(allSessions, weeks.length);

  const pedNote = activePeds.length > 0
    ? ` 💉 PED-адаптация (dose-aware): MRV ×${pedMrvMult.toFixed(2)}, восст ×${pedRecMult.toFixed(2)}; прогрессия ПМ ${k >= 0 ? '+' : ''}${(k * 100).toFixed(1)}%/нед продолжена в taper-неделях.`
    : '';

  // Выход на пик: описание стратегии прикидов финальной недели (как в тапер-калькуляторе).
  const peakPct = MEET_STRATEGY_PCT_LABEL[peakStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced;
  const peakLabel = peakStrategy === 'aggressive' ? 'агрессивная' : peakStrategy === 'conservative' ? 'консервативная' : 'сбалансированная';
  const weightGoalNote = opts?.weightGoal === 'lose'
    ? ' ⬇ Сгонка к категории: объём тапера ×0.9 (дефицит → MRV ниже, Helms 2022).'
    : opts?.weightGoal === 'gain'
      ? ' ⬆ Набор к категории: объём тапера полный (профицит — полное восстановление).'
      : '';
  const peakNote = opts?.peakMode === 'pl'
    ? ` 🏁 ПЛ-пик-протокол (3 нед): объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR 1-2/0-1/0; прикиды соревновательного дня ${peakPct} (${peakLabel}).`
    : opts?.peakMode === 'pro'
      ? ` 🎯 Про-тапер (усталость-зависимый): объём ~0.65/0.45/0.40, интенсивность ~92% ПМ, прайминг; прикиды соревновательного дня ${peakPct} (${peakLabel}).`
      : opts?.peakMode === 'wf'
        ? ` 🎢 Classic WF (Библиотека): 2 нед перегрузка (объём ×1.15/×1.20, инт. 70/75%) → суперкомпенсация (×0.60/×0.40, инт. 90/100%); прикиды соревновательного дня ${peakPct} (${peakLabel}).`
        : ` 🏁 Выход на пик: прикиды соревновательного дня ${peakPct} от ПМ финальной недели (${peakLabel} стратегия).`;
  const peakLayoutNote = opts?.peakLayout === 'light'
    ? ' 🎭 Раскладка финальной недели: light — только разминка 50/70/90% без прикидов (контрольный старт).'
    : '';
  const mockWk = weeks.find(w => w.mockMeet);
  const meetWk = weeks.find(w => w.meetWeek);
  const postMeetWk = weeks.find(w => w.postMeet);
  const mockNote = mockWk
    ? ` 🎯 Имитация соревнований (mock meet): неделя ${mockWk.week} — прикиды-синглы ${MEET_STRATEGY_PCT_LABEL[mockStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced} от ПМ, аксессуары ×0.5.`
    : '';
  const meetNote = meetWk
    ? ` 🏁 Неделя соревнований: ${meetWk.week} — прикиды (${MEET_STRATEGY_PCT_LABEL[meetStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}) как подходы дня старта (опенер/вторая/третья ×1)${opts?.priming !== false ? ' + 🔥 прайминг-синглы 60/70% за 1-2 дня' : ''}.`
    : '';
  const postMeetNote = postMeetWk
    ? ` 🔄 Пост-соревновательная неделя: ${postMeetWk.week} — объём ×${opts?.postMeet?.volumeMult ?? 0.5}, RIR +3 (восстановление после старта).`
    : '';
  const taperCurveSummary = summarizeTaperCurve(taperCurvePoints);

  // Отчёт качества (Объём vs MRV) пересчитывается с учётом taper-недель
  // и PED-множителя — иначе peakWeek/статусы остаются от исходного плана.
  const level = plan.template?.meta?.level as string | undefined;
  const plVolumeLandmarks = level
    ? getPLVolumeLandmarks(weeks, level, Math.max(1, pedMrvMult))
    : plan.plVolumeLandmarks;

  return {
    ...plan,
    weeks,
    cycleMetrics,
    plVolumeLandmarks,
    progressionRationale: plan.progressionRationale +
      ` 📉 Тапер к действующему циклу: +${taperWeeks} нед(и) — ${taperCurveSummary} (${taperMode === 'pl' ? 'ПЛ-пик-протокол' : taperMode === 'pro' ? 'про-тапер по усталости' : 'Bosquet 2005'}).` +
      weightGoalNote +
      peakLayoutNote +
      mockNote +
      meetNote +
      postMeetNote +
      peakNote +
      pedNote +
      nutritionTaperNote +
      autoRegNote +
      (lastPhase === 'deload' ? ' ⚠ Последняя неделя была разгрузкой — тапер построен от последней НЕ-deload недели (разгрузка поверх разгрузки не нужна).' : ''),
  };
}

/**
 * Пересчёт прикидов соревновательного дня на лету: обновляет meetAttempts на всех
 * неделях плана, где они есть (mock meet + финальная тапер-неделя), под выбранную
 * стратегию — без повторного добавления тапера. Не мутирует исходный план.
 */
export function refreshMeetAttempts(plan: LMSBuildOutput, strategy: MeetStrategy = 'balanced'): LMSBuildOutput {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan;
  let changed = false;
  const weeks = plan.weeks.map(wk => {
    if (!wk.meetAttempts || wk.meetAttempts.strategy === strategy) return wk;
    const attempts = computeMeetAttemptsFromPmRow(wk.pmRow, strategy);
    if (!attempts) return wk;
    changed = true;
    return { ...wk, meetAttempts: attempts };
  });
  if (!changed) return plan;
  const label = strategy === 'aggressive' ? 'агрессивная' : strategy === 'conservative' ? 'консервативная' : 'сбалансированная';
  return {
    ...plan,
    weeks,
    progressionRationale: plan.progressionRationale +
      ` 🔄 Прикиды пересчитаны: ${MEET_STRATEGY_PCT_LABEL[strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced} (${label}).`,
  };
}

function calcCycleMetricsAggregate(sessions: SRExercise[][], weeksCount: number): SRCycleMetrics {
  const perSession = sessions.map(s => calcSessionMetrics(s));
  let tonnage = 0, kpsh = 0, relIntWeighted = 0, intFB = 0, uoiNum = 0;
  for (const s of perSession) {
    tonnage += s.tonnage; kpsh += s.kpsh;
    relIntWeighted += s.relIntensity * s.kpsh; intFB += s.intFB; uoiNum += s.uoi * s.kpsh;
  }
  return {
    tonnage, kpsh,
    avgWeight: kpsh > 0 ? tonnage / kpsh : 0,
    relIntensity: kpsh > 0 ? relIntWeighted / kpsh : 0,
    intFB,
    uoi: kpsh > 0 ? uoiNum / kpsh : 0,
    sessions: perSession.length,
    perSession,
  };
}

/**
 * Агрегация объёма PL-плана по группам мышц и сравнение с volume-landmarks (MEV/MAV/MRV).
 * Берётся пиковая по суммарному объёму неделя (наиболее нагруженная) — «худший случай».
 */
export function getPLVolumeLandmarks(weeks: LMSPlanWeek[], level: string, pedMrvMult = 1): PLVolumeLandmark[] {
  let peakIdx = 0, peakTotal = -1;
  const weekGroups: Record<number, Record<string, number>> = {};
  weeks.forEach((wk, i) => {
    const g: Record<string, number> = {};
    for (const day of wk.days) for (const ex of day.exercises) {
      const eg = exEnGroup(ex.group); if (!eg) continue;
      const sets = ex.workSets.reduce((s, ws) => s + ws.sets, 0);
      g[eg] = (g[eg] || 0) + sets;
    }
    weekGroups[i] = g;
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    if (total > peakTotal) { peakTotal = total; peakIdx = i; }
  });
  const peak = weekGroups[peakIdx] || {};
  // Делегируем в канонический движок (единый источник MEV/MAV/MRV по EN-мышцам).
  const rows = computeVolumeLandmarks(peak, level, { labMult: pedMrvMult, peakWeek: peakIdx + 1 });
  return rows.map(r => {
    const status: PLVolumeLandmark['status'] =
      r.status === 'below_mev' ? 'under' :
      r.status === 'optimal' ? 'optimal' :
      r.status === 'approaching_mrv' ? 'high' : 'over';
    return { group: r.group, muscle: r.label, peakWeek: r.peakWeek ?? (peakIdx + 1), sets: r.sets, mev: r.mev, mav: r.mav, mrv: r.mrv, status };
  });
}
  // OHP варианты ('Жим стоя', 'Жим штанги стоя', 'Жим гантелей стоя') ловятся через norm('Жим') вхождением в любое 'Жим ... стоя'.
