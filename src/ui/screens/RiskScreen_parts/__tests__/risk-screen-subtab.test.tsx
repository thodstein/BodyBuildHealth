/**
 * risk-screen-subtab.test.tsx — RiskScreen учитывает initialSubTab='reports':
 * открывается страница «Отчёты по рискам» с кнопкой генерации, а не hero.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RiskScreen } from '../../RiskScreen';

beforeEach(() => {
  localStorage.clear();
});

describe('RiskScreen — initialSubTab', () => {
  it('без initialSubTab — hero-страница', () => {
    render(<RiskScreen />);
    expect(screen.getByText('Оценка рисков')).toBeTruthy();
  });

  it("'reports' — открывает страницу отчётов по рискам с кнопкой генерации", async () => {
    render(<RiskScreen initialSubTab="reports" />);
    await waitFor(() => {
      expect(screen.getByText(/Отчёты по рискам/)).toBeTruthy();
    });
    expect(screen.getAllByText(/Сгенерировать отчёт/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Оценка рисков')).toBeNull();
  });
});