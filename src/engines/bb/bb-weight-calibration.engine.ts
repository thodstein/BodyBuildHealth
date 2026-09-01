/**
 * bb-weight-calibration.engine.ts — фактическое внесение весов по используемым упражнениям.
 *
 * Шаг «weights» в BbAutoConstructor: после генерации плана пользователь вводит реальные
 * рабочие веса по каждому упражнению, реально присутствующему в плане. Этот модуль:
 *  1) собирает уникальные упражнения плана (для формы ввода);
 *  2) пересчитывает веса всех сетов, масштабируя плановую кривую (фазы/прогрессию)
 *     к введённому фактическому весу — структура плана (прогрессия по неделям,
 *     относительные веса сетов) сохраняется, меняется только абсолютный базис.
 *
 * Ключ упражнения — его id (exerciseName из каталога, стабилен) с fallback на name.
 * Персистентность: введённые веса сохраняются в training.workMaxByExercise (ключ = id),
 * затем применяются к плану при повторной сборке через autoCalibrateFromStored.
 */

import type { BBPlan } from './bb-types';

/** Один пункт формы ввода фактического веса. */
export interface PlanWeightEntry {
  /** id упражнения из EXERCISE_CATALOG (exerciseName в плане) — ключ для workMaxByExercise. */
  id?: string;
  name: string;
  muscle: string;
  role: 'primary' | 'accessory';
  /** Справочный вес плана (максимальный рабочий сет упражнения) — для дефолта поля. */
  referenceWeight: number;
  /** Вес, введённый пользователем (кг). null = оставить плановый. */
  actualWeight: number | null;
}

/** Уникальные упражнения плана, отсортированные по мышце → роли → имени. */
export function collectPlanExercises(plan: BBPlan | null): PlanWeightEntry[] {
  if (!plan) return [];
  const byName = new Map<string, PlanWeightEntry>();
  for (const week of plan.weeks) {
    for (const sess of week.sessions) {
      for (const ex of sess.exercises) {
        if (!ex || !ex.name) continue;
        const key = ex.exerciseName || ex.name;
        const existing = byName.get(key);
        // Справочный вес = максимальный рабочий сет упражнения по всем неделям.
        const maxSet = ex.workSets?.length
          ? ex.workSets.reduce((m, s) => (s && Number.isFinite(s.weight) && s.weight > m ? s.weight : m), 0)
          : 0;
        if (!existing) {
          byName.set(key, {
            id: ex.exerciseName || undefined,
            name: ex.name,
            muscle: ex.muscle || '—',
            role: ex.role || 'accessory',
            referenceWeight: Math.round(maxSet * 10) / 10,
            actualWeight: null,
          });
        } else if (maxSet > existing.referenceWeight) {
          existing.referenceWeight = Math.round(maxSet * 10) / 10;
        }
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.muscle === b.muscle ? (a.role === b.role ? a.name.localeCompare(b.name) : (a.role === 'primary' ? -1 : 1)) : a.muscle.localeCompare(b.muscle),
  );
}

/**
 * Пересчёт весов плана от фактических значений.
 * Для каждого упражнения с actualWeight масштабирует все сеты (и разминку) так, чтобы
 * максимальный рабочий сет стал равен actualWeight; остальные сеты — пропорционально.
 * Возвращает НОВЫЙ план (исходный не мутируется).
 */
export function recalibratePlanWeights(
  plan: BBPlan,
  entries: PlanWeightEntry[],
): { plan: BBPlan; applied: number; skipped: number; total: number } {
  const actual = new Map<string, number>();
  for (const e of entries) {
    if (e.actualWeight != null && Number.isFinite(e.actualWeight) && e.actualWeight > 0) {
      actual.set(e.name, e.actualWeight);
    }
  }

  // Глобальный справочный максимум каждого упражнения по ВСЕМ неделям — единый базис.
  // Пользователь вводит фактический вес как «рабочий максимум упражнения», поэтому
  // масштабируем каждое вхождение одним ratio так, чтобы ГЛОБАЛЬНЫЙ максимум = фактическому.
  const globalRefMax = new Map<string, number>();
  for (const week of plan.weeks) {
    for (const sess of week.sessions) {
      for (const ex of sess.exercises) {
        if (!ex || !ex.name) continue;
        for (const s of ex.workSets || []) {
          if (s && Number.isFinite(s.weight) && s.weight > (globalRefMax.get(ex.name) || 0)) {
            globalRefMax.set(ex.name, s.weight);
          }
        }
      }
    }
  }

  const clone: BBPlan = structuredClone(plan);
  let applied = 0;
  let skipped = 0;
  let total = 0;

  for (const week of clone.weeks) {
    for (const sess of week.sessions) {
      for (const ex of sess.exercises) {
        if (!ex || !ex.name) continue;
        total++;
        const target = actual.get(ex.name);
        const refMax = globalRefMax.get(ex.name) || 0;
        if (target == null || !refMax || refMax <= 0) {
          skipped++;
          continue;
        }
        const ratio = target / refMax;
        for (const s of ex.workSets || []) {
          if (s && Number.isFinite(s.weight)) s.weight = Math.round(s.weight * ratio * 10) / 10;
        }
        for (const w of ex.warmupSets || []) {
          if (w && Number.isFinite(w.load)) w.load = Math.round(w.load * ratio * 10) / 10;
        }
        applied++;
      }
    }
  }

  return { plan: clone, applied, skipped, total };
}

/**
 * Авто-применение сохранённых весов к вновь собранному плану.
 * Упражнения, для которых в workMaxByExercise есть валидный вес, получают его как
 * фактический (кроме bodyweight-упражнений — для них вес задаётся reps/собственным весом).
 */
export function autoCalibrateFromStored(
  plan: BBPlan,
  workMaxByExercise: Record<string, number> | undefined,
  isBodyweight: (name: string) => boolean = () => false,
): { plan: BBPlan; applied: number } {
  if (!plan || !workMaxByExercise || typeof workMaxByExercise !== 'object') {
    return { plan, applied: 0 };
  }
  const entries = collectPlanExercises(plan).map((e) => {
    // Матчинг по id каталога (первично), fallback на точное имя.
    const stored = (e.id && Number.isFinite(workMaxByExercise[e.id]) && workMaxByExercise[e.id] > 0)
      ? workMaxByExercise[e.id]
      : (Number.isFinite(workMaxByExercise[e.name]) && workMaxByExercise[e.name] > 0 ? workMaxByExercise[e.name] : null);
    return {
      ...e,
      actualWeight: !isBodyweight(e.name) && stored != null ? stored : null,
    };
  });
  if (entries.every((e) => e.actualWeight == null)) return { plan, applied: 0 };
  const res = recalibratePlanWeights(plan, entries);
  return { plan: res.plan, applied: res.applied };
}

/** Группа упражнений по группе мышц (для сгруппированного UI шага «weights»). */
export interface PlanWeightGroup {
  muscle: string;
  items: PlanWeightEntry[];
}

/** Сгруппировать пункты ввода по группам мышц (порядок — по появлению в плане). */
export function groupWeightEntries(entries: PlanWeightEntry[]): PlanWeightGroup[] {
  const map = new Map<string, PlanWeightEntry[]>();
  for (const e of entries) {
    const m = e.muscle || 'прочее';
    const arr = map.get(m);
    if (arr) arr.push(e);
    else map.set(m, [e]);
  }
  return [...map.entries()].map(([muscle, items]) => ({ muscle, items }));
}

