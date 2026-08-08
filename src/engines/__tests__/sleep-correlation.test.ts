/**
 * Tests for sleep-correlation.engine.ts
 */

import {
  analyzeSleepTrainingCorrelation,
  analyzeCaffeineCorrelation,
  analyzeAlcoholCorrelation,
  analyzeScreenTimeCorrelation,
  analyzeAllSleepCorrelations,
  generateCorrelationRecommendations,
  type SleepEntry
} from '../sleep-correlation.engine';

describe('sleep-correlation.engine', () => {
  // Тестовые данные
  const createSleepEntry = (date: string, overrides: Partial<SleepEntry> = {}): SleepEntry => ({
    date,
    hours: 7,
    quality: 7,
    awakenings: 1,
    bedtime: '23:00',
    wakeTime: '07:00',
    notes: '',
    ...overrides
  });

  describe('analyzeCaffeineCorrelation', () => {
    it('should detect negative correlation when caffeine after 12:00 increases latency', () => {
      const diary: SleepEntry[] = [
        createSleepEntry('2024-01-01', { caffeineCutoff: '16:00', latency: 35 }),
        createSleepEntry('2024-01-02', { caffeineCutoff: '18:00', latency: 40 }),
        createSleepEntry('2024-01-03', { caffeineCutoff: '15:00', latency: 38 }),
        createSleepEntry('2024-01-04', { caffeineCutoff: '10:00', latency: 15 }),
        createSleepEntry('2024-01-05', { caffeineCutoff: '09:00', latency: 12 }),
        createSleepEntry('2024-01-06', { caffeineCutoff: '11:00', latency: 18 }),
      ];

      const result = analyzeCaffeineCorrelation(diary);

      expect(result).not.toBeNull();
      expect(result?.factor).toBe('Кофеин после 12:00');
      expect(result?.direction).toBe('negative'); // поздний кофеин = хуже засыпание
      expect(result?.sampleSize).toBe(3);
    });

    it('should return null when insufficient data', () => {
      const diary: SleepEntry[] = [
        createSleepEntry('2024-01-01', { caffeineCutoff: '16:00' }),
      ];

      const result = analyzeCaffeineCorrelation(diary);
      expect(result).toBeNull();
    });
  });

  describe('analyzeAlcoholCorrelation', () => {
    it('should detect negative correlation when alcohol reduces sleep quality', () => {
      const diary: SleepEntry[] = [
        createSleepEntry('2024-01-01', { alcohol: true, quality: 5, awakenings: 3 }),
        createSleepEntry('2024-01-02', { alcohol: true, quality: 4, awakenings: 4 }),
        createSleepEntry('2024-01-03', { alcohol: true, quality: 5, awakenings: 3 }),
        createSleepEntry('2024-01-04', { alcohol: false, quality: 8, awakenings: 1 }),
        createSleepEntry('2024-01-05', { alcohol: false, quality: 7, awakenings: 1 }),
        createSleepEntry('2024-01-06', { alcohol: false, quality: 8, awakenings: 0 }),
      ];

      const result = analyzeAlcoholCorrelation(diary);

      expect(result).not.toBeNull();
      expect(result?.factor).toBe('Алкоголь');
      expect(result?.direction).toBe('negative');
      expect(result?.sampleSize).toBe(3);
    });
  });

  describe('analyzeScreenTimeCorrelation', () => {
    it('should detect negative correlation when screen time > 60 min increases latency', () => {
      const diary: SleepEntry[] = [
        createSleepEntry('2024-01-01', { screenTime: 90, latency: 30 }),
        createSleepEntry('2024-01-02', { screenTime: 120, latency: 35 }),
        createSleepEntry('2024-01-03', { screenTime: 80, latency: 28 }),
        createSleepEntry('2024-01-04', { screenTime: 30, latency: 12 }),
        createSleepEntry('2024-01-05', { screenTime: 45, latency: 15 }),
        createSleepEntry('2024-01-06', { screenTime: 20, latency: 10 }),
      ];

      const result = analyzeScreenTimeCorrelation(diary);

      expect(result).not.toBeNull();
      expect(result?.factor).toBe('Экран > 60 мин перед сном');
      expect(result?.direction).toBe('negative');
    });
  });

  describe('analyzeAllSleepCorrelations', () => {
    it('should analyze all correlations and return results', () => {
      const diary: SleepEntry[] = [
        createSleepEntry('2024-01-01', { caffeineCutoff: '16:00', latency: 30, alcohol: true, screenTime: 90 }),
        createSleepEntry('2024-01-02', { caffeineCutoff: '18:00', latency: 35, alcohol: true, screenTime: 120 }),
        createSleepEntry('2024-01-03', { caffeineCutoff: '10:00', latency: 15, alcohol: false, screenTime: 30 }),
        createSleepEntry('2024-01-04', { caffeineCutoff: '09:00', latency: 12, alcohol: false, screenTime: 45 }),
        createSleepEntry('2024-01-05', { caffeineCutoff: '11:00', latency: 18, alcohol: false, screenTime: 20 }),
        createSleepEntry('2024-01-06', { caffeineCutoff: '10:00', latency: 14, alcohol: false, screenTime: 30 }),
      ];

      const input = { sleepDiary: diary };
      const results = analyzeAllSleepCorrelations(input);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.factor.includes('Кофеин'))).toBe(true);
      expect(results.some(r => r.factor.includes('Алкоголь'))).toBe(true);
      expect(results.some(r => r.factor.includes('Экран'))).toBe(true);
    });
  });

  describe('generateCorrelationRecommendations', () => {
    it('should generate recommendations for negative correlations', () => {
      const correlations = [
        {
          factor: 'Кофеин после 12:00',
          correlation: 15,
          strength: 'strong' as const,
          direction: 'negative' as const,
          description: 'Test',
          sampleSize: 5
        },
        {
          factor: 'Алкоголь',
          correlation: -2,
          strength: 'moderate' as const,
          direction: 'negative' as const,
          description: 'Test',
          sampleSize: 5
        }
      ];

      const recommendations = generateCorrelationRecommendations(correlations);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('кофеин'))).toBe(true);
      expect(recommendations.some(r => r.includes('алкогол'))).toBe(true);
    });

    it('should not generate recommendations for weak correlations', () => {
      const correlations = [
        {
          factor: 'Кофеин после 12:00',
          correlation: 3,
          strength: 'weak' as const,
          direction: 'negative' as const,
          description: 'Test',
          sampleSize: 5
        }
      ];

      const recommendations = generateCorrelationRecommendations(correlations);

      expect(recommendations.length).toBe(0);
    });
  });
});
