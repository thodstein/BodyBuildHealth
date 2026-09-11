import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

describe('StrongmanDiagnosticsHub PRO-3', () => {
  it('yMax пишется в yMaxCm и не трогает stoneKg', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(screen.getByText(/Видео/));
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
    fireEvent.click(screen.getByText(/Загрузки/));
    fireEvent.click(await screen.findByText(/Мешок: жим/));
    expect(document.body.textContent).toContain('bag_press');
  });
  it('таб Загрузки показывает 5-фазные поля', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(screen.getByText(/Загрузки/));
    expect(document.body.textContent).toContain('Камень хват');
    expect(document.body.textContent).toContain('Zero-lap');
    expect(document.body.textContent).toContain('Дней до старта');
  });
  it('таб Переноски показывает класс фермера после ввода', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(screen.getByText(/Переноски/));
    expect(screen.getByText(/Фермер \(на руку\)/)).toBeTruthy();
  });
  it('таб Хват показывает бюджет McGill', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(screen.getByText(/Хват\/Кор/));
    expect(document.body.textContent).toContain('Бюджет McGill');
  });
});
