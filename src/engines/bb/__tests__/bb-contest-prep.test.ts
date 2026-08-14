/**
 * bb-contest-prep.test.ts — тесты единой системы тапера ББ (пикинг к шоу).
 *
 * Покрытие: валидация, force-моды противопоказаний, категорийные таблицы,
 * стратегии (карбс/вода/натрий), анкоринг по дате, тренировочный тапер из
 * Библиотеки методик, оверлеи на BB-план (идемпотентность, отсутствие мутаций),
 * готовность, сериализация, legacy-конвертация.
 */

import { describe, it, expect } from 'vitest';
import {
  validateBBContestPrepConfig,
  applyForcedModes,
  buildTrainingTaper,
  buildPeakWeek,
  buildShowTimeline,
  computeReadiness,
  buildBBContestPrep,
  peakWeekDayForDate,
  computePeakWeekNutritionTargets,
  applyTrainingTaperToBBPlan,
  applyPeakWeekOverlayToBBPlan,
  serializeBBPrepConfig,
  deserializeBBPrepConfig,
  legacyConfigFromProfile,
  normalizeContestCategory,
  CATEGORY_PROFILES,
  type BBContestPrepConfig,
  type BBPlanWithPrep,
} from '../bb-contest-prep.engine';
import type { BBPlan } from '../bb-builder.engine';

// ── Фабрики ──

