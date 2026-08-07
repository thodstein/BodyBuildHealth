import { describe, expect, it } from 'vitest';
import { aggregateDiaryMicros, type DiaryDay } from '../diary-storage';

describe('diary-storage micronutrients', () => {
  it('aggregates numeric and legacy string values', () => {
    const day: DiaryDay = { meals: { Обед: [
      { name: 'Курица', kcal: 330, p: 40, f: 10, c: 0, micros: { potassium_mg: 512, sodium_mg: '130' as unknown as number } },
      { name: 'Рис', kcal: 200, p: 4, f: 1, c: 40, micros: { potassium_mg: '100,5' as unknown as number } },
    ] } };
    expect(aggregateDiaryMicros(day)).toEqual({ potassium_mg: 612.5, sodium_mg: 130 });
  });

  it('ignores malformed micronutrient values', () => {
    const day: DiaryDay = { meals: { Ужин: [{ name: 'Еда', kcal: 0, p: 0, f: 0, c: 0, micros: { magnesium_mg: 'bad' as unknown as number } }] } };
    expect(aggregateDiaryMicros(day)).toEqual({});
  });
});
