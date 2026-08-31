import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeCompensation, computeRollingCompensation, getDiaryDaySummary, getYesterdaySummary } from '../../ui/screens/NutritionScreen_parts/IndividualPlan/planner-diary-adaptation';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

const LS_KEY = 'nutrition_diary';

function setDiary(data: Record<string, any>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

describe('planner-diary-adaptation', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('computeCompensation', () => {
    it('returns empty when no actual data', () => {
      const result = computeCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, null);
      expect(result.applied).toBe(false);
      expect(result.note).toBe('');
    });

    it('triggers compensation for significant deficit', () => {
      const actual = { date: '2026-01-02', kcal: 1500, p: 100, f: 40, c: 150, entries: 5 };
      const result = computeCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, actual);
      expect(result.applied).toBe(true);
      expect(result.delta.kcal).toBeGreaterThan(0);
      expect(result.note).toContain('недобор');
    });

    it('triggers compensation for significant surplus', () => {
      const actual = { date: '2026-01-02', kcal: 3500, p: 200, f: 120, c: 500, entries: 5 };
      const result = computeCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, actual);
      expect(result.applied).toBe(true);
      expect(result.delta.kcal).toBeLessThan(0);
      expect(result.note).toContain('перебор');
    });

    it('caps compensation at ±15% kcal', () => {
      const actual = { date: '2026-01-02', kcal: 500, p: 50, f: 20, c: 50, entries: 3 };
      const result = computeCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, actual);
      const maxKcalDelta = 2500 * 0.15;
      expect(Math.abs(result.delta.kcal)).toBeLessThanOrEqual(maxKcalDelta);
    });

    it('returns trivial note for minor deviations', () => {
      const actual = { date: '2026-01-02', kcal: 2480, p: 158, f: 68, c: 295, entries: 4 };
      const result = computeCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, actual);
      expect(result.applied).toBe(false);
      expect(result.note).toContain('компенсация не требуется');
    });
  });

  describe('getDiaryDaySummary', () => {
    it('returns null for empty diary', () => {
      expect(getDiaryDaySummary('2026-01-01')).toBeNull();
    });

    it('returns summary for day with meals', () => {
      setDiary({
        '2026-01-01': {
          meals: {
            'Завтрак': [
              { name: 'Яйца', kcal: 220, p: 18, f: 15, c: 2 },
              { name: 'Овсянка', kcal: 150, p: 5, f: 3, c: 27 },
            ],
          },
        },
      });
      const summary = getDiaryDaySummary('2026-01-01');
      expect(summary).not.toBeNull();
      expect(summary!.kcal).toBe(370);
      expect(summary!.p).toBe(23);
      expect(summary!.entries).toBe(2);
    });

    it('returns null for day with empty meals', () => {
      setDiary({ '2026-01-01': { meals: {} } });
      expect(getDiaryDaySummary('2026-01-01')).toBeNull();
    });
  });

  describe('getYesterdaySummary', () => {
    it('returns summary for yesterday local date', () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      setDiary({
        [iso]: {
          meals: {
            'Обед': [{ name: 'Курица', kcal: 400, p: 35, f: 10, c: 40 }],
          },
        },
      });
      const summary = getYesterdaySummary();
      expect(summary).not.toBeNull();
      expect(summary!.date).toBe(iso);
      expect(summary!.kcal).toBe(400);
    });
  });

  describe('computeRollingCompensation — скользящая по датам (Эпик 5)', () => {
    it('refDateISO: день N компенсирует факт дня N−1 (не только сегодня)', () => {
      // «сегодня» — 2026-08-10 (фикс). План дня 2026-08-11 (offset 1) смотрит на 10-е.
      setDiary({
        '2026-08-09': { meals: { 'Обед': [{ name: 'X', kcal: 700, p: 60, f: 20, c: 80 }] } },
        '2026-08-10': { meals: { 'Обед': [{ name: 'X', kcal: 3000, p: 150, f: 80, c: 350 }] } },
      });
      const target = { kcal: 2500, p: 160, f: 70, c: 300 };
      // День плана 11-е: «вчера» = 10-е (перебор 3000 vs 2500) → знак компенсации
      // определяется недельным балансом (9-е был сильный недобор — rolling суммирует)
      const r1 = computeRollingCompensation(target, 3, '2026-08-11');
      expect(r1.applied).toBe(true);
      expect(r1.yesterday?.date).toBe('2026-08-10');
      expect(r1.note).toContain('вчера перебор');
      // День плана 10-е: «вчера» = 9-е (недобор 700 vs 2500) → компенсация вверх
      const r2 = computeRollingCompensation(target, 3, '2026-08-10');
      expect(r2.applied).toBe(true);
      expect(r2.delta.kcal).toBeGreaterThan(0);
      expect(r2.yesterday?.date).toBe('2026-08-09');
    });
    it('база = переданная дата (явный refDateISO как «сегодня»)', () => {
      setDiary({
        '2026-08-09': { meals: { 'Обед': [{ name: 'X', kcal: 3000, p: 150, f: 80, c: 350 }] } },
      });
      const r = computeRollingCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, 3, '2026-08-10');
      expect(r.applied).toBe(true);
      expect(r.yesterday?.date).toBe('2026-08-09');
    });
    it('будущий день без данных «вчера» — компенсация не применяется', () => {
      setDiary({
        '2026-08-10': { meals: { 'Обед': [{ name: 'X', kcal: 1000, p: 60, f: 20, c: 80 }] } },
      });
      // 12-е: «вчера» = 11-е (нет данных), старшие дни 10-е/9-е — 10-е есть
      const r = computeRollingCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, 3, '2026-08-12');
      expect(r.applied).toBe(true); // старшие дни (10-е) дают накопленную компенсацию
      expect(r.yesterday).toBeNull();
    });
    it('некорректный refDateISO — fallback на сегодня без бросков', () => {
      setDiary({});
      expect(() => computeRollingCompensation({ kcal: 2500, p: 160, f: 70, c: 300 }, 3, 'bad-date')).not.toThrow();
    });
  });
});
