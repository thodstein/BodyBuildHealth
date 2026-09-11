import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { VolumeHub } from '../VolumeHub';
import { VolumeOptimizerTab } from '../VolumeOptimizerTab';
import { TonnageCalcTab } from '../TonnageCalcTab';
import { PlateCalcTab } from '../PlateCalcTab';

afterEach(cleanup);

function tonnageDeleteCount(container: HTMLElement): number {
  const root = container.querySelector('.train-tonnage');
  if (!root) return -1;
  return Array.from(root.querySelectorAll('button')).filter(b => b.textContent === '✕').length;
}

describe('volume shared input: строки общие для табов', () => {
  it('добавление строки в «Объёме» видно в «Тоннаже» (4 vs автономных 2)', () => {
    const { container } = render(<VolumeHub initialMode="volume" />);
    fireEvent.click(screen.getByText('+ Добавить упражнение'));
    fireEvent.click(screen.getByTitle(/Прилепин \+ INOL/));
    expect(container.querySelector('.train-tonnage')).not.toBeNull();
    expect(tonnageDeleteCount(container)).toBe(4);
  });

  it('автономный тоннаж по-прежнему со своими 2 строками', () => {
    const { container } = render(<TonnageCalcTab />);
    expect(tonnageDeleteCount(container)).toBe(2);
  });

  it('удаление в «Объёме» убирает строку из «Тоннажа» (присед остаётся — признак sharing)', () => {
    const { container } = render(<VolumeHub initialMode="volume" />);
    const vol = container.querySelector('.train-volopt')!;
    const dels = Array.from(vol.querySelectorAll('button')).filter(b => b.textContent === '✕');
    expect(dels.length).toBe(3);
    fireEvent.click(dels[0]); // удалить жим
    fireEvent.click(screen.getByTitle(/Прилепин \+ INOL/));
    expect(tonnageDeleteCount(container)).toBe(2);
    // приседа нет в автономном тоннаже — его наличие доказывает общие строки
    expect(within(container.querySelector('.train-tonnage') as HTMLElement).getAllByText(/Приседания/).length).toBeGreaterThan(0);
  });
});

describe('volume shared input: тоннаж фильтрует недели (Е4)', () => {
  const shared = [
    { id: 'w1', exerciseId: 'bench_bar', week: 1, day: 1, weight: 80, reps: 5, sets: 4 },
    { id: 'w2', exerciseId: 'bench_bar', week: 2, day: 1, weight: 82.5, reps: 5, sets: 4 },
  ];
  it('табы недель есть; Н1 показывает 1 строку (INOL не раздут)', () => {
    const { container } = render(<TonnageCalcTab sharedRows={shared} onSharedRowsChange={() => {}} />);
    expect(screen.getByText('Н1')).toBeTruthy();
    expect(screen.getByText('Н2')).toBeTruthy();
    fireEvent.click(screen.getByText('Н1'));
    const root = container.querySelector('.train-tonnage')!;
    expect(Array.from(root.querySelectorAll('button')).filter(b => b.textContent === '✕')).toHaveLength(1);
  });
});

describe('volume shared input: division (Ж3)', () => {
  it("hub division='pl' стартует с тоннажа", () => {
    const { container } = render(<VolumeHub initialMode={undefined} division="pl" />);
    expect(container.querySelector('.train-tonnage')).not.toBeNull();
    expect(container.querySelector('.train-volopt')).toBeNull();
  });

  it("оптимизатор division='pl' — SFR-цель Сила активна", () => {
    render(<VolumeOptimizerTab division="pl" />);
    fireEvent.click(screen.getByText('Рекомендации по замене (SFR)'));
    expect(screen.getByLabelText('SFR-цель: сила').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('SFR-цель: масса').getAttribute('aria-pressed')).toBe('false');
  });

  it("дефолт без division — Масса активна", () => {
    render(<VolumeOptimizerTab />);
    fireEvent.click(screen.getByText('Рекомендации по замене (SFR)'));
    expect(screen.getByLabelText('SFR-цель: масса').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('volume shared input: честные подписи (И2)', () => {
  it('тоннаж: «Индекс нагрузки», а не «КПШ»; паттерн-тоннаж виден', () => {
    const { container } = render(<TonnageCalcTab />);
    expect(container.textContent).toContain('Индекс нагрузки');
    expect(container.textContent).not.toContain('КПШ по мышцам');
    expect(container.textContent).toContain('паттерн-весами');
  });
});

describe('volume shared input: контролируемый оптимизатор', () => {
  it('рендерит переданные строки; ✕ зовёт onRowsChange с []', () => {
    const fn = vi.fn();
    const { container } = render(
      <VolumeOptimizerTab
        rows={[{ id: 'x1', exerciseId: 'bench_bar', week: 1, day: 1, weight: 70, reps: 8, sets: 3, rpe: 8 }]}
        onRowsChange={fn}
      />,
    );
    const vol = container.querySelector('.train-volopt')!;
    const dels = Array.from(vol.querySelectorAll('button')).filter(b => b.textContent === '✕');
    expect(dels).toHaveLength(1);
    fireEvent.click(dels[0]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toEqual([]);
  });
});

describe('volume shared input: блины следуют за строками', () => {
  it('хаб в plates: топ-вес 100 + селектор строк + возврат веса', () => {
    const { container } = render(<VolumeHub initialMode="plates" />);
    expect(container.querySelector('.train-plates')).not.toBeNull();
    expect(screen.getByText('Упражнение текущей сессии')).toBeTruthy();
    expect(screen.getByText('✅ Вернуть вес в строки')).toBeTruthy();
  });

  it('автономные блины без exerciseOptions — без селектора (контракт цел)', () => {
    const { container } = render(<PlateCalcTab />);
    expect(container.querySelector('.train-plates')).not.toBeNull();
    expect(container.textContent).not.toContain('Упражнение текущей сессии');
  });
});
