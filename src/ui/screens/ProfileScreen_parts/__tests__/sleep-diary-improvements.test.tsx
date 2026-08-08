/**
 * Tests for sleep diary improvements
 */

import { calculateSleepDebt, calculateGoalsProgress } from '../SleepDiaryTab';
import { SleepEntry, SleepGoals } from '../../../../engines/sleep-correlation.engine';

describe('Sleep Diary Improvements', () => {
  const createEntry = (date: string, overrides: Partial<SleepEntry> = {}): SleepEntry => ({
    date,
    hours: 7,
    quality: 7,
    awakenings: 1,
    bedtime: '23:00',
    wakeTime: '07:00',
    notes: '',
    ...overrides
  });

  describe('calculateSleepDebt', () => {
    it('should calculate sleep debt correctly', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { hours: 6 }),
        createEntry('2024-01-02', { hours: 5 }),
        createEntry('2024-01-03', { hours: 7 }),
        createEntry('2024-01-04', { hours: 6 }),
        createEntry('2024-01-05', { hours: 5 }),
        createEntry('2024-01-06', { hours: 7 }),
        createEntry('2024-01-07', { hours: 6 }),
      ];

      const debt = calculateSleepDebt(diary, 8); // цель 8 часов

      expect(debt.avgDebtPerDay).toBeCloseTo(2, 1); // в среднем не хватает 2 часа
      expect(debt.totalDebt).toBeCloseTo(14, 1); // за неделю 14 часов долга
      expect(debt.recommendations.length).toBeGreaterThan(0);
    });

    it('should return zero debt when sleep meets target', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { hours: 8 }),
        createEntry('2024-01-02', { hours: 8 }),
        createEntry('2024-01-03', { hours: 9 }),
      ];

      const debt = calculateSleepDebt(diary, 8);

      expect(debt.avgDebtPerDay).toBeLessThanOrEqual(0.5);
    });

    it('should generate recommendations for long latency', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { latency: 40 }),
        createEntry('2024-01-02', { latency: 45 }),
        createEntry('2024-01-03', { latency: 35 }),
      ];

      const debt = calculateSleepDebt(diary, 8);

      expect(debt.recommendations.some(r => r.includes('засыпание'))).toBe(true);
    });
  });

  describe('calculateGoalsProgress', () => {
    const goals: SleepGoals = {
      targetHours: 8,
      targetQuality: 7,
      targetLatency: 20,
      targetAwakenings: 1,
      maxStressLevel: 5,
      alcoholDaysPerWeek: 2
    };

    it('should calculate progress correctly when goals are met', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { hours: 8, quality: 8, latency: 15, awakenings: 1, stressLevel: 3, alcohol: false }),
        createEntry('2024-01-02', { hours: 8, quality: 7, latency: 18, awakenings: 1, stressLevel: 4, alcohol: false }),
        createEntry('2024-01-03', { hours: 9, quality: 8, latency: 12, awakenings: 0, stressLevel: 3, alcohol: false }),
      ];

      const progress = calculateGoalsProgress(diary, goals, 7);

      expect(progress.hoursProgress).toBeGreaterThanOrEqual(100);
      expect(progress.qualityProgress).toBeGreaterThanOrEqual(100);
      expect(progress.overallScore).toBeGreaterThan(80);
      expect(progress.metGoals.length).toBeGreaterThan(0);
    });

    it('should calculate progress correctly when goals are not met', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { hours: 5, quality: 4, latency: 40, awakenings: 3, stressLevel: 8, alcohol: true }),
        createEntry('2024-01-02', { hours: 6, quality: 5, latency: 35, awakenings: 2, stressLevel: 7, alcohol: true }),
        createEntry('2024-01-03', { hours: 5, quality: 4, latency: 45, awakenings: 3, stressLevel: 9, alcohol: true }),
      ];

      const progress = calculateGoalsProgress(diary, goals, 7);

      expect(progress.hoursProgress).toBeLessThan(100);
      expect(progress.qualityProgress).toBeLessThan(100);
      expect(progress.overallScore).toBeLessThan(60);
      expect(progress.missedGoals.length).toBeGreaterThan(0);
    });

    it('should handle empty diary', () => {
      const progress = calculateGoalsProgress([], goals, 7);

      expect(progress.overallScore).toBe(0);
      expect(progress.metGoals.length).toBe(0);
      expect(progress.missedGoals.length).toBe(0);
    });

    it('should calculate latency progress correctly', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { latency: 10 }),
        createEntry('2024-01-02', { latency: 15 }),
      ];

      const progress = calculateGoalsProgress(diary, goals, 7);

      expect(progress.latencyProgress).toBeGreaterThanOrEqual(100); // 15 мин < 20 мин цели
    });
  });
});
