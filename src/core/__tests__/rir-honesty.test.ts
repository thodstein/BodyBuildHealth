/**
 * rir-honesty.test.ts — ноль в поле RIR не всегда «до отказа».
 *
 * До появления `rirMissing` старые сборки писали `rir: 0` заполнителем, и средний
 * RIR тянулся к нулю, а отчёт считал такие подходы отказными. Правило одно:
 * ноль без измеренного RPE — «не вводили»; ноль при введённом RPE<10 — заполнитель,
 * и RIR равен 10 − RPE; настоящий отказ — только RPE 10 (или явная метка отказа).
 */
import { describe, expect, it } from 'vitest';
import { measuredSetRir } from '../rir-honesty';

describe('measuredSetRir — честное чтение RIR подхода', () => {
  it('явный измеренный RIR читается как записан', () => {
    expect(measuredSetRir({ rir: 2, rpe: 8 })).toBe(2);
    expect(measuredSetRir({ rir: 4 })).toBe(4);
  });

  it('rirMissing — «не вводили», даже если ноль лежит заполнителем', () => {
    expect(measuredSetRir({ rir: 0, rpe: 0, rirMissing: true })).toBeNull();
  });

  it('ноль без RPE и без метки — заполнитель старой сборки, а не отказ', () => {
    expect(measuredSetRir({ rir: 0, rpe: 0 })).toBeNull();
    expect(measuredSetRir({ rir: null })).toBeNull();
    expect(measuredSetRir({})).toBeNull();
    expect(measuredSetRir(null)).toBeNull();
  });

  it('ноль при введённом RPE<10 — RIR выводится из RPE, а не читается как отказ', () => {
    // Старая сборка: RIR не вводили (0), но RPE 8 записан. «До отказа» здесь ложь.
    expect(measuredSetRir({ rir: 0, rpe: 8 })).toBe(2);
    expect(measuredSetRir({ rir: 0, rpe: 7 })).toBe(3);
    expect(measuredSetRir({ rir: 0, rpe: 9.5 })).toBe(0.5);
  });

  it('ноль при RPE 10 — настоящий отказ', () => {
    expect(measuredSetRir({ rir: 0, rpe: 10 })).toBe(0);
  });

  it('RIR не записан, а RPE измерен — RIR восстанавливается из RPE', () => {
    expect(measuredSetRir({ rpe: 8 })).toBe(2);
    expect(measuredSetRir({ rpe: 10 })).toBe(0);
  });

  it('RIR зажимается в 0..10, а RPE вне 0..10 — мусор, а не измерение', () => {
    expect(measuredSetRir({ rir: 12 })).toBe(10);
    // `rpe: 12` раньше зажимался в 10 и подходам приписывался настоящий отказ.
    expect(measuredSetRir({ rir: 0, rpe: 12 })).toBeNull();
    expect(measuredSetRir({ rpe: 11 })).toBeNull();
    expect(measuredSetRir({ rir: 'abc', rpe: 0 })).toBeNull();
    expect(measuredSetRir({ rir: 0, rpe: -4 })).toBeNull();
  });
});
