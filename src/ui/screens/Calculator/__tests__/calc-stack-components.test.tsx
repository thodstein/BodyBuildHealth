/**
 * calc-stack-components.test.tsx — Д8/Д9 аудита: общие компоненты стеков.
 * StackExpandableRow (раскрытая карточка) и SelectedStackChips (чипы) — единая реализация
 * для ручного попапа и попапа «Усиление»; поведение колбэков + использование в mapper.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StackExpandableRow, SelectedStackChips } from '../CalcStackComponents';

beforeEach(() => {
  localStorage.clear();
});

const stack = {
  id: 'hepatic_stack',
  name: 'Печёночный стек',
  system: 'Печень',
  problem: 'Цитолиз',
  substances: [{ id: 'nac', dose: '1200 мг', timing: 'утро', mechanism: 'GSH' }],
  synergyScore: 8,
  synergyPrinciple: 'NAC + TUDCA',
  anatomicalMapping: { organMechanisms: 'детокс', finalEffect: '↓АЛТ', mechanismCodes: ['liv1'] },
  contraindications: 'нельзя при X',
  warnings: 'контроль',
};

describe('StackExpandableRow (Д8)', () => {
  it('compact: заголовок/подпись, клик по строке — выбор, шеврон — раскрытие', () => {
    const onToggleSelect = vi.fn();
    const onToggleExpand = vi.fn();
    render(
      React.createElement(StackExpandableRow, {
        st: stack, active: false, expanded: false, compact: true,
        onToggleSelect, onToggleExpand,
      }),
    );
    expect(screen.getByText('Печёночный стек')).toBeTruthy();
    expect(screen.getByText(/Печень · 1 веществ/)).toBeTruthy();
    fireEvent.click(screen.getByText('Печёночный стек'));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('▼'));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    // выбор не сработал от шеврона (stopPropagation)
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });

  it('enhance: строка problem + бейдж авто-триггера; expanded показывает детали', () => {
    render(
      React.createElement(StackExpandableRow, {
        st: stack, active: true, expanded: true, autoTrigger: true,
        onToggleSelect: () => {}, onToggleExpand: () => {},
      }),
    );
    expect(screen.getByText('Цитолиз')).toBeTruthy();
    expect(screen.getByText(/авто-триггер/)).toBeTruthy();
    expect(screen.getByText(/Механизм действия/)).toBeTruthy();
    expect(screen.getByText(/Перечень препаратов \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Противопоказания/)).toBeTruthy();
  });
});

describe('SelectedStackChips (Д9)', () => {
  it('рендерит чипы и удаляет по ✕', () => {
    const onRemove = vi.fn();
    render(
      React.createElement(SelectedStackChips, {
        variant: 'enhance',
        testId: 'enhance-stacks',
        items: [{ id: 'stA', label: 'Стек A' }, { id: 'stB', label: 'Стек B' }],
        onRemove,
      }),
    );
    expect(screen.getByText('Стек A')).toBeTruthy();
    const crosses = screen.getAllByText('✕');
    fireEvent.click(crosses[0]);
    expect(onRemove).toHaveBeenCalledWith('stA');
    expect(document.querySelector('[data-stack-chips="enhance-stacks"]')).toBeTruthy();
  });

  it('пустой список — ничего не рендерит', () => {
    const { container } = render(
      React.createElement(SelectedStackChips, { items: [], onRemove: () => {} }),
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('интеграция в Calc.mapper (source-lock)', () => {
  it('оба места используют общие компоненты', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');
    expect((src.match(/<StackExpandableRow/g) || []).length).toBe(2);
    expect((src.match(/<SelectedStackChips/g) || []).length).toBe(2);
    // старых инлайн-копий деталей не осталось
    expect(src).not.toContain('organMechanisms}:</b>');
  });
});
