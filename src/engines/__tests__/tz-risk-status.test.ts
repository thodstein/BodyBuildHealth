/**
 * tz-risk-status.test.ts — guard честного статуса расчёта риска.
 *
 * Аудит 2026-11: препарат без записи в `DRUG_DB` давал 0 вклада во все
 * механизмы, и экран показывал «риск 0% / покрытие 100%» — то есть выдуманные
 * цифры. Теперь модель обязана вернуть статус:
 *   ok      — все препараты смоделированы;
 *   partial — часть препаратов неизвестна (список в unmodeledDrugs);
 *   no_data — ни одного смоделированного препарата (цифры не показываем).
 */
import { describe, it, expect } from 'vitest';
import { calculateTzSpecRisk, type TzSpecInput } from '../risk-engine-tz-spec';
import { getSupportMechIndex, DERIVED_SOURCE } from '../../data/support-db/mech-map';

const base = (drugs: TzSpecInput['drugs']): TzSpecInput => ({
  drugClass: 'aas',
  drugName: 'test_enan',
  dose: 500,
  duration: 12,
  form: 'inject',
  combinations: 1,
  labCoverage: 0,
  drugs,
  labValues: {},
  supportSubstances: [],
} as TzSpecInput);

const drug = (drugName: string) => ({ drugClass: 'aas', drugName, dose: 500, form: 'inject' } as any);

describe('riskStatus', () => {
  it('известный препарат → ok, список неизвестных пуст', () => {
    const r = calculateTzSpecRisk(base([drug('test_enan')]));
    expect(r.riskStatus).toBe('ok');
    expect(r.unmodeledDrugs).toEqual([]);
  });

  it('неизвестный препарат → no_data и он попадает в unmodeledDrugs', () => {
    const r = calculateTzSpecRisk(base([drug('unknown_drug_xyz')]));
    expect(r.riskStatus).toBe('no_data');
    expect(r.unmodeledDrugs).toContain('unknown_drug_xyz');
  });

  it('смесь известного и неизвестного → partial', () => {
    const r = calculateTzSpecRisk(base([drug('test_enan'), drug('unknown_drug_xyz')]));
    expect(r.riskStatus).toBe('partial');
    expect(r.unmodeledDrugs).toContain('unknown_drug_xyz');
  });

  it('неизвестная поддержка не ломает статус, но попадает в unmappedSupport', () => {
    const r = calculateTzSpecRisk({
      ...base([drug('test_enan')]),
      supportSubstances: ['totally_unknown_support_xyz'],
    } as TzSpecInput);
    expect(r.riskStatus).toBe('ok');
    expect(r.unmappedSupport).toContain('totally_unknown_support_xyz');
  });

  it('известная поддержка (NAC) не увеличивает итоговый риск', () => {
    const drugs = [drug('test_enan')];
    const without = calculateTzSpecRisk(base(drugs));
    const withNac = calculateTzSpecRisk({ ...base(drugs), supportSubstances: ['nac'] } as TzSpecInput);
    expect(withNac.overallAfter).toBeLessThanOrEqual(without.overallAfter);
    expect(withNac.unmappedSupport).toEqual([]);
  });
});

/**
 * Оценочное покрытие: у части каталога (521 вещество) нет кураторской записи,
 * механизмы выводятся из токенов (`mech-map.deriveFromCatalog`, q='C', k ≤ 0.12).
 * Такая поддержка РАБОТАЕТ в формуле, но её нельзя показывать как «по ТЗ» —
 * движок отдаёт список наружу, UI подписывает «оценочно».
 */
describe('derivedSupport (оценочные механизмы)', () => {
  const index = getSupportMechIndex();
  const derivedId = Object.keys(index).find(
    (id) => index[id].length > 0 && index[id].every((e) => e.source === DERIVED_SOURCE),
  );

  it('в каталоге есть вещества с полностью производными механизмами', () => {
    expect(derivedId).toBeTruthy();
  });

  it('производная поддержка попадает в derivedSupport и участвует в покрытии', () => {
    const drugs = [drug('test_enan')];
    const without = calculateTzSpecRisk(base(drugs));
    const withDerived = calculateTzSpecRisk({
      ...base(drugs),
      supportSubstances: [derivedId!],
    } as TzSpecInput);
    expect(withDerived.derivedSupport).toContain(derivedId);
    expect(withDerived.unmappedSupport).toEqual([]);
    expect(withDerived.overallAfter).toBeLessThanOrEqual(without.overallAfter);
    expect(withDerived.explanation).toContain('Оценочно');
  });

  it('кураторская поддержка (NAC) в derivedSupport не попадает', () => {
    const r = calculateTzSpecRisk({
      ...base([drug('test_enan')]),
      supportSubstances: ['nac'],
    } as TzSpecInput);
    expect(r.derivedSupport).toEqual([]);
    expect(r.explanation).not.toContain('Оценочно');
  });

  it('неизвестная поддержка не выдаётся за оценочную', () => {
    const r = calculateTzSpecRisk({
      ...base([drug('test_enan')]),
      supportSubstances: ['totally_unknown_support_xyz'],
    } as TzSpecInput);
    expect(r.derivedSupport).toEqual([]);
  });
});
