/**
 * bb-perf-cache-guards.test.ts — защита от возврата «тормозов» в сборке BB-плана.
 *
 * Предыстория (замер 2026-11-07). Профиль `buildBBPlan`:
 *   • generic 8 недель — 700 мс, enhanced 12 недель — 1.46 с;
 *   • CPU-профиль: `trueMuscleOf` 500 мс, `sfrOf` 176 мс, `isCarryExercise`
 *     141 мс, ~430 мс в самих RegExp; один проход сборки делал ~1.1 МЛН
 *     вызовов классификаторов (одни и те же 500 упражнений каталога
 *     переразбирались на каждом проходе).
 * После кэшей и индекса — в разы быстрее.
 *
 * Тест намеренно не меряет миллисекунды (это флакует на CI): он считает
 * ЧИСЛО реальных вызовов классификаторов. Если кто-то снова начнёт
 * классифицировать каталог в цикле, ратчет упадёт на любой машине.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, buildExercisePool } from '../bb-builder.engine';
import { bbCatalogIndex, catalogByMuscle, findCatalogExercise } from '../bb-catalog-index';
import { trueMuscleOf } from '../../movement-pattern';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { clearClassificationCache, getClassificationStats, resetClassificationStats } from '../../ex-classify-cache';

const BASE_INPUT: any = { patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 6 };

const POOL_OPTS: any = {
  level: 'intermediate',
  roleMuscles: ['chest'],
  sessionTag: 'Push',
  allowExotic: false,
  isPurePull: false,
  equipmentList: [],
  excludeIds: [],
  favoriteIds: [],
  muscle: 'chest',
  weakPoints: [],
};

describe('BB performance guards (кэши классификации и каталога)', () => {
  it('пул упражнений кэшируется, но отдаёт независимые копии', () => {
    const first = buildExercisePool('chest', 'primary', POOL_OPTS);
    const second = buildExercisePool('chest', 'primary', POOL_OPTS);
    expect(second).toEqual(first);
    // Тот же контент — но элементы массива не общие: билдер проставляет им
    // подходы/RIR, и мутация не должна протекать в следующий прогон.
    expect(second.length).toBe(first.length);
    if (first.length > 0) expect(second[0]).not.toBe(first[0]);
  });

  it('кэш классификаций не меняет ответы (прозрачен)', () => {
    const sample = (EXERCISE_CATALOG as any[]).slice(0, 120);
    const warm = sample.map(ex => trueMuscleOf(ex));
    clearClassificationCache();
    const cold = sample.map(ex => trueMuscleOf(ex));
    expect(cold).toEqual(warm);
  });

  it('индекс каталога по мышцам совпадает с полным перебором', () => {
    const muscles = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'abs', 'traps', 'forearms'];
    for (const muscle of muscles) {
      const viaIndex = catalogByMuscle(muscle).map((ex: any) => ex.id).sort();
      const brute = (EXERCISE_CATALOG as any[]).filter(ex => trueMuscleOf(ex) === muscle).map((ex: any) => ex.id).sort();
      expect(viaIndex).toEqual(brute);
    }
  });

  it('поиск упражнения по индексу равен линейному поиску', () => {
    const index = bbCatalogIndex();
    for (const ex of (EXERCISE_CATALOG as any[]).slice(0, 80)) {
      expect(index.byId.get(String(ex.id).toLowerCase())).toBe(ex);
      expect(findCatalogExercise(ex.name)?.id).toBe(ex.id);
    }
    expect(findCatalogExercise('нет-такого-упражнения')).toBeUndefined();
  });

  it('повторная сборка плана почти не пересчитывает классификаторы (ратчет)', () => {
    // Прогрев: наполняет кэши классификаций и пулов.
    buildBBPlan(BASE_INPUT);
    resetClassificationStats();
    buildBBPlan(BASE_INPUT);
    const stats = getClassificationStats();
    expect(stats.hits).toBeGreaterThan(0);
    // До кэшей — ~1.1 млн «misses» на сборку. Сейчас после прогрева — 0.
    // Потолок с запасом, чтобы тест не флаковал, но ловил возврат цикла.
    expect(stats.misses).toBeLessThan(3000);
  }, 60000);
});
