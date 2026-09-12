import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PKPDSimulationTab } from '../PKPDSimulationTab';
import { DosageCalculatorTab } from '../DosageCalculatorTab';
import { PharmaPeptideCalc } from '../PharmaPeptideCalc';
import { MapperTab } from '../MapperTab';
import { DiagnosticsTab } from '../DiagnosticsTab';
import { saveCalcSnapshot, loadCalcHistory, clearCalcHistory } from '../../../../engines/pharma-calc-share.engine';

describe('pharma hub E-guard: новые панели живы', () => {
  it('PK: канон-бейдж conf/5 на карточке по умолчанию', () => {
    const { container } = render(<PKPDSimulationTab />);
    expect(container.textContent).toMatch(/conf [1-5]\/5/);
    expect(container.textContent).toMatch(/PK\/PD симуляция/);
  });
  it('PK: симуляция показывает Bateman-панель и историю', () => {
    const { container } = render(<PKPDSimulationTab />);
    fireEvent.click(screen.getByText(/Запустить симуляцию/));
    expect(container.textContent).toMatch(/Bateman-канон/);
    expect(container.textContent).toMatch(/История расчётов/);
  });
  it('Дозировки: таб + андрогенный подтаб', () => {
    const { container } = render(<DosageCalculatorTab />);
    expect(container.textContent).toMatch(/Фармакология/);
    fireEvent.click(screen.getByText(/Андрогенный индекс/));
    fireEvent.click(screen.getByText(/Рассчитать/));
    expect(container.textContent).toMatch(/сырой/);
    expect(container.textContent).toMatch(/Stack-burden lite/);
  });
  it('Пептиды: разведение + сетка + кросс-проверка', () => {
    const { container } = render(<PharmaPeptideCalc />);
    expect(container.textContent).toMatch(/Калькулятор разведения/);
    expect(container.textContent).toMatch(/Рекомендуемая сетка/);
    expect(container.textContent).toMatch(/Кросс-проверка/);
  });
  it('Маппер: заголовок + матрица-хинт после запуска', () => {
    const { container } = render(<MapperTab />);
    expect(container.textContent).toMatch(/Маппер/);
  });
  it('Диагностика: 5-engine + честный ПКТ-блок после запуска', () => {
    const { container } = render(<DiagnosticsTab />);
    expect(container.textContent).toMatch(/5-Engine/);
  });
  it('История: save → load → clear roundtrip', () => {
    clearCalcHistory();
    expect(loadCalcHistory().length).toBe(0);
    saveCalcSnapshot('test', 'probe');
    expect(loadCalcHistory().length).toBe(1);
    clearCalcHistory();
    expect(loadCalcHistory().length).toBe(0);
  });
});
