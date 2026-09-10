/**
 * arm-wizard-nav.test.tsx — визард 8 шагов в стиле ББ-авто:
 * params → athlete → grip → split → plan → quality → export → year.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('Arm wizard navigation', () => {
  it('7 шагов в порядке, маркеры на местах', () => {
    const { container } = render(<ArmAutoConstructor />);
    const steps = container.querySelectorAll("[data-arm='steps'] .ad-step");
    expect(Array.from(steps).map((s) => s.textContent)).toEqual([
      '1🎛 Параметры',
      '2🎯 Атлет',
      '3✊ Стол и хват',
      '4📚 Сплит и цикл',
      '5📋 План',
      '6🏋️ Веса и качество',
      '7📤 Экспорт',
      '8🗓 Год',
    ]);
    expect(document.body.textContent).toContain('Дисциплина');
    expect(container.querySelector("[data-arm='steps']")?.getAttribute('aria-label')).toBe('Шаги');
  });

  it('группы ББ-стиля: ПАРАМЕТРЫ / ПЛАН / ВЫДАЧА', () => {
    const { container } = render(<ArmAutoConstructor />);
    const bar = container.querySelector("[data-arm='steps']")!.textContent;
    expect(bar).toContain('ПАРАМЕТРЫ');
    expect(bar).toContain('ПЛАН');
    expect(bar).toContain('ВЫДАЧА');
  });

  it('«Далее/Назад» ведут по цепочке params → athlete → grip → split', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByText('Далее: Атлет →'));
    expect(document.body.textContent).toContain('Слабые зоны');
    fireEvent.click(screen.getByText('Далее: Стол и хват →'));
    expect(document.body.textContent).toContain('Хват — диагностика');
    expect(document.body.textContent).toContain('TOP: матчап');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Слабые зоны');
    fireEvent.click(screen.getByText('Далее: Стол и хват →'));
    fireEvent.click(screen.getByText('Далее: Сплит и цикл →'));
    expect(document.body.textContent).toContain('Выбор сплита');
  });

  it('сплит и цикл — один шаг: пикер, шит и сборка рядом', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    expect(container.querySelector("[data-arm='split-list']")).not.toBeNull();
    expect(container.querySelector("[data-arm='cycle-picker']")).not.toBeNull();
    const head = screen.getAllByRole('button', { name: /Именной цикл/ }).find((b) => b.getAttribute('aria-expanded') != null);
    expect(head).toBeTruthy();
    if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
    expect(screen.getByRole('button', { name: 'Цикл: — обычный план —' })).toBeTruthy();
    expect(screen.getByText('⚡ Собрать план')).toBeTruthy();
  });

  it('план — только выдача: дашборд и недели, гейтов нет', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(container.querySelector("[data-arm='plan-dash']")).not.toBeNull();
    expect(container.querySelector("[data-arm='gates']")).toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).toBeNull();
    fireEvent.click(screen.getByText('Далее: Проверка →'));
    expect(container.querySelector("[data-arm='gates']")).not.toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).not.toBeNull();
    expect(document.body.textContent).toContain('Тепловая карта');
  });

  it('экспорт — печать и обоснование отдельно от плана', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    go('📤 Экспорт');
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
    expect(container.querySelector("[data-arm='rationale']")).not.toBeNull();
  });

  it('экспорт — копирование сводки в буфер', async () => {
    const writes: string[] = [];
    const nav: any = window.navigator as any;
    const prev = nav.clipboard;
    try {
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: (s: string) => { writes.push(s); return Promise.resolve(); } }, configurable: true });
      render(<ArmAutoConstructor />);
      go('📚 Сплит и цикл');
      fireEvent.click(screen.getByText('⚡ Собрать план'));
      go('📤 Экспорт');
      fireEvent.click(screen.getByText('📋 Копировать сводку'));
      await screen.findByText('✅ Сводка скопирована');
      expect(writes.length).toBe(1);
      expect(writes[0]).toContain('Арм-план');
      expect(writes[0]).toMatch(/Н1 \(.+?\): \d+/);
    } finally {
      if (prev === undefined) { try { delete (window.navigator as any).clipboard; } catch {} }
      else { Object.defineProperty(window.navigator, 'clipboard', { value: prev, configurable: true }); }
    }
  });

  it('пустой план — только карточка-мост, гейтов нет', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📋 План');
    expect(document.body.textContent).toContain('План не собран');
    expect(container.querySelector("[data-arm='gates']")).toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).toBeNull();
  });

  it('шаги с enter-переходом: ad-stepview + reduced-motion', () => {
    const { container } = render(<ArmAutoConstructor />);
    expect(container.querySelector('.ad-stepview'), 'stepview').not.toBeNull();
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'), 'utf-8');
    expect(css).toContain('.ad-stepview');
    expect(css).toContain('adTabIn');
    const rmIdx = css.indexOf('prefers-reduced-motion');
    expect(rmIdx).toBeGreaterThan(-1);
    expect(css.slice(rmIdx)).toContain('.ad-stepview');
  });
});
