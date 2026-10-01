import { describe, it, expect, beforeEach } from 'vitest';
import {
  ARM_CHECKIN_KEY,
  ARM_CHECKIN_CAP,
  loadArmCheckins,
  saveArmCheckin,
  removeArmCheckin,
  clearArmCheckins,
  armCheckinTrend,
} from '../arm-weekly-checkin.engine';
import type { ArmWeeklyCheckin } from '../arm-types';

const mk = (over: Partial<ArmWeeklyCheckin>): ArmWeeklyCheckin => ({
  id: `ci-${over.week}-${Math.random().toString(36).slice(2, 6)}`,
  week: 1,
  dateIso: '2026-09-01',
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});

describe('arm-weekly-checkin: storage', () => {
  it('save/load roundtrip + upsert по неделе (старый заменяется)', () => {
    saveArmCheckin(mk({ week: 1, dateIso: '2026-09-01', weightKg: 80 }));
    saveArmCheckin(mk({ week: 2, dateIso: '2026-09-08', weightKg: 79.5 }));
    saveArmCheckin(mk({ week: 1, dateIso: '2026-09-02', weightKg: 79.8 }));
    const all = loadArmCheckins();
    expect(all.length).toBe(2);
    expect(all.find((c) => c.week === 1)?.weightKg).toBe(79.8);
  });
  it('кап 26 и битый стор → пусто/тихо', () => {
    for (let i = 1; i <= 30; i++) saveArmCheckin(mk({ week: i, dateIso: `2026-09-${String(Math.min(28, i)).padStart(2, '0')}` }));
    expect(loadArmCheckins().length).toBe(ARM_CHECKIN_CAP);
    localStorage.setItem(ARM_CHECKIN_KEY, '{broken');
    expect(loadArmCheckins()).toEqual([]);
  });
  it('remove/clear работают; мусорные записи отбрасываются', () => {
    const a = saveArmCheckin(mk({ week: 1 }));
    localStorage.setItem(ARM_CHECKIN_KEY, JSON.stringify([{ bad: true }, ...a]));
    expect(loadArmCheckins().length).toBe(1);
    removeArmCheckin(a[0].id);
    expect(loadArmCheckins()).toEqual([]);
    clearArmCheckins();
    expect(loadArmCheckins()).toEqual([]);
  });
});

describe('arm-weekly-checkin: тренд', () => {
  it('ровный тренд → on_track; без данных → no_data', () => {
    const t = armCheckinTrend([
      mk({ week: 1, dateIso: '2026-09-01', weightKg: 80 }),
      mk({ week: 2, dateIso: '2026-09-08', weightKg: 79.8 }),
    ]);
    expect(t.rateStatus).toBe('on_track');
    expect(t.weightDeltaKg).toBeCloseTo(-0.2, 1);
    expect(armCheckinTrend([]).rateStatus).toBe('no_data');
  });
  it('сгонка быстрее 0.75%/нед при цели → too_fast', () => {
    const t = armCheckinTrend([
      mk({ week: 1, dateIso: '2026-09-01', weightKg: 80 }),
      mk({ week: 2, dateIso: '2026-09-08', weightKg: 78.5 }),
    ], { targetWeightKg: 74 });
    expect(t.rateStatus).toBe('too_fast');
    expect(t.notes.join(' ')).toContain('быстрее');
  });
  it('вес стоит при цели → too_slow; рост при цели → too_fast', () => {
    const slow = armCheckinTrend([
      mk({ week: 1, dateIso: '2026-09-01', weightKg: 80 }),
      mk({ week: 3, dateIso: '2026-09-15', weightKg: 79.95 }),
    ], { targetWeightKg: 74 });
    expect(slow.rateStatus).toBe('too_slow');
    const up = armCheckinTrend([
      mk({ week: 1, dateIso: '2026-09-01', weightKg: 80 }),
      mk({ week: 2, dateIso: '2026-09-08', weightKg: 80.6 }),
    ], { targetWeightKg: 74 });
    expect(up.rateStatus).toBe('too_fast');
  });
  it('боль ≥4 две недели → painWarn; энергия ≤4 → energyWarn', () => {
    const t = armCheckinTrend([
      mk({ week: 1, dateIso: '2026-09-01', elbowPain010: 5, energy010: 3 }),
      mk({ week: 2, dateIso: '2026-09-08', elbowPain010: 4, energy010: 4 }),
    ]);
    expect(t.painWarn).toBe(true);
    expect(t.painAvgLast2).toBe(4.5);
    expect(t.energyWarn).toBe(true);
    expect(t.notes.join(' ')).toContain('Боль локтя');
  });
  it('единичная запись боли — без painWarn (честно, нужна динамика)', () => {
    const t = armCheckinTrend([mk({ week: 1, dateIso: '2026-09-01', elbowPain010: 7 })]);
    expect(t.painWarn).toBe(true); // одна запись = её же среднее ≥4 — сигнал есть
    expect(t.painAvgLast2).toBe(7);
  });
});
