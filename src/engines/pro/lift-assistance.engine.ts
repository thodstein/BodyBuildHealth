/**
 * lift-assistance.engine.ts — анализ оптимальности ассистентных упражнений
 * для диагностики движения (мёртвые точки / слабые точки / bar-path).
 *
 * Для каждой слабой фазы/отклонения:
 *  - берутся слабые мышцы фазы (weakMuscles) → PL-пул разрешённых паттернов;
 *  - исключаются основные лифты цикла и их primary-паттерны (не дублируем нагрузку);
 *  - упражнения ранжируются: паттерн в PL-пуле → совпадение с раскладкой цикла →
 *    PL-использование (LMS_EXERCISES) → оборудование → fatigueCost;
 *  - топ-1 помечается optimal:true с rationale («почему оптимально»);
 *  - каждому упражнению сопоставляется протокол из раскладки цикла
 *    (set-блоки аксессуара дня/недели: pct/reps/sets) — как у слабых групп.
 */
import type { Exercise } from '../../core/types';
import { getExercisesByGroup } from '../../core/exercise-catalog';
import { derivePattern } from '../movement-pattern';
import { norm } from '../norm';
import { LMS_EXERCISES } from '../../data/lms-cycles/lms-exercises';
import { PL_WEAK_GROUP_ALLOWED_PATTERNS } from '../lms/lms-builder.engine';
import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec } from '../../data/lms-cycles/lms-types';
import { diagnoseLift, BAR_PATH_ISSUES, type BarPathIssue } from './lift-diagnostics.engine';
import { diagnoseWeakPoint } from '../lms/weakpoint-pl';
import type { Lift, WeakPoint } from '../lms/weakpoint-pl';

/** Слабая мышца фазы (RU-название) → группа для PL-пула. */
function weakMuscleGroup(muscle: string): string | null {
  const l = muscle.toLowerCase();
  if (/трицеп|бицеп|arm/.test(l)) return 'arms';
  if (/дельт|плеч|shoulder/.test(l)) return 'shoulders';
  if (/груд|chest|pec/.test(l)) return 'chest';
  if (/спин|широк|трап|back|lat|разгибат|выпрямл/.test(l)) return 'back';
  if (/квадр|ягод|икр|бедр|ног|leg|quad|glute|calf/.test(l)) return 'legs';
  if (/пресс|кор|core|ab/.test(l)) return 'core';
  return null;
}

/** Ключи каталога, подходящие под группу из weakMuscles. */
function groupsForLiftPhase(lift: Lift, phase: WeakPoint): string[] {
  const sticking = diagnoseLift(lift, phase);
  const groups = new Set<string>();
  if (sticking) {
    for (const muscle of sticking.weakMuscles) {
      const group = weakMuscleGroup(muscle);
      if (group) groups.add(group);
    }
  }
  // Fallback: для движений без угловой диагностики (ohp/row/pulldown/incline_press)
  // слабые мышцы не распознаются — используем типичные группы движения.
  const LIFT_FALLBACK_GROUPS: Record<Lift, string[]> = {
    bench: ['chest', 'arms'],
    squat: ['legs'],
    deadlift: ['back', 'legs'],
    ohp: ['shoulders', 'arms'],
    row: ['back', 'arms'],
    pulldown: ['back', 'arms'],
    incline_press: ['chest', 'arms'],
    sumo: ['legs', 'back'],
    biceps: ['arms'],
  };
  const fallback = LIFT_FALLBACK_GROUPS[lift] ?? [];
  for (const g of fallback) groups.add(g);
  return [...groups];
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

/** Паттерн упражнения по его названию (через каталог). */
function exercisePatternByName(name: string): string {
  const n = norm(name);
  const all = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(group => getExercisesByGroup(group));
  const ex = all.find(e => norm(e.name) === n);
  return ex ? catalogPattern(ex) : '';
}

export interface AssistanceAnalysisItem {
  exercise: Exercise;
  /** Для каких групп фазы подходит (weakMuscles → PL-группа). */
  targetGroup: string;
  /** Топ-1 рекомендуемое упражнение для проработки параметра. */
  optimal: boolean;
  /** Почему это упражнение оптимально/подходит. */
  rationale: string;
  /** Источник упражнения: слабая мышца / слабая точка / мёртвая точка / bar-path. */
  source: 'muscle' | 'weak' | 'sticking' | 'bar';
  /** Протокол из раскладки цикла (set-блоки аксессуара дня/недели) + RIR. */
  protocol: { pct: number; reps: number; sets: number; rir: number };
  /** Паттерн движения упражнения. */
  pattern: string;
}

export interface AssistanceAnalysis {
  lift: Lift;
  phase: WeakPoint | null;
  issue: BarPathIssue | null;
  items: AssistanceAnalysisItem[];
}

const DEFAULT_PROTOCOL = { pct: 0.6, reps: 10, sets: 3, rir: 2 };

/** Русское имя движения (для rationale). */
const LIFT_RU: Record<Lift, string> = {
  bench: 'жим лёжа', squat: 'присед', deadlift: 'становая тяга',
  ohp: 'жим стоя', row: 'тяга в наклоне', pulldown: 'тяга верхнего блока', incline_press: 'жим на наклонной',
  sumo: 'становая тяга (сумо)', biceps: 'подъём на бицепс',
};

/** Группа упражнения → что она нагружает (для rationale по тренерски). */
const GROUP_TARGET_RU: Record<string, string> = {
  chest: 'грудные', shoulders: 'дельты (плечи)', back: 'спину', legs: 'ноги',
  arms: 'руки (бицепс/трицепс)', core: 'кор',
};

function targetRu(group: string): string {
  return GROUP_TARGET_RU[group] ?? group;
}

/** Чистка названия для поиска: norm + скобки + числа/единицы («2 секунды», «3 см»). */
function searchTokens(name: string): string[] {
  return norm(name.replace(/\(.*?\)/g, ' '))
    .split(/[^a-zа-яё0-9]+/i)
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !['сек', 'см', 'мин', 'секунд', 'секунды'].includes(t));
}

