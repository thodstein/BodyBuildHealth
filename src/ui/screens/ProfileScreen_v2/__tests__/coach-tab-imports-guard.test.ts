/**
 * coach-tab-imports-guard.test.ts — страж холодного старта вкладки тренера.
 *
 * ПОЧЕМУ. `ProfileCoachTab` открывается в профиле на телефоне. Если он начнёт
 * статически импортировать `core/db` (23 хранилища IndexedDB), `core/cloud-kv`
 * (сеть и синхронизация) или `core/data-backup` (перенос всех данных), эти
 * модули попадут в граф вкладки и будут загружены при открытии профиля — даже
 * если тренер ни разу не нажал «Удалить базу» или «Забыть всех».
 *
 * Правило простое: тяжёлое — только через `core/lazy-db` (или `await import`),
 * а `lazy-db` сам не имеет права статически импортировать `./db`, иначе шов
 * перестаёт быть швом.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Все статические импорты/реэкспорты вида `from '...'`. */
function staticSpecifiers(source: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

describe('вкладка тренера не тянет тяжёлые модули статически', () => {
  const tab = read('src/ui/screens/ProfileScreen_v2/ProfileCoachTab.tsx');
  const lazyDb = read('src/core/lazy-db.ts');

  it('нет статического импорта базы, облака и полного бэкапа', () => {
    const specs = staticSpecifiers(tab);
    const heavy = specs.filter(s => /core\/(db|cloud-kv|data-backup)$/.test(s));
    expect(heavy).toEqual([]);
  });

  it('база берётся только через ленивый шов', () => {
    // Любой `import('./db')`/`core/db` в самой вкладке — значит, кто-то снова
    // решил «просто импортировать» и обошёл шов.
    expect(tab).not.toMatch(/['"][^'"]*core\/db['"]/);
    expect(tab).toMatch(/from '\.\.\/\.\.\/\.\.\/core\/lazy-db'/);
  });

  it('lazy-db грузит базу динамически, а не статически', () => {
    const specs = staticSpecifiers(lazyDb);
    expect(specs.filter(s => s === './db')).toEqual([]);
    expect(lazyDb).toMatch(/import\('\.\/db'\)/);
  });

  it('страж не «зелёный по пустоте»: файлы читаются', () => {
    expect(tab.length).toBeGreaterThan(10_000);
    expect(lazyDb.length).toBeGreaterThan(100);
  });
});
