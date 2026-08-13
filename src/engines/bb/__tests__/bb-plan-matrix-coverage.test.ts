import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { classifyBackExercise } from '../bb-back-quality.engine';

const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45 };

/** Остаток тестовой матрицы Этапа 11: недельный back-бюджет, arms indirect,
 *  малые группы во всех сплитах. */
describe('BB test matrix coverage (Этап 11)', () => {
  it('experienced enhanced, 2 back sessions: недельный back budget >= 36 (direct)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const direct = plan.weeklyVolume?.[1]?.back?.directSets ?? 0;
    expect(direct).toBeGreaterThanOrEqual(36);
  });

  it('arms: прямые сеты редуцируются при большом indirect от тяг/жимов', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const backRotation = plan.rotationMuscleVolume?.back || 0;
    const bicepsDirect = plan.weeklyVolume?.[1]?.biceps?.directSets ?? 0;
    const tricepsDirect = plan.weeklyVolume?.[1]?.triceps?.directSets ?? 0;
    // 46 тяг × 0.4 = ~18 косвенных; прямые сеты не должны дублировать их сверху
    // (верхняя граница: не более ~30% от объёма тяг/жимов).
    expect(bicepsDirect).toBeLessThanOrEqual(Math.max(6, Math.round(backRotation * 0.3)));
    expect(tricepsDirect).toBeLessThanOrEqual(Math.max(6, Math.round(backRotation * 0.2)));
    // Эффективный объём рук не превышает фактический кап.
    expect((plan.weeklyVolume?.[1]?.biceps?.effectiveSets ?? 0)).toBeLessThanOrEqual((plan.mrvByMuscle?.biceps || 0) * 1.15);
    expect((plan.weeklyVolume?.[1]?.triceps?.effectiveSets ?? 0)).toBeLessThanOrEqual((plan.mrvByMuscle?.triceps || 0) * 1.15);
  });

  it.each(['upper_lower_4', 'ppl_6', 'fullbody_3', 'arnold_6', 'pro_8_day'] as const)(
    'малые группы (calves/abs/traps/forearms) покрыты в %s',
    (patternId) => {
      const plan = buildBBPlan({ patternId, level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
      const vol = plan.weeklyVolume?.[1] || {};
      for (const m of ['calves', 'abs', 'traps', 'forearms']) {
        expect((vol[m]?.directSets ?? 0) > 0, `${patternId}: ${m} не покрыт`).toBe(true);
      }
    },
  );

  it('natural не получает enhanced-лимиты и не превышает natural caps', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    const ovf = plan.rationale.filter(r => r.includes('> MRV'));
    expect(ovf).toHaveLength(0);
    const vol = plan.weeklyVolume?.[1] || {};
    // natural: back effective в пределах MRV (без стажевых бустов).
    expect((vol.back?.effectiveSets ?? 0)).toBeLessThanOrEqual(24 * 1.15);
  });
});
