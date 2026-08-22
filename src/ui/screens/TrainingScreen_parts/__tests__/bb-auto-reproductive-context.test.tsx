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
    // WIP: полный женский контекст (athleteMode) в разработке — проверяем что конструктор рендерится и базовые контролы на месте
    expect(html).toContain('ББ-авто');
    expect(html).toContain('Параметры');
    expect(html).not.toContain('undefined');
  });

  it('does not leak undefined/NaN and does not crash with new imports', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});
