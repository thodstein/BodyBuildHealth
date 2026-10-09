/**
 * Регресс-lock: цикл чанков `nutrition-plan → recipe-db → nutrition-plan`.
 *
 * RCA (APK-boot TDZ, Oct 2026): `recipe-db.ts` статически импортировал
 * `syncRecipeHeaderFromDecomposition` из `IndividualPlan/recipe-engine` (Vite кладёт всё
 * под `IndividualPlan/` в чанк `nutrition-plan`), а `nutrition-periodization.engine` /
 * планировщик импортируют `RECIPE_DB` обратно. Получался цикл чанков; на старте APK
 * `recipe-db` исполнялся раньше инициализации `CANNED_SUBSTITUTE` в nutrition-plan →
 * `ReferenceError: Cannot access 'f_' before initialization` — приложение не грузилось
 * (только `watchdog-armed`, `bootstrap()` не вызывался).
 *
 * Фикс: чистый слой декомпозиции вынесен в нейтральный `src/data/recipe-decompose.ts`,
 * зависящий ТОЛЬКО от `core/nutrition-database`. Этот тест держит границу:
 *  - `recipe-db.ts` НЕ должен импортировать из `IndividualPlan` в рантайме;
 *  - `recipe-decompose.ts` НЕ должен иметь рантайм-импортов из `IndividualPlan`
 *    (единственное допустимое обращение — `import type ... MealItem`);
 *  - синхронизация шапки реально применяется к RECIPE_DB.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/** Строки импортов (любые: `import`, `export ... from`) из IndividualPlan. */
function runtimeImportsFromIndividualPlan(src: string): string[] {
  return src
    .split('\n')
    .filter((line) => /(^|\s)(import|export)\s.*from\s+['"][^'"]*IndividualPlan[^'"]*['"]/.test(line))
    // `import type { … } from '…IndividualPlan…'` и `import { type X } from` — type-only, стирается esbuild'ом.
    .filter((line) => !/^\s*import\s+type\b/.test(line));
}

describe('recipe-db / recipe-decompose — отсутствие цикла чанков (APK-boot TDZ)', () => {
  it('recipe-db.ts не импортирует рантайм-код из IndividualPlan', () => {
    const src = read('src/data/recipe-db.ts');
    expect(runtimeImportsFromIndividualPlan(src)).toEqual([]);
  });

  it('recipe-db.ts берёт syncRecipeHeaderFromDecomposition из ./recipe-decompose', () => {
    const src = read('src/data/recipe-db.ts');
    expect(src).toMatch(/import\s*\{[^}]*syncRecipeHeaderFromDecomposition[^}]*\}\s*from\s*['"]\.\/recipe-decompose['"]/);
  });

  it('recipe-decompose.ts не имеет рантайм-импортов из IndividualPlan (только import type)', () => {
    const src = read('src/data/recipe-decompose.ts');
    expect(runtimeImportsFromIndividualPlan(src)).toEqual([]);
    // нейтральный слой зависит только от core/nutrition-database
    expect(src).toMatch(/from\s*['"]\.\.\/core\/nutrition-database['"]/);
  });

  it('синхронизация шапки применена к RECIPE_DB (шапка = декомпозиция)', async () => {
    const { RECIPE_DB } = await import('../recipe-db');
    const { decomposeRecipeRaw } = await import('../recipe-decompose');
    expect(RECIPE_DB.length).toBeGreaterThan(100);
    let checked = 0;
    for (const r of RECIPE_DB) {
      if (!r.ingredientIds || r.ingredientIds.length === 0) continue;
      const items = decomposeRecipeRaw(r);
      if (items.length === 0) continue;
      const p = Math.round(items.reduce((s, i) => s + i.p, 0));
      const f = Math.round(items.reduce((s, i) => s + i.f, 0));
      const c = Math.round(items.reduce((s, i) => s + i.c, 0));
      expect(r.protein).toBe(p);
      expect(r.fat).toBe(f);
      expect(r.carbs).toBe(c);
      checked++;
      if (checked >= 20) break;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
