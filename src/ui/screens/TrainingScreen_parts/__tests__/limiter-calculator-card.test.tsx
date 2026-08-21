import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LimiterCalculatorCard } from '../LimiterCalculatorCard';

afterEach(() => {
  cleanup();
  localStorage.removeItem('he_pl_limiter_card_v1');
});

describe('LimiterCalculatorCard (11 калькуляторов × 6 движений)', () => {
  it('рендерится с заголовком и всеми 11 калькуляторами (категориями)', () => {
    const html = renderToStaticMarkup(<LimiterCalculatorCard dayCount={3} />);
    expect(html).toContain('Калькулятор лимитирующих факторов движения');
    for (const label of ['Скорость (динамический метод)', 'Дожимы и доседы (фазы амплитуды)', 'Стабилизация и жёсткость', 'Режимы сокращения', 'Гипертрофия лимитирующих групп', 'Антропометрия и рычаги', 'Тип старта и срыва', 'Хват и периферия', 'Координация и синергия', 'Профиль выносливости', 'Геометрия техники']) {
      expect(html, label).toContain(label);
    }
  });

  it('выбор калькулятора «Скорость» показывает параметры для ВСЕХ движений (жим лёжа + присед + ...)', () => {
    render(<LimiterCalculatorCard dayCount={3} />);
    fireEvent.click(screen.getByText('⚡ Скорость (динамический метод)'));
    // Жим лёжа и присед — оба в этом калькуляторе
    expect(screen.getByText('Скорость срыва с груди (стартовая сила)')).toBeTruthy();
    expect(screen.getByText('Скорость вставания из ямы')).toBeTruthy();
    expect(screen.getAllByText(/Динамический метод/).length).toBeGreaterThanOrEqual(1);
    // Секции движений видимы
    expect(screen.getAllByText('🏋️ Жим лёжа').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('🏋️ Присед').length).toBeGreaterThanOrEqual(1);
  });

  it('калькулятор «Дожимы и доседы»: дожим жима лёжа 4×3 @80%', () => {
    render(<LimiterCalculatorCard dayCount={3} />);
    fireEvent.click(screen.getByText('📏 Дожимы и доседы (фазы амплитуды)'));
    expect(screen.getByText('Слабый «дожим» (трицепс в финальной трети)')).toBeTruthy();
    expect(screen.getAllByText(/4×3 @80% RIR 1/).length).toBeGreaterThanOrEqual(1);
  });

  it('фильтр движений: выбор «Жим лёжа» оставляет только его параметры', () => {
    render(<LimiterCalculatorCard dayCount={3} />);
    fireEvent.click(screen.getByText('⚡ Скорость (динамический метод)'));
    fireEvent.click(screen.getAllByText('Жим лёжа')[0]);
    expect(screen.getByText('Скорость срыва с груди (стартовая сила)')).toBeTruthy();
    expect(screen.queryByText('Скорость вставания из ямы')).toBeNull();
  });

  it('«➕ Рекомендуемое» добавляет упражнение и включает кнопку применения', () => {
    render(<LimiterCalculatorCard dayCount={3} />);
    fireEvent.click(screen.getByText('⚡ Скорость (динамический метод)'));
    fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
    expect(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
  });

  it('применение отправляет kind limiter с протоколами категорий', () => {
    const origDispatch = window.dispatchEvent;
    const dispatched: any[] = [];
    window.dispatchEvent = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'planner-apply') dispatched.push(e.detail);
      return origDispatch(e);
    };
    try {
      render(<LimiterCalculatorCard dayCount={3} />);
      fireEvent.click(screen.getByText('⚡ Скорость (динамический метод)'));
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
    const { unmount } = render(<LimiterCalculatorCard dayCount={3} />);
    fireEvent.click(screen.getByText('⚡ Скорость (динамический метод)'));
    fireEvent.click(screen.getAllByText('➕ Рекомендуемое')[0]);
    unmount();
    render(<LimiterCalculatorCard dayCount={3} />);
    expect(screen.getByText(/🛠 Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
  });

  it('битый storage → дефолт без падения', () => {
    localStorage.setItem('he_pl_limiter_card_v1', '{broken json');
    const html = renderToStaticMarkup(<LimiterCalculatorCard />);
    expect(html).toContain('Калькулятор лимитирующих факторов движения');
  });
});
