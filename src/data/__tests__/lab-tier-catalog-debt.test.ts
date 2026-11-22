/**
 * lab-tier-catalog-debt.test.ts — проход 207 (завершение): долг двух таблиц,
 * `LAB_TIERS` против `UCUM_MAP`, теперь переписан и проверяется машинно.
 *
 * `LAB_TIERS` (`data/lab-tier-ranges`) — пороги ДЕЙСТВИЯ модели: норма/грань/
 * лечение/экстренно. `UCUM_MAP` (`core/constants`) — лабораторный референс
 * бланка. Это разные роли, поэтому числа расходятся законно; но до сих пор
 * список расхождений жил только прозой в `docs/LAB-NORMS-SINGLE-SOURCE.md` §4,
 * и ни одна проверка не замечала новую пару: правка ступени в модели молча
 * оставляла каталог с другим верхом, а читатель получал два ответа на одно
 * число (например, мочевина 7.5 — «норма» по лестнице и «высоко» по бланку).
 *
 * Гард держит четыре вещи:
 *  1) реестр совпадает с фактическим расхождением — новая пара падает, пока её
 *     не запишут осознанно;
 *  2) каждая запись называет оба числа, и они именно те, что в таблицах:
 *     правка порога делает повод врущим, и это видно;
 *  3) сторона сравнения — та, которую модель вообще судит (`direction:'low'`
 *     сверяется по низу, `'high'` — по верху): верх «открытой» полосы у
 *     низконаправленных маркеров порогом не является и в долг не попадает;
 *  4) строки-двойники внутри `LAB_TIERS` (`ESTRADIOL`/`E2` и т. п.) повторяют
 *     канон, поэтому полуправка одной строки не пройдёт.
 *
 * Сведение чисел — клиническое решение по каждому маркеру (какое число
 * считать порогом действия, а какое — нормой бланка), а не рефакторинг:
 * поэтому здесь реестр, а не выравнивание.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, type LabTierThreshold } from '../lab-tier-ranges';
import { UCUM_MAP } from '../../core/constants';

type Side = 'low' | 'high';

/** Плечи, которые модель вообще судит. */
const sidesOf = (t: LabTierThreshold): Side[] =>
  t.direction === 'both' ? ['low', 'high'] : t.direction === 'low' ? ['low'] : ['high'];

const tierValue = (t: LabTierThreshold, side: Side): number => (side === 'low' ? t.normal[0] : t.normal[1]);

const catalogValue = (code: string, side: Side): number | undefined => {
  const row = (UCUM_MAP as Record<string, { lln?: number; uln?: number } | undefined>)[code];
  if (!row) return undefined;
  const v = side === 'low' ? row.lln : row.uln;
  return typeof v === 'number' ? v : undefined;
};

/** Фактическое расхождение: сторона модели против той же стороны каталога. */
function divergencesNow(): Array<[code: string, side: Side, tier: number, catalog: number]> {
  const out: Array<[string, Side, number, number]> = [];
  for (const [code, t] of Object.entries(LAB_TIERS)) {
    for (const side of sidesOf(t)) {
      const cat = catalogValue(code, side);
      if (cat === undefined) continue;
      const tier = tierValue(t, side);
      if (Math.abs(tier - cat) > 1e-9) out.push([code, side, tier, cat]);
    }
  }
  return out;
}

/**
 * Реестр долга: `[код, сторона, число модели, число каталога, повод]`.
 * Повод обязан называть оба числа — иначе следующий агент не отличит
 * клиническое решение от опечатки.
 */
