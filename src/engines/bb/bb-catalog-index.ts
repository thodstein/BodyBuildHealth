/**
 * bb-catalog-index.ts — индексы статического каталога упражнений.
 *
 * ЗАМЕР (2026-11-07): `finalizeBBPlan` — 1.1 с из 2.1 с профиля сборки
 * плана. Внутри `applyControlledAccessoryRotation` на КАЖДУЮ замену
 * упражнения выполнялся `EXERCISE_CATALOG.filter(...)` (500+ элементов ×
 * `trueMuscleOf`/`bbExerciseTier`/`derivePattern`) плюс `.sort()` с
 * пересчётом `replacementScore` в компараторе — то есть O(n log n) вызовов
 * классификаторов на каждую замену.
 *
 * Каталог статичен (собирается на импорте), поэтому мышечные корзины,
 * индексы по имени и id считаются один раз. Индекс пересобирается, если
 * длина каталога изменилась (страховка от рантайм-расширений).
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { trueMuscleOf } from '../movement-pattern';

export interface BBCatalogIndex {
  /** Истинная мышца (trueMuscleOf) → упражнения каталога. */
  byMuscle: Map<string, any[]>;
  /** lower-case имя → упражнение. */
  byName: Map<string, any>;
  /** id (lower-case) → упражнение. */
  byId: Map<string, any>;
  /** Размер каталога, по которому построен индекс. */
  catalogSize: number;
}

let index: BBCatalogIndex | null = null;

/** Индекс каталога (ленивый, кэшируется). */
export function bbCatalogIndex(): BBCatalogIndex {
  if (index && index.catalogSize === EXERCISE_CATALOG.length) return index;
  const byMuscle = new Map<string, any[]>();
  const byName = new Map<string, any>();
  const byId = new Map<string, any>();
  for (const raw of EXERCISE_CATALOG as any[]) {
    if (!raw) continue;
    if (raw.name) byName.set(String(raw.name).toLowerCase(), raw);
    if (raw.id) byId.set(String(raw.id).toLowerCase(), raw);
    const tm = trueMuscleOf(raw);
    if (!tm) continue;
    const bucket = byMuscle.get(tm);
    if (bucket) bucket.push(raw);
    else byMuscle.set(tm, [raw]);
  }
  index = { byMuscle, byName, byId, catalogSize: EXERCISE_CATALOG.length };
  return index;
}

/** Упражнения каталога, чья ИСТИННАЯ мышца — `muscle`. */
export function catalogByMuscle(muscle: string): any[] {
  return bbCatalogIndex().byMuscle.get(String(muscle || '')) || [];
}

/** Поиск упражнения каталога по имени или id (O(1), без toLowerCase по всему каталогу). */
export function findCatalogExercise(nameOrId: string | undefined | null): any | undefined {
  if (!nameOrId) return undefined;
  const key = String(nameOrId).toLowerCase();
  const idx = bbCatalogIndex();
  return idx.byName.get(key) || idx.byId.get(key);
}

/** Только для тестов: сброс индекса. */
export function clearBBCatalogIndex(): void {
  index = null;
}
