import { describe, it, expect } from 'vitest';
import {
  deriveArmBlocks,
  blockForWeek,
  cycleBlocksFor,
  progressionForWeek,
  planArmPeaks,
  buildArmAnchorSession,
  buildArmWarmupSets,
  DOUBLE_BLOCK_STEP,
} from '../arm-periodization.engine';

describe('arm-periodization: мезо-блоки', () => {
  it('deriveArmBlocks схлопывает серии фаз и держит границы', () => {
    const map: Record<number, string> = { 1: 'accumulation', 2: 'accumulation', 3: 'intensification', 4: 'deload', 5: 'peaking' };
    const b = deriveArmBlocks(map, 5);
    expect(b.map((x) => x.id)).toEqual(['base', 'build', 'deload', 'peak']);
    expect(b[0]).toMatchObject({ weekStart: 1, weekEnd: 2 });
    expect(b[3]).toMatchObject({ weekStart: 5, weekEnd: 5 });
    expect(blockForWeek(b, 2)?.id).toBe('base');
    expect(blockForWeek(b, 9)).toBeNull();
  });
  it('cycleBlocksFor: явные блоки библиотеки приоритетнее вывода', () => {
    const explicit = cycleBlocksFor('waf_season_16', {}, 16);
    expect(explicit.length).toBe(4);
    expect(explicit[0].name).toBe('База');
    expect(explicit[3]).toMatchObject({ name: 'Тейпер/Пик', weekStart: 15, weekEnd: 16 });
  });
  it('cycleBlocksFor: старый цикл без blocks → вывод из фаз', () => {
    const map: Record<number, string> = { 1: 'accumulation', 2: 'intensification' };
    const b = cycleBlocksFor('strengthlog_8', map, 2);
    expect(b.map((x) => x.id)).toEqual(['base', 'build']);
  });
  it('cycleBlocksFor: границы явных блоков клампятся к неделям', () => {
    // окно короче цикла (согласие на shrink) — блоки не выходят за weeks
    const b = cycleBlocksFor('waf_season_16', {}, 10);
    for (const x of b) {
      expect(x.weekStart).toBeGreaterThanOrEqual(1);
      expect(x.weekEnd).toBeLessThanOrEqual(10);
      expect(x.weekEnd).toBeGreaterThanOrEqual(x.weekStart);
    }
  });
});

describe('arm-periodization: стили прогрессии', () => {
  it('auto без ставки — ровно 1.0 (обратная совместимость)', () => {
    const p = progressionForWeek({ style: 'auto', phase: 'accumulation', week: 5, weekInPhase: 3, phaseInstance: 1, cyclePctPerWeek: 0 });
    expect(p.weightMult).toBe(1);
    expect(p.repsShift).toBe(0);
  });
  it('linear: компаундная ставка %/нед', () => {
    const p = progressionForWeek({ style: 'linear', phase: 'accumulation', week: 3, weekInPhase: 3, phaseInstance: 1, cyclePctPerWeek: 0.5 });
    expect(p.weightMult).toBeCloseTo(1.005 ** 2, 4);
  });
  it('double: повторы +1/нед в блоке (кап 3) и шаг веса между блоками', () => {
    const w1 = progressionForWeek({ style: 'double', phase: 'accumulation', week: 1, weekInPhase: 1, phaseInstance: 1, cyclePctPerWeek: 0 });
    const w4 = progressionForWeek({ style: 'double', phase: 'accumulation', week: 4, weekInPhase: 4, phaseInstance: 1, cyclePctPerWeek: 0 });
    const w5 = progressionForWeek({ style: 'double', phase: 'intensification', week: 5, weekInPhase: 5, phaseInstance: 1, cyclePctPerWeek: 0 });
    expect(w1.repsShift).toBe(0);
    expect(w4.repsShift).toBe(3);
    expect(w5.repsShift).toBe(3); // кап
    const b2 = progressionForWeek({ style: 'double', phase: 'intensification', week: 9, weekInPhase: 1, phaseInstance: 2, cyclePctPerWeek: 0 });
    expect(b2.weightMult).toBeCloseTo(1 + DOUBLE_BLOCK_STEP, 4);
  });
  it('double: делод и пик — нейтрально', () => {
    for (const phase of ['deload', 'peaking']) {
      const p = progressionForWeek({ style: 'double', phase, week: 4, weekInPhase: 4, phaseInstance: 2, cyclePctPerWeek: 0 });
      expect(p.weightMult).toBe(1);
      expect(p.repsShift).toBe(0);
    }
  });
  it('wave: тяж/сред/лёгк профиль внутри блока', () => {
    const mult = (wi: number) => progressionForWeek({ style: 'wave', phase: 'accumulation', week: wi, weekInPhase: wi, phaseInstance: 1, cyclePctPerWeek: 0 }).weightMult;
    expect(mult(1)).toBe(1);
    expect(mult(2)).toBeCloseTo(0.92, 4);
    expect(mult(3)).toBeCloseTo(1.05, 4);
    expect(mult(4)).toBeCloseTo(0.96, 4);
  });
  it('wave с линейной ставкой: база × волна', () => {
    const p = progressionForWeek({ style: 'wave', phase: 'accumulation', week: 3, weekInPhase: 2, phaseInstance: 1, cyclePctPerWeek: 0.5 });
    expect(p.weightMult).toBeCloseTo(1.005 ** 2 * 0.92, 4);
  });
});

