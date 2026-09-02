/**
 * health-diary.engine.test.ts — tests for unified health diary engine.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addUnifiedHealthEntry,
  deleteUnifiedHealthEntry,
  getTodayUnifiedEntry,
  getUnifiedAcneStats,
  getUnifiedEntryByDate,
  getUnifiedHealthEntries,
  getUnifiedHematoStats,
  getUnifiedNeuroStats,
  getUnifiedPainStats,
  getUnifiedSymptomsStats,
  getUnifiedTodayStatus,
  resetUnifiedHealthDiary,
  saveUnifiedHealthEntries,
  todayIso,
  updateUnifiedHealthEntry,
} from '../health-diary.engine';

 beforeEach(() => {
   resetUnifiedHealthDiary();
 });

 describe('health-diary.engine', () => {
   it('returns empty array when no entries', () => {
     expect(getUnifiedHealthEntries()).toEqual([]);
   });

   it('adds and retrieves entry', () => {
     const entries = addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 5, knees: 3 }, totalScore: 8 },
       symptoms: [{ id: '1', name: 'Боль', severity: 3 }],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(entries).toHaveLength(1);
     expect(entries[0].date).toBe('2024-01-15');
     expect(entries[0].pain?.totalScore).toBe(8);
   });

   it('overwrites existing entry on same date', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 5 }, totalScore: 5 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const entries = addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 8 }, totalScore: 8 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(entries).toHaveLength(1);
     expect(entries[0].pain?.totalScore).toBe(8);
   });

   it('updates entry by date', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 5 }, totalScore: 5 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const entries = updateUnifiedHealthEntry('2024-01-15', (e) => {
       e.pain = { zones: { shoulders: 9 }, totalScore: 9 };
     });
     expect(entries[0].pain?.totalScore).toBe(9);
   });

   it('deletes entry by date', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 5 }, totalScore: 5 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const entries = deleteUnifiedHealthEntry('2024-01-15');
     expect(entries).toHaveLength(0);
   });

   it('getUnifiedEntryByDate returns null for missing date', () => {
     expect(getUnifiedEntryByDate('2024-01-01')).toBeNull();
   });

   it('getTodayUnifiedEntry returns today entry', () => {
     const today = todayIso();
     addUnifiedHealthEntry({
       date: today,
       pain: { zones: { shoulders: 5 }, totalScore: 5 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(getTodayUnifiedEntry()?.date).toBe(today);
   });

   it('pain stats returns null when no pain entries', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(getUnifiedPainStats(getUnifiedHealthEntries())).toBeNull();
   });

   it('pain stats computes correctly', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 5, knees: 3 }, totalScore: 8 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const stats = getUnifiedPainStats(getUnifiedHealthEntries());
     expect(stats).not.toBeNull();
     expect(stats!.avg).toBe(8);
     expect(stats!.max).toBe(8);
      expect(stats!.zoneStats).toHaveLength(9);
   });

   it('symptoms stats computes correctly', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [
         { id: '1', name: 'Головная боль', severity: 3 },
         { id: '2', name: 'Тошнота', severity: 2 },
       ],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const stats = getUnifiedSymptomsStats(getUnifiedHealthEntries());
     expect(stats).not.toBeNull();
     expect(stats!.total).toBe(2);
     expect(stats!.uniqueNames).toBe(2);
   });

   it('neuro stats computes correctly', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [],
       neuro: { symptoms: { anxiety: true, insomnia: true }, totalScore: 2 },
       acne: null,
       hemato: null,
     });
     const stats = getUnifiedNeuroStats(getUnifiedHealthEntries());
     expect(stats).not.toBeNull();
     expect(stats!.avg).toBe(2);
   });

   it('acne stats computes correctly', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [],
       neuro: null,
       acne: { areas: { face: 2, chest: 1 }, totalScore: 3 },
       hemato: null,
     });
     const stats = getUnifiedAcneStats(getUnifiedHealthEntries());
     expect(stats).not.toBeNull();
     expect(stats!.avg).toBe(3);
   });

   it('hemato stats computes correctly', () => {
     addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: { symptoms: { nosebleeds: true }, totalScore: 1 },
     });
     const stats = getUnifiedHematoStats(getUnifiedHealthEntries());
     expect(stats).not.toBeNull();
     expect(stats!.avg).toBe(1);
   });

   it('today status returns alert for high pain', () => {
     const today = todayIso();
     addUnifiedHealthEntry({
       date: today,
       pain: { zones: { shoulders: 8 }, totalScore: 8 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const status = getUnifiedTodayStatus(getUnifiedHealthEntries());
     expect(status?.status).toBe('alert');
   });

   it('today status returns watch for moderate symptoms', () => {
     const today = todayIso();
     addUnifiedHealthEntry({
       date: today,
       pain: null,
       symptoms: [{ id: '1', name: 'Боль', severity: 4 }],
       neuro: null,
       acne: null,
       hemato: null,
     });
     const status = getUnifiedTodayStatus(getUnifiedHealthEntries());
     expect(status?.status).toBe('watch');
   });

   it('today status returns null when no issues', () => {
     const today = todayIso();
     addUnifiedHealthEntry({
       date: today,
       pain: null,
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(getUnifiedTodayStatus(getUnifiedHealthEntries())).toBeNull();
   });

   it('validates and clamps pain zones to 0-10', () => {
     const entries = addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: { zones: { shoulders: 15, knees: -3, hips: 7 }, totalScore: 100 },
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(entries[0].pain?.zones.shoulders).toBe(10);
     expect(entries[0].pain?.zones.knees).toBe(0);
     expect(entries[0].pain?.zones.hips).toBe(7);
   });

   it('validates and clamps symptom severity to 1-5', () => {
     const entries = addUnifiedHealthEntry({
       date: '2024-01-15',
       pain: null,
       symptoms: [
         { id: '1', name: 'Test', severity: 10 },
         { id: '2', name: '', severity: 3 },
       ],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(entries[0].symptoms).toHaveLength(1);
     expect(entries[0].symptoms[0].severity).toBe(5);
   });

   it('validates date format', () => {
     const entries = addUnifiedHealthEntry({
       date: 'not-a-date',
       pain: null,
       symptoms: [],
       neuro: null,
       acne: null,
       hemato: null,
     });
     expect(entries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
   });

   it('saves and loads via saveUnifiedHealthEntries', () => {
     const entries = [
       {
         date: '2024-01-15',
         pain: { zones: { shoulders: 5 }, totalScore: 5 },
         symptoms: [],
         neuro: null,
         acne: null,
         hemato: null,
       },
     ];
     saveUnifiedHealthEntries(entries);
     const loaded = getUnifiedHealthEntries();
     expect(loaded).toHaveLength(1);
     expect(loaded[0].date).toBe('2024-01-15');
   });

   it('caps entries at 365', () => {
     for (let i = 0; i < 400; i++) {
       const d = new Date(2024, 0, 1);
       d.setDate(d.getDate() + i);
       addUnifiedHealthEntry({
         date: d.toISOString().slice(0, 10),
         pain: null,
         symptoms: [],
         neuro: null,
         acne: null,
         hemato: null,
       });
     }
     expect(getUnifiedHealthEntries().length).toBeLessThanOrEqual(365);
   });
 });
