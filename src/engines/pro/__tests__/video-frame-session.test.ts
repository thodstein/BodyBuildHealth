import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { openVideoFrames, openVideoFramesFrom } from '../trajectory-overlay.engine';

/**
 * Фейковый <video>: помнит seek-и и умеет посылать `seeked`. Проверяем именно
 * сессию кадров — что один элемент обслуживает все кадры и что seek-и не
 * перемешиваются, — без реального декодирования (в jsdom его нет).
 */
function fakeVideo(opts?: { w?: number; h?: number; duration?: number; seekEvents?: boolean }) {
  const listeners = new Map<string, Array<() => void>>();
  const seeks: number[] = [];
  const el = {
    videoWidth: opts?.w ?? 1280,
    videoHeight: opts?.h ?? 720,
    duration: opts?.duration ?? 12,
    readyState: 2,
    muted: true,
    playsInline: true,
    preload: '',
    _t: 0,
    seeks,
    addEventListener(ev: string, fn: () => void) {
      const arr = listeners.get(ev) ?? [];
      arr.push(fn);
      listeners.set(ev, arr);
    },
    removeEventListener(ev: string, fn: () => void) {
      listeners.set(ev, (listeners.get(ev) ?? []).filter((x) => x !== fn));
    },
    emit(ev: string) { for (const fn of [...(listeners.get(ev) ?? [])]) fn(); },
  };
  Object.defineProperty(el, 'currentTime', {
    get: () => el._t,
    set: (v: number) => {
      el._t = v;
      seeks.push(v);
      if (opts?.seekEvents === false) return;
      setTimeout(() => el.emit('seeked'), 0);
    },
  });
  return el as unknown as HTMLVideoElement & { seeks: number[]; emit: (e: string) => void; _t: number };
}

let canvasStub: { draws: number[][]; restore: () => void } | null = null;

beforeEach(() => {
  const draws: number[][] = [];
  const ctx = {
    drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => { draws.push([x, y, w, h]); },
  };
  const getCtx = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const toUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/jpeg;base64,FRAME');
  canvasStub = {
    draws,
    restore: () => { getCtx.mockRestore(); toUrl.mockRestore(); },
  };
});

afterEach(() => {
  canvasStub?.restore();
  canvasStub = null;
  vi.useRealTimers();
});

describe('openVideoFramesFrom — одна сессия на все кадры', () => {
  it('четыре кадра берутся с одного элемента: четыре seek, ни одного нового декодирования', async () => {
    const video = fakeVideo();
    const s = await openVideoFramesFrom(video);
    expect(s).not.toBeNull();
    const frames = [];
    for (const t of [1, 2, 3, 4]) frames.push(await s!.grab(t));
    expect(video.seeks).toEqual([1, 2, 3, 4]);
    expect(frames.every((f) => f?.dataUrl === 'data:image/jpeg;base64,FRAME')).toBe(true);
    // Натуральные размеры: тапы по превью пересчитываются в пиксели видео.
    expect(frames[0]!.width).toBe(1280);
    expect(frames[0]!.height).toBe(720);
    // Кадр рисуется уменьшенным (480 px), но координаты остаются видео.
    expect(canvasStub!.draws[0]).toEqual([0, 0, 480, 270]);
    s!.close(); // сессия на элементе UI ничего не останавливает
    expect(video.seeks).toHaveLength(4);
  });

  it('grab() без времени берёт кадр с позиции плеера и видео не двигает', async () => {
    const video = fakeVideo();
    const s = await openVideoFramesFrom(video);
    video.currentTime = 3.4; // пользователь сам поставил момент
    const f = await s!.grab();
    expect(f).not.toBeNull();
    expect(video.seeks).toEqual([3.4]);
    expect(video._t).toBe(3.4);
  });

  it('параллельные запросы выполняются по очереди: кадр всегда с того времени, что просили', async () => {
    const video = fakeVideo();
    const s = await openVideoFramesFrom(video);
    const [a, b] = await Promise.all([s!.grab(1), s!.grab(5)]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(video.seeks).toEqual([1, 5]);
    expect(video._t).toBe(5);
  });

  it('seek не состоялся → null, без бесконечного ожидания', async () => {
    vi.useFakeTimers();
    const video = fakeVideo({ seekEvents: false });
    const s = await openVideoFramesFrom(video);
    const p = s!.grab(7);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await p).toBeNull();
  });

  it('время за концом видео прижимается к последнему кадру', async () => {
    const video = fakeVideo({ duration: 10 });
    const s = await openVideoFramesFrom(video);
    expect(await s!.grab(50)).not.toBeNull();
    expect(video.seeks).toEqual([9.95]);
  });

  it('без canvas или без элемента — честный null', async () => {
    canvasStub!.restore();
    canvasStub = null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await openVideoFramesFrom(fakeVideo())).toBeNull();
    expect(await openVideoFramesFrom(null)).toBeNull();
    expect(await openVideoFramesFrom(undefined)).toBeNull();
  });

  it('видео без размеров (не декодировалось) — null, а не пустой кадр', async () => {
    expect(await openVideoFramesFrom(fakeVideo({ w: 0, h: 0 }))).toBeNull();
  });
});

describe('openVideoFrames — сессия по файлу освобождает ресурсы', () => {
  it('если декодер не поднялся, объект-URL отзывается (нет утечки памяти)', async () => {
    const create = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
    vi.useFakeTimers();
    const pending = openVideoFrames(new Blob(['x'], { type: 'video/mp4' }));
    await vi.advanceTimersByTimeAsync(8100);
    expect(await pending).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });
});
