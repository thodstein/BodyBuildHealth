/**
 * nutrition-organ-load.test.ts — «Нагрузка БЖУ на органы» (аудит 2026-11).
 *
 * Что закрепляем (жалобы пользователя: «проверь актуальность и баги»):
 *  - обычный рацион не должен выглядеть критическим (раньше почки = 100);
 *  - ноль — легальное значение (кетогенный рацион: сахар 0);
 *  - Ω6/3 не прибит к 4:1, а считается только из реальных данных;
 *  - профиль не называет ЦНС/эндокринную «остеогенным»;
 *  - камни в почках ≠ ХБП;
 *  - история — одна запись на день, а не 30 копий сегодняшнего.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcOrganLoad, saveOrganLoadHistory, loadOrganLoadHistory, clearOrganLoadHistory,
  type OrganLoadInput,
} from '../nutrition-organ-load.engine';

const base = (over: Partial<OrganLoadInput> = {}): OrganLoadInput => ({
  proteinG: 150, fatG: 70, satFatG: 21, transFatG: 0.5,
  carbsG: 250, sugarG: 40, fiberG: 28, omega3Mg: 800,
  cholesterolMg: 300, sodiumMg: 2000, potassiumMg: 3500,
  waterMl: 2400, bodyWeightKg: 80, heightCm: 178, leanMassKg: 64,
  trainingHours: 1, mealsPerDay: 4, totalKcal: 150 * 4 + 70 * 9 + 250 * 4,
  ...over,
});

describe('calcOrganLoad: калибровка', () => {
  it('обычный рацион (150 Б / 70 Ж / 250 У) — не критическая почечная нагрузка', () => {
    const r = calcOrganLoad(base());
    expect(r.kidneys.level).not.toBe('critical');
    expect(r.kidneys.score).toBeLessThan(70);
  });

  it('обычный рацион не даёт «высокую» нагрузку на печень', () => {
    const r = calcOrganLoad(base());
    expect(r.liver.score).toBeLessThan(50);
    expect(r.liver.level).not.toBe('high');
  });

  it('атерогенная ось реагирует на насыщенные и трансжиры', () => {
    const clean = calcOrganLoad(base({ satFatG: 12, transFatG: 0, cholesterolMg: 150 }));
    const dirty = calcOrganLoad(base({ satFatG: 60, transFatG: 6, cholesterolMg: 700 }));
    expect(dirty.cardiovascular.score).toBeGreaterThan(clean.cardiovascular.score + 30);
  });

  it('общая нагрузка обычного рациона — «умеренная», а не «повышенная»', () => {
    const r = calcOrganLoad(base());
    expect(['low', 'moderate']).toContain(r.totalMetabolicLoad.level);
  });
});

describe('calcOrganLoad: значения по нулю', () => {
  it('сахар 0 не превращается в 25% углеводов', () => {
    const keto = calcOrganLoad(base({ sugarG: 0, carbsG: 30, fiberG: 20 }));
    expect(keto.liver.breakdown.fructose).toBe(0);
    expect(keto.cns.score).toBeLessThan(calcOrganLoad(base()).cns.score);
  });

  it('нулевые насыщенные жиры не подменяются 30% от жиров', () => {
    const noSat = calcOrganLoad(base({ satFatG: 0, omega6Mg: 1000 }));
    const withSat = calcOrganLoad(base({ satFatG: 21, omega6Mg: 1000 }));
    expect(noSat.cardiovascular.score).toBeLessThan(withSat.cardiovascular.score);
  });
});

describe('calcOrganLoad: Ω6/3', () => {
  it('без омега-6 соотношение не выдумывается', () => {
    expect(calcOrganLoad(base()).cardiovascular.omegaRatio).toBeNull();
  });

  it('с омега-6 считается по факту', () => {
    expect(calcOrganLoad(base({ omega6Mg: 8000, omega3Mg: 1000 })).cardiovascular.omegaRatio).toBe(8);
  });
});

describe('calcOrganLoad: профиль', () => {
  it('высокая ЦНС-нагрузка не называется «остеогенным» профилем', () => {
    // Сахар 300 г при нулевой клетчатке → максимум по ЦНС/эндокринной,
    // а кости далеко не первые. Раньше условие `i >= 7` вешало «остеогенный».
    const r = calcOrganLoad(base({ carbsG: 300, sugarG: 300, fiberG: 0, proteinG: 20, fatG: 10 }));
    expect(r.cns.score).toBeGreaterThan(r.bones.score);
    expect(r.metabolicProfile).not.toContain('Остеогенный');
  });
});

describe('calcOrganLoad: состояния', () => {
  it('камни в почках — не ХБП: без белкового множителя 1.8', () => {
    const plain = calcOrganLoad(base());
    const stones = calcOrganLoad(base({ conditions: ['kidney_stones'] }));
    const ckd = calcOrganLoad(base({ conditions: ['ckd'] }));
    expect(stones.kidneys.score).toBeLessThan(ckd.kidneys.score);
    expect(stones.kidneys.score).toBeGreaterThanOrEqual(plain.kidneys.score);
    expect(stones.kidneys.advice).toContain('Камни в почках');
  });

  it('подагра поднимает печёночную нагрузку (фруктоза/ураты)', () => {
    const plain = calcOrganLoad(base());
    const gout = calcOrganLoad(base({ conditions: ['gout'] }));
    expect(gout.liver.score).toBeGreaterThan(plain.liver.score);
  });
});

describe('calcOrganLoad: PRAL из минералов плана', () => {
  it('мало кальция — выше нагрузка на кости', () => {
    const lowCa = calcOrganLoad(base({ calciumMg: 300 }));
    const highCa = calcOrganLoad(base({ calciumMg: 2000 }));
    expect(highCa.bones.score).toBeLessThan(lowCa.bones.score);
  });
});

describe('история нагрузок', () => {
  beforeEach(() => clearOrganLoadHistory());

  it('одна запись на календарный день (последнее состояние)', () => {
    saveOrganLoadHistory(base());
    saveOrganLoadHistory(base({ proteinG: 180 }));
    const history = loadOrganLoadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].input.proteinG).toBe(180);
  });
});
