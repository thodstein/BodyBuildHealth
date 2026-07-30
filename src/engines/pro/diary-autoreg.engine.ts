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

function norm(s: string): string { return (s || '').toLowerCase().replace(/ё/g, 'е').trim(); }

/** Epley: 1RM = w × (1 + reps/30). */
function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/** Fuzzy match имён упражнений (как в lms-builder.engine + извлечение ядра). */
function nameMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.length > 2 && nb.length > 2 && (na.includes(nb) || nb.includes(na))) return true;
  // Извлечение ядра: убираем «штанги», «гантелей», «в тренажёре» и т.п.
  const core = (s: string) => s.replace(/штанг[иеы]?|гантел[иеы]?|в тренажере|в тренажёре/g, '').replace(/\s+/g, ' ').trim();
  const ca = core(na), cb = core(nb);
  if (ca.length > 2 && cb.length > 2 && (ca.includes(cb) || cb.includes(ca))) return true;
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
  let best: FactEntry | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of wl.exercises) {
      if (nameMatch(ex.exerciseName, exerciseName)) {
        const sets = ex.sets || [];
        if (sets.length === 0) continue;
        const lastSet = sets[sets.length - 1];
        const e1RM = ex.estimated1RM || epley1RM(lastSet.weight, lastSet.reps);
        const date = ex.date || wl.date;
        if (!best || date > best.date) {
          best = { entry: ex, lastSet: { weight: lastSet.weight, reps: lastSet.reps, rpe: lastSet.rpe, rir: lastSet.rir }, e1RM, date };
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
        const e1RM = ex.estimated1RM || bestE1RM;
        out.push({ entry: ex, lastSet: { weight: best.weight, reps: best.reps, rpe: best.rpe, rir: best.rir }, e1RM, date: ex.date || wl.date });
      }
    }
  }
  // сортировка по дате asc (старые → новые)
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Детекция плато: 3+ последние сессии без роста e1RM (±2.5 кг). */
function detectPlateau(facts: FactEntry[]): boolean {
  if (facts.length < 3) return false;
  const recent = facts.slice(-3);
  const first = recent[0].e1RM;
  const last = recent[recent.length - 1].e1RM;
  return Math.abs(last - first) <= 2.5;
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

    const factRPE = fact.lastSet.rpe != null ? fact.lastSet.rpe : rpeFromLoad(fact.e1RM, fact.lastSet.weight, fact.lastSet.reps);
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