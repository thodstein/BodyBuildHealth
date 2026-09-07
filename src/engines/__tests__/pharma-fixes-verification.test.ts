import { describe, it, expect } from 'vitest';
import { PHARMA_CLASSES } from '../../ui/screens/PharmaScreen_parts/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { injectionsPerWeek, weeklyDose } from '../pharma-frequency';
import { validateCourse, calculateConcentration } from '../pharmacology.engine';
import { calculateMultiSubstancePKPD } from '../pkpd-superposition.engine';
import { mapCourseToSubstances, hasCourseDiff } from '../../core/course-sync';
import { syncCourseToProfile } from '../../core/data-link';
import { analyzePharma } from '../score-pharma';
import type { CourseEntry } from '../../core/types';

describe('P0-8 PHARMA_CLASSES includes missing families', () => {
  it('contains dht_inject, gh, glp1, clenbuterol, thyroid', () => {
    expect(PHARMA_CLASSES).toContain('dht_inject');
    expect(PHARMA_CLASSES).toContain('gh');
    expect(PHARMA_CLASSES).toContain('glp1');
    expect(PHARMA_CLASSES).toContain('clenbuterol');
    expect(PHARMA_CLASSES).toContain('thyroid');
  });
  it('DB entries for those classes exist and are now visible', () => {
    const dbClasses = new Set(Object.values(PHARMA_DB).map(s => s.class));
    expect(dbClasses.has('dht_inject')).toBe(true);
    // at least one substance of each should be filterable
    const filtered = Object.values(PHARMA_DB).filter(s => (PHARMA_CLASSES as readonly string[]).includes(s.class));
    const hasDht = filtered.some(s => s.class === 'dht_inject');
    expect(hasDht).toBe(true);
  });
});

describe('P0-1 frequency parsing', () => {
  it('eod -> 3.5', () => expect(injectionsPerWeek('eod')).toBe(3.5));
  it('daily -> 7', () => expect(injectionsPerWeek('daily')).toBe(7));
  it('2x/wk -> 2', () => expect(injectionsPerWeek('2x/wk')).toBe(2));
  it('1x/wk -> 1', () => expect(injectionsPerWeek('1x/wk')).toBe(1));
  it('3x/week -> 3', () => expect(injectionsPerWeek('3x/week')).toBe(3));
  it('number 2 -> 2', () => expect(injectionsPerWeek(2)).toBe(2));
  it('weeklyDose with /wk unit ignores frequency', () => {
    expect(weeklyDose(500, 'mg/wk', 'daily')).toBe(500);
    expect(weeklyDose(500, 'mg/wk', '2x/wk')).toBe(500);
  });
  it('weeklyDose per-injection multiplies', () => {
    // if unit is mg (per injection), weekly = perInj * perWeek
    expect(weeklyDose(250, 'mg', '2x/wk')).toBe(500);
    expect(weeklyDose(100, 'mg', 'daily')).toBe(700);
    expect(weeklyDose(50, 'mg', 'eod')).toBe(175);
  });
});

describe('P0-12 validateCourse does not crash on missing pd/doseUnit', () => {
  it('handles substance without pd', () => {
    const fake: CourseEntry = { id:'1', substanceId:'unknown_peptide_xyz', doseValue:100, doseUnit:'', frequency:'2x/wk', startWeek:0, endWeek:4 };
    expect(() => validateCourse([fake])).not.toThrow();
    const res = validateCourse([fake]);
    expect(res.warnings.some(w=>w.includes('Неизвестный'))).toBe(true);
  });
  it('handles missing doseUnit', () => {
    const c: CourseEntry = { id:'2', substanceId:'test_enan', doseValue:250, doseUnit: undefined as any, frequency:'2x/wk', startWeek:0, endWeek:12 };
    expect(() => validateCourse([c])).not.toThrow();
  });
  it('still warns for oral >8 weeks', () => {
    // find an oral with hepatotoxicity >=2, e.g., methand or anadrol
    const oralId = Object.keys(PHARMA_DB).find(id => (PHARMA_DB[id].pd?.hepatotoxicity ?? 0) >=2);
    if (oralId) {
      const c: CourseEntry = { id:'3', substanceId: oralId, doseValue:30, doseUnit:'mg/wk', frequency:'daily', startWeek:0, endWeek:12 };
      const res = validateCourse([c]);
      expect(res.warnings.some(w=> w.includes('гепатотоксич'))).toBe(true);
    }
  });
});

