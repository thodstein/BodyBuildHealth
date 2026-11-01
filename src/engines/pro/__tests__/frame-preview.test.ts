import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  drawFrameWithMapping,
  renderFrameWithMapping,
} from '../trajectory-overlay.engine';
import { BAR_HEAT_COLORS } from '../../strength-sport/strength-sport-video.engine';

/**
 * Фейковый 2D-контекст: записывает, что именно нарисовано. Нужен, чтобы проверить
 * логику отрисовки линии без браузера (в jsdom canvas не работает).
 */
function fakeCtx() {
  const lines: string[] = [];
  const dotStrokes: string[] = [];
  const moves: Array<[number, number]> = [];
  const dots: Array<{ x: number; y: number; r: number; fill: string }> = [];
  const texts: string[] = [];
  let rects = 0;
  let arc = { x: 0, y: 0, r: 0 };
  let path: 'line' | 'dot' = 'line';
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    beginPath() { path = 'line'; },
    moveTo(x: number, y: number) { moves.push([x, y]); },
    lineTo() {},
    stroke() {
      if (path === 'dot') dotStrokes.push(String(this.strokeStyle));
      else lines.push(String(this.strokeStyle));
    },
    arc(x: number, y: number, r: number) { arc = { x, y, r }; path = 'dot'; },
    fill() { dots.push({ ...arc, fill: String(this.fillStyle) }); },
    fillRect() { rects++; },
    fillText(t: string) { texts.push(t); },
    measureText() { return { width: 120 }; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, lines, dotStrokes, moves, dots, texts, rects: () => rects };
}

describe('drawFrameWithMapping — линия поверх кадра', () => {
  it('без heat-данных рисует ореол и одну линию цветом «быстро», плюс начало/конец', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, { w: 400, h: 300, mapped: [[10, 20], [30, 40], [50, 60]] });
    expect(f.lines).toEqual(['rgba(11,15,20,0.65)', BAR_HEAT_COLORS.fast]);
    expect(f.dots).toHaveLength(2);
    expect(f.dots[0].fill).toBe('#e5e7eb'); // начало — светлая точка
    expect(f.dots[1].fill).toBe(BAR_HEAT_COLORS.fast); // конец — конец подхода
  });

  it('линия одна на весь подход — ровно как в видео-оверлее, без heat-веток', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, {
      w: 400, h: 300,
      mapped: [[0, 0], [10, 10], [20, 20], [30, 30]],
    });
    expect(f.lines).toEqual(['rgba(11,15,20,0.65)', BAR_HEAT_COLORS.fast]);
  });

  it('масштаб превью применяется к координатам, а не к размеру линии', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, { w: 200, h: 150, mapped: [[100, 200], [300, 400]], scale: 0.5 });
    expect(f.moves[0]).toEqual([50, 100]);
  });

  it('точки привязки рисуются фиолетовым с учётом масштаба', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, {
      w: 400, h: 300,
      mapped: [[0, 0], [10, 10]],
      anchors: [[200, 100], [Number.NaN, 5]],
      scale: 0.5,
    });
    expect(f.dots).toHaveLength(3); // начало + конец + одна валидная привязка
    const anchor = f.dots[2];
    expect(anchor.fill).toBe('#a855f7');
    expect(anchor.x).toBe(100);
    expect(anchor.y).toBe(50);
  });

  it('подпись рисуется в плашке и не выходит за кадр', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, {
      w: 200, h: 150,
      mapped: [[0, 0], [10, 10]],
      caption: 'калибровка 8.24 px/см · в кадре 97%',
    });
    expect(f.texts).toEqual(['калибровка 8.24 px/см · в кадре 97%']);
    expect(f.rects()).toBe(1);
  });

  it('меньше двух точек — ничего не рисуем (честная пустота, а не ложная линия)', () => {
    const f = fakeCtx();
    drawFrameWithMapping(f.ctx, { w: 200, h: 150, mapped: [[1, 1]] });
    drawFrameWithMapping(f.ctx, { w: 200, h: 150, mapped: [] });
    expect(f.lines).toHaveLength(0);
    expect(f.dots).toHaveLength(0);
  });
});

describe('renderFrameWithMapping — честные отказы', () => {
  beforeEach(() => {
    // jsdom-канвас не реализован: глушим шум и проверяем именно честный null.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const frame = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 640, height: 480 };

  it('без canvas возвращает null, а не падает', async () => {
    expect(await renderFrameWithMapping(frame, [[0, 0], [10, 10]])).toBeNull();
  });

  it('без кадра/точек или с битыми координатами — null', async () => {
    expect(await renderFrameWithMapping({ ...frame, dataUrl: '' }, [[0, 0], [10, 10]])).toBeNull();
    expect(await renderFrameWithMapping(frame, [[0, 0]])).toBeNull();
    expect(await renderFrameWithMapping(frame, [[0, Number.NaN], [10, 10]])).toBeNull();
  });
});
