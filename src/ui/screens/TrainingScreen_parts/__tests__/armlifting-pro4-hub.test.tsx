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
  it('вес тела едет в конструктор, классов нет (соревы удалены)', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/Вес тела кг/), { target: { value: '85' } });
    expect(document.body.textContent).not.toContain('М-90');
    expect((screen.getByLabelText(/Вес тела кг/) as HTMLInputElement).value).toBe('85');
  });
  it('L/R дают асимметрию и рецепт, без last-man-standing', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT левая кг/), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/RT правая кг/), { target: { value: '66' } });
    expect(document.body.textContent).toContain('асимметрия');
    expect(document.body.textContent).toContain('Рецепт:');
    expect(document.body.textContent).not.toContain('Last-man-standing');
  });
  it('чек-листа правил нет (соревы удалены), фолы живут в диагностике', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.queryByLabelText(/Правило 1/)).toBeNull();
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: фолы')).toBeTruthy();
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
