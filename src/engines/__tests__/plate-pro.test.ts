import { describe, expect, it } from 'vitest';
import {
  calculatePlates,
  reversePlateWeight,
  nearestLoadable,
  percentTargets,
  loadPlateHistory,
  pushPlateHistory,
  PLATE_HISTORY_KEY,
} from '../gym-competition.engine';

describe('plates PRO: замки', () => {
  it('пара замков 2.5 добавляется к грифу: 100 = 22.5 + блины', () => {
    const r = calculatePlates(100, 20, 'kg', undefined, { collarsKg: 2.5 });
    expect(r.actualWeight).toBe(100);
    // на сторону (100−22.5)/2 = 38.75 → 25+10+2.5+1.25
    expect(r.platesPerSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 10, count: 1 },
      { plate: 2.5, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });
  it('без замков — как раньше (100 = 20 + 25+10+2.5)', () => {
    const r = calculatePlates(100, 25, 'kg');
    expect(r.actualWeight).toBe(100);
    expect(r.platesPerSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 10, count: 1 },
      { plate: 2.5, count: 1 },
    ]);
  });
});

describe('plates PRO: дробные блины', () => {
  it('101 кг собирается дробными: 20 + (25+15+0.5)×2', () => {
    const r = calculatePlates(101, 20, 'kg');
    expect(r.deviation).toBe(0);
    expect(r.actualWeight).toBe(101);
  });
});

describe('plates PRO: инвентарь режет жадность', () => {
  it('нет блинов 25 (0 шт) → набирает 20-ми', () => {
    const r = calculatePlates(100, 20, 'kg', undefined, { inventory: { 25: 0 } });
    expect(r.actualWeight).toBe(100);
    expect(r.platesPerSide[0]).toEqual({ plate: 20, count: 2 });
  });
  it('одна пара 25 (2 шт) при нужде в двух → 25×1 + добор', () => {
    const r = calculatePlates(140, 20, 'kg', undefined, { inventory: { 25: 2 } });
    expect(r.actualWeight).toBe(140);
    expect(r.platesPerSide.find(p => p.plate === 25)?.count).toBe(1);
  });
});

describe('plates PRO: reverse', () => {
  it('roundtrip: разложил 100 → reverse даёт 100', () => {
    const r = calculatePlates(100, 20, 'kg');
    expect(reversePlateWeight(r.platesPerSide, 20)).toBe(100);
  });
  it('reverse с замками', () => {
    expect(reversePlateWeight([{ plate: 25, count: 1 }], 20, 2.5)).toBe(72.5);
  });
});

describe('plates PRO: история весов (кап 8, дедуп)', () => {
  it('push/load roundtrip + дедуп повтора наверх + кап', () => {
    localStorage.clear();
    pushPlateHistory(100);
    pushPlateHistory(80);
    pushPlateHistory(100);
    expect(loadPlateHistory()).toEqual([100, 80]);
    for (let w = 60; w < 140; w += 5) pushPlateHistory(w);
    expect(loadPlateHistory().length).toBeLessThanOrEqual(8);
    expect(localStorage.getItem(PLATE_HISTORY_KEY)).toContain('100');
  });
  it('мусор/нули не пишутся', () => {
    localStorage.clear();
    pushPlateHistory(0);
    pushPlateHistory(-5);
    expect(loadPlateHistory()).toEqual([]);
  });
});

describe('plates PRO: nearest + проценты', () => {
  it('несобираемый 101.3 при наборе без дробных → down 100 / up 105', () => {
    const n = nearestLoadable(101.3, 20, 'kg', [25, 20, 15, 10, 5, 2.5]);
    expect(n.down).toBe(100);
    expect(n.up).toBe(105);
  });
  it('собираемый вес → down равен цели', () => {
    const n = nearestLoadable(100, 20, 'kg');
    expect(n.down).toBe(100);
  });
  it('percentTargets: 9 пресетов, 90% от 100 = 90', () => {
    const t = percentTargets(100, 20);
    expect(t).toHaveLength(9);
    expect(t.find(x => x.pct === 90)?.weight).toBe(90);
  });
  it('percentTargets без 1RM — пусто', () => {
    expect(percentTargets(0, 20)).toEqual([]);
  });
});
