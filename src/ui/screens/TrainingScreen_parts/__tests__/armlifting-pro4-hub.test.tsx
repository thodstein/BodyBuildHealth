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
  // Аудит 2026-10: граница «в хабе классовых строк нет» СОХРАНЯЕТСЯ (соревновательная
  // часть хаба удалена осознанно), но мёртвое поле моста закрыто: `weightClass` теперь
  // уезжает в payload (конструктор держал за ним ветку «когда отправят»), а в DOM хаба
  // класса по-прежнему нет. Проверяется и то, и другое.
  it('вес тела едет в конструктор: в payload класс, в DOM хабе — нет', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/Вес тела кг/), { target: { value: '85' } });
    expect(document.body.textContent).not.toContain('М-90');
    expect((screen.getByLabelText(/Вес тела кг/) as HTMLInputElement).value).toBe('85');
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByLabelText(/Применить в Арм-конструктор/));
    const raw = localStorage.getItem('he_planner_apply') || '';
    expect(raw).toContain('weightClass');
    expect(raw).toContain('М-90');
    expect(raw).toContain('rulesNote');
    expect(raw).toContain('"lms"');
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
  // Аудит 2026-10 было→стало: нумерованного чек-листа «Правило 1..5» нет и не было,
  // но и значимого ввода правил тоже не было — движок `assessLiftRules` висел без
  // UI, и «замер по правилам» нельзя было ни отметить, ни отправить. Теперь это
  // чипы в табе «Диагностика» + строка вердикта + поле `rulesNote` в мост.
  it('чек-лист правил — чипы с вердиктом; фолы живут в диагностике', () => {
    clear();
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.queryByLabelText(/Правило 1/)).toBeNull();
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: правила замера')).toBeTruthy();
    expect(screen.getByLabelText('Диагностика: фолы')).toBeTruthy();
    fireEvent.click(screen.getByText('DOH, без лямок'));
    expect(document.body.textContent).toContain('чек-лист правил не заполнен');
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
