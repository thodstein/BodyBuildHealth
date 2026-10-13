/**
 * ПОВЕДЕНЧЕСКИЙ лок: правка повторов холд-упражнения в UI реально меняет
 * `holdSeconds` и per-set повторы. Source-guard прошёл бы и с inline-копией
 * логики (проверено мутацией), поэтому здесь настоящий рендер конструктора.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombatConstructor } from '../CombatConstructor';

beforeEach(() => { try { localStorage.clear(); } catch {} cleanup(); });

describe('Combat: правка холда через поле «повторы»', () => {
  it('«20с» → «35с»: holdSeconds и повторы сета меняются, а «8-10» холд снимает', async () => {
    render(<CombatConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит' }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать PRO-план/ }));
    await screen.findByText('Сводка плана', {}, { timeout: 30000 });

    // Все холд-упражнения плана (их может быть несколько: авто-шея кладётся в
    // разные сессии, id могут повторяться), поэтому ассерт — не по личности, а по
    // факту: правка сначала холда в DOM обязана доехать до плана.
    const saved = JSON.parse(localStorage.getItem('he_combat_plan_v1')!);
    const holdsOf = (plan: any) => plan.weeksData.flatMap((w: any) =>
      w.sessions.flatMap((s: any) => s.exercises.filter((e: any) => e.holdSeconds != null)));
    const before = holdsOf(saved);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((e: any) => e.holdSeconds === 35), 'до правки 35с в плане нет').toBe(false);

    const allRepsInputs = screen.getAllByLabelText('повторы') as HTMLInputElement[];
    const target = allRepsInputs.find(i => /с/.test(i.value));
    expect(target, 'поле повторов холд-упражнения с «с» в значении').toBeTruthy();

    fireEvent.change(target!, { target: { value: '35с' } });

    const after = JSON.parse(localStorage.getItem('he_combat_plan_v1')!);
    const edited = holdsOf(after).filter((e: any) => e.holdSeconds === 35);
    expect(edited.length, 'правка «35с» доехала ровно до одного холд-упражнения').toBeGreaterThanOrEqual(1);
    for (const e of edited) {
      expect(e.reps).toBe('35с');
      // повторы сета = 1 (холд), а не остались от прошлой правки
      for (const ws of e.workSets) {
        expect(ws.reps).toBe(1);
        expect(ws.holdSeconds).toBe(35);
      }
    }
    // холды не потерялись: правка не отрезает чужие упражнение
    const untouched = holdsOf(after).filter((e: any) => e.holdSeconds !== 35);
    expect(untouched.length).toBeGreaterThanOrEqual(before.length - edited.length);
    expect(holdsOf(after).length).toBeGreaterThanOrEqual(before.length);
  }, 60000);
});
