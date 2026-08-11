import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calcMAP, calcPulsePressure, calcBPLoad, calcVariability,
  classifyBP, getBpClassificationLabel, getBpClassificationColor,
  checkOrthostatic, getCircadianPattern, compareMedsVsNoMeds,
  calculateGoalAchievement, getDefaultGoals,
  generateEntryId, sortEntriesByTimestamp, validateBpEntry,
  normalizeBpEntry, getBpEntries, commitBpEntries, BP_SYMPTOMS,
} from '../../../../../../core/bp-hr-data';
import { BPEntry } from '../../../../../../core/bp-hr-data';

function makeEntry(overrides: Partial<BPEntry> = {}): BPEntry {
  return {
    id: generateEntryId(),
    date: '2024-01-01',
    timestamp: new Date('2024-01-01').getTime(),
    systolic: 120, diastolic: 80, hr: 70,
    ...overrides,
  };
}

describe('BP Diary Improvements', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  describe('Data layer integration', () => {
    it('should compute MAP correctly', () => {
      expect(calcMAP(120, 80)).toBe(93);
      expect(calcMAP(140, 90)).toBe(107);
    });

    it('should compute pulse pressure correctly', () => {
      expect(calcPulsePressure(120, 80)).toBe(40);
      expect(calcPulsePressure(140, 90)).toBe(50);
    });

    it('should compute BP Load', () => {
      const entries: BPEntry[] = [
        makeEntry({ date: '2024-01-01', systolic: 135, diastolic: 85, hr: 70 }),
        makeEntry({ date: '2024-01-02', systolic: 125, diastolic: 75, hr: 72 }),
        makeEntry({ date: '2024-01-03', systolic: 145, diastolic: 95, hr: 68 }),
      ];
      expect(calcBPLoad(entries)).toBe(67);
    });

    it('should compute variability', () => {
      const entries: BPEntry[] = [
        makeEntry({ systolic: 120, diastolic: 80 }),
        makeEntry({ systolic: 130, diastolic: 85 }),
        makeEntry({ systolic: 125, diastolic: 82 }),
      ];
      const v = calcVariability(entries);
      expect(v.sysSD).toBeGreaterThan(0);
      expect(v.diaSD).toBeGreaterThan(0);
    });
  });

  describe('Classification and colors', () => {
    it('should classify BP correctly', () => {
      expect(classifyBP(115, 75)).toBe('normal');
      expect(classifyBP(125, 78)).toBe('elevated');
      expect(classifyBP(135, 85)).toBe('stage1');
      expect(classifyBP(145, 95)).toBe('stage2');
      expect(classifyBP(185, 125)).toBe('crisis');
    });

    it('should return correct label and color', () => {
      expect(getBpClassificationLabel('normal')).toBe('Норма');
      expect(getBpClassificationLabel('crisis')).toBe('Кризис');
      expect(getBpClassificationColor('normal')).toBe('#4caf50');
      expect(getBpClassificationColor('crisis')).toBe('#b91c1c');
    });
  });

  describe('Orthostatic test', () => {
    it('should detect orthostatic hypotension', () => {
      const entries: BPEntry[] = [
        makeEntry({ systolic: 120, diastolic: 80, position: 'sitting' }),
        makeEntry({ systolic: 95, diastolic: 70, position: 'standing' }),
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(true);
      expect(result.dropS).toBe(25);
    });

    it('should not detect when no standing measurement', () => {
      const entries: BPEntry[] = [makeEntry({ position: 'sitting' })];
      expect(checkOrthostatic(entries).detected).toBe(false);
    });
  });

  describe('Circadian pattern', () => {
    it('should detect non-dipper pattern', () => {
      const entries: BPEntry[] = [
        makeEntry({ systolic: 140, diastolic: 90, timeOfDay: 'morning' }),
        makeEntry({ systolic: 135, diastolic: 88, timeOfDay: 'night' }),
      ];
      expect(getCircadianPattern(entries).isNonDipper).toBe(true);
    });
  });

  describe('Meds comparison', () => {
    it('should compare on-meds vs off-meds', () => {
      const entries: BPEntry[] = [
        makeEntry({ date: '2024-01-01', systolic: 130, diastolic: 85, medicationTaken: true }),
        makeEntry({ date: '2024-01-02', systolic: 145, diastolic: 95, medicationTaken: false }),
        makeEntry({ date: '2024-01-03', systolic: 128, diastolic: 82, medicationTaken: true }),
      ];
      const result = compareMedsVsNoMeds(entries);
      expect(result.onMeds.count).toBe(2);
      expect(result.offMeds.count).toBe(1);
    });
  });

  describe('Goal achievement', () => {
    it('should calculate goal achievement', () => {
      const entries: BPEntry[] = [
        makeEntry({ date: '2024-01-01', systolic: 125, diastolic: 78, hr: 70 }),
        makeEntry({ date: '2024-01-02', systolic: 135, diastolic: 85, hr: 72 }),
        makeEntry({ date: '2024-01-03', systolic: 118, diastolic: 76, hr: 68 }),
      ];
      const goals = { systolicTarget: 130, diastolicTarget: 80, hrTarget: 72 };
      const result = calculateGoalAchievement(entries, goals);
      expect(result.totalReadings).toBe(3);
      expect(result.systolicAchieved).toBe(67);
    });
  });

  describe('Default goals', () => {
    it('should return correct default goals', () => {
      expect(getDefaultGoals('normal').systolicTarget).toBe(120);
      expect(getDefaultGoals('normal').diastolicTarget).toBe(80);
      expect(getDefaultGoals('stage1').systolicTarget).toBe(130);
    });
  });

  describe('generateEntryId', () => {
    it('should generate unique ids', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^bp_\d+_[a-z0-9]+$/);
    });
  });

  describe('sortEntriesByTimestamp', () => {
    it('should sort by timestamp descending', () => {
      const entries = [
        makeEntry({ id: 'a', timestamp: 1000, date: '2024-01-01' }),
        makeEntry({ id: 'b', timestamp: 3000, date: '2024-01-03' }),
        makeEntry({ id: 'c', timestamp: 2000, date: '2024-01-02' }),
      ];
      const sorted = sortEntriesByTimestamp(entries);
      expect(sorted.map(e => e.id)).toEqual(['b', 'c', 'a']);
    });

    it('should fallback to date string when timestamps equal', () => {
      const entries = [
        makeEntry({ id: 'a', timestamp: 1000, date: '2024-01-03' }),
        makeEntry({ id: 'b', timestamp: 1000, date: '2024-01-01' }),
      ];
      const sorted = sortEntriesByTimestamp(entries);
      expect(sorted[0].id).toBe('a');
    });
  });

  describe('validateBpEntry', () => {
    it('should return no errors for valid entry', () => {
      expect(validateBpEntry(120, 80, 70, '2024-01-01')).toEqual([]);
    });

    it('should flag systolic out of range', () => {
      const errors = validateBpEntry(30, 80, 70, '2024-01-01');
      expect(errors.some(e => e.field === 'systolic')).toBe(true);
    });

    it('should flag diastolic >= systolic', () => {
      const errors = validateBpEntry(120, 130, 70, '2024-01-01');
      expect(errors.some(e => e.field === 'diastolic')).toBe(true);
    });

    it('should flag empty date', () => {
      const errors = validateBpEntry(120, 80, 70, '');
      expect(errors.some(e => e.field === 'date')).toBe(true);
    });

    it('should flag pulse out of range', () => {
      const errors = validateBpEntry(120, 80, 300, '2024-01-01');
      expect(errors.some(e => e.field === 'pulse')).toBe(true);
    });

    it('should flag NaN values', () => {
      const errors = validateBpEntry(NaN, 80, 70, '2024-01-01');
      expect(errors.some(e => e.field === 'systolic')).toBe(true);
    });
  });

  describe('normalizeBpEntry', () => {
    it('should add id and timestamp if missing', () => {
      const raw = { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 };
      const entry = normalizeBpEntry(raw);
      expect(entry.id).toMatch(/^bp_/);
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('should preserve existing id and timestamp', () => {
      const raw = { id: 'custom-id', date: '2024-01-01', timestamp: 999, systolic: 120, diastolic: 80, hr: 70 };
      const entry = normalizeBpEntry(raw);
      expect(entry.id).toBe('custom-id');
      expect(entry.timestamp).toBe(999);
    });

    it('should handle pulse alias', () => {
      const raw = { date: '2024-01-01', systolic: 120, diastolic: 80, pulse: 75 } as any;
      expect(normalizeBpEntry(raw).hr).toBe(75);
    });

    it('should preserve context fields from quick-add modal (arm, position, symptoms, medicationTaken)', () => {
      const raw = {
        date: '2024-01-01',
        systolic: 125,
        diastolic: 82,
        hr: 68,
        timeOfDay: 'night' as const,
        arm: 'right' as const,
        position: 'standing' as const,
        symptoms: ['Головная боль', 'Головокружение'],
        medicationTaken: true,
      };
      const entry = normalizeBpEntry(raw);
      expect(entry.arm).toBe('right');
      expect(entry.position).toBe('standing');
      expect(entry.symptoms).toEqual(['Головная боль', 'Головокружение']);
      expect(entry.medicationTaken).toBe(true);
      expect(entry.timeOfDay).toBe('night');
    });

    it('should not inherit medicationTaken when modal sends medicationTaken:false', () => {
      const raw = { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, medicationTaken: false };
      expect(normalizeBpEntry(raw).medicationTaken).toBe(false);
    });
  });

  describe('commitBpEntries', () => {
    it('should persist and sort entries', () => {
      const entries = [
        makeEntry({ id: 'b', timestamp: 3000 }),
        makeEntry({ id: 'a', timestamp: 1000 }),
      ];
      const result = commitBpEntries(entries);
      expect(result[0].id).toBe('b');
      expect(getBpEntries()[0].id).toBe('b');
    });

    it('should cap at 1000 entries', () => {
      const entries = Array.from({ length: 1005 }, (_, i) =>
        makeEntry({ id: `e${i}`, timestamp: i * 1000, date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}` })
      );
      commitBpEntries(entries);
      expect(getBpEntries().length).toBe(1000);
    });
  });

  describe('Multiple measurements per day', () => {
    it('should support two entries on same date with different timestamps', () => {
      const morning = makeEntry({ date: '2024-01-01', timestamp: 1704110400000, timeOfDay: 'morning', systolic: 120, diastolic: 80 });
      const evening = makeEntry({ date: '2024-01-01', timestamp: 1704142800000, timeOfDay: 'evening', systolic: 130, diastolic: 85 });
      commitBpEntries([evening, morning]);
      const stored = getBpEntries();
      expect(stored.length).toBe(2);
      expect(stored[0].timeOfDay).toBe('evening');
      expect(stored[1].timeOfDay).toBe('morning');
    });
  });

  describe('BP_SYMPTOMS', () => {
    it('should have predefined symptoms', () => {
      expect(BP_SYMPTOMS.length).toBeGreaterThan(5);
      expect(BP_SYMPTOMS).toContain('Головная боль');
      expect(BP_SYMPTOMS).toContain('Головокружение');
    });
  });
});
