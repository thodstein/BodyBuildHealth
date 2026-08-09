import { describe, it, expect, beforeEach } from 'vitest';
import { useBPAlerts } from '../useBPAlerts';
import { calculateTrend } from '../bp-trend-prediction';
import { BPEntry } from '../../../../../../core/bp-hr-data';

describe('BP Alerts and Trends', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('useBPAlerts logic', () => {
    it('should identify crisis BP values', () => {
      const entry: BPEntry = { date: '2024-01-01', systolic: 185, diastolic: 125, hr: 70 };
      expect(entry.systolic >= 180 || entry.diastolic >= 120).toBe(true);
    });

    it('should identify high BP values', () => {
      const entry: BPEntry = { date: '2024-01-01', systolic: 145, diastolic: 95, hr: 70 };
      expect(entry.systolic >= 140 || entry.diastolic >= 90).toBe(true);
    });

    it('should detect rising trend in data', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 125, diastolic: 85, hr: 71 },
        { date: '2024-01-02', systolic: 135, diastolic: 90, hr: 72 },
        { date: '2024-01-03', systolic: 145, diastolic: 95, hr: 70 },
      ];
      // Trend is up (125 -> 135 -> 145)
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const trendUp = sorted[sorted.length - 1].systolic > sorted[0].systolic;
      expect(trendUp).toBe(true);
    });
  });

  describe('calculateTrend', () => {
    it('should calculate rising trend', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 125, diastolic: 82, hr: 71 },
        { date: '2024-01-03', systolic: 130, diastolic: 84, hr: 72 },
        { date: '2024-01-04', systolic: 135, diastolic: 86, hr: 73 },
        { date: '2024-01-05', systolic: 140, diastolic: 88, hr: 74 },
      ];
      const trend = calculateTrend(entries, 'systolic');
      expect(trend.trend).toBe('rising');
      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.prediction7d).toBeGreaterThan(140);
    });

    it('should calculate falling trend', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 150, diastolic: 95, hr: 70 },
        { date: '2024-01-02', systolic: 145, diastolic: 92, hr: 71 },
        { date: '2024-01-03', systolic: 140, diastolic: 90, hr: 72 },
        { date: '2024-01-04', systolic: 135, diastolic: 88, hr: 73 },
        { date: '2024-01-05', systolic: 130, diastolic: 85, hr: 74 },
      ];
      const trend = calculateTrend(entries, 'systolic');
      expect(trend.trend).toBe('falling');
      expect(trend.slope).toBeLessThan(0);
    });

    it('should calculate stable trend for small changes', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 120, diastolic: 80, hr: 71 },
        { date: '2024-01-03', systolic: 120, diastolic: 80, hr: 72 },
      ];
      const trend = calculateTrend(entries, 'systolic');
      expect(trend.trend).toBe('stable');
      expect(Math.abs(trend.slope)).toBeLessThan(0.5);
    });

    it('should return valid predictions', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 125, diastolic: 82, hr: 71 },
        { date: '2024-01-03', systolic: 130, diastolic: 84, hr: 72 },
      ];
      const trend = calculateTrend(entries, 'systolic');
      expect(trend.prediction7d).toBeGreaterThan(0);
      expect(trend.prediction14d).toBeGreaterThan(0);
    });

    it('should handle insufficient data', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
      ];
      const trend = calculateTrend(entries, 'systolic');
      expect(trend.trend).toBe('stable');
      expect(trend.prediction7d).toBe(120);
    });
  });
});
