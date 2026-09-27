import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('PRO-6 M6: видео-лайт', () => {
  it('Kinovea-CSV импорт убран: textarea нет, ручные углы на месте', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    // Импорт CSV снят 2026-09-27
    expect(screen.queryByLabelText('Kinovea CSV трека')).toBeNull();
    expect(document.querySelector('textarea[placeholder*="Kinovea"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Kinovea');
    // Ручной ввод угла/параллельности остался
    expect(screen.getByLabelText(/Угол запястья видео градусы/)).toBeTruthy();
    expect(screen.getByText('Снаряд не параллелен')).toBeTruthy();
  });
  it('без замеров — тихо, без флагов', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(document.body.textContent).not.toContain('Трек: гуляние');
    expect(document.body.textContent).not.toContain('запястье ломается');
  });
  it('угол 150 без трека — wrist_break', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.change(screen.getByLabelText(/Угол запястья видео градусы/), { target: { value: '150' } });
    expect(document.body.textContent).toContain('запястье ломается');
  });
  it('непараллельный снаряд — not_parallel', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Снаряд не параллелен'));
    expect(document.body.textContent).toContain('не параллелен');
  });
});
