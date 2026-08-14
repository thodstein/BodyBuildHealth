/**
 * macrocycle-panel-cycle-slots.test.tsx — регрессия выбора циклов в менеджере
 * соревнований годового планировщика:
 *  1. «+ Цикл» на первом клике ДОЛЖЕН видимо добавлять вторую строку селектора
 *     (раньше неявная строка «Авто» глотала пустой слот — 1 клик = 0 эффекта);
 *  2. выбор цикла в слоте сохраняется при добавлении новых слотов;
 *  3. построение макроцикла с двумя выбранными циклами даёт 2 peak-блока
 *     с циклами по порядку;
 *  4. legacy v1-макроцикл (блоки с cycleId) десериализуется и применим.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MacrocyclePanel } from '../MacrocyclePanel';
import { deserializeMacro } from '../../../../engines/lms/macrocycle.engine';

function cycleSelects(): HTMLSelectElement[] {
  return Array.from(document.querySelectorAll('select'))
    .filter(s => (s as HTMLSelectElement).title === 'Цикл на под-фазу пика') as HTMLSelectElement[];
}

describe('MacrocyclePanel — слоты циклов на пик', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('«+ Цикл» на первом клике добавляет вторую строку селектора', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));
    expect(cycleSelects().length).toBe(1);

    fireEvent.click(screen.getByText('+ Цикл'));
    expect(cycleSelects().length).toBe(2);

    fireEvent.click(screen.getByText('+ Цикл'));
    expect(cycleSelects().length).toBe(3);
  });

  it('выбор цикла сохраняется при добавлении нового слота', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));

    const first = cycleSelects()[0];
    fireEvent.change(first, { target: { value: 'cycle-01' } });
    fireEvent.click(screen.getByText('+ Цикл'));

    const after = cycleSelects();
    expect(after.length).toBe(2);
    expect(after[0].value).toBe('cycle-01');
    expect(after[1].value).toBe('');
  });

  it('два выбранных цикла на пик → 2 peak-блока с циклами по порядку', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));
    fireEvent.click(screen.getByText('+ Цикл'));

    const selects = cycleSelects();
    expect(selects.length).toBe(2);
    fireEvent.change(selects[0], { target: { value: 'cycle-01' } });
    fireEvent.change(selects[1], { target: { value: 'cycle-02' } });

    const weekInput = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
    const compWeekInput = weekInput.find(i => i.title === 'Неделя');
    fireEvent.change(compWeekInput!, { target: { value: '30' } });

    fireEvent.click(screen.getByText('Построить макроцикл'));

    const raw = localStorage.getItem('he_pl_macro');
    expect(raw).toBeTruthy();
    const macro = deserializeMacro(raw!);
    expect(macro).toBeTruthy();
    const peakBlocks = macro!.blocks.filter(b => b.phase === 'peak');
    expect(peakBlocks.length).toBe(2);
    expect(peakBlocks[0].cycleId).toBe('cycle-01');
    expect(peakBlocks[1].cycleId).toBe('cycle-02');
  });

  it('legacy v1-макроцикл: блоки сохраняют cycleId, кнопка применения есть', () => {
    // v1-формат: [phase, weeks, weekOffset, kind, cycleId, description] — сумма = 52
    const v1 = JSON.stringify({
      v: 1,
      b: [
        ['endurance', 13, 1, 'SRC', 'cycle-03', ''],
        ['strength', 21, 14, 'SRC', 'cycle-01', ''],
        ['peak', 8, 35, 'SRC', 'cycle-07', ''],
        ['competition', 1, 43, 'SRC', null, ''],
        ['transition', 9, 44, 'SRC', 'cycle-01', ''],
      ],
      t: 52,
      c: 43,
      r: [],
    });
    localStorage.setItem('he_pl_macro', v1);

    let applied: { id: string; weeks: number } | null = null;
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={(id, weeks) => { applied = { id, weeks }; }} />);

    const timeline = document.querySelector('.macrocycle-timeline-track');
    expect(timeline).toBeTruthy();
    const blocks = timeline!.querySelectorAll('[role="button"]');
    expect(blocks.length).toBe(5);

    fireEvent.click(blocks[1]); // strength-блок с cycle-01
    const applyBtn = screen.getByText('✓ Применить как активный цикл');
    fireEvent.click(applyBtn);
    expect(applied).toEqual({ id: 'cycle-01', weeks: 21 });
  });
});
