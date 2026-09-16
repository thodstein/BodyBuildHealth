import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M5: условия замера', () => {
  it('условия видны, дефолт — RT неизвестна = тренировочный', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: условия')).toBeTruthy();
    expect(document.body.textContent).toContain('тренировочный');
  });
  it('V3 + чистые условия — замер в зачёт', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('RT V3'));
    expect(document.body.textContent).toContain('в зачёт');
  });
  it('жидкий мел — тренировочный', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('RT V3'));
    fireEvent.click(screen.getByText('Жидкий мел'));
    expect(document.body.textContent).toContain('Жидкий мел');
  });
});
