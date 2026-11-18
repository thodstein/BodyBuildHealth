/**
 * lab-parser-bound-values.test.ts — проход 138: импорт бланка читает напечатанное.
 *
 * Два класса ошибок одного рода — «в импорт попадает не то число»:
 *
 *  1) Граница. Бланк печатает «>1000», когда значение за пределами линейного
 *     диапазона метода. `parseLabNumber('>1000')` — это `NaN`, поэтому строка
 *     «Ферритин >1000 нг/мл» пропадала из импорта ЦЕЛИКОМ (перегрузка железом не
 *     доходила ни до склада, ни до риск-модели). В табличной строке знак терялся
 *     иначе: «Ферритин\t>1000\tнг/мл\t30-400» читал «>1000» как нижнюю границу
 *     нормы (refLow 1000) и помечал результат как НОРМА.
 *
 *  2) Цифра из названия. «Витамин D 25-OH 62 нмоль/л» разбирался как VITD = 25 в
 *     единицах «-OH»: 25 — это часть названия метаболита, а результат — 62.
 *     Табличные строки это уже обходили разбором по колонкам, обычный текст — нет.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const savedLabPoints: any[] = [];
vi.mock('../db', () => ({
  db: {
    init: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(async (store: string, data: any) => {
      if (store === 'labs_log') savedLabPoints.push(data);
    }),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getByIndex: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../data-link', () => ({ notifyDataChange: vi.fn() }));

import { parseLabText } from '../lab-auto-parser';
import { saveParsedLabs } from '../ocr-engine';
import { labValueLabel } from '../lab-value-label';

beforeEach(() => {
  vi.clearAllMocks();
  savedLabPoints.length = 0;
  localStorage.clear();
});

const one = (text: string) => {
  const rows = parseLabText(text);
  expect(rows).toHaveLength(1);
  return rows[0];
};

describe('проход 138: граница «>N» / «<N» доходит до импорта', () => {
  it('ферритин «>1000» больше не пропадает и не становится «нормой»', () => {
    const ferritin = one('Ферритин >1000 нг/мл 30-400');
    expect(ferritin.marker).toBe('FERRITIN');
    expect(ferritin.value).toBe(1000);
    expect(ferritin.bound).toBe('>');
    // Референс берётся из бланка, а не из самого значения.
    expect(ferritin.refRange).toBe('30-400');
    expect(ferritin.refLow).toBe(30);
    expect(ferritin.refHigh).toBe(400);
    expect(ferritin.isAbnormal).toBe(true);
  });

  it('табличная строка: «>1000» не подменяет нижнюю границу нормы', () => {
    const ferritin = one('Ферритин\t>1000\tнг/мл\t30-400');
    expect(ferritin.value).toBe(1000);
    expect(ferritin.bound).toBe('>');
    expect(ferritin.refRange).toBe('30-400');
    expect(ferritin.isAbnormal).toBe(true);
  });

  it('«<50» ниже нижней границы — отклонение, знак сохранён', () => {
    const cr = one('Креатинин <50 мкмоль/л 62-106');
    expect(cr.marker).toBe('CREATININE');
    expect(cr.value).toBe(50);
    expect(cr.bound).toBe('<');
    expect(cr.isAbnormal).toBe(true);
    expect(cr.deviation).toBe('low');
  });

  it('«<0.5» СРБ — не «выше нормы» и не выдуманный референс', () => {
    const crp = one('СРБ <0.5 мг/л');
    expect(crp.bound).toBe('<');
    expect(crp.value).toBe(0.5);
    expect(crp.refRange).toBeUndefined();
    // 0.5 мг/л ниже верхней границы СРБ — вердикт «высокий» был бы выдумкой.
    expect(crp.isAbnormal).toBe(false);
  });

  it('вывод, который граница не доказывает, не делается', () => {
    // «>110» значит «не меньше 110»: значение может быть и 150 (норма), поэтому
    // «ниже нормы» доказать нельзя — вердикта нет.
    const hgb = one('Гемоглобин >110 г/л 130-170');
    expect(hgb.bound).toBe('>');
    expect(hgb.isAbnormal).toBeUndefined();
    // Зеркально: «<500» при верхней границе 400 не доказывает «выше нормы».
    const ferritin = one('Ферритин <500 нг/мл 30-400');
    expect(ferritin.bound).toBe('<');
    expect(ferritin.isAbnormal).toBeUndefined();
  });

  it('обычное число по-прежнему без знака', () => {
    const alt = one('АЛТ 120 Ед/л 0-41');
    expect(alt.bound).toBeUndefined();
    expect(alt.value).toBe(120);
    expect(alt.isAbnormal).toBe(true);
  });

  it('граница переживает сохранение в склад анализов', async () => {
    await saveParsedLabs([
      { code: 'FERRITIN', name: 'Ферритин', value: 1000, unit: 'нг/мл', bound: '>', isAbnormal: true },
      { code: 'ALT', name: 'АЛТ', value: 30, unit: 'Ед/л' },
    ], 'course');
    expect(savedLabPoints).toHaveLength(2);
    expect(savedLabPoints[0].bound).toBe('>');
    expect(savedLabPoints[1].bound).toBeUndefined();
  });

  it('интерфейс печатает «>1000», а не «1000»', () => {
    expect(labValueLabel(1000, '>')).toBe('>1000');
    expect(labValueLabel(0.5, '<')).toBe('<0.5');
    expect(labValueLabel(30)).toBe('30');
    expect(labValueLabel(undefined, '>')).toBe('—');
  });
});

describe('проход 138: цифра из названия метаболита — не результат', () => {
  const cases = [
    'Витамин D 25-OH 62 нмоль/л',
    '25-OH витамин D 62 нмоль/л',
    'Витамин D (25-OH) 62 нмоль/л',
    '1,25-(OH)2 витамин D 62 нмоль/л',
  ];
  for (const text of cases) {
    it(`«${text}» → 62 нмоль/л, а не 25`, () => {
      const v = one(text);
      expect(v.marker).toBe('VITD');
      expect(v.value).toBe(62);
      expect(v.unit).toBe('нмоль/л');
    });
  }

  it('табличная строка с «25-OH» в названии не сдвигает колонки', () => {
    const v = one('Витамин D 25-OH\t62\tнмоль/л\t30-100');
    expect(v.value).toBe(62);
    expect(v.unit).toBe('нмоль/л');
    expect(v.refRange).toBe('30-100');
    expect(v.isAbnormal).toBe(false);
  });
});
