/**
 * Wave-1 Э1.5 — замок «единый канон WAF».
 *
 * Факт (проверен чтением кода, 26.09.2026): в проекте было ТРИ копии весовых классов WAF
 * и ДВА объявления типа Para-класса:
 *  1) `arm-norms-table.engine.ts` — `WAF_CLASSES_MALE/FEMALE` + возрастно-СЛЕПЫЙ
 *     `wafClassFor(bw, sex?)` (док честно пишет: Masters/Junior/Youth не учитываются);
 *  2) `arm-benchmarks.engine.ts` — `wafWeightClassFor(bw)` = мужская сетка БЕЗ пола,
 *     третья копия, в проде не читалась (хаб давно на каноне), её держал только свой тест;
 *  3) `arm-force-capture.engine.ts` — `WAF_WEIGHT_CLASSES` (третья копия, 0 потребителей);
 *  + `WafParaClass` продублирован в `arm-waf.engine.ts` и `arm-rulebook.ts`.
 *
 * Хуже всего было то, что (1) и канон `arm-waf.engine.ts` оба назывались `wafClassFor`
 * и возвращали РАЗНЫЕ формы (`cls/limit/toNext/label` против `label/ceilingKg/deltaKg/fits`),
 * а оба типа назывались `WafClassInfo` — импортёр мог взять не тот и получить `undefined`.
 *
 * Решение: единственный канон WAF (возраст + Para + сгонка) — `arm-waf.engine.ts`.
 * Таблица норм сохраняет возрастно-слепой Senior-хелпер под честным именем
 * `wafSeniorClassFor` / `WafSeniorClassInfo`; мёртвые копии удалены; тип Para — один.
 *
 * Этот файл — «красный предохранитель»: если кто-то снова заведёт вторую сетку классов
 * или второе объявление Para, тест упадёт.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT);

/** Код без комментариев: иначе guard цепляется за мои же пояснения в комментариях. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ARM = join(ROOT, 'engines', 'arm');
const read = (...p: string[]) => code(readFileSync(join(...p), 'utf8'));

/** Путь относительно src всегда в forward-slash и без ведущего разделителя — иначе тест зависит от ОС. */
const rel = (f: string) => f.replace(ROOT, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
/** production-код: тесты (в т.ч. этот guard) не считаются дрейфом канона. */
const PROD = FILES.filter((f) => !f.includes('__tests__'));

describe('Wave-1 Э1.5: WAF — единственный канон', () => {
  it('удалены обе мёртвые копии: wafWeightClassFor и WAF_WEIGHT_CLASSES', () => {
    const hits = PROD.filter((f) => /wafWeightClassFor|WAF_WEIGHT_CLASSES/.test(code(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(hits, `копии сетки WAF вернулись: ${hits.join(', ')}`).toEqual([]);
  });

  it('сетка классов объявлена ровно в одном месте (arm-norms-table)', () => {
    const declarers = PROD.filter((f) => /export const WAF_CLASSES_(MALE|FEMALE)\b/.test(code(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(declarers).toEqual(['engines/arm/arm-norms-table.engine.ts']);
  });

  it('имя wafClassFor принадлежит ТОЛЬКО канону arm-waf.engine.ts', () => {
    const declarers = PROD.filter((f) => /export function wafClassFor\b/.test(code(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(declarers).toEqual(['engines/arm/arm-waf.engine.ts']);
  });

  it('таблица норм пользуется честным возрастно-слепым именем, а не wafClassFor', () => {
    const src = read(ARM, 'arm-norms-table.engine.ts');
    expect(src).toContain('export function wafSeniorClassFor');
    expect(src).toContain('WafSeniorClassInfo');
    // и никакой второй формы с тем же именем
    expect(/export (interface|type) WafClassInfo\b/.test(src)).toBe(false);
  });

  it('тип Para-объявлен один раз (arm-waf.engine.ts), arm-rulebook его переиспользует', () => {
    const declarers = PROD.filter((f) => /export type WafParaClass\s*=/.test(code(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(declarers).toEqual(['engines/arm/arm-waf.engine.ts']);
    const rulebook = read(ARM, 'arm-rulebook.ts');
    expect(rulebook).toContain("import type { WafParaClass } from './arm-waf.engine'");
  });

  it('все потребители норм-таблицы переведены на wafSeniorClassFor', () => {
    const stragglers = PROD.filter((f) => {
      const c = code(readFileSync(f, 'utf8'));
      // читает из arm-norms-table, но зовёт wafClassFor — дожимся полного перевода
      return /from '[^']*arm-norms-table\.engine'/.test(c) && /\bwafClassFor\s*\(/.test(c);
    }).map(rel);
    expect(stragglers).toEqual([]);
  });
});
