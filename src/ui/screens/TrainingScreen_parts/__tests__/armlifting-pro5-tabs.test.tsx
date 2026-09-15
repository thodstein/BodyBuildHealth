import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-5 UI: помост + диагностика + коррекция', () => {
  it('дефолт — замеры со старыми контрактами, соревы удалены', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/RT кг/)).toBeTruthy();
    expect(screen.getByText('📏 Замеры')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Last-man-standing');
    expect(document.body.textContent).not.toContain('90/96/102');
    expect(screen.queryByLabelText(/Вес попытки кг/)).toBeNull();
  });
  it('Диагностика: снаряд → срыв → фолы → диагноз', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: снаряд')).toBeTruthy();
    fireEvent.click(screen.getByText('Saxon'));
    fireEvent.click(screen.getByText('Срыв с пола'));
    expect(document.body.textContent).toContain('Слабое звено');
  });
  it('2 фола — техника high + переход к коррекции с топ-3', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    const fouls = screen.getByLabelText('Диагностика: фолы');
    const chips = fouls.querySelectorAll('button');
    fireEvent.click(chips[0]);
    fireEvent.click(chips[1]);
    expect(document.body.textContent).toContain('техника');
    fireEvent.click(screen.getByText(/К коррекции/));
    expect(screen.getByText(/Мини спец-блок/)).toBeTruthy();
    expect(document.body.textContent).toContain('Нед 4');
  });
  it('цепочка движения: фазы + подсветка срыва', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: цепочка движения')).toBeTruthy();
    fireEvent.click(screen.getByText('Срыв с пола'));
    expect(document.body.textContent).toContain('Отрыв');
    expect(document.body.textContent).toContain('✗');
  });
  it('Коррекция напрямую открывается с топ-3', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    expect(screen.getByText(/Мини спец-блок/)).toBeTruthy();
  });
});