/** Префикс-совпадение токенов (пауза/паузой, дожим/дожимы, присед/приседания). */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length, 5);
  if (n < 4) return false;
  return a.slice(0, n) === b.slice(0, n);
}

/** LMS-группы СРЦ-пула («Жим», «Тяга», «Присед»…) → группа общего каталога. */
function lmsGroupToCatalog(groups: string[]): string {
  const g = groups.join(' ').toLowerCase();
  if (/тяга|становая|гипер|наклон|шраги/.test(g)) return 'back';
  if (/жим стоя|стоя|плеч|махи|дельт/.test(g)) return 'shoulders';
  if (/жим/.test(g)) return 'chest';
  if (/присед|выпад|разгибание ног|жим ногами/.test(g)) return 'legs';
  if (/бицепс|сгибан|разгибание|подъем|подъём/.test(g)) return 'arms';
  if (/пресс|скруч|кор/.test(g)) return 'core';
  return 'accessory';
}

/** Псевдо-Exercise из записи СРЦ-пула (LMS_EXERCISES) для отображения в диагностике. */
function lmsToExercise(lms: { name: string; groups: string[]; coef: number; mnosz: number; uses: number }): Exercise {
  const catalogMatch = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g))
    .find(e => norm(e.name) === norm(lms.name));
  return {
    id: 'lms_' + norm(lms.name).replace(/[^a-zа-яё0-9]+/gi, '_'),
    name: lms.name,
    group: catalogMatch ? catalogMatch.group : lmsGroupToCatalog(lms.groups),
    type: 'compound',
    equipment: 'barbell',
    difficulty: 'intermediate',
    jointStress: 'med',
    fatigueCost: Math.round((lms.coef ?? 1) * 6),
    movementPattern: catalogMatch?.movementPattern,
    targetMuscle: lms.groups.join(', '),
  };
}

/**
 * Поиск упражнения в ПЛ-пуле: СНАЧАЛА общий каталог (точное/fuzzy имя) —
 * это даёт полные метаданные; ЗАТЕМ СРЦ-пул LMS_EXERCISES (ПЛ-специфика:
 * дожимы с плинтов, жимы в раме, жимы с паузой, скоростные и т.д.).
 */