describe('arm-periodization: мульти-старты', () => {
  const map8: Record<number, string> = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [i + 1, i + 1 <= 6 ? 'accumulation' : 'intensification']),
  );

  it('пусто — без окон', () => {
    const r = planArmPeaks(undefined, 10, map8);
    expect(r.windows).toEqual([]);
    expect(Object.keys(r.volumeOverrides)).toEqual([]);
  });
  it('A: 3-нед окно 90/65/45 + восстановление 60%', () => {
    const r = planArmPeaks([{ week: 8, priority: 'A', name: 'Чемпионат' }], 10, map8);
    expect(r.volumeOverrides[6]).toBeCloseTo(0.9, 4);
    expect(r.volumeOverrides[7]).toBeCloseTo(0.65, 4);
    expect(r.volumeOverrides[8]).toBeCloseTo(0.45, 4);
    expect(r.volumeOverrides[9]).toBeCloseTo(0.6, 4);
    expect(r.phaseOverrides[8]).toBe('peaking');
    expect(r.phaseOverrides[9]).toBe('deload');
    expect(r.markers[8]).toEqual({ priority: 'A', name: 'Чемпионат' });
    expect(r.taperWeeks).toContain(8);
    expect(r.recoveryWeeks).toEqual([9]);
    expect(r.notes[0]).toContain('🏁');
  });
  it('B: 2-нед окно 70/45 + восстановление', () => {
    const r = planArmPeaks([{ week: 5, priority: 'B' }], 8, map8);
    expect(r.volumeOverrides[4]).toBeCloseTo(0.7, 4);
    expect(r.volumeOverrides[5]).toBeCloseTo(0.45, 4);
    expect(r.recoveryWeeks).toEqual([6]);
    expect(r.markers[5].name).toBe('Старт B');
  });
  it('C: шарпенинг 85% без восстановительной недели', () => {
    const r = planArmPeaks([{ week: 7, priority: 'C' }], 8, map8);
    expect(r.volumeOverrides[7]).toBeCloseTo(0.85, 4);
    expect(r.recoveryWeeks).toEqual([]);
    expect(r.phaseOverrides[7]).toBeUndefined(); // C фазу не переводит
  });
  it('пересечение окон: второй старт → C-режим с честной нотой', () => {
    const r = planArmPeaks([{ week: 8, priority: 'A' }, { week: 9, priority: 'B' }], 12, map8);
    const second = r.windows.find((w) => w.week === 9)!;
    expect(second.priority).toBe('C');
    expect(second.skippedReason).toContain('без полного тейпера');
    expect(r.notes.join(' ')).toContain('пересекается');
  });
  it('невалидные недели и дубли отбрасываются', () => {
    const r = planArmPeaks([{ week: 0, priority: 'A' }, { week: 99, priority: 'A' }, { week: 5, priority: 'B' }, { week: 5, priority: 'A' }], 8, map8);
    expect(r.windows.length).toBe(1);
    expect(r.windows[0].week).toBe(5);
    expect(r.windows[0].priority).toBe('B'); // первый по порядку входа
  });
  it('старт на последней неделе: без восстановительной (её нет)', () => {
    const r = planArmPeaks([{ week: 8, priority: 'A' }], 8, map8);
    expect(r.recoveryWeeks).toEqual([]);
    expect(r.windows[0].recoveryWeek).toBeNull();
  });
});

describe('arm-periodization: разминочная рампа', () => {
  it('крупный вес: ступени строго возрастают и не перешагивают рабочий', () => {
    const s = buildArmWarmupSets(80);
    expect(s.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < s.length; i++) expect(s[i].load).toBeGreaterThan(s[i - 1].load);
    expect(Math.max(...s.map((x) => x.load))).toBeLessThan(80);
  });
  it('малый вес: 2 ступени; ноль/мусор — пусто', () => {
    expect(buildArmWarmupSets(10).length).toBe(2);
    expect(buildArmWarmupSets(0)).toEqual([]);
    expect(buildArmWarmupSets(Number.NaN)).toEqual([]);
  });
});

describe('arm-periodization: база-якорь', () => {
  const anchor = [
    { id: 'back_squat_anchor', name: 'Присед со штангой (якорь)', sets: 4, reps: '5-8' },
    { id: 'deadlift_anchor', name: 'Становая (якорь)', sets: 3, reps: '3-5' },
    { id: 'farmer_carry_anchor', name: 'Фермерская прогулка (якорь)', sets: 3, reps: '30-40м' },
  ];
  it('пустой вход → null', () => {
    expect(buildArmAnchorSession([], {})).toBeNull();
  });
  it('сессия LegsCore: веса от workMax носителей ×0.75, сет-форма цела', () => {
    const s = buildArmAnchorSession(anchor, { core_anchor: 100, back_pressure: 80, grip_support: 60 })!;
    expect(s.sessionTag).toBe('LegsCore');
    expect(s.exercises.length).toBe(3);
    expect(s.exercises[0].sets).toBe(4);
    expect(s.exercises[0].workSets.length).toBe(4);
    expect(s.exercises[0].workSets[0].weight).toBe(75);
    expect(s.exercises[1].workSets[0].weight).toBe(60);
    expect(s.exercises[2].workSets[0].weight).toBe(45);
    expect(s.exercises[0].repsRange).toEqual([5, 8]);
    expect(s.exercises[2].repsRange).toEqual([1, 1]);
    expect(s.exercises[2].workSets[0].holdSeconds).toBe(35);
  });
  it('без workMax — вес 0 (вес по факту), не NaN', () => {
    const s = buildArmAnchorSession(anchor, {})!;
    for (const e of s.exercises) {
      expect(e.workSets.every((w: any) => w.weight === 0)).toBe(true);
    }
  });
});
