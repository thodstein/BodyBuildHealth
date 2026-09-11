import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

describe('PRO-3 W2 UI: персист и нормы', () => {
  it('P4: red-flag персистится между маунтами', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    const first = render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByText('Острая боль'));
    expect(document.body.textContent).toContain('Стоп: Острая боль');
    first.unmount();
    render(<ArmDiagnosticsHub />);
    expect(document.body.textContent).toContain('Стоп: Острая боль');
  });
  it('P3: строка класса WAF видна (М, по весу 80 → М-80)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    const { container } = render(<ArmDiagnosticsHub />);
    const el = container.querySelector('[data-arm="waf-class"]');
    expect(el?.textContent).toContain('М-80');
  });
  it('P5: снапшот берёт vbtVel2 и грузит обратно', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find((el) => el.tagName === 'BUTTON')!);
    fireEvent.click(screen.getByRole('button', { name: /Хват/ }));
    fireEvent.change(screen.getByLabelText(/VBT скорость второго подхода/), { target: { value: '0.7' } });
    fireEvent.click(screen.getByText(/Снапшот текущего/));
    fireEvent.change(screen.getByLabelText(/VBT скорость второго подхода/), { target: { value: '' } });
    fireEvent.click(screen.getByText(/Загрузить/));
    expect((screen.getByLabelText(/VBT скорость второго подхода/) as HTMLInputElement).value).toBe('0.7');
  });
});
