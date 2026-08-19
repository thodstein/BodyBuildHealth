import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor } from '../BbAutoConstructor';

/**
 * Раунд 4: SSR-проверка, что BB-конструктор рендерится с новым
 * репродуктивным контекстом (карточка режима + чипы/advisory доступны
 * только при включённом женском контексте — проверяем отсутствие поломок).
 */
describe('BB-auto reproductive context UI', () => {
  it('renders athlete mode card with standard/female toggles', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('Режим спортсмена');
    expect(html).toContain('Стандартный');
    expect(html).toContain('Женский контекст');
  });

  it('does not leak undefined/NaN and does not crash with new imports', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});
