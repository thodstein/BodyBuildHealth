import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { JointMasterCard } from '../JointMasterCard';

describe('JointMasterCard', () => {
  it('есть единый ортопедический инструмент с JSI и зонами', () => {
    const html = renderToStaticMarkup(<JointMasterCard />);
    expect(html).toContain('Ортопедия и суставы');
    expect(html).toContain('JSI');
    expect(html).toContain('Поясница');
    expect(html).toContain('Плечо');
    expect(html).toContain('Колено');
    expect(html).toContain('Тазобедренный');
  });
});
