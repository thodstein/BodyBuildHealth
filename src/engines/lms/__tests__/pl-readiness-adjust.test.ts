/**
 * pl-readiness-adjust.test.ts — Фаза 6, п.6: утренний чек-ин → сегодняшняя сессия.
 *
 * Держим не «красивые числа», а ОБЕЩАНИЯ, из-за которых фича может навредить:
 *  • чек-ин никогда не увеличивает нагрузку (ни вес, ни подходы, ни RIR вниз);
 *  • меняется только сессия — структура плана не переписывается;
 *  • вчерашний чек-ин сегодня не действует;
 *  • красная зона = без отказа (RIR ≥ 1) и вес не выше плана.
 */
import { describe, expect, it } from 'vitest';
import {
  adjustSetsForReadiness,
  applyReadinessToDay,
  clearPLCheckin,
  evaluatePLReadiness,
  readPLCheckin,
  writePLCheckin,
  PL_CHECKIN_KEY,
  type PLMorningCheckin,
} from '../pl-readiness-adjust.engine';

const good: PLMorningCheckin = { sleepHours: 8, hrvRatio: 1, doms: 0, stress: 0 };
const bad: PLMorningCheckin = { sleepHours: 4.5, hrvRatio: 0.7, doms: 8, stress: 8 };

describe('evaluatePLReadiness — зоны готовности', () => {
  it('хороший сон/HRV без боли и стресса → зелёная зона, без модификаторов', () => {
    const v = evaluatePLReadiness(good);
    expect(v.level).toBe('green');
    expect(v.volumeMultiplier).toBe(1);
    expect(v.rirShift).toBe(0);
    expect(v.loadMultiplier).toBe(1);
    expect(v.noFailure).toBe(false);
    expect(v.summary).toMatch(/без изменений/);
  });

  it('недосып + просадка HRV → жёлтая зона (−37 баллов)', () => {
    const v = evaluatePLReadiness({ sleepHours: 6.5, hrvRatio: 0.85, doms: 0, stress: 0 });
    expect(v.score).toBe(76);
    expect(v.level).toBe('yellow');
    expect(v.volumeMultiplier).toBe(0.85);
    expect(v.rirShift).toBe(1);
    expect(v.loadMultiplier).toBe(1);              // вес в жёлтой зоне не трогаем
    expect(v.reasons.join(' ')).toMatch(/Сон 6\.5/);
    expect(v.reasons.join(' ')).toMatch(/HRV 85/);
  });

  it('всё плохо → красная зона: объём 0.6, вес 0.95, RIR +2, без отказа', () => {
    const v = evaluatePLReadiness(bad);
    expect(v.level).toBe('red');
    expect(v.volumeMultiplier).toBe(0.6);
    expect(v.rirShift).toBe(2);
    expect(v.loadMultiplier).toBe(0.95);
    expect(v.noFailure).toBe(true);
  });

  it('хороший сон НЕ даёт бонусов сверх 100 и не увеличивает нагрузку', () => {
    const v = evaluatePLReadiness({ sleepHours: 10, hrvRatio: 1.4, doms: 0, stress: 0 });
    expect(v.score).toBe(100);
    expect(v.volumeMultiplier).toBeLessThanOrEqual(1);
    expect(v.loadMultiplier).toBeLessThanOrEqual(1);
    expect(v.rirShift).toBe(0);
    expect(v.notes.join(' ')).toMatch(/не поднимает нагрузку/);
  });

  it('падение веса > 1.5 % и > 2.5 % штрафуется по-разному', () => {
    const small = evaluatePLReadiness({ ...good, bodyWeightKg: 80.5, baselineWeightKg: 81.5 }); // 1.2 %
    const mid = evaluatePLReadiness({ ...good, bodyWeightKg: 80, baselineWeightKg: 81.5 });     // 1.8 %
    const big = evaluatePLReadiness({ ...good, bodyWeightKg: 79, baselineWeightKg: 81.5 });     // 3.1 %
    expect(small.score).toBe(100);
    expect(mid.score).toBe(90);
    expect(big.score).toBe(80);
    expect(big.reasons.join(' ')).toMatch(/2\.5 %/);
    expect(big.notes.join(' ')).toMatch(/обезвоживание|недоед/);
  });

  it('значения вне диапазона не ломают оценку (клэмпы)', () => {
    const v = evaluatePLReadiness({ sleepHours: -5, hrvRatio: 0, doms: 50, stress: -3 });
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
    expect(v.level).toBe('red');
  });
});

