import { describe, expect, it } from 'vitest';
import {
  mvForMuscle,
  canonicalVolumeStatus,
  sessionMavViolations,
  effectiveVolumeByMuscle,
  frequencyForVolume,
  rirProfileCheck,
  hardSetsCount,
  canonicalMrvForGroup,
  canonicalGroupRow,
  SESSION_MAV_CAP,
} from '../volume-canonical.engine';

describe('volume-canonical: MV + статусы', () => {
  it('MV косвенных групп = 0 (перед.дельта/пресс/ягодицы)', () => {
    expect(mvForMuscle('delt_front')).toBe(0);
    expect(mvForMuscle('abs')).toBe(0);
    expect(mvForMuscle('glutes')).toBe(0);
  });
  it('MV не штрафуется: между MV и MEV — maintenance, а не below_mev', () => {
    // chest intermediate: MEV 8. 6 сетов при MV 6 → maintenance
    expect(canonicalVolumeStatus(6, { mev: 8, mav: 14, mrv: 20 }, 6)).toBe('maintenance');
    expect(canonicalVolumeStatus(3, { mev: 8, mav: 14, mrv: 20 }, 6)).toBe('below_mev');
    expect(canonicalVolumeStatus(10, { mev: 8, mav: 14, mrv: 20 }, 6)).toBe('optimal');
  });
  it('канонический MRV груди intermediate = 20 (не mrvBase-грубый)', () => {
    expect(canonicalMrvForGroup('intermediate', 'chest')).toBe(20);
    expect(canonicalMrvForGroup('intermediate', 'legs')).toBe(36); // quads 20 + hams 16
    expect(canonicalMrvForGroup('intermediate', 'arms')).toBe(28); // bi 14 + tri 14
  });
  it('canonicalGroupRow судит по effective (жим даёт трицепсу indirect)', () => {
    const row = canonicalGroupRow('intermediate', 'chest', 12, 12)!;
    expect(row.mv).toBe(6);
    expect(row.status).toBe('optimal');
  });
});

describe('volume-canonical: session-MAV', () => {
  it('порог 10: 11 сетов груди в 1 день — violation', () => {
    expect(SESSION_MAV_CAP).toBe(10);
    const v = sessionMavViolations([
      { exerciseId: 'bench_bar', day: 1, sets: 11 },
    ]);
    expect(v.length).toBe(1);
    expect(v[0].message).toContain('разбейте на 2');
  });
  it('10 сетов — чисто', () => {
    expect(sessionMavViolations([{ exerciseId: 'bench_bar', day: 1, sets: 10 }])).toHaveLength(0);
  });
  it('разбивка 6+6 по дням — чисто', () => {
    expect(sessionMavViolations([
      { exerciseId: 'bench_bar', day: 1, sets: 6 },
      { exerciseId: 'bench_bar', day: 3, sets: 6 },
    ])).toHaveLength(0);
  });
});

describe('volume-canonical: effective-объём', () => {
  it('жим лёжа даёт indirect трицепсу и плечам (паритет bb-volume 0.45/0.20)', () => {
    const { direct, indirect, effective } = effectiveVolumeByMuscle([
      { exerciseId: 'bench_bar', day: 1, sets: 10 },
    ]);
    expect(direct.chest).toBe(10);
    expect(indirect.triceps).toBeCloseTo(4.5, 1);
    expect(indirect.shoulders).toBeCloseTo(2, 1);
    expect(effective.triceps).toBeCloseTo(4.5, 1);
  });
  it('effective ≤ direct + indirect (инвариант, без двойного счёта)', () => {
    const { direct, indirect, effective } = effectiveVolumeByMuscle([
      { exerciseId: 'bench_bar', day: 1, sets: 4 },
      { exerciseId: 'squat', day: 2, sets: 4 },
    ]);
    const sumD = Object.values(direct).reduce((a, b) => a + b, 0);
    const sumI = Object.values(indirect).reduce((a, b) => a + b, 0);
    const sumE = Object.values(effective).reduce((a, b) => a + b, 0);
    expect(sumE).toBeCloseTo(sumD + sumI, 6);
  });
});

