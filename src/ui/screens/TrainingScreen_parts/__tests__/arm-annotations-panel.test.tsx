/**
 * arm-annotations-panel.test.tsx — PRO-7 P2: заметки/видео к упражнениям плана.
 *
 * Панель берёт упражнения из плана, пишет заметку/видео в localStorage,
 * показывает привязку (неделя/сессия/упражнение) и отдаёт строки для печати.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAnnotationsPanel } from '../arm-annotations-panel';
import { loadArmAnnotations, clearArmAnnotations } from '../../../../engines/arm/arm-annotations.engine';

const PLAN: any = {
  weeks: [
    {
      week: 1,
      sessions: [
        { exercises: [{ name: 'Жим лёжа' }, { name: 'Тяга' }] },
        { exercises: [{ name: 'Сгибания' }] },
      ],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  clearArmAnnotations();
});

describe('ArmAnnotationsPanel', () => {
  it('без упражнений — честная подсказка, без записи', () => {
    const { container } = render(<ArmAnnotationsPanel plan={{ weeks: [] }} lines={[]} />);
    expect(container.querySelector("[data-arm='annotations']")).not.toBeNull();
    expect(container.textContent).toMatch(/Собери план/);
    expect(loadArmAnnotations()).toEqual([]);
  });

  it('заметка пишется с привязкой и появляется в списке', () => {
    const { container } = render(<ArmAnnotationsPanel plan={PLAN} lines={[]} />);
    fireEvent.change(screen.getByLabelText('Текст заметки'), { target: { value: 'сорвался' } });
    fireEvent.click(screen.getByText('💬 Добавить заметку'));
    const stored = loadArmAnnotations();
    expect(stored).toHaveLength(1);
    expect(stored[0].exerciseName).toBe('Жим лёжа');
    expect(stored[0].text).toBe('сорвался');
    const list = container.querySelector("[data-arm='annotations-list']")!;
    expect(list.textContent).toMatch(/Н1 · с1 · Жим лёжа/);
    expect(list.textContent).toMatch(/сорвался/);
  });

  it('видео сохраняет ссылку, удаление убирает запись', () => {
    const { container } = render(<ArmAnnotationsPanel plan={PLAN} lines={[]} />);
    fireEvent.change(screen.getByLabelText('Упражнение для заметки'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Ссылка на видео'), { target: { value: 'clip-7' } });
    fireEvent.click(screen.getByText('🎬 Привязать видео'));
    const stored = loadArmAnnotations();
    expect(stored).toHaveLength(1);
    expect(stored[0].videoRef).toBe('clip-7');
    expect(stored[0].exerciseName).toBe('Сгибания');
    fireEvent.click(screen.getByLabelText('Удалить заметку Сгибания'));
    expect(loadArmAnnotations()).toEqual([]);
  });

  it('пустая заметка не создаётся', () => {
    render(<ArmAnnotationsPanel plan={PLAN} lines={[]} />);
    fireEvent.click(screen.getByText('💬 Добавить заметку'));
    fireEvent.click(screen.getByText('🎬 Привязать видео'));
    expect(loadArmAnnotations()).toEqual([]);
  });
});
