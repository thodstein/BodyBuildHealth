/**
 * planner-micro-rda-canon.test.ts — §4.5 «RDA-сведение» (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md).
 *
 * Дефект: числовой канон норм микронутриентов был РАЗДВОЕН — движок
 * (`RDA_TARGETS` в meal-plan-engine: Fe 18, Mg 400, Zn 15, VitC 100 …) и отчёт
 * покрытия (`RDA_BASE` в planner-micro-coverage: sex-aware Fe 8/18, Zn 11/8,
 * VitC 90/75, Mg 420/320 …) спорили об одном дне: ноты требовали «закройте
 * дефицит Fe» при 7/8 мг = 88% по отчёту, и наоборот.
 *
 * Решение: единый источник — `RDA_BASE`; движок считает норму sex-aware через
 * `rdaFor(key, sex)` (оба потребителя: closeFoodDeficiencies и
 * activelyCloseTopDeficiency). Лок: структурный паритет для всех заявленных
 * нутриентов + поведенческий (нота на реальном дне берёт норму из канона пола).
 */
import { describe, it, expect } from 'vitest';
import { RDA_BASE } from '../planner-micro-coverage';
import { buildDayPlan, _rdaForForTest } from '../meal-plan-engine';

const DAY_KEYS = ['Fe', 'Mg', 'Zn', 'K', 'Ca', 'Omega3', 'Se', 'VitC', 'VitD', 'VitB12', 'VitB9'];

describe('§4.5 RDA-канон единый: движок = отчёт покрытия', () => {
  it('RDA_BASE — sex-aware по всем заявленным нутриентам', () => {
    const keys = Object.keys(RDA_BASE);
    expect(keys.length).toBeGreaterThanOrEqual(16);
    // Исторические якоря (AGENTS: RDA-канон покрытия согласован).
    expect(RDA_BASE.Fe.male).toBe(8);
    expect(RDA_BASE.Fe.female).toBe(18);
    expect(RDA_BASE.Zn.male).toBe(11);
    expect(RDA_BASE.Zn.female).toBe(8);
    expect(RDA_BASE.VitC.male).toBe(90);
    expect(RDA_BASE.VitC.female).toBe(75);
    expect(RDA_BASE.Mg.male).toBe(420);
    expect(RDA_BASE.Mg.female).toBe(320);
    expect(RDA_BASE.Omega3.male).toBe(1600);
    expect(RDA_BASE.Omega3.female).toBe(1100);
    for (const [k, v] of Object.entries(RDA_BASE)) {
      expect(v.male, k).toBeGreaterThan(0);
      expect(v.female, k).toBeGreaterThan(0);
    }
  });

  it('движок считает норму из RDA_BASE (структурный паритет)', () => {
    for (const k of DAY_KEYS) {
      expect(_rdaForForTest(k, 'male'), k).toBe(RDA_BASE[k].male);
      expect(_rdaForForTest(k, 'female'), k).toBe(RDA_BASE[k].female);
      // 'other' трактуется как male (историческое поведение поля sex).
      expect(_rdaForForTest(k, 'other'), k).toBe(RDA_BASE[k].male);
    }
  });

  it('нота «Дефицит Fe» на дне женщины берёт норму 18 (не мужские 8)', () => {
    // Профиль из замера: female 1400 cut даёт «Дефицит Fe … (10/18 мг)».
    const p = buildDayPlan({
      weightKg: 52, lbmKg: 40, bodyFatPct: 15, sex: 'female' as const,
      goalKcal: 1400, goalProteinG: 120, goalFatG: 50, goalCarbsG: 135,
      mealsCount: 5, isTrainingDay: false, budget: 'medium' as const, dayOffset: 0,
      cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
      quality: 'full' as const, randomSalt: 0, carbCapGPerKg: 0,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00', goal: 'cut',
    } as any);
    const feNotes = (p.notes as string[]).filter(n => /Дефицит Fe/.test(n));
    expect(feNotes.length, 'ожидали ноту дефицита Fe в профиле').toBeGreaterThan(0);
    const m = feNotes[0].match(/\(([\d.]+)\/([\d.]+) (?:мг|мкг)\)/);
    expect(m, feNotes[0]).toBeTruthy();
    expect(Number(m![2]), `нота: ${feNotes[0]}`).toBe(RDA_BASE.Fe.female);
  });
});
