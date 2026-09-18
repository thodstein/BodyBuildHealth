import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';
import { SM_BIOMECH } from '../../../../engines/strength-sport/strength-sport-sm-biomechanics.engine';

beforeEach(() => {
  localStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

describe('StrongmanDiagnosticsHub PRO-3', () => {
  it('yMax пишется в yMaxCm и не трогает stoneKg', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-video"]') as HTMLElement);
    const card = await screen.findByRole('button', { name: /Высота подъёма/ });
    fireEvent.click(card);
    const input = await screen.findByRole('textbox', { name: /Высота подъёма/ });
    fireEvent.change(input, { target: { value: '92' } });
    fireEvent.click(screen.getByText('Готово'));
    await waitFor(() => {
      const raw = localStorage.getItem('he_strongman_diagnostics_hub_v1') || '{}';
      const st = JSON.parse(raw);
      expect(st.yMaxCm).toBe('92');
      expect(st.stoneKg || '').not.toBe('92');
    });
  });
  it('переименованный Мешок: bag_press без дубля press_start', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-load"]') as HTMLElement);
    fireEvent.click(await screen.findByText(/Мешок: жим/));
    expect(document.body.textContent).toContain('bag_press');
  });
  it('таб Загрузки показывает 5-фазные поля', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-load"]') as HTMLElement);
    expect(document.body.textContent).toContain('Камень хват');
    expect(document.body.textContent).toContain('Zero-lap');
    expect(document.body.textContent).toContain('Дней до старта');
  });
  it('таб Переноски показывает класс фермера после ввода', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-carry"]') as HTMLElement);
    expect(screen.getByText(/Фермер \(на руку\)/)).toBeTruthy();
  });
  it('таб Хват показывает бюджет McGill', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-grip"]') as HTMLElement);
    expect(document.body.textContent).toContain('Бюджет McGill');
  });
  it('таб Видео показывает гониометр вместо заглушки', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-video"]') as HTMLElement);
    expect(await screen.findByText(/Видеоуглы с телефона/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('заглушка BlazePose');
  });
  it('movement P2: переноски показывают локомоцию и разворот', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-carry"]') as HTMLElement);
    expect(await screen.findByText(/Длина шага/)).toBeTruthy();
    expect(document.body.textContent).toContain('Разворот 180');
  });
  it('movement P1+P5: загрузки показывают lap-маркер и тайр', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-load"]') as HTMLElement);
    expect(await screen.findByText(/Поздний колени/)).toBeTruthy();
    expect(document.body.textContent).toContain('Тайр 2-я тяга');
  });
  it('movement P7: мобильность показывает YBT и дисклеймер', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-mobility"]') as HTMLElement);
    expect(await screen.findByText(/YBT anterior L/)).toBeTruthy();
    expect(document.body.textContent).toContain('Скрининг, не диагноз');
  });
  it('movement P7: полная YBT-поверхность (PM/PL/UQ)', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-mobility"]') as HTMLElement);
    expect(await screen.findByText(/YBT postmed L/)).toBeTruthy();
    expect(document.body.textContent).toContain('YBT postlat R');
    expect(document.body.textContent).toContain('YBT-UQ L');
  });
  it('movement R2a: чемодан-асимметрия → unilateral farmers_carry в мосте', async () => {
    render(<StrongmanDiagnosticsHub />);
    const fillNum = async (tab: string, label: RegExp, value: string) => {
      fireEvent.click(document.querySelector(`[data-sm="bottom-tab-${tab}"]`) as HTMLElement);
      fireEvent.click(await screen.findByRole('button', { name: label }));
      fireEvent.change(await screen.findByRole('textbox', { name: label }), { target: { value } });
      fireEvent.click(screen.getByText('Готово'));
    };
    await fillNum('carry', /Чемодан L/, '25');
    await fillNum('carry', /Чемодан R/, '30');
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-carry"]') as HTMLElement);
    fireEvent.click(await screen.findByText(SM_BIOMECH.farmers_carry.label));
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-correction"]') as HTMLElement);
    fireEvent.click(await screen.findByText(/Коррекцию в Стронг/));
    await waitFor(() => {
      const raw = localStorage.getItem('he_planner_apply') || '{}';
      const payload = JSON.parse(raw);
      expect(payload?.data?.smUnilateral?.farmers_carry).toBe('left');
    });
  });
  it('movement R3a: факт 20м рендерится отдельно от прогресса', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-carry"]') as HTMLElement);
    expect(await screen.findByText(/Факт 20м/)).toBeTruthy();
  });
  it('movement→причина: слабый холд vs заступ даёт причину grip в Коррекции', async () => {
    render(<StrongmanDiagnosticsHub />);
    const fillNum = async (tab: string, label: RegExp, value: string) => {
      fireEvent.click(document.querySelector(`[data-sm="bottom-tab-${tab}"]`) as HTMLElement);
      fireEvent.click(await screen.findByRole('button', { name: label }));
      fireEvent.change(await screen.findByRole('textbox', { name: label }), { target: { value } });
      fireEvent.click(screen.getByText('Готово'));
    };
    await fillNum('grip', /Удержание фермера/, '25');
    await fillNum('carry', /Время заступа/, '45');
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-carry"]') as HTMLElement);
    fireEvent.click(await screen.findByText(SM_BIOMECH.farmers_carry.label));
    fireEvent.click(document.querySelector('[data-sm="bottom-tab-correction"]') as HTMLElement);
    expect(await screen.findByText(/причина: grip/)).toBeTruthy();
  });
});