function findExerciseInPool(name: string, pool: Exercise[]): Exercise | undefined {
  const n = norm(name.replace(/\(.*?\)/g, ''));
  const exact = pool.find(e => norm(e.name) === n);
  if (exact) return exact;
  // ПЛ-специфика: точное имя в СРЦ-пуле LMS_EXERCISES (дожимы, рамы, паузы, скоростные).
  const lmsExact = LMS_EXERCISES.find(l => norm(l.name) === n);
  if (lmsExact) return lmsToExercise(lmsExact);
  const tokens = searchTokens(name);
  if (tokens.length === 0) return undefined;
  let best: Exercise | undefined;
  let bestScore = 0;
  for (const e of pool) {
    const en = norm(e.name);
    const eTokens = searchTokens(e.name);
    let score = 0;
    for (const t of tokens) {
      if (eTokens.some(et => tokenMatch(et, t))) score += 1;
      else if (t.length >= 5 && en.includes(t)) score += 1;
    }
    if (score >= 2 && score > bestScore) { best = e; bestScore = score; }
  }
  if (best) return best;
  // Fallback: один длинный токен как substring («наклоны» → «наклоны со штангой»)
  for (const t of tokens) {
    if (t.length >= 5) {
      const hit = pool.find(e => norm(e.name).includes(t));
      if (hit) return hit;
    }
  }
  // Fuzzy в СРЦ-пуле LMS
  const lmsTokens = searchTokens(name);
  let bestLms: (typeof LMS_EXERCISES)[number] | undefined;
  let bestLmsScore = 0;
  for (const l of LMS_EXERCISES) {
    const lt = searchTokens(l.name);
    let score = 0;
    for (const t of lmsTokens) {
      if (lt.some(et => tokenMatch(et, t))) score += 1;
    }
    if (score >= 2 && score > bestLmsScore) { bestLms = l; bestLmsScore = score; }
  }
  if (bestLms) return lmsToExercise(bestLms);
  // Один длинный токен в LMS
  for (const t of lmsTokens) {
    if (t.length >= 5) {
      const hit = LMS_EXERCISES.find(l => norm(l.name).includes(t));
      if (hit) return lmsToExercise(hit);
    }
  }
  return undefined;
}

/**
 * Протокол из раскладки цикла: берём set-блоки реального аксессуара (load !== 'Тяжелая')
 * из выбранного дня/недели шаблона. Приоритет — аксессуар на целевую группу.
 */
export function protocolFromCycle(template: SRCycleTemplate | undefined, targetGroup: string): { pct: number; reps: number; sets: number; rir: number } {
  if (!template) return DEFAULT_PROTOCOL;
  const layouts = template.weeks && template.weeks.length > 0 ? template.weeks : [template.week1];
  const accSpecs: SRExerciseSpec[] = layouts.flatMap((days: SRDaySpec[]) => days.flatMap((day: SRDaySpec) =>
    day.exercises.filter((spec: SRExerciseSpec) => spec.load !== 'Тяжелая' && spec.sets && spec.sets.length > 0)));
  if (accSpecs.length === 0) return DEFAULT_PROTOCOL;
  const pattern = (spec: SRExerciseSpec): string => {
    const all = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(group => getExercisesByGroup(group));
    const ex = all.find(e => norm(e.name) === norm(spec.name));
    return ex ? catalogPattern(ex) : '';
  };
  const allowed = PL_WEAK_GROUP_ALLOWED_PATTERNS[targetGroup] ?? [];
  const match = accSpecs.find(spec => allowed.includes(pattern(spec)));
  const spec = match ?? accSpecs[0];
  const first = spec?.sets?.[0];
  if (!first) return DEFAULT_PROTOCOL;
  // RIR ассистента: из раскладки цикла (RIR-матрицы), иначе аксессуарный дефолт 2.
  return { pct: first.pct, reps: Math.max(2, first.reps), sets: Math.max(1, first.sets), rir: first.rir ?? 2 };
}

/**
 * Анализ упражнений для СЛАБОЙ ТОЧКИ фазы движения:
 * только специфичные ассистенты слабой точки (weakpoint-pl, assistanceFromCatalog).
 * Если упражнение перекрывает несколько фаз движения — пояснение об этом.
 */
export function analyzePhaseAssistance(lift: Lift, phase: WeakPoint, template?: SRCycleTemplate): AssistanceAnalysis {
  const items: AssistanceAnalysisItem[] = [];
  const allExercisesPool = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g));
  const added = new Set<string>();

  // Карта «имя упражнения → фазы движения, где оно рекомендовано» (для пояснений перекрытий).
  const phases = LIFT_PHASES_ALL[lift] ?? [];
  const overlapMap: Record<string, string[]> = {};
  for (const p of phases) {
    const base = diagnoseWeakPoint(lift, p);
    for (const n of base.assistance) {
      const key = norm(n.replace(/\(.*?\)/g, ''));
      (overlapMap[key] = overlapMap[key] || []).push(p);
    }
  }

  // Специфичные ассистенты слабой точки (weakpoint-pl) — ПЛ-коррекции фазы.
  const wp = diagnoseWeakPoint(lift, phase);
  for (const name of wp.assistance) {
    const exercise = findExerciseInPool(name, allExercisesPool);
    if (!exercise) continue;
    const en = norm(exercise.name);
    if (added.has(en)) continue;
    added.add(en);
    const group = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).find(g =>
      getExercisesByGroup(g).some(e => norm(e.name) === en)) ?? exercise.group;
    const overlaps = (overlapMap[norm(name.replace(/\(.*?\)/g, ''))] || []).filter(p => p !== phase);
    const overlapNote = overlaps.length > 0
      ? ` Перекрывает также фазу${overlaps.length > 1 ? 'ы' : ''}: ${overlaps.join(', ')} — одно упражнение закрывает несколько фаз.`
      : '';
    items.push({
      exercise,
      targetGroup: group,
      optimal: false,
      rationale: `Слабая точка «${wp.label}» (${LIFT_RU[lift]}): ${exercise.name} — ассистент фазы, устраняет причину срыва.${overlapNote}`,
      source: 'weak',
      protocol: protocolFromCycle(template, group),
      pattern: catalogPattern(exercise),
    });
  }

  if (items.length > 0) items[0] = { ...items[0], optimal: true };
  return { lift, phase, issue: null, items };
}

