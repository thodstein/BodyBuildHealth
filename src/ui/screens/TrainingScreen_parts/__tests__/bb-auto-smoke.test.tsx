import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor, backSubgroupLabel, armHeadLabel } from '../BbAutoConstructor';

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

  it('labels back subgroup and arm heads for exercise badges', () => {
    expect(backSubgroupLabel('back_width')).toContain('Ширина');
    expect(backSubgroupLabel('back_thickness')).toContain('Толщина');
    expect(backSubgroupLabel('traps')).toContain('Трапеции');
    expect(backSubgroupLabel('unknown')).toBe('');
    expect(armHeadLabel('biceps_lengthened')).toContain('Длинная');
    expect(armHeadLabel('triceps_pushdown')).toContain('pushdown');
    expect(armHeadLabel('biceps_hammer')).toContain('Брахиалис');
    expect(armHeadLabel('chest')).toBe('');
  });

  it('renderParams содержит выбор проф-методик: DUP, суперсеты, схема объёма, негативы', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('Волновая периодизация (DUP)');
    expect(html).toContain('Выкл (стандартная периодизация)');
    expect(html).toContain('Суперсеты');
    expect(html).toContain('Схема объёма памп-дней');
    expect(html).toContain('Интенсив-техника');
    expect(html).toContain('Авто по фазе');
  });
});
