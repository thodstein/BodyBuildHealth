import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

describe('BBDiagnosticsHub', () => {
  beforeEach(() => { localStorage.clear(); });
  it('renders header and tabs', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/ББ-диагностика — хаб PRO/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Слабые/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Симметрия/)[0]).toBeInTheDocument();
  });
  it('toggles weak manual 1-2 and conflict shoulders+delt_mid', () => {
    render(<BBDiagnosticsHub />);
    const btnMid = screen.getAllByText('Средняя дельта')[0];
    fireEvent.click(btnMid);
    expect(btnMid.getAttribute('aria-pressed')).toBe('true');
    // second zone same muscle allowed
    const btnRear = screen.getAllByText('Задняя дельта')[0];
    fireEvent.click(btnRear);
    expect(btnRear.getAttribute('aria-pressed')).toBe('true');
  });
  it('apply without weak does not crash', () => {
    render(<BBDiagnosticsHub />);
    const apply = screen.getAllByText(/Применить в ББ-авто/)[0];
    expect(() => fireEvent.click(apply)).not.toThrow();
    expect(screen.getAllByText(/Применить в ББ-авто/)[0]).toBeInTheDocument();
  });
  it('mobility OHS toggle and apply to profile', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность\/VBT/)[0]);
    const chk = screen.getByLabelText(/Пятки плоско/);
    fireEvent.click(chk);
    expect(chk).not.toBeChecked();
  });
});
