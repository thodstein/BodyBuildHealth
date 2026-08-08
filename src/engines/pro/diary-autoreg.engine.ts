/**
 * diary-autoreg.engine.ts — авторегуляция весов плана по фактическим данным дневника.
 *
 * Источник: WorkoutLog[] (StrengthDiary) → последняя StrengthLogEntry по упражнению.
 * Логика per-exercise:
 *  1. Найти последний лог по имени (fuzzy match через norm()).
 *  2. Нет данных → fallback на плановые значения.
 *  3. Взять последний сет: { weight, reps, rpe } → e1RM (Epley или estimated1RM).
 *  4. factRPE = rpe || rpeFromLoad(e1RM, weight, reps).
 *  5. targetRPE = 10 - plannedRir; delta = factRPE - targetRPE.
 *  6. Корректировка:
 *     - |delta| ≤ 1 → без изменений
 *     - delta > 1 (факт тяжелее) → вес снижен (loadForRPE × 0.95)
 *     - delta < -1 (факт легче) → вес повышен (loadForRPE × 1.02)
 *     - factRPE ≥ 9.5 → -1 подход
 *     - delta > 2 → RIR +1
 *  7. Plateau: 3+ последние сессии без роста e1RM → plateauWarning + RIR +1.
 */
import type { WorkoutLog, StrengthLogEntry } from '../../core/types';
import { rpeFromLoad, loadForRPE } from './autoregulation-pro.engine';
import { norm } from '../norm';
import { epley1RM } from '../e1rm';
import { exerciseMatchScore } from '../exercise-aliases';

export type AutoRegMode = 'off' | 'auto' | 'diary';

export interface PlannedExerciseLite {
  name: string;
  plannedWeight: number;
  plannedReps: number;
  plannedSets: number;
  plannedRir: number;
  isMain: boolean;
}

export interface DiaryAutoregInput {
  historyWorkouts: WorkoutLog[];
  plannedExercises: PlannedExerciseLite[];
}

export interface ExerciseAdjustment {
  adjustedWeight: number;
  adjustedSets: number;
  adjustedRir: number;
  note: string;
  source: 'diary' | 'fallback';
  factRPE?: number;
  factWeight?: number;
  factReps?: number;
  factDate?: string;
  e1RM?: number;
}

export interface DiaryAutoregResult {
  perExercise: Map<string, ExerciseAdjustment>;
  summary: { adjusted: number; unchanged: number; noData: number };
  plateauWarnings: string[];
  decisions: string[];
}

/** Fuzzy match имён упражнений (как в lms-builder.engine + извлечение ядра).
 *  P1-3: exclude OHP/leg-press from bench matches, row/pulldown from deadlift matches.
 *  Uses exercise aliases engine as enhanced fallback. */
function nameMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  // Lift-aware exclusions: "Жим лежа" must NOT match "Жим стоя", "Жим ногами", etc.
  const isBenchVariant = (s: string) => /жим/.test(s) && !/стоя|сидя|армейск|над голов|ногами|гантел|швунг|push.?press|армолд|арнолд/i.test(s);
  const isOverheadOrLegPress = (s: string) => /стоя|сидя|армейск|над голов|ногами|швунг|push.?press|армолд|арнолд/i.test(s);
  const isDeadliftVariant = (s: string) => /станов|румын|сумо|прямых ног|плинт|из ямы/i.test(s);
  const isRowOrPulldown = (s: string) => /верхнего|нижнего|горизонтального|блока|в наклон|к поясу|гантел|штанг|к груди/i.test(s);
  if (isBenchVariant(na) && isOverheadOrLegPress(nb)) return false;
  if (isBenchVariant(nb) && isOverheadOrLegPress(na)) return false;
  if (isDeadliftVariant(na) && isRowOrPulldown(nb)) return false;
  if (isDeadliftVariant(nb) && isRowOrPulldown(na)) return false;
  if (na.length > 2 && nb.length > 2 && (na.includes(nb) || nb.includes(na))) return true;
  // Извлечение ядра: убираем «штанги», «гантелей», «в тренажёре» и т.п.
  const core = (s: string) => s.replace(/штанг[иеы]?|гантел[иеы]?|в тренажере|в тренажёре/g, '').replace(/\s+/g, ' ').trim();
  const ca = core(na), cb = core(nb);
  if (ca.length > 2 && cb.length > 2 && (ca.includes(cb) || cb.includes(ca))) return true;
  // Fallback: exercise aliases engine (canonical ID match via aliases)
  const aliasScore = exerciseMatchScore(a, b);
  if (aliasScore >= 0.7) return true;
  return false;
}

