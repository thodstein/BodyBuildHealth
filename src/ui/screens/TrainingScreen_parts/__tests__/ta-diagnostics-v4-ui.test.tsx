import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

describe('ta-v4 hub UI', () => {
  it('IFP/impulse inputs render in clean tab', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Взятие/ }));
    expect(screen.getByText(/IFP кг/)).toBeTruthy();
    expect(screen.getByText(/Импульс/)).toBeTruthy();
  });
  it('ACL toggles render in jerk tab', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Толчок/ }));
    expect(screen.getByText(/Вальгус колена/)).toBeTruthy();
  });
  it('endurance block renders in clean tab', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Взятие/ }));
    expect(screen.getByText(/Выносливость силы/)).toBeTruthy();
  });
  it('vel-metric toggles render in VBT tab', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT/ }));
    expect(screen.getByText(/Средняя \(mean\)/)).toBeTruthy();
  });
  it('meet-plan renders from manual snatch max in VBT tab', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT/ }));
    const sn = container.querySelector('[data-wl="attempt-sn"]') as HTMLInputElement;
    expect(sn).toBeTruthy();
    fireEvent.change(sn, { target: { value: '100' } });
    expect(container.querySelector('[data-wl="meet-plan"]')).toBeTruthy();
  });
});