describe('adjustSetsForReadiness — инварианты нагрузки', () => {
  const sets = [
    { weight: 100, reps: 5, rir: 2, sets: 3 },
    { weight: 95, reps: 5, rir: 2, sets: 3 },
    { weight: 90, reps: 5, rir: 2, sets: 3 },
    { weight: 85, reps: 5, rir: 2, sets: 3 },
  ];

  it('зелёная зона → тот же массив (identity, без лишних копий)', () => {
    const v = evaluatePLReadiness(good);
    expect(adjustSetsForReadiness(sets, v)).toBe(sets);
  });

  it('жёлтая зона: подходов меньше, вес не меняется, RIR +1', () => {
    const v = evaluatePLReadiness({ sleepHours: 6, hrvRatio: 0.85, doms: 0, stress: 0 });
    const out = adjustSetsForReadiness(sets, v);
    expect(out.length).toBe(3);                       // round(4 × 0.85) = 3
    expect(out.map(s => s.weight)).toEqual([100, 95, 90]);
    expect(out.every(s => s.rir === 3)).toBe(true);
  });

  it('красная зона: вес ниже плана, RIR ≥ 1 (не до отказа), подходов не больше плана', () => {
    const v = evaluatePLReadiness(bad);
    const out = adjustSetsForReadiness(sets, v);
    expect(out.length).toBe(2);                       // round(4 × 0.6) = 2
    for (let i = 0; i < out.length; i++) {
      expect(out[i].weight).toBeLessThanOrEqual(sets[i].weight);
      expect(out[i].weight % 2.5).toBe(0);
      expect(out[i].rir).toBeGreaterThanOrEqual(1);
      expect(out[i].rir).toBe(4);                     // 2 + 2
    }
  });

  it('единственный подход не выкидывается даже в красной зоне', () => {
    const v = evaluatePLReadiness(bad);
    const one = [{ weight: 140, reps: 1, rir: 0, sets: 1 }];
    const out = adjustSetsForReadiness(one, v);
    expect(out).toHaveLength(1);
    expect(out[0].rir).toBeGreaterThanOrEqual(1);
  });

  it('applyReadinessToDay масштабирует каждый targetSets и сохраняет прочие поля', () => {
    const v = evaluatePLReadiness({ sleepHours: 6.5, hrvRatio: 0.85, doms: 0, stress: 0 });
    const day = [
      { name: 'Присед', restSec: 180, targetSets: sets },
      { name: 'Жим', restSec: 120, targetSets: [{ weight: 80, reps: 5, rir: 2, sets: 3 }] },
    ];
    const out = applyReadinessToDay(day, v);
    expect(out[0].name).toBe('Присед');
    expect(out[0].restSec).toBe(180);
    expect(out[0].targetSets).toHaveLength(3);
    expect(out[1].targetSets).toHaveLength(1);        // round(1 × 0.85) = 1 → остаётся
  });
});

describe('хранение чек-ина: действует только «сегодня»', () => {
  const mk = () => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); },
    };
  };

  it('write → read на ту же дату возвращает чек-ин и пересчитанный вердикт', () => {
    const s = mk();
    writePLCheckin(s, bad, '2026-11-03');
    const got = readPLCheckin(s, '2026-11-03');
    expect(got).not.toBeNull();
    expect(got!.checkin.sleepHours).toBe(4.5);
    expect(got!.verdict.level).toBe('red');
  });

  it('вчерашний чек-ин сегодня не действует', () => {
    const s = mk();
    writePLCheckin(s, bad, '2026-11-02');
    expect(readPLCheckin(s, '2026-11-03')).toBeNull();
  });

  it('битый/чужой JSON → null, а не падение', () => {
    const s = mk();
    s.setItem(PL_CHECKIN_KEY, '{oops');
    expect(readPLCheckin(s, '2026-11-03')).toBeNull();
    s.setItem(PL_CHECKIN_KEY, JSON.stringify({ date: '2026-11-03' }));
    expect(readPLCheckin(s, '2026-11-03')).toBeNull();
  });

  it('сброс чек-ина возвращает тренировку к плану', () => {
    const s = mk();
    writePLCheckin(s, bad, '2026-11-03');
    clearPLCheckin(s);
    expect(readPLCheckin(s, '2026-11-03')).toBeNull();
  });

  it('хранилище недоступно → не падаем', () => {
    expect(readPLCheckin(null)).toBeNull();
    expect(writePLCheckin(null, good)).toBeNull();
    expect(() => clearPLCheckin(null)).not.toThrow();
  });
});
