import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

const CSV = ['t,x,y', '0,0,0', '0.5,8,10', '1.0,-4,20', '1.5,6,30'].join('\n');

describe('PRO-6 M6: видео-лайт', () => {
  it('без CSV — тихо, без флагов', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Kinovea CSV трека')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Трек: гуляние');
  });
  it('CSV с гулянием — drift_big', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.change(screen.getByLabelText('Kinovea CSV трека'), { target: { value: CSV } });
    expect(document.body.textContent).toContain('гуляние');
  });
  it('угол 150 без трека — wrist_break', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.change(screen.getByLabelText(/Угол запястья видео градусы/), { target: { value: '150' } });
    expect(document.body.textContent).toContain('запястье ломается');
  });
});
