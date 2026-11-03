/**
 * pl-vbt-loop.test.ts — Фаза 6, п.7: замкнутый контур VBT (скорость → следующий подход).
 *
 * Проверяем не «красивость» рекомендаций, а обещания:
 *  • нет скорости/веса → никакого пересчёта (no-data), а не средние по больнице;
 *  • один подход → hold + low confidence (тренда нет);
 *  • вслед за падением скорости вес не растёт никогда;
 *  • шаг ограничен одним диском (2.5 кг; < 40 кг — 1 кг);
 *  • быстрее зоны при падающем тренде — не увеличиваем.
 */
import { describe, expect, it } from 'vitest';
import { adviseVBTNextSet, vbtWeightStep, type VBTSetSample } from '../pl-vbt-loop.engine';

const s = (weight: number, velocity: number): VBTSetSample => ({ weight, velocity });

describe('adviseVBTNextSet — данных нет', () => {
  it('пустой список → no-data и nextWeight = null', () => {
    const a = adviseVBTNextSet({ samples: [], plannedNextWeight: 100, intent: 'strength' });
    expect(a.action).toBe('no-data');
    expect(a.nextWeight).toBeNull();
    expect(a.confidence).toBe('none');
    expect(a.reason).toMatch(/Скорость не записана/);
  });

  it('мусорные значения (0/NaN/без веса) не считаются данными', () => {
    const a = adviseVBTNextSet({
      samples: [s(0, 0.5), s(100, 0), s(100, Number.NaN), s(Number.NaN, 0.4)],
      plannedNextWeight: 100,
      intent: 'strength',
    });
    expect(a.action).toBe('no-data');
    expect(a.usedSets).toBe(0);
  });

  it('один подход → hold, confidence low, вес = плану', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.45)], plannedNextWeight: 102.5, intent: 'strength' });
    expect(a.action).toBe('hold');
    expect(a.nextWeight).toBe(102.5);
    expect(a.confidence).toBe('low');
    expect(a.deltaKg).toBe(0);
    expect(a.reason).toMatch(/Нужен второй подход/);
  });
});

describe('adviseVBTNextSet — потеря скорости', () => {
  it('порог пробит (24 % ≥ 20 %) → вес вниз на 5 % (округление до диска)', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.5), s(100, 0.38)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.dropPct).toBe(24);
    expect(a.thresholdPct).toBe(20);
    expect(a.action).toBe('decrease');
    expect(a.nextWeight).toBe(95);
    expect(a.deltaKg).toBe(-5);
    expect(a.reason).toMatch(/порог 20% пробит/);
  });

  it('усталость до порога (12 %) → всё равно легче: увеличивать нечего', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.5), s(100, 0.44)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.dropPct).toBe(12);
    expect(a.action).toBe('decrease');
    expect(a.nextWeight).toBe(95);
  });

  it('для скорости/мощности порог строже (10 %)', () => {
    const a = adviseVBTNextSet({ samples: [s(80, 1.2), s(80, 1.07)], plannedNextWeight: 80, intent: 'speed' });
    expect(a.thresholdPct).toBe(10);
    expect(a.action).toBe('decrease');
    expect(a.nextWeight).toBe(75); // 5 % от 80 = 4 кг → округление до диска 2.5 кг = 5 кг вниз
  });
});

describe('adviseVBTNextSet — «быстро» ≠ «можно больше»', () => {
  it('быстрее зоны при стабильной скорости → один шаг вверх', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.6), s(100, 0.59)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.action).toBe('increase');
    expect(a.nextWeight).toBe(102.5);
    expect(a.deltaKg).toBe(2.5);
    expect(a.reason).toMatch(/один шаг/);
  });

  it('быстрее зоны, но скорость уже падает (5 %) → не увеличиваем', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.6), s(100, 0.57)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.action).toBe('hold');
    expect(a.nextWeight).toBe(100);
  });

  it('медленнее зоны → снаряд тяжёл, вес вниз', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.29), s(100, 0.29)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.action).toBe('decrease');
    expect(a.nextWeight).toBe(95);
    expect(a.reason).toMatch(/ниже зоны/);
  });

  it('в зоне и стабильно → держим план', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.42), s(100, 0.42)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.action).toBe('hold');
    expect(a.nextWeight).toBe(100);
    expect(a.confidence).toBe('low');
  });
});

describe('adviseVBTNextSet — шаг и доверие', () => {
  it('шаг не больше одного диска даже при большом запасе', () => {
    const a = adviseVBTNextSet({ samples: [s(200, 0.7), s(200, 0.69)], plannedNextWeight: 200, intent: 'strength' });
    expect(a.action).toBe('increase');
    expect(a.nextWeight).toBe(202.5);
  });

  it('лёгкие снаряды (< 40 кг) идут шагом 1 кг', () => {
    expect(vbtWeightStep(20)).toBe(1);
    expect(vbtWeightStep(40)).toBe(2.5);
    const up = adviseVBTNextSet({ samples: [s(20, 0.7), s(20, 0.7)], plannedNextWeight: 20, intent: 'strength' });
    expect(up.nextWeight).toBe(21);
    const down = adviseVBTNextSet({ samples: [s(20, 0.5), s(20, 0.42)], plannedNextWeight: 20, intent: 'strength' });
    expect(down.nextWeight).toBe(19);
  });

  it('3+ подхода → confidence ok', () => {
    const a = adviseVBTNextSet({
      samples: [s(100, 0.45), s(100, 0.44), s(100, 0.43)],
      plannedNextWeight: 100,
      intent: 'strength',
    });
    expect(a.confidence).toBe('ok');
    expect(a.usedSets).toBe(3);
  });

  it('вес никогда не уходит в минус при крошечном плане', () => {
    const a = adviseVBTNextSet({ samples: [s(2, 0.5), s(2, 0.3)], plannedNextWeight: 2, intent: 'strength' });
    expect(a.action).toBe('decrease');
    expect(a.nextWeight).toBeGreaterThanOrEqual(0);
  });

  it('возвращает справочную зону интента и честные пометки', () => {
    const a = adviseVBTNextSet({ samples: [s(100, 0.45), s(100, 0.45)], plannedNextWeight: 100, intent: 'strength' });
    expect(a.zone).toEqual({ min: 0.3, max: 0.5, ideal: 0.4 });
    expect(a.notes.join(' ')).toMatch(/справочные ориентиры/);
    expect(a.notes.join(' ')).toMatch(/MCV\/MPV/);
  });
});
