import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

describe('PRO-3 W3 UI: наука', () => {
  it('P8: чек-лист плеча — 5 чеков, сбой даёт стоп', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Чек-лист плеча');
    fireEvent.click(screen.getByText(/Ось цела/));
    expect(document.body.textContent).toContain('broken arm position');
  });
  it('P9+P10: RFD-подпись, эвристики, дриллы старта/лямок, формат best-of-5', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сила/ }));
    expect(document.body.textContent).toContain('~71%');
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Старт без фальстарта');
    expect(document.body.textContent).toContain('best-of-5');
  });
  it('P11: эталоны Zwerus в мобильности', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Zwerus');
    expect(document.body.textContent).toContain('146°');
  });
});
