/**
 * bb-auto-annual-card.test.ts — п.18: карточка «📍 Текущий блок года»
 * в шаге «Годовой план» ББ-авто (annualActiveBlockLine — чистый helper).
 */
import { describe, it, expect } from 'vitest';
import { annualActiveBlockLine } from '../BbAutoConstructor';
import { annualPlanFromMacro, buildAnnualPlan } from '../../../../engines/annual-training/block-builders.engine';
import { buildBbMacrocycle } from '../../../../engines/lms/macrocycle.engine';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('annualActiveBlockLine (п.18)', () => {
  it('возвращает строку активного блока года на сегодня', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 20 });
    const plan = buildAnnualPlan(annualPlanFromMacro(macro), macro, { daysPerWeek: 4, level: 'intermediate' }).plan;
    const line = annualActiveBlockLine(plan, todayIso());
    expect(line).toContain('📍 Текущий блок года');
    expect(line).toContain('нед 1');
    expect(line).toContain('собран');
  });

  it('без плана → null', () => {
    expect(annualActiveBlockLine(null, '2026-01-01')).toBeNull();
  });

  it('несобранный план → статус «не собран»', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 12 });
    const plan = annualPlanFromMacro(macro); // unbuilt
    const line = annualActiveBlockLine(plan, todayIso());
    expect(line).toContain('·');
    expect(line).toContain('не собран');
  });
});