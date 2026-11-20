import { describe, it, expect } from 'vitest';
import {
  collectExerciseBests,
  normalizeExerciseName,
  setIntensity,
  intensityZoneOf,
  isRecordCandidate,
  INTENSITY_ZONE_COLOR,
  type IntensitySession,
} from '../set-intensity.engine';

const sess = (date: string, name: string, sets: [number, number][]): IntensitySession => ({
  date,
  exercises: [{ exerciseName: name, sets: sets.map(([weightKg, reps]) => ({ weightKg, reps })) }],
});

describe('set-intensity: интенсивность подхода в % от личного лучшего e1RM', () => {
  it('нормализует название упражнения', () => {
    expect(normalizeExerciseName('  Жим Лёжа  ')).toBe(normalizeExerciseName('жим лежа'));
    expect(normalizeExerciseName('Приседания (со штангой)')).toBe('приседания со штангой');
    expect(normalizeExerciseName('')).toBe('');
  });

  it('собирает лучший e1RM по упражнению', () => {
    const bests = collectExerciseBests([
      sess('2026-10-01', 'Жим штанги лёжа', [[80, 8], [100, 3]]),   // e1RM 101 и 110
      sess('2026-10-08', 'жим штанги лежа', [[95, 5]]),             // e1RM 111
      sess('2026-10-15', 'Приседания', [[120, 5]]),
    ]);
    expect(bests.get(normalizeExerciseName('Жим штанги лёжа'))?.e1rm).toBe(111);
    expect(bests.get(normalizeExerciseName('Приседания'))?.e1rm).toBe(140);
  });

  it('пропускает вес 0 и пустые подходы', () => {
    const bests = collectExerciseBests([sess('2026-10-01', 'Тяга', [[0, 20], [60, 0]])]);
    expect(bests.size).toBe(0);
  });

  it('при равном e1RM берёт более позднюю дату', () => {
    const bests = collectExerciseBests([
      sess('2026-10-01', 'Жим', [[80, 8]]),   // 80 × 38 = 3040 → e1RM 101
      sess('2026-11-01', 'Жим', [[76, 10]]),  // 76 × 40 = 3040 → e1RM 101
    ]);
    expect(bests.get(normalizeExerciseName('Жим'))?.date).toBe('2026-11-01');
    expect(bests.get(normalizeExerciseName('Жим'))?.weight).toBe(76);
  });

  it('считает процент от лучшего e1RM', () => {
    const best = { e1rm: 120, weight: 100, reps: 6, date: '2026-10-01' };
    const r = setIntensity(80, 8, best); // e1RM 101
    expect(r.e1rm).toBe(101);
    expect(r.bestE1RM).toBe(120);
    expect(r.pct).toBe(84.2);
    expect(r.deltaPct).toBe(-15.8);
    expect(r.isRecord).toBe(false);
    expect(r.zone).toBe('near_max');
  });

  it('подход выше лучшего — рекорд', () => {
    const best = { e1rm: 110, weight: 100, reps: 3, date: '2026-10-01' };
    const r = setIntensity(90, 5, best); // e1RM 105 < 110
    expect(r.isRecord).toBe(false);
    const rec = setIntensity(100, 5, best); // 116.7
    expect(rec.e1rm).toBe(117);
    expect(rec.isRecord).toBe(true);
    expect(rec.zone).toBe('record');
    expect(rec.pct).toBe(106.4);
    expect(rec.label).toBe('выше личного лучшего');
  });

  it('без истории не выдумывает проценты', () => {
    const r = setIntensity(80, 8, null);
    expect(r.pct).toBeNull();
    expect(r.bestE1RM).toBeNull();
    expect(r.zone).toBe('unknown');
    expect(r.isRecord).toBe(false);
  });

  it('нулевой подход не даёт интенсивности', () => {
    expect(setIntensity(0, 8, { e1rm: 100, weight: 80, reps: 5, date: '2026-10-01' }).pct).toBeNull();
    expect(setIntensity(80, 0, { e1rm: 100, weight: 80, reps: 5, date: '2026-10-01' }).pct).toBeNull();
  });

  it('зоны по процентам', () => {
    expect(intensityZoneOf(55)).toBe('light');
    expect(intensityZoneOf(60)).toBe('working');
    expect(intensityZoneOf(79.9)).toBe('working');
    expect(intensityZoneOf(80)).toBe('near_max');
    expect(intensityZoneOf(90)).toBe('max');
    expect(intensityZoneOf(100)).toBe('max');
    expect(intensityZoneOf(100, true)).toBe('record');
    expect(intensityZoneOf(45, true)).toBe('record');
    expect(intensityZoneOf(null)).toBe('unknown');
    expect(INTENSITY_ZONE_COLOR.record).toBe('#00e68a');
  });

  it('рекорд внутри сессии: сравнивает и с историей, и с уже записанным', () => {
    const best = { e1rm: 110, weight: 100, reps: 3, date: '2026-10-01' };
    expect(isRecordCandidate(100, 3, best, 0)).toBe(false);        // ровно лучший
    expect(isRecordCandidate(90, 5, best, 0)).toBe(false);         // 105
    expect(isRecordCandidate(100, 5, best, 0)).toBe(true);         // 117
    expect(isRecordCandidate(100, 5, best, 120)).toBe(false);      // уже был в сессии выше
    expect(isRecordCandidate(100, 5, null, 0)).toBe(true);         // нет истории вовсе
    expect(isRecordCandidate(0, 5, best, 0)).toBe(false);
  });
});
