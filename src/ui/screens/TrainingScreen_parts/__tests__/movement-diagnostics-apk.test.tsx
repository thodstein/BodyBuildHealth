import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { VideoCaptureCard } from '../VideoCaptureCard';
import { LiftMasterCard } from '../LiftMasterCard';

describe('movement-diagnostics APK hooks', () => {
  it('VideoCaptureCard: кнопки 44px-пути с data-vc хуками', () => {
    const html = renderToStaticMarkup(<VideoCaptureCard lift="bench" />);
    expect(html).toContain('data-vc="live"');
    expect(html).toContain('data-vc="file"');
    expect(html).toContain('data-vc="demo"');
    expect(html).toContain('aria-label');
  });
  it('LiftMasterCard: импорт Kinovea + выдача с data-lift хуками', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('data-lift="import-kinovea"');
    expect(html).toContain('data-lift="parse-kinovea"');
    expect(html).toContain('data-lift="export-html"');
    expect(html).toContain('data-lift="export-csv"');
    expect(html).toContain('data-lift="share"');
  });
});
