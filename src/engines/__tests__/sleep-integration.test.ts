/**
 * Tests for sleep-integration.engine.ts
 */

import {
  getTrainingDatesFromStorage,
  getSupplementIntakeFromStorage,
  analyzePEDImpactOnSleep,
  generateSleepHygieneNotifications,
  generateSleepReport
} from '../sleep-integration.engine';
import { SleepEntry } from '../sleep-correlation.engine';

describe('sleep-integration.engine', () => {
  // Mock localStorage
  const mockLocalStorage = (data: { [key: string]: any }) => {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, JSON.stringify(data[key]));
    });
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('getTrainingDatesFromStorage', () => {
    it('should return empty array when no training data', () => {
      const dates = getTrainingDatesFromStorage(30);
      expect(dates).toEqual([]);
    });

    it('should extract training dates from localStorage', () => {
      const today = new Date();
      const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
      const d2 = new Date(today); d2.setDate(d2.getDate() - 2);
      const d3 = new Date(today); d3.setDate(d3.getDate() - 3);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      mockLocalStorage({
        'he_workout_log_v2': [
          { date: fmt(d1), exercise: 'squat' },
          { date: fmt(d2), exercise: 'bench' },
          { date: fmt(d3), exercise: 'deadlift' }
        ]
      });

      const dates = getTrainingDatesFromStorage(30);
      expect(dates).toContain(fmt(d1));
      expect(dates).toContain(fmt(d2));
      expect(dates).toContain(fmt(d3));
    });

    it('should filter dates older than specified days', () => {
      const today = new Date();
      const oldDate = new Date(today);
      oldDate.setDate(oldDate.getDate() - 40);
      const recentDate = new Date(today);
      recentDate.setDate(recentDate.getDate() - 5);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      mockLocalStorage({
        'he_workout_log_v2': [
          { date: fmt(oldDate), exercise: 'squat' },
          { date: fmt(recentDate), exercise: 'bench' }
        ]
      });

      const dates = getTrainingDatesFromStorage(30);
      expect(dates.length).toBe(1);
      expect(dates[0]).toBe(fmt(recentDate));
    });
  });

  describe('getSupplementIntakeFromStorage', () => {
    it('should return empty array when no supplement data', () => {
      const intake = getSupplementIntakeFromStorage(30);
      expect(intake).toEqual([]);
    });

    it('should extract supplement intake from localStorage', () => {
      const today = new Date();
      const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
      const d2 = new Date(today); d2.setDate(d2.getDate() - 2);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      mockLocalStorage({
        'he_pharma_diary': [
          { date: fmt(d1), substance: 'testosterone', dose: '250mg' },
          { date: fmt(d2), substance: 'hcg', dose: '5000iu' }
        ]
      });

      const intake = getSupplementIntakeFromStorage(30);
      expect(intake.length).toBe(2);
      const substances = intake.map(i => i.substance);
      expect(substances).toContain('testosterone');
      expect(substances).toContain('hcg');
      expect(intake.find(i => i.dose === '5000iu')?.substance).toBe('hcg');
    });
  });

  describe('analyzePEDImpactOnSleep', () => {
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

    it('should detect negative impact of stimulants on sleep', () => {
      const sleepDiary: SleepEntry[] = [
        createEntry('2024-01-01', { quality: 5 }),
        createEntry('2024-01-02', { quality: 4 }),
        createEntry('2024-01-03', { quality: 5 }),
        createEntry('2024-01-04', { quality: 8 }),
        createEntry('2024-01-05', { quality: 7 }),
        createEntry('2024-01-06', { quality: 8 }),
      ];

      const intake = [
        { date: '2024-01-01', substance: 'clenbuterol', dose: '40mcg' },
        { date: '2024-01-02', substance: 'clenbuterol', dose: '40mcg' },
        { date: '2024-01-03', substance: 'clenbuterol', dose: '40mcg' },
      ];

      const results = analyzePEDImpactOnSleep(sleepDiary, intake);

      const clenResult = results.find(r => r.substance === 'clenbuterol');
      expect(clenResult).toBeDefined();
      expect(clenResult?.avgQualityChange).toBeLessThan(0); // качество снизилось
      expect(clenResult?.sampleSize).toBe(3);
    });

    it('should return empty array when insufficient data', () => {
      const sleepDiary: SleepEntry[] = [
        createEntry('2024-01-01', { quality: 7 }),
      ];

      const intake = [
        { date: '2024-01-01', substance: 'test', dose: '100mg' },
      ];

      const results = analyzePEDImpactOnSleep(sleepDiary, intake);
      expect(results.length).toBe(0); // недостаточно данных
    });
  });

  describe('generateSleepHygieneNotifications', () => {
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

    it('should generate notification for long latency', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { latency: 40 }),
        createEntry('2024-01-02', { latency: 45 }),
        createEntry('2024-01-03', { latency: 50 }),
        createEntry('2024-01-04', { latency: 42 }),
        createEntry('2024-01-05', { latency: 48 }),
        createEntry('2024-01-06', { latency: 44 }),
        createEntry('2024-01-07', { latency: 46 }),
      ];

      const notifications = generateSleepHygieneNotifications(diary);
      expect(notifications.some(n => n.includes('засыпание'))).toBe(true);
    });

    it('should generate notification for frequent alcohol', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { alcohol: true }),
        createEntry('2024-01-02', { alcohol: true }),
        createEntry('2024-01-03', { alcohol: true }),
        createEntry('2024-01-04', { alcohol: false }),
        createEntry('2024-01-05', { alcohol: false }),
        createEntry('2024-01-06', { alcohol: false }),
        createEntry('2024-01-07', { alcohol: false }),
      ];

      const notifications = generateSleepHygieneNotifications(diary);
      expect(notifications.some(n => n.includes('алкогол'))).toBe(true);
    });

    it('should generate notification for late caffeine', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { caffeineCutoff: '16:00' }),
        createEntry('2024-01-02', { caffeineCutoff: '18:00' }),
        createEntry('2024-01-03', { caffeineCutoff: '17:00' }),
        createEntry('2024-01-04', { caffeineCutoff: '10:00' }),
        createEntry('2024-01-05', { caffeineCutoff: '09:00' }),
        createEntry('2024-01-06', { caffeineCutoff: '11:00' }),
        createEntry('2024-01-07', { caffeineCutoff: '10:00' }),
      ];

      const notifications = generateSleepHygieneNotifications(diary);
      expect(notifications.some(n => n.includes('кофеин'))).toBe(true);
    });

    it('should return empty notifications for good sleep hygiene', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { latency: 15, caffeineCutoff: '12:00', alcohol: false, screenTime: 30, stressLevel: 3, bedtime: '23:00' }),
        createEntry('2024-01-02', { latency: 18, caffeineCutoff: '11:00', alcohol: false, screenTime: 25, stressLevel: 4, bedtime: '23:30' }),
        createEntry('2024-01-03', { latency: 12, caffeineCutoff: '10:00', alcohol: false, screenTime: 40, stressLevel: 3, bedtime: '23:15' }),
      ];

      const notifications = generateSleepHygieneNotifications(diary);
      expect(notifications.length).toBe(0);
    });
  });

  describe('generateSleepReport', () => {
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

    it('should generate report with basic statistics', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { hours: 8, quality: 8 }),
        createEntry('2024-01-02', { hours: 7, quality: 7 }),
        createEntry('2024-01-03', { hours: 9, quality: 8 }),
      ];

      const goals = { targetHours: 8, targetQuality: 7 };
      const report = generateSleepReport(diary, goals);

      expect(report).toContain('ОТЧЁТ О КАЧЕСТВЕ СНА');
      expect(report).toContain('Часы сна: 8.0 ч');
      expect(report).toContain('Качество: 7.7/10');
    });

    it('should include recommendations in report', () => {
      const diary: SleepEntry[] = [
        createEntry('2024-01-01', { latency: 40 }),
        createEntry('2024-01-02', { latency: 45 }),
        createEntry('2024-01-03', { latency: 42 }),
      ];

      const goals = { targetHours: 8, targetQuality: 7 };
      const report = generateSleepReport(diary, goals);

      expect(report).toContain('РЕКОМЕНДАЦИИ');
      expect(report).toContain('засыпание');
    });

    it('should handle empty diary', () => {
      const report = generateSleepReport([], { targetHours: 8, targetQuality: 7 });
      expect(report).toBe('Нет данных о сне');
    });
  });
});
