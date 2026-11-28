/**
 * arm-tendon-budget.engine.ts — tendon-бюджет как МОДЕЛЬ, а не одна константа
 * (аудит 2026-11, §5 п.10).
 *
 * Проблема: недельный tendon-лимит 12/16/18/22 сравнивался с суммой ВСЕХ сетов
 * сухожильных групп — и спортивная тяжёлая работа (стол, пронация под весом)
 * смешивалась с кондиционированием (изометрия/холды/HSR). Из-за этого план
 * «набирал 22–53» и выглядел перегруженным, хотя большая часть — спортивная
 * специфика, а не добавленное кондиционирование.
 *
 * Решение: два РАЗДЕЛЬНЫХ счётчика.
 *  - conditioning — изометрия/холды/медленная тяга: сюда применяется лимит
 *    уровня (12/16/18/22) как эвристический недельный кап;
 *  - sport — обычные рабочие сеты сухожильных групп (стол/пронация/кисть):
 *    показываются отдельно и НЕ капаются выдуманным числом (валидированного
 *    недельного капа спортивной работы в литературе нет; см. §7 аудита).
 *
 * Ориентир по кондиционированию (3–4 подхода, 2–3 раза в неделю) — практика
 * протоколов HSR/изометрии при тендинопатии; конкретные 12/16/18/22 остаются
 * внутренней эвристикой репозитория и помечены как таковая.
 */
import { tendonWeeklyLimit } from './arm-volume-landmarks.engine';
import { armExerciseSetCount, canonicalizeArmTendonMuscle, type ArmTendonExerciseLike } from './arm-tendon-sets.engine';

export interface ArmTendonWorkItem extends ArmTendonExerciseLike {
  isStatic?: boolean;
  holdSeconds?: number;
  movementPattern?: string;
  exerciseId?: string;
  provenanceSource?: string;
}

export type ArmTendonWorkType = 'conditioning' | 'sport';

/** Изометрия/холды/медленная тяга → кондиционирование; обычные рабочие сеты → спорт. */
export function classifyArmTendonWork(ex: ArmTendonWorkItem | null | undefined): ArmTendonWorkType {
  if (!ex) return 'sport';
  if (ex.isStatic) return 'conditioning';
  if (Number(ex.holdSeconds) > 0) return 'conditioning';
  const pattern = String(ex.movementPattern || '').toLowerCase();
  if (pattern.includes('iso') || pattern.includes('hold')) return 'conditioning';
  return 'sport';
}

export interface ArmTendonBudget {
  conditioningSets: number;
  sportSets: number;
  totalSets: number;
  /** Эвристический кап кондиционирования по уровню (12/16/18/22). */
  limit: number;
  overConditioning: boolean;
  note: string;
}

export function armTendonBudgetFor(
  exercises: Array<ArmTendonWorkItem | null | undefined> | null | undefined,
  level: string,
): ArmTendonBudget {
  let conditioningSets = 0;
  let sportSets = 0;
  for (const ex of exercises || []) {
    if (!canonicalizeArmTendonMuscle(ex?.muscle || ex?.muscleGroup)) continue;
    // Замеры тестовой недели — не тренировочный объём: не входят ни в один счётчик.
    if (ex?.provenanceSource === 'arm-test-week') continue;
    const sets = armExerciseSetCount(ex);
    if (!Number.isFinite(sets) || sets <= 0) continue;
    if (classifyArmTendonWork(ex) === 'conditioning') conditioningSets += sets;
    else sportSets += sets;
  }
  const limit = tendonWeeklyLimit(level);
  const overConditioning = conditioningSets > limit;
  return {
    conditioningSets,
    sportSets,
    totalSets: conditioningSets + sportSets,
    limit,
    overConditioning,
    note: overConditioning
      ? `Кондиционирование сухожилий ${conditioningSets} > лимита ${limit} (эвристика уровня) — спортивные сеты не считаются в лимит.`
      : `Сухожилия: кондиционирование ${conditioningSets}/${limit} (эвристика), спортивная работа ${sportSets} — без валидированного капа.`,
  };
}

/** Сводка по плану: мышца → бюджет по неделям (для отчёта/UI). */
export function armTendonBudgetByWeek(
  weeks: Array<{ exercises?: ArmTendonWorkItem[] } & Record<string, unknown>> | null | undefined,
  level: string,
): Array<{ week: number; budget: ArmTendonBudget }> {
  return (weeks || []).map((w: any) => ({
    week: Number(w?.week) || 0,
    budget: armTendonBudgetFor(
      (w?.sessions || []).flatMap((s: any) => s.exercises || []),
      level,
    ),
  }));
}
