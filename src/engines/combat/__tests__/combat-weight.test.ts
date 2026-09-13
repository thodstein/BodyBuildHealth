import { describe, it, expect } from 'vitest';
import { buildCombatPlan, validateCombatPlan } from '../combat-builder.engine';
import {
  weightClassesFor,
  weightClassFor,
  weightToClassBoundary,
  weightClassLine,
  weightClassRulesetNote,
} from '../combat-weight-class.engine';

/**
 * combat-weight (P4): весовые категории + ISSN-чеклист в сборке.
 * Без категории — поведение 1-в-1 (кг в вакууме, как раньше).
 */
describe('combat weight classes', () => {
  it('таблицы М/Ж непусты (кроме general), лимиты по возрастанию', () => {
    for (const disc of ['boxing', 'mma', 'wrestling', 'kickboxing', 'judo', 'sambo', 'bjj']) {
      for (const sex of ['male', 'female'] as const) {
        const rows = weightClassesFor(disc, sex);
        expect(rows.length, `${disc}/${sex}`).toBeGreaterThan(0);
        const lims = rows.map(r => r.limitKg);
        expect([...lims].sort((a, b) => a - b)).toEqual(lims);
      }
    }
    expect(weightClassesFor('general', 'male')).toEqual([]);
  });

  it('дзюдо/самбо/BJJ — сверка с IJF/FIAS/IBJJF', () => {
    expect(weightClassesFor('judo', 'male').map(r => r.limitKg)).toEqual([60, 66, 73, 81, 90, 100, Infinity]);
    expect(weightClassesFor('judo', 'female').map(r => r.limitKg)).toEqual([48, 52, 57, 63, 70, 78, Infinity]);
    expect(weightClassesFor('sambo', 'male').map(r => r.limitKg)).toEqual([58, 64, 71, 79, 88, 98, Infinity]);
    expect(weightClassesFor('sambo', 'female').map(r => r.limitKg)).toEqual([50, 54, 59, 65, 72, 80, Infinity]);
    expect(weightClassesFor('bjj', 'male').map(r => r.limitKg)).toEqual([57.5, 64, 70, 76, 82.3, 88.3, 94.3, 100.5, Infinity]);
    expect(weightClassesFor('bjj', 'female').map(r => r.limitKg)).toEqual([48.5, 53.5, 58.5, 64, 69, 74, 79.3, Infinity]);
  });

  it('weightClassFor: 80кг боксёр М → 80 кг; 82кг → 92 кг', () => {
    expect(weightClassFor('boxing', 'male', 80)?.limitKg).toBe(80);
    expect(weightClassFor('boxing', 'male', 82)?.limitKg).toBe(92);
    expect(weightClassFor('mma', 'female', 60)?.limitKg).toBe(61.2);
    expect(weightClassFor('judo', 'male', 74)?.limitKg).toBe(81);
    expect(weightClassFor('sambo', 'female', 66)?.limitKg).toBe(72);
    expect(weightClassFor('bjj', 'male', 83)?.limitKg).toBe(88.3);
    expect(weightClassFor('boxing', 'male', null)).toBeNull();
    expect(weightClassFor('general', 'male', 80)).toBeNull();
  });

  it('boundary/line: запас и нехватка со знаком', () => {
    expect(weightToClassBoundary(80, 4, 77.1)).toBe(1.1);
    expect(weightToClassBoundary(80, 2, 77.1)).toBe(-0.9);
    expect(weightToClassBoundary(80, 4, null)).toBeNull();
    const line = weightClassLine(80, 4, 77.1, '170 lbs (77.1 кг)');
    expect(line).toContain('цель 76 кг');
    expect(line).toContain('запас +1.1 кг');
    expect(weightClassLine(80, 2, 77.1, null)).toContain('не хватает 0.9 кг');
  });

  it('ruleset-пометка: только BJJ (вес в кимоно), остальным — null', () => {
    expect(weightClassRulesetNote('bjj')).toContain('кимоно');
    expect(weightClassRulesetNote('BJJ')).toContain('кимоно');
    expect(weightClassRulesetNote('judo')).toBeNull();
    expect(weightClassRulesetNote('mma')).toBeNull();
    expect(weightClassRulesetNote(null)).toBeNull();
    expect(weightClassRulesetNote('general')).toBeNull();
  });
});

describe('combat P4 builder wiring', () => {
  it('сгонка не доводит до лимита — error; доводит — ok', () => {
    const short = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 2, weightClassLimitKg: 77.1, weightClass: '170 lbs',
    } as any);
    expect(validateCombatPlan(short).errors.some(e => e.includes('не доводит до лимита'))).toBe(true);
    const fit = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 4, weightClassLimitKg: 77.1, weightClass: '170 lbs',
    } as any);
    expect(validateCombatPlan(fit).errors.some(e => e.includes('не доводит до лимита'))).toBe(false);
  });

  it('вне кэмпа +20% к лимиту — warning про +12–15%', () => {
    const plan = buildCombatPlan({
      discipline: 'boxing', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 86, weightCutKg: 6, weightClassLimitKg: 71,
    } as any);
    expect(validateCombatPlan(plan).warnings.some(w => w.includes('+12–15%'))).toBe(true);
  });

  it('ISSN-пункты протокола всплывают: мед-блок → errors, темп → warnings', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 8,
      weightCutProtocol: { targetLossKg: 8, weeksOut: 4, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable' } as any,
    } as any);
    const v = validateCombatPlan(plan);
    // темп 2кг/нед — совет, не мед-блок
    expect(v.warnings.some(w => w.includes('кг/нед'))).toBe(true);
    const medical = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 9,
      weightCutProtocol: { targetLossKg: 9, weeksOut: 8, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable' } as any,
    } as any);
    expect(validateCombatPlan(medical).errors.some(e => e.includes('врач'))).toBe(true);
  });

  it('без категории — как раньше: ни класс-ошибок, ни класс-строк', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 4,
    } as any);
    const v = validateCombatPlan(plan);
    expect(v.errors.some(e => e.includes('лимита'))).toBe(false);
    expect(plan.rationale.some(r => r.includes('Категория'))).toBe(false);
  });

  it('самбо-лимит в сборке: недовод — error, довод — тихо', () => {
    const short = buildCombatPlan({
      discipline: 'wrestling', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 82, weightCutKg: 2, weightClassLimitKg: 79, weightClass: '79 кг',
    } as any);
    expect(validateCombatPlan(short).errors.some(e => e.includes('не доводит до лимита'))).toBe(true);
    const fit = buildCombatPlan({
      discipline: 'wrestling', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 82, weightCutKg: 4, weightClassLimitKg: 79, weightClass: '79 кг',
    } as any);
    expect(validateCombatPlan(fit).errors.some(e => e.includes('не доводит до лимита'))).toBe(false);
  });

  it('строка категории попадает в rationale', () => {
    const plan = buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      bodyweight: 80, weightCutKg: 4, weightClassLimitKg: 77.1, weightClass: '170 lbs',
    } as any);
    expect(plan.rationale.some(r => r.includes('Категория') && r.includes('запас'))).toBe(true);
  });
});
