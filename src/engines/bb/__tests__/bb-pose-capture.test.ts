/**
 * bb-pose-capture.test.ts — BB-G-05: пайплайн кадров без камеры и без модели.
 *
 * Проверяется: детектор вызывается на каждый семпл, из результата складывается сводка,
 * DD-подмена (`frames`) не трогает DOM, а видео без длительности даёт честный null
 * (это «не удалось прочитать», а не «поза не найдена»).
 */
import { describe, it, expect, vi } from 'vitest';
import { analyzeBbPoseVideo, BB_POSE_STATUS_RU } from '../bb-pose-capture.engine';
import type { BbPoseLandmark } from '../bb-pose-metrics.engine';

const lm33 = (over: Record<number, { x: number; y: number }> = {}): BbPoseLandmark[] => {
  const arr: BbPoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  for (const [k, v] of Object.entries(over)) arr[Number(k)] = { visibility: 0.9, ...v };
  return arr;
};

/** Профиль с коленом 95° (глубоко) и руками над стопой. */
const sideDeep = (): BbPoseLandmark[] => {
  const A = (95 * Math.PI) / 180;
  const knee = { x: 0.5, y: 0.7 };
  const ankle = { x: knee.x + 0.2 * Math.sin(A), y: knee.y - 0.2 * Math.cos(A) };
  return lm33({
    11: { x: 0.5, y: 0.3 }, 12: { x: 0.5, y: 0.3 },
    15: { x: 0.5, y: 0.16 }, 16: { x: 0.5, y: 0.16 },
    23: { x: 0.5, y: 0.5 }, 24: { x: 0.5, y: 0.5 },
    25: knee, 26: knee, 27: ankle, 28: ankle,
    29: { x: 0.45, y: 0.95 }, 30: { x: 0.45, y: 0.95 },
    31: { x: 0.52, y: 0.95 }, 32: { x: 0.52, y: 0.95 },
  });
};

/** Видео-заглушка: 'seeked' приходит микрозадачей (быстро и детерминированно). */
const fakeVideo = (duration: number) => {
  const v: any = { duration, currentTime: 0 };
  v.addEventListener = (ev: string, cb: () => void) => { if (ev === 'seeked') Promise.resolve().then(cb); };
  v.removeEventListener = () => {};
  return v as HTMLVideoElement;
};

describe('analyzeBbPoseVideo', () => {
  it('семплирует кадры и считает сводку (детектор вызван на каждый семпл)', async () => {
    const detect = vi.fn(() => sideDeep());
    const progress: number[] = [];
    const s = await analyzeBbPoseVideo(fakeVideo(3), 'side', {
      detect,
      maxFrames: 8,
      onProgress: (p) => progress.push(p),
    });
    expect(detect).toHaveBeenCalledTimes(8);
    expect(s).not.toBeNull();
    expect(s!.framesTotal).toBe(8);
    expect(s!.framesPosed).toBe(8);
    expect(s!.depthLevel).toBe('deep');
    expect(s!.quality).toBe('ok');
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('пустые кадры (поза не найдена) → quality none, а не null', async () => {
    const s = await analyzeBbPoseVideo(fakeVideo(2), 'side', { detect: () => null, maxFrames: 8 });
    expect(s).not.toBeNull();
    expect(s!.framesPosed).toBe(0);
    expect(s!.quality).toBe('none');
  });

  it('готовые кадры (`frames`) не трогают видео и детектор', async () => {
    const detect = vi.fn();
    const s = await analyzeBbPoseVideo(fakeVideo(0), 'side', { frames: [sideDeep(), sideDeep(), sideDeep(), sideDeep()], detect });
    expect(detect).not.toHaveBeenCalled();
    expect(s!.framesPosed).toBe(4);
  });

  it('видео без длительности → null (это «не прочитать», не «поза не найдена»)', async () => {
    const s = await analyzeBbPoseVideo(fakeVideo(NaN), 'side', { detect: () => sideDeep() });
    expect(s).toBeNull();
  });

  it('сообщения состояний не обещают мок-цифр', () => {
    expect(BB_POSE_STATUS_RU.noModel).toMatch(/не загрузилась/);
    expect(BB_POSE_STATUS_RU.noPose).toMatch(/Поза не распознана/);
    expect(BB_POSE_STATUS_RU.lowQuality).toMatch(/черновой/);
  });
});