describe('volume-canonical: частота v2', () => {
  const lm = { mev: 8, mav: 14, mrv: 20 };
  it('bro-сплит в MAV в 1 сессию — info, не warning', () => {
    const v = frequencyForVolume(12, 1, lm, 'Грудь');
    expect(v.kind).toBe('info');
  });
  it('объём > MAV в 1 сессию — warning разбить', () => {
    const v = frequencyForVolume(18, 1, lm, 'Грудь');
    expect(v.kind).toBe('warning');
    expect(v.message).toContain('разбейте');
  });
  it('объём > MRV — critical независимо от частоты', () => {
    expect(frequencyForVolume(22, 3, lm).kind).toBe('critical');
  });
});

describe('volume-canonical: RIR-профиль', () => {
  it('новичок с отказом — critical', () => {
    const p = rirProfileCheck([{ rpe: 10 }, { rpe: 8 }], 'beginner');
    expect(p.verdict.kind).toBe('critical');
  });
  it('все RIR 4+ — warning мусорный объём', () => {
    const p = rirProfileCheck([{ rpe: 5 }, { rpe: 6 }, { rpe: 5 }], 'intermediate');
    expect(p.verdict.kind).toBe('warning');
    expect(p.verdict.message).toContain('мусорный');
  });
  it('норма: средний 2, тяжёлых ≥30% — ok', () => {
    const p = rirProfileCheck([{ rpe: 8 }, { rpe: 9 }, { rpe: 7 }], 'intermediate');
    expect(p.verdict.kind).toBe('ok');
  });
  it('без RPE — info, скор не штрафуем', () => {
    const p = rirProfileCheck([{}, {}], 'intermediate');
    expect(p.verdict.kind).toBe('info');
  });
});

describe('volume-canonical: V2-адаптер (Ж3)', () => {
  it('строит полный вход композитора: сеты/частота/канон/effective/sessionMax/RIR', async () => {
    const m = await import('../volume-canonical.engine');
    const input = m.volumeRowsToV2Input([
      { exerciseId: 'bench_bar', day: 1, sets: 4, rpe: 8 },
      { exerciseId: 'bench_bar', day: 3, sets: 4, rpe: 9 },
    ], 'intermediate');
    expect(input.level).toBe('intermediate');
    expect(input.weeklySets.chest).toBe(8);
    expect(input.frequency.chest).toBe(2);
    expect(input.mev.chest).toBe(8);
    expect(input.mav.chest).toBe(14);
    expect(input.mrv.chest).toBe(20);
    expect(input.effectiveSets!.triceps).toBeCloseTo(3.6, 1);
    expect(input.sessionMaxByMuscle!.chest).toBe(4);
    expect(input.rir!.totalSets).toBe(8);
    expect(input.rir!.avgRir).toBeCloseTo(1.5, 2);
    expect(input.deload).toBeNull();
    expect(input.shoulder).toBeNull();
  });
  it('без RPE — rir null (V2 скипает срез)', async () => {
    const m = await import('../volume-canonical.engine');
    const input = m.volumeRowsToV2Input([{ exerciseId: 'bench_bar', day: 1, sets: 4 }], 'beginner');
    expect(input.rir).toBeNull();
  });
  it('неизвестные id пропускаются без throw', async () => {
    const m = await import('../volume-canonical.engine');
    expect(() => m.volumeRowsToV2Input([{ exerciseId: 'nope_xyz', day: 1, sets: 5 }], 'intermediate')).not.toThrow();
  });
});

describe('volume-canonical: hard sets', () => {
  it('RPE≥7 — hard; RPE<7 — нет; пустой — hard assumed', () => {
    const r = hardSetsCount([
      { sets: 4, rpe: 8 },
      { sets: 3, rpe: 5 },
      { sets: 2 },
    ]);
    expect(r.totalSets).toBe(9);
    expect(r.hardSets).toBe(6);
    expect(r.assumedSets).toBe(2);
  });
});