const DEBT: Array<[code: string, side: Side, tier: number, catalog: number, note: string]> = [
  // ─── липиды и сердце ───
  ['HDL', 'low', 1, 0.9, 'модель: цель 1.0 (нижняя ступень); каталог: НГН 0.9'],
  ['HR', 'high', 80, 90, 'модель: тахикардия покоя с 80; каталог: ВГН 90'],
  ['APO_B', 'high', 1, 1.2, 'модель: цель по ApoB 1.0; каталог: ВГН 1.2'],
  // ─── печень и мышцы ───
  ['ALP', 'high', 120, 130, 'модель: ступень с 120; каталог: ВГН взрослого 130'],
  // ─── почки ───
  ['EGFR', 'low', 90, 60, 'модель: снижение считается с 90 (стадии СКФ); каталог: НГН 60'],
  ['UREA', 'high', 8, 7.1, 'модель: ступень с 8.0; каталог: ВГН 7.1 — 7.1–8.0 каталог уже считает высоким'],
  ['MICROALB', 'high', 20, 30, 'модель: микроальбуминурия с 20 (погранично 20–30); каталог: ВГН 30'],
  ['NGAL', 'high', 100, 150, 'модель: ступень со 100; каталог: ВГН 150'],
  ['KIM1', 'high', 1.5, 2, 'модель: ступень с 1.5; каталог: ВГН 2'],
  // ─── кровь ───
  ['ESR', 'high', 15, 20, 'модель: ступень с 15 (мужской ряд); каталог: общий взрослый верх 20'],
  ['HCT', 'high', 51, 52, 'модель: гематокрит с 51 (мужской ряд); каталог: общий верх 52'],
  ['PLT', 'high', 350, 400, 'модель: тромбоцитоз с 350; каталог: ВГН 400'],
  ['RBC', 'high', 5.5, 5.8, 'модель: эритроцитоз с 5.5; каталог: ВГН 5.8'],
  ['WBC', 'high', 10, 9, 'модель: лейкоцитоз с 10 (погранично 10–12); каталог: ВГН 9.0'],
  // ─── гормоны ───
  ['CORTISOL', 'high', 535, 550, 'модель: верх ступени 535; каталог: ВГН 550'],
  ['LH', 'low', 1.7, 1, 'модель: подавление ЛГ с 1.7 (ось ГГЯ); каталог: НГН 1.0'],
  ['FSH', 'low', 1.5, 1, 'модель: подавление ФСГ с 1.5 (ось ГГЯ); каталог: НГН 1.0'],
  ['DHEA_S', 'low', 200, 80, 'модель: цель ДГЭА-С 200 (молодой мужчина); каталог: НГН 80 — общий взрослый ряд'],
  ['PROG', 'high', 1.5, 1.2, 'модель: ступень с 1.5 (погранично 1.5–3); каталог: ВГН 1.2'],
  ['IGF1', 'high', 400, 250, 'модель: верх 400 — возрастной максимум; каталог: фиксированный ВГН 250'],
  // ─── щитовидная, метаболизм, воспаление ───
  ['FT3', 'high', 6.5, 6, 'модель: ступень с 6.5; каталог: ВГН 6.0'],
  ['FT4', 'high', 22, 19, 'модель: ступень с 22; каталог: ВГН 19'],
  ['INS', 'high', 10, 17, 'модель: цель натощак 10 (погранично 10–15); каталог: ВГН 17'],
  ['HOMAIR', 'high', 2.5, 2.7, 'модель: порог инсулинорезистентности 2.5; каталог: верх 2.7'],
  ['HOMOCYSTEINE', 'high', 10, 15, 'модель: цель 10 (погранично 10–15); каталог: ВГН 15'],
  ['CRP', 'high', 3, 5, 'модель: кардиориск от 3; каталог: ВГН 5'],
  ['FERRITIN', 'high', 400, 300, 'модель: верх 400 (мужской ряд); каталог: ВГН 300'],
  // ─── нутриенты и электролиты ───
  ['FOL', 'low', 7, 3, 'модель: цель фолата 7 (погранично 5–7); каталог: НГН 3'],
  ['IRON', 'low', 13, 10, 'модель: цель железа 13; каталог: НГН 10'],
  ['MAGNESIUM', 'low', 0.85, 0.66, 'модель: дефицит с 0.85 (CLMD, §4); каталог: НГН 0.66 (ИНВИТРО/Helix 0.66–1.07)'],
  ['SELENIUM', 'low', 80, 70, 'модель: цель 80 (погранично 60–80); каталог: НГН 70'],
  ['POTASSIUM', 'high', 5, 5.1, 'модель: ступень с 5.0; каталог: ВГН 5.1'],
  ['CALCIUM', 'low', 2.2, 2.1, 'модель: цель 2.2; каталог: НГН 2.1'],
  [
    'PHOSPHORUS',
    'high',
    1.5,
    1.45,
    'модель: 1.5 (лестница нормализует 0.8–1.5); каталог: 1.45 (Helix/KDL; ИНВИТРО 1.52 — §4)',
  ],
  ['VITAMIN_B6', 'low', 20, 35, 'модель: цель 20 (погранично 10–20); каталог: НГН 35'],
];

/**
 * Строки-двойники `LAB_TIERS`: тот же анализ под именем каталога. Числа обязаны
 * совпадать, иначе «правка одной строки» оставляет в таблице два разных порога
 * на один анализ — а читатель выбирает строку по имени, пришедшему из бланка.
 */
