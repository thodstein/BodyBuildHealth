import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

describe('ArmDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 4 подвкладки', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    expect(container.textContent).toContain('Арм-диагностика');
    expect(screen.getByText(/Хват/)).toBeTruthy();
    expect(screen.getByText(/Кисть\/Ротация/)).toBeTruthy();
    expect(screen.getByText(/Давление/)).toBeTruthy();
    expect(screen.getByText(/Сухожилие/)).toBeTruthy();
  });

  it('переключение вкладок', () => {
    render(<ArmDiagnosticsHub />);
    const wristBtn = screen.getByText(/Кисть\/Ротация/);
    fireEvent.click(wristBtn);
    expect(document.body.textContent).toContain('Локоть');
  });

  it('применить без слабых зон — тост', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    const btn = screen.getAllByText(/Применить в Арм-конструктор/)[0];
    fireEvent.click(btn);
    expect(container.textContent).toContain('не выявлены');
  });

  it('выбор cup → слабые зоны', () => {
    render(<ArmDiagnosticsHub />);
    // switch to wrist tab
    fireEvent.click(screen.getByText(/Кисть\/Ротация/));
    const cupBtn = screen.getByText(/Кисть открывается/);
    fireEvent.click(cupBtn);
    expect(document.body.textContent).toContain('wrist_flexors');
  });

  it('кнопка применить отправляет в planner-bridge', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByText(/Кисть\/Ротация/));
    fireEvent.click(screen.getByText(/Кисть открывается/));
    expect(await screen.findByText(/wrist_flexors/)).toBeTruthy();
    // подождать обновления diag
    await new Promise(r => setTimeout(r, 50));
    const btns = screen.getAllByText(/Применить в Арм-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    expect(await screen.findByText(/Применено/)).toBeTruthy();
  });
});
