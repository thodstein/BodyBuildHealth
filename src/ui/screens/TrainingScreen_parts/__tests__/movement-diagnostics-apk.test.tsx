import { describe, expect, it, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { VideoCaptureCard } from '../VideoCaptureCard';
import { LiftMasterCard } from '../LiftMasterCard';

/** Раскрывает все блоки — по умолчанию открыты только «Безопасность» и «Слабые мышцы». */
const openAll = () => localStorage.setItem('he_lift_master_collapsed_v1', '{}');

afterEach(() => {
  localStorage.removeItem('he_lift_master_v1');
  localStorage.removeItem('he_lift_master_collapsed_v1');
});

describe('movement-diagnostics APK hooks', () => {
  it('VideoCaptureCard: кнопки 44px-пути с data-vc хуками', () => {
    const html = renderToStaticMarkup(<VideoCaptureCard lift="bench" />);
    expect(html).toContain('data-vc="live"');
    expect(html).toContain('data-vc="file"');
    expect(html).toContain('data-vc="demo"');
    expect(html).toContain('aria-label');
  });
  it('LiftMasterCard: импорт Kinovea + выдача с data-lift хуками', () => {
    openAll();
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('data-lift="import-kinovea"');
    expect(html).toContain('data-lift="parse-kinovea"');
    expect(html).toContain('data-lift="export-html"');
    expect(html).toContain('data-lift="export-csv"');
    expect(html).toContain('data-lift="share"');
  });
  it('LiftMasterCard: P4 безопасность и P3 VBT-цели рендерятся', () => {
    openAll();
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('data-lift="safety"');
    expect(html).toContain('data-lift="red-flag"');
    expect(html).toContain('data-lift="rule-ok"');
    expect(html).toContain('data-lift="rule-fail"');
    expect(html).toContain('data-lift="vbt-goal"');
  });
  it('LiftMasterCard: L/R-замер при выбранной асимметрии', () => {
    openAll();
    localStorage.setItem('he_lift_master_v1', JSON.stringify({ lift: 'bench', phase: '', issues: ['asymmetric'] }));
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('data-lift="asym-l"');
    expect(html).toContain('data-lift="asym-r"');
  });
  it('LiftMasterCard: кнопка применения и red-flag-баннер доступны как APK-хуки', () => {
    openAll();
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('data-lift="apply-all"');
    expect(html).toContain('data-lift="nav-jump"');
    expect(html).toContain('data-lift-nav="bench"');
  });
});
