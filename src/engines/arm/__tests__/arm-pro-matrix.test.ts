import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { ARM_SPLIT_PATTERNS } from '../arm-split-patterns';
import { planBilateralVolume } from '../arm-bilateral.engine';

const TECHNIQUES = ['hook', 'toproll', 'press', 'balanced'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced', 'enhanced'] as const;

// Полный PRO-ввод: все новые поля задействованы одновременно.
function fullProInput(patternId: string, technique: string, level: string): any {
  return {
    discipline: 'armwrestling',
    patternId,
    level,
    goal: 'strength',
    technique,
    weeks: 4,
    bodyWeightKg: 84.5,
    ageYears: 30,
    arm: 'both',
    sex: 'male',
    leftKg: 80,
    rightKg: 100,
    competitionDateIso: '2026-10-15',
    targetWeightKg: 85,
    supermatch: true,
    strapExpected: true,
    sparring: { intensityPct: 70 as const, partnerDeltaKg: 2 },
    diary: [{ dateIso: '2026-09-01', srpe: 6, elbowPain: 1 }],
    bench: { wristCurlLb: 60, rtKg: 70, pronHoldSec: 30, sideKg: 40 },
    trackCsv: 't,x,y\n0,4,8\n0.1,6,7\n0.2,8,6\n0.3,10,5',
  };
}

describe('arm-pro-matrix (все сплиты × техники × уровни, полный PRO-ввод)', () => {
  it('128 комбинаций: сборка без throw, PRO-строки, детерминизм', () => {
    let count = 0;
    for (const pat of ARM_SPLIT_PATTERNS) {
      if (pat.id.startsWith('grip_')) continue; // grip-паттерны — армлифтинг, отдельный дисперсионный путь
      for (const tech of TECHNIQUES) {
        for (const lvl of LEVELS) {
          const input = fullProInput(pat.id, tech, lvl);
          const p1: any = buildArmPlan(input);
          const p2: any = buildArmPlan(input);
          // детерминизм побайтово
          expect(JSON.stringify(p2)).toBe(JSON.stringify(p1));
          const all = p1.rationale.join(' ');
          expect(all).toMatch(/WAF/);
          expect(all).toMatch(/L\/R/);
          expect(all).toMatch(/Бенчи/);
          expect(all).toMatch(/Суперматч/);
          expect(all).toMatch(/Ремень/);
          expect(all).toMatch(/До старта/);
          expect(all).toMatch(/Видео/);
          expect(Array.isArray(p1.safetyWarnings)).toBe(true);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(80);
  });
  it('валидатор: нет mrvOverflow на всей матрице', () => {
    for (const pat of ARM_SPLIT_PATTERNS) {
      for (const tech of TECHNIQUES) {
        for (const lvl of LEVELS) {
          const p: any = buildArmPlan(fullProInput(pat.id, tech, lvl));
          const v = validateArmPlan(p, lvl);
          expect(v.mrvOverflow || []).toEqual([]);
          expect(v.valid).toBe(true);
        }
      }
    }
  });
  it('билатеральное свойство: слабая ≥ сильной на сетке L/R', () => {
    for (let l = 50; l <= 120; l += 10) {
      for (let r = 50; r <= 120; r += 10) {
        const p = planBilateralVolume({ leftKg: l, rightKg: r, baseSets: 10, mrvSets: 14 });
        expect(p.weakSets).toBeGreaterThanOrEqual(p.strongSets);
        expect(p.weakSets).toBeLessThanOrEqual(14);
        expect(p.strongSets).toBeLessThanOrEqual(14);
        expect(p.strongSets).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('дневник-стресс не ломает матрицу (sRPE 9 + боль 6)', () => {
    for (const pat of ARM_SPLIT_PATTERNS) {
      const p: any = buildArmPlan({
        ...fullProInput(pat.id, 'hook', 'intermediate'),
        diary: [{ dateIso: '2026-09-01', srpe: 9, elbowPain: 6, wristPain: 5 }],
      });
      const v = validateArmPlan(p, 'intermediate');
      expect(v.mrvOverflow || []).toEqual([]);
      expect(p.safetyWarnings.join(' ')).toMatch(/Авторегуляция/);
    }
  });
});
