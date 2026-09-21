/**
 * pl-rationale-honesty.test.ts — Фаза 1: rationale не обещает того, что не применяется.
 *
 * Было: faithful-сборка сохраняет раскладку источника (множители volumeGoal/
 * focusLift/weakPoints не применяются), но rationale безусловно печатал
 * «+20% объёма». Стало: в дословном режиме текст честный, математика — прежняя.
 */
import { describe, it, expect } from 'vitest';
import { buildLMSPlan, originalCycleWeeks } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };
const base = { template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: originalCycleWeeks(CYCLE_01) } as const;
const tune = { volumeGoal: 'mrv', focusLift: 'bench', weakPoints: ['chest'] } as const;

describe('rationale: снапшот честности в faithful-режиме', () => {
  it('faithful: нет обещания «+20% объёма», есть пометка «не применяется» и «ассистенты сверху»', () => {
    const plan = buildLMSPlan({ ...base, faithful: true, ...tune });
    expect(plan.progressionRationale).not.toContain('+20% объёма');
    expect(plan.progressionRationale).toContain('в дословном режиме не применяется');
    expect(plan.progressionRationale).toContain('ассистенты добавлены сверху');
  });

  it('faithful: математика прежняя — source-сеты не изменились от настроек', () => {
    const plain = buildLMSPlan({ ...base, faithful: true });
    const tuned = buildLMSPlan({ ...base, faithful: true, ...tune });
    for (let w = 0; w < plain.weeks.length; w++) {
      const srcDay = plain.weeks[w].days[0];
      const tunedDay = tuned.weeks[w].days[0];
      for (let e = 0; e < srcDay.exercises.length; e++) {
        expect(tunedDay.exercises[e].workSets).toEqual(srcDay.exercises[e].workSets);
      }
    }
  });

  it('auto-режим (не faithful): тексты «+20% объёма» по-прежнему на месте (реальные множители)', () => {
    const plan = buildLMSPlan({ ...base, faithful: false, ...tune });
    expect(plan.progressionRationale).toContain('+20% объёма');
    expect(plan.progressionRationale).not.toContain('в дословном режиме не применяется');
  });
});
