import { describe, it, expect } from 'vitest';
import { videoQualityForCapture } from '../strength-sport-video.engine';

describe('ta-video-quality (W4)', () => {
  it('пусто → unknown', () => {
    const r = videoQualityForCapture({});
    expect(r.flag).toBe('unknown');
  });
  it('нормальная геометрия сбоку → ok', () => {
    const r = videoQualityForCapture({ heightM: 1.2, distM: 4, side: 'left', device: 'kinovea' });
    expect(r.flag).toBe('ok');
  });
  it('спереди → rough', () => {
    const r = videoQualityForCapture({ heightM: 1.2, distM: 4, side: 'front' });
    expect(r.flag).toBe('rough');
    expect(r.reason).toContain('спереди');
  });
  it('высоко/далеко → rough с причиной', () => {
    expect(videoQualityForCapture({ heightM: 3, distM: 4 }).flag).toBe('rough');
    expect(videoQualityForCapture({ heightM: 1.2, distM: 10 }).flag).toBe('rough');
    expect(videoQualityForCapture({ heightM: 1.2, distM: 1 }).flag).toBe('rough');
  });
});
