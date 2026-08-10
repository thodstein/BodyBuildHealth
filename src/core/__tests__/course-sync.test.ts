/**
 * course-sync.test.ts — тесты автосинхронизации course_log → profile.currentSubstances
 * и подхвата всех классов веществ (AAS/пептиды/AI/SERM/HCG/caberg/insulin/clen/T3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('Course → Profile sync (course-sync.ts)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. derivePedFlagsFromCourse: выводит флаги и дозы из course_log', async () => {
    const { derivePedFlagsFromCourse } = await import('../course-sync');
    const course = [
      { id: '1', substanceId: 'test_enan', doseValue: 500, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { id: '2', substanceId: 'hcg', doseValue: 1000, doseUnit: 'IU', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { id: '3', substanceId: 'anastrozole', doseValue: 0.5, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { id: '4', substanceId: 'caberg', doseValue: 0.5, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { id: '5', substanceId: 'somatropin', doseValue: 4, doseUnit: 'IU', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '6', substanceId: 'ins_short', doseValue: 10, doseUnit: 'IU', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '7', substanceId: 'igf1_lr3', doseValue: 50, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '8', substanceId: 'tamoxifen', doseValue: 20, doseUnit: 'mg', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '9', substanceId: 'ostarine', doseValue: 25, doseUnit: 'mg', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '10', substanceId: 'mgf', doseValue: 200, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '11', substanceId: 'clenbuterol', doseValue: 80, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 12 },
      { id: '12', substanceId: 't3', doseValue: 25, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 12 },
    ];
    const flags = derivePedFlagsFromCourse(course) as any;
    expect(flags.hasCaber).toBe(true);
    expect(flags.hasGH).toBe(true);
    expect(flags.hasIGF).toBe(true);
    expect(flags.hasInsulin).toBe(true);
    expect(flags.hasSERM).toBe(true);
    expect(flags.hasSARMs).toBe(true);
    expect(flags.hasMGF).toBe(true);
    expect(flags.ghIU).toBe(4);
    expect(flags.insulinIU).toBe(10);
    expect(flags.igfMcg).toBe(50);
    expect(flags.clenMcg).toBe(80);
    expect(flags.t3Mcg).toBe(25);
  });

  it('2. derivePedFlagsFromCourse: пустой курс → пустой результат', async () => {
    const { derivePedFlagsFromCourse } = await import('../course-sync');
    const flags = derivePedFlagsFromCourse([]) as any;
    expect(flags.hasCaber).toBeUndefined();
    expect(flags.ghIU).toBeUndefined();
  });

  it('3. mapCourseToSubstances: маппит course_log в PharmaSubstanceEntry', async () => {
    const { mapCourseToSubstances } = await import('../course-sync');
    const course = [
      { id: '1', substanceId: 'test_enan', doseValue: 500, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
      { id: '2', substanceId: 'tren_acet', doseValue: 300, doseUnit: 'mg', frequency: 'eod', startWeek: 1, endWeek: 8 },
      { id: '3', substanceId: 'hcg', doseValue: 1000, doseUnit: 'IU', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
    ];
    const subs = mapCourseToSubstances(course);
    expect(subs).toHaveLength(3);
    expect(subs[0].id).toBe('test_enan');
    expect(subs[0].name).toBe('Тестостерон энантат');
    expect(subs[0].doseMg).toBe(500);
    expect(subs[0].startWeek).toBe(1);
    expect(subs[0].endWeek).toBe(12);
    expect(subs[0].route).toBe('inject');
    expect(subs[2].id).toBe('hcg');
    // HCG → oral route (sublingual)
    expect(subs[2].route).toBe('oral');
    expect(subs[2].unit).toBe('IU');
  });

  it('4. mapCourseToSubstances: единицы для IGF/MGF (mcg)', async () => {
    const { mapCourseToSubstances } = await import('../course-sync');
    const course = [
      { id: '1', substanceId: 'igf1_lr3', doseValue: 50, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 8 },
      { id: '2', substanceId: 'mgf', doseValue: 200, doseUnit: 'mcg', frequency: 'daily', startWeek: 1, endWeek: 8 },
    ];
    const subs = mapCourseToSubstances(course);
    expect(subs[0].unit).toBe('mcg');
    expect(subs[1].unit).toBe('mcg');
  });

  it('5. hasCourseDiff: true при новых веществах', async () => {
    const { hasCourseDiff } = await import('../course-sync');
    const course = [
      { id: '1', substanceId: 'test_enan', doseValue: 500, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
    ];
    const existing = [{ id: 'tren_acet', name: 'T', doseMg: 300, unit: 'mg', route: 'inject' as const, startWeek: 1, endWeek: 8 }];
    expect(hasCourseDiff(course, existing)).toBe(true);
  });

  it('6. hasCourseDiff: false при одинаковом составе', async () => {
    const { hasCourseDiff } = await import('../course-sync');
    const course = [
      { id: '1', substanceId: 'test_enan', doseValue: 500, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
    ];
    const existing = [{ id: 'test_enan', name: 'T', doseMg: 500, unit: 'mg', route: 'inject' as const, startWeek: 1, endWeek: 12 }];
    expect(hasCourseDiff(course, existing)).toBe(false);
  });

  it('7. hasCourseDiff: false при пустом курсе', async () => {
    const { hasCourseDiff } = await import('../course-sync');
    const existing = [{ id: 'test_enan', name: 'T', doseMg: 500, unit: 'mg', route: 'inject' as const, startWeek: 1, endWeek: 12 }];
    expect(hasCourseDiff([], existing)).toBe(false);
  });

  it('8. derivePedFlagsFromSubstances: выводит флаги из currentSubstances', async () => {
    const { derivePedFlagsFromSubstances } = await import('../course-sync');
    const substances = [
      { id: 'test_enan', name: 'T', doseMg: 500, unit: 'mg', route: 'inject' as const, startWeek: 0, endWeek: 12 },
      { id: 'somatropin', name: 'GH', doseMg: 4, unit: 'IU', route: 'inject' as const, startWeek: 0, endWeek: 12 },
      { id: 'caberg', name: 'C', doseMg: 0.5, unit: 'mg', route: 'oral' as const, startWeek: 0, endWeek: 12 },
      { id: 'anastrozole', name: 'A', doseMg: 0.5, unit: 'mg', route: 'oral' as const, startWeek: 0, endWeek: 12 },
    ];
    const flags = derivePedFlagsFromSubstances(substances) as any;
    expect(flags.hasGH).toBe(true);
    expect(flags.hasCaber).toBe(true);
    expect(flags.hasAI).toBe(true);
    expect(flags.ghIU).toBe(4);
  });

  it('9. hydrateState (engine): читает doseMg/weeks/route из currentSubstances', async () => {
    const { hydrateState } = await import('../../engines/support-plan/engine');
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: {
          phase: 'course',
          currentSubstances: [
            { id: 'test_enan', name: 'Тестостерон энантат', doseMg: 500, unit: 'mg', route: 'inject', startWeek: 0, endWeek: 12 },
            { id: 'tren_acet', name: 'Тренболон ацетат', doseMg: 300, unit: 'mg', route: 'inject', startWeek: 0, endWeek: 8 },
          ],
        },
      },
    }));
    const r = hydrateState();
    const pharma = (r as any).pharma;
    expect(pharma).toBeDefined();
    expect(pharma.aas).toHaveLength(2);
    expect(pharma.aas[0].id).toBe('test_enan');
    expect(pharma.aas[0].doseMgWeek).toBe(500);
    expect(pharma.aas[0].weeks).toBe(12);
    expect(pharma.aas[1].weeks).toBe(8);
    expect(pharma.aas[0].form).toBe('inject');
  });

  it('10. hydrateState (engine): выводит hasCaber/hasGH/insulinIU из currentSubstances', async () => {
    const { hydrateState } = await import('../../engines/support-plan/engine');
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: {
          phase: 'course',
          currentSubstances: [
            { id: 'test_enan', name: 'T', doseMg: 500, unit: 'mg', route: 'inject', startWeek: 0, endWeek: 12 },
            { id: 'somatropin', name: 'GH', doseMg: 4, unit: 'IU', route: 'inject', startWeek: 0, endWeek: 12 },
            { id: 'ins_short', name: 'Insulin', doseMg: 10, unit: 'IU', route: 'inject', startWeek: 0, endWeek: 12 },
            { id: 'caberg', name: 'Cabergoline', doseMg: 0.5, unit: 'mg', route: 'oral', startWeek: 0, endWeek: 12 },
            { id: 'anastrozole', name: 'Anastrozole', doseMg: 0.5, unit: 'mg', route: 'oral', startWeek: 0, endWeek: 12 },
            { id: 'tamoxifen', name: 'Tamoxifen', doseMg: 20, unit: 'mg', route: 'oral', startWeek: 0, endWeek: 12 },
          ],
        },
      },
    }));
    const r = hydrateState();
    const pharma = (r as any).pharma;
    expect(pharma.hasGH).toBe(true);
    expect(pharma.hasInsulin).toBe(true);
    expect(pharma.hasCaber).toBe(true);
    expect(pharma.hasAI).toBe(true);
    expect(pharma.hasSERM).toBe(true);
    expect(pharma.ghIU).toBe(4);
    expect(pharma.insulinIU).toBe(10);
  });

  it('11. hydrateState (engine): doseMgWeek как alias для doseMg (legacy)', async () => {
    const { hydrateState } = await import('../../engines/support-plan/engine');
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: {
          phase: 'course',
          currentSubstances: [
            { id: 'test_enan', doseMgWeek: 500, weeks: 12 },
          ],
        },
      },
    }));
    const r = hydrateState();
    const pharma = (r as any).pharma;
    expect(pharma.aas).toHaveLength(1);
    expect(pharma.aas[0].doseMgWeek).toBe(500);
    expect(pharma.aas[0].weeks).toBe(12);
  });
});