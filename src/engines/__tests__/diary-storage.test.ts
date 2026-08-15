/**
 * diary-storage.test.ts — единый слой localStorage дневников.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readDiaryEntries,
  readJSONSafe,
  saveDiaryEntries,
  capEntriesByDate,
  diaryStorageBytes,
  DEFAULT_DIARY_CAP,
} from '../diary-storage';

beforeEach(() => {
  localStorage.clear();
});

describe('diary-storage — чтение', () => {
  it('нет ключа / битый JSON / не-массив → []', () => {
    expect(readDiaryEntries('he_x')).toEqual([]);
    localStorage.setItem('he_x', '{bad json');
    expect(readDiaryEntries('he_x')).toEqual([]);
    localStorage.setItem('he_x', '{"a":1}');
    expect(readDiaryEntries('he_x')).toEqual([]);
  });

  it('readJSONSafe: fallback при ошибке, значение при валидном JSON', () => {
    expect(readJSONSafe('he_goals', { a: 1 })).toEqual({ a: 1 });
    localStorage.setItem('he_goals', '{"b":2}');
    expect(readJSONSafe('he_goals', { a: 1 })).toEqual({ b: 2 });
    localStorage.setItem('he_goals', 'x');
    expect(readJSONSafe('he_goals', { a: 1 })).toEqual({ a: 1 });
  });
});

describe('diary-storage — запись и кап', () => {
  it('saveDiaryEntries пишет массив, read возвращает его', () => {
    expect(saveDiaryEntries('he_x', [{ date: '2026-01-01' }, { date: '2026-01-02' }])).toBe(true);
    expect(readDiaryEntries('he_x').length).toBe(2);
  });

  it('кап 365: остаются НОВЕЙШИЕ по дате (устойчив к любому порядку входа)', () => {
    const many = [];
    for (let i = 0; i < 500; i++) {
      const day = String(i).padStart(3, '0');
      many.push({ date: `2025-01-${day}` });
    }
    many.sort((a, b) => a.date.localeCompare(b.date)); // ASC — как quick-add пути
    saveDiaryEntries('he_x', many);
    const loaded = readDiaryEntries('he_x');
    expect(loaded.length).toBe(365);
    expect(loaded[0].date).toBe('2025-01-499');
    expect(loaded[364].date).toBe('2025-01-135');
  });

  it('элементы без date сохраняются в конец (не теряются)', () => {
    saveDiaryEntries('he_x', [{ date: '2026-01-01' }, { note: 'no-date' }]);
    const loaded = readDiaryEntries('he_x');
    expect(loaded.length).toBe(2);
    expect(loaded[1]).toEqual({ note: 'no-date' });
  });

  it('capEntriesByDate — чистый хелпер', () => {
    const out = capEntriesByDate([{ date: '2026-02-01' }, { date: '2026-01-01' }, { date: '2026-03-01' }], 2);
    expect(out.map((e) => e.date)).toEqual(['2026-03-01', '2026-02-01']);
    expect(DEFAULT_DIARY_CAP).toBe(365);
  });

  it('diaryStorageBytes: 0 для отсутствующего ключа, >0 для записанного', () => {
    expect(diaryStorageBytes('he_x')).toBe(0);
    saveDiaryEntries('he_x', [{ date: '2026-01-01', value: 'some text' }]);
    expect(diaryStorageBytes('he_x')).toBeGreaterThan(0);
  });
});
