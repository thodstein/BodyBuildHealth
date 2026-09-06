/**
 * pharma-screen-subtab.test.tsx — PharmaScreen учитывает initialSubTab:
 * «course» → страница курса (не hero), «reports» → страница «Фарма-отчёт» с кнопкой генерации.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PharmaScreen } from '../index';

beforeEach(() => {
  localStorage.clear();
});

describe('PharmaScreen — initialSubTab', () => {
  it('без initialSubTab — hero-страница', () => {
    render(<PharmaScreen />);
    expect(screen.getByText('Фармакология')).toBeTruthy();
  });

  it("'course' — открывает страницу курса, а не hero", async () => {
    render(<PharmaScreen initialSubTab="course" />);
    await waitFor(() => {
      expect(screen.queryByText('Фармакология')).toBeNull();
    });
    expect(screen.getAllByText('Курс').length).toBeGreaterThan(0);
  });

  it("'reports' — открывает страницу «Фарма-отчёт» с кнопкой генерации", async () => {
    render(<PharmaScreen initialSubTab="reports" />);
    await waitFor(() => {
      expect(screen.getAllByText(/Сгенерировать отчёт/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Фармакология')).toBeNull();
    expect(screen.getAllByText(/Оценка курса/).length).toBeGreaterThan(0);
  });
});