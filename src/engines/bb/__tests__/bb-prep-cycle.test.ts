/**
 * bb-prep-cycle.test.ts — Prep-цикл: сборка, фазы, акцент/минимум, режимы, тапер.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPrepCycle, validatePrepCycle, recommendMinimalMode, normalizePrepCycle,
  accentToContestSpec, type PrepCycleConfig,
} from '../bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../bb-builder.engine';
import type { BBContestCategory } from '../bb-contest-prep.engine';

const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

function base(overrides: Partial<PrepCycleConfig> = {}): PrepCycleConfig {
  return {
    category: 'mens_physique',
    sex: 'male',
    accentMuscles: ['shoulders', 'back'],
    minimalMuscles: ['quads', 'arms'],
    weeks: 12,
    taperWeeks: 3,
    showDate: '2027-03-01',
    level: 'intermediate',
    trainingYears: 4,
    equipment: EQ,
    workMax: { ...DEFAULT_WORKMAX },
    enhanced: false,
    weightKg: 82,
    experienceLevel: 'intermediate',
    ...overrides,
  };
}

describe('bb-prep-cycle: валидация', () => {
  it('валидная конфигурация проходит', () => {
    const v = validatePrepCycle(base());
    expect(v.errors).toEqual([]);
  });

  it('длительность вне 4-26 — ошибка', () => {
    expect(validatePrepCycle(base({ weeks: 3 })).errors.length).toBeGreaterThan(0);
    expect(validatePrepCycle(base({ weeks: 27 })).errors.length).toBeGreaterThan(0);
  });

  it('тапер вне 1-4 — ошибка', () => {
    expect(validatePrepCycle(base({ taperWeeks: 0 })).errors.length).toBeGreaterThan(0);
    expect(validatePrepCycle(base({ taperWeeks: 5 })).errors.length).toBeGreaterThan(0);
  });

  it('цикл должен оставлять минимум 1 нед подготовки после тапера', () => {
    expect(validatePrepCycle(base({ weeks: 4, taperWeeks: 4 })).errors.length).toBeGreaterThan(0);
  });

  it('битая дата — ошибка', () => {
    expect(validatePrepCycle(base({ showDate: '01-03-2027' })).errors.length).toBeGreaterThan(0);
  });

  it('категория не по полу — ошибка', () => {
    expect(validatePrepCycle(base({ category: 'bikini', sex: 'male' })).errors.length).toBeGreaterThan(0);
  });
});

describe('bb-prep-cycle: рекомендация режима минимальной нагрузки', () => {
  it('без минимальных мышц — none', () => {
    const r = recommendMinimalMode(base({ minimalMuscles: [] }));
    expect(r.mode).toBe('none');
  });

  it('натурал лёгкой категории — MEV-флор', () => {
    const r = recommendMinimalMode(base({ category: 'bikini', sex: 'female', enhanced: false, trainingYears: 1 }));
    expect(r.mode).toBe('reduce_direct_to_floor');
  });

  it('массовый дивизион на курсе — полное исключение', () => {
    const r = recommendMinimalMode(base({ category: 'mens_bb', enhanced: true, trainingYears: 5 }));
    expect(r.mode).toBe('remove_direct_when_indirect_covers_floor');
  });

  it('массовый дивизион с большим стажем — полное исключение', () => {
    const r = recommendMinimalMode(base({ category: 'womens_bb', sex: 'female', enhanced: false, trainingYears: 6 }));
    expect(r.mode).toBe('remove_direct_when_indirect_covers_floor');
  });
});

describe('bb-prep-cycle: normalizePrepCycle', () => {
  it('кламп недель/тапера и исключение пересечения акцента с минимумом', () => {
    const n = normalizePrepCycle(base({ accentMuscles: ['back'], minimalMuscles: ['back', 'legs'] }));
    expect(n.minimalMuscles).not.toContain('back');
    expect(n.minimalMuscles).toContain('quads');
  });
});

describe('bb-prep-cycle: сборка', () => {
  it('строит план 12 нед с фазами prep/taper/peak и датой шоу', () => {
    const r = buildPrepCycle(base());
    expect(r.bbPlan.weeks.length).toBe(12);
    expect(r.prepWeeks).toBe(8); // 12 - 3 taper - 1 peak
    expect(r.taperWeeks).toBe(3);
    // каждая неделя размечена prep-фазой
    const phases = r.bbPlan.weeks.map((w: any) => w.contestPhase);
    expect(phases).toContain('preparation');
    expect(phases).toContain('taper');
    expect(phases).toContain('peak_week');
    // prepPlan фазы покрывают цикл, show_day на дату шоу
    const show = r.prepPlan.phases.find(p => p.key === 'show_day');
    expect(show?.dateStart).toBe('2027-03-01');
  });

  it('акцент попадает в primaryTargets расписания', () => {
    const r = buildPrepCycle(base({ accentMuscles: ['chest', 'biceps'] }));
    expect(r.specializationSchedule.primaryTargets).toContain('chest');
  });

  it('минимальные мышцы — доноры tradeoff в акцент-блоке', () => {
    const r = buildPrepCycle(base({ minimalMuscles: ['legs', 'arms'] }));
    const accentBlock = r.specializationSchedule.blocks.find(b => b.targets.length > 0);
    expect(accentBlock?.tradeoff?.donorMuscles).toEqual(expect.arrayContaining(['quads', 'biceps']));
    expect(accentBlock?.tradeoff?.preserveIndirect).toBe(true);
  });

  it('минимальный режим remove применяется при выборе', () => {
    const r = buildPrepCycle(base({ minimalMuscles: ['quads'], minimalMode: 'remove_direct_when_indirect_covers_floor' }));
    const accentBlock = r.specializationSchedule.blocks.find(b => b.targets.length > 0);
    expect(accentBlock?.tradeoff?.mode).toBe('remove_direct_when_indirect_covers_floor');
  });

  it('женская bikini: акцент glutes и glute-сплит', () => {
    const r = buildPrepCycle(base({
      category: 'bikini', sex: 'female',
      accentMuscles: ['glutes'], minimalMuscles: ['quads'],
    }));
    expect(r.config.accentMuscles).toContain('glutes');
  });

  it('длинный цикл 26 нед строится без ошибок', () => {
    const r = buildPrepCycle(base({ weeks: 26, taperWeeks: 4 }));
    expect(r.bbPlan.weeks.length).toBe(26);
    expect(r.prepWeeks).toBe(21);
  });

  it('короткий цикл 6 нед предупреждает о малой подготовке', () => {
    const r = buildPrepCycle(base({ weeks: 6, taperWeeks: 2 }));
    expect(r.prepWeeks).toBe(3);
    expect(r.warnings.some(w => /коротк/.test(w))).toBe(true);
  });

  it('все мужские и женские категории строятся (smoke)', () => {
    const male: BBContestCategory[] = ['mens_physique', 'classic_physique', 'mens_bb', 'bb_212'];
    const female: BBContestCategory[] = ['bikini', 'figure', 'wellness', 'womens_physique', 'womens_bb'];
    for (const c of male) {
      const r = buildPrepCycle(base({ category: c, sex: 'male', weeks: 10 }));
      expect(r.bbPlan.weeks.length).toBe(10);
    }
    for (const c of female) {
      const r = buildPrepCycle(base({ category: c, sex: 'female', weeks: 10 }));
      expect(r.bbPlan.weeks.length).toBe(10);
    }
  });
});

describe('bb-prep-cycle: accentToContestSpec', () => {
  it('маппит акцент в специализацию тапера', () => {
    expect(accentToContestSpec(['chest'])).toBe('chest');
    expect(accentToContestSpec(['glutes'])).toBe('glutes');
    expect(accentToContestSpec(['biceps'])).toBe('arms');
    expect(accentToContestSpec([])).toBe('none');
  });
});
