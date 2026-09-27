/**
 * planner-wave1-extreme-kbj2.test.ts — Волна 1: экстремальные КБЖУ (1500г У / 500г Б).
 */
import { describe, it, expect } from 'vitest';
import {
  selectHvCarbCarriers,
  scalePortionCapsForExtreme,
  hvProteinCapPerMeal,
  autoMealCountForHv,
  HV_CARB_CARRIERS,
} from '../planner-carb-density';

describe('Wave 1: selectHvCarbCarriers', () => {
  it('возвращает носители для экстремального дня (1500г У)', () => {
    const sel = selectHvCarbCarriers(1500, 120, { mealsCount: 10 });
    expect(sel.carriers.length).toBeGreaterThanOrEqual(8);
    expect(sel.totalCapacity).toBeGreaterThan(1500);
  });

  it('чередует жидкие и твёрдые носители', () => {
    const sel = selectHvCarbCarriers(1200, 100, { mealsCount: 8 });
    expect(sel.liquidCarriers.length).toBeGreaterThan(0);
    expect(sel.solidCarriers.length).toBeGreaterThan(0);
  });

  it('учитывает квоты семейств (не более 3-4 приёмов на семейство)', () => {
    const sel = selectHvCarbCarriers(1500, 120, { mealsCount: 10 });
    const famCounts = new Map<string, number>();
    for (const c of sel.carriers) {
      const fam = getFamily(c.id);
      famCounts.set(fam, (famCounts.get(fam) || 0) + 1);
    }
    for (const [, count] of famCounts) {
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('не повторяет носители из recentCarrierIds в первых приёмах', () => {
    const recent = new Set(['rice_white', 'oats_dry']);
    const sel = selectHvCarbCarriers(1200, 100, { mealsCount: 8, recentCarrierIds: recent });
    expect(sel.carriers[0].id).not.toBe('rice_white');
    expect(sel.carriers[0].id).not.toBe('oats_dry');
  });

  it('все носители имеют положительную плотность углеводов', () => {
    for (const c of HV_CARB_CARRIERS) {
      expect(c.carbPer100).toBeGreaterThan(0);
      expect(c.portionCap).toBeGreaterThan(0);
    }
  });
});

describe('Wave 1: scalePortionCapsForExtreme', () => {
  it('возвращает null для обычных дней', () => {
    expect(scalePortionCapsForExtreme(2500, 300, 180)).toBeNull();
  });

  it('масштабирует квоты для экстримальных дней', () => {
    const scaled = scalePortionCapsForExtreme(8000, 1500, 500);
    expect(scaled).not.toBeNull();
    expect(scaled!.oil).toBeGreaterThan(15);
    expect(scaled!.nuts).toBeGreaterThan(60);
  });

  it('ограничивает масштаб потолком 1.5', () => {
    const scaled = scalePortionCapsForExtreme(15000, 3000, 1000);
    expect(scaled).not.toBeNull();
    expect(scaled!.oil).toBeLessThanOrEqual(23);
    expect(scaled!.nuts).toBeLessThanOrEqual(90);
  });
});

describe('Wave 1: hvProteinCapPerMeal', () => {
  it('возвращает разумный кап для обычного белка', () => {
    const cap = hvProteinCapPerMeal(180, 5, 80);
    expect(cap).toBeGreaterThanOrEqual(36);
    expect(cap).toBeLessThanOrEqual(50);
  });

  it('увеличивает кап для экстремального белка', () => {
    const cap = hvProteinCapPerMeal(500, 10, 120);
    expect(cap).toBeGreaterThan(50);
    expect(cap).toBeLessThanOrEqual(350);
  });

  it('учитывает вес атлета', () => {
    const cap80 = hvProteinCapPerMeal(200, 5, 80);
    const cap120 = hvProteinCapPerMeal(200, 5, 120);
    expect(cap120).toBeGreaterThan(cap80);
  });
});

describe('Wave 1: autoMealCountForHv', () => {
  it('возвращает базовое число приёмов для обычных дней', () => {
    expect(autoMealCountForHv(300, 180, 80, 5)).toBe(5);
  });

  it('расширяет приёмы для HV-дней (1500г У)', () => {
    const count = autoMealCountForHv(1500, 400, 120, 5);
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(12);
  });

  it('расширяет приёмы для HV-дней (500г Б)', () => {
    const count = autoMealCountForHv(800, 500, 120, 5);
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it('ограничивает максимум 12 приёмами', () => {
    const count = autoMealCountForHv(3000, 1000, 200, 5);
    expect(count).toBeLessThanOrEqual(12);
  });
});

function getFamily(id: string): string {
  if (/rice|cream_of_rice/.test(id)) return 'rice';
  if (/oats/.test(id)) return 'oats';
  if (/buckwheat/.test(id)) return 'buckwheat';
  if (/quinoa/.test(id)) return 'quinoa';
  if (/bulgur/.test(id)) return 'bulgur';
  if (/millet/.test(id)) return 'millet';
  if (/barley/.test(id)) return 'barley';
  if (/potato|sweet_potato/.test(id)) return 'potato';
  if (/bread/.test(id)) return 'bread';
  if (/dates|raisins|dried_apricots|dried_banana/.test(id)) return 'dried_fruit';
  if (/honey|jam|marmalade|zefir|pastila/.test(id)) return 'sweets';
  if (/juice|dextrose|isoton/.test(id)) return 'liquid';
  if (/flakes|cookies|pryaniki|sushki/.test(id)) return 'bake';
  return 'other';
}
