/**
 * bb-prep-cycle.test.ts — Prep-цикл: сборка, фазы, акцент/минимум, режимы, тапер.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPrepCycle, validatePrepCycle, recommendMinimalMode, normalizePrepCycle,
  accentToContestSpec, prepCutProjection, buildPrepSeason, posingPlanForCategory,
  savePosingCheckin, getPosingCheckins, posingWeekStats, prepCardioPlan,
  prepVolumePlan, prepDeficitMult, prepAthleteMult, prepRecoveryMult, prepVolumePhaseForWeek,
  type PrepCycleConfig, type PrepSeasonConfig,
} from '../bb-prep-cycle.engine';
import { buildBBPlan, DEFAULT_WORKMAX } from '../bb-builder.engine';
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

describe('bb-prep-cycle: сезон (несколько стартов)', () => {
  function seasonCfg(comps: Array<{ id: string; date: string; name: string; priority?: 'A' | 'B' | 'C' }>): PrepSeasonConfig {
    const b = base();
    return {
      category: b.category, sex: b.sex,
      accentMuscles: b.accentMuscles, minimalMuscles: b.minimalMuscles, minimalMode: b.minimalMode,
      splitPatternId: b.splitPatternId,
      level: b.level, trainingYears: b.trainingYears, equipment: b.equipment, workMax: b.workMax,
      enhanced: b.enhanced, weightKg: b.weightKg, experienceLevel: b.experienceLevel,
      competitions: comps, prepWeeksPerComp: 8, taperWeeks: 2,
    };
  }

  it('строит по циклу на каждый старт, каждый якорится к своей дате', () => {
    const r = buildPrepSeason(seasonCfg([
      { id: 'c1', date: '2027-03-01', name: 'Весенний', priority: 'B' },
      { id: 'c2', date: '2027-06-01', name: 'Главный', priority: 'A' },
      { id: 'c3', date: '2027-09-15', name: 'Финал', priority: 'C' },
    ]));
    expect(r.cycles.length).toBe(3);
    expect(r.summary.length).toBe(3);
    // порядок по дате
    expect(r.summary[0].date).toBe('2027-03-01');
    expect(r.summary[1].date).toBe('2027-06-01');
    expect(r.summary[2].date).toBe('2027-09-15');
    // каждый цикл якорится к своей дате шоу и имеет свой главный старт
    expect(r.cycles[0].prepPlan.showDate).toBe('2027-03-01');
    expect(r.cycles[1].prepPlan.showDate).toBe('2027-06-01');
    expect(r.cycles[2].prepPlan.showDate).toBe('2027-09-15');
    expect(r.cycles[1].config.mainCompetitionId).toBe('c2');
    // суммарные недели = prep+taper+1
    expect(r.cycles[0].bbPlan.weeks.length).toBe(8 + 2 + 1);
  });

  it('слишком близкие старты — подготовка усекается с предупреждением', () => {
    const r = buildPrepSeason(seasonCfg([
      { id: 'c1', date: '2027-03-01', name: 'A' },
      { id: 'c2', date: '2027-04-01', name: 'B' }, // ~4 нед после A
    ]));
    // второй: gap ~4 нед → prep = 4 - 2 taper - 1 = 1 нед
    expect(r.summary[1].prepWeeks).toBeLessThanOrEqual(1);
    expect(r.warnings.some(w => /усечен/.test(w))).toBe(true);
  });
});

describe('bb-prep-cycle: позирование к шоу (P3.1)', () => {
  it('профиль поз для каждой категории', () => {
    for (const c of (['mens_physique', 'bikini', 'figure', 'wellness', 'mens_bb', 'womens_bb'] as BBContestCategory[])) {
      const p = posingPlanForCategory(c);
      expect(p.poses.length).toBeGreaterThan(0);
      expect(p.minutesPerDay).toBeGreaterThan(0);
    }
    expect(posingPlanForCategory('bikini').poses).toContain('Задняя стойка');
    expect(posingPlanForCategory('mens_physique').poses).toContain('Передняя стойка');
  });

  it('чек-ин сохраняется и заменяется за ту же дату', () => {
    localStorage.setItem('he_prep_posing_v1', '[]');
    savePosingCheckin({ date: isoToday(), minutes: 25 });
    savePosingCheckin({ date: isoToday(), minutes: 30 }); // заменяет
    const list = getPosingCheckins();
    expect(list.length).toBe(1);
    expect(list[0].minutes).toBe(30);
  });

  it('week-статистика за 7 дней', () => {
    localStorage.setItem('he_prep_posing_v1', '[]');
    savePosingCheckin({ date: isoAddDays(isoToday(), 0), minutes: 30 });
    savePosingCheckin({ date: isoAddDays(isoToday(), -1), minutes: 20 });
    savePosingCheckin({ date: isoAddDays(isoToday(), -9), minutes: 99 }); // вне окна
    const s = posingWeekStats(getPosingCheckins(), 7);
    expect(s.days).toBe(2);
    expect(s.totalMin).toBe(50);
    expect(s.avgMin).toBe(25);
  });
});

describe('bb-prep-cycle: план объёма подготовки (В1+В2, а не только тапер)', () => {
  it('каскад объёма подготовки нисходящий, дефицит-мод по категории', () => {
    const light = prepVolumePlan(base({ category: 'bikini', sex: 'female', weightKg: 60 }), 8);
    const heavy = prepVolumePlan(base({ category: 'mens_bb', weightKg: 100, bodyFatPct: 18 }), 8);
    // фазы нисходят
    expect(light.phases[0].volumeMult).toBeGreaterThan(light.phases[1].volumeMult);
    expect(light.phases[1].volumeMult).toBeGreaterThanOrEqual(light.phases[2].volumeMult);
    // лёгкая сушка сохраняет больше объёма, чем агрессивная
    expect(prepDeficitMult(base({ category: 'bikini', sex: 'female' }))).toBeGreaterThan(prepDeficitMult(base({ category: 'mens_bb', bodyFatPct: 18 })));
  });

  it('атлет-множители: курс/стаж держат больше объёма, новичок меньше', () => {
    expect(prepAthleteMult(base({ enhanced: true, trainingYears: 5 }))).toBeGreaterThan(prepAthleteMult(base({ enhanced: false, trainingYears: 5 })));
    expect(prepAthleteMult(base({ level: 'beginner', trainingYears: 1 }))).toBeLessThan(prepAthleteMult(base({ level: 'intermediate', trainingYears: 4 })));
    expect(prepRecoveryMult(base({ hrvMs: 40, sleepHours: 5, stressLevel: 8 }))).toBeLessThan(prepRecoveryMult(base({})));
  });

  it('фаза недели prep-блока соответствует позиции', () => {
    const vp = prepVolumePlan(base(), 8);
    expect(prepVolumePhaseForWeek(vp, 1, 8)?.volumeMult).toBe(vp.phases[0].volumeMult);
    expect(prepVolumePhaseForWeek(vp, 8, 8)?.volumeMult).toBe(vp.phases[vp.phases.length - 1].volumeMult);
  });

  it('объём подготовки в плане реально нисходит от начала к таперу', () => {
    const r = buildPrepCycle(base({ weeks: 12, taperWeeks: 3 })); // prep 8
    const setsOf = (w: any) => (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    const weeks = r.bbPlan.weeks as any[];
    const prep = weeks.filter((w: any) => w.contestPhase === 'preparation');
    expect(prep.length).toBeGreaterThanOrEqual(4);
    const avg = (arr: any[]) => arr.reduce((a, w) => a + setsOf(w), 0) / arr.length;
    const early = avg(prep.slice(0, Math.floor(prep.length / 2)));
    const late = avg(prep.slice(Math.floor(prep.length / 2)));
    // начало подготовки заметно объёмнее финала подготовки
    expect(early).toBeGreaterThan(late);
    // тапер ниже среднего финала подготовки
    const taper = weeks.find((w: any) => w.contestPhase === 'taper');
    expect(taper && setsOf(taper)).toBeLessThan(late);
  });

  it('атлет-параметры (PED/стаж/уровень) реально влияют на объём плана и целевой диапазон', () => {
    const natural = prepVolumePlan(base({ enhanced: false, trainingYears: 3, level: 'intermediate' }), 8);
    const enhanced = prepVolumePlan(base({ enhanced: true, trainingYears: 6, level: 'advanced' }), 8);
    // масштабированный целевой диапазон выше у продвинутого на курсе
    expect(enhanced.scaledTargetSetsPerMusclePerWeek[1]).toBeGreaterThan(natural.scaledTargetSetsPerMusclePerWeek[1]);
    expect(enhanced.athleteMult).toBeGreaterThan(natural.athleteMult);
    // фактический объём акцентной мышцы (shoulders) за prep-неделю: у курса/большого стажа больше
    const n = buildPrepCycle(base({ enhanced: false, trainingYears: 3, level: 'intermediate' }));
    const e = buildPrepCycle(base({ enhanced: true, trainingYears: 6, level: 'advanced', pedDoses: { AAS: 600 } }));
    // PED/стаж масштабируют MRV плана (effectiveMrvMult), а не только целевой диапазон
    expect(Number((e.bbPlan as any).mrvMultiplier)).toBeGreaterThan(Number((n.bbPlan as any).mrvMultiplier));
    expect(Number((e.bbPlan as any).mrvMultiplier)).toBeGreaterThan(1);
  });

  it('объём подготовки ≈ обычного ББ-авто (maintenance), а не урезанный goal=cut', () => {
    const b = base({ accentMuscles: [], minimalMuscles: [], category: 'bikini', sex: 'female', weeks: 8, taperWeeks: 2 });
    const prep = buildPrepCycle(b);
    const setsOf = (w: any) => (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((x: number, e: any) => x + (e.sets || 0), 0), 0);
    const prepWk = (prep.bbPlan.weeks as any[]).find((w: any) => w.contestPhase === 'preparation');
    const prepSets = setsOf(prepWk);
    // Обычный ББ-авто: buildBBPlan (maintenance) с теми же параметрами.
    const plain = buildBBPlan({
      patternId: prep.config.splitPatternId || 'upper_lower_4',
      level: b.level, goal: 'maintenance', weeks: 8, workMax: { ...DEFAULT_WORKMAX },
      equipment: EQ, sex: 'female', volumeGoal: 'mav',
    });
    const plainSets = setsOf(plain.weeks[0]);
    // Prep-объём не должен быть сильно меньше обычного ББ-авто (<25% разницы).
    expect(prepSets).toBeGreaterThan(plainSets * 0.75);
    expect(prepSets).toBeLessThanOrEqual(plainSets * 1.3);
  });

  it('кардио подготовки растёт с дефицитом и у массовых категорий (da Silveira 2025)', () => {
    const light = prepCardioPlan(base({ category: 'bikini', sex: 'female', bodyFatPct: 14 }));
    const heavy = prepCardioPlan(base({ category: 'mens_bb', sex: 'male', bodyFatPct: 18, enhanced: true }));
    expect(light.minutesPerWeek).toBeGreaterThanOrEqual(120);
    expect(heavy.minutesPerWeek).toBeGreaterThan(light.minutesPerWeek);
    expect(heavy.stepsPerDay).toBeGreaterThanOrEqual(light.stepsPerDay);
    expect(light.zone).toContain('Zone 2');
  });

  it('минимальная мышца реально исключается (~0-2 сета/нед) и рабочих дублей нет', () => {
    const r = buildPrepCycle(base({ category: 'mens_bb', accentMuscles: ['chest'], minimalMuscles: ['quads'], splitPatternId: 'ppl_6', weeks: 10, taperWeeks: 2 }));
    const prepWeeks = (r.bbPlan.weeks as any[]).filter(w => w.contestPhase === 'preparation' || w.contestPhase === 'final_preparation');
    expect(prepWeeks.length).toBeGreaterThan(0);
    const weeklyQuads: number[] = [];
    const dup: string[] = [];
    prepWeeks.forEach((w: any) => {
      let qSets = 0;
      (w.sessions || []).forEach((s: any) => {
        const work = (s.exercises || []).filter((e: any) => !(e as any).warmupActivator);
        const names = work.map((e: any) => e.exerciseName || e.name);
        const seen = new Set<string>();
        for (const n of names) { if (seen.has(n)) dup.push(`w${w.week} ${n}`); seen.add(n); }
        qSets += work.filter((e: any) => String(e.muscle).toLowerCase().includes('quad')).reduce((a: number, e: any) => a + (e.sets || 0), 0);
      });
      weeklyQuads.push(qSets);
    });
    expect(dup).toEqual([]);
    // Минимальная мышца — ~0-2 сета/нед (флор 0.25×MEV), а не полный объём
    expect(Math.max(...weeklyQuads)).toBeLessThanOrEqual(3);
  });

  it('при исключении ног пустые Legs-дни убираются (нет сессии <6 сетов)', () => {
    const r = buildPrepCycle(base({ category: 'mens_bb', accentMuscles: ['chest'], minimalMuscles: ['legs'], splitPatternId: 'ppl_6', weeks: 10, taperWeeks: 2 }));
    const prepWeeks = (r.bbPlan.weeks as any[]).filter(w => w.contestPhase === 'preparation');
    expect(prepWeeks.length).toBeGreaterThan(0);
    const working = (s: any) => (s.exercises || []).filter((e: any) => !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0);
    let minSessionSets = Infinity;
    for (const wk of prepWeeks) for (const s of (wk.sessions || [])) minSessionSets = Math.min(minSessionSets, working(s));
    // Ни одна оставшаяся сессия не пустая (пустые Legs-дни отброшены)
    expect(minSessionSets).toBeGreaterThanOrEqual(6);
    // В неделе остались осмысленные сессии
    expect(prepWeeks[0].sessions.length).toBeGreaterThan(0);
  });
});
