/**
 * plan-mechanisms.test.ts — guard честности «покрытия механизмов» в плане.
 *
 * Раньше `PlanResult.mechanisms` строился по органу: любое вещество поддержки
 * с organId системы объявлялось покрывающим ВСЕ механизмы этой системы. План
 * показывал «Механизмы с покрытием (28)» и подписывал непокрытые механизмы как
 * покрытые. Плюс `uncoveredMechanisms` вообще не выводился в UI.
 *
 * Теперь `mechanisms` строится из механизм-модели: только механизмы с риском
 * (raw > 0), покрытие — по `k_used` (тот же критерий, что в
 * `mechanismCoverageOf`), а непокрытые попадают в `uncoveredMechanisms`.
 */
import { describe, expect, it } from 'vitest';
import { runSupportUnified } from '../support-plan/index';
import type { CalculatorState } from '../support-plan/types';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';
import { getSupportMechs } from '../../data/support-db/mech-map';

function stateWith(ids: string[], overrides: Partial<CalculatorState> = {}) {
  return {
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: ids.map(id => ({ id, doseMgWeek: 500, weeks: 12 })) },
    ...overrides,
  } as CalculatorState;
}

describe('PlanResult.mechanisms — покрытие по механизмам, а не по органам', () => {
  const plan = runSupportUnified(stateWith(['test_enan', 'tren_enan']));

  it('список = ровно механизмы риска, как в mechanismCoverage', () => {
    const mc = plan.mechanismCoverage!;
    expect(plan.mechanisms.length).toBe(mc.total);
    expect(plan.mechanisms.filter(m => m.covered !== false).length).toBe(mc.covered);
  });

  it('проценты покрытия совпадают во всех полях плана', () => {
    const mc = plan.mechanismCoverage!;
    const percent = Math.round((mc.covered / mc.total) * 100);
    expect(mc.percent).toBe(percent);
    const fromList = Math.round(
      (plan.mechanisms.filter(m => m.covered !== false).length / plan.mechanisms.length) * 100,
    );
    expect(fromList).toBe(percent);
  });

  it('механизмы — реальные id модели, с русской подписью и системой', () => {
    for (const m of plan.mechanisms) {
      expect(m.mechKey).not.toContain('.');       // старый формат «cardio.cv1»
      expect(m.mechLabel.length).toBeGreaterThan(2);
      expect(m.systemLabel.length).toBeGreaterThan(2);
      expect(m.riskBefore).toBeGreaterThan(0);
    }
  });

  it('покрытый механизм называет вещества, которые действительно дают ему k', () => {
    const selected = plan.substances.map(s => s.id);
    for (const m of plan.mechanisms.filter(x => x.covered)) {
      expect(m.substances.length).toBeGreaterThan(0);
      for (const subId of m.substances) {
        expect(selected).toContain(subId);
        const entries = getSupportMechs(subId);
        const direct = entries.some(e => e.mechId === m.mechKey);
        // либо прямая запись механизма, либо синергетическое трио движка
        expect(direct || ['hem1', 'hem2', 'cv3', 'cv4'].includes(m.mechKey)).toBe(true);
      }
    }
  });

  it('uncoveredMechanisms — дополнение к покрытым, без пересечений и повторов', () => {
    const coveredKeys = plan.mechanisms.filter(m => m.covered !== false).map(m => m.mechKey);
    const uncoveredKeys = plan.uncoveredMechanisms.map(m => m.mechKey);
    expect(uncoveredKeys.length + coveredKeys.length).toBe(plan.mechanisms.length);
    for (const k of uncoveredKeys) expect(coveredKeys).not.toContain(k);
    expect(new Set(plan.uncoveredMechanisms.map(m => m.mechLabel)).size).toBe(plan.uncoveredMechanisms.length);
  });

  it('непокрытые отсортированы по риску — первыми самые опасные', () => {
    const risks = plan.uncoveredMechanisms.map(m => m.risk);
    expect(risks).toEqual([...risks].sort((a, b) => b - a));
  });

  it('курс с более широкой поддержкой не закрывает меньше механизмов', () => {
    const basic = runSupportUnified(stateWith(['test_enan'], { powerLevel: 'basic' } as any));
    const max = runSupportUnified(stateWith(['test_enan'], { powerLevel: 'max' } as any));
    const covered = (p: typeof basic) => p.mechanisms.filter(m => m.covered !== false).length;
    expect(covered(max)).toBeGreaterThanOrEqual(covered(basic));
  });
});