/** Таймзона-безопасная арифметика ISO-дат (без toISOString-сдвигов). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  const showDate = addDaysIso(todayIso(), 21);
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate,
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'moderate',
    sodiumStrategy: 'cut_2d',
    ...over,
  };
}

function makeExercise(sets = 4, weight = 60, rir = 2): any {
  return {
    muscle: 'chest',
    name: 'Жим лёжа',
    role: 'primary',
    character: 'тяж',
    sets,
    repsRange: [8, 12] as [number, number],
    rir,
    workSets: Array.from({ length: sets }, () => ({ reps: 10, rir, weight })),
    comment: '',
  };
}

function makeWeek(week: number, sessionsCount = 4, sets = 4, deload = false): any {
  return {
    week,
    phase: deload ? 'deload' : 'accumulation',
    deload,
    sessions: Array.from({ length: sessionsCount }, (_, i) => ({
      day: i + 1,
      weekOffset: week * 7 + i,
      character: 'тяж',
      exercises: [makeExercise(sets), makeExercise(sets, 40, 2), makeExercise(sets, 20, 3)],
    })),
  };
}

function makePlan(weeksCount = 8): BBPlan {
  return {
    pattern: {} as any,
    weeks: Array.from({ length: weeksCount }, (_, i) => makeWeek(i + 1, 4, 10)),
    rotationMuscleVolume: {},
    rationale: ['Тестовый план'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Валидация
// ═══════════════════════════════════════════════════════════════════════════

describe('validateBBContestPrepConfig', () => {
  it('валидный конфиг проходит', () => {
    const v = validateBBContestPrepConfig(baseConfig());
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('категория не соответствует полу — ошибка', () => {
    const v = validateBBContestPrepConfig(baseConfig({ sex: 'male', category: 'bikini' }));
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/не соответствует полу/);
  });

  it('вес вне диапазона — ошибка', () => {
    expect(validateBBContestPrepConfig(baseConfig({ weightKg: 30 })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ weightKg: 250 })).ok).toBe(false);
  });

  it('дата шоу в прошлом — ошибка', () => {
    const v = validateBBContestPrepConfig(baseConfig({ showDate: '2020-01-01' }));
    expect(v.ok).toBe(false);
  });

  it('некорректная дата — ошибка', () => {
    expect(validateBBContestPrepConfig(baseConfig({ showDate: '31.12.2026' })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ showDate: 'garbage' })).ok).toBe(false);
  });

  it('weeksOut вне 1..4 — ошибка', () => {
    expect(validateBBContestPrepConfig(baseConfig({ weeksOut: 0 })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ weeksOut: 5 })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ weeksOut: 2.5 })).ok).toBe(false);
  });

  it('неизвестные стратегии — ошибки', () => {
    expect(validateBBContestPrepConfig(baseConfig({ trainingProtocol: 'weird' as any })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ carbLoadStrategy: 'weird' as any })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ waterStrategy: 'weird' as any })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ sodiumStrategy: 'weird' as any })).ok).toBe(false);
  });

  it('% жира вне диапазона — ошибка', () => {
    expect(validateBBContestPrepConfig(baseConfig({ bodyFatPct: 80 })).ok).toBe(false);
    expect(validateBBContestPrepConfig(baseConfig({ bodyFatPct: 1 })).ok).toBe(false);
  });

  it('противопоказание почки → force water minimal + sodium constant + carb moderate', () => {
    const v = validateBBContestPrepConfig(baseConfig({ contraindications: ['kidney'], waterStrategy: 'classic', sodiumStrategy: 'cut_3d', carbLoadStrategy: 'back' }));
    expect(v.ok).toBe(true);
    expect(v.forced.waterStrategy).toBe('minimal');
    expect(v.forced.sodiumStrategy).toBe('constant');
    expect(v.forced.carbLoadStrategy).toBe('moderate');
    expect(v.warnings.join(' ')).toMatch(/почки/);
  });

  it('противопоказание по-русски («почки») тоже ловится', () => {
    const v = validateBBContestPrepConfig(baseConfig({ contraindications: ['хронические почки'] }));
    expect(v.forced.waterStrategy).toBe('minimal');
  });

  it('гипертония/сердце — force-моды', () => {
    for (const c of ['hypertension', 'сердечная недостаточность']) {
      const v = validateBBContestPrepConfig(baseConfig({ contraindications: [c] }));
      expect(v.forced.waterStrategy).toBe('minimal');
      expect(v.forced.sodiumStrategy).toBe('constant');
    }
  });

  it('новичок/первый пик — рекомендательный warning (без force)', () => {
    const v = validateBBContestPrepConfig(baseConfig({ experienceLevel: 'beginner', prepCount: 0, waterStrategy: 'classic' }));
    expect(v.ok).toBe(true);
    expect(v.forced).toEqual({});
    expect(v.warnings.join(' ')).toMatch(/Первый пик/);
  });

  it('applyForcedModes не мутирует входной конфиг', () => {
    const cfg = baseConfig({ contraindications: ['kidney'], waterStrategy: 'classic' });
    const eff = applyForcedModes(cfg);
    expect(cfg.waterStrategy).toBe('classic');
    expect(eff.waterStrategy).toBe('minimal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Тренировочный тапер (Библиотека методик)
// ═══════════════════════════════════════════════════════════════════════════

describe('buildTrainingTaper', () => {
  it('берёт кривую BB-протокола Библиотеки, усечённую до weeksOut', () => {
    const t = buildTrainingTaper(baseConfig({ weeksOut: 3, trainingProtocol: 'bb' }));
    expect(t).toHaveLength(3);
    expect(t.map(x => x.weekOffset)).toEqual([-3, -2, -1]);
    // BB-протокол: 0.90 → 0.85 → 0.80 → 0.70; weeksOut 3 → последние 3: 0.85, 0.80, 0.70
    expect(t.map(x => x.volumePct)).toEqual([0.85, 0.8, 0.7]);
    expect(t[2].label).toBe('Шоу');
  });

  it('weeksOut 4 — полная кривая BB (4 недели)', () => {
    const t = buildTrainingTaper(baseConfig({ weeksOut: 4, trainingProtocol: 'bb' }));
    expect(t).toHaveLength(4);
    expect(t.map(x => x.volumePct)).toEqual([0.9, 0.85, 0.8, 0.7]);
  });

  it('classic-протокол — суперкомпенсация (перегрузка → реализация)', () => {
    const t = buildTrainingTaper(baseConfig({ weeksOut: 4, trainingProtocol: 'classic' }));
    expect(t[0].volumePct).toBe(1.15);
    expect(t[3].volumePct).toBe(0.4);
  });

  it('pl-протокол — интенсивность растёт к 1.0', () => {
    const t = buildTrainingTaper(baseConfig({ weeksOut: 3, trainingProtocol: 'pl' }));
    expect(t[2].intensityPct).toBe(1.0);
  });

  it('невалидный конфиг → пустой тапер', () => {
    expect(buildTrainingTaper(baseConfig({ showDate: '2020-01-01' }))).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Пик-неделя: категории и стратегии
// ═══════════════════════════════════════════════════════════════════════════

describe('buildPeakWeek', () => {
  it('7 дней, день 7 = шоу, даты = showDate−6..showDate', () => {
    const cfg = baseConfig();
    const days = buildPeakWeek(cfg);
    expect(days).toHaveLength(7);
    expect(days[6].day).toBe(7);
    expect(days[6].phase).toBe('show');
    expect(days[0].date).not.toBe(days[6].date);
    const d0 = new Date(days[0].date).getTime();
    const d6 = new Date(days[6].date).getTime();
    expect((d6 - d0) / 86400000).toBe(6);
    expect(days[6].date).toBe(cfg.showDate);
  });

  it('moderate: 3 дня деплеции → 3 дня загрузки → шоу', () => {
    const days = buildPeakWeek(baseConfig({ carbLoadStrategy: 'moderate' }));
    expect(days.map(d => d.phase)).toEqual(['deplete_1', 'deplete_2', 'deplete_3', 'load_1', 'load_2', 'load_3', 'show']);
  });

  it('front: загрузка раньше, день перед шоу — пик', () => {
    const days = buildPeakWeek(baseConfig({ carbLoadStrategy: 'front' }));
    expect(days.map(d => d.phase)).toEqual(['deplete_1', 'deplete_2', 'load_1', 'load_2', 'load_3', 'peak', 'show']);
  });

  it('back: поздняя загрузка 2 дня', () => {
    const days = buildPeakWeek(baseConfig({ carbLoadStrategy: 'back' }));
    expect(days.map(d => d.phase)).toEqual(['deplete_1', 'deplete_2', 'deplete_3', 'peak', 'load_1', 'load_2', 'show']);
  });

  it('карбс-загрузка нарастает (load_1 ≤ load_2 ≤ load_3)', () => {
    const days = buildPeakWeek(baseConfig({ carbLoadStrategy: 'moderate', category: 'mens_bb', weightKg: 100 }));
    const loads = days.filter(d => d.phase.startsWith('load'));
    expect(loads[0].carbsG).toBeLessThanOrEqual(loads[1].carbsG);
    expect(loads[1].carbsG).toBeLessThanOrEqual(loads[2].carbsG);
    expect(loads[2].carbsG).toBeGreaterThan(days[0].carbsG); // загрузка > деплеция
  });

  it('mens_bb грузит больше карбс, чем bikini (г/кг)', () => {
    const heavy = buildPeakWeek(baseConfig({ category: 'mens_bb', weightKg: 80, carbLoadStrategy: 'moderate' }));
    const light = buildPeakWeek(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55, carbLoadStrategy: 'moderate' }));
    const heavyMax = Math.max(...heavy.filter(d => d.phase.startsWith('load')).map(d => d.carbsG)) / 80;
    const lightMax = Math.max(...light.filter(d => d.phase.startsWith('load')).map(d => d.carbsG)) / 55;
    expect(heavyMax).toBeGreaterThan(lightMax);
  });

  it('bikini/wellness: деплеция мягче (≥1 г/кг)', () => {
    const days = buildPeakWeek(baseConfig({ sex: 'female', category: 'wellness', weightKg: 55 }));
    expect(days[0].carbsG).toBeGreaterThanOrEqual(55);
  });

  it('белок постоянный всю неделю, жиры в загрузке ниже деплеции', () => {
    const days = buildPeakWeek(baseConfig());
    const proteins = new Set(days.map(d => d.proteinG));
    expect(proteins.size).toBe(1);
    expect(days[3].fatG).toBeLessThan(days[0].fatG);
  });

  it('вода classic: load → ступенчатый cut → глотки', () => {
    const days = buildPeakWeek(baseConfig({ waterStrategy: 'classic', weightKg: 80 }));
    expect(days[0].waterLiters).toBeCloseTo(9.2, 0);
    expect(days[4].waterLiters).toBeLessThan(days[3].waterLiters);
    expect(days[5].waterLiters).toBeLessThan(days[4].waterLiters);
    expect(days[6].waterLiters).toBeLessThanOrEqual(0.5);
  });

  it('вода minimal: без cut (день перед шоу ≈ день 1)', () => {
    const days = buildPeakWeek(baseConfig({ waterStrategy: 'minimal' }));
    expect(days[5].waterLiters).toBeCloseTo(days[0].waterLiters, 1);
  });

  it('женщины: вода шоу-дня не ниже 0.5 л', () => {
    const days = buildPeakWeek(baseConfig({ sex: 'female', category: 'figure', weightKg: 55, waterStrategy: 'classic' }));
    expect(days[6].waterLiters).toBeGreaterThanOrEqual(0.5);
  });

  it('натрий cut_3d падает к шоу; constant — ровный', () => {
    const cut = buildPeakWeek(baseConfig({ sodiumStrategy: 'cut_3d' }));
    expect(cut[0].sodiumMg).toBeGreaterThan(cut[4].sodiumMg);
    expect(cut[4].sodiumMg).toBeGreaterThan(cut[5].sodiumMg);
    const flat = buildPeakWeek(baseConfig({ sodiumStrategy: 'constant' }));
    expect(flat[0].sodiumMg).toBe(flat[5].sodiumMg);
  });

  it('женщины/лёгкие категории: натрий не ниже 800 мг (кроме шоу)', () => {
    const days = buildPeakWeek(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55, sodiumStrategy: 'cut_3d' }));
    for (const d of days.slice(0, 6)) expect(d.sodiumMg).toBeGreaterThanOrEqual(800);
  });

  it('калий не снижается к шоу', () => {
    const days = buildPeakWeek(baseConfig({ sodiumStrategy: 'cut_3d' }));
    expect(days[6].potassiumMg).toBe(days[0].potassiumMg);
  });

  it('ккал = БЖУ × калорийность', () => {
    const days = buildPeakWeek(baseConfig());
    for (const d of days) {
      expect(d.kcal).toBe(Math.round(d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9));
    }
  });

  it('тренировки: день 1 верх, день 2 низ, день 3 — по стратегии, шоу — памп', () => {
    const days = buildPeakWeek(baseConfig({ carbLoadStrategy: 'moderate' }));
    expect(days[0].training.type).toMatch(/Верх/);
    expect(days[1].training.type).toMatch(/Низ/);
    expect(days[2].training.type).toMatch(/Full-body/);
    expect(days[3].training.minutes).toBe(0);
    expect(days[6].training.type).toMatch(/Памп|backstage/);
  });

  it('противопоказание почки force-меняет стратегии в пик-неделе', () => {
    const days = buildPeakWeek(baseConfig({ contraindications: ['kidney'], waterStrategy: 'classic', sodiumStrategy: 'cut_3d' }));
    // minimal вода: день 5 = день 1 (нет cut)
    expect(days[5].waterLiters).toBeCloseTo(days[0].waterLiters, 1);
    // constant натрий
    expect(days[0].sodiumMg).toBe(days[5].sodiumMg);
  });

  it('невалидный конфиг → пустая неделя', () => {
    expect(buildPeakWeek(baseConfig({ weightKg: 10 }))).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Таймлайн шоу-дня и готовность
// ═══════════════════════════════════════════════════════════════════════════

describe('buildShowTimeline', () => {
  it('8 шагов, от подъёма до выхода', () => {
    const t = buildShowTimeline(baseConfig());
    expect(t).toHaveLength(8);
    expect(t[0].action).toMatch(/Подъём/);
    expect(t[t.length - 1].action).toMatch(/сцен/);
  });

  it('время отсчитывается от времени сцены', () => {
    const t = buildShowTimeline(baseConfig({ schedule: { wake: '08:00', stage: '14:00' } }));
    expect(t[t.length - 1].time).toBe('14:00');
    expect(t[0].time).toBe('11:30');
  });

  it('дефолты wake 07:00 / stage 12:00', () => {
    const t = buildShowTimeline(baseConfig());
    expect(t[t.length - 1].time).toBe('12:00');
  });
});

describe('computeReadiness', () => {
  it('gap > 2 → behind с предупреждением о заливе', () => {
    const r = computeReadiness(baseConfig({ category: 'mens_bb', bodyFatPct: 9 }));
    expect(r.verdict).toBe('behind');
    expect(r.gap).toBe(5);
    expect(r.note).toMatch(/залив/);
  });

  it('gap ≤ 2 → on_track', () => {
    const r = computeReadiness(baseConfig({ category: 'mens_physique', bodyFatPct: 7.5 }));
    expect(r.verdict).toBe('on_track');
  });

  it('уже на цели → ahead', () => {
    const r = computeReadiness(baseConfig({ category: 'mens_physique', bodyFatPct: 5.8 }));
    expect(r.verdict).toBe('ahead');
  });

  it('% жира не указан → on_track с пометкой', () => {
    const r = computeReadiness(baseConfig({ bodyFatPct: undefined }));
    expect(r.gap).toBeNull();
    expect(r.note).toMatch(/не указан/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Анкоринг по дате
// ═══════════════════════════════════════════════════════════════════════════

describe('peakWeekDayForDate', () => {
  it('дата шоу → день 7 (show)', () => {
    const cfg = baseConfig();
    const d = peakWeekDayForDate(cfg.showDate, cfg);
    expect(d?.day).toBe(7);
    expect(d?.phase).toBe('show');
  });

  it('D-6 → день 1 (deplete)', () => {
    const cfg = baseConfig();
    const d6 = addDaysIso(cfg.showDate, -6);
    const d = peakWeekDayForDate(d6, cfg);
    expect(d?.day).toBe(1);
    expect(d?.phase).toBe('deplete_1');
  });

  it('за 10 дней до шоу → null (вне окна)', () => {
    const cfg = baseConfig();
    expect(peakWeekDayForDate(addDaysIso(cfg.showDate, -10), cfg)).toBeNull();
  });

  it('после шоу → null', () => {
    const cfg = baseConfig();
    expect(peakWeekDayForDate(addDaysIso(cfg.showDate, 1), cfg)).toBeNull();
  });

  it('мусорная дата → null', () => {
    expect(peakWeekDayForDate('nope', baseConfig())).toBeNull();
  });
});

describe('computePeakWeekNutritionTargets', () => {
  const base = { kcal: 2500, proteinG: 160, fatG: 70, carbsG: 300, waterMl: 3000, sodiumMg: 3500 };

  it('вне пик-недели возвращает базу без изменений (phase null)', () => {
    const cfg = baseConfig();
    const t = computePeakWeekNutritionTargets(addDaysIso(cfg.showDate, -10), base, cfg);
    expect(t.phase).toBeNull();
    expect(t.kcal).toBe(base.kcal);
    expect(t.carbsG).toBe(base.carbsG);
    expect(t.waterMl).toBe(base.waterMl);
  });

  it('в день шоу — абсолютные цели пик-недели (приоритет над базой)', () => {
    const cfg = baseConfig();
    const day = peakWeekDayForDate(cfg.showDate, cfg)!;
    const t = computePeakWeekNutritionTargets(cfg.showDate, base, cfg);
    expect(t.phase).toBe('show');
    expect(t.carbsG).toBe(day.carbsG);
    expect(t.proteinG).toBe(day.proteinG);
    expect(t.fatG).toBe(day.fatG);
    expect(t.waterMl).toBe(Math.round(day.waterLiters * 1000));
    expect(t.sodiumMg).toBe(day.sodiumMg);
    expect(t.note).toMatch(/Пик-неделя/);
  });

  it('в день деплеции карбс сильно ниже базы', () => {
    const cfg = baseConfig({ weightKg: 80 });
    const t = computePeakWeekNutritionTargets(addDaysIso(cfg.showDate, -6), base, cfg);
    expect(t.carbsG).toBeLessThan(base.carbsG);
    expect(t.fatG).toBeGreaterThan(base.fatG * 0.5); // жиры энергии на деплеции
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Оверлеи на BB-план
// ═══════════════════════════════════════════════════════════════════════════

describe('applyTrainingTaperToBBPlan', () => {
  it('не мутирует исходный план', () => {
    const plan = makePlan(8);
    const before = JSON.stringify(plan.weeks[0]);
    const cfg = baseConfig();
    applyTrainingTaperToBBPlan(plan, cfg);
    expect(JSON.stringify(plan.weeks[0])).toBe(before);
  });

  it('масштабирует объём/RIR на последних weeksOut неделях по кривой Библиотеки', () => {
    const plan = makePlan(8);
    const cfg = baseConfig({ weeksOut: 3 });
    const out = applyTrainingTaperToBBPlan(plan, cfg) as BBPlanWithPrep;
    // BB-кривая weeksOut 3: 0.85, 0.80, 0.70 (нед 6, 7, 8)
    const w6 = out.weeks[5];
    const w7 = out.weeks[6];
    expect(w6.phase).toBe('peaking');
    const setsOf = (w: any) => w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
    const base = setsOf(plan.weeks[4]);
    expect(setsOf(w6)).toBeLessThan(base);
    expect(setsOf(w7)).toBeLessThan(setsOf(w6));
  });

  it('интенсивность (вес) масштабируется по intensityPct протокола', () => {
    const plan = makePlan(8);
    const cfg = baseConfig({ weeksOut: 3, trainingProtocol: 'bb' });
    const out = applyTrainingTaperToBBPlan(plan, cfg) as BBPlanWithPrep;
    const w6 = out.weeks[5];
    const ex = w6.sessions[0].exercises[0];
    const origWeight = plan.weeks[5].sessions[0].exercises[0].workSets[0].weight;
    // BB week2 (первая из усечённых 3): intensityPct 0.85
    expect(ex.workSets[0].weight).toBe(Math.round(origWeight * 0.85 * 10) / 10);
  });

  it('финальная неделя — пик-неделя (памп, метка peakWeek)', () => {
    const plan = makePlan(8);
    const out = applyTrainingTaperToBBPlan(plan, baseConfig({ weeksOut: 3 })) as BBPlanWithPrep;
    const last = out.weeks[7];
    expect(last.peakWeek).toBe(true);
    expect(last.phase).toBe('peaking');
    const ex = last.sessions[0].exercises[0];
    expect(ex.repsRange).toEqual([15, 20]);
    expect(ex.comment).toMatch(/Пик-неделя/);
    // 4-я сессия — отдых
    expect(last.sessions[3].exercises).toEqual([]);
    expect(last.sessions[3].peakWeekRest).toBe(true);
  });

  it('делод-неделя в окне тапера пропускается (anti-двойное снижение)', () => {
    const plan = makePlan(8);
    plan.weeks[6] = makeWeek(7, 4, 2, true); // deload с 2 сетами
    const out = applyTrainingTaperToBBPlan(plan, baseConfig({ weeksOut: 3 })) as BBPlanWithPrep;
    const w7 = out.weeks[6];
    expect(w7.prepProtocol).toMatch(/Пропущена/);
    const setsOf = (w: any) => w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
    expect(setsOf(w7)).toBe(setsOf(plan.weeks[6]));
  });

  it('идемпотентен: повторный вызов возвращает план как есть', () => {
    const plan = makePlan(8);
    const cfg = baseConfig();
    const once = applyTrainingTaperToBBPlan(plan, cfg) as BBPlanWithPrep;
    const twice = applyTrainingTaperToBBPlan(once, cfg) as BBPlanWithPrep;
    expect(twice).toBe(once);
  });

  it('невалидный конфиг → план без изменений', () => {
    const plan = makePlan(8);
    const out = applyTrainingTaperToBBPlan(plan, baseConfig({ showDate: '2020-01-01' }));
    expect(out).toBe(plan);
  });

  it('добавляет rationale и маркер contestPrep', () => {
    const plan = makePlan(8);
    const out = applyTrainingTaperToBBPlan(plan, baseConfig()) as BBPlanWithPrep;
    expect(out.contestPrep?.protocol).toBe('bb');
    expect(out.rationale.join(' ')).toMatch(/Тапер ББ наложен/);
  });

  it('короткий план (2 недели) не падает', () => {
    const plan = makePlan(2);
    const out = applyTrainingTaperToBBPlan(plan, baseConfig({ weeksOut: 3 })) as BBPlanWithPrep;
    expect(out.weeks).toHaveLength(2);
    expect(out.weeks[1].peakWeek).toBe(true);
  });

  it('weekNumber: тапер заканчивается на указанной неделе (пик-неделя там же)', () => {
    const plan = makePlan(8);
    const out = applyTrainingTaperToBBPlan(plan, baseConfig({ weeksOut: 3 }), { weekNumber: 5 }) as BBPlanWithPrep;
    // Пик-неделя = неделя 5; недели 6-8 не тронуты.
    expect(out.weeks[4].peakWeek).toBe(true);
    expect(out.weeks[4].phase).toBe('peaking');
    expect(out.weeks[7].peakWeek).toBeUndefined();
    expect(out.weeks[7].sessions[0].exercises[0].sets).toBe(plan.weeks[7].sessions[0].exercises[0].sets);
    // Тапер-недели: 3, 4 (до недели шоу) — их объём ниже исходного.
    const setsOf = (w: any) => w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
    expect(setsOf(out.weeks[2])).toBeLessThan(setsOf(plan.weeks[2]));
    expect(setsOf(out.weeks[3])).toBeLessThan(setsOf(plan.weeks[3]));
  });

  it('weekNumber клампится к краям плана', () => {
    const plan = makePlan(8);
    const hi = applyTrainingTaperToBBPlan(plan, baseConfig({ weeksOut: 3 }), { weekNumber: 99 }) as BBPlanWithPrep;
    expect(hi.weeks[7].peakWeek).toBe(true);
    const loPlan = makePlan(8);
    const lo = applyTrainingTaperToBBPlan(loPlan, baseConfig({ weeksOut: 3 }), { weekNumber: 1 }) as BBPlanWithPrep;
    expect(lo.weeks[0].peakWeek).toBe(true);
    expect(lo.weeks[7].peakWeek).toBeUndefined();
  });
});

describe('applyPeakWeekOverlayToBBPlan', () => {
  it('меняет только финальную неделю', () => {
    const plan = makePlan(8);
    const out = applyPeakWeekOverlayToBBPlan(plan, baseConfig()) as BBPlanWithPrep;
    expect(out.weeks[7].peakWeek).toBe(true);
    expect(out.weeks[6].peakWeek).toBeUndefined();
    expect(out.weeks[6].sessions[0].exercises[0].sets).toBe(plan.weeks[6].sessions[0].exercises[0].sets);
  });

  it('идемпотентен', () => {
    const plan = makePlan(8);
    const once = applyPeakWeekOverlayToBBPlan(plan, baseConfig());
    expect(applyPeakWeekOverlayToBBPlan(once, baseConfig())).toBe(once);
  });

  it('weekNumber: применяет пик-неделю к указанной неделе (1-индекс)', () => {
    const plan = makePlan(8);
    const out = applyPeakWeekOverlayToBBPlan(plan, baseConfig(), { weekNumber: 6 }) as BBPlanWithPrep;
    expect(out.weeks[5].peakWeek).toBe(true);
    expect(out.weeks[7].peakWeek).toBeUndefined();
    expect(out.weeks[5].phase).toBe('peaking');
  });

  it('weekNumber клампится к краям', () => {
    const plan = makePlan(8);
    const hi = applyPeakWeekOverlayToBBPlan(plan, baseConfig(), { weekNumber: 99 }) as BBPlanWithPrep;
    expect(hi.weeks[7].peakWeek).toBe(true);
    const loPlan = makePlan(8);
    const lo = applyPeakWeekOverlayToBBPlan(loPlan, baseConfig(), { weekNumber: 0 }) as BBPlanWithPrep;
    expect(lo.weeks[0].peakWeek).toBe(true);
  });

  it('комментарий содержит маркер [Peak week: …] (совместимость со старым движком)', () => {
    const plan = makePlan(8);
    const out = applyPeakWeekOverlayToBBPlan(plan, baseConfig()) as BBPlanWithPrep;
    const comment = String(out.weeks[7].sessions[0].exercises[0].comment || '');
    expect(comment).toContain('[Peak week:');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Полная сборка, сериализация, legacy
// ═══════════════════════════════════════════════════════════════════════════

describe('buildBBContestPrep', () => {
  it('полный результат: тапер + пик-неделя + таймлайн + готовность', () => {
    const res = buildBBContestPrep(baseConfig());
    expect(res.taper).toHaveLength(3);
    expect(res.peakWeek).toHaveLength(7);
    expect(res.showTimeline).toHaveLength(8);
    expect(res.readiness.verdict).toBe('on_track');
    expect(res.rationale.join(' ')).toMatch(/Тапер ББ/);
  });

  it('невалидный конфиг — исключение с текстом', () => {
    expect(() => buildBBContestPrep(baseConfig({ showDate: '2020-01-01' }))).toThrow(/Некорректный конфиг/);
  });

  it('CATEGORY_PROFILES содержит все 9 категорий с корректным полом', () => {
    const keys = Object.keys(CATEGORY_PROFILES);
    expect(keys).toHaveLength(9);
    for (const k of keys) {
      const p = CATEGORY_PROFILES[k as keyof typeof CATEGORY_PROFILES];
      expect(['male', 'female']).toContain(p.sex);
      expect(p.targetBodyFatPct).toBeGreaterThanOrEqual(4);
      expect(p.proteinGPerKg).toBeGreaterThan(1.5);
    }
  });
});

describe('сериализация', () => {
  it('round-trip сохраняет конфиг', () => {
    const cfg = baseConfig({ contraindications: ['kidney'], allergens: ['молоко'], preferLowFiberCarbs: true, schedule: { wake: '08:00', stage: '14:00' } });
    const back = deserializeBBPrepConfig(serializeBBPrepConfig(cfg));
    expect(back).toEqual(cfg);
  });

  it('мусор → null', () => {
    expect(deserializeBBPrepConfig('not json')).toBeNull();
    expect(deserializeBBPrepConfig('{}')).toBeNull();
    expect(deserializeBBPrepConfig('{"weightKg":"xx"}')).toBeNull();
    expect(deserializeBBPrepConfig(null)).toBeNull();
    expect(deserializeBBPrepConfig(undefined)).toBeNull();
  });

  it('неизвестные стратегии → безопасные дефолты', () => {
    const cfg = deserializeBBPrepConfig(JSON.stringify({ ...baseConfig(), waterStrategy: 'nope', sodiumStrategy: 'nope', weeksOut: 99 }));
    expect(cfg?.waterStrategy).toBe('minimal');
    expect(cfg?.sodiumStrategy).toBe('constant');
    expect(cfg?.weeksOut).toBe(4);
  });
});

describe('normalizeContestCategory', () => {
  it('legacy id «classic» → classic_physique, «open» → mens_bb', () => {
    expect(normalizeContestCategory('classic', 'male')).toBe('classic_physique');
    expect(normalizeContestCategory('open', 'male')).toBe('mens_bb');
    expect(normalizeContestCategory('bb_212', 'male')).toBe('bb_212');
  });

  it('несоответствие полу → дефолт по полу', () => {
    expect(normalizeContestCategory('bikini', 'male')).toBe('mens_physique');
    expect(normalizeContestCategory('mens_bb', 'female')).toBe('bikini');
  });

  it('мусор/null → дефолт по полу', () => {
    expect(normalizeContestCategory('мусор', 'male')).toBe('mens_physique');
    expect(normalizeContestCategory(null, 'female')).toBe('bikini');
    expect(normalizeContestCategory(undefined, 'male')).toBe('mens_physique');
  });
});

describe('legacyConfigFromProfile', () => {  it('включённый старый peak-week → консервативный конфиг с датой шоу', () => {
    const showDate = addDaysIso(todayIso(), 30);
    const cfg = legacyConfigFromProfile(
      { peakWeek: true, peakShowDay: showDate, bbCategory: 'bikini' },
      { weight: 55, sex: 'female' },
    );
    expect(cfg).not.toBeNull();
    expect(cfg!.showDate).toBe(showDate);
    expect(cfg!.category).toBe('bikini');
    expect(cfg!.sex).toBe('female');
    expect(cfg!.waterStrategy).toBe('minimal');
    expect(cfg!.sodiumStrategy).toBe('constant');
    expect(cfg!.weightKg).toBe(55);
  });

  it('legacy id «open» → mens_bb, «classic» → classic_physique', () => {
    const showDate = addDaysIso(todayIso(), 30);
    expect(legacyConfigFromProfile({ peakWeek: true, peakShowDay: showDate, bbCategory: 'open' }, { sex: 'male' })?.category).toBe('mens_bb');
    expect(legacyConfigFromProfile({ peakWeek: true, peakShowDay: showDate, bbCategory: 'classic' }, { sex: 'male' })?.category).toBe('classic_physique');
  });

  it('выключенный / без даты / дата в прошлом → null', () => {
    expect(legacyConfigFromProfile({ peakWeek: false }, {})).toBeNull();
    expect(legacyConfigFromProfile({ peakWeek: true }, {})).toBeNull();
    expect(legacyConfigFromProfile({ peakWeek: true, peakShowDay: '2020-01-01' }, {})).toBeNull();
    expect(legacyConfigFromProfile(null, null)).toBeNull();
  });

  it('без категории: дефолт по полу', () => {
    const showDate = addDaysIso(todayIso(), 30);
    expect(legacyConfigFromProfile({ peakWeek: true, peakShowDay: showDate }, { sex: 'female' })?.category).toBe('bikini');
    expect(legacyConfigFromProfile({ peakWeek: true, peakShowDay: showDate }, { sex: 'male' })?.category).toBe('mens_physique');
  });
});
