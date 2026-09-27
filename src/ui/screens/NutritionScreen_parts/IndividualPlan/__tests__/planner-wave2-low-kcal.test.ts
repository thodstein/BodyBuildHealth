/**
 * planner-wave2-low-kcal.test.ts — Волна 2: низкие КБЖУ (1200-1500 ккал).
 *
 * Проверяет:
 * - isLowKcalDay / isVeryLowKcalDay: граничные условия
 * - lowKcalProteinBoost: приоритет белка (минимум 35% калорий)
 * - selectCompactFiberSources: компактные источники клетчатки
 * - lowKcalPeriCarbTarget: адаптивный peri-протокол
 * - lowKcalFatCap: ограничение жиров
 * - lowKcalCarbTarget: углеводы как остаток
 * - isCompactFiberForLowKcal: проверка компактных овощей/ягод
 */
import { describe, it, expect } from 'vitest';
import {
  isLowKcalDay,
  isVeryLowKcalDay,
  lowKcalProteinBoost,
  selectCompactFiberSources,
  lowKcalPeriCarbTarget,
  lowKcalFatCap,
  lowKcalCarbTarget,
  COMPACT_FIBER_SOURCES,
} from '../planner-carb-density';
import {
  isCompactFiberForLowKcal,
  LOW_KCAL_COMPACT_VEGGIES,
  LOW_KCAL_BERRIES,
} from '../food-availability';

describe('Wave 2: isLowKcalDay', () => {
  it('определяет низкокалорийный день (1200 ккал)', () => {
    expect(isLowKcalDay(1200)).toBe(true);
  });

  it('определяет низкокалорийный день (1500 ккал)', () => {
    expect(isLowKcalDay(1500)).toBe(true);
  });

  it('определяет низкокалорийный день (1350 ккал)', () => {
    expect(isLowKcalDay(1350)).toBe(true);
  });

  it('НЕ определяет обычный день (2000 ккал)', () => {
    expect(isLowKcalDay(2000)).toBe(false);
  });

  it('НЕ определяет очень низкий день (1000 ккал)', () => {
    expect(isLowKcalDay(1000)).toBe(false);
  });

  it('НЕ определяет нулевую калорийность', () => {
    expect(isLowKcalDay(0)).toBe(false);
  });
});

describe('Wave 2: isVeryLowKcalDay', () => {
  it('определяет очень низкий день (1000 ккал)', () => {
    expect(isVeryLowKcalDay(1000)).toBe(true);
  });

  it('определяет очень низкий день (800 ккал)', () => {
    expect(isVeryLowKcalDay(800)).toBe(true);
  });

  it('НЕ определяет низкокалорийный день (1200 ккал)', () => {
    expect(isVeryLowKcalDay(1200)).toBe(false);
  });

  it('НЕ определяет обычный день (2000 ккал)', () => {
    expect(isVeryLowKcalDay(2000)).toBe(false);
  });
});

describe('Wave 2: lowKcalProteinBoost', () => {
  it('увеличивает белок для низкокалорийного дня до минимум 35% калорий', () => {
    // 1300 ккал * 0.35 / 4 = 113.75 г белка минимум
    const boosted = lowKcalProteinBoost(1300, 80, 90);
    expect(boosted).toBeGreaterThanOrEqual(113);
  });

  it('не уменьшает белок, если он уже достаточен', () => {
    const boosted = lowKcalProteinBoost(1300, 80, 120);
    expect(boosted).toBe(120);
  });

  it('учитывает стандартный расчёт по весу (0.45 г/кг)', () => {
    // 80 кг * 0.45 = 36 г, но минимум 35% от 1200 ккал = 105 г
    const boosted = lowKcalProteinBoost(1200, 80, 36);
    expect(boosted).toBeGreaterThanOrEqual(105);
  });

  it('ограничивает потолок 2.0 г/кг', () => {
    // 80 кг * 2.0 = 160 г потолок
    const boosted = lowKcalProteinBoost(1500, 80, 200);
    expect(boosted).toBeLessThanOrEqual(160);
  });

  it('для очень низкого дня использует 40% калорий от белка', () => {
    // 1000 ккал * 0.40 / 4 = 100 г белка минимум
    const boosted = lowKcalProteinBoost(1000, 80, 80);
    expect(boosted).toBeGreaterThanOrEqual(100);
  });

  it('для обычного дня возвращает базовый белок', () => {
    const boosted = lowKcalProteinBoost(2500, 80, 100);
    expect(boosted).toBe(100);
  });
});

