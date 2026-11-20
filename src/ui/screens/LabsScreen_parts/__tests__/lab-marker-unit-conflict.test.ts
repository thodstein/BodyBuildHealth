/**
 * lab-marker-unit-conflict.test.ts — проход 178: единица бланка — часть данных.
 *
 * Отклонение маркера считает одно правило — `computeMarkerDeviations`. Оно
 * приводит число к единице приложения через `normalizeLabMeasurement`. Но если
 * пересчитать нечем, число оставалось в единице бланка и всё равно сравнивалось
 * с нормой: КФК-МВ 25 Е/л (активность) против нормы 0–5 нг/мл (масса) давало
 * «отклонение 400 %» — то есть вывод из сопоставления двух разных величин.
 *
 * Теперь такая запись уходит в «без вывода» с причиной `unit`. Диапазон,
 * напечатанный в самом бланке, главнее: он в одной единице с числом, и его
 * сравнение честное.
 *
 * Гард держит границу с двух сторон:
 *  - разные величины без коэффициента → `unit`, не отклонение;
 *  - разное написание одной единицы (`г/л`/`g/L`, `мЕд/л`/`mIU/L`, `мкг/л`/`ug/L`)
 *    и пересчитываемые единицы (`нг/дл`→`nmol/L`, `пмоль/л`→`pg/mL`) —
 *    по-прежнему нормальный путь, иначе весь разбор бланков стал бы «без вывода».
 */
import { describe, it, expect } from 'vitest';
import { computeMarkerDeviations } from '../lab-marker-risks';

/** Одна запись анализа в том виде, в каком она лежит в `labs_log`. */
function lab(code: string, value: number, unit?: string, extra: Record<string, unknown> = {}) {
  return { code, value, unit, ...extra };
}

describe('проход 178: чужую единицу не сравниваем с нормой', () => {
  it('КФК-МВ в Е/л — «без нормы в этой единице», а не отклонение', () => {
    const r = computeMarkerDeviations([lab('CK_MB', 25, 'Е/л')], 'male');
    expect(r.markerDeviations).toEqual([]);
    expect(r.unknown).toEqual([{ code: 'CK_MB', value: 25, bound: undefined, reason: 'unit' }]);
  });

  it('строчная запись «ед/л» — та же активность, тот же вывод', () => {
    const r = computeMarkerDeviations([lab('CK_MB', 25, 'ед/л')], 'male');
    expect(r.unknown).toEqual([{ code: 'CK_MB', value: 25, bound: undefined, reason: 'unit' }]);
  });

  it('КФК-МВ в нг/мл — обычное сравнение', () => {
    const r = computeMarkerDeviations([lab('CK_MB', 25, 'нг/мл')], 'male');
    expect(r.unknown).toEqual([]);
    expect(r.markerDeviations.map(d => d.code)).toEqual(['CK_MB']);
  });

  it('бланковый диапазон главнее: та же единица, что у числа', () => {
    // В бланке напечатано «КФК-МВ 25 Е/л, норма до 24 Е/л» — пересчёт не нужен.
    const r = computeMarkerDeviations(
      [lab('CK_MB', 25, 'Е/л', { refLow: 0, refHigh: 24 })],
      'male',
    );
    expect(r.unknown).toEqual([]);
    expect(r.markerDeviations.map(d => d.code)).toEqual(['CK_MB']);
  });

  it('разное написание одной единицы — не повод молчать', () => {
    const cases: Array<[code: string, value: number, unit: string]> = [
      ['ALT', 60, 'Е/л'],          // «Е/л» не разбирается как концентрация
      ['HGB', 150, 'г/л'],
      ['FERRITIN', 120, 'мкг/л'],
      ['GLU', 5.2, 'ммоль/л'],
      ['TSH', 2.1, 'мЕд/л'],
      ['PRL', 12, 'мЕд/л'],        // пересчитывается в ng/mL
      ['TT', 600, 'нг/дл'],        // пересчитывается в ng/dL — та же единица
      ['HCT', 46, '%'],
      ['PLT', 250, '10^9/л'],
    ];
    for (const [code, value, unit] of cases) {
      const r = computeMarkerDeviations([lab(code, value, unit)], 'male');
      expect(r.unknown, `${code} ${unit}`).toEqual([]);
    }
  });

  it('пересчитываемая единица — не конфликт (Лп(а) остаётся, кортизол переводится)', () => {
    // Кортизол в мкг/дл переводится в нмоль/л — сравнение законно.
    const cortisol = computeMarkerDeviations([lab('CORTISOL', 15, 'мкг/дл')], 'male');
    expect(cortisol.unknown).toEqual([]);
    expect(cortisol.markerDeviations.map(d => d.code)).toEqual([]);
  });

  it('без единицы — прежний путь (число сравнивается с нормой)', () => {
    const r = computeMarkerDeviations([{ code: 'CK_MB', value: 25 }], 'male');
    expect(r.unknown).toEqual([]);
    expect(r.markerDeviations.map(d => d.code)).toEqual(['CK_MB']);
  });
});
