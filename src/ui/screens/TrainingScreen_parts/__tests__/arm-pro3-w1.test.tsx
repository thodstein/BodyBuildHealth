import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

describe('PRO-3 W1 UI: честность', () => {
  it('P6: 4-я точка — тост «вне топ-3», выбор не меняется', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find((el) => el.tagName === 'BUTTON')!);
    fireEvent.click(screen.getByText(/Cup старт/));
    fireEvent.click(screen.getByText(/Rising/));
    fireEvent.click(screen.getByText(/Pron откр/));
    fireEvent.click(screen.getByText(/Sup cup/));
    expect(document.body.textContent).toContain('вне топ-3');
  });
  it('P1: поле скорости 2-го подхода есть + один замер не даёт loss', () => {
    render(<ArmDiagnosticsHub />);
    expect(screen.getByLabelText(/VBT скорость м\/с/)).toBeTruthy();
    expect(screen.getByLabelText(/VBT скорость второго подхода/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/VBT скорость м\/с/), { target: { value: '0.6' } });
    // аудит 2026-10: без 2-го замера loss null — синтетический `+0.2` больше не выдумывает stop-зону
    expect(document.body.textContent).toContain('loss не оценивается');
    expect(document.body.textContent).not.toContain('best≈ввод+0.2');
  });
  it('P2: hero показывает «недостаточно данных» без замеров', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    const hero = container.querySelector('[data-arm="force-score"]');
    expect(hero?.textContent).toContain('недостаточно данных');
  });
});
