/**
 * titration-d3-base-dose.test.ts — протокол титрации D3 не спорит с планом.
 *
 * Аудит 2026-11 (проход 21): в раскрытой карточке вещества старт протокола был
 * «5000 МЕ/день», а карточка плана показывала 2000 МЕ (решение прохода 12:
 * одна базовая доза, 5000+ — только коррекция подтверждённого дефицита).
 */
import { describe, it, expect } from 'vitest';
import { getTitrationProtocol } from '../titration-protocols';
import { formatDefaultDose } from '../dose-units';
import { resolvePlanDose } from '../../engines/support-plan/substances';

describe('протокол титрации D3', () => {
  it('стартовая доза = базовая доза плана (2000 МЕ при 70 кг)', () => {
    const p = getTitrationProtocol('vitamin_d3')!;
    const planDose = formatDefaultDose('vitamin_d3', resolvePlanDose('vitamin_d3', 70));
    expect(planDose).toBe('2000 МЕ');
    expect(p.startDose).toBe(`${planDose}/день`);
    expect(p.startDose).not.toContain('5000');
  });

  it('дозы выше UL (>4000 МЕ) — только шаги коррекции дефицита', () => {
    const p = getTitrationProtocol('vitamin_d3')!;
    const aboveUl = p.steps.filter((s) => /\b(5000|10000|20000)\b/.test(s.dose));
    expect(aboveUl.length).toBe(2);
    for (const step of aboveUl) expect(step.trigger).toMatch(/дефицит/i);
  });
});
