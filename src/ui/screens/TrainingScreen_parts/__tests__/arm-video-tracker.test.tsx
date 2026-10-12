/**
 * arm-video-tracker.test.tsx — UI-смок живого видео-разбора (хаб арма).
 * Canvas/video в jsdom не играют — проверяем контракт поверхности:
 * поле файла, калибровка (drag), кнопка разбора, честные статусы.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ArmVideoTracker } from '../arm-video-tracker';

afterEach(() => { try { cleanup(); } catch { /* noop */ } });

describe('ArmVideoTracker (UI)', () => {
  it('рендерит поле выбора видео, калибровку и кнопку разбора', () => {
    render(<ArmVideoTracker />);
    expect(screen.getByLabelText(/Видео файл схватки/)).toBeTruthy();
    expect(screen.getByLabelText('Разобрать видео')).toBeTruthy();
    expect(screen.getByLabelText('Известный размер в кадре см')).toBeTruthy();
    expect(screen.getByLabelText('Кадр для калибровки')).toBeTruthy();
  });

  it('без видео кнопка «Разобрать» заблокирована (нельзя analyze без файла)', () => {
    render(<ArmVideoTracker />);
    const btn = screen.getByLabelText('Разобрать видео') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('canvas калибровки подписан и доступен (aria)', () => {
    render(<ArmVideoTracker />);
    const cv = screen.getByLabelText('Кадр для калибровки') as HTMLCanvasElement;
    expect(cv.tagName).toBe('CANVAS');
    expect(cv.getAttribute('aria-label')).toBe('Кадр для калибровки');
  });

  it('canon: без CDN/поз-моделей в КОДЕ (комментарии не считаются)', () => {
    const fs = require('node:fs');
    const raw = fs.readFileSync(require('node:path').resolve(process.cwd(), 'src/ui/screens/TrainingScreen_parts/arm-video-tracker.tsx'), 'utf8');
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
    expect(src).not.toMatch(/cdn\.jsdelivr|mediapipe|BlazePose|tensorflow|https?:\/\//i);
    expect(src).toContain('buildTrackFromFrames');
    expect(src).toContain('calibratePixelsPerCm');
  });
});
