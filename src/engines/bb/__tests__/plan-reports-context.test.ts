import { describe, expect, it } from 'vitest';
import { validatePlan } from '../../plan-validator';
import { validatePlanQuality, bbPlanToQualityInput } from '../../plan-quality.engine';

const PLAN = {
  pattern: {} as any,
  weeks: [{
    week: 1,
    sessions: [{
      day: 1, weekOffset: 1, character: 'тяж',
      exercises: [
        { muscle: 'back', name: 'Тяга штанги', role: 'primary', sets: 46, repsRange: [6, 8], rir: 2, workSets: [] },
        { muscle: 'chest', name: 'Жим лёжа', role: 'primary', sets: 30, repsRange: [6, 8], rir: 2, workSets: [] },
      ],
    }],
  }],
  rotationMuscleVolume: {},
  rationale: [],
  mrvByMuscle: { back: 70, chest: 45 },
};

describe('plan-validator с фактическими капами', () => {
  it('не выдаёт ложный MRV-overflow для enhanced-капов (стаж 6 лет, PED ×1.3)', () => {
    const ws = { back: 46, chest: 30 };
    const banners = validatePlan({ weeklySets: ws, level: 'enhanced', goal: 'mass', daysPerWeek: 4, weakPoints: [], trainingYears: 6, mrvMultiplier: 1.3, mrvByMuscle: { back: 70, chest: 45 } });
    const errors = banners.filter(b => b.level === 'error' && b.category === 'mrv');
    expect(errors).toHaveLength(0);
  });

  it('выдаёт error когда фактический кап превышен', () => {
    const ws = { back: 80 };
    const banners = validatePlan({ weeklySets: ws, level: 'enhanced', goal: 'mass', daysPerWeek: 4, weakPoints: [], trainingYears: 6, mrvMultiplier: 1.3, mrvByMuscle: { back: 70 } });
    const err = banners.find(b => b.category === 'mrv' && b.level === 'error');
    expect(err).toBeDefined();
    expect(err!.title).toContain('80 > 70');
  });

  it('добавляет контекстный комментарий о параметрах пользователя', () => {
    const ws = { back: 46 };
    const banners = validatePlan({ weeklySets: ws, level: 'enhanced', goal: 'mass', daysPerWeek: 4, weakPoints: [], trainingYears: 6, mrvMultiplier: 1.3, mrvByMuscle: { back: 70 } });
    const mav = banners.find(b => b.title.includes('выше MAV'));
    expect(mav).toBeDefined();
    expect(mav!.detail).toContain('Фактический MRV 70');
    expect(mav!.detail).toContain('стаж 6 лет');
  });

  it('fallback на landmarks без mrvByMuscle (обратная совместимость)', () => {
    const ws = { back: 46 };
    const banners = validatePlan({ weeklySets: ws, level: 'enhanced', goal: 'mass', daysPerWeek: 4, weakPoints: [] });
    const err = banners.find(b => b.category === 'mrv' && b.level === 'error');
    expect(err).toBeDefined(); // 46 > 32 (базовый MRV enhanced)
  });
});

describe('plan-quality с фактическими капами', () => {
  it('масштабирует MEV/MAV/MRV от фактического капа и не считает перегруз', () => {
    const input = bbPlanToQualityInput(PLAN as any, { level: 'enhanced', trainingYears: 6, pedMultiplier: 1.3 });
    const result = validatePlanQuality(input);
    const back = result.muscles.find(m => m.muscle === 'back')!;
    expect(back.mrv).toBe(70);
    expect(back.mav).toBeGreaterThan(46); // 46 сетов в зоне MAV
    expect(back.status).toBe('in_mav');
    expect(back.contextNote).toContain('стаж 6 лет');
    expect(back.contextNote).toContain('×1.30');
    expect(result.issues.some(i => i.id === 'vol_over_back')).toBe(false);
  });

  it('помечает реальный перегруз как critical', () => {
    const plan = {
      ...PLAN,
      mrvByMuscle: { back: 70, chest: 45 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{ muscle: 'back', name: 'Тяга', role: 'primary', sets: 90, repsRange: [6, 8], rir: 2, workSets: [] }] }] }],
    };
    const input = bbPlanToQualityInput(plan as any, { level: 'enhanced' });
    const result = validatePlanQuality(input);
    const back = result.muscles.find(m => m.muscle === 'back')!;
    expect(back.status).toBe('exceeding_mrv');
    expect(result.issues.some(i => i.id === 'vol_over_back' && i.severity === 'critical')).toBe(true);
  });

  it('обратная совместимость: без mrvByMuscle — табличные пороги', () => {
    const result = validatePlanQuality({ dayGroups: [['back']], weeklySets: { back: 46 }, frequency: { back: 2 }, level: 'enhanced' });
    const back = result.muscles.find(m => m.muscle === 'back')!;
    expect(back.mrv).toBe(34); // VOLUME_THRESHOLDS.enhanced.big.mrv
    expect(back.status).toBe('exceeding_mrv');
  });
});
