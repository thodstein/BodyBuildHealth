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
    expect(screen.getByText(/Спец-блок волной/)).toBeTruthy();
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
  it('единый вердикт: звено + причина, без дубля', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('CoC'));
    fireEvent.click(screen.getByText('Не закрыл'));
    expect(document.body.textContent).toContain('дробление (crush)');
    expect(document.body.textContent).not.toContain('Поиск причины');
  });
  it('D10: уровни тестов, дисбаланс и кожа', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: уровни тестов')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Pinch-hold сек/), { target: { value: '50' } });
    expect(document.body.textContent).toContain('Элита');
    fireEvent.change(screen.getByLabelText(/Сгибатели холд сек/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Разгибатели холд сек/), { target: { value: '20' } });
    expect(document.body.textContent).toContain('дисбаланс');
    fireEvent.click(screen.getByText('Кожа цела'));
    expect(document.body.textContent).toContain('щипок запрещён');
  });
  it('D11/D12: перетест из истории + спец 6 нед', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_armlifting_diag_history', JSON.stringify([
        { date: '2026-08-01', implement: 'rolling_thunder', weakLink: 'fingers', cause: 'volume', pinchHoldSec: 10 },
      ]));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.change(screen.getByLabelText(/Pinch-hold сек/), { target: { value: '15' } });
    expect(document.body.textContent).toContain('Прошлый замер');
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    fireEvent.click(screen.getByText('6 нед'));
    expect(document.body.textContent).toContain('Нед 6');
  });
  it('D13: pinch L/R и ROM-градусы', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/Pinch левая кг/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Pinch левая кг/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Pinch правая кг/), { target: { value: '50' } });
    expect(document.body.textContent).toContain('Pinch-асимметрия');
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText(/Разгибание запястья градусы/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Разгибание запястья градусы/), { target: { value: '55' } });
    expect(document.body.textContent).toContain('ROM-провал');
  });
  it('D15: слабейший → диагностика, разминка, история', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Axle кг/), { target: { value: '120' } });
    fireEvent.click(screen.getByText(/Диагностировать слабейший/));
    expect(screen.getByLabelText('Диагностика: цепочка движения')).toBeTruthy();
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    expect(document.body.textContent).toContain('Нед 4');
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(document.body.textContent).toContain('rolling_thunder');
  });
  it('D16: релевантные тесты и перетест-due', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_armlifting_diag_history', JSON.stringify([
        { date: '2026-01-01', implement: 'rolling_thunder', weakLink: 'fingers', cause: 'volume' },
      ]));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(document.body.textContent).toContain('релевантны: Farmer-hold');
    expect(document.body.textContent).toContain('пора перетест');
  });
  it('D17: порядок в дне виден в коррекции', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    expect(document.body.textContent).toContain('в конце тренировки');
  });
  it('D18: полнота диагностики растёт с вводом', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    expect(screen.getByLabelText('Диагностика: полнота')).toBeTruthy();
    expect(document.body.textContent).toContain('Полнота диагностики: 0%');
    fireEvent.click(screen.getByText('Срыв с пола'));
    expect(document.body.textContent).toContain('Полнота диагностики: 40%');
  });
  it('Коррекция напрямую открывается с топ-3', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText('🔧 Коррекция'));
    expect(screen.getByText(/Спец-блок волной/)).toBeTruthy();
  });
});
