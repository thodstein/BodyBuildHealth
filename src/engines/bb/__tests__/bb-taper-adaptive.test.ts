/**
 * bb-taper-adaptive.test.ts — P0: адаптивный тапер по тренированности,
 * категории, ПЭД-статусу, возрасту, фазе цикла + гликоген-коррекция карб-дозы.
 *
 * Источники: Bosquet 2007, Helms 2020, Burke 2011.
 */
import { describe, it, expect } from 'vitest';
import {
  estimateTrainingExperience,
  estimateDiaryExperience,
  buildTaperModifiers,
  buildAdaptiveTaper,
  glycogenAdjustedDose,
  estimateGlycogenFromCarbs,
  type TrainingExperienceData,
} from '../bb-taper-adaptive.engine';
import type { BBContestPrepConfig } from '../bb-contest-prep.engine';

// ═══════════════════════════════════════════════════════════════════════════
// estimateTrainingExperience
// ═══════════════════════════════════════════════════════════════════════════

describe('estimateTrainingExperience', () => {
  it('без данных → 0.5 (нейтрально)', () => {
    expect(estimateTrainingExperience()).toBe(0.5);
    expect(estimateTrainingExperience({})).toBe(0.5);
  });

  it('новичок (0 лет, 3 сессии) → низкий скор', () => {
    const exp: TrainingExperienceData = { yearsTraining: 0, totalSessions: 10, sessionsPerWeek: 2 };
    const score = estimateTrainingExperience(exp);
    expect(score).toBeLessThan(0.35);
    expect(score).toBeGreaterThan(0);
  });

  it('продвинутый (8 лет, 1500 сессий, 5/нед) → высокий скор', () => {
    const exp: TrainingExperienceData = { yearsTraining: 8, totalSessions: 1500, sessionsPerWeek: 5 };
    const score = estimateTrainingExperience(exp);
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it('клампы: 0 и 1', () => {
    const min = estimateTrainingExperience({ yearsTraining: 0, totalSessions: 0, sessionsPerWeek: 1 });
    const max = estimateTrainingExperience({ yearsTraining: 10, totalSessions: 2000, sessionsPerWeek: 7 });
    expect(min).toBe(0);
    expect(max).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// estimateDiaryExperience
// ═══════════════════════════════════════════════════════════════════════════

describe('estimateDiaryExperience', () => {
  it('пустой массив → {}', () => {
    expect(estimateDiaryExperience([])).toEqual({});
  });

  it('мусор → {}', () => {
    expect(estimateDiaryExperience([{ date: undefined, sets: 0 } as any])).toEqual({});
  });

  it('3 сессии за 21 день → spw ≈ 1', () => {
    const diary = [
      { date: '2026-01-01', sets: 10 },
      { date: '2026-01-08', sets: 12 },
      { date: '2026-01-15', sets: 11 },
    ];
    const exp = estimateDiaryExperience(diary);
    expect(exp.totalSessions).toBe(3);
    expect(exp.sessionsPerWeek).toBeGreaterThanOrEqual(0.5);
    expect(exp.sessionsPerWeek).toBeLessThanOrEqual(1.5);
    expect(exp.avgVolumePerSession).toBe(11);
  });

  it('12 сессий за 12 дней → spw ≈ 7 (ежедневные тренировки)', () => {
    const diary = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      sets: 15,
    }));
    const exp = estimateDiaryExperience(diary);
    expect(exp.totalSessions).toBe(12);
    expect(exp.sessionsPerWeek).toBeGreaterThanOrEqual(6);
    expect(exp.sessionsPerWeek).toBeLessThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildTaperModifiers
// ═══════════════════════════════════════════════════════════════════════════

describe('buildTaperModifiers', () => {
  const baseCfg: BBContestPrepConfig = {
    sex: 'male',
    category: 'mens_bb',
    weightKg: 90,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: '2026-11-01',
    weeksOut: 4,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
  };

  it('без опыта и модификаторов → пустые модификаторы', () => {
    const mods = buildTaperModifiers({ cfg: baseCfg });
    expect(mods.volumeMult ?? 1).toBe(1);
    expect(mods.intensityMult ?? 1).toBe(1);
    expect(mods.taperLength ?? 4).toBe(4);
  });

  it('продвинутый (exp ≥ 0.7) → тапер 2 нед, объём ×0.95, интенсивность ×1.02', () => {
    const exp: TrainingExperienceData = { yearsTraining: 8, totalSessions: 1500, sessionsPerWeek: 5 };
    const mods = buildTaperModifiers({ cfg: baseCfg, experience: exp });
    expect(mods.taperLength).toBe(2);
    expect(mods.volumeMult).toBe(0.95);
    expect(mods.intensityMult).toBe(1.02);
  });

  it('новичок (exp ≤ 0.3) → тапер 4 нед, объём ×1.05, интенсивность ×0.98', () => {
    const exp: TrainingExperienceData = { yearsTraining: 0, totalSessions: 10, sessionsPerWeek: 2 };
    const mods = buildTaperModifiers({ cfg: baseCfg, experience: exp });
    expect(mods.taperLength).toBe(4);
    expect(mods.volumeMult).toBe(1.05);
    expect(mods.intensityMult).toBe(0.98);
  });

  it('bikini → объём ×0.90', () => {
    const mods = buildTaperModifiers({ cfg: { ...baseCfg, category: 'bikini' } });
    expect(mods.volumeMult).toBe(0.90);
  });

  it('wellness → объём ×0.90', () => {
    const mods = buildTaperModifiers({ cfg: { ...baseCfg, category: 'wellness' } });
    expect(mods.volumeMult).toBe(0.90);
  });

  it('enhanced → объём ×0.95, интенсивность ×1.025', () => {
    const mods = buildTaperModifiers({ cfg: { ...baseCfg, enhanced: true } });
    expect(mods.volumeMult).toBe(0.95);
    expect(mods.intensityMult).toBe(1.025);
  });

  it('возраст 40+ → тапер 4 нед, объём ×1.05, интенсивность ×0.98', () => {
    const mods = buildTaperModifiers({ cfg: { ...baseCfg, age: 45 } });
    expect(mods.taperLength).toBe(4);
    expect(mods.volumeMult).toBe(1.05);
    expect(mods.intensityMult).toBe(0.98);
  });

  it('лютеиновая фаза (cycleDay 14+) → интенсивность ×0.95', () => {
    const mods = buildTaperModifiers({
      cfg: { ...baseCfg, sex: 'female', cycleDay: 20 },
    });
    expect(mods.intensityMult).toBe(0.95);
  });

  it('комбо: продвинутый + enhanced → объём ×0.95×0.95, интенсивность ×1.02×1.025', () => {
    const exp: TrainingExperienceData = { yearsTraining: 8, totalSessions: 1500, sessionsPerWeek: 5 };
    const mods = buildTaperModifiers({
      cfg: { ...baseCfg, enhanced: true },
      experience: exp,
    });
    expect(mods.volumeMult).toBeCloseTo(0.95 * 0.95, 5);
    expect(mods.intensityMult).toBeCloseTo(1.02 * 1.025, 5);
  });

  it('комбо: bikini + 40+ → объём ×0.90×1.05, интенсивность ×0.98', () => {
    const mods = buildTaperModifiers({
      cfg: { ...baseCfg, category: 'bikini', sex: 'female', age: 42 },
    });
    expect(mods.volumeMult).toBeCloseTo(0.90 * 1.05, 5);
    expect(mods.intensityMult).toBe(0.98);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildAdaptiveTaper
// ═══════════════════════════════════════════════════════════════════════════

describe('buildAdaptiveTaper', () => {
  const baseCfg: BBContestPrepConfig = {
    sex: 'male',
    category: 'mens_bb',
    weightKg: 90,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: '2026-11-01',
    weeksOut: 4,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
  };

  it('без модификаторов → байт-в-байт с buildTrainingTaper (4 нед)', () => {
    const adaptive = buildAdaptiveTaper(baseCfg);
    expect(adaptive.length).toBe(4);
    expect(adaptive[0].volumePct).toBe(0.90);
    expect(adaptive[3].volumePct).toBe(0.60);
  });

  it('продвинутый → тапер 2 нед', () => {
    const exp: TrainingExperienceData = { yearsTraining: 8, totalSessions: 1500, sessionsPerWeek: 5 };
    const adaptive = buildAdaptiveTaper(baseCfg, { experience: exp });
    expect(adaptive.length).toBe(2);
    // buildTrainingTaper с weeksOut=2 берёт ПОСЛЕДНИЕ 2 недели BB_TAPER_CURVE: [0.70, 0.60]
    // с модификатором volumeMult=0.95: [0.70×0.95=0.6649…→0.66, 0.60×0.95=0.57]
    expect(adaptive[0].volumePct).toBe(0.66);
    expect(adaptive[1].volumePct).toBe(0.57);
  });

  it('новичок → тапер 4 нед, объём ×1.05', () => {
    const exp: TrainingExperienceData = { yearsTraining: 0, totalSessions: 10, sessionsPerWeek: 2 };
    const adaptive = buildAdaptiveTaper(baseCfg, { experience: exp });
    expect(adaptive.length).toBe(4);
    // 0.90 × 1.05 = 0.945 → rounded 0.95
    expect(adaptive[0].volumePct).toBe(0.95);
    expect(adaptive[0].volumePct).toBeLessThanOrEqual(1.0);
  });

  it('enhanced → объём ×0.95, интенсивность ×1.025', () => {
    const adaptive = buildAdaptiveTaper(baseCfg, {
      modifiers: { volumeMult: 0.95, intensityMult: 1.025 },
    });
    // 0.90 × 0.95 = 0.855 → rounded 0.86
    expect(adaptive[0].volumePct).toBe(0.86);
    // 0.95 × 1.025 = 0.97375 → rounded 0.97
    expect(adaptive[0].intensityPct).toBe(0.97);
  });

  it('rirShift +1 → rirMin/rirMax сдвигаются', () => {
    const adaptive = buildAdaptiveTaper(baseCfg, { modifiers: { rirShift: 1 } });
    expect(adaptive[0].rirMin).toBe(3); // было 2
    expect(adaptive[0].rirMax).toBe(4); // было 3
  });

  it('кастомный taperLength=3 → 3 недели', () => {
    const adaptive = buildAdaptiveTaper(baseCfg, { modifiers: { taperLength: 3 } });
    expect(adaptive.length).toBe(3);
  });

  it('модификаторы переданы явно → не пересчитываются из конфига', () => {
    const exp: TrainingExperienceData = { yearsTraining: 8, totalSessions: 1500, sessionsPerWeek: 5 };
    const adaptive = buildAdaptiveTaper(baseCfg, {
      experience: exp,
      modifiers: { taperLength: 4, volumeMult: 1 },
    });
    expect(adaptive.length).toBe(4);
    expect(adaptive[0].volumePct).toBe(0.90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// glycogenAdjustedDose
// ═══════════════════════════════════════════════════════════════════════════

describe('glycogenAdjustedDose', () => {
  it('без данных → байт-в-байт', () => {
    expect(glycogenAdjustedDose(8)).toBe(8);
    expect(glycogenAdjustedDose(8, undefined)).toBe(8);
  });

  it('гликоген низкий (1-3) → +15%', () => {
    expect(glycogenAdjustedDose(8, 1)).toBeCloseTo(9.2, 5);
    expect(glycogenAdjustedDose(8, 2)).toBeCloseTo(9.2, 5);
    expect(glycogenAdjustedDose(8, 3)).toBeCloseTo(9.2, 5);
  });

  it('гликоген высокий (8-10) → −10%', () => {
    expect(glycogenAdjustedDose(8, 8)).toBeCloseTo(7.2, 5);
    expect(glycogenAdjustedDose(8, 10)).toBeCloseTo(7.2, 5);
  });

  it('средний гликоген (4-7) → без изменений', () => {
    expect(glycogenAdjustedDose(8, 4)).toBe(8);
    expect(glycogenAdjustedDose(8, 7)).toBe(8);
  });

  it('клампы: 0→1, 11→10', () => {
    expect(glycogenAdjustedDose(8, 0)).toBeCloseTo(9.2, 5); // clamped to 1 → +15%
    expect(glycogenAdjustedDose(8, 11)).toBeCloseTo(7.2, 5); // clamped to 10 → −10%
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// estimateGlycogenFromCarbs
// ═══════════════════════════════════════════════════════════════════════════

describe('estimateGlycogenFromCarbs', () => {
  it('<2 г/кг → 2 (истощён)', () => {
    expect(estimateGlycogenFromCarbs(100, 80)).toBe(2); // 1.25 г/кг
  });

  it('2-3 г/кг → 4', () => {
    expect(estimateGlycogenFromCarbs(200, 80)).toBe(4); // 2.5 г/кг
  });

  it('3-4 г/кг → 6', () => {
    expect(estimateGlycogenFromCarbs(280, 80)).toBe(6); // 3.5 г/кг
  });

  it('4-5 г/кг → 8', () => {
    expect(estimateGlycogenFromCarbs(360, 80)).toBe(8); // 4.5 г/кг
  });

  it('≥5 г/кг → 9', () => {
    expect(estimateGlycogenFromCarbs(450, 80)).toBe(9); // 5.6 г/кг
  });

  it('вес защита: 0 кг → минимум 1', () => {
    expect(estimateGlycogenFromCarbs(0, 0)).toBe(2);
  });
});
