/**
 * planner-extreme-capacity.test.ts — §3A EXTREME-SCALE (NUTRITION-EXTREME-SCALE-PRO-PLAN).
 * Профиль ёмкости: активируется только на инсулин/≥8 г/кг/≥1200 г/≥7000 ккал днях,
 * обычные дни и HV 600–1000 г без инсулина остаются на прежних капах (байт-в-байт).
 */
import { describe, it, expect } from 'vitest';
import { extremeCapacityProfile, edibilityCapFor } from '../planner-carb-density';

describe('§3A extreme capacity profile', () => {
  it('обычный день (3000 ккал, 340У) — профиль не активен, капы прежние', () => {
    const p = extremeCapacityProfile({ carbsG: 340, weightKg: 90, goalKcal: 3000 });
    expect(p.active).toBe(false);
    expect(p.plateMult).toBe(1);
    expect(p.dryGrainCap).toBe(170);
    expect(p.recipePlate).toBe(730);
  });

  it('HV без инсулина (800У/110кг = 7.3 г/кг) — калибровки не трогаем', () => {
    const p = extremeCapacityProfile({ carbsG: 800, weightKg: 110, goalKcal: 5500, highVolumeDay: true });
    expect(p.active).toBe(false);
  });

  it('инсулин активирует (мягкий тир 1.15); 1500У/120кг+120 ЕД — экстрим (1.3)', () => {
    const mild = extremeCapacityProfile({ insulinUnits: 10, carbsG: 500, weightKg: 110, goalKcal: 4000, highVolumeDay: true });
    expect(mild.active).toBe(true);
    expect(mild.plateMult).toBe(1.15);
    expect(mild.dryGrainCap).toBe(200);

    const ext = extremeCapacityProfile({ insulinUnits: 120, carbsG: 1500, weightKg: 120, goalKcal: 8600, highVolumeDay: true });
    expect(ext.active).toBe(true);
    expect(ext.plateMult).toBe(1.3);
    expect(ext.recipePlate).toBe(900);
    expect(ext.dryGrainCap).toBe(240);
    expect(ext.edibilityMult).toBe(1.3);
  });

  it('≥8 г/кг без инсулина (900У/110кг) — экстрим-тир', () => {
    const p = extremeCapacityProfile({ carbsG: 900, weightKg: 110, goalKcal: 5500, highVolumeDay: true });
    expect(p.active).toBe(true);
    expect(p.plateMult).toBe(1.3);
  });

  it('edibilityCapFor: множитель расширяет только углеводные носители', () => {
    expect(edibilityCapFor('rice_white', 600, 1.3)).toBe(585);      // 450×1.3
    expect(edibilityCapFor('bread_white', 600, 1.3)).toBe(215);     // 165×1.3
    expect(edibilityCapFor('chicken_breast', 600, 1.3)).toBe(300);  // мясо не растёт
    expect(edibilityCapFor('egg_whole', 600, 1.3)).toBe(275);       // яйца не растут
    expect(edibilityCapFor('rice_white', 600, 1)).toBe(450);        // без профиля — прежний кап
    expect(edibilityCapFor('unknown_food', 250, 1.3)).toBe(250);    // нет записи — fallback
  });
});
