import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('W-AL UI: хаб армлифтинга', () => {
  it('рендер: замеры + вердикт-хинт без данных', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/RT кг/)).toBeTruthy();
    expect(screen.getByLabelText(/CoC уровень/)).toBeTruthy();
    expect(screen.getByLabelText(/Excalibur кг/)).toBeTruthy();
    expect(document.body.textContent).toContain('Введи замеры');
  });
  it('RT 65.25 → 50% и вердикт многоборья', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '65.25' } });
    expect(document.body.textContent).toContain('50%');
    expect(document.body.textContent).toContain('Многоборье');
  });
  it('пустой мост — честный тост, без отправки', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('Нечего отправлять');
  });
  it('W5c: кнопки экспорта рендерятся', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByText('🖨 HTML')).toBeTruthy();
    expect(screen.getByText('📥 CSV')).toBeTruthy();
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
  });
  it('мост с RT — тост про армлифтинг + трек arm', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '80' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('армлифтинг');
    expect(localStorage.getItem('he_training_planning_track')).toBe('arm');
  });
});
