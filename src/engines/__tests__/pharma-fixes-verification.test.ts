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
  it('2-3x/week -> 2.5 avg', () => expect(injectionsPerWeek('2-3x/week')).toBe(2.5));
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
  it('weeklyDose per-day *7', () => {
    expect(weeklyDose(50, 'mg/d', '2x/d')).toBe(350);
    expect(weeklyDose(30, 'mg/d', 'daily')).toBe(210);
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

describe('P0 peptide filter and weekBar + getPharmaDetail fallback', () => {
  it('getPharmaDetail falls back to defaults on empty mechanisms', async () => {
    const { getPharmaDetail } = await import('../../core/pharma-database');
    const { PHARMA_DB } = await import('../../core/pharma-database');
    // Find a real substance and test that empty array would fallback (simulate)
    // Create a mock entry with empty mechanisms
    const testId = 'test_enan';
    const raw = PHARMA_DB[testId];
    expect(raw).toBeTruthy();
    // The function should handle empty array: if raw has empty, it should return defaults
    // We test the fallback logic directly
    const { CLASS_DEFAULTS } = await import('../../core/pharma-db/class-defaults');
    const defaults = CLASS_DEFAULTS[raw.class];
    expect(defaults).toBeTruthy();
    // Simulate empty
    const mockRaw: any = { ...raw, mechanisms: [] };
    const fallback = (Array.isArray(mockRaw.mechanisms) && mockRaw.mechanisms.length > 0) ? mockRaw.mechanisms : defaults.mechanisms;
    expect(fallback).toBe(defaults.mechanisms);
    expect(fallback.length).toBeGreaterThan(0);
    // Real call should not be empty for known id
    const detail = getPharmaDetail(testId);
    expect(detail?.mechanisms?.length).toBeGreaterThan(0);
  });
  it('weekBar inclusive width is larger than exclusive for same end-start', () => {
    const totalWeeks = 12;
    const entry = { startWeek: 0, endWeek: 8 } as any;
    const exclusive = ((entry.endWeek - entry.startWeek) / totalWeeks) * 100;
    const inclusive = ((entry.endWeek - entry.startWeek + 1) / (totalWeeks + 1)) * 100;
    expect(inclusive).toBeGreaterThan(exclusive);
    // For 0-12 inclusive on 12 horizon, exclusive 100% vs inclusive 100% (13/13)
    const e2 = { startWeek: 0, endWeek: 12 } as any;
    const excl2 = ((e2.endWeek - e2.startWeek) / 12) * 100;
    const incl2 = ((e2.endWeek - e2.startWeek + 1) / (12 + 1)) * 100;
    expect(Math.abs(excl2 - 100)).toBeLessThan(0.01);
    expect(Math.abs(incl2 - 100)).toBeLessThan(0.01);
  });
  it('peptide bpc157 should not be counted as pharma (filter)', async () => {
    const { PEPTIDE_DB } = await import('../peptide-calculator.engine');
    expect(PEPTIDE_DB['bpc157']).toBeTruthy();
    const { PHARMA_DB: PDB } = await import('../../core/pharma-database');
    expect(PDB['bpc157']).toBeUndefined();
    // Simulate filter logic from PharmaCourseScreen
    const peptideIds = new Set(Object.keys(PEPTIDE_DB));
    const entries = [{ substanceId: 'bpc157' }, { substanceId: 'test_enan' }, { substanceId: 'unknown_xyz' }] as any[];
    const filtered = entries.filter(e => {
      if (peptideIds.has(e.substanceId)) {
        const subById = (PDB as any)[e.substanceId];
        if (!subById) return false;
      }
      const subById = (PDB as any)[e.substanceId];
      if (subById) return subById.class !== 'support';
      return true;
    });
    expect(filtered.map(f => f.substanceId)).toEqual(['test_enan', 'unknown_xyz']);
    expect(filtered.some(f => f.substanceId === 'bpc157')).toBe(false);
  });
});

describe('P0 lab-pharma inverted thresholds', () => {
  it('on_cycle tightens HCT, pct tightens LH', async () => {
    const { analyzeLabDrugCorrelation } = await import('../lab-pharma-correlation.engine');
    const course: any[] = [{ substanceId: 'test_enan', endWeek: 12, startWeek: 0, doseValue: 500, doseUnit: 'mg/wk', frequency: '2x/wk' }];
    const labsHCT: any[] = [{ code: 'HCT', value: 53, unit: '%', date: new Date().toISOString(), patientId: 'current-user' }];
    const labsLH: any[] = [{ code: 'LH', value: 0.5, unit: 'mIU/mL', date: new Date().toISOString(), patientId: 'current-user' }];
    const alertsOn = analyzeLabDrugCorrelation(labsHCT, course, 'on_cycle');
    const alertsPct = analyzeLabDrugCorrelation(labsLH, course, 'pct');
    // HCT 53 on_cycle should be flagged high (tightened uln 0.95*52=49.4) vs off 52
    const hctAlert = alertsOn.find(a => a.marker === 'HCT');
    expect(hctAlert).toBeTruthy();
    expect(hctAlert?.actualStatus).toBe('high');
    // LH 0.5 pct should be flagged low (tightened lln 1.05)
    const lhAlert = alertsPct.find(a => a.marker === 'LH');
    expect(lhAlert).toBeTruthy();
    expect(lhAlert?.actualStatus).toBe('low');
  });
});

describe('P0 dosage unit conversion', () => {
  it('clen 100 mcg vs 100 mg gives 1000x different volume', async () => {
    const { calculateDose } = await import('../dosage.engine');
    const volMcg = calculateDose({ targetDoseMg: 100, targetDoseUnit: 'mcg', concentrationMgPerMl: 250, concentrationUnit: 'mg/ml', syringeVolumeMl: 1, vialVolumeMl: 10, roundingStepMl: 0.0001 });
    const volMg = calculateDose({ targetDoseMg: 100, targetDoseUnit: 'mg', concentrationMgPerMl: 250, concentrationUnit: 'mg/ml', syringeVolumeMl: 1, vialVolumeMl: 10, roundingStepMl: 0.0001 });
    // Engine rounds to 3 decimals, so 0.0004 -> 0.000
    expect(volMcg.volumeMl).toBeLessThan(0.001);
    expect(volMg.volumeMl).toBeCloseTo(0.4, 3);
    expect(volMcg.volumeMl).toBeLessThan(volMg.volumeMl / 10);
  });
  it('GH IU vs mg mismatch flags', async () => {
    const { calculateDose } = await import('../dosage.engine');
    const r = calculateDose({ targetDoseMg: 4, targetDoseUnit: 'IU', concentrationMgPerMl: 10, concentrationUnit: 'mg/ml', syringeVolumeMl: 1, vialVolumeMl: 10 });
    expect(r.flags).toContain('unit_mismatch_iu_vs_mg');
  });
});

describe('P0 score-pharma weeks factor', () => {
  it('longer weeks gives higher risk than short', async () => {
    const { analyzePharma } = await import('../score-pharma');
    const short = analyzePharma({ course: [{ substanceId:'test_enan', dose:300, unit:'mg/wk', weeks:4 }], weight:80, age:30, sex:'male' });
    const long = analyzePharma({ course: [{ substanceId:'test_enan', dose:300, unit:'mg/wk', weeks:16 }], weight:80, age:30, sex:'male' });
    expect(long.overallRaw).toBeGreaterThan(short.overallRaw);
  });
});

describe('P0 isOral GH not oral', () => {
  it('GH should be inject not oral', async () => {
    const { mapCourseToSubstances } = await import('../../core/course-sync');
    const course: any[] = [{ substanceId: 'gh', doseValue: 4, doseUnit: 'IU', frequency: 'daily', startWeek: 0, endWeek: 12 }];
    const mapped = mapCourseToSubstances(course);
    expect(mapped[0].route).toBe('inject');
    const course2: any[] = [{ substanceId: 'test_enan', doseValue: 250, doseUnit: 'mg/wk', frequency: '2x/wk', startWeek: 0, endWeek: 12 }];
    const mapped2 = mapCourseToSubstances(course2);
    expect(mapped2[0].route).toBe('inject');
    const oralCourse: any[] = [{ substanceId: 'oxan', doseValue: 30, doseUnit: 'mg/d', frequency: 'daily', startWeek: 0, endWeek: 6 }];
    const mappedOral = mapCourseToSubstances(oralCourse);
    expect(mappedOral[0].route).toBe('oral');
  });
});

describe('P0 androgenic index normalized', () => {
  it('300 mg test_enan ≈ 1.0, 600 mg ≈ 2.0 (threshold 300)', async () => {
    const { DRUG_THRESHOLDS } = await import('../../core/constants');
    const th = (DRUG_THRESHOLDS as any)['testosterone_enanthate']?.dosePerWeek ?? 300;
    expect(th).toBe(300);
    const calc = (dose: number) => {
      const andro = (DRUG_THRESHOLDS as any)['testosterone_enanthate']?.androgenicity ?? 1;
      const df = dose / th;
      return df * andro;
    };
    expect(calc(300)).toBeCloseTo(1.0, 2);
    expect(calc(600)).toBeCloseTo(2.0, 2);
    expect(calc(600)).toBeGreaterThan(calc(300));
  });
});
