import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { VideoCaptureCard } from '../VideoCaptureCard';

describe('VideoCaptureCard', () => {
  it('рендерит гид по ракурсу для жима', () => {
    const html = renderToStaticMarkup(<VideoCaptureCard lift="bench" />);
    expect(html).toContain('Как снимать');
    expect(html).toContain('Ракурс');
    expect(html).toContain('В кадре обязательно');
    expect(html).toContain('Выбрать файл');
  });
  it('гид меняется по движению', () => {
    const htmlSquat = renderToStaticMarkup(<VideoCaptureCard lift="squat" />);
    expect(htmlSquat).toContain('Присед');
    const htmlDead = renderToStaticMarkup(<VideoCaptureCard lift="deadlift" />);
    expect(htmlDead).toContain('Тяга');
  });
});
