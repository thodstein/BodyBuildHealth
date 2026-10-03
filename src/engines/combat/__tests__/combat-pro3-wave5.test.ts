/**
 * combat-pro3-wave5.test.ts — локи В5 (Э5.1 библиотека, Э5.4 профиль боя) плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md.
 */
import { describe, it, expect } from 'vitest';
import { COMBAT_CYCLE_LIBRARY, validateCombatCycles } from '../combat-cycle-library';
import { buildCombatPlan } from '../combat-builder.engine';

const byGoal = (goal: string) => COMBAT_CYCLE_LIBRARY.filter(c => c.goal === goal);
const byDiscipline = (d: string) => COMBAT_CYCLE_LIBRARY.filter(c => c.discipline === d);

describe('В5 · Э5.1 — библиотека циклов ≥25 с покрытием', () => {
  it('реестр ≥25 и все шаблоны валидны (паттерн/дни/уровень)', () => {
    expect(COMBAT_CYCLE_LIBRARY.length).toBeGreaterThanOrEqual(25);
    expect(validateCombatCycles()).toEqual([]);
    const ids = COMBAT_CYCLE_LIBRARY.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('weight_cut есть у бокса/борьбы/ММА/кика; camp — у всех 5 дисциплин', () => {
    for (const d of ['boxing', 'wrestling', 'mma', 'kickboxing']) {
      expect(byDiscipline(d).some(c => c.goal === 'weight_cut')).toBe(true);
    }
    for (const d of ['boxing', 'wrestling', 'mma', 'kickboxing', 'general']) {
      expect(byDiscipline(d).some(c => c.goal === 'camp')).toBe(true);
    }
  });

  it('enhanced ≥2, maintenance ≥3, beginner ≥4, отель/подросток/женская база есть', () => {
    expect(COMBAT_CYCLE_LIBRARY.filter(c => c.level === 'enhanced').length).toBeGreaterThanOrEqual(2);
    expect(byGoal('maintenance').length).toBeGreaterThanOrEqual(3);
    expect(COMBAT_CYCLE_LIBRARY.filter(c => c.level === 'beginner').length).toBeGreaterThanOrEqual(4);
    expect(COMBAT_CYCLE_LIBRARY.some(c => c.id === 'cb-mma-hotel-4')).toBe(true);
    expect(COMBAT_CYCLE_LIBRARY.some(c => c.id === 'cb-teen-4' && c.level === 'beginner')).toBe(true);
    expect(COMBAT_CYCLE_LIBRARY.some(c => c.id === 'cb-general-f-base-6')).toBe(true);
  });
});

describe('В5 · Э5.4 — профиль энергосистем боя', () => {
  it('fightMinutes попадает в rationale с источником', () => {
    const p = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, fightMinutes: 5 } as any);
    const line = p.rationale.find(r => r.includes('Поединок'));
    expect(line).toBeDefined();
    expect(line).toContain('PMID');
    expect(line).toContain('5 мин');
  });

  it('3 мин — АТФ-ФК доминирует (50/40/10), без выдуманной экстраполяции', () => {
    const p = buildCombatPlan({ discipline: 'boxing', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, fightMinutes: 3 } as any);
    const line = p.rationale.find(r => r.includes('Поединок'))!;
    expect(line).toContain('аэроб 50%');
    expect(line).toContain('АТФ-ФК 40%');
  });
});
