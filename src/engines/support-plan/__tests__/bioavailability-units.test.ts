/**
 * bioavailability-units.test.ts — «доза скорректирована» в расписании
 * подписана в единице вещества.
 *
 * Аудит 2026-11: `adjustForBioavailability` получает дозу из titration-карты,
 * где витамин D — в МКГ (как в `NUTRIENT_UL`), но подписывал её
 * `formatDefaultDose` (ждёт МЕ из DEFAULT_DOSAGES) → в расписании появлялось
 * «доза скорректирована: 34 МЕ» вместо ~1360 МЕ (40× ниже).
 */
import { describe, it, expect } from 'vitest';
import { calculateSupportTZ } from '../engine';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

function courseState() {
  return {
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }] },
  } as any;
}

describe('расписание: «доза скорректирована» в правильной единице', () => {
  const tz = calculateSupportTZ(courseState());
  const find = (id: string) => (tz.schedule || []).find((s: any) => s.substanceId === id) as any;

  it('витамин D3: скорректированная доза — в МЕ, а не «34 МЕ» из мкг', () => {
    const d3 = find('vitamin_d3');
    expect(d3, 'D3 должен быть в расписании курса').toBeTruthy();
    const m = /доза скорректирована: ([\d.,]+) (МЕ|мкг|мг)/.exec(String(d3.instructions));
    expect(m, d3.instructions).toBeTruthy();
    expect(m![2]).toBe('МЕ');
    expect(Number(m![1].replace(',', '.'))).toBeGreaterThan(500);
  });

  it('без титрованной дозы строки «скорректирована: —» нет (K2 200 мкг)', () => {
    const k2 = find('vitamin_k2');
    expect(k2).toBeTruthy();
    expect(String(k2.instructions)).not.toContain('доза скорректирована: —');
  });

  it('ни в одной инструкции нет «скорректирована: —»', () => {
    const bad = (tz.schedule || []).filter((s: any) => String(s.instructions).includes('доза скорректирована: —'));
    expect(bad.map((s: any) => s.substanceId)).toEqual([]);
  });

  it('мг-вещества (витамин C) — в мг', () => {
    const c = find('vitamin_c');
    expect(c).toBeTruthy();
    const m = /доза скорректирована: ([\d.,]+) (МЕ|мкг|мг)/.exec(String(c.instructions));
    expect(m, c.instructions).toBeTruthy();
    expect(m![2]).toBe('мг');
  });
});
