/**
 * support-dose-display-units.test.ts — guard единиц в отображаемых дозах плана.
 *
 * Аудит 2026-11 (продолжение): `buildSubstances` и расписание приёма подписывали
 * ВСЕ дозы как «мг» — 200 мкг селена выглядели как «200 мг» (1000×),
 * 5000 МЕ витамина D — как «5000 мг», а при отсутствии данных рисовалось
 * выдуманное «500 мг». Эти тесты фиксируют натуральные единицы и честное
 * «по инструкции».
 */
import { describe, it, expect } from 'vitest';
import { buildSubstances, buildScheduleFromPlan } from '../support-plan/substances';
import type { CalculatorResult } from '../support-plan/types';

const fakeResult = {} as CalculatorResult;

function display(ids: string[], weight?: number): Record<string, string> {
  const subs = buildSubstances(ids, fakeResult, undefined, weight);
  return Object.fromEntries(subs.map((s) => [s.id, s.doseDisplay]));
}

describe('buildSubstances: единицы доз', () => {
  it('селен — мкг, витамин D — МЕ (не «мг»)', () => {
    const d = display(['selenium', 'vitamin_d3']);
    expect(d.selenium).toContain('мкг');
    expect(d.selenium).not.toContain('мг');
    expect(d.vitamin_d3).toContain('МЕ');
  });

  it('обычные мг-вещества — мг, крупные — граммы (никогда мкг/МЕ)', () => {
    const d = display(['nac', 'magnesium']);
    // nac 1200 мг из DEFAULT_DOSAGES → показываем в граммах.
    expect(d.nac).toBe('1.2 г');
    expect(d.magnesium).toBe('200 мг');
    expect(d.nac).not.toContain('мкг');
    expect(d.magnesium).not.toContain('мкг');
  });

  it('весовая дозировка — из мг-шкалы (омега-3 при 100 кг → 5 г)', () => {
    const d = display(['omega3'], 100);
    expect(d.omega3).toBe('5 г');
  });

  it('нет данных о дозе — честное «по инструкции», а не выдуманное «500 мг»', () => {
    const subs = buildSubstances(['nonexistent_substance_xyz'], fakeResult);
    expect(subs[0].doseDisplay).toBe('по инструкции');
  });
});

describe('buildScheduleFromPlan: единицы доз', () => {
  it('селен — мкг в расписании приёма', () => {
    const blocks = buildScheduleFromPlan(buildSubstances(['selenium'], fakeResult));
    const item = blocks.flatMap((b) => b.substances).find((s) => s.id === 'selenium');
    expect(item).toBeTruthy();
    expect(item!.dose).toContain('мкг');
    expect(item!.dose).not.toContain('мг');
  });
});
