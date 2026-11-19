/**
 * lab-diary-bound.test.ts — проход 142: дневник анализов не выдаёт обрезанное
 * число за измерение и не выдаёт неизвестное за норму.
 *
 * `importLabsToDiary` брал из точки только число: знак границы терялся, поэтому
 * «Ферритин >1000» на графике, в карточке аномалии и в истории выглядел точным
 * значением. И `inRange` было обычным boolean: если нормы нет в реестре или
 * число обрезано («>5» при верхней границе 400), дневник всё равно писал
 * «в норме» — зелёным.
 *
 * Теперь маркер хранит `bound`, а `inRange` трёхзначное: `true` — доказано,
 * `false` — отклонение доказано, `undefined` — не доказано ни то, ни другое.
 * Счётчик аномалий считает только доказанные.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  importLabsToDiary, getLabDiary, getMarkerChartData, getMarkerHistory, getRecentAbnormalMarkers,
} from '../lab-diary.engine';

const NORMS = {
  FERRITIN: { lln: 30, uln: 400 },
  ALT: { lln: 0, uln: 41 },
};

type Sample = { code: string; value: number; bound?: '<' | '>'; unit?: string };

function importOne(sample: Sample, date = '2026-11-01') {
  importLabsToDiary(
    [{
      id: `${sample.code}-${date}`,
      code: sample.code,
      name: sample.code,
      value: sample.value,
      unit: sample.unit ?? 'нг/мл',
      date,
      bound: sample.bound,
    }],
    NORMS,
  );
  return getLabDiary().find(d => d.date === date)!;
}

beforeEach(() => localStorage.clear());

describe('проход 142: дневник хранит знак границы', () => {
  it('«>1000» остаётся «>1000», а не 1000', () => {
    const day = importOne({ code: 'FERRITIN', value: 1000, bound: '>' });
    const m = day.markers[0];
    expect(m.value).toBe(1000);
    expect(m.bound).toBe('>');
    // Знак — часть записи: он переживает сохранение в localStorage.
    expect(getLabDiary()[0].markers[0].bound).toBe('>');
  });

  it('график отдаёт знак и вердикт вместе со значением', () => {
    importOne({ code: 'FERRITIN', value: 1000, bound: '>' }, '2026-10-01');
    importOne({ code: 'FERRITIN', value: 200 }, '2026-11-01');
    const chart = getMarkerChartData(getLabDiary(), 'FERRITIN');
    expect(chart.values).toEqual([1000, 200]);
    expect(chart.bounds).toEqual(['>', undefined]);
    expect(chart.inRange).toEqual([false, true]);
    const hist = getMarkerHistory(getLabDiary(), 'FERRITIN');
    expect(hist.map(h => h.bound)).toEqual(['>', undefined]);
  });
});

describe('проход 142: «в норме» только по доказанному', () => {
  it('число внутри нормы — в норме', () => {
    const day = importOne({ code: 'ALT', value: 30, unit: 'Ед/л' });
    expect(day.markers[0].inRange).toBe(true);
    expect(day.abnormalCount).toBe(0);
  });

  it('число выше нормы — отклонение', () => {
    const day = importOne({ code: 'ALT', value: 120, unit: 'Ед/л' });
    expect(day.markers[0].inRange).toBe(false);
    expect(day.abnormalCount).toBe(1);
  });

  it('обрезанное «>5» при верхней границе 400 — не «в норме» и не аномалия', () => {
    const day = importOne({ code: 'FERRITIN', value: 5, bound: '>' });
    expect(day.markers[0].inRange).toBeUndefined();
    expect(day.abnormalCount).toBe(0);
    expect(getRecentAbnormalMarkers(getLabDiary(), 365)).toHaveLength(0);
  });

  it('обрезанное «>1000» при верхней границе 400 — доказанная аномалия', () => {
    const day = importOne({ code: 'FERRITIN', value: 1000, bound: '>' });
    expect(day.markers[0].inRange).toBe(false);
    const abnormal = getRecentAbnormalMarkers(getLabDiary(), 365);
    expect(abnormal).toHaveLength(1);
    expect(abnormal[0].bound).toBe('>');
  });

  it('нормы нет в реестре — не «в норме»', () => {
    const day = importOne({ code: 'CEA', value: 1.1, unit: 'нг/мл' });
    expect(day.markers[0].inRange).toBeUndefined();
    expect(day.abnormalCount).toBe(0);
  });

  it('отклонение, которое граница не доказывает, в аномалии не попадает', () => {
    // «<500» при верхней границе 400: истинное значение может быть и нормой.
    const day = importOne({ code: 'FERRITIN', value: 500, bound: '<' });
    expect(day.markers[0].inRange).toBeUndefined();
    expect(getRecentAbnormalMarkers(getLabDiary(), 365)).toHaveLength(0);
  });
});
