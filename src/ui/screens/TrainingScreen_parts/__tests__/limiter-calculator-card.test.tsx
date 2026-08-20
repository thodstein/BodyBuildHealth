import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LimiterCalculatorCard } from '../LimiterCalculatorCard';
import { CYCLE_01 } from '../../../../data/lms-cycles/cycle-01';

afterEach(() => {
  cleanup();
  localStorage.removeItem('he_pl_limiter_card_v1');
});

/** Категория «Скорость» встречается и как чип, и в заголовке секции — кликаем по чипу. */
const clickCategory = (label: RegExp) => fireEvent.click(screen.getAllByText(label)[0]);

describe('LimiterCalculatorCard (калькулятор лимитирующих факторов)', () => {
  it('рендерится с заголовком и движениями', () => {
    const html = renderToStaticMarkup(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    expect(html).toContain('Калькулятор лимитирующих факторов движения');
    expect(html).toContain('Присед');
    expect(html).toContain('Жим лёжа');
    expect(html).toContain('Становая тяга');
    expect(html).toContain('Жим стоя');
    expect(html).toContain('Подъём на бицепс');
  });

  it('для приседа доступны категории-факторы', () => {
    const html = renderToStaticMarkup(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    expect(html).toContain('Скорость (динамический метод)');
    expect(html).toContain('Дожимы и доседы (фазы амплитуды)');
    expect(html).toContain('Стабилизация и жёсткость');
    expect(html).toContain('Режимы сокращения');
    expect(html).toContain('Гипертрофия лимитирующих групп');
    expect(html).toContain('Антропометрия и рычаги');
  });

  it('категория «Скорость» для приседа показывает параметр с методом и протоколом 8×2 @55%', () => {
    render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    clickCategory(/Скорость \(динамический метод\)/);
    expect(screen.getByText('Скорость вставания из ямы')).toBeTruthy();
    expect(screen.getAllByText(/Динамический метод/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/8×2 @55% RIR 3/).length).toBeGreaterThanOrEqual(1);
  });

  it('дожим (жим лёжа): 4×3 @80% — частичные повторы, тяжёлый протокол', () => {
    render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    fireEvent.click(screen.getByText('Жим лёжа'));
    clickCategory(/Дожимы и доседы \(фазы амплитуды\)/);
    expect(screen.getByText('Слабый «дожим» (трицепс в финальной трети)')).toBeTruthy();
    expect(screen.getAllByText(/4×3 @80% RIR 1/).length).toBeGreaterThanOrEqual(1);
  });

  it('«➕ Рекомендуемое» добавляет упражнение и включает кнопку применения', () => {
    render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    clickCategory(/Скорость \(динамический метод\)/);
    fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
    expect(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
  });

  it('применение отправляет kind limiter с протоколами категорий (не трогает слабые группы)', () => {
    const origDispatch = window.dispatchEvent;
    const dispatched: any[] = [];
    window.dispatchEvent = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'planner-apply') dispatched.push(e.detail);
      return origDispatch(e);
    };
    try {
      render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
      clickCategory(/Скорость \(динамический метод\)/);
      fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
      fireEvent.click(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто/));
      const payload = dispatched.find((d: any) => d?.kind === 'limiter');
      expect(payload).toBeTruthy();
      expect(payload.label).toContain('Лимитирующие факторы');
      expect(Object.keys(payload.data.limiterExerciseMap).length).toBeGreaterThan(0);
      const key = Object.keys(payload.data.limiterExerciseMap)[0];
      expect(payload.data.limiterProtocolMap[key]).toBeTruthy();
      expect(payload.data.limiterProtocolMap[key].category).toBe('speed_strength');
      expect(payload.data.groups).toBeUndefined();
    } finally {
      window.dispatchEvent = origDispatch;
    }
  });

  it('персистентность: выбор переживает remount', () => {
    const { unmount } = render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    clickCategory(/Скорость \(динамический метод\)/);
    fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
    unmount();
    render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    expect(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
  });

  it('смена движения сбрасывает выбранные упражнения', () => {
    render(<LimiterCalculatorCard dayCount={3} template={CYCLE_01} />);
    clickCategory(/Скорость \(динамический метод\)/);
    fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
    fireEvent.click(screen.getByText('Жим лёжа'));
    expect(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто \(0\)/)).toBeTruthy();
  });

  it('битый storage → дефолт без падения', () => {
    localStorage.setItem('he_pl_limiter_card_v1', '{broken json');
    const html = renderToStaticMarkup(<LimiterCalculatorCard />);
    expect(html).toContain('Калькулятор лимитирующих факторов движения');
  });
});
