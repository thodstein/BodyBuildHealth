import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mapTrackToVideo,
  calibrationFromTaps,
  isCalibrationSane,
  preferredVideoMime,
  grabVideoFrame,
  type VideoCalibration,
} from '../trajectory-overlay.engine';

const CALIB: VideoCalibration = {
  videoX: 100,
  videoY: 300,
  trackX: 0,
  trackY: 0,
  pxPerCm: 10,
};

describe('mapTrackToVideo — «см трека» → пиксели видео', () => {
  it('якорь переходит сам в себя', () => {
    expect(mapTrackToVideo([{ x: 0, y: 0 }], CALIB)).toEqual([[100, 300]]);
  });

  it('сантиметры умножаются на px/см, а y инвертируется (трек вверх, кадр вниз)', () => {
    const [[x, y]] = mapTrackToVideo([{ x: 2, y: 5 }], CALIB);
    expect(x).toBe(120);
    expect(y).toBe(250);
  });

  it('зеркало по X отражает горизонталь вокруг якоря', () => {
    const [[x]] = mapTrackToVideo([{ x: 2, y: 0 }], { ...CALIB, mirrorX: true });
    expect(x).toBe(80);
  });

  it('битая калибровка и пустые точки не дают мусорных координат', () => {
    expect(mapTrackToVideo([{ x: 1, y: 1 }], { ...CALIB, pxPerCm: Number.NaN })).toEqual([]);
    expect(mapTrackToVideo([{ x: 1, y: 1 }], { ...CALIB, pxPerCm: 0 })).toEqual([]);
    expect(mapTrackToVideo([], CALIB)).toEqual([]);
  });
});

describe('isCalibrationSane — правдоподобность масштаба', () => {
  it('нормальный масштаб проходит, опечатки — нет', () => {
    expect(isCalibrationSane(CALIB)).toBe(true);
    expect(isCalibrationSane({ ...CALIB, pxPerCm: 500 })).toBe(false);
    expect(isCalibrationSane({ ...CALIB, pxPerCm: 0.01 })).toBe(false);
    expect(isCalibrationSane({ ...CALIB, videoX: Number.NaN })).toBe(false);
    expect(isCalibrationSane(null)).toBe(false);
    expect(isCalibrationSane(undefined)).toBe(false);
  });
});

describe('calibrationFromTaps — масштаб из двух тапов известной длины', () => {
  it('px/см = длина отрезка в пикселях / реальная длина', () => {
    const calib = calibrationFromTaps({
      anchor: { videoX: 100, videoY: 300, trackX: 5, trackY: 10 },
      refA: { videoX: 0, videoY: 0 },
      refB: { videoX: 30, videoY: 40 }, // 50 px
      refCm: 2.5,
    });
    expect(calib).toBeTruthy();
    expect(calib!.pxPerCm).toBeCloseTo(20, 5);
    expect(calib!.videoX).toBe(100);
    expect(calib!.trackX).toBe(5);
  });

  it('нулевой эталон/совпавшие тапы — честный null', () => {
    const base = {
      anchor: { videoX: 1, videoY: 1, trackX: 0, trackY: 0 },
      refA: { videoX: 0, videoY: 0 },
      refB: { videoX: 0, videoY: 0 },
    };
    expect(calibrationFromTaps({ ...base, refCm: 45 })).toBeNull();
    expect(calibrationFromTaps({ ...base, refB: { videoX: 10, videoY: 0 }, refCm: 0 })).toBeNull();
  });

  it('неправдоподобный масштаб отбрасывается, а не пишется в персист', () => {
    const calib = calibrationFromTaps({
      anchor: { videoX: 1, videoY: 1, trackX: 0, trackY: 0 },
      refA: { videoX: 0, videoY: 0 },
      refB: { videoX: 10000, videoY: 0 },
      refCm: 1, // 10 000 px/см — опечатка
    });
    expect(calib).toBeNull();
  });
});

describe('preferredVideoMime — контейнер под WebView', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('без MediaRecorder — webm', () => {
    expect(preferredVideoMime()).toEqual({ mime: 'video/webm', ext: 'webm' });
  });

  it('если WebView умеет mp4 — пишем mp4', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t: string) => t.startsWith('video/mp4') });
    const picked = preferredVideoMime();
    expect(picked.ext).toBe('mp4');
    expect(picked.mime.startsWith('video/mp4')).toBe(true);
  });

  it('isTypeSupported бросает — не падаем, остаётся webm', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => { throw new Error('nope'); } });
    expect(preferredVideoMime()).toEqual({ mime: 'video/webm', ext: 'webm' });
  });
});

describe('grabVideoFrame — честный отказ без декодера', () => {
  it('jsdom не декодирует видео → null', async () => {
    const file = new Blob([new Uint8Array([0, 1, 2])], { type: 'video/mp4' });
    expect(await grabVideoFrame(file)).toBeNull();
  });

  it('пустой blob → null, а не исключение', async () => {
    expect(await grabVideoFrame(new Blob([]))).toBeNull();
  });
});
