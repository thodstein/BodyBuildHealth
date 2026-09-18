import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-CORR K6 UI: коррекция показывает почему/кью/запасную/волну', () => {
  it('таб Коррекция: почему + кью + запасная + деталь волны', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    expect(screen.getByText(/Почему:/)).toBeTruthy();
    expect(screen.getAllByText(/Кью:/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Запасная:/)).toBeTruthy();
    expect(document.body.textContent).toContain('Нед 4');
    expect(screen.getAllByText(/Прогрессия:/).length).toBeGreaterThan(0);
  });
  it('диагноз с болью — коррекция только щадящая (стоп-нагрузка)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    const pain = screen.getByText('Боли нет');
    fireEvent.click(pain);
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    const body = document.body.textContent || '';
    expect(body).toContain('Ролик для запястья');
    expect(body).not.toContain('Rolling Thunder (вращающаяся ручка)');
    expect(body).not.toContain('78кг одной рукой');
  });
});
