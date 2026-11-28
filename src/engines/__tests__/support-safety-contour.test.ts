/**
 * support-safety-contour.test.ts — этап E3: безопасность видит то, что видит пользователь.
 *
 * Два дефекта, которые закрывает проход 211:
 *  1. DDI читал только вещества плана — препараты профиля (`he_profile_v2` →
 *     `nutrition.currentMedications`) в него не попадали, поэтому class-правила
 *     `@anticoagulant` / `@ssri` / `@nsaid` в плане были мёртвыми.
 *  2. СКФ считалась моделью риска, но противопоказания знали только галочку
 *     «болезнь почек». Человек с eGFR 28 и без галочки получал калий/спиронолактон
 *     без предупреждения.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateSupportTZ } from '../support-plan/engine';
import { blockFlagsForPlan, ckdStagesFromEgfr, contraindicationFlagsForPlan } from '../support-plan/engine-helpers';
import { runSupportUnified } from '../support-plan';
import type { CalculatorState } from '../support-plan/types';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

const courseState = (): CalculatorState =>
  ({
    ...DEFAULT_STATE,
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }],
    },
  }) as CalculatorState;

const alertsText = (state: CalculatorState): string => calculateSupportTZ(state).contraindicationAlerts.join('\n');

beforeEach(() => {
  localStorage.clear();
});

describe('препараты профиля попадают в DDI-контур', () => {
  it('план курса содержит омега-3 — правило про антикоагулянт есть с кем сопоставить', () => {
    const res = calculateSupportTZ(courseState());
    expect(res.selectedSubstances).toContain('omega3');
  });

  it('без препаратов профиля класс-правило не срабатывает', () => {
    expect(alertsText(courseState())).not.toContain('omega3 + @anticoagulant');
  });

  it('варфарин в профиле — предупреждение «омега-3 + антикоагулянт» появляется', () => {
    localStorage.setItem(
      'he_profile_v2',
      JSON.stringify({ nutrition: { currentMedications: [{ id: 'warfarin', name: 'Варфарин' }] } }),
    );
    expect(alertsText(courseState())).toContain('omega3 + @anticoagulant');
  });

  it('русское название препарата тоже резолвится (Варфарин, не только id)', () => {
    localStorage.setItem(
      'he_profile_v2',
      JSON.stringify({ nutrition: { currentMedications: [{ name: 'Варфарин' }] } }),
    );
    expect(alertsText(courseState())).toContain('omega3 + @anticoagulant');
  });

  it('битый профиль не ломает расчёт (нет данных — нет DDI, а не падение)', () => {
    localStorage.setItem('he_profile_v2', '{не json');
    expect(() => calculateSupportTZ(courseState())).not.toThrow();
  });
});

describe('СКФ → категория ХБП (KDIGO G3/G4)', () => {
  it('границы категорий: 29.9 → ст.4-5, 30 → ст.3, 59.9 → ст.3, 60 → нет', () => {
    expect(ckdStagesFromEgfr(29.9)).toEqual(['ckd_stage4_5']);
    expect(ckdStagesFromEgfr(30)).toEqual(['ckd_stage3']);
    expect(ckdStagesFromEgfr(59.9)).toEqual(['ckd_stage3']);
    expect(ckdStagesFromEgfr(60)).toEqual([]);
  });

  it('нет СКФ — нет стадии («нет записи» ≠ «почки в норме»)', () => {
    expect(ckdStagesFromEgfr(undefined)).toEqual([]);
    expect(ckdStagesFromEgfr(null)).toEqual([]);
    expect(ckdStagesFromEgfr(Number.NaN)).toEqual([]);
  });
});

describe('block-DDI помечает карточку, но не меняет план', () => {
  it('флаг только у вещества из плана; warn и класс-концы не помечаются', () => {
    const flags = blockFlagsForPlan(
      [
        { a: 'tadalafil', b: 'nitrates', severity: 'block', reason: 'фатальная гипотония' },
        { a: 'omega3', b: '@anticoagulant', severity: 'warn', reason: 'аддитивный фибринолиз' },
        { a: '@statin', b: 'coq10', severity: 'warn', reason: 'миопатия' },
      ],
      ['tadalafil', 'coq10'],
    );
    expect(flags.tadalafil?.[0]).toContain('фатальная гипотония');
    expect(flags.coq10).toBeUndefined();
    expect(flags.nitrates).toBeUndefined();
  });

  it('противопоказания: absolute → ⛔, relative → ⚠, только вещества плана', () => {
    const flags = contraindicationFlagsForPlan(
      [
        {
          substanceId: 'potassium',
          severity: 'absolute',
          message: '⛔ ckd_stage4_5 — противопоказано',
          action: '⛔ Не назначать',
        },
        { substanceId: 'vitamin_b6', severity: 'relative', message: '⚠ elderly', action: '⚠ Осторожно' },
        { substanceId: 'spironolactone', severity: 'absolute', message: '⛔ hyperkalemia', action: '⛔ Не назначать' },
      ],
      ['potassium', 'p5p'],
    );
    expect(flags.potassium?.[0]).toMatch(/^⛔ ckd_stage4_5/);
    expect(flags.vitamin_b6).toBeUndefined();
    expect(flags.spironolactone).toBeUndefined();
  });
});

describe('обрезка плана названа (E6)', () => {
  it('planTrim есть в результате и не врёт о числе показанных', () => {
    const plan = runSupportUnified(courseState());
    expect(plan.planTrim).toBeDefined();
    const trim = plan.planTrim!;
    expect(trim.limit).toBeGreaterThanOrEqual(28);
    expect(trim.candidates).toBeGreaterThanOrEqual(trim.shown);
    expect(trim.shown).toBeGreaterThan(0);
  });

  it('после опций shown равен фактическому списку, candidates не меньше', () => {
    const state = {
      ...courseState(),
      options: { dietAware: true },
      nutrition: { ...DEFAULT_STATE.nutrition, takenSupplements: [{ id: 'omega3', doseMg: 2000 }] },
    } as CalculatorState;
    const plan = runSupportUnified(state);
    expect(plan.planTrim!.shown).toBe(plan.substances.length);
    expect(plan.planTrim!.candidates).toBeGreaterThanOrEqual(plan.planTrim!.shown);
  });
});
