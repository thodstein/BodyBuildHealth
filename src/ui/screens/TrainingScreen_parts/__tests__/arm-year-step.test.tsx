/**
 * arm-year-step.test.tsx — шаг года: серия → блоки → сборка.
 *
 * Блоки preview (фазы/приоритеты/именные циклы) + сборка каждым
 * buildArmBlock (тейпер A/B, пики, предупреждения). Без записи в общий
 * годовой план — всё внутри конструктора.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function goYear() {
  const r = render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '🗓 Год' }));
  return r;
}

describe('Arm year step', () => {
  it('блоки серии на месте: фазы, приоритеты, именные циклы', () => {
    const { container } = goYear();
    const blocks = container.querySelector("[data-arm='year-blocks']");
    expect(blocks, 'blocks').not.toBeNull();
    expect(blocks!.querySelectorAll('.ad-bio').length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toContain('приоритет');
    expect(document.body.textContent).toContain('Цикл:');
  });

  it('смена серии перестраивает блоки', () => {
    const { container } = goYear();
    const before = container.querySelector("[data-arm='year-blocks']")!.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'WAF Worlds' }));
    const after = container.querySelector("[data-arm='year-blocks']")!.textContent;
    expect(after).not.toBe(before);
  });

  it('сборка года: busy-строка, итог с тейперами, без фриза', async () => {
    const { container } = goYear();
    fireEvent.click(screen.getByText('🗓 Собрать год'));
    expect(screen.getByText('⏳ Собираем год…')).toBeTruthy();
    const res = await screen.findByText('🗓 Год собран', { exact: false });
    expect(res).toBeTruthy();
    expect(container.querySelector("[data-arm='year-result']")).not.toBeNull();
    expect(document.body.textContent).toContain('тейпер');
  }, 60000);
});