interface FactEntry {
  entry: StrengthLogEntry;
  lastSet: { weight: number; reps: number; rpe?: number; rir?: number };
  e1RM: number;
  date: string;
}

/** Найти последнюю (по дате) StrengthLogEntry по имени упражнения во всех WorkoutLog. */
function findLastFact(historyWorkouts: WorkoutLog[], exerciseName: string): FactEntry | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  let best: FactEntry | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of wl.exercises) {
      if (nameMatch(ex.exerciseName, exerciseName)) {
        const date = ex.date || wl.date;
        if (date < cutoffStr) continue;
        const sets = ex.sets || [];
        if (sets.length === 0) continue;
        // P1-10: выбрать сет с наивысшим e1RM, но с RPE > 0 если возможно
        let bestSet = sets[0];
        let bestE1RM = epley1RM(bestSet.weight, bestSet.reps);
        for (const set of sets.slice(1)) {
          const candidateE1RM = epley1RM(set.weight, set.reps);
          const hasRpe = (set.rpe || 0) > 0;
          const currentHasRpe = (bestSet.rpe || 0) > 0;
          if (hasRpe && !currentHasRpe) {
            bestSet = set; bestE1RM = candidateE1RM;
          } else if (candidateE1RM > bestE1RM) {
            bestSet = set; bestE1RM = candidateE1RM;
          }
        }
        const e1RM = Number(ex.estimated1RM) > 0 ? ex.estimated1RM : bestE1RM;
        if (!best || e1RM > best.e1RM) {
          best = { entry: ex, lastSet: { weight: bestSet.weight, reps: bestSet.reps, rpe: bestSet.rpe, rir: bestSet.rir }, e1RM, date };
        }
      }
    }
  }
  return best;
}

