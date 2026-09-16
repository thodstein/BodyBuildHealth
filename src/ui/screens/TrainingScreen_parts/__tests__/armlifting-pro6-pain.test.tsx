import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';
import { getPlannerApply } from '../planner-bridge';

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
  it('битые зоны в сторе отфильтровываются (whitelist)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_armlifting_diag2_v1', JSON.stringify({ implement: 'rolling_thunder', painZones: ['thumb', 'zzz'] }));
    } catch { /* noop */ }
    const { unmount } = render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    const lift = (getPlannerApply()?.data as any)?.armLifting;
    expect(lift?.diagPainZones).toEqual(['thumb']);
    unmount();
  });
});
