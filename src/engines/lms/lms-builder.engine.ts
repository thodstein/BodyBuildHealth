/**
 * lms-builder.engine.ts — генерация полного плана СРЦ из шаблона недели 1 + PM + прогрессии.
 * Этап A3/B. Связывает: lms-types (шаблон) + lms-progression (PM по неделям) + lms-metrics (веса/метрики).
 *
 * СРЦ = саморасчитывающийся: неделя 1 — раскладка (% от PM), недели 2..N = та же раскладка
 * с PM, растущим на correctionPct каждую неделю. Вес подхода = PM_нед × pct × mnosz.
 */

import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec } from '../../data/lms-cycles/lms-types';
import { pmProgression, workWeight, progressionRationale, type ProgressionMode, type PMProgressionInput } from './lms-progression.engine';
import { calcSessionMetrics, type SRExercise, type SRSessionMetrics, type SRCycleMetrics } from './lms-metrics.engine';

export interface LMSBuildInput {
  template: SRCycleTemplate;
  /** PM юзера по ключевым упражнениям (кг). Если упражнения в раскладке нет — берётся из fallback. */
  pmMap: Record<string, number>;
  fallbackPm?: number;
  mode?: ProgressionMode;
  weeklyPercent?: number;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
}

export interface LMSWorkSet {
  pct: number;
  reps: number;
  sets: number;
  weight: number; // расчётный вес (кг)
}

export interface LMSPlanExercise {
  name: string;
  group: string;
  coef: number;
  mnosz: number;
  load?: string;
  pm: number;
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
}

export interface LMSBuildOutput {
  template: SRCycleTemplate;
  progressionRationale: string;
  weeks: LMSPlanWeek[];
  cycleMetrics: SRCycleMetrics;
}

/** Извлечь уникальные имена упражнений из шаблона недели 1. */
export function extractExercises(tpl: SRCycleTemplate): string[] {
  const set = new Set<string>();
  for (const day of tpl.week1) for (const ex of day.exercises) set.add(ex.name);
  return [...set];
}

function pmFor(exName: string, pmMap: Record<string, number>, fallback: number): number {
  if (pmMap[exName] != null) return pmMap[exName];
  // эвристика: жимовые/присед/тяга — попытка сопоставления по ключам
  const keys = Object.keys(pmMap);
  for (const k of keys) {
    if (exName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(exName.toLowerCase())) {
      return pmMap[k];
    }
  }
  return fallback;
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

export function buildLMSPlan(input: LMSBuildInput): LMSBuildOutput {
  const { template, pmMap, fallbackPm = 100 } = input;
  const mode = input.mode ?? 'natural';
  const exercises = extractExercises(template);
  const pm0Map: Record<string, number> = {};
  for (const name of exercises) pm0Map[name] = pmFor(name, pmMap, fallbackPm);

  // прогрессия PM для каждого упражнения
  const progInput: PMProgressionInput = {
    pm0: 100, weeks: template.meta.weeks, mode,
    weeklyPercent: input.weeklyPercent, courseIntensity: input.courseIntensity,
  };
  const rationale = progressionRationale({ ...progInput, pm0: 100 });

  const weeks: LMSPlanWeek[] = [];
  for (let w = 0; w < template.meta.weeks; w++) {
    const pmRow: Record<string, number> = {};
    for (const name of exercises) {
      const k = (input.weeklyPercent != null ? input.weeklyPercent
        : mode === 'on_course' ? (input.courseIntensity === 'mild' ? 0.015 : input.courseIntensity === 'heavy' ? 0.025 : 0.02)
        : mode === 'pct' ? -0.005 : template.meta.correctionPct);
      pmRow[name] = pm0Map[name] * Math.pow(1 + k, w);
    }
    const days: LMSPlanDay[] = template.week1.map((day: SRDaySpec) => {
      const dayTag = dayLoadTag(day.exercises as { load?: string }[]);
      const planEx: LMSPlanExercise[] = day.exercises.map((spec: SRExerciseSpec) => {
        const pm = pmRow[spec.name];
        const workSets: LMSWorkSet[] = spec.sets.map(s => ({
          pct: s.pct, reps: s.reps, sets: s.sets,
          weight: workWeight(pm, s.pct)  // AUD-FIX-A: mnosz не входит в вес грифа (только в тоннаж),
        }));
        return { name: spec.name, group: spec.group, coef: spec.coef, mnosz: spec.mnosz, load: cleanLoad(spec.load, dayTag), pm, workSets };
      });
      // метрики сессии (преобразование в SRExercise для lms-metrics)
      const metricsEx: SRExercise[] = planEx.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { exercises: planEx, metrics: calcSessionMetrics(metricsEx) };
    });
    weeks.push({ week: w + 1, pmRow, days });
  }

  // агрегатные метрики цикла (по первой неделе как представителю; полный агрегат — сумма всех недель)
  const allSessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetricsAggregate(allSessions, template.meta.weeks);

  return { template, progressionRationale: rationale, weeks, cycleMetrics };
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