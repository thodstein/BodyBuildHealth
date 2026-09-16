import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M2: лента попытки', () => {
  it('лента видна: setup → фазы → опускание', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: лента попытки')).toBeTruthy();
    expect(document.body.textContent).toContain('Опускание');
  });
  it('клик по фазе ленты ставит точку срыва + норма фазы', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    const лента = screen.getByLabelText('Диагностика: лента попытки');
    const chips = лента.querySelectorAll('button');
    expect(chips.length).toBeGreaterThan(0);
    fireEvent.click(chips[1]);
    expect(document.body.textContent).toContain('Фаза срыва');
  });
  it('PRO-6 M12: звенья фазы — по-русски, без сырых id', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    const лента = screen.getByLabelText('Диагностика: лента попытки');
    const chips = лента.querySelectorAll('button');
    fireEvent.click(chips[1]);
    expect(document.body.textContent).toContain('сгибатели пальцев');
    expect(document.body.textContent).not.toContain('Чинят звенья: fingers');
  });
});