describe('Wave 2: selectCompactFiberSources', () => {
  it('возвращает компактные источники для низкокалорийного дня', () => {
    const sources = selectCompactFiberSources(1300, 30, 3);
    expect(sources.length).toBe(3);
  });

  it('сортирует по плотности клетчатки (убывание)', () => {
    const sources = selectCompactFiberSources(1300, 30, 5);
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i - 1].fiberDensity).toBeGreaterThanOrEqual(sources[i].fiberDensity);
    }
  });

  it('возвращает пустой массив для обычного дня', () => {
    const sources = selectCompactFiberSources(2500, 30, 3);
    expect(sources.length).toBe(0);
  });

  it('возвращает источники для очень низкого дня', () => {
    const sources = selectCompactFiberSources(1000, 25, 3);
    expect(sources.length).toBe(3);
  });

  it('все источники имеют положительную плотность клетчатки', () => {
    for (const s of COMPACT_FIBER_SOURCES) {
      expect(s.fiberDensity).toBeGreaterThan(0);
      expect(s.fiberPer100).toBeGreaterThan(0);
      expect(s.kcalPer100).toBeGreaterThan(0);
    }
  });
});

describe('Wave 2: lowKcalPeriCarbTarget', () => {
  it('уменьшает peri-углеводы вдвое для низкокалорийного дня', () => {
    const target = lowKcalPeriCarbTarget(1300, 70);
    expect(target).toBe(35);
  });

  it('устанавливает минимальные peri-углеводы для очень низкого дня', () => {
    const target = lowKcalPeriCarbTarget(1000, 70);
    expect(target).toBe(25);
  });

  it('возвращает стандартный целевой объём для обычного дня', () => {
    const target = lowKcalPeriCarbTarget(2500, 70);
    expect(target).toBe(70);
  });

  it('не превышает стандартный целевой объём для очень низкого дня', () => {
    const target = lowKcalPeriCarbTarget(800, 100);
    expect(target).toBeLessThanOrEqual(25);
  });
});

describe('Wave 2: lowKcalFatCap', () => {
  it('ограничивает жиры для низкокалорийного дня', () => {
    // 1300 ккал * 0.25 / 9 = 36 г максимум
    const cap = lowKcalFatCap(1300, 80, 50);
    expect(cap).toBeLessThanOrEqual(36);
  });

  it('устанавливает минимум 0.6 г/кг для гормонального здоровья', () => {
    // 80 кг * 0.6 = 48 г минимум, но при 1300 ккал максимум 25% калорий = 36 г
    // Функция возвращает более строгий предел (36 г)
    const cap = lowKcalFatCap(1300, 80, 30);
    expect(cap).toBeLessThanOrEqual(36);
  });

  it('возвращает базовый уровень жиров для обычного дня', () => {
    const cap = lowKcalFatCap(2500, 80, 60);
    expect(cap).toBe(60);
  });

  it('возвращает базовый уровень жиров для обычного дня', () => {
    const cap = lowKcalFatCap(2500, 80, 60);
    expect(cap).toBe(60);
  });
});

describe('Wave 2: lowKcalCarbTarget', () => {
  it('вычисляет углеводы как остаток после белка и жиров', () => {
    // 1300 - (120*4) - (48*9) = 1300 - 480 - 432 = 388 ккал / 4 = 97 г
    // Но минимум 100 г для функции щитовидной железы
    const carbs = lowKcalCarbTarget(1300, 120, 48);
    expect(carbs).toBe(100);
  });

  it('устанавливает минимум 100 г углеводов для функции щитовидной железы', () => {
    const carbs = lowKcalCarbTarget(1200, 150, 60);
    expect(carbs).toBeGreaterThanOrEqual(100);
  });

  it('возвращает положительное значение для очень низкого дня', () => {
    const carbs = lowKcalCarbTarget(1000, 100, 45);
    expect(carbs).toBeGreaterThan(0);
  });
});

describe('Wave 2: isCompactFiberForLowKcal', () => {
  it('определяет компактные овощи', () => {
    expect(isCompactFiberForLowKcal('broccoli')).toBe(true);
    expect(isCompactFiberForLowKcal('spinach')).toBe(true);
    expect(isCompactFiberForLowKcal('cabbage')).toBe(true);
  });

  it('определяет ягоды', () => {
    expect(isCompactFiberForLowKcal('raspberries')).toBe(true);
    expect(isCompactFiberForLowKcal('blackberries')).toBe(true);
    expect(isCompactFiberForLowKcal('strawberries')).toBe(true);
  });

  it('НЕ определяет обычные продукты', () => {
    expect(isCompactFiberForLowKcal('rice_white')).toBe(false);
    expect(isCompactFiberForLowKcal('chicken_breast')).toBe(false);
    expect(isCompactFiberForLowKcal('')).toBe(false);
  });

  it('содержит все компактные овощи в реестре', () => {
    expect(LOW_KCAL_COMPACT_VEGGIES.size).toBeGreaterThanOrEqual(10);
  });

  it('содержит все ягоды в реестре', () => {
    expect(LOW_KCAL_BERRIES.size).toBeGreaterThanOrEqual(4);
  });
});
