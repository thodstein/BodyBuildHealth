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
  if (/спин|широк|трап|back|lat/.test(l)) return 'back';
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
  /** Источник упражнения: слабая точка (weakpoint-pl) / мёртвая точка (PL-пул) / bar-path. */
  source: 'weak' | 'sticking' | 'bar';
  /** Протокол из раскладки цикла (set-блоки аксессуара дня/недели). */
  protocol: { pct: number; reps: number; sets: number };
  /** Паттерн движения упражнения. */
  pattern: string;
}

export interface AssistanceAnalysis {
  lift: Lift;
  phase: WeakPoint | null;
  issue: BarPathIssue | null;
  items: AssistanceAnalysisItem[];
}

const DEFAULT_PROTOCOL = { pct: 0.6, reps: 10, sets: 3 };

/** Русское имя движения (для rationale). */
const LIFT_RU: Record<Lift, string> = {
  bench: 'жим лёжа', squat: 'присед', deadlift: 'становая тяга',
  ohp: 'жим стоя', row: 'тяга в наклоне', pulldown: 'тяга верхнего блока', incline_press: 'жим на наклонной',
};

/** Группа упражнения → что она нагружает (для rationale по тренерски). */
const GROUP_TARGET_RU: Record<string, string> = {
  chest: 'грудные', shoulders: 'дельты (плечи)', back: 'спину', legs: 'ноги',
  arms: 'руки (бицепс/трицепс)', core: 'кор',
};

function targetRu(group: string): string {
  return GROUP_TARGET_RU[group] ?? group;
}

/**
 * Протокол из раскладки цикла: берём set-блоки реального аксессуара (load !== 'Тяжелая')
 * из выбранного дня/недели шаблона. Приоритет — аксессуар на целевую группу.
 */
export function protocolFromCycle(template: SRCycleTemplate | undefined, targetGroup: string): { pct: number; reps: number; sets: number } {
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
  return { pct: first.pct, reps: Math.max(2, first.reps), sets: Math.max(1, first.sets) };
}

/**
 * Анализ оптимальности для слабой фазы движения.
 */
