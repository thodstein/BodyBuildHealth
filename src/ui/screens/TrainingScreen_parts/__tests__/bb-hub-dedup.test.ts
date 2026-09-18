/**
 * 3.11 (план BB-AUTO-EXHAUSTIVE-PRO) — guard ББ-хаба:
 *  - единый парсинг плана из storage (pickPlanFromSaved) вместо 4 копий;
 *  - rankCorrectionsForWeak — один вызов (мемо top3ByZone), не 3;
 *  - факт-объём считается каноническим aggregateBBVolume.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickPlanFromSaved } from '../BBDiagnosticsHub';

const SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

describe('3.11 pickPlanFromSaved — единый парсинг storage', () => {
  const plan = { weeks: [{ week: 1, sessions: [] }] };
  it('распознаёт {plan:{weeks}} / {weeks} / [{plan:{weeks}}]', () => {
    expect(pickPlanFromSaved({ plan, date: 'x' })).toBe(plan);
    expect(pickPlanFromSaved(plan)).toBe(plan);
    expect(pickPlanFromSaved([{ plan }])).toBe(plan);
  });
  it('мусор и пустое → null', () => {
    expect(pickPlanFromSaved(null)).toBeNull();
    expect(pickPlanFromSaved({})).toBeNull();
    expect(pickPlanFromSaved('nope')).toBeNull();
    expect(pickPlanFromSaved([{ foo: 1 }])).toBeNull();
  });
});

describe('3.11 dedup (source-guard)', () => {
  it('rankCorrectionsForWeak вызывается ровно один раз (мемо top3ByZone)', () => {
    const calls = (SRC.match(/rankCorrectionsForWeak\(/g) || []).length;
    expect(calls).toBe(1);
  });

  it('факт-объём через aggregateBBVolume', () => {
    expect(SRC).toContain('aggregateBBVolume([{ exercises }])');
  });

  it('inline JSON.parse(he_bb_plan_saved) остался только для raw-снапшота (≤1)', () => {
    const inline = (SRC.match(/JSON\.parse\(localStorage\.getItem\('he_bb_plan_saved'\)/g) || []).length;
    expect(inline).toBeLessThanOrEqual(1);
    // канонический helper присутствует; PRO-5 Э5-доводка (было ≥3 → стало 1 вызов):
    // все поверхности читают мемо savedPlan (единое чтение на рендер), дублей нет.
    expect(SRC).toContain('function readSavedBbPlan(');
    expect((SRC.match(/readSavedBbPlan\(\);/g) || []).length).toBe(1);
  });
});
