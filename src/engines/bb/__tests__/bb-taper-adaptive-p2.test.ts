/**
 * bb-taper-adaptive-p2.test.ts — визуализация кривой тапера и сравнение стратегий загрузки.
 */
import { describe, it, expect } from 'vitest';
import {
  taperCurveSVG,
  compareTaperStrategies,
} from '../bb-taper-adaptive.engine';
import type { BBContestPrepConfig, TrainingTaperWeek } from '../bb-contest-prep.engine';

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

const taper4: TrainingTaperWeek[] = [
  { weekOffset: -4, label: 'Подводящая', volumePct: 0.9, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: '', deloadBefore: true },
  { weekOffset: -3, label: 'Taper-2', volumePct: 0.85, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: '', deloadBefore: false },
  { weekOffset: -2, label: 'Taper-1', volumePct: 0.7, intensityPct: 0.9, rirMin: 2, rirMax: 4, focus: '', deloadBefore: false },
  { weekOffset: -1, label: 'Финал', volumePct: 0.6, intensityPct: 0.85, rirMin: 2, rirMax: 4, focus: '', deloadBefore: false },
];

describe('taperCurveSVG', () => {
  it('возвращает SVG с полилиниями', () => {
    const svg = taperCurveSVG(taper4);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('объём');
  });

  it('пустой тапер → пустая строка', () => {
    expect(taperCurveSVG([])).toBe('');
  });
});

describe('compareTaperStrategies', () => {
  it('6 стратегий для категории', () => {
    const rows = compareTaperStrategies(baseCfg.category);
    expect(rows).toHaveLength(6);
    expect(rows.map(r => r.strategy)).toEqual(['front', 'moderate', 'back', 'undulating', 'linear', 'direct']);
  });

  it('у каждой стратегии бюджет и spill risk', () => {
    for (const r of compareTaperStrategies(baseCfg.category)) {
      expect(r.carbBudgetGPerKg[0]).toBeGreaterThan(0);
      expect(r.carbBudgetGPerKg[1]).toBeGreaterThanOrEqual(r.carbBudgetGPerKg[0]);
      expect(['low', 'medium', 'high']).toContain(r.spillRisk);
      expect(r.bestFor.length).toBeGreaterThan(0);
    }
  });
});
