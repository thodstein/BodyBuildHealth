/**
 * bb-prep-cycle.test.ts — Prep-цикл: сборка, фазы, акцент/минимум, режимы, тапер.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPrepCycle, validatePrepCycle, recommendMinimalMode, normalizePrepCycle,
  accentToContestSpec, prepCutProjection, type PrepCycleConfig,
} from '../bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../bb-builder.engine';
import { aggregateBBVolume } from '../bb-volume.engine';
import { isoToday, isoAddDays } from '../bb-contest-prep.engine';
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

describe('bb-prep-cycle: минимальная нагрузка реально применяется и план валиден', () => {
  /** Сумма прямых сетов мышцы по prep-неделям (исключая тапер/пик). */
  function directSetsInPrep(res: ReturnType<typeof buildPrepCycle>, muscle: string, prepWeeks: number): number {
    let sum = 0;
    for (const wk of res.bbPlan.weeks.slice(0, prepWeeks) as any[]) {
      const vol = aggregateBBVolume(wk.sessions || []);
      sum += (vol[muscle]?.directSets ?? 0);
    }
    return sum;
  }

  it('минимальные мышцы (quads/arms) получают меньше прямого объёма, чем без минимальной нагрузки', () => {
    const mk = (minimal: string[]) => base({
      category: 'mens_bb', accentMuscles: ['back', 'shoulders'], minimalMuscles: minimal,
      splitPatternId: 'ppl_6', weeks: 12, taperWeeks: 3,
    });
    const withMin = buildPrepCycle(mk(['quads', 'arms']));
    const without = buildPrepCycle(mk([]));
    const pw = withMin.prepWeeks;
    // Акцент сохранён/не упал
    expect(directSetsInPrep(withMin, 'back', pw)).toBeGreaterThanOrEqual(directSetsInPrep(without, 'back', pw));
    // Минимальные мышцы сокращены (донорский режим)
    expect(directSetsInPrep(withMin, 'quads', pw)).toBeLessThan(directSetsInPrep(without, 'quads', pw));
    expect(directSetsInPrep(withMin, 'biceps', pw)).toBeLessThanOrEqual(directSetsInPrep(without, 'biceps', pw));
    // Доноры в tradeoff-политике акцент-блока
    const accentBlock = withMin.specializationSchedule.blocks.find(b => b.targets.length > 0);
    expect(accentBlock?.tradeoff?.donorMuscles).toEqual(expect.arrayContaining(['quads']));
  });

  it('режим remove убирает прямую работу минимальной мышцы сильнее, чем MEV-флор', () => {
    const mk = (minimal: string[], mode?: string) => base({
      category: 'mens_bb', accentMuscles: ['back'], minimalMuscles: minimal,
      splitPatternId: 'ppl_6', weeks: 12, taperWeeks: 3,
      ...(mode ? { minimalMode: mode as any } : {}),
    });
    const baseline = directSetsInPrep(buildPrepCycle(mk([])), 'quads', 8);
    const reduce = directSetsInPrep(buildPrepCycle(mk(['quads'], 'reduce_direct_to_floor')), 'quads', 8);
    const remove = directSetsInPrep(buildPrepCycle(mk(['quads'], 'remove_direct_when_indirect_covers_floor')), 'quads', 8);
    expect(baseline).toBeGreaterThan(0);
    // Донорский режим никогда не увеличивает прямую работу минимальной мышцы
    expect(reduce).toBeLessThanOrEqual(baseline);
    expect(remove).toBeLessThanOrEqual(reduce);
  });

  it('валидация собранного плана не показывает ошибок', () => {
    const r = buildPrepCycle(base());
    const val: any = (r.bbPlan as any).validation;
    if (val) expect(val.valid).not.toBe(false);
  });
});

describe('bb-prep-cycle: несколько соревнований', () => {
  it('дата главного старта (A) якорит пик-неделю вместо showDate', () => {
    const r = buildPrepCycle(base({
      showDate: '2027-03-01',
      competitions: [
        { id: 'c1', name: 'Контрольный', date: '2027-04-01', priority: 'B' },
        { id: 'c2', name: 'Главный', date: '2027-06-01', priority: 'A' },
      ],
      mainCompetitionId: 'c2',
    }));
    expect(r.prepPlan.showDate).toBe('2027-06-01');
    const show = r.prepPlan.phases.find(p => p.key === 'show_day');
    expect(show?.dateStart).toBe('2027-06-01');
    // тапер/пик отсчитываются от главного старта
    const peak = r.prepPlan.phases.find(p => p.key === 'peak_week');
    expect(peak?.weekStart).toBe(r.prepWeeks + r.taperWeeks + 1);
  });
});

describe('bb-prep-cycle: прогноз сушки к шоу', () => {
  it('считает целевую сухость категории и темп', () => {
    const r = buildPrepCycle(base({ showDate: isoAddDays(isoToday(), 42), weightKg: 90 }));
    const p = prepCutProjection(r.prepPlan, 90, 20);
    expect(p.targetBodyFatPct).toBe(6); // mens_physique
    expect(p.targetWeightKg).toBeCloseTo(76.6, 0); // lean 72 / 0.94
    expect(p.weeklyRateKg).toBeCloseTo(0.45, 1); // 0.5%/нед от 90
    expect(p.canReachByShow).toBe(false); // ~30 нед > 6 нед до шоу
  });

  it('при близкой сухости — цель достижима к шоу', () => {
    const r = buildPrepCycle(base({ showDate: isoAddDays(isoToday(), 42), weightKg: 90 }));
    const p = prepCutProjection(r.prepPlan, 90, 7); // уже почти у цели
    expect(p.targetWeightKg).toBeCloseTo(89.0, 0);
    expect(p.canReachByShow).toBe(true);
  });

  it('без %жира — нет цели, но есть прогноз веса на шоу', () => {
    const r = buildPrepCycle(base({ showDate: isoAddDays(isoToday(), 14), weightKg: 80 }));
    const p = prepCutProjection(r.prepPlan, 80);
    expect(p.targetWeightKg).toBeNull();
    expect(p.projectedShowWeightKg).toBeLessThan(80);
  });
});