/** Найти все логи по упражнению (для plateau-детекции). */
function findAllFacts(historyWorkouts: WorkoutLog[], exerciseName: string): FactEntry[] {
  const out: FactEntry[] = [];
  for (const wl of historyWorkouts) {
    for (const ex of wl.exercises) {
      if (nameMatch(ex.exerciseName, exerciseName)) {
        const sets = ex.sets || [];
        if (sets.length === 0) continue;
        // лучший сет по e1RM
        let best = sets[0], bestE1RM = epley1RM(sets[0].weight, sets[0].reps);
        for (const s of sets) {
          const e = epley1RM(s.weight, s.reps);
          if (e > bestE1RM) { best = s; bestE1RM = e; }
        }
        const e1RM = Number(ex.estimated1RM) > 0 ? ex.estimated1RM : bestE1RM;
        out.push({ entry: ex, lastSet: { weight: best.weight, reps: best.reps, rpe: best.rpe, rir: best.rir }, e1RM, date: ex.date || wl.date });
      }
    }
  }
  // сортировка по дате asc (старые → новые)
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Детекция плато: 3+ последние сессии без роста e1RM.
 *  P2-fix: previously used absolute 2.5kg threshold for ALL exercises. For a squat at 180kg,
 *  2.5kg = 1.4% (essentially no progress). For a lateral raise at 8kg, 2.5kg = 31% (huge progress).
 *  Now uses percentage-based threshold: 2% of max e1RM (squat 180kg → 3.6kg, lateral raise 8kg → 0.16kg).
 */
function detectPlateau(facts: FactEntry[]): boolean {
  if (facts.length < 3) return false;
  const recent = facts.slice(-3);
  const values = recent.map(fact => fact.e1RM);
  const maxVal = Math.max(...values);
  // Percentage-based threshold: 2% of max e1RM, with a minimum of 1kg for very light exercises.
  const threshold = Math.max(1, maxVal * 0.02);
  return Math.max(...values) - Math.min(...values) <= threshold;
}

export function buildDiaryAutoreg(input: DiaryAutoregInput): DiaryAutoregResult {
  const perExercise = new Map<string, ExerciseAdjustment>();
  const plateauWarnings: string[] = [];
  const decisions: string[] = [];
  let adjusted = 0, unchanged = 0, noData = 0;

  for (const planned of input.plannedExercises) {
    const fact = findLastFact(input.historyWorkouts, planned.name);

    if (!fact) {
      noData++;
      perExercise.set(planned.name, {
        adjustedWeight: planned.plannedWeight,
        adjustedSets: planned.plannedSets,
        adjustedRir: planned.plannedRir,
        note: 'нет данных дневника',
        source: 'fallback',
      });
      continue;
    }

    const factRPE = fact.lastSet.rpe != null
      ? fact.lastSet.rpe
      : (fact.e1RM > 0 && fact.lastSet.weight > 0
        ? rpeFromLoad(fact.e1RM, fact.lastSet.weight, fact.lastSet.reps)
        : null);
    // P0-3-fix: when e1RM=0 (bodyweight-only or zero-data entry) OR rpeFromLoad returns 5 (fallback
    // because e1RM=0), treat as no-data to avoid weight being set to 0 or weight increase from
    // an artificial delta of -3. Also guard fact.e1RM <= 0 directly.
    if (factRPE == null || fact.e1RM <= 0 || fact.lastSet.weight <= 0) {
      noData++;
      perExercise.set(planned.name, {
        adjustedWeight: planned.plannedWeight,
        adjustedSets: planned.plannedSets,
        adjustedRir: planned.plannedRir,
        note: 'нет валидных данных (e1RM=0, вес=0 или RPE не указано)',
        source: 'fallback',
      });
      continue;
    }
    const targetRPE = 10 - planned.plannedRir;
    const delta = factRPE - targetRPE;

    let adjustedWeight = planned.plannedWeight;
    let adjustedSets = planned.plannedSets;
    let adjustedRir = planned.plannedRir;
    const noteParts: string[] = [];

    // Базовая корректировка веса через loadForRPE (e1RM → вес для targetRPE)
    const baseFromE1RM = loadForRPE(fact.e1RM, targetRPE, planned.plannedReps);

    if (Math.abs(delta) <= 1) {
      // в норме — оставляем плановый вес, но уточняем по e1RM если расхождение большое
      const ratio = planned.plannedWeight / fact.e1RM;
      if (ratio > 0 && Math.abs(ratio - baseFromE1RM / fact.e1RM) > 0.05) {
        // плановый вес заметно отличается от расчётного по e1RM → используем расчётный
        adjustedWeight = Math.round(baseFromE1RM * 10) / 10;
        noteParts.push(`вес по e1RM: ${adjustedWeight}кг`);
      }
      unchanged++;
      noteParts.push(`в норме (RPE ${factRPE.toFixed(1)}/${targetRPE})`);
    } else if (delta > 1) {
      // факт тяжелее плана → снижаем вес
      adjustedWeight = Math.round(baseFromE1RM * 0.95 * 10) / 10;
      adjusted++;
      noteParts.push(`📉 вес снижен: факт RPE ${factRPE.toFixed(1)} > план ${targetRPE}`);
    } else {
      // факт легче плана → повышаем вес
      adjustedWeight = Math.round(baseFromE1RM * 1.02 * 10) / 10;
      adjusted++;
      noteParts.push(`📈 вес повышен: факт RPE ${factRPE.toFixed(1)} < план ${targetRPE}`);
    }

    // factRPE ≥ 9.5 → -1 подход (усталость)
    if (factRPE >= 9.5) {
      adjustedSets = Math.max(1, planned.plannedSets - 1);
      noteParts.push('усталость: -1 подход');
      decisions.push(`${planned.name}: RPE ${factRPE.toFixed(1)}≥9.5 → -1 подход`);
    }

    // delta > 2 → RIR +1
    if (delta > 2) {
      adjustedRir = planned.plannedRir + 1;
      noteParts.push('RIR +1 (перетренированность)');
    }

    // Plateau для основный лифтов
    if (planned.isMain) {
      const allFacts = findAllFacts(input.historyWorkouts, planned.name);
      if (detectPlateau(allFacts)) {
        plateauWarnings.push(`${planned.name}: плато 3+ сессии без роста e1RM`);
        adjustedRir += 1;
        noteParts.push('🔴 плато: RIR +1');
        decisions.push(`${planned.name}: плато → RIR +1`);
      }
    }

    perExercise.set(planned.name, {
      adjustedWeight,
      adjustedSets,
      adjustedRir,
      note: noteParts.join(' · '),
      source: 'diary',
      factRPE: Math.round(factRPE * 10) / 10,
      factWeight: fact.lastSet.weight,
      factReps: fact.lastSet.reps,
      factDate: fact.date,
      e1RM: fact.e1RM,
    });
  }

  if (noData > 0) decisions.push(`${noData} упражнений без данных дневника — плановые веса`);
  if (plateauWarnings.length > 0) decisions.push(`${plateauWarnings.length} плато-предупреждений`);

  return {
    perExercise,
    summary: { adjusted, unchanged, noData },
    plateauWarnings,
    decisions,
  };
}
