/**
 * egfr-single-source.test.ts — проход 203: СКФ в контуре поддержки.
 *
 * Класс дефекта: правило «креатинин → СКФ» жило в риск-модели
 * (`extractLabValues`), а план поддержки (`buildMapperCtx`) СКФ не выводил. Поле
 * eGFR в бланке отсутствовало, поэтому триггер «Фильтрация» читал ключ `l.eGFR`,
 * которого не бывает (канон склада — `EGFR`), и ренальная ветка была мертва:
 * человек с креатинином в бланке получал ренальный риск по главной модели, но
 * пустые триггеры и ступени почки в поддержке.
 *
 * Проверяется:
 *  - одно правило `egfrFromCreatinine` (та же формула CKD-EPI, возраст 40 при
 *    отсутствии, кламп 5..150);
 *  - `buildMapperCtx` выводит СКФ из креатинина и возраста профиля;
 *  - явная СКФ из бланка главнее расчёта (лаборатория могла считать цистатином C);
 *  - нет креатинина — нет ключа: «нет записи» не «СКФ в норме»;
 *  - мост механизмов (`ren1`) видит выведенную СКФ.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';
import type { CalculatorState } from '../types';
import { buildMapperCtx, labSliceToValues } from '../mapper-ctx';
import { ckdEpi2021, egfrFromCreatinine } from '../../lab-norms.engine';
import { getActivatedTzMechs } from '../../tz-bridge-marker';

const slice = (panel: string, values: Record<string, string>) =>
  ({ [panel]: values } as any);

const state = (labs: any, profile: Partial<CalculatorState['profile']> = {}) => ({
  ...DEFAULT_STATE,
  profile: { ...DEFAULT_STATE.profile, ...profile },
  labs: { fullPanel: labs },
}) as CalculatorState;

describe('проход 203: СКФ выводится одним правилом', () => {
  it('egfrFromCreatinine — та же CKD-EPI, округлённая и ограниченная 5..150', () => {
    for (const [creat, age, sex] of [
      [100, 40, 'male'],
      [130, 55, 'male'],
      [90, 70, 'female'],
      [60, 25, 'male'],
      [900, 60, 'male'],
    ] as const) {
      const raw = Math.min(150, Math.max(5, Math.round(ckdEpi2021(creat, age, sex))));
      expect(egfrFromCreatinine(creat, age, sex)).toBe(raw);
    }
  });

  it('возраст профиля главнее; без возраста — нейтральные 40 лет (прежний путь)', () => {
    expect(egfrFromCreatinine(100)).toBe(egfrFromCreatinine(100, 40, 'male'));
    expect(egfrFromCreatinine(100, 75, 'male')!).toBeLessThan(egfrFromCreatinine(100, 30, 'male')!);
  });

  it('непригодный креатинин — undefined, а не «норма» и не краевое число', () => {
    expect(egfrFromCreatinine(undefined)).toBeUndefined();
    expect(egfrFromCreatinine(null)).toBeUndefined();
    expect(egfrFromCreatinine(0)).toBeUndefined();
    expect(egfrFromCreatinine(NaN)).toBeUndefined();
    expect(egfrFromCreatinine(-5)).toBeUndefined();
  });
});

describe('проход 203: СКФ доходит до плана поддержки', () => {
  it('креатинин + возраст профиля → EGFR в карте плана и механизм ren1', () => {
    const ctx = buildMapperCtx(
      state(slice('panelBiochem', { Creatinine: '130' }), { age: 55 }),
      'base',
    );
    expect(ctx.labs['CREATININE']).toBe(130);
    expect(ctx.labs['EGFR']).toBe(egfrFromCreatinine(130, 55, 'male'));
    expect(getActivatedTzMechs(ctx.labs).map((m) => m.mechId)).toContain('ren1');
  });

  it('явная СКФ из бланка главнее расчёта по креатинину', () => {
    const ctx = buildMapperCtx(
      state(slice('panelBiochem', { Creatinine: '90', eGFR: '58' }), { age: 40 }),
      'base',
    );
    expect(ctx.labs['EGFR']).toBe(58);
    expect(ctx.labs['EGFR']).not.toBe(egfrFromCreatinine(90, 40, 'male'));
  });

  it('нет креатинина — ключа EGFR нет (а не 90/200 «в норме»)', () => {
    const ctx = buildMapperCtx(
      state(slice('panelBiochem', { ALT: '30' }), { age: 40 }),
      'base',
    );
    expect(ctx.labs['EGFR']).toBeUndefined();
  });

  it('карта бланка (`labSliceToValues`) поле не подменяет — расчёт живёт в плане', () => {
    const labs = labSliceToValues(slice('panelBiochem', { Creatinine: '130' }));
    expect(labs['CREATININE']).toBe(130);
    expect(labs['EGFR']).toBeUndefined();
    // А вписанная в бланк СКФ доходит своим каноном.
    const explicit = labSliceToValues(slice('panelBiochem', { eGFR: '58' }));
    expect(explicit['EGFR']).toBe(58);
  });

  it('высокий креатинин без возраста: СКФ считается по 40 годам, а не теряется', () => {
    const ctx = buildMapperCtx(
      state(slice('panelBiochem', { Creatinine: '130' }), { age: 0 }),
      'base',
    );
    expect(ctx.labs['EGFR']).toBe(egfrFromCreatinine(130, 40, 'male'));
  });
});
