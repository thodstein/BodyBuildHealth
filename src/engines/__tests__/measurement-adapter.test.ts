/**
 * measurement-adapter.test.ts — тесты адаптера замеров тренировочного блока
 * (log-analytics-progression.engine.ts): loadMeasurements/saveMeasurement/analyzeMeasurements.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMeasurements,
  saveMeasurement,
  analyzeMeasurements,
  type BodyMeasurement,
} from '../log-analytics-progression.engine';

const KEY = 'he_weight_log';
const LEGACY = 'he_measurements';

beforeEach(() => {
  localStorage.clear();
});

const entry = (over: Partial<BodyMeasurement>): BodyMeasurement => ({
  date: '2026-01-01',
  weightKg: 82,
  bodyFatPercent: 15,
  neckCm: 38,
  chestCm: 100,
  shoulderCm: 120,
  armLeftCm: 38,
  armRightCm: 38.5,
  forearmLeftCm: 30,
  forearmRightCm: 30.5,
  waistCm: 80,
  hipCm: 95,
  thighLeftCm: 55,
  thighRightCm: 55.5,
  calfLeftCm: 37,
  calfRightCm: 37.2,
  notes: '',
  ...over,
});

describe('saveMeasurement → loadMeasurements round-trip', () => {
  it('сохраняет плечи и предплечья L/R без потери сторон', () => {
    saveMeasurement(entry({}));
    const loaded = loadMeasurements();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].shoulderCm).toBe(120);
    expect(loaded[0].forearmLeftCm).toBe(30);
    expect(loaded[0].forearmRightCm).toBe(30.5);
    expect(loaded[0].armLeftCm).toBe(38);
    expect(loaded[0].armRightCm).toBe(38.5);
  });

  it('мержит в существующую запись за дату, а не дублирует', () => {
    saveMeasurement(entry({ date: '2026-01-01', weightKg: 82, waistCm: 80 }));
    saveMeasurement(entry({ date: '2026-01-01', weightKg: 82.5, waistCm: 79, notes: 'уже' }));
    const loaded = loadMeasurements();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].weightKg).toBe(82.5);
    expect(loaded[0].waistCm).toBe(79);
    expect(loaded[0].shoulderCm).toBe(120);
    expect(loaded[0].notes).toBe('уже');
  });

  it('добавляет новую дату отдельной записью', () => {
    saveMeasurement(entry({ date: '2026-01-01' }));
    saveMeasurement(entry({ date: '2026-01-02', weightKg: 83 }));
    const loaded = loadMeasurements();
    expect(loaded).toHaveLength(2);
    expect(loaded.map((m) => m.date).sort()).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('legacy-миграция: пустой лог + he_measurements → данные переносятся', () => {
    localStorage.setItem(
      LEGACY,
      JSON.stringify([
        {
          date: '2025-06-01',
          weightKg: 78,
          bodyFatPercent: 16,
          shoulderCm: 118,
          armLeftCm: 36,
          armRightCm: 36.5,
          forearmLeftCm: 28,
          forearmRightCm: 28.5,
          waistCm: 78,
          notes: 'лето',
        },
      ]),
    );
    const loaded = loadMeasurements();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].shoulderCm).toBe(118);
    expect(loaded[0].forearmLeftCm).toBe(28);
    expect(loaded[0].forearmRightCm).toBe(28.5);
    // мигрировано в канонический лог
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    expect(raw[0].shoulderCm).toBe(118);
    expect(raw[0].forearmLeftCm).toBe(28);
    expect(localStorage.getItem(LEGACY)).toBeNull();
  });

  it('не перетирает канонический лог legacy при его наличии', () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 82, shoulderCm: 120 }]));
    localStorage.setItem(LEGACY, JSON.stringify([{ date: '2025-01-01', weightKg: 70 }]));
    const loaded = loadMeasurements();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].date).toBe('2026-01-01');
  });
});

describe('analyzeMeasurements', () => {
  it('возвращает null при <2 записей', () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 82 }]));
    expect(analyzeMeasurements(180)).toBeNull();
  });

  it('считает изменения, симметрию, FFMI/BMI/LBM', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: 82, bodyFat: 16, shoulderCm: 118, waistCm: 82, hipCm: 96, armLeftCm: 37, armRightCm: 37 },
        { date: '2026-02-01', weight: 85, bodyFat: 14, shoulderCm: 122, waistCm: 80, hipCm: 97, armLeftCm: 38.5, armRightCm: 38 },
      ]),
    );
    const a = analyzeMeasurements(180);
    expect(a).not.toBeNull();
    expect(a!.changes.weightKg).toBe(3);
    expect(a!.changes.shoulderCm).toBe(4);
    expect(a!.changes.bodyFatPercent).toBe(-2);
    expect(a!.bmi).toBeCloseTo(26.23, 1);
    expect(a!.lbm).toBeCloseTo(73.1, 1);
    expect(a!.waistToHip).toBeCloseTo(80 / 97, 2);
    expect(a!.symmetry.arms).toBeGreaterThan(90);
  });

  it('shoulderToWaist больше не всегда 0 при заполненных плечах', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: 82, shoulderCm: 120, waistCm: 80 },
        { date: '2026-02-01', weight: 84, shoulderCm: 122, waistCm: 81 },
      ]),
    );
    const a = analyzeMeasurements(180);
    expect(a!.shoulderToWaist).toBeCloseTo(122 / 81, 2);
  });
});
