import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M3/M4: рука + холд-кривая', () => {
  it('рука: дефолт просит размах, ввод 19 — толстый гриф дорог', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(document.body.textContent).toContain('Замерь размах');
    fireEvent.change(screen.getByLabelText(/Размах кисти см/), { target: { value: '19' } });
    expect(document.body.textContent).toContain('дорогие');
  });
  it('кривая: макс + 70% дают вердикт', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.change(screen.getByLabelText(/Farmer-hold сек/), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Холд 70 процентов сек/), { target: { value: '70' } });
    expect(document.body.textContent).toContain('Пик плывёт');
  });
  it('без второго холда — кривой нет, старые тесты целы', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(document.body.textContent).not.toContain('Кривая:');
  });
});
