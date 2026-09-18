/**
 * Аудит «дубли шаг 1-2» (docs/BB-AUTO-STEPS-DEDUP-PLAN.md): режим источника
 * (programToBBPlan) не звал PED-методику — теперь BbAutoConstructor накладывает
 * `applyPEDMethodologyToPlan` после сборки (adapt-only). Контракт опции
 * `skipGuardNote`: program-путь НЕ делает axial-замены joint-guard, поэтому
 * строка не должна обещать замену; инсулиновое окно и MGF-пометки работают.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { recommendPEDMethodology, applyPEDMethodologyToPlan } from '../bb-ped-methodology.engine';

const base = () => buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 2, trainingYears: 3 } as any);

describe('PED-методика: program-оверлей (skipGuardNote)', () => {
  it('по умолчанию joint-guard-строка есть (generic-путь делает замены)', () => {
    const meth = recommendPEDMethodology({ peds: ['GH'] as any, pedDoses: { GH: 6 }, level: 'advanced' });
    expect(meth.jointGuard).toBe(true);
    const out = applyPEDMethodologyToPlan(base(), meth);
    expect(out.rationale.join(' ')).toContain('Joint guard');
  });

  it('skipGuardNote убирает обещание axial-замены (program-путь их не делает)', () => {
    const meth = recommendPEDMethodology({ peds: ['GH'] as any, pedDoses: { GH: 6 }, level: 'advanced' });
    const out = applyPEDMethodologyToPlan(base(), meth, { skipGuardNote: true });
    expect(out.rationale.join(' ')).not.toContain('Joint guard');
  });

  it('инсулиновое окно и MGF-пометки остаются при skipGuardNote', () => {
    const meth = recommendPEDMethodology({ peds: ['GH', 'insulin', 'MGF'] as any, pedDoses: { GH: 4, insulin: 10, MGF: 200 }, level: 'advanced', targetMuscles: ['chest'] });
    const out = applyPEDMethodologyToPlan(base(), meth, { skipGuardNote: true });
    const text = out.rationale.join(' ');
    expect(text).toContain('GH+insulin pump window');
    expect(text).toMatch(/MGF\/IGF1 локально/);
    // пометки в плане (не только rationale) — памп-дни цели
    let marked = 0;
    for (const w of out.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.comment?.includes('🧬 MGF/IGF1')) marked++;
    }
    expect(marked).toBeGreaterThan(0);
  });
});
