/**
 * pain-insights.engine.test.ts — tests for pain pattern analysis engine.
 */
import { describe, it, expect } from 'vitest';
import { analyzePainEntries, getPainAlerts, getTodayPainStatus } from '../pain-insights.engine';

 describe('pain-insights.engine', () => {
   describe('analyzePainEntries', () => {
     it('returns hasEntries=false for empty input', () => {
       const result = analyzePainEntries([]);
       expect(result.hasEntries).toBe(false);
       expect(result.insights).toEqual([]);
     });

     it('computes basic stats', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 5, knees: 3 }, totalScore: 8 },
         { date: '2024-01-02', zones: { shoulders: 6, knees: 4 }, totalScore: 10 },
       ];
       const result = analyzePainEntries(entries);
      expect(result.totalEntries).toBe(2);
      expect(result.avgTotalScore).toBe(9);
     });

     it('detects high pain severity', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 8 }, totalScore: 8 },
       ];
       const result = analyzePainEntries(entries);
       const highPain = result.insights.find(i => i.id === 'high-pain-severity');
       expect(highPain).toBeDefined();
       expect(highPain?.severity).toBe('alert');
     });

     it('detects worsening trend', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 3 }, totalScore: 3 },
         { date: '2024-01-02', zones: { shoulders: 5 }, totalScore: 5 },
         { date: '2024-01-03', zones: { shoulders: 8 }, totalScore: 8 },
       ];
       const result = analyzePainEntries(entries);
       const worsening = result.insights.find(i => i.id === 'worsening-trend');
       expect(worsening).toBeDefined();
       expect(worsening?.severity).toBe('warning');
     });

     it('detects improving streak', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 8 }, totalScore: 8 },
         { date: '2024-01-02', zones: { shoulders: 5 }, totalScore: 5 },
         { date: '2024-01-03', zones: { shoulders: 3 }, totalScore: 3 },
       ];
       const result = analyzePainEntries(entries);
       const improving = result.insights.find(i => i.id === 'improving-streak');
       expect(improving).toBeDefined();
       expect(improving?.severity).toBe('info');
     });

     it('detects time of day peak', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 5 }, totalScore: 5, timeOfDay: 'morning' },
         { date: '2024-01-02', zones: { shoulders: 6 }, totalScore: 6, timeOfDay: 'morning' },
         { date: '2024-01-03', zones: { shoulders: 7 }, totalScore: 7, timeOfDay: 'morning' },
       ];
       const result = analyzePainEntries(entries);
       const peak = result.insights.find(i => i.id === 'time-of-day-peak');
       expect(peak).toBeDefined();
       expect(peak?.title).toContain('morning');
     });

     it('detects frequent trigger', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 5 }, totalScore: 5, triggers: ['squat'] },
         { date: '2024-01-02', zones: { shoulders: 6 }, totalScore: 6, triggers: ['squat'] },
         { date: '2024-01-03', zones: { shoulders: 7 }, totalScore: 7, triggers: ['squat'] },
       ];
       const result = analyzePainEntries(entries);
       const trigger = result.insights.find(i => i.id === 'frequent-trigger');
       expect(trigger).toBeDefined();
       expect(trigger?.title).toContain('squat');
     });

     it('detects exercise-linked pain', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 5 }, totalScore: 5, linkedExercise: 'bench press' },
         { date: '2024-01-02', zones: { shoulders: 6 }, totalScore: 6, linkedExercise: 'bench press' },
         { date: '2024-01-03', zones: { shoulders: 7 }, totalScore: 7, linkedExercise: 'bench press' },
       ];
       const result = analyzePainEntries(entries);
       const ex = result.insights.find(i => i.id === 'exercise-linked-pain');
       expect(ex).toBeDefined();
       expect(ex?.title).toContain('bench press');
     });

     it('detects stale diary', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 5 }, totalScore: 5 },
       ];
       const result = analyzePainEntries(entries);
       const stale = result.insights.find(i => i.id === 'stale-diary');
       expect(stale).toBeDefined();
     });

     it('limits entries to 90 days', () => {
       const entries = [];
       for (let i = 0; i < 100; i++) {
         const d = new Date(2024, 0, 1);
         d.setDate(d.getDate() + i);
         entries.push({ date: d.toISOString().slice(0, 10), zones: { shoulders: 5 }, totalScore: 5 });
       }
       const result = analyzePainEntries(entries);
       expect(result.totalEntries).toBe(90);
     });
   });

   describe('getPainAlerts', () => {
     it('returns only alert and warning insights', () => {
       const entries = [
         { date: '2024-01-01', zones: { shoulders: 8 }, totalScore: 8 },
         { date: '2024-01-02', zones: { shoulders: 3 }, totalScore: 3 },
       ];
       const alerts = getPainAlerts(entries);
       expect(alerts.every(a => a.severity === 'alert' || a.severity === 'warning')).toBe(true);
     });
   });

   describe('getTodayPainStatus', () => {
     // Локальная дата (движок todayLocal() сравнивает с локальной датой, не UTC)
     const todayLocal = (): string => {
       const d = new Date();
       return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
     };

     it('returns alert for pain >= 7', () => {
       const entries = [
         { date: todayLocal(), zones: { shoulders: 8 }, totalScore: 8 },
       ];
       const status = getTodayPainStatus(entries);
       expect(status?.status).toBe('alert');
     });

     it('returns watch for pain 4-6', () => {
       const entries = [
         { date: todayLocal(), zones: { shoulders: 5 }, totalScore: 5 },
       ];
       const status = getTodayPainStatus(entries);
       expect(status?.status).toBe('watch');
     });

     it('returns ok for pain < 4', () => {
       const entries = [
         { date: todayLocal(), zones: { shoulders: 2 }, totalScore: 2 },
       ];
       const status = getTodayPainStatus(entries);
       expect(status?.status).toBe('ok');
     });

     it('returns null when no today entry', () => {
       const status = getTodayPainStatus([]);
       expect(status).toBeNull();
     });
   });
 });
