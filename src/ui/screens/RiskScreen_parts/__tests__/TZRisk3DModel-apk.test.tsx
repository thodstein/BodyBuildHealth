/**
 * TZRisk3DModel-apk.test.tsx — АПК-фикс вылета 3D-модели (механизм-ориентированная):
 * 1) assetUrl — относительный путь от BASE_URL (абсолютный '/x.glb' ломается в WebView);
 * 2) native opt-in — в АПК сцена не грузится сама (~13МБ GLB убивали WebView),
 *    только по тапу «Загрузить 3D», цифры риска доступны в чипах и без 3D;
 * 3) web — как раньше, сцена монтируется сразу (без падения в jsdom).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../../core/app-platform', () => ({
  isNativeApp: vi.fn(() => false),
}));

import { isNativeApp } from '../../../../core/app-platform';
import { TZRisk3DModel, assetUrl, hasWebGL } from '../TZRisk3DModel';
import { riskAssetUrl, riskHasWebGL } from '../Risk3DModel';

const mockedNative = vi.mocked(isNativeApp);

const mockResult = {
  organs: [
    { id: 'cardio', name: 'Сердце', icon: '❤️', afterPercent: 42, rawPercent: 60, k_protect: 30, mechanisms: [{}, {}] },
    { id: 'hepatic', name: 'Печень', icon: '🫁', afterPercent: 18, rawPercent: 25, k_protect: 28, mechanisms: [{}] },
  ],
} as unknown as Parameters<typeof TZRisk3DModel>[0]['tzResult'];

beforeEach(() => {
  mockedNative.mockReset();
  mockedNative.mockReturnValue(false);
});

describe('assetUrl (АПК: относительные пути GLB)', () => {
  it('native: не возвращает абсолютный путь с ведущим слешем', () => {
    mockedNative.mockReturnValue(true);
    const u = assetUrl('/bodybuilder.glb');
    expect(u.startsWith('/')).toBe(false);
    expect(u).toContain('bodybuilder.glb');
  });

  it('native: то же для органов', () => {
    mockedNative.mockReturnValue(true);
    const u = assetUrl('/organs/heart.glb');
    expect(u.startsWith('/')).toBe(false);
    expect(u).toContain('organs/heart.glb');
  });

  it('native: riskAssetUrl (V7/hulk) — тоже относительный', () => {
    mockedNative.mockReturnValue(true);
    const u = riskAssetUrl('/hulk.glb');
    expect(u.startsWith('/')).toBe(false);
    expect(u).toContain('hulk.glb');
  });

  it('web: поведение как раньше — от BASE_URL', () => {
    mockedNative.mockReturnValue(false);
    const u = assetUrl('/bodybuilder.glb');
    expect(u).toContain('bodybuilder.glb');
  });
});

describe('hasWebGL / riskHasWebGL', () => {
  it('не бросает и возвращает boolean', () => {
    expect(typeof hasWebGL()).toBe('boolean');
    expect(typeof riskHasWebGL()).toBe('boolean');
  });
});

describe('TZRisk3DModel — native opt-in', () => {
  it('АПК: сцена не монтируется сама, есть кнопка «Загрузить 3D», чипы риска видны', () => {
    mockedNative.mockReturnValue(true);
    render(<TZRisk3DModel tzResult={mockResult} />);
    expect(screen.getByText('🧊 Загрузить 3D')).toBeTruthy();
    // цифры риска доступны без 3D
    expect(screen.getByText(/42%/)).toBeTruthy();
    expect(screen.queryByLabelText('3D модель рисков')).toBeNull();
  });

  it('АПК: тап «Загрузить 3D» без WebGL (jsdom) — честный фолбэк, без вылета', () => {
    mockedNative.mockReturnValue(true);
    render(<TZRisk3DModel tzResult={mockResult} />);
    fireEvent.click(screen.getByText('🧊 Загрузить 3D'));
    // jsdom без WebGL → failed-ветка, а не исключение
    expect(screen.getByText('3D недоступно в этом окружении')).toBeTruthy();
  });

  it('web/TG: сцена монтируется сразу, кнопки opt-in нет', () => {
    mockedNative.mockReturnValue(false);
    render(<TZRisk3DModel tzResult={mockResult} />);
    expect(screen.queryByText('🧊 Загрузить 3D')).toBeNull();
    expect(screen.getByLabelText('3D модель рисков')).toBeTruthy();
  });
});
