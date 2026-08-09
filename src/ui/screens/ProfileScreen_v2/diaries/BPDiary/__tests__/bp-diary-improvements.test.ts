import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calcMAP, calcPulsePressure, calcBPLoad, calcVariability, classifyBP, getBpClassificationLabel, getBpClassificationColor, checkOrthostatic, getCircadianPattern, compareMedsVsNoMeds, calculateGoalAchievement, getDefaultGoals } from '../../../../../../core/bp-hr-data';
import { BPEntry } from '../../../../../../core/bp-hr-data';

describe('BP Diary Improvements', () => {
  const KEY = 'he_bp_diary';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Data layer integration', () => {
    it('should compute MAP correctly', () => {
      expect(calcMAP(120, 80)).toBe(93); // (120 + 2*80)/3 = 93.33 → 93
      expect(calcMAP(140, 90)).toBe(107); // (140 + 2*90)/3 = 106.67 → 107
    });

    it('should compute pulse pressure correctly', () => {
      expect(calcPulsePressure(120, 80)).toBe(40);
      expect(calcPulsePressure(140, 90)).toBe(50);
    });

    it('should compute BP Load', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 135, diastolic: 85, hr: 70 },
        { date: '2024-01-02', systolic: 125, diastolic: 75, hr: 72 },
        { date: '2024-01-03', systolic: 145, diastolic: 95, hr: 68 },
      ];
      // 2 out of 3 above 130/80 → 66.67%
      expect(calcBPLoad(entries)).toBe(67);
    });

    it('should compute variability', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 130, diastolic: 85, hr: 72 },
        { date: '2024-01-03', systolic: 125, diastolic: 82, hr: 71 },
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
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, position: 'sitting' },
        { date: '2024-01-01', systolic: 95, diastolic: 70, hr: 70, position: 'standing' },
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(true);
      expect(result.dropS).toBe(25); // 120 - 95
    });

    it('should not detect when no standing measurement', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, position: 'sitting' },
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(false);
    });
  });

  describe('Circadian pattern', () => {
    it('should detect non-dipper pattern', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 140, diastolic: 90, hr: 70, timeOfDay: 'morning' },
        { date: '2024-01-01', systolic: 135, diastolic: 88, hr: 68, timeOfDay: 'night' },
      ];
      const pattern = getCircadianPattern(entries);
      // morning 140, night 135 → drop (140-135)/140 = 3.6% < 10% → non-dipper
      expect(pattern.isNonDipper).toBe(true);
    });
  });

  describe('Meds comparison', () => {
    it('should compare on-meds vs off-meds', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 130, diastolic: 85, hr: 70, medicationTaken: true },
        { date: '2024-01-02', systolic: 145, diastolic: 95, hr: 72, medicationTaken: false },
        { date: '2024-01-03', systolic: 128, diastolic: 82, hr: 69, medicationTaken: true },
      ];
      const result = compareMedsVsNoMeds(entries);
      expect(result.onMeds.count).toBe(2);
      expect(result.offMeds.count).toBe(1);
    });
  });

  describe('Goal achievement', () => {
    it('should calculate goal achievement', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 125, diastolic: 78, hr: 70 },
        { date: '2024-01-02', systolic: 135, diastolic: 85, hr: 72 },
        { date: '2024-01-03', systolic: 118, diastolic: 76, hr: 68 },
      ];
      const goals = { systolicTarget: 130, diastolicTarget: 80, hrTarget: 72 };
      const result = calculateGoalAchievement(entries, goals);
      expect(result.totalReadings).toBe(3);
      expect(result.systolicAchieved).toBe(67); // 2 out of 3 ≤ 130
    });
  });

  describe('Default goals', () => {
    it('should return correct default goals', () => {
      const goals = getDefaultGoals('normal');
      expect(goals.systolicTarget).toBe(120);
      expect(goals.diastolicTarget).toBe(80);

      const goals2 = getDefaultGoals('stage1');
      expect(goals2.systolicTarget).toBe(130);
    });
  });

  // LocalStorage integration tests are covered by existing bp-hr-data.test.ts
  // The BPDiary component has its own integration tested via component tests
});
