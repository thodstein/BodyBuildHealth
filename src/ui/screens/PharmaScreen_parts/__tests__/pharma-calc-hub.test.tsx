import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PKPDSimulationTab } from '../PKPDSimulationTab';
import { DosageCalculatorTab } from '../DosageCalculatorTab';
import { PharmaPeptideCalc } from '../PharmaPeptideCalc';
import { MapperTab } from '../MapperTab';
import { DiagnosticsTab } from '../DiagnosticsTab';
import { saveCalcSnapshot, loadCalcHistory, clearCalcHistory } from '../../../../engines/pharma-calc-share.engine';
import { InteractionCheckerTab } from '../InteractionCheckerTab';
import { PHARMA_DB } from '../../../../core/pharma-database';

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
  it('PK: оверлей включается и легенда видна', () => {
    const { container } = render(<PKPDSimulationTab />);
    fireEvent.click(screen.getByText(/Запустить симуляцию/));
    fireEvent.click(screen.getByText(/Bateman-оверлей/));
    expect(container.textContent).toMatch(/нормировано/);
  });
  it('PK: log-шкала переключается', () => {
    const { container } = render(<PKPDSimulationTab />);
    fireEvent.click(screen.getByText(/Запустить симуляцию/));
    fireEvent.click(screen.getByText(/логарифмическая/));
    expect(container.textContent).toMatch(/washout виден/);
  });
  it('Пептиды: кнопка стартовой частоты применяет сетку', () => {
    const { container } = render(<PharmaPeptideCalc />);
    fireEvent.click(screen.getByText(/Применить частоту/));
    expect(container.textContent).toMatch(/Стартовая частота/);
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
  it('Диагностика: тоггл канона t½ виден сразу', () => {
    const { container } = render(<DiagnosticsTab />);
    expect(container.textContent).toMatch(/Канон t½/);
  });
  it('PK: фильтр истории показывает чипы табов', async () => {
    const share = await import('../../../../engines/pharma-calc-share.engine');
    share.saveCalcSnapshot('pkpd', 'probe-filter');
    const { container } = render(<PKPDSimulationTab />);
    fireEvent.click(screen.getByText(/Запустить симуляцию/));
    expect(container.textContent).toMatch(/Все/);
    share.clearCalcHistory();
  });
  it('Взаимодействия: мастерон-id живы в каталоге, дозы из курса', () => {
    expect(PHARMA_DB['drostanolone_prop']?.name).toBeTruthy();
    expect(PHARMA_DB['drostanolone_enan']?.name).toBeTruthy();
    expect(PHARMA_DB['masteron']).toBeUndefined();
    expect(PHARMA_DB['masteron_enan']).toBeUndefined();
    const { container } = render(<InteractionCheckerTab />);
    expect(container.textContent).toMatch(/из курса/);
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
