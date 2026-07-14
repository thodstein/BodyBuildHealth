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
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { selectExercisesSmart } from '../exercise-selector.engine';

export interface LMSBuildInput {
  template: SRCycleTemplate;
  pmMap: Record<string, number>;
  fallbackPm?: number;
  mode?: ProgressionMode;
  weeklyPercent?: number;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  weeksOverride?: number;
  /** ПРОФ-параметры */
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  focusLift?: 'squat' | 'bench' | 'deadlift';
  currentReadiness?: number; // 0-100
  equipment?: string[];
  weakPoints?: string[];
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

/** Извлечь уникальные имена упражнений из шаблона (все недели, если заданы явно). */
export function extractExercises(tpl: SRCycleTemplate): string[] {
  const set = new Set<string>();
  const source = tpl.weeks && tpl.weeks.length ? tpl.weeks.flat() : tpl.week1;
  for (const day of source) for (const ex of day.exercises) set.add(ex.name);
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

  // Faithful multi-week: если задана явная раскладка ВСЕХ недель — используем её
  // дословно, БЕЗ авто-прогрессии (pct каждой недели уже отражает реальную нагрузку).
  const hasExplicitWeeks = !!(template.weeks && template.weeks.length);
  const totalWeeks = hasExplicitWeeks
    ? template.weeks!.length
    : Math.max(1, Math.round(input.weeksOverride ?? template.meta.weeks));

  const pm0Map: Record<string, number> = {};
  for (const name of exercises) pm0Map[name] = pmFor(name, pmMap, fallbackPm);

  // прогрессия PM для каждого упражнения
  const progInput: PMProgressionInput = {
    pm0: 100, weeks: totalWeeks, mode,
    weeklyPercent: input.weeklyPercent, courseIntensity: input.courseIntensity,
  };
  const rationale = hasExplicitWeeks
    ? 'Программа задана дословно по источнику (явная раскладка всех недель, без авто-прогрессии PM).'
    : progressionRationale({ ...progInput, pm0: 100 });

  const weeks: LMSPlanWeek[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const pmRow: Record<string, number> = {};
    for (const name of exercises) {
      if (hasExplicitWeeks) {
        pmRow[name] = pm0Map[name]; // без прогрессии: реальный PM пользователя
      } else {
        const k = (input.weeklyPercent != null ? input.weeklyPercent
          : mode === 'on_course' ? (input.courseIntensity === 'mild' ? 0.015 : input.courseIntensity === 'heavy' ? 0.025 : 0.02)
          : mode === 'pct' ? -0.005 : template.meta.correctionPct);
        pmRow[name] = pm0Map[name] * Math.pow(1 + k, w);
      }
    }
    const weekLayout: SRDaySpec[] = hasExplicitWeeks ? template.weeks![w] : template.week1;
    const days: LMSPlanDay[] = weekLayout.map((day: SRDaySpec, di: number) => {
      const dayTag = dayLoadTag(day.exercises as { load?: string }[]);
      
      // S-MRV: Бюджет утомления на сессию
      let dayFatigueBudget = 60 * ((input.currentReadiness || 80) / 100);
      
      const planEx: LMSPlanExercise[] = day.exercises.map((spec: SRExerciseSpec) => {
        const pm = pmRow[spec.name];
        const workSets: LMSWorkSet[] = spec.sets.map(s => {
          let sets = s.sets;
          
          // Коррекция объёма по VolumeGoal (только для аксессуаров)
          if (spec.load !== 'Тяжелая') {
            const vMult = input.volumeGoal === 'mev' ? 0.8 : input.volumeGoal === 'mrv' ? 1.2 : 1.0;
            const focusMult = (input.focusLift && spec.name.toLowerCase().includes(input.focusLift!)) ? 1.2 : 1.0;
            sets = Math.round(sets * vMult * focusMult);
          }
          
          return {
            pct: s.pct, reps: s.reps, sets: Math.max(1, sets),
            weight: workWeight(pm, s.pct)
          };
        });
        
        // Проверка S-MRV
        const exCost = (EXERCISE_CATALOG.find(e => e.name === spec.name)?.fatigueCost || 5) * (workSets[0]?.sets || 1);
        if (dayFatigueBudget < exCost && spec.load !== 'Тяжелая') {
          // Срезаем сеты, чтобы влезть в бюджет
          workSets.forEach(ws => {
             ws.sets = Math.max(1, Math.floor(dayFatigueBudget / (EXERCISE_CATALOG.find(e => e.name === spec.name)?.fatigueCost || 5)));
          });
        }
        dayFatigueBudget -= (EXERCISE_CATALOG.find(e => e.name === spec.name)?.fatigueCost || 5) * (workSets[0]?.sets || 1);

        return { name: spec.name, group: spec.group, coef: spec.coef, mnosz: spec.mnosz, load: cleanLoad(spec.load, dayTag), pm, workSets };
      });
      
      const metricsEx: SRExercise[] = planEx.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { exercises: planEx, metrics: calcSessionMetrics(metricsEx) };
    });
    weeks.push({ week: w + 1, pmRow, days });
  }

  const allSessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetricsAggregate(allSessions, totalWeeks);

  const proRationale = [
    rationale,
    input.volumeGoal ? `Объём аксессуаров: ${input.volumeGoal === 'mev' ? 'минимальный (MEV)' : input.volumeGoal === 'mrv' ? 'максимальный (MRV)' : 'оптимальный (MAV)'}.` : '',
    input.focusLift ? `Приоритет: акцент на ${input.focusLift === 'squat' ? 'присед' : input.focusLift === 'bench' ? 'жим' : 'тягу'} (+20% объёма).` : '',
    `S-MRV: объём сессий автоматически ограничен бюджетом утомления (Ready: ${input.currentReadiness || 80}%).`,
  ].filter(Boolean).join(' ');

  return { template, progressionRationale: proRationale, weeks, cycleMetrics };
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