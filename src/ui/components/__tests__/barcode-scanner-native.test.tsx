/**
 * barcode-scanner-native.test.tsx — АПК-путь сканера штрихкодов:
 * на native видна кнопка «Снять камерой» (pickPhoto + scanFile),
 * на web/TG её нет (живой стрим html5-qrcode).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { BarcodeScanner } from '../BarcodeScanner';

afterEach(() => {
  cleanup();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

function openScanMode() {
  const { container } = render(
    <BarcodeScanner onProductFound={() => {}} onClose={() => {}} />,
  );
  const camera = Array.from(container.querySelectorAll('.nd-scanmode')).find(
    (b) => b.textContent === 'Камера',
  ) as HTMLElement;
  fireEvent.click(camera);
  return container;
}

describe('BarcodeScanner под АПК', () => {
  it('web: кнопки «Снять камерой» нет', () => {
    const container = openScanMode();
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        (b.textContent || '').includes('Снять камерой'),
      ),
    ).toBe(false);
  });

  it('native: кнопка «Снять камерой» видна с хуком и aria-label', () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    const container = openScanMode();
    const btn = container.querySelector('.nd-scanphoto') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toMatch(/камерой/i);
  });
});
