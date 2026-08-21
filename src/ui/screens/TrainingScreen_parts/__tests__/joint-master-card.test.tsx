import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { JointMasterCard } from '../JointMasterCard';

describe('JointMasterCard', () => {
  it('рендерит поясницу как дефолт и 7 зон', () => {
    const html = renderToStaticMarkup(<JointMasterCard />);
    expect(html).toContain('Поясница');
    expect(html).toContain('Плечо');
    expect(html).toContain('Колено');
    expect(html).toContain('Тазобедренный');
  });
  it('есть план чистки старых калькуляторов', () => {
    const html = renderToStaticMarkup(<JointMasterCard />);
    expect(html).toContain('План чистки');
  });
});
