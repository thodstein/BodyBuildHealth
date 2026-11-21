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
 * решение (фосфор, прогестерон в другой единице с метод-зависимым верхом): их
 * нельзя «выровнять» молча, иначе один и тот же анализ изменит вердикт.
 * Перечень — `docs/LAB-NORMS-SINGLE-SOURCE.md` §4.
 *
 * Магний вышел из этого списка в проходе 188: референс российских лабораторий
 * (ИНВИТРО и Helix, взрослые >20 лет) — 0.66–1.07 ммоль/л, и это же число уже
 * стояло в `comprehensive-report.engine`. Прежние 0.7–1.1 (`MG`) и 0.7–1.0
 * (`MAGNESIUM`) давали два ответа на 1.05.
 *
 * Общий белок и мочевая кислота вышли в проходе 189 по тем же основаниям:
 * у РФ-лабораторий референс один (белок 64–83 г/л; мочевая кислота ♂ 210–420,
 * ♀ 150–350), а в каталоге стояло по два числа. Мост имён (`labs-mapping`)
 * и раньше считал `TP`/`TOTAL_PROTEIN` и `UA`/`URIC_ACID` одним анализом.
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
import { getLabNorm } from '../../engines/lab-norms.engine';
import { LAB_PANELS } from '../../data/labs-phase-panels';

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
  ['MG', 'MAGNESIUM', 'RANGE_MG'],
  ['TP', 'TOTAL_PROTEIN', 'RANGE_TP'],
  ['UA', 'URIC_ACID', 'RANGE_UA'],
];

/**
 * Расходящиеся двойники — выбор смысла, а не опечатка. Выравнивание меняет
 * вердикт, поэтому это отдельное клиническое решение с обновлением §4.
 */
const DIVERGENT: Array<[a: string, b: string]> = [
  ['P', 'PHOSPHORUS'],          // верх 1.5 против 1.45 — источники РФ расходятся
  ['PROG', 'PROGESTERONE'],     // разные единицы и метод-зависимый верх
];

describe('проход 177: один анализ — один набор чисел', () => {
  it('составные двойники дают одинаковую норму под обоими кодами', () => {
    const norm = (r: Row) => ({ prefUnit: r.prefUnit, coeff: r.coeff, uln: r.uln, lln: r.lln });
    for (const [a, b] of IDENTICAL) {
      const left = UCUM_MAP[a] as Row | undefined;
      const right = UCUM_MAP[b] as Row | undefined;
      expect(left, `нет строки ${a}`).toBeTruthy();
      expect(right, `нет строки ${b}`).toBeTruthy();
      // Имя у второго написания может быть короче («Мочевая к-та»), но норма —
      // та же: единица, коэффициент и обе границы.
      expect(norm(left!), `${a}/${b}`).toEqual(norm(right!));
      // И чтение по любому написанию отдаёт те же числа.
      expect(ucumInfo(a)?.uln).toBe(ucumInfo(b)?.uln);
      expect(ucumInfo(a)?.lln).toBe(ucumInfo(b)?.lln);
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
    // Фосфор 1.47 лежит ровно в зазоре расходящейся пары: гард фиксирует, что
    // зазор существует и что он про числа, а не про поиск.
    expect((UCUM_MAP.P as Row).uln).toBe(1.5);
    expect((UCUM_MAP.PHOSPHORUS as Row).uln).toBe(1.45);
  });

  it('магний выровнен по референсу РФ и не расходится с панелями', () => {
    // Проход 188: 0.66–1.07 ммоль/л (ИНВИТРО/Helix, взрослые >20 лет) — то же
    // число, что в `comprehensive-report.engine`.
    expect((UCUM_MAP.MG as Row).lln).toBe(0.66);
    expect((UCUM_MAP.MG as Row).uln).toBe(1.07);
    expect(UCUM_MAP.MAGNESIUM).toEqual(UCUM_MAP.MG);
    // Панели фаз печатают ту же пару, а не своё «0.7–1.1».
    for (const panel of Object.values(LAB_PANELS)) {
      for (const marker of panel.markers) {
        if (marker.ucumCode !== 'MG' && marker.ucumCode !== 'MAGNESIUM') continue;
        expect(marker.ref, marker.label).toEqual([0.66, 1.07]);
      }
    }
  });

  it('общий белок и мочевая кислота выровнены по референсу РФ', () => {
    // Проход 189: белок 64–83 г/л (Helixbook/KDL 06-035, «Ситилаб», ИНВИТРО);
    // мочевая кислота ♂ 210–420, ♀ 150–350 мкмоль/л (ИНВИТРО, старше 14 лет).
    for (const code of ['TP', 'TOTAL_PROTEIN']) {
      expect((UCUM_MAP[code] as Row).lln, code).toBe(64);
      expect((UCUM_MAP[code] as Row).uln, code).toBe(83);
    }
    for (const code of ['UA', 'URIC_ACID']) {
      expect((UCUM_MAP[code] as Row).lln, code).toBe(210);
      expect((UCUM_MAP[code] as Row).uln, code).toBe(420);
    }
    // Женская пара живёт отдельно: общий низ 210 её не подменяет.
    expect(getLabNorm('UA', 'female')).toMatchObject({ lln: 150, uln: 350, female: true });
    // Путь без пола — мужской, как и было обещано в `lab-norms`.
    expect(getLabNorm('URIC_ACID')).toMatchObject({ lln: 210, uln: 420 });
    // Панели фаз печатают пару из каталога, а не своё «60–80».
    for (const panel of Object.values(LAB_PANELS)) {
      for (const marker of panel.markers) {
        if (marker.ucumCode !== 'TP' && marker.ucumCode !== 'TOTAL_PROTEIN') continue;
        expect(marker.ref, marker.label).toEqual([64, 83]);
      }
    }
  });
});
