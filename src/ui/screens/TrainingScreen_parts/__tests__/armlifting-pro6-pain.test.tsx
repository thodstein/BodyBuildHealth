import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M8: карта боли', () => {
  it('карта и флаги видны, без зон — тихо', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: карта боли')).toBeTruthy();
    expect(screen.getByLabelText('Диагностика: красные флаги')).toBeTruthy();
    expect(document.body.textContent).not.toContain('щипок стоп');
  });
  it('зона Палец — точечная разгрузка', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Палец (большой)'));
    expect(document.body.textContent).toContain('щипок стоп');
  });
  it('онемение — стоп к врачу', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Онемение'));
    expect(document.body.textContent).toContain('к врачу');
  });
});
