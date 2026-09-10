/**
 * arm-plan-correction.test.tsx — №1 ручная коррекция плана.
 *
 * Overlay applyArmEdits (чистая функция) + живой редактор в строках:
 * сеты/повторы/вес применяются, своп — внутри substitutionGroup каталога
 * с пересчётом веса от workMax, печать/ICS/копия идут с правками,
 * валидация остаётся базовой (честная пометка).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor, applyArmEdits, armEditKey, swapCandidatesFor } from '../ArmAutoConstructor';
import { ARM_EXERCISES } from '../../../../core/exercise-catalog-arm';

beforeEach(() => {
  localStorage.clear();
});

function demoPlan(): any {
  const ex: any = {
    muscle: 'wrist_flexors',
    name: 'Сгибание кисти со штангой',
    exerciseId: 'wrist_curl_bb',
    substitutionGroup: 'cup_iso',
    character: 'тяж',
    sets: 4,
    repsRange: [6, 8],
    rir: 2,
    workSets: [{ weight: 20, reps: 6 }, { weight: 20, reps: 6 }],
  };
  return { pattern: { id: 'x', name: 'X' }, weeks: [{ week: 1, phase: 'accumulation', sessions: [{ day: 1, sessionTag: 'T', character: 'тяж', exercises: [ex] }] }] };
}

describe('applyArmEdits (pure)', () => {
  it('без правок возвращает тот же объект', () => {
    const p = demoPlan();
    expect(applyArmEdits(p, {})).toBe(p);
  });

  it('сеты/повторы/вес переписываются, остальное цело', () => {
    const out = applyArmEdits(demoPlan(), { [armEditKey(1, 0, 0)]: { sets: 5, reps: 10, weight: 25 } });
    const ex = out.weeks[0].sessions[0].exercises[0];
    expect(ex.sets).toBe(5);
    expect(ex.repsRange).toEqual([10, 10]);
    expect(ex.workSets.every((w: any) => w.weight === 25 && w.reps === 10)).toBe(true);
    expect(ex.name).toBe('Сгибание кисти со штангой');
    expect(ex.rir).toBe(2);
  });

  it('своп внутри группы переименовывает и считает вес от базы', () => {
    const cands = swapCandidatesFor(demoPlan().weeks[0].sessions[0].exercises[0]);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => ARM_EXERCISES.find((e) => e.id === c.id)?.substitutionGroup === 'cup_iso')).toBe(true);
    const target = cands[0];
    const out = applyArmEdits(demoPlan(), { [armEditKey(1, 0, 0)]: { swapId: target.id } }, { wrist_flexors: 50 });
    const ex = out.weeks[0].sessions[0].exercises[0];
    expect(ex.name).toBe(target.name);
    expect(ex.exerciseId).toBe(target.id);
    expect(ex.sets).toBe(4);
    expect(ex.workSets[0].weight).toBe(41);
    expect(ex.comment).toContain('🔄 Замена');
  });

  it('неизвестный swapId игнорируется', () => {
    const out = applyArmEdits(demoPlan(), { [armEditKey(1, 0, 0)]: { swapId: 'nope' } }, { wrist_flexors: 40 });
    expect(out.weeks[0].sessions[0].exercises[0].name).toBe('Сгибание кисти со штангой');
  });

  it('чужой ключ недели не трогает план', () => {
    const out = applyArmEdits(demoPlan(), { [armEditKey(9, 0, 0)]: { sets: 1 } });
    expect(out.weeks[0].sessions[0].exercises[0].sets).toBe(4);
  });
});

describe('Arm plan correction (UI)', () => {
  function build() {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
  }

  it('редактор открывается, сеты применяются и видны', () => {
    build();
    const toggle = screen.getAllByRole('button', { name: /Править / })[0];
    const exName = (toggle.getAttribute('aria-label') || '').replace('Править ', '');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const setsInput = screen.getByLabelText(`Сеты ${exName}`) as HTMLInputElement;
    fireEvent.change(setsInput, { target: { value: '9' } });
    expect(document.body.textContent).toContain('9×');
    expect(document.body.textContent).toContain('✏️ Правки: 1 упр.');
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить правки' }));
    expect(document.body.textContent).not.toContain('✏️ Правки:');
  });

  it('своп через селект меняет имя в строке', () => {
    build();
    const toggle = screen.getAllByRole('button', { name: /Править / })[0];
    const exName = (toggle.getAttribute('aria-label') || '').replace('Править ', '');
    fireEvent.click(toggle);
    const sel = screen.getByLabelText(`Замена для ${exName}`) as HTMLSelectElement;
    expect(sel.options.length).toBeGreaterThan(1);
    fireEvent.change(sel, { target: { value: sel.options[1].value } });
    expect(document.body.textContent).toContain(sel.options[1].text);
  });
});
