import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor } from '../BbAutoConstructor';

describe('BB-auto объёмный ↔ обычный + капы от уровня', () => {
  it('SSR содержит переключатель объёмного тренинга и подсказку про капы', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('Объёмный тренинг');
    expect(html).toContain('Обычный');
    // подсказка что капы от уровня, новичок без фармы 60 недоступно
    expect(html).toContain('капы от уровня');
    expect(html).toContain('новичок без фармы');
    // лимит бейдж 24/10 etc
    expect(html).toContain('24');
  });

  it('SSR содержит оба режима и не содержит NaN/undefined', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    // переключатель должен быть в DOM
    expect(html).toContain('Объёмный');
  });

  it('SSR детерминирован (объёмный toggle не ломает)', () => {
    const a = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    const b = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(a).toBe(b);
  });
});
