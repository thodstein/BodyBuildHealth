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
import { saveParsedLabs, processUploadedFile } from '../ocr-engine';
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
    // Проход 167: 0.5 мг/л — обрезанное число. Граница «<» не доказывает ни
    // «выше», ни «ниже», поэтому вердикта нет вовсе; прежний `false` читался
    // как «норма» и переживал сохранение в склад.
    expect(crp.isAbnormal).toBeUndefined();
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

describe('проход 167: при границе бланка вердикт — только доказанная сторона', () => {
  it('«>1000» при верхней границе 400 — доказанное отклонение', () => {
    const ferritin = one('Ферритин >1000 нг/мл 30-400');
    expect(ferritin.bound).toBe('>');
    expect(ferritin.isAbnormal).toBe(true);
    expect(ferritin.deviation).toBe('high');
  });

  it('«>100» при норме 30–400 — не «норма»: значение неизвестно', () => {
    // Обрезанное число 100 внутри нормы, но «>100» может быть и 500.
    const ferritin = one('Ферритин >100 нг/мл 30-400');
    expect(ferritin.bound).toBe('>');
    expect(ferritin.isAbnormal).toBeUndefined();
  });

  it('«<0.5» СРБ — тоже без вердикта, а не «норма»', () => {
    const crp = one('СРБ <0.5 мг/л');
    expect(crp.isAbnormal).toBeUndefined();
  });

  it('без знака вердикт прежний: оба числа точные', () => {
    expect(one('АЛТ 120 Ед/л 0-41').isAbnormal).toBe(true);
    expect(one('АЛТ 20 Ед/л 0-41').isAbnormal).toBe(false);
  });

  it('склад не получает «норму» по обрезанному числу', async () => {
    await saveParsedLabs([
      { code: 'ALT', name: 'АЛТ', value: 30, unit: 'Ед/л', bound: '>', refLow: 0, refHigh: 41, isAbnormal: false },
    ], 'course');
    expect(savedLabPoints[0].bound).toBe('>');
    expect(savedLabPoints[0].isAbnormal).toBeUndefined();
  });

  it('склад берёт сторону по половой норме: «>1000» ферритина — выше', async () => {
    await saveParsedLabs([
      { code: 'FERRITIN', name: 'Ферритин', value: 1000, unit: 'нг/мл', bound: '>' },
    ], 'course', { sex: 'male' });
    expect(savedLabPoints[0].isAbnormal).toBe(true);
    await saveParsedLabs([
      { code: 'CRP', name: 'СРБ', value: 0.5, unit: 'мг/л', bound: '<' },
    ], 'course', { sex: 'male' });
    expect(savedLabPoints[1].isAbnormal).toBeUndefined();
  });

  it('без нормы вердикт не выдумывается', async () => {
    await saveParsedLabs([
      { code: 'UNKNOWN_MARKER', name: 'Неизвестный', value: 5, unit: 'мг/л', bound: '>' },
    ], 'course');
    expect(savedLabPoints[0].isAbnormal).toBeUndefined();
  });
});

describe('проход 167: полный конвейер бланка не подменяет норму знаком', () => {
  const pipeline = async (text: string) => {
    const result = await processUploadedFile(new File([text], 'labs.txt', { type: 'text/plain' }));
    return result.labs;
  };

  it('«Ферритин >1000 нг/мл 30-400»: норма 30–400, а не сам результат', async () => {
    const labs = await pipeline('Ферритин >1000 нг/мл 30-400');
    expect(labs).toHaveLength(1);
    const [ferritin] = labs;
    expect(ferritin.bound).toBe('>');
    expect(ferritin.value).toBe(1000);
    // Раньше «>1000» становилось нижней границей нормы (refLow 1000).
    expect(ferritin.refLow).toBe(30);
    expect(ferritin.refHigh).toBe(400);
    expect(ferritin.isAbnormal).toBe(true);
  });

  it('«Ферритин >100 нг/мл 30-400»: обрезанное число — без вердикта', async () => {
    const [ferritin] = await pipeline('Ферритин >100 нг/мл 30-400');
    expect(ferritin.bound).toBe('>');
    expect(ferritin.refLow).toBe(30);
    // 100 внутри нормы, но «>100» может быть и 500 — «норма» была бы выдумкой.
    expect(ferritin.isAbnormal).toBeUndefined();
  });

  it('«СРБ <0.5 мг/л»: референс не собирается из значения', async () => {
    const [crp] = await pipeline('СРБ <0.5 мг/л');
    expect(crp.bound).toBe('<');
    expect(crp.value).toBe(0.5);
    // Раньше «<0.5» становилось «нормой до 0.5».
    expect(crp.refLow).toBeUndefined();
    expect(crp.refHigh).toBeUndefined();
    expect(crp.isAbnormal).toBeUndefined();
  });

  it('«АЛТ 35 <41 Е/л»: знак в колонке нормы остаётся нормой', async () => {
    const [alt] = await pipeline('АЛТ 35 <41 Е/л');
    expect(alt.value).toBe(35);
    expect(alt.bound).toBeUndefined();
    expect(alt.refHigh).toBe(41);
    expect(alt.isAbnormal).toBe(false);
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
