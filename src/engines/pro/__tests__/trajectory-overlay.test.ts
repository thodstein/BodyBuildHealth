import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mapTrajectoryPoints,
  subsamplePoints,
  dataUrlToBlob,
  canRecordTrajectory,
  renderTrajectoryPng,
  recordTrajectoryWebm,
} from '../trajectory-overlay.engine';

describe('mapTrajectoryPoints — проекция см → пиксели канвы', () => {
  const pad = { x: 10, top: 10, bottom: 10 };

  it('крайние точки прижимаются к границам рабочей области', () => {
    const pts = mapTrajectoryPoints([{ x: 0, y: 0 }, { x: 100, y: 50 }], 120, 120, pad);
    expect(pts[0]).toEqual([10, 110]); // min x → левый паддинг, min y → низ
    expect(pts[1]).toEqual([110, 10]); // max x → правый паддинг, max y → верх
  });

  it('вырожденный диапазон (все точки равны) не даёт NaN/Infinity', () => {
    const pts = mapTrajectoryPoints([{ x: 5, y: 5 }, { x: 5, y: 5 }], 100, 100, pad);
    for (const [x, y] of pts) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('пустой список → пустая проекция', () => {
    expect(mapTrajectoryPoints([], 100, 100, pad)).toEqual([]);
  });
});

describe('subsamplePoints', () => {
  it('оставляет не больше maxPoints, сохраняя первую и последнюю', () => {
    const src = Array.from({ length: 100 }, (_, i) => i);
    const out = subsamplePoints(src, 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(99);
  });

  it('короткий список возвращается целиком', () => {
    expect(subsamplePoints([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
});

describe('dataUrlToBlob', () => {
  it('base64 data:URL превращается в Blob с тем же mime', () => {
    // "PNG" в base64
    const blob = dataUrlToBlob('data:image/png;base64,UE5H');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/png');
    expect(blob!.size).toBe(3);
  });

  it('не-data URL и мусор → null (без выброса)', () => {
    expect(dataUrlToBlob('https://example.com/a.png')).toBeNull();
    expect(dataUrlToBlob('data:image/png,notbase64')).toBeNull();
    expect(dataUrlToBlob('data:image/png;base64,@@@')).toBeNull();
  });
});

describe('растровый/видео-оверлей в не-браузерной среде (jsdom)', () => {
  // jsdom-канвас бросает «Not implemented» — глушим его явным null,
  // чтобы проверять именно честный отказ движка, а не шум jsdom в stderr.
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('canRecordTrajectory() честно false без MediaRecorder', () => {
    // в jsdom нет MediaRecorder — функция обязана вернуть false, а не упасть
    expect(canRecordTrajectory()).toBe(false);
  });

  it('renderTrajectoryPng без canvas возвращает null (вызывающий покажет сообщение)', async () => {
    const png = await renderTrajectoryPng({ liftRu: 'Присед', points: [{ x: 0, y: 0 }, { x: 1, y: 10 }] });
    expect(png).toBeNull();
  });

  it('recordTrajectoryWebm без поддержки записи возвращает null', async () => {
    const webm = await recordTrajectoryWebm({ liftRu: 'Присед', points: [{ x: 0, y: 0 }, { x: 1, y: 10 }] });
    expect(webm).toBeNull();
  });

  it('renderTrajectoryPng без точек возвращает null даже при наличии canvas', async () => {
    expect(await renderTrajectoryPng({ liftRu: 'Присед' })).toBeNull();
  });
});
