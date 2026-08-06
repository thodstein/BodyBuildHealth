import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutoCalculator } from '../AutoCalculator';

const courseLinked = [
  { id: '1', substanceId: 'test_enan', doseValue: 250, doseUnit: 'mg', frequency: '2x/wk', startWeek: 1, endWeek: 12 },
];

describe('AutoCalculator render with course', () => {
  it('renders without throwing when course is linked', () => {
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(
        React.createElement(AutoCalculator, {
          embedded: true,
          courseWeek: 6,
          courseLinked: courseLinked as any,
          onApply: () => {},
        })
      );
    }).not.toThrow();
    expect(html.length).toBeGreaterThan(0);
  });
});