export function analyzePhaseAssistance(lift: Lift, phase: WeakPoint, template?: SRCycleTemplate): AssistanceAnalysis {
  const groups = groupsForLiftPhase(lift, phase);
  const items: AssistanceAnalysisItem[] = [];

  const layouts = template?.weeks && template.weeks.length > 0 ? template.weeks : template ? [template.week1] : [];
  const cycleNames = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises.map(spec => norm(spec.name)))));
  const cyclePrimaryPatterns = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises
    .filter(spec => spec.load === 'Тяжелая' || (spec.coef ?? 0) >= 1)
    .map(spec => exercisePatternByName(spec.name)))).filter(Boolean));
  const cycleSubstitutionGroups = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises
    .map(spec => {
      const all = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(group => getExercisesByGroup(group));
      return all.find(e => norm(e.name) === norm(spec.name))?.substitutionGroup;
    })
    .filter((group): group is string => Boolean(group)))));

  const sticking = diagnoseLift(lift, phase);
  const weakMuscles = sticking?.weakMuscles ?? [];

  for (const group of groups) {
    const allowed = PL_WEAK_GROUP_ALLOWED_PATTERNS[group] ?? [];
    if (allowed.length === 0) continue;
    const candidates = getExercisesByGroup(group)
      .filter(ex => allowed.includes(catalogPattern(ex)))
      .filter(ex => !cyclePrimaryPatterns.has(catalogPattern(ex)))
      .filter(ex => !ex.substitutionGroup || !cycleSubstitutionGroups.has(ex.substitutionGroup))
      .sort((a, b) => {
        const aName = norm(a.name), bName = norm(b.name);
        const aInCycle = cycleNames.has(aName), bInCycle = cycleNames.has(bName);
        if (aInCycle !== bInCycle) return aInCycle ? -1 : 1;
        const aUses = plCatalogUses(a.name), bUses = plCatalogUses(b.name);
        if (aUses !== bUses) return bUses - aUses;
        const aEq = String(a.equipment || '').toLowerCase(), bEq = String(b.equipment || '').toLowerCase();
        const aRank = /band|резин|other/.test(aEq) ? 2 : /bodyweight|suspension/.test(aEq) ? 1 : 0;
        const bRank = /band|резин|other/.test(bEq) ? 2 : /bodyweight|suspension/.test(bEq) ? 1 : 0;
        if (aRank !== bRank) return aRank - bRank;
        return (a.fatigueCost || 0) - (b.fatigueCost || 0);
      });

    candidates.slice(0, 4).forEach((exercise, index) => {
      const inCycle = cycleNames.has(norm(exercise.name));
      const pattern = catalogPattern(exercise);
      const rationale = `Нагружает ${targetRu(group)} — поддержка мёртвой точки «${phase}» ${LIFT_RU[lift]} (слабые мышцы фазы: ${weakMuscles.join(', ') || '—'}); паттерн ${pattern}${inCycle ? ' совпадает с раскладкой цикла' : ''}; не дублирует основные лифты цикла.`;
      items.push({
        exercise,
        targetGroup: group,
        optimal: index === 0,
        rationale,
        source: 'sticking',
        protocol: protocolFromCycle(template, group),
        pattern,
      });
    });
  }

  // Дополнительно: упражнения фазы из weakpoint-pl (assistanceFromCatalog) —
  // они специфичны именно для этой фазы и не обязаны входить в PL-пул групп.
  const added = new Set(items.map(i => norm(i.exercise.name)));
  const wp = diagnoseWeakPoint(lift, phase);
  const allExercisesPool = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g));
  const findByName = (name: string): Exercise | undefined => {
    const n = norm(name);
    return allExercisesPool.find(e => {
      const en = norm(e.name);
      return en === n || (en.length > 2 && (en.includes(n) || n.includes(en)));
    });
  };
  for (const name of wp.assistance) {
    if (added.has(norm(name))) continue;
    const exercise = findByName(name);
    if (!exercise) continue;
    const group = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).find(g =>
      getExercisesByGroup(g).some(e => norm(e.name) === norm(exercise.name))) ?? exercise.group;
    items.push({
      exercise,
      targetGroup: group,
      optimal: false,
      rationale: `Нагружает ${targetRu(group)} — специфичный ассистент слабой точки «${wp.label}» ${LIFT_RU[lift]}; устраняет причину срыва в этой фазе.`,
      source: 'weak',
      protocol: protocolFromCycle(template, group),
      pattern: catalogPattern(exercise),
    });
  }

  return { lift, phase, issue: null, items };
}

/**
 * Анализ оптимальности для отклонения bar-path (ассистенты из BAR_PATH_ISSUES).
 */
export function analyzeBarPathAssistance(lift: Lift, issue: BarPathIssue, template?: SRCycleTemplate): AssistanceAnalysis {
  const meta = BAR_PATH_ISSUES[issue];
  const allExercises = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).flatMap(g => getExercisesByGroup(g));
  // Fuzzy-поиск по каталогу: «Болгарские сплит-приседы» → «Болгарские сплит-приседания».
  const findExercise = (name: string): Exercise | undefined => {
    const n = norm(name);
    return allExercises.find(e => {
      const en = norm(e.name);
      return en === n || (en.length > 2 && (en.includes(n) || n.includes(en)));
    });
  };
  const items: AssistanceAnalysisItem[] = [];
  for (const name of meta.assistance) {
    const exercise = findExercise(name);
    if (!exercise) continue;
    const group = (Object.keys(PL_WEAK_GROUP_ALLOWED_PATTERNS) as string[]).find(g =>
      getExercisesByGroup(g).some(e => norm(e.name) === norm(exercise.name))) ?? exercise.group;
    const layouts = template?.weeks && template.weeks.length > 0 ? template.weeks : template ? [template.week1] : [];
    const cycleNames = new Set(layouts.flatMap(days => days.flatMap(day => day.exercises.map(spec => norm(spec.name)))));
    const inCycle = cycleNames.has(norm(name));
    items.push({
      exercise,
      targetGroup: group,
      optimal: false,
      rationale: `Нагружает ${targetRu(group)} — коррекция отклонения «${issue}» для ${LIFT_RU[lift]}; упражнение из диагностического пула bar-path${inCycle ? '; уже присутствует в раскладке цикла' : ''}.`,
      source: 'bar',
      protocol: protocolFromCycle(template, group),
      pattern: catalogPattern(exercise),
    });
  }
  // Пометка топ-1 из пула как оптимального.
  if (items.length > 0) items[0] = { ...items[0], optimal: true };
  return { lift, phase: null, issue, items };
}