/** Все фазы каждого движения (для карты перекрытий). */
const LIFT_PHASES_ALL: Record<Lift, WeakPoint[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
  sumo: ['sumo_start', 'sumo_mid', 'sumo_lockout'],
  biceps: ['biceps_start', 'biceps_mid', 'biceps_top'],
};

/**
 * Анализ оптимальности для отклонения bar-path: ПЛ-коррекции из
 * BAR_PATH_ISSUES.assistance (СРЦ-пул: скоростные, остановки, плинты и т.д.).
 */
export function analyzeBarPathAssistance(lift: Lift, issue: BarPathIssue, template?: SRCycleTemplate): AssistanceAnalysis {
  const meta = BAR_PATH_ISSUES[issue];
  const allExercises = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g));

  const layouts = template?.weeks && template.weeks.length > 0 ? template.weeks : template ? [template.week1] : [];
  const cycleNames = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises.map(spec => norm(spec.name)))));

  const items: AssistanceAnalysisItem[] = [];
  const added = new Set<string>();

  // ПЛ-коррекции отклонения: per-lift пул (если задан) или общий assistance.
  const poolNames = meta.assistanceByLift?.[lift] ?? meta.assistance;
  for (const name of poolNames) {
    const n = norm(name);
    if (added.has(n)) continue;
    const exercise = findExerciseInPool(name, allExercises);
    if (!exercise) continue;
    added.add(norm(exercise.name));
    const group = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).find(g =>
      getExercisesByGroup(g).some(e => norm(e.name) === norm(exercise.name))) ?? exercise.group;
    const inCycle = cycleNames.has(n);
    items.push({
      exercise,
      targetGroup: group,
      optimal: false,
      rationale: `Коррекция отклонения «${issue}» (${LIFT_RU[lift]}): ${exercise.name}${inCycle ? '; уже присутствует в раскладке цикла' : ''}.`,
      source: 'bar',
      protocol: protocolFromCycle(template, group),
      pattern: catalogPattern(exercise),
    });
  }

  // Пометка топ-1 из пула как оптимального.
  if (items.length > 0) items[0] = { ...items[0], optimal: true };
  return { lift, phase: null, issue, items };
}

/**
 * Анализ упражнений-коррекций мёртвой точки (sticking.corrections → ПЛ-пул) —
 * для секции «2 · Мёртвые точки»: коррекции углов становятся выбираемыми.
 * Для движений без угловой диагностики (ohp/row/pulldown/incline_press) —
 * мёртвых точек нет → items пуст (в UI пояснение).
 */
export function analyzeStickingCorrections(lift: Lift, phase: WeakPoint, template?: SRCycleTemplate): AssistanceAnalysis {
  const sticking = diagnoseLift(lift, phase);
  if (!sticking) return { lift, phase, issue: null, items: [] };
  const allExercises = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g));
  const items: AssistanceAnalysisItem[] = [];
  const added = new Set<string>();

  // Коррекции из биомеханической диагностики (STICKING_POINTS.corrections).
  for (const name of sticking.corrections) {
    const clean = norm(name.replace(/\(.*?\)/g, ''));
    if (added.has(clean)) continue;
    const exercise = findExerciseInPool(name, allExercises);
    if (!exercise) continue;
    added.add(norm(exercise.name));
    const group = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).find(g =>
      getExercisesByGroup(g).some(e => norm(e.name) === norm(exercise.name))) ?? exercise.group;
    items.push({
      exercise,
      targetGroup: group,
      optimal: false,
      rationale: `Коррекция мёртвой точки «${sticking.phaseLabel}» (${sticking.keyJoint}, угол ${sticking.angleRangeDeg[0]}°–${sticking.angleRangeDeg[1]}°).`,
      source: 'sticking',
      protocol: protocolFromCycle(template, group),
      pattern: catalogPattern(exercise),
    });
  }

  if (items.length > 0) items[0] = { ...items[0], optimal: true };
  return { lift, phase, issue: null, items };
}
