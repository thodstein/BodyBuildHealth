/**
 * plan-ul-warnings.test.ts — guard: UL считается по ФАКТИЧЕСКИМ дозам плана,
 * и эта честность доходит до `PlanResult`.
 *
 * Раньше `CalculatorResult.ulWarnings` считался (с нормализацией по весу и
 * UL-капом), но `PlanResult` его не содержал и экран поддержки не показывал.
 * «Контроль дозировок» в калькуляторе брал ТИПОВЫЕ дозы каталога
 * (`checkStackToxicity`), поэтому фактические дозы плана в UL-проверке не
 * участвовали: высокий вес → расчётная доза выходит за UL, капается, а
 * пользователь этого не видит.
 */
import { describe, expect, it } from 'vitest';
import { runSupportUnified } from '../support-plan/index';
import { calculateSupportTZ } from '../support-plan/engine';
import { checkUpperLimits } from '../support-plan/engine-helpers';
import type { CalculatorState } from '../support-plan/types';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function heavyState(weight = 300): CalculatorState {
  return {
    ...DEFAULT_STATE,
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12, startWeek: 1, endWeek: 12 }],
    },
    profile: { ...DEFAULT_STATE.profile, weight },
    powerLevel: 'max',
  } as CalculatorState;
}

describe('checkUpperLimits: доза до капа и после капа', () => {
  it('предупреждение несёт и расчётную, и применённую дозу', () => {
    const w = checkUpperLimits(['vitamin_d3'], { vitamin_d3: 100 }, { vitamin_d3: 149 });
    expect(w).toHaveLength(1);
    expect(w[0].currentDoseMg).toBe(149);   // до капа — реальный расчёт
    expect(w[0].ulMg).toBe(100);            // UL в мкг (4000 МЕ)
    expect(w[0].appliedDoseMg).toBe(100);   // после капа — что в плане
    expect(w[0].percentUL).toBe(149);
  });

  it('ровно на UL — без предупреждения', () => {
    expect(checkUpperLimits(['vitamin_d3'], { vitamin_d3: 100 }, { vitamin_d3: 100 })).toHaveLength(0);
  });

  it('без записи в doses применённая доза не выдумывается', () => {
    const w = checkUpperLimits(['selenium'], {}, { selenium: 300 });
    expect(w).toHaveLength(1);
    expect(w[0].appliedDoseMg).toBeUndefined();
  });
});

describe('PlanResult.ulWarnings — та же цифра, что в движке', () => {
  const state = heavyState();
  const plan = runSupportUnified(state);
  const tz = calculateSupportTZ(state);

  it('план прокидывает предупреждения движка', () => {
    expect(plan.ulWarnings).toEqual(tz.ulWarnings);
  });

  it('при весе 300 кг превышение реально есть (иначе тест ничего не проверяет)', () => {
    expect((plan.ulWarnings || []).length).toBeGreaterThan(0);
  });

  it('применённая доза не выше UL и ниже расчётной', () => {
    for (const w of plan.ulWarnings || []) {
      expect(w.currentDoseMg).toBeGreaterThan(w.ulMg);
      if (w.appliedDoseMg !== undefined) {
        expect(w.appliedDoseMg).toBeLessThanOrEqual(w.ulMg);
        expect(w.appliedDoseMg).toBeLessThan(w.currentDoseMg);
      }
    }
  });

  it('предупреждения подписаны единицей вещества, а не «мг» для всех', () => {
    const d3 = (plan.ulWarnings || []).find(w => w.substanceId === 'vitamin_d3');
    if (d3) {
      // UL витамина D — 100 мкг = 4000 МЕ (единая шкала движка).
      expect(d3.ulMg).toBe(100);
    }
    for (const w of plan.ulWarnings || []) {
      expect(typeof w.risk).toBe('string');
      expect(w.recommendation).toContain('UL');
    }
  });
});
