/**
 * plan-schedule-dose-parity.test.ts — guard прохода 17 аудита калькулятора поддержки.
 *
 * Дефект: дозу плана считали ДВЕ модели.
 *  - карточка (`buildSubstances` → `resolvePlanDose`): вес-доза `WEIGHT_BASED_DOSING`
 *    (магний 2.5 мг/кг, потолок 350 = UL);
 *  - расписание `PlanResult.schedule` собиралось повторным резолвом `DEFAULT_DOSAGES`
 *    без веса → при 140 кг карточка «Магний 350 мг», расписание «Магний 200 мг».
 *
 * Теперь расписание строится из уже готовых `PlanSubstance[]` (`buildScheduleFromPlan`),
 * поэтому доза в карточке и в приёме совпадает по построению.
 */
import { describe, expect, it } from 'vitest';
import { buildScheduleFromPlan, buildSubstances } from '../support-plan/substances';
import { applyTitration } from '../support-plan/engine-helpers';
import { runSupportUnified } from '../support-plan/index';
import type { CalculatorResult, CalculatorState } from '../support-plan/types';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

const tzStub = {} as CalculatorResult;

const lightState = (weight: number) => ({
  courseWeek: 8,
  profile: { weight, age: 30, sex: 'male' },
  cardio: {},
  pharma: { aas: [] },
}) as unknown as CalculatorState;

const flatten = (schedule: Array<{ substances: Array<{ id: string; dose: string }> }>) =>
  schedule.flatMap((b) => b.substances);

describe('расписание = карточка плана (одна доза)', () => {
  it('doseDisplay карточки попадает в расписание 1:1', () => {
    const subs = buildSubstances(
      ['magnesium', 'selenium', 'vitamin_d3', 'vitamin_c', 'biotin'],
      tzStub,
      undefined,
      140,
    );
    const rows = flatten(buildScheduleFromPlan(subs));
    for (const s of subs) {
      const row = rows.find((r) => r.id === s.id);
      expect(row, `нет строки расписания для ${s.id}`).toBeTruthy();
      expect(row!.dose).toBe(s.doseDisplay);
    }
  });

  it('140 кг: магний = 350 мг (вес-доза, потолок UL), а не 200 мг справочника', () => {
    const subs = buildSubstances(['magnesium'], tzStub, undefined, 140);
    const rows = flatten(buildScheduleFromPlan(subs));
    expect(rows[0].dose).toBe('350 мг');
    expect(rows[0].dose).toBe(subs[0].doseDisplay);
  });

  it('60 кг: магний не ниже минимума 200 мг и совпадает с карточкой', () => {
    const subs = buildSubstances(['magnesium'], tzStub, undefined, 60);
    const rows = flatten(buildScheduleFromPlan(subs));
    expect(subs[0].doseDisplay).toBe('200 мг');
    expect(rows[0].dose).toBe('200 мг');
  });

  it('E2E: у каждого вещества плана доза в приёме равна дозе карточки', () => {
    const state = {
      ...DEFAULT_STATE,
      profile: { ...DEFAULT_STATE.profile, weight: 140 },
      pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }] },
    } as CalculatorState;
    const plan = runSupportUnified(state);
    const rows = flatten(plan.schedule);
    expect(plan.substances.length).toBeGreaterThan(0);
    for (const s of plan.substances) {
      const row = rows.find((r) => r.id === s.id);
      expect(row, `нет строки расписания для ${s.id}`).toBeTruthy();
      expect(row!.dose).toBe(s.doseDisplay);
    }
  });

  it('карточка и карта титрации дают одну дозу (60/80/140/200 кг)', () => {
    const ids = ['magnesium', 'zinc', 'vitamin_d3', 'selenium', 'vitamin_c', 'omega3', 'alpha_lipoic', 'coq10', 'glycine', 'potassium'];
    for (const weight of [60, 80, 140, 200]) {
      const subs = buildSubstances(ids, tzStub, undefined, weight);
      const tit = applyTitration(ids, lightState(weight));
      for (const s of subs) {
        // Карточка хранит натуральную единицу; витамин D в титрации — мкг.
        const expected = s.id === 'vitamin_d3' ? s.doseMg / 40 : s.doseMg;
        expect(tit[s.id], `${s.id} @${weight} кг`).toBe(expected);
      }
    }
  });
});
