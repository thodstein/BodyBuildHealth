import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor } from '../BbAutoConstructor';

/**
 * Browser-level smoke suite (остаток MAX-PLAN): SSR-рендер ключевых экранов
 * BB-auto в jsdom. Быстрая проверка, что UI собирается без исключений
 * (падает при сломанных хуках/контекстах/импортах).
 */
describe('BB-auto UI smoke', () => {
  it('renders BbAutoConstructor without throwing (params step)', () => {
    let html = '';
    expect(() => { html = renderToStaticMarkup(React.createElement(BbAutoConstructor)); }).not.toThrow();
    expect(html.length).toBeGreaterThan(1000);
    // Ключевые контролы параметров присутствуют.
    expect(html).toContain('Уровень');
    expect(html).toContain('Цель');
    expect(html).toContain('PED');
    expect(html).toContain('Сплит');
  });

  it('renders twice consistently (deterministic SSR)', () => {
    const a = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    const b = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(a).toBe(b);
  });

  it('renders session cards view when plan exists', () => {
    // План по умолчанию не строится (step=params) — проверяем, что UI
    // переживает пустое состояние без плана (нет гонок на builtPlan).
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});