describe('P0-3 superposition respects startWeek and does not overdose', () => {
  it('single entry startWeek offset', () => {
    const course: CourseEntry[] = [
      { id:'a', substanceId:'test_enan', doseValue:250, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:4, endWeek:12 },
    ];
    const res = calculateMultiSubstancePKPD(course, 12);
    // week 0-3 should be near 0 (no injections before start)
    expect(res[0].cp).toBe(0);
    expect(res[3].cp).toBe(0);
    // week 5 should be >0
    expect(res[5].cp).toBeGreaterThan(0);
    // week 12 should have cp
    expect(res[12].cp).toBeGreaterThan(0);
  });
  it('two sequential entries same substance do not overdose (unique keys)', () => {
    // single 12-week course 250mg/wk should be similar to split 0-6 250 + 6-12 500?
    // Instead test that split course not 12x overdose vs single
    const single: CourseEntry[] = [
      { id:'s1', substanceId:'test_enan', doseValue:250, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:12 },
    ];
    const split: CourseEntry[] = [
      { id:'s2a', substanceId:'test_enan', doseValue:250, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:6 },
      { id:'s2b', substanceId:'test_enan', doseValue:250, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:6, endWeek:12 },
    ];
    const rSingle = calculateMultiSubstancePKPD(single, 12);
    const rSplit = calculateMultiSubstancePKPD(split, 12);
    // At week 3 (mid first half), both should be similar (since same dose)
    // Previous bug would give split 2x dose (since merged and summed). Now should be similar.
    expect(Math.abs(rSplit[3].cp - rSingle[3].cp)).toBeLessThan(rSingle[3].cp * 0.3); // within 30%
    // At week 9, both still similar
    expect(Math.abs(rSplit[9].cp - rSingle[9].cp)).toBeLessThan(rSingle[9].cp * 0.3);
  });
  it('eod and daily frequencies give correct per-injection dose', () => {
    const daily: CourseEntry[] = [{ id:'d', substanceId:'test_prop', doseValue:700, doseUnit:'mg/wk', frequency:'daily', startWeek:0, endWeek:4 }];
    const twice: CourseEntry[] = [{ id:'t', substanceId:'test_prop', doseValue:700, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:4 }];
    // Both have same weekly dose 700, so avg cp over time should be similar (since total weekly same)
    const rDaily = calculateMultiSubstancePKPD(daily, 4);
    const rTwice = calculateMultiSubstancePKPD(twice, 4);
    // Daily should be slightly more stable but similar avg
    const avgDaily = rDaily.reduce((s,w)=>s+w.cp,0)/rDaily.length;
    const avgTwice = rTwice.reduce((s,w)=>s+w.cp,0)/rTwice.length;
    expect(avgDaily).toBeGreaterThan(0);
    expect(Math.abs(avgDaily - avgTwice) / avgTwice).toBeLessThan(0.5); // within 50% (since PK model diff)
  });
});

describe('P0-A calculateConcentration respects frequency', () => {
  it('2x/wk vs daily same weekly dose gives similar effect', () => {
    const daily: CourseEntry[] = [{ id:'d1', substanceId:'test_enan', doseValue:100, doseUnit:'mg', frequency:'daily', startWeek:0, endWeek:4 }];
    const twice: CourseEntry[] = [{ id:'t1', substanceId:'test_enan', doseValue:350, doseUnit:'mg', frequency:'2x/wk', startWeek:0, endWeek:4 }];
    // daily 100*7=700 weekly, twice 350*2=700 weekly => same weekly
    const rDaily = calculateConcentration(daily, 4);
    const rTwice = calculateConcentration(twice, 4);
    expect(rDaily[4].cp).toBeGreaterThan(0);
    expect(Math.abs(rDaily[4].cp - rTwice[4].cp) / rTwice[4].cp).toBeLessThan(0.4);
  });
});

describe('P0-C/D hasCourseDiff and mapCourseToSubstances', () => {
  it('detects dose change', () => {
    const course: CourseEntry[] = [{ id:'1', substanceId:'test_enan', doseValue:300, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:12 }];
    const cur = mapCourseToSubstances(course);
    const changed: CourseEntry[] = [{ id:'1', substanceId:'test_enan', doseValue:500, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:12 }];
    expect(hasCourseDiff(changed, cur)).toBe(true);
  });
  it('detects weeks change', () => {
    const course: CourseEntry[] = [{ id:'1', substanceId:'test_enan', doseValue:300, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:12 }];
    const cur = mapCourseToSubstances(course);
    const changed: CourseEntry[] = [{ id:'1', substanceId:'test_enan', doseValue:300, doseUnit:'mg/wk', frequency:'2x/wk', startWeek:0, endWeek:8 }];
    expect(hasCourseDiff(changed, cur)).toBe(true);
  });
  it('mapCourseToSubstances uses weeklyDose for mcg', () => {
    const course: CourseEntry[] = [{ id:'1', substanceId:'t3', doseValue:25, doseUnit:'mcg', frequency:'daily', startWeek:0, endWeek:4 }];
    const mapped = mapCourseToSubstances(course);
    // 25 mcg daily => 175 weekly
    expect(mapped[0].doseMg).toBe(175);
  });
});

describe('P0-F score-pharma dose scaling', () => {
  it('higher dose gives higher risk', () => {
    const low = analyzePharma({ course: [{ substanceId:'test_enan', dose:100, unit:'mg/wk', weeks:12 }], weight:80, age:30, sex:'male' });
    const high = analyzePharma({ course: [{ substanceId:'test_enan', dose:1000, unit:'mg/wk', weeks:12 }], weight:80, age:30, sex:'male' });
    expect(high.overallRaw).toBeGreaterThan(low.overallRaw);
  });
});
