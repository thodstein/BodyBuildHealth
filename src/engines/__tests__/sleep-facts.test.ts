/**
 * Tests for sleep-facts.engine.ts
 */

import {
  parseTimeHHMM,
  sleepDurationFromTimes,
  recommendedBedtime,
  computeSleepEfficiency,
  avgSleepEfficiency,
  cumulativeSleepDebt,
  computeSleepRegularity,
  computeSleepFacts,
  qualityTo10,
  syncSleepToProfile,
  type SleepDiaryEntry,
} from '../sleep-facts.engine';

const entry = (date: string, overrides: Partial<SleepDiaryEntry> = {}): SleepDiaryEntry => ({
  date,
  hours: 7.5,
  quality: 4,
  awakenings: 1,
  bedtime: '23:00',
  wakeTime: '07:00',
  ...overrides,
});

describe('sleep-facts.engine', () => {
  describe('parseTimeHHMM', () => {
    it('парсит валидные HH:MM', () => {
      expect(parseTimeHHMM('23:30')).toBe(1410);
      expect(parseTimeHHMM('07:05')).toBe(425);
      expect(parseTimeHHMM('0:00')).toBe(0);
    });

    it('возвращает null для невалидных значений', () => {
      expect(parseTimeHHMM('25:00')).toBeNull();
      expect(parseTimeHHMM('12:60')).toBeNull();
      expect(parseTimeHHMM('abc')).toBeNull();
      expect(parseTimeHHMM(undefined)).toBeNull();
    });
  });

  describe('sleepDurationFromTimes', () => {
    it('считает длительность без пересечения полуночи', () => {
      expect(sleepDurationFromTimes('23:00', '07:00')).toBe(8);
    });

    it('считает длительность через полночь', () => {
      expect(sleepDurationFromTimes('22:30', '06:15')).toBeCloseTo(7.75, 2);
    });

    it('возвращает null при невалидных временах', () => {
      expect(sleepDurationFromTimes('23:00', undefined)).toBeNull();
      expect(sleepDurationFromTimes(undefined, undefined)).toBeNull();
    });
  });

  describe('recommendedBedtime', () => {
    it('рекомендует время отбоя под цель и подъём', () => {
      expect(recommendedBedtime('07:00', 8)).toBe('23:00');
      expect(recommendedBedtime('06:30', 7.5)).toBe('23:00');
    });

    it('обрабатывает переход через полночь', () => {
      expect(recommendedBedtime('02:00', 8)).toBe('18:00');
    });

    it('возвращает null при невалидных входных данных', () => {
      expect(recommendedBedtime('xx:00', 8)).toBeNull();
      expect(recommendedBedtime('07:00', 0)).toBeNull();
    });
  });

  describe('computeSleepEfficiency / avgSleepEfficiency', () => {
    it('считает эффективность = часы сна / время в кровати', () => {
      const e = entry('2024-01-01', { hours: 7, bedtime: '23:00', wakeTime: '07:30' });
      expect(computeSleepEfficiency(e)).toBeCloseTo(82.4, 1);
    });

    it('капает на 100%', () => {
      const e = entry('2024-01-01', { hours: 9, bedtime: '23:00', wakeTime: '07:00' });
      expect(computeSleepEfficiency(e)).toBe(100);
    });

    it('усредняет по последним записям', () => {
      const entries = [
        entry('2024-01-01', { hours: 7, bedtime: '23:00', wakeTime: '07:00' }),
        entry('2024-01-02', { hours: 7.5, bedtime: '23:00', wakeTime: '07:00' }),
        entry('2024-01-03', { hours: 8, bedtime: '23:00', wakeTime: '08:30' }),
      ];
      const avg = avgSleepEfficiency(entries, 30);
      expect(avg).not.toBeNull();
      expect(avg!).toBeGreaterThan(80);
      expect(avg!).toBeLessThanOrEqual(100);
    });
  });

  describe('cumulativeSleepDebt', () => {
    it('считает долг только за дни с записью', () => {
      const today = new Date();
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const entries = [
        entry(fmt(today), { hours: 6 }),
        entry(fmt(yest), { hours: 6 }),
      ];
      const { debt, recordedDays } = cumulativeSleepDebt(entries, 8, 7);
      expect(recordedDays).toBe(2);
      expect(debt).toBe(4);
    });

    it('не начисляет долг за пересып', () => {
      const today = new Date();
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entries = [entry(fmt(today), { hours: 9 })];
      const { debt } = cumulativeSleepDebt(entries, 8, 7);
      expect(debt).toBe(0);
    });

    it('пустой дневник → нулевой долг', () => {
      expect(cumulativeSleepDebt([], 8, 7)).toEqual({ debt: 0, recordedDays: 0 });
    });
  });

  describe('computeSleepRegularity', () => {
    it('считает разброс отбоя/подъёма и джетлаг выходных', () => {
      const fmt = (offsetDays: number) => {
        const d = new Date();
        d.setDate(d.getDate() - offsetDays);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const entries = [
        entry(fmt(6), { bedtime: '23:00', wakeTime: '07:00' }),
        entry(fmt(5), { bedtime: '23:30', wakeTime: '07:00' }),
        entry(fmt(4), { bedtime: '23:00', wakeTime: '07:30' }),
        entry(fmt(3), { bedtime: '23:15', wakeTime: '07:00' }),
        entry(fmt(2), { bedtime: '23:00', wakeTime: '07:00' }),
        entry(fmt(1), { bedtime: '00:30', wakeTime: '09:00' }),
        entry(fmt(0), { bedtime: '01:00', wakeTime: '09:30' }),
      ];
      const reg = computeSleepRegularity(entries, 14);
      expect(reg).not.toBeNull();
      expect(reg!.samples).toBe(7);
      expect(reg!.jetlagMin).not.toBeNull();
      expect(reg!.jetlagMin!).toBeGreaterThan(30);
    });

    it('меньше двух записей → null', () => {
      expect(computeSleepRegularity([entry('2024-01-01')], 14)).toBeNull();
    });
  });

  describe('computeSleepFacts', () => {
    it('считает сводку по последним 7 дням', () => {
      const today = new Date();
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entries = [
        entry(fmt(today), { hours: 8, quality: 5 }),
        entry(fmt(new Date(Date.now() - 86400000)), { hours: 6, quality: 3 }),
      ];
      const facts = computeSleepFacts(entries, 8);
      expect(facts.avgHours7).toBe(7);
      expect(facts.avgQuality7).toBe(4);
      expect(facts.recentDays).toBe(2);
      expect(facts.lastNightHours).toBe(8);
      expect(facts.targetHours).toBe(8);
    });

    it('без данных hasData=false', () => {
      const facts = computeSleepFacts([], 8);
      expect(facts.hasData).toBe(false);
      expect(facts.avgHours7).toBeNull();
    });
  });

  describe('qualityTo10', () => {
    it('конвертирует 1..5 → 2..10', () => {
      expect(qualityTo10(5)).toBe(10);
      expect(qualityTo10(1)).toBe(2);
      expect(qualityTo10(3)).toBe(6);
    });

    it('null/undefined → null', () => {
      expect(qualityTo10(null)).toBeNull();
      expect(qualityTo10(undefined)).toBeNull();
    });
  });

  describe('syncSleepToProfile', () => {
    it('no-op при пустом дневнике', () => {
      expect(() => syncSleepToProfile([])).not.toThrow();
      expect(() => syncSleepToProfile(null as unknown as SleepDiaryEntry[])).not.toThrow();
    });
  });
});
