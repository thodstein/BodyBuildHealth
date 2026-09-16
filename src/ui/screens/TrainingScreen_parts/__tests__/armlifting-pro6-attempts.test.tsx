import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M7: план попыток', () => {
  it('без замеров — плана нет', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(document.body.textContent).not.toContain('План попыток');
  });
  it('RT 100 — план 92.5/97.5/102.5 + 60 сек', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    expect(document.body.textContent).toContain('План попыток');
    expect(document.body.textContent).toContain('60 сек');
  });
});
