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
    // use buttons to avoid duplicate text in description
    expect(screen.getByRole('button', { name: /Хват/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Кисть\/Ротация/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Давление/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Сухожилие/ })).toBeTruthy();
  });

  it('переключение вкладок', () => {
    render(<ArmDiagnosticsHub />);
    const wristBtn = screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON') || screen.getAllByText(/Кисть\/Ротация/)[0];
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
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const cupBtn = screen.getByText(/Кисть открывается/);
    fireEvent.click(cupBtn);
    expect(document.body.textContent).toContain('wrist_flexors');
  });

  it('кнопка применить отправляет в planner-bridge', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Кисть открывается/));
    expect(document.body.textContent).toContain('wrist_flexors');
    // подождать обновления diag
    await new Promise(r => setTimeout(r, 50));
    const btns = screen.getAllByText(/Применить в Арм-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    expect(await screen.findByText(/Применено/)).toBeTruthy();
  });

  it('12 мёртвых точек — выбор pron_open и карточка биомеханики', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    // выбираем Pron откр (label с точкой ● — используем regex)
    const pronOpenBtn = screen.getByText(/Pron откр/);
    fireEvent.click(pronOpenBtn);
    expect(document.body.textContent).toContain('Пронация — вход');
    expect(document.body.textContent).toContain('Коррекции');
    expect(pronOpenBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText(/Sup cup/));
    expect(screen.getByText(/Sup cup/).getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).toContain('Выбрано:');
  });

  it('давление — side_pin humerus guard', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Side pin');
    const sidePinBtn = screen.getByText(/Side pin/);
    fireEvent.click(sidePinBtn);
    expect(sidePinBtn.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent.toLowerCase()).toContain('humerus');
  });

  it('side/back угол н/п — честный бейдж вместо ложного ⚠', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    fireEvent.click(screen.getByText(/Side pin/));
    expect(document.body.textContent).toContain('угол н/п');
  });

  it('grip-чип: pinch<10с предлагает contain_fingers', () => {
    render(<ArmDiagnosticsHub />);
    const pinchInput = screen.getByPlaceholderText('15');
    fireEvent.change(pinchInput, { target: { value: '6' } });
    expect(document.body.textContent).toContain('Слабое звено хвата');
    const addBtn = screen.getByText(/Добавить contain_fingers/);
    fireEvent.click(addBtn);
    expect(addBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('авто-подсказка по углам предлагает точку', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const wristInputs = screen.getAllByPlaceholderText('10');
    // wristDeg уже 10 по умолчанию; ставим forearm 140 → pron_lock
    const foreInput = screen.getByPlaceholderText('90');
    fireEvent.change(foreInput, { target: { value: '140' } });
    expect(document.body.textContent).toContain('Авто по углам');
  });
});
