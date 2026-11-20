/**
 * ucum-same-name-single-range.test.ts — проход 177: один анализ — один набор чисел.
 *
 * В каталоге `UCUM_MAP` часть анализов записана двумя кодами: коротким (`K`,
 * `NA`, `CA`, `DBIL`, `HOMA`) и полным (`POTASSIUM`, `SODIUM`, `CALCIUM`,
 * `DIRECT_BIL`, `HOMAIR`). Это один бланк, значит норма обязана быть одна. Но
 * числа были записаны дважды: правка нормы в одной строке оставляла вторую с
 * прежним числом — «одна норма, два ответа» в зависимости от того, каким кодом
 * пришёл анализ.
 *
 * Теперь числа живут в константах `RANGE_*` и обе строки их разделяют.
 * Двойники, у которых числа ОСТАЛИСЬ разными, — не опечатка, а клиническое
 * решение (магний, фосфор, общий белок, мочевая кислота, прогестерон в другой
 * единице): их нельзя «выровнять» молча, иначе один и тот же анализ изменит
 * вердикт. Перечень — `docs/LAB-NORMS-SINGLE-SOURCE.md` §4.
 *
 * Гард держит четыре вещи:
 *  1) у каждого двойника обе строки дают одинаковую норму;
 *  2) в исходнике у обоих кодов одна и та же константа (нет второго числа);
 *  3) новых двойников без объявления нет;
 *  4) известные расходящиеся пары не выровнены молча.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UCUM_MAP, ucumInfo } from '../constants';

type Row = { prefUnit: string; coeff: number; uln: number; lln: number; name: string };

/**
 * Имя анализа без пунктуации: «Мочевая к-та» и «Мочевая кислота» — один
 * анализ, «HOMA-IR» и «HOMA-IR» — тоже. Регистр не важен.
 */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[\s.,()\-–]/g, '').replace(/к-?та/g, 'кислота');
}

/** Одинаковые двойники: один анализ, два кода, одна норма. */
const IDENTICAL: Array<[a: string, b: string, range: string]> = [
  ['K', 'POTASSIUM', 'RANGE_K'],
  ['NA', 'SODIUM', 'RANGE_NA'],
  ['CA', 'CALCIUM', 'RANGE_CA'],
  ['DBIL', 'DIRECT_BIL', 'RANGE_DBIL'],
  ['HOMA', 'HOMAIR', 'RANGE_HOMA'],
];

/**
 * Расходящиеся двойники — выбор смысла, а не опечатка. Выравнивание меняет
 * вердикт (например, магний 1.05: при 1.1 — норма, при 1.0 — верх), поэтому
 * это отдельное клиническое решение с обновлением §4.
 */
const DIVERGENT: Array<[a: string, b: string]> = [
  ['UA', 'URIC_ACID'],          // низ 200 против 150
  ['P', 'PHOSPHORUS'],          // верх 1.5 против 1.45
  ['MG', 'MAGNESIUM'],          // верх 1.1 против 1.0
  ['TP', 'TOTAL_PROTEIN'],      // 60–80 против 65–85
  ['PROG', 'PROGESTERONE'],     // разные единицы: ng/mL против nmol/L
];

describe('проход 177: один анализ — один набор чисел', () => {
  it('составные двойники дают одинаковую норму под обоими кодами', () => {
    for (const [a, b] of IDENTICAL) {
      const left = UCUM_MAP[a] as Row | undefined;
      const right = UCUM_MAP[b] as Row | undefined;
      expect(left, `нет строки ${a}`).toBeTruthy();
      expect(right, `нет строки ${b}`).toBeTruthy();
      expect(left).toEqual(right);
      // И чтение по любому написанию отдаёт ту же запись.
      expect(ucumInfo(a)).toEqual(ucumInfo(b));
    }
  });

  it('числа живут один раз: оба кода ссылаются на одну константу', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/constants.ts'), 'utf8');
    for (const [a, b, range] of IDENTICAL) {
      // Обе строки построены из одной константы, а не из своих чисел.
      // Выравнивание пробелов в таблице намеренное — поэтому `\s*`, не точная строка.
      expect(src, `${a} не использует ${range}`).toMatch(new RegExp(`'${a}':\\s*\\{ \\.\\.\\.${range}`));
      expect(src, `${b} не использует ${range}`).toMatch(new RegExp(`'${b}':\\s*\\{ \\.\\.\\.${range}`));
      // Сами числа объявлены ровно один раз.
      const row = UCUM_MAP[a] as Row;
      const literal = `${row.prefUnit}', coeff: ${row.coeff}, uln: ${row.uln}, lln: ${row.lln}`;
      const hits = src.split(literal).length - 1;
      expect(hits, `числа «${literal}» записаны ${hits} раз(а)`).toBe(1);
    }
  });

  it('новых двойников без объявления нет', () => {
    const byName = new Map<string, string[]>();
    for (const [key, raw] of Object.entries(UCUM_MAP)) {
      const row = raw as Row;
      const k = nameKey(row.name);
      byName.set(k, [...(byName.get(k) ?? []), key]);
    }
    const declared = new Set([...IDENTICAL, ...DIVERGENT].map(([a, b]) => [a, b].sort().join('|')));
    const pairs = [...byName.values()]
      .filter((keys) => keys.length > 1)
      .map((keys) => [...keys].sort())
      .filter((keys) => keys.length === 2)
      .map((keys) => keys.join('|'));
    const undeclared = pairs.filter((p) => !declared.has(p));
    expect(undeclared, 'новый двойник в каталоге: объяви его — одинаковый или расходящийся').toEqual([]);
    // Двойник из трёх и более кодов — это уже не «второе написание», а свалка.
    const many = [...byName.entries()].filter(([, keys]) => keys.length > 2);
    expect(many, 'три и более кода на один анализ').toEqual([]);
  });

  it('расходящиеся двойники не выровнены молча', () => {
    for (const [a, b] of DIVERGENT) {
      const left = UCUM_MAP[a] as Row;
      const right = UCUM_MAP[b] as Row;
      expect(left, `нет строки ${a}`).toBeTruthy();
      expect(right, `нет строки ${b}`).toBeTruthy();
      const same = left.prefUnit === right.prefUnit
        && left.coeff === right.coeff
        && left.uln === right.uln
        && left.lln === right.lln;
      expect(same, `${a}/${b}: пара сходится — перенеси её в IDENTICAL и обнови §4`).toBe(false);
    }
  });

  it('вердикт двойника не зависит от написания кода', () => {
    // Магний 1.05 и фосфор 1.47 лежат ровно в зазоре расходящихся пар: гард
    // фиксирует, что зазор существует и что он про числа, а не про поиск.
    expect((UCUM_MAP.MG as Row).uln).toBe(1.1);
    expect((UCUM_MAP.MAGNESIUM as Row).uln).toBe(1.0);
    expect((UCUM_MAP.P as Row).uln).toBe(1.5);
    expect((UCUM_MAP.PHOSPHORUS as Row).uln).toBe(1.45);
  });
});
