import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

const clear = () => { try { localStorage.clear(); } catch { /* noop */ } };

describe('PRO-4 UI: хаб армлифтинга', () => {
  it('новые поля рендерятся: Pinch кг, Silver, L/R, вес тела', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/Pinch кг/)).toBeTruthy();
    expect(screen.getByLabelText(/Silver сек/)).toBeTruthy();
    expect(screen.getByLabelText(/RT левая кг/)).toBeTruthy();
    expect(screen.getByLabelText(/RT правая кг/)).toBeTruthy();
    expect(screen.getByLabelText(/Вес тела кг/)).toBeTruthy();
    expect(screen.getByLabelText(/Raptor кг/)).toBeTruthy();
  });
  it('класс по весу: 85кг М → М-90', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/Вес тела кг/), { target: { value: '85' } });
    expect(document.body.textContent).toContain('М-90');
  });
  it('L/R дают асимметрию, рецепт и last-man-standing', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT левая кг/), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/RT правая кг/), { target: { value: '66' } });
    expect(document.body.textContent).toContain('асимметрия');
    expect(document.body.textContent).toContain('Рецепт:');
    expect(document.body.textContent).toContain('Last-man-standing');
  });
  it('чек-лист правил: клик меняет подпись', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByLabelText(/Правило 1/));
    expect(document.body.textContent).toContain('тренировочный');
  });
  it('старые контракты целы: RT кг, CoC, Excalibur, Введи замеры, экспорт', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/RT кг/)).toBeTruthy();
    expect(screen.getByLabelText(/CoC уровень/)).toBeTruthy();
    expect(screen.getByLabelText(/Excalibur кг/)).toBeTruthy();
    expect(document.body.textContent).toContain('Введи замеры');
    expect(screen.getByText('🖨 HTML')).toBeTruthy();
    expect(screen.getByText('📥 CSV')).toBeTruthy();
  });
});
