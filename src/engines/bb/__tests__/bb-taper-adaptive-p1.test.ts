/**
 * bb-taper-adaptive-p1.test.ts — P1: stable_full, РЕД-С, соматотип, лабы, мульти-шоу.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStableFullProtocol,
  buildRedSafeProtocol,
  somatotypeTaperMod,
  labTaperWarnings,
  buildMultiShowProtocol,
  type Somatotype,
  type LabMarkers,
} from '../bb-taper-adaptive.engine';
import type { BBContestPrepConfig } from '../bb-contest-prep.engine';

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

describe('buildStableFullProtocol', () => {
  it('вода 3.5л, натрий 2800мг, углеводы по бюджету', () => {
    const p = buildStableFullProtocol(baseCfg, 8);
    expect(p.waterLitersPerDay).toBe(3.5);
    expect(p.sodiumMgPerDay).toBe(2800);
    expect(p.carbsGPerDay).toBe(720); // 90 × 8
    expect(p.notes.join(' ')).toContain('Без водных манипуляций');
  });

  it('женщина → 3.0л воды', () => {
    const p = buildStableFullProtocol({ ...baseCfg, sex: 'female' }, 6);
    expect(p.waterLitersPerDay).toBe(3.0);
    expect(p.carbsGPerDay).toBe(540); // 90 × 6
  });
});

describe('buildRedSafeProtocol', () => {
  it('мин 1600 ккал, белок 2.2 г/кг, без дефицита', () => {
    const p = buildRedSafeProtocol(baseCfg);
    expect(p.minKcalPerDay).toBe(1600);
    expect(p.proteinGPerDay).toBe(198); // 90 × 2.2
    expect(p.waterLitersPerDay).toBe(3.5);
    expect(p.sodiumMgPerDay).toBe(2800);
    expect(p.notes.join(' ')).toContain('РЕД-С протокол');
  });

  it('женщина → мин 1400 ккал', () => {
    const p = buildRedSafeProtocol({ ...baseCfg, sex: 'female' });
    expect(p.minKcalPerDay).toBe(1400);
  });
});

describe('somatotypeTaperMod', () => {
  it('эктоморф → +1 г/кг углеводов, +0.2л воды', () => {
    const m = somatotypeTaperMod('ectomorph');
    expect(m.carbBudgetDeltaGPerKg).toBe(1);
    expect(m.waterDeltaL).toBe(0.2);
  });

  it('эндоморф → −1 г/кг углеводов, −0.2л воды', () => {
    const m = somatotypeTaperMod('endomorph');
    expect(m.carbBudgetDeltaGPerKg).toBe(-1);
    expect(m.waterDeltaL).toBe(-0.2);
  });

  it('мезоморф → без изменений', () => {
    const m = somatotypeTaperMod('mesomorph');
    expect(m.carbBudgetDeltaGPerKg).toBe(0);
    expect(m.waterDeltaL).toBe(0);
  });

  it('без соматотипа → без изменений', () => {
    const m = somatotypeTaperMod(undefined);
    expect(m.carbBudgetDeltaGPerKg).toBe(0);
    expect(m.waterDeltaL).toBe(0);
  });
});

describe('labTaperWarnings', () => {
  it('без анализов → пустой массив', () => {
    expect(labTaperWarnings({})).toEqual([]);
  });

  it('ферритин <30 → moderate', () => {
    const w = labTaperWarnings({ ferritin: 20 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('ферритин');
    expect(w[0].taperImpact).toBe('moderate');
  });

  it('кортизол >20 → moderate', () => {
    const w = labTaperWarnings({ cortisol: 25 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('кортизол');
  });

  it('тестостерон <300 → moderate', () => {
    const w = labTaperWarnings({ testosterone: 250 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('тестостерон');
  });

  it('эстрадиол >40 → mild', () => {
    const w = labTaperWarnings({ estradiol: 50 });
    expect(w).toHaveLength(1);
    expect(w[0].taperImpact).toBe('mild');
  });

  it('ТТГ >4.5 → mild', () => {
    const w = labTaperWarnings({ tsh: 5.0 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('ТТГ');
  });

  it('глюкоза >100 → mild', () => {
    const w = labTaperWarnings({ glucose: 110 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('глюкоза');
  });

  it('HbA1c >5.7 → mild', () => {
    const w = labTaperWarnings({ hba1c: 6.0 });
    expect(w).toHaveLength(1);
    expect(w[0].marker).toBe('HbA1c');
  });

  it('несколько маркеров → несколько предупреждений', () => {
    const w = labTaperWarnings({ ferritin: 20, cortisol: 25, testosterone: 250 });
    expect(w).toHaveLength(3);
  });
});

describe('buildMultiShowProtocol', () => {
  it('одно шоу → один сегмент peak', () => {
    const s = buildMultiShowProtocol(['2026-11-01']);
    expect(s).toHaveLength(1);
    expect(s[0].phase).toBe('peak');
  });

  it('два шоу с разрывом >14 дней → overreach + peak', () => {
    const s = buildMultiShowProtocol(['2026-11-01', '2026-11-29']);
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.some(x => x.phase === 'overreach')).toBe(true);
    expect(s.some(x => x.phase === 'peak')).toBe(true);
  });

  it('два шоу с разрывом <14 дней → мягкий тапер без overreach', () => {
    const s = buildMultiShowProtocol(['2026-11-01', '2026-11-10']);
    expect(s.some(x => x.phase === 'overreach')).toBe(false);
    expect(s.every(x => x.phase === 'peak')).toBe(true);
  });

  it('пустой массив → пустой результат', () => {
    expect(buildMultiShowProtocol([])).toEqual([]);
  });
});
