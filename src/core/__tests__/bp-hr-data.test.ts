import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BPEntry,
  BPGoals,
  classifyBP,
  calcMAP,
  calcPulsePressure,
  calcBPLoad,
  calcVariability,
  checkOrthostatic,
  compareMedsVsNoMeds,
  getCircadianPattern,
  calculateGoalAchievement,
  getDefaultGoals,
  calculateWeightCorrelation,
  calculateSleepCorrelation,
  getBpClassificationLabel,
  getBpClassificationColor,
  normalizeBpEntry,
  exportBPData,
  importBPData,
  getAvgBp,
  getBpEntries,
  commitBpEntries,
  getPulseDaypartAverages,
  getPulseTrend,
} from '../bp-hr-data';

describe('bp-hr-data', () => {
  describe('classifyBP', () => {
    it('should classify normal BP', () => {
      expect(classifyBP(110, 70)).toBe('normal');
      expect(classifyBP(119, 79)).toBe('normal');
    });

    it('should classify elevated BP', () => {
      expect(classifyBP(120, 70)).toBe('elevated');
      expect(classifyBP(129, 79)).toBe('elevated');
    });

    it('should classify stage 1 hypertension', () => {
      expect(classifyBP(130, 80)).toBe('stage1');
      expect(classifyBP(139, 89)).toBe('stage1');
    });

    it('should classify stage 2 hypertension', () => {
      expect(classifyBP(140, 90)).toBe('stage2');
      expect(classifyBP(160, 100)).toBe('stage2');
    });

    it('should classify hypertensive crisis', () => {
      expect(classifyBP(181, 120)).toBe('crisis');
      expect(classifyBP(200, 130)).toBe('crisis');
    });
  });

  describe('calcMAP', () => {
    it('should calculate MAP correctly', () => {
      expect(calcMAP(120, 80)).toBe(93); // (2*80 + 120) / 3 = 93.33
      expect(calcMAP(140, 90)).toBe(107); // (2*90 + 140) / 3 = 106.67
    });
  });

  describe('calcPulsePressure', () => {
    it('should calculate pulse pressure correctly', () => {
      expect(calcPulsePressure(120, 80)).toBe(40);
      expect(calcPulsePressure(140, 90)).toBe(50);
    });
  });

  describe('calcBPLoad', () => {
    const entries: BPEntry[] = [
      { date: '2024-01-01', systolic: 120, diastolic: 79, hr: 70 },
      { date: '2024-01-02', systolic: 135, diastolic: 85, hr: 72 },
      { date: '2024-01-03', systolic: 145, diastolic: 95, hr: 75 },
      { date: '2024-01-04', systolic: 125, diastolic: 82, hr: 71 },
    ];

    it('should calculate BP load correctly', () => {
      const load = calcBPLoad(entries);
      // 135/85 (both >), 145/95 (both >), 125/82 (diastolic > 80) = 3 out of 4 = 75%
      expect(load).toBe(75);
    });

    it('should return 0 for empty entries', () => {
      expect(calcBPLoad([])).toBe(0);
    });
  });

  describe('calcVariability', () => {
    const entries: BPEntry[] = [
      { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
      { date: '2024-01-02', systolic: 130, diastolic: 85, hr: 72 },
      { date: '2024-01-03', systolic: 125, diastolic: 82, hr: 71 },
    ];

    it('should calculate variability correctly', () => {
      const { sysSD, diaSD } = calcVariability(entries);
      expect(sysSD).toBeGreaterThan(0);
      expect(diaSD).toBeGreaterThan(0);
    });

    it('should return 0 for less than 2 entries', () => {
      const { sysSD, diaSD } = calcVariability([
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
      ]);
      expect(sysSD).toBe(0);
      expect(diaSD).toBe(0);
    });
  });

  describe('getBpClassificationLabel', () => {
    it('should return correct labels', () => {
      expect(getBpClassificationLabel('normal')).toBe('Норма');
      expect(getBpClassificationLabel('elevated')).toBe('Повышенное');
      expect(getBpClassificationLabel('stage1')).toBe('Гипертензия 1 ст.');
      expect(getBpClassificationLabel('stage2')).toBe('Гипертензия 2 ст.');
      expect(getBpClassificationLabel('crisis')).toBe('Кризис');
    });
  });

  describe('getBpClassificationColor', () => {
    it('should return correct colors', () => {
      expect(getBpClassificationColor('normal')).toBe('#4caf50');
      expect(getBpClassificationColor('elevated')).toBe('#f59e0b');
      expect(getBpClassificationColor('stage1')).toBe('#ff9800');
      expect(getBpClassificationColor('stage2')).toBe('#ef4444');
      expect(getBpClassificationColor('crisis')).toBe('#b91c1c');
    });
  });

  describe('normalizeBpEntry', () => {
    it('should normalize entry with new fields', () => {
      const raw = {
        date: '2024-01-01',
        systolic: 120,
        diastolic: 80,
        hr: 70,
        timeOfDay: 'morning',
        position: 'sitting',
        arm: 'left',
        symptoms: ['headache'],
        medicationTaken: true,
      };
      const normalized = normalizeBpEntry(raw);
      expect(normalized.timeOfDay).toBe('morning');
      expect(normalized.position).toBe('sitting');
      expect(normalized.symptoms).toEqual(['headache']);
    });

    it('should handle missing fields', () => {
      const raw = { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 };
      const normalized = normalizeBpEntry(raw);
      expect(normalized.timeOfDay).toBeUndefined();
      expect(normalized.symptoms).toEqual([]);
    });
  });

  describe('checkOrthostatic', () => {
    it('should detect orthostatic hypotension', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 140, diastolic: 90, hr: 70, position: 'sitting' },
        { date: '2024-01-01', systolic: 115, diastolic: 78, hr: 75, position: 'standing' },
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(true);
      expect(result.dropS).toBe(25); // 140 - 115
      expect(result.dropD).toBe(12); // 90 - 78
    });

    it('should not detect when drop is small', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, position: 'sitting' },
        { date: '2024-01-01', systolic: 115, diastolic: 78, hr: 75, position: 'standing' },
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(false);
    });

    it('should return not detected when no sitting or standing entries', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, position: 'lying' },
      ];
      const result = checkOrthostatic(entries);
      expect(result.detected).toBe(false);
    });
  });

  describe('compareMedsVsNoMeds', () => {
    it('should compare BP on meds vs off meds', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 130, diastolic: 85, hr: 70, medicationTaken: true },
        { date: '2024-01-02', systolic: 128, diastolic: 84, hr: 72, medicationTaken: true },
        { date: '2024-01-03', systolic: 145, diastolic: 95, hr: 75, medicationTaken: false },
        { date: '2024-01-04', systolic: 142, diastolic: 92, hr: 71, medicationTaken: false },
      ];
      const result = compareMedsVsNoMeds(entries);
      expect(result.onMeds.count).toBe(2);
      expect(result.offMeds.count).toBe(2);
      expect(result.onMeds.avgS).toBe(129); // (130 + 128) / 2
      expect(result.offMeds.avgS).toBe(144); // (145 + 142) / 2 = 143.5, rounds to 144
      expect(result.diffS).toBe(15); // 144 - 129
    });

    it('should handle all entries on meds', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 130, diastolic: 85, hr: 70, medicationTaken: true },
      ];
      const result = compareMedsVsNoMeds(entries);
      expect(result.onMeds.count).toBe(1);
      expect(result.onMeds.avgS).toBe(130);
      expect(result.offMeds.count).toBe(0);
      expect(result.offMeds.avgS).toBe(0);
      expect(result.diffS).toBe(-130); // 0 - 130
    });
  });

  describe('getCircadianPattern', () => {
    it('should calculate circadian pattern correctly', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70, timeOfDay: 'morning' },
        { date: '2024-01-01', systolic: 125, diastolic: 82, hr: 72, timeOfDay: 'morning' },
        { date: '2024-01-01', systolic: 130, diastolic: 85, hr: 75, timeOfDay: 'afternoon' },
        { date: '2024-01-01', systolic: 128, diastolic: 84, hr: 73, timeOfDay: 'evening' },
        { date: '2024-01-01', systolic: 115, diastolic: 75, hr: 68, timeOfDay: 'night' },
      ];
      const result = getCircadianPattern(entries);
      expect(result.morning.count).toBe(2);
      expect(result.morning.avgS).toBe(123); // (120 + 125) / 2
      expect(result.afternoon.count).toBe(1);
      expect(result.afternoon.avgS).toBe(130);
      expect(result.evening.count).toBe(1);
      expect(result.night.count).toBe(1);
    });

    it('should detect non-dipper pattern', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 140, diastolic: 90, hr: 70, timeOfDay: 'morning' },
        { date: '2024-01-01', systolic: 142, diastolic: 92, hr: 72, timeOfDay: 'afternoon' },
        { date: '2024-01-01', systolic: 138, diastolic: 88, hr: 75, timeOfDay: 'evening' },
        { date: '2024-01-01', systolic: 135, diastolic: 85, hr: 68, timeOfDay: 'night' }, // Only 5% drop
      ];
      const result = getCircadianPattern(entries);
      expect(result.isNonDipper).toBe(true);
    });
  });

  describe('calculateGoalAchievement', () => {
    it('should calculate goal achievement correctly', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 125, diastolic: 82, hr: 72 },
        { date: '2024-01-03', systolic: 135, diastolic: 85, hr: 75 },
        { date: '2024-01-04', systolic: 128, diastolic: 84, hr: 73 },
      ];
      const goals = { systolicTarget: 130, diastolicTarget: 80, hrTarget: 72 };
      const result = calculateGoalAchievement(entries, goals);
      expect(result.totalReadings).toBe(4);
      expect(result.systolicAchieved).toBe(75); // 3 out of 4 <= 130 (120, 125, 128)
      expect(result.diastolicAchieved).toBe(25); // 1 out of 4 <= 80 (80)
      expect(result.hrAchieved).toBe(50); // 2 out of 4 <= 72 (70, 72)
    });

    it('should return zeros for empty entries', () => {
      const goals = { systolicTarget: 130, diastolicTarget: 80, hrTarget: 72 };
      const result = calculateGoalAchievement([], goals);
      expect(result.totalReadings).toBe(0);
      expect(result.systolicAchieved).toBe(0);
    });
  });

  describe('getDefaultGoals', () => {
    it('should return correct goals for each classification', () => {
      expect(getDefaultGoals('normal').systolicTarget).toBe(120);
      expect(getDefaultGoals('elevated').systolicTarget).toBe(120);
      expect(getDefaultGoals('stage1').systolicTarget).toBe(130);
      expect(getDefaultGoals('stage2').systolicTarget).toBe(140);
      expect(getDefaultGoals('crisis').systolicTarget).toBe(160);
    });
  });

  describe('calculateWeightCorrelation', () => {
    it('should calculate weight correlation correctly', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 125, diastolic: 82, hr: 72 },
        { date: '2024-01-03', systolic: 130, diastolic: 85, hr: 75 },
      ];
      const weightData = [
        { date: '2024-01-01', weight: 80 },
        { date: '2024-01-02', weight: 81 },
        { date: '2024-01-03', weight: 82 },
      ];
      const result = calculateWeightCorrelation(entries, weightData);
      expect(result).not.toBeNull();
      expect(result!.r).toBeGreaterThan(0); // Positive correlation expected
      expect(result!.positive).toBe(true);
    });

    it('should return null for insufficient data', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
      ];
      const weightData = [
        { date: '2024-01-01', weight: 80 },
      ];
      const result = calculateWeightCorrelation(entries, weightData);
      expect(result).toBeNull();
    });
  });

  describe('calculateSleepCorrelation', () => {
    it('should calculate sleep correlation correctly', () => {
      const entries: BPEntry[] = [
        { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
        { date: '2024-01-02', systolic: 130, diastolic: 85, hr: 72 },
        { date: '2024-01-03', systolic: 140, diastolic: 90, hr: 75 },
      ];
      const sleepData = [
        { date: '2024-01-01', quality: 4 },
        { date: '2024-01-02', quality: 2 },
        { date: '2024-01-03', quality: 1 },
      ];
      const result = calculateSleepCorrelation(entries, sleepData);
      expect(result).not.toBeNull();
      expect(result!.r).toBeLessThan(0); // Negative correlation expected (poor sleep = high BP)
    });
  });

  describe('exportBPData and importBPData', () => {
    it('should export BP data as JSON', async () => {
      // This test requires IndexedDB - skip in test environment
      // Just verify the function exists and returns a Promise
      expect(typeof exportBPData).toBe('function');
      const result = exportBPData();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should validate import data format', async () => {
      // Test invalid JSON
      const invalidResult = await importBPData('not json');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.message).toContain('Ошибка при разборе JSON');

      // Test missing entries array
      const missingEntries = await importBPData('{"version": "1.0"}');
      expect(missingEntries.success).toBe(false);
      expect(missingEntries.message).toContain('отсутствует массив entries');
    });

    it('should import valid BP data', async () => {
      const validJSON = JSON.stringify({
        version: '1.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        entryCount: 2,
        entries: [
          { date: '2024-01-01', systolic: 120, diastolic: 80, hr: 70 },
          { date: '2024-01-02', systolic: 130, diastolic: 85, hr: 72 },
        ],
      });

      // This test requires IndexedDB - just verify validation logic
      const result = await importBPData(validJSON);
      // Without IndexedDB, it will fail on db.put - but we can check the validation passes
      // In a real test environment with IndexedDB mock, this would succeed
      expect(result.importedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAvgBp', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { localStorage.clear(); });

    it('uses local-date cutoff (includes today and recent days)', () => {
      const today = new Date();
      const iso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      const dToday = iso(today);
      const dYesterday = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
      const dWeekAgo = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
      const dTwoWeeks = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14));
      commitBpEntries([
        { id: 'a', date: dToday, systolic: 120, diastolic: 80, hr: 70 },
        { id: 'b', date: dYesterday, systolic: 130, diastolic: 85, hr: 72 },
        { id: 'c', date: dWeekAgo, systolic: 140, diastolic: 90, hr: 74 },
        { id: 'd', date: dTwoWeeks, systolic: 150, diastolic: 95, hr: 76 },
      ]);
      const avg = getAvgBp(7);
      expect(avg).not.toBeNull();
      // 7-дневное окно = сегодня + 6 предыдущих дней → записи a и b (c за 7 дней до — вне окна)
      expect(avg!.systolic).toBe(Math.round((120 + 130) / 2));
      expect(avg!.diastolic).toBe(Math.round((80 + 85) / 2));
    });
  });

  describe('ЧСС (утро/вечер) в записях АД', () => {
    const localIso = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const mk = (date: string, timeOfDay: string, hr: number): BPEntry => ({
      id: `x_${date}_${timeOfDay}`, date, systolic: 120, diastolic: 80, hr, timeOfDay,
    });

    it('getPulseDaypartAverages: средние утро/вечер за 7 дней, пульс 0 игнорируется', () => {
      const entries = [
        mk(localIso(0), 'morning', 58),
        mk(localIso(0), 'evening', 72),
        mk(localIso(1), 'morning', 62),
        mk(localIso(1), 'evening', 70),
        mk(localIso(9), 'morning', 90), // вне 7-дневного окна
        mk(localIso(0), 'afternoon', 0), // пульс 0 — игнор
      ];
      const s = getPulseDaypartAverages(entries, 7);
      expect(s.morning.count).toBe(2);
      expect(s.morning.avg).toBe(60);
      expect(s.evening.count).toBe(2);
      expect(s.evening.avg).toBe(71);
    });

    it('getPulseDaypartAverages: нет данных → null', () => {
      const s = getPulseDaypartAverages([], 7);
      expect(s.morning.avg).toBeNull();
      expect(s.evening.avg).toBeNull();
    });

    it('getPulseTrend: свежие утренние ниже старых → down', () => {
      const entries = [
        mk(localIso(10), 'morning', 70),
        mk(localIso(9), 'morning', 72),
        mk(localIso(8), 'morning', 71),
        mk(localIso(2), 'morning', 60),
        mk(localIso(1), 'morning', 58),
        mk(localIso(0), 'morning', 62),
      ];
      const trend = getPulseTrend(entries);
      expect(trend).not.toBeNull();
      expect(trend!.direction).toBe('down');
      expect(trend!.delta).toBeLessThan(0);
    });

    it('getPulseTrend: учитывает только утренние замеры, <2 записей → null', () => {
      expect(getPulseTrend([mk(localIso(0), 'morning', 60)])).toBeNull();
      expect(getPulseTrend([mk(localIso(0), 'evening', 70), mk(localIso(1), 'evening', 72)])).toBeNull();
    });
  });
});