const ALIAS_ROWS: Array<[alias: string, canon: string]> = [
  ['ESTRADIOL', 'E2'],
  ['PROLACTIN', 'PRL'],
  ['TOTAL_T', 'TESTOSTERONE'],
  ['T3_FREE', 'FT3'],
  ['T4_FREE', 'FT4'],
  ['INSULIN', 'INS'],
  ['FOLATE', 'FOL'],
  ['HSCRP', 'CRP'],
  ['PROGESTERONE', 'PROG'],
];

/**
 * Единицы, в которых таблицы несоизмеримы: числа совпадают, но означают разное.
 * Это не долг выбора порога, а ловушка сравнения — пара не должна попадать в
 * числовой реестр, и её нельзя «свести» сравнением чисел.
 */
const UNIT_MISMATCH: Array<[code: string, note: string]> = [
  [
    'PROGESTERONE',
    'каталог держит нмоль/л (0.3–1.5), ступень — нг/мл с теми же числами 0.3–1.5 (строка повторяет PROG): сравнение по числу запрещено, нужен пересчёт ×3.18',
  ],
];

const numbersIn = (text: string): number[] => (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);

describe('проход 207: LAB_TIERS против UCUM_MAP — долг переписан, не спрятан', () => {
  it('реестр совпадает с фактическим расхождением (новая пара не пройдёт молча)', () => {
    const actual = divergencesNow()
      .map(([code, side]) => `${code}:${side}`)
      .sort();
    const recorded = DEBT.map(([code, side]) => `${code}:${side}`).sort();
    expect(
      recorded,
      'пара разошлась или срослась: правка ступени/каталога обязана прийти вместе с этим реестром и §4',
    ).toEqual(actual);
  });

  it('каждая запись называет оба числа, и они — фактические', () => {
    for (const [code, side, tier, catalog, note] of DEBT) {
      const row = LAB_TIERS[code];
      expect(row, `нет строки ступеней ${code}`).toBeTruthy();
      expect(tierValue(row, side), `${code}: сторона ${side} — число модели`).toBe(tier);
      expect(catalogValue(code, side), `${code}: сторона ${side} — число каталога`).toBe(catalog);
      expect(note.length, `${code}: повод не записан`).toBeGreaterThan(30);
      const numbers = numbersIn(note);
      expect(numbers, `${code}: повод не называет модельное число ${tier}`).toContain(tier);
      expect(numbers, `${code}: повод не называет каталожное число ${catalog}`).toContain(catalog);
    }
  });

  it('сверяется только та сторона, которую модель судит', () => {
    for (const [code, side] of DEBT) {
      const dir = LAB_TIERS[code].direction;
      expect(dir, `${code}: записана сторона ${side}, а лестница ${dir} — такая пара не сравнивается`).not.toBe(
        side === 'low' ? 'high' : 'low',
      );
    }
  });

  it('двойники внутри LAB_TIERS повторяют канон', () => {
    for (const [alias, canon] of ALIAS_ROWS) {
      const a = LAB_TIERS[alias];
      const c = LAB_TIERS[canon];
      expect(a, `нет строки ${alias}`).toBeTruthy();
      expect(c, `нет строки ${canon}`).toBeTruthy();
      expect([...a.normal], `${alias} ≠ ${canon}: норма`).toEqual([...c.normal]);
      expect([...a.borderline], `${alias} ≠ ${canon}: грань`).toEqual([...c.borderline]);
      expect([...a.treatment], `${alias} ≠ ${canon}: лечение`).toEqual([...c.treatment]);
    }
  });

  it('несоизмеримые единицы не сравниваются по числу', () => {
    for (const [code, note] of UNIT_MISMATCH) {
      const row = LAB_TIERS[code];
      const cat = (UCUM_MAP as Record<string, { prefUnit?: string } | undefined>)[code];
      expect(row, `нет строки ступеней ${code}`).toBeTruthy();
      expect(cat, `нет записи каталога ${code}`).toBeTruthy();
      expect(row.unit, `${code}: единицы совпали — запись в UNIT_MISMATCH больше не нужна`).not.toBe(cat!.prefUnit);
      expect(note.length, `${code}: повод не записан`).toBeGreaterThan(30);
      expect(numbersIn(note).length, `${code}: повод не называет числа`).toBeGreaterThan(1);
    }
  });
});
