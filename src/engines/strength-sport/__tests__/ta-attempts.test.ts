import { describe, it, expect } from 'vitest';
import { planTAAttempts, roundDownKg, attemptBandKg, taTotalsJumpNote } from '../strength-sport-ta-attempts.engine';

describe('TA attempts E12', () => {
  it('90/96/102 от 100', () => {
    const p = planTAAttempts({ declaredMaxKg: 100 });
    expect(p?.attempts).toEqual([90, 96, 102]);
    expect(p?.readinessCut).toBe(false);
  });
  it('conservative 0.97', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, strategy: 'conservative' });
    expect(p?.attempts).toEqual([87, 93, 98]);
  });
  it('readiness: просадка 0.2 → −2.5кг', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, peakVelStandard: 1.9, peakVelToday: 1.7 });
    expect(p?.readinessCut).toBe(true);
    expect(p?.attempts).toEqual([87, 93, 99]); // (100−2.5)×0.9=87.75→87, ×0.96=93.6→93, ×1.02=99.45→99
    expect(p?.readinessNote).toContain('0.2');
  });
  it('просадка 0.1 — без среза', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, peakVelStandard: 1.9, peakVelToday: 1.8 });
    expect(p?.readinessCut).toBe(false);
    expect(p?.attempts).toEqual([90, 96, 102]);
  });
  it('нет заявки → null; округление вниз', () => {
    expect(planTAAttempts({})).toBeNull();
    expect(planTAAttempts({ declaredMaxKg: -5 })).toBeNull();
    expect(roundDownKg(87.9)).toBe(87);
  });
  it('W1 полоса: дефолт ±2.5, advanced ±3.5, в rationale', () => {
    expect(attemptBandKg()).toBe(2.5);
    expect(attemptBandKg('intermediate')).toBe(2.5);
    expect(attemptBandKg('advanced')).toBe(3.5);
    expect(attemptBandKg('elite')).toBe(3.5);
    const p = planTAAttempts({ declaredMaxKg: 100 });
    expect(p?.bandKg).toBe(2.5);
    expect(p?.rationale.join(' ')).toContain('±2.5');
    const pa = planTAAttempts({ declaredMaxKg: 100, level: 'advanced' });
    expect(pa?.bandKg).toBe(3.5);
    expect(pa?.attempts).toEqual([90, 96, 102]);
  });
  it('W1 полоса складывается с readiness (не поглощает)', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, peakVelStandard: 1.9, peakVelToday: 1.7, level: 'advanced' });
    expect(p?.readinessCut).toBe(true);
    expect(p?.bandKg).toBe(3.5);
    expect(p?.attempts).toEqual([87, 93, 99]);
  });
});

/* ── П1-Б: величина прыжка между попытками тотала (PMID 41160036) ── */
describe('П1-Б величина прыжка тотала', () => {
  it('прыжок = разница соседних попыток, одинаковый процент при любом весе', () => {
    // лестница 0.90/0.96/1.02 от базы → прыжок = 6% базы: 100кг → 6кг, 200кг → 12кг
    expect(taTotalsJumpNote(planTAAttempts({ declaredMaxKg: 100 })!.attempts)).toMatch(/Прыжки 6 и 6 кг/);
    expect(taTotalsJumpNote(planTAAttempts({ declaredMaxKg: 200 })!.attempts)).toMatch(/Прыжки 12 и 12 кг/);
  });

  it('оговорка: полосы IPF только для одиночных видов, для тоталов калибровки нет', () => {
    const note = taTotalsJumpNote(planTAAttempts({ declaredMaxKg: 200 })!.attempts);
    expect(note).toMatch(/только для одиночных видов/);
    expect(note).toMatch(/для ТОТАЛОВ калибровки нет/);
    expect(note).toContain('41160036');
  });

  it('оговорка говорит, что 3-я попытка в среднем хуже 2-й', () => {
    expect(taTotalsJumpNote(planTAAttempts({ declaredMaxKg: 200 })!.attempts)).toMatch(/3-я попытка в среднем хуже 2-й/);
  });

  it('лестница заявок НЕ изменилась (прыжок — только честная подпись)', () => {
    // 26.09.2026 было→стало: числа попыток те же, добавлена только видимость прыжка
    expect(planTAAttempts({ declaredMaxKg: 100 })!.attempts).toEqual([90, 96, 102]);
    expect(planTAAttempts({ declaredMaxKg: 200 })!.attempts).toEqual([180, 192, 204]);
  });

  it('исследование с полосами одиночных видов НЕ применено к тоталам (нет выдуманной эквивалентности)', () => {
    // В движке нет ни полос, ни проверки: приравнять рывок к приседу было бы выдумкой.
    // Оговорка про «калибровки нет» — единственное, что мы показываем пользователю.
    const note = taTotalsJumpNote(planTAAttempts({ declaredMaxKg: 250 })!.attempts);
    expect(note).not.toMatch(/оптимальн/i);
    expect(note).not.toMatch(/5–20|5-20/);
  });
});
