/**
 * bb-taper-pro3-e11.test.ts — PRO-3 Э11/Э12 «дедуп UI + гигиена»:
 *   мёртвая ветка showPeakWeek/peakPrep удалена (шаг коррекции), пик-неделя — единый
 *   ContestPeakWeekCard в шаге contest; история корректировок — через recordPrepAdjustment;
 *   prepPlanCompleted удалён (0 потребителей).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts');

describe('PRO-3 Э11 — дедуп пик-недели', () => {
  const step = readFileSync(resolve(DIR, 'bb-step-adjust.tsx'), 'utf8');
  const bb = readFileSync(resolve(DIR, 'BbAutoConstructor.tsx'), 'utf8');

  it('мёртвая ветка showPeakWeek/peakPrep удалена, props не передаются', () => {
    expect(step).not.toMatch(/showPeakWeek \&\& peakPrep/);
    expect(step).not.toMatch(/peakPrep: BBContestPrepResult/);
    expect(bb).not.toMatch(/const \[showPeakWeek/);
    expect(bb).not.toMatch(/const \[peakPrep/);
    expect(bb).not.toMatch(/showPeakWeek=\{showPeakWeek\}/);
    expect(bb).not.toMatch(/peakPrep=\{peakPrep\}/);
  });

  it('ContestPeakWeekCard остаётся единым рендером пик-недели (шаг contest)', () => {
    // рендерится в shared-секциях через shared-компонент (Preview/шаг contest)
    const sec = readFileSync(resolve(DIR, 'bb-contest-prep-sections.tsx'), 'utf8');
    expect(sec).toMatch(/buildPeakWeek|ContestPeakWeekCard/);
  });
});

describe('PRO-3 Э12 — гигиена', () => {
  it('история корректировок идёт через recordPrepAdjustment (не ручной массив)', () => {
    const bb = readFileSync(resolve(DIR, 'BbAutoConstructor.tsx'), 'utf8');
    expect(bb).toMatch(/recordPrepAdjustment\(next, \{/);
    expect(bb).not.toMatch(/adjustments: \[\s*\.\.\.\(prepPlan\.adjustments/);
  });

  it('prepPlanCompleted удалён из движка (0 потребителей)', () => {
    const eng = readFileSync(resolve(__dirname, '..', 'bb-contest-prep.engine.ts'), 'utf8');
    expect(eng).not.toMatch(/export function prepPlanCompleted/);
  });
});
