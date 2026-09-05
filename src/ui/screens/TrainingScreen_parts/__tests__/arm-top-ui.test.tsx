import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function openPressure() {
  render(<ArmDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
}

describe('Arm TOP UI: матчап + Table-IQ', () => {
  it('pressure-таб показывает TOP-блок', () => {
    openPressure();
    expect(document.body.textContent).toContain('TOP: матчап + Table-IQ журнал');
  });

  it('добавление схватки даёт Table-IQ разбор', () => {
    openPressure();
    fireEvent.change(screen.getByLabelText('Фолы за схватку'), { target: { value: '2' } });
    fireEvent.click(screen.getByText(/＋ Схватка/));
    expect(document.body.textContent).toContain('Table-IQ 1 схваток');
    expect(document.body.textContent).toMatch(/Фолы/);
  });

  it('отмена схватки работает', () => {
    openPressure();
    fireEvent.click(screen.getByText(/＋ Схватка/));
    expect(document.body.textContent).toContain('Table-IQ 1 схваток');
    fireEvent.click(screen.getByText(/↩ Отменить/));
    expect(document.body.textContent).not.toContain('Table-IQ 1 схваток');
  });

  it('выбор стиля оппонента даёт матчап-план', () => {
    openPressure();
    fireEvent.change(screen.getByDisplayValue('Неизвестен'), { target: { value: 'toproll' } });
    expect(document.body.textContent).toContain('Матчап:');
    expect(document.body.textContent).toContain('pronators');
  });

  it('конструктор показывает TOP-карточку', () => {
    render(<ArmAutoConstructor />);
    expect(document.body.textContent).toContain('TOP: матчап');
  });
});
